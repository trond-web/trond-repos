// 🪵 Stolpepotensial: hvor på eiendommen står det sannsynligvis stolpetrær av furu? Ingen DOM – testes i Node.
//
// Kravene til stolpevirke (furu) fra stolpekjøperne, slik skogeierlagene beskriver dem:
//   * Lengde 8–24 m (7–25 m), diameter under bark i rot 17,5–48 cm og i topp 13–35 cm.
//   * Rett stamme – krok og sleng gir vrak. Ingen gankvist eller grov kvist, helt fri for råte og føyrer.
//   * Saktevoksende furu (tette årringer, tynn kvist, liten avsmalning). Bare rotstokker.
//   * 5–10 % av trærne i et godt bestand blir stolper. 2–3 trær per m³. Pris ca. 600–1 400 kr/m³, godt over sagtømmer.
//   * Stolpesynerne går fra oktober til juni.
// Den gamle forskriften om måling av stolpevirke (FOR-1974-07-24-1, opphevet 2001) brukes som rettesnor for feltsjekken:
// kvist under 30 % av diameteren, langkrok under 50 % av diameteren, føyrer høyst 10 % dypt, ovalitet høyst 1,2.
//
// Fra plandataene og SR16 (laser) kan vi se furuandel, høyde, diameter, alder, bonitet og avstand til vei – ikke krok,
// kvist eller råte. Resultatet er derfor en kandidatliste: «her er det verdt å sende en stolpesyner». Gran telles ikke.
import { hogstklasseFor, treslagAndel, STANDARD_INNSTILLINGER } from './model.js';
import { middelhoyde } from './ungskog.js';
import { hoydeOm } from './tiltaksmotor.js';

export const KRAV = [
  'Lengde 8–24 m, rotstokk',
  'Diameter under bark: 17,5–48 cm i rot og 13–35 cm i topp',
  'Rett stamme – krok og sleng gir vrak',
  'Ingen gankvist eller grov kvist (enkeltkvist under ca. 30 % av diameteren)',
  'Helt fri for råte og føyrer',
  'Saktevoksende furu: tette årringer, tynn kvist og liten avsmalning',
];
export const KILDER = [
  { navn: 'Viken Skog: På jakt etter stolper (2022)', url: 'https://www.viken.skog.no/aktuelt/artikler/pa-jakt-etter-stolper' },
  { navn: 'Viken Skog: Stort behov for stolper (2023)', url: 'https://www.viken.skog.no/aktuelt/artikler/stort-behov-for-stolper-%E2%80%93-gir-god-avkastning' },
  { navn: 'Glommen Mjøsen Skog: Rekordleveranse av stolper (2024)', url: 'https://www.glommen-mjosen.no/nyheter/rekordleveranse-av-stolper/' },
  { navn: 'Forskrift om måling av stolpevirke, kap. 3 (opphevet 2001)', url: 'https://lovdata.no/dokument/SFO/forskrift/1974-07-24-1/KAPITTEL_3' },
];
// Feltsjekk per tre (registrering i felt). Alle må være oppfylt for et stolpeemne.
export const SJEKK = [
  { id: 'rett', tekst: 'Rett – ingen krok eller sleng' },
  { id: 'kvist', tekst: 'Ingen gankvist, kvist under ca. 30 % av diameteren' },
  { id: 'rate', tekst: 'Ingen råte, føyrer eller tyri' },
  { id: 'dim', tekst: 'Minst 8 m til 13 cm toppdiameter' },
];
export const PRIS = { min: 600, maks: 1400 }; // kr/m³ til skogeier (omtrentlig)
export const ANDEL = { min: 0.05, maks: 0.1 }; // andel av furutrærne som kan bli stolper
export const SESONG = 'Stolpesynerne går fra oktober til juni.';

const r1 = (x) => Math.round(x * 10) / 10;
const k1 = (x) => String(r1(x)).replace('.', ',');
const tall = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

// Furuandelen (0–1) av volumet.
export function furuAndel(b) {
  const a = b.treslagAndel ? treslagAndel(b.treslagAndel) : null;
  if (a) return a.F || 0;
  const p = tall(b.ekstra?.FURU_PST); if (p != null) return p / 100;
  return b.treslag === 'F' ? 1 : 0;
}
// Overhøyde (m): SR16-overhøyden, ellers middelhøyden × 1,1, ellers vekstmodellen.
export function overhoyde(b, inn = STANDARD_INNSTILLINGER) {
  const o = tall(b.ekstra?.OVERHOYDE); if (o) return { verdi: o, kilde: 'SR16' };
  const m = middelhoyde(b, { inn }).verdi; if (m) return { verdi: r1(m * 1.1), kilde: 'middelhøyde' };
  try { const h = hoydeOm(b, 0); if (h > 0) return { verdi: r1(h * 1.1), kilde: 'modell' }; } catch { /* mangler data */ }
  return { verdi: null, kilde: null };
}
// Middeldiameter (cm, brysthøyde under bark): SR16, ellers fra middeltreet (volum / treantall) med formtall 0,45.
export function middeldiameter(b, inn = STANDARD_INNSTILLINGER) {
  const d = tall(b.ekstra?.MIDDELDIAMETER); if (d) return { verdi: d, kilde: 'SR16' };
  const v = tall(b.volumDaa); const n = tall(b.treantall); const h = middelhoyde(b, { inn }).verdi || (overhoyde(b, inn).verdi ? overhoyde(b, inn).verdi / 1.1 : null);
  if (!v || !n || !h || n < 5) return { verdi: null, kilde: null };
  const vTre = v / n; return { verdi: r1(100 * Math.sqrt(vTre / (0.45 * (Math.PI / 4) * h))), kilde: 'beregnet' };
}

// Stolpescore for et bestand: { score 0–100, stjerner 0–5, grunner, uegnet, h, d, furu }. avstandVei i meter (eller null).
export function stolpeScore(b, { inn = STANDARD_INNSTILLINGER, avstandVei = null } = {}) {
  const g = []; const uegnet = (tekst, ekstra = {}) => ({ score: 0, stjerner: 0, uegnet: tekst, grunner: [], ...ekstra });
  if (b.miljo) return uegnet('Miljøfigur/nøkkelbiotop – trærne skal stå');
  const furu = furuAndel(b);
  if (furu < 0.6) return uegnet(furu > 0 ? `For lite furu (${Math.round(furu * 100)} %) – stolper tas av furu` : 'Ikke furu – stolper tas av furu', { furu });
  const hk = hogstklasseFor(b, inn);
  if (hk && hk <= 3) return uegnet(`Hogstklasse ${['', 'I', 'II', 'III'][hk]} – trærne er for unge ennå`, { furu });
  const H = overhoyde(b, inn); const h = H.verdi;
  if (h == null) return uegnet('Mangler høyde', { furu });
  if (h < 16) return uegnet(`For lave trær (overhøyde ${k1(h)} m) – stolper krever minst 8 m til 13 cm topp`, { furu, h });
  const D = middeldiameter(b, inn); const d = D.verdi;
  // Furuandel
  const fF = furu >= 0.8 ? 1 : 0.85;
  g.push(`🌲 ${Math.round(furu * 100)} % furu`);
  // Høyde: 16 m gir korte stolper, fra 20 m de lange og godt betalte
  const fH = h >= 20 ? 1 : h >= 18 ? 0.85 : 0.7;
  g.push(`📏 Overhøyde ${k1(h)} m${H.kilde === 'SR16' ? ' (SR16)' : H.kilde === 'modell' ? ' (modell)' : ''} – ${h >= 20 ? 'gir lange stolper' : h >= 18 ? 'gir stolper i middels lengde' : 'gir korte stolper (8–10 m)'}`);
  // Diameter
  const fD = d == null ? 0.8 : d < 18 ? 0.3 : d < 20 ? 0.7 : d <= 40 ? 1 : d <= 48 ? 0.75 : 0.4;
  if (d != null) g.push(`⌀ Middeldiameter ca. ${Math.round(d)} cm${D.kilde === 'beregnet' ? ' (beregnet)' : ''} – ${d < 18 ? 'for tynne ennå' : d < 20 ? 'litt tynne' : d <= 40 ? 'passer stolpedimensjonene' : d <= 48 ? 'grove, men innenfor' : 'svært grove – mange blir for tykke'}`);
  // Bonitet: sakte vekst gir tette årringer og tynn kvist
  const bo = b.bonitet ?? null;
  const fB = bo == null ? 0.85 : bo >= 8 && bo <= 14 ? 1 : bo < 8 ? 0.85 : bo <= 17 ? 0.6 : 0.35;
  if (bo != null) g.push(fB === 1 ? `🐢 Bonitet F${bo}: sakte vekst gir tette årringer og tynn kvist` : bo < 8 ? `Bonitet F${bo}: svært sakte vekst – trærne blir ofte korte` : `Bonitet F${bo}: rask vekst gir grovere kvist og glisne årringer`);
  // Alder
  const al = tall(b.alder);
  const fA = al == null ? 0.8 : al >= 100 ? 1 : al >= 80 ? 0.9 : al >= 60 ? 0.6 : 0.35;
  if (al != null) g.push(`${al} år${al >= 80 ? ' – gammel furu, godt utgangspunkt' : ''}`);
  // Hogstklasse
  const fK = hk === 4 ? 0.85 : 1;
  // Vei: stolper over 12 m hentes med spesialbil
  const fV = avstandVei == null ? 0.9 : avstandVei <= 300 ? 1 : avstandVei <= 800 ? 0.85 : 0.7;
  if (avstandVei != null) g.push(avstandVei <= 300 ? `🚛 ${Math.round(avstandVei)} m fra bilvei` : `${Math.round(avstandVei)} m til bilvei – lange stolper trenger god vei`);
  const score = Math.round(Math.min(100, 100 * fF * fH * fD * fB * fA * fK * fV));
  return { score, stjerner: score >= 80 ? 5 : score >= 60 ? 4 : score >= 40 ? 3 : score >= 20 ? 2 : score > 0 ? 1 : 0, grunner: g, uegnet: null, furu, h, d, hKilde: H.kilde, dKilde: D.kilde };
}

// Anslag: antall stolper, m³ og merverdi mot vanlig tømmer (furu), som intervall. Null når det ikke kan anslås.
export function stolpeAnslag(b, s, { inn = STANDARD_INNSTILLINGER } = {}) {
  if (!s || s.stjerner < 2) return null;
  const n = tall(b.treantall); const areal = tall(b.areal); if (!n || !areal) return null;
  const furuTraer = n * areal * s.furu;
  const v = tall(b.volumDaa); const vTre = v && n ? v / n : null;
  const m3PerStolpe = vTre ? Math.min(0.5, Math.max(0.3, vTre * 0.85)) : 0.4; // 2–3 trær per m³
  const lo = Math.round(furuTraer * ANDEL.min); const hi = Math.round(furuTraer * ANDEL.maks); if (!hi) return null;
  const pris = inn.pris?.F ?? STANDARD_INNSTILLINGER.pris.F;
  const m3 = { min: r1(lo * m3PerStolpe), maks: r1(hi * m3PerStolpe) };
  return { stolper: { min: lo, maks: hi }, m3, merverdi: { min: Math.max(0, Math.round((m3.min * (PRIS.min - pris)) / 1000) * 1000), maks: Math.max(0, Math.round((m3.maks * (PRIS.maks - pris)) / 1000) * 1000) }, tommerpris: pris };
}

// De beste bestandene: [{ b, ...score, anslag }] sortert, bare med minst min poeng.
export function toppliste(bestand, { inn = STANDARD_INNSTILLINGER, avstand = () => null, antall = 10, min = 20 } = {}) {
  return (bestand || []).map((b) => { const s = stolpeScore(b, { inn, avstandVei: avstand(b) }); return { b, ...s, anslag: stolpeAnslag(b, s, { inn }) }; })
    .filter((x) => x.score >= Math.max(1, min)).sort((x, y) => y.score - x.score || (y.b.areal || 0) - (x.b.areal || 0)).slice(0, antall);
}

// Stolpetrær registrert i felt (registreringer med kategori «Stolpetre»), per bestand.
export const STOLPE_KATEGORI = 'Stolpetre';
export function feltStolper(registreringer = [], bestandId = null) {
  const l = registreringer.filter((r) => r.kategori === STOLPE_KATEGORI && (!bestandId || r.bestandId === bestandId));
  return { antall: l.reduce((s, r) => s + (r.stolpe?.antall || 1), 0), godkjent: l.filter((r) => SJEKK.every((k) => r.stolpe?.sjekk?.[k.id])).reduce((s, r) => s + (r.stolpe?.antall || 1), 0), registreringer: l };
}

// Melding til en stolpekjøper (chat eller e-post): bestandene med potensial.
export function befaringTekst(liste, { eiendom = '', kommune = '', navn = '' } = {}) {
  const linjer = liste.map((x) => `• Bestand ${x.b.nr}: ${'★'.repeat(x.stjerner)}${'☆'.repeat(5 - x.stjerner)} – ${k1(x.b.areal || 0)} daa, ${Math.round(x.furu * 100)} % furu, overhøyde ca. ${k1(x.h)} m${x.d ? `, ⌀ ca. ${Math.round(x.d)} cm` : ''}${x.anslag ? `, anslått ${x.anslag.stolper.min}–${x.anslag.stolper.maks} stolper` : ''}`);
  return {
    emne: `Stolpebefaring${eiendom ? ` – ${eiendom}` : ''}`,
    tekst: `🪵 Hei! Jeg ønsker en stolpebefaring${eiendom ? ` på ${eiendom}` : ''}${kommune ? ` (${kommune})` : ''}. SkogIQ.ai har funnet disse furubestandene med stolpepotensial:\n${linjer.join('\n')}\n\nAnslaget er fra plandata og laserdata – kvalitet (krok, kvist, råte) må sjekkes i skogen. Kan du ta en titt?${navn ? `\n\nHilsen ${navn}` : ''}`,
  };
}
