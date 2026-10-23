// Fagside: hva som kreves for god tømmerlogistikk, og hvordan planleggeren tar hensyn til det.

const KILDER = [
  ['SNL – Tømmer', 'https://snl.no/t%C3%B8mmer'],
  ['SNL – Velteplass', 'https://snl.no/velteplass'],
  ['SNL – Skogsbilveg', 'https://snl.no/skogsbilveg'],
  ['Statsforvalteren – Tømmersalg for dummies', 'https://www.statsforvalteren.no/siteassets/fm-rogaland/bilder-fmro/landbruk/skogbruk/dokumenter/tommersalg-for-dummies.pdf'],
  ['Allskog – Levering av virke fra Møre 2025', 'https://allskog.no/dokumenter/egenaktive/Levering%20av%20virke%20fra%20M%C3%B8re%202025.pdf'],
  ['Statens vegvesen – Prøveordning for tømmervogntog inntil 74 tonn', 'https://www.vegvesen.no/fag/fokusomrader/forskning-innovasjon-og-utvikling/proveordninger/proveordning-for-tommervogntog-inntil-74-tonn/skal-prove-tommervogntog-pa-74-tonn/'],
  ['Statsforvalteren – Skogsbilveger', 'https://www.statsforvalteren.no/nb/ostfold-buskerud-oslo-og-akershus/landbruk-og-mat/skogbruk/skogsbilveger/'],
  ['Gran kommune – Aksellastrestriksjoner (des. 2025)', 'https://www.gran.kommune.no/download/18.52dd642a19afcffccbb28b0/1765801086949/Aksellastrestriksjoner%20Gran%20Kommune%20desember%202025.pdf'],
  ['Skogdata – Sluttrapport utvikling av VSYS VirkesHandel', 'https://www.skogtiltaksfondet.no/wp-content/uploads/2023/06/2014-24_SluttRapport-Utvikling-av-VSYS-VirkesHandel-.pdf'],
  ['Skogdata – Systemstøtte og EUDR (PEFC-webinar 2024)', 'https://cdn.pefc.org/pefc.no/media/2024-09/1f608afc-0c8c-4ad5-8389-bf7beae9bd73/598f3039-2f7b-5f07-af32-7b29ad975ff3.pdf'],
  ['Statsforvalteren – Stormskader og barkbillefare', 'https://www.statsforvalteren.no/nn/vestfold-og-telemark/landbruk-og-mat/skogbruk/stormskader-og-barkbillefare/'],
];

const KRAV = [
  {
    tittel: '1. Planlegg tidlig, og gjør avtale før hogst',
    punkter: [
      'Start gjerne planleggingen et år før hogst. Hent tilbud fra minst to tømmerkjøpere eller skogeierforeninger.',
      'Skriv en leveranseavtale per sortiment: mottak, volum per uke eller måned, pris, apteringsinstruks (lengder og diametre) og leveringsperiode.',
      'Meld virket inn til kjøperen, og meld fra når det er klart for transport. Allskog krever for eksempel transportklar-melding senest én uke etter hogst.',
    ],
    app: 'Mottak med sortimenter og ukekvote. Leveranseplanen viser levert mot avtalt for hver uke.',
  },
  {
    tittel: '2. Balanse mellom hogstmaskin og lassbærer',
    punkter: [
      'Hogstmaskinen går fortere jo større middelstammen er. Tynning og vanskelig terreng gir lavere produksjon.',
      'Lassbæreren kjører sakte. Lang terrengtransport er dyr, så velteplassen bør ligge nær hogstfeltet og bilvegen.',
      'Laget går ikke fortere enn den tregeste maskinen. Ved lang kjøreavstand kan det trengs en ekstra lassbærer.',
    ],
    app: 'Produksjon per G15-time for begge maskinene i hver drift. Flaskehalsen er uthevet, og modellen kan kalibreres i Innstillinger.',
  },
  {
    tittel: '3. Velteplassen: stor nok, tørr og trygg',
    punkter: [
      'Velteplassen brukes til sortering og mellomlagring til tømmerbilen kommer. Hvert sortiment trenger egen haug.',
      'Langs riksveg gjelder forskrift om plassering av skogvirke: minst 3 meter fra vegkanten, og sikret så tømmeret ikke kan rulle ut i vegen.',
      'Plassen må tåle lagret volum fram til neste bil. Når den er full, må lassbæreren vente.',
    ],
    app: 'Kapasitet per velteplass. Lassbæreren bremses når plassen er full, og du får varsel.',
  },
  {
    tittel: '4. Vegklasse, føre og teleløsning',
    punkter: [
      'Vegklassen avgjør når det kan kjøres tungt. Klasse 3 er helårsveg, men med begrensninger i teleløsningen og ved mye nedbør. Klasse 4 og 5 er sommerveger, og klasse 5 bare for barmark.',
      'I teleløsningen kan vegen raskt få skader, særlig når flere tunge vogntog kjører tett. Kommuner og fylker kunngjør aksellastrestriksjoner og skilter dem.',
      'Vinterdrift på frossen mark gir mindre kjøreskader på myr og bløt mark. Mye regn gjør skadene verre i fuktig terreng.',
      'Kjør ut virke fra svake veger før teleløsningen, og legg helårsdrifter (veg kl. 1–2) til våren.',
    ],
    app: 'Sesonger per uke, føre per drift (helår, barmark, vinter) og vegklasse. Maskinlag hopper over drifter som ikke kan kjøres nå, og tømmerbilen stopper når vegen er stengt.',
  },
  {
    tittel: '5. Tømmerbil: kapasitet og turtid',
    punkter: [
      'Tillatt totalvekt for tømmervogntog i Norge er 60 tonn. Det er prøvd ordninger med 65, 68 og 74 tonn på godkjente veger.',
      'Tyngre vogntog gir færre turer og lavere utslipp per m³, men mer slitasje på dekk og bremser.',
      'Turtiden bestemmer hvor mange lass en bil klarer per dag. Den består av skogsbilveg, offentlig veg, lasting og lossing.',
      'Hele lass er billigst. Restlass bør bare kjøres når en drift er avsluttet eller virket haster.',
    ],
    app: 'Antall biler, timer, m³ per lass og farter. Turtid og lass per dag vises for hver drift og hvert mottak. Biler kjører hele lass og tar eldste og mest utsatte virke først.',
  },
  {
    tittel: '6. Kort lagringstid, særlig om sommeren',
    punkter: [
      'Sagtømmer som ligger om sommeren, kan få blåved og lagringsråte. Det gir lavere pris eller vraking.',
      'Ferskt granvirke og vindfall er yngleplass for granbarkbille. Om sommeren bør gran kjøres ut raskt og prioriteres foran furu.',
      'Avtal med kjøperen hvor lenge virket kan ligge. Grensene i appen er utgangspunkt og ikke regelverk.',
    ],
    app: 'Alder per parti ved velteplassen (først inn, først ut). Du får varsel når virket har ligget lenger enn grensen for sommer eller resten av året.',
  },
  {
    tittel: '7. Måling, oppgjør og dokumentasjon',
    punkter: [
      'Etter skogbruksloven skal alt virke som selges eller går til industri, måles. Norsk Virkesmåling gjør målingen, som oftest lassvis på industritomt eller terminal.',
      'Tømmerprisen gjelder normalt per m³ levert ved bilveg. Transportkostnaden ligger i kjøperens pris eller trekkes særskilt.',
      'Skogfond og miljøkrav (PEFC) følger salget. Miljøfigurer og hensynssoner skal være kjent for hogstlaget før start.',
    ],
    app: 'Leveranseplan per uke og drift kan lastes ned som CSV og sendes til kjøper og transportør.',
  },
  {
    tittel: '8. Jevn flyt og god informasjon',
    punkter: [
      'Mottakene vil ha jevne leveranser. Topper og hull gir kø ved mottak eller stans i fabrikken.',
      'Del planen med hogstlag, transportør og kjøper, og oppdater den når drifter blir forsinket eller værforholdene endrer seg.',
      'Ha en reserve: en helårsdrift i køen holder maskinene i gang når en vinter- eller barmarksdrift ikke kan kjøres.',
      'Kartlegg flaskehalsen (hogst, terrengtransport, velteplass, bil eller mottak) og øk kapasiteten der, ikke andre steder.',
    ],
    app: 'Lager per uke, framkjørt mot levert, bilutnyttelse og varsler om ledige maskiner viser hvor flaskehalsen er.',
  },
  {
    tittel: '9. Én ordrekjede: innkjøp, produksjon og salg i VSYS Virkeshandel',
    punkter: [
      'Det meste av virkesomsetningen i Norge går gjennom Skogdatas VSYS: Virkeshandel, Transport, Innmåling og Pris og avregning.',
      'I Virkeshandel har hver aktør innkjøpsordrer (IO) mot leverandør og salgsordrer (SO) mot kunde. Kjøperens IO er selgerens SO, og IO og SO kobles sammen.',
      'Produksjonsmodulen samler produsert fra hogstmaskin og framkjørt fra lassbærer. Transport melder transportert, og Norsk Virkesmåling melder innmålt.',
      'Skogdata tilbyr API og en kopi av databasen (replikadatabase) for egne rapporter. Meldinger mellom aktørene går etter papinet-standarden. Tilgangen gis av Skogdata.',
      'Fra skogeieravtalen (IO) hentes også grunnlaget for EUDR, blant annet hogstpolygon, volum og treslag.',
    ],
    app: 'Fanen Ordre leser inn IO, SO og PO fra CSV-uttrekk og kobler dem til drifter, mottak og maskinlag. SO styrer ukevolum per sortiment, og faktisk produksjon er startpunktet for resten av planen. Ordreplanen kan lastes ned og sjekkes mot VSYS.',
  },
];

export function logistikkSide() {
  return `
    <h1>Hva kreves for god tømmerlogistikk?</h1>
    <p class="ingress">Kjeden går fra hogstmaskin og lassbærer via velteplass og skogsbilveg til tømmerbil og mottak. Den er ikke sterkere
    enn det svakeste leddet. God logistikk betyr at virket flyter jevnt, ligger kort tid og leveres som avtalt, til lav kostnad og uten skader på veg og mark.</p>
    <section class="kort kjede" aria-label="Logistikkjeden">
      ${['Hogst', 'Terrengtransport', 'Velteplass', 'Skogsbilveg', 'Tømmerbil', 'Mottak og måling'].map((l, i) => `<span>${i ? '<i aria-hidden="true">→</i>' : ''}<b>${l}</b></span>`).join('')}
    </section>
    ${KRAV.map((k) => `
      <section class="kort">
        <h2>${k.tittel}</h2>
        <ul>${k.punkter.map((p) => `<li>${p}</li>`).join('')}</ul>
        <p class="i-appen"><b>I planleggeren:</b> ${k.app}</p>
      </section>`).join('')}
    <section class="kort">
      <h2>Tommelfingerregler i modellen</h2>
      <ul>
        <li>Hogstmaskin, sluttavvirkning med middels maskin: omtrent 40 × middelstamme<sup>0,6</sup> m³ per G15-time (cirka 20 m³/t ved 0,3 m³). Tynning gir 25 % mindre.</li>
        <li>Lassbærer: lass på 10, 14 eller 18 m³ (liten, middels, stor), lasting og lossing, og kjøring på cirka 3 km/t i terrenget.</li>
        <li>Tømmerbil: 40 m³ per lass, 65 km/t på offentlig veg og 25 km/t på skogsbilveg, 45 minutter lasting og 25 minutter lossing.</li>
        <li>Sesong: vinter i uke 50–12, teleløsning i uke 14–19 og sommer i uke 21–35. Ved sommerlagring er grensen 21 dager for sagtømmer og gran, ellers 60 dager.</li>
      </ul>
      <p class="dempet">Dette er utgangspunkt og ikke fasit. Bruk entreprenørens produksjonstall, lokale aksellastlister og kjøperens krav, og juster i Innstillinger.</p>
    </section>
    <section class="kort">
      <h2>Kilder</h2>
      <ul class="kilder">${KILDER.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${t}</a></li>`).join('')}</ul>
    </section>
    <p class="dempet">Tømmerplan og denne veiledningen er laget av Trond Harald Sand.</p>`;
}
