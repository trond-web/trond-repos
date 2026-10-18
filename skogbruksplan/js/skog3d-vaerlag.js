// Væreffekter i den virtuelle skogen (Three.js): himmel og sikt (tåke), sol og lys etter tid på døgnet og skydekke,
// regn og snø som faller rundt deg og driver med vinden, lyn ved torden, snø på bakken (og at småplantene forsvinner
// under snøen), og lyd av regn og vind (Web Audio, lages med støy – ingen lydfiler). Innstillingene kommer fra
// vaerScene() i skog3d-vaer.js.
const BOKS = { x: 34, y: 18, z: 34 }; // nedbør i en boks rundt deg (m)

export function lagVaerLag(THREE, scene, { halvkule, omgivelse, sol, bakke, bunnLag = null }) {
  const opprinnelig = bakke.attributes.color.array.slice();
  const bunn = () => (typeof bunnLag === 'function' ? bunnLag() : bunnLag); // bunnlaget kan lages på nytt (framtidsskog)
  // Utgangspunktet (standard klart vær) – brukes når været slås av.
  const start = { bg: scene.background?.clone?.(), fog: { c: scene.fog.color.clone(), n: scene.fog.near, f: scene.fog.far }, hk: halvkule.intensity, hkF: halvkule.color.clone(), om: omgivelse.intensity, so: sol.intensity, soF: sol.color.clone(), soP: sol.position.clone() };
  let p = null; let nedbor = null; let lyd = null; let lynTid = 0; let lynStyrke = 0;
  const frost = Math.random;

  function lagNedbor(type, mengde) {
    if (nedbor) { scene.remove(nedbor.obj); nedbor.obj.geometry.dispose(); nedbor.obj.material.dispose(); nedbor.obj.material.map?.dispose(); nedbor = null; }
    if (!type || type === 'taake' || mengde <= 0) return;
    const sno = type === 'sno'; const n = Math.round((sno ? 7000 : 6000) * (0.35 + mengde * 0.65));
    const pos = new Float32Array(n * (sno ? 3 : 6)); const fase = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (frost() - 0.5) * BOKS.x; const y = frost() * BOKS.y; const z = (frost() - 0.5) * BOKS.z; fase[i] = frost() * Math.PI * 2;
      if (sno) pos.set([x, y, z], i * 3); else pos.set([x, y, z, x, y + 0.45, z], i * 6);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.attributes.position.setUsage(THREE.DynamicDrawUsage);
    let obj;
    if (sno) {
      const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
      const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
      obj = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.07, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, color: 0xffffff, opacity: 0.95 }));
    } else obj = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: type === 'sludd' ? 0xd8e2ea : 0xaebccb, transparent: true, opacity: 0.55, depthWrite: false }));
    obj.frustumCulled = false; scene.add(obj);
    nedbor = { obj, n, sno, fase, fart: sno ? 0.9 : type === 'sludd' ? 4.5 : 8.5, klar: false };
  }

  function settBakke(dekke) {
    const c = bakke.attributes.color; const a = c.array;
    for (let i = 0; i < a.length; i += 3) {
      const flekk = 0.85 + ((Math.sin(i * 0.013) * Math.cos(i * 0.007) + 1) / 2) * 0.15; const t = Math.min(1, dekke * (dekke < 0.6 ? flekk : 1));
      a[i] = opprinnelig[i] + (0.9 * flekk - opprinnelig[i]) * t; a[i + 1] = opprinnelig[i + 1] + (0.92 * flekk - opprinnelig[i + 1]) * t; a[i + 2] = opprinnelig[i + 2] + (0.96 * flekk - opprinnelig[i + 2]) * t;
    }
    c.needsUpdate = true;
    // Planter under snøen etter snødybden: mose og lav ved ca. 10 cm, lyng og bær ved 25 cm, gras, urter og bregner ved 45 cm.
    const cm = p?.snodybde ?? dekke * 15;
    bunn()?.skjul?.([...(cm >= 10 ? ['lav', 'mose', 'torvmose'] : []), ...(cm >= 25 ? ['lyng', 'tyttebaer', 'blabaer'] : []), ...(cm >= 45 ? ['gras', 'urter', 'starr', 'bregne', 'hoystaude'] : [])]);
  }

  function sett(ny) {
    p = ny;
    scene.background = new THREE.Color(...p.himmel);
    scene.fog.color.setRGB(...p.himmel); scene.fog.near = p.taake.naer; scene.fog.far = p.taake.fjern;
    halvkule.intensity = p.halvkule; omgivelse.intensity = p.omgivelse;
    halvkule.color.setRGB(...p.himmel.map((x) => 0.6 + x * 0.4));
    sol.intensity = p.sol.styrke; sol.color.setRGB(...p.sol.farge);
    const h = Math.max(2, p.sol.hoyde) * Math.PI / 180; const az = p.sol.asimut * Math.PI / 180; // x øst, z = −nord
    sol.position.set(Math.sin(az) * Math.cos(h) * 150, Math.sin(h) * 150, -Math.cos(az) * Math.cos(h) * 150);
    lagNedbor(p.type, p.mengde); settBakke(p.snoDekke);
    if (lyd) lyd.sett(p);
  }

  function oppdater(dt, [cx, cy, cz]) {
    if (nedbor && p) {
      const a = nedbor.obj.geometry.attributes.position.array; const f = nedbor.fart;
      // Vinden fører nedbøren mot der den blåser til (vindFra er der den kommer fra).
      const til = ((p.vindFra + 180) % 360) * Math.PI / 180; const vx = Math.sin(til) * p.vind * (nedbor.sno ? 0.5 : 0.25); const vz = -Math.cos(til) * p.vind * (nedbor.sno ? 0.5 : 0.25);
      const hx = BOKS.x / 2; const hz = BOKS.z / 2; const t = performance.now() / 1000;
      if (!nedbor.klar) { for (let k = 0; k < a.length; k += 3) { a[k] += cx; a[k + 1] += cy - 2; a[k + 2] += cz; } nedbor.klar = true; } // start rundt deg
      for (let i = 0; i < nedbor.n; i++) {
        const k = nedbor.sno ? i * 3 : i * 6;
        let x = a[k] + vx * dt + (nedbor.sno ? Math.sin(t * 1.3 + nedbor.fase[i]) * 0.3 * dt : 0); let y = a[k + 1] - f * dt; let z = a[k + 2] + vz * dt + (nedbor.sno ? Math.cos(t * 1.1 + nedbor.fase[i]) * 0.3 * dt : 0);
        // Hold dråpene i boksen rundt deg (flytt dem til motsatt side når de går ut)
        if (y < cy - 2) y += BOKS.y; if (x - cx > hx) x -= BOKS.x; else if (cx - x > hx) x += BOKS.x; if (z - cz > hz) z -= BOKS.z; else if (cz - z > hz) z += BOKS.z;
        if (y > cy + BOKS.y) y -= BOKS.y;
        a[k] = x; a[k + 1] = y; a[k + 2] = z;
        if (!nedbor.sno) { a[k + 3] = x - vx * 0.05; a[k + 4] = y + 0.45; a[k + 5] = z - vz * 0.05; }
      }
      nedbor.obj.geometry.attributes.position.needsUpdate = true;
    }
    // Lyn ved torden: kort lysglimt med noen sekunders mellomrom (og torden i lyden)
    if (p?.torden) {
      lynTid -= dt;
      if (lynTid <= 0) { lynTid = 6 + frost() * 14; lynStyrke = 1; lyd?.torden(); }
      if (lynStyrke > 0) { lynStyrke = Math.max(0, lynStyrke - dt * 3.5); halvkule.intensity = p.halvkule + lynStyrke * 3 * (frost() > 0.3 ? 1 : 0.2); }
    }
  }

  // ---------- lyd ----------
  function lagLyd() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    const ac = new AC(); const len = ac.sampleRate * 2; const buf = ac.createBuffer(1, len, ac.sampleRate); const d = buf.getChannelData(0);
    let b0 = 0; let b1 = 0; let b2 = 0; // rosa støy
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.35; }
    const kilde = (filter, f, q) => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ac.createBiquadFilter(); fl.type = filter; fl.frequency.value = f; fl.Q.value = q; const g = ac.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(ac.destination); s.start(0, Math.random() * 2); return { g, fl }; };
    const regn = kilde('bandpass', 2400, 0.5); const vind = kilde('lowpass', 380, 0.7); const sus = kilde('bandpass', 900, 0.4);
    let tid = 0; const lfo = setInterval(() => { tid += 0.1; if (!p) return; const v = Math.min(1, p.vind / 14); const kast = 0.6 + 0.4 * Math.sin(tid * 0.7) * Math.sin(tid * 0.23); vind.g.gain.setTargetAtTime(0.02 + v * 0.35 * kast, ac.currentTime, 0.3); sus.g.gain.setTargetAtTime(v * 0.08 * kast, ac.currentTime, 0.4); }, 100);
    return {
      sett(q) { const r = q.type === 'regn' || q.type === 'sludd' ? 0.05 + q.mengde * 0.3 : q.type === 'sno' ? 0.01 : 0; regn.g.gain.setTargetAtTime(r, ac.currentTime, 0.5); if (ac.state === 'suspended') ac.resume(); },
      torden() { const s = ac.createBufferSource(); s.buffer = buf; const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 160; const g = ac.createGain(); const t0 = ac.currentTime + 0.8 + Math.random() * 2; g.gain.setValueAtTime(0, ac.currentTime); g.gain.linearRampToValueAtTime(0.9, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 3.5); s.connect(fl).connect(g).connect(ac.destination); s.start(ac.currentTime, Math.random()); s.stop(t0 + 4); },
      stopp() { clearInterval(lfo); ac.close(); },
    };
  }

  function nullstill() {
    p = null; lagNedbor(null, 0);
    if (start.bg) scene.background = start.bg.clone(); scene.fog.color.copy(start.fog.c); scene.fog.near = start.fog.n; scene.fog.far = start.fog.f;
    halvkule.intensity = start.hk; halvkule.color.copy(start.hkF); omgivelse.intensity = start.om; sol.intensity = start.so; sol.color.copy(start.soF); sol.position.copy(start.soP);
    bakke.attributes.color.array.set(opprinnelig); bakke.attributes.color.needsUpdate = true; bunn()?.skjul?.([]);
    if (lyd) lyd.sett({ type: null, mengde: 0, vind: 0 });
  }
  return {
    sett,
    nullstill,
    paaNytt: () => { if (p) settBakke(p.snoDekke); }, // etter at bunnlaget er laget på nytt
    aktiv: () => p,
    oppdater,
    lyd(paa) { if (paa && !lyd) { lyd = lagLyd(); if (lyd && p) lyd.sett(p); } else if (!paa && lyd) { lyd.stopp(); lyd = null; } return !!lyd; },
    harLyd: () => !!lyd,
    antallPartikler: () => nedbor?.n || 0,
    dispose() { lagNedbor(null, 0); lyd?.stopp(); lyd = null; },
  };
}
