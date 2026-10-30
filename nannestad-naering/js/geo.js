// Enkle geometrifunksjoner for GeoJSON i [lon, lat] (EUREF89/WGS84). Ingen avhengigheter, kjører i nettleser og Node.

// Alle ringer i en (Multi)Polygon som liste av polygoner: [[ytre, hull…], …]
export function polygoner(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}

export function alleKoordinater(geom) {
  if (!geom) return [];
  if (geom.type === 'Point') return [geom.coordinates];
  if (geom.type === 'LineString' || geom.type === 'MultiPoint') return geom.coordinates;
  if (geom.type === 'MultiLineString') return geom.coordinates.flat();
  return polygoner(geom).flat(2);
}

export function bbox(geom) {
  let [a, b, c, d] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of alleKoordinater(geom)) {
    if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y;
  }
  return [a, b, c, d];
}

// Utvider en bbox med et antall meter i alle retninger.
export function utvidBbox([a, b, c, d], meter) {
  const dy = meter / 111320;
  const dx = meter / (111320 * Math.cos(((b + d) / 2) * Math.PI / 180));
  return [a - dx, b - dy, c + dx, d + dy];
}

function iRing([x, y], ring) {
  let inne = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inne = !inne;
  }
  return inne;
}

export function punktIPolygon(pt, geom) {
  return polygoner(geom).some(([ytre, ...hull]) => iRing(pt, ytre) && !hull.some((h) => iRing(pt, h)));
}

function kryss(p1, p2, p3, p4) {
  const d = (a, b, c) => (c[0] - a[0]) * (b[1] - a[1]) - (b[0] - a[0]) * (c[1] - a[1]);
  const d1 = d(p3, p4, p1); const d2 = d(p3, p4, p2); const d3 = d(p1, p2, p3); const d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function kanter(geom) {
  const ut = [];
  for (const poly of polygoner(geom)) for (const ring of poly) for (let i = 1; i < ring.length; i++) ut.push([ring[i - 1], ring[i]]);
  if (geom?.type === 'LineString') for (let i = 1; i < geom.coordinates.length; i++) ut.push([geom.coordinates[i - 1], geom.coordinates[i]]);
  return ut;
}

const bboxOverlapp = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

// Om geometri a (punkt/flate) og flate b overlapper.
export function overlapper(a, b) {
  if (!a || !b) return false;
  if (a.type === 'Point') return punktIPolygon(a.coordinates, b);
  if (b.type === 'Point') return punktIPolygon(b.coordinates, a);
  if (!bboxOverlapp(bbox(a), bbox(b))) return false;
  if (alleKoordinater(a).some((p) => punktIPolygon(p, b))) return true;
  if (alleKoordinater(b).some((p) => punktIPolygon(p, a))) return true;
  const kb = kanter(b);
  return kanter(a).some(([p1, p2]) => kb.some(([p3, p4]) => kryss(p1, p2, p3, p4)));
}

// Avstand i meter mellom to punkter (haversine).
export function avstandM([x1, y1], [x2, y2]) {
  const r = Math.PI / 180;
  const a = Math.sin(((y2 - y1) * r) / 2) ** 2 + Math.cos(y1 * r) * Math.cos(y2 * r) * Math.sin(((x2 - x1) * r) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(a));
}

// Korteste avstand fra punkt til kanten av en flate (0 hvis punktet ligger inni).
export function avstandTilFlate(pt, geom) {
  if (punktIPolygon(pt, geom)) return 0;
  const kx = Math.cos(pt[1] * Math.PI / 180) * 111320; const ky = 111320;
  let min = Infinity;
  for (const [a, b] of kanter(geom)) {
    const ax = (a[0] - pt[0]) * kx; const ay = (a[1] - pt[1]) * ky;
    const bx = (b[0] - pt[0]) * kx; const by = (b[1] - pt[1]) * ky;
    const dx = bx - ax; const dy = by - ay; const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
    min = Math.min(min, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return min;
}

// Areal i m² (sfærisk tilnærming, god nok for eiendommer).
export function arealM2(geom) {
  const R = 6378137; const r = Math.PI / 180;
  const ring = (c) => {
    let s = 0;
    for (let i = 0; i < c.length - 1; i++) s += (c[i + 1][0] - c[i][0]) * r * (2 + Math.sin(c[i][1] * r) + Math.sin(c[i + 1][1] * r));
    return Math.abs((s * R * R) / 2);
  };
  return polygoner(geom).reduce((sum, [ytre, ...hull]) => sum + ring(ytre) - hull.reduce((h, x) => h + ring(x), 0), 0);
}

// Et punkt som garantert ligger inne i flaten (sentroide hvis den ligger inni, ellers midt på en horisontal skanning).
export function indrePunkt(geom) {
  const polys = polygoner(geom);
  if (!polys.length) return geom?.type === 'Point' ? geom.coordinates : null;
  const storst = polys.map((p) => ({ type: 'Polygon', coordinates: p })).sort((a, b) => arealM2(b) - arealM2(a))[0];
  const ytre = storst.coordinates[0];
  const sx = ytre.reduce((s, p) => s + p[0], 0) / ytre.length; const sy = ytre.reduce((s, p) => s + p[1], 0) / ytre.length;
  if (punktIPolygon([sx, sy], storst)) return [sx, sy];
  const [a, , c] = bbox(storst);
  const xs = [];
  for (const [p, q] of kanter(storst)) if ((p[1] > sy) !== (q[1] > sy)) xs.push(p[0] + ((sy - p[1]) * (q[0] - p[0])) / (q[1] - p[1]));
  xs.sort((m, n) => m - n);
  let best = null; let bredde = -1;
  for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] - xs[i] > bredde) { bredde = xs[i + 1] - xs[i]; best = [(xs[i] + xs[i + 1]) / 2, sy]; }
  return best || [(a + c) / 2, sy];
}

export function slaaSammen(geometrier) {
  const coords = geometrier.flatMap((g) => polygoner(g));
  return coords.length === 1 ? { type: 'Polygon', coordinates: coords[0] } : { type: 'MultiPolygon', coordinates: coords };
}
