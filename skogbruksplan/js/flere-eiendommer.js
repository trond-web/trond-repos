// Flere eiendommer i kartet samtidig: andre lagrede skogbruksplaner kan slås på i kartet ved siden av planen som er
// åpen. De tegnes under den åpne planen med eiendomsgrense i egen farge, bestand farget etter hogstklasse og navn på
// eiendommen. Klikk på en annen eiendom viser nøkkeltall og «Åpne planen». Valget lagres i nettleseren.
import { STANDARD_INNSTILLINGER, startTilstand, beregnetHogstklasse, hogstklasseFor, laavesteHogstalder, hkGrenser } from './model.js';

// Fargene skiller eiendommene fra hverandre (og fra den åpne planen, som har rød stiplet grense).
export const EIENDOM_FARGER = ['#2a78d6', '#7a3fb8', '#0f8f8a', '#c2410c', '#a21caf', '#4d7c0f', '#0369a1', '#b45309'];
const HK_FARGER = ['#fcfdfe', '#f8f6a9', '#d9f6c7', '#9bd47f', '#ef9a7c'];
const NOKKEL = 'synligePlaner';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v, d = 0) => Number(v || 0).toLocaleString('nb-NO', { maximumFractionDigits: d, minimumFractionDigits: d });

export function hkFor(b, inn) { return hogstklasseFor(b, inn); }

// Avgrensningsboks [minLon, minLat, maxLon, maxLat] for en plan (grense eller bestand).
export function planBoks(plan) {
  let b = null;
  const legg = (c) => { if (typeof c[0] === 'number') { b = b ? [Math.min(b[0], c[0]), Math.min(b[1], c[1]), Math.max(b[2], c[0]), Math.max(b[3], c[1])] : [c[0], c[1], c[0], c[1]]; } else c.forEach(legg); };
  if (plan.eiendom?.grense?.coordinates) legg(plan.eiendom.grense.coordinates);
  else for (const x of plan.bestand || []) if (x.geometri?.coordinates) legg(x.geometri.coordinates);
  return b;
}

export function initFlereEiendommer({ L, kart, hentPlan, listPlaner, hentVerdi, lagreVerdi, aktivId, aapnePlan, padding = () => ({}), endretSynlig = () => {}, opptatt = () => false }) {
  kart.createPane('andrePane'); kart.getPane('andrePane').style.zIndex = 390; // under den åpne planens bestand (overlayPane 400)
  const lag = L.featureGroup().addTo(kart);
  let synlige = new Set();
  const cache = new Map(); // id -> { endret, plan }
  const fargeFor = new Map();
  let tegnNr = 0;

  const farge = (id) => {
    if (!fargeFor.has(id)) fargeFor.set(id, EIENDOM_FARGER[fargeFor.size % EIENDOM_FARGER.length]);
    return fargeFor.get(id);
  };
  async function last(id, endret) {
    const c = cache.get(id);
    if (c && c.endret === endret) return c.plan;
    const plan = await hentPlan(id);
    if (plan) cache.set(id, { endret, plan });
    return plan;
  }
  const lagre = () => lagreVerdi(NOKKEL, [...synlige]);

  function popup(plan, id) {
    const areal = (plan.bestand || []).reduce((s, b) => s + (b.areal || 0), 0);
    const inn = { ...STANDARD_INNSTILLINGER, ...plan.innstillinger };
    const volum = (plan.bestand || []).reduce((s, b) => s + startTilstand(b).volumDaa * (b.areal || 0), 0);
    const hk5 = (plan.bestand || []).filter((b) => hkFor(b, inn) === 5).reduce((s, b) => s + (b.areal || 0), 0);
    const div = document.createElement('div'); div.className = 'andre-popup';
    div.innerHTML = `<b>${esc(plan.eiendom?.navn || 'Plan')}</b>
      <div class="hint">${fmt(areal)} daa produktiv skog · ${(plan.bestand || []).length} bestand</div>
      <div class="hint">${fmt(volum)} m³ · ${fmt(hk5)} daa hogstmoden</div>
      <div class="knapperad" style="margin:8px 0 0"><button type="button" class="knapp liten primar" data-ae="aapne">Åpne planen</button><button type="button" class="knapp liten" data-ae="skjul">Skjul</button></div>`;
    div.querySelector('[data-ae="aapne"]').onclick = () => { kart.closePopup(); aapnePlan(id); };
    div.querySelector('[data-ae="skjul"]').onclick = () => { kart.closePopup(); settSynlig(id, false); };
    return div;
  }

  // Tegner alle synlige planer unntatt den som er åpen.
  async function tegn() {
    const nr = ++tegnNr;
    const liste = await listPlaner();
    const finnes = new Set(liste.map((p) => p.id));
    for (const id of [...synlige]) if (!finnes.has(id)) synlige.delete(id);
    const vis = liste.filter((p) => synlige.has(p.id) && p.id !== aktivId());
    const planer = (await Promise.all(vis.map(async (p) => [p, await last(p.id, p.endret)]))).filter(([, pl]) => pl);
    if (nr !== tegnNr) return; // en nyere tegning er startet
    lag.clearLayers();
    for (const [p, plan] of planer) {
      const f = farge(p.id); const inn = { ...STANDARD_INNSTILLINGER, ...plan.innstillinger };
      const gruppe = L.featureGroup();
      for (const b of plan.bestand || []) {
        if (!b.geometri) continue;
        const h = hkFor(b, inn);
        L.geoJSON(b.geometri, { pane: 'andrePane', style: { color: f, weight: 0.8, opacity: 0.7, fillColor: h ? HK_FARGER[h - 1] : '#999', fillOpacity: h ? 0.55 : 0.1 } }).addTo(gruppe);
      }
      if (plan.eiendom?.grense) L.geoJSON(plan.eiendom.grense, { pane: 'andrePane', style: { color: f, weight: 2.5, dashArray: '6 4', fill: false } }).addTo(gruppe);
      gruppe.on('click', (e) => { if (opptatt()) return; L.DomEvent.stopPropagation(e); L.popup({ maxWidth: 260 }).setLatLng(e.latlng).setContent(popup(plan, p.id)).openOn(kart); });
      const bb = planBoks(plan);
      if (bb) L.tooltip({ permanent: true, direction: 'center', className: 'andre-etikett', interactive: false, pane: 'tooltipPane' }).setLatLng([(bb[1] + bb[3]) / 2, (bb[0] + bb[2]) / 2]).setContent(`<span style="border-color:${f};color:${f}">${esc(plan.eiendom?.navn || p.navn)}</span>`).addTo(gruppe);
      gruppe.addTo(lag);
    }
    endretSynlig();
  }

  function settSynlig(id, paa) {
    if (paa) synlige.add(id); else synlige.delete(id);
    lagre(); tegn();
  }

  return {
    lag,
    async start() { try { synlige = new Set((await hentVerdi(NOKKEL)) || []); } catch { synlige = new Set(); } await tegn(); },
    tegn,
    erSynlig: (id) => synlige.has(id),
    antall: () => [...synlige].filter((id) => id !== aktivId()).length,
    settSynlig,
    async settAlle(paa) { synlige = paa ? new Set((await listPlaner()).map((p) => p.id)) : new Set(); lagre(); await tegn(); },
    glem: (id) => { synlige.delete(id); cache.delete(id); lagre(); tegn(); },
    // Zoomer til den åpne planen og alle synlige eiendommer.
    async zoomAlle(ekstraBoks = null) {
      const liste = await listPlaner();
      const bokser = [ekstraBoks];
      for (const p of liste) if (synlige.has(p.id) && p.id !== aktivId()) { const pl = await last(p.id, p.endret); if (pl) bokser.push(planBoks(pl)); }
      const g = bokser.filter(Boolean);
      if (!g.length) return;
      kart.fitBounds([[Math.min(...g.map((b) => b[1])), Math.min(...g.map((b) => b[0]))], [Math.max(...g.map((b) => b[3])), Math.max(...g.map((b) => b[2]))]], padding());
    },
    legend() {
      const vis = [...synlige].filter((id) => id !== aktivId() && cache.has(id));
      if (!vis.length) return '';
      return `<b style="display:block;margin-top:6px">Andre eiendommer</b>${vis.map((id) => `<div><i style="background:transparent;border:2px dashed ${farge(id)}"></i>${esc(cache.get(id).plan.eiendom?.navn || 'Plan')}</div>`).join('')}`;
    },
  };
}
