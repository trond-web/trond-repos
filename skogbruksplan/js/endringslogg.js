// Versjonslogg for SkogIQ.ai – én kilde for «Hva er nytt» i appen og SkogIQ Felt, og for CHANGELOG.md.
// Nyeste først. Første oppføring skal ha samme versjon som js/versjon.js (sjekkes i testene).
// type: ny = ny funksjon, forbedret = bedre eller utvidet funksjon, rettet = feilretting.
export const ENDRINGER = [
  { versjon: '1.58.0', dato: '2026-11-05', type: 'ny', tittel: 'Versjonslogg i appen', tekst: 'Klikk på versjonsnummeret nederst i menyen, eller «Hva er nytt» i Om-boksen og i SkogIQ Felt, for å se hva som er nytt. Etter en oppdatering vises det nyeste én gang.' },
  { versjon: '1.57.0', dato: '2026-11-05', type: 'ny', tittel: 'Kulturminner i alle kart', tekst: 'Kulturminner fra Riksantikvaren i hovedkartet, SkogIQ Felt, rapporter, oppdrag og VR, med vernestatus og lenke ved klikk. Kommuneanalysen merker hogstflater med fredede kulturminner og kan skjule dem.' },
  { versjon: '1.56.0', dato: '2026-11-05', type: 'forbedret', tittel: 'Naturtyper og arter i alle kart', tekst: 'NiN-naturtyper og arter vises som standard i alle kart, også i SkogIQ Felt, rapportene og VR. Rødlistede arter merket «NTº» tolkes nå riktig, også i PEFC.' },
  { versjon: '1.55.0', dato: '2026-11-05', type: 'ny', tittel: 'NiN-naturtyper og arter', tekst: 'Kartlag for naturtyper (NiN) og arter av nasjonal forvaltningsinteresse, i bestandsinfo og i kommuneanalysen med merking, filter og eksport.' },
  { versjon: '1.54.0', dato: '2026-11-05', type: 'ny', tittel: 'Naboeiendommer og skogbruksplan', tekst: 'Se eiendommene rundt og om de har skogbruksplan – og lag planen med ett klikk der den mangler.' },
  { versjon: '1.53.0', dato: '2026-11-05', type: 'ny', tittel: 'Avstand til vei og gnr/bnr i kommuneanalysen', tekst: 'Avstand til nærmeste bilvei for hver flate, med filter og sortering. Gårds- og bruksnummer i listen, ved klikk og som eiendomsgrenser i kartet.' },
  { versjon: '1.52.0', dato: '2026-10-31', type: 'ny', tittel: 'Min profil og skylagring', tekst: 'Hver bruker har en profil, og planene lagres i skyen – tilgjengelige på alle enhetene du logger inn på, med versjoner og papirkurv.' },
  { versjon: '1.51.0', dato: '2026-10-31', type: 'ny', tittel: 'Kommunale planer og reguleringer', tekst: 'Arealformål, hensynssoner og planer for eiendommen, med muligheter og begrensninger for skogeieren.' },
  { versjon: '1.50.0', dato: '2026-10-31', type: 'ny', tittel: 'Velkomst, e-post som brukernavn og glemt passord', tekst: 'Velkomst med vær og dagens råd, e-post som brukernavn og lenke for nytt passord.' },
  { versjon: '1.49.0', dato: '2026-10-31', type: 'ny', tittel: 'Registrering og admin', tekst: 'Egne brukere med passord, innlogging, bruksstatistikk og adminside.' },
  { versjon: '1.48.0', dato: '2026-10-30', type: 'ny', tittel: 'Markfuktighet', tekst: 'Kartlag og andel våt mark per bestand fra NIBIOs markfuktighetskart – også som blå bakke i VR.' },
  { versjon: '1.47.0', dato: '2026-10-30', type: 'ny', tittel: 'Bratthet og drivbarhet', tekst: 'Kartlag og vurdering per bestand av hva som kan drives med vanlige skogsmaskiner, vinsj eller taubane.' },
  { versjon: '1.46.0', dato: '2026-10-30', type: 'ny', tittel: 'Minikart i den virtuelle skogen', tekst: 'Viser hvor du står, hvilken vei du ser og går – også i VR-brillene.' },
  { versjon: '1.45.0', dato: '2026-10-30', type: 'ny', tittel: 'Tynning: hogstmaskindata mot SR16', tekst: 'Grunnflate før og etter, tynningskvotient, diameterklasser og stikkveier fra HPR-filen.' },
  { versjon: '1.44.0', dato: '2026-10-30', type: 'ny', tittel: 'Hogstmaskindata mot SR16', tekst: 'Last opp en HPR-fil og sammenlign stammeuttaket med treantallet i SR16.' },
  { versjon: '1.43.1', dato: '2026-10-30', type: 'rettet', tittel: 'Plan for lange, smale eiendommer', tekst: 'Eiendommer som Øvre Eiker 2/1 fikk ingen skogdata – rettet.' },
  { versjon: '1.43.0', dato: '2026-10-28', type: 'ny', tittel: 'StanForD 2010 – hogstmaskin og lassbærer', tekst: 'Filsett til maskinen, og automatisk ajourføring av oppdrag, bestand og kart fra produksjonsfilene.' },
  { versjon: '1.42.0', dato: '2026-10-28', type: 'ny', tittel: 'Be om tilbud på oppdrag', tekst: 'Send oppdrag til entreprenører, få svar via lenke, sammenlign og tildel.' },
  { versjon: '1.41.0', dato: '2026-10-24', type: 'ny', tittel: 'Grøfteplan og krav og frister', tekst: 'Grøfteplan per skifte og alle dokumentasjonskrav for gården samlet.' },
  { versjon: '1.40.0', dato: '2026-10-23', type: 'ny', tittel: 'Innlogging', tekst: 'Løsningen krever innlogging med brukernavn og passord.' },
  { versjon: '1.39.0', dato: '2026-10-23', type: 'ny', tittel: 'Satellittbilder (Sentinel-2)', tekst: 'Se endringer i skogen siden taksten, år for år.' },
  { versjon: '1.38.0', dato: '2026-10-19', type: 'ny', tittel: 'John Deere og ISOBUS', tekst: 'Skiftegrenser, kjørespor og gjødselkart til traktoren, og utført arbeid tilbake til journalene.' },
  { versjon: '1.37.0', dato: '2026-10-19', type: 'ny', tittel: 'Arbeidsinstruks for ungskogpleie i VR', tekst: 'Se hva som skal fjernes og hvordan bestandet ser ut etter pleie.' },
  { versjon: '1.36.0', dato: '2026-10-19', type: 'forbedret', tittel: 'Raskere markslag (AR5)', tekst: 'Markslag hentes som vektorfliser – store eiendommer stoppet ikke lenger opp.' },
  { versjon: '1.35.0', dato: '2026-10-18', type: 'forbedret', tittel: 'Smartere import fra takst og SR16', tekst: 'SR16 brukes når den er nyere enn taksten, urørte bestand skrives fram, og myr skilles riktig ut (1.32–1.35).' },
  { versjon: '1.34.0', dato: '2026-10-18', type: 'ny', tittel: 'Vær i den virtuelle skogen', tekst: 'Dagens vær fra MET og seNorge, og faste værtyper.' },
  { versjon: '1.31.0', dato: '2026-10-18', type: 'ny', tittel: 'Fra PC til mobil med QR-kode', tekst: 'Send planen til SkogIQ Felt og synkroniser begge veier.' },
  { versjon: '1.30.0', dato: '2026-10-18', type: 'ny', tittel: 'AR i felt', tekst: 'Grenser, stier, miljø og kulturminner lagt over kamerabildet.' },
  { versjon: '1.25.0', dato: '2026-10-18', type: 'ny', tittel: 'Virtuell skog og VR', tekst: 'Gå rundt i skogen fra bakkenivå, også med VR-briller – med realistiske trær, vegetasjon, veier, vann og framtidsskog (1.25–1.29).' },
  { versjon: '1.23.0', dato: '2026-10-18', type: 'ny', tittel: 'Droneoppdrag', tekst: 'Flyruter for ortofoto til DJI Enterprise, også trådløst til fjernkontrollen (1.23–1.24).' },
  { versjon: '1.15.0', dato: '2026-10-18', type: 'ny', tittel: 'Ungskog og tetthetsklasse', tekst: 'Ungskogfelt, økonomisk effekt av ungskogpleie og planting, tetthetsklasse a/b og treantallsmodell (1.15–1.22).' },
  { versjon: '1.8.0', dato: '2026-10-17', type: 'ny', tittel: 'SkogIQ Felt', tekst: 'Mobilversjon som virker uten nett, med sporlogg, oppdrag og endring av tiltak i felt (1.8–1.14).' },
  { versjon: '1.7.0', dato: '2026-10-15', type: 'ny', tittel: 'Flere eiendommer i kartet', tekst: 'Vis alle eiendommene dine samtidig.' },
  { versjon: '1.6.0', dato: '2026-10-13', type: 'ny', tittel: 'Karbon', tekst: 'Karbonkreditter fra skogen og karbonprinsipp i tiltaksmotoren.' },
  { versjon: '1.5.0', dato: '2026-10-09', type: 'ny', tittel: 'KSL', tekst: 'Egenrevisjon, avvik, kontroller og dokumentarkiv for gården.' },
  { versjon: '1.4.0', dato: '2026-10-08', type: 'ny', tittel: 'Oppdrag', tekst: 'Samle tiltak til oppdrag for utførere.' },
  { versjon: '1.2.0', dato: '2026-10-08', type: 'ny', tittel: 'Vegetasjonstype, traktorveier og stier', tekst: 'Vegetasjonstype per bestand fra NIBIO, og traktorveier og stier fra Kartverket (1.2–1.3).' },
  { versjon: '1.0.0', dato: '2026-10-06', type: 'ny', tittel: 'SkogIQ.ai lanseres', tekst: 'Skogbruksplan fra gårds- og bruksnummer, kommuneanalyse, veier, PEFC, verdi, rapporter, tiltaksmotor, skifteplan, Skogbrand og Spør AI – publisert på nett.' },
];

export const TYPE = { ny: { navn: 'Nytt', farge: '#1f8a4c' }, forbedret: { navn: 'Forbedret', farge: '#2a78d6' }, rettet: { navn: 'Rettet', farge: '#c27a12' } };

// Sammenligner versjonsnumre («1.10.0» > «1.9.0»).
export function nyere(a, b) {
  const x = String(a || '0').split('.').map(Number); const y = String(b || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
}
// Oppføringene som er nyere enn versjonen brukeren sist så.
export const sidenSist = (sist, liste = ENDRINGER) => (sist ? liste.filter((e) => nyere(e.versjon, sist)) : []);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const datoTekst = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
// HTML for versjonsloggen (brukes i fullversjonen og SkogIQ Felt). nye = versjoner som skal merkes «ny for deg».
export function html({ nye = new Set(), antall = ENDRINGER.length } = {}) {
  return `<ol class="endringslogg">${ENDRINGER.slice(0, antall).map((e) => `<li class="${nye.has(e.versjon) ? 'ny-for-deg' : ''}">
    <div class="el-topp"><b>${esc(e.tittel)}</b><span class="el-type" style="--farge:${TYPE[e.type]?.farge || '#666'}">${esc(TYPE[e.type]?.navn || '')}</span></div>
    <div class="el-meta">Versjon ${esc(e.versjon)} · ${esc(datoTekst(e.dato))}${nye.has(e.versjon) ? ' · <b>nytt siden sist</b>' : ''}</div>
    <p>${esc(e.tekst)}</p></li>`).join('')}</ol>`;
}
// CHANGELOG.md (lages med: node -e "import('./js/endringslogg.js').then(m => process.stdout.write(m.markdown()))").
export function markdown() {
  return `# Versjonslogg – SkogIQ.ai\n\nNyeste først. Vises også i appen under «Hva er nytt».\n\n${ENDRINGER.map((e) => `## ${e.versjon} – ${e.tittel} (${e.dato})\n\n*${TYPE[e.type]?.navn || ''}.* ${e.tekst}\n`).join('\n')}`;
}
