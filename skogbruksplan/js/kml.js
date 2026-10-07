// Felles tolking av geometri i KML-plassmerker fra NIBIOs MapServer. De fleste lag gir <Polygon>, men noen
// (bl.a. MiS «Nokkelbiotop») er stilt som omriss og kommer som <LineString>. Lukkede linjer gjøres om til flater;
// en ring som ligger inne i en større ring i samme plassmerke blir hull i den.
import { punktIGeometri, arealM2 } from './proj.js';

const standardRing = (s) => s.trim().split(/\s+/).map((p) => p.split(',').slice(0, 2).map(Number));

export function placemarkGeometri(pm, lesRing = standardRing) {
  const polys = [];
  for (const [, poly] of pm.matchAll(/<Polygon>([\s\S]*?)<\/Polygon>/g)) {
    const ytre = poly.match(/<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    if (!ytre) continue;
    polys.push([lesRing(ytre[1]), ...[...poly.matchAll(/<innerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g)].map((m) => lesRing(m[1]))]);
  }
  if (!polys.length) {
    const ringer = [];
    for (const [, k] of pm.matchAll(/<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g)) {
      const r = lesRing(k);
      const [a, b] = [r[0], r.at(-1)];
      if (a[0] !== b[0] || a[1] !== b[1]) r.push([...a]);
      if (r.length < 4) continue; // minst tre ulike punkter
      ringer.push({ r, a: arealM2({ type: 'Polygon', coordinates: [r] }) });
    }
    ringer.sort((x, y) => y.a - x.a);
    for (const { r } of ringer) {
      const ytre = polys.find((p) => punktIGeometri(r[0], { type: 'Polygon', coordinates: [p[0]] }));
      if (ytre) ytre.push(r); else polys.push([r]);
    }
  }
  if (!polys.length) return null;
  return polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys };
}
