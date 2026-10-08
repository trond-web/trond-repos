// Markslag fra NIBIOs arealressurskart AR5 (WMS «ar5», lag «Arealtype»): skiller produktiv skog fra uproduktiv
// skog (impediment), myr, åpen fastmark, jordbruk, bebyggelse, samferdsel og vann. Uproduktiv mark får ikke volum.
// Ingen DOM; geometrioperasjoner sendes inn.
import { geoTilUtm, utmTilGeo, arealM2 } from './proj.js';
import { placemarkGeometri } from './kml.js';

const NIBIO = 'https://wms.nibio.no/cgi-bin/ar5';
const KML_MAKS = 1000;

// Kategorier for kart, rapport og arealoppgave. symbol = id for SVG-mønster.
export const MARKSLAG = {
  produktiv: { navn: 'Produktiv skog', kort: 'Prod. skog', farge: '#5aa469', symbol: null, produktiv: true },
  impediment: { navn: 'Uproduktiv skog (impediment)', kort: 'Impediment', farge: '#b9a77a', symbol: 'impediment' },
  myr: { navn: 'Myr', kort: 'Myr', farge: '#7fb3c8', symbol: 'myr' },
  apen: { navn: 'Åpen fastmark (fjell, lyng, berg)', kort: 'Åpen fastmark', farge: '#d8c9a3', symbol: 'apen' },
  jordbruk: { navn: 'Jordbruksareal (dyrka mark, beite)', kort: 'Jordbruk', farge: '#f3e28a', symbol: 'jordbruk' },
  bebygd: { navn: 'Bebygd', kort: 'Bebygd', farge: '#c9c3bd', symbol: 'bebygd' },
  samferdsel: { navn: 'Samferdsel (vei, jernbane)', kort: 'Samferdsel', farge: '#a9a39c', symbol: 'samferdsel' },
  vann: { navn: 'Ferskvann og hav', kort: 'Vann', farge: '#8fc3ea', symbol: 'vann' },
  sno: { navn: 'Snø og isbre', kort: 'Snø/is', farge: '#eef4f8', symbol: 'sno' },
  ukjent: { navn: 'Ikke kartlagt', kort: 'Ikke kartlagt', farge: '#e5e5e5', symbol: 'ukjent' },
};
// Kategorier der AR5 kan overstyres av nyere data som viser produktiv skog (se generator.js).
export const OVERSTYRBAR = ['impediment', 'myr', 'apen'];
const BONITET = { 11: 'Impediment', 12: 'Lav', 13: 'Middels', 14: 'Høy', 15: 'Særs høy' };

export function klassifiser(a) {
  const t = Number(a.artype); const bon = Number(a.arskogbon);
  if ((t === 30 || t === 60) && bon >= 12 && bon <= 15) return 'produktiv';
  if (t === 30) return 'impediment';
  if (t === 60) return 'myr';
  if (t === 50) return 'apen';
  if (t >= 21 && t <= 23) return 'jordbruk';
  if (t === 11) return 'bebygd';
  if (t === 12) return 'samferdsel';
  if (t === 81 || t === 82) return 'vann';
  if (t === 70) return 'sno';
  return 'ukjent';
}

// ---------- henting ----------
async function hentTekst(hent, url, ms = 60000) {
  for (let forsok = 0; ; forsok++) {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await hent(url, { signal: ctrl.signal });
      if (!r.ok) { const f = new Error(`NIBIO svarte ${r.status}`); f.status = r.status; throw f; }
      return await r.text();
    } catch (e) {
      if (e.status >= 500 || forsok >= 2) throw ctrl.signal.aborted ? new Error('NIBIO (AR5) svarte ikke i tide') : e;
      await new Promise((res) => setTimeout(res, 800 * (forsok + 1)));
    } finally { clearTimeout(t); }
  }
}
export function parseKml(tekst) {
  const ut = [];
  for (const [, pm] of tekst.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)) {
    const id = (pm.match(/<name>[^<]*?\.?(\w+)<\/name>/) || [])[1];
    const geometri = placemarkGeometri(pm);
    if (geometri) ut.push({ id, geometri });
  }
  return ut;
}
const ringer = (g) => (g.type === 'Polygon' ? g.coordinates : g.coordinates.flat());
const bbox = (g) => { let a = Infinity; let b = Infinity; let c = -Infinity; let d = -Infinity; for (const r of ringer(g)) for (const [x, y] of r) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; } return [a, b, c, d]; };
const overlapp = (p, q) => p[0] <= q[2] && q[0] <= p[2] && p[1] <= q[3] && q[1] <= p[3];

// Henter AR5-flater (geometri + attributter) som overlapper grensen. klipp(geometri) → klippet geometri eller null.
export async function hentAr5(grense, { hent = fetch, klipp, logg = () => {}, boksTreff = null } = {}) {
  const [x0, y0, x1, y1] = bbox(grense);
  const h = [[x0, y0], [x0, y1], [x1, y0], [x1, y1]].map(([x, y]) => geoTilUtm(x, y, 33));
  const ub = [Math.min(...h.map((p) => p[0])) - 50, Math.min(...h.map((p) => p[1])) - 50, Math.max(...h.map((p) => p[0])) + 50, Math.max(...h.map((p) => p[1])) + 50];
  const treff = boksTreff || ((bb) => overlapp(bb, [x0, y0, x1, y1]));
  const ruter = [];
  const kmlUrl = (b) => `${NIBIO}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=Arealtype&STYLES=&SRS=EPSG:25833&BBOX=${b.map((v) => v.toFixed(1)).join(',')}&WIDTH=2000&HEIGHT=${Math.max(200, Math.round((2000 * (b[3] - b[1])) / (b[2] - b[0])))}&FORMAT=kml`;
  let feil = 0;
  const hentRute = async (b, dybde = 0) => {
    let fl;
    // Tjenesten svarer 500 på ruter med svært mange flater – da deles ruten, som ved 1000-taket.
    let delOpp = false;
    try { fl = parseKml(await hentTekst(hent, kmlUrl(b))); } catch (e) { if (dybde >= 4) { feil++; return []; } delOpp = true; }
    if (!delOpp && (fl.length < KML_MAKS || dybde >= 5)) { ruter.push(b); return fl; }
    const mx = (b[0] + b[2]) / 2; const my = (b[1] + b[3]) / 2;
    const sett = new Map();
    for (const d of [[b[0], b[1], mx, my], [mx, b[1], b[2], my], [b[0], my, mx, b[3]], [mx, my, b[2], b[3]]]) {
      const hh = [[d[0], d[1]], [d[0], d[3]], [d[2], d[1]], [d[2], d[3]]].map(([x, y]) => utmTilGeo(x, y, 33));
      if (!treff([Math.min(...hh.map((p) => p[0])), Math.min(...hh.map((p) => p[1])), Math.max(...hh.map((p) => p[0])), Math.max(...hh.map((p) => p[1]))])) continue;
      for (const f of await hentRute(d, dybde + 1)) if (!sett.has(f.id)) sett.set(f.id, f);
    }
    return [...sett.values()];
  };
  logg('Henter markslag (AR5) …');
  // AR5-laget tegnes bare i store målestokker: over ca. 6 km bredde gir KML-svaret ingen flater. Start med ruter på maks 4 km; ruter som gir feil 500 deles videre.
  const RUTE = 4000; const start = [];
  for (let x = ub[0]; x < ub[2]; x += RUTE) for (let y = ub[1]; y < ub[3]; y += RUTE) {
    const d = [x, y, Math.min(x + RUTE, ub[2]), Math.min(y + RUTE, ub[3])];
    const hh = [[d[0], d[1]], [d[0], d[3]], [d[2], d[1]], [d[2], d[3]]].map(([a, b]) => utmTilGeo(a, b, 33));
    if (treff([Math.min(...hh.map((p) => p[0])), Math.min(...hh.map((p) => p[1])), Math.max(...hh.map((p) => p[0])), Math.max(...hh.map((p) => p[1]))])) start.push(d);
  }
  const sett = new Map();
  for (const d of start) for (const f of await hentRute(d)) if (!sett.has(f.id)) sett.set(f.id, f);
  if (feil && !sett.size) throw new Error('NIBIO svarte ikke på forespørslene om markslag');
  if (feil) logg(`${feil} rute(r) i AR5 svarte ikke – markslag kan mangle for deler av eiendommen`);
  const flater = [...sett.values()].filter((f) => treff(bbox(f.geometri)));
  // Attributter samlet per rute.
  const attr = new Map();
  for (const b of ruter) {
    const url = `${NIBIO}?SERVICE=WMS&VERSION=1.1.1&SRS=EPSG:25833&BBOX=${b.map((v) => v.toFixed(1)).join(',')}&STYLES=&REQUEST=GetFeatureInfo&LAYERS=Arealtype&QUERY_LAYERS=Arealtype&WIDTH=1000&HEIGHT=1000&X=500&Y=500&RADIUS=bbox&FEATURE_COUNT=100000&INFO_FORMAT=application/vnd.ogc.gml`;
    let tekst = '';
    try { tekst = await hentTekst(hent, url, 90000); } catch { continue; }
    for (const del of tekst.split('<Arealtype_feature>').slice(1)) {
      const a = {};
      for (const [, k, v] of del.split('</Arealtype_feature>')[0].matchAll(/<(\w+)>([^<]*)<\/\1>/g)) a[k] = v;
      if (a.sl_sdeid) attr.set(String(a.sl_sdeid), a);
    }
  }
  logg(`Klipper ${flater.length} AR5-flater mot eiendommen …`);
  const ut = [];
  for (const f of flater) {
    const a = attr.get(String(f.id));
    if (!a) continue;
    const g = klipp ? klipp(f.geometri) : f.geometri;
    if (!g) continue;
    const daa = arealM2(g) / 1000;
    if (daa < 0.05) continue;
    ut.push({ id: f.id, kategori: klassifiser(a), geometri: g, areal: daa, ar5: { artype: a.artype_beskrivelse, bonitet: BONITET[a.arskogbon] || a.arskogbon_beskrivelse, treslag: a.artreslag_beskrivelse, grunnforhold: a.argrunnf_beskrivelse, datafangst: a.datafangstdato, metode: a.klassifiseringsmetode } });
  }
  return ut;
}

// Uproduktive figurer som lagres i planen, nummerert U1, U2 … sortert på kategori og areal.
export function lagFigurer(flater, nyId) {
  const rekkefolge = Object.keys(MARKSLAG);
  return flater.filter((f) => f.kategori !== 'produktiv')
    .sort((a, b) => rekkefolge.indexOf(a.kategori) - rekkefolge.indexOf(b.kategori) || b.areal - a.areal)
    .map((f, i) => ({ id: nyId ? nyId('m') : `m${i}`, nr: `U${i + 1}`, kategori: f.kategori, areal: Math.round(f.areal * 100) / 100, geometri: f.geometri, ar5: f.ar5 }));
}

// Arealfordeling for eiendommen. Produktiv skog = bestandene; resten fra markslagsfigurene.
export function arealfordeling(S) {
  const rader = Object.fromEntries(Object.keys(MARKSLAG).map((k) => [k, { areal: 0, antall: 0 }]));
  rader.produktiv.areal = S.bestand.reduce((s, b) => s + (b.areal || 0), 0); rader.produktiv.antall = S.bestand.length;
  for (const f of S.markslag || []) { rader[f.kategori].areal += f.areal || 0; rader[f.kategori].antall++; }
  const sum = Object.values(rader).reduce((s, r) => s + r.areal, 0);
  const total = S.metadata?.eiendomDaa || sum;
  const uproduktivSkog = rader.impediment.areal + rader.myr.areal + rader.apen.areal;
  return { rader, sum, total, ukjent: Math.max(0, total - sum), uproduktivSkog };
}

// ---------- symboler ----------
// SVG-mønstre (felles for kartet og rapportene). Tradisjonelle kartsymboler: myr = korte streker med tuster,
// impediment = spredte prikker og små trær, åpen fastmark = prikker, jordbruk = skråskravur, vann = bølger.
export function monsterDefs(prefiks = 'ms') {
  const p = (id, w, h, innhold, bakgrunn) => `<pattern id="${prefiks}-${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${bakgrunn ? `<rect width="${w}" height="${h}" fill="${bakgrunn}"/>` : ''}${innhold}</pattern>`;
  return `<defs>
    ${p('myr', 16, 12, '<path d="M2 9h7M10 4h5" stroke="#2f6f8f" stroke-width="1.3"/><path d="M5.5 9v-3M4 9l-1-2.5M7 9l1-2.5M12.5 4V1.5" stroke="#2f6f8f" stroke-width="1"/>', '#cfe6ef')}
    ${p('impediment', 14, 14, '<circle cx="3" cy="3" r="1.1" fill="#7a6a3c"/><circle cx="10" cy="9" r="1.1" fill="#7a6a3c"/><path d="M10 1.5l-2 3.2h4z" fill="#5d7a3c"/>', '#ece4cc')}
    ${p('apen', 10, 10, '<circle cx="2.5" cy="2.5" r="0.9" fill="#8a7a55"/><circle cx="7.5" cy="7.5" r="0.9" fill="#8a7a55"/>', '#f1eadb')}
    ${p('jordbruk', 8, 8, '<path d="M-2 2l4-4M0 8l8-8M6 10l4-4" stroke="#c9a92c" stroke-width="1.2"/>', '#fbf3c2')}
    ${p('bebygd', 8, 8, '<path d="M0 0l8 8M8 0l-8 8" stroke="#8a847d" stroke-width="0.8"/>', '#e4e0dc')}
    ${p('samferdsel', 8, 8, '<path d="M0 4h8" stroke="#77716a" stroke-width="1.4"/>', '#d6d2cd')}
    ${p('vann', 16, 8, '<path d="M0 5q2-3 4 0t4 0t4 0t4 0" fill="none" stroke="#2a78d6" stroke-width="1"/>', '#bfdcf5')}
    ${p('sno', 10, 10, '<path d="M5 2v6M2 5h6" stroke="#9fb6c6" stroke-width="0.8"/>', '#f8fbfd')}
    ${p('ukjent', 8, 8, '<circle cx="4" cy="4" r="0.7" fill="#999"/>', '#efefef')}
  </defs>`;
}
export const symbolFyll = (kategori, prefiks = 'ms') => (MARKSLAG[kategori]?.symbol ? `url(#${prefiks}-${MARKSLAG[kategori].symbol})` : MARKSLAG[kategori]?.farge || '#ddd');
// Liten SVG-rute til tegnforklaringer.
export const symbolRute = (kategori, prefiks = 'msl', st = 14) => `<svg width="${st}" height="${st}" viewBox="0 0 ${st} ${st}" style="vertical-align:-2px;border:1px solid #555;border-radius:2px">${monsterDefs(`${prefiks}-${kategori}`)}<rect width="${st}" height="${st}" fill="${symbolFyll(kategori, `${prefiks}-${kategori}`)}"/></svg>`;

// ---------- for eksisterende planer (polygon-clipping) ----------
const tilGeom = (mp) => (!mp || !mp.length ? null : mp.length === 1 ? { type: 'Polygon', coordinates: mp[0] } : { type: 'MultiPolygon', coordinates: mp });
export const klippTil = (grense, klipping) => (g) => { try { return tilGeom(klipping.intersection(g.coordinates, grense.coordinates)); } catch { return null; } };

// Trekker uproduktive figurer ut av bestandene. Endrer bestandene på stedet og gir en oppsummering.
// Bestand som blir mindre enn minDaa fjernes (de var i praksis uproduktiv mark).
export function trekkUtAvBestand(S, klipping, { minDaa = 0.3 } = {}) {
  const fig = (S.markslag || []).map((f) => ({ f, bb: bbox(f.geometri) }));
  let endret = 0; let fjernet = 0; let daa = 0;
  const behold = [];
  for (const b of S.bestand) {
    if (!b.geometri || !/Polygon/.test(b.geometri.type)) { behold.push(b); continue; }
    const bb = bbox(b.geometri); let g = b.geometri; const for_ = arealM2(g) / 1000; const trukket = {};
    for (const { f, bb: fb } of fig) {
      if (!g || !overlapp(bb, fb)) continue;
      let etter;
      try { etter = tilGeom(klipping.difference(g.coordinates, f.geometri.coordinates)); } catch { continue; }
      const d = arealM2(g) / 1000 - (etter ? arealM2(etter) / 1000 : 0);
      if (d > 0.001) trukket[f.kategori] = (trukket[f.kategori] || 0) + d;
      g = etter;
    }
    const sum = Object.values(trukket).reduce((x, y) => x + y, 0);
    if (sum < 0.05) { behold.push(b); continue; }
    daa += Math.min(sum, for_);
    if (!g || arealM2(g) / 1000 < minDaa) { fjernet++; continue; }
    b.geometri = g; b.areal = Math.round((arealM2(g) / 1000) * 100) / 100; endret++;
    const tekst = `Uproduktiv mark trukket ut etter AR5: ${Object.entries(trukket).filter(([, v]) => v >= 0.1).map(([k, v]) => `${v.toFixed(1).replace('.', ',')} daa ${MARKSLAG[k].kort.toLowerCase()}`).join(', ')}`;
    b.merknad = [String(b.merknad || '').replace(/;?\s*Uproduktiv mark trukket ut etter AR5:[^;]*/g, '').trim(), tekst].filter(Boolean).join('; ');
    behold.push(b);
  }
  S.bestand = behold;
  return { endret, fjernet, daa };
}
