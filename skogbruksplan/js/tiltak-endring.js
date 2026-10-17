// Endre og slette tiltak – felles for fullversjonen og SkogIQ Felt. Ingen DOM.
import { TILTAKSTYPER } from './model.js';

export const STATUSER = { planlagt: 'Planlagt', utfort: 'Utført' };

// Skjemafeltene for et tiltak (brukes til å fylle ut skjemaet).
export const skjemaVerdier = (b, t) => ({
  type: t.type, aar: t.aar ?? new Date().getFullYear(), status: t.status === 'utfort' ? 'utfort' : 'planlagt',
  utfortDato: t.utfortDato || '', arealDaa: t.arealDaa ?? '', helt: t.arealDaa == null || t.arealDaa >= (b.areal || 0), prioritet: t.prioritet ?? '', kommentar: t.kommentar || '',
});

// Kontrollerer og bruker endringene. Gir { ok, feil[] }. Endrer tiltaket bare når alt er gyldig.
export function endreTiltak(b, t, e, { idag = new Date().toISOString().slice(0, 10) } = {}) {
  const feil = [];
  const type = e.type ?? t.type;
  if (!TILTAKSTYPER[type]) feil.push('Ukjent tiltakstype.');
  const aar = Number(e.aar ?? t.aar);
  if (!Number.isInteger(aar) || aar < 1950 || aar > 2150) feil.push('Året må være et helt år, f.eks. 2027.');
  const status = e.status ?? t.status ?? 'planlagt';
  if (!STATUSER[status === 'utfort' ? 'utfort' : 'planlagt']) feil.push('Ukjent status.');
  let utfortDato = status === 'utfort' ? (e.utfortDato || t.utfortDato || idag) : undefined;
  if (utfortDato && !/^\d{4}-\d{2}-\d{2}$/.test(utfortDato)) feil.push('Datoen må være på formen ÅÅÅÅ-MM-DD.');
  if (utfortDato && utfortDato > idag) feil.push('Et utført tiltak kan ikke ha dato fram i tid.');
  let arealDaa = e.helt ? null : (e.arealDaa === '' || e.arealDaa == null ? t.arealDaa ?? null : Number(String(e.arealDaa).replace(',', '.')));
  if (arealDaa != null && (!Number.isFinite(arealDaa) || arealDaa <= 0)) feil.push('Arealet må være et tall over 0.');
  if (arealDaa != null && b.areal && arealDaa > b.areal * 1.05) feil.push(`Arealet kan ikke være større enn bestandet (${String(Math.round(b.areal * 10) / 10).replace('.', ',')} daa).`);
  const prioritet = e.prioritet === '' || e.prioritet == null ? t.prioritet : Number(e.prioritet);
  if (prioritet != null && ![1, 2, 3].includes(prioritet)) feil.push('Prioritet må være 1, 2 eller 3.');
  if (feil.length) return { ok: false, feil };
  if (arealDaa != null && b.areal && arealDaa >= b.areal * 0.995) arealDaa = null; // hele bestandet
  const byttetType = type !== t.type;
  t.type = type; t.aar = status === 'utfort' && utfortDato ? Number(utfortDato.slice(0, 4)) : aar; t.status = status === 'utfort' ? 'utfort' : 'planlagt';
  if (utfortDato) t.utfortDato = utfortDato; else delete t.utfortDato;
  if (arealDaa == null) { delete t.arealDaa; delete t.helt; } else t.arealDaa = Math.round(arealDaa * 100) / 100;
  if (prioritet != null) t.prioritet = prioritet;
  t.kommentar = String(e.kommentar ?? t.kommentar ?? '').trim();
  if (e.fjernDekning) { delete t.dekning; delete t.sporIder; }
  // Et tiltak som er endret for hånd, er ikke lenger motorens forslag (motoren erstatter det ikke).
  if (t.kilde === 'motor') { t.kilde = 'manuell'; t.endret = idag; }
  t.endret = idag;
  return { ok: true, feil: [], byttetType };
}

// Sletter tiltaket fra bestandet og fjerner koblinger fra oppdrag og sporlogger.
export function slettTiltak(S, b, t) {
  b.tiltak = (b.tiltak || []).filter((x) => x !== t);
  for (const o of S.oppdrag || []) o.linjer = (o.linjer || []).filter((l) => l.tiltakId !== t.id);
  for (const s of S.sporlogger || []) if (s.bestand?.includes(b.id) && !(b.tiltak || []).some((x) => (x.sporIder || []).includes(s.id))) s.bestand = s.bestand.filter((id) => id !== b.id);
  return true;
}

// Tekst til bekreftelsen før sletting.
export function slettTekst(b, t) {
  const navn = TILTAKSTYPER[t.type]?.navn || t.type;
  const deler = [`Slette ${navn.toLowerCase()} ${t.status === 'utfort' ? `utført ${t.utfortDato || t.aar}` : t.aar} i bestand ${b.nr}?`];
  if (t.oppdragId) deler.push('Tiltaket fjernes også fra oppdraget det ligger i.');
  if (t.dekning) deler.push('Den registrerte flaten (sporlogg) slettes også.');
  return deler.join(' ');
}
