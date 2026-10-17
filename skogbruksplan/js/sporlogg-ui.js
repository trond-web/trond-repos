// Sporlogg i SkogIQ Felt: gå med telefonen i lomma mens tiltaket utføres. Når sporet stoppes, regnes dekningen ut per
// bestand og blir til utførte tiltak (planlagte tiltak markeres utført, like tiltak samme år slås sammen). GPX fra en
// annen app eller klokke kan leses inn og behandles likt.
import { SPOR_TILTAK, rensSpor, sporLengde, dekningUtm, fordelPaaBestand, foreslaa, bruk, tilGpx, lesGpx, tilGeometri } from './sporlogg.js';
import { TILTAKSTYPER } from './model.js';
import { hentVerdi, lagreVerdi } from './store.js';

const NOKKEL = 'sporlogg-aktiv';
const PC_URL = 'https://unpkg.com/polygon-clipping@0.15.7/dist/polygon-clipping.umd.min.js';
const FARGE = '#1f8f5a';
const HANDLING = {
  'utfor-planlagt': (f) => `Planlagt ${navn(f.tiltak.type).toLowerCase()} ${f.tiltak.aar || ''} markeres utført`,
  'slaa-sammen': (f) => `Slås sammen med utført ${navn(f.tiltak.type).toLowerCase()} ${f.tiltak.utfortDato || ''} → ${dk(f.nyttDaa)} daa`,
  nytt: () => 'Nytt utført tiltak',
};
const navn = (t) => TILTAKSTYPER[t]?.navn || t;
const dk = (v, d = 1) => Number(v || 0).toLocaleString('nb-NO', { maximumFractionDigits: d, minimumFractionDigits: d });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tid = (ms) => { const s = Math.floor(ms / 1000); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h ? `${h} t ${m} min` : `${m} min ${s % 60} s`; };

let pcLaster = null;
function lastPC() {
  if (window.polygonClipping) return Promise.resolve(window.polygonClipping);
  if (!pcLaster) {
    pcLaster = new Promise((res, rej) => { const s = document.createElement('script'); s.src = PC_URL; s.onload = () => res(window.polygonClipping); s.onerror = () => { pcLaster = null; rej(new Error('Geometribiblioteket mangler. Åpne appen én gang på nett først.')); }; document.head.appendChild(s); });
  }
  return pcLaster;
}

export function initSporlogg({ L, kart, plan, lagrePlanen, aapneArk, lukkArk, melding, tegnPlan, nyId, settStatus }) {
  let aktiv = null; // { planId, type, bredde, start, segmenter: [[{lat,lon,noyaktighet,tid}]], pauset, pauseTid }
  let watch = null; let wake = null; let tikk = null;
  let linjer = []; let dekningLag = null; let resultat = null; let folg = true; let forstePunkt = true; let sistFeil = 0;
  kart.on('dragstart', () => { folg = false; });
  const lag = L.layerGroup().addTo(kart);
  const utfortLag = L.layerGroup().addTo(kart);

  // ---------- tegning ----------
  const meterPerPiksel = () => (40075016.686 * Math.cos((kart.getCenter().lat * Math.PI) / 180)) / 2 ** (kart.getZoom() + 8);
  function tegnSpor() {
    for (const l of linjer) l.remove();
    linjer = [];
    if (!aktiv) return;
    const w = Math.max(3, aktiv.bredde / meterPerPiksel());
    for (const seg of aktiv.segmenter) {
      if (seg.length < 1) continue;
      const ll = seg.map((p) => [p.lat, p.lon]);
      linjer.push(L.polyline(ll, { color: FARGE, weight: w, opacity: 0.35, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(lag));
      linjer.push(L.polyline(ll, { color: '#0d4d30', weight: 2, opacity: 0.9, interactive: false }).addTo(lag));
    }
  }
  kart.on('zoomend', tegnSpor);
  function tegnUtfort() {
    utfortLag.clearLayers();
    const P = plan(); if (!P) return;
    const fra = String(new Date().getFullYear() - 1);
    for (const b of P.bestand) for (const t of b.tiltak || []) {
      if (t.status !== 'utfort' || !t.dekning || String(t.utfortDato || t.aar).slice(0, 4) < fra) continue;
      L.geoJSON(t.dekning, { style: { color: FARGE, weight: 1, fillColor: FARGE, fillOpacity: 0.28, dashArray: '3 3' }, interactive: false }).addTo(utfortLag);
    }
  }

  // ---------- status ----------
  const punkter = () => aktiv?.segmenter.flat() || [];
  function status() {
    const el = document.getElementById('sporStatus');
    if (resultat) { el.hidden = false; settStatus(true); el.innerHTML = `<div><b>${esc(navn(resultat.type))}</b> · sporet er ferdig, men ikke lagret</div><div class="spor-knapper"><button type="button" class="knapp liten primar" data-spor="vis">Vis resultat</button></div>`; return; }
    if (!aktiv) { el.hidden = true; settStatus(false); return; }
    const p = rensSpor(punkter()); const lengde = sporLengde(p);
    const varighet = (aktiv.pauset ? aktiv.pauseTid : Date.now()) - aktiv.start - (aktiv.pauseSum || 0);
    el.hidden = false; settStatus(true);
    el.innerHTML = `<div><b>${aktiv.pauset ? '⏸' : '<span class="opptak"></span>'} ${esc(navn(aktiv.type))}</b> · ${tid(varighet)} · ${dk(lengde / 1000, 2)} km · ca. ${dk((lengde * aktiv.bredde) / 1000)} daa</div>
      <div class="spor-knapper"><button type="button" class="knapp liten" data-spor="${aktiv.pauset ? 'fortsett' : 'pause'}">${aktiv.pauset ? 'Fortsett' : 'Pause'}</button><button type="button" class="knapp liten primar" data-spor="stopp">Stopp</button></div>`;
  }
  const lagreAktiv = () => lagreVerdi(NOKKEL, aktiv).catch(() => {});

  // ---------- opptak ----------
  async function vaaken(paa) {
    try {
      if (paa && 'wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); }
      if (!paa && wake) { await wake.release(); wake = null; }
    } catch { /* ikke støttet */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && aktiv && !aktiv.pauset) vaaken(true); });
  function startGps() {
    if (watch !== null) return;
    if (!aktiv.segmenter.length || aktiv.segmenter.at(-1).length) aktiv.segmenter.push([]);
    let teller = 0;
    watch = navigator.geolocation.watchPosition((p) => {
      if (!aktiv || aktiv.pauset) return;
      aktiv.segmenter.at(-1).push({ lat: p.coords.latitude, lon: p.coords.longitude, noyaktighet: Math.round(p.coords.accuracy), tid: Date.now() });
      if (++teller % 5 === 0) lagreAktiv();
      if (folg && document.getElementById('ark').hidden) { if (forstePunkt) kart.setView([p.coords.latitude, p.coords.longitude], Math.max(kart.getZoom(), 17)); else kart.panTo([p.coords.latitude, p.coords.longitude], { animate: false }); }
      forstePunkt = false;
      tegnSpor(); status();
    }, (e) => { if (e.code === 1) melding('Appen har ikke tilgang til posisjon. Tillat posisjon i nettleserens innstillinger.', 6000); else if (e.code === 2 && Date.now() - sistFeil > 60000) { sistFeil = Date.now(); melding('Finner ikke GPS-posisjon her. Opptaket fortsetter når signalet er tilbake.', 4000); } }, { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 });
    vaaken(true);
    tikk = setInterval(status, 1000);
  }
  function stoppGps() { if (watch !== null) navigator.geolocation.clearWatch(watch); watch = null; clearInterval(tikk); vaaken(false); }

  function visStart() {
    const P = plan(); if (!P) { melding('Velg en plan først.'); return; }
    if (!navigator.geolocation) { melding('Enheten støtter ikke GPS i nettleseren.'); return; }
    // Tiltakstyper som er planlagt i år eller neste år, først.
    const planlagt = new Set(P.bestand.flatMap((b) => (b.tiltak || []).filter((t) => t.status !== 'utfort' && (t.aar || 0) <= new Date().getFullYear() + 1).map((t) => t.type)));
    const typer = Object.keys(SPOR_TILTAK).sort((a, b) => (planlagt.has(b) ? 1 : 0) - (planlagt.has(a) ? 1 : 0));
    const valgt = typer[0];
    aapneArk(`<h2>Sporlogg for utført tiltak</h2>
      <p class="hint">Gå over området mens du gjør tiltaket. Når du stopper, regnes dekningen ut per bestand og blir til utførte tiltak.</p>
      <h3>Tiltak</h3><div class="chips">${typer.map((t) => `<button type="button" class="chip" data-spor-type="${t}" aria-pressed="${t === valgt}">${esc(navn(t))}${planlagt.has(t) ? ' •' : ''}</button>`).join('')}</div>
      <label class="hint" for="sporBredde">Arbeidsbredde (m) – <span id="sporBreddeTekst">${esc(SPOR_TILTAK[valgt].tekst)}</span></label>
      <input id="sporBredde" type="number" min="1" max="60" step="1" value="${SPOR_TILTAK[valgt].bredde}" inputmode="numeric" class="tallfelt">
      <div class="knapper"><button type="button" class="knapp primar" data-spor="start">● Start sporlogg</button></div>
      <p class="hint">• = planlagt i år eller neste år. Gå i striper med omtrent arbeidsbredden mellom. Appen holder skjermen våken, og telefonen kan ligge i lomma. Låser du skjermen, kan nettleseren stoppe GPS – logg da med en annen app eller klokke og les inn GPX-filen.</p>
      <div class="knapper"><label class="knapp">Les inn GPX-fil<input type="file" accept=".gpx,application/gpx+xml" id="gpxFil" hidden></label></div>`);
  }
  function start(type, bredde) {
    aktiv = { planId: plan().planId, type, bredde, start: Date.now(), segmenter: [], pauset: false, pauseSum: 0 };
    folg = true; forstePunkt = true;
    lagreAktiv(); lukkArk(); startGps(); status(); tegnSpor();
    melding('Sporlogg startet. Gå over området – trykk Stopp når du er ferdig.', 4500);
  }
  function pause() { if (!aktiv) return; aktiv.pauset = true; aktiv.pauseTid = Date.now(); stoppGps(); lagreAktiv(); status(); }
  function fortsett() { if (!aktiv) return; aktiv.pauseSum = (aktiv.pauseSum || 0) + (Date.now() - (aktiv.pauseTid || Date.now())); aktiv.pauset = false; startGps(); lagreAktiv(); status(); }
  async function stopp() {
    if (!aktiv) return;
    stoppGps(); aktiv.slutt = Date.now(); if (!aktiv.pauset) { aktiv.pauset = true; aktiv.pauseTid = Date.now(); } await lagreAktiv();
    const seg = aktiv.segmenter.map((s) => rensSpor(s)).filter((s) => s.length >= 2);
    if (!seg.length) { melding('Sporet har for få punkter. Gå litt lenger, eller vent til GPS-en har god nøyaktighet.', 5000); status(); return; }
    await beregn({ type: aktiv.type, bredde: aktiv.bredde, segmenter: seg, start: aktiv.start, slutt: aktiv.slutt, kilde: 'gps' });
  }
  async function forkast() { aktiv = null; resultat = null; await lagreVerdi(NOKKEL, null).catch(() => {}); stoppGps(); tegnSpor(); status(); dekningLag?.remove(); dekningLag = null; lukkArk(); }

  // ---------- beregning og forslag ----------
  async function beregn(spor) {
    let PC;
    try { PC = await lastPC(); } catch (e) { melding(e.message, 6000); return; }
    const P = plan();
    const dekning = dekningUtm(spor.segmenter, spor.bredde, PC);
    const fordeling = fordelPaaBestand(dekning, P.bestand, PC);
    const dato = new Date(spor.slutt || Date.now()).toISOString().slice(0, 10);
    resultat = { ...spor, PC, dekning, fordeling, dato, forslag: foreslaa(fordeling, spor.type, { aar: Number(dato.slice(0, 4)), PC }) };
    dekningLag?.remove();
    const g = tilGeometri(dekning);
    if (g) { dekningLag = L.geoJSON(g, { style: { color: '#0d4d30', weight: 1.5, fillColor: FARGE, fillOpacity: 0.4 }, interactive: false }).addTo(kart); kart.fitBounds(dekningLag.getBounds(), { padding: [40, 40], paddingBottomRight: [40, window.innerHeight * 0.5] }); }
    visResultat(); status();
  }
  function nyeForslag() {
    const r = resultat; const behold = new Map(r.forslag.map((f) => [f.b.id, { velg: f.velg, brukHelt: f.brukHelt }]));
    r.forslag = foreslaa(r.fordeling, r.type, { aar: Number(r.dato.slice(0, 4)), PC: r.PC }).map((f) => ({ ...f, ...(behold.get(f.b.id) || {}) }));
  }
  function visResultat() {
    const r = resultat; const sum = r.fordeling.reduce((s, f) => s + f.daa, 0);
    const lengde = r.segmenter.reduce((s, seg) => s + sporLengde(seg), 0);
    aapneArk(`<h2>${esc(navn(r.type))} – resultat</h2>
      <p class="hint">${dk(lengde / 1000, 2)} km spor × ${r.bredde} m bredde gir <b>${dk(sum)} daa</b> i ${r.fordeling.length} bestand.${r.kilde === 'gpx' ? ' (fra GPX-fil)' : ''}</p>
      <div class="spor-valg">
        <label>Tiltak<select data-spor-felt="type">${Object.keys(SPOR_TILTAK).map((t) => `<option value="${t}" ${t === r.type ? 'selected' : ''}>${esc(navn(t))}</option>`).join('')}</select></label>
        <label>Bredde (m)<input type="number" min="1" max="60" data-spor-felt="bredde" value="${r.bredde}"></label>
        <label>Dato<input type="date" data-spor-felt="dato" value="${r.dato}"></label>
      </div>
      <h3>Bestand</h3>
      <div class="liste">${r.forslag.map((f, i) => `<div class="rad spor-rad ${f.velg ? '' : 'dempet'}">
        <div><div class="tittel">Bestand ${esc(f.b.nr)} · ${dk(f.daa)} daa <span class="hint">(${Math.round(f.andel * 100)} %)</span></div>
        <div class="under">${esc(HANDLING[f.handling](f))}</div>
        ${f.andel >= 0.5 ? `<label class="hint"><input type="checkbox" data-spor-helt="${i}" ${(f.brukHelt ?? f.helt) ? 'checked' : ''}> Hele bestandet (${dk(f.b.areal)} daa)</label>` : ''}</div>
        <input type="checkbox" class="stor-avkryss" data-spor-velg="${i}" ${f.velg ? 'checked' : ''} aria-label="Ta med bestand ${esc(f.b.nr)}"></div>`).join('') || '<div class="tom">Sporet dekker ingen bestand i planen.</div>'}</div>
      <p class="hint">Bestand med under 0,1 daa er ikke valgt (bare gått gjennom). Like tiltak samme år i samme bestand slås sammen – overlapp telles ikke dobbelt.</p>
      <div class="knapper"><button type="button" class="knapp fare" data-spor="forkast">Forkast</button><button type="button" class="knapp" data-spor="gpx">GPX</button><button type="button" class="knapp primar" data-spor="lagre" ${r.forslag.some((f) => f.velg) ? '' : 'disabled'}>Lagre tiltak</button></div>`, { hoy: true });
  }
  async function lagre() {
    const r = resultat; const P = plan();
    const sporId = nyId('s');
    const n = bruk(r.forslag, r.type, { dato: r.dato, sporId, PC: r.PC, nyId });
    P.sporlogger = P.sporlogger || [];
    P.sporlogger.unshift({ id: sporId, type: r.type, bredde: r.bredde, start: r.start ? new Date(r.start).toISOString() : null, slutt: r.slutt ? new Date(r.slutt).toISOString() : null, kilde: r.kilde, lengdeM: Math.round(r.segmenter.reduce((s, seg) => s + sporLengde(seg), 0)), dekningDaa: Math.round(r.fordeling.reduce((s, f) => s + f.daa, 0) * 100) / 100, bestand: r.forslag.filter((f) => f.velg).map((f) => f.b.id), segmenter: r.segmenter.map((s) => s.map((p) => [Math.round(p.lat * 1e6) / 1e6, Math.round(p.lon * 1e6) / 1e6, p.tid || null])) });
    await lagrePlanen();
    if (r.kilde === 'gps' || aktiv?.pauset) { aktiv = null; await lagreVerdi(NOKKEL, null).catch(() => {}); }
    resultat = null; dekningLag?.remove(); dekningLag = null; tegnSpor(); status(); tegnPlan(); tegnUtfort(); lukkArk();
    melding(`${n} tiltak lagret som utført.`, 4000);
  }
  function lastNedGpx() {
    const r = resultat; const blob = new Blob([tilGpx(r.segmenter, `${navn(r.type)} ${r.dato}`)], { type: 'application/gpx+xml' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `sporlogg-${r.type}-${r.dato}.gpx`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }
  async function lesInnGpx(fil, type, bredde) {
    const seg = lesGpx(await fil.text()).map((s) => rensSpor(s, { maksNoyaktighet: 1e9, tillatFart: 1e9 })).filter((s) => s.length >= 2);
    if (!seg.length) { melding('Fant ingen spor i filen.'); return; }
    const tider = seg.flat().map((p) => p.tid).filter(Boolean);
    await beregn({ type, bredde, segmenter: seg, start: tider.length ? Math.min(...tider) : null, slutt: tider.length ? Math.max(...tider) : Date.now(), kilde: 'gpx' });
  }

  // ---------- hendelser ----------
  document.getElementById('sporStatus').addEventListener('click', (e) => {
    const h = e.target.closest('[data-spor]')?.dataset.spor;
    if (h === 'pause') pause(); else if (h === 'fortsett') fortsett(); else if (h === 'stopp') stopp(); else if (h === 'vis' && resultat) visResultat();
  });
  const ark = document.getElementById('arkInnhold');
  ark.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-spor-type]');
    if (t) { document.querySelectorAll('[data-spor-type]').forEach((c) => c.setAttribute('aria-pressed', String(c === t))); document.getElementById('sporBredde').value = SPOR_TILTAK[t.dataset.sporType].bredde; document.getElementById('sporBreddeTekst').textContent = SPOR_TILTAK[t.dataset.sporType].tekst; return; }
    const h = e.target.closest('[data-spor]')?.dataset.spor; if (!h) return;
    if (h === 'start') { const ty = document.querySelector('[data-spor-type][aria-pressed="true"]')?.dataset.sporType || 'annet'; start(ty, Math.max(1, Number(document.getElementById('sporBredde').value) || SPOR_TILTAK[ty].bredde)); }
    if (h === 'lagre') lagre();
    if (h === 'gpx') lastNedGpx();
    if (h === 'forkast' && confirm('Forkaste sporet? Ingen tiltak blir lagret.')) forkast();
  });
  ark.addEventListener('change', async (e) => {
    const el = e.target;
    if (el.id === 'gpxFil' && el.files[0]) {
      const ty = document.querySelector('[data-spor-type][aria-pressed="true"]')?.dataset.sporType || 'annet';
      lesInnGpx(el.files[0], ty, Math.max(1, Number(document.getElementById('sporBredde').value) || SPOR_TILTAK[ty].bredde)); return;
    }
    if (!resultat) return;
    if (el.dataset.sporVelg !== undefined) { resultat.forslag[Number(el.dataset.sporVelg)].velg = el.checked; visResultat(); return; }
    if (el.dataset.sporHelt !== undefined) { resultat.forslag[Number(el.dataset.sporHelt)].brukHelt = el.checked; return; }
    const felt = el.dataset.sporFelt;
    if (felt === 'type') { resultat.type = el.value; nyeForslag(); visResultat(); }
    if (felt === 'dato' && el.value) { resultat.dato = el.value; nyeForslag(); visResultat(); }
    if (felt === 'bredde') { resultat.bredde = Math.max(1, Number(el.value) || 1); await beregn(resultat); }
  });

  return {
    visStart,
    tegnUtfort,
    aktiv: () => !!aktiv,
    harResultat: () => !!resultat,
    // Et spor som var i gang da appen ble lukket, kan fortsettes eller avsluttes.
    async gjenoppta() {
      const lagret = await hentVerdi(NOKKEL).catch(() => null);
      if (!lagret || lagret.planId !== plan()?.planId) return;
      aktiv = { ...lagret, pauset: true, pauseTid: lagret.pauseTid || Date.now() };
      tegnSpor(); status();
      melding('Sporloggen fra sist er ikke avsluttet. Trykk Fortsett eller Stopp.', 6000);
    },
  };
}
