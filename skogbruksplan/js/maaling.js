// Måleverktøy i kartet: lengde (linje), areal og omkrets (flate) – og stående volum innenfor flaten, per bestand og
// per treslag, fra bestandene i planen. Volumet i hvert bestand fordeles på treslag etter bestandets treslagsandeler
// (fra planen eller SR16) når de finnes, ellers etter hovedtreslaget. Ingen DOM – kan testes i Node.
// polygon-clipping sendes inn som PC.
import { geoTilUtm } from './proj.js';
import { startTilstand, TRESLAG } from './model.js';

const tilUtm = ([lon, lat]) => geoTilUtm(lon, lat, 33);
const ringAreal = (r) => { let a = 0; for (let i = 1; i < r.length; i++) a += r[i - 1][0] * r[i][1] - r[i][0] * r[i - 1][1]; return Math.abs(a) / 2; };
const mpAreal = (mp) => mp.reduce((s, p) => s + Math.max(0, ringAreal(p[0]) - p.slice(1).reduce((t, h) => t + ringAreal(h), 0)), 0);
const lukket = (pts) => (pts.length && (pts[0][0] !== pts.at(-1)[0] || pts[0][1] !== pts.at(-1)[1]) ? [...pts, pts[0]] : pts);
const mpUtm = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).map((p) => p.map((r) => r.map(tilUtm)));

// Lengde langs punktene (lon/lat) i meter, og hvert stykke.
export function lengde(pts) {
  const u = pts.map(tilUtm); const deler = [];
  for (let i = 1; i < u.length; i++) deler.push(Math.hypot(u[i][0] - u[i - 1][0], u[i][1] - u[i - 1][1]));
  return { total: deler.reduce((s, d) => s + d, 0), deler };
}
// Areal (m²) og omkrets (m) for en flate gitt som punkter (lon/lat), lukkes automatisk.
export function flate(pts) {
  if (pts.length < 3) return { areal: 0, omkrets: lengde(pts).total };
  const ring = lukket(pts); const u = ring.map(tilUtm);
  return { areal: ringAreal(u), omkrets: lengde(ring).total };
}
// Treslagsfordelingen i et bestand: { andel: {G,F,L}, kilde: 'andel' | 'hovedtreslag' | null }.
export function fordeling(b) {
  if (b.treslagAndel) return { andel: b.treslagAndel, kilde: 'andel' };
  if (b.treslag) return { andel: { [b.treslag]: 1 }, kilde: 'hovedtreslag' };
  return { andel: { G: 1 }, kilde: null };
}
// Stående volum (m³) i dag per daa for et bestand.
export const volumDaa = (b) => b.volumDaa ?? startTilstand(b).volumDaa ?? 0;

// Volum innenfor flaten (lon/lat-punkter): per bestand (overlapp), per treslag og totalt.
export function volum(S, pts, PC) {
  const ring = lukket(pts).map(tilUtm); if (ring.length < 4) return null;
  const maal = [[ring]]; const arealMaal = ringAreal(ring);
  const xs = ring.map((p) => p[0]); const ys = ring.map((p) => p[1]); const bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const rader = []; const perTreslag = { G: 0, F: 0, L: 0 }; let dekket = 0; const kilder = new Set();
  for (const b of S.bestand || []) {
    if (!b.geometri || !/Polygon/.test(b.geometri.type)) continue;
    const mp = mpUtm(b.geometri);
    const bx = mp.flatMap((p) => p[0]); // rask utsiling: boksene må overlappe
    if (Math.min(...bx.map((q) => q[0])) > bb[2] || Math.max(...bx.map((q) => q[0])) < bb[0] || Math.min(...bx.map((q) => q[1])) > bb[3] || Math.max(...bx.map((q) => q[1])) < bb[1]) continue;
    let snitt; try { snitt = PC.intersection(mp, maal); } catch { continue; }
    const a = mpAreal(snitt); if (a < 1) continue;
    dekket += a;
    const vd = volumDaa(b); const m3 = (vd * a) / 1000; const f = fordeling(b); if (f.kilde) kilder.add(f.kilde);
    const per = {}; for (const [t, x] of Object.entries(f.andel)) { per[t] = m3 * x; perTreslag[t] = (perTreslag[t] || 0) + m3 * x; }
    rader.push({ id: b.id, nr: b.nr, areal: a, andelAvBestand: (b.areal ? a / (b.areal * 1000) : null), m3Daa: vd, m3, perTreslag: per, treslag: b.treslag, kilde: f.kilde, miljo: !!b.miljo, hogstklasse: b.hogstklasse ?? null });
  }
  rader.sort((x, y) => y.m3 - x.m3);
  const m3 = rader.reduce((s, r) => s + r.m3, 0);
  return {
    areal: arealMaal, dekket: Math.min(dekket, arealMaal), utenfor: Math.max(0, arealMaal - dekket), m3, m3Daa: dekket ? (m3 * 1000) / dekket : 0,
    perTreslag, rader, fordelingKilde: kilder.has('hovedtreslag') ? (kilder.has('andel') ? 'blandet' : 'hovedtreslag') : kilder.has('andel') ? 'andel' : null,
    miljo: rader.filter((r) => r.miljo).reduce((s, r) => s + r.m3, 0),
  };
}

// ---------- formatering ----------
const nb = (v, d = 0) => Number(v).toLocaleString('nb-NO', { minimumFractionDigits: d, maximumFractionDigits: d });
export function lengdeTekst(m) { return m >= 1000 ? `${nb(m / 1000, m >= 10000 ? 1 : 2)} km` : `${nb(m, m < 10 ? 1 : 0)} m`; }
export function arealTekst(m2) { return m2 >= 100000 ? `${nb(m2 / 10000, 1)} ha` : m2 >= 1000 ? `${nb(m2 / 1000, 1)} daa` : `${nb(m2)} m²`; }
// Kort tekst for utklippstavlen.
export function sammendrag({ modus, len, fl, vol }) {
  if (modus === 'lengde') return `Lengde: ${lengdeTekst(len.total)}${len.deler.length > 1 ? ` (${len.deler.length} strekk)` : ''}`;
  const l = [`Areal: ${nb(fl.areal / 1000, 2)} daa (${nb(fl.areal)} m², ${nb(fl.areal / 10000, 2)} ha)`, `Omkrets: ${lengdeTekst(fl.omkrets)}`];
  if (vol) {
    l.push(`Volum: ca. ${nb(vol.m3)} m³ (${nb(vol.m3Daa, 1)} m³/daa på ${nb(vol.dekket / 1000, 1)} daa skog)`);
    for (const t of ['G', 'F', 'L']) if (vol.perTreslag[t] >= 0.5) l.push(`  ${TRESLAG[t]}: ${nb(vol.perTreslag[t])} m³ (${nb((vol.perTreslag[t] / (vol.m3 || 1)) * 100)} %)`);
    if (vol.rader.length) l.push(`Bestand: ${vol.rader.map((r) => `${r.nr} (${nb(r.areal / 1000, 1)} daa, ${nb(r.m3)} m³)`).join(', ')}`);
  }
  return l.join('\n');
}
