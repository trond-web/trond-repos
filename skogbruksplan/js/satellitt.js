// Satellittbilder i kartet: Kartverkets skyfrie Sentinel-2-mosaikker (én per sommer, 10 m oppløsning, CC BY 4.0).
// Brukes til å se endringer i skogen siden forrige takst – flatehogst, stormfall og skader vises som lyse/brune felt.
//   * Kartlaget «Satellitt (Sentinel-2)» med valg av år, og sammenligning av to år med en glider (venstre/høyre).
//   * Bildestripe for et bestand: samme utsnitt for hvert år 2018–2025 med bestandsgrensen tegnet inn.
// Mosaikkene settes sammen av scener fra 1. juni til 31. august hvert år (atmosfærekorrigert av Kartverket).
export const SENTINEL2_WMS = 'https://wms.geonorge.no/skwms1/wms.sentinel2';
export const SATELLITT_AAR = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
export const SISTE_SATELLITTAAR = SATELLITT_AAR.at(-1);
export const KILDE = { navn: 'Kartverket: Sentinel-2 skyfri mosaikk', url: 'https://data.norge.no/datasets/06d12e44-c399-3a5c-a8a9-5124ce5c6534' };
export const kreditering = (aar) => `Inneholder modifiserte Copernicus Sentinel-data ${aar}, prosessert av Kartverket (CC BY 4.0)`;

// ---------- utsnitt (uten DOM) ----------
const R = 6378137;
export const tilMercator = ([lon, lat]) => [(lon * Math.PI * R) / 180, R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))];
const ringer = (g) => (g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []);
// Kvadratisk utsnitt (EPSG:3857) rundt geometrien med margin, minst minM meter på bakken. Gir { bbox, sti } der sti er
// SVG-stien (path d) for grensen i et px × px-bilde.
export function utsnitt(geometri, { px = 200, margin = 0.3, minM = 250 } = {}) {
  const pts = ringer(geometri).flatMap((p) => p.flat()); if (!pts.length) return null;
  const m = pts.map(tilMercator);
  const x0 = Math.min(...m.map((p) => p[0])); const x1 = Math.max(...m.map((p) => p[0])); const y0 = Math.min(...m.map((p) => p[1])); const y1 = Math.max(...m.map((p) => p[1]));
  // Mercator strekker avstander med 1/cos(breddegrad); minM gjelder meter på bakken.
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length; const skala = 1 / Math.cos((lat * Math.PI) / 180);
  const side = Math.max(x1 - x0, y1 - y0, minM * skala) * (1 + 2 * margin); const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
  const bbox = [cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2];
  const tilPx = ([x, y]) => [((x - bbox[0]) / side) * px, ((bbox[3] - y) / side) * px];
  const sti = ringer(geometri).flatMap((p) => p.map((r) => `M${r.map((q) => tilPx(tilMercator(q)).map((v) => v.toFixed(1)).join(' ')).join('L')}Z`)).join('');
  return { bbox, sti, px, sideM: Math.round(side / skala) };
}
export function bildeUrl(aar, bbox, px = 200, format = 'image/jpeg') {
  return `${SENTINEL2_WMS}?${new URLSearchParams({ SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetMap', LAYERS: String(aar), STYLES: '', CRS: 'EPSG:3857', BBOX: bbox.map((v) => v.toFixed(1)).join(','), WIDTH: px, HEIGHT: px, FORMAT: format })}`;
}
// Bildestripe for et bestand (HTML). Bildene lastes først når stripa vises (loading=lazy).
export function bestandStripeHtml(b, { px = 150, aarene = SATELLITT_AAR } = {}) {
  const u = b?.geometri && utsnitt(b.geometri, { px }); if (!u) return '';
  // Takståret: år før og med det er nedtonet. Er taksten nyere enn siste bilde (f.eks. registrert i år), tones ingenting ned.
  const t = Number(b.ekstra?.REGAAR || b.takstAar || 0); const fra = t >= SATELLITT_AAR[0] && t < SISTE_SATELLITTAAR ? t : null;
  return `<div class="sat-stripe">${aarene.map((a) => `<button type="button" class="sat-bilde${fra && a <= fra ? ' for-takst' : ''}" data-sat-aar="${a}" title="Vis ${a} i kartet">
    <img src="${bildeUrl(a, u.bbox, px * 2)}" alt="Sentinel-2 ${a}" loading="lazy" width="${px}" height="${px}">
    <svg viewBox="0 0 ${px} ${px}" aria-hidden="true"><path d="${u.sti}"/></svg><span>${a}</span></button>`).join('')}</div>
    <p class="hint">Sommermosaikk fra Sentinel-2 (10 m), ca. ${u.sideM} m utsnitt. Lyse eller brune felt i skogen kan være hogst, stormfall eller skader${fra ? ` – år til og med takståret (${fra}) er nedtonet` : ''}. Klikk et år for å vise det i kartet. ${kreditering(`2018–${SISTE_SATELLITTAAR}`)}.</p>`;
}

// ---------- kartlag (Leaflet) ----------
const wms = (aar, pane) => L.tileLayer.wms(SENTINEL2_WMS, { layers: String(aar), format: 'image/jpeg', version: '1.3.0', maxZoom: 20, attribution: kreditering(aar), ...(pane ? { pane } : {}) });
// Gir { lag (grunnkart for lagvelgeren), vis(aar), aktiv() }. Panelet nederst i kartet styrer år og sammenligning.
export function lagSatellittVisning(kart, { aar = SISTE_SATELLITTAAR } = {}) {
  let valgt = aar; let mot = null; let delt = 0.5; let paa = false;
  const lag = wms(valgt);
  kart.createPane('satMotPane'); const pane = kart.getPane('satMotPane'); pane.style.zIndex = 250; pane.style.pointerEvents = 'none';
  let motLag = null;
  const boks = document.createElement('div'); boks.className = 'sat-panel'; boks.hidden = true;
  const linje = document.createElement('div'); linje.className = 'sat-linje'; linje.hidden = true;
  kart.getContainer().append(linje, boks);
  L.DomEvent.disableClickPropagation(boks); L.DomEvent.disableScrollPropagation(boks);
  const valg = (v, tom) => `${tom ? `<option value="">${tom}</option>` : ''}${SATELLITT_AAR.map((a) => `<option value="${a}" ${a === v ? 'selected' : ''}>${a}</option>`).join('')}`;
  function tegnPanel() {
    boks.innerHTML = `<b>🛰 Sentinel-2</b><select data-sat="aar" aria-label="År">${valg(valgt)}</select>
      <label>Sammenlign med <select data-sat="mot">${valg(mot, 'ingen')}</select></label>
      ${mot ? `<input type="range" min="0" max="100" value="${Math.round(delt * 100)}" data-sat="delt" aria-label="Flytt skillet mellom årene">` : ''}
      <small>${mot ? `Venstre ${valgt} · høyre ${mot}` : 'Sommerbilder, 10 m'}</small>`;
  }
  function klipp() {
    if (!motLag) { pane.style.clip = ''; linje.hidden = true; return; }
    const st = kart.getSize(); const x = st.x * delt;
    const nw = kart.containerPointToLayerPoint([0, 0]); const se = kart.containerPointToLayerPoint(st); const cx = kart.containerPointToLayerPoint([x, 0]).x;
    pane.style.clip = `rect(${nw.y}px, ${se.x}px, ${se.y}px, ${cx}px)`;
    linje.hidden = false; linje.style.left = `${x}px`; linje.dataset.venstre = valgt; linje.dataset.hoyre = mot;
  }
  function settMot(a) {
    mot = a || null; if (motLag) { kart.removeLayer(motLag); motLag = null; }
    if (mot && paa) { motLag = wms(mot, 'satMotPane').addTo(kart); }
    tegnPanel(); klipp();
  }
  boks.addEventListener('change', (e) => {
    const t = e.target.dataset.sat;
    if (t === 'aar') { valgt = Number(e.target.value); lag.setParams({ layers: String(valgt) }); lag.options.attribution = kreditering(valgt); tegnPanel(); klipp(); }
    if (t === 'mot') settMot(Number(e.target.value) || null);
  });
  boks.addEventListener('input', (e) => { if (e.target.dataset.sat === 'delt') { delt = Number(e.target.value) / 100; klipp(); } });
  kart.on('move zoom resize viewreset', klipp);
  lag.on('add', () => { paa = true; boks.hidden = false; tegnPanel(); settMot(mot); });
  lag.on('remove', () => { paa = false; boks.hidden = true; if (motLag) { kart.removeLayer(motLag); motLag = null; } klipp(); });
  return {
    lag,
    aktiv: () => paa,
    // Viser året (og eventuelt et år å sammenligne med) som grunnkart.
    vis(a, sammenlign = null) { valgt = a; lag.setParams({ layers: String(valgt) }); lag.options.attribution = kreditering(valgt); if (paa) settMot(sammenlign); else mot = sammenlign; return lag; },
  };
}
