// Koordinatomregning EUREF89 UTM <-> geografiske koordinater (GRS80), og arealberegning.
// Ingen avhengigheter, slik at appen fungerer offline og kan testes i Node.

const A = 6378137;
const F = 1 / 298.257222101;
const K0 = 0.9996;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const DEG = Math.PI / 180;

export const KOORDSYS = {
  WGS84: { navn: 'WGS84 / EUREF89 geografisk (grader)', sone: null },
  UTM32: { navn: 'EUREF89 UTM sone 32 (EPSG:25832)', sone: 32 },
  UTM33: { navn: 'EUREF89 UTM sone 33 (EPSG:25833)', sone: 33 },
  UTM35: { navn: 'EUREF89 UTM sone 35 (EPSG:25835)', sone: 35 },
};

function lon0(sone) {
  return ((sone * 6) - 183) * DEG;
}

// UTM (øst, nord) -> [lon, lat] i grader
export function utmTilGeo(ost, nord, sone) {
  const x = ost - 500000;
  const M = nord / K0;
  const mu = M / (A * (1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 ** 3 / 256));
  const s = Math.sqrt(1 - E2);
  const e1 = (1 - s) / (1 + s);
  const phi1 = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu)
    + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const sin1 = Math.sin(phi1);
  const cos1 = Math.cos(phi1);
  const tan1 = Math.tan(phi1);
  const C1 = EP2 * cos1 * cos1;
  const T1 = tan1 * tan1;
  const N1 = A / Math.sqrt(1 - E2 * sin1 * sin1);
  const R1 = A * (1 - E2) / (1 - E2 * sin1 * sin1) ** 1.5;
  const D = x / (N1 * K0);
  const lat = phi1 - (N1 * tan1 / R1) * (
    D * D / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * EP2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * EP2 - 3 * C1 * C1) * D ** 6 / 720);
  const lon = lon0(sone) + (
    D
    - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * EP2 + 24 * T1 * T1) * D ** 5 / 120) / cos1;
  return [lon / DEG, lat / DEG];
}

// [lon, lat] i grader -> [øst, nord] i gitt UTM-sone
export function geoTilUtm(lon, lat, sone) {
  const phi = lat * DEG;
  const sin = Math.sin(phi);
  const cos = Math.cos(phi);
  const tan = Math.tan(phi);
  const N = A / Math.sqrt(1 - E2 * sin * sin);
  const T = tan * tan;
  const C = EP2 * cos * cos;
  const Aa = cos * (lon * DEG - lon0(sone));
  const M = A * (
    (1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 ** 3 / 256) * phi
    - (3 * E2 / 8 + 3 * E2 * E2 / 32 + 45 * E2 ** 3 / 1024) * Math.sin(2 * phi)
    + (15 * E2 * E2 / 256 + 45 * E2 ** 3 / 1024) * Math.sin(4 * phi)
    - (35 * E2 ** 3 / 3072) * Math.sin(6 * phi));
  const ost = K0 * N * (
    Aa
    + (1 - T + C) * Aa ** 3 / 6
    + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa ** 5 / 120) + 500000;
  const nord = K0 * (M + N * tan * (
    Aa * Aa / 2
    + (5 - T + 9 * C + 4 * C * C) * Aa ** 4 / 24
    + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa ** 6 / 720));
  return [ost, nord];
}

// Gjetter koordinatsystem ut fra tallstørrelser når filen ikke sier det.
export function gjettKoordsys(x, y) {
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return 'WGS84';
  if (y > 6_000_000 && y < 8_000_000) {
    if (x < 0 || x > 1_000_000) return null;
    // Sone 33 dekker hele Norge greit, men de fleste planer på Østlandet/Vestlandet er i sone 32.
    return 'UTM32';
  }
  return null;
}

// Gjør om alle koordinater i en GeoJSON-geometri med en funksjon (mutasjon-fri).
export function mapKoordinater(geom, fn) {
  if (!geom) return geom;
  const rek = (c) => (typeof c[0] === 'number' ? fn(c) : c.map(rek));
  if (geom.type === 'GeometryCollection') {
    return { type: geom.type, geometries: geom.geometries.map((g) => mapKoordinater(g, fn)) };
  }
  return { type: geom.type, coordinates: rek(geom.coordinates) };
}

export function tilWgs84(geom, koordsys) {
  if (!koordsys || koordsys === 'WGS84') return geom;
  const sone = KOORDSYS[koordsys].sone;
  return mapKoordinater(geom, ([x, y]) => utmTilGeo(x, y, sone));
}

export function fraWgs84(geom, koordsys) {
  if (!koordsys || koordsys === 'WGS84') return geom;
  const sone = KOORDSYS[koordsys].sone;
  return mapKoordinater(geom, ([lon, lat]) => geoTilUtm(lon, lat, sone).map((v) => Math.round(v * 100) / 100));
}

// Sfærisk ringareal (m²), samme metode som brukes i mange kartbiblioteker. Nøyaktig nok for bestandsareal.
function ringAreal(ring) {
  const R = 6378137;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[(i + 1) % ring.length];
    sum += (lon2 - lon1) * DEG * (2 + Math.sin(lat1 * DEG) + Math.sin(lat2 * DEG));
  }
  return Math.abs(sum * R * R / 2);
}

export function arealM2(geom) {
  if (!geom) return 0;
  const poly = (rings) => rings.reduce((s, r, i) => s + (i === 0 ? ringAreal(r) : -ringAreal(r)), 0);
  if (geom.type === 'Polygon') return poly(geom.coordinates);
  if (geom.type === 'MultiPolygon') return geom.coordinates.reduce((s, p) => s + poly(p), 0);
  return 0;
}

function punktIRing([x, y], ring) {
  let inne = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inne = !inne;
  }
  return inne;
}

export function punktIGeometri(pt, geom) {
  if (!geom) return false;
  const iPoly = (rings) => punktIRing(pt, rings[0]) && !rings.slice(1).some((r) => punktIRing(pt, r));
  if (geom.type === 'Polygon') return iPoly(geom.coordinates);
  if (geom.type === 'MultiPolygon') return geom.coordinates.some(iPoly);
  return false;
}

export function bbox(geoms) {
  let minx = Infinity; let miny = Infinity; let maxx = -Infinity; let maxy = -Infinity;
  for (const g of geoms) {
    if (!g) continue;
    mapKoordinater(g, ([x, y]) => {
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
      return [x, y];
    });
  }
  return minx === Infinity ? null : [minx, miny, maxx, maxy];
}
