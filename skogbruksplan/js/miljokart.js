// Felles kartstil for nøkkelbiotoper (MiS) og miljøfigurer – lik i alle kart (plankart, PEFC, Skogbrand, Veier,
// Skifteplan, Kommuneanalyse og rapportene). Tydelig magenta skravur med hvit halo, kraftig omriss og «MiS»-merke,
// slik at figurene skiller seg fra hogstklassefargene, risikofargene og markslagssymbolene.
import { etikettPunkt, arealM2 } from './proj.js';

export const MIS = { farge: '#c2187a', mork: '#7a0f4d', navn: 'Nøkkelbiotop (MiS)' };

// SVG-mønster (diagonal skravur). Brukes i Leaflet (SVG-renderer) via fillColor «url(#<prefiks>-skravur)» og i rapportene.
export const misMonster = (prefiks = 'mis') => `<pattern id="${prefiks}-skravur" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="${MIS.farge}" fill-opacity="0.16"/><rect width="2.6" height="9" fill="${MIS.farge}" fill-opacity="0.8"/></pattern>`;
// CSS-bakgrunn for tegnforklaringer.
export const misLegendStil = `background:repeating-linear-gradient(45deg, ${MIS.farge} 0 2px, rgba(194,24,122,.16) 2px 6px);box-shadow:inset 0 0 0 2px ${MIS.farge}`;
export const miljoLegendStil = `background:transparent;box-shadow:inset 0 0 0 2px ${MIS.farge};outline:1px dashed ${MIS.farge};outline-offset:-5px`;

// Nøkkelbiotoper fra planen (PEFC-objekter av type «noekkelbiotop») og bestand merket som miljøfigur.
export function misFigurer(S) {
  const ut = [];
  for (const o of S?.pefc?.objekter || []) {
    if (o.type !== 'noekkelbiotop' || !o.geometri || !/Polygon/.test(o.geometri.type)) continue;
    ut.push({ id: o.id, type: 'mis', navn: o.navn || 'Nøkkelbiotop', geometri: o.geometri, areal: arealM2(o.geometri) / 1000 });
  }
  for (const b of S?.bestand || []) {
    if (!b.miljo || !b.geometri || !/Polygon/.test(b.geometri.type)) continue;
    ut.push({ id: b.id, type: 'miljofigur', navn: `Bestand ${b.nr} – miljøfigur`, geometri: b.geometri, areal: b.areal || arealM2(b.geometri) / 1000 });
  }
  return ut;
}

// Leaflet-lag: { flater, merker }. svg = true gir skravur (krever misMonster i dokumentet); på canvas brukes halvgjennomsiktig fyll.
export function misKartlag(L, figurer, { svg = true, prefiks = 'mis', pane = null, renderer = null, tooltip = true } = {}) {
  const flater = L.featureGroup(); const merker = L.layerGroup();
  const felles = { interactive: false, ...(pane ? { pane } : {}), ...(renderer ? { renderer } : {}) };
  for (const f of figurer) {
    const miljofigur = f.type === 'miljofigur';
    L.geoJSON(f.geometri, { ...felles, style: { color: '#ffffff', weight: 7, opacity: 0.85, fill: false } }).addTo(flater);
    L.geoJSON(f.geometri, { ...felles, style: {
      color: MIS.farge, weight: miljofigur ? 2.5 : 3, opacity: 1, dashArray: miljofigur ? '8 5' : null,
      fill: !miljofigur, fillColor: svg ? `url(#${prefiks}-skravur)` : MIS.farge, fillOpacity: svg ? 1 : 0.28,
    } }).addTo(flater);
    if (miljofigur) continue;
    const c = etikettPunkt(f.geometri); if (!c) continue;
    const m = L.marker([c[1], c[0]], { icon: L.divIcon({ className: 'mis-merke', html: '<span>MiS</span>', iconSize: [36, 18], iconAnchor: [18, 9] }), keyboard: false });
    if (tooltip) m.bindTooltip(`<b>${f.navn.replace(/[<>&]/g, '')}</b><br>Nøkkelbiotop · ${f.areal.toFixed(1).replace('.', ',')} daa<br><span style="font-size:11px">Settes av urørt eller skjøttes etter plan (PEFC krav 22). Ikke kjør gjennom.</span>`, { direction: 'top', offset: [0, -8] });
    m.addTo(merker);
  }
  return { flater, merker };
}

// Viser «MiS»-merkene bare når kartet er zoomet inn nok til at de ikke dekker hverandre.
export function merkerVedZoom(kart, merker, minZoom = 12) {
  const oppdater = () => { const vis = kart.getZoom() >= minZoom; if (vis && !kart.hasLayer(merker)) merker.addTo(kart); if (!vis && kart.hasLayer(merker)) merker.remove(); };
  kart.on('zoomend', oppdater); oppdater();
  return () => { kart.off('zoomend', oppdater); merker.remove(); };
}
