// 3D-objekter for omgivelsene i den virtuelle skogen (data fra skog3d-omgivelser.js):
//   veier (asfalt, grus, traktorvei med hjulspor), stier, bekker og innsjøer, bygninger med saltak, vinduer og dør,
//   og eiendomsgrensen som rød stripe på bakken med grensemerker (rødmalte jernbolter/staker) i knekkpunktene.
// Alt slås sammen til noen få meshes med fargede hjørner, så det tegnes raskt også i VR.
const hash = (x, y, s = 0) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 19.19) * 43758.5453; return v - Math.floor(v); };

export function lagOmgivelserLag(THREE, scene, omg, { hoyde = () => 0 } = {}) {
  const ting = [];
  const leggTil = (pos, col, materiale) => {
    if (!pos.length) return;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, materiale); scene.add(m); ting.push(m);
  };
  const flatMat = (offset = -2) => new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: offset, polygonOffsetUnits: offset });

  // Stripe langs en linje (lokale meter). striper = [[fra, til, farge]] på tvers i meter fra midten.
  function stripe(pos, col, linje, striper, loft = 0.06, steg = 2) {
    // fortett linja
    const p = [];
    for (let i = 0; i < linje.length - 1; i++) { const [x0, y0] = linje[i]; const [x1, y1] = linje[i + 1]; const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / steg)); for (let k = 0; k < n; k++) p.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]); }
    p.push(linje.at(-1)); if (p.length < 2) return;
    const norm = p.map((_, i) => { const a = p[Math.max(0, i - 1)]; const b = p[Math.min(p.length - 1, i + 1)]; const dx = b[0] - a[0]; const dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; });
    for (const [fra, til, farge] of striper) {
      for (let i = 0; i < p.length - 1; i++) {
        const q = (j, d) => { const x = p[j][0] + norm[j][0] * d; const y = p[j][1] + norm[j][1] * d; return [x, hoyde(x, y) + loft, -y]; };
        const a = q(i, fra); const b = q(i, til); const c = q(i + 1, fra); const d = q(i + 1, til);
        const v = 0.92 + hash(p[i][0], p[i][1], fra) * 0.16; const f = farge.map((x) => x * v);
        pos.push(...a, ...c, ...b, ...b, ...c, ...d); for (let k = 0; k < 6; k++) col.push(...f);
      }
    }
  }

  // ---------- veier og stier ----------
  const vp = []; const vc = [];
  const ASFALT = [0.22, 0.22, 0.23]; const KANT = [0.8, 0.8, 0.76]; const GRUS = [0.46, 0.42, 0.35]; const GRUSKANT = [0.36, 0.33, 0.26]; const SPOR = [0.36, 0.3, 0.22]; const STI = [0.4, 0.31, 0.21]; const MIDT = [0.38, 0.44, 0.2];
  for (const v of omg.veier || []) {
    const h = v.bredde / 2;
    if (v.flate === 'asfalt') stripe(vp, vc, v.linje, [[-h - 0.6, -h, GRUSKANT], [-h, -h + 0.15, KANT], [-h + 0.15, h - 0.15, ASFALT], [h - 0.15, h, KANT], [h, h + 0.6, GRUSKANT]], 0.07);
    else if (v.flate === 'grus') stripe(vp, vc, v.linje, [[-h - 0.4, -h + 0.4, GRUSKANT], [-h + 0.4, -0.6, GRUS], [-0.6, 0.6, GRUS.map((x) => x * 1.06)], [0.6, h - 0.4, GRUS], [h - 0.4, h + 0.4, GRUSKANT]], 0.06);
    else if (v.flate === 'traktor') stripe(vp, vc, v.linje, [[-1.1, -0.55, SPOR], [-0.55, 0.55, MIDT], [0.55, 1.1, SPOR]], 0.05, 1.5);
    else stripe(vp, vc, v.linje, [[-v.bredde / 2, v.bredde / 2, STI]], 0.05, 1);
  }
  leggTil(vp, vc, flatMat(-2));

  // ---------- bekker ----------
  const vannMat = new THREE.MeshPhongMaterial({ color: 0x3c6e8f, specular: 0x9fc3d8, shininess: 70, transparent: true, opacity: 0.88, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const bp = []; const bc = [];
  for (const b of omg.bekker || []) stripe(bp, bc, b.linje, [[-b.bredde / 2 - 0.5, -b.bredde / 2, [0.35, 0.31, 0.22]], [-b.bredde / 2, b.bredde / 2, [1, 1, 1]], [b.bredde / 2, b.bredde / 2 + 0.5, [0.35, 0.31, 0.22]]], 0.04, 1.5);
  if (bp.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(bc, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshPhongMaterial({ vertexColors: true, color: 0x6f9fbf, specular: 0x7fa7bf, shininess: 50, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); scene.add(m); ting.push(m);
  }
  // ---------- innsjøer: flat vannflate i høyden til strandkanten ----------
  for (const s of omg.innsjoer || []) for (const p of s.mp) {
    const ytre = p[0]; if (ytre.length < 4) continue;
    const z = ytre.map(([x, y]) => hoyde(x, y)).sort((a, b) => a - b); const niva = z[Math.floor(z.length * 0.3)] + 0.05;
    const form = new THREE.Shape(ytre.map(([x, y]) => new THREE.Vector2(x, y)));
    for (const hull of p.slice(1)) form.holes.push(new THREE.Path(hull.map(([x, y]) => new THREE.Vector2(x, y))));
    const g = new THREE.ShapeGeometry(form); g.rotateX(-Math.PI / 2); g.translate(0, niva, 0);
    const m = new THREE.Mesh(g, vannMat); scene.add(m); ting.push(m);
  }

  // ---------- bygninger ----------
  const gp = []; const gc = [];
  const firkant = (a, b, c, d, f) => { gp.push(...a, ...b, ...c, ...a, ...c, ...d); for (let k = 0; k < 6; k++) gc.push(...f); };
  const VINDU = [0.12, 0.16, 0.2]; const KARM = [0.95, 0.95, 0.92]; const DOR = [0.3, 0.2, 0.13];
  for (const g of omg.bygg || []) {
    const m = g.mal; const cos = Math.cos(g.rot); const sin = Math.sin(g.rot);
    const hj = [[-m.l / 2, -m.b / 2], [m.l / 2, -m.b / 2], [m.l / 2, m.b / 2], [-m.l / 2, m.b / 2]].map(([u, w]) => [g.x + u * cos - w * sin, g.y + u * sin + w * cos]);
    const bunn = Math.min(...hj.map(([x, y]) => hoyde(x, y))) - 0.8; const grunn = Math.max(...hj.map(([x, y]) => hoyde(x, y)));
    const topp = grunn + m.h; const moneH = (m.b / 2) * Math.tan((m.tak * Math.PI) / 180);
    const P = (u, w, y) => [g.x + u * cos - w * sin, y, -(g.y + u * sin + w * cos)];
    const [l, b] = [m.l / 2, m.b / 2]; const ut = 0.35; // takutstikk
    // vegger (med grunnmur nederst)
    const mur = [0.45, 0.44, 0.42];
    const vegg = (u0, w0, u1, w1) => { firkant(P(u0, w0, bunn), P(u1, w1, bunn), P(u1, w1, grunn + 0.3), P(u0, w0, grunn + 0.3), mur); firkant(P(u0, w0, grunn + 0.3), P(u1, w1, grunn + 0.3), P(u1, w1, topp), P(u0, w0, topp), m.vegg); };
    vegg(-l, -b, l, -b); vegg(l, -b, l, b); vegg(l, b, -l, b); vegg(-l, b, -l, -b);
    // gavler
    gp.push(...P(-l, -b, topp), ...P(-l, b, topp), ...P(-l, 0, topp + moneH), ...P(l, b, topp), ...P(l, -b, topp), ...P(l, 0, topp + moneH)); for (let k = 0; k < 6; k++) gc.push(...m.vegg);
    // tak
    const uy = (ut * moneH) / b;
    firkant(P(-l - ut, -b - ut, topp - uy), P(l + ut, -b - ut, topp - uy), P(l + ut, 0, topp + moneH), P(-l - ut, 0, topp + moneH), m.takF);
    firkant(P(l + ut, b + ut, topp - uy), P(-l - ut, b + ut, topp - uy), P(-l - ut, 0, topp + moneH), P(l + ut, 0, topp + moneH), m.takF.map((x) => x * 0.85));
    // vinduer (karm + glass) på langveggene og dør
    const ff = 0.04;
    if (m.vinduer) {
      const n = Math.max(1, Math.floor(m.l / 3.2));
      for (const side of [-1, 1]) for (let i = 0; i < n; i++) {
        const u = -l + ((i + 0.5) * m.l) / n; const w = side * (b + ff); const y0 = grunn + Math.min(1.1, m.h * 0.3); const y1 = Math.min(topp - 0.3, y0 + 1.2);
        if (side === -1 && i === Math.floor(n / 2)) { firkant(P(u - 0.5, w, grunn + 0.3), P(u + 0.5, w, grunn + 0.3), P(u + 0.5, w, grunn + 2.3), P(u - 0.5, w, grunn + 2.3), DOR); continue; }
        firkant(P(u - 0.6, w, y0 - 0.08), P(u + 0.6, w, y0 - 0.08), P(u + 0.6, w, y1 + 0.08), P(u - 0.6, w, y1 + 0.08), KARM);
        const w2 = side * (b + ff * 2); firkant(P(u - 0.5, w2, y0), P(u + 0.5, w2, y0), P(u + 0.5, w2, y1), P(u - 0.5, w2, y1), VINDU);
      }
    } else {
      // låve/garasje: stor port midt på langveggen
      const pw = Math.min(3.5, m.l * 0.3); const ph = Math.min(m.h - 0.3, 3.2); const w = -(b + ff);
      firkant(P(-pw / 2, w, grunn + 0.3), P(pw / 2, w, grunn + 0.3), P(pw / 2, w, grunn + ph), P(-pw / 2, w, grunn + ph), m.vegg.map((x) => x * 0.7));
    }
  }
  if (gp.length) leggTil(gp, gc, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));

  // ---------- eiendomsgrense ----------
  const ep = []; const ec = []; const RODT = [0.86, 0.14, 0.1];
  const merker = [];
  for (const ring of omg.grense || []) {
    const deler = []; let del = [];
    for (const q of ring) { if (Math.hypot(q[0], q[1]) < (omg.radius || 1e9)) del.push(q); else { if (del.length > 1) deler.push(del); del = []; } }
    if (del.length > 1) deler.push(del);
    for (const d of deler) stripe(ep, ec, d, [[-0.12, 0.12, RODT]], 0.09, 2);
    let sist = null;
    for (const q of ring) if (Math.hypot(q[0], q[1]) < (omg.radius || 1e9) && (!sist || Math.hypot(q[0] - sist[0], q[1] - sist[1]) > 10)) { merker.push(q); sist = q; }
  }
  for (const [x, y] of merker) {
    const z = hoyde(x, y); const r = 0.06; const h = 0.9;
    for (let k = 0; k < 4; k++) {
      const a0 = (k / 4) * Math.PI * 2; const a1 = ((k + 1) / 4) * Math.PI * 2;
      const A = [x + Math.cos(a0) * r, -(y + Math.sin(a0) * r)]; const B = [x + Math.cos(a1) * r, -(y + Math.sin(a1) * r)];
      ep.push(A[0], z, A[1], B[0], z, B[1], B[0], z + h * 0.7, B[1], A[0], z, A[1], B[0], z + h * 0.7, B[1], A[0], z + h * 0.7, A[1]); for (let i = 0; i < 6; i++) ec.push(0.75, 0.7, 0.55);
      ep.push(A[0], z + h * 0.7, A[1], B[0], z + h * 0.7, B[1], B[0], z + h, B[1], A[0], z + h * 0.7, A[1], B[0], z + h, B[1], A[0], z + h, A[1]); for (let i = 0; i < 6; i++) ec.push(...RODT);
    }
    // liten steinrøys rundt
    for (let s = 0; s < 3; s++) { const a = hash(x, y, s) * Math.PI * 2; const sx = x + Math.cos(a) * 0.25; const sy = y + Math.sin(a) * 0.25; const sz = hoyde(sx, sy); ep.push(sx - 0.15, sz, -sy, sx + 0.15, sz, -sy, sx, sz + 0.2, -sy - 0.1, sx, sz, -sy - 0.15, sx, sz, -sy + 0.15, sx, sz + 0.2, -sy); for (let i = 0; i < 6; i++) ec.push(0.5, 0.5, 0.47); }
  }
  if (ep.length) leggTil(ep, ec, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));

  return {
    antall: { veier: (omg.veier || []).length, bekker: (omg.bekker || []).length, innsjoer: (omg.innsjoer || []).length, bygg: (omg.bygg || []).length, grensemerker: merker.length },
    dispose() { for (const m of ting) { scene.remove(m); m.geometry.dispose(); m.material.dispose?.(); } vannMat.dispose(); },
  };
}
