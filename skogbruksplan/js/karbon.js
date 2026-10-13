// Karbonkreditter fra skog: potensial, egnethet, prosjekt og oppfølging. Ingen DOM – kan testes i Node.
//
// Prinsippet er det samme i alle standarder for forbedret skogforvaltning (IFM): kreditter gis bare for karbon som
// lagres UTOVER en referansebane (det som ville skjedd uten prosjektet), etter fradrag for lekkasje (hogsten flytter
// seg til andre skoger), usikkerhet og en bufferandel som dekker tap (storm, brann, hogst). Lageret må holdes i hele
// forpliktelsesperioden, og hver kreditt må måles, verifiseres av tredjepart og registreres i et register.
//
// Referansebanen lages av tiltaksmotoren med prinsippet «Økonomi først» (vanlig drift: hogst ved økonomisk optimum,
// flatehogst og planting). Prosjektbanen er tiltaksplanen slik den er, eller motoren med prinsippet «Karbon og klima».
// Lageret regnes fra stående volum med omregningsfaktorer per treslag (levende biomasse over og under bakken).
// Dødt trevirke, jord og treprodukter er holdt utenfor (konservativt, som de fleste standarder krever for IFM).
import { STANDARD_INNSTILLINGER, startTilstand, framskriv, laavesteHogstalder, beregnetHogstklasse, hkGrenser, nyId, HOGSTTYPER } from './model.js';
import { genererTiltak, tilTiltak, iKarbonprosjekt, organiskJord } from './tiltaksmotor.js';
import { risikoPerBestand } from './skade.js';
import { avstand } from './pefc.js';

// ---------- faktorer ----------
// Tonn CO₂ per m³ stammevolum (med bark) i levende biomasse inkl. greiner, bar, stubbe og røtter.
// Basisdensitet fra IPCC 2006 (bind 4, kap. 4): gran 0,40, furu 0,42 og bjørk 0,51 t tørrstoff/m³. Karbon er 50 % av
// tørrstoffet, og 1 t C = 44/12 t CO₂ – det gir 0,73 (gran), 0,77 (furu) og 0,93 (bjørk) t CO₂/m³ i selve stammen.
// Hele treet (greiner, bar og røtter) er ca. 1,5–1,6 ganger stammen. Klimagassregnskapet bruker Marklund (1988) og
// Petersson & Ståhl (2006) per tre; ved verifisering skal biomassefunksjonene fra standarden brukes.
const STAMME = (densitet) => densitet * 0.5 * (44 / 12);
export const KARBON_FAKTOR = {
  G: Math.round(STAMME(0.40) * 1.6 * 100) / 100, // ≈ 1,17
  F: Math.round(STAMME(0.42) * 1.5 * 100) / 100, // ≈ 1,16
  L: Math.round(STAMME(0.51) * 1.5 * 100) / 100, // ≈ 1,40
};
export const co2PerM3 = (treslag) => KARBON_FAKTOR[treslag] ?? KARBON_FAKTOR.G;

// Standard forutsetninger. Alt kan endres i fanen (lagres i planen under S.karbon.innstillinger).
export const STANDARD_KARBON = {
  referanse: 'balansert',        // tiltaksmotorens prinsipp for referansebanen (vanlig, bærekraftig drift)
  prosjektbane: 'karbon',        // 'karbon' = motoren med karbonprinsippet, 'plan' = tiltaksplanen slik den er
  periodeAar: 30,                // kredittperiode (år)
  forpliktelseAar: 40,           // forpliktelse til å holde lageret (Noora/Arbonics bruker ca. 40 år)
  buffer: 15,                    // % av kredittene til bufferpott mot tap (Verra AFOLU-risikoverktøy: typisk 10–20 %)
  lekkasje: 20,                  // % fradrag for markedslekkasje (VM0045: 10 % uten varig redusert hogst, ellers 20/40/70 %)
  proveflater: 0,                // permanente prøveflater i prosjektet (0 = ikke etablert)
  cv: 45,                        // variasjonskoeffisient (%) for lagerendring mellom prøveflater
  prisEur: 25,                   // pris per kreditt (EUR/t CO₂) – IFM omsettes for ca. 25–30 EUR i 2026
  eurNok: 11.7,
  modell: 'gruppe',              // 'gruppe' = mellomledd/gruppeprosjekt (kostnadene ligger i deres andel), 'eget' = eget prosjekt
  andelSkogeier: 80,             // % av inntekten til skogeier i gruppeprosjekt (Noora: 80/20)
  oppstartKost: 250000,          // kr ved eget prosjekt: prosjektbeskrivelse, prøveflater, validering og registrering
  verifiseringKost: 150000,      // kr per verifisering ved eget prosjekt (inkl. ny måling av prøveflatene)
  verifiseringHvertAar: 5,       // VM0045: prøveflatene måles minst hvert 5. år
  rente: 3,                      // % for nåverdi av tapt tømmerinntekt og karboninntekt
};

// Usikkerhetsfradrag. VM0045: halv bredde av 95 %-konfidensintervallet for lagerendringen minus 15 prosentpoeng.
// EU CRCF: minst 10 %. Uten prøveflater brukes et høyt fradrag (prosjektet kan ikke verifiseres uten).
export function usikkerhet(k) {
  const n = Number(k.proveflater) || 0;
  if (n < 2) return { fradrag: 30, halvbredde: null, tekst: 'Ingen permanente prøveflater – kreves for verifisering. Regnet med 30 % fradrag.' };
  const hb = (1.96 * (Number(k.cv) || 45)) / Math.sqrt(n);
  const fradrag = Math.max(10, hb - 15);
  return { fradrag, halvbredde: hb, tekst: `${n} prøveflater gir ±${hb.toFixed(1).replace('.', ',')} % (95 %). Fradrag ${fradrag.toFixed(1).replace('.', ',')} % (VM0045: halvbredde − 15, CRCF: minst 10 %).` };
}
// Prøveflater som trengs for et gitt fradrag (halvbredde = fradrag + 15).
export const proveflaterFor = (k, fradrag = 10) => Math.ceil(((1.96 * (Number(k.cv) || 45)) / (fradrag + 15)) ** 2);

// Standarder og kilder. Status og krav endrer seg – sjekk alltid gjeldende versjon før avtale.
export const KARBON_STANDARDER = {
  vm0045: {
    navn: 'Verra VCS VM0045 – forbedret skogforvaltning (IFM)', kort: 'Verra VM0045',
    status: 'Versjon 1.2 (juli 2025) er godkjent etter ICVCMs kjerneprinsipper, men har bare vedlegg for USA. Versjon 1.3 med generelle krav for nasjonale skogtakster (også Norge) var på høring mai–juni 2026.',
    tekst: 'Referansen lages dynamisk fra sammenlignbare flater i landsskogtakseringen. Krever permanente prøveflater målt minst hvert 5. år, validering og verifisering av godkjent tredjepart (VVB) og bidrag til bufferpott. Kan ikke brukes der hogsten allerede er begrenset av lov eller heftelser, eller der mer enn 10 % av arealet får inngrep i jord eller vannhusholdning.',
    url: 'https://verra.org/documents/vm0045-improved-forest-management-using-dynamic-matched-baselines-from-national-forest-inventories-v1-2',
  },
  crcf: {
    navn: 'EUs sertifiseringsramme for karbonfjerning (CRCF)', kort: 'EU CRCF',
    status: 'Forordning 2024/3012. Metodene for «carbon farming» ble vedtatt 9. juli 2026: landbruk på mineraljord, restaurering av torvmark og nyplanting (skogreising). Metode for forbedret skogforvaltning (forlenget omløp) er ikke vedtatt. CRCF er ikke tatt inn i EØS-avtalen.',
    tekst: 'Krav om addisjonalitet, referansebane, minst 10 % usikkerhetsfradrag, ansvar ved tap i overvåkingsperioden og ingen vesentlig skade på naturmangfold. Aktiviteten må vare minst 5 år. EU-register kommer innen 2028.',
    url: 'https://eur-lex.europa.eu/eli/reg/2024/3012/oj',
  },
  frivillig: {
    navn: 'Nordiske aktører (gruppeprosjekter)', kort: 'Gruppeprosjekt',
    status: 'Noora (Oslo) bruker VM0045 med utsatt hogst 10–20 år på utvalgte bestand: validering 2026, kreditter fra 2029, overvåking til ca. 2066, 80 % av inntekten til skogeier. Arbonics driver et gruppeprosjekt i Verra for Norden og Baltikum med ca. 40 års avtaler.',
    tekst: 'Aktøren står for prosjektbeskrivelse, prøveflater, validering, verifisering og salg. Skogeier forplikter seg til hogstplanen for bestandene som er med. Landbruksdirektoratet (2025) kjenner ikke til norske selgere som er godkjent etter ISO 14064-2, VCS eller Gold Standard – sjekk standard og tredjepartskontroll før avtale.',
    url: 'https://skogselskapet.no/wp-content/uploads/2026/05/skog-og-klima-Karbonkreditter_Gustav-Bendz.pdf',
  },
};

export const KARBON_KILDER = {
  ldir: { navn: 'Landbruksdirektoratet (7.10.2025): Skogkreditter – frivillig salg av klimakvoter i skog. PEFC/FSC omfatter ikke kreditter; avtaler kan kreve delingssamtykke (jordloven § 12), konsesjon (konsesjonsloven § 3) eller falle inn under servituttlova; karboninntekt kan ikke settes på skogfond.', url: 'https://prod.statsforvalteren.no/contentassets/461d6c57d85b4969a506cfd0e4f620a2/skogkreditter---frivillig-salg-av-klimakvoter-i-skog.pdf' },
  dobbelttelling: { navn: 'Norges klimaavtale med EU omfatter skog (LULUCF 2021–2030). Ekstra binding teller i Norges regnskap – uten tilsvarende justering er kreditten et bidrag («contribution claim»), ikke kompensasjon.', url: 'https://www.regjeringen.no/no/aktuelt/valg-av-referansebane-for-forvaltet-skog-i-klimaavtalen-med-eu/id2629924/' },
  klimatiltak: { navn: 'Tilskudd til klimatiltak i skog 2026: gjødsling 40 %, tettere planting 30 %, suppleringsplanting 30 %. Statlig finansiert binding er normalt ikke addisjonell.', url: 'https://www.statsforvalteren.no/innlandet/landbruk-og-mat/skogbruk/skogkultur/tilskudd-til-klimatiltak-i-skog-2026/' },
  pefc: { navn: 'Norsk PEFC Skogstandard: nøkkelbiotoper, kantsoner, livsløpstrær og forbud mot nygrøfting av myr (krav 25) er minstekrav og inngår i referansen.', url: 'https://www.pefcnorge.org/' },
  icvcm: { navn: 'ICVCM Core Carbon Principles: addisjonalitet, permanens, robust kvantifisering, ingen dobbelttelling', url: 'https://icvcm.org/the-core-carbon-principles/' },
  ipcc: { navn: 'IPCC 2006, bind 4 kap. 4: basisdensitet og rot/skudd-forhold for boreal skog', url: 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/4_Volume4/V4_04_Ch4_Forest_Land.pdf' },
  buffer: { navn: 'Verra AFOLU Non-Permanence Risk Tool v4.2 (bufferandel)', url: 'https://verra.org/documents/afolu-non-permanence-risk-tool-v4-2' },
};

export const PROSJEKTSTATUS = {
  vurdering: { navn: 'Vurdering', tekst: 'Potensial og egnethet vurderes. Ingen forpliktelser.' },
  forberedelse: { navn: 'Forberedelse', tekst: 'Avtale med partner, prosjektbeskrivelse og felttakst. Karbonreglene gjelder for prosjektets bestand.' },
  validering: { navn: 'Validering', tekst: 'Tredjepart kontrollerer prosjektbeskrivelse, referanse og målemetode.' },
  registrert: { navn: 'Registrert', tekst: 'Prosjektet er registrert. Lageret skal holdes, og kreditter utstedes etter verifisering.' },
  overvaking: { navn: 'Overvåking', tekst: 'Løpende måling og rapportering, verifisering med fast intervall.' },
  avsluttet: { navn: 'Avsluttet', tekst: 'Forpliktelsesperioden er over, eller prosjektet er avbrutt.' },
};
export const STATUS_REKKE = Object.keys(PROSJEKTSTATUS);

export const HENDELSESTYPER = {
  storm: 'Stormfelling', brann: 'Brann', insekt: 'Insekt/sopp', snobrekk: 'Snøbrekk', hogst: 'Hogst (ikke planlagt i prosjektet)', salg: 'Salg/deling av eiendom', annet: 'Annet',
};

export function tomKarbon() {
  return { innstillinger: {}, prosjekt: null, verifikasjoner: [], hendelser: [], sjekk: {} };
}
export function sikreKarbon(S) {
  if (!S.karbon) S.karbon = tomKarbon();
  const k = S.karbon;
  k.innstillinger = k.innstillinger || {}; k.verifikasjoner = k.verifikasjoner || []; k.hendelser = k.hendelser || []; k.sjekk = k.sjekk || {};
  return k;
}
export const karbonInn = (S) => ({ ...STANDARD_KARBON, ...(S.karbon?.innstillinger || {}) });

// ---------- lager ----------
export function lagerT(b, volumDaa = startTilstand(b).volumDaa) { return (volumDaa || 0) * (b.areal || 0) * co2PerM3(b.treslag || 'G'); }

// Bestand som ikke kan gi kreditter fordi de er vernet eller krav i PEFC/lov (referansen er uansett ingen hogst).
export function utelukket(S, b) {
  if (b.miljo) return 'Miljøfigur (PEFC-krav)';
  for (const o of S.pefc?.objekter || []) {
    if (!o.geometri || !b.geometri) continue;
    if (['noekkelbiotop', 'bvo', 'vern'].includes(o.type) && avstand(b.geometri, o.geometri, 0) === 0) return o.type === 'vern' ? 'Verneområde' : 'Nøkkelbiotop/BVO';
  }
  return null;
}

// ---------- scenarioer ----------
const utforte = (b) => (b.tiltak || []).filter((t) => t.status === 'utfort');
// Tiltakene en bane bygger på: utførte tiltak + motorens forslag for prinsippet (uten prosjektets særregler).
function baneTiltak(S, bestand, prinsipp, iAar, horisont, { karbonFor = null } = {}) {
  const prosjekt = karbonFor ? { status: 'forberedelse', bestand: karbonFor } : null;
  const kopi = { ...S, karbon: prosjekt ? { prosjekt } : null, bestand: bestand.map((b) => ({ ...b, tiltak: utforte(b) })) };
  const forslag = genererTiltak(kopi, { iAar, horisont, prinsipp });
  for (const f of forslag) f.b.tiltak.push(tilTiltak(f));
  return kopi.bestand;
}

// Simulerer referanse og prosjekt for valgte bestand og gir lager, hogst og kreditter år for år.
export function scenarioer(S, { iAar = new Date().getFullYear(), bestandIder = null } = {}) {
  const k = karbonInn(S);
  const inn = { ...STANDARD_INNSTILLINGER, ...S.innstillinger };
  const horisont = k.periodeAar;
  const valgte = S.bestand.filter((b) => (bestandIder ? bestandIder.includes(b.id) : true) && !utelukket(S, b));
  const ider = valgte.map((b) => b.id);
  const ref = baneTiltak(S, valgte, k.referanse, iAar, horisont);
  const prosj = k.prosjektbane === 'plan'
    ? valgte.map((b) => ({ ...b, tiltak: [...(b.tiltak || [])] }))
    : baneTiltak(S, valgte, 'balansert', iAar, horisont, { karbonFor: ider });
  const kjør = (liste) => {
    const { aarRader, perBestand } = framskriv(liste, horisont, inn, { folgPlan: true, startAar: iAar });
    // Lager ved inngangen av hvert år (før årets hogst), så begge banene starter i dagens lager.
    const lager = aarRader.map((_, i) => liste.reduce((s, b) => s + lagerT(b, perBestand.get(b.id)[i]?.volumFor), 0));
    return { aarRader, perBestand, lager };
  };
  const R = kjør(ref); const P = kjør(prosj);
  const aar = R.aarRader.map((r) => r.aar);
  // Merlager år for år og kreditter for økningen i merlageret (kumulativ metode: kreditt = økning i differansen).
  const u = usikkerhet(k);
  const faktor = (1 - k.lekkasje / 100) * (1 - u.fradrag / 100);
  const rader = aar.map((a, i) => {
    const mer = P.lager[i] - R.lager[i];
    const forrige = i ? P.lager[i - 1] - R.lager[i - 1] : 0;
    const brutto = i ? mer - forrige : 0;
    return { aar: a, ref: R.lager[i], prosjekt: P.lager[i], mer, brutto, refHogst: R.aarRader[i].avvirkning, prosjektHogst: P.aarRader[i].avvirkning, refNetto: R.aarRader[i].inntekt - R.aarRader[i].kostnad, prosjektNetto: P.aarRader[i].inntekt - P.aarRader[i].kostnad };
  });
  // Kreditter utstedes bare når det samlede merlageret øker utover det som allerede er kreditert.
  let kreditert = 0;
  for (const r of rader) {
    const netto = Math.max(0, r.mer * faktor - kreditert);
    r.kreditterBrutto = netto; // før buffer
    r.buffer = netto * (k.buffer / 100);
    r.kreditter = netto - r.buffer;
    kreditert += netto;
  }
  // Faller merlageret etter at det er kreditert (hogst senere i perioden), er det en reversering som må dekkes.
  let topp = 0; let toppAar = null; let reversering = 0;
  for (const r of rader) { const v = r.mer * faktor; if (v > topp) { topp = v; toppAar = r.aar; } }
  const slutten = rader[rader.length - 1].mer * faktor;
  if (topp - slutten > 1) reversering = topp - slutten;
  const sum = (f) => rader.reduce((s, r) => s + f(r), 0);
  const diskonter = (f) => rader.reduce((s, r, i) => s + f(r) / (1 + k.rente / 100) ** i, 0);
  const kreditter = sum((r) => r.kreditter);
  const prisNok = k.prisEur * k.eurNok;
  const inntektBrutto = kreditter * prisNok;
  const antVerif = Math.floor(horisont / Math.max(1, k.verifiseringHvertAar));
  const eget = k.modell === 'eget';
  const andel = eget ? 100 : k.andelSkogeier;
  const oppstart = eget ? k.oppstartKost : 0; const verifKost = eget ? k.verifiseringKost : 0;
  const kostnad = oppstart + antVerif * verifKost;
  const kostNv = oppstart + Array.from({ length: antVerif }, (_, i) => verifKost / (1 + k.rente / 100) ** ((i + 1) * k.verifiseringHvertAar)).reduce((s, v) => s + v, 0);
  const karbonNv = diskonter((r) => r.kreditter * prisNok * (andel / 100)) - kostNv;
  const tapTommerNv = diskonter((r) => r.refNetto - r.prosjektNetto);
  // Pris (EUR/t) der karboninntekten akkurat dekker tapt tømmerinntekt og kostnader (nåverdi).
  const nvKreditter = diskonter((r) => r.kreditter) * (andel / 100);
  const balansePrisEur = nvKreditter > 0 ? (tapTommerNv + kostNv) / nvKreditter / k.eurNok : null;
  // Bidrag per bestand: merlager ved periodens slutt.
  const n = aar.length - 1;
  const perBestand = valgte.map((b) => {
    const r = ref.find((x) => x.id === b.id); const p = prosj.find((x) => x.id === b.id);
    const lr = lagerT(b, R.perBestand.get(b.id)[n]?.volumFor); const lp = lagerT(b, P.perBestand.get(b.id)[n]?.volumFor);
    const hogstRef = (r.tiltak || []).filter((t) => t.status !== 'utfort' && HOGSTTYPER.includes(t.type) && t.aar < iAar + horisont);
    const hogstProsj = (p.tiltak || []).filter((t) => t.status !== 'utfort' && HOGSTTYPER.includes(t.type) && t.aar < iAar + horisont);
    return { b, mer: lp - lr, lagerNaa: lagerT(b), hogstRef, hogstProsj };
  }).sort((x, y) => y.mer - x.mer);
  return {
    k, u, andel, aar, rader, reversering, toppAar, perBestand, bestandIder: ider, utelukket: S.bestand.filter((b) => utelukket(S, b)),
    lagerNaa: R.lager[0], merSlutt: rader[n].mer, kreditter, buffer: sum((r) => r.buffer), inntektBrutto, kostnad,
    karbonNv, tapTommerNv, balansePrisEur, prisNok,
    hogstRef: sum((r) => r.refHogst), hogstProsjekt: sum((r) => r.prosjektHogst),
    perAar: kreditter / Math.max(1, horisont),
    prosjektTiltak: prosj,
  };
}

// ---------- egnethet ----------
// Sjekkliste: status 'ok' | 'delvis' | 'mangler' | 'info'. Manuelle punkter (sjekk) besvares av skogeier.
export const MANUELLE = {
  hjemmel: { tittel: 'Skogeier har hjemmel og kan binde eiendommen i hele forpliktelsesperioden', tekst: 'Alle hjemmelshavere må signere. Forpliktelsen bør tinglyses eller følge eiendommen ved salg og arv. Sjekk servitutter, beiterett, hogstrett og avtaler med andre.' },
  avtale: { tittel: 'Avklart hvem som kjøper eller formidler kredittene, og på hvilken standard', tekst: 'Avtalen avgjør periode, buffer, prisdeling, hva som skjer ved storm eller salg, og hvem som betaler validering og verifisering.' },
  juridisk: { tittel: 'Avtalen er vurdert etter jordloven, konsesjonsloven og servituttlova', tekst: 'Landbruksdirektoratet peker på at langsiktige avtaler om skogkreditter kan kreve delingssamtykke (jordloven § 12), konsesjon (konsesjonsloven § 3) eller være en servitutt. Avklar med kommunen før avtale. Karboninntekt kan ikke settes på skogfond.' },
  ingenTilskudd: { tittel: 'Ingen statlige klimatilskudd for tiltakene som skal gi kreditter', tekst: 'Tettere planting, gjødsling og suppleringsplanting med klimatilskudd er allerede betalt av staten. Slike tiltak kan normalt ikke gi kreditter samtidig (dobbel finansiering).' },
  dobbelttelling: { tittel: 'Kjøper er informert om dobbelttelling mot Norges klimaregnskap', tekst: 'Uten tilsvarende justering fra staten bør kredittene selges som bidrag til klimatiltak, ikke som kompensasjon for kjøperens egne utslipp.' },
};

export function egnethet(S, { iAar = new Date().getFullYear(), risiko = null } = {}) {
  const k = karbonInn(S); const inn = { ...STANDARD_INNSTILLINGER, ...S.innstillinger };
  const sjekk = S.karbon?.sjekk || {};
  const ut = [];
  const legg = (id, tittel, status, tekst, ekstra = {}) => ut.push({ id, tittel, status, tekst, ...ekstra });
  const prod = S.bestand.reduce((s, b) => s + (b.areal || 0), 0);
  // Areal
  legg('areal', 'Produktivt skogareal', prod >= 1000 ? 'ok' : prod >= 300 ? 'delvis' : 'mangler',
    prod >= 1000 ? `${Math.round(prod)} daa produktiv skog – stort nok for et eget prosjekt.` : prod >= 300 ? `${Math.round(prod)} daa – kostnadene til validering og verifisering blir høye per kreditt. Vurder å gå sammen med andre skogeiere (gruppeprosjekt, f.eks. gjennom skogeierandelslaget).` : `${Math.round(prod)} daa – for lite alene. Bare aktuelt i et gruppeprosjekt.`);
  // Datagrunnlag
  const medData = S.bestand.filter((b) => b.alder != null && b.volumDaa != null && b.bonitet);
  const andelData = prod ? medData.reduce((s, b) => s + (b.areal || 0), 0) / prod : 0;
  const takst = Number(S.eiendom?.takstAar) || null;
  const usikker = S.bestand.map((b) => Number(b.ekstra?.SR16_VOLUM_USIKKERHET_PST)).filter((v) => Number.isFinite(v) && v > 0);
  const snittUsikker = usikker.length ? usikker.reduce((s, v) => s + v, 0) / usikker.length : null;
  legg('data', 'Datagrunnlag for karbonlageret', andelData >= 0.95 ? (snittUsikker && snittUsikker > 25 ? 'delvis' : 'ok') : andelData >= 0.7 ? 'delvis' : 'mangler',
    `${Math.round(andelData * 100)} % av arealet har alder, volum og bonitet${takst ? ` (takst ${takst})` : ''}.${snittUsikker ? ` SR16 oppgir ca. ${Math.round(snittUsikker)} % usikkerhet i volum per bestand – en felttakst med prøveflater gir lavere fradrag.` : ''}`);
  // Alderssammensetning – potensial i forlenget omløp
  const hk5 = S.bestand.filter((b) => { const s = startTilstand(b); const min = laavesteHogstalder(b, inn); return (b.hogstklasse || beregnetHogstklasse(s.alder, min, s.volumDaa, hkGrenser(b, inn))) >= 4; });
  const andelGammel = prod ? hk5.reduce((s, b) => s + (b.areal || 0), 0) / prod : 0;
  legg('potensial', 'Eldre og hogstmoden skog (hogstklasse IV–V)', andelGammel >= 0.3 ? 'ok' : andelGammel >= 0.15 ? 'delvis' : 'mangler',
    `${Math.round(andelGammel * 100)} % av arealet. Forlenget omløp og redusert hogst i eldre skog gir størst merlager de første tiårene. Med mye ungskog er potensialet lavt de første 20–30 årene.`);
  // Utelukket areal
  const utel = S.bestand.filter((b) => utelukket(S, b));
  legg('vern', 'Nøkkelbiotoper, vern og miljøfigurer', 'info', utel.length ? `${utel.length} bestand (${Math.round(utel.reduce((s, b) => s + (b.areal || 0), 0))} daa) er vernet eller krav i PEFC og holdes utenfor – de hogges ikke i referansen heller, og gir ikke kreditter.` : 'Ingen bestand er holdt utenfor. Hent miljødata i PEFC-fanen for å være sikker.', { fane: 'pefc' });
  // PEFC
  const pefcHentet = !!S.pefc?.hentet;
  legg('pefc', 'PEFC-sertifisering og miljødata', pefcHentet ? 'ok' : 'delvis', pefcHentet ? 'Miljødata er hentet. Kravene i Norsk PEFC Skogstandard er minstekravet i referansebanen – kreditter gis bare for det som går utover.' : 'Miljødata er ikke hentet. Kjøpere krever at prosjektet ikke skader naturmangfold, og PEFC-sertifisering dokumenterer bærekraftig drift.', { fane: 'pefc' });
  // Organisk jord
  const torv = S.bestand.filter(organiskJord);
  if (torv.length) legg('torv', 'Skog på organisk jord (sumpskog)', 'info', `${torv.length} bestand (${Math.round(torv.reduce((s, b) => s + (b.areal || 0), 0))} daa). Unngå flatehogst og grøfting her – torva avgir CO₂. Karbonprinsippet velger lukket hogst på slik mark.`);
  // Risiko
  let hoy = 0;
  try { const r = risiko || risikoPerBestand(S, { iAar }); for (const b of S.bestand) if (r.get(b.id)?.storm?.nivaa?.id === 'hoy') hoy += b.areal || 0; } catch { /* uten risiko */ }
  const andelHoy = prod ? hoy / prod : 0;
  legg('risiko', 'Risiko for tap (storm, brann)', andelHoy <= 0.1 ? 'ok' : andelHoy <= 0.25 ? 'delvis' : 'mangler', `${Math.round(andelHoy * 100)} % av arealet har høy stormrisiko. Tap må erstattes fra bufferpotten, og høy risiko gir høyere bufferandel. Karbonprinsippet hogger stormutsatt skog før den blåser ned.`, { fane: 'skogbrand' });
  // Tilskudd i planen
  const tilskudd = S.bestand.flatMap((b) => (b.tiltak || []).filter((t) => t.tilskudd && ['planting', 'gjodsling', 'suppleringsplanting'].includes(t.type)));
  if (tilskudd.length) legg('tilskuddPlan', 'Tiltak med klimatilskudd i planen', 'delvis', `${tilskudd.length} tiltak er registrert med tilskudd. Bindingen fra disse er betalt av staten og bør holdes utenfor kredittene.`, { fane: 'tiltak' });
  // Manuelle
  // Prøveflater og usikkerhet
  const u = usikkerhet(k);
  legg('proveflater', 'Permanente prøveflater (måling og verifisering)', k.proveflater >= proveflaterFor(k, 10) ? 'ok' : k.proveflater >= 2 ? 'delvis' : 'mangler', `${u.tekst} Laser og SR16 kan brukes til inndeling, men erstatter ikke prøveflatene. Med ${k.cv} % variasjon trengs ca. ${proveflaterFor(k, 10)} flater for minste fradrag (10 %).`);
  for (const [id, m] of Object.entries(MANUELLE)) legg(id, m.tittel, sjekk[id] ? 'ok' : 'mangler', m.tekst, { manuell: true });
  const poeng = ut.filter((x) => x.status !== 'info');
  const score = poeng.length ? poeng.reduce((s, x) => s + (x.status === 'ok' ? 1 : x.status === 'delvis' ? 0.5 : 0), 0) / poeng.length : 0;
  return { punkter: ut, score, prod, andelGammel, k };
}

// ---------- prosjekt ----------
export function nyttProsjekt(S, { navn = '', standard = 'frivillig', bestand = null, iAar = new Date().getFullYear() } = {}) {
  const k = sikreKarbon(S);
  const ider = bestand || S.bestand.filter((b) => !utelukket(S, b)).map((b) => b.id);
  k.prosjekt = { id: nyId('k'), navn: navn || `Karbonprosjekt ${S.eiendom?.navn || ''}`.trim(), status: 'vurdering', standard, partner: '', startAar: iAar + 1, bestand: ider, opprettet: new Date().toISOString().slice(0, 10), statuslogg: [{ status: 'vurdering', dato: new Date().toISOString().slice(0, 10) }] };
  return k.prosjekt;
}
export function settStatus(S, status) {
  const p = S.karbon?.prosjekt; if (!p || !PROSJEKTSTATUS[status]) return;
  p.status = status; p.statuslogg = [...(p.statuslogg || []), { status, dato: new Date().toISOString().slice(0, 10) }];
}
export const prosjektAktivt = (S) => !!S.karbon?.prosjekt && !['vurdering', 'avsluttet'].includes(S.karbon.prosjekt.status);

// Legger karbonbanens tiltak inn i tiltaksplanen for prosjektets bestand (erstatter motorens planlagte tiltak der).
export function brukKarbontiltak(S, { iAar = new Date().getFullYear() } = {}) {
  const p = S.karbon?.prosjekt; if (!p) return 0;
  const ider = new Set(p.bestand);
  const k = karbonInn(S);
  const kopi = { ...S, karbon: { prosjekt: { status: 'forberedelse', bestand: [...ider] } }, bestand: S.bestand.filter((b) => ider.has(b.id)).map((b) => ({ ...b, tiltak: (b.tiltak || []).filter((t) => !(t.kilde === 'motor' && t.status !== 'utfort')) })) };
  const forslag = genererTiltak(kopi, { iAar, horisont: k.periodeAar, prinsipp: 'karbon' });
  let n = 0;
  for (const b of S.bestand) {
    if (!ider.has(b.id)) continue;
    b.tiltak = (b.tiltak || []).filter((t) => !(t.kilde === 'motor' && t.status !== 'utfort'));
    for (const f of forslag.filter((x) => x.b.id === b.id)) { b.tiltak.push({ ...tilTiltak({ ...f, b }), karbon: true }); n++; }
  }
  return n;
}

// ---------- oppfølging ----------
// Varsler for prosjektet: planlagt hogst i prosjektbestand, tilskudd, forfalt verifisering, hendelser uten oppfølging.
export function karbonVarsler(S, { iAar = new Date().getFullYear() } = {}) {
  const p = S.karbon?.prosjekt; if (!p || p.status === 'avsluttet') return [];
  const k = karbonInn(S);
  const ut = [];
  const ider = new Set(p.bestand || []);
  if (p.status !== 'vurdering') {
    const slutt = (p.startAar || iAar) + k.forpliktelseAar;
    for (const b of S.bestand) {
      if (!ider.has(b.id)) continue;
      for (const t of b.tiltak || []) {
        if (t.status === 'utfort' || t.aar > slutt) continue;
        if (HOGSTTYPER.includes(t.type) && t.type !== 'tynning' && !t.karbon) ut.push({ nivaa: 'hoy', tittel: `${t.type === "lukkethogst" ? "Lukket hogst" : "Sluttavvirkning"} i prosjektbestand ${b.nr} (${t.aar})`, tekst: 'Hogsten er ikke en del av karbonbanen. Den kan senke lageret under det som er kreditert – sjekk mot avtalen.', bestand: b.id });
        if (t.tilskudd && ['planting', 'gjodsling', 'suppleringsplanting'].includes(t.type)) ut.push({ nivaa: 'middels', tittel: `Tiltak med klimatilskudd i ${b.nr}`, tekst: 'Binding fra tiltak med statlig tilskudd bør holdes utenfor kredittene.', bestand: b.id });
      }
    }
  }
  if (['registrert', 'overvaking'].includes(p.status)) {
    const siste = [...(S.karbon.verifikasjoner || [])].sort((a, b) => (b.aar || 0) - (a.aar || 0))[0];
    const fra = siste?.aar || p.startAar || iAar;
    if (iAar - fra >= k.verifiseringHvertAar) ut.push({ nivaa: 'hoy', tittel: 'Verifisering forfaller', tekst: `Siste verifisering ${siste ? siste.aar : 'er ikke gjort'} – avtalt intervall er ${k.verifiseringHvertAar} år.` });
    else if (iAar - fra >= k.verifiseringHvertAar - 1) ut.push({ nivaa: 'middels', tittel: 'Verifisering neste år', tekst: 'Bestill felttakst/måling og verifikator i god tid.' });
  }
  for (const h of S.karbon.hendelser || []) if (!h.meldt) ut.push({ nivaa: 'hoy', tittel: `${HENDELSESTYPER[h.type] || 'Hendelse'} ${h.dato} er ikke meldt`, tekst: 'Tap av lager skal meldes til standarden/kjøper, og dekkes fra bufferpotten.' });
  return ut;
}

// Status for kreditter: verifisert, utstedt, solgt, i buffer og tap.
export function kredittstatus(S) {
  const v = S.karbon?.verifikasjoner || [];
  const sum = (f) => v.reduce((s, x) => s + (Number(x[f]) || 0), 0);
  const tap = (S.karbon?.hendelser || []).reduce((s, h) => s + (Number(h.tapT) || 0), 0);
  const solgt = sum('solgtT'); const utstedt = sum('utstedtT');
  return { verifisert: sum('verifisertT'), utstedt, solgt, beholdning: utstedt - solgt, buffer: sum('bufferT'), tap, inntekt: v.reduce((s, x) => s + (Number(x.solgtT) || 0) * (Number(x.prisNok) || 0), 0) };
}

export function nyVerifikasjon(S, data) { const k = sikreKarbon(S); const v = { id: nyId('kv'), ...data }; k.verifikasjoner.push(v); return v; }
export function nyHendelse(S, data) { const k = sikreKarbon(S); const h = { id: nyId('kh'), meldt: false, ...data }; k.hendelser.push(h); return h; }

// Kort tekst til innsikt/AI.
export function karbonSammendrag(S, sc) {
  const p = S.karbon?.prosjekt;
  return `Karbon: lager i levende biomasse ca. ${Math.round(sc.lagerNaa)} t CO₂. Med karbonforvaltning ca. ${Math.round(sc.merSlutt)} t CO₂ mer enn referansen etter ${sc.k.periodeAar} år, ${Math.round(sc.kreditter)} kreditter etter fradrag og buffer.${p ? ` Prosjekt «${p.navn}» har status ${PROSJEKTSTATUS[p.status]?.navn.toLowerCase()}.` : ''}`;
}
