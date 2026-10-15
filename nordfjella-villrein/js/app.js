import { punktIPolygon, avstandTilGrense, avstandM, retning, himmelretning, utmTekst, bbox, fliserFor, gpx } from './geo.js';
import { VERSJON } from './versjon.js';
import { plattform, erIos, erMobil, steg, etterpaa, gpsHjelp } from './installer.js';
import { BAKGRUNNER, WMS, flisUrl, wmsUrl, teigI, teigNavn, hoydeI, kommunenavn, lesFil } from './kilder.js';

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
const TYPER = { bil: { ikon: '🚙', navn: 'Bil' }, leir: { ikon: '⛺', navn: 'Leir/hytte' }, annet: { ikon: '📍', navn: 'Punkt' } };

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
    L.geoJSON(g.geometri, { pane: 'grenser', style: { color: '#16a34a', weight: 3, fillColor: '#22c55e', fillOpacity: 0.12 }, interactive: false })
      .bindTooltip(h(g.enheter.map((e) => e.tekst).join(', ')), { sticky: true }).addTo(grunnLag);
  }
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
    if (e.code === 1) { stoppGps(); visInstaller({ gps: true }); }
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
    $('#s-eiendom').textContent = '–'; $('#s-pos').textContent = '–';
    oppdaterMal();
    return;
  }
  const p = posisjon.p;
  const o = omraadeTekst(iOmraadet(p));
  el.className = `merkelapp ${o.klasse}`;
  el.innerHTML = `${h(o.tittel)}<small>${h(o.under)}</small>`;
  $('#s-eiendom').innerHTML = eiendomStatusHtml(p);
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
      <button type="button" class="knapp" id="p-merk">Merk punkt her</button>
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
  $('#p-eiendomsvalg').innerHTML = `
    <p class="liten">${merknader.join('<br>')}</p>
    <button type="button" class="knapp ${min ? 'fare' : 'hoved'}" id="p-grunn" style="width:100%">${min ? 'Fjern fra mine jaktgrunner' : 'Lagre som min jaktgrunn'}</button>`;
  $('#p-grunn').onclick = () => {
    if (erGrunn(t)) grunner = grunner.filter((g) => g.id !== t.id);
    else grunner = [...grunner, { ...t, lagret: Date.now() }];
    lagre.sett('grunner', grunner); tegnGrunner(); gjeldendeTeig = null; oppdaterStatus();
    melding(erGrunn(t) ? `${teigNavn(t)} er lagret som din jaktgrunn.` : 'Fjernet fra mine jaktgrunner.');
    visPunkt(p, tittel, ekstraHtml);
  };
}

// ---------- Merkede punkter ----------

function tegnPunkter() {
  punktLag.clearLayers();
  for (const pt of punkter) {
    const t = TYPER[pt.type] || TYPER.annet;
    L.marker([pt.lat, pt.lon], { icon: L.divIcon({ className: 'wpt-markor', html: t.ikon, iconSize: [30, 30], iconAnchor: [15, 26] }), title: pt.navn })
      .on('click', (e) => { L.DomEvent.stopPropagation(e); visMerketPunkt(pt.id); })
      .addTo(punktLag);
  }
}

function visMerketPunkt(id) {
  const pt = punkter.find((x) => x.id === id); if (!pt) return;
  const t = TYPER[pt.type] || TYPER.annet;
  const html = `<p><b>${t.ikon} ${h(t.navn)}</b> · ${h(tid(pt.tid))}${pt.notat ? `<br>${h(pt.notat)}` : ''}</p>
    <div class="knapperad"><button type="button" class="knapp fare liten-knapp" data-slett-punkt="${h(pt.id)}">Slett punktet</button></div>`;
  visPunkt([pt.lon, pt.lat], pt.navn, html).catch(() => {});
}
$('#punkt').addEventListener('click', (e) => {
  const id = e.target.closest('[data-slett-punkt]')?.dataset.slettPunkt;
  const pt = id && punkter.find((x) => x.id === id);
  if (!pt || !confirm(`Slette «${pt.navn}»?`)) return;
  punkter = punkter.filter((x) => x.id !== id); lagre.sett('punkter', punkter); tegnPunkter(); lukkArk('punkt');
});

const skjema = $('#merk-skjema');
let merkPos = null;
let merkGps = null; // GPS-målingen punktet ble merket fra, hvis det er din posisjon
function aapneMerk(p) {
  merkPos = p;
  merkGps = posisjon && p === posisjon.p ? { ...posisjon } : null;
  skjema.reset();
  $('#merk-pos').textContent = `${utmTekst(p, 32)}${merkGps ? ` (din posisjon, ±${Math.round(merkGps.acc)} m)` : ''}`;
  $('#merk').showModal();
}
$('#b-merk').addEventListener('click', () => {
  if (posisjon && Date.now() - posisjon.tid < 120000) { aapneMerk(posisjon.p); return; }
  const c = kart.getCenter();
  melding(posisjon ? 'GPS-posisjonen er gammel – bruker midten av kartet.' : 'GPS er av – bruker midten av kartet. Slå på GPS for å merke der du står.', 5000);
  aapneMerk([c.lng, c.lat]);
});
$('#merk').addEventListener('close', () => {
  if ($('#merk').returnValue !== 'lagre' || !merkPos) return;
  const type = skjema.type.value;
  const pt = {
    id: crypto.randomUUID?.() || String(Date.now()), type, notat: skjema.notat.value.trim(),
    lon: merkPos[0], lat: merkPos[1], tid: Date.now(), hoyde: merkGps?.alt ?? null, acc: merkGps?.acc ?? null,
  };
  pt.navn = skjema.navn.value.trim() || `${TYPER[type].navn} ${tid(pt.tid)}`;
  punkter = [...punkter, pt]; lagre.sett('punkter', punkter);
  if (!synlig.punkter) { synlig.punkter = true; lagre.sett('synlig', synlig); brukSynlighet(); }
  tegnPunkter(); lukkArk('punkt');
  melding(`Lagret: ${pt.navn}`);
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
      onEachFeature: (f, l) => { const n = f.properties?.navn || f.properties?.name; if (n) l.bindTooltip(h(n), { sticky: true }); },
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
  $('#grunn-liste').innerHTML = grunner.length ? grunner.map((g) => `
    <li><span class="ikon">🟩</span><span class="tekst"><b>${h(g.enheter.map((e) => e.tekst).join(', '))}</b><small>${h(kommunenavn(g.kommunenr))} · nøyaktighet ${h(g.noyaktighet)}</small></span>
      <button type="button" class="knapp liten-knapp" data-vis-grunn="${h(g.id)}">Vis</button>
      <button type="button" class="knapp liten-knapp fare" data-slett-grunn="${h(g.id)}" aria-label="Fjern">×</button></li>`).join('')
    : '<li class="tom">Ingen jaktgrunner lagret ennå.</li>';
  const sortert = [...punkter].sort((a, b) => b.tid - a.tid);
  $('#punkt-liste').innerHTML = sortert.length ? sortert.map((pt) => `
    <li><span class="ikon">${(TYPER[pt.type] || TYPER.annet).ikon}</span><span class="tekst"><b>${h(pt.navn)}</b><small>${h(tid(pt.tid))}${posisjon ? ` · ${avstand(avstandM(posisjon.p, [pt.lon, pt.lat]))} unna` : ''}</small></span>
      <button type="button" class="knapp liten-knapp" data-vis-punkt="${h(pt.id)}">Vis</button></li>`).join('')
    : '<li class="tom">Ingen punkter ennå. Bruk knappen med nål for å merke der du står.</li>';
  $('#b-gpx').disabled = $('#b-slett-punkter').disabled = !punkter.length;
  $('#import-liste').innerHTML = importert.map((i) => `
    <li><i class="farge" style="background:${h(i.farge)};margin:0"></i><span class="tekst"><b>${h(i.navn)}</b><small>${i.fc.features.length} objekter</small></span>
      <button type="button" class="knapp liten-knapp" data-vis-import="${h(i.id)}">Vis</button>
      <button type="button" class="knapp liten-knapp fare" data-slett-import="${h(i.id)}" aria-label="Fjern">×</button></li>`).join('');
  $('#om-omraade').innerHTML = `${h(omraadeInfo.villreinområdeNavn)} ligger i ${h(omraadeInfo.kommune.replace(/ \(\d+\)/g, '').replace(/,/g, ', '))}. Villreinnemnd: ${h(omraadeInfo.villreinnemd)}.`;
}
$('#meny').addEventListener('click', (e) => {
  const d = e.target.closest('button')?.dataset; if (!d) return;
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

// ---------- Hjemskjerm-veiledning ----------

const ua = navigator.userAgent;
const berøring = navigator.maxTouchPoints || 0;
const ios = erIos(ua, berøring);
const frittstaaende = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
let installPrompt = null; // Chrome/Android: tilbud om installasjon vi kan vise når brukeren vil

function visInstaller({ gps = false, velkommen = false } = {}) {
  const p = plattform(ua, { standalone: frittstaaende(), berøring });
  const adresse = location.href.replace(/[?#].*$/, '');
  const ferdig = p === 'installert';
  $('#i-tittel').textContent = velkommen ? 'Velkommen til Nordfjella villrein' : gps ? 'Slå på GPS-posisjon' : ferdig ? 'Appen er på hjemskjermen ✓' : 'Legg appen på hjemskjermen';
  $('#i-hvorfor').textContent = gps ? 'Appen fikk ikke tilgang til posisjonen din. Slik slår du det på:' : 'Da starter den som en vanlig app i fullskjerm, husker GPS-tillatelsen og beholder nedlastede kart på fjellet.';
  $('#i-hvorfor').hidden = ferdig && !gps;
  const liste = gps || ferdig ? [] : steg(p, { harPrompt: !!installPrompt, ipad: /iPad|Macintosh/.test(ua) });
  $('#i-steg').innerHTML = liste.map((x) => `<li>${x}</li>`).join('');
  $('#i-steg').hidden = !liste.length;
  const handling = [];
  if (!gps && p === 'android-chrome' && installPrompt) handling.push('<button type="button" class="knapp hoved" id="i-installer">📲 Installer appen</button>');
  if (!gps && (p === 'innebygd' || p === 'pc')) handling.push(`<span class="adresse">${h(adresse)}</span>`, '<button type="button" class="knapp" id="i-kopier">Kopier lenken</button>');
  $('#i-handling').innerHTML = handling.join('');
  $('#i-handling').hidden = !handling.length;
  $('#i-etter').hidden = p === 'pc' || p === 'innebygd';
  $('#i-etter').open = !gps && (ferdig || velkommen || !liste.length);
  $('#i-etter-liste').innerHTML = etterpaa(ios).map((x) => `<li>${x}</li>`).join('');
  const gpsDel = $('#i-gps').closest('details');
  $('#i-gps').textContent = gpsHjelp(ios);
  gpsDel.open = gps;
  $('#i-senere').hidden = ferdig || gps || velkommen;
  $('#i-installer')?.addEventListener('click', async () => {
    const tilbud = installPrompt; installPrompt = null;
    tilbud.prompt();
    const { outcome } = await tilbud.userChoice.catch(() => ({}));
    if (outcome === 'accepted') { $('#installer').close(); melding('Appen installeres – åpne den fra ikonet «Villrein».', 6000); } else visInstaller();
  });
  $('#i-kopier')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(adresse); melding('Lenken er kopiert.'); } catch { melding(adresse, 8000); }
  });
  if (!$('#installer').open) $('#installer').showModal();
}
$('#installer').addEventListener('close', () => lagre.sett('installerVist', Date.now()));
$('#b-installer-meny').addEventListener('click', () => visInstaller());
$('#b-installer-om').addEventListener('click', () => visInstaller());
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; });
addEventListener('appinstalled', () => { installPrompt = null; melding('Appen er lagt på hjemskjermen. Åpne den fra ikonet «Villrein».', 6000); visMenyknapp(); });
function visMenyknapp() { $('#b-installer-meny').hidden = frittstaaende(); }

for (const el of document.querySelectorAll('.versjon')) el.textContent = VERSJON;
visMenyknapp();
{
  // Første gang: veiledning om hjemskjerm på mobil, og en kort velkomst når appen åpnes fra hjemskjermen.
  const p = plattform(ua, { standalone: frittstaaende(), berøring });
  if (p === 'installert' && !lagre.hent('velkommenVist', false)) { lagre.sett('velkommenVist', true); setTimeout(() => visInstaller({ velkommen: true }), 800); }
  else if (erMobil(p) && !lagre.hent('installerVist', false)) setTimeout(() => visInstaller(), 1500);
}

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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
