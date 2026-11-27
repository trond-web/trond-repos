// Simulering av skade før den skjer: gitt et værscenario (vindkast, snømengde, temperatur, tørke …) anslås hvilke
// bestand som rammes, hvor stor andel, berørt volum og verditap – og for skogbrann hvordan brannen sprer seg over tid.
// Modellene er forenklede og gjennomsiktige, med kjente sammenhenger fra faglitteraturen:
//   * Storm: kritisk vindkast per bestand (trehøyde, treslag, tynning, kanter mot vinden, tele) – samme logikk som
//     mekanistiske modeller av typen ForestGALES (Gardiner m.fl.), men med enkle, avrundede koeffisienter.
//   * Snø: snølast i kronene (nysnø × tetthet × avskjæring) mot en kritisk last som avhenger av treslag og slankhet.
//   * Skogbrann: spredningshastighet fra det kanadiske systemet (FBP, Forestry Canada 1992: ISI fra vind og FFMC,
//     drivstofftyper C2/C3/C4/D1/S1) og elliptisk spredning med vinden, regnet fra bestand til bestand (Dijkstra).
//   * Granbarkbille: sverming over ca. 18–20 °C, graddager over 5 °C for andre generasjon, tørkestress og
//     tilgang på ferskt vindfall (Annila 1969; Jönsson m.fl. 2007; NIBIO barkbilleovervåking).
//   * Tørke: tørkestress for plantefelt og ung gran ut fra dager uten nedbør, temperatur og bonitet.
// Resultatene er anslag for planlegging og beredskap – ikke prognoser. Ingen DOM – kan testes i Node.
import { startTilstand, rotnettoPerM3 } from './model.js';
import { risikoPerBestand, naboer, hoydeFor, SKADETYPER, skadeSenter } from './skade.js';

const logistisk = (x) => 1 / (1 + Math.exp(-x));
const klamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const r1 = (x) => Math.round(x * 10) / 10;
const meterPer = (lat) => [111320 * Math.cos((lat * Math.PI) / 180), 110540];
const avstand = (a, b) => { const k = meterPer((a[1] + b[1]) / 2); return Math.hypot((b[0] - a[0]) * k[0], (b[1] - a[1]) * k[1]); };
const peiling = (a, b) => { const k = meterPer((a[1] + b[1]) / 2); return ((Math.atan2((b[0] - a[0]) * k[0], (b[1] - a[1]) * k[1]) * 180) / Math.PI + 360) % 360; };
const vinkel = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const utfortSiden = (b, type) => (b.tiltak || []).filter((t) => t.type === type && t.status === 'utfort').reduce((m, t) => Math.max(m, t.aar || 0), 0) || null;
const planlagtInnen = (b, type, iAar, aar) => (b.tiltak || []).some((t) => t.type === type && t.status !== 'utfort' && t.aar <= iAar + aar);
export { logistisk, klamp };
export const himmel = (g) => ['nord', 'nordøst', 'øst', 'sørøst', 'sør', 'sørvest', 'vest', 'nordvest'][Math.round(((g % 360) + 360) % 360 / 45) % 8];

// ---------------------------------------------------------------- skadetyper og variabler
// Hver variabel: [id, navn, enhet, min, maks, steg, standard] eller valg.
export const TYPER = {
  storm: {
    navn: 'Storm / vindfall', ikon: '🌪', skadetype: 'storm', tapFaktor: 0.35,
    tapTekst: 'Verditap ca. 35 % av rotnettoen: dyrere opparbeiding, kvalitetstap og prisfall når mye stormvirke kommer på markedet.',
    variabler: [
      { id: 'kast', navn: 'Vindkast', enhet: 'm/s', min: 10, maks: 50, steg: 1, std: 28 },
      { id: 'retning', navn: 'Vind fra', enhet: '°', min: 0, maks: 359, steg: 5, std: 240, retning: true },
      { id: 'mark', navn: 'Marka', valg: [['normal', 'Normal'], ['vat', 'Vannmettet / bløt'], ['tele', 'Frossen (tele)']], std: 'normal' },
      { id: 'lauv', navn: 'Lauvtrær', valg: [['uten', 'Uten blader (vinter)'], ['med', 'Med blader (sommer)']], std: 'uten' },
    ],
    forslag: [['Liten kuling', { kast: 18 }], ['Storm', { kast: 28 }], ['Orkan', { kast: 35 }], ['Ekstremvær (som «Dagmar» 2011)', { kast: 42, mark: 'vat' }]],
    sensitivitet: { id: 'kast', fra: 14, til: 46, steg: 2, navn: 'Vindkast (m/s)' },
  },
  sno: {
    navn: 'Snøbrekk / snøtrykk', ikon: '❄', skadetype: 'sno', tapFaktor: 0.5,
    tapTekst: 'Verditap ca. 50 % av rotnettoen: brukne topper og stammer gir mye massevirke og vanskelig drift.',
    variabler: [
      { id: 'nysno', navn: 'Nysnø på kort tid', enhet: 'cm', min: 0, maks: 120, steg: 5, std: 40 },
      { id: 'snotype', navn: 'Snøtype', valg: [['vat', 'Våt og tung (rundt 0 °C)'], ['middels', 'Middels'], ['torr', 'Tørr og lett (kaldt)']], std: 'vat' },
      { id: 'temp', navn: 'Temperatur under snøfallet', enhet: '°C', min: -15, maks: 4, steg: 1, std: 0 },
      { id: 'vind', navn: 'Vind under/etter snøfallet', enhet: 'm/s', min: 0, maks: 25, steg: 1, std: 6 },
      { id: 'lauv', navn: 'Lauvtrær', valg: [['uten', 'Uten blader'], ['med', 'Med blader (tidlig/sen snø)']], std: 'uten' },
    ],
    forslag: [['Vanlig snøfall', { nysno: 20, snotype: 'middels', temp: -3 }], ['Tung våt snø', { nysno: 45, snotype: 'vat', temp: 0 }], ['Ekstrem våtsnø', { nysno: 80, snotype: 'vat', temp: 0, vind: 10 }]],
    sensitivitet: { id: 'nysno', fra: 0, til: 110, steg: 10, navn: 'Nysnø (cm)' },
  },
  brann: {
    navn: 'Skogbrann – spredning', ikon: '🔥', skadetype: 'brann', tapFaktor: 0.7,
    tapTekst: 'Verditap ca. 70 % av rotnettoen der skogen dør: brent virke kan bare delvis selges, og skogen må etableres på nytt.',
    variabler: [
      { id: 'torrhet', navn: 'Tørrhet i strø og bunnvegetasjon', valg: [['fuktig', 'Fuktig (FFMC 80)'], ['normal', 'Normal sommer (FFMC 86)'], ['torr', 'Tørr (FFMC 90)'], ['svart', 'Svært tørr (FFMC 93)'], ['ekstrem', 'Ekstrem tørke (FFMC 95)']], std: 'torr' },
      { id: 'vind', navn: 'Middelvind', enhet: 'm/s', min: 0, maks: 20, steg: 1, std: 6 },
      { id: 'retning', navn: 'Vind fra', enhet: '°', min: 0, maks: 359, steg: 5, std: 240, retning: true },
      { id: 'timer', navn: 'Tid før brannen er under kontroll', enhet: 't', min: 1, maks: 48, steg: 1, std: 6 },
      { id: 'lauv', navn: 'Lauvskog', valg: [['med', 'Grønn (sommer)'], ['uten', 'Bladløs (vår/høst)']], std: 'med' },
      { id: 'start', navn: 'Brannen starter i bestand', bestand: true, std: '' },
    ],
    forslag: [['Normal sommerdag', { torrhet: 'normal', vind: 4, timer: 4 }], ['Tørt og vind', { torrhet: 'torr', vind: 8, timer: 6 }], ['Ekstrem (som Sokndal 2014)', { torrhet: 'ekstrem', vind: 12, timer: 24 }]],
    sensitivitet: { id: 'timer', fra: 1, til: 24, steg: 1, navn: 'Timer' },
  },
  bille: {
    navn: 'Granbarkbille', ikon: '🪲', skadetype: 'bille', tapFaktor: 0.4,
    tapTekst: 'Verditap ca. 40 % av rotnettoen: tidlig hogst, blåved og tap av tilvekst.',
    variabler: [
      { id: 'varmeDager', navn: 'Dager med over 20 °C i sverming (mai–juni)', enhet: 'dager', min: 0, maks: 40, steg: 1, std: 10 },
      { id: 'graddager', navn: 'Graddager over 5 °C fra 1. april', enhet: '°C·døgn', min: 600, maks: 2200, steg: 50, std: 1300 },
      { id: 'torkeDager', navn: 'Lengste periode uten nedbør', enhet: 'dager', min: 0, maks: 60, steg: 1, std: 14 },
      { id: 'vindfall', navn: 'Ferskt vindfall eller snøbrekk (gran) i nærheten', enhet: 'm³', min: 0, maks: 2000, steg: 25, std: 0 },
    ],
    forslag: [['Kjølig sommer', { varmeDager: 3, graddager: 1000, torkeDager: 7 }], ['Varm sommer', { varmeDager: 15, graddager: 1450, torkeDager: 20 }], ['Varm og tørr etter storm', { varmeDager: 22, graddager: 1600, torkeDager: 30, vindfall: 500 }]],
    sensitivitet: { id: 'varmeDager', fra: 0, til: 35, steg: 2, navn: 'Dager over 20 °C' },
  },
  torke: {
    navn: 'Tørke – plantefelt og ungskog', ikon: '☀', skadetype: 'torke', tapFaktor: 1,
    tapTekst: 'Tapet er kostnaden med å suppleringsplante der plantene dør (kr per daa etter andelen som dør).',
    variabler: [
      { id: 'dager', navn: 'Dager uten nedbør av betydning', enhet: 'dager', min: 0, maks: 70, steg: 1, std: 25 },
      { id: 'tempMaks', navn: 'Typisk dagstemperatur', enhet: '°C', min: 10, maks: 35, steg: 1, std: 24 },
      { id: 'kostnad', navn: 'Kostnad suppleringsplanting', enhet: 'kr/daa', min: 500, maks: 6000, steg: 100, std: 2500 },
    ],
    forslag: [['Tørr forsommer', { dager: 20, tempMaks: 22 }], ['Tørkesommer (som 2018)', { dager: 45, tempMaks: 28 }]],
    sensitivitet: { id: 'dager', fra: 0, til: 60, steg: 4, navn: 'Dager uten nedbør' },
  },
};
export const standard = (type) => Object.fromEntries(TYPER[type].variabler.map((v) => [v.id, v.std]));

// ---------------------------------------------------------------- hjelp per bestand
function bestandInfo(S, iAar) {
  return S.bestand.filter((b) => b.geometri).map((b) => {
    const st = startTilstand(b); const { h, anslag } = hoydeFor(b);
    return { b, st, h, anslag, daa: b.areal || 0, volum: (b.areal || 0) * (st.volumDaa || 0), c: skadeSenter(b.geometri), tynnet: utfortSiden(b, 'tynning'), tetthet: b.treantall || null, iAar };
  });
}
const kroner = (S, x, m3) => m3 * rotnettoPerM3(x.b, S.innstillinger);
function kanterMotVind(x, nab, retning, iAar) {
  if (!x.c) return [];
  return (nab.get(x.b.id) || []).filter((n) => {
    const nc = skadeSenter(n.geometri); if (!nc) return false;
    const st = startTilstand(n); const apen = st.alder < 5 || planlagtInnen(n, 'sluttavvirkning', iAar, 0) || hoydeFor(n).h < 5;
    return apen && vinkel(peiling(x.c, nc), retning) <= 60;
  });
}

// ---------------------------------------------------------------- storm
export function kritiskVind(x, { mark = 'normal', lauv = 'uten', kantMotVind = false } = {}) {
  const { b, h } = x; const g = [];
  let u = b.treslag === 'F' ? 41 - 0.5 * h : b.treslag === 'L' ? 39 - 0.45 * h : 37 - 0.5 * h;
  g.push(`${b.treslag === 'F' ? 'Furu' : b.treslag === 'L' ? 'Lauv' : 'Gran'}, ${Math.round(h)} m${x.anslag ? ' (anslått)' : ''}`);
  if (h < 8) u += (8 - h) * 2;
  if (b.treslag === 'L' && lauv === 'uten') { u += 4; g.push('Bladløst lauv tar mindre vind'); }
  if (x.tynnet && x.iAar - x.tynnet <= 5) { u -= 3; g.push(`Tynnet ${x.tynnet} – ustabilt de første årene`); }
  if (h > 14 && !x.tynnet && (x.tetthet == null || x.tetthet > 110) && x.st.alder < 80) { u -= 1.5; g.push('Ikke tynnet – slanke trær'); }
  if (kantMotVind) { u -= 3.5; g.push('Åpen kant mot vinden'); }
  if (/råte/i.test(b.merknad || '')) { u -= 2; g.push('Råte'); }
  if (mark === 'vat') { u -= 2.5; g.push('Bløt mark gir dårligere forankring'); }
  if (mark === 'tele') { u += 3; g.push('Tele gir god forankring'); }
  return { u: r1(u), grunner: g };
}
export function stormVurdering(x, p, kant) {
  const k = kritiskVind(x, { mark: p.mark, lauv: p.lauv, kantMotVind: kant });
  const sann = x.h < 4 ? 0 : logistisk((p.kast - k.u) / 1.8);
  return { p: sann, andel: sann * (0.15 + 0.5 * sann), grunner: [`Kritisk vindkast ca. ${k.u} m/s`, ...k.grunner] };
}
function storm(S, p, info, nab) { return info.map((x) => ({ x, ...stormVurdering(x, p, kanterMotVind(x, nab, p.retning, x.iAar).length > 0) })); }

// ---------------------------------------------------------------- snø
const SNO_TETTHET = { vat: 1.6, middels: 1.0, torr: 0.6 }; // kg/m² per cm nysnø
export function snolast(x, p) {
  const { b } = x;
  const avskj = b.treslag === 'G' ? 0.45 : b.treslag === 'F' ? 0.35 : (p.lauv === 'med' ? 0.55 : 0.2);
  const klebrig = p.snotype === 'vat' || (p.temp >= -1 && p.temp <= 2) ? 1.15 : p.temp < -6 ? 0.8 : 1;
  return p.nysno * SNO_TETTHET[p.snotype] * avskj * klebrig * (1 + Math.max(0, p.vind - 6) * 0.03);
}
export function kritiskSnolast(x) {
  const { b, h } = x; const g = [];
  let l = b.treslag === 'G' ? 30 : b.treslag === 'F' ? 25 : 20;
  if (h < 4) { l += 30; g.push('Lave trær ligger under snøen'); }
  else if (h >= 6 && h <= 18) { l -= 8; g.push(`Slank fase (${Math.round(h)} m)`); }
  else if (h > 22) { l += 5; g.push('Grove trær'); }
  if (x.tetthet && x.tetthet > 150) { l -= 6; g.push(`Tett (${x.tetthet} trær/daa)`); }
  if (x.tynnet && x.iAar - x.tynnet <= 5) { l -= 8; g.push(`Nylig tynnet (${x.tynnet})`); }
  return { l, grunner: g };
}
export function snoVurdering(x, p) {
  const last = snolast(x, p); const k = kritiskSnolast(x); const sann = logistisk((last - k.l) / 4);
  return { p: sann, andel: sann * (0.08 + 0.35 * sann), grunner: [`Snølast i kronene ca. ${Math.round(last)} kg/m² (tåler ca. ${Math.round(k.l)})`, ...k.grunner] };
}
function sno(S, p, info) { return info.map((x) => ({ x, ...snoVurdering(x, p) })); }

// ---------------------------------------------------------------- skogbrann (FBP)
const FFMC = { fuktig: 80, normal: 86, torr: 90, svart: 93, ekstrem: 95 };
export function isi(ffmc, vindMs) {
  const m = (147.2 * (101 - ffmc)) / (59.5 + ffmc);
  const fF = 91.9 * Math.exp(-0.1386 * m) * (1 + m ** 5.31 / 4.93e7);
  return 0.208 * Math.exp(0.05039 * vindMs * 3.6) * fF;
}
// FBP: ROS = a(1 − e^(−b·ISI))^c (m/min).
const FBP = { C2: [110, 0.0282, 1.5, 'Boreal granskog (C2)'], C3: [110, 0.0444, 3.0, 'Moden furuskog (C3)'], C4: [110, 0.0293, 1.5, 'Ung bartreskog (C4)'], D1: [30, 0.0232, 1.6, 'Lauvskog (D1)'], S1: [75, 0.0297, 1.3, 'Hogstflate med hogstavfall (S1)'] };
export function drivstoff(x, lauv = 'med') {
  const { b, st, h } = x;
  if (st.alder < 5 || h < 1.5) return 'S1';
  if (b.treslag === 'L') return lauv === 'med' ? 'D2' : 'D1';
  if (h < 10) return 'C4';
  return b.treslag === 'F' ? 'C3' : 'C2';
}
export function ros(type, ISI) {
  if (type === 'D2') return 0.2 * ros('D1', ISI); // grønt lauv brenner dårlig
  const [a, bb, c] = FBP[type]; return a * (1 - Math.exp(-bb * ISI)) ** c;
}
export const lbForhold = (vindMs) => 1 + 8.729 * (1 - Math.exp(-0.030 * vindMs * 3.6)) ** 2.155;
// Spredning i retning θ (grader fra hoderetningen): ellipse med tenning i bakre brennpunkt.
export function rosRetning(hros, lb, theta) { const e = Math.sqrt(1 - 1 / (lb * lb)); return (hros * (1 - e)) / (1 - e * Math.cos((theta * Math.PI) / 180)); }

function brann(S, p, info, nab) {
  const ISI = isi(FFMC[p.torrhet] ?? 90, p.vind); const lb = lbForhold(p.vind); const mot = (p.retning + 180) % 360;
  const m = new Map(info.map((x) => { const t = drivstoff(x, p.lauv); return [x.b.id, { x, type: t, hros: ros(t, ISI) }]; }));
  const start = m.get(p.start) || [...m.values()].sort((a, b) => b.hros - a.hros)[0];
  if (!start) return { rader: [], tid: [] };
  // Dijkstra: tid (min) fra tenning til hvert bestand, via naboer (senter til senter).
  const tid = new Map([[start.x.b.id, 0]]); const ferdig = new Set();
  while (true) {
    let id = null; let t = Infinity; for (const [k, v] of tid) if (!ferdig.has(k) && v < t) { t = v; id = k; }
    if (id == null || t > p.timer * 60 * 4) break; ferdig.add(id); const a = m.get(id);
    for (const n of nab.get(id) || []) {
      const bN = m.get(n.id); if (!bN || ferdig.has(n.id) || !a.x.c || !bN.x.c) continue;
      const d = avstand(a.x.c, bN.x.c); const th = vinkel(peiling(a.x.c, bN.x.c), mot);
      const ra = Math.max(0.05, rosRetning(a.hros, lb, th)); const rb = Math.max(0.05, rosRetning(bN.hros, lb, th));
      const ny = t + d / 2 / ra + d / 2 / rb;
      if (ny < (tid.get(n.id) ?? Infinity)) tid.set(n.id, ny);
    }
  }
  const T = p.timer * 60;
  const rader = [...m.values()].map(({ x, type, hros }) => {
    const ta = tid.get(x.b.id); const omkr = 2 * Math.sqrt(Math.max(1, x.daa * 1000) / Math.PI);
    const brent = ta == null || ta > T ? 0 : klamp((((T - ta) * hros * (1 + 1 / lb)) / 2 / omkr) ** 1.2 + (ta === 0 ? 0.02 : 0));
    const krone = (type === 'C2' || type === 'C3' || type === 'C4') && hros > 10;
    const dor = type === 'S1' ? 1 : krone ? 0.9 : type === 'C3' ? 0.35 : type.startsWith('D') ? 0.5 : 0.6;
    const g = [`${type === 'D2' ? 'Grønn lauvskog' : FBP[type][3]}: ${r1(hros)} m/min med vinden${krone ? ' – fare for toppbrann' : ''}`];
    if (ta != null) g.push(ta === 0 ? 'Brannen starter her' : `Brannen kommer etter ca. ${ta < 90 ? `${Math.round(ta)} min` : `${r1(ta / 60)} t`}`);
    return { x, p: brent > 0 ? 1 : 0, andel: brent * dor, brent, ankomst: ta ?? null, grunner: g, drivstoff: type };
  });
  // Brent areal over tid (for kurven)
  const kurve = [1, 2, 3, 4, 6, 8, 12, 16, 24, 36, 48].filter((h) => h <= Math.max(p.timer, 6) * 2).map((h) => ({ h, daa: r1(rader.reduce((s, r) => { const ta = r.ankomst; if (ta == null || ta > h * 60) return s; const omkr = 2 * Math.sqrt(Math.max(1, r.x.daa * 1000) / Math.PI); const hros = ros(r.drivstoff, ISI); return s + r.x.daa * klamp((((h * 60 - ta) * hros * (1 + 1 / lb)) / 2 / omkr) ** 1.2 + (ta === 0 ? 0.02 : 0)); }, 0)) }));
  return { rader, ekstra: { isi: r1(ISI), lb: r1(lb), start: start.x.b, kurve, hoderos: r1(Math.max(...[...m.values()].map((v) => v.hros))) } };
}

// ---------------------------------------------------------------- granbarkbille
// Værfaktorene for granbarkbille (felles for eiendom og kommune).
export function billeVaer(p) {
  return { sverm: logistisk((p.varmeDager - 4) / 1.5), toGen: logistisk((p.graddager - 1350) / 80), torke: klamp((p.torkeDager - 10) / 25), press: klamp(p.vindfall / 300) };
}
export function billeSann(statisk, v) { return klamp(statisk * v.sverm * (0.35 + 0.35 * v.torke + 0.3 * v.press) * (1 + 0.6 * v.toGen) * 1.6); }
export function billeGrunner(statisk, v, p) {
  return [`Grunnrisiko ${Math.round(statisk * 100)} av 100`, `Sverming ${Math.round(v.sverm * 100)} %`, `Andre generasjon ${Math.round(v.toGen * 100)} %`, ...(v.torke > 0.3 ? ['Tørkestress'] : []), ...(v.press > 0.2 ? [`Vindfall i nærheten (${p.vindfall} m³)`] : [])];
}
function bille(S, p, info, risiko) {
  const v = billeVaer(p);
  return info.map((x) => {
    if (x.b.treslag !== 'G') return { x, p: 0, andel: 0, grunner: ['Ikke gran'] };
    const statisk = (risiko.get(x.b.id)?.bille?.p ?? 30) / 100; const sann = billeSann(statisk, v);
    return { x, p: sann, andel: sann * 0.3, grunner: billeGrunner(statisk, v, p) };
  });
}

// ---------------------------------------------------------------- tørke
export function torkeVurdering(x, p) {
  const { b, st } = x; const stress = (p.dager * Math.max(0, p.tempMaks - 10)) / 10;
  if (st.alder > 15) return { p: 0, andel: 0, grunner: ['Etablert skog – tørken gir mest tilvekstnedgang'] };
  let terskel = st.alder <= 5 ? 30 : 50; const g = [st.alder <= 5 ? `Plantefelt (${Math.round(st.alder)} år)` : `Ungskog (${Math.round(st.alder)} år)`];
  if (b.treslag === 'G') { terskel -= 5; g.push('Gran tåler tørke dårligst'); }
  if ((b.bonitet || 11) <= 11) { terskel -= 5; g.push('Lav bonitet – ofte grunnlendt'); }
  const sann = logistisk((stress - terskel) / 5);
  return { p: sann, andel: sann * 0.5, grunner: [`Tørkestress ${Math.round(stress)} (terskel ca. ${terskel})`, ...g] };
}
function torke(S, p, info) { return info.map((x) => ({ x, ...torkeVurdering(x, p) })); }

// ---------------------------------------------------------------- simuler
export function simuler(S, type, param = {}, { iAar = new Date().getFullYear(), risiko = null, naboKart = null } = {}) {
  const def = TYPER[type]; if (!def) throw new Error(`Ukjent skadetype ${type}`);
  const p = { ...standard(type), ...param };
  const info = bestandInfo(S, iAar); const nab = naboKart || naboer(S.bestand);
  let rader; let ekstra = {};
  if (type === 'storm') rader = storm(S, p, info, nab);
  else if (type === 'sno') rader = sno(S, p, info);
  else if (type === 'brann') ({ rader, ekstra } = brann(S, p, info, nab));
  else if (type === 'bille') rader = bille(S, p, info, risiko || risikoPerBestand(S, { iAar, naboKart: nab }));
  else rader = torke(S, p, info);
  const ut = rader.map((r) => {
    const m3 = type === 'torke' ? 0 : r.x.volum * r.andel;
    const kr = type === 'torke' ? r.x.daa * r.andel * p.kostnad : kroner(S, r.x, m3) * def.tapFaktor;
    return { id: r.x.b.id, nr: r.x.b.nr, treslag: r.x.b.treslag, daa: r.x.daa, p: r1(r.p * 100) / 100, andel: Math.round(r.andel * 1000) / 1000, m3: r1(m3), kr: Math.round(kr), grunner: r.grunner, ...(r.ankomst !== undefined ? { ankomst: r.ankomst, brent: r.brent } : {}) };
  }).sort((a, b) => b.kr - a.kr || b.andel - a.andel);
  const berort = ut.filter((r) => r.andel >= 0.02);
  const sum = {
    bestand: berort.length,
    daa: r1(berort.reduce((s, r) => s + r.daa * (type === 'brann' ? (r.brent || 0) : 1), 0)),
    skadetDaa: r1(ut.reduce((s, r) => s + r.daa * r.andel, 0)),
    m3: Math.round(ut.reduce((s, r) => s + r.m3, 0)),
    kr: Math.round(ut.reduce((s, r) => s + r.kr, 0)),
  };
  return { type, param: p, rader: ut, sum, ekstra, forsikring: forsikring(type, ut), tiltak: tiltak(type, p, ut, ekstra) };
}

// Skogbrands vilkår: storm og snø – felt over 20 daa med minst 25 % skade; brann dekkes; bille og tørke dekkes ikke.
function forsikring(type, rader) {
  const t = SKADETYPER[TYPER[type].skadetype];
  if (!t?.dekket) return { dekket: false, tekst: `${t?.navn || 'Skaden'} dekkes normalt ikke av skogforsikringen.` };
  if (type === 'brann') return { dekket: true, tekst: 'Brann dekkes av skogforsikringen, også slokking og vakthold.' };
  const store = rader.filter((r) => r.andel >= 0.25); const daa = store.reduce((s, r) => s + r.daa, 0);
  return { dekket: daa >= 20, daa: r1(daa), tekst: daa >= 20 ? `Bestand med minst 25 % skade utgjør ca. ${Math.round(daa)} daa – over grensen på 20 daa (2 ha) for erstatning, hvis arealet henger sammen.` : `Bestand med minst 25 % skade utgjør ${Math.round(daa)} daa – under grensen på 20 daa (2 ha) for erstatning. Spredt skade dekkes ofte ikke.` };
}

// Hva kan gjøres før det skjer?
function tiltak(type, p, rader, ekstra) {
  const topp = rader.filter((r) => r.andel >= 0.05).slice(0, 5).map((r) => r.nr).join(', ');
  const t = [];
  if (type === 'storm') {
    if (topp) t.push(`Mest utsatt: bestand ${topp}. Vurder å hogge de eldste og høyeste granbestandene før neste stormsesong.`);
    t.push('Unngå nye hogstkanter mot fremherskende vind, og tynn tidlig (før ca. 14 m) slik at trærne blir stabile.');
    t.push('Ha avtale med entreprenør og tømmerkjøper om opprydding, og sjekk forsikringen.');
  }
  if (type === 'sno') { if (topp) t.push(`Mest utsatt: bestand ${topp}.`); t.push('Tynn tette, slanke bestand tidlig og forsiktig – unngå sterk tynning i snøutsatte lier.'); t.push('Etter snøfall: kartlegg brekk raskt, og rydd gran før billesverming.'); }
  if (type === 'brann') { t.push(`Hodebrannen kan spre seg med opptil ${ekstra.hoderos} m/min. Varsle 110 straks, og oppgi adkomst og vannkilder.`); t.push('Hold beredskapen etter retningslinjene, og ha registrerte brannvannkilder og adkomst klare for brannvesenet.'); if (topp) t.push(`Mest utsatt: bestand ${topp}.`); }
  if (type === 'bille') { if (topp) t.push(`Mest utsatt: bestand ${topp}. Følg med på brunt boremel og misfargede kroner fra juni.`); t.push('Fjern ferskt granvirke (vindfall, snøbrekk, tømmer ved bilvei) før sverming, eller senest innen juli.'); }
  if (type === 'torke') { if (topp) t.push(`Mest utsatt: bestand ${topp}.`); t.push('Plant tidlig på våren, bruk tørkesikre planter (pluggplanter) og markberedning, og vurder furu på tørre lokaliteter.'); }
  return t;
}

// Sensitivitet: hvordan totalen endrer seg med hovedvariabelen.
export function sensitivitet(S, type, param = {}, opts = {}) {
  const s = TYPER[type].sensitivitet; const ut = [];
  if (type === 'brann') { const r = simuler(S, type, param, opts); return (r.ekstra.kurve || []).map((k) => ({ x: k.h, daa: k.daa })); }
  for (let v = s.fra; v <= s.til; v += s.steg) { const r = simuler(S, type, { ...param, [s.id]: v }, opts); ut.push({ x: v, m3: r.sum.m3, kr: r.sum.kr, daa: r.sum.skadetDaa }); }
  return ut;
}

// Værprognose → scenario (største verdier de nærmeste dagene).
export function fraPrognose(type, vaer) {
  if (!vaer?.dager?.length) return {};
  const d = vaer.dager; const maks = (k) => Math.max(...d.map((x) => x[k] ?? -Infinity));
  if (type === 'storm') { const x = d.reduce((a, b) => ((b.kast ?? b.vind) > (a.kast ?? a.vind) ? b : a)); return { kast: Math.round(x.kast ?? x.vind * 1.5), retning: Math.round((x.retning ?? 240) / 5) * 5 }; }
  if (type === 'sno') { const sno = d.reduce((s, x) => s + (x.sno || 0), 0); const kald = d.filter((x) => x.sno > 0); const t = kald.length ? kald.reduce((s, x) => s + (x.tempMin + x.tempMaks) / 2, 0) / kald.length : -2; return { nysno: Math.round(sno), temp: Math.round(t), snotype: t > -2 ? 'vat' : t > -6 ? 'middels' : 'torr', vind: Math.round(Math.max(...kald.map((x) => x.vind), 0)) }; }
  if (type === 'brann') { const x = d.reduce((a, b) => (b.vind > a.vind ? b : a)); return { vind: Math.round(x.vind), retning: Math.round((x.retning ?? 240) / 5) * 5 }; }
  if (type === 'torke') { let lengst = 0; let n = 0; for (const x of d) { if ((x.nedbor || 0) < 1) n++; else n = 0; lengst = Math.max(lengst, n); } return { tempMaks: Math.round(maks('tempMaks')), dager: lengst }; }
  return {};
}
