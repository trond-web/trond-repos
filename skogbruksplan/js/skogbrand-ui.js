// Fanen «Skogbrand»: risiko nå (skogbrann, farevarsler, vind, granbarkbille), forebygging (risiko per bestand,
// tiltak, beredskap og forsikring) og skaderegistrering med kart, bilder, oppfølging og skademelding.
import { TRESLAG, TILTAKSTYPER } from './model.js';
import {
  SKADETYPER, SKADESTATUS, SKOGBRAND, retningslinjerFor, iBrannsesong, risikoPerBestand,
  forebyggendeTiltak, nySkade, beregnSkade, forsikringsvurdering, oppgaverFor, brannkostnader, skademeldingTekst,
  tomSkogbrand, RISIKONIVAA,
} from './skade.js';
import { hentBrannfare, hentFarevarsler, hentVind, hentBarkbille, KARTLAG, PERIODER } from './skade-data.js';
import { fmt } from './charts.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dagNavn = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'numeric' });
const RISIKO = { storm: 'Storm', bille: 'Granbarkbille', sno: 'Snøbrekk', brann: 'Brann' };
const VARSELFARGE = { gul: '#f2c230', oransje: '#f08a24', rod: '#e0442f' };

export function initSkogbrand({ kart, hentPlan, endret, melding, nyId, settKartKlikk, visBestand, lastKlipping, skalerBilde, hentPosisjon, iAar = new Date().getFullYear() }) {
  const lag = L.layerGroup();
  const felleLag = L.layerGroup();
  const wms = {};
  let underfane = 'naa';
  let valgtSkade = null; let tegner = null; let synlig = false;
  let risikoCache = null; let risikoNokkel = '';
  let henter = false;

  // Fyller inn manglende felt på stedet, slik at referanser til objektet holder seg gyldige.
  const SB = () => {
    const S = hentPlan(); const tom = tomSkogbrand();
    if (!S.skogbrand) S.skogbrand = tom;
    for (const [k, v] of Object.entries(tom)) if (S.skogbrand[k] === undefined) S.skogbrand[k] = v;
    for (const [k, v] of Object.entries(tom.forsikring)) if (S.skogbrand.forsikring[k] === undefined) S.skogbrand.forsikring[k] = v;
    return S.skogbrand;
  };
  const lagre = (kartOgsaa = true) => { risikoCache = null; endret({ kart: false }); if (kartOgsaa) tegnKart(); tegn(); };

  // ---------- risiko (bufret til planen endres) ----------
  function risiko() {
    const S = hentPlan();
    const nokkel = `${S.planId}|${S.bestand.length}|${S.bestand.reduce((s, b) => s + (b.areal || 0) + (b.tiltak?.length || 0) * 0.001, 0)}|${(S.skogbrand?.skader || []).length}|${S.skogbrand?.data?.bille?.sone?.nivaa || ''}`;
    if (!risikoCache || nokkel !== risikoNokkel) {
      risikoCache = risikoPerBestand(S, { iAar, billesone: S.skogbrand?.data?.bille?.sone || null });
      risikoNokkel = nokkel;
    }
    return risikoCache;
  }

  // ---------- data ----------
  function senterForEiendom() {
    const S = hentPlan();
    const g = S.eiendom?.grense || S.bestand.find((b) => b.geometri)?.geometri;
    if (!g) return null;
    const pts = (g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : []).flat();
    if (!pts.length) return null;
    const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  }
  async function hentData(tving = false) {
    const sb = SB(); const c = senterForEiendom();
    if (!c || henter) return;
    const gammel = !sb.data?.hentet || Date.now() - new Date(sb.data.hentet).getTime() > 3 * 3600 * 1000;
    if (!tving && !gammel) return;
    henter = true; tegn();
    const [lon, lat] = c;
    const [brann, varsler, vind, bille] = await Promise.allSettled([hentBrannfare(lon, lat), hentFarevarsler(lon, lat), hentVind(lon, lat), hentBarkbille(lon, lat)]);
    const v = (r) => (r.status === 'fulfilled' ? r.value : { feil: r.reason?.message || 'Feil' });
    sb.data = { brann: v(brann), varsler: varsler.status === 'fulfilled' ? varsler.value : { feil: varsler.reason?.message }, vind: v(vind), bille: v(bille), hentet: new Date().toISOString(), pos: c };
    henter = false;
    endret({ kart: false }); risikoCache = null; tegnKart(); tegn();
  }

  // ---------- kart ----------
  function tegnKart() {
    lag.clearLayers(); felleLag.clearLayers();
    const sb = SB();
    for (const s of sb.skader) {
      const t = SKADETYPER[s.type]; if (!s.geometri) continue;
      const valgt = s.id === valgtSkade;
      const l = s.geometri.type === 'Point'
        ? L.circleMarker([s.geometri.coordinates[1], s.geometri.coordinates[0]], { radius: 9, color: '#fff', weight: 2, fillColor: t.farge, fillOpacity: 1 })
        : L.geoJSON(s.geometri, { style: { color: valgt ? '#ffd400' : t.farge, weight: valgt ? 4 : 2.5, dashArray: '7 5', fillColor: t.farge, fillOpacity: 0.28 } });
      l.bindTooltip(`${t.ikon} ${esc(t.navn)} – ${esc(s.dato)} (${esc(SKADESTATUS[s.status]?.navn)})`, { sticky: true });
      l.on('click', (e) => { L.DomEvent.stopPropagation(e); if (tegner) tegner.klikk(e.latlng); else { velgSkade(s.id); } });
      l.addTo(lag);
    }
    for (const v of sb.vannkilder || []) {
      L.circleMarker([v.lat, v.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#1c7ed6', fillOpacity: 1 }).bindTooltip(`💧 ${esc(v.navn || 'Brannvann')}`).addTo(lag);
    }
    if (sb.visLag?.feller) for (const f of sb.data?.bille?.feller || []) {
      const andel = f.utbruddsnivaa ? f.sum / f.utbruddsnivaa : 0;
      L.circleMarker([f.pos[1], f.pos[0]], { radius: 8, color: '#fff', weight: 2, fillColor: andel > 0.5 ? '#e0442f' : andel > 0.25 ? '#f08a24' : '#8b5a2b', fillOpacity: 1 })
        .bindPopup(`<b>Barkbillefelle ${esc(f.navn)}</b><br>${PERIODER.map(([, n], i) => `${n}: ${f.fangst[i] ?? '–'}`).join('<br>')}<br><b>Sesong: ${fmt(f.sum)}</b>${f.utbruddsnivaa ? ` (utbruddsnivå ${fmt(f.utbruddsnivaa)})` : ''}`)
        .addTo(felleLag);
    }
    for (const [id, cfg] of Object.entries(KARTLAG)) {
      const på = !!sb.visLag?.[id];
      if (på && !wms[id]) wms[id] = L.tileLayer.wms(cfg.url, { ...cfg.params, opacity: cfg.opacity, attribution: cfg.navn }).addTo(kart);
      if (!på && wms[id]) { wms[id].remove(); delete wms[id]; }
    }
  }

  // ---------- tegning ----------
  function startTegning(type, modus) {
    stopp();
    tegner = { type, modus, pkt: [], linje: null };
    $('#sbTegnHjelp').hidden = false;
    $('#sbTegnHjelp .tekst').textContent = modus === 'punkt' ? `Klikk der skaden (${SKADETYPER[type].navn.toLowerCase()}) er.` : modus === 'vann' ? 'Klikk der brannvannkilden er.' : 'Klikk rundt skadeområdet, og trykk «Fullfør».';
    $('#sbTegnFerdig').hidden = modus !== 'flate';
    kart.getContainer().style.cursor = 'crosshair'; kart.doubleClickZoom.disable();
    tegner.klikk = (ll) => {
      if (modus === 'punkt') { lagSkade({ type: 'Point', coordinates: [ll.lng, ll.lat] }); return; }
      if (modus === 'vann') { const navn = prompt('Navn på vannkilden (f.eks. «Bekk ved bru», «Tjern»):', '') ?? ''; SB().vannkilder.push({ id: nyId('vk'), lat: ll.lat, lon: ll.lng, navn }); stopp(); lagre(); return; }
      tegner.pkt.push([ll.lng, ll.lat]);
      const lls = tegner.pkt.map(([x, y]) => [y, x]);
      if (tegner.linje) tegner.linje.setLatLngs(lls); else tegner.linje = L.polygon(lls, { color: '#ffd400', weight: 3, dashArray: '6 6' }).addTo(kart);
    };
    settKartKlikk(tegner.klikk);
  }
  function stopp() {
    if (tegner?.linje) tegner.linje.remove();
    tegner = null; $('#sbTegnHjelp').hidden = true;
    kart.getContainer().style.cursor = ''; kart.doubleClickZoom.enable(); settKartKlikk(null);
  }
  function fullfor() {
    if (!tegner) return;
    if (tegner.pkt.length < 3) { melding('Sett minst tre punkter rundt skadeområdet.'); return; }
    const c = tegner.pkt;
    lagSkade({ type: 'Polygon', coordinates: [[...c, c[0]]] });
  }
  async function lagSkade(geometri) {
    const type = tegner?.type || $('#sbNyType').value;
    stopp();
    const s = nySkade(type, geometri);
    SB().skader.unshift(s);
    await oppdaterBeregning(s);
    synkPefc(s);
    valgtSkade = s.id; underfane = 'skader';
    lagre();
    $('#sbSkadeDetalj')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    melding(`${SKADETYPER[type].navn} registrert. Fyll inn detaljer og meld skaden.`);
  }
  async function skadeVedPosisjon() {
    const pos = hentPosisjon?.();
    if (!pos) { melding('Fant ingen posisjon. Slå på GPS i Felt-fanen, eller klikk i kartet.'); startTegning($('#sbNyType').value, 'punkt'); return; }
    tegner = { type: $('#sbNyType').value };
    await lagSkade({ type: 'Point', coordinates: [pos.lon, pos.lat] });
  }

  async function oppdaterBeregning(s) {
    const klipping = await lastKlipping?.();
    const b = beregnSkade(hentPlan(), s, { klipping });
    s.berorte = b.rader.map((r) => ({ id: r.id, daa: r.daa }));
    s.beregning = { volum: b.volum, verdi: b.verdi, areal: b.areal, skadeDaa: b.skadeDaa, rader: b.rader };
    return b;
  }
  // Brann blir også en brannflate i PEFC-modulen (krav 29: areal som settes urørt).
  function synkPefc(s) {
    const S = hentPlan();
    if (s.type !== 'brann' || !s.geometri || s.geometri.type === 'Point') return;
    S.pefc = S.pefc || { objekter: [] }; S.pefc.objekter = S.pefc.objekter || [];
    const o = S.pefc.objekter.find((x) => x.skadeId === s.id);
    if (o) o.geometri = s.geometri;
    else S.pefc.objekter.push({ id: nyId('po'), type: 'brann', navn: `Brann ${s.dato}`, geometri: s.geometri, kilde: 'egen', skadeId: s.id, registrert: s.dato });
  }

  function velgSkade(id) { valgtSkade = id; underfane = 'skader'; tegnKart(); tegn(); $('#sbSkadeDetalj')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  function zoomSkade(s) {
    const g = s.geometri; if (!g) return;
    if (g.type === 'Point') kart.setView([g.coordinates[1], g.coordinates[0]], 16);
    else kart.fitBounds(L.geoJSON(g).getBounds(), { padding: [50, 50], maxZoom: 17 });
  }

  // ---------- visning: risiko nå ----------
  function naaHtml() {
    const sb = SB(); const d = sb.data;
    if (!senterForEiendom()) return '<div class="tom">Åpne en skogbruksplan med kart for å se risikoen for eiendommen.</div>';
    if (!d) return `<div class="tom">${henter ? 'Henter skogbrannfare, farevarsler, vind og barkbillevarsel …' : 'Ingen data hentet ennå.'}</div>`;
    const idag = d.brann?.dager?.[0];
    const nivaa = idag?.nivaa;
    const S = hentPlan();
    const sesong = iBrannsesong(new Date());
    const drifter = S.bestand.flatMap((b) => (b.tiltak || []).filter((t) => t.status !== 'utfort' && t.aar === iAar && ['sluttavvirkning', 'tynning', 'markberedning', 'ungskogpleie'].includes(t.type)).map((t) => ({ b, t })));
    const brann = d.brann?.feil ? `<div class="hint">Skogbrannfare: ${esc(d.brann.feil)}</div>` : `
      <div class="sb-fare" style="--farge:${nivaa?.farge || '#999'}">
        <div><div class="sb-fare-nivaa">${esc(nivaa?.navn || '–')}</div><div class="hint">Skogbrannindeks i dag: ${fmt(idag?.fwi, 1)} (FWI) · ${sesong ? 'bålforbud 15/4–15/9 gjelder' : 'utenfor bålforbudsperioden'}</div></div>
      </div>
      <div class="sb-dager">${(d.brann.dager || []).map((x) => `<div class="sb-dag" style="--farge:${x.nivaa?.farge}" title="${esc(x.nivaa?.navn)} · FWI ${fmt(x.fwi, 1)}"><span>${esc(dagNavn(x.dato))}</span><b>${fmt(x.fwi, 0)}</b></div>`).join('')}</div>
      <p class="fotnote">Fargene følger met.no og Skogbrands retningslinjer. Grensene er de europeiske FWI-klassene (EFFIS); met.no sin offisielle indeks er tilpasset norske forhold og kan avvike. Se <a href="https://skogbrannfare.met.no/" target="_blank" rel="noopener">skogbrannfare.met.no</a>.</p>`;
    const nivaaId = nivaa?.id || 'gronn';
    const retn = `<details class="sb-retn" ${['rod', 'morkerod'].includes(nivaaId) || drifter.length ? 'open' : ''}><summary><b>Skogsdrift ved dagens nivå</b> – Skogbrands retningslinjer</summary>
      <ul>${retningslinjerFor(nivaaId).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      ${drifter.length ? `<p><b>Planlagte drifter i år:</b> ${drifter.map(({ b, t }) => `${esc(TILTAKSTYPER[t.type].navn)} i <a href="#" data-sb-bestand="${b.id}">${esc(b.nr)}</a>`).join(', ')}.${nivaaId === 'morkerod' ? ' Markberedning, manuell avvirkning og ungskogpleie gjennomføres normalt ikke ved ekstra stor fare.' : ''}</p>` : ''}
      <div class="knapperad"><button type="button" class="knapp" data-sb="samrad">Lag samrådsskjema</button></div></details>`;
    const varsler = Array.isArray(d.varsler) ? d.varsler : [];
    const varselHtml = d.varsler?.feil ? `<div class="hint">Farevarsler: ${esc(d.varsler.feil)}</div>` : varsler.length ? varsler.map((v) => `<div class="sb-varsel" style="--farge:${VARSELFARGE[v.nivaa] || '#999'}"><b>${esc(v.tittel || v.navn)}</b><div class="hint">${esc(v.tekst || '')}</div>${v.rad ? `<div class="hint"><i>${esc(v.rad)}</i></div>` : ''}</div>`).join('') : '<div class="hint">Ingen farevarsler fra met.no for eiendommen nå.</div>';
    const vind = d.vind?.feil ? `<div class="hint">Vind: ${esc(d.vind.feil)}</div>` : `<div class="sb-vind">${(d.vind?.dager || []).map((x) => {
      const verdi = x.kast ?? x.vind; const sterk = (x.kast ?? 0) >= 20 || x.vind >= 15;
      return `<div class="sb-vdag${sterk ? ' sterk' : ''}" title="Middelvind ${fmt(x.vind, 1)} m/s${x.kast != null ? `, kast ${fmt(x.kast, 1)} m/s` : ''}"><span>${esc(dagNavn(x.dato))}</span><div class="sb-vsoyle" style="height:${Math.min(100, verdi * 3)}%"></div><b>${fmt(verdi, 0)}</b><small>${x.kast != null ? 'kast' : 'vind'}</small><i style="transform:rotate(${(x.retning || 0) + 180}deg)">↑</i></div>`;
    }).join('')}</div><p class="fotnote">m/s, høyeste per dag (met.no). Vindkast over ca. 20 m/s kan gi stormfelling, særlig i høy gran, langs nye kanter og på våt eller grunn mark.</p>`;
    const bille = d.bille?.feil ? `<div class="hint">Barkbiller: ${esc(d.bille.feil)}</div>` : `
      ${d.bille?.sone ? `<div class="sb-varsel" style="--farge:${{ lav: '#2e9e4f', middels: '#f2c230', hoy: '#e0442f' }[d.bille.sone.nivaa]}"><b>Barkbillevarsel: ${esc(d.bille.sone.varsel)}</b> <span class="hint">(${esc(d.bille.sone.dato)}, usikkerhet ${esc(d.bille.sone.usikkerhet || '–').toLowerCase()})</span><details><summary class="hint">Les varselet</summary><div class="hint" style="white-space:pre-line">${esc(d.bille.sone.beskrivelse)}</div></details></div>` : '<div class="hint">Fant ikke barkbillevarsel for området.</div>'}
      ${d.bille?.feller?.length ? `<div class="tabell-wrap"><table class="tabell"><thead><tr><th>Felle</th><th class="tall">km</th>${PERIODER.map(([, n]) => `<th class="tall">${n.replace('uke ', 'u')}</th>`).join('')}<th class="tall">Sesong</th><th class="tall">Av utbrudd</th></tr></thead><tbody>
        ${d.bille.feller.map((f) => `<tr><td>${esc(f.navn)}</td><td class="tall">${fmt(f.km, 1)}</td>${f.fangst.map((x) => `<td class="tall">${x == null ? '–' : fmt(x)}</td>`).join('')}<td class="tall"><b>${fmt(f.sum)}</b></td><td class="tall">${f.utbruddsnivaa ? `${fmt((f.sum / f.utbruddsnivaa) * 100)} %` : '–'}</td></tr>`).join('')}</tbody></table></div>
        <p class="fotnote">Fangst av stor granbarkbille per felle i år (NIBIO, barkbilleovervåkingen). Historisk utbruddsnivå er ${fmt(d.bille.feller[0].utbruddsnivaa)} biller per felle i sesongen.</p>` : ''}`;
    return `
      <div class="knapperad sb-oppdater"><button type="button" class="knapp liten" data-sb="hent">${henter ? 'Henter …' : 'Oppdater'}</button><span class="hint">Hentet ${new Date(d.hentet).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
      <section class="kort"><h3>Skogbrannfare</h3>${brann}${retn}</section>
      <section class="kort"><h3>Farevarsler</h3>${varselHtml}</section>
      <section class="kort"><h3>Vind – stormfare</h3>${vind}</section>
      <section class="kort"><h3>Granbarkbille</h3>${bille}</section>
      <section class="kort"><h3>Kartlag</h3><div class="sb-lag">
        ${Object.entries(KARTLAG).map(([id, c]) => `<label><input type="checkbox" data-sb-lag="${id}" ${sb.visLag?.[id] ? 'checked' : ''}> ${esc(c.navn)}</label>`).join('')}
        <label><input type="checkbox" data-sb-lag="feller" ${sb.visLag?.feller ? 'checked' : ''}> Barkbillefeller med fangst</label></div>
        ${sb.visLag?.fwi ? `<div class="sb-skala">${[0, 8, 16, 24, 32].map((v, i) => `<span style="background:${['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'][i]}">${v}${i === 4 ? '+' : ''}</span>`).join('')}<span class="hint">FWI</span></div>` : ''}</section>`;
  }

  // ---------- visning: forebygging ----------
  const chip = (r) => `<span class="sb-chip" style="--farge:${r.nivaa.farge}" title="${esc(r.grunner.join('; '))}">${r.p}</span>`;
  function forebyggingHtml() {
    const S = hentPlan(); const sb = SB();
    if (!S.bestand.length) return '<div class="tom">Ingen bestand ennå.</div>';
    const r = risiko();
    const teller = Object.fromEntries(Object.keys(RISIKO).map((k) => [k, { hoy: 0, middels: 0, daa: 0 }]));
    for (const b of S.bestand) { const x = r.get(b.id); if (!x) continue; for (const k of Object.keys(RISIKO)) { if (x[k].nivaa.id === 'hoy') { teller[k].hoy++; teller[k].daa += b.areal || 0; } else if (x[k].nivaa.id === 'middels') teller[k].middels++; } }
    const rader = [...S.bestand].map((b) => ({ b, x: r.get(b.id) })).filter((o) => o.x).sort((a, c) => Math.max(c.x.storm.p, c.x.bille.p, c.x.sno.p, c.x.brann.p) - Math.max(a.x.storm.p, a.x.bille.p, a.x.sno.p, a.x.brann.p)).slice(0, 25);
    const tiltak = forebyggendeTiltak(S, r, { iAar });
    const ber = sb.beredskap || {};
    const f = sb.forsikring;
    const sjekk = (k, tekst) => `<label class="sb-sjekk"><input type="checkbox" data-sb-ber="${k}" ${ber[k] ? 'checked' : ''}> ${tekst}</label>`;
    return `
      <section class="kort"><h3>Risiko per bestand</h3>
        <div class="sb-risikokort">${Object.entries(RISIKO).map(([k, n]) => `<button type="button" class="sb-risiko" data-sb-farge="${k}"><b>${n}</b><span><i style="--farge:${RISIKONIVAA[2].farge}"></i>${teller[k].hoy} høy <i style="--farge:${RISIKONIVAA[1].farge}"></i>${teller[k].middels} middels</span><small>${fmt(teller[k].daa)} daa høy risiko · vis i kart</small></button>`).join('')}</div>
        <div class="tabell-wrap"><table class="tabell"><thead><tr><th>Bestand</th><th>Treslag</th><th class="tall">Høyde</th><th>Storm</th><th>Bille</th><th>Snø</th><th>Brann</th></tr></thead><tbody>
          ${rader.map(({ b, x }) => `<tr data-sb-bestand="${b.id}"><td>${esc(b.nr)}</td><td>${esc(TRESLAG[b.treslag] || '')}</td><td class="tall">${fmt(x.h, 0)}${x.anslag ? '*' : ''}</td><td>${chip(x.storm)}</td><td>${chip(x.bille)}</td><td>${chip(x.sno)}</td><td>${chip(x.brann)}</td></tr>`).join('')}</tbody></table></div>
        <p class="fotnote">Poeng 0–100 ut fra treslag, høyde, tetthet, tynning, nye hogstkanter mot fremherskende vind (sørvest), registrerte skader i nærheten og barkbillevarsel. Hold over tallet for begrunnelse. * Høyde anslått fra alder og bonitet. Råd fra Skogbrand: ungskogpleie ved ca. 4 m til 100–140 trær/daa, tynning før 14 m (maks 40 % uttak, 80–100 trær/daa igjen), prioriter hogst av utsatte bestand og hold kantene korte.</p>
      </section>
      <section class="kort"><h3>Forebyggende tiltak</h3>
        ${tiltak.length ? tiltak.slice(0, 20).map((t, i) => `<div class="sb-tiltak"><span class="prio prio-${t.prioritet}">P${t.prioritet}</span><div><b>${esc(t.tittel)}</b><div class="hint">${esc(t.tekst)}</div></div>${t.type ? `<button type="button" class="knapp liten" data-sb-tiltak="${i}">Legg til</button>` : `<button type="button" class="knapp liten" data-sb-bestand="${t.b.id}">Vis</button>`}</div>`).join('') : '<div class="tom">Ingen forebyggende tiltak foreslått.</div>'}
      </section>
      <section class="kort"><h3>Beredskap i brannsesongen</h3>
        <div class="sb-sjekker">
          ${sjekk('pakke', 'Beredskapspakke på hver skogsmaskin: skogbrannstryker, 25 L vanndunk, spredekanne, spade/hakke')}
          ${sjekk('manuell', 'Slokkeutstyr ved manuell hogst og skjøtsel (stryker, 25 L vann, spredekanne)')}
          ${sjekk('kurs', 'Entreprenør/maskinfører har skogbrannkurs fra de siste 3 årene')}
          ${sjekk('plakat', 'Varslingsplakater om bålforbud ved innfartsveier og parkeringer')}
          ${sjekk('brannvesen', 'Kontakt med lokalt brannvesen om adkomst og vann')}
          ${sjekk('kart', 'Kart med adkomst og bommer er tilgjengelig for brannvesenet')}
        </div>
        <div class="skjema to-kol">
          <label>Kontaktperson ved brann <input data-sb-ber="kontakt" value="${esc(ber.kontakt || '')}" placeholder="Navn"></label>
          <label>Telefon <input data-sb-ber="telefon" value="${esc(ber.telefon || '')}" placeholder="Mobil"></label>
          <label class="hel">Mobildekning og sikringsradio <input data-sb-ber="mobil" value="${esc(ber.mobil || '')}" placeholder="F.eks. dårlig dekning nord for Svartbekken"></label>
        </div>
        <h4 class="undertittel">Brannvann (${(sb.vannkilder || []).length})</h4>
        ${(sb.vannkilder || []).map((v) => `<div class="sb-rad"><span>💧 ${esc(v.navn || 'Vannkilde')}</span><button type="button" class="knapp liten fare" data-sb-slettvann="${v.id}">Fjern</button></div>`).join('')}
        <div class="knapperad"><button type="button" class="knapp" data-sb="vann">Registrer vannkilde i kartet</button></div>
        <p class="fotnote">Oppdager du brann: ring 110 og oppgi nøyaktig sted, gjerne koordinater og adkomst. Slokk små branner hvis det er trygt – stryk med grønne greiner, ikke slå – og led brannen mot brent område.</p>
      </section>
      <section class="kort"><h3>Forsikring</h3>
        <div class="skjema to-kol">
          <label>Selskap <input data-sb-fors="selskap" value="${esc(f.selskap || '')}"></label>
          <label>Polisenummer <input data-sb-fors="polise" value="${esc(f.polise || '')}"></label>
          <label>Egenandel (kr) <input type="number" step="1000" data-sb-fors="egenandel" value="${f.egenandel ?? ''}"></label>
          <label>Forsikret areal (daa) <input type="number" data-sb-fors="areal" value="${f.areal ?? ''}" placeholder="${fmt(S.bestand.reduce((s, b) => s + (b.areal || 0), 0))}"></label>
        </div>
        <div class="sb-sjekker">${[['brann', 'Brann (inkl. slokking og vakthold)'], ['storm', 'Storm'], ['sno', 'Snø'], ['smagnagere', 'Smågnagere'], ['ansvar', 'Skogansvar'], ['veiansvar', 'Ansvar skogsbilvei']].map(([k, n]) => `<label class="sb-sjekk"><input type="checkbox" data-sb-dekning="${k}" ${f.dekning?.[k] ? 'checked' : ''}> ${n}</label>`).join('')}</div>
        <p class="fotnote">Skogbrands skogforsikring dekker brann, storm, snø og smågnagere. Storm og snø: sammenhengende felt over 2 ha med minst 25 % skadde trær. Følgeskader (barkbiller, tørke), flom og ras dekkes ikke. Standard egenandel 5 000 kr. Skogbrand: ${SKOGBRAND.telefon} · <a href="${SKOGBRAND.minSide}" target="_blank" rel="noopener">Min side</a></p>
      </section>`;
  }

  // ---------- visning: skader ----------
  function skaderHtml() {
    const sb = SB(); const S = hentPlan();
    const liste = sb.skader;
    const valgt = liste.find((s) => s.id === valgtSkade);
    return `
      <section class="kort"><h3>Registrer skade</h3>
        <div class="verktoyrad">
          <select id="sbNyType" aria-label="Skadetype">${Object.entries(SKADETYPER).map(([k, t]) => `<option value="${k}">${t.ikon} ${esc(t.navn)}</option>`).join('')}</select>
          <button type="button" class="knapp primar" data-sb="tegn">Tegn område</button>
          <button type="button" class="knapp" data-sb="punkt">Punkt i kartet</button>
          <button type="button" class="knapp" data-sb="gps">Min posisjon</button>
        </div>
        <p class="fotnote">Tegn avgrensningen så nøyaktig du kan – areal, berørte bestand, volum og verdi beregnes fra skogbruksplanen. Ikke start opprydding før skaden er taksert.</p>
      </section>
      <section class="kort"><h3>Skader (${liste.length})</h3>
        ${liste.length ? liste.map((s) => {
          const t = SKADETYPER[s.type]; const fv = forsikringsvurdering(s, s.beregning);
          return `<div class="sb-skade${s.id === valgtSkade ? ' valgt' : ''}" data-sb-skade="${s.id}" style="--farge:${t.farge}">
            <span class="sb-ikon">${t.ikon}</span>
            <div><b>${esc(t.navn)}</b> <span class="hint">${esc(s.dato)}</span><div class="hint">${s.beregning ? `${fmt(s.beregning.skadeDaa, 1)} daa · ${fmt(s.beregning.volum)} m³ · ${s.berorte.length} bestand` : ''}</div></div>
            <div class="sb-merker"><span class="pefc-pille" style="--farge:${SKADESTATUS[s.status].farge}">${SKADESTATUS[s.status].navn}</span>${fv.status === 'ok' ? '<span class="pefc-pille" style="--farge:var(--good)">Dekkes trolig</span>' : fv.status === 'under' ? '<span class="pefc-pille" style="--farge:var(--warning)">Under grense</span>' : ''}</div>
          </div>`;
        }).join('') : '<div class="tom">Ingen skader registrert.</div>'}
      </section>
      ${valgt ? `<section class="kort" id="sbSkadeDetalj">${detaljHtml(valgt, S)}</section>` : ''}`;
  }

  function detaljHtml(s, S) {
    const t = SKADETYPER[s.type]; const b = s.beregning || { rader: [], volum: 0, verdi: 0, skadeDaa: 0 };
    const fv = forsikringsvurdering(s, b);
    const oppg = oppgaverFor(s);
    const idag = new Date().toISOString().slice(0, 10);
    const bk = brannkostnader(s);
    const fors = s.forsikring || {};
    return `
      <div class="detalj-topp"><h3>${t.ikon} ${esc(t.navn)}</h3><div class="knapperad" style="margin:0">
        <button type="button" class="knapp liten" data-sb="zoom">Zoom</button><button type="button" class="knapp liten primar" data-sb="melding">Skademelding</button><button type="button" class="knapp liten fare" data-sb="slett">Slett</button></div></div>
      <div class="nokkeltall">
        <div><b>${fmt(b.skadeDaa, 1)} daa</b><span>skadet areal</span></div>
        <div><b>${fmt(b.volum)} m³</b><span>anslått skadet volum</span></div>
        <div><b>${fmt(b.verdi / 1000)} k</b><span>kr rotnetto berørt</span></div>
        <div><b>${s.berorte.length}</b><span>berørte bestand</span></div>
      </div>
      <div class="sb-vurdering" data-status="${fv.status}"><b>Forsikring:</b> ${esc(fv.tekst)}</div>
      <div class="skjema to-kol">
        <label>Type <select data-sb-felt="type">${Object.entries(SKADETYPER).map(([k, x]) => `<option value="${k}" ${k === s.type ? 'selected' : ''}>${esc(x.navn)}</option>`).join('')}</select></label>
        <label>Status <select data-sb-felt="status">${Object.entries(SKADESTATUS).map(([k, x]) => `<option value="${k}" ${k === s.status ? 'selected' : ''}>${esc(x.navn)}</option>`).join('')}</select></label>
        <label>Skadedato <input type="date" data-sb-felt="dato" value="${esc(s.dato)}"></label>
        <label>Oppdaget <input type="date" data-sb-felt="oppdaget" value="${esc(s.oppdaget || '')}"></label>
        <label>Skadeprosent (${s.skadeprosent} %) <input type="range" min="0" max="100" step="5" data-sb-felt="skadeprosent" value="${s.skadeprosent}"></label>
        <label class="avkryss"><input type="checkbox" data-sb-felt="totalskade" ${s.totalskade ? 'checked' : ''}> Totalskade</label>
        <label class="hel">Beskrivelse <textarea rows="3" data-sb-felt="beskrivelse" placeholder="Hva har skjedd, omfang, tilkomst, spesielle forhold">${esc(s.beskrivelse)}</textarea></label>
      </div>
      <h4 class="undertittel">Berørte bestand</h4>
      ${b.rader.length ? `<div class="tabell-wrap"><table class="tabell"><thead><tr><th>Bestand</th><th class="tall">Daa</th><th>Treslag</th><th class="tall">Bon.</th><th class="tall">Alder</th><th class="tall">m³</th><th class="tall">kr</th></tr></thead><tbody>
        ${b.rader.map((r) => `<tr data-sb-bestand="${r.id}"><td>${esc(r.nr)}</td><td class="tall">${fmt(r.daa, 1)}</td><td>${esc(TRESLAG[r.treslag] || '')}</td><td class="tall">${r.bonitet ?? '–'}</td><td class="tall">${r.alder}</td><td class="tall">${fmt(r.volum)}</td><td class="tall">${fmt(r.verdi)}</td></tr>`).join('')}</tbody></table></div>
        <div class="knapperad"><button type="button" class="knapp" data-sb="tiltak">Legg opprydding og foryngelse inn i tiltaksplanen</button></div>` : '<div class="hint">Ingen bestand berøres. Tegn området over bestandene.</div>'}
      <h4 class="undertittel">Oppfølging</h4>
      <div class="sb-oppgaver">${oppg.map((o) => { const ferdig = !!s.oppgaver?.[o.id]; const forfalt = !ferdig && o.frist && o.frist < idag; return `<label class="sb-oppgave${forfalt ? ' forfalt' : ''}"><input type="checkbox" data-sb-oppgave="${o.id}" ${ferdig ? 'checked' : ''}><span>${esc(o.tekst)}${o.frist ? ` <small>· frist ${esc(o.frist)}${forfalt ? ' (forfalt)' : ''}</small>` : ''}</span></label>`; }).join('')}</div>
      <h4 class="undertittel">Forsikringssak</h4>
      <div class="skjema to-kol">
        <label>Meldt dato <input type="date" data-sb-fors-sak="meldt" value="${esc(fors.meldt || '')}"></label>
        <label>Skadenummer <input data-sb-fors-sak="skadenummer" value="${esc(fors.skadenummer || '')}"></label>
        <label>Taksert dato <input type="date" data-sb-fors-sak="takstDato" value="${esc(fors.takstDato || '')}"></label>
        <label>Takstmann <input data-sb-fors-sak="takstmann" value="${esc(fors.takstmann || '')}"></label>
        <label>Erstatning (kr) <input type="number" data-sb-fors-sak="erstatning" value="${fors.erstatning ?? ''}"></label>
      </div>
      ${s.type === 'brann' ? `<h4 class="undertittel">Vakthold og slokking</h4>
        <div class="tabell-wrap"><table class="tabell"><thead><tr><th>Dato</th><th>Type</th><th class="tall">Timer</th><th>Attestert</th><th></th></tr></thead><tbody>
          ${(s.timer || []).map((r, i) => `<tr><td><input type="date" data-sb-time="${i}" data-f="dato" value="${esc(r.dato || '')}"></td><td><select data-sb-time="${i}" data-f="type">${[['vakthold', 'Vakthold'], ['slokking', 'Slokking'], ['traktor', 'Traktor m/fører']].map(([k, n]) => `<option value="${k}" ${r.type === k ? 'selected' : ''}>${n}</option>`).join('')}</select></td><td><input type="number" step="0.5" style="width:70px" data-sb-time="${i}" data-f="timer" value="${r.timer ?? ''}"></td><td><input type="checkbox" data-sb-time="${i}" data-f="attestert" ${r.attestert ? 'checked' : ''}></td><td><button type="button" class="knapp liten" data-sb-slett-time="${i}">✕</button></td></tr>`).join('')}
        </tbody></table></div>
        <div class="knapperad"><button type="button" class="knapp liten" data-sb="ny-time">+ Legg til timer</button><span class="hint">${fmt(bk.timer, 1)} timer = ${fmt(bk.kr)} kr (${fmt(bk.attestert)} kr attestert) etter ${SKOGBRAND.sats} kr/t, traktor dobbel sats</span></div>` : ''}
      <h4 class="undertittel">Bilder (${(s.bilder || []).length})</h4>
      <div class="sb-bilder">${(s.bilder || []).map((src, i) => `<figure><img src="${src}" alt="Skadebilde ${i + 1}"><button type="button" class="knapp liten" data-sb-slett-bilde="${i}" aria-label="Fjern bilde">✕</button></figure>`).join('')}
        <label class="sb-legg-bilde">+ Ta eller velg bilder<input type="file" accept="image/*" capture="environment" multiple data-sb="bilder" hidden></label></div>
      <div id="sbMelding" hidden></div>`;
  }

  function tegn() {
    const panel = $('#fane-skogbrand'); if (!panel) return;
    panel.querySelectorAll('[data-sb-under]').forEach((k) => k.classList.toggle('aktiv', k.dataset.sbUnder === underfane));
    $('#sbInnhold').innerHTML = underfane === 'naa' ? naaHtml() : underfane === 'forebygging' ? forebyggingHtml() : skaderHtml();
  }

  // ---------- handlinger ----------
  function aktivSkade() { return SB().skader.find((s) => s.id === valgtSkade); }
  function leggTilTiltakForSkade(s) {
    const S = hentPlan();
    let n = 0;
    for (const r of s.berorte) {
      const b = S.bestand.find((x) => x.id === r.id); if (!b) continue;
      const andel = b.areal ? (r.daa || b.areal) / b.areal : 1;
      const txt = `Etter ${SKADETYPER[s.type].navn.toLowerCase()} ${s.dato}`;
      const ny = (type, aar, kommentar) => { b.tiltak = b.tiltak || []; if (!b.tiltak.some((t) => t.skadeId === s.id && t.type === type)) { b.tiltak.push({ id: nyId('t'), type, aar, status: 'planlagt', prioritet: 1, kommentar, skadeId: s.id }); n++; } };
      if (s.type === 'bille') ny('sluttavvirkning', iAar, `Sanitærhogst: ${txt}`);
      else if (['storm', 'sno', 'brann'].includes(s.type)) {
        ny(andel > 0.5 || s.totalskade ? 'sluttavvirkning' : 'annet', iAar, `Opprydding (etter taksering): ${txt}`);
        if (s.totalskade || s.skadeprosent >= 50) ny('planting', iAar + 1, `Foryngelse: ${txt}`);
      } else if (s.type === 'smagnagere' || s.type === 'vilt') ny('suppleringsplanting', iAar + 1, `Supplering: ${txt}`);
      else ny('annet', iAar, txt);
    }
    endret({ kart: false });
    melding(n ? `${n} tiltak lagt inn i tiltaksplanen.` : 'Tiltakene finnes allerede i planen.');
  }
  function skrivMelding(s) {
    const S = hentPlan();
    const tekst = skademeldingTekst(S, s, s.beregning || { rader: [], volum: 0, skadeDaa: 0 }, { fmt });
    const el = $('#sbMelding'); el.hidden = false;
    el.innerHTML = `<h4 class="undertittel">Skademelding</h4><textarea class="sb-meldingstekst" rows="14" readonly>${esc(tekst)}</textarea>
      <div class="knapperad"><button type="button" class="knapp primar" data-sb="kopier">Kopier tekst</button><button type="button" class="knapp" data-sb="skriv">Skriv ut med bilder</button><button type="button" class="knapp" data-sb="geojson">Last ned kartavgrensning</button><a class="knapp" href="${SKOGBRAND.minSide}" target="_blank" rel="noopener">Åpne Skogbrand Min side</a></div>
      <p class="fotnote">Skademelding sendes via forsikringsselskapets nettside (Skogbrand: Min side). Lim inn teksten, legg ved bildene og kartavgrensningen. Når skaden er meldt, sett status til «Meldt forsikring».</p>`;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function skrivUt(s) {
    const S = hentPlan();
    const tekst = skademeldingTekst(S, s, s.beregning || { rader: [], volum: 0, skadeDaa: 0 }, { fmt });
    const w = window.open('', '_blank'); if (!w) { melding('Nettleseren blokkerte utskriftsvinduet.'); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Skademelding ${esc(S.eiendom?.navn || '')}</title><style>body{font:14px/1.5 system-ui,sans-serif;max-width:800px;margin:24px auto;padding:0 16px}pre{white-space:pre-wrap;font:inherit}img{max-width:48%;margin:4px;border-radius:6px}</style><pre>${esc(tekst)}</pre>${(s.bilder || []).map((b) => `<img src="${b}">`).join('')}<script>setTimeout(()=>print(),300)<\/script>`);
    w.document.close();
  }
  function lastNedGeojson(s) {
    const S = hentPlan();
    const fc = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: s.geometri, properties: { type: SKADETYPER[s.type].navn, dato: s.dato, skadeprosent: s.skadeprosent, areal_daa: Math.round((s.beregning?.skadeDaa || 0) * 10) / 10, eiendom: S.eiendom?.navn || '' } }] };
    const url = URL.createObjectURL(new Blob([JSON.stringify(fc, null, 1)], { type: 'application/geo+json' }));
    const a = document.createElement('a'); a.href = url; a.download = `skade-${s.type}-${s.dato}.geojson`; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }
  function samradsskjema() {
    const S = hentPlan(); const d = SB().data; const ber = SB().beredskap || {};
    const idag = d?.brann?.dager?.[0];
    const c = senterForEiendom();
    const w = window.open('', '_blank'); if (!w) { melding('Nettleseren blokkerte vinduet.'); return; }
    const linje = (t) => `<tr><td>${t}</td><td style="width:60%;border-bottom:1px solid #999"></td></tr>`;
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Samrådsskjema skogbrannfare</title><style>body{font:13px/1.5 system-ui,sans-serif;max-width:820px;margin:20px auto;padding:0 16px}td{padding:6px 4px;vertical-align:top}h1{font-size:20px}h2{font-size:15px;margin-top:18px}.b{display:inline-block;width:12px;height:12px;border:1px solid #333;margin-right:6px}</style>
      <h1>Samrådsskjema – skogsdrift ved stor skogbrannfare</h1>
      <p>Etter «Retningslinjer for skogsdrift og skjøtsel i skogbrannsesongen» (Skogbrand m.fl., april 2026). Samrådet dokumenteres, og tid for nytt samråd avtales.</p>
      <table>${linje('Eiendom')}${linje('Dato og klokkeslett for samråd')}${linje('Deltakere (entreprenør, maskinfører, tømmerkjøper/oppdragsgiver, ev. brannvesen)')}</table>
      <h2>Fare</h2><p>Skogbrannindeks i dag: <b>${esc(idag?.nivaa?.navn || '–')}</b> (FWI ${fmt(idag?.fwi, 1)}). Vurder også farevarsel, tørke, nedbør siste tid og værmelding.</p>
      <h2>Drift</h2><table>${linje('Nøyaktig posisjon på drift')}${c ? `<tr><td>Eiendommens senter</td><td>${c[1].toFixed(5)} N, ${c[0].toFixed(5)} Ø</td></tr>` : ''}${linje('Type drift / maskiner')}${linje('Mobildekning og kontaktnumre')}<tr><td>Kontaktperson grunneier</td><td>${esc(ber.kontakt || '')} ${esc(ber.telefon || '')}</td></tr>${linje('Adkomst og vanntilgang')}${linje('Utstyr og personer som kan bidra ved brann')}</table>
      <h2>Risikovurdering</h2>${['Skogtype, vegetasjon, skogbunn og topografi', 'Spredningsrisiko, begrensningslinjer og vind', 'Nærhet til bebyggelse og infrastruktur'].map((x) => `<p><span class="b"></span>${x}: ______________________________________</p>`).join('')}
      <h2>Sikringstiltak</h2>${['Kjøring uten belter/kjettinger', 'Prioritere granskog og fuktige områder; unngå tørr, blokkrik furumark og sør-/vestvendte lier', 'Utkjøring på grønt bar', 'Tidsbegrenset kjøring (natt/morgen)', 'Vakthold under og etter drift', 'Vanning av utkjøringsveier', 'Forhåndskontakt med brannvesenet', 'Sikringsradio', 'Flyttbar vannkilde (1000 L), pumpe og slanger', 'Flytte eller stoppe aktiviteten'].map((x) => `<p><span class="b"></span>${x}</p>`).join('')}
      <h2>Konklusjon og nytt samråd</h2><table>${linje('Beslutning')}${linje('Tid for nytt samråd')}${linje('Kopi sendt brannvesenet (dato)')}</table>
      <script>setTimeout(()=>print(),300)<\/script>`);
    w.document.close();
  }

  // ---------- hendelser ----------
  const panel = $('#fane-skogbrand');
  panel.addEventListener('click', async (e) => {
    const S = hentPlan(); const sb = SB();
    const u = e.target.closest('[data-sb-under]'); if (u) { underfane = u.dataset.sbUnder; tegn(); if (underfane === 'naa') hentData(); return; }
    const bes = e.target.closest('[data-sb-bestand]'); if (bes && !e.target.closest('input,select,button:not([data-sb-bestand])')) { e.preventDefault(); visBestand(bes.dataset.sbBestand); return; }
    const sk = e.target.closest('[data-sb-skade]'); if (sk) { velgSkade(sk.dataset.sbSkade); zoomSkade(aktivSkade()); return; }
    const far = e.target.closest('[data-sb-farge]'); if (far) { const v = `${far.dataset.sbFarge === 'sno' ? 'sno' : far.dataset.sbFarge}risiko`; const sel = $('#fargeEtter'); sel.value = v; sel.dispatchEvent(new Event('change')); melding(`Kartet viser ${RISIKO[far.dataset.sbFarge].toLowerCase()}risiko per bestand.`); return; }
    const ti = e.target.closest('[data-sb-tiltak]');
    if (ti) {
      const t = forebyggendeTiltak(S, risiko(), { iAar })[Number(ti.dataset.sbTiltak)];
      if (t?.type) { t.b.tiltak = t.b.tiltak || []; t.b.tiltak.push({ id: nyId('t'), type: t.type, aar: iAar + (t.type === 'sluttavvirkning' ? 1 : 0), status: 'planlagt', prioritet: t.prioritet, kommentar: `Forebygging: ${t.tekst.split('.')[0]}` }); lagre(false); melding(`${TILTAKSTYPER[t.type].navn} lagt inn for bestand ${t.b.nr}.`); }
      return;
    }
    const sv = e.target.closest('[data-sb-slettvann]'); if (sv) { sb.vannkilder = sb.vannkilder.filter((v) => v.id !== sv.dataset.sbSlettvann); lagre(); return; }
    const sbI = e.target.closest('[data-sb-slett-bilde]'); if (sbI) { const s = aktivSkade(); s.bilder.splice(Number(sbI.dataset.sbSlettBilde), 1); lagre(false); return; }
    const st = e.target.closest('[data-sb-slett-time]'); if (st) { const s = aktivSkade(); s.timer.splice(Number(st.dataset.sbSlettTime), 1); lagre(false); return; }
    const k = e.target.closest('[data-sb]')?.dataset.sb; if (!k) return;
    const s = aktivSkade();
    if (k === 'hent') hentData(true);
    if (k === 'samrad') samradsskjema();
    if (k === 'vann') startTegning(null, 'vann');
    if (k === 'tegn') startTegning($('#sbNyType').value, 'flate');
    if (k === 'punkt') startTegning($('#sbNyType').value, 'punkt');
    if (k === 'gps') skadeVedPosisjon();
    if (!s) return;
    if (k === 'zoom') zoomSkade(s);
    if (k === 'slett' && confirm('Slette skaderegistreringen?')) { sb.skader = sb.skader.filter((x) => x.id !== s.id); if (S.pefc?.objekter) S.pefc.objekter = S.pefc.objekter.filter((o) => o.skadeId !== s.id); valgtSkade = null; lagre(); }
    if (k === 'melding') skrivMelding(s);
    if (k === 'kopier') { try { await navigator.clipboard.writeText($('.sb-meldingstekst').value); melding('Skademeldingen er kopiert.'); } catch { $('.sb-meldingstekst').select(); document.execCommand('copy'); melding('Skademeldingen er kopiert.'); } }
    if (k === 'skriv') skrivUt(s);
    if (k === 'geojson') lastNedGeojson(s);
    if (k === 'tiltak') leggTilTiltakForSkade(s);
    if (k === 'ny-time') { s.timer = s.timer || []; s.timer.push({ dato: new Date().toISOString().slice(0, 10), type: 'vakthold', timer: 1, attestert: false }); lagre(false); }
  });
  panel.addEventListener('change', async (e) => {
    const t = e.target; const sb = SB(); const s = aktivSkade();
    if (t.dataset.sbLag) { sb.visLag = { ...sb.visLag, [t.dataset.sbLag]: t.checked }; if (t.dataset.sbLag === 'feller' && t.checked && !sb.data?.bille?.feller) await hentData(true); endret({ kart: false }); tegnKart(); tegn(); return; }
    if (t.dataset.sbBer) { sb.beredskap = { ...sb.beredskap, [t.dataset.sbBer]: t.type === 'checkbox' ? t.checked : t.value }; endret({ kart: false }); return; }
    if (t.dataset.sbFors) { sb.forsikring[t.dataset.sbFors] = t.type === 'number' ? (t.value === '' ? null : Number(t.value)) : t.value; endret({ kart: false }); return; }
    if (t.dataset.sbDekning) { sb.forsikring.dekning = { ...sb.forsikring.dekning, [t.dataset.sbDekning]: t.checked }; endret({ kart: false }); return; }
    if (t.dataset.sb === 'bilder' && s) {
      for (const f of t.files) { try { s.bilder.push(await skalerBilde(f, 1600)); } catch { melding('Kunne ikke lese et av bildene.'); } }
      lagre(false); return;
    }
    if (!s) return;
    if (t.dataset.sbFelt) {
      const f = t.dataset.sbFelt;
      s[f] = t.type === 'checkbox' ? t.checked : t.type === 'range' ? Number(t.value) : t.value;
      if (f === 'type') { await oppdaterBeregning(s); synkPefc(s); }
      if (f === 'skadeprosent' || f === 'totalskade') { if (f === 'totalskade' && t.checked) s.skadeprosent = 100; await oppdaterBeregning(s); }
      if (f === 'status' && t.value === 'meldt' && !s.forsikring.meldt) s.forsikring.meldt = new Date().toISOString().slice(0, 10);
      lagre(f === 'type' || f === 'status');
      return;
    }
    if (t.dataset.sbForsSak) { s.forsikring[t.dataset.sbForsSak] = t.type === 'number' ? (t.value === '' ? null : Number(t.value)) : t.value; if (t.dataset.sbForsSak === 'takstDato' && t.value && ['registrert', 'meldt'].includes(s.status)) s.status = 'taksert'; lagre(false); return; }
    if (t.dataset.sbOppgave) { s.oppgaver = { ...s.oppgaver, [t.dataset.sbOppgave]: t.checked }; endret({ kart: false }); t.closest('.sb-oppgave')?.classList.remove('forfalt'); return; }
    if (t.dataset.sbTime !== undefined) { const r = s.timer[Number(t.dataset.sbTime)]; const f = t.dataset.f; r[f] = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Number(t.value) : t.value; lagre(false); }
  });
  $('#sbTegnFerdig').addEventListener('click', fullfor);
  $('#sbTegnAvbryt').addEventListener('click', stopp);
  L.DomEvent.disableClickPropagation($('#sbTegnHjelp'));

  return {
    vis() { synlig = true; if (!kart.hasLayer(lag)) { lag.addTo(kart); felleLag.addTo(kart); } tegnKart(); tegn(); if (underfane === 'naa') hentData(); },
    skjul() { synlig = false; stopp(); lag.remove(); felleLag.remove(); for (const id of Object.keys(wms)) { wms[id].remove(); delete wms[id]; } },
    oppdater() { risikoCache = null; if (synlig) { tegnKart(); tegn(); } },
    risiko(bestandId, type) { return risiko().get(bestandId)?.[type] || null; },
    // Oppdaterer beregning for skader etter at bestand er endret (f.eks. ny plan eller deling).
    async beregnAlle() { for (const s of SB().skader) await oppdaterBeregning(s); },
  };
}

