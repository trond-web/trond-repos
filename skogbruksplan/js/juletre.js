// 🎄 Juletresjekken: hvor på eiendommen finner man lettest et fint juletre? Ingen DOM – testes i Node.
// Aktiv hvert år fra 15. november til og med 23. desember (skrus av julaften).
//
// Hva er et fint juletre? Det finnes ingen norsk standard med tallgrenser. Norsk Juletre sine råd for valg av tre:
// symmetrisk med jevn, rund omkrets, tett barnål og greiner med jevn avstand, naturlig forhold mellom bredde og høyde,
// rett stamme med én topp, jevn avsmalning mot toppen, og ingen brukne eller døde greiner. Dansk sortering for
// juletrær (Prima / standard / usortert) krever i tillegg at toppskuddet er minst 25 cm på trær over 150 cm.
// I skogen betyr det (vurdert ut fra plandataene):
//   * Gran (eller furu som nest beste) i ungskog – trær på ca. 1,5–3 m står der middelhøyden er 1,5–5 m.
//   * Moderat bonitet: på svært høy bonitet blir skuddene lange og treet glissent; middels gir tette, kompakte trær.
//   * Ikke for tett: trær med lys rundt seg får grønne greiner helt ned. 150–500 trær/daa er gunstig.
//   * Kort vei til bilvei – treet skal bæres ut.
//   * Ikke i miljøfigurer/nøkkelbiotoper. Et bestand som skal ungskogpleies, er perfekt: treet skulle uansett ut.
// Felles for alt: hogg bare på egen eiendom eller med grunneierens tillatelse (allemannsretten gir ikke rett til det).
import { hogstklasseFor, treslagAndel, STANDARD_INNSTILLINGER } from './model.js';
import { middelhoyde } from './ungskog.js';
import { hoydeOm } from './tiltaksmotor.js';
import { treantallPerTreslag } from './treslag.js';

// Juletid: 15. november – 23. desember (måned 0-basert: 10 = november, 11 = desember).
export function erJuletid(d = new Date()) { const m = d.getMonth(); const dag = d.getDate(); return (m === 10 && dag >= 15) || (m === 11 && dag <= 23); }
export function dagerTilJul(d = new Date()) { const jul = new Date(d.getFullYear(), 11, 24); return Math.max(0, Math.ceil((jul - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5)); }

export const KRITERIER = [
  'Symmetrisk, med jevn og rund omkrets',
  'Tett barnål og greiner med jevn avstand – grønt helt ned',
  'Rett stamme med én topp, og jevn avsmalning mot toppen',
  'Naturlig forhold mellom bredde og høyde',
  'Ingen brukne eller døde greiner; toppskudd minst 25 cm på trær over 1,5 m',
];
export const KILDER = [
  { navn: 'Norsk Juletre: råd om valg av juletre (via Klikk.no)', url: 'https://www.klikk.no/bolig/vedlikehold/kjope-juletre-dette-ma-du-sjekke-2365381' },
  { navn: 'Dansk sortering for juletrær (AB 2011)', url: 'https://www.christmastree.dk/media/37180/Sorteringsbeskrivelse_AB_2011.pdf' },
];

const r1 = (x) => Math.round(x * 10) / 10;
const m1 = (x) => String(r1(x)).replace('.', ','); // 7,7 m
// Juletrescore for et bestand: { score 0–100, stjerner 0–5, hoyde, grunner: [...], uegnet: tekst | null, bonus }.
// avstandVei = meter til nærmeste bilvei (eller null).
export function juletreScore(b, { inn = STANDARD_INNSTILLINGER, avstandVei = null } = {}) {
  const g = [];
  if (b.miljo) return { score: 0, stjerner: 0, uegnet: 'Miljøfigur/nøkkelbiotop – la trærne stå', grunner: [] };
  const hk = hogstklasseFor(b, inn);
  const h = middelhoyde(b, { inn }).verdi ?? (hk && hk <= 2 ? hoydeOm(b, 0) : null);
  if (h == null) return { score: 0, stjerner: 0, uegnet: 'Mangler høyde', grunner: [] };
  if (hk >= 4 || h > 8) return { score: 0, stjerner: 0, hoyde: r1(h), uegnet: `Trærne er for store (${m1(h)} m) – juletrærne står i ungskogen`, grunner: [] };
  if (h < 0.8) return { score: 0, stjerner: 0, hoyde: r1(h), uegnet: `Trærne er for små ennå (${m1(h)} m)`, grunner: [] };
  // Høyde: middelhøyde 1,5–5 m gir mange trær på 1,5–3 m
  const fH = h >= 1.5 && h <= 5 ? 1 : h < 1.5 ? 0.55 : h <= 6.5 ? 0.6 : 0.3;
  g.push(fH === 1 ? `🎯 Middelhøyde ${m1(h)} m – mange trær i juletrehøyde (1,5–3 m)` : `Middelhøyde ${m1(h)} m – ${h < 1.5 ? 'litt små ennå' : 'mest større trær, let i kantene'}`);
  // Treslag: gran er klassikeren, furu går an
  const a = b.treslagAndel ? treslagAndel(b.treslagAndel) : { [b.treslag || 'G']: 1 };
  const gran = a.G || 0; const furu = a.F || 0;
  const fT = Math.max(gran >= 0.5 ? 1 : gran >= 0.2 ? 0.75 : 0, furu >= 0.5 ? 0.55 : 0, 0.15);
  g.push(gran >= 0.5 ? `🌲 Grandominert (${Math.round(gran * 100)} % gran)` : gran >= 0.2 ? `🌲 Innslag av gran (${Math.round(gran * 100)} %)` : furu >= 0.5 ? '🌲 Furu – et utradisjonelt, men fint juletre' : 'Lite gran – lauvskog gir ikke juletrær');
  // Bonitet: moderat gir tette, kompakte trær
  const bo = b.bonitet || 11;
  const fB = bo <= 14 ? (bo >= 8 ? 1 : 0.8) : bo <= 17 ? 0.85 : 0.65;
  g.push(fB === 1 ? `Bonitet ${bo}: moderat vekst gir tette, kompakte trær` : bo > 17 ? `Høy bonitet (${bo}): raske skudd kan gi glisne trær – se etter tette eksemplarer` : bo <= 14 ? `Bonitet ${bo}` : `Bonitet ${bo}: god vekst, se etter tette trær`);
  // Tetthet: trær med lys rundt seg er grønne helt ned
  let N = null; try { N = treantallPerTreslag(b, { inn }).for.sum; } catch { /* ingen data */ }
  const fN = N == null ? 0.85 : N < 80 ? 0.7 : N <= 500 ? 1 : N <= 900 ? 0.8 : 0.65;
  if (N != null) g.push(N <= 500 && N >= 80 ? `Passe tett (ca. ${Math.round(N)} trær/daa) – lys rundt trærne gir grønne greiner helt ned` : N > 500 ? `Tett (ca. ${Math.round(N)} trær/daa) – let langs kanter og åpninger` : `Glissent (ca. ${Math.round(N)} trær/daa) – få trær å velge mellom`);
  // Vei: treet skal bæres ut
  const fV = avstandVei == null ? 0.85 : avstandVei <= 150 ? 1 : avstandVei <= 400 ? 0.8 : avstandVei <= 800 ? 0.6 : 0.4;
  if (avstandVei != null) g.push(avstandVei <= 150 ? `🚗 Bare ${Math.round(avstandVei)} m fra bilvei` : `${Math.round(avstandVei)} m å bære til bilvei`);
  // Bonus: skal ungskogpleies uansett
  const pleie = (b.tiltak || []).some((t) => t.type === 'ungskogpleie' && t.status !== 'utfort');
  if (pleie) g.push('✂️ Ungskogpleie er planlagt – juletreet du tar, skulle uansett ut');
  const score = Math.round(Math.min(100, 100 * fH * fT * fB * fN * fV * (pleie ? 1.1 : 1)));
  return { score, stjerner: score >= 85 ? 5 : score >= 65 ? 4 : score >= 45 ? 3 : score >= 25 ? 2 : score > 0 ? 1 : 0, hoyde: r1(h), grunner: g, uegnet: null, bonus: pleie };
}

// De beste bestandene i planen: [{ b, ...score }] sortert, bare de med score > 0.
// min = laveste poengsum (20 = minst to stjerner nesten; lavere brukes som «det nærmeste du kommer»).
export function toppliste(bestand, { inn = STANDARD_INNSTILLINGER, avstand = () => null, antall = 8, min = 20 } = {}) {
  return (bestand || []).map((b) => ({ b, ...juletreScore(b, { inn, avstandVei: avstand(b) }) }))
    .filter((x) => x.score >= Math.max(1, min)).sort((x, y) => y.score - x.score || (y.b.areal || 0) - (x.b.areal || 0)).slice(0, antall);
}

const NISSE = [
  'Nissen anbefaler å ta med sag, tau og termos.',
  'Tips: Se etter trærne i kanten mot vei, myr eller åker – der får de lys fra alle kanter.',
  'Gå rundt treet før du sager: Fin side mot stua holder ikke – det skal være fint hele veien rundt.',
  'Rist treet: Faller det mye barnål nå, faller det enda mer på julaften.',
];
export const nisseTips = (i = Math.floor(Math.random() * NISSE.length)) => NISSE[i % NISSE.length];

// Avslutningen: et tips med glimt i øyet (vises under regelen om egen eiendom, så spøken er tydelig).
// Det første er en tilbakemelding fra en bruker.
const GLIMT = [
  'SkogIQ har hørt at de beste juletrærne nesten alltid står hos naboen. Men ikke stol på AI.',
  'Det perfekte juletreet finnes ikke. Det blir perfekt når det står i stua med pynt på.',
  'Jo lenger du leter, jo likere blir alle trærne i skumringen. Bestem deg før det blir mørkt.',
  'Treet ser alltid mindre ut i skogen enn i stua. Mål takhøyden før du drar.',
  'Den skjeve toppen kaller vi «sjarm». Den skjulte siden kaller vi «mot veggen».',
];
export const glimtTips = (i = Math.floor(Math.random() * GLIMT.length)) => GLIMT[i % GLIMT.length];
