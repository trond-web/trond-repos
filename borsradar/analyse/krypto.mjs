// Krypto: trendsignal for Bitcoin og Ethereum, oversikt over andre mynter og historisk test.
//
// Funn fra test 2018–2026 (ukentlig, 1 % kostnad per kjøp/salg):
// - Kjøp og hold Bitcoin: ca. 33 %/år, men største fall −74 % (−83 % i 2018–2019).
// - Trendsignal (snitt av 7 signaler) ga omtrent samme avkastning, men halverte de største fallene.
// - Altcoins, når mynter som senere kollapset er med (EOS, Terra/LUNA, FTT …), ga mindre enn Bitcoin
//   med fall opp mot −90 %. «Kjøp de som stiger mest» blant altcoins tapte penger etter kostnader.

import { hentKurser, iParallell } from "./kilder.mjs";

const HOVED = [
  { t: "BTC", navn: "Bitcoin", andel: 0.7 },
  { t: "ETH", navn: "Ethereum", andel: 0.3 },
];
// Andre store mynter som vises (ikke anbefalt), og mynter som falt fra toppen – brukes i testen av altcoins
const ANDRE = [
  ["SOL", "Solana"], ["XRP", "XRP"], ["BNB", "BNB"], ["DOGE", "Dogecoin"], ["ADA", "Cardano"], ["TRX", "Tron"],
  ["LINK", "Chainlink"], ["AVAX", "Avalanche"], ["XLM", "Stellar"], ["LTC", "Litecoin"], ["DOT", "Polkadot"], ["BCH", "Bitcoin Cash"],
];
const FALNE = ["EOS", "NEO", "XEM", "DASH", "QTUM", "OMG", "ICX", "LSK", "WAVES", "BTG", "STEEM", "BSV", "LUNC", "FTT", "ETC", "XMR", "ZEC", "XTZ", "SC", "DGB", "VET", "ALGO", "ATOM", "FIL", "HBAR", "NEAR", "SHIB", "ICP", "TON"];

export const KRYPTOMODELL = {
  kostnad: 0.01, // gebyr + spread per kjøp/salg (Firi ca. 0,7 % + spread)
  terskel: 0.25, // handle først når anbefalt andel endres minst så mye
  frekvens: 7, // sjekk én gang i uka
  signaler: ["Over 50-dagers snitt", "Over 100-dagers snitt", "Over 150-dagers snitt", "Over 200-dagers snitt", "Opp siste 30 dager", "Opp siste 90 dager", "Opp siste 180 dager"],
};

const snitt = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const rund = (x, d = 4) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d);

/** De 7 trendsignalene på dag i (true/false). */
function signaler(p, i) {
  if (i < 200) return null;
  const sma = (n) => snitt(p.slice(i - n + 1, i + 1));
  return [p[i] > sma(50), p[i] > sma(100), p[i] > sma(150), p[i] > sma(200), p[i] > p[i - 30], p[i] > p[i - 90], p[i] > p[i - 180]];
}
const andel = (sig) => (sig ? sig.filter(Boolean).length / sig.length : null);

function signalTekst(a) {
  if (a >= 5 / 7) return { signal: "KJØP", tekst: "Sterk opptrend – eie full andel" };
  if (a >= 3 / 7) return { signal: "HOLD", tekst: "Blandet – eie delvis" };
  return { signal: "SELG", tekst: "Nedtrend – eie lite eller ingenting" };
}

/** Serie med datoer → kurs (dagens kurs inkludert, 7 dager i uka). */
function tilKart(s) {
  return new Map(s.datoer.map((d, i) => [d, s.kurs[i]]));
}

function test(serier, datoer, fra) {
  const D = datoer.filter((d) => d >= fra);
  const pris = (t, d) => serier[t]?.kart.get(d);
  const idx = new Map(datoer.map((d, i) => [d, i]));
  const trendAndel = (t, d) => {
    const s = serier[t], i = s.indeks.get(d);
    return i == null ? null : andel(signaler(s.kurs, i));
  };
  const strategier = {
    holdBtc: () => ({ BTC: 1 }),
    trendBtc: (d) => ({ BTC: trendAndel("BTC", d) ?? 0 }),
    trend7030: (d) => ({ BTC: 0.7 * (trendAndel("BTC", d) ?? 0), ETH: 0.3 * (trendAndel("ETH", d) ?? 0) }),
    altcoins: (d) => {
      // Likevektet: de 20 mest omsatte myntene siste 30 dager (inkl. mynter som senere falt)
      const i = idx.get(d);
      const l = Object.entries(serier)
        .map(([t, s]) => {
          const j = s.indeks.get(d);
          if (j == null || j < 30) return null;
          let v = 0;
          for (let k = j - 29; k <= j; k++) v += (s.volum[k] || 0) * s.kurs[k];
          return [t, v];
        })
        .filter(Boolean)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20);
      return i == null ? {} : Object.fromEntries(l.map(([t]) => [t, 1 / l.length]));
    },
  };
  const ut = {};
  for (const [navn, velg] of Object.entries(strategier)) {
    let v = 1, vek = {}, topp = 1, fall = 0, handler = 0;
    const kurve = [{ dato: D[0], v: 1 }], aar = {};
    for (let u = 0; u + KRYPTOMODELL.frekvens < D.length; u += KRYPTOMODELL.frekvens) {
      const d0 = D[u], d1 = D[u + KRYPTOMODELL.frekvens];
      const ny = velg(d0);
      let oms = 0;
      for (const t of new Set([...Object.keys(ny), ...Object.keys(vek)])) oms += Math.abs((ny[t] || 0) - (vek[t] || 0));
      const terskel = navn === "altcoins" ? 0 : KRYPTOMODELL.terskel;
      if (oms >= terskel && oms > 0) { vek = ny; handler++; } else oms = 0;
      let avk = 0;
      for (const [t, w] of Object.entries(vek)) {
        const a = pris(t, d0), b = pris(t, d1) ?? a;
        if (a) avk += w * (b / a - 1);
      }
      avk -= oms * KRYPTOMODELL.kostnad;
      v *= 1 + avk; topp = Math.max(topp, v); fall = Math.min(fall, v / topp - 1);
      kurve.push({ dato: d1, v: rund(v) });
      const y = d1.slice(0, 4);
      aar[y] = (aar[y] ?? 1) * (1 + avk);
    }
    const ar = (new Date(kurve.at(-1).dato) - new Date(kurve[0].dato)) / (365.25 * 86400e3);
    ut[navn] = {
      aarlig: rund(v ** (1 / ar) - 1), totalt: rund(v - 1), maksFall: rund(fall), handlerPerAar: rund(handler / ar, 1),
      perAar: Object.fromEntries(Object.entries(aar).map(([y, x]) => [y, rund(x - 1)])),
      kurve: kurve.filter((_, k) => k % 2 === 0 || k === kurve.length - 1),
    };
  }
  return { fra: D[0], til: D.at(-1), ...ut };
}

export async function kryptoanalyse() {
  const alle = [...HOVED.map((h) => h.t), ...ANDRE.map(([t]) => t), ...FALNE];
  const usdnok = await hentKurser("NOK=X").catch(() => null);
  const rå = await iParallell(alle, 6, (t) => hentKurser(`${t}-USD`).catch(() => null));
  const serier = {};
  alle.forEach((t, i) => {
    const s = rå[i];
    if (!s || s.datoer.length < 60) return;
    serier[t] = { ...s, kart: tilKart(s), indeks: new Map(s.datoer.map((d, k) => [d, k])) };
  });
  if (!serier.BTC) throw new Error("Fant ikke Bitcoin-kurser");
  const nok = usdnok?.kurs.at(-1) ?? null;

  const status = (t, navn) => {
    const s = serier[t];
    if (!s) return null;
    const p = s.kurs, i = p.length - 1;
    const sig = signaler(p, i);
    const a = andel(sig);
    const r = (n) => (i >= n ? rund(p[i] / p[i - n] - 1) : null);
    const lr = [];
    for (let k = i - 29; k <= i; k++) lr.push(Math.log(p[k] / p[k - 1]));
    const m = snitt(lr);
    return {
      t, navn, dato: s.datoer[i],
      kursUsd: rund(p[i], p[i] < 10 ? 4 : 2), kursNok: nok ? rund(p[i] * nok, p[i] * nok < 10 ? 3 : 0) : null,
      endring1d: r(1), endring7d: r(7), endring30d: r(30), endring90d: r(90), endring365d: r(365),
      fraTopp: rund(p[i] / Math.max(...p) - 1),
      svingninger: rund(Math.sqrt(snitt(lr.map((x) => (x - m) ** 2)) * 365), 3),
      trendandel: rund(a, 3),
      signaler: sig,
      ...(a == null ? {} : signalTekst(a)),
      graf: { datoer: s.datoer.slice(-365), kurs: p.slice(-365).map((x) => rund(x, x < 10 ? 4 : 2)) },
    };
  };

  const hoved = HOVED.map((h) => ({ ...status(h.t, h.navn), modellandel: h.andel }));
  const anbefaling = Object.fromEntries(hoved.map((h) => [h.t, rund(h.modellandel * (h.trendandel ?? 0), 3)]));
  const andre = ANDRE.map(([t, n]) => status(t, n)).filter(Boolean).map(({ graf, ...x }) => x);

  return {
    generert: new Date().toISOString(),
    usdnok: rund(nok, 3),
    modell: KRYPTOMODELL,
    hoved,
    anbefaling, // andel av kryptopotten i hver mynt nå (resten i kroner)
    andre,
    test: test(serier, [...serier.BTC.datoer], "2018-06-01"),
    antallMynterITest: Object.keys(serier).length,
  };
}
