// Felles hjelpefunksjoner for innsamlingen: nedlasting, sesonger og navn.

export const NETTLESER =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

const vent = (ms) => new Promise((r) => setTimeout(r, ms));

// Nedlasting med nye forsøk. Kildene er vanlige nettsider, så vi går rolig fram.
export async function hent(url, { tekst = false, forsok = 4, metode = "GET", body, headers = {} } = {}) {
  let sisteFeil;
  for (let i = 0; i < forsok; i++) {
    try {
      const svar = await fetch(url, {
        method: metode,
        body,
        headers: { "User-Agent": NETTLESER, Accept: tekst ? "text/html,*/*" : "application/json,*/*", ...headers },
        signal: AbortSignal.timeout(90_000),
      });
      if (svar.status === 404) return null;
      if (!svar.ok) throw new Error(`HTTP ${svar.status}`);
      const innhold = await svar.text();
      if (tekst) return innhold;
      return JSON.parse(innhold);
    } catch (feil) {
      sisteFeil = feil;
      await vent(1500 * 2 ** i);
    }
  }
  throw new Error(`Klarte ikke å hente ${url}: ${sisteFeil?.message}`);
}

// Kjører oppgaver med begrenset antall samtidige kall.
export async function iParallell(elementer, antall, fn) {
  const resultat = new Array(elementer.length);
  let neste = 0;
  async function arbeider() {
    while (neste < elementer.length) {
      const i = neste++;
      resultat[i] = await fn(elementer[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(antall, elementer.length) }, arbeider));
  return resultat;
}

// Sesongen går fra 1. juli til 30. juni. "2025-26" = vinteren 2025/2026.
export function sesongFor(dato) {
  const d = new Date(dato);
  const ar = d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${ar}-${String((ar + 1) % 100).padStart(2, "0")}`;
}

export function sesongPeriode(sesong) {
  const start = Number(sesong.slice(0, 4));
  return { fra: `${start}-07-01`, til: `${start + 1}-06-30` };
}

export function sesongNavn(sesong) {
  return sesong.replace("-", "/");
}

// Normalisering av navn slik at samme person kjennes igjen på tvers av kilder.
const TEGN = { æ: "ae", ø: "o", å: "a", ä: "a", ö: "o", ü: "u", é: "e", è: "e", ê: "e", á: "a", à: "a", í: "i", ó: "o", ú: "u", ñ: "n", ç: "c", š: "s", č: "c", ž: "z", ř: "r", ě: "e", ý: "y", ů: "u", ß: "ss", ł: "l", ō: "o" };

export function foldTekst(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[æøåäöüéèêáàíóúñçščžřěýůßłō]/g, (c) => TEGN[c] ?? c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function navnTokens(navn) {
  return foldTekst(navn)
    .replace(/[^a-z\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 0);
}

// Nøkkel uavhengig av rekkefølge: "Alnæs, Anikken Gjerde" == "Anikken Gjerde Alnæs"
export function navnNokkel(navn) {
  return navnTokens(navn).sort().join(" ");
}

// "Etternavn, Fornavn" -> "Fornavn Etternavn"
export function snuNavn(navn) {
  const m = String(navn).match(/^([^,]+),\s*(.+)$/);
  return m ? `${m[2].trim()} ${m[1].trim()}` : String(navn).trim();
}

// Pen visning av navn i store bokstaver ("TAUGBØL Håvard" -> "Taugbøl Håvard")
export function penNavn(navn) {
  return String(navn)
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((ord) =>
      ord === ord.toUpperCase() && ord.length > 1
        ? ord
            .toLowerCase()
            .replace(/(^|[-'])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())
        : ord,
    )
    .join(" ");
}

// "2:23:17.7" / "04:24:26" / "1:50:22,6" -> tidendeler av sekunder (heltall)
export function tidTilTideler(tekst) {
  const s = String(tekst ?? "").trim().replace(",", ".");
  const m = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  if (!m) return null;
  const sek = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return Math.round(sek * 10);
}

export function avkodHtml(s) {
  return String(s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

export function logg(...tekst) {
  console.log(`[langløp] ${tekst.join(" ")}`);
}
