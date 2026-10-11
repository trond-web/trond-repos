// Faktorer for Børsradar. Alle beregninger på dag i bruker bare data som var kjent
// t.o.m. dag i, slik at samme kode kan brukes både i dag og i den historiske testen.

export const snitt = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const std = (a) => {
  const m = snitt(a);
  return Math.sqrt(snitt(a.map((x) => (x - m) ** 2)));
};

/** Indeks for siste handelsdag på eller før dato (binærsøk). */
export function finnIndeks(datoer, dato) {
  let lo = 0, hi = datoer.length - 1, svar = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (datoer[mid] <= dato) { svar = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return svar;
}

export function forskyvDato(dato, dager) {
  return new Date(new Date(dato).getTime() + dager * 86400e3).toISOString().slice(0, 10);
}

/** Hendelser (sortert på dato) i vinduet (fra, til]. */
function hendelserMellom(liste, fra, til) {
  if (!liste?.length) return [];
  const ut = [];
  for (let k = finnIndeks(liste.map((h) => h.dato), til); k >= 0 && liste[k].dato > fra; k--) ut.push(liste[k]);
  return ut;
}

// Nøkkelord i titler på børsmeldinger
const ORD = {
  emisjon: /(private placement|rettet emisjon|reparasjonsemisjon|fortrinnsrettsemisjon|rights issue|share issue|capital raise|kapitalinnhenting|equity raise|emisjon)/i,
  ikkeEmisjon: /(utbytteemisjon|scrip|employee|ansatt|subsequent offering completed|registered|registrert)/i,
  kontrakt: /(contract|kontrakt|awarded|tildelt|order|ordre|letter of intent|\bLOI\b|charter|fixture|framework agreement|rammeavtale|wins|vinner)/i,
  negativ: /(reduce|reduser|terminat|cancel|kansell|avslutt|heve|lost|tapt|delay|forsink|dispute|tvist|lower|lavere|suspend)/i,
  varsel: /(reduced charter|charter.*(terminat|cancel)|contract.*(terminat|cancel)|(terminat|cancel).*contract|profit warning|resultatvarsel|impairment|nedskrivning|weaker than expected|lower than expected|svakere enn|downward revision|guidance cut|nedjuster|suspen|default|mislighold|restructuring|restrukturering|going concern)/i,
  oppkjop: /(offer for all|tilbud på alle|recommended (voluntary|cash) offer|anbefalt (frivillig|kontant)|takeover|mandatory offer|pliktig tilbud|strategic review|strategisk gjennomgang)/i,
};

/**
 * Forbereder en aksje: sorterte hendelseslister ut fra børsmeldinger og innsidehandel.
 * meldinger: [{dato (ISO), kategori: [..], tittel}], innside: [{dato, type}]
 */
export function forberedHendelser(meldinger = [], innside = []) {
  const d = (m) => m.dato.slice(0, 10);
  const sorter = (l) => l.sort((a, b) => a.dato.localeCompare(b.dato));
  const rapporter = [];
  for (const m of sorter(meldinger.filter((m) => m.kategori.includes(1002)).map((m) => ({ dato: d(m), tid: m.dato })))) {
    // Én rapport per 20 dager (første melding regnes)
    if (!rapporter.length || m.dato > forskyvDato(rapporter.at(-1).dato, 20)) rapporter.push(m);
  }
  return {
    rapporter,
    emisjoner: sorter(meldinger.filter((m) => ORD.emisjon.test(m.tittel) && !ORD.ikkeEmisjon.test(m.tittel)).map((m) => ({ dato: d(m), tittel: m.tittel }))),
    kontrakter: sorter(meldinger.filter((m) => ORD.kontrakt.test(m.tittel) && !ORD.negativ.test(m.tittel)).map((m) => ({ dato: d(m), tittel: m.tittel }))),
    varsler: sorter(meldinger.filter((m) => ORD.varsel.test(m.tittel)).map((m) => ({ dato: d(m), tittel: m.tittel }))),
    oppkjop: sorter(meldinger.filter((m) => ORD.oppkjop.test(m.tittel)).map((m) => ({ dato: d(m), tittel: m.tittel }))),
    tilbakekjop: sorter(meldinger.filter((m) => m.kategori.includes(1007)).map((m) => ({ dato: d(m) }))),
    alle: sorter(meldinger.map((m) => ({ dato: d(m) }))),
    innsideKjop: sorter(innside.filter((h) => h.type === "KJØP").map((h) => ({ dato: h.dato.slice(0, 10) }))),
    innsideSalg: sorter(innside.filter((h) => h.type === "SALG").map((h) => ({ dato: h.dato.slice(0, 10) }))),
  };
}

/** Betaverdi for aksjens daglige avkastning mot en annen serie (siste n dager). */
function beta(s, i, ref, n = 250) {
  const xs = [], ys = [];
  for (let k = i - n + 1; k <= i; k++) {
    const j = finnIndeks(ref.datoer, s.datoer[k]), j0 = finnIndeks(ref.datoer, s.datoer[k - 1]);
    if (j <= 0 || j0 < 0 || j === j0) continue;
    xs.push(ref.just[j] / ref.just[j0] - 1);
    ys.push(s.just[k] / s.just[k - 1] - 1);
  }
  if (xs.length < n / 2) return null;
  const mx = snitt(xs), my = snitt(ys);
  let kov = 0, varx = 0;
  for (let k = 0; k < xs.length; k++) { kov += (xs[k] - mx) * (ys[k] - my); varx += (xs[k] - mx) ** 2; }
  return varx > 0 ? kov / varx : null;
}

function avkastningFor(ref, dato, dager) {
  const j = finnIndeks(ref.datoer, dato);
  const j0 = finnIndeks(ref.datoer, forskyvDato(dato, -dager));
  return j > 0 && j0 >= 0 ? ref.just[j] / ref.just[j0] - 1 : null;
}

/**
 * Råverdier for alle faktorer for én aksje på dag i.
 * ctx: { indeks, olje, usd } (kursserier), h: forberedHendelser(...)
 */
export function raaFaktorer(s, i, h, ctx) {
  if (i < 260) return null;
  if ((s.brudd || []).some((b) => b > i - 260 && b <= i)) return null; // kursbrudd siste år
  const p = s.just, dato = s.datoer[i];
  const sma = (n) => snitt(p.slice(i - n + 1, i + 1));
  const sma50 = sma(50), sma200 = sma(200);
  const r = [];
  for (let k = i - 59; k <= i; k++) r.push(p[k] / p[k - 1] - 1);
  const r250 = [];
  for (let k = i - 249; k <= i; k++) r250.push(p[k] / p[k - 1] - 1);
  let oms20 = 0, oms120 = 0;
  for (let k = i - 19; k <= i; k++) oms20 += s.kurs[k] * s.volum[k];
  for (let k = i - 119; k <= i; k++) oms120 += s.kurs[k] * s.volum[k];
  oms20 /= 20; oms120 /= 120;
  const topp = Math.max(...p.slice(i - 251, i + 1));

  // Indeksjustert avkastning
  const ix = ctx.indeks;
  const ixAvk = (a, b) => {
    const ja = finnIndeks(ix.datoer, s.datoer[a]), jb = finnIndeks(ix.datoer, s.datoer[b]);
    return ja >= 0 && jb >= 0 ? ix.just[jb] / ix.just[ja] - 1 : 0;
  };

  // Nyhetsreaksjon: dager siste 20 handelsdager med volum > 2,5 × normalt; sum av meravkastning
  let nyhetsreaksjon = 0;
  const normVol = snitt(s.volum.slice(i - 119, i - 19)) || 0;
  for (let k = i - 19; k <= i; k++) {
    if (normVol > 0 && s.volum[k] > 2.5 * normVol) nyhetsreaksjon += p[k] / p[k - 1] - 1 - ixAvk(k - 1, k);
  }

  // Reaksjon på siste kvartalsrapport (innen 70 dager): meravkastning fra dagen før til dagen etter
  let rapportreaksjon = null;
  const rapp = hendelserMellom(h.rapporter, forskyvDato(dato, -70), dato)[0];
  if (rapp) {
    const k0 = finnIndeks(s.datoer, forskyvDato(rapp.dato, -1));
    const k1 = Math.min(i, finnIndeks(s.datoer, rapp.dato) + 1);
    if (k0 > 0 && k1 > k0) rapportreaksjon = p[k1] / p[k0] - 1 - ixAvk(k0, k1);
  }

  // Sesong: snittlig meravkastning i kommende kalendermåned de siste (opptil) 10 årene
  const sesong = [];
  const [aa, mm] = forskyvDato(dato, 15).slice(0, 7).split("-").map(Number);
  for (let aar = 1; aar <= 10; aar++) {
    const start = `${aa - aar}-${String(mm).padStart(2, "0")}-01`;
    const slutt = mm === 12 ? `${aa - aar + 1}-01-01` : `${aa - aar}-${String(mm + 1).padStart(2, "0")}-01`;
    const a = finnIndeks(s.datoer, forskyvDato(start, -1)), b = finnIndeks(s.datoer, forskyvDato(slutt, -1));
    if (a > 0 && b > a && slutt <= dato) sesong.push(p[b] / p[a] - 1 - ixAvk(a, b));
  }

  // Utbytte siste 12 mnd
  const ettAar = forskyvDato(dato, -365);
  const utbytte = (s.utbytte || []).filter((u) => u.dato > ettAar && u.dato <= dato).reduce((x, u) => x + u.belop, 0) / s.kurs[i];

  const tell = (l, dager) => hendelserMellom(l, forskyvDato(dato, -dager), dato).length;
  const betaOlje = ctx.olje ? beta(s, i, ctx.olje) : null;
  const betaUsd = ctx.usd ? beta(s, i, ctx.usd) : null;
  const oljeMom = ctx.olje ? avkastningFor(ctx.olje, dato, 91) : null;
  const usdMom = ctx.usd ? avkastningFor(ctx.usd, dato, 91) : null;
  const alleNyheter = tell(h.alle, 30), normaleNyheter = tell(h.alle, 365) / 12;

  return {
    // Kurs og trend
    mom12_1: p[i - 21] / p[i - 252] - 1,
    mom6: p[i] / p[i - 126] - 1,
    mom3: p[i] / p[i - 63] - 1,
    mom1: p[i] / p[i - 21] - 1,
    mom1u: p[i] / p[i - 5] - 1,
    trend: p[i] / sma200 - 1 + (p[i] > sma50 ? 0.02 : 0) + (sma50 > sma200 ? 0.02 : 0),
    fraTopp: p[i] / topp - 1,
    vol60: std(r) * Math.sqrt(252),
    maks: Math.max(...r.slice(-21)),
    betaIndeks: beta(s, i, ix),
    volumTrend: oms120 > 0 ? oms20 / oms120 : null,
    omsetningMNOK: oms20 / 1e6,
    nyhetsreaksjon,
    rapportreaksjon,
    sesong: sesong.length >= 3 ? snitt(sesong) : null,
    utbytte: Math.min(utbytte, 0.3),
    // Makro
    betaOlje, betaUsd,
    oljeTilt: betaOlje != null && oljeMom != null ? betaOlje * oljeMom : null,
    usdTilt: betaUsd != null && usdMom != null ? betaUsd * usdMom : null,
    // Børsmeldinger og innsidehandel
    innsideKjop90: tell(h.innsideKjop, 90),
    innsideSalg90: tell(h.innsideSalg, 90),
    innsideNetto90: tell(h.innsideKjop, 90) - tell(h.innsideSalg, 90),
    tilbakekjop90: tell(h.tilbakekjop, 90),
    emisjon60: tell(h.emisjoner, 60),
    kontrakter60: tell(h.kontrakter, 60),
    varsler60: tell(h.varsler, 60),
    oppkjop90: tell(h.oppkjop, 90),
    nyhetsmengde: normaleNyheter > 0 ? alleNyheter / normaleNyheter : null,
    // Til visning
    sma50, sma200, overSma200: p[i] > sma200, overSma50: p[i] > sma50, gyllentKors: sma50 > sma200,
    rsi14: rsi(p, i),
  };
}

function rsi(v, slutt, n = 14) {
  const start = Math.max(1, slutt - 120);
  let opp = 0, ned = 0;
  for (let i = start; i < start + n; i++) {
    const d = v[i] - v[i - 1];
    if (d > 0) opp += d; else ned -= d;
  }
  opp /= n; ned /= n;
  for (let i = start + n; i <= slutt; i++) {
    const d = v[i] - v[i - 1];
    opp = (opp * (n - 1) + Math.max(d, 0)) / n;
    ned = (ned * (n - 1) + Math.max(-d, 0)) / n;
  }
  return ned === 0 ? 100 : 100 - 100 / (1 + opp / ned);
}

/** Faktorer som legges til i tverrsnittet (avhenger av andre aksjer). */
export function tverrsnittFaktorer(rader) {
  const perSektor = {};
  for (const r of rader) (perSektor[r.sektor] ||= []).push(r);
  for (const r of rader) {
    const andre = perSektor[r.sektor].filter((x) => x !== r);
    r.f.sektorMom = andre.length ? snitt(andre.map((x) => x.f.mom6)) : null;
    r.f.mom6MotSektor = r.f.sektorMom != null ? r.f.mom6 - r.f.sektorMom : null;
  }
}

/** Prosentil (0–1) per verdi; null forblir null. */
export function rangering(verdier) {
  const gyldige = verdier.map((v, i) => [v, i]).filter(([v]) => v != null && Number.isFinite(v)).sort((a, b) => a[0] - b[0]);
  const ut = verdier.map(() => null);
  const n = gyldige.length;
  for (let k = 0; k < n; ) {
    let j = k;
    while (j + 1 < n && gyldige[j + 1][0] === gyldige[k][0]) j++;
    const rang = n === 1 ? 0.5 : (k + j) / 2 / (n - 1);
    for (let x = k; x <= j; x++) ut[gyldige[x][1]] = rang;
    k = j + 1;
  }
  return ut;
}

/** Faktorene modellen kan bruke, med norsk navn og forklaring. */
export const FAKTORER = {
  mom12_1: { navn: "Momentum 12 mnd", gruppe: "Kurs og trend", forklaring: "Kursutvikling siste 12 måneder, uten siste måned" },
  mom6: { navn: "Momentum 6 mnd", gruppe: "Kurs og trend", forklaring: "Kursutvikling siste 6 måneder" },
  mom3: { navn: "Momentum 3 mnd", gruppe: "Kurs og trend", forklaring: "Kursutvikling siste 3 måneder" },
  mom1: { navn: "Siste måned", gruppe: "Kurs og trend", forklaring: "Kursutvikling siste måned (ofte snur kortsiktige bevegelser)" },
  mom1u: { navn: "Siste uke", gruppe: "Kurs og trend", forklaring: "Kursutvikling siste uke" },
  trend: { navn: "Trend", gruppe: "Kurs og trend", forklaring: "Kurs mot 50- og 200-dagers glidende snitt" },
  fraTopp: { navn: "Nær 52-ukers topp", gruppe: "Kurs og trend", forklaring: "Hvor nær kursen er årets høyeste" },
  vol60: { navn: "Svingninger", gruppe: "Risiko", forklaring: "Hvor mye kursen svinger (årlig standardavvik)" },
  maks: { navn: "Største dagshopp", gruppe: "Risiko", forklaring: "Største daglige oppgang siste måned («lotteriaksje»)" },
  betaIndeks: { navn: "Markedsfølsomhet (beta)", gruppe: "Risiko", forklaring: "Hvor mye aksjen beveger seg med Oslo Børs" },
  volumTrend: { navn: "Økende omsetning", gruppe: "Kurs og trend", forklaring: "Omsetning siste måned mot siste halvår" },
  omsetningMNOK: { navn: "Likviditet", gruppe: "Risiko", forklaring: "Daglig omsetning i kroner (store, likvide selskaper)" },
  sektorMom: { navn: "Sektortrend", gruppe: "Trender", forklaring: "Hvordan de andre aksjene i samme sektor har gått siste 6 mnd" },
  mom6MotSektor: { navn: "Best i sektoren", gruppe: "Trender", forklaring: "Aksjens 6-mnd utvikling mot resten av sektoren" },
  oljeTilt: { navn: "Oljeprisen", gruppe: "Trender", forklaring: "Aksjens følsomhet for oljeprisen × oljeprisens utvikling siste 3 mnd" },
  usdTilt: { navn: "Dollarkursen", gruppe: "Trender", forklaring: "Aksjens følsomhet for USD/NOK × dollarens utvikling siste 3 mnd" },
  sesong: { navn: "Sesong", gruppe: "Trender", forklaring: "Hvordan aksjen pleier å gjøre det i kommende måned" },
  nyhetsreaksjon: { navn: "Nyhetsreaksjon", gruppe: "Nyheter", forklaring: "Kursreaksjon på dager med uvanlig høyt volum (nyheter) siste måned" },
  rapportreaksjon: { navn: "Reaksjon på rapport", gruppe: "Nyheter", forklaring: "Kursreaksjon på siste kvartalsrapport" },
  kontrakter60: { navn: "Kontrakter", gruppe: "Nyheter", forklaring: "Børsmeldinger om kontrakter og ordre siste 60 dager" },
  emisjon60: { navn: "Emisjon", gruppe: "Nyheter", forklaring: "Emisjon / kapitalinnhenting siste 60 dager" },
  varsler60: { navn: "Negative varsler", gruppe: "Nyheter", forklaring: "Resultatvarsel, nedskrivning o.l. siste 60 dager" },
  oppkjop90: { navn: "Oppkjøpsbud", gruppe: "Nyheter", forklaring: "Bud eller strategisk gjennomgang siste 90 dager" },
  nyhetsmengde: { navn: "Nyhetsmengde", gruppe: "Nyheter", forklaring: "Antall børsmeldinger siste måned mot normalt" },
  innsideKjop90: { navn: "Innsidekjøp", gruppe: "Innsidere", forklaring: "Antall kjøp fra ledelse og styre siste 90 dager" },
  innsideSalg90: { navn: "Innsidesalg", gruppe: "Innsidere", forklaring: "Antall salg fra ledelse og styre siste 90 dager" },
  innsideNetto90: { navn: "Innsidere netto", gruppe: "Innsidere", forklaring: "Innsidekjøp minus innsidesalg siste 90 dager" },
  tilbakekjop90: { navn: "Tilbakekjøp", gruppe: "Innsidere", forklaring: "Selskapet kjøper egne aksjer (siste 90 dager)" },
  utbytte: { navn: "Utbytte", gruppe: "Verdi og kvalitet", forklaring: "Utbytte siste 12 mnd i prosent av kursen" },
};
