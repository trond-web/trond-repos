// Tetthetsklasse (a/b) i hogstklassen, som i SOSI-standarden «Skogbruksplan – bestand» (SP_HKL 21 = II a, 22 = II b):
//   HK I:      a = tilfredsstillende ryddet, b = ikke tilfredsstillende ryddet
//   HK II–V:   a = tilfredsstillende tetthet, b = mindre tilfredsstillende tetthet
// Registrert klasse (import eller manuelt) brukes alltid. Ellers beregnes den der dataene holder:
//   HK II:     treantall (etter regulering, før regulering, takst eller treantallsmodellen) mot minste plantetall i
//              forskriften § 7
//   HK III–V:  beregnes ikke – volum mot vekstmodellen er for usikkert (SR16 i fjellskog ligger ofte på 30–40 % av
//              modellen). Andelen vises som et hint, og klassen registreres fra planen eller i felt.
// Ingen DOM – kan testes i Node.
import { STANDARD_INNSTILLINGER, HK_ROMERTALL, startTilstand, volumKurve, beregnetHogstklasse, laavesteHogstalder, hkGrenser } from './model.js';
import { plantetall } from './tiltaksmotor.js';
import { fraSr16, treantallModell } from './ungskog.js';

export const TETTHET_NAVN = { a: 'tilfredsstillende tetthet', b: 'mindre tilfredsstillende tetthet' };
export const RYDDING_NAVN = { a: 'tilfredsstillende ryddet', b: 'ikke tilfredsstillende ryddet' };
export const VOLUM_HINT = 0.5;
export const tetthetNavn = (hk, k) => (hk === 1 ? RYDDING_NAVN : TETTHET_NAVN)[k] || '';

const hkFor = (b, inn) => { const s = startTilstand(b); return b.hogstklasse || beregnetHogstklasse(s.alder, laavesteHogstalder(b, inn), s.volumDaa, hkGrenser(b, inn)); };
const minTreantall = (ts, bo) => (ts === 'L' ? 100 : plantetall(ts, bo).min);

// { klasse: 'a' | 'b' | null, kilde: 'registrert' | 'beregnet' | null, grunnlag ('ungskog' = målte ungskogfelt,
// 'data' = treantall fra takst, 'modell' = treantallsmodellen i ungskog.js når SR16 bare har trær over 5 cm),
// forklaring, hint (HK III–V) }
export function tetthet(b, { inn = STANDARD_INNSTILLINGER, hk = null } = {}) {
  const h = hk ?? hkFor(b, inn);
  if (b.tetthetsklasse === 'a' || b.tetthetsklasse === 'b') return { klasse: b.tetthetsklasse, kilde: 'registrert', forklaring: tetthetNavn(h, b.tetthetsklasse) };
  if (h === 1) return { klasse: null, kilde: null, forklaring: 'Rydding vurderes i felt' };
  const s = startTilstand(b); const ts = b.treslag || 'G'; const bo = s.h40;
  if (h === 2) {
    const u = b.ungskog || {};
    const [N, hva, grunnlag] = u.treantallEtter != null ? [u.treantallEtter, 'etter regulering', 'ungskog'] : u.treantallFor != null ? [u.treantallFor, 'før regulering', 'ungskog'] : fraSr16(b) || b.treantall == null ? [Math.max(treantallModell(b).verdi, b.treantall || 0), 'beregnet (modell for alle stammer)', 'modell'] : [b.treantall, 'i bestandsdataene', 'data'];
    if (N == null) return { klasse: null, kilde: null, forklaring: 'Mangler treantall' };
    const min = minTreantall(ts, bo);
    const k = N >= min ? 'a' : 'b';
    return { klasse: k, kilde: 'beregnet', grunnlag, forklaring: `${Math.round(N)} trær/daa ${hva} – minst ${min} for ${ts}${bo} (forskriften § 7)` };
  }
  if (h >= 3 && b.volumDaa != null && s.alder > 0 && bo) {
    const normal = volumKurve(s.alder, bo, ts);
    const andel = normal > 0 ? s.volumDaa / normal : null;
    const hint = andel != null ? `${Math.round(s.volumDaa)} m³/daa er ${Math.round(andel * 100)} % av fullt bestokket skog ved ${Math.round(s.alder)} år og bonitet ${bo}${andel < VOLUM_HINT ? ' – kan tyde på mindre tilfredsstillende tetthet' : ''}` : 'Mangler data';
    return { klasse: null, kilde: null, forklaring: 'Ikke registrert – vurder i felt', hint, andel };
  }
  return { klasse: null, kilde: null, forklaring: 'Mangler volum eller alder' };
}

// «II a», «IV b» eller bare «III» når klassen ikke er kjent.
export function hkTekst(b, { inn = STANDARD_INNSTILLINGER, hk = null } = {}) {
  const h = hk ?? hkFor(b, inn); if (!h) return '';
  const k = tetthet(b, { inn, hk: h }).klasse;
  return `${HK_ROMERTALL[h]}${k ? ` ${k}` : ''}`;
}

// SOSI-koden for SP_HKL (11–52). Ukjent tetthet gir null.
export function sosiHkl(b, { inn = STANDARD_INNSTILLINGER, hk = null } = {}) {
  const h = hk ?? hkFor(b, inn); const k = h && tetthet(b, { inn, hk: h }).klasse;
  return h && k ? h * 10 + (k === 'a' ? 1 : 2) : null;
}
