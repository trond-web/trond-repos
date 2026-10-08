// Oppdrag: ett eller flere planlagte tiltak samlet til en bestilling til en utfører (entreprenør, tømmerkjøper,
// planteleverandør …). Hver tiltakstype har sin egen oppdragstype med egne felt og egen sjekkliste, bygd på
// Norsk PEFC Skogstandard (kravpunktnumrene følger KRAVPUNKTER i pefc.js) og vanlig praksis i skogbruket. Ingen DOM – kan testes i Node.

// felt: { id, navn, type: 'tekst' | 'tall' | 'valg' | 'dato', valg?, enhet?, standard? }
// sjekk: { id, tekst, pefc? } – pefc er kravpunktnummer i Norsk PEFC Skogstandard.
const HOGST_FELLES_SJEKK = [
  { id: 'mis', tekst: 'Nøkkelbiotoper (MiS) og miljøfigurer er merket i kart og terreng, og holdes utenfor drift', pefc: 22 },
  { id: 'kantsone', tekst: 'Kantsone mot vann, myr og dyrket mark er avklart og merket', pefc: 27 },
  { id: 'livslop', tekst: 'Livsløpstrær (minst 10 per hektar) er valgt ut og merket', pefc: 13 },
  { id: 'kulturminner', tekst: 'Kulturminner er sjekket og merket, og kjøres ikke over', pefc: 30 },
  { id: 'kjoreskader', tekst: 'Driftsforhold er vurdert (bæreevne, tele, nedbør). Kjøreskader unngås og utbedres', pefc: 14 },
  { id: 'friluft', tekst: 'Stier, løyper og friluftsinteresser er vurdert, og stier ryddes etter drift', pefc: 6 },
  { id: 'sha', tekst: 'Sikkerhet, helse og arbeidsmiljø (SHA) er avklart. Varsling ved arbeid nær vei og strømlinjer', pefc: 2 },
  { id: 'avtale', tekst: 'Skriftlig avtale om pris, sortiment, levering og oppgjør er inngått' },
];
const KULTUR_FELLES_SJEKK = [
  { id: 'mis', tekst: 'Nøkkelbiotoper og miljøfigurer er kjent for utfører og holdes utenfor', pefc: 22 },
  { id: 'kulturminner', tekst: 'Kulturminner er sjekket og merket', pefc: 30 },
  { id: 'tilskudd', tekst: 'Tilskudd (NMSK) er søkt i ØKS, eller vurdert som ikke aktuelt' },
  { id: 'rapport', tekst: 'Utført mengde og areal rapporteres tilbake for registrering i planen' },
];
const DRIFTSMETODE = ['Hogstmaskin og lassbærer', 'Taubane', 'Motormanuell', 'Hest'];

export const OPPDRAGSTYPER = {
  sluttavvirkning: {
    navn: 'Hogstoppdrag – sluttavvirkning', kort: 'Sluttavvirkning', utforer: 'Hogstentreprenør / tømmerkjøper', enhet: 'm³',
    felt: [
      { id: 'kjoper', navn: 'Tømmerkjøper', type: 'tekst' },
      { id: 'driftsmetode', navn: 'Driftsmetode', type: 'valg', valg: DRIFTSMETODE, standard: DRIFTSMETODE[0] },
      { id: 'sortiment', navn: 'Sortiment / aptering', type: 'tekst', standard: 'Sagtømmer og massevirke etter kjøpers apteringsinstruks' },
      { id: 'velteplass', navn: 'Velteplass / levering', type: 'tekst' },
      { id: 'gjensetting', navn: 'Gjensettingstrær', type: 'tall', enhet: 'per daa', standard: 1 },
      { id: 'foryngelse', navn: 'Plan for foryngelse', type: 'valg', valg: ['Planting', 'Naturlig foryngelse (frøtrær)', 'Markberedning og planting', 'Ikke avklart'], standard: 'Markberedning og planting' },
    ],
    sjekk: [...HOGST_FELLES_SJEKK, { id: 'foryngelse', tekst: 'Foryngelse er planlagt (foryngelsesplikt innen 3 år)', pefc: 15 }, { id: 'skogfond', tekst: 'Skogfond trekkes ved oppgjør, og hogsten er innrapportert' }],
  },
  tynning: {
    navn: 'Hogstoppdrag – tynning', kort: 'Tynning', utforer: 'Hogstentreprenør / tømmerkjøper', enhet: 'm³',
    felt: [
      { id: 'kjoper', navn: 'Tømmerkjøper', type: 'tekst' },
      { id: 'driftsmetode', navn: 'Driftsmetode', type: 'valg', valg: DRIFTSMETODE, standard: DRIFTSMETODE[0] },
      { id: 'uttak', navn: 'Uttak', type: 'tall', enhet: '% av volum', standard: 25 },
      { id: 'gjenstaende', navn: 'Treantall etter tynning', type: 'tall', enhet: 'per daa' },
      { id: 'velteplass', navn: 'Velteplass / levering', type: 'tekst' },
    ],
    sjekk: [...HOGST_FELLES_SJEKK, { id: 'stikkveier', tekst: 'Stikkveier er lagt med maks 4 m bredde og minst 20 m mellom' }, { id: 'skade', tekst: 'Skader på gjenstående trær holdes under 5 %' }],
  },
  lukkethogst: {
    navn: 'Hogstoppdrag – lukket hogst', kort: 'Lukket hogst', utforer: 'Hogstentreprenør / tømmerkjøper', enhet: 'm³',
    felt: [
      { id: 'kjoper', navn: 'Tømmerkjøper', type: 'tekst' },
      { id: 'hogstform', navn: 'Hogstform', type: 'valg', valg: ['Skjermstillingshogst', 'Gruppehogst', 'Bledningshogst / plukkhogst', 'Kanthogst'], standard: 'Gruppehogst' },
      { id: 'uttak', navn: 'Uttak', type: 'tall', enhet: '% av volum', standard: 35 },
      { id: 'driftsmetode', navn: 'Driftsmetode', type: 'valg', valg: DRIFTSMETODE, standard: DRIFTSMETODE[0] },
      { id: 'velteplass', navn: 'Velteplass / levering', type: 'tekst' },
    ],
    sjekk: [...HOGST_FELLES_SJEKK, { id: 'skjerm', tekst: 'Trær som skal stå (skjerm og frøtrær) er merket' }],
  },
  planting: {
    navn: 'Plantingsoppdrag', kort: 'Planting', utforer: 'Plantelag / skogsentreprenør', enhet: 'planter',
    felt: [
      { id: 'treslag', navn: 'Treslag', type: 'valg', valg: ['Gran', 'Furu', 'Bjørk', 'Blanding'], standard: 'Gran' },
      { id: 'planter', navn: 'Plantetall', type: 'tall', enhet: 'per daa', standard: 220 },
      { id: 'provenienser', navn: 'Proveniens / planteleverandør', type: 'tekst' },
      { id: 'plantetype', navn: 'Plantetype', type: 'valg', valg: ['Pluggplanter', 'Barrotplanter', 'Storplanter'], standard: 'Pluggplanter' },
    ],
    sjekk: [...KULTUR_FELLES_SJEKK, { id: 'oppbevaring', tekst: 'Plantene oppbevares kjølig og fuktig fram til planting' }, { id: 'snutebille', tekst: 'Plantene er behandlet mot gransnutebille, eller planting er utsatt (2–3 år etter hogst)', pefc: 18 }],
  },
  suppleringsplanting: {
    navn: 'Suppleringsplanting', kort: 'Suppleringsplanting', utforer: 'Plantelag / skogsentreprenør', enhet: 'planter',
    felt: [
      { id: 'treslag', navn: 'Treslag', type: 'valg', valg: ['Gran', 'Furu', 'Bjørk', 'Blanding'], standard: 'Gran' },
      { id: 'planter', navn: 'Plantetall', type: 'tall', enhet: 'per daa', standard: 60 },
      { id: 'provenienser', navn: 'Proveniens / planteleverandør', type: 'tekst' },
    ],
    sjekk: [...KULTUR_FELLES_SJEKK, { id: 'tetthet', tekst: 'Tettheten er kontrollert etter supplering (minst 150–200 planter per daa for gran)' }],
  },
  markberedning: {
    navn: 'Markberedningsoppdrag', kort: 'Markberedning', utforer: 'Skogsentreprenør', enhet: 'daa',
    felt: [
      { id: 'metode', navn: 'Metode', type: 'valg', valg: ['Flekkmarkberedning', 'Harving', 'Hauglegging', 'Grøfting/hauglegging'], standard: 'Flekkmarkberedning' },
      { id: 'flekker', navn: 'Antall flekker', type: 'tall', enhet: 'per daa', standard: 250 },
    ],
    sjekk: [...KULTUR_FELLES_SJEKK, { id: 'vann', tekst: 'Ingen markberedning i kantsoner, nær bekker eller på myr', pefc: 16 }, { id: 'erosjon', tekst: 'Markberedningen følger ikke fallinjen i bratt terreng (erosjon)' }],
  },
  ungskogpleie: {
    navn: 'Ungskogpleieoppdrag', kort: 'Ungskogpleie', utforer: 'Skogsentreprenør', enhet: 'daa',
    felt: [
      { id: 'treantall', navn: 'Treantall etter pleie', type: 'tall', enhet: 'per daa', standard: 200 },
      { id: 'hovedtreslag', navn: 'Hovedtreslag', type: 'valg', valg: ['Gran', 'Furu', 'Bjørk', 'Blanding'], standard: 'Gran' },
      { id: 'lauv', navn: 'Lauvinnblanding som spares', type: 'tall', enhet: '%', standard: 10 },
    ],
    sjekk: [...KULTUR_FELLES_SJEKK, { id: 'lauv', tekst: 'Treslagsblanding og lauv spares der det er naturlig (biologisk mangfold)', pefc: 17 }, { id: 'kantsone', tekst: 'Kantsoner mot vann og myr pleies ikke', pefc: 27 }],
  },
  stammekvisting: {
    navn: 'Stammekvistingsoppdrag', kort: 'Stammekvisting', utforer: 'Skogsentreprenør', enhet: 'trær',
    felt: [
      { id: 'trar', navn: 'Trær som kvistes', type: 'tall', enhet: 'per daa', standard: 60 },
      { id: 'hoyde', navn: 'Kvisthøyde', type: 'tall', enhet: 'm', standard: 5.5 },
    ],
    sjekk: [...KULTUR_FELLES_SJEKK, { id: 'utvalg', tekst: 'De beste framtidstrærne er valgt ut og merket' }],
  },
  gjodsling: {
    navn: 'Gjødslingsoppdrag', kort: 'Gjødsling', utforer: 'Skogsentreprenør / helikopterfirma', enhet: 'daa',
    felt: [
      { id: 'produkt', navn: 'Gjødselprodukt', type: 'tekst', standard: 'Skog-N / Skogsalpeter' },
      { id: 'kgN', navn: 'Nitrogen', type: 'tall', enhet: 'kg N per daa', standard: 15 },
      { id: 'metode', navn: 'Spredning', type: 'valg', valg: ['Helikopter', 'Bakke'], standard: 'Helikopter' },
    ],
    sjekk: [{ id: 'sone', tekst: 'Gjødslingsfri sone på 25 m mot vann, bekker, myr, nøkkelbiotoper og BVO (50 m ved lav presisjon)', pefc: 19 }, { id: 'tidspunkt', tekst: 'Gjødsles etter snøsmelting og før utgangen av august', pefc: 19 }, { id: 'vegetasjon', tekst: 'Bare på egnede vegetasjonstyper med forventet produksjonsøkning', pefc: 19 }, { id: 'dokumentasjon', tekst: 'Gjødslingen er dokumentert med kart, mengde og dato', pefc: 19 }],
  },
  groftrensk: {
    navn: 'Grøfterensk', kort: 'Grøfterensk', utforer: 'Maskinentreprenør', enhet: 'm',
    felt: [
      { id: 'lengde', navn: 'Grøftelengde', type: 'tall', enhet: 'm' },
      { id: 'maskin', navn: 'Maskin', type: 'tekst', standard: 'Gravemaskin' },
    ],
    sjekk: [{ id: 'sediment', tekst: 'Sedimentfangst (slamgroper) før utløp i vassdrag', pefc: 27 }, { id: 'kantsone', tekst: 'Kantsone mot vassdrag beholdes', pefc: 27 }, { id: 'myr', tekst: 'Ingen nygrøfting av myr eller sumpskog', pefc: 28 }, { id: 'kulturminner', tekst: 'Kulturminner er sjekket', pefc: 30 }],
  },
  vei: {
    navn: 'Veioppdrag', kort: 'Vei', utforer: 'Veientreprenør', enhet: 'm',
    felt: [
      { id: 'veiklasse', navn: 'Veiklasse', type: 'valg', valg: ['Kl. 3 sommerbilvei', 'Kl. 4 sommerbilvei', 'Kl. 5 vinterbilvei', 'Kl. 7 traktorvei', 'Kl. 8 enkel traktorvei'], standard: 'Kl. 7 traktorvei' },
      { id: 'lengde', navn: 'Lengde', type: 'tall', enhet: 'm' },
      { id: 'tiltakstype', navn: 'Arbeid', type: 'valg', valg: ['Nybygging', 'Ombygging', 'Vedlikehold'], standard: 'Nybygging' },
    ],
    sjekk: [{ id: 'godkjenning', tekst: 'Godkjent av kommunen etter forskrift om planlegging og godkjenning av veier til landbruksformål', pefc: 5 }, { id: 'tilskudd', tekst: 'Tilskudd til skogsvei er søkt' }, { id: 'vann', tekst: 'Stikkrenner og vannhåndtering er dimensjonert' }, { id: 'kulturminner', tekst: 'Kulturminner og miljøverdier er sjekket', pefc: 30 }],
  },
  miljo: {
    navn: 'Miljøtiltak', kort: 'Miljøtiltak', utforer: 'Skogeier / entreprenør', enhet: 'daa',
    felt: [{ id: 'beskrivelse', navn: 'Tiltak', type: 'tekst', standard: 'Skjøtsel etter plan for nøkkelbiotop' }],
    sjekk: [{ id: 'plan', tekst: 'Tiltaket følger skjøtselsplan eller miljøregistrering', pefc: 22 }, { id: 'dokumentasjon', tekst: 'Tiltaket er dokumentert med kart og dato' }],
  },
  annet: {
    navn: 'Oppdrag', kort: 'Annet', utforer: 'Utfører', enhet: 'daa',
    felt: [{ id: 'beskrivelse', navn: 'Beskrivelse', type: 'tekst' }],
    sjekk: [{ id: 'avtale', tekst: 'Avtale om pris og omfang er inngått' }],
  },
};

export const OPPDRAGSSTATUS = {
  utkast: { navn: 'Utkast', farge: '#8a8a85' },
  bestilt: { navn: 'Bestilt', farge: '#2a78d6' },
  pagar: { navn: 'Pågår', farge: '#fab219' },
  utfort: { navn: 'Utført', farge: '#0ca30c' },
  avbrutt: { navn: 'Avbrutt', farge: '#d03b3b' },
};
export const AKTIVE_STATUS = ['utkast', 'bestilt', 'pagar'];

export const typeFor = (tiltakstype) => OPPDRAGSTYPER[tiltakstype] || OPPDRAGSTYPER.annet;

// Neste ledige oppdragsnummer for året: O-2026-01, O-2026-02 …
export function nesteNr(oppdrag, aar) {
  const brukt = (oppdrag || []).map((o) => String(o.nr || '').match(new RegExp(`^O-${aar}-(\\d+)$`))).filter(Boolean).map((m) => Number(m[1]));
  return `O-${aar}-${String((brukt.length ? Math.max(...brukt) : 0) + 1).padStart(2, '0')}`;
}

// Tiltak som kan tas med: planlagte tiltak som ikke allerede ligger i et aktivt oppdrag.
export function ledig(t, oppdrag) {
  if (!t || t.status === 'utfort') return false;
  if (!t.oppdragId) return true;
  const o = (oppdrag || []).find((x) => x.id === t.oppdragId);
  return !o || !AKTIVE_STATUS.includes(o.status);
}

// Lager ett oppdrag per tiltakstype av de valgte tiltakene ([{ bestand, tiltak }]).
// Returnerer { oppdrag: [...nye], hoppetOver: [...] }. Tiltakene får oppdragId.
export function lagOppdrag(S, valgte, { nyId, iAar = new Date().getFullYear(), idag = new Date().toISOString().slice(0, 10) } = {}) {
  S.oppdrag = S.oppdrag || [];
  const hoppetOver = valgte.filter(({ tiltak }) => !ledig(tiltak, S.oppdrag));
  const perType = new Map();
  for (const v of valgte) {
    if (!ledig(v.tiltak, S.oppdrag)) continue;
    const k = OPPDRAGSTYPER[v.tiltak.type] ? v.tiltak.type : 'annet';
    if (!perType.has(k)) perType.set(k, []);
    perType.get(k).push(v);
  }
  const nye = [];
  for (const [type, liste] of perType) {
    const ot = OPPDRAGSTYPER[type];
    const aar = Math.min(...liste.map((v) => v.tiltak.aar || iAar));
    const o = {
      id: nyId('o'), nr: nesteNr(S.oppdrag, iAar), type, status: 'utkast',
      tittel: `${ot.kort} ${aar} – ${liste.length} bestand`,
      utforer: { navn: '', kontakt: '', telefon: '', epost: '' },
      periode: { fra: '', til: '' },
      felt: Object.fromEntries(ot.felt.filter((f) => f.standard !== undefined).map((f) => [f.id, f.standard])),
      sjekk: {},
      linjer: liste.map(({ bestand, tiltak }) => ({ bestandId: bestand.id, tiltakId: tiltak.id })),
      merknad: '', opprettet: idag,
    };
    for (const { tiltak } of liste) tiltak.oppdragId = o.id;
    S.oppdrag.push(o); nye.push(o);
  }
  return { oppdrag: nye, hoppetOver };
}

// Linjene i et oppdrag med bestand og tiltak slått opp (tiltak som er slettet, utelates).
export function linjer(S, o) {
  return (o.linjer || []).map((l) => {
    const bestand = S.bestand.find((b) => b.id === l.bestandId);
    const tiltak = bestand?.tiltak?.find((t) => t.id === l.tiltakId);
    return bestand && tiltak ? { bestand, tiltak } : null;
  }).filter(Boolean);
}

// Mengder for oppdraget. okonomi(tiltak med bestand) → { m3, netto } brukes for hogst og kostnad.
export function sammendrag(S, o, okonomi = () => ({ m3: 0, netto: 0 })) {
  const ls = linjer(S, o);
  const areal = ls.reduce((s, l) => s + (l.bestand.areal || 0), 0);
  let m3 = 0; let netto = 0;
  for (const l of ls) { const ok = okonomi({ ...l.tiltak, bestand: l.bestand }); m3 += ok.m3 || 0; netto += ok.netto || 0; }
  const per = Number(o.felt?.planter ?? o.felt?.trar) || 0;
  const antall = per ? Math.round(per * areal) : null;
  const ot = typeFor(o.type);
  const sjekk = ot.sjekk.filter((s) => o.sjekk?.[s.id]).length;
  return { bestand: ls.length, areal, m3, netto, antall, sjekk, sjekkTotalt: ot.sjekk.length, aar: ls.length ? Math.min(...ls.map((l) => l.tiltak.aar)) : null };
}

// Fjerner et tiltak fra oppdraget.
export function fjernLinje(S, o, tiltakId) {
  o.linjer = (o.linjer || []).filter((l) => l.tiltakId !== tiltakId);
  for (const b of S.bestand) for (const t of b.tiltak || []) if (t.id === tiltakId && t.oppdragId === o.id) delete t.oppdragId;
}

// Sletter oppdraget og frigjør tiltakene.
export function slettOppdrag(S, o) {
  for (const { tiltak } of linjer(S, o)) if (tiltak.oppdragId === o.id) delete tiltak.oppdragId;
  S.oppdrag = (S.oppdrag || []).filter((x) => x !== o);
}

// Legger ledige tiltak av samme type inn i et eksisterende oppdrag.
export function leggTil(S, o, valgte) {
  let n = 0;
  for (const { bestand, tiltak } of valgte) {
    if ((OPPDRAGSTYPER[tiltak.type] ? tiltak.type : 'annet') !== o.type || !ledig(tiltak, S.oppdrag)) continue;
    if (o.linjer.some((l) => l.tiltakId === tiltak.id)) continue;
    o.linjer.push({ bestandId: bestand.id, tiltakId: tiltak.id }); tiltak.oppdragId = o.id; n++;
  }
  return n;
}
