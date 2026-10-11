// Ukesvalg: aksjer med best utsikter neste uke.
//
// Faktorstudie på Oslo Børs 2017–2026 (fredag til fredag, meravkastning mot OSEBX):
// - Virket:   12-mnd momentum, sektortrend, innsidekjøp siste 10 dager, kontraktsmeldinger siste uke
// - Negativt: uvanlig høyt volum siste uke (ofte etter kraftig oppgang på nyheter)
// - Virket ikke: «kjøp etter fall», RSI-oversolgt, 1-ukes reversering
// Forskjellene er bare ca. 0,3 % per uke, omtrent det et bytte koster. Porteføljen beholder derfor
// en aksje så lenge den er blant de 15 beste, i stedet for å bytte alt hver uke.

import { finnIndeks, forskyvDato, rangering, snitt } from "./faktorer.mjs";

export const UKEMODELL = {
  navn: "Ukesvalg",
  horisont: "1 uke",
  antall: 5,
  buffer: 10, // behold aksjen så lenge den er blant topp antall + buffer
  maksPerSektor: 2, // spre risikoen: høyst to aksjer fra samme sektor
  kostnad: 0.003, // kurtasje + spread per bytte (kjøp og salg)
  minOmsetningMNOK: 5,
  vekter: { mom12_1: 0.3, sektorMom6: 0.2, trend: 0.1, innside10: 0.15, kontrakt7: 0.15, volSjokk: -0.1 },
};

export const UKEFAKTORER = {
  mom12_1: { navn: "Momentum 12 mnd", forklaring: "Kursutvikling siste 12 måneder, uten siste måned" },
  sektorMom6: { navn: "Sektortrend", forklaring: "Hvordan resten av sektoren har gått siste 6 mnd" },
  trend: { navn: "Trend", forklaring: "Kurs mot 200-dagers snitt" },
  innside10: { navn: "Innsidekjøp", forklaring: "Kjøp fra ledelse og styre siste 10 dager" },
  kontrakt7: { navn: "Kontraktsnyheter", forklaring: "Børsmeldinger om kontrakter og ordre siste 7 dager" },
  volSjokk: { navn: "Volumtopp", forklaring: "Omsetning siste uke mot normalt (høyt volum etter nyheter har ofte snudd)" },
};

const antallMellom = (liste, fra, til) => liste.filter((h) => h.dato > fra && h.dato <= til).length;

/** Ukefaktorer for én aksje på dag i (bare data kjent t.o.m. dag i). */
export function ukeFaktorer(s, i, h) {
  if (i < 260 || (s.brudd || []).some((b) => b > i - 260 && b <= i)) return null;
  const p = s.just, k = s.kurs, v = s.volum, dato = s.datoer[i];
  let oms = 0;
  for (let x = i - 19; x <= i; x++) oms += k[x] * v[x];
  const v5 = snitt(v.slice(i - 4, i + 1)), v60 = snitt(v.slice(i - 64, i - 4));
  return {
    mom12_1: p[i - 21] / p[i - 252] - 1,
    mom6: p[i] / p[i - 126] - 1,
    r1w: p[i] / p[i - 5] - 1,
    trend: p[i] / snitt(p.slice(i - 199, i + 1)) - 1,
    innside10: antallMellom(h.innsideKjop, forskyvDato(dato, -10), dato),
    kontrakt7: antallMellom(h.kontrakter, forskyvDato(dato, -7), dato),
    volSjokk: v60 > 0 ? v5 / v60 : null,
    omsetningMNOK: oms / 20 / 1e6,
  };
}

function leggTilSektor(rader) {
  const per = {};
  for (const r of rader) (per[r.sektor] ||= []).push(r);
  for (const r of rader) {
    const andre = per[r.sektor].filter((x) => x !== r);
    r.f.sektorMom6 = andre.length ? snitt(andre.map((x) => x.f.mom6)) : null;
  }
}

/** Score (rang 0–100) og bidrag per faktor. */
export function ukeScore(rader, vekter = UKEMODELL.vekter) {
  const z = {};
  for (const f of Object.keys(vekter)) z[f] = rangering(rader.map((r) => r.f[f])).map((x) => (x == null ? 0 : (x - 0.5) * 2));
  const raa = rader.map((_, i) => Object.keys(vekter).reduce((s, f) => s + vekter[f] * z[f][i], 0));
  const rang = rangering(raa);
  return rader.map((_, i) => ({
    score: rang[i] * 100,
    bidrag: Object.fromEntries(Object.keys(vekter).map((f) => [f, vekter[f] * z[f][i]])),
  }));
}

/** Tverrsnitt på en dato: aksjer som handlet den dagen og er likvide nok. */
function tverrsnitt(aksjer, dato, krevHandelSammeDag = true) {
  const rader = [];
  for (const a of aksjer) {
    const s = a.serie, i = finnIndeks(s.datoer, dato);
    if (i < 0 || (krevHandelSammeDag ? s.datoer[i] !== dato : s.datoer[i] < forskyvDato(dato, -7))) continue;
    const f = ukeFaktorer(s, i, a.h);
    if (f && f.omsetningMNOK >= UKEMODELL.minOmsetningMNOK) rader.push({ t: a.t, sektor: a.sektor, f, i, a });
  }
  leggTilSektor(rader);
  return rader;
}

/** Nye beholdninger: behold de som fortsatt er blant topp antall+buffer, fyll på med de beste. */
function velg(rangert, forrige, { antall, buffer, maksPerSektor = Infinity }) {
  const plass = new Map(rangert.map((r, k) => [r.t, k]));
  const sektor = new Map(rangert.map((r) => [r.t, r.sektor]));
  const ny = forrige.filter((t) => plass.has(t) && plass.get(t) < antall + buffer);
  const iSektor = (sek) => ny.filter((t) => sektor.get(t) === sek).length;
  for (const r of rangert) {
    if (ny.length >= antall) break;
    if (!ny.includes(r.t) && iSektor(r.sektor) < maksPerSektor) ny.push(r.t);
  }
  return ny;
}

/**
 * Historisk test fredag til fredag, og dagens anbefaling (som fortsetter porteføljen fra testen).
 * aksjer: [{t, sektor, serie, h}], indeks: kursserie for OSEBX
 */
export function ukesvalg(aksjer, indeks) {
  const m = UKEMODELL;
  const fredager = indeks.datoer.filter((d, k) => k >= 270 && new Date(d).getUTCDay() === 5);
  let hold = [], v = 1, ix = 1, uker = 0, slaar = 0, bytter = 0;
  const kurve = [], valgteAvk = [];
  for (let u = 0; u < fredager.length - 1; u++) {
    const d0 = fredager[u], d1 = fredager[u + 1];
    const rader = tverrsnitt(aksjer, d0);
    if (rader.length < 20) continue;
    const sc = ukeScore(rader);
    const rangert = rader.map((r, k) => ({ ...r, score: sc[k].score })).sort((a, b) => b.score - a.score);
    const ny = velg(rangert, hold, m);
    const byttet = ny.filter((t) => !hold.includes(t)).length;
    hold = ny;
    const avkFor = (t) => {
      const r = rader.find((x) => x.t === t), s = r.a.serie, j = finnIndeks(s.datoer, d1);
      if ((s.brudd || []).some((b) => b > r.i && b <= j)) return 0;
      return j > r.i ? s.just[j] / s.just[r.i] - 1 : 0;
    };
    const ixAvk = indeks.just[finnIndeks(indeks.datoer, d1)] / indeks.just[finnIndeks(indeks.datoer, d0)] - 1;
    const enkelt = hold.map(avkFor);
    for (const x of enkelt) valgteAvk.push(x - ixAvk);
    const avk = snitt(enkelt) - (byttet / m.antall) * m.kostnad;
    if (!kurve.length) kurve.push({ dato: d0, modell: 1, osebx: 1 });
    v *= 1 + avk; ix *= 1 + ixAvk; uker++; bytter += byttet;
    if (avk > ixAvk) slaar++;
    kurve.push({ dato: d1, modell: Math.round(v * 1e4) / 1e4, osebx: Math.round(ix * 1e4) / 1e4 });
  }
  const aar = uker / 52;
  const stat = (felt) => {
    let topp = 0, fall = 0;
    for (const p of kurve) { topp = Math.max(topp, p[felt]); fall = Math.min(fall, p[felt] / topp - 1); }
    return { aarlig: kurve.at(-1)[felt] ** (1 / aar) - 1, totalt: kurve.at(-1)[felt] - 1, maksFall: fall };
  };

  // Dagens anbefaling: fortsett fra siste fredags portefølje
  const idag = indeks.datoer.at(-1);
  const rader = tverrsnitt(aksjer, idag, false);
  const sc = ukeScore(rader);
  const rangert = rader.map((r, k) => ({ ...r, score: sc[k].score, bidrag: sc[k].bidrag })).sort((a, b) => b.score - a.score);
  // Porteføljen fra siste valg i testen er utgangspunktet; dagens valg bytter bare det som har falt ut
  const forrige = hold;
  const valgt = velg(rangert, forrige, m);

  return {
    test: {
      fra: kurve[0].dato, til: kurve.at(-1).dato, uker, aar: Math.round(aar * 10) / 10,
      modell: stat("modell"), osebx: stat("osebx"),
      andelUkerSlaarIndeks: slaar / uker,
      bytterPerUke: bytter / uker,
      snittValgtMotIndeks: snitt(valgteAvk),
      andelValgtSlaarIndeks: valgteAvk.filter((x) => x > 0).length / valgteAvk.length,
      kurve,
    },
    valgt,
    forrige,
    perAksje: Object.fromEntries(
      rangert.map((r, k) => [r.t, { score: Math.round(r.score * 10) / 10, plass: k + 1, f: r.f, bidrag: r.bidrag }]),
    ),
  };
}
