// Samjakt: i en periode jakter flere vald sammen. Brukes både i appen og på serveren.
// Perioden gjelder hele dager i norsk tid: fra og med «fra» til og med «til».

const OSLO = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Oslo', year: 'numeric', month: '2-digit', day: '2-digit' });

// Dagens dato i Norge som «ÅÅÅÅ-MM-DD», uansett hvilken tidssone telefonen står i.
export const osloDato = (naa = new Date()) => OSLO.format(naa);

export const erDato = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().startsWith(s);

export function status(s, idag = osloDato()) {
  if (idag < s.fra) return 'kommende';
  if (idag > s.til) return 'avsluttet';
  return 'aktiv';
}

export const aktive = (liste, idag = osloDato()) => (liste || []).filter((s) => status(s, idag) === 'aktiv');

// Samjakten(e) et vald er med i nå.
export const samjaktForVald = (vald, liste, idag = osloDato()) => aktive(liste, idag).filter((s) => s.vald.includes(vald));

// Kontroll av en ny samjakt fra admin. Returnerer feilmelding eller null.
export function valider(s, gyldigeVald) {
  if (!s || typeof s !== 'object') return 'Mangler data';
  if (!Array.isArray(s.vald)) return 'Velg vald';
  const vald = [...new Set(s.vald.map(Number))];
  if (vald.length < 2) return 'Velg minst to vald som skal jakte sammen';
  if (vald.some((v) => !gyldigeVald.includes(v))) return 'Ukjent vald';
  if (!erDato(s.fra) || !erDato(s.til)) return 'Ugyldig dato';
  if (s.til < s.fra) return 'Sluttdato kan ikke være før startdato';
  if (s.navn != null && (typeof s.navn !== 'string' || s.navn.length > 80)) return 'Navnet er for langt';
  return null;
}

const MND = ['jan.', 'feb.', 'mars', 'apr.', 'mai', 'juni', 'juli', 'aug.', 'sep.', 'okt.', 'nov.', 'des.'];
export function datoTekst(s) {
  const [, m, d] = s.split('-').map(Number);
  return `${d}. ${MND[m - 1]}`;
}
export const periodeTekst = (s) => (s.fra === s.til ? datoTekst(s.fra) : `${datoTekst(s.fra)}–${datoTekst(s.til)}`);
