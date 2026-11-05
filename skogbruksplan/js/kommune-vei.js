// Avstand til bilvei for skogflatene i kommuneanalysen. Veinettet for hele kommunen hentes fra NVDB (alle
// vegkategorier: E, R, F, K, P og S – også private veier og skogsbilveier), og hver flate får korteste avstand fra
// kanten av flaten til nærmeste bilvei. Traktorveier og gang-/sykkelveier teller ikke (som terrengtransporten i
// Veier-fanen). Søket bruker et rutenett (500 m) over veisegmentene, så det går raskt også for titusenvis av flater.
// Ingen DOM – kan testes i Node.
import { geoTilUtm } from './proj.js';

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

// Rutenett over segmentene: «i,j» → [[ax, ay, bx, by], …].
export function lagIndeks(linjer, celle = 500) {
  const nett = new Map();
  for (const l of linjer) {
    for (let k = 1; k < l.length; k++) {
      const [ax, ay] = l[k - 1]; const [bx, by] = l[k];
      const i0 = Math.floor(Math.min(ax, bx) / celle); const i1 = Math.floor(Math.max(ax, bx) / celle);
      const j0 = Math.floor(Math.min(ay, by) / celle); const j1 = Math.floor(Math.max(ay, by) / celle);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const n = `${i},${j}`; if (!nett.has(n)) nett.set(n, []); nett.get(n).push([ax, ay, bx, by]); }
    }
  }
  return { nett, celle };
}
function segAvstand(px, py, [ax, ay, bx, by]) {
  const dx = bx - ax; const dy = by - ay; const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
// Korteste avstand fra punktene (UTM33) til et segment i indeksen. Søker ringer av ruter utover til svaret er sikkert.
export function naermesteVei(indeks, punkter, maks = MAKS_AVSTAND) {
  const { nett, celle } = indeks; if (!nett.size || !punkter.length) return null;
  let best = Infinity;
  const xs = punkter.map((p) => p[0]); const ys = punkter.map((p) => p[1]);
  const i0 = Math.floor(Math.min(...xs) / celle); const i1 = Math.floor(Math.max(...xs) / celle);
  const j0 = Math.floor(Math.min(...ys) / celle); const j1 = Math.floor(Math.max(...ys) / celle);
  const maksRing = Math.ceil(maks / celle) + 1;
  for (let r = 0; r <= maksRing; r++) {
    // Når beste treff er nærmere enn det ringen kan gi, er vi ferdige.
    if (best <= (r - 1) * celle) break;
    for (let i = i0 - r; i <= i1 + r; i++) {
      for (let j = j0 - r; j <= j1 + r; j++) {
        if (r && i > i0 - r && i < i1 + r && j > j0 - r && j < j1 + r) continue; // bare ytterkanten av ringen
        const seg = nett.get(`${i},${j}`); if (!seg) continue;
        for (const s of seg) for (const [px, py] of punkter) { const d = segAvstand(px, py, s); if (d < best) best = d; }
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
export function avstanderTilVei(flater, linjer, { maks = MAKS_AVSTAND } = {}) {
  const indeks = lagIndeks(linjer); const ut = new Map();
  for (const f of flater) {
    if (!f.geometri) continue;
    const d = naermesteVei(indeks, kantpunkter(f.geometri), maks);
    ut.set(f.id, d == null ? null : Math.round(d / 10) * 10);
  }
  return ut;
}
export const avstandTekst = (m) => (m == null ? 'over 10 km' : m < 10 ? 'ved vei' : m >= 1000 ? `${(m / 1000).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`);
