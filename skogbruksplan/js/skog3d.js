// Virtuell skog (beta): gå rundt i skogen fra bakkenivå – i nettleseren eller med VR-briller (WebXR, f.eks. Meta
// Quest). Trærne bygges av bestandsdataene (skog3d-data.js), terrenget av Kartverkets høydedata (DTM1).
// Styring: mus + WASD/piltaster (Shift = løpe), berøring (venstre halvdel går, høyre ser), og i VR venstre
// stikke = gå, høyre stikke = snu 30°. Three.js lastes fra unpkg første gang visningen åpnes.
import { lagSkog, terrengPunkter, lagTerreng, iPolygon } from './skog3d-data.js';
import { TRESLAG, HK_ROMERTALL, startTilstand } from './model.js';
import { hkTekst } from './tetthet.js';
import { middelhoyde, ungskogData, erUngskog } from './ungskog.js';
import { etikettPunkt } from './proj.js';

const THREE_URL = 'https://unpkg.com/three@0.160.0/build/three.module.js';
const OYEHOYDE = 1.7;
const FARGER = { G: { stamme: 0x5a4030, krone: 0x2e6a3a }, F: { stamme: 0x9a6440, krone: 0x4a7a3c }, L: { stamme: 0xe6e2d6, krone: 0x7fae45 } };
const STIL = `
.skog3d { position: fixed; inset: 0; z-index: 3000; background: #9cc3e6; font: 14px/1.4 'Schibsted Grotesk', system-ui, sans-serif; color: #10241c; touch-action: none; }
.skog3d canvas { display: block; width: 100%; height: 100%; }
.skog3d .s3-hud { position: absolute; left: 14px; top: 14px; max-width: min(420px, calc(100% - 28px)); background: rgba(251,252,250,.92); border-radius: 14px; padding: 10px 14px; box-shadow: 0 6px 20px rgba(0,0,0,.18); pointer-events: none; }
.skog3d .s3-hud b { font-size: 16px; } .skog3d .s3-hud small { color: #43544b; display: block; }
.skog3d .s3-knapper { position: absolute; right: 14px; top: 14px; display: flex; gap: 8px; }
.skog3d .s3-knapper button { border: 0; border-radius: 12px; padding: 10px 14px; font: 700 14px/1 inherit; background: #fbfcfa; color: #10241c; box-shadow: 0 4px 14px rgba(0,0,0,.2); cursor: pointer; }
.skog3d .s3-knapper .vr { background: #7b2ff7; color: #fff; }
.skog3d .s3-hjelp { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); background: rgba(16,36,28,.82); color: #f1f6f2; border-radius: 12px; padding: 8px 14px; font-size: 13px; text-align: center; pointer-events: none; max-width: calc(100% - 28px); }
.skog3d .s3-laster { position: absolute; inset: 0; display: grid; place-items: center; font-size: 18px; font-weight: 700; color: #10241c; background: rgba(156,195,230,.85); }
.skog3d .s3-stikke { position: absolute; left: 24px; bottom: 70px; width: 110px; height: 110px; border-radius: 50%; background: rgba(255,255,255,.25); border: 2px solid rgba(255,255,255,.6); display: none; }
@media (pointer: coarse) { .skog3d .s3-stikke { display: block; } }
`;

export async function aapneVirtuellSkog({ S, b, inn, melding = () => {} }) {
  if (!document.getElementById('skog3d-stil')) { const st = document.createElement('style'); st.id = 'skog3d-stil'; st.textContent = STIL; document.head.appendChild(st); }
  const rot = document.createElement('div'); rot.className = 'skog3d';
  rot.innerHTML = `<div class="s3-laster">Bygger skogen …</div><div class="s3-hud" id="s3hud"></div>
    <div class="s3-knapper"><button type="button" class="vr" data-s3="vr" hidden>🥽 VR</button><button type="button" data-s3="lukk">Lukk ✕</button></div>
    <div class="s3-stikke" id="s3stikke"></div>
    <div class="s3-hjelp">Klikk i bildet og se med musa · W A S D / piltaster for å gå · Shift for å løpe · Esc slipper musa</div>`;
  document.body.appendChild(rot);
  let THREE;
  try { THREE = await import(THREE_URL); } catch { rot.remove(); melding('3D-biblioteket kunne ikke lastes. Sjekk nettforbindelsen.'); return null; }

  // ---------- data ----------
  const start = etikettPunkt(b.geometri);
  const skog = lagSkog(S, { start, inn });
  const R = skog.radius;
  let hoyde = () => 0;
  try {
    const n = 10; const pts = terrengPunkter(skog.senter, R, n); const z = [];
    for (let i = 0; i < pts.length; i += 50) {
      const del = pts.slice(i, i + 50).map(([x, y]) => [Number(x.toFixed(6)), Number(y.toFixed(6))]);
      const j = await (await fetch(`https://ws.geonorge.no/hoydedata/v1/punkt?koordsys=4258&geojson=false&punkter=${encodeURIComponent(JSON.stringify(del))}`)).json();
      z.push(...(j.punkter || []).map((q) => q.z));
    }
    if (z.length === n * n) hoyde = lagTerreng(z, R, n);
  } catch { /* flatt terreng uten nett */ }

  // ---------- scene ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  rot.insertBefore(renderer.domElement, rot.firstChild);
  const scene = new THREE.Scene();
  const himmel = new THREE.Color(0x9cc3e6); scene.background = himmel; scene.fog = new THREE.Fog(himmel, 40, Math.max(120, R * 0.9));
  scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x5d6b3a, 1.7)); scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const sol = new THREE.DirectionalLight(0xfff2d8, 1.3); sol.position.set(-60, 120, 40); scene.add(sol);
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
  const dolly = new THREE.Group(); dolly.add(camera); scene.add(dolly);
  // Koordinater: x = øst, z = −nord, y = opp.
  const tilScene = (x, y) => [x, hoyde(x, y), -y];

  // Bakke med høydedata og litt fargevariasjon
  const seg = 80; const bakke = new THREE.PlaneGeometry(2 * R, 2 * R, seg, seg); bakke.rotateX(-Math.PI / 2);
  const pos = bakke.attributes.position; const farger = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i); const y = -pos.getZ(i); pos.setY(i, hoyde(x, y));
    const v = 0.85 + ((Math.sin(x * 0.37) * Math.cos(y * 0.29) + 1) / 2) * 0.25;
    const iSkog = skog.bestand.find((s) => iPolygon(x, y, s.mp));
    const [r, g, bl] = iSkog?.hk === 1 ? [0.55, 0.52, 0.32] : iSkog ? [0.3, 0.38, 0.2] : [0.45, 0.5, 0.3];
    farger.set([r * v, g * v, bl * v], i * 3);
  }
  bakke.setAttribute('color', new THREE.BufferAttribute(farger, 3)); bakke.computeVertexNormals();
  scene.add(new THREE.Mesh(bakke, new THREE.MeshLambertMaterial({ vertexColors: true })));

  // Bestandsgrenser som svake linjer på bakken
  const grenseMat = new THREE.LineBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.55 });
  for (const s of skog.bestand) for (const p of s.mp) for (const ring of p) {
    const punkter = []; for (let i = 0; i < ring.length - 1; i++) { const [x0, y0] = ring[i]; const [x1, y1] = ring[i + 1]; const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8)); for (let k = 0; k < n; k++) { const x = x0 + ((x1 - x0) * k) / n; const y = y0 + ((y1 - y0) * k) / n; if (x * x + y * y < R * R) punkter.push(new THREE.Vector3(x, hoyde(x, y) + 0.15, -y)); } }
    if (punkter.length > 1) scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(punkter), grenseMat));
  }

  // Trær: én InstancedMesh per treslag for stamme og krone
  const stammeGeo = new THREE.CylinderGeometry(0.35, 0.5, 1, 6); stammeGeo.translate(0, 0.5, 0);
  // Gran: kjegle. Furu: flat, avrundet krone. Lauv: eggformet krone. Alle med grunnflate i y = 0 og høyde 1.
  const kroneGeo = { G: new THREE.ConeGeometry(1, 1, 9), F: new THREE.IcosahedronGeometry(1, 1), L: new THREE.IcosahedronGeometry(1, 1) };
  kroneGeo.G.translate(0, 0.5, 0); kroneGeo.F.translate(0, 1, 0); kroneGeo.F.scale(1, 0.5, 1); kroneGeo.L.translate(0, 1, 0); kroneGeo.L.scale(0.8, 0.5, 0.8);
  const m = new THREE.Matrix4(); const q = new THREE.Quaternion(); const p3 = new THREE.Vector3(); const sk = new THREE.Vector3(); const farge = new THREE.Color();
  const geometrier = [stammeGeo, ...Object.values(kroneGeo)];
  for (const art of ['G', 'F', 'L']) {
    const liste = skog.traer.filter((t) => t.art === art); if (!liste.length) continue;
    const stammer = new THREE.InstancedMesh(stammeGeo, new THREE.MeshLambertMaterial({ color: FARGER[art].stamme }), liste.length);
    const kroner = new THREE.InstancedMesh(kroneGeo[art], new THREE.MeshLambertMaterial({ color: 0xffffff }), liste.length);
    liste.forEach((t, i) => {
      const [x, y, z] = tilScene(t.x, t.y); const d = Math.max(0.03, t.h * 0.011);
      m.compose(p3.set(x, y, z), q.identity(), sk.set(d, t.h, d)); stammer.setMatrixAt(i, m);
      const ks = t.h * t.kroneStart; const kh = t.h - ks; const kr = Math.max(0.15, t.h * t.kroneBredde);
      m.compose(p3.set(x, y + ks, z), q.identity(), sk.set(kr, art === 'G' ? kh : kh, kr)); kroner.setMatrixAt(i, m);
      farge.setHex(FARGER[art].krone).offsetHSL(((i * 7919) % 100) / 2500 - 0.02, 0, ((i * 104729) % 100) / 1200 - 0.04); kroner.setColorAt(i, farge);
    });
    stammer.instanceMatrix.needsUpdate = true; kroner.instanceMatrix.needsUpdate = true; if (kroner.instanceColor) kroner.instanceColor.needsUpdate = true;
    scene.add(stammer, kroner);
  }

  // ---------- bevegelse ----------
  const startX = 0; const startY = 0; dolly.position.set(startX, hoyde(startX, startY), -startY);
  camera.position.set(0, OYEHOYDE, 0);
  let yaw = 0; let pitch = 0; const taster = new Set(); let stikke = null; let se = null;
  const lerret = renderer.domElement;
  const tast = (e, ned) => { if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) { if (ned) taster.add(e.code); else taster.delete(e.code); e.preventDefault(); } if (ned && e.code === 'Escape' && !document.pointerLockElement) lukk(); };
  const ned = (e) => tast(e, true); const opp = (e) => tast(e, false);
  const mus = (e) => { if (document.pointerLockElement !== lerret) return; yaw -= e.movementX * 0.0025; pitch = Math.max(-1.3, Math.min(1.3, pitch - e.movementY * 0.0025)); };
  window.addEventListener('keydown', ned); window.addEventListener('keyup', opp); document.addEventListener('mousemove', mus);
  lerret.addEventListener('click', () => { if (!renderer.xr.isPresenting) lerret.requestPointerLock?.(); });
  // Berøring: venstre halvdel = gå (virtuell stikke), høyre = se rundt
  lerret.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) { if (t.clientX < window.innerWidth / 2 && !stikke) stikke = { id: t.identifier, x0: t.clientX, y0: t.clientY, dx: 0, dy: 0 }; else if (!se) se = { id: t.identifier, x: t.clientX, y: t.clientY }; } }, { passive: true });
  lerret.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) { if (stikke?.id === t.identifier) { stikke.dx = Math.max(-1, Math.min(1, (t.clientX - stikke.x0) / 50)); stikke.dy = Math.max(-1, Math.min(1, (t.clientY - stikke.y0) / 50)); } if (se?.id === t.identifier) { yaw -= (t.clientX - se.x) * 0.005; pitch = Math.max(-1.3, Math.min(1.3, pitch - (t.clientY - se.y) * 0.005)); se.x = t.clientX; se.y = t.clientY; } } }, { passive: true });
  lerret.addEventListener('touchend', (e) => { for (const t of e.changedTouches) { if (stikke?.id === t.identifier) stikke = null; if (se?.id === t.identifier) se = null; } });

  const hud = rot.querySelector('#s3hud'); let hudBid = null; let hudTid = 0;
  function oppdaterHud(x, y) {
    const s = skog.bestand.find((z) => iPolygon(x, y, z.mp)); const bid = s?.b.id || null;
    if (bid === hudBid) return; hudBid = bid;
    if (!s) { hud.innerHTML = '<b>Utenfor bestand</b><small>Gå inn i et bestand for å se dataene.</small>'; return; }
    const x2 = s.b; const st = startTilstand(x2); const mh = middelhoyde(x2, { inn }).verdi; const N = erUngskog(x2, inn) ? ungskogData(x2, { inn }).treantallFor.verdi : x2.treantall;
    hud.innerHTML = `<b>Bestand ${x2.nr}</b> · ${TRESLAG[x2.treslag] || ''} ${x2.treslag || ''}${x2.bonitet ?? ''} · HK ${hkTekst(x2, { inn }) || HK_ROMERTALL[s.hk] || ''}
      <small>${s.beskrivelse} · ${Math.round(st.alder)} år${mh ? ` · ${String(Math.round(mh * 10) / 10).replace('.', ',')} m` : ''}${N ? ` · ${Math.round(N)} trær/daa` : ''} · ${Math.round(st.volumDaa)} m³/daa</small>`;
  }

  // VR: venstre stikke går (i blikkretningen), høyre stikke snur 30°.
  let snudd = false;
  function vrStyring(dt) {
    const okt = renderer.xr.getSession(); if (!okt) return;
    for (const kilde of okt.inputSources) {
      const gp = kilde.gamepad; if (!gp || gp.axes.length < 4) continue;
      const [ax, ay] = [gp.axes[2], gp.axes[3]];
      if (kilde.handedness === 'left' && (Math.abs(ax) > 0.15 || Math.abs(ay) > 0.15)) {
        const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
        const hoyre = new THREE.Vector3(-dir.z, 0, dir.x); const fart = (gp.buttons[0]?.pressed ? 4 : 1.5) * dt;
        dolly.position.addScaledVector(dir, -ay * fart).addScaledVector(hoyre, ax * fart);
      }
      if (kilde.handedness === 'right') { if (Math.abs(ax) > 0.7 && !snudd) { dolly.rotation.y -= Math.sign(ax) * (Math.PI / 6); snudd = true; } if (Math.abs(ax) < 0.3) snudd = false; }
    }
  }

  let sist = performance.now();
  renderer.setAnimationLoop((t) => {
    const dt = Math.min(0.1, (t - sist) / 1000); sist = t;
    if (renderer.xr.isPresenting) vrStyring(dt);
    else {
      camera.rotation.set(pitch, yaw, 0, 'YXZ');
      const fart = (taster.has('ShiftLeft') || taster.has('ShiftRight') ? 4.5 : 1.6) * dt;
      let fram = (taster.has('KeyW') || taster.has('ArrowUp') ? 1 : 0) - (taster.has('KeyS') || taster.has('ArrowDown') ? 1 : 0);
      let side = (taster.has('KeyD') || taster.has('ArrowRight') ? 1 : 0) - (taster.has('KeyA') || taster.has('ArrowLeft') ? 1 : 0);
      if (stikke) { fram -= stikke.dy; side += stikke.dx; }
      if (fram || side) { dolly.position.x += (-Math.sin(yaw) * fram + Math.cos(yaw) * side) * fart; dolly.position.z += (-Math.cos(yaw) * fram - Math.sin(yaw) * side) * fart; }
    }
    // Hold deg innenfor området og på bakken
    const r = Math.hypot(dolly.position.x, dolly.position.z); if (r > R - 2) { dolly.position.x *= (R - 2) / r; dolly.position.z *= (R - 2) / r; }
    const x = dolly.position.x; const y = -dolly.position.z; dolly.position.y = hoyde(x, y);
    if (t - hudTid > 250) { hudTid = t; oppdaterHud(x, y); }
    renderer.render(scene, camera);
  });
  rot.querySelector('.s3-laster').remove();
  rot.querySelector('.s3-hjelp').textContent = `${skog.traer.length.toLocaleString('nb-NO')} trær i ${skog.bestand.length} bestand innenfor ${Math.round(R)} m · Klikk og se med musa · W A S D / piltaster · Shift for å løpe${matchMedia('(pointer: coarse)').matches ? ' · Venstre halvdel: gå · høyre: se rundt' : ''}`;

  // VR-knapp når nettleseren og brillene støtter det
  const vrKnapp = rot.querySelector('[data-s3="vr"]');
  try { if (navigator.xr && await navigator.xr.isSessionSupported('immersive-vr')) vrKnapp.hidden = false; } catch { /* ingen WebXR */ }
  vrKnapp.onclick = async () => {
    if (renderer.xr.isPresenting) { renderer.xr.getSession()?.end(); return; }
    try {
      const okt = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
      renderer.xr.setReferenceSpaceType('local-floor'); await renderer.xr.setSession(okt);
      camera.position.set(0, 0, 0); dolly.rotation.y = yaw; vrKnapp.textContent = 'Avslutt VR';
      okt.addEventListener('end', () => { vrKnapp.textContent = '🥽 VR'; camera.position.set(0, OYEHOYDE, 0); });
    } catch (e) { melding(`VR kunne ikke startes: ${e.message}`); }
  };
  const vindu = () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); };
  window.addEventListener('resize', vindu);

  function lukk() {
    renderer.setAnimationLoop(null); renderer.xr.getSession()?.end();
    window.removeEventListener('keydown', ned); window.removeEventListener('keyup', opp); document.removeEventListener('mousemove', mus); window.removeEventListener('resize', vindu);
    if (document.pointerLockElement) document.exitPointerLock();
    scene.traverse((o) => { o.material?.dispose?.(); }); geometrier.forEach((g) => g.dispose()); bakke.dispose(); renderer.dispose(); rot.remove();
  }
  rot.querySelector('[data-s3="lukk"]').onclick = lukk;
  return { lukk, antall: skog.traer.length, radius: R, posisjon: () => ({ x: dolly.position.x, y: -dolly.position.z }), hud: () => hud.textContent };
}
