// Geometri for å endre flaten til et tiltak: forenkling til et redigerbart antall punkter, legg til / fjern område,
// og klipping mot bestandet. Arbeider i UTM 33 (meter). polygon-clipping sendes inn som PC. Ingen DOM.
import { geoTilUtm, utmTilGeo } from './proj.js';
import { forenkle, mpTilUtm, mpTilGeo, arealUtm } from './sporlogg.js';

export const tilUtmPunkt = ([lon, lat]) => geoTilUtm(lon, lat, 33);
export const tilGeoPunkt = ([x, y]) => utmTilGeo(x, y, 33);
export { mpTilUtm, mpTilGeo, arealUtm };

const lukk = (ring) => (ring.length && (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) ? [...ring, ring[0]] : ring);
const ringAreal = (r) => { let a = 0; for (let i = 1; i < r.length; i++) a += r[i - 1][0] * r[i][1] - r[i][0] * r[i - 1][1]; return Math.abs(a / 2); };
// Douglas–Peucker for en lukket ring: delt ved punktet lengst fra startpunktet, så begge halvdeler har en ekte grunnlinje.
function forenkleRing(ring, tol) {
  const aapen = lukk(ring).slice(0, -1);
  if (aapen.length < 4) return lukk(aapen);
  let k = 1; let maks = -1;
  for (let i = 1; i < aapen.length; i++) { const d = Math.hypot(aapen[i][0] - aapen[0][0], aapen[i][1] - aapen[0][1]); if (d > maks) { maks = d; k = i; } }
  const a = forenkle(aapen.slice(0, k + 1), tol); const b = forenkle([...aapen.slice(k), aapen[0]], tol);
  return [...a, ...b.slice(1)];
}
export const antallPunkter = (mp) => mp.reduce((s, p) => s + p.reduce((t, r) => t + Math.max(0, r.length - 1), 0), 0);

// Forenkler flaten til høyst maks punkter (Douglas–Peucker med økende toleranse). Små biter og hull (under minM2) fjernes.
export function forenkleForRedigering(mp, { maks = 160, minM2 = 10 } = {}) {
  let tol = 0.5; let ut = mp;
  const rens = (m) => m.map((p) => p.map((r) => lukk(r)).filter((r, i) => r.length >= 4 && (i === 0 || ringAreal(r) >= minM2)))
    .filter((p) => p.length && ringAreal(p[0]) >= minM2);
  ut = rens(mp);
  while (antallPunkter(ut) > maks && tol < 64) {
    tol *= 2;
    ut = rens(mp.map((p) => p.map((r) => forenkleRing(r, tol))));
  }
  return ut;
}

// Kombinerer flaten med et tegnet polygon (UTM-ring): 'legg-til' (union), 'fjern' (differanse) eller 'ny' (erstatt).
export function kombiner(mp, ring, op, PC) {
  const poly = [lukk(ring)];
  if (op === 'ny' || !mp.length) return op === 'fjern' ? [] : PC.union(poly);
  if (op === 'legg-til') return PC.union(mp, poly);
  if (op === 'fjern') return PC.difference(mp, poly);
  return mp;
}

// Klipper flaten mot bestandets geometri (GeoJSON) og gir { mp, daa, andel }.
export function klippTilBestand(mp, bestandGeom, PC) {
  if (!mp.length) return { mp: [], daa: 0, andel: 0 };
  const g = mpTilUtm(bestandGeom);
  let snitt;
  try { snitt = PC.intersection(mp, g); } catch { snitt = mp; }
  const m2 = arealUtm(snitt); const best = arealUtm(g) || 1;
  return { mp: snitt, daa: m2 / 1000, andel: Math.min(1, m2 / best) };
}

// GeoJSON-geometri ↔ redigerbar liste (MultiPolygon-koordinater i UTM).
export const fraGeometri = (geom) => (geom ? mpTilUtm(geom) : []);
export const tilGeometri = (mp) => (mp.length ? { type: 'MultiPolygon', coordinates: mpTilGeo(mp) } : null);
