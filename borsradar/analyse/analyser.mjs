// Børsradar – analyserer aksjer på Oslo Børs for kort (1–3 mnd) og lang (6–12 mnd) sikt.
//
// Henter kurser, nøkkeltall og analytikerdata (Yahoo Finance) og børsmeldinger og
// innsidehandel (Oslo Børs Newsweb). Regner ut ca. 30 faktorer, gir hver aksje en score
// per horisont og tester modellene måned for måned bakover i tid.
//
// Kjør:  node borsradar/analyse/analyser.mjs [utfil]
// Standard utfil er borsradar/data/analyse.json. Ingen avhengigheter utover Node 18+.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { hentKurser, harBrudd, skjotBrudd, hentNokkeltall, hentAnalytikere, hentMeldinger, hentMeldingstekst, iParallell, KATEGORI } from "./kilder.mjs";
import { raaFaktorer, forberedHendelser, tverrsnittFaktorer, finnIndeks, forskyvDato, rangering, snitt, FAKTORER } from "./faktorer.mjs";
import { icHistorikk, beregnVekter, scor, MODELLER, MIN_MND, signalFor, KJOP_GRENSE, SELG_GRENSE } from "./modell.mjs";
import { tolkInnsidemelding } from "./innside.mjs";

const HER = dirname(fileURLToPath(import.meta.url));
const DATA = join(HER, "..", "data");
const UTFIL = process.argv[2] || join(DATA, "analyse.json");
const INNSIDEFIL = join(DATA, "innsidehandel.json");
const MELDINGER_FRA = "2016-01-01";
const MIN_OMSETNING_MNOK = 5; // aksjer med mindre daglig omsetning tas ikke med i testporteføljene
const ANTALL = 10; // aksjer i testporteføljene
const KOSTNAD = 0.004; // kurtasje + spread per utbyttet posisjon (kjøp og salg)
const ALLE_FAKTORER = Object.keys(FAKTORER);

const rund = (x, des = 2) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** des) / 10 ** des);
const idag = () => new Date().toISOString().slice(0, 10);

// ---------- Innhenting ----------

async function hentAlt(liste) {
  console.log("Henter kurser …");
  const [indeks, olje, usd] = await Promise.all([hentKurser("OSEBX.OL"), hentKurser("BZ=F"), hentKurser("NOK=X")]);
  if (!indeks) throw new Error("Fant ikke indeksdata");
  const feilet = [];
  const serier = await iParallell(liste, 6, async (a) => {
    try {
      const s = await hentKurser(`${a.t}.OL`);
      if (!s || s.datoer.length < 270) feilet.push(a.t);
      return s && s.datoer.length >= 270 ? s : null;
    } catch {
      feilet.push(a.t);
      return null;
    }
  });

  console.log("Henter børsmeldinger fra Newsweb …");
  const meldinger = await iParallell(liste, 6, (a) => hentMeldinger({ fra: MELDINGER_FRA, til: idag(), utsteder: a.t }).catch(() => []));

  // Innsidehandel: meldingene må leses for å se om det er kjøp eller salg. Tolkede meldinger lagres.
  let innsideLager = [];
  try { innsideLager = JSON.parse(await readFile(INNSIDEFIL, "utf8")); } catch { /* første kjøring */ }
  const kjente = new Set(innsideLager.map((x) => x.id));
  const nye = meldinger.flat().filter((m) => m.kategori.includes(KATEGORI.innsidehandel) && !kjente.has(m.id));
  console.log(`Tolker ${nye.length} nye innsidemeldinger …`);
  const tolket = await iParallell(nye, 8, async (m) => {
    try {
      return { id: m.id, dato: m.dato.slice(0, 10), t: m.utsteder, type: tolkInnsidemelding(m.tittel, await hentMeldingstekst(m.id)) };
    } catch {
      return null;
    }
  });
  innsideLager = [...innsideLager, ...tolket.filter(Boolean)].sort((a, b) => a.dato.localeCompare(b.dato) || a.id - b.id);
  await mkdir(DATA, { recursive: true });
  await writeFile(INNSIDEFIL, JSON.stringify(innsideLager).replace(/\},\{/g, "},\n{"));

  console.log("Henter nøkkeltall og analytikerdata …");
  const nokkel = await iParallell(liste, 4, (a) => hentNokkeltall(`${a.t}.OL`).catch(() => ({})));
  const analytikere = await iParallell(liste, 4, (a) => hentAnalytikere(`${a.t}.OL`).catch(() => null));

  const aksjer = liste
    .map((a, i) => ({
      ...a,
      serie: serier[i],
      meldinger: meldinger[i],
      innside: innsideLager.filter((x) => x.t === a.t),
      nokkel: nokkel[i],
      analytikere: analytikere[i],
    }))
    .filter((a) => a.serie);
  for (const a of aksjer) a.h = forberedHendelser(a.meldinger, a.innside);
  return { aksjer, ctx: { indeks, olje, usd }, feilet };
}

// ---------- Historisk panel ----------

function manedsslutt(datoer) {
  const ut = [];
  for (let i = 0; i < datoer.length; i++) {
    const n = datoer[i + 1];
    if (!n || n.slice(0, 7) !== datoer[i].slice(0, 7)) ut.push(datoer[i]);
  }
  return ut;
}

function byggPanel(aksjer, ctx) {
  const datoer = manedsslutt(ctx.indeks.datoer).filter((d) => d >= ctx.indeks.datoer[262]);
  return datoer.map((d, m) => {
    const rader = [];
    for (const a of aksjer) {
      const s = a.serie, i = finnIndeks(s.datoer, d);
      if (i < 260 || s.datoer[i] < forskyvDato(d, -10)) continue;
      const f = raaFaktorer(s, i, a.h, ctx);
      if (!f || f.omsetningMNOK < 3) continue;
      const fw = {};
      for (const h of [1, 3, 12]) {
        const d2 = datoer[m + h];
        if (!d2) continue;
        const j = finnIndeks(s.datoer, d2);
        if (harBrudd(s, i, j)) { fw[h] = null; continue; }
        fw[h] = j > i ? s.just[j] / s.just[i] - 1 : 0; // ingen handel = 0 (f.eks. suspendert)
      }
      rader.push({ t: a.t, sektor: a.sektor, f, fw });
    }
    tverrsnittFaktorer(rader);
    const ix = ctx.indeks, j0 = finnIndeks(ix.datoer, d), j1 = datoer[m + 1] ? finnIndeks(ix.datoer, datoer[m + 1]) : null;
    return { dato: d, rader, indeksNeste: j1 != null ? ix.just[j1] / ix.just[j0] - 1 : null };
  });
}

// ---------- Historisk test av en modell ----------

function testModell(panel, modell) {
  const { h } = modell;
  // vekter kan være faste eller en funksjon av måneden (selvlærende modell)
  const vekterFor = typeof modell.vekter === "function" ? modell.vekter : () => modell.vekter;
  const kurve = [];
  let v = 1, ix = 1, lik = 1, forrige = new Set();
  const kohorter = [];
  const grupper = { KJØP: [], HOLD: [], SELG: [] };
  let slaar = 0, mnd = 0;
  for (let m = 0; m < panel.length - 1; m++) {
    const p = panel[m];
    const r = p.rader.filter((x) => x.f.omsetningMNOK >= MIN_OMSETNING_MNOK && x.fw[1] != null);
    if (r.length < 20 || p.indeksNeste == null) continue;
    const vekter = vekterFor(m);
    if (!vekter) continue;
    const s = scor(r, vekter, ALLE_FAKTORER);
    const ord = r.map((x, k) => ({ x, score: s[k].score })).sort((a, b) => b.score - a.score);
    const valgt = ord.slice(0, ANTALL).map((o) => o.x.t);
    let avk;
    if (h === 1) {
      const nye = new Set(valgt);
      const byttet = valgt.filter((t) => !forrige.has(t)).length;
      forrige = nye;
      avk = snitt(valgt.map((t) => p.rader.find((x) => x.t === t).fw[1])) - (byttet / ANTALL) * KOSTNAD;
    } else {
      // Lang sikt: hver måned kjøpes en ny pakke som holdes i 12 måneder (1/12 av porteføljen byttes)
      kohorter.push(valgt);
      const aktive = kohorter.slice(-12);
      avk = snitt(aktive.map((k) => snitt(k.map((t) => p.rader.find((x) => x.t === t)?.fw[1] ?? 0)))) - KOSTNAD / 12;
    }
    for (const o of ord) {
      const fw = o.x.fw[h];
      if (fw == null) continue;
      grupper[signalFor(o.score, o.x.f)].push(fw - (h === 1 ? p.indeksNeste : 0));
    }
    if (!kurve.length) kurve.push({ dato: p.dato, modell: 1, osebx: 1, likevekt: 1 });
    v *= 1 + avk;
    ix *= 1 + p.indeksNeste;
    lik *= 1 + snitt(r.map((x) => x.fw[1]));
    mnd++;
    if (avk > p.indeksNeste) slaar++;
    kurve.push({ dato: panel[m + 1].dato, modell: rund(v, 4), osebx: rund(ix, 4), likevekt: rund(lik, 4) });
  }
  const aar = mnd / 12;
  const stat = (felt) => {
    let topp = 0, fall = 0;
    for (const p of kurve) { topp = Math.max(topp, p[felt]); fall = Math.min(fall, p[felt] / topp - 1); }
    return { aarlig: rund(kurve.at(-1)[felt] ** (1 / aar) - 1, 4), totalt: rund(kurve.at(-1)[felt] - 1, 4), maksFall: rund(fall, 4) };
  };
  // Snittavkastning for aksjer med hvert signal (over indeksen for kort sikt; absolutt 12 mnd for lang)
  const gruppeStat = Object.fromEntries(
    Object.entries(grupper).map(([g, l]) => [g, { antall: l.length, snitt: rund(snitt(l), 4), andelPositiv: l.length ? rund(l.filter((x) => x > 0).length / l.length, 3) : null }]),
  );
  return {
    fra: kurve[0].dato,
    til: kurve.at(-1).dato,
    aar: rund(aar, 1),
    modell: stat("modell"),
    osebx: stat("osebx"),
    likevekt: stat("likevekt"),
    andelMndSlaarIndeks: rund(slaar / mnd, 3),
    signalgrupper: gruppeStat,
    gruppeMaal: h === 1 ? "meravkastning mot OSEBX neste måned" : "avkastning neste 12 måneder",
    kurve,
  };
}

// ---------- Faktorstudie (for visning: hva har virket på Oslo Børs) ----------

function faktorstudie(panel) {
  const res = {};
  for (const h of [1, 12]) {
    const ic = icHistorikk(panel, ALLE_FAKTORER, h).filter(Boolean);
    for (const f of ALLE_FAKTORER) {
      const v = ic.map((x) => x[f]);
      const m = snitt(v), sd = Math.sqrt(snitt(v.map((x) => (x - m) ** 2)));
      (res[f] ||= {})[`ic${h}`] = rund(m, 3);
      res[f][`t${h}`] = rund(sd > 0 ? (m / sd) * Math.sqrt(v.length / h) : 0, 1);
    }
  }
  // Hendelser: meravkastning for aksjer med hendelsen mot snittet av alle (neste 1 og 3 mnd)
  const hendelser = {
    innsideKjop: (f) => f.innsideKjop90 >= 1,
    innsideKjop3: (f) => f.innsideKjop90 >= 3,
    innsideSalg: (f) => f.innsideSalg90 >= 2,
    tilbakekjop: (f) => f.tilbakekjop90 >= 1,
    kontrakter: (f) => f.kontrakter60 >= 3,
    emisjon: (f) => f.emisjon60 >= 1,
    varsel: (f) => f.varsler60 >= 1,
    oppkjop: (f) => f.oppkjop90 >= 1,
    nyhetPositiv: (f) => f.nyhetsreaksjon > 0.05,
    nyhetNegativ: (f) => f.nyhetsreaksjon < -0.05,
    rapportPositiv: (f) => f.rapportreaksjon > 0.05,
    rapportNegativ: (f) => f.rapportreaksjon < -0.05,
  };
  const studie = {};
  for (const [navn, fn] of Object.entries(hendelser)) {
    studie[navn] = { antall: 0 };
    for (const h of [1, 3]) {
      const diff = [];
      for (const p of panel) {
        const r = p.rader.filter((x) => x.fw[h] != null);
        if (!r.length) continue;
        const m = snitt(r.map((x) => x.fw[h]));
        const e = r.filter((x) => fn(x.f));
        if (h === 1) studie[navn].antall += e.length;
        if (e.length) diff.push(snitt(e.map((x) => x.fw[h] - m)));
      }
      const m = snitt(diff), sd = Math.sqrt(snitt(diff.map((x) => (x - m) ** 2)));
      studie[navn][`mer${h}`] = rund(m, 4);
      studie[navn][`t${h}`] = rund(sd > 0 ? (m / sd) * Math.sqrt(diff.length / h) : 0, 1);
    }
  }
  return { faktorer: res, hendelser: studie };
}

// ---------- Analytiker- og nøkkeltallsdel (bare dagens data) ----------

function analytikerMaal(a, kurs) {
  const an = a.analytikere, n = a.nokkel || {};
  const pe = n.trailingPeRatio ?? null;
  const negativt = n.annualNetIncome != null && n.annualNetIncome < 0;
  return {
    revisjon: an?.revisjon90 ?? an?.revisjon30 ?? null,
    anbefalingEndring: an?.anbefalingNaa && an?.anbefaling3mnd ? an.anbefaling3mnd.snitt - an.anbefalingNaa.snitt : null,
    overraskelse: an?.sisteOverraskelse ?? null,
    kursmalOppside: an?.kursmal && an.antallAnalytikere >= 3 ? an.kursmal / kurs - 1 : null,
    inntjening: negativt ? -0.05 : pe != null && pe > 0 ? 1 / pe : null,
    bok: n.trailingPbRatio > 0 ? 1 / n.trailingPbRatio : null,
    roe: n.annualNetIncome != null && n.annualStockholdersEquity > 0 ? Math.max(-1, Math.min(1, n.annualNetIncome / n.annualStockholdersEquity)) : null,
  };
}

// ---------- Tekster ----------

const pst = (x, des = 1) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(des).replace(".", ",")} %`;

function formaterVerdi(f, v) {
  if (v == null || !Number.isFinite(v)) return "–";
  if (["innsideKjop90", "innsideSalg90", "innsideNetto90", "tilbakekjop90", "emisjon60", "kontrakter60", "varsler60", "oppkjop90"].includes(f)) return `${v}`;
  if (f === "omsetningMNOK") return `${v.toFixed(0)} MNOK/dag`;
  if (f === "volumTrend" || f === "nyhetsmengde") return `${v.toFixed(1).replace(".", ",")}×`;
  if (f === "betaIndeks") return v.toFixed(2).replace(".", ",");
  if (f === "utbytte" || f === "vol60") return `${(v * 100).toFixed(1).replace(".", ",")} %`;
  return pst(v);
}

function begrunnelse(a, f, am) {
  const pluss = [], minus = [];
  const an = a.analytikere;
  if (f.mom12_1 > 0.2) pluss.push(`Sterk kursutvikling siste år (${pst(f.mom12_1, 0)})`);
  else if (f.mom12_1 < -0.15) minus.push(`Svak kursutvikling siste år (${pst(f.mom12_1, 0)})`);
  if (f.overSma200 && f.gyllentKors) pluss.push("Stigende trend (over 50- og 200-dagers snitt)");
  else if (!f.overSma200 && !f.gyllentKors) minus.push("Fallende trend (under 200-dagers snitt)");
  if (f.sektorMom > 0.1) pluss.push(`Medvind i sektoren: ${a.sektor.toLowerCase()} har steget ${pst(f.sektorMom, 0)} siste 6 mnd`);
  else if (f.sektorMom < -0.1) minus.push(`Motvind i sektoren: ${a.sektor.toLowerCase()} har falt ${pst(f.sektorMom, 0)} siste 6 mnd`);
  if (f.innsideKjop90 >= 1) pluss.push(`Innsidere har kjøpt aksjer ${f.innsideKjop90} gang${f.innsideKjop90 > 1 ? "er" : ""} siste 90 dager`);
  if (f.innsideSalg90 >= 2) minus.push(`Innsidere har solgt ${f.innsideSalg90} ganger siste 90 dager`);
  if (f.tilbakekjop90 >= 1) pluss.push("Selskapet kjøper tilbake egne aksjer");
  if (f.kontrakter60 >= 2) pluss.push(`${f.kontrakter60} børsmeldinger om kontrakter/ordre siste 60 dager`);
  if (f.emisjon60 >= 1) minus.push("Emisjon eller kapitalinnhenting siste 60 dager (utvanning)");
  if (f.varsler60 >= 1) minus.push("Negativt varsel siste 60 dager (resultatvarsel, nedskrivning o.l.)");
  if (f.oppkjop90 >= 1) pluss.push("Oppkjøpsbud eller strategisk gjennomgang meldt siste 90 dager");
  if (f.rapportreaksjon > 0.04) pluss.push(`Kursen steg ${pst(f.rapportreaksjon, 0)} mer enn børsen på siste kvartalsrapport`);
  else if (f.rapportreaksjon < -0.04) minus.push(`Kursen falt ${pst(-f.rapportreaksjon, 0).replace("+", "")} mer enn børsen på siste kvartalsrapport`);
  if (f.nyhetsreaksjon > 0.05) pluss.push("Positiv kursreaksjon på nyheter siste måned");
  else if (f.nyhetsreaksjon < -0.05) minus.push("Negativ kursreaksjon på nyheter siste måned");
  if (f.maks > 0.15) minus.push(`Store kurshopp (opptil ${pst(f.maks, 0)} på én dag) – lotteripreg`);
  if (f.utbytte > 0.06) pluss.push(`Høyt utbytte (${(f.utbytte * 100).toFixed(1).replace(".", ",")} % siste 12 mnd)`);
  if (am.revisjon > 0.03) pluss.push(`Analytikerne har oppjustert inntjeningsestimatene (${pst(am.revisjon, 0)} siste 90 dager)`);
  else if (am.revisjon < -0.03) minus.push(`Analytikerne har nedjustert inntjeningsestimatene (${pst(am.revisjon, 0)} siste 90 dager)`);
  if (am.anbefalingEndring > 0.2) pluss.push("Analytikerne er blitt mer positive siste 3 mnd");
  else if (am.anbefalingEndring < -0.2) minus.push("Analytikerne er blitt mer negative siste 3 mnd");
  if (an?.kursmal && an.antallAnalytikere >= 3) {
    const opp = an.kursmal / a.serie.kurs.at(-1) - 1;
    if (opp > 0.15) pluss.push(`Analytikernes kursmål ligger ${Math.round(opp * 100)} % over dagens kurs`);
    else if (opp < -0.1) minus.push(`Analytikernes kursmål ligger ${Math.round(-opp * 100)} % under dagens kurs`);
  }
  if (am.inntjening != null && am.inntjening > 0.1) pluss.push("Lav prising i forhold til inntjeningen (P/E under 10)");
  if (am.inntjening != null && am.inntjening < 0) minus.push("Selskapet gikk med underskudd siste år");
  if (f.omsetningMNOK < MIN_OMSETNING_MNOK) minus.push(`Lite omsatt (${f.omsetningMNOK.toFixed(1).replace(".", ",")} MNOK per dag) – kan være vanskelig å handle`);
  return { pluss, minus };
}

function meldingstype(m, innsideType) {
  if (innsideType) return innsideType === "KJØP" ? "innsidekjøp" : innsideType === "SALG" ? "innsidesalg" : innsideType === "TILBAKEKJØP" ? "tilbakekjøp" : "innside";
  if (m.kategori.includes(1002)) return "rapport";
  if (m.kategori.includes(1007)) return "tilbakekjøp";
  if (m.kategori.includes(1005)) return "innsideinformasjon";
  if (m.kategori.includes(1006)) return "flagging";
  return "melding";
}

// ---------- Hovedløp ----------

async function main() {
  const liste = JSON.parse(await readFile(join(HER, "tickere.json"), "utf8"));
  const { aksjer, ctx, feilet } = await hentAlt(liste);
  console.log(`  ${aksjer.length} aksjer med kurser, mangler: ${feilet.join(", ") || "ingen"}`);

  console.log("Bygger historisk panel og tester modellene …");
  const panel = byggPanel(aksjer, ctx);
  const tester = Object.fromEntries(Object.entries(MODELLER).map(([k, m]) => [k, testModell(panel, m)]));
  // Kontroll uten etterpåklokskap: modellen lærer vektene for alle faktorer selv, bare fra data
  // som var kjent hver måned. Sammenlignes med de faste modellene over samme periode.
  const ic1 = icHistorikk(panel, ALLE_FAKTORER, 1);
  const laerende = testModell(panel, { h: 1, vekter: (m) => (m < MIN_MND ? null : beregnVekter(ic1, m, 1, ALLE_FAKTORER)?.vekter) });
  const kortSammePeriode = testModell(panel, { h: 1, vekter: (m) => (m < MIN_MND ? null : MODELLER.kort.vekter) });
  const kontroll = {
    fra: laerende.fra,
    laerende: { ...laerende.modell, slaarIndeks: laerende.andelMndSlaarIndeks },
    kort: { ...kortSammePeriode.modell, slaarIndeks: kortSammePeriode.andelMndSlaarIndeks },
    osebx: laerende.osebx,
    likevekt: laerende.likevekt,
  };
  const studie = faktorstudie(panel);

  // ----- Dagens tverrsnitt -----
  const sisteDag = ctx.indeks.datoer.at(-1);
  const rader = [];
  for (const a of aksjer) {
    const s = a.serie, i = s.datoer.length - 1;
    if (s.datoer[i] < forskyvDato(sisteDag, -10)) continue;
    let f = raaFaktorer(s, i, a.h, ctx);
    if (!f && harBrudd(s, i - 260, i)) {
      // Nylig spleis eller utdeling som Yahoo ikke har justert for: skjøt serien og prøv igjen
      a.serie = skjotBrudd(s);
      f = raaFaktorer(a.serie, i, a.h, ctx);
    }
    if (f) rader.push({ t: a.t, sektor: a.sektor, f, a });
  }
  tverrsnittFaktorer(rader);
  const am = rader.map((r) => analytikerMaal(r.a, r.a.serie.kurs.at(-1)));

  const modellScore = {};
  for (const [k, m] of Object.entries(MODELLER)) {
    const testet = scor(rader, m.vekter, ALLE_FAKTORER);
    // Analytikerdelen: rang per mål, vektet sum (manglende = nøytral)
    const deler = Object.keys(m.analytikerVekter);
    const rang = Object.fromEntries(deler.map((d) => [d, rangering(am.map((x) => x[d]))]));
    const analytiker = rader.map((_, i) => {
      let sum = 0, vekt = 0;
      for (const d of deler) if (rang[d][i] != null) { sum += rang[d][i] * m.analytikerVekter[d]; vekt += m.analytikerVekter[d]; }
      return vekt > 0 ? (sum / vekt) * 100 : null;
    });
    const samlet = testet.map((t, i) => (analytiker[i] == null ? t.score : (1 - m.andelAnalytikere) * t.score + m.andelAnalytikere * analytiker[i]));
    const endelig = rangering(samlet).map((x) => x * 100);
    modellScore[k] = rader.map((r, i) => ({
      score: rund(endelig[i], 1),
      testetScore: rund(testet[i].score, 1),
      analytikerScore: rund(analytiker[i], 1),
      signal: signalFor(endelig[i], r.f),
      drivere: Object.entries(testet[i].bidrag)
        .map(([f, b]) => ({ f, navn: FAKTORER[f].navn, bidrag: rund(b * 100, 1), verdi: formaterVerdi(f, r.f[f]) }))
        .sort((x, y) => Math.abs(y.bidrag) - Math.abs(x.bidrag)),
    }));
  }
  const samletRang = rangering(rader.map((_, i) => (modellScore.kort[i].score + modellScore.lang[i].score) / 2)).map((x) => x * 100);

  const resultat = rader.map((r, i) => {
    const a = r.a, s = a.serie, n = s.datoer.length - 1, f = r.f, an = a.analytikere;
    const innsideTyper = new Map(a.innside.map((x) => [x.id, x.type]));
    const n0 = Math.max(0, n - 251);
    const sma = (k, j) => (j >= k - 1 ? snitt(s.kurs.slice(j - k + 1, j + 1)) : null);
    const ixI = ctx.indeks.datoer.length - 1;
    return {
      t: a.t,
      navn: a.navn,
      sektor: a.sektor,
      valuta: s.valuta,
      kurs: rund(s.kurs[n], s.kurs[n] < 20 ? 3 : 2),
      dato: s.datoer[n],
      endringDag: rund(s.kurs[n] / s.kurs[n - 1] - 1, 4),
      kursbrudd: Boolean(s.skjotet), // kursene før en nylig spleis/utdeling er justert
      samlet: { score: rund(samletRang[i], 1), signal: signalFor(samletRang[i], f) },
      kort: modellScore.kort[i],
      lang: modellScore.lang[i],
      nokkel: {
        mom1: rund(f.mom1, 4), mom3: rund(f.mom3, 4), mom6: rund(f.mom6, 4), mom12_1: rund(f.mom12_1, 4),
        relStyrke6m: rund(f.mom6 - (ctx.indeks.just[ixI] / ctx.indeks.just[ixI - 126] - 1), 4),
        fraTopp: rund(f.fraTopp, 4), rsi14: rund(f.rsi14, 0), vol60: rund(f.vol60, 3), omsetningMNOK: rund(f.omsetningMNOK, 1),
        overSma200: f.overSma200, overSma50: f.overSma50, gyllentKors: f.gyllentKors,
        betaOlje: rund(f.betaOlje, 2), betaUsd: rund(f.betaUsd, 2), sektorMom: rund(f.sektorMom, 4),
        innsideKjop90: f.innsideKjop90, innsideSalg90: f.innsideSalg90, tilbakekjop90: f.tilbakekjop90,
      },
      fund: {
        pe: rund(a.nokkel?.trailingPeRatio, 1), pb: rund(a.nokkel?.trailingPbRatio, 2), utbytte: rund(f.utbytte, 4),
        roe: rund(am[i].roe, 3), markedsverdiMrd: a.nokkel?.trailingMarketCap ? rund(a.nokkel.trailingMarketCap / 1e9, 1) : null,
      },
      analytikere: an
        ? {
            antall: an.antallAnalytikere, kursmal: rund(an.kursmal, 1), oppside: an.kursmal && an.antallAnalytikere >= 1 ? rund(an.kursmal / s.kurs[n] - 1, 3) : null,
            anbefaling: an.anbefalingNaa, anbefaling3mnd: an.anbefaling3mnd, revisjon90: rund(an.revisjon90, 3), revisjon30: rund(an.revisjon30, 3),
            sisteOverraskelse: rund(an.sisteOverraskelse, 3), nesteRapport: an.nesteRapport,
            oppgraderinger: an.oppgraderinger, nedgraderinger: an.nedgraderinger,
          }
        : null,
      begrunnelse: begrunnelse(a, f, am[i]),
      nyheter: [...a.meldinger]
        .sort((x, y) => y.dato.localeCompare(x.dato))
        .filter((m) => !m.kategori.includes(1105) && !m.kategori.includes(1101)) // rentejusteringer og eks-datoer er støy
        .slice(0, 12)
        .map((m) => ({ id: m.id, dato: m.dato.slice(0, 10), tittel: m.tittel, type: meldingstype(m, innsideTyper.get(m.id)) })),
      graf: {
        datoer: s.datoer.slice(n0),
        kurs: s.kurs.slice(n0).map((x) => rund(x, 2)),
        sma50: s.kurs.slice(n0).map((_, j) => rund(sma(50, n0 + j), 2)),
        sma200: s.kurs.slice(n0).map((_, j) => rund(sma(200, n0 + j), 2)),
      },
    };
  });
  resultat.sort((x, y) => y.samlet.score - x.samlet.score);

  // ----- Marked og trender -----
  const ix = ctx.indeks, ixI = ix.datoer.length - 1;
  const endring = (serie, dager) => {
    if (!serie) return null;
    const j = serie.datoer.length - 1, j0 = finnIndeks(serie.datoer, forskyvDato(serie.datoer[j], -dager));
    return j0 >= 0 ? rund(serie.just[j] / serie.just[j0] - 1, 4) : null;
  };
  const sektorer = {};
  for (const r of resultat) {
    const x = (sektorer[r.sektor] ||= { sektor: r.sektor, antall: 0, mom6: [], mom1: [], kjop: 0, selg: 0 });
    x.antall++; x.mom6.push(r.nokkel.mom6); x.mom1.push(r.nokkel.mom1);
    if (r.samlet.signal === "KJØP") x.kjop++;
    if (r.samlet.signal === "SELG") x.selg++;
  }
  const fra14 = forskyvDato(idag(), -14);
  const hendelser = [];
  for (const a of aksjer) {
    const typer = new Map(a.innside.map((x) => [x.id, x.type]));
    for (const m of a.meldinger) {
      if (m.dato.slice(0, 10) < fra14) continue;
      const it = typer.get(m.id);
      let type = null;
      if (it === "KJØP") type = "innsidekjøp";
      else if (it === "SALG") type = "innsidesalg";
      else if (a.h.kontrakter.some((k) => k.tittel === m.tittel)) type = "kontrakt";
      else if (a.h.emisjoner.some((k) => k.tittel === m.tittel)) type = "emisjon";
      else if (a.h.varsler.some((k) => k.tittel === m.tittel)) type = "varsel";
      else if (a.h.oppkjop.some((k) => k.tittel === m.tittel)) type = "oppkjøp";
      else if (m.kategori.includes(1002)) type = "rapport";
      if (type) hendelser.push({ t: a.t, navn: a.navn, dato: m.dato.slice(0, 10), id: m.id, tittel: m.tittel, type });
    }
  }
  hendelser.sort((x, y) => y.dato.localeCompare(x.dato));

  const ut = {
    generert: new Date().toISOString(),
    handelsdag: sisteDag,
    indeks: {
      navn: "Oslo Børs hovedindeks (OSEBX)",
      verdi: rund(ix.kurs[ixI], 2),
      endringDag: rund(ix.kurs[ixI] / ix.kurs[ixI - 1] - 1, 4),
      mom1: endring(ix, 30), mom6: endring(ix, 182), mom12: endring(ix, 365),
      overSma200: ix.just[ixI] > snitt(ix.just.slice(ixI - 199, ixI + 1)),
    },
    marked: {
      olje: { navn: "Brent-olje (USD)", verdi: rund(ctx.olje?.kurs.at(-1), 2), mom1: endring(ctx.olje, 30), mom3: endring(ctx.olje, 91), mom12: endring(ctx.olje, 365) },
      usd: { navn: "USD/NOK", verdi: rund(ctx.usd?.kurs.at(-1), 3), mom1: endring(ctx.usd, 30), mom3: endring(ctx.usd, 91), mom12: endring(ctx.usd, 365) },
      sektorer: Object.values(sektorer)
        .map((x) => ({ sektor: x.sektor, antall: x.antall, mom6: rund(snitt(x.mom6), 4), mom1: rund(snitt(x.mom1), 4), kjop: x.kjop, selg: x.selg }))
        .sort((a, b) => b.mom6 - a.mom6),
      hendelser: hendelser.slice(0, 60),
    },
    modeller: Object.fromEntries(
      Object.entries(MODELLER).map(([k, m]) => [k, { navn: m.navn, horisont: m.horisont, vekter: m.vekter, andelAnalytikere: m.andelAnalytikere, analytikerVekter: m.analytikerVekter }]),
    ),
    grenser: { kjop: KJOP_GRENSE, selg: SELG_GRENSE, minOmsetningMNOK: MIN_OMSETNING_MNOK, antall: ANTALL, kostnad: KOSTNAD },
    faktorinfo: FAKTORER,
    mangler: feilet,
    aksjer: resultat,
    historiskTest: tester,
    kontrolltest: kontroll,
    faktorstudie: studie,
  };
  await mkdir(dirname(UTFIL), { recursive: true });
  await writeFile(UTFIL, JSON.stringify(ut));
  const tell = (k, s) => resultat.filter((r) => r[k].signal === s).length;
  console.log(`Ferdig: ${resultat.length} aksjer → ${UTFIL}`);
  for (const k of ["samlet", "kort", "lang"]) console.log(`  ${k}: KJØP ${tell(k, "KJØP")}, HOLD ${tell(k, "HOLD")}, SELG ${tell(k, "SELG")}`);
  console.log(`  Kontroll fra ${kontroll.fra}: selvlærende ${pst(kontroll.laerende.aarlig)}/år, kortmodell ${pst(kontroll.kort.aarlig)}/år, OSEBX ${pst(kontroll.osebx.aarlig)}/år, alle likt ${pst(kontroll.likevekt.aarlig)}/år`);
  for (const [k, t] of Object.entries(tester)) {
    console.log(`  Test ${k} ${t.fra}–${t.til}: ${pst(t.modell.aarlig)}/år (OSEBX ${pst(t.osebx.aarlig)}), maks fall ${pst(t.modell.maksFall)}`);
  }
}

main().catch((feil) => {
  console.error(feil);
  process.exit(1);
});
