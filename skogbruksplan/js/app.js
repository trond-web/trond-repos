import './innlogging.js'; // først: økten følger med alle kall til serveren
import { arealM2, punktIGeometri, bbox, fraWgs84, etikettPunkt } from './proj.js';
import { lagSosi } from './sosi.js';
import {
  TRESLAG, HOGSTKLASSER, HK_NAVN, HK_ROMERTALL, BONITETER, TILTAKSTYPER, STANDARD_INNSTILLINGER,
  normaliserBestand, laavesteHogstalder, beregnetHogstklasse, startTilstand, arligTilvekstDaa,
  rotnettoPerM3, hogstklasseFor, rettFeilHogd, tiltakKostnad, framskriv, foreslaaForEiendom, sammendrag, nyId, runde, HOGSTTYPER, hogstAndel, hogstNettoPerM3,hkGrenser, hogstklasseAvvik, framskrivTilAar
} from './model.js';
import { lesFil, slaaSammen } from './importers.js';
import { lagDemo } from './demo.js';
import { lagre, hent, listPlaner, lagrePlan, hentPlan, slettPlan, hentVerdi, lagreVerdi } from './store.js';
import { initFlereEiendommer } from './flere-eiendommer.js';
import { STATUSER, skjemaVerdier, endreTiltak, slettTiltak, slettTekst } from './tiltak-endring.js';
import { startFlateRedigering } from './flate-redigering.js';
import { synligeTiltaksflater, treffVed, tiltakStil, tiltakNavn, tiltakLinje, tiltakDetaljer } from './treff.js';
import { flisUrler, FLIS_CACHE } from './offline-kart.js';
import { genererPlan, hentKommuner, finnKommune } from './generator.js';
import { initKommune } from './kommune-ui.js';
import { initVeier } from './veier-ui.js';
import { lagInnsikt } from './innsikt.js';
import { initKommando } from './kommando.js';
import { initPefc } from './pefc-ui.js';
import { delFlate, nyttNr } from './del.js';
import { initAssistent } from './assistent.js';
import { initSkogbrand } from './skogbrand-ui.js';
import { initSkifteplan } from './skifteplan-ui.js';
import { misMonster, misFigurer, misKartlag, misLegendStil, miljoLegendStil } from './miljokart.js';
import { VERSJON, UTGITT, UTVIKLER, APPNAVN, signatur } from './versjon.js';
import { lagSkifteinndeling, hentJordsmonnFlater, jordbruksBoks } from './skifteplan.js';
import { genererTiltak, oppsummer as motorOppsummer, PRINSIPPER, KILDER as MOTOR_KILDER, endringer as motorEndringer, merkKjort, tilTiltak, anvend as anvendMotor, oppdaterBestand as motorOppdaterBestand, MOTOR_VERSJON, signatur as motorSignatur } from './tiltaksmotor.js';
import { RAPPORTER, lagRapport, lagRapportCsv } from './rapporter.js';
import { MARKSLAG, monsterDefs, symbolFyll, symbolRute, arealfordeling, hentAr5, lagFigurer, klippTil, trekkUtAvBestand } from './markslag.js';
import { skadeOppsummering, RISIKONIVAA } from './skade.js';
import { initVerdi, utenProduksjon } from './verdi-ui.js';
import { hentDatagrunnlag } from './datagrunnlag.js';
import { kalibrerPriser, verdiberegning, STANDARD_VERDI } from './verdi.js';
import { VEIKLASSER, VEDLIKEHOLDSTYPER, VEISTIL } from './veier.js';
import { synligPadding } from './kartutsnitt.js';
import { initOppdrag } from './oppdrag-ui.js';
import { initKsl } from './ksl-ui.js';
import { initKarbon } from './karbon-ui.js';
import { lagOppdrag, leggTil as leggTilOppdrag, ledig as tiltakLedig, OPPDRAGSSTATUS, OPPDRAGSTYPER, typeFor as oppdragstype } from './oppdrag.js';
const oppdragstypeNokkel = (t) => (OPPDRAGSTYPER[t] ? t : 'annet');
import { KRAVPUNKTER } from './pefc.js';
import { tetthet, hkTekst, tetthetNavn } from './tetthet.js';
import { nyttUtvalg, kanLageTiltak, kandidater as utvalgKandidater, bestandStatus, trykkBestand, brukFlate, settValgt, angre as angreUtvalg, harEndringer, rullTilbake, bekreft as bekreftUtvalg, oppsummer as oppsummerUtvalg } from './oppdrag-utvalg.js';
import { mpTilUtm, mpTilGeo, fordelPaaBestand } from './sporlogg.js';
import { erUngskog, ungskogData, effektFor, settUngskog, fraSr16, middelhoyde } from './ungskog.js';
import { ungskogHtml, effektHtml } from './effekt-html.js';
import { VEG_TYPER, SKOGTYPER, vegFarge, vegTekst, settVegetasjon } from './vegetasjon.js';

const VEIKLASSER_NAVN = (k) => (VEIKLASSER[k] || VEIKLASSER[0]).navn;
// Oppdrag: valg av tiltak i tiltakslisten og bestand som er uthevet i kartet for oppdraget som er åpent.
let kslVisning = null; let karbonVisning = null;
let valgModus = false; let valgteTiltak = new Set(); let maalOppdrag = null; let uthevet = new Set(); let oppdragVisning = null;
let kartUtvalg = null; // velg-modus: trykk på bestand i kartet og tegnede flater (oppdrag-utvalg.js), deler valgteTiltak
const VEDLIKEHOLD_NAVN = (t) => VEDLIKEHOLDSTYPER[t]?.navn || t;
import { stabletSoyle, linje, fmt } from './charts.js';
import { lagPlanSynk, merkSlettet, lenkeMedKode, API as SYNK_API } from './plan-synk.js';
import { lagSatellittVisning, bestandStripeHtml, SATELLITT_AAR, SISTE_SATELLITTAAR } from './satellitt.js';

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
function hk(b) { return hogstklasseFor(b, inn()); }
function hogstmodenAar(b) {
  const min = laavesteHogstalder(b, inn());
  const s = startTilstand(b);
  if (!min || (!b.alder && !b.volumDaa)) return null;
  return s.alder >= min ? IAAR : IAAR + Math.ceil(min - s.alder);
}
function sortNr(a, b) { return String(a).localeCompare(String(b), 'nb', { numeric: true }); }

let lagreTimer;
// SkogIQ Felt (mobilversjonen) og fullversjonen i andre faner varsler hverandre når en plan er endret.
const kanal = 'BroadcastChannel' in window ? new BroadcastChannel('skogiq') : null;
let stilleLagring = false;
function lagreSnart() {
  clearTimeout(lagreTimer);
  if (!stilleLagring) { S.endret = new Date().toISOString(); if (S.synk?.id) { clearTimeout(synkTimer); synkTimer = setTimeout(() => synkAktiv(), 10000); } } // brukes når planen synkroniseres med mobilen
  lagreTimer = setTimeout(async () => {
    try {
      await lagre(S);
      if (S.planId) { await lagrePlan(S); tegnPlanListe(); if (!stilleLagring) kanal?.postMessage({ type: 'plan-endret', planId: S.planId, fra: 'full' }); }
      stilleLagring = false;
    } catch (e) { melding(`Kunne ikke lagre: ${e.message}`); }
  }, 300);
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
let kartKlikk = null; // overstyrer kartklikk mens en annen modul tegner (f.eks. veier)
let kart; let bestandLag; let misLag; let misMerker = null; let markslagLag; let regLag; let gpsMarkor; let gpsSirkel; let valgtPunkt;
const lagPerBestand = new Map();
const etikettPerBestand = new Map();
let etikettLag; let flyfotoAktiv = false; let lagKontroll = null; let andreVisning = null;
let satellitt = null; let grunnkart = {};

function initKart() {
  kart = L.map('kart', { zoomControl: false, attributionControl: false, preferCanvas: false }).setView([60.85, 11.2], 9);
  L.control.zoom({ position: 'topleft' }).addTo(kart);
  L.control.attribution({ position: 'bottomleft', prefix: '<a href="https://leafletjs.com">Leaflet</a>' }).addTo(kart);
  const topo = L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png', {
    maxZoom: 20, maxNativeZoom: 18, attribution: '© <a href="https://www.kartverket.no/">Kartverket</a>', className: 'grunnkart',
  });
  const graa = L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/webmercator/{z}/{y}/{x}.png', {
    maxZoom: 20, maxNativeZoom: 18, attribution: '© <a href="https://www.kartverket.no/">Kartverket</a>', className: 'grunnkart',
  });
  const flyfoto = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 20, maxNativeZoom: 19, attribution: 'Flyfoto © Esri, Maxar, Earthstar Geographics',
  });
  // Satellitt: Kartverkets skyfrie Sentinel-2-mosaikker per sommer, med sammenligning av to år (satellitt.js).
  satellitt = lagSatellittVisning(kart);
  grunnkart = { graa, topo, flyfoto, satellitt: satellitt.lag };
  const wms = (url, layers, navn) => L.tileLayer.wms(url, { layers, format: 'image/png', transparent: true, opacity: 0.6, attribution: `${navn} © NIBIO` });
  const overlays = {
    'SR16 Volum (NIBIO)': wms('https://wms.nibio.no/cgi-bin/sr16', 'SRRVOLMB', 'SR16'),
    'SR16 Treslag (NIBIO)': wms('https://wms.nibio.no/cgi-bin/sr16', 'SRRTRESLAG', 'SR16'),
    'SR16 Bonitet (NIBIO)': wms('https://wms.nibio.no/cgi-bin/sr16', 'SRRBONITET', 'SR16'),
    'SR16 Trehøyde (NIBIO)': wms('https://wms.nibio.no/cgi-bin/sr16', 'SRRHOYDEM', 'SR16'),
    'AR5 Arealtype (NIBIO)': wms('https://wms.nibio.no/cgi-bin/ar5', 'Arealtype', 'AR5'),
  };
  graa.addTo(kart);
  markslagLag = L.featureGroup().addTo(kart);
  bestandLag = L.featureGroup().addTo(kart);
  // Tiltak med egen flate (sporlogg/tegnet) over bestandene. Klikk går gjennom til bestandene og identifiseres der.
  kart.createPane('tiltakPane'); kart.getPane('tiltakPane').style.zIndex = 420; kart.getPane('tiltakPane').style.pointerEvents = 'none';
  tiltaksflateLag = L.layerGroup().addTo(kart);
  // Nøkkelbiotoper (MiS) og miljøfigurer i eget lag over bestandene, synlig i alle faner. Klikk går gjennom til bestandene.
  kart.createPane('misPane'); kart.getPane('misPane').style.zIndex = 450; kart.getPane('misPane').style.pointerEvents = 'none';
  misLag = L.featureGroup().addTo(kart);
  // SVG-mønstre for markslagssymbolene (myr, impediment, …) og MiS-skravur – brukes av kartet via fill="url(#…)".
  document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${monsterDefs('ms').replace('</defs>', `${misMonster('mis')}</defs>`)}</svg>`);
  etikettLag = L.layerGroup();
  regLag = L.featureGroup().addTo(kart);
  lagKontroll = L.control.layers({ 'Topografisk (gråtone)': graa, 'Topografisk': topo, 'Flyfoto': flyfoto, 'Satellitt (Sentinel-2, 2018–2025)': satellitt.lag }, { ...overlays, 'Tiltaksflater (sporlogg/tegnet)': tiltaksflateLag, 'Nøkkelbiotoper (MiS)': misLag, 'Markslag – uproduktiv mark (AR5)': markslagLag, 'Bestand': bestandLag, 'Registreringer': regLag }, { position: 'topleft' }).addTo(kart);
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(kart);

  kart.on('click', (e) => {
    if (kartKlikk) { kartKlikk(e.latlng); return; }
    if (deling) { leggTilDelepunkt(e.latlng); return; }
    if (tegning) { leggTilTegnepunkt(e.latlng); return; }
    settValgtPunkt(e.latlng);
  });
  kart.on('zoomend', () => { oppdaterEtiketter(); visMisMerker(); });
  kart.on('overlayadd overlayremove', () => { oppdaterEtiketter(); visMisMerker(); tegnLegend(); });
  // På flyfoto tegnes bestandene som i skogbruksplankart: gule grenser og hvit tekst.
  kart.on('baselayerchange', (e) => {
    flyfotoAktiv = e.layer === flyfoto || e.layer === satellitt.lag;
    kart.getContainer().classList.toggle('flyfoto', flyfotoAktiv);
    oppdaterStiler();
  });
}

// Viser satellittbildet for året som grunnkart, sammenlignet med året før (glideren i kartet), og zoomer til bestandet.
function visSatellittAar(aar, b) {
  for (const l of [grunnkart.graa, grunnkart.topo, grunnkart.flyfoto]) if (l && kart.hasLayer(l)) kart.removeLayer(l);
  const forrige = SATELLITT_AAR.includes(aar - 1) ? aar - 1 : null;
  satellitt.vis(aar, forrige); if (!kart.hasLayer(satellitt.lag)) satellitt.lag.addTo(kart);
  flyfotoAktiv = true; kart.getContainer().classList.add('flyfoto'); oppdaterStiler();
  if (b?.geometri) kart.fitBounds(L.geoJSON(b.geometri).getBounds(), { padding: [60, 60], maxZoom: 16 });
  melding(`Satellitt ${aar}${forrige ? ` – dra glideren nederst i kartet for å sammenligne med ${forrige}` : ''}.`);
}

function settValgtPunkt(ll) {
  if (valgtPunkt) valgtPunkt.setLatLng(ll); else valgtPunkt = L.circleMarker(ll, { radius: 6, color: css('--text'), weight: 2, fillOpacity: 0 }).addTo(kart);
}

let terrengCache = null;
// Tradisjonelle skogbruksplanfarger: I hvit, II gul, III lys grønn, IV grønn, V rød/oransje.
const HK_FARGER = ['#fcfdfe', '#f8f6a9', '#d9f6c7', '#9bd47f', '#ef9a7c'];
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
  if (modus === 'vegetasjon') return b.vegetasjon?.kode ? vegFarge(b.vegetasjon.kode) : null;
  if (modus === 'volum') return rampe(startTilstand(b).volumDaa, 0, 45);
  if (modus === 'tiltak') {
    const t = (b.tiltak || []).filter((x) => x.status !== 'utfort').sort((x, y) => x.aar - y.aar)[0];
    return t ? TILTAK_FARGER[TILTAKSTYPER[t.type]?.gruppe || 'annet'] : null;
  }
  if (/risiko$/.test(modus)) {
    const r = skogbrandVisning?.risiko(b.id, modus.replace('risiko', ''));
    return r ? r.nivaa.farge : null;
  }
  if (modus === 'terreng') {
    const d = terrengCache?.get(b.id)?.meter;
    return d === undefined || !Number.isFinite(d) ? null : rampe(d, 0, 1000);
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
  const rad = (farge, tekst) => `<div><i style="background:${farge}${HK_FARGER.includes(farge) ? ';box-shadow:inset 0 0 0 1.5px #1b1c19' : ''}"></i>${esc(tekst)}</div>`;
  let html = '';
  if (modus === 'hogstklasse' || modus === 'framskrevet') {
    if (modus === 'framskrevet') html += `<b>Hogstklasse i ${IAAR + Number($('#frAar').value)}</b>`;
    html += HOGSTKLASSER.map((h) => rad(HK_FARGER[h - 1], HK_NAVN[h])).join('');
    if (modus === 'hogstklasse' && S.bestand.some((b) => !hk(b))) html += rad('transparent;border:1px solid #999', 'Ukjent (mangler bonitet eller alder)');
  } else if (modus === 'treslag') html = Object.entries(TRESLAG).map(([k, v]) => rad(css(`--ts-${k.toLowerCase()}`), v)).join('');
  else if (modus === 'bonitet') html = '<b>Bonitet (H40)</b>' + [6, 11, 17, 23, 26].map((v) => rad(rampe(v, 6, 26), `${v}`)).join('');
  else if (modus === 'vegetasjon') {
    const koder = [...new Set(S.bestand.map((b) => b.vegetasjon?.kode).filter(Boolean))].sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b));
    html = '<b>Vegetasjonstype</b>' + koder.map((k) => rad(vegFarge(k), `${k} ${VEG_TYPER[k]?.navn || S.bestand.find((b) => b.vegetasjon?.kode === k).vegetasjon.navn}`)).join('')
      + (S.bestand.some((b) => !b.vegetasjon?.kode) ? rad('transparent;border:1px solid #999', 'Ikke satt') : '')
      + (S.bestand.some((b) => b.vegetasjon?.kilde === 'anslag') ? '<div class="hint" style="font-size:11px">Stiplet kant = anslått fra treslag og bonitet</div>' : '');
  } else if (modus === 'volum') html = '<b>Volum m³/daa</b>' + [0, 10, 20, 30, 45].map((v) => rad(rampe(v, 0, 45), v === 45 ? '45+' : `${v}`)).join('');
  else if (modus === 'terreng') html = '<b>Avstand til bilvei</b>' + [0, 250, 500, 750, 1000].map((v) => rad(rampe(v, 0, 1000), v === 1000 ? '1000 m +' : `${v} m`)).join('') + rad('transparent;border:1px solid #999', 'Ingen veier registrert');
  else if (/risiko$/.test(modus)) html = `<b>${$('#fargeEtter').selectedOptions[0].textContent}</b>` + [...RISIKONIVAA].reverse().map((n) => rad(n.farge, n.navn)).join('') + '<div class="hint" style="font-size:11px">Se Skogbrand → Forebygging</div>';
  else if (modus === 'tiltak') html = '<b>Første planlagte tiltak</b>' + rad(TILTAK_FARGER.hogst, 'Hogst') + rad(TILTAK_FARGER.kultur, 'Skogkultur') + rad(TILTAK_FARGER.annet, 'Annet') + rad('transparent;border:1px solid #999', 'Ingen');
  const kat = [...new Set((S.markslag || []).map((f) => f.kategori))];
  const mis = misFigurer(S);
  if (mis.length && kart.hasLayer(misLag)) {
    html += `<b style="display:block;margin-top:6px">Miljø</b>`;
    if (mis.some((f) => f.type === 'mis')) html += `<div><i style="${misLegendStil}"></i>Nøkkelbiotop (MiS)</div>`;
    if (mis.some((f) => f.type === 'miljofigur')) html += `<div><i style="${miljoLegendStil}"></i>Miljøfigur (bestand)</div>`;
  }
  const vr = S.veier || {};
  const harBil = (vr.veier || []).some((v) => (VEIKLASSER[v.klasse] || VEIKLASSER[0]).bilvei); const harTrak = (vr.veier || []).some((v) => !(VEIKLASSER[v.klasse] || VEIKLASSER[0]).bilvei);
  if (harBil || harTrak || vr.stier?.length) {
    const strek = (farge, monster, h = 3) => `<i style="height:${h}px;align-self:center;background:${monster ? `repeating-linear-gradient(90deg, ${farge} 0 ${monster[0]}px, transparent ${monster[0]}px ${monster[0] + monster[1]}px)` : farge}"></i>`;
    html += '<b style="display:block;margin-top:6px">Veier</b>'
      + (harBil ? `<div>${strek('#8a8a85', null, 4)}Bilvei</div>` : '')
      + (harTrak ? `<div>${strek(VEISTIL.traktorvei.farge, [6, 3])}Traktorvei</div>` : '')
      + (vr.stier?.length ? `<div>${strek(VEISTIL.sti.farge, [2, 4])}Sti</div>` : '');
  }
  if (kat.length && kart.hasLayer(markslagLag)) html += `<b style="display:block;margin-top:6px">Uproduktiv mark</b>${Object.keys(MARKSLAG).filter((k) => kat.includes(k)).map((k) => `<div>${symbolRute(k)} ${esc(MARKSLAG[k].kort)}</div>`).join('')}`;
  if (kart.hasLayer(tiltaksflateLag)) {
    const fl = synligeTiltaksflater(S, { iAar: IAAR });
    if (fl.length) html += `<b style="display:block;margin-top:6px">Tiltaksflater</b>${fl.some(({ t }) => t.status === 'utfort') ? '<div><i style="background:#1f8f5a;opacity:.6;box-shadow:inset 0 0 0 1.5px #0d4d30"></i>Utført (siste 2 år)</div>' : ''}${fl.some(({ t }) => t.status !== 'utfort') ? '<div><i style="background:repeating-linear-gradient(45deg,#2a78d6 0 3px,#cfe0f7 3px 6px);box-shadow:inset 0 0 0 1.5px #1d4f91"></i>Planlagt</div>' : ''}<div class="hint" style="font-size:11px">Klikk i flaten for å se tiltaket</div>`;
  }
  html += andreVisning?.legend() || '';
  $('#kartLegend').innerHTML = `<button type="button" class="legend-knapp" aria-expanded="${!legendLukket}">Tegnforklaring ${legendLukket ? '▸' : '▾'}</button><div class="legend-innhold" ${legendLukket ? 'hidden' : ''}>${html}</div>`;
}

// Flater registrert på tiltakene i valgt bestand (sporlogg eller tegnet), vist over bestandet.
let tiltaksflateLag = null; let valgtTiltakId = null;
function tegnTiltaksflater() {
  if (!tiltaksflateLag) return;
  tiltaksflateLag.clearLayers();
  for (const { t } of synligeTiltaksflater(S, { iAar: IAAR })) L.geoJSON(t.dekning, { pane: 'tiltakPane', style: tiltakStil(t, t.id === valgtTiltakId), interactive: false }).addTo(tiltaksflateLag);
}
// Klikk i kartet: ligger det tiltaksflater der, vises en liste med tiltakene og bestandet; ellers åpnes bestandet.
function identifiser(ll, b) {
  const h = (kart.hasLayer(tiltaksflateLag) ? treffVed(S, ll.lat, ll.lng, { iAar: IAAR }) : { tiltak: [], bestand: b });
  if (!h.tiltak.length) { velgBestand(b.id, { zoom: false }); visFane('bestand'); return; }
  const best = h.bestand || b;
  const div = document.createElement('div'); div.className = 'treff-popup';
  // Innholdet byttes ut ved klikk. Leaflet ser da ikke lenger at klikket var i popupen og lukker den – stopp klikket her.
  L.DomEvent.disableClickPropagation(div); div.addEventListener('click', (e) => e.stopPropagation());
  const liste = () => {
    valgtTiltakId = null; tegnTiltaksflater();
    div.innerHTML = `<b>Her ligger</b><div class="treff-liste">${h.tiltak.map(({ b: tb, t }, i) => `<button type="button" data-treff="${i}"><span class="treff-ikon ${t.status === 'utfort' ? 'utfort' : 'planlagt'}"></span><span><b>${esc(tiltakNavn(t))}</b><small>${esc(tiltakLinje(tb, t))} · bestand ${esc(tb.nr)}</small></span></button>`).join('')}
      <button type="button" data-treff="bestand"><span class="treff-ikon bestand"></span><span><b>Bestand ${esc(best.nr)}</b><small>${esc(TRESLAG[best.treslag] || '')}${best.bonitet ? ` · bonitet ${esc(best.bonitet)}` : ''} · ${fmt(best.areal, 1)} daa</small></span></button></div>`;
  };
  const kort = (i) => {
    const { b: tb, t } = h.tiltak[i]; valgtTiltakId = t.id; tegnTiltaksflater();
    const utfort = t.status === 'utfort';
    div.innerHTML = `<b>${esc(tiltakNavn(t))}</b> <span class="hint">${utfort ? 'utført' : 'planlagt'}</span>
      <dl class="treff-dl">${tiltakDetaljer(tb, t).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>${t.kommentar ? `<p class="hint" style="margin:4px 0">${esc(t.kommentar)}</p>` : ''}
      <div class="knapperad" style="margin:6px 0 0"><button type="button" class="knapp liten primar" data-k="endre">✎ Endre</button><button type="button" class="knapp liten" data-k="utfort">${utfort ? 'Angre utført' : '✓ Utført'}</button><button type="button" class="knapp liten" data-k="bestand">Bestand ${esc(tb.nr)}</button>${h.tiltak.length > 1 ? '<button type="button" class="knapp liten" data-k="tilbake">‹ Liste</button>' : ''}</div>`;
    div.onclick = (e) => {
      const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return;
      if (k === 'endre') { kart.closePopup(); aapneTiltakDialog(tb, t); }
      if (k === 'utfort') { settUtfort(tb, t, !utfort); endret({ kart: true }); if (valgtId === tb.id) visDetalj(); kort(i); }
      if (k === 'bestand') { kart.closePopup(); velgBestand(tb.id, { zoom: false }); visFane('bestand'); }
      if (k === 'tilbake') { liste(); div.onclick = listeKlikk; }
    };
  };
  const listeKlikk = (e) => {
    const v = e.target.closest('[data-treff]')?.dataset.treff; if (v == null) return;
    if (v === 'bestand') { kart.closePopup(); velgBestand(best.id, { zoom: false }); visFane('bestand'); return; }
    kort(Number(v));
  };
  if (h.tiltak.length === 1) kort(0); else { liste(); div.onclick = listeKlikk; }
  L.popup({ maxWidth: 320, minWidth: 240, className: 'treff-pop' }).setLatLng(ll).setContent(div).openOn(kart).on('remove', () => { valgtTiltakId = null; tegnTiltaksflater(); });
}
function stilFor(b) {
  const farge = fargeFor(b);
  const valgt = b.id === valgtId; const vs = valgModus && kartUtvalg?.type ? bestandStatus(S, kartUtvalg, b) : null;
  const ut = uthevet.has(b.id) || vs === 'valgt'; const kand = vs === 'kandidat';
  if (kand && !valgt) return { color: '#ff6a00', weight: 2.5, opacity: 0.95, dashArray: '6 5', fillColor: fargeFor(b) || '#999', fillOpacity: fargeFor(b) ? 0.7 : 0.08 };
  if (vs === 'valgt' && !valgt) return { color: '#ff6a00', weight: 3, opacity: 0.95, dashArray: null, fillColor: '#ff6a00', fillOpacity: 0.45 };
  return {
    color: valgt ? (flyfotoAktiv ? '#36e0ff' : '#ffd400') : ut ? '#ff6a00' : flyfotoAktiv ? '#e6e04b' : '#1b1c19', weight: valgt ? 3.5 : ut ? 3 : flyfotoAktiv ? 1.6 : 1.2, opacity: 0.9,
    fillColor: farge || '#999', fillOpacity: !farge ? 0.08 : flyfotoAktiv ? 0.3 : HK_FARGER.includes(farge) ? 0.85 : 0.7,
    // Anslått vegetasjonstype vises med stiplet kant, kartlagt med heltrukken.
    ...($('#fargeEtter').value === 'vegetasjon' && b.vegetasjon?.kilde === 'anslag' && !valgt ? { dashArray: '4 3' } : { dashArray: null }),
  };
}

// Nøkkelbiotoper (MiS) og miljøfigurer – felles stil fra miljokart.js.
let misNokkel = '';
function tegnMis(bareVedEndring = false) {
  const nokkel = misFigurer(S).map((f) => `${f.id}:${f.type}:${f.areal.toFixed(2)}`).join('|');
  if (bareVedEndring && nokkel === misNokkel) return;
  misNokkel = nokkel;
  misLag.clearLayers();
  const { flater, merker } = misKartlag(L, misFigurer(S), { pane: 'misPane' });
  flater.addTo(misLag); misMerker = merker; visMisMerker();
}
function visMisMerker() {
  if (!misMerker) return;
  const vis = kart.getZoom() >= 12 && kart.hasLayer(misLag);
  if (vis && !misLag.hasLayer(misMerker)) misMerker.addTo(misLag);
  if (!vis && misLag.hasLayer(misMerker)) misLag.removeLayer(misMerker);
}

let grenseLag = null;
function tegnMarkslag() {
  markslagLag.clearLayers();
  for (const f of S.markslag || []) {
    const m = MARKSLAG[f.kategori]; if (!m || !f.geometri) continue;
    const l = L.geoJSON(f.geometri, { style: { color: '#5b5346', weight: 0.8, opacity: 0.8, fillColor: symbolFyll(f.kategori), fillOpacity: 0.95 } });
    l.bindTooltip(`<b>${esc(f.nr)} ${esc(m.navn)}</b><br>${fmt(f.areal, 1)} daa${f.ar5?.treslag && f.ar5.treslag !== 'Ikke tresatt' ? ` · ${esc(f.ar5.treslag.toLowerCase())}` : ''}${f.ar5?.grunnforhold ? ` · ${esc(f.ar5.grunnforhold.toLowerCase())}` : ''}`, { sticky: true });
    l.on('click', (e) => { L.DomEvent.stopPropagation(e); if (kartKlikk) { kartKlikk(e.latlng); return; } if (deling) { leggTilDelepunkt(e.latlng); return; } if (tegning) leggTilTegnepunkt(e.latlng); });
    l.addTo(markslagLag);
  }
}

function tegnBestandKart(zoom = false) {
  tegnMarkslag();
  bestandLag.clearLayers(); lagPerBestand.clear(); etikettLag.clearLayers(); etikettPerBestand.clear();
  terrengCache = $('#fargeEtter').value === 'terreng' && veiVisning ? veiVisning.terrengtransport() : null;
  if (grenseLag) { grenseLag.remove(); grenseLag = null; }
  if (S.eiendom.grense) {
    grenseLag = L.geoJSON(S.eiendom.grense, { style: { color: '#d03b3b', weight: 2.5, dashArray: '8 5', fill: false }, interactive: false }).addTo(kart);
  }
  for (const b of S.bestand) {
    if (!b.geometri) continue;
    const lag = L.geoJSON(b.geometri, { style: () => stilFor(b) });
    lag.on('click', (e) => { L.DomEvent.stopPropagation(e); if (kartKlikk) { kartKlikk(e.latlng); return; } if (deling) { leggTilDelepunkt(e.latlng); return; } if (tegning) { leggTilTegnepunkt(e.latlng); return; } if (valgModus && kartVelg(b)) return; identifiser(e.latlng, b); });
    lag.addTo(bestandLag);
    lagPerBestand.set(b.id, lag);
    const pt = etikettPunkt(b.geometri);
    if (pt) etikettPerBestand.set(b.id, L.tooltip({ permanent: true, direction: 'center', className: 'bestand-etikett', interactive: false }).setLatLng([pt[1], pt[0]]).setContent(etikettHtml(b)).addTo(etikettLag));
  }
  tegnMis();
  oppdaterEtiketter();
  tegnLegend();
  tegnTiltaksflater();
  if (zoom) zoomTilAlle();
}

function oppdaterStiler() {
  tegnMis(true);
  terrengCache = $('#fargeEtter').value === 'terreng' && veiVisning ? veiVisning.terrengtransport() : null;
  for (const b of S.bestand) { lagPerBestand.get(b.id)?.setStyle(stilFor(b)); etikettPerBestand.get(b.id)?.setContent(etikettHtml(b)); }
  tegnLegend();
}

// Etikett som i skogbruksplankart: bestandsnr, hogstklasse/ treslag+bonitet og areal (daa).
function etikettHtml(b) {
  const h = hk(b);
  const ts = b.treslag ? `${b.treslag}${b.bonitet ?? ''}` : '';
  const k = h ? tetthet(b, { inn: inn(), hk: h }).klasse : null;
  return `<b>${esc(b.nr || '?')}</b><span class="mer">${h || '–'}${k || ''}/ ${esc(ts)}</span><span class="mer">${fmt(b.areal || 0, 2)}</span>`;
}
function oppdaterEtiketter() {
  const z = kart.getZoom();
  const vis = z >= 14 && kart.hasLayer(bestandLag);
  if (vis && !kart.hasLayer(etikettLag)) etikettLag.addTo(kart);
  if (!vis && kart.hasLayer(etikettLag)) etikettLag.remove();
  kart.getContainer().classList.toggle('etiketter-full', z >= 15);
  if (!vis) return;
  // Små flater på skjermen får bare bestandsnummer, eller ingen etikett, så etikettene ikke flyter over hverandre.
  for (const [id, t] of etikettPerBestand) {
    const el = t.getElement(); const lag = lagPerBestand.get(id); if (!el || !lag) continue;
    const bb = lag.getBounds(); const a = kart.latLngToLayerPoint(bb.getNorthWest()); const b = kart.latLngToLayerPoint(bb.getSouthEast());
    const bredde = Math.abs(b.x - a.x); const hoyde = Math.abs(b.y - a.y);
    el.classList.toggle('etikett-liten', bredde < 64 || hoyde < 48);
    el.classList.toggle('etikett-skjult', bredde < 22 || hoyde < 16);
  }
}

// Avgrensningsboks for den åpne planen.
function bboxFor() { return bbox([...S.bestand.map((b) => b.geometri), S.eiendom.grense].filter(Boolean)); }
function zoomTilAlle() {
  const bb = bbox([...S.bestand.map((b) => b.geometri), S.eiendom.grense]);
  if (bb) kart.fitBounds([[bb[1], bb[0]], [bb[3], bb[2]]], synligPadding(kart, 20));
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

// ---------------------------------------------------------------- dele et bestand i to med en tegnet linje
let deling = null; // { b, punkter, linje, forhandsvis, res }
let sisteDeling = null; // for «Angre deling»
const DEL_FARGER = ['#ff8a3d', '#36e0ff'];
function startDeling(b) {
  if (!b.geometri || !/Polygon/.test(b.geometri.type)) { melding('Bestandet har ingen flate i kartet som kan deles.'); return; }
  avsluttGrenseRedigering(); if (tegning) stoppTegning();
  deling = { b, punkter: [], linje: null, forhandsvis: L.layerGroup().addTo(kart), res: null };
  kart.doubleClickZoom.disable();
  kart.getContainer().style.cursor = 'crosshair';
  $('#delHjelp').hidden = false; $('#delFerdig').disabled = true;
  $('#delHjelp .tekst').textContent = `Del bestand ${b.nr}: klikk punkter for en linje tvers over bestandet.`;
  if (erMobil()) settArk('lav');
  const lag = lagPerBestand.get(b.id); if (lag) kart.fitBounds(lag.getBounds(), { ...synligPadding(kart, 60), maxZoom: 18 });
}
function tegnDeling() {
  const d = deling; const lls = d.punkter.map(([x, y]) => [y, x]);
  if (d.linje) d.linje.setLatLngs(lls); else d.linje = L.polyline(lls, { color: '#d03b3b', weight: 3, dashArray: '6 5', interactive: false }).addTo(kart);
  d.forhandsvis.clearLayers();
  d.punkter.forEach(([x, y]) => L.circleMarker([y, x], { radius: 4, color: '#fff', weight: 2, fillColor: '#d03b3b', fillOpacity: 1, interactive: false }).addTo(d.forhandsvis));
  d.res = d.punkter.length >= 2 ? delFlate(d.b.geometri, d.punkter) : null;
  if (d.res?.deler) {
    d.res.deler.forEach((g, i) => L.geoJSON(g, { interactive: false, style: { color: DEL_FARGER[i], weight: 3, fillColor: DEL_FARGER[i], fillOpacity: 0.35 } }).addTo(d.forhandsvis));
    const [a, b] = d.res.deler.map((g) => arealM2(g) / 1000);
    $('#delHjelp .tekst').textContent = `Bestand ${d.b.nr} deles i ${fmt(a, 1)} daa (oransje) og ${fmt(b, 1)} daa (blå).`;
  } else {
    $('#delHjelp .tekst').textContent = d.punkter.length < 2 ? `Del bestand ${d.b.nr}: klikk punkter for en linje tvers over bestandet.` : d.res.feil;
  }
  $('#delFerdig').disabled = !d.res?.deler;
}
function leggTilDelepunkt(ll) {
  const p = [ll.lng, ll.lat]; const sist = deling.punkter.at(-1);
  if (sist && Math.abs(sist[0] - p[0]) < 1e-9 && Math.abs(sist[1] - p[1]) < 1e-9) return; // dobbeltklikk gir to like punkter
  deling.punkter.push(p); tegnDeling();
}
function stoppDeling() {
  if (!deling) return;
  deling.linje?.remove(); deling.forhandsvis.remove();
  deling = null; $('#delHjelp').hidden = true;
  kart.doubleClickZoom.enable(); kart.getContainer().style.cursor = '';
}
function fullforDeling() {
  if (!deling?.res?.deler) { melding(deling?.res?.feil || 'Tegn en linje tvers over bestandet først.'); return; }
  const { b, res } = deling;
  const for_ = klon(b);
  const [ga, gb] = res.deler;
  const ny = {
    ...klon(b), id: nyId('b'), nr: nyttNr(b.nr, S.bestand.map((x) => x.nr)), geometri: gb, areal: runde(arealM2(gb) / 1000, 2),
    tiltak: (b.tiltak || []).map((t) => ({ ...klon(t), id: nyId('t') })),
    merknad: [b.merknad, `Delt fra bestand ${b.nr} ${new Date().toLocaleDateString('nb-NO')}`].filter(Boolean).join('. '),
  };
  b.geometri = ga; b.areal = runde(arealM2(ga) / 1000, 2);
  S.bestand.splice(S.bestand.indexOf(b) + 1, 0, ny);
  sisteDeling = { for: for_, nyId: ny.id };
  stoppDeling();
  endret({ kart: true });
  velgBestand(b.id, { zoom: false }); visFane('bestand');
  melding(`Bestand ${b.nr} er delt: ${fmt(b.areal, 1)} daa beholdt, ${fmt(ny.areal, 1)} daa ble bestand ${ny.nr}. Rediger data for hver del under.`, 6000);
}
function angreDeling() {
  if (!sisteDeling) return;
  const i = S.bestand.findIndex((x) => x.id === sisteDeling.for.id);
  if (i < 0) { sisteDeling = null; return; }
  S.bestand[i] = sisteDeling.for;
  S.bestand = S.bestand.filter((x) => x.id !== sisteDeling.nyId);
  const id = sisteDeling.for.id; sisteDeling = null;
  endret({ kart: true }); velgBestand(id, { zoom: false });
  melding('Delingen er angret.');
}

// ---------------------------------------------------------------- faner
let kommuneVisning = null;
let veiVisning = null;
let pefcVisning = null;
let verdiVisning = null;
let aiVisning = null;
let skogbrandVisning = null;
let skifteplanVisning = null;
const FANE_TITLER = { planer: 'Planer', kommune: 'Kommuneanalyse', oversikt: 'Oversikt', bestand: 'Bestand', tiltak: 'Tiltak', framskriving: 'Framskriving', veier: 'Veier', verdi: 'Verdiberegning', rapporter: 'Rapporter', skogbrand: 'Skogbrand', skifteplan: 'Skifteplan', ksl: 'KSL', karbon: 'Karbon', pefc: 'PEFC skogstandard', ai: 'Spør AI', felt: 'Felt', data: 'Data og oppsett' };
const erMobil = () => window.matchMedia('(max-width: 860px)').matches;
function settArk(tilstand) { $('#panel').dataset.ark = tilstand; }
function visFane(navn) {
  if (deling && navn !== 'bestand') stoppDeling();
  if (pefcVisning) { if (navn === 'pefc') setTimeout(() => pefcVisning.vis(), 0); else pefcVisning.skjul(); }
  if (skogbrandVisning) { if (navn === 'skogbrand') setTimeout(() => skogbrandVisning.vis(), 0); else skogbrandVisning.skjul(); }
  if (skifteplanVisning) { if (navn === 'skifteplan') setTimeout(() => skifteplanVisning.vis(), 0); else skifteplanVisning.skjul(); }
  veiVisning?.synlig(navn !== 'kommune');
  if (navn === 'veier') veiVisning?.vis();
  if (kommuneVisning) { if (navn === 'kommune') kommuneVisning.vis(); else { kommuneVisning.skjul(); tegnLegend(); } }
  $('.kartverktoy').hidden = navn === 'kommune';
  $$('.faner button').forEach((b) => b.classList.toggle('aktiv', b.dataset.fane === navn));
  $$('.fane').forEach((f) => { f.hidden = f.id !== `fane-${navn}`; });
  if (navn !== 'tiltak' && navn !== 'karbon' && uthevet.size) { uthevet = new Set(); oppdaterStiler(); }
  if (navn === 'tiltak' && !$('#oppdragPanel').hidden) oppdragVisning?.tegn();
  if (navn === 'ksl') kslVisning?.vis();
  if (navn === 'karbon') karbonVisning?.vis();
  if (navn === 'framskriving') tegnFramskriving();
  if (navn === 'verdi') verdiVisning?.tegn();
  if (navn === 'ai') aiVisning?.vis();
  if (navn === 'rapporter') tegnRapportKort();
  if (navn === 'planer') { tegnPlanListe(); lastKommuner(); }
  $('#faneTittel').textContent = FANE_TITLER[navn] || navn;
  $('.panel-innhold').scrollTop = 0;
  if (erMobil() && $('#panel').dataset.ark === 'lav') settArk('halv');
  if (!erMobil()) document.body.classList.remove('panel-skjult');
  setTimeout(() => kart.invalidateSize(), 50);
}

// ---------------------------------------------------------------- oversikt
function tegnInnsikt() {
  const liste = lagInnsikt(S, { iAar: IAAR, pefcFunn: pefcVisning?.funn(), motorEndringer: S.motor ? aktuelleEndringer().filter((e) => e.leggTil.length || e.fjern.length).length : 0, skogbrand: { ...skadeOppsummering(S), brann: S.skogbrand?.data?.brann?.dager?.[0]?.nivaa || null }, skifteplan: skifteplanVisning?.oppsummering() || null, ksl: kslVisning?.varsler() || [], karbon: karbonVisning?.varsler() || [], terrengtransport: S.veier?.veier?.length && veiVisning ? veiVisning.terrengtransport() : null, maksTerreng: veiVisning?.maks() ?? 500 });
  $('#innsikt').hidden = !liste.length;
  $('#innsiktListe').innerHTML = liste.slice(0, 4).map((i) => `<div class="innsikt-kort" style="--farge:${i.farge}"><span class="prikk"></span><div><b>${esc(i.tittel)}</b><span>${esc(i.tekst)}</span></div>${i.handling ? `<button type="button" class="knapp liten" data-innsikt="${esc(i.handling.id)}">${esc(i.handling.tekst)}</button>` : ''}</div>`).join('');
}

function utforHandling(id) {
  const [type, verdi] = id.split(/:(.*)/s);
  if (type === 'fane') visFane(verdi);
  else if (type === 'foresla') { visFane('tiltak'); kjorMotor(motorForhand || S.motor || {}); }
  else if (type === 'bestand') { velgBestand(verdi); visFane('bestand'); }
  else if (type === 'farge') { $('#fargeEtter').value = verdi; oppdaterStiler(); if (erMobil()) settArk('lav'); }
}

function tegnArealfordeling() {
  const el = $('#arealfordeling'); if (!el) return;
  if (!S.bestand.length) { el.closest('.kort').hidden = true; return; }
  el.closest('.kort').hidden = false;
  const a = arealfordeling(S);
  const har = (S.markslag || []).length;
  const rad = (k, r) => `<tr><td>${k === 'produktiv' ? `<span class="ms-rute" style="background:${MARKSLAG.produktiv.farge}"></span>` : symbolRute(k)}</td><td>${esc(MARKSLAG[k].navn)}</td><td class="tall">${r.antall}</td><td class="tall">${fmt(r.areal, 1)}</td><td class="tall">${fmt(a.total ? (r.areal / a.total) * 100 : 0, 1)}</td></tr>`;
  el.innerHTML = `${har ? `<div class="tabell-wrap"><table class="tabell ms-tabell"><thead><tr><th></th><th>Markslag</th><th class="tall">Figurer</th><th class="tall">Daa</th><th class="tall">%</th></tr></thead><tbody>
    ${Object.entries(a.rader).filter(([, r]) => r.areal > 0).map(([k, r]) => rad(k, r)).join('')}
    ${a.ukjent > 0.5 ? `<tr><td></td><td class="hint">Ikke klassifisert (avvik mellom AR5 og eiendomsgrensen)</td><td></td><td class="tall">${fmt(a.ukjent, 1)}</td><td class="tall">${fmt((a.ukjent / a.total) * 100, 1)}</td></tr>` : ''}</tbody>
    <tfoot><tr><td></td><td>Sum eiendom</td><td></td><td class="tall">${fmt(a.total, 1)}</td><td class="tall">100</td></tr></tfoot></table></div>` : '<p class="hint">Markslag er ikke hentet for denne planen. Uproduktiv mark (impediment, myr, åpen fastmark) kan da ligge inne i bestandene.</p>'}
    <div class="knapperad"><button type="button" class="knapp" id="hentMarkslag">${har ? 'Oppdater markslag (AR5)' : 'Hent markslag fra AR5'}</button>${har ? '<button type="button" class="knapp" id="trekkUtMarkslag">Trekk uproduktiv mark ut av bestandene</button>' : ''}</div>`;
  $('#hentMarkslag').onclick = hentMarkslagForPlan;
  if ($('#trekkUtMarkslag')) $('#trekkUtMarkslag').onclick = trekkUtMarkslag;
}

// Henter AR5 for eiendommen og lagrer markslagsfigurene i planen. Brukes av Oversikt og Skifteplan.
async function lastAr5(logg = () => {}) {
  const grense = S.eiendom.grense || (() => { const f = S.bestand.filter((b) => b.geometri).flatMap((b) => (b.geometri.type === 'Polygon' ? [b.geometri.coordinates] : b.geometri.coordinates)); return f.length ? { type: 'MultiPolygon', coordinates: f } : null; })();
  if (!grense) throw new Error('Planen mangler eiendomsgrense');
  const klipping = await lastKlipping();
  if (!klipping) throw new Error('Geometribiblioteket kunne ikke lastes');
  const foren = (gs) => { const mp = klipping.union(...gs.map((g) => g.coordinates)); return mp.length === 1 ? { type: 'Polygon', coordinates: mp[0] } : { type: 'MultiPolygon', coordinates: mp }; };
  const flater = await hentAr5(grense, { klipp: klippTil(grense, klipping), foren, logg });
  S.markslag = lagFigurer(flater, nyId);
  const sum = {}; for (const f of flater) sum[f.kategori] = (sum[f.kategori] || 0) + f.areal;
  S.metadata = { ...S.metadata, ar5: Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, Math.round(v * 10) / 10])) };
  S.datakilder = { ...S.datakilder, ar5: { id: 'ar5', navn: 'Markslag AR5', eier: 'NIBIO', hentet: new Date().toISOString(), antall: flater.length, krav: [3] } };
  endret({ kart: true });
  return S.markslag;
}
async function hentMarkslagForPlan() {
  const knapp = $('#hentMarkslag'); knapp.disabled = true;
  try {
    await lastAr5((t) => { knapp.textContent = t; });
    melding(`Markslag hentet: ${S.markslag.length} uproduktive figurer.`);
  } catch (e) { melding(`Kunne ikke hente markslag: ${e.message}`, 6000); tegnArealfordeling(); } finally { knapp.disabled = false; }
}

async function trekkUtMarkslag() {
  if (!confirm('Trekke uproduktiv mark (impediment, myr, åpen fastmark, jordbruk, bebyggelse og vann) ut av bestandene? Bestandsgrensene endres, og areal og volum reduseres.')) return;
  const klipping = await lastKlipping();
  if (!klipping) { melding('Geometribiblioteket kunne ikke lastes.'); return; }
  const r = trekkUtAvBestand(S, klipping);
  if (valgtId && !finnBestand(valgtId)) valgtId = null;
  endret({ kart: true });
  melding(r.endret || r.fjernet ? `${fmt(r.daa, 1)} daa uproduktiv mark trukket ut: ${r.endret} bestand endret${r.fjernet ? `, ${r.fjernet} fjernet` : ''}.` : 'Ingen bestand overlappet uproduktiv mark.', 6000);
}

function tegnOversikt() {
  tegnInnsikt();
  tegnArealfordeling();
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
  ].join('') : '<div class="kort tom">Ingen bestand ennå. <a href="#" data-gaa="planer">Lag en skogbruksplan</a> fra kommune, gårds- og bruksnummer, importer en plan under <a href="#" data-gaa="data">Data</a>, tegn bestand i kartet, eller <a href="#" id="demoLenke">last en demo-eiendom</a>.</div>';
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
      <td class="tall">${r.bonitet ?? ''}</td><td>${r.hogstklasse ? hkTekst(r.b, { inn: inn(), hk: r.hogstklasse }) : ''}</td>
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
  tegnTiltaksflater();
  tegnBestandTabell();
  visDetalj();
  const lag = lagPerBestand.get(id);
  if (id) $('#bestandDetalj').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  if (zoom && lag) kart.fitBounds(lag.getBounds(), { maxZoom: 16, ...synligPadding(kart, 40) });
  if (lag) lag.bringToFront();
}

function opsjoner(liste, valgt) { return liste.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(valgt ?? '') ? 'selected' : ''}>${esc(t)}</option>`).join(''); }

// Kilde og grunnlag for vegetasjonstypen, vist under feltet i bestandsdetaljen.
function vegKildeHtml(b) {
  const v = b.vegetasjon;
  if (!v) return `<span class="veg-kilde">Ikke satt.${S.bestand.some((x) => !x.vegetasjon) ? ' <button class="lenkeknapp" type="button" data-handling="hent-veg">Hent for planen</button>' : ''}</span>`;
  const pst = (x) => `${Math.round(x * 100)} %`;
  if (v.kilde === 'vk') return `<span class="veg-kilde">NIBIO vegetasjonskart${v.aar ? ` (${v.aar})` : ''}: ${v.typer.map((t) => `${esc(t.kode)} ${pst(t.andel)}`).join(', ')}${v.dekning < 0.95 ? ` – ${pst(v.dekning)} kartlagt` : ''}</span>`;
  if (v.kilde === 'anslag') return `<span class="veg-kilde">Anslått fra ${esc(v.grunnlag)} (${esc(v.skogtype)}) – ${v.kartlagt ? `vegetasjonskartet${v.kartlagt.aar ? ` (${v.kartlagt.aar})` : ''} viser ${v.kartlagt.typer.map((t) => `${esc(t.kode)} ${esc(t.navn.toLowerCase())} ${pst(t.andel)}`).join(', ')}` : 'ikke kartlagt her'}, kontroller i felt</span>`;
  return `<span class="veg-kilde">${v.kilde === 'import' ? 'Fra importert fil' : 'Satt manuelt'}</span>`;
}

// Vegetasjonstype for en plan som er laget før funksjonen fantes (eller importert uten typen).
async function hentVegetasjonForPlan() {
  melding('Henter vegetasjonskart fra NIBIO …');
  try {
    const r = await settVegetasjon(S.bestand, { klipping: await lastKlipping() });
    S.datakilder = { ...S.datakilder, vegetasjon: { id: 'vegetasjon', navn: 'Vegetasjonskart', eier: 'NIBIO', hentet: new Date().toISOString(), antall: r.flater, dataFra: r.aar ? `${r.aar}` : null, dataTil: r.aar ? `${r.aar}` : null, feil: r.feil, krav: [3] } };
    endret({ kart: true }); visDetalj();
    melding(r.kartlagt ? `Vegetasjonstype: ${r.kartlagt} bestand fra vegetasjonskartet, ${r.anslatt} anslått` : `Ikke vegetasjonskartlagt her – ${r.anslatt} bestand anslått fra treslag og bonitet${r.feil ? ` (${r.feil})` : ''}`);
  } catch (e) { melding(`Kunne ikke hente vegetasjonstype: ${e.message}`); }
}

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
        <button class="knapp liten" data-handling="skog3d" type="button" title="Gå rundt i skogen fra bakkenivå – også med VR-briller">🥽 Gå inn i skogen</button>
        <button class="knapp liten" data-handling="grense" type="button">${redigerMarkorer.length ? 'Ferdig' : 'Rediger grense'}</button>
        <button class="knapp liten" data-handling="del" type="button" title="Del bestandet i to med en linje">Del i to</button>
        ${sisteDeling && (sisteDeling.for.id === b.id || sisteDeling.nyId === b.id) ? '<button class="knapp liten" data-handling="angre-deling" type="button">Angre deling</button>' : ''}
        <button class="knapp liten fare" data-handling="slett" type="button">Slett</button>
      </div>
    </div>
    <div class="nokkeltall">
      <div><b>${fmt(s.volumDaa * (b.areal || 0))} m³</b><span>stående volum</span></div>
      <div><b>${fmt(tilv, 1)} m³/år</b><span>tilvekst (est.)</span></div>
      <div><b>${fmt(om10)} m³</b><span>volum om 10 år uten hogst</span></div>
      <div><b>${hm ? (hm <= IAAR ? 'Nå' : hm) : '–'}</b><span>hogstmoden${min ? ` (≥ ${min} år)` : ''}</span></div>
      <div><b>${fmt(s.volumDaa * (b.areal || 0) * rotnettoPerM3(b.treslag, inn()) / 1000)} k</b><span>kr rotnetto ved hogst nå</span></div>
      ${(() => { const a = veiVisning?.avstand(b.id); return a && Number.isFinite(a.meter) ? `<div><b>${fmt(a.meter)} m</b><span>til nærmeste bilvei${a.meter > veiVisning.maks() ? ' – lang terrengtransport' : ''}</span></div>` : ''; })()}
    </div>
    <form class="skjema tre-kol" id="detaljSkjema">
      <label>Bestandsnr <input name="nr" value="${esc(b.nr)}"></label>
      <label>Teig <input name="teig" value="${esc(b.teig)}"></label>
      <label>Areal (daa) <input name="areal" type="number" step="0.1" value="${b.areal ?? ''}"></label>
      <label>Treslag <select name="treslag">${opsjoner(Object.entries(TRESLAG), b.treslag)}</select></label>
      <label>Bonitet (H40) <select name="bonitet"><option value="">–</option>${opsjoner(BONITETER.map((v) => [v, `${b.treslag || 'G'}${v}`]), b.bonitet)}</select></label>
      <label>Hogstklasse <select name="hogstklasse"><option value="">Beregn fra alder${!b.hogstklasse && hk(b) ? ` (${HK_ROMERTALL[hk(b)]})` : ''}</option>${opsjoner(HOGSTKLASSER.map((h) => [h, HK_NAVN[h]]), b.hogstklasse)}</select>${(() => { const a = hogstklasseAvvik(b, inn()); return a ? `<span class="hk-avvik">Alder ${a.alder} år og bonitet ${esc(b.treslag || 'G')}${b.bonitet} tilsier hogstklasse ${HK_ROMERTALL[a.beregnet]} (III fra ${a.grenser.III}, IV fra ${a.grenser.IV}, V fra ${a.grenser.V} år). Velg «Beregn fra alder» hvis registreringen er utdatert.</span>` : ''; })()}</label>
      ${tetthetFeltHtml(b)}
      <label>Alder (år) <input name="alder" type="number" value="${b.alder ?? ''}"></label>
      <label>Volum (m³/daa) <input name="volumDaa" type="number" step="0.1" value="${b.volumDaa ?? ''}"></label>
      <label>Treantall (per daa) <input name="treantall" type="number" value="${b.treantall ?? ''}">${fraSr16(b) && erUngskog(b, inn()) ? `<span class="hint" style="font-weight:400">SR16 teller bare trær over 5 cm. Modell for alle stammer: ca. ${fmt(ungskogData(b, { inn: inn() }).treantallFor.verdi)}/daa (se Ungskog).</span>` : ''}</label>
      <label>Middelhøyde (m) <input name="hoyde" type="number" step="0.1" value="${b.hoyde ?? ''}">${(() => { const mh = middelhoyde(b, { inn: inn() }); return mh.kilde === 'registrert' && mh.verdi !== b.hoyde ? `<span class="hint" style="font-weight:400">${esc(mh.forklaring)}: ${fmt(mh.verdi, 1)} m – brukes i stedet.</span>` : ''; })()}</label>
      <label>Vegetasjonstype <select name="vegetasjon"><option value="">–</option>${opsjoner([...new Set([...SKOGTYPER, b.vegetasjon?.kode].filter(Boolean))].map((k) => [k, `${k} ${VEG_TYPER[k]?.navn || b.vegetasjon?.navn || ''}`]), b.vegetasjon?.kode)}</select>${vegKildeHtml(b)}</label>
      <label class="avkrysning" style="flex-direction:row;align-items:center;margin-top:18px"><input type="checkbox" name="miljo" ${b.miljo ? 'checked' : ''}> Miljøfigur / nøkkelbiotop</label>
      <label class="hel">Merknad <textarea name="merknad" rows="2">${esc(b.merknad)}</textarea></label>
    </form>
    ${ekstra.length ? `<details class="ekstra"><summary>Andre felt fra importen (${ekstra.length})</summary>${ekstra.map(([k, v]) => `<div><b>${esc(k)}</b>: ${esc(v)}</div>`).join('')}</details>` : ''}
    ${b.geometri ? `<details class="sat-detalj" id="satDetalj"${visDetalj.satAapen ? ' open' : ''}><summary>🛰 Satellittbilder ${SATELLITT_AAR[0]}–${SISTE_SATELLITTAAR} – se endringer siden taksten</summary><div id="satStripe"></div></details>` : ''}
    ${ungskogSeksjonHtml(b)}
    <h3 style="margin-top:14px">Tiltak for bestandet</h3>
    <div id="motorBanner">${motorBannerHtml(b)}</div>
    <div>${(b.tiltak || []).sort((x, y) => x.aar - y.aar).map((t) => tiltakRadHtml({ ...t, bestand: b })).join('') || '<div class="tom">Ingen tiltak registrert.</div>'}</div>
    <form class="verktoyrad" id="nyttTiltakSkjema">
      <select name="type">${opsjoner(Object.entries(TILTAKSTYPER).map(([k, v]) => [k, v.navn]))}</select>
      <input name="aar" type="number" value="${IAAR}" style="width:90px" aria-label="År">
      <select name="prioritet"><option value="1">Prioritet 1</option><option value="2" selected>Prioritet 2</option><option value="3">Prioritet 3</option></select>
      <button class="knapp primar" type="submit">Legg til</button>
    </form>`;

  // Satellittbildene lastes først når delen åpnes (åtte bilder per bestand).
  const satD = $('#satDetalj');
  if (satD) {
    const fyll = () => { if (satD.open && !$('#satStripe').innerHTML) $('#satStripe').innerHTML = bestandStripeHtml(b); };
    satD.addEventListener('toggle', () => { visDetalj.satAapen = satD.open; fyll(); }); fyll();
    satD.addEventListener('click', (e) => { const k = e.target.closest('[data-sat-aar]'); if (k) visSatellittAar(Number(k.dataset.satAar), b); });
  }
  $('#detaljSkjema').addEventListener('change', (e) => {
    const f = e.target; const navn = f.name;
    let v = f.type === 'checkbox' ? f.checked : f.value;
    if (['areal', 'alder', 'volumDaa', 'treantall', 'hoyde', 'bonitet', 'hogstklasse'].includes(navn)) v = v === '' ? null : Number(v);
    if (navn === 'tetthetsklasse') { b.tetthetsklasse = v || null; if (!v) delete b.tetthetsklasse; endret({ kart: true }); visDetalj(); return; }
    if (navn === 'vegetasjon') { b.vegetasjon = v ? { kode: v, navn: VEG_TYPER[v]?.navn || b.vegetasjon?.navn || v, kilde: 'manuell' } : null; endret({ kart: true }); visDetalj(); return; }
    b[navn] = v;
    if (['alder', 'volumDaa', 'treantall', 'hoyde'].includes(navn)) b.takstAar = IAAR; // registrert i år
    endret({ kart: false });
    if (navn === 'treslag') visDetalj();
    // Tiltaksmotoren sjekker om endringen gir nye eller utgåtte tiltak.
    clearTimeout(visDetalj.motorT); visDetalj.motorT = setTimeout(() => {
      const el = $('#motorBanner'); if (!el || valgtId !== b.id) return;
      el.innerHTML = motorBannerHtml(b);
      const us = $('#ungskogSeksjon'); const ny = ungskogSeksjonHtml(b);
      if (!!us !== !!ny) visDetalj(); else if (us && !us.contains(document.activeElement)) us.outerHTML = ny, kobleUngskog(b);
    }, 500);
  });
  kobleUngskog(b);
  $('#nyttTiltakSkjema').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = new FormData(e.target);
    b.tiltak.push({ id: nyId('t'), type: d.get('type'), aar: Number(d.get('aar')), prioritet: Number(d.get('prioritet')), status: 'planlagt', kommentar: '' });
    endret(); visDetalj();
  });
  boks.querySelector('[data-handling="zoom"]').onclick = () => velgBestand(b.id);
  boks.querySelector('[data-handling="skog3d"]').onclick = async () => {
    if (!b.geometri) { melding('Bestandet har ingen kartgeometri.'); return; }
    const { aapneVirtuellSkog } = await import('./skog3d.js');
    aapneVirtuellSkog({ S, b, inn: inn(), melding });
  };
  const vegKnapp = boks.querySelector('[data-handling="hent-veg"]'); if (vegKnapp) vegKnapp.onclick = hentVegetasjonForPlan;
  boks.querySelector('[data-handling="del"]').onclick = () => startDeling(b);
  const angre = boks.querySelector('[data-handling="angre-deling"]'); if (angre) angre.onclick = angreDeling;
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

// Tetthetsklasse a/b (SOSI SP_HKL): registrert, beregnet for HK II, hint for HK III–V.
function tetthetFeltHtml(b) {
  const h = hk(b); const t = tetthet(b, { inn: inn(), hk: h });
  const navn = h === 1 ? 'Rydding' : 'Tetthetsklasse';
  const tom = t.kilde === 'beregnet' ? `Beregn (${t.klasse} – ${tetthetNavn(h, t.klasse)})` : 'Ikke vurdert';
  return `<label>${navn} <select name="tetthetsklasse"><option value="">${esc(tom)}</option>${['a', 'b'].map((k) => `<option value="${k}" ${b.tetthetsklasse === k ? 'selected' : ''}>${k} – ${esc(tetthetNavn(h, k))}</option>`).join('')}</select><span class="hint" style="font-weight:400">${esc(t.kilde === 'registrert' ? 'Registrert' : t.hint || t.forklaring)}</span></label>`;
}

// Ungskogfelt (HK I–II) og økonomisk effekt av å gjennomføre eller ikke gjennomføre ungskogpleie/planting.
function ungskogSeksjonHtml(b) {
  if (!erUngskog(b, inn())) return '';
  const e = effektFor(b, { inn: inn(), vInn: { ...STANDARD_VERDI, ...S.verdi }, iAar: IAAR });
  const planlagt = e && (b.tiltak || []).some((t) => t.type === e.type && t.status !== 'utfort');
  return `<div id="ungskogSeksjon" class="ungskog-seksjon">
    <h3 style="margin-top:14px">Ungskog (hogstklasse ${HK_ROMERTALL[hk(b)]})</h3>
    <p class="hint" style="margin:0">Tomme felt viser beregnet verdi. Skriv inn målte verdier for å overstyre – de brukes av tiltaksmotoren og effektberegningen.</p>
    ${ungskogHtml(ungskogData(b, { inn: inn() }), { inputs: true })}
    ${e ? `<h3 style="margin-top:10px">Effekt av ${e.type === 'ungskogpleie' ? 'ungskogpleie' : 'planting'}</h3>${effektHtml(e)}
      ${planlagt ? '' : `<div class="knapperad"><button class="knapp liten primar" type="button" data-handling="effekt-tiltak" data-type="${e.type}">Legg til ${e.type === 'ungskogpleie' ? 'ungskogpleie' : 'planting'} ${IAAR}</button></div>`}` : ''}
  </div>`;
}

function kobleUngskog(b) {
  const us = $('#ungskogSeksjon'); if (!us) return;
  us.addEventListener('change', (e) => {
    const f = e.target.closest('[data-ungskog]'); if (!f) return;
    if (!settUngskog(b, f.dataset.ungskog, f.value.trim())) { melding('Ugyldig verdi.'); f.focus(); return; }
    endret(); visDetalj();
  });
  us.querySelector('[data-handling="effekt-tiltak"]')?.addEventListener('click', (e) => {
    b.tiltak = b.tiltak || [];
    b.tiltak.push({ id: nyId('t'), type: e.currentTarget.dataset.type, aar: IAAR, prioritet: 1, status: 'planlagt', kommentar: 'Lagt til fra effektberegningen' });
    endret(); visDetalj();
  });
}

// ---------------------------------------------------------------- tiltak
function alleTiltak() {
  return S.bestand.flatMap((b) => (b.tiltak || []).map((t) => ({ ...t, bestand: b })));
}

function tiltakOkonomi(t) {
  // Tiltak registrert med sporlogg har eget areal (dekningen), ellers hele bestandet.
  const b = t.bestand; const areal = t.arealDaa ?? b.areal ?? 0;
  if (HOGSTTYPER.includes(t.type)) {
    const aarFrem = Math.max(0, (t.aar || IAAR) - IAAR);
    const v = framskriv([b], aarFrem, inn(), { folgPlan: false }).perBestand.get(b.id)[aarFrem].volumDaa * areal;
    const m3 = v * hogstAndel(t.type, inn(), t);
    const netto = m3 * hogstNettoPerM3(t.type, b.treslag, inn());
    const brutto = m3 * (inn().pris[b.treslag] ?? inn().pris.G);
    return { m3, netto, skogfond: brutto * inn().skogfondProsent / 100 };
  }
  return { m3: 0, netto: -tiltakKostnad(t.type, areal, inn()), skogfond: 0 };
}

// «Hvorfor?» for tiltak fra tiltaksmotoren: begrunnelse og faglige kilder.
function begrunnelseHtml(t) {
  const tekst = t.begrunnelse || t.motor?.begrunnelse; if (!tekst) return '';
  const kilder = t.kilder || t.motor?.kilder || [];
  return `<details class="begrunnelse"><summary><span class="auto-merke">Auto</span> Hvorfor?${(t.periode || t.motor?.periode) === 'lang' ? ' · lang sikt' : ''}</summary><p>${esc(tekst)}</p>${kilder.length ? `<ul>${kilder.map((k) => MOTOR_KILDER[k]).filter(Boolean).map((k) => `<li>${k.url ? `<a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.navn)}</a>` : esc(k.navn)}</li>`).join('')}</ul>` : ''}</details>`;
}

// Merke på tiltak som ligger i et oppdrag (trykk åpner oppdraget).
function oppdragMerke(t) {
  const o = t.oppdragId && (S.oppdrag || []).find((x) => x.id === t.oppdragId); if (!o) return '';
  const st = OPPDRAGSSTATUS[o.status] || OPPDRAGSSTATUS.utkast;
  return ` <a href="#" class="oppdrag-merke" data-handling="oppdrag" data-oppdrag="${o.id}" style="--farge:${st.farge}">${esc(o.nr)} · ${esc(st.navn)}</a>`;
}

function tiltakRadHtml(t, { velg = false } = {}) {
  const b = t.bestand; const ok = tiltakOkonomi(t);
  const utfort = t.status === 'utfort';
  const kanVelges = velg && !t.forslag && tiltakLedig(t, S.oppdrag) && (!maalOppdrag || oppdragstype(t.type) === oppdragstype(maalOppdrag.type));
  return `<div class="tiltak-rad ${utfort ? 'status-utfort' : ''} ${t.forslag ? 'forslag' : ''} ${velg ? 'velgbar' : ''} ${valgteTiltak.has(t.id) ? 'valgt' : ''}" data-bestand="${b.id}" data-tiltak="${t.id || ''}">
    ${velg && !t.forslag ? `<input type="checkbox" class="velg-tiltak" data-handling="velg" aria-label="Velg tiltaket" ${valgteTiltak.has(t.id) ? 'checked' : ''} ${kanVelges ? '' : 'disabled'}>` : ''}
    ${t.forslag ? `<button class="knapp liten primar" data-handling="godta" type="button">Legg til</button>` : `<button class="knapp liten utfort-knapp${utfort ? ' er-utfort' : ''}" data-handling="utfort" type="button" aria-pressed="${utfort}" title="${utfort ? 'Angre – sett tilbake til planlagt' : 'Marker som utført'}">${utfort ? '✓ Utført' : 'Utført'}</button>`}
    <div>
      <div class="tittel">${esc(TILTAKSTYPER[t.type]?.navn || t.type)} – bestand <a href="#" data-handling="vis">${esc(b.nr)}</a> <span class="hint">${t.aar}${utfort && t.utfortDato ? `, utført ${esc(t.utfortDato)}` : ''}</span>${oppdragMerke(t)}</div>
      <div class="info">${t.arealDaa != null && t.arealDaa < (b.areal || 0) - 0.05 ? `${fmt(t.arealDaa, 1)} av ${fmt(b.areal, 1)} daa` : `${fmt(b.areal, 1)} daa`} · ${b.treslag || ''}${b.bonitet ?? ''}${ok.m3 ? ` · ca. ${fmt(ok.m3)} m³` : ''} · ${ok.netto >= 0 ? 'netto' : 'kostnad'} ca. ${fmt(Math.abs(ok.netto))} kr${ok.skogfond ? ` · skogfond ${fmt(ok.skogfond)} kr` : ''}${t.kommentar ? ` · ${esc(t.kommentar)}` : ''}</div>
      ${begrunnelseHtml(t)}
    </div>
    <div style="display:flex;gap:6px;align-items:center">${t.prioritet ? `<span class="prio prio-${t.prioritet}">P${t.prioritet}</span>` : ''}<button class="knapp liten" data-handling="zoom" type="button" title="Zoom til bestand ${esc(b.nr)} i kartet" aria-label="Zoom til bestand">🔍</button>${t.forslag ? '' : '<button class="knapp liten" data-handling="endre-tiltak" type="button" title="Endre tiltak" aria-label="Endre">✎</button><button class="knapp liten" data-handling="slett-tiltak" type="button" title="Slett tiltak" aria-label="Slett">✕</button>'}</div>
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
    return `<div class="tiltak-aar"><h4>${aar}${aar < IAAR && status !== 'utfort' ? ' ⚠️ forfalt' : ''}<span>${m3 ? `${fmt(m3)} m³ · ` : ''}netto ${fmt(netto)} kr${fond ? ` · skogfond ${fmt(fond)} kr` : ''}</span></h4>${ts.map((t) => tiltakRadHtml(t, { velg: valgModus })).join('')}</div>`;
  }).join('') || '<div class="tom">Ingen tiltak i utvalget.</div>';
  tegnValgLinje();
  $('#motorPanel').innerHTML = motorKortHtml() + endringerHtml();
  const motor = forslag.some((f) => f.motorForslag);
  const gruppe = (navn, liste) => (liste.length ? `<h4 class="forslag-gruppe">${navn} <span class="hint">${liste.length} tiltak</span></h4>${liste.map(tiltakRadHtml).join('')}` : '');
  const o = motor ? motorOppsummer(forslag.map((f) => ({ ...f, b: f.bestand })), S) : null;
  $('#forslagListe').innerHTML = forslag.length ? `<div class="kort"><div class="detalj-topp"><h3>${motor ? `Tiltaksmotor – ${esc(PRINSIPPER[motorForhand?.prinsipp]?.navn || '')}` : 'Forslag'} (${forslag.length})</h3><div class="knapperad" style="margin:0"><button class="knapp liten primar" id="godtaAlle" type="button">Legg til alle</button><button class="knapp liten" id="forkastForslag" type="button">Forkast</button></div></div>
    ${o ? `<p class="hint" style="margin:0 0 8px">${esc(o.tekst)}. ${motorForhand?.erstatt ? 'Tidligere automatiske tiltak som ikke er utført, erstattes. ' : ''}Manuelle tiltak beholdes.</p>` : ''}
    ${motor ? gruppe(`Kort sikt (${IAAR}–${IAAR + 9})`, forslag.filter((f) => f.periode === 'kort')) + gruppe(`Lang sikt (${IAAR + 10}–${IAAR + (motorForhand?.horisont || 30) - 1})`, forslag.filter((f) => f.periode !== 'kort')) : forslag.map(tiltakRadHtml).join('')}</div>` : '';
  const ga = $('#godtaAlle'); if (ga) ga.onclick = () => {
    if (motor && motorForhand?.erstatt) for (const b of S.bestand) if (!motorRyddet.has(b.id)) { b.tiltak = (b.tiltak || []).filter((t) => !(t.kilde === 'motor' && t.status !== 'utfort')); motorRyddet.add(b.id); }
    forslag.forEach(godtaForslag);
    if (motor) { for (const b of S.bestand) merkKjort(b, motorForhand.prinsipp); S.motor = { prinsipp: motorForhand.prinsipp, horisont: motorForhand.horisont, kjort: new Date().toISOString().slice(0, 10), versjon: MOTOR_VERSJON }; melding(`${forslag.length} tiltak lagt inn i tiltaksplanen.`); }
    forslag = []; motorRyddet = new Set(); endret();
  };
  const fk = $('#forkastForslag'); if (fk) fk.onclick = () => { forslag = []; tegnTiltak(); };
}

let motorForhand = null; let motorRyddet = new Set();
function godtaForslag(f) {
  if (f.motorForslag) {
    const b = f.bestand;
    // Første gang et bestand får motortiltak: fjern gamle automatiske, planlagte tiltak (ved «erstatt»).
    if (motorForhand?.erstatt && !motorRyddet.has(b.id)) { b.tiltak = (b.tiltak || []).filter((t) => !(t.kilde === 'motor' && t.status !== 'utfort')); motorRyddet.add(b.id); }
    b.tiltak.push(tilTiltak({ ...f, b }));
    delete b.tiltak.at(-1).bestand; delete b.tiltak.at(-1).forslag; delete b.tiltak.at(-1).motorForslag;
    return;
  }
  const { bestand, forslag: _, ...t } = f;
  bestand.tiltak.push({ ...t, id: nyId('t'), status: 'planlagt' });
}

// Kjører tiltaksmotoren og viser forslagene i Tiltak-fanen.
function kjorMotor({ prinsipp = 'balansert', horisont = 30, erstatt = true } = {}) {
  motorForhand = { prinsipp, horisont, erstatt }; motorRyddet = new Set();
  const grunnlag = erstatt ? { ...S, bestand: S.bestand.map((b) => ({ ...b, tiltak: (b.tiltak || []).filter((t) => !(t.kilde === 'motor' && t.status !== 'utfort')) })) } : S;
  const f = genererTiltak(grunnlag, { iAar: IAAR, horisont, prinsipp });
  forslag = f.map(({ b, ...x }) => ({ ...x, id: nyId('f'), bestand: finnBestand(b.id), forslag: true, motorForslag: true }));
  tegnTiltak();
  $('#forslagListe').scrollIntoView({ block: 'start', behavior: 'smooth' });
  melding(forslag.length ? `${forslag.length} forslag fra tiltaksmotoren. Se gjennom og legg til.` : 'Tiltaksmotoren fant ingen nye tiltak.');
}

function motorKortHtml() {
  const v = motorForhand || S.motor || { prinsipp: 'balansert', horisont: 30 };
  return `<details class="kort motor-kort" ${S.motor ? '' : 'open'}><summary><b>Tiltaksmotor</b> <span class="hint">${S.motor ? `sist kjørt ${esc(S.motor.kjort)} (${esc(PRINSIPPER[S.motor.prinsipp]?.navn || '')})` : 'lag tiltak automatisk ut fra biologi, bærekraft og økonomi'}</span></summary>
    <p class="hint">Motoren foreslår flatehogst eller lukket hogst, tynning, markberedning, planting og ungskogpleie for hvert bestand, på kort (0–10 år) og lang sikt. Den bruker bonitet, treslag, alder, høyde, treantall, PEFC-hensyn, stormrisiko og forventningsverdi, og fordeler hogsten slik at avvirkningen holder seg nær tilveksten.</p>
    <div class="motor-prinsipper">${Object.entries(PRINSIPPER).map(([k, p]) => `<label class="motor-prinsipp"><input type="radio" name="motorPrinsipp" value="${k}" ${v.prinsipp === k ? 'checked' : ''}><span><b>${esc(p.navn)}</b><small>${esc(p.beskrivelse)}</small></span></label>`).join('')}</div>
    <div class="verktoyrad"><label>Horisont <select id="motorHorisont">${[10, 20, 30].map((a) => `<option value="${a}" ${Number(v.horisont) === a ? 'selected' : ''}>${a} år</option>`).join('')}</select></label>
      <label class="avkrysning"><input type="checkbox" id="motorErstatt" checked> Erstatt tidligere automatiske tiltak</label>
      <button class="knapp primar" id="motorKjor" type="button">Lag forslag</button></div>
    <details class="motor-kilder"><summary>Faglig grunnlag</summary><ul>${Object.values(MOTOR_KILDER).map((k) => `<li>${k.url ? `<a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.navn)}</a>` : esc(k.navn)}</li>`).join('')}</ul></details>
  </details>`;
}

// Endringer på bestand siden motoren sist kjørte.
let endringCache = { nokkel: '', liste: [] };
function aktuelleEndringer() {
  if (!S.motor) return [];
  const nokkel = S.bestand.map((b) => `${b.id}:${b.motor?.signatur || ''}:${motorSignatur(b)}:${(b.tiltak || []).map((t) => `${t.id}${t.status}`).join(',')}`).join('|');
  if (nokkel !== endringCache.nokkel) { endringCache = { nokkel, liste: motorEndringer(S, { iAar: IAAR }) }; }
  return endringCache.liste;
}
function endringTekst(e) {
  return [...e.leggTil.map((f) => `+ ${TILTAKSTYPER[f.type].navn} ${f.aar}`), ...e.fjern.map((t) => `− ${TILTAKSTYPER[t.type].navn} ${t.aar}`)].join(' · ') || 'Ingen endringer i tiltakene';
}
function motorBannerHtml(b) {
  const e = aktuelleEndringer().find((x) => x.b.id === b.id && (x.leggTil.length || x.fjern.length));
  if (!e) return '';
  return `<div class="motor-banner" data-bestand="${b.id}"><div><span class="auto-merke">Auto</span> <b>Bestandet er endret</b> – tiltaksmotoren foreslår: ${esc(endringTekst(e))}</div>
    <div class="knapperad" style="margin:0"><button class="knapp liten primar" data-motor-endring="oppdater" type="button">Oppdater tiltak</button><button class="knapp liten" data-motor-endring="behold" type="button">Behold som det er</button></div></div>`;
}

function endringerHtml() {
  const liste = aktuelleEndringer().filter((e) => e.leggTil.length || e.fjern.length);
  if (!liste.length) return '';
  return `<div class="kort motor-endringer"><div class="detalj-topp"><h3>Endrede bestand (${liste.length})</h3><div class="knapperad" style="margin:0"><button class="knapp liten primar" data-motor-endring="alle" type="button">Oppdater alle</button></div></div>
    <p class="hint" style="margin:0 0 6px">Disse bestandene er endret siden tiltaksplanen ble laget. Tiltaksmotoren foreslår:</p>
    ${liste.map((e) => `<div class="motor-endring" data-bestand="${e.b.id}"><a href="#" data-vis="${e.b.id}"><b>${esc(e.b.nr)}</b></a><span>${esc(endringTekst(e))}</span><span class="knapperad" style="margin:0"><button class="knapp liten" data-motor-endring="oppdater" type="button">Oppdater</button><button class="knapp liten" data-motor-endring="behold" type="button">Behold</button></span></div>`).join('')}</div>`;
}
function handterEndring(e) {
  const k = e.target.closest('[data-motor-endring]'); if (!k) return;
  const h = k.dataset.motorEndring;
  const liste = aktuelleEndringer();
  const valgte = h === 'alle' ? liste : liste.filter((x) => x.b.id === k.closest('[data-bestand]')?.dataset.bestand);
  for (const x of valgte) { if (h === 'behold') merkKjort(x.b, S.motor.prinsipp); else motorOppdaterBestand(S, x); }
  endringCache.nokkel = '';
  endret(); if (valgtId) visDetalj();
  melding(h === 'behold' ? 'Tiltakene beholdes som de er.' : `Tiltakene er oppdatert for ${valgte.length} bestand.`);
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
  if (h === 'oppdrag') { e.preventDefault(); visFane('tiltak'); visTiltakVisning('oppdrag'); oppdragVisning?.apne(e.target.dataset.oppdrag); return; }
  if (h === 'velg') { const id = rad.dataset.tiltak; if (kartUtvalg) settValgt(kartUtvalg, id, e.target.checked); else if (e.target.checked) valgteTiltak.add(id); else valgteTiltak.delete(id); rad.classList.toggle('valgt', e.target.checked); tegnValgLinje(); oppdaterStiler(); return; }
  const t = b.tiltak.find((x) => x.id === rad.dataset.tiltak);
  if (h === 'vis') { e.preventDefault(); velgBestand(b.id); visFane('bestand'); return; }
  if (h === 'zoom') { velgBestand(b.id); if (erMobil()) settArk('lav'); return; }
  if (h === 'godta') { const f = forslag.find((x) => x.id === rad.dataset.tiltak); if (f) { godtaForslag(f); forslag = forslag.filter((x) => x !== f); endret(); } return; }
  if (!t) return;
  if (h === 'slett-tiltak') { if (!confirm(slettTekst(b, t))) return; slettTiltak(S, b, t); endret(); if (valgtId === b.id) visDetalj(); melding('Tiltaket er slettet.'); return; }
  if (h === 'endre-tiltak') { aapneTiltakDialog(b, t); return; }
  if (h === 'utfort') { settUtfort(b, t, t.status !== 'utfort'); endret(); if (valgtId === b.id) visDetalj(); }
}

// Dialog for å endre et tiltak (type, status, år/dato, areal, prioritet, kommentar).
function aapneTiltakDialog(b, t, feil = [], utkast = null) {
  const d = $('#tiltakDialog'); const v = { ...skjemaVerdier(b, t), ...(utkast || {}) };
  const utfort = v.status === 'utfort'; const idag = new Date().toISOString().slice(0, 10);
  d.innerHTML = `<form method="dialog" class="skjema to-kol" id="tiltakDialogSkjema">
    <h3 class="hel">Endre tiltak – bestand ${esc(b.nr)}</h3>
    ${t.kilde === 'motor' ? '<p class="hint hel">Laget av tiltaksmotoren. Når du endrer det, blir det et manuelt tiltak som motoren ikke erstatter.</p>' : ''}
    ${feil.length ? `<div class="feilboks hel">${feil.map(esc).join('<br>')}</div>` : ''}
    <label>Tiltak<select name="type">${Object.entries(TILTAKSTYPER).map(([k, x]) => `<option value="${k}" ${k === v.type ? 'selected' : ''}>${esc(x.navn)}</option>`).join('')}</select></label>
    <label>Status<select name="status">${Object.entries(STATUSER).map(([k, n]) => `<option value="${k}" ${k === v.status ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <label data-vis-planlagt ${utfort ? 'hidden' : ''}>År<input type="number" name="aar" value="${esc(v.aar)}" min="1950" max="2150"></label>
    <label data-vis-utfort ${utfort ? '' : 'hidden'}>Utført dato<input type="date" name="utfortDato" value="${esc(v.utfortDato || idag)}" max="${idag}"></label>
    <label>Prioritet<select name="prioritet"><option value="">–</option>${[1, 2, 3].map((p) => `<option value="${p}" ${Number(v.prioritet) === p ? 'selected' : ''}>P${p}</option>`).join('')}</select></label>
    <label class="avkryss"><input type="checkbox" name="helt" ${v.helt ? 'checked' : ''}> Hele bestandet (${fmt(b.areal, 1)} daa)</label>
    <label data-areal ${v.helt ? 'hidden' : ''}>Areal (daa)<input type="text" inputmode="decimal" name="arealDaa" value="${esc(String(v.arealDaa ?? '').replace('.', ','))}"></label>
    <label class="hel">Kommentar<textarea name="kommentar" rows="2">${esc(v.kommentar)}</textarea></label>
    <div class="hel knapperad" style="margin:0;align-items:center"><button type="button" class="knapp" data-d="flate">✎ ${t.dekning ? 'Endre flate i kartet' : 'Tegn flate i kartet'}</button><span class="hint">${t.dekning ? `Flate registrert: ${fmt(t.arealDaa ?? b.areal, 1)} daa` : 'Ingen flate – gjelder hele bestandet eller arealet over'}</span></div>
    ${t.dekning ? '<label class="avkryss hel"><input type="checkbox" name="fjernDekning"> Fjern registrert flate</label>' : ''}
    <div class="knapperad hel"><button type="button" class="knapp fare" data-d="slett">Slett</button><span style="flex:1"></span><button type="button" class="knapp" data-d="avbryt">Avbryt</button><button type="submit" class="knapp primar">Lagre</button></div>
  </form>`;
  const f = $('#tiltakDialogSkjema');
  const les = () => { const fd = new FormData(f); return { type: fd.get('type'), status: fd.get('status'), aar: fd.get('aar'), utfortDato: fd.get('utfortDato'), prioritet: fd.get('prioritet'), helt: fd.get('helt') === 'on', arealDaa: fd.get('arealDaa') ?? '', kommentar: fd.get('kommentar'), fjernDekning: fd.get('fjernDekning') === 'on' }; };
  f.elements.status.onchange = () => { const u = f.elements.status.value === 'utfort'; f.querySelector('[data-vis-planlagt]').hidden = u; f.querySelector('[data-vis-utfort]').hidden = !u; };
  f.elements.helt.onchange = () => { f.querySelector('[data-areal]').hidden = f.elements.helt.checked; };
  f.querySelector('[data-d="avbryt"]').onclick = () => d.close();
  f.querySelector('[data-d="flate"]').onclick = async () => {
    const utkastNaa = les(); d.close();
    const PC = await lastKlipping(); if (!PC) { melding('Geometribiblioteket kunne ikke lastes. Sjekk nettforbindelsen.'); aapneTiltakDialog(b, t, [], utkastNaa); return; }
    if (erMobil()) settArk('lav');
    let red = null;
    const ferdig = () => { kartKlikk = null; };
    red = startFlateRedigering({
      L, kart, PC, start: t.dekning || null, bestand: b, tittel: `${TILTAKSTYPER[t.type]?.navn || ''} i ${b.nr}`, plassering: 'full',
      vedFerdig: ({ geometri, daa, andel }) => {
        ferdig();
        if (geometri) { t.dekning = geometri; if (andel >= 0.995) { delete t.arealDaa; utkastNaa.helt = true; } else { t.arealDaa = daa; utkastNaa.helt = false; utkastNaa.arealDaa = daa; } } else delete t.dekning;
        utkastNaa.fjernDekning = false; t.endret = new Date().toISOString().slice(0, 10);
        endret({ kart: true }); tegnTiltaksflater(); melding(geometri ? `Flaten er endret: ${fmt(daa, 1)} daa.` : 'Flaten er fjernet.');
        aapneTiltakDialog(b, t, [], utkastNaa);
      },
      vedAvbryt: () => { ferdig(); aapneTiltakDialog(b, t, [], utkastNaa); },
    });
    kartKlikk = (ll) => red.klikk(ll);
  };
  f.querySelector('[data-d="slett"]').onclick = () => { if (!confirm(slettTekst(b, t))) return; slettTiltak(S, b, t); d.close(); endret(); if (valgtId === b.id) visDetalj(); melding('Tiltaket er slettet.'); };
  f.onsubmit = (e) => {
    e.preventDefault(); const u = les();
    const r = endreTiltak(b, t, u);
    if (!r.ok) { aapneTiltakDialog(b, t, r.feil, u); return; }
    d.close(); endret({ kart: true }); if (valgtId === b.id) visDetalj(); melding('Tiltaket er endret.');
  };
  if (!d.open) d.showModal();
}

// Marker et tiltak som utført (eller tilbake til planlagt), og tilby å oppdatere bestandet etter tiltaket.
function settUtfort(b, t, ferdig) {
  t.status = ferdig ? 'utfort' : 'planlagt';
  t.utfortDato = ferdig ? new Date().toISOString().slice(0, 10) : undefined;
  if (ferdig && t.type === 'sluttavvirkning' && confirm(`Oppdatere bestand ${b.nr} til hogstklasse I (alder 0, volum 0)?`)) {
    b.hogstklasse = null; b.alder = 0; b.volumDaa = 0; b.treantall = null; b.hoyde = null; // alder 0 → beregnet hogstklasse I
  }
  if (ferdig && t.type === 'lukkethogst' && b.volumDaa && confirm(`Redusere volumet i bestand ${b.nr} med uttaket (${Math.round(hogstAndel('lukkethogst', inn(), t) * 100)} %)?`)) b.volumDaa = runde(b.volumDaa * (1 - hogstAndel('lukkethogst', inn(), t)), 1);
  if (ferdig && t.type === 'planting' && confirm(`Sette bestand ${b.nr} til hogstklasse II (ungskog) med alder 1?`)) { b.hogstklasse = 2; b.alder = 1; }
}

// ---------------------------------------------------------------- oppdrag
// Produksjonsdata fra hogstmaskinen (StanForD 2010): hogd flate, kjørespor, velteplasser og stammer per treslag.
let stanfordLag = null;
const STAMME_FARGE = { G: '#1f6b4a', F: '#c98500', L: '#8fbf3f' };
function visStanfordLag(gj) {
  if (stanfordLag) { stanfordLag.remove(); stanfordLag = null; }
  if (!gj || !kart) return;
  const r = L.canvas({ padding: 0.3 });
  stanfordLag = L.geoJSON(gj, {
    renderer: r, interactive: false,
    style: (f) => (f.properties.lag === 'hogd' ? { color: '#b5651d', weight: 1, fillColor: '#f39c4a', fillOpacity: 0.35 } : { color: '#d03b3b', weight: 3, dashArray: '6 4' }),
    pointToLayer: (f, ll) => (f.properties.lag === 'stamme'
      ? L.circleMarker(ll, { renderer: r, radius: 2, stroke: false, fillOpacity: 0.85, fillColor: STAMME_FARGE[f.properties.treslag] || '#555' })
      : L.circleMarker(ll, { renderer: r, radius: 7, color: '#fff', weight: 2, fillColor: '#2a78d6', fillOpacity: 1 })),
  }).addTo(kart);
  const b = stanfordLag.getBounds(); if (b.isValid()) kart.fitBounds(b, { maxZoom: 17, ...synligPadding(kart, 40) });
}
function settValgModus(paa, maal = null) {
  if (!paa && kartUtvalg && harEndringer(kartUtvalg)) { rullTilbake(kartUtvalg); endret({ kart: true }); }
  valgModus = paa; maalOppdrag = paa ? maal : null; if (!paa) valgteTiltak = new Set();
  kartUtvalg = paa ? nyttUtvalg({ type: maal?.type || ($('#tiltakFilterType').value ? oppdragstypeNokkel($('#tiltakFilterType').value) : null) }) : null;
  if (kartUtvalg) kartUtvalg.valgte = valgteTiltak;
  oppdaterStiler();
  const k = $('#velgTiltakBtn'); if (k) { k.setAttribute('aria-pressed', String(paa)); k.classList.toggle('aktiv', paa); }
  if (paa && maal) { $('#tiltakFilterStatus').value = 'planlagt'; $('#tiltakFilterType').value = maal.type in TILTAKSTYPER ? maal.type : ''; }
  tegnTiltak();
}
function valgteListe() {
  return [...valgteTiltak].map((id) => { for (const b of S.bestand) { const t = (b.tiltak || []).find((x) => x.id === id); if (t) return { bestand: b, tiltak: t }; } return null; }).filter(Boolean);
}
function tegnValgLinje() {
  const el = $('#valgLinje'); if (!el) return;
  el.hidden = !valgModus;
  if (!valgModus) { el.innerHTML = ''; return; }
  const v = valgteListe(); const typer = [...new Set(v.map((x) => x.tiltak.type))];
  const ku = kartUtvalg; const sum = ku?.type ? oppsummerUtvalg(S, ku, inn()) : null;
  const kartTyper = Object.keys(OPPDRAGSTYPER).filter((k) => kanLageTiltak(k) || utvalgKandidater(S, k).length);
  el.innerHTML = `<div class="valg-kart"><label>Velg i kartet <select data-valg-type ${maalOppdrag ? 'disabled' : ''}><option value="">Velg type …</option>${kartTyper.map((k) => `<option value="${k}" ${ku?.type === k ? 'selected' : ''}>${esc(OPPDRAGSTYPER[k].kort)}</option>`).join('')}</select></label>
    <button class="knapp liten" type="button" data-valg="tegn" ${ku?.type && kanLageTiltak(ku.type) ? '' : 'disabled'}>✎ Tegn flate</button><button class="knapp liten" type="button" data-valg="angre" ${ku?.logg.length ? '' : 'disabled'}>↶ Angre</button>
    <span class="hint">${ku?.type ? `Trykk på bestand i kartet for å velge eller ta ut. Stiplet = har planlagt tiltak.${sum?.tiltak ? ` ${fmt(sum.daa, 1)} daa${sum.kost ? ` · ca. ${fmt(Math.round(sum.kost / 100) * 100)} kr` : ''}` : ''}` : 'Velg type for å velge bestand i kartet eller tegne en flate.'}</span></div>
  <span><b>${v.length}</b> tiltak valgt${typer.length > 1 ? ` · ${typer.length} typer → ${typer.length} oppdrag` : typer.length ? ` · ${esc(TILTAKSTYPER[typer[0]]?.navn || typer[0])}` : ''}${maalOppdrag ? ` · legges i ${esc(maalOppdrag.nr)}` : ''}</span>
    <span class="knapperad" style="margin:0"><button class="knapp liten" type="button" data-valg="alle">Velg alle synlige</button><button class="knapp liten primar" type="button" data-valg="lag" ${v.length ? '' : 'disabled'}>${maalOppdrag ? `Legg til i ${esc(maalOppdrag.nr)}` : 'Lag oppdrag'}</button><button class="knapp liten" type="button" data-valg="avbryt">Avbryt</button></span>`;
}
function visTiltakVisning(navn) {
  $$('#tiltakVisning [data-tv]').forEach((b) => b.classList.toggle('aktiv', b.dataset.tv === navn));
  $('#oppdragPanel').hidden = navn !== 'oppdrag'; $('#tiltakPlanPanel').hidden = navn !== 'plan';
  if (navn === 'oppdrag') oppdragVisning?.tegn(); else { oppdragVisning?.lukk(); oppdaterStiler(); }
}
// Trykk på bestand i kartet i velg-modus. Gir true når trykket er brukt.
function kartVelg(b) {
  if (!kartUtvalg?.type) { melding('Velg type i linjen over tiltakslisten for å velge bestand i kartet.'); visFane('tiltak'); return true; }
  const r = trykkBestand(S, kartUtvalg, b, { nyId, iAar: IAAR });
  melding(r.tekst);
  endret(); return true;
}
function settKartType(type) {
  if (!kartUtvalg) return;
  if (harEndringer(kartUtvalg) && kartUtvalg.type !== type) { rullTilbake(kartUtvalg); }
  kartUtvalg = nyttUtvalg({ type: type || null }); kartUtvalg.valgte = valgteTiltak;
  if (type && type in TILTAKSTYPER) { $('#tiltakFilterType').value = type; $('#tiltakFilterStatus').value = 'planlagt'; }
  endret({ kart: true });
}
async function tegnUtvalgsflate() {
  const ku = kartUtvalg; if (!ku?.type) return;
  const PC = await lastKlipping(); if (!PC) { melding('Geometribiblioteket kunne ikke lastes. Sjekk nettforbindelsen.'); return; }
  const deler = S.bestand.filter((b) => b.geometri).map((b) => mpTilUtm(b.geometri));
  let omriss; try { omriss = S.eiendom?.grense ? mpTilUtm(S.eiendom.grense) : PC.union(...deler); } catch { omriss = deler.flat(); }
  if (erMobil()) settArk('lav');
  const ferdig = () => { kartKlikk = null; };
  const red = startFlateRedigering({
    L, kart, PC, bestand: { geometri: { type: 'MultiPolygon', coordinates: mpTilGeo(omriss) } }, tittel: `${OPPDRAGSTYPER[ku.type].kort} – oppdrag`, plassering: 'full', omrade: 'eiendommen', startTegning: true, zoom: false,
    vedFerdig: ({ geometri }) => {
      ferdig(); if (kartUtvalg !== ku || !geometri) return;
      const r = brukFlate(S, ku, fordelPaaBestand(mpTilUtm(geometri), S.bestand, PC), { nyId, iAar: IAAR });
      melding(r.tekst); endret({ kart: true }); tegnTiltaksflater();
    },
    vedAvbryt: ferdig,
  });
  kartKlikk = (ll) => red.klikk(ll);
}
function lagOppdragFraValg() {
  const v = valgteListe(); if (!v.length) return;
  if (kartUtvalg) bekreftUtvalg(kartUtvalg);
  if (maalOppdrag) {
    const n = leggTilOppdrag(S, maalOppdrag, v); const id = maalOppdrag.id;
    settValgModus(false); endret(); visTiltakVisning('oppdrag'); oppdragVisning?.apne(id);
    melding(`${n} tiltak lagt til i ${maalOppdrag?.nr || 'oppdraget'}.`); return;
  }
  const r = lagOppdrag(S, v, { nyId, iAar: IAAR });
  settValgModus(false); endret(); visTiltakVisning('oppdrag');
  if (r.oppdrag.length === 1) oppdragVisning?.apne(r.oppdrag[0].id);
  melding(`${r.oppdrag.length} oppdrag laget (${r.oppdrag.map((o) => o.nr).join(', ')})${r.hoppetOver.length ? `. ${r.hoppetOver.length} tiltak lå allerede i et aktivt oppdrag eller var utført.` : '.'}`);
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
    $('#gpsBestand').innerHTML = b ? `<p>Du står i <b>bestand ${esc(b.nr)}</b>: ${TRESLAG[b.treslag] || ''} ${b.bonitet ? `bonitet ${b.bonitet}` : ''}, HK ${hkTekst(b, { inn: inn(), hk: hk(b) }) || '?'}, ${b.alder ?? '?'} år, ${fmt(startTilstand(b).volumDaa, 1)} m³/daa. <a href="#" data-vis="${b.id}">Åpne</a></p>` : '<p class="hint">Du er utenfor registrerte bestand.</p>';
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
async function importerFiler(filer, tvingModus = null) {
  const ut = [];
  let samlet = S.bestand;
  for (const fil of filer) {
    try {
      const r = await lesFil(fil, $('#impKoord').value, IAAR);
      const modus = ut.length ? 'flett' : (tvingModus || $('#impModus').value);
      const res = slaaSammen(samlet, r.bestand, modus);
      samlet = res.liste;
      ut.push(`<div>✅ <b>${esc(fil.name)}</b>: ${r.bestand.length} bestand lest${r.koordsys ? ` (${r.koordsys})` : ''} – ${res.lagtTil} nye, ${res.oppdatert} oppdatert${r.hoppetOver ? `, ${r.hoppetOver} objekter uten flate hoppet over` : ''}.</div>`);
      if (r.eiendomsgrense) {
        S.eiendom.grense = r.eiendomsgrense;
        const m = r.metadata;
        if (m?.eiendom && !S.eiendom.gnrbnr) S.eiendom.gnrbnr = m.eiendom.split(' ').pop();
        if (m?.merk) ut.push(`<div class="hint">ℹ️ ${esc(m.merk)}</div>`);
        tegnEiendom();
      }
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
      ...(b.tetthetsklasse && hk(b) ? { TETTHETSKLASSE: b.tetthetsklasse, SP_HKL: hk(b) * 10 + (b.tetthetsklasse === 'a' ? 1 : 2) } : {}),
      ...(b.ungskog ? { TREANTALL_FOR_REGULERING: b.ungskog.treantallFor ?? null, TREANTALL_ETTER_REGULERING: b.ungskog.treantallEtter ?? null, HOYDE_BAR: b.ungskog.hoydeBar ?? null, HOYDE_LAUV: b.ungskog.hoydeLauv ?? null } : {}),
      ALDER: b.alder ?? null, VOLUM_DAA: b.volumDaa ?? runde(s.volumDaa, 1), VOLUM_M3: runde(s.volumDaa * (b.areal || 0), 0),
      TREANTALL: b.treantall ?? null, MIDDELHOYDE: b.hoyde ?? null, MILJOFIGUR: b.miljo ? 'Ja' : null, VEGETASJONSTYPE: vegTekst(b.vegetasjon) || null, MERKNAD: b.merknad || null,
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
    const kol = ['BESTANDNR', 'TEIG', 'AREAL_DAA', 'TRESLAG', 'BONITET', 'HOGSTKLASSE', 'ALDER', 'VOLUM_DAA', 'VOLUM_M3', 'TREANTALL', 'MIDDELHOYDE', 'MILJOFIGUR', 'VEGETASJONSTYPE', 'TILTAK', 'MERKNAD'];
    return lastNed(filnavn('csv'), `﻿${[kol.join(';'), ...f.map((p) => csvRad(kol.map((k) => p[k])))].join('\n')}`, 'text/csv');
  }
  if (type === 'tiltakcsv') {
    const kol = ['År', 'Bestand', 'Tiltak', 'Status', 'Prioritet', 'Areal daa', 'Volum m3', 'Netto kr', 'Skogfond kr', 'Kommentar'];
    const rader = alleTiltak().sort((a, b) => a.aar - b.aar).map((t) => { const o = tiltakOkonomi(t); return csvRad([t.aar, t.bestand.nr, TILTAKSTYPER[t.type]?.navn, t.status, t.prioritet, t.arealDaa ?? t.bestand.areal, runde(o.m3), runde(o.netto), runde(o.skogfond), t.kommentar]); });
    return lastNed(filnavn('tiltak.csv'), `﻿${[kol.join(';'), ...rader].join('\n')}`, 'text/csv');
  }
  if (type === 'rapport') return skrivRapport();
}

function pefcRapport() {
  if (!pefcVisning) return '';
  const { funn, status, P } = pefcVisning.rapport();
  const navn = { avvik: 'Avvik', varsel: 'Må følges opp', ok: 'Ivaretatt', 'ikke-relevant': 'Ikke relevant', 'ikke-vurdert': 'Ikke vurdert' };
  const aktuelle = funn.filter((f) => f.nivaa === 'avvik' || f.nivaa === 'varsel');
  return `<h2>PEFC – Norsk PEFC Skogstandard (PEFC N 02:2022)</h2>
    <table><tr><th>Nr</th><th>Kravpunkt</th><th>Status</th><th>Dokumentasjon</th></tr>
    ${KRAVPUNKTER.map((k) => `<tr><td>${k.nr}</td><td>${esc(k.tittel)}</td><td>${navn[status[k.nr].status]}</td><td>${esc(P.kravstatus?.[k.nr]?.notat || '')}</td></tr>`).join('')}</table>
    ${aktuelle.length ? `<h3>Avvik og oppfølging</h3><table><tr><th>Krav</th><th>Funn</th><th>Beskrivelse</th></tr>${aktuelle.map((f) => `<tr><td>K${f.krav}</td><td>${esc(f.tittel)}</td><td>${esc(f.tekst)}</td></tr>`).join('')}</table>` : ''}`;
}

function verdiRapport() {
  if (!S.bestand.length) return '';
  const v = { ...STANDARD_VERDI, ...S.verdi };
  const r = verdiberegning(S, v, { iAar: IAAR, utenProduksjonIder: utenProduksjon(S) });
  const m = (x) => `${fmt(x / 1e6, 2)} mill kr`;
  return `<h2>Verdiberegning</h2><table>
    <tr><td>Eiendomsverdi (${fmt(v.rente, 1)} % rente)</td><td class="tall">${m(r.eiendom)}</td></tr>
    <tr><td>Skogverdi (forventningsverdi)</td><td class="tall">${m(r.skog)}</td></tr>
    <tr><td>Slaktverdi, alt stående volum</td><td class="tall">${m(r.slakt)}</td></tr>
    <tr><td>Slaktverdi, hogstklasse V</td><td class="tall">${m(r.hogstmodenSlakt)}</td></tr>
    <tr><td>Jordverdi</td><td class="tall">${m(r.jord)}</td></tr>
    <tr><td>Nåverdi av tiltaksplanen, ${v.horisont} år</td><td class="tall">${m(r.plan)}</td></tr></table>
    <p>Tømmerpriser: gran ${fmt(S.innstillinger.pris.G)}, furu ${fmt(S.innstillinger.pris.F)}, lauv ${fmt(S.innstillinger.pris.L)} kr/m³${v.ssb ? ` (SSB ${v.ssb.aar})` : ''}. Reelle verdier før skatt – et beregnet estimat, ikke en takst.</p>`;
}

// ---------------------------------------------------------------- rapporter
const RAPPORT_IKON = { hovedtall: '◔', bestandsliste: '☰', hogstprognose: '↗', pefc: '◈' };
let rapportAar = 30; let aapenRapport = null;
function rapportKontekst() {
  return {
    iAar: IAAR, aar: rapportAar,
    pefc: pefcVisning?.rapport() || null,
    verdi: S.bestand.length ? verdiberegning(S, { ...STANDARD_VERDI, ...S.verdi }, { iAar: IAAR, utenProduksjonIder: utenProduksjon(S) }) : null,
  };
}
function tegnRapportKort() {
  $('#rapportKort').innerHTML = Object.entries(RAPPORTER).map(([k, r]) => `<div class="kort">
    <h3><span class="ikon-r">${RAPPORT_IKON[k]}</span>${esc(r.navn)}</h3>
    <p class="hint" style="margin:0">${esc(r.beskrivelse)}</p>
    ${k === 'hogstprognose' ? `<label>Periode <select id="rapportAar">${[10, 20, 30].map((a) => `<option value="${a}" ${a === rapportAar ? 'selected' : ''}>${a} år</option>`).join('')}</select></label>` : ''}
    <div class="knapperad"><button type="button" class="knapp primar" data-rapport="${k}" data-r-handling="vis">Vis rapport</button><button type="button" class="knapp" data-rapport="${k}" data-r-handling="pdf">Skriv ut / PDF</button><button type="button" class="knapp" data-rapport="${k}" data-r-handling="csv">CSV</button></div>
  </div>`).join('');
}
function visRapport(type, { skrivUt = false } = {}) {
  if (!S.bestand.length) { melding('Planen har ingen bestand ennå.'); return; }
  aapenRapport = type;
  const v = $('#rapportVisning');
  $('#rapportVelg').innerHTML = [...Object.entries(RAPPORTER).map(([k, r]) => [k, r.navn]), ['alle', 'Alle rapporter']].map(([k, n]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${esc(n)}</option>`).join('');
  $('#rapportTittel').textContent = S.eiendom.navn || 'Rapport';
  $('#rapportCsv').hidden = type === 'alle';
  const ramme = $('#rapportRamme');
  ramme.onload = () => { if (skrivUt) setTimeout(() => ramme.contentWindow.print(), 400); skrivUt = false; };
  ramme.srcdoc = lagRapport(type, S, rapportKontekst());
  v.hidden = false;
}
function lastNedRapportCsv(type) { lastNed(filnavn(`${type}.csv`), lagRapportCsv(type, S, rapportKontekst()), 'text/csv'); }

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
    ${tiltak.map((t) => { const o = tiltakOkonomi(t); return `<tr><td>${t.aar}</td><td>${esc(t.bestand.nr)}</td><td>${esc(TILTAKSTYPER[t.type]?.navn)}</td><td class="tall">${fmt(t.arealDaa ?? t.bestand.areal, 1)}</td><td class="tall">${o.m3 ? fmt(o.m3) : ''}</td><td class="tall">${fmt(o.netto)}</td><td>${esc(t.kommentar)}</td></tr>`; }).join('')}</table>
    <h2>Bestandsliste</h2>
    <table><tr><th>Nr</th><th class="tall">Daa</th><th>Treslag</th><th class="tall">Bon</th><th>HK</th><th class="tall">Alder</th><th class="tall">m³/daa</th><th class="tall">m³</th><th>Merknad</th></tr>
    ${[...S.bestand].sort((a, b) => sortNr(a.nr, b.nr)).map((b) => { const st = startTilstand(b); return `<tr><td>${esc(b.nr)}</td><td class="tall">${fmt(b.areal, 1)}</td><td>${TRESLAG[b.treslag] || ''}</td><td class="tall">${b.bonitet ?? ''}</td><td>${HK_ROMERTALL[hk(b)] || ''}</td><td class="tall">${b.alder ?? ''}</td><td class="tall">${fmt(st.volumDaa, 1)}</td><td class="tall">${fmt(st.volumDaa * (b.areal || 0))}</td><td>${esc(b.merknad)}</td></tr>`; }).join('')}</table>
    ${(S.veier?.veier || []).length ? `<h2>Veier</h2><table><tr><th>Vei</th><th>Klasse</th><th>Status</th><th class="tall">Lengde m</th><th>Tilstand</th><th>Eiere</th></tr>
    ${S.veier.veier.map((v) => `<tr><td>${esc(v.navn)}</td><td>${esc(VEIKLASSER_NAVN(v.klasse))}</td><td>${esc(v.status)}</td><td class="tall">${fmt(v.lengde)}</td><td>${esc(v.tilstand || '')}</td><td>${esc((v.eiere || []).map((x) => `${x.navn} ${x.andel} %`).join(', '))}</td></tr>`).join('')}</table>
    ${(S.veier.vedlikehold || []).filter((l) => l.status === 'planlagt').length ? `<h3>Planlagt veivedlikehold</h3><table><tr><th>År</th><th>Vei</th><th>Tiltak</th><th class="tall">Kostnad kr</th></tr>${S.veier.vedlikehold.filter((l) => l.status === 'planlagt').sort((a, b) => a.aar - b.aar).map((l) => `<tr><td>${l.aar}</td><td>${esc(S.veier.veier.find((v) => v.id === l.veiId)?.navn)}</td><td>${esc(VEDLIKEHOLD_NAVN(l.type))}</td><td class="tall">${fmt(l.kostnad)}</td></tr>`).join('')}</table>` : ''}` : ''}
    ${verdiRapport()}
    ${pefcRapport()}
    <p style="font-size:9pt;color:#555">Volum- og verdiberegninger er forenklede estimater basert på registrerte data og innstilte priser.</p>`;
  window.print();
}

async function lastNedOfflineKart() {
  const bb = bbox(S.bestand.map((b) => b.geometri));
  if (!bb) { melding('Ingen bestand med kart å laste ned for.'); return; }
  if (!('caches' in window)) { melding('Nettleseren støtter ikke offline-lagring.'); return; }
  const urler = flisUrler(bb);
  if (urler.length > 6000 && !confirm(`Dette er ${urler.length} kartfliser. Fortsette?`)) return;
  const cache = await caches.open(FLIS_CACHE);
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
    </tbody></table><p class="hint">Standardverdier fra Norsk PEFC Skogstandard: vanlig omløpstid for gran og furu, nedre aldersgrense for lauv. Ikke sett lavere enn PEFCs nedre aldersgrense (45–95 år etter bonitet).</p>`;
}
function settSti(obj, sti, verdi) {
  const deler = sti.split('.'); let o = obj;
  for (const d of deler.slice(0, -1)) o = o[d];
  o[deler.at(-1)] = verdi;
}

function tegnEiendom() {
  const f = $('#eiendomSkjema');
  for (const [k, v] of Object.entries(S.eiendom)) if (f.elements[k]) f.elements[k].value = v ?? '';
  $('#eiendomNavn').textContent = S.eiendom.navn || 'SkogIQ.ai';
  $('#kommandoHint').textContent = S.eiendom.navn ? `Søk i ${S.eiendom.navn}, planer, kommuner …` : 'Søk bestand, planer, kommuner eller handlinger';
  document.title = S.eiendom.navn ? `${S.eiendom.navn} · SkogIQ.ai` : 'SkogIQ.ai';
}

// ---------------------------------------------------------------- oppdatering
function endret({ kart: kartEndret = false, zoom = false } = {}) {
  frResultat = null;
  for (const b of S.bestand) for (const t of b.tiltak || []) if (!t.id) t.id = nyId('t'); // eldre importerte tiltak uten id
  lagreSnart();
  if (kartEndret) { tegnBestandKart(zoom); veiVisning?.oppdater(); pefcVisning?.oppdater(); skogbrandVisning?.oppdater(); skifteplanVisning?.oppdater(); } else oppdaterStiler();
  tegnOversikt();
  tegnBestandTabell();
  tegnTiltak();
  if (!$('#oppdragPanel').hidden && !document.activeElement?.closest?.('#oppdragPanel')) oppdragVisning?.tegn();
  kslVisning?.oppdater();
  karbonVisning?.oppdater();
  if (!$('#fane-framskriving').hidden) tegnFramskriving();
  if (!$('#fane-verdi').hidden && !document.activeElement?.closest?.('#fane-verdi')) verdiVisning?.tegn();
  if (valgtId && !finnBestand(valgtId)) { valgtId = null; visDetalj(); }
}

async function lastDemo() {
  const d = lagDemo(IAAR);
  await nyArbeidsplan({ ...d.eiendom });
  S.bestand = d.bestand;
  valgtId = null; forslag = [];
  tegnEiendom(); tegnRegistreringer();
  endret({ kart: true, zoom: true });
  melding('Demo-eiendom lastet. Prøv «Foreslå tiltak» og Framskriving!');
}

// ---------------------------------------------------------------- planer: generering og bytte mellom planer
let kommuner = null;
let genererer = false;

async function lastKommuner() {
  if (kommuner?.length) return kommuner;
  try {
    kommuner = await hentKommuner();
    $('#kommuneListe').innerHTML = kommuner.map((k) => `<option value="${esc(k.navn)} (${k.nr})"></option>`).join('');
  } catch { kommuner = []; } // uten listen kan man fortsatt skrive kommunenummeret
  return kommuner;
}

// Lagrer planen som er åpen (slik at ingenting går tapt) og starter en tom plan med ny id.
async function nyArbeidsplan(eiendom) {
  await lagreAktivPlan();
  S = { versjon: 1, planId: nyId('p'), eiendom: { navn: '', kommune: '', gnrbnr: '', eier: '', takstAar: IAAR, grense: null, ...eiendom }, bestand: [], registreringer: [], innstillinger: S.innstillinger };
  valgtId = null; forslag = []; avsluttGrenseRedigering();
}

async function lagreAktivPlan() {
  clearTimeout(lagreTimer);
  if (!S.bestand.length && !S.registreringer.length) return;
  if (!S.planId) S.planId = nyId('p');
  await lagrePlan(S);
}

// Planer som åpnes et senere år enn de ble taksert: alder og volum skrives frem til i år (én gang, lagres).
function framskrivPlanTilIAar() {
  let n = 0; let aar = 0;
  for (const b of S.bestand) { const d = framskrivTilAar(b, IAAR); if (d) { n++; aar = Math.max(aar, d); } }
  if (n) { lagreSnart(); setTimeout(() => melding(`Alder og volum i ${n} bestand er skrevet frem ${aar} år til ${IAAR} med vekstmodellen.`, 6000), 400); }
}
// Eldre genererte planer kunne ha «Mulig hogd» på glissen skog med mange trær over 5 cm – rett alder og merknad.
function rettHogdIPlan() {
  const n = rettFeilHogd(S.bestand);
  if (n) { lagreSnart(); setTimeout(() => melding(`${n} bestand var feilaktig satt som hogd (hogstklasse I). SR16 viser mange trær over 5 cm – de er rettet til glissen skog.`, 7000), 900); }
}

// ---------- planen på mobilen: send med QR-kode/kode og synkroniser endringer begge veier (plan-synk.js) ----------
const planSynk = lagPlanSynk({ enhet: 'pc' });
let synker = false; let synkTimer = null; let qrLover = null; let synkInfo = null;
const lastQr = () => (qrLover ||= new Promise((ok, nei) => {
  if (window.qrcode) { ok(window.qrcode); return; }
  const sk = document.createElement('script'); sk.src = 'https://unpkg.com/qrcode-generator@1.4.4/qrcode.js';
  sk.onload = () => ok(window.qrcode); sk.onerror = () => { qrLover = null; nei(new Error('QR-biblioteket kunne ikke lastes')); }; document.head.appendChild(sk);
}));
const feltAdresse = () => new URL('felt.html', location.href.split(/[?#]/)[0]).href;
// Resultatet av en synkronisering legges inn uten å miste endringer som ble gjort mens den pågikk.
async function brukSynk(planId, endret0, r) {
  if (planId === S.planId) {
    if (S.endret !== endret0) { S.synk = { ...r.plan.synk, sendtHash: null }; await lagrePlan(S); return; } // endret underveis – sendes neste gang
    if (r.status === 'hentet' || r.status === 'flettet') {
      S = { ...r.plan, innstillinger: { ...klon(STANDARD_INNSTILLINGER), ...r.plan.innstillinger } };
      await lagrePlan(S); await lagre(S);
      stilleLagring = true; tegnEiendom(); tegnRegistreringer(); endret({ kart: true }); if (valgtId) visDetalj();
      melding(r.status === 'hentet' ? 'Planen er oppdatert med endringer fra mobilen.' : 'Endringer fra mobilen og PC-en er slått sammen.', 5000);
    } else { S.synk = r.plan.synk; await lagrePlan(S); }
  } else {
    const lagret = await hentPlan(planId);
    if (lagret && lagret.endret === endret0) await lagrePlan(r.plan); else if (lagret) { lagret.synk = { ...r.plan.synk, sendtHash: null }; await lagrePlan(lagret); }
  }
  synkInfo = { tid: new Date(), status: r.status };
  tegnPlanListe();
}
async function synkAktiv({ stille = true } = {}) {
  if (!S.synk?.id || synker || !navigator.onLine) return;
  synker = true; const id = S.planId; const e0 = S.endret;
  try { const r = await planSynk.synk(S); await brukSynk(id, e0, r); if (!stille) melding({ lik: '✓ Planen er lik på PC og mobil.', sendt: '✓ Endringene er sendt til mobilen.', hentet: '✓ Oppdatert fra mobilen.', flettet: '✓ Endringer slått sammen.' }[r.status]); }
  catch (e) { if (!stille) melding(`Synkronisering feilet: ${e.message}`, 6000); } finally { synker = false; }
}
async function tilMobil(id = S.planId) {
  const d = $('#mobilDialog');
  if (!id) { melding('Åpne eller lag en plan først.'); return; }
  if (id === S.planId) await lagreAktivPlan();
  const plan = id === S.planId ? S : await hentPlan(id); if (!plan) return;
  d.innerHTML = `<h3>📱 ${esc(plan.eiendom?.navn || 'Planen')} på mobilen</h3><p class="hint">Gjør planen klar for mobilen …</p>`;
  if (!d.open) d.showModal();
  const e0 = plan.endret;
  try {
    const [r, qr] = await Promise.all([planSynk.del(plan), lastQr().catch(() => null)]);
    await brukSynk(id, e0, r);
    const lenke = `${feltAdresse()}?kode=${r.kode}`;
    let qrHtml = '';
    if (qr) { const q = qr(0, 'M'); q.addData(lenke); q.make(); qrHtml = q.createSvgTag({ cellSize: 5, margin: 2, scalable: true }); }
    const til = new Date(r.utloper).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
    const lokal = /^(localhost|127\.)/.test(location.hostname);
    d.innerHTML = `<h3>📱 Åpne ${esc(plan.eiendom?.navn || 'planen')} på mobilen</h3>
      <div class="mobil-qr">${qrHtml ? `<div class="qr" aria-label="QR-kode">${qrHtml}</div>` : ''}
        <ol><li>Skann QR-koden med kameraet på mobilen. Planen åpnes i SkogIQ Felt og lagres der.</li>
        <li>Eller åpne <b>SkogIQ Felt</b> på mobilen (${esc(feltAdresse().replace(/^https?:\/\//, ''))}), trykk på planvelgeren øverst → <b>Hent plan fra PC-en</b> og skriv koden:<br><span class="mobil-kode">${esc(r.kode.slice(0, 3))} ${esc(r.kode.slice(3))}</span></li>
        <li>Legg SkogIQ Felt på hjemskjermen og last ned kartet for offline under <b>Mer</b>.</li></ol></div>
      <p class="hint">Koden gjelder til kl. ${til}, og kan brukes på flere mobiler. ${lokal ? '<b>Merk:</b> Du kjører appen lokalt – mobilen må nå samme adresse. ' : ''}Planen virker uten nett på mobilen. Registreringer, utførte tiltak, sporlogger og oppdrag synkroniseres automatisk begge veier når enhetene har nett, og endringer fra begge sider slås sammen. Planen overføres kryptert (HTTPS) og mellomlagres på SkogIQ-serveren (slettes etter 90 dager uten bruk).</p>
      <div class="knapperad" style="margin:0"><button class="knapp" type="button" data-m="synk">⇅ Synkroniser nå</button><button class="knapp" type="button" data-m="kopier">Kopier lenke</button><button class="knapp primar" type="button" data-m="lukk">Ferdig</button></div>`;
    d.querySelector('[data-m="kopier"]').onclick = () => navigator.clipboard?.writeText(lenke).then(() => melding('Lenken er kopiert – send den til mobilen.'), () => melding(lenke, 10000));
  } catch (e) {
    d.innerHTML = `<h3>📱 Planen på mobilen</h3><p>${esc(e.nett ? e.message : `Kunne ikke gjøre planen klar: ${e.message}`)}</p><div class="knapperad" style="margin:0"><button class="knapp primar" type="button" data-m="lukk">Lukk</button></div>`;
  }
  d.querySelector('[data-m="synk"]')?.addEventListener('click', () => synkAktiv({ stille: false }));
  d.querySelector('[data-m="lukk"]').onclick = () => d.close();
}

async function aapnePlan(id) {
  stoppDeling(); sisteDeling = null;
  if (id === S.planId) { visFane('oversikt'); zoomTilAlle(); return; }
  const plan = await hentPlan(id);
  if (!plan) { melding('Fant ikke planen. Den kan være slettet.'); tegnPlanListe(); return; }
  await lagreAktivPlan();
  S = { ...plan, innstillinger: { ...klon(STANDARD_INNSTILLINGER), ...plan.innstillinger } };
  framskrivPlanTilIAar(); rettHogdIPlan();
  valgtId = null; forslag = []; avsluttGrenseRedigering();
  valgModus = false; valgteTiltak = new Set(); maalOppdrag = null; uthevet = new Set(); kartUtvalg = null; oppdragVisning?.lukk();
  tegnEiendom(); tegnInnstillinger(); tegnRegistreringer();
  endret({ kart: true, zoom: true });
  visFane('oversikt');
  andreVisning?.tegn(); tegnPlanListe();
  melding(`Åpnet ${S.eiendom.navn || 'planen'}.`);
  synkAktiv(); // hent endringer fra mobilen
}

async function tegnPlanListe() {
  const liste = await listPlaner();
  const synligeAndre = andreVisning?.antall() || 0;
  $('#planListe').innerHTML = (liste.length > 1 ? `<div class="plan-kartvalg"><span class="hint">Vis flere eiendommer i kartet samtidig${synligeAndre ? ` – ${synligeAndre} til vises nå` : ''}:</span><div class="knapperad" style="margin:0"><button class="knapp liten" type="button" data-plan-alle="vis">Vis alle</button><button class="knapp liten" type="button" data-plan-alle="skjul" ${synligeAndre ? '' : 'disabled'}>Skjul andre</button><button class="knapp liten" type="button" data-plan-alle="zoom" ${synligeAndre ? '' : 'disabled'}>Zoom til alle</button></div></div>` : '') + (liste.length ? liste.map((p) => `
    <div class="plan-rad" data-plan="${esc(p.id)}">
      <div><div class="navn">${esc(p.navn)}${p.id === S.planId ? '<span class="merke-aktiv">Åpen</span>' : ''}${p.synk ? '<span class="synk-merke" title="Synkroniseres med mobilen">⇅ mobil</span>' : ''}</div>
      <div class="hint">${fmt(p.areal)} daa · ${p.antall} bestand · endret ${new Date(p.endret).toLocaleDateString('nb-NO')}</div></div>
      <div class="knapperad" style="margin:0"><label class="plan-kart" title="${p.id === S.planId ? 'Planen er åpen og vises alltid' : 'Vis eiendommen i kartet sammen med planen som er åpen'}"><input type="checkbox" data-plan-kart ${p.id === S.planId || andreVisning?.erSynlig(p.id) ? 'checked' : ''} ${p.id === S.planId ? 'disabled' : ''}> I kartet</label><button class="knapp liten" data-plan-handling="mobil" type="button" title="Send planen til SkogIQ Felt på mobilen (QR-kode)">📱 Til mobil</button><button class="knapp liten primar" data-plan-handling="aapne" type="button">Åpne</button><button class="knapp liten fare" data-plan-handling="slett" type="button">Slett</button></div>
    </div>`).join('') : '<div class="tom">Ingen lagrede planer ennå. Lag en over, eller importer en plan under Data.</div>');
}

const GEN_STEG = [
  ['eiendom', 'Eiendomsgrense (Kartverket)'], ['plan', 'Tidligere skogbruksplan (NIBIO)'],
  ['sr16', 'Skogressurskart SR16 (NIBIO)'], ['mis', 'Miljøregistreringer (MiS)'], ['markslag', 'Markslag – uproduktiv mark (AR5, NIBIO)'], ['skifter', 'Skifteinndeling av jordbruksareal (AR5 og jordsmonn)'], ['bygg', 'Bestand og sammenligning'], ['vegetasjon', 'Vegetasjonstype per bestand (NIBIO vegetasjonskart)'],
  ['miljo', 'Miljødata til PEFC (NIBIO, Miljødirektoratet, Riksantikvaren)'], ['nvdb', 'Skogsbilveier (NVDB)'], ['fkb', 'Traktorveier og stier (Kartverket FKB)'], ['ssb', 'Tømmerpriser (SSB)'],
];

// Henter PEFC-miljødata, veier og tømmerpriser for planen som er åpen (fra PEFC-, Veier- og Verdi-fanen).
async function hentDataForAktivPlan(hvilke, logg) {
  let kommunenr = S.eiendom.kommunenr;
  if (!kommunenr && S.eiendom.kommune) kommunenr = finnKommune(S.eiendom.kommune, await lastKommuner())?.nr;
  const r = await hentDatagrunnlag(S, { hvilke, nyId, kommunenr, logg });
  if (kommunenr && !S.eiendom.kommunenr) S.eiendom.kommunenr = kommunenr;
  endret({ kart: true });
  return r;
}

function lastSkript(src, globalNavn) {
  if (window[globalNavn]) return Promise.resolve(window[globalNavn]);
  return new Promise((res, rej) => {
    const sk = document.createElement('script');
    sk.src = src;
    sk.onload = () => res(window[globalNavn]);
    sk.onerror = () => rej(new Error('Kunne ikke laste geometribiblioteket. Sjekk nettforbindelsen.'));
    document.head.appendChild(sk);
  });
}
const lastTurf = () => lastSkript('https://unpkg.com/@turf/turf@7.2.0/turf.min.js', 'turf');
// Rask polygonklipping (brukes av genereringen); Turf er reserve hvis den ikke lastes.
const lastKlipping = () => lastSkript('https://unpkg.com/polygon-clipping@0.15.7/dist/polygon-clipping.umd.min.js', 'polygonClipping').catch(() => null);

// Brukes fra kommuneanalysen: fyll inn skjemaet og start genereringen for eiendommen.
async function lagPlanFor({ kommunenr, gnr, bnr, fnr }) {
  const k = (await lastKommuner()).find((x) => x.nr === kommunenr);
  visFane('planer');
  $('#genKommune').value = k ? `${k.navn} (${k.nr})` : kommunenr;
  $('#genGnr').value = gnr; $('#genBnr').value = bnr; $('#genFnr').value = fnr || '';
  $('#genSkjema').requestSubmit();
}

async function startGenerering(e) {
  e.preventDefault();
  if (genererer) return;
  const kommune = finnKommune($('#genKommune').value, await lastKommuner());
  const gnr = parseInt($('#genGnr').value, 10); const bnr = parseInt($('#genBnr').value, 10);
  const festenr = parseInt($('#genFnr').value, 10) || 0;
  if (!kommune) { melding('Fant ikke kommunen. Skriv navnet eller det firesifrede kommunenummeret.'); $('#genKommune').focus(); return; }
  if (!gnr || !bnr) { melding('Fyll inn gårds- og bruksnummer.'); return; }

  genererer = true;
  $('#genBtn').disabled = true; $('#genBtn').textContent = 'Lager plan …';
  $('#genFramdrift').hidden = false;
  $('#genTittel').textContent = `Lager skogbruksplan for ${kommune.navn} ${gnr}/${bnr}${festenr ? `/${festenr}` : ''}`;
  $('#genSteg').innerHTML = GEN_STEG.map(([id, navn]) => `<li data-steg="${id}"><span class="ikon">○</span><span><b>${navn}</b><br><span class="tekst hint">Venter</span></span></li>`).join('');
  $('#genResultat').innerHTML = '';
  $('#genFramdrift').scrollIntoView({ behavior: 'smooth', block: 'start' });
  const logg = (steg, status, tekst) => {
    const li = $(`#genSteg [data-steg="${steg}"]`); if (!li) return;
    li.className = status;
    li.querySelector('.ikon').textContent = status === 'ok' ? '✓' : status === 'feil' ? '✕' : '●';
    li.querySelector('.tekst').textContent = tekst;
  };
  let aktivtSteg = 'eiendom';
  try {
    const [turf, klipping] = await Promise.all([lastTurf(), lastKlipping()]);
    const plan = await genererPlan({ kommune, gnr, bnr, festenr }, { turf, klipping, iAar: IAAR, logg: (st, status, t) => { aktivtSteg = st; logg(st, status, t); } });
    const ny = { versjon: 1, planId: nyId('p'), eiendom: plan.eiendom, bestand: plan.bestand, markslag: plan.markslag || [], ...(plan.skifteplan ? { skifteplan: plan.skifteplan } : {}), registreringer: [], innstillinger: klon(S.innstillinger), metadata: plan.metadata, datakilder: { ...plan.kilder } };
    // Planen lagres med en gang. Datagrunnlaget (miljødata til PEFC, veier, traktorveier og tømmerpriser) hentes
    // samtidig i bakgrunnen og legges inn i planen når det kommer – også om planen er åpnet i mellomtiden.
    await lagrePlan(ny);
    await tegnPlanListe();
    const vol = ny.bestand.reduce((s, b) => s + (b.volumDaa || 0) * b.areal, 0);
    const kontroll = ny.bestand.filter((b) => /hogd/.test(b.merknad)).length;
    const m = plan.metadata;
    const dgSteg = ['miljo', 'nvdb', 'fkb', 'ssb'];
    dgSteg.forEach((st) => logg(st, 'aktiv', 'Henter i bakgrunnen …'));
    const dgLover = hentDatagrunnlag(ny, { hvilke: dgSteg, nyId, kommunenr: kommune.nr, logg: (st, t, ok) => logg(st, ok === true ? 'ok' : ok === false ? 'feil' : 'aktiv', t) });
    dgLover.then(async (dg) => {
      let kalibrert = null;
      if (ny.verdi?.ssb) {
        kalibrert = kalibrerPriser(ny.verdi.ssb, ny.innstillinger.pris);
        if (kalibrert) ny.innstillinger.pris = { ...ny.innstillinger.pris, G: kalibrert.G, F: kalibrert.F, L: kalibrert.L };
      }
      const felter = (x) => { x.pefc = ny.pefc; x.veier = ny.veier; x.verdi = ny.verdi; x.datakilder = { ...x.datakilder, ...ny.datakilder }; if (kalibrert) x.innstillinger = { ...x.innstillinger, pris: { ...x.innstillinger?.pris, G: kalibrert.G, F: kalibrert.F, L: kalibrert.L } }; };
      if (S.planId === ny.planId) { felter(S); endret({ kart: true }); } else { const lagret = await hentPlan(ny.planId); if (lagret) { felter(lagret); lagret.endret = new Date().toISOString(); await lagrePlan(lagret); } }
      const el = $('#genDatagrunnlag');
      if (el) el.innerHTML = `✓ Datagrunnlaget er lagt inn: ${(ny.pefc?.objekter || []).length} miljøobjekter til PEFC, ${fmt((ny.veier?.veier || []).reduce((s, v) => s + (v.lengde || 0), 0) / 1000, 1)} km vei og sti. ${kalibrert ? `Tømmerpriser kalibrert mot SSB (${esc(kalibrert.grunnlag.navn)}, ${fmt(kalibrert.grunnlag.pris)} kr/m³): gran ${fmt(kalibrert.G)}, furu ${fmt(kalibrert.F)}, lauv ${fmt(kalibrert.L)} kr/m³.` : 'Tømmerpriser fra SSB kunne ikke hentes – standardpriser er brukt.'}${dg.feil.length ? ` Noen kilder svarte ikke (${esc(dg.feil.join('; '))}) – prøv «Oppdater alle» i PEFC-fanen senere.` : ''}`;
    }).catch((e) => { const el = $('#genDatagrunnlag'); if (el) el.textContent = `Datagrunnlaget kunne ikke hentes (${e.message}) – prøv «Oppdater alle» i PEFC-fanen.`; });
    $('#genTittel').textContent = `Skogbruksplan for ${ny.eiendom.navn} er klar`;
    $('#genResultat').innerHTML = `<div class="gen-resultat">
      <div class="nokkeltall" style="margin:0">
        <div><b>${fmt(m.skogDaa)} daa</b><span>skog av ${fmt(m.eiendomDaa)} daa</span></div>
        <div><b>${ny.bestand.length}</b><span>bestand</span></div>
        <div><b>${fmt(vol)} m³</b><span>stående volum (SR16)</span></div>
        <div><b>${kontroll}</b><span>trolig hogd siden forrige takst – kontroller</span></div>
        ${ny.skifteplan?.skifter?.length ? `<div><b>${ny.skifteplan.skifter.length}</b><span>skifter på ${fmt(ny.skifteplan.skifter.reduce((s, x) => s + x.areal, 0))} daa jordbruksareal</span></div>` : ''}
      </div>
      <p class="hint" style="margin:0" id="genDatagrunnlag">⏳ Miljødata til PEFC, veier, traktorveier og tømmerpriser hentes i bakgrunnen og legges inn i planen når de kommer. Du kan åpne planen nå.</p>
      <p class="hint" style="margin:0">${m.antallFraPlan ? `Bestandsgrenser fra skogbruksplan registrert ${esc(m.planRegistrert || '')}, oppdatert med SR16.` : 'Fant ingen tidligere skogbruksplan – bestandene er laget fra SR16-flater.'} Utkastet må kontrolleres i felt før det brukes som grunnlag for hogst.</p>
      <div class="motor-sporsmal" id="motorSporsmal">
        <div><b>Skal tiltaksplanen lages automatisk?</b><div class="hint">Tiltaksmotoren foreslår flatehogst eller lukket hogst, tynning, markberedning, planting og ungskogpleie for de neste 30 årene, basert på biologi, bærekraft og økonomi. Du kan endre alt etterpå.</div></div>
        <div class="motor-prinsipper">${Object.entries(PRINSIPPER).map(([k, p]) => `<label class="motor-prinsipp"><input type="radio" name="genPrinsipp" value="${k}" ${k === 'balansert' ? 'checked' : ''}><span><b>${esc(p.navn)}</b><small>${esc(p.beskrivelse)}</small></span></label>`).join('')}</div>
        <div class="knapperad" style="margin:0"><button class="knapp primar" type="button" id="motorJa">Ja, lag tiltaksplan</button><button class="knapp" type="button" id="motorNei">Nei takk</button></div>
      </div>
      <div class="knapperad" style="margin:0"><button class="knapp primar" type="button" id="aapneNyPlan">Åpne skogbruksplanen for ${esc(ny.eiendom.navn)} →</button><button class="knapp" type="button" id="nyPlanMobil">📱 Send til mobilen</button></div>
    </div>`;
    $('#nyPlanMobil').onclick = async () => { await dgLover.catch(() => {}); tilMobil(ny.planId); };
    $('#aapneNyPlan').onclick = () => aapnePlan(ny.planId);
    $('#motorNei').onclick = () => { $('#motorSporsmal').innerHTML = '<span class="hint">Ingen tiltak er laget. Du kan kjøre tiltaksmotoren senere under Tiltak.</span>'; $('#aapneNyPlan').focus(); };
    $('#motorJa').onclick = async () => {
      const prinsipp = $('[name="genPrinsipp"]:checked')?.value || 'balansert';
      $('#motorJa').disabled = true; $('#motorJa').textContent = 'Lager tiltak …';
      await new Promise((r) => setTimeout(r, 30));
      const o = anvendMotor(ny, { iAar: IAAR, horisont: 30, prinsipp });
      await lagrePlan(ny);
      if (S.planId === ny.planId) S = { ...ny, innstillinger: { ...klon(STANDARD_INNSTILLINGER), ...ny.innstillinger } };
      $('#motorSporsmal').innerHTML = `<div><b>✓ ${o.antall} tiltak lagt inn</b> (${PRINSIPPER[prinsipp].navn.toLowerCase()}): ${o.kort} på kort sikt og ${o.lang} på lang sikt – ${esc(o.tekst)}.</div><div class="hint">Hvert tiltak har en begrunnelse («Hvorfor?») med faglige kilder.</div>`;
      $('#aapneNyPlan').focus();
    };
  } catch (err) {
    logg(aktivtSteg, 'feil', err.message);
    $('#genTittel').textContent = 'Kunne ikke lage planen';
    $('#genResultat').innerHTML = `<p class="hint">${esc(err.message)} Prøv igjen, eller kontroller at eiendommen finnes i Kartverkets eiendomskart.</p>`;
  } finally {
    genererer = false;
    $('#genBtn').disabled = false; $('#genBtn').textContent = 'Lag skogbruksplan';
  }
}

// ---------------------------------------------------------------- kommandopalett
const FANE_IKON = { planer: '▤', kommune: '◫', oversikt: '◔', bestand: '⬡', tiltak: '✓', framskriving: '↗', veier: '‖', verdi: '¤', rapporter: '▦', skogbrand: '🔥', skifteplan: '🌾', karbon: '♲', pefc: '◈', ai: '✦', felt: '◉', data: '⛁' };
let planlisteCache = [];
function kommandoValg(q) {
  listPlaner().then((l) => { planlisteCache = l; });
  const valg = [];
  // «Kommune 29/2» → lag plan for eiendommen
  const m = String(q).match(/^\s*([a-zæøåA-ZÆØÅ][\wæøåÆØÅ .-]*?|\d{4})\s+(\d+)\s*\/\s*(\d+)(?:\s*\/\s*(\d+))?\s*$/);
  if (m) {
    valg.push({ gruppe: 'Lag plan', ikon: '✦', tittel: `Lag skogbruksplan for ${m[1].trim()} ${m[2]}/${m[3]}${m[4] ? `/${m[4]}` : ''}`, under: 'Fra Kartverket, NIBIO og SR16', alltid: true,
      utfor: async () => { const k = finnKommune(m[1], await lastKommuner()); if (!k) { melding('Fant ikke kommunen.'); return; } lagPlanFor({ kommunenr: k.nr, gnr: +m[2], bnr: +m[3], fnr: +(m[4] || 0) }); } });
  }
  for (const [k, t] of Object.entries(FANE_TITLER)) valg.push({ gruppe: 'Gå til', ikon: FANE_IKON[k], tittel: t, standard: true, utfor: () => visFane(k) });
  valg.push(
    { gruppe: 'Handlinger', ikon: '✦', tittel: 'Kjør tiltaksmotoren', under: 'Flatehogst, lukket hogst, tynning, markberedning, planting og ungskogpleie – kort og lang sikt', sok: 'foreslå tiltak automatisk motor plan', standard: true, utfor: () => { visFane('tiltak'); kjorMotor(motorForhand || S.motor || {}); } },
    { gruppe: 'Handlinger', ikon: '✦', tittel: 'Lag ny skogbruksplan', under: 'Fra kommune, gårds- og bruksnummer', sok: 'generer eiendom gnr bnr', standard: true, utfor: () => { visFane('planer'); $('#genKommune').focus(); } },
    { gruppe: 'Handlinger', ikon: '✦', tittel: 'Analyser en kommune', under: 'Hogstmoden skog, lukket hogst, ungskogpleie', sok: 'kommuneanalyse', utfor: () => { visFane('kommune'); $('#komKommune').focus(); } },
    { gruppe: 'Handlinger', ikon: '✦', tittel: 'Hent veier fra NVDB', sok: 'vei skogsbilvei', utfor: () => { visFane('veier'); $('#veiNvdbBtn').click(); } },
    { gruppe: 'Handlinger', ikon: '◈', tittel: 'Hent miljødata (PEFC)', under: 'Nøkkelbiotoper, naturtyper, friluftsliv, kulturminner', sok: 'pefc sertifisering miljø nøkkelbiotop', utfor: () => { visFane('pefc'); $('#pefcHentBtn').click(); } },
    { gruppe: 'Handlinger', ikon: '◈', tittel: 'Oppdater alt datagrunnlag', under: 'Miljødata, NVDB-veier og SSB-priser', sok: 'pefc data oppdater sist hentet ssb nvdb', utfor: () => { visFane('pefc'); $('#pefcOppdaterAlle')?.click(); } },
    { gruppe: 'Handlinger', ikon: '✦', tittel: `Spør AI: ${q || 'still et spørsmål om planen'}`, under: 'Claude svarer ut fra planens data', sok: 'ai spør chat assistent claude hvorfor hva hvor mye', alltid: !!q && q.length > 12 && /\?$|^(hva|hvor|hvilke|hvilken|hvordan|hvorfor|når|kan|bør|skal)\b/i.test(q.trim()), utfor: () => { visFane('ai'); if (q) aiVisning?.sporr(q); } },
    { gruppe: 'Handlinger', ikon: '🔥', tittel: 'Registrer skade', under: 'Brann, storm, snø, granbarkbille …', sok: 'skogbrand skade stormfelling vindfall snøbrekk barkbille brann forsikring skademelding', utfor: () => { visFane('skogbrand'); setTimeout(() => document.querySelector('[data-sb-under="skader"]')?.click(), 50); } },
    { gruppe: 'Handlinger', ikon: '🔥', tittel: 'Skogbrannfare og farevarsler', under: 'Skogbrannindeks, vind og barkbillevarsel for eiendommen', sok: 'skogbrand brannfare fwi met vind storm varsel barkbille', utfor: () => visFane('skogbrand') },
    { gruppe: 'Handlinger', ikon: '🌾', tittel: 'Gjødslingsplan', under: 'Gjødselbehov per skifte, forslag og utskrift (gjødselforskriften § 26)', sok: 'skifteplan gjødsel gjødsling jordprøve nitrogen fosfor kalium husdyrgjødsel jordbruk', utfor: () => { visFane('skifteplan'); skifteplanVisning?.underfane('gjodsling'); } },
    { gruppe: 'Handlinger', ikon: '🌾', tittel: 'Sprøytejournal / plantevernjournal', under: 'Registrer sprøyting og skriv ut journalen', sok: 'skifteplan sprøyting plantevern plantevernmidler ugras journal ipv', utfor: () => { visFane('skifteplan'); skifteplanVisning?.underfane('sproyting'); } },
    { gruppe: 'Handlinger', ikon: '¤', tittel: 'Verdiberegning', under: 'Eiendomsverdi, slaktverdi, jordverdi og nåverdi', sok: 'verdi nåverdi slaktverdi takst lev faustmann', utfor: () => visFane('verdi') },
    { gruppe: 'Handlinger', ikon: '📱', tittel: 'Åpne mobilversjonen (SkogIQ Felt)', under: 'Kart i fullskjerm, GPS, registreringer og tiltak – fungerer offline', sok: 'mobil felt mobilversjon offline pwa app installer telefon gps', utfor: () => { location.href = 'felt.html'; } },
    { gruppe: 'Handlinger', ikon: '▤', tittel: 'Vis alle eiendommene mine i kartet', under: 'Andre skogbruksplaner vises sammen med planen som er åpen', sok: 'flere eiendommer kart alle planer vis samtidig naboeiendom', utfor: async () => { await andreVisning.settAlle(true); await andreVisning.zoomAlle(bboxFor()); tegnPlanListe(); } },
    { gruppe: 'Handlinger', ikon: '♲', tittel: 'Karbonkreditter – potensial og prosjekt', under: 'Merlager mot referanse, egnethet, kreditter og verifisering', sok: 'karbon co2 klima kreditter karbonkreditt klimakvote binding vm0045 crcf verra noora', utfor: () => visFane('karbon') },
    { gruppe: 'Handlinger', ikon: '✓', tittel: 'KSL – egenrevisjon og dokumentasjon', under: 'Sjekklister, avvik, kontroller med frister og dokumentarkiv', sok: 'ksl kvalitetssystem landbruk egenrevisjon hms vernerunde avvik dokumentasjon matmerk norsk mat', utfor: () => visFane('ksl') },
    { gruppe: 'Handlinger', ikon: '◈', tittel: 'PEFC-status og avvik', sok: 'pefc skogstandard krav avvik sertifisering', utfor: () => visFane('pefc') },
    { gruppe: 'Handlinger', ikon: '✦', tittel: 'Lag rapport / PDF', sok: 'skriv ut print', utfor: () => eksporter('rapport') },
    ...Object.entries(RAPPORTER).map(([k, r]) => ({ gruppe: 'Rapporter', ikon: '▦', tittel: `Rapport: ${r.navn}`, under: r.beskrivelse, sok: 'rapport pdf utskrift skriv ut', utfor: () => visRapport(k) })),
    { gruppe: 'Handlinger', ikon: 'ℹ', tittel: `Om ${APPNAVN} – versjon ${VERSJON}`, under: `Utviklet av ${UTVIKLER}`, sok: 'om versjon utvikler laget av trond harald sand', utfor: () => { visFane('planer'); setTimeout(() => $('#fane-planer [data-om-app]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); } },
    { gruppe: 'Handlinger', ikon: '✦', tittel: 'Ta sikkerhetskopi', sok: 'backup eksport lagre', utfor: () => eksporter('backup') },
    { gruppe: 'Handlinger', ikon: '✦', tittel: 'Bytt lyst/mørkt tema', sok: 'tema mørk lys dark', utfor: () => $('#temaBtn').click() },
  );
  for (const o of $$('#fargeEtter option')) valg.push({ gruppe: 'Farge i kartet', ikon: '◐', tittel: `Farge etter ${o.textContent.toLowerCase()}`, utfor: () => { $('#fargeEtter').value = o.value; $('#fargeEtter').dispatchEvent(new Event('change')); } });
  for (const p of planlisteCache) valg.push({ gruppe: 'Planer', ikon: '▤', tittel: p.navn, under: `${fmt(p.areal)} daa · ${p.antall} bestand${p.id === S.planId ? ' · åpen' : ''}`, sok: 'plan', utfor: () => aapnePlan(p.id) });
  for (const b of S.bestand) {
    const st = startTilstand(b);
    valg.push({ gruppe: 'Bestand', ikon: '⬡', tittel: `Bestand ${b.nr}`, under: `${fmt(b.areal, 1)} daa · ${TRESLAG[b.treslag] || ''} ${b.bonitet ?? ''} · ${Math.round(st.alder)} år · ${fmt(st.volumDaa, 1)} m³/daa`, sok: `${b.merknad || ''} ${b.teig || ''}`, utfor: () => { velgBestand(b.id); visFane('bestand'); } });
  }
  for (const v of S.veier?.veier || []) valg.push({ gruppe: 'Veier', ikon: '‖', tittel: v.navn || 'Vei', under: `${fmt(v.lengde)} m`, sok: 'vei', utfor: () => { visFane('veier'); document.querySelector(`[data-vei="${v.id}"]`)?.click(); } });
  return valg;
}

// ---------------------------------------------------------------- oppkobling
function kobleHendelser() {
  $$('.faner button').forEach((b) => b.addEventListener('click', () => visFane(b.dataset.fane)));
  $('#innsiktListe').addEventListener('click', (e) => { const k = e.target.closest('[data-innsikt]'); if (k) utforHandling(k.dataset.innsikt); });
  $('#panelLukk').addEventListener('click', () => { document.body.classList.toggle('panel-skjult'); });
  $('#temaBtn').addEventListener('click', () => {
    const naa = document.documentElement.dataset.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const ny = naa === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = ny;
    try { localStorage.setItem('skogiq-tema', ny); } catch { /* valgfritt */ }
    endret({ kart: true });
  });
  // Bunnark på mobil: klikk på hanken bytter høyde, dra for å justere.
  const hank = $('#arkHank'); const panel = $('#panel');
  const nivaer = ['lav', 'halv', 'hoy'];
  let dra = null;
  hank.addEventListener('pointerdown', (e) => { dra = { y: e.clientY, h: panel.getBoundingClientRect().height, flyttet: false }; hank.setPointerCapture(e.pointerId); panel.style.transition = 'none'; });
  hank.addEventListener('pointermove', (e) => {
    if (!dra) return;
    const dy = dra.y - e.clientY;
    if (Math.abs(dy) > 4) dra.flyttet = true;
    panel.style.height = `${Math.max(90, Math.min(window.innerHeight - 70, dra.h + dy))}px`;
  });
  hank.addEventListener('pointerup', () => {
    if (!dra) return;
    panel.style.transition = ''; const h = panel.getBoundingClientRect().height; panel.style.height = '';
    if (!dra.flyttet) settArk(nivaer[(nivaer.indexOf(panel.dataset.ark) + 1) % nivaer.length]);
    else { const andel = h / panel.parentElement.getBoundingClientRect().height; settArk(andel < 0.3 ? 'lav' : andel < 0.72 ? 'halv' : 'hoy'); }
    dra = null;
  });
  // Versjon og utvikler
  for (const el of $$('[data-om-app]')) el.innerHTML = `<b>${APPNAVN}</b> versjon ${VERSJON} <span>(${UTGITT})</span><br>Utviklet av ${UTVIKLER} · <a href="#" data-logg-ut>Logg ut</a>`;
  $('#railVersjon').textContent = `v${VERSJON}`; $('#railVersjon').title = signatur();
  initKommando({ hentValg: kommandoValg });
  $('#genSkjema').addEventListener('submit', startGenerering);
  veiVisning = initVeier({
    kart, hentPlan: () => S, endret, melding, nyId,
    settKartKlikk: (fn) => { kartKlikk = fn; },
    visBestand: (id) => { velgBestand(id); visFane('bestand'); },
  });
  pefcVisning = initPefc({
    kart, hentPlan: () => S, endret, melding, nyId,
    settKartKlikk: (fn) => { kartKlikk = fn; },
    visBestand: (id) => { velgBestand(id); visFane('bestand'); },
    hentData: hentDataForAktivPlan,
  });
  skogbrandVisning = initSkogbrand({
    kart, hentPlan: () => S, endret, melding, nyId, iAar: IAAR, lastKlipping, skalerBilde,
    settKartKlikk: (fn) => { kartKlikk = fn; },
    visBestand: (id) => { velgBestand(id); visFane('bestand'); },
    hentPosisjon: () => sistePos || (valgtPunkt ? { lat: valgtPunkt.getLatLng().lat, lon: valgtPunkt.getLatLng().lng } : null),
  });
  skifteplanVisning = initSkifteplan({
    kart, hentPlan: () => S, endret, melding, nyId, iAar: IAAR,
    settKartKlikk: (fn) => { kartKlikk = fn; },
    // Jordbruksfigurer fra AR5: bruker figurene i planen hvis de finnes, ellers hentes AR5 for eiendommen.
    hentJordbruk: async (logg) => ((S.markslag || []).some((f) => f.kategori === 'jordbruk') ? S.markslag : lastAr5(logg)),
    lagInndeling: async (logg) => {
      const fig = (S.markslag || []).some((f) => f.kategori === 'jordbruk') ? S.markslag : await lastAr5(logg);
      const klipping = await lastKlipping();
      let jordsmonn = [];
      if (klipping && fig.some((f) => f.kategori === 'jordbruk')) { logg('Henter jordsmonn …'); jordsmonn = await hentJordsmonnFlater(jordbruksBoks(fig), { logg }).catch(() => []); }
      return lagSkifteinndeling(fig, { klipping, jordsmonn, iAar: IAAR, nyId });
    },
  });
  andreVisning = initFlereEiendommer({
    L, kart, hentPlan, listPlaner, hentVerdi, lagreVerdi, aktivId: () => S.planId, aapnePlan,
    padding: () => synligPadding(kart, 20), endretSynlig: () => tegnLegend(), opptatt: () => !!(kartKlikk || deling || tegning),
  });
  lagKontroll.addOverlay(andreVisning.lag, 'Andre eiendommer (mine planer)');
  andreVisning.start().then(() => tegnPlanListe());
  kslVisning = initKsl({ hentPlan: () => S, endret, melding, nyId, iAar: IAAR, visFane });
  karbonVisning = initKarbon({
    hentPlan: () => S, endret, melding, iAar: IAAR, visFane,
    uthev: (ider) => { uthevet = new Set(ider); oppdaterStiler(); },
    visBestander: (ider) => {
      const lag = ider.map((id) => lagPerBestand.get(id)).filter(Boolean); if (!lag.length) return;
      kart.fitBounds(L.featureGroup(lag).getBounds(), { maxZoom: 16, ...synligPadding(kart, 40) });
      if (erMobil()) settArk('halv');
    },
  });
  oppdragVisning = initOppdrag({
    hentPlan: () => S, endret, melding, okonomi: tiltakOkonomi, settUtfort,
    tiltakNavn: (k) => TILTAKSTYPER[k]?.navn || k,
    uthev: (ider) => { uthevet = new Set(ider); oppdaterStiler(); },
    visBestander: (ider) => {
      const lag = ider.map((id) => lagPerBestand.get(id)).filter(Boolean); if (!lag.length) return;
      kart.fitBounds(L.featureGroup(lag).getBounds(), { maxZoom: 16, ...synligPadding(kart, 40) });
      if (erMobil()) settArk('halv');
    },
    startValg: (o) => { visTiltakVisning('plan'); settValgModus(true, o); },
    visKartlag: visStanfordLag,
  });
  $('#tiltakVisning').addEventListener('click', (e) => { const b = e.target.closest('[data-tv]'); if (b) visTiltakVisning(b.dataset.tv); });
  $('#velgTiltakBtn').addEventListener('click', () => settValgModus(!valgModus));
  $('#valgLinje').addEventListener('change', (e) => { if (e.target.matches('[data-valg-type]')) settKartType(e.target.value); });
  $('#valgLinje').addEventListener('click', (e) => {
    const k = e.target.closest('[data-valg]')?.dataset.valg; if (!k) return;
    if (k === 'avbryt') { if (kartUtvalg && harEndringer(kartUtvalg) && !confirm('Avbryte? Nye tiltak og tegnede flater fra valget forkastes.')) return; settValgModus(false); }
    if (k === 'lag') lagOppdragFraValg();
    if (k === 'tegn') tegnUtvalgsflate();
    if (k === 'angre' && kartUtvalg) { if (angreUtvalg(kartUtvalg)) melding('Angret.'); endret({ kart: true }); tegnTiltaksflater(); }
    if (k === 'alle') { $$('#tiltakListe .velg-tiltak:not(:disabled)').forEach((c) => { c.checked = true; valgteTiltak.add(c.closest('.tiltak-rad').dataset.tiltak); c.closest('.tiltak-rad').classList.add('valgt'); }); tegnValgLinje(); oppdaterStiler(); }
  });
  aiVisning = initAssistent({
    hentPlan: () => S, iAar: IAAR,
    hentKontekstData: () => ({ pefcFunn: pefcVisning?.funn() || [], verdi: S.bestand.length ? verdiberegning(S, { ...STANDARD_VERDI, ...S.verdi }, { iAar: IAAR, utenProduksjonIder: utenProduksjon(S) }) : null }),
    visBestand: (id) => { velgBestand(id); if (erMobil()) settArk('lav'); },
  });
  verdiVisning = initVerdi({
    hentPlan: () => S, endret: () => { lagreSnart(); tegnOversikt(); }, melding, iAar: IAAR,
    hentSsb: () => hentDataForAktivPlan(['ssb']),
    visBestand: (id) => { velgBestand(id); visFane('bestand'); },
  });
  kommuneVisning = initKommune({ kart, melding, innstillinger: inn, lastKommuner, finnKommune, lagPlanFor });
  $('#genKommune').addEventListener('focus', lastKommuner, { once: true });
  $('#planListe').addEventListener('change', async (e) => {
    const rad = e.target.closest('.plan-rad'); if (!rad || !e.target.matches('[data-plan-kart]')) return;
    andreVisning.settSynlig(rad.dataset.plan, e.target.checked);
    if (e.target.checked) await andreVisning.zoomAlle(S.bestand.length ? bboxFor() : null);
    tegnPlanListe();
  });
  $('#planListe').addEventListener('click', async (e) => {
    const alle = e.target.closest('[data-plan-alle]')?.dataset.planAlle;
    if (alle === 'vis') { await andreVisning.settAlle(true); await andreVisning.zoomAlle(bboxFor()); tegnPlanListe(); return; }
    if (alle === 'skjul') { await andreVisning.settAlle(false); tegnPlanListe(); return; }
    if (alle === 'zoom') { await andreVisning.zoomAlle(bboxFor()); if (erMobil()) settArk('halv'); return; }
    const rad = e.target.closest('.plan-rad'); const h = e.target.dataset.planHandling; if (!rad || !h) return;
    if (h === 'aapne') aapnePlan(rad.dataset.plan);
    if (h === 'mobil') tilMobil(rad.dataset.plan);
    if (h === 'slett') {
      const navn = rad.querySelector('.navn').firstChild.textContent;
      if (!confirm(`Slette planen «${navn}»? Dette kan ikke angres.`)) return;
      await slettPlan(rad.dataset.plan); andreVisning?.glem(rad.dataset.plan);
      if (rad.dataset.plan === S.planId) S.planId = null;
      tegnPlanListe();
    }
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-til-mobil]')) { tilMobil(); return; }
    const g = e.target.closest('[data-gaa]'); if (g) { e.preventDefault(); visFane(g.dataset.gaa); }
    const v = e.target.closest('[data-vis]'); if (v) { e.preventDefault(); velgBestand(v.dataset.vis); visFane('bestand'); }
  });
  $('#fargeEtter').addEventListener('change', () => { if ($('#fargeEtter').value === 'framskrevet') visFane('framskriving'); oppdaterStiler(); });
  $('#kartLegend').addEventListener('click', (e) => { if (e.target.closest('.legend-knapp')) { legendLukket = !legendLukket; tegnLegend(); } });
  L.DomEvent.disableClickPropagation($('#kartLegend'));
  L.DomEvent.disableClickPropagation($('.kartverktoy'));
  L.DomEvent.disableClickPropagation($('#tegnHjelp'));
  $('#tegnBtn').addEventListener('click', startTegning);
  document.addEventListener('click', (e) => {
    const k = e.target.closest('[data-r-handling]'); if (!k) return;
    const type = k.dataset.rapport; const h = k.dataset.rHandling;
    if (h === 'vis') visRapport(type); else if (h === 'pdf') visRapport(type, { skrivUt: true }); else if (h === 'csv') lastNedRapportCsv(type);
  });
  $('#fane-rapporter').addEventListener('change', (e) => { if (e.target.id === 'rapportAar') rapportAar = Number(e.target.value); });
  $('#rapportVelg').addEventListener('change', (e) => visRapport(e.target.value));
  $('#rapportSkriv').addEventListener('click', () => $('#rapportRamme').contentWindow.print());
  $('#rapportCsv').addEventListener('click', () => lastNedRapportCsv(aapenRapport));
  $('#rapportLukk').addEventListener('click', () => { $('#rapportVisning').hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#rapportVisning').hidden) $('#rapportVisning').hidden = true; });
  $('#delFerdig').addEventListener('click', fullforDeling);
  $('#delAvbryt').addEventListener('click', stoppDeling);
  $('#delAngrePunkt').addEventListener('click', () => { if (deling?.punkter.length) { deling.punkter.pop(); tegnDeling(); } });
  L.DomEvent.disableClickPropagation($('#delHjelp'));
  kart.on('dblclick', () => { if (deling?.res?.deler) fullforDeling(); });
  document.addEventListener('keydown', (e) => {
    if (!deling || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'Escape') stoppDeling();
    else if (e.key === 'Enter') fullforDeling();
    else if (e.key === 'Backspace' && deling.punkter.length) { e.preventDefault(); deling.punkter.pop(); tegnDeling(); }
  });
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
  $('#foreslaBtn').addEventListener('click', () => { const k = $('.motor-kort'); if (k) { k.open = true; k.scrollIntoView({ block: 'start', behavior: 'smooth' }); } });
  $('#motorPanel').addEventListener('click', (e) => {
    if (e.target.id === 'motorKjor') kjorMotor({ prinsipp: $('[name="motorPrinsipp"]:checked')?.value || 'balansert', horisont: Number($('#motorHorisont').value), erstatt: $('#motorErstatt').checked });
    handterEndring(e);
  });
  ['#tiltakListe', '#forslagListe', '#nesteTiltak', '#bestandDetalj'].forEach((s) => $(s).addEventListener('click', handterTiltakKlikk));
  $('#bestandDetalj').addEventListener('click', handterEndring);

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
    if (h === 'slett' && confirm('Slette registreringen?')) { merkSlettet(S, 'registreringer', r.id); S.registreringer = S.registreringer.filter((x) => x !== r); lagreSnart(); tegnRegistreringer(); }
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
  $$('[data-eksempel]').forEach((knapp) => knapp.addEventListener('click', async () => {
    try {
      const svar = await fetch(knapp.dataset.eksempel);
      if (!svar.ok) throw new Error(`HTTP ${svar.status}`);
      const navn = knapp.dataset.eksempel.split('/').pop();
      await nyArbeidsplan({ navn: knapp.dataset.navn, kommune: knapp.dataset.kommune, gnrbnr: '', takstAar: IAAR });
      await importerFiler([new File([await svar.blob()], navn)], 'erstatt');
      tegnEiendom(); tegnRegistreringer(); visFane('oversikt');
    } catch (e) { melding(`Kunne ikke hente planen: ${e.message}`); }
  }));
  $('#slettAltBtn').addEventListener('click', () => {
    if (!confirm('Slette alle bestand, tiltak og registreringer? Ta gjerne en sikkerhetskopi først.')) return;
    if (S.planId) slettPlan(S.planId).then(tegnPlanListe);
    S.bestand = []; S.registreringer = []; S.eiendom.grense = null; S.planId = null; valgtId = null; forslag = [];
    tegnRegistreringer(); endret({ kart: true });
  });
  $('#offlineBtn').addEventListener('click', lastNedOfflineKart);
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { tegnOversikt(); if (!$('#fane-framskriving').hidden) tegnFramskriving(); }, 200);
  });
  $('#innstSkjema').addEventListener('change', (e) => { settSti(S.innstillinger, e.target.dataset.sti, Number(e.target.value)); endret(); if (valgtId) visDetalj(); kommuneVisning?.oppdaterPriser(); });
  $('#hogstalderTabell').addEventListener('change', (e) => { settSti(S.innstillinger, e.target.dataset.sti, Number(e.target.value)); endret(); if (valgtId) visDetalj(); });
  $('#innstNullstill').addEventListener('click', () => { S.innstillinger = klon(STANDARD_INNSTILLINGER); tegnInnstillinger(); endret(); });
}

async function start() {
  initKart();
  kobleHendelser();
  const lagret = await hent();
  if (lagret) { S = { ...S, ...lagret, innstillinger: { ...klon(STANDARD_INNSTILLINGER), ...lagret.innstillinger } }; framskrivPlanTilIAar(); rettHogdIPlan(); }
  tegnEiendom(); tegnInnstillinger(); tegnRegistreringer();
  endret({ kart: true, zoom: true });
  if (!lagret) lagreSnart();
  tegnPlanListe();
  if (!S.bestand.length) visFane('planer');
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
  // Endringer fra SkogIQ Felt (registreringer, utførte tiltak) i planen som er åpen her: last planen inn på nytt.
  kanal?.addEventListener('message', async (m) => {
    if (m.data?.type !== 'plan-endret' || m.data.fra === 'full' || m.data.planId !== S.planId) return;
    const plan = await hentPlan(S.planId); if (!plan) return;
    S = { ...plan, innstillinger: { ...klon(STANDARD_INNSTILLINGER), ...plan.innstillinger } };
    stilleLagring = true; tegnRegistreringer(); endret({ kart: true });
    melding('Planen er oppdatert fra SkogIQ Felt.');
  });
  // Synkronisering med mobilen: når vinduet får fokus, når nettet kommer tilbake, og hvert minutt.
  synkAktiv();
  window.addEventListener('focus', () => synkAktiv());
  window.addEventListener('online', () => synkAktiv());
  setInterval(() => { if (document.visibilityState === 'visible') synkAktiv(); }, 60000);
}

start();
