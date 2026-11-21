// EQ Timing (live.eqtiming.com): de fleste norske turrenn og mange svenske langløp.
// Åpent JSON-API: /api/Events (søk), /api/Event/{id} (etapper), /api/Result/Gender/{id}/{etappe}/{male|female}
import { hent, penNavn, logg } from "../felles.mjs";

const API = "https://live.eqtiming.com/api";
// Langrenn, Turrenn, Längdskidor m.fl. (barn av "Cross Country Skiing" i EQ)
const SPORT_IDER = "2,138,258,267,276,377,419,277";

// Arrangementer som ikke er turrenn/langløp (karuseller, KM, ungdomsrenn, testarrangement osv.)
const IKKE_LANGLOP =
  /kopi|kopia|\btest|avlyst|påmelding|karusell|cuprenn|\bcup\b|backyard|terrengløp|rulleski|u\/tid|ute?n tid|utan tid|ingen tid|\bkm\b|\bnm\b|\bnnm\b|\bsm\b|mesterskap|mästerskap|festival|ungdom|barnas|barn |trenings|hodelykt|lysløype|kveldsrenn|onsdagsrenn|sprint|stafett|naborunden|skicross|langrennscross|spark|motbakke|uphill|bakkeløp/i;
// For etappenavn gjelder det samme, unntatt KM/NM (ellers faller "Turrenn 30 km" bort)
const IKKE_ETAPPE = new RegExp(IKKE_LANGLOP.source.replace("|\\bkm\\b|\\bnm\\b", ""), "i");
const IKKE_NIVA = new Set(["Kretsrenn", "Sonerenn", "Landsrenn", "Klubbrenn", "Nasjonalt"]);

export const MIN_KM = 20;

function kmFraNavn(navn) {
  const m = String(navn).match(/(\d+(?:[.,]\d+)?)\s*km/i);
  return m ? Number(m[1].replace(",", ".")) : 0;
}

export async function finnArrangementer({ fra, til }) {
  const url = `${API}/Events?dateFrom=${fra}&dateTo=${til}&sportIds=${SPORT_IDER}&take=5000`;
  const liste = (await hent(url)) ?? [];
  return liste
    .filter((e) => e.Meta?.GotResults)
    .filter((e) => !IKKE_LANGLOP.test(e.Name))
    .filter((e) => !IKKE_NIVA.has(e.Sportlevel?.Name))
    // Mai–oktober er det rulleski og løping, ikke skiløp
    .filter((e) => {
      const mnd = Number(e.Date.slice(5, 7));
      return mnd < 5 || mnd > 10;
    })
    .map((e) => ({
      eqId: e.Id,
      navn: e.Name.trim(),
      dato: e.Date.slice(0, 10),
      land: e.City?.Country?.Ioc ?? e.Organization?.Country?.Ioc ?? null,
      sted: e.City?.Name ?? null,
      fis: /FIS/i.test(e.Sportlevel?.Name ?? ""),
    }));
}

// Finner etappene (distansene) i et arrangement som er lange nok til å regnes som langløp.
export async function langeEtapper(arr) {
  const ev = await hent(`${API}/Event/${arr.eqId}`);
  if (!ev?.Etapper) return [];
  const stasjoner = Object.values(ev.StasjonsOppsett ?? {});
  const ut = [];
  for (const e of Object.values(ev.Etapper)) {
    if (e.VirtuellType !== 0 || e.Seksjon || e.GjemFraLive) continue;
    if (e.Type && e.Type !== "mass") continue; // turrenn har fellesstart / bølgestart
    if (IKKE_ETAPPE.test(e.Navn ?? "")) continue;
    let km = Number(e.Km) || kmFraNavn(e.Navn);
    if (km > 150) km = kmFraNavn(e.Navn) || kmFraNavn(arr.navn); // feilregistrert distanse (f.eks. 3000)
    if (!km) {
      const maks = Math.max(0, ...stasjoner.filter((s) => s.EtappeUID === e.UID).map((s) => Number(s.Km) || 0));
      km = maks || kmFraNavn(arr.navn);
    }
    if (km < MIN_KM) continue;
    ut.push({ etappeId: e.UID, etappeNavn: (e.Navn ?? "").trim(), km });
  }
  return ut;
}

function rad(item) {
  const d = item.Deltaker ?? {};
  const u = d.Utover ?? {};
  const lisens = Object.values(d.Lisens ?? {});
  const kode = (type) => lisens.find((l) => l.Type === type)?.Kode ?? null;
  const navn = penNavn(`${u.Fornavn ?? ""} ${u.Etternavn ?? ""}`);
  const klubb = (d.Klubbnavn || u.Klubb?.Navn || "").trim();
  // Klasser uten rangering har en plassholder i RangeringsTid; da brukes den faktiske tiden
  const DOGN = 86_400_000;
  const ms = [item.RangeringsTid, item.AkkumulertTidNetto, item.AkkumulertTid].find((t) => t > 0 && t < DOGN) ?? 0;
  const tid = Math.round(ms / 100); // ms -> tideler
  return [navn, klubb, u.Land?.IOC ?? null, tid, u.Aar || null, u.UID || null, kode("FISCODE"), kode("NIF PERSONID")];
}

async function kjonnsliste(eqId, etappeId, kjonn) {
  const data = await hent(`${API}/Result/Gender/${eqId}/${etappeId}/${kjonn}?count=20000`);
  return (data?.Items ?? [])
    .filter((i) => i.StatusTekst === "TIME")
    .map(rad)
    .filter((r) => r[0] && r[3] > 0)
    .sort((a, b) => a[3] - b[3]);
}

export async function hentResultater(arr, etappe) {
  const [M, K] = [await kjonnsliste(arr.eqId, etappe.etappeId, "male"), await kjonnsliste(arr.eqId, etappe.etappeId, "female")];
  return { M, K };
}

// Alle langløp fra EQ i perioden, som løpsbeskrivelser (uten resultater).
export async function finnLop(periode) {
  const arrangementer = await finnArrangementer(periode);
  logg(`EQ Timing: ${arrangementer.length} aktuelle arrangementer med resultater`);
  return arrangementer;
}

export function lopId(arr, etappe) {
  return `eq-${arr.eqId}-${etappe.etappeId}`;
}

export function lopUrl(arr) {
  return `https://live.eqtiming.com/${arr.eqId}#result`;
}

export function lopNavn(arr, etappe, antallEtapper) {
  const grunn = arr.navn.replace(/\s*[-–]\s*\d{4}-\d{2}-\d{2}\s*$/, "").trim();
  if (antallEtapper <= 1) return grunn;
  return `${grunn} – ${etappe.etappeNavn || `${etappe.km} km`}`;
}
