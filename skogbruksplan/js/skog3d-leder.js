// 🧑‍🌾 SkogIQ-lederen i den virtuelle skogen: en skogbruksleder (refleksvest, hjelm med SkogIQ-merke) som kommer fram
// foran deg og svarer på spørsmål om stedet du står. Svarene vises på en tavle ved siden av lederen, leses opp
// (talesyntese) og står i et panel på skjermen. Spørsmål stilles med tekst, med stemmen (talegjenkjenning der
// nettleseren har det) eller ved å velge et forslag – også i VR-brillene med kontrollerne.
// Svarlogikk: js/leder-svar.js (regelbasert lokalt, Claude med AI-nøkkel).
import { FORSLAG, lokaltSvar, aiSvar } from './leder-svar.js';
import { SDK_URL, MODELL, NOKKEL } from './assistent.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const STIL = `
.skog3d .s3-leder { position: absolute; left: 14px; top: 120px; width: min(380px, calc(100% - 28px)); background: rgba(251,252,250,.96); border-radius: 16px; padding: 12px 14px; box-shadow: 0 8px 26px rgba(0,0,0,.28); display: grid; gap: 8px; font-size: 14px; }
.skog3d .s3-leder h3 { margin: 0; font-size: 16px; display: flex; align-items: center; gap: 6px; } .skog3d .s3-leder h3 small { font-weight: 500; color: #43544b; font-size: 12px; margin-left: auto; }
.skog3d .s3-leder .svar { background: #eef3ef; border-radius: 12px; padding: 9px 11px; min-height: 40px; max-height: 32vh; overflow: auto; white-space: pre-wrap; }
.skog3d .s3-leder .svar.tenker { color: #43544b; font-style: italic; }
.skog3d .s3-leder .forslag { display: flex; flex-wrap: wrap; gap: 5px; } .skog3d .s3-leder .forslag button { border: 1px solid #cfd8d1; background: #fff; border-radius: 99px; padding: 5px 10px; font: 600 12.5px/1.2 system-ui, sans-serif; color: #10241c; cursor: pointer; }
.skog3d .s3-leder form { display: flex; gap: 6px; } .skog3d .s3-leder input { flex: 1; min-width: 0; border: 1px solid #bbc7bf; border-radius: 10px; padding: 8px 10px; font: inherit; }
.skog3d .s3-leder form button { border: 0; border-radius: 10px; padding: 8px 11px; font: 700 14px/1 system-ui, sans-serif; background: #1f6b45; color: #fff; cursor: pointer; } .skog3d .s3-leder form button.mik { background: #eef3ef; color: #10241c; } .skog3d .s3-leder form button.mik.lytter { background: #c0392b; color: #fff; }
.skog3d .s3-leder .hint { color: #43544b; font-size: 12px; margin: 0; }
@media (max-width: 760px) { .skog3d .s3-leder { top: auto; bottom: 200px; } }
`;

// Talegjenkjenning i nettleseren sender lyden til nettleserleverandøren (Google, Apple, Meta …) – en ny tredjepart som
// må inn i personvernerklæringen og godkjennes av eieren før den slås på. Til da: tekst, forslag og VR-meny.
export const TALEGJENKJENNING = false;

function lesNokkel() { try { return localStorage.getItem(NOKKEL) || ''; } catch { return ''; } }

// Leder-figuren (Three.js). Står på bakken, ser mot deg, vugger litt og «snakker» (nikker) når den svarer.
function lagFigur(THREE) {
  const g = new THREE.Group();
  const m = (farge, ekstra = {}) => new THREE.MeshLambertMaterial({ color: farge, ...ekstra });
  const del = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o; };
  const bukse = m(0x2f3b33); const vest = m(0xff7a00, { emissive: 0x331800 }); const refleks = m(0xf3f6c8, { emissive: 0x444433 }); const hud = m(0xe6b99a); const stovel = m(0x1c1c1c);
  del(new THREE.CylinderGeometry(0.075, 0.07, 0.82, 10), bukse, -0.1, 0.41, 0); del(new THREE.CylinderGeometry(0.075, 0.07, 0.82, 10), bukse, 0.1, 0.41, 0);
  del(new THREE.BoxGeometry(0.14, 0.1, 0.24), stovel, -0.1, 0.05, 0.04); del(new THREE.BoxGeometry(0.14, 0.1, 0.24), stovel, 0.1, 0.05, 0.04);
  del(new THREE.CylinderGeometry(0.2, 0.17, 0.62, 12), vest, 0, 1.12, 0);
  del(new THREE.CylinderGeometry(0.205, 0.205, 0.05, 12), refleks, 0, 1.0, 0); del(new THREE.CylinderGeometry(0.205, 0.205, 0.05, 12), refleks, 0, 1.22, 0);
  const armV = del(new THREE.CylinderGeometry(0.05, 0.045, 0.56, 8), vest, -0.25, 1.1, 0); armV.rotation.z = -0.14; // hånden litt ut fra kroppen
  const armH = del(new THREE.CylinderGeometry(0.05, 0.045, 0.56, 8), vest, 0.25, 1.1, 0); armH.rotation.z = 0.14;
  for (const x of [-0.29, 0.29]) del(new THREE.SphereGeometry(0.05, 10, 8), hud, x, 0.8, 0); // hender
  const hode = new THREE.Group(); hode.position.set(0, 1.56, 0); g.add(hode);
  const ansikt = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), hud); hode.add(ansikt);
  const hjelm = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m(0xffffff)); hjelm.position.y = 0.03; hode.add(hjelm);
  const skjerm = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.015, 16, 1, false, -Math.PI / 2, Math.PI), m(0xffffff)); skjerm.position.set(0, 0.03, 0.02); hode.add(skjerm);
  // SkogIQ-merke på hjelmen og øyne
  const merke = document.createElement('canvas'); merke.width = 128; merke.height = 48; const c = merke.getContext('2d');
  if (c) { c.fillStyle = '#ffffff'; c.fillRect(0, 0, 128, 48); c.font = '800 30px system-ui, sans-serif'; c.fillStyle = '#1f6b45'; c.fillText('Skog', 6, 35); c.fillStyle = '#d0242f'; c.fillText('IQ', 76, 35); }
  const merkeFlate = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.045), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(merke), transparent: true })); merkeFlate.position.set(0, 0.1, 0.12); merkeFlate.rotation.x = -0.45; hode.add(merkeFlate);
  for (const x of [-0.045, 0.045]) { const o = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), m(0x10241c)); o.position.set(x, 0.01, 0.12); hode.add(o); }
  // Navneskilt over hodet
  const skilt = document.createElement('canvas'); skilt.width = 512; skilt.height = 96; const k = skilt.getContext('2d');
  if (k) { k.fillStyle = 'rgba(16,36,28,.85)'; k.beginPath(); k.roundRect?.(0, 0, 512, 96, 30); k.fill(); k.fillStyle = '#f1f6f2'; k.font = '700 46px system-ui, sans-serif'; k.textAlign = 'center'; k.fillText('🧑‍🌾 SkogIQ-leder', 256, 64); }
  const navn = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.116), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(skilt), transparent: true, depthTest: false })); navn.position.set(0, 1.92, 0); navn.renderOrder = 997; g.add(navn);
  return { gruppe: g, hode, armH };
}

// Tavle med tekst (spørsmål, svar eller meny), ved siden av lederen
function lagTavle(THREE) {
  const lerret = document.createElement('canvas'); lerret.width = 1024; lerret.height = 640; const tekstur = new THREE.CanvasTexture(lerret);
  const flate = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.69), new THREE.MeshBasicMaterial({ map: tekstur, transparent: true, depthTest: false })); flate.renderOrder = 996;
  function tegn({ tittel = '', tekst = '', linjer = null, valgt = -1, fot = '' }) {
    const c = lerret.getContext('2d'); if (!c) return;
    c.clearRect(0, 0, 1024, 640); c.fillStyle = 'rgba(251,252,250,.95)'; c.beginPath(); c.roundRect?.(0, 0, 1024, 640, 36); c.fill();
    c.fillStyle = '#1f6b45'; c.font = '800 44px system-ui, sans-serif'; c.fillText(tittel, 40, 70, 944);
    c.fillStyle = '#10241c';
    if (linjer) { linjer.forEach((l, i) => { const y = 132 + i * 64; if (i === valgt) { c.fillStyle = '#1f6b45'; c.beginPath(); c.roundRect?.(28, y - 46, 968, 60, 16); c.fill(); c.fillStyle = '#fff'; } else c.fillStyle = '#10241c'; c.font = '600 38px system-ui, sans-serif'; c.fillText(l, 48, y, 928); }); }
    else {
      c.font = '500 50px system-ui, sans-serif'; const ord = String(tekst).split(/\s+/); let linje = ''; let y = 140;
      for (const w of ord) { const prov = linje ? `${linje} ${w}` : w; if (c.measureText(prov).width > 944) { c.fillText(linje, 40, y); y += 62; linje = w; if (y > 570) { linje = '…'; break; } } else linje = prov; }
      if (linje) c.fillText(linje, 40, y);
    }
    if (fot) { c.fillStyle = '#43544b'; c.font = '500 28px system-ui, sans-serif'; c.fillText(fot, 40, 615, 944); }
    tekstur.needsUpdate = true;
  }
  return { flate, tegn, dispose: () => { tekstur.dispose(); flate.geometry.dispose(); flate.material.dispose(); } };
}

// Hovedfunksjonen. rot = .skog3d-elementet, stedHer() → sted (leder-svar.js), kontekst() → plandata som tekst.
export function lagLeder(THREE, { rot, scene, camera, dolly, hoyde, renderer, stedHer, kontekst }) {
  if (!document.getElementById('s3-leder-stil')) { const st = document.createElement('style'); st.id = 's3-leder-stil'; st.textContent = STIL; document.head.appendChild(st); }
  const figur = lagFigur(THREE); const tavle = lagTavle(THREE);
  const leder = new THREE.Group(); leder.add(figur.gruppe); tavle.flate.position.set(0.85, 1.4, 0.15); tavle.flate.rotation.y = -0.3; leder.add(tavle.flate); leder.visible = false; scene.add(leder);
  const Tale = TALEGJENKJENNING ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null; const kanLytte = !!Tale;
  let historikk = []; let snakker = 0; let opptatt = false; let lytter = null; let menyValg = 0; let sisteSvar = '';
  const panel = document.createElement('div'); panel.className = 's3-leder'; panel.hidden = true;
  panel.innerHTML = `<h3>🧑‍🌾 SkogIQ-leder <small>${lesNokkel() ? 'AI (Claude) + plandata' : 'svarer fra planens data'}</small></h3>
    <div class="svar" data-l-svar>Hei! Jeg er SkogIQ-lederen. Spør meg om skogen der du står.</div>
    <div class="forslag">${FORSLAG.map((f) => `<button type="button" data-l-sporsmal="${esc(f)}">${esc(f)}</button>`).join('')}</div>
    <form data-l-skjema><input data-l-input placeholder="Still et spørsmål …" autocomplete="off" aria-label="Spørsmål til SkogIQ-lederen">${kanLytte ? '<button type="button" class="mik" data-l-mik title="Snakk (hold inne eller trykk)">🎙</button>' : ''}<button type="submit">Spør</button></form>
    <p class="hint">${lesNokkel() ? 'Frie spørsmål besvares av Claude med planen og stedet du står. ' : 'Legg inn AI-nøkkel under «Spør AI» for å stille frie spørsmål. '}I VR: høyre grep = hent eller send bort lederen, høyre stikke opp/ned + avtrekker = velg spørsmål${kanLytte ? ', venstre grep = hold inne og snakk' : ''}.</p>`;
  rot.appendChild(panel);
  // Tastene i panelet skal ikke styre gåingen (WASD).
  for (const t of ['keydown', 'keyup']) panel.addEventListener(t, (e) => e.stopPropagation());
  const svarEl = panel.querySelector('[data-l-svar]');

  function plasser() {
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1); dir.normalize();
    const p = dolly.position.clone().addScaledVector(dir, 2.4); leder.position.set(p.x, hoyde(p.x, -p.z), p.z);
    leder.lookAt(dolly.position.x, leder.position.y, dolly.position.z);
  }
  function vis(paa = !leder.visible) {
    leder.visible = paa; panel.hidden = !paa || renderer.xr.isPresenting;
    if (paa) { plasser(); if (!sisteSvar) visMeny(); } else { try { speechSynthesis.cancel(); } catch { /* ingen tale */ } }
  }
  function visMeny() { tavle.tegn({ tittel: 'Spør meg om stedet du står', linjer: FORSLAG, valgt: renderer.xr.isPresenting ? menyValg : -1, fot: renderer.xr.isPresenting ? `Stikke opp/ned · avtrekker = spør${kanLytte ? ' · venstre grep = snakk' : ''}` : 'Velg et spørsmål i panelet eller skriv ditt eget' }); }
  function les(tekst) {
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(tekst); u.lang = 'nb-NO'; // Bare stemmer som kjører på enheten (localService) – nettbaserte stemmer sender teksten til leverandøren
      const stemmer = speechSynthesis.getVoices().filter((v) => v.localService); const st = stemmer.find((v) => /^(nb|no|nn)/i.test(v.lang)); if (!st) return; u.voice = st; u.rate = 1.02; speechSynthesis.speak(u); } catch { /* ingen tale */ }
  }
  async function spor(sporsmal) {
    sporsmal = String(sporsmal || '').trim(); if (!sporsmal || opptatt) return;
    if (!leder.visible) vis(true);
    opptatt = true; const sted = stedHer();
    svarEl.textContent = 'Tenker …'; svarEl.classList.add('tenker'); tavle.tegn({ tittel: `«${sporsmal.slice(0, 40)}${sporsmal.length > 40 ? '…' : ''}»`, tekst: 'Et øyeblikk …' });
    let tekst = '';
    const nokkel = lesNokkel();
    if (nokkel && navigator.onLine !== false) {
      try {
        const sdk = await import(SDK_URL); const klient = new sdk.default({ apiKey: nokkel, dangerouslyAllowBrowser: true });
        const r = await aiSvar(klient, { sporsmal, kontekst: kontekst(), sted, historikk: historikk.slice(-8), modell: MODELL, del: (t) => { svarEl.textContent = t; svarEl.classList.remove('tenker'); tavle.tegn({ tittel: '🧑‍🌾 SkogIQ-leder', tekst: t }); } });
        tekst = r.tekst; historikk.push(r.melding, r.svarMelding);
      } catch (e) { tekst = `${lokaltSvar(sporsmal, sted).tekst} (AI-svaret feilet: ${e.message || e} – dette er svar fra planens data.)`; }
    } else tekst = lokaltSvar(sporsmal, sted).tekst;
    sisteSvar = tekst; svarEl.textContent = tekst; svarEl.classList.remove('tenker');
    tavle.tegn({ tittel: '🧑‍🌾 SkogIQ-leder', tekst, fot: renderer.xr.isPresenting ? 'Avtrekker = nytt spørsmål · høyre grep = send bort' : '' });
    snakker = performance.now() + Math.min(12000, 600 + tekst.length * 55); les(tekst.replace(/\s*\(AI-svaret feilet.*$/, '')); opptatt = false;
  }
  function startLytting() {
    if (!kanLytte || lytter) return;
    lytter = new Tale(); lytter.lang = 'nb-NO'; lytter.interimResults = true; lytter.maxAlternatives = 1;
    const mik = panel.querySelector('[data-l-mik]'); mik?.classList.add('lytter'); tavle.tegn({ tittel: '🎙 Jeg lytter …', tekst: 'Still spørsmålet ditt.' }); if (!leder.visible) vis(true);
    let tekst = '';
    lytter.onresult = (e) => { tekst = [...e.results].map((r) => r[0].transcript).join(' '); panel.querySelector('[data-l-input]').value = tekst; tavle.tegn({ tittel: '🎙 Jeg lytter …', tekst }); };
    lytter.onerror = () => { };
    lytter.onend = () => { mik?.classList.remove('lytter'); lytter = null; if (tekst.trim()) spor(tekst); else visMeny(); };
    try { lytter.start(); } catch { lytter = null; mik?.classList.remove('lytter'); }
  }
  const stoppLytting = () => { try { lytter?.stop(); } catch { /* allerede stoppet */ } };

  panel.addEventListener('click', (e) => { const f = e.target.closest('[data-l-sporsmal]'); if (f) { spor(f.dataset.lSporsmal); return; } if (e.target.closest('[data-l-mik]')) { if (lytter) stoppLytting(); else startLytting(); } });
  panel.querySelector('[data-l-skjema]').addEventListener('submit', (e) => { e.preventDefault(); const i = panel.querySelector('[data-l-input]'); spor(i.value); i.value = ''; });

  // VR-kontrollere: høyre grep = vis/skjul, høyre stikke opp/ned = velg forslag, høyre avtrekker = spør, venstre grep = snakk.
  let gH = false; let trH = false; let gV = false; let stikkeTid = 0;
  function vr(okt) {
    for (const kilde of okt.inputSources) {
      const gp = kilde.gamepad; if (!gp) continue;
      if (kilde.handedness === 'right') {
        const grep = !!gp.buttons[1]?.pressed; if (grep && !gH) vis(); gH = grep;
        if (!leder.visible) continue;
        const ay = gp.axes[3] ?? 0; const naa = performance.now();
        if (Math.abs(ay) > 0.7 && naa > stikkeTid) { menyValg = (menyValg + (ay > 0 ? 1 : -1) + FORSLAG.length) % FORSLAG.length; stikkeTid = naa + 280; sisteSvar = ''; visMeny(); }
        const tr = !!gp.buttons[0]?.pressed; if (tr && !trH) { if (sisteSvar && !opptatt) { sisteSvar = ''; visMeny(); } else spor(FORSLAG[menyValg]); } trH = tr;
      }
      if (kilde.handedness === 'left' && kanLytte) { const g = !!gp.buttons[1]?.pressed; if (g && !gV) startLytting(); if (!g && gV) stoppLytting(); gV = g; }
    }
  }
  // Hver ramme: lederen ser på deg, vugger og nikker når den snakker; flytter seg hvis du går langt unna.
  function oppdater(t, dt) {
    if (!leder.visible) return;
    const dx = dolly.position.x - leder.position.x; const dz = dolly.position.z - leder.position.z; const avst = Math.hypot(dx, dz);
    if (avst > 9) plasser(); else leder.rotation.y = Math.atan2(dx, dz);
    figur.gruppe.position.y = Math.sin(t / 900) * 0.01;
    const prater = performance.now() < snakker; figur.hode.rotation.x = prater ? Math.sin(t / 140) * 0.08 : Math.sin(t / 1700) * 0.03; figur.armH.rotation.x = prater ? Math.sin(t / 420) * 0.35 : 0;
    const skjul = !leder.visible || renderer.xr.isPresenting; if (panel.hidden !== skjul) panel.hidden = skjul; // panelet vises ikke i brillene
    void dt;
  }
  return { vis, spor, vr, oppdater, synlig: () => leder.visible, dispose: () => { try { speechSynthesis.cancel(); } catch { /* ingen tale */ } stoppLytting(); tavle.dispose(); scene.remove(leder); panel.remove(); } };
}
