// 🏡 Landbrukstakst (beregnet verdivurdering av hele landbrukseiendommen). Ingen DOM – testes i Node.
//
// Metoden følger det konsesjonsmyndighetene og landbrukstakstmenn bruker (konsesjonsloven §§ 9 og 9a, rundskriv
// M-1/2021 og M-3/2002): eiendommen deles opp, og hver del verdsettes med den metoden som passer:
//   * Jord og skog: avkastningsverdi (bruksverdi) – kapitalisert med 4 % (nedre grense for kapitaliseringsrenten).
//       - Skog: nåverdien av hogstinntektene per bestand (js/verdi.js) med 4 % rente, minus kapitalisert veivedlikehold.
//       - Dyrka mark og innmarksbeite: årlig netto per daa (dekningsbidrag minus faste kostnader og arbeidsvederlag)
//         delt på 4 %, med valgfritt tillegg for rasjonaliseringsgevinst (tilleggsjord).
//   * Utmark, jakt, fiske og andre rettigheter: kapitalisert årlig netto, ellers skjønnsbeløp.
//   * Bygninger: kostnadsverdi – nybyggpris med fradrag for alder, slitasje og egnethet (bruksverdi). Bare lovlig bruk.
//   * Boverdi: tillegg på boligen i attraktive boområder, høyst 1,5 mill. kr, og aldri opp mot vanlig boligpris.
// Variantene:
//   * Konsesjonsverdi / markedsverdi – fritt salg innenfor priskontrollen; brukes også ved skifte og lån.
//   * Odelstakst – verdien ved fritt salg, men med eiendommen brukt til landbruk (odelsloven § 49). Normalt betydelig
//     høyere enn åsetestakst.
//   * Åsetestakst – overtakelse på rimelige vilkår, slik at eiendommen lønner seg å drive som gårdsbruk: uten boverdi og
//     med et skjønnsmessig fradrag.
// Dette er en beregning, ikke en sertifisert takst: den bygger på plandata og det brukeren legger inn, uten befaring.
import { verdiberegning, STANDARD_VERDI } from './verdi.js';
import { utenProduksjon } from './verdi-ui.js';
import { STANDARD_INNSTILLINGER } from './model.js';

export const RENTE = 4; // % – nedre grense for kapitaliseringsrenten for jord og skog
export const BOVERDI_MAKS = 1500000;
export const PRISKONTROLL_GRENSE = 3500000; // under dette med brukbart bolighus: ingen priskontroll
export const KILDER = [
  { navn: 'Konsesjonsloven §§ 9, 9 a og 15 a (Lovdata – endret ved lov 6. juni 2025 nr. 27)', url: 'https://lovdata.no/lov/2003-11-28-98/§9a' },
  { navn: 'Rundskriv M-1/2021 Konsesjon, priskontroll og boplikt (justert 23. juni 2026)', url: 'https://www.regjeringen.no/no/dokumenter/konsesjon-priskontroll-og-boplikt/id2849398/' },
  { navn: 'Rundskriv M-3/2002 Priser på landbrukseiendommer ved konsesjon', url: 'https://www.regjeringen.no/no/dokumenter/m-32002-priser-pa-landbrukseiendommer-ve/id109014/' },
  { navn: 'Statsforvalteren: Priskontroll etter konsesjonsloven § 9a (2025)', url: 'https://prod.statsforvalteren.no/contentassets/f03ba78616de483bb0e008db6af238e9/digitalmoteplass-17.1.2025.-priskontroll-etter-konsesjonsloven.pdf' },
  { navn: 'Odelsloven § 49 (odelstakst)', url: 'https://lovdata.no/dokument/NL/lov/1974-06-28-58' },
];

// Standard nybyggpris per m² BTA og levetid er kalibrert mot vanlige landbrukstakster (bygninger på landbrukseiendom
// verdsettes lavere enn vanlige boliger). Kan endres per bygning (kr/m²) eller settes skjønnsmessig.
export const BYGG_TYPER = {
  vaaningshus: { navn: 'Våningshus', kvm: 22000, levetid: 80, bolig: true },
  kaarbolig: { navn: 'Kårbolig', kvm: 20000, levetid: 80, bolig: true },
  driftsbygning: { navn: 'Driftsbygning (husdyr/fôr)', kvm: 9000, levetid: 50 },
  redskapshus: { navn: 'Redskapshus / garasje', kvm: 5000, levetid: 40 },
  lager: { navn: 'Lager / annet uthus', kvm: 3500, levetid: 40 },
  annet: { navn: 'Annen bygning', kvm: 4000, levetid: 50 },
};
export const TILSTAND = { god: { navn: 'God – nyere eller godt vedlikeholdt', f: 1.15 }, normal: { navn: 'Normal', f: 1 }, darlig: { navn: 'Dårlig – trenger vedlikehold', f: 0.7 }, forfallen: { navn: 'Forfallen', f: 0.35 } };
// Bruksverdi for driftsbygninger: hvor godt bygningen passer driften (eller lovlig, godkjent alternativ bruk).
export const BRUKSVERDI = { hoy: { navn: 'Høy – passer dagens drift', f: 1 }, middels: { navn: 'Middels', f: 0.6 }, lav: { navn: 'Lav – lite egnet', f: 0.3 }, ingen: { navn: 'Ingen – står tom', f: 0.1 } };

export const VARIANTER = {
  konsesjon: { navn: 'Konsesjonsverdi / markedsverdi', kort: 'Konsesjon', bruk: 'Salg i åpent marked (priskontroll), skifte og lån' },
  odel: { navn: 'Odelstakst', kort: 'Odel', bruk: 'Odelsløsning – verdien ved fritt salg med eiendommen brukt til landbruk (odelsloven § 49)' },
  asete: { navn: 'Åsetestakst', kort: 'Åsete', bruk: 'Overtakelse på rimelige vilkår, slik at eiendommen lønner seg å drive som gårdsbruk' },
};

// Årlig netto per daa (kr) – kapitaliseres med 4 %: 140 kr/daa gir 3 500 kr/daa (kan endres; varierer mye med region).
export const STANDARD_TAKST = {
  formal: 'konsesjon',
  jord: { full: 140, overflate: 90, beite: 40, rasjonalisering: 0 },
  arealer: {}, // overstyring i daa: { full, overflate, beite }
  rettigheter: [
    { id: 'r-beite', navn: 'Utmarksbeite', aarlig: 0, belop: 0 },
    { id: 'r-jakt', navn: 'Jakt', aarlig: 0, belop: 0 },
    { id: 'r-fiske', navn: 'Fiske', aarlig: 0, belop: 0 },
  ],
  bygninger: [],
  boverdi: 0,
  borett: 0, // fradrag for tinglyst borett/kår (kapitalisert verdi)
  asetefradrag: 20, // % skjønnsmessig fradrag i åsetestakst
  kjopesum: null,
  merknad: '',
};
export const takstFor = (S) => ({ ...STANDARD_TAKST, ...(S.takst || {}), jord: { ...STANDARD_TAKST.jord, ...(S.takst?.jord || {}) }, arealer: { ...(S.takst?.arealer || {}) }, rettigheter: S.takst?.rettigheter || STANDARD_TAKST.rettigheter.map((r) => ({ ...r })), bygninger: S.takst?.bygninger || [] });

const kap = (aarlig) => (Number(aarlig) || 0) / (RENTE / 100);
const rund = (v, n = 1000) => Math.round(v / n) * n;

// Arealer (daa) fra planen: jordbruksareal fra AR5 (fulldyrka/overflatedyrka/innmarksbeite), produktiv skog = bestand.
export function arealer(S, t = takstFor(S)) {
  const a = { full: 0, overflate: 0, beite: 0, produktiv: 0, uproduktiv: 0, myr: 0, bebygd: 0, annet: 0 };
  a.produktiv = (S.bestand || []).reduce((s, b) => s + (b.areal || 0), 0);
  for (const f of S.markslag || []) {
    const d = f.areal || 0;
    if (f.kategori === 'jordbruk') { const art = String(f.ar5?.artype || ''); if (/overflate/i.test(art)) a.overflate += d; else if (/beite/i.test(art)) a.beite += d; else a.full += d; }
    else if (f.kategori === 'impediment' || f.kategori === 'apen') a.uproduktiv += d;
    else if (f.kategori === 'myr') a.myr += d;
    else if (f.kategori === 'bebygd') a.bebygd += d;
    else a.annet += d;
  }
  const fraPlan = { full: a.full, overflate: a.overflate, beite: a.beite };
  for (const k of ['full', 'overflate', 'beite']) if (t.arealer[k] != null && t.arealer[k] !== '') a[k] = Number(t.arealer[k]) || 0;
  a.dyrka = a.full + a.overflate;
  a.total = a.full + a.overflate + a.beite + a.produktiv + a.uproduktiv + a.myr + a.bebygd + a.annet;
  return { ...a, fraPlan };
}

// Kostnadsverdi for en bygning. Renovering gjør bygget «yngre» (effektivt byggeår vektes mot renoveringsåret).
export function bygningsverdi(g, iAar = new Date().getFullYear()) {
  const type = BYGG_TYPER[g.type] || BYGG_TYPER.annet;
  if (g.skjonn != null && g.skjonn !== '') return { verdi: rund(Number(g.skjonn) || 0), skjonn: true, type };
  const bta = Number(g.bta) || 0; const bygget = Number(g.byggeaar) || iAar; const ren = Number(g.renovert) || null;
  const effAar = ren && ren > bygget ? Math.round((bygget + 2 * ren) / 3) : bygget;
  const alder = Math.max(0, iAar - effAar);
  const rest = Math.max(0.1, 1 - alder / type.levetid);
  const fT = TILSTAND[g.tilstand || 'normal']?.f ?? 1;
  const fB = type.bolig ? 1 : (BRUKSVERDI[g.bruksverdi || 'hoy']?.f ?? 1);
  const kvm = Number(g.kvm) || type.kvm;
  const nybygg = bta * kvm;
  return { verdi: rund(Math.min(nybygg, nybygg * rest * fT * fB)), nybygg: rund(nybygg), alder, rest: Math.round(rest * 100) / 100, fT, fB, kvm, type };
}

// Hele beregningen: { arealer, deler: [{ id, navn, metode, verdi }], varianter: { konsesjon, odel, asete }, priskontroll, konsesjonsplikt }.
export function beregnTakst(S, { iAar = new Date().getFullYear() } = {}) {
  const t = takstFor(S); const a = arealer(S, t); const deler = [];
  // Skog: avkastningsverdi med 4 %
  let skog = 0; let skogInfo = null;
  if ((S.bestand || []).length) {
    const Sx = S.innstillinger ? S : { ...S, innstillinger: STANDARD_INNSTILLINGER };
    const v = verdiberegning(Sx, { ...STANDARD_VERDI, ...(S.verdi || {}), rente: RENTE, annenInntekt: 0, fasteKostnader: 0 }, { iAar, utenProduksjonIder: utenProduksjon(Sx) });
    skog = Math.max(0, v.eiendom); skogInfo = { bestand: v.rader.length, volum: Math.round(v.rader.reduce((s, x) => s + x.volum, 0)), slakt: Math.round(v.slakt), vei: Math.round(v.veiPerAar) };
  }
  deler.push({ id: 'skog', gruppe: 'skog', navn: 'Skog', areal: a.produktiv, metode: `Avkastningsverdi, ${RENTE} % – nåverdien av hogstinntektene per bestand${skogInfo?.vei ? ', minus veivedlikehold' : ''}`, verdi: rund(skog), info: skogInfo });
  // Jord
  const rasj = 1 + (Number(t.jord.rasjonalisering) || 0) / 100;
  for (const [k, navn] of [['full', 'Fulldyrka jord'], ['overflate', 'Overflatedyrka jord'], ['beite', 'Innmarksbeite']]) {
    if (!a[k]) continue;
    const perDaa = kap(t.jord[k]) * rasj;
    deler.push({ id: k, gruppe: 'jord', navn, areal: a[k], perDaa: Math.round(perDaa), metode: `Avkastningsverdi: ${t.jord[k]} kr/daa årlig netto ÷ ${RENTE} %${rasj > 1 ? ` + ${t.jord.rasjonalisering} % rasjonaliseringsgevinst` : ''}`, verdi: rund(a[k] * perDaa) });
  }
  // Utmark og rettigheter
  for (const r of t.rettigheter) {
    const v = kap(r.aarlig) + (Number(r.belop) || 0); if (!v) continue;
    deler.push({ id: r.id, gruppe: 'rettighet', navn: r.navn || 'Rettighet', metode: [Number(r.aarlig) ? `${Number(r.aarlig).toLocaleString('nb-NO')} kr/år ÷ ${RENTE} %` : '', Number(r.belop) ? 'skjønn' : ''].filter(Boolean).join(' + '), verdi: rund(v) });
  }
  // Bygninger
  for (const g of t.bygninger) {
    const b = bygningsverdi(g, iAar);
    deler.push({ id: g.id, gruppe: b.type.bolig ? 'bolig' : 'bygning', navn: g.navn || b.type.navn, bta: Number(g.bta) || null, byggeaar: g.byggeaar || null, metode: b.skjonn ? 'Skjønnsmessig satt' : `Kostnadsverdi: ${Number(g.bta) || 0} m² × ${b.kvm.toLocaleString('nb-NO')} kr × restverdi ${Math.round(b.rest * 100)} %${b.fT !== 1 ? ` × tilstand ${b.fT}` : ''}${b.fB !== 1 ? ` × bruksverdi ${b.fB}` : ''}`, verdi: b.verdi });
  }
  const harBolig = t.bygninger.some((g) => (BYGG_TYPER[g.type] || {}).bolig);
  const boverdi = harBolig ? Math.min(BOVERDI_MAKS, Math.max(0, Number(t.boverdi) || 0)) : 0;
  if (boverdi) deler.push({ id: 'boverdi', gruppe: 'boverdi', navn: 'Boverdi', metode: `Tillegg for attraktivt bosted (høyst ${(BOVERDI_MAKS / 1e6).toLocaleString('nb-NO')} mill. kr)`, verdi: rund(boverdi) });
  const borett = Math.max(0, Number(t.borett) || 0);
  if (borett) deler.push({ id: 'borett', gruppe: 'fradrag', navn: 'Fradrag for borett/kår', metode: 'Tinglyst borett eller kår', verdi: -rund(borett) });

  const sum = deler.reduce((s, d) => s + d.verdi, 0);
  const asetefradrag = Math.min(60, Math.max(0, Number(t.asetefradrag) || 0));
  const varianter = {
    konsesjon: { ...VARIANTER.konsesjon, verdi: rund(sum, 10000) },
    odel: { ...VARIANTER.odel, verdi: rund(sum, 10000) },
    asete: { ...VARIANTER.asete, verdi: rund((sum - boverdi) * (1 - asetefradrag / 100), 10000), fradrag: asetefradrag },
  };
  return { takst: t, arealer: a, deler, sum: rund(sum), boverdi, varianter, priskontroll: priskontroll(a, { harBolig, verdi: Number(t.kjopesum) || varianter.konsesjon.verdi, kjopesum: Number(t.kjopesum) || null }), konsesjonsplikt: konsesjonsplikt(a, { harBolig }), skogInfo };
}

// Priskontroll etter konsesjonsloven § 9 a (endret ved lov 6. juni 2025 nr. 27, i kraft 1. juli 2025):
//   * Ubebygd eiendom til landbruksformål: alltid priskontroll – også ren skog.
//   * Bebygd eiendom: bare med mer enn 35 daa fulldyrka/overflatedyrka jord ELLER mer enn 500 daa produktiv skog.
//   * Unntak (forskrift): bebygd med brukbart bolighus og pris under 3,5 mill. kr.
//   * Nytt: eieren kan kreve bindende forhåndsuttalelse om pris (§ 9 a annet ledd), og avtalen kan ikke gjøres
//     gjeldende hvis konsesjon avslås fordi prisen er for høy – selgeren bærer risikoen (§ 15 a).
export const PRISKONTROLL_MERKNAD = 'Eieren kan be kommunen om en bindende forhåndsuttalelse om hvor høy pris som godtas (konsesjonsloven § 9 a annet ledd). Avslås konsesjon fordi prisen er for høy, kan avtalen ikke gjøres gjeldende – selgeren bærer risikoen (§ 15 a).';
export function priskontroll(a, { harBolig, verdi, kjopesum = null }) {
  const dyrka = a.dyrka; const kr = (v) => `${(v / 1e6).toLocaleString('nb-NO', { maximumFractionDigits: 2 })} mill. kr`; const d1 = (v) => v.toLocaleString('nb-NO', { maximumFractionDigits: 1 });
  if (!harBolig) {
    if (dyrka > 0 || a.beite > 0 || a.produktiv > 0) return { svar: 'ja', merknad: PRISKONTROLL_MERKNAD, tekst: `Ubebygd eiendom til landbruksformål${!dyrka && !a.beite ? ' (ren skog)' : ''}: det gjøres priskontroll uansett størrelse (§ 9 a, fra 1. juli 2025).` };
    return { svar: 'nei', tekst: 'Ingen jordbruksareal eller produktiv skog: ikke priskontroll.' };
  }
  const grunn = [dyrka > 35 ? `${d1(dyrka)} daa fulldyrka/overflatedyrka jord (over 35 daa)` : '', a.produktiv > 500 ? `${d1(a.produktiv)} daa produktiv skog (over 500 daa)` : ''].filter(Boolean);
  if (!grunn.length) return { svar: 'nei', tekst: 'Bebygd eiendom med høyst 35 daa dyrka jord og høyst 500 daa produktiv skog: det gjøres ikke priskontroll.' };
  if (verdi < PRISKONTROLL_GRENSE) return { svar: 'nei', tekst: `Bebygd med ${grunn.join(' og ')}, men ${kjopesum ? 'kjøpesummen' : 'beregnet verdi'} (${kr(verdi)}) er under ${kr(PRISKONTROLL_GRENSE)}. Med brukbart bolighus (vei, vann og avløp i orden) gjøres det ikke priskontroll.` };
  return { svar: 'ja', merknad: PRISKONTROLL_MERKNAD, tekst: `Bebygd eiendom med ${grunn.join(' og ')}: prisen kontrolleres mot verdien av de enkelte delene (§ 9 a).` };
}
// Konsesjonsplikt (konsesjonsloven § 4 første ledd nr. 4 og § 5 andre ledd).
export function konsesjonsplikt(a, { harBolig }) {
  const fri = harBolig && a.total <= 100 && a.dyrka <= 35;
  const boplikt = a.dyrka > 35 || a.produktiv > 500;
  return {
    plikt: !fri,
    tekst: fri ? 'Bebygd, høyst 100 daa totalt og høyst 35 daa dyrka jord: konsesjonsfritt erverv.' : `Konsesjonspliktig ved salg i åpent marked (${harBolig ? `${Math.round(a.total)} daa totalt / ${Math.round(a.dyrka)} daa dyrka` : 'ubebygd eiendom'}).`,
    boplikt: boplikt ? `Ved overtakelse i nær slekt eller på odel er det boplikt (over 35 daa dyrka jord eller over 500 daa produktiv skog).` : '',
  };
}
