// Markfuktighet: NIBIOs markfuktighetskart (DTW, «depth-to-water», laget fra laserdata DTM1) viser hvor dypt det er
// til grunnvannet. Der grunnvannet står høyt, er marka bløt og tåler lite kjøring – sporskader, erosjon og avrenning.
// Kartet vises i hovedkartet og i den virtuelle skogen, og gir andel våt mark per bestand. Ingen DOM – kan testes i Node.
// Klassene og fargene i WMS-laget ligger i driftsforhold.js (DTW_KLASSER, dtwKlasse); over 1 m er gjennomsiktig (tørt).
// Kartet er statisk: det viser hvor marka vanligvis er våt, ikke hvor vått det er akkurat nå (nedbør, tele og snø
// kommer fra NVE i driftsforhold.js).
import { DTW_KLASSER, dtwKlasse, dtwForFlate, fuktIndeks, vatAndel } from './driftsforhold.js';
import { geoTilUtm } from './proj.js';

export const KILDER = {
  dtw: { navn: 'NIBIO – Markfuktighetskart (DTW, dybde til grunnvann fra laserdata) – metadata i Geonorge', url: 'https://geonorge.no/geonetworktest/srv/api/records/15b78acd-b9dd-4f9b-9d95-7aec91e63f0e' },
  sporlos: { navn: 'Skogkurs – Sporløs kjøring (sluttrapport, med NIBIO): markfuktighetskart i driftsplanlegging', url: 'https://www.landbruksdirektoratet.no/nb/filarkiv/rapporter/prosjektresultater/skogbruk/7.1%20Sluttrapport%20Sporl%C3%B8s%20kj%C3%B8ring,%20SKOGKURS%20(Trygve%20%C3%98verg%C3%A5rd).pdf' },
};
export const WMS = 'https://wms.nibio.no/cgi-bin/markfuktighetskart';
export const LAG = 'markfuktighetsklasser';
export const url = ([x0, y0, x1, y1], w, h) => `${WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${LAG}&STYLES=&SRS=EPSG:25833&BBOX=${[x0, y0, x1, y1].map((v) => v.toFixed(1)).join(',')}&WIDTH=${w}&HEIGHT=${h}&FORMAT=image/png&TRANSPARENT=true`;

// Hva klassene betyr for kjøring med skogsmaskiner (våtest først).
export const KLASSER = [
  { id: 'vann', navn: 'Åpent vann', kort: 'Vann', farge: '#000080', drift: 'Ikke kjør – bru eller klopp over bekker', leg: 'Åpent vann' },
  { id: 'd0', navn: 'Grunnvann 0–0,25 m under bakken', kort: 'Svært vått', farge: '#0000ff', drift: 'Svært bløtt – kjør bare på tele eller snø, ellers store sporskader', leg: '0–0,25 m: svært vått – bare på tele eller snø' },
  { id: 'd25', navn: 'Grunnvann 0,25–0,5 m under bakken', kort: 'Vått', farge: '#1e90ff', drift: 'Bløtt – kjør i tørre perioder eller vinter, og armer sporene med greiner', leg: '0,25–0,5 m: vått – tørre perioder eller vinter' },
  { id: 'd50', navn: 'Grunnvann 0,5–0,75 m under bakken', kort: 'Fuktig', farge: '#00bfff', drift: 'Fuktig – vanligvis kjørbart, unngå etter mye nedbør', leg: '0,5–0,75 m: fuktig – unngå etter mye regn' },
  { id: 'd75', navn: 'Grunnvann 0,75–1 m under bakken', kort: 'Lite fuktig', farge: '#87cefa', drift: 'God bæreevne det meste av året', leg: '0,75–1 m: lite fuktig' },
];
export const klasse = (id) => KLASSER.find((k) => k.id === id) || null;
const RANG = Object.fromEntries(KLASSER.map((k, i) => [k.id, i])); // lavere = våtere

// Bilde (RGBA) fra WMS-en → rutenett med klasse per celle (våteste piksel i cellen vinner, så bekker og sig ikke forsvinner).
// bbox i UTM33 [x0, y0, x1, y1], celle i meter. Rutenettet går fra sør (j = 0) mot nord, som bratthet.js.
export function tilRutenett(bilde, bbox, celle = 5) {
  const [x0, y0, x1, y1] = bbox; const nx = Math.max(1, Math.round((x1 - x0) / celle)); const ny = Math.max(1, Math.round((y1 - y0) / celle));
  const k = new Array(nx * ny).fill(null); const px = bilde.w / nx; const py = bilde.h / ny;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let best = null;
    // bildet har rad 0 i nord
    const r0 = Math.floor((ny - 1 - j) * py); const r1 = Math.max(r0 + 1, Math.floor((ny - j) * py)); const c0 = Math.floor(i * px); const c1 = Math.max(c0 + 1, Math.floor((i + 1) * px));
    for (let r = r0; r < r1 && r < bilde.h; r++) for (let c = c0; c < c1 && c < bilde.w; c++) {
      const o = (r * bilde.w + c) * 4; const kl = dtwKlasse(bilde.data[o], bilde.data[o + 1], bilde.data[o + 2], bilde.data[o + 3]);
      if (kl && kl !== 'torr' && (best == null || RANG[kl] < RANG[best])) best = kl;
    }
    k[j * nx + i] = best;
  }
  return { x0: x0 + celle / 2, y0: y0 + celle / 2, d: celle, nx, ny, k };
}
// Klassen i et punkt (samme koordinater som rutenettet), eller null for tørt (> 1 m).
export function klasseI(g, x, y) {
  if (!g) return null; const i = Math.round((x - g.x0) / g.d); const j = Math.round((y - g.y0) / g.d);
  return i < 0 || j < 0 || i >= g.nx || j >= g.ny ? null : g.k[j * g.nx + i];
}
export function tekst(id) { const k = klasse(id); return k ? `${k.kort}: ${k.navn.replace('Grunnvann ', 'grunnvann ')}` : 'Tørt: grunnvann dypere enn 1 m'; }

// Henter markfuktighet for et område (UTM33-boks) som rutenett. dekod(url) → { w, h, data } (canvas i nettleseren).
export async function hent(bbox, { dekod, celle = 5, piksel = 2 } = {}) {
  const w = Math.min(2000, Math.round((bbox[2] - bbox[0]) / piksel)); const h = Math.min(2000, Math.round((bbox[3] - bbox[1]) / piksel));
  const bilde = await dekod(url(bbox, w, h));
  return tilRutenett(bilde, bbox, celle);
}

// Andel per klasse for hvert bestand (lon/lat) fra ruter på 2 × 2 km (som driftsforhold). Gir Map(id → statistikk).
export async function perBestand(bestand, { dekod, framdrift = () => {}, rute = 2000, piksel = 4 } = {}) {
  const utm = (g) => ({ type: g.type, coordinates: g.type === 'Polygon' ? g.coordinates.map((r) => r.map(([x, y]) => geoTilUtm(x, y, 33))) : g.coordinates.map((p) => p.map((r) => r.map(([x, y]) => geoTilUtm(x, y, 33)))) });
  const ruter = new Map(); const geo = new Map();
  for (const b of bestand) {
    if (!b.geometri) continue; const g = utm(b.geometri); geo.set(b.id, g);
    const r = g.type === 'Polygon' ? g.coordinates : g.coordinates.flat(); const nokler = new Set();
    for (const ring of r) for (const [x, y] of ring) nokler.add(`${Math.floor(x / rute)}:${Math.floor(y / rute)}`);
    for (const n of nokler) { if (!ruter.has(n)) ruter.set(n, new Set()); ruter.get(n).add(b.id); }
  }
  const sum = new Map(); let n = 0;
  for (const [nokkel, ider] of ruter) {
    const [i, j] = nokkel.split(':').map(Number); const bbox = [i * rute, j * rute, (i + 1) * rute, (j + 1) * rute];
    const bilde = await dekod(url(bbox, rute / piksel, rute / piksel)); const raster = { ...bilde, bbox };
    for (const id of ider) { const a = dtwForFlate(geo.get(id), raster); if (a) { if (!sum.has(id)) sum.set(id, []); sum.get(id).push(a); } }
    framdrift(`Markfuktighet: kartrute ${++n} av ${ruter.size}`);
  }
  const ut = new Map();
  for (const [id, liste] of sum) {
    const a = {}; for (const x of liste) for (const [k, v] of Object.entries(x)) a[k] = (a[k] || 0) + v / liste.length;
    ut.set(id, { andeler: Object.fromEntries(Object.entries(a).map(([k, v]) => [k, Math.round(v * 1000) / 1000])), vat: Math.round(vatAndel(a) * 1000) / 1000, indeks: Math.round(fuktIndeks(a) * 100) / 100 });
  }
  return ut;
}
// Kort vurdering av et bestand for drift (kjøreskader).
export function vurdering(st) {
  if (!st) return null; const p = (v) => `${Math.round(v * 100)} %`; const a = st.andeler;
  const svart = (a.vann || 0) + (a.d0 || 0);
  if (svart >= 0.15) return { niva: 'svart', tekst: `${p(svart)} av arealet har grunnvann nærmere enn 25 cm – svært bløtt. Drives på tele eller snø; ellers store sporskader.` };
  if (st.vat >= 0.2) return { niva: 'vat', tekst: `${p(st.vat)} av arealet har grunnvann nærmere enn 50 cm – drives i tørre perioder eller vinter, med armerte spor.` };
  if (st.vat >= 0.05 || (a.d50 || 0) >= 0.2) return { niva: 'fuktig', tekst: `Noe fuktig (${p(st.vat)} vått, ${p(a.d50 || 0)} fuktig). Legg stikkveiene utenom de våte partiene.` };
  return { niva: 'torr', tekst: 'God bæreevne – lite våt mark.' };
}
// PNG → piksler (RGBA) i nettleseren. NIBIO tillater CORS, så lerretet kan leses.
export async function dekodPng(adresse, hentFn = fetch) {
  let r = null; let feil = null;
  for (let forsok = 0; forsok < 3 && !r; forsok++) { try { r = await hentFn(adresse); if (!r.ok) { feil = new Error(`NIBIO svarte ${r.status}`); r = null; } } catch (e) { feil = e; } if (!r && forsok < 2) await new Promise((ok) => setTimeout(ok, 800 * (forsok + 1))); }
  if (!r) throw new Error(`Markfuktighetskartet (NIBIO) svarte ikke${feil?.message ? ` (${feil.message})` : ''}. Slå kartlaget av og på for å prøve igjen.`);
  const bmp = await createImageBitmap(await r.blob());
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0);
  return { w: bmp.width, h: bmp.height, data: x.getImageData(0, 0, bmp.width, bmp.height).data };
}
export { DTW_KLASSER };
