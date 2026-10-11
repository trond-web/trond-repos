// Selvkalibrerende modell: vektene for hver faktor beregnes fra hvor godt faktoren har
// forutsagt avkastning tidligere (informasjonskoeffisient, IC). Bare historikk som var
// kjent på hvert tidspunkt brukes ("walk-forward"), slik at den historiske testen er ærlig.

import { rangering, snitt } from "./faktorer.mjs";

export const MIN_MND = 24; // minste antall måneder med historikk før vektene brukes

function korrelasjon(a, b) {
  const n = a.length, ma = snitt(a), mb = snitt(b);
  let c = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
  return va > 0 && vb > 0 ? c / Math.sqrt(va * vb) : 0;
}

/** Faktorverdier normalisert til -1…1 (rang i tverrsnittet). Manglende verdi = 0 (nøytral). */
export function normaliser(rader, faktorer) {
  const z = rader.map(() => ({}));
  for (const f of faktorer) {
    const r = rangering(rader.map((x) => x.f[f]));
    r.forEach((v, i) => (z[i][f] = v == null ? 0 : (v - 0.5) * 2));
  }
  return z;
}

/** IC per måned og faktor for horisont h (måneder). panel: [{dato, rader:[{f, fw}]}] */
export function icHistorikk(panel, faktorer, h) {
  return panel.map((p) => {
    const ut = {};
    const r = p.rader.filter((x) => x.fw?.[h] != null);
    if (r.length < 20) return null;
    const avk = rangering(r.map((x) => x.fw[h]));
    for (const f of faktorer) {
      const v = r.map((x) => x.f[f]);
      const gyldig = v.map((x, i) => [x, avk[i]]).filter(([x]) => x != null && Number.isFinite(x));
      if (gyldig.length < 20 || new Set(gyldig.map((g) => g[0])).size < 3) { ut[f] = 0; continue; }
      const rx = rangering(gyldig.map((g) => g[0]));
      ut[f] = korrelasjon(rx, gyldig.map((g) => g[1]));
    }
    return ut;
  });
}

/**
 * Vekter ut fra IC-historikk for måned m: bare måneder der fremtidig avkastning var kjent (k ≤ m - h).
 * Vekt = snitt-IC × tillit, der tillit øker med t-verdien (støyfaktorer får vekt nær 0).
 */
export function beregnVekter(ic, m, h, faktorer) {
  const kjent = ic.slice(0, Math.max(0, m - h + 1)).filter(Boolean);
  if (kjent.length < MIN_MND) return null;
  const vekter = {}, stat = {};
  for (const f of faktorer) {
    const v = kjent.map((x) => x[f]);
    const mid = snitt(v), sd = Math.sqrt(snitt(v.map((x) => (x - mid) ** 2)));
    // Overlappende perioder (h > 1) gir færre uavhengige observasjoner
    const t = sd > 0 ? (mid / sd) * Math.sqrt(v.length / h) : 0;
    const tillit = Math.min(1, Math.max(0, (Math.abs(t) - 0.5) / 1.5));
    vekter[f] = mid * tillit;
    stat[f] = { ic: mid, t, antall: v.length };
  }
  const sum = Object.values(vekter).reduce((s, w) => s + Math.abs(w), 0);
  if (sum > 0) for (const f of faktorer) vekter[f] /= sum;
  return { vekter, stat };
}

/** Score (0–100, rang i tverrsnittet) og bidrag per faktor. */
export function scor(rader, vekter, faktorer) {
  const z = normaliser(rader, faktorer);
  const raa = z.map((zi) => faktorer.reduce((s, f) => s + (vekter[f] || 0) * zi[f], 0));
  const rang = rangering(raa);
  return rader.map((_, i) => ({
    score: rang[i] * 100,
    raa: raa[i],
    bidrag: Object.fromEntries(faktorer.filter((f) => vekter[f]).map((f) => [f, vekter[f] * z[i][f]])),
    z: z[i],
  }));
}

/**
 * De to modellene. Kjernevektene er valgt ut fra forskning (momentum og trend er dokumentert i
 * mange markeder) og kontrollert på Oslo Børs 2017–2026: de må ha virket i begge halvdeler av perioden.
 * Faktorer som ikke virket (lav volatilitet, RSI, 1-mnd reversering, markedsfilter) er utelatt.
 */
export const MODELLER = {
  kort: {
    navn: "Kort sikt",
    horisont: "1–3 måneder",
    h: 1,
    vekter: {
      mom12_1: 0.3, mom6: 0.2, trend: 0.2, mom3: 0.1, sektorMom: 0.2, maks: -0.1, utbytte: 0.1,
      kontrakter60: 0.05, nyhetsreaksjon: 0.05, rapportreaksjon: 0.05, innsideKjop90: 0.1, varsler60: -0.05,
    },
    // Andel av scoren fra analytikerdata (finnes bare i dag, kan ikke testes historisk)
    andelAnalytikere: 0.15,
    analytikerVekter: { revisjon: 0.4, anbefalingEndring: 0.3, overraskelse: 0.3 },
  },
  lang: {
    navn: "Lang sikt",
    horisont: "6–12 måneder",
    h: 12,
    vekter: { trend: 0.4, sektorMom: 0.2, mom12_1: 0.2, mom6: 0.2, utbytte: 0.1, innsideKjop90: 0.1 },
    andelAnalytikere: 0.25,
    analytikerVekter: { inntjening: 0.3, bok: 0.15, roe: 0.2, revisjon: 0.2, kursmalOppside: 0.15 },
  },
};

export const KJOP_GRENSE = 75;
export const SELG_GRENSE = 25;

export function signalFor(score, f) {
  const nedtrend = !f.overSma200 && !f.gyllentKors && f.mom12_1 < 0;
  if (score >= KJOP_GRENSE && f.overSma200) return "KJØP";
  if (score <= SELG_GRENSE || nedtrend) return "SELG";
  return "HOLD";
}
