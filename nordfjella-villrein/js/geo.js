// Ren geometri uten avhengigheter: punkt i flate, avstand til grense, UTM, kartfliser og GPX.
// Koordinater er [lon, lat] i WGS84/EUREF89 slik som i GeoJSON.

const R = 6371008.8;
const rad = (g) => (g * Math.PI) / 180;

export function avstandM([lon1, lat1], [lon2, lat2]) {
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Kompassretning i grader (0 = nord) fra a til b.
export function retning([lon1, lat1], [lon2, lat2]) {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function himmelretning(grader) {
  return ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'][Math.round(grader / 45) % 8];
}

// Alle ringer i en Polygon/MultiPolygon/Feature/FeatureCollection, gruppert per polygon.
export function polygoner(g) {
  if (!g) return [];
  if (g.type === 'FeatureCollection') return g.features.flatMap((f) => polygoner(f.geometry));
  if (g.type === 'Feature') return polygoner(g.geometry);
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  if (g.type === 'GeometryCollection') return g.geometries.flatMap(polygoner);
  return [];
}

function iRing([x, y], ring) {
  let inne = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inne = !inne;
  }
  return inne;
}

// Ytre ring teller inn, hull teller ut.
export function punktIPolygon(p, g) {
  return polygoner(g).some(([ytre, ...hull]) => iRing(p, ytre) && !hull.some((h) => iRing(p, h)));
}

// Korteste avstand i meter fra punktet til en grenselinje (ytre ring eller hull).
// Regnes i en lokal flat projeksjon rundt punktet, som er godt nok på noen titalls km.
export function avstandTilGrense(p, g) {
  const kx = (Math.PI / 180) * R * Math.cos(rad(p[1])), ky = (Math.PI / 180) * R;
  let best = Infinity, nærmest = null;
  for (const poly of polygoner(g)) for (const ring of poly) {
    for (let i = 1; i < ring.length; i++) {
      const ax = (ring[i - 1][0] - p[0]) * kx, ay = (ring[i - 1][1] - p[1]) * ky;
      const bx = (ring[i][0] - p[0]) * kx, by = (ring[i][1] - p[1]) * ky;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
      const qx = ax + t * dx, qy = ay + t * dy, d = Math.hypot(qx, qy);
      if (d < best) { best = d; nærmest = [p[0] + qx / kx, p[1] + qy / ky]; }
    }
  }
  return { meter: best, punkt: nærmest };
}

export function bbox(g) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const poly of polygoner(g)) for (const ring of poly) for (const [x, y] of ring) {
    if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
  }
  return b;
}

// ---------- UTM (EUREF89 / WGS84), Krüger-serier som i Kartverkets formler ----------

export function utm([lon, lat], sone = Math.floor((lon + 180) / 6) + 1) {
  const a = 6378137, f = 1 / 298.257222101, k0 = 0.9996;
  const n = f / (2 - f), A = (a / (1 + n)) * (1 + n * n / 4 + n ** 4 / 64);
  const al = [n / 2 - (2 / 3) * n * n + (5 / 16) * n ** 3, (13 / 48) * n * n - (3 / 5) * n ** 3, (61 / 240) * n ** 3];
  const e = Math.sqrt(f * (2 - f));
  const φ = rad(lat), λ = rad(lon - (sone * 6 - 183));
  const t = Math.sinh(Math.atanh(Math.sin(φ)) - e * Math.atanh(e * Math.sin(φ)));
  const ξ = Math.atan2(t, Math.cos(λ)), η = Math.atanh(Math.sin(λ) / Math.sqrt(1 + t * t));
  let E = η, N = ξ;
  for (let j = 1; j <= 3; j++) {
    E += al[j - 1] * Math.cos(2 * j * ξ) * Math.sinh(2 * j * η);
    N += al[j - 1] * Math.sin(2 * j * ξ) * Math.cosh(2 * j * η);
  }
  const bånd = 'CDEFGHJKLMNPQRSTUVWXX'[Math.floor((lat + 80) / 8)] || '';
  return { sone, bånd, øst: 500000 + k0 * A * E, nord: k0 * A * N };
}

export function utmTekst(p, sone) {
  const u = utm(p, sone);
  return `${u.sone}${u.bånd} ${Math.round(u.øst)}Ø ${Math.round(u.nord)}N`;
}

// ---------- Kartfliser (Web Mercator, XYZ) ----------

export const flisX = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
export const flisY = (lat, z) => Math.floor(((1 - Math.log(Math.tan(rad(lat)) + 1 / Math.cos(rad(lat))) / Math.PI) / 2) * 2 ** z);
export const flisLon = (x, z) => (x / 2 ** z) * 360 - 180;
export const flisLat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

// Web Mercator-bbox (EPSG:3857) for en flis, brukt til WMS-kall.
export function flisBbox3857(x, y, z) {
  const s = 2 * Math.PI * 6378137, d = s / 2 ** z, o = s / 2;
  return [x * d - o, o - (y + 1) * d, (x + 1) * d - o, o - y * d];
}

// Fliser som dekker flaten (pluss en kant på `kantM` meter) for zoomnivåene fra–til.
// Går nedover i flispyramiden: barn av en flis som ligger helt inne er også helt inne,
// og barn av en flis som ligger helt utenfor kan hoppes over. Bare kantflisene må sjekkes.
export function fliserFor(g, zFra, zTil, kantM = 500) {
  const [v, s, ø, n] = bbox(g);
  const sjekk = (z, x, y) => {
    const lon0 = flisLon(x, z), lon1 = flisLon(x + 1, z), lat0 = flisLat(y + 1, z), lat1 = flisLat(y, z);
    const midt = [(lon0 + lon1) / 2, (lat0 + lat1) / 2];
    const halvDiag = avstandM([lon0, lat0], [lon1, lat1]) / 2;
    const d = avstandTilGrense(midt, g).meter;
    if (punktIPolygon(midt, g)) return d > halvDiag ? 'inne' : 'kant';
    return d <= halvDiag + kantM ? 'kant' : null;
  };
  let nivå = [];
  for (let x = flisX(v, zFra); x <= flisX(ø, zFra); x++) {
    for (let y = flisY(n, zFra); y <= flisY(s, zFra); y++) { const k = sjekk(zFra, x, y); if (k) nivå.push([x, y, k]); }
  }
  const ut = nivå.map(([x, y]) => [zFra, x, y]);
  for (let z = zFra + 1; z <= zTil; z++) {
    const neste = [];
    for (const [px, py, pk] of nivå) {
      for (const [x, y] of [[2 * px, 2 * py], [2 * px + 1, 2 * py], [2 * px, 2 * py + 1], [2 * px + 1, 2 * py + 1]]) {
        const k = pk === 'inne' ? 'inne' : sjekk(z, x, y);
        if (k) { neste.push([x, y, k]); ut.push([z, x, y]); }
      }
    }
    nivå = neste;
  }
  return ut;
}

// ---------- GPX ----------

const xml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

export function gpx(punkter, navn = 'Nordfjella villrein') {
  const wpt = punkter.map((p) => `  <wpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">${p.hoyde != null ? `<ele>${p.hoyde.toFixed(1)}</ele>` : ''}<time>${new Date(p.tid).toISOString()}</time><name>${xml(p.navn)}</name>${p.notat ? `<desc>${xml(p.notat)}</desc>` : ''}<type>${xml(p.type)}</type></wpt>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="${xml(navn)}" xmlns="http://www.topografix.com/GPX/1/1">\n${wpt.join('\n')}\n</gpx>\n`;
}
