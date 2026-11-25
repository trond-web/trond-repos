#!/usr/bin/env node
// Samler inn resultater fra turrenn og langløp og lager rankingen for menn og kvinner.
//
//   node snovill-ranking/innsamling/hent.mjs [--data <mappe>] [--ut <mappe>] [--sesong 2025-26,2026-27] [--uten-nett]
//
// --data   Hvor løpsresultatene lagres (standard: snovill-ranking/data). Løp som er ferdige hentes aldri på nytt.
// --ut     Hvor rankingfilene skrives (standard: samme som --data).
// --sesong Hvilke sesonger. Standard: 2025-26 og sesongen vi er i nå.
// --uten-nett  Bare regn ut rankingen på nytt fra lagrede løp.
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sesongFor, sesongPeriode, sesongNavn, iParallell, logg } from "./felles.mjs";
import { lagRanking } from "./poeng.mjs";
import { lagKommende } from "./kommende.mjs";
import * as eq from "./kilder/eq.mjs";
import * as birken from "./kilder/birken.mjs";
import * as vasaloppet from "./kilder/vasaloppet.mjs";
import * as skiclassics from "./kilder/skiclassics.mjs";

const HER = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (navn, standard) => {
  const i = args.indexOf(navn);
  return i >= 0 ? args[i + 1] : standard;
};
const DATA = path.resolve(arg("--data", path.join(HER, "..", "data")));
const UT = path.resolve(arg("--ut", DATA));
const UTEN_NETT = args.includes("--uten-nett");
const FORSTE_SESONG = "2025-26";
const SESONGER = arg("--sesong", null)?.split(",") ?? [...new Set([FORSTE_SESONG, sesongFor(new Date())])].sort();
const I_DAG = new Date().toISOString().slice(0, 10);

// Et løp regnes som ferdig når det er minst tre dager siden, og det ble hentet etter det.
function erFerdig(dato, hentet) {
  const grense = new Date(Date.parse(dato) + 3 * 86_400_000).toISOString().slice(0, 10);
  return I_DAG >= grense && hentet >= grense;
}

async function lesJson(fil, standard = null) {
  try {
    return JSON.parse(await readFile(fil, "utf8"));
  } catch {
    return standard;
  }
}

async function skrivJson(fil, data) {
  await mkdir(path.dirname(fil), { recursive: true });
  await writeFile(fil, JSON.stringify(data));
}

async function samleSesong(sesong) {
  const periode = sesongPeriode(sesong);
  const mappe = path.join(DATA, "lop", sesong);
  const indeksFil = path.join(mappe, "_indeks.json");
  const indeks = await lesJson(indeksFil, {});
  const lagre = (id, lop) => skrivJson(path.join(mappe, `${id}.json`), lop);
  const ferdigLagret = async (id) => {
    const l = await lesJson(path.join(mappe, `${id}.json`));
    return l && erFerdig(l.dato, l.hentet);
  };
  const nyttFraKilde = [];
  const feilet = [];

  // --- EQ Timing ---
  try {
    const arrangementer = (await eq.finnLop(periode)).filter((a) => a.dato <= I_DAG);
    await iParallell(arrangementer, 4, async (arr) => {
      const nokkel = `eq-${arr.eqId}`;
      const kjent = indeks[nokkel];
      if (kjent && erFerdig(arr.dato, kjent.hentet) && (await Promise.all(kjent.lop.map(ferdigLagret))).every(Boolean)) return;
      try {
        const etapper = await eq.langeEtapper(arr);
        const ider = [];
        for (const et of etapper) {
          const res = await eq.hentResultater(arr, et);
          if (res.M.length + res.K.length === 0 || !eq.langNok(et, res)) continue;
          const id = eq.lopId(arr, et);
          ider.push(id);
          await lagre(id, {
            id,
            kilde: "eq",
            navn: eq.lopNavn(arr, et, etapper.length),
            arrangement: arr.navn,
            dato: arr.dato,
            km: et.km,
            land: arr.land,
            sted: arr.sted,
            fis: arr.fis,
            url: eq.lopUrl(arr),
            hentet: I_DAG,
            res,
          });
          nyttFraKilde.push(id);
        }
        indeks[nokkel] = { navn: arr.navn, dato: arr.dato, hentet: I_DAG, lop: ider };
      } catch (feil) {
        feilet.push(`${arr.navn}: ${feil.message}`);
      }
    });
  } catch (feil) {
    feilet.push(`EQ Timing: ${feil.message}`);
  }

  // --- Birken, Vasaloppet og Ski Classics ---
  for (const [navn, kilde] of [
    ["Birken", birken],
    ["Vasaloppet", vasaloppet],
    ["Ski Classics", skiclassics],
  ]) {
    let liste = [];
    try {
      liste = await kilde.finnLop(periode);
    } catch (feil) {
      feilet.push(`${navn}: ${feil.message}`);
      continue;
    }
    await iParallell(liste, 2, async (lop) => {
      if (lop.dato && lop.dato > I_DAG) return;
      if (indeks[lop.id]?.hoppOver && indeks[lop.id].hentet >= I_DAG.slice(0, 7)) return; // sjekkes på nytt hver måned
      if (await ferdigLagret(lop.id)) return;
      try {
        if (kilde === skiclassics) {
          const svar = await skiclassics.hentResultater(lop);
          const utenfor = !svar?.dato || svar.dato < periode.fra || svar.dato > periode.til;
          if (utenfor) indeks[lop.id] = { hoppOver: true, navn: lop.navn, dato: svar?.dato ?? null, hentet: I_DAG };
          if (utenfor || svar.dato > I_DAG) return;
          if (svar.res.M.length + svar.res.K.length === 0) return;
          const { raceId, postId, scSerie, sesong: _s, ...rest } = lop;
          await lagre(lop.id, { ...rest, dato: svar.dato, url: svar.url, km: null, hentet: I_DAG, res: svar.res });
        } else {
          const res = await kilde.hentResultater(lop);
          if (res.M.length + res.K.length === 0) return;
          const { kode, arr100, bareKvinner, ...rest } = lop;
          await lagre(lop.id, { ...rest, hentet: I_DAG, res });
        }
        nyttFraKilde.push(lop.id);
      } catch (feil) {
        feilet.push(`${lop.navn}: ${feil.message}`);
      }
    });
  }

  await skrivJson(indeksFil, indeks);
  logg(`${sesongNavn(sesong)}: ${nyttFraKilde.length} løp hentet nå, ${feilet.length} feil`);
  for (const f of feilet.slice(0, 30)) logg(`  feil: ${f}`);
}

async function lagSesongRanking(sesong) {
  const mappe = path.join(DATA, "lop", sesong);
  if (!existsSync(mappe)) return null;
  const filer = (await readdir(mappe)).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  const lop = (await Promise.all(filer.map((f) => lesJson(path.join(mappe, f))))).filter(Boolean);
  const ranking = lagRanking(lop, { sesong, sesongNavn: sesongNavn(sesong), oppdatert: new Date().toISOString() });
  await skrivJson(path.join(UT, `ranking-${sesong}.json`), ranking);
  logg(`${sesongNavn(sesong)}: ${ranking.lop.length} løp, ${ranking.M.length} menn og ${ranking.K.length} kvinner rangert`);
  rankinger.set(sesong, ranking);
  return { sesong, navn: sesongNavn(sesong), lop: ranking.lop.length, menn: ranking.M.length, kvinner: ranking.K.length };
}

const rankinger = new Map();

// Kommende renn med påmeldte (EQ Timing), rangert ut fra rankingen i fjor og i år.
// Listene hentes på nytt hver gang; siste versjon lagres så --uten-nett også virker.
async function lagKommendeRenn() {
  const iaar = sesongFor(new Date());
  const forrigeAr = Number(iaar.slice(0, 4)) - 1;
  const fjor = `${forrigeAr}-${String((forrigeAr + 1) % 100).padStart(2, "0")}`;
  const brukte = [fjor, iaar].filter((s) => rankinger.has(s)).map((s) => ({ sesong: s, data: rankinger.get(s) }));
  if (brukte.length === 0) return;
  const lager = path.join(DATA, "kommende", "eq.json");
  let kommende = await lesJson(lager, []);
  if (!UTEN_NETT) {
    try {
      const { til } = sesongPeriode(iaar);
      const arrangementer = await eq.finnKommende({ fra: I_DAG, til });
      const nye = [];
      await iParallell(arrangementer, 4, async (arr) => {
        try {
          const etapper = await eq.hentPameldte(arr);
          for (const et of etapper) {
            nye.push({
              id: eq.lopId(arr, et),
              kilde: "eq",
              navn: eq.lopNavn(arr, et, etapper.length),
              arrangement: arr.navn,
              dato: arr.dato,
              km: et.km,
              land: arr.land,
              sted: arr.sted,
              fis: arr.fis,
              url: `https://live.eqtiming.com/${arr.eqId}#contestants`,
              pamelding: arr.pamelding,
              res: { M: et.M, K: et.K },
            });
          }
        } catch (feil) {
          logg(`  feil: påmeldte ${arr.navn}: ${feil.message}`);
        }
      });
      kommende = nye;
      await skrivJson(lager, kommende);
    } catch (feil) {
      logg(`Kommende renn: ${feil.message} (bruker forrige liste)`);
    }
  }
  const ut = lagKommende(brukte, kommende, { oppdatert: new Date().toISOString(), iDag: I_DAG });
  await skrivJson(path.join(UT, "kommende.json"), ut);
  logg(`Kommende renn: ${ut.lop.length} renn, ${ut.lop.reduce((s, l) => s + l.antall.M + l.antall.K, 0)} påmeldte`);
}

const oversikt = [];
for (const sesong of SESONGER) {
  if (!UTEN_NETT) await samleSesong(sesong);
  const s = await lagSesongRanking(sesong);
  if (s) oversikt.push(s);
}
// Ta med sesonger som er lagret fra før, selv om de ikke ble oppdatert nå
if (existsSync(path.join(DATA, "lop"))) {
  for (const s of (await readdir(path.join(DATA, "lop"))).sort()) {
    if (!oversikt.some((o) => o.sesong === s) && /^\d{4}-\d{2}$/.test(s)) {
      const r = await lagSesongRanking(s);
      if (r) oversikt.push(r);
    }
  }
}
oversikt.sort((a, b) => b.sesong.localeCompare(a.sesong));
await lagKommendeRenn();
await skrivJson(path.join(UT, "sesonger.json"), { oppdatert: new Date().toISOString(), sesonger: oversikt.filter((o) => o.lop > 0) });
