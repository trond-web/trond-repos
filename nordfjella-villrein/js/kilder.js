// Kartlag og oppslag mot åpne tjenester. Alle tillater kall direkte fra nettleseren (CORS).
import { flisBbox3857, punktIPolygon } from './geo.js';

export const KOMMUNER = {
  3326: 'Hemsedal', 3328: 'Ål', 3330: 'Hol', 4619: 'Eidfjord', 4620: 'Ulvik', 4641: 'Aurland', 4642: 'Lærdal',
  3454: 'Vang', 4621: 'Voss', 4643: 'Årdal', 3324: 'Gol', 3332: 'Sigdal',
};
export const kommunenavn = (nr) => KOMMUNER[Number(nr)] || `kommune ${nr}`;

const KV = 'https://cache.kartverket.no/v1/wmts/1.0.0';
const kvAttr = '© <a href="https://www.kartverket.no/">Kartverket</a>';

// Bakgrunnskart. `offline: true` betyr at de kan lastes ned for hele området.
export const BAKGRUNNER = {
  topo: { navn: 'Topografisk', url: `${KV}/topo/default/webmercator/{z}/{y}/{x}.png`, maks: 18, attr: kvAttr, offline: true },
  toporaster: { navn: 'Turkart (raster)', url: `${KV}/toporaster/default/webmercator/{z}/{y}/{x}.png`, maks: 18, attr: kvAttr, offline: true },
  graa: { navn: 'Gråtone', url: `${KV}/topograatone/default/webmercator/{z}/{y}/{x}.png`, maks: 18, attr: kvAttr, offline: true },
  flyfoto: { navn: 'Flyfoto', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maks: 19, attr: 'Esri, Maxar, Earthstar Geographics', offline: false },
};

export const flisUrl = (mal, z, x, y) => mal.replace('{z}', z).replace('{x}', x).replace('{y}', y);

// WMS-lag hentes som 256-fliser i Web Mercator med fast URL-oppsett, slik at nedlasting og visning
// bruker nøyaktig samme adresse (og dermed treffer samme cache).
export const WMS = {
  eiendom: { navn: 'Eiendomsgrenser', url: 'https://wms.geonorge.no/skwms1/wms.matrikkelkart', lag: 'eiendomsgrense', minZoom: 14, attr: 'Eiendom © Kartverket', offlineZoom: 14 },
  teig: { navn: 'Gnr/bnr-nummer', url: 'https://wms.geonorge.no/skwms1/wms.matrikkelkart', lag: 'teig', minZoom: 16, attr: 'Eiendom © Kartverket' },
  trekk: { navn: 'Trekkområder for villrein', url: 'https://kart.miljodirektoratet.no/arcgis/services/villrein/MapServer/WMSServer', lag: 'villrein_trekkomrade', minZoom: 8, attr: 'Miljødirektoratet', opasitet: 0.55 },
  kalving: { navn: 'Kalvingsområder', url: 'https://kart.miljodirektoratet.no/arcgis/services/villrein/MapServer/WMSServer', lag: 'villrein_kalvingsomrade', minZoom: 8, attr: 'Miljødirektoratet', opasitet: 0.5 },
};

export function wmsUrl(w, z, x, y) {
  const b = flisBbox3857(x, y, z).map((v) => v.toFixed(2)).join(',');
  return `${w.url}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${w.lag}&STYLES=&CRS=EPSG:3857&BBOX=${b}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=true`;
}

async function hentJson(url, { hent = fetch, tidsavbrudd = 10000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), tidsavbrudd);
  try {
    const r = await hent(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

const NOYAKTIGHET = { Grønt: 'god', Gult: 'middels', Rødt: 'lav', Grått: 'ukjent' };

// Teigen (eiendomsflaten) i punktet, med alle matrikkelenhetene som eier den.
export async function teigI([lon, lat], o) {
  const d = await hentJson(`https://api.kartverket.no/eiendom/v1/punkt/omrader?nord=${lat}&ost=${lon}&koordsys=4258&utkoordsys=4258&radius=1`, o);
  const treff = (d.features || []).filter((f) => f.geometry && punktIPolygon([lon, lat], f.geometry));
  const liste = treff.length ? treff : (d.features || []).filter((f) => f.properties?.meterFraPunkt === 0);
  if (!liste.length) return null;
  return tolkTeig(liste);
}

export function tolkTeig(features) {
  const p0 = features[0].properties;
  const enheter = [];
  for (const f of features) {
    const p = f.properties;
    const id = `${p.kommunenummer}-${p.gardsnummer}-${p.bruksnummer}-${p.festenummer || 0}-${p.seksjonsnummer || 0}`;
    if (!enheter.some((e) => e.id === id)) enheter.push({ id, kommunenr: p.kommunenummer, gnr: p.gardsnummer, bnr: p.bruksnummer, fnr: p.festenummer || 0, tekst: p.matrikkelnummertekst || `${p.gardsnummer}/${p.bruksnummer}` });
  }
  return {
    id: String(p0.lokalid ?? enheter.map((e) => e.id).join('+')),
    enheter,
    kommunenr: p0.kommunenummer,
    noyaktighet: NOYAKTIGHET[p0['nøyaktighetsklasseteig']] || 'ukjent',
    sameie: !!(p0.teigmedflerematrikkelenheter || p0.uregistrertjordsameie || enheter.length > 1),
    uregistrertSameie: !!p0.uregistrertjordsameie,
    geometri: features[0].geometry,
  };
}

export const teigNavn = (t) => `${t.enheter.map((e) => e.tekst).join(', ')} i ${kommunenavn(t.kommunenr)}`;

export async function hoydeI([lon, lat], o) {
  const d = await hentJson(`https://ws.geonorge.no/hoydedata/v1/punkt?koordsys=4258&nord=${lat}&ost=${lon}&geojson=false`, o);
  const z = d.punkter?.[0]?.z;
  return typeof z === 'number' ? z : null;
}

// ---------- Import av egne grenser ----------

const tall = (s) => s.trim().split(/[\s]+/).map((t) => t.split(',').map(Number)).filter((c) => c.length >= 2 && c.every((v) => !Number.isNaN(v))).map(([x, y]) => [x, y]);

export function lesKml(tekst, parser = new DOMParser()) {
  const doc = parser.parseFromString(tekst, 'application/xml');
  const features = [];
  for (const pm of doc.getElementsByTagName('Placemark')) {
    const navn = pm.getElementsByTagName('name')[0]?.textContent?.trim() || '';
    for (const poly of pm.getElementsByTagName('Polygon')) {
      const ringer = [];
      for (const del of ['outerBoundaryIs', 'innerBoundaryIs']) for (const b of poly.getElementsByTagName(del)) {
        const c = b.getElementsByTagName('coordinates')[0]; if (c) ringer.push(tall(c.textContent));
      }
      if (ringer.length) features.push({ type: 'Feature', properties: { navn }, geometry: { type: 'Polygon', coordinates: ringer } });
    }
    for (const ls of pm.getElementsByTagName('LineString')) {
      const c = ls.getElementsByTagName('coordinates')[0];
      if (c) features.push({ type: 'Feature', properties: { navn }, geometry: { type: 'LineString', coordinates: tall(c.textContent) } });
    }
    for (const pt of pm.getElementsByTagName('Point')) {
      const c = pt.getElementsByTagName('coordinates')[0];
      const k = c && tall(c.textContent)[0];
      if (k) features.push({ type: 'Feature', properties: { navn }, geometry: { type: 'Point', coordinates: k } });
    }
  }
  return { type: 'FeatureCollection', features };
}

export function lesGpx(tekst, parser = new DOMParser()) {
  const doc = parser.parseFromString(tekst, 'application/xml');
  const features = [];
  const pkt = (el) => [Number(el.getAttribute('lon')), Number(el.getAttribute('lat'))];
  const navn = (el) => el.getElementsByTagName('name')[0]?.textContent?.trim() || '';
  for (const w of doc.getElementsByTagName('wpt')) features.push({ type: 'Feature', properties: { navn: navn(w) }, geometry: { type: 'Point', coordinates: pkt(w) } });
  for (const t of doc.getElementsByTagName('trk')) for (const s of t.getElementsByTagName('trkseg')) {
    features.push({ type: 'Feature', properties: { navn: navn(t) }, geometry: { type: 'LineString', coordinates: [...s.getElementsByTagName('trkpt')].map(pkt) } });
  }
  for (const r of doc.getElementsByTagName('rte')) {
    features.push({ type: 'Feature', properties: { navn: navn(r) }, geometry: { type: 'LineString', coordinates: [...r.getElementsByTagName('rtept')].map(pkt) } });
  }
  return { type: 'FeatureCollection', features };
}

export function lesGeoJson(tekst) {
  const g = JSON.parse(tekst);
  const fc = g.type === 'FeatureCollection' ? g : { type: 'FeatureCollection', features: [g.type === 'Feature' ? g : { type: 'Feature', properties: {}, geometry: g }] };
  // Grovsjekk at koordinatene er lengde/bredde (ikke UTM).
  const første = JSON.stringify(fc.features[0]?.geometry?.coordinates || []).match(/-?\d+(\.\d+)?/g)?.map(Number) || [];
  if (første.length >= 2 && (Math.abs(første[0]) > 180 || Math.abs(første[1]) > 90)) {
    throw new Error('Filen ser ut til å ha UTM-koordinater. Lagre den som GeoJSON i WGS84 (EPSG:4326).');
  }
  return fc;
}

export function lesFil(navn, tekst) {
  const n = navn.toLowerCase();
  if (n.endsWith('.kml')) return lesKml(tekst);
  if (n.endsWith('.gpx')) return lesGpx(tekst);
  return lesGeoJson(tekst);
}
