// SkogIQ Felt: lag ny skogbruksplan rett fra kartet – for eiendommen der du står (GPS), eller den du peker ut med
// korset midt i kartet (eller trykker på). Samme motor som fullversjonen (js/plan-fra-kart.js → js/generator.js).
// Datagrunnlaget (PEFC-miljødata, veier, tømmerpriser) hentes i bakgrunnen etter at planen er åpnet.
import { eiendomVed, eiendomGrense, kommuneFor, lagSkogbruksplan, GEN_STEG } from './plan-fra-kart.js';
import { hentDatagrunnlag } from './datagrunnlag.js';
import { oppdaterKantsone } from './kantsone.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v, d = 0) => Number(v || 0).toLocaleString('nb-NO', { maximumFractionDigits: d });
function lastSkript(src, navn) {
  if (window[navn]) return Promise.resolve(window[navn]);
  return new Promise((ok, feil) => { const s = document.createElement('script'); s.src = src; s.onload = () => ok(window[navn]); s.onerror = () => feil(new Error('Kunne ikke laste geometribiblioteket. Sjekk nettforbindelsen.')); document.head.appendChild(s); });
}
export const lastTurf = () => lastSkript('https://unpkg.com/@turf/turf@7.2.0/turf.min.js', 'turf');
export const lastKlipping = () => lastSkript('https://unpkg.com/polygon-clipping@0.15.7/dist/polygon-clipping.umd.min.js', 'polygonClipping').catch(() => null);

export function initNyPlanFelt({ kart, L, aapneArk, lukkArk, melding, gpsPos, sikte, velgPlan, lagrePlan, hentPlan, aktivPlan, nyId, iAar = new Date().getFullYear() }) {
  let velger = false; let valgt = null; let grenseLag = null; let jobber = false;
  const fjernGrense = () => { if (grenseLag) { kart.removeLayer(grenseLag); grenseLag = null; } };

  function startVelg() {
    if (!navigator.onLine) { melding('Ny plan krever nett – data hentes fra Kartverket og NIBIO.'); return; }
    velger = true; valgt = null; fjernGrense(); sikte(true);
    aapneArk(`<h2>Ny skogbruksplan</h2><p class="hint">Flytt kartet slik at korset står på eiendommen – eller trykk på den i kartet.</p>
      <div class="knapper"><button type="button" class="knapp primar" data-np="sikte">✛ Velg eiendommen under korset</button><button type="button" class="knapp" data-np="gps">📍 Der jeg står</button><button type="button" class="knapp" data-np="avbryt">Avbryt</button></div>`, { lav: true });
  }
  async function slaOpp(lat, lon) {
    aapneArk('<h2>Ny skogbruksplan</h2><p class="hint">Finner eiendommen hos Kartverket …</p>', { lav: true });
    try {
      const l = await eiendomVed(lat, lon);
      if (!l.length) { aapneArk(`<h2>Ny skogbruksplan</h2><p>Fant ingen eiendom i punktet.</p><div class="knapper"><button type="button" class="knapp primar" data-np="igjen">Prøv et annet sted</button><button type="button" class="knapp" data-np="avbryt">Avbryt</button></div>`, { lav: true }); return; }
      await vis(l[0], l.slice(1));
    } catch (e) { aapneArk(`<h2>Ny skogbruksplan</h2><p>Kunne ikke slå opp eiendommen: ${esc(e.message)}</p><div class="knapper"><button type="button" class="knapp primar" data-np="igjen">Prøv igjen</button><button type="button" class="knapp" data-np="avbryt">Avbryt</button></div>`, { lav: true }); }
  }
  async function vis(e, andre = []) {
    valgt = e; velger = false; sikte(false);
    const k = await kommuneFor(e.kommunenr); valgt.kommune = k;
    aapneArk(`<h2>${esc(k.navn)} ${esc(e.tekst)}</h2><p class="hint">Henter eiendomsgrensen …</p>`, { lav: true });
    let g = null; try { g = await eiendomGrense(e); } catch { /* uten grense */ }
    fjernGrense();
    if (g) { grenseLag = L.geoJSON(g, { style: { color: '#d03b3b', weight: 3, dashArray: '7 5', fillColor: '#d03b3b', fillOpacity: 0.08 }, interactive: false }).addTo(kart); try { kart.fitBounds(grenseLag.getBounds(), { padding: [30, 30], maxZoom: 16 }); } catch { /* tom */ } }
    const teiger = g ? g.coordinates.length : 0;
    aapneArk(`<h2>${esc(k.navn)} ${esc(e.tekst)}</h2>
      <p>Gnr/bnr <b>${esc(e.tekst)}</b> i ${esc(k.navn)} kommune${teiger ? ` · ${teiger} teig${teiger === 1 ? '' : 'er'} (rød stiplet i kartet)` : ''}${e.sameie ? ' · teigen har flere eiere (sameie)' : ''}.</p>
      ${andre.length ? `<p class="hint">Andre eiendommer i punktet: ${andre.map((x) => `<button type="button" class="lenkeknapp" data-np-andre="${esc(JSON.stringify(x))}">${esc(x.tekst)}</button>`).join(', ')}</p>` : ''}
      <p class="hint">Planen lages fra Kartverket, NIBIO (tidligere plan, SR16, AR5) og miljøregistreringene – som i fullversjonen. Det tar som regel under ett minutt.</p>
      <div class="knapper"><button type="button" class="knapp primar" data-np="lag">✦ Lag skogbruksplan</button><button type="button" class="knapp" data-np="igjen">Velg en annen</button><button type="button" class="knapp" data-np="avbryt">Avbryt</button></div>`, { lav: false });
  }
  async function lag() {
    if (!valgt || jobber) return; jobber = true; const e = valgt;
    const status = Object.fromEntries(GEN_STEG.map(([id]) => [id, { s: 'venter', t: 'Venter' }]));
    const tegnSteg = () => { const ul = document.querySelector('#npSteg'); if (ul) ul.innerHTML = GEN_STEG.map(([id, navn]) => `<li class="${status[id].s}"><span>${status[id].s === 'ok' ? '✓' : status[id].s === 'feil' ? '✕' : status[id].s === 'aktiv' ? '●' : '○'}</span><div><b>${esc(navn)}</b><small>${esc(status[id].t)}</small></div></li>`).join(''); };
    aapneArk(`<h2>Lager plan for ${esc(e.kommune?.navn || '')} ${esc(e.tekst)}</h2><ul class="np-steg" id="npSteg"></ul><p class="hint">Hold appen åpen til planen er klar.</p>`, { hoy: true }); tegnSteg();
    try {
      const [turf, klipping] = await Promise.all([lastTurf(), lastKlipping()]);
      const ny = await lagSkogbruksplan(e, { turf, klipping, nyId, iAar, logg: (st, s, t) => { if (status[st]) { status[st] = { s, t }; tegnSteg(); } } });
      try { await oppdaterKantsone(ny, { turf, PC: klipping }); } catch { /* kantsonen hentes ved neste åpning */ } // 💧 15 m mot vann
      await lagrePlan(ny); fjernGrense();
      const skog = ny.bestand.reduce((s, b) => s + (b.areal || 0), 0); const vol = ny.bestand.reduce((s, b) => s + (b.volumDaa || 0) * (b.areal || 0), 0);
      aapneArk(`<h2>✓ ${esc(ny.eiendom.navn)} er klar</h2>
        <div class="tall-rad"><div class="tall"><b>${fmt(skog)}</b><span>daa skog</span></div><div class="tall"><b>${ny.bestand.length}</b><span>bestand</span></div><div class="tall"><b>${fmt(vol)}</b><span>m³ (SR16)</span></div></div>
        <p class="hint">Miljødata, veier og tømmerpriser hentes i bakgrunnen og legges inn i planen. Planen lagres på mobilen${navigator.onLine ? ' og i skyen når du er logget inn' : ''}, og kan åpnes i fullversjonen.</p>
        <div class="knapper"><button type="button" class="knapp primar" data-np="apne" data-id="${esc(ny.planId)}">Åpne planen</button></div>`, { lav: false });
      // Datagrunnlaget i bakgrunnen – legges inn i planen når det kommer (også om den er åpnet i mellomtiden).
      hentDatagrunnlag(ny, { nyId, kommunenr: e.kommunenr }).then(async () => {
        const felt = (x) => { x.pefc = ny.pefc; x.veier = ny.veier; x.verdi = ny.verdi; x.datakilder = { ...x.datakilder, ...ny.datakilder }; x.endret = new Date().toISOString(); };
        const aktiv = aktivPlan(); if (aktiv?.planId === ny.planId) { felt(aktiv); await lagrePlan(aktiv); } else { const l = await hentPlan(ny.planId); if (l) { felt(l); await lagrePlan(l); } }
        melding(`Datagrunnlaget for ${ny.eiendom.navn} er lagt inn.`);
      }).catch(() => melding('Datagrunnlaget kunne ikke hentes nå – prøv «Oppdater alle» i fullversjonen.'));
    } catch (err) {
      aapneArk(`<h2>Kunne ikke lage planen</h2><p>${esc(err.message)}</p><div class="knapper"><button type="button" class="knapp primar" data-np="lag">Prøv igjen</button><button type="button" class="knapp" data-np="avbryt">Avbryt</button></div>`, { lav: true });
    } finally { jobber = false; }
  }
  function avbryt() { velger = false; valgt = null; sikte(false); fjernGrense(); lukkArk(); }

  document.addEventListener('click', async (ev) => {
    const a = ev.target.closest?.('[data-np-andre]'); if (a) { await vis(JSON.parse(a.dataset.npAndre)); return; }
    const k = ev.target.closest?.('[data-np]'); if (!k) return; const h = k.dataset.np;
    if (h === 'start' || h === 'igjen') startVelg();
    if (h === 'avbryt') avbryt();
    if (h === 'sikte') { const c = kart.getCenter(); await slaOpp(c.lat, c.lng); }
    if (h === 'gps') { aapneArk('<h2>Ny skogbruksplan</h2><p class="hint">Finner posisjonen din …</p>', { lav: true }); const p = await gpsPos(); if (!p) { aapneArk('<h2>Ny skogbruksplan</h2><p>Fikk ikke posisjon. Slå på posisjonstjenester, eller velg eiendommen i kartet.</p><div class="knapper"><button type="button" class="knapp primar" data-np="start">✛ Velg i kartet</button></div>', { lav: true }); return; } kart.setView([p.lat, p.lon], Math.max(kart.getZoom(), 15)); await slaOpp(p.lat, p.lon); }
    if (h === 'lag') await lag();
    if (h === 'apne') { lukkArk(); await velgPlan(k.dataset.id); }
  });
  return {
    start: startVelg,
    velger: () => velger,
    // Trykk i kartet mens man velger eiendom: slå opp i punktet.
    klikk: (ll) => { if (!velger) return false; slaOpp(ll.lat, ll.lng); return true; },
  };
}
