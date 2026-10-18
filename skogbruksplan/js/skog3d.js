// Virtuell skog (beta): gå rundt i skogen fra bakkenivå – i nettleseren eller med VR-briller (WebXR, f.eks. Meta
// Quest). Trærne bygges av bestandsdataene (skog3d-data.js), terrenget av Kartverkets høydedata (DTM1), og veier,
// stier, bekker, vann, bygninger, markslag og eiendomsgrensen hentes fra åpne kilder (skog3d-omgivelser.js).
// Styring: mus + WASD/piltaster (Shift = løpe), berøring (venstre halvdel går, høyre ser), og i VR venstre
// stikke = gå, høyre stikke = snu 30°. Three.js lastes fra unpkg første gang visningen åpnes.
import { lagSkog, terrengPunkter, lagTerreng, iPolygon } from './skog3d-data.js';
import { hentOmgivelser, naboBestand, lagHinder, lagOppslag, hentHoyder, terrengOppløsning, iBygning } from './skog3d-omgivelser.js';
import { lagOmgivelserLag } from './skog3d-objekter.js';
import { MARKSLAG } from './markslag.js';
import { lagTreLag } from './skog3d-traer.js';
import { lagBunnLag } from './skog3d-bunn.js';
import { vegProfil, markProfil } from './skog3d-veg.js';
import { TRESLAG, HK_ROMERTALL, startTilstand } from './model.js';
import { hkTekst } from './tetthet.js';
import { middelhoyde, ungskogData, erUngskog } from './ungskog.js';
import { etikettPunkt } from './proj.js';

const THREE_URL = 'https://unpkg.com/three@0.160.0/build/three.module.js';
const OYEHOYDE = 1.7;
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
  const laster = rot.querySelector('.s3-laster'); const vis = (t) => { if (laster) laster.textContent = t; };
  const start = etikettPunkt(b.geometri);
  const forste = lagSkog(S, { start, inn });
  const R = forste.radius;
  // Terreng (Kartverket), veier, stier, bekker, vann, bygninger og markslag hentes samtidig.
  vis('Henter terreng, veier, bygninger og markslag …');
  let hoyde = () => 0;
  const n = terrengOppløsning(R);
  const [z, omg] = await Promise.all([
    hentHoyder(terrengPunkter(forste.senter, R, n)).catch(() => []),
    hentOmgivelser(forste.senter, R, { S }).catch(() => ({ veier: [], bekker: [], innsjoer: [], bygg: [], ar5: [], grense: [], status: {} })),
  ]);
  if (z.length === n * n && z.filter(Number.isFinite).length > z.length * 0.8) hoyde = lagTerreng(z, R, n);
  omg.radius = R;
  vis('Bygger skogen …');
  const hinder = lagHinder(omg);
  // Trærne: planens bestand + skog utenfor planen (AR5), ikke på veier, i vann eller ved bygninger (stier får 1 m klaring).
  const skog = lagSkog({ ...S, bestand: [...S.bestand, ...naboBestand(omg)] }, { start, inn, radius: R, fri: (x, y) => !hinder(x, y) });
  // Markslag uten skog (jordbruk, åpen fastmark, bebygd, samferdsel). Impediment og myr får glisne trær via naboBestand.
  const mark = omg.ar5.filter((f) => !['produktiv', 'impediment', 'myr'].includes(f.kategori)).map((f) => ({ id: `m-${f.id}`, mp: f.mp, kategori: f.kategori, beskrivelse: f.beskrivelse, profil: markProfil(f.kategori) })).filter((f) => f.profil);
  const planBestand = skog.bestand.filter((s) => !s.b.nabo); const naboer = skog.bestand.filter((s) => s.b.nabo);
  // Rekkefølge for oppslag: planens bestand → markslag uten skog → skog utenfor planen
  const flater = [...planBestand, ...mark, ...naboer];
  const finnFlate = lagOppslag(flater);

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
  const vegCache = new Map(); const vegFor = (s) => { if (s.profil) return s.profil; if (!vegCache.has(s.b.id)) vegCache.set(s.b.id, vegProfil(s.b, { inn })); return vegCache.get(s.b.id); };
  const seg = Math.min(150, Math.max(80, Math.round(R / 1.8))); const bakke = new THREE.PlaneGeometry(2 * R, 2 * R, seg, seg); bakke.rotateX(-Math.PI / 2);
  const pos = bakke.attributes.position; const farger = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i); const y = -pos.getZ(i); pos.setY(i, hoyde(x, y));
    const v = 0.85 + ((Math.sin(x * 0.37) * Math.cos(y * 0.29) + 1) / 2) * 0.25;
    const iSkog = finnFlate(x, y);
    // Bunnsjiktet etter vegetasjonstypen (lav, lyng, mose, torv …) eller markslaget; hogstflater litt lysere og mer gulgrønne
    let [r, g, bl] = iSkog ? (iSkog.profil || vegFor(iSkog)).bakke : [0.45, 0.5, 0.3];
    if (hinder(x, y) === 'vann') [r, g, bl] = [0.25, 0.22, 0.16];
    if (iSkog?.hk === 1) [r, g, bl] = [r * 0.6 + 0.55 * 0.4, g * 0.6 + 0.52 * 0.4, bl * 0.6 + 0.3 * 0.4];
    farger.set([r * v, g * v, bl * v], i * 3);
  }
  bakke.setAttribute('color', new THREE.BufferAttribute(farger, 3)); bakke.computeVertexNormals();
  scene.add(new THREE.Mesh(bakke, new THREE.MeshLambertMaterial({ vertexColors: true })));

  // Veier, stier, bekker, vann, bygninger og eiendomsgrense (skog3d-objekter.js)
  const omgLag = lagOmgivelserLag(THREE, scene, omg, { hoyde });

  // Bestandsgrenser (bare planens) som svake linjer på bakken
  const grenseMat = new THREE.LineBasicMaterial({ color: 0xffd400, transparent: true, opacity: 0.55 });
  for (const s of planBestand) for (const p of s.mp) for (const ring of p) {
    const punkter = []; for (let i = 0; i < ring.length - 1; i++) { const [x0, y0] = ring[i]; const [x1, y1] = ring[i + 1]; const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8)); for (let k = 0; k < n; k++) { const x = x0 + ((x1 - x0) * k) / n; const y = y0 + ((y1 - y0) * k) / n; if (x * x + y * y < R * R) punkter.push(new THREE.Vector3(x, hoyde(x, y) + 0.15, -y)); } }
    if (punkter.length > 1) scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(punkter), grenseMat));
  }

  // Trær: gran, furu og bjørk med detaljerte modeller nær deg og enkle former lenger unna (skog3d-traer.js).
  const treLag = lagTreLag(THREE, scene, skog.traer.map((t) => { const [x, y, z] = tilScene(t.x, t.y); return { x, y, z, h: t.h, kroneStart: t.kroneStart, kroneBredde: t.kroneBredde, art: t.art }; }));
  treLag.oppdater(0, 0, { tvang: true });
  // Bakkevegetasjon (feltsjiktet) rundt deg ut fra vegetasjonstypen (skog3d-bunn.js)
  const bunnLag = lagBunnLag(THREE, scene, flater, { hoyde, inn, grense: R, hinder });
  bunnLag.oppdater(0, 0, { tvang: true });

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
  const NAER = (x, y) => { const h = hinder(x, y); if (h === 'vei' || h === 'sti') { let best = null; let bd = 8; for (const v of omg.veier) for (let i = 0; i < v.linje.length - 1; i++) { const [x0, y0] = v.linje[i]; const [x1, y1] = v.linje[i + 1]; const dx = x1 - x0; const dy = y1 - y0; const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1))); const d = Math.hypot(x - x0 - t * dx, y - y0 - t * dy); if (d < bd) { bd = d; best = v; } } return best ? `🛤️ ${best.navn}${best.kilde ? ` (${best.kilde})` : ''}` : ''; } return h === 'vann' ? '💧 Vann/bekk' : h === 'bygg' ? '🏠 Ved bygning' : ''; };
  function oppdaterHud(x, y) {
    const s = finnFlate(x, y); const ekstra = NAER(x, y); const bid = `${s?.b?.id || s?.id || '-'}|${ekstra}`;
    if (bid === hudBid) return; hudBid = bid;
    const ek = ekstra ? `<small>${ekstra}</small>` : '';
    if (!s) { hud.innerHTML = `<b>Utenfor bestand</b><small>Gå inn i et bestand for å se dataene.</small>${ek}`; return; }
    if (!s.b) { hud.innerHTML = `<b>${MARKSLAG[s.kategori]?.navn || s.kategori}</b><small>AR5: ${s.beskrivelse || ''}</small><small>🌿 ${s.profil.navn}</small>${ek}`; return; }
    if (s.b.nabo) { hud.innerHTML = `<b>${s.b.ar5Kategori === 'produktiv' ? 'Skog utenfor planen' : MARKSLAG[s.b.ar5Kategori]?.navn || 'Utenfor planen'}</b><small>AR5: ${s.b.ar5Beskrivelse || ''} · trærne er et generelt anslag</small>${ek}`; return; }
    const x2 = s.b; const st = startTilstand(x2); const mh = middelhoyde(x2, { inn }).verdi; const N = erUngskog(x2, inn) ? ungskogData(x2, { inn }).treantallFor.verdi : x2.treantall; const vg = vegFor(s);
    hud.innerHTML = `<b>Bestand ${x2.nr}</b> · ${TRESLAG[x2.treslag] || ''} ${x2.treslag || ''}${x2.bonitet ?? ''} · HK ${hkTekst(x2, { inn }) || HK_ROMERTALL[s.hk] || ''}
      <small>${s.beskrivelse} · ${Math.round(st.alder)} år${mh ? ` · ${String(Math.round(mh * 10) / 10).replace('.', ',')} m` : ''}${N ? ` · ${Math.round(N)} trær/daa` : ''} · ${Math.round(st.volumDaa)} m³/daa</small>
      <small>🌿 ${vg.kode} ${vg.navn}${vg.anslaatt ? ' (anslått)' : ''} – ${vg.beskrivelse}</small>${ek}`;
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
    const forrige = [dolly.position.x, dolly.position.z];
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
    if (iBygning(omg, dolly.position.x, -dolly.position.z)) { dolly.position.x = forrige[0]; dolly.position.z = forrige[1]; } // ikke gjennom vegger
    const x = dolly.position.x; const y = -dolly.position.z; dolly.position.y = hoyde(x, y);
    if (t - hudTid > 250) { hudTid = t; oppdaterHud(x, y); treLag.oppdater(dolly.position.x, dolly.position.z, { avstand: renderer.xr.isPresenting ? 45 : 60 }); bunnLag.oppdater(x, y, { radius: renderer.xr.isPresenting ? 25 : 35 }); }
    renderer.render(scene, camera);
  });
  laster?.remove();
  const a = omgLag.antall; const deler = [a.veier && `${a.veier} vei/sti`, a.bygg && `${a.bygg} bygg`, (a.bekker || a.innsjoer) && `${a.bekker + a.innsjoer} vann/bekk`, omg.ar5.length && 'markslag', a.grensemerker && 'eiendomsgrense'].filter(Boolean);
  rot.querySelector('.s3-hjelp').textContent = `${skog.traer.length.toLocaleString('nb-NO')} trær i ${planBestand.length} bestand innenfor ${Math.round(R)} m${deler.length ? ` · ${deler.join(', ')}` : ''} · Klikk og se med musa · W A S D / piltaster · Shift for å løpe${matchMedia('(pointer: coarse)').matches ? ' · Venstre halvdel: gå · høyre: se rundt' : ''}`;

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
    treLag.dispose(); bunnLag.dispose(); omgLag.dispose(); scene.traverse((o) => { o.material?.dispose?.(); }); bakke.dispose(); renderer.dispose(); rot.remove();
  }
  rot.querySelector('[data-s3="lukk"]').onclick = lukk;
  const api = { lukk, gaaTil: (x2, y2, retning = yaw) => { dolly.position.set(x2, hoyde(x2, y2), -y2); yaw = retning; }, omg: () => omg, antall: skog.traer.length, planter: () => bunnLag.perType(), omgivelser: () => ({ ...omgLag.antall, ar5: omg.ar5.length, status: omg.status }), radius: R, posisjon: () => ({ x: dolly.position.x, y: -dolly.position.z }), hud: () => hud.textContent };
  rot.skog3d = api; // for feilsøking og tester
  return api;
}
