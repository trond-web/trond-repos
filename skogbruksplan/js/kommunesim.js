// Skadesimulering for en hel kommune: de samme modellene som for eiendommen (skadesim.js), men regnet på alle
// SR16-skogflatene fra kommuneanalysen (titusenvis av flater). Forskjeller fra eiendomsversjonen:
//   * Åpne kanter mot vinden finnes med en romlig indeks (punkt oppvinds fra flaten), ikke ved å sammenligne alle par.
//   * Været kan variere over kommunen: værprognosen hentes i et rutenett (ca. 6–15 km) og interpoleres (IDW).
//   * Skogbrann regnes på et rutenett (ca. 50 m) rundt startpunktet, med drivstoff fra SR16 og arealtype fra AR5:
//     myr brenner dårlig, vann, bebyggelse og vei stopper brannen. Bebyggelse som brannen når fram til, rapporteres.
//   * SR16 er målt i ulike år; alder, høyde og volum skrives fram til i år (enkelt anslag).
// Ingen DOM – kan testes i Node.
import * as SIM from './skadesim.js';
import { punktIGeometri, lagBoksIndeks, boksFor } from './proj.js';
import { rotnettoPerM3, STANDARD_INNSTILLINGER } from './model.js';
import { hentVaer } from './skade-data.js';

const { logistisk, klamp } = SIM;
const r1 = (x) => Math.round(x * 10) / 10;
const mPerGrad = (lat) => [111320 * Math.cos((lat * Math.PI) / 180), 110540];

// ---------------------------------------------------------------- flater
export function flateInfo(f, iAar = new Date().getFullYear()) {
  const dt = f.maaleaar ? Math.max(0, iAar - f.maaleaar) : 0;
  const alder = (f.alder ?? 40) + dt;
  const h = f.hoyde != null ? f.hoyde + dt * 0.25 : f.overhoyde != null ? f.overhoyde * 0.9 + dt * 0.25 : Math.min(25, alder * 0.3);
  const vol = (f.volumDaa ?? 0) * 1.025 ** dt;
  return { b: { id: f.id, nr: f.id, treslag: f.treslag || 'G', bonitet: f.bonitet || 11, merknad: '', tiltak: [] }, st: { alder, h40: f.bonitet || 11, volumDaa: vol }, h, anslag: dt > 0, daa: f.areal || 0, volum: (f.areal || 0) * vol, c: f.senter, tynnet: null, tetthet: f.treantall ?? null, iAar, f };
}
export function lagIndeks(flater) { return lagBoksIndeks(flater, (f) => boksFor(f.geometri)); }

// Åpen kant mot vinden: punktet like oppvinds for flaten ligger ikke i en skogflate med trær over 5 m.
export function kantMotVind(x, retning, idx) {
  if (!x.c || !idx) return false;
  const k = mPerGrad(x.c[1]); const d = Math.sqrt(Math.max(1, x.daa * 1000)) / 2 + 40; const v = (retning * Math.PI) / 180;
  const p = [x.c[0] + (Math.sin(v) * d) / k[0], x.c[1] + (Math.cos(v) * d) / k[1]];
  const n = idx.finnPunkt(p); if (!n) return true; if (n === x.f) return false;
  return (n.hoyde ?? 10) < 5;
}

// ---------------------------------------------------------------- værfelt
// Hovedvariabelen skaleres lokalt (verdi i punktet / høyeste verdi), retning hentes lokalt, temperatur forskyves.
const SKALER = { storm: ['kast'], sno: ['nysno', 'vind'], brann: ['vind'], torke: ['dager'] };
const RETNING = { storm: 'retning', brann: 'retning' };
const FORSKYV = { sno: ['temp'], torke: ['tempMaks'] };
export function lokalParam(type, p, felt, c) {
  if (!felt?.punkter?.length || !c) return p;
  const k = mPerGrad(c[1]); let sw = 0; const acc = {}; let vx = 0; let vy = 0;
  for (const pt of felt.punkter) {
    const d = Math.max(500, Math.hypot((pt.pos[0] - c[0]) * k[0], (pt.pos[1] - c[1]) * k[1])); const w = 1 / (d * d); sw += w;
    for (const id of [...(SKALER[type] || []), ...(FORSKYV[type] || [])]) acc[id] = (acc[id] || 0) + w * (pt.param[id] ?? 0);
    if (RETNING[type] && pt.param[RETNING[type]] != null) { const a = (pt.param[RETNING[type]] * Math.PI) / 180; vx += w * Math.sin(a); vy += w * Math.cos(a); }
  }
  const ut = { ...p };
  for (const id of SKALER[type] || []) { const maks = felt.maks[id]; if (maks > 0) ut[id] = p[id] * (acc[id] / sw) / maks; }
  for (const id of FORSKYV[type] || []) ut[id] = p[id] + (acc[id] / sw - felt.snitt[id]);
  if (RETNING[type] && (vx || vy)) ut[RETNING[type]] = ((Math.atan2(vx, vy) * 180) / Math.PI + 360) % 360;
  return ut;
}
export function lagFelt(type, punkter) {
  const p = punkter.map((x) => ({ pos: x.pos, param: SIM.fraPrognose(type, x.vaer) })).filter((x) => Object.keys(x.param).length);
  const ider = [...(SKALER[type] || []), ...(FORSKYV[type] || [])];
  const maks = Object.fromEntries(ider.map((id) => [id, Math.max(...p.map((x) => x.param[id] ?? -Infinity))]));
  const snitt = Object.fromEntries(ider.map((id) => [id, p.reduce((s, x) => s + (x.param[id] ?? 0), 0) / (p.length || 1)]));
  return { type, punkter: p, maks, snitt, scenario: { ...Object.fromEntries((SKALER[type] || []).map((id) => [id, Math.round(maks[id])])), ...Object.fromEntries((FORSKYV[type] || []).map((id) => [id, Math.round(snitt[id])])) } };
}
// Punkter for værprognosen: rutenett innenfor kommunegrensa, høyst ca. maks punkter.
export function vaerPunkter(grense, maks = 24) {
  const bb = boksFor(grense); const k = mPerGrad((bb[1] + bb[3]) / 2);
  const bredde = (bb[2] - bb[0]) * k[0]; const hoyde = (bb[3] - bb[1]) * k[1];
  let s = Math.max(6000, Math.sqrt((bredde * hoyde) / maks));
  let ut = [];
  for (let n = 0; n < 6; n++) {
    ut = [];
    for (let y = bb[1] + (s / 2) / k[1]; y < bb[3]; y += s / k[1]) for (let x = bb[0] + (s / 2) / k[0]; x < bb[2]; x += s / k[0]) if (punktIGeometri([x, y], grense)) ut.push([x, y]);
    if (ut.length <= maks) break; s *= 1.2;
  }
  if (!ut.length) ut.push([(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2]);
  return ut;
}
export async function hentVaerFelt(grense, { hent = fetch, framdrift = () => {}, parallelle = 4 } = {}) {
  const pkt = vaerPunkter(grense); const ut = []; let i = 0; let ferdig = 0;
  await Promise.all(Array.from({ length: parallelle }, async () => {
    while (i < pkt.length) { const p = pkt[i++]; try { ut.push({ pos: p, vaer: await hentVaer(p[0], p[1], { hent }) }); } catch { /* hopp over punktet */ } framdrift(++ferdig / pkt.length); }
  }));
  if (!ut.length) throw new Error('Fikk ikke værprognose for kommunen.');
  return { punkter: ut, hentet: new Date().toISOString() };
}

// ---------------------------------------------------------------- storm, snø, bille, tørke for alle flater
const statiskBille = (x) => (x.b.treslag !== 'G' ? 0 : x.st.alder >= 60 || x.h >= 16 ? 0.45 : x.st.alder >= 40 ? 0.3 : 0.1);
// Forhåndsberegning per flate (kritisk vind/last), slik at kurven over hovedvariabelen går raskt.
export function forbered(d, type, param, { iAar, felt = null, idx = null } = {}) {
  const p = { ...SIM.standard(type), ...param };
  const info = d.flater.map((f) => flateInfo(f, iAar));
  const lok = info.map((x) => lokalParam(type, p, felt, x.c));
  let krit = null;
  if (type === 'storm') krit = info.map((x, i) => (x.h < 4 ? Infinity : SIM.kritiskVind(x, { mark: p.mark, lauv: p.lauv, kantMotVind: kantMotVind(x, lok[i].retning, idx) }).u));
  if (type === 'sno') krit = info.map((x) => SIM.kritiskSnolast(x).l);
  return { type, p, info, lok, krit, felt };
}
function vurder(fb, i, overstyr = null) {
  const { type, info, lok, krit } = fb; const x = info[i]; let q = lok[i];
  if (overstyr) { const [id, v] = overstyr; q = { ...q, [id]: (q[id] * v) / (fb.p[id] || 1) }; }
  if (type === 'storm') { const s = x.h < 4 ? 0 : logistisk((q.kast - krit[i]) / 1.8); return s * (0.15 + 0.5 * s); }
  if (type === 'sno') { const s = logistisk((SIM.snolast(x, q) - krit[i]) / 4); return s * (0.08 + 0.35 * s); }
  if (type === 'bille') { if (x.b.treslag !== 'G') return 0; return SIM.billeSann(statiskBille(x), SIM.billeVaer(q)) * 0.3; }
  if (type === 'torke') return SIM.torkeVurdering(x, q).andel;
  return 0;
}
export function simulerKommune(d, type, param = {}, { iAar = new Date().getFullYear(), felt = null, idx = null, inn = STANDARD_INNSTILLINGER, forberedt = null } = {}) {
  const fb = forberedt || forbered(d, type, param, { iAar, felt, idx });
  const def = SIM.TYPER[type]; const kost = fb.p.kostnad ?? 2500;
  const andel = new Float32Array(fb.info.length); const m3 = new Float32Array(fb.info.length); const kr = new Float32Array(fb.info.length);
  const pris = { G: rotnettoPerM3('G', inn), F: rotnettoPerM3('F', inn), L: rotnettoPerM3('L', inn) };
  fb.info.forEach((x, i) => {
    const a = vurder(fb, i); andel[i] = a;
    m3[i] = type === 'torke' ? 0 : x.volum * a;
    kr[i] = type === 'torke' ? x.daa * a * kost : m3[i] * (pris[x.b.treslag] ?? pris.G) * def.tapFaktor;
  });
  return oppsummerKommune(d, fb, andel, m3, kr);
}
function oppsummerKommune(d, fb, andel, m3, kr) {
  const n = fb.info.length; let sum = { flater: 0, daa: 0, skadetDaa: 0, m3: 0, kr: 0 }; const perTreslag = {};
  const omr = new Map(); const ruteM = 2000;
  for (let i = 0; i < n; i++) {
    const x = fb.info[i]; const a = andel[i]; if (a < 0.02) continue;
    sum.flater++; sum.daa += x.daa; sum.skadetDaa += x.daa * a; sum.m3 += m3[i]; sum.kr += kr[i];
    const t = (perTreslag[x.b.treslag] ??= { daa: 0, skadetDaa: 0, m3: 0, kr: 0 }); t.daa += x.daa; t.skadetDaa += x.daa * a; t.m3 += m3[i]; t.kr += kr[i];
    if (x.c) { const k = mPerGrad(x.c[1]); const key = `${Math.floor((x.c[0] * k[0]) / ruteM)}:${Math.floor((x.c[1] * k[1]) / ruteM)}`; const o = omr.get(key) || { kr: 0, m3: 0, skadetDaa: 0, flater: 0, sx: 0, sy: 0, w: 0, store: 0 }; o.kr += kr[i]; o.m3 += m3[i]; o.skadetDaa += x.daa * a; o.flater++; o.sx += x.c[0] * x.daa; o.sy += x.c[1] * x.daa; o.w += x.daa; if (a >= 0.25) o.store += x.daa; omr.set(key, o); }
  }
  const omrader = [...omr.values()].map((o) => ({ ...o, senter: [o.sx / o.w, o.sy / o.w] })).sort((a, b) => b.kr - a.kr).slice(0, 15);
  const fiks = (o) => { for (const k of Object.keys(o)) o[k] = k === 'flater' ? o[k] : k === 'kr' || k === 'm3' ? Math.round(o[k]) : r1(o[k]); return o; };
  fiks(sum); for (const t of Object.values(perTreslag)) fiks(t); for (const o of omrader) { o.kr = Math.round(o.kr); o.m3 = Math.round(o.m3); o.skadetDaa = r1(o.skadetDaa); o.store = r1(o.store); }
  return { type: fb.type, param: fb.p, andel, m3, kr, sum, perTreslag, omrader, fb };
}
// Kurve: totalen når hovedvariabelen endres (bruker forhåndsberegningen).
export function kurveKommune(res, { inn = STANDARD_INNSTILLINGER } = {}) {
  const fb = res.fb; const s = SIM.TYPER[fb.type].sensitivitet; if (fb.type === 'brann') return [];
  const pris = { G: rotnettoPerM3('G', inn), F: rotnettoPerM3('F', inn), L: rotnettoPerM3('L', inn) }; const def = SIM.TYPER[fb.type]; const ut = [];
  for (let v = s.fra; v <= s.til; v += s.steg) {
    let kr = 0; let daa = 0;
    for (let i = 0; i < fb.info.length; i++) { const x = fb.info[i]; const a = vurder(fb, i, [s.id, v]); if (a < 0.002) continue; daa += x.daa * a; kr += fb.type === 'torke' ? x.daa * a * (fb.p.kostnad ?? 2500) : x.volum * a * (pris[x.b.treslag] ?? pris.G) * def.tapFaktor; }
    ut.push({ x: v, kr: Math.round(kr), daa: r1(daa) });
  }
  return ut;
}

// ---------------------------------------------------------------- skogbrann på rutenett
// Arealtype fra AR5 (farger i NIBIOs WMS «Arealtype»). Klasser: 0 ukjent, 1 skog, 2 jordbruk, 3 myr, 4 åpen fastmark,
// 5 vann, 6 bebygd, 7 samferdsel, 8 snø/is.
export const DEKKE = { 0: 'Ikke kartlagt', 1: 'Skog', 2: 'Jordbruk', 3: 'Myr', 4: 'Åpen fastmark', 5: 'Vann', 6: 'Bebygd', 7: 'Samferdsel', 8: 'Snø og is' };
const AR5_FARGER = [[255, 209, 110, 2], [255, 224, 157, 2], [255, 255, 76, 2], [255, 255, 134, 2], [255, 255, 173, 2], [255, 255, 199, 2], [158, 204, 115, 1], [189, 220, 160, 1], [181, 236, 252, 3], [217, 217, 217, 4], [229, 229, 229, 4], [145, 231, 255, 5], [204, 254, 254, 5], [220, 254, 254, 8], [252, 219, 214, 6], [179, 120, 76, 7]];
export function klassifiserRgb(r, g, b) {
  if (r > 250 && g > 250 && b > 250) return 0;
  let best = 0; let bd = Infinity; for (const [R, G, B, k] of AR5_FARGER) { const dd = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2; if (dd < bd) { bd = dd; best = k; } }
  return bd < 2500 ? best : 0;
}
export const AR5_WMS = 'https://wms.nibio.no/cgi-bin/ar5';
// Rutenett i lengde-/breddegrader (så det kan legges rett på kartet), ca. celleM meter per celle.
export function lagRutenett(senter, radiusM, { celleM = 50, maksCeller = 500 } = {}) {
  const celle = Math.max(celleM, (2 * radiusM) / maksCeller); const k = mPerGrad(senter[1]);
  const dlon = celle / k[0]; const dlat = celle / k[1]; const n = Math.ceil((2 * radiusM) / celle);
  return { lon0: senter[0] - (n / 2) * dlon, lat0: senter[1] - (n / 2) * dlat, dlon, dlat, nx: n, ny: n, celleM: celle };
}
// Rutenett som dekker en hel kommune (for kartvisning), høyst maksCeller celler på den lengste siden.
export function rutenettFor(grense, { celleM = 25, maksCeller = 1600 } = {}) {
  const bb = boksFor(grense); const k = mPerGrad((bb[1] + bb[3]) / 2);
  const bM = (bb[2] - bb[0]) * k[0]; const hM = (bb[3] - bb[1]) * k[1]; const celle = Math.max(celleM, Math.max(bM, hM) / maksCeller);
  const dlon = celle / k[0]; const dlat = celle / k[1];
  return { lon0: bb[0], lat0: bb[1], dlon, dlat, nx: Math.ceil(bM / celle), ny: Math.ceil(hM / celle), celleM: celle };
}
export const celleSenter = (g, i, j) => [g.lon0 + (i + 0.5) * g.dlon, g.lat0 + (j + 0.5) * g.dlat];
// AR5-bildet hentes i biter i Web Mercator (EPSG:3857) med ca. 12 m per piksel – NIBIO tegner ikke laget grovere,
// og ikke i EPSG:4326. Gir [{ url, i0, j0, ni, nj, W, H, mx0, my0, mx1, my1 }].
const merc = (lon, lat) => [(lon * 20037508.34) / 180, Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) * 6378137];
export function ar5Biter(g, { pikselM = 12, maksPx = 2000 } = {}) {
  const [ax] = merc(g.lon0, g.lat0); const [bx] = merc(g.lon0 + g.dlon, g.lat0); const pxPerCelle = Math.max(1, (bx - ax) / pikselM);
  const cellerPerBit = Math.max(1, Math.floor(maksPx / pxPerCelle)); const ut = [];
  for (let j0 = 0; j0 < g.ny; j0 += cellerPerBit) for (let i0 = 0; i0 < g.nx; i0 += cellerPerBit) {
    const ni = Math.min(cellerPerBit, g.nx - i0); const nj = Math.min(cellerPerBit, g.ny - j0);
    const [mx0, my0] = merc(g.lon0 + i0 * g.dlon, g.lat0 + j0 * g.dlat); const [mx1, my1] = merc(g.lon0 + (i0 + ni) * g.dlon, g.lat0 + (j0 + nj) * g.dlat);
    const W = Math.max(1, Math.round((mx1 - mx0) / pikselM)); const H = Math.max(1, Math.round((my1 - my0) / pikselM));
    ut.push({ url: `${AR5_WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=Arealtype&STYLES=&SRS=EPSG:3857&BBOX=${[mx0, my0, mx1, my1].map((v) => v.toFixed(1)).join(',')}&WIDTH=${W}&HEIGHT=${H}&FORMAT=image/png`, i0, j0, ni, nj, W, H, mx0, my0, mx1, my1 });
  }
  return ut;
}
// Fyll inn dekke fra et RGBA-bilde (nord øverst). Hver celle får flertallet av 4 × 4 målepunkter.
export function dekkeFraBilde(g, dekke, bit, rgba) {
  const telling = new Uint16Array(9);
  for (let cj = 0; cj < bit.nj; cj++) for (let ci = 0; ci < bit.ni; ci++) {
    telling.fill(0);
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const [mx, my] = merc(g.lon0 + (bit.i0 + ci + (sx + 0.5) / 4) * g.dlon, g.lat0 + (bit.j0 + cj + (sy + 0.5) / 4) * g.dlat);
      const px = Math.min(bit.W - 1, Math.max(0, Math.floor(((mx - bit.mx0) / (bit.mx1 - bit.mx0)) * bit.W)));
      const py = Math.min(bit.H - 1, Math.max(0, Math.floor(((bit.my1 - my) / (bit.my1 - bit.my0)) * bit.H)));
      const o = (py * bit.W + px) * 4; telling[klassifiserRgb(rgba[o], rgba[o + 1], rgba[o + 2])]++;
    }
    let best = 0; for (let k = 1; k < 9; k++) if (telling[k] > telling[best] || (best === 0 && telling[k] > 0 && telling[k] * 3 >= telling[0])) best = k;
    dekke[(bit.j0 + cj) * g.nx + bit.i0 + ci] = best;
  }
}
// Rasteriser skogflatene til rutenettet (indeks i flatelisten, −1 = ingen flate).
export function rasteriserFlater(g, flater, idx) {
  const ut = new Int32Array(g.nx * g.ny).fill(-1); const pos = new Map(flater.map((f, i) => [f, i]));
  const bb = [g.lon0, g.lat0, g.lon0 + g.nx * g.dlon, g.lat0 + g.ny * g.dlat];
  for (const f of idx ? idx.sok(bb) : flater) {
    const fi = pos.get(f); const polys = f.geometri.type === 'Polygon' ? [f.geometri.coordinates] : f.geometri.type === 'MultiPolygon' ? f.geometri.coordinates : [];
    for (const rings of polys) {
      const fb = boksFor({ type: 'Polygon', coordinates: rings });
      const j0 = Math.max(0, Math.floor((fb[1] - g.lat0) / g.dlat)); const j1 = Math.min(g.ny - 1, Math.floor((fb[3] - g.lat0) / g.dlat));
      for (let j = j0; j <= j1; j++) {
        const y = g.lat0 + (j + 0.5) * g.dlat; const xs = [];
        for (const r of rings) for (let a = 0, b = r.length - 1; a < r.length; b = a++) { const [xa, ya] = r[a]; const [xb, yb] = r[b]; if ((ya > y) !== (yb > y)) xs.push(xa + ((y - ya) * (xb - xa)) / (yb - ya)); }
        xs.sort((p, q) => p - q);
        for (let t = 0; t + 1 < xs.length; t += 2) {
          const i0 = Math.max(0, Math.ceil((xs[t] - g.lon0) / g.dlon - 0.5)); const i1 = Math.min(g.nx - 1, Math.floor((xs[t + 1] - g.lon0) / g.dlon - 0.5));
          for (let i = i0; i <= i1; i++) ut[j * g.nx + i] = fi;
        }
      }
    }
  }
  return ut;
}
const O1 = (ISI) => 190 * (1 - Math.exp(-0.031 * ISI)) ** 1.4; // FBP gress (O1a)
// Spredningshastighet per celle (m/min med vinden) og drivstofftype.
export function drivstoffGrid(g, dekke, flateIdx, flater, p, iAar) {
  const ISI = SIM.isi({ fuktig: 80, normal: 86, torr: 90, svart: 93, ekstrem: 95 }[p.torrhet] ?? 90, p.vind); const n = g.nx * g.ny;
  const hros = new Float32Array(n); const type = new Uint8Array(n); // 0 sperre, 1 C2, 2 C3, 3 C4, 4 D, 5 S1, 6 gress, 7 lyng, 8 myr
  const TYPER = ['–', 'C2', 'C3', 'C4', 'D', 'S1', 'O1', 'lyng', 'myr']; const cacheInfo = new Map();
  for (let c = 0; c < n; c++) {
    const fi = flateIdx[c]; const dk = dekke ? dekke[c] : (fi >= 0 ? 1 : 0); // uten AR5: bare skogflatene brenner
    if (dk === 5 || dk === 6 || dk === 7 || dk === 8) { hros[c] = 0; type[c] = 0; continue; }
    if (fi >= 0 && dk !== 3) {
      let x = cacheInfo.get(fi); if (!x) { x = flateInfo(flater[fi], iAar); cacheInfo.set(fi, x); }
      const t = SIM.drivstoff(x, p.lauv); hros[c] = SIM.ros(t, ISI); type[c] = { C2: 1, C3: 2, C4: 3, D1: 4, D2: 4, S1: 5 }[t]; continue;
    }
    if (dk === 0) { hros[c] = 0; type[c] = 0; continue; } // ikke kartlagt i AR5 (ofte hav eller utenfor fastlandet)
    if (dk === 1) { hros[c] = SIM.ros('C2', ISI) * 0.8; type[c] = 1; continue; } // skog uten SR16-flate
    if (dk === 2) { hros[c] = O1(ISI) * 0.15; type[c] = 6; continue; } // dyrka mark og beite – grønt det meste av sesongen
    if (dk === 4) { hros[c] = O1(ISI) * 0.5; type[c] = 7; continue; } // lyng, berg og fjell
    if (dk === 3) { hros[c] = O1(ISI) * 0.08; type[c] = 8; continue; } // myr
  }
  return { hros, type, typer: TYPER, isi: ISI };
}
// Dijkstra på rutenettet (8 naboer) med elliptisk spredning. Gir ankomsttid i minutter (Infinity = når ikke fram).
export function spredGrid(g, hros, startCelle, { vind, retning, maksMin }) {
  const n = g.nx * g.ny; const tid = new Float32Array(n).fill(Infinity); const lb = SIM.lbForhold(vind); const mot = (retning + 180) % 360;
  const nab = []; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (di || dj) { const d = Math.hypot(di, dj) * g.celleM; const br = ((Math.atan2(di, dj) * 180) / Math.PI + 360) % 360; const th = Math.abs(((br - mot + 540) % 360) - 180); nab.push([di, dj, d, SIM.rosRetning(1, lb, th)]); }
  // binær haug
  const hi = new Int32Array(n); const ht = new Float32Array(n); let hn = 0;
  const push = (c, t) => { let k = hn++; while (k > 0) { const pk = (k - 1) >> 1; if (ht[pk] <= t) break; hi[k] = hi[pk]; ht[k] = ht[pk]; k = pk; } hi[k] = c; ht[k] = t; };
  const pop = () => { const c = hi[0]; const t = ht[0]; const lc = hi[--hn]; const lt = ht[hn]; let k = 0; while (true) { let m = 2 * k + 1; if (m >= hn) break; if (m + 1 < hn && ht[m + 1] < ht[m]) m++; if (ht[m] >= lt) break; hi[k] = hi[m]; ht[k] = ht[m]; k = m; } hi[k] = lc; ht[k] = lt; return [c, t]; };
  if (hros[startCelle] <= 0) return tid;
  tid[startCelle] = 0; push(startCelle, 0);
  while (hn) {
    const [c, t] = pop(); if (t > tid[c] || t > maksMin) continue;
    const i = c % g.nx; const j = (c - i) / g.nx; const ra = hros[c];
    for (const [di, dj, d, f] of nab) {
      const ii = i + di; const jj = j + dj; if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.ny) continue; const cc = jj * g.nx + ii; const rb = hros[cc]; if (rb <= 0) continue;
      const ny = t + d / 2 / Math.max(0.01, ra * f) + d / 2 / Math.max(0.01, rb * f);
      if (ny < tid[cc]) { tid[cc] = ny; push(cc, ny); }
    }
  }
  return tid;
}
// Hele brannsimuleringen. dekke: Uint8Array (AR5-klasser) eller null (alt regnes som skog/ukjent).
export function brannKommune(d, param = {}, { start, iAar = new Date().getFullYear(), idx = null, dekke = null, grid = null, inn = STANDARD_INNSTILLINGER, felt = null } = {}) {
  if (dekke && !dekke.some((v) => v !== 0)) dekke = null; // tomt AR5-bilde – regn bare med skogdataene
  const p0 = { ...SIM.standard('brann'), ...param }; const p = lokalParam('brann', p0, felt, start);
  const ISI = SIM.isi({ fuktig: 80, normal: 86, torr: 90, svart: 93, ekstrem: 95 }[p.torrhet] ?? 90, p.vind);
  const g = grid || lagRutenett(start, brannRadius(p, ISI));
  const flateIdx = rasteriserFlater(g, d.flater, idx);
  const ds = drivstoffGrid(g, dekke, flateIdx, d.flater, p, iAar);
  const si = Math.floor((start[0] - g.lon0) / g.dlon); const sj = Math.floor((start[1] - g.lat0) / g.dlat); const sc = sj * g.nx + si;
  if (ds.hros[sc] <= 0) return { feil: `Startpunktet er ${DEKKE[dekke?.[sc]]?.toLowerCase() || 'ikke brennbart'} – velg et punkt i skog eller utmark.`, grid: g, dekke, ds };
  const T = p.timer * 60; const tid = spredGrid(g, ds.hros, sc, { vind: p.vind, retning: p.retning, maksMin: T * 1.5 });
  // Per flate: andel brent og døde trær
  const celler = new Map(); const brent = new Map();
  for (let c = 0; c < tid.length; c++) { const fi = flateIdx[c]; if (fi < 0) continue; celler.set(fi, (celler.get(fi) || 0) + 1); if (tid[c] <= T) brent.set(fi, (brent.get(fi) || 0) + 1); }
  const pris = { G: rotnettoPerM3('G', inn), F: rotnettoPerM3('F', inn), L: rotnettoPerM3('L', inn) };
  const flater = []; let m3 = 0; let kr = 0; let skogDaa = 0;
  for (const [fi, nb] of brent) {
    const f = d.flater[fi]; const x = flateInfo(f, iAar); const andelBrent = nb / celler.get(fi);
    const t = SIM.drivstoff(x, p.lauv); const hr = SIM.ros(t, ISI); const krone = ['C2', 'C3', 'C4'].includes(t) && hr > 10;
    const dor = t === 'S1' ? 1 : krone ? 0.9 : t === 'C3' ? 0.35 : t.startsWith('D') ? 0.5 : 0.6;
    const a = andelBrent * dor; const v = x.volum * a; const k = v * (pris[x.b.treslag] ?? pris.G) * SIM.TYPER.brann.tapFaktor;
    m3 += v; kr += k; skogDaa += x.daa * andelBrent;
    flater.push({ id: f.id, i: fi, andelBrent: r1(andelBrent * 100) / 100, andel: Math.round(a * 1000) / 1000, m3: Math.round(v), kr: Math.round(k), daa: r1(x.daa), treslag: x.b.treslag, senter: f.senter, krone });
  }
  flater.sort((a, b) => b.kr - a.kr);
  const celleDaa = (g.celleM * g.celleM) / 1000;
  const totalt = (min) => { let n = 0; for (let c = 0; c < tid.length; c++) if (tid[c] <= min) n++; return r1(n * celleDaa); };
  const kurve = [0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24, 36, 48].filter((h) => h <= p.timer * 1.5 + 0.01).map((h) => ({ h, daa: totalt(h * 60) }));
  // Bebyggelse og vei som brannen når fram til (celler inntil brent område)
  const truet = []; const sett = new Uint8Array(tid.length);
  if (dekke) for (let c = 0; c < tid.length; c++) {
    if (dekke[c] !== 6 || sett[c]) continue;
    // samle sammenhengende bebygd område
    const ko = [c]; sett[c] = 1; let n = 0; let tidligst = Infinity; let sx = 0; let sy = 0;
    while (ko.length) { const e = ko.pop(); n++; const i = e % g.nx; const j = (e - i) / g.nx; const [lo, la] = celleSenter(g, i, j); sx += lo; sy += la;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di; const jj = j + dj; if (ii < 0 || jj < 0 || ii >= g.nx || jj >= g.ny) continue; const cc = jj * g.nx + ii; if (dekke[cc] === 6 && !sett[cc]) { sett[cc] = 1; ko.push(cc); } else if (tid[cc] < tidligst) tidligst = tid[cc]; } }
    if (tidligst <= T) truet.push({ senter: [sx / n, sy / n], daa: r1(n * celleDaa), minutter: Math.round(tidligst) });
  }
  truet.sort((a, b) => a.minutter - b.minutter);
  return {
    type: 'brann', param: p, grid: g, tid, dekke, ds, flater, start, kurve, truet,
    sum: { daa: totalt(T), skogDaa: r1(skogDaa), flater: flater.length, m3: Math.round(m3), kr: Math.round(kr), truetDaa: r1(truet.reduce((s, x) => s + x.daa, 0)), truetOmrader: truet.length, isi: r1(ISI), lb: r1(SIM.lbForhold(p.vind)), hoderos: r1(SIM.ros('C3', ISI)) },
  };
}
// Hvor stort område må regnes? Raskeste spredning × tiden, med margin, mellom 1,5 og 15 km.
export function brannRadius(p, ISI = SIM.isi(90, p.vind)) { const maks = Math.max(SIM.ros('C3', ISI), SIM.ros('C2', ISI), SIM.ros('S1', ISI)); return Math.min(15000, Math.max(1500, maks * p.timer * 60 * 1.15 + 300)); }

// Farger for ankomsttid (kartlag): 0–1 t, 1–3 t, 3–6 t, 6–12 t, 12+ t.
export const TIDSBAND = [[60, '#5c0a0a', '0–1 t'], [180, '#b3261e', '1–3 t'], [360, '#e0602c', '3–6 t'], [720, '#f2a03d', '6–12 t'], [Infinity, '#f6d36b', 'over 12 t']];
export function bandFor(min) { return TIDSBAND.find(([t]) => min <= t); }
