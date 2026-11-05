// Kulturminner fra Riksantikvaren i alle kart: kartlag (WMS «kulturminner2»: lokaliteter, sikringssoner og ikoner),
// oppslag ved klikk (GetFeatureInfo) og sikringssoner for hele kommunen til kommuneanalysen (OGC API, api.ra.no).
// Fredede kulturminner har en sikringssone på minst 5 m der inngrep er forbudt (kulturminneloven § 6).
// Ingen DOM – kan testes i Node.
import { hentKulturminner } from './pefc-data.js';
import { overlapper } from './pefc.js';

export const KART = { url: 'https://kart.ra.no/wms/kulturminner2', lag: 'Lokaliteter,Sikringssoner,Lokalitetsikoner' };
export const FARGE = '#9a5b2b';
export const KILDE = { navn: 'Kulturminner – lokaliteter, enkeltminner og sikringssoner (Riksantikvaren)', url: 'https://kulturminnesok.no/' };
const lenke = (u) => (/^https:\/\//.test(u || '') ? u : null);

export function punktUrl(lat, lon, d = 0.0004) {
  const q = new URLSearchParams({ service: 'WMS', version: '1.1.1', request: 'GetFeatureInfo', layers: 'Lokaliteter,Sikringssoner', query_layers: 'Lokaliteter,Sikringssoner', styles: '', srs: 'EPSG:4326', bbox: [lon - d, lat - d, lon + d, lat + d].map((v) => v.toFixed(6)).join(','), width: '101', height: '101', x: '50', y: '50', info_format: 'application/vnd.ogc.gml', feature_count: '10' });
  return `${KART.url}?${q}`;
}
// Lokalitetene i GML-svaret. Sikringssonen har samme kulturminne-id og markeres på lokaliteten.
export function tolkPunkt(gml) {
  const ut = new Map(); const soner = new Set();
  for (const [, lag, innhold] of String(gml || '').matchAll(/<(\w+)_feature>([\s\S]*?)<\/\1_feature>/g)) {
    const f = (n) => new RegExp(`<${n}>([^<]*)</${n}>`).exec(innhold)?.[1]?.trim() || null;
    const id = f('kulturminneid') || f('lokalid'); if (!id) continue;
    if (lag === 'Sikringssoner') { soner.add(id); continue; }
    if (lag !== 'Lokaliteter' || ut.has(id)) continue;
    ut.set(id, { id, navn: f('navn') || `Kulturminne ${id}`, art: f('lokalitetsart'), kategori: f('lokaliteteskategori'), vern: f('vernetype'), kommune: f('kommune'), lenke: lenke(f('linkkulturminnesok')), askeladden: lenke(f('linkaskeladden')) });
  }
  for (const id of soner) if (ut.has(id)) ut.get(id).sikringssone = true;
  return [...ut.values()].map((x) => ({ sikringssone: false, ...x }));
}
export function tekst(k) { return `${k.navn}${k.art ? ` – ${k.art.toLowerCase()}` : ''}${k.vern ? ` (${k.vern.toLowerCase()})` : ''}`; }
export const erFredet = (k) => /fredet/i.test(k.vern || '');

// Sikringssoner (fredede kulturminner) i en boks [minLon, minLat, maxLon, maxLat] – til kommuneanalysen.
export async function hentForBoks(bb, { hent = fetch } = {}) {
  return (await hentKulturminner(bb, { hent })).map((k) => ({ type: 'kulturminne', id: k.kildeId, navn: k.navn, lenke: k.lenke || null, geometri: k.geometri }));
}
const boks = (g) => { const p = []; const gaa = (k) => (typeof k[0] === 'number' ? p.push(k) : k.forEach(gaa)); gaa(g.coordinates); return [Math.min(...p.map((q) => q[0])), Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1]))]; };
// Hvilke kulturminner som ligger i eller berører hver flate. Map flateId → [{ id, navn, lenke }].
export function merkFlater(flater, kulturminner) {
  const alle = kulturminner.filter((k) => k.geometri).map((k) => ({ k, bb: boks(k.geometri) }));
  const ut = new Map();
  for (const f of flater) {
    if (!f.geometri) continue; const fb = boks(f.geometri); const treff = [];
    for (const { k, bb } of alle) if (fb[0] <= bb[2] && bb[0] <= fb[2] && fb[1] <= bb[3] && bb[1] <= fb[3] && overlapper(f.geometri, k.geometri)) { const { geometri, ...rest } = k; treff.push(rest); }
    if (treff.length) ut.set(f.id, treff);
  }
  return ut;
}
