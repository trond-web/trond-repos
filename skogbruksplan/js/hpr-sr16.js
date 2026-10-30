// Hogstmaskindata mot SR16 (Data › Hogstmaskindata): les en HPR-fil (StanForD 2010) for hele planen og sammenlign
// stammene maskinen hogde med treantallet NIBIO anslår i skogressurskartet SR16 på det samme arealet.
// Ingen DOM – kan testes i Node.
//
// Slik regnes det:
//   * Hver stamme har posisjon (kranspissen ved felling) og diameter i brysthøyde (DBH) fra maskinen.
//   * Hogd areal = 10 × 10 m-ruter med stammer (UTM33). Tomme ruter omgitt av hogde ruter regnes med (hull i hogsten).
//   * SR16-flatene for området hentes fra NIBIO (WMS, vektor) med treantall over 5, 8, 10 og 16 cm (trær per ha),
//     volum, middeldiameter, treslagsandeler, målingsår og NIBIOs egen hogstregistrering.
//   * Forventet stammetall i en rute = treantallet i SR16-flaten der ruten ligger × ruteareal (0,01 ha).
//   * Hogde stammer telles med samme diametergrense (DBH ≥ 5, 8, 10 eller 16 cm), slik at like trær sammenlignes.
//   * Summer og avvik per SR16-flate, per bestand i planen og for hele fila. For bestandene vises også planens
//     treantall (taksten) på samme areal.
import { lesProduksjonsfiler, ruterTilFlate } from './stanford.js';
import { parseKml } from './kommuneanalyse.js';
import { geoTilUtm, utmTilGeo } from './proj.js';
import { iGeometri } from './maskindata.js';

export const KILDER = {
  produktark: { navn: 'NIBIO – SR16 produktark (treantall over 5, 8, 10 og 16 cm)', url: 'https://dokument.geonorge.no/produktark/sr16/20230508/sr16-produktark-20230508.pdf' },
  validering: { navn: 'NIBIO – Validering av SR16 med kontrollmålinger', url: 'https://www.nibio.no/tema/skog/kart-over-skogressurser/skogressurskart-sr16/_/attachment/inline/b1351797-d448-4a67-b099-961efaa6bf80:ee86cfca94ca89db5c17610fd52b04b1fc6290f1/Notat-Validering-av-SR16-med-kontrollm%C3%A5linger-i-Asker-Alver-og-ElverumV%C3%A5ler.pdf' },
};
const NIBIO = 'https://wms.nibio.no/cgi-bin/sr16';
export const TERSKLER = [5, 8, 10, 16]; // cm – SR16 srtrean, srtrean_ge8, _ge10, _ge16
const FELT_TREAN = { 5: 'srtrean', 8: 'srtrean_ge8', 10: 'srtrean_ge10', 16: 'srtrean_ge16' };
export const STANDARD_TERSKEL = 10; // hogstmaskinen tar sjelden trær under 8–10 cm
export const RUTE = 10; // m
const RUTE_HA = (RUTE * RUTE) / 10000;
const r = (v, d = 0) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const tall = (v) => { const n = Number(v); return v === '' || v == null || !Number.isFinite(n) ? null : n; };

// ---------- SR16 fra NIBIO ----------
async function tekstFra(hent, url) { const svar = await hent(url); if (!svar.ok) throw new Error(`NIBIO svarte ${svar.status}`); return svar.text(); }
// Alle feltene i GetFeatureInfo-svaret (GML) per flate.
export function lesSr16Gml(tekst) {
  const ut = new Map();
  for (const [, f] of tekst.matchAll(/<SRVTRESLAG_feature>([\s\S]*?)<\/SRVTRESLAG_feature>/g)) {
    const a = {}; for (const [, k, v] of f.matchAll(/<(\w+)>([^<]*)<\/\1>/g)) a[k] = v;
    if (a.gid) ut.set(String(a.gid), a);
  }
  return ut;
}
// Henter SR16-flatene (geometri og verdier) innenfor en boks i UTM33 [x0, y0, x1, y1].
export async function hentSr16(b, { hent = fetch, logg = () => {} } = {}) {
  const base = (bb) => `SERVICE=WMS&VERSION=1.1.1&SRS=EPSG:25833&BBOX=${bb.map((v) => v.toFixed(1)).join(',')}&STYLES=`;
  const storrelse = (bb) => { const dx = bb[2] - bb[0]; const dy = bb[3] - bb[1]; return dx >= dy ? `WIDTH=2000&HEIGHT=${Math.max(200, Math.round((2000 * dy) / dx))}` : `WIDTH=${Math.max(200, Math.round((2000 * dx) / dy))}&HEIGHT=2000`; };
  const geom = new Map();
  const kml = async (bb, dybde = 0) => {
    const t = await tekstFra(hent, `${NIBIO}?${base(bb)}&REQUEST=GetMap&LAYERS=SRVTRESLAG&${storrelse(bb)}&FORMAT=kml`);
    if (/<ServiceException\b/.test(t)) throw new Error('SR16 (NIBIO) svarte med feil for kartet');
    const m = parseKml(t);
    if (m.size >= 1000 && dybde < 4) { const mx = (bb[0] + bb[2]) / 2; const my = (bb[1] + bb[3]) / 2; for (const d of [[bb[0], bb[1], mx, my], [mx, bb[1], bb[2], my], [bb[0], my, mx, bb[3]], [mx, my, bb[2], bb[3]]]) await kml(d, dybde + 1); return; }
    for (const [id, g] of m) geom.set(String(id), g);
  };
  logg('Henter SR16-flater for området …');
  await kml(b);
  logg(`Henter SR16-verdier for ${geom.size} flater …`);
  const attr = lesSr16Gml(await tekstFra(hent, `${NIBIO}?${base(b)}&REQUEST=GetFeatureInfo&LAYERS=SRVTRESLAG&QUERY_LAYERS=SRVTRESLAG&WIDTH=1000&HEIGHT=1000&X=500&Y=500&RADIUS=bbox&FEATURE_COUNT=100000&INFO_FORMAT=application/vnd.ogc.gml`));
  const ut = [];
  for (const [id, g] of geom) { const a = attr.get(id); if (a) ut.push(sr16Flate(id, g, a)); }
  return ut;
}
export function sr16Flate(id, geometri, a) {
  return {
    id: String(id), geometri,
    trean: Object.fromEntries(TERSKLER.map((t) => [t, tall(a[FELT_TREAN[t]])])), // trær per ha
    volub: tall(a.srvolub), // m³/ha uten bark
    diam: tall(a.srdiam_ge8) ?? tall(a.srdiam), hoyde: tall(a.srhoydem) != null ? tall(a.srhoydem) / 10 : null, alder: tall(a.srtrealder), bonitet: tall(a.srbonitet),
    andel: { G: tall(a.gran_prosent), F: tall(a.furu_prosent), L: tall(a.lauv_prosent) },
    treslag: a.treslag_txt || '', aar: tall(a.d3faar), hogst: tall(a.hogst), versjon: tall(a.arsversjon), arealDaa: tall(a.areal_da),
    usikkerhet: tall(a.srvolub_s),
  };
}

// ---------- stammer fra fila ----------
// Leser filene (HPR, også i ZIP, .hprz eller .env) og gir stammene med posisjon.
export async function lesStammer(filer) {
  const data = await lesProduksjonsfiler(filer);
  const hpr = data.meldinger.filter((m) => m.type === 'hpr');
  if (!hpr.length) throw new Error(data.meldinger.some((m) => m.type === 'thp') ? 'Fila er en thp (bare summer, uten stammeposisjoner). Bruk hpr-fila fra hogstmaskinen.' : 'Fant ingen hpr-fil (stammer fra hogstmaskin) i filene.');
  const stammer = new Map(); for (const m of hpr) for (const s of m.stammer) stammer.set(s.k, s);
  const alle = [...stammer.values()];
  return { stammer: alle, medPosisjon: alle.filter((s) => s.pos), maskiner: hpr.flatMap((m) => m.maskiner), objekter: hpr.flatMap((m) => m.objekter), filer: data.filer, versjon: hpr[0].versjon };
}
const nokkel = (e, n) => `${Math.floor(e / RUTE)},${Math.floor(n / RUTE)}`;
// Boksen (UTM33) rundt stammene, med margin.
export function boksFor(stammer, margin = 30) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const s of stammer) { const [e, n] = geoTilUtm(s.pos[0], s.pos[1], 33); if (e < x0) x0 = e; if (e > x1) x1 = e; if (n < y0) y0 = n; if (n > y1) y1 = n; }
  return [x0 - margin, y0 - margin, x1 + margin, y1 + margin];
}

// ---------- sammenligning ----------
// stammerTerskel og sr16 telles bare i ruter med gyldig SR16 (sammenlignbart areal); stammer og m3 gjelder alt.
const null4 = () => Object.fromEntries(TERSKLER.map((t) => [t, 0]));
const tomSum = () => ({ ruter: 0, stammer: 0, alleTerskel: null4(), stammerTerskel: null4(), sr16: null4(), m3: 0, m3Sml: 0, m3Sr16: 0, ruterSml: 0, plan: 0, planStammer: 0, planRuter: 0, dbh: [], treslag: { G: 0, F: 0, L: 0 }, ruterUtenSr16: 0, ruterEtterHogst: 0 });
function legg(sum, celle, flate, bestand) {
  sum.ruter++; sum.stammer += celle.stammer.length; sum.m3 += celle.m3;
  for (const t of TERSKLER) sum.alleTerskel[t] += celle.terskel[t];
  for (const s of celle.stammer) { sum.treslag[s.treslag] = (sum.treslag[s.treslag] || 0) + 1; if (s.dbh) sum.dbh.push(s.dbh); }
  if (!flate) sum.ruterUtenSr16++;
  else if (flate.etterHogst) sum.ruterEtterHogst++;
  else {
    sum.ruterSml++; sum.m3Sml += celle.m3;
    for (const t of TERSKLER) { sum.stammerTerskel[t] += celle.terskel[t]; sum.sr16[t] += (flate.trean[t] || 0) * RUTE_HA; }
    sum.m3Sr16 += (flate.volub || 0) * RUTE_HA;
  }
  // Planens treantall (per daa, fra taksten eller SR16 da planen ble laget) – sammenlignes med alle hogde stammer.
  if (bestand?.treantall != null) { sum.plan += bestand.treantall * RUTE_HA * 10; sum.planStammer += celle.stammer.length; sum.planRuter++; }
}
const histogram = (dbh) => { const h = {}; for (const d of dbh) { const k = Math.floor(d / 20) * 2; h[k] = (h[k] || 0) + 1; } return h; }; // 2 cm-klasser
function avslutt(sum, ekstra = {}) {
  const dbh = sum.dbh; const snitt = dbh.length ? dbh.reduce((a, b) => a + b, 0) / dbh.length / 10 : null;
  const { dbh: _, ...rest } = sum;
  return {
    ...rest, ...ekstra, hogdDaa: r((sum.ruter * RUTE * RUTE) / 1000, 1), smlDaa: r((sum.ruterSml * RUTE * RUTE) / 1000, 1), m3: r(sum.m3, 1), m3Sml: r(sum.m3Sml, 1), m3Sr16: r(sum.m3Sr16, 1),
    sr16: Object.fromEntries(TERSKLER.map((t) => [t, r(sum.sr16[t])])), plan: sum.planRuter ? r(sum.plan) : null,
    dbhSnitt: r(snitt, 1), histogram: histogram(dbh), middelstamme: sum.stammer ? r(sum.m3 / sum.stammer, 3) : null,
  };
}
// Andel hogd av SR16 (1 = like mange som SR16 anslo).
export const andel = (s, t) => (s.sr16[t] ? s.stammerTerskel[t] / s.sr16[t] : null);

// stammer: fra lesStammer, flater: fra hentSr16. S: planen (bestandene brukes til fordeling og planens treantall).
export function sammenlign(S, stammer, flater, { naa = new Date() } = {}) {
  const celler = new Map();
  for (const s of stammer) {
    if (!s.pos) continue;
    const [e, n] = geoTilUtm(s.pos[0], s.pos[1], 33); const k = nokkel(e, n);
    let c = celler.get(k); if (!c) celler.set(k, c = { k, stammer: [], m3: 0, terskel: Object.fromEntries(TERSKLER.map((t) => [t, 0])) });
    c.stammer.push(s); c.m3 += s.fub || 0;
    for (const t of TERSKLER) if (!s.dbh || s.dbh >= t * 10) c.terskel[t]++;
  }
  // Tomme ruter med minst 5 av 8 hogde naboruter regnes som hogd (hull mellom stammene).
  const tomme = new Set();
  for (const k of celler.keys()) {
    const [i, j] = k.split(',').map(Number);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const nk = `${i + di},${j + dj}`; if (celler.has(nk) || tomme.has(nk)) continue;
      let n = 0; for (let a = -1; a <= 1; a++) for (let b2 = -1; b2 <= 1; b2++) if ((a || b2) && celler.has(`${i + di + a},${j + dj + b2}`)) n++;
      if (n >= 5) tomme.add(nk);
    }
  }
  for (const k of tomme) celler.set(k, { k, stammer: [], m3: 0, terskel: Object.fromEntries(TERSKLER.map((t) => [t, 0])), fylt: true });
  // Hver rute knyttes til SR16-flaten og bestandet der midtpunktet ligger.
  const boks = (g) => { let a = Infinity; let b = Infinity; let c = -Infinity; let d = -Infinity; const gaa = (k) => (typeof k[0] === 'number' ? (k[0] < a && (a = k[0]), k[0] > c && (c = k[0]), k[1] < b && (b = k[1]), k[1] > d && (d = k[1])) : k.forEach(gaa)); gaa(g.coordinates); return [a, b, c, d]; };
  const datoer = stammer.map((s) => s.dato).filter(Boolean).sort();
  const hogstAar = datoer.length ? Number(datoer[0].slice(0, 4)) : naa.getFullYear();
  // SR16-flater der NIBIO allerede har registrert hogsten (samme år eller senere, med ett års slingring) viser skogen
  // etter hogst og holdes utenfor sammenligningen.
  // Uten hogstdato i fila kan det ikke avgjøres, og flaten holdes da også utenfor.
  for (const f of flater) f.etterHogst = !!(f.hogst && (!datoer.length || f.hogst >= hogstAar - 1));
  const fl = flater.map((f) => ({ f, bb: boks(f.geometri) }));
  const be = (S?.bestand || []).filter((b) => b.geometri).map((b) => ({ b, bb: boks(b.geometri) }));
  const finn = (liste, p) => liste.find((x) => p[0] >= x.bb[0] && p[0] <= x.bb[2] && p[1] >= x.bb[1] && p[1] <= x.bb[3] && iGeometri(p, x.f?.geometri || x.b.geometri));
  const total = tomSum(); const perFlate = new Map(); const perBestand = new Map(); const ruterPerFlate = new Map(); let utenforPlan = 0;
  for (const c of celler.values()) {
    const [i, j] = c.k.split(',').map(Number); const p = utmTilGeo((i + 0.5) * RUTE, (j + 0.5) * RUTE, 33);
    const f = finn(fl, p)?.f || null; const b = finn(be, p)?.b || null;
    legg(total, c, f, b);
    const fk = f ? f.id : '–';
    if (!perFlate.has(fk)) perFlate.set(fk, tomSum()); legg(perFlate.get(fk), c, f, b);
    if (!ruterPerFlate.has(fk)) ruterPerFlate.set(fk, new Set()); ruterPerFlate.get(fk).add(c.k);
    if (b) { if (!perBestand.has(b.id)) perBestand.set(b.id, tomSum()); legg(perBestand.get(b.id), c, f, b); } else utenforPlan += c.stammer.length;
  }
  const flateRad = (id, s) => {
    const f = flater.find((x) => x.id === id);
    const varsel = [];
    if (f?.aar && f.aar > hogstAar) varsel.push(`SR16 er målt ${f.aar}, etter hogsten`);
    if (f?.etterHogst) varsel.push(`NIBIO har registrert hogsten (${f.hogst}) – SR16 viser skogen etter hogst og er holdt utenfor`);
    else if (f?.hogst) varsel.push(`NIBIO registrerte hogst her i ${f.hogst}`);
    if (f && f.trean[10] == null) varsel.push('SR16 mangler treantall');
    return avslutt(s, { id, sr16Info: f ? { treslag: f.treslag, aar: f.aar, hogst: f.hogst, alder: r(f.alder), bonitet: f.bonitet, diam: r(f.diam, 1), hoyde: r(f.hoyde, 1), volubHa: r(f.volub), andel: f.andel, trean: Object.fromEntries(TERSKLER.map((t) => [t, r(f.trean[t])])), arealDaa: r(f.arealDaa, 1), usikkerhet: r(f.usikkerhet) } : null, varsel });
  };
  const flaterUt = [...perFlate].map(([id, s]) => flateRad(id, s)).sort((a, b) => b.stammer - a.stammer);
  const bestandUt = [...perBestand].map(([id, s]) => { const b = S.bestand.find((x) => x.id === id); return avslutt(s, { id, nr: b.nr, treslag: b.treslag, bonitet: b.bonitet, alder: b.alder, arealDaa: b.areal, planTreantall: b.treantall ?? null }); })
    .sort((a, b) => String(a.nr).localeCompare(String(b.nr), 'nb', { numeric: true }));
  // Kart: hogd flate per SR16-flate (farge etter avvik), og stammene.
  const kartFlater = [...ruterPerFlate].map(([id, ruter]) => { const rad = flaterUt.find((x) => x.id === id); return { id, etterHogst: !!flater.find((x) => x.id === id)?.etterHogst, geometri: ruterTilFlate(ruter), andel: Object.fromEntries(TERSKLER.map((t) => [t, r(andel(rad, t), 3)])) }; }).filter((x) => x.geometri);
  const sr16Omriss = flater.filter((f) => perFlate.has(f.id)).map((f) => ({ id: f.id, geometri: f.geometri }));
  const stammeKart = stammer.filter((s) => s.pos).slice(0, 20000).map((s) => [r(s.pos[0], 6), r(s.pos[1], 6), 'GFL'.indexOf(s.treslag), s.dbh || 0]);
  const aarSr16 = [...new Set(flater.filter((f) => perFlate.has(f.id)).map((f) => f.aar).filter(Boolean))].sort();
  return {
    total: avslutt(total), flater: flaterUt, bestand: bestandUt, utenforPlan, utenSr16: total.ruterUtenSr16,
    fra: datoer[0] || '', til: datoer.at(-1) || '', hogstAar, sr16Aar: aarSr16,
    kart: { flater: kartFlater, sr16: sr16Omriss, stammer: stammeKart },
  };
}

// Vurdering i klartekst for en sum (total, bestand eller flate) ved valgt diametergrense.
export function vurdering(s, t = STANDARD_TERSKEL) {
  const a = andel(s, t);
  if (a == null) {
    const plan = s.plan ? ` Planens treantall gir ${Math.round(s.plan).toLocaleString('nb-NO')} stammer på arealet, maskinen hogde ${s.planStammer.toLocaleString('nb-NO')} (${Math.round((s.planStammer / s.plan) * 100)} %).` : '';
    return { niva: 'ukjent', tekst: `${s.ruterEtterHogst ? 'SR16 er allerede oppdatert etter hogsten her, så det kan ikke sammenlignes.' : 'SR16 har ikke treantall her.'}${plan}` };
  }
  const pst = Math.round(a * 100);
  if (a >= 0.8 && a <= 1.2) return { niva: 'ok', tekst: `Maskinen hogde ${pst} % av stammene SR16 anslo – godt samsvar (innenfor ±20 %).` };
  if (a > 1.2) return { niva: 'hoy', tekst: `Maskinen hogde ${pst} % av det SR16 anslo – SR16 har ${a > 2 ? 'langt ' : ''}færre trær enn det som sto der (SR16 ${Math.round((1 - 1 / a) * 100)} % for lavt).` };
  if (a >= 0.5) return { niva: 'lav', tekst: `Maskinen hogde ${pst} % av stammene SR16 anslo. Enten var SR16 for høyt, eller noen trær ble stående (gjensettingstrær, kantsoner, delvis hogst).` };
  return { niva: 'uttak', tekst: `Maskinen tok ut ${pst} % av stammene SR16 anslo – typisk tynning eller lukket hogst (uttak av stammetallet).` };
}

// CSV (semikolon, norsk desimalkomma) for bestand eller SR16-flater.
export function csv(res, hva = 'bestand', t = STANDARD_TERSKEL) {
  const k = (v) => (typeof v === 'number' ? String(v).replace('.', ',') : `"${String(v ?? '').replace(/"/g, '""')}"`);
  const felles = (s) => [s.hogdDaa, s.smlDaa, s.stammer, s.stammerTerskel[t], s.sr16[t], andel(s, t) != null ? r(andel(s, t) * 100) : '', s.m3, s.m3Sr16, s.middelstamme ?? '', s.dbhSnitt ?? ''];
  const hode = ['Hogd daa', 'Sammenlignbart daa (SR16-skog)', 'Stammer hogd', `Stammer ≥ ${t} cm`, `SR16 ≥ ${t} cm`, 'Hogd i % av SR16', 'm³fub hogd', 'm³ SR16 (ub)', 'Middelstamme m³', 'Middeldiameter cm'];
  const rader = hva === 'flater'
    ? [['SR16-flate', 'Treslag', 'Målt år', 'Hogst registrert', ...hode, 'Varsel'], ...res.flater.map((s) => [s.id, s.sr16Info?.treslag || 'Utenfor SR16-skog', s.sr16Info?.aar ?? '', s.sr16Info?.hogst ?? '', ...felles(s), s.varsel.join('; ')])]
    : [['Bestand', 'Treslag', 'Areal daa', 'Treantall plan per daa', ...hode, 'Plan: forventet stammer'], ...res.bestand.map((s) => [s.nr, s.treslag, s.arealDaa, s.planTreantall ?? '', ...felles(s), s.plan ?? ''])];
  return `﻿${rader.map((x) => x.map(k).join(';')).join('\n')}`;
}

// Kartlag (GeoJSON): hogd areal per SR16-flate med avvik, SR16-omriss og stammer (utvalg).
export const FARGER = { lav: '#2a78d6', ok: '#0ca30c', hoy: '#d03b3b', uttak: '#8a5a2b', ukjent: '#8a8a85' };
export function kartGeojson(analyse, t = STANDARD_TERSKEL, maksStammer = 6000) {
  const f = [];
  for (const o of analyse.kart.sr16) f.push({ type: 'Feature', geometry: o.geometri, properties: { lag: 'sr16' } });
  for (const o of analyse.kart.flater) {
    const a = o.andel[t]; const niva = a == null || o.etterHogst ? 'ukjent' : a > 1.2 ? 'hoy' : a >= 0.8 ? 'ok' : a >= 0.5 ? 'lav' : 'uttak';
    f.push({ type: 'Feature', geometry: o.geometri, properties: { lag: 'hogd', niva, farge: FARGER[niva], andel: a } });
  }
  const st = analyse.kart.stammer; const steg = Math.max(1, Math.ceil(st.length / maksStammer));
  for (let i = 0; i < st.length; i += steg) f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [st[i][0], st[i][1]] }, properties: { lag: 'stamme', treslag: 'GFL'[st[i][2]] || 'L' } });
  return { type: 'FeatureCollection', features: f };
}
