// Avstand til bilvei for skogflatene i kommuneanalysen. Veinettet for hele kommunen hentes fra NVDB (alle
// vegkategorier: E, R, F, K, P og S – også private veier og skogsbilveier), og hver flate får korteste avstand fra
// kanten av flaten til nærmeste bilvei. Traktorveier og gang-/sykkelveier teller ikke (som terrengtransporten i
// Veier-fanen). Søket bruker et rutenett (500 m) over veisegmentene, så det går raskt også for titusenvis av flater.
// Ingen DOM – kan testes i Node.
import { geoTilUtm, stegvis } from './proj.js';

const NVDB = 'https://nvdbapiles.atlas.vegvesen.no';
const HODER = { 'X-Client': 'skogbruksplan-app', Accept: 'application/json' };
export const BILVEI_TYPER = new Set(['enkelBilveg', 'kanalisertVeg', 'rampe', 'rundkjøring', 'gatetun']);
export const MAKS_AVSTAND = 10000; // m – lenger unna regnes som «over 10 km»
export const LANG_TERRENGTRANSPORT = 1000; // m
export const VEI_KILDE = { navn: 'Nasjonal vegdatabank (NVDB), Statens vegvesen', url: 'https://nvdbapiles.atlas.vegvesen.no' };

// WKT i UTM33 (srid 5973) → liste av linjer [[x, y], …]. Høyde droppes.
export function wktLinjer(wkt) {
  const m = /^(\w+)(?:\s+Z)?\s*\((.*)\)$/s.exec(String(wkt || '').trim()); if (!m) return [];
  const punkter = (s) => s.split(',').map((p) => p.trim().split(/\s+/).slice(0, 2).map(Number)).filter((p) => p.every(Number.isFinite));
  if (m[1] === 'LINESTRING') return [punkter(m[2])];
  if (m[1] === 'MULTILINESTRING') return m[2].replace(/^\(|\)$/g, '').split(/\)\s*,\s*\(/).map(punkter);
  return [];
}

// Henter bilveiene i kommunen. Gir { linjer: [[[x,y],…],…] i UTM33, antall, hentet }.
export async function hentVeinett(kommunenr, { hent = fetch, framdrift = () => {}, maksSider = 80 } = {}) {
  let url = `${NVDB}/vegnett/api/v4/veglenkesekvenser/segmentert?kommune=${encodeURIComponent(kommunenr)}&srid=5973&antall=1000`;
  const linjer = []; let n = 0;
  for (let side = 0; url && side < maksSider; side++) {
    let d;
    for (let forsok = 0; ; forsok++) {
      try { const r = await hent(url, { headers: HODER }); if (!r.ok) throw new Error(`NVDB svarte ${r.status}`); d = await r.json(); break; } catch (e) { if (forsok >= 3) throw e; await new Promise((ok) => setTimeout(ok, 800 * 2 ** forsok)); }
    }
    for (const s of d.objekter || []) {
      n++;
      if (!BILVEI_TYPER.has(s.typeVeg_sosi) || s.type === 'KONNEKTERING') continue;
      for (const l of wktLinjer(s.geometri?.wkt)) if (l.length > 1) linjer.push(l);
    }
    framdrift({ tekst: `Henter veinett fra NVDB … ${n.toLocaleString('nb-NO')} veglenker`, side });
    const neste = d.metadata?.neste?.href;
    url = (d.metadata?.returnert ?? 0) >= (d.metadata?.sidestørrelse ?? 1000) && neste && neste !== url ? neste.replace('/vegnett/veglenkesekvenser/', '/vegnett/api/v4/veglenkesekvenser/') : null;
  }
  return { linjer, antall: linjer.length, hentet: new Date().toISOString() };
}

// Rutenett over segmentene: nøkkel(i, j) → [[ax, ay, bx, by], …]. Tallnøkler (raskere enn tekst).
const nokkel = (i, j) => (i + 50000) * 100000 + (j + 50000);
export function lagIndeks(linjer, celle = 500) {
  const nett = new Map();
  for (const l of linjer) {
    for (let k = 1; k < l.length; k++) {
      const [ax, ay] = l[k - 1]; const [bx, by] = l[k];
      const i0 = Math.floor(Math.min(ax, bx) / celle); const i1 = Math.floor(Math.max(ax, bx) / celle);
      const j0 = Math.floor(Math.min(ay, by) / celle); const j1 = Math.floor(Math.max(ay, by) / celle);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const n = nokkel(i, j); const x = nett.get(n); if (x) x.push([ax, ay, bx, by]); else nett.set(n, [[ax, ay, bx, by]]); }
    }
  }
  return { nett, celle, nokkel };
}
function segAvstand(px, py, [ax, ay, bx, by]) {
  const dx = bx - ax; const dy = by - ay; const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
// Korteste avstand fra punktene (UTM33) til et segment i indeksen. Søker ringer av ruter utover til svaret er sikkert.
export function naermesteVei(indeks, punkter, maks = MAKS_AVSTAND) {
  const { nett, celle } = indeks; const n = indeks.nokkel || ((i, j) => `${i},${j}`); if (!nett.size || !punkter.length) return null;
  let best = Infinity;
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const [x, y] of punkter) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const i0 = Math.floor(x0 / celle); const i1 = Math.floor(x1 / celle);
  const j0 = Math.floor(y0 / celle); const j1 = Math.floor(y1 / celle);
  const sett = new Set();
  const maksRing = Math.ceil(maks / celle) + 1;
  for (let r = 0; r <= maksRing; r++) {
    // Når beste treff er nærmere enn det ringen kan gi, er vi ferdige.
    if (best <= (r - 1) * celle) break;
    for (let i = i0 - r; i <= i1 + r; i++) {
      for (let j = j0 - r; j <= j1 + r; j++) {
        if (r && i > i0 - r && i < i1 + r && j > j0 - r && j < j1 + r) continue; // bare ytterkanten av ringen
        const seg = nett.get(n(i, j)); if (!seg) continue;
        for (const s of seg) {
          if (sett.has(s)) continue; sett.add(s); // samme segment kan ligge i flere ruter
          // Nedre grense: avstand mellom flatens boks og segmentets boks. Kan den ikke slå beste treff, hoppes det over.
          const dx = Math.max(0, Math.min(s[0], s[2]) - x1, x0 - Math.max(s[0], s[2])); const dy = Math.max(0, Math.min(s[1], s[3]) - y1, y0 - Math.max(s[1], s[3]));
          if (dx * dx + dy * dy >= best * best) continue;
          for (const [px, py] of punkter) { const d = segAvstand(px, py, s); if (d < best) { best = d; if (!best) return 0; } }
        }
      }
    }
  }
  return best <= maks ? best : null;
}
// Punkter på kanten av flaten (lon/lat → UTM33), høyst «maks» punkter.
export function kantpunkter(geometri, maks = 80) {
  const ringer = geometri.type === 'Polygon' ? [geometri.coordinates[0]] : geometri.type === 'MultiPolygon' ? geometri.coordinates.map((p) => p[0]) : [];
  const alle = ringer.flat();
  const steg = Math.max(1, Math.ceil(alle.length / maks));
  return alle.filter((_, i) => i % steg === 0).map(([lon, lat]) => geoTilUtm(lon, lat, 33));
}
// Avstand (m, avrundet) for hver flate: Map id → meter (0 når en vei går gjennom flaten), eller null over maks.
function maaler(linjer, maks, ut) {
  const indeks = lagIndeks(linjer);
  return (f) => { if (!f.geometri) return; const d = naermesteVei(indeks, kantpunkter(f.geometri), maks); ut.set(f.id, d == null ? null : Math.round(d / 10) * 10); };
}
export function avstanderTilVei(flater, linjer, { maks = MAKS_AVSTAND } = {}) { const ut = new Map(); const m = maaler(linjer, maks, ut); for (const f of flater) m(f); return ut; }
// Som avstanderTilVei, men i biter – siden svarer underveis (store kommuner).
export async function avstanderTilVeiStegvis(flater, linjer, { maks = MAKS_AVSTAND, framdrift } = {}) { const ut = new Map(); await stegvis(flater, maaler(linjer, maks, ut), { framdrift }); return ut; }
export const avstandTekst = (m) => (m == null ? 'over 10 km' : m < 10 ? 'ved vei' : m >= 1000 ? `${(m / 1000).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`);
