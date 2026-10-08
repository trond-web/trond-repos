// Vegetasjonstype per bestand. Typene følger NIBIOs system for vegetasjonskartlegging (Rekdal & Larsson 2005),
// slik at kartlagte og anslåtte typer får samme koder og navn (f.eks. 7b Blåbærgranskog).
//   1. NIBIO vegetasjonskart (WMS «vegetasjon», lag «Vegetasjonstypar»): feltkartlagt, men bare for om lag
//      25 000 km² (mest utmark og fjell). Dekker kartet minst halve bestandet, brukes den dominerende typen.
//   2. Ellers anslås typen fra treslag og bonitet (H40), og AR5-grunnforhold «organiske jordlag» gir sumpskog.
// Ingen DOM; nettverk (hent) og polygon-clipping (klipping) sendes inn, slik at modulen også kjører i Node.
import { geoTilUtm, utmTilGeo, arealM2 } from './proj.js';
import { placemarkGeometri } from './kml.js';

const VK_URL = 'https://wms.nibio.no/cgi-bin/vegetasjon';
const VK_LAG = 'Vegetasjonstypar';
const KML_MAKS = 1000;
export const VK_KILDE = { navn: 'Vegetasjonskart (NIBIO)', url: 'https://www.nibio.no/tema/landskap/utmarksbeite/karttema/dekning-av-vegetasjonskart' };

// Kartleggingsenhetene som er i bruk i vegetasjonskartet (navn fra NIBIO). Andre koder får navnet fra tjenesten. farge brukes når kartet fargelegges etter vegetasjonstype.
export const VEG_TYPER = {
  '1b': { navn: 'Grassnøleie', farge: '#d0d6de' },
  '2b': { navn: 'Tørrgrashei', farge: '#e6d9b8' }, '2c': { navn: 'Lavhei', farge: '#eee3c2' },
  '2e': { navn: 'Rishei', farge: '#d8c69c' },
  '3a': { navn: 'Lågurteng', farge: '#c9e0a8' }, '3b': { navn: 'Høgstaudeeng', farge: '#b7d68f' },
  '4a': { navn: 'Lav- og lyngrik bjørkeskog', farge: '#e7eab0' }, '4b': { navn: 'Blåbærbjørkeskog', farge: '#c9e08a' }, '4c': { navn: 'Engbjørkeskog', farge: '#9fcf63' },
  '4d': { navn: 'Kalkbjørkeskog', farge: '#8cc153' }, '4e': { navn: 'Oreskog', farge: '#6fb04a' }, '4f': { navn: 'Flommarkkratt', farge: '#86b97a' }, '4g': { navn: 'Hagemark', farge: '#b5d38e' },
  '5a': { navn: 'Fattig edellauvskog', farge: '#d3c46a' }, '5b': { navn: 'Rik edellauvskog', farge: '#b9a43c' },
  '6a': { navn: 'Lav- og lyngrik furuskog', farge: '#f2d2a2' }, '6b': { navn: 'Blåbærfuruskog', farge: '#e0a965' }, '6c': { navn: 'Engfuruskog', farge: '#c98436' }, '6d': { navn: 'Kalkfuruskog', farge: '#b26d25' },
  '7a': { navn: 'Lav- og lyngrik granskog', farge: '#bfe0c8' }, '7b': { navn: 'Blåbærgranskog', farge: '#5fae73' }, '7c': { navn: 'Enggranskog', farge: '#21733d' },
  '8a': { navn: 'Fuktskog', farge: '#a9d3d6' }, '8b': { navn: 'Myrskog', farge: '#7fb9c6' }, '8c': { navn: 'Fattig sumpskog', farge: '#4f97ad' }, '8d': { navn: 'Rik sumpskog', farge: '#2c6f8f' },
  '9a': { navn: 'Rismyr', farge: '#cfe3ee' }, '9c': { navn: 'Grasmyr', farge: '#b5d3e6' }, '9d': { navn: 'Blautmyr', farge: '#a7cbe2' }, '9e': { navn: 'Storrsump', farge: '#98c2dd' },
  '11a': { navn: 'Dyrka mark', farge: '#f3e28a' }, '11b': { navn: 'Beitevoll', farge: '#ece08f' },
  '12b': { navn: 'Ur og blokkmark', farge: '#c9c5bd' }, '12c': { navn: 'Bart fjell', farge: '#bdb8ae' },
  '13b': { navn: 'Ferskvatn, stillestående', farge: '#8fc3ea' },
};
export const HOVEDTYPER = { 1: 'Snøleie', 2: 'Heisamfunn i fjellet', 3: 'Engsamfunn i fjellet', 4: 'Lauvskog', 5: 'Varmekjær lauvskog', 6: 'Furuskog', 7: 'Granskog', 8: 'Fukt- og sumpskog', 9: 'Myr', 10: 'Våtmark og strand', 11: 'Jordbruksareal', 12: 'Uproduktive areal', 13: 'Vatn' };
// Skogtypene som kan velges for et bestand.
export const SKOGTYPER = Object.keys(VEG_TYPER).filter((k) => /^[45678]/.test(k));
export const vegFarge = (kode) => VEG_TYPER[kode]?.farge || '#d9d9d9';
export const vegTekst = (v) => (v?.kode ? `${v.kode} ${v.navn || VEG_TYPER[v.kode]?.navn || ''}`.trim() : '');

// Leser vegetasjonstype fra importerte data: «7b», «7b Blåbærgranskog», «Blåbærgranskog» eller «blåbær gran».
export function tolkVegetasjon(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  const m = s.match(/^(1[0-3]|[1-9])\s*([a-g])\b/i);
  if (m) { const kode = `${m[1]}${m[2].toLowerCase()}`; return { kode, navn: VEG_TYPER[kode]?.navn || s.slice(m[0].length).trim() || kode, kilde: 'import' }; }
  const lav = s.toLowerCase();
  const eksakt = Object.entries(VEG_TYPER).find(([, t]) => t.navn.toLowerCase() === lav);
  if (eksakt) return { kode: eksakt[0], navn: eksakt[1].navn, kilde: 'import' };
  const tre = /gran/.test(lav) ? '7' : /furu/.test(lav) ? '6' : /bjørk|bjork|lauv/.test(lav) ? '4' : null;
  if (tre) {
    const del = /sump/.test(lav) ? null : /lav|lyng|bærlyng|blokkebær|røsslyng/.test(lav) ? 'a' : /blåbær|småbregne/.test(lav) ? 'b' : /eng|lågurt|storbregne|høgstaude|bregne/.test(lav) ? 'c' : null;
    if (del) { const kode = `${tre}${del}`; return { kode, navn: VEG_TYPER[kode].navn, kilde: 'import' }; }
  }
  if (/sump/.test(lav)) { const kode = /rik/.test(lav) ? '8d' : '8c'; return { kode, navn: VEG_TYPER[kode].navn, kilde: 'import' }; }
  return { kode: null, navn: s, kilde: 'import' };
}

// Larsson-typen (skogtype i skogbruksplaner) som bonitet og treslag oftest tilsvarer – vises som tillegg til anslaget.
function larsson(treslag, h40) {
  if (treslag === 'F') return h40 <= 6 ? 'lav-/røsslyngtype' : h40 <= 8 ? 'bærlyngtype' : h40 <= 14 ? 'blåbærtype' : 'lågurt-/engtype';
  if (h40 <= 8) return 'bærlyngtype'; if (h40 <= 11) return 'blåbærtype'; if (h40 <= 14) return 'blåbær-/småbregnetype';
  if (h40 <= 17) return 'småbregne-/storbregnetype'; return 'storbregne-/høgstaudetype';
}

// Anslag fra treslag (G/F/L), bonitet (H40) og andel organisk jord (AR5). Gir null uten bonitet.
export function anslaVegetasjon({ treslag = 'G', bonitet = null, organisk = 0 } = {}) {
  const h40 = Number(bonitet);
  if (!Number.isFinite(h40) || h40 <= 0) return null;
  let kode;
  if (organisk >= 0.5) kode = h40 <= 8 ? '8b' : h40 <= 14 ? '8c' : '8d';
  else {
    const gruppe = treslag === 'F' ? '6' : treslag === 'L' ? '4' : '7';
    kode = `${gruppe}${h40 <= 8 ? 'a' : h40 <= 14 ? 'b' : 'c'}`;
  }
  const ts = { G: 'G', F: 'F', L: 'B' }[treslag] || 'G';
  const grunnlag = `${ts}${h40}${organisk >= 0.5 ? `, ${Math.round(organisk * 100)} % organisk jord (AR5)` : ''}`;
  return { kode, navn: VEG_TYPER[kode].navn, kilde: 'anslag', grunnlag, skogtype: organisk >= 0.5 ? 'sumpskog' : larsson(treslag, h40) };
}

// Fordeling av vegetasjonstyper i en flate. flater: [{ kode, navn, geometri, bb }], snitt(a, b) → geometri | null.
export function fordeling(geometri, flater, snitt) {
  const totalt = arealM2(geometri); if (!totalt) return { dekning: 0, typer: [] };
  const bb = boks(geometri); const per = new Map(); let dekket = 0;
  for (const f of flater) {
    if (!(f.bb[0] <= bb[2] && bb[0] <= f.bb[2] && f.bb[1] <= bb[3] && bb[1] <= f.bb[3])) continue;
    const a = arealM2(snitt(geometri, f.geometri)); if (a < 1) continue;
    dekket += a;
    const t = per.get(f.kode) || { kode: f.kode, navn: f.navn, areal: 0 }; t.areal += a; per.set(f.kode, t);
  }
  const typer = [...per.values()].sort((a, b) => b.areal - a.areal).map((t) => ({ kode: t.kode, navn: t.navn, andel: Math.round((t.areal / totalt) * 100) / 100 }));
  return { dekning: Math.min(1, dekket / totalt), typer };
}

// Velger vegetasjonstype. Kartlagt skogtype brukes når vegetasjonskartet dekker minst halve bestandet og skogtyper
// (gruppe 4–8) utgjør minst SKOG_MIN av det. Er det kartlagt som noe annet (hei, myr, beite – ofte eldre kartlegging
// eller grove figurer), anslås skogtypen, og det kartlagte tas med som opplysning.
export const SKOG_MIN = 0.25;
const erSkog = (kode) => /^[45678][a-g]$/.test(kode || '');
export function velgVegetasjon(b, { vk = null, organisk = 0, aar = null } = {}) {
  const kartlagt = vk && vk.dekning >= 0.5 && vk.typer.length;
  const skog = kartlagt ? vk.typer.filter((t) => erSkog(t.kode)) : [];
  const skogAndel = skog.reduce((s, t) => s + t.andel, 0);
  if (kartlagt && skogAndel >= SKOG_MIN) {
    const t = skog[0];
    return { kode: t.kode, navn: t.navn, kilde: 'vk', andel: t.andel, dekning: Math.round(vk.dekning * 100) / 100, typer: vk.typer.slice(0, 4), aar };
  }
  const a = anslaVegetasjon({ treslag: b.treslag, bonitet: b.bonitet, organisk });
  if (a && kartlagt) a.kartlagt = { typer: vk.typer.slice(0, 3), aar };
  return a;
}

// ---------- henting fra NIBIO ----------
const boks = (g) => {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  const ringer = g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
  for (const r of ringer) for (const [x, y] of r) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
};
async function hentTekst(hent, url, ms = 60000) {
  for (let forsok = 0; ; forsok++) {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await hent(url, { signal: ctrl.signal });
      if (!r.ok) { const f = new Error(`NIBIO svarte ${r.status}`); f.status = r.status; throw f; }
      return await r.text();
    } catch (e) {
      if (forsok >= 2) throw ctrl.signal.aborted ? new Error('NIBIO (vegetasjonskart) svarte ikke i tide') : e;
      await new Promise((res) => setTimeout(res, 800 * (forsok + 1)));
    } finally { clearTimeout(t); }
  }
}
const utmBoks = (gb) => {
  const h = [[gb[0], gb[1]], [gb[0], gb[3]], [gb[2], gb[1]], [gb[2], gb[3]]].map(([x, y]) => geoTilUtm(x, y, 33));
  return [Math.min(...h.map((p) => p[0])), Math.min(...h.map((p) => p[1])), Math.max(...h.map((p) => p[0])), Math.max(...h.map((p) => p[1]))];
};
const geoBoks = (b) => {
  const h = [[b[0], b[1]], [b[0], b[3]], [b[2], b[1]], [b[2], b[3]]].map(([x, y]) => utmTilGeo(x, y, 33));
  return [Math.min(...h.map((p) => p[0])), Math.min(...h.map((p) => p[1])), Math.max(...h.map((p) => p[0])), Math.max(...h.map((p) => p[1]))];
};

export function parseVkGml(tekst) {
  const ut = new Map();
  for (const del of tekst.split(`<${VK_LAG}_feature>`).slice(1)) {
    const a = {};
    for (const [, k, v] of del.split(`</${VK_LAG}_feature>`)[0].matchAll(/<(\w+)>([^<]*)<\/\1>/g)) a[k] = v.trim();
    if (a.figur_id) ut.set(String(a.figur_id), a);
  }
  return ut;
}

// Henter kartlagte vegetasjonsflater som overlapper områdene (liste av [minLon, minLat, maxLon, maxLat]).
// Geometri fra KML (grader), egenskaper fra GetFeatureInfo (GML) per rute. Tomt svar = ikke kartlagt.
export async function hentVegetasjonsflater(omrader, { hent = fetch, logg = () => {} } = {}) {
  const treff = (gb) => omrader.some((o) => gb[0] <= o[2] && o[0] <= gb[2] && gb[1] <= o[3] && o[1] <= gb[3]);
  const x0 = Math.min(...omrader.map((o) => o[0])); const y0 = Math.min(...omrader.map((o) => o[1]));
  const x1 = Math.max(...omrader.map((o) => o[2])); const y1 = Math.max(...omrader.map((o) => o[3]));
  const ruter = [];
  const kml = async (b, dybde = 0) => {
    const h = Math.max(200, Math.round((2000 * (b[3] - b[1])) / (b[2] - b[0])));
    const tekst = await hentTekst(hent, `${VK_URL}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${VK_LAG}&STYLES=&SRS=EPSG:25833&BBOX=${b.map((v) => v.toFixed(1)).join(',')}&WIDTH=2000&HEIGHT=${h}&FORMAT=kml`);
    const flater = [];
    for (const [, pm] of tekst.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)) {
      const id = (pm.match(/<name>[^<]*?\.?(\d+)<\/name>/) || [])[1];
      const geometri = placemarkGeometri(pm);
      if (id && geometri) flater.push({ id, geometri });
    }
    if (flater.length < KML_MAKS || dybde >= 4) { if (flater.length) ruter.push(b); return flater; }
    const mx = (b[0] + b[2]) / 2; const my = (b[1] + b[3]) / 2; const ut = [];
    for (const d of [[b[0], b[1], mx, my], [mx, b[1], b[2], my], [b[0], my, mx, b[3]], [mx, my, b[2], b[3]]]) if (treff(geoBoks(d))) ut.push(...await kml(d, dybde + 1));
    return ut;
  };
  const sett = new Map();
  for (const f of await kml(utmBoks([x0, y0, x1, y1]))) if (!sett.has(f.id)) sett.set(f.id, f);
  const flater = [...sett.values()].filter((f) => treff(f.bb = boks(f.geometri)));
  if (!flater.length) return [];
  logg(`Vegetasjonskart: ${flater.length} flater – henter typer …`);
  const attr = new Map();
  for (const b of ruter) {
    const url = `${VK_URL}?SERVICE=WMS&VERSION=1.1.1&SRS=EPSG:25833&BBOX=${b.map((v) => v.toFixed(1)).join(',')}&STYLES=&REQUEST=GetFeatureInfo&LAYERS=${VK_LAG}&QUERY_LAYERS=${VK_LAG}&WIDTH=1000&HEIGHT=1000&X=500&Y=500&RADIUS=bbox&FEATURE_COUNT=100000&INFO_FORMAT=application/vnd.ogc.gml`;
    for (const [k, v] of parseVkGml(await hentTekst(hent, url, 90000))) attr.set(k, v);
  }
  return flater.map((f) => {
    const a = attr.get(f.id); if (!a) return null;
    const kode = (a.kartleggingsenhet_type1 || a.kartsignatur || '').toLowerCase().replace(/[^0-9a-g]/g, '') || null;
    if (!kode) return null;
    return { id: f.id, kode, navn: a.type1_beskrivelse || VEG_TYPER[kode]?.navn || kode, hovedtype: a.hovudtype_beskrivelse || HOVEDTYPER[parseInt(kode, 10)] || '', aar: Number(a.reg_aar) || null, geometri: f.geometri, bb: f.bb };
  }).filter(Boolean);
}

// Setter b.vegetasjon på alle bestand. organisk: [{ geometri, bb }] med AR5 «organiske jordlag» (valgfritt).
// Returnerer en oppsummering til logg og kildeliste.
export async function settVegetasjon(bestand, { klipping = null, hent = fetch, organisk = [], logg = () => {}, beholdManuell = true } = {}) {
  const snitt = (a, b) => {
    if (!klipping) return null;
    try { const mp = klipping.intersection(a.coordinates, b.coordinates); return mp.length ? { type: 'MultiPolygon', coordinates: mp } : null; } catch { return null; }
  };
  const med = bestand.filter((b) => b.geometri && /Polygon/.test(b.geometri.type));
  let vk = []; let feil = null;
  if (klipping && med.length) {
    try { vk = await hentVegetasjonsflater(med.map((b) => boks(b.geometri)), { hent, logg }); } catch (e) { feil = e.message; }
  }
  const aar = vk.length ? Math.max(...vk.map((f) => f.aar || 0)) || null : null;
  let kartlagt = 0; let anslatt = 0;
  for (const b of bestand) {
    if (beholdManuell && b.vegetasjon && ['manuell', 'import'].includes(b.vegetasjon.kilde)) continue;
    const g = med.includes(b) ? b.geometri : null;
    const fv = g && vk.length ? fordeling(g, vk, snitt) : null;
    const org = g && organisk.length && klipping ? fordeling(g, organisk.map((o) => ({ ...o, kode: 'org', navn: 'org' })), snitt).dekning : 0;
    const v = velgVegetasjon(b, { vk: fv, organisk: org, aar });
    b.vegetasjon = v;
    if (v?.kilde === 'vk') kartlagt++; else if (v) anslatt++;
  }
  return { flater: vk.length, kartlagt, anslatt, aar, feil };
}
