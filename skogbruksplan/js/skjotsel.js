// Skjøtselsbehov: ungskogpleie og tynning – felles regler for kommuneanalysen (SR16-flater, js/kommuneanalyse.js)
// og planens «Innsikt» (bestand, js/innsikt.js), så samme skog får samme svar begge steder.
//   * Ungskogpleie: ungskog 1,5–7 m høy på bonitet ≥ 11 som er lauvdominert (≥ 30 % lauv) eller tett.
//   * Tynning: hogstklasse III, eller IV før 85 % av laveste hogstalder, på god nok bonitet (G14/F11/L17), 10–21 m
//     overhøyde og tett (≥ 150 trær/daa over 5 cm i SR16, eller grunnflate ≥ 28 m²/ha).
// Ingen DOM – testes i Node.
import { STANDARD_INNSTILLINGER, laavesteHogstalder, beregnetHogstklasse, hkGrenser, rotnettoPerM3, startTilstand, hogstklasseFor } from './model.js';

export const SKJOTSEL_KRITERIER = {
  ungMinHoyde: 1.5, ungMaksHoyde: 7,  // m
  ungMinTreantall: 100,        // trær per daa – SR16 ser dårlig småtrær, så tallet er lavere enn ved feltregistrering
  ungMinAndelLauv: 30,         // % lauv i ungskogen – lauvoppslag som konkurrerer med bartrærne
  ungMinBonitet: 11,           // på svært lav bonitet er ungskogpleie sjelden lønnsomt
  // Tynning (Skogkurs/skogeierlagene: lønner seg på middels og god bonitet, i tett skog, fra ca. 10–12 m overhøyde og
  // før skogen blir så høy at stormfellingsrisikoen øker – særlig i gran).
  tynnMinBonitetGran: 14, tynnMinBonitetFuru: 11, tynnMinBonitetLauv: 17, // lauv: bare de beste bjørkelokalitetene
  tynnMinOverhoyde: 10,        // m – førstegangstynning fra ca. 10–12 m overhøyde
  tynnMaksOverhoyde: 21,       // m – høyere skog: stormfelling og lite tilvekst igjen
  tynnMinTreantall: 150,       // trær/daa over 5 cm (SR16) – tett skog
  tynnMinGrunnflate: 28,       // m²/ha – eller høy grunnflate (fra treantall og middeldiameter)
  tynnMaksAlderAndel: 0.85,    // HK IV: bare når alderen er under denne andelen av laveste hogstalder
};
const TS = { G: 'gran', F: 'furu', L: 'lauv' };
// Grunnflate (m²/ha) fra treantall per daa og grunnflateveid middeldiameter (cm).
export const grunnflate = (treantallDaa, diameterCm) => (treantallDaa > 0 && diameterCm > 0 ? treantallDaa * 10 * Math.PI * (diameterCm / 200) ** 2 : null);

// f = { treslag, bonitet, alder, volumDaa, hoyde (middelhøyde), overhoyde, treantall, diameter, areal, andel: { G, F, L } i % }
// Gir { grunn } når ungskogen trolig trenger pleie, ellers null.
export function vurderUngskog(f, k = SKJOTSEL_KRITERIER) {
  if (f.hoyde == null || f.hoyde < k.ungMinHoyde || f.hoyde > k.ungMaksHoyde || !(f.bonitet >= k.ungMinBonitet)) return null;
  const grunner = [];
  const lauv = f.andel ? f.andel.L : (f.treslag === 'L' ? 100 : null);
  if (lauv != null && lauv >= k.ungMinAndelLauv) grunner.push(`${Math.round(lauv)} % lauv`);
  if (f.treantall >= k.ungMinTreantall) grunner.push(`tett (${Math.round(f.treantall)} trær/daa i SR16)`);
  return grunner.length ? { grunn: `Ungskog ${f.hoyde.toFixed(1).replace('.', ',')} m høy, bonitet ${f.bonitet}: ${grunner.join(', ')}` } : null;
}

// Gir { hk, grunnflate, uttakM3, rotnetto, metode, grunn, poeng } når tynning er aktuelt, ellers null.
// hk kan gis inn (registrert hogstklasse i planen); ellers beregnes den fra alder og bonitet.
export function vurderTynning(f, k = SKJOTSEL_KRITERIER, inn = STANDARD_INNSTILLINGER, { hk = null } = {}) {
  if (!f.treslag || !f.bonitet || f.alder == null) return null;
  const min = laavesteHogstalder({ treslag: f.treslag, bonitet: f.bonitet }, inn); if (!min) return null;
  const h = hk ?? beregnetHogstklasse(f.alder, min, f.volumDaa, hkGrenser({ treslag: f.treslag, bonitet: f.bonitet }, inn));
  const minBon = { G: k.tynnMinBonitetGran, F: k.tynnMinBonitetFuru, L: k.tynnMinBonitetLauv }[f.treslag] ?? k.tynnMinBonitetGran;
  const oh = f.overhoyde ?? f.hoyde; const gf = grunnflate(f.treantall, f.diameter);
  const tett = (f.treantall ?? 0) >= k.tynnMinTreantall || (gf ?? 0) >= k.tynnMinGrunnflate;
  if (!(h === 3 || (h === 4 && f.alder < k.tynnMaksAlderAndel * min)) || f.bonitet < minBon || oh == null || oh < k.tynnMinOverhoyde || oh > k.tynnMaksOverhoyde || !tett || !(f.volumDaa > 0)) return null;
  const uttakM3 = f.volumDaa * (f.areal || 0) * (inn.tynningUttak ?? 0.25);
  const tetthet = [(f.treantall ?? 0) >= k.tynnMinTreantall && `${Math.round(f.treantall)} trær/daa`, gf && `grunnflate ${Math.round(gf)} m²/ha`].filter(Boolean).join(', ');
  return {
    hk: h, minAlder: min, grunnflate: gf, uttakM3, rotnetto: uttakM3 * rotnettoPerM3(f.treslag, inn, true),
    metode: h === 3 && oh < 15 ? 'Førstegangstynning' : 'Tynning',
    grunn: `HK ${h === 3 ? 'III' : 'IV'}, ${TS[f.treslag]} bonitet ${f.bonitet}, overhøyde ${oh.toFixed(0)} m, ${tetthet}`,
    poeng: uttakM3 * (1 + Math.max(0, ((gf ?? 0) - k.tynnMinGrunnflate) / 20)),
  };
}

// Bestand i planen → samme felt som en SR16-flate (dagens alder og volum, overhøyde og diameter fra SR16 i ekstra).
export function bestandSomFlate(b, inn = STANDARD_INNSTILLINGER) {
  const s = startTilstand(b); const e = b.ekstra || {}; const tall = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  const a = b.treslagAndel; const andel = a ? { G: a.G * 100, F: a.F * 100, L: a.L * 100 } : null;
  return { treslag: b.treslag, bonitet: b.bonitet, alder: b.alder != null ? s.alder : null, volumDaa: s.volumDaa, hoyde: tall(b.hoyde), overhoyde: tall(e.OVERHOYDE), treantall: tall(b.treantall), diameter: tall(e.MIDDELDIAMETER), areal: b.areal || 0, andel, hk: hogstklasseFor(b, inn) };
}

const planlagt = (b, typer) => (b.tiltak || []).some((t) => typer.includes(t.type) && t.status !== 'utfort');
// Skjøtselsbehov i planen: bestand som trolig trenger ungskogpleie eller tynning og ikke har slikt tiltak planlagt.
// Miljøfigurer holdes utenfor. Gir { ungskog: [{ b, grunn }], tynning: [{ b, ...vurderTynning }] }.
export function skjotselsbehov(S, { inn = S?.innstillinger || STANDARD_INNSTILLINGER, k = SKJOTSEL_KRITERIER } = {}) {
  const ungskog = []; const tynning = [];
  for (const b of S?.bestand || []) {
    if (b.miljo || !b.treslag || !b.bonitet) continue;
    const f = bestandSomFlate(b, inn);
    if (f.hk === 2 && !planlagt(b, ['ungskogpleie'])) { const u = vurderUngskog(f, k); if (u) ungskog.push({ b, ...u }); }
    if ((f.hk === 3 || f.hk === 4) && !planlagt(b, ['tynning', 'sluttavvirkning', 'lukkethogst'])) { const t = vurderTynning(f, k, inn, { hk: f.hk }); if (t) tynning.push({ b, ...t }); }
  }
  return { ungskog, tynning: tynning.sort((x, y) => y.poeng - x.poeng) };
}

// Forslag til tiltak (til «Legg inn tiltak»): ungskogpleie i år, tynning neste år (førstegangstynning: prioritet 2).
export function skjotselsTiltak(behov, type, iAar = new Date().getFullYear()) {
  return (behov[type] || []).map((x) => (type === 'ungskog'
    ? { bid: x.b.id, tiltak: { type: 'ungskogpleie', aar: iAar, prioritet: 2, status: 'planlagt', kommentar: x.grunn, kilde: 'innsikt' } }
    : { bid: x.b.id, tiltak: { type: 'tynning', aar: iAar + 1, prioritet: x.metode === 'Førstegangstynning' ? 2 : 3, status: 'planlagt', kommentar: `${x.metode}: ${x.grunn}. Uttak ca. ${Math.round(x.uttakM3)} m³.`, kilde: 'innsikt' } }));
}
