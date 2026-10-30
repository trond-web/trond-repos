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
  statskog: { navn: 'Statskog – Kvalitetsstandard for hogst-tiltak (2026): uttak maks 35 % av grunnflaten, stikkvei maks 4,5 m bred og minst 20 m mellom', url: 'https://statskog.s3.amazonaws.com/pdf_word/skog/Statskogs-kvalitetsstandard-for-hogst-tiltak.pdf' },
  skogkurs: { navn: 'Skogkurs – Tynning (2013): grunnflate er bedre rettesnor enn treantall; gran ved 16–18 m overhøyde ikke under 24–28 m²/ha', url: 'https://www.storfjord.kommune.no/getfile.php/3709256.1229.scexbaefud/Tynning.pdf' },
  nibio: { navn: 'NIBIO – Tynning og skogproduksjon (første tynning ved 12–14 m, andre ved 16–18 m overhøyde; stikkveier 3–4 m, 20–30 m mellom)', url: 'https://nibio.no/tema/skog/skogbehandling-og-skogskjotsel/tynning/tynning-og-skogproduksjon' },
  snl: { navn: 'Store norske leksikon – Tynning (skogbruk)', url: 'https://snl.no/tynning_-_skogbruk' },
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
    grflate: tall(a.srgrflate), // grunnflate m²/ha
    hoydeo: tall(a.srhoydeo) != null ? tall(a.srhoydeo) / 10 : null, // overhøyde m
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
const tomSum = () => ({ ruter: 0, stammer: 0, alleTerskel: null4(), stammerTerskel: null4(), sr16: null4(), m3: 0, m3Sml: 0, m3Sr16: 0, ruterSml: 0, plan: 0, planStammer: 0, planRuter: 0, dbh: [], treslag: { G: 0, F: 0, L: 0 }, ruterUtenSr16: 0, ruterEtterHogst: 0, gUttak: 0, nDbh: 0, gSr16: 0, gVekt: 0, hoydeoSum: 0, hoydeoVekt: 0, bonSum: 0, bonVekt: 0, lauvSum: 0, lauvVekt: 0, lauvStammer: 0, stikkveiM: 0 });
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
    // Tynning: grunnflate tatt ut (fra DBH) mot SR16-grunnflaten før, overhøyde, bonitet og lauvandel.
    sum.gUttak += celle.g; sum.nDbh += celle.nDbh; sum.lauvStammer += celle.stammer.filter((x) => x.treslag === 'L').length;
    if (flate.grflate != null) { sum.gSr16 += flate.grflate * RUTE_HA; sum.gVekt += RUTE_HA; }
    if (flate.hoydeo != null) { sum.hoydeoSum += flate.hoydeo; sum.hoydeoVekt++; }
    if (flate.bonitet) { sum.bonSum += flate.bonitet; sum.bonVekt++; }
    if (flate.andel?.L != null) { sum.lauvSum += flate.andel.L; sum.lauvVekt++; }
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
    let c = celler.get(k); if (!c) celler.set(k, c = { k, stammer: [], m3: 0, g: 0, nDbh: 0, terskel: Object.fromEntries(TERSKLER.map((t) => [t, 0])) });
    c.stammer.push(s); c.m3 += s.fub || 0;
    if (s.dbh) { c.g += (Math.PI / 4) * (s.dbh / 1000) ** 2; c.nDbh++; }
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
  for (const k of tomme) celler.set(k, { k, stammer: [], m3: 0, g: 0, nDbh: 0, terskel: Object.fromEntries(TERSKLER.map((t) => [t, 0])), fylt: true });
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
  // Stikkveier fra maskinens posisjon (base machine) i den rekkefølgen stammene ble hogd: påfølgende posisjoner
  // under 25 m fra hverandre er kjøring langs stikkveien. Lengden fordeles på bestandene etter midtpunktet.
  const sv = stikkveier(stammer);
  for (const seg of sv.segmenter) {
    const m = [(seg[0][0] + seg[1][0]) / 2, (seg[0][1] + seg[1][1]) / 2]; const l = seg.lengde;
    total.stikkveiM += l; const b = finn(be, m)?.b; if (b && perBestand.has(b.id)) perBestand.get(b.id).stikkveiM += l;
  }
  // Kart: hogd flate per SR16-flate (farge etter avvik), og stammene.
  const kartFlater = [...ruterPerFlate].map(([id, ruter]) => { const rad = flaterUt.find((x) => x.id === id); return { id, etterHogst: !!flater.find((x) => x.id === id)?.etterHogst, geometri: ruterTilFlate(ruter), andel: Object.fromEntries(TERSKLER.map((t) => [t, r(andel(rad, t), 3)])) }; }).filter((x) => x.geometri);
  const sr16Omriss = flater.filter((f) => perFlate.has(f.id)).map((f) => ({ id: f.id, geometri: f.geometri }));
  const stammeKart = stammer.filter((s) => s.pos).slice(0, 20000).map((s) => [r(s.pos[0], 6), r(s.pos[1], 6), 'GFL'.indexOf(s.treslag), s.dbh || 0]);
  const aarSr16 = [...new Set(flater.filter((f) => perFlate.has(f.id)).map((f) => f.aar).filter(Boolean))].sort();
  return {
    total: avslutt(total), flater: flaterUt, bestand: bestandUt, utenforPlan, utenSr16: total.ruterUtenSr16,
    fra: datoer[0] || '', til: datoer.at(-1) || '', hogstAar, sr16Aar: aarSr16,
    kart: { flater: kartFlater, sr16: sr16Omriss, stammer: stammeKart, stikkveier: sv.linjer },
    kran: sv.kran, harBasePos: sv.antall > 0,
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
  for (const l of analyse.kart.stikkveier || []) f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: l }, properties: { lag: 'spor' } });
  for (const o of analyse.kart.sr16) f.push({ type: 'Feature', geometry: o.geometri, properties: { lag: 'sr16' } });
  for (const o of analyse.kart.flater) {
    const a = o.andel[t]; const niva = a == null || o.etterHogst ? 'ukjent' : a > 1.2 ? 'hoy' : a >= 0.8 ? 'ok' : a >= 0.5 ? 'lav' : 'uttak';
    f.push({ type: 'Feature', geometry: o.geometri, properties: { lag: 'hogd', niva, farge: FARGER[niva], andel: a } });
  }
  const st = analyse.kart.stammer; const steg = Math.max(1, Math.ceil(st.length / maksStammer));
  for (let i = 0; i < st.length; i += steg) f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [st[i][0], st[i][1]] }, properties: { lag: 'stamme', treslag: 'GFL'[st[i][2]] || 'L' } });
  return { type: 'FeatureCollection', features: f };
}

// ---------- tynning ----------
// Kjørespor fra maskinens posisjon. Gir segmenter (for lengde), forenklede linjer (for kartet) og snitt kranavstand.
export function stikkveier(stammer, { maksSteg = 25, minSteg = 5 } = {}) {
  const segmenter = []; const linjer = []; let linje = []; let forrige = null; let kranSum = 0; let kranN = 0; let antall = 0;
  for (const s of stammer) {
    if (!s.basePos) continue; antall++;
    const p = geoTilUtm(s.basePos[0], s.basePos[1], 33);
    if (s.pos) { const q = geoTilUtm(s.pos[0], s.pos[1], 33); const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < 15) { kranSum += d; kranN++; } }
    if (forrige) {
      const d = Math.hypot(p[0] - forrige.p[0], p[1] - forrige.p[1]);
      if (d > maksSteg) { if (linje.length > 1) linjer.push(linje); linje = [s.basePos]; forrige = { p, g: s.basePos }; continue; }
      // Maskinen står mens den feller flere trær, og GPS-en flakker 1–2 m: bare flytting på minst 5 m telles.
      if (d < minSteg) continue;
      const seg = [forrige.g, s.basePos]; seg.lengde = d; segmenter.push(seg);
    }
    linje.push(s.basePos);
    forrige = { p, g: s.basePos };
  }
  if (linje.length > 1) linjer.push(linje);
    const enkle = linjer.map((l) => l.map(([a, b]) => [r(a, 6), r(b, 6)])).slice(0, 400);
  return { segmenter, linjer: enkle, lengde: segmenter.reduce((a, s) => a + s.lengde, 0), kran: kranN ? r(kranSum / kranN, 1) : null, antall };
}

export const STIKKVEI_BREDDE = 4; // m – Statskog: maks 4,5 m, NIBIO: 3–4 m
// Diameterklasser fra SR16-tersklene (5–8, 8–10, 10–16 og over 16 cm).
export const KLASSER = [[5, 8], [8, 10], [10, 16], [16, null]];
// Gjenstående grunnflate for gran ved 16–18 m overhøyde: ikke under 24–28 m²/ha etter bonitet (Skogkurs, tynningsheftet).
export const grunnflateGrense = (bonitet) => (bonitet >= 17 ? 28 : bonitet >= 14 ? 26 : 24);

// Tynningsvurdering for en sum (total, bestand eller SR16-flate). Bruker bare arealet der SR16 kan sammenlignes.
const nb = (v, d = 1) => (v == null ? '–' : Number(v).toLocaleString('nb-NO', { maximumFractionDigits: d }));
export function tynning(s, { treslag = null } = {}) {
  const ha = (s.ruterSml * RUTE * RUTE) / 10000; if (!ha) return null;
  const gFor = s.gVekt ? s.gSr16 / s.gVekt : null; // m²/ha
  const gUt = s.gUttak / ha; const gEtter = gFor != null ? Math.max(0, gFor - gUt) : null;
  const nFor = s.sr16[5] / ha; const nUt = s.stammerTerskel[5] / ha; const nEtter = Math.max(0, nFor - nUt); // per ha
  const dgFor = gFor && nFor ? Math.sqrt((gFor / nFor) * (4 / Math.PI)) * 100 : null; // cm
  const dgUt = s.nDbh ? Math.sqrt((s.gUttak / s.nDbh) * (4 / Math.PI)) * 100 : null;
  const kvotient = dgFor && dgUt ? dgUt / dgFor : null;
  const hoydeo = s.hoydeoVekt ? s.hoydeoSum / s.hoydeoVekt : null; const bonitet = s.bonVekt ? s.bonSum / s.bonVekt : null;
  const lauvFor = s.lauvVekt ? s.lauvSum / s.lauvVekt : null; const lauvUt = s.stammerTerskel[5] ? (s.lauvStammer / s.stammerTerskel[5]) * 100 : null;
  const klasser = KLASSER.map(([fra, til]) => {
    const sr = (s.sr16[fra] - (til ? s.sr16[til] : 0)); const ut = (s.stammerTerskel[fra] - (til ? s.stammerTerskel[til] : 0));
    return { fra, til, sr16PerDaa: r(sr / ha / 10, 1), uttakPerDaa: r(ut / ha / 10, 1), andel: sr > 0 ? r(ut / sr, 3) : null };
  });
  const hogdHa = (s.ruter * RUTE * RUTE) / 10000;
  const avstand = s.stikkveiM > 50 ? hogdHa * 10000 / s.stikkveiM : null; // m mellom stikkveiene (areal / lengde)
  const stikkveiAndel = s.stikkveiM > 50 && hogdHa ? (s.stikkveiM * STIKKVEI_BREDDE) / (hogdHa * 10000) : null;
  const uttakG = gFor ? gUt / gFor : null;
  const krit = [];
  if (uttakG != null) krit.push({ id: 'uttak', navn: 'Uttak av grunnflaten', verdi: `${Math.round(uttakG * 100)} %`, krav: 'maks 35 %', ok: uttakG <= 0.35, kilde: 'statskog', hjelp: uttakG > 0.35 ? 'Kraftig tynning – større fare for vindfall og snøbrekk de første årene.' : uttakG < 0.15 ? 'Svakt inngrep – lite effekt på tilveksten til de gjenstående trærne.' : 'Innenfor anbefalt styrke.' });
  const gran = treslag ? treslag === 'G' : (lauvFor ?? 0) < 50;
  if (gEtter != null && gran && hoydeo != null && hoydeo >= 15 && hoydeo <= 19.5) { const g = grunnflateGrense(bonitet || 14); krit.push({ id: 'grunnflate', navn: 'Gjenstående grunnflate (gran)', verdi: `${nb(gEtter)} m²/ha`, krav: `minst ${g} m²/ha ved ${Math.round(hoydeo)} m overhøyde`, ok: gEtter >= g, kilde: 'skogkurs', hjelp: gEtter < g ? 'For lite skog igjen – lavere produksjon resten av omløpet.' : 'Nok skog igjen til god produksjon.' }); }
  if (kvotient != null) krit.push({ id: 'form', navn: 'Tynningsform (tynningskvotient)', verdi: nb(kvotient, 2), krav: 'under 1,0 = tynning nedenfra', ok: kvotient <= 1.0 ? true : kvotient <= 1.1 ? null : false, kilde: 'snl', hjelp: kvotient < 0.9 ? 'Tynning nedenfra: de minste og dårligste trærne er tatt, de beste står igjen.' : kvotient <= 1.1 ? 'Jevn tynning: like store trær tatt som gjennomsnittet – vanlig når stikkveiene tas med.' : 'Høytynning: større trær enn snittet er tatt ut. De beste trærne skal stå (gjennomhogst/«skumming»).' });
  if (avstand != null) krit.push({ id: 'stikkvei', navn: 'Avstand mellom stikkveiene', verdi: `ca. ${Math.round(avstand)} m`, krav: 'minst 20 m (20–30 m)', ok: avstand >= 19, kilde: 'statskog', hjelp: avstand < 19 ? 'Tette stikkveier tar mye produktivt areal.' : 'Godt innenfor kravet.' });
  if (stikkveiAndel != null) krit.push({ id: 'stikkveiandel', navn: 'Areal i stikkveier', verdi: `ca. ${Math.round(stikkveiAndel * 100)} %`, krav: `maks ca. 22 % (${STIKKVEI_BREDDE} m bredde, 20 m avstand)`, ok: stikkveiAndel <= 0.23, kilde: 'statskog', hjelp: 'Beregnet fra kjøresporet med 4 m bredde.' });
  if (hoydeo != null) krit.push({ id: 'tidspunkt', navn: 'Overhøyde ved tynning (SR16)', verdi: `${nb(hoydeo)} m`, krav: 'første tynning 12–14 m, andre 16–18 m', ok: hoydeo >= 11 && hoydeo <= 18.5 ? true : hoydeo > 20 ? false : null, kilde: 'nibio', hjelp: hoydeo > 20 ? 'Høy skog: tynning øker faren for vindfall, særlig på vindutsatte steder (SNL).' : hoydeo > 18.5 ? 'Sent i omløpet – tynn svakt, og vurder vindfallsfaren.' : hoydeo < 11 ? 'Lav skog – vurder om ungskogpleie hadde vært bedre.' : 'Riktig tidspunkt.' });
  return {
    ha: r(ha, 2), gFor: r(gFor, 1), gUttak: r(gUt, 1), gEtter: r(gEtter, 1), uttakG: r(uttakG, 3),
    nForDaa: r(nFor / 10), nUttakDaa: r(nUt / 10), nEtterDaa: r(nEtter / 10), uttakN: nFor ? r(nUt / nFor, 3) : null,
    m3PerDaa: r(s.m3Sml / ha / 10, 1), dgFor: r(dgFor, 1), dgUttak: r(dgUt, 1), kvotient: r(kvotient, 2), hoydeo: r(hoydeo, 1), bonitet: r(bonitet),
    lauvFor: r(lauvFor), lauvUttak: r(lauvUt), klasser, stikkveiM: r(s.stikkveiM), avstand: r(avstand), stikkveiAndel: r(stikkveiAndel, 3), kriterier: krit,
  };
}
// Ser hogsten ut som tynning? Uttak under 60 % av stammene (≥ 10 cm), eller tynning planlagt i bestandene.
export function erTynning(res, S = null) {
  const a = andel(res.total, 10); if (a != null && a < 0.6) return true;
  const ider = new Set(res.bestand.map((b) => b.id));
  return !!S?.bestand?.some((b) => ider.has(b.id) && (b.tiltak || []).some((t) => t.type === 'tynning' && t.status !== 'utfort'));
}

// Simulert tynning i et bestand (for å prøve uten fil): stikkveier hver 22. m, stamme tatt der veien går, og mellom
// veiene tas de minste trærne til ca. 30 % av grunnflaten. Gir stammer i samme form som lesStammer.
export function simulerTynning(bestand, { seed = 7, trePerHa = 1400, dbhSnitt = 170, avstand = 22, uttak = 0.3, dato = new Date().toISOString().slice(0, 10) } = {}) {
  let sd = seed; const rnd = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 2 ** 32; };
  const norm = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const g = bestand.geometri; const ringer = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const pts = ringer.flatMap((p) => p[0]).map(([a, b]) => geoTilUtm(a, b, 33));
  const x0 = Math.min(...pts.map((p) => p[0])); const x1 = Math.max(...pts.map((p) => p[0])); const y0 = Math.min(...pts.map((p) => p[1])); const y1 = Math.max(...pts.map((p) => p[1]));
  const n = Math.min(60000, Math.round(((x1 - x0) * (y1 - y0) / 10000) * trePerHa));
  const traer = [];
  for (let i = 0; i < n; i++) {
    const e = x0 + rnd() * (x1 - x0); const nn = y0 + rnd() * (y1 - y0); const geo = utmTilGeo(e, nn, 33); if (!iGeometri(geo, g)) continue;
    const dbh = Math.max(50, Math.round(dbhSnitt + norm() * 55)); const ti = rnd(); traer.push({ e, n: nn, geo, dbh, treslag: ti < 0.8 ? 'G' : ti < 0.88 ? 'F' : 'L' });
  }
  const vei = (t) => Math.abs(((t.e - x0) % avstand) - avstand / 2) < STIKKVEI_BREDDE / 2;
  const iVei = traer.filter(vei); const mellom = traer.filter((t) => !vei(t)).sort((a, b) => a.dbh - b.dbh);
  const gTot = traer.reduce((a, t) => a + t.dbh ** 2, 0); let gUt = iVei.reduce((a, t) => a + t.dbh ** 2, 0);
  const ut = [...iVei];
  for (const t of mellom) { if (gUt >= uttak * gTot) break; if (t.treslag === 'L' && rnd() < 0.3) continue; if (rnd() < 0.25) continue; ut.push(t); gUt += t.dbh ** 2; }
  // Maskinen kjører langs veiene (midt i veien) og feller trær innen 10 m.
  ut.sort((a, b) => Math.floor((a.e - x0) / avstand) - Math.floor((b.e - x0) / avstand) || a.n - b.n);
  return ut.map((t, i) => {
    const vx = x0 + Math.floor((t.e - x0) / avstand) * avstand + avstand / 2; const by = t.n - 2 + rnd() * 4;
    const v = 0.00004 * (t.dbh / 10) ** 2.5;
    return { k: `sim:${i + 1}`, pos: t.geo, basePos: utmTilGeo(vx, by, 33), dbh: t.dbh, fub: r(v, 4), fpb: r(v * 1.12, 4), treslag: t.treslag, dato, stokker: [] };
  });
}
