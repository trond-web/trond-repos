// Ungskog (hogstklasse I–II): treantall før og etter regulering, høyde bar og høyde lauv – registrert eller beregnet –
// og effektberegning for ungskogpleie og planting: gjennomføre nå, utsette 5 år eller ikke gjennomføre.
// Ingen DOM – kan testes i Node. Alle beløp er reelle nåverdier (før skatt) med kalkulasjonsrenten fra verdiberegningen.
//
// Faglig grunnlag (forenklet, se kildene): ungskogpleie ved 1–5 m høyde ned til 150–250 trær/daa gir høyere tilvekst på
// framtidstrærne, bedre kvalitet (større sagtømmerandel) og mer stabile trær; utsatt pleie blir dyrere fordi trærne er
// større, og uten pleie overtar lauv og tette bestand produksjonen (lavere volum av bartrær, mer massevirke, senere og
// dyrere tynning, høyere risiko for snø- og stormskader). Tallene er anslag – juster satsene under Innstillinger og Verdi.
import { STANDARD_INNSTILLINGER, startTilstand, volumKurve, rotnettoPerM3, beregnetHogstklasse, laavesteHogstalder, hkGrenser } from './model.js';
import { STANDARD_VERDI, jordverdi } from './verdi.js';
import { maalTetthet, plantetall, hoydeOm } from './tiltaksmotor.js';
import { pefcAlder } from './pefc.js';

export const UNGSKOG_FELT = {
  treantallFor: { navn: 'Treantall før regulering', enhet: 'trær/daa' },
  treantallEtter: { navn: 'Treantall etter regulering', enhet: 'trær/daa' },
  hoydeBar: { navn: 'Høyde bar', enhet: 'm' },
  hoydeLauv: { navn: 'Høyde lauv', enhet: 'm' },
};
export const EFFEKT_KILDER = [
  { navn: 'Skogkurs/Statsforvalteren: Ungskogpleie – tidspunkt, treantall og effekt', url: 'https://www.statsforvalteren.no/vestfold-og-telemark/landbruk-og-mat/skogbruk/skogkultur2/ungskogpleie2/tid-for-ungskogpleie/' },
  { navn: 'NIBIO: Ungskogpleie gir større og mer verdifulle trær', url: 'https://www.nibio.no/tema/skog/skogbehandling-og-skogskjotsel/ungskogpleie' },
];

const hk = (b, inn) => b.hogstklasse || beregnetHogstklasse(startTilstand(b).alder, laavesteHogstalder(b, inn), startTilstand(b).volumDaa, hkGrenser(b, inn));
export const erUngskog = (b, inn = STANDARD_INNSTILLINGER) => [1, 2].includes(hk(b, inn));
const utfort = (b, type) => (b.tiltak || []).filter((t) => t.type === type && t.status === 'utfort').sort((x, y) => String(y.utfortDato || y.aar).localeCompare(String(x.utfortDato || x.aar)))[0] || null;
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

// Treantallet i bestandsdataene kommer fra SR16 (laserdata) – generatoren merker kilden. SR16 teller trær over 5 cm i
// brysthøyde (produktarket for SR16), så i hogstklasse II mangler de fleste stammene.
export const fraSr16 = (b) => b.treantall != null && /SR16/.test(String(b.ekstra?.KILDE || b.ekstra?.kilde || ''));

// Modell for alle levende stammer per daa i ungskog før regulering (bar + lauv, også de tynne):
//   bar:  plantet antall (registrert eller tilrådd plantetall) × 85 % overlevelse; furu på lav bonitet og lauvbestand
//         forynges naturlig
//   lauv: naturlig oppslag av bjørk, osp, rogn og selje – mer på høy bonitet (120–700 per daa), bygges opp de første
//         ca. 6 årene
//   selvtynning: over ca. 6 m høyde (høydekurven for bonitet og alder) dør undertrykte stammer (−8 % per meter, ned til
//         halvparten)
// Nivåene er anslag fra skogkulturveiledningene (150–250 trær/daa etter pleie, ofte to–fire ganger så mange før) – mål i felt.
export function treantallModell(b, { plantet = undefined } = {}) {
  const s = startTilstand(b); const ts = b.treslag || 'G'; const bo = s.h40 || 11; const alder = Math.max(0, s.alder || 0);
  const p = plantet === undefined ? utfort(b, 'planting') : plantet;
  const lauvBase = bo >= 23 ? 700 : bo >= 20 ? 550 : bo >= 17 ? 400 : bo >= 14 ? 280 : bo >= 11 ? 180 : 120;
  let bar; let barTekst;
  if (ts === 'L') { bar = 0; barTekst = ''; } else if (!p && alder < 2) { bar = 0; barTekst = 'ikke plantet ennå'; } else if (p?.plantetall) { bar = p.plantetall * 0.85; barTekst = `plantet ${p.plantetall}/daa × 85 %`; } else if (ts === 'F' && bo <= 14 && !p) { bar = 250; barTekst = 'naturlig furuforyngelse ca. 250/daa'; } else { const pt = plantetall(ts, bo).anbefalt; bar = pt * 0.85; barTekst = `tilrådd plantetall ${pt}/daa × 85 %`; }
  const lauvFull = ts === 'L' ? lauvBase * 1.3 + 100 : lauvBase;
  const opp = Math.min(1, Math.max(0.25, alder / 6));
  const H = hoydeOm({ ...b, hoyde: null, ungskog: b.ungskog?.hoydeBar != null ? { hoydeBar: b.ungskog.hoydeBar } : undefined }, 0);
  const tynn = H > 6 ? Math.max(0.5, 1 - (H - 6) * 0.08) : 1;
  const lauv = lauvFull * opp;
  const verdi = Math.round((bar + lauv) * tynn);
  const deler = [barTekst, `ca. ${Math.round(lauv)} lauvtrær/daa (bonitet ${bo}${opp < 1 ? `, ${alder} år` : ''})`].filter(Boolean);
  return { verdi, bar: Math.round(bar * tynn), lauv: Math.round(lauv * tynn), forklaring: `Modell: ${deler.join(' + ')}${tynn < 1 ? `, minus selvtynning ved ${String(Math.round(H * 10) / 10).replace('.', ',')} m (${Math.round((1 - tynn) * 100)} %)` : ''}` };
}

// Verdiene for ungskogfeltene: registrert (b.ungskog) eller beregnet fra dataene, med forklaring.
export function ungskogData(b, { inn = STANDARD_INNSTILLINGER } = {}) {
  const u = b.ungskog || {}; const s = startTilstand(b); const ts = b.treslag || 'G'; const bo = s.h40;
  const pleid = utfort(b, 'ungskogpleie'); const plantet = utfort(b, 'planting');
  const reg = u.kilde === 'import' ? 'Fra importert skogbruksplan' : 'Registrert';
  const maal = maalTetthet(ts, bo);
  const v = (felt, verdi, kilde, forklaring) => ({ felt, verdi: verdi == null ? null : Math.round(verdi * (felt.startsWith('hoyde') ? 10 : 1)) / (felt.startsWith('hoyde') ? 10 : 1), kilde, forklaring });
  // Treantall før regulering. SR16 teller bare trær over 5 cm i brysthøyde – i ungskog er det en nedre grense.
  let tf;
  const sr = fraSr16(b);
  if (u.treantallFor != null) tf = v('treantallFor', u.treantallFor, 'registrert', reg);
  else if (b.treantall != null && !pleid && !sr) tf = v('treantallFor', b.treantall, 'data', 'Treantall i bestandsdataene (takst)');
  else {
    const m = treantallModell(b, { plantet });
    const N = sr ? Math.max(m.verdi, b.treantall) : m.verdi;
    tf = v('treantallFor', N, 'beregnet', `${m.forklaring}${sr ? `. SR16 viser ${Math.round(b.treantall)}/daa, men teller bare trær over 5 cm i brysthøyde` : ''}`);
  }
  // Treantall etter regulering
  let te;
  if (u.treantallEtter != null) te = v('treantallEtter', u.treantallEtter, 'registrert', reg);
  else if (pleid) te = v('treantallEtter', b.treantall && b.treantall <= maal * 1.4 ? b.treantall : maal, 'beregnet', `Ungskogpleie utført ${pleid.utfortDato || pleid.aar} – målet er ${maal} trær/daa`);
  else te = v('treantallEtter', maal, 'beregnet', `Anbefalt etter regulering for ${ts}${bo} (150–250 trær/daa, høyere på høy bonitet) – ikke regulert ennå`);
  // Høyder
  const hModell = hoydeOm(b, 0);
  let hb;
  if (u.hoydeBar != null) hb = v('hoydeBar', u.hoydeBar, 'registrert', reg);
  else if (ts !== 'L' && b.hoyde != null) hb = v('hoydeBar', b.hoyde, 'data', 'Middelhøyde i bestandsdataene');
  else hb = v('hoydeBar', ts === 'L' ? hModell * 0.8 : hModell, 'beregnet', `Høydekurve for bonitet ${bo} ved ${Math.round(s.alder)} år`);
  let hl;
  if (u.hoydeLauv != null) hl = v('hoydeLauv', u.hoydeLauv, 'registrert', reg);
  else if (ts === 'L' && b.hoyde != null) hl = v('hoydeLauv', b.hoyde, 'data', 'Middelhøyde i bestandsdataene');
  else {
    // Lauv (bjørk/osp/selje) vokser raskere enn gran de første 15–20 årene.
    const f = s.alder < 10 ? 1.5 : s.alder < 20 ? 1.25 : 1.05;
    hl = v('hoydeLauv', ts === 'L' ? hModell : (hb.verdi || hModell) * f, 'beregnet', ts === 'L' ? `Høydekurve for bonitet ${bo}` : `Lauv vokser raskere de første årene: bar × ${String(f).replace('.', ',')}`);
  }
  return { treantallFor: tf, treantallEtter: te, hoydeBar: hb, hoydeLauv: hl, maal, pleid, alder: s.alder, h40: bo, treslag: ts };
}

// Kostnad per daa for ungskogpleie ved høyde H (m) og treantall N: dyrere når trærne er høye og mange.
export function pleieKostPerDaa(H, N, inn = STANDARD_INNSTILLINGER) {
  const grunn = inn.kostPerDaa?.ungskogpleie ?? 650;
  const fH = H <= 3 ? 1 : H <= 5 ? 1.15 : H <= 7 ? 1.4 : 1.8;
  const fN = 1 + Math.min(0.6, Math.max(0, (N - 400) / 1000) * 0.5);
  return grunn * fH * fN;
}

// Beste hogstalder (Faustmann-omløp, aldri under PEFCs nedre grense) for treslag/bonitet.
function omlop(ts, h40, inn, vInn) { const j = jordverdi(ts, h40, inn, vInn); return { T: Math.max(j.omlop || 70, pefcAlder(h40)?.nedre ?? 40), lev: j.lev }; }

// Effekt av ungskogpleie. Gir tre alternativer med nåverdi per daa og totalt, og andre effekter.
export function effektUngskogpleie(b, { inn = STANDARD_INNSTILLINGER, vInn = STANDARD_VERDI, iAar = new Date().getFullYear(), arealDaa = null } = {}) {
  const d = ungskogData(b, { inn });
  const ts = d.treslag === 'L' ? 'L' : d.treslag; const h40 = d.h40; const A = arealDaa ?? b.areal ?? 0;
  const r = (vInn.rente ?? 3) / 100; const netto = rotnettoPerM3(ts, inn);
  const N = d.treantallFor.verdi;
  const ratio = N && d.maal ? N / d.maal : 1;
  // Lauv over bartrærne: målt gir full effekt, beregnet (typisk i upleiet ungskog) halv effekt.
  const lauvHoyere = d.hoydeLauv.verdi != null && d.hoydeBar.verdi != null && ts !== 'L' && d.hoydeLauv.verdi > d.hoydeBar.verdi * 1.1;
  const lauvOver = lauvHoyere && d.hoydeLauv.kilde !== 'beregnet';
  const Hn = d.hoydeBar.verdi ?? 0; const H5 = hoydeOm(b, 5);
  const behov = !d.pleid && ratio > 1.3;
  // Tap uten pleie: 10–35 % lavere volum av bartrær, ca. 8 % lavere nettopris (mindre sagtømmer), hogst ca. 5 år senere.
  const tapUten = Math.min(0.35, 0.1 + Math.max(0, ratio - 1.3) * 0.08 + (lauvOver ? 0.08 : lauvHoyere ? 0.04 : 0));
  const kvalitet = 0.08; const forsinkelse = 5;
  const tapUtsatt = tapUten * 0.4; // utsatt 5 år: deler av effekten tapt, mer når trærne er høye
  const { T, lev } = omlop(ts, h40, inn, vInn);
  const alder = Math.max(0, d.alder);
  const tilHogst = Math.max(1, T - alder);
  const V = volumKurve(T, h40, ts); const Vsen = volumKurve(T + forsinkelse, h40, ts);
  const K0 = pleieKostPerDaa(Hn, N, inn); const K5 = pleieKostPerDaa(H5, N * 1.05, inn);
  const nv = (inntekt, aar) => inntekt / (1 + r) ** aar;
  const alt = {
    naa: { navn: 'Gjennomfør nå', kost: K0, hogstAar: iAar + tilHogst, volum: V, pris: netto, nv: nv(V * netto + lev, tilHogst) - K0 },
    utsett: { navn: 'Utsett 5 år', kost: K5, hogstAar: iAar + tilHogst, volum: V * (1 - tapUtsatt), pris: netto, nv: nv(V * (1 - tapUtsatt) * netto + lev, tilHogst) - nv(K5, 5) },
    uten: { navn: 'Ikke gjennomfør', kost: 0, hogstAar: iAar + tilHogst + forsinkelse, volum: Vsen * (1 - tapUten), pris: netto * (1 - kvalitet), nv: nv(Vsen * (1 - tapUten) * netto * (1 - kvalitet) + lev, tilHogst + forsinkelse) },
  };
  for (const a of Object.values(alt)) { a.nvTotal = a.nv * A; a.volumTotal = a.volum * A; a.kostTotal = a.kost * A; }
  const gevinst = alt.naa.nv - alt.uten.nv; const tapVedUtsettelse = alt.naa.nv - alt.utsett.nv;
  const andre = [];
  if (d.pleid) andre.push({ type: 'info', tekst: `Ungskogpleie er utført ${d.pleid.utfortDato || d.pleid.aar}. Beregningen viser hva den har betydd.` });
  else if (!behov) andre.push({ type: 'info', tekst: `Treantallet (${N ?? '?'}/daa) er nær målet (${d.maal}/daa) – lite behov for regulering nå.` });
  if (lauvOver) andre.push({ type: 'advarsel', tekst: `Lauvet (${r1(d.hoydeLauv.verdi)} m) er høyere enn bartrærne (${r1(d.hoydeBar.verdi)} m) og skygger dem ned. Uten pleie tapes mye av barproduksjonen.` });
  if (d.pleid) { /* høydefasen er ikke lenger aktuell */ } else if (Hn > 6) andre.push({ type: 'advarsel', tekst: `Bestandet er over 6 m – pleien haster. Kostnaden stiger, og tynne, ustabile trær gir snø- og stormskader.` });
  else if (Hn >= 1 && Hn <= 5) andre.push({ type: 'god', tekst: `Høyden (${r1(Hn)} m) er i riktig fase for ungskogpleie (1–5 m).` });
  else if (Hn < 1) andre.push({ type: 'info', tekst: `Bestandet er lavt (${r1(Hn)} m). Ungskogpleie passer best ved 1–5 m – ca. ${Math.max(1, Math.round(5 * (1 - Hn)))} år fram.` });
  andre.push({ type: 'god', tekst: 'Med pleie: grovere og mer stabile trær, mer sagtømmer, tynning blir lønnsom tidligere.' });
  andre.push({ type: 'info', tekst: 'Behold ca. 10 % lauv og noen trær rundt stubber, bekker og myrkanter – det er viktig for artsmangfold og krav i PEFC.' });
  andre.push({ type: 'advarsel', tekst: 'Uten pleie: tett og lauvdominert skog, mer massevirke, senere og dyrere tynning og høyere risiko for snøbrekk.' });
  return { type: 'ungskogpleie', data: d, arealDaa: A, rente: vInn.rente ?? 3, alt, gevinst, gevinstTotal: gevinst * A, tapVedUtsettelse, tapVedUtsettelseTotal: tapVedUtsettelse * A, behov, lauvOver, tapUten, forutsetninger: { T, tilHogst, netto, tapUten, kvalitet, forsinkelse, tapUtsatt, lev }, andre };
}

// Effekt av planting (foryngelse) på snaumark: plante nå, utsette 5 år, eller naturlig foryngelse.
export function effektPlanting(b, { inn = STANDARD_INNSTILLINGER, vInn = STANDARD_VERDI, iAar = new Date().getFullYear(), arealDaa = null } = {}) {
  const s = startTilstand(b); const ts = b.treslag === 'F' ? 'F' : 'G'; const h40 = s.h40; const A = arealDaa ?? b.areal ?? 0;
  const r = (vInn.rente ?? 3) / 100; const netto = rotnettoPerM3(ts, inn);
  const { T, lev } = omlop(ts, h40, inn, vInn);
  const kost = (inn.kostPerDaa?.planting ?? 1900) + (h40 >= 11 ? (inn.kostPerDaa?.markberedning ?? 450) : 0);
  const V = volumKurve(T, h40, ts);
  // Naturlig foryngelse: senere etablering og lavere produksjon (ujevn tetthet, mer lauv) – mest på høy bonitet, der
  // gras og lauv tar over. Ofte trengs suppleringsplanting etter ca. 5 år (forventet kostnad: halvparten av satsen).
  const nat = h40 >= 17 ? { forsinkelse: 10, tap: 0.35, pris: 0.85 } : h40 >= 11 ? { forsinkelse: 8, tap: 0.3, pris: 0.9 } : { forsinkelse: 5, tap: 0.2, pris: 0.95 };
  const suppl = (inn.kostPerDaa?.suppleringsplanting ?? 800) * 0.5;
  const alt = {
    naa: { navn: 'Plant nå', kost, hogstAar: iAar + T, volum: V, nv: (V * netto + lev) / (1 + r) ** T - kost },
    utsett: { navn: 'Utsett 5 år', kost, hogstAar: iAar + T + 5, volum: V, nv: (V * netto + lev) / (1 + r) ** (T + 5) - kost / (1 + r) ** 5 },
    uten: { navn: 'Naturlig foryngelse', kost: suppl, hogstAar: iAar + T + nat.forsinkelse, volum: V * (1 - nat.tap), nv: (V * (1 - nat.tap) * netto * nat.pris + lev) / (1 + r) ** (T + nat.forsinkelse) - suppl / (1 + r) ** 5 },
  };
  for (const a of Object.values(alt)) { a.nvTotal = a.nv * A; a.volumTotal = a.volum * A; a.kostTotal = a.kost * A; }
  const andre = [
    { type: 'advarsel', tekst: 'Foryngelsesplikt: hogstflaten skal være foryngret innen 3 år etter hogst (forskrift om bærekraftig skogbruk § 6). Naturlig foryngelse må være tilfredsstillende.' },
    { type: 'god', tekst: 'Planting med foredlede planter gir raskere etablering, jevnere bestand og høyere tilvekst – og raskere karbonbinding.' },
    { type: 'info', tekst: 'Utsatt planting gir mer gras og lauv som konkurrerer, og større fare for snutebillegnag uten markberedning.' },
  ];
  return { type: 'planting', arealDaa: A, rente: vInn.rente ?? 3, alt, gevinst: alt.naa.nv - alt.uten.nv, gevinstTotal: (alt.naa.nv - alt.uten.nv) * A, tapVedUtsettelse: alt.naa.nv - alt.utsett.nv, tapVedUtsettelseTotal: (alt.naa.nv - alt.utsett.nv) * A, forutsetninger: { T, netto, lev, ...nat }, andre };
}

// Hvilken effektberegning passer for bestandet (eller et bestemt tiltak)? Ungskogpleie prioriteres.
export function effektFor(b, { inn = STANDARD_INNSTILLINGER, vInn = STANDARD_VERDI, iAar = new Date().getFullYear(), tiltak = null } = {}) {
  const type = tiltak?.type || ((b.tiltak || []).find((t) => t.status !== 'utfort' && t.type === 'ungskogpleie') ? 'ungskogpleie'
    : (b.tiltak || []).find((t) => t.status !== 'utfort' && t.type === 'planting') ? 'planting'
      : erUngskog(b, inn) && hk(b, inn) === 2 ? 'ungskogpleie'
        : erUngskog(b, inn) && hk(b, inn) === 1 && !utfort(b, 'planting') && (b.treslag || 'G') !== 'L' ? 'planting' : null);
  const arealDaa = tiltak?.arealDaa ?? null;
  if (type === 'ungskogpleie') return effektUngskogpleie(b, { inn, vInn, iAar, arealDaa });
  if (type === 'planting') return effektPlanting(b, { inn, vInn, iAar, arealDaa });
  return null;
}

// Lagrer et ungskogfelt (null/'' fjerner registreringen, så beregnet verdi brukes igjen).
export function settUngskog(b, felt, verdi, { idag = new Date().toISOString().slice(0, 10) } = {}) {
  if (!UNGSKOG_FELT[felt]) return false;
  const n = verdi === '' || verdi == null ? null : Number(String(verdi).replace(',', '.'));
  if (n != null && (!Number.isFinite(n) || n < 0 || (felt.startsWith('treantall') && n > 20000) || (felt.startsWith('hoyde') && n > 40))) return false;
  b.ungskog = { ...(b.ungskog || {}) }; delete b.ungskog.kilde;
  if (n == null) delete b.ungskog[felt]; else b.ungskog[felt] = felt.startsWith('treantall') ? Math.round(n) : Math.round(n * 10) / 10;
  b.ungskog.dato = idag;
  if (!Object.keys(b.ungskog).some((k) => UNGSKOG_FELT[k])) delete b.ungskog;
  return true;
}
