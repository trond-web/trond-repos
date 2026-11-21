// Poengsystemet for langløpsrankingen, og koblingen av løpere på tvers av løp og kilder.
//
// Løpspoeng = Løpsvekt × (Tidspoeng + Plasseringsbonus)
//   Tidspoeng        = 100 × (vinnertid / egen tid)^3   (vinneren får 100, 10 % bak ≈ 75, dobbel tid ≈ 12,5)
//   Plasseringsbonus = 50, 40, 32, 26, 22, 18, 15, 12, 10, 8, 6, 5, 4, 3, 2 for plass 1–15
//   Løpsvekt         = Nivå × Distanse × Feltstyrke
//     Nivå:       Ski Classics Pro Tour 1,0 · Ski Classics Challengers 0,8 · FIS-løp 0,7 · øvrige turrenn 0,6
//     Distanse:   20–29 km 0,8 · 30–49 km 0,9 · 50 km og lengre 1,0
//     Feltstyrke: 0,8–1,0 ut fra hvor sterke de ti beste i løpet er i rankingen (regnes ut i flere runder)
// Sesongpoeng = summen av de 8 beste løpspoengene. Menn og kvinner rangeres hver for seg.
import { navnNokkel, navnTokens, foldTekst } from "./felles.mjs";

export const REGLER = {
  eksponent: 3,
  bonus: [50, 40, 32, 26, 22, 18, 15, 12, 10, 8, 6, 5, 4, 3, 2],
  niva: { pro: 1.0, challengers: 0.8, fis: 0.7, turrenn: 0.6 },
  distanse: [
    [50, 1.0],
    [30, 0.9],
    [20, 0.8],
  ],
  feltMin: 0.8,
  feltTopp: 10,
  feltReferanse: 20,
  besteAntall: 8,
  runder: 3,
  minDeltakere: 3,
};

export const NIVA_NAVN = {
  pro: "Ski Classics Pro Tour",
  challengers: "Ski Classics Challengers",
  fis: "FIS-langløp",
  turrenn: "Turrenn",
};

// ---------- Utvalg av løp ----------

const IKKE_LANGLOP_SC = /sprint|criterium|team tempo|pro team|heat|prolog|stage [2-9]/i;
const SORLIGE = /kangaroo|merino|perisher|hoppet|silverstar|sovereign/i; // vinter på sørlige halvkule / Nord-Amerika høst
const RULLESKI = /rulle|roller|rollski|klarälvsloppet|alliansloppet|båstad|lipno|tanumsloppet|vaajmarathon|ring frei/i;

export function erLanglop(lop) {
  if (!lop.res) return false;
  if (lop.kilde === "skiclassics") {
    if (IKKE_LANGLOP_SC.test(lop.navn)) return false;
    if (RULLESKI.test(lop.navn)) return false;
    const mnd = Number(String(lop.dato).slice(5, 7));
    if (mnd >= 5 && mnd <= 10 && !SORLIGE.test(lop.navn)) return false; // rulleski om sommeren
  }
  return (lop.res.M?.length ?? 0) + (lop.res.K?.length ?? 0) >= REGLER.minDeltakere;
}

// Lister uten ekte tider (turklasser der alle får samme tid) eller med umulig fart tas ikke med.
const DOGN_TIDELER = 864_000;
const MAKS_FART = 40; // km/t
export function gyldigListe(liste, km) {
  const rader = (liste ?? []).filter((r) => r[3] > 0 && r[3] < DOGN_TIDELER);
  if (rader.length < REGLER.minDeltakere) return [];
  if (new Set(rader.map((r) => r[3])).size < 0.5 * rader.length) return [];
  if (km && rader[0][3] < (km / MAKS_FART) * 36_000) return [];
  return rader;
}

function rensLop(lop) {
  const res = { M: gyldigListe(lop.res?.M, lop.km), K: gyldigListe(lop.res?.K, lop.km) };
  return { ...lop, res };
}

// ---------- Klasser i samme arrangement ----------

const MANEDSNAVN = "januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember";

// Fjerner årstall og datoer fra løpsnavn: "Svalbard skimaraton 18.april 2026" -> "Svalbard skimaraton"
export function pentLopsnavn(navn) {
  return String(navn ?? "")
    .replace(/\s*[-–]\s*\d{4}-\d{2}-\d{2}\b/g, "")
    .replace(new RegExp(`,?\\s*\\d{1,2}\\.\\s*(${MANEDSNAVN})\\s*(\\d{4})?`, "gi"), "")
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/\s+-\s+[^–]*(stadion|arena)\b[^–]*/gi, "") // "Sjusjøen Skimarathon - Sjusjøen Langrennstadion"
    .replace(/\s+([,.])/g, "$1")
    .replace(/[\s,.–-]+$/g, "")
    .replace(/^[\s,.–-]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function stilart(navn, arrangement = "") {
  // "Ski Classics" og løp som heter "... Classic" sier ikke noe om stilarten
  let n = foldTekst(navn).replace(/ski classics?/g, " ");
  if (/classic/.test(foldTekst(arrangement))) n = n.replace(/classic/g, " ");
  if (/skoyt|skate|skating|fristil|freestyle|\bfri\b/.test(n)) return "F";
  if (/klassisk|classic|klassik/.test(n)) return "C";
  return "";
}

// Hos EQ er samme løp ofte delt i flere klasser (konkurranse, trim med tid, elite, motion).
// Klasser i samme arrangement med samme distanse og stilart slås sammen til én resultatliste,
// slik at alle måles mot den raskeste i løypa. Ellers ville vinneren av trimklassen få like
// mye som vinneren av konkurranseklassen.
export function slaSammenKlasser(lop) {
  const grupper = new Map();
  const ut = [];
  for (const l of lop) {
    const arr = l.kilde === "eq" ? l.id.split("-").slice(0, 2).join("-") : null;
    if (!arr) {
      ut.push(l);
      continue;
    }
    const delnavn = l.navn.includes(" – ") ? l.navn.split(" – ").slice(1).join(" – ") : "";
    const nokkel = `${arr}|${Math.round(l.km ?? 0)}|${stilart(delnavn, l.arrangement)}`;
    if (!grupper.has(nokkel)) grupper.set(nokkel, []);
    grupper.get(nokkel).push({ l, delnavn });
  }
  const perArr = new Map();
  for (const [nokkel, g] of grupper) {
    const arr = nokkel.split("|")[0];
    perArr.set(arr, (perArr.get(arr) ?? 0) + 1);
  }
  for (const [nokkel, g] of grupper) {
    const arr = nokkel.split("|")[0];
    const forste = g[0].l;
    const grunn = pentLopsnavn(forste.arrangement ?? forste.navn);
    let navn = grunn;
    if (perArr.get(arr) > 1) {
      // Flere distanser/stilarter: skill dem med distanse og stilart, eller klassenavnet
      const st = stilart(g[0].delnavn, forste.arrangement);
      const del = g.length === 1 ? pentLopsnavn(g[0].delnavn) : `${forste.km} km${st === "F" ? " fri" : st === "C" ? " klassisk" : ""}`;
      const forsteOrd = navnTokens(grunn)[0];
      navn = forsteOrd && navnTokens(del)[0] === forsteOrd ? del : `${grunn} – ${del}`;
    }
    const res = { M: [], K: [] };
    for (const { l } of g) for (const kj of ["M", "K"]) res[kj].push(...(l.res[kj] ?? []));
    for (const kj of ["M", "K"]) res[kj].sort((a, b) => a[3] - b[3]);
    ut.push({ ...forste, navn, klasser: g.length, res });
  }
  return ut;
}

// ---------- Samme løp fra flere kilder ----------

const GENERISKE = new Set(["ski", "skis", "marathon", "maraton", "skimaraton", "skimarathon", "loppet", "lopet", "rennet", "renn", "classic", "classics", "lauf", "race", "the", "and", "rundt", "freestyle", "skate", "skating", "klassisk", "fristil", "ski classics", "2025", "2026", "2027"]);

function navneord(navn) {
  return navnTokens(String(navn).replace(/\d+/g, " ")).filter((t) => t.length >= 4 && !GENERISKE.has(t));
}

export function sammeNavn(a, b) {
  const A = navneord(a);
  const B = navneord(b);
  return A.some((x) => B.some((y) => x === y || (x.length >= 5 && y.length >= 5 && (x.startsWith(y.slice(0, 5)) || y.startsWith(x.slice(0, 5))))));
}

function dagerMellom(a, b) {
  return Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
}

// Ski Classics-løp som også finnes hos tidtakeren (EQ, Birken, Vasaloppet) slås sammen:
// tidtakerens fullstendige liste beholdes, mens nivået, datoen og FIS-kodene hentes fra Ski Classics.
export function slaSammenDuplikater(lop) {
  const primaere = lop.filter((l) => l.kilde !== "skiclassics");
  const ut = [...primaere];
  for (const sc of lop.filter((l) => l.kilde === "skiclassics")) {
    const kandidater = primaere.filter((p) => sammeNavn(p.navn, sc.navn) && dagerMellom(p.dato, sc.dato) <= (p.datoAnslatt ? 12 : 1.5));
    if (kandidater.length === 0) {
      ut.push(sc);
      continue;
    }
    // Flere distanser samme dag: velg den med flest av de samme løperne som hos Ski Classics
    const scNavn = new Set([...(sc.res.M ?? []), ...(sc.res.K ?? [])].map((r) => navnNokkel(r[0])));
    const treff = (p) => [...(p.res.M ?? []), ...(p.res.K ?? [])].filter((r) => scNavn.has(navnNokkel(r[0]))).length;
    const rangert = kandidater
      .map((k) => ({ k, t: treff(k), n: (k.res.M?.length ?? 0) + (k.res.K?.length ?? 0) }))
      .sort((a, b) => b.t - a.t || (b.k.km ?? 0) - (a.k.km ?? 0));
    const p = rangert[0].k;
    // Ski Classics slår ofte sammen flere klasser hos tidtakeren (elite + turklasse) i én liste.
    // Alle etapper der minst 20 % av løperne også står hos Ski Classics, får samme nivå.
    const like = rangert.filter((x) => x === rangert[0] || (x.t > 0 && x.t >= 0.2 * x.n)).map((x) => x.k);
    for (const q of like) {
      q.serie = sc.serie;
      q.scUrl = sc.url;
    }
    if (p.datoAnslatt && sc.dato) {
      // Løp samme helg flytter med (HalvBirken, SkøyteBirken, Vasaloppet 45 ...)
      const flytt = Date.parse(sc.dato) - Date.parse(p.dato);
      for (const q of primaere) if (q.kilde === p.kilde && q.datoAnslatt && q.ar === p.ar) q.dato = new Date(Date.parse(q.dato) + flytt).toISOString().slice(0, 10);
      p.datoAnslatt = false;
    }
    // FIS-koder fra Ski Classics til radene hos tidtakeren (samme kjønn og samme navn)
    for (const kj of ["M", "K"]) {
      const fisFraNavn = new Map((sc.res[kj] ?? []).filter((r) => r[6]).map((r) => [navnNokkel(r[0]), r[6]]));
      for (const q of like) for (const r of q.res[kj] ?? []) if (!r[6] && fisFraNavn.has(navnNokkel(r[0]))) r[6] = fisFraNavn.get(navnNokkel(r[0]));
    }
  }
  return ut;
}

// ---------- Hvem er hvem ----------

class Unionfinn {
  constructor(n) {
    this.forelder = Array.from({ length: n }, (_, i) => i);
  }
  finn(i) {
    while (this.forelder[i] !== i) i = this.forelder[i] = this.forelder[this.forelder[i]];
    return i;
  }
  slaSammen(a, b) {
    a = this.finn(a);
    b = this.finn(b);
    if (a !== b) this.forelder[Math.max(a, b)] = Math.min(a, b);
  }
}

function klubbLikhet(a, b) {
  const A = new Set(navnTokens(a).filter((t) => t.length >= 3));
  const B = navnTokens(b).filter((t) => t.length >= 3);
  return B.filter((t) => A.has(t)).length;
}

// rader: [{ navn, klubb, aar, eq, fis, nif, ... }] for ett kjønn. Returnerer person-indeks per rad.
export function kobleLopere(rader) {
  const uf = new Unionfinn(rader.length);
  const forste = new Map();
  const knytt = (nokkel, i) => {
    if (!nokkel) return;
    if (forste.has(nokkel)) uf.slaSammen(forste.get(nokkel), i);
    else forste.set(nokkel, i);
  };
  // 1) Sikre ID-er: EQ-person, FIS-kode og NIF-ID
  rader.forEach((r, i) => {
    knytt(r.eq && `eq:${r.eq}`, i);
    knytt(r.fis && `fis:${r.fis}`, i);
    knytt(r.nif && `nif:${r.nif}`, i);
  });
  // 2) Samme navn: grupper som ikke har motstridende fødselsår slås sammen
  const perNavn = new Map();
  rader.forEach((r, i) => {
    const n = navnNokkel(r.navn);
    if (!n) return;
    if (!perNavn.has(n)) perNavn.set(n, []);
    perNavn.get(n).push(i);
  });
  for (const indekser of perNavn.values()) {
    const grupper = new Map();
    for (const i of indekser) {
      const rot = uf.finn(i);
      if (!grupper.has(rot)) grupper.set(rot, { rot, aar: new Set(), klubber: [], antall: 0 });
      const g = grupper.get(rot);
      if (rader[i].aar) g.aar.add(rader[i].aar);
      if (rader[i].klubb) g.klubber.push(rader[i].klubb);
      g.antall++;
    }
    const medAar = [...grupper.values()].filter((g) => g.aar.size > 0);
    const utenAar = [...grupper.values()].filter((g) => g.aar.size === 0);
    // Grupper med samme fødselsår er samme person (f.eks. to EQ-kontoer)
    const perAar = new Map();
    for (const g of medAar) {
      const a = [...g.aar][0];
      if (perAar.has(a)) uf.slaSammen(perAar.get(a).rot, g.rot);
      else perAar.set(a, g);
    }
    const kjente = [...perAar.values()];
    for (const g of utenAar) {
      if (kjente.length === 0) {
        if (utenAar[0] !== g) uf.slaSammen(utenAar[0].rot, g.rot);
      } else if (kjente.length === 1) {
        uf.slaSammen(kjente[0].rot, g.rot);
      } else {
        // Flere personer med samme navn: velg den med mest lik klubb, ellers den mest aktive
        const best = kjente
          .map((k) => ({ k, likhet: g.klubber.reduce((s, kl) => s + Math.max(0, ...k.klubber.map((x) => klubbLikhet(x, kl))), 0) }))
          .sort((a, b) => b.likhet - a.likhet || b.k.antall - a.k.antall)[0];
        uf.slaSammen(best.k.rot, g.rot);
      }
    }
  }
  return rader.map((_, i) => uf.finn(i));
}

// ---------- Poeng ----------

export function distansevekt(km) {
  if (!km) return 1.0;
  for (const [grense, vekt] of REGLER.distanse) if (km >= grense) return vekt;
  return REGLER.distanse.at(-1)[1];
}

export function tidspoeng(vinnertid, tid) {
  return 100 * (vinnertid / tid) ** REGLER.eksponent;
}

export function bonus(plass) {
  return REGLER.bonus[plass - 1] ?? 0;
}

function nivaFor(lop) {
  if (lop.serie === "pro") return "pro";
  if (lop.serie === "challengers") return "challengers";
  if (lop.fis) return "fis";
  return "turrenn";
}

const runde1 = (x) => Math.round(x * 10) / 10;

function plasseringer(liste) {
  // Liste sortert på tid. Lik tid gir lik plass.
  const plass = [];
  liste.forEach((r, i) => (plass[i] = i > 0 && r[3] === liste[i - 1][3] ? plass[i - 1] : i + 1));
  return plass;
}

function hyppigst(verdier) {
  const telling = new Map();
  for (const v of verdier) if (v) telling.set(v, (telling.get(v) ?? 0) + 1);
  return [...telling.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// Regner ut rankingen for én sesong. lop: løp med res = { M: [...], K: [...] }
export function lagRanking(alleLop, { sesong, sesongNavn, oppdatert }) {
  const lop = slaSammenDuplikater(slaSammenKlasser(alleLop.map(rensLop).filter(erLanglop)))
    .filter(erLanglop)
    .sort((a, b) => a.dato.localeCompare(b.dato) || a.navn.localeCompare(b.navn, "nb"));

  const utLop = lop.map((l) => ({
    id: l.id,
    navn: l.navn,
    arrangement: l.arrangement ?? l.navn,
    dato: l.dato,
    km: l.km ?? null,
    land: l.land ?? null,
    sted: l.sted ?? null,
    kilde: l.kilde,
    niva: nivaFor(l),
    url: l.url,
    scUrl: l.scUrl ?? null,
    datoAnslatt: !!l.datoAnslatt,
    antall: { M: l.res.M?.length ?? 0, K: l.res.K?.length ?? 0 },
    vekt: {},
    felt: {},
  }));

  const kjonnUt = {};
  for (const kj of ["M", "K"]) {
    // Flat liste med alle resultater for kjønnet
    const rader = [];
    lop.forEach((l, li) => {
      const liste = l.res[kj] ?? [];
      if (liste.length < REGLER.minDeltakere) return;
      const plass = plasseringer(liste);
      liste.forEach((r, ri) =>
        rader.push({ li, plass: plass[ri], tid: r[3], vinnertid: liste[0][3], navn: r[0], klubb: r[1], nasjon: r[2], aar: r[4], eq: r[5], fis: r[6], nif: r[7] }),
      );
    });
    const person = kobleLopere(rader);

    // Grunnpoeng uten løpsvekt
    for (const r of rader) r.grunn = tidspoeng(r.vinnertid, r.tid) + bonus(r.plass);
    const nivaVekt = utLop.map((l) => REGLER.niva[l.niva] * distansevekt(l.km));
    let felt = utLop.map(() => 1);

    let sesongPoeng = new Map();
    const regnSesong = () => {
      for (const r of rader) r.poeng = runde1(r.grunn * nivaVekt[r.li] * felt[r.li]);
      // Beste resultat per person per løp (navnebrødre i samme løp)
      const perPerson = new Map();
      rader.forEach((r, i) => {
        const p = person[i];
        if (!perPerson.has(p)) perPerson.set(p, new Map());
        const m = perPerson.get(p);
        if (!m.has(r.li) || m.get(r.li).poeng < r.poeng) m.set(r.li, r);
      });
      sesongPoeng = new Map();
      for (const [p, m] of perPerson) {
        const beste = [...m.values()].sort((a, b) => b.poeng - a.poeng);
        beste.forEach((r, i) => (r.teller = i < REGLER.besteAntall));
        sesongPoeng.set(p, { sum: runde1(beste.slice(0, REGLER.besteAntall).reduce((s, r) => s + r.poeng, 0)), resultater: beste });
      }
      return perPerson;
    };

    let perPerson = regnSesong();
    for (let runde = 1; runde < REGLER.runder; runde++) {
      // Feltstyrke: hvor sterke er de ti beste i hvert løp, målt mot nr. 20 i rankingen
      const sortert = [...sesongPoeng.values()].map((v) => v.sum).sort((a, b) => b - a);
      const ref = sortert[Math.min(REGLER.feltReferanse, sortert.length) - 1] || 1;
      const topp = utLop.map(() => []);
      rader.forEach((r, i) => {
        if (r.plass <= REGLER.feltTopp && topp[r.li].length < REGLER.feltTopp) topp[r.li].push(Math.min(1, (sesongPoeng.get(person[i])?.sum ?? 0) / ref));
      });
      felt = topp.map((t) => REGLER.feltMin + (1 - REGLER.feltMin) * Math.min(1, t.reduce((s, x) => s + x, 0) / REGLER.feltTopp));
      perPerson = regnSesong();
    }

    utLop.forEach((l, li) => {
      if ((lop[li].res[kj]?.length ?? 0) >= REGLER.minDeltakere) {
        l.vekt[kj] = Math.round(nivaVekt[li] * felt[li] * 1000) / 1000;
        l.felt[kj] = Math.round(felt[li] * 1000) / 1000;
      }
    });

    // Én rad per person
    const radIndekserPerPerson = new Map();
    rader.forEach((_, i) => {
      const p = person[i];
      if (!radIndekserPerPerson.has(p)) radIndekserPerPerson.set(p, []);
      radIndekserPerPerson.get(p).push(i);
    });
    const personer = [];
    for (const [p, indekser] of radIndekserPerPerson) {
      const egne = indekser.map((i) => rader[i]);
      const s = sesongPoeng.get(p);
      const sisteKlubb = [...egne].sort((a, b) => utLop[b.li].dato.localeCompare(utLop[a.li].dato)).find((r) => r.klubb)?.klubb ?? "";
      const navn = hyppigst(egne.filter((r) => r.eq).map((r) => r.navn)) ?? hyppigst(egne.map((r) => r.navn));
      personer.push([
        navn,
        sisteKlubb,
        hyppigst(egne.map((r) => r.nasjon)),
        hyppigst(egne.map((r) => r.aar)),
        s.sum,
        s.resultater.length,
        Math.min(...s.resultater.map((r) => r.plass)),
        s.resultater
          .sort((a, b) => utLop[a.li].dato.localeCompare(utLop[b.li].dato))
          .map((r) => [r.li, r.plass, r.tid, r.poeng, r.teller ? 1 : 0]),
      ]);
    }
    personer.sort((a, b) => b[4] - a[4] || a[6] - b[6] || a[0].localeCompare(b[0], "nb"));
    kjonnUt[kj] = personer;
  }

  return {
    sesong,
    navn: sesongNavn,
    oppdatert,
    regler: REGLER,
    nivaNavn: NIVA_NAVN,
    felter: {
      lopere: ["navn", "klubb", "nasjon", "fodt", "poeng", "antallLop", "bestePlass", "resultater"],
      resultat: ["lopIndeks", "plass", "tidTideler", "poeng", "teller"],
    },
    lop: utLop,
    M: kjonnUt.M,
    K: kjonnUt.K,
  };
}

export { foldTekst };
