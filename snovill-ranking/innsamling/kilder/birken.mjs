// Birkebeinerrennet m.fl. fra Birkens egen resultatservice (tiur.birken.no/embed/result.ashx).
// Tjenesten gir maks 750 rader per søk, så store lister deles opp på klasse og pulje.
import { hent, logg } from "../felles.mjs";

const ROT = "https://tiur.birken.no/embed";
const MAKS_PER_SOK = 750;
// Påmeldingslister / startlister ligger på en egen tjeneste med samme oppbygning (maks 1000 rader per søk)
const START_ROT = "https://start.birk.run/embed";
const MAKS_PER_STARTSOK = 1000;

// Skiløpene som regnes som langløp. Arr100 er Birkens faste løpsnummer.
const LOP = {
  5: { km: 54, navn: "Birkebeinerrennet" },
  30: { km: 54, navn: "SkøyteBirken" },
  3: { km: 28, navn: "HalvBirken ski" },
};

const oppsettCache = new Map();
async function oppsett(rot = ROT) {
  if (oppsettCache.has(rot)) return oppsettCache.get(rot);
  const js = await hent(`${rot}/result.ashx?m=fill&t=result&v=2`, { tekst: true });
  const liste = (navn) => JSON.parse(js.match(new RegExp(`${navn} = (\\[.*?\\]);`))?.[1] ?? "[]");
  const o = { arr: liste("brkArrList"), klasser: liste("brkKlasseList"), puljer: liste("brkPuljeList") };
  oppsettCache.set(rot, o);
  return o;
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

async function sok(filter, rot = ROT) {
  const rader = [];
  let fra = 0;
  let maks = 0;
  for (;;) {
    const f = { ...filter, ...(fra ? { _resultatpunkt: String(fra) } : {}) };
    const url = `${rot}/result.ashx?m=search&f=${encodeURIComponent(JSON.stringify(f))}&json=0`;
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
async function sokAlle(filter, nivaer, rot = ROT, maksPerSok = MAKS_PER_SOK) {
  const { rader, maks } = await sok(filter, rot);
  if (maks < maksPerSok || nivaer.length === 0) return rader;
  const [nokkel, verdier] = nivaer[0];
  const alle = [];
  for (const v of verdier) alle.push(...(await sokAlle({ ...filter, [nokkel]: v }, nivaer.slice(1), rot, maksPerSok)));
  return alle;
}

// ---------- Påmeldte (startlister) ----------

// Kommende Birken-løp med påmeldingsliste. Påmeldingslisten er også startlisten.
export async function finnKommende({ fra, til }) {
  const { arr } = await oppsett(START_ROT);
  const vinterAr = Number(til.slice(0, 4));
  return arr
    .filter((a) => a.SportId === 1 && a.ResYear === vinterAr && LOP[a.Arr100])
    .map((a) => ({
      id: `birken-${a.ArrId}`,
      kilde: "birken",
      arrId: a.ArrId,
      arr100: a.Arr100,
      ar: a.ResYear,
      navn: LOP[a.Arr100].navn,
      arrangement: a.Navn,
      dato: tredjeLordagIMars(a.ResYear),
      datoAnslatt: true,
      km: LOP[a.Arr100].km,
      land: "NOR",
      sted: "Rena–Lillehammer",
      url: "https://birken.no/no/startlister",
      pamelding: "https://birken.no/no/pamelding",
    }))
    .filter((l) => l.dato >= fra && l.dato <= til);
}

const IKKE_DELTAKER = new Set(["LEDU", "UTID"]); // ledsager og trim uten tid

export async function hentPameldte(lop) {
  const { klasser, puljer } = await oppsett(START_ROT);
  const ar = lop.ar;
  const klasseIder = klasser.filter((k) => k.ArrId === lop.arr100 && k.fromYear <= ar && k.toYear >= ar).map((k) => k.ListeId);
  const puljeIder = [...new Set(puljer.filter((p) => p.ArrId === lop.arr100 && p.fromYear <= ar && p.toYear >= ar).map((p) => p.ListeId))];
  const res = {};
  for (const kjonn of ["M", "K"]) {
    const egne = klasseIder.filter((k) => k.startsWith(kjonn) || k.endsWith(kjonn));
    const rader = await sokAlle({ arr: lop.arrId, sport: 1, kjonn }, [["klasseid", egne], ["puljeid", puljeIder]], START_ROT, MAKS_PER_STARTSOK);
    const sett = new Map();
    for (const r of rader) {
      if (IKKE_DELTAKER.has(r.KlasseId)) continue;
      const navn = `${String(r._Fornavn ?? "").trim()} ${String(r._Etternavn ?? "").trim()}`.trim();
      if (!navn) continue;
      const aar = Number(r["_Født"]) || null;
      const nokkel = `${navn}|${aar}|${r.KlasseId}`;
      sett.set(nokkel, [navn, String(r.Klubbnavn ?? "").trim(), r.Nat || null, 0, aar, null, null, null]);
    }
    res[kjonn] = [...sett.values()];
  }
  return res;
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
