// Børsradar – henter kurser og nøkkeltall for Oslo Børs, regner ut signaler
// (KJØP / HOLD / SELG) og tester den tekniske modellen historisk.
//
// Kjør:  node borsradar/analyse/analyser.mjs [utfil]
// Standard utfil er borsradar/data/analyse.json. Ingen avhengigheter utover Node 18+.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HER = dirname(fileURLToPath(import.meta.url));
const UTFIL = process.argv[2] || join(HER, "..", "data", "analyse.json");
const INDEKS = "OSEBX.OL";
const UA = "Mozilla/5.0 (compatible; borsradar/1.0)";

// Modellparametre – brukes både i dagens analyse og i den historiske testen
// Vektene bygger på faktoranalyse av Oslo Børs 2017–2026: 6–12 mnd momentum og trend har
// gitt meravkastning, mens lav volatilitet, nærhet til toppen, RSI og 1-mnd reversering ikke har det.
export const VEKTER_TEKNISK = { mom12_1: 0.35, mom6: 0.25, trend: 0.25, mom3: 0.15 };
export const VEKTER_FUNDAMENTAL = { inntjening: 0.35, bok: 0.2, utbytte: 0.25, roe: 0.2 };
const ANDEL_TEKNISK = 0.7; // samlet score = 70 % teknisk + 30 % fundamental
const KJOP_GRENSE = 70;
const SELG_GRENSE = 30;
const MIN_OMSETNING_MNOK = 5; // under dette regnes aksjen som lite likvid
const BT_ANTALL = 10; // antall aksjer i testporteføljen
const BT_KURTASJE = 0.001; // 0,1 % per kjøp/salg

// ---------- Henting ----------

async function hentJson(url, forsok = 4) {
  for (let i = 0; i < forsok; i++) {
    try {
      const svar = await fetch(url, { headers: { "User-Agent": UA } });
      if (svar.status === 404) return null;
      if (!svar.ok) throw new Error(`HTTP ${svar.status}`);
      return await svar.json();
    } catch (feil) {
      if (i === forsok - 1) throw feil;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
}

export async function hentKurser(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=10y&interval=1d&events=div%7Csplit`;
  const data = await hentJson(url);
  const r = data?.chart?.result?.[0];
  if (!r?.timestamp) return null;
  const q = r.indicators.quote[0];
  const adj = r.indicators.adjclose?.[0]?.adjclose || q.close;
  const serie = { datoer: [], kurs: [], just: [], volum: [] };
  r.timestamp.forEach((ts, i) => {
    if (q.close[i] == null || adj[i] == null || q.close[i] <= 0) return;
    serie.datoer.push(new Date((ts + (r.meta.gmtoffset || 0)) * 1000).toISOString().slice(0, 10));
    serie.kurs.push(q.close[i]);
    serie.just.push(adj[i]);
    serie.volum.push(q.volume?.[i] || 0);
  });
  serie.utbytte = Object.values(r.events?.dividends || {})
    .map((d) => ({ dato: new Date(d.date * 1000).toISOString().slice(0, 10), belop: d.amount }))
    .sort((a, b) => a.dato.localeCompare(b.dato));
  serie.valuta = r.meta.currency;
  return serie;
}

async function hentNokkeltall(symbol) {
  const typer = [
    "trailingPeRatio",
    "trailingPbRatio",
    "trailingMarketCap",
    "annualNetIncome",
    "annualStockholdersEquity",
  ];
  const naa = Math.floor(Date.now() / 1000);
  const url = `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?type=${typer.join(",")}&period1=${naa - 3 * 365 * 86400}&period2=${naa}`;
  const data = await hentJson(url);
  const ut = {};
  for (const r of data?.timeseries?.result || []) {
    const type = r.meta?.type?.[0];
    const verdier = (r[type] || []).filter((v) => v?.reportedValue?.raw != null);
    if (verdier.length) ut[type] = verdier[verdier.length - 1].reportedValue.raw;
  }
  return ut;
}

async function iParallell(liste, antall, fn) {
  const ut = new Array(liste.length);
  let neste = 0;
  await Promise.all(
    Array.from({ length: antall }, async () => {
      while (neste < liste.length) {
        const i = neste++;
        ut[i] = await fn(liste[i], i);
      }
    }),
  );
  return ut;
}

// ---------- Indikatorer ----------

const snitt = (a) => a.reduce((s, x) => s + x, 0) / a.length;

function rsi(verdier, slutt, periode = 14) {
  const start = Math.max(1, slutt - 120);
  let opp = 0, ned = 0;
  for (let i = start; i < start + periode && i <= slutt; i++) {
    const d = verdier[i] - verdier[i - 1];
    if (d > 0) opp += d; else ned -= d;
  }
  opp /= periode; ned /= periode;
  for (let i = start + periode; i <= slutt; i++) {
    const d = verdier[i] - verdier[i - 1];
    opp = (opp * (periode - 1) + Math.max(d, 0)) / periode;
    ned = (ned * (periode - 1) + Math.max(-d, 0)) / periode;
  }
  return ned === 0 ? 100 : 100 - 100 / (1 + opp / ned);
}

/** Tekniske nøkkeltall for en serie på dag i (bruker bare data t.o.m. dag i). */
export function teknisk(s, i) {
  if (i < 260) return null;
  const p = s.just;
  const sma = (n) => snitt(p.slice(i - n + 1, i + 1));
  const sma50 = sma(50), sma200 = sma(200);
  const logavk = [];
  for (let k = i - 59; k <= i; k++) logavk.push(Math.log(p[k] / p[k - 1]));
  const m = snitt(logavk);
  const vol60 = Math.sqrt(snitt(logavk.map((x) => (x - m) ** 2)) * 252);
  const topp = Math.max(...p.slice(i - 251, i + 1));
  let oms = 0;
  for (let k = i - 19; k <= i; k++) oms += s.kurs[k] * s.volum[k];
  return {
    mom12_1: p[i - 21] / p[i - 252] - 1,
    mom6: p[i] / p[i - 126] - 1,
    mom3: p[i] / p[i - 63] - 1,
    mom1: p[i] / p[i - 21] - 1,
    sma50,
    sma200,
    trend: p[i] / sma200 - 1,
    overSma200: p[i] > sma200,
    overSma50: p[i] > sma50,
    gyllentKors: sma50 > sma200,
    rsi14: rsi(p, i),
    vol60,
    fraTopp: p[i] / topp - 1,
    omsetningMNOK: oms / 20 / 1e6,
  };
}

/** Prosentil (0–100) for hver verdi i lista. null-verdier gir null. */
function prosentil(verdier) {
  const gyldige = verdier.map((v, i) => [v, i]).filter(([v]) => v != null && Number.isFinite(v)).sort((a, b) => a[0] - b[0]);
  const ut = verdier.map(() => null);
  const n = gyldige.length;
  for (let k = 0; k < n; ) {
    let j = k;
    while (j + 1 < n && gyldige[j + 1][0] === gyldige[k][0]) j++;
    const rang = n === 1 ? 50 : (((k + j) / 2) / (n - 1)) * 100;
    for (let x = k; x <= j; x++) ut[gyldige[x][1]] = rang;
    k = j + 1;
  }
  return ut;
}

function vektetSum(deler, vekter) {
  let sum = 0, vekt = 0;
  for (const [navn, w] of Object.entries(vekter)) {
    if (deler[navn] == null) continue;
    sum += deler[navn] * w;
    vekt += w;
  }
  return vekt > 0 ? sum / vekt : null;
}

/** Tekniske delscorer (prosentiler) for et tverrsnitt av aksjer. */
export function tekniskeScorer(tekListe) {
  const kol = (f) => prosentil(tekListe.map((t) => (t ? f(t) : null)));
  const p = {
    mom12_1: kol((t) => t.mom12_1),
    mom6: kol((t) => t.mom6),
    mom3: kol((t) => t.mom3),
    trend: kol((t) => t.trend + (t.overSma50 ? 0.02 : 0) + (t.gyllentKors ? 0.02 : 0)),
  };
  return tekListe.map((t, i) => {
    if (!t) return null;
    const deler = Object.fromEntries(Object.keys(p).map((k) => [k, p[k][i]]));
    return { score: vektetSum(deler, VEKTER_TEKNISK), deler };
  });
}

export function signal(score, t) {
  const nedtrend = !t.overSma200 && !t.gyllentKors && t.mom12_1 < 0;
  if (score >= KJOP_GRENSE && t.overSma200 && !nedtrend) return "KJØP";
  if (score <= SELG_GRENSE || nedtrend) return "SELG";
  return "HOLD";
}

/** Indeks for siste handelsdag på eller før dato. */
export function finnIndeks(datoer, dato) {
  let lo = 0, hi = datoer.length - 1, svar = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (datoer[mid] <= dato) { svar = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return svar;
}

// ---------- Historisk test ----------

function historiskTest(aksjer, indeks) {
  // Siste handelsdag i hver måned
  const mndSlutt = [];
  for (let i = 0; i < indeks.datoer.length; i++) {
    const neste = indeks.datoer[i + 1];
    if (!neste || neste.slice(0, 7) !== indeks.datoer[i].slice(0, 7)) mndSlutt.push(indeks.datoer[i]);
  }
  // Siste "måned" kan være uferdig; bruk siste dag som sluttpunkt
  // Første år går med til å bygge opp historikk (12-måneders momentum)
  const datoer = mndSlutt.filter((d) => d >= indeks.datoer[270]);

  let strategi = 1, osebx = 1, likevekt = 1;
  let forrige = new Set();
  const kurve = [{ dato: datoer[0], strategi: 1, osebx: 1, likevekt: 1 }];
  const grupper = { KJØP: [], HOLD: [], SELG: [] };
  let treff = 0, antallKjop = 0, mndSlaar = 0;
  const mndAvk = [];

  for (let m = 0; m < datoer.length - 1; m++) {
    const d0 = datoer[m], d1 = datoer[m + 1];
    const rader = [];
    for (const a of aksjer) {
      const i0 = finnIndeks(a.serie.datoer, d0);
      const i1 = finnIndeks(a.serie.datoer, d1);
      // Aksjen må ha handlet nylig for å være med
      if (i0 < 0 || i1 <= i0 || a.serie.datoer[i0] < forskyvDato(d0, -7)) continue;
      const t = teknisk(a.serie, i0);
      if (!t || t.omsetningMNOK < MIN_OMSETNING_MNOK) continue;
      rader.push({ t: a.t, tek: t, avk: a.serie.just[i1] / a.serie.just[i0] - 1 });
    }
    if (rader.length < 15) continue;
    const scorer = tekniskeScorer(rader.map((r) => r.tek));
    rader.forEach((r, k) => { r.score = scorer[k].score; r.signal = signal(r.score, r.tek); });

    const idxAvk = indeks.just[finnIndeks(indeks.datoer, d1)] / indeks.just[finnIndeks(indeks.datoer, d0)] - 1;
    for (const r of rader) {
      grupper[r.signal].push(r.avk);
      if (r.signal === "KJØP") { antallKjop++; if (r.avk > idxAvk) treff++; }
    }

    const valgt = rader.filter((r) => r.signal === "KJØP").sort((a, b) => b.score - a.score).slice(0, BT_ANTALL);
    const nye = new Set(valgt.map((r) => r.t));
    // Hver posisjon er 1/BT_ANTALL av porteføljen; kurtasje på alt som selges og kjøpes
    const ut = [...forrige].filter((t) => !nye.has(t)).length;
    const inn = [...nye].filter((t) => !forrige.has(t)).length;
    const omsetning = (ut + inn) / BT_ANTALL;
    const pAvk = valgt.length ? snitt(valgt.map((r) => r.avk)) * (valgt.length / BT_ANTALL) : 0; // tomme plasser = kontanter
    const netto = pAvk - omsetning * BT_KURTASJE;
    forrige = nye;

    strategi *= 1 + netto;
    osebx *= 1 + idxAvk;
    likevekt *= 1 + snitt(rader.map((r) => r.avk));
    if (netto > idxAvk) mndSlaar++;
    mndAvk.push({ netto, idxAvk });
    kurve.push({ dato: d1, strategi, osebx, likevekt });
  }

  const aar = (new Date(kurve.at(-1).dato) - new Date(kurve[0].dato)) / (365.25 * 86400e3);
  const stat = (felt) => {
    let topp = 0, maksFall = 0;
    for (const p of kurve) { topp = Math.max(topp, p[felt]); maksFall = Math.min(maksFall, p[felt] / topp - 1); }
    return { totalt: kurve.at(-1)[felt] - 1, aarlig: kurve.at(-1)[felt] ** (1 / aar) - 1, maksFall };
  };
  const gruppeStat = Object.fromEntries(
    Object.entries(grupper).map(([g, v]) => [g, { antall: v.length, snittMnd: v.length ? snitt(v) : null, andelPositiv: v.length ? v.filter((x) => x > 0).length / v.length : null }]),
  );
  return {
    fra: kurve[0].dato,
    til: kurve.at(-1).dato,
    aar: rund(aar, 1),
    antallMnd: mndAvk.length,
    beskrivelse: `Hver måned kjøpes de ${BT_ANTALL} KJØP-aksjene med høyest teknisk score (likt vektet, ${String(BT_KURTASJE * 100).replace(".", ",")} % kurtasje per handel). Ledige plasser står i kontanter.`,
    strategi: stat("strategi"),
    osebx: stat("osebx"),
    likevekt: stat("likevekt"),
    andelMndSlaarIndeks: mndAvk.length ? mndSlaar / mndAvk.length : null,
    kjopTreffrate: antallKjop ? treff / antallKjop : null,
    signalgrupper: gruppeStat,
    kurve: kurve.map((p) => ({ dato: p.dato, strategi: rund(p.strategi, 4), osebx: rund(p.osebx, 4), likevekt: rund(p.likevekt, 4) })),
  };
}

function forskyvDato(dato, dager) {
  return new Date(new Date(dato).getTime() + dager * 86400e3).toISOString().slice(0, 10);
}

function rund(x, des = 2) {
  if (x == null || !Number.isFinite(x)) return null;
  const f = 10 ** des;
  return Math.round(x * f) / f;
}

// ---------- Begrunnelser ----------

const pst = (x) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1).replace(".", ",")} %`;

function begrunnelse(a) {
  const t = a.tek, f = a.fund, pluss = [], minus = [];
  if (t.mom12_1 > 0.15) pluss.push(`Sterk 12-måneders utvikling (${pst(t.mom12_1)})`);
  else if (t.mom12_1 < -0.1) minus.push(`Svak 12-måneders utvikling (${pst(t.mom12_1)})`);
  if (t.overSma200 && t.gyllentKors) pluss.push("Stigende trend: kurs over 200-dagers snitt, og 50-dagers over 200-dagers");
  else if (!t.overSma200 && !t.gyllentKors) minus.push("Fallende trend: kurs under 200-dagers snitt, og 50-dagers under 200-dagers");
  else if (!t.overSma200) minus.push("Kursen er under 200-dagers snitt");
  if (a.relStyrke6m > 0.1) pluss.push(`Slår Oslo Børs med ${pst(a.relStyrke6m)} siste 6 mnd`);
  else if (a.relStyrke6m < -0.1) minus.push(`Henger etter Oslo Børs med ${pst(a.relStyrke6m)} siste 6 mnd`);
  if (t.rsi14 > 75) minus.push(`Overkjøpt på kort sikt (RSI ${t.rsi14.toFixed(0)})`);
  else if (t.rsi14 < 30) pluss.push(`Oversolgt på kort sikt (RSI ${t.rsi14.toFixed(0)}) – kan gi rekyl`);
  if (t.fraTopp < -0.3) minus.push(`${pst(t.fraTopp)} fra 52-ukers topp`);
  else if (t.fraTopp > -0.03) pluss.push("Handles nær 52-ukers topp");
  if (t.vol60 > 0.55) minus.push(`Svært høye kurssvingninger (${(t.vol60 * 100).toFixed(0)} % årlig)`);
  if (f.pe != null && f.pe > 0 && f.pe < 10) pluss.push(`Lav P/E (${f.pe.toFixed(1).replace(".", ",")})`);
  else if (f.pe != null && f.pe > 35) minus.push(`Høy P/E (${f.pe.toFixed(1).replace(".", ",")})`);
  if (f.negativtResultat) minus.push("Negativt resultat siste år");
  if (f.utbytte != null && f.utbytte > 0.06) pluss.push(`Høy direkteavkastning (${(f.utbytte * 100).toFixed(1).replace(".", ",")} %)`);
  if (f.roe != null && f.roe > 0.15) pluss.push(`God lønnsomhet (egenkapitalavkastning ${(f.roe * 100).toFixed(0)} %)`);
  if (t.omsetningMNOK < MIN_OMSETNING_MNOK) minus.push(`Lite omsatt (${t.omsetningMNOK.toFixed(1).replace(".", ",")} MNOK per dag) – kan være vanskelig å handle`);
  return { pluss, minus };
}

// ---------- Hovedløp ----------

async function main() {
  const liste = JSON.parse(await readFile(join(HER, "tickere.json"), "utf8"));
  console.log(`Henter ${INDEKS} …`);
  const indeks = await hentKurser(INDEKS);
  if (!indeks) throw new Error("Fant ikke indeksdata");

  console.log(`Henter ${liste.length} aksjer …`);
  const feilet = [];
  const aksjer = (
    await iParallell(liste, 4, async (a) => {
      try {
        const [serie, nokkel] = await Promise.all([hentKurser(`${a.t}.OL`), hentNokkeltall(`${a.t}.OL`).catch(() => ({}))]);
        if (!serie || serie.datoer.length < 270) { feilet.push(a.t); return null; }
        return { ...a, serie, nokkel };
      } catch (feil) {
        console.warn(`  ${a.t}: ${feil.message}`);
        feilet.push(a.t);
        return null;
      }
    })
  ).filter(Boolean);
  console.log(`  OK: ${aksjer.length}, feilet: ${feilet.join(", ") || "ingen"}`);

  // Dagens analyse – bare aksjer som har handlet siste 10 dager
  const sisteDag = indeks.datoer.at(-1);
  const iIdx = indeks.datoer.length - 1;
  const idxMom6 = indeks.just[iIdx] / indeks.just[iIdx - 126] - 1;
  const aktive = aksjer.filter((a) => a.serie.datoer.at(-1) >= forskyvDato(sisteDag, -10));
  for (const a of aktive) {
    const s = a.serie, i = s.datoer.length - 1;
    a.tek = teknisk(s, i);
    a.relStyrke6m = a.tek.mom6 - idxMom6;
    const n = a.nokkel;
    const ettAarSiden = forskyvDato(s.datoer[i], -365);
    const utbytteSum = s.utbytte.filter((d) => d.dato > ettAarSiden).reduce((x, d) => x + d.belop, 0);
    const pe = n.trailingPeRatio ?? null;
    const negativt = n.annualNetIncome != null && n.annualNetIncome < 0;
    a.fund = {
      pe,
      pb: n.trailingPbRatio ?? null,
      markedsverdiMrd: n.trailingMarketCap ? n.trailingMarketCap / 1e9 : null,
      utbytte: utbytteSum > 0 ? Math.min(utbytteSum / s.kurs[i], 0.3) : 0,
      roe: n.annualNetIncome != null && n.annualStockholdersEquity > 0 ? n.annualNetIncome / n.annualStockholdersEquity : null,
      negativtResultat: negativt,
      // Inntjeningsavkastning (1/PE); tap gir negativ verdi
      inntjening: negativt ? -0.05 : pe != null && pe > 0 ? 1 / pe : null,
    };
  }
  const tek = tekniskeScorer(aktive.map((a) => a.tek));
  const fp = {
    inntjening: prosentil(aktive.map((a) => a.fund.inntjening)),
    bok: prosentil(aktive.map((a) => (a.fund.pb > 0 ? 1 / a.fund.pb : null))),
    utbytte: prosentil(aktive.map((a) => a.fund.utbytte)),
    roe: prosentil(aktive.map((a) => (a.fund.roe != null ? Math.max(-1, Math.min(1, a.fund.roe)) : null))),
  };

  const resultat = aktive.map((a, k) => {
    const s = a.serie, i = s.datoer.length - 1;
    const fundDeler = Object.fromEntries(Object.keys(fp).map((n) => [n, fp[n][k]]));
    const fundScore = vektetSum(fundDeler, VEKTER_FUNDAMENTAL);
    const score = fundScore == null ? tek[k].score : ANDEL_TEKNISK * tek[k].score + (1 - ANDEL_TEKNISK) * fundScore;
    const n0 = Math.max(0, i - 251);
    const sma = (n, j) => (j >= n - 1 ? snitt(s.kurs.slice(j - n + 1, j + 1)) : null);
    return {
      t: a.t,
      navn: a.navn,
      sektor: a.sektor,
      valuta: s.valuta,
      kurs: rund(s.kurs[i], 2),
      dato: s.datoer[i],
      endringDag: rund(s.kurs[i] / s.kurs[i - 1] - 1, 4),
      signal: signal(score, a.tek),
      score: rund(score, 1),
      tekniskScore: rund(tek[k].score, 1),
      fundamentalScore: rund(fundScore, 1),
      delscorer: Object.fromEntries(Object.entries({ ...tek[k].deler, ...fundDeler }).map(([n, v]) => [n, rund(v, 0)])),
      tek: {
        mom12_1: rund(a.tek.mom12_1, 4), mom6: rund(a.tek.mom6, 4), mom3: rund(a.tek.mom3, 4), mom1: rund(a.tek.mom1, 4),
        rsi14: rund(a.tek.rsi14, 1), vol60: rund(a.tek.vol60, 3), fraTopp: rund(a.tek.fraTopp, 4),
        overSma200: a.tek.overSma200, overSma50: a.tek.overSma50, gyllentKors: a.tek.gyllentKors,
        omsetningMNOK: rund(a.tek.omsetningMNOK, 1), relStyrke6m: rund(a.relStyrke6m, 4),
      },
      fund: {
        pe: rund(a.fund.pe, 1), pb: rund(a.fund.pb, 2), utbytte: rund(a.fund.utbytte, 4),
        roe: rund(a.fund.roe, 3), markedsverdiMrd: rund(a.fund.markedsverdiMrd, 1),
      },
      begrunnelse: begrunnelse(a),
      // Kursgraf siste år (vanlig kurs, ikke utbyttejustert)
      graf: {
        datoer: s.datoer.slice(n0),
        kurs: s.kurs.slice(n0).map((x) => rund(x, 2)),
        sma50: s.kurs.slice(n0).map((_, j) => rund(sma(50, n0 + j), 2)),
        sma200: s.kurs.slice(n0).map((_, j) => rund(sma(200, n0 + j), 2)),
      },
    };
  });
  resultat.sort((a, b) => b.score - a.score);

  console.log("Kjører historisk test …");
  const test = historiskTest(aksjer, indeks);

  const ut = {
    generert: new Date().toISOString(),
    handelsdag: sisteDag,
    indeks: {
      navn: "Oslo Børs hovedindeks (OSEBX)",
      verdi: rund(indeks.kurs[iIdx], 2),
      endringDag: rund(indeks.kurs[iIdx] / indeks.kurs[iIdx - 1] - 1, 4),
      mom6: rund(idxMom6, 4),
      mom12: rund(indeks.just[iIdx] / indeks.just[iIdx - 252] - 1, 4),
      overSma200: indeks.just[iIdx] > snitt(indeks.just.slice(iIdx - 199, iIdx + 1)),
    },
    modell: {
      vekterTeknisk: VEKTER_TEKNISK,
      vekterFundamental: VEKTER_FUNDAMENTAL,
      andelTeknisk: ANDEL_TEKNISK,
      kjopGrense: KJOP_GRENSE,
      selgGrense: SELG_GRENSE,
      minOmsetningMNOK: MIN_OMSETNING_MNOK,
    },
    mangler: feilet,
    aksjer: resultat,
    historiskTest: test,
  };
  await mkdir(dirname(UTFIL), { recursive: true });
  await writeFile(UTFIL, JSON.stringify(ut));
  const telle = (s) => resultat.filter((r) => r.signal === s).length;
  console.log(`Ferdig: ${resultat.length} aksjer – KJØP ${telle("KJØP")}, HOLD ${telle("HOLD")}, SELG ${telle("SELG")} → ${UTFIL}`);
  console.log(
    `Historisk test ${test.fra}–${test.til}: strategi ${pst(test.strategi.aarlig)}/år, OSEBX ${pst(test.osebx.aarlig)}/år, maks fall ${pst(test.strategi.maksFall)} vs ${pst(test.osebx.maksFall)}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((feil) => {
    console.error(feil);
    process.exit(1);
  });
}
