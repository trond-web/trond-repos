// Tilbud på oppdrag: forespørsel til én eller flere utførere, svar via personlig lenke (tilbud.html), sammenligning og
// tildeling. Ingen DOM – kan testes i Node. Serveren er et mellomlager (tilbud-relay.js); planen har sin egen kopi.
//
// En god tilbudsforespørsel har: beskrivelse og omfang med kart, prisform (fastpris eller enhetspris), periode, svarfrist
// og vedståelsesfrist, betalingsvilkår og seriøsitetskrav (skatteattest, HMS-egenerklæring, forsikring, lønns- og
// arbeidsvilkår, PEFC – og SHA-plan etter byggherreforskriften når det bygges vei).
import { typeFor, sammendrag, linjer } from './oppdrag.js';

export const KILDER = {
  serioesitet: { navn: 'Seriøsitetskrav (skatteattest, HMS-egenerklæring) – mal fra Difi/KS/BNL', url: 'https://www.io.kommune.no/_f/p1/ibfc07354-4a77-4e71-8529-83507ce90c77/seriositetskrav.pdf' },
  tariff: { navn: 'Forskrift om allmenngjøring av tariffavtale for jordbruks- og gartnerinæringene', url: 'https://lovdata.no/forskrift/2022-12-09-2153' },
  byggherre: { navn: 'Statsforvalteren: bygging av landbruksveger er underlagt byggherreforskriften', url: 'https://www.statsforvalteren.no/trondelag/landbruk/nyheter-landbruk-og-mat/2020/09/bygging-av-landbruksveger-er-underlagt-byggherreforskriften/' },
  skogfond: { navn: 'Skogfond: utbetaling til skogkultur og andre tiltak', url: 'https://www.landbruksdirektoratet.no/nb/skogbruk/skogfond' },
};

// Seriøsitetskrav. gjelder(type) avgjør om kravet er forhåndsvalgt for oppdragstypen.
const HOGST = ['sluttavvirkning', 'tynning', 'lukkethogst']; const KULTUR = ['planting', 'suppleringsplanting', 'markberedning', 'ungskogpleie', 'stammekvisting', 'gjodsling', 'groftrensk', 'miljo'];
export const KRAV = {
  mva: { tekst: 'Registrert i Enhetsregisteret (org.nr). Prisen oppgis eks. mva.', gjelder: () => true },
  skatteattest: { tekst: 'Skatteattest for skatt og merverdiavgift, ikke eldre enn 6 måneder', gjelder: () => true },
  hms: { tekst: 'HMS-egenerklæring – arbeidet utføres etter arbeidsmiljøloven, med opplæring og verneutstyr', gjelder: () => true },
  forsikring: { tekst: 'Ansvarsforsikring som dekker skade på eiendom, vei, gjerder og tredjepart', gjelder: () => true },
  tariff: { tekst: 'Lønns- og arbeidsvilkår minst på nivå med allmenngjort eller landsomfattende tariffavtale – også hos underleverandører', gjelder: (t) => KULTUR.includes(t) || HOGST.includes(t) },
  pefc: { tekst: 'Arbeidet utføres etter Norsk PEFC Skogstandard (miljøhensyn, nøkkelbiotoper, kantsoner, kulturminner)', gjelder: (t) => t !== 'vei' },
  kompetanse: { tekst: 'Maskinførere med dokumentert kompetanse (f.eks. Skogbrukets kursinstitutt) og maskiner i forskriftsmessig stand', gjelder: (t) => HOGST.includes(t) || t === 'markberedning' || t === 'vei' },
  sha: { tekst: 'SHA-plan og koordinering etter byggherreforskriften før anleggsstart', gjelder: (t) => t === 'vei' },
  underleverandor: { tekst: 'Underleverandører brukes bare etter skriftlig godkjenning fra oppdragsgiver', gjelder: () => false },
  referanser: { tekst: 'Referanser fra tilsvarende oppdrag', gjelder: () => false },
};
// Prisform og enhet per oppdragstype (det utførerne vanligvis priser etter).
export const PRISFORM = {
  sluttavvirkning: { form: 'enhet', enhet: 'm³', tekst: 'Driftspris per m³ (hogst og utkjøring til velteplass)' },
  tynning: { form: 'enhet', enhet: 'm³', tekst: 'Driftspris per m³' },
  lukkethogst: { form: 'enhet', enhet: 'm³', tekst: 'Driftspris per m³' },
  planting: { form: 'enhet', enhet: 'plante', tekst: 'Pris per plante satt (planter levert av oppdragsgiver, eller oppgi pris med planter)' },
  suppleringsplanting: { form: 'enhet', enhet: 'plante', tekst: 'Pris per plante satt' },
  markberedning: { form: 'enhet', enhet: 'daa', tekst: 'Pris per daa' },
  ungskogpleie: { form: 'enhet', enhet: 'daa', tekst: 'Pris per daa' },
  stammekvisting: { form: 'enhet', enhet: 'tre', tekst: 'Pris per tre' },
  gjodsling: { form: 'enhet', enhet: 'daa', tekst: 'Pris per daa (spredning, eventuelt med gjødsel)' },
  groftrensk: { form: 'enhet', enhet: 'm', tekst: 'Pris per meter grøft' },
  vei: { form: 'fast', enhet: 'oppdrag', tekst: 'Fastpris for hele arbeidet etter byggeplan' },
  miljo: { form: 'fast', enhet: 'oppdrag', tekst: 'Fastpris' },
  annet: { form: 'fast', enhet: 'oppdrag', tekst: 'Fastpris' },
};
export const prisformFor = (type) => PRISFORM[type] || PRISFORM.annet;
export const STATUS = { utkast: { navn: 'Utkast', farge: '#8a8a85' }, sendt: { navn: 'Sendt – venter på svar', farge: '#2a78d6' }, tildelt: { navn: 'Tildelt', farge: '#0ca30c' }, avsluttet: { navn: 'Avsluttet uten tildeling', farge: '#d03b3b' } };
const iDag = () => new Date().toISOString().slice(0, 10);
const plussDager = (d, n) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

// Mengden prisen gjelder for (m³, daa, planter …) fra oppdraget.
export function mengdeFor(S, o, enhet, okonomi) {
  const s = sammendrag(S, o, okonomi);
  if (enhet === 'm³') return Math.round(s.m3 || 0);
  if (enhet === 'daa') return Math.round(s.areal * 10) / 10;
  if (enhet === 'plante' || enhet === 'tre') return s.antall || null;
  return 1;
}
// Ny tilbudsrunde for et oppdrag med fornuftige standardverdier.
export function nyForesporsel(S, o, { okonomi, idag = iDag(), kontakt = {} } = {}) {
  const pf = prisformFor(o.type); const ot = typeFor(o.type);
  const felt = ot.felt.filter((f) => o.felt?.[f.id] !== undefined && o.felt[f.id] !== '').map((f) => `${f.navn}: ${o.felt[f.id]}${f.enhet ? ` ${f.enhet}` : ''}`);
  return {
    status: 'utkast', laget: idag,
    tittel: o.tittel || ot.navn,
    beskrivelse: [`${ot.navn}.`, ...felt, o.merknad].filter(Boolean).join('\n'),
    prisform: pf.form, enhet: pf.enhet, mengde: mengdeFor(S, o, pf.enhet, okonomi),
    svarfrist: plussDager(idag, 14), vedstaaelse: 30,
    oppstart: o.periode?.fra || '', ferdig: o.periode?.til || '',
    betaling: 'Faktura etter utført og godkjent arbeid, 30 dagers betalingsfrist. Fakturaen skal spesifisere bestand, areal og mengde (kan belastes skogfond).',
    befaring: 'Befaring etter avtale med oppdragsgiver.',
    krav: Object.entries(KRAV).filter(([, k]) => k.gjelder(o.type)).map(([id]) => id),
    kontakt: { navn: kontakt.navn || '', telefon: kontakt.telefon || '', epost: kontakt.epost || '' },
    mottakere: [], svar: [], valgt: null,
  };
}
// Det utførerne ser (lenken): uten interne felt, nøkler eller andre utføreres navn. Kartet er bestandsgrensene i lon/lat.
export function offentligForesporsel(S, o, f, { okonomi, tiltakNavn = (t) => t } = {}) {
  const ls = linjer(S, o); const s = sammendrag(S, o, okonomi);
  const avrund = (g) => JSON.parse(JSON.stringify(g, (k, v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v)));
  return {
    v: 1, nr: o.nr, tittel: f.tittel, type: o.type, typeNavn: typeFor(o.type).navn, beskrivelse: f.beskrivelse,
    sted: [S.eiendom?.navn, S.eiendom?.kommune].filter(Boolean).join(', '),
    omfang: { bestand: ls.map(({ bestand: b, tiltak: t }) => ({ nr: b.nr, tiltak: tiltakNavn(t.type), aar: t.aar, areal: Math.round((t.arealDaa ?? b.areal ?? 0) * 10) / 10, treslag: b.treslag || '', bonitet: b.bonitet ?? '', alder: b.alder ?? '', m3: Math.round(okonomi?.({ ...t, bestand: b })?.m3 || 0) })), areal: Math.round(s.areal * 10) / 10, m3: Math.round(s.m3 || 0), antall: s.antall || null },
    kart: ls.filter((l) => l.tiltak.geometri || l.bestand.geometri).map(({ bestand: b, tiltak: t }) => ({ nr: b.nr, geometri: avrund(t.geometri || b.geometri) })),
    prisform: f.prisform, enhet: f.enhet, mengde: f.mengde, prisTekst: prisformFor(o.type).tekst,
    svarfrist: f.svarfrist, vedstaaelse: f.vedstaaelse, oppstart: f.oppstart, ferdig: f.ferdig,
    betaling: f.betaling, befaring: f.befaring,
    krav: f.krav.filter((id) => KRAV[id]).map((id) => ({ id, tekst: KRAV[id].tekst })),
    kontakt: f.kontakt,
  };
}
// Mangler før forespørselen kan sendes.
export function mangler(f) {
  const m = [];
  if (!f.mottakere.length) m.push('minst én mottaker');
  if (!f.svarfrist) m.push('svarfrist');
  if (!f.kontakt?.navn || !(f.kontakt?.telefon || f.kontakt?.epost)) m.push('kontaktperson med telefon eller e-post');
  if (f.prisform === 'enhet' && !f.mengde) m.push('mengde');
  return m;
}
// Totalpris for et svar (eks. mva).
export const totalFor = (f, s) => (s.prisform === 'enhet' || (f.prisform === 'enhet' && s.enhetspris != null) ? (Number(s.enhetspris) || 0) * (Number(f.mengde) || 0) : Number(s.pris) || 0);
// Sammenligning: totalpris, pris per daa, periode, oppfylte krav. Billigste fullstendige tilbud markeres.
export function sammenlign(f, arealDaa = null) {
  const rader = (f.svar || []).map((s) => {
    const m = f.mottakere.find((x) => x.id === s.mottakerId) || { navn: s.firma || 'Ukjent' };
    const total = totalFor(f, s); const kravOk = f.krav.filter((id) => s.krav?.[id]).length;
    const etterFrist = f.svarfrist && s.mottatt && s.mottatt.slice(0, 10) > f.svarfrist;
    const gyldig = s.gyldigTil ? s.gyldigTil >= iDag() : true;
    return { ...s, navn: m.firma || m.navn, total, perDaa: arealDaa ? Math.round(total / arealDaa) : null, kravOk, kravAlle: kravOk === f.krav.length, etterFrist, gyldig };
  });
  const fulle = rader.filter((r) => r.kravAlle && r.total > 0 && r.gyldig);
  const best = fulle.sort((a, b) => a.total - b.total)[0] || null;
  return rader.map((r) => ({ ...r, billigst: best && r.mottakerId === best.mottakerId })).sort((a, b) => (a.total || Infinity) - (b.total || Infinity));
}
// Tildeling: oppdraget får utfører, avtalt pris og status «bestilt».
export function tildel(o, f, mottakerId, { idag = iDag() } = {}) {
  const s = f.svar.find((x) => x.mottakerId === mottakerId); const m = f.mottakere.find((x) => x.id === mottakerId);
  if (!s || !m) return null;
  f.valgt = mottakerId; f.status = 'tildelt'; f.tildelt = idag;
  o.utforer = { navn: s.firma || m.firma || m.navn, kontakt: s.kontaktperson || m.navn, telefon: s.telefon || m.telefon || '', epost: s.epost || m.epost || '', orgnr: s.orgnr || '' };
  o.avtale = { pris: totalFor(f, s), enhetspris: s.enhetspris ?? null, enhet: f.enhet, prisform: f.prisform, gyldigTil: s.gyldigTil || null, tilbudMottatt: s.mottatt || null, tildelt: idag };
  o.periode = { fra: s.oppstart || o.periode?.fra || '', til: s.ferdig || o.periode?.til || '' };
  if (o.status === 'utkast') o.status = 'bestilt';
  return o;
}

// ---------- meldinger (e-post / SMS) ----------
const fristTekst = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
export function foresporselTekst(pub, mottaker, lenke) {
  return { emne: `Forespørsel om tilbud: ${pub.tittel} (${pub.nr})`, tekst: `Hei ${mottaker.navn || ''},\n\nVi ber om tilbud på ${pub.typeNavn.toLowerCase()}${pub.sted ? ` på ${pub.sted}` : ''}: ${pub.omfang.bestand.length} bestand, ${pub.omfang.areal} daa${pub.omfang.m3 ? `, ca. ${pub.omfang.m3} m³` : ''}.\n\nAlt om oppdraget (kart, omfang, krav og frister) og skjema for tilbudet finner du her:\n${lenke}\n\nSvarfrist: ${fristTekst(pub.svarfrist)}.\n\nMed vennlig hilsen\n${pub.kontakt?.navn || ''}${pub.kontakt?.telefon ? `\n${pub.kontakt.telefon}` : ''}` };
}
export function akseptTekst(o, f, s, m) {
  return { emne: `Tilbudet ditt på ${f.tittel} (${o.nr}) er akseptert`, tekst: `Hei ${s.kontaktperson || m.navn || ''},\n\nTakk for tilbudet. Vi aksepterer tilbudet på ${Math.round(totalFor(f, s)).toLocaleString('nb-NO')} kr eks. mva${f.prisform === 'enhet' ? ` (${s.enhetspris} kr per ${f.enhet})` : ''}, med oppstart ${fristTekst(s.oppstart) || 'etter avtale'} og ferdig ${fristTekst(s.ferdig) || 'etter avtale'}.\n\nArbeidsordre med kart og sjekkliste kommer i egen melding. Ta kontakt for befaring før oppstart.\n\nMed vennlig hilsen\n${f.kontakt?.navn || ''}${f.kontakt?.telefon ? `\n${f.kontakt.telefon}` : ''}` };
}
export function avslagTekst(o, f, m) {
  return { emne: `Tilbud på ${f.tittel} (${o.nr})`, tekst: `Hei ${m.navn || ''},\n\nTakk for tilbudet. Denne gangen har vi valgt en annen utfører. Vi tar gjerne kontakt ved senere oppdrag.\n\nMed vennlig hilsen\n${f.kontakt?.navn || ''}` };
}
export const mailto = (epost, { emne, tekst }) => `mailto:${encodeURIComponent(epost || '')}?subject=${encodeURIComponent(emne)}&body=${encodeURIComponent(tekst)}`;
export const smsLenke = (tlf, tekst) => `sms:${String(tlf || '').replace(/[^\d+]/g, '')}?body=${encodeURIComponent(tekst)}`;
