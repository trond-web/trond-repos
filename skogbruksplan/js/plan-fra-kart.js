// Ny skogbruksplan fra kartet: finn eiendommen i et punkt (der du står, eller der du trykker) og lag planen med den
// samme motoren som fullversjonen (js/generator.js). Brukes av SkogIQ Felt (js/felt-nyplan.js). Ingen DOM her.
//   * Kartverket eiendom/v1/punkt: matrikkelenheten (kommune, gnr, bnr, fnr) som teigen i punktet hører til.
//   * Kartverket eiendom/v1/geokoding (omrade=true): teigene til eiendommen, for å vise grensen før planen lages.
//   * genererPlan: eiendomsgrense, tidligere plan, SR16, MiS, AR5 osv. Datagrunnlaget (PEFC-miljødata, veier,
//     tømmerpriser) hentes etterpå i bakgrunnen (js/datagrunnlag.js).
import { genererPlan, hentKommuner } from './generator.js';
import { STANDARD_INNSTILLINGER } from './model.js';

export const KARTVERKET = 'https://ws.geonorge.no';
export const GEN_STEG = [
  ['eiendom', 'Eiendomsgrense (Kartverket)'], ['plan', 'Tidligere skogbruksplan (NIBIO)'], ['sr16', 'Skogressurskart SR16 (NIBIO)'],
  ['mis', 'Miljøregistreringer (MiS)'], ['markslag', 'Markslag (AR5)'], ['bygg', 'Bestand'],
];

const matrikkel = (e) => `${e.gnr}/${e.bnr}${e.fnr ? `/${e.fnr}` : ''}`;

// Matrikkelenhetene i punktet (nærmeste først). Gir [{ kommunenr, gnr, bnr, fnr, tekst, avstand }].
export async function eiendomVed(lat, lon, { hent = (u, o) => fetch(u, o), radius = 1 } = {}) {
  const url = `${KARTVERKET}/eiendom/v1/punkt?nord=${lat.toFixed(6)}&ost=${lon.toFixed(6)}&koordsys=4258&radius=${radius}&maksTreff=10`;
  const r = await hent(url); if (!r.ok) throw new Error(`Kartverket svarte ${r.status}`);
  const d = await r.json(); const sett = new Map();
  for (const x of d.eiendom || []) {
    if (!x.gardsnummer || !x.bruksnummer) continue;
    const e = { kommunenr: String(x.kommunenummer).padStart(4, '0'), gnr: x.gardsnummer, bnr: x.bruksnummer, fnr: x.festenummer || 0, avstand: x.meterFraPunkt ?? 0, sameie: !!x.teigmedflerematrikkelenheter };
    const k = `${e.kommunenr}-${matrikkel(e)}`; if (!sett.has(k) || sett.get(k).avstand > e.avstand) sett.set(k, { ...e, tekst: matrikkel(e) });
  }
  return [...sett.values()].sort((a, b) => a.avstand - b.avstand);
}
// Teigene til eiendommen som GeoJSON (for å vise grensen før planen lages). Null om de ikke finnes.
export async function eiendomGrense({ kommunenr, gnr, bnr, fnr = 0 }, { hent = (u, o) => fetch(u, o) } = {}) {
  const q = new URLSearchParams({ kommunenummer: kommunenr, gardsnummer: gnr, bruksnummer: bnr, omrade: 'true', utkoordsys: '4258' });
  if (fnr) q.set('festenummer', fnr);
  const r = await hent(`${KARTVERKET}/eiendom/v1/geokoding?${q}`); if (!r.ok) return null;
  const d = await r.json(); const poly = (d.features || []).filter((f) => f.geometry && /Polygon/.test(f.geometry.type) && (f.properties?.festenummer || 0) === Number(fnr || 0));
  if (!poly.length) return null;
  const coords = poly.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates));
  return { type: 'MultiPolygon', coordinates: coords };
}

let kommuner = null;
export async function kommuneFor(nr, { hent } = {}) {
  try { kommuner = kommuner || await hentKommuner(hent); } catch { kommuner = kommuner || []; }
  return kommuner.find((k) => k.nr === nr) || { nr, navn: nr };
}

// Lager planen (som i fullversjonen) og gir planobjektet klart til lagring.
export async function lagSkogbruksplan({ kommunenr, gnr, bnr, fnr = 0 }, { turf, klipping = null, hent, logg = () => {}, nyId, iAar = new Date().getFullYear(), innstillinger = null }) {
  const kommune = await kommuneFor(kommunenr, { hent });
  const plan = await genererPlan({ kommune, gnr, bnr, festenr: fnr }, { turf, klipping, iAar, logg, ...(hent ? { hent } : {}) });
  return {
    versjon: 1, planId: nyId('p'), eiendom: plan.eiendom, bestand: plan.bestand, markslag: plan.markslag || [],
    ...(plan.skifteplan ? { skifteplan: plan.skifteplan } : {}), registreringer: [],
    innstillinger: JSON.parse(JSON.stringify(innstillinger || STANDARD_INNSTILLINGER)), metadata: plan.metadata, datakilder: { ...plan.kilder },
    endret: new Date().toISOString(), laget: { fra: 'felt', dato: new Date().toISOString().slice(0, 10) },
  };
}
