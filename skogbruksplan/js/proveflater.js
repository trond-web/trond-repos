// 🎯 Virtuelle prøveflater fra hogstmaskindata (Data › Hogstmaskindata). Sirkelflater på 400 m² legges i et
// systematisk nett over arealet maskinen hogde, og stammene innenfor hver flate gir stammetall, grunnflate,
// middeldiameter, anslått høyde, volum og treslagsfordeling – som en vanlig prøveflate, men målt av maskinen.
// Ingen DOM – kan testes i Node.
//
// Grunnlag (se README):
//   * 400 m²: NMBU (Dieset 2017) fant at virtuelle flater på 400 m² fra hogstmaskindata ga minst feil mot laserdata.
//   * Flatene legges bare der hele sirkelen ligger i hogd areal (10 × 10 m-ruter med stammer), og et stykke inn fra
//     kanten, fordi posisjonen ved kranspissen typisk har 1–2 m feil.
//   * Hogstmaskinen ser bare trærne som er hogd. Ved flatehogst er flaten nær hele bestandet (unntatt gjensettings- og
//     livsløpstrær og små trær). Ved tynning viser flaten bare uttaket.
//   * Utvalget er skjevt (bare hogstmoden skog eller tynningsskog). Tallene er en etterkontroll av planen og en lokal
//     kalibrering, ikke en takst av hele eiendommen (Räty mfl. 2022).
//   * Fører-ID og andre opplysninger om maskinføreren leses ikke.
import { geoTilUtm, utmTilGeo } from './proj.js';
import { iGeometri } from './maskindata.js';

export const FLATE_M2 = 400;
export const RADIUS = Math.sqrt(FLATE_M2 / Math.PI); // 11,28 m
export const STANDARD_AVSTAND = 40; // m mellom flatesentrene (én flate per 1,6 daa)
export const RUTE = 10; // m – samme ruter som sammenligningen mot SR16
export const MIN_STAMMER = 3; // færre stammer på en hel flate: trolig feil i posisjon eller kant – utelates
export const KILDER = {
  dieset: { navn: 'Dieset (2017), NMBU: produksjonsfiler fra hogstmaskin som referanse for laserskanning – 400 m² ga lavest feil', url: 'https://static02.nmbu.no/mina/studier/moppgaver/2017-Dieset.pdf' },
  raty: { navn: 'Räty mfl. (2022): hogstmaskindata som referanse i laserbasert skogtakst – utvalget er skjevt', url: 'https://arxiv.org/pdf/2203.04679v1' },
  raheim: { navn: 'Raheim (2021), NMBU: hogstmaskindata til å predikere totalvolum og sagtømmervolum', url: 'https://static02.nmbu.no/mina/studier/moppgaver/2021-Raheim.pdf' },
};
const r = (v, d = 1) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const nokkel = (e, n) => `${Math.floor(e / RUTE)},${Math.floor(n / RUTE)}`;

// Anslått høyde for en stamme fra stokkene: summen av stokklengdene pluss resten opp til toppen, regnet med en
// avsmalning på ca. 1 cm per meter fra toppdiameteren på siste stokk. Uten stokker: null.
export function hoydeFraStokker(s) {
  const st = (s.stokker || []).filter((l) => l.lengde > 0); if (!st.length) return null;
  const lengde = st.reduce((a, l) => a + l.lengde, 0) / 100; // cm → m
  const topp = st.at(-1).topp; const rest = topp ? Math.min(12, Math.max(1, topp / 10)) : 3; // mm → cm → m
  return lengde + rest + 0.15; // stubbe
}

// Hogd areal som sett av 10 m-ruter med stammer, med små hull fylt (samme regel som sammenligningen).
function hogdeRuter(punkter) {
  const ruter = new Set(punkter.map((p) => nokkel(p.e, p.n)));
  const fylt = new Set();
  for (const k of ruter) {
    const [i, j] = k.split(',').map(Number);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const nk = `${i + di},${j + dj}`; if (ruter.has(nk) || fylt.has(nk)) continue;
      let n = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if ((a || b) && ruter.has(`${i + di + a},${j + dj + b}`)) n++;
      if (n >= 5) fylt.add(nk);
    }
  }
  for (const k of fylt) ruter.add(k);
  return ruter;
}
// Hele sirkelen (pluss buffer) i hogde ruter? Sjekkes i sentrum og 16 punkter på ring og halv ring.
function inneI(ruter, e, n, rad) {
  if (!ruter.has(nokkel(e, n))) return false;
  for (let i = 0; i < 16; i++) { const v = (i / 16) * 2 * Math.PI; for (const f of [0.5, 1]) if (!ruter.has(nokkel(e + Math.cos(v) * rad * f, n + Math.sin(v) * rad * f))) return false; }
  return true;
}

// Verdier for én flate fra stammene i den. Per hektar og per dekar, som i takst.
export function flateVerdier(stammer, areal = FLATE_M2) {
  const fHa = 10000 / areal; const n = stammer.length;
  const medD = stammer.filter((s) => s.dbh > 0); const d = (s) => s.dbh / 10; // mm → cm
  const g = medD.reduce((a, s) => a + (Math.PI / 4) * (d(s) / 100) ** 2, 0); // m²
  const sum2 = medD.reduce((a, s) => a + d(s) ** 2, 0); const sum3 = medD.reduce((a, s) => a + d(s) ** 3, 0);
  const v = stammer.reduce((a, s) => a + (s.fub || 0), 0);
  const gT = { G: 0, F: 0, L: 0 }; for (const s of medD) gT[s.treslag in gT ? s.treslag : 'L'] += (Math.PI / 4) * (d(s) / 100) ** 2;
  // Lorey-høyde: grunnflatevektet middelhøyde fra anslått høyde per stamme.
  let gh = 0; let gMedH = 0; for (const s of medD) { const h = hoydeFraStokker(s); if (h) { const gi = (Math.PI / 4) * (d(s) / 100) ** 2; gh += gi * h; gMedH += gi; } }
  const datoer = stammer.map((s) => s.dato).filter(Boolean).sort();
  return {
    stammer: n, nHa: Math.round(n * fHa), nDaa: r(n * fHa / 10, 0),
    gHa: r(g * fHa, 1), dg: sum2 ? r(sum3 / sum2, 1) : null, // grunnflatevektet middeldiameter (cm)
    hl: gMedH ? r(gh / gMedH, 1) : null, // Lorey-høyde (m), anslått fra stokkene
    vHa: r(v * fHa, 1), vDaa: r(v * fHa / 10, 1), middelstamme: n ? r(v / n, 3) : null,
    andel: g ? Object.fromEntries(Object.entries(gT).map(([k, x]) => [k, Math.round((x / g) * 100)])) : { G: 0, F: 0, L: 0 },
    dato: datoer[0] || '',
  };
}

// Lager flatene. stammer: fra lesStammer (pos [lon, lat], dbh mm, fub m³, treslag, stokker, dato).
// S: planen (bestandet flaten ligger i). avstand: m mellom sentrene. buffer: m ekstra innenfor hogd areal.
export function lagProveflater(stammer, { S = null, avstand = STANDARD_AVSTAND, buffer = 3, minStammer = MIN_STAMMER, tynning = false } = {}) {
  const pkt = stammer.filter((s) => s.pos).map((s) => { const [e, n] = geoTilUtm(s.pos[0], s.pos[1], 33); return { s, e, n }; });
  if (!pkt.length) return { flater: [], avstand, radius: r(RADIUS, 2), areal: FLATE_M2, tynning, hogdDaa: 0, utelatt: 0 };
  const ruter = hogdeRuter(pkt);
  // Rutenett for raskt oppslag av stammer nær en flate.
  const nett = new Map(); for (const p of pkt) { const k = nokkel(p.e, p.n); if (!nett.has(k)) nett.set(k, []); nett.get(k).push(p); }
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const p of pkt) { x0 = Math.min(x0, p.e); x1 = Math.max(x1, p.e); y0 = Math.min(y0, p.n); y1 = Math.max(y1, p.n); }
  // Nettet låses til hele multipler av avstanden (samme flater ved ny innlesing av samme fil).
  const sx = Math.ceil(x0 / avstand) * avstand + avstand / 2; const sy = Math.ceil(y0 / avstand) * avstand + avstand / 2;
  const bestand = (S?.bestand || []).filter((b) => b.geometri);
  const flater = []; let utelatt = 0;
  for (let e = sx; e <= x1; e += avstand) for (let n = sy; n <= y1; n += avstand) {
    if (!inneI(ruter, e, n, RADIUS + buffer)) continue;
    const inn = [];
    for (let i = Math.floor((e - RADIUS) / RUTE); i <= Math.floor((e + RADIUS) / RUTE); i++) for (let j = Math.floor((n - RADIUS) / RUTE); j <= Math.floor((n + RADIUS) / RUTE); j++) for (const p of nett.get(`${i},${j}`) || []) if ((p.e - e) ** 2 + (p.n - n) ** 2 <= RADIUS ** 2) inn.push(p.s);
    if (inn.length < minStammer) { utelatt++; continue; }
    const [lon, lat] = utmTilGeo(e, n, 33);
    const b = bestand.find((x) => iGeometri([lon, lat], x.geometri));
    flater.push({ id: `PF${String(flater.length + 1).padStart(3, '0')}`, e: Math.round(e), n: Math.round(n), lon: r(lon, 6), lat: r(lat, 6), bestandId: b?.id || null, bestandNr: b?.nr || null, ...flateVerdier(inn) });
  }
  return { flater, avstand, radius: r(RADIUS, 2), areal: FLATE_M2, tynning, hogdDaa: r((ruter.size * RUTE * RUTE) / 1000, 1), utelatt };
}

// Snitt med standardavvik og standardfeil for en verdi over flatene.
function stat(liste, f) {
  const v = liste.map(f).filter((x) => x != null && Number.isFinite(x)); if (!v.length) return null;
  const m = v.reduce((a, x) => a + x, 0) / v.length; const sd = v.length > 1 ? Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (v.length - 1)) : null;
  return { snitt: m, sd, sf: sd != null ? sd / Math.sqrt(v.length) : null, n: v.length };
}
// Sammendrag per bestand og totalt, med planens verdier for sammenligning (flatehogst: volum og treantall per daa).
// Planens tall er i dag skrevet fram; derfor sammenlignes med planens volum, og avviket regnes i prosent.
export function sammendrag(res, S = null) {
  const grupper = new Map(); for (const f of res.flater) { const k = f.bestandId || '–'; if (!grupper.has(k)) grupper.set(k, []); grupper.get(k).push(f); }
  const rad = (liste, b = null) => {
    const v = stat(liste, (f) => f.vDaa); const nn = stat(liste, (f) => f.nDaa); const g = stat(liste, (f) => f.gHa); const dg = stat(liste, (f) => f.dg); const hl = stat(liste, (f) => f.hl);
    const planV = b?.volumDaa ?? null; const planN = b?.treantall ?? null;
    return {
      bestandId: b?.id || null, nr: b?.nr || null, treslag: b?.treslag || null, bonitet: b?.bonitet ?? null, flater: liste.length,
      vDaa: r(v?.snitt, 1), vSf: r(v?.sf, 1), nDaa: r(nn?.snitt, 0), gHa: r(g?.snitt, 1), dg: r(dg?.snitt, 1), hl: r(hl?.snitt, 1),
      planVDaa: planV, planNDaa: planN, avvikV: planV && v ? r((v.snitt - planV) / planV, 3) : null, avvikN: planN && nn ? r((nn.snitt - planN) / planN, 3) : null,
      // Relativ standardfeil – under 10–15 % er godt nok til å si noe om avviket.
      rsf: v?.sf != null && v.snitt ? r(v.sf / v.snitt, 3) : null,
    };
  };
  const bestand = [...grupper].filter(([k]) => k !== '–').map(([k, l]) => rad(l, (S?.bestand || []).find((b) => b.id === k) || null)).sort((a, b) => String(a.nr).localeCompare(String(b.nr), 'nb', { numeric: true }));
  return { total: rad(res.flater), bestand, utenforPlan: (grupper.get('–') || []).length };
}

// Vurdering av avviket mot planen for et bestand (flatehogst). Gir { niva, tekst }.
export function vurderAvvik(x, { tynning = false } = {}) {
  if (tynning) return { niva: 'info', tekst: 'Tynning: flatene viser bare uttaket.' };
  if (x.avvikV == null) return { niva: 'ukjent', tekst: 'Planen har ikke volum for bestandet.' };
  if (x.flater < 3) return { niva: 'ukjent', tekst: `Bare ${x.flater} flate${x.flater === 1 ? '' : 'r'} – for få til å si noe sikkert.` };
  const a = x.avvikV; const p = Math.round(Math.abs(a) * 100);
  const sikker = x.rsf != null && Math.abs(a) > 2 * x.rsf; // avviket er større enn to standardfeil
  if (Math.abs(a) <= 0.15) return { niva: 'ok', tekst: `Planens volum stemmer godt (avvik ${a < 0 ? '−' : '+'}${p} %).` };
  return { niva: a > 0 ? 'hoy' : 'lav', tekst: `Prøveflatene viser ${p} % ${a > 0 ? 'mer' : 'mindre'} volum enn planen${sikker ? '' : ' – men spredningen mellom flatene er stor, så avviket er usikkert'}.` };
}

// Kalibreringsfaktor for volum: summen av prøveflatevolum delt på planvolum for bestandene med minst tre flater og
// planvolum (vektet med antall flater). null når grunnlaget er for lite. Bare ved flatehogst.
export function kalibrering(sm, { tynning = false, minFlater = 3 } = {}) {
  if (tynning) return null;
  const b = sm.bestand.filter((x) => x.flater >= minFlater && x.planVDaa > 0 && x.vDaa != null);
  const n = b.reduce((a, x) => a + x.flater, 0); if (n < 6) return null;
  const faktor = b.reduce((a, x) => a + (x.vDaa / x.planVDaa) * x.flater, 0) / n;
  const treslag = [...new Set(b.map((x) => x.treslag).filter(Boolean))];
  return { faktor: r(faktor, 3), bestand: b.length, flater: n, treslag };
}
// Bestand som kan kalibreres: ikke hogd (ingen flater), samme hovedtreslag som grunnlaget, hogstklasse IV–V (alder) og
// med planvolum. Faktoren brukes bare innenfor 0,7–1,3 – større avvik bør kontrolleres i felt.
export function kandidaterForKalibrering(S, sm, kal, { minAlder = 50 } = {}) {
  if (!kal) return [];
  const hogd = new Set(sm.bestand.map((x) => x.bestandId));
  return (S?.bestand || []).filter((b) => !hogd.has(b.id) && kal.treslag.includes(b.treslag) && (b.alder || 0) >= minAlder && b.volumDaa > 0 && !b.ekstra?.KALIBRERT);
}
export function brukKalibrering(S, sm, kal, { dato = new Date().toISOString().slice(0, 10), kilde = 'hogstmaskindata' } = {}) {
  if (!kal || kal.faktor < 0.7 || kal.faktor > 1.3) return 0;
  const liste = kandidaterForKalibrering(S, sm, kal);
  for (const b of liste) {
    const for_ = b.volumDaa; b.volumDaa = r(for_ * kal.faktor, 1);
    b.ekstra = { ...(b.ekstra || {}), KALIBRERT: { fra: for_, faktor: kal.faktor, dato, kilde } };
    b.merknad = [b.merknad, `Volum kalibrert med prøveflater fra ${kilde} (${kal.flater} flater, faktor ${String(kal.faktor).replace('.', ',')}) ${dato}: ${String(for_).replace('.', ',')} → ${String(b.volumDaa).replace('.', ',')} m³/daa`].filter(Boolean).join('; ');
  }
  return liste.length;
}
// Angrer kalibreringen fra en bestemt dato (eller alle).
export function angreKalibrering(S, { dato = null } = {}) {
  let n = 0;
  for (const b of S?.bestand || []) {
    const k = b.ekstra?.KALIBRERT; if (!k || (dato && k.dato !== dato)) continue;
    b.volumDaa = k.fra; const { KALIBRERT, ...rest } = b.ekstra; b.ekstra = rest;
    b.merknad = String(b.merknad || '').split('; ').filter((m) => !m.startsWith('Volum kalibrert med prøveflater')).join('; '); n++;
  }
  return n;
}

// ---------- eksport ----------
const TS = { G: 'Gran', F: 'Furu', L: 'Lauv' };
export function csv(res) {
  const hode = ['flate', 'bestand', 'utm33_ost', 'utm33_nord', 'lengdegrad', 'breddegrad', 'radius_m', 'areal_m2', 'type', 'hogstdato', 'stammer', 'stammer_ha', 'grunnflate_m2_ha', 'dg_cm', 'loreyhoyde_m_anslatt', 'volum_fub_m3_ha', 'volum_fub_m3_daa', 'middelstamme_m3', 'gran_pst_g', 'furu_pst_g', 'lauv_pst_g'];
  const rader = res.flater.map((f) => [f.id, f.bestandNr ?? '', f.e, f.n, f.lon, f.lat, res.radius, res.areal, res.tynning ? 'uttak (tynning)' : 'flatehogst', f.dato, f.stammer, f.nHa, f.gHa, f.dg ?? '', f.hl ?? '', f.vHa, f.vDaa, f.middelstamme ?? '', f.andel.G, f.andel.F, f.andel.L]);
  return [hode, ...rader].map((x) => x.map((v) => (typeof v === 'number' ? String(v).replace('.', ',') : `"${String(v ?? '').replace(/"/g, '""')}"`)).join(';')).join('\n');
}
// Sirkel som polygon (32 punkter) i WGS84.
export function sirkel(f, radius = RADIUS) {
  const ring = []; for (let i = 0; i <= 32; i++) { const v = (i / 32) * 2 * Math.PI; const [lo, la] = utmTilGeo(f.e + Math.cos(v) * radius, f.n + Math.sin(v) * radius, 33); ring.push([r(lo, 7), r(la, 7)]); }
  return { type: 'Polygon', coordinates: [ring] };
}
export function geojson(res) {
  return { type: 'FeatureCollection', features: res.flater.map((f) => ({ type: 'Feature', geometry: sirkel(f, res.radius), properties: { lag: 'proveflate', flate: f.id, bestand: f.bestandNr, areal_m2: res.areal, type: res.tynning ? 'uttak (tynning)' : 'flatehogst', stammer_ha: f.nHa, grunnflate_m2_ha: f.gHa, dg_cm: f.dg, loreyhoyde_m_anslatt: f.hl, volum_fub_m3_ha: f.vHa, volum_fub_m3_daa: f.vDaa, treslag: Object.entries(f.andel).filter(([, p]) => p).map(([k, p]) => `${TS[k]} ${p} %`).join(', '), hogstdato: f.dato } })) };
}
