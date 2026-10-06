// Driftsforhold og kjøreskaderisiko for hogstflater: hvor og når hogstmaskin og lassbærer kan kjøre med minst mulig
// sporskader. Kombinerer
//   * NIBIO markfuktighetskart (DTW – dybde til grunnvann, fra DTM1), laget for å forebygge sporskader
//   * NGU løsmassekart (bæreevne etter jordart)
//   * Kartverket høydedata (helning)
//   * NVE seNorge (teledyp, snødybde, vannmetning i jord og nedbør per km², 9 dagers prognose) – via appens server
//   * MET Locationforecast (nedbør) som reserve når NVE ikke er tilgjengelig.
// Ingen DOM: PNG-dekoding sendes inn (canvas i nettleseren).
import { geoTilUtm, utmTilGeo, punktIGeometri, etikettPunkt } from './proj.js';

export const KILDER = {
  dtw: { navn: 'NIBIO markfuktighetskart (DTW)', url: 'https://www.nibio.no/tema/jord/arealressurser/andre-kart/markfuktighet' },
  skogkurs: { navn: 'Skogkurs: Markfuktighetskart for skogen i Norge', url: 'https://skogkurs.no/fagartikler/markfuktighetskart-for-skogen-i-norge/' },
  sporlos: { navn: 'Skogtiltaksfondet: Sporløs kjøring (prosjektrapport)', url: 'https://www.skogtiltaksfondet.no/wp-content/uploads/2023/06/2013-42_Sporlos-kjoring.pdf' },
  ngu: { navn: 'NGU løsmassekart', url: 'https://www.ngu.no/geologisk-kartlegging/losmasser' },
  hoyde: { navn: 'Kartverket høydedata (DTM1)', url: 'https://hoydedata.no' },
  nve: { navn: 'NVE seNorge: teledyp, snø, vannmetning og nedbør', url: 'https://api.nve.no/doc/gridtimeseries-data-gts/' },
  met: { navn: 'MET Locationforecast', url: 'https://api.met.no/weatherapi/locationforecast/2.0/documentation' },
};

// ---------- markfuktighet (DTW) ----------
// Farger i NIBIOs WMS-lag «markfuktighetsklasser». > 1 m er gjennomsiktig. vekt = bidrag til fuktindeksen.
export const DTW_KLASSER = [
  { id: 'vann', navn: 'Vann', rgb: [0, 0, 128], vekt: 1.6 },
  { id: 'd0', navn: '0–0,25 m', rgb: [0, 0, 255], vekt: 1.6 },
  { id: 'd25', navn: '0,25–0,5 m', rgb: [30, 144, 255], vekt: 1 },
  { id: 'd50', navn: '0,5–0,75 m', rgb: [0, 191, 255], vekt: 0.4 },
  { id: 'd75', navn: '0,75–1 m', rgb: [135, 206, 250], vekt: 0.15 },
];
export function dtwKlasse(r, g, b, a) {
  if (a < 128) return 'torr';
  let best = null; let bd = Infinity;
  for (const k of DTW_KLASSER) { const d = Math.abs(r - k.rgb[0]) + Math.abs(g - k.rgb[1]) + Math.abs(b - k.rgb[2]); if (d < bd) { bd = d; best = k.id; } }
  return bd <= 60 ? best : null;
}
// Andeler per klasse → fuktindeks 0–1. Kjøresporene krysser de våte partiene, så våte andeler vektes opp:
// ca. 60 % av flaten med grunnvann under 25 cm gir full indeks.
export function fuktIndeks(andeler) {
  if (!andeler) return null;
  return Math.min(1, DTW_KLASSER.reduce((s, k) => s + (andeler[k.id] || 0) * k.vekt, 0));
}
export const vatAndel = (andeler) => (andeler ? (andeler.vann || 0) + (andeler.d0 || 0) + (andeler.d25 || 0) : null);

// Teller DTW-klasser innenfor en flate. raster = { w, h, data (RGBA), bbox: [x0,y0,x1,y1] i UTM33 }.
export function dtwForFlate(geometriUtm, raster) {
  const [x0, y0, x1, y1] = raster.bbox; const px = (x1 - x0) / raster.w; const py = (y1 - y0) / raster.h;
  const ringer = geometriUtm.type === 'Polygon' ? geometriUtm.coordinates : geometriUtm.coordinates.flat();
  let bx0 = Infinity; let by0 = Infinity; let bx1 = -Infinity; let by1 = -Infinity;
  for (const r of ringer) for (const [x, y] of r) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  const i0 = Math.max(0, Math.floor((bx0 - x0) / px)); const i1 = Math.min(raster.w - 1, Math.ceil((bx1 - x0) / px));
  const j0 = Math.max(0, Math.floor((y1 - by1) / py)); const j1 = Math.min(raster.h - 1, Math.ceil((y1 - by0) / py));
  const tell = {}; let n = 0;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = x0 + (i + 0.5) * px; const y = y1 - (j + 0.5) * py;
    if (!punktIGeometri([x, y], geometriUtm)) continue;
    const o = (j * raster.w + i) * 4; const k = dtwKlasse(raster.data[o], raster.data[o + 1], raster.data[o + 2], raster.data[o + 3]);
    if (!k) continue;
    tell[k] = (tell[k] || 0) + 1; n++;
  }
  if (!n) return null;
  return Object.fromEntries(Object.entries(tell).map(([k, v]) => [k, v / n]));
}

// ---------- bæreevne (løsmasser) ----------
export const BAEREEVNE = {
  god: { navn: 'God', risiko: 0, tekst: 'Fast, grovkornet mark (morene, breelvavsetning, tynt dekke over fjell)' },
  middels: { navn: 'Middels', risiko: 0.35, tekst: 'Sorterte avsetninger med noe finstoff (elve-, strand- og vindavsetninger)' },
  darlig: { navn: 'Dårlig', risiko: 0.7, tekst: 'Finkornet mark (leire, silt) – mister bæreevne når den er våt' },
  svaktDarlig: { navn: 'Svært dårlig', risiko: 1, tekst: 'Torv og myr – kjøres bare på tele eller snø' },
};
export function baereevne(losmasse) {
  const t = String(losmasse || '').toLowerCase();
  if (!t) return null;
  if (/torv|myr|organisk/.test(t)) return 'svaktDarlig';
  if (/hav- og fjord|marin|innsjø|breinnsjø|leire|silt/.test(t)) return 'darlig';
  if (/elve|bekk|fluvial|strand|vind|eol/.test(t)) return 'middels';
  return 'god'; // morene, breelv, forvitring, skred, bart fjell, tynt humusdekke, fyll
}

// ---------- helning ----------
// Minste kvadraters plan z = a·x + b·y + c gjennom høydepunktene → helning i prosent.
export function helningProsent(punkter) {
  const p = punkter.filter((q) => Number.isFinite(q.z));
  if (p.length < 3) return null;
  const mx = p.reduce((s, q) => s + q.x, 0) / p.length; const my = p.reduce((s, q) => s + q.y, 0) / p.length; const mz = p.reduce((s, q) => s + q.z, 0) / p.length;
  let sxx = 0; let syy = 0; let sxy = 0; let sxz = 0; let syz = 0;
  for (const q of p) { const x = q.x - mx; const y = q.y - my; const z = q.z - mz; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; }
  const det = sxx * syy - sxy * sxy; if (!det) return null;
  const a = (sxz * syy - syz * sxy) / det; const b = (syz * sxx - sxz * sxy) / det;
  return Math.hypot(a, b) * 100;
}
// Terrengklasser for helning (Skogkurs/terrengklassifisering for skogsdrift).
export const HELNING = [
  { maks: 10, klasse: 1, navn: 'Flatt (0–10 %)', risiko: 0 },
  { maks: 20, klasse: 2, navn: 'Svakt hellende (10–20 %)', risiko: 0.1 },
  { maks: 33, klasse: 3, navn: 'Middels bratt (20–33 %)', risiko: 0.35 },
  { maks: 50, klasse: 4, navn: 'Bratt (33–50 %)', risiko: 0.7 },
  { maks: Infinity, klasse: 5, navn: 'Svært bratt (> 50 %) – kabel eller beltegående', risiko: 1 },
];
export const helningKlasse = (p) => (p == null ? null : HELNING.find((h) => p < h.maks));
// Høydepunkter (UTM33) i et 3×3-rutenett rundt flatens indre punkt (geometri i lon/lat).
export function indrePunktUtm(geometri) { const c = etikettPunkt(geometri); return c ? geoTilUtm(c[0], c[1], 33) : null; }
export function hoydepunkter(geometri, arealDaa) {
  const c = indrePunktUtm(geometri); if (!c) return [];
  const d = Math.max(15, Math.min(60, Math.sqrt(arealDaa * 1000) / 3));
  const ut = [];
  for (const dy of [-d, 0, d]) for (const dx of [-d, 0, d]) ut.push([Math.round(c[0] + dx), Math.round(c[1] + dy)]);
  return ut;
}

// ---------- statisk risiko og driftssesong ----------
export const SESONG = {
  helaar: { navn: 'Helårsdrift', tekst: 'Kan drives på barmark det meste av året', farge: '#2f9e44' },
  torr: { navn: 'Tørr barmark eller vinter', tekst: 'Barmark i tørre perioder, ellers på frossen mark', farge: '#94c11f' },
  vinter: { navn: 'Vinterdrift', tekst: 'Bør drives på tele eller snø', farge: '#f08c00' },
  tele: { navn: 'Kun tele/snø', tekst: 'Bare på tele (≥ 20 cm) eller tykt, pakket snødekke', farge: '#c92a2a' },
};
// Vekter: markfuktighet 55 %, bæreevne 30 %, helning 15 % (fuktighet og bæreevne avgjør sporskader; bratt og vått gir glidning og erosjon).
export function statiskRisiko({ dtw = null, losmasse = null, helning = null } = {}) {
  const grunner = [];
  const W = fuktIndeks(dtw); const vat = vatAndel(dtw);
  const bk = baereevne(losmasse); const B = bk ? BAEREEVNE[bk].risiko : 0.4;
  const hk = helningKlasse(helning); const H = hk ? hk.risiko : 0.2;
  const w = W == null ? 0.3 : W;
  let poeng = 100 * (0.55 * w + 0.3 * B + 0.15 * H);
  // Våt og finkornet/organisk mark forsterker hverandre.
  if (W != null && W > 0.25 && B >= 0.7) poeng += 10;
  poeng = Math.max(0, Math.min(100, Math.round(poeng)));
  if (vat != null) grunner.push(`${Math.round(vat * 100)} % av flaten har grunnvann under 0,5 m`);
  else grunner.push('markfuktighet ukjent');
  if (bk) grunner.push(`bæreevne ${BAEREEVNE[bk].navn.toLowerCase()}${losmasse ? ` (${String(losmasse).replace(/\s*\(.*\)$/, '').toLowerCase()})` : ''}`);
  if (hk) grunner.push(`${Math.round(helning)} % helning`);
  const sesong = poeng < 20 ? 'helaar' : poeng < 40 ? 'torr' : poeng < 60 ? 'vinter' : 'tele';
  return { poeng, sesong, fukt: W, vat, baereevne: bk, helningKlasse: hk?.klasse ?? null, bratt: (hk?.klasse || 0) >= 5, grunner };
}

// ---------- mark og vær ----------
// Faktor (≈ 0,25–1,8) som justerer den statiske risikoen etter markforholdene en gitt dag.
export function markfaktor({ teledyp = null, snodybde = null, vannmetning = null, nedbor3 = null } = {}) {
  let f = 1; const t = [];
  const frd = teledyp ?? 0; const sd = snodybde ?? 0;
  if (frd >= 20) { f = 0.3; t.push(`tele ${Math.round(frd)} cm`); } else if (frd >= 10) { f = 0.55; t.push(`tele ${Math.round(frd)} cm`); } else if (frd >= 5) { f = 0.8; t.push(`lite tele (${Math.round(frd)} cm)`); }
  if (sd >= 40 && frd >= 5) { f = Math.min(f, 0.5); t.push(`${Math.round(sd)} cm snø`); } else if (sd >= 40) { f *= 0.9; t.push(`${Math.round(sd)} cm snø på ufrossen mark`); } else if (sd >= 10) t.push(`${Math.round(sd)} cm snø`);
  if (frd < 5 && vannmetning != null) {
    if (vannmetning >= 90) { f *= 1.5; t.push(`vannmettet mark (${Math.round(vannmetning)} %)`); } else if (vannmetning >= 75) { f *= 1.3; t.push(`våt mark (${Math.round(vannmetning)} %)`); } else if (vannmetning >= 55) { f *= 1.1; t.push(`fuktig mark (${Math.round(vannmetning)} %)`); } else if (vannmetning < 35) { f *= 0.8; t.push(`tørr mark (${Math.round(vannmetning)} %)`); } else t.push(`normal fuktighet (${Math.round(vannmetning)} %)`);
  }
  if (frd < 5 && nedbor3 != null) { if (nedbor3 > 40) { f *= 1.25; t.push(`${Math.round(nedbor3)} mm regn siste 3 døgn`); } else if (nedbor3 > 20) { f *= 1.1; t.push(`${Math.round(nedbor3)} mm regn siste 3 døgn`); } }
  return { faktor: Math.max(0.25, Math.min(1.8, f)), tekst: t };
}
export const NAA = [
  { maks: 30, id: 'god', navn: 'Gode forhold', farge: '#2f9e44', rad: 'Kan drives nå.' },
  { maks: 50, id: 'ok', navn: 'Akseptable forhold', farge: '#94c11f', rad: 'Kjør med risdekke i basvegene, unngå de våteste delene og reduser lasset.' },
  { maks: 70, id: 'utsett', navn: 'Utsett om mulig', farge: '#f08c00', rad: 'Stor fare for sporskader på våte partier – utsett eller velg en annen flate.' },
  { maks: Infinity, id: 'stopp', navn: 'Ikke kjør nå', farge: '#c92a2a', rad: 'Vent på tele, snø eller en lengre tørr periode.' },
];
export const naaNivaa = (r) => NAA.find((n) => r < n.maks);
export function risikoNaa(statisk, dag) {
  if (!statisk) return null;
  const m = markfaktor(dag || {});
  const r = Math.min(100, Math.round(statisk.poeng * m.faktor));
  return { risiko: r, nivaa: naaNivaa(r), faktor: m.faktor, forhold: m.tekst };
}

// Dagsrekke fra NVE: [{ dato, teledyp, snodybde, vannmetning, nedbor }] – legger til nedbor3 (siste 3 døgn, inkl. dagen).
export function medNedbor3(dager) {
  return dager.map((d, i) => ({ ...d, nedbor3: dager.slice(Math.max(0, i - 2), i + 1).reduce((s, x) => s + (x.nedbor || 0), 0) }));
}
// Første dag i prognosen med gode forhold (risiko under grensen) for en flate.
export function besteDag(statisk, dager, idag, grense = 30) {
  for (const d of dager) { if (d.dato < idag) continue; const r = risikoNaa(statisk, d); if (r && r.risiko < grense) return { dato: d.dato, risiko: r.risiko }; }
  return null;
}

// Prioritering: driftbarhet nå teller mest; verdi og volum avgjør blant like gode flater.
export function prioriter(flater, { verdi = (f) => f.rotnetto || 0 } = {}) {
  const maks = Math.max(1, ...flater.map(verdi));
  return flater.map((f) => {
    const naa = f.drift?.naa;
    const drivbar = naa ? 100 - naa.risiko : f.drift?.statisk ? 100 - f.drift.statisk.poeng : 30;
    return { f, prioritet: Math.round(0.7 * drivbar + 30 * (verdi(f) / maks)) };
  }).sort((a, b) => b.prioritet - a.prioritet).map(({ f, prioritet }) => Object.assign(f, { prioritet }));
}

// ---------- henting ----------
async function hentTekst(hent, url, ms = 30000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try { const r = await hent(url, { signal: ctrl.signal }); if (!r.ok) { const e = new Error(`${url.startsWith('http') ? new URL(url).host : 'server'} svarte ${r.status}`); e.status = r.status; throw e; } return await r.text(); } finally { clearTimeout(t); }
}
async function parallelt(liste, antall, fn) {
  const ko = [...liste.entries()]; const ut = new Array(liste.length);
  await Promise.all(Array.from({ length: Math.min(antall, ko.length) }, async () => { while (ko.length) { const [i, x] = ko.shift(); try { ut[i] = await fn(x, i); } catch (e) { ut[i] = { feil: e.message }; } } }));
  return ut;
}
const tilUtm = (g) => ({ type: g.type, coordinates: g.type === 'Polygon' ? g.coordinates.map((r) => r.map(([x, y]) => geoTilUtm(x, y, 33))) : g.coordinates.map((p) => p.map((r) => r.map(([x, y]) => geoTilUtm(x, y, 33)))) });
const RUTE = 2000; const PIKSEL = 4;
const DTW_URL = (b) => `https://wms.nibio.no/cgi-bin/markfuktighetskart?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=markfuktighetsklasser&STYLES=&SRS=EPSG:25833&BBOX=${b.join(',')}&WIDTH=${RUTE / PIKSEL}&HEIGHT=${RUTE / PIKSEL}&FORMAT=image/png&TRANSPARENT=true`;

// Analyserer driftsforhold for flatene (SR16-flater med geometri i lon/lat). dekodPng(url) → { w, h, data }.
export async function analyserFlater(flater, { hent = fetch, dekodPng, framdrift = () => {}, parallelle = 6 } = {}) {
  const ut = new Map(); const utm = new Map();
  for (const f of flater) { const g = tilUtm(f.geometri); utm.set(f.id, g); ut.set(f.id, {}); }
  // 1. Markfuktighet: én PNG per 2 × 2 km rute med flater.
  const ruter = new Map();
  for (const f of flater) {
    const g = utm.get(f.id); const r = g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
    const keys = new Set(); for (const ring of r) for (const [x, y] of ring) keys.add(`${Math.floor(x / RUTE)}:${Math.floor(y / RUTE)}`);
    for (const k of keys) { if (!ruter.has(k)) ruter.set(k, []); ruter.get(k).push(f.id); }
  }
  let n = 0; const tellinger = new Map();
  if (dekodPng) {
    await parallelt([...ruter], parallelle, async ([k, ider]) => {
      const [i, j] = k.split(':').map(Number); const bbox = [i * RUTE, j * RUTE, (i + 1) * RUTE, (j + 1) * RUTE];
      const bilde = await dekodPng(DTW_URL(bbox));
      const raster = { ...bilde, bbox };
      for (const id of ider) {
        const a = dtwForFlate(utm.get(id), raster); if (!a) continue;
        const t = tellinger.get(id) || []; t.push(a); tellinger.set(id, t);
      }
      framdrift({ steg: 'dtw', tekst: `Markfuktighet: rute ${++n} av ${ruter.size}`, andel: n / ruter.size });
    });
  }
  for (const [id, liste] of tellinger) {
    const sum = {}; for (const a of liste) for (const [k, v] of Object.entries(a)) sum[k] = (sum[k] || 0) + v / liste.length;
    ut.get(id).dtw = sum;
  }
  // 2. Løsmasser (NGU) i flatens indre punkt.
  n = 0;
  await parallelt(flater, parallelle, async (f) => {
    const c = indrePunktUtm(f.geometri); if (!c) return;
    const d = 30; const b = [c[0] - d, c[1] - d, c[0] + d, c[1] + d].map((v) => v.toFixed(1)).join(',');
    const gml = await hentTekst(hent, `https://geo.ngu.no/mapserver/LosmasserWMS2?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=Losmasse_flate&QUERY_LAYERS=Losmasse_flate&STYLES=&SRS=EPSG:25833&BBOX=${b}&WIDTH=61&HEIGHT=61&X=30&Y=30&INFO_FORMAT=application/vnd.ogc.gml&FEATURE_COUNT=1`);
    const m = gml.match(/<losmassetype_tekst>([^<]*)<\/losmassetype_tekst>/);
    ut.get(f.id).losmasse = m ? m[1].trim() : null;
    if (++n % 10 === 0) framdrift({ steg: 'ngu', tekst: `Løsmasser: ${n} av ${flater.length}`, andel: n / flater.length });
  });
  // 3. Helning (Kartverket høydedata): 3×3 punkter per flate, fem flater per kall.
  const grupper = []; for (let i = 0; i < flater.length; i += 5) grupper.push(flater.slice(i, i + 5));
  n = 0;
  await parallelt(grupper, Math.min(4, parallelle), async (gr) => {
    const pk = gr.map((f) => hoydepunkter(f.geometri, f.areal));
    const alle = pk.flat();
    if (!alle.length) return;
    const j = JSON.parse(await hentTekst(hent, `https://ws.geonorge.no/hoydedata/v1/punkt?koordsys=25833&geojson=false&punkter=${encodeURIComponent(JSON.stringify(alle))}`));
    let o = 0;
    gr.forEach((f, i) => { const p = (j.punkter || []).slice(o, o + pk[i].length).map((q) => ({ x: q.x, y: q.y, z: q.z })); o += pk[i].length; ut.get(f.id).helning = helningProsent(p); });
    framdrift({ steg: 'hoyde', tekst: `Helning: ${Math.min(flater.length, ++n * 5)} av ${flater.length}`, andel: n / grupper.length });
  });
  for (const f of flater) { const d = ut.get(f.id); d.statisk = statiskRisiko(d); }
  return ut;
}

// Mark- og værforhold fra NVE (via appens server: <base>/GridTimeSeries/...), per 5 × 5 km celle.
const NVE_TEMA = { teledyp: 'gwb_frd', snodybde: 'sd', vannmetning: 'gwb_sssrel', nedbor: 'rr' };
export const CELLE = 5000;
export const celleFor = (lon, lat) => { const [x, y] = geoTilUtm(lon, lat, 33); return `${Math.floor(x / CELLE)}:${Math.floor(y / CELLE)}`; };
const isoDag = (d) => d.toISOString().slice(0, 10);
export function parseNve(j) {
  const [dd, mm, aa] = String(j.StartDate).slice(0, 10).split('.');
  const start = new Date(Date.UTC(+aa, +mm - 1, +dd));
  return (j.Data || []).map((v, i) => ({ dato: isoDag(new Date(start.getTime() + i * 86400000)), v: v === j.NoDataValue ? null : v }));
}
export async function hentMarkVaer(celler, { hent = fetch, base = 'api/nve', idag = new Date(), framdrift = () => {} } = {}) {
  const d1 = isoDag(new Date(idag.getTime() - 3 * 86400000)); const d2 = isoDag(new Date(idag.getTime() + 8 * 86400000));
  const ut = {}; let n = 0; let feil = null;
  await parallelt(celler, 4, async (k) => {
    const [i, j] = k.split(':').map(Number); const x = i * CELLE + CELLE / 2; const y = j * CELLE + CELLE / 2;
    const per = new Map();
    for (const [felt, tema] of Object.entries(NVE_TEMA)) {
      try {
        const rad = parseNve(JSON.parse(await hentTekst(hent, `${base}/GridTimeSeries/${x}/${y}/${d1}/${d2}/${tema}.json`, 20000)));
        for (const { dato, v } of rad) { const d = per.get(dato) || { dato }; d[felt] = v; per.set(dato, d); }
      } catch (e) { feil = feil || e; }
    }
    if (per.size) ut[k] = medNedbor3([...per.values()].sort((a, b) => a.dato.localeCompare(b.dato)));
    framdrift({ steg: 'nve', tekst: `Mark og vær (NVE): ${++n} av ${celler.length} områder`, andel: n / celler.length });
  });
  if (!Object.keys(ut).length && feil) throw feil;
  return { celler: ut, kilde: 'nve', hentet: new Date().toISOString() };
}
// Reserve: bare nedbør fra MET (når appen ikke kjører med egen server, f.eks. GitHub Pages).
export async function hentMetNedbor(celler, { hent = fetch } = {}) {
  const ut = {};
  await parallelt(celler.slice(0, 40), 4, async (k) => {
    const [i, j] = k.split(':').map(Number);
    const [lon, lat] = utmTilGeo(i * CELLE + CELLE / 2, j * CELLE + CELLE / 2, 33);
    const d = JSON.parse(await hentTekst(hent, `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`));
    const per = new Map();
    for (const t of d.properties?.timeseries || []) {
      const dag = new Date(t.time).toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' });
      const mm = t.data.next_1_hours?.details?.precipitation_amount ?? (t.data.next_6_hours ? t.data.next_6_hours.details.precipitation_amount / 6 : 0);
      const r = per.get(dag) || { dato: dag, nedbor: 0 }; r.nedbor += mm; per.set(dag, r);
    }
    ut[k] = medNedbor3([...per.values()].map((r) => ({ ...r, nedbor: Math.round(r.nedbor * 10) / 10 })));
  });
  return { celler: ut, kilde: 'met', hentet: new Date().toISOString() };
}

// Oppsummering av forholdene i kommunen en gitt dag (median over cellene).
export function forholdOppsummert(markVaer, dato) {
  const rader = Object.values(markVaer?.celler || {}).map((l) => l.find((d) => d.dato === dato)).filter(Boolean);
  if (!rader.length) return null;
  const med = (f) => { const v = rader.map((r) => r[f]).filter((x) => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
  const o = { dato, teledyp: med('teledyp'), snodybde: med('snodybde'), vannmetning: med('vannmetning'), nedbor: med('nedbor'), nedbor3: med('nedbor3') };
  o.faktor = markfaktor(o);
  return o;
}
