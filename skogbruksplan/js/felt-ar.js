// AR i SkogIQ Felt (beta): se bestandsgrenser, eiendomsgrense, stier og veier, miljøinformasjon og kulturminner
// lagt over virkeligheten mens du går rundt.
//   Telefon/nettbrett: kamerabildet bak, retning fra kompass/gyro og posisjon fra GPS (iPhone og Android).
//   Briller: WebXR «immersive-ar» (Meta Quest 3/3S med gjennomsyn, Android med ARCore). Brillene sporer bevegelsen
//   selv; GPS (når den finnes) holder grensene på plass over lengre avstander, og retningen kan finjusteres.
// Three.js lastes fra unpkg (bufres av service workeren for bruk uten nett). Data: ar-data.js.
import { arInnhold, hvorEr, naermeste, varsler, glattVinkel, AR_LAG, tilLokal } from './ar-data.js';
import { geoTilUtm, utmTilGeo } from './proj.js';

const THREE_URL = 'https://unpkg.com/three@0.160.0/build/three.module.js';
const OYE = 1.6; const R = 500; const DEKLINASJON = 4; // misvisning i Norge (grader øst), finjusteres med ◀ ▶
const STIL = `
.ar { position: fixed; inset: 0; z-index: 4000; background: #000; color: #fff; font: 14px/1.35 'Schibsted Grotesk', system-ui, sans-serif; touch-action: none; overflow: hidden; }
.ar video, .ar canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.ar .ar-topp { position: absolute; left: 10px; right: 10px; top: max(10px, env(safe-area-inset-top)); display: flex; gap: 8px; align-items: flex-start; pointer-events: none; }
.ar .ar-hud { flex: 1; background: rgba(10,24,18,.72); backdrop-filter: blur(6px); border-radius: 14px; padding: 9px 12px; min-width: 0; }
.ar .ar-hud b { font-size: 15px; } .ar .ar-hud small { display: block; color: #cfe3d8; }
.ar .ar-hud .naer { margin-top: 4px; display: grid; gap: 1px; font-size: 13px; }
.ar button { pointer-events: auto; border: 0; border-radius: 12px; padding: 10px 13px; font: 700 14px/1 'Schibsted Grotesk', system-ui, sans-serif; background: rgba(251,252,250,.94); color: #10241c; cursor: pointer; }
.ar .ar-varsel { position: absolute; left: 10px; right: 10px; top: 46%; background: #ff9500; color: #1a1000; border-radius: 14px; padding: 10px 14px; font-weight: 700; text-align: center; pointer-events: none; }
.ar .ar-varsel.stopp { background: #ff3b30; color: #fff; }
.ar .ar-kompass { position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(118px + env(safe-area-inset-bottom)); background: rgba(10,24,18,.72); border-radius: 10px; padding: 4px 10px; font-weight: 700; pointer-events: none; }
.ar .ar-bunn { position: absolute; left: 0; right: 0; bottom: 0; padding: 8px 10px max(10px, env(safe-area-inset-bottom)); display: grid; gap: 8px; background: linear-gradient(transparent, rgba(0,0,0,.55)); }
.ar .ar-lag { display: flex; gap: 6px; overflow-x: auto; }
.ar .ar-lag button { white-space: nowrap; padding: 8px 11px; font-size: 13px; background: rgba(10,24,18,.72); color: #fff; border: 1.5px solid rgba(255,255,255,.35); }
.ar .ar-lag button[aria-pressed="true"] { background: #fbfcfa; color: #10241c; border-color: #fbfcfa; }
.ar .ar-rad { display: flex; gap: 6px; align-items: center; justify-content: space-between; }
.ar .ar-rad .juster { display: flex; gap: 6px; align-items: center; color: #e6f1ea; font-size: 12px; }
.ar .ar-rad .xr { background: #7b2ff7; color: #fff; }
.ar .ar-start { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; padding: 24px; background: rgba(10,24,18,.92); font-size: 16px; }
.ar .ar-start p { max-width: 420px; color: #cfe3d8; }
`;

// tillatelse: løftet fra DeviceOrientationEvent.requestPermission(), startet direkte i trykket (iPhone krever det).
export function beOmKompass() { try { return typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function' ? DeviceOrientationEvent.requestPermission() : null; } catch { return null; } }

export async function aapneAR({ P, melding = () => {}, startPos = null, tillatelse = null }) {
  if (!document.getElementById('ar-stil')) { const st = document.createElement('style'); st.id = 'ar-stil'; st.textContent = STIL; document.head.appendChild(st); }
  // Kompass på iPhone krever tillatelse fra et trykk – spør før noe annet venter.
  let orientTillatt = true;
  try { const t = tillatelse || beOmKompass(); if (t) orientTillatt = (await t) === 'granted'; } catch { orientTillatt = false; }

  const rot = document.createElement('div'); rot.className = 'ar';
  rot.innerHTML = `<video playsinline muted autoplay></video>
    <div class="ar-topp"><div class="ar-hud" id="arHud"><b>Starter AR …</b><small>Venter på posisjon</small></div><button type="button" data-ar="lukk">Lukk ✕</button></div>
    <div class="ar-varsel" hidden></div>
    <div class="ar-kompass" id="arKompass">–</div>
    <div class="ar-bunn">
      <div class="ar-lag">${Object.entries(AR_LAG).map(([k, n]) => `<button type="button" data-lag="${k}" aria-pressed="true">${n}</button>`).join('')}</div>
      <div class="ar-rad"><div class="juster"><button type="button" data-ar="venstre" aria-label="Drei grensene mot venstre">◀</button><span id="arJuster">Retning 0°</span><button type="button" data-ar="hoyre" aria-label="Drei grensene mot høyre">▶</button></div><button type="button" class="xr" data-ar="xr" hidden>🥽 Briller</button></div>
    </div>
    <div class="ar-start" id="arStart"><div><b>AR – grenser og miljø i terrenget</b><p>Henter posisjon${orientTillatt ? '' : '. Kompasset er ikke tillatt – retningen må justeres med ◀ ▶'} …</p></div></div>`;
  document.body.appendChild(rot);
  const $ = (s) => rot.querySelector(s); const video = $('video'); const hudEl = $('#arHud');
  let lukket = false; const rydd = [];

  // ---------- kamera ----------
  let strom = null;
  try { strom = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }); video.srcObject = strom; await video.play().catch(() => {}); } catch { video.remove(); melding('Kameraet er ikke tilgjengelig – grensene vises uten kamerabilde.'); }

  // ---------- posisjon ----------
  let gps = null; // { x, y (lokalt), noy, lat, lon }
  let origo = null; let tl = null;
  const vaktId = navigator.geolocation?.watchPosition((p) => {
    const { latitude: lat, longitude: lon, accuracy: noy } = p.coords;
    if (!origo) { origo = geoTilUtm(lon, lat, 33); tl = tilLokal(origo); }
    const [x, y] = tl([lon, lat]); gps = { x, y, noy, lat, lon, tid: Date.now() };
  }, () => {}, { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
  rydd.push(() => { if (vaktId != null) navigator.geolocation.clearWatch(vaktId); });
  // Vent på første posisjon (inntil 12 s); ellers startpunktet fra kartet.
  for (let i = 0; i < 60 && !gps; i++) await new Promise((r) => setTimeout(r, 200));
  if (!origo) {
    const s = startPos || { lat: 60, lon: 10 }; origo = geoTilUtm(s.lon, s.lat, 33); tl = tilLokal(origo);
    melding('Fant ikke GPS – bruker midten av kartet. Flytt deg med ◀ ▶ og stikkene i brillene.', 6000);
  }

  let THREE;
  try { THREE = await import(THREE_URL); } catch { rot.remove(); strom?.getTracks().forEach((t) => t.stop()); rydd.forEach((f) => f()); melding('3D-biblioteket kunne ikke lastes. Åpne AR én gang med nett, så virker det senere uten.'); return null; }

  // ---------- scene ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(window.innerWidth, window.innerHeight); renderer.setClearColor(0x000000, 0);
  rot.insertBefore(renderer.domElement, $('.ar-topp'));
  const scene = new THREE.Scene(); if (!strom) scene.background = new THREE.Color(0x24382d);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 3000); scene.add(camera);
  const verden = new THREE.Group(); scene.add(verden); // alt i lokale meter: x øst, y opp, z = −nord
  const lagGruppe = Object.fromEntries(Object.keys(AR_LAG).map((k) => { const g = new THREE.Group(); verden.add(g); return [k, g]; }));
  const synlig = new Set(Object.keys(AR_LAG));
  let hoyde = () => 0; let innhold = { linjer: [], punkter: [], flater: [] }; let ekstraMiljo = []; let ruter = [];
  const skilt = [];

  function etikett(p) {
    const c = document.createElement('canvas'); const s = 2; c.width = 560 * s; c.height = 132 * s; const g = c.getContext('2d'); if (!g) return null; g.scale(s, s);
    g.fillStyle = 'rgba(10,24,18,.82)'; g.beginPath(); g.roundRect?.(0, 0, 560, 132, 22); g.fill();
    g.fillStyle = p.farge; g.fillRect(0, 18, 8, 96);
    g.font = '44px system-ui, sans-serif'; g.fillText(p.ikon || '', 20, 62);
    g.fillStyle = '#fff'; g.font = '700 34px system-ui, sans-serif'; g.fillText(String(p.tittel || '').slice(0, 30), 84, 56, 460);
    g.fillStyle = '#cfe3d8'; g.font = '26px system-ui, sans-serif'; g.fillText(String(p.under || '').slice(0, 44), 84, 100, 460);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, sizeAttenuation: false }));
    sp.scale.set(0.34, 0.08, 1); sp.renderOrder = 10; return sp;
  }
  function tettLinje(pts, steg = 3) { const ut = []; for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i]; const [x1, y1] = pts[i + 1]; const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / steg)); for (let k = 0; k < n; k++) ut.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]); } ut.push(pts.at(-1)); return ut; }
  function byggScene() {
    for (const g of Object.values(lagGruppe)) { for (const o of [...g.children]) { g.remove(o); o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); } }
    skilt.length = 0;
    innhold = arInnhold(P, origo, { R, ekstraMiljo, ruter });
    const perLag = {};
    for (const l of innhold.linjer) {
      const pts = tettLinje(l.lukket && (l.punkter[0][0] !== l.punkter.at(-1)[0] || l.punkter[0][1] !== l.punkter.at(-1)[1]) ? [...l.punkter, l.punkter[0]] : l.punkter, l.gjerde ? 3 : 2);
      const nok = `${l.lag}|${l.farge}|${l.gjerde ? 'g' : 'b'}`; const d = (perLag[nok] ||= { lag: l.lag, farge: l.farge, gjerde: !!l.gjerde, flate: [], topp: [], stolper: [] });
      if (l.gjerde) {
        // Gjerde: gjennomsiktig vegg fra bakken, tydelig kant øverst og stolper hver ca. 9 m
        for (let i = 0; i < pts.length - 1; i++) {
          const [x0, y0] = pts[i]; const [x1, y1] = pts[i + 1]; const z0 = hoyde(x0, y0); const z1 = hoyde(x1, y1); const h = l.gjerde;
          d.flate.push(x0, z0, -y0, x1, z1, -y1, x1, z1 + h, -y1, x0, z0, -y0, x1, z1 + h, -y1, x0, z0 + h, -y0);
          d.topp.push(x0, z0 + h - 0.07, -y0, x1, z1 + h - 0.07, -y1, x1, z1 + h + 0.07, -y1, x0, z0 + h - 0.07, -y0, x1, z1 + h + 0.07, -y1, x0, z0 + h + 0.07, -y0);
          if (i % 3 === 0) d.stolper.push([x0, z0, -y0, h]);
        }
      } else {
        // Vei/sti: stripe på bakken
        const b = (l.bredde || 1) / 2;
        for (let i = 0; i < pts.length - 1; i++) {
          const [x0, y0] = pts[i]; const [x1, y1] = pts[i + 1]; const dx = x1 - x0; const dy = y1 - y0; const len = Math.hypot(dx, dy) || 1; const nx = (-dy / len) * b; const ny = (dx / len) * b;
          const z0 = hoyde(x0, y0) + 0.06; const z1 = hoyde(x1, y1) + 0.06;
          d.flate.push(x0 + nx, z0, -(y0 + ny), x1 + nx, z1, -(y1 + ny), x1 - nx, z1, -(y1 - ny), x0 + nx, z0, -(y0 + ny), x1 - nx, z1, -(y1 - ny), x0 - nx, z0, -(y0 - ny));
        }
      }
    }
    const mesh = (pos, farge, opac, lag) => { if (!pos.length) return; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: farge, transparent: true, opacity: opac, side: THREE.DoubleSide, depthWrite: false })); m.frustumCulled = false; lagGruppe[lag].add(m); };
    for (const d of Object.values(perLag)) {
      mesh(d.flate, d.farge, d.gjerde ? 0.22 : 0.5, d.lag); mesh(d.topp, d.farge, 0.95, d.lag);
      if (d.stolper.length) {
        const geo = new THREE.BoxGeometry(0.07, 1, 0.07); geo.translate(0, 0.5, 0);
        const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: d.farge, transparent: true, opacity: 0.85 }), d.stolper.length); const m4 = new THREE.Matrix4();
        d.stolper.forEach(([x, z, y, h], i) => im.setMatrixAt(i, m4.makeScale(1, h, 1).setPosition(x, z, y))); im.frustumCulled = false; lagGruppe[d.lag].add(im);
      }
    }
    // Skilt: stang + etikett som alltid vender mot deg
    for (const p of innhold.punkter) {
      const z = hoyde(p.x, p.y); const stang = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, p.hoyde, 6), new THREE.MeshBasicMaterial({ color: p.farge, transparent: true, opacity: 0.9 }));
      stang.position.set(p.x, z + p.hoyde / 2, -p.y); lagGruppe[p.lag].add(stang);
      const sp = etikett(p); if (!sp) continue; sp.position.set(p.x, z + p.hoyde + 0.35, -p.y); lagGruppe[p.lag].add(sp); skilt.push({ sp, p });
    }
    for (const [k, g] of Object.entries(lagGruppe)) g.visible = synlig.has(k);
  }
  byggScene();

  // ---------- data fra nett: terreng, miljø/kulturminner og stier rundt deg ----------
  (async () => {
    if (!navigator.onLine) return;
    const [ox, oy] = origo; const geo = [[-R, -R], [R, -R], [R, R], [-R, R], [-R, -R]].map(([x, y]) => utmTilGeo(ox + x, oy + y, 33));
    const lon = geo.map((q) => q[0]); const lat = geo.map((q) => q[1]); const bb = [Math.min(...lon), Math.min(...lat), Math.max(...lon), Math.max(...lat)];
    // Kulturminner først (rask), så resten av miljødataene (flere kilder etter hverandre)
    import('./pefc-data.js').then((m) => m.hentKulturminner(bb)).then((k) => { if (lukket || !k.length) return; ekstraMiljo = [...k, ...ekstraMiljo]; byggScene(); }).catch(() => {});
    const [ter, miljo, rt] = await Promise.all([
      (async () => { const { hentHoyder } = await import('./skog3d-omgivelser.js'); const { terrengPunkter, lagTerreng } = await import('./skog3d-data.js'); const n = 25; const z = await hentHoyder(terrengPunkter(origo, R, n)); return z.filter(Number.isFinite).length > z.length * 0.8 ? lagTerreng(z, R, n) : null; })().catch(() => null),
      (async () => { const { hentMiljodata } = await import('./pefc-data.js'); return (await hentMiljodata({ type: 'Polygon', coordinates: [geo] })).objekter; })().catch(() => []),
      (async () => { const { parseRuter, KILDER } = await import('./skog3d-omgivelser.js'); const r = await fetch(`${KILDER.ruter}?service=WFS&version=2.0.0&request=GetFeature&typeNames=app:Fotrute,app:AnnenRute&count=2000&bbox=${bb[1]},${bb[0]},${bb[3]},${bb[2]},urn:ogc:def:crs:EPSG::4258`); return r.ok ? parseRuter(await r.text()) : []; })().catch(() => []),
    ]);
    if (lukket) return;
    if (ter) { const h0 = ter(0, 0); hoyde = (x, y) => ter(x, y) - h0; }
    ekstraMiljo = [...ekstraMiljo, ...(miljo || [])]; ruter = rt || [];
    byggScene(); hudBid = null;
  })();

  // ---------- retning ----------
  let alpha = null; let beta = 90; let gamma = 0; let offset = 0; let kalibrering = 0; let harKompass = false; let sistOrient = 0;
  const skjermVinkel = () => (screen.orientation?.angle ?? window.orientation ?? 0);
  const orient = (e) => {
    if (e.alpha == null) return; sistOrient = performance.now();
    alpha = e.alpha; beta = e.beta ?? 90; gamma = e.gamma ?? 0;
    if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) { harKompass = true; offset = glattVinkel(offset, ((360 - e.webkitCompassHeading - e.alpha) % 360 + 360) % 360, 0.08); }
    else if (e.absolute || e.type === 'deviceorientationabsolute') { harKompass = true; offset = 0; }
  };
  const orientNavn = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
  window.addEventListener(orientNavn, orient); rydd.push(() => window.removeEventListener(orientNavn, orient));
  if (orientNavn !== 'deviceorientation') { const rel = (e) => { if (!harKompass) orient(e); }; window.addEventListener('deviceorientation', rel); rydd.push(() => window.removeEventListener('deviceorientation', rel)); }
  // Uten gyro (PC): dra for å se rundt
  let musYaw = 0; let musPitch = 0; let dra = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { dra = [e.clientX, e.clientY]; });
  window.addEventListener('pointerup', () => { dra = null; });
  renderer.domElement.addEventListener('pointermove', (e) => { if (!dra || performance.now() - sistOrient < 1500) return; musYaw += (e.clientX - dra[0]) * 0.004; musPitch = Math.max(-1.2, Math.min(1.2, musPitch + (e.clientY - dra[1]) * 0.004)); dra = [e.clientX, e.clientY]; });
  const zee = new THREE.Vector3(0, 0, 1); const eul = new THREE.Euler(); const q0 = new THREE.Quaternion(); const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
  const RAD = Math.PI / 180;
  const harGyro = () => alpha != null && performance.now() - sistOrient < 1500;
  function retningFraSensor(q) {
    if (harGyro()) {
      const a = (alpha + offset - DEKLINASJON + kalibrering) * RAD; // ▶ (kalibrering +) flytter grensene mot høyre
      eul.set(beta * RAD, a, -gamma * RAD, 'YXZ'); q.setFromEuler(eul); q.multiply(q1); q.multiply(q0.setFromAxisAngle(zee, -skjermVinkel() * RAD));
    } else { eul.set(-musPitch, -musYaw + kalibrering * RAD, 0, 'YXZ'); q.setFromEuler(eul); }
    return q;
  }
  const settKameraRetning = () => retningFraSensor(camera.quaternion);
  const kursAv = (q) => { const d = new THREE.Vector3(0, 0, -1).applyQuaternion(q); return ((Math.atan2(d.x, -d.z) / RAD) + 360) % 360; };
  // Kurs i verden: i brillene brillenes retning dreid tilbake med verdens dreining.
  const kurs = () => kursAv(renderer.xr.isPresenting ? renderer.xr.getCamera().quaternion.clone().premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -verden.rotation.y)) : camera.quaternion);

  // ---------- WebXR (briller / ARCore) ----------
  const xrKnapp = $('[data-ar="xr"]'); let xrStart = false; const vXr = new THREE.Vector3();
  try { if (navigator.xr && await navigator.xr.isSessionSupported('immersive-ar')) xrKnapp.hidden = false; } catch { /* ingen WebXR */ }
  const xrPosisjon = () => { const c = renderer.xr.getCamera(); c.getWorldPosition(vXr); return vXr; };
  // Plasser verden slik at GPS-posisjonen havner under brillene; dreining θ = kurs ved start − brillenes retning.
  function forankre(vekt = 1) {
    const c = xrPosisjon(); const p = gps ? [gps.x, gps.y] : [pos.x, pos.y]; const th = verden.rotation.y;
    const rx = Math.cos(th) * p[0] + Math.sin(th) * -p[1]; const rz = -Math.sin(th) * p[0] + Math.cos(th) * -p[1];
    const mx = c.x - rx; const mz = c.z - rz; const my = -hoyde(p[0], p[1]);
    verden.position.x += (mx - verden.position.x) * vekt; verden.position.z += (mz - verden.position.z) * vekt; verden.position.y += (my - verden.position.y) * vekt;
  }
  function dreiVerden(grader) {
    kalibrering += grader; const el = rot.querySelector('#arJuster'); if (el) el.textContent = `Retning ${kalibrering > 0 ? '+' : ''}${Math.round(kalibrering)}°`;
    if (!renderer.xr.isPresenting) return; // telefon: kalibreringen brukes i kameraretningen
    const c = xrPosisjon(); const d = -grader * RAD; const dx = verden.position.x - c.x; const dz = verden.position.z - c.z;
    verden.position.x = c.x + Math.cos(d) * dx + Math.sin(d) * dz; verden.position.z = c.z - Math.sin(d) * dx + Math.cos(d) * dz; verden.rotation.y += d;
  }
  xrKnapp.onclick = async () => {
    if (renderer.xr.isPresenting) { renderer.xr.getSession()?.end(); return; }
    try {
      renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
      const okt = await navigator.xr.requestSession('immersive-ar', { optionalFeatures: ['local-floor', 'dom-overlay'], domOverlay: { root: rot } });
      await renderer.xr.setSession(okt); xrStart = true; video.style.display = 'none'; scene.background = null; xrKnapp.textContent = 'Avslutt briller';
      okt.addEventListener('end', () => { renderer.xr.enabled = false; verden.position.set(0, 0, 0); verden.rotation.y = 0; video.style.display = ''; xrKnapp.textContent = '🥽 Briller'; if (!strom) scene.background = new THREE.Color(0x24382d); });
    } catch (e) { melding(`AR i briller kunne ikke startes: ${e.message}`); }
  };
  // Stikker i brillene: høyre = drei grensene, venstre = flytt grensene (når GPS mangler eller bommer)
  function xrStikker(dt) {
    const okt = renderer.xr.getSession(); if (!okt) return;
    for (const k of okt.inputSources) {
      const gp = k.gamepad; if (!gp || gp.axes.length < 4) continue; const [ax, ay] = [gp.axes[2], gp.axes[3]];
      if (k.handedness === 'right' && Math.abs(ax) > 0.2) dreiVerden(ax * 20 * dt);
      if (k.handedness === 'left' && (Math.abs(ax) > 0.2 || Math.abs(ay) > 0.2)) { verden.position.x -= ax * 2 * dt; verden.position.z -= ay * 2 * dt; }
    }
  }

  // ---------- HUD ----------
  const pos = { x: 0, y: 0 }; let hudBid = null; let hudTid = 0;
  const kort = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
  const pil = (rel) => (rel == null ? '' : Math.abs(rel) < 20 ? '⬆' : Math.abs(rel) > 160 ? '⬇' : rel > 0 ? (rel < 70 ? '↗' : rel < 135 ? '➡' : '↘') : (rel > -70 ? '↖' : rel > -135 ? '⬅' : '↙'));
  function oppdaterHud() {
    const k = kurs(); $('#arKompass').textContent = `${Math.round(k)}° ${['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'][Math.round(k / 45) % 8]}${harKompass ? '' : ' (uten kompass)'}`;
    const h = hvorEr(innhold, pos.x, pos.y); const b = h.bestand;
    const naer = naermeste(innhold, pos.x, pos.y, { lag: synlig, n: 4, kurs: k }).filter((p) => p.type !== 'bestand' || p.avstand > 15);
    hudEl.innerHTML = `${b ? `<b>Bestand ${b.nr}</b> · ${b.treslag || ''}${b.bonitet ?? ''} · HK ${['', 'I', 'II', 'III', 'IV', 'V'][b.hogstklasse] || '–'}${b.areal ? ` · ${kort(b.areal)} daa` : ''}` : '<b>Utenfor bestand</b>'}
      <small>${gps ? `📍 GPS ±${Math.round(gps.noy)} m` : '📍 Ingen GPS – posisjon fra kartet'}${h.miljo.length ? ` · ${h.miljo.map((m) => m.navn).slice(0, 2).join(' · ')}` : ''}</small>
      ${naer.length ? `<div class="naer">${naer.map((p) => `<span>${pil(p.relativ)} ${p.ikon} ${String(p.tittel).slice(0, 34)} · ${p.avstand < 1000 ? `${Math.round(p.avstand)} m` : `${kort(p.avstand / 1000)} km`} ${p.kompass}</span>`).join('')}</div>` : ''}`;
    const v = varsler(innhold, pos.x, pos.y).filter((x) => synlig.has('kultur') || !/sikringssone/.test(x.tekst)); const ve = $('.ar-varsel');
    ve.hidden = !v.length; if (v.length) { ve.textContent = `⚠ ${v[0].tekst}`; ve.classList.toggle('stopp', v[0].niva === 'stopp'); }
    $('#arJuster').textContent = `Retning ${kalibrering > 0 ? '+' : ''}${Math.round(kalibrering)}°`;
  }

  // ---------- løkke ----------
  $('#arStart').remove();
  let sist = performance.now(); let sistGps = 0;
  renderer.setAnimationLoop((t) => {
    const dt = Math.min(0.1, (t - sist) / 1000); sist = t;
    if (gps && !renderer.xr.isPresenting) { pos.x += (gps.x - pos.x) * Math.min(1, dt * 2.5); pos.y += (gps.y - pos.y) * Math.min(1, dt * 2.5); }
    if (renderer.xr.isPresenting) {
      if (xrStart) { xrStart = false; const c = renderer.xr.getCamera(); const d = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion); const hXr = Math.atan2(d.x, -d.z); const hNaa = (harGyro() && harKompass ? kursAv(retningFraSensor(new THREE.Quaternion())) : -kalibrering) * RAD; verden.rotation.y = hNaa - hXr; forankre(1); }
      xrStikker(dt);
      { const l = verden.worldToLocal(xrPosisjon().clone()); pos.x = l.x; pos.y = -l.z; } // der brillene er, i kartet
      if (gps && gps.tid !== sistGps && gps.noy < 15) { sistGps = gps.tid; forankre(0.08); } // GPS holder grensene på plass over tid
    } else {
      settKameraRetning(); camera.position.set(pos.x, hoyde(pos.x, pos.y) + OYE, -pos.y);
    }
    for (const s of skilt) { const d = Math.hypot(s.p.x - pos.x, s.p.y - pos.y); s.sp.visible = d < 350; s.sp.material.opacity = d < 200 ? 1 : Math.max(0.25, 1 - (d - 200) / 150); }
    if (t - hudTid > 500) { hudTid = t; oppdaterHud(); }
    renderer.render(scene, camera);
  });

  // ---------- knapper ----------
  for (const k of rot.querySelectorAll('[data-lag]')) k.onclick = () => { const l = k.dataset.lag; if (synlig.has(l)) synlig.delete(l); else synlig.add(l); k.setAttribute('aria-pressed', String(synlig.has(l))); lagGruppe[l].visible = synlig.has(l); hudBid = null; oppdaterHud(); };
  let holdTimer = null;
  const hold = (g) => { dreiVerden(g); clearInterval(holdTimer); holdTimer = setInterval(() => dreiVerden(g), 120); };
  for (const [sel, g] of [['[data-ar="venstre"]', -1], ['[data-ar="hoyre"]', 1]]) { const k = $(sel); k.addEventListener('pointerdown', (e) => { e.preventDefault(); hold(g); }); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) k.addEventListener(ev, () => clearInterval(holdTimer)); }
  const vindu = () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); };
  window.addEventListener('resize', vindu); rydd.push(() => window.removeEventListener('resize', vindu));
  function lukk() {
    lukket = true; renderer.setAnimationLoop(null); renderer.xr.getSession()?.end(); clearInterval(holdTimer);
    rydd.forEach((f) => f()); strom?.getTracks().forEach((tr) => tr.stop());
    scene.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose?.(); }); renderer.dispose(); rot.remove();
  }
  $('[data-ar="lukk"]').onclick = lukk;
  const api = { lukk, innhold: () => innhold, posisjon: () => ({ ...pos }), settPosisjon: (x, y) => { gps = { x, y, noy: 3, tid: Date.now() }; pos.x = x; pos.y = y; }, settRetning: (grader) => { musYaw = grader * RAD; }, hud: () => hudEl.textContent };
  rot.ar = api;
  return api;
}
