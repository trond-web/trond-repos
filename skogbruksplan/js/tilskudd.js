// 💰 Tilskudd gårdbrukeren kan søke: hva ordningen er, hva den kan gi i kroner for denne gården, kravene og fristene,
// tilpasset fylket og kommunen gården ligger i. Ingen DOM – testes i Node.
//
// Kilder: Landbruksdirektoratets sider om ordningene (lenket per ordning) og endelige satser for produksjonstilskudd
// (js/husdyr.js). Regionale satser (RMP, skogkultur, veibygging, beitelag) fastsettes av Statsforvalteren og kommunen,
// og lenkes til der. Hver ordning har datoen den sist ble kontrollert. Den ukentlige kildesjekken
// (verktoy/kildesjekk.mjs) overvåker kildene og melder fra når noe endres, så katalogen kan oppdateres.
import { produksjonstilskudd, PT_KILDE, beiteplan } from './husdyr.js';
import { tiltakKostnad, STANDARD_INNSTILLINGER } from './model.js';
import { KULTURER } from './skifteplan.js';
import { drift } from './driftsomrader.js';

export const KONTROLLERT = '2026-11-25';
const LD = 'https://www.landbruksdirektoratet.no/nb';
const SF = 'https://www.statsforvalteren.no';

// Fylker (inndeling fra 2024) og Statsforvalteren som forvalter de regionale ordningene der.
export const FYLKER = {
  '03': { navn: 'Oslo', sf: 'nb/ostfold-buskerud-oslo-og-akershus' }, 31: { navn: 'Østfold', sf: 'nb/ostfold-buskerud-oslo-og-akershus' },
  32: { navn: 'Akershus', sf: 'nb/ostfold-buskerud-oslo-og-akershus' }, 33: { navn: 'Buskerud', sf: 'nb/ostfold-buskerud-oslo-og-akershus' },
  34: { navn: 'Innlandet', sf: 'nb/innlandet' }, 39: { navn: 'Vestfold', sf: 'nb/vestfold-og-telemark' }, 40: { navn: 'Telemark', sf: 'nb/vestfold-og-telemark' },
  42: { navn: 'Agder', sf: 'nb/agder', kyst: true }, 11: { navn: 'Rogaland', sf: 'nn/rogaland', kyst: true }, 46: { navn: 'Vestland', sf: 'nn/vestland', kyst: true },
  15: { navn: 'Møre og Romsdal', sf: 'nn/more-og-romsdal', kyst: true }, 50: { navn: 'Trøndelag', sf: 'nb/trondelag', kyst: true },
  18: { navn: 'Nordland', sf: 'nb/nordland', kyst: true, nord: true }, 55: { navn: 'Troms', sf: 'nb/troms-og-finnmark', kyst: true, nord: true },
  56: { navn: 'Finnmark', sf: 'nb/troms-og-finnmark', kyst: true, nord: true },
};
// Kommuner med tilskudd til opprydding etter stormen Amy (4. oktober 2025).
const AMY = ['Molde', 'Ålesund', 'Vestnes', 'Rauma', 'Gjemnes', 'Tingvoll', 'Sunndal', 'Surnadal', 'Oppdal', 'Rennebu', 'Orkland'];

// Hvor gården ligger: kommune, fylke, Statsforvalteren og kystskogbruket (planting er vanligst der).
export function region(S) {
  const nr = String(S?.eiendom?.kommunenr || '').padStart(4, '0'); const f = FYLKER[nr.slice(0, 2)] || FYLKER[Number(nr.slice(0, 2))] || null;
  const kommune = S?.eiendom?.kommune || '';
  return { kommunenr: nr === '0000' ? null : nr, kommune, fylke: f?.navn || null, statsforvalter: f ? { navn: `Statsforvalteren i ${f.sf.includes('ostfold') ? 'Østfold, Buskerud, Oslo og Akershus' : f.sf.includes('vestfold') ? 'Vestfold og Telemark' : f.sf.includes('troms') ? 'Troms og Finnmark' : f.navn}`, url: `${SF}/${f.sf}/` } : { navn: 'Statsforvalteren', url: `${SF}/` }, kyst: !!f?.kyst, nord: !!f?.nord };
}

// Planlagte skogtiltak de neste to årene: kostnad per type (kr), med areal fra bestandet.
function planlagteTiltak(S, aar) {
  const inn = { ...STANDARD_INNSTILLINGER, ...(S?.innstillinger || {}) }; const ut = {};
  for (const b of S?.bestand || []) for (const t of b.tiltak || []) {
    if (t.status === 'utfort' || !(Number(t.aar) >= aar && Number(t.aar) <= aar + 1)) continue;
    const a = b.areal || 0; const k = tiltakKostnad(t.type, a, inn) || 0;
    ut[t.type] = ut[t.type] || { kostnad: 0, areal: 0, antall: 0 }; ut[t.type].kostnad += k; ut[t.type].areal += a; ut[t.type].antall++;
  }
  return ut;
}
const kr = (x) => Math.round(x / 100) * 100;
const daa = (x) => Math.round(x * 10) / 10;

// Ordningene. relevant(ctx) → { status: 'aktuell' | 'mulig' | 'ikke', grunn }, belop(ctx) → { kr, tekst, usikker } | null.
export const ORDNINGER = [
  // ---------- skog ----------
  { id: 'skogkultur', omrade: 'skog', navn: 'Tilskudd til skogkultur (NMSK)', forvalter: 'kommune', url: `${LD}/skogbruk/ordninger-for-skogbruk/tilskudd-til-skogkultur`,
    kort: 'Tilskudd til foryngelse, planting, suppleringsplanting, markberedning, ungskogpleie, stammekvisting og grøfting. Kommunen bestemmer hvilke tiltak og hvilken sats.',
    krav: ['Søk etter at arbeidet er utført, med fakturaer for planter og arbeid', 'Kommunens prioriteringer og satser gjelder – de varierer mellom kommuner og fylker', 'Ikke tilskudd til kjemiske midler, utstyr eller tiltak som gir overskudd', 'Søknaden sendes i Skogfondssystemet (Altinn), sammen med utbetaling fra skogfond'],
    frist: () => 'Normalt rundt 1. desember – kommunen fastsetter fristen',
    relevant: (c) => { const n = ['planting', 'suppleringsplanting', 'markberedning', 'ungskogpleie', 'stammekvisting'].reduce((s, t) => s + (c.tiltak[t]?.antall || 0), 0); return n ? { status: 'aktuell', grunn: `${n} planlagte skogkulturtiltak i ${c.aar}–${c.aar + 1}` } : c.harSkog ? { status: 'mulig', grunn: 'Ingen planlagte skogkulturtiltak de neste to årene' } : { status: 'ikke', grunn: 'Ingen skog i planen' }; },
    belop: (c) => { const typer = ['planting', 'suppleringsplanting', 'markberedning', 'ungskogpleie', 'stammekvisting']; const kost = typer.reduce((s, t) => s + (c.tiltak[t]?.kostnad || 0), 0); if (!kost) return null; const sats = c.satser.skogkultur; return sats != null ? { kr: kr((kost * sats) / 100), tekst: `${sats} % av ca. ${kr(kost).toLocaleString('nb-NO')} kr i kostnad`, usikker: false } : { kr: null, tekst: `Kostnad ca. ${kr(kost).toLocaleString('nb-NO')} kr – legg inn kommunens sats for å regne ut tilskuddet`, sats: 'skogkultur' }; } },
  { id: 'gjodsling-skog', omrade: 'skog', navn: 'Gjødsling av skog som klimatiltak', forvalter: 'kommune', url: `${LD}/skogbruk/ordninger-for-skogbruk/tilskudd-til-gjodsling-av-skog-som-klimatiltak`,
    kort: 'Inntil 40 % tilskudd av dokumenterte kostnader til gjødsling av produksjonsskog.', sats: '40 %',
    krav: ['Produksjonsskog med under 20 % lauv', 'Furu bonitet F8–F17 eller gran G8–G20', 'Lav bør utgjøre under 50 % av marksjiktet'],
    frist: () => 'Kommunen fastsetter fristen',
    relevant: (c) => (c.tiltak.gjodsling ? { status: 'aktuell', grunn: `Gjødsling planlagt i ${c.tiltak.gjodsling.antall} bestand` } : c.harSkog ? { status: 'mulig', grunn: 'Kan passe i eldre produksjonsskog 10 år før hogst (se Karbon)' } : { status: 'ikke', grunn: 'Ingen skog i planen' }),
    belop: (c) => (c.tiltak.gjodsling ? { kr: kr(c.tiltak.gjodsling.kostnad * 0.4), tekst: `40 % av ca. ${kr(c.tiltak.gjodsling.kostnad).toLocaleString('nb-NO')} kr (${daa(c.tiltak.gjodsling.areal)} daa)` } : null) },
  { id: 'tettere-planting', omrade: 'skog', navn: 'Tettere planting som klimatiltak', forvalter: 'kommune', url: `${LD}/skogbruk/ordninger-for-skogbruk/tilskudd-til-tettere-skogplanting-som-klimatiltak`,
    kort: 'Inntil 30 % tilskudd ved nyplanting og 30 % ved suppleringsplanting (inntil 75 planter per daa).', sats: '30 %',
    krav: ['Planting tettere enn det som er påkrevd etter forskriften', 'Gjelder nyplanting og suppleringsplanting', 'Kan kombineres med kommunens skogkulturtilskudd etter kommunens regler'],
    frist: () => 'Kommunen fastsetter fristen',
    relevant: (c) => (c.tiltak.planting || c.tiltak.suppleringsplanting ? { status: 'aktuell', grunn: 'Planting planlagt' } : c.harSkog ? { status: 'mulig', grunn: 'Aktuelt når du planter etter hogst' } : { status: 'ikke', grunn: 'Ingen skog i planen' }),
    belop: (c) => { const k = (c.tiltak.planting?.kostnad || 0) + (c.tiltak.suppleringsplanting?.kostnad || 0); return k ? { kr: kr(k * 0.3), tekst: `30 % av ca. ${kr(k).toLocaleString('nb-NO')} kr i plantekostnad (anslag – gjelder plantene ut over minstekravet)`, usikker: true } : null; } },
  { id: 'veibygging', omrade: 'skog', navn: 'Tilskudd til veibygging i skog', forvalter: 'kommune', url: `${LD}/skogbruk/ordninger-for-skogbruk/tilskudd-til-veibygging-i-skog`,
    kort: 'Tilskudd til nybygging og ombygging av skogsbilveier og traktorveier. Satsen fastsettes regionalt.',
    krav: ['Veien må være godkjent etter forskrift om landbruksveier før byggestart', 'Veien skal vedlikeholdes til den standarden den ble bygd', 'Skjema LDIR-903 med kostnadsoverslag og andeler per eiendom'],
    frist: () => 'Kommunen og Statsforvalteren fastsetter fristen',
    relevant: (c) => (c.planlagteVeier ? { status: 'aktuell', grunn: `${c.planlagteVeier} planlagt${c.planlagteVeier > 1 ? 'e' : ''} vei${c.planlagteVeier > 1 ? 'er' : ''} i planen` } : c.harSkog ? { status: 'mulig', grunn: 'Se Driftsforhold for skog langt fra vei' } : { status: 'ikke', grunn: 'Ingen skog i planen' }),
    belop: () => null },
  { id: 'skogbruksplan', omrade: 'skog', navn: 'Skogbruksplanlegging med miljøregistreringer', forvalter: 'statsforvalter', url: `${LD}/skogbruk/ordninger-for-skogbruk/tilskudd-til-skogbruksplanlegging-med-miljoregistreringer`,
    kort: 'Tilskudd til ny skogbruksplan med miljøregistreringer (områdetakst), og inntil 50 % til kurs i bruk av planen.',
    krav: ['Forhåndsbestilt plan på minst 50 % av arealet i takstområdet', 'PEFC krever ny plan med miljøregistreringer hvert 10.–15. år'],
    frist: () => 'Avtales med Statsforvalteren eller skogbruksansvarlig i kommunen',
    relevant: (c) => (c.takstAlder != null && c.takstAlder >= 10 ? { status: 'aktuell', grunn: `Taksten er ${c.takstAlder} år gammel` } : c.harSkog ? { status: 'mulig', grunn: c.takstAlder != null ? `Taksten er ${c.takstAlder} år gammel` : 'Takståret er ukjent' } : { status: 'ikke', grunn: 'Ingen skog i planen' }),
    belop: () => null },
  { id: 'miljotiltak-skog', omrade: 'skog', navn: 'Miljøtiltak i skog', forvalter: 'kommune', url: `${LD}/skogbruk/ordninger-for-skogbruk/tilskudd-til-miljotiltak-i-skog`,
    kort: 'Kompensasjon for merkostnader eller tap ved å ta vare på miljøverdier, for eksempel nøkkelbiotoper ut over PEFC-kravene.',
    krav: ['Områdene kartfestes', 'Dokumentert overslag over merkostnader eller tap', 'Avtaleperiode – ny eier må gjøres kjent med vilkårene'],
    frist: () => 'Kommunen fastsetter fristen',
    relevant: (c) => (c.miljoFigurer ? { status: 'mulig', grunn: `${c.miljoFigurer} miljøfigur${c.miljoFigurer > 1 ? 'er' : ''} i planen` } : { status: 'ikke', grunn: 'Ingen miljøfigurer i planen' }),
    belop: () => null },
  { id: 'taubane', omrade: 'skog', navn: 'Skogsdrift med taubane, hest og andre driftsmetoder', forvalter: 'kommune', url: `${LD}/skogbruk/ordninger-for-skogbruk/tilskudd-til-skogsdrift-med-taubane-hest-og-andre-driftsmetoder`,
    kort: 'Tilskudd til drift i bratt og vanskelig terreng. Tiltak og satser varierer mellom kommuner, fylker og landsdeler.', krav: ['Drift med taubane, hest eller andre skånsomme metoder der vanlig drift ikke er mulig'],
    frist: () => 'Kommunen fastsetter fristen',
    relevant: (c) => (c.harSkog && c.reg.kyst ? { status: 'mulig', grunn: `Vanligst i kystskogbruket (${c.reg.fylke})` } : c.harSkog ? { status: 'mulig', grunn: 'Aktuelt for bratte områder (se Driftsforhold)' } : { status: 'ikke', grunn: 'Ingen skog i planen' }),
    belop: () => null },
  { id: 'vindfall-amy', omrade: 'skog', navn: 'Opprydding av vindfall etter stormen Amy', forvalter: 'kommune', url: `${LD}/skogbruk/ordninger-for-skogbruk/tilskudd-til-opprydding-av-vindfall-etter-stormen-amy-den-4.oktober-2025`,
    kort: 'Inntil 85 % av driftskostnaden over 445 kr/m³, høyst 100 kr/m³, for vindfelt furuskog etter stormen Amy 4. oktober 2025.', sats: 'inntil 100 kr/m³',
    krav: ['Gjelder bare Molde, Ålesund, Vestnes, Rauma, Gjemnes, Tingvoll, Sunndal, Surnadal, Oppdal, Rennebu og Orkland', 'Vindfelt furuskog'],
    frist: () => 'Søknadsfrist 1. november 2026',
    relevant: (c) => (AMY.some((k) => k.toLowerCase() === String(c.reg.kommune || '').toLowerCase()) ? { status: 'aktuell', grunn: `${c.reg.kommune} er med i ordningen` } : { status: 'ikke', grunn: 'Kommunen er ikke med i ordningen' }),
    belop: () => null },
  // ---------- jord og husdyr ----------
  { id: 'produksjonstilskudd', omrade: 'gard', navn: 'Produksjonstilskudd', forvalter: 'kommune', url: `${LD}/jordbruk/ordninger-for-jordbruk/produksjonstilskudd-og-avlosertilskudd-i-jordbruket`,
    kort: 'Husdyrtilskudd, arealtilskudd, kulturlandskapstilskudd, beite- og utmarksbeitetilskudd og driftstilskudd for melk og spesialisert storfe.',
    krav: ['Foretaket må være registrert i Enhetsregisteret og drive vanlig jordbruksproduksjon', 'Dyretall på telledato (1. mars og 1. oktober) og areal i vekstsesongen', 'Beitetilskudd: minst 12 uker på beite (16 for melkekyr) – utmarksbeite minst 5 uker', 'Søkes i Altinn'],
    frist: () => '15. mars (telledato 1. mars) og 15. oktober (telledato 1. oktober)',
    relevant: (c) => (c.pt.sum > 0 ? { status: 'aktuell', grunn: 'Ut fra dyr og arealer i planen' } : c.harJordEllerDyr ? { status: 'mulig', grunn: 'Legg inn skifter og dyr i Skifteplan for å regne ut tilskuddet' } : { status: 'ikke', grunn: 'Ingen jord eller husdyr i planen' }),
    belop: (c) => (c.pt.sum > 0 ? { kr: c.pt.sum, tekst: `Anslag med endelige satser for ${PT_KILDE.aar} (se Skifteplan › Husdyr)`, deler: c.pt.poster } : null) },
  { id: 'avlosning-ferie', omrade: 'husdyr', navn: 'Avløsertilskudd ved ferie og fritid', forvalter: 'kommune', url: `${LD}/jordbruk/ordninger-for-jordbruk/produksjonstilskudd-og-avlosertilskudd-i-jordbruket`,
    kort: 'Refusjon av dokumenterte utgifter til avløser, opp til et tilskuddsgrunnlag per dyr (høyst 139 100 kr).',
    krav: ['Husdyrhold', 'Dokumenterte utgifter til avløser', 'Søkes sammen med produksjonstilskuddet'],
    frist: () => '15. oktober (sammen med produksjonstilskuddet)',
    relevant: (c) => (c.pt.avlosning > 0 ? { status: 'aktuell', grunn: `Tilskuddsgrunnlag ca. ${c.pt.avlosningGrunnlag.toLocaleString('nb-NO')} kr` } : { status: c.harDyr ? 'mulig' : 'ikke', grunn: c.harDyr ? 'Grunnlaget er under 5 000 kr' : 'Ingen husdyr i planen' }),
    belop: (c) => (c.pt.avlosning > 0 ? { kr: c.pt.avlosning, tekst: 'Inntil – forutsetter at du har like store utgifter til avløser', usikker: true } : null) },
  { id: 'rmp', omrade: 'gard', navn: 'Regionalt miljøtilskudd (RMP)', forvalter: 'statsforvalter', url: `${LD}/jordbruk/ordninger-for-jordbruk/regionalt-miljotilskudd-rmb`,
    kort: 'Tilskudd til miljøtiltak i jordbruket. Tiltakene og satsene fastsettes for hvert fylke i det regionale miljøprogrammet.',
    krav: ['Søker produksjonstilskudd', 'Tiltakene og vilkårene i veiledningsheftet fra Statsforvalteren i ditt fylke'],
    frist: () => '15. oktober (søknaden åpner 15. september, kan endres til 29. oktober)',
    relevant: (c) => (c.rmpTiltak.length ? { status: 'aktuell', grunn: `Mulige tiltak: ${c.rmpTiltak.join(', ')}` } : c.harJordEllerDyr ? { status: 'mulig', grunn: 'Sjekk tiltakene i ditt fylke' } : { status: 'ikke', grunn: 'Ingen jord eller husdyr i planen' }),
    belop: () => null, regional: true },
  { id: 'drenering', omrade: 'jord', navn: 'Tilskudd til drenering av jordbruksjord', forvalter: 'kommune', url: `${LD}/jordbruk/ordninger-for-jordbruk/tilskudd-til-drenering-av-jordbruksjord`,
    kort: '4 000 kr per daa for systematisk grøfting, profilering og omgraving. Annen grøfting: 61 kr per løpemeter, høyst 4 000 kr per daa.', sats: '4 000 kr/daa',
    krav: ['Søk før arbeidet starter – ikke tilskudd til påbegynt arbeid', 'Kart med grøfteskisse', 'Gjennomfør og rapporter innen fristen'],
    frist: () => 'Kommunen fastsetter fristen',
    relevant: (c) => (c.drenering.daa ? { status: 'aktuell', grunn: `Grøfteplan for ${daa(c.drenering.daa)} daa` } : c.harJord ? { status: 'mulig', grunn: 'Lag grøfteplan under Skifteplan › Skifter' } : { status: 'ikke', grunn: 'Ingen jord i planen' }),
    belop: (c) => (c.drenering.kr ? { kr: c.drenering.kr, tekst: `4 000 kr/daa × ${daa(c.drenering.daa)} daa (fra grøfteplanene)` } : null) },
  { id: 'smil', omrade: 'gard', navn: 'Spesielle miljøtiltak i jordbruket (SMIL)', forvalter: 'kommune', url: `${LD}/jordbruk/ordninger-for-jordbruk/tilskudd-til-spesielle-miljotiltak-i-jordbruket-smil`,
    kort: 'Tilskudd til å ta vare på kulturlandskap, kulturminner og gamle bygninger, og til tiltak mot forurensning (fangdammer, hydrotekniske anlegg). Kommunen prioriterer og fastsetter andelen.',
    krav: ['Tiltaket må gå ut over vanlig jordbruksdrift', 'Gjennomføres innen 3 år (kan forlenges til 5)', 'Minst 25 % holdes tilbake til sluttrapport og -regnskap er godkjent'],
    frist: () => 'Kommunen fastsetter fristen',
    relevant: (c) => (c.harJordEllerDyr ? { status: 'mulig', grunn: c.kulturminner ? `${c.kulturminner} kulturminner på eiendommen` : 'Kulturlandskap, gamle bygninger og tiltak mot avrenning' } : { status: 'ikke', grunn: 'Ingen jord eller husdyr i planen' }),
    belop: () => null },
  { id: 'biogass', omrade: 'husdyr', navn: 'Levering av husdyrgjødsel til biogassanlegg', forvalter: 'landbruksdirektoratet', url: `${LD}/jordbruk/ordninger-for-jordbruk/tilskudd-for-a-levere-husdyrgjodsel-til-biogassanlegg`,
    kort: 'Tilskudd per tonn husdyrgjødsel levert til biogass, vektet for tørrstoffinnholdet. Kutter også metan fra lageret (se Klima).',
    krav: ['Målinger av mengde og tørrstoff i gjødsla som leveres', 'Gårdsbaserte anlegg kan regne ut fra dyretall'],
    frist: () => '20. februar (for leveranser året før)',
    relevant: (c) => (c.harDyr ? { status: 'mulig', grunn: 'Krever avtale med et biogassanlegg' } : { status: 'ikke', grunn: 'Ingen husdyr i planen' }),
    belop: () => null },
  { id: 'beitelag', omrade: 'husdyr', navn: 'Drift av beitelag (organisert beitebruk)', forvalter: 'statsforvalter', url: `${LD}/jordbruk/ordninger-for-jordbruk/tilskudd-til-drift-av-beitelag-obb`,
    kort: 'Tilskudd til beitelaget per dyr sluppet på utmarksbeite, for mer rasjonell bruk av utmarka og mindre tap av dyr.',
    krav: ['Søkes av beitelaget', 'Medlemskap i et godkjent beitelag'],
    frist: () => '15. november (1 000 kr trekk per dag for sen søknad)',
    relevant: (c) => (c.utmark ? { status: 'aktuell', grunn: 'Dyr i utmark i beiteplanen – søkes av beitelaget' } : c.harDyr ? { status: 'mulig', grunn: 'Hvis dyrene slippes i utmark' } : { status: 'ikke', grunn: 'Ingen husdyr i planen' }),
    belop: () => null, regional: true },
  { id: 'beiteomrader', omrade: 'husdyr', navn: 'Tiltak i beiteområder', forvalter: 'kommune', url: `${LD}/jordbruk/ordninger-for-jordbruk/tilskudd-til-tiltak-i-beiteomrader`,
    kort: 'Investeringer i utmarksbeite: gjerder, sanketrøer, ferister, gjeterhytter og elektronisk overvåking.',
    krav: ['Organisert beitebruk', 'Minst 25 % holdes tilbake til arbeidet er ferdig'], frist: () => 'Kommunen fastsetter fristen',
    relevant: (c) => (c.utmark ? { status: 'mulig', grunn: 'Dyr i utmark i beiteplanen' } : { status: 'ikke', grunn: 'Ingen dyr i utmark' }),
    belop: () => null },
  { id: 'avlosning-sykdom', omrade: 'husdyr', navn: 'Avløsning ved sykdom og fødsel', forvalter: 'kommune', url: `${LD}/jordbruk/ordninger-for-jordbruk/soke-tilskudd-til-avlosning-ved-sykdom-og-fodsel`,
    kort: 'Inntil 2 700 kr per dag (3 050 kr ved svangerskap og fødsel) for avløsning i 2026. Arbeidsinntekt og sykepenger trekkes fra.', sats: 'inntil 2 700 kr/dag',
    krav: ['Jordbruksforetak med vanlig jordbruksproduksjon', 'Dokumentert sykdom, svangerskap, fødsel eller omsorg for sykt barn'],
    frist: () => 'Søkes etter at avløsningen er gjennomført – se Landbruksdirektoratet',
    relevant: (c) => (c.harDyr ? { status: 'mulig', grunn: 'Når du trenger det – greit å vite om' } : { status: 'ikke', grunn: 'Ingen husdyr i planen' }),
    belop: () => null },
  { id: 'investering', omrade: 'gard', navn: 'Investeringsstøtte (Innovasjon Norge)', forvalter: 'innovasjon-norge', url: 'https://www.innovasjonnorge.no/',
    kort: 'Investerings- og utviklingsmidler til landbruket, blant annet til ombygging fra båsfjøs til løsdrift. Prioriteres regionalt.',
    krav: ['Søknad til Innovasjon Norge før investeringen gjøres', 'Regionale prioriteringer i fylket'],
    frist: () => 'Løpende – sjekk regionale frister',
    relevant: (c) => (c.basfjos ? { status: 'aktuell', grunn: 'Båsfjøs for storfe må legges om til løsdrift innen 2034' } : c.harDyr ? { status: 'mulig', grunn: 'Ved nytt eller ombygd driftsbygg' } : { status: 'ikke', grunn: 'Ingen husdyr i planen' }),
    belop: () => null, regional: true },
  { id: 'teigbasert', omrade: 'jord', navn: 'Teigbasert tilskudd mv. i Nord-Norge', forvalter: 'kommune', url: `${LD}/jordbruk/ordninger-for-jordbruk/teigbasert-tilskudd-mv.i-nord-norge`,
    kort: 'Ekstra tilskudd for jordbruk i Nordland, Troms og Finnmark.', krav: ['Gården ligger i Nordland, Troms eller Finnmark'], frist: () => 'Se Landbruksdirektoratet',
    relevant: (c) => (c.reg.nord && c.harJord ? { status: 'mulig', grunn: `Gården ligger i ${c.reg.fylke}` } : { status: 'ikke', grunn: 'Gjelder Nord-Norge' }),
    belop: () => null },
];
export const OMRADE_NAVN = { skog: '🌲 Skog', jord: '🌾 Jord', husdyr: '🐄 Husdyr', gard: '🚜 Gården' };
export const FORVALTER = { kommune: 'Kommunen', statsforvalter: 'Statsforvalteren', landbruksdirektoratet: 'Landbruksdirektoratet', 'innovasjon-norge': 'Innovasjon Norge' };

// Alt om gården som ordningene trenger.
export function kontekst(S, aar = new Date().getFullYear()) {
  const d = drift(S); const reg = region(S); const dh = S?.skifteplan?.dyrehold;
  const harSkog = (S?.bestand || []).length > 0 && d.skog;
  const skifter = (S?.skifteplan?.skifter || []).filter((sk) => KULTURER[sk.vekster?.[aar]?.kultur] || KULTURER[sk.vekster?.[aar - 1]?.kultur]);
  const harJord = skifter.length > 0 && d.jord; const harDyr = (dh?.dyr || []).some((r) => Number(r.antall) > 0) && d.husdyr;
  let pt = { sum: 0, poster: [], avlosning: 0, avlosningGrunnlag: 0 }; try { if (harJord || harDyr) pt = produksjonstilskudd(S, aar); } catch { /* mangler data */ }
  let dr = { daa: 0, kr: 0 }; for (const sk of S?.skifteplan?.skifter || []) { const p = sk.drenering?.plan; if (p && !['utfort', 'ferdigmeldt'].includes(sk.drenering.status)) { dr.daa += p.okonomi?.areal ?? sk.areal ?? 0; dr.kr += p.okonomi?.tilskudd || 0; } }
  const utmark = (() => { try { return beiteplan(S, aar).perioder.some((p) => !p.skifte); } catch { return false; } })();
  const rmpTiltak = [];
  if (harJord && skifter.some((sk) => KULTURER[sk.vekster?.[aar]?.kultur]?.gruppe === 'korn')) rmpTiltak.push('stubb eller fangvekster over vinteren');
  if (harDyr) rmpTiltak.push('miljøvennlig spredning av husdyrgjødsel');
  if (harDyr && skifter.some((sk) => KULTURER[sk.vekster?.[aar]?.kultur]?.gruppe === 'beite')) rmpTiltak.push('beite av verdifulle jordbruksarealer');
  if (utmark) rmpTiltak.push('dyr på utmarksbeite');
  if (harJord) rmpTiltak.push('vegetasjonssoner mot vann');
  const takst = Number(S?.eiendom?.takstAar);
  return {
    aar, reg, drift: d, harSkog, harJord, harDyr, harJordEllerDyr: harJord || harDyr, tiltak: harSkog ? planlagteTiltak(S, aar) : {}, pt, drenering: dr, utmark, rmpTiltak,
    planlagteVeier: harSkog ? (S?.veier?.veier || []).filter((v) => v.status === 'planlagt').length : 0,
    takstAlder: Number.isFinite(takst) && takst > 1900 ? aar - takst : null,
    miljoFigurer: (S?.bestand || []).filter((b) => b.miljo).length, kulturminner: (S?.kulturminner || S?.miljo?.kulturminner || []).length || 0,
    basfjos: (dh?.rom || []).some((r) => r.type === 'basfjos'),
    satser: { ...(S?.tilskudd?.satser || {}) },
  };
}

// Oversikten: hver ordning med status, beløp, krav og frist for gården. Ordninger for driftsområder som er slått av,
// vises ikke. Sortert: aktuelle med beløp først.
export function tilskuddsoversikt(S, aar = new Date().getFullYear()) {
  const c = kontekst(S, aar); const rang = { aktuell: 0, mulig: 1, ikke: 2 };
  const vis = (o) => o.omrade === 'gard' ? (c.drift.jord || c.drift.husdyr) : c.drift[o.omrade] !== false;
  const liste = ORDNINGER.filter(vis).map((o) => {
    const r = o.relevant(c); const b = r.status === 'ikke' ? null : o.belop(c);
    return { id: o.id, navn: o.navn, omrade: o.omrade, forvalter: o.forvalter, forvalterNavn: o.forvalter === 'statsforvalter' ? c.reg.statsforvalter.navn : o.forvalter === 'kommune' ? (c.reg.kommune ? `${c.reg.kommune} kommune` : 'Kommunen') : FORVALTER[o.forvalter],
      regionalUrl: o.forvalter === 'statsforvalter' || o.regional ? c.reg.statsforvalter.url : null, url: o.url, kort: o.kort, sats: o.sats || null, krav: o.krav, frist: o.frist(c), status: r.status, grunn: r.grunn, belop: b, kontrollert: KONTROLLERT };
  }).sort((a, b) => rang[a.status] - rang[b.status] || (b.belop?.kr || 0) - (a.belop?.kr || 0));
  const sum = liste.filter((x) => x.status === 'aktuell' && x.belop?.kr && !x.belop.usikker).reduce((s, x) => s + x.belop.kr, 0);
  const inntil = liste.filter((x) => x.status === 'aktuell' && x.belop?.kr && x.belop.usikker).reduce((s, x) => s + x.belop.kr, 0);
  return { liste, sum, inntil, region: c.reg, aar, kontrollert: KONTROLLERT };
}

// Frister de neste 12 månedene for ordningene som er aktuelle eller mulige (faste datoer).
export const FASTE_FRISTER = [
  { id: 'produksjonstilskudd', mnd: 3, dag: 15, tekst: 'Produksjonstilskudd, del 1 (telledato 1. mars)' },
  { id: 'produksjonstilskudd', mnd: 10, dag: 15, tekst: 'Produksjonstilskudd, del 2 (telledato 1. oktober)' },
  { id: 'rmp', mnd: 10, dag: 15, tekst: 'Regionalt miljøtilskudd' },
  { id: 'biogass', mnd: 2, dag: 20, tekst: 'Husdyrgjødsel til biogass (leveranser året før)' },
  { id: 'beitelag', mnd: 11, dag: 15, tekst: 'Drift av beitelag (søkes av beitelaget)' },
  { id: 'skogkultur', mnd: 12, dag: 1, tekst: 'Skogkultur – normalt rundt 1. desember (sjekk kommunen)' },
];
export function kommendeFrister(oversikt, idag = new Date()) {
  const aktuelle = new Set(oversikt.liste.filter((x) => x.status !== 'ikke').map((x) => x.id));
  return FASTE_FRISTER.filter((f) => aktuelle.has(f.id)).map((f) => {
    let d = new Date(idag.getFullYear(), f.mnd - 1, f.dag); if (d < new Date(idag.getFullYear(), idag.getMonth(), idag.getDate())) d = new Date(idag.getFullYear() + 1, f.mnd - 1, f.dag);
    return { ...f, dato: d, dager: Math.round((d - idag) / 864e5) };
  }).sort((a, b) => a.dato - b.dato);
}
