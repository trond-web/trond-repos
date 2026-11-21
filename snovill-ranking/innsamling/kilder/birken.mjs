// Birkebeinerrennet m.fl. fra Birkens egen resultatservice (tiur.birken.no/embed/result.ashx).
// Tjenesten gir maks 750 rader per søk, så store lister deles opp på klasse og pulje.
import { hent, logg } from "../felles.mjs";

const ROT = "https://tiur.birken.no/embed";
const MAKS_PER_SOK = 750;

// Skiløpene som regnes som langløp. Arr100 er Birkens faste løpsnummer.
const LOP = {
  5: { km: 54, navn: "Birkebeinerrennet" },
  30: { km: 54, navn: "SkøyteBirken" },
  3: { km: 28, navn: "HalvBirken ski" },
};

let oppsettCache = null;
async function oppsett() {
  if (oppsettCache) return oppsettCache;
  const js = await hent(`${ROT}/result.ashx?m=fill&t=result&v=2`, { tekst: true });
  const liste = (navn) => JSON.parse(js.match(new RegExp(`${navn} = (\\[.*?\\]);`))?.[1] ?? "[]");
  oppsettCache = { arr: liste("brkArrList"), klasser: liste("brkKlasseList"), puljer: liste("brkPuljeList") };
  return oppsettCache;
}

// Tredje lørdag i mars brukes når datoen ikke finnes andre steder.
function tredjeLordagIMars(ar) {
  const d = new Date(Date.UTC(ar, 2, 1));
  const forsteLordag = 1 + ((6 - d.getUTCDay() + 7) % 7);
  return `${ar}-03-${String(forsteLordag + 14).padStart(2, "0")}`;
}

export async function finnLop({ fra, til }) {
  const vinterAr = Number(til.slice(0, 4));
  const { arr } = await oppsett();
  const ut = arr
    .filter((a) => a.SportId === 1 && a.ResYear === vinterAr && LOP[a.Arr100])
    .map((a) => ({
      id: `birken-${a.ArrId}`,
      kilde: "birken",
      arr100: a.Arr100,
      ar: a.ResYear,
      navn: LOP[a.Arr100].navn,
      arrangement: a.Navn,
      dato: tredjeLordagIMars(a.ResYear),
      datoAnslatt: true,
      km: LOP[a.Arr100].km,
      land: "NOR",
      sted: "Rena–Lillehammer",
      url: "https://birken.no/no/resultatservice",
    }))
    .filter((l) => l.dato >= fra && l.dato <= til);
  logg(`Birken: ${ut.length} løp`);
  return ut;
}

async function sok(filter) {
  const rader = [];
  let fra = 0;
  let maks = 0;
  for (;;) {
    const f = { ...filter, ...(fra ? { _resultatpunkt: String(fra) } : {}) };
    const url = `${ROT}/result.ashx?m=search&f=${encodeURIComponent(JSON.stringify(f))}&json=0`;
    // Svarene kan inneholde kontrolltegn (f.eks. tabulator i klubbnavn), som ikke er lov i JSON
    const svar = (await hent(url, { tekst: true }))?.replace(/[\u0000-\u001f]+/g, " ");
    if (!svar || svar.trim() === "[]") break;
    // Siste element er navigasjon med enkle anførselstegn, resten er gyldig JSON
    const nav = svar.match(/\{'_PgStart'.*?\}/)?.[0];
    const data = JSON.parse(svar.replace(/,?\{'_PgStart'.*?\}/, ""));
    rader.push(...data);
    const n = nav ? JSON.parse(nav.replace(/'/g, '"')) : null;
    maks = n?._ItemMax ?? rader.length;
    if (!n || n._PgDn < 0 || n._PgDn <= fra) break;
    fra = n._PgDn;
  }
  return { rader, maks };
}

// Henter alle rader for et filter, og deler opp når tjenesten kapper listen.
async function sokAlle(filter, nivaer) {
  const { rader, maks } = await sok(filter);
  if (maks < MAKS_PER_SOK || nivaer.length === 0) return rader;
  const [nokkel, verdier] = nivaer[0];
  const alle = [];
  for (const v of verdier) alle.push(...(await sokAlle({ ...filter, [nokkel]: v }, nivaer.slice(1))));
  return alle;
}

export async function hentResultater(lop) {
  const { klasser, puljer } = await oppsett();
  const ar = lop.ar;
  const klasseIder = klasser
    .filter((k) => k.ArrId === lop.arr100 && k.fromYear <= ar && k.toYear >= ar)
    .map((k) => k.ListeId);
  const puljeIder = [...new Set(puljer.filter((p) => p.ArrId === lop.arr100 && p.fromYear <= ar && p.toYear >= ar).map((p) => p.ListeId))];
  const res = {};
  for (const [kjonn, kode] of [["M", "M"], ["K", "K"]]) {
    const egne = klasseIder.filter((k) => k.startsWith(kode) || k === `${kode}E` || k.endsWith(kode));
    const rader = await sokAlle({ resyear: ar, arr: lop.arr100, sport: 1, kjonn: kode }, [
      ["klasseid", egne],
      ["puljeid", puljeIder],
    ]);
    const sett = new Map();
    for (const r of rader) {
      if (r._Status || !/^\d+$/.test(String(r.Pl)) || !(r._TidSekunder > 0)) continue;
      sett.set(r._ResultId, [String(r.Person).trim(), String(r.Klubb ?? "").trim(), null, Math.round(r._TidSekunder / 10), null, null, null, null]);
    }
    res[kjonn] = [...sett.values()].sort((a, b) => a[3] - b[3]);
  }
  return res;
}
