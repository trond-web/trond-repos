// Utvalg av tiltak til et oppdrag – felles for SkogIQ Felt og fullversjonen. Tre innganger fyller samme utvalg:
// avkryssing i listen, trykk på et bestand i kartet og en tegnet flate (delt på bestandene). Finnes et ledig planlagt
// tiltak av typen i bestandet, brukes det; ellers lages et nytt. Alt kan angres steg for steg, og avbrytes utvalget,
// rulles endringene i planen tilbake. Ingen DOM – kan testes i Node.
import { OPPDRAGSTYPER, ledig } from './oppdrag.js';
import { TILTAKSTYPER, STANDARD_INNSTILLINGER } from './model.js';

export const HELT_ANDEL = 0.95; // tegnet flate som dekker mer enn dette, gjelder hele bestandet
export const MIN_DAA = 0.1;     // mindre biter av en tegnet flate (kanter mot nabobestand) tas ikke med

const typeNokkel = (t) => (OPPDRAGSTYPER[t] ? t : 'annet');
const r2 = (v) => Math.round(v * 100) / 100;
const dk = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

export function nyttUtvalg({ type, valgte = [] } = {}) { return { type, valgte: new Set(valgte), logg: [] }; }

// Kan det lages nye tiltak av denne oppdragstypen (fra kart eller tegning)?
export const kanLageTiltak = (type) => type !== 'annet' && !!TILTAKSTYPER[type];

// Ledige planlagte tiltak av typen, sortert etter år.
export function kandidater(S, type) {
  return S.bestand.flatMap((b) => (b.tiltak || []).filter((t) => typeNokkel(t.type) === type && ledig(t, S.oppdrag)).map((t) => ({ b, t })))
    .sort((x, y) => (x.t.aar || 0) - (y.t.aar || 0));
}

// Det tiltaket i bestandet som et trykk eller en tegning skal bruke: valgt fra før, ellers det tidligste ledige.
function tiltakI(S, u, b) {
  const liste = (b.tiltak || []).filter((t) => typeNokkel(t.type) === u.type);
  return liste.find((t) => u.valgte.has(t.id)) || liste.filter((t) => ledig(t, S.oppdrag)).sort((x, y) => (x.aar || 0) - (y.aar || 0))[0] || null;
}

// Status for bestandet i kartet: valgt, kandidat (har ledig tiltak), opptatt (tiltaket ligger i et annet aktivt
// oppdrag) eller tom.
export function bestandStatus(S, u, b) {
  const liste = (b.tiltak || []).filter((t) => typeNokkel(t.type) === u.type && t.status !== 'utfort');
  if (liste.some((t) => u.valgte.has(t.id))) return 'valgt';
  if (liste.some((t) => ledig(t, S.oppdrag))) return 'kandidat';
  if (liste.length) return 'opptatt';
  return 'tom';
}

function nyttTiltak(u, { nyId, iAar }) {
  return { id: nyId('t'), type: u.type, aar: iAar, prioritet: 2, status: 'planlagt', kilde: 'oppdrag', kommentar: 'Lagt til da oppdraget ble laget' };
}

// Trykk på et bestand: velg tiltaket, lag et nytt (hele bestandet) eller fjern bestandet fra utvalget.
// Gir { handling: 'valgt' | 'nytt' | 'fjernet' | 'opptatt' | 'ugyldig', tekst }.
export function trykkBestand(S, u, b, { nyId, iAar = new Date().getFullYear() } = {}) {
  const steg = [];
  const valgte = (b.tiltak || []).filter((t) => u.valgte.has(t.id));
  if (valgte.length) {
    for (const t of valgte) {
      u.valgte.delete(t.id); steg.push({ art: 'velg-av', id: t.id });
      // Tiltak som ble laget i dette utvalget, fjernes fra planen igjen.
      if (t.kilde === 'oppdrag' && u.logg.some((l) => l.steg.some((s) => s.art === 'nytt' && s.t === t))) {
        const i = b.tiltak.indexOf(t); b.tiltak.splice(i, 1); steg.push({ art: 'slett', b, t, i });
      }
    }
    return logg(u, steg, { handling: 'fjernet', tekst: `Bestand ${b.nr} er tatt ut.` });
  }
  const t = tiltakI(S, u, b);
  if (t) { u.valgte.add(t.id); steg.push({ art: 'velg', id: t.id }); return logg(u, steg, { handling: 'valgt', tekst: `Bestand ${b.nr}: ${TILTAKSTYPER[t.type]?.navn || t.type} ${t.aar ?? ''} er valgt.` }); }
  if ((b.tiltak || []).some((x) => typeNokkel(x.type) === u.type && x.status !== 'utfort')) {
    const o = (S.oppdrag || []).find((x) => (b.tiltak || []).some((y) => y.oppdragId === x.id && typeNokkel(y.type) === u.type));
    return { handling: 'opptatt', tekst: `Tiltaket i bestand ${b.nr} ligger allerede i oppdrag ${o?.nr || ''}.` };
  }
  if (!kanLageTiltak(u.type)) return { handling: 'ugyldig', tekst: `Bestand ${b.nr} har ikke noe ledig tiltak av denne typen.` };
  const ny = nyttTiltak(u, { nyId, iAar });
  b.tiltak = b.tiltak || []; b.tiltak.push(ny); u.valgte.add(ny.id);
  steg.push({ art: 'nytt', b, t: ny }, { art: 'velg', id: ny.id });
  return logg(u, steg, { handling: 'nytt', tekst: `Nytt tiltak: ${TILTAKSTYPER[u.type].navn} i bestand ${b.nr} (hele bestandet).` });
}

// Tegnet flate fordelt på bestandene ([{ b, daa, andel, geometri }] fra fordelPaaBestand): hvert bestand får tiltaket
// med flaten (eller hele bestandet når nesten alt er dekket) og blir valgt. Gir { antall, daa, nye, tekst }.
export function brukFlate(S, u, fordeling, { nyId, iAar = new Date().getFullYear(), minDaa = MIN_DAA, heltAndel = HELT_ANDEL } = {}) {
  const steg = []; let antall = 0; let daa = 0; let nye = 0; const opptatt = [];
  for (const f of fordeling) {
    if (f.daa < minDaa) continue;
    const b = f.b; let t = tiltakI(S, u, b);
    if (!t) {
      if ((b.tiltak || []).some((x) => typeNokkel(x.type) === u.type && x.status !== 'utfort')) { opptatt.push(b.nr); continue; }
      if (!kanLageTiltak(u.type)) continue;
      t = nyttTiltak(u, { nyId, iAar }); b.tiltak = b.tiltak || []; b.tiltak.push(t); steg.push({ art: 'nytt', b, t }); nye++;
    } else {
      steg.push({ art: 'endre', t, for: { dekning: t.dekning, arealDaa: t.arealDaa, helt: t.helt } });
    }
    const helt = f.andel >= heltAndel;
    if (helt) { delete t.dekning; delete t.arealDaa; delete t.helt; } else { t.dekning = f.geometri; t.arealDaa = r2(f.daa); t.helt = false; }
    if (!u.valgte.has(t.id)) { u.valgte.add(t.id); steg.push({ art: 'velg', id: t.id }); }
    antall++; daa += helt ? (b.areal || f.daa) : f.daa;
  }
  const tekst = antall ? `Flaten er lagt på ${antall} bestand (${dk(daa)} daa)${nye ? `, ${nye} nye tiltak` : ''}.${opptatt.length ? ` Bestand ${opptatt.join(', ')} ligger i et annet oppdrag.` : ''}`
    : opptatt.length ? `Bestand ${opptatt.join(', ')} ligger i et annet oppdrag.` : 'Flaten dekker ingen bestand.';
  if (steg.length) logg(u, steg, {});
  return { antall, daa, nye, tekst };
}

// Avkryssing i listen.
export function settValgt(u, id, paa) {
  if (paa === u.valgte.has(id)) return;
  if (paa) u.valgte.add(id); else u.valgte.delete(id);
  logg(u, [{ art: paa ? 'velg' : 'velg-av', id }], {});
}

function logg(u, steg, svar) { if (steg.length) u.logg.push({ steg, tekst: svar.tekst || '' }); return svar; }

function tilbake(u, steg) {
  for (const s of [...steg].reverse()) {
    if (s.art === 'velg') u.valgte.delete(s.id);
    else if (s.art === 'velg-av') u.valgte.add(s.id);
    else if (s.art === 'nytt') { const i = s.b.tiltak.indexOf(s.t); if (i >= 0) s.b.tiltak.splice(i, 1); }
    else if (s.art === 'slett') s.b.tiltak.splice(Math.min(s.i, s.b.tiltak.length), 0, s.t);
    else if (s.art === 'endre') for (const [k, v] of Object.entries(s.for)) { if (v === undefined) delete s.t[k]; else s.t[k] = v; }
  }
}

// Angrer siste steg. Gir true hvis noe ble angret.
export function angre(u) { const l = u.logg.pop(); if (!l) return false; tilbake(u, l.steg); return true; }
// Endrer planen seg (nye tiltak eller flater) – skal brukeren spørres før avbryt?
export const harEndringer = (u) => u.logg.some((l) => l.steg.some((s) => s.art === 'nytt' || s.art === 'endre' || s.art === 'slett'));
// Avbryter: alle endringer i planen rulles tilbake.
export function rullTilbake(u) { while (angre(u)); u.valgte.clear(); }
// Oppdraget er laget: endringene blir stående.
export function bekreft(u) { u.logg = []; }

// Valgte tiltak med bestand, i bestandsrekkefølge.
export function valgteLinjer(S, u) {
  return S.bestand.flatMap((b) => (b.tiltak || []).filter((t) => u.valgte.has(t.id)).map((t) => ({ bestand: b, tiltak: t })));
}

// Sum for bunnlinjen: antall tiltak og bestand, areal og anslått kostnad (kulturtiltak).
export function oppsummer(S, u, inn = STANDARD_INNSTILLINGER) {
  const ls = valgteLinjer(S, u);
  const daa = ls.reduce((s, { bestand: b, tiltak: t }) => s + (t.arealDaa ?? b.areal ?? 0), 0);
  const sats = inn.kostPerDaa?.[u.type] ?? STANDARD_INNSTILLINGER.kostPerDaa[u.type];
  return { tiltak: ls.length, bestand: new Set(ls.map((l) => l.bestand.id)).size, daa, kost: sats ? daa * sats : null };
}
