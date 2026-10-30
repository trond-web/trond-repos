// Omgivelser i den virtuelle skogen: eiendomsgrense, veier, stier, bekker, innsjøer, bygninger og markslag (AR5),
// i tillegg til bestandene. Hentes fra åpne tjenester som svarer direkte til nettleseren (CORS):
//   Veier:      planens veiregister + NVDB vegnett (Statens vegvesen) – alle veier, også private og skogsbilveier
//   Stier:      Kartverkets turrutebase (Fotrute, AnnenRute) – merkede stier og traktorveier
//   Bekker:     NVE Elvenett (ELVIS); innsjøer: NVE Innsjødatabasen
//   Bygninger:  Matrikkelen bygningspunkt (Kartverket) – plassering og bygningstype
//   Markslag:   NIBIO AR5 – jordbruk, myr, åpen fastmark, bebygd, vann og skog utenfor planen
// Alle koordinater ut er lokale meter rundt senteret (x øst, y nord). Ingen DOM – kan testes i Node.
import { geoTilUtm, utmTilGeo } from './proj.js';
import { iPolygon } from './skog3d-data.js';
import { hentAr5, begrens } from './markslag.js';

export const KILDER = {
  bygg: 'https://wfs.geonorge.no/skwms1/wfs.matrikkelen-bygningspunkt',
  ruter: 'https://wfs.geonorge.no/skwms1/wfs.turogfriluftsruter',
  elv: 'https://kart.nve.no/enterprise/rest/services/Elvenett1/MapServer/2/query',
  innsjo: 'https://kart.nve.no/enterprise/rest/services/Innsjodatabase2/MapServer/5/query',
  nvdb: 'https://nvdbapiles.atlas.vegvesen.no/vegnett/api/v4/veglenkesekvenser/segmentert',
};

// ---------- geometri ----------
const tilLokal = ([lon, lat], [cx, cy]) => { const [x, y] = geoTilUtm(lon, lat, 33); return [x - cx, y - cy]; };
export const lokalPolygon = (geom, senter) => (geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates).map((p) => p.map((r) => r.map((q) => tilLokal(q, senter))));
export function avstandTilLinje(px, py, linje) {
  let min = Infinity;
  for (let i = 0; i < linje.length - 1; i++) {
    const [x0, y0] = linje[i]; const [x1, y1] = linje[i + 1]; const dx = x1 - x0; const dy = y1 - y0; const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2)) : 0;
    const d = Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy)); if (d < min) min = d;
  }
  return min;
}
const bboxMp = (mp) => { let a = Infinity; let b = Infinity; let c = -Infinity; let d = -Infinity; for (const p of mp) for (const [x, y] of p[0]) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; } return [a, b, c, d]; };
const bboxLinje = (l, m = 0) => [Math.min(...l.map((p) => p[0])) - m, Math.min(...l.map((p) => p[1])) - m, Math.max(...l.map((p) => p[0])) + m, Math.max(...l.map((p) => p[1])) + m];
const iBoks = (x, y, b) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
// Første flate i lista som dekker punktet (flatene har mp i lokale meter). Rask forhåndssjekk med boks.
export function lagOppslag(flater) {
  const med = flater.map((f) => ({ f, bb: bboxMp(f.mp) }));
  return (x, y) => { for (const { f, bb } of med) if (iBoks(x, y, bb) && iPolygon(x, y, f.mp)) return f; return null; };
}
// Klipper en linje mot sirkelen (beholder deler innenfor R + litt).
const innenfor = (linje, R) => { const ut = []; let del = []; for (const p of linje) { if (Math.hypot(p[0], p[1]) <= R + 20) del.push(p); else { if (del.length > 1) ut.push(del); del = []; } } if (del.length > 1) ut.push(del); return ut; };

// ---------- tolking ----------
// Matrikkelen bygningspunkt (GML 3.2, EPSG:4258 med lat lon).
const IKKE_BYGD = ['RA', 'IP', 'BR', 'BF', 'BU', 'GR', 'MD'];
export function parseBygninger(xml) {
  const ut = [];
  for (const del of String(xml).split(/<wfs:member>/).slice(1)) {
    const pos = del.match(/<gml:pos>\s*([-\d.]+)\s+([-\d.]+)/); if (!pos) continue;
    const type = Number((del.match(/<app:bygningstype>(\d+)</) || [])[1]) || 0; const status = (del.match(/<app:bygningsstatus>(\w+)</) || [])[1] || '';
    if (IKKE_BYGD.includes(status)) continue;
    ut.push({ lon: Number(pos[2]), lat: Number(pos[1]), type, nr: (del.match(/<app:bygningsnummer>(\d+)</) || [])[1] || null });
  }
  return ut;
}
// Turrutebasen (Fotrute, AnnenRute): senterlinjer. ruteFølger: ST sti, TR traktorvei, BV bilvei, ...
export function parseRuter(xml) {
  const ut = [];
  for (const del of String(xml).split(/<wfs:member>/).slice(1)) {
    const folger = (del.match(/<app:ruteFølger>(\w+)</) || [])[1] || 'ST'; const navn = (del.match(/<app:rutenavn>([^<]+)</) || [])[1] || null;
    for (const [, pl] of del.matchAll(/<gml:posList[^>]*>([^<]+)</g)) {
      const t = pl.trim().split(/\s+/).map(Number); const linje = [];
      for (let i = 0; i + 1 < t.length; i += 2) linje.push([t[i + 1], t[i]]);
      if (linje.length > 1) ut.push({ linje, folger, navn });
    }
  }
  return ut;
}
// NVDB vegnett (srid 5973 = UTM33): én linje per segment, med vegkategori og vegtype.
export function parseNvdbVeier(objekter) {
  const ut = [];
  for (const o of objekter || []) {
    if (o.type && o.type !== 'HOVED') continue;
    if (o.topologinivå && o.topologinivå !== 'Vegtrase') continue;
    const m = String(o.geometri?.wkt || '').match(/LINESTRING(?:\s+Z)?\s*\((.*)\)/s); if (!m) continue;
    const linje = m[1].split(',').map((p) => p.trim().split(/\s+/).slice(0, 2).map(Number)).filter((p) => p.every(Number.isFinite));
    if (linje.length < 2) continue;
    ut.push({ linje, kat: o.vegsystemreferanse?.vegsystem?.vegkategori || 'P', typeVeg: o.typeVeg || '', navn: o.adresse?.navn || o.vegsystemreferanse?.kortform || null });
  }
  return ut;
}
// Veibredde og dekke
export function veiProfil({ kat, typeVeg = '', klasse = null }) {
  if (/gang|sykkel|fortau|trapp|sti/i.test(typeVeg)) return { bredde: 2.5, flate: 'grus', navn: typeVeg };
  if (klasse === 7 || klasse === 8) return { bredde: 3, flate: 'traktor', navn: 'Traktorvei' };
  if (klasse != null) return { bredde: klasse <= 2 ? 4.5 : 4, flate: 'grus', navn: 'Skogsbilvei' };
  return { E: { bredde: 9, flate: 'asfalt', navn: 'Europavei' }, R: { bredde: 8, flate: 'asfalt', navn: 'Riksvei' }, F: { bredde: 6.5, flate: 'asfalt', navn: 'Fylkesvei' }, K: { bredde: 5, flate: 'asfalt', navn: 'Kommunal vei' } }[kat] || { bredde: 4, flate: 'grus', navn: 'Privat vei' };
}
// Bygningstype (matrikkelens kodeliste) → mål og farger. l × b grunnflate, h vegghøyde, tak = takvinkel i grader.
const MALING = { hvit: [0.92, 0.91, 0.86], gul: [0.86, 0.72, 0.38], rod: [0.6, 0.16, 0.12], gra: [0.62, 0.63, 0.62], brun: [0.38, 0.26, 0.17], mork: [0.22, 0.2, 0.18] };
const TAK = { mork: [0.17, 0.17, 0.18], gra: [0.38, 0.39, 0.4], torv: [0.3, 0.38, 0.16], rod: [0.42, 0.16, 0.12] };
const hashTall = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
export function byggMal(type, fro = '') {
  const v = hashTall(fro); const v2 = hashTall(`${fro}|2`); const s = 0.85 + v2 * 0.3;
  const velg = (liste) => liste[Math.floor(v * liste.length) % liste.length];
  let m;
  if (type >= 111 && type <= 159) m = { navn: 'Bolig', l: 11, b: 8, h: 5.2, tak: 35, vegg: velg(['hvit', 'gul', 'rod', 'hvit', 'gra']), takF: velg(['mork', 'gra', 'rod']), vinduer: true };
  else if (type >= 161 && type <= 163) m = { navn: 'Fritidsbolig', l: 8.5, b: 6.5, h: 3, tak: 27, vegg: velg(['brun', 'rod', 'mork', 'brun']), takF: velg(['torv', 'mork', 'torv']), vinduer: true };
  else if (type >= 171 && type <= 172) m = { navn: 'Koie / seterhus', l: 5.5, b: 4.5, h: 2.5, tak: 27, vegg: velg(['brun', 'mork']), takF: 'torv', vinduer: true };
  else if (type >= 181 && type <= 183) m = { navn: 'Garasje / uthus', l: 6.5, b: 5, h: 2.6, tak: 25, vegg: velg(['rod', 'hvit', 'brun', 'gra']), takF: velg(['mork', 'gra']), vinduer: false };
  else if ([241, 248, 249].includes(type)) m = { navn: 'Driftsbygning (låve/fjøs)', l: 28, b: 13, h: 7, tak: 33, vegg: velg(['rod', 'rod', 'hvit', 'gra']), takF: 'gra', vinduer: false };
  else if (type === 243) m = { navn: 'Veksthus', l: 20, b: 8, h: 3, tak: 25, vegg: 'hvit', takF: 'gra', vinduer: false };
  else if (type === 245) m = { navn: 'Naust', l: 7, b: 5, h: 2.6, tak: 33, vegg: velg(['rod', 'brun']), takF: velg(['mork', 'torv']), vinduer: false };
  else if (type >= 211 && type <= 249) m = { navn: 'Industri / lager', l: 24, b: 14, h: 6, tak: 10, vegg: velg(['gra', 'hvit']), takF: 'gra', vinduer: false };
  else if (type >= 300) m = { navn: 'Næring / offentlig', l: 20, b: 13, h: 7, tak: 20, vegg: velg(['hvit', 'gra', 'gul']), takF: 'mork', vinduer: true };
  else m = { navn: 'Bygning', l: 8, b: 6, h: 3, tak: 27, vegg: velg(['rod', 'brun', 'hvit']), takF: 'mork', vinduer: false };
  return { ...m, l: m.l * s, b: m.b * s, h: m.h, vegg: MALING[m.vegg], takF: TAK[m.takF] };
}

// Står punktet inne i en bygning (med margin)? Brukes for å hindre at du går gjennom vegger.
export function iBygning(omg, x, y, margin = 0.4) {
  for (const g of omg.bygg || []) {
    const dx = x - g.x; const dy = y - g.y; if (Math.abs(dx) > 30 || Math.abs(dy) > 30) continue;
    const c = Math.cos(g.rot || 0); const s = Math.sin(g.rot || 0); const u = dx * c + dy * s; const w = -dx * s + dy * c;
    if (Math.abs(u) < g.mal.l / 2 + margin && Math.abs(w) < g.mal.b / 2 + margin) return g;
  }
  return null;
}

// ---------- hindre: hvor trær og planter ikke skal stå ----------
// Gir (x, y) → 'vei' | 'sti' | 'vann' | 'bygg' | null. Linjer legges i et rutenett for rask oppslag.
export function lagHinder(omg) {
  const C = 8; const nett = new Map(); const key = (i, j) => `${i},${j}`;
  const legg = (obj, bb) => { for (let i = Math.floor(bb[0] / C); i <= Math.floor(bb[2] / C); i++) for (let j = Math.floor(bb[1] / C); j <= Math.floor(bb[3] / C); j++) { const k = key(i, j); if (!nett.has(k)) nett.set(k, []); nett.get(k).push(obj); } };
  const seg = (type, linje, halv) => { for (let i = 0; i < linje.length - 1; i++) { const l = [linje[i], linje[i + 1]]; legg({ type, l, halv }, bboxLinje(l, halv)); } };
  for (const v of omg.veier || []) seg(v.flate === 'sti' ? 'sti' : 'vei', v.linje, v.bredde / 2 + (v.flate === 'sti' ? 0.3 : 1.2));
  for (const b of omg.bekker || []) seg('vann', b.linje, b.bredde / 2 + 0.3);
  for (const g of omg.bygg || []) { const r = Math.hypot(g.mal.l, g.mal.b) / 2 + 2.5; legg({ type: 'bygg', x: g.x, y: g.y, r }, [g.x - r, g.y - r, g.x + r, g.y + r]); }
  const sjo = lagOppslag((omg.innsjoer || []).map((s) => ({ mp: s.mp })));
  const PRI = { vann: 4, bygg: 3, vei: 2, sti: 1 };
  return (x, y) => {
    let best = null;
    for (const o of nett.get(key(Math.floor(x / C), Math.floor(y / C))) || []) {
      const treff = o.l ? avstandTilLinje(x, y, o.l) <= o.halv : Math.hypot(x - o.x, y - o.y) <= o.r;
      if (treff && (!best || PRI[o.type] > PRI[best])) best = o.type;
    }
    if (!best && sjo(x, y)) best = 'vann';
    return best;
  };
}

// ---------- henting ----------
async function medTid(hent, url, { ms = 20000, json = true, headers } = {}) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try { const r = await hent(url, { signal: ctrl.signal, headers }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return json ? await r.json() : await r.text(); } finally { clearTimeout(t); }
}
// Boks rundt senteret (UTM33) → [minLon, minLat, maxLon, maxLat]
function geoBoks([cx, cy], R) {
  const h = [[-R, -R], [-R, R], [R, -R], [R, R]].map(([x, y]) => utmTilGeo(cx + x, cy + y, 33));
  return [Math.min(...h.map((p) => p[0])), Math.min(...h.map((p) => p[1])), Math.max(...h.map((p) => p[0])), Math.max(...h.map((p) => p[1]))];
}
const wfs = (base, typer, [a, b, c, d], antall = 2000) => `${base}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${typer}&count=${antall}&bbox=${b.toFixed(6)},${a.toFixed(6)},${d.toFixed(6)},${c.toFixed(6)},urn:ogc:def:crs:EPSG::4258`;
const arcgis = (base, [a, b, c, d], felt) => `${base}?geometry=${a.toFixed(6)},${b.toFixed(6)},${c.toFixed(6)},${d.toFixed(6)}&geometryType=esriGeometryEnvelope&inSR=4326&outSR=4326&spatialRel=esriSpatialRelIntersects&outFields=${felt}&returnGeometry=true&f=geojson&resultRecordCount=2000`;
const AR5_TRESLAG = { Barskog: 'G', Lauvskog: 'L', Blandingsskog: 'G' };
const AR5_BONITET = { Lav: 8, Middels: 11, Høy: 14, 'Særs høy': 17, Impediment: 6 };

// Henter alt rundt senteret (UTM33) innenfor R meter. Hver kilde kan feile (eller bruke for lang tid) uten at resten stopper.
export async function hentOmgivelser(senter, R, { S = {}, hent = (u, o) => fetch(u, o), logg = () => {}, maksTid = 25000 } = {}) {
  const bb = geoBoks(senter, R + 30); const status = {};
  const kjor = async (navn, fn) => { try { const r = await Promise.race([fn(), new Promise((_, nei) => setTimeout(() => nei(new Error('tidsavbrudd')), maksTid))]); status[navn] = Array.isArray(r) ? r.length : 'ok'; return r; } catch (e) { status[navn] = 'feil'; logg(`${navn}: ${e.message}`); return null; } };
  const [cx, cy] = senter;
  const [bygg, ruter, elver, sjoer, nvdb, ar5] = await Promise.all([
    kjor('bygninger', async () => parseBygninger(await medTid(hent, wfs(KILDER.bygg, 'app:Bygning', bb), { json: false }))),
    kjor('stier', async () => parseRuter(await medTid(hent, wfs(KILDER.ruter, 'app:Fotrute,app:AnnenRute', bb), { json: false }))),
    kjor('bekker', async () => (await medTid(hent, arcgis(KILDER.elv, bb, 'objekttype,elvenavn'))).features || []),
    kjor('innsjøer', async () => (await medTid(hent, arcgis(KILDER.innsjo, bb, 'navn'))).features || []),
    kjor('veier', async () => {
      const ut = []; let url = `${KILDER.nvdb}?kartutsnitt=${cx - R - 30},${cy - R - 30},${cx + R + 30},${cy + R + 30}&srid=5973&antall=1000`;
      for (let side = 0; url && side < 5; side++) { const d = await medTid(hent, url, { headers: { 'X-Client': 'skogbruksplan-app', Accept: 'application/json' } }); ut.push(...(d.objekter || [])); url = d.metadata?.returnert >= 1000 ? d.metadata?.neste?.href : null; }
      return parseNvdbVeier(ut);
    }),
    kjor('markslag', async () => { const [a, b, c, d] = bb; return hentAr5({ type: 'Polygon', coordinates: [[[a, b], [c, b], [c, d], [a, d], [a, b]]] }, { hent }); }),
  ]);
  const omg = { veier: [], bekker: [], innsjoer: [], bygg: [], ar5: [], grense: [], status };
  // Veier: NVDB først, så planens veier (som ikke allerede ligger i NVDB), så stier fra turrutebasen.
  for (const v of nvdb || []) { const p = veiProfil(v); for (const l of innenfor(v.linje.map(([x, y]) => [x - cx, y - cy]), R)) omg.veier.push({ linje: l, ...p, navn: v.navn || p.navn, kilde: 'NVDB' }); }
  const naerVei = (linje, grense = 4) => { const pr = linje.filter((_, i) => i % 2 === 0); return pr.filter(([x, y]) => omg.veier.some((v) => avstandTilLinje(x, y, v.linje) <= grense + v.bredde / 2)).length / Math.max(1, pr.length); };
  for (const v of S.veier?.veier || []) {
    if (!v.geometri || v.status === 'planlagt') continue;
    const linjer = v.geometri.type === 'LineString' ? [v.geometri.coordinates] : v.geometri.type === 'MultiLineString' ? v.geometri.coordinates : [];
    for (const l0 of linjer) for (const l of innenfor(l0.map((q) => tilLokal(q, senter)), R)) { if (naerVei(l) > 0.7) continue; const p = veiProfil({ klasse: Number(v.klasse) || 0 }); omg.veier.push({ linje: l, ...p, navn: v.navn || p.navn, kilde: 'Planen' }); }
  }
  for (const r of ruter || []) {
    if (r.folger === 'BV') continue;
    for (const l of innenfor(r.linje.map((q) => tilLokal(q, senter)), R)) { if (naerVei(l, 2) > 0.6) continue; omg.veier.push({ linje: l, ...(r.folger === 'TR' ? { bredde: 3, flate: 'traktor', navn: r.navn || 'Traktorvei' } : { bredde: 0.7, flate: 'sti', navn: r.navn || 'Sti' }), kilde: 'Turrutebasen' }); }
  }
  for (const f of elver || []) {
    const g = f.geometry; const linjer = g?.type === 'LineString' ? [g.coordinates] : g?.type === 'MultiLineString' ? g.coordinates : [];
    const elv = !!f.properties?.elvenavn;
    for (const l0 of linjer) for (const l of innenfor(l0.map((q) => tilLokal(q, senter)), R)) omg.bekker.push({ linje: l, bredde: elv ? 4 : 1.4, navn: f.properties?.elvenavn || 'Bekk' });
  }
  for (const f of sjoer || []) if (f.geometry && /Polygon/.test(f.geometry.type)) omg.innsjoer.push({ mp: lokalPolygon(f.geometry, senter), navn: f.properties?.navn || 'Vann' });
  for (const g of bygg || []) { const [x, y] = tilLokal([g.lon, g.lat], senter); if (Math.hypot(x, y) > R) continue; omg.bygg.push({ x, y, type: g.type, mal: byggMal(g.type, g.nr || `${x.toFixed(1)},${y.toFixed(1)}`), nr: g.nr }); }
  // Bygningene vris etter nærmeste vei (innen 40 m), ellers tilfeldig men fast.
  for (const g of omg.bygg) {
    let best = null; let bd = 40;
    for (const v of omg.veier) for (let i = 0; i < v.linje.length - 1; i++) { const d = avstandTilLinje(g.x, g.y, [v.linje[i], v.linje[i + 1]]); if (d < bd) { bd = d; best = [v.linje[i], v.linje[i + 1]]; } }
    g.rot = best ? Math.atan2(best[1][1] - best[0][1], best[1][0] - best[0][0]) : hashTall(g.nr || g.x) * Math.PI;
  }
  for (const f of ar5 || []) {
    const mp = lokalPolygon(f.geometri, senter);
    omg.ar5.push({ id: f.id, kategori: f.kategori, mp, treslag: AR5_TRESLAG[f.ar5?.treslag] || null, bonitet: AR5_BONITET[f.ar5?.bonitet] || null, beskrivelse: [f.ar5?.artype, f.ar5?.treslag, f.ar5?.bonitet && `${String(f.ar5.bonitet).toLowerCase()} bonitet`].filter((t) => t && !/ikke relevant|ikke registrert/i.test(t)).join(', '), geometri: f.geometri });
  }
  if (!ar5 && S.markslag?.length) for (const f of S.markslag) if (f.geometri) omg.ar5.push({ id: f.id, kategori: f.kategori, mp: lokalPolygon(f.geometri, senter), beskrivelse: f.ar5?.artype || f.kategori, geometri: f.geometri });
  if (!(sjoer || []).length) for (const f of omg.ar5) if (f.kategori === 'vann') omg.innsjoer.push({ mp: f.mp, navn: 'Vann' });
  if (S.eiendom?.grense) omg.grense = lokalPolygon(S.eiendom.grense, senter).flat();
  return omg;
}

// Skog utenfor planen (AR5 produktiv skog, impediment og tresatt myr) som «nabobestand» med generelle verdier.
// lagSkog hopper over trær inne i planens bestand, så bare arealet utenfor får disse trærne.
export function naboBestand(omg) {
  const ut = [];
  for (const f of omg.ar5 || []) {
    if (!f.geometri) continue;
    const felles = { id: `ar5-${f.id}`, nr: 'AR5', nabo: true, geometri: f.geometri, areal: 1, tiltak: [], ar5Beskrivelse: f.beskrivelse, ar5Kategori: f.kategori };
    if (f.kategori === 'produktiv') ut.push({ ...felles, treslag: f.treslag || 'G', bonitet: f.bonitet || 11, alder: 60, hogstklasse: 4 });
    else if (f.kategori === 'impediment') ut.push({ ...felles, treslag: 'F', bonitet: 6, alder: 90, hogstklasse: 5, treantall: 25, hoyde: 9, vegetasjon: { kode: '6a' } });
    else if (f.kategori === 'myr') ut.push({ ...felles, treslag: 'F', bonitet: 6, alder: 80, hogstklasse: 5, treantall: 5, hoyde: 4, vegetasjon: { kode: '8b' } });
  }
  return ut;
}

// Terrengpunkter: tetthet etter størrelsen (ca. hver 12. meter, høyst 41 × 41), hentet i parallell.
export const terrengOppløsning = (R) => Math.max(10, Math.min(41, Math.ceil((2 * R) / 12) + 1));
// Kartverkets punkt-API tar høyst 50 punkter per kall. parallelle = samtidige kall, framdrift(ferdig, totalt) etter hvert kall.
export async function hentHoyder(pts, { hent = (u, o) => fetch(u, o), parallelle = 4, framdrift = null } = {}) {
  const ko = begrens(parallelle); const deler = []; let ferdig = 0;
  for (let i = 0; i < pts.length; i += 50) deler.push(pts.slice(i, i + 50).map(([x, y]) => [Number(x.toFixed(6)), Number(y.toFixed(6))]));
  const en = async (d) => {
    for (let forsok = 0; forsok < 3; forsok++) {
      try { const j = await medTid(hent, `https://ws.geonorge.no/hoydedata/v1/punkt?koordsys=4258&geojson=false&punkter=${encodeURIComponent(JSON.stringify(d))}`, { ms: 25000 }); return (j.punkter || []).map((q) => q.z); } catch { await new Promise((r) => setTimeout(r, 700 * (forsok + 1))); }
    }
    return d.map(() => null);
  };
  const svar = await Promise.all(deler.map((d) => ko(async () => { const r = await en(d); ferdig++; framdrift?.(ferdig, deler.length); return r; })));
  return svar.flat();
}
