// Datakilder for Børsradar: Yahoo Finance (kurser, nøkkeltall, analytikere) og
// Oslo Børs Newsweb (børsmeldinger, innsidehandel). Ingen avhengigheter utover Node 18+.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

export const vent = (ms) => new Promise((r) => setTimeout(r, ms));

export async function hentJson(url, { forsok = 4, headers = {}, metode = "GET" } = {}) {
  for (let i = 0; i < forsok; i++) {
    try {
      const svar = await fetch(url, { method: metode, headers: { "User-Agent": UA, ...headers } });
      if (svar.status === 404) return null;
      if (!svar.ok) throw new Error(`HTTP ${svar.status}`);
      return await svar.json();
    } catch (feil) {
      if (i === forsok - 1) throw feil;
      await vent(1000 * 2 ** i);
    }
  }
}

export async function iParallell(liste, antall, fn) {
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

const isoDato = (sek, offset = 0) => new Date((sek + offset) * 1000).toISOString().slice(0, 10);

// ---------- Yahoo: kurser ----------

/** Daglige kurser (vanlig og utbyttejustert), volum og utbytter. */
export async function hentKurser(symbol, periode = "10y") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${periode}&interval=1d&events=div%7Csplit`;
  const data = await hentJson(url);
  const r = data?.chart?.result?.[0];
  if (!r?.timestamp) return null;
  const q = r.indicators.quote[0];
  const adj = r.indicators.adjclose?.[0]?.adjclose || q.close;
  const serie = { datoer: [], kurs: [], just: [], volum: [] };
  r.timestamp.forEach((ts, i) => {
    if (q.close[i] == null || adj[i] == null || q.close[i] <= 0) return;
    const dato = isoDato(ts, r.meta.gmtoffset || 0);
    // Yahoo kan gi to rader for samme dag (siste rad er live-kurs)
    if (serie.datoer.at(-1) === dato) {
      serie.datoer.pop(); serie.kurs.pop(); serie.just.pop(); serie.volum.pop();
    }
    serie.datoer.push(dato);
    serie.kurs.push(q.close[i]);
    serie.just.push(adj[i]);
    serie.volum.push(q.volume?.[i] || 0);
  });
  serie.utbytte = Object.values(r.events?.dividends || {})
    .map((d) => ({ dato: isoDato(d.date), belop: d.amount }))
    .sort((a, b) => a.dato.localeCompare(b.dato));
  serie.valuta = r.meta.currency;
  // Kursbrudd: dager der justert kurs mer enn dobles eller faller over 55 %. Dette er som regel
  // spleis/emisjoner Yahoo ikke har justert for, og periodene rundt holdes utenfor beregningene.
  serie.brudd = [];
  for (let i = 1; i < serie.just.length; i++) {
    const r = serie.just[i] / serie.just[i - 1];
    if (r > 2 || r < 0.45) serie.brudd.push(i);
  }
  return serie;
}

/** Om serien har et kursbrudd i (fra, til]. */
export function harBrudd(serie, fra, til) {
  return (serie.brudd || []).some((b) => b > fra && b <= til);
}

// ---------- Yahoo: nøkkeltall ----------

export async function hentNokkeltall(symbol) {
  const typer = ["trailingPeRatio", "trailingPbRatio", "trailingMarketCap", "annualNetIncome", "annualStockholdersEquity", "annualTotalRevenue", "annualTotalDebt", "annualFreeCashFlow"];
  const naa = Math.floor(Date.now() / 1000);
  const url = `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?type=${typer.join(",")}&period1=${naa - 4 * 365 * 86400}&period2=${naa}`;
  const data = await hentJson(url);
  const ut = {};
  for (const r of data?.timeseries?.result || []) {
    const type = r.meta?.type?.[0];
    const verdier = (r[type] || []).filter((v) => v?.reportedValue?.raw != null);
    if (!verdier.length) continue;
    ut[type] = verdier.at(-1).reportedValue.raw;
    if (type.startsWith("annual") && verdier.length >= 2) ut[`${type}Forrige`] = verdier.at(-2).reportedValue.raw;
  }
  return ut;
}

// ---------- Yahoo: analytikere (krever "crumb") ----------

let crumbLofte = null;

async function hentCrumb() {
  const svar = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": UA }, redirect: "manual" });
  const kaker = (svar.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
  const c = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", { headers: { "User-Agent": UA, Cookie: kaker } });
  const crumb = await c.text();
  if (!c.ok || !crumb || crumb.includes("<")) throw new Error("Fikk ikke crumb fra Yahoo");
  return { crumb, kaker };
}

const raw = (x) => (x && typeof x === "object" ? (x.raw ?? null) : (x ?? null));

/** Analytikeranbefalinger, kursmål, estimatendringer og neste rapportdato. */
export async function hentAnalytikere(symbol) {
  crumbLofte ??= hentCrumb();
  const { crumb, kaker } = await crumbLofte;
  const moduler = "recommendationTrend,financialData,earningsTrend,earningsHistory,calendarEvents,upgradeDowngradeHistory";
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${moduler}&crumb=${encodeURIComponent(crumb)}`;
  const data = await hentJson(url, { headers: { Cookie: kaker } });
  const r = data?.quoteSummary?.result?.[0];
  if (!r) return null;
  const fd = r.financialData || {};
  const trend = r.recommendationTrend?.trend || [];
  const anb = (p) => {
    const t = trend.find((x) => x.period === p);
    if (!t) return null;
    const n = t.strongBuy + t.buy + t.hold + t.sell + t.strongSell;
    // 1 = sterkt kjøp … 5 = sterkt salg
    return n ? { antall: n, snitt: (t.strongBuy + 2 * t.buy + 3 * t.hold + 4 * t.sell + 5 * t.strongSell) / n, kjop: t.strongBuy + t.buy, hold: t.hold, selg: t.sell + t.strongSell } : null;
  };
  // Endring i EPS-estimat for inneværende og neste år siste 30/90 dager
  const revisjon = (periode, felt) => {
    const t = (r.earningsTrend?.trend || []).find((x) => x.period === periode);
    const e = t?.epsTrend;
    const naa = raw(e?.current), før = raw(e?.[felt]);
    return naa != null && før != null && Math.abs(før) > 1e-6 ? (naa - før) / Math.abs(før) : null;
  };
  const historikk = (r.earningsHistory?.history || [])
    .map((h) => ({ dato: raw(h.quarter) ? isoDato(raw(h.quarter)) : null, faktisk: raw(h.epsActual), estimat: raw(h.epsEstimate), overraskelse: raw(h.surprisePercent) }))
    .filter((h) => h.faktisk != null && h.estimat != null);
  const neste = raw(r.calendarEvents?.earnings?.earningsDate?.[0]);
  const ettAar = Date.now() / 1000 - 365 * 86400;
  const endringer = (r.upgradeDowngradeHistory?.history || []).filter((h) => h.epochGradeDate > ettAar);
  return {
    anbefalingNaa: anb("0m"),
    anbefaling3mnd: anb("-3m"),
    kursmal: raw(fd.targetMeanPrice),
    kursmalHoy: raw(fd.targetHighPrice),
    kursmalLav: raw(fd.targetLowPrice),
    antallAnalytikere: raw(fd.numberOfAnalystOpinions),
    revisjon30: revisjon("0y", "30daysAgo") ?? revisjon("0q", "30daysAgo"),
    revisjon90: revisjon("0y", "90daysAgo") ?? revisjon("0q", "90daysAgo"),
    revisjonNesteAar90: revisjon("+1y", "90daysAgo"),
    sisteOverraskelse: historikk.at(-1)?.overraskelse ?? null,
    overraskelser: historikk.map((h) => h.overraskelse),
    nesteRapport: neste ? isoDato(neste) : null,
    oppgraderinger: endringer.filter((h) => h.action === "up").length,
    nedgraderinger: endringer.filter((h) => h.action === "down").length,
    inntektsvekst: raw(fd.revenueGrowth),
    resultatvekst: raw(fd.earningsGrowth),
    bruttomargin: raw(fd.grossMargins),
    driftsmargin: raw(fd.operatingMargins),
    gjeldEgenkapital: raw(fd.debtToEquity),
    kontantstrom: raw(fd.freeCashflow),
  };
}

// ---------- Oslo Børs Newsweb ----------

const NEWSWEB = "https://api3.oslo.oslobors.no/v1/newsreader";

export const KATEGORI = {
  innsidehandel: 1102,
  innsideinformasjon: 1005,
  egneAksjer: 1007,
  flagging: 1006,
  halvaar: 1002,
  annen: 1010,
};

/** Meldinger i et tidsrom. API-et gir maks ~600 per kall, så fulle vinduer deles i to. */
export async function hentMeldinger({ fra, til, kategori = "", utsteder = "" }) {
  const dag = (d) => d.toISOString().slice(0, 10);
  const hent = async (start, slutt) => {
    const url = `${NEWSWEB}/list?category=${kategori}&issuer=${utsteder}&fromDate=${dag(start)}&toDate=${dag(slutt)}&market=&messageTitle=`;
    const liste = (await hentJson(url))?.data?.messages || [];
    const dager = Math.round((slutt - start) / 86400e3);
    if (liste.length >= 590 && dager >= 1) {
      const midt = new Date(start.getTime() + Math.floor(dager / 2) * 86400e3);
      return [...(await hent(start, midt)), ...(await hent(new Date(midt.getTime() + 86400e3), slutt))];
    }
    return liste;
  };
  const ut = await hent(new Date(fra), new Date(til));
  const sett = new Set();
  return ut
    .filter((m) => !sett.has(m.messageId) && sett.add(m.messageId))
    .map((m) => ({
      id: m.messageId,
      dato: m.publishedTime,
      utsteder: m.issuerSign,
      tittel: m.title,
      kategori: m.category?.map((c) => c.id) || [],
    }));
}

export async function hentMeldingstekst(id) {
  const data = await hentJson(`${NEWSWEB}/message?messageId=${id}`);
  return data?.data?.message?.body || "";
}
