// Åpne data til skadeforebygging: skogbrannfareindeks (met.no, THREDDS/ncWMS), farevarsler (met.no MetAlerts),
// vindprognose (met.no Locationforecast) og barkbilleovervåkingen (NIBIO). Alle tjenestene tillater kall fra nettleseren.
import { brannnivaa } from './skade.js';

const FWI = 'https://thredds.met.no/thredds/wms/fwi/latest/FWI_forecast_latest.nc';
const MET = 'https://api.met.no/weatherapi';
const BILLE = 'https://wms.nibio.no/cgi-bin/barkbille';

async function hentTekst(hent, url, ms = 30000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await hent(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`${new URL(url).host} svarte ${r.status}`);
    return await r.text();
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error(`${new URL(url).host} svarte ikke innen ${ms / 1000} sekunder`);
    throw e;
  } finally { clearTimeout(t); }
}

// Skogbrannfareindeks (FWI) per dag for et punkt, så langt prognosen rekker (ca. 13 dager).
export async function hentBrannfare(lon, lat, { hent = fetch } = {}) {
  const meta = JSON.parse(await hentTekst(hent, `${FWI}?request=GetMetadata&item=layerDetails&layerName=FWI`));
  const datoer = [];
  for (const [aar, mnd] of Object.entries(meta.datesWithData || {})) for (const [m, dager] of Object.entries(mnd)) for (const d of dager) datoer.push(`${aar}-${String(+m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  datoer.sort();
  if (!datoer.length) throw new Error('Ingen prognose for skogbrannfare tilgjengelig');
  const d = 0.05;
  const csv = await hentTekst(hent, `${FWI}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetTimeseries&LAYERS=FWI&QUERY_LAYERS=FWI&SRS=EPSG:4326&BBOX=${lon - d},${lat - d},${lon + d},${lat + d}&WIDTH=2&HEIGHT=2&X=1&Y=1&INFO_FORMAT=text/csv&TIME=${datoer[0]}T12:00:00.000Z/${datoer.at(-1)}T12:00:00.000Z`);
  const dager = csv.split('\n').filter((l) => /^\d{4}-/.test(l)).map((l) => {
    const [tid, v] = l.split(','); const fwi = Number(v);
    return { dato: tid.slice(0, 10), fwi: Number.isFinite(fwi) ? Math.max(0, fwi) : null, nivaa: brannnivaa(Number.isFinite(fwi) ? Math.max(0, fwi) : null) };
  });
  return { dager, hentet: new Date().toISOString(), kilde: 'Meteorologisk institutt (FWI)' };
}

// Gjeldende farevarsler (skogbrann, vind, styrtregn, flom, jordskred …) for punktet.
const NIVAA = { yellow: 'gul', orange: 'oransje', red: 'rod' };
export async function hentFarevarsler(lon, lat, { hent = fetch } = {}) {
  const d = JSON.parse(await hentTekst(hent, `${MET}/metalerts/2.0/current.json?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`));
  return (d.features || []).map((f) => {
    const p = f.properties;
    const farge = (String(p.awareness_level || '').split(';')[1] || '').trim();
    return { hendelse: p.event, navn: p.eventAwarenessName || p.event, tittel: p.title, tekst: p.description, rad: p.instruction, nivaa: NIVAA[farge] || farge, fra: f.when?.interval?.[0], til: f.when?.interval?.[1], omraade: p.area };
  });
}

// Vindprognose: høyeste middelvind og vindkast per dag (kast finnes for de nærmeste dagene).
export async function hentVind(lon, lat, { hent = fetch } = {}) {
  const d = JSON.parse(await hentTekst(hent, `${MET}/locationforecast/2.0/complete?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`));
  const perDag = new Map();
  for (const t of d.properties?.timeseries || []) {
    const dag = new Date(t.time).toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' });
    const x = t.data.instant.details;
    const r = perDag.get(dag) || { dato: dag, vind: 0, kast: null, retning: null };
    if (x.wind_speed > r.vind) { r.vind = x.wind_speed; r.retning = x.wind_from_direction; }
    if (x.wind_speed_of_gust != null && (r.kast == null || x.wind_speed_of_gust > r.kast)) r.kast = x.wind_speed_of_gust;
    perDag.set(dag, r);
  }
  return { dager: [...perDag.values()].slice(0, 9), hentet: new Date().toISOString() };
}

// Barkbilleovervåkingen: risikovarsel for sonen og fangst i de nærmeste fellene.
const gmlFelt = (blokk) => { const a = {}; for (const [, k, v] of blokk.matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)) if (!k.startsWith('gml')) a[k] = v.trim(); return a; };
const gmlObjekter = (tekst, lag) => tekst.split(`<${lag}_feature>`).slice(1).map((b) => {
  const blokk = b.split(`</${lag}_feature>`)[0];
  const k = (blokk.match(/<gml:coordinates>([^<]+)<\/gml:coordinates>/) || [])[1];
  const [x0, y0, x1, y1] = k ? k.trim().split(/[\s,]+/).map(Number) : [];
  return { ...gmlFelt(blokk), _pos: k ? [(x0 + x1) / 2, (y0 + y1) / 2] : null };
});
export const PERIODER = [['17_21', 'uke 17–21'], ['21_24', 'uke 21–24'], ['24_28', 'uke 24–28'], ['28_33', 'uke 28–33']];
export async function hentBarkbille(lon, lat, { hent = fetch, radiusKm = 40, antall = 5 } = {}) {
  const gfi = (lag, bb, w = 3) => `${BILLE}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=${lag}&QUERY_LAYERS=${lag}&SRS=EPSG:4326&BBOX=${bb.join(',')}&WIDTH=${w}&HEIGHT=${w}&X=${Math.floor(w / 2)}&Y=${Math.floor(w / 2)}&FEATURE_COUNT=500&INFO_FORMAT=application/vnd.ogc.gml`;
  const p = 0.0005;
  const [varselTekst, felleTekst] = await Promise.all([
    hentTekst(hent, gfi('barkbillevarsel', [lon - p, lat - p, lon + p, lat + p])).catch(() => ''),
    hentTekst(hent, `${gfi('barkbilleregistrering_28_33', [lon - radiusKm / 55, lat - radiusKm / 111, lon + radiusKm / 55, lat + radiusKm / 111], 500)}&RADIUS=bbox`).catch(() => ''),
  ]);
  const v = gmlObjekter(varselTekst, 'barkbillevarsel')[0] || null;
  const nivaa = !v ? null : /høy|stor/i.test(v.varsel) ? 'hoy' : /middels/i.test(v.varsel) ? 'middels' : 'lav';
  const km = (pos) => { const dx = (pos[0] - lon) * 111.32 * Math.cos((lat * Math.PI) / 180); const dy = (pos[1] - lat) * 110.54; return Math.hypot(dx, dy); };
  const feller = gmlObjekter(felleTekst, 'barkbilleregistrering_28_33').filter((f) => f._pos).map((f) => {
    const fangst = PERIODER.map(([k]) => { const v = Number(f[`barkbilleantall_uke_${k}`]); return f[`barkbilleantall_uke_${k}`] === undefined || f[`barkbilleantall_uke_${k}`] === '' || !Number.isFinite(v) || v < 0 ? null : v; });
    const historikk = (f.barkbilleantall_array || '').replace(/[{}]/g, '').split(',').filter(Boolean).map(Number);
    const aar = (f.aarstall_array || '').replace(/[{}]/g, '').split(',').filter(Boolean).map(Number);
    return { id: f.season_trapsite_id, navn: f.title, pos: f._pos, km: km(f._pos), fangst, sum: fangst.reduce((s, x) => s + (x || 0), 0), utbruddsnivaa: Number(f.historisk_utbruddsniva) || null, historikk: aar.map((a, i) => ({ aar: a, antall: historikk[i] })), generasjon1: f.generasjon_1_text || null, generasjon2: f.generasjon_2_text || null };
  }).sort((a, b) => a.km - b.km).slice(0, antall);
  return { sone: v ? { id: v.sone_id, varsel: v.varsel, beskrivelse: v.varselbeskrivelse, dato: v.varseldato, usikkerhet: v.usikkerhet_varsel, nivaa } : null, feller, hentet: new Date().toISOString() };
}

// Kartlag (WMS) til Leaflet.
export const KARTLAG = {
  fwi: { url: FWI, navn: 'Skogbrannindeks (met.no)', params: { layers: 'FWI', styles: 'default-scalar/seq-YlOrRd', colorscalerange: '0,40', numcolorbands: 5, abovemaxcolor: 'extend', belowmincolor: 'transparent', format: 'image/png', transparent: true, version: '1.3.0' }, opacity: 0.55 },
  skogskader: { url: 'https://wms.nibio.no/cgi-bin/skogskader', navn: 'Skogskader.no (NIBIO)', params: { layers: 'overview_reports,diagnosis_reports', format: 'image/png', transparent: true }, opacity: 0.9 },
  barkbillevarsel: { url: BILLE, navn: 'Barkbillevarsel (NIBIO)', params: { layers: 'barkbillevarsel', format: 'image/png', transparent: true }, opacity: 0.45 },
};
