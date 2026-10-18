// Tremodeller for den virtuelle skogen: gran, furu og bjørk med egne former og farger, og nivå av detaljer (LOD) –
// detaljerte trær nær deg og enkle former lenger unna, slik at det går raskt også i VR-briller.
//   Gran:  greinkranser i lag med ujevne, litt hengende kanter, mørk blågrønn, smal topp. Krone helt ned i ung skog.
//   Furu:  gråbrun stamme nederst og rødoransje øverst, flat og klumpete krone med synlige greiner høyt oppe.
//   Bjørk: hvit stamme med svarte flekker og mørk, sprukket bark nederst; lys gulgrønn, luftig krone av mange klumper.
// Alle kroner har grunnflate i y = 0 og høyde 1 (skaleres per tre); stammer har høyde 1 og radius ca. 1.

// Fast «støy» av posisjonen, slik at like punkter i ulike trekanter flyttes likt (ingen sprekker).
const hash = (x, y, z, s = 0) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s * 19.19) * 43758.5453; return v - Math.floor(v); };
const r3 = (v) => Math.round(v * 1000) / 1000;

export function lagTremodeller(THREE, { varianter = 3 } = {}) {
  const tilFlat = (g) => (g.index ? g.toNonIndexed() : g);
  const farg = (g, fn) => { g = tilFlat(g); const p = g.attributes.position; const c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) c.set(fn(p.getX(i), p.getY(i), p.getZ(i), i), i * 3); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
  const fargTrekant = (g, fn) => { g = tilFlat(g); const p = g.attributes.position; const c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i += 3) { const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3; const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3; const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3; const f = fn(x, y, z); c.set(f, i * 3); c.set(f, i * 3 + 3); c.set(f, i * 3 + 6); } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
  const forskyv = (g, fn) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const [x, y, z] = fn(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, x, y, z); } p.needsUpdate = true; return g; };
  const slaaSammen = (deler) => {
    const fl = deler.map(tilFlat); const n = fl.reduce((s, g) => s + g.attributes.position.count, 0);
    const pos = new Float32Array(n * 3); const col = new Float32Array(n * 3); let o = 0;
    for (const g of fl) { pos.set(g.attributes.position.array, o * 3); if (g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + g.attributes.position.count) * 3); o += g.attributes.position.count; g.dispose(); }
    const ut = new THREE.BufferGeometry(); ut.setAttribute('position', new THREE.BufferAttribute(pos, 3)); ut.setAttribute('color', new THREE.BufferAttribute(col, 3)); ut.computeVertexNormals(); return ut;
  };
  const blob = (detalj, s, [x, y, z], [sx, sy, sz], ujevn = 0.25) => {
    const g = new THREE.IcosahedronGeometry(1, detalj);
    forskyv(g, (px, py, pz) => { const k = 1 + (hash(r3(px), r3(py), r3(pz), s) - 0.5) * 2 * ujevn; return [px * k * sx + x, py * k * sy + y, pz * k * sz + z]; });
    return g;
  };
  const grein = (fra, til, r = 0.025) => {
    const a = new THREE.Vector3(...fra); const b = new THREE.Vector3(...til); const l = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r * 0.6, r, l, 4, 1); g.translate(0, l / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())); g.translate(a.x, a.y, a.z); return g;
  };

  // ---------- gran ----------
  function granKrone(v) {
    const deler = []; const lag = 6;
    for (let k = 0; k < lag; k++) {
      const t = k / lag; const r = Math.pow(1 - t, 1.05) * (0.94 + hash(k, v, 1) * 0.12); const h = 0.3; const y0 = t * 0.82;
      const g = new THREE.ConeGeometry(r, h, 9, 1, true); g.translate(0, y0 + h / 2, 0);
      // Ujevn, litt hengende kant
      forskyv(g, (x, y, z) => { if (y > y0 + 0.01) return [x, y, z]; const f = 1 + (hash(r3(x), k, r3(z), v) - 0.5) * 0.35; return [x * f, y - 0.04 * f, z * f]; });
      deler.push(farg(g, (x, y) => { const ute = (y0 + h - y) / h; const l = 0.75 + hash(k, v, 3) * 0.2; return [0.09 * l + 0.05 * ute, (0.2 + 0.1 * ute) * l, (0.13 + 0.06 * ute) * l]; }));
    }
    const topp = new THREE.ConeGeometry(0.1, 0.22, 6); topp.translate(0, 0.89, 0); deler.push(farg(topp, () => [0.14, 0.3, 0.18]));
    return slaaSammen(deler);
  }
  // ---------- furu ----------
  function furuKrone(v) {
    const deler = []; const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + hash(i, v, 2) * 0.8; const rr = 0.32 + hash(i, v, 3) * 0.28; const y = 0.35 + hash(i, v, 4) * 0.4;
      const p = [Math.cos(a) * rr, y, Math.sin(a) * rr];
      deler.push(farg(blob(0, i + v * 10, p, [0.42, 0.22, 0.42], 0.35), (x, yy) => { const l = 0.8 + hash(i, v, 5) * 0.25; return [0.17 * l, (0.3 + yy * 0.12) * l, 0.15 * l]; }));
      deler.push(farg(grein([0, y - 0.12, 0], p, 0.03), () => [0.42, 0.26, 0.16]));
    }
    deler.push(farg(blob(0, 99 + v, [0, 0.82, 0], [0.4, 0.18, 0.4], 0.3), () => [0.2, 0.36, 0.17]));
    return slaaSammen(deler);
  }
  // ---------- bjørk ----------
  function bjorkKrone(v) {
    const deler = []; const n = 9;
    for (let i = 0; i < n; i++) {
      const y = 0.12 + (i / (n - 1)) * 0.78; const bredde = Math.sin(Math.PI * Math.min(1, y + 0.05)) * 0.55; const a = i * 2.4 + v;
      const rr = bredde * (0.4 + hash(i, v, 6) * 0.6); const heng = rr * 0.18;
      const p = [Math.cos(a) * rr, y - heng, Math.sin(a) * rr];
      deler.push(farg(blob(1, i + v * 20, p, [0.33, 0.27, 0.33], 0.3), (x, yy) => { const l = 0.85 + hash(i, v, 7) * 0.3; return [0.36 * l, (0.52 + yy * 0.08) * l, 0.17 * l]; }));
      if (i % 2 === 0) deler.push(farg(grein([0, Math.max(0, y - 0.25), 0], p, 0.02), () => [0.25, 0.22, 0.2]));
    }
    return slaaSammen(deler);
  }
  // ---------- stammer ----------
  const granStamme = () => farg(new THREE.CylinderGeometry(0.3, 0.55, 1, 6, 1).translate(0, 0.5, 0), (x, y) => [0.3 - y * 0.05, 0.24 - y * 0.04, 0.2 - y * 0.03]);
  const furuStamme = () => farg(new THREE.CylinderGeometry(0.28, 0.55, 1, 7, 6).translate(0, 0.5, 0), (x, y) => { const t = Math.min(1, Math.max(0, (y - 0.4) / 0.3)); return [0.34 + t * 0.4, 0.27 + t * 0.15, 0.22 + t * 0.03]; });
  const bjorkStamme = () => fargTrekant(new THREE.CylinderGeometry(0.28, 0.5, 1, 8, 14).translate(0, 0.5, 0), (x, y, z) => {
    if (y < 0.1 + hash(r3(x), 0, r3(z), 4) * 0.06) return [0.22, 0.2, 0.19]; // mørk, sprukket bark nederst
    return hash(r3(x * 3), r3(y * 7), r3(z * 3), 1) < 0.2 ? [0.12, 0.11, 0.1] : [0.9, 0.89, 0.84];
  });
  // ---------- enkle former langt unna ----------
  const enkel = {
    G: farg(new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0), (x, y) => [0.1 + y * 0.03, 0.24 + y * 0.05, 0.15]),
    F: farg(blob(0, 7, [0, 0.65, 0], [0.6, 0.3, 0.6], 0.2), () => [0.18, 0.32, 0.16]),
    L: farg(blob(0, 8, [0, 0.55, 0], [0.55, 0.45, 0.55], 0.2), () => [0.36, 0.52, 0.18]),
  };
  const enkelStamme = { G: farg(new THREE.CylinderGeometry(0.3, 0.5, 1, 4, 1).translate(0, 0.5, 0), () => [0.3, 0.24, 0.2]), F: farg(new THREE.CylinderGeometry(0.3, 0.5, 1, 4, 1).translate(0, 0.5, 0), () => [0.6, 0.38, 0.22]), L: farg(new THREE.CylinderGeometry(0.3, 0.5, 1, 4, 1).translate(0, 0.5, 0), () => [0.85, 0.84, 0.8]) };
  return {
    krone: { G: [...Array(varianter)].map((_, v) => granKrone(v)), F: [...Array(varianter)].map((_, v) => furuKrone(v)), L: [...Array(varianter)].map((_, v) => bjorkKrone(v)) },
    stamme: { G: granStamme(), F: furuStamme(), L: bjorkStamme() },
    enkel, enkelStamme,
  };
}

// Instanser med LOD. traer: [{ x, z, y (bakke), h, kroneStart, kroneBredde, art }] i scenekoordinater.
export function lagTreLag(THREE, scene, traer, { naer = 60 } = {}) {
  const mod = lagTremodeller(THREE);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const matKrone = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const n = traer.length; const mStamme = new Float32Array(n * 16); const mKrone = new Float32Array(n * 16); const farge = new Float32Array(n * 3);
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const p = new THREE.Vector3(); const s = new THREE.Vector3(); const e = new THREE.Euler();
  // tykkelse (valgfri): grove trær i pleiet framtidsskog, tynne i upleiet
  traer.forEach((t, i) => {
    const d = Math.max(0.03, t.h * (t.art === 'L' ? 0.009 : 0.012) * (t.tykkelse ?? 1)); const ks = t.h * t.kroneStart; const kh = t.h - ks; const kr = Math.max(0.15, t.h * t.kroneBredde);
    q.setFromEuler(e.set(0, hash(i, 1, 2) * Math.PI * 2, 0));
    m.compose(p.set(t.x, t.y - 0.05, t.z), q, s.set(d, t.h * (t.art === 'G' ? 0.97 : 0.9), d)).toArray(mStamme, i * 16);
    m.compose(p.set(t.x, t.y + ks, t.z), q, s.set(kr, kh, kr)).toArray(mKrone, i * 16);
    const l = 0.88 + hash(i, 3, 4) * 0.24; farge.set([l, l, l], i * 3);
  });
  const mesh = (geo, kap, materiale = mat) => { const x = new THREE.InstancedMesh(geo, materiale, Math.max(1, kap)); x.frustumCulled = false; x.count = 0; x.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(x); return x; };
  const grupper = {};
  for (const art of ['G', 'F', 'L']) {
    const ider = traer.map((t, i) => (t.art === art ? i : -1)).filter((i) => i >= 0); if (!ider.length) continue;
    grupper[art] = { ider, stamme: mesh(mod.stamme[art], ider.length), krone: mod.krone[art].map((g) => mesh(g, ider.length, matKrone)), enkelStamme: mesh(mod.enkelStamme[art], ider.length), enkel: mesh(mod.enkel[art], ider.length) };
  }
  const c = new THREE.Color();
  const settInn = (meshen, k, i, kilde) => { meshen.instanceMatrix.array.set(kilde.subarray(i * 16, i * 16 + 16), k * 16); meshen.setColorAt(k, c.setRGB(farge[i * 3], farge[i * 3 + 1], farge[i * 3 + 2])); };
  let sist = null;
  function oppdater(x, z, { tvang = false, avstand = naer } = {}) {
    if (!tvang && sist && Math.hypot(x - sist[0], z - sist[1]) < 6) return;
    sist = [x, z]; const n2 = avstand * avstand;
    for (const g of Object.values(grupper)) {
      let ns = 0; let es = 0; const nk = g.krone.map(() => 0);
      for (const i of g.ider) {
        const dx = traer[i].x - x; const dz = traer[i].z - z;
        if (dx * dx + dz * dz < n2) { const v = i % g.krone.length; settInn(g.stamme, ns++, i, mStamme); settInn(g.krone[v], nk[v]++, i, mKrone); } else { settInn(g.enkelStamme, es, i, mStamme); settInn(g.enkel, es++, i, mKrone); }
      }
      g.stamme.count = ns; g.enkelStamme.count = es; g.enkel.count = es; g.krone.forEach((k, v) => { k.count = nk[v]; });
      for (const k of [g.stamme, g.enkelStamme, g.enkel, ...g.krone]) { k.instanceMatrix.needsUpdate = true; if (k.instanceColor) k.instanceColor.needsUpdate = true; }
    }
  }
  return {
    oppdater,
    antallDetaljerte: () => Object.values(grupper).reduce((s2, g) => s2 + g.stamme.count, 0),
    dispose: () => { for (const g of Object.values(grupper)) for (const k of [g.stamme, g.enkelStamme, g.enkel, ...g.krone]) { k.geometry.dispose(); k.dispose?.(); scene.remove(k); } mat.dispose(); matKrone.dispose(); },
  };
}
