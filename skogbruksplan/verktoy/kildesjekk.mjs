// 🔎 Kildesjekk: overvåker lover, forskrifter, satser, standarder, priser og datakilder som SkogIQ.ai bygger på.
// Sammenligner med forrige kjøring (docs/kildestatus.json) og med verdiene i koden, og skriver en rapport.
//
//   node verktoy/kildesjekk.mjs                 sjekk og skriv rapport til skjermen
//   node verktoy/kildesjekk.mjs --rapport r.md  skriv rapporten (Markdown) til fil
//   node verktoy/kildesjekk.mjs --oppdater      lagre dagens tilstand som ny referanse i docs/kildestatus.json
//   node verktoy/kildesjekk.mjs --lenker        sjekk også alle lenker i koden (tregere)
//
// Kjøres ukentlig av en planlagt oppgave (se docs/kildesjekk.md). Henter bare offentlige sider, ingen brukerdata.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATUS = path.join(ROT, 'docs', 'kildestatus.json');
const arg = (n) => process.argv.includes(n);
const argVerdi = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const UA = { 'User-Agent': 'SkogIQ-kildesjekk/1.0 (ukentlig sjekk av offentlige kilder)', 'X-Client': 'SkogIQ-kildesjekk' };

// ---------- kilder ----------
const LD = (id, navn, type = 'SF') => ({ id: `lov:${id}`, gruppe: 'Lover og forskrifter', navn, url: `https://lovdata.no/dokument/${type}/${type === 'NL' ? 'lov' : 'forskrift'}/${id}`, lovdata: true });
export const LOVER = [
  LD('2005-05-27-31', 'Skogbrukslova', 'NL'), LD('2006-06-07-593', 'Forskrift om berekraftig skogbruk'), LD('2004-02-04-447', 'Forskrift om tilskudd til nærings- og miljøtiltak i skogbruket (NMSK)'),
  LD('2015-05-28-550', 'Forskrift om planlegging og godkjenning av veier for landbruksformål'), LD('2003-11-28-98', 'Konsesjonsloven', 'NL'), LD('1974-06-28-58', 'Odelslova', 'NL'),
  LD('2009-06-05-35', 'Markaloven', 'NL'), LD('2015-09-04-1032', 'Markalovforskriften'),   LD('2009-06-19-100', 'Naturmangfoldloven', 'NL'), LD('2025-01-29-115', 'Forskrift om lagring og bruk av gjødsel'), LD('2015-05-06-455', 'Forskrift om plantevernmidler'),
  LD('2014-12-19-1817', 'Forskrift om produksjonstilskudd og avløsertilskudd'), LD('2009-06-19-97', 'Dyrevelferdsloven', 'NL'), LD('2004-04-22-665', 'Forskrift om hold av storfe'),
  LD('2005-02-18-160', 'Forskrift om velferd for småfe'), LD('2001-12-12-1494', 'Forskrift om hold av høns og kalkun'), LD('2003-02-18-175', 'Forskrift om hold av svin'),
  LD('2005-06-02-505', 'Forskrift om velferd for hest'), LD('1996-12-06-1127', 'Internkontrollforskriften'), LD('2005-10-07-1219', 'Skiltforskriften'),
  { ...LD('1974-07-24-1', 'Forskrifter om måling av stolpevirke (opphevet 2001, brukes som rettesnor)', 'SFO'), kjentOpphevet: true }, LD('2024-10-21-2533', 'Allmenngjøring av tariffavtale for jordbruks- og gartnerinæringene'),
];
const LDIR = 'https://www.landbruksdirektoratet.no/nb';
export const SIDER = [
  { id: 'ldir:pt-oversikt', gruppe: 'Satser og tilskudd', navn: 'Produksjonstilskudd – sider og satser', url: `${LDIR}/jordbruk/ordninger-for-jordbruk/produksjonstilskudd-og-avlosertilskudd-i-jordbruket`, lenker: /satser|beregningsveiledning/i },
  { id: 'ldir:pt-satser', gruppe: 'Satser og tilskudd', navn: 'Produksjonstilskudd – endelige satser', url: `${LDIR}/jordbruk/ordninger-for-jordbruk/produksjonstilskudd-og-avlosertilskudd-i-jordbruket/produksjonstilskudd-og-avlosertilskudd--endelige-satser`, linjer: /kr per|per foretak|maksimalt|søknadsåret/i },
  { id: 'ldir:skogfond', gruppe: 'Satser og tilskudd', navn: 'Skogfond', url: `${LDIR}/skogbruk/om-skogfond`, linjer: /prosent|%|skattefri|inntekt/i },
  { id: 'ldir:skogkultur', gruppe: 'Satser og tilskudd', navn: 'Tilskudd til skogkultur', url: `${LDIR}/skogbruk/ordninger-for-skogbruk/tilskudd-til-skogkultur`, linjer: /prosent|%|kr|frist/i },
  { id: 'ldir:gjodsling-skog', gruppe: 'Satser og tilskudd', navn: 'Tilskudd til gjødsling av skog (klimatiltak)', url: `${LDIR}/skogbruk/ordninger-for-skogbruk/tilskudd-til-gjodsling-av-skog-som-klimatiltak`, linjer: /prosent|%|bonitet/i },
  { id: 'ldir:tettere-planting', gruppe: 'Satser og tilskudd', navn: 'Tilskudd til tettere planting (klimatiltak)', url: `${LDIR}/skogbruk/ordninger-for-skogbruk/tilskudd-til-tettere-skogplanting-som-klimatiltak`, linjer: /prosent|%|planter/i },
  { id: 'ldir:veibygging', gruppe: 'Satser og tilskudd', navn: 'Tilskudd til veibygging i skog', url: `${LDIR}/skogbruk/ordninger-for-skogbruk/tilskudd-til-veibygging-i-skog`, linjer: /prosent|%|kr/i },
  { id: 'ldir:skogordninger', gruppe: 'Satser og tilskudd', navn: 'Ordninger for skogbruk (nye ordninger)', url: `${LDIR}/skogbruk/ordninger-for-skogbruk`, lenker: /ordninger-for-skogbruk\// },
  { id: 'ldir:jordordninger', gruppe: 'Satser og tilskudd', navn: 'Ordninger for jordbruk (nye ordninger)', url: `${LDIR}/jordbruk/ordninger-for-jordbruk`, lenker: /ordninger-for-jordbruk\/[^/]+$/ },
  ...[['drenering', 'Drenering av jordbruksjord', 'jordbruk/ordninger-for-jordbruk/tilskudd-til-drenering-av-jordbruksjord'], ['smil', 'SMIL', 'jordbruk/ordninger-for-jordbruk/tilskudd-til-spesielle-miljotiltak-i-jordbruket-smil'],
    ['biogass', 'Husdyrgjødsel til biogass', 'jordbruk/ordninger-for-jordbruk/tilskudd-for-a-levere-husdyrgjodsel-til-biogassanlegg'], ['beitelag', 'Drift av beitelag (OBB)', 'jordbruk/ordninger-for-jordbruk/tilskudd-til-drift-av-beitelag-obb'],
    ['beiteomrader', 'Tiltak i beiteområder', 'jordbruk/ordninger-for-jordbruk/tilskudd-til-tiltak-i-beiteomrader'], ['avlosning-sykdom', 'Avløsning ved sykdom og fødsel', 'jordbruk/ordninger-for-jordbruk/soke-tilskudd-til-avlosning-ved-sykdom-og-fodsel'],
    ['skogbruksplan', 'Skogbruksplanlegging', 'skogbruk/ordninger-for-skogbruk/tilskudd-til-skogbruksplanlegging-med-miljoregistreringer'], ['miljotiltak-skog', 'Miljøtiltak i skog', 'skogbruk/ordninger-for-skogbruk/tilskudd-til-miljotiltak-i-skog'],
    ['taubane', 'Taubane, hest og andre driftsmetoder', 'skogbruk/ordninger-for-skogbruk/tilskudd-til-skogsdrift-med-taubane-hest-og-andre-driftsmetoder'], ['tommerkai', 'Tømmerkai', 'skogbruk/ordninger-for-skogbruk/tilskudd-til-tommerkai'],
    ['vindfall-amy', 'Vindfall etter stormen Amy', 'skogbruk/ordninger-for-skogbruk/tilskudd-til-opprydding-av-vindfall-etter-stormen-amy-den-4.oktober-2025'],
  ].map(([id, navn, sti]) => ({ id: `ldir:${id}`, gruppe: 'Satser og tilskudd', navn: `Tilskudd: ${navn}`, url: `${LDIR}/${sti}`, linjer: /prosent|%|kr |kroner|frist|inntil|per dekar|per dyr|kommuner/i })),
  { id: 'ldir:eudr', gruppe: 'Standarder', navn: 'EUDR – status for Norge (Landbruksdirektoratet)', url: `${LDIR}/skogbruk/eus-avskogingsforordning-eudr`, linjer: /EØS|innlemm|norsk rett|30\. desember|30\. juni|utsett|lav risiko|lavrisiko|informasjonssystem|EORI|forenkl|vareomfang/i },
  { id: 'ldir:rmp', gruppe: 'Satser og tilskudd', navn: 'Regionalt miljøtilskudd', url: `${LDIR}/jordbruk/ordninger-for-jordbruk/regionalt-miljotilskudd-rmb`, linjer: /frist|søknad|kr/i },
  { id: 'pefc:standard', gruppe: 'Standarder', navn: 'Norsk PEFC Skogstandard', url: 'https://www.pefc.no/vare-standarder/norsk-pefc-skog-standard', linjer: /PEFC N|gjeldende|revisjon|ny standard|høring/i },
  { id: 'ksl:oversikt', gruppe: 'Standarder', navn: 'KSL-standarden – kapitler', url: 'https://www.ksl.no/ksl-standarden/', lenker: /ksl-standarden\/[a-z]/ },
  { id: 'mattilsynet:storfe', gruppe: 'Veiledere', navn: 'Mattilsynet: storfe', url: 'https://www.mattilsynet.no/dyr/produksjonsdyr/storfe', linjer: /krav|frist|forskrift|løsdrift/i },
  { id: 'mattilsynet:hest', gruppe: 'Veiledere', navn: 'Mattilsynet: hest', url: 'https://www.mattilsynet.no/dyr/kjaeledyr/hest', linjer: /krav|forskrift/i },
  { id: 'nibio:gjodsling-korn', gruppe: 'Veiledere', navn: 'NIBIO Gjødslingshåndbok: korn', url: 'https://www.nibio.no/tema/jord/gjodslingshandbok/gjodslingsnormer/1.korn', linjer: /kg|normavling|N|P|K/ },
  { id: 'nibio:gjodsling-eng', gruppe: 'Veiledere', navn: 'NIBIO Gjødslingshåndbok: eng', url: 'https://www.nibio.no/tema/jord/gjodslingshandbok/gjodslingsnormer/6.eng-og-forvekster', linjer: /kg|FEm|N|P|K/ },
];
// KSL-kapitlene vi har i appen: siden lenker til PDF-en, og versjonen står i filnavnet.
const KSL_SIDER = { 1: 'generelle-krav-til-garden', 10: 'helse-miljo-og-sikkerhet', 15: 'grovfor-korn-fro-olje-og-belgvekster', 20: 'potet', 25: 'gronnsaker-frukt-og-baer', 30: 'drovtyggere-generelt', 31: 'storfe', 32: 'smafe', 35: 'melk', 40: 'svin', 50: 'fjorfe-generelt', 51: 'eggproduksjon', 52: 'oppal-fjorfe', 53: 'slaktekylling', 54: 'kalkun-ender-og-gjess', 60: 'honning', 70: 'hest-i-naering', 110: 'juletre' };
// SSB-tabeller: når de oppdateres, kan prisene og kostnadene i appen kalibreres på nytt.
const SSB_TABELLER = { '03794': 'Bruttoverdi avvirkning for salg (tømmerpriser)', '03895': 'Avvirkning for salg etter sortiment', '06108': 'Kostnader og tilskudd til skogkultur', '05543': 'Gjødsling av skog – areal og kostnad', '09066': 'Skogfondregnskapet' };
// Datakilder appen henter fra (bare tilgjengelighet).
const ENDEPUNKTER = [
  ['NIBIO AR5', 'https://wms.nibio.no/cgi-bin/ar5?SERVICE=WMS&REQUEST=GetCapabilities'], ['NIBIO SR16', 'https://wms.nibio.no/cgi-bin/sr16?SERVICE=WMS&REQUEST=GetCapabilities'],
  ['NIBIO beite', 'https://wms.nibio.no/cgi-bin/beite?SERVICE=WMS&REQUEST=GetCapabilities'], ['NIBIO jordsmonn', 'https://wms.nibio.no/cgi-bin/jordsmonn_harmonisert?SERVICE=WMS&REQUEST=GetCapabilities'],
  ['NIBIO markfuktighet', 'https://wms.nibio.no/cgi-bin/markfuktighetskart?SERVICE=WMS&REQUEST=GetCapabilities'], ['Miljødirektoratet vern', 'https://kart.miljodirektoratet.no/arcgis/rest/services/vern/MapServer?f=json'],
  ['Miljødirektoratet naturtyper', 'https://kart.miljodirektoratet.no/arcgis/rest/services/naturtyper_nin/MapServer?f=json'], ['Kartverket topo', 'https://cache.kartverket.no/v1/wmts/1.0.0/WMTSCapabilities.xml'],
  ['Geonorge matrikkel/eiendom', 'https://ws.geonorge.no/kommuneinfo/v1/kommuner'], ['NVDB', 'https://nvdbapiles.atlas.vegvesen.no/vegnett/api/v4/veglenkesekvenser/segmentert?kommune=3401&antall=1'], ['MET værvarsel', 'https://api.met.no/weatherapi/locationforecast/2.0/status'],
  ['SSB API', 'https://data.ssb.no/api/v0/no/table/03794'],
  ['Valhalla lastebilruting (tømmertransport)', 'https://valhalla1.openstreetmap.de/status'],
  ['NVDB bruksklasse tømmertransport (900)', 'https://nvdbapiles.atlas.vegvesen.no/vegobjekttyper/900'],
  ['Markagrensa (Kartverket WFS)', 'https://wfs.geonorge.no/skwms1/wfs.markagrensen?service=WFS&request=GetCapabilities'],
  ['Markagrensa (Kartverket WMS)', 'https://wms.geonorge.no/skwms1/wms.markagrensen?service=WMS&request=GetCapabilities'],
];
// Kan ikke hentes automatisk (blokkerer roboter) – må sjekkes for hånd.
export const MANUELT = [
  ['Tømmerterminaler i Veier › Tømmertransport (Lierstranda avvikles etter planen innen utgangen av 2027 – bytt terminal i js/transport.js når den stenger)', 'https://www.drammenhavn.no/'],
  ['Rundskriv M-1/2021 Konsesjon, priskontroll og boplikt', 'https://www.regjeringen.no/no/dokumenter/konsesjon-priskontroll-og-boplikt/id2849398/'],
  ['Jordbruksavtalen (nye satser etter jordbruksoppgjøret i mai/juni)', 'https://www.regjeringen.no/no/tema/mat-fiske-og-landbruk/jordbruk/jordbruksavtalen/id2350633/'],
  ['Statsforvalteren: NMSK-satser og retningslinjer i ditt fylke (ungskogpleie, planting, veibygging)', 'https://www.statsforvalteren.no/'],
  ['Tømmerpriser fra skogeierandelslagene (prislister, driftspriser)', 'https://www.skogeierforbundet.no/'],
];

// ---------- hjelpere ----------
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
const vent = (ms) => new Promise((r) => setTimeout(r, ms));
async function hent(url, { tekst = true, tid = 25000 } = {}) {
  for (let forsok = 0; ; forsok++) {
    try {
      const r = await fetch(url, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(tid) });
      return { status: r.status, ok: r.ok, url: r.url, body: tekst ? await r.text() : null };
    } catch (e) { if (forsok >= 1) return { status: 0, ok: false, feil: e.message }; await vent(2000); }
  }
}
export function rensHtml(h) {
  return String(h).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>|<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<\/(p|h\d|li|tr|div|td|th|dt|dd)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x2F;/g, '/').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .split('\n').map((l) => l.replace(/[\s​]+/g, ' ').trim()).filter(Boolean);
}
// Lovdata: «Sist endret | FOR-…», ikrafttredelse og om forskriften er opphevet.
export function lovdataMeta(html) {
  const l = rensHtml(html); const finn = (navn) => { const i = l.findIndex((x) => x === navn || x.startsWith(`${navn} `)); return i >= 0 ? (l[i] === navn ? l[i + 1] : l[i].slice(navn.length + 1)) : null; };
  const tittel = (String(html).match(/<title>([^<]*)/) || [])[1]?.replace(/ - Lovdata$/, '').trim() || null;
  // Opphevede forskrifter har feltet «Opphevet» i metadatatabellen (ikke å forveksle med «§ 30. (Opphevet)»).
  const hj = l.find((x) => /^Hjemmel:/.test(x)) || ''; const om = hj.match(/Opphevet ved (.*?\(i kraft [^)]*\))/); const opphevetDato = om ? om[1] : (l.includes('Opphevet') ? 'ja' : null);
  return { tittel, sistEndret: finn('Sist endret'), ikraft: finn('Ikrafttredelse'), opphevet: !!opphevetDato, opphevetDato };
}
const kslVersjon = (html) => { const m = String(html).match(/\/([A-Za-z-]+?)-(\d{4}\.\d+[a-z]?)-nb-no[^"]*\.pdf/); return m ? { versjon: m[2], pdf: m[0].slice(1) } : null; };

// ---------- sjekkene ----------
async function sjekkAlt({ lenker = false } = {}) {
  const ut = {}; const kode = {};
  const { KSL_KAPITLER } = await import(path.join(ROT, 'js/ksl-standard.js'));
  const { STANDARD } = await import(path.join(ROT, 'js/pefc.js'));
  const { STANDARD_INNSTILLINGER } = await import(path.join(ROT, 'js/model.js'));
  const { PT_KILDE } = await import(path.join(ROT, 'js/husdyr.js'));
  const TS = await import(path.join(ROT, 'js/tilskudd.js')); kode.tilskuddKontrollert = TS.KONTROLLERT; kode.tilskuddUrler = TS.ORDNINGER.map((o) => o.url);
  kode.ksl = Object.fromEntries(KSL_KAPITLER.map((k) => [k.nr, k.versjon])); kode.pefc = STANDARD.kode; kode.ptAar = PT_KILDE.aar; kode.pris = STANDARD_INNSTILLINGER.pris; kode.drift = STANDARD_INNSTILLINGER.drift;

  for (const k of LOVER) {
    const r = await hent(k.url);
    ut[k.id] = r.ok ? { ...k, ok: true, ...lovdataMeta(r.body) } : { ...k, ok: false, status: r.status, feil: r.feil };
    ut[k.id].fingeravtrykk = ut[k.id].ok ? sha(`${ut[k.id].sistEndret}|${ut[k.id].opphevet}`) : null;
  }
  for (const s of SIDER) {
    const r = await hent(s.url);
    if (!r.ok) { ut[s.id] = { ...s, ok: false, status: r.status, feil: r.feil }; continue; }
    const linjer = rensHtml(r.body);
    const utdrag = s.lenker ? [...new Set([...r.body.matchAll(/href="([^"#]+)"/g)].map((m) => m[1].replace(/&#x2F;/g, '/')).filter((h) => s.lenker.test(h)))].sort() : [...new Set(linjer.filter((l) => s.linjer.test(l) && l.length < 600).map((l) => l.replace(/^Regelverk /, '')))].sort(); // rekkefølgen på siden betyr ikke noe
    ut[s.id] = { ...s, lenker: undefined, linjer: undefined, ok: true, utdrag, fingeravtrykk: sha(utdrag.join('\n')) };
  }
  for (const [nr, side] of Object.entries(KSL_SIDER)) {
    const r = await hent(`https://www.ksl.no/ksl-standarden/${side}/`);
    const v = r.ok ? kslVersjon(r.body) : null;
    ut[`ksl:${nr}`] = { id: `ksl:${nr}`, gruppe: 'Standarder', navn: `KSL kapittel ${nr}`, url: `https://www.ksl.no/ksl-standarden/${side}/`, ok: !!v, status: r.status, ...(v || {}), iKoden: kode.ksl[nr] || null, fingeravtrykk: v ? sha(v.versjon) : null };
  }
  for (const [id, navn] of Object.entries(SSB_TABELLER)) {
    const r = await hent(`https://data.ssb.no/api/pxwebapi/v2/tables/${id}?lang=no`);
    let oppdatert = null; let siste = null;
    try { const d = JSON.parse(r.body); oppdatert = d.updated?.slice(0, 10) || null; siste = d.lastPeriod || null; } catch { /* svarte ikke JSON */ }
    ut[`ssb:${id}`] = { id: `ssb:${id}`, gruppe: 'Priser og kostnader', navn: `SSB ${id}: ${navn}`, url: `https://www.ssb.no/statbank/table/${id}`, ok: !!oppdatert, oppdatert, siste, fingeravtrykk: oppdatert ? sha(`${oppdatert}|${siste}`) : null };
  }
  // Tømmerpris: landsgjennomsnitt fra SSB mot standardprisene i appen (brukes når planen ikke er kalibrert mot kommunen).
  try {
    const { hentSsbPriser, kalibrerPriser } = await import(path.join(ROT, 'js/verdi.js'));
    const d = await hentSsbPriser('0301'); const land = { ...d, grunnlag: '0' }; const k = kalibrerPriser(land, kode.pris);
    const vol = d.land.perTreslag; const snitt = (vol.G * kode.pris.G + vol.F * kode.pris.F + vol.L * kode.pris.L) / (vol.G + vol.F + vol.L);
    ut['pris:tommer'] = { id: 'pris:tommer', gruppe: 'Priser og kostnader', navn: `Tømmerpris, landsgjennomsnitt ${d.aar} (SSB)`, url: 'https://www.ssb.no/statbank/table/03794', ok: true, aar: d.aar, ssbPris: Math.round(d.land.pris), appSnitt: Math.round(snitt), avvik: d.land.pris / snitt - 1, forslag: k ? { G: k.G, F: k.F, L: k.L } : null, fingeravtrykk: sha(`${d.aar}|${Math.round(d.land.pris)}`) };
  } catch (e) { ut['pris:tommer'] = { id: 'pris:tommer', gruppe: 'Priser og kostnader', navn: 'Tømmerpris (SSB)', ok: false, feil: e.message }; }
  for (const [navn, url] of ENDEPUNKTER) {
    const r = await hent(url, { tid: 20000 });
    ut[`api:${navn}`] = { id: `api:${navn}`, gruppe: 'Datakilder', navn, url, ok: r.ok, status: r.status, feil: r.feil, fingeravtrykk: r.ok ? 'ok' : `feil ${r.status}` };
  }
  if (lenker) {
    const filer = [...fs.readdirSync(path.join(ROT, 'js')).filter((f) => f.endsWith('.js')).map((f) => path.join(ROT, 'js', f)), ...fs.readdirSync(ROT).filter((f) => f.endsWith('.html')).map((f) => path.join(ROT, f))];
    const alle = new Set(); for (const f of filer) for (const m of fs.readFileSync(f, 'utf8').matchAll(/https:\/\/[^\s"'`<>)\\]+/g)) { const u = m[0].replace(/[.,;]+$/, ''); if (!/[${}]|\?.*=$|api\.|publicapi|wms\.|\/rest\/|\/arcgis$|geocortex|cgi-bin|tile|wmts|unpkg|jsdelivr|googleapis|gstatic|\/v[0-9]\//.test(u)) alle.add(u); }
    const brutt = [];
    for (const u of [...alle].sort()) { const r = await hent(u, { tekst: false, tid: 15000 }); if (r.status === 404 || r.status === 410 || (r.status >= 500) || r.status === 0) brutt.push({ url: u, status: r.status || r.feil }); }
    ut['lenker'] = { id: 'lenker', gruppe: 'Lenker i appen', navn: `Lenker i koden (${alle.size} sjekket)`, ok: !brutt.length, brutt, fingeravtrykk: sha(brutt.map((b) => b.url).join('\n')) };
  }
  return { tid: new Date().toISOString(), kilder: ut, kode };
}

// ---------- vurdering ----------
export function vurder(naa, forrige) {
  const funn = [];
  const legg = (nivaa, kilde, tekst, tiltak = '') => funn.push({ nivaa, gruppe: kilde.gruppe, navn: kilde.navn, url: kilde.url, tekst, tiltak });
  for (const k of Object.values(naa.kilder)) {
    const f = forrige?.kilder?.[k.id];
    if (!k.ok && k.gruppe !== 'Datakilder' && k.id !== 'lenker') { legg('varsel', k, `Kunne ikke hentes (${k.status || k.feil || 'ukjent feil'}).`, 'Sjekk om siden er flyttet, og oppdater lenken i koden og i verktoy/kildesjekk.mjs.'); continue; }
    if (k.gruppe === 'Datakilder' && !k.ok) { legg('varsel', k, `Datakilden svarer ikke (${k.status || k.feil}).`, 'Følg med – virker den ikke neste uke, må appen tilpasses.'); continue; }
    if (k.lovdata && k.opphevet && !k.kjentOpphevet) legg('viktig', k, `Forskriften/loven er opphevet (${k.opphevetDato}).`, 'Finn den nye forskriften og oppdater krav og lenker i appen.');
    if (k.id.startsWith('ksl:') && k.iKoden && k.versjon && k.versjon !== k.iKoden) legg('viktig', k, `Ny versjon ${k.versjon} (appen har ${k.iKoden}).`, `Les inn den nye PDF-en med verktoy/ksl-fra-pdf.py og oppdater js/ksl-standard.js.`);
    if (k.id === 'pefc:standard') { const koder = [...new Set((k.utdrag || []).join(' ').match(/PEFC N ?\d+:\d{4}/g) || [])]; if (koder.some((x) => x.replace(' ', '') !== naa.kode.pefc.replace(' ', '') && x !== naa.kode.pefc)) legg('viktig', k, `Siden nevner ${koder.join(', ')} – appen bruker ${naa.kode.pefc}.`, 'Sjekk om ny PEFC-standard er vedtatt, og oppdater js/pefc.js og js/pefc-data.js.'); }
    // Nye tilskuddsordninger: lenker som har kommet til siden forrige uke (oversiktssidene for skog og jord).
    if ((k.id === 'ldir:skogordninger' || k.id === 'ldir:jordordninger') && f?.utdrag) { const nye = (k.utdrag || []).filter((h) => !f.utdrag.includes(h) && /tilskudd|tilskot|kompensasjon|erstatning/.test(h)); if (nye.length) legg('viktig', k, `Ny ordning: ${nye.map((h) => h.split('/').pop()).join(', ')}.`, 'Vurder å legge den inn i js/tilskudd.js (fanen Tilskudd) med krav, sats og frist.'); }
    if (k.id === 'ldir:eudr' && f?.utdrag && f.fingeravtrykk !== k.fingeravtrykk) legg('viktig', k, 'Status for EUDR har endret seg – sjekk om forordningen er tatt inn i EØS-avtalen, om fristene er endret, eller om kravene er forenklet.', 'Oppdater STATUS og KONTROLLERT i js/eudr.js og teksten i fanen EUDR.');
    if (k.id === 'ldir:pt-oversikt') { const aar = Math.max(0, ...(k.utdrag || []).map((h) => Number((h.match(/satser-?(\d{4})/) || [])[1]) || 0)); const ny = (k.utdrag || []).find((h) => /endelige-satser/.test(h)); if (aar > naa.kode.ptAar) legg('viktig', k, `Nye satser for ${aar} er publisert (appen bruker ${naa.kode.ptAar}).`, 'Oppdater PT og PT_KILDE i js/husdyr.js.'); else if (ny && f?.utdrag && !f.utdrag.includes(ny)) legg('info', k, 'Lenken til endelige satser er endret.'); }
    if (k.id === 'pris:tommer' && Math.abs(k.avvik) > 0.1) legg('viktig', k, `SSB-snittet for ${k.aar} er ${k.ssbPris} kr/m³, mens standardprisene i appen gir ca. ${k.appSnitt} kr/m³ (${k.avvik > 0 ? '+' : ''}${Math.round(k.avvik * 100)} %).`, `Oppdater STANDARD_INNSTILLINGER.pris i js/model.js, f.eks. til gran ${k.forslag?.G}, furu ${k.forslag?.F}, lauv ${k.forslag?.L} kr/m³. Planer som er kalibrert mot kommunen, påvirkes ikke.`);
    if (k.id === 'lenker' && k.brutt?.length) legg('varsel', k, `${k.brutt.length} lenker virker ikke: ${k.brutt.map((b) => `${b.url} (${b.status})`).join(', ')}`, 'Finn ny adresse og oppdater koden.');
    if (!f) continue; // første gang: ingen sammenligning
    if (f.fingeravtrykk && k.fingeravtrykk && f.fingeravtrykk !== k.fingeravtrykk && k.gruppe !== 'Datakilder' && k.id !== 'lenker') {
      if (k.lovdata) legg('viktig', k, `Endret: sist endret ${f.sistEndret || '–'} → ${k.sistEndret || '–'}.`, 'Les endringen på Lovdata og vurder om krav, tall eller tekster i appen må endres.');
      else if (k.id.startsWith('ssb:')) legg('info', k, `Nye tall (oppdatert ${k.oppdatert}${k.siste ? `, siste periode ${k.siste}` : ''}).`, k.id === 'ssb:06108' || k.id === 'ssb:05543' ? 'Vurder kostnadene per daa (kostPerDaa) i js/model.js.' : 'Prisene i appen kalibreres automatisk når en plan lages. Sjekk standardprisene.');
      else if (!k.id.startsWith('ksl:')) {
        const før = new Set(f.utdrag || []); const nye = (k.utdrag || []).filter((x) => !før.has(x)); const borte = (f.utdrag || []).filter((x) => !new Set(k.utdrag || []).has(x));
        legg('viktig', k, `Innholdet er endret.${nye.length ? ` Nytt: «${nye.slice(0, 4).join('» «').slice(0, 600)}»` : ''}${borte.length ? ` Borte: «${borte.slice(0, 3).join('» «').slice(0, 300)}»` : ''}`, 'Vurder om satser, krav eller tekster i appen må endres.');
      }
    }
  }
  // Tilskuddskatalogen bør kontrolleres minst hvert halvår.
  const tk = naa.kode?.tilskuddKontrollert; if (tk && (Date.parse(naa.tid) - Date.parse(tk)) / 864e5 > 180) funn.push({ nivaa: 'varsel', gruppe: 'Satser og tilskudd', navn: 'Tilskuddskatalogen (js/tilskudd.js)', url: '', tekst: `Sist kontrollert ${tk}.`, tiltak: 'Gå gjennom satser, krav og frister i js/tilskudd.js og oppdater KONTROLLERT.' });
  const rang = { viktig: 0, varsel: 1, info: 2 };
  return funn.sort((a, b) => rang[a.nivaa] - rang[b.nivaa]);
}

export function rapport(naa, funn) {
  const ikon = { viktig: '🔴', varsel: '🟡', info: 'ℹ️' };
  const k = Object.values(naa.kilder);
  const linjer = [`# Kildesjekk ${naa.tid.slice(0, 10)}`, '', `${k.length} kilder sjekket · ${funn.filter((f) => f.nivaa === 'viktig').length} viktige funn · ${funn.filter((f) => f.nivaa === 'varsel').length} varsler · ${funn.filter((f) => f.nivaa === 'info').length} info`, ''];
  if (funn.length) { linjer.push('## Funn', ''); for (const f of funn) linjer.push(`- ${ikon[f.nivaa]} **${f.navn}** – ${f.tekst}${f.tiltak ? `\n  - Tiltak: ${f.tiltak}` : ''}${f.url ? `\n  - Kilde: ${f.url}` : ''}`); linjer.push(''); } else linjer.push('Ingen endringer siden forrige sjekk.', '');
  linjer.push('## Status', '');
  for (const g of [...new Set(k.map((x) => x.gruppe))]) {
    linjer.push(`### ${g}`, '');
    for (const x of k.filter((y) => y.gruppe === g)) linjer.push(`- ${x.ok ? '✅' : '❌'} ${x.navn}${x.sistEndret ? ` – sist endret ${x.sistEndret}` : ''}${x.versjon ? ` – versjon ${x.versjon}${x.iKoden && x.iKoden !== x.versjon ? ` (appen: ${x.iKoden})` : ''}` : ''}${x.oppdatert ? ` – oppdatert ${x.oppdatert}` : ''}${x.ssbPris ? ` – SSB ${x.ssbPris} kr/m³, appen ca. ${x.appSnitt} kr/m³` : ''}`);
    linjer.push('');
  }
  linjer.push('## Må sjekkes for hånd', '', ...MANUELT.map(([n, u]) => `- ${n}: ${u}`), '', `Driftspriser (hogst og utkjøring): appen bruker gran ${naa.kode.drift.G}, furu ${naa.kode.drift.F}, lauv ${naa.kode.drift.L} kr/m³. Det finnes ingen åpen offentlig statistikk – sammenlign med prislistene fra skogeierandelslagene og entreprenørene.`, '');
  return linjer.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const forrige = fs.existsSync(STATUS) ? JSON.parse(fs.readFileSync(STATUS, 'utf8')) : null;
  const naa = await sjekkAlt({ lenker: arg('--lenker') });
  const funn = vurder(naa, forrige);
  const tekst = rapport(naa, funn);
  const fil = argVerdi('--rapport'); if (fil) fs.writeFileSync(fil, tekst); else console.log(tekst);
  if (argVerdi('--json')) fs.writeFileSync(argVerdi('--json'), JSON.stringify({ funn, tid: naa.tid }, null, 1));
  if (arg('--oppdater')) { fs.writeFileSync(STATUS, `${JSON.stringify(naa, null, 1)}\n`); console.error(`Lagret referanse i ${path.relative(ROT, STATUS)}`); }
  console.error(`${funn.filter((f) => f.nivaa === 'viktig').length} viktige funn, ${funn.filter((f) => f.nivaa === 'varsel').length} varsler.`);
}
