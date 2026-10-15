// Jaktfelt og valdgrenser fra valdkartet (data/jaktfelt.geojson). Rene funksjoner uten DOM, så de kan testes.
import { punktIPolygon, avstandTilGrense, bbox } from './geo.js';

// Én farge per vald. Valgt for å skille seg fra villreingrensa (rød), eiendomsgrensene (magenta) og jaktgrunnene (grønn).
export const VALD = {
  1: { navn: 'Hemsedal', farge: '#1d4ed8' },
  2: { navn: 'Ål', farge: '#0891b2' },
  3: { navn: 'Hol', farge: '#ea580c' },
  4: { navn: 'Aurland', farge: '#a16207' },
  5: { navn: 'Lærdal', farge: '#7c3aed' },
  6: { navn: 'Ulvik', farge: '#0f766e' },
};
export const TVIST_FARGE = '#dc2626';
export const UTEN_FARGE = '#6b7280';

export const farge = (p) => (p.type === 'tvist' ? TVIST_FARGE : p.type === 'uten' ? UTEN_FARGE : VALD[p.vald]?.farge || UTEN_FARGE);
export const valdTekst = (p) => (p.vald ? `Vald ${p.vald} ${VALD[p.vald]?.navn || p.valdnavn || ''}`.trim() : '');
export const feltTekst = (p) => (p.type === 'tvist' ? p.nr.replace(/^Tvist/i, 'Tvist') : [p.nr, p.navn].filter(Boolean).join(' '));

// Legger til avgrensningsboks på hvert objekt, så oppslag i punkt går raskt.
export function forbered(fc) {
  for (const f of fc.features) f.boks = bbox(f.geometry);
  return fc;
}

// Jaktfeltet i punktet (eller null). Tvist går foran vanlige felt, så overlapp med tvist vises.
export function jaktfeltI(p, fc) {
  let funnet = null;
  for (const f of fc.features) {
    const b = f.boks || bbox(f.geometry);
    if (p[0] < b[0] || p[0] > b[2] || p[1] < b[1] || p[1] > b[3]) continue;
    if (!punktIPolygon(p, f.geometry)) continue;
    if (f.properties.type === 'tvist') return f;
    if (!funnet || (funnet.properties.type === 'uten' && f.properties.type === 'jaktfelt')) funnet = f;
  }
  return funnet;
}

// Kort tekst for statuskortet og punktinfo.
export function beskriv(p, fc) {
  const f = jaktfeltI(p, fc);
  if (!f) return { klasse: 'liten', tekst: 'Ikke i noe jaktfelt i valdkartet' };
  const e = f.properties;
  const d = avstandTilGrense(p, f.geometry);
  if (e.type === 'tvist') return { klasse: 'feil', tekst: `${feltTekst(e)} – omstridt område`, felt: f, grense: d };
  if (e.type === 'uten') return { klasse: 'advarsel', tekst: 'Område uten jaktfelt i valdkartet', felt: f, grense: d };
  return { klasse: 'ok', tekst: feltTekst(e), vald: valdTekst(e), felt: f, grense: d };
}

// Punkt godt inne i flaten (der navnet skal stå): beste punkt i et rutenett over den største delflaten.
export function etikettpunkt(geometri) {
  const polys = geometri.type === 'Polygon' ? [geometri.coordinates] : geometri.coordinates;
  const areal = (r) => Math.abs(r.reduce((a, [x1, y1], i) => { const [x2, y2] = r[(i + 1) % r.length]; return a + x1 * y2 - x2 * y1; }, 0)) / 2;
  const størst = polys.reduce((a, b) => (areal(b[0]) > areal(a[0]) ? b : a));
  const g = { type: 'Polygon', coordinates: størst };
  const [v, s, ø, n] = bbox(g);
  let best = -1, bp = størst[0][0];
  for (let i = 1; i < 16; i++) {
    for (let j = 1; j < 16; j++) {
      const p = [v + ((ø - v) * i) / 16, s + ((n - s) * j) / 16];
      if (!punktIPolygon(p, g)) continue;
      const d = avstandTilGrense(p, g).meter;
      if (d > best) { best = d; bp = p; }
    }
  }
  return [Math.round(bp[0] * 1e6) / 1e6, Math.round(bp[1] * 1e6) / 1e6];
}
