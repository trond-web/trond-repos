// 🌍 EUDR – EUs avskogingsforordning (EU) 2023/1115: dokumentasjon av at tømmer fra eiendommen er avskogingsfritt
// og lovlig produsert, med geolokasjon, forenklet engangserklæring for primærvirksomheter og leveranselogg.
// Ingen DOM – testes i Node.
//
// Status (Landbruksdirektoratet, kontrollert 2026-11-25): forordningen gjelder i EU fra 30. desember 2026 for store og
// mellomstore bedrifter og fra 30. juni 2027 for små og mikroforetak. Den er IKKE tatt inn i EØS-avtalen eller norsk
// rett, og det er lite sannsynlig at det skjer innen 2027. Norge er klassifisert som lavrisikoland. Regjeringen har
// bestemt at bare de EØS-relevante delene gjennomføres (tre – ikke storfekjøtt og soya). Den ukentlige kildesjekken
// følger med på status.
import { arealM2 } from './proj.js';
import { framskriv, sammendrag, STANDARD_INNSTILLINGER } from './model.js';

export const KONTROLLERT = '2026-11-25';
export const STATUS = {
  innfortNorge: false,
  euFra: { stor: '2026-12-30', liten: '2027-06-30' },
  tekst: 'EUDR er ikke innført i Norge. Forordningen er ikke tatt inn i EØS-avtalen, og Klima- og miljødepartementet mener det er lite sannsynlig at det skjer innen 2027. Det er derfor usikkert om og når kravene vil gjelde for norske skogeiere. I EU gjelder kravene fra 30. desember 2026 for store og mellomstore bedrifter og fra 30. juni 2027 for små og mikroforetak, så tømmer som eksporteres til EU kan likevel trenge dokumentasjon.',
  kilde: { navn: 'Landbruksdirektoratet: EUs avskogingsforordning (EUDR)', url: 'https://www.landbruksdirektoratet.no/nb/skogbruk/eus-avskogingsforordning-eudr' },
  forordning: { navn: 'Forordning (EU) 2023/1115', url: 'https://eur-lex.europa.eu/eli/reg/2023/1115/oj' },
  kommisjonen: { navn: 'EU-kommisjonen: EUDR', url: 'https://green-business.ec.europa.eu/deforestation-regulation-implementation_en' },
  skjaeringsdato: '2020-12-31',
};

// Sortimenter (HS-koder i forordningens vedlegg I) og treslag med vitenskapelig navn.
export const SORTIMENT = {
  4403: { navn: 'Tømmer og massevirke (rundvirke)', hs: '4403' },
  4401: { navn: 'Ved, flis og brensel', hs: '4401' },
};
export const TRESLAG = {
  G: { navn: 'Gran', vitenskapelig: 'Picea abies', kgPerM3: 800 },
  F: { navn: 'Furu', vitenskapelig: 'Pinus sylvestris', kgPerM3: 850 },
  L: { navn: 'Lauv (bjørk)', vitenskapelig: 'Betula pubescens / Betula pendula', kgPerM3: 950 },
};
export const ERKLAERINGSTEKST = 'Ved denne erklæringen bekrefter primærvirksomheten at de vil utvise tilbørlig aktsomhet i tråd med forordning (EU) 2023/1115 for de relevante produktene de plasserer på markedet eller eksporterer, og at de kun vil plassere dem på markedet eller eksportere dem dersom det ikke er funnet noen risiko, eller kun en ubetydelig risiko, for at de relevante produktene ikke er i samsvar med artikkel 3 bokstav a) eller b).';
export const ROLLER = {
  fullmakt: { navn: 'Tømmerkjøperen registrerer for meg (fullmakt)', tekst: 'En fysisk person eller et mikroforetak kan gi fullmakt til neste ledd i kjeden – vanligvis skogeierandelslaget eller tømmerkjøperen – til å registrere erklæringen. Du gir dem informasjonen under (geolokasjon, treslag, mengde og bekreftelse på at tømmeret er avskogingsfritt og lovlig), men beholder ansvaret.' },
  primaer: { navn: 'Mikro- eller liten primærvirksomhet (forenklet erklæring)', tekst: 'Du hogger og selger tømmer eller ved fra egen eiendom og er en fysisk person eller et mikro- eller lite foretak i et lavrisikoland. Du registrerer én forenklet engangserklæring i EUs informasjonssystem og videresender erklæringsnummeret med varene.' },
  virksomhet: { navn: 'Virksomhet med aktsomhetserklæring', tekst: 'Større virksomheter (eller når du ikke kan bruke de forenklede reglene) må registrere en aktsomhetserklæring før varene omsettes. Fra Norge (lavrisiko) holder en forenklet aktsomhetsvurdering: bare trinn 1, innsamling av informasjon.' },
};

// Sjekkliste for lovlighet og avskogingsfrihet (forordningen art. 2 nr. 40 og art. 3). auto = kan vurderes ut fra planen.
export const SJEKKLISTE = [
  { id: 'omdisponert', tekst: 'Ingen del av hogstarealet er gjort om til jordbruk, bebyggelse eller annen bruk etter 31. desember 2020 (avskoging)' },
  { id: 'forringelse', tekst: 'Naturskog eller naturlig forynget skog er ikke gjort om til plantasjeskog (for eksempel tett planting av ett utenlandsk treslag) etter 31. desember 2020 (skogforringelse)' },
  { id: 'foryngelse', tekst: 'Hogstflater er forynget innen fristen i forskrift om berekraftig skogbruk', auto: true },
  { id: 'vern', tekst: 'Ingen hogst i verneområder uten tillatelse, og miljøhensyn (nøkkelbiotoper, kantsoner) er ivaretatt', auto: true },
  { id: 'melding', tekst: 'Hogst i vernskog og i Marka er meldt eller godkjent der det kreves' },
  { id: 'rettigheter', tekst: 'Hogsten er gjort av eier eller med eiers samtykke, og tredjeparts rettigheter (bruksrett, beiterett, reindrift) er respektert' },
  { id: 'arbeid', tekst: 'Arbeids- og HMS-regler, skatt og avgifter er fulgt (også hos entreprenøren)' },
];

const rund6 = (v) => Math.round(v * 1e6) / 1e6;
// Geometri med koordinater på nøyaktig 6 desimaler (krav i forordningen), lukkede ringer.
export function geo6(g) {
  const ring = (r) => { const ut = r.map(([x, y]) => [rund6(x), rund6(y)]); const [a, b] = [ut[0], ut.at(-1)]; if (a && (a[0] !== b[0] || a[1] !== b[1])) ut.push([...a]); return ut; };
  if (g?.type === 'Polygon') return { type: 'Polygon', coordinates: g.coordinates.map(ring) };
  if (g?.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: g.coordinates.map((p) => p.map(ring)) };
  if (g?.type === 'Point') return { type: 'Point', coordinates: g.coordinates.map(rund6) };
  return null;
}
// GeoJSON som EUs informasjonssystem tar imot: én Feature per produksjonssted med ProducerName, ProducerCountry,
// ProductionPlace og Area (hektar). Polygon brukes for alle steder (kravet gjelder over 4 ha, men er lov også under).
export function geojson(S, { bestandIder = null, produsent = null } = {}) {
  const navn = produsent || S?.eudr?.virksomhet?.navn || S?.eiendom?.eier || S?.eiendom?.navn || '';
  const sted = (b) => `${S?.eiendom?.navn || 'Eiendom'} ${S?.eiendom?.gnrbnr ? `(${S.eiendom.gnrbnr})` : ''} – bestand ${b.nr ?? b.id}`.replace(/\s+/g, ' ').trim();
  const kilder = bestandIder ? (S?.bestand || []).filter((b) => bestandIder.includes(b.id)) : null;
  const features = (kilder || []).filter((b) => b.geometri).map((b) => ({ type: 'Feature', properties: { ProducerName: navn, ProducerCountry: 'NO', ProductionPlace: sted(b), Area: Math.round((arealM2(b.geometri) / 10000) * 100) / 100 }, geometry: geo6(b.geometri) }));
  if (!kilder && S?.eiendom?.grense) features.push({ type: 'Feature', properties: { ProducerName: navn, ProducerCountry: 'NO', ProductionPlace: `${S.eiendom.navn || 'Eiendom'}${S.eiendom.gnrbnr ? ` (${S.eiendom.gnrbnr})` : ''}`, Area: Math.round((arealM2(S.eiendom.grense) / 10000) * 100) / 100 }, geometry: geo6(S.eiendom.grense) });
  return { type: 'FeatureCollection', features: features.filter((f) => f.geometry) };
}

// Hogst på eiendommen etter skjæringsdatoen: utførte og planlagte sluttavvirkninger og tynninger.
const HOGST = new Set(['sluttavvirkning', 'tynning', 'lukkethogst']);
export function hogster(S) {
  const ut = [];
  for (const b of S?.bestand || []) for (const t of b.tiltak || []) if (HOGST.has(t.type)) ut.push({ b, t, utfort: t.status === 'utfort', aar: Number(t.aar) });
  return ut.sort((a, c) => a.aar - c.aar);
}

// Automatiske vurderinger ut fra planen. Gir { id, nivaa: 'ok' | 'varsel' | 'avvik' | 'info', tekst }.
export function vurdering(S, iAar = new Date().getFullYear()) {
  const ut = []; const h = hogster(S);
  // Foryngelse: sluttavvirkning utført for mer enn tre år siden uten registrert planting, markberedning eller foryngelse.
  const mangler = h.filter(({ b, t, utfort }) => utfort && t.type === 'sluttavvirkning' && iAar - t.aar > 3 && !(b.tiltak || []).some((x) => ['planting', 'suppleringsplanting', 'markberedning'].includes(x.type) && x.status === 'utfort' && Number(x.aar) >= t.aar) && !(b.hogstklasse === 1 && (b.treantall || 0) > 0));
  ut.push(mangler.length ? { id: 'foryngelse', nivaa: 'avvik', tekst: `Bestand ${mangler.map((x) => x.b.nr).join(', ')}: sluttavvirket for mer enn tre år siden uten registrert foryngelse. Foryngelse innen fristen er krav i forskrift om berekraftig skogbruk – registrer planting eller naturlig foryngelse.` } : { id: 'foryngelse', nivaa: 'ok', tekst: 'Ingen hogstflater mangler registrert foryngelse.' });
  // Miljø: hogst i bestand med miljøfigur (nøkkelbiotop) eller i verneområde.
  const miljo = h.filter(({ b }) => b.miljo || b.vern);
  ut.push(miljo.length ? { id: 'vern', nivaa: 'varsel', tekst: `Hogst i bestand ${[...new Set(miljo.map((x) => x.b.nr))].join(', ')} som har miljøfigur eller vern. Kontroller at hogsten er lovlig og at miljøverdiene er ivaretatt (PEFC og naturmangfoldloven).` } : { id: 'vern', nivaa: 'ok', tekst: 'Ingen hogst i bestand med miljøfigur eller vern.' });
  // Avskoging: produktive bestand som er gjort om til annen arealbruk etter 2020 (merket «omdisponert» i planen).
  const omd = (S?.bestand || []).filter((b) => b.omdisponert && Number(String(b.omdisponert).slice(0, 4)) > 2020);
  ut.push(omd.length ? { id: 'omdisponert', nivaa: 'avvik', tekst: `Bestand ${omd.map((b) => b.nr).join(', ')} er merket omdisponert etter 2020. Tømmer derfra er ikke avskogingsfritt.` } : { id: 'omdisponert', nivaa: 'info', tekst: 'Ingen bestand er merket omdisponert. Bekreft i sjekklisten at ingen hogstflate er gjort om til jordbruk eller bebyggelse.' });
  ut.push({ id: 'risiko', nivaa: 'info', tekst: 'Norge er klassifisert som lavrisikoland. Forenklet aktsomhetsvurdering holder: samle informasjon (trinn 1) – risikovurdering og risikoreduserende tiltak trengs ikke.' });
  const geo = (S?.bestand || []).filter((b) => !b.geometri).length;
  ut.push(geo ? { id: 'geo', nivaa: 'varsel', tekst: `${geo} bestand mangler kartflate – geolokasjon kan ikke leveres for dem.` } : { id: 'geo', nivaa: 'ok', tekst: 'Alle bestand har kartflate med koordinater (6 desimaler i eksporten).' });
  return ut;
}

// Status for hele eiendommen: kan tømmeret dokumenteres som avskogingsfritt og lovlig?
export function samsvar(S, iAar = new Date().getFullYear()) {
  const v = vurdering(S, iAar); const sj = S?.eudr?.sjekkliste || {};
  const manuelle = SJEKKLISTE.filter((x) => !x.auto); const bekreftet = manuelle.filter((x) => sj[x.id] === 'ja').length; const nei = manuelle.filter((x) => sj[x.id] === 'nei');
  const avvik = v.filter((x) => x.nivaa === 'avvik').length + nei.length;
  return { vurdering: v, bekreftet, manuelle: manuelle.length, nei, avvik, klar: !avvik && bekreftet === manuelle.length && v.every((x) => x.nivaa !== 'avvik') };
}

// Anslått årlig kvantum for den forenklede erklæringen: snitt av avvirkningen de neste ti årene etter planen, per
// treslag, i m³ og kg (rå vekt).
export function aarligKvantum(S, iAar = new Date().getFullYear()) {
  const inn = { ...STANDARD_INNSTILLINGER, ...(S?.innstillinger || {}) }; const per = { G: 0, F: 0, L: 0 };
  let kilde = 'planlagt avvirkning de neste ti årene';
  for (const t of ['G', 'F', 'L']) { const b = (S?.bestand || []).filter((x) => (x.treslag || 'G') === t); if (!b.length) continue; const { aarRader } = framskriv(b, 10, inn, { startAar: iAar }); per[t] = aarRader.reduce((s, r) => s + r.avvirkning, 0) / aarRader.length; }
  // Uten planlagt hogst: bærekraftig nivå (årlig tilvekst) som anslag.
  if (!Object.values(per).some((x) => x > 0.5)) { kilde = 'årlig tilvekst (ingen hogst er planlagt)'; for (const t of ['G', 'F', 'L']) { const b = (S?.bestand || []).filter((x) => (x.treslag || 'G') === t); if (b.length) per[t] = sammendrag(b, inn).tilvekst; } }
  const rader = Object.entries(per).filter(([, m3]) => m3 > 0.5).map(([t, m3]) => ({ treslag: t, navn: TRESLAG[t].navn, vitenskapelig: TRESLAG[t].vitenskapelig, m3: Math.round(m3), kg: Math.round((m3 * TRESLAG[t].kgPerM3) / 1000) * 1000 }));
  return { rader, m3: rader.reduce((s, r) => s + r.m3, 0), kg: rader.reduce((s, r) => s + r.kg, 0), avvik: 30, kilde };
}

// Innholdet i den forenklede engangserklæringen (forordningen vedlegg III), klart til å skrives ut eller føres inn.
export function forenkletErklaering(S, iAar = new Date().getFullYear()) {
  const v = S?.eudr?.virksomhet || {}; const k = aarligKvantum(S, iAar); const sortimenter = (S?.eudr?.sortimenter?.length ? S.eudr.sortimenter : ['4403']);
  return {
    navn: v.navn || S?.eiendom?.eier || '', adresse: v.adresse || '', eori: v.eori || '', land: 'Norge (NO)',
    varer: sortimenter.map((hs) => ({ hs, beskrivelse: SORTIMENT[hs]?.navn || hs, treslag: k.rader.map((r) => `${r.navn} (${r.vitenskapelig})`).join(', ') })),
    kvantum: k, geolokasjon: geojson(S), tekst: ERKLAERINGSTEKST,
    mangler: [!(v.navn || S?.eiendom?.eier) && 'navn', !v.adresse && 'adresse', !S?.eiendom?.grense && 'eiendomsgrense'].filter(Boolean),
  };
}

// Leveranser: hva som er solgt, til hvem, fra hvilke bestand, og erklærings- eller referansenummeret.
export const nyLeveranse = (nyId, data = {}) => ({ id: nyId ? nyId('eu') : `eu${Math.random().toString(36).slice(2, 9)}`, dato: new Date().toISOString().slice(0, 10), hs: '4403', treslag: 'G', m3: null, bestandIder: [], kjoper: { navn: '', adresse: '', epost: '' }, referanse: '', ...data });
// Forslag til leveranser fra utførte hogster som ikke er registrert ennå.
export function foreslaLeveranser(S) {
  const har = new Set((S?.eudr?.leveranser || []).flatMap((l) => (l.fraTiltak ? [l.fraTiltak] : [])));
  return hogster(S).filter((x) => x.utfort && x.aar > 2020 && !har.has(x.t.id)).map(({ b, t }) => ({ fraTiltak: t.id, dato: `${t.aar}-12-31`, hs: '4403', treslag: b.treslag || 'G', m3: t.volum ?? null, bestandIder: [b.id], tekst: `${t.type === 'tynning' ? 'Tynning' : 'Hogst'} i bestand ${b.nr} (${t.aar})` }));
}
// Informasjonen kjøperen trenger fra skogeieren for en leveranse (aktsomhet trinn 1).
export function leveranseInfo(S, l) {
  const b = (S?.bestand || []).filter((x) => l.bestandIder.includes(x.id)); const t = TRESLAG[l.treslag] || TRESLAG.G;
  return {
    produkt: `${SORTIMENT[l.hs]?.navn || l.hs} (HS ${l.hs})`, treslag: `${t.navn} – ${t.vitenskapelig}`, mengde: l.m3 ? `${l.m3} m³ (ca. ${Math.round((l.m3 * t.kgPerM3) / 100) * 100} kg)` : 'ikke oppgitt',
    land: 'Norge (lavrisikoland)', leverandor: { navn: S?.eudr?.virksomhet?.navn || S?.eiendom?.eier || '', adresse: S?.eudr?.virksomhet?.adresse || '', epost: S?.eudr?.virksomhet?.epost || '' }, kjoper: l.kjoper,
    steder: b.map((x) => `Bestand ${x.nr} (${Math.round((x.areal || 0) * 10) / 10} daa)`), geolokasjon: geojson(S, { bestandIder: l.bestandIder }), referanse: l.referanse || S?.eudr?.erklaeringsnummer || '',
  };
}
