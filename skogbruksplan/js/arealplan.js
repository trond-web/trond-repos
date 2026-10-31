// Kommunale planer og reguleringer for eiendommen: arealformål, hensynssoner og planer fra DiBKs nasjonale arealplankart
// (nap.ft.dibk.no – kopi av kommunenes planregistre, oppdateres jevnlig). Henter et rutenett med egenskaper (WMS GetMap
// som UTFGrid) over eiendommen, slik at vi slipper tunge geometrier, og regner andeler per formål og hensynssone for
// eiendommen og for hvert bestand. Ut fra dette lages muligheter og begrensninger sett fra skogeierens side.
// Ingen DOM – kan testes i Node.
import { FORMAL_KODER } from './arealplan-koder.js';

export const KP_WMS = 'https://nap.ft.dibk.no/services/wms/kommuneplaner/';
export const RP_WMS = 'https://nap.ft.dibk.no/services/wms/reguleringsplaner/';
// Kartlag for visning i kartet (Leaflet WMS).
export const KART = {
  kp: { url: KP_WMS, lag: 'arealformal_kdp,arealformal_kp,hensynssone-bestemmelsesomrade_kdp,hensynssone-bestemmelsesomrade_kp,juridisklinje_kp' },
  rp: { url: RP_WMS, lag: 'arealformal_vn2,hensynssoner_vn2,rpomrade_vn2' },
};
// Lagene som analyseres. Reguleringsplan går foran kommunedelplan, som går foran kommuneplanens arealdel.
export const LAG = [
  { id: 'kp-formal', url: KP_WMS, lag: 'arealformal_kp', plan: 'kp', type: 'formal' },
  { id: 'kp-hensyn', url: KP_WMS, lag: 'hensynssone-bestemmelsesomrade_kp', plan: 'kp', type: 'hensyn' },
  { id: 'kp-omrade', url: KP_WMS, lag: 'kpomrade', plan: 'kp', type: 'omrade' },
  { id: 'kdp-formal', url: KP_WMS, lag: 'arealformal_kdp', plan: 'kdp', type: 'formal' },
  { id: 'kdp-hensyn', url: KP_WMS, lag: 'hensynssone-bestemmelsesomrade_kdp', plan: 'kdp', type: 'hensyn' },
  { id: 'kdp-omrade', url: KP_WMS, lag: 'kdpomrade', plan: 'kdp', type: 'omrade' },
  { id: 'rp-formal', url: RP_WMS, lag: 'arealformal_vn2', plan: 'rp', type: 'formal' },
  { id: 'rp-hensyn', url: RP_WMS, lag: 'hensynssoner_vn2', plan: 'rp', type: 'hensyn' },
  { id: 'rp-omrade', url: RP_WMS, lag: 'rpomrade_vn2', plan: 'rp', type: 'omrade' },
];
export const PLANTYPE = { kp: 'Kommuneplanens arealdel', kdp: 'Kommunedelplan', rp: 'Reguleringsplan' };
const PLANTYPE_KODE = { 20: 'Kommuneplanens arealdel', 21: 'Kommunedelplan', 22: 'Mindre endring av kommune(del)plan', 30: 'Eldre reguleringsplan', 31: 'Mindre reguleringsendring', 34: 'Områderegulering', 35: 'Detaljregulering' };
const PLANSTATUS = { 1: 'Planlegging igangsatt', 2: 'Planforslag', 3: 'Endelig vedtatt', 4: 'Opphevet', 5: 'Utgått/erstattet', 6: 'Vedtatt plan med utsatt rettsvirkning', 8: 'Overstyrt' };

// ---------------------------------------------------------------- arealformål
// Grupper med det som betyr noe for skogeieren. farge brukes i stolpen i kortet.
export const GRUPPER = {
  lnfr: {
    navn: 'Landbruk, natur og friluftsliv (LNFR)', farge: '#b6dd8a',
    mulig: ['Skog- og jordbruk er hovedformålet: ordinær drift, hogst, planting og ungskogpleie er i tråd med planen.', 'Bygg og anlegg som trengs i landbruket (driftsbygning, skogsbilvei, velteplass) kan tillates etter søknad.', 'Gårdstilknyttet næring basert på eiendommens ressurser – ved og flis, jakt- og fiskeutleie, utleie av koier – passer i formålet.'],
    begr: ['Nye boliger, hytter og fradeling som ikke trengs for landbruket krever dispensasjon (pbl § 19-2).'],
  },
  spredt: {
    navn: 'LNFR med spredt bolig, fritid eller næring', farge: '#e3e98f',
    mulig: ['Planen åpner for et begrenset antall nye boliger, hytter eller næringsbygg – kan gi tomtesalg eller festeinntekter. Se planbestemmelsene for antall og krav.'],
    begr: ['Antall enheter, tomtestørrelse og plassering styres av planbestemmelsene; resten er fortsatt LNFR.'],
  },
  hensynlnfr: {
    navn: 'LNFR med natur-, frilufts- eller landskapshensyn', farge: '#9fd3a6',
    mulig: ['Landbruk kan drives, men innenfor de hensynene formålet angir.'],
    begr: ['Hogst og inngrep kan være begrenset av planbestemmelsene – sjekk dem før større hogster og veibygging.'],
  },
  bolig: {
    navn: 'Boligbebyggelse', farge: '#ffe14d',
    mulig: ['Arealet er avsatt til boliger. Tomteverdien er normalt langt høyere enn skogverdien – vurder salg, feste eller utvikling.'],
    begr: ['Skogen blir trolig omdisponert. Planting og ungskogpleie gir lite igjen her; hogst nær bebyggelse krever hensyn til naboer.'],
  },
  fritid: {
    navn: 'Fritidsbebyggelse', farge: '#ffcc66',
    mulig: ['Avsatt til hytter – tomtesalg eller bortfeste er ofte den mest verdifulle bruken av arealet.'],
    begr: ['Skogkulturinvesteringer bør tilpasses en framtidig hyttebebyggelse.'],
  },
  bebyggelse: {
    navn: 'Annen bebyggelse og anlegg', farge: '#f2a65a',
    mulig: ['Arealet er avsatt til utbygging (næring, tjenesteyting, idrett e.l.) – kan gi salgs- eller festeinntekter.'],
    begr: ['Skogen kan bli omdisponert; langsiktige skogkulturtiltak gir lite igjen.'],
  },
  rastoff: {
    navn: 'Råstoffutvinning', farge: '#cc9999',
    mulig: ['Avsatt til masseuttak (grus, pukk, stein) – mulighet for leieinntekter. Større uttak krever driftskonsesjon fra Direktoratet for mineralforvaltning.'],
    begr: ['Skogen fjernes ved uttak; krav om opprydding og istandsetting.'],
  },
  samferdsel: {
    navn: 'Samferdsel og teknisk infrastruktur', farge: '#bdbdbd',
    mulig: ['Ved innløsning eller ekspropriasjon til vei, bane eller ledning har grunneier krav på erstatning.'],
    begr: ['Arealet kan bli tatt i bruk til vei, bane eller ledning – skog her bør ikke være et langsiktig investeringsobjekt.'],
  },
  gronn: {
    navn: 'Grønnstruktur og friområder', farge: '#7ed58e',
    mulig: ['Kan gi grunnlag for avtaler eller tilskudd til skjøtsel og tilrettelegging for friluftsliv.'],
    begr: ['Avsatt til allmennhetens bruk: flatehogst og tekniske inngrep er ofte begrenset, og skjøtselshogst er vanligst. Offentlige friområder kan bli innløst av kommunen.'],
  },
  vern: {
    navn: 'Naturvern eller kulturminnevern', farge: '#5fae7a',
    mulig: ['Vern gir grunneier erstatning – frivillig skogvern kan være aktuelt (Miljødirektoratet/statsforvalteren).'],
    begr: ['Hogst og inngrep er normalt ikke tillatt, eller krever tillatelse.'],
  },
  forsvar: { navn: 'Forsvaret', farge: '#cccc99', mulig: [], begr: ['Militært område – adgang og drift styres av Forsvaret.'] },
  vann: {
    navn: 'Sjø og vassdrag', farge: '#8fd3f0',
    mulig: [],
    begr: ['Byggeforbud i 100-metersbeltet langs sjøen (pbl § 1-8) og kommunale byggegrenser mot vassdrag. Kantvegetasjon langs vassdrag skal bevares (vannressursloven § 11).'],
  },
  fare: { navn: 'Fareområde', farge: '#f08a8a', mulig: [], begr: ['Område med fare (høyspent, ras, flom e.l.) – bygging er begrenset.'] },
  annet: { navn: 'Annet formål', farge: '#d9d2c3', mulig: [], begr: [] },
};

// Gruppe for en arealformålskode (4-sifret pbl 2008, 3-sifret pbl 1985).
export function gruppeFor(kode) {
  const k = String(kode ?? '').trim(); const n = Number(k);
  if (!k || !Number.isFinite(n)) return 'annet';
  if (k.length === 4) {
    if (n >= 1110 && n <= 1119) return 'bolig';
    if (n >= 1120 && n <= 1124) return 'fritid';
    if (n >= 1200 && n <= 1202) return 'rastoff';
    if (n >= 1000 && n < 2000) return 'bebyggelse';
    if (n >= 2000 && n < 3000) return 'samferdsel';
    if (n >= 3000 && n < 4000) return 'gronn';
    if (n >= 4000 && n < 5000) return 'forsvar';
    if (n >= 5200 && n <= 5230) return 'spredt';
    if ([5120, 5130, 5500].includes(n)) return 'hensynlnfr';
    if ([5300, 5600].includes(n)) return 'vern';
    if (n >= 5000 && n < 6000) return 'lnfr';
    if (n >= 6000 && n < 7000) return 'vann';
    return 'annet';
  }
  if (k.length === 3) {
    if (n === 150) return 'fritid';
    if (n >= 110 && n <= 115) return 'bolig';
    if (n >= 100 && n < 200) return 'bebyggelse';
    if (n >= 200 && n < 300) return 'lnfr';
    if (n >= 300 && n < 400) return n === 390 || n >= 391 && n <= 398 ? 'vann' : 'samferdsel';
    if (n >= 400 && n < 460) return 'gronn';
    if (n >= 460 && n < 470) return 'vann';
    if (n >= 500 && n < 600) return 'fare';
    if (n === 601) return 'samferdsel';
    if (n === 613) return 'gronn';
    if (n === 614 || n === 622) return 'vann';
    if (n === 650 || n === 651 || n === 663) return 'vern';
    if (n === 670 || n === 671) return 'rastoff';
    if (n === 680) return 'lnfr';
    if (n >= 600 && n < 700) return 'bebyggelse';
    if (n >= 700 && n < 1000) return 'bebyggelse';
  }
  if (k.length === 1) return { 1: 'bebyggelse', 2: 'lnfr', 3: 'rastoff', 4: 'vern', 5: 'forsvar', 6: 'vann' }[k] || 'annet';
  return 'annet';
}
export function formalInfo(kode) {
  const k = String(kode ?? '').trim(); const t = FORMAL_KODER[k];
  const gruppe = gruppeFor(k);
  return { kode: k, navn: t?.[0] || (k ? `Arealformål ${k}` : 'Ukjent arealformål'), farge: t?.[1] || GRUPPER[gruppe].farge, gruppe };
}
export function kortFormalNavn(navn) {
  return String(navn).replace(/^Landbruks-, natur- og friluftsformål samt reindrift$/, 'LNFR – landbruk, natur og friluftsliv').replace(/^Bruk og vern av sjø og vassdrag med tilhørende strandsone$/, 'Sjø og vassdrag med strandsone').replace(/^Offentlig eller privat tjenesteyting$/, 'Tjenesteyting').replace(/^LNFR-areal for nødvendige tiltak for landbruk og reindrift og gårdstilknyttet næringsvirksomhet basert på gårdens ressursgrunnlag$/, 'LNFR – landbruk, natur og friluftsliv').replace(/^LNFR-areal for spredt bolig-, fritids- eller næringsbebyggelse mv\.$/, 'LNFR – spredt bolig, fritid og næring');
}

// ---------------------------------------------------------------- hensynssoner
// Kode (3 siffer, H-koden) → navn, ikon og hva det betyr for skogbruket. alvor: 2 = kan stoppe eller kreve tillatelse
// for hogst/vei, 1 = krever hensyn, 0 = mest betydning for bygging.
export const HENSYN = {
  110: { navn: 'Nedslagsfelt for drikkevann', ikon: '🚰', alvor: 1, tekst: 'Restriksjoner på gjødsling, sprøyting, drivstofflagring og kjøring nær vann – følg kommunens drikkevannsbestemmelser og klausuler.' },
  120: { navn: 'Grunnvannsforsyning', ikon: '🚰', alvor: 1, tekst: 'Unngå forurensning: ikke lagre drivstoff eller fylle maskiner her, og vær forsiktig med kjemikalier.' },
  130: { navn: 'Byggeforbud rundt vei, bane eller flyplass', ikon: '🚧', alvor: 0, tekst: 'Byggeforbud nær vei, bane eller flyplass. Påvirker ikke ordinær skogsdrift, men avkjørsler og velteplasser må godkjennes av veieier.' },
  140: { navn: 'Frisikt', ikon: '👁', alvor: 0, tekst: 'Vegetasjon i frisiktsonen skal holdes lav – skog mot veikryss må ryddes.' },
  190: { navn: 'Sikringssone', ikon: '🔒', alvor: 1, tekst: 'Sikringssone – se planbestemmelsene for hva som er tillatt.' },
  210: { navn: 'Rød støysone', ikon: '🔊', alvor: 0, tekst: 'Støy begrenser nye boliger og fritidsboliger, ikke skogsdrift.' },
  220: { navn: 'Gul støysone', ikon: '🔉', alvor: 0, tekst: 'Støy begrenser nye boliger og fritidsboliger, ikke skogsdrift.' },
  290: { navn: 'Støysone', ikon: '🔉', alvor: 0, tekst: 'Støy begrenser nye boliger og fritidsboliger, ikke skogsdrift.' },
  310: { navn: 'Ras- og skredfare', ikon: '⚠️', alvor: 2, tekst: 'Bygging krever fagkyndig skredvurdering (TEK17 § 7-3). Skogen kan ha vernfunksjon mot skred: unngå flatehogst og store veiskjæringer i lia, og vurder vernskogbestemmelser.' },
  320: { navn: 'Flomfare', ikon: '🌊', alvor: 1, tekst: 'Unngå bygging, tømmerlagring og drivstoff i flomsonen. Bevar kantskogen – den demper erosjon.' },
  330: { navn: 'Radonfare', ikon: '☢️', alvor: 0, tekst: 'Gjelder bygg – ingen betydning for skogsdrift.' },
  350: { navn: 'Brann- og eksplosjonsfare', ikon: '🔥', alvor: 1, tekst: 'Vær varsom med varme arbeider og maskiner – avklar med anleggseier.' },
  360: { navn: 'Skytebane', ikon: '🎯', alvor: 1, tekst: 'Fare ved skyting – avtal tidspunkt for skogsarbeid med baneeier.' },
  370: { navn: 'Høyspenningsanlegg', ikon: '⚡', alvor: 1, tekst: 'Netteier rydder skog i ryddebeltet. Hogst nær linja må varsles netteier – trær som faller mot linja gir livsfare.' },
  380: { navn: 'Fare for akutt forurensning', ikon: '☣️', alvor: 1, tekst: 'Unngå inngrep i grunnen uten å avklare med kommunen.' },
  390: { navn: 'Annen fare', ikon: '⚠️', alvor: 1, tekst: 'Faresone – se planbestemmelsene.' },
  410: { navn: 'Krav til infrastruktur', ikon: '🛠', alvor: 0, tekst: 'Utbygging krever infrastruktur først – ingen betydning for ordinær skogsdrift.' },
  430: { navn: 'Krav til infrastruktur', ikon: '🛠', alvor: 0, tekst: 'Utbygging krever infrastruktur først.' },
  510: { navn: 'Hensyn landbruk', ikon: '🌾', alvor: 0, positiv: true, tekst: 'Kjerneområde for landbruk – kommunen prioriterer landbruket her, og nedbygging blir sjelden tillatt.' },
  520: { navn: 'Hensyn reindrift', ikon: '🦌', alvor: 1, tekst: 'Ta hensyn til reindrifta ved hogst og veibygging (beite, flytt- og trekkleier). Samråd med reinbeitedistriktet.' },
  530: { navn: 'Hensyn friluftsliv', ikon: '🥾', alvor: 1, tekst: 'Ta hensyn til stier, løyper og utfartsområder – mindre hogstflater, rydd stier etter drift, og varsle om større hogst.' },
  540: { navn: 'Hensyn grønnstruktur', ikon: '🌳', alvor: 1, tekst: 'Grønnstruktur skal bevares – lukkede hogster og skjøtsel framfor flatehogst.' },
  550: { navn: 'Hensyn landskap', ikon: '🏞', alvor: 1, tekst: 'Tilpass hogst i synlige lier og åsprofiler (mindre flater, kantsoner). Sjekk bestemmelsene for krav.' },
  560: { navn: 'Bevaring av naturmiljø', ikon: '🦋', alvor: 2, positiv: true, tekst: 'Registrerte naturverdier – avklar hogst og veibygging mot naturverdiene (MiS, artsfunn) og eventuelle bestemmelser. Kan være aktuelt for frivillig vern med erstatning.' },
  570: { navn: 'Bevaring av kulturmiljø', ikon: '🏛', alvor: 1, tekst: 'Kulturminner og kulturmiljø – unngå kjøring og skader. Kontakt fylkeskommunen ved tvil.' },
  590: { navn: 'Særlig hensyn', ikon: '📌', alvor: 1, tekst: 'Område med særlige hensyn – se planbestemmelsene.' },
  710: { navn: 'Båndlagt for regulering', ikon: '⏳', alvor: 1, tekst: 'Båndlagt i påvente av ny regulering (inntil 4 + 4 år) – tiltak kan bli nektet.' },
  720: { navn: 'Båndlagt etter naturmangfoldloven', ikon: '🛡', alvor: 2, positiv: true, tekst: 'Verneområde eller foreslått vern – verneforskriften gjelder, og hogst er ofte forbudt eller krever tillatelse. Vern gir erstatning til grunneier.' },
  730: { navn: 'Båndlagt etter kulturminneloven', ikon: '🏺', alvor: 2, tekst: 'Fredete kulturminner – inngrep er forbudt uten dispensasjon (kulturminneloven § 3), med 5 m sikringssone. Ikke kjør over eller felle trær på kulturminnet.' },
  740: { navn: 'Båndlagt etter annen lov', ikon: '📎', alvor: 1, tekst: 'Båndlagt etter annet lovverk (f.eks. framtidig vei eller energianlegg) – avklar før tiltak.' },
  810: { navn: 'Krav om felles planlegging', ikon: '🤝', alvor: 0, tekst: 'Utbygging krever felles plan for flere eiendommer.' },
  820: { navn: 'Omformingssone', ikon: '🔄', alvor: 0, tekst: 'Området skal omformes – utbygging styres av ny plan.' },
  830: { navn: 'Fornyelsessone', ikon: '🔄', alvor: 0, tekst: 'Området skal fornyes – utbygging styres av ny plan.' },
  910: { navn: 'Reguleringsplan skal fortsatt gjelde', ikon: '📐', alvor: 0, tekst: 'Eldre reguleringsplan gjelder fortsatt her – se den for arealbruken.' },
};
// Eldre reguleringsplaner (pbl 1985) har hensyn som reguleringsformål.
const RB_HENSYN = { 510: 370, 640: 140, 641: 130, 645: 120, 646: 110, 650: 720, 651: 720, 660: 570, 661: 570, 662: 570, 663: 550 };
const KODEFELT = ['sikring', 'støy', 'fare', 'infrastruktur', 'angittHensyn', 'båndlegging', 'gjennomføring', 'detaljering'];

export function hensynKode(p) {
  for (const f of KODEFELT) if (p?.[f] != null && /^\d{3}$/.test(String(p[f]))) return Number(p[f]);
  const m = /H\s*_?(\d{3})/i.exec(p?.hensynSonenavn || ''); if (m) return Number(m[1]);
  const rb = Number(p?.reguleringsformål); if (RB_HENSYN[rb]) return RB_HENSYN[rb];
  if (rb >= 500 && rb < 600) return 390;
  return null;
}
export function hensynInfo(kode) {
  if (kode == null) return { kode: null, navn: 'Bestemmelsesområde', ikon: '📄', alvor: 0, tekst: 'Område med egne planbestemmelser – les bestemmelsene.' };
  const h = HENSYN[kode] || HENSYN[Math.floor(kode / 10) * 10] || HENSYN[Math.floor(kode / 100) * 100 + 90];
  return { kode, ...(h || { navn: `Hensynssone H${kode}`, ikon: '📌', alvor: 1, tekst: 'Se planbestemmelsene.' }) };
}

// ---------------------------------------------------------------- henting
// Rutenett for eiendommen: bbox (lon/lat) og bildestørrelse slik at hver rute er ca. «celle» meter (UTFGrid har 4 px
// per rute). Store eiendommer får grovere ruter (maks 2048 px).
export function rutenettFor(geometri, { celle = 10, margin = 0.0005, maksPx = 2048 } = {}) {
  const pts = []; const gaa = (k) => (typeof k[0] === 'number' ? pts.push(k) : k.forEach(gaa)); gaa(geometri.coordinates);
  const x0 = Math.min(...pts.map((p) => p[0])) - margin; const x1 = Math.max(...pts.map((p) => p[0])) + margin;
  const y0 = Math.min(...pts.map((p) => p[1])) - margin; const y1 = Math.max(...pts.map((p) => p[1])) + margin;
  const midt = ((y0 + y1) / 2) * Math.PI / 180;
  const bredM = (x1 - x0) * 111320 * Math.cos(midt); const hoyM = (y1 - y0) * 110574;
  let skala = 4 / celle; // px per meter
  if (Math.max(bredM, hoyM) * skala > maksPx) skala = maksPx / Math.max(bredM, hoyM);
  const w = Math.max(64, Math.round((bredM * skala) / 4) * 4); const h = Math.max(64, Math.round((hoyM * skala) / 4) * 4);
  return { bbox: [x0, y0, x1, y1], w, h, celleM: { x: bredM / (w / 4), y: hoyM / (h / 4) } };
}
export function utfgridUrl(url, lag, { bbox, w, h }) {
  return `${url}?service=WMS&version=1.1.1&request=GetMap&layers=${encodeURIComponent(lag)}&styles=&srs=EPSG:4326&bbox=${bbox.join(',')}&width=${w}&height=${h}&format=${encodeURIComponent('application/json;type=utfgrid')}`;
}
// UTFGrid-tegn → indeks i keys.
export function utfIndeks(tegn) { let c = tegn.charCodeAt(0); if (c >= 93) c--; if (c >= 35) c--; return c - 32; }

async function hentJsonStandard(u, { forsok = 3 } = {}) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(u); if (!r.ok) throw new Error(`Plantjenesten svarte ${r.status}`);
      const t = await r.text(); if (/ServiceException/.test(t.slice(0, 300))) throw new Error('Plantjenesten ga en feilmelding');
      return JSON.parse(t);
    } catch (e) { if (i >= forsok) throw e; await new Promise((ok) => setTimeout(ok, 800 * i)); }
  }
}

// Henter alle lagene for eiendommen. Returnerer { rutenett, lag: { id: utfgrid | null }, feil: [...] }.
export async function hent(geometri, { hentJson = hentJsonStandard, framdrift = () => {}, celle = 10 } = {}) {
  const r = rutenettFor(geometri, { celle });
  framdrift('Henter kommuneplan og reguleringsplaner fra nasjonalt arealplankart …');
  const lag = {}; const feil = [];
  await Promise.all(LAG.map(async (l) => {
    try { lag[l.id] = await hentJson(utfgridUrl(l.url, l.lag, r)); } catch (e) { lag[l.id] = null; feil.push(`${l.lag}: ${e.message}`); }
  }));
  if (feil.length === LAG.length) throw new Error('Fikk ikke kontakt med plantjenesten (DiBK). Prøv igjen senere.');
  return { rutenett: r, lag, feil };
}

// ---------------------------------------------------------------- analyse
const avrund = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
function lesRute(g, kol, rad) {
  if (!g?.grid?.[rad]) return null;
  const key = g.keys[utfIndeks(g.grid[rad][kol] || ' ')];
  return key ? g.data?.[key] || null : null;
}
const nokkel = (p) => p?.['identifikasjon.lokalId'] || p?.id || p?.objid;

// Teller rutene innenfor eiendommen (og hvert bestand). punktIGeometri([lon,lat], geom) fra proj.js.
export function analyser(res, geometri, { punktIGeometri, bestand = [], hentet = new Date().toISOString().slice(0, 10) } = {}) {
  const { rutenett: rn, lag } = res;
  const [x0, y0, x1, y1] = rn.bbox; const nk = rn.w / 4; const nr = rn.h / 4;
  const celleDaa = (rn.celleM.x * rn.celleM.y) / 1000;
  const formal = new Map(); const hensyn = new Map(); const planer = new Map(); const dekning = { kp: 0, kdp: 0, rp: 0 };
  const boks = (g) => { const p = []; const gaa = (k) => (typeof k[0] === 'number' ? p.push(k) : k.forEach(gaa)); gaa(g.coordinates); return [Math.min(...p.map((q) => q[0])), Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1]))]; };
  const medGeom = bestand.filter((b) => b.geometri?.coordinates).map((b) => ({ b, bb: boks(b.geometri) }));
  const perBestand = new Map(medGeom.map(({ b }) => [b.id, { n: 0, formal: new Map(), hensyn: new Map() }]));
  let n = 0;
  for (let rad = 0; rad < nr; rad++) {
    const lat = y1 - ((rad + 0.5) / nr) * (y1 - y0);
    for (let kol = 0; kol < nk; kol++) {
      const lon = x0 + ((kol + 0.5) / nk) * (x1 - x0);
      if (!punktIGeometri([lon, lat], geometri)) continue;
      n++;
      const b = medGeom.find(({ b: x, bb }) => lon >= bb[0] && lon <= bb[2] && lat >= bb[1] && lat <= bb[3] && punktIGeometri([lon, lat], x.geometri))?.b;
      const pb = b ? perBestand.get(b.id) : null; if (pb) pb.n++;
      // Gjeldende arealformål: reguleringsplan → kommunedelplan → kommuneplan.
      let valgt = null;
      for (const plan of ['rp', 'kdp', 'kp']) {
        const p = lesRute(lag[`${plan}-formal`], kol, rad);
        if (p) { dekning[plan]++; if (!valgt) valgt = { p, plan }; }
      }
      if (valgt) {
        const kode = String(valgt.p.arealformål ?? valgt.p.reguleringsformål ?? valgt.p.arealbruk ?? '');
        const k = `${valgt.plan}|${kode}`;
        const f = formal.get(k) || { kode, plan: valgt.plan, n: 0, planIder: new Set(), felt: new Set() };
        f.n++; if (valgt.p['arealplanId.planidentifikasjon']) f.planIder.add(valgt.p['arealplanId.planidentifikasjon']);
        const felt = valgt.p.feltbetegnelse || valgt.p.områdenavn; if (felt) f.felt.add(felt);
        formal.set(k, f);
        if (pb) pb.formal.set(kode, (pb.formal.get(kode) || 0) + 1);
      }
      // Hensynssoner fra alle plannivåer.
      for (const plan of ['rp', 'kdp', 'kp']) {
        const p = lesRute(lag[`${plan}-hensyn`], kol, rad); if (!p) continue;
        if (/Bestemmelse|MidlBygganlegg/i.test(p.objekttypenavn || '') && hensynKode(p) == null) continue;
        const kode = hensynKode(p); const k = `${kode}|${p.hensynSonenavn || ''}|${plan}`;
        const h = hensyn.get(k) || { kode, sonenavn: p.hensynSonenavn || null, beskrivelse: p.beskrivelse || null, plan, n: 0, planId: p['arealplanId.planidentifikasjon'] || null };
        h.n++; hensyn.set(k, h);
        if (pb) pb.hensyn.set(kode, (pb.hensyn.get(kode) || 0) + 1);
      }
      // Planer som dekker ruta.
      for (const plan of ['rp', 'kdp', 'kp']) {
        const p = lesRute(lag[`${plan}-omrade`], kol, rad); if (!p) continue;
        const id = `${plan}|${p['arealplanId.kommunenummer'] || ''}|${p['arealplanId.planidentifikasjon'] || nokkel(p)}`;
        const x = planer.get(id) || { plan, p, n: 0 }; x.n++; planer.set(id, x);
      }
    }
  }
  const andel = (v) => (n ? v / n : 0);
  const formalListe = [...formal.values()].map((f) => {
    const i = formalInfo(f.kode);
    return { ...i, navn: kortFormalNavn(i.navn), plan: f.plan, daa: avrund(f.n * celleDaa), andel: avrund(andel(f.n), 3), felt: [...f.felt].slice(0, 6), planIder: [...f.planIder] };
  }).filter((f) => f.andel >= 0.002 || f.daa >= 0.5).sort((a, b) => b.andel - a.andel);
  const hensynListe = [...hensyn.values()].map((h) => ({ ...hensynInfo(h.kode), sonenavn: h.sonenavn, beskrivelse: h.beskrivelse, plan: h.plan, planId: h.planId, daa: avrund(h.n * celleDaa), andel: avrund(andel(h.n), 3) }))
    .filter((h) => h.andel >= 0.002 || h.daa >= 0.3).sort((a, b) => b.alvor - a.alvor || b.andel - a.andel);
  const planListe = [...planer.values()].map(({ plan, p, n: m }) => ({
    plan, type: PLANTYPE_KODE[p.plantype] || PLANTYPE[plan], navn: p.plannavn || 'Uten navn', planId: p['arealplanId.planidentifikasjon'] || null,
    kommunenr: p['arealplanId.kommunenummer'] || null, status: PLANSTATUS[p.planstatus] || null, ikraft: (p.ikrafttredelsesdato || '').slice(0, 10) || null,
    lenke: /^https?:\/\//.test(p.link || '') ? p.link : null, andel: avrund(andel(m), 3), daa: avrund(m * celleDaa),
  })).sort((a, b) => ['rp', 'kdp', 'kp'].indexOf(b.plan) - ['rp', 'kdp', 'kp'].indexOf(a.plan) || b.andel - a.andel);
  const bestandUt = {};
  for (const [id, pb] of perBestand) {
    if (!pb.n) continue;
    const f = [...pb.formal.entries()].sort((a, b) => b[1] - a[1]).map(([kode, m]) => ({ kode, andel: avrund(m / pb.n, 2) })).filter((x) => x.andel >= 0.05);
    const h = [...pb.hensyn.entries()].map(([kode, m]) => ({ kode, andel: avrund(m / pb.n, 2) })).filter((x) => x.andel >= 0.02);
    bestandUt[id] = { formal: f, hensyn: h };
  }
  return {
    hentet, kilde: 'DiBK – nasjonalt arealplankart', daa: avrund(n * celleDaa), celleM: avrund((rn.celleM.x + rn.celleM.y) / 2, 0),
    dekning: { kp: avrund(andel(dekning.kp), 3), kdp: avrund(andel(dekning.kdp), 3), rp: avrund(andel(dekning.rp), 3) },
    formal: formalListe, hensyn: hensynListe, planer: planListe, bestand: bestandUt,
    ufullstendig: (res.feil || []).length ? res.feil : undefined,
  };
}

// ---------------------------------------------------------------- vurdering
const pst = (a) => `${Math.round(a * 100) || '<1'} %`;
// Muligheter og begrensninger for eiendommen, sortert etter betydning.
export function vurdering(a) {
  if (!a) return null;
  if (!a.formal.length && !a.planer.length) {
    return { tittel: 'Fant ingen digitale arealplaner for eiendommen', niva: 'ukjent', muligheter: [], begrensninger: [], merknader: ['Kommunen har kanskje ikke levert planene sine til nasjonalt arealplankart ennå. Sjekk kommunens planinnsyn eller kontakt plankontoret.'] };
  }
  const grupper = new Map();
  for (const f of a.formal) { const g = grupper.get(f.gruppe) || { id: f.gruppe, andel: 0, daa: 0 }; g.andel += f.andel; g.daa += f.daa; grupper.set(f.gruppe, g); }
  const gl = [...grupper.values()].sort((x, y) => y.andel - x.andel);
  const muligheter = []; const begrensninger = []; const merknader = [];
  for (const g of gl) {
    if (g.andel < 0.005 && g.daa < 2) continue;
    const G = GRUPPER[g.id]; const om = `${G.navn} – ${pst(g.andel)}, ${avrund(g.daa, 0)} daa`;
    if (G.mulig.length) muligheter.push({ om, tekster: G.mulig, gruppe: g.id, farge: G.farge });
    if (G.begr.length) begrensninger.push({ om, tekster: G.begr, gruppe: g.id, farge: G.farge, alvor: ['vern', 'gronn', 'samferdsel', 'bolig', 'bebyggelse', 'fritid'].includes(g.id) ? 2 : 1 });
  }
  // Hensynssoner slås sammen per kode (samme sone kan ligge i flere planer eller deler).
  const perKode = new Map();
  for (const h of a.hensyn) {
    const x = perKode.get(h.kode) || { ...h, andel: 0, daa: 0, navnListe: new Set() };
    x.andel += h.andel; x.daa += h.daa; const bes = h.beskrivelse && h.beskrivelse !== h.navn ? h.beskrivelse : null; if (bes) x.navnListe.add(bes);
    perKode.set(h.kode, x);
  }
  for (const h of perKode.values()) {
    const om = `${h.ikon} ${h.navn} – ${pst(Math.min(1, h.andel))}, ${avrund(h.daa, 1)} daa${h.navnListe.size ? ` (${[...h.navnListe].slice(0, 3).join(', ')})` : ''}`;
    if (h.kode === 510) muligheter.push({ om, tekster: [h.tekst], hensyn: h.kode });
    else begrensninger.push({ om, tekster: [h.tekst], hensyn: h.kode, alvor: h.alvor });
  }
  begrensninger.sort((x, y) => (y.alvor ?? 1) - (x.alvor ?? 1));
  if (a.dekning.rp > 0.01) merknader.push(`${pst(a.dekning.rp)} av eiendommen er regulert. Der gjelder reguleringsplanen foran kommuneplanen, med mindre kommuneplanen sier noe annet.`);
  if (a.dekning.kdp > 0.01) merknader.push(`${pst(a.dekning.kdp)} ligger i en kommunedelplan, som går foran kommuneplanens arealdel.`);
  if (a.ufullstendig) merknader.push('Noen plantemaer kunne ikke hentes – prøv å oppdatere senere.');
  merknader.push('Skogbruksloven og PEFC gjelder i tillegg til planene. Planbestemmelsene er juridisk bindende – les dem i kommunens planinnsyn før større tiltak.');
  const hoved = gl[0];
  const strenge = [...perKode.values()].filter((h) => h.alvor >= 2);
  const niva = gl.some((g) => ['vern'].includes(g.id) && g.andel > 0.05) || strenge.length ? 'begrenset' : hoved && ['lnfr', 'spredt'].includes(hoved.id) ? 'skogbruk' : 'utbygging';
  const tittel = hoved
    ? `${pst(hoved.andel)} ${GRUPPER[hoved.id].navn.replace(/^./, (c) => c.toLowerCase())}${hoved.id === 'lnfr' ? ' – skogbruk er hovedformålet' : ''}${strenge.length ? ` · ${strenge.length} hensynssone${strenge.length > 1 ? 'r' : ''} som krever avklaring` : ''}`
    : 'Planer funnet, men uten arealformål over eiendommen';
  return { tittel, niva, grupper: gl.map((g) => ({ ...g, navn: GRUPPER[g.id].navn, farge: GRUPPER[g.id].farge })), muligheter, begrensninger, merknader };
}

// Kort tekst for et bestand: hovedformål og hensynssoner (til bestandsdetaljen).
export function bestandTekst(x) {
  if (!x) return null;
  const f = x.formal?.[0] ? formalInfo(x.formal[0].kode) : null;
  const h = (x.hensyn || []).map((y) => hensynInfo(y.kode)).filter((y) => y.kode !== 510);
  const alvor = Math.max(0, ...h.map((y) => y.alvor), f && ['vern', 'gronn'].includes(f.gruppe) ? 2 : 0, f && ['bolig', 'fritid', 'bebyggelse', 'samferdsel'].includes(f.gruppe) ? 1 : 0);
  return {
    tekst: [f ? kortFormalNavn(f.navn) : null, ...h.map((y) => `${y.ikon} ${y.navn}`)].filter(Boolean).join(' · '),
    alvor, farge: f?.farge || '#ddd',
    raad: alvor >= 2 ? (h.find((y) => y.alvor >= 2)?.tekst || GRUPPER[f.gruppe].begr[0]) : null,
  };
}

// Punktoppslag ved klikk i kartet (GetFeatureInfo, JSON).
export function punktUrl(url, lag, lat, lon, d = 0.0004) {
  return `${url}?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=${encodeURIComponent(lag)}&query_layers=${encodeURIComponent(lag)}&styles=&srs=EPSG:4326&bbox=${lon - d},${lat - d},${lon + d},${lat + d}&width=101&height=101&x=50&y=50&info_format=application/json&feature_count=20`;
}
export function tolkPunkt(features = []) {
  const ut = { formal: [], hensyn: [], planer: [] }; const sett = new Set();
  for (const f of features) {
    const p = f.properties || {}; const t = p.objekttypenavn || '';
    const id = nokkel(p) || f.id; if (sett.has(id)) continue; sett.add(id);
    if (/Område$/.test(t) && p.plannavn) ut.planer.push({ navn: p.plannavn, planId: p['arealplanId.planidentifikasjon'] || null, type: PLANTYPE_KODE[p.plantype] || '', lenke: /^https?:\/\//.test(p.link || '') ? p.link : null, ikraft: (p.ikrafttredelsesdato || '').slice(0, 10) || null });
    else if (/ArealformålOmråde|RbFormålOmråde/.test(t)) { const i = formalInfo(p.arealformål ?? p.reguleringsformål); ut.formal.push({ ...i, navn: kortFormalNavn(i.navn), felt: p.feltbetegnelse || p.områdenavn || null, plan: /^Rp|^Rb/.test(t) ? 'rp' : 'kp' }); }
    else if (/Sone$|FareOmråde|RestriksjonOmråde|BevaringOmråde/.test(t)) ut.hensyn.push({ ...hensynInfo(hensynKode(p)), sonenavn: p.hensynSonenavn || null, beskrivelse: p.beskrivelse || null });
  }
  return ut;
}
