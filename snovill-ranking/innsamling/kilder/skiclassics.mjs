// Ski Classics (skiclassics.com): Pro Tour (SC World Championship) og Challengers.
// Dekker de store langløpene ute i verden (Marcialonga, Jizerská, La Diagonela, König Ludwig Lauf ...).
// Løper-ID-en hos Ski Classics er FIS-koden, som også EQ Timing oppgir. Dermed kan løpere kobles sikkert.
import { hent, avkodHtml, tidTilTideler, logg } from "../felles.mjs";

const ROT = "https://skiclassics.com";
const AJAX = `${ROT}/wp-admin/admin-ajax.php`;
export const SERIER = { "pro-tour": "pro", challengers: "challengers" };

const MANEDER = { JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6, JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12 };

async function ajax(data) {
  const body = new URLSearchParams({ action: "filter_result" });
  for (const [k, v] of Object.entries(data)) if (k !== "agent") body.set(`data[${k}]`, v);
  body.set("agent", data.agent);
  return hent(AJAX, { metode: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
}

async function side(raceId) {
  return hent(`${ROT}/results/?race_id=${raceId}`, { tekst: true });
}

export async function finnLop({ til }) {
  const sesong = til.slice(0, 4); // Ski Classics nummererer sesongen etter vinteråret
  const ut = [];
  for (const [serie, kort] of Object.entries(SERIER)) {
    const svar = await ajax({ season: sesong, series: serie, agent: "series" });
    const start = svar?.gopp?.race_id;
    if (!start) continue;
    const html = await side(start);
    const valgt = html?.match(/<option value="(\d{4})" selected="selected">Season/)?.[1];
    if (valgt !== sesong) continue; // sesongen finnes ikke ennå
    const nedtrekk = html.match(/<select[^>]*name="races"[^>]*>([\s\S]*?)<\/select>/)?.[1] ?? "";
    for (const m of nedtrekk.matchAll(/data-post-id="(\d+)" value="(\d+)"[^>]*>([^<]+)</g)) {
      ut.push({ id: `sc-${m[2]}`, kilde: "skiclassics", serie: kort, scSerie: serie, sesong, postId: m[1], raceId: m[2], navn: avkodHtml(m[3]) });
    }
  }
  logg(`Ski Classics: ${ut.length} løp`);
  return ut;
}

function lesListe(html) {
  const rader = [];
  for (const m of html.matchAll(/<div class="result-list-item rank-\d+">([\s\S]*?)<span class="cntr[^"]*time-diff/g)) {
    const bit = m[1];
    const plass = bit.match(/<span class="rank">(\d+)<\/span>/)?.[1];
    const tid = tidTilTideler(bit.match(/<span class="time">([^<]+)<\/span>/)?.[1]);
    if (!plass || !tid) continue;
    const fis = bit.match(/\/skiers\/(\d+)/)?.[1] ?? null;
    const navn = avkodHtml(bit.match(/<span class="name">([\s\S]*?)<\/span>/)?.[1] ?? "");
    const nasjon = bit.match(/class="flag"[^>]*alt="([A-Z]{3})"/)?.[1] ?? null;
    const lag = avkodHtml(bit.match(/<span class="team">([\s\S]*?)<\/span>/)?.[1] ?? "");
    if (navn) rader.push([navn, lag, nasjon, tid, null, null, fis, null]);
  }
  return rader.sort((a, b) => a[3] - b[3]);
}

function lesDato(html) {
  const m = html.match(/\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER) (\d{1,2}) (\d{4})\b/);
  if (!m) return null;
  return `${m[3]}-${String(MANEDER[m[1]]).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

export async function hentResultater(lop) {
  const herrer = await side(lop.raceId);
  if (!herrer) return null;
  const dato = lesDato(herrer);
  const svar = await ajax({ season: lop.sesong, series: lop.scSerie, race_id: lop.raceId, race_post_id: lop.postId, gender: "W", agent: "gender" });
  const kvinneId = svar?.redirect && svar.redirect !== lop.raceId ? svar.redirect : null;
  const damer = kvinneId ? await side(kvinneId) : null;
  return {
    dato,
    url: `${ROT}/results/?race_id=${lop.raceId}`,
    res: { M: lesListe(herrer), K: damer ? lesListe(damer) : [] },
  };
}
