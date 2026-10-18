// Virtuell skog: bygger enkelttrær ut fra bestandsdataene (treslag, høyde, treantall, hogstklasse, tetthet og
// ungskogfeltene) for 3D/VR-visningen i skog3d.js. Trærne er en tolkning av dataene – posisjonene er tilfeldige
// (men faste per bestand), mens tetthet, høyde og treslagsblanding følger planen. Ingen DOM – kan testes i Node.
import { STANDARD_INNSTILLINGER, startTilstand, hogstklasseFor, foryngelse } from './model.js';
import { hoydeOm, plantetall } from './tiltaksmotor.js';
import { ungskogData, treantallModell, fraSr16, pleieDekning } from './ungskog.js';
import { tetthet } from './tetthet.js';
import { tilUtmPunkt, tilGeoPunkt } from './flate-geometri.js';

export const MAKS_TRAER = 30000;
const BLANDING = { G: { G: 0.85, L: 0.1, F: 0.05 }, F: { F: 0.8, G: 0.1, L: 0.1 }, L: { L: 0.75, G: 0.2, F: 0.05 } };
const STANDARD_N = { 3: 160, 4: 100, 5: 70 }; // trær/daa når treantallet mangler

// Deterministisk tilfeldighet (samme skog hver gang for samme bestand).
export function rng(frø) {
  let h = 2166136261; for (const c of String(frø)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  let s = h >>> 0;
  return () => { s += 0x6d2b79f5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Hva som skal stå i bestandet: [{ art, N (trær/daa), H (m), kroneStart (andel av høyden), kroneBredde (andel av høyden) }]
export function bestandTraer(b, { inn = STANDARD_INNSTILLINGER } = {}) {
  const hk = hogstklasseFor(b, inn) || 3; const ts = b.treslag || 'G'; const s = startTilstand(b);
  // Kronen: i ung skog går granas krone nesten ned til bakken; med alder og tetthet dør de nedre greinene (kvisting).
  const krone = (art, H, tett = false) => {
    const fase = H < 3 ? 0 : hk <= 2 ? 1 : hk === 3 ? 2 : 3;
    const start = { G: [0.02, 0.05, 0.25, 0.38], F: [0.05, 0.15, 0.45, 0.6], L: [0.1, 0.2, 0.4, 0.5] }[art][fase] + (tett && fase >= 2 ? 0.08 : 0);
    const bredde = { G: [0.3, 0.22, 0.17, 0.14], F: [0.3, 0.2, 0.15, 0.13], L: [0.3, 0.2, 0.17, 0.16] }[art][fase];
    return { kroneStart: start, kroneBredde: bredde };
  };
  const art = (a, N, H) => ({ art: a, N, H: Math.max(0.2, H), ...krone(a, H, N > 120) });
  const blanding = (N, H, hovedLavere = false) => Object.entries(BLANDING[ts] || BLANDING.G).map(([a, andel]) => art(a, N * andel, a === ts || !hovedLavere ? H : H * 0.8)).filter((x) => x.N > 0);

  if (hk === 1) {
    const ut = [art('L', 3, 16)]; // livsløpstrær/frøtrær som står igjen
    if (foryngelse(b) === 'forynget') { const pt = plantetall(ts === 'L' ? 'G' : ts, s.h40).anbefalt; ut.push(art(ts === 'L' ? 'G' : ts, pt * 0.85, 0.5)); }
    ut.push(art('L', 60, 1)); // oppslag av lauv og busker
    return { hk, arter: ut, beskrivelse: 'Hogstflate under fornying' };
  }
  if (hk === 2) {
    const d = ungskogData(b, { inn }); const pleid = d.pleid || pleieDekning(b)?.helt;
    const N = pleid ? (d.treantallEtter.verdi ?? 200) : (d.treantallFor.verdi ?? treantallModell(b).verdi);
    const m = treantallModell(b); const barAndel = ts === 'L' ? 0.2 : pleid ? 0.88 : Math.min(0.9, Math.max(0.15, m.verdi ? m.bar / m.verdi : 0.4));
    const Hb = d.hoydeBar.verdi ?? hoydeOm(b, 0); const Hl = d.hoydeLauv.verdi ?? Hb * 1.25;
    const bar = ts === 'L' ? 'G' : ts;
    return { hk, arter: [art(bar, N * barAndel, Hb), art('L', N * (1 - barAndel), Hl)].filter((x) => x.N > 0.5), beskrivelse: `Ungskog${pleid ? ', pleiet' : ''}` };
  }
  const H = hoydeOm(b, 0) || 15;
  let N = b.treantall ?? STANDARD_N[hk] ?? 100;
  if (b.treantall == null && tetthet(b, { inn, hk }).klasse === 'b') N *= 0.6;
  if (b.treantall == null && s.volumDaa && H) N = Math.min(N * 1.5, Math.max(N * 0.4, N * (s.volumDaa / Math.max(5, H * 1.6)))); // juster mot volumet
  return { hk, arter: blanding(N, H, true), beskrivelse: hk === 3 ? 'Yngre produksjonsskog' : hk === 4 ? 'Eldre produksjonsskog' : 'Hogstmoden skog', sr16: fraSr16(b) };
}

// Polygon(er) i lokale meter rundt senteret (x øst, y nord).
const lokal = (geom, [cx, cy]) => (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates).map((p) => p.map((r) => r.map((q) => { const [x, y] = tilUtmPunkt(q); return [x - cx, y - cy]; })));
function iRing(x, y, r) { let inne = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i]; const [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inne = !inne; } return inne; }
export const iPolygon = (x, y, mp) => mp.some((p) => iRing(x, y, p[0]) && !p.slice(1).some((h) => iRing(x, y, h)));
const bbox = (mp) => { const xs = mp.flat(2).map((q) => q[0]); const ys = mp.flat(2).map((q) => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };

// Lager trærne i en sirkel rundt startpunktet. Radien krympes til antall trær er under maks (tett ungskog gir mindre
// område). Gir { senter (UTM), radius, traer: [{ x, y, art, h, kroneStart, kroneBredde, bid }], bestand: [{ b, mp }] }.
export function lagSkog(S, { start, radius = 250, maks = MAKS_TRAER, inn = STANDARD_INNSTILLINGER } = {}) {
  const senter = tilUtmPunkt(start);
  const alle = S.bestand.filter((b) => b.geometri).map((b) => ({ b, mp: lokal(b.geometri, senter), p: bestandTraer(b, { inn }) }));
  const mange = (R) => alle.reduce((sum, x) => {
    const [x0, y0, x1, y1] = bbox(x.mp); if (x1 < -R || x0 > R || y1 < -R || y0 > R) return sum;
    // grovt anslag: areal av bestandet i sirkelen × tetthet
    let inne = 0; let n = 0; const st = Math.max(5, R / 25);
    for (let x2 = Math.max(x0, -R); x2 <= Math.min(x1, R); x2 += st) for (let y2 = Math.max(y0, -R); y2 <= Math.min(y1, R); y2 += st) { n++; if (x2 * x2 + y2 * y2 <= R * R && iPolygon(x2, y2, x.mp)) inne++; }
    return sum + inne * st * st / 1000 * x.p.arter.reduce((t, a) => t + a.N, 0);
  }, 0);
  let R = radius; while (R > 30 && mange(R) > maks) R *= 0.85;
  const traer = []; const med = [];
  for (const x of alle) {
    const [x0, y0, x1, y1] = bbox(x.mp); if (x1 < -R || x0 > R || y1 < -R || y0 > R) continue;
    med.push({ b: x.b, mp: x.mp, beskrivelse: x.p.beskrivelse, hk: x.p.hk });
    for (const a of x.p.arter) {
      const r = rng(`${x.b.id}|${a.art}|${Math.round(a.H * 10)}`);
      const avst = Math.sqrt(1000 / a.N); const fx = r() * avst; const fy = r() * avst;
      for (let gx = Math.max(x0, -R) + fx; gx <= Math.min(x1, R); gx += avst) {
        for (let gy = Math.max(y0, -R) + fy; gy <= Math.min(y1, R); gy += avst) {
          const px = gx + (r() - 0.5) * avst * 0.9; const py = gy + (r() - 0.5) * avst * 0.9;
          if (px * px + py * py > R * R || !iPolygon(px, py, x.mp)) continue;
          const v = 0.75 + r() * 0.5; // høydevariasjon ±25 %
          traer.push({ x: px, y: py, art: a.art, h: a.H * v, kroneStart: a.kroneStart * (0.85 + r() * 0.3), kroneBredde: a.kroneBredde * (0.8 + r() * 0.4), bid: x.b.id });
        }
      }
    }
  }
  return { senter, radius: R, traer: traer.slice(0, maks * 1.2), bestand: med };
}

// Terreng: punktene som hentes fra Kartverket (n × n i kvadratet rundt senteret), og en funksjon for høyde i (x, y).
export function terrengPunkter(senter, R, n = 10) {
  const pts = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = -R + (2 * R * i) / (n - 1); const y = -R + (2 * R * j) / (n - 1); pts.push(tilGeoPunkt([senter[0] + x, senter[1] + y])); }
  return pts;
}
export function lagTerreng(z, R, n = 10) {
  const ok = z.filter(Number.isFinite); const min = ok.length ? Math.min(...ok) : 0;
  const g = z.map((v) => (Number.isFinite(v) ? v - min : 0));
  return (x, y) => {
    const fx = Math.min(n - 1.001, Math.max(0, ((x + R) / (2 * R)) * (n - 1))); const fy = Math.min(n - 1.001, Math.max(0, ((y + R) / (2 * R)) * (n - 1)));
    const i = Math.floor(fx); const j = Math.floor(fy); const u = fx - i; const v = fy - j;
    const a = g[j * n + i]; const b = g[j * n + i + 1]; const c = g[(j + 1) * n + i]; const d = g[(j + 1) * n + i + 1];
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  };
}
