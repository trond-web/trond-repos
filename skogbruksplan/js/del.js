// Deling av en bestandsflate med en tegnet linje. Ingen DOM – kan testes i Node.
// Linjen kan starte og slutte litt inne i flaten; da forlenges den ut til grensen.
import { arealM2, punktIGeometri } from './proj.js';

const EPS = 1e-12;

function kryss(p, p2, q, q2) {
  const rx = p2[0] - p[0]; const ry = p2[1] - p[1];
  const sx = q2[0] - q[0]; const sy = q2[1] - q[1];
  const n = rx * sy - ry * sx;
  if (Math.abs(n) < EPS * EPS) return null; // parallelle
  const qpx = q[0] - p[0]; const qpy = q[1] - p[1];
  const s = (qpx * sy - qpy * sx) / n; // langs linjen
  const t = (qpx * ry - qpy * rx) / n; // langs kanten
  if (s < 0 || s > 1 || t < 0 || t > 1) return null;
  return { s, t, pt: [p[0] + s * rx, p[1] + s * ry] };
}

function forleng(linje, poly) {
  const l = linje.map((p) => [...p]);
  const [x0, y0, x1, y1] = poly.coordinates[0].reduce(([a, b, c, d], [x, y]) => [Math.min(a, x), Math.min(b, y), Math.max(c, x), Math.max(d, y)], [Infinity, Infinity, -Infinity, -Infinity]);
  const lang = Math.hypot(x1 - x0, y1 - y0) * 2;
  const ut = (fra, til) => { const dx = til[0] - fra[0]; const dy = til[1] - fra[1]; const d = Math.hypot(dx, dy) || 1; return [til[0] + (dx / d) * lang, til[1] + (dy / d) * lang]; };
  if (punktIGeometri(l[0], poly)) l.unshift(ut(l[1], l[0]));
  if (punktIGeometri(l.at(-1), poly)) l.push(ut(l.at(-2), l.at(-1)));
  return l;
}

// Vertekser (indekser) med posisjon strengt mellom fra og til, gått forover rundt ringen.
function gaa(fra, til, n) {
  const D = (til - fra + n) % n || n;
  const ut = [];
  for (let j = 1; j <= n + 1; j++) {
    const k = (Math.floor(fra) + j) % n;
    const d = (k - fra + n) % n;
    if (d > EPS && d < D - EPS) ut.push(k); else if (d >= D - EPS) break;
  }
  return ut;
}

function delEnkel(rings, linje) {
  const ring = rings[0].slice(0, -1); const n = ring.length;
  const poly = { type: 'Polygon', coordinates: rings };
  const l = forleng(linje, poly);
  const treff = [];
  for (let i = 0; i < l.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const k = kryss(l[i], l[i + 1], ring[j], ring[(j + 1) % n]);
      if (k) treff.push({ lp: i + k.s, ep: (j + k.t) % n, pt: k.pt });
    }
  }
  treff.sort((a, b) => a.lp - b.lp);
  const unike = treff.filter((t, i) => i === 0 || t.lp - treff[i - 1].lp > 1e-9);
  if (unike.length < 2) return { feil: 'Linjen må gå tvers over bestandet, fra grense til grense.' };
  const [a, b] = unike;
  const kutt = [];
  for (let k = Math.floor(a.lp) + 1; k <= Math.floor(b.lp); k++) if (k > a.lp + 1e-9 && k < b.lp - 1e-9) kutt.push(l[k]);
  const forste = kutt[0] || b.pt;
  const midt = [(a.pt[0] + forste[0]) / 2, (a.pt[1] + forste[1]) / 2];
  if (!punktIGeometri(midt, poly)) return { feil: 'Linjen går utenfor bestandet mellom de to første kryssingene. Start utenfor eller nær grensen og tegn tvers over.' };
  for (const hull of rings.slice(1)) {
    const h = hull.slice(0, -1);
    for (let i = 0; i < l.length - 1; i++) for (let j = 0; j < h.length; j++) if (kryss(l[i], l[i + 1], h[j], h[(j + 1) % h.length])) return { feil: 'Linjen krysser et hull i bestandet. Tegn utenom hullet.' };
  }
  const ringA = [a.pt, ...kutt, b.pt, ...gaa(b.ep, a.ep, n).map((k) => ring[k])];
  const ringB = [b.pt, ...[...kutt].reverse(), a.pt, ...gaa(a.ep, b.ep, n).map((k) => ring[k])];
  const lukk = (r) => [...r, r[0]];
  const deler = [{ type: 'Polygon', coordinates: [lukk(ringA)] }, { type: 'Polygon', coordinates: [lukk(ringB)] }];
  for (const hull of rings.slice(1)) {
    const d = deler.find((g) => punktIGeometri(hull[0], g)) || deler[0];
    d.coordinates.push(hull);
  }
  return { deler };
}

// Gir { deler: [geometriA, geometriB] } der A er den største, eller { feil }.
export function delFlate(geom, linje) {
  if (!geom || !linje || linje.length < 2) return { feil: 'Tegn en linje med minst to punkter.' };
  let res;
  if (geom.type === 'Polygon') res = delEnkel(geom.coordinates, linje);
  else if (geom.type === 'MultiPolygon') {
    // Del den delflaten linjen krysser; øvrige delflater følger den største delen.
    const delt = geom.coordinates.map((p, i) => ({ i, r: delEnkel(p, linje) })).filter((x) => x.r.deler);
    if (!delt.length) return { feil: 'Linjen må gå tvers over bestandet, fra grense til grense.' };
    const { i, r } = delt[0];
    const andre = geom.coordinates.filter((_, k) => k !== i);
    const [x, y] = r.deler.sort((p, q) => arealM2(q) - arealM2(p));
    const mp = (hoved, ekstra) => (ekstra.length ? { type: 'MultiPolygon', coordinates: [hoved.coordinates, ...ekstra] } : hoved);
    res = { deler: [mp(x, andre), y] };
  } else return { feil: 'Bestandet har ingen flategeometri.' };
  if (!res.deler) return res;
  res.deler.sort((p, q) => arealM2(q) - arealM2(p));
  const min = Math.min(...res.deler.map(arealM2));
  if (min < 1) return { feil: 'Den ene delen ble for liten. Tegn linjen tvers over bestandet.' };
  return res;
}

// Neste ledige bestandsnummer i samme serie: «1-9» blir «1-<høyeste + 1>» innen teigen.
export function nyttNr(nr, alle) {
  const m = String(nr ?? '').match(/^(.*?)(\d+)$/);
  if (!m) return `${nr || ''}B`;
  const [, prefiks] = m;
  const re = new RegExp(`^${prefiks.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\d+)$`);
  const maks = alle.reduce((s, x) => { const t = String(x ?? '').match(re); return t ? Math.max(s, Number(t[1])) : s; }, 0);
  return `${prefiks}${maks + 1}`;
}
