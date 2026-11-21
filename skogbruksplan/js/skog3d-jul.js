// 🎄 Juletema i den virtuelle skogen (20. november – 31. desember): nisser, reinsdyr og julepynt på granene rundt deg.
// Fjernes automatisk 1. januar. Bygd av enkle former (Three.js) – ingen bilder eller modeller hentes utenfra.

// Juletema fra 20. november til og med 31. desember (måned 0-basert: 10 = november, 11 = desember).
export function erJul3d(d = new Date()) { const m = d.getMonth(); return (m === 10 && d.getDate() >= 20) || m === 11; }

const KULEFARGER = [0xc8102e, 0xd4a017, 0xc0c6cc, 0x1f5fbf, 0x8a1538, 0xe8e8e8];
const LYSFARGER = [0xffd36b, 0xff5a5a, 0x6bd1ff, 0x8dff7a, 0xffffff];
const hash = (i, a = 1) => { const x = Math.sin(i * 12.9898 + a * 78.233) * 43758.5453; return x - Math.floor(x); };

// Nisse: rød kropp, ansikt, hvitt skjegg, rød lue med dusk. Ca. 1 m høy.
function lagNisse(THREE) {
  const g = new THREE.Group();
  const rod = new THREE.MeshLambertMaterial({ color: 0xb3121f }); const hvit = new THREE.MeshLambertMaterial({ color: 0xf4f1ea });
  const hud = new THREE.MeshLambertMaterial({ color: 0xf0c4a4 }); const sort = new THREE.MeshLambertMaterial({ color: 0x1b1b1b });
  const kropp = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 14), rod); kropp.position.y = 0.35; g.add(kropp);
  const belte = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.25, 0.06, 14), sort); belte.position.y = 0.36; g.add(belte);
  const hode = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), hud); hode.position.y = 0.8; g.add(hode);
  const skjegg = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.26, 12), hvit); skjegg.position.set(0, 0.66, 0.07); skjegg.rotation.x = Math.PI; g.add(skjegg);
  const nese = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshLambertMaterial({ color: 0xd9827a })); nese.position.set(0, 0.8, 0.15); g.add(nese);
  for (const x of [-0.05, 0.05]) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.017, 6, 4), sort); o.position.set(x, 0.85, 0.135); g.add(o); }
  const kant = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.035, 8, 16), hvit); kant.rotation.x = Math.PI / 2; kant.position.y = 0.9; g.add(kant);
  const lue = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 14), rod); lue.position.set(0, 1.08, -0.04); lue.rotation.x = -0.35; g.add(lue);
  const dusk = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), hvit); dusk.position.set(0, 1.25, -0.12); g.add(dusk);
  for (const x of [-0.12, 0.12]) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.16), sort); s.position.set(x, 0.03, 0.04); g.add(s); }
  return g;
}

// Reinsdyr: brun kropp, lys bug og hals, bein, hode og gevir. Ca. 1,1 m til ryggen.
function lagRein(THREE, { rodNese = false } = {}) {
  const g = new THREE.Group();
  const brun = new THREE.MeshLambertMaterial({ color: 0x6b4a2f }); const lys = new THREE.MeshLambertMaterial({ color: 0xd8cbb3 });
  const mork = new THREE.MeshLambertMaterial({ color: 0x2f241a }); const horn = new THREE.MeshLambertMaterial({ color: 0xcdb892 });
  const kropp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), brun); kropp.scale.set(0.62, 0.55, 1.25); kropp.position.y = 1.0; g.add(kropp);
  const bug = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 8), lys); bug.scale.set(0.55, 0.4, 1.05); bug.position.y = 0.88; g.add(bug);
  for (const [x, z] of [[-0.17, 0.42], [0.17, 0.42], [-0.17, -0.42], [0.17, -0.42]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.85, 8), brun); b.position.set(x, 0.43, z); g.add(b); const h = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.07, 8), mork); h.position.set(x, 0.03, z); g.add(h); }
  const hals = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.55, 10), lys); hals.position.set(0, 1.35, 0.55); hals.rotation.x = 0.6; g.add(hals);
  const hode = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), brun); hode.scale.set(0.8, 0.8, 1.45); hode.position.set(0, 1.6, 0.78); g.add(hode);
  const nese = new THREE.Mesh(new THREE.SphereGeometry(rodNese ? 0.065 : 0.05, 10, 8), rodNese ? new THREE.MeshBasicMaterial({ color: 0xff2a2a }) : mork); nese.position.set(0, 1.56, 1.0); g.add(nese);
  for (const s of [-1, 1]) {
    const o = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), brun); o.position.set(s * 0.13, 1.72, 0.68); o.rotation.z = -s * 0.9; g.add(o);
    const stang = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.55, 6), horn); stang.position.set(s * 0.14, 1.98, 0.62); stang.rotation.z = -s * 0.35; stang.rotation.x = -0.35; g.add(stang);
    for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.22, 5), horn); t.position.set(s * (0.2 + k * 0.04), 2.02 + k * 0.1, 0.62 + 0.08 - k * 0.07); t.rotation.x = 0.7; t.rotation.z = -s * 0.25; g.add(t); }
  }
  const hale = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), lys); hale.position.set(0, 1.12, -0.62); g.add(hale);
  return g;
}

// Stjerne til toppen av et juletre.
function lagStjerne(THREE) {
  const form = new THREE.Shape(); const n = 5;
  for (let i = 0; i <= n * 2; i++) { const r = i % 2 ? 0.12 : 0.3; const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2; if (i === 0) form.moveTo(Math.cos(a) * r, Math.sin(a) * r); else form.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(form, { depth: 0.06, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: 0xffd24a }));
  m.geometry.center(); return m;
}

// Eget juletre (ca. 3,2 m) med gaver under – står like ved deg, så pynten synes også i høy, hogstmoden skog.
function lagJuletre(THREE) {
  const g = new THREE.Group(); const gronn = new THREE.MeshLambertMaterial({ color: 0x1f5a32 });
  const stamme = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.6, 8), new THREE.MeshLambertMaterial({ color: 0x5a3b22 })); stamme.position.y = 0.3; g.add(stamme);
  for (let i = 0; i < 4; i++) { const r = 1.15 - i * 0.25; const h = 1.2 - i * 0.12; const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 14), gronn); c.position.y = 0.55 + i * 0.62 + h / 2; g.add(c); }
  const gaveFarger = [0xc8102e, 0x1f5fbf, 0xd4a017, 0x2e7d32, 0x8e44ad];
  gaveFarger.forEach((f, i) => {
    const v = (i / gaveFarger.length) * Math.PI * 2 + 0.3; const st = 0.25 + (i % 3) * 0.08; const gave = new THREE.Group();
    const boks = new THREE.Mesh(new THREE.BoxGeometry(st, st * 0.8, st), new THREE.MeshLambertMaterial({ color: f })); gave.add(boks);
    const baand = new THREE.MeshLambertMaterial({ color: 0xf4f1ea });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(st * 1.02, st * 0.82, 0.04), baand); gave.add(b1); const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, st * 0.82, st * 1.02), baand); gave.add(b2);
    gave.position.set(Math.cos(v) * 0.95, st * 0.4, Math.sin(v) * 0.95); gave.rotation.y = v; g.add(gave);
  });
  return g;
}

// traer: trærne i scenekoordinater ({ x, y, z, h, kroneStart, kroneBredde, art }). hoyde(x, y) gir bakkehøyden.
export function lagJulLag(THREE, scene, { traer = [], hoyde = () => 0, R = 200, pyntTraer = 28, kulerPerTre = 14, lysPerTre = 18 } = {}) {
  const gruppe = new THREE.Group(); gruppe.name = 'jul'; scene.add(gruppe);
  let liste = traer; let senter = [NaN, NaN];
  // Kuler og lys på de nærmeste granene (InstancedMesh – bare én tegneoperasjon hver).
  const kule = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshPhongMaterial({ shininess: 90 }), pyntTraer * kulerPerTre);
  const lys = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 6, 4), new THREE.MeshBasicMaterial(), pyntTraer * lysPerTre);
  kule.frustumCulled = false; lys.frustumCulled = false; gruppe.add(kule); gruppe.add(lys);
  const stjerner = Array.from({ length: Math.min(6, pyntTraer) }, () => { const s = lagStjerne(THREE); s.visible = false; gruppe.add(s); return s; });
  const m = new THREE.Matrix4(); const farge = new THREE.Color(); const lysTre = [];
  const juletre = lagJuletre(THREE); gruppe.add(juletre); const jt = { x: NaN, y: 0, z: NaN, h: 3.25, kroneStart: 0.17, kroneBredde: 0.72, art: 'G' };
  function pynt(px, pz) {
    senter = [px, pz];
    // Pynt på trær som er lave nok til at pynten synes fra bakken (2,5–14 m), pluss vårt eget juletre.
    const kandidater = [...(Number.isFinite(jt.x) ? [jt] : []), ...liste.filter((t) => (t.art === 'G' || t.art === 'F') && t.h >= 2.5 && t.h <= 14 && Math.hypot(t.x - px, t.z - pz) < 60)
      .sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz))].slice(0, pyntTraer);
    let k = 0; let l = 0; lysTre.length = 0;
    kandidater.forEach((t, ti) => {
      const ks = t.h * (t.kroneStart ?? 0.3); const kh = t.h - ks; const rBunn = Math.max(0.6, (t.h * (t.kroneBredde ?? 0.35)) / 2);
      const pos = (andel, vinkel, inn = 0.92) => { const y = t.y + ks + kh * andel; const r = rBunn * (1 - andel) * inn; return [t.x + Math.cos(vinkel) * r, y, t.z + Math.sin(vinkel) * r]; };
      for (let i = 0; i < kulerPerTre; i++) { const [x, y, z] = pos(0.08 + hash(ti * 97 + i, 3) * 0.8, hash(ti * 31 + i, 5) * Math.PI * 2); m.makeTranslation(x, y, z); kule.setMatrixAt(k, m); kule.setColorAt(k, farge.setHex(KULEFARGER[(i + ti) % KULEFARGER.length])); k++; }
      // Lysslynge i spiral fra toppen og ned.
      for (let i = 0; i < lysPerTre; i++) { const a = i / lysPerTre; const [x, y, z] = pos(0.95 - a * 0.85, a * Math.PI * 7 + ti, 0.97); m.makeTranslation(x, y, z); lys.setMatrixAt(l, m); lys.setColorAt(l, farge.setHex(LYSFARGER[i % LYSFARGER.length])); l++; }
      lysTre.push(t);
      if (ti < stjerner.length) { const s = stjerner[ti]; s.position.set(t.x, t.y + t.h + 0.18, t.z); s.visible = true; }
    });
    for (let i = kandidater.length; i < stjerner.length; i++) stjerner[i].visible = false;
    kule.count = k; lys.count = l;
    kule.instanceMatrix.needsUpdate = true; lys.instanceMatrix.needsUpdate = true;
    if (kule.instanceColor) kule.instanceColor.needsUpdate = true; if (lys.instanceColor) lys.instanceColor.needsUpdate = true;
  }
  // Nisser og reinsdyr rundt deg. De følger etter når du går langt, og står på bakken.
  const nisser = Array.from({ length: 5 }, (_, i) => ({ obj: lagNisse(THREE), vinkel: (i / 5) * Math.PI * 2 + 0.4, avstand: 5 + (i % 3) * 3, fase: i }));
  const rein = Array.from({ length: 3 }, (_, i) => ({ obj: lagRein(THREE, { rodNese: i === 0 }), vinkel: -Math.PI / 2 + [-0.75, 0.6, 1.05][i], avstand: 9 + i * 2.5, fase: i * 2 }));
  for (const f of [...nisser, ...rein]) gruppe.add(f.obj);
  let base = [NaN, NaN];
  function plasser(px, pz) {
    base = [px, pz];
    for (const f of [...nisser, ...rein]) {
      let x = px + Math.cos(f.vinkel) * f.avstand; let z = pz + Math.sin(f.vinkel) * f.avstand;
      const r = Math.hypot(x, z); if (r > R - 3) { x *= (R - 3) / r; z *= (R - 3) / r; }
      // Unngå å stå inne i et tre.
      const naer = liste.find((t) => Math.hypot(t.x - x, t.z - z) < 0.8); if (naer) { x += 1.2; z += 0.6; }
      f.x = x; f.z = z; f.obj.position.set(x, hoyde(x, -z), z);
    }
    // Juletreet 7 m nord for deg (fri plass mellom trærne).
    let jx = px; let jz = pz - 7; for (let i = 0; i < 12 && liste.some((t) => Math.hypot(t.x - jx, t.z - jz) < 1.4); i++) { jx += 1.1; jz += (i % 2 ? 0.8 : -0.8); }
    const r = Math.hypot(jx, jz); if (r > R - 3) { jx *= (R - 3) / r; jz *= (R - 3) / r; }
    jt.x = jx; jt.z = jz; jt.y = hoyde(jx, -jz); juletre.position.set(jx, jt.y, jz); senter = [NaN, NaN];
  }
  return {
    gruppe,
    settTraer(ny) { liste = ny; senter = [NaN, NaN]; },
    oppdater(t, dt, px, pz) {
      if (!(Math.hypot(px - base[0], pz - base[1]) < 25)) plasser(px, pz);
      if (!(Math.hypot(px - senter[0], pz - senter[1]) < 15)) pynt(px, pz);
      // Lysene blinker rolig, nissene vugger og ser mot deg, reinsdyrene beiter.
      lys.material.color.setScalar(0.75 + 0.25 * Math.sin(t * 2.2));
      for (const n of nisser) { n.obj.rotation.y = Math.atan2(px - n.x, pz - n.z); n.obj.position.y = hoyde(n.x, -n.z) + Math.abs(Math.sin(t * 2 + n.fase)) * 0.06; n.obj.rotation.z = Math.sin(t * 1.5 + n.fase) * 0.06; }
      for (const r of rein) r.obj.rotation.y = Math.sin(t * 0.15 + r.fase) * 1.2 + r.fase;
    },
    synlig(v) { gruppe.visible = v; },
    dispose() { scene.remove(gruppe); gruppe.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); },
  };
}
