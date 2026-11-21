// 🌍 Klimabalansen for hele gården: utslipp fra husdyr, jord, energi og innkjøpte innsatsfaktorer mot karbonbindingen
// i skogen. Tonn CO₂-ekvivalenter per år. Ingen DOM – testes i Node.
//
// Metode: IPCC 2006/2019 Tier 1 (Western Europe, kjølig klima), GWP100 fra IPCC AR5 som i Norges klimagassregnskap
// (CH₄ = 28, N₂O = 265). Nitrogen fra husdyr: normtallene i vedlegg 2 til gjødselforskriften (2026). Drenert myr:
// IPCC 2013 Wetlands Supplement (boreal). Skog: tilvekst minus avvirkning fra framskrivingen, med biomassefaktorene i
// js/karbon.js. Dette er et anslag for å se størrelsesorden og tiltak – for et sertifisert klimaregnskap brukes
// Klimakalkulatoren i Norsk Landbruksrådgivning.
import { verdier, forbalanse } from './husdyr.js';
import { KULTURER, sumGjodsling } from './skifteplan.js';
import { framskriv, sammendrag, STANDARD_INNSTILLINGER } from './model.js';
import { KARBON_FAKTOR } from './karbon.js';

export const GWP = { CH4: 28, N2O: 265 };
const N2O_N = 44 / 28; const C_CO2 = 44 / 12;
// Per dyr (per produsert dyr for slaktekylling, kalkun og slaktegris): metan fra fordøyelse og gjødsellager (kg CH₄/år),
// nitrogen i gjødsla (kg N/år, vedlegg 2) og N₂O-faktor på beite (EF3PRP: 0,02 storfe/gris/fjørfe, 0,01 sau/andre).
export const DYR_KLIMA = {
  melkeku: { ch4Fordoy: 117, ch4Gjodsel: 21, n: 139, efBeite: 0.02 },
  ammeku: { ch4Fordoy: 75, ch4Gjodsel: 10, n: 66, efBeite: 0.02 },
  ungdyr: { ch4Fordoy: 57, ch4Gjodsel: 6, n: 44, efBeite: 0.02 },
  okse: { ch4Fordoy: 57, ch4Gjodsel: 6, n: 44, efBeite: 0.02 },
  sau: { ch4Fordoy: 8, ch4Gjodsel: 0.19, n: 12, efBeite: 0.01 },
  geit: { ch4Fordoy: 5, ch4Gjodsel: 0.13, n: 16, efBeite: 0.01 },
  hest: { ch4Fordoy: 18, ch4Gjodsel: 1.56, n: 50, efBeite: 0.01 },
  ponni: { ch4Fordoy: 18, ch4Gjodsel: 1.56, n: 40, efBeite: 0.01 },
  alpakka: { ch4Fordoy: 8, ch4Gjodsel: 0.19, n: 12, efBeite: 0.01 },
  verpehone: { ch4Fordoy: 0, ch4Gjodsel: 0.03, n: 0.67, efBeite: 0.02 },
  slaktekylling: { ch4Fordoy: 0, ch4Gjodsel: 0.003, n: 0.03, efBeite: 0.02 },
  kalkun: { ch4Fordoy: 0, ch4Gjodsel: 0.036, n: 0.452, efBeite: 0.02 },
  purke: { ch4Fordoy: 1.5, ch4Gjodsel: 9, n: 51, efBeite: 0.02 },
  slaktegris: { ch4Fordoy: 0.45, ch4Gjodsel: 1.8, n: 3.2, efBeite: 0.02 },
};
// Øvrige faktorer (IPCC Tier 1 med mindre annet står).
export const FAKTOR = {
  efLager: 0.005,      // kg N₂O-N per kg N i gjødsellager (EF3, blaut- og fastgjødsel)
  fracGassLager: 0.2,  // andel N som fordamper fra lager og spredning (husdyrgjødsel og beite)
  fracGassMineral: 0.1, // andel N som fordamper fra mineralgjødsel
  ef1: 0.01,           // kg N₂O-N per kg N tilført jord (direkte)
  ef4: 0.01,           // kg N₂O-N per kg N som fordamper (indirekte)
  fracLeach: 0.3, ef5: 0.0075, // avrenning og indirekte N₂O fra den
  kalk: 0.44,          // t CO₂ per tonn kalkstein (12 % C)
  diesel: 2.66,        // kg CO₂ per liter
  strom: 0.017,        // kg CO₂e per kWh (norsk kraftmiks, anslag)
  myrAker: { c: 7.9, n2o: 13 }, myrEng: { c: 5.7, n2o: 9.5 }, // t CO₂-C og kg N₂O-N per ha og år (boreal)
  mineralProduksjon: 3.4, // kg CO₂e per kg N i innkjøpt mineralgjødsel (produksjon, anslag)
  kraftfor: 0.6,       // kg CO₂e per kg innkjøpt kraftfôr (anslag)
  dieselJord: { eng: 7, korn: 6, annet: 5 }, // l/daa når forbruket ikke er lagt inn (anslag)
  dieselSkog: 1.2,     // l/m³ avvirket (hogst og utkjøring, entreprenør)
};
export const STANDARD_KLIMA = { diesel: null, strom: null, kalk: null, myrAker: null, myrEng: null, medInnkjopt: true, medSkogdrift: true };
export const klimaInn = (S) => ({ ...STANDARD_KLIMA, ...(S?.klima || {}) });
const tall = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));

// Skogen: snitt for de neste 10 årene etter planen (tilvekst og avvirkning i m³), og CO₂ per m³ veid etter treslag.
export function skogBalanse(S, { iAar = new Date().getFullYear(), aar = 10 } = {}) {
  const bestand = S?.bestand || []; if (!bestand.length) return null;
  const inn = { ...STANDARD_INNSTILLINGER, ...(S.innstillinger || {}) };
  const sm = sammendrag(bestand, inn); const vol = sm.perTreslag; const sumV = (vol.G || 0) + (vol.F || 0) + (vol.L || 0);
  const faktor = sumV ? ((vol.G || 0) * KARBON_FAKTOR.G + (vol.F || 0) * KARBON_FAKTOR.F + (vol.L || 0) * KARBON_FAKTOR.L) / sumV : KARBON_FAKTOR.G;
  const { aarRader } = framskriv(bestand, aar, inn, { startAar: iAar });
  const tilvekst = aarRader.reduce((s, r) => s + r.tilvekst, 0) / aarRader.length; const avvirkning = aarRader.reduce((s, r) => s + r.avvirkning, 0) / aarRader.length;
  return { tilvekst, avvirkning, faktor, bindingT: tilvekst * faktor, uttakT: avvirkning * faktor, nettoT: (tilvekst - avvirkning) * faktor, areal: sm.areal, aar };
}

// Hele gårdens balanse. Positive tall = utslipp, negative = binding (t CO₂e/år).
export function klimabalanse(S, aar = new Date().getFullYear()) {
  const k = klimaInn(S); const poster = [];
  const post = (gruppe, navn, t, grunnlag = '', gass = 'CO₂') => { if (t && Number.isFinite(t)) poster.push({ gruppe, navn, t, grunnlag, gass }); };
  const dh = S?.skifteplan?.dyrehold;
  // Husdyr
  let ch4F = 0; let ch4Melk = 0; let ch4G = 0; let nInne = 0; let nBeite = 0; let n2oBeite = 0;
  for (const r of dh?.dyr || []) {
    const n = Number(r.antall) || 0; const d = DYR_KLIMA[r.slag]; if (!n || !d) continue;
    const v = verdier(r); const inne = v.inne / 12;
    ch4F += n * d.ch4Fordoy; if (r.slag === 'melkeku') ch4Melk += n * d.ch4Fordoy; ch4G += n * d.ch4Gjodsel * inne;
    nInne += n * d.n * inne; nBeite += n * d.n * (1 - inne); n2oBeite += n * d.n * (1 - inne) * d.efBeite;
  }
  post('Husdyr', 'Metan fra fordøyelsen', (ch4F * GWP.CH4) / 1000, `${Math.round(ch4F)} kg CH₄`, 'CH₄');
  post('Husdyr', 'Metan fra gjødsellageret', (ch4G * GWP.CH4) / 1000, `${Math.round(ch4G)} kg CH₄`, 'CH₄');
  const n2oLager = nInne * FAKTOR.efLager + nInne * FAKTOR.fracGassLager * FAKTOR.ef4;
  post('Husdyr', 'Lystgass fra gjødsellageret', (n2oLager * N2O_N * GWP.N2O) / 1000, `${Math.round(nInne)} kg N i gjødsla inne`, 'N₂O');
  const n2oBeiteTot = n2oBeite + nBeite * (FAKTOR.fracGassLager * FAKTOR.ef4 + FAKTOR.fracLeach * FAKTOR.ef5);
  post('Husdyr', 'Lystgass fra gjødsel på beite', (n2oBeiteTot * N2O_N * GWP.N2O) / 1000, `${Math.round(nBeite)} kg N på beite`, 'N₂O');
  // Jord: husdyrgjødsel som spres (N fra lageret minus det som fordamper der), og mineralgjødsel fra gjødslingsplanen.
  const nSpredt = nInne * (1 - FAKTOR.fracGassLager);
  let nMineral = 0; let jordbruk = 0; const arealer = { eng: 0, korn: 0, annet: 0 };
  for (const sk of S?.skifteplan?.skifter || []) {
    const kul = KULTURER[sk.vekster?.[aar]?.kultur]; if (!kul || kul.utenGjodsel) continue;
    const a = sk.areal || 0; jordbruk += a;
    arealer[['eng', 'beite', 'gronnfor'].includes(kul.gruppe) ? 'eng' : kul.gruppe === 'korn' ? 'korn' : 'annet'] += a;
    for (const g of sk.gjodsling || []) if (Number(g.aar) === aar && g.type === 'mineral') { const one = sumGjodsling({ gjodsling: [g] }, aar); nMineral += (one.Ntot || 0) * a; }
  }
  const n2oSpredt = nSpredt * (FAKTOR.ef1 + FAKTOR.fracGassLager * FAKTOR.ef4 + FAKTOR.fracLeach * FAKTOR.ef5);
  post('Jord', 'Lystgass fra spredt husdyrgjødsel', (n2oSpredt * N2O_N * GWP.N2O) / 1000, `${Math.round(nSpredt)} kg N`, 'N₂O');
  const n2oMin = nMineral * (FAKTOR.ef1 + FAKTOR.fracGassMineral * FAKTOR.ef4 + FAKTOR.fracLeach * FAKTOR.ef5);
  post('Jord', 'Lystgass fra mineralgjødsel', (n2oMin * N2O_N * GWP.N2O) / 1000, `${Math.round(nMineral)} kg N (gjødslingsplanen)`, 'N₂O');
  const kalk = tall(k.kalk); post('Jord', 'Kalking', (kalk || 0) * FAKTOR.kalk, kalk ? `${kalk} t kalk` : '');
  const myrA = tall(k.myrAker) || 0; const myrE = tall(k.myrEng) || 0;
  const myrT = (myrA / 10) * (FAKTOR.myrAker.c * C_CO2 + (FAKTOR.myrAker.n2o * N2O_N * GWP.N2O) / 1000) + (myrE / 10) * (FAKTOR.myrEng.c * C_CO2 + (FAKTOR.myrEng.n2o * N2O_N * GWP.N2O) / 1000);
  post('Jord', 'Dyrket myr (drenert torv)', myrT, myrA || myrE ? `${myrA + myrE} daa` : '');
  // Energi
  const dieselOppgitt = tall(k.diesel); const dieselAnslag = arealer.eng * FAKTOR.dieselJord.eng + arealer.korn * FAKTOR.dieselJord.korn + arealer.annet * FAKTOR.dieselJord.annet;
  const diesel = dieselOppgitt ?? dieselAnslag;
  post('Energi', 'Diesel i jordbruket', (diesel * FAKTOR.diesel) / 1000, `${Math.round(diesel)} l${dieselOppgitt == null ? ' (anslått fra arealet)' : ''}`);
  const strom = tall(k.strom); post('Energi', 'Strøm', ((strom || 0) * FAKTOR.strom) / 1000, strom ? `${strom} kWh` : '');
  // Skog
  const skog = skogBalanse(S, { iAar: aar });
  if (skog) {
    if (k.medSkogdrift) post('Skog', 'Diesel i hogst og utkjøring', (skog.avvirkning * FAKTOR.dieselSkog * FAKTOR.diesel) / 1000, `${Math.round(skog.avvirkning)} m³/år avvirket`);
    post('Skog', 'Binding i tilveksten', -skog.bindingT, `${Math.round(skog.tilvekst)} m³/år × ${skog.faktor.toFixed(2)} t CO₂/m³`);
    post('Skog', 'Karbon som går ut med hogsten', skog.uttakT, `snitt ${skog.aar} år etter planen`);
  }
  // Innkjøpt (utslipp hos produsenten – scope 3)
  if (k.medInnkjopt) {
    post('Innkjøpt', 'Produksjon av mineralgjødsel', (nMineral * FAKTOR.mineralProduksjon) / 1000, `${Math.round(nMineral)} kg N`);
    const fb = (dh?.dyr || []).length ? forbalanse(S, aar) : null; const kjopt = fb ? Math.max(0, fb.behov.kraftfor - fb.prod.korn) : 0;
    post('Innkjøpt', 'Innkjøpt kraftfôr', (kjopt * FAKTOR.kraftfor) / 1000, kjopt ? `${Math.round(kjopt)} kg (behov minus eget korn)` : '');
  }
  const sum = (f) => poster.filter(f).reduce((s, p) => s + p.t, 0);
  const utslipp = sum((p) => p.t > 0); const binding = -sum((p) => p.t < 0); const netto = utslipp - binding;
  const grupper = [...new Set(poster.map((p) => p.gruppe))].map((g) => ({ gruppe: g, t: sum((p) => p.gruppe === g) }));
  return { poster, grupper, utslipp, binding, netto, skog, jordbruk, dieselAnslatt: dieselOppgitt == null, aar, tiltak: tiltak(poster, skog, { nMineral, harMyr: myrA + myrE > 0, ch4MelkT: (ch4Melk * GWP.CH4) / 1000 }) };
}

// Tiltak med anslått effekt (t CO₂e/år).
function tiltak(poster, skog, { nMineral, harMyr, ch4MelkT = 0 }) {
  const t = (navn) => poster.find((p) => p.navn === navn)?.t || 0; const ut = [];
  if (ch4MelkT > 1) ut.push({ ikon: '🐄', navn: 'Fôrtilsetning som demper metan hos melkekyr (f.eks. 3-NOP)', effekt: ch4MelkT * 0.3, tekst: 'Kan redusere metan fra fordøyelsen med rundt 30 % hos melkekyr.' });
  if (t('Metan fra gjødsellageret') + t('Lystgass fra gjødsellageret') > 0.5) ut.push({ ikon: '♻️', navn: 'Lever husdyrgjødsla til biogass, eller dekk lageret', effekt: (t('Metan fra gjødsellageret') + t('Lystgass fra gjødsellageret')) * 0.6, tekst: 'Biogass og tett lager kutter mesteparten av metanet fra lageret, og biogassen erstatter fossil energi.' });
  if (nMineral > 0) ut.push({ ikon: '🌾', navn: 'Utnytt husdyrgjødsla bedre og kutt mineralgjødsel', effekt: (t('Lystgass fra mineralgjødsel') + t('Produksjon av mineralgjødsel')) * 0.2, tekst: 'Nedfelling, riktig tidspunkt og gjødsling etter behov (se Gjødsling) kan kutte rundt 20 % av mineralgjødsla.' });
  if (harMyr) ut.push({ ikon: '💧', navn: 'Ikke dyrk opp mer myr – vurder å legge vått eller bruke til eng', effekt: t('Dyrket myr (drenert torv)') * 0.3, tekst: 'Drenert myr er ofte gårdens største utslipp. Eng gir mindre utslipp enn åker, og heving av grunnvannet kutter mer.' });
  if (skog) ut.push({ ikon: '🌲', navn: 'Klimatiltak i skogen: tettere planting, gjødsling og riktig hogsttidspunkt', effekt: skog.bindingT * 0.1, tekst: 'Se fanen Karbon. Tettere planting og gjødsling gir 10–20 % mer binding på sikt, og det finnes tilskudd til begge.' });
  if (t('Diesel i jordbruket') > 2) ut.push({ ikon: '⛽', navn: 'Biodiesel (HVO) eller mindre kjøring', effekt: t('Diesel i jordbruket') * 0.5, tekst: 'HVO kan erstatte diesel i de fleste traktorer og kutte utslippet kraftig.' });
  return ut.filter((x) => x.effekt > 0.05).sort((a, b) => b.effekt - a.effekt);
}
