// Gjør rådata om en eiendom (fra kilder.js) om til fakta, rangerte muligheter, et mulighetskart og en økonomikalkyle.
// Ren funksjon av dataene – ingen nettverkskall – slik at den kan testes i Node.
import { avstandM, avstandTilFlate, punktIPolygon } from './geo.js';

export const AREALFORMAL = {
  1001: 'Bebyggelse og anlegg', 1110: 'Boligbebyggelse', 1120: 'Fritidsbebyggelse', 1130: 'Sentrumsformål', 1140: 'Kjøpesenter',
  1150: 'Forretninger', 1160: 'Offentlig eller privat tjenesteyting', 1170: 'Fritids- og turistformål', 1200: 'Råstoffutvinning',
  1300: 'Næringsvirksomhet', 1400: 'Idrettsanlegg', 1500: 'Andre typer bebyggelse og anlegg', 1600: 'Uteoppholdsareal',
  1700: 'Grav- og urnelund', 1800: 'Kombinert bebyggelse og anlegg', 2001: 'Samferdselsanlegg og teknisk infrastruktur', 2010: 'Veg',
  2020: 'Bane', 2030: 'Lufthavn', 3001: 'Grønnstruktur', 3020: 'Naturområde', 3040: 'Friområde', 4001: 'Forsvaret',
  5001: 'LNFR', 5100: 'LNFR – landbruk, natur, friluftsliv og reindrift', 5110: 'LNFR – landbruk', 5200: 'LNFR – spredt bebyggelse',
  5210: 'LNFR – spredt boligbebyggelse', 5220: 'LNFR – spredt fritidsbebyggelse', 5230: 'LNFR – spredt næringsbebyggelse', 6001: 'Bruk og vern av sjø og vassdrag',
};
export const arealformal = (k) => AREALFORMAL[k] || `Arealformål ${k}`;
const erLNF = (k) => /^5/.test(String(k));

// Bygningstyper fra matrikkelen (første siffer/to sifre).
export function bygningsgruppe(t) {
  if (!t) return 'annet';
  if (t >= 111 && t <= 199) return t >= 181 ? 'garasje/uthus' : 'bolig';
  if (t >= 211 && t <= 249) return t >= 241 ? 'landbruk' : 'industri/lager';
  if (t >= 311 && t <= 330) return 'kontor/forretning';
  return 'annet';
}

// Hvilken arealkategori et AR5-punkt hører til.
export function kategori(a) {
  if (!a) return 'ukjent';
  const t = a.arealtype || '';
  if (/Fulldyrka/i.test(t)) return 'fulldyrka';
  if (/Overflatedyrka/i.test(t)) return 'overflatedyrka';
  if (/Innmarksbeite/i.test(t)) return 'beite';
  if (/Myr/i.test(t)) return 'myr';
  if (/Skog/i.test(t)) {
    if (/Særs høy|Høy/i.test(a.bonitet || '')) return 'skog_hoy';
    if (/Middels/i.test(a.bonitet || '')) return 'skog_middels';
    return 'skog_lav';
  }
  if (/Bebygd|Samferdsel/i.test(t)) return 'bebygd';
  if (/Åpen fastmark/i.test(t)) return 'apen';
  if (/Ferskvann|Hav/i.test(t)) return 'vann';
  return 'annet';
}

export const KATEGORI = {
  fulldyrka: { navn: 'Fulldyrka jord', farge: '#d9b13b' },
  overflatedyrka: { navn: 'Overflatedyrka jord', farge: '#e6c766' },
  beite: { navn: 'Innmarksbeite', farge: '#efd98c' },
  skog_hoy: { navn: 'Skog, høy/særs høy bonitet', farge: '#2f7d4a' },
  skog_middels: { navn: 'Skog, middels bonitet', farge: '#5f9f6c' },
  skog_lav: { navn: 'Skog, lav bonitet / uproduktiv', farge: '#94bf8f' },
  myr: { navn: 'Myr', farge: '#7c6aa8' },
  apen: { navn: 'Åpen fastmark', farge: '#b9b3a6' },
  bebygd: { navn: 'Bebygd / samferdsel', farge: '#9a4e3a' },
  vann: { navn: 'Vann', farge: '#4a90c2' },
  annet: { navn: 'Annet', farge: '#c4bdb3' },
  ukjent: { navn: 'Ikke klassifisert', farge: '#ddd6cc' },
};

// ---------- Fakta ----------

export function fakta(data, naeringsomrader = null) {
  const steg = data.steg; const cellDaa = (steg * steg) / 1000;
  const totalCeller = data.celler.length || 1;
  const skala = data.eiendom.daa / totalCeller; // daa per celle justert til matrikkelarealet
  const areal = {};
  const bonitet = {};
  for (const c of data.celler) {
    const k = kategori(c.ar5); c.kat = k;
    areal[k] = (areal[k] || 0) + skala;
    if (/^skog/.test(k) && c.ar5?.bonitet) bonitet[c.ar5.bonitet] = (bonitet[c.ar5.bonitet] || 0) + skala;
  }
  const sum = (...k) => k.reduce((s, x) => s + (areal[x] || 0), 0);

  const los = {}; const losN = data.losmasser.filter((l) => l.tekst).length || 1;
  for (const l of data.losmasser) if (l.tekst) los[l.tekst] = (los[l.tekst] || 0) + 1 / losN;
  const marinAndel = Object.entries(los).filter(([t]) => /Hav- og fjord|Marin|strandavsetning/i.test(t)).reduce((s, [, v]) => s + v, 0);
  const torvAndel = Object.entries(los).filter(([t]) => /Torv|myr/i.test(t)).reduce((s, [, v]) => s + v, 0);
  const sandAndel = Object.entries(los).filter(([t]) => /Breelv|Elve|glasifluvial|Morene/i.test(t)).reduce((s, [, v]) => s + v, 0);

  const planN = data.plan.length || 1;
  const formal = {}; const soner = {}; const planer = new Map(); let regulert = 0;
  for (const pp of data.plan) {
    const kpFormal = pp.objekter.find((x) => x.art === 'formal' && x.kp);
    const rpFormal = pp.objekter.find((x) => x.art === 'formal' && !x.kp);
    if (rpFormal) regulert++;
    const f = rpFormal || kpFormal;
    if (f) { const nokkel = `${f.kode}|${f.status}|${rpFormal ? 'rp' : 'kp'}`; formal[nokkel] = (formal[nokkel] || 0) + 1 / planN; }
    for (const s of pp.objekter.filter((x) => x.art === 'sone')) {
      const n = s.sonenavn ? `${s.sonenavn} ${s.navn}` : s.navn; soner[n] = (soner[n] || 0) + 1 / planN;
    }
    for (const p of pp.objekter.filter((x) => x.art === 'plan')) planer.set(p.id, p);
  }
  const andelSone = (re) => Object.entries(soner).filter(([n]) => re.test(n)).reduce((s, [, v]) => s + v, 0);
  const lnfAndel = Object.entries(formal).filter(([k]) => erLNF(k.split('|')[0])).reduce((s, [, v]) => s + v, 0);

  const bygg = { bolig: 0, landbruk: 0, 'garasje/uthus': 0, 'industri/lager': 0, 'kontor/forretning': 0, annet: 0 };
  for (const b of data.bygninger || []) bygg[bygningsgruppe(b.type)]++;

  const sentrum = indrePunktAvCeller(data.celler);
  const steder = STEDER.map((s) => ({ ...s, km: avstandM(sentrum, s.punkt) / 1000 }));
  let naermeste = [];
  if (naeringsomrader) {
    naermeste = naeringsomrader.features.map((f) => ({
      ...f.properties, formalNavn: arealformal(f.properties.arealformal),
      km: Math.min(...data.celler.filter((_, i) => i % 3 === 0).map((c) => avstandTilFlate(c.p, f.geometry))) / 1000,
    })).sort((a, b) => a.km - b.km).slice(0, 8);
  }

  return {
    daa: data.eiendom.daa, cellDaa, steg, areal, bonitet,
    jordbruk: sum('fulldyrka', 'overflatedyrka', 'beite'), fulldyrka: sum('fulldyrka'), skog: sum('skog_hoy', 'skog_middels', 'skog_lav'),
    skogHoy: sum('skog_hoy'), myr: sum('myr'), bebygd: sum('bebygd'),
    losmasser: los, marinAndel, torvAndel, sandAndel,
    kvikkleire: (data.kvikkleire || []).filter((k) => k.overlapper), kvikkleireNaer: (data.kvikkleire || []).filter((k) => !k.overlapper), kvikkleireUkjent: data.kvikkleire == null,
    formal, soner, planer: [...planer.values()], regulertAndel: regulert / planN, lnfAndel,
    flystoyGul: andelSone(/H220|gul flystøy/i), flystoyRod: andelSone(/H210|rød flystøy/i), stoyAndel: andelSone(/H2[12]0|støy/i),
    faresoner: Object.entries(soner).filter(([n]) => /H3\d\d|fare|ras|flom|skred/i.test(n)).map(([n, v]) => ({ navn: n, andel: v })),
    bygg, antallBygg: (data.bygninger || []).length,
    sentrum, steder, naermeste,
  };
}

function indrePunktAvCeller(celler) {
  if (!celler.length) return [0, 0];
  const x = celler.reduce((s, c) => s + c.p[0], 0) / celler.length; const y = celler.reduce((s, c) => s + c.p[1], 0) / celler.length;
  return celler.reduce((b, c) => ((c.p[0] - x) ** 2 + (c.p[1] - y) ** 2 < (b.p[0] - x) ** 2 + (b.p[1] - y) ** 2 ? c : b)).p;
}

export const STEDER = [
  { navn: 'Oslo lufthavn (terminal)', punkt: [11.1004, 60.1939] },
  { navn: 'Nannestad sentrum', punkt: [11.0150, 60.2187] },
  { navn: 'Jessheim sentrum', punkt: [11.1747, 60.1414] },
  { navn: 'Oslo sentrum', punkt: [10.7522, 59.9139] },
];

// ---------- Muligheter ----------

// Planvei: hvor lett tiltaket er å få godkjent i dagens plan.
export const PLANVEI = {
  fritt: { navn: 'Kan gjøres nå', tekst: 'I tråd med arealformålet. Vanlig søknad eller melding der det kreves.', niva: 4 },
  soknad: { navn: 'Søknad etter pbl.', tekst: 'I tråd med formålet, men krever byggesøknad eller bruksendring.', niva: 3 },
  disp: { navn: 'Krever dispensasjon', tekst: 'Strider mot formålet i mindre grad. Kommunen kan gi dispensasjon (pbl. § 19-2) etter høring.', niva: 2 },
  plan: { navn: 'Krever ny plan', tekst: 'Må inn i kommuneplanen og/eller en reguleringsplan. Typisk 2–6 år.', niva: 1 },
  stopp: { navn: 'Lite realistisk', tekst: 'Strider mot plan eller nasjonale føringer.', niva: 0 },
};

const kr = (n) => `${Math.round(n).toLocaleString('nb-NO')} kr`;

// Kalkylene er enkle anslag med forutsetninger brukeren kan endre. Standardverdiene er typiske nivåer, ikke tilbud eller takst.
export const KALKYLER = {
  skog: {
    felt: [
      { id: 'daa', navn: 'Produktiv skog', enhet: 'daa' },
      { id: 'tilvekst', navn: 'Tilvekst', enhet: 'm³/daa/år', standard: 0.75, hjelp: 'Høy bonitet (G17–G20) gir typisk 0,6–0,9 m³/daa/år' },
      { id: 'rotnetto', navn: 'Rotnetto', enhet: 'kr/m³', standard: 350, hjelp: 'Tømmerpris minus hogst- og transportkostnad' },
      { id: 'skogfond', navn: 'Skogfond (avsatt til foryngelse)', enhet: '%', standard: 15 },
    ],
    regn: (v) => ({ aarlig: v.daa * v.tilvekst * v.rotnetto * (1 - v.skogfond / 100), invest: 0, tekst: `${Math.round(v.daa * v.tilvekst)} m³/år i bærekraftig avvirkning` }),
  },
  jord: {
    felt: [
      { id: 'daa', navn: 'Dyrka mark', enhet: 'daa' },
      { id: 'db', navn: 'Dekningsbidrag inkl. tilskudd', enhet: 'kr/daa/år', standard: 450, hjelp: 'Korn på Romerike: ca. 300–700 kr/daa. Bortleie: ca. 200–400 kr/daa' },
    ],
    regn: (v) => ({ aarlig: v.daa * v.db, invest: 0, tekst: 'Egen drift eller bortleie' }),
  },
  solTak: {
    felt: [
      { id: 'tak', navn: 'Egnet takflate på driftsbygninger', enhet: 'm²', standard: 600 },
      { id: 'kwpm2', navn: 'Effekt', enhet: 'kWp/m²', standard: 0.2 },
      { id: 'kwh', navn: 'Årsproduksjon', enhet: 'kWh/kWp', standard: 850, hjelp: 'Romerike: ca. 800–900 kWh/kWp' },
      { id: 'pris', navn: 'Verdi av strømmen', enhet: 'kr/kWh', standard: 0.9, hjelp: 'Egenbruk sparer kraft + nettleie + avgift; overskudd selges til spotpris' },
      { id: 'kost', navn: 'Investering', enhet: 'kr/kWp', standard: 9000 },
    ],
    regn: (v) => { const kwp = v.tak * v.kwpm2; return { aarlig: kwp * v.kwh * v.pris, invest: kwp * v.kost, tekst: `${Math.round(kwp)} kWp, ${Math.round((kwp * v.kwh) / 1000)} MWh/år` }; },
  },
  solBakke: {
    felt: [
      { id: 'daa', navn: 'Areal til solpark (ikke dyrka jord)', enhet: 'daa', standard: 60 },
      { id: 'leie', navn: 'Grunnleie fra utbygger', enhet: 'kr/daa/år', standard: 2000, hjelp: 'Avtaler i Norden ligger ofte på 1 500–4 000 kr/daa/år' },
    ],
    regn: (v) => ({ aarlig: v.daa * v.leie, invest: 0, tekst: `ca. ${Math.round(v.daa * 0.06 * 10) / 10} MWp` }),
  },
  lager: {
    felt: [
      { id: 'm2', navn: 'Ledig driftsbygning til utleie', enhet: 'm²', standard: 400 },
      { id: 'leie', navn: 'Leie', enhet: 'kr/m²/år', standard: 550, hjelp: 'Kaldlager/bobil- og båtlagring nær Gardermoen' },
      { id: 'kost', navn: 'Opprusting', enhet: 'kr/m²', standard: 1500 },
    ],
    regn: (v) => ({ aarlig: v.m2 * v.leie, invest: v.m2 * v.kost, tekst: 'Utleie av eksisterende bygningsmasse' }),
  },
  hest: {
    felt: [
      { id: 'plasser', navn: 'Stallplasser', enhet: 'stk', standard: 12 },
      { id: 'pris', navn: 'Pris per plass', enhet: 'kr/mnd', standard: 4500 },
      { id: 'margin', navn: 'Netto etter fôr, strø og arbeid', enhet: '%', standard: 35 },
      { id: 'kost', navn: 'Investering per plass', enhet: 'kr', standard: 120000 },
    ],
    regn: (v) => ({ aarlig: v.plasser * v.pris * 12 * (v.margin / 100), invest: v.plasser * v.kost, tekst: 'Oppstalling med beite og ridebane' }),
  },
  jakt: {
    felt: [
      { id: 'daa', navn: 'Jaktareal', enhet: 'daa' },
      { id: 'pris', navn: 'Jaktleie', enhet: 'kr/daa/år', standard: 8 },
    ],
    regn: (v) => ({ aarlig: v.daa * v.pris, invest: 0, tekst: 'Utleie av elg-, rådyr- og småviltjakt' }),
  },
  myr: {
    felt: [
      { id: 'daa', navn: 'Myr/torv', enhet: 'daa' },
      { id: 'co2', navn: 'Utslipp unngått', enhet: 't CO₂e/daa/år', standard: 1.0, hjelp: 'Grøftet myr slipper typisk 0,5–2 t CO₂e/daa/år' },
      { id: 'pris', navn: 'Verdi per tonn (frivillig marked)', enhet: 'kr/t', standard: 0, hjelp: 'Ingen etablert norsk ordning ennå – sett 0 for et nøkternt anslag' },
    ],
    regn: (v) => ({ aarlig: v.daa * v.co2 * v.pris, invest: 0, tekst: `${Math.round(v.daa * v.co2)} t CO₂e/år mindre utslipp. Tiltaket finansieres av staten.` }),
  },
  masse: {
    felt: [
      { id: 'm3', navn: 'Rene masser mottatt', enhet: 'm³/år', standard: 15000 },
      { id: 'pris', navn: 'Netto mottaksgebyr', enhet: 'kr/m³', standard: 40 },
      { id: 'aar', navn: 'Antall år', enhet: 'år', standard: 5 },
    ],
    regn: (v) => ({ aarlig: v.m3 * v.pris, invest: 0, tekst: `${(v.m3 * v.aar).toLocaleString('nb-NO')} m³ over ${v.aar} år` }),
  },
  naering: {
    felt: [
      { id: 'daa', navn: 'Areal foreslått til næring', enhet: 'daa', standard: 40 },
      { id: 'pris', navn: 'Verdi som regulert råtomt', enhet: 'kr/m²', standard: 250, hjelp: 'Uten infrastruktur. Innhent takst – nivået varierer mye' },
      { id: 'kost', navn: 'Plan, utredninger og infrastruktur', enhet: 'kr/m²', standard: 120 },
      { id: 'skogverdi', navn: 'Tapt skogverdi', enhet: 'kr/m²', standard: 1 },
    ],
    regn: (v) => ({ engang: v.daa * 1000 * (v.pris - v.kost - v.skogverdi), aarlig: 0, invest: v.daa * 1000 * v.kost, tekst: 'Engangsverdi ved salg eller feste. Langsiktig og usikkert.' }),
  },
};

export function standardVerdier(id, f) {
  const k = KALKYLER[id]; const v = {};
  for (const x of k.felt) v[x.id] = x.standard ?? 0;
  if ('daa' in v && x0(k, 'daa').standard == null) {
    v.daa = Math.round({ skog: f.skog - (f.areal.skog_lav || 0), jord: f.jordbruk, jakt: f.skog + f.myr, myr: f.myr }[id] ?? 0);
  }
  if (id === 'skog') {
    const h = (f.areal.skog_hoy || 0); const m = (f.areal.skog_middels || 0);
    if (h + m > 0) v.tilvekst = +((h * 0.75 + m * 0.45) / (h + m)).toFixed(2);
  }
  if (id === 'solTak' && f.bygg.landbruk === 0) v.tak = 0;
  return v;
}
const x0 = (k, id) => k.felt.find((x) => x.id === id) || {};

export function regnUt(id, verdier) { return KALKYLER[id].regn(verdier); }

// Vurder alle mulighetene. Hver får planvei, egnethet (0–100), bærekraft (1–5), økonomi (1–5), begrunnelse og neste steg.
export function muligheter(f) {
  const ut = [];
  const lnf = f.lnfAndel > 0.5;
  const stoy = f.stoyAndel > 0.3;
  const leire = f.marinAndel > 0.4;
  const pv = (fri) => (lnf ? fri : 'plan');
  const legg = (m) => ut.push({ ...m, egnet: Math.max(0, Math.min(100, Math.round(m.egnet))) });
  const pst = (x) => `${Math.round(x * 100)} %`;
  const liten = f.daa < 50 ? 25 : f.daa < 150 ? 10 : 0; // store arealprosjekter krever et visst areal
  const daa = (x) => `${Math.round(x).toLocaleString('nb-NO')} daa`;

  if (f.skog > 20) legg({
    id: 'skog', navn: 'Aktivt skogbruk og klimaskog', ikon: '🌲', kategori: 'Kjerne', planvei: 'fritt', baerekraft: 4, okonomi: f.skogHoy > 200 ? 4 : 3,
    egnet: 40 + Math.min(50, (f.skogHoy / Math.max(1, f.daa)) * 60) + (f.skog > 300 ? 10 : 0), kalkyle: 'skog', celler: ['skog_hoy', 'skog_middels'],
    hvorfor: [`${daa(f.skog)} skog, hvorav ${daa(f.skogHoy)} høy eller særs høy bonitet.`, 'Skogbruk er tillatt i LNF uten søknad (unntatt skogsveier og hogst i vernskog/nøkkelbiotoper).'],
    baerekraftTekst: 'Rett tidspunkt for hogst, rask foryngelse med foredlede planter, ungskogpleie og gjødsling øker både tilvekst og CO₂-opptak. Hensyn til nøkkelbiotoper og kantsoner (PEFC/Norsk PEFC Skogstandard).',
    steg: ['Lag eller oppdater skogbruksplanen (tilskudd fra kommunen/Statsforvalteren).', 'Søk tilskudd til tettere planting og gjødsling (klimatiltak i skog).', 'Bruk skogfondet – skattefordel når det brukes til investeringer.', 'Selg GROT/flis til fjernvarme i regionen.'],
    risiko: ['Tømmerpris svinger', 'Tørke, vind og granbarkbille', 'Hogst nær flystøysone/bebyggelse krever hensyn til nabolaget'],
  });

  if (f.jordbruk > 5) legg({
    id: 'jord', navn: 'Matproduksjon på dyrka mark', ikon: '🌾', kategori: 'Kjerne', planvei: 'fritt', baerekraft: 4, okonomi: 2,
    egnet: 50 + Math.min(40, f.jordbruk / 10), kalkyle: 'jord', celler: ['fulldyrka', 'overflatedyrka', 'beite'],
    hvorfor: [`${daa(f.jordbruk)} jordbruksareal, hvorav ${daa(f.fulldyrka)} fulldyrka.`, 'Dyrka jord har sterkt vern (jordlova § 9). Nasjonalt jordvernmål er maks 2 000 daa omdisponert per år.'],
    baerekraftTekst: 'Hold jorda i drift: korn, gras/fôr til hest, eller grønnsaker med gårdsutsalg. Fangvekster, redusert jordarbeiding og grøfting gir bedre jordhelse og mindre avrenning. Tilskudd: RMP og SMIL.',
    steg: ['Vurder egen drift mot bortleie (minst 10 års avtale gir leietaker grunn til å investere).', 'Grøftetilskudd ved dårlig drenering på leirjord.', 'Gårdsutsalg/«REKO-ring» for lokale kunder nær Gardermoen.'],
    risiko: ['Lav lønnsomhet per daa', 'Tung leirjord krever god drenering'],
  });

  legg({
    id: 'solTak', navn: 'Solceller på tak og driftsbygninger', ikon: '☀️', kategori: 'Energi', planvei: 'soknad', baerekraft: 5, okonomi: 3,
    egnet: f.bygg.landbruk + f.bygg['industri/lager'] > 0 ? 75 : 30, kalkyle: 'solTak', celler: ['bebygd'],
    hvorfor: [`${f.bygg.landbruk} landbruksbygg og ${f.bygg.bolig} boligbygg registrert på eiendommen.`, 'Solceller på tak er ofte unntatt søknadsplikt når de monteres flatt på taket (SAK10 § 4-1). Ingen ny arealbruk.'],
    baerekraftTekst: 'Fornybar strøm uten å bruke jord eller skog. Kan kobles med plusskundeavtale, batteri og lading av gårdsmaskiner.',
    steg: ['Få en takvurdering (bæreevne, retning).', 'Sjekk Enova-støtte og plusskundeavtale med nettselskapet.', stoy ? 'Nær Gardermoen: be leverandøren dokumentere at panelene ikke gir blending for fly (Avinor).' : 'Innhent pristilbud fra 2–3 leverandører.'],
    risiko: ['Strømpris', 'Tak kan måtte forsterkes'],
  });

  const ikkeDyrka = f.skog + (f.areal.apen || 0);
  legg({
    id: 'solBakke', navn: 'Bakkemontert solpark på skog/impediment', ikon: '🔆', kategori: 'Energi', planvei: 'plan', baerekraft: 3, okonomi: 4,
    egnet: (ikkeDyrka > 50 ? 45 : 15) - (stoy ? 5 : 0) - liten, kalkyle: 'solBakke', celler: ['skog_lav', 'apen'],
    hvorfor: [`${daa(ikkeDyrka)} areal som ikke er dyrka jord.`, 'Bakkemonterte anlegg over ca. 1 MW krever reguleringsplan (pbl.) og/eller konsesjon (energiloven, NVE). Dyrka mark skal ikke brukes.'],
    baerekraftTekst: 'Velg skog av lav bonitet eller impediment, ikke myr (frigjør CO₂) eller dyrka jord. Kombinert med beite eller pollinatorvennlig vegetasjon (agri-PV) kan arealet fortsatt gi naturverdi.',
    steg: ['Undersøk nettkapasitet hos nettselskapet (Elvia) – ofte flaskehalsen.', 'Ta kontakt med solparkutviklere om opsjons-/leieavtale.', 'Spill inn arealet i neste rullering av kommuneplanen.', stoy ? 'Blendingsanalyse og avklaring med Avinor (innflygingssone).' : 'Landskapsvurdering.'],
    risiko: ['Nettkapasitet', 'Politisk motstand mot nedbygging av skog', 'Lang planprosess'],
  });

  legg({
    id: 'lager', navn: 'Utleie av driftsbygninger (lager, verksted)', ikon: '🏚️', kategori: 'Tilleggsnæring', planvei: lnf ? 'disp' : 'soknad', baerekraft: 4, okonomi: 4,
    egnet: (f.bygg.landbruk > 0 ? 65 : 20) + (f.steder[0]?.km < 10 ? 15 : 0), kalkyle: 'lager', celler: ['bebygd'],
    hvorfor: [`${f.steder[0]?.km.toFixed(1).replace('.', ',')} km i luftlinje til Oslo lufthavn – stor etterspørsel etter lager, bobil-/båtlagring og håndverkerlokaler.`, 'Gjenbruk av eksisterende bygg er det mest bærekraftige alternativet – ingen ny nedbygging.'],
    baerekraftTekst: 'Gjenbruk av bygningsmassen. Ved bruksendring til ikke-landbruk i LNF trengs søknad om bruksendring og som regel dispensasjon. Landbruk pluss-veilederen åpner for tilleggsnæring basert på gårdens ressurser.',
    steg: ['Forhåndskonferanse med kommunen om bruksendring.', 'Brannteknisk vurdering (TEK17) ved lagring av kjøretøy.', 'Skriv leieavtaler med indeksregulering.'],
    risiko: ['Dispensasjon kan bli avslått', 'Trafikk på gårdsvei', 'Krav til brannsikring'],
  });

  legg({
    id: 'hest', navn: 'Hestesenter / oppstalling', ikon: '🐎', kategori: 'Tilleggsnæring', planvei: lnf ? 'soknad' : 'disp', baerekraft: 4, okonomi: 3,
    egnet: 30 + (f.jordbruk > 50 ? 25 : 0) + (f.bygg.landbruk > 0 ? 15 : 0) + (f.steder[1]?.km < 10 ? 10 : 0), kalkyle: 'hest', celler: ['fulldyrka', 'beite'],
    hvorfor: ['Hest regnes som landbruk når fôret i hovedsak produseres på gården – passer LNF.', `${daa(f.jordbruk)} jord til grovfôr og beite. Romerike har mange hesteeiere og høy etterspørsel etter stallplass.`],
    baerekraftTekst: 'Bruker egen jord til grovfôr (lukket kretsløp: gjødsel tilbake til jorda). Krever gjødsellager og beiteplan for å unngå avrenning.',
    steg: ['Søk om bygging/ombygging av stall (søknadspliktig).', 'Mattilsynets krav til hestehold (areal per hest, luftegård).', 'Vurder ridebane, turstier i egen skog og kurs.'],
    risiko: ['Arbeidsintensivt', 'Krav til gjødsellager'],
  });

  legg({
    id: 'myr', navn: 'Restaurering av myr og våtmark', ikon: '💧', kategori: 'Natur og klima', planvei: 'fritt', baerekraft: 5, okonomi: 1,
    egnet: f.myr > 10 ? 60 + Math.min(30, f.myr / 5) : 10, kalkyle: 'myr', celler: ['myr'],
    hvorfor: [`${daa(f.myr)} myr (AR5)${f.torvAndel > 0.05 ? ` og ${pst(f.torvAndel)} torv i løsmassekartet` : ''}.`, 'Miljødirektoratet finansierer restaurering av grøftet myr (tetting av grøfter).'],
    baerekraftTekst: 'Myr lagrer store mengder karbon. Å tette grøfter stopper utslipp, gir flomdemping og bedre levesteder. Kan inngå i framtidige ordninger for naturkreditt.',
    steg: ['Kontakt Statsforvalteren/Miljødirektoratets myrrestaureringsprogram.', 'Kartlegg grøfter og eventuell torvdybde.'],
    risiko: ['Liten direkte inntekt i dag'],
  });

  legg({
    id: 'jakt', navn: 'Jakt, friluftsliv og naturopplevelser', ikon: '🦌', kategori: 'Natur og klima', planvei: 'fritt', baerekraft: 4, okonomi: 1,
    egnet: f.skog > 200 ? 55 : 25, kalkyle: 'jakt', celler: [],
    hvorfor: [`${daa(f.skog + f.myr)} utmark. Jaktleie og enkle opplevelser (gapahuk, sti) krever lite investering.`],
    baerekraftTekst: 'Bruker naturen uten å bygge den ned. Gode forvaltningsplaner for hjortevilt gir mindre beiteskader på ungskog.',
    steg: ['Inngå avtale med jaktlag eller tilby dagskort via Inatur.', 'Samarbeid med naboer om større jaktfelt.'],
    risiko: stoy ? ['Flystøy og nærhet til lufthavn gir lavere opplevelsesverdi'] : [],
  });

  legg({
    id: 'masse', navn: 'Mottak av rene masser / jordforbedring', ikon: '🚛', kategori: 'Arealutvikling', planvei: 'plan', baerekraft: 2, okonomi: 5,
    egnet: 35 + (f.steder[0]?.km < 15 ? 10 : 0) - (leire ? 20 : 0) - (f.kvikkleire?.length ? 30 : 0) - liten, kalkyle: 'masse', celler: [],
    hvorfor: ['Bygge- og anleggsaktiviteten rundt Gardermoen gir stort behov for mottak av overskuddsmasser. Kommuneplanen har egne massemottak (A2, A3).', 'Større mottak krever reguleringsplan, i tillegg til tillatelse etter forurensningsloven.'],
    baerekraftTekst: 'Kan bli bærekraftig når rene masser brukes til å forbedre dyrka jord (planering, bedre drenering) og matjorda legges tilbake. Det gir dårlig bærekraft når skog eller myr fylles igjen.',
    steg: ['Geoteknisk vurdering først' + (leire ? ' – eiendommen ligger i hovedsak på marin leire' : ''), 'Avklar med kommunen om området kan spilles inn i kommuneplanen.', 'Mottakskontroll: kun rene, dokumenterte masser.'],
    risiko: [leire ? 'Marin leire: fare for utglidning ved oppfylling – må utredes (kvikkleire er ikke kartlagt her)' : 'Grunnstabilitet', 'Trafikk og støv', 'Fremmede arter i masser'],
  });

  const naerNaering = f.naermeste.find((n) => n.arealformal === '1300');
  legg({
    id: 'naering', navn: 'Omregulering av skog til næringsareal', ikon: '🏭', kategori: 'Arealutvikling', planvei: 'plan', baerekraft: 2, okonomi: 5,
    egnet: 20 + (naerNaering && naerNaering.km < 2 ? 25 : naerNaering && naerNaering.km < 5 ? 10 : 0) + (f.steder[0]?.km < 8 ? 15 : 0) + (stoy ? 5 : 0) - (f.fulldyrka / Math.max(1, f.daa) > 0.5 ? 20 : 0) - (leire ? 5 : 0) - liten,
    kalkyle: 'naering', celler: [],
    hvorfor: [
      naerNaering ? `Nærmeste næringsområde i kommuneplanen (${naerNaering.navn || 'uten navn'}, ${naerNaering.status}) ligger ${naerNaering.km.toFixed(1).replace('.', ',')} km unna.` : 'Ingen næringsområder i nærheten i kommuneplanen.',
      stoy ? 'Flystøy hindrer bolig, men ikke næring – logistikk og flyplassrelatert næring kan passe i støysonen.' : 'Ikke i flystøysone.',
      'Krever at kommunen tar arealet inn i kommuneplanen og at det deretter reguleres. Statsforvalteren har fremmet innsigelse mot nye store næringsområder i Nannestad av hensyn til jordvern.',
    ],
    baerekraftTekst: 'Nedbygging av skog gir tap av karbonlager og natur. Mest forsvarlig er det på skog med lav bonitet, ikke på dyrka jord eller myr, og som utvidelse av eksisterende næringsområde med god kollektivdekning.',
    steg: ['Spill inn konkret areal ved neste rullering av kommuneplanens arealdel (følg kommunens planstrategi).', 'Prioriter skog med lavest bonitet nærmest vei og eksisterende næring.', 'Snakk med eiendomsutviklere om opsjonsavtale – de bærer ofte plankostnaden.'],
    risiko: ['Lav sannsynlighet for gjennomslag på kort sikt', 'Kostbar regulering og infrastruktur', 'Marin leire'],
  });

  legg({
    id: 'bolig', navn: 'Boligutvikling / tomtesalg', ikon: '🏠', kategori: 'Arealutvikling', planvei: f.flystoyRod > 0.2 || f.flystoyGul > 0.5 ? 'stopp' : 'plan', baerekraft: 2, okonomi: 4,
    egnet: f.flystoyGul + f.flystoyRod > 0.5 ? 5 : 25, kalkyle: null, celler: [],
    hvorfor: [f.flystoyGul + f.flystoyRod > 0 ? `${pst(f.flystoyGul + f.flystoyRod)} av eiendommen ligger i flystøysone (H210/H220). Nye boliger og annen støyfølsom bruk (barnehage, Inn på tunet med overnatting) tillates normalt ikke.` : 'Ikke i flystøysone.', 'Boliger i LNF krever plan eller dispensasjon.'],
    baerekraftTekst: 'Spredt boligbygging i LNF gir bilavhengighet og arealtap.',
    steg: ['Lite aktuelt her – prioriter andre muligheter.'], risiko: ['Flystøy (retningslinje T-1442)'],
  });

  return ut.sort((a, b) => b.egnet - a.egnet);
}

// ---------- Mulighetskart ----------

// Anbefalt bruk for hver celle i rutenettet.
export const BRUK = {
  mat: { navn: 'Matproduksjon (jordvern)', farge: '#e0b43a' },
  skog: { navn: 'Skogproduksjon og klimaskog', farge: '#2f7d4a' },
  natur: { navn: 'Natur, myr og friluft', farge: '#7c6aa8' },
  tun: { navn: 'Tunnæring: utleie, solceller, stall', farge: '#c0532f' },
  utvikling: { navn: 'Kandidat for innspill (sol/næring)', farge: '#2b6cb0' },
};

export function mulighetskart(data, f) {
  const tun = (data.bygninger || []).map((b) => b.punkt);
  const naer = (f.naermeste || []).filter((n) => n.arealformal === '1300' || n.arealformal === '1200');
  return data.celler.map((c) => {
    const k = c.kat || kategori(c.ar5);
    const tilTun = tun.length ? Math.min(...tun.map((t) => avstandM(c.p, t))) : Infinity;
    let bruk;
    if (k === 'bebygd' || tilTun < 60) bruk = 'tun';
    else if (['fulldyrka', 'overflatedyrka', 'beite'].includes(k)) bruk = 'mat';
    else if (['myr', 'vann'].includes(k)) bruk = 'natur';
    else if (['skog_lav', 'apen', 'annet'].includes(k)) bruk = 'utvikling';
    else bruk = 'skog';
    return { p: c.p, kat: k, bruk, tilTun };
  });
}

export function brukAreal(celler, f) {
  const d = f.daa / (celler.length || 1); const ut = {};
  for (const c of celler) ut[c.bruk] = (ut[c.bruk] || 0) + d;
  return ut;
}

export { kr };
