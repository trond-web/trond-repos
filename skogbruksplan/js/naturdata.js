// NiN-naturtyper og arter av nasjonal forvaltningsinteresse (Miljødirektoratet) – kartlag, oppslag ved klikk i kartet
// og merking av hogstflatene i kommuneanalysen. Bruker de samme utvalgene som PEFC-modulen (pefc-data.js):
//   * NiN-naturtyper med moderat kvalitet eller bedre, eller som er truet / nær truet
//   * arter som er rødlistet (CR, EN, VU, NT), prioriterte arter, eller viktige funksjonsområder (hi, spill, yngle)
// Ingen DOM – kan testes i Node.
import { overlapper } from './pefc.js';

export const MD = 'https://kart.miljodirektoratet.no/arcgis';
export const KART = {
  nin: { url: `${MD}/services/naturtyper_nin/MapServer/WMSServer`, lag: 'naturtype_nin_svart_hoy_kvalitet,naturtype_nin_hoy_kvalitet,naturtype_nin_moderat_kvalitet,naturtype_nin_lav_kvalitet,naturtype_nin_svart_lav_kvalitet,naturtype_nin_ikke_kvalitetsvurdert' },
  art: { url: `${MD}/services/artfunksjon/MapServer/WMSServer`, lag: 'art_funksjonsomrade' },
};
export const FARGE = { nin: '#2e9e6a', art: '#b5179e' };
export const KVALITET = { 1: 'svært høy kvalitet', 2: 'høy kvalitet', 3: 'moderat kvalitet', 4: 'lav kvalitet', 5: 'svært lav kvalitet' };
export const FUNKSJON = { 1: 'beiteområde', 2: 'trekkvei', 3: 'hiområde', 4: 'myteområde', 5: 'overnattingsområde', 6: 'rasteområde', 7: 'spill-/parringsområde', 8: 'yngleområde', 9: 'leveområde' };
export const RODLISTE = { CR: 'kritisk truet', EN: 'sterkt truet', VU: 'sårbar', NT: 'nær truet', LC: 'livskraftig', DD: 'datamangel' };
export const KILDER = [
  { navn: 'Naturtyper (NiN), Miljødirektoratet', url: 'https://kart.miljodirektoratet.no/arcgis/rest/services/naturtyper_nin/MapServer' },
  { navn: 'Arter av nasjonal forvaltningsinteresse, Miljødirektoratet', url: 'https://kart.miljodirektoratet.no/arcgis/rest/services/artfunksjon/MapServer' },
];
const lenke = (u) => (/^https:\/\//.test(u || '') ? u : null);

export function tolkNin(p = {}) {
  const kv = Number(p.Lokalitetskvalitet) || null;
  const truet = Number(p.UK_Truet) === 1; const naerTruet = Number(p['UK_NærTruet']) === 1;
  return {
    type: 'nin', id: `nin-${p.NiNID || p.OBJECTID}`, navn: p.Naturtype || 'Naturtype', omrade: p['Områdenavn'] || null, kvalitet: kv, kvalitetTekst: KVALITET[kv] || 'ikke kvalitetsvurdert',
    truet, naerTruet, aar: Number(p['Kartleggingsår']) || null, lenke: lenke(p.Faktaark), okosystem: p['Hovedøkosystem'] || null,
  };
}
export const viktigNin = (n) => (n.kvalitet && n.kvalitet <= 3) || n.truet || n.naerTruet;
export function tolkArt(p = {}) {
  const rl = p.roedlisteStatus || null;
  return {
    type: 'art', id: `art-${p.artFunksjonId || p.artForekomstId || p.OBJECTID}`, navn: p.norskNavn || 'Art', latin: p.vitenskapeligNavn || null, funksjon: Number(p.funksjon) || null,
    funksjonTekst: FUNKSJON[Number(p.funksjon)] || 'funksjonsområde', rodliste: rl, rodlisteTekst: RODLISTE[rl] || null, prioritert: Number(p.prioritertArt) === 1, lenke: lenke(p.faktaark),
  };
}
export const viktigArt = (a) => ['CR', 'EN', 'VU', 'NT'].includes(a.rodliste) || a.prioritert || [3, 7, 8].includes(a.funksjon);
export function tekst(o) {
  if (o.type === 'nin') return `${o.navn}${o.omrade ? ` (${o.omrade})` : ''} – ${o.kvalitetTekst}${o.truet ? ', truet naturtype' : o.naerTruet ? ', nær truet naturtype' : ''}`;
  return `${o.navn} – ${o.funksjonTekst}${o.rodliste ? ` (${o.rodliste}${o.rodlisteTekst ? `, ${o.rodlisteTekst}` : ''})` : ''}${o.prioritert ? ', prioritert art' : ''}`;
}

// Oppslag i et punkt (klikk i kartet): JSON fra ArcGIS «query» med 15 m slingringsmonn.
export function punktUrl(type, lon, lat) {
  const tj = type === 'nin' ? 'naturtyper_nin' : 'artfunksjon';
  const q = new URLSearchParams({ geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', distance: '15', units: 'esriSRUnit_Meter', outFields: '*', returnGeometry: 'false', f: 'json' });
  return `${MD}/rest/services/${tj}/MapServer/0/query?${q}`;
}
export function tolkPunkt(type, json) { return (json?.features || []).map((f) => (type === 'nin' ? tolkNin(f.attributes) : tolkArt(f.attributes))); }

// Alle viktige naturtyper og arter i en boks [minLon, minLat, maxLon, maxLat] (kommuneanalysen). Geometrien forenkles
// til ca. 5 m for å holde svarene små. Gir { nin: [...], art: [...] } med geometri.
export async function hentForBoks(bb, { hent = fetch, framdrift = () => {} } = {}) {
  const ut = { nin: [], art: [] };
  for (const [type, tj, tolk, viktig] of [['nin', 'naturtyper_nin', tolkNin, viktigNin], ['art', 'artfunksjon', tolkArt, viktigArt]]) {
    let antall = 0;
    for (let side = 0; side < 40; side++) {
      const q = new URLSearchParams({ where: '1=1', geometry: bb.join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: 'true', maxAllowableOffset: '0.00005', geometryPrecision: '6', f: 'geojson', resultOffset: String(antall) });
      let d = null;
      for (let f = 0; f < 3 && !d; f++) { try { const r = await hent(`${MD}/rest/services/${tj}/MapServer/0/query?${q}`); if (!r.ok) throw new Error(`Miljødirektoratet svarte ${r.status}`); d = await r.json(); } catch (e) { if (f === 2) throw e; await new Promise((ok) => setTimeout(ok, 1000 * (f + 1))); } }
      const fs = d.features || []; antall += fs.length;
      for (const f of fs) { if (!f.geometry) continue; const o = tolk(f.properties || {}); if (viktig(o)) ut[type].push({ ...o, geometri: f.geometry }); }
      framdrift({ tekst: `Henter ${type === 'nin' ? 'naturtyper (NiN)' : 'arter'} fra Miljødirektoratet … ${antall}` });
      if (!fs.length || !(d.exceededTransferLimit || d.properties?.exceededTransferLimit)) break;
    }
  }
  return ut;
}

const boks = (g) => { const p = []; const gaa = (k) => (typeof k[0] === 'number' ? p.push(k) : k.forEach(gaa)); gaa(g.coordinates); return [Math.min(...p.map((q) => q[0])), Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1]))]; };
const krysser = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
// Hvilke naturtyper og arter som overlapper hver flate. Gir Map flateId → [{ type, id, navn, … }] (uten geometri).
export function merkFlater(flater, natur) {
  const alle = [...(natur.nin || []), ...(natur.art || [])].map((o) => ({ o, bb: boks(o.geometri) }));
  const ut = new Map();
  for (const f of flater) {
    if (!f.geometri) continue;
    const fb = boks(f.geometri); const treff = [];
    for (const { o, bb } of alle) if (krysser(fb, bb) && overlapper(f.geometri, o.geometri)) { const { geometri, ...rest } = o; treff.push(rest); }
    if (treff.length) ut.set(f.id, treff);
  }
  return ut;
}
