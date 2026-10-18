// Droneoppdrag (beta) i SkogIQ Felt: tegn et område (eller bruk et bestand), velg drone, høyde og overlapp, se
// flylinjene i kartet, gå gjennom sjekklisten og last ned ruten som KMZ for DJI Pilot 2. Oppdragene lagres i planen.
import { DRONER, STANDARD_DRONE, MAKS_HOYDE, SJEKKLISTE, planlegg, kamera, terrengVurdering, lagKmz, lagOmradeKml } from './drone.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v, d = 0) => (v == null || Number.isNaN(v) ? '–' : Number(v).toLocaleString('nb-NO', { maximumFractionDigits: d, minimumFractionDigits: d }));
const filnavn = (s) => String(s || 'droneoppdrag').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'droneoppdrag';

export function initDroneFelt({ L, kart, plan, aapneArk, lagrePlanen, melding, nyId, tegnFlateGeo, iAar = new Date().getFullYear() }) {
  let aapent = null; // id for oppdraget som vises
  let visning = 'plan'; // 'plan' | 'start'
  let lag = null; let terreng = new Map(); // oppdrag-id → terrengvurdering
  const P = () => plan();
  const alle = () => P()?.droneoppdrag || [];
  const finn = (id) => alle().find((o) => o.id === id);

  function tegnKart(o, p) {
    if (!lag) lag = L.layerGroup().addTo(kart);
    lag.clearLayers(); if (!o) return;
    L.geoJSON(o.geometri, { style: { color: '#7b2ff7', weight: 2.5, dashArray: '6 4', fillColor: '#7b2ff7', fillOpacity: 0.08 }, interactive: false }).addTo(lag);
    if (!p) return;
    const ll = p.linjerGeo.map((l) => l.map(([lon, lat]) => [lat, lon]));
    L.polyline(ll.flat(), { color: '#ff3d7f', weight: 2, opacity: 0.9, interactive: false }).addTo(lag);
    const [lon, lat] = p.linjerGeo[0][0];
    L.circleMarker([lat, lon], { radius: 7, color: '#fff', weight: 2.5, fillColor: '#ff3d7f', fillOpacity: 1, interactive: false }).bindTooltip('Start', { permanent: true, direction: 'top', className: 'drone-start' }).addTo(lag);
  }
  function zoomTil(o) { try { kart.fitBounds(L.geoJSON(o.geometri).getBounds(), { padding: [30, 30], paddingBottomRight: [30, window.innerHeight * 0.45] }); } catch { /* ingen geometri */ } }

  // ---------- liste ----------
  function visListe() {
    aapent = null; tegnKart(null);
    const liste = [...alle()].sort((a, b) => String(b.opprettet).localeCompare(String(a.opprettet)));
    aapneArk(`<h2>Droneoppdrag <span class="beta">beta</span></h2>
      <p class="hint">Lag en flyrute for ortofoto med DJI Enterprise-droner (Mavic 3 Enterprise/Multispectral/Thermal, Matrice 3D, M30, M350 RTK). Tegn området, velg høyde og overlapp – SkogIQ beregner systematiske flylinjer, antall bilder, flytid og batterier, og lager en rute du åpner i DJI Pilot 2.</p>
      <div class="knapper"><button type="button" class="knapp primar" data-d="nytt">✎ Tegn nytt område</button></div>
      <div class="liste">${liste.map((o) => { const p = beregn(o); return `<button type="button" class="rad" data-d-apne="${esc(o.id)}"><div><div class="tittel">${esc(o.navn)}</div><div class="under">${o.status === 'flydd' ? `✓ flydd ${esc(o.flydd || '')}` : 'planlagt'} · ${fmt(p?.arealDaa, 1)} daa · ${fmt(p?.gsd, 1)} cm/px · ${esc(DRONER[o.param.drone]?.navn || '')}</div></div><span>›</span></button>`; }).join('') || '<div class="tom">Ingen droneoppdrag ennå.</div>'}</div>`, { hoy: true });
  }

  function beregn(o) { try { return planlegg(o.geometri, o.param); } catch { return null; } }

  // ---------- planlegging ----------
  function visOppdrag(id, { zoom = false } = {}) {
    const o = finn(id); if (!o) { visListe(); return; }
    aapent = id;
    const p = beregn(o); tegnKart(o, p); if (zoom) zoomTil(o);
    if (!p) { aapneArk(`<h2>${esc(o.navn)}</h2><p>Området kunne ikke beregnes. Tegn det på nytt.</p><div class="knapper"><button type="button" class="knapp" data-d="endre-omrade">✎ Tegn på nytt</button></div>`); return; }
    if (visning === 'start') { visStart(o, p); return; }
    const t = terreng.get(o.id);
    const d = DRONER[o.param.drone];
    aapneArk(`<h2>${esc(o.navn)} <span class="beta">beta</span></h2>
      <div class="drone-tall">
        <div><b>${fmt(p.gsd, 1)}</b><span>cm/px</span></div><div><b>${fmt(p.arealDaa, 1)}</b><span>daa</span></div>
        <div><b>${fmt(p.flytid)}</b><span>min</span></div><div><b>${p.batterier}</b><span>batteri${p.batterier > 1 ? 'er' : ''}</span></div>
        <div><b>${fmt(p.bilder)}</b><span>bilder</span></div><div><b>${p.linjer.length}</b><span>linjer</span></div>
      </div>
      ${t ? `<p class="drone-terreng ${t.niva}">${t.niva === 'ok' ? '✓' : '⚠'} ${esc(t.tekst)}</p>` : '<p class="hint" id="droneTerreng">Sjekker terrenget …</p>'}
      <div class="skjema-felt">
        <label>Drone<select data-dp="drone">${Object.entries(DRONER).map(([k, x]) => `<option value="${k}" ${k === o.param.drone ? 'selected' : ''}>${esc(x.navn)}</option>`).join('')}</select></label>
        <label>Flyhøyde over startpunktet: <b>${fmt(p.hoyde)} m</b> (GSD ${fmt(p.gsd, 1)} cm/px)<input type="range" min="40" max="${MAKS_HOYDE}" step="5" value="${p.hoyde}" data-dp="hoyde"></label>
        <div class="to-kol">
          <label>Overlapp fram<select data-dp="overlappFram">${[70, 75, 80, 85, 90].map((v) => `<option value="${v}" ${v === o.param.overlappFram ? 'selected' : ''}>${v} %</option>`).join('')}</select></label>
          <label>Overlapp side<select data-dp="overlappSide">${[60, 65, 70, 75, 80, 85].map((v) => `<option value="${v}" ${v === o.param.overlappSide ? 'selected' : ''}>${v} %</option>`).join('')}</select></label>
        </div>
        <label>Flyretning<select data-dp="retning"><option value="">Automatisk (færrest vendinger) – nå ${fmt(p.retning)}°</option>${[0, 45, 90, 135].map((v) => `<option value="${v}" ${o.param.retning === v ? 'selected' : ''}>${v}° ${['nord–sør', 'nordøst–sørvest', 'øst–vest', 'sørøst–nordvest'][v / 45]}</option>`).join('')}</select></label>
      </div>
      <p class="hint">${fmt(p.fart, 1)} m/s · bilde hver ${fmt(p.bildeavstand)} m (${fmt(p.intervall, 1)} s) · ${fmt(p.linjeavstand)} m mellom linjene · ${fmt(p.lengde / 1000, 1)} km. Skog trenger høy overlapp (80/80) for at tretoppene skal la seg sette sammen. ${d.klasse ? `Dronen er klasse ${esc(d.klasse)}.` : ''}</p>
      <div class="knapper"><button type="button" class="knapp" data-d="endre-omrade">✎ Endre område</button><button type="button" class="knapp primar" data-d="til-start">Neste: start oppdraget ›</button></div>
      <div class="knapper"><button type="button" class="knapp" data-d="liste">‹ Alle droneoppdrag</button><button type="button" class="knapp fare" data-d="slett">Slett</button></div>`, { lav: true });
    if (!t) sjekkTerreng(o, p);
  }

  // Terrenghøyder fra Kartverket (DTM1) i hjørnene og et rutenett i området.
  async function sjekkTerreng(o, p) {
    if (!navigator.onLine) { const el = document.getElementById('droneTerreng'); if (el) el.textContent = 'Terrenget kan ikke sjekkes uten nett – start fra et høyt punkt.'; return; }
    try {
      const pts = [...p.polygonGeo];
      const xs = pts.map((q) => q[0]); const ys = pts.map((q) => q[1]);
      for (let i = 1; i < 6; i++) for (let j = 1; j < 6; j++) pts.push([Math.min(...xs) + ((Math.max(...xs) - Math.min(...xs)) * i) / 6, Math.min(...ys) + ((Math.max(...ys) - Math.min(...ys)) * j) / 6]);
      const url = `https://ws.geonorge.no/hoydedata/v1/punkt?koordsys=4258&geojson=false&punkter=${encodeURIComponent(JSON.stringify(pts.slice(0, 50).map(([x, y]) => [Number(x.toFixed(6)), Number(y.toFixed(6))])))}`;
      const j = await (await fetch(url)).json();
      const v = terrengVurdering((j.punkter || []).map((q) => q.z), p);
      if (v) { terreng.set(o.id, v); o.terreng = { min: v.min, max: v.max }; if (aapent === o.id && visning === 'plan') visOppdrag(o.id); }
    } catch { const el = document.getElementById('droneTerreng'); if (el) el.textContent = 'Terrengdata kunne ikke hentes – start fra et høyt punkt.'; }
  }

  // ---------- start: sjekkliste, nedlasting og veiledning ----------
  function visStart(o, p) {
    const s = o.sjekk || {}; const ok = SJEKKLISTE.filter((k) => s[k.id]).length;
    aapneArk(`<h2>Start: ${esc(o.navn)}</h2>
      <p class="hint">${fmt(p.arealDaa, 1)} daa · ${fmt(p.hoyde)} m · ${fmt(p.gsd, 1)} cm/px · ca. ${fmt(p.flytid)} min · ${p.batterier} batteri${p.batterier > 1 ? 'er' : ''} · ${fmt(p.bilder)} bilder</p>
      <h3>Før du flyr (${ok}/${SJEKKLISTE.length})</h3>
      <div class="sjekkliste">${SJEKKLISTE.map((k) => `<label class="sjekk"><input type="checkbox" data-d-sjekk="${k.id}" ${s[k.id] ? 'checked' : ''}><span>${esc(k.tekst)}</span></label>`).join('')}</div>
      <h3>1. Hent ruten</h3>
      <div class="knapper"><button type="button" class="knapp primar" data-d="kmz">⬇ Last ned rute (KMZ for DJI Pilot 2)</button>${navigator.canShare ? '<button type="button" class="knapp" data-d="del">Del …</button>' : ''}</div>
      <p class="hint">Enklest: åpne SkogIQ Felt i nettleseren på fjernkontrollen (DJI RC Plus / RC Pro Enterprise) og last ned der. Ellers: overfør filen med USB-kabel eller minnekort, eller last den opp i DJI FlightHub 2. <a href="#" data-d="kml">Bare området som KML</a></p>
      <h3>2. Åpne i DJI Pilot 2</h3>
      <ol class="drone-steg">
        <li><b>Ruter</b> (Flight Route) → <b>Importer rute</b> (ikonet øverst til høyre) → velg <i>${esc(filnavn(o.navn))}.kmz</i>.</li>
        <li>Åpne ruten og kontroller område, høyde, overlapp og at kameraet tar loddrette bilder (gimbal −90°).${terreng.get(o.id)?.niva !== 'ok' ? ' <b>Slå på terrengfølging</b> eller start fra det høyeste punktet.' : ''}</li>
        <li>Ta av fra et åpent sted med god sikt. Trykk <b>Start</b> og følg dronen med øynene hele tiden. Dronen returnerer selv når ruten er ferdig${p.batterier > 1 ? ' – og når batteriet må byttes, fortsetter du fra der den slapp' : ''}.</li>
      </ol>
      <h3>3. Etterpå</h3>
      <p class="hint">Bildene ligger på minnekortet med posisjon. Lag ortofoto i DJI Terra, Pix4D, Agisoft Metashape eller WebODM (gratis). Opplasting av ortofoto til SkogIQ kommer.</p>
      <div class="knapper"><button type="button" class="knapp" data-d="tilbake-plan">‹ Endre planen</button><button type="button" class="knapp ${o.status === 'flydd' ? '' : 'primar'}" data-d="flydd">${o.status === 'flydd' ? `✓ Flydd ${esc(o.flydd || '')} – angre` : '✓ Marker som flydd'}</button></div>`, { hoy: true });
  }

  function lastNed(navn, data, type) {
    const blob = new Blob([data], { type }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = navn; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function nytt({ geometri = null, navn = null, bestandId = null } = {}) {
    let g = geometri;
    if (!g) { const r = await tegnFlateGeo('Droneoppdrag – tegn området'); if (!r?.geometri) { visListe(); return; } g = r.geometri; }
    const S = P(); S.droneoppdrag = S.droneoppdrag || [];
    const nr = S.droneoppdrag.length + 1;
    const o = { id: nyId('d'), navn: navn || `Ortofoto ${nr}`, opprettet: new Date().toISOString().slice(0, 10), bestandId, geometri: g, param: { ...STANDARD_DRONE }, sjekk: {}, status: 'planlagt' };
    S.droneoppdrag.push(o); await lagrePlanen();
    visning = 'plan'; visOppdrag(o.id, { zoom: true });
  }

  // ---------- hendelser ----------
  async function klikk(e) {
    const el = (sel) => e.target.closest(sel);
    if (el('[data-d-apne]')) { visning = 'plan'; visOppdrag(el('[data-d-apne]').dataset.dApne, { zoom: true }); return true; }
    const h = el('[data-d]')?.dataset.d; if (!h) return false;
    e.preventDefault();
    const o = aapent && finn(aapent);
    if (h === 'nytt') await nytt();
    if (h === 'liste') visListe();
    if (h === 'til-start' && o) { visning = 'start'; visOppdrag(o.id); }
    if (h === 'tilbake-plan' && o) { visning = 'plan'; visOppdrag(o.id); }
    if (h === 'endre-omrade' && o) { const r = await tegnFlateGeo(`${o.navn} – endre området`, { start: o.geometri }); if (r?.geometri) { o.geometri = r.geometri; terreng.delete(o.id); await lagrePlanen(); } visOppdrag(o.id); }
    if (h === 'slett' && o) { if (!confirm(`Slette ${o.navn}?`)) return true; P().droneoppdrag = alle().filter((x) => x !== o); await lagrePlanen(); visListe(); }
    if ((h === 'kmz' || h === 'del' || h === 'kml') && o) {
      const p = beregn(o); if (!p) return true;
      const navn = filnavn(o.navn);
      if (h === 'kml') { lastNed(`${navn}.kml`, lagOmradeKml(p, o.navn), 'application/vnd.google-earth.kml+xml'); return true; }
      const kmz = lagKmz(p);
      if (h === 'del') {
        const fil = new File([kmz], `${navn}.kmz`, { type: 'application/vnd.google-earth.kmz' });
        if (navigator.canShare?.({ files: [fil] })) { try { await navigator.share({ files: [fil], title: o.navn }); } catch { /* avbrutt */ } return true; }
      }
      lastNed(`${navn}.kmz`, kmz, 'application/vnd.google-earth.kmz'); o.lastetNed = new Date().toISOString().slice(0, 10); await lagrePlanen();
      melding('Ruten er lastet ned. Importer den i DJI Pilot 2 (Ruter → Importer).', 5000);
    }
    if (h === 'flydd' && o) { if (o.status === 'flydd') { o.status = 'planlagt'; delete o.flydd; } else { o.status = 'flydd'; o.flydd = new Date().toISOString().slice(0, 10); } await lagrePlanen(); visOppdrag(o.id); }
    return true;
  }
  async function endring(e) {
    const t = e.target; const o = aapent && finn(aapent); if (!o) return false;
    if (t.dataset.dSjekk) { o.sjekk = { ...(o.sjekk || {}), [t.dataset.dSjekk]: t.checked }; await lagrePlanen(); const h = [...document.querySelectorAll('#arkInnhold h3')].find((x) => /^Før du flyr/.test(x.textContent)); if (h) h.textContent = `Før du flyr (${SJEKKLISTE.filter((k) => o.sjekk[k.id]).length}/${SJEKKLISTE.length})`; return true; }
    if (t.dataset.dp) {
      const k = t.dataset.dp; const v = t.value;
      o.param = { ...o.param, [k]: k === 'drone' ? v : k === 'retning' ? (v === '' ? null : Number(v)) : Number(v) };
      if (k === 'hoyde') terreng.delete(o.id);
      await lagrePlanen(); const rull = document.querySelector('#arkInnhold')?.scrollTop; visOppdrag(o.id); const a = document.querySelector('#arkInnhold'); if (a && rull) a.scrollTop = rull;
      return true;
    }
    return false;
  }
  // Glidebryteren oppdaterer tallene mens man drar (uten å tegne arket på nytt).
  function input(e) {
    const t = e.target; if (t.dataset?.dp !== 'hoyde') return false;
    const o = aapent && finn(aapent); if (!o) return false;
    const k = kamera(o.param.drone, Number(t.value));
    const b = t.closest('label')?.querySelector('b'); if (b) { b.textContent = `${fmt(Number(t.value))} m`; if (b.nextSibling) b.nextSibling.textContent = ` (GSD ${fmt(k.gsd, 1)} cm/px)`; }
    return true;
  }

  return {
    visListe, nytt, klikk, endring, input,
    fraBestand: (b) => nytt({ geometri: b.geometri, navn: `Ortofoto bestand ${b.nr}`, bestandId: b.id }),
    aktiv: () => !!aapent,
    nullstill: () => { aapent = null; visning = 'plan'; lag?.clearLayers(); },
  };
}
