import { punktIPolygon, avstandTilGrense, avstandM, retning, himmelretning, utmTekst, bbox, fliserFor, gpx } from './geo.js';
import { TYPER, STRUKTUR, ALDER, KJONN, ATFERD, RETNINGER, antallDyr, flytt, jaktaar, oppsummering, oppsummeringTekst, csv } from './registrering.js';
import { BAKGRUNNER, WMS, flisUrl, wmsUrl, teigI, teigNavn, hoydeI, kommunenavn, lesFil, VALD_NORDFJELLA, valdTekst, gyldigValdnr, hentVald, valdFraEgenskaper } from './kilder.js';

const $ = (s, r = document) => r.querySelector(s);
const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lagre = {
  hent(k, std) { try { return JSON.parse(localStorage.getItem(`nfv.${k}`)) ?? std; } catch { return std; } },
  sett(k, v) { try { localStorage.setItem(`nfv.${k}`, JSON.stringify(v)); return true; } catch { melding('Fikk ikke lagret på telefonen (lagringen er full eller privat modus).'); return false; } },
};
const avstand = (m) => (m < 1000 ? `${Math.round(m / 10) * 10 || Math.round(m)} m` : `${(m / 1000).toLocaleString('nb-NO', { maximumFractionDigits: m < 10000 ? 1 : 0 })} km`);
const tid = (t) => new Date(t).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const NOYAKTIG_TEKST = { god: 'god', middels: 'middels', lav: 'lav – grensa kan avvike mye i terrenget', ukjent: 'ukjent' };
const FLISCACHE = 'nfv-fliser-v1';

let melderTimer;
function melding(tekst, ms = 3500) {
  const el = $('#melding');
  el.textContent = tekst; el.hidden = false;
  clearTimeout(melderTimer); melderTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// ---------- Data ----------

const omraade = await fetch('data/nordfjella.geojson').then((r) => r.json());
const omraadeInfo = omraade.features[0].properties;
const [v, s, ø, n] = bbox(omraade);
const omraadeGrenser = L.latLngBounds([s, v], [n, ø]);

let grunner = lagre.hent('grunner', []); // mine jaktgrunner (teiger med geometri)
let teigcache = lagre.hent('teigcache', []); // nylig oppslåtte teiger, for oppslag uten nett
let punkter = lagre.hent('punkter', []);
let importert = lagre.hent('import', []);
let mal = lagre.hent('mal', null);
let valdliste = lagre.hent('valdliste', VALD_NORDFJELLA);
let sisteVald = lagre.hent('sisteVald', null);
const synlig = lagre.hent('synlig', { grense: true, skygge: true, eiendom: true, teig: true, grunner: true, punkter: true, trekk: false, kalving: false });

// ---------- Kart ----------

const kart = L.map('kart', { zoomControl: false, attributionControl: true, tap: false, maxZoom: 18, minZoom: 5 });
L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(kart);
kart.attributionControl.setPrefix('');
const startvisning = lagre.hent('visning', null);
if (startvisning) kart.setView(startvisning.c, startvisning.z); else kart.fitBounds(omraadeGrenser, { padding: [10, 10] });
kart.on('moveend', () => lagre.sett('visning', { c: kart.getCenter(), z: kart.getZoom() }));

kart.createPane('overleggfliser').style.zIndex = 350;
kart.createPane('skygge').style.zIndex = 380;
kart.createPane('grenser').style.zIndex = 420;

const bakgrunnslag = {};
for (const [id, b] of Object.entries(BAKGRUNNER)) {
  bakgrunnslag[id] = L.tileLayer(b.url, { maxZoom: 18, maxNativeZoom: b.maks, attribution: b.attr, crossOrigin: true });
}
let aktivBakgrunn = BAKGRUNNER[lagre.hent('bakgrunn', 'topo')] ? lagre.hent('bakgrunn', 'topo') : 'topo';
bakgrunnslag[aktivBakgrunn].addTo(kart);

const WmsFliser = L.TileLayer.extend({ getTileUrl(c) { return wmsUrl(this.options.wms, c.z, c.x, c.y); } });
const wmsLag = {};
for (const [id, w] of Object.entries(WMS)) {
  wmsLag[id] = new WmsFliser('', { wms: w, pane: 'overleggfliser', minZoom: w.minZoom, maxZoom: 18, opacity: w.opasitet ?? 1, attribution: w.attr, crossOrigin: true });
}

// Grensa for villreinområdet som vektor (følger med appen, virker alltid uten nett).
const grenseStil = { color: '#b91c1c', weight: 3.5, opacity: 0.95, fill: false, pane: 'grenser', interactive: false };
// Kanten lages først så den tegnes under den røde linja (en lagruppe tegner i opprettelsesrekkefølge).
const grenseHalo = L.geoJSON(omraade, { style: () => ({ ...grenseStil, color: '#fff', weight: 8, opacity: 0.7 }) });
const grenseLag = L.geoJSON(omraade, { style: () => grenseStil });
const grenseGruppe = L.layerGroup([grenseHalo, grenseLag]);

// Skygge over alt utenfor området, så det er lett å se hvor grensa går.
const verden = [[-89, -179], [-89, 179], [89, 179], [89, -179]];
const ringer = omraade.features[0].geometry.coordinates.map((r) => r.map(([x, y]) => [y, x]));
const skyggeLag = L.polygon([verden, ...ringer], { pane: 'skygge', stroke: false, fillColor: '#2a1a12', fillOpacity: 0.32, interactive: false });

const grunnLag = L.layerGroup();
const punktLag = L.layerGroup();
const importLag = L.layerGroup();
const valgtLag = L.layerGroup().addTo(kart);
const malLag = L.layerGroup().addTo(kart);

const OVERLEGG = [
  { id: 'grense', navn: 'Grense for villreinområdet', info: 'Miljødirektoratet', lag: grenseGruppe, farge: '#b91c1c' },
  { id: 'skygge', navn: 'Skygg utenfor området', lag: skyggeLag, farge: '#6b4f3f' },
  { id: 'eiendom', navn: 'Eiendomsgrenser', info: 'Kartverket, fra zoom 14', lag: wmsLag.eiendom, farge: '#e11d48' },
  { id: 'teig', navn: 'Gårds- og bruksnummer', info: 'Vises helt innzoomet', lag: wmsLag.teig },
  { id: 'grunner', navn: 'Mine jaktgrunner', lag: grunnLag, farge: '#16a34a' },
  { id: 'punkter', navn: 'Mine punkter', lag: punktLag },
  { id: 'trekk', navn: 'Trekkområder for villrein', info: 'Miljødirektoratet', lag: wmsLag.trekk },
  { id: 'kalving', navn: 'Kalvingsområder', info: 'Miljødirektoratet', lag: wmsLag.kalving },
];

function brukSynlighet() {
  for (const o of OVERLEGG) {
    if (synlig[o.id] && !kart.hasLayer(o.lag)) o.lag.addTo(kart);
    if (!synlig[o.id] && kart.hasLayer(o.lag)) kart.removeLayer(o.lag);
  }
  const vis = importert.some((i) => i.synlig !== false);
  if (vis && !kart.hasLayer(importLag)) importLag.addTo(kart);
}

function tegnLagvalg() {
  $('#bakgrunner').innerHTML = Object.entries(BAKGRUNNER).map(([id, b]) => `
    <label><input type="radio" name="bakgrunn" value="${id}" ${id === aktivBakgrunn ? 'checked' : ''}>
      <span class="info">${h(b.navn)}${b.offline ? '' : '<small>Krever nett</small>'}</span></label>`).join('');
  $('#overlegg').innerHTML = OVERLEGG.map((o) => `
    <label><input type="checkbox" data-lag="${o.id}" ${synlig[o.id] ? 'checked' : ''}>
      <span class="info">${h(o.navn)}${o.info ? `<small>${h(o.info)}</small>` : ''}</span>${o.farge ? `<i class="farge" style="background:${o.farge}"></i>` : ''}</label>`).join('')
    + importert.map((i) => `
    <label><input type="checkbox" data-import="${h(i.id)}" ${i.synlig !== false ? 'checked' : ''}>
      <span class="info">${h(i.navn)}<small>Egen fil</small></span><i class="farge" style="background:${h(i.farge)}"></i></label>`).join('');
}
$('#bakgrunner').addEventListener('change', (e) => {
  kart.removeLayer(bakgrunnslag[aktivBakgrunn]);
  aktivBakgrunn = e.target.value; lagre.sett('bakgrunn', aktivBakgrunn);
  bakgrunnslag[aktivBakgrunn].addTo(kart);
  tegnOffline();
});
$('#overlegg').addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.lag) { synlig[t.dataset.lag] = t.checked; lagre.sett('synlig', synlig); brukSynlighet(); }
  if (t.dataset.import) { const i = importert.find((x) => x.id === t.dataset.import); if (i) { i.synlig = t.checked; lagre.sett('import', importert); tegnImport(); } }
});

// ---------- Ark og meny ----------

const ark = ['punkt', 'lagvalg', 'meny'];
function visArk(id) { for (const a of ark) $(`#${a}`).hidden = a !== id; }
function lukkArk(id) { $(`#${id}`).hidden = true; if (id === 'punkt') valgtLag.clearLayers(); }
document.addEventListener('click', (e) => { const l = e.target.closest('[data-lukk]'); if (l) lukkArk(l.dataset.lukk); });
$('#b-lag').addEventListener('click', () => { tegnLagvalg(); visArk('lagvalg'); });
$('#b-meny').addEventListener('click', () => { tegnMeny(); visArk('meny'); });
$('#b-omraade').addEventListener('click', () => kart.fitBounds(omraadeGrenser, { padding: [10, 10] }));
$('#status-handtak').addEventListener('click', () => { $('#status').classList.toggle('lukket'); maalStatus(); });

document.querySelector('.faner').addEventListener('click', (e) => {
  const b = e.target.closest('[data-fane]'); if (!b) return;
  for (const f of document.querySelectorAll('.faner [data-fane]')) {
    f.setAttribute('aria-selected', String(f === b));
    $(`#${f.dataset.fane}`).hidden = f !== b;
  }
  if (b.dataset.fane === 'f-offline') tegnOffline();
  if (b.dataset.fane === 'f-rein') tegnRein();
});

function maalStatus() {
  document.documentElement.style.setProperty('--status-h', `${$('#status').offsetHeight}px`);
}
new ResizeObserver(maalStatus).observe($('#status'));

// ---------- Eiendomsoppslag ----------

// Finner teigen i punktet: først blant lagrede jaktgrunner og nylig oppslåtte teiger (virker uten nett), så hos Kartverket.
function teigLokalt(p) {
  return grunner.find((g) => punktIPolygon(p, g.geometri)) || teigcache.find((g) => punktIPolygon(p, g.geometri)) || null;
}
async function finnTeig(p) {
  const lokal = teigLokalt(p);
  if (lokal) return lokal;
  const t = await teigI(p);
  if (t) {
    teigcache = [t, ...teigcache.filter((x) => x.id !== t.id)].slice(0, 60);
    if (!lagre.sett('teigcache', teigcache)) { teigcache = teigcache.slice(0, 10); lagre.sett('teigcache', teigcache); }
  }
  return t;
}
const erGrunn = (t) => !!t && grunner.some((g) => g.id === t.id);

function tegnGrunner() {
  grunnLag.clearLayers();
  for (const g of grunner) {
    const farge = valdFarge(g.vald?.nr);
    L.geoJSON(g.geometri, { pane: 'grenser', style: { color: farge, weight: 3, fillColor: farge, fillOpacity: 0.12 }, interactive: false })
      .bindTooltip(`${g.vald ? `<b>Vald ${h(valdTekst(g.vald))}</b><br>` : ''}${h(g.enheter.map((e) => e.tekst).join(', '))}`, { sticky: true }).addTo(grunnLag);
  }
}

// ---------- Vald ----------

const VALDFARGER = ['#16a34a', '#2563eb', '#9333ea', '#ca8a04', '#0891b2', '#db2777'];
function valdFarge(nr) {
  if (!nr) return '#16a34a';
  let i = valdliste.findIndex((v) => v.nr === nr);
  if (i < 0) i = [...nr].reduce((a, c) => a + c.charCodeAt(0), 0);
  return VALDFARGER[i % VALDFARGER.length];
}
const kjentVald = (nr) => valdliste.find((v) => v.nr === nr) || { nr, navn: '' };

// Valdet i punktet: fra jaktgrunnene du har knyttet til et vald, ellers fra importerte valdgrenser.
function valdI(p) {
  const g = grunner.find((x) => x.vald && punktIPolygon(p, x.geometri));
  if (g) return { vald: g.vald, kilde: 'grunn' };
  for (const i of importert) {
    if (i.synlig === false) continue;
    for (const f of i.fc.features) {
      if (!/Polygon/.test(f.geometry?.type)) continue;
      const v = valdFraEgenskaper(f.properties);
      if (v && punktIPolygon(p, f.geometry)) return { vald: { ...kjentVald(v.nr), ...(v.navn ? { navn: v.navn } : {}) }, kilde: 'fil' };
    }
  }
  return null;
}
const harVald = () => grunner.some((g) => g.vald) || importert.some((i) => i.fc.features.some((f) => valdFraEgenskaper(f.properties)));

function valdStatusHtml(p) {
  const v = valdI(p);
  if (v) return `<span class="ok">✓ ${h(valdTekst(v.vald))}</span>${v.kilde === 'fil' ? ' <span class="liten">(fra fil)</span>' : ''}`;
  if (harVald()) return '<span class="advarsel">Ikke i ditt vald</span>';
  return '<span class="liten">Ikke satt – knytt jaktgrunnene til valdet ditt</span>';
}

function valdVelger(id, valgt) {
  const liste = [...valdliste];
  if (valgt && !liste.some((v) => v.nr === valgt.nr)) liste.push(valgt);
  return `<select id="${id}" class="velger">
    <option value="">Uten vald</option>
    ${liste.map((v) => `<option value="${h(v.nr)}" ${valgt?.nr === v.nr ? 'selected' : ''}>${h(valdTekst(v))}</option>`).join('')}
    <option value="annet">Annet valdnummer …</option></select>`;
}
// Leser valget i en valdvelger. Returnerer undefined hvis brukeren avbryter.
function lesValdvalg(sel) {
  if (sel.value === '') return null;
  if (sel.value !== 'annet') return kjentVald(sel.value);
  const svar = prompt('Valdnummer (f.eks. 2211V0009):', `${'2211V'}`);
  if (svar == null) return undefined;
  if (!gyldigValdnr(svar)) { melding('Valdnummer må ha formen 2211V0009.'); return undefined; }
  const nr = svar.trim().toUpperCase();
  const navn = prompt('Navn på valdet (valgfritt):', '') || '';
  const v = { nr, navn: navn.trim() };
  if (!valdliste.some((x) => x.nr === nr)) { valdliste = [...valdliste, v]; lagre.sett('valdliste', valdliste); }
  return v;
}

async function oppdaterValdliste() {
  try {
    const ny = await hentVald();
    if (!ny.length) return;
    const egne = valdliste.filter((v) => !VALD_NORDFJELLA.some((x) => x.nr === v.nr) && !ny.some((x) => x.nr === v.nr));
    valdliste = [...ny, ...egne]; lagre.sett('valdliste', valdliste);
  } catch { /* uten nett – bruker lagret liste */ }
}

// ---------- Villreinområdet ----------

function iOmraadet(p) {
  const inne = punktIPolygon(p, omraade);
  const g = avstandTilGrense(p, omraade);
  return { inne, meter: g.meter, retning: g.punkt ? himmelretning(retning(p, g.punkt)) : '' };
}

function omraadeTekst(o) {
  if (o.inne) return { klasse: o.meter < 200 ? 'naer' : 'inne', tittel: 'Innenfor villreinområdet', under: `${avstand(o.meter)} til grensa (${o.retning})` };
  return { klasse: 'ute', tittel: 'Utenfor villreinområdet', under: `${avstand(o.meter)} til grensa mot ${o.retning}` };
}

// ---------- GPS ----------

let gpsModus = 'av';
let vakt = null;
let posisjon = null; // { p: [lon, lat], acc, alt, heading, tid }
let sisteOppslag = { tid: 0, p: null };
let gjeldendeTeig = null;
const posMarkor = L.marker([0, 0], { icon: L.divIcon({ className: 'pos-markor', html: '<i class="pil" hidden></i><i class="prikk"></i>', iconSize: [22, 22] }), interactive: false, zIndexOffset: 1000 });
const posSirkel = L.circle([0, 0], { radius: 1, color: '#1a73e8', weight: 1, fillOpacity: 0.12, interactive: false });

function settGpsModus(m) {
  gpsModus = m;
  $('#b-gps').dataset.modus = m;
  $('#b-gps').setAttribute('aria-pressed', String(m === 'folg'));
}

function startGps() {
  if (!('geolocation' in navigator)) { melding('Telefonen gir ikke tilgang til GPS i nettleseren.'); return; }
  if (vakt != null) return;
  settGpsModus('venter');
  vakt = navigator.geolocation.watchPosition(nyPosisjon, (e) => {
    if (e.code === 1) { melding('Du må gi appen tilgang til posisjon i innstillingene.', 6000); stoppGps(); }
    else melding('Finner ikke GPS-posisjon ennå …');
  }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
}
function stoppGps() {
  if (vakt != null) navigator.geolocation.clearWatch(vakt);
  vakt = null; posisjon = null; settGpsModus('av');
  kart.removeLayer(posMarkor); kart.removeLayer(posSirkel);
  oppdaterStatus();
}

$('#b-gps').addEventListener('click', () => {
  if (gpsModus === 'av') { startGps(); lagre.sett('gps', true); return; }
  if (gpsModus === 'folg' || gpsModus === 'venter') { stoppGps(); lagre.sett('gps', false); return; }
  settGpsModus('folg');
  if (posisjon) kart.setView([posisjon.p[1], posisjon.p[0]], Math.max(kart.getZoom(), 14));
});
kart.on('dragstart', () => { if (gpsModus === 'folg') settGpsModus('vis'); });

function nyPosisjon(pos) {
  const c = pos.coords;
  const forste = !posisjon;
  posisjon = { p: [c.longitude, c.latitude], acc: c.accuracy, alt: c.altitude, heading: c.heading, fart: c.speed, tid: pos.timestamp };
  const ll = [c.latitude, c.longitude];
  posMarkor.setLatLng(ll).addTo(kart);
  posSirkel.setLatLng(ll).setRadius(c.accuracy || 1).addTo(kart);
  const pil = posMarkor.getElement()?.querySelector('.pil');
  if (pil) {
    const har = typeof c.heading === 'number' && !Number.isNaN(c.heading) && (c.speed ?? 0) > 0.5;
    pil.hidden = !har; if (har) pil.style.transform = `rotate(${c.heading}deg)`;
  }
  if (gpsModus === 'venter') settGpsModus('folg');
  if (gpsModus === 'folg') kart.setView(ll, forste ? Math.max(kart.getZoom(), 14) : kart.getZoom(), { animate: !forste });
  oppdaterStatus();
}

async function oppdaterEiendomForPosisjon() {
  if (!posisjon) return;
  const p = posisjon.p;
  // Står vi fortsatt i samme teig trengs ikke noe nytt oppslag.
  if (gjeldendeTeig && punktIPolygon(p, gjeldendeTeig.geometri)) return;
  const lokal = teigLokalt(p);
  if (lokal) { gjeldendeTeig = lokal; return; }
  const naa = Date.now();
  if (naa - sisteOppslag.tid < 15000 && sisteOppslag.p && avstandM(sisteOppslag.p, p) < 50) return;
  sisteOppslag = { tid: naa, p };
  try { gjeldendeTeig = await finnTeig(p); } catch { gjeldendeTeig = null; sisteOppslag.feil = true; }
  oppdaterStatus(false);
}

function eiendomStatusHtml(p) {
  const t = gjeldendeTeig && punktIPolygon(p, gjeldendeTeig.geometri) ? gjeldendeTeig : teigLokalt(p);
  const harGrunner = grunner.length > 0;
  const minGrunn = grunner.find((g) => punktIPolygon(p, g.geometri));
  if (minGrunn) {
    const d = avstandTilGrense(p, minGrunn.geometri);
    return `<span class="ok">✓ Din jaktgrunn</span> ${h(teigNavn(minGrunn))} · <span class="mono">${avstand(d.meter)}</span> til grensa (${himmelretning(retning(p, d.punkt))})`;
  }
  if (!t) {
    if (!navigator.onLine || sisteOppslag.feil) return harGrunner ? '<span class="advarsel">Ikke på din jaktgrunn</span> · ukjent eiendom (uten nett)' : '<span class="liten">Ukjent – krever nett, eller lagre jaktgrunner</span>';
    return '<span class="liten">Slår opp …</span>';
  }
  const nær = harGrunner ? nærmesteGrunn(p) : null;
  return `${harGrunner ? '<span class="advarsel">Ikke din jaktgrunn</span> · ' : ''}${h(teigNavn(t))}${nær ? ` · din nærmeste ${avstand(nær.meter)} ${nær.retning}` : ''}`;
}

function nærmesteGrunn(p) {
  let best = null;
  for (const g of grunner) {
    const d = avstandTilGrense(p, g.geometri);
    if (!best || d.meter < best.meter) best = { meter: d.meter, retning: himmelretning(retning(p, d.punkt)) };
  }
  return best;
}

function oppdaterStatus(slaaOpp = true) {
  const el = $('#s-omraade');
  if (!posisjon) {
    el.className = 'merkelapp graa';
    el.innerHTML = gpsModus === 'venter' ? 'Søker etter GPS-posisjon …' : 'Trykk på ◎ for å se hvor du er';
    $('#s-eiendom').textContent = '–'; $('#s-vald').textContent = '–'; $('#s-pos').textContent = '–';
    oppdaterMal();
    return;
  }
  const p = posisjon.p;
  const o = omraadeTekst(iOmraadet(p));
  el.className = `merkelapp ${o.klasse}`;
  el.innerHTML = `${h(o.tittel)}<small>${h(o.under)}</small>`;
  $('#s-eiendom').innerHTML = eiendomStatusHtml(p);
  $('#s-vald').innerHTML = valdStatusHtml(p);
  const alt = posisjon.alt != null ? ` · ${Math.round(posisjon.alt)} moh.` : '';
  $('#s-pos').innerHTML = `<span class="mono">${h(utmTekst(p, 32))}</span> <span class="liten">±${Math.round(posisjon.acc)} m${alt}</span>`;
  oppdaterMal();
  if (slaaOpp) oppdaterEiendomForPosisjon();
}

// ---------- Mål («gå hit») ----------

function settMal(m) {
  mal = m; lagre.sett('mal', mal);
  oppdaterMal();
}
function oppdaterMal() {
  malLag.clearLayers();
  $('#s-mal-rad').hidden = !mal;
  if (!mal) return;
  const ll = [mal.lat, mal.lon];
  L.circleMarker(ll, { radius: 9, color: '#d9480f', weight: 3, fillOpacity: 0.2, interactive: false }).addTo(malLag);
  if (posisjon) {
    L.polyline([[posisjon.p[1], posisjon.p[0]], ll], { color: '#d9480f', weight: 3, dashArray: '8 8', interactive: false }).addTo(malLag);
    const d = avstandM(posisjon.p, [mal.lon, mal.lat]);
    const r = retning(posisjon.p, [mal.lon, mal.lat]);
    $('#s-mal').innerHTML = `${h(mal.navn)} · <b class="mono">${avstand(d)}</b> mot ${himmelretning(r)} (${Math.round(r)}°)`;
  } else {
    $('#s-mal').textContent = `${mal.navn} – slå på GPS for avstand og retning`;
  }
}
$('#b-stopp-mal').addEventListener('click', () => settMal(null));

// ---------- Trykk i kartet ----------

let punktTeller = 0;
kart.on('click', (e) => visPunkt([e.latlng.lng, e.latlng.lat]));

async function visPunkt(p, tittel = 'Punkt i kartet', ekstraHtml = '') {
  const nr = ++punktTeller;
  valgtLag.clearLayers();
  L.circleMarker([p[1], p[0]], { radius: 7, color: '#111', weight: 2, fillColor: '#fff', fillOpacity: 1, interactive: false }).addTo(valgtLag);
  const o = omraadeTekst(iOmraadet(p));
  const fraMeg = posisjon ? `<div class="rad"><span class="ledetekst">Fra deg</span><span class="mono">${avstand(avstandM(posisjon.p, p))} mot ${himmelretning(retning(posisjon.p, p))}</span></div>` : '';
  const egne = egneTreff(p);
  $('#p-tittel').textContent = tittel;
  $('#p-innhold').innerHTML = `
    ${ekstraHtml}
    <div class="boks ${o.klasse}"><b>${h(o.tittel)}</b><br>${h(o.under)}</div>
    <div class="fakta">
      <div class="rad"><span class="ledetekst">Vald</span><span id="p-vald">${(() => { const v = valdI(p); return v ? `<b>${h(valdTekst(v.vald))}</b>${v.kilde === 'fil' ? ' <span class="liten">(fra fil)</span>' : ''}` : '<span class="liten">Ukjent</span>'; })()}</span></div>
      <div class="rad"><span class="ledetekst">Eiendom</span><span id="p-eiendom">Slår opp …</span></div>
      <div class="rad"><span class="ledetekst">Høyde</span><span id="p-hoyde" class="mono">…</span></div>
      <div class="rad"><span class="ledetekst">UTM 32</span><span class="mono">${h(utmTekst(p, 32))}</span></div>
      <div class="rad"><span class="ledetekst">Grader</span><span class="mono">${p[1].toFixed(5)}° N, ${p[0].toFixed(5)}° Ø</span></div>
      ${fraMeg}
      ${egne.length ? `<div class="rad"><span class="ledetekst">Egne grenser</span><span>${egne.map(h).join(', ')}</span></div>` : ''}
    </div>
    <div id="p-eiendomsvalg"></div>
    <div class="knapperad">
      <button type="button" class="knapp" id="p-gaa">Gå hit</button>
      <button type="button" class="knapp" id="p-merk">Registrer her</button>
    </div>`;
  visArk('punkt');
  $('#p-gaa').onclick = () => { settMal({ lat: p[1], lon: p[0], navn: tittel === 'Punkt i kartet' ? 'Valgt punkt' : tittel }); lukkArk('punkt'); if (!posisjon) startGps(); };
  $('#p-merk').onclick = () => aapneMerk(p);

  hoydeI(p).then((z) => { if (nr === punktTeller) $('#p-hoyde').textContent = z == null ? 'ukjent' : `${Math.round(z).toLocaleString('nb-NO')} moh.`; })
    .catch(() => { if (nr === punktTeller) $('#p-hoyde').textContent = 'krever nett'; });

  let t = null;
  try { t = await finnTeig(p); } catch { t = undefined; }
  if (nr !== punktTeller) return;
  if (t === undefined) { $('#p-eiendom').innerHTML = '<span class="liten">Fikk ikke slått opp eiendommen (uten nett?).</span>'; return; }
  if (!t) { $('#p-eiendom').textContent = 'Ingen registrert eiendom her'; return; }
  L.geoJSON(t.geometri, { pane: 'grenser', style: { color: '#facc15', weight: 4, fillColor: '#facc15', fillOpacity: 0.15 }, interactive: false }).addTo(valgtLag);
  const min = erGrunn(t);
  $('#p-eiendom').innerHTML = `<b>${h(t.enheter.map((e) => e.tekst).join(', '))}</b> i ${h(kommunenavn(t.kommunenr))}${min ? ' <span class="ok">✓ din jaktgrunn</span>' : ''}`;
  const merknader = [];
  merknader.push(`Grensenøyaktighet: <b>${h(NOYAKTIG_TEKST[t.noyaktighet])}</b>`);
  if (t.enheter.length > 1) merknader.push(`Teigen tilhører flere eiendommer (${t.enheter.length}).`);
  if (t.uregistrertSameie) merknader.push('Uregistrert jordsameie – avklar jaktrett med grunneierlag/fjellstyre.');
  const lagret = grunner.find((g) => g.id === t.id);
  $('#p-eiendomsvalg').innerHTML = `
    <p class="liten">${merknader.join('<br>')}</p>
    <label class="felt">Vald ${valdVelger('p-valdvalg', lagret ? lagret.vald : sisteVald)}</label>
    <button type="button" class="knapp ${min ? 'fare' : 'hoved'}" id="p-grunn" style="width:100%">${min ? 'Fjern fra mine jaktgrunner' : 'Lagre som min jaktgrunn'}</button>`;
  const ferdig = (tekst) => { lagre.sett('grunner', grunner); tegnGrunner(); gjeldendeTeig = null; oppdaterStatus(); melding(tekst); visPunkt(p, tittel, ekstraHtml); };
  $('#p-valdvalg').onchange = (e) => {
    const v = lesValdvalg(e.target);
    if (v === undefined) { e.target.value = lagret?.vald?.nr || sisteVald?.nr || ''; return; }
    sisteVald = v; lagre.sett('sisteVald', v);
    if (lagret) { grunner = grunner.map((g) => (g.id === t.id ? { ...g, vald: v } : g)); ferdig(v ? `${teigNavn(t)} hører nå til vald ${valdTekst(v)}.` : 'Valdet er fjernet fra eiendommen.'); }
  };
  $('#p-grunn').onclick = () => {
    if (erGrunn(t)) { grunner = grunner.filter((g) => g.id !== t.id); ferdig('Fjernet fra mine jaktgrunner.'); return; }
    const v = lesValdvalg($('#p-valdvalg'));
    if (v === undefined) return;
    sisteVald = v; lagre.sett('sisteVald', v);
    grunner = [...grunner, { ...t, vald: v, lagret: Date.now() }];
    ferdig(`${teigNavn(t)} er lagret som din jaktgrunn${v ? ` i vald ${valdTekst(v)}` : ''}.`);
  };
}

// ---------- Registreringer og punkter ----------

function tegnPunkter() {
  punktLag.clearLayers();
  for (const pt of punkter) {
    const t = TYPER[pt.type] || TYPER.annet;
    const n = pt.type === 'obs' ? antallDyr(pt.obs) : pt.type === 'syk' ? pt.annet?.antall : null;
    L.marker([pt.lat, pt.lon], { icon: L.divIcon({ className: 'wpt-markor', html: `${t.ikon}${n ? `<b class="antall">${n}</b>` : ''}`, iconSize: [30, 30], iconAnchor: [15, 26] }), title: pt.navn })
      .on('click', (e) => { L.DomEvent.stopPropagation(e); visMerketPunkt(pt.id); })
      .addTo(punktLag);
  }
}

function detaljerHtml(pt) {
  const d = [];
  if (pt.type === 'obs') {
    const o = pt.obs || {};
    d.push(`<b>${antallDyr(o)} dyr</b>`);
    const s = STRUKTUR.filter((x) => Number(o[x.id]) > 0).map((x) => `${o[x.id]} ${x.navn.toLowerCase()}`);
    if (s.length) d.push(s.join(', '));
    if (o.atferd) d.push(`${ATFERD[o.atferd]}${o.retning ? ` mot ${o.retning}` : ''}`);
    if (o.merket) d.push('Merket dyr i flokken');
  }
  if (pt.type === 'felt') {
    const f = pt.felt || {};
    d.push(`<b>${h([ALDER[f.alder], KJONN[f.kjonn]?.toLowerCase()].filter(Boolean).join(' ') || 'Ukjent kategori')}</b>${f.vekt ? ` · ${h(f.vekt)} kg` : ''}`);
    d.push(`Kjeve: ${f.kjeve ? `tatt${f.kjevenr ? ` (${h(f.kjevenr)})` : ''}` : '<span class="advarsel">ikke registrert</span>'} · CWD-prøve: ${f.cwd ? `tatt${f.cwdnr ? ` (${h(f.cwdnr)})` : ''}` : '<span class="advarsel">ikke registrert</span>'}`);
    if (f.merket) d.push('Merket dyr');
    if (f.jeger) d.push(`Jeger: ${h(f.jeger)}`);
  }
  if (pt.type === 'skadet') d.push(`${pt.annet?.retning ? `Forsvant mot ${h(pt.annet.retning)} · ` : ''}Ettersøk ${pt.annet?.ettersok ? 'varslet' : '<span class="advarsel">ikke varslet</span>'}`);
  if (pt.type === 'syk') d.push(`<b>${h(pt.annet?.tilstand || 'Syk/død')}</b>${pt.annet?.antall ? ` · ${h(pt.annet.antall)} dyr` : ''}`);
  return d.map((x) => (x.startsWith('<b>') || x.includes('<') ? x : h(x))).join('<br>');
}

function visMerketPunkt(id) {
  const pt = punkter.find((x) => x.id === id); if (!pt) return;
  const t = TYPER[pt.type] || TYPER.annet;
  const html = `<p><b>${t.ikon} ${h(t.navn)}</b> · ${h(tid(pt.tid))}${pt.vald ? ` · vald ${h(pt.vald)}` : ''}</p>
    ${TYPER[pt.type]?.rein ? `<p>${detaljerHtml(pt)}</p>` : ''}${pt.notat ? `<p>${h(pt.notat)}</p>` : ''}
    <div class="knapperad"><button type="button" class="knapp fare liten-knapp" data-slett-punkt="${h(pt.id)}">Slett registreringen</button></div>`;
  visPunkt([pt.lon, pt.lat], pt.navn, html).catch(() => {});
}
$('#punkt').addEventListener('click', (e) => {
  const id = e.target.closest('[data-slett-punkt]')?.dataset.slettPunkt;
  const pt = id && punkter.find((x) => x.id === id);
  if (!pt || !confirm(`Slette «${pt.navn}»?`)) return;
  punkter = punkter.filter((x) => x.id !== id); lagre.sett('punkter', punkter); tegnPunkter(); lukkArk('punkt');
});

// Skjemaet bygges én gang: tellere for struktur og nedtrekkslister for retning og atferd.
const skjema = $('#merk-skjema');
$('#struktur').innerHTML = STRUKTUR.map((s) => `
  <div class="teller"><span>${h(s.navn)}${s.hint ? `<small>${h(s.hint)}</small>` : ''}</span>
    <button type="button" data-ned="${s.id}" aria-label="Færre ${h(s.navn.toLowerCase())}">−</button>
    <input name="s-${s.id}" type="number" inputmode="numeric" min="0" max="5000" placeholder="0" aria-label="${h(s.navn)}">
    <button type="button" data-opp="${s.id}" aria-label="Flere ${h(s.navn.toLowerCase())}">+</button></div>`).join('');
for (const navn of ['peiling', 'retning', 'sretning']) skjema[navn].insertAdjacentHTML('beforeend', RETNINGER.map((r) => `<option>${r}</option>`).join(''));
skjema.atferd.insertAdjacentHTML('beforeend', Object.entries(ATFERD).map(([k, v]) => `<option value="${k}">${h(v)}</option>`).join(''));

function strukturSum() {
  const sum = STRUKTUR.reduce((a, s) => a + (Number(skjema[`s-${s.id}`].value) || 0), 0);
  const total = Number(skjema.total.value) || 0;
  $('#struktur-sum').textContent = sum ? `Klassifisert: ${sum}${total ? ` av ${total}` : ''}${total && sum > total ? ' – flere enn totalen, totalen settes til summen' : ''}` : '';
}
function oppdaterSkjema() {
  const type = skjema.type.value;
  for (const d of skjema.querySelectorAll('[data-for]')) d.hidden = !d.dataset.for.split(' ').includes(type);
  // Plassering med avstand/retning gir bare mening når du registrerer fra din egen posisjon.
  $('#merk-plassering').hidden ||= !merkGps;
  for (const el of skjema.querySelectorAll('[data-vis-hvis]')) el.hidden = !skjema[el.dataset.visHvis].checked;
  strukturSum();
}
skjema.addEventListener('change', oppdaterSkjema);
skjema.addEventListener('input', strukturSum);
skjema.addEventListener('click', (e) => {
  const b = e.target.closest('[data-opp],[data-ned]'); if (!b) return;
  const felt = skjema[`s-${b.dataset.opp || b.dataset.ned}`];
  felt.value = Math.max(0, (Number(felt.value) || 0) + (b.dataset.opp ? 1 : -1)) || '';
  strukturSum();
});

let merkPos = null;
let merkGps = null; // GPS-målingen registreringen gjøres fra, hvis det er din posisjon
function aapneMerk(p, type) {
  merkPos = p;
  merkGps = posisjon && p === posisjon.p ? { ...posisjon } : null;
  skjema.reset();
  if (type) skjema.type.value = type;
  $('#merk-pos').textContent = `${utmTekst(p, 32)}${merkGps ? ` (din posisjon, ±${Math.round(merkGps.acc)} m)` : ''}${valdI(p) ? ` · vald ${valdI(p).vald.nr}` : ''}`;
  oppdaterSkjema();
  $('#merk').showModal();
}
$('#b-merk').addEventListener('click', () => {
  if (posisjon && Date.now() - posisjon.tid < 120000) { aapneMerk(posisjon.p); return; }
  const c = kart.getCenter();
  melding(posisjon ? 'GPS-posisjonen er gammel – bruker midten av kartet.' : 'GPS er av – bruker midten av kartet. Slå på GPS for å registrere der du står.', 5000);
  aapneMerk([c.lng, c.lat]);
});
$('#merk').addEventListener('close', () => {
  if ($('#merk').returnValue !== 'lagre' || !merkPos) return;
  const f = skjema;
  const type = f.type.value;
  const tall = (v) => (v === '' || v == null ? null : Number(v));
  // Flokken/dyret kan stå et stykke unna: flytt punktet ut fra avstand og retning.
  let pos = merkPos;
  const avst = tall(f.avstand.value);
  if (merkGps && TYPER[type].rein && avst > 0 && f.peiling.value) pos = flytt(merkPos, avst, RETNINGER.indexOf(f.peiling.value) * 45);
  const pt = {
    id: crypto.randomUUID?.() || String(Date.now()), type, notat: f.notat.value.trim(),
    lon: pos[0], lat: pos[1], tid: Date.now(), hoyde: pos === merkPos ? merkGps?.alt ?? null : null, acc: merkGps?.acc ?? null,
    vald: valdI(pos)?.vald?.nr || null,
    ...(pos !== merkPos ? { fra: { lon: merkPos[0], lat: merkPos[1], avstand: avst, retning: f.peiling.value } } : {}),
  };
  if (type === 'obs') {
    pt.obs = { total: tall(f.total.value), atferd: f.atferd.value || null, retning: f.retning.value || null, merket: f.merket.checked };
    for (const s of STRUKTUR) pt.obs[s.id] = tall(f[`s-${s.id}`].value);
    if (!antallDyr(pt.obs)) { melding('Oppgi antall dyr i flokken.'); $('#merk').showModal(); return; }
  }
  if (type === 'felt') {
    pt.felt = { kjonn: f.kjonn.value || null, alder: f.alder.value || null, vekt: tall(f.vekt.value), kjeve: f.kjeve.checked, kjevenr: f.kjevenr.value.trim(), cwd: f.cwd.checked, cwdnr: f.cwdnr.value.trim(), merket: f.fmerket.checked, jeger: f.jeger.value.trim() };
  }
  if (type === 'skadet') pt.annet = { retning: f.sretning.value || null, ettersok: f.ettersok.checked };
  if (type === 'syk') pt.annet = { tilstand: f.tilstand.value || null, antall: tall(f.santall.value) };
  const standardnavn = {
    obs: () => `Flokk ${antallDyr(pt.obs)} dyr`,
    felt: () => [ALDER[pt.felt.alder]?.replace(/ \(.*\)/, ''), KJONN[pt.felt.kjonn]?.toLowerCase()].filter(Boolean).join(' ') || 'Felt dyr',
    syk: () => pt.annet.tilstand || 'Syk/død rein',
  };
  pt.navn = f.navn.value.trim() || `${(standardnavn[type] || (() => TYPER[type].navn))()} ${tid(pt.tid)}`;
  punkter = [...punkter, pt]; lagre.sett('punkter', punkter);
  if (!synlig.punkter) { synlig.punkter = true; lagre.sett('synlig', synlig); brukSynlighet(); }
  tegnPunkter(); lukkArk('punkt');
  melding(`Lagret: ${pt.navn}`);
  if (type === 'felt' && !pt.felt.cwd) melding('Lagret. Husk prøve for skrantesjuke (CWD) og kjeve etter gjeldende krav.', 6000);
  if (type === 'syk') melding('Lagret. Meld straks til Mattilsynet (22 40 00 00).', 8000);
});

// ---------- Oppsummering for forvaltningen ----------

function tegnRein() {
  const aarene = [...new Set([jaktaar(Date.now()), ...punkter.map((p) => jaktaar(p.tid))])].sort((a, b) => b - a);
  const valgtAar = Number($('#r-aar').value) || aarene[0];
  $('#r-aar').innerHTML = aarene.map((a) => `<option value="${a}" ${a === valgtAar ? 'selected' : ''}>${a}</option>`).join('');
  const valdene = [...new Set(punkter.map((p) => p.vald).filter(Boolean))].sort();
  const valgtVald = valdene.includes($('#r-vald').value) ? $('#r-vald').value : '';
  $('#r-vald').innerHTML = `<option value="">Alle</option>${valdene.map((v) => `<option ${v === valgtVald ? 'selected' : ''}>${h(v)}</option>`).join('')}`;
  const o = oppsummering(punkter, { aar: valgtAar, vald: valgtVald || null });
  const verdi = (v) => (v == null ? '–' : v);
  const s = o.obs.struktur;
  const kat = Object.entries(o.felt.kategorier).sort();
  $('#r-oppsummering').innerHTML = `
    <h3>Observasjoner</h3>
    <div class="nokkeltall">
      <div><b>${o.obs.dyr}</b><small>dyr sett (${o.obs.registreringer} reg.)</small></div>
      <div><b>${verdi(o.obs.kalvPer100Simler)}</b><small>kalv per 100 simler</small></div>
      <div><b>${verdi(o.obs.bukkerPer100Simler)}</b><small>bukk per 100 simler</small></div>
    </div>
    ${o.obs.klassifisert ? `<table class="tabell"><tbody>
      ${STRUKTUR.map((x) => `<tr><td>${h(x.navn)}</td><td>${s[x.id]}</td></tr>`).join('')}
      <tr><th>Andel store bukker av bukkene</th><th>${o.obs.andelStoreBukker == null ? '–' : `${o.obs.andelStoreBukker} %`}</th></tr>
    </tbody></table>` : '<p class="liten">Ingen strukturdata ennå.</p>'}
    <h3>Felte dyr</h3>
    <div class="nokkeltall">
      <div><b>${o.felt.antall}</b><small>felt</small></div>
      <div><b>${o.felt.kjever}/${o.felt.antall}</b><small>kjever</small></div>
      <div><b>${o.felt.cwd}/${o.felt.antall}</b><small>CWD-prøver</small></div>
    </div>
    ${kat.length ? `<table class="tabell"><thead><tr><th>Kategori</th><th>Antall · snittvekt</th></tr></thead><tbody>
      ${kat.map(([k, v]) => { const [a, kj] = k.split('-'); return `<tr><td>${h(ALDER[a] || 'Ukjent alder')} ${h((KJONN[kj] || '').toLowerCase())}</td><td>${v.antall}${v.snittvekt ? ` · ${v.snittvekt} kg` : ''}</td></tr>`; }).join('')}
    </tbody></table>` : ''}
    ${o.felt.manglerCwd.length ? `<p class="boks naer">Mangler CWD-prøve: ${o.felt.manglerCwd.map(h).join(', ')}</p>` : ''}
    ${o.skadet || o.syk ? `<h3>Avvik</h3><p>${o.skadet ? `Skadeskyting/ettersøk: <b>${o.skadet}</b><br>` : ''}${o.syk ? `Syk/død rein: <b>${o.syk}</b>` : ''}</p>` : ''}`;
  $('#b-csv').disabled = !punkter.length;
  return { o, aar: valgtAar, vald: valgtVald };
}
$('#r-aar').addEventListener('change', tegnRein);
$('#r-vald').addEventListener('change', tegnRein);
$('#b-csv').addEventListener('click', () => {
  const { aar, vald } = tegnRein();
  const utvalg = punkter.filter((p) => jaktaar(p.tid) === aar && (!vald || p.vald === vald));
  lastNed(csv(utvalg), `villrein-nordfjella-${aar}${vald ? `-${vald}` : ''}.csv`, 'text/csv;charset=utf-8');
});
$('#b-del').addEventListener('click', async () => {
  const { o, aar, vald } = tegnRein();
  const tekst = oppsummeringTekst(o, { tittel: `Villrein Nordfjella ${aar}${vald ? `, vald ${vald}` : ''}` });
  try {
    if (navigator.share) { await navigator.share({ title: 'Villrein Nordfjella', text: tekst }); return; }
    await navigator.clipboard.writeText(tekst); melding('Oppsummeringen er kopiert – lim den inn i SMS eller e-post.');
  } catch (e) { if (e?.name !== 'AbortError') melding('Kunne ikke dele. Prøv CSV i stedet.'); }
});

function lastNed(innhold, filnavn, type) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([innhold], { type })), download: filnavn });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- Egne grenser (import) ----------

const IMPORTFARGER = ['#7c3aed', '#0891b2', '#c026d3', '#ea580c', '#0d9488', '#4f46e5'];
function egneTreff(p) {
  return importert.filter((i) => i.synlig !== false).flatMap((i) => i.fc.features.filter((f) => /Polygon/.test(f.geometry?.type) && punktIPolygon(p, f.geometry)).map((f) => f.properties?.navn || f.properties?.name || i.navn));
}
function tegnImport() {
  importLag.clearLayers();
  for (const i of importert) {
    if (i.synlig === false) continue;
    L.geoJSON(i.fc, {
      pane: 'grenser',
      style: { color: i.farge, weight: 3, fillOpacity: 0.06, dashArray: '10 6', interactive: false },
      pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 5, color: i.farge, fillOpacity: 0.9 }),
      onEachFeature: (f, l) => { const v = valdFraEgenskaper(f.properties); const n = v ? `Vald ${valdTekst(v)}` : f.properties?.navn || f.properties?.name; if (n) l.bindTooltip(h(n), { sticky: true }); },
      interactive: false,
    }).addTo(importLag);
  }
  if (!kart.hasLayer(importLag)) importLag.addTo(kart);
}
$('#fil').addEventListener('change', async (e) => {
  const fil = e.target.files[0]; e.target.value = '';
  if (!fil) return;
  try {
    const fc = lesFil(fil.name, await fil.text());
    if (!fc.features.length) throw new Error('Fant ingen flater, linjer eller punkter i filen.');
    const ny = { id: String(Date.now()), navn: fil.name.replace(/\.[^.]+$/, ''), farge: IMPORTFARGER[importert.length % IMPORTFARGER.length], fc, synlig: true };
    importert = [...importert, ny];
    if (!lagre.sett('import', importert)) { importert = importert.slice(0, -1); return; }
    tegnImport(); tegnMeny();
    const b = L.geoJSON(fc).getBounds(); if (b.isValid()) kart.fitBounds(b, { padding: [20, 20] });
    melding(`La inn ${fc.features.length} objekter fra ${fil.name}.`);
  } catch (err) { melding(`Kunne ikke lese filen: ${err.message}`, 7000); }
});

// ---------- Meny ----------

function tegnMeny() {
  const grupper = new Map();
  for (const g of grunner) { const k = g.vald?.nr || ''; if (!grupper.has(k)) grupper.set(k, []); grupper.get(k).push(g); }
  $('#grunn-liste').innerHTML = grunner.length ? [...grupper].sort(([a], [b]) => (a || 'ÅÅ').localeCompare(b || 'ÅÅ')).map(([nr, liste]) => `
    <li class="gruppe"><i class="farge" style="background:${valdFarge(nr)};margin:0"></i><span class="tekst"><b>${nr ? `Vald ${h(valdTekst(liste[0].vald))}` : 'Uten vald'}</b><small>${liste.length} eiendom${liste.length > 1 ? 'mer' : ''}</small></span>
      <button type="button" class="knapp liten-knapp" data-vis-vald="${h(nr)}">Vis</button></li>
    ${liste.map((g) => `
    <li class="under"><span class="tekst"><b>${h(g.enheter.map((e) => e.tekst).join(', '))}</b><small>${h(kommunenavn(g.kommunenr))} · nøyaktighet ${h(g.noyaktighet)}</small></span>
      <button type="button" class="knapp liten-knapp" data-vis-grunn="${h(g.id)}">Vis</button>
      <button type="button" class="knapp liten-knapp fare" data-slett-grunn="${h(g.id)}" aria-label="Fjern">×</button></li>`).join('')}`).join('')
    : '<li class="tom">Ingen jaktgrunner lagret ennå.</li>';
  $('#vald-liste').innerHTML = valdliste.map((v) => `<li><span class="mono">${h(v.nr)}</span> ${h(v.navn)}</li>`).join('');
  const sortert = [...punkter].sort((a, b) => b.tid - a.tid);
  $('#punkt-liste').innerHTML = sortert.length ? sortert.map((pt) => `
    <li><span class="ikon">${(TYPER[pt.type] || TYPER.annet).ikon}</span><span class="tekst"><b>${h(pt.navn)}</b><small>${h(tid(pt.tid))}${posisjon ? ` · ${avstand(avstandM(posisjon.p, [pt.lon, pt.lat]))} unna` : ''}</small></span>
      <button type="button" class="knapp liten-knapp" data-vis-punkt="${h(pt.id)}">Vis</button></li>`).join('')
    : '<li class="tom">Ingen registreringer ennå. Bruk knappen med nål for å registrere der du står.</li>';
  $('#b-gpx').disabled = $('#b-slett-punkter').disabled = !punkter.length;
  $('#import-liste').innerHTML = importert.map((i) => `
    <li><i class="farge" style="background:${h(i.farge)};margin:0"></i><span class="tekst"><b>${h(i.navn)}</b><small>${i.fc.features.length} objekter</small></span>
      <button type="button" class="knapp liten-knapp" data-vis-import="${h(i.id)}">Vis</button>
      <button type="button" class="knapp liten-knapp fare" data-slett-import="${h(i.id)}" aria-label="Fjern">×</button></li>`).join('');
  $('#om-omraade').innerHTML = `${h(omraadeInfo.villreinområdeNavn)} ligger i ${h(omraadeInfo.kommune.replace(/ \(\d+\)/g, '').replace(/,/g, ', '))}. Villreinnemnd: ${h(omraadeInfo.villreinnemd)}.`;
}
$('#meny').addEventListener('click', (e) => {
  const d = e.target.closest('button')?.dataset; if (!d) return;
  if (d.visVald !== undefined) { const gs = grunner.filter((g) => (g.vald?.nr || '') === d.visVald); if (gs.length) { lukkArk('meny'); kart.fitBounds(L.geoJSON({ type: 'FeatureCollection', features: gs.map((g) => ({ type: 'Feature', properties: {}, geometry: g.geometri })) }).getBounds(), { padding: [30, 30] }); } }
  if (d.visGrunn) { const g = grunner.find((x) => x.id === d.visGrunn); if (g) { lukkArk('meny'); kart.fitBounds(L.geoJSON(g.geometri).getBounds(), { padding: [30, 30] }); } }
  if (d.slettGrunn) { const g = grunner.find((x) => x.id === d.slettGrunn); if (g && confirm(`Fjerne ${teigNavn(g)} fra mine jaktgrunner?`)) { grunner = grunner.filter((x) => x !== g); lagre.sett('grunner', grunner); tegnGrunner(); tegnMeny(); gjeldendeTeig = null; oppdaterStatus(); } }
  if (d.visPunkt) { lukkArk('meny'); const pt = punkter.find((x) => x.id === d.visPunkt); if (pt) { kart.setView([pt.lat, pt.lon], Math.max(kart.getZoom(), 14)); visMerketPunkt(pt.id); } }
  if (d.visImport) { const i = importert.find((x) => x.id === d.visImport); if (i) { lukkArk('meny'); kart.fitBounds(L.geoJSON(i.fc).getBounds(), { padding: [20, 20] }); } }
  if (d.slettImport) { const i = importert.find((x) => x.id === d.slettImport); if (i && confirm(`Fjerne «${i.navn}»?`)) { importert = importert.filter((x) => x !== i); lagre.sett('import', importert); tegnImport(); tegnMeny(); } }
});
$('#b-gpx').addEventListener('click', () => lastNed(gpx(punkter), `nordfjella-punkter-${new Date().toISOString().slice(0, 10)}.gpx`, 'application/gpx+xml'));
$('#b-slett-punkter').addEventListener('click', () => {
  if (!confirm(`Slette alle ${punkter.length} punkter? Last ned GPX først hvis du vil ta vare på dem.`)) return;
  punkter = []; lagre.sett('punkter', punkter); tegnPunkter(); tegnMeny();
});

// ---------- Offline-nedlasting ----------

const PAKKER = [
  { id: 'lett', navn: 'Oversikt', zTil: 12, beskrivelse: 'Grovt kart, rask nedlasting' },
  { id: 'standard', navn: 'Standard', zTil: 13, beskrivelse: 'Godt nok til å finne fram' },
  { id: 'detaljert', navn: 'Detaljert', zTil: 14, beskrivelse: 'Anbefalt – stier, bekker og detaljer' },
];
const KB_PER_FLIS = { topo: 75, toporaster: 90, graa: 45 };
const EIENDOM_KB = 3;
let flisliste = null;
const fliser = (zTil) => { flisliste ||= fliserFor(omraade, 6, 14); return flisliste.filter(([z]) => z <= zTil); };
let nedlasting = null;

function tegnOffline() {
  const valgt = lagre.hent('pakke', 'detaljert');
  const b = BAKGRUNNER[aktivBakgrunn];
  $('#pakker').innerHTML = b.offline ? PAKKER.map((p) => {
    const antall = fliser(p.zTil).length, eiendom = fliser(14).filter(([z]) => z === 14).length;
    const mb = Math.round((antall * (KB_PER_FLIS[aktivBakgrunn] || 75) + eiendom * EIENDOM_KB) / 1024);
    return `<label><input type="radio" name="pakke" value="${p.id}" ${p.id === valgt ? 'checked' : ''}>
      <span class="info">${h(p.navn)} – ca. ${mb} MB<small>${h(p.beskrivelse)} · ${h(b.navn.toLowerCase())} + eiendomsgrenser</small></span></label>`;
  }).join('') : `<p class="boks naer">${h(b.navn)} kan ikke lastes ned. Velg topografisk kart, turkart eller gråtone under Kartlag.</p>`;
  $('#b-last-ned').disabled = !b.offline || !!nedlasting;
  visLagring();
}
$('#pakker').addEventListener('change', (e) => lagre.sett('pakke', e.target.value));

async function visLagring() {
  const status = lagre.hent('nedlastet', null);
  let tekst = status ? `Sist lastet ned: ${status.navn}, ${status.bakgrunn}, ${tid(status.tid)}${status.feil ? ` (${status.feil} fliser feilet – prøv igjen)` : ''}.` : 'Ingen kart lastet ned ennå.';
  try {
    const e = await navigator.storage?.estimate?.();
    if (e?.usage != null) tekst += ` Appen bruker ${Math.round(e.usage / 1048576)} MB på telefonen.`;
  } catch { /* ikke støttet */ }
  $('#lagring').textContent = tekst;
}

$('#b-last-ned').addEventListener('click', async () => {
  if (!('caches' in window)) { melding('Nettleseren støtter ikke lagring av kart.'); return; }
  const pakke = PAKKER.find((p) => p.id === (document.querySelector('[name=pakke]:checked')?.value || 'detaljert'));
  const bg = BAKGRUNNER[aktivBakgrunn];
  try { await navigator.storage?.persist?.(); } catch { /* valgfritt */ }
  $('#b-last-ned').disabled = true; $('#b-avbryt').hidden = false; $('#framdrift').hidden = false;
  $('#framdrift span').textContent = 'Beregner hvilke kartruter som trengs …';
  await new Promise((r) => setTimeout(r, 30));
  const urler = [
    ...fliser(pakke.zTil).map(([z, x, y]) => flisUrl(bg.url, z, x, y)),
    ...fliser(14).filter(([z]) => z === WMS.eiendom.offlineZoom).map(([z, x, y]) => wmsUrl(WMS.eiendom, z, x, y)),
  ];
  const cache = await caches.open(FLISCACHE);
  nedlasting = { avbrutt: false };
  let ferdig = 0, feil = 0, i = 0;
  const vis = () => {
    $('#framdrift i').style.width = `${(100 * ferdig) / urler.length}%`;
    $('#framdrift span').textContent = `${ferdig.toLocaleString('nb-NO')} av ${urler.length.toLocaleString('nb-NO')} kartruter${feil ? ` · ${feil} feilet` : ''}`;
  };
  const arbeider = async () => {
    while (i < urler.length && !nedlasting.avbrutt) {
      const url = urler[i++];
      try {
        if (!(await cache.match(url))) {
          const r = await fetch(url, { mode: 'cors' });
          if (!r.ok) throw new Error(r.status);
          await cache.put(url, r);
        }
      } catch { feil++; }
      ferdig++;
      if (ferdig % 10 === 0) vis();
    }
  };
  await Promise.all(Array.from({ length: 4 }, arbeider));
  vis();
  const avbrutt = nedlasting.avbrutt;
  nedlasting = null;
  $('#b-avbryt').hidden = true;
  if (!avbrutt) {
    lagre.sett('nedlastet', { navn: pakke.navn, bakgrunn: bg.navn, tid: Date.now(), feil });
    melding(feil ? `Ferdig, men ${feil} kartruter feilet. Trykk «Last ned» igjen for å hente resten.` : 'Kartet er lastet ned og virker uten nett.', 6000);
  } else melding('Nedlastingen ble avbrutt. Det som er hentet, er tatt vare på.');
  tegnOffline();
});
$('#b-avbryt').addEventListener('click', () => { if (nedlasting) nedlasting.avbrutt = true; });
$('#b-tom-fliser').addEventListener('click', async () => {
  if (!confirm('Slette alle nedlastede kart fra telefonen?')) return;
  await caches.delete(FLISCACHE);
  lagre.sett('nedlastet', null);
  melding('Nedlastede kart er slettet.');
  tegnOffline();
});

// ---------- Nett-status og oppstart ----------

const nettStatus = () => { $('#nett').hidden = navigator.onLine; };
addEventListener('online', () => { nettStatus(); oppdaterStatus(); });
addEventListener('offline', nettStatus);
nettStatus();

brukSynlighet();
tegnGrunner();
tegnPunkter();
tegnImport();
oppdaterStatus();
maalStatus();
if (lagre.hent('gps', false)) startGps();
oppdaterValdliste();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
