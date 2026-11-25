// Kommende renn: hvem som er påmeldt, og hvor sterke feltene er, ut fra rankingen i fjor og i år.
//
// Formpoeng = summen av de 8 beste løpspoengene fra forrige og inneværende sesong,
//             der løp fra forrige sesong teller 75 %.
// Feltstyrke for et kommende renn (per kjønn) = formpoengene til de 10 beste påmeldte,
//             i prosent av formpoengene til de 10 beste i hele rankingen (100 = hele toppen stiller).
import { kobleLopere, slaSammenKlasser, sammeNavn, pentLopsnavn, REGLER } from "./poeng.mjs";

export const KOMMENDE_REGLER = { fjorVekt: 0.75, beste: REGLER.besteAntall, styrkeTopp: 10, maksUtenPamelding: 3000 };

const runde1 = (x) => Math.round(x * 10) / 10;

function nivaFraTidligere(lop, rankinger) {
  for (const r of rankinger) {
    const like = r.data.lop.filter((l) => l.kilde === "eq" && sammeNavn(l.navn, lop.navn));
    if (like.length === 0) continue;
    const best = like.sort((a, b) => Math.abs((a.km ?? 40) - (lop.km ?? 40)) - Math.abs((b.km ?? 40) - (lop.km ?? 40)))[0];
    return best.niva;
  }
  return lop.fis ? "fis" : "turrenn";
}

// rankinger: [{ sesong, data }] (forrige og inneværende sesong, eldst først). data = lagRanking(...)
// kommendeLop: [{ id, kilde: "eq", navn, arrangement, dato, km, ..., res: { M: [rad...], K: [rad...] } }]
export function lagKommende(rankinger, kommendeLop, { oppdatert, iDag }) {
  const iaar = rankinger.at(-1)?.sesong;
  const lop = slaSammenKlasser(kommendeLop)
    .filter((l) => (l.res.M?.length ?? 0) + (l.res.K?.length ?? 0) > 0 && l.dato >= iDag)
    .sort((a, b) => a.dato.localeCompare(b.dato) || a.navn.localeCompare(b.navn, "nb"));

  const utLop = lop.map((l) => ({
    id: l.id,
    navn: pentLopsnavn(l.navn) || l.navn,
    dato: l.dato,
    km: l.km ?? null,
    land: l.land ?? null,
    sted: l.sted ?? null,
    niva: nivaFraTidligere(l, [...rankinger].reverse()),
    url: l.url,
    pamelding: l.pamelding ?? null,
    antall: {},
    rangerte: {},
    styrke: {},
    pameldte: {},
  }));

  const ut = { oppdatert, regler: KOMMENDE_REGLER, sesonger: rankinger.map((r) => ({ sesong: r.sesong, navn: r.data.navn })), lop: utLop };

  for (const kj of ["M", "K"]) {
    // Én rad per kjent person og sesong (med alle ID-ene), og én per påmeldt
    const rader = [];
    rankinger.forEach((r, si) => {
      r.data[kj].forEach((p, pi) => {
        const base = { navn: p[0], klubb: p[1], aar: p[3], gruppe: `s${si}:${pi}`, sesong: si, person: p, rank: pi + 1 };
        rader.push(base);
        const intern = p.intern ?? { eq: [], fis: [], nif: [] };
        for (const eq of intern.eq) rader.push({ ...base, eq, kopi: true });
        for (const fis of intern.fis) rader.push({ ...base, fis, kopi: true });
        for (const nif of intern.nif) rader.push({ ...base, nif, kopi: true });
      });
    });
    const forstePamelding = rader.length;
    lop.forEach((l, li) => {
      (l.res[kj] ?? []).forEach((r, j) => {
        rader.push({ navn: r[0], klubb: r[1], nasjon: r[2], aar: r[4], eq: r[5], fis: r[6], nif: r[7], gruppe: `p${li}:${j}`, pamelding: li });
      });
    });
    const klynge = kobleLopere(rader);

    // Samle per person (klynge)
    const personer = new Map();
    rader.forEach((r, i) => {
      if (r.kopi) return;
      const k = klynge[i];
      if (!personer.has(k)) personer.set(k, { sesonger: [], pameldt: new Set(), pameldtRad: null });
      const p = personer.get(k);
      if (r.pamelding !== undefined) {
        p.pameldt.add(r.pamelding);
        p.pameldtRad ??= r;
      } else p.sesonger.push(r);
    });

    const liste = [];
    for (const p of personer.values()) {
      const vektet = [];
      const perSesong = rankinger.map(() => null);
      for (const s of p.sesonger) {
        const vekt = rankinger[s.sesong].sesong === iaar ? 1 : KOMMENDE_REGLER.fjorVekt;
        for (const res of s.person.intern?.resultater ?? []) vektet.push(res.poeng * vekt);
        // Samme person to ganger i samme sesong (navnebrødre slått sammen): behold den beste
        if (!perSesong[s.sesong] || perSesong[s.sesong].rank > s.rank) perSesong[s.sesong] = s;
      }
      const form = runde1(vektet.sort((a, b) => b - a).slice(0, KOMMENDE_REGLER.beste).reduce((a, b) => a + b, 0));
      const nyeste = [...p.sesonger].sort((a, b) => b.sesong - a.sesong)[0];
      const pr = p.pameldtRad;
      liste.push({
        form,
        pameldt: p.pameldt,
        navn: nyeste?.person[0] ?? pr?.navn,
        klubb: pr?.klubb || nyeste?.person[1] || "",
        nasjon: nyeste?.person[2] ?? pr?.nasjon ?? null,
        fodt: nyeste?.person[3] ?? pr?.aar ?? null,
        sesong: perSesong.map((s) => (s ? [s.person[4], s.rank] : null)),
      });
    }
    liste.sort((a, b) => b.form - a.form || a.navn.localeCompare(b.navn, "nb"));
    const rangert = liste.filter((p) => p.form > 0);
    const toppSum = rangert.slice(0, KOMMENDE_REGLER.styrkeTopp).reduce((s, p) => s + p.form, 0) || 1;

    // Løperlisten: alle påmeldte med formpoeng, og de beste ellers
    const medIUt = rangert.filter((p, i) => p.pameldt.size > 0 || i < KOMMENDE_REGLER.maksUtenPamelding);
    const indeks = new Map(medIUt.map((p, i) => [p, i]));
    const formRank = new Map(rangert.map((p, i) => [p, i + 1]));
    ut[kj] = medIUt.map((p) => [p.navn, p.klubb, p.nasjon, p.fodt, p.form, formRank.get(p), ...p.sesong.flatMap((s) => s ?? [null, null])]);

    // Per renn: påmeldte sortert etter formpoeng; ukjente til slutt som [navn, klubb, født]
    utLop.forEach((l, li) => {
      const her = liste.filter((p) => p.pameldt.has(li));
      const kjente = her.filter((p) => p.form > 0);
      const ukjente = her.filter((p) => p.form === 0).sort((a, b) => a.navn.localeCompare(b.navn, "nb"));
      l.antall[kj] = her.length;
      l.rangerte[kj] = kjente.length;
      l.styrke[kj] = runde1((100 * kjente.slice(0, KOMMENDE_REGLER.styrkeTopp).reduce((s, p) => s + p.form, 0)) / toppSum);
      l.pameldte[kj] = [...kjente.map((p) => indeks.get(p)), ...ukjente.map((p) => [p.navn, p.klubb, p.fodt])];
    });
  }
  ut.felter = {
    lopere: ["navn", "klubb", "nasjon", "fodt", "formpoeng", "formrank", ...ut.sesonger.flatMap((s) => [`poeng ${s.navn}`, `rank ${s.navn}`])],
    pameldte: "indeks i løperlisten, eller [navn, klubb, født] for påmeldte uten resultater",
  };
  return ut;
}
