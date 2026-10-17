// Identifisering i kartet: hvilke tiltaksflater og hvilket bestand ligger der brukeren trykket?
// Felles for SkogIQ Felt og fullversjonen. Ingen DOM.
import { TILTAKSTYPER } from './model.js';
import { punktIGeometri } from './proj.js';

export const FLATE_FARGE = { utfort: '#1f8f5a', planlagt: '#2a78d6' };
const aarFor = (t) => Number(String(t.utfortDato || t.aar || '').slice(0, 4)) || null;

// Tiltaksflater som vises i kartet: alle planlagte, og utførte de siste to årene.
export function synligeTiltaksflater(S, { iAar = new Date().getFullYear(), utfortAar = 2 } = {}) {
  const ut = [];
  for (const b of S?.bestand || []) for (const t of b.tiltak || []) {
    if (!t.dekning) continue;
    if (t.status === 'utfort' && (aarFor(t) ?? 0) < iAar - utfortAar) continue;
    ut.push({ b, t });
  }
  return ut;
}

// Alt som ligger i punktet: tiltaksflater (planlagte først, så nyeste utførte) og bestandet.
export function treffVed(S, lat, lon, opts = {}) {
  const pt = [lon, lat];
  const tiltak = synligeTiltaksflater(S, opts).filter(({ t }) => punktIGeometri(pt, t.dekning))
    .sort((x, y) => (x.t.status === 'utfort') - (y.t.status === 'utfort') || (aarFor(y.t) ?? 0) - (aarFor(x.t) ?? 0));
  const bestand = (S?.bestand || []).find((b) => b.geometri && punktIGeometri(pt, b.geometri)) || null;
  return { tiltak, bestand };
}

export function tiltakStil(t, valgt = false) {
  const utfort = t.status === 'utfort'; const f = utfort ? FLATE_FARGE.utfort : FLATE_FARGE.planlagt;
  return { color: valgt ? '#ffd400' : utfort ? '#0d4d30' : '#1d4f91', weight: valgt ? 4 : 1.6, dashArray: utfort ? null : '6 4', fillColor: f, fillOpacity: valgt ? 0.45 : 0.28, opacity: 0.95 };
}

const komma = (v, d = 1) => Number(v || 0).toLocaleString('nb-NO', { maximumFractionDigits: d, minimumFractionDigits: d });
const dato = (d) => (d ? new Date(d).toLocaleDateString('nb-NO') : '');
export const tiltakNavn = (t) => TILTAKSTYPER[t.type]?.navn || t.type;
export const KILDE_TEKST = { sporlogg: 'Sporlogg', motor: 'Tiltaksmotoren', manuell: 'Manuelt', import: 'Import' };

// Kort beskrivelse til lister og kort.
export function tiltakLinje(b, t) {
  const status = t.status === 'utfort' ? `utført ${dato(t.utfortDato) || t.aar}` : `planlagt ${t.aar ?? ''}`;
  const areal = t.arealDaa != null ? `${komma(t.arealDaa)} daa` : `hele bestandet (${komma(b.areal)} daa)`;
  return `${status} · ${areal}`;
}
export function tiltakDetaljer(b, t) {
  const rad = [];
  rad.push(['Status', t.status === 'utfort' ? `Utført${t.utfortDato ? ` ${dato(t.utfortDato)}` : ''}` : `Planlagt ${t.aar ?? ''}`]);
  rad.push(['Areal', t.arealDaa != null ? `${komma(t.arealDaa)} daa (${Math.round(Math.min(1, t.arealDaa / (b.areal || t.arealDaa)) * 100)} % av bestandet)` : `Hele bestandet (${komma(b.areal)} daa)`]);
  rad.push(['Bestand', `${b.nr}${b.treslag ? ` · ${b.treslag}${b.bonitet ?? ''}` : ''}`]);
  if (t.prioritet) rad.push(['Prioritet', `P${t.prioritet}`]);
  const kilde = t.sporIder?.length ? 'Sporlogg' : KILDE_TEKST[t.kilde] || (t.dekning ? 'Tegnet' : null);
  if (kilde) rad.push(['Registrert', kilde]);
  if (t.endret) rad.push(['Sist endret', dato(t.endret)]);
  return rad;
}
