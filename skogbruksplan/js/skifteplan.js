// Skifteplan for jordbruksarealet: skifter (fra AR5 eller tegnet), vekster per år, jordprøver, gjødselbehov etter
// NIBIOs Gjødslingshåndbok, gjødslingsplan etter forskrift om lagring og bruk av gjødsel (2025), plantevernjournal
// etter forskrift om plantevernmidler, og kontroll mot kravene. Ingen DOM.
import { geoTilUtm, etikettPunkt } from './proj.js';

export const KILDER = {
  gjodselforskrift: { navn: 'Forskrift om lagring og bruk av gjødsel mv. (2025)', url: 'https://lovdata.no/forskrift/2025-01-29-115' },
  ldirGjodslingsplan: { navn: 'Landbruksdirektoratet: § 26 Krav til gjødslingsplan', url: 'https://www.landbruksdirektoratet.no/nb/jordbruk/miljo-og-klima/husdyrgjodsel-og-gjodsling/forskrift-om-lagring-og-bruk-av-gjodsel-mv.-kommentarer-til-regelverk/-26.krav-til-gjodslingsplan' },
  handbokKorn: { navn: 'NIBIO Gjødslingshåndbok: normer for korn', url: 'https://www.nibio.no/tema/jord/gjodslingshandbok/gjodslingsnormer/1.korn' },
  handbokEng: { navn: 'NIBIO Gjødslingshåndbok: eng og fôrvekster', url: 'https://www.nibio.no/tema/jord/gjodslingshandbok/gjodslingsnormer/6.eng-og-forvekster' },
  handbokN: { navn: 'NIBIO Gjødslingshåndbok: korreksjon for nitrogen', url: 'https://www.nibio.no/tema/jord/gjodslingshandbok/korreksjonstabeller/nitrogen' },
  handbokP: { navn: 'NIBIO Gjødslingshåndbok: fosfor etter jordanalyser', url: 'https://www.nibio.no/tema/jord/gjodslingshandbok/korreksjonstabeller/fosforbehov--korreksjon-etter-jordanalyser' },
  handbokK: { navn: 'NIBIO Gjødslingshåndbok: kalium', url: 'https://www.nibio.no/tema/jord/gjodslingshandbok/korreksjonstabeller/kalium--korn-oljevekster-potet-og-gronnsaker' },
  plantevern: { navn: 'Mattilsynet: krav til sprøytejournalen', url: 'https://www.mattilsynet.no/planter-og-dyrking/plantevernmidler/veileder-til-forskrift-om-plantevernmidler/journalforing-ved-bruk-av-plantevernmidler/krav-til-sproytejournalen' },
  nlrJournal: { navn: 'NLR: Slik fyller du ut plantevernjournalen', url: 'https://www.nlr.no/nyhetsarkiv/default/2025/slik-fyller-du-ut-plantevernjournalen' },
  jordsmonn: { navn: 'NIBIO jordsmonnkart (WMS jordsmonn_harmonisert og erosjonsrisiko)', url: 'https://www.nibio.no/tema/jord/jordkartlegging/jordsmonnkart' },
};

export const GRUPPER = {
  korn: { navn: 'Korn', farge: '#e9c46a' },
  eng: { navn: 'Eng', farge: '#7cb342' },
  beite: { navn: 'Beite', farge: '#b5d67a' },
  gronnfor: { navn: 'Grønnfôr', farge: '#9ccc65' },
  oljevekster: { navn: 'Oljevekster', farge: '#f6e15a' },
  belgvekster: { navn: 'Belgvekster', farge: '#c39bd3' },
  potet: { navn: 'Potet', farge: '#b08968' },
  gronnsaker: { navn: 'Grønnsaker', farge: '#f4976c' },
  brakk: { navn: 'Brakk / ikke i drift', farge: '#c9c9c9' },
};

// Normer (kg/daa) ved normavling. grunn = avlingen normtallene gjelder for (eng: 400 FEm). k* = endring per 100
// enheter avling. forgrode = N-ettervirkning (kg N/daa) når kulturen er forgrøde for en ettårig kultur.
// anslag = verdier som ikke er hentet direkte fra Gjødslingshåndboka og må kontrolleres.
export const KULTURER = {
  bygg: { navn: 'Bygg', gruppe: 'korn', enhet: 'kg', normavling: 500, N: 11.1, P: 1.75, K: 6.0, kN: 1.6, kP: 0.35, kK: 1.0, forgrode: 0, pH: [6.0, 6.5] },
  havre: { navn: 'Havre', gruppe: 'korn', enhet: 'kg', normavling: 500, N: 11.1, P: 1.75, K: 6.0, kN: 1.6, kP: 0.35, kK: 1.0, forgrode: 0, pH: [5.8, 6.3] },
  varhveteMat: { navn: 'Vårhvete, mathvete', gruppe: 'korn', enhet: 'kg', normavling: 500, N: 12.5, P: 1.75, K: 6.0, kN: 2.0, kP: 0.35, kK: 1.0, forgrode: 0, pH: [6.0, 6.5] },
  varhveteFor: { navn: 'Vårhvete, fôrhvete', gruppe: 'korn', enhet: 'kg', normavling: 500, N: 11.1, P: 1.75, K: 6.0, kN: 1.6, kP: 0.35, kK: 1.0, forgrode: 0, pH: [6.0, 6.5] },
  hosthveteMat: { navn: 'Høsthvete, mathvete', gruppe: 'korn', enhet: 'kg', normavling: 600, N: 14.5, P: 2.1, K: 7.0, kN: 2.0, kP: 0.35, kK: 1.0, forgrode: 0, pH: [6.0, 6.5] },
  hosthveteFor: { navn: 'Høsthvete, fôrhvete', gruppe: 'korn', enhet: 'kg', normavling: 600, N: 13.1, P: 2.1, K: 7.0, kN: 1.6, kP: 0.35, kK: 1.0, forgrode: 0, pH: [6.0, 6.5] },
  hostrug: { navn: 'Høstrug', gruppe: 'korn', enhet: 'kg', normavling: 600, N: 13.7, P: 2.1, K: 7.0, kN: 1.6, kP: 0.35, kK: 1.0, forgrode: 0, pH: [5.5, 6.2] },
  engInt3: { navn: 'Eng, intensiv, 3 slåtter', gruppe: 'eng', enhet: 'FEm', normavling: 700, grunn: 400, N: 15.0, P: 1.6, K: 8.5, kN: 1.5, kP: 0.3, kK: 1.5, forgrode: 3.0, pH: [5.8, 6.2] },
  engInt2: { navn: 'Eng, intensiv, 2 slåtter', gruppe: 'eng', enhet: 'FEm', normavling: 600, grunn: 400, N: 15.0, P: 1.6, K: 8.5, kN: 1.5, kP: 0.3, kK: 1.5, forgrode: 3.0, pH: [5.8, 6.2] },
  engNorm2: { navn: 'Eng, normal, 2 slåtter', gruppe: 'eng', enhet: 'FEm', normavling: 500, grunn: 400, N: 13.0, P: 1.6, K: 7.5, kN: 1.5, kP: 0.3, kK: 1.5, forgrode: 2.0, pH: [5.8, 6.2] },
  engNorm1: { navn: 'Eng, normal, 1 slått', gruppe: 'eng', enhet: 'FEm', normavling: 300, grunn: 400, N: 13.0, P: 1.6, K: 7.5, kN: 1.5, kP: 0.3, kK: 1.5, forgrode: 2.0, pH: [5.8, 6.2] },
  beite: { navn: 'Beite (innmarksbeite)', gruppe: 'beite', enhet: 'FEm', normavling: 300, grunn: 400, N: 13.0, P: 1.6, K: 7.0, kN: 1.5, kP: 0.3, kK: 1.5, forgrode: 2.0, pH: [5.5, 6.2] },
  raigras: { navn: 'Grønnfôr, raigras', gruppe: 'gronnfor', enhet: 'FEm', normavling: 400, grunn: 400, N: 12.0, P: 1.6, K: 8.5, kN: 2.0, kP: 0.35, kK: 2.0, forgrode: 0, pH: [5.8, 6.3] },
  oljevekster: { navn: 'Oljevekster (vårraps, rybs)', gruppe: 'oljevekster', enhet: 'kg', normavling: 250, N: 12.0, P: 2.0, K: 6.0, kN: 3.0, kP: 0.6, kK: 1.5, forgrode: 1.0, pH: [6.0, 6.5], anslag: true },
  erter: { navn: 'Erter / åkerbønne', gruppe: 'belgvekster', enhet: 'kg', normavling: 400, N: 3.0, P: 2.0, K: 7.0, kN: 0, kP: 0.35, kK: 1.0, forgrode: 3.0, pH: [6.0, 6.5], anslag: true },
  potet: { navn: 'Potet', gruppe: 'potet', enhet: 'kg', normavling: 3000, N: 10.0, P: 5.0, K: 20.0, kN: 0.1, kP: 0.05, kK: 0.5, forgrode: 1.0, pH: [5.3, 6.0], pKrevende: true, anslag: true },
  gronnsaker: { navn: 'Grønnsaker (generell)', gruppe: 'gronnsaker', enhet: 'kg', normavling: 3000, N: 12.0, P: 5.0, K: 15.0, kN: 0.1, kP: 0.05, kK: 0.3, forgrode: 3.0, pH: [6.0, 6.8], pKrevende: true, anslag: true },
  brakk: { navn: 'Brakk / ikke i drift', gruppe: 'brakk', enhet: '', normavling: 0, N: 0, P: 0, K: 0, kN: 0, kP: 0, kK: 0, forgrode: 0, pH: null, utenGjodsel: true },
};

export const JORDARBEIDING = {
  '': '–',
  hostploying: 'Høstpløying',
  varploying: 'Vårpløying',
  harving: 'Høstharving / lett jordarbeiding',
  direktesaaing: 'Direktesåing',
  stubb: 'Stubb over vinteren',
  eng: 'Ingen (eng / beite)',
};

// Mineralgjødsel: prosent N-P-K.
export const MINERAL = {
  f22310: { navn: 'Fullgjødsel 22-3-10', N: 22, P: 3, K: 10 },
  f18315: { navn: 'Fullgjødsel 18-3-15', N: 18, P: 3, K: 15 },
  f2526: { navn: 'Fullgjødsel 25-2-6', N: 25, P: 2, K: 6 },
  kas: { navn: 'Kalkammonsalpeter 27-0-0', N: 27, P: 0, K: 0 },
  kalksalpeter: { navn: 'Kalksalpeter 15,5-0-0', N: 15.5, P: 0, K: 0 },
  kalium: { navn: 'Kaliumgjødsel (kaliumklorid 0-0-50)', N: 0, P: 0, K: 50 },
};
// Husdyrgjødsel: typiske verdier per tonn. Bruk egen analyse når den finnes. NH4 = ammonium-N.
export const HUSDYR = {
  storfe: { navn: 'Storfe, blautgjødsel (ca. 6 % TS)', N: 3.0, NH4: 1.6, P: 0.5, K: 3.0 },
  svin: { navn: 'Svin, blautgjødsel (ca. 4,5 % TS)', N: 3.6, NH4: 2.4, P: 0.8, K: 2.0 },
  sau: { navn: 'Sau, fastgjødsel', N: 6.0, NH4: 1.0, P: 1.2, K: 6.0 },
  fjorfe: { navn: 'Fjørfe, tørr gjødsel', N: 20.0, NH4: 5.0, P: 6.0, K: 10.0 },
  biorest: { navn: 'Biorest', N: 4.0, NH4: 2.5, P: 0.5, K: 2.0 },
};
// Andel av ammonium-N som regnes som plantetilgjengelig etter spredemåte (forenklet).
export const SPREDEMAATE = {
  nedfelt: { navn: 'Nedfelt / stripespredd', f: 0.8 },
  nedmoldet: { navn: 'Bredspredd, nedmoldet innen 18 t', f: 0.6 },
  overflate: { navn: 'Bredspredd på eng/beite', f: 0.45 },
};

// Fosforgrenser (kg P/daa, snitt over tre år) etter § 20, fra 2027.
const P_GRENSE = {
  vanlig: [[2027, 2.8], [2030, 2.5], [2033, 2.3]],
  rogaland: [[2027, 3.1], [2030, 3.0], [2033, 2.7]],
  nord: [[2027, 2.5]],
};
// Spredeperiode for organisk gjødsel (§ 15). Slutt = [måned, dag].
export const REGIONER = {
  innland: { navn: 'Resten av landet', slutt: [9, 15], pGrense: 'vanlig' },
  kyst: { navn: 'Kystkommuner svenskegrensen–Agder', slutt: [9, 1], pGrense: 'vanlig' },
  rogaland: { navn: 'Rogaland', slutt: [9, 1], pGrense: 'rogaland' },
  nord: { navn: 'Troms og Finnmark (med nedmolding)', slutt: [11, 1], pGrense: 'nord' },
};
export function regionFraKommune(kommunenr) {
  const f = String(kommunenr || '').padStart(4, '0').slice(0, 2);
  if (f === '11') return 'rogaland';
  if (['54', '55', '56'].includes(f)) return 'nord';
  return 'innland';
}
export function fosforgrense(aar, region = 'innland') {
  const tabell = P_GRENSE[REGIONER[region]?.pGrense || 'vanlig'];
  let g = null; for (const [fra, v] of tabell) if (aar >= fra) g = v;
  return g;
}

export const AR5_JORDBRUK = { 21: 'Fulldyrka jord', 22: 'Overflatedyrka jord', 23: 'Innmarksbeite' };

// ---------- korreksjoner ----------
const MOLD = [[3, 2], [4.5, 1], [12.5, 0], [20.5, -1], [40.5, -2], [75, -3]];
export function moldKorreksjon(mold) {
  if (mold == null || mold === '' || Number.isNaN(Number(mold))) return 0;
  const m = Number(mold);
  for (const [grense, k] of MOLD) if (m < grense) return k;
  return -3;
}
const PAL = [[2, 100], [3, 75], [4, 50], [5, 25], [10, 0], [13, -25], [16, -50]];
export function pAlKorreksjon(pal) {
  if (pal == null || pal === '' || Number.isNaN(Number(pal))) return 0;
  const p = Number(pal);
  for (const [grense, k] of PAL) if (p < grense) return k;
  return -75;
}
const KAL_KL = [7, 11, 16, 31]; // K-AL < 7 → kl. 0, 7–10 → 1, 11–15 → 2, 16–30 → 3, > 30 → 4
const KHNO3 = [[30, [50, 25, 0, 0, 0]], [50, [50, 25, 0, -10, -50]], [80, [50, 25, 0, -25, -50]], [110, [50, 0, 0, -25, -50]], [150, [25, 0, 0, -25, -50]], [200, [0, -25, -25, -25, -50]], [Infinity, [-15, -40, -40, -50, -60]]];
export function kKorreksjon(kal, khno3) {
  if (kal == null || kal === '' || Number.isNaN(Number(kal))) return 0;
  const kl = KAL_KL.findIndex((g) => Number(kal) < g); const klasse = kl < 0 ? 4 : kl;
  const kh = khno3 == null || khno3 === '' ? 80 : Number(khno3); // ukjent K-HNO3: middels rad
  return KHNO3.find(([g]) => kh < g)[1][klasse];
}

const r1 = (v) => Math.round(v * 10) / 10;

// Gjødselbehov (kg/daa) for skiftet i året, med korreksjoner som kan vises for brukeren.
export function gjodselbehov(sk, aar) {
  const v = sk.vekster?.[aar]; const k = KULTURER[v?.kultur];
  if (!k || k.utenGjodsel) return null;
  const avling = Number(v.avling) || k.normavling;
  const d = (avling - (k.grunn ?? k.normavling)) / 100;
  let N = k.N + d * k.kN; let P = k.P + d * k.kP; let K = k.K + d * k.kK;
  const korr = [];
  if (d) korr.push(`Avling ${avling} ${k.enhet}/daa (${k.grunn ? `normtall for ${k.grunn}` : `norm ${k.normavling}`}): N ${d * k.kN >= 0 ? '+' : ''}${r1(d * k.kN)}`);
  const jp = sk.jordprove || {};
  const mk = moldKorreksjon(jp.mold);
  if (mk) { N += mk; korr.push(`Moldinnhold ${jp.mold} %: N ${mk > 0 ? '+' : ''}${mk}`); }
  const forr = KULTURER[sk.vekster?.[aar - 1]?.kultur];
  if (forr?.forgrode && !['eng', 'beite'].includes(k.gruppe)) { N -= forr.forgrode; korr.push(`Forgrøde ${forr.navn.toLowerCase()}: N −${forr.forgrode}`); }
  const pk = pAlKorreksjon(jp.PAL);
  if (jp.PAL != null && jp.PAL !== '') { P *= 1 + pk / 100; if (pk) korr.push(`P-AL ${jp.PAL}: P ${pk > 0 ? '+' : ''}${pk} %`); }
  const kk = kKorreksjon(jp.KAL, jp.KHNO3);
  if (jp.KAL != null && jp.KAL !== '') { K *= 1 + kk / 100; if (kk) korr.push(`K-AL ${jp.KAL}${jp.KHNO3 ? `, K-HNO3 ${jp.KHNO3}` : ''}: K ${kk > 0 ? '+' : ''}${kk} %`); }
  return { N: Math.max(0, r1(N)), P: Math.max(0, Math.round(P * 100) / 100), K: Math.max(0, r1(K)), avling, enhet: k.enhet, kultur: k, korreksjoner: korr, utenProve: !jp.dato };
}

// Næring (kg/daa) fra én gjødsling. N for husdyrgjødsel = plantetilgjengelig (ammonium × spredemåte).
export function naering(g) {
  const m = Number(g.mengde) || 0;
  if (g.type === 'husdyr') {
    const h = g.innhold || HUSDYR[g.produkt] || {}; const f = SPREDEMAATE[g.spredemaate]?.f ?? 0.6;
    return { N: r1(m * (h.NH4 || 0) * f), Ntot: r1(m * (h.N || 0)), P: Math.round(m * (h.P || 0) * 100) / 100, K: r1(m * (h.K || 0)) };
  }
  const p = g.innhold || MINERAL[g.produkt] || {};
  return { N: r1((m * (p.N || 0)) / 100), Ntot: r1((m * (p.N || 0)) / 100), P: Math.round(((m * (p.P || 0)) / 100) * 100) / 100, K: r1((m * (p.K || 0)) / 100) };
}
export function produktNavn(g) {
  if (g.type === 'husdyr') return g.innhold?.navn || HUSDYR[g.produkt]?.navn || 'Husdyrgjødsel';
  return g.innhold?.navn || MINERAL[g.produkt]?.navn || 'Mineralgjødsel';
}
export function sumGjodsling(sk, aar, { bareUtfort = false } = {}) {
  const s = { N: 0, Ntot: 0, P: 0, K: 0, husdyrP: 0 };
  for (const g of sk.gjodsling || []) {
    if (Number(g.aar) !== aar || (bareUtfort && g.status !== 'utfort')) continue;
    const n = naering(g); s.N += n.N; s.Ntot += n.Ntot; s.P += n.P; s.K += n.K; if (g.type === 'husdyr') s.husdyrP += n.P;
  }
  return { N: r1(s.N), Ntot: r1(s.Ntot), P: Math.round(s.P * 100) / 100, K: r1(s.K), husdyrP: Math.round(s.husdyrP * 100) / 100 };
}

// Forslag til mineralgjødsling som dekker resten av N-behovet etter planlagt husdyrgjødsel.
export function foreslaGjodsling(sk, aar, { dato = null } = {}) {
  const b = gjodselbehov(sk, aar); if (!b) return [];
  const har = sumGjodsling(sk, aar);
  const restN = b.N - har.N; if (restN < 1) return [];
  const restP = b.P - har.P; const restK = b.K - har.K;
  // Velg fullgjødsel som best treffer P- og K-behovet per kg N.
  const kandidater = ['f22310', 'f18315', 'f2526'].map((id) => {
    const p = MINERAL[id]; const kg = restN / (p.N / 100);
    const avvik = Math.abs(kg * p.P / 100 - Math.max(0, restP)) * 4 + Math.abs(kg * p.K / 100 - Math.max(0, restK)) * 0.5;
    return { id, kg, avvik };
  }).sort((a, c) => a.avvik - c.avvik);
  let valg = kandidater[0];
  if (restP <= 0.2 && restK <= 1) valg = { id: 'kas', kg: restN / 0.27 };
  const k = b.kultur;
  const ut = [];
  const dato0 = dato || `${aar}-${k.gruppe === 'eng' || k.gruppe === 'beite' ? '04-25' : '05-05'}`;
  // Eng med flere slåtter: del N-gjødslingen (ca. 60 % vår, 40 % etter 1. slått).
  const fem = (v) => Math.max(5, Math.round(v / 5) * 5);
  if (k.gruppe === 'eng' && /[23] slått/.test(k.navn) && restN > 6) {
    ut.push({ type: 'mineral', produkt: valg.id, mengde: fem((restN * 0.6) / (MINERAL[valg.id].N / 100)), enhet: 'kg/daa', dato: dato0, kommentar: 'Vårgjødsling (ca. 60 % av N)' });
    ut.push({ type: 'mineral', produkt: 'kas', mengde: fem((restN * 0.4) / 0.27), enhet: 'kg/daa', dato: `${aar}-06-25`, kommentar: 'Etter 1. slått (ca. 40 % av N)' });
  } else ut.push({ type: 'mineral', produkt: valg.id, mengde: fem(valg.kg), enhet: 'kg/daa', dato: dato0, kommentar: 'Ved såing/vekststart' });
  return ut.map((g) => ({ ...g, aar, status: 'planlagt', forslag: true }));
}

// ---------- geometri ----------
const ringer = (g) => (g?.type === 'Polygon' ? g.coordinates : g?.type === 'MultiPolygon' ? g.coordinates.flat() : []);
function tilUtm(g) { return ringer(g).map((r) => r.map(([x, y]) => geoTilUtm(x, y, 33))); }
function segAvstand([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax; const dy = by - ay; const l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
// Korteste avstand (m) mellom to flater (0 ved overlapp i hjørner). Grovt, men godt nok for 50 m-terskler.
export function avstandMellom(g1, g2) {
  const a = tilUtm(g1); const b = tilUtm(g2); let best = Infinity;
  const sjekk = (pkt, rs) => { for (const r of rs) for (let i = 0; i < r.length - 1; i++) { const d = segAvstand(pkt, r[i], r[i + 1]); if (d < best) best = d; } };
  for (const r of a) for (const p of r) sjekk(p, b);
  for (const r of b) for (const p of r) sjekk(p, a);
  return best;
}
export function avstandTilVann(sk, S) {
  const vann = (S.markslag || []).filter((f) => f.kategori === 'vann' && f.geometri);
  if (!sk.geometri || !vann.length) return null;
  return Math.round(Math.min(...vann.map((v) => avstandMellom(sk.geometri, v.geometri))));
}

// ---------- oppretting ----------
export function tomSkifteplan(iAar, kommunenr) {
  return { aar: iAar, region: regionFraKommune(kommunenr), skifter: [], sproyting: [], ipv: {}, opprettet: new Date().toISOString().slice(0, 10) };
}
export function nyttSkifte({ nr, navn = '', geometri = null, areal = 0, artype = null, kilde = 'tegnet', nyId }) {
  return { id: nyId ? nyId('sk') : `sk${Math.random().toString(36).slice(2, 9)}`, nr: String(nr), navn, geometri, areal: Math.round(areal * 10) / 10, artype, kilde, vekster: {}, jordprove: {}, jordsmonn: null, gjodsling: [], notat: '' };
}
// Skifter fra AR5-figurer (kategori jordbruk) som ikke allerede finnes. Innmarksbeite får beite som kultur.
// AR5 gir arealtypen som kode (21–23) eller beskrivelse («Fulldyrka jord» …).
export function ar5Jordbrukskode(v) {
  const n = Number(v); if (n >= 21 && n <= 23) return n;
  const t = String(v || '').toLowerCase();
  return /fulldyrk/.test(t) ? 21 : /overflate/.test(t) ? 22 : /beite/.test(t) ? 23 : null;
}
export function skifterFraMarkslag(plan, figurer, { iAar, nyId, minDaa = 1 } = {}) {
  const har = new Set(plan.skifter.map((s) => s.ar5Id).filter(Boolean));
  const kode = (f) => ar5Jordbrukskode(f.ar5?.artype) || 99;
  const nye = figurer.filter((f) => f.kategori === 'jordbruk' && f.geometri && (f.areal || 0) >= minDaa && !har.has(f.id))
    .sort((a, b) => kode(a) - kode(b) || b.areal - a.areal);
  let n = plan.skifter.reduce((m, s) => Math.max(m, parseInt(s.nr, 10) || 0), 0);
  const ut = nye.map((f) => {
    const t = ar5Jordbrukskode(f.ar5?.artype);
    const s = nyttSkifte({ nr: ++n, geometri: f.geometri, areal: f.areal, artype: t || null, kilde: 'AR5', nyId });
    s.ar5Id = f.id;
    if (t === 23) s.vekster[iAar] = { kultur: 'beite', avling: '', jordarbeiding: 'eng' };
    return s;
  });
  plan.skifter.push(...ut);
  return ut;
}

// ---------- jordsmonn (NIBIO WMS) ----------
const JORDSMONN = 'https://wms.nibio.no/cgi-bin/jordsmonn_harmonisert';
const EROSJON = 'https://wms.nibio.no/cgi-bin/jordsmonn_erosjonsrisiko';
export const JORDSMONN_KARTLAG = {
  tekstur: { navn: 'Jordsmonn: tekstur i overflaten', url: JORDSMONN, lag: 'Tekstur' },
  drenering: { navn: 'Jordsmonn: naturlig drenering', url: JORDSMONN, lag: 'Drenering' },
  begrensning: { navn: 'Jordsmonn: mest begrensende egenskap', url: JORDSMONN, lag: 'Begrensning' },
  erosjon: { navn: 'Erosjonsrisiko ved høstpløying', url: EROSJON, lag: 'Erosjonsrisiko_flateerosjon' },
  drag: { navn: 'Drågerosjon', url: EROSJON, lag: 'Drag' },
};
function gfiUrl(base, lag, [lon, lat]) {
  const d = 0.0008;
  return `${base}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=${lag}&QUERY_LAYERS=${lag}&STYLES=&SRS=EPSG:4326&BBOX=${lon - d},${lat - d},${lon + d},${lat + d}&WIDTH=101&HEIGHT=101&X=50&Y=50&INFO_FORMAT=application/vnd.ogc.gml&FEATURE_COUNT=1`;
}
const felt = (blokk, navn) => { const m = blokk.match(new RegExp(`<${navn}>([^<]*)</${navn}>`)); return m ? m[1].trim().replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : null; };
export function parseJordsmonn(gml) {
  const ut = {};
  for (const [lag, nokkel] of [['Tekstur', 'tekstur'], ['Drenering', 'drenering'], ['Organisk', 'organisk'], ['Begrensning', 'begrensning']]) {
    const m = gml.match(new RegExp(`<${lag}_feature>([\\s\\S]*?)</${lag}_feature>`));
    if (!m) continue;
    ut[nokkel] = felt(m[1], 'klassenavn');
    if (nokkel === 'tekstur') { ut.helling = Number(felt(m[1], 'helling')) || null; ut.kartlagt = Number(felt(m[1], 'kartleggingsar')) || null; }
  }
  return ut;
}
export function parseErosjon(gml) {
  const kl = felt(gml, 'erosjonsrisiko');
  return kl == null ? null : { klasse: Number(kl), tekst: felt(gml, 'erosjonsrisiko_t'), beskrivelse: felt(gml, 'karakteristikk') };
}
export async function hentJordsmonn(geometri, { hent = fetch } = {}) {
  const pkt = etikettPunkt(geometri); if (!pkt) throw new Error('Skiftet mangler kart');
  const les = async (u) => { const r = await hent(u); if (!r.ok) throw new Error(`NIBIO svarte ${r.status}`); return r.text(); };
  const [js, er] = await Promise.allSettled([les(gfiUrl(JORDSMONN, 'Tekstur,Drenering,Organisk,Begrensning', pkt)), les(gfiUrl(EROSJON, 'Erosjonsrisiko_flateerosjon', pkt))]);
  if (js.status === 'rejected' && er.status === 'rejected') throw js.reason;
  const ut = js.status === 'fulfilled' ? parseJordsmonn(js.value) : {};
  ut.erosjon = er.status === 'fulfilled' ? parseErosjon(er.value) : null;
  ut.hentet = new Date().toISOString().slice(0, 10);
  ut.ikkeKartlagt = !ut.tekstur && !ut.erosjon;
  return ut;
}

// ---------- kontroll mot krav ----------
const aarAv = (d) => (d ? Number(String(d).slice(0, 4)) : null);
export function aktiveSkifter(plan, aar) {
  return plan.skifter.filter((s) => { const k = KULTURER[s.vekster?.[aar]?.kultur]; return k && !k.utenGjodsel; });
}
export function fosforSnitt(plan, aar) {
  const rader = [];
  for (const a of [aar - 2, aar - 1, aar]) {
    const sk = aktiveSkifter(plan, a); const areal = sk.reduce((s, x) => s + (x.areal || 0), 0);
    if (!sk.some((x) => (x.gjodsling || []).some((g) => Number(g.aar) === a))) continue; // år uten registrert gjødsling
    const utfort = sk.some((x) => (x.gjodsling || []).some((g) => Number(g.aar) === a && g.status === 'utfort'));
    const P = sk.reduce((s, x) => s + sumGjodsling(x, a, { bareUtfort: utfort }).P * (x.areal || 0), 0);
    if (areal) rader.push({ aar: a, areal, P, perDaa: P / areal, kilde: utfort ? 'utført' : 'planlagt' });
  }
  const areal = rader.reduce((s, r) => s + r.areal, 0);
  return { rader, snitt: areal ? rader.reduce((s, r) => s + r.P, 0) / areal : null };
}
function iSpredeperiode(dato, region) {
  const d = new Date(`${dato}T12:00:00`); if (Number.isNaN(d.getTime())) return true;
  const [m, dag] = REGIONER[region]?.slutt || [9, 15];
  const start = new Date(d.getFullYear(), 2, 1); const slutt = new Date(d.getFullYear(), m - 1, dag, 23);
  return d >= start && d <= slutt;
}
const mangler = (sk, aar) => {
  const v = sk.vekster?.[aar] || {}; const ut = [];
  if (!sk.areal) ut.push('areal');
  if (!sk.jordprove?.dato) ut.push('jordprøve');
  if (!sk.vekster?.[aar - 1]?.kultur) ut.push('forgrøde');
  if (!v.avling) ut.push('forventet avling');
  if (!(sk.gjodsling || []).some((g) => Number(g.aar) === aar)) ut.push('planlagt gjødsling');
  return ut;
};

export function kontroller(S, aar) {
  const plan = S.skifteplan; const ut = [];
  if (!plan?.skifter?.length) return ut;
  const region = plan.region || 'innland';
  const push = (nivaa, tema, tittel, tekst, skifteId = null, kilde = null) => ut.push({ nivaa, tema, tittel, tekst, skifteId, kilde });
  const aktive = aktiveSkifter(plan, aar);
  const areal = aktive.reduce((s, x) => s + (x.areal || 0), 0);
  const pKrev = aktive.filter((x) => KULTURER[x.vekster[aar].kultur].pKrevende).reduce((s, x) => s + (x.areal || 0), 0);
  const uten = plan.skifter.filter((s) => !s.vekster?.[aar]?.kultur);
  if (uten.length) push('varsel', 'gjodslingsplan', `${uten.length} skifte${uten.length > 1 ? 'r' : ''} mangler vekst for ${aar}`, uten.map((s) => s.nr).join(', '));

  // § 26 gjødslingsplan
  const pakrevd = areal > 25 || pKrev > 5;
  push(pakrevd ? 'info' : 'ok', 'gjodslingsplan', pakrevd ? `Gjødslingsplan er påkrevd for ${aar}` : `Gjødslingsplan er ikke påkrevd for ${aar}`,
    `${Math.round(areal)} daa gjødslet areal${pKrev ? `, herav ${Math.round(pKrev)} daa potet/grønnsaker` : ''}. Krav når foretaket disponerer og gjødsler mer enn 25 daa, eller mer enn 5 daa potet eller grønnsaker. Planen skal foreligge før vekstsesongen og oppbevares i 5 år etter planåret.`, null, 'ldirGjodslingsplan');
  if (pakrevd) for (const sk of aktive) {
    const m = mangler(sk, aar);
    if (m.length) push('avvik', 'gjodslingsplan', `Skifte ${sk.nr}: gjødslingsplanen er ufullstendig`, `Mangler ${m.join(', ')}.`, sk.id, 'ldirGjodslingsplan');
  }
  // § 29 jordprøver
  for (const sk of aktive) {
    const k = KULTURER[sk.vekster[aar].kultur]; const pa = aarAv(sk.jordprove?.dato);
    const maks = k.pKrevende ? 4 : 8;
    if (!pa) { if (pakrevd) continue; push('varsel', 'jordprove', `Skifte ${sk.nr} mangler jordprøve`, 'Representative jordprøver (pH, P-AL, K-AL, moldinnhold) trengs for gjødselbehovet.', sk.id, 'gjodselforskrift'); continue; }
    const alder = aar - pa;
    if (alder > maks) push('avvik', 'jordprove', `Skifte ${sk.nr}: jordprøven er ${alder} år gammel`, `Maks ${maks} år${k.pKrevende ? ' for fosforkrevende kulturer (potet, grønnsaker)' : ''}. Ta ny prøve før vekstsesongen.`, sk.id, 'gjodselforskrift');
    else if (alder >= maks - 1) push('varsel', 'jordprove', `Skifte ${sk.nr}: ny jordprøve snart`, `Prøven fra ${pa} går ut etter ${pa + maks}.`, sk.id, 'gjodselforskrift');
    const pH = Number(sk.jordprove.pH);
    if (pH && k.pH && pH < k.pH[0] - 0.05) push('varsel', 'kalk', `Skifte ${sk.nr}: lav pH (${pH})`, `Anbefalt pH for ${k.navn.toLowerCase()} er ${k.pH[0]}–${k.pH[1]}. Vurder kalking.`, sk.id, 'handbokKorn');
    if (Number(sk.jordprove.PAL) > 14) push('varsel', 'fosfor', `Skifte ${sk.nr}: høy P-AL (${sk.jordprove.PAL})`, 'Høyt fosfortall – gjødselbehovet for P er redusert. Begrens fosfortilførselen.', sk.id, 'handbokP');
  }
  // § 20 fosforgrense
  const grense = fosforgrense(aar, region); const fs = fosforSnitt(plan, aar);
  if (fs.snitt != null) {
    const tekst = `Snitt ${Math.round(fs.snitt * 100) / 100} kg P/daa (${fs.rader.map((r) => `${r.aar}: ${Math.round(r.perDaa * 100) / 100} ${r.kilde}`).join(', ')}).`;
    if (grense == null) push('info', 'fosfor', 'Fosforgrense gjelder fra 2027', `${tekst} Fra 2027: ${fosforgrense(2027, region)} kg P/daa i snitt over tre år (${REGIONER[region].navn.toLowerCase()}).`, null, 'gjodselforskrift');
    else if (fs.snitt > grense) push('avvik', 'fosfor', `Fosfortilførselen er over grensen (${grense} kg P/daa)`, tekst, null, 'gjodselforskrift');
    else push('ok', 'fosfor', `Fosfortilførselen er innenfor grensen (${grense} kg P/daa)`, tekst, null, 'gjodselforskrift');
  }
  // Gjødsling over behov
  for (const sk of aktive) {
    const b = gjodselbehov(sk, aar); const s = sumGjodsling(sk, aar); if (!b || !(sk.gjodsling || []).length) continue;
    if (s.N > b.N * 1.15 + 1) push('varsel', 'gjodsling', `Skifte ${sk.nr}: N over behov`, `Planlagt ${s.N} kg N/daa mot behov ${b.N}.`, sk.id, 'handbokN');
    if (s.P > b.P + 0.5) push('varsel', 'gjodsling', `Skifte ${sk.nr}: P over behov`, `Planlagt ${s.P} kg P/daa mot behov ${b.P}.`, sk.id, 'handbokP');
  }
  // § 15–16 spredetid og nedmolding for organisk gjødsel
  for (const sk of plan.skifter) for (const g of sk.gjodsling || []) {
    if (g.type !== 'husdyr' || Number(g.aar) !== aar || !g.dato) continue;
    if (!iSpredeperiode(g.dato, region)) push('avvik', 'spredning', `Skifte ${sk.nr}: husdyrgjødsel utenfor spredeperioden`, `${g.dato}: tillatt 1. mars–${REGIONER[region].slutt[1]}.${REGIONER[region].slutt[0]}. (${REGIONER[region].navn.toLowerCase()}). Ikke på snødekt eller frossen mark.`, sk.id, 'gjodselforskrift');
    const v = sk.vekster?.[aar]; const apen = v && !['eng', 'beite'].includes(KULTURER[v.kultur]?.gruppe);
    if (apen && g.spredemaate === 'overflate') push('avvik', 'spredning', `Skifte ${sk.nr}: husdyrgjødsel på åpen åker må moldes ned`, 'Organisk gjødsel på åpen jord skal moldes ned innen 18 timer.', sk.id, 'gjodselforskrift');
  }
  // Erosjon og vekstskifte
  for (const sk of plan.skifter) {
    const v = sk.vekster?.[aar]; const e = sk.jordsmonn?.erosjon?.klasse;
    if (v?.jordarbeiding === 'hostploying' && e >= 3) push('varsel', 'erosjon', `Skifte ${sk.nr}: høstpløying med ${sk.jordsmonn.erosjon.tekst.toLowerCase()}`, 'Vurder stubb over vinteren eller vårpløying (regionalt miljøtilskudd).', sk.id, 'jordsmonn');
    const k = KULTURER[v?.kultur]; if (!k) continue;
    const forrige = [1, 2, 3].map((i) => KULTURER[sk.vekster?.[aar - i]?.kultur]?.gruppe);
    if (k.gruppe === 'potet' && forrige.includes('potet')) push('varsel', 'vekstskifte', `Skifte ${sk.nr}: potet med kort vekstskifte`, 'Minst 4 år mellom potet på samme skifte reduserer risikoen for potetcystenematoder og jordboende sjukdommer.', sk.id);
    if (k.gruppe === 'korn' && forrige.every((g) => g === 'korn')) push('varsel', 'vekstskifte', `Skifte ${sk.nr}: korn fjerde år på rad`, 'Ensidig korndyrking øker ugras- og sjukdomstrykket. Vurder vekstskifte med oljevekster, belgvekster eller eng.', sk.id);
  }
  // Plantevern
  const sp = (plan.sproyting || []).filter((x) => aarAv(x.dato) === aar);
  for (const x of sp) {
    const m = ['dato', 'preparat', 'dose', 'skadegjorer'].filter((f) => !x[f]); if (!(x.skifter || []).length) m.push('skifte');
    if (m.length) push('avvik', 'plantevern', `Sprøyting ${x.dato || ''} ${x.preparat || ''}: ufullstendig`, `Mangler ${m.join(', ').replace('skadegjorer', 'skadegjører')}.`, null, 'plantevern');
  }
  if (sp.length) {
    const naer = plan.skifter.filter((sk) => sp.some((x) => (x.skifter || []).includes(sk.id))).map((sk) => ({ sk, d: avstandTilVann(sk, S) })).filter((x) => x.d != null && x.d < 50);
    if (naer.length) push('info', 'plantevern', 'Vannjournal kan være påkrevd', `Skifte ${naer.map((x) => `${x.sk.nr} (${x.d} m)`).join(', ')} ligger under 50 m fra vann. Før vannjournal når preparatet krever vegetasjonssone eller avdriftsavstand.`, null, 'nlrJournal');
    const ipv = plan.ipv?.[aar] || {};
    if (Object.keys(ipv).length < IPV.length) push('varsel', 'plantevern', `Fyll ut integrert plantevern-sjekklisten for ${aar}`, 'Del 1 av plantevernjournalen skal fylles ut årlig når plantevernmidler brukes.', null, 'nlrJournal');
  }
  const rang = { avvik: 0, varsel: 1, info: 2, ok: 3 };
  return ut.sort((a, b) => rang[a.nivaa] - rang[b.nivaa]);
}

export const IPV = [
  'Vekstskifte og jordarbeiding brukes for å forebygge skadegjørere',
  'Sorter med god resistens/toleranse er valgt der det finnes',
  'Varsling (VIPS) og egne observasjoner brukes før behandling',
  'Skadeterskler vurderes før sprøyting',
  'Mekaniske og andre ikke-kjemiske tiltak er vurdert',
  'Preparat velges med hensyn til resistensfare og miljø',
  'Sprøyta er funksjonstestet innen gjeldende frist',
  'Vegetasjonssoner og avdriftsavstander mot vann er overholdt',
  'Påfylling og vask skjer slik at søl ikke når vann eller drensledning',
];

export function nySproyting({ dato, skifter = [], nyId }) {
  return { id: nyId ? nyId('sp') : `sp${Math.random().toString(36).slice(2, 9)}`, dato, skifter, preparat: '', dose: '', enhet: 'ml/daa', skadegjorer: '', begrunnelse: '', effekt: '', karens: '', utforer: '', vaer: '', vekststadium: '' };
}
export function tidligsteHosting(x) {
  if (!x.dato || !Number(x.karens)) return null;
  const d = new Date(`${x.dato}T12:00:00`); d.setDate(d.getDate() + Number(x.karens));
  return d.toISOString().slice(0, 10);
}

// ---------- sammendrag og utskrift ----------
export function oppsummer(S, aar) {
  const plan = S.skifteplan; if (!plan) return null;
  const aktive = aktiveSkifter(plan, aar);
  const perGruppe = {};
  for (const sk of plan.skifter) { const g = KULTURER[sk.vekster?.[aar]?.kultur]?.gruppe || 'ukjent'; perGruppe[g] = (perGruppe[g] || 0) + (sk.areal || 0); }
  const sum = { N: 0, P: 0, K: 0, behovN: 0, behovP: 0, behovK: 0 };
  for (const sk of aktive) {
    const a = sk.areal || 0; const s = sumGjodsling(sk, aar); const b = gjodselbehov(sk, aar);
    sum.N += s.N * a; sum.P += s.P * a; sum.K += s.K * a;
    if (b) { sum.behovN += b.N * a; sum.behovP += b.P * a; sum.behovK += b.K * a; }
  }
  const funn = kontroller(S, aar);
  return { antall: plan.skifter.length, areal: plan.skifter.reduce((s, x) => s + (x.areal || 0), 0), aktivtAreal: aktive.reduce((s, x) => s + (x.areal || 0), 0), perGruppe, sum, avvik: funn.filter((f) => f.nivaa === 'avvik').length, varsel: funn.filter((f) => f.nivaa === 'varsel').length, sproytinger: (plan.sproyting || []).filter((x) => aarAv(x.dato) === aar).length };
}

const csvC = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function gjodslingsplanCsv(S, aar) {
  const plan = S.skifteplan; const rad = [['skifte', 'navn', 'areal_daa', 'forgrode', 'vekst', 'forventet_avling', 'enhet', 'jordprove_dato', 'pH', 'P_AL', 'K_AL', 'mold_pst', 'behov_N', 'behov_P', 'behov_K', 'gjodseltype', 'mengde', 'mengde_enhet', 'dato', 'status', 'N', 'P', 'K']];
  for (const sk of plan.skifter) {
    const v = sk.vekster?.[aar] || {}; const b = gjodselbehov(sk, aar); const jp = sk.jordprove || {};
    const fast = [sk.nr, sk.navn, sk.areal, KULTURER[sk.vekster?.[aar - 1]?.kultur]?.navn || '', KULTURER[v.kultur]?.navn || '', v.avling || b?.avling || '', b?.enhet || '', jp.dato || '', jp.pH ?? '', jp.PAL ?? '', jp.KAL ?? '', jp.mold ?? '', b?.N ?? '', b?.P ?? '', b?.K ?? ''];
    const gs = (sk.gjodsling || []).filter((g) => Number(g.aar) === aar);
    if (!gs.length) rad.push([...fast, '', '', '', '', '', '', '', '']);
    for (const g of gs) { const n = naering(g); rad.push([...fast, produktNavn(g), g.mengde, g.type === 'husdyr' ? 't/daa' : 'kg/daa', g.dato || '', g.status === 'utfort' ? 'utført' : 'planlagt', n.N, n.P, n.K]); }
  }
  return rad.map((r) => r.map(csvC).join(';')).join('\n');
}
export function sproytejournalCsv(S, aar) {
  const plan = S.skifteplan; const navn = (id) => plan.skifter.find((s) => s.id === id);
  const rad = [['dato', 'skifte', 'kultur', 'areal_daa', 'preparat', 'dose', 'enhet', 'skadegjorer', 'begrunnelse', 'vekststadium', 'vaer', 'karens_dager', 'tidligste_hosting', 'effekt', 'utforer']];
  for (const x of (plan.sproyting || []).filter((y) => !aar || aarAv(y.dato) === aar).sort((a, b) => String(a.dato).localeCompare(String(b.dato)))) {
    for (const id of x.skifter || []) { const sk = navn(id); if (!sk) continue; rad.push([x.dato, sk.nr, KULTURER[sk.vekster?.[aarAv(x.dato)]?.kultur]?.navn || '', sk.areal, x.preparat, x.dose, x.enhet, x.skadegjorer, x.begrunnelse, x.vekststadium, x.vaer, x.karens, tidligsteHosting(x) || '', x.effekt, x.utforer]); }
  }
  return rad.map((r) => r.map(csvC).join(';')).join('\n');
}

// Kartskisse (SVG) over skifteinndelingen med nummer og farge etter vekst i året.
export function kartskisse(plan, aar, { bredde = 640, hoyde = 420 } = {}) {
  const sk = plan.skifter.filter((s) => s.geometri);
  if (!sk.length) return '';
  const utm = sk.map((s) => ({ s, r: tilUtm(s.geometri) }));
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const { r } of utm) for (const ring of r) for (const [x, y] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const m = 14; const sk1 = Math.min((bredde - 2 * m) / Math.max(1, x1 - x0), (hoyde - 2 * m) / Math.max(1, y1 - y0));
  const px = ([x, y]) => [m + (x - x0) * sk1, hoyde - m - (y - y0) * sk1];
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const deler = utm.map(({ s, r }) => {
    const farge = GRUPPER[KULTURER[s.vekster?.[aar]?.kultur]?.gruppe]?.farge || '#eeeeee';
    const d = r.map((ring) => `M${ring.map((p) => px(p).map((v) => v.toFixed(1)).join(',')).join('L')}Z`).join('');
    const e = etikettPunkt(s.geometri); const [ex, ey] = px(geoTilUtm(e[0], e[1], 33));
    return `<path d="${d}" fill="${farge}" fill-opacity="0.75" stroke="#333" stroke-width="1" fill-rule="evenodd"/><text x="${ex.toFixed(1)}" y="${ey.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="700" fill="#111" stroke="#fff" stroke-width="3" paint-order="stroke">${esc(s.nr)}</text>`;
  });
  const meter = 10 ** Math.floor(Math.log10((x1 - x0) / 4 || 100)); const lengde = meter * sk1;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bredde} ${hoyde}" width="100%" style="max-width:${bredde}px;background:#fafafa;border:1px solid #ccc;border-radius:6px">${deler.join('')}<g transform="translate(${m},${hoyde - 6})"><line x1="0" y1="0" x2="${lengde.toFixed(1)}" y2="0" stroke="#111" stroke-width="2"/><text x="${(lengde + 6).toFixed(1)}" y="0" font-size="10" dominant-baseline="middle">${meter >= 1000 ? `${meter / 1000} km` : `${meter} m`}</text></g><text x="${bredde - m}" y="${m + 4}" text-anchor="end" font-size="12" font-weight="700">N ↑</text></svg>`;
}
