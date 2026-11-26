// SkogIQ Entreprenør – feltløsningen for entreprenører. Oppdragene kommer fra skogeiere i Nettverk (tildelt og
// miljøsjekket på web). Her gjennomføres de: kart med hele planen, oppdragets bestand, hensyn og driftsveg, framdrift
// og mengde per bestand, miljøsjekk i felt, avvik med bilde og posisjon, og sluttrapport med signatur. Alt lagres på
// telefonen og sendes når det er nett. Ingen PDF-skjema. Logikken: feltoppdrag.js; serveren: /api/feltoppdrag.
import { innloggetBruker } from './innlogging.js'; // først: økten følger med alle kall til serveren
import { API } from './plan-synk.js';
import { lagreVerdi, hentVerdi } from './store.js';
import { TRESLAG, HK_ROMERTALL, TILTAKSTYPER } from './model.js';
import { punktIGeometri, etikettPunkt } from './proj.js';
import { typeFor, linjer } from './oppdrag.js';
import { misFigurer, misKartlag } from './miljokart.js';
import { flisUrler, FLIS_CACHE } from './offline-kart.js';
import * as FO from './feltoppdrag.js';
import { VERSJON } from './versjon.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v, d = 0) => (v == null || Number.isNaN(Number(v)) ? '–' : Number(v).toLocaleString('nb-NO', { maximumFractionDigits: d, minimumFractionDigits: d }));
const idag = () => new Date().toISOString().slice(0, 10);
const datoNb = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
let meldTimer = null;
function melding(t, ms = 3500) { const m = $('#melding'); m.textContent = t; m.hidden = false; clearTimeout(meldTimer); meldTimer = setTimeout(() => { m.hidden = true; }, Math.max(ms, Math.min(8000, t.length * 55))); }

// ---------- tilstand ----------
let liste = []; // [{ id, nr, tittel, type, status, eiendom, eierNavn, … }]
let aktiv = null; // { d: { id, oppdrag, plan, status, … }, rapport, versjon, ulagret }
let visning = 'oppdrag'; let apenLinje = null; let nyttAvvik = null; let velgPunkt = null; let synkTimer = null; let synker = false;
const S = () => aktiv?.d.plan; const O = () => aktiv?.d.oppdrag;
const nokkel = (id) => `entreprenor:${id}`;
async function lagreLokalt() { if (!aktiv) return; await lagreVerdi(nokkel(aktiv.d.id), aktiv); await lagreVerdi('entreprenor:sist', aktiv.d.id); }
const kanEndre = () => aktiv && !['ferdigmeldt', 'godkjent', 'trukket'].includes(aktiv.d.status);

async function kall(sti, { metode = 'GET', kropp } = {}) {
  const r = await fetch(`${API}${sti}`, { method: metode, headers: kropp ? { 'Content-Type': 'application/json' } : {}, credentials: 'same-origin', body: kropp ? JSON.stringify(kropp) : undefined, cache: 'no-store' });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.feil || `Serveren svarte ${r.status}`), { status: r.status, svar: j }); return j;
}
function nettStatus() { $('#nett').classList.toggle('av', !navigator.onLine); $('#nett').title = navigator.onLine ? 'På nett' : 'Uten nett – alt lagres på telefonen'; }

// ---------- henting og synkronisering ----------
async function hentListe() {
  try { liste = (await kall('/api/feltoppdrag')).oppdrag.filter((x) => x.jegEr === 'utforer'); await lagreVerdi('entreprenor:liste', liste); }
  catch (e) { liste = (await hentVerdi('entreprenor:liste')) || []; if (e.status === 401) melding('Logg inn for å hente oppdragene.'); else if (navigator.onLine) melding(e.message); }
}
async function apneOppdrag(id) {
  const lokal = await hentVerdi(nokkel(id));
  try {
    const d = await kall(`/api/feltoppdrag/${id}`);
    // Ulagrede endringer på telefonen beholdes; ellers brukes serverens rapport.
    aktiv = lokal?.ulagret ? { ...lokal, d: { ...d, rapport: undefined } } : { d: { ...d, rapport: undefined }, rapport: FO.sikreRapport(d.plan, d.oppdrag, d.rapport), versjon: d.versjon, ulagret: false };
    aktiv.d.status = d.status;
  } catch (e) {
    if (e.status === 410) { melding('Skogeieren har trukket tilbake dette oppdraget.'); await hentListe(); visOppdrag(); return; }
    if (!lokal) { melding(navigator.onLine ? e.message : 'Oppdraget er ikke lastet ned på telefonen ennå – åpne det én gang med nett.'); return; }
    aktiv = lokal; melding('Uten nett – viser oppdraget slik det er lagret på telefonen.');
  }
  aktiv.rapport = FO.sikreRapport(S(), O(), aktiv.rapport);
  await lagreLokalt(); tegnKart(true); oppdaterTopp(); visOppdrag(); synkSnart(0);
}
function synkSnart(ms = 1500) { clearTimeout(synkTimer); synkTimer = setTimeout(synk, ms); synkStripe(); }
async function synk() {
  if (!aktiv?.ulagret || synker || !navigator.onLine) { synkStripe(); return; }
  synker = true; synkStripe();
  try {
    const r = await kall(`/api/feltoppdrag/${aktiv.d.id}/rapport`, { metode: 'PUT', kropp: { rapport: aktiv.rapport, grunnVersjon: aktiv.versjon } });
    aktiv.versjon = r.versjon; aktiv.d.status = r.status; aktiv.ulagret = false;
  } catch (e) {
    if (e.status === 409 && e.svar?.versjon != null) { aktiv.versjon = e.svar.versjon; synker = false; await lagreLokalt(); return synk(); } // endret på en annen enhet: telefonen vinner
    if (e.status === 409 || e.status === 410) { melding(e.message); aktiv.ulagret = false; }
    else if (e.status !== 0) melding(`Rapporten ble ikke sendt: ${e.message}. Prøver igjen.`);
  }
  synker = false; await lagreLokalt(); synkStripe(); oppdaterTopp();
  if (!aktiv.ulagret && visning === 'ferdig' && !$('#ark').hidden && aktiv.rapport.slutt) visFerdig();
}
function synkStripe() {
  const el = $('#synkStripe'); if (!aktiv) { el.hidden = true; return; }
  el.hidden = !aktiv.ulagret && !synker;
  el.textContent = synker ? '⏳ Sender rapporten …' : !navigator.onLine ? '📴 Uten nett – lagret på telefonen, sendes når du har nett' : '⏳ Ikke sendt ennå';
}
function endret() { if (!aktiv) return; aktiv.ulagret = true; lagreLokalt(); synkSnart(); }

// ---------- kart ----------
const kart = L.map('kart', { zoomControl: false, attributionControl: true }).setView([60.5, 10.5], 6);
const kv = (lag) => L.tileLayer(`https://cache.kartverket.no/v1/wmts/1.0.0/${lag}/default/webmercator/{z}/{y}/{x}.png`, { maxZoom: 20, maxNativeZoom: 18, attribution: '© Kartverket' });
const LAG = { topo: kv('topo'), graa: kv('topograatone'), flyfoto: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20, maxNativeZoom: 19, attribution: 'Flyfoto © Esri, Maxar' }) };
let lagNavn = 'topo'; LAG.topo.addTo(kart);
const planLag = L.featureGroup().addTo(kart); const miljoLag = L.featureGroup().addTo(kart); const avvikLag = L.featureGroup().addTo(kart);
const lagPerLinje = new Map();
const STATUS_FARGE = { ikke: '#ff8a00', pagar: '#fab219', ferdig: '#0ca30c' };
function tegnKart(zoom = false) {
  planLag.clearLayers(); miljoLag.clearLayers(); lagPerLinje.clear(); if (!aktiv) return;
  const plan = S(); const o = O();
  if (plan.eiendom?.grense) L.geoJSON(plan.eiendom.grense, { style: { color: '#d03b3b', weight: 2.5, dashArray: '8 5', fill: false }, interactive: false }).addTo(planLag);
  const iOppdrag = new Map(linjer(plan, o).map((l) => [l.bestand.id, l]));
  for (const b of plan.bestand || []) {
    if (!b.geometri) continue; const l = iOppdrag.get(b.id); const st = l ? aktiv.rapport.linjer[l.tiltak.id]?.status || 'ikke' : null;
    const lag = L.geoJSON(b.geometri, { style: l ? { color: '#10241c', weight: 2.5, fillColor: STATUS_FARGE[st], fillOpacity: st === 'ferdig' ? 0.45 : 0.35 } : { color: '#5b6b62', weight: 1, fillColor: '#ffffff', fillOpacity: 0.12 } });
    const p = etikettPunkt(b.geometri);
    if (p) L.marker([p[1], p[0]], { icon: L.divIcon({ className: `ent-etikett${l ? ' i-oppdrag' : ''}`, html: `<b>${esc(b.nr)}</b>${l ? `<span>${st === 'ferdig' ? '✓' : st === 'pagar' ? '…' : ''}</span>` : ''}`, iconSize: null }), interactive: false }).addTo(planLag);
    lag.on('click', (e) => { L.DomEvent.stopPropagation(e); if (velgPunkt) { velgPunkt(e.latlng); return; } if (l) { apenLinje = l.tiltak.id; settVisning('bestand'); } else melding(`Bestand ${b.nr} er ikke med i oppdraget (${TRESLAG[b.treslag] || ''}${b.bonitet ? ` ${b.bonitet}` : ''}, ${fmt(b.areal, 1)} daa).`); });
    lag.addTo(planLag); if (l) lagPerLinje.set(l.tiltak.id, lag);
  }
  // Hensyn: nøkkelbiotoper og miljøfigurer, kantsone mot vann, driftsveg og velteplasser.
  try { const mf = misFigurer(plan); if (mf.length) { const ml = misKartlag(L, mf, { svg: false }); ml.flater.addTo(miljoLag); ml.merker.addTo(miljoLag); } } catch { /* uten miljødata */ }
  if (plan.kantsone?.geometri) L.geoJSON(plan.kantsone.geometri, { style: { color: '#3b8fe8', weight: 1, fillColor: '#3b8fe8', fillOpacity: 0.3 }, interactive: false }).addTo(miljoLag);
  if (o.driftsveg?.geometri) L.geoJSON(o.driftsveg.geometri, { style: { color: '#8a4b00', weight: 5, opacity: 0.9, dashArray: o.driftsveg.status === 'beholdt' ? null : '10 6' }, interactive: false }).addTo(miljoLag);
  for (const p of o.driftsveg?.velteplasser || []) L.circleMarker([p[1], p[0]], { radius: 8, color: '#fff', weight: 2.5, fillColor: '#2a78d6', fillOpacity: 1, interactive: false }).addTo(miljoLag);
  tegnAvvik();
  if (zoom) zoomTilOppdrag();
}
function zoomTilOppdrag() { const g = L.featureGroup([...lagPerLinje.values()]); const b = g.getLayers().length ? g.getBounds() : planLag.getBounds(); if (b.isValid()) kart.fitBounds(b, { padding: [30, 30], maxZoom: 17, paddingBottomRight: [0, Math.round(innerHeight * 0.35)] }); }
function tegnAvvik() {
  avvikLag.clearLayers(); if (!aktiv) return;
  for (const a of aktiv.rapport.avvik) if (a.pos) L.marker([a.pos[1], a.pos[0]], { icon: L.divIcon({ className: 'ent-avvik-merke', html: `<span>${FO.AVVIK[a.type]?.ikon || '⚠️'}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }) }).on('click', () => { nyttAvvik = { ...a, bilder: [...(a.bilder || [])] }; settVisning('avvik'); }).addTo(avvikLag);
}
kart.on('click', (e) => { if (velgPunkt) velgPunkt(e.latlng); });
$('#lagBtn').onclick = () => { const r = ['topo', 'flyfoto', 'graa']; kart.removeLayer(LAG[lagNavn]); lagNavn = r[(r.indexOf(lagNavn) + 1) % r.length]; LAG[lagNavn].addTo(kart); LAG[lagNavn].bringToBack(); melding({ topo: 'Topografisk kart', flyfoto: 'Flyfoto', graa: 'Gråtonekart' }[lagNavn], 1500); };
$('#zoomBtn').onclick = () => zoomTilOppdrag();

// GPS: posisjon i kartet og til avvik.
let gpsWatch = null; let gpsPos = null; let gpsMerke = null; let folg = false;
function startGps() {
  if (!navigator.geolocation) { melding('Telefonen gir ikke posisjon.'); return; }
  if (gpsWatch !== null) { folg = !folg; $('#gpsBtn').classList.toggle('folg', folg); if (folg && gpsPos) kart.setView([gpsPos.lat, gpsPos.lng], Math.max(kart.getZoom(), 16)); return; }
  folg = true; $('#gpsBtn').setAttribute('aria-pressed', 'true'); $('#gpsBtn').classList.add('folg');
  gpsWatch = navigator.geolocation.watchPosition((p) => {
    gpsPos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
    if (!gpsMerke) gpsMerke = L.circleMarker([gpsPos.lat, gpsPos.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2a78d6', fillOpacity: 1 }).addTo(kart); else gpsMerke.setLatLng([gpsPos.lat, gpsPos.lng]);
    if (folg) kart.setView([gpsPos.lat, gpsPos.lng], Math.max(kart.getZoom(), 16));
  }, () => melding('Fikk ikke posisjon – sjekk at stedstjenester er på.'), { enableHighAccuracy: true, maximumAge: 5000 });
}
$('#gpsBtn').onclick = startGps;
kart.on('dragstart', () => { if (folg) { folg = false; $('#gpsBtn').classList.remove('folg'); } });

// ---------- ark og visninger ----------
function aapneArk(html, { hoy = false } = {}) { $('#arkInnhold').innerHTML = html; $('#ark').hidden = false; $('#ark').classList.toggle('hoy', hoy); $('#arkInnhold').scrollTop = 0; document.body.classList.add('ark-aapent'); }
function lukkArk() { $('#ark').hidden = true; document.body.classList.remove('ark-aapent'); if (velgPunkt) { velgPunkt = null; document.body.classList.remove('velger-punkt'); } }
$('#arkLukk').onclick = lukkArk;
$('#arkHandtak').onclick = () => $('#ark').classList.toggle('hoy');
function settVisning(v) {
  visning = v; for (const k of document.querySelectorAll('.bunn [data-vis]')) k.classList.toggle('aktiv', k.dataset.vis === v);
  if (!aktiv && v !== 'oppdrag') { visning = 'oppdrag'; melding('Velg et oppdrag først.'); }
  ({ oppdrag: visOppdrag, bestand: visBestand, miljo: visMiljo, avvik: visAvvik, ferdig: visFerdig })[visning]();
}
for (const k of document.querySelectorAll('.bunn [data-vis]')) k.onclick = () => (visning === k.dataset.vis && !$('#ark').hidden ? lukkArk() : settVisning(k.dataset.vis));
$('#oppdragVelger').onclick = () => { aktivTilListe(); };
async function aktivTilListe() { settVisning('oppdrag'); visListe(); }
function oppdaterTopp() {
  $('#oppdragNavn').textContent = aktiv ? `${O().nr} · ${typeFor(O().type).kort} · ${aktiv.d.eiendom || S().eiendom?.navn || ''}` : 'Mine oppdrag';
  $('#avvikBtn').hidden = !aktiv || !kanEndre(); synkStripe();
}
$('#avvikBtn').onclick = () => { nyttAvvik = nyAvvikUtkast(); settVisning('avvik'); };
const statusPille = (st) => `<span class="ent-status" style="--f:${FO.STATUS[st]?.farge || '#888'}">${esc(FO.STATUS[st]?.navn || st)}</span>`;

async function visListe() {
  aapneArk('<h2>Mine oppdrag</h2><p class="hint">Henter …</p>', { hoy: true }); await hentListe();
  const aktive = liste.filter((x) => !['godkjent', 'trukket'].includes(x.status)); const ferdige = liste.filter((x) => x.status === 'godkjent');
  const rad = (x) => `<button type="button" class="rad ent-rad" data-apne="${esc(x.id)}"><div><div class="tittel">${esc(x.nr)} · ${esc(typeFor(x.type).kort)}</div><div class="under">${esc(x.eiendom)} · skogeier ${esc(x.eierNavn)}</div><div class="under">${esc(x.tittel)}</div></div>${statusPille(x.status)}</button>`;
  aapneArk(`<h2>Mine oppdrag</h2>
    <p class="hint">Oppdrag som skogeiere har sendt deg i SkogIQ.ai. Skogeieren tildeler og miljøsjekker oppdraget på web – her gjennomfører du det. Alt lagres på telefonen og sendes når du har nett.</p>
    <h3>Aktive (${aktive.length})</h3><div class="liste">${aktive.map(rad).join('') || '<div class="tom">Ingen oppdrag ennå. Skogeiere du er koblet til i Nettverk, kan sende deg oppdrag.</div>'}</div>
    ${ferdige.length ? `<h3>Godkjent av skogeier</h3><div class="liste">${ferdige.map(rad).join('')}</div>` : ''}
    <p class="hint ent-bunntekst">${esc(innloggetBruker()?.navn || '')} · SkogIQ Entreprenør ${VERSJON} · <a href="./">Fullversjonen</a> · <a href="./#nettverk">Nettverk og chat</a></p>`, { hoy: true });
}
function visOppdrag() {
  if (!aktiv) { visListe(); return; }
  const o = O(); const ot = typeFor(o.type); const f = FO.framdrift(S(), o, aktiv.rapport); const mp = FO.miljoPunkter(o, aktiv.rapport);
  const felt = ot.felt.filter((x) => o.felt?.[x.id] !== undefined && o.felt[x.id] !== '').map((x) => `<div><dt>${esc(x.navn)}</dt><dd>${esc(o.felt[x.id])}${x.enhet ? ` ${esc(x.enhet)}` : ''}</dd></div>`).join('');
  aapneArk(`<div class="ent-topp"><h2>${esc(o.nr)} · ${esc(ot.navn)}</h2>${statusPille(aktiv.d.status)}</div>
    <p class="hint">${esc(aktiv.d.eiendom)} · skogeier <b>${esc(aktiv.d.eierNavn)}</b>${o.periode?.fra || o.periode?.til ? ` · ${esc(datoNb(o.periode.fra))} – ${esc(datoNb(o.periode.til))}` : ''}</p>
    <div class="ent-framdrift"><div class="ent-bar"><i style="width:${Math.round(f.andel * 100)}%"></i></div><span><b>${f.ferdig} av ${f.totalt}</b> bestand ferdig · ${fmt(f.areal, 1)} av ${fmt(f.planAreal, 1)} daa${FO.MENGDE[o.type] && f.mengde ? ` · ${fmt(f.mengde)} ${FO.MENGDE[o.type].enhet}` : ''}</span></div>
    ${o.merknad ? `<h3>Instruks fra skogeieren</h3><p class="ent-instruks">${esc(o.merknad).replace(/\n/g, '<br>')}</p>` : ''}
    ${felt ? `<h3>Oppdraget</h3><dl class="ent-dl">${felt}</dl>` : ''}
    <h3>Miljøsjekk</h3><p class="hint">Skogeieren har bekreftet ${mp.filter((p) => p.web).length} av ${mp.length} punkter på web. Du har sjekket ${mp.filter((p) => p.felt).length} i felt.</p>
    ${aktiv.rapport.avvik.length ? `<p class="hint">⚠️ ${aktiv.rapport.avvik.length} avvik registrert.</p>` : ''}
    ${aktiv.d.status === 'trukket' ? '<p class="ent-varsel">Skogeieren har trukket tilbake oppdraget.</p>' : ''}
    <div class="knapper"><button type="button" class="knapp primar" data-gaa="bestand">Framdrift</button><button type="button" class="knapp" data-gaa="miljo">Miljøsjekk</button></div>
    <div class="knapper"><button type="button" class="knapp liten" data-gaa="liste">Bytt oppdrag</button><button type="button" class="knapp liten" data-gaa="offline">Last ned kart for offline</button><button type="button" class="knapp liten" data-gaa="synk">Synkroniser nå</button></div>
    <p class="hint">Bestandene i oppdraget er farget etter framdrift i kartet: <span class="ent-prikk" style="--f:${STATUS_FARGE.ikke}"></span>ikke startet <span class="ent-prikk" style="--f:${STATUS_FARGE.pagar}"></span>pågår <span class="ent-prikk" style="--f:${STATUS_FARGE.ferdig}"></span>ferdig. Rosa skravur er miljøfigurer og nøkkelbiotoper, blått er kantsone mot vann, brun linje er driftsveg.</p>`);
}

// Framdrift per bestand.
function visBestand() {
  const o = O(); const m = FO.MENGDE[o.type]; const ls = linjer(S(), o); const kan = kanEndre();
  const kort = ({ bestand: b, tiltak: t }) => {
    const l = aktiv.rapport.linjer[t.id]; const apen = apenLinje === t.id;
    return `<div class="ent-linje ${apen ? 'apen' : ''}" data-linje="${esc(t.id)}">
      <button type="button" class="ent-linje-topp" data-lv="${esc(t.id)}"><span class="ent-prikk" style="--f:${STATUS_FARGE[l.status]}"></span><span><b>Bestand ${esc(b.nr)}</b> · ${esc(TILTAKSTYPER[t.type]?.navn || t.type)}<small>${esc(TRESLAG[b.treslag] || '')}${b.bonitet ? ` ${b.bonitet}` : ''} · ${fmt(t.arealDaa ?? b.areal, 1)} daa${b.miljo ? ' · <b class="ent-miljo">miljøfigur</b>' : ''}${b.kantsone?.daa >= 0.05 ? ' · 💧 kantsone' : ''}</small></span><span class="ent-pil">${apen ? '▾' : '▸'}</span></button>
      ${apen ? `<div class="ent-linje-skjema">
        <div class="ent-seg" role="group" aria-label="Status">${[['ikke', 'Ikke startet'], ['pagar', 'Pågår'], ['ferdig', 'Ferdig']].map(([k, n]) => `<button type="button" data-st="${k}" class="${l.status === k ? 'aktiv' : ''}" ${kan ? '' : 'disabled'}>${n}</button>`).join('')}</div>
        <div class="ent-felt2"><label>Startet<input type="date" data-l="start" value="${esc(l.start)}" ${kan ? '' : 'disabled'}></label><label>Ferdig<input type="date" data-l="ferdig" value="${esc(l.ferdig)}" ${kan ? '' : 'disabled'}></label></div>
        <div class="ent-felt2"><label>Utført areal (daa)<input type="number" inputmode="decimal" step="0.1" min="0" data-l="areal" value="${l.areal ?? ''}" placeholder="${fmt(t.arealDaa ?? b.areal, 1)}" ${kan ? '' : 'disabled'}></label>${m ? `<label>${esc(m.navn)} (${esc(m.enhet)})<input type="number" inputmode="decimal" step="any" min="0" data-l="mengde" value="${l.mengde ?? ''}" ${kan ? '' : 'disabled'}></label>` : ''}</div>
        <label class="ent-full">Merknad<textarea data-l="merknad" rows="2" ${kan ? '' : 'disabled'}>${esc(l.merknad)}</textarea></label>
        <div class="knapper"><button type="button" class="knapp liten" data-vis-bestand="${esc(t.id)}">Vis i kartet</button>${kan ? `<button type="button" class="knapp liten" data-avvik-bestand="${esc(b.id)}">+ Avvik her</button>` : ''}</div>
      </div>` : ''}</div>`;
  };
  const f = FO.framdrift(S(), o, aktiv.rapport);
  aapneArk(`<h2>Framdrift</h2><p class="hint">${f.ferdig} av ${f.totalt} bestand ferdig. Trykk på et bestand (også i kartet) for å registrere status, datoer, areal${m ? ` og ${m.navn.toLowerCase()}` : ''}.</p>
    <div class="ent-linjer">${ls.map(kort).join('')}</div>`, { hoy: true });
  if (apenLinje) setTimeout(() => $(`[data-linje="${CSS.escape(apenLinje)}"]`)?.scrollIntoView({ block: 'nearest' }), 30);
}
function settStatus(tid, st) {
  const l = aktiv.rapport.linjer[tid]; l.status = st;
  if (st !== 'ikke' && !l.start) l.start = idag();
  if (st === 'ferdig' && !l.ferdig) l.ferdig = idag();
  if (st === 'ferdig' && l.areal == null) { const x = linjer(S(), O()).find((y) => y.tiltak.id === tid); l.areal = x ? Math.round((x.tiltak.arealDaa ?? x.bestand.areal ?? 0) * 10) / 10 : null; }
  if (st !== 'ferdig') l.ferdig = '';
  endret(); tegnKart(); visBestand();
}

// Miljøsjekk i felt: punktene skogeieren har sjekket på web, bekreftet eller merket avvik av entreprenøren.
function visMiljo() {
  const o = O(); const mp = FO.miljoPunkter(o, aktiv.rapport); const kan = kanEndre();
  aapneArk(`<h2>Miljøsjekk i felt</h2>
    <p class="hint">Gå gjennom punktene før og under arbeidet. ✓ web = skogeieren har bekreftet punktet da oppdraget ble tildelt. Merk avvik med en kort forklaring – eller registrer avviket med bilde og posisjon.</p>
    <div class="ent-miljo-liste">${mp.map((p) => `<div class="ent-mp">
      <div class="ent-mp-tekst">${esc(p.tekst)}${p.pefc ? ` <small>PEFC ${p.pefc}</small>` : ''}${p.web ? ' <small class="ent-web">✓ web</small>' : ' <small class="ent-ikke-web">ikke bekreftet på web</small>'}</div>
      <div class="ent-seg liten" role="group">${[['ok', 'OK'], ['avvik', 'Avvik'], ['ikke-aktuelt', 'Ikke aktuelt']].map(([k, n]) => `<button type="button" data-mp="${esc(p.id)}" data-svar="${k}" class="${p.felt?.svar === k ? 'aktiv' : ''} ${k}" ${kan ? '' : 'disabled'}>${n}</button>`).join('')}</div>
      ${p.felt?.svar === 'avvik' ? `<textarea data-mp-merknad="${esc(p.id)}" rows="2" placeholder="Hva er avviket, og hva er gjort?" ${kan ? '' : 'disabled'}>${esc(p.felt.merknad || '')}</textarea>` : ''}
    </div>`).join('')}</div>
    ${kan ? '<div class="knapper"><button type="button" class="knapp" data-gaa="nytt-avvik">+ Registrer avvik med bilde</button></div>' : ''}`, { hoy: true });
}

// Avvik med type, beskrivelse, bestand, posisjon og bilder.
function nyAvvikUtkast(bestandId = '') {
  const pos = gpsPos ? [gpsPos.lng, gpsPos.lat] : null;
  const b = bestandId || (pos ? (S().bestand || []).find((x) => x.geometri && punktIGeometri(pos, x.geometri))?.id : '') || '';
  return { id: `a${Date.now().toString(36)}`, type: '', beskrivelse: '', tid: new Date().toISOString().slice(0, 16), pos, bestandId: b, utbedret: false, bilder: [], ny: true };
}
function visAvvik() {
  const kan = kanEndre();
  if (nyttAvvik) {
    const a = nyttAvvik; const bestand = (S().bestand || []).slice().sort((x, y) => String(x.nr).localeCompare(String(y.nr), 'nb', { numeric: true }));
    aapneArk(`<h2>${a.ny ? 'Nytt avvik' : 'Avvik'}</h2>
      <label class="ent-full">Hva slags avvik<select data-a="type" ${kan ? '' : 'disabled'}><option value="">Velg …</option>${Object.entries(FO.AVVIK).map(([k, x]) => `<option value="${k}" ${a.type === k ? 'selected' : ''}>${x.ikon} ${esc(x.navn)}</option>`).join('')}</select></label>
      <label class="ent-full">Beskrivelse<textarea data-a="beskrivelse" rows="3" placeholder="Hva skjedde, hvor stort, og hva er gjort?" ${kan ? '' : 'disabled'}>${esc(a.beskrivelse)}</textarea></label>
      <div class="ent-felt2"><label>Bestand<select data-a="bestandId" ${kan ? '' : 'disabled'}><option value="">–</option>${bestand.map((b) => `<option value="${esc(b.id)}" ${a.bestandId === b.id ? 'selected' : ''}>${esc(b.nr)}</option>`).join('')}</select></label><label>Tidspunkt<input type="datetime-local" data-a="tid" value="${esc(a.tid)}" ${kan ? '' : 'disabled'}></label></div>
      <div class="ent-pos">📍 ${a.pos ? `${a.pos[1].toFixed(5)}, ${a.pos[0].toFixed(5)}` : 'Ingen posisjon'} ${kan ? `<button type="button" class="knapp liten" data-a-pos="gps">Min posisjon</button><button type="button" class="knapp liten" data-a-pos="kart">Velg i kartet</button>` : ''}</div>
      <div class="ent-bilder">${a.bilder.map((src, i) => `<span class="ent-bilde"><img src="${src}" alt="Bilde ${i + 1}">${kan ? `<button type="button" data-a-fjern="${i}" aria-label="Fjern bilde">✕</button>` : ''}</span>`).join('')}${kan && a.bilder.length < 6 ? '<label class="ent-bilde ny">📷<span>Bilde</span><input type="file" accept="image/*" capture="environment" multiple data-a-bilde hidden></label>' : ''}</div>
      <label class="bryter"><input type="checkbox" data-a="utbedret" ${a.utbedret ? 'checked' : ''} ${kan ? '' : 'disabled'}> Utbedret</label>
      <div class="knapper">${kan ? '<button type="button" class="knapp primar" data-a-lagre>Lagre avviket</button>' : ''}<button type="button" class="knapp" data-a-avbryt>${kan ? 'Avbryt' : 'Tilbake'}</button>${kan && !a.ny ? '<button type="button" class="knapp fare" data-a-slett>Slett</button>' : ''}</div>`, { hoy: true });
    return;
  }
  const av = aktiv.rapport.avvik;
  aapneArk(`<h2>Avvik</h2><p class="hint">Kjøreskader, miljøfigurer, kulturminner, kantsoner, søl og annet – med bilde og posisjon. Skogeieren får dem i rapporten. Avvikene vises som merker i kartet.</p>
    ${kan ? '<div class="knapper"><button type="button" class="knapp primar" data-gaa="nytt-avvik">+ Nytt avvik</button></div>' : ''}
    <div class="liste">${av.map((a) => `<button type="button" class="rad" data-avvik="${esc(a.id)}">${a.bilder?.[0] ? `<img src="${a.bilder[0]}" alt="">` : `<span class="ent-avvik-ikon">${FO.AVVIK[a.type]?.ikon || '⚠️'}</span>`}<div><div class="tittel">${esc(FO.AVVIK[a.type]?.navn || 'Avvik')}${a.utbedret ? ' · utbedret' : ''}</div><div class="under">${esc(a.beskrivelse || 'Mangler beskrivelse')}</div><div class="under">${esc(a.tid.replace('T', ' '))}${a.bestandId ? ` · bestand ${esc(S().bestand.find((b) => b.id === a.bestandId)?.nr || '')}` : ''}</div></div></button>`).join('') || '<div class="tom">Ingen avvik registrert.</div>'}</div>`, { hoy: true });
}
function skalerBilde(fil, maks = 1280) {
  return new Promise((ok, feil) => { const img = new Image(); img.onload = () => { const f = Math.min(1, maks / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * f); c.height = Math.round(img.height * f); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); ok(c.toDataURL('image/jpeg', 0.72)); }; img.onerror = feil; img.src = URL.createObjectURL(fil); });
}

// Sluttrapport med signatur.
let signatur = null;
function visFerdig() {
  const o = O(); const r = aktiv.rapport; const f = FO.framdrift(S(), o, r); const mang = FO.mangler(S(), o, r); const m = FO.MENGDE[o.type];
  if (r.slutt) {
    aapneArk(`<h2>Sluttrapport</h2>${statusPille(aktiv.d.status)}
      <p>Ferdigmeldt ${esc(datoNb(r.slutt.dato))} av <b>${esc(r.slutt.navn)}</b>.</p>${r.slutt.merknad ? `<p class="ent-instruks">${esc(r.slutt.merknad)}</p>` : ''}
      <img class="ent-signatur-bilde" src="${r.slutt.signatur}" alt="Signatur">
      <p class="hint">${aktiv.d.status === 'godkjent' ? 'Skogeieren har godkjent rapporten og tatt den inn i planen.' : aktiv.ulagret ? 'Sendes når du har nett.' : 'Sendt til skogeieren. Hen tar rapporten inn i planen og godkjenner den. Åpner skogeieren oppdraget igjen, kan du rette og ferdigmelde på nytt.'}</p>`, { hoy: true });
    return;
  }
  aapneArk(`<h2>Ferdigmelding</h2>
    <dl class="ent-dl"><div><dt>Bestand ferdig</dt><dd>${f.ferdig} av ${f.totalt}</dd></div><div><dt>Areal</dt><dd>${fmt(f.areal, 1)} daa</dd></div>${m ? `<div><dt>${esc(m.navn)}</dt><dd>${fmt(f.mengde)} ${esc(m.enhet)}</dd></div>` : ''}<div><dt>Avvik</dt><dd>${r.avvik.length}${r.avvik.length ? ` (${r.avvik.filter((a) => a.utbedret).length} utbedret)` : ''}</dd></div></dl>
    ${mang.length ? `<div class="ent-mangler"><b>Før du kan ferdigmelde:</b><ul>${mang.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '<p class="ent-klar">✓ Alt er registrert.</p>'}
    <label class="ent-full">Timer brukt (valgfritt)<input type="number" inputmode="decimal" min="0" step="0.5" data-slutt="timer" value="${r.timer ?? ''}"></label>
    <label class="ent-full">Merknad til skogeieren<textarea data-slutt="merknad" rows="3" placeholder="F.eks. velteplass, gjenstående arbeid, avtaler">${esc(r.sluttUtkast?.merknad || '')}</textarea></label>
    <label class="ent-full">Navn<input data-slutt="navn" value="${esc(r.sluttUtkast?.navn || innloggetBruker()?.navn || '')}" autocomplete="name"></label>
    <div class="ent-signatur"><canvas id="signatur" width="600" height="200" aria-label="Signer her"></canvas><button type="button" class="knapp liten" data-sig-tom>Tøm</button><span class="hint">Signer med fingeren</span></div>
    <div class="knapper"><button type="button" class="knapp primar" data-ferdigmeld ${mang.length ? 'disabled' : ''}>Ferdigmeld og send til skogeieren</button></div>
    <p class="hint">Rapporten med framdrift, miljøsjekk, avvik og signatur går til skogeieren i SkogIQ.ai – ingen skjema å fylle ut.</p>`, { hoy: true });
  oppsettSignatur();
}
function oppsettSignatur() {
  const c = $('#signatur'); if (!c) return; const g = c.getContext('2d'); g.lineWidth = 3; g.lineCap = 'round'; g.strokeStyle = '#10241c'; signatur = { tegnet: false };
  let ned = false; const pkt = (e) => { const r = c.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height]; };
  c.addEventListener('pointerdown', (e) => { ned = true; c.setPointerCapture(e.pointerId); const [x, y] = pkt(e); g.beginPath(); g.moveTo(x, y); });
  c.addEventListener('pointermove', (e) => { if (!ned) return; const [x, y] = pkt(e); g.lineTo(x, y); g.stroke(); signatur.tegnet = true; });
  c.addEventListener('pointerup', () => { ned = false; });
}

// Offline: kartflisene for området lagres i nettleserens cache.
async function lastNedKart() {
  if (!('caches' in window)) { melding('Nettleseren støtter ikke lagring av kart.'); return; }
  const gl = L.featureGroup([...lagPerLinje.values()]); const bb = (gl.getLayers().length ? gl : planLag).getBounds(); if (!bb.isValid()) return;
  const urler = flisUrler([bb.getWest(), bb.getSouth(), bb.getEast(), bb.getNorth()], { maksZ: 17 }).slice(0, 2500);
  const c = await caches.open(FLIS_CACHE); let n = 0;
  melding(`Laster ned ${urler.length} kartfliser …`, 60000);
  for (let i = 0; i < urler.length; i += 8) await Promise.all(urler.slice(i, i + 8).map(async (u) => { try { if (!(await c.match(u))) { const r = await fetch(u, { mode: 'cors' }); if (r.ok) await c.put(u, r); } n++; } catch { /* hopp over */ } }));
  melding(`✓ Kartet for oppdraget er lagret på telefonen (${n} fliser).`);
}

// ---------- hendelser ----------
$('#arkInnhold').addEventListener('click', async (e) => {
  const t = e.target;
  const ap = t.closest('[data-apne]'); if (ap) { await apneOppdrag(ap.dataset.apne); return; }
  const g = t.closest('[data-gaa]')?.dataset.gaa;
  if (g === 'liste') { visListe(); return; } if (g === 'synk') { aktiv.ulagret = true; synk(); return; } if (g === 'offline') { lastNedKart(); return; }
  if (g === 'nytt-avvik') { nyttAvvik = nyAvvikUtkast(); settVisning('avvik'); return; }
  if (g) { settVisning(g); return; }
  const lv = t.closest('[data-lv]'); if (lv) { apenLinje = apenLinje === lv.dataset.lv ? null : lv.dataset.lv; visBestand(); if (apenLinje) { const lag = lagPerLinje.get(apenLinje); if (lag) kart.fitBounds(lag.getBounds(), { maxZoom: 17, paddingBottomRight: [0, Math.round(innerHeight * 0.55)] }); } return; }
  const st = t.closest('[data-st]'); if (st && !st.disabled) { settStatus(st.closest('[data-linje]').dataset.linje, st.dataset.st); return; }
  const vb = t.closest('[data-vis-bestand]'); if (vb) { const lag = lagPerLinje.get(vb.dataset.visBestand); if (lag) { lukkArk(); kart.fitBounds(lag.getBounds(), { maxZoom: 17 }); } return; }
  const ab = t.closest('[data-avvik-bestand]'); if (ab) { nyttAvvik = nyAvvikUtkast(ab.dataset.avvikBestand); settVisning('avvik'); return; }
  const mp = t.closest('[data-mp]'); if (mp && !mp.disabled) { aktiv.rapport.miljo[mp.dataset.mp] = { ...(aktiv.rapport.miljo[mp.dataset.mp] || {}), svar: mp.dataset.svar, tid: new Date().toISOString().slice(0, 16) }; endret(); visMiljo(); return; }
  const av = t.closest('[data-avvik]'); if (av) { const a = aktiv.rapport.avvik.find((x) => x.id === av.dataset.avvik); if (a) { nyttAvvik = { ...a, bilder: [...(a.bilder || [])] }; visAvvik(); } return; }
  if (t.closest('[data-a-avbryt]')) { nyttAvvik = null; visAvvik(); return; }
  if (t.closest('[data-a-slett]') && confirm('Slette avviket?')) { aktiv.rapport.avvik = aktiv.rapport.avvik.filter((x) => x.id !== nyttAvvik.id); nyttAvvik = null; endret(); tegnAvvik(); visAvvik(); return; }
  const fj = t.closest('[data-a-fjern]'); if (fj) { nyttAvvik.bilder.splice(Number(fj.dataset.aFjern), 1); visAvvik(); return; }
  const ps = t.closest('[data-a-pos]')?.dataset.aPos;
  if (ps === 'gps') { if (!gpsPos) { startGps(); melding('Venter på GPS-posisjon – prøv igjen om et øyeblikk.'); return; } nyttAvvik.pos = [gpsPos.lng, gpsPos.lat]; const b = S().bestand.find((x) => x.geometri && punktIGeometri(nyttAvvik.pos, x.geometri)); if (b) nyttAvvik.bestandId = b.id; visAvvik(); return; }
  if (ps === 'kart') {
    lesAvvikSkjema(); $('#ark').hidden = true; document.body.classList.add('velger-punkt'); melding('Trykk i kartet der avviket er.', 6000);
    velgPunkt = (ll) => { velgPunkt = null; document.body.classList.remove('velger-punkt'); nyttAvvik.pos = [ll.lng, ll.lat]; const b = S().bestand.find((x) => x.geometri && punktIGeometri(nyttAvvik.pos, x.geometri)); if (b) nyttAvvik.bestandId = b.id; $('#ark').hidden = false; visAvvik(); };
    return;
  }
  if (t.closest('[data-a-lagre]')) {
    lesAvvikSkjema(); const a = nyttAvvik;
    if (!a.type) { melding('Velg hva slags avvik det er.'); return; }
    if (!a.beskrivelse) { melding('Skriv en kort beskrivelse.'); return; }
    const { ny, ...lagret } = a; const i = aktiv.rapport.avvik.findIndex((x) => x.id === a.id);
    if (i >= 0) aktiv.rapport.avvik[i] = lagret; else aktiv.rapport.avvik.push(lagret);
    nyttAvvik = null; endret(); tegnAvvik(); visAvvik(); melding('Avviket er lagret.'); return;
  }
  if (t.closest('[data-sig-tom]')) { const c = $('#signatur'); c.getContext('2d').clearRect(0, 0, c.width, c.height); signatur.tegnet = false; return; }
  if (t.closest('[data-ferdigmeld]')) {
    const navn = $('[data-slutt="navn"]').value.trim(); const merknad = $('[data-slutt="merknad"]').value.trim();
    if (!navn) { melding('Skriv navnet ditt.'); return; } if (!signatur?.tegnet) { melding('Signer i feltet.'); return; }
    if (!confirm('Ferdigmelde oppdraget og sende rapporten til skogeieren?')) return;
    const timer = $('[data-slutt="timer"]').value; aktiv.rapport.timer = timer === '' ? null : Number(timer);
    const { sluttUtkast, ...r } = aktiv.rapport;
    aktiv.rapport = FO.ferdigmeld(r, { navn, merknad, signatur: $('#signatur').toDataURL('image/png') });
    aktiv.d.status = 'ferdigmeldt'; endret(); oppdaterTopp(); visFerdig(); melding(navigator.onLine ? 'Oppdraget er ferdigmeldt og sendes til skogeieren.' : 'Ferdigmeldt – sendes når du har nett.');
  }
});
function lesAvvikSkjema() { const r = $('#arkInnhold'); for (const el of r.querySelectorAll('[data-a]')) nyttAvvik[el.dataset.a] = el.type === 'checkbox' ? el.checked : el.value.trim(); }
$('#arkInnhold').addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.l) { const l = aktiv.rapport.linjer[t.closest('[data-linje]').dataset.linje]; l[t.dataset.l] = ['areal', 'mengde'].includes(t.dataset.l) ? (t.value === '' ? null : Number(t.value)) : t.value; endret(); return; }
  if (t.dataset.mpMerknad) { aktiv.rapport.miljo[t.dataset.mpMerknad].merknad = t.value.trim(); endret(); return; }
  if (t.dataset.slutt && t.dataset.slutt !== 'timer') { aktiv.rapport.sluttUtkast = { ...(aktiv.rapport.sluttUtkast || {}), [t.dataset.slutt]: t.value }; return; }
  if (t.matches('[data-a-bilde]')) { lesAvvikSkjema(); for (const f of [...t.files].slice(0, 6 - nyttAvvik.bilder.length)) { try { nyttAvvik.bilder.push(await skalerBilde(f)); } catch { melding('Klarte ikke å lese bildet.'); } } visAvvik(); }
});

// ---------- start ----------
window.addEventListener('online', () => { nettStatus(); synk(); }); window.addEventListener('offline', () => { nettStatus(); synkStripe(); });
nettStatus();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
(async () => {
  const sist = await hentVerdi('entreprenor:sist');
  if (sist) { const lokal = await hentVerdi(nokkel(sist)); if (lokal && !['godkjent', 'trukket'].includes(lokal.d.status)) { aktiv = lokal; aktiv.rapport = FO.sikreRapport(S(), O(), aktiv.rapport); tegnKart(true); oppdaterTopp(); visOppdrag(); if (navigator.onLine) apneOppdrag(sist); return; } }
  visListe();
})();
