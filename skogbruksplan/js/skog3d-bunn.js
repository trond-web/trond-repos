// Bakkevegetasjon i den virtuelle skogen: lav, lyng, blåbær, tyttebær, mose, gras, starr, urter, bregner, høgstauder,
// einer og stein ut fra vegetasjonstypen (skog3d-veg.js). Plantene lages i ruter på 5 × 5 m rundt deg og bygges på nytt
// når du har gått noen meter. Én InstancedMesh per plantetype, så det går raskt også i VR. Små planter vises bare nær.
// Alle modeller har grunnflate i y = 0, høyde 1 og bredde ca. 1 (skaleres per plante).
import { vegProfil, vegRute } from './skog3d-veg.js';
import { iPolygon } from './skog3d-data.js';
import { STANDARD_INNSTILLINGER } from './model.js';

const RUTE = 5; // m
const MAKS = 30000; // planter totalt
const hash = (x, y, z, s = 0) => { const v = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s * 19.19) * 43758.5453; return v - Math.floor(v); };
const r3 = (v) => Math.round(v * 1000) / 1000;
// Bredde i forhold til høyden per type (diameter = h × k)
const BREDDE = { lav: 4, mose: 6, torvmose: 6, lyng: 1.4, blabaer: 1.3, tyttebaer: 2, einer: 0.4, stein: 1.5, gras: 0.9, starr: 0.7, urter: 0.8, bregne: 1.2, hoystaude: 0.55 };
const LITEN = 0.22; // planter lavere enn dette vises bare innen NAER_SMAA m
const NAER_SMAA = 16;

export function lagBunnModeller(THREE) {
  const tilFlat = (g) => (g.index ? g.toNonIndexed() : g);
  const farg = (g, fn) => { g = tilFlat(g); const p = g.attributes.position; const c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i += 3) { const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3; const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3; const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3; const f = fn(x, y, z); for (let k = 0; k < 3; k++) c.set(f, (i + k) * 3); } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
  const forskyv = (g, fn) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const [x, y, z] = fn(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, x, y, z); } p.needsUpdate = true; return g; };
  const slaaSammen = (deler) => {
    const fl = deler.map(tilFlat); const n = fl.reduce((s, g) => s + g.attributes.position.count, 0);
    const pos = new Float32Array(n * 3); const col = new Float32Array(n * 3); let o = 0;
    for (const g of fl) { pos.set(g.attributes.position.array, o * 3); if (g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + g.attributes.position.count) * 3); o += g.attributes.position.count; g.dispose(); }
    const ut = new THREE.BufferGeometry(); ut.setAttribute('position', new THREE.BufferAttribute(pos, 3)); ut.setAttribute('color', new THREE.BufferAttribute(col, 3)); ut.computeVertexNormals(); return ut;
  };
  const blob = (detalj, s, [x, y, z], [sx, sy, sz], ujevn = 0.25) => forskyv(new THREE.IcosahedronGeometry(1, detalj), (px, py, pz) => { const k = 1 + (hash(r3(px), r3(py), r3(pz), s) - 0.5) * 2 * ujevn; return [px * k * sx + x, Math.max(0, py * k * sy + y), pz * k * sz + z]; });
  const blandF = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.min(1, Math.max(0, t)));
  // Strå/blad: avsmalnende stripe fra (0,0,0) som bøyer seg utover i retning vinkel.
  const blad = (vinkel, hoyde, bredde, boy, seg = 3, rett = 0) => {
    const g = new THREE.PlaneGeometry(bredde, 1, 1, seg); g.translate(0, 0.5, 0);
    forskyv(g, (x, y) => { const smal = 1 - y * 0.85; return [x * smal, y * hoyde * (1 - boy * y * y * 0.35), boy * y * y + rett * y]; });
    g.rotateY(vinkel); return g;
  };
  const tue = (antall, s, { hoyde = 1, bredde = 0.06, boy = 0.35, spredning = 0.25 }) => [...Array(antall)].map((_, i) => {
    const v = (i / antall) * Math.PI * 2 + hash(i, s, 3) * 0.8; const h = hoyde * (0.65 + hash(i, s, 4) * 0.35);
    return blad(v, h, bredde, boy * (0.6 + hash(i, s, 5) * 0.8), 3, spredning * hash(i, s, 6));
  });
  const stengel = (x, z, h, r = 0.02) => { const g = new THREE.CylinderGeometry(r * 0.6, r, h, 3, 1); g.translate(x, h / 2, z); return g; };

  const M = {};
  // Lav: lys gråhvit, putete matte av noen klumper
  M.lav = farg(slaaSammen([0, 1, 2, 3].map((k) => blob(1, k, [(hash(k, 1, 0) - 0.5) * 0.5, 0.25, (hash(k, 2, 0) - 0.5) * 0.5], [0.28, 0.75, 0.28], 0.35))),
    (x, y, z) => blandF([0.62, 0.64, 0.52], [0.86, 0.87, 0.76], y + hash(r3(x), r3(z), 0, 7) * 0.4));
  // Mose og torvmose: lave, grønne (torvmose gulgrønn med rødlige flekker) puter
  M.mose = farg(slaaSammen([0, 1, 2].map((k) => blob(1, k + 10, [(hash(k, 3, 0) - 0.5) * 0.45, 0.3, (hash(k, 4, 0) - 0.5) * 0.45], [0.3, 0.7, 0.3], 0.3))),
    (x, y, z) => blandF([0.16, 0.28, 0.08], [0.36, 0.52, 0.16], y * 0.8 + hash(r3(x), r3(z), 1, 8) * 0.3));
  M.torvmose = farg(slaaSammen([0, 1, 2].map((k) => blob(1, k + 20, [(hash(k, 5, 0) - 0.5) * 0.45, 0.3, (hash(k, 6, 0) - 0.5) * 0.45], [0.3, 0.7, 0.3], 0.3))),
    (x, y, z) => (hash(r3(x), r3(z), 2, 9) > 0.8 ? [0.62, 0.3, 0.22] : blandF([0.42, 0.48, 0.16], [0.68, 0.7, 0.3], y)));
  // Røsslyng: mørk brungrønn ris med lilla blomster øverst
  M.lyng = farg(slaaSammen([...[0, 1, 2, 3, 4].map((k) => blob(0, k + 30, [(hash(k, 7, 0) - 0.5) * 0.6, 0.35 + hash(k, 8, 0) * 0.25, (hash(k, 9, 0) - 0.5) * 0.6], [0.16, 0.38, 0.16], 0.3)), ...[0, 1, 2].map((k) => stengel((hash(k, 7, 1) - 0.5) * 0.4, (hash(k, 9, 1) - 0.5) * 0.4, 0.6, 0.03))]),
    (x, y) => (y > 0.68 ? [0.56, 0.32, 0.5] : y < 0.25 ? [0.3, 0.24, 0.16] : [0.26, 0.3, 0.18]));
  // Blåbær: lysegrønn busk med greiner, noen blå bær
  M.blabaer = farg(slaaSammen([...[0, 1, 2, 3].map((k) => blob(0, k + 40, [(hash(k, 10, 0) - 0.5) * 0.55, 0.45 + hash(k, 11, 0) * 0.3, (hash(k, 12, 0) - 0.5) * 0.55], [0.24, 0.26, 0.24], 0.35)), stengel(0, 0, 0.7, 0.025), stengel(0.12, -0.05, 0.55, 0.02), ...[0, 1].map((k) => blob(0, k + 45, [(hash(k, 13, 0) - 0.5) * 0.5, 0.35, (hash(k, 14, 0) - 0.5) * 0.5], [0.04, 0.04, 0.04], 0))]),
    (x, y, z) => (Math.hypot(x, z) > 0.12 && y < 0.42 && y > 0.28 ? [0.14, 0.16, 0.36] : y < 0.2 ? [0.25, 0.32, 0.12] : blandF([0.22, 0.44, 0.1], [0.38, 0.6, 0.16], hash(r3(x), r3(y), r3(z), 11))));
  // Tyttebær: lav, mørk blankgrønn, med røde bær
  M.tyttebaer = farg(slaaSammen([...[0, 1, 2].map((k) => blob(0, k + 50, [(hash(k, 15, 0) - 0.5) * 0.45, 0.45, (hash(k, 16, 0) - 0.5) * 0.45], [0.26, 0.5, 0.26], 0.3)), ...[0, 1, 2].map((k) => blob(0, k + 55, [(hash(k, 17, 0) - 0.5) * 0.4, 0.85, (hash(k, 18, 0) - 0.5) * 0.4], [0.07, 0.12, 0.07], 0))]),
    (x, y) => (y > 0.78 ? [0.75, 0.1, 0.1] : [0.12, 0.28, 0.1]));
  // Einer: smal, mørk blågrønn søyle
  M.einer = farg(slaaSammen([0, 1, 2].map((k) => { const g = new THREE.ConeGeometry(0.42 - k * 0.07, 1 - k * 0.18, 7, 2); g.translate((hash(k, 19, 0) - 0.5) * 0.15, (1 - k * 0.18) / 2, (hash(k, 20, 0) - 0.5) * 0.15); return forskyv(g, (x, y, z) => { const j = 1 + (hash(r3(x), r3(y), r3(z), k) - 0.5) * 0.4; return [x * j, y, z * j]; }); })),
    (x, y, z) => blandF([0.12, 0.2, 0.15], [0.24, 0.36, 0.28], hash(r3(x), r3(y), r3(z), 12) * 0.7 + y * 0.3));
  // Stein: grå, kantet, delvis i bakken, med lav- og moseflekker
  M.stein = farg(blob(1, 60, [0, 0.38, 0], [0.5, 0.62, 0.42], 0.3), (x, y, z) => { const f = hash(r3(x), r3(y), r3(z), 13); return f > 0.85 ? [0.7, 0.72, 0.6] : f > 0.75 && y > 0.4 ? [0.3, 0.4, 0.16] : blandF([0.38, 0.38, 0.36], [0.58, 0.57, 0.53], f * 1.3); });
  // Gras og starr: tuer av strå
  M.gras = farg(slaaSammen(tue(14, 1, { hoyde: 1, bredde: 0.11, boy: 0.4 })), (x, y) => blandF([0.3, 0.4, 0.14], [0.66, 0.68, 0.32], y));
  M.starr = farg(slaaSammen(tue(14, 2, { hoyde: 1, bredde: 0.09, boy: 0.22, spredning: 0.12 })), (x, y) => blandF([0.26, 0.38, 0.26], [0.46, 0.58, 0.42], y));
  // Urter: stengler med blader og små blomster (hvit, gul, lilla)
  M.urter = farg(slaaSammen([0, 1, 2].flatMap((k) => { const x = (hash(k, 21, 0) - 0.5) * 0.5; const z = (hash(k, 22, 0) - 0.5) * 0.5; const h = 0.7 + hash(k, 23, 0) * 0.3; return [stengel(x, z, h, 0.02), blob(0, k + 70, [x, h * 0.45, z], [0.14, 0.06, 0.14], 0.3), blob(0, k + 75, [x, h, z], [0.07, 0.05, 0.07], 0)]; })),
    (x, y, z) => (y > 0.66 ? [[0.95, 0.95, 0.9], [0.95, 0.82, 0.2], [0.6, 0.4, 0.8]][Math.floor(hash(r3(x * 3), 0, r3(z * 3), 14) * 3)] : [0.28, 0.48, 0.14]));
  // Bregne: buede blad fra midten
  M.bregne = farg(slaaSammen([...Array(7)].map((_, i) => { const g = blad((i / 7) * Math.PI * 2 + hash(i, 24, 0) * 0.5, 1, 0.22, 0.75, 5, 0.35); return forskyv(g, (x, y, z) => { const tann = Math.sin(y * 40) * 0.025; return [x + tann, y, z]; }); })),
    (x, y) => blandF([0.2, 0.4, 0.1], [0.38, 0.6, 0.2], y));
  // Høgstauder: høy stengel med store blad og blomsterskjerm (hvit, gulhvit eller blålilla)
  M.hoystaude = farg(slaaSammen([0, 1].flatMap((k) => { const x = (k - 0.5) * 0.25; const h = 1 - k * 0.15; return [stengel(x, 0, h, 0.03), blob(0, k + 80, [x + 0.08, h * 0.35, 0], [0.28, 0.06, 0.18], 0.3), blob(0, k + 82, [x - 0.08, h * 0.6, 0.05], [0.22, 0.05, 0.16], 0.3), blob(1, k + 84, [x, h * 0.95, 0], [0.16, 0.08, 0.16], 0.25)]; })),
    (x, y) => (y > 0.85 ? (x > 0 ? [0.5, 0.42, 0.75] : [0.94, 0.92, 0.82]) : [0.24, 0.42, 0.12]));
  return M;
}

// Bunnlaget: bestand = [{ b, mp }] i lokale meter, hoyde(x, y) = terrenget.
export function lagBunnLag(THREE, scene, bestand, { hoyde = () => 0, inn = STANDARD_INNSTILLINGER, radius = 35, grense = Infinity } = {}) {
  const modeller = lagBunnModeller(THREE);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const mesh = {};
  for (const [type, geo] of Object.entries(modeller)) { const m = new THREE.InstancedMesh(geo, mat, MAKS); m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(m); mesh[type] = m; }
  const profiler = new Map(); const profil = (s) => { if (!profiler.has(s.b.id)) profiler.set(s.b.id, vegProfil(s.b, { inn })); return profiler.get(s.b.id); };
  const finn = (x, y) => bestand.find((s) => iPolygon(x, y, s.mp));
  // Planter per rute (lages én gang og huskes)
  const ruter = new Map();
  const rute = (i, j) => {
    const nokkel = `${i},${j}`; if (ruter.has(nokkel)) return ruter.get(nokkel);
    const x0 = i * RUTE; const y0 = j * RUTE; const hjorner = [[x0, y0], [x0 + RUTE, y0], [x0, y0 + RUTE], [x0 + RUTE, y0 + RUTE], [x0 + RUTE / 2, y0 + RUTE / 2]].map(([x, y]) => finn(x, y));
    const ulike = [...new Set(hjorner.filter(Boolean))]; const blandet = ulike.length > 1 || hjorner.some((h) => !h);
    const ut = [];
    for (const s of ulike) for (const p of vegRute(x0, y0, RUTE, profil(s), s.b.id)) {
      if (blandet && finn(p.x, p.y) !== s) continue;
      if (p.x * p.x + p.y * p.y > grense * grense) continue;
      ut.push({ ...p, z: hoyde(p.x, p.y) - 0.02 });
    }
    if (ruter.size > 600) ruter.clear(); // hold minnet nede på lange turer
    ruter.set(nokkel, ut); return ut;
  };
  const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const v = new THREE.Vector3(); const sk = new THREE.Vector3(); const opp = new THREE.Vector3(0, 1, 0); const c = new THREE.Color();
  let sist = null; let antall = 0;
  function oppdater(x, y, { tvang = false, radius: r = radius } = {}) {
    if (!tvang && sist && Math.hypot(x - sist[0], y - sist[1]) < 6 && sist[2] === r) return false;
    sist = [x, y, r];
    const celler = [];
    const n = Math.ceil(r / RUTE) + 1; const ci = Math.floor(x / RUTE); const cj = Math.floor(y / RUTE);
    for (let i = ci - n; i <= ci + n; i++) for (let j = cj - n; j <= cj + n; j++) { const d = Math.hypot((i + 0.5) * RUTE - x, (j + 0.5) * RUTE - y); if (d <= r + RUTE) celler.push([d, i, j]); }
    celler.sort((a, b) => a[0] - b[0]);
    const tell = Object.fromEntries(Object.keys(mesh).map((t) => [t, 0])); antall = 0;
    for (const [, i, j] of celler) {
      for (const p of rute(i, j)) {
        if (antall >= MAKS) break;
        const d = Math.hypot(p.x - x, p.y - y); if (d > r || (p.h < LITEN && d > NAER_SMAA)) continue;
        const m = mesh[p.type]; if (!m) continue;
        const b = p.h * (BREDDE[p.type] || 1) * (0.8 + p.v * 0.4);
        m4.compose(v.set(p.x, p.z, -p.y), q.setFromAxisAngle(opp, p.rot), sk.set(b, p.h, b)); m.setMatrixAt(tell[p.type], m4);
        const t = 0.82 + p.v * 0.3; m.setColorAt(tell[p.type], c.setRGB(t * (0.96 + p.v * 0.08), t, t * (1.04 - p.v * 0.08)));
        tell[p.type]++; antall++;
      }
    }
    for (const [t, m] of Object.entries(mesh)) { m.count = tell[t]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    return true;
  }
  return {
    oppdater,
    antall: () => antall,
    perType: () => Object.fromEntries(Object.entries(mesh).map(([t, m]) => [t, m.count])),
    profil: (s) => profil(s),
    dispose() { for (const m of Object.values(mesh)) { scene.remove(m); m.geometry.dispose(); m.dispose?.(); } mat.dispose(); ruter.clear(); },
  };
}
