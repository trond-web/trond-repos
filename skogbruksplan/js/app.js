import { arealM2, punktIGeometri, bbox, fraWgs84 } from './proj.js';
import { lagSosi } from './sosi.js';
import {
  TRESLAG, HOGSTKLASSER, HK_NAVN, HK_ROMERTALL, BONITETER, TILTAKSTYPER, STANDARD_INNSTILLINGER,
  normaliserBestand, laavesteHogstalder, beregnetHogstklasse, startTilstand, arligTilvekstDaa,
  rotnettoPerM3, tiltakKostnad, framskriv, foreslaaForEiendom, sammendrag, nyId, runde,
} from './model.js';
import { lesFil, slaaSammen } from './importers.js';
import { lagDemo } from './demo.js';
import { lagre, hent } from './store.js';
import { stabletSoyle, linje, fmt } from './charts.js';

const IAAR = new Date().getFullYear();
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const klon = (o) => JSON.parse(JSON.stringify(o));

let S = { versjon: 1, eiendom: { navn: '', kommune: '', gnrbnr: '', eier: '', takstAar: IAAR }, bestand: [], registreringer: [], innstillinger: klon(STANDARD_INNSTILLINGER) };
let valgtId = null;
let sortering = { felt: 'nr', retning: 1 };
let frResultat = null;

// ---------------------------------------------------------------- hjelpere
function inn() { return S.innstillinger; }
function finnBestand(id) { return S.bestand.find((b) => b.id === id); }
function css(navn) { return getComputedStyle(document.documentElement).getPropertyValue(navn).trim(); }
function hk(b) {
  if (b.hogstklasse) return b.hogstklasse;
  const s = startTilstand(b);
  return beregnetHogstklasse(s.alder, laavesteHogstalder(b, inn()), s.volumDaa);
}
function hogstmodenAar(b) {
  const min = laavesteHogstalder(b, inn());
  const s = startTilstand(b);
  if (!min || (!b.alder && !b.volumDaa)) return null;
  return s.alder >= min ? IAAR : IAAR + Math.ceil(min - s.alder);
}
function sortNr(a, b) { return String(a).localeCompare(String(b), 'nb', { numeric: true }); }

let lagreTimer;
function lagreSnart() {
  clearTimeout(lagreTimer);
  lagreTimer = setTimeout(() => lagre(S).catch((e) => melding(`Kunne ikke lagre: ${e.message}`)), 300);
}
let meldingTimer;
function melding(tekst, ms = 3500) {
  const m = $('#melding'); m.textContent = tekst; m.hidden = false;
  clearTimeout(meldingTimer); meldingTimer = setTimeout(() => { m.hidden = true; }, ms);
}
function lastNed(navn, innhold, type = 'application/octet-stream') {
  const url = URL.createObjectURL(innhold instanceof Blob ? innhold : new Blob([innhold], { type }));
  const a = document.createElement('a'); a.href = url; a.download = navn; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}
function filnavn(ending) {
  const n = (S.eiendom.navn || 'skogbruksplan').toLowerCase().replace(/[^a-z0-9æøå]+/g, '-').replace(/^-|-$/g, '');
  return `${n}-${new Date().toISOString().slice(0, 10)}.${ending}`;
}

// ---------------------------------------------------------------- kart
let kart; let bestandLag; let regLag; let gpsMarkor; let gpsSirkel; let valgtPunkt;
const lagPerBestand = new Map();

function initKart() {
  kart = L.map('kart', { zoomControl: true, preferCanvas: false }).setView([60.85, 11.2], 9);
  const topo = L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png', {
    maxZoom: 20, maxNativeZoom: 18, attribution: '© <a href="https://www.kartverket.no/">Kartverket</a>',
  });
  const graa = L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/webmercator/{z}/{y}/{x}.png', {
    maxZoom: 20, maxNativeZoom: 18, attribution: '© <a href="https://www.kartverket.no/">Kartverket</a>',
  });
  const flyfoto = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 20, maxNativeZoom: 19, attribution: 'Flyfoto © Esri, Maxar, Earthstar Geographics',
  });
  const wms = (url, layers, navn) => L.tileLayer.wms(url, { layers, format: 'image/png', transparent: true, opacity: 0.6, attribution: `${navn} © NIBIO` });
  const overlays = {
    'SR16 Volum (NIBIO)': wms('https://wms.nibio.no/cgi-bin/sr16', 'SRRVOLMB', 'SR16'),
    'SR16 Treslag (NIBIO)': wms('https://wms.nibio.no/cgi-bin/sr16', 'SRRTRESLAG', 'SR16'),
    'SR16 Bonitet (NIBIO)': wms('https://wms.nibio.no/cgi-bin/sr16', 'SRRBONITET', 'SR16'),
    'SR16 Trehøyde (NIBIO)': wms('https://wms.nibio.no/cgi-bin/sr16', 'SRRHOYDEM', 'SR16'),
    'AR5 Arealtype (NIBIO)': wms('https://wms.nibio.no/cgi-bin/ar5', 'Arealtype', 'AR5'),
  };
  graa.addTo(kart);
  bestandLag = L.featureGroup().addTo(kart);
  regLag = L.featureGroup().addTo(kart);
  L.control.layers({ 'Topografisk (gråtone)': graa, 'Topografisk': topo, 'Flyfoto': flyfoto }, { ...overlays, 'Bestand': bestandLag, 'Registreringer': regLag }, { position: 'topright' }).addTo(kart);
  L.control.scale({ imperial: false }).addTo(kart);

  kart.on('click', (e) => {
    if (tegning) { leggTilTegnepunkt(e.latlng); return; }
    settValgtPunkt(e.latlng);
  });
  kart.on('zoomend', oppdaterEtiketter);
}

function settValgtPunkt(ll) {
  if (valgtPunkt) valgtPunkt.setLatLng(ll); else valgtPunkt = L.circleMarker(ll, { radius: 6, color: css('--text'), weight: 2, fillOpacity: 0 }).addTo(kart);
}

const HK_FARGER = ['#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'];
function rampe(verdi, min, maks) {
  const steg = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
  if (verdi === null || verdi === undefined) return null;
  const t = Math.max(0, Math.min(1, (verdi - min) / (maks - min)));
  return steg[Math.round(t * (steg.length - 1))];
}
const TILTAK_FARGER = { hogst: '#eb6834', kultur: '#1baf7a', annet: '#2a78d6' };

function fargeFor(b) {
  const modus = $('#fargeEtter').value;
  if (modus === 'hogstklasse') { const h = hk(b); return h ? HK_FARGER[h - 1] : null; }
  if (modus === 'treslag') return css(`--ts-${(b.treslag || 'G').toLowerCase()}`);
  if (modus === 'bonitet') return rampe(b.bonitet, 6, 26);
  if (modus === 'volum') return rampe(startTilstand(b).volumDaa, 0, 45);
  if (modus === 'tiltak') {
    const t = (b.tiltak || []).filter((x) => x.status !== 'utfort').sort((x, y) => x.aar - y.aar)[0];
    return t ? TILTAK_FARGER[TILTAKSTYPER[t.type]?.gruppe || 'annet'] : null;
  }
  if (modus === 'framskrevet') {
    const fr = sikreFramskriving();
    const aar = Number($('#frAar').value);
    const h = fr.perBestand.get(b.id)?.[aar]?.hk;
    return h ? HK_FARGER[h - 1] : null;
  }
  return null;
}

let legendLukket = window.innerWidth <= 860;
function tegnLegend() {
  const modus = $('#fargeEtter').value;
  const rad = (farge, tekst) => `<div><i style="background:${farge}"></i>${esc(tekst)}</div>`;
  let html = '';
  if (modus === 'hogstklasse' || modus === 'framskrevet') {
    if (modus === 'framskrevet') html += `<b>Hogstklasse i ${IAAR + Number($('#frAar').value)}</b>`;
    html += HOGSTKLASSER.map((h) => rad(HK_FARGER[h - 1], HK_NAVN[h])).join('');
  } else if (modus === 'treslag') html = Object.entries(TRESLAG).map(([k, v]) => rad(css(`--ts-${k.toLowerCase()}`), v)).join('');
  else if (modus === 'bonitet') html = '<b>Bonitet (H40)</b>' + [6, 11, 17, 23, 26].map((v) => rad(rampe(v, 6, 26), `${v}`)).join('');
  else if (modus === 'volum') html = '<b>Volum m³/daa</b>' + [0, 10, 20, 30, 45].map((v) => rad(rampe(v, 0, 45), v === 45 ? '45+' : `${v}`)).join('');
  else if (modus === 'tiltak') html = '<b>Første planlagte tiltak</b>' + rad(TILTAK_FARGER.hogst, 'Hogst') + rad(TILTAK_FARGER.kultur, 'Skogkultur') + rad(TILTAK_FARGER.annet, 'Annet') + rad('transparent;border:1px solid #999', 'Ingen');
  $('#kartLegend').innerHTML = `<button type="button" class="legend-knapp" aria-expanded="${!legendLukket}">Tegnforklaring ${legendLukket ? '▸' : '▾'}</button><div class="legend-innhold" ${legendLukket ? 'hidden' : ''}>${html}</div>`;
}

function stilFor(b) {
  const farge = fargeFor(b);
  const valgt = b.id === valgtId;
  return {
    color: valgt ? '#ffd400' : '#1b1c19', weight: valgt ? 3.5 : 1.2, opacity: 0.9,
    fillColor: farge || '#999', fillOpacity: farge ? 0.7 : 0.08,
  };
}

function tegnBestandKart(zoom = false) {
  bestandLag.clearLayers(); lagPerBestand.clear();
  for (const b of S.bestand) {
    if (!b.geometri) continue;
    const lag = L.geoJSON(b.geometri, { style: () => stilFor(b) });
    lag.on('click', (e) => { L.DomEvent.stopPropagation(e); if (tegning) { leggTilTegnepunkt(e.latlng); return; } velgBestand(b.id, { zoom: false }); visFane('bestand'); });
    lag.bindTooltip(esc(b.nr || '?'), { permanent: true, direction: 'center', className: 'bestand-etikett' });
    lag.addTo(bestandLag);
    lagPerBestand.set(b.id, lag);
  }
  oppdaterEtiketter();
  tegnLegend();
  if (zoom) zoomTilAlle();
}

function oppdaterStiler() {
  for (const b of S.bestand) lagPerBestand.get(b.id)?.setStyle(stilFor(b));
  tegnLegend();
}

function oppdaterEtiketter() {
  const vis = kart.getZoom() >= 14;
  bestandLag.eachLayer((l) => { const t = l.getTooltip(); if (t) { if (vis) l.openTooltip(); else l.closeTooltip(); } });
}

function zoomTilAlle() {
  const bb = bbox(S.bestand.map((b) => b.geometri));
  if (bb) kart.fitBounds([[bb[1], bb[0]], [bb[3], bb[2]]], { padding: [20, 20] });
}

// ---------------------------------------------------------------- tegning og redigering av grenser
let tegning = false; let tegnePunkter = []; let tegneLinje = null;
function startTegning() {
  avsluttGrenseRedigering();
  tegning = true; tegnePunkter = [];
  kart.doubleClickZoom.disable();
  $('#tegnHjelp').hidden = false;
  kart.getContainer().style.cursor = 'crosshair';
}
function leggTilTegnepunkt(ll) {
  tegnePunkter.push([ll.lng, ll.lat]);
  const lls = tegnePunkter.map(([x, y]) => [y, x]);
  if (tegneLinje) tegneLinje.setLatLngs(lls); else tegneLinje = L.polygon(lls, { color: '#ffd400', weight: 2, dashArray: '4 4', fillOpacity: 0.1 }).addTo(kart);
}
function stoppTegning() {
  tegning = false; $('#tegnHjelp').hidden = true; kart.doubleClickZoom.enable(); kart.getContainer().style.cursor = '';
  if (tegneLinje) { tegneLinje.remove(); tegneLinje = null; }
}
function fullforTegning() {
  if (tegnePunkter.length < 3) { melding('Du må sette minst tre punkter.'); return; }
  const ring = [...tegnePunkter, tegnePunkter[0]];
  const geom = { type: 'Polygon', coordinates: [ring] };
  const nesteNr = S.bestand.reduce((m, b) => Math.max(m, parseInt(b.nr, 10) || 0), 0) + 1;
  const b = normaliserBestand({ nr: String(nesteNr) }, geom, arealM2(geom) / 1000, IAAR);
  b.hogstklasse = null;
  S.bestand.push(b);
  stoppTegning();
  endret({ kart: true });
  velgBestand(b.id); visFane('bestand');
  melding(`Bestand ${b.nr} opprettet (${fmt(b.areal, 1)} daa). Fyll inn data under.`);
}

let redigerMarkorer = [];
function startGrenseRedigering(b) {
  avsluttGrenseRedigering();
  if (!b.geometri || b.geometri.type !== 'Polygon') { melding('Kun enkle polygoner kan redigeres.'); return; }
  const ring = b.geometri.coordinates[0].slice(0, -1);
  const ikon = L.divIcon({ className: '', html: '<div style="width:12px;height:12px;background:#ffd400;border:2px solid #111;border-radius:50%"></div>', iconSize: [12, 12], iconAnchor: [6, 6] });
  ring.forEach((pt, i) => {
    const m = L.marker([pt[1], pt[0]], { draggable: true, icon: ikon }).addTo(kart);
    m.on('drag', () => {
      const ll = m.getLatLng(); ring[i] = [ll.lng, ll.lat];
      b.geometri = { type: 'Polygon', coordinates: [[...ring, ring[0]], ...b.geometri.coordinates.slice(1)] };
      lagPerBestand.get(b.id)?.clearLayers().addData(b.geometri);
    });
    m.on('dragend', () => { b.areal = runde(arealM2(b.geometri) / 1000, 2); endret({ kart: true }); visDetalj(); startGrenseRedigering(b); });
    redigerMarkorer.push(m);
  });
  melding('Dra de gule punktene for å flytte grensen. Trykk «Ferdig» når du er ferdig.', 5000);
}
function avsluttGrenseRedigering() { redigerMarkorer.forEach((m) => m.remove()); redigerMarkorer = []; }

// ---------------------------------------------------------------- faner
function visFane(navn) {
  $$('.faner button').forEach((b) => b.classList.toggle('aktiv', b.dataset.fane === navn));
  $$('.fane').forEach((f) => { f.hidden = f.id !== `fane-${navn}`; });
  if (navn === 'framskriving') tegnFramskriving();
  if (window.innerWidth <= 860) $('.panel').scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => kart.invalidateSize(), 50);
}

// ---------------------------------------------------------------- oversikt
function tegnOversikt() {
  const s = sammendrag(S.bestand, inn());
  const kpi = (verdi, etikett, under = '') => `<div class="kpi"><div class="verdi">${verdi}</div><div class="etikett">${etikett}</div>${under ? `<div class="under">${under}</div>` : ''}</div>`;
  const planlagt = alleTiltak().filter((t) => t.status !== 'utfort');
  $('#kpi').innerHTML = S.bestand.length ? [
    kpi(fmt(s.areal), 'daa produktiv skog', `${s.antall} bestand`),
    kpi(fmt(s.volum), 'm³ stående volum', `${fmt(s.areal ? s.volum / s.areal : 0, 1)} m³/daa`),
    kpi(fmt(s.tilvekst), 'm³ tilvekst per år', `${fmt(s.volum ? (s.tilvekst / s.volum) * 100 : 0, 1)} % av volumet`),
    kpi(`${fmt(s.verdiHogstmoden / 1e6, 2)} mill`, 'kr rotnetto i HK V', 'Estimat med dagens priser'),
    kpi(fmt(s.co2), 't CO₂ bundet per år', 'Grovt estimat fra tilvekst'),
    kpi(fmt(planlagt.length), 'planlagte tiltak', `${planlagt.filter((t) => t.aar <= IAAR).length} forfalt/i år`),
  ].join('') : '<div class="kort tom">Ingen bestand ennå. Gå til <a href="#" data-gaa="data">Data</a> for å importere en skogbruksplan (SOSI, GeoJSON eller CSV), tegn bestand i kartet, eller <a href="#" id="demoLenke">last en demo-eiendom</a>.</div>';
  const demoLenke = $('#demoLenke'); if (demoLenke) demoLenke.onclick = (e) => { e.preventDefault(); lastDemo(); };

  const serier = Object.entries(TRESLAG).map(([k, v]) => ({ key: k, navn: v, farge: css(`--ts-${k.toLowerCase()}`) }));
  stabletSoyle($('#hkDiagram'), {
    kategorier: HOGSTKLASSER.map((h) => ({ navn: HK_NAVN[h], kort: `HK ${HK_ROMERTALL[h]}`, verdier: s.perHk[h] })),
    serier, enhet: 'daa',
  });

  const neste = planlagt.sort((a, b) => a.aar - b.aar || (a.prioritet || 9) - (b.prioritet || 9)).slice(0, 6);
  $('#nesteTiltak').innerHTML = neste.length ? neste.map(tiltakRadHtml).join('') : '<div class="tom">Ingen planlagte tiltak. Bruk «Foreslå tiltak» i Tiltak-fanen.</div>';
}

// ---------------------------------------------------------------- bestand
function tegnBestandTabell() {
  const sok = $('#bestandSok').value.trim().toLowerCase();
  const fHk = $('#bestandFilterHk').value; const fTs = $('#bestandFilterTs').value;
  const rader = S.bestand.filter((b) => {
    if (fHk && String(hk(b)) !== fHk) return false;
    if (fTs && b.treslag !== fTs) return false;
    if (sok && !`${b.nr} ${b.teig} ${b.merknad}`.toLowerCase().includes(sok)) return false;
    return true;
  }).map((b) => {
    const s = startTilstand(b);
    return { b, nr: b.nr, areal: b.areal, treslag: b.treslag, bonitet: b.bonitet, hogstklasse: hk(b), alder: b.alder ?? (s.alder || null), volumDaa: s.volumDaa, volum: s.volumDaa * (b.areal || 0), hogstmoden: hogstmodenAar(b) };
  });
  const { felt, retning } = sortering;
  rader.sort((a, b) => {
    const x = a[felt]; const y = b[felt];
    if (felt === 'nr' || felt === 'treslag') return sortNr(x ?? '', y ?? '') * retning;
    return ((x ?? -Infinity) - (y ?? -Infinity)) * retning;
  });
  $('#bestandTabell tbody').innerHTML = rader.map((r) => `
    <tr data-id="${r.b.id}" class="${r.b.id === valgtId ? 'valgt' : ''}">
      <td>${esc(r.nr)}${r.b.miljo ? ' 🦉' : ''}${r.b.geometri ? '' : ' <span title="Mangler kartgeometri">⚠️</span>'}</td>
      <td class="tall">${fmt(r.areal, 1)}</td>
      <td><span class="ts-prikk" style="background:var(--ts-${(r.treslag || 'g').toLowerCase()})"></span>${r.treslag || ''}</td>
      <td class="tall">${r.bonitet ?? ''}</td><td>${r.hogstklasse ? HK_ROMERTALL[r.hogstklasse] : ''}</td>
      <td class="tall">${r.alder !== null && r.alder !== undefined ? Math.round(r.alder) : ''}</td>
      <td class="tall">${fmt(r.volumDaa, 1)}</td><td class="tall">${fmt(r.volum)}</td>
      <td class="tall">${r.hogstmoden ? (r.hogstmoden <= IAAR ? 'Nå' : r.hogstmoden) : ''}</td>
    </tr>`).join('') || '<tr><td colspan="9" class="tom">Ingen bestand å vise.</td></tr>';
  const sumA = rader.reduce((s, r) => s + (r.areal || 0), 0); const sumV = rader.reduce((s, r) => s + r.volum, 0);
  $('#bestandTabell tfoot').innerHTML = rader.length ? `<tr><td>${rader.length} stk</td><td class="tall">${fmt(sumA, 1)}</td><td colspan="4"></td><td class="tall">${fmt(sumA ? sumV / sumA : 0, 1)}</td><td class="tall">${fmt(sumV)}</td><td></td></tr>` : '';
  $$('#bestandTabell th').forEach((th) => { th.textContent = th.textContent.replace(/ [▲▼]$/, '') + (th.dataset.sort === felt ? (retning > 0 ? ' ▲' : ' ▼') : ''); });
}

function velgBestand(id, { zoom = true } = {}) {
  valgtId = id;
  oppdaterStiler();
  tegnBestandTabell();
  visDetalj();
  const lag = lagPerBestand.get(id);
  if (id) $('#bestandDetalj').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  if (zoom && lag) kart.fitBounds(lag.getBounds(), { maxZoom: 16, padding: [40, 40] });
  if (lag) lag.bringToFront();
}

function opsjoner(liste, valgt) { return liste.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(valgt ?? '') ? 'selected' : ''}>${esc(t)}</option>`).join(''); }

function visDetalj() {
  const boks = $('#bestandDetalj');
  const b = finnBestand(valgtId);
  if (!b) { boks.hidden = true; return; }
  boks.hidden = false;
  const s = startTilstand(b);
  const min = laavesteHogstalder(b, inn());
  const tilv = arligTilvekstDaa(b) * (b.areal || 0);
  const om10 = framskriv([b], 10, inn(), { folgPlan: false }).perBestand.get(b.id)[10].volumDaa * (b.areal || 0);
  const hm = hogstmodenAar(b);
  const ekstra = Object.entries(b.ekstra || {});
  boks.innerHTML = `
    <div class="detalj-topp">
      <h3>Bestand ${esc(b.nr)}${b.teig ? ` <span class="hint">teig ${esc(b.teig)}</span>` : ''}</h3>
      <div class="knapperad" style="margin:0">
        <button class="knapp liten" data-handling="zoom" type="button">Zoom</button>
        <button class="knapp liten" data-handling="grense" type="button">${redigerMarkorer.length ? 'Ferdig' : 'Rediger grense'}</button>
        <button class="knapp liten fare" data-handling="slett" type="button">Slett</button>
      </div>
    </div>
    <div class="nokkeltall">
      <div><b>${fmt(s.volumDaa * (b.areal || 0))} m³</b><span>stående volum</span></div>
      <div><b>${fmt(tilv, 1)} m³/år</b><span>tilvekst (est.)</span></div>
      <div><b>${fmt(om10)} m³</b><span>volum om 10 år uten hogst</span></div>
      <div><b>${hm ? (hm <= IAAR ? 'Nå' : hm) : '–'}</b><span>hogstmoden${min ? ` (≥ ${min} år)` : ''}</span></div>
      <div><b>${fmt(s.volumDaa * (b.areal || 0) * rotnettoPerM3(b.treslag, inn()) / 1000)} k</b><span>kr rotnetto ved hogst nå</span></div>
    </div>
    <form class="skjema tre-kol" id="detaljSkjema">
      <label>Bestandsnr <input name="nr" value="${esc(b.nr)}"></label>
      <label>Teig <input name="teig" value="${esc(b.teig)}"></label>
      <label>Areal (daa) <input name="areal" type="number" step="0.1" value="${b.areal ?? ''}"></label>
      <label>Treslag <select name="treslag">${opsjoner(Object.entries(TRESLAG), b.treslag)}</select></label>
      <label>Bonitet (H40) <select name="bonitet"><option value="">–</option>${opsjoner(BONITETER.map((v) => [v, `${b.treslag || 'G'}${v}`]), b.bonitet)}</select></label>
      <label>Hogstklasse <select name="hogstklasse"><option value="">Beregn fra alder</option>${opsjoner(HOGSTKLASSER.map((h) => [h, HK_NAVN[h]]), b.hogstklasse)}</select></label>
      <label>Alder (år) <input name="alder" type="number" value="${b.alder ?? ''}"></label>
      <label>Volum (m³/daa) <input name="volumDaa" type="number" step="0.1" value="${b.volumDaa ?? ''}"></label>
      <label>Treantall (per daa) <input name="treantall" type="number" value="${b.treantall ?? ''}"></label>
      <label>Middelhøyde (m) <input name="hoyde" type="number" step="0.1" value="${b.hoyde ?? ''}"></label>
      <label class="avkrysning" style="flex-direction:row;align-items:center;margin-top:18px"><input type="checkbox" name="miljo" ${b.miljo ? 'checked' : ''}> Miljøfigur / nøkkelbiotop</label>
      <label class="hel">Merknad <textarea name="merknad" rows="2">${esc(b.merknad)}</textarea></label>
    </form>
    ${ekstra.length ? `<details class="ekstra"><summary>Andre felt fra importen (${ekstra.length})</summary>${ekstra.map(([k, v]) => `<div><b>${esc(k)}</b>: ${esc(v)}</div>`).join('')}</details>` : ''}
    <h3 style="margin-top:14px">Tiltak for bestandet</h3>
    <div>${(b.tiltak || []).sort((x, y) => x.aar - y.aar).map((t) => tiltakRadHtml({ ...t, bestand: b })).join('') || '<div class="tom">Ingen tiltak registrert.</div>'}</div>
    <form class="verktoyrad" id="nyttTiltakSkjema">
      <select name="type">${opsjoner(Object.entries(TILTAKSTYPER).map(([k, v]) => [k, v.navn]))}</select>
      <input name="aar" type="number" value="${IAAR}" style="width:90px" aria-label="År">
      <select name="prioritet"><option value="1">Prioritet 1</option><option value="2" selected>Prioritet 2</option><option value="3">Prioritet 3</option></select>
      <button class="knapp primar" type="submit">Legg til</button>
    </form>`;

  $('#detaljSkjema').addEventListener('change', (e) => {
    const f = e.target; const navn = f.name;
    let v = f.type === 'checkbox' ? f.checked : f.value;
    if (['areal', 'alder', 'volumDaa', 'treantall', 'hoyde', 'bonitet', 'hogstklasse'].includes(navn)) v = v === '' ? null : Number(v);
    b[navn] = v;
    endret({ kart: false });
    if (navn === 'treslag') visDetalj();
  });
  $('#nyttTiltakSkjema').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(e.target);
    b.tiltak.push({ id: nyId('t'), type: d.get('type'), aar: Number(d.get('aar')), prioritet: Number(d.get('prioritet')), status: 'planlagt', kommentar: '' });
    endret(); visDetalj();
  });
  boks.querySelector('[data-handling="zoom"]').onclick = () => velgBestand(b.id);
  boks.querySelector('[data-handling="grense"]').onclick = () => {
    if (redigerMarkorer.length) { avsluttGrenseRedigering(); visDetalj(); return; }
    if (!b.geometri) { melding('Bestandet har ingen geometri. Tegn det med «Tegn bestand» og slett dette, eller importer kart.'); return; }
    startGrenseRedigering(b); visDetalj();
  };
  boks.querySelector('[data-handling="slett"]').onclick = () => {
    if (!confirm(`Slette bestand ${b.nr}?`)) return;
    S.bestand = S.bestand.filter((x) => x.id !== b.id); valgtId = null; avsluttGrenseRedigering();
    endret({ kart: true });
  };
}

// ---------------------------------------------------------------- tiltak
function alleTiltak() {
  return S.bestand.flatMap((b) => (b.tiltak || []).map((t) => ({ ...t, bestand: b })));
}

function tiltakOkonomi(t) {
  const b = t.bestand; const areal = b.areal || 0;
  if (t.type === 'sluttavvirkning' || t.type === 'tynning') {
    const aarFrem = Math.max(0, (t.aar || IAAR) - IAAR);
    const v = framskriv([b], aarFrem, inn(), { folgPlan: false }).perBestand.get(b.id)[aarFrem].volumDaa * areal;
    const m3 = t.type === 'tynning' ? v * inn().tynningUttak : v;
    const netto = m3 * rotnettoPerM3(b.treslag, inn(), t.type === 'tynning');
    const brutto = m3 * (inn().pris[b.treslag] ?? inn().pris.G);
    return { m3, netto, skogfond: brutto * inn().skogfondProsent / 100 };
  }
  return { m3: 0, netto: -tiltakKostnad(t.type, areal, inn()), skogfond: 0 };
}

function tiltakRadHtml(t) {
  const b = t.bestand; const ok = tiltakOkonomi(t);
  const utfort = t.status === 'utfort';
  return `<div class="tiltak-rad ${utfort ? 'status-utfort' : ''} ${t.forslag ? 'forslag' : ''}" data-bestand="${b.id}" data-tiltak="${t.id || ''}">
    ${t.forslag ? `<button class="knapp liten primar" data-handling="godta" type="button">Legg til</button>` : `<input type="checkbox" data-handling="utfort" ${utfort ? 'checked' : ''} title="Marker som utført" aria-label="Utført">`}
    <div>
      <div class="tittel">${esc(TILTAKSTYPER[t.type]?.navn || t.type)} – bestand <a href="#" data-handling="vis">${esc(b.nr)}</a> <span class="hint">${t.aar}${utfort && t.utfortDato ? `, utført ${esc(t.utfortDato)}` : ''}</span></div>
      <div class="info">${fmt(b.areal, 1)} daa · ${b.treslag || ''}${b.bonitet ?? ''}${ok.m3 ? ` · ca. ${fmt(ok.m3)} m³` : ''} · ${ok.netto >= 0 ? 'netto' : 'kostnad'} ca. ${fmt(Math.abs(ok.netto))} kr${ok.skogfond ? ` · skogfond ${fmt(ok.skogfond)} kr` : ''}${t.kommentar ? ` · ${esc(t.kommentar)}` : ''}</div>
    </div>
    <div style="display:flex;gap:6px;align-items:center">${t.prioritet ? `<span class="prio prio-${t.prioritet}">P${t.prioritet}</span>` : ''}${t.forslag ? '' : '<button class="knapp liten" data-handling="slett-tiltak" type="button" title="Slett tiltak" aria-label="Slett">✕</button>'}</div>
  </div>`;
}

let forslag = [];
function tegnTiltak() {
  const status = $('#tiltakFilterStatus').value; const type = $('#tiltakFilterType').value;
  const liste = alleTiltak().filter((t) => (!status || (status === 'utfort' ? t.status === 'utfort' : t.status !== 'utfort')) && (!type || t.type === type))
    .sort((a, b) => a.aar - b.aar || (a.prioritet || 9) - (b.prioritet || 9) || sortNr(a.bestand.nr, b.bestand.nr));
  const perAar = new Map();
  for (const t of liste) { if (!perAar.has(t.aar)) perAar.set(t.aar, []); perAar.get(t.aar).push(t); }
  $('#tiltakListe').innerHTML = [...perAar].map(([aar, ts]) => {
    const ok = ts.map(tiltakOkonomi);
    const netto = ok.reduce((s, o) => s + o.netto, 0); const m3 = ok.reduce((s, o) => s + o.m3, 0); const fond = ok.reduce((s, o) => s + o.skogfond, 0);
    return `<div class="tiltak-aar"><h4>${aar}${aar < IAAR && status !== 'utfort' ? ' ⚠️ forfalt' : ''}<span>${m3 ? `${fmt(m3)} m³ · ` : ''}netto ${fmt(netto)} kr${fond ? ` · skogfond ${fmt(fond)} kr` : ''}</span></h4>${ts.map(tiltakRadHtml).join('')}</div>`;
  }).join('') || '<div class="tom">Ingen tiltak i utvalget.</div>';
  $('#forslagListe').innerHTML = forslag.length ? `<div class="kort"><div class="detalj-topp"><h3>Forslag (${forslag.length})</h3><div class="knapperad" style="margin:0"><button class="knapp liten primar" id="godtaAlle" type="button">Legg til alle</button><button class="knapp liten" id="forkastForslag" type="button">Forkast</button></div></div>${forslag.map(tiltakRadHtml).join('')}</div>` : '';
  const ga = $('#godtaAlle'); if (ga) ga.onclick = () => { forslag.forEach(godtaForslag); forslag = []; endret(); };
  const fk = $('#forkastForslag'); if (fk) fk.onclick = () => { forslag = []; tegnTiltak(); };
}

function godtaForslag(f) {
  const { bestand, forslag: _, ...t } = f;
  bestand.tiltak.push({ ...t, id: nyId('t'), status: 'planlagt' });
}

function lagForslag() {
  forslag = foreslaaForEiendom(S.bestand, inn(), IAAR).map(({ b, ...f }) => ({ ...f, id: nyId('f'), bestand: b, forslag: true }))
    .sort((a, b) => a.aar - b.aar || a.prioritet - b.prioritet);
  tegnTiltak();
  melding(forslag.length ? `${forslag.length} forslag basert på alder, bonitet, hogstklasse og treantall. Hogst er spredd over ${inn().hogstFordelingAar} år for jevn avvirkning.` : 'Ingen nye forslag – planen ser komplett ut.');
}

function handterTiltakKlikk(e) {
  const rad = e.target.closest('.tiltak-rad'); if (!rad) return;
  const b = finnBestand(rad.dataset.bestand); const h = e.target.dataset.handling;
  if (!b || !h) return;
  const t = b.tiltak.find((x) => x.id === rad.dataset.tiltak);
  if (h === 'vis') { e.preventDefault(); velgBestand(b.id); visFane('bestand'); return; }
  if (h === 'godta') { const f = forslag.find((x) => x.id === rad.dataset.tiltak); if (f) { godtaForslag(f); forslag = forslag.filter((x) => x !== f); endret(); } return; }
  if (!t) return;
  if (h === 'slett-tiltak') { b.tiltak = b.tiltak.filter((x) => x !== t); endret(); if (valgtId === b.id) visDetalj(); return; }
  if (h === 'utfort') {
    t.status = e.target.checked ? 'utfort' : 'planlagt';
    t.utfortDato = e.target.checked ? new Date().toISOString().slice(0, 10) : undefined;
    if (e.target.checked && t.type === 'sluttavvirkning' && confirm(`Oppdatere bestand ${b.nr} til hogstklasse I (alder 0, volum 0)?`)) {
      b.hogstklasse = 1; b.alder = 0; b.volumDaa = 0; b.treantall = null; b.hoyde = null;
    }
    if (e.target.checked && t.type === 'planting' && confirm(`Sette bestand ${b.nr} til hogstklasse II (ungskog) med alder 1?`)) { b.hogstklasse = 2; b.alder = 1; }
    endret(); if (valgtId === b.id) visDetalj();
  }
}

// ---------------------------------------------------------------- framskriving
function sikreFramskriving() {
  if (!frResultat) frResultat = framskriv(S.bestand, Number($('#frPeriode').value), inn(), { folgPlan: $('#frFolgPlan').checked, startAar: IAAR });
  return frResultat;
}

function tegnFramskriving() {
  const periode = Number($('#frPeriode').value);
  $('#frAar').max = periode;
  if (Number($('#frAar').value) > periode) $('#frAar').value = periode;
  $('#frAarTekst').textContent = IAAR + Number($('#frAar').value);
  const { aarRader } = sikreFramskriving();
  const x = aarRader.map((r) => r.aar);
  linje($('#frVolum'), { x, serier: [{ navn: 'Stående volum', verdier: aarRader.map((r) => r.staaende), farge: css('--ts-l') }], enhet: 'm³', markerX: IAAR + Number($('#frAar').value) });
  linje($('#frAvv'), {
    x, serier: [
      { navn: 'Tilvekst', verdier: aarRader.map((r) => r.tilvekst), farge: css('--ts-g') },
      { navn: 'Avvirkning', verdier: aarRader.map((r) => r.avvirkning), farge: css('--ts-f') },
    ], enhet: 'm³',
  });
  const steg = periode <= 10 ? 1 : 5;
  const vis = aarRader.filter((_, i) => i % steg === 0 || i === aarRader.length - 1);
  // Summer avvirkning/inntekt for perioden fram til hver rad.
  let forrige = 0;
  const rader = vis.map((r) => {
    const i = aarRader.indexOf(r);
    const del = aarRader.slice(forrige === 0 && i === 0 ? 0 : forrige + 1, i + 1); forrige = i;
    return { ...r, sumAvv: del.reduce((s, x) => s + x.avvirkning, 0), sumNetto: del.reduce((s, x) => s + x.inntekt - x.kostnad, 0), sumCo2: del.reduce((s, x) => s + x.co2, 0) };
  });
  $('#frTabell').innerHTML = `<thead><tr><th>År</th><th class="tall">Stående m³</th><th class="tall">Tilvekst m³/år</th><th class="tall">Avvirket m³</th><th class="tall">Netto kr</th><th class="tall">CO₂ t</th></tr></thead>
    <tbody>${rader.map((r) => `<tr><td>${r.aar}</td><td class="tall">${fmt(r.staaende)}</td><td class="tall">${fmt(r.tilvekst)}</td><td class="tall">${fmt(r.sumAvv)}</td><td class="tall">${fmt(r.sumNetto)}</td><td class="tall">${fmt(r.sumCo2)}</td></tr>`).join('')}</tbody>`;
  if ($('#fargeEtter').value === 'framskrevet') oppdaterStiler();
}

// ---------------------------------------------------------------- felt (GPS + registreringer)
let gpsWatch = null; let sistePos = null;
function startGps() {
  if (!navigator.geolocation) { melding('Enheten støtter ikke GPS i nettleseren.'); return; }
  if (gpsWatch !== null) { navigator.geolocation.clearWatch(gpsWatch); gpsWatch = null; $('#gpsBtn').textContent = 'Start GPS'; $('#gpsStatus').textContent = 'GPS er av.'; return; }
  $('#gpsBtn').textContent = 'Stopp GPS';
  $('#gpsStatus').textContent = 'Venter på posisjon …';
  let forste = true;
  gpsWatch = navigator.geolocation.watchPosition((p) => {
    const ll = [p.coords.latitude, p.coords.longitude];
    sistePos = { lat: ll[0], lon: ll[1], noyaktighet: p.coords.accuracy };
    if (!gpsMarkor) {
      gpsMarkor = L.circleMarker(ll, { radius: 7, color: '#fff', weight: 2, fillColor: '#2a78d6', fillOpacity: 1 }).addTo(kart);
      gpsSirkel = L.circle(ll, { radius: p.coords.accuracy, color: '#2a78d6', weight: 1, fillOpacity: 0.08 }).addTo(kart);
    } else { gpsMarkor.setLatLng(ll); gpsSirkel.setLatLng(ll).setRadius(p.coords.accuracy); }
    if (forste) { kart.setView(ll, Math.max(kart.getZoom(), 15)); forste = false; }
    $('#gpsStatus').textContent = `Posisjon ${ll[0].toFixed(5)}, ${ll[1].toFixed(5)} (±${Math.round(p.coords.accuracy)} m)`;
    const b = S.bestand.find((x) => punktIGeometri([ll[1], ll[0]], x.geometri));
    $('#gpsBestand').innerHTML = b ? `<p>Du står i <b>bestand ${esc(b.nr)}</b>: ${TRESLAG[b.treslag] || ''} ${b.bonitet ? `bonitet ${b.bonitet}` : ''}, HK ${HK_ROMERTALL[hk(b)] || '?'}, ${b.alder ?? '?'} år, ${fmt(startTilstand(b).volumDaa, 1)} m³/daa. <a href="#" data-vis="${b.id}">Åpne</a></p>` : '<p class="hint">Du er utenfor registrerte bestand.</p>';
  }, (err) => { $('#gpsStatus').textContent = `GPS-feil: ${err.message}`; }, { enableHighAccuracy: true, maximumAge: 5000 });
}

function skalerBilde(fil, maks = 1280) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const f = Math.min(1, maks / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(fil);
  });
}

async function lagreRegistrering(e) {
  e.preventDefault();
  const d = new FormData(e.target);
  const pos = sistePos ? [sistePos.lat, sistePos.lon] : valgtPunkt ? [valgtPunkt.getLatLng().lat, valgtPunkt.getLatLng().lng] : null;
  if (!pos) { melding('Mangler posisjon: slå på GPS eller klikk i kartet.'); return; }
  const fil = d.get('bilde');
  let bilde = null;
  if (fil && fil.size) { try { bilde = await skalerBilde(fil); } catch { melding('Kunne ikke lese bildet.'); } }
  const b = S.bestand.find((x) => punktIGeometri([pos[1], pos[0]], x.geometri));
  S.registreringer.unshift({ id: nyId('r'), dato: new Date().toISOString(), kategori: d.get('kategori'), tekst: d.get('tekst'), lat: pos[0], lon: pos[1], bestandId: b?.id || null, bilde });
  e.target.reset();
  endret({ kart: false }); tegnRegistreringer();
  melding('Registrering lagret.');
}

function tegnRegistreringer() {
  regLag.clearLayers();
  for (const r of S.registreringer) {
    L.circleMarker([r.lat, r.lon], { radius: 6, color: '#fff', weight: 2, fillColor: '#e34948', fillOpacity: 1 })
      .bindPopup(`<b>${esc(r.kategori)}</b><br>${esc(r.tekst)}<br><small>${new Date(r.dato).toLocaleString('nb-NO')}</small>${r.bilde ? `<br><img src="${r.bilde}" style="max-width:200px;border-radius:6px;margin-top:4px">` : ''}`)
      .addTo(regLag);
  }
  $('#regListe').innerHTML = S.registreringer.map((r) => {
    const b = r.bestandId ? finnBestand(r.bestandId) : null;
    return `<div class="reg" data-id="${r.id}">
      ${r.bilde ? `<img src="${r.bilde}" alt="">` : '<div class="ingen-bilde">📍</div>'}
      <div><b>${esc(r.kategori)}</b>${b ? ` · bestand ${esc(b.nr)}` : ''}<div>${esc(r.tekst)}</div><div class="hint">${new Date(r.dato).toLocaleString('nb-NO')}</div></div>
      <div style="display:flex;flex-direction:column;gap:4px"><button class="knapp liten" data-reg="vis" type="button">Vis</button><button class="knapp liten fare" data-reg="slett" type="button">Slett</button></div>
    </div>`;
  }).join('') || '<div class="tom">Ingen registreringer ennå.</div>';
}

// ---------------------------------------------------------------- import / eksport
async function importerFiler(filer) {
  const ut = [];
  let samlet = S.bestand;
  for (const fil of filer) {
    try {
      const r = await lesFil(fil, $('#impKoord').value, IAAR);
      const modus = ut.length ? 'flett' : $('#impModus').value;
      const res = slaaSammen(samlet, r.bestand, modus);
      samlet = res.liste;
      ut.push(`<div>✅ <b>${esc(fil.name)}</b>: ${r.bestand.length} bestand lest${r.koordsys ? ` (${r.koordsys})` : ''} – ${res.lagtTil} nye, ${res.oppdatert} oppdatert${r.hoppetOver ? `, ${r.hoppetOver} objekter uten flate hoppet over` : ''}.</div>`);
      for (const a of (r.advarsler || []).slice(0, 5)) ut.push(`<div class="hint">⚠️ ${esc(a)}</div>`);
    } catch (e) {
      ut.push(`<div>❌ <b>${esc(fil.name)}</b>: ${esc(e.message)}</div>`);
    }
  }
  S.bestand = samlet;
  $('#impResultat').innerHTML = ut.join('');
  endret({ kart: true, zoom: true });
}

function bestandTilFeature(b, koordsys = 'WGS84') {
  const s = startTilstand(b);
  return {
    type: 'Feature',
    geometry: b.geometri ? fraWgs84(b.geometri, koordsys) : null,
    properties: {
      BESTANDNR: b.nr, TEIG: b.teig || null, AREAL_DAA: b.areal, TRESLAG: b.treslag, BONITET: b.bonitet, HOGSTKLASSE: hk(b),
      ALDER: b.alder ?? null, VOLUM_DAA: b.volumDaa ?? runde(s.volumDaa, 1), VOLUM_M3: runde(s.volumDaa * (b.areal || 0), 0),
      TREANTALL: b.treantall ?? null, MIDDELHOYDE: b.hoyde ?? null, MILJOFIGUR: b.miljo ? 'Ja' : null, MERKNAD: b.merknad || null,
      TILTAK: (b.tiltak || []).filter((t) => t.status !== 'utfort').map((t) => `${TILTAKSTYPER[t.type]?.navn || t.type} ${t.aar}`).join('; ') || null,
      ...b.ekstra,
    },
  };
}

function csvRad(verdier) { return verdier.map((v) => { const s = v === null || v === undefined ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';'); }

function eksporter(type) {
  if (type === 'backup') return lastNed(filnavn('json'), JSON.stringify({ ...S, eksportert: new Date().toISOString() }), 'application/json');
  if (type === 'geojson') return lastNed(filnavn('geojson'), JSON.stringify({ type: 'FeatureCollection', features: S.bestand.filter((b) => b.geometri).map((b) => bestandTilFeature(b)) }), 'application/geo+json');
  if (type === 'sosi32' || type === 'sosi33') {
    const ks = type === 'sosi32' ? 'UTM32' : 'UTM33';
    return lastNed(filnavn('sos'), lagSosi(S.bestand.filter((b) => b.geometri).map((b) => bestandTilFeature(b, ks)), ks), 'text/plain');
  }
  if (type === 'csv') {
    const f = S.bestand.map((b) => bestandTilFeature(b).properties);
    const kol = ['BESTANDNR', 'TEIG', 'AREAL_DAA', 'TRESLAG', 'BONITET', 'HOGSTKLASSE', 'ALDER', 'VOLUM_DAA', 'VOLUM_M3', 'TREANTALL', 'MIDDELHOYDE', 'MILJOFIGUR', 'TILTAK', 'MERKNAD'];
    return lastNed(filnavn('csv'), `﻿${[kol.join(';'), ...f.map((p) => csvRad(kol.map((k) => p[k])))].join('\n')}`, 'text/csv');
  }
  if (type === 'tiltakcsv') {
    const kol = ['År', 'Bestand', 'Tiltak', 'Status', 'Prioritet', 'Areal daa', 'Volum m3', 'Netto kr', 'Skogfond kr', 'Kommentar'];
    const rader = alleTiltak().sort((a, b) => a.aar - b.aar).map((t) => { const o = tiltakOkonomi(t); return csvRad([t.aar, t.bestand.nr, TILTAKSTYPER[t.type]?.navn, t.status, t.prioritet, t.bestand.areal, runde(o.m3), runde(o.netto), runde(o.skogfond), t.kommentar]); });
    return lastNed(filnavn('tiltak.csv'), `﻿${[kol.join(';'), ...rader].join('\n')}`, 'text/csv');
  }
  if (type === 'rapport') return skrivRapport();
}

function skrivRapport() {
  const s = sammendrag(S.bestand, inn());
  const e = S.eiendom;
  const tiltak = alleTiltak().filter((t) => t.status !== 'utfort').sort((a, b) => a.aar - b.aar);
  $('#rapport').innerHTML = `
    <h1>Skogbruksplan – ${esc(e.navn || 'eiendom')}</h1>
    <div>${esc(e.eier)} ${e.kommune ? `· ${esc(e.kommune)} kommune` : ''} ${e.gnrbnr ? `· gnr/bnr ${esc(e.gnrbnr)}` : ''} · takstår ${esc(e.takstAar)} · utskrevet ${new Date().toLocaleDateString('nb-NO')}</div>
    <h2>Sammendrag</h2>
    <table><tr><td>Produktivt areal</td><td class="tall">${fmt(s.areal)} daa</td><td>Stående volum</td><td class="tall">${fmt(s.volum)} m³</td></tr>
    <tr><td>Tilvekst</td><td class="tall">${fmt(s.tilvekst)} m³/år</td><td>Rotnetto hogstmoden skog</td><td class="tall">${fmt(s.verdiHogstmoden)} kr</td></tr></table>
    <h2>Areal per hogstklasse (daa)</h2>
    <table><tr><th>HK</th>${Object.values(TRESLAG).map((t) => `<th class="tall">${t}</th>`).join('')}<th class="tall">Sum</th></tr>
    ${HOGSTKLASSER.map((h) => `<tr><td>${HK_NAVN[h]}</td>${Object.keys(TRESLAG).map((k) => `<td class="tall">${fmt(s.perHk[h][k], 1)}</td>`).join('')}<td class="tall">${fmt(Object.values(s.perHk[h]).reduce((a, b) => a + b, 0), 1)}</td></tr>`).join('')}</table>
    <h2>Tiltaksplan</h2>
    <table><tr><th>År</th><th>Bestand</th><th>Tiltak</th><th class="tall">Daa</th><th class="tall">m³</th><th class="tall">Netto kr</th><th>Merknad</th></tr>
    ${tiltak.map((t) => { const o = tiltakOkonomi(t); return `<tr><td>${t.aar}</td><td>${esc(t.bestand.nr)}</td><td>${esc(TILTAKSTYPER[t.type]?.navn)}</td><td class="tall">${fmt(t.bestand.areal, 1)}</td><td class="tall">${o.m3 ? fmt(o.m3) : ''}</td><td class="tall">${fmt(o.netto)}</td><td>${esc(t.kommentar)}</td></tr>`; }).join('')}</table>
    <h2>Bestandsliste</h2>
    <table><tr><th>Nr</th><th class="tall">Daa</th><th>Treslag</th><th class="tall">Bon</th><th>HK</th><th class="tall">Alder</th><th class="tall">m³/daa</th><th class="tall">m³</th><th>Merknad</th></tr>
    ${[...S.bestand].sort((a, b) => sortNr(a.nr, b.nr)).map((b) => { const st = startTilstand(b); return `<tr><td>${esc(b.nr)}</td><td class="tall">${fmt(b.areal, 1)}</td><td>${TRESLAG[b.treslag] || ''}</td><td class="tall">${b.bonitet ?? ''}</td><td>${HK_ROMERTALL[hk(b)] || ''}</td><td class="tall">${b.alder ?? ''}</td><td class="tall">${fmt(st.volumDaa, 1)}</td><td class="tall">${fmt(st.volumDaa * (b.areal || 0))}</td><td>${esc(b.merknad)}</td></tr>`; }).join('')}</table>
    <p style="font-size:9pt;color:#555">Volum- og verdiberegninger er forenklede estimater basert på registrerte data og innstilte priser.</p>`;
  window.print();
}

async function lastNedOfflineKart() {
  const bb = bbox(S.bestand.map((b) => b.geometri));
  if (!bb) { melding('Ingen bestand med kart å laste ned for.'); return; }
  if (!('caches' in window)) { melding('Nettleseren støtter ikke offline-lagring.'); return; }
  const pad = 0.004;
  const [minx, miny, maxx, maxy] = [bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad];
  const tx = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
  const ty = (lat, z) => Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z);
  const urler = [];
  for (let z = 10; z <= 17; z++) {
    for (let x = tx(minx, z); x <= tx(maxx, z); x++) {
      for (let y = ty(maxy, z); y <= ty(miny, z); y++) {
        for (const lag of ['topo', 'topograatone']) urler.push(`https://cache.kartverket.no/v1/wmts/1.0.0/${lag}/default/webmercator/${z}/${y}/${x}.png`);
      }
    }
  }
  if (urler.length > 6000 && !confirm(`Dette er ${urler.length} kartfliser. Fortsette?`)) return;
  const cache = await caches.open('kartfliser-v1');
  let ferdig = 0; let feil = 0;
  const status = $('#offlineStatus');
  const arbeider = async () => {
    while (urler.length) {
      const u = urler.pop();
      try {
        if (!(await cache.match(u))) { const r = await fetch(u, { mode: 'cors' }); if (r.ok) await cache.put(u, r); else feil++; }
      } catch { feil++; }
      ferdig++;
      if (ferdig % 25 === 0) status.textContent = `${ferdig} fliser lastet …`;
    }
  };
  status.textContent = 'Starter …';
  await Promise.all(Array.from({ length: 6 }, arbeider));
  status.textContent = `Ferdig: ${ferdig - feil} fliser lagret${feil ? `, ${feil} feilet` : ''}. Topografisk kart virker nå offline for eiendommen (zoom 10–17).`;
}

// ---------------------------------------------------------------- innstillinger og eiendom
function tegnInnstillinger() {
  const i = inn();
  const felt = (navn, etikett, verdi, steg = 1) => `<label>${etikett}<input type="number" step="${steg}" data-sti="${navn}" value="${verdi}"></label>`;
  $('#innstSkjema').innerHTML = [
    ...Object.entries(TRESLAG).map(([k, v]) => felt(`pris.${k}`, `Tømmerpris ${v.toLowerCase()} (kr/m³)`, i.pris[k])),
    ...Object.entries(TRESLAG).map(([k, v]) => felt(`drift.${k}`, `Driftskostnad ${v.toLowerCase()} (kr/m³)`, i.drift[k])),
    felt('driftTynning', 'Driftskostnad tynning (kr/m³)', i.driftTynning),
    felt('tynningUttak', 'Uttak i tynning (andel)', i.tynningUttak, 0.05),
    felt('skogfondProsent', 'Skogfond (% av brutto, 4–40)', i.skogfondProsent),
    felt('co2PerM3', 'CO₂ per m³ tilvekst (tonn)', i.co2PerM3, 0.1),
    felt('hogstFordelingAar', 'Spre foreslått hogst over (år)', i.hogstFordelingAar ?? 10),
    ...Object.entries(i.kostPerDaa).map(([k, v]) => felt(`kostPerDaa.${k}`, `${TILTAKSTYPER[k]?.navn || k} (kr/daa)`, v)),
  ].join('');
  $('#hogstalderTabell').innerHTML = `<table class="tabell"><thead><tr><th>Bonitet</th>${Object.values(TRESLAG).map((t) => `<th>${t}</th>`).join('')}</tr></thead><tbody>
    ${BONITETER.map((bo) => `<tr><td>${bo}</td>${Object.keys(TRESLAG).map((k) => `<td><input type="number" data-sti="hogstalder.${k}.${bo}" value="${i.hogstalder[k][bo]}" style="width:70px"></td>`).join('')}</tr>`).join('')}
    </tbody></table><p class="hint">Veiledende verdier. Kontroller mot gjeldende forskrift om bærekraftig skogbruk.</p>`;
}
function settSti(obj, sti, verdi) {
  const deler = sti.split('.'); let o = obj;
  for (const d of deler.slice(0, -1)) o = o[d];
  o[deler.at(-1)] = verdi;
}

function tegnEiendom() {
  const f = $('#eiendomSkjema');
  for (const [k, v] of Object.entries(S.eiendom)) if (f.elements[k]) f.elements[k].value = v ?? '';
  $('#eiendomNavn').textContent = S.eiendom.navn || 'Skogbruksplan';
  document.title = S.eiendom.navn ? `${S.eiendom.navn} – Skogbruksplan` : 'Skogbruksplan';
}

// ---------------------------------------------------------------- oppdatering
function endret({ kart: kartEndret = false, zoom = false } = {}) {
  frResultat = null;
  lagreSnart();
  if (kartEndret) tegnBestandKart(zoom); else oppdaterStiler();
  tegnOversikt();
  tegnBestandTabell();
  tegnTiltak();
  if (!$('#fane-framskriving').hidden) tegnFramskriving();
  if (valgtId && !finnBestand(valgtId)) { valgtId = null; visDetalj(); }
}

function lastDemo() {
  if (S.bestand.length && !confirm('Erstatte dagens data med demo-eiendommen?')) return;
  const d = lagDemo(IAAR);
  S.eiendom = { ...S.eiendom, ...d.eiendom }; S.bestand = d.bestand; S.registreringer = [];
  valgtId = null; forslag = [];
  tegnEiendom(); tegnRegistreringer();
  endret({ kart: true, zoom: true });
  melding('Demo-eiendom lastet. Prøv «Foreslå tiltak» og Framskriving!');
}

// ---------------------------------------------------------------- oppkobling
function kobleHendelser() {
  $$('.faner button').forEach((b) => b.addEventListener('click', () => visFane(b.dataset.fane)));
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-gaa]'); if (g) { e.preventDefault(); visFane(g.dataset.gaa); }
    const v = e.target.closest('[data-vis]'); if (v) { e.preventDefault(); velgBestand(v.dataset.vis); visFane('bestand'); }
  });
  $('#fargeEtter').addEventListener('change', () => { if ($('#fargeEtter').value === 'framskrevet') visFane('framskriving'); oppdaterStiler(); });
  $('#kartLegend').addEventListener('click', (e) => { if (e.target.closest('.legend-knapp')) { legendLukket = !legendLukket; tegnLegend(); } });
  L.DomEvent.disableClickPropagation($('#kartLegend'));
  L.DomEvent.disableClickPropagation($('.kartverktoy'));
  L.DomEvent.disableClickPropagation($('#tegnHjelp'));
  $('#tegnBtn').addEventListener('click', startTegning);
  $('#tegnFerdig').addEventListener('click', fullforTegning);
  $('#tegnAvbryt').addEventListener('click', stoppTegning);
  $('#posBtn').addEventListener('click', () => { visFane('felt'); if (gpsWatch === null) startGps(); });

  $('#bestandFilterHk').innerHTML += HOGSTKLASSER.map((h) => `<option value="${h}">HK ${HK_ROMERTALL[h]}</option>`).join('');
  $('#bestandFilterTs').innerHTML += Object.entries(TRESLAG).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  ['#bestandSok', '#bestandFilterHk', '#bestandFilterTs'].forEach((s) => $(s).addEventListener('input', tegnBestandTabell));
  $('#bestandTabell thead').addEventListener('click', (e) => {
    const f = e.target.dataset.sort; if (!f) return;
    sortering = { felt: f, retning: sortering.felt === f ? -sortering.retning : 1 };
    tegnBestandTabell();
  });
  $('#bestandTabell tbody').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) velgBestand(tr.dataset.id); });

  $('#tiltakFilterType').innerHTML += Object.entries(TILTAKSTYPER).map(([k, v]) => `<option value="${k}">${v.navn}</option>`).join('');
  ['#tiltakFilterStatus', '#tiltakFilterType'].forEach((s) => $(s).addEventListener('change', tegnTiltak));
  $('#foreslaBtn').addEventListener('click', lagForslag);
  ['#tiltakListe', '#forslagListe', '#nesteTiltak', '#bestandDetalj'].forEach((s) => $(s).addEventListener('click', handterTiltakKlikk));

  $('#frPeriode').addEventListener('change', () => { frResultat = null; tegnFramskriving(); });
  $('#frFolgPlan').addEventListener('change', () => { frResultat = null; tegnFramskriving(); });
  $('#frAar').addEventListener('input', () => {
    if ($('#fargeEtter').value !== 'framskrevet') $('#fargeEtter').value = 'framskrevet';
    tegnFramskriving();
  });

  $('#gpsBtn').addEventListener('click', startGps);
  $('#regSkjema').addEventListener('submit', lagreRegistrering);
  $('#regListe').addEventListener('click', (e) => {
    const rad = e.target.closest('.reg'); const h = e.target.dataset.reg; if (!rad || !h) return;
    const r = S.registreringer.find((x) => x.id === rad.dataset.id);
    if (h === 'vis') kart.setView([r.lat, r.lon], 17);
    if (h === 'slett' && confirm('Slette registreringen?')) { S.registreringer = S.registreringer.filter((x) => x !== r); lagreSnart(); tegnRegistreringer(); }
  });

  $('#eiendomSkjema').addEventListener('input', (e) => {
    const f = e.target; S.eiendom[f.name] = f.type === 'number' ? Number(f.value) : f.value;
    tegnEiendom(); lagreSnart();
  });
  const sone = $('#slippSone');
  sone.addEventListener('dragover', (e) => { e.preventDefault(); sone.classList.add('over'); });
  sone.addEventListener('dragleave', () => sone.classList.remove('over'));
  sone.addEventListener('drop', (e) => { e.preventDefault(); sone.classList.remove('over'); importerFiler([...e.dataTransfer.files]); });
  $('#impFil').addEventListener('change', (e) => { importerFiler([...e.target.files]); e.target.value = ''; });
  $$('[data-eksport]').forEach((b) => b.addEventListener('click', () => eksporter(b.dataset.eksport)));
  $('#gjenopprettFil').addEventListener('change', async (e) => {
    const fil = e.target.files[0]; if (!fil) return;
    try {
      const data = JSON.parse(await fil.text());
      if (!Array.isArray(data.bestand)) throw new Error('Filen er ikke en sikkerhetskopi fra denne appen.');
      if (S.bestand.length && !confirm('Erstatte alle data med sikkerhetskopien?')) return;
      S = { ...S, ...data, innstillinger: { ...klon(STANDARD_INNSTILLINGER), ...data.innstillinger } };
      valgtId = null; tegnEiendom(); tegnInnstillinger(); tegnRegistreringer(); endret({ kart: true, zoom: true });
      melding('Sikkerhetskopi gjenopprettet.');
    } catch (err) { melding(`Kunne ikke lese filen: ${err.message}`); }
    e.target.value = '';
  });
  $('#demoBtn').addEventListener('click', lastDemo);
  $('#slettAltBtn').addEventListener('click', () => {
    if (!confirm('Slette alle bestand, tiltak og registreringer? Ta gjerne en sikkerhetskopi først.')) return;
    S.bestand = []; S.registreringer = []; valgtId = null; forslag = [];
    tegnRegistreringer(); endret({ kart: true });
  });
  $('#offlineBtn').addEventListener('click', lastNedOfflineKart);
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { tegnOversikt(); if (!$('#fane-framskriving').hidden) tegnFramskriving(); }, 200);
  });
  $('#innstSkjema').addEventListener('change', (e) => { settSti(S.innstillinger, e.target.dataset.sti, Number(e.target.value)); endret(); if (valgtId) visDetalj(); });
  $('#hogstalderTabell').addEventListener('change', (e) => { settSti(S.innstillinger, e.target.dataset.sti, Number(e.target.value)); endret(); if (valgtId) visDetalj(); });
  $('#innstNullstill').addEventListener('click', () => { S.innstillinger = klon(STANDARD_INNSTILLINGER); tegnInnstillinger(); endret(); });
}

async function start() {
  initKart();
  kobleHendelser();
  const lagret = await hent();
  if (lagret) S = { ...S, ...lagret, innstillinger: { ...klon(STANDARD_INNSTILLINGER), ...lagret.innstillinger } };
  tegnEiendom(); tegnInnstillinger(); tegnRegistreringer();
  endret({ kart: true, zoom: true });
  if (!lagret) lagreSnart();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

start();
