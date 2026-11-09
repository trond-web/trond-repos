// Forslag til driftsveg (basveg for lassbærer) for et hogstoppdrag: hvor hovedkjøresporet bør gå fra hogstflatene til
// velteplass ved bilvei, med minst mulig kjørespor og inngrep i terrenget, og mest mulig tømmer innenfor rekkevidde.
// Ingen DOM – kan testes i Node. Dataene hentes av driftsveg-ui.js.
//
// Metode (kostnadsrutenett og minste-kostnads-sti, som i GIS-baserte planleggingsverktøy for driftsveger):
//   * Rutenett (8–20 m) over hogstflatene og fram til nærmeste bilvei. Hver rute får terreng (Kartverket DTM1),
//     markfuktighet (NIBIO DTW), hindre (kulturminner med sikringssone, miljøfigurer/MiS, vann) og hensyn (NiN-naturtyper
//     og viktige artsområder), eksisterende traktorveier/stier (FKB) og tømmervolum per rute fra bestandene.
//   * Kostnaden for å kjøre én rute videre øker med sidehelling (velte- og gravefare: inngrep), stigning (lastet
//     lassbærer opp bakke), våt mark (sporskader), hensynsområder og skog utenfor hogstflatene. Den reduseres der
//     det allerede går traktorvei eller sti (ingen nye inngrep) og der det står mye tømmer (kort vei for mest volum).
//     Vann, kulturminner (inkl. 5 m sikringssone), miljøfigurer og terreng over grensene er sperret.
//   * Nettet bygges grådig: start ved bilveien, legg til grenen som dekker mest udekket tømmer, og koble den til
//     nettet med billigste sti (Dijkstra). Eksisterende nett koster ingenting å bruke igjen, så grenene deler spor.
//     Stopper når nesten alt tømmer er innenfor stikkveilengden fra nettet.
// Resultatet er et forslag: entreprenøren justerer i terrenget (bekkekryssinger, stubber, blokker, tele).
import { geoTilUtm, utmTilGeo, punktIGeometri } from './proj.js';

export const KILDER = {
  forskrift: { navn: 'Forskrift om planlegging og godkjenning av veier for landbruksformål (traktorveg klasse 7 og 8 krever godkjenning)', url: 'https://lovdata.no/forskrift/2015-02-13-140' },
  pefc: { navn: 'Norsk PEFC Skogstandard – krav 14 (kjøreskader), 27 (kantsoner) og 30 (kulturminner)', url: 'https://pefcnorge.org/' },
  kjoreskader: { navn: 'Skogbrukets kursinstitutt: Unngå kjøreskader – basveg, stikkveg og risting', url: 'https://www.skogkurs.no/' },
  dtw: { navn: 'NIBIO markfuktighetskart (DTW)', url: 'https://kilden.nibio.no/' },
  hoyde: { navn: 'Kartverket høydedata (DTM1)', url: 'https://hoydedata.no' },
};
// Grenser og vekter. Helning i prosent (100 % = 45°).
export const STANDARD = {
  celle: null,             // m – velges automatisk (8–20 m) etter størrelsen på området
  maksRuter: 12000,
  dekning: 50,             // m – lengste stikkveg fra basvegen; alt tømmer innenfor dette regnes som dekket
  kran: 10,                // m – kranrekkevidde fra kjøresporet
  bredde: 4,               // m – sporbredde (kjørespor-areal)
  maksSide: 35, sideStart: 15,          // sidehelling: sperret over, økende kostnad fra
  maksOpp: 30, oppStart: 12,            // lastet lassbærer oppover (mot velteplass)
  maksNed: 45, nedStart: 30,            // lastet lassbærer nedover
  fukt: { vann: Infinity, d0: 10, d25: 5, d50: 2, d100: 1.2 },
  hensyn: 6,               // NiN-naturtyper og viktige artsområder
  utenfor: 2.5,            // skog utenfor hogstflatene (må hogges for sporet)
  spor: 0.25,              // eksisterende traktorvei eller sti
  vei: 0.05,               // bilvei
  tommer: 0.45,            // inntil 45 % rabatt der det står mest tømmer
  maksGrener: 30, restAndel: 0.04, sikring: 5,
};

// ---------- geometri ----------
const ringerAv = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
const linjerAv = (g) => (g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []);
export const tilUtm = (g) => {
  const f = (c) => (typeof c[0] === 'number' ? geoTilUtm(c[0], c[1], 33) : c.map(f));
  return { type: g.type, coordinates: f(g.coordinates) };
};
export const tilGeo = (g) => {
  const f = (c) => (typeof c[0] === 'number' ? utmTilGeo(c[0], c[1], 33).map((v) => Math.round(v * 1e6) / 1e6) : c.map(f));
  return { type: g.type, coordinates: f(g.coordinates) };
};
function avstandPunktSegment(p, a, b) {
  const dx = b[0] - a[0]; const dy = b[1] - a[1]; const l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function iRing(p, r) { let inn = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i]; const [xj, yj] = r[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inn = !inn; } return inn; }
function iPolygonUtm(p, g) { return ringerAv(g).some((rs) => iRing(p, rs[0]) && !rs.slice(1).some((r) => iRing(p, r))); }
function naerPolygonUtm(p, g, buffer) {
  if (iPolygonUtm(p, g)) return true; if (!buffer) return false;
  for (const rs of ringerAv(g)) for (const r of rs) for (let i = 1; i < r.length; i++) if (avstandPunktSegment(p, r[i - 1], r[i]) <= buffer) return true;
  return false;
}
const boksAv = (geoms) => { let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity; const gaa = (c) => { if (typeof c[0] === 'number') { if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0]; if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1]; } else c.forEach(gaa); }; geoms.forEach((g) => gaa(g.coordinates)); return [x0, y0, x1, y1]; };

// Nærmeste punkt på bilveiene (UTM) fra boksen rundt hogstflatene.
export function naermesteVei(feltBoks, veier) {
  const [x0, y0, x1, y1] = feltBoks; const midt = [(x0 + x1) / 2, (y0 + y1) / 2]; let best = null;
  for (const v of veier) for (const l of linjerAv(v)) for (let i = 1; i < l.length; i++) {
    const a = l[i - 1]; const b = l[i];
    for (let t = 0; t <= 1; t += 0.1) { const p = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]; const dx = Math.max(x0 - p[0], 0, p[0] - x1); const dy = Math.max(y0 - p[1], 0, p[1] - y1); const d = Math.hypot(dx, dy) + Math.hypot(p[0] - midt[0], p[1] - midt[1]) * 0.05; if (!best || d < best.d) best = { d, p, avstand: Math.hypot(dx, dy) }; }
  }
  return best;
}

// Rutenett over hogstflatene, utvidet til nærmeste bilvei (høyst maksVei meter).
export function lagRutenett(feltUtm, veierUtm, { celle = null, maksRuter = STANDARD.maksRuter, kant = 60, maksVei = 1500 } = {}) {
  let [x0, y0, x1, y1] = boksAv(feltUtm); const feltBoks = [x0, y0, x1, y1];
  const vei = naermesteVei(feltBoks, veierUtm);
  if (vei && vei.avstand <= maksVei) { x0 = Math.min(x0, vei.p[0]); y0 = Math.min(y0, vei.p[1]); x1 = Math.max(x1, vei.p[0]); y1 = Math.max(y1, vei.p[1]); }
  x0 -= kant; y0 -= kant; x1 += kant; y1 += kant;
  const d = celle || Math.max(8, Math.min(20, Math.ceil(Math.sqrt(((x1 - x0) * (y1 - y0)) / maksRuter))));
  const nx = Math.floor((x1 - x0) / d) + 1; const ny = Math.floor((y1 - y0) / d) + 1;
  return { x0, y0, d, nx, ny, vei, feltBoks };
}
export const senter = (g, k) => [g.x0 + (k % g.nx) * g.d, g.y0 + Math.floor(k / g.nx) * g.d];
export const punkterGeo = (g) => Array.from({ length: g.nx * g.ny }, (_, k) => { const [x, y] = senter(g, k); return utmTilGeo(x, y, 33); });

// Merker linjer (bilvei, traktorvei) i rutenettet.
function rasterLinjer(g, geoms, ut, verdi) {
  for (const geom of geoms) for (const l of linjerAv(geom)) for (let i = 1; i < l.length; i++) {
    const a = l[i - 1]; const b = l[i]; const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (g.d / 3)));
    for (let s = 0; s <= n; s++) { const x = a[0] + ((b[0] - a[0]) * s) / n; const y = a[1] + ((b[1] - a[1]) * s) / n; const i2 = Math.round((x - g.x0) / g.d); const j2 = Math.round((y - g.y0) / g.d); if (i2 >= 0 && j2 >= 0 && i2 < g.nx && j2 < g.ny) ut[j2 * g.nx + i2] = verdi; }
  }
}

// Bygger lagene i rutenettet. felt: [{ geometri (UTM), m3 (volum som tas ut) }].
export function byggLag(g, { felt = [], z = null, fukt = null, sperret = [], hensyn = [], veier = [], spor = [], sikring = STANDARD.sikring } = {}) {
  const n = g.nx * g.ny; const L = { felt: new Int16Array(n).fill(-1), vol: new Float32Array(n), sperret: new Uint8Array(n), hensyn: new Uint8Array(n), vei: new Uint8Array(n), spor: new Uint8Array(n), fukt: new Array(n).fill(null), z };
  const bokser = (liste) => liste.map((x) => ({ x, bb: boksAv([x.geometri || x]) }));
  const fb = bokser(felt); const sb = bokser(sperret); const hb = bokser(hensyn);
  const iBoks = (p, bb, b = 0) => p[0] >= bb[0] - b && p[0] <= bb[2] + b && p[1] >= bb[1] - b && p[1] <= bb[3] + b;
  const telle = new Map();
  for (let k = 0; k < n; k++) {
    const p = senter(g, k);
    for (let f = 0; f < fb.length; f++) if (iBoks(p, fb[f].bb) && iPolygonUtm(p, fb[f].x.geometri)) { L.felt[k] = f; telle.set(f, (telle.get(f) || 0) + 1); break; }
    for (const { x, bb } of sb) if (iBoks(p, bb, sikring + g.d) && naerPolygonUtm(p, x.geometri || x, sikring + g.d / 2)) { L.sperret[k] = 1; break; }
    for (const { x, bb } of hb) if (iBoks(p, bb) && iPolygonUtm(p, x.geometri || x)) { L.hensyn[k] = 1; break; }
    if (fukt) { const i = Math.round((p[0] - fukt.x0) / fukt.d); const j = Math.round((p[1] - fukt.y0) / fukt.d); L.fukt[k] = i < 0 || j < 0 || i >= fukt.nx || j >= fukt.ny ? null : fukt.k[j * fukt.nx + i]; }
  }
  // Volumet i hver flate fordeles likt på rutene i flaten.
  for (let k = 0; k < n; k++) if (L.felt[k] >= 0) L.vol[k] = (felt[L.felt[k]].m3 || 0) / telle.get(L.felt[k]);
  rasterLinjer(g, spor, L.spor, 1); rasterLinjer(g, veier, L.vei, 1);
  for (let k = 0; k < n; k++) if (L.vei[k]) L.sperret[k] = 0; // bilveien er alltid farbar
  if (z) L.hoyde = z;
  return L;
}

// Min-heap for Dijkstra.
class Heap { constructor() { this.k = []; this.p = []; } get size() { return this.k.length; }
  push(k, p) { const a = this.k; const b = this.p; let i = a.length; a.push(k); b.push(p); while (i > 0) { const m = (i - 1) >> 1; if (b[m] <= p) break; a[i] = a[m]; b[i] = b[m]; i = m; } a[i] = k; b[i] = p; }
  pop() { const a = this.k; const b = this.p; const top = a[0]; const lk = a.pop(); const lp = b.pop(); if (a.length) { let i = 0; const n = a.length; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && b[c + 1] < b[c]) c++; if (b[c] >= lp) break; a[i] = a[c]; b[i] = b[c]; i = c; } a[i] = lk; b[i] = lp; } return top; } }

const NAB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
// Kostnadsfaktor for å kjøre (lastet) fra rute u til rute v (v er nærmere velteplassen). Infinity = sperret.
export function kantFaktor(L, g, u, v, dist, o = STANDARD, rabatt = null) {
  if (L.sperret[v] || L.sperret[u]) return Infinity;
  const fk = L.fukt[v]; const ff = fk ? (o.fukt[fk] ?? 1) : 1; if (!Number.isFinite(ff)) return Infinity;
  if (L.vei[v] && L.vei[u]) return o.vei;
  let f = ff;
  const z = L.hoyde;
  if (z && Number.isFinite(z[u]) && Number.isFinite(z[v])) {
    const stigning = ((z[v] - z[u]) / dist) * 100; // + = oppover for lastet maskin
    if (stigning > o.maksOpp || -stigning > o.maksNed) return Infinity;
    if (stigning > o.oppStart) f *= 1 + (stigning - o.oppStart) / 5;
    if (-stigning > o.nedStart) f *= 1 + (-stigning - o.nedStart) / 6;
    const side = sidehelling(L, g, v, u);
    if (side != null) { if (side > o.maksSide) return Infinity; if (side > o.sideStart) f *= 1 + ((side - o.sideStart) / 4) ** 1.5; }
  }
  if (L.hensyn[v]) f *= o.hensyn;
  if (L.spor[v]) f *= o.spor; else if (L.felt[v] < 0 && !L.vei[v]) f *= o.utenfor;
  if (rabatt) f *= 1 - rabatt[v];
  return f;
}
// Helning på tvers av kjøreretningen u→v i rute v (prosent).
function sidehelling(L, g, v, u) {
  const z = L.hoyde; const i = v % g.nx; const j = Math.floor(v / g.nx);
  const h = (a, b) => (a < 0 || b < 0 || a >= g.nx || b >= g.ny ? null : z[b * g.nx + a]);
  const zx0 = h(i - 1, j); const zx1 = h(i + 1, j); const zy0 = h(i, j - 1); const zy1 = h(i, j + 1);
  if (![zx0, zx1, zy0, zy1].every(Number.isFinite)) return null;
  const gx = (zx1 - zx0) / (2 * g.d); const gy = (zy1 - zy0) / (2 * g.d);
  const rx = (v % g.nx) - (u % g.nx); const ry = Math.floor(v / g.nx) - Math.floor(u / g.nx); const l = Math.hypot(rx, ry) || 1;
  return Math.abs(gx * (-ry / l) + gy * (rx / l)) * 100; // gradient langs normalen
}

// Dijkstra fra kildene (kost 0) utover. Kantene regnes i lastet retning: fra naboen mot kilden.
export function dijkstra(L, g, kilder, o = STANDARD, rabatt = null) {
  const n = g.nx * g.ny; const kost = new Float64Array(n).fill(Infinity); const forrige = new Int32Array(n).fill(-1); const h = new Heap();
  for (const k of kilder) { kost[k] = 0; h.push(k, 0); }
  while (h.size) {
    const v = h.pop(); const kv = kost[v]; const i = v % g.nx; const j = Math.floor(v / g.nx);
    for (const [di, dj] of NAB) {
      const a = i + di; const b = j + dj; if (a < 0 || b < 0 || a >= g.nx || b >= g.ny) continue;
      const u = b * g.nx + a; const dist = di && dj ? g.d * Math.SQRT2 : g.d;
      const f = kantFaktor(L, g, u, v, dist, o, rabatt); if (!Number.isFinite(f)) continue;
      const ny = kv + dist * f; if (ny < kost[u]) { kost[u] = ny; forrige[u] = v; h.push(u, ny); }
    }
  }
  return { kost, forrige };
}

// Hele forslaget. Gir { grener: [[k …]], nett: Set, velteplasser, stat, advarsler } i rutenettet.
export function optimaliser(g, L, o = STANDARD) {
  const n = g.nx * g.ny; const R = o.dekning; const r = Math.ceil(R / g.d); const advarsler = [];
  const vei = []; for (let k = 0; k < n; k++) if (L.vei[k]) vei.push(k);
  if (!vei.length) return { feil: 'Fant ingen bilvei i nærheten av hogstflatene. Legg inn veiene i Veier-fanen (eller hent fra NVDB) og prøv igjen.' };
  const totalVol = L.vol.reduce((s, v) => s + v, 0);
  // Tømmerrabatt: volum innen kranrekkevidde rundt ruten, i forhold til det tetteste.
  const rk = Math.max(1, Math.round(o.kran / g.d)); const naerVol = new Float32Array(n); let maks = 0;
  for (let k = 0; k < n; k++) { if (L.felt[k] < 0) continue; const i = k % g.nx; const j = Math.floor(k / g.nx); let s = 0; for (let b = -rk; b <= rk; b++) for (let a = -rk; a <= rk; a++) { const x = i + a; const y = j + b; if (x >= 0 && y >= 0 && x < g.nx && y < g.ny) s += L.vol[y * g.nx + x]; } naerVol[k] = s; if (s > maks) maks = s; }
  const rabatt = new Float32Array(n); if (maks > 0) for (let k = 0; k < n; k++) rabatt[k] = (naerVol[k] / maks) * o.tommer;
  const nett = new Set(); const grener = []; const dekket = new Uint8Array(n);
  const dekk = (k) => { const i = k % g.nx; const j = Math.floor(k / g.nx); for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) { if (a * a + b * b > r * r) continue; const x = i + a; const y = j + b; if (x >= 0 && y >= 0 && x < g.nx && y < g.ny) dekket[y * g.nx + x] = 1; } };
  let kilder = vei; let restVol = totalVol; const uoppnaelig = new Uint8Array(n);
  for (let runde = 0; runde < o.maksGrener && restVol > totalVol * o.restAndel; runde++) {
    const { kost, forrige } = dijkstra(L, g, kilder, o, rabatt);
    // Rute med mest udekket volum innenfor dekningsradius (blant de som kan nås).
    let best = -1; let bestGevinst = 0;
    for (let k = 0; k < n; k++) {
      if (L.felt[k] < 0 || dekket[k] || uoppnaelig[k]) continue;
      if (!Number.isFinite(kost[k])) { uoppnaelig[k] = 1; continue; }
      const i = k % g.nx; const j = Math.floor(k / g.nx); let s = 0;
      for (let b = -r; b <= r; b += 1) for (let a = -r; a <= r; a += 1) { if (a * a + b * b > r * r) continue; const x = i + a; const y = j + b; if (x >= 0 && y >= 0 && x < g.nx && y < g.ny) { const q = y * g.nx + x; if (!dekket[q]) s += L.vol[q]; } }
      const gevinst = s / (1 + kost[k] / 2000); // litt foretrekk for det som ligger nær nettet
      if (gevinst > bestGevinst) { bestGevinst = gevinst; best = k; }
    }
    if (best < 0) break;
    const gren = []; for (let k = best; k >= 0 && !nett.has(k); k = forrige[k]) gren.push(k);
    if (gren.length < 2 && nett.size) { dekk(best); continue; }
    // Grenen avsluttes der den møter nettet eller bilveien.
    const slutt = forrige[gren.at(-1)]; if (slutt >= 0) gren.push(slutt);
    grener.push(gren); for (const k of gren) { nett.add(k); if (!L.vei[k]) dekk(k); }
    kilder = [...new Set([...vei, ...nett])];
    restVol = 0; for (let k = 0; k < n; k++) if (L.felt[k] >= 0 && !dekket[k] && !uoppnaelig[k]) restVol += L.vol[k];
  }
  let uVol = 0; for (let k = 0; k < n; k++) if (uoppnaelig[k]) uVol += L.vol[k];
  if (uVol > totalVol * 0.02) advarsler.push(`Ca. ${Math.round((uVol / totalVol) * 100)} % av tømmeret ligger der sporet ikke kan gå (bratt, vått eller sperret). Vurder vinsj, taubane eller drift på tele.`);
  if (!grener.length) return { feil: 'Fant ingen farbar trasé fra bilveien til hogstflatene innenfor grensene for helning, våt mark og hindre.' };
  return { grener, nett, ...statistikk(g, L, grener, o, totalVol), advarsler };
}

function statistikk(g, L, grener, o, totalVol) {
  const n = g.nx * g.ny; const nett = new Set(grener.flat());
  const lengde = (gren, filter = () => true) => { let s = 0; for (let i = 1; i < gren.length; i++) { if (!filter(gren[i - 1], gren[i])) continue; const a = senter(g, gren[i - 1]); const b = senter(g, gren[i]); s += Math.hypot(b[0] - a[0], b[1] - a[1]); } return s; };
  const ikkeVei = (a, b) => !(L.vei[a] && L.vei[b]);
  const total = grener.reduce((s, gr) => s + lengde(gr, ikkeVei), 0);
  const paaSpor = grener.reduce((s, gr) => s + lengde(gr, (a, b) => ikkeVei(a, b) && L.spor[b]), 0);
  const vaat = grener.reduce((s, gr) => s + lengde(gr, (a, b) => ikkeVei(a, b) && ['d0', 'd25'].includes(L.fukt[b])), 0);
  const hensyn = grener.reduce((s, gr) => s + lengde(gr, (a, b) => ikkeVei(a, b) && L.hensyn[b]), 0);
  const utenfor = grener.reduce((s, gr) => s + lengde(gr, (a, b) => ikkeVei(a, b) && L.felt[b] < 0 && !L.spor[b]), 0);
  let maksStigning = 0; let bratt = 0; let maksSide = 0;
  if (L.hoyde) for (const gr of grener) for (let i = 1; i < gr.length; i++) { const a = gr[i - 1]; const b = gr[i]; if (!ikkeVei(a, b)) continue; const pa = senter(g, a); const pb = senter(g, b); const d = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]); const s = (Math.abs(L.hoyde[b] - L.hoyde[a]) / d) * 100; if (Number.isFinite(s)) maksStigning = Math.max(maksStigning, s); const sd = sidehelling(L, g, b, a); if (sd != null) { maksSide = Math.max(maksSide, sd); if (sd > o.sideStart) bratt += d; } }
  // Volum innen kranrekkevidde og innen stikkveglengde, og gjennomsnittlig kjøreavstand til velteplass.
  // Avstand langs nettet til bilveien (BFS i nettgrafen fra veiceller).
  const nabo = new Map(); const kobl = (a, b) => { if (!nabo.has(a)) nabo.set(a, []); nabo.get(a).push(b); };
  for (const gr of grener) for (let i = 1; i < gr.length; i++) { kobl(gr[i - 1], gr[i]); kobl(gr[i], gr[i - 1]); }
  const langs = new Map(); const ko = []; for (const k of nett) if (L.vei[k]) { langs.set(k, 0); ko.push(k); }
  while (ko.length) { ko.sort((a, b) => langs.get(a) - langs.get(b)); const v = ko.shift(); for (const u of nabo.get(v) || []) { const pa = senter(g, u); const pb = senter(g, v); const d = langs.get(v) + Math.hypot(pa[0] - pb[0], pa[1] - pb[1]); if (!langs.has(u) || d < langs.get(u)) { langs.set(u, d); ko.push(u); } } }
  let kran = 0; let dekketVol = 0; let transport = 0; let tVol = 0;
  for (let k = 0; k < n; k++) {
    if (L.felt[k] < 0 || !L.vol[k]) continue; const p = senter(g, k); let m = Infinity; let naer = -1;
    for (const q of nett) { const c = senter(g, q); const d = Math.hypot(p[0] - c[0], p[1] - c[1]); if (d < m) { m = d; naer = q; } }
    if (m <= o.kran + g.d / 2) kran += L.vol[k]; if (m <= o.dekning + g.d / 2) dekketVol += L.vol[k];
    if (naer >= 0 && langs.has(naer)) { transport += L.vol[k] * (m + langs.get(naer)); tVol += L.vol[k]; }
  }
  const velteplasser = [...new Set(grener.map((gr) => gr.at(-1)).filter((k) => L.vei[k]))];
  return {
    velteplasser,
    stat: {
      lengde: Math.round(total), nyttSpor: Math.round(total - paaSpor), paaSpor: Math.round(paaSpor), vaat: Math.round(vaat), hensyn: Math.round(hensyn), utenfor: Math.round(utenfor), bratt: Math.round(bratt),
      maksStigning: Math.round(maksStigning), maksSide: Math.round(maksSide), sporAreal: Math.round((total - paaSpor) * o.bredde),
      volum: Math.round(totalVol), kranAndel: totalVol ? Math.round((kran / totalVol) * 100) : 0, dekketAndel: totalVol ? Math.round((dekketVol / totalVol) * 100) : 0,
      transport: tVol ? Math.round(transport / tVol) : null, grener: grener.length, celle: g.d,
      mPerM3: totalVol ? Math.round(((total - paaSpor) / totalVol) * 100) / 100 : null,
    },
  };
}

// Grener → MultiLineString (UTM), forenklet (Douglas–Peucker) og glattet litt.
export function tilLinjer(g, grener, toleranse = null) {
  const tol = toleranse ?? g.d * 0.6;
  const dp = (pts) => { if (pts.length < 3) return pts; let m = 0; let idx = 0; for (let i = 1; i < pts.length - 1; i++) { const d = avstandPunktSegment(pts[i], pts[0], pts.at(-1)); if (d > m) { m = d; idx = i; } } return m > tol ? [...dp(pts.slice(0, idx + 1)).slice(0, -1), ...dp(pts.slice(idx))] : [pts[0], pts.at(-1)]; };
  const glatt = (pts) => (pts.length < 3 ? pts : [pts[0], ...pts.slice(1, -1).map((p, i) => [(pts[i][0] + 2 * p[0] + pts[i + 2][0]) / 4, (pts[i][1] + 2 * p[1] + pts[i + 2][1]) / 4]), pts.at(-1)]);
  return { type: 'MultiLineString', coordinates: grener.map((gr) => glatt(dp(gr.map((k) => senter(g, k)))).map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10])) };
}

// Rett linje fra tyngdepunktet i hogstflatene til nærmeste bilvei – til sammenligning.
export function rettLinje(g, L) {
  let sx = 0; let sy = 0; let sv = 0; const n = g.nx * g.ny;
  for (let k = 0; k < n; k++) if (L.vol[k]) { const [x, y] = senter(g, k); sx += x * L.vol[k]; sy += y * L.vol[k]; sv += L.vol[k]; }
  if (!sv) return null; const p = [sx / sv, sy / sv]; let best = null;
  for (let k = 0; k < n; k++) if (L.vei[k]) { const c = senter(g, k); const d = Math.hypot(c[0] - p[0], c[1] - p[1]); if (!best || d < best.d) best = { d, c }; }
  if (!best) return null;
  let vaat = 0; let sperret = 0; let bratt = 0; const steg = Math.ceil(best.d / (g.d / 2));
  for (let s = 0; s < steg; s++) { const x = p[0] + ((best.c[0] - p[0]) * s) / steg; const y = p[1] + ((best.c[1] - p[1]) * s) / steg; const k = Math.round((y - g.y0) / g.d) * g.nx + Math.round((x - g.x0) / g.d); const l = best.d / steg; if (['d0', 'd25', 'vann'].includes(L.fukt[k])) vaat += l; if (L.sperret[k]) sperret += l; if (L.hoyde) { const i = k % g.nx; const j = Math.floor(k / g.nx); const z = L.hoyde; const ok = i > 0 && j > 0 && i < g.nx - 1 && j < g.ny - 1; if (ok) { const pst = Math.hypot((z[k + 1] - z[k - 1]) / (2 * g.d), (z[k + g.nx] - z[k - g.nx]) / (2 * g.d)) * 100; if (pst > 33) bratt += l; } } }
  return { lengde: Math.round(best.d), vaat: Math.round(vaat), sperret: Math.round(sperret), bratt: Math.round(bratt) };
}

// Kort vurdering og råd til utfører.
export function rad(stat, { grunnlag = {}, dekning = STANDARD.dekning } = {}) {
  const r = [];
  r.push(`Kjør på basvegen, og legg stikkveger høyst ${dekning} m ut fra den med ca. 20 m mellomrom. Hogstmaskinen legger hogstavfall (ris) i sporet foran seg – særlig der marka er bløt.`);
  if (stat.vaat) r.push(`${stat.vaat} m av sporet går over fuktig mark der det ikke var et bedre alternativ. Kjør der på tele eller snø, eller legg ekstra tykk rismatte, og unngå kjøring etter mye nedbør.`);
  if (stat.bratt) r.push(`${stat.bratt} m har sidehelling over ${STANDARD.sideStart} %. Kjør forsiktig der, og unngå å grave ut eller planere.`);
  if (stat.maksStigning > 25) r.push(`Den bratteste stigningen er ca. ${stat.maksStigning} %. Kjør lastet nedover, og bruk kjetting eller beltebånd.`);
  if (stat.hensyn) r.push(`${stat.hensyn} m går gjennom registrerte naturtyper eller artsområder. Avklar med utfører, og kjør skånsomt.`);
  if (stat.utenfor) r.push(`${stat.utenfor} m går gjennom skog utenfor hogstflatene for å nå bilveien. Hogg ikke bredere enn sporet krever, og hold avstand til ungskog.`);
  if (!grunnlag.hoyde) r.push('Høydedata manglet, så helning er ikke tatt med. Kontroller traseen i terrenget.');
  if (!grunnlag.fukt) r.push('Markfuktighetskartet manglet, så våt mark er ikke tatt med. Kontroller traseen i terrenget.');
  if (!grunnlag.kulturminner) r.push('Kulturminner kunne ikke hentes. Sjekk kulturminnesok.no før drift.');
  r.push('Bygging av permanent traktorveg (klasse 7 eller 8) med graving eller planering krever godkjenning fra kommunen. Kjørespor uten terrenginngrep krever ikke det.');
  return r;
}

// GPX for maskinfører og GPS.
export function gpx(navn, geomGeo, velteplasser = []) {
  const e = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="SkogIQ.ai" xmlns="http://www.topografix.com/GPX/1/1">\n${velteplasser.map(([lon, lat], i) => `<wpt lat="${lat}" lon="${lon}"><name>Velteplass ${i + 1}</name></wpt>`).join('\n')}\n<trk><name>${e(navn)}</name>\n${linjerAv(geomGeo).map((l) => `<trkseg>${l.map(([lon, lat]) => `<trkpt lat="${lat}" lon="${lon}"/>`).join('')}</trkseg>`).join('\n')}\n</trk>\n</gpx>\n`;
}

// Fra ferdig grunnlag til lagret forslag (lon/lat) på oppdraget. g fra lagRutenett; grunnlag.z er høyder per rute.
export function lagForslag(g, grunnlag, valg = {}) {
  const o = { ...STANDARD, ...valg };
  const L = byggLag(g, { ...grunnlag, z: grunnlag.z || null, fukt: grunnlag.fukt || null });
  const r = optimaliser(g, L, o);
  if (r.feil) return { feil: r.feil };
  const linjer = tilLinjer(g, r.grener);
  const advarsler = [...r.advarsler];
  if (g.vei && g.vei.avstand > 1500) advarsler.push(`Nærmeste bilvei er ca. ${Math.round(g.vei.avstand)} m unna. Forslaget når ikke helt fram.`);
  return {
    status: 'forslag', laget: new Date().toISOString().slice(0, 10), valg: { dekning: o.dekning },
    geometri: tilGeo(linjer), velteplasser: r.velteplasser.map((k) => { const [x, y] = senter(g, k); return utmTilGeo(x, y, 33).map((v) => Math.round(v * 1e6) / 1e6); }),
    stat: r.stat, rett: rettLinje(g, L), advarsler, rad: rad(r.stat, { dekning: o.dekning, grunnlag: { hoyde: !!grunnlag.z, fukt: !!grunnlag.fukt, kulturminner: grunnlag.kulturminner !== false } }),
    hindre: (grunnlag.sperretGeo || []).slice(0, 200),
  };
}
export { punktIGeometri };
