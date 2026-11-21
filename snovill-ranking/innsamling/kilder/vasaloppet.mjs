// Vasaloppet-uka fra results.vasaloppet.se (Mika Timing). Resultatlistene er HTML, 100 rader per side.
import { hent, avkodHtml, snuNavn, tidTilTideler, logg } from "../felles.mjs";

const ROT = "https://results.vasaloppet.se";

// Konkurranseklassene som regnes som langløp (Öppet spår, Nattvasan, stafetter og ungdomsløp er utelatt).
const LOP = [
  { kode: "VL", navn: "Vasaloppet", km: 90, dagerForSondag: 0 },
  { kode: "VL45", navn: "Vasaloppet 45", km: 45, dagerForSondag: 5 },
  { kode: "VL30", navn: "Vasaloppet 30", km: 30, dagerForSondag: 4 },
  { kode: "TVT", navn: "Tjejvasan", km: 30, dagerForSondag: 8, bareKvinner: true },
];

// Vasaloppet går første søndag i mars. De andre løpene i Vasaloppsveckan legges relativt til den.
function vasaSondag(ar) {
  const d = new Date(Date.UTC(ar, 2, 1));
  d.setUTCDate(1 + ((7 - d.getUTCDay()) % 7));
  return d;
}

export async function finnLop({ fra, til }) {
  const ar = Number(til.slice(0, 4));
  const side = await hent(`${ROT}/${ar}/`, { tekst: true });
  if (!side) return [];
  const valg = [...side.matchAll(/<option value="([A-Z0-9Ö_]+)"[^>]*>([^<]+)<\/option>/g)].map((m) => m[1]);
  const ut = [];
  for (const l of LOP) {
    // Koden for årets løp ser ut som "VL_HCH8NDMR2600" (to siste siffer i året + 00)
    const kode = valg.find((v) => v.startsWith(`${l.kode}_`) && v.endsWith(`${String(ar).slice(2)}00`));
    if (!kode) continue;
    const dato = vasaSondag(ar);
    dato.setUTCDate(dato.getUTCDate() - l.dagerForSondag);
    ut.push({
      id: `vasa-${kode.toLowerCase()}`,
      kilde: "vasaloppet",
      kode,
      ar,
      navn: l.navn,
      arrangement: `${l.navn} ${ar}`,
      dato: dato.toISOString().slice(0, 10),
      datoAnslatt: l.kode !== "VL",
      km: l.km,
      land: "SWE",
      sted: "Sälen–Mora",
      bareKvinner: !!l.bareKvinner,
      url: `${ROT}/${ar}/?event=${kode}&pid=list`,
    });
  }
  const iPerioden = ut.filter((l) => l.dato >= fra && l.dato <= til);
  logg(`Vasaloppet: ${iPerioden.length} løp`);
  return iPerioden;
}

function lesSide(html) {
  const rader = [];
  const biter = html.split(/<li class="[^"]*list-group-item row[^"]*">/).slice(1);
  for (const bit of biter) {
    const plass = bit.match(/type-place[^>]*>\s*(\d+)\s*</)?.[1];
    const navnRa = bit.match(/type-fullname"><a[^>]*>(.*?)<\/a>/)?.[1];
    if (!plass || !navnRa) continue;
    const felt = (etikett) =>
      avkodHtml(bit.match(new RegExp(`list-label">${etikett}</div>(.*?)</div>`))?.[1] ?? "").replace(/^[-–]$/, "");
    const navnTekst = avkodHtml(navnRa);
    const nasjon = navnTekst.match(/\(([A-Z]{3})\)\s*$/)?.[1] ?? null;
    const navn = snuNavn(navnTekst.replace(/\s*\([A-Z]{3}\)\s*$/, ""));
    const tid = tidTilTideler(felt("Finish"));
    const klubb = felt("Team") || felt("Club/City") || felt("Club");
    if (tid) rader.push([navn, klubb, nasjon, tid, null, null, null, null]);
  }
  return rader;
}

export async function hentResultater(lop) {
  const res = { M: [], K: [] };
  for (const [kjonn, kode] of [["M", "M"], ["K", "W"]]) {
    if (lop.bareKvinner && kjonn === "M") continue;
    for (let side = 1; side < 400; side++) {
      const url = `${ROT}/${lop.ar}/?page=${side}&event=${lop.kode}&num_results=100&pid=list&search%5Bsex%5D=${kode}&search_sort=place_all&lang=EN_CAP`;
      const html = await hent(url, { tekst: true });
      const rader = html ? lesSide(html) : [];
      res[kjonn].push(...rader);
      if (rader.length < 100) break;
    }
    res[kjonn].sort((a, b) => a[3] - b[3]);
  }
  return res;
}
