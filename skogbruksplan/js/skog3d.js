// Virtuell skog (beta): gå rundt i skogen fra bakkenivå – i nettleseren eller med VR-briller (WebXR, f.eks. Meta
// Quest). Trærne bygges av bestandsdataene (skog3d-data.js), terrenget av Kartverkets høydedata (DTM1), og veier,
// stier, bekker, vann, bygninger, markslag og eiendomsgrensen hentes fra åpne kilder (skog3d-omgivelser.js).
// Styring: mus + WASD/piltaster (Shift = løpe), berøring (venstre halvdel går, høyre ser), og i VR venstre
// stikke = gå, høyre stikke = snu 30°. Three.js lastes fra unpkg første gang visningen åpnes.
import { lagSkog, terrengPunkter, lagTerreng, iPolygon, framtidsskog, ungskogpleieVisning, MAKS_TRAER } from './skog3d-data.js';
import { STANDARD_VERDI } from './verdi.js';
import { hentVaer, tolkMet, forhandsvaer, vaerScene, vaerTekst, solposisjon, tidFor, VAER_VALG, TID_VALG } from './skog3d-vaer.js';
import { lagVaerLag } from './skog3d-vaerlag.js';
import { API as SERVER_API } from './plan-synk.js';
import { utmTilGeo } from './proj.js';
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
import { lagMinikart, lagSpor, retningGrader, kompassTekst } from './skog3d-kart.js';
import { helning as helningGrid, klasseFor as bratthetKlasse, tekst as bratthetTekst, KLASSER as BRATT_KLASSER } from './bratthet.js';

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
.skog3d .s3-vaer { position: absolute; right: 14px; top: 64px; width: min(330px, calc(100% - 28px)); background: rgba(251,252,250,.95); border-radius: 14px; padding: 10px 12px; box-shadow: 0 6px 20px rgba(0,0,0,.2); display: grid; gap: 8px; }
.skog3d .s3-vaer .rad { display: flex; flex-wrap: wrap; gap: 5px; }
.skog3d .s3-vaer button { border: 1.5px solid #d4ddd6; border-radius: 10px; padding: 7px 9px; font: 650 13px/1.1 'Schibsted Grotesk', system-ui, sans-serif; background: #fff; color: #10241c; cursor: pointer; }
.skog3d .s3-vaer button[aria-pressed="true"] { background: #1f6b45; border-color: #1f6b45; color: #fff; }
.skog3d .s3-vaer small { color: #43544b; }
.skog3d .s3-vaerinfo { position: absolute; left: 50%; top: 14px; transform: translateX(-50%); background: rgba(16,36,28,.78); color: #f1f6f2; border-radius: 12px; padding: 7px 12px; font-size: 13px; pointer-events: none; max-width: calc(100% - 28px); text-align: center; }
@media (max-width: 760px) { .skog3d .s3-vaerinfo { top: auto; bottom: 130px; } }
.skog3d .s3-framtid { position: absolute; left: 50%; bottom: 72px; transform: translateX(-50%); display: flex; gap: 4px; align-items: center; background: rgba(251,252,250,.94); border-radius: 14px; padding: 5px; box-shadow: 0 6px 20px rgba(0,0,0,.18); max-width: calc(100% - 28px); flex-wrap: wrap; justify-content: center; }
.skog3d .s3-framtid span { font-weight: 700; font-size: 13px; padding: 0 6px; }
.skog3d .s3-hud .s3-merker { display: flex; flex-wrap: wrap; gap: 4px 10px; }
.skog3d .s3-hud .s3-merker i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: -1px; }
.skog3d .s3-framtid button { border: 0; border-radius: 10px; padding: 8px 11px; font: 700 13px/1.1 'Schibsted Grotesk', system-ui, sans-serif; background: transparent; color: #10241c; cursor: pointer; }
.skog3d .s3-framtid button[aria-pressed="true"] { background: #1f6b45; color: #fff; }
.skog3d .s3-framtid button:disabled { opacity: .5; cursor: progress; }
@media (max-width: 760px) { .skog3d .s3-framtid { bottom: 84px; } }
.skog3d .s3-hjelp { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); background: rgba(16,36,28,.82); color: #f1f6f2; border-radius: 12px; padding: 8px 14px; font-size: 13px; text-align: center; pointer-events: none; max-width: calc(100% - 28px); }
.skog3d .s3-laster { position: absolute; inset: 0; display: grid; place-items: center; font-size: 18px; font-weight: 700; color: #10241c; background: rgba(156,195,230,.85); }
.skog3d .s3-stikke { position: absolute; left: 24px; bottom: 70px; width: 110px; height: 110px; border-radius: 50%; background: rgba(255,255,255,.25); border: 2px solid rgba(255,255,255,.6); display: none; }
@media (pointer: coarse) { .skog3d .s3-stikke { display: block; } }
.skog3d .s3-kart { position: absolute; right: 14px; bottom: 14px; width: 190px; display: grid; gap: 4px; justify-items: center; }
.skog3d .s3-kart canvas { width: 190px; height: 190px; cursor: pointer; border-radius: 50%; box-shadow: 0 6px 20px rgba(0,0,0,.28); }
.skog3d .s3-kartinfo { background: rgba(16,36,28,.82); color: #f1f6f2; border-radius: 10px; padding: 4px 10px; font: 600 12px/1.35 system-ui, sans-serif; text-align: center; white-space: nowrap; }
.skog3d .s3-kartinfo b { color: #9fd0ff; } .skog3d .s3-kartinfo i { color: #8ee08e; font-style: normal; }
.skog3d .s3-kartknapper { display: flex; gap: 4px; } .skog3d .s3-kartknapper button { border: 0; border-radius: 8px; width: 30px; height: 26px; font: 700 14px/1 system-ui; background: #fbfcfa; color: #10241c; box-shadow: 0 2px 8px rgba(0,0,0,.2); cursor: pointer; }
.skog3d .s3-kart.liten canvas { width: 120px; height: 120px; } .skog3d .s3-kart.liten { width: 120px; }
.skog3d .s3-brattleg { position: absolute; left: 14px; bottom: 14px; max-width: 300px; background: rgba(251,252,250,.92); border-radius: 12px; padding: 8px 12px; font: 12px/1.35 system-ui, sans-serif; color: #10241c; box-shadow: 0 4px 14px rgba(0,0,0,.18); display: grid; gap: 2px; pointer-events: none; }
.skog3d .s3-brattleg i { display: inline-block; width: 11px; height: 11px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; } .skog3d .s3-brattleg small { color: #43544b; margin-top: 2px; }
.skog3d .s3-knapper button[aria-pressed="true"] { background: #10241c; color: #fff; }
@media (pointer: coarse) { .skog3d .s3-brattleg { bottom: 200px; } }
@media (max-width: 760px) { .skog3d .s3-brattleg { top: auto; bottom: 230px; max-width: 220px; font-size: 11px; } }
@media (max-width: 760px) { .skog3d .s3-kart { bottom: 64px; width: 128px; } .skog3d .s3-kart canvas { width: 128px; height: 128px; } .skog3d .s3-kartinfo { font-size: 11px; } }
`;

export async function aapneVirtuellSkog({ S, b, inn, melding = () => {} }) {
  if (!document.getElementById('skog3d-stil')) { const st = document.createElement('style'); st.id = 'skog3d-stil'; st.textContent = STIL; document.head.appendChild(st); }
  const rot = document.createElement('div'); rot.className = 'skog3d';
  rot.innerHTML = `<div class="s3-laster">Bygger skogen …</div><div class="s3-hud" id="s3hud"></div>
    <div class="s3-knapper"><button type="button" class="vr" data-s3="vr" hidden>🥽 VR</button><button type="button" data-s3="bratt" aria-pressed="false" hidden title="Vis bratte områder som ikke kan drives med vanlige skogsmaskiner">⛰ Bratthet</button><button type="button" data-s3="vaer" aria-expanded="false">🌦 Vær</button><button type="button" data-s3="lukk">Lukk ✕</button></div>
    <div class="s3-vaer" hidden>
      <b>Vær i skogen</b>
      <div class="rad" data-gruppe="vaer">${Object.entries(VAER_VALG).map(([k, v]) => `<button type="button" data-vaer="${k}" aria-pressed="${k === 'av'}">${v.ikon} ${v.navn}</button>`).join('')}</div>
      <div class="rad" data-gruppe="tid">${Object.entries(TID_VALG).map(([k, v]) => `<button type="button" data-tid="${k}" aria-pressed="${k === 'naa'}">${v}</button>`).join('')}</div>
      <div class="rad"><button type="button" data-lyd aria-pressed="false">🔊 Lyd av regn og vind</button></div>
      <small data-vaerstatus>Dagens vær hentes fra MET (yr) for stedet, snødybden fra seNorge (NVE).</small>
    </div>
    <div class="s3-vaerinfo" hidden></div>
    <div class="s3-framtid" hidden><span>🌲 Ungskogpleie</span><button type="button" data-fs="naa" aria-pressed="true">I dag</button><button type="button" data-fs="merket" aria-pressed="false">✂️ Merket: hva fjernes</button><button type="button" data-fs="etter" aria-pressed="false">Etter pleie</button><button type="button" data-fs="pleid" aria-pressed="false">Hogstmoden med ungskogpleie</button><button type="button" data-fs="upleid" aria-pressed="false">Hogstmoden uten pleie</button></div>
    <div class="s3-kart" aria-label="Kart over hvor du står"><canvas width="384" height="384" title="Klikk: større eller mindre kart"></canvas><div class="s3-kartinfo"></div><div class="s3-kartknapper"><button type="button" data-kart="inn" title="Zoom inn">+</button><button type="button" data-kart="ut" title="Zoom ut">−</button><button type="button" data-kart="rot" title="Nord opp eller blikket opp">🧭</button></div></div>
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
  // Bratthet (bratthet.js): helning i høydenettet (ca. 12 m mellom punktene) – vises på bakken, i minikartet og i HUD.
  const bratt = z.length === n * n && z.filter(Number.isFinite).length > z.length * 0.8 ? { x0: -R, y0: -R, d: (2 * R) / (n - 1), nx: n, ny: n, pst: helningGrid(z, n, n, (2 * R) / (n - 1)) } : null;
  const helningHer = (x, y) => {
    if (!bratt) return null; const fx = (x - bratt.x0) / bratt.d; const fy = (y - bratt.y0) / bratt.d; const i = Math.floor(fx); const j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= n - 1 || j >= n - 1) return null; const u = fx - i; const v = fy - j; const p = (a, b2) => bratt.pst[b2 * n + a] ?? 0;
    return p(i, j) * (1 - u) * (1 - v) + p(i + 1, j) * u * (1 - v) + p(i, j + 1) * (1 - u) * v + p(i + 1, j + 1) * u * v;
  };
  const brattFarge = (pst) => { const k = bratthetKlasse(pst); return k?.farge || null; };
  const harBratt = !!bratt && bratt.pst.some((v) => v >= 33);
  omg.radius = R;
  vis('Bygger skogen …');
  const hinder = lagHinder(omg);
  // Trærne: planens bestand + skog utenfor planen (AR5), ikke på veier, i vann eller ved bygninger (stier får 1 m klaring).
  const alleBestand = { ...S, bestand: [...S.bestand, ...naboBestand(omg)] }; const fri = (x, y) => !hinder(x, y);
  const skog = lagSkog(alleBestand, { start, inn, radius: R, fri });
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
  const halvkule = new THREE.HemisphereLight(0xeaf4ff, 0x5d6b3a, 1.7); scene.add(halvkule); const omgivelse = new THREE.AmbientLight(0xffffff, 0.35); scene.add(omgivelse);
  const sol = new THREE.DirectionalLight(0xfff2d8, 1.3); sol.position.set(-60, 120, 40); scene.add(sol);
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2000);
  const dolly = new THREE.Group(); dolly.add(camera); scene.add(dolly);
  // Koordinater: x = øst, z = −nord, y = opp.
  const tilScene = (x, y) => [x, hoyde(x, y), -y];

  // Bakke med høydedata og litt fargevariasjon
  const vegCache = new Map(); const vegFor = (s) => { if (s.profil) return s.profil; if (!vegCache.has(s.b.id)) vegCache.set(s.b.id, vegProfil(s.b, { inn })); return vegCache.get(s.b.id); };
  const seg = Math.min(150, Math.max(80, Math.round(R / 1.8))); const bakke = new THREE.PlaneGeometry(2 * R, 2 * R, seg, seg); bakke.rotateX(-Math.PI / 2);
  const pos = bakke.attributes.position; const farger = new Float32Array(pos.count * 3); const brattFarger = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i); const y = -pos.getZ(i); pos.setY(i, hoyde(x, y));
    const v = 0.85 + ((Math.sin(x * 0.37) * Math.cos(y * 0.29) + 1) / 2) * 0.25;
    const iSkog = finnFlate(x, y);
    // Bunnsjiktet etter vegetasjonstypen (lav, lyng, mose, torv …) eller markslaget; hogstflater litt lysere og mer gulgrønne
    let [r, g, bl] = iSkog ? (iSkog.profil || vegFor(iSkog)).bakke : [0.45, 0.5, 0.3];
    if (hinder(x, y) === 'vann') [r, g, bl] = [0.25, 0.22, 0.16];
    if (iSkog?.hk === 1) [r, g, bl] = [r * 0.6 + 0.55 * 0.4, g * 0.6 + 0.52 * 0.4, bl * 0.6 + 0.3 * 0.4];
    farger.set([r * v, g * v, bl * v], i * 3);
    // Bratte områder farges etter drivbarhet (gult = krevende, oransje = spesialdrift, rødt = vinsj/taubane, lilla = bare taubane)
    const fb = brattFarge(helningHer(x, y));
    if (fb) { const c = new THREE.Color(fb); brattFarger.set([r * v * 0.35 + c.r * 0.65, g * v * 0.35 + c.g * 0.65, bl * v * 0.35 + c.b * 0.65], i * 3); } else brattFarger.set([r * v, g * v, bl * v], i * 3);
  }
  let visBratt = harBratt;
  bakke.setAttribute('color', new THREE.BufferAttribute(visBratt ? brattFarger : farger, 3)); bakke.computeVertexNormals();
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
  const treData = (traer) => traer.map((t) => { const [x, y, z] = tilScene(t.x, t.y); return { x, y, z, h: t.h, kroneStart: t.kroneStart, kroneBredde: t.kroneBredde, art: t.art, tykkelse: t.tykkelse, merke: t.merke }; });
  let treLag = lagTreLag(THREE, scene, treData(skog.traer));
  treLag.oppdater(0, 0, { tvang: true });
  // Bakkevegetasjon (feltsjiktet) rundt deg ut fra vegetasjonstypen (skog3d-bunn.js)
  let bunnLag = lagBunnLag(THREE, scene, flater, { hoyde, inn, grense: R, hinder });
  // Vær (skog3d-vaer.js og skog3d-vaerlag.js): dagens vær fra MET og snødybde fra seNorge, eller faste værtyper.
  const vaerLag = lagVaerLag(THREE, scene, { halvkule, omgivelse, sol, bakke, bunnLag: () => bunnLag });
  bunnLag.oppdater(0, 0, { tvang: true });

  // ---------- bevegelse ----------
  const startX = 0; const startY = 0; dolly.position.set(startX, hoyde(startX, startY), -startY);
  camera.position.set(0, OYEHOYDE, 0);
  let yaw = 0; let pitch = 0; const taster = new Set(); let stikke = null; let se = null;
  const lerret = renderer.domElement;
  const tast = (e, ned) => { if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) { if (ned) taster.add(e.code); else taster.delete(e.code); e.preventDefault(); } if (ned && e.code === 'Escape' && !document.pointerLockElement) lukk(); if (ned && e.code === 'KeyF' && !e.repeat) nesteFramtid(); if (ned && e.code === 'KeyV' && !e.repeat) nesteVaer(); };
  const ned = (e) => tast(e, true); const opp = (e) => tast(e, false);
  const mus = (e) => { if (document.pointerLockElement !== lerret) return; yaw -= e.movementX * 0.0025; pitch = Math.max(-1.3, Math.min(1.3, pitch - e.movementY * 0.0025)); };
  window.addEventListener('keydown', ned); window.addEventListener('keyup', opp); document.addEventListener('mousemove', mus);
  lerret.addEventListener('click', () => { if (!renderer.xr.isPresenting) lerret.requestPointerLock?.(); });
  // Berøring: venstre halvdel = gå (virtuell stikke), høyre = se rundt
  lerret.addEventListener('touchstart', (e) => { for (const t of e.changedTouches) { if (t.clientX < window.innerWidth / 2 && !stikke) stikke = { id: t.identifier, x0: t.clientX, y0: t.clientY, dx: 0, dy: 0 }; else if (!se) se = { id: t.identifier, x: t.clientX, y: t.clientY }; } }, { passive: true });
  lerret.addEventListener('touchmove', (e) => { for (const t of e.changedTouches) { if (stikke?.id === t.identifier) { stikke.dx = Math.max(-1, Math.min(1, (t.clientX - stikke.x0) / 50)); stikke.dy = Math.max(-1, Math.min(1, (t.clientY - stikke.y0) / 50)); } if (se?.id === t.identifier) { yaw -= (t.clientX - se.x) * 0.005; pitch = Math.max(-1.3, Math.min(1.3, pitch - (t.clientY - se.y) * 0.005)); se.x = t.clientX; se.y = t.clientY; } } }, { passive: true });
  lerret.addEventListener('touchend', (e) => { for (const t of e.changedTouches) { if (stikke?.id === t.identifier) stikke = null; if (se?.id === t.identifier) se = null; } });

  const hud = rot.querySelector('#s3hud'); let hudBid = null; let hudTid = 0; let herBid = null; let sistBratt = null;

  // ---------- framtidsskog for ungskog (HK II): hogstmoden med og uten ungskogpleie ----------
  const vInn = { ...STANDARD_VERDI, ...(S.verdi || {}) }; const IAAR = new Date().getFullYear();
  const ungIder = new Set(planBestand.filter((x) => x.hk === 2).map((x) => x.b.id));
  let framtid = null; // { bid, scenario, f }
  const fsPanel = rot.querySelector('.s3-framtid');
  const kr = (v) => `${Math.round(v).toLocaleString('nb-NO')} kr`; const komma = (v, d = 1) => String(Math.round(v * 10 ** d) / 10 ** d).replace('.', ',');
  const INSTRUKS = ['merket', 'etter'];
  const lagScenario = (b2, scenario) => (INSTRUKS.includes(scenario) ? ungskogpleieVisning(b2, scenario, { inn, iAar: IAAR }) : framtidsskog(b2, scenario, { inn, vInn, iAar: IAAR }));
  const TRESLAG_NAVN = { G: 'gran', F: 'furu', L: 'lauv' };
  // Arbeidsinstruksen: før/etter, hva som beholdes og fjernes, og merkingen i scenen.
  function instruksHud(b2) {
    const f = framtid.f; const hs = TRESLAG_NAVN[f.treslag === 'L' ? 'G' : f.treslag] || 'gran';
    const tittel = f.scenario === 'merket' ? '✂️ før ungskogpleie – merket' : '✂️ rett etter ungskogpleie';
    return `<b>Bestand ${b2.nr} · ${tittel}</b>
      <small>Før: ca. ${f.treantallFor} trær/daa – ${hs} og lauv, høyde ca. ${komma(f.hoydeBar)} m · Etter: ${f.treantall} trær/daa – ${hs} prioriteres, ca. ${komma(f.avstand)} m mellom trærne</small>
      ${f.scenario === 'merket' ? `<small class="s3-merker"><span><i style="background:#3fae5a"></i>framtidstrær beholdes</span><span><i style="background:#d9533a"></i>lauv, kratt og overtallige trær fjernes</span><span><i style="background:#e0a52a"></i>ROS-trær (rogn, osp, selje) beholdes</span></small>`
        : `<small>Fjernet ca. ${f.fjernet} trær/daa og ${f.kratt} busker/daa · ${f.ros} ROS-trær/daa beholdt${f.lauvBeholdt ? ` · ${f.lauvBeholdt} lauvtrær/daa beholdt for å nå målet` : ''} · stubbene står igjen, hogstavfallet ligger ryddig i terrenget</small>`}
      <small>${f.areal ? `Areal ${komma(f.areal, 2)} daa · ` : ''}start ${f.startAar} · ca. ${kr(f.kostDaa)}/daa${f.areal ? ` (${kr(f.kostDaa * f.areal)})` : ''}${f.pleid ? ' · bestandet er allerede pleiet – viser tilstanden før' : ''}</small>
      <small>Arbeid systematisk · velg de beste trærne – rett tre på rett plass · unngå skader på framtidstrærne</small>`;
  }
  function framtidHud(b2) {
    const f = framtid.f; if (INSTRUKS.includes(f.scenario)) return instruksHud(b2); const andre = framtidsskog(b2, f.scenario === 'pleid' ? 'upleid' : 'pleid', { inn, vInn, iAar: IAAR });
    const med = f.scenario === 'pleid' ? f : andre; const uten = f.scenario === 'pleid' ? andre : f;
    return `<b>Bestand ${b2.nr} · 🔮 hogstmoden ${f.hogstAar}</b> · ${f.scenario === 'pleid' ? 'med ungskogpleie nå' : 'uten ungskogpleie'}
      <small>${f.treantall} trær/daa · ${komma(f.hoyde)} m · ${Math.round(f.volum)} m³/daa · ${Math.round(f.pris)} kr/m³ · nåverdi ${kr(f.nv)}/daa</small>
      <small>${f.scenario === 'pleid' ? `Uten pleie: hogst ${uten.hogstAar}, ${Math.round(uten.volum)} m³/daa, ${kr(uten.nv)}/daa` : `Med pleie nå: hogst ${med.hogstAar}, ${Math.round(med.volum)} m³/daa, ${kr(med.nv)}/daa`} · forskjell ${kr(med.nv - uten.nv)}/daa${b2.areal ? ` (${kr((med.nv - uten.nv) * b2.areal)} for ${komma(b2.areal)} daa)` : ''}</small>
      <small>${f.scenario === 'pleid' ? 'Grove, stabile bartrær med lange kroner og ca. 10 % lauv.' : 'Tett, lauvrik skog med tynne trær, korte kroner og undertrykte trær – mer massevirke og høyere risiko for snøbrekk.'}</small>`;
  }
  function visFramtidValg() {
    const vis = !!framtid || ungIder.has(herBid);
    fsPanel.hidden = !vis;
    for (const k of fsPanel.querySelectorAll('[data-fs]')) k.setAttribute('aria-pressed', String((framtid?.scenario || 'naa') === k.dataset.fs));
    if (ungIder.has(herBid) && !framtid) vrTavle(['Ungskog (HK II)', 'A: ungskogpleie og framtidsskog']);
  }
  function settFramtid(scenario) {
    const bid = scenario === 'naa' ? null : (ungIder.has(herBid) ? herBid : framtid?.bid);
    if (scenario !== 'naa' && !bid) return;
    const s2 = bid && planBestand.find((x) => x.b.id === bid);
    framtid = s2 ? { bid, scenario, f: lagScenario(s2.b, scenario) } : null;
    const ny = lagSkog(alleBestand, { start, inn, radius: R, maks: MAKS_TRAER * 1.5, fri, overstyr: framtid ? { [bid]: framtid.f } : {} });
    treLag.dispose(); treLag = lagTreLag(THREE, scene, treData(ny.traer)); treLag.oppdater(dolly.position.x, dolly.position.z, { tvang: true, avstand: renderer.xr.isPresenting ? 45 : 60 });
    // Bakkevegetasjonen etter lyset i framtidsskogen
    const fl = flater.map((x) => (framtid && x.b?.id === framtid.bid ? { ...x, profil: vegProfil({ ...x.b, alder: framtid.f.alder, hogstklasse: framtid.f.hk, treantall: framtid.f.scenario === 'merket' ? framtid.f.treantallFor : framtid.f.treantall, ungskog: null }, { inn }) } : x));
    bunnLag.dispose(); bunnLag = lagBunnLag(THREE, scene, fl, { hoyde, inn, grense: R, hinder }); bunnLag.oppdater(dolly.position.x, -dolly.position.z, { tvang: true, radius: renderer.xr.isPresenting ? 25 : 35 }); vaerLag.paaNytt();
    hudBid = null; oppdaterHud(dolly.position.x, -dolly.position.z); visFramtidValg();
    const f = framtid?.f;
    const tavle = !f ? ['I dag', 'A: ungskogpleie og framtidsskog']
      : scenario === 'merket' ? ['Merket: rødt fjernes', `Grønt beholdes · gult = ROS-trær · ${f.treantallFor} → ${f.treantall}/daa`, 'A: neste · B: i dag']
        : scenario === 'etter' ? [`Etter pleie: ${f.treantall} trær/daa`, `ca. ${komma(f.avstand)} m mellom trærne · stubbene står igjen`, 'A: neste · B: i dag']
          : [`Hogstmoden ${f.hogstAar} – ${scenario === 'pleid' ? 'med pleie' : 'uten pleie'}`, `${Math.round(f.volum)} m³/daa · nåverdi ${kr(f.nv)}/daa`, 'A: neste · B: i dag'];
    vrTavle(tavle);
  }
  const SCEN = ['naa', 'merket', 'etter', 'pleid', 'upleid'];
  const nesteFramtid = () => { if (!framtid && !ungIder.has(herBid)) return; settFramtid(SCEN[(SCEN.indexOf(framtid?.scenario || 'naa') + 1) % SCEN.length]); };
  for (const k of fsPanel.querySelectorAll('[data-fs]')) k.onclick = (e) => { e.stopPropagation(); settFramtid(k.dataset.fs); };

  // Tavle i VR (HTML-en vises ikke i brillene): tekst foran deg i noen sekunder.
  const tavleLerret = document.createElement('canvas'); tavleLerret.width = 768; tavleLerret.height = 220;
  const tavleTekstur = new THREE.CanvasTexture(tavleLerret);
  const tavle = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.18), new THREE.MeshBasicMaterial({ map: tavleTekstur, transparent: true, depthTest: false }));
  tavle.position.set(0, -0.18, -0.8); tavle.renderOrder = 999; tavle.visible = false; camera.add(tavle); let tavleTil = 0;
  function vrTavle(linjer, sek = 6) {
    const c = tavleLerret.getContext('2d'); if (!c) return;
    c.clearRect(0, 0, 768, 220); c.fillStyle = 'rgba(16,36,28,.86)'; c.beginPath(); c.roundRect?.(0, 0, 768, 220, 28); c.fill();
    c.fillStyle = '#f1f6f2'; linjer.slice(0, 3).forEach((l, i) => { c.font = `${i === 0 ? 700 : 500} ${i === 0 ? 46 : 36}px system-ui, sans-serif`; c.fillText(l, 30, 66 + i * 62, 708); });
    tavleTekstur.needsUpdate = true; tavle.visible = renderer.xr.isPresenting; tavleTil = performance.now() + sek * 1000;
  }

  // ---------- minikart (skog3d-kart.js) ----------
  // Planens bestand, veier, stier, bekker og vann. Pil = blikkretning, grønn strek = retningen du går, blått spor = der du har gått.
  const minikart = lagMinikart({ bestand: planBestand.map((s) => ({ id: s.b.id, nr: String(s.b.nr ?? ''), mp: s.mp })), veier: omg.veier, bekker: omg.bekker, vann: omg.innsjoer, bratthet: bratt, farge: (p) => (visBratt ? brattFarge(p) : null) });
  const spor = lagSpor(); const kartRot = rot.querySelector('.s3-kart'); const kartLerret = kartRot.querySelector('canvas'); const kartCtx = kartLerret.getContext('2d'); const kartInfo = kartRot.querySelector('.s3-kartinfo');
  const ZOOM = [40, 80, 160, 320]; let zoom = 1; let nordOpp = true; let kartTid = 0; let kartTekst = ''; let vrKart = true; let knappVS = false; let knappHS = false;
  const kartTekstur = new THREE.CanvasTexture(kartLerret);
  const vrKartFlate = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: kartTekstur, transparent: true, depthTest: false }));
  vrKartFlate.position.set(-0.2, -0.16, -0.5); vrKartFlate.rotation.set(0.35, 0.3, 0); vrKartFlate.renderOrder = 998; vrKartFlate.visible = false; camera.add(vrKartFlate);
  const blikk = new THREE.Vector3();
  function tegnKart(x, y) {
    camera.getWorldDirection(blikk); const retning = retningGrader(blikk.x, -blikk.z);
    spor.legg(x, y); const bevegelse = spor.bevegelse(x, y); const vr = renderer.xr.isPresenting;
    minikart.tegn(kartCtx, { x, y, retning, bevegelse, spor: spor.punkter, herBid, radius: ZOOM[zoom], storrelse: 384, nordOpp, vr });
    if (vr) kartTekstur.needsUpdate = true; vrKartFlate.visible = vr && vrKart;
    const tekst = `Ser <b>${kompassTekst(retning)}</b>${bevegelse != null ? ` · går <i>${kompassTekst(bevegelse)}</i>` : ''}`;
    if (tekst !== kartTekst) { kartTekst = tekst; kartInfo.innerHTML = tekst; }
  }
  kartRot.addEventListener('click', (e) => {
    e.stopPropagation(); const k = e.target.closest('[data-kart]')?.dataset.kart;
    if (k === 'inn') zoom = Math.max(0, zoom - 1); else if (k === 'ut') zoom = Math.min(ZOOM.length - 1, zoom + 1); else if (k === 'rot') nordOpp = !nordOpp; else if (e.target === kartLerret) kartRot.classList.toggle('liten');
    kartTid = 0;
  });

  const NAER = (x, y) => { const h = hinder(x, y); if (h === 'vei' || h === 'sti') { let best = null; let bd = 8; for (const v of omg.veier) for (let i = 0; i < v.linje.length - 1; i++) { const [x0, y0] = v.linje[i]; const [x1, y1] = v.linje[i + 1]; const dx = x1 - x0; const dy = y1 - y0; const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1))); const d = Math.hypot(x - x0 - t * dx, y - y0 - t * dy); if (d < bd) { bd = d; best = v; } } return best ? `🛤️ ${best.navn}${best.kilde ? ` (${best.kilde})` : ''}` : ''; } return h === 'vann' ? '💧 Vann/bekk' : h === 'bygg' ? '🏠 Ved bygning' : ''; };
  function oppdaterHud(x, y) {
    const s = finnFlate(x, y); const hp = helningHer(x, y); const bk = bratthetKlasse(hp);
    const ekstra = [NAER(x, y), hp != null && (visBratt || hp >= 33) ? `⛰ ${bratthetTekst(hp)}` : ''].filter(Boolean).join('<br>');
    const bid = `${s?.b?.id || s?.id || '-'}|${ekstra}|${framtid?.scenario || ''}`;
    // I VR: tavle når du går inn i et område som ikke kan drives med vanlige maskiner
    if (bk && bk.id !== sistBratt) { if (!bk.drivbar && renderer.xr.isPresenting) vrTavle([`⛰ ${bk.kort}: ${Math.round(hp)} % (${Math.round(Math.atan(hp / 100) * 57.3)}°)`, bk.navn.replace(/^[^–]*– /, '')], 5); sistBratt = bk.id; }
    const nyttBestand = (s?.b?.id || null) !== herBid; herBid = s?.b?.id || null; if (nyttBestand) visFramtidValg();
    if (bid === hudBid) return; hudBid = bid;
    const ek = ekstra ? `<small>${ekstra}</small>` : '';
    if (!s) { hud.innerHTML = `<b>Utenfor bestand</b><small>Gå inn i et bestand for å se dataene.</small>${ek}`; return; }
    if (!s.b) { hud.innerHTML = `<b>${MARKSLAG[s.kategori]?.navn || s.kategori}</b><small>AR5: ${s.beskrivelse || ''}</small><small>🌿 ${s.profil.navn}</small>${ek}`; return; }
    if (s.b.nabo) { hud.innerHTML = `<b>${s.b.ar5Kategori === 'produktiv' ? 'Skog utenfor planen' : MARKSLAG[s.b.ar5Kategori]?.navn || 'Utenfor planen'}</b><small>AR5: ${s.b.ar5Beskrivelse || ''} · trærne er et generelt anslag</small>${ek}`; return; }
    if (framtid && s.b.id === framtid.bid) { hud.innerHTML = framtidHud(s.b) + ek; return; }
    const x2 = s.b; const st = startTilstand(x2); const mh = middelhoyde(x2, { inn }).verdi; const N = erUngskog(x2, inn) ? ungskogData(x2, { inn }).treantallFor.verdi : x2.treantall; const vg = vegFor(s);
    hud.innerHTML = `<b>Bestand ${x2.nr}</b> · ${TRESLAG[x2.treslag] || ''} ${x2.treslag || ''}${x2.bonitet ?? ''} · HK ${hkTekst(x2, { inn }) || HK_ROMERTALL[s.hk] || ''}
      <small>${s.beskrivelse} · ${Math.round(st.alder)} år${mh ? ` · ${String(Math.round(mh * 10) / 10).replace('.', ',')} m` : ''}${N ? ` · ${Math.round(N)} trær/daa` : ''} · ${Math.round(st.volumDaa)} m³/daa</small>
      <small>🌿 ${vg.kode} ${vg.navn}${vg.anslaatt ? ' (anslått)' : ''} – ${vg.beskrivelse}</small>${ek}`;
  }

  // VR: venstre stikke går (i blikkretningen), høyre stikke snur 30°.
  let snudd = false; let knappA = false; let knappB = false; let knappX = false; let knappY = false;
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
      if (kilde.handedness === 'left') {
        // X = neste værtype, Y = neste tid på døgnet
        const x = !!gp.buttons[4]?.pressed; const yk = !!gp.buttons[5]?.pressed;
        if (x && !knappX) nesteVaer(); if (yk && !knappY) nesteTid(); knappX = x; knappY = yk;
        // Trykk på venstre stikke = vis eller skjul kartet
        const vs = !!gp.buttons[3]?.pressed; if (vs && !knappVS) { vrKart = !vrKart; kartTid = 0; } knappVS = vs;
      }
      if (kilde.handedness === 'right') {
        if (Math.abs(ax) > 0.7 && !snudd) { dolly.rotation.y -= Math.sign(ax) * (Math.PI / 6); snudd = true; } if (Math.abs(ax) < 0.3) snudd = false;
        // A = neste framtidsskog, B = tilbake til i dag
        const a = !!gp.buttons[4]?.pressed; const bk = !!gp.buttons[5]?.pressed;
        if (a && !knappA) nesteFramtid(); if (bk && !knappB && framtid) settFramtid('naa'); knappA = a; knappB = bk;
        // Trykk på høyre stikke = zoom i kartet
        const hs = !!gp.buttons[3]?.pressed; if (hs && !knappHS) { zoom = (zoom + 1) % ZOOM.length; kartTid = 0; } knappHS = hs;
      }
    }
  }

  let sist = performance.now(); const kameraPos = new THREE.Vector3();
  renderer.setAnimationLoop((t) => {
    const dt = Math.min(0.1, (t - sist) / 1000); sist = t;
    const forrige = [dolly.position.x, dolly.position.z];
    if (tavle.visible && performance.now() > tavleTil) tavle.visible = false;
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
    if (t - kartTid > 100) { kartTid = t; tegnKart(x, y); }
    camera.getWorldPosition(kameraPos); vaerLag.oppdater(dt, [kameraPos.x, kameraPos.y, kameraPos.z]);
    renderer.render(scene, camera);
  });
  laster?.remove();
  const a = omgLag.antall; const deler = [a.veier && `${a.veier} vei/sti`, a.bygg && `${a.bygg} bygg`, (a.bekker || a.innsjoer) && `${a.bekker + a.innsjoer} vann/bekk`, omg.ar5.length && 'markslag', a.grensemerker && 'eiendomsgrense'].filter(Boolean);
  rot.querySelector('.s3-hjelp').textContent = `${skog.traer.length.toLocaleString('nb-NO')} trær i ${planBestand.length} bestand innenfor ${Math.round(R)} m${deler.length ? ` · ${deler.join(', ')}` : ''} · Klikk og se med musa · W A S D / piltaster · Shift for å løpe · V: vær${ungIder.size ? ' · F: ungskogpleie og framtidsskog' : ''}${matchMedia('(pointer: coarse)').matches ? ' · Venstre halvdel: gå · høyre: se rundt' : ''}`;

  // ---------- vær ----------
  const [vLon, vLat] = utmTilGeo(skog.senter[0], skog.senter[1], 33);
  const vaerPanel = rot.querySelector('.s3-vaer'); const vaerInfo = rot.querySelector('.s3-vaerinfo'); const vaerStatus = rot.querySelector('[data-vaerstatus]');
  let vaerValg = 'av'; let tidValg = 'naa'; let dagensVaer = null; let lydValgt = false;
  const hentDagens = () => (dagensVaer ||= hentVaer(skog.senter, { nveBase: `${SERVER_API}/api/nve` }).catch(() => null));
  hentDagens(); // hentes i bakgrunnen, så valget går raskt
  async function settVaer(valg = vaerValg, tid = tidValg) {
    vaerValg = valg; tidValg = tid;
    for (const k of rot.querySelectorAll('[data-vaer]')) k.setAttribute('aria-pressed', String(k.dataset.vaer === valg));
    for (const k of rot.querySelectorAll('[data-tid]')) k.setAttribute('aria-pressed', String(k.dataset.tid === tid));
    if (valg === 'av') { vaerLag.nullstill(); vaerInfo.hidden = true; vaerStatus.textContent = 'Standard lys og klart vær.'; vrTavle(['Vær: standard', 'X: neste vær · Y: tid på døgnet']); return; }
    const tidspunkt = tidFor(tid, vLat, vLon);
    let v;
    if (valg === 'dagens') {
      vaerStatus.textContent = 'Henter dagens vær fra MET …';
      const d = await hentDagens();
      if (vaerValg !== valg || tidValg !== tid) return; // brukeren har valgt noe annet i mellomtiden
      if (!d?.raa) { vaerStatus.textContent = 'Fikk ikke kontakt med MET – viser overskyet vær i stedet.'; v = forhandsvaer('overskyet'); } else v = { ...tolkMet(d.raa, tidspunkt), snodybde: d.snodybde };
    } else v = forhandsvaer(valg);
    const sol = solposisjon(tidspunkt, vLat, vLon);
    const sc = vaerScene(v, sol, { R }); vaerLag.sett(sc);
    if (!lydValgt && valg !== 'av') { lydValgt = true; settLyd(true); } // første gang: slå på lyden (valget er et trykk)
    const tekst = `${VAER_VALG[valg].ikon} ${valg === 'dagens' ? `MET ${new Date(v.tid || tidspunkt).toLocaleString('nb-NO', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}: ` : `${VAER_VALG[valg].navn}: `}${vaerTekst(v)} · ${sol.hoyde > 0 ? `sola ${Math.round(sol.hoyde)}° over horisonten` : sol.hoyde > -6 ? 'skumring' : 'natt – sola er under horisonten'}`;
    vaerInfo.textContent = tekst; vaerInfo.hidden = false;
    vaerStatus.textContent = valg === 'dagens' ? `Kilde: MET Locationforecast (yr) for ${vLat.toFixed(3)} N, ${vLon.toFixed(3)} Ø${v.snodybde != null ? ', snødybde fra seNorge (NVE)' : ''}. ${TID_VALG[tid]}.` : `${TID_VALG[tid]} · fast værtype`;
    vrTavle([`${VAER_VALG[valg].ikon} ${VAER_VALG[valg].navn} · ${TID_VALG[tid]}`, vaerTekst(v), 'X: neste vær · Y: tid på døgnet']);
  }
  function settLyd(paa) { const p = vaerLag.lyd(paa); rot.querySelector('[data-lyd]').setAttribute('aria-pressed', String(p)); }
  const VAER_REKKE = Object.keys(VAER_VALG); const TID_REKKE = Object.keys(TID_VALG);
  const nesteVaer = () => settVaer(VAER_REKKE[(VAER_REKKE.indexOf(vaerValg) + 1) % VAER_REKKE.length], tidValg);
  const nesteTid = () => settVaer(vaerValg === 'av' ? 'dagens' : vaerValg, TID_REKKE[(TID_REKKE.indexOf(tidValg) + 1) % TID_REKKE.length]);
  // Bratthet av/på (bakke, minikart og HUD), med tegnforklaring
  const brattKnapp = rot.querySelector('[data-s3="bratt"]'); const brattLeg = document.createElement('div'); brattLeg.className = 's3-brattleg';
  brattLeg.innerHTML = `<b>⛰ Bratthet og drift</b>${BRATT_KLASSER.slice(1).map((k) => `<span><i style="background:${k.farge}"></i>${k.navn}</span>`).join('')}<small>Fra Kartverkets høydedata. Grenser: NIBIO (Skogsmaskiner i stroppen, 2024).</small>`;
  rot.appendChild(brattLeg);
  const settBratt = (paa) => { visBratt = paa; bakke.setAttribute('color', new THREE.BufferAttribute(paa ? brattFarger : farger, 3)); brattKnapp.setAttribute('aria-pressed', String(paa)); brattLeg.hidden = !paa; hudBid = null; kartTid = 0; };
  if (bratt) { brattKnapp.hidden = false; settBratt(visBratt); }
  brattKnapp.onclick = (e) => { e.stopPropagation(); settBratt(!visBratt); };
  rot.querySelector('[data-s3="vaer"]').onclick = (e) => { e.stopPropagation(); vaerPanel.hidden = !vaerPanel.hidden; e.currentTarget.setAttribute('aria-expanded', String(!vaerPanel.hidden)); };
  vaerPanel.addEventListener('click', (e) => {
    e.stopPropagation();
    const v = e.target.closest('[data-vaer]'); if (v) { settVaer(v.dataset.vaer, tidValg); return; }
    const t = e.target.closest('[data-tid]'); if (t) { settVaer(vaerValg === 'av' ? 'dagens' : vaerValg, t.dataset.tid); return; }
    if (e.target.closest('[data-lyd]')) { lydValgt = true; settLyd(!vaerLag.harLyd()); }
  });

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
    treLag.dispose(); bunnLag.dispose(); omgLag.dispose(); tavleTekstur.dispose(); vaerLag.dispose(); scene.traverse((o) => { o.material?.dispose?.(); }); bakke.dispose(); renderer.dispose(); rot.remove();
  }
  rot.querySelector('[data-s3="lukk"]').onclick = lukk;
  const api = { lukk, framtid: (sc) => settFramtid(sc), vaer: (valg, tid) => settVaer(valg, tid), vaerData: () => ({ valg: vaerValg, tid: tidValg, scene: vaerLag.aktiv(), partikler: vaerLag.antallPartikler(), lyd: vaerLag.harLyd() }), gaaTil: (x2, y2, retning = yaw) => { dolly.position.set(x2, hoyde(x2, y2), -y2); yaw = retning; }, omg: () => omg, antall: skog.traer.length, planter: () => bunnLag.perType(), omgivelser: () => ({ ...omgLag.antall, ar5: omg.ar5.length, status: omg.status }), radius: R, posisjon: () => ({ x: dolly.position.x, y: -dolly.position.z }), hud: () => hud.textContent, kart: () => kartInfo.textContent };
  rot.skog3d = api; // for feilsøking og tester
  return api;
}
