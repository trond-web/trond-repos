// 📌 Egne kartlag i fullversjonen: panel i Data-fanen (importer, gi navn, farge, vis/skjul, zoom, slett) og ett
// kartlag per fil i lagvelgeren. Data og parsing i js/egne-lag.js; lagene lagres i planen (S.egneLag).
import { FILTYPER, lesEgenFil, nyttLag, lagKartlag, antallTekst, FARGER } from './egne-lag.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function initEgneLag({ L, kart, lagKontroll, hentPlan, endret, melding, nyId, panel }) {
  const kartlag = new Map(); // id → { lag (Leaflet), nokkel (endret+farge+navn) }
  let resultat = '';
  const liste = () => (hentPlan().egneLag ||= []);

  function synk() {
    const S = hentPlan(); const lag = S.egneLag || []; const ider = new Set(lag.map((l) => l.id));
    for (const [id, k] of kartlag) if (!ider.has(id)) { lagKontroll()?.removeLayer(k.lag); k.lag.remove(); kartlag.delete(id); }
    for (const l of lag) {
      const nokkel = `${l.endret}|${l.farge}|${l.navn}`; let k = kartlag.get(l.id);
      if (k && k.nokkel !== nokkel) { lagKontroll()?.removeLayer(k.lag); k.lag.remove(); kartlag.delete(l.id); k = null; }
      if (!k) { k = { lag: lagKartlag(L, l, { pane: 'egneLagPane' }), nokkel }; k.lag._egetLagId = l.id; kartlag.set(l.id, k); lagKontroll()?.addOverlay(k.lag, `📌 ${esc(l.navn)}`); }
      if (l.synlig !== false && !kart.hasLayer(k.lag)) k.lag.addTo(kart);
      if (l.synlig === false && kart.hasLayer(k.lag)) k.lag.remove();
    }
  }
  // Av/på i lagvelgeren lagres i planen
  const vedLag = (paa) => (e) => { const id = e.layer?._egetLagId; if (!id) return; const l = liste().find((x) => x.id === id); if (l && (l.synlig !== false) !== paa) { l.synlig = paa; endret(); tegnPanel(); } };
  kart.on('overlayadd', vedLag(true)); kart.on('overlayremove', vedLag(false));

  function tegnPanel() {
    if (!panel) return; const lag = liste();
    panel.innerHTML = `<h3>📌 Egne kartlag</h3>
      <p class="hint">Legg inn egne data som kartlag: mastefester og traséer fra Statnett eller nettselskapet, stier, poster, jaktposter, grøfter o.l. GPX (GPS, Garmin), KML/KMZ (Google Earth, Norgeskart) og GeoJSON i WGS84. Lagene lagres i planen, vises i kartet og i SkogIQ Felt, og trykk på et objekt viser navn og opplysninger.</p>
      <div class="slipp-sone" data-el-slipp>Dra GPX-, KML- eller KMZ-fila hit, eller <label class="lenke">velg fil<input type="file" data-el-fil multiple accept="${FILTYPER}" hidden></label></div>
      <div data-el-resultat>${resultat}</div>
      ${lag.length ? `<div style="display:grid;gap:6px;margin-top:10px">${lag.map((l) => `<div class="eget-lag-rad" data-el-id="${esc(l.id)}" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;border:1px solid var(--linje, #d9ddd5);border-radius:10px;padding:6px 8px">
          <label title="Vis i kartet" style="display:flex;align-items:center;gap:4px"><input type="checkbox" data-el="synlig" ${l.synlig !== false ? 'checked' : ''}></label>
          <input type="color" data-el="farge" value="${esc(l.farge)}" title="Farge" style="width:30px;height:26px;padding:0;border:none;background:none">
          <input data-el="navn" value="${esc(l.navn)}" maxlength="80" aria-label="Navn på laget" style="flex:1;min-width:140px;font:inherit;padding:4px 6px">
          <span class="hint" style="font-size:12px">${esc(antallTekst(l.antall || {}))}${l.filnavn ? ` · ${esc(l.filnavn)}` : ''}</span>
          <button type="button" class="knapp liten" data-el="zoom" title="Zoom til laget">🔍</button>
          <button type="button" class="knapp liten fare" data-el="slett" title="Slett laget">🗑</button>
        </div>`).join('')}</div>` : ''}`;
  }

  async function importer(filer) {
    const ut = []; const S = hentPlan(); let siste = null;
    for (const fil of filer) {
      try {
        const r = await lesEgenFil(fil.name, await fil.arrayBuffer());
        const l = nyttLag(r, { id: nyId('lag'), filnavn: fil.name, brukte: liste().map((x) => x.farge) });
        (S.egneLag ||= []).push(l); siste = l;
        ut.push(`<div>✅ <b>${esc(fil.name)}</b>: «${esc(l.navn)}» – ${esc(antallTekst(l.antall))}.</div>`);
      } catch (e) { ut.push(`<div>❌ <b>${esc(fil.name)}</b>: ${esc(e.message)}</div>`); }
    }
    resultat = ut.join(''); endret(); synk(); tegnPanel();
    if (siste) zoom(siste.id);
    return ut.length;
  }
  function zoom(id) { const k = kartlag.get(id); if (!k) return; try { const b = k.lag.getBounds(); if (b.isValid()) kart.fitBounds(b, { padding: [30, 30], maxZoom: 16 }); } catch { /* tomt */ } }

  if (panel) {
    panel.addEventListener('change', (e) => {
      if (e.target.matches('[data-el-fil]')) { if (e.target.files.length) importer([...e.target.files]); e.target.value = ''; return; }
      const rad = e.target.closest('[data-el-id]'); if (!rad) return; const l = liste().find((x) => x.id === rad.dataset.elId); if (!l) return;
      const h = e.target.dataset.el; const naa = new Date().toISOString();
      if (h === 'synlig') { l.synlig = e.target.checked; endret(); synk(); }
      if (h === 'farge' && FARGER) { l.farge = e.target.value; l.endret = naa; endret(); synk(); }
      if (h === 'navn') { l.navn = e.target.value.trim().slice(0, 80) || l.navn; l.endret = naa; endret(); synk(); }
    });
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-el]'); const rad = e.target.closest('[data-el-id]'); if (!b || !rad || b.tagName !== 'BUTTON') return;
      const id = rad.dataset.elId; const l = liste().find((x) => x.id === id); if (!l) return;
      if (b.dataset.el === 'zoom') { if (l.synlig === false) { l.synlig = true; endret(); synk(); tegnPanel(); } zoom(id); }
      if (b.dataset.el === 'slett' && confirm(`Slette kartlaget «${l.navn}»?`)) { hentPlan().egneLag = liste().filter((x) => x.id !== id); endret(); synk(); tegnPanel(); melding?.(`Kartlaget «${l.navn}» er slettet`); }
    });
    panel.addEventListener('dragover', (e) => { if (e.target.closest('[data-el-slipp]')) { e.preventDefault(); e.target.closest('[data-el-slipp]').classList.add('over'); } });
    panel.addEventListener('dragleave', (e) => e.target.closest?.('[data-el-slipp]')?.classList.remove('over'));
    panel.addEventListener('drop', (e) => { const s = e.target.closest('[data-el-slipp]'); if (!s) return; e.preventDefault(); s.classList.remove('over'); importer([...e.dataTransfer.files]); });
  }
  return { oppdater: () => { synk(); tegnPanel(); }, importer, zoom };
}
