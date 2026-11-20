// Kulturminner fra Riksantikvaren i alle kart: kartlag (WMS «kulturminner2»: lokaliteter, sikringssoner og ikoner),
// oppslag ved klikk (GetFeatureInfo) og sikringssoner for hele kommunen til kommuneanalysen (OGC API, api.ra.no).
// Fredede kulturminner har en sikringssone på minst 5 m der inngrep er forbudt (kulturminneloven § 6).
// Ingen DOM – kan testes i Node.
import { hentKulturminner } from './pefc-data.js';
import { overlapper } from './pefc.js';
import { lagBoksIndeks, boksFor, stegvis } from './proj.js';

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
// Hvilke kulturminner som ligger i eller berører hver flate. Map flateId → [{ id, navn, lenke }].
function merker(kulturminner, ut) {
  const indeks = lagBoksIndeks(kulturminner.filter((k) => k.geometri));
  return (f) => {
    if (!f.geometri) return; const fb = boksFor(f.geometri); if (!fb) return; const treff = [];
    for (const k of indeks.sok(fb)) if (overlapper(f.geometri, k.geometri)) { const { geometri, ...rest } = k; treff.push(rest); }
    if (treff.length) ut.set(f.id, treff);
  };
}
export function merkFlater(flater, kulturminner) { const ut = new Map(); const m = merker(kulturminner, ut); for (const f of flater) m(f); return ut; }
export async function merkFlaterStegvis(flater, kulturminner, { framdrift } = {}) { const ut = new Map(); await stegvis(flater, merker(kulturminner, ut), { framdrift }); return ut; }
