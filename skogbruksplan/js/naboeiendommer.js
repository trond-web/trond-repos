// Naboeiendommer og skogbruksplan: eiendomsflatene (teigene) rundt eiendommen fra Kartverkets eiendom-API, med
// status for skogbruksplan:
//   * «skogiq»  – brukeren har en plan for eiendommen i SkogIQ.ai
//   * «nibio»   – eiendommen er dekket av en skogbruksplan i NIBIOs register (skogbruksplan/hogstklasser)
//   * «mangler» – ingen skogbruksplan funnet (kan også være eiendommer uten skog, f.eks. boligtomter)
//   * «liten»   – under 5 daa, regnes ikke som skogeiendom
// Dekningen av NIBIO-planer leses piksel for piksel fra ett WMS-bilde (UTM33) over hele området.
// Ingen DOM – kan testes i Node.
import { geoTilUtm, punktIGeometri, arealM2 } from './proj.js';

export const KARTVERKET = 'https://ws.geonorge.no';
export const NIBIO_PLAN = 'https://wms.nibio.no/cgi-bin/skogbruksplan';
export const MIN_SKOG_DAA = 5;
export const STATUS = {
  egen: { navn: 'Eiendommen din', farge: '#d03b3b', fyll: 0 },
  skogiq: { navn: 'Har plan i SkogIQ.ai', farge: '#1f8a4c', fyll: 0.28 },
  nibio: { navn: 'Har skogbruksplan (NIBIO)', farge: '#2a78d6', fyll: 0.22 },
  mangler: { navn: 'Mangler skogbruksplan', farge: '#ef7d1a', fyll: 0.30 },
  liten: { navn: 'Liten eiendom (under 5 daa)', farge: '#8a8a85', fyll: 0.06 },
};

export const matrikkelTekst = (e) => `${e.gnr}/${e.bnr}${e.fnr ? `/${e.fnr}` : ''}`;
export const matrikkelNokkel = (e) => `${e.kommunenr}-${matrikkelTekst(e)}`;

// Søkepunkter og radius som dekker eiendommen + «rundt» meter. Tjenesten tillater maks 3000 m radius og 500 treff
// per søk, så store eiendommer deles i flere sirkler.
export function sokeomrader(geometri, { rundt = 500 } = {}) {
  const pts = []; const gaa = (k) => (typeof k[0] === 'number' ? pts.push(k) : k.forEach(gaa)); gaa(geometri.coordinates);
  const u = pts.map(([lon, lat]) => geoTilUtm(lon, lat, 33));
  const x0 = Math.min(...u.map((p) => p[0])) - rundt; const x1 = Math.max(...u.map((p) => p[0])) + rundt;
  const y0 = Math.min(...u.map((p) => p[1])) - rundt; const y1 = Math.max(...u.map((p) => p[1])) + rundt;
  const celle = 2000; const nx = Math.max(1, Math.ceil((x1 - x0) / celle)); const ny = Math.max(1, Math.ceil((y1 - y0) / celle));
  const ut = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const cx = x0 + ((i + 0.5) * (x1 - x0)) / nx; const cy = y0 + ((j + 0.5) * (y1 - y0)) / ny;
    ut.push({ utm: [cx, cy], radius: Math.min(3000, Math.ceil(Math.hypot((x1 - x0) / nx, (y1 - y0) / ny) / 2) + 50) });
  }
  return { omrader: ut.slice(0, 16), bbox: [x0, y0, x1, y1] };
}

// Teiger fra Kartverket innenfor søkeområdene. Gir GeoJSON-features (lon/lat), uten dubletter.
export async function hentTeiger(omrader, { hent = fetch, utmTilGeo } = {}) {
  const sett = new Map();
  for (const o of omrader) {
    const [lon, lat] = utmTilGeo(o.utm[0], o.utm[1], 33);
    const url = `${KARTVERKET}/eiendom/v1/punkt/omrader?nord=${lat.toFixed(6)}&ost=${lon.toFixed(6)}&koordsys=4258&radius=${o.radius}&utkoordsys=4258&maksTreff=500`;
    let d = null;
    for (let f = 0; f < 3 && !d; f++) { try { const r = await hent(url); if (!r.ok) throw new Error(`Kartverket svarte ${r.status}`); d = await r.json(); } catch (e) { if (f === 2) throw e; await new Promise((ok) => setTimeout(ok, 800 * (f + 1))); } }
    for (const ft of d.features || []) {
      const p = ft.properties || {}; if (!ft.geometry || !/Polygon/.test(ft.geometry.type)) continue;
      const id = p.lokalid ?? `${p.matrikkelnummertekst}|${JSON.stringify(ft.geometry.coordinates[0]?.[0])}`;
      if (!sett.has(id)) sett.set(id, ft);
    }
  }
  return [...sett.values()];
}

// Slår sammen teigene per matrikkelenhet (gnr/bnr/fnr) til én eiendom med MultiPolygon.
export function grupper(teiger) {
  const m = new Map();
  for (const t of teiger) {
    const p = t.properties || {};
    const e = { kommunenr: String(p.kommunenummer || ''), gnr: Number(p.gardsnummer), bnr: Number(p.bruksnummer), fnr: Number(p.festenummer || 0) };
    if (!e.gnr || !e.bnr) continue;
    const k = matrikkelNokkel(e);
    if (!m.has(k)) m.set(k, { ...e, id: k, tekst: matrikkelTekst(e), polygoner: [] });
    const g = t.geometry; m.get(k).polygoner.push(...(g.type === 'Polygon' ? [g.coordinates] : g.coordinates));
  }
  return [...m.values()].map((e) => { const geometri = { type: 'MultiPolygon', coordinates: e.polygoner }; const { polygoner, ...rest } = e; return { ...rest, geometri, daa: Math.round(arealM2(geometri) / 100) / 10, teiger: polygoner.length }; });
}

// Område for bildet: alle eiendommene (de kan stikke langt utenfor søkeområdet), men høyst «maks» meter fra søket.
export function bildeomrade(eiendommer, sok, maks = 3000) {
  let [x0, y0, x1, y1] = sok;
  for (const e of eiendommer) { const pts = []; const gaa = (k) => (typeof k[0] === 'number' ? pts.push(k) : k.forEach(gaa)); gaa(e.geometri.coordinates); for (const [lon, lat] of pts) { const [x, y] = geoTilUtm(lon, lat, 33); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }
  return [Math.max(x0, sok[0] - maks), Math.max(y0, sok[1] - maks), Math.min(x1, sok[2] + maks), Math.min(y1, sok[3] + maks)];
}

// WMS-bilde av NIBIOs skogbruksplaner over området (UTM33), maks 2000 px på lengste side.
export function planBildeUrl([x0, y0, x1, y1], maksPx = 2000) {
  const dx = x1 - x0; const dy = y1 - y0;
  const w = dx >= dy ? maksPx : Math.max(100, Math.round((maksPx * dx) / dy)); const h = dx >= dy ? Math.max(100, Math.round((maksPx * dy) / dx)) : maksPx;
  return { url: `${NIBIO_PLAN}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=hogstklasser&STYLES=&SRS=EPSG:25833&BBOX=${[x0, y0, x1, y1].map((v) => v.toFixed(1)).join(',')}&WIDTH=${w}&HEIGHT=${h}&FORMAT=image/png&TRANSPARENT=true`, w, h };
}

// Andel av eiendommen som er dekket av NIBIO-planer: punkter hver «steg» meter inne i eiendommen, slått opp i bildet.
export function planDekning(eiendom, raster, bbox, { steg = 20 } = {}) {
  const [x0, y0, x1, y1] = bbox; const { w, h, data } = raster;
  const pts = []; const gaa = (k) => (typeof k[0] === 'number' ? pts.push(k) : k.forEach(gaa)); gaa(eiendom.geometri.coordinates);
  const u = pts.map(([lon, lat]) => geoTilUtm(lon, lat, 33));
  const ex0 = Math.min(...u.map((p) => p[0])); const ex1 = Math.max(...u.map((p) => p[0]));
  const ey0 = Math.min(...u.map((p) => p[1])); const ey1 = Math.max(...u.map((p) => p[1]));
  // Store eiendommer: grovere rutenett, høyst ca. 4000 punkter.
  const s = Math.max(steg, Math.sqrt(((ex1 - ex0) * (ey1 - ey0)) / 4000));
  // Punkt-i-polygon i UTM33 for fart.
  const polyU = eiendom.geometri.coordinates.map((poly) => poly.map((ring) => ring.map(([lon, lat]) => geoTilUtm(lon, lat, 33))));
  const inni = (x, y) => polyU.some((poly) => punktIGeometri([x, y], { type: 'Polygon', coordinates: poly }));
  let n = 0; let dekket = 0; let punkt = null;
  for (let x = ex0 + s / 2; x < ex1; x += s) for (let y = ey0 + s / 2; y < ey1; y += s) {
    if (!inni(x, y)) continue;
    const px = Math.floor(((x - x0) / (x1 - x0)) * w); const py = Math.floor(((y1 - y) / (y1 - y0)) * h);
    if (px < 0 || py < 0 || px >= w || py >= h) continue; // utenfor bildet: telles ikke
    n++;
    if (data[(py * w + px) * 4 + 3] > 40) { dekket++; if (!punkt) punkt = [Math.round(x), Math.round(y)]; }
  }
  if (!n) return null; // ukjent – eiendommen ligger utenfor bildet
  // punkt: et sted inne i eiendommen som er dekket av en plan (til oppslag av takstår)
  return { andel: dekket / n, daa: Math.round(((dekket * s * s) / 1000) * 10) / 10, punkt };
}

// Status for hver eiendom. egen = nøkkelen til eiendommen som er åpen; mine = nøkler for planer i SkogIQ.
export function settStatus(eiendommer, { egen = new Set(), mine = new Map(), dekning = new Map() } = {}) {
  return eiendommer.map((e) => {
    const d = dekning.get(e.id) || null;
    let status;
    if (egen.has(e.id)) status = 'egen';
    else if (mine.has(e.id)) status = 'skogiq';
    else if (d && (d.andel >= 0.1 || d.daa >= 10)) status = 'nibio';
    else if (e.daa < MIN_SKOG_DAA) status = 'liten';
    else status = 'mangler';
    return { ...e, status, dekning: d, planId: mine.get(e.id) || null };
  });
}
export function oppsummer(liste) {
  const ut = {}; for (const k of Object.keys(STATUS)) ut[k] = { antall: 0, daa: 0 };
  for (const e of liste) { ut[e.status].antall++; ut[e.status].daa += e.daa; }
  return ut;
}

// Matrikkelnøkler for planene i SkogIQ (eiendom.kommunenr + gnrbnr som «gnr/bnr» eller «gnr/bnr/fnr»).
export function planNokler(planer) {
  const m = new Map();
  for (const p of planer) {
    const knr = String(p.kommunenr || p.eiendom?.kommunenr || ''); const g = String(p.gnrbnr || p.eiendom?.gnrbnr || '');
    for (const del of g.split(/[,;]\s*/)) {
      const t = /(\d+)\s*\/\s*(\d+)(?:\s*\/\s*(\d+))?/.exec(del); if (!knr || !t) continue;
      m.set(matrikkelNokkel({ kommunenr: knr, gnr: +t[1], bnr: +t[2], fnr: +(t[3] || 0) }), p.id || p.planId);
    }
  }
  return m;
}

// Takstår for NIBIO-planen i et punkt (GetFeatureInfo, GML).
export function planInfoUrl([x, y]) {
  const d = 50;
  return `${NIBIO_PLAN}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=hogstklasser&QUERY_LAYERS=hogstklasser&STYLES=&SRS=EPSG:25833&BBOX=${x - d},${y - d},${x + d},${y + d}&WIDTH=101&HEIGHT=101&X=50&Y=50&INFO_FORMAT=application/vnd.ogc.gml&FEATURE_COUNT=1`;
}
export function tolkPlanInfo(gml) {
  const f = (n) => new RegExp(`<${n}>([^<]*)</${n}>`).exec(gml)?.[1] || null;
  const aar = Number(String(f('regaar_korr') || f('regdato') || '').slice(0, 4)) || null;
  return aar || f('prosjekt') ? { aar, prosjekt: f('prosjekt') } : null;
}
