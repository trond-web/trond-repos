// PEFC: Norsk PEFC Skogstandard (PEFC N 02:2022, gjeldende fra 1. mars 2023).
// Kravpunktene, tabellene og grenseverdiene her er hentet fra standardteksten. Modulen kontrollerer det som
// kan kontrolleres med planens data, og gir sjekklister og dokumentasjon for resten. Ingen DOM – testes i Node.
import { geoTilUtm, punktIGeometri } from './proj.js';
import { startTilstand, laavesteHogstalder, beregnetHogstklasse } from './model.js';

export const STANDARD = { kode: 'PEFC N 02:2022', navn: 'Norsk PEFC Skogstandard', gjelderFra: '2023-03-01' };

const L = {
  artskart: { navn: 'Artskart', url: 'https://artskart.artsdatabanken.no/' },
  naturbase: { navn: 'Naturbase', url: 'https://geocortex01.miljodirektoratet.no/Html5Viewer/?viewer=naturbase' },
  kilden: { navn: 'Kilden (NIBIO)', url: 'https://kilden.nibio.no/' },
  kulturminnesok: { navn: 'Kulturminnesøk', url: 'https://www.kulturminnesok.no/' },
  nve: { navn: 'NVE faresonekart', url: 'https://temakart.nve.no/tema/skredfaresoner' },
  standard: { navn: 'Standarden (PDF)', url: 'https://cdn.pefc.org/pefc.no/media/2023-04/191010dd-81a3-41ec-9aeb-76a67effda24/b877f9c0-47fa-5a50-b9ab-b82536994907.pdf' },
  friluft: { navn: 'Friluftslivsområder (Naturbase)', url: 'https://geocortex01.miljodirektoratet.no/Html5Viewer/?viewer=naturbase' },
};

export const TEMA = ['Forvalteransvar og planlegging', 'Hogst og skogbrukstiltak', 'Særskilte miljøverdier'];

// Kort, presis gjengivelse av hvert kravpunkt. «auto» betyr at appen kontrollerer deler av kravet med planens data.
export const KRAVPUNKTER = [
  { nr: 1, tema: 0, tittel: 'Forvalteransvar og skogsertifiseringsavtale', kort: 'Skogeier er ansvarlig for at planlegging og gjennomføring følger lov og standard, også når arbeidet settes bort. Underskrevet skogsertifiseringsavtale må foreligge før tømmersalg. Skogeier skal kjenne skogens kulturminner og miljøverdier, og skaffe kompetanse ved behov.' },
  { nr: 2, tema: 0, tittel: 'Arbeidskraft og sikkerhet', kort: 'Den som utfører arbeid skal ha kompetanse innen arbeidsteknikk, utstyr og HMS. Bestilte tiltak skal normalt avtales skriftlig og følge HMS- og tarifflover. Likestilling skal fremmes.' },
  { nr: 3, tema: 0, auto: true, tittel: 'Planlegging i skogbruket', kort: 'Eiendommen skal ha skogbruksplan med miljøregistreringer (revideres hvert 15–20 år) eller miljøplan. Planen skal vise eiendomsgrenser, veinett, bonitet, treslag, alder, volum, restriksjoner, nøkkelbiotoper og mulig hogstkvantum for 30 år. Ved operativ planlegging skal miljødatabaser, rovfugl/tiurleik, friluftsliv og kulturminner konsulteres, og NVEs faresonekart ved drift i bratt terreng.', lenker: [L.artskart, L.naturbase, L.kilden, L.kulturminnesok, L.nve] },
  { nr: 4, tema: 0, auto: true, tittel: 'Landskapsplan', kort: 'Sammenhengende teiger over 10 000 daa produktiv skog skal ha landskapsplan som revideres minst hvert 15. år, med avvirknings- og investeringsstrategi og mål for økt lukket hogst. Minst 5 % av skogen skal avsettes som BVO.' },
  { nr: 5, tema: 0, auto: true, tittel: 'Skogsveger', kort: 'Hensyn til friluftsliv, kulturminner, naturmangfold og fare for flom og skred. Ikke vei i nøkkelbiotoper eller BVO uten avklaring og erstatningsareal. Ingen hindring for vannløp og fiskevandring. Vei over registrerte miljøverdier skal unngås og dokumenteres.' },
  { nr: 6, tema: 0, auto: true, tittel: 'Friluftsliv', kort: 'I viktige friluftslivsområder skal friluftslivet vektlegges ved valg av hogstform og flatestørrelse, og kjøreskader på stier skal unngås. Opplevelseskvaliteter langs stier og skiløyper ivaretas. Skilting der hogst berører preparerte løyper.', lenker: [L.friluft] },
  { nr: 7, tema: 0, tittel: 'Samiske rettigheter', kort: 'Reindriftens rettigheter respekteres. Varsle reindriftsdistriktet minst tre uker før tiltak som samlet overstiger 100 daa i tilstøtende områder samme år, og alltid ved gjødsling eller markberedning i særlig viktige reinbeiteområder.' },
  { nr: 8, tema: 0, auto: true, tittel: 'Bevaring av skogarealet', kort: 'Høyst 5 % av skogarealet kan omdisponeres irreversibelt (skogbrukets infrastruktur og friluftsanlegg regnes ikke med). Nøkkelbiotoper, BVO, truede naturtyper, myr, kulturminner og samiske områder skal ikke omdisponeres.' },
  { nr: 9, tema: 0, tittel: 'Genbevaring – skogstrær', kort: 'Naturlig genetisk variasjon ivaretas gjennom foredling og naturlig foryngelse. Genmodifisert plantemateriale brukes ikke. Forskrift om skogfrø og skogplanter følges.' },
  { nr: 10, tema: 0, tittel: 'Åpenhet om miljøinformasjon', kort: 'Miljøinformasjon om eiendommen skal utleveres senest innen en måned etter krav (miljøinformasjonsloven). Henvendelser fra interessegrupper skal møtes med dialog.' },
  { nr: 11, tema: 1, auto: true, tittel: 'Hogst', kort: 'Mål om økt andel lukket hogst og småflatehogst. I grandominert skog skal lukket hogst brukes der det ligger til rette. Lukket hogst i fjellskog, edellauvskog, sumpskog og myrskog. Flatestørrelse tilpasses landskapet. Hogstavfall ryddes fra bekker, vann, stier og løyper straks etter hogst.' },
  { nr: 12, tema: 1, tittel: 'Avfall og forurensning', kort: 'Alt avfall fjernes etter arbeid, og farlig avfall leveres godkjent mottak. Utslipp tettes straks, og større utslipp varsles. Drivstoff lagres i godkjente, låsbare tanker, helst minst 50 m fra drikkevann.' },
  { nr: 13, tema: 1, auto: true, tittel: 'Livsløpstrær og døde trær', kort: 'Minst 10 livsløpstrær per hektar avvirket areal, med minst 2 av dominerende treslag, prioritert gamle, grove og spesielle trær. Livsløpstrærne skal kartfestes. Død ved av lauv og furu (død over 1 år) og gran (død over 5 år) spares.' },
  { nr: 14, tema: 1, tittel: 'Terrengtransport', kort: 'Unngå kjøreskader som skjemmer, hindrer ferdsel eller gir erosjon. Ikke kjør i nøkkelbiotoper hvis det skader verdiene. Unngå stier og løyper som kjøretrasé. Utbedre spor straks fuktigheten tillater det. Unngå kjøring i kantsoner.' },
  { nr: 15, tema: 1, auto: true, tittel: 'Langsiktig virkesproduksjon', kort: 'Nedre aldersgrense og vanlig omløpstid etter bonitet (tabell). Hogst under nedre grense skal begrunnes og dokumenteres. Foryngelsesmetode vurderes og dokumenteres. Planting eller såing senest innen 3 år. Behov for ungskogpleie skal vurderes, og ungskogfelt følges opp.' },
  { nr: 16, tema: 1, auto: true, tittel: 'Markberedning', kort: 'Ikke i myr-, sump- og kildeskog, kalkskog, høgstaudeskog, kantsoner, BVO eller nøkkelbiotoper, nærmere enn 5 m fra bekk eller kulturminne, eller nærmere enn 2,5 m fra mye brukte stier. Flekkmarkberedning foretrekkes. Maksimal avflekking etter bonitet, og brudd i stripene.' },
  { nr: 17, tema: 1, tittel: 'Treslagsfordeling', kort: 'Treslag tilpasses voksested og klima. Betydelig lauvtreinnslag tilstrebes, i egne bestand, grupper og som enkelttrær. Blanding av gran og furu der det ligger til rette. Sjeldne norske treslag ivaretas.' },
  { nr: 18, tema: 1, tittel: 'Bruk av plantevernmidler', kort: 'Sprøyting unngås så langt mulig (integrert plantevern). Ikke på vegetasjon over 2 m, og ikke nærmere enn 25 m fra vann, myr, nøkkelbiotoper, BVO og truede naturtyper. Krever autorisasjonsbevis, merking og dokumentasjon.' },
  { nr: 19, tema: 1, auto: true, tittel: 'Gjødsling og næringsbalanse', kort: 'Bare der det gir vesentlig økt produksjon, på egnede vegetasjonstyper. Gjødslingsfri sone 25 m (50 m ved lav presisjon) mot vann, bekker, myr, nøkkelbiotoper og BVO. Ikke før snøsmeltingen er over, og ikke etter utgangen av august. Dokumenteres.' },
  { nr: 20, tema: 1, auto: true, tittel: 'Bruk av utenlandske treslag', kort: 'Norske treslag ved foryngelse. Unntak bare for sitkagran, lutzgran og lerk, på tidligere tilplantet areal langs kysten fra Lindesnes til Troms, med forhåndsgodkjenning. Spredning skal kontrolleres og fjernes minst hvert 5. år.' },
  { nr: 21, tema: 1, tittel: 'Påskoging og treslagsskifte', kort: 'Bare der det tidligere er gjort vellykket i større omfang langs kysten. Ikke i BVO, truede eller utvalgte naturtyper, sumpskog, kalkskog, kantsoner m.m. Artskart og Naturbase konsulteres først. Minst 20 % stedegne treslag.', lenker: [L.artskart, L.naturbase] },
  { nr: 22, tema: 2, auto: true, tittel: 'Nøkkelbiotoper', kort: 'Nøkkelbiotoper skal kartfestes (MiS) på eiendommer over 50 daa produktivt areal før hogst, og revisjon vurderes hvert 15. år. De settes av urørt eller skjøttes. Før hogst konsulteres Artskart, Narinbase og Naturbase. Truede arter, truede naturtyper, A/B-naturtyper og naturtyper med sentral økosystemfunksjon skal vurderes av skogbiologisk kompetanse.', lenker: [L.artskart, L.naturbase, L.kilden] },
  { nr: 23, tema: 2, auto: true, tittel: 'Biologisk viktige områder', kort: 'Eiendommer over 1500 daa produktiv skog skal avsette og kartfeste minst 5 % som biologisk viktige områder (BVO). BVO settes av urørt eller skjøttes for å bevare verdiene.' },
  { nr: 24, tema: 2, auto: true, tittel: 'Hensyn til rovfugler og ugler', kort: 'Sjekk kjente reir før hogst. Hensynsområde uten flatehogst og buffersone uten skogbruksforstyrrelse i hekketiden, avhengig av art (tabell). Gjelder også markberedning og motormanuell ungskogpleie i buffersonen.' },
  { nr: 25, tema: 2, auto: true, tittel: 'Hensyn til tiurleik', kort: 'Sjekk kjente leiker før hogst. Leiken forvaltes slik at den fungerer lengst mulig, og hogst planlegges sammen med skogbiolog. Unngå drift i april–mai. Leiken skal ikke bli en «øy».' },
  { nr: 26, tema: 2, auto: true, tittel: 'Hensyn til andre hekkende fugler', kort: 'I hekketiden (mai–juli) unngås drift i gjengrodd kulturmark, kantsoner, myr- og sumpskog og lauvdominert skog, særlig eldre (hogstklasse IV–V), flersjiktet lauvskog. Særlige hensyn til revirhevdende arter som hvitryggspett, dvergspurv, hortulan og trelerke.' },
  { nr: 27, tema: 2, auto: true, tittel: 'Vannbeskyttelse', kort: 'Flersjiktet kantsone langs vann og vassdrag, med utgangspunkt i 10–15 m. Bredere (25–30 m) i edellauv-, høgstaude-, storbregne- og sumpskog, smalere ned mot 5 m i ensjiktet furuskog og langs 1–2 m brede bekker. Kantsonen skal normalt stå urørt, og hogst i den dokumenteres.' },
  { nr: 28, tema: 2, auto: true, tittel: 'Myr og sumpskog', kort: 'Ingen nygrøfting. Lukket hogst eller småflatehogst i sump- og myrskog og mot fastmark. Flersjiktet kantsone mot myr (gjelder ikke myrer under 2 daa). Grøftevann ledes ikke rett i vassdrag.' },
  { nr: 29, tema: 2, auto: true, tittel: 'Brannpåvirket skog', kort: 'Ved brann i eldre skog over 5 daa settes 5 daa av den mest verdifulle brente skogen urørt i 10 år (hele arealet om under 5 daa). Arealet vurderes som nøkkelbiotop.' },
  { nr: 30, tema: 2, auto: true, tittel: 'Kulturminner og kulturmiljøer', kort: 'Sjekk Askeladden/Kulturminnesøk. Ikke kjør med lassbærer eller markbered nærmere enn 5 m fra kulturminner (nulltoleranse for fredete), eller innenfor større sikringssone. Unngå livsløpstrær i sikringssonen. Hogst i kulturmiljøer avklares med kulturminnemyndigheten.', lenker: [L.kulturminnesok] },
];

// K15: vanlig omløpstid og nedre aldersgrense for flatehogst/frøtrestilling (totalalder) etter bonitet H40.
export const ALDERSTABELL = [
  { bonitet: 23, omlop: 60, nedre: 45 }, { bonitet: 20, omlop: 70, nedre: 50 }, { bonitet: 17, omlop: 80, nedre: 60 },
  { bonitet: 14, omlop: 90, nedre: 70 }, { bonitet: 11, omlop: 100, nedre: 80 }, { bonitet: 8, omlop: 110, nedre: 85 }, { bonitet: 6, omlop: 120, nedre: 95 },
];
export function pefcAlder(bonitet) {
  if (!bonitet) return null;
  // «23 +» dekker 23 og høyere; ellers nærmeste bonitet i tabellen.
  if (bonitet >= 23) return ALDERSTABELL[0];
  return ALDERSTABELL.reduce((a, b) => (Math.abs(b.bonitet - bonitet) < Math.abs(a.bonitet - bonitet) ? b : a));
}

// K24: hensynsområde (ingen flatehogst/frøtrestilling) og buffersone uten skogbruksforstyrrelse i perioden.
// hensynAar: hvor mange år etter siste kjente hekking hensynet gjelder (null = uansett).
export const ROVFUGLER = {
  hubro: { navn: 'Hubro', hensyn: 100, buffer: 400, periode: ['01-01', '07-31'], hensynAar: null },
  kongeorn: { navn: 'Kongeørn', hensyn: 100, buffer: 400, periode: ['01-01', '07-31'], hensynAar: null },
  havorn: { navn: 'Havørn', hensyn: 100, buffer: 400, periode: ['01-01', '07-31'], hensynAar: null },
  honsehauk: { navn: 'Hønsehauk', hensyn: 80, buffer: 200, periode: ['03-01', '07-31'], hensynAar: 10, merknad: 'Alternativt lukket hogst 40–100 m som bevarer sjiktning og hindrer innsyn.' },
  vepsevak: { navn: 'Vepsevåk', hensyn: 80, buffer: 200, periode: ['03-01', '07-31'], hensynAar: 10, merknad: 'Alternativt lukket hogst 40–100 m som bevarer sjiktning og hindrer innsyn.' },
  fiskeorn: { navn: 'Fiskeørn', hensyn: 0, buffer: 200, periode: ['03-01', '07-31'], hensynAar: null, merknad: 'Kan hogge inntil reirtreet. Minst ett stabilt, grovt furutre med flat krone gjensettes.' },
  vandrefalk: { navn: 'Vandrefalk', hensyn: 50, buffer: 200, periode: ['03-01', '07-31'], hensynAar: 5 },
  fjellvak: { navn: 'Fjellvåk', hensyn: 50, buffer: 200, periode: ['03-01', '07-31'], hensynAar: 5 },
  slagugle: { navn: 'Slagugle', hensyn: 50, buffer: 200, periode: ['03-01', '07-31'], hensynAar: 5 },
  lappugle: { navn: 'Lappugle', hensyn: 50, buffer: 200, periode: ['03-01', '07-31'], hensynAar: 5 },
  musvak: { navn: 'Musvåk', hensyn: 25, buffer: 50, periode: ['03-01', '07-31'], hensynAar: 5 },
  lerkefalk: { navn: 'Lerkefalk', hensyn: 25, buffer: 50, periode: ['03-01', '07-31'], hensynAar: 5 },
};
const dato = (mmdd) => { const [m, d] = mmdd.split('-').map(Number); return `${d}. ${['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'][m - 1]}`; };
export const periodeTekst = (p) => `${dato(p[0])}–${dato(p[1])}`;

// Miljøobjekter som kan registreres eller hentes fra offentlige registre.
export const OBJEKTTYPER = {
  noekkelbiotop: { navn: 'Nøkkelbiotop', geom: 'flate', farge: '#d03b3b', krav: [22] },
  bvo: { navn: 'Biologisk viktig område (BVO)', geom: 'flate', farge: '#e0567a', krav: [23] },
  vern: { navn: 'Verneområde', geom: 'flate', farge: '#8b2fc9', krav: [3, 11] },
  naturtype: { navn: 'Viktig naturtype', geom: 'flate', farge: '#eb6834', krav: [3, 22] },
  artsomrade: { navn: 'Funksjonsområde for art', geom: 'flate', farge: '#c98500', krav: [3, 22] },
  rovfuglreir: { navn: 'Rovfugl-/uglereir', geom: 'punkt', farge: '#7a3e00', krav: [24] },
  tiurleik: { navn: 'Tiurleik', geom: 'flate', farge: '#5b4bb7', krav: [25] },
  kulturminne: { navn: 'Kulturminne', geom: 'flate', farge: '#6b5b45', krav: [30] },
  vann: { navn: 'Bekk / elv / vann', geom: 'linje', farge: '#2a78d6', krav: [27, 16, 19] },
  myr: { navn: 'Myr / sumpskog', geom: 'flate', farge: '#4f8f8a', krav: [28] },
  sti: { navn: 'Sti / skiløype', geom: 'linje', farge: '#a0522d', krav: [6, 14] },
  friluftsomrade: { navn: 'Viktig friluftslivsområde', geom: 'flate', farge: '#2f9e62', krav: [6] },
  livslopstre: { navn: 'Livsløpstre', geom: 'punkt', farge: '#1f6b4a', krav: [13] },
  brann: { navn: 'Brannflate', geom: 'flate', farge: '#b5410e', krav: [29] },
  utenlandsk: { navn: 'Utenlandske treslag', geom: 'flate', farge: '#9c6b00', krav: [20] },
};

export function tomPefc() {
  return { objekter: [], kravstatus: {}, klareringer: {}, eiendom: { miljoregistreringAar: null, omdisponertDaa: null, landskapsplanAar: null, spredningKontrollAar: null }, hentet: null };
}

// ---------- geometri i meter (UTM33) ----------
const M = ([lon, lat]) => geoTilUtm(lon, lat, 33);
function ringerAv(g) {
  if (!g) return [];
  if (g.type === 'Polygon') return g.coordinates;
  if (g.type === 'MultiPolygon') return g.coordinates.flat();
  if (g.type === 'LineString') return [g.coordinates];
  if (g.type === 'MultiLineString') return g.coordinates;
  if (g.type === 'Point') return [[g.coordinates]];
  return [];
}
const erFlate = (g) => g && /Polygon/.test(g.type);
function segAvstand(p, a, b) {
  const dx = b[0] - a[0]; const dy = b[1] - a[1];
  const t = dx || dy ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function segKrysser(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}
// Omregnede ringer og omsluttende rektangel mellomlagres per geometriobjekt.
const cache = new WeakMap();
function iMeter(g) {
  let c = cache.get(g);
  if (!c) {
    const ringer = ringerAv(g).map((r) => r.map(M));
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const r of ringer) for (const [x, y] of r) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    c = { ringer, bb: [x0, y0, x1, y1] };
    cache.set(g, c);
  }
  return c;
}
// Minste avstand i meter mellom to geometrier (0 når de overlapper eller den ene ligger inni den andre).
// Med «maks» returneres Infinity raskt når rektanglene ligger lenger fra hverandre enn maks.
export function avstand(g1, g2, maks = Infinity) {
  if (!g1 || !g2) return Infinity;
  const c1 = iMeter(g1); const c2 = iMeter(g2);
  const gap = Math.max(c2.bb[0] - c1.bb[2], c1.bb[0] - c2.bb[2], c2.bb[1] - c1.bb[3], c1.bb[1] - c2.bb[3], 0);
  if (gap > maks) return Infinity;
  const r1 = c1.ringer; const r2 = c2.ringer;
  const pkt1 = ringerAv(g1).flat(); const pkt2 = ringerAv(g2).flat();
  if (erFlate(g2) && pkt1.some((p) => punktIGeometri(p, g2))) return 0;
  if (erFlate(g1) && pkt2.some((p) => punktIGeometri(p, g1))) return 0;
  let min = Infinity;
  for (const ra of r1) {
    for (const rb of r2) {
      for (let i = 0; i < ra.length; i++) {
        const a0 = ra[i]; const a1 = ra[i + 1] || ra[i];
        for (let j = 0; j < rb.length; j++) {
          const b0 = rb[j]; const b1 = rb[j + 1] || rb[j];
          if (ra.length > 1 && rb.length > 1 && i < ra.length - 1 && j < rb.length - 1 && segKrysser(a0, a1, b0, b1)) return 0;
          min = Math.min(min, segAvstand(a0, b0, b1), segAvstand(b0, a0, a1));
        }
      }
    }
  }
  return min;
}
export const overlapper = (g1, g2) => avstand(g1, g2, 0) === 0;

// Omtrentlig areal i daa for en flate (planar i UTM33).
export function arealDaa(g) {
  if (!erFlate(g)) return 0;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let sum = 0;
  for (const p of polys) {
    p.forEach((ring, i) => {
      const m = ring.map(M); let a = 0;
      for (let k = 0; k < m.length - 1; k++) a += m[k][0] * m[k + 1][1] - m[k + 1][0] * m[k][1];
      sum += (i === 0 ? 1 : -1) * Math.abs(a / 2);
    });
  }
  return sum / 1000;
}

// ---------- kontroller ----------
const HOGST = ['sluttavvirkning', 'tynning', 'lukkethogst'];
const FORSTYRRENDE = ['sluttavvirkning', 'tynning', 'lukkethogst', 'markberedning', 'ungskogpleie'];

function alderIAar(b, aar, iAar) {
  const s = startTilstand(b);
  return s.alder + (aar - iAar);
}

// Funn: { krav, nivaa: 'avvik'|'varsel'|'ok'|'info', tittel, tekst, bestandId?, tiltakId?, objektId? }
export function kontroller(S, P = tomPefc(), { iAar = new Date().getFullYear() } = {}) {
  const funn = [];
  const leggTil = (krav, nivaa, tittel, tekst, ekstra = {}) => funn.push({ krav, nivaa, tittel, tekst, ...ekstra });
  const inn = S.innstillinger;
  const obj = (type) => (P.objekter || []).filter((o) => o.type === type && o.geometri);
  const produktiv = S.bestand.reduce((s, b) => s + (b.areal || 0), 0);
  const tiltak = S.bestand.flatMap((b) => (b.tiltak || []).map((t) => ({ t, b })));
  const planlagte = tiltak.filter(({ t }) => t.status !== 'utfort');
  const klarering = (t) => (P.klareringer || {})[t.id] || {};
  const navnB = (b) => `bestand ${b.nr}`;
  const fmt = (v, d = 0) => Number(v).toLocaleString('nb-NO', { maximumFractionDigits: d });

  // K3 Planlegging
  const takst = S.eiendom?.takstAar;
  if (takst && iAar - takst > 20) leggTil(3, 'avvik', 'Skogbruksplanen er eldre enn 20 år', `Takstår ${takst}. Planen skal revideres fortløpende eller hvert 15.–20. år.`);
  else if (takst && iAar - takst > 15) leggTil(3, 'varsel', 'Skogbruksplanen bør revideres snart', `Takstår ${takst}. Revisjonsintervallet er 15–20 år.`);
  const mangler = S.bestand.filter((b) => !b.bonitet || !b.treslag || (b.alder == null && b.volumDaa == null));
  if (mangler.length) leggTil(3, 'varsel', `${mangler.length} bestand mangler bonitet, treslag, alder eller volum`, 'Planen skal vise bonitet, treslag, alder og stående volum.', { bestandId: mangler[0].id });
  if (!S.eiendom?.grense) leggTil(3, 'varsel', 'Eiendomsgrensen mangler', 'Kartet skal vise eiendomsgrenser. Lag planen fra gnr/bnr eller importer grensen.');
  if (!(S.veier?.veier || []).length) leggTil(3, 'varsel', 'Veinettet er ikke registrert', 'Kartet skal vise veinettet i skogen. Hent veiene fra NVDB under Veier.');
  if (!P.hentet) leggTil(3, 'varsel', 'Offentlige miljødata er ikke hentet', 'Hent naturtyper, verneområder, artsområder, friluftsliv, nøkkelbiotoper og kulturminner for eiendommen.');

  // K4 Landskapsplan
  if (produktiv > 10000) {
    const lp = P.eiendom?.landskapsplanAar;
    if (!lp || iAar - lp > 15) leggTil(4, 'avvik', 'Landskapsplan mangler eller er utdatert', `${fmt(produktiv)} daa produktiv skog. Teiger over 10 000 daa skal ha landskapsplan, revidert minst hvert 15. år.`);
    else leggTil(4, 'ok', 'Landskapsplan foreligger', `Sist revidert ${lp}.`);
  }

  // K8 Omdisponering
  const omd = P.eiendom?.omdisponertDaa;
  if (omd != null && produktiv) {
    const andel = (omd / produktiv) * 100;
    leggTil(8, andel > 5 ? 'avvik' : 'ok', andel > 5 ? 'Mer enn 5 % av skogarealet er omdisponert' : 'Omdisponert areal er innenfor 5 %', `${fmt(omd, 1)} daa = ${fmt(andel, 1)} % av ${fmt(produktiv)} daa.`);
  }

  // K22 Nøkkelbiotoper: kartfesting og revisjon
  const nb = obj('noekkelbiotop'); const bvo = obj('bvo');
  const mr = P.eiendom?.miljoregistreringAar;
  if (produktiv > 50) {
    if (!nb.length && !mr) leggTil(22, 'avvik', 'Miljøregistrering (MiS) er ikke dokumentert', 'Eiendommer over 50 daa skal ha kartfestede nøkkelbiotoper før hogst. Hent MiS-data, eller registrer år for miljøregistreringen.');
    else if (mr && iAar - mr > 15) leggTil(22, 'varsel', 'Vurder revisjon av miljøregistreringen', `Registrert ${mr}. Behovet for revisjon skal vurderes hvert 15. år.`);
    else leggTil(22, 'ok', 'Nøkkelbiotoper er kartfestet', `${nb.length} nøkkelbiotoper${mr ? `, miljøregistrering ${mr}` : ''}.`);
  }

  // K23 BVO
  if (produktiv > 1500) {
    const bvoDaa = [...nb, ...bvo].reduce((s, o) => s + arealDaa(o.geometri), 0);
    const andel = (bvoDaa / produktiv) * 100;
    leggTil(23, andel >= 5 ? 'ok' : 'avvik', andel >= 5 ? 'Minst 5 % er avsatt som BVO' : 'Under 5 % er avsatt som biologisk viktige områder', `${fmt(bvoDaa, 1)} daa nøkkelbiotoper og BVO = ${fmt(andel, 1)} % av ${fmt(produktiv)} daa. Kravet er minst 5 %.`);
  }

  // K20 Utenlandske treslag
  const utl = obj('utenlandsk');
  if (utl.length) {
    const k = P.eiendom?.spredningKontrollAar;
    leggTil(20, !k || iAar - k > 5 ? 'varsel' : 'ok', !k || iAar - k > 5 ? 'Spredning av utenlandske treslag skal kontrolleres' : 'Spredningskontroll er gjennomført', `${utl.length} bestand med utenlandske treslag. Spredning kontrolleres og fjernes minst hvert 5. år${k ? ` (sist ${k})` : ''}.`);
  }

  // K29 Brann
  for (const o of obj('brann')) {
    const a = arealDaa(o.geometri);
    leggTil(29, 'info', `Brannflate: ${o.navn || 'uten navn'}`, `${fmt(a, 1)} daa. ${a > 5 ? '5 daa av den mest verdifulle brente skogen' : 'Hele arealet'} settes urørt i 10 år, og vurderes som nøkkelbiotop.${a > 50 ? ' Over 50 daa: avsetningen skal vurderes av skogbiologisk kompetanse.' : ''}`, { objektId: o.id });
  }

  // K5 Skogsveier: planlagte veier
  for (const v of (S.veier?.veier || []).filter((x) => x.status !== 'eksisterende' && x.geometri)) {
    const verdier = [...nb, ...bvo].filter((o) => overlapper(v.geometri, o.geometri));
    if (verdier.length) leggTil(5, 'avvik', `Planlagt vei ${v.navn || ''} går gjennom nøkkelbiotop eller BVO`, 'Ikke tillatt uten avklaring og erstatningsareal av minst like god kvalitet.', { objektId: verdier[0].id });
    const andre = [...obj('naturtype'), ...obj('artsomrade'), ...obj('vern'), ...obj('kulturminne')].filter((o) => overlapper(v.geometri, o.geometri));
    if (andre.length) leggTil(5, 'varsel', `Planlagt vei ${v.navn || ''} berører registrerte miljøverdier`, `${andre.map((o) => o.navn || OBJEKTTYPER[o.type].navn).slice(0, 3).join(', ')}. Skogeier skal dokumentere at veibygging over slike områder unngås.`);
    if (obj('vann').some((o) => overlapper(v.geometri, o.geometri))) leggTil(5, 'varsel', `Planlagt vei ${v.navn || ''} krysser vann eller bekk`, 'Det skal ikke dannes hindringer for naturlige vannløp og fiskevandring.');
  }

  // Bestandsvise kontroller
  for (const b of S.bestand) {
    if (!b.geometri) continue;
    const egne = planlagte.filter((x) => x.b === b).map((x) => x.t);
    const hogst = egne.filter((t) => HOGST.includes(t.type));
    const slutt = egne.filter((t) => t.type === 'sluttavvirkning');
    const naer = (type, m) => obj(type).filter((o) => avstand(b.geometri, o.geometri, m) <= m);
    const s = startTilstand(b);
    const hk = b.hogstklasse || beregnetHogstklasse(s.alder, laavesteHogstalder(b, inn), s.volumDaa);

    // K15 minstealder
    for (const t of slutt) {
      const tab = pefcAlder(b.bonitet);
      if (!tab) continue;
      const alder = alderIAar(b, t.aar, iAar);
      if (alder < tab.nedre) {
        const k = klarering(t);
        leggTil(15, k.begrunnelseMinstealder ? 'ok' : 'avvik', `Sluttavvirkning i ${navnB(b)} under nedre aldersgrense`, `Alder ca. ${Math.round(alder)} år i ${t.aar}, nedre grense ${tab.nedre} år for bonitet ${b.bonitet} (vanlig omløpstid ${tab.omlop} år).${k.begrunnelseMinstealder ? ` Begrunnelse: ${k.begrunnelseMinstealder}` : ' Hogsten skal begrunnes og dokumenteres i klareringen.'}`, { bestandId: b.id, tiltakId: t.id });
      }
    }
    // K15 foryngelse etter utført hogst
    for (const t of (b.tiltak || []).filter((x) => x.type === 'sluttavvirkning' && x.status === 'utfort')) {
      const hogstAar = Number((t.utfortDato || '').slice(0, 4)) || t.aar;
      const kult = (b.tiltak || []).filter((x) => ['planting', 'suppleringsplanting'].includes(x.type) && x.aar >= hogstAar);
      const naturlig = klarering(t).foryngelse === 'naturlig';
      if (naturlig) continue;
      if (!kult.length) leggTil(15, iAar > hogstAar + 3 ? 'avvik' : 'varsel', `Foryngelse mangler etter hogst i ${navnB(b)}`, `Hogd ${hogstAar}. Planting eller såing skal skje senest innen 3 år (${hogstAar + 3}), eller naturlig foryngelse dokumenteres.`, { bestandId: b.id });
      else if (!kult.some((x) => x.status === 'utfort') && iAar > hogstAar + 3) leggTil(15, 'avvik', `Planting i ${navnB(b)} er ikke utført innen 3 år`, `Hogd ${hogstAar}, fristen var ${hogstAar + 3}.`, { bestandId: b.id });
    }
    // K15 ungskogpleie vurdert
    if (hk === 2 && !(b.tiltak || []).some((t) => t.type === 'ungskogpleie') && !(P.kravstatus?.[`ungskog-${b.id}`])) {
      leggTil(15, 'varsel', `Behov for ungskogpleie i ${navnB(b)} er ikke vurdert`, 'Behovet skal vurderes og ungskogfelt følges opp. Legg inn ungskogpleie som tiltak eller merk som vurdert.', { bestandId: b.id, vurdering: `ungskog-${b.id}` });
    }

    if (!egne.length) continue;

    // K22/K23 Nøkkelbiotoper og BVO
    const iNb = [...nb, ...bvo].filter((o) => overlapper(b.geometri, o.geometri));
    const inngrep = egne.filter((t) => !['miljo', 'annet'].includes(t.type));
    if (iNb.length && inngrep.length) leggTil(iNb[0].type === 'bvo' ? 23 : 22, 'avvik', `Tiltak i ${navnB(b)} berører ${OBJEKTTYPER[iNb[0].type].navn.toLowerCase()}`, `${inngrep.map((t) => t.type).join(', ')} planlagt. Nøkkelbiotoper og BVO settes av urørt, eller skjøttes etter plan godkjent av skogbiolog. Hogst innenfor GPS-nøyaktighet av grensen skal ikke skje.`, { bestandId: b.id, objektId: iNb[0].id });
    // Databasekonsultasjon: A/B-naturtyper, NiN, artsområder
    if (hogst.length) {
      const nt = [...obj('naturtype'), ...obj('artsomrade')].filter((o) => overlapper(b.geometri, o.geometri));
      if (nt.length) leggTil(22, 'varsel', `Hogst i ${navnB(b)} berører registrert naturtype eller artsområde`, `${nt.slice(0, 3).map((o) => o.navn).join('; ')}. Skal vurderes av skogbiologisk kompetanse før hogst.`, { bestandId: b.id, objektId: nt[0].id });
      const vern = obj('vern').filter((o) => overlapper(b.geometri, o.geometri));
      if (vern.length) leggTil(11, 'avvik', `Hogst i ${navnB(b)} innenfor verneområde`, `${vern[0].navn}. Verneforskriften gjelder, og hogst krever ofte dispensasjon.`, { bestandId: b.id, objektId: vern[0].id });
    }

    // K24 Rovfugl
    for (const r of obj('rovfuglreir')) {
      const art = ROVFUGLER[r.art];
      if (!art) continue;
      if (art.hensynAar && r.sisteHekking && iAar - r.sisteHekking > art.hensynAar) continue;
      const d = avstand(b.geometri, r.geometri, art.buffer);
      if (slutt.length && art.hensyn && d <= art.hensyn) leggTil(24, 'avvik', `Sluttavvirkning i ${navnB(b)} innenfor hensynsområdet til ${art.navn.toLowerCase()}`, `${Math.round(d)} m fra reiret. Ingen flatehogst eller frøtrestilling innenfor ${art.hensyn} m.${art.merknad ? ` ${art.merknad}` : ''}`, { bestandId: b.id, objektId: r.id });
      const forstyrr = egne.filter((t) => FORSTYRRENDE.includes(t.type));
      if (forstyrr.length && d <= art.buffer) leggTil(24, 'varsel', `${art.navn}: ingen skogbruksforstyrrelse ${periodeTekst(art.periode)}`, `${navnB(b)} ligger ${Math.round(d)} m fra reiret (buffersone ${art.buffer} m). Gjelder hogst, markberedning og motormanuell ungskogpleie.`, { bestandId: b.id, objektId: r.id });
    }
    // K25 Tiurleik
    const leik = obj('tiurleik').filter((o) => avstand(b.geometri, o.geometri, 50) <= 50);
    if (leik.length && hogst.length) leggTil(25, 'varsel', `Hogst i eller ved tiurleik (${navnB(b)})`, 'Hogsten skal planlegges med person med skogbiologisk kompetanse. Unngå drift i april–mai, og ikke la leiken stå igjen som en øy.', { bestandId: b.id, objektId: leik[0].id });
    // K26 Hekketid
    const lauvEldre = b.treslag === 'L' && hk >= 4;
    const fuktig = naer('myr', 0).length || naer('vann', 15).length;
    if (hogst.length && (lauvEldre || fuktig)) leggTil(26, 'varsel', `Unngå drift i hekketiden mai–juli (${navnB(b)})`, lauvEldre ? 'Eldre lauvdominert skog (hogstklasse IV–V).' : 'Bestandet grenser mot myr, sumpskog eller vann (kantsone).', { bestandId: b.id });
    // K27 Kantsone
    const vann = naer('vann', 15);
    if (hogst.length && vann.length) leggTil(27, 'varsel', `Sett igjen kantsone mot vann i ${navnB(b)}`, `${vann[0].navn || 'Bekk/vann'} ligger inntil bestandet. Kantsonen skal være flersjiktet og normalt urørt, ca. 10–15 m (25–30 m i edellauv-, høgstaude-, storbregne- og sumpskog, ned mot 5 m i ensjiktet furuskog og langs 1–2 m brede bekker). Hogst i kantsonen dokumenteres.`, { bestandId: b.id, objektId: vann[0].id });
    // K28 Myr og sumpskog
    const myr = [...obj('myr'), ...obj('naturtype').filter((o) => /sumpskog|myr/i.test(o.navn || ''))].filter((o) => avstand(b.geometri, o.geometri, 10) <= 10);
    if (hogst.length && myr.length) leggTil(28, 'varsel', `Myr eller sumpskog i eller ved ${navnB(b)}`, 'Bruk lukket hogst eller småflatehogst i sump- og myrskog og mot fastmark, og bevar en flersjiktet kantsone mot myra (gjelder ikke myrer under 2 daa).', { bestandId: b.id, objektId: myr[0].id });
    // K6 Friluftsliv
    const fri = obj('friluftsomrade').filter((o) => overlapper(b.geometri, o.geometri));
    if (hogst.length && fri.length) leggTil(6, 'varsel', `Hogst i viktig friluftslivsområde (${navnB(b)})`, `${fri[0].navn || 'Friluftslivsområde'}. Legg særlig vekt på lukket hogst eller små flater, unngå kjøreskader på stier og rydd stier og løyper.`, { bestandId: b.id, objektId: fri[0].id });
    const sti = naer('sti', 0);
    if (hogst.length && sti.length) leggTil(11, 'varsel', `Sti eller skiløype gjennom ${navnB(b)}`, 'Hogstavfall ryddes fra stier og løyper straks etter hogst. Unngå stien som kjøretrasé (K14), og skilt ved preparerte løyper (K6).', { bestandId: b.id, objektId: sti[0].id });
    // K16 Markberedning
    if (egne.some((t) => t.type === 'markberedning')) {
      const forbudt = [...nb, ...bvo, ...obj('myr')].filter((o) => overlapper(b.geometri, o.geometri));
      if (forbudt.length) leggTil(16, 'avvik', `Markberedning planlagt i ${navnB(b)} som berører ${OBJEKTTYPER[forbudt[0].type].navn.toLowerCase()}`, 'Det skal ikke markberedes i nøkkelbiotoper, BVO, myr-, sump- og kildeskog.', { bestandId: b.id, objektId: forbudt[0].id });
      const soner = [...naer('vann', 5).map(() => 'minst 5 m fra bekk med årssikker vannføring'), ...naer('kulturminne', 5).map(() => 'minst 5 m fra kulturminner'), ...naer('sti', 2.5).map(() => 'minst 2,5 m fra mye brukte stier')];
      if (soner.length) leggTil(16, 'varsel', `Hold avstand ved markberedning i ${navnB(b)}`, `${[...new Set(soner)].join(', ')}. Flekkmarkberedning foretrekkes.`, { bestandId: b.id });
    }
    // K19 Gjødsling
    if (egne.some((t) => t.type === 'gjodsling')) {
      const naerVerdi = [...naer('vann', 25), ...naer('myr', 25), ...[...nb, ...bvo].filter((o) => avstand(b.geometri, o.geometri, 25) <= 25)];
      leggTil(19, naerVerdi.length ? 'varsel' : 'info', `Gjødsling i ${navnB(b)}`, `${naerVerdi.length ? 'Hold gjødslingsfri sone på 25 m (50 m ved lav presisjon) mot vann, myr, nøkkelbiotoper og BVO. ' : ''}Ikke før snøsmeltingen er over, og ikke etter utgangen av august. Type, mengde, dato og areal dokumenteres.`, { bestandId: b.id });
    }
    // K30 Kulturminner
    const km = naer('kulturminne', 5);
    if (km.length) leggTil(30, 'varsel', `Kulturminne i eller ved ${navnB(b)}`, `${km[0].navn || 'Kulturminne'}. Ikke kjør med lassbærer eller markbered nærmere enn 5 m, eller innenfor sikringssonen (nulltoleranse for fredete kulturminner). Unngå livsløpstrær i sikringssonen.`, { bestandId: b.id, objektId: km[0].id });
    // K13 Livsløpstrær ved planlagt hogst
    for (const t of slutt) {
      const krav = Math.ceil(((b.areal || 0) / 10) * 10);
      leggTil(13, 'info', `Sett igjen minst ${krav} livsløpstrær i ${navnB(b)}`, `10 per hektar avvirket areal (${fmt(b.areal, 1)} daa), minst 2 av dominerende treslag. Kartfest dem etter hogst.`, { bestandId: b.id, tiltakId: t.id });
    }
  }

  // K13 Livsløpstrær kartfestet etter utført hogst
  for (const { t, b } of tiltak.filter(({ t }) => t.type === 'sluttavvirkning' && t.status === 'utfort')) {
    if (!b.geometri) continue;
    const krav = Math.ceil(((b.areal || 0) / 10) * 10);
    const antall = obj('livslopstre').filter((o) => punktIGeometri(o.geometri.coordinates, b.geometri)).reduce((s, o) => s + (Number(o.antall) || 1), 0);
    leggTil(13, antall >= krav ? 'ok' : 'avvik', antall >= krav ? `Livsløpstrær kartfestet i ${navnB(b)}` : `For få kartfestede livsløpstrær i ${navnB(b)}`, `${antall} av minst ${krav} kartfestet (10 per hektar).`, { bestandId: b.id, tiltakId: t.id });
  }
  const rekkefolge = { avvik: 0, varsel: 1, info: 2, ok: 3 };
  return funn.sort((a, b) => rekkefolge[a.nivaa] - rekkefolge[b.nivaa] || a.krav - b.krav);
}

// Status per kravpunkt: automatiske funn veier tyngst, deretter skogeiers egen vurdering.
export function kravStatus(funn, P = tomPefc()) {
  const ut = {};
  for (const k of KRAVPUNKTER) {
    const f = funn.filter((x) => x.krav === k.nr);
    const manuell = P.kravstatus?.[k.nr]?.status;
    let status = 'ikke-vurdert';
    if (f.some((x) => x.nivaa === 'avvik')) status = 'avvik';
    else if (f.some((x) => x.nivaa === 'varsel')) status = 'varsel';
    else if (manuell) status = manuell;
    else if (k.auto && f.some((x) => x.nivaa === 'ok')) status = 'ok';
    ut[k.nr] = { status, funn: f, manuell: P.kravstatus?.[k.nr] || null };
  }
  return ut;
}

// Sjekkliste før hogst (operativ planlegging). auto: settes fra funn; øvrige krysses av av bruker.
export const KLARERING = [
  { id: 'databaser', krav: 22, tekst: 'Artskart, Naturbase og Narinbase er konsultert', lenker: [L.artskart, L.naturbase] },
  { id: 'rovfugl', krav: 24, tekst: 'Kjente reir for rovfugl og ugler er sjekket hos alle relevante kilder' },
  { id: 'tiurleik', krav: 25, tekst: 'Kjente tiurleiker er sjekket' },
  { id: 'kulturminner', krav: 30, tekst: 'Kulturminner er sjekket i Askeladden/Kulturminnesøk', lenker: [L.kulturminnesok] },
  { id: 'friluft', krav: 6, tekst: 'Friluftslivsverdier, stier og skiløyper er vurdert' },
  { id: 'nve', krav: 3, tekst: 'NVE faresonekart er sjekket (ved drift i bratt terreng)', lenker: [L.nve] },
  { id: 'kantsone', krav: 27, tekst: 'Kantsoner mot vann, vassdrag og myr er planlagt' },
  { id: 'livslop', krav: 13, tekst: 'Livsløpstrær og død ved er planlagt (minst 10 per hektar)' },
  { id: 'hekketid', krav: 26, tekst: 'Driftstidspunkt er vurdert mot hekketid (mai–juli) og tiurleik (april–mai)' },
  { id: 'markberedning', krav: 16, tekst: 'Behov for markberedning er vurdert, og arealer som ikke skal markberedes er avklart' },
  { id: 'kjoreskader', krav: 14, tekst: 'Driftsveier er planlagt for å unngå kjøreskader, stier og kantsoner' },
];
export const HOGSTFORMER = { flatehogst: 'Flatehogst', smaflate: 'Småflatehogst (under 2 daa)', frotre: 'Frøtrestilling', skjerm: 'Skjermstilling (16–40 trær/daa)', selektiv: 'Selektiv hogst / plukkhogst', tynning: 'Tynning' };
export const FORYNGELSE = { planting: 'Planting', saing: 'Såing', naturlig: 'Naturlig foryngelse' };

export function klareringStatus(t, b, funn, P = tomPefc()) {
  const k = (P.klareringer || {})[t.id] || {};
  const avvik = funn.filter((f) => f.bestandId === b.id && f.nivaa === 'avvik' && (!f.tiltakId || f.tiltakId === t.id));
  const mangler = KLARERING.filter((p) => !(k.sjekk || {})[p.id]).length + (k.hogstform ? 0 : 1) + (t.type === 'sluttavvirkning' && !k.foryngelse ? 1 : 0);
  return { klar: !avvik.length && !mangler, avvik: avvik.length, mangler, k };
}
