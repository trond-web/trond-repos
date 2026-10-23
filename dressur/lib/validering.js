// Kontroll av påmeldinger mot reglementet og stevnets oppsett.
import { MINSTEALDER, EN_KLASSE_PER_DAG } from '../public/js/beregning.js';

const tekst = (v, maks = 120) => String(v ?? '').trim().slice(0, maks);
const EPOST = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function rensRytter(r = {}) {
  return {
    navn: tekst(r.navn, 80), fodselsaar: Number(r.fodselsaar) || null, klubb: tekst(r.klubb, 80),
    lisens: tekst(r.lisens, 30), epost: tekst(r.epost, 120).toLowerCase(), tlf: tekst(r.tlf, 30),
  };
}
export function rensHest(h = {}) {
  return {
    navn: tekst(h.navn, 80), pass: tekst(h.pass, 40), fodselsaar: Number(h.fodselsaar) || null,
    kjonn: ['Hoppe', 'Vallak', 'Hingst'].includes(h.kjonn) ? h.kjonn : '',
    type: h.type === 'ponni' ? 'ponni' : 'hest', eier: tekst(h.eier, 80),
  };
}

// Aldersklasse for rytter etter fødselsår (KR I: alder regnes etter kalenderåret)
export function rytterKategori(fodselsaar, aar) {
  if (!fodselsaar) return '';
  const alder = aar - fodselsaar;
  if (alder <= 14) return 'Children';
  if (alder <= 18) return 'Junior';
  if (alder <= 21) return 'Ungrytter';
  if (alder <= 25) return 'U25';
  return 'Senior';
}

export function sjekkPamelding({ rytter, hest, klasseIder }, db, naa = new Date()) {
  const feil = [];
  const advarsler = [];
  if (!rytter.navn) feil.push('Rytterens navn mangler.');
  if (!EPOST.test(rytter.epost)) feil.push('Gyldig e-postadresse er påkrevd.');
  if (!rytter.fodselsaar || rytter.fodselsaar < 1920 || rytter.fodselsaar > naa.getFullYear()) feil.push('Rytterens fødselsår mangler eller er ugyldig.');
  if (!hest.navn) feil.push('Hestens navn mangler.');
  if (!hest.fodselsaar || hest.fodselsaar < 1980 || hest.fodselsaar > naa.getFullYear()) feil.push('Hestens fødselsår mangler eller er ugyldig.');
  if (!Array.isArray(klasseIder) || !klasseIder.length) feil.push('Velg minst én klasse.');
  if (feil.length) return { feil, advarsler };

  const klasser = klasseIder.map((id) => db.klasser.find((k) => k.id === id));
  if (klasser.some((k) => !k)) return { feil: ['Ukjent klasse.'], advarsler };
  const frist = db.stevne.pameldingsfrist ? new Date(db.stevne.pameldingsfrist) : null;
  const etter = frist && naa > frist;
  if (etter && !db.stevne.tillatEtteranmelding) feil.push('Påmeldingsfristen er ute.');

  const hestNokkel = (hest.pass || hest.navn).toLowerCase();
  const rytterNavn = rytter.navn.toLowerCase();
  for (const k of klasser) {
    const aar = Number(String(k.dato || naa.toISOString()).slice(0, 4));
    if (!k.apen) feil.push(`${k.navn}: klassen er stengt for påmelding.`);
    if (k.status && k.status !== 'planlagt') feil.push(`${k.navn}: klassen er allerede i gang.`);
    const prog = db.programmer.find((p) => p.id === k.programId);
    const nivaa = prog?.nivaa;
    const hestAlder = aar - hest.fodselsaar;
    if (MINSTEALDER[nivaa] && hestAlder < MINSTEALDER[nivaa]) feil.push(`${k.navn}: hesten må være minst ${MINSTEALDER[nivaa]} år i ${nivaa} (KR IV § 423).`);
    if (k.ponni && hest.type !== 'ponni') feil.push(`${k.navn}: klassen er bare for registrerte konkurranseponnier.`);
    if (k.minAlder && aar - rytter.fodselsaar < k.minAlder) feil.push(`${k.navn}: rytteren må være minst ${k.minAlder} år.`);
    if (k.maksAlder && aar - rytter.fodselsaar > k.maksAlder) feil.push(`${k.navn}: rytteren kan være høyst ${k.maksAlder} år.`);
    const dobbel = db.paameldinger.some((p) => p.klasseId === k.id && p.status !== 'trukket'
      && (p.hest.pass || p.hest.navn).toLowerCase() === hestNokkel && p.rytter.navn.toLowerCase() === rytterNavn);
    if (dobbel) feil.push(`${k.navn}: ekvipasjen er allerede påmeldt.`);
  }

  // § 424.3: hest i MA eller høyere kan bare starte én klasse per dag (gjelder alle klasser hesten går den dagen)
  const perDag = new Map();
  const tidligere = db.paameldinger.filter((p) => p.status !== 'trukket' && (p.hest.pass || p.hest.navn).toLowerCase() === hestNokkel)
    .map((p) => db.klasser.find((k) => k.id === p.klasseId)).filter(Boolean);
  for (const k of [...tidligere, ...klasser]) {
    if (!perDag.has(k.dato)) perDag.set(k.dato, []);
    perDag.get(k.dato).push(k);
  }
  for (const [dato, liste] of perDag) {
    const hoy = liste.filter((k) => EN_KLASSE_PER_DAG.includes(db.programmer.find((p) => p.id === k.programId)?.nivaa));
    if (hoy.length && liste.length > 1) feil.push(`Hest som starter MA eller høyere kan bare starte én klasse per dag (${dato}, KR IV § 424.3).`);
  }
  if (etter) advarsler.push('Etteranmelding – påmeldingsfristen er ute, og etteranmeldingsgebyr kan påløpe.');
  return { feil: [...new Set(feil)], advarsler, etteranmeldt: !!etter };
}
