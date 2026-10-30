// Minikart i den virtuelle skogen: viser hvor du står i bestandet og hvilken vei du ser og går. Tegnes på et
// 2D-lerret som ligger nede til høyre i nettleseren og som en flate nede til venstre i synsfeltet i VR-brillene.
// Ingen DOM her – lerretet sendes inn, så tegningen og beregningene kan testes i Node med et falskt lerret.
//
// Koordinater som i skog3d: x = øst, y = nord, meter fra midten av området.

const RETNINGER = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'];
// Kompassretning (grader fra nord, med klokka) fra en vektor øst/nord.
export const retningGrader = (ost, nord) => ((Math.atan2(ost, nord) * 180) / Math.PI + 360) % 360;
export const kompassTekst = (g) => `${RETNINGER[Math.round(g / 45) % 8]} ${Math.round(g) % 360}°`;
// Målestokk: rund lengde som tar ca. en firedel av kartet.
export function malestokk(radius) { const maal = radius / 2; return [5, 10, 20, 25, 50, 100, 200, 250, 500].reduce((b, v) => (Math.abs(v - maal) < Math.abs(b - maal) ? v : b), 10); }

// Spor: lagrer posisjoner når du har flyttet deg minst 'steg' meter. Gir bevegelsesretningen (de siste metrene).
export function lagSpor({ steg = 1.5, maks = 300 } = {}) {
  const punkter = [];
  return {
    punkter,
    legg(x, y) { const s = punkter.at(-1); if (!s || Math.hypot(x - s[0], y - s[1]) >= steg) { punkter.push([x, y]); if (punkter.length > maks) punkter.shift(); return true; } return false; },
    // Retningen du har gått de siste ca. 6 m (null når du står stille).
    bevegelse(x, y, lengde = 6) {
      if (!punkter.length) return null;
      for (let i = punkter.length - 1; i >= 0; i--) { const [px, py] = punkter[i]; const d = Math.hypot(x - px, y - py); if (d >= lengde || i === 0) return d >= 1 ? retningGrader(x - px, y - py) : null; }
      return null;
    },
    nullstill() { punkter.length = 0; },
  };
}

// Projeksjon fra terreng (m) til lerretet (px). nordOpp = false roterer kartet så blikkretningen peker opp.
export function projeksjon({ x, y, radius, storrelse, retning = 0, nordOpp = true }) {
  const s = storrelse / 2 / radius; const v = nordOpp ? 0 : (retning * Math.PI) / 180; const c = Math.cos(v); const sn = Math.sin(v);
  return ([px, py]) => { const dx = px - x; const dy = py - y; const rx = dx * c - dy * sn; const ry = dx * sn + dy * c; return [storrelse / 2 + rx * s, storrelse / 2 - ry * s]; };
}
const iBoks = (bb, x, y, r) => bb[0] <= x + r && bb[2] >= x - r && bb[1] <= y + r && bb[3] >= y - r;
const boks = (punkter) => { let a = Infinity; let b = Infinity; let c = -Infinity; let d = -Infinity; for (const [x, y] of punkter) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; } return [a, b, c, d]; };

// bestand: [{ id, nr, mp }] (planens bestand), veier: [{ linje, flate }], bekker: [{ linje }], vann: [{ mp }],
// bratthet: { x0, y0, d, nx, ny, pst } – helning i et rutenett (lokale meter), vises som fargede ruter (bratthet.js).
export function lagMinikart({ bestand = [], veier = [], bekker = [], vann = [], bratthet = null, farge = null } = {}) {
  const B = bestand.map((s) => ({ ...s, bb: boks(s.mp.flat(2)), senter: senterAv(s.mp) }));
  const V = veier.map((v) => ({ ...v, bb: boks(v.linje) })); const K = bekker.map((v) => ({ ...v, bb: boks(v.linje) })); const W = vann.map((v) => ({ ...v, bb: boks(v.mp.flat(2)) }));
  // Tegner kartet. Gir hva som er synlig (brukes av testene).
  function tegn(ctx, { x, y, retning = 0, bevegelse = null, spor = [], herBid = null, radius = 80, storrelse = 256, nordOpp = true, vr = false }) {
    const k = storrelse / 256; // tykkelser og tekst skaleres med lerretet (VR bruker større lerret)
    const P = projeksjon({ x, y, radius, storrelse, retning, nordOpp }); const r2 = radius * 1.5; const synlig = { bestand: [], veier: 0 };
    const lin = (pts) => { ctx.beginPath(); pts.forEach((p, i) => { const [a, b] = P(p); if (i) ctx.lineTo(a, b); else ctx.moveTo(a, b); }); };
    const poly = (mp) => { ctx.beginPath(); for (const p of mp) for (const ring of p) ring.forEach((q, i) => { const [a, b] = P(q); if (i) ctx.lineTo(a, b); else ctx.moveTo(a, b); }); };
    ctx.save(); ctx.clearRect(0, 0, storrelse, storrelse);
    // Rund ramme med bakgrunn
    ctx.beginPath(); ctx.arc(storrelse / 2, storrelse / 2, storrelse / 2 - 2, 0, Math.PI * 2); ctx.fillStyle = 'rgba(232,238,224,0.94)'; ctx.fill(); ctx.clip();
    for (const w of W) if (iBoks(w.bb, x, y, r2)) { poly(w.mp); ctx.fillStyle = '#9cc7ea'; ctx.fill('evenodd'); }
    // Bratte områder (over 33 %) som fargede ruter
    if (bratthet && farge) {
      const b = bratthet; const i0 = Math.max(0, Math.floor((x - r2 - b.x0) / b.d)); const i1 = Math.min(b.nx - 1, Math.ceil((x + r2 - b.x0) / b.d));
      const j0 = Math.max(0, Math.floor((y - r2 - b.y0) / b.d)); const j1 = Math.min(b.ny - 1, Math.ceil((y + r2 - b.y0) / b.d)); synlig.bratt = 0;
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const f = farge(b.pst[j * b.nx + i]); if (!f) continue; synlig.bratt++;
        const cx = b.x0 + i * b.d; const cy = b.y0 + j * b.d; const h = b.d / 2;
        ctx.beginPath(); [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]].forEach((q, n) => { const [a, c] = P(q); if (n) ctx.lineTo(a, c); else ctx.moveTo(a, c); }); ctx.closePath();
        ctx.fillStyle = f; ctx.globalAlpha = 0.55; ctx.fill(); ctx.globalAlpha = 1;
      }
    }
    for (const s of B) {
      if (!iBoks(s.bb, x, y, r2)) continue; synlig.bestand.push(s.nr);
      poly(s.mp); const her = s.id === herBid;
      ctx.fillStyle = her ? 'rgba(243,156,74,0.38)' : 'rgba(31,107,74,0.10)'; ctx.fill('evenodd');
      ctx.lineWidth = her ? 3 : 1.4; ctx.strokeStyle = her ? '#c25e10' : 'rgba(110,92,0,0.85)'; ctx.stroke();
    }
    for (const k of K) if (iBoks(k.bb, x, y, r2)) { lin(k.linje); ctx.strokeStyle = '#2a78d6'; ctx.lineWidth = 2; ctx.stroke(); }
    for (const v of V) {
      if (!iBoks(v.bb, x, y, r2)) continue; synlig.veier++;
      lin(v.linje); ctx.setLineDash(v.flate === 'sti' ? [3, 3] : v.flate === 'traktor' ? [7, 4] : []);
      ctx.strokeStyle = v.flate === 'sti' ? '#b8402e' : v.flate === 'traktor' ? '#8a5a2b' : '#555'; ctx.lineWidth = v.flate === 'sti' ? 1.6 : 3; ctx.stroke(); ctx.setLineDash([]);
    }
    // Bestandsnummer
    ctx.font = `700 ${Math.round((vr ? 15 : 12) * k)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const s of B) {
      if (!s.senter || !iBoks(s.bb, x, y, r2)) continue; const [a, b] = P(s.senter);
      if (a < 14 || a > storrelse - 14 || b < 14 || b > storrelse - 14) continue;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.strokeText(s.nr, a, b); ctx.fillStyle = s.id === herBid ? '#7a3500' : '#1b1c19'; ctx.fillText(s.nr, a, b);
    }
    // Sporet du har gått (svakere jo eldre)
    if (spor.length > 1) {
      for (let i = 1; i < spor.length; i++) { const [a0, b0] = P(spor[i - 1]); const [a1, b1] = P(spor[i]); ctx.beginPath(); ctx.moveTo(a0, b0); ctx.lineTo(a1, b1); ctx.strokeStyle = `rgba(42,120,214,${0.15 + (0.75 * i) / spor.length})`; ctx.lineWidth = 2.5 * k; ctx.stroke(); }
    }
    // Deg: blikkretning som sektor og pil, bevegelsesretning som strek
    const m = storrelse / 2; const kartVinkel = nordOpp ? 0 : retning; const vinkel = (g) => ((g - kartVinkel - 90) * Math.PI) / 180;
    ctx.beginPath(); ctx.moveTo(m, m); ctx.arc(m, m, storrelse * 0.22, vinkel(retning) - 0.45, vinkel(retning) + 0.45); ctx.closePath(); ctx.fillStyle = 'rgba(42,120,214,0.38)'; ctx.fill();
    if (bevegelse != null) { const a = vinkel(bevegelse); ctx.beginPath(); ctx.moveTo(m, m); ctx.lineTo(m + Math.cos(a) * storrelse * 0.16, m + Math.sin(a) * storrelse * 0.16); ctx.strokeStyle = '#0ca30c'; ctx.lineWidth = 3 * k; ctx.stroke(); }
    const a = vinkel(retning); const pil = (d, v) => [m + Math.cos(a + v) * d, m + Math.sin(a + v) * d];
    ctx.beginPath(); ctx.moveTo(...pil(13 * k, 0)); ctx.lineTo(...pil(10 * k, 2.4)); ctx.lineTo(...pil(4 * k, Math.PI)); ctx.lineTo(...pil(10 * k, -2.4)); ctx.closePath();
    ctx.fillStyle = '#2a78d6'; ctx.fill(); ctx.lineWidth = 2 * k; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
    // Ramme, nordpil og målestokk (utenfor klippingen)
    ctx.beginPath(); ctx.arc(m, m, m - 2, 0, Math.PI * 2); ctx.lineWidth = 3 * k; ctx.strokeStyle = 'rgba(16,36,28,0.85)'; ctx.stroke();
    const nv = ((-kartVinkel - 90) * Math.PI) / 180; const nx = m + Math.cos(nv) * (m - 16 * k); const ny = m + Math.sin(nv) * (m - 16 * k);
    ctx.beginPath(); ctx.arc(nx, ny, (vr ? 12 : 10) * k, 0, Math.PI * 2); ctx.fillStyle = '#10241c'; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round((vr ? 14 : 12) * k)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('N', nx, ny + 0.5);
    const ms = malestokk(radius); const px = (ms / radius) * m;
    ctx.fillStyle = 'rgba(16,36,28,0.85)'; ctx.fillRect(m - px / 2, storrelse - 26 * k, px, 4 * k);
    ctx.font = `600 ${Math.round((vr ? 13 : 10) * k)}px system-ui, sans-serif`; ctx.fillText(`${ms} m`, m, storrelse - 35 * k);
    return synlig;
  }
  return { tegn };
}
// Et punkt som ligger godt inne i flaten (største ytre ring, midt i boksen eller første hjørne innenfor).
function senterAv(mp) {
  let best = null; let ba = 0;
  for (const p of mp) { const r = p[0]; let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; if (Math.abs(a) > ba) { ba = Math.abs(a); best = r; } }
  if (!best) return null; let sx = 0; let sy = 0; for (const [x, y] of best) { sx += x; sy += y; } return [sx / best.length, sy / best.length];
}
