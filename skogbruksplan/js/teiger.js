// 🧩 Teiger: en eiendom kan bestå av flere teiger (atskilte deler). Teigene finnes fra eiendomsgrensen (hver
// polygon i grensen er én teig) og fra teignummeret på bestandene (b.teig, eller «1» i bestandsnummer «1-5» fra
// NIBIOs skogbruksplaner). Hvert bestand knyttes til teigen det ligger i. Brukes av teigvelgeren og Teiger-kortet.
import { arealM2, punktIGeometri, bbox, etikettPunkt } from './proj.js';

// Teignummer fra bestandet selv: feltet teig, ellers første del av «teig-bestand»-nummer.
export function teigEtikett(b) {
  if (b?.teig != null && String(b.teig).trim()) return String(b.teig).trim();
  const m = /^(\d+)-\d/.exec(String(b?.nr ?? ''));
  return m ? m[1] : null;
}
const sorterNr = (a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0) || String(a).localeCompare(String(b), 'nb');
const flest = (liste) => { const t = new Map(); for (const x of liste) if (x != null) t.set(x, (t.get(x) || 0) + 1); return [...t.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; };
const punktCache = new WeakMap();
const punkt = (g) => { if (!g) return null; if (!punktCache.has(g)) punktCache.set(g, etikettPunkt(g)); return punktCache.get(g); };
const senter = (bb) => (bb ? [(bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2] : null);
// Minste polygon som regnes som egen teig (daa) – mindre biter uten bestand er gjerne avvik i grensen.
export const MIN_TEIG_DAA = 0.5;

// Gir [{ id, nr, navn, geometri, bbox, punkt, arealDaa, bestand: [bestand-id] }], sortert etter teignummer.
export function finnTeiger(S) {
  const bestand = S?.bestand || []; const grense = S?.eiendom?.grense;
  const polys = !grense ? [] : grense.type === 'Polygon' ? [grense.coordinates] : grense.type === 'MultiPolygon' ? grense.coordinates : [];
  let deler = polys.map((c) => { const g = { type: 'Polygon', coordinates: c }; return { geometri: g, arealDaa: arealM2(g) / 1000, bbox: bbox([g]), bestand: [] }; });
  // Knytt bestand til polygonet det ligger i (nærmeste hvis det ligger litt utenfor grensen).
  const uten = [];
  for (const b of bestand) {
    const p = punkt(b.geometri);
    if (!p || !deler.length) { uten.push(b); continue; }
    let d = deler.find((x) => x.bbox && p[0] >= x.bbox[0] && p[0] <= x.bbox[2] && p[1] >= x.bbox[1] && p[1] <= x.bbox[3] && punktIGeometri(p, x.geometri));
    if (!d) d = deler.map((x) => { const c = senter(x.bbox); return { x, avst: c ? (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 : Infinity }; }).sort((a, b) => a.avst - b.avst)[0]?.x;
    if (d) d.bestand.push(b); else uten.push(b);
  }
  deler = deler.filter((d) => d.bestand.length || d.arealDaa >= MIN_TEIG_DAA);
  // Teignummer fra bestandene gir flere grupper enn grensen har deler (teiger som grenser til hverandre er slått
  // sammen i grensen, eller planen mangler grense): grupper etter teignummeret i stedet.
  const etiketter = new Set(bestand.map(teigEtikett).filter(Boolean));
  if (etiketter.size > Math.max(1, deler.length)) {
    const grupper = new Map();
    for (const b of bestand) { const e = teigEtikett(b) ?? '?'; if (!grupper.has(e)) grupper.set(e, []); grupper.get(e).push(b); }
    return [...grupper.entries()].sort((a, b) => sorterNr(a[0], b[0])).map(([nr, liste]) => {
      const geoms = liste.map((b) => b.geometri).filter(Boolean);
      const geometri = geoms.length ? { type: 'MultiPolygon', coordinates: geoms.flatMap((g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)) } : null;
      // Navnet plasseres i bestandet nærmest midten av teigen.
      const bb = geometri ? bbox([geometri]) : null; const c = senter(bb);
      const midt = c ? liste.filter((b) => b.geometri).map((b) => ({ p: punkt(b.geometri), b })).filter((x) => x.p).sort((x, y) => ((x.p[0] - c[0]) ** 2 + (x.p[1] - c[1]) ** 2) - ((y.p[0] - c[0]) ** 2 + (y.p[1] - c[1]) ** 2))[0]?.p : null;
      return { id: `t${nr}`, nr, navn: nr === '?' ? 'Uten teignummer' : `Teig ${nr}`, geometri, bbox: bb, punkt: midt, arealDaa: liste.reduce((s, b) => s + (b.areal || 0), 0), bestand: liste.map((b) => b.id) };
    });
  }
  if (!deler.length) return [];
  // Navn: teignummeret de fleste bestandene i delen har, ellers fortløpende etter størrelse.
  deler.sort((a, b) => b.arealDaa - a.arealDaa);
  const brukt = new Set();
  for (const d of deler) { const e = flest(d.bestand.map(teigEtikett)); if (e && !brukt.has(e)) { d.nr = e; brukt.add(e); } }
  let n = 1; for (const d of deler) if (!d.nr) { while (brukt.has(String(n))) n++; d.nr = String(n); brukt.add(d.nr); }
  // Bestand uten geometri hører til teigen med samme teignummer.
  for (const b of uten) { const e = teigEtikett(b); const d = deler.find((x) => x.nr === e) || null; if (d) d.bestand.push(b); }
  return deler.sort((a, b) => sorterNr(a.nr, b.nr)).map((d) => ({ id: `t${d.nr}`, nr: d.nr, navn: `Teig ${d.nr}`, geometri: d.geometri, bbox: d.bbox, punkt: punkt(d.geometri), arealDaa: d.arealDaa, bestand: d.bestand.map((b) => b.id) }));
}
