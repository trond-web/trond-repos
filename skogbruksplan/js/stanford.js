// StanForD 2010 – standarden for datautveksling med skogsmaskiner (Skogforsk, urn:skogforsk:stanford2010).
// Et hogstoppdrag blir et filsett som hogstmaskin og lassbærer åpner, og produksjonsfilene fra maskinene leses
// tilbake og ajourfører oppdraget, bestandene og kartet. Ingen DOM – kan testes i Node.
//
// Til maskinene (instruksjon), etter skjemaene i StanForD 2010 versjon 3.3, 3.6 og 4.0:
//   .oin  ObjectInstruction            – hogstobjektet: oppdrag, skogeier, eiendom, PEFC, ett delobjekt per bestand,
//                                        tekst til fører (instruks og miljøhensyn) og hvilke sortimenter som skal apteres.
//   .ogi  ObjectGeographicalInstruction – kartlagene (Shapefile): bestandsgrenser, hensynsflater (nøkkelbiotoper,
//                                        kulturminner, myr …) med varselavstand, hensynspunkter, veier, bekker og stier,
//                                        velteplasser og et tomt lag for kjørespor som maskinen fyller ut.
//   .spi  SpeciesGroupInstruction      – treslagsgruppene gran, furu og lauv (kvaliteter, barkfunksjon).
//   .pin  ProductInstruction           – en enkel apteringsinstruks (sagtømmer og massevirke). Kjøpers egen pin brukes
//                                        når den finnes – oin peker bare på sortimentenes ID.
//   .foi  ForwardingObjectInstruction  – lassbærerobjektet med leveranser og velteplasser (koordinater).
//   .fdi  ForwardingDeliveryInstruction – leveransene (ett per sortiment) for lassbæreren.
//   .env  StanForD2010Envelope         – ogi med alle kartfilene innebygd (Base64), for maskiner som vil ha én fil.
// Fra maskinene (rapport):
//   .hpr  HarvestedProduction  – hver stamme med posisjon (kranspiss), treslag, stokker, sortiment og volum.
//   .thp  TotalHarvestedProduction – summer per objekt, treslag og sortiment (uten stammer).
//   .fpr  ForwardedProduction – lass og dellass per leveranse og velteplass.
//   .mom  OperationalMonitoring – driftstid og drivstoff.
//   .hqc  HarvestingQualityControl – kontrollmålte stammer.
//   .ogr  ObjectGeographicalReport – kartlag fra maskinen (kjørespor og nye eller endrede objekter).
//   Komprimerte filer (.hprz, .fprz …), ZIP og .env pakkes ut.
// Ajourføring: stammene fordeles på bestandene (delobjekt, ellers posisjon i bestandsflaten). Tiltakene merkes
// utført med virkelig volum, bestandene oppdateres (hogstklasse I etter flatehogst, redusert volum etter tynning) og
// hogd flate, stammepunkter og kjørespor lagres på oppdraget for kartet.
import { lagZip, lesZip, lagShapefile, lesShapefile, crc32, iGeometri, PRJ_WGS84 } from './maskindata.js';
import { geoTilUtm, utmTilGeo, arealM2 } from './proj.js';
import { linjer as oppdragLinjer, typeFor } from './oppdrag.js';

export const KILDER = {
  skogforsk: { navn: 'Skogforsk – StanForD 2010 (skjemaer og dokumentasjon)', url: 'https://www.skogforsk.se/english/projects/stanford/' },
  intro: { navn: 'StanForD 2010 – Introduction (Skogforsk 2020)', url: 'https://www.skogforsk.se/contentassets/1a68cdce4af1462ead048b7a5ef1cc06/stanford-2010-introduction-200820.pdf' },
  regler: { navn: 'StanForD 2010 – Naming and design rules', url: 'https://www.skogforsk.se/contentassets/1a68cdce4af1462ead048b7a5ef1cc06/stanford_2010_naming_and_design_rulesv1p7.pdf' },
};

export const NS = 'urn:skogforsk:stanford2010';
// Skjemaversjonene filsettet lages i (validert mot Skogforsks XSD-er). 3.3 leses av de fleste maskiner i drift.
// Produksjonsfiler leses i alle versjoner (også 4.0).
export const VERSJONER = {
  '3.6': { dato: '2020-02-07', navn: '3.6 (anbefalt)' },
  '3.3': { dato: '2017-02-06', navn: '3.3 (eldre maskiner)' },
};
export const STANDARD_VERSJON = '3.6';
// Koordinatsystem for kartlagene. Komatsu, John Deere og Ponsse leser alle WGS84 og UTM.
export const KOORDSYS = {
  'EPSG:4326': { navn: 'WGS84', sone: null },
  'EPSG:25832': { navn: 'UTM 32 (EUREF89)', sone: 32 },
  'EPSG:25833': { navn: 'UTM 33 (EUREF89)', sone: 33 },
};
const prjUtm = (s) => `PROJCS["ETRS_1989_UTM_Zone_${s}N",GEOGCS["GCS_ETRS_1989",DATUM["D_ETRS_1989",SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["False_Easting",500000.0],PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",${s * 6 - 183}.0],PARAMETER["Scale_Factor",0.9996],PARAMETER["Latitude_Of_Origin",0.0],UNIT["Meter",1.0]]`;

// Treslagsgruppene i spi (og fdi). Kvalitetene er de føreren velger på stammen.
export const TRESLAG = {
  G: { id: 'NO_GRAN', navn: 'Gran', bark: 'Skogforsk 2004, Norway spruce', arter: [['Gran', 'PIAB']] },
  F: { id: 'NO_FURU', navn: 'Furu', bark: 'Skogforsk 2004, Scots pine', arter: [['Furu', 'PISY']] },
  L: { id: 'NO_LAUV', navn: 'Lauv', bark: 'None', arter: [['Bjørk', 'BEPE'], ['Osp', 'POTR'], ['Selje', 'SACA'], ['Rogn', 'SOAU'], ['Gråor', 'ALIN']] },
};
const KVALITETER = [[1, 'Sagtømmer'], [2, 'Massevirke'], [3, 'Råte / energi']];
const lengder = (fra, til, steg) => { const ut = []; for (let l = fra; l <= til; l += steg) ut.push(l); return ut; };
// Standard sortimenter (vanlig norsk praksis). pris = relativ verdi i kr/m³ fub som styrer apteringen.
// Diameter i mm (topp under bark for tømmer, over bark for massevirke), lengde i cm.
export const PRODUKTER = [
  { id: 'NO_GRAN_SAG', navn: 'Gran sagtømmer', treslag: 'G', gruppe: 'Tømmer', stamme: '1', sortiment: 'sagtommer', minTopp: 130, maksRot: 800, underBark: true, diameter: lengder(130, 400, 20), lengde: lengder(370, 610, 30), maksLengde: 640, pris: 660, kvaliteter: [1] },
  { id: 'NO_GRAN_MASSE', navn: 'Gran massevirke', treslag: 'G', gruppe: 'Massevirke', stamme: '2', sortiment: 'massevirke', minTopp: 60, maksRot: 700, underBark: false, diameter: [60], lengde: lengder(300, 540, 60), maksLengde: 560, pris: 330, kvaliteter: [1, 2] },
  { id: 'NO_FURU_SAG', navn: 'Furu sagtømmer', treslag: 'F', gruppe: 'Tømmer', stamme: '1', sortiment: 'sagtommer', minTopp: 140, maksRot: 800, underBark: true, diameter: lengder(140, 400, 20), lengde: lengder(370, 610, 30), maksLengde: 640, pris: 620, kvaliteter: [1] },
  { id: 'NO_FURU_MASSE', navn: 'Furu massevirke', treslag: 'F', gruppe: 'Massevirke', stamme: '2', sortiment: 'massevirke', minTopp: 60, maksRot: 700, underBark: false, diameter: [60], lengde: lengder(300, 540, 60), maksLengde: 560, pris: 310, kvaliteter: [1, 2] },
  { id: 'NO_LAUV_MASSE', navn: 'Lauv massevirke', treslag: 'L', gruppe: 'Massevirke', stamme: '2', sortiment: 'massevirke', minTopp: 60, maksRot: 600, underBark: false, diameter: [60], lengde: lengder(300, 540, 60), maksLengde: 560, pris: 300, kvaliteter: [1, 2] },
  { id: 'NO_ENERGI', navn: 'Energivirke', treslag: 'L', gruppe: 'Energi', stamme: '2', sortiment: 'energi', minTopp: 40, maksRot: 600, underBark: false, diameter: [40], lengde: lengder(300, 540, 60), maksLengde: 560, pris: 150, kvaliteter: [1, 2, 3] },
];
export const SORTIMENT_NAVN = { sagtommer: 'Sagtømmer', massevirke: 'Massevirke', energi: 'Energivirke', annet: 'Annet' };
export const TRESLAG_NAVN = { G: 'Gran', F: 'Furu', L: 'Lauv' };

// Hensyn i kartet: PEFC-objekttyper → lag, varsel og varselavstand (m) i maskinen (Norsk PEFC Skogstandard).
const HENSYN = {
  noekkelbiotop: { navn: 'Nøkkelbiotop (MiS)', varsel: 'Nøkkelbiotop – ingen hogst eller kjøring', avstand: 10, farge: [194, 24, 122], pefc: 22 },
  bvo: { navn: 'Biologisk viktig område', varsel: 'BVO – hensyn etter plan', avstand: 10, farge: [224, 86, 122], pefc: 23 },
  vern: { navn: 'Verneområde', varsel: 'Verneområde – ikke drift', avstand: 10, farge: [139, 47, 201], pefc: 11 },
  naturtype: { navn: 'Viktig naturtype', varsel: 'Viktig naturtype – hensyn', avstand: 5, farge: [235, 104, 52], pefc: 22 },
  artsomrade: { navn: 'Funksjonsområde for art', varsel: 'Funksjonsområde for art – hensyn', avstand: 5, farge: [201, 133, 0], pefc: 22 },
  tiurleik: { navn: 'Tiurleik', varsel: 'Tiurleik – hensyn i spillperioden', avstand: 0, farge: [91, 75, 183], pefc: 25 },
  kulturminne: { navn: 'Kulturminne', varsel: 'Kulturminne – ikke kjør nærmere enn 5 m', avstand: 5, farge: [107, 91, 69], pefc: 30 },
  myr: { navn: 'Myr / sumpskog', varsel: 'Myr – ikke kjør, kantsone', avstand: 5, farge: [79, 143, 138], pefc: 28 },
  friluftsomrade: { navn: 'Friluftslivsområde', varsel: 'Friluftsliv – rydd stier', avstand: 0, farge: [47, 158, 98], pefc: 6 },
  utenlandsk: { navn: 'Utenlandske treslag', varsel: '', avstand: 0, farge: [156, 107, 0], pefc: 20 },
  brann: { navn: 'Brannflate', varsel: '', avstand: 0, farge: [181, 65, 14], pefc: 29 },
  rovfuglreir: { navn: 'Rovfugl-/uglereir', varsel: 'Rovfuglreir – hensynssone', avstand: 50, farge: [122, 62, 0], pefc: 24 },
  livslopstre: { navn: 'Livsløpstre', varsel: 'Livsløpstre – skal stå', avstand: 2, farge: [31, 107, 74], pefc: 13 },
  vann: { navn: 'Bekk / elv / vann', varsel: 'Vann – kantsone, ingen kjøring over uten bru', avstand: 10, farge: [42, 120, 214], pefc: 27 },
  sti: { navn: 'Sti / skiløype', varsel: 'Sti – ikke kjør langs, rydd etter drift', avstand: 2.5, farge: [160, 82, 45], pefc: 6 },
};

// ---------- små hjelpere ----------
const r = (v, d = 0) => { const f = 10 ** d; return Math.round(v * f) / f; };
// Linjeskift skrives som &#10; så innrykket i dokumentet ikke havner i teksten.
const esc = (s) => String(s ?? '').replace(/[&<>"'\n\r]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;', '\n': '&#10;', '\r': '' }[c]));
const filnavn = (t) => String(t || '').replace(/æ/gi, 'ae').replace(/ø/gi, 'o').replace(/å/gi, 'a').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'SkogIQ';
const fargeInt = ([rr, g, b]) => rr * 65536 + g * 256 + b;
const ringerAv = (g) => (g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []);
const bboxAv = (geoms) => { let a = Infinity; let b = Infinity; let c = -Infinity; let d = -Infinity; const pt = ([x, y]) => { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }; const gaa = (k) => (typeof k[0] === 'number' ? pt(k) : k.forEach(gaa)); for (const g of geoms) if (g?.coordinates) gaa(g.coordinates); return [a, b, c, d]; };
const utvid = ([a, b, c, d], m) => { const dy = m / 111320; const dx = m / (111320 * Math.cos((((b + d) / 2) * Math.PI) / 180)); return [a - dx, b - dy, c + dx, d + dy]; };
const iBbox = (g, [a, b, c, d]) => { const [x0, y0, x1, y1] = bboxAv([g]); return x0 <= c && x1 >= a && y0 <= d && y1 >= b; };
// Tidspunkt med tidssone (StanForD2010DateTimeType krever +hh:mm/-hh:mm, ikke Z).
export function tidspunkt(d = new Date()) {
  const p = (n) => String(Math.abs(n)).padStart(2, '0'); const o = -d.getTimezoneOffset();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${o >= 0 ? '+' : '-'}${p(Math.trunc(o / 60))}:${p(o % 60)}`;
}
// Liten XML-bygger: x('Navn', { attr }, ...barn) – barn er tekst (escapes), tall, null (utelates) eller annen x().
const RAA = Symbol('raa');
function x(navn, attr, ...barn) {
  const a = Object.entries(attr || {}).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
  const b = barn.flat(Infinity).filter((v) => v !== null && v !== undefined && v !== false);
  if (!b.length) return { [RAA]: `<${navn}${a}/>` };
  if (b.every((v) => typeof v !== 'object')) return { [RAA]: `<${navn}${a}>${b.map(esc).join('')}</${navn}>` };
  return { [RAA]: `<${navn}${a}>\n${b.map((v) => (typeof v === 'object' ? v[RAA] : esc(v)).replace(/^/gm, '\t')).join('\n')}\n</${navn}>` };
}
const dok = (rot) => `<?xml version="1.0" encoding="utf-8"?>\n${rot[RAA]}\n`;
const fritt = { modificationRestricted: 'false' };

// ---------- instruksjon: felles deler ----------
function hode(navn, ver, naa, app) {
  return x(navn, null,
    x('SenderApplication', null, app),
    x('CreationDate', null, naa), x('ModificationDate', null, naa),
    x('ApplicationVersionCreated', null, app), x('ApplicationVersionModified', null, app),
    x('CountryCode', ver === '3.3' ? null : { countryCodeCategory: 'ISO 3166' }, '578'));
}
const rotAttr = (type, ver) => ({ xmlns: NS, messageType: type, areaUnit: 'ha', diameterUnit: 'mm', lengthUnit: 'cm', volumeUnit: 'm3', weightUnit: 'kg', version: ver, versionDate: VERSJONER[ver].dato });
const kontakt = (navn, k = {}) => x(navn, null, k.fornavn ? x('FirstName', null, k.fornavn) : null, k.etternavn ? x('LastName', null, k.etternavn) : null, k.telefon ? x('Phone', null, k.telefon) : null, k.epost ? x('Email', null, k.epost) : null, k.firma ? x('BusinessName', null, k.firma) : null, k.orgnr ? x('BusinessID', null, k.orgnr) : null);
const splittNavn = (navn) => { const d = String(navn || '').trim().split(/\s+/); return d.length > 1 ? { fornavn: d.slice(0, -1).join(' '), etternavn: d.at(-1) } : { fornavn: d[0] || '' }; };
const LOGGINGFORM = { sluttavvirkning: ['1', 'Sluttavvirkning'], tynning: ['2', 'Tynning'], lukkethogst: ['3', 'Lukket hogst'] };
function hogstform(o) { const [kode, navn] = LOGGINGFORM[o.type] || ['9', typeFor(o.type).kort]; return x('LoggingForm', { agency: 'ForestOwner' }, x('LoggingFormCode', null, kode), x('LoggingFormDescription', null, o.type === 'lukkethogst' && o.felt?.hogstform ? `${navn} – ${o.felt.hogstform}` : navn)); }

// Objektdefinisjonen som oin, ogi og foi deler. ekstra = elementer etter delobjektene (ProductUserID, GeographicDirective …).
function objektdef(S, ctx, { ekstra = [], delobjekter = true } = {}) {
  const { o, ver, naa, ls } = ctx;
  const ha = ls.reduce((s, l) => s + (l.tiltak.arealDaa ?? l.bestand.areal ?? 0), 0) / 10;
  const eier = S.eiendom || {};
  return x('ObjectDefinition', null,
    x('ObjectUserID', { agency: 'ForestOwner' }, ctx.objektId),
    x('ObjectName', null, `${o.nr} ${eier.navn || ''} – ${typeFor(o.type).kort}`.trim()),
    x('ObjectModificationDate', null, naa),
    x('ForestCertification', null, ctx.sertifisering),
    hogstform(o),
    ha > 0 ? x('ObjectArea', null, r(ha, 2)) : null,
    o.utforer?.navn ? x('LoggingOrganisation', null, kontakt('ContactInformation', { firma: o.utforer.navn, ...splittNavn(o.utforer.kontakt), telefon: o.utforer.telefon, epost: o.utforer.epost })) : null,
    eier.eier ? kontakt('ForestOwner', { ...splittNavn(eier.eier) }) : null,
    x('ContractNumber', null, o.nr),
    eier.gnrbnr || eier.kommunenr ? x('RealEstateIDObject', { agency: 'ForestOwner' }, [eier.kommunenr, eier.gnrbnr].filter(Boolean).join('-')) : null,
    ctx.tekst ? x('TextToMachine', null, ctx.tekst) : null,
    delobjekter ? ls.map((l) => x('SubObject', null,
      x('SubObjectUserID', { agency: 'ForestOwner' }, l.bestand.id),
      x('SubObjectName', null, `Bestand ${l.bestand.nr}`),
      (l.tiltak.arealDaa ?? l.bestand.areal) > 0 ? x('SubObjectArea', null, r((l.tiltak.arealDaa ?? l.bestand.areal) / 10, 3)) : null,
      hogstform({ ...o, type: l.tiltak.type }))) : null,
    ekstra);
}

// Hvilke sortimenter oppdraget skal aptere: treslagene som finnes i bestandene, eller alle.
export function produkterFor(S, o) {
  const ls = oppdragLinjer(S, o); const tre = new Set(ls.map((l) => l.bestand.treslag || 'G'));
  const ut = PRODUKTER.filter((p) => p.sortiment !== 'energi' && (tre.has(p.treslag) || (p.treslag !== 'L' && tre.size === 0)));
  // Blandingsskog: alltid massevirke for alle treslag.
  for (const p of PRODUKTER) if (p.sortiment === 'massevirke' && !ut.includes(p)) ut.push(p);
  return ut.sort((a, b) => PRODUKTER.indexOf(a) - PRODUKTER.indexOf(b));
}

// Teksten føreren ser (TextToMachine): oppdrag, instruks og miljøhensyn.
export function tekstTilMaskin(S, o, hensyn = []) {
  const ot = typeFor(o.type); const f = o.felt || {};
  const linjer = [
    `${o.nr} ${ot.navn}${S.eiendom?.navn ? ` – ${S.eiendom.navn}` : ''}`,
    o.periode?.fra || o.periode?.til ? `Periode: ${o.periode.fra || '?'} – ${o.periode.til || '?'}` : null,
    f.kjoper ? `Tømmerkjøper: ${f.kjoper}` : null,
    f.sortiment ? `Sortiment: ${f.sortiment}` : null,
    f.velteplass ? `Velteplass: ${f.velteplass}` : null,
    f.uttak ? `Uttak: ${f.uttak} % av volumet` : null,
    f.gjenstaende ? `Treantall etter tynning: ${f.gjenstaende} per daa` : null,
    f.hogstform ? `Hogstform: ${f.hogstform}` : null,
    f.gjensetting ? `Gjensettingstrær: ${f.gjensetting} per daa` : null,
    o.merknad ? `Instruks: ${o.merknad}` : null,
    hensyn.length ? `Hensyn i kartet: ${Object.entries(hensyn.reduce((a, h) => { const n = HENSYN[h.type]?.navn || 'Miljøfigur'; a[n] = [...(a[n] || []), h.navn]; return a; }, {})).map(([n, l]) => `${n} (${l.length}: ${l.slice(0, 3).join(', ')})`).join('; ')}.` : null,
    'Livsløpstrær (minst 10 per ha) settes igjen. Kantsoner mot vann og myr beholdes. Kjøreskader unngås (PEFC 13, 14, 27).',
    o.utforer?.kontakt || S.eiendom?.eier ? `Kontakt skogeier: ${S.eiendom?.eier || ''}` : null,
  ].filter(Boolean);
  return linjer.join('\n').slice(0, 2000);
}

// ---------- kartlag (Shapefile) ----------
// Samler objektene som skal med i ogi: bestandene i oppdraget, hensyn, veier og velteplasser nær bestandene.
export function kartobjekter(S, o) {
  const ls = oppdragLinjer(S, o).filter((l) => l.bestand.geometri);
  const bb = ls.length ? bboxAv(ls.map((l) => l.bestand.geometri)) : null;
  const naer = bb ? utvid(bb, 150) : null; const vid = bb ? utvid(bb, 1500) : null;
  const bestand = ls.map((l) => ({ geometri: l.bestand.geometri, id: l.bestand.id, nr: l.bestand.nr, tiltak: l.tiltak.type, miljo: !!l.bestand.miljo, treslag: l.bestand.treslag || '', daa: l.bestand.areal || 0 }));
  const hensynFlate = []; const hensynPunkt = []; const linjer = [];
  for (const ob of S.pefc?.objekter || []) {
    const h = HENSYN[ob.type]; if (!h || !ob.geometri || !naer || !iBbox(ob.geometri, naer)) continue;
    const rad = { geometri: ob.geometri, id: ob.id, type: ob.type, navn: ob.navn || h.navn, varsel: h.varsel, avstand: h.avstand };
    if (/Polygon/.test(ob.geometri.type)) hensynFlate.push(rad);
    else if (ob.geometri.type === 'Point') hensynPunkt.push(rad);
    else if (/LineString/.test(ob.geometri.type)) linjer.push({ ...rad, klasse: ob.type });
  }
  for (const b of S.bestand) if (b.miljo && b.geometri && naer && iBbox(b.geometri, naer)) hensynFlate.push({ geometri: b.geometri, id: `m${b.id}`, type: 'miljofigur', navn: `Miljøfigur bestand ${b.nr}`, varsel: 'Miljøfigur – hensyn etter planen', avstand: 5 });
  const vr = S.veier || {};
  for (const v of vr.veier || []) if (v.geometri && vid && iBbox(v.geometri, vid)) linjer.push({ geometri: v.geometri, id: v.id, type: v.klasse >= 7 ? 'traktorvei' : 'bilvei', navn: v.navn || (v.klasse >= 7 ? 'Traktorvei' : 'Skogsbilvei'), varsel: '', avstand: 0, klasse: v.klasse >= 7 ? 'traktorvei' : 'bilvei' });
  for (const s of vr.stier || []) if (s.geometri && naer && iBbox(s.geometri, naer)) linjer.push({ geometri: s.geometri, id: s.id, type: 'sti', navn: s.navn || 'Sti', varsel: HENSYN.sti.varsel, avstand: HENSYN.sti.avstand, klasse: 'sti' });
  const velteplasser = (vr.punkter || []).filter((p) => p.type === 'velteplass' && p.geometri?.type === 'Point' && vid && iBbox(p.geometri, vid)).map((p, i) => ({ geometri: p.geometri, id: p.id || `v${i + 1}`, navn: p.navn || `Velteplass ${i + 1}` }));
  // MultiLineString deles i enkeltlinjer (Shapefile-laget skriver én linje per objekt).
  const enkle = linjer.flatMap((l) => (l.geometri.type === 'MultiLineString' ? l.geometri.coordinates.map((c, i) => ({ ...l, id: `${l.id}-${i}`, geometri: { type: 'LineString', coordinates: c } })) : [l]));
  return { bestand, hensynFlate, hensynPunkt, linjer: enkle, velteplasser };
}

// Feltene i dbf-filene. Navnene står i GISDatabaseFileSpecification i ogi.
const DBF = [
  { navn: 'OBJEKT', type: 'C', lengde: 20 }, { navn: 'DELOBJEKT', type: 'C', lengde: 20 }, { navn: 'TYPE', type: 'C', lengde: 16 },
  { navn: 'ID', type: 'C', lengde: 24 }, { navn: 'BESKR', type: 'C', lengde: 80 }, { navn: 'BEHANDLING', type: 'C', lengde: 20 },
  { navn: 'MERKET', type: 'N', lengde: 1 }, { navn: 'VARSEL', type: 'C', lengde: 80 }, { navn: 'VARSELAVST', type: 'N', lengde: 5, des: 1 }, { navn: 'FORMAT', type: 'C', lengde: 16 },
];
const DBF_SPEK = x('GISDatabaseFileSpecification', null, x('ColumnNameObject', null, 'OBJEKT'), x('ColumnNameSubObject', null, 'DELOBJEKT'), x('ColumnNameFeature', null, 'TYPE'), x('ColumnNameID', null, 'ID'), x('ColumnNameDescription', null, 'BESKR'), x('ColumnNameTreatment', null, 'BEHANDLING'), x('ColumnNameMarked', null, 'MERKET'), x('ColumnNameWarning', null, 'VARSEL'), x('ColumnNameWarningDistance', null, 'VARSELAVST'), x('ColumnNameFormatID', null, 'FORMAT'));
const tilKoord = (g, sone) => {
  if (!sone) return g;
  const p = ([a, b]) => geoTilUtm(a, b, sone).map((v) => r(v, 2)); const gaa = (k) => (typeof k[0] === 'number' ? p(k) : k.map(gaa));
  return { ...g, coordinates: gaa(g.coordinates) };
};

// Lager lagene: [{ fil, navn, type, objekter, format: [{ id, navn, farge, … }], redigerbar, spor }]
function kartlag(S, o, ctx) {
  const k = kartobjekter(S, o); const obj = ctx.objektId;
  const rad = (e) => ({ OBJEKT: obj, DELOBJEKT: '', VARSEL: '', VARSELAVST: 0, MERKET: 0, BEHANDLING: '', ...e });
  const lag = [];
  lag.push({ fil: 'bestand', navn: 'Bestand i oppdraget', type: 'polygon', redigerbar: false,
    objekter: k.bestand.map((b) => ({ geometri: b.geometri, egenskaper: rad({ DELOBJEKT: b.id, TYPE: 'bestand', ID: b.id, BESKR: `Bestand ${b.nr} ${b.treslag} ${r(b.daa, 1)} daa${b.miljo ? ' – miljøfigur' : ''}`, BEHANDLING: b.tiltak, FORMAT: b.miljo ? 'BESTAND_MILJO' : 'BESTAND' }) })),
    format: [{ id: 'BESTAND', navn: 'Bestand', farge: [243, 156, 74], strek: 'Solid', bredde: 2, fyll: 'TransparentFill', standard: true }, { id: 'BESTAND_MILJO', navn: 'Bestand med miljøfigur', farge: [194, 24, 122], strek: 'Dash', bredde: 2, fyll: 'TransparentFill' }] });
  if (k.hensynFlate.length) lag.push({ fil: 'hensyn', navn: 'Hensyn – flater', type: 'polygon', redigerbar: true,
    objekter: k.hensynFlate.map((h) => ({ geometri: h.geometri, egenskaper: rad({ TYPE: h.type, ID: h.id, BESKR: h.navn, VARSEL: h.varsel, VARSELAVST: h.avstand, MERKET: 1, FORMAT: h.type.toUpperCase().slice(0, 16) }) })),
    format: [...new Set(k.hensynFlate.map((h) => h.type))].map((t, i) => ({ id: t.toUpperCase().slice(0, 16), navn: HENSYN[t]?.navn || 'Miljøfigur', farge: HENSYN[t]?.farge || [194, 24, 122], strek: 'Solid', bredde: 2, fyll: 'DiagonalCrossFill', standard: i === 0 })) });
  if (k.hensynPunkt.length) lag.push({ fil: 'hensynpkt', navn: 'Hensyn – punkter', type: 'punkt', redigerbar: true,
    objekter: k.hensynPunkt.map((h) => ({ geometri: h.geometri, egenskaper: rad({ TYPE: h.type, ID: h.id, BESKR: h.navn, VARSEL: h.varsel, VARSELAVST: h.avstand, MERKET: 1, FORMAT: h.type.toUpperCase().slice(0, 16) }) })),
    format: [...new Set(k.hensynPunkt.map((h) => h.type))].map((t, i) => ({ id: t.toUpperCase().slice(0, 16), navn: HENSYN[t]?.navn || t, farge: HENSYN[t]?.farge || [31, 107, 74], symbol: t === 'livslopstre' ? 84 : 33, standard: i === 0 })) });
  if (k.linjer.length) {
    const st = { bilvei: { navn: 'Skogsbilvei', farge: [85, 85, 85], strek: 'Solid', bredde: 3 }, traktorvei: { navn: 'Traktorvei', farge: [138, 90, 43], strek: 'Dash', bredde: 2 }, sti: { navn: 'Sti / løype', farge: [184, 64, 46], strek: 'Dot', bredde: 2 }, vann: { navn: 'Bekk / vann', farge: [42, 120, 214], strek: 'Solid', bredde: 2 } };
    lag.push({ fil: 'linjer', navn: 'Veier, stier og bekker', type: 'linje', redigerbar: false,
      objekter: k.linjer.map((l) => ({ geometri: l.geometri, egenskaper: rad({ TYPE: l.type, ID: l.id, BESKR: l.navn, VARSEL: l.varsel, VARSELAVST: l.avstand, MERKET: l.varsel ? 1 : 0, FORMAT: (st[l.klasse] ? l.klasse : 'vann').toUpperCase() }) })),
      format: [...new Set(k.linjer.map((l) => (st[l.klasse] ? l.klasse : 'vann')))].map((t, i) => ({ id: t.toUpperCase(), ...st[t], standard: i === 0 })) });
  }
  if (k.velteplasser.length) lag.push({ fil: 'velteplass', navn: 'Velteplasser', type: 'punkt', redigerbar: true,
    objekter: k.velteplasser.map((v) => ({ geometri: v.geometri, egenskaper: rad({ TYPE: 'velteplass', ID: v.id, BESKR: v.navn, FORMAT: 'VELTEPLASS' }) })),
    format: [{ id: 'VELTEPLASS', navn: 'Velteplass', farge: [42, 120, 214], symbol: 86, standard: true }] });
  // Tomt lag som maskinen fyller med kjøresporet (TrackingFile).
  lag.push({ fil: 'spor', navn: 'Kjørespor (fra maskinen)', type: 'linje', redigerbar: true, spor: true, objekter: [], format: [{ id: 'SPOR', navn: 'Kjørespor', farge: [208, 59, 59], strek: 'Solid', bredde: 2, standard: true }] });
  return { lag, k };
}

function formatXml(f, type) {
  const felles = [x('FormatID', null, f.id), x('FormatName', null, f.navn), x('FormatDefaultClass', null, f.standard ? 'true' : 'false'), x('FormatColor', null, fargeInt(f.farge))];
  if (type === 'punkt') return x('GISFileFormatPoint', null, felles, x('FormatFont', null, x('FormatFontFileName', null, 'wingding.ttf'), x('FormatFontName', null, 'Wingdings'), x('FormatSymbolNumber', null, f.symbol || 108), x('FormatSymbolSize', null, 14)));
  if (type === 'linje') return x('GISFileFormatLine', null, felles, x('FormatLineStyle', null, f.strek || 'Solid'), x('FormatLineThickness', null, f.bredde || 2));
  return x('GISFileFormatPolygon', null, felles, x('FormatLineStyle', null, f.strek || 'Solid'), x('FormatLineThickness', null, f.bredde || 2), x('FormatFillStyle', null, f.fyll || 'TransparentFill'));
}

// ---------- meldingene ----------
function oin(S, ctx, produkter) {
  return dok(x('ObjectInstruction', rotAttr('oin', ctx.ver), hode('ObjectInstructionHeader', ctx.ver, ctx.naa, ctx.app),
    objektdef(S, ctx, { ekstra: produkter.map((p) => x('ProductUserID', { agency: 'ForestOwner' }, p.id)) })));
}
function ogi(S, ctx, lag) {
  const nyere = ctx.ver !== '3.3';
  const gis = lag.map((l, i) => x('GISLayer', { modificationRestricted: l.redigerbar ? 'false' : 'true' },
    x('GISFileName', null, `${l.filnavn}.shp`),
    nyere ? x('GISLayerUserID', null, l.fil) : null,
    x('GISFileOrder', null, i + 1),
    x('ComplementaryGISFiles', null, ['shx', 'dbf', 'prj'].map((e) => x('ComplementaryGISFilename', null, `${l.filnavn}.${e}`))),
    l.spor ? x('TrackingFile', null, 'true') : null,
    x('GISFileLayerDescription', null, l.navn),
    x('GISFileMAXScale', null, 100000), x('GISFileMINScale', null, 0),
    DBF_SPEK,
    l.format.map((f) => formatXml(f, l.type))));
  const dir = x('GeographicDirective', null,
    x('TrackingCategory', null, 'Lines tracking'),
    x('GISCoordinateReferenceSystem', null, ctx.koordsys),
    gis);
  return dok(x('ObjectGeographicalInstruction', rotAttr('ogi', ctx.ver), hode('ObjectGeographicalInstructionHeader', ctx.ver, ctx.naa, ctx.app), objektdef(S, ctx, { ekstra: [dir] })));
}
function treslagsgruppe(t, naa, i, { detaljer = true, arter = true } = {}) {
  const d = TRESLAG[t];
  const felles = [
    x('SpeciesGroupModificationDate', null, naa), x('SpeciesGroupUserID', { agency: 'ForestOwner' }, d.id), x('SpeciesGroupName', null, d.navn),
    x('SpeciesGroupInfo', fritt, d.navn), x('SpeciesGroupVersion', fritt, naa.slice(0, 10)),
    x('StemTypeDefinition', null, x('StemTypeCode', null, '1'), x('StemTypeName', null, 'Tømmer')),
    x('StemTypeDefinition', null, x('StemTypeCode', null, '2'), x('StemTypeName', null, 'Massevirke')),
    x('SpeciesGroupPresentationOrder', null, i + 1)];
  if (!detaljer) return felles;
  const bark = x('BarkFunction', { barkFunctionCategory: d.bark, modificationRestricted: 'false' }, t === 'F' ? x('Skogforsk2004ScotsPine', null, x('Latitude', null, '61')) : null);
  return [...felles,
    x('DBHHeight', { modificationRestricted: 'true' }, 130),
    x('Grades', fritt, x('StartGrade', null, 1), KVALITETER.map(([n, navn]) => x('Grade', null, x('GradeNumber', null, n), x('GradeName', null, navn)))),
    bark,
    arter && d.arter.map(([navn, kode]) => x('SpeciesDefinition', null, x('SpeciesName', null, navn), x('SpeciesUserID', null, kode)))];
}
function spi(ctx, treslag) {
  return dok(x('SpeciesGroupInstruction', rotAttr('spi', ctx.ver), hode('SpeciesGroupInstructionHeader', ctx.ver, ctx.naa, ctx.app),
    treslag.map((t, i) => x('SpeciesGroupDefinition', null, treslagsgruppe(t, ctx.naa, i)))));
}
function produktFelles(p, naa, i, ctx) {
  return [x('ProductName', null, p.navn), x('ModificationDate', null, naa), x('ProductInfo', fritt, p.navn), x('ProductVersion', fritt, naa.slice(0, 10)),
    ctx.kjoper ? kontakt('ProductBuyer', { firma: ctx.kjoper }) : null,
    x('ProductGroupName', null, p.gruppe), x('StemTypeCode', null, p.stamme), x('ProductPresentationOrder', null, i + 1),
    x('ProductDescription', null, `${p.navn}: topp min ${p.minTopp / 10} cm ${p.underBark ? 'under' : 'over'} bark, ${p.lengde[0] / 100}–${p.lengde.at(-1) / 100} m. Standard fra SkogIQ – bruk kjøpers apteringsinstruks når den finnes.`)];
}
// Apteringsdetaljene for et sortiment (diameter, lengde, pris, kvaliteter og prismatrise).
function produktDetaljer(p, pris) {
  return [
      x('DiameterDefinition', fritt,
        x('DiameterClasses', { diameterClassCategory: 'Top' }, p.diameter.map((d) => x('DiameterClass', null, x('DiameterClassLowerLimit', null, d))), x('DiameterClassMAX', null, p.maksRot), x('DiameterClassAdjustment', null, 'DiameterClassAdjustment1'), x('DiameterUnderBark', null, p.underBark ? 'true' : 'false')),
        x('DiameterMINTop', null, p.minTopp), x('DiameterMAXButt', null, p.maksRot), x('DiameterTopPosition', null, 0)),
      x('LengthDefinition', fritt, x('LengthClassAdjustment', null, 'LengthClassAdjustment1'), p.lengde.map((l) => x('LengthClass', null, x('LengthClassLowerLimit', null, l), x('LengthClassMargin', null, 10))), x('LengthClassMAX', null, p.maksLengde)),
      x('PriceDefinition', fritt, x('VolumeDiameterAdjustment', null, 'Measured diameter in mm'), x('VolumeDiameterCategory', null, 'Calculated Norwegian mid'), x('VolumeLengthCategory', null, 'Length as defined in LengthClasses'), x('VolumeUnderBark', null, 'true')),
      x('ManualFreeBuck', null, 'true'), x('TopLogFreeBuck', null, 'false'), x('ProductCondition', null, 'Buck always'),
      x('PermittedGradesDefinition', fritt, p.kvaliteter.map((k) => x('PermittedGradeNumber', null, k))),
      x('LengthDistributionDefinition', fritt, x('DistributionAllowed', null, 'false'), x('DistributionCategory', null, 'Volume of logs'), x('MAXDeviation', null, 0), x('DistributionWithinProduct', null, 'false')),
      x('LimitationDefinition', fritt, x('LimitationCategory', null, 'No limitation'), x('LimitationResult', null, 'No action')),
      x('ProductMatrixes', { modificationRestrictedPrice: 'false', modificationRestrictedDistribution: 'false', modificationRestrictedLimitation: 'false', modificationRestrictedBuckingCriteria: 'false', modificationRestrictedLogColorMarking: 'false' },
        p.diameter.flatMap((d, di) => p.lengde.map((l) => x('ProductMatrixItem', { diameterClassLowerLimit: d, lengthClassLowerLimit: l }, x('Price', null, Math.round(pris * (1 + 0.01 * di) * (p.sortiment === 'sagtommer' && l < 400 ? 0.96 : 1))), x('Distribution', null, 0), x('Limitation', null, 0)))))];
}
function pin(ctx, produkter, prisFaktor) {
  const def = (p, i) => x('ProductDefinition', null, x('ProductUserID', { agency: 'ForestOwner' }, p.id), x('ClassifiedProductDefinition', null,
    produktFelles(p, ctx.naa, i, ctx), produktDetaljer(p, Math.max(1, Math.round(p.pris * (prisFaktor[p.treslag] ?? 1)))),
    x('SpeciesGroupUserID', { agency: 'ForestOwner' }, TRESLAG[p.treslag].id)));
  return dok(x('ProductInstruction', rotAttr('pin', ctx.ver), hode('ProductInstructionHeader', ctx.ver, ctx.naa, ctx.app), produkter.map(def)));
}
const leveranseId = (p) => `LEV_${p.id.replace(/^NO_/, '')}`;
function foi(S, ctx, produkter, velteplasser) {
  const lok = velteplasser.map((v) => x('LocationDefinition', null,
    x('LocationUserID', { agency: 'ForestOwner' }, v.id), x('LocationName', null, v.navn),
    x('LocationCoordinates', { receiverPosition: 'Base machine position', coordinateReferenceSystem: 'WGS84' }, x('Latitude', { latitudeCategory: 'North' }, r(v.geometri.coordinates[1], 7)), x('Longitude', { longitudeCategory: 'East' }, r(v.geometri.coordinates[0], 7)), x('Altitude', null, 0)),
    x('LocationDescription', null, v.navn), x('ModificationDate', null, ctx.naa)));
  return dok(x('ForwardingObjectInstruction', rotAttr('foi', ctx.ver), hode('ForwardingObjectInstructionHeader', ctx.ver, ctx.naa, ctx.app),
    objektdef(S, ctx, { ekstra: [produkter.map((p) => x('DeliveryUserID', { agency: 'ForestOwner' }, leveranseId(p))), velteplasser.map((v) => x('LocationUserID', { agency: 'ForestOwner' }, v.id))] }), lok));
}
function fdi(ctx, produkter, treslag) {
  return dok(x('ForwardingDeliveryInstruction', rotAttr('fdi', ctx.ver), hode('ForwardingDeliveryInstructionHeader', ctx.ver, ctx.naa, ctx.app),
    treslag.map((t, i) => x('SpeciesGroupDefinition', null, treslagsgruppe(t, ctx.naa, i, { detaljer: false }))),
    produkter.map((p, i) => x('ProductDefinition', null, x('ProductUserID', { agency: 'ForestOwner' }, p.id), x('ClassifiedProductDefinition', null, produktFelles(p, ctx.naa, i, ctx), x('SpeciesGroupUserID', { agency: 'ForestOwner' }, TRESLAG[p.treslag].id)))),
    produkter.map((p, i) => x('DeliveryDefinition', null, x('DeliveryUserID', { agency: 'ForestOwner' }, leveranseId(p)), x('DeliveryName', null, p.navn), x('ModificationDate', null, ctx.naa), ctx.kjoper ? x('DeliveryDestination', null, ctx.kjoper) : null, x('DeliveryPresentationOrder', null, i + 1), x('DeliveryDescription', null, `${p.navn} til ${ctx.kjoper || 'kjøper'}`), x('ProductUserID', { agency: 'ForestOwner' }, p.id)))));
}
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return typeof btoa === 'function' ? btoa(s) : Buffer.from(u8).toString('base64'); };
function konvolutt(ctx, ogiXml, vedlegg, avsender) {
  return dok(x('StanForD2010Envelope', { xmlns: NS, messageType: 'env', version: ctx.ver, versionDate: VERSJONER[ctx.ver].dato },
    x('StanForD2010EnvelopeHeader', null,
      x('TransmissionInfo', null, x('TransmissionID', { agency: 'ForestOwner' }, `${ctx.objektId}-${Date.parse(ctx.naa) || 0}`), x('TransmissionTime', null, ctx.naa), x('TransmissionSender', null, ctx.app)),
      kontakt('BusinessSender', { firma: avsender || 'SkogIQ.ai' })),
    x('StanForD2010Message', { messageCategory: 'ogi' },
      x('MessageDocument', null, x('EmbeddedDocument', { encodingMethod: 'None' }, ogiXml.replace(/^<\?xml[^>]*>\s*/, '')), x('DocumentName', null, `${ctx.base}.ogi`)),
      vedlegg.map((v) => x('MessageAttachment', null, x('EmbeddedAttachment', { encodingMethod: 'Base64' }, b64(v.data)), x('AttachmentName', null, v.navn))))));
}

// ---------- eksport: filsettet for et oppdrag ----------
// valg: { versjon, koordsys, apteringsinstruks (spi+pin), lassbaerer (foi+fdi), konvolutt (env), naa, app }
export function lagFilsett(S, o, valg = {}) {
  const ver = VERSJONER[valg.versjon] ? valg.versjon : STANDARD_VERSJON;
  const koordsys = KOORDSYS[valg.koordsys] ? valg.koordsys : 'EPSG:4326';
  const naa = tidspunkt(valg.naa || new Date()); const app = valg.app || 'SkogIQ.ai';
  const ls = oppdragLinjer(S, o);
  if (!ls.length) throw new Error('Oppdraget har ingen bestand.');
  if (!ls.some((l) => l.bestand.geometri)) throw new Error('Bestandene i oppdraget mangler kartflater.');
  const objektId = o.stanford?.objektId || `SkogIQ-${o.nr}`;
  const base = filnavn(`${o.nr}_${S.eiendom?.navn || 'skog'}`);
  const ctx = { o, ver, naa, app, ls, objektId, base, koordsys, kjoper: o.felt?.kjoper || '', sertifisering: valg.sertifisering || (S.pefc ? 'PEFC' : 'Not known') };
  const { lag, k } = kartlag(S, o, ctx);
  ctx.tekst = tekstTilMaskin(S, o, [...k.hensynFlate, ...k.hensynPunkt, ...k.linjer.filter((l) => l.varsel)]);
  const produkter = produkterFor(S, o);
  const treslag = [...new Set(produkter.map((p) => p.treslag))];
  const inn = S.innstillinger?.pris || {};
  const prisFaktor = Object.fromEntries(['G', 'F', 'L'].map((t) => [t, inn[t] ? inn[t] / ({ G: 620, F: 570, L: 430 }[t]) : 1]));
  const sone = KOORDSYS[koordsys].sone; const prj = sone ? prjUtm(sone) : PRJ_WGS84;
  const filer = []; const kartfiler = [];
  for (const l of lag) {
    l.filnavn = `${base}_${l.fil}`;
    const sf = lagShapefile(l.objekter.map((ob) => ({ ...ob, geometri: tilKoord(ob.geometri, sone) })), DBF, l.type);
    for (const [e, data] of [['shp', sf.shp], ['shx', sf.shx], ['dbf', sf.dbf], ['prj', prj]]) kartfiler.push({ navn: `${l.filnavn}.${e}`, data: typeof data === 'string' ? new TextEncoder().encode(data) : data });
  }
  const ogiXml = ogi(S, ctx, lag);
  filer.push({ navn: `${base}.oin`, data: oin(S, ctx, produkter) });
  filer.push({ navn: `${base}.ogi`, data: ogiXml });
  filer.push(...kartfiler);
  if (valg.apteringsinstruks !== false) { filer.push({ navn: `${base}.spi`, data: spi(ctx, treslag) }); filer.push({ navn: `${base}.pin`, data: pin(ctx, produkter, prisFaktor) }); }
  if (valg.lassbaerer !== false) { filer.push({ navn: `${base}.foi`, data: foi(S, ctx, produkter, k.velteplasser) }); filer.push({ navn: `${base}.fdi`, data: fdi(ctx, produkter, treslag) }); }
  if (valg.konvolutt !== false) filer.push({ navn: `${base}_kart.env`, data: konvolutt(ctx, ogiXml, kartfiler, S.eiendom?.eier) });
  filer.push({ navn: 'LES_MEG.txt', data: lesMeg(S, o, ctx, { lag, produkter, k, filer }) });
  const oversikt = { objektId, versjon: ver, koordsys, filer: filer.map((f) => f.navn), lag: lag.map((l) => ({ navn: l.navn, antall: l.objekter.length })), produkter: produkter.map((p) => p.navn), velteplasser: k.velteplasser.length, hensyn: k.hensynFlate.length + k.hensynPunkt.length, bestand: ls.length };
  return { filer, zipnavn: `${base}_StanForD2010.zip`, oversikt, mappe: base };
}

function lesMeg(S, o, ctx, { lag, produkter, k }) {
  return `StanForD 2010 – ${o.nr} ${typeFor(o.type).navn}
${S.eiendom?.navn || ''}
Laget ${ctx.naa.slice(0, 16).replace('T', ' ')} med ${ctx.app}. Skjemaversjon ${ctx.ver}. Kartlag i ${KOORDSYS[ctx.koordsys].navn}.

Objekt-ID: ${ctx.objektId}  (bestandene er delobjekter med bestandets ID)

Filer
  ${ctx.base}.oin   Objektinstruks – oppdraget, skogeier, ${ctx.ls.length} bestand og sortimentene
  ${ctx.base}.ogi   Kartinstruks – ${lag.length} kartlag (Shapefile)
${lag.map((l) => `     ${l.filnavn}.shp  ${l.navn} (${l.objekter.length})`).join('\n')}
  ${ctx.base}.spi   Treslagsgrupper (gran, furu, lauv)
  ${ctx.base}.pin   Apteringsinstruks: ${produkter.map((p) => p.navn).join(', ')}
  ${ctx.base}.foi   Lassbærerinstruks – ${k.velteplasser.length} velteplass(er)
  ${ctx.base}.fdi   Leveranser for lassbæreren
  ${ctx.base}_kart.env  Kartinstruksen med alle kartfilene i én fil (StanForD 2010-konvolutt)

Slik legges filene inn
  Kopier mappen til en minnepinne. På hogstmaskinen:
  • Komatsu MaxiXT / MaxiXplorer: Produksjon → Objekt → Importer (oin/pin/spi), Kart → Importer (ogi eller env).
  • John Deere TimberMatic H-16/H-09 og TimberNavi: Objekter → Importer fra USB (oin, spi, pin, ogi).
  • Ponsse Opti 4G/8 og Opti Map: Objekt → Ny fra fil, Kart → Importer.
  • Lassbærer: foi og fdi (Komatsu MaxiXT, TimberMatic F, Opti Forwarder).
  Bruk tømmerkjøperens pin/spi i stedet hvis kjøperen har sendt egen apteringsinstruks. Sortimentene i oin har
  ID-ene ${produkter.map((p) => p.id).join(', ')}.

Etter drift
  Ta med produksjonsfilene fra maskinen (.hpr, gjerne også .thp, .fpr, .mom, .ogr, .hqc – gjerne som ZIP) og les dem
  inn i SkogIQ under Tiltak › Oppdrag › ${o.nr} › StanForD. Oppdraget, bestandene og kartet ajourføres.

Hensyn i kartet (${k.hensynFlate.length + k.hensynPunkt.length} objekter) har varselavstand i feltet VARSELAVST.
`;
}

// ---------- lesing av XML ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const dekod = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e] ?? m));
// Enkel, tolerant XML-leser: { n: lokalt navn, a: attributter, c: barn, t: tekst }.
export function lesXml(tekst) {
  const rot = { n: '#', a: {}, c: [], t: '' }; const stakk = [rot];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<!DOCTYPE[^>]*>|<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(tekst))) {
    const topp = stakk.at(-1);
    if (m[1] !== undefined) { topp.t += m[1]; continue; }
    if (m[6] !== undefined) { if (/\S/.test(m[6])) topp.t += dekod(m[6]); continue; }
    if (!m[3]) continue;
    const navn = m[3].replace(/^.*:/, '');
    if (m[2]) { for (let i = stakk.length - 1; i > 0; i--) if (stakk[i].n === navn) { stakk.length = i; break; } continue; }
    const a = {}; for (const am of m[4].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) a[am[1].replace(/^.*:/, '')] = dekod(am[2] ?? am[3]);
    const node = { n: navn, a, c: [], t: '' }; topp.c.push(node);
    if (!m[5]) stakk.push(node);
  }
  return rot;
}
const barn = (n, navn) => n?.c.find((c) => c.n === navn) || null;
const alle = (n, navn) => (n ? n.c.filter((c) => c.n === navn) : []);
const tekstAv = (n, navn) => { const b = barn(n, navn); return b ? b.t.trim() : ''; };
const tallAv = (n, navn) => { const v = Number(tekstAv(n, navn)); return Number.isFinite(v) ? v : null; };
function dypt(n, navn, ut = []) { for (const c of n.c) { if (c.n === navn) ut.push(c); else dypt(c, navn, ut); } return ut; }
// Store blokker som ikke trengs (diameterprofiler, prismatriser, utvidelser) fjernes før lesing.
const TUNGE = ['StemDiameters', 'ProductMatrixes', 'ButtEndProfileExtrapolation', 'Extension', 'DiameterDefinition', 'LengthDefinition'];
const lett = (t) => TUNGE.reduce((s, n) => s.replace(new RegExp(`<(?:\\w+:)?${n}\\b[^>]*?(?:/>|>[\\s\\S]*?</(?:\\w+:)?${n}>)`, 'g'), ''), t);

// Tolker treslag og sortiment fra navn og ID (kjøperens egne instrukser bruker ulike navn).
export function treslagFra(...t) { const s = t.join(' ').toLowerCase(); if (/gran|spruce|picea|kuusi|\bgr\b|_gr|abies/.test(s)) return 'G'; if (/furu|pine|tall|pinus|mänty|\bfu\b|_fu|larix|lerk/.test(s)) return 'F'; return 'L'; }
export function sortimentFra(...t) { const s = t.join(' ').toLowerCase(); if (/energi|energy|grot|bio|brensel|ved\b|fuel/.test(s)) return 'energi'; if (/masse|pulp|cellul|kuitu|slip|flis/.test(s)) return 'massevirke'; if (/sag|tømmer|tommer|timber|saw|log|stokk|tukki|spesial|stolpe|ter/.test(s)) return 'sagtommer'; return 'annet'; }

function maskinInfo(m) { return { kategori: m.a.machineCategory || '', nokkel: tekstAv(m, 'MachineKey'), id: tekstAv(m, 'MachineUserID') || tekstAv(m, 'BaseMachineManufacturerID'), produsent: tekstAv(m, 'MachineBaseManufacturer'), modell: tekstAv(m, 'MachineBaseModel'), program: tekstAv(m, 'MachineApplicationVersion') }; }
function definisjoner(m) {
  const treslag = new Map(); const produkter = new Map(); const objekter = new Map();
  for (const s of alle(m, 'SpeciesGroupDefinition')) { const k = tekstAv(s, 'SpeciesGroupKey'); const navn = tekstAv(s, 'SpeciesGroupName'); const id = tekstAv(s, 'SpeciesGroupUserID'); treslag.set(k, { navn, id, treslag: treslagFra(navn, id) }); }
  for (const p of alle(m, 'ProductDefinition')) {
    const k = tekstAv(p, 'ProductKey'); const c = barn(p, 'ClassifiedProductDefinition') || barn(p, 'UnclassifiedProductDefinition') || p;
    const navn = tekstAv(c, 'ProductName'); const id = tekstAv(p, 'ProductUserID'); const gruppe = tekstAv(c, 'ProductGroupName');
    const sk = tekstAv(c, 'SpeciesGroupKey') || tekstAv(p, 'SpeciesGroupKey');
    produkter.set(k, { navn: navn || id || `Produkt ${k}`, id, gruppe, sortiment: sortimentFra(gruppe, navn, id), treslagNokkel: sk });
  }
  for (const ob of alle(m, 'ObjectDefinition')) {
    const k = tekstAv(ob, 'ObjectKey');
    objekter.set(k, { nokkel: k, id: tekstAv(ob, 'ObjectUserID'), navn: tekstAv(ob, 'ObjectName'), start: tekstAv(ob, 'StartDate'), slutt: tekstAv(ob, 'EndDate'), tekst: tekstAv(ob, 'TextFromMachine'),
      delobjekter: new Map(alle(ob, 'SubObject').map((so) => [tekstAv(so, 'SubObjectKey'), { nokkel: tekstAv(so, 'SubObjectKey'), id: tekstAv(so, 'SubObjectUserID'), navn: tekstAv(so, 'SubObjectName') }])) });
  }
  return { treslag, produkter, objekter };
}
function koordinat(c) {
  if (!c) return null; const la = barn(c, 'Latitude'); const lo = barn(c, 'Longitude'); if (!la || !lo) return null;
  const lat = Number(la.t) * (la.a.latitudeCategory === 'South' ? -1 : 1); const lon = Number(lo.t) * (lo.a.longitudeCategory === 'West' ? -1 : 1);
  return Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon) ? [lon, lat] : null;
}
const dato = (t) => (/^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : '');
const volum = (noder, attr, kat) => { const n = noder.find((v) => v.a[attr] === kat); return n ? Number(n.t) || 0 : null; };

function lesHpr(rot) {
  const ut = { type: 'hpr', maskiner: [], objekter: [], stammer: [] };
  for (const m of alle(rot, 'Machine')) {
    const mi = maskinInfo(m); ut.maskiner.push(mi); const d = definisjoner(m);
    for (const ob of d.objekter.values()) ut.objekter.push({ ...ob, delobjekter: [...ob.delobjekter.values()] });
    for (const s of alle(m, 'Stem')) {
      const obj = d.objekter.get(tekstAv(s, 'ObjectKey')); const del = obj?.delobjekter.get(tekstAv(s, 'SubObjectKey'));
      const ts = d.treslag.get(tekstAv(s, 'SpeciesGroupKey'));
      const koord = alle(s, 'StemCoordinates'); const kran = koord.find((c) => /crane/i.test(c.a.receiverPosition || '')); const pos = koordinat(kran) || koordinat(koord[0]);
      const stokker = dypt(s, 'Log').map((l) => {
        const vol = alle(l, 'LogVolume'); const p = d.produkter.get(tekstAv(l, 'ProductKey'));
        const mal = barn(l, 'LogMeasurement'); const dia = alle(mal, 'LogDiameter');
        return { produkt: p?.navn || `Produkt ${tekstAv(l, 'ProductKey')}`, sortiment: p?.sortiment || 'annet', fub: volum(vol, 'logVolumeCategory', 'm3sub') ?? volum(vol, 'logVolumeCategory', 'm3 (price)') ?? 0, fpb: volum(vol, 'logVolumeCategory', 'm3sob') ?? 0, lengde: tallAv(mal, 'LogLength'), topp: Number(dia.find((x2) => x2.a.logDiameterCategory === 'Top ub')?.t) || null };
      });
      const prosess = barn(s, 'SingleTreeProcessedStem') || barn(s, 'MultiTreeProcessedStem') || barn(s, 'SingleTreeFelledStem') || s;
      let fub = stokker.reduce((a, l) => a + l.fub, 0); let fpb = stokker.reduce((a, l) => a + l.fpb, 0);
      if (!stokker.length) { const sv = dypt(s, 'StemVolume'); fub = volum(sv, 'stemVolumeCategory', 'm3sub') ?? volum(sv, 'stemVolumeCategory', 'm3subEstimated') ?? 0; fpb = volum(sv, 'stemVolumeCategory', 'm3sob') ?? 0; }
      ut.stammer.push({ k: `${mi.nokkel || mi.id}:${tekstAv(s, 'StemKey') || ut.stammer.length + 1}`, objekt: obj?.id || '', delobjekt: del?.id || '', delobjektNavn: del?.navn || '', treslag: ts?.treslag || treslagFra(ts?.navn || ''), treslagNavn: ts?.navn || '', dato: dato(tekstAv(s, 'HarvestDate')), pos, dbh: tallAv(prosess, 'DBH'), fub: r(fub, 4), fpb: r(fpb, 4), stokker });
    }
  }
  return ut;
}
function lesThp(rot) {
  const ut = { type: 'thp', maskiner: [], objekter: [], summer: [] };
  for (const m of alle(rot, 'Machine')) {
    ut.maskiner.push(maskinInfo(m)); const d = definisjoner(m);
    for (const ob of d.objekter.values()) ut.objekter.push({ ...ob, delobjekter: [...ob.delobjekter.values()] });
    for (const t of alle(m, 'Total')) {
      const obj = d.objekter.get(tekstAv(t, 'ObjectKey')); const del = obj?.delobjekter.get(tekstAv(t, 'SubObjectKey')); const ts = d.treslag.get(tekstAv(t, 'SpeciesGroupKey'));
      const sv = alle(t, 'TotalStemVolume');
      ut.summer.push({ objekt: obj?.id || '', delobjekt: del?.id || '', treslag: ts?.treslag || 'G', stammer: tallAv(t, 'TotalNumberOfStems') || 0, fub: volum(sv, 'totalStemVolumeCategory', 'm3sub') ?? 0, fpb: volum(sv, 'totalStemVolumeCategory', 'm3sob') ?? 0,
        produkter: alle(t, 'TotalLogs').map((l) => { const p = d.produkter.get(tekstAv(l, 'ProductKey')); const pv = alle(l, 'TotalProductVolume'); return { produkt: p?.navn || '', sortiment: p?.sortiment || 'annet', stokker: tallAv(l, 'TotalProductNumberOfLogs') || 0, fub: volum(pv, 'totalProductVolumeCategory', 'm3sub') ?? volum(pv, 'totalProductVolumeCategory', 'm3 (price)') ?? 0 }; }) });
    }
  }
  return ut;
}
function lesFpr(rot) {
  const ut = { type: 'fpr', maskiner: [], objekter: [], lass: [], velteplasser: [] };
  for (const m of alle(rot, 'Machine')) {
    ut.maskiner.push(maskinInfo(m)); const d = definisjoner(m);
    for (const ob of d.objekter.values()) ut.objekter.push({ ...ob, delobjekter: [...ob.delobjekter.values()] });
    const lok = new Map(alle(m, 'LocationDefinition').map((l) => [tekstAv(l, 'LocationKey'), { id: tekstAv(l, 'LocationUserID'), navn: tekstAv(l, 'LocationName') || tekstAv(l, 'LocationUserID'), pos: koordinat(barn(l, 'LocationCoordinates')), objekt: d.objekter.get(tekstAv(l, 'ObjectKey'))?.id || '' }]));
    const lev = new Map(alle(m, 'DeliveryDefinition').map((l) => { const pk = alle(l, 'ProductKey').map((p) => d.produkter.get(p.t.trim())).filter(Boolean); const navn = tekstAv(l, 'DeliveryName') || tekstAv(l, 'DeliveryUserID'); return [tekstAv(l, 'DeliveryKey'), { id: tekstAv(l, 'DeliveryUserID'), navn, sortiment: pk[0]?.sortiment || sortimentFra(navn), treslag: pk[0] ? d.treslag.get(pk[0].treslagNokkel)?.treslag || treslagFra(navn) : treslagFra(navn) }]; }));
    ut.velteplasser.push(...lok.values());
    for (const l of alle(m, 'Load')) {
      for (const p of alle(l, 'PartialLoad')) {
        const lv = alle(p, 'LoadVolume'); const le = lev.get(tekstAv(p, 'DeliveryKey')); const lo = lok.get(tekstAv(p, 'LocationKey'));
        ut.lass.push({ nr: tallAv(l, 'LoadNumber'), dato: dato(tekstAv(l, 'UnloadingTime')), leveranse: le?.navn || '', sortiment: le?.sortiment || 'annet', treslag: le?.treslag || '', velteplass: lo?.navn || '', objekt: lo?.objekt || '', fub: volum(lv, 'loadVolumeCategory', 'Volume, m3sub') ?? 0, fpb: volum(lv, 'loadVolumeCategory', 'Volume, m3sob') ?? 0, pos: koordinat(barn(p, 'LoadingCoordinates')) });
      }
    }
  }
  return ut;
}
function lesMom(rot) {
  const ut = { type: 'mom', maskiner: [], objekter: [], timer: 0, drivstoff: 0, perObjekt: {} };
  for (const m of alle(rot, 'Machine')) {
    ut.maskiner.push(maskinInfo(m)); const d = definisjoner(m);
    for (const ob of d.objekter.values()) ut.objekter.push({ ...ob, delobjekter: [...ob.delobjekter.values()] });
    for (const w of alle(m, 'CombinedMachineWorkTime')) {
      const obj = d.objekter.get(tekstAv(w, 'ObjectKey'))?.id || ''; const sek = alle(w, 'CombinedMachineRunTime').reduce((s, c) => s + (tallAv(c, 'TimeLength') || 0), 0);
      const liter = dypt(w, 'FuelConsumption').reduce((s, f) => s + (Number(f.t) || 0), 0);
      const p = ut.perObjekt[obj] || (ut.perObjekt[obj] = { timer: 0, drivstoff: 0 }); p.timer += sek / 3600; p.drivstoff += liter; ut.timer += sek / 3600; ut.drivstoff += liter;
    }
    if (!ut.drivstoff) ut.drivstoff = tallAv(m, 'MachineFuelConsumption') || 0;
  }
  ut.timer = r(ut.timer, 1); ut.drivstoff = r(ut.drivstoff, 0);
  return ut;
}
function lesHqc(rot) { const st = dypt(rot, 'Stem').length || dypt(rot, 'ControlStem').length; return { type: 'hqc', maskiner: alle(rot, 'Machine').map(maskinInfo), objekter: [], kontrollstammer: st }; }
function lesOgr(rot) {
  const lag = dypt(rot, 'GISLayer').map((l) => ({ fil: tekstAv(l, 'GISFileName'), navn: tekstAv(l, 'GISFileLayerDescription'), spor: tekstAv(l, 'TrackingFile') === 'true' || tekstAv(l, 'GISFileTrackingType') !== '' || /spor|track/i.test(tekstAv(l, 'GISFileName')), endret: tekstAv(l, 'GISFileModified') === 'true' }));
  return { type: 'ogr', maskiner: alle(rot, 'Machine').map(maskinInfo), objekter: dypt(rot, 'ObjectDefinition').map((ob) => ({ id: tekstAv(ob, 'ObjectUserID'), navn: tekstAv(ob, 'ObjectName'), delobjekter: [] })), lag, koordsys: dypt(rot, 'GISCoordinateReferenceSystem')[0]?.t.trim() || '' };
}
const LESERE = { HarvestedProduction: lesHpr, TotalHarvestedProduction: lesThp, ForwardedProduction: lesFpr, OperationalMonitoring: lesMom, HarvestingQualityControl: lesHqc, ObjectGeographicalReport: lesOgr };

// Leser én StanForD-melding (tekst). Gir { type, … } eller null hvis meldingen ikke er en rapport.
export function lesMelding(tekst) {
  const start = tekst.slice(0, 4000).match(/<(?:\w+:)?(\w+)\b[^>]*\bmessageType\s*=\s*"(\w+)"/);
  if (!start || !LESERE[start[1]]) return null;
  const rot = lesXml(lett(tekst)); const el = rot.c.find((c) => c.n === start[1]);
  return el ? { ...LESERE[start[1]](el), versjon: el.a.version || '' } : null;
}

async function pakkUt(data) {
  if (data[0] === 0x50 && data[1] === 0x4b) return { zip: await lesZip(data) };
  const flyt = async (fmt) => new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream(fmt))).arrayBuffer());
  if (typeof DecompressionStream !== 'function') throw new Error('Nettleseren kan ikke pakke ut komprimerte filer – oppdater nettleseren.');
  if (data[0] === 0x1f && data[1] === 0x8b) return { data: await flyt('gzip') };
  if ((data[0] & 0x0f) === 8 && ((data[0] << 8) | data[1]) % 31 === 0) return { data: await flyt('deflate') };
  return { data: await flyt('deflate-raw') };
}
const fraB64 = (s) => { const t = s.replace(/\s+/g, ''); if (typeof atob === 'function') { const b = atob(t); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; } return new Uint8Array(Buffer.from(t, 'base64')); };
// Pakker ut .env: dokumentet og vedleggene blir egne filer.
function lesKonvolutt(tekst) {
  const rot = lesXml(tekst); const ut = [];
  for (const m of dypt(rot, 'StanForD2010Message')) {
    const md = barn(m, 'MessageDocument'); const e = barn(md, 'EmbeddedDocument');
    if (e) { const navn = tekstAv(md, 'DocumentName') || `melding.${m.a.messageCategory || 'xml'}`; ut.push({ navn, data: e.a.encodingMethod === 'Base64' ? fraB64(e.t) : new TextEncoder().encode(e.t) }); }
    for (const v of alle(m, 'MessageAttachment')) { const ea = barn(v, 'EmbeddedAttachment'); if (ea) ut.push({ navn: tekstAv(v, 'AttachmentName') || 'vedlegg', data: ea.a.encodingMethod === 'Base64' ? fraB64(ea.t) : new TextEncoder().encode(ea.t) }); }
  }
  return ut;
}
const RAPPORT = /\.(hpr|thp|fpr|mom|hqc|ogr|hpd)z?$/i;
// Leser filene fra maskinen: [{ navn, data: Uint8Array }] → { meldinger: [...], spor: [LineString], objekter: [GeoJSON-objekter fra ogr], filer, ukjente }
export async function lesProduksjonsfiler(filer) {
  let kø = filer.map((f) => ({ navn: f.navn, data: f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data) }));
  const alleFiler = []; const ukjente = [];
  for (let runde = 0; kø.length && runde < 4; runde++) {
    const neste = [];
    for (const f of kø) {
      const kort = f.navn.split('/').pop();
      if (/\.zip$/i.test(kort) || (f.data[0] === 0x50 && f.data[1] === 0x4b && !/\.(shp|dbf|shx)$/i.test(kort))) { neste.push(...(await lesZip(f.data)).map((z) => ({ navn: z.navn, data: z.data }))); continue; }
      if (/z$/i.test(kort) && RAPPORT.test(kort)) { const p = await pakkUt(f.data); if (p.zip) neste.push(...p.zip); else neste.push({ navn: kort.replace(/z$/i, ''), data: p.data }); continue; }
      if (/\.env$/i.test(kort)) { neste.push(...lesKonvolutt(new TextDecoder().decode(f.data))); continue; }
      alleFiler.push({ ...f, kort, base: kort.replace(/\.[^.]+$/, '').toLowerCase() });
    }
    kø = neste;
  }
  const meldinger = [];
  for (const f of alleFiler) {
    if (/\.(shp|shx|dbf|prj|cpg|qix|sbn|sbx)$/i.test(f.kort)) continue;
    const tekst = new TextDecoder().decode(f.data);
    if (!/^\s*(<\?xml|<)/.test(tekst.slice(0, 200))) { ukjente.push(f.kort); continue; }
    let m = null; try { m = lesMelding(tekst); } catch { m = null; }
    if (m) meldinger.push({ ...m, fil: f.kort }); else if (!/\.(oin|ogi|spi|pin|foi|fdi|udi|txt)$/i.test(f.kort)) ukjente.push(f.kort);
  }
  // Kartlag fra maskinen (ogr eller løse shapefiler): linjer = kjørespor, punkt/flater = objekter registrert av fører.
  const spor = []; const objekter = [];
  const ogrLag = meldinger.filter((m) => m.type === 'ogr').flatMap((m) => m.lag);
  for (const shp of alleFiler.filter((f) => /\.shp$/i.test(f.kort))) {
    const finn = (e) => alleFiler.find((f) => f.base === shp.base && f.kort.toLowerCase().endsWith(e))?.data || null;
    const prj = finn('.prj'); let obj = [];
    try { obj = lesShapefile(shp.data, finn('.dbf'), prj ? new TextDecoder().decode(prj) : null); } catch { continue; }
    const info = ogrLag.find((l) => l.fil.toLowerCase() === shp.kort.toLowerCase());
    for (const ob of obj) {
      if (/LineString/.test(ob.geometri.type) && (info?.spor || /spor|track|trail|stickv/i.test(shp.kort) || !info)) spor.push(...(ob.geometri.type === 'LineString' ? [ob.geometri.coordinates] : ob.geometri.coordinates));
      else if (info || /hensyn|objekt|feature|natur|kultur/i.test(shp.kort)) objekter.push({ ...ob, fil: shp.kort });
    }
  }
  if (!meldinger.length && !spor.length) throw new Error('Fant ingen produksjonsfiler (hpr, thp, fpr, mom, hqc eller ogr) i filene.');
  return { meldinger, spor, objekter, filer: alleFiler.map((f) => f.kort), ukjente };
}

// ---------- ajourføring ----------
const RUTE = 10; // m – rutenett for hogd flate
// Fordeler stammene på bestandene i oppdraget. Gir resultat per bestand og for hele oppdraget.
export function beregnResultat(S, o, data) {
  const ls = oppdragLinjer(S, o); const objektId = o.stanford?.objektId || `SkogIQ-${o.nr}`;
  const hpr = data.meldinger.filter((m) => m.type === 'hpr');
  // Slå sammen stammer fra flere filer (samme stamme i flere hpr-filer telles én gang).
  const stammer = new Map(); for (const m of hpr) for (const s of m.stammer) stammer.set(s.k, s);
  const andreObjekter = new Set(); const perBestand = new Map(); let utenfor = 0; let utenforM3 = 0;
  const bestandFor = (s) => {
    const l = ls.find((x2) => x2.bestand.id === s.delobjekt) || ls.find((x2) => s.delobjektNavn && `Bestand ${x2.bestand.nr}` === s.delobjektNavn);
    if (l) return l;
    return s.pos ? ls.find((x2) => x2.bestand.geometri && iGeometri(s.pos, x2.bestand.geometri)) || null : null;
  };
  for (const s of stammer.values()) {
    if (s.objekt && s.objekt !== objektId && !s.objekt.endsWith(o.nr)) andreObjekter.add(s.objekt);
    const l = bestandFor(s);
    if (!l) { utenfor++; utenforM3 += s.fub; continue; }
    let p = perBestand.get(l.bestand.id);
    if (!p) perBestand.set(l.bestand.id, p = { bestandId: l.bestand.id, tiltakId: l.tiltak.id, stammer: 0, fub: 0, fpb: 0, treslag: { G: 0, F: 0, L: 0 }, sortiment: {}, produkter: {}, fra: '', til: '', ruter: new Set() });
    p.stammer++; p.fub += s.fub; p.fpb += s.fpb; p.treslag[s.treslag] = (p.treslag[s.treslag] || 0) + s.fub;
    for (const st of s.stokker) { p.sortiment[st.sortiment] = (p.sortiment[st.sortiment] || 0) + st.fub; p.produkter[st.produkt] = (p.produkter[st.produkt] || 0) + st.fub; }
    if (s.dato) { if (!p.fra || s.dato < p.fra) p.fra = s.dato; if (!p.til || s.dato > p.til) p.til = s.dato; }
    if (s.pos) { const [e, n] = geoTilUtm(s.pos[0], s.pos[1], 33); p.ruter.add(`${Math.floor(e / RUTE)},${Math.floor(n / RUTE)}`); }
  }
  // thp uten hpr: summer per delobjekt (ingen posisjoner).
  if (!hpr.length) {
    for (const m of data.meldinger.filter((x2) => x2.type === 'thp')) for (const t of m.summer) {
      const l = ls.find((x2) => x2.bestand.id === t.delobjekt) || (ls.length === 1 ? ls[0] : null); if (!l) { utenfor += t.stammer; utenforM3 += t.fub; continue; }
      let p = perBestand.get(l.bestand.id);
      if (!p) perBestand.set(l.bestand.id, p = { bestandId: l.bestand.id, tiltakId: l.tiltak.id, stammer: 0, fub: 0, fpb: 0, treslag: { G: 0, F: 0, L: 0 }, sortiment: {}, produkter: {}, fra: '', til: '', ruter: new Set() });
      p.stammer += t.stammer; p.fub += t.fub; p.fpb += t.fpb; p.treslag[t.treslag] += t.fub;
      for (const pr of t.produkter) { p.sortiment[pr.sortiment] = (p.sortiment[pr.sortiment] || 0) + pr.fub; p.produkter[pr.produkt] = (p.produkter[pr.produkt] || 0) + pr.fub; }
    }
  }
  const bestand = [...perBestand.values()].map((p) => {
    const l = ls.find((x2) => x2.bestand.id === p.bestandId); const areal = l.tiltak.arealDaa ?? l.bestand.areal ?? 0;
    const hogdDaa = (p.ruter.size * RUTE * RUTE) / 1000;
    return { bestandId: p.bestandId, tiltakId: p.tiltakId, nr: l.bestand.nr, type: l.tiltak.type, areal, stammer: p.stammer, m3: r(p.fub, 1), m3pb: r(p.fpb, 1), middelstamme: p.stammer ? r(p.fub / p.stammer, 3) : 0,
      m3PerDaa: areal ? r(p.fub / areal, 1) : null, treslag: Object.fromEntries(Object.entries(p.treslag).map(([k, v]) => [k, r(v, 1)])), sortiment: Object.fromEntries(Object.entries(p.sortiment).map(([k, v]) => [k, r(v, 1)])), produkter: Object.fromEntries(Object.entries(p.produkter).map(([k, v]) => [k, r(v, 1)])),
      fra: p.fra, til: p.til, hogdDaa: p.ruter.size ? r(Math.min(hogdDaa, areal || hogdDaa), 1) : null, dekning: p.ruter.size && areal ? Math.min(1, hogdDaa / areal) : null };
  }).sort((a, b) => String(a.nr).localeCompare(String(b.nr), 'nb', { numeric: true }));
  // Lassbærer: lass per sortiment og velteplass.
  const lass = data.meldinger.filter((m) => m.type === 'fpr').flatMap((m) => m.lass);
  const lassbaerer = lass.length ? { lass: new Set(lass.map((l) => `${l.nr}|${l.dato}`)).size, m3: r(lass.reduce((s, l) => s + l.fub, 0), 1), sortiment: lass.reduce((a, l) => ({ ...a, [l.sortiment]: r((a[l.sortiment] || 0) + l.fub, 1) }), {}), velteplasser: lass.reduce((a, l) => ({ ...a, [l.velteplass || 'Ukjent']: r((a[l.velteplass || 'Ukjent'] || 0) + l.fub, 1) }), {}), fra: lass.map((l) => l.dato).filter(Boolean).sort()[0] || '', til: lass.map((l) => l.dato).filter(Boolean).sort().at(-1) || '' } : null;
  const mom = data.meldinger.filter((m) => m.type === 'mom');
  const drift = mom.length ? { timer: r(mom.reduce((s, m) => s + (m.perObjekt[objektId]?.timer ?? m.timer), 0), 1), drivstoff: r(mom.reduce((s, m) => s + (m.perObjekt[objektId]?.drivstoff ?? m.drivstoff), 0), 0) } : null;
  const kontroll = data.meldinger.filter((m) => m.type === 'hqc').reduce((s, m) => s + m.kontrollstammer, 0);
  const sum = (f) => r(bestand.reduce((s, b) => s + (b[f] || 0), 0), 1);
  const sortSum = {}; const treSum = { G: 0, F: 0, L: 0 }; const prodSum = {};
  for (const b of bestand) { for (const [k, v] of Object.entries(b.sortiment)) sortSum[k] = r((sortSum[k] || 0) + v, 1); for (const [k, v] of Object.entries(b.treslag)) treSum[k] = r((treSum[k] || 0) + v, 1); for (const [k, v] of Object.entries(b.produkter)) prodSum[k] = r((prodSum[k] || 0) + v, 1); }
  const datoer = bestand.flatMap((b) => [b.fra, b.til]).filter(Boolean).sort();
  const maskiner = [...new Map(data.meldinger.flatMap((m) => m.maskiner || []).map((mi) => [`${mi.produsent}${mi.modell}${mi.nokkel}`, mi])).values()];
  const totalM3 = sum('m3'); const totalStammer = bestand.reduce((s, b) => s + b.stammer, 0);
  return {
    bestand, utenfor, utenforM3: r(utenforM3, 1), andreObjekter: [...andreObjekter], stammer: totalStammer, m3: totalM3, m3pb: sum('m3pb'), middelstamme: totalStammer ? r(totalM3 / totalStammer, 3) : 0,
    sortiment: sortSum, treslag: treSum, produkter: prodSum, fra: datoer[0] || '', til: datoer.at(-1) || '', lassbaerer, drift, kontrollstammer: kontroll, maskiner,
    meldinger: data.meldinger.map((m) => ({ type: m.type, fil: m.fil, versjon: m.versjon })), spor: data.spor.length, nyeObjekter: data.objekter.length,
    _stammer: [...stammer.values()], _ruter: new Map([...perBestand].map(([k, p]) => [k, p.ruter])),
  };
}

// Hva ajourføringen vil gjøre med hvert bestand (vises før brukeren bekrefter).
export function endringer(S, o, res, { fullHogst = 0.6 } = {}) {
  const tidligere = o.stanford?.anvendt || {};
  return res.bestand.map((rb) => {
    const b = S.bestand.find((x2) => x2.id === rb.bestandId); const t = b?.tiltak?.find((x2) => x2.id === rb.tiltakId); if (!b || !t) return null;
    const delta = rb.m3 - (tidligere[b.id]?.m3 || 0); const deltaStammer = rb.stammer - (tidligere[b.id]?.stammer || 0);
    const hel = rb.dekning == null ? true : rb.dekning >= fullHogst;
    let tekst; let bestandEndring = {};
    if (t.type === 'sluttavvirkning' && hel) { tekst = `hogstklasse I (alder 0, volum 0) – ${rb.dekning == null ? 'ingen posisjoner' : `${Math.round(rb.dekning * 100)} % av flaten hogd`}`; bestandEndring = { hogstklasse: null, alder: 0, volumDaa: 0, treantall: null, hoyde: null }; }
    else if (['sluttavvirkning', 'tynning', 'lukkethogst'].includes(t.type)) {
      const areal = b.areal || rb.areal || 0; const ny = areal && b.volumDaa != null ? Math.max(0, r(b.volumDaa - delta / areal, 1)) : b.volumDaa;
      tekst = `${t.type === 'sluttavvirkning' ? `delvis hogd (${Math.round((rb.dekning || 0) * 100)} % av flaten) – ` : ''}volum ${b.volumDaa ?? '–'} → ${ny ?? '–'} m³/daa`;
      bestandEndring = { volumDaa: ny }; if (b.treantall && areal) bestandEndring.treantall = Math.max(0, Math.round(b.treantall - deltaStammer / areal));
    } else tekst = 'tiltaket merkes utført';
    return { bestand: b, tiltak: t, res: rb, tekst, bestandEndring, delta: r(delta, 1), hel };
  }).filter(Boolean);
}

// Gjør ajourføringen: tiltak utført med virkelig volum, bestandene oppdatert, oppdragets status og kartdata.
// Kan kjøres flere ganger med nye filer – bare endringen siden sist trekkes fra volumet.
export function ajourfor(S, o, res, data, { naa = new Date(), fullHogst = 0.6, importId = null } = {}) {
  const liste = endringer(S, o, res, { fullHogst });
  const idag = naa.toISOString().slice(0, 10);
  o.stanford = o.stanford || {}; o.stanford.anvendt = o.stanford.anvendt || {};
  for (const e of liste) {
    const { bestand: b, tiltak: t, res: rb } = e;
    Object.assign(b, e.bestandEndring);
    t.status = 'utfort'; t.utfortDato = rb.til || idag; t.utfortM3 = rb.m3; t.utfortStammer = rb.stammer; t.utfortKilde = 'StanForD 2010';
    if (rb.hogdDaa) t.utfortDaa = rb.hogdDaa;
    b.hogsthistorikk = (b.hogsthistorikk || []).filter((h) => h.oppdragId !== o.id);
    b.hogsthistorikk.push({ dato: t.utfortDato, type: t.type, m3: rb.m3, stammer: rb.stammer, middelstamme: rb.middelstamme, sortiment: rb.sortiment, treslag: rb.treslag, kilde: 'StanForD 2010', oppdragId: o.id, oppdragNr: o.nr });
    o.stanford.anvendt[b.id] = { m3: rb.m3, stammer: rb.stammer };
  }
  const ls = oppdragLinjer(S, o);
  const hogst = ls.filter((l) => ['sluttavvirkning', 'tynning', 'lukkethogst'].includes(l.tiltak.type));
  const ferdig = hogst.length ? hogst.every((l) => l.tiltak.status === 'utfort') : true;
  if (o.status !== 'avbrutt') o.status = ferdig ? 'utfort' : 'pagar';
  if (ferdig) o.utfortDato = res.til || idag;
  // Kartdata: stammepunkter (komprimert), hogd flate (rutenett) og kjørespor.
  const ruter = new Set(); for (const s of res._ruter.values()) for (const k of s) ruter.add(k);
  const stammer = res._stammer.filter((s) => s.pos).slice(0, 40000).map((s) => [r(s.pos[0], 6), r(s.pos[1], 6), 'GFL'.indexOf(s.treslag), Math.round(s.fub * 1000)]);
  const spor = (data.spor || []).slice(0, 500).map((l) => l.map(([a, b]) => [r(a, 6), r(b, 6)]));
  const tidl = o.stanford.importer || [];
  const { _stammer, _ruter, ...lagret } = res;
  Object.assign(o.stanford, {
    resultat: { ...lagret, oppdatert: tidspunkt(naa) },
    kart: { stammer, hogd: ruterTilFlate(ruter), spor, velteplasser: data.meldinger.filter((m) => m.type === 'fpr').flatMap((m) => m.velteplasser).filter((v) => v.pos).map((v) => ({ navn: v.navn, pos: v.pos })) },
    importer: [...tidl.filter((i) => i.id !== importId), { id: importId, dato: tidspunkt(naa), filer: data.filer.slice(0, 50), stammer: res.stammer, m3: res.m3 }].slice(-20),
  });
  return liste;
}

// Ruter (UTM33, 10 m) → MultiPolygon i lon/lat. Naboruter i samme rad slås sammen til rektangler.
export function ruterTilFlate(ruter) {
  const rader = new Map();
  for (const k of ruter) { const [i, j] = k.split(',').map(Number); if (!rader.has(j)) rader.set(j, []); rader.get(j).push(i); }
  const poly = [];
  for (const [j, is] of rader) {
    is.sort((a, b) => a - b); let s = is[0]; let p = is[0];
    const lukk = () => { const x0 = s * RUTE; const x1 = (p + 1) * RUTE; const y0 = j * RUTE; const y1 = (j + 1) * RUTE; poly.push([[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([e, n]) => utmTilGeo(e, n, 33).map((v) => r(v, 7)))]); };
    for (const i of is.slice(1)) { if (i === p + 1) { p = i; continue; } lukk(); s = i; p = i; }
    if (is.length) lukk();
  }
  return poly.length ? { type: 'MultiPolygon', coordinates: poly } : null;
}

// Kartlaget for oppdraget (GeoJSON FeatureCollection): hogd flate, kjørespor, velteplasser og stammer.
export function kartGeojson(o, { maksStammer = 6000 } = {}) {
  const k = o.stanford?.kart; if (!k) return null;
  const f = [];
  if (k.hogd) f.push({ type: 'Feature', geometry: k.hogd, properties: { lag: 'hogd' } });
  for (const l of k.spor || []) f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: l }, properties: { lag: 'spor' } });
  for (const v of k.velteplasser || []) f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: v.pos }, properties: { lag: 'velteplass', navn: v.navn } });
  const st = k.stammer || []; const steg = Math.max(1, Math.ceil(st.length / maksStammer));
  for (let i = 0; i < st.length; i += steg) { const [lon, lat, t, l] = st[i]; f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { lag: 'stamme', treslag: 'GFL'[t] || 'L', m3: l / 1000 } }); }
  return { type: 'FeatureCollection', features: f };
}

// Nøkkel for en import (samme filer to ganger gir samme nøkkel).
export const importNokkel = (filer) => `s${crc32(new TextEncoder().encode(filer.map((f) => `${f.navn}:${f.data?.length || 0}:${f.data ? crc32(f.data.subarray(0, 65536)) : 0}`).sort().join('|'))).toString(36)}`;

// Objekter fra maskinens kart (ogr) som kan legges inn i miljøregistreringene: ID-er som ikke kom fra SkogIQ.
export function nyeHensyn(S, data) {
  const kjente = new Set([...(S.pefc?.objekter || []).map((x2) => x2.id), ...S.bestand.map((b) => b.id), ...S.bestand.map((b) => `m${b.id}`)]);
  return data.objekter.map((ob) => {
    const e = ob.egenskaper || {}; const type = String(e.TYPE || e.type || '').toLowerCase().trim();
    return { geometri: ob.geometri, id: String(e.ID || '').trim(), type: HENSYN[type] ? type : (ob.geometri.type === 'Point' ? 'livslopstre' : 'naturtype'), navn: String(e.BESKR || e.NAVN || e.NAME || '').trim() || 'Registrert av maskinfører', fil: ob.fil };
  }).filter((h) => !h.id || !kjente.has(h.id)).filter((h) => h.type !== 'velteplass' && h.type !== 'bestand');
}

// ---------- simulert drift (demo og test) ----------
// Lager en hpr-fil (og fpr) for oppdraget som om maskinene hadde hogd bestandene: stammer i bestandsflaten med
// volum fra planen. Brukes for å prøve flyten uten maskin.
export function simulerDrift(S, o, { naa = new Date(), seed = 1, andel = 1, ver = STANDARD_VERSJON, maksStammer = 12000 } = {}) {
  let s = seed >>> 0 || 1; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  const ls = oppdragLinjer(S, o).filter((l) => l.bestand.geometri);
  const naaT = tidspunkt(naa); const objektId = o.stanford?.objektId || `SkogIQ-${o.nr}`;
  const prod = PRODUKTER.map((p, i) => ({ ...p, key: i + 1 }));
  const tre = { G: 1, F: 2, L: 3 };
  const stammer = []; let nr = 0;
  ls.forEach((l, li) => {
    const b = l.bestand; const areal = b.areal || arealM2(b.geometri) / 1000;
    const andelUttak = l.tiltak.type === 'sluttavvirkning' ? 1 : l.tiltak.type === 'tynning' ? 0.25 : 0.35;
    const volum = Math.max(5, (b.volumDaa ?? 20) * areal * andelUttak * andel);
    const ms = l.tiltak.type === 'tynning' ? 0.12 : 0.35 + rnd() * 0.25;
    const n = Math.min(maksStammer, Math.max(1, Math.round(volum / ms)));
    const ring = ringerAv(b.geometri)[0]?.[0]; if (!ring) return;
    const [x0, y0, x1, y1] = bboxAv([b.geometri]); const g = { type: 'Polygon', coordinates: ringerAv(b.geometri)[0] };
    // Hogsten går i striper fra den ene kanten (andel < 1 gir delvis hogd flate).
    const grense = x0 + (x1 - x0) * andel;
    for (let i = 0, forsok = 0; i < n && forsok < n * 30; forsok++) {
      const p = [x0 + rnd() * (grense - x0), y0 + rnd() * (y1 - y0)]; if (!iGeometri(p, g)) continue; i++;
      const t = b.treslag === 'F' ? (rnd() < 0.85 ? 'F' : 'G') : b.treslag === 'L' ? (rnd() < 0.8 ? 'L' : 'G') : (rnd() < 0.88 ? 'G' : rnd() < 0.5 ? 'F' : 'L');
      const v = Math.max(0.03, ms * (0.4 + rnd() * 1.2));
      const sag = t !== 'L' && v > 0.18 ? v * (0.55 + rnd() * 0.25) : 0;
      const pS = prod.find((q) => q.treslag === t && q.sortiment === 'sagtommer'); const pM = prod.find((q) => q.treslag === t && q.sortiment === 'massevirke');
      const logs = []; if (sag && pS) logs.push([pS, sag]); logs.push([pM, v - sag]);
      const dag = new Date(naa.getTime() - (ls.length - li) * 86400000);
      stammer.push({ key: ++nr, sub: li + 1, tre: tre[t], pos: p, dbh: Math.round(120 + Math.sqrt(v) * 330), dato: tidspunkt(dag), logs });
    }
  });
  const sg = (detaljer) => Object.keys(TRESLAG).map((k, i) => x('SpeciesGroupDefinition', null, treslagsgruppe(k, naaT, i, { detaljer, arter: false }), x('SpeciesGroupKey', null, tre[k])));
  const pd = prod.map((p, i) => x('ProductDefinition', null, x('ProductKey', null, p.key), x('ClassifiedProductDefinition', null, produktFelles(p, naaT, i, {}), produktDetaljer(p, p.pris), x('ProductUserID', { agency: 'ForestOwner' }, p.id), x('SpeciesGroupKey', null, tre[p.treslag]))));
  const pos = (p, mottaker) => x('StemCoordinates', { receiverPosition: mottaker, coordinateReferenceSystem: 'WGS84' }, x('Latitude', { latitudeCategory: 'North' }, r(p[1], 7)), x('Longitude', { longitudeCategory: 'East' }, r(p[0], 7)), x('Altitude', null, 300));
  const objekt = x('ObjectDefinition', null, x('ObjectUserID', { agency: 'ForestOwner' }, objektId), x('ObjectName', null, o.nr), x('ObjectModificationDate', null, naaT), x('ForestCertification', null, 'PEFC'), x('ObjectKey', null, 1), x('StartDate', null, stammer[0]?.dato || naaT),
    ls.map((l, i) => x('SubObject', null, x('SubObjectUserID', { agency: 'ForestOwner' }, l.bestand.id), x('SubObjectName', null, `Bestand ${l.bestand.nr}`), x('SubObjectKey', null, i + 1))));
  const st = stammer.map((t) => x('Stem', null, x('StemKey', null, t.key), x('ObjectKey', null, 1), x('SubObjectKey', null, t.sub), x('SpeciesGroupKey', null, t.tre), x('OperatorKey', null, 1), x('HarvestDate', null, t.dato), x('StemNumber', null, t.key), x('ProcessingCategory', null, 'SingleTreeProcessing'),
    pos([t.pos[0] + 0.00008, t.pos[1] + 0.00003], 'Base machine position'), pos(t.pos, 'Crane tip position when felling the tree'),
    x('StumpTreatment', null, 'false'),
    x('SingleTreeProcessedStem', null, x('DBH', null, t.dbh), x('ReferenceDiameter', { referenceDiameterHeight: 130 }, t.dbh), x('StemGrade', null, x('GradeValue', { gradeStartPosition: 0 }, t.logs.length > 1 ? 1 : 2)), t.logs.map(([p, v], i) => x('Log', null, x('LogKey', null, i + 1), x('ProductKey', null, p.key),
      x('LogVolume', { logVolumeCategory: 'm3sob', logMeasurementCategory: 'Machine' }, r(v * 1.12, 4)), x('LogVolume', { logVolumeCategory: 'm3sub', logMeasurementCategory: 'Machine' }, r(v, 4)), x('CuttingCategory', null, x('CuttingReason', null, 'Automatic')),
      x('LogMeasurement', { logMeasurementCategory: 'Machine' }, x('LogDiameter', { logDiameterCategory: 'Top ub' }, p.sortiment === 'sagtommer' ? 160 : 80), x('LogLength', null, p.sortiment === 'sagtommer' ? 490 : 420)))))));
  const maskin = (kat, innhold) => x('Machine', { machineCategory: kat }, x('MachineKey', null, '1001'), x('MachineUserID', null, 'SIM-1'), x('MachineOwnerID', null, 'SIM'), x('MachineApplicationVersion', null, 'SkogIQ simulering'), x('MachineBaseManufacturer', null, 'Simulert'), x('MachineBaseModel', null, kat === 'Harvester' ? 'Hogstmaskin' : 'Lassbærer'), kontakt('MachineOwner', { firma: 'Simulert entreprenør' }), kontakt('LoggingContractor', { firma: 'Simulert entreprenør' }), innhold);
  const hpr = dok(x('HarvestedProduction', rotAttr('hpr', ver), hode('HarvestedProductionHeader', ver, naaT, 'SkogIQ simulering'),
    maskin('Harvester', [x('OperatorDefinition', null, x('OperatorKey', null, 1), x('OperatorUserID', null, 'F1'), x('ContactInformation', null, x('FirstName', null, 'Simulert'))), sg(true), pd, objekt, st])));
  // Lassbærer: alle stokker kjørt til første velteplass (eller en plass ved det første bestandet).
  const vp = kartobjekter(S, o).velteplasser[0] || { id: 'v1', navn: 'Velteplass', geometri: { type: 'Point', coordinates: ls[0] ? ringerAv(ls[0].bestand.geometri)[0][0][0] : [11, 60] } };
  const lev = prod.map((p) => ({ p, sum: 0 })); for (const t of stammer) for (const [p, v] of t.logs) lev.find((l) => l.p === p).sum += v;
  const lass = []; let ln = 0;
  for (const l of lev.filter((q) => q.sum > 0)) { let rest = l.sum; while (rest > 0.01) { const v = Math.min(rest, 14); rest -= v; lass.push({ nr: ++ln, l, v }); } }
  const fpr = dok(x('ForwardedProduction', rotAttr('fpr', ver), hode('ForwardedProductionHeader', ver, naaT, 'SkogIQ simulering'),
    maskin('Forwarder', [x('OperatorDefinition', null, x('OperatorKey', null, 1), x('OperatorUserID', null, 'F2')), sg(false), prod.map((p, i) => x('ProductDefinition', null, x('ProductKey', null, p.key), x('ClassifiedProductDefinition', null, produktFelles(p, naaT, i, {}), x('ProductUserID', { agency: 'ForestOwner' }, p.id), x('SpeciesGroupKey', null, tre[p.treslag])))),
      x('ObjectDefinition', null, x('ObjectUserID', { agency: 'ForestOwner' }, objektId), x('ObjectModificationDate', null, naaT), x('ForestCertification', null, 'PEFC'), x('ObjectKey', null, 1), x('StartDate', null, naaT)),
      x('LocationDefinition', null, x('LocationUserID', { agency: 'ForestOwner' }, vp.id), x('LocationName', null, vp.navn), x('LocationCoordinates', { receiverPosition: 'Base machine position', coordinateReferenceSystem: 'WGS84' }, x('Latitude', { latitudeCategory: 'North' }, r(vp.geometri.coordinates[1], 7)), x('Longitude', { longitudeCategory: 'East' }, r(vp.geometri.coordinates[0], 7)), x('Altitude', null, 300)), x('LocationKey', null, 1), x('ObjectKey', null, 1)),
      lev.map((l) => x('DeliveryDefinition', null, x('DeliveryUserID', { agency: 'ForestOwner' }, leveranseId(l.p)), x('DeliveryName', null, l.p.navn), x('ModificationDate', null, naaT), x('DeliveryKey', null, l.p.key), x('DeliveryEstimation', null, x('DeliveryEstimationMethod', null, 'Estimation through Harvested Production message'), x('DeliveryEstimationUnit', null, 'Volume, m3sub')), x('ProductKey', null, l.p.key))),
      lass.map((q) => x('Load', null, x('LoadKey', null, q.nr), x('OperatorKey', null, 1), x('LoadNumber', null, q.nr), x('UnloadingTime', null, naaT), x('PartialLoad', null, x('PartialLoadKey', null, 1), x('DeliveryKey', null, q.l.p.key), x('LocationKey', null, 1), x('LoadVolume', { loadVolumeCategory: 'Volume, m3sub' }, r(q.v, 2)))))])));
  const base = filnavn(`${o.nr}_simulert`);
  return [{ navn: `${base}.hpr`, data: hpr }, { navn: `${base}.fpr`, data: fpr }];
}

// Pakker filsettet som ZIP (Uint8Array).
export const zipAv = (filsett) => lagZip(filsett.filer.map((f) => ({ navn: `${filsett.mappe}/${f.navn}`, data: f.data })));
