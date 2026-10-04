// Skogbrand: skadeforebygging og skaderegistrering for eiendommen. Ingen DOM – kan testes i Node.
// Kilder: Skogbrand (skogbrand.no: forebygging, etter skade, vilkår og «Retningslinjer for skogsdrift og
// skjøtsel i skogbrannsesongen», april 2026), Meteorologisk institutt (skogbrannfareindeks/FWI) og NIBIO
// (barkbilleovervåkingen).
import { TRESLAG, startTilstand, rotnettoPerM3, nyId } from './model.js';
import { arealM2, punktIGeometri } from './proj.js';

export const SKOGBRAND = { telefon: '23 35 65 00', minSide: 'https://www.skogbrand.no/min-side/', brann: '110', egenandel: 5000, sats: 300 };

// ---------- skadetyper ----------
// dekket: om skadetypen normalt dekkes av Skogbrands skogforsikring.
export const SKADETYPER = {
  brann: { navn: 'Brann', farge: '#d03b3b', ikon: '🔥', dekket: true },
  storm: { navn: 'Stormfelling / vindfall', farge: '#2a78d6', ikon: '🌪', dekket: true },
  sno: { navn: 'Snøbrekk / snøtrykk', farge: '#6fb2e8', ikon: '❄', dekket: true },
  smagnagere: { navn: 'Smågnagere', farge: '#9b8f80', ikon: '🐭', dekket: true },
  bille: { navn: 'Granbarkbille / insekter', farge: '#8b5a2b', ikon: '🪲', dekket: false },
  sopp: { navn: 'Sopp og råte', farge: '#a26ad1', ikon: '🍄', dekket: false },
  vilt: { navn: 'Viltbeite (elg, hjort)', farge: '#c58b2a', ikon: '🦌', dekket: false },
  torke: { navn: 'Tørke', farge: '#e0a33a', ikon: '☀', dekket: false },
  flom: { navn: 'Flom', farge: '#1c5cab', ikon: '🌊', dekket: false },
  ras: { navn: 'Ras / skred', farge: '#6b6b6b', ikon: '⛰', dekket: false },
  annet: { navn: 'Annen skade', farge: '#555555', ikon: '•', dekket: false },
};

export const SKADESTATUS = {
  registrert: { navn: 'Registrert', farge: 'var(--warning)' },
  meldt: { navn: 'Meldt forsikring', farge: '#2a78d6' },
  taksert: { navn: 'Taksert', farge: '#7d5bd0' },
  opprydding: { navn: 'Opprydding', farge: '#e07b2a' },
  avsluttet: { navn: 'Avsluttet', farge: 'var(--good)' },
};

// ---------- skogbrannfare ----------
// Fargeskala som met.no og Skogbrands retningslinjer. Grensene er EFFIS-klassene for FWI; met.no sin
// offisielle norske indeks er tilpasset norske forhold og kan avvike noe.
export const BRANNNIVAA = [
  { id: 'gronn', navn: 'Liten fare', farge: '#2e9e4f', min: -Infinity },
  { id: 'gul', navn: 'Noe fare', farge: '#f2c230', min: 5.2 },
  { id: 'oransje', navn: 'Fare', farge: '#f08a24', min: 11.2 },
  { id: 'rod', navn: 'Stor fare', farge: '#e0442f', min: 21.3 },
  { id: 'morkerod', navn: 'Ekstra stor fare', farge: '#8f1c1c', min: 38 },
];
export const brannnivaa = (fwi) => (fwi == null || Number.isNaN(fwi) ? null : [...BRANNNIVAA].reverse().find((n) => fwi >= n.min));

// Skogbrand m.fl.: «Retningslinjer for skogsdrift og skjøtsel i skogbrannsesongen» (revidert april 2026).
// Kravene er kumulative: tidligere forhåndsregler gjelder videre for hvert nivå.
export const RETNINGSLINJER = {
  generelt: [
    'Skogbrann, også små tilløp, meldes umiddelbart til brannvesenet på 110.',
    'Røyking og bålbrenning er forbudt i skogen 15. april–15. september, og ellers når det er skogbrannfare. Forbudet formidles tydelig på arbeidstakerens språk.',
  ],
  gronn: [
    'God oppmerksomhet ved drift, drivstoffhåndtering og maskinvedlikehold.',
    'Tømmerkjøper og entreprenør planlegger driftene slik at de går der skogbrannfaren er lavest.',
    'Maskinfører og entreprenør skal ha gjennomført skogbrannkurs i løpet av de 3 siste årene.',
    'Skogsmaskiner i drift skal ha beredskapspakke: skogbrannstryker, fylt vanndunk på 25 liter, spredekanne og spade/hakke.',
    'Ved manuell hogst eller skjøtsel skal skogbrannstryker, fylt vanndunk på 25 liter og spredekanne være på stedet når lokale forhold tilsier skogbrannfare.',
    'Gjennomfør risikovurdering: indeks, tørke og værmelding; skogtype, vegetasjon, skogbunn og topografi; adkomst og vann; spredningsrisiko, vind, nærhet til bebyggelse; mobildekning.',
    'Vurder sikringstiltak: kjøring uten belter/kjettinger; prioriter granskog og fuktige områder; unngå tørr, blokkrik furumark og sør- og vestvendte lier; utkjøring tett på hogst; kjøring natt/morgen; vakthold under og etter drift; vanning av utkjøringsveier; forhåndskontakt med brannvesenet; sikringsradio uten mobildekning; flytt eller stopp aktiviteten.',
  ],
  rod: [
    'Entreprenør eller maskinfører gjennomfører SAMRÅD med tømmerkjøper/oppdragsgiver som grunnlag for risikovurdering og sikringstiltak. Samrådet dokumenteres, og tid for nytt samråd avtales.',
  ],
  morkerod: [
    'Samrådet vurderer nye tiltak ut fra risikoen på stedet.',
    'Brannvesenet forespørres om å delta i samrådet eller få kopi av samrådsskjemaet. Skjemaet skal også ha mobildekning og kontaktnumre, nøyaktig posisjon, utstyr og personer som kan bidra ved brann, og adkomst og vanntilgang.',
    'Markberedning, manuell avvirkning og ungskogpleie gjennomføres normalt ikke. Eventuelt må særlige sikringstiltak være gjennomført etter dialog med brannvesenet.',
    'Vurder flyttbar vannkilde (1000 liter fat), enkle pumper og slanger, og avtale med brannvesenet om påfylling.',
  ],
};
export function retningslinjerFor(nivaaId) {
  const ut = [...RETNINGSLINJER.generelt, ...RETNINGSLINJER.gronn];
  if (nivaaId === 'rod' || nivaaId === 'morkerod') ut.push(...RETNINGSLINJER.rod);
  if (nivaaId === 'morkerod') ut.push(...RETNINGSLINJER.morkerod);
  return ut;
}
export const iBrannsesong = (d) => { const m = d.getMonth() + 1; const dag = d.getDate(); return (m > 4 || (m === 4 && dag >= 15)) && (m < 9 || (m === 9 && dag <= 15)); };

// ---------- geometrihjelp (lokal projeksjon i meter) ----------
const ringer = (g) => (!g ? [] : g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : []);
function senter(g) {
  if (!g) return null;
  if (g.type === 'Point') return g.coordinates;
  const pts = ringer(g)[0] || [];
  if (!pts.length) return null;
  const n = pts.length - 1 || 1;
  return [pts.slice(0, n).reduce((s, p) => s + p[0], 0) / n, pts.slice(0, n).reduce((s, p) => s + p[1], 0) / n];
}
export { senter as skadeSenter };
const meterPer = (lat) => [111320 * Math.cos((lat * Math.PI) / 180), 110540];
function avstandPunktSegment(p, a, b, k) {
  const ax = (a[0] - p[0]) * k[0]; const ay = (a[1] - p[1]) * k[1];
  const bx = (b[0] - p[0]) * k[0]; const by = (b[1] - p[1]) * k[1];
  const dx = bx - ax; const dy = by - ay; const l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}
// Minste avstand mellom kantene til to flater (0 hvis de overlapper). Rask nok for nabosjekk mellom bestand.
export function kantavstand(g1, g2) {
  const r1 = ringer(g1); const r2 = ringer(g2);
  if (!r1.length || !r2.length) return Infinity;
  const k = meterPer(r1[0][0][1]);
  if (punktIGeometri(r1[0][0], g2) || punktIGeometri(r2[0][0], g1)) return 0;
  let min = Infinity;
  for (const ra of r1) for (const p of ra) for (const rb of r2) for (let i = 0; i < rb.length - 1; i++) { const d = avstandPunktSegment(p, rb[i], rb[i + 1], k); if (d < min) min = d; }
  for (const rb of r2) for (const p of rb) for (const ra of r1) for (let i = 0; i < ra.length - 1; i++) { const d = avstandPunktSegment(p, ra[i], ra[i + 1], k); if (d < min) min = d; }
  return min;
}
const bbox = (g) => { let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity; for (const r of ringer(g)) for (const [x, y] of r) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } if (g?.type === 'Point') [x0, y0, x1, y1] = [...g.coordinates, ...g.coordinates]; return [x0, y0, x1, y1]; };
// Retning fra a til b i grader (0 = nord, 90 = øst).
function retning(a, b) { const k = meterPer(a[1]); return ((Math.atan2((b[0] - a[0]) * k[0], (b[1] - a[1]) * k[1]) * 180) / Math.PI + 360) % 360; }
const himmel = (g) => ['nord', 'nordøst', 'øst', 'sørøst', 'sør', 'sørvest', 'vest', 'nordvest'][Math.round(g / 45) % 8];
const meterMellom = (a, b) => { const k = meterPer(a[1]); return Math.hypot((a[0] - b[0]) * k[0], (a[1] - b[1]) * k[1]); };

// Naboer (bestand som grenser til hverandre, innen 15 m).
export function naboer(bestand, maks = 15) {
  const med = bestand.filter((b) => b.geometri && /Polygon/.test(b.geometri.type)).map((b) => ({ b, bb: bbox(b.geometri) }));
  const ut = new Map(med.map(({ b }) => [b.id, []]));
  const grad = maks / 111000 * 2;
  for (let i = 0; i < med.length; i++) for (let j = i + 1; j < med.length; j++) {
    const a = med[i]; const c = med[j];
    if (a.bb[0] - grad > c.bb[2] || c.bb[0] - grad > a.bb[2] || a.bb[1] - grad > c.bb[3] || c.bb[1] - grad > a.bb[3]) continue;
    if (kantavstand(a.b.geometri, c.b.geometri) <= maks) { ut.get(a.b.id).push(c.b); ut.get(c.b.id).push(a.b); }
  }
  return ut;
}

// ---------- risiko per bestand ----------
// Middelhøyde: registrert høyde, ellers grovt anslag fra alder og bonitet (H40 = overhøyde ved 40 år).
export function hoydeFor(b) {
  if (b.hoyde) return { h: b.hoyde, anslag: false };
  const { alder, h40 } = startTilstand(b);
  if (!alder) return { h: 0, anslag: true };
  return { h: Math.round(Math.min(1.6, (alder / 40) ** 0.75) * h40 * 0.85 * 10) / 10, anslag: true };
}
const utfortSiden = (b, type, iAar) => (b.tiltak || []).filter((t) => t.type === type && t.status === 'utfort').reduce((m, t) => Math.max(m, t.aar || 0), 0) || null;
const planlagtInnen = (b, type, iAar, aar) => (b.tiltak || []).some((t) => t.type === type && t.status !== 'utfort' && t.aar <= iAar + aar);
export const RISIKONIVAA = [
  { id: 'lav', navn: 'Lav', farge: '#2e9e4f', min: -Infinity },
  { id: 'middels', navn: 'Middels', farge: '#f2c230', min: 35 },
  { id: 'hoy', navn: 'Høy', farge: '#e0442f', min: 60 },
];
export const risikonivaa = (p) => [...RISIKONIVAA].reverse().find((n) => p >= n.min);

// Gir { storm, bille, sno, brann } per bestand med poeng (0–100), nivå og begrunnelser.
export function risikoPerBestand(S, { iAar = new Date().getFullYear(), billesone = null, fremherskendeVind = 240, naboKart = null } = {}) {
  const nab = naboKart || naboer(S.bestand);
  const skader = (S.skogbrand?.skader || []).filter((s) => s.geometri && s.status !== 'avsluttet');
  const veier = (S.veier?.veier || []).filter((v) => v.geometri);
  const ut = new Map();
  for (const b of S.bestand) {
    const st = startTilstand(b);
    const { h, anslag } = hoydeFor(b);
    const hTxt = `${Math.round(h)} m${anslag ? ' (anslått)' : ''}`;
    const tetthet = b.treantall || null;
    const tynnet = utfortSiden(b, 'tynning', iAar);
    const naboListe = nab.get(b.id) || [];
    const c = senter(b.geometri);
    const nyKant = naboListe.filter((n) => startTilstand(n).alder < 5 || planlagtInnen(n, 'sluttavvirkning', iAar, 3));
    const kantMotVind = c ? nyKant.filter((n) => { const nc = senter(n.geometri); if (!nc) return false; const d = Math.abs(((retning(c, nc) - fremherskendeVind + 540) % 360) - 180); return d <= 60; }) : [];
    const naerSkade = (typer, m) => (c ? skader.filter((s) => typer.includes(s.type) && meterMellom(c, senter(s.geometri)) <= m) : []);

    // Storm (Skogbrand: gran med grunt rotsystem, trær over 20 m, sen tynning, nye kanter, råte)
    const storm = { p: 0, grunner: [] };
    const leggS = (p, g) => { storm.p += p; storm.grunner.push(g); };
    if (b.treslag === 'G') leggS(25, 'Gran har grunt rotsystem');
    else if (b.treslag === 'F') leggS(8, 'Furu er relativt vindfast');
    else leggS(10, 'Lauv');
    if (h >= 20) leggS(30, `Høye trær (${hTxt}) – over 20 m er særlig utsatt`);
    else if (h >= 15) leggS(18, `Trehøyde ${hTxt}`);
    else if (h >= 10) leggS(8, `Trehøyde ${hTxt}`);
    if (h > 14 && !tynnet && (tetthet == null || tetthet > 110) && st.alder < 80) leggS(15, `Ikke tynnet${tetthet ? ` (${tetthet} trær/daa)` : ''} – tynning bør skje før 14 m`);
    if (tynnet && iAar - tynnet <= 5) leggS(12, `Tynnet ${tynnet} – redusert stabilitet de første 3–5 årene`);
    if (nyKant.length && h >= 12) leggS(15, `Ny eller planlagt hogstkant mot ${nyKant.map((n) => n.nr).join(', ')}`);
    if (kantMotVind.length && h >= 12) leggS(12, `Åpen kant mot ${himmel(fremherskendeVind)} (fremherskende vind)`);
    if (/råte/i.test(b.merknad || '')) leggS(10, 'Råte nevnt i merknad');
    if (naerSkade(['storm'], 300).length) leggS(10, 'Stormskade i nærheten');

    // Granbarkbille (angriper svekket og eldre gran, vindfall og nye solutsatte kanter)
    const bille = { p: 0, grunner: [] };
    const leggB = (p, g) => { bille.p += p; bille.grunner.push(g); };
    if (b.treslag !== 'G') bille.grunner.push('Ikke gran – lav risiko for stor granbarkbille');
    else {
      if (st.alder >= 60 || h >= 16) leggB(30, `Eldre/grov gran (${Math.round(st.alder)} år, ${hTxt})`);
      else if (st.alder >= 40) leggB(15, `Gran ${Math.round(st.alder)} år`);
      const vind = naerSkade(['storm', 'sno'], 1000);
      if (vind.length) leggB(30, `Uryddet storm-/snøskade innen 1 km (${vind.length})`);
      if (naerSkade(['bille'], 2000).length) leggB(25, 'Billeangrep registrert innen 2 km');
      if (nyKant.length) leggB(8, 'Ny solutsatt kant');
      if (billesone?.nivaa === 'hoy') leggB(20, `Barkbillevarsel: ${billesone.varsel}`);
      else if (billesone?.nivaa === 'middels') leggB(10, `Barkbillevarsel: ${billesone.varsel}`);
    }

    // Snøbrekk (tette, slanke bestand, nylig tynnet, lauv og furu bøyes/brekkes)
    const sno = { p: 0, grunner: [] };
    const leggN = (p, g) => { sno.p += p; sno.grunner.push(g); };
    if (b.treslag === 'L') leggN(15, 'Lauv bøyes lett av våt snø');
    else if (b.treslag === 'F') leggN(12, 'Furu er utsatt for toppbrekk');
    else leggN(8, 'Gran');
    if (h >= 6 && h <= 18) leggN(20, `Slank alder/høydefase (${hTxt})`);
    if (tetthet && tetthet > 150) leggN(20, `Tett bestand (${tetthet} trær/daa)`);
    if (tynnet && iAar - tynnet <= 5) leggN(20, `Nylig tynnet (${tynnet})`);
    if (naerSkade(['sno'], 500).length) leggN(10, 'Snøskade i nærheten');

    // Brann (tørre, grunnlendte furumarker, hogstavfall, ferdsel)
    const brann = { p: 0, grunner: [] };
    const leggF = (p, g) => { brann.p += p; brann.grunner.push(g); };
    if (b.treslag === 'F') leggF(30, 'Furuskog – ofte tørr, lyngrik mark');
    else if (b.treslag === 'G') leggF(8, 'Granskog – vanligvis fuktigere bunn');
    else leggF(10, 'Lauv');
    if (st.h40 <= 11) leggF(20, `Lav bonitet (${st.h40}) – ofte tørr og grunnlendt`);
    else if (st.h40 <= 14) leggF(10, `Middels bonitet (${st.h40})`);
    if (st.alder < 5 || planlagtInnen(b, 'sluttavvirkning', iAar, 0)) leggF(15, 'Hogstflate eller planlagt hogst – hogstavfall og maskiner');
    if (c && veier.some((v) => kantavstand(b.geometri, v.geometri) <= 50)) leggF(10, 'Nær vei – ferdsel og maskiner');

    const fiks = (r) => { r.p = Math.min(100, Math.round(r.p)); r.nivaa = risikonivaa(r.p); return r; };
    ut.set(b.id, { storm: fiks(storm), bille: fiks(bille), sno: fiks(sno), brann: fiks(brann), h, anslag });
  }
  ut.naboKart = nab;
  return ut;
}

// ---------- forebyggende tiltak ----------
export function forebyggendeTiltak(S, risiko, { iAar = new Date().getFullYear() } = {}) {
  const ut = [];
  for (const b of S.bestand) {
    const r = risiko.get(b.id); if (!r) continue;
    const st = startTilstand(b);
    const tynnet = utfortSiden(b, 'tynning', iAar);
    const harPlan = (type) => (b.tiltak || []).some((t) => t.type === type && t.status !== 'utfort');
    if (st.alder > 0 && r.h >= 3 && r.h <= 6 && (b.treantall == null || b.treantall > 160) && !harPlan('ungskogpleie') && !(b.tiltak || []).some((t) => t.type === 'ungskogpleie' && t.status === 'utfort'))
      ut.push({ b, type: 'ungskogpleie', prioritet: 2, tittel: `Ungskogpleie i ${b.nr}`, tekst: `Ca. ${Math.round(r.h)} m høyde. Tidlig ungskogpleie (ca. 4 m) til 100–140 trær/daa gir stabile trær som tåler storm og snø bedre.` });
    if (r.h > 10 && r.h <= 16 && !tynnet && b.treslag !== 'L' && (b.treantall == null || b.treantall > 110) && !harPlan('tynning') && st.alder < 70)
      ut.push({ b, type: 'tynning', prioritet: r.h > 14 ? 1 : 2, tittel: `Tynning i ${b.nr}`, tekst: `${Math.round(r.h)} m${r.anslag ? ' (anslått)' : ''}. Tynn før trærne passerer 14 m; ta maks 40 % av trærne og la 80–100 trær/daa stå. Sen tynning øker stormrisikoen.` });
    if (r.storm.nivaa.id === 'hoy' && st.alder >= 60 && !harPlan('sluttavvirkning') && !b.miljo)
      ut.push({ b, type: 'sluttavvirkning', prioritet: 2, tittel: `Prioriter hogst av ${b.nr}`, tekst: `Høy stormrisiko (${r.storm.p}/100): ${r.storm.grunner.slice(0, 3).join('; ')}. Hogst bør prioriteres, og hogstflaten tilpasses terreng og vind.` });
    const plan = (b.tiltak || []).find((t) => t.type === 'sluttavvirkning' && t.status !== 'utfort');
    if (plan) {
      const utsatte = (risiko.naboKart?.get(b.id) || []).filter((n) => { const rn = risiko.get(n.id); return rn && rn.h >= 18 && n.treslag === 'G' && !(n.tiltak || []).some((t) => t.type === 'sluttavvirkning' && t.status !== 'utfort'); });
      if (utsatte.length) ut.push({ b, type: null, prioritet: 2, tittel: `Ny hogstkant ved ${b.nr}`, tekst: `Hogsten (${plan.aar}) åpner kant mot høy gran i ${utsatte.map((n) => n.nr).join(', ')}. Vurder å legge hogstgrensen slik at kanten blir kort og ikke vender mot fremherskende vind, eller hogg nabobestandet samtidig.` });
    }
  }
  return ut.sort((a, c) => a.prioritet - c.prioritet);
}

// ---------- skaderegistrering ----------
export function nySkade(type, geometri, { dato = new Date().toISOString().slice(0, 10) } = {}) {
  return { id: nyId('sk'), type, geometri, dato, oppdaget: dato, status: 'registrert', skadeprosent: type === 'brann' ? 100 : 50, totalskade: false, beskrivelse: '', bilder: [], oppgaver: {}, timer: [], forsikring: { skadenummer: '', meldt: null, takstDato: null, takstmann: '', erstatning: null }, berorte: [] };
}

// Berørte bestand med overlappende areal. klipping = polygon-clipping (raskest) – ellers grov tilnærming via punkt.
export function beregnSkade(S, skade, { klipping = null } = {}) {
  const inn = S.innstillinger;
  const g = skade.geometri;
  const ut = [];
  if (g && /Polygon/.test(g.type)) {
    const bb = bbox(g);
    for (const b of S.bestand) {
      if (!b.geometri) continue;
      const bbb = bbox(b.geometri);
      if (bbb[0] > bb[2] || bb[0] > bbb[2] || bbb[1] > bb[3] || bb[1] > bbb[3]) continue;
      let daa = 0;
      if (klipping) { try { const s = klipping.intersection(b.geometri.coordinates, g.coordinates); daa = s.length ? arealM2({ type: 'MultiPolygon', coordinates: s }) / 1000 : 0; } catch { daa = 0; } } else if (punktIGeometri(senter(b.geometri), g)) daa = b.areal || 0;
      if (daa >= 0.2) ut.push({ id: b.id, daa });
    }
  } else if (g?.type === 'Point') {
    const b = S.bestand.find((x) => x.geometri && punktIGeometri(g.coordinates, x.geometri));
    if (b) ut.push({ id: b.id, daa: null });
  } else for (const id of skade.bestandIder || []) { const b = S.bestand.find((x) => x.id === id); if (b) ut.push({ id, daa: b.areal || 0 }); }
  const andel = (skade.skadeprosent ?? 100) / 100;
  let volum = 0; let verdi = 0; let areal = 0;
  const rader = ut.map(({ id, daa }) => {
    const b = S.bestand.find((x) => x.id === id);
    const st = startTilstand(b);
    const a = daa ?? 0;
    const v = a * st.volumDaa * andel;
    const kr = v * rotnettoPerM3(b.treslag, inn);
    volum += v; verdi += kr; areal += a;
    return { id, nr: b.nr, daa: a, treslag: b.treslag, bonitet: b.bonitet, alder: Math.round(st.alder), volumDaa: st.volumDaa, volum: v, verdi: kr };
  });
  const skadeDaa = g && /Polygon/.test(g.type) ? arealM2(g) / 1000 : areal;
  return { rader, volum, verdi, areal, skadeDaa };
}

// Skogbrands vilkår (skogforsikring): storm og snø – sammenhengende felt over 2 ha (20 daa) der minst 25 % av
// trærne er brukket/rotvelt, og minst 20 trær per ha (2 per daa) før skaden. Smågnagere – over 2 ha og minst
// 25 % døde planter. Brann dekkes uten arealgrense, inkl. slokking og vakthold. Følgeskader dekkes ikke.
export function forsikringsvurdering(skade, beregning) {
  const t = SKADETYPER[skade.type];
  const daa = beregning?.skadeDaa || 0; const pst = skade.skadeprosent ?? 0;
  if (!t?.dekket) return { status: 'ikke', tekst: `${t?.navn || 'Skaden'} dekkes normalt ikke av skogforsikringen (følgeskader som barkbiller, tørke, flom og ras er unntatt). Registrer likevel for oppfølging og eventuelle tilskudd.` };
  if (skade.type === 'brann') return { status: 'ok', tekst: 'Brann dekkes, inkludert slokking og vakthold (300 kr/time for egen innsats, dobbel sats for traktor med fører – timene må attesteres av brannsjefen).' };
  const krav = [];
  if (daa < 20) krav.push(`sammenhengende areal er ${Math.round(daa * 10) / 10} daa – grensen er 20 daa (2 ha)`);
  if (pst < 25) krav.push(`skadeprosent ${pst} % – grensen er 25 % ${skade.type === 'smagnagere' ? 'døde planter' : 'brukne eller rotvelte trær'}`);
  if (!krav.length) return { status: 'ok', tekst: `Oppfyller trolig vilkårene (${Math.round(daa)} daa, ${pst} %). ${skade.totalskade ? 'Totalskade' : 'Delvis skade gir normalt 50 % av tabellsatsen'}. Erstatning beregnes etter Skogbrands tabeller ut fra areal, bonitet og alder.` };
  return { status: 'under', tekst: `Under vilkårsgrensen: ${krav.join('; ')}. Kontakt Skogbrand likevel hvis du er usikker – flere nærliggende felt kan vurderes samlet.` };
}

// Oppfølgingsoppgaver etter skadetype (fra Skogbrands råd etter skade), med frister.
const pluss = (dato, dager) => { const d = new Date(dato); d.setDate(d.getDate() + dager); return d.toISOString().slice(0, 10); };
const forSverming = (dato) => { const d = new Date(dato); const aar = d.getMonth() >= 4 ? d.getFullYear() + 1 : d.getFullYear(); return `${aar}-05-01`; };
export function oppgaverFor(skade) {
  const d = skade.oppdaget || skade.dato;
  const felles = [
    { id: 'dokumenter', tekst: 'Dokumenter skaden: bilder, avgrensning i kart og berørte bestand', frist: pluss(d, 3) },
  ];
  const meld = { id: 'meld', tekst: `Meld skaden til forsikringsselskapet straks (Skogbrand: Min side eller ${SKOGBRAND.telefon})`, frist: pluss(d, 7) };
  const ikkeRydd = { id: 'vent', tekst: 'Ikke avvirk eller fjern skadet virke før skaden er taksert – ellers kan erstatningen falle bort', frist: null };
  const typer = {
    brann: [
      { id: 'vakthold', tekst: 'Før timeliste for vakthold og slokking, og få timene attestert av brannsjefen', frist: null },
      meld,
      { id: 'pefc', tekst: 'PEFC: Over 5 daa brent – sett av 5 daa av den mest verdifulle brente skogen urørt i 10 år (under 5 daa: hele arealet)', frist: null },
      { id: 'salg', tekst: 'Avklar salg av brent virke (betales normalt som energivirke) med tømmerkjøper', frist: pluss(d, 60) },
      { id: 'rotrate', tekst: 'Vurder rotråterisiko ved foryngelse (dekkes ikke)', frist: null },
      { id: 'forynge', tekst: 'Planlegg foryngelse innen 3 år', frist: pluss(d, 3 * 365) },
    ],
    storm: [
      meld, ikkeRydd,
      { id: 'sikkerhet', tekst: 'Opprydding av vindfall er farlig – bruk profesjonelle med riktig utstyr (spenninger i stammer og rotvelter)', frist: null },
      { id: 'bille', tekst: 'Fjern vindfelt og skadet gran før granbarkbillene svermer (normalt fra mai) – følgeskader dekkes ikke', frist: forSverming(d) },
      { id: 'kanter', tekst: 'Kontroller nye kanter og gjenstående skog for ny vindfelling etter neste uvær', frist: pluss(d, 90) },
      { id: 'forynge', tekst: 'Planlegg foryngelse av åpne flater (planting innen 3 år)', frist: pluss(d, 3 * 365) },
    ],
    sno: [
      meld, ikkeRydd,
      { id: 'vurder', tekst: 'Vurder trærne: grønne greiner over bruddet kan overleve i år; brudd under grønn krone betyr at stammen er død', frist: pluss(d, 120) },
      { id: 'bille', tekst: 'Fjern skadet gran før billesvermingen (følgeskader som toppråte og barkbiller dekkes ikke)', frist: forSverming(d) },
    ],
    smagnagere: [
      meld,
      { id: 'supplering', tekst: 'Bestill planter og suppleringsplanting i god tid', frist: pluss(d, 180) },
    ],
    bille: [
      { id: 'kommune', tekst: 'Varsle kommunens skogbruksansvarlige om angrepet', frist: pluss(d, 7) },
      { id: 'sanitar', tekst: 'Hogg og kjør ut angrepne trær (brun boremel, harpiksrenner, barkfall) før neste billegenerasjon flyr ut', frist: pluss(d, 30) },
      { id: 'lagring', tekst: 'Ikke lagre grantømmer i eller nær skogen over sommeren – kjør det ut eller barkbehandle', frist: null },
      { id: 'overvak', tekst: 'Overvåk kantene rundt angrepet resten av sesongen og neste år', frist: pluss(d, 365) },
    ],
  };
  return [...felles, ...(typer[skade.type] || [meld])];
}

// Brann: timeliste → beløp etter Skogbrands satser (300 kr/time, traktor med fører dobbel sats).
export function brannkostnader(skade) {
  let timer = 0; let kr = 0; let attestert = 0;
  for (const r of skade.timer || []) {
    const t = Number(r.timer) || 0; const sats = r.type === 'traktor' ? SKOGBRAND.sats * 2 : SKOGBRAND.sats;
    timer += t; kr += t * sats; if (r.attestert) attestert += t * sats;
  }
  return { timer, kr, attestert };
}

// Tekst til skademelding (for Min side, e-post eller utskrift).
export function skademeldingTekst(S, skade, beregning, { fmt = (v) => String(Math.round(v)) } = {}) {
  const t = SKADETYPER[skade.type];
  const c = senter(skade.geometri);
  const e = S.eiendom || {};
  const linjer = [
    `SKADEMELDING – ${t.navn.toUpperCase()}`,
    '',
    `Eiendom: ${e.navn || ''}${e.kommune ? `, ${e.kommune} kommune` : ''}${e.gnrbnr ? `, gnr/bnr ${e.gnrbnr}` : ''}`,
    e.eier ? `Eier: ${e.eier}` : null,
    S.skogbrand?.forsikring?.polise ? `Polisenummer: ${S.skogbrand.forsikring.polise}` : null,
    `Skadedato: ${skade.dato}${skade.oppdaget && skade.oppdaget !== skade.dato ? ` (oppdaget ${skade.oppdaget})` : ''}`,
    c ? `Posisjon (WGS84): ${c[1].toFixed(5)} N, ${c[0].toFixed(5)} Ø` : null,
    `Skadet areal: ${fmt(beregning.skadeDaa, 1)} daa. Anslått skadeprosent: ${skade.skadeprosent} %${skade.totalskade ? ' (totalskade)' : ''}.`,
    `Anslått skadet volum: ${fmt(beregning.volum)} m³.`,
    '',
    'Berørte bestand (fra skogbruksplanen):',
    ...beregning.rader.map((r) => `- Bestand ${r.nr}: ${fmt(r.daa, 1)} daa, ${TRESLAG[r.treslag] || ''}, bonitet ${r.bonitet ?? '–'}, alder ${r.alder} år, ${fmt(r.volumDaa, 1)} m³/daa`),
    '',
    skade.beskrivelse ? `Beskrivelse: ${skade.beskrivelse}` : null,
    skade.type === 'brann' && (skade.timer || []).length ? `Vakthold/slokking: ${fmt(brannkostnader(skade).timer, 1)} timer (${fmt(brannkostnader(skade).kr)} kr etter 300 kr/t).` : null,
    `Bilder: ${(skade.bilder || []).length}. Avgrensning kan sendes som GeoJSON.`,
    '',
    'Skadet virke er ikke fjernet, og avvirkning venter på taksering.',
  ];
  return linjer.filter((l) => l !== null).join('\n');
}

// Oppsummering av eiendommens skadesituasjon (brukes i innsikt og AI-kontekst).
export function skadeOppsummering(S) {
  const sk = S.skogbrand?.skader || [];
  const aapne = sk.filter((s) => s.status !== 'avsluttet');
  return { antall: sk.length, aapne: aapne.length, ikkeMeldt: aapne.filter((s) => s.status === 'registrert' && SKADETYPER[s.type]?.dekket).length };
}

export const tomSkogbrand = () => ({ skader: [], vannkilder: [], beredskap: {}, forsikring: { selskap: 'Skogbrand', polise: '', egenandel: SKOGBRAND.egenandel, dekning: { brann: true, storm: true, sno: true, smagnagere: true, ansvar: true, veiansvar: false } }, risiko: {} });
