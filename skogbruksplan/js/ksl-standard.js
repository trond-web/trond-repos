// KSL-standarden (Stiftelsen Norsk Mat): sjekklister for egenrevisjon, lest ut av de offisielle PDF-ene (nb-no) med
// verktoy/ksl-fra-pdf.py. Versjoner: 1 2026.9d, 10 2026.10b, 15 2026.10, 30 2026.7, 31 2026.7, 32 2026.7, 35 2026.10, 40 2026.6, 50 2026.10, 51 2026.7, 52 2026.7, 53 2026.3, 54 2026.7, 70 2026.9.
// dok = spørsmålet er merket med dokumentasjonssymbolet. krav = utdrag av «For å oppfylle dette kravet må du».
// Nye versjoner oppdages av den ukentlige kildesjekken (verktoy/kildesjekk.mjs).
export const KSL_KAPITLER = [
 {
  "nr": 1,
  "navn": "Generelle krav til gården",
  "versjon": "2026.9d",
  "url": "https://www.ksl.no/ksl-standarden/generelle-krav-til-garden/",
  "seksjoner": [
   {
    "nr": "1.1",
    "navn": "Oversikt over dokumentasjon, analyseresultater og sertifiseringer"
   },
   {
    "nr": "1.2",
    "navn": "Gjødslingsplan og jordprøver"
   },
   {
    "nr": "1.3",
    "navn": "Lagring og bruk av husdyrgjødsel"
   },
   {
    "nr": "1.4",
    "navn": "Bruk av avløpsslam, kompost, biorest eller annen organisk gjødsel"
   },
   {
    "nr": "1.5",
    "navn": "Lagring og bruk av plantevernmidler"
   },
   {
    "nr": "1.6",
    "navn": "Meldepliktig ugress og planteskadegjørere"
   },
   {
    "nr": "1.7",
    "navn": "Lagring av driftsmidler, punktutslipp og avfallshåndtering"
   },
   {
    "nr": "1.8",
    "navn": "Skadegjørere i husdyrrom, lager, sorterings- og foredlingsrom"
   },
   {
    "nr": "1.9",
    "navn": "Kulturminner, kulturlandskap og biologisk mangfold – regionale og"
   },
   {
    "nr": "1.10",
    "navn": "Smitteforebygging ved kjøp av brukt utstyr fra utlandet"
   },
   {
    "nr": "1.11",
    "navn": "Et klimavennlig landbruk"
   }
  ],
  "sporsmal": [
   {
    "nr": "1.1.1",
    "tekst": "Har du oversikt over alle driftsmidler du har kjøpt, og alle produkter du har solgt?",
    "dok": true,
    "krav": [
     "Kunne dokumentere hvem du kjøper fra (ett ledd tilbake)",
     "Kunne dokumentere hvem du selger til (ett ledd frem)"
    ]
   },
   {
    "nr": "1.1.2",
    "tekst": "Har du en plan for hvordan du skal håndtere og eventuelt tilbakekalle helseskadelige produkter, samt varsle Mattilsynet og varemottaker?",
    "dok": false,
    "krav": [
     "Ha en plan for hvordan du skal tilbakekalle helseskadelige produkter.",
     "Umiddelbart varsle Mattilsynet og varemottakerne dine dersom du har grunn til å mistenke at du har solgt helseskadelige produkter.",
     "Umiddelbart stanse omsetning av produktet/produktene dine."
    ]
   },
   {
    "nr": "1.1.3",
    "tekst": "Har du ført skifteregistrering som dokumenterer gjennomførte tiltak og bruk av innsatsfaktorer?",
    "dok": true,
    "krav": [
     "føre skifteregistrering per areal eller skifte",
     "registrere gjennomførte tiltak og bruk av innsatsfaktorer",
     "registrere bruk av frø, såvarer, settevarer eller annet plantemateriale",
     "dokumentere art, sort og partinummer for innkjøpt såvare der dette er relevant",
     "dokumentere art og sort ved bruk av egen såvare",
     "registrere hvilket skifte såvaren eller plantematerialet er brukt på for å sikre sporbarhet",
     "kunne legge fram dokumentasjonen ved revisjon eller annen kontroll"
    ]
   },
   {
    "nr": "1.1.4",
    "tekst": "Arkiverer du analyseresultater, vedtak og tilbakemeldinger fra varemottaker og myndigheter?",
    "dok": true,
    "krav": [
     "Ta vare på, og enkelt kunne finne frem til, alle typer analyser, vedtak og tilbakemeldinger knyttet til din produksjon og vareflyt.",
     "Eksempelvis fôrprøver, vannprøver, vedtak om meldepliktige skadegjørere, etc.",
     "Kunne vise frem aktuell dokumentasjon til myndigheter og KSL-revisor ved forespørsel."
    ]
   },
   {
    "nr": "1.1.5",
    "tekst": "Er utstyr som krever det, kontrollert og sertifisert i tråd med forskrifter?",
    "dok": true,
    "krav": [
     "Sørge for sakkyndig kontroll av arbeidsutstyr der dette er et krav."
    ]
   },
   {
    "nr": "1.2.1",
    "tekst": "Har du representative jordprøver som grunnlag for gjødslingsplanen (ikke eldre enn 8 år)?",
    "dok": true,
    "krav": [
     "Ha representative jordprøver som grunnlag for gjødslingsplanen, og disse prøvene skal ikke være eldre enn 8 år."
    ]
   },
   {
    "nr": "1.2.2",
    "tekst": "Har du en oppdatert gjødslingsplan (før inneværende vekstsesong) med kartskisse/skiftekart, basert på vekst og representative jordprøver?",
    "dok": true,
    "krav": [
     "Ha en oppdatert gjødslingsplan før hver vekstsesong."
    ]
   },
   {
    "nr": "1.2.3",
    "tekst": "Har du ført gjødseljournal for inneværende vekstsesong, slik at det går fram hvor det er gjødslet, når det er gjødslet, og hvilken type og mengde gjødsel som er brukt per skifte?",
    "dok": true,
    "krav": [
     "føre gjødseljournal fortløpende for inneværende vekstsesong",
     "registrere hvor og når det er gjødslet",
     "registrere type og mengde gjødsel som er brukt",
     "kunne dokumentere hvor mye nitrogen og fosfor som er tilført hvert areal",
     "kunne dokumentere samlet tilført mengde totalnitrogen og totalfosfor"
    ]
   },
   {
    "nr": "1.3.1",
    "tekst": "Er husdyrgjødsla kun spredt på dyrket jord eller på innmarksbeite som kommunen har godkjent som spredeareal?",
    "dok": false,
    "krav": [
     "Spredeareal er fulldyrket jord og eventuelt innmarksbeite som er godkjent av kommunen.",
     "Utmark kan ikke brukes som spredeareal.",
     "Du må disponere tilstrekkelig spredeareal i forhold til mengden husdyrgjødsel du har. Dersom du ikke har nok spredeareal selv, må du ha en plan for håndtering av gjødsla gjennom levering til andre gårdsbruk."
    ]
   },
   {
    "nr": "1.3.2",
    "tekst": "Har husdyrgjødsel som er brukt på foretakets arealer kun blitt spredt på snø‑ og frostfri mark og innenfor gjeldende spredetidsfrister (sjekk fylkesvise frister)?",
    "dok": true,
    "krav": [
     "Spre husdyrgjødsel kun i tillatt periode og i tråd med fristene som gjelder for ditt fylke eller område.",
     "Unngå spredning av husdyrgjødsel i perioden det ikke er tillatt i din kommune",
     "Ikke spre husdyrgjødsel på snødekket eller frossen mark.",
     "Sørge for at spredning skjer i vekstsesongen, helst om våren, slik at næringsstoffene utnyttes av planteveksten."
    ]
   },
   {
    "nr": "1.3.3",
    "tekst": "Har du rutiner som sikrer at husdyrgjødsel som spres på åpen åker, moldes ned innen 18 timer?",
    "dok": false,
    "krav": [
     "spres på åpen åker, moldes ned straks og senest innen 18 timer. Dersom du ikke sprer husdyrgjødsel på åpen åker, er kravet ikke relevant. Kravet er forankret i gjødselvareforskriften."
    ]
   },
   {
    "nr": "1.3.4",
    "tekst": "Er spredning av husdyrgjødsel på innmarksbeite gjennomført i tråd med regelverket?",
    "dok": false,
    "krav": [
     "Ha kommunal godkjenning for innmarksbeitet Spre husdyrgjødsel kun innenfor tillatt periode Spre på frostfri jord Kun spre på innmarksbeite eller fulldyrket jord Ikke spre gjødsel på utmark Følge gjeldende regler for gjødseltype og eventuell nedmolding Ta hensyn til naturverdier der kommunen har satt vilkår eller avslag"
    ]
   },
   {
    "nr": "1.3.5",
    "tekst": "Har du rutiner som sikrer at gjødsellageret kontrolleres minst én gang i løpet av 12 måneder?",
    "dok": true,
    "krav": [
     "kontrollere gjødsellageret minst én gang i løpet av 12 måneder",
     "kontrollere at gjødsellageret er tett og uten lekkasjer eller andre forhold som kan føre til forurensning",
     "oppfylle særskilte krav som gjelder for den typen gjødselanlegg du har",
     "kunne dokumentere at kontrollen er gjennomført"
    ]
   },
   {
    "nr": "1.3.6",
    "tekst": "Har du tilstrekkelig lagringskapasitet til å lagre husdyrgjødsel fram til det er tillatt å spre den?",
    "dok": false,
    "krav": [
     "Ha en lagringskapasitet på minimum 8 måneder."
    ]
   },
   {
    "nr": "1.3.7",
    "tekst": "Har du rutiner som sikrer at husdyrgjødsel som lagres på bakken, alltid skjermes mot overflatevann og plasseres slik at avrenning hindres?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "1.3.8",
    "tekst": "Har du rutiner som sikrer at gjødsel fra luftegårder og utendørs talle samles opp regelmessig, minst én gang i året?",
    "dok": false,
    "krav": [
     "luftegårder og utendørs talle fjernes regelmessig, minst én gang årlig. Du må sørge for at oppsamlet gjødsel enten spres eller lagres på en tilfredsstillende måte, og at væskeoverskudd samles opp og lagres dersom det kan medføre miljøskade."
    ]
   },
   {
    "nr": "1.4.1",
    "tekst": "Har du rutine for å følge gjeldende regelverk og bruksbegrensningene for avløpsslam, kompost, biorest og annen organisk gjødsel?",
    "dok": false,
    "krav": [
     "bruksbegrensningene for organisk gjødsel følges. Kravene varierer med type produkt."
    ]
   },
   {
    "nr": "1.4.2",
    "tekst": "Har du rutiner som sikrer at kommunen varsles før avløpsslam brukes på gården?",
    "dok": false,
    "krav": [
     "ha rutiner som sikrer at kommunen varsles senest to uker før avløpsslam brukes på gården."
    ]
   },
   {
    "nr": "1.5.1",
    "tekst": "Kan du dokumentere at plantevernmidler kun er brukt av personell med gyldig autorisasjon?",
    "dok": true,
    "krav": [
     "Sørge for at plantevernmidler kun kan brukes av personer som har autorisasjon. Å bruke plantevernmidler omfatter i denne sammenhengen både å blande slike midler og å spre eller påføre dem."
    ]
   },
   {
    "nr": "1.5.2",
    "tekst": "Kan du dokumentere at plantevernmidlene er brukt i samsvar med godkjent etikett?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "1.5.3",
    "tekst": "Kan du dokumentere at spredeutstyret tilpasses, rengjøres og vedlikeholdes slik at det ikke er fare for forurensning av vann, og har du rutiner som sikrer dette fremover?",
    "dok": true,
    "krav": [
     "Kunne dokumentere, og ha rutiner som sikrer, at spredeutstyret tilpasses, rengjøres og vedlikeholdes slik at det ikke oppstår fare for forurensning av vann. Kravet er forankret i forskrift om plantevernmidler."
    ]
   },
   {
    "nr": "1.5.4",
    "tekst": "Kan du dokumentere at du oppfyller kravene til integrert plantevern, beskyttelse av vannmiljø og journalføring, og har du rutiner som sikrer at disse kravene etterleves?",
    "dok": true,
    "krav": [
     "plantevern, gjennomføre tiltak som reduserer risikoen for vannforurensning, og føre plantevernjournal i tre deler:"
    ]
   },
   {
    "nr": "1.5.5",
    "tekst": "Oppbevares plantevernmidler avlåst, tydelig merket og i samsvar med kravene på etiketten, og er det etablert rutiner for korrekt oppbevaring?",
    "dok": false,
    "krav": [
     "tilfredsstiller kravene i forskrift om plantevernmidler, og ha rutiner som sikrer riktig oppbevaring."
    ]
   },
   {
    "nr": "1.5.6",
    "tekst": "Setter du opp advarselsplakater i samsvar med Mattilsynets mal når arealer som er åpne for allmenn ferdsel behandles med plantevernmidler, og har du rutiner som sikrer at dette alltid blir gjort?",
    "dok": false,
    "krav": [
     "brukes på arealer som er åpne for allmenn ferdsel. Dette innebærer å sette opp advarselsplakater og å informere aktører med særskilte interesser. Kravet er forankret i forskrift om plantevernmidler."
    ]
   },
   {
    "nr": "1.5.7",
    "tekst": "Er spredeutstyret funksjonstestet i henhold til krav?",
    "dok": true,
    "krav": [
     "Åkersprøyte, tåkesprøyte, jordbærbommer og spredeutstyr med total bomlengde på over tre meter skal testes hvert 3. år",
     "Spredeutstyr i veksthus skal testet hvert 5. år.",
     "Ryggbåret og håndtholdt spredeutstyr er unntatt krav til vanlig funksjonstest, men skal egentestes.",
     "Spredeutstyr med krav til funksjonstest skal ha påsatt gyldig registreringsmerke, dette gjelder også fabrikknytt utstyr."
    ]
   },
   {
    "nr": "1.5.8",
    "tekst": "Overholder du behandlingsfristene for plantevernmidler, og har du rutiner som sikrer at innhøstingsdato dokumenteres når dette er påkrevd?",
    "dok": true,
    "krav": [
     "kjemiske plantevernmidler du bruker, og sikre at disse fristene overholdes i praksis. Du skal dokumentere tidspunkt for innhøsting slik at det kan vises at behandlingsfristene er fulgt. På beitearealer gjelder behandlingsfristen fra tidspunktet for behandling til dyrene slippes på beite. Kravet er forankret i plantevernforskriften."
    ]
   },
   {
    "nr": "1.6.1",
    "tekst": "Følger du opplysningsplikten for meldepliktige skadegjørere og floghavre, og har du rutiner som sikrer at funn meldes i tråd med regelverket?",
    "dok": false,
    "krav": [
     "skadegjørere og floghavre. Du skal melde fra til kommunen dersom du har kjennskap til eller mistanke om floghavre på eiendommen. Meldingen skal inneholde planteprøve og registreringsskjema som kommunen sender videre til Kimen Såvarelaboratoriet AS for diagnostisering. Ved mistanke om andre meldepliktige skadegjørere skal du melde fra til Mattilsynet gjennom deres skjematjeneste. Aktuelle skadegjørere er listet i vedlegg 1 og 2 til forskrift om plantehelse. Meldeplikten gjelder både jord du eier og jord du leier."
    ]
   },
   {
    "nr": "1.6.2",
    "tekst": "Opplyser du den du leier jord av, eller leier bort til, dersom du finner meldepliktige skadegjørere eller floghavre, og har du rutiner som sikrer at dette alltid blir gjort?",
    "dok": false,
    "krav": [
     "finner meldepliktige skadegjørere eller floghavre. Dersom du leier bort jord, skal du også informere om tidligere funn av floghavre. Hvilke skadegjørere som er meldepliktige, fremgår av vedlegg 1 og 2 til forskrift om plantehelse. Kravet er forankret i forskrift om plantehelse og forskrift om floghavre."
    ]
   },
   {
    "nr": "1.6.3",
    "tekst": "Har du rutiner for å bekjempe og hindre spredning av floghavre?",
    "dok": false,
    "krav": [
     "Gode rutiner for rengjøring av maskiner, lager og utstyr.",
     "Årlig kontroll på all dyrket jord unntatt flerårig eng.",
     "Riktig destruering av floghavre",
     "Holde et 20 meter bredt belte inntil naboeiendom, veier og åpne vannveier helt fritt for frøbærende floghavreplanter. Tilsvarende plikt gjelder for arealer som er utsatt for flom."
    ]
   },
   {
    "nr": "1.6.4",
    "tekst": "Har du kontrollert om du har hønsehirse, og eventuelt bekjempet den, og har du rutiner som sikrer at dette følges opp årlig?",
    "dok": false,
    "krav": [
     "Sørge for aktiv bekjempelse hvis du oppdager ugraset. Se informasjon og kravliste."
    ]
   },
   {
    "nr": "1.7.1",
    "tekst": "Lagrer du innkjøpt mineralgjødsel på en sikker måte?",
    "dok": false,
    "krav": [
     "Lagringsmåte som hindrer at gjødsla kan komme på avveie",
     "Lagringsmåte som verner liv, helse, miljø og materielle verdier mot uhell og ulykker.",
     "Kravene til oppbevaring av mineralgjødsel er strenge. Les mer under informasjon."
    ]
   },
   {
    "nr": "1.7.2",
    "tekst": "Lagres grovfôri rundballer, eller siloanlegg slik at det ikke oppstår fare for avrenning og/eller forurensing?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "1.7.3",
    "tekst": "Har du en avfallshåndteringsplan for din gård?",
    "dok": true,
    "krav": [
     "Hvordan ulike typer avfall oppbevares/håndteres (farlig avfall, produksjonsavfall, inkludert landbruksplast, og organisk avfall).",
     "Hvor du leverer ulike typer avfall.",
     "Mal til avfallsplan finnes under \"kravliste\"."
    ]
   },
   {
    "nr": "1.8.1",
    "tekst": "Jobber du systematisk med overvåking og bekjemping av skadedyr som kan gå ut over mattryggheten?",
    "dok": true,
    "krav": [
     "Drive systematisk forebyggende arbeid mot skadegjørere",
     "Dokumentere forekomst av skadedyr som kan påvirke tryggheten til råvarer, eventuelt smitte til dyr.",
     "Drive skadedyrbekjempelse slik at fôrvarer produseres, bearbeides, pakkes, lagres og transporteres under hensiktsmessige hygieniske forhold.",
     "Ha en plan for hvordan du raskt og effektivt kan gjøre tiltak dersom problemene med skadedyr øker og det er fare for mattrygghet eller spredning av smittsom sykdom til dyreholdet ditt."
    ]
   },
   {
    "nr": "1.8.2",
    "tekst": "Dersom du benytter skadedyrmidler, kan du dokumentere hvilke skadedyrmidler som brukes, og hvor de er plassert?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "1.9.1",
    "tekst": "Har du merket av kulturminner og andre verdifulle kulturlandskapselementer på skiftekartet for gården?",
    "dok": true,
    "krav": [
     "Merke og beskrive aktuelle kulturminner på kart."
    ]
   },
   {
    "nr": "1.9.2",
    "tekst": "Har du tilstrekkelig vegetasjonssone mot vassdrag med årssikker vannføring på minimum 2 meter , som du ikke jordarbeider?",
    "dok": false,
    "krav": [
     "sette igjen en vegetasjonssone på minst 2 meter mot vassdrag med en årssikker vannføring, målt horisontalt ved normal vannføring.",
     "Denne vegetasjonssonen kan ikke jordarbeides.",
     "Kravet gjelder ikke mot kanaler som brukes på profilerte arealer; de regnes da som en del av profileringen."
    ]
   },
   {
    "nr": "1.9.3",
    "tekst": "Har du rutiner som sikrer at tiltak som kan påvirke kulturminner, kulturlandskap eller biologisk mangfold alltid gjennomføres i dialog med kommunen?",
    "dok": false,
    "krav": [
     "påvirke kulturminner, kulturlandskap eller biologisk mangfold gjennomføres i dialog med kommunen. Kontakt det lokale landbrukskontoret dersom du er usikker på om et tiltak krever avklaring."
    ]
   },
   {
    "nr": "1.9.4",
    "tekst": "Dersom det finnes fredede kulturminner på gården, ivaretar du disse med en tilhørende sikringssone?",
    "dok": false,
    "krav": [
     "Innhente nødvendig tillatelse hvis du skal iverksette tiltak som kan skade eller ødelegge fredede kulturminner.",
     "Fysisk fredede kulturminner skal ha sikringssone på 5 meter for inngrep.",
     "Fredede bygninger vedlikeholdes på en forsvarlig måte."
    ]
   },
   {
    "nr": "1.10.1",
    "tekst": "Har du rutiner som sikrer at brukt utstyr kjøpt fra utlandet er rengjort og desinfisert før forsendelse til Norge, og at dette dokumenteres?",
    "dok": true,
    "krav": [
     "utlandet rengjøres og eventuelt desinfiseres både før forsendelse til Norge og etter ankomst, og at all rengjøring og desinfeksjon dokumenteres med godkjente metoder og midler. Utstyret skal deretter stå tørt i minst 14 dager før det tas i bruk."
    ]
   },
   {
    "nr": "1.11.1",
    "tekst": "Har du en plan for vedlikehold og fornyelse av hydrotekniske anlegg?",
    "dok": false,
    "krav": [
     "ha vurdert tilstanden på hydrotekniske anlegg som har betydning for drenering og vannhåndtering på foretaket",
     "ha en plan for nødvendig vedlikehold eller fornying der det er behov for dette",
     "oppdatere planen dersom behov eller forhold endres"
    ]
   },
   {
    "nr": "1.11.2",
    "tekst": "Følger du lokale/regionale bestemmelser om jordarbeiding eller andre miljøkrav?",
    "dok": false,
    "krav": [
     "Følge lokale bestemmelser gitt av statsforvalter knyttet til jordarbeiding eller andre miljøtiltak.",
     "Ditt lokale landbrukskontor har oversikt over hvilke krav som gjelder for din eiendom."
    ]
   },
   {
    "nr": "1.11.3",
    "tekst": "Dersom kommunen har gitt særskilte miljøbestemmelser av betydning for drifta, følger du disse?",
    "dok": false,
    "krav": [
     "Holde deg oppdatert på lokale bestemmelser",
     "Følge de aktuelle bestemmelsene for din gård."
    ]
   },
   {
    "nr": "1.11.4",
    "tekst": "Har du vurdert foretakets viktigste kilder til klimagassutslipp og relevante tiltak for å redusere utslippene? Se veileder for eksempler.",
    "dok": false,
    "krav": [
     "vurdere foretakets viktigste kilder til klimagassutslipp",
     "vurdere relevante tiltak for å redusere utslippene",
     "ha en enkel dokumentert vurdering av utslippskilder og aktuelle tiltak"
    ]
   }
  ]
 },
 {
  "nr": 10,
  "navn": "Helse, miljø og sikkerhet (HMS)",
  "versjon": "2026.10b",
  "url": "https://www.ksl.no/ksl-standarden/helse-miljo-og-sikkerhet/",
  "seksjoner": [
   {
    "nr": "10.1",
    "navn": "Mål og organisering"
   },
   {
    "nr": "10.2",
    "navn": "Vernerunde"
   },
   {
    "nr": "10.3",
    "navn": "Risikovurdering"
   },
   {
    "nr": "10.4",
    "navn": "Arbeidsmiljø"
   },
   {
    "nr": "10.5",
    "navn": "Barn og ungdom"
   },
   {
    "nr": "10.6",
    "navn": "Brannsikring"
   },
   {
    "nr": "10.7",
    "navn": "Egenkontroll av elektrisk anlegg"
   },
   {
    "nr": "10.8",
    "navn": "Opplæring"
   },
   {
    "nr": "10.9",
    "navn": "Arbeidshjelp"
   },
   {
    "nr": "10.10",
    "navn": "Kortvarige ansettelser (sesonghjelp)"
   },
   {
    "nr": "10.11",
    "navn": "Fast ansatt arbeidshjelp"
   },
   {
    "nr": "10.12",
    "navn": "Beredskapsplan, ulykkeshåndtering, krisebistand og rapportering"
   }
  ],
  "sporsmal": [
   {
    "nr": "10.1.1",
    "tekst": "Har du satt mål for arbeid med helse, miljø og sikkerhet (HMS) på gården?",
    "dok": true,
    "krav": [
     "Skrive mål for følgende områder",
     "Mål for arbeidsmiljø",
     "Mål for arbeid mot brann",
     "Mål for arbeid med el-sikkerhet",
     "Skrive ned hvem som er ansvarlig for HMS-arbeidet"
    ]
   },
   {
    "nr": "10.1.2",
    "tekst": "Har du et system for å registrere og følge opp eventuelle avvik knyttet til arbeidet på gården?",
    "dok": true,
    "krav": [
     "Ha et system der du og arbeidshjelp kan registrere avvik",
     "Dokumenter hvilken oppfølging det enkelte avvik har fått."
    ]
   },
   {
    "nr": "10.2.1",
    "tekst": "Har du gjennomført vernerunde på gården siste år?",
    "dok": true,
    "krav": [
     "Ha dokumentasjon på at det er gått vernerunde der det framgår hvilke punkt som er sjekket og eventuelle avvik som er funnet på runden."
    ]
   },
   {
    "nr": "10.3.1",
    "tekst": "Har du dokumentasjon på risikovurdering av farlige arbeidsoppgaver på gården? (se eksempler i veiledningstekst)",
    "dok": true,
    "krav": [
     "Ha skriftlig beskrivelse av farlige arbeidsoppgaver med en vurdering av risikomoment og hva som gjøres for å minske risiko."
    ]
   },
   {
    "nr": "10.3.2",
    "tekst": "Har du dokumentasjon på risikovurdering av det elektriske anlegget på gården?",
    "dok": true,
    "krav": [
     "Kartlegge farer og problem",
     "Vurdere risiko knyttet til det som er avdekket",
     "Gjøre tiltak for å redusere risiko"
    ]
   },
   {
    "nr": "10.3.3",
    "tekst": "Er låvebruer og andre steder med høydeforskjell sikret med klatrefritt rekkverk?",
    "dok": false,
    "krav": [
     "Ha skrensekant på låvebru. denne skal være tilstrekkelig til å hindre kjøretøy å kjøre ut av låvebrua.",
     "Ha rekkverk som hindrer personer å falle ned."
    ]
   },
   {
    "nr": "10.3.4",
    "tekst": "Parkeres traktorer og annet utstyr slik at det ikke utgjør fare?",
    "dok": false,
    "krav": [
     "Parkere traktor med redskap på bakken.",
     "Parkere redskap slik at de ikke kan velte",
     "Parkere utenfor det området der barn leker og oppholder seg."
    ]
   },
   {
    "nr": "10.4.1",
    "tekst": "Gjennomfører du tiltak for å sikre at arbeidsplassen ikke medfører økt fare for helseskade? Se viktige punkt du må ta hensyn til i veileder.",
    "dok": false,
    "krav": [
     "Gå gjennom drifta og vurdere om det er behov for tiltak på områdene",
     "Støy",
     "Vibrasjoner",
     "Mulige belastninger på kroppen",
     "Belysning",
     "Støv",
     "Ventilasjon"
    ]
   },
   {
    "nr": "10.4.2",
    "tekst": "Har du rutiner på gården for bruk av, opplæring om, oppbevaring av, vedlikehold og reparasjon av eller utskiftning av verneutstyret?",
    "dok": false,
    "krav": [
     "Jevnlig sjekke om alle som benytter verneutstyr har det som arbeidet krever",
     "Følge opp og sørge for at verneutstyret brukes når det er påkrevet."
    ]
   },
   {
    "nr": "10.4.3",
    "tekst": "Har alle på gården tilgang til sikkerhetsdatabladene for farlige kjemikalier på gården?",
    "dok": true,
    "krav": [
     "ha sikkerhetsdatablad for alle helsefarlige, brann og eksplosjonsfarlige stoffer",
     "lagre sikkerhetsdatablad på en slik måte at alle som har bruk for de vil kunne finne de ved behov"
    ]
   },
   {
    "nr": "10.4.4",
    "tekst": "Har du driftsopplegg som gjør at du reduserer faren for forgiftning fra silogass, gjødselgass eller annen gass?",
    "dok": false,
    "krav": [
     "Vurdere hvilke gasser som kan oppstå i tilknytning til arbeidet",
     "Sette inn tiltak som reduserer/fjerner faren for forgiftning."
    ]
   },
   {
    "nr": "10.4.5",
    "tekst": "Er det montert setebelte i alle traktorer som benyttes i arbeidssammenheng?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "10.4.6",
    "tekst": "Har dere rutiner på gården som sikrer at setebelte blir brukt i henhold til forskriften?",
    "dok": false,
    "krav": [
     "Ha montert setebelte i alle traktorer som benyttes i arbeidssammenheng",
     "Benytte setebeltet ved all kjøring der det kreves i forskrift om utførelse av arbeid."
    ]
   },
   {
    "nr": "10.5.1",
    "tekst": "Finnes trygge lekeområder for barn på gården?",
    "dok": false,
    "krav": [
     "Ha leke og oppholdsareal som har fysisk skille (gjerde e.l.) som hindrer at barn utilsiktet leker og oppholder seg på områder det utføres gårdsdrift/arbeides på gården."
    ]
   },
   {
    "nr": "10.5.2",
    "tekst": "Har du vurdert risiko ved lek/arbeidsoppgaver som barn og ungdom utfører?",
    "dok": false,
    "krav": [
     "Sette deg inn i regelverk for arbeid utført av personer under 18 år",
     "Følge krav og anbefalinger som er gitt"
    ]
   },
   {
    "nr": "10.5.3",
    "tekst": "Er storsekker, potetkasser, rundballer o.l. sikret eller plassert slik at de ikke kan friste til klatring eller velte/falle ned?",
    "dok": false,
    "krav": [
     "Sikre området slik at uvedkommende ikke har tilgang til området",
     "Sikre stabler mot klatring"
    ]
   },
   {
    "nr": "10.5.4",
    "tekst": "Er tunet tilrettelagt slik at trafikk ledes utenom området der barn leker og oppholder seg?",
    "dok": false,
    "krav": [
     "Ha en bevist holdning til hvor det kjøres og hvor det er oppholdsareal for barn"
    ]
   },
   {
    "nr": "10.6.1",
    "tekst": "Gjennomføres det faglig kontroll med termografering av det elektriske anlegget minimum hvert tredje år? (gjelder bygg med husdyr, varmlufts korntørke eller forsikringssum over en sum som forsikringsselskapet ditt har satt)",
    "dok": true,
    "krav": [
     "I god tid før det har gått tre år, bestille el-kontroll med termografering",
     "Sjekke at kontrollforetak kan gjennomføre kontroll i henhold til standard",
     "NEK 405-3 med tillegg landbruk for el-kontroll og NEK 405-1 for termografering"
    ]
   },
   {
    "nr": "10.6.2",
    "tekst": "Har du sertifikat for varme arbeider?",
    "dok": true,
    "krav": [
     "Gjennomføre teorikurs og bestå eksamen",
     "Gjennomføre slukkeøvelse",
     "Gjenta kurs og slukkeøvelse hvert 5. år"
    ]
   },
   {
    "nr": "10.6.3",
    "tekst": "Er det gjort tiltak som hindrer brann i utstyr og bygninger ved sveising, sliping eller andre varme arbeider?",
    "dok": false,
    "krav": [
     "Ha gyldig sertifikat for varme arbeider",
     "Fjerne alle brennbare materialer i området det skal jobbes",
     "Ha tilgjengelig slokkemiddel (min 2x 6kg egnet slukkemiddel eller 1x6 kg apparat og en brannslange med påsatt vann)",
     "Ha brannvakt"
    ]
   },
   {
    "nr": "10.6.4",
    "tekst": "Er rømningsveier åpne og ryddet (inkludert ryddet for snø)?",
    "dok": false,
    "krav": [
     "Ha åpne rømningsveier ut til sikker sone",
     "Forsikre deg om at utganger er mulig å benytte året rundt"
    ]
   },
   {
    "nr": "10.6.5",
    "tekst": "Er det tilstrekkelig brannslokkingsutstyr i bygningene, er det lett tilgjengelig og klart til bruk, og er nødvendig kontroll og vedlikehold gjennomført?",
    "dok": false,
    "krav": [
     "vurdere hvor mye brannslokkingsutstyr som er nødvendig for å dekke hele arealet",
     "ha godkjent brannslokkingsutstyr som er lett tilgjengelig og klart til bruk",
     "plassere brannslokkingsapparater ved innganger til og utganger fra brannceller og i rom med stor brannbelastning",
     "vurdere behovet for brannslokkingsutstyr som en del av den årlige gjennomgangen av elektrisk anlegg og utstyr",
     "sørge for at brannslokkingsutstyret kontrolleres og vedlikeholdes i samsvar med gjeldende krav",
     "sørge for at periodisk kontroll av håndslokkere utføres etter NS 3910 av kvalifisert servicepersonell"
    ]
   },
   {
    "nr": "10.6.6",
    "tekst": "Oppbevares/plasseres arbeidsmaskiner/traktorer i en egnet/godkjent garasje eller på et sted hvor det ikke er fare for at en brann kan spre seg til bebyggelse?",
    "dok": false,
    "krav": [
     "Ha parkerings/oppstillingsplass slik at det ikke er fare for spredning til bygninger ved en eventuell brann i kjøretøy."
    ]
   },
   {
    "nr": "10.6.7",
    "tekst": "Kontrolleres tanker for gass, drivstoff og annet brensel jevnlig og i samsvar med offentlige krav?",
    "dok": true,
    "krav": [
     "Ha oversikt over aktuelle tanker på driftsenheten",
     "Ha oversikt over kontrollkrav til den/de aktuelle tanken(e)",
     "Følge opp intervall for kontroll som den enkelte tank krever"
    ]
   },
   {
    "nr": "10.6.8",
    "tekst": "Oppbevares drivstoff, brensel og annet brannfarlig stoff i sikker avstand til brennbart materiale og i samsvar med aktuelle forskrifter?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "10.6.9",
    "tekst": "Er det installert brannalarmanlegg i driftsbygningen?",
    "dok": false,
    "krav": [
     "Avklare om det er krav til brannalarm i dine bygg",
     "Montere inn brannalarmanlegg godkjent i henhold til Norsk Standard 3960"
    ]
   },
   {
    "nr": "10.6.10",
    "tekst": "Gjennomfører du egenkontroll/ettersyn av brannalarmanlegget månedlig?",
    "dok": true,
    "krav": [
     "Ha nødvendig kompetanse på ditt anlegg (leverandør har ansvaret for å lære deg opp)",
     "Foreta ettersyn/egenkontroll av brannalarm en gang pr mnd.",
     "Umiddelbart utbedre eventuelle feil eller mangler som avdekkes",
     "Dokumentere egenkontrollen"
    ]
   },
   {
    "nr": "10.6.11",
    "tekst": "Er det gjennomført periodisk (årlig) kontroll av brannalarmanlegg?",
    "dok": true,
    "krav": [
     "Dokumentere at brannalarmanlegget er kontrollert siste 12 mnd av godkjent foretak og i henhold til beskrivelse i NS 3960"
    ]
   },
   {
    "nr": "10.6.12",
    "tekst": "Er gårdsverkstedet vurdert med tanke på brannsikkerhet?",
    "dok": false,
    "krav": [
     "Foreta en grundig risikovurdering før du starter med arbeid som kan forårsake brann"
    ]
   },
   {
    "nr": "10.7.1",
    "tekst": "Har du gjennomført egenkontroll av elektrisk anlegg på gården siste år?",
    "dok": true,
    "krav": [
     "Sette opp alle viktige punkt i det elektriske anlegget i en liste",
     "Sjekke alle punkt for synlige skader eller feil i funksjonalitet",
     "Følge opp eventuelle feil du avdekker"
    ]
   },
   {
    "nr": "10.8.1",
    "tekst": "Har du som arbeidsgiver, og eventuelle arbeidsledere på gården, gjennomgått lovpålagt opplæring i HMS-arbeid?",
    "dok": true,
    "krav": [
     "Gjennomføre opplæring i HMS for arbeidsledere"
    ]
   },
   {
    "nr": "10.8.2",
    "tekst": "Er det gjennomført og dokumentert nødvendig opplæring for alle som arbeider på gården, på et språk de forstår(inkludert egne barn og kårfolk)?",
    "dok": true,
    "krav": [
     "ha oversikt over arbeidsutstyr og arbeidsoppgaver som krever opplæring",
     "sørge for at alle som skal bruke arbeidsutstyr, håndtere varer, stoffer eller produkter, har nødvendig opplæring og nødvendige kvalifikasjoner",
     "gi nødvendig opplæring og trening i bruk av hjelpemidler og personlig verneutstyr",
     "sørge for at opplæringen gis på et språk og på en måte den enkelte forstår",
     "gi nødvendig opplæring og instruksjon før arbeidstakeren settes til arbeid",
     "ta særlig hensyn til manglende erfaring og modenhet ved opplæring av personer under 18 år",
     "gjennomføre dokumentert sikkerhetsopplæring for arbeidsutstyr der dette kreves",
     "sørge for at dokumentert sikkerhetsopplæring signeres av både den som gir og den som mottar opplæringen"
    ]
   },
   {
    "nr": "10.9.1",
    "tekst": "Er det tilstrekkelige personalrom for arbeidshjelp på gården?",
    "dok": false,
    "krav": [
     "Ha rom der arbeidshjelp har tilgang til",
     "toalett",
     "vask",
     "dusj",
     "garderobe med skiftemulighet og mulighet til å tørke klær",
     "spiserom"
    ]
   },
   {
    "nr": "10.9.2",
    "tekst": "Har de som arbeider på foretaket, tilgang til et godt renholdt sanitæranlegg i nærheten av der de arbeider?",
    "dok": false,
    "krav": [
     "Sørge for at tilgang til toalett i nærhet av arbeidsstedet slik at disse benyttes",
     "Sørge for jevnlig renhold"
    ]
   },
   {
    "nr": "10.9.3",
    "tekst": "Får arbeidshjelp opplæring på et språk de forstår?",
    "dok": false,
    "krav": [
     "Kartlegge hvilke språk og språkkunnskaper som arbeiderne har",
     "gjennomføre opplæring på språk som arbeider forstår"
    ]
   },
   {
    "nr": "10.9.4",
    "tekst": "Har du risikovurdert arbeidsoppgaver og iverksatt tiltak der det er gravide arbeidshjelp?",
    "dok": true,
    "krav": [
     "Ha en god dialog med potensielt gravide arbeidstakere slik at du kan tilrettelegge arbeidsoppgaver",
     "Sammen med kompetent person/bedriftshelsetjeneste e.l. vurdere hvilke oppgaver den gravide kan gjennomføre"
    ]
   },
   {
    "nr": "10.9.5",
    "tekst": "Har du løpende oversikt over hvor mye den enkelte arbeidshjelp arbeider på din gard?",
    "dok": true,
    "krav": [
     "Føre lister over arbeidstider for den enkelte arbeidstaker"
    ]
   },
   {
    "nr": "10.9.6",
    "tekst": "Kjenner du til omfanget av alminnelig arbeidstid?",
    "dok": false,
    "krav": [
     "Gjøre deg kjent med og følge regelverket for arbeidstid."
    ]
   },
   {
    "nr": "10.9.7",
    "tekst": "Kjenner du til reglene for pauser?",
    "dok": false,
    "krav": [
     "Gjøre deg kjent med arbeidstidsbestemmelsenes regler for pauser og følge disse.",
     "Gjøre arbeidstakerne oppmerksom på retten til pauser."
    ]
   },
   {
    "nr": "10.10.1",
    "tekst": "Har alle ansatte arbeidsavtale og lønn i tråd med gjeldende allmenngjøringsforskrift?",
    "dok": true,
    "krav": [
     "Ha en skriftlig arbeidsavtale på et språk som både arbeidsgiver og arbeidstaker forstår",
     "Arbeidsavtalen skal minst inneholde",
     "hvem avtalen er mellom",
     "personnummer eller D-nummer",
     "hvor arbeidsplassen er",
     "beskrivelse av arbeidet",
     "dato for når arbeidsforholdet starter",
     "forventa varighet på arbeidsforholdet hvis det er midlertidig"
    ]
   },
   {
    "nr": "10.10.2",
    "tekst": "Får alle ansatte godkjent lønnsslipp?",
    "dok": false,
    "krav": [
     "Gi arbeidstaker en lønnsslipp som dokumentasjon på",
     "lønn",
     "skatt",
     "andre trekk"
    ]
   },
   {
    "nr": "10.10.3",
    "tekst": "Ved bruk av sesongarbeidere formidlet via arbeidsformidler, sikrer du at det er et byrå som er et registrert norsk foretak med tillatelse til å drive arbeidsformidling innenfor landbruk?",
    "dok": false,
    "krav": [
     "Kontrollere om den som formidler arbeidskraft har nødvendige tillatelser til å drive slik virksomhet i Norge.",
     "Kun benytte formidlere med godkjenning i Norge"
    ]
   },
   {
    "nr": "10.10.4",
    "tekst": "Beregning av minstelønn – vet du hvordan dette utføres?",
    "dok": false,
    "krav": [
     "Gjøre deg kjent med de til enhver tid allmenngjorte minstelønnssatser (se den til enhver tid gjeldende Forskrift om allmenngjøring av tariffavtale for jordbruks- og gartnerinæringene).",
     "Beregne lønn slik at det oppnås minimum minstelønn for timer avtalt i arbeidskontrakten."
    ]
   },
   {
    "nr": "10.10.5",
    "tekst": "Har du avklart i arbeidsavtalen vilkår for evnt husleie og diett?",
    "dok": false,
    "krav": [
     "Ha en skriftlig avtale om leieforhold",
     "Dokumentere eventuelt trekk i lønn i henhold til arbeidsavtale"
    ]
   },
   {
    "nr": "10.10.6",
    "tekst": "Har du yrkesskadeforsikring for alle som arbeider på gården, og som har krav på det etter reglene?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "10.10.7",
    "tekst": "Kjenner du til ordningen med gjennomstnittsberegnet arbeidstid, og har du grunnlaget for denne beregningen?",
    "dok": false,
    "krav": [
     "Avtale med arbeidstaker at arbeidstid skal gjennomsnittsberegnes",
     "Planlegge og føre oversikt over arbeidstid slik at det er i henhold til regelverket"
    ]
   },
   {
    "nr": "10.10.8",
    "tekst": "Har alle ansatte egen lønnskonto?",
    "dok": false,
    "krav": [
     "Betale lønn kun til personlige konti"
    ]
   },
   {
    "nr": "10.10.9",
    "tekst": "Kjenner du til krav om døgnhvil og ukehvil?",
    "dok": false,
    "krav": [
     "Kjenne til forskriftens krav om hvile",
     "Ha en arbeidsplan der arbeidstid og hviletid er beskrevet"
    ]
   },
   {
    "nr": "10.10.10",
    "tekst": "Dersom du har barn eller ungdom under 15 år i arbeid hos deg, kjenner du til begrensningen i arbeidstid og type oppgaver de kan utføre?",
    "dok": false,
    "krav": [
     "Ha oppdatert kunnskap om arbeidsmiljølovens bestemmelser om begrensninger i arbeidsoppgaver som kan utføres ved 13, 14 eller 15 års alder."
    ]
   },
   {
    "nr": "10.10.11",
    "tekst": "Er standarden for innkvartering i samsvar med gjeldende krav?",
    "dok": false,
    "krav": [
     "gjøre deg kjent med Arbeidstilsynets norm for boligstandard",
     "vurdere om arbeidstakerne kommer under unntaksbestemmelsene for arbeidsforhold opp til 12 uker",
     "følge opp bolig og utføre nødvendig kontroll/vedlikehold"
    ]
   },
   {
    "nr": "10.11.1",
    "tekst": "Får alle ansatte godkjent lønnsslipp?",
    "dok": false,
    "krav": [
     "Gi arbeidstaker en lønnsslipp som dokumentasjon på",
     "lønn",
     "skatt",
     "andre trekk"
    ]
   },
   {
    "nr": "10.11.2",
    "tekst": "Har alle ansatte arbeidsavtale og lønn i tråd med gjeldende allmenngjøringsforskrift?",
    "dok": true,
    "krav": [
     "Ha en skriftlig arbeidsavtale på et språk som både arbeidsgiver og arbeidstaker forstår",
     "Arbeidsavtalen skal minst inneholde",
     "hvem avtalen er mellom",
     "personnummer eller D-nummer",
     "hvor arbeidsplassen er",
     "beskrivelse av arbeidet",
     "dato for når arbeidsforholdet starter",
     "forventa varighet på arbeidsforholdet hvis det er midlertidig"
    ]
   },
   {
    "nr": "10.11.3",
    "tekst": "Har du avklart i arbeidsavtalen vilkår for evnt husleie og diett?",
    "dok": false,
    "krav": [
     "Ha en skriftlig avtale om leieforhold",
     "Dokumentere eventuelt trekk i lønn i henhold til arbeidsavtale"
    ]
   },
   {
    "nr": "10.11.4",
    "tekst": "Har du rutiner for å følge opp sykemeldte arbeidstakere?",
    "dok": false,
    "krav": [
     "kjenne til plikter du som arbeidsgiver har til å følge opp sykemeldte"
    ]
   },
   {
    "nr": "10.11.5",
    "tekst": "Har du yrkesskadeforsikring for alle som arbeider på gården, og som har krav på det etter reglene?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "10.11.6",
    "tekst": "Er du kjent med regelverket for obligatorisk tjenestepensjon (OTP)?",
    "dok": false,
    "krav": [
     "Gjøre deg kjent med lov om obligatorisk tjenestepensjon",
     "Vurdere om dine ansatte enkeltvis eller sammen gjør at det er krav om",
     "OTP"
    ]
   },
   {
    "nr": "10.11.7",
    "tekst": "Kjenner du til ordningen med gjennomstnittsberegnet arbeidstid, og har du grunnlaget for denne beregningen?",
    "dok": false,
    "krav": [
     "Avtale med arbeidstaker at arbeidstid skal gjennomsnittsberegnes",
     "Planlegge og føre oversikt over arbeidstid slik at det er i henhold til regelverket"
    ]
   },
   {
    "nr": "10.11.8",
    "tekst": "Kjenner du til krav om døgnhvil og ukehvil?",
    "dok": false,
    "krav": [
     "Kjenne til forskriftens krav om hvile",
     "Ha en arbeidsplan der arbeidstid og hviletid er beskrevet"
    ]
   },
   {
    "nr": "10.11.9",
    "tekst": "Har dine ansatte kjennskap til, og fått opplæring i, rutiner for varsling i din bedrift?",
    "dok": false,
    "krav": [
     "Ha tilgjengelig verktøy for at arbeidstakere kan varsle",
     "Ha et system for oppfølging av varsel"
    ]
   },
   {
    "nr": "10.11.10",
    "tekst": "Er verneombud valgt i samsvar med gjeldende regler?",
    "dok": false,
    "krav": [
     "Tilrettelegge for valg av verneombud ved 5 eller flere ansatte",
     "Sørge for skriftlig avtale hvis det ikke velges verneombud ved 4 eller færre ansatte"
    ]
   },
   {
    "nr": "10.12.1",
    "tekst": "Har gården en oppdatert beredskapsplan lett tilgjengelig for alle?",
    "dok": true,
    "krav": [
     "Utarbeide en skriftlig beredskapsplan der det er beskrevet hva som skal gjøres i de aktuelle situasjonene.",
     "Lage en beredskapsplakat med skisse over bygninger og med nødvendig informasjon om hva bygg inneholder"
    ]
   },
   {
    "nr": "10.12.2",
    "tekst": "Er det lett tilgjengelig førstehjelpsutstyr på gården?",
    "dok": false,
    "krav": [
     "Ha tilgjengelig førstehjelpsutstyr der det kan bli behov for det i arbeidssituasjonen"
    ]
   },
   {
    "nr": "10.12.3",
    "tekst": "Er det førstehjelpskompetanse på gården?",
    "dok": false,
    "krav": [
     "Ha nødvendig oversikt over førstehjelpsutstyr som finnes på gården",
     "Kunne bruke tilgjengelig utstyr på riktig måte",
     "Kunne utføre nødvendig førstehjelp"
    ]
   },
   {
    "nr": "10.12.4",
    "tekst": "Har du en plan for hvordan du kan håndtere eventuelle kriser eller produksjonsavvik på gården?",
    "dok": false,
    "krav": [
     "kartlegge produksjon med formål å finne kritiske områder",
     "planlegge skadereduserende rutiner knyttet til både produkt og produksjonsapparatet",
     "planlegge for eventuelle personlige situasjoner som kan oppstå"
    ]
   },
   {
    "nr": "10.12.5",
    "tekst": "Kjenner du til hvilke plikter du har når det gjelder rapportering av skader og ulykker på gården?",
    "dok": false,
    "krav": [
     "Kjenne til kravet om registrering i henhold til Arbeidsmiljøloven §5.2"
    ]
   }
  ]
 },
 {
  "nr": 15,
  "navn": "Grovfôr, korn, frø, olje- og belgvekster",
  "versjon": "2026.10",
  "url": "https://www.ksl.no/ksl-standarden/grovfor-korn-fro-olje-og-belgvekster/",
  "seksjoner": [
   {
    "nr": "15.1",
    "navn": "Grovfôr"
   },
   {
    "nr": "15.2",
    "navn": "Korn, frø, olje- og belgvekster"
   }
  ],
  "sporsmal": [
   {
    "nr": "15.1.1",
    "tekst": "Lagrer du grovforet ditt trygt?",
    "dok": false,
    "krav": [
     "Lagre grovfôret slik at det, etter best mulig evne, er sikret mot ville dyr.",
     "Sikre grovfôret mot skader som kan oppstå ved ekstremvær som kraftig nedbør, flom og jordras.",
     "Lagre grovfôret slik at det ikke blir forurenset."
    ]
   },
   {
    "nr": "15.1.2",
    "tekst": "Noterer du type og mengde ensileringsmiddel du har brukt for de ulike fôrpartiene? (bruker du ikke ensileringsmiddel, svar \"Ikke relevant\") Ensileringsmiddel er et kjemikalie og skal derfor dokumenteres.",
    "dok": true,
    "krav": [
     "registrere type og mengde ensileringsmiddel som brukes til de ulike fôrpartiene",
     "kunne knytte registreringene til aktuelt fôrparti"
    ]
   },
   {
    "nr": "15.2.1",
    "tekst": "Har du sikret at beiset såvare ikke forurenser mat- og fôrkorn, og lagrer du det utilgjengelig for dyr?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "15.2.2",
    "tekst": "Er transportutstyr til korn, frø, olje- og belgvekster rengjort før bruk, og er råvarene tildekket under transport?",
    "dok": false,
    "krav": [
     "alt transportutstyr brukt til korn, frø, olje- og belgvekster være grundig rengjort før bruk.",
     "råvarene dekkes til under transport, slik at de er beskyttet mot forurensning fra vær, støv, jord, gjødselrester, skadedyr eller annet materiale.",
     "transporten gjennomføres på en måte som forhindrer spredning av floghavre, blant annet ved å hindre at frø kan falle av transportmidlene eller forurense andre arealer."
    ]
   },
   {
    "nr": "15.2.3",
    "tekst": "Rengjør du tørkeutstyr og lager minst én gang i året?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "15.2.4",
    "tekst": "Lagrer du råvarene slik at de er beskyttet mot forurensning og skadegjørere?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "15.2.5",
    "tekst": "Tørker, rullerer og kjøler du korn og frø til lagerfast vare?",
    "dok": false,
    "krav": []
   }
  ]
 },
 {
  "nr": 30,
  "navn": "Drøvtyggere – generelt",
  "versjon": "2026.7",
  "url": "https://www.ksl.no/ksl-standarden/drovtyggere-generelt/",
  "seksjoner": [
   {
    "nr": "30.1",
    "navn": "Sporbarhet"
   },
   {
    "nr": "30.2",
    "navn": "Smittevern"
   },
   {
    "nr": "30.3",
    "navn": "Helse og medisinbruk"
   },
   {
    "nr": "30.4",
    "navn": "Legemiddelavtaler"
   },
   {
    "nr": "30.5",
    "navn": "Oppstalling, stell og renhold av dyr"
   },
   {
    "nr": "30.6",
    "navn": "Fôr og vann"
   },
   {
    "nr": "30.7",
    "navn": "Dyr på beite"
   },
   {
    "nr": "30.8",
    "navn": "Kadaverhåndtering"
   },
   {
    "nr": "30.9",
    "navn": "Utegangerdyr"
   },
   {
    "nr": "30.10",
    "navn": "Import av dyr, sæd og embryo"
   },
   {
    "nr": "30.11",
    "navn": "Har du kamelider (lama og alpakka) på gården din?"
   }
  ],
  "sporsmal": [
   {
    "nr": "30.1.1",
    "tekst": "Har du en rutine for å merke dyrene til rett tid, og for å sette inn erstatningsmerker ved behov?",
    "dok": false,
    "krav": [
     "Sørge for at all øremerking er i samsvar med forskrift",
     "rapportering til Mattilsynets Husdyrregister i henhold til gjeldende frister",
     "føring i dyreholdjournal i henhold til forskrifter og forordninger"
    ]
   },
   {
    "nr": "30.1.2",
    "tekst": "Fører du fortløpende dyreholdjournal via en husdyrkontroll eller i egen journal?",
    "dok": true,
    "krav": [
     "Føre en fortløpende journal over alle hendelser i dyreholdet"
    ]
   },
   {
    "nr": "30.2.1",
    "tekst": "Har du en skriftlig smittevernplan for dyreholdet ditt som er oppdatert siste året?",
    "dok": true,
    "krav": [
     "Utarbeide en skriftlig smitevernplan",
     "Oppdatere denne årlig"
    ]
   },
   {
    "nr": "30.2.2",
    "tekst": "Er alle som jobber i dyreholdet kjent med og følger gårdens smittevernplan?",
    "dok": false,
    "krav": [
     "Sikre at alle som arbeider i dyreholdet, kjenner og følger smittevernplanen."
    ]
   },
   {
    "nr": "30.2.3",
    "tekst": "Blir dyr lasta inn og ut på en måte som ivaretar god dyrevelferd?",
    "dok": false,
    "krav": [
     "Sørge for at inn- og utlasting av dyr i din besetning gjennomføres på en dyrevelferdsmessig forsvarlig måte."
    ]
   },
   {
    "nr": "30.2.4",
    "tekst": "Har du en smittesluse som er delt i tydelige soner, og som er innredet slik at personer kan rengjøre hender og medbrakt utstyr, og slik at de kan skifte fottøy og klær eller ta på seg overtrekkstøy?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "30.2.5",
    "tekst": "Holder du smittesluse, forrom og husdyrrom tilfredsstillende rent og ryddig?",
    "dok": false,
    "krav": [
     "Sørge for at smitteslusa, fôrrommet og materialene og innredningen i tilholdsrommet for dyra kan rengjøres.",
     "Du må holde rommene ryddige og rene, og desinfisere dem ved behov.",
     "Det skal være godt renhold i alle husdyrrom, slik at god dyrevelferd ivaretas, smittepress reduseres og arbeidsmiljøet blir godt."
    ]
   },
   {
    "nr": "30.2.6",
    "tekst": "Sikrer du at personer som har besøkt dyrehold med klauvdyr i utlandet, ikke får adgang til husdyrrom før det har gått 48 timer etter ankomst til Norge?",
    "dok": false,
    "krav": [
     "Sørge for at personer som har besøkt dyrehold med klauvdyr i utlandet ikke får tilgang til dine husdyrrom før det har gått minimum 48 timer fra ankomst til Norge."
    ]
   },
   {
    "nr": "30.2.7",
    "tekst": "Har du rutiner for å melde fra til Mattilsynet eller veterinær ved mistanke om smittsom sykdom, ved unormal dødelighet, eller vesentlig redusert produksjon av ukjent årsak i anlegget ditt?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "30.3.1",
    "tekst": "Har du etablert rutiner som sikrer at produkter du leverer til varemottaker eller direkte til forbruker er trygge å spise, fri for rester av legemidler og kommer fra friske dyr?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "30.3.2",
    "tekst": "Rapporterer du alle egenbehandlinger med reseptbelagte legemidler, slik som parasittbehandling, slik at slakteriet mottar fullstendig matkjedeinformasjon fra din besetning minst 24 timer før slakting?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "30.3.3",
    "tekst": "Fører du helsejournal for besetninga, for eksempel i helsekort eller i en husdyrkontroll?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "30.4.1",
    "tekst": "Fra 1. mai 2026 stiller næringen krav om at du har en digital legemiddelavtale med din avtaleveterinær. Avtalen skal være registrert i digitalt medisinregnskap. Oppfyller du dette kravet?",
    "dok": true,
    "krav": [
     "Ha en oppdatert og digital avtale med din avtaleveterinær. · Avtalen skal være digital · Avtalen skal tegnes i digitalt medisinregnskap · Avtalen skal legges frem for KSL-revisor på eksternrevisjon"
    ]
   },
   {
    "nr": "30.4.2",
    "tekst": "Næringen stiller krav om at produsenter med legemiddelavtale har gjennomført og bestått kurset «Ansvarlig legemiddelbruk» hos Animalia innen 1. mai 2026. Oppfyller du kravet?",
    "dok": false,
    "krav": [
     "Gjennomføre og bestå kurset «Ansvarlig legemiddelbruk» hos Animalia innen 01.05.2026"
    ]
   },
   {
    "nr": "30.4.3",
    "tekst": "Næringen stiller krav om at produsenter med legemiddelavtale fører og bruker Digitalt Medisinregnskap løpende fra 1. mai 2026. Oppfyller du kravet?",
    "dok": false,
    "krav": [
     "Benytte Digitalt Medisinregnskap",
     "Registrere bruk av legemidler samme dag som legemidlet er gitt til aktuelt dyr/dyregruppe."
    ]
   },
   {
    "nr": "30.4.4",
    "tekst": "Foreligger det dokumentasjon på at du som driftsansvarlig har mottatt opplæring fra veterinær i bruk og administrering av legemidler, knyttet til legemiddelavtalen?",
    "dok": false,
    "krav": [
     "Kunne vise til dokumentert opplæring i bruk av legmidler du har tegnet legemiddelavtale for.",
     "Legge frem dokumentasjonen på eksternrevisjon."
    ]
   },
   {
    "nr": "30.4.5",
    "tekst": "Legemidler skal oppbevares trygt, i tråd med forskrift, og etter legemiddelprodusentens anvisning. Oppfyller du kravet?",
    "dok": false,
    "krav": [
     "Kjenne til kravene for riktig oppbevaring av de reseptpliktige legemidlene du har i din besetning",
     "Oppbevare legemidler i tråd med kravene"
    ]
   },
   {
    "nr": "30.5.1",
    "tekst": "Blir syke og skadde dyr, og dyr som skal kalve/lamme, skjermet fra andre dyr?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "30.5.2",
    "tekst": "Blir dyra oppstallet og stelt slik at de holder seg rene?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "30.5.3",
    "tekst": "Har du en skriftlig rutine for hvordan dyra sikres mot skadelige gasser ved omrøring av blautgjødsel?",
    "dok": true,
    "krav": [
     "Ha en skriftlig rutine for omrøring og tømming av blautgjødsel som beskriver hvordan dyr, mennesker og besøkende skal beskyttes mot farlige gjødselgasser.",
     "Sørge for god utlufting i hele husdyrrommet før, under og etter omrøring.",
     "Planlegge omrøring til perioder der vær- og vindforhold gir god gjennomlufting.",
     "Så langt som mulig gjennomføre omrøring når færrest mulig dyr oppholder seg i husdyrrommet.",
     "Merke og sperre av innganger slik at uvedkommende ikke kommer inn i husdyrrommet under arbeidet.",
     "Sørge for at omrøringen skjer forsiktig og kontrollert for å redusere risikoen for rask frigjøring av gjødselgasser."
    ]
   },
   {
    "nr": "30.6.1",
    "tekst": "Kontrollerer du vanntilgang og kvalitet på drikkevannet daglig?",
    "dok": false,
    "krav": [
     "Sørge for at dyrene til enhver tid har tilgang på nok drikkevann og at dette er av god hygienisk kvalitet.",
     "Sørge for at vannautomater, drikkekar, nipler og liknende blir kontrollert daglig, for å sikre at de fungerer og gir dyra det vannet de trenger.",
     "Dersom dyrene går på innmarksbeite skal også vanntilgangen der kontrolleres daglig"
    ]
   },
   {
    "nr": "30.6.2",
    "tekst": "Tar du vare på fôrprøver og varedeklarasjon/fôrseddel for innkjøpt kraftfôr?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "30.6.3",
    "tekst": "Har du rutiner for å kontrollere at innkjøpt norsk grovfôr blir produsert i samsvar med KSL-standarden?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "30.6.4",
    "tekst": "Dersom du kjøper importert grovfôr: Har du fulgt Mattilsynets regler og anbefalinger for import og bruk av importerte grovfôrvarer?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "30.7.1",
    "tekst": "Skriver du i dyreholdjournalen når og hvilke dyr som sendes på beite og når de tas tilbake til anlegget igjen?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "30.7.2",
    "tekst": "Har du rutine for tilsyn med dyr på beite i samsvar med forskrift?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "30.8.1",
    "tekst": "Er det rutiner på gården som sikrer at Biosirk (tidligere Norsk Protein) blir varslet når storfe over 4 år og/eller småfe over 18 måneder dør, og når slike dyr blir avlivet på grunn av sykdom eller skade?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "30.8.2",
    "tekst": "Oppbevarer du kadaver midlertidig på en tilfredsstillende måte med tanke på smitte, lukt og synlighet?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "30.8.3",
    "tekst": "Leverer du kadaver til godkjent mottak?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "30.9.1",
    "tekst": "Har dyr som går ute hele året tilgang til tilfredsstillende oppholdsrom?",
    "dok": false,
    "krav": [
     "Sørge for at dyr på utegang har tilgang til et oppholdsrom som gir tilstrekkelig beskyttelse mot vær og vind.",
     "Sørge for at oppholdsrommet har minst tre tette vegger og tak.",
     "Sørge for at den åpne siden er plassert og utformet slik at dyra får god beskyttelse mot den dominerende vindretningen.",
     "Ha mulighet til å skjerme den åpne siden ved behov, for eksempel ved sterk kulde, slagregn eller andre krevende værforhold.",
     "Sørge for at oppholdsrommet er stort nok til at alle dyr kan søke ly og ligge samtidig, uten å bli hindret av andre dyr.",
     "Sørge for at plassering, utforming og adkomst gjør at dyra faktisk bruker oppholdsrommet."
    ]
   },
   {
    "nr": "30.9.2",
    "tekst": "Dersom du holder dyr uten tilgang til oppholdsrom, har du tillatelse fra Mattilsynet?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "30.9.3",
    "tekst": "Er det etablert opplegg for tilleggsfôring dersom værforhold og beiteverdi tilsier dette?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "30.9.4",
    "tekst": "Har dyrene til enhver tid tilgang til tørr liggeplass, og er det tråkkfast underlag rundt spise og drikkeplass?",
    "dok": false,
    "krav": [
     "Sørge for at dyra til enhver tid har tilgang til en tørr og bekvem liggeplass.",
     "Sørge for at liggeplassen er drenert slik at vann ikke samler seg eller renner inn på liggeområdet.",
     "Sørge for at liggeplassen er dekket med halm eller annet egnet materiale som holder underlaget tørt og gir god isolasjon.",
     "Sørge for at områder rundt fôrings- og drikkeplasser har tråkkfast underlag slik at dyra ikke må oppholde seg i gjørme, overvann, eller avføring.",
     "Kontrollere utearealer og liggeområder regelmessig, og gjennomføre tiltak dersom forholdene kan påvirke dyrevelferden negativt."
    ]
   },
   {
    "nr": "30.9.5",
    "tekst": "Har du rutiner som sikrer tilstrekkelig tilsyn med dyra på utegang gjennom hele året?",
    "dok": false,
    "krav": [
     "Ha rutiner som sikrer at dyra på utegang får tilsyn minst én gang daglig.",
     "Sørge for hyppigere tilsyn med nyfødte, syke, skadde eller høydrektige dyr, særlig i tiden rundt kalving eller lamming.",
     "Ha oversikt over hele dyregruppen, slik at dyr som trenger behandling eller ekstra oppfølging blir oppdaget så raskt som mulig.",
     "Kontrollere uteområdet regelmessig og fjerne eller utbedre forhold som kan føre til skader, sykdom eller dårlig dyrevelferd.",
     "Ha tilgang til egnet oppstalling for dyr som trenger særskilt tilsyn, behandling eller beskyttelse mot vær og kulde."
    ]
   },
   {
    "nr": "30.10.1",
    "tekst": "Varsler du Mattilsynet og KOORIMP før du importerer dyr, sæd eller embryo fra utlandet, og hvis du videreselger eller overtar noe av dette?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "30.10.2",
    "tekst": "Når du importerer: Kan du dokumentere at offentlige krav er oppfylt, at dyr og avlsmateriale er undersøkt, og at tiltak er utført i samsvar med krav utarbeidet av KOORIMP?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "30.10.3",
    "tekst": "Kan du dokumentere at du har oppfylt KOORIMPs tilleggskrav ved videresalg eller overtakelse av storfe eller småfe som er innført fra utlandet?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "30.11.1",
    "tekst": "Kan du dokumentere at alle importerte kameldyr på gården din er importert i tråd med KOORIMPs regelverk?",
    "dok": true,
    "krav": []
   }
  ]
 },
 {
  "nr": 31,
  "navn": "Storfe",
  "versjon": "2026.7",
  "url": "https://www.ksl.no/ksl-standarden/storfe/",
  "seksjoner": [
   {
    "nr": "31.1",
    "navn": "Storfehold"
   }
  ],
  "sporsmal": [
   {
    "nr": "31.1.1",
    "tekst": "Registrerer du fortløpende hendelser i storfeholdet ditt i en husdyrkontroll eller i husdyrregisteret?",
    "dok": true,
    "krav": [
     "Sørge for å rapportere følgende til husdyrregisteret innen fristen på 7 dager: Når nyfødte storfe merkes første gang, og ved flytting av dyr inn og ut av anlegget (for eksempel ved kjøp, salg, utlån av dyr, levering til slakt, flytting til beite med andre dyr, fellesseter, import eller eksport). Husk også å registrere når dyr dør/ slaktes."
    ]
   },
   {
    "nr": "31.1.2",
    "tekst": "Ved kjøp, salg og/eller leie av storfe: Overholder du karenstider og har du nødvendig helsedokumentasjon og egenerklæringer?",
    "dok": true,
    "krav": [
     "Som skal selge eller flytte storfe til et annet dyrehold fylle ut egenerklæring før du kan flytte dyret/dyrene. Egenerklæringen skal bekerfte at:",
     "Ingen dyr i dyreholdet ditt har vist tegn til sykdom siste 14 dager.",
     "Dyret/dyrene som skal flyttes har oppholdt seg i ditt dyrehold i mer enn 30 dager (med unntak av dyr som er født i besetningen).",
     "At du de siste 14 dagene IKKE har fått storfe, svin eller kamelider fra andre dyrehold, fellesbeite eller tilbake fra deltagelse på dyresamlinger (fesjå eller dyrsku)."
    ]
   },
   {
    "nr": "31.1.3",
    "tekst": "Oppstaller du dyra i samsvar med forskrift om hold av storfe?",
    "dok": false,
    "krav": [
     "oppstalling.",
     "Kyr skal ha tilgang på en liggeplass med mykt underlag og tett gulv. Dette gjelder også kviger som har mindre enn to måneder igjen til kalving.",
     "Kalver under seks måneder skal ikke holdes bundet.",
     "Kalver skal ha en tørr og trekkfri oppholdsplass, og myk liggeplass med tett og varmeisolerende gulv."
    ]
   },
   {
    "nr": "31.1.4",
    "tekst": "Sikrer du at dyra har god klauvhelse gjennom regelmessig oppfølging, inkludert inspeksjon, nødvendig klauvstell i klauvboks utført av kyndig person og behandling ved behov?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "31.1.5",
    "tekst": "Det er krav om at alle storfe, unntatt hanndyr på over 6 måneder, skal få mulighet til fri bevegelse og mosjon på beite. Beitetid er minimum 8 uker for dyr oppstallet på løsdrift og 12 - 16 uker for dyr oppstallet på båsfjøs. Oppfyller du kravet?",
    "dok": true,
    "krav": [
     "Sørge for at storfe får gode muligheter for fri bevegelse, mosjon og naturlig atferd.",
     "Gi storfe på løsdrift tilgang til beite i minst 8 uker i løpet av sommerhalvåret.",
     "Gi storfe som er oppstallet i båsfjøs tilgang til beite i minst 16 uker i løpet av sommerhalvåret dersom beiteområdet ligger i sone 1-4, eller minst 12 uker dersom beiteområdet ligger i sone 5-7.",
     "Dersom egnet beite ikke er tilgjengelig for båsfjøs som var ferdig bygget før 1. januar 2014, sørge for at dyrene i stedet har tilgang til en egnet luftegård eller et annet utendørs område som gir mulighet for fri bevegelse og mosjon."
    ]
   }
  ]
 },
 {
  "nr": 32,
  "navn": "Småfe",
  "versjon": "2026.7",
  "url": "https://www.ksl.no/ksl-standarden/smafe/",
  "seksjoner": [
   {
    "nr": "32.1",
    "navn": "Småfehold"
   },
   {
    "nr": "32.2",
    "navn": "Helårs utedrift uten tilgang på dyrerom"
   }
  ],
  "sporsmal": [
   {
    "nr": "32.1.1",
    "tekst": "Ved kjøp, salg og/eller leie av dyr: Overholder du karenstider og har du nødvendig helsedokumentasjon og egenerklæringer?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "32.1.2",
    "tekst": "Har du oppstallet dyra i samsvar med forskrift om velferd for småfe?",
    "dok": false,
    "krav": [
     "Sørge for at småfe har tilgang til en bekvem, tørr og trekkfri liggeplass der alle dyra kan ligge samtidig.",
     "Sørge for at fôrkrybber og fôrbrett er utformet slik at dyra kan ete i naturlig stilling.",
     "Sørge for at spalteåpninger, strekkmetall og annen innredning er tilpasset dyrenes størrelse og ikke medfører fare for skader.",
     "Vedlikeholde bygninger, gulv og innredning slik at de ikke utgjør en risiko for dyrenes helse eller velferd.",
     "Sau og geit skal holdes i løsdrift. Dyra skal ikke holdes varig bundet. Vær og bukk kan ved behov holdes bundet i paringssesongen."
    ]
   },
   {
    "nr": "32.1.3",
    "tekst": "Små lam og kje skal ha tilgang til tett liggeunderlag som gir god isolasjon. Oppfyller du kravet?",
    "dok": false,
    "krav": [
     "Sørge for at små lam og kje har tilgang på tett liggeunderlag",
     "Liggeunderlaget skal være bekvemt og det skal isolere",
     "Bruke nok strø eller annet egnet underlag til at liggeplassen holder seg tørr"
    ]
   },
   {
    "nr": "32.1.4",
    "tekst": "For dyrehold med sau: Sau skal klippes etter behov, og minimum årlig. Oppfyller du kravet?",
    "dok": false,
    "krav": [
     "Sørge for godt og regelmessig stell, og for at sauene dine klippes minst en gang i året."
    ]
   },
   {
    "nr": "32.1.5",
    "tekst": "Blir dyras klauver undersøkt regelmessig og beskåret ved behov?",
    "dok": false,
    "krav": [
     "Sørge for god klauvhelse i besetningen din.",
     "Sørge for at klauvene undersøkes regelmessig og beskjæres ved behov.",
     "Sikre at dyr med tegn på smerte, halthet eller unormal klauvform får nødvendig oppfølging så raskt som mulig."
    ]
   },
   {
    "nr": "32.1.6",
    "tekst": "Småfe skal holdes på egnet beite minst 16 uker i året. Oppfyller du kravet?",
    "dok": false,
    "krav": [
     "Sikre at småfe har tilgang på beite minimum 16 uker i året."
    ]
   },
   {
    "nr": "32.2.1",
    "tekst": "Alle som holder sau på helårs utedrift, uten tilgang til oppholdsrom, skal ha skriftlig tillatelse fra Mattilsynet. Oppfyller du kravet?",
    "dok": false,
    "krav": [
     "Mattilsynet dersom du holder sau på helårs utedrift uten oppholdsrom."
    ]
   }
  ]
 },
 {
  "nr": 35,
  "navn": "Melk",
  "versjon": "2026.10",
  "url": "https://www.ksl.no/ksl-standarden/melk/",
  "seksjoner": [
   {
    "nr": "35.1",
    "navn": "Melkerom og/eller tankrom"
   },
   {
    "nr": "35.2",
    "navn": "Melking"
   },
   {
    "nr": "35.3",
    "navn": "Brann- og el-sikkerhet i melkeproduksjon"
   }
  ],
  "sporsmal": [
   {
    "nr": "35.1.1",
    "tekst": "Er melkerom og/eller tankrom (der melk håndteres og lagres) adskilt fra husdyrrom, og er rommet/rommene rene, ryddige og tilrettelagt for god hygiene og mattrygghet?",
    "dok": false,
    "krav": [
     "Sørge for at melkerom og/eller tankrom (der håndtering og lagring av melk skjer) er fysisk adskilt fra husdyrrom.",
     "Sørge for at rommet/rommene er rene, ryddige og godt vedlikeholdt, slik at god hygiene og mattrygghet ivaretas.",
     "Sørge for at:",
     "gulv, vegger og tak er tette, hele og lette å rengjøre",
     "rommet er sikret mot skadedyr",
     "væske ledes bort og avfall fjernes fortløpende",
     "det finnes tilfredsstillende muligheter for håndvask og håndtering av avfall",
     "Sørge for at rommet har:"
    ]
   },
   {
    "nr": "35.2.1",
    "tekst": "Er området der melking foregår rent og tilrettelagt for god hygiene?",
    "dok": false,
    "krav": [
     "Sørge for at området der melking foregår holdes rent, ryddig og godt vedlikeholdt.",
     "Sørge for at innredning, utstyr og overflater som kommer i kontakt med melk eller melkeutstyr er rene.",
     "Fjerne gjødsel, smuss og annet som kan forurense melk eller melkeutstyr."
    ]
   },
   {
    "nr": "35.2.2",
    "tekst": "Er det tilrettelagt for god håndhygiene i naturlig avstand til der melking skjer?",
    "dok": false,
    "krav": [
     "Ha et egnet sted for å vaske hender i naturlig avstand til der melking skjer.",
     "Sørge for at det legges til rette for god håndhygiene med",
     "Tilgang på rent vann",
     "Såpe",
     "Løsning for tørking av hender (eksempelvis engangspapir)",
     "Avfallsløsning for brukt papir som tømmes regelmessig"
    ]
   },
   {
    "nr": "35.2.3",
    "tekst": "Har du rutiner som sikrer at melk du leverer til meieriet kun kommer fra friske dyr med friske jur?",
    "dok": false,
    "krav": [
     "Sørge for at melk du leverer til meieriet, kun kommer fra friske dyr med friske jur.",
     "Bruk prøvekopp eller andre metoder for å undersøke melka før melking."
    ]
   },
   {
    "nr": "35.2.4",
    "tekst": "Har du rutiner for å sikre at melka på tanken kommer fra rene spener og rent jur?",
    "dok": false,
    "krav": [
     "Sørge for at spener og jur er rene før melking og fri for potensielle rester etter vaske-og desinfeksjonsmidler, midler mot skadedyr og jurpleieprodukter."
    ]
   },
   {
    "nr": "35.2.5",
    "tekst": "Er det etablert rutiner for å kontrollere at melkesystem og tank er rene etter vask?",
    "dok": false,
    "krav": [
     "Ha rutiner for vask av melkeanlegget",
     "kontroll av vaskemiddeltildeling",
     "Kontroll av temperatur på vaskevann"
    ]
   },
   {
    "nr": "35.2.6",
    "tekst": "Er det rutiner for å kontrollere temperatur og nedkjøling av melk minimum daglig?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "35.2.7",
    "tekst": "Er det drikkevannskvalitet på vannet som benyttes ved melking og til rengjøring av melkeutstyr? Dersom gården har egen vannkilde må vannkvaliteten kunne dokumenteres med årlig vannprøve. Vannet skal holde drikkevannskvalitet Det er et krav at vann som blir brukt ved melking og rengjøring av melkeutstyr, holder drikkevannskvalitet. Analyselaboratoriet du bruker, skal kunne opplyse om vannprøven holder dette nivået. Ta vannprøve hver høst Dersom du bruker vann fra din egen private vannkilde, skal du i tidsrommet august–november hver høst ta en vannprøve som du sender til analyse. Oppbevar analyseresultatene i 2 år. Vi anbefaler også at du merker av vannkilden og alle vannførende ledninger på et kart. Er du tilknyttet et offentlig godkjent vannverk?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "35.2.8",
    "tekst": "Er alle som jobber i besetninga som har økt risiko for å være bærer av MRSA, testet negativt?",
    "dok": false,
    "krav": [
     "Sørge for at alle som jobber i din besetning som har økt risiko for MRSA tester seg."
    ]
   },
   {
    "nr": "35.3.1",
    "tekst": "Er det tilstrekkelig brannslokkingsutstyr i bygningene, er det lett tilgjengelig og klart til bruk, og er nødvendig kontroll og vedlikehold gjennomført?",
    "dok": false,
    "krav": [
     "vurdere hvor mye brannslokkingsutstyr som er nødvendig for å dekke hele arealet",
     "ha godkjent brannslokkingsutstyr som er lett tilgjengelig og klart til bruk",
     "plassere brannslokkingsapparater ved innganger til og utganger fra brannceller og i rom med stor brannbelastning",
     "vurdere behovet for brannslokkingsutstyr som en del av den årlige gjennomgangen av elektrisk anlegg og utstyr",
     "sørge for at brannslokkingsutstyret kontrolleres og vedlikeholdes i samsvar med gjeldende krav",
     "sørge for at periodisk kontroll av håndslokkere utføres etter NS 3910 av kvalifisert servicepersonell"
    ]
   },
   {
    "nr": "35.3.2",
    "tekst": "Gjennomføres det faglig kontroll med termografering av det elektriske anlegget minimum hvert tredje år? (gjelder bygg med husdyr, varmlufts korntørke eller forsikringssum over en sum som forsikringsselskapet ditt har satt)",
    "dok": true,
    "krav": [
     "I god tid før det har gått tre år, bestille el-kontroll med termografering",
     "Sjekke at kontrollforetak kan gjennomføre kontroll i henhold til standard",
     "NEK 405-3 med tillegg landbruk for el-kontroll og NEK 405-1 for termografering"
    ]
   },
   {
    "nr": "35.3.3",
    "tekst": "Er det installert brannalarmanlegg i driftsbygningen?",
    "dok": false,
    "krav": [
     "Avklare om det er krav til brannalarm i dine bygg",
     "Montere inn brannalarmanlegg godkjent i henhold til Norsk Standard 3960"
    ]
   }
  ]
 },
 {
  "nr": 40,
  "navn": "Svin",
  "versjon": "2026.6",
  "url": "https://www.ksl.no/ksl-standarden/svin/",
  "seksjoner": [
   {
    "nr": "40.1",
    "navn": "Sporbarhet"
   },
   {
    "nr": "40.2",
    "navn": "Smittevern"
   },
   {
    "nr": "40.3",
    "navn": "Import av svin, sæd eller embryo"
   },
   {
    "nr": "40.4",
    "navn": "Helse og medisinbruk"
   },
   {
    "nr": "40.5",
    "navn": "Kadaverhåndtering"
   },
   {
    "nr": "40.6",
    "navn": "Fôr og vann"
   },
   {
    "nr": "40.7",
    "navn": "Oppstalling, stell og renhold av dyr"
   },
   {
    "nr": "40.8",
    "navn": "Legemiddelavtaler"
   },
   {
    "nr": "40.9",
    "navn": "Utegris"
   }
  ],
  "sporsmal": [
   {
    "nr": "40.1.1",
    "tekst": "Sørger du for at svin som flyttes fra anlegget følges av nødvendig dokumentasjon, og at flytting registreres i Husdyrregisteret. Når svin flyttes ut av et anlegg skal de følges av et transportdokument. Transportdokumentet kan erstattes av andre dokumenter som inneholder de samme opplysninger som skal være med i transportdokument. Når dyr flyttes skal dette registreres i Husdyrregisteret. Både avsender og mottaker skal melde hendelser. Det er mulig for driftsansvarlig å la andre registrere opplysningene. F.eks. kan en driftsansvarlig overlate til slakteriet å rapportere flyttehendelsene. Registrering i husdyrregisteret Når svin flyttes mellom to anlegg, skal driftsansvarlig for avsenderanlegget og driftsansvarlig for mottakeranlegget registrere opplysninger om forflytningen i husdyrregisteret. Dette skal gjøres innen 7 dager etter at dyra ankommer. Det er mulig å gjøre en avtale med f.eks. slakteri, at de melder flytting på vegne av driftsansvarlig for avsenderanlegget. § Krav Karenstid flytting av dyr Informasjon",
    "dok": true,
    "krav": []
   },
   {
    "nr": "40.1.2",
    "tekst": "Er grisene merket med et øremerke eller en lesbar tatovering med anleggets produsentnummer/registreringsnummer?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "40.1.3",
    "tekst": "Fører du fortløpende dyreholdjournal via en husdyrkontroll eller i egen journal?",
    "dok": true,
    "krav": [
     "Aktivt benytte husdyrkontroll (Ingris)",
     "Eller føre løpende oversikt over hendelser i dyreholdet i annet system (elektronisk eller på papir).",
     "Oppbevare alle opplysninger i minst 5 år."
    ]
   },
   {
    "nr": "40.2.1",
    "tekst": "Har du en skriftlig smittevernplan for dyreholdet ditt som er oppdatert siste året?",
    "dok": true,
    "krav": [
     "Ha en oppdatert smittevernplan i besetningen din"
    ]
   },
   {
    "nr": "40.2.2",
    "tekst": "Er alle som jobber i dyreholdet kjent med og følger gårdens smittevernplan?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "40.2.3",
    "tekst": "Fører du besøkslogg som gir oversikt over alle som har vært på besøk i grisehuset?",
    "dok": true,
    "krav": [
     "føre en besøkslogg for alle som passerer smitteslusa",
     "sikre at besøksloggen gir en fullstendig og oppdatert oversikt over hvem som har vært i grisehuset og når"
    ]
   },
   {
    "nr": "40.2.4",
    "tekst": "Har du en ren smittesluse som er delt i tydelige soner, og som er innredet slik at personer kan rengjøre hender og medbrakt utstyr, slik at de kan skifte fottøy og klær og ta på seg overtrekkstøy?",
    "dok": false,
    "krav": [
     "Sikre at alle som skal inn i grisehuset, inkludert gårdens egne folk, benytter seg av smitteslusen.",
     "Sørge for at det er et tydelig og opphøyd skille mellom ren og uren sone,",
     "Sørge for at det er mulig å vaske hender og utstyr,",
     "Sørge for at veterinær og andre besøkende kan skifte fottøy og overtrekkstøy.",
     "Sørge for at smitteslusa er ren og ryddig."
    ]
   },
   {
    "nr": "40.2.5",
    "tekst": "Sikrer du at personer som har besøkt husdyrhold i utlandet, ikke får adgang til husdyrrom på gården før det har gått 48 timer etter ankomst til Norge?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "40.2.6",
    "tekst": "Har du rutine for at Mattilsynet blir varslet ved mistanke om smittsom dyresykdom?",
    "dok": false,
    "krav": [
     "Ha rutiner for å varsle Mattilsynet, varemottaker eller veterinær dersom du har mistanke om at det har brutt ut smittsom dyresykdom i dyreholdet ditt (eks: Munn- og klauvsjuke, Svinepest, afrikansk svinepest)."
    ]
   },
   {
    "nr": "40.2.7",
    "tekst": "Er alle som jobber i besetninga og har økt risiko for å være bærer av MRSA, testet negativt?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "40.2.8",
    "tekst": "Er forrom og dyrerom rene?",
    "dok": false,
    "krav": [
     "Sørge for jevnlig renhold av dyrerom og forrom."
    ]
   },
   {
    "nr": "40.2.9",
    "tekst": "Gjennomfører du tiltak for å holde fugler og smågnagere borte fra foret, miljøberikelsene og strøet du benytter i grisehuset?",
    "dok": false,
    "krav": [
     "Oppbevare foret slik at det er utilgjengelig for gnagere (silo eller annen tett beholder).",
     "Sørge for at smågnagere og fugler holdes borte fra miljøberikelser og strø."
    ]
   },
   {
    "nr": "40.2.10",
    "tekst": "Dersom det finnes godkjent avfallsdeponi i nærheten av gården din, har du gjort en risikovurdering av faren for overføring av smitte fra denne til din besetning?",
    "dok": false,
    "krav": [
     "kartlegge om det finnes fyllplasser i nærheten av gården din",
     "dersom dette er tilfelle, gjennomføre en risikovurdering og oppdatere beredskapsplanen og smittevernplanen"
    ]
   },
   {
    "nr": "40.3.1",
    "tekst": "Varsler du Mattilsynet og KOORIMP før du importerer dyr, rånesæd eller embryo fra utlandet, og hvis du videreselger eller overtar noe av dette?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "40.3.2",
    "tekst": "Når du importerer: Kan du dokumentere at offentlige krav er oppfylt, at dyr og avlsmateriale er undersøkt, og at tiltak er utført i samsvar med krav utarbeidet av KOORIMP?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "40.3.3",
    "tekst": "Kan du dokumentere at du har oppfylt KOORIMPs tilleggskrav ved videresalg eller overtagelse av svin som er innført fra utlandet?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "40.4.1",
    "tekst": "Deltar du i dyrevelferdsprogram for svin?",
    "dok": false,
    "krav": [
     "Dyreholdere med 1 eller flere avlspurker, eller som planlegger å levere 10 eller flere dyr til slakt per år, skal være medlem av dyrevelferdsprogram (DVP)."
    ]
   },
   {
    "nr": "40.4.2",
    "tekst": "Rapporterer du alle egenbehandlinger med reseptbelagte legemidler, som parasittbehandling, slik at slakteriet mottar fullstendig matkjedeinformasjon fra din besetning minst 24 timer før slakting?",
    "dok": false,
    "krav": [
     "rapportere alle egenbehandlinger med reseptpliktige legemidler fortløpende",
     "sikre at slakteriet mottar fullstendig matkjedeinformasjon fra din besetning minst 24 timer før slakting"
    ]
   },
   {
    "nr": "40.4.3",
    "tekst": "Fører du journal og helseopplysninger for dyrene i anlegget ditt?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "40.4.4",
    "tekst": "Har du rutiner som sikrer at produkter du leverer til varemottaker eller direkte til forbruker er trygge å spise, fri for rester av legemidler og kommer fra friske dyr?",
    "dok": false,
    "krav": [
     "Dyr/dyregrupper som har fått medisinbehandling, merkes"
    ]
   },
   {
    "nr": "40.5.1",
    "tekst": "Oppbevarer du kadaver midlertidig på en tilfredsstillende måte med tanke på smitte, lukt og synlighet?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "40.5.2",
    "tekst": "Leverer du kadaver til godkjent mottak?",
    "dok": false,
    "krav": [
     "Levere kadaver til godkjent mottak."
    ]
   },
   {
    "nr": "40.6.1",
    "tekst": "Kontrolleres drikkekar, nipler og annet drikkeutstyr daglig, slik at dyra har god tilgang på nok og rent vann?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "40.6.2",
    "tekst": "Har purker, ungpurker og råner tilgang på nok fôr med høyt fiberinnhold?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "40.6.3",
    "tekst": "Sikrer du god forkvalitet og tar du vare på forprøver?",
    "dok": false,
    "krav": [
     "Sørge for god kvalitet på foret",
     "Sørge for at foret er uten skadelige fremmedstoffer (eks. mykotoksiner).",
     "Oppbevare forprøver og deklarasjon."
    ]
   },
   {
    "nr": "40.6.4",
    "tekst": "Hvis du bruker rene tilsetningsstoffer og/eller premikser når du blander fôr på gården: Er du registrert hos Mattilsynet som fôrprodusent?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "40.7.1",
    "tekst": "Oppfyller du arealkravene definert i forskrift om hold av svin?",
    "dok": false,
    "krav": [
     "sikre at alle dyregrupper til enhver tid har tilstrekkelig areal i tråd med forskrift om hold av svin",
     "ha rutiner for å følge med på dyretetthet og justere antall dyr i bingene etter hvert som grisene vokser"
    ]
   },
   {
    "nr": "40.7.2",
    "tekst": "Sørger du for rene dyr og for godt renhold i binger?",
    "dok": false,
    "krav": [
     "sørge for godt renhold i dyrerommet",
     "bruke strø i tilstrekkelige mengder slik at dyrene holder seg tørre og rene"
    ]
   },
   {
    "nr": "40.7.3",
    "tekst": "Svin skal ha tilgang til en bekvem, tørr, ren og trekkfri liggeplass med passe temperatur. Den skal være adskilt fra gjødselplass. Oppfyller du kravet?",
    "dok": false,
    "krav": [
     "sikre at liggeplass og gjødselplass er separate areal.",
     "Sørge for at liggeplassen er bekvem og at det er nok plass til at alle dyr kan ligge samtidig",
     "Sørge for at liggeplassen holdes tørr og ren, og alltid har tilstrekkelig med strø",
     "Sørge for at liggeplassen har tett gulv, dypstrø eller talle"
    ]
   },
   {
    "nr": "40.7.4",
    "tekst": "Får dyra rotemateriale i henhold til Mattilsynets veileder?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "40.7.5",
    "tekst": "Har du rutiner i besetningen for å følge opp syke og skadde dyr?",
    "dok": false,
    "krav": [
     "Sørge for at syke og skadde dyr behandles på en forsvarlig måte.",
     "Kontakte veterinær ved behov",
     "Der det er nødvendig sørge for at syke dyr skjermes fra andre dyr i sykebinge med rikelig tørr og myk liggeplass",
     "Avlive dyret dersom behandling ikke fungerer eller der det fører til unødig lidelse for dyret å leve videre.",
     "Sørge for tilstrekkelig antall sykebinger."
    ]
   },
   {
    "nr": "40.7.6",
    "tekst": "Sørger du for at purker som skal grise skjermes fra andre dyr og får tilgang på tilstrekkelige mengder redebyggingsmateriale før grising?",
    "dok": false,
    "krav": [
     "Sørge for at purka skjermes fra andre dyr før grising.",
     "Sørge for tilstrekkelig og passende redebyggingsmateriale 3 dager før forventet grising."
    ]
   },
   {
    "nr": "40.7.7",
    "tekst": "Svin skal normalt sett ikke fikseres. Eventuell fiksering kan kun skje slik det er beskrevet i forskrift (se veileder). Oppfyller du kravet?",
    "dok": false,
    "krav": [
     "Under fôring",
     "I forbindelse med veterinærbehandling eller inseminering",
     "Spesielt urolige dyr under brunst.",
     "Spesielt urolige purker, fra grisingstidspunkt og maksimalt 7 dager."
    ]
   },
   {
    "nr": "40.7.8",
    "tekst": "Er det god nok ventilasjon, slik at det er et tilfredsstillende klima i dyrerommet?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "40.7.9",
    "tekst": "Har dyrerommene for svin alarm som varsler strømbrudd og for høy eller for lav temperatur?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "40.8.1",
    "tekst": "Fra 1. mai 2026 stiller næringen krav om at du har en digital legemiddelavtale med din avtaleveterinær. Avtalen skal være registrert i digitalt medisinregnskap. Oppfyller du dette kravet?",
    "dok": true,
    "krav": [
     "Ha en oppdatert og digital avtale med din avtaleveterinær. · Avtalen skal være digital, med digital signatur. · Avtalen skal tegnes i digitalt medisinregnskap · Avtalen skal legges frem for KSL-revisor på eksternrevisjon"
    ]
   },
   {
    "nr": "40.8.2",
    "tekst": "Næringen stiller krav om at produsenter med legemiddelavtale har gjennomført og bestått kurset «Ansvarlig legemiddelbruk» hos Animalia innen 1. mai 2026. Oppfyller du kravet?",
    "dok": true,
    "krav": [
     "Gjennomføre og bestå kurset «Ansvarlig legemiddelbruk» hos Animalia innen 01.05.2026"
    ]
   },
   {
    "nr": "40.8.3",
    "tekst": "Næringen stiller krav om at produsenter med legemiddelavtale fører og bruker Digitalt Medisinregnskap løpende fra 1. mai 2026. Oppfyller du kravet?",
    "dok": true,
    "krav": [
     "Benytte Digitalt Medisinregnskap",
     "Registrere bruk av legemidler samme dag som legemidlet er gitt til aktuelt dyr/dyregruppe."
    ]
   },
   {
    "nr": "40.8.4",
    "tekst": "Foreligger det dokumentasjon på at du som driftsansvarlig har mottatt opplæring fra veterinær i bruk og administrering av legemidler, knyttet til legemiddelavtalen?",
    "dok": true,
    "krav": [
     "Kunne vise til dokumentert opplæring i bruk av legmidler du har tegnet legemiddelavtale for.",
     "Legge frem dokumentasjonen på eksternrevisjon."
    ]
   },
   {
    "nr": "40.8.5",
    "tekst": "Legemidler skal oppbevares i tråd med forskrift og etter legemiddelprodusentens anvisning. Oppfyller du kravet?",
    "dok": false,
    "krav": [
     "Kjenne til kravene for riktig oppbevaring av de reseptpliktige legemidlene du har i din besetning",
     "Oppbevare legemidler i tråd med kravene"
    ]
   },
   {
    "nr": "40.9.1",
    "tekst": "Dyrene skal ha tilgang på hus med tre tette vegger og tak, hvor dyra skal kunne ligge tørt. Oppfyller du kravet?",
    "dok": false,
    "krav": [
     "Sørge for at dyra har tilgang på tørr liggeplass som gir beskyttelse mot vind, nedbør, sol og ugunstige temperaturer.",
     "Liggeområdet skal ha minimum 3 tette vegger og tak."
    ]
   },
   {
    "nr": "40.9.2",
    "tekst": "Tildeling av for og vann skal skje på tørre områder. Oppfyller du kravet?",
    "dok": false,
    "krav": [
     "Sørge for at fôringsplasser og andre sterkt belastede overflater i utearealet skal grunnen være opparbeidet, hardgjort og drenert.",
     "Sørge for at utearealer som svin bruker, er egnet til formålet, og kontrolleres jevnlig med henblikk på forhold som kan påføre dyra skader og lidelser."
    ]
   },
   {
    "nr": "40.9.3",
    "tekst": "Du må sørge for at dyr som holdes ute beskyttes mot rovdyr og andre helsefarer. Oppfyller du kravet?",
    "dok": false,
    "krav": [
     "sørge for at dyra er sikret mot rovdyr gjennom egnede tiltak, for eksempel inngjerding, strømgjerde eller andre forebyggende løsninger",
     "sørge for at arealet er egnet og fritt for gjenstander som kan skade dyra",
     "sørge for at det finnes områder som gir dyra mulighet til å skjerme seg fra andre griser",
     "sørge for at utearealet ellers er utformet og vedlikeholdt slik at dyra ikke utsettes for andre helsefarer",
     "ha rutiner for jevnlig tilsyn, slik at eventuelle risikoer blir oppdaget og fulgt opp raskt"
    ]
   },
   {
    "nr": "40.9.4",
    "tekst": "Ved varmt vær må du sørge for at dyra har mulighet til å kjøle seg ned. Oppfyller du kravet?",
    "dok": false,
    "krav": [
     "sørge for at det finnes gjørmebad eller andre løsninger som gjør det mulig for gris å kjøle seg ned ved varmt vær",
     "sørge for at dyra har tilgang til skygge og gode liggeområder som reduserer varmebelastning",
     "sørge for god tilgang på rent drikkevann",
     "ha rutiner for ekstra tilsyn i perioder med høy temperatur"
    ]
   }
  ]
 },
 {
  "nr": 50,
  "navn": "Fjørfe – generelt",
  "versjon": "2026.10",
  "url": "https://www.ksl.no/ksl-standarden/fjorfe-generelt/",
  "seksjoner": [
   {
    "nr": "50.1",
    "navn": "Noteringer"
   },
   {
    "nr": "50.2",
    "navn": "Luft, lys og strø"
   },
   {
    "nr": "50.3",
    "navn": "Smittevern"
   },
   {
    "nr": "50.4",
    "navn": "Helse og sykdom"
   },
   {
    "nr": "50.5",
    "navn": "Innsetting av daggamle kyllinger eller unghøner"
   },
   {
    "nr": "50.6",
    "navn": "Fôr og vann"
   },
   {
    "nr": "50.7",
    "navn": "Alarmsystem og nødløsninger"
   },
   {
    "nr": "50.8",
    "navn": "Levering av fjørfe til slakt"
   }
  ],
  "sporsmal": [
   {
    "nr": "50.1.1",
    "tekst": "For å oppfylle kravet til dyreholdjournal må du fortløpende registrere nødvendige produksjonsdata i en produksjonskontroll eller i en egen journal. Oppfyller du kravet?",
    "dok": true,
    "krav": [
     "produksjonsdata i en produksjonskontroll eller i en egen journal. Oppfyller du kravet?"
    ]
   },
   {
    "nr": "50.1.2",
    "tekst": "Oppbevarer du dyreholdjounralen og all underliggende dokumentasjon i minimum 5 år etter utslakting eller levering av innsett?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "50.2.1",
    "tekst": "Er det god nok ventilasjon slik at det er et tilfredsstillende klima i dyrerommet?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "50.2.2",
    "tekst": "Er det mulig å justere lysstyrken i dyrerommet?",
    "dok": false,
    "krav": [
     "Ha et lysanlegg som kan justeres etter behov",
     "Lysanlegget må kunne dimmes ned til 1-2 lux uten at lyset flimrer. Flimring kan måles ved hjelp av lysmåler eller ved å filme med mobilkamera i sakte film. Eventuell flimring vil da synes på filmen.",
     "Sørge for jevn lysfordeling i hele dyrerommet."
    ]
   },
   {
    "nr": "50.2.3",
    "tekst": "Blir strø og annet som skal inn i huset, lagret, transportert og lagt inn på en slik måte at smitte ikke dras med?",
    "dok": false,
    "krav": [
     "Sørge for at strø, sysselsettingsmateriell og annet utstyr som skal inn i fjørfehuset lagres og håndteres slik at risikoen for å dra med smittestoffer blir minst mulig.",
     "Beskytte strø og annet materiale mot forurensning fra ville fugler, skadedyr, husdyr og vilt.",
     "Sørge for at strømaterialet er friskt, tørt og fritt for mugg.",
     "Transportere og legge inn strø og annet materiale på en måte som ivaretar smittevernet.",
     "Ved bruk av kutterflis, sørge for at denne kommer fra ubehandlet trevirke."
    ]
   },
   {
    "nr": "50.2.4",
    "tekst": "Har du rutiner for å holde strøet tørt og løst?",
    "dok": false,
    "krav": [
     "Ha rutiner som sikrer at strøet holdes tørt og løst gjennom hele innsettet.",
     "Kontrollere strøkvaliteten regelmessig og sette inn tiltak dersom strøet blir fuktig eller hardt.",
     "Tilføre nytt strø ved behov.",
     "Sørge for gode forhold som bidrar til tørr strøflate, blant annet riktig ventilasjon, vannsystem og dyretetthet.",
     "Følge spesielt med på områder rundt drikkenipler, fôringsutstyr og andre utsatte områder."
    ]
   },
   {
    "nr": "50.3.1",
    "tekst": "Blir hus, innredning og utstyr rengjort, vasket og desinfisert mellom hvert innsett?",
    "dok": false,
    "krav": [
     "Gjennomføre grov tørrengjøring, bløtlegging, vask med vann og rengjøringsmiddel og etterskylling.",
     "Deretter desinfisere. Følge bruksanvisningen nøye for desinfeksjonsmidlene mht HMS, bruksløsning, virketid og temperatur.",
     "Tørke opp til slutt etter desinfeksjon.",
     "Tomtiden (det vil si tiden fra du har desinfisert og fram til neste innsett) bør være minst 5 døgn, helst flere innen eggproduksjonen. Kan ha like god effekt som desinfeksjon, forutsatt luftfuktighet (rH) under 60 %."
    ]
   },
   {
    "nr": "50.3.2",
    "tekst": "Har du en skriftlig smittevernplan for dyreholdet ditt som er oppdatert siste året?",
    "dok": true,
    "krav": [
     "Ha en oppdatert smittevernplan for dyreholdet ditt"
    ]
   },
   {
    "nr": "50.3.3",
    "tekst": "Er alle som jobber i dyreholdet kjent med og følger gårdens smittevernplan?",
    "dok": false,
    "krav": [
     "Sørge for at alle som arbeider i dyreholdet, kjenner og følger smittevernplanen."
    ]
   },
   {
    "nr": "50.3.4",
    "tekst": "Dyreholdet skal ha en funksjonell smittesluse med fysisk skille mellom ren og uren sone. Skillet skal være tett til gulv og innrettet slik at alle som skal inn i dyreholdet skifter klær og sko og vasker/desinfiserer hender ved passering. Oppfyller du kravet?",
    "dok": false,
    "krav": [
     "Ha en smittesluse med et tydelig fysisk skille mellom ren og uren sone. Smitteskillet skal være tett mot gulvet slik at smuss og smittestoff ikke lett kan føres mellom sonene. Skillet skal være opphøyd for å redusere risikoen for at skitt og væske flyter over smitteskillet.",
     "Sørge for at smitteslusa er utformet slik at alle må passere smitteskillet når de går inn og ut av dyreholdet.",
     "Ha tilgjengelig besetningens fottøy og klær, eller rent overtrekkstøy, på ren side av smitteskillet.",
     "Ha mulighet for håndvask og nødvendig håndhygiene i forbindelse med passering av smitteskillet.",
     "Sørge for at ansatte, avløsere, veterinærer og andre besøkende følger rutinene ved hver passering.",
     "Rengjøre og eventuelt desinfisere utstyr som tas inn i dyreholdet, særlig utstyr som brukes i flere besetninger."
    ]
   },
   {
    "nr": "50.3.5",
    "tekst": "Fører du besøkslogg over alle som har vært på besøk i dyrerommet?",
    "dok": true,
    "krav": [
     "Fortløpende registrere alle besøkende som har vært inne i dyrerommet.",
     "Oppbevare besøksloggen slik at den er tilgjengelig ved behov."
    ]
   },
   {
    "nr": "50.3.6",
    "tekst": "Følger du «alt inn/alt ut-prinsippet»?",
    "dok": false,
    "krav": [
     "Tømme huset helt for dyr. Tørrengjøre, vaske med vann og rengjøringsmiddel, desinfisere og la huset tørke opp."
    ]
   },
   {
    "nr": "50.3.7",
    "tekst": "Når du bruker desinfeksjonsmiddel, noterer du hvilket middel du har brukt, og datoen for når du har brukt det?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "50.3.8",
    "tekst": "Dersom du har flere dyrehold på gården, eller fjørfe i flere aldersgrupper må du ha rutiner som hindrer overføring av smitte mellom dyregrupper. Oppfyller du kravet?",
    "dok": false,
    "krav": [
     "Ha rutiner som hindrer overføring av smitte mellom ulike dyregrupper på gården.",
     "Sørge for at arbeid med mest smitteutsatte dyregrupper gjennomføres før arbeid med eldre dyr eller andre dyrehold.",
     "Skifte eller rengjøre fottøy, utstyr og hender før du beveger deg mellom ulike hus, avdelinger eller dyregrupper."
    ]
   },
   {
    "nr": "50.3.9",
    "tekst": "Sikrer du at andre dyr, som hunder og katter, ikke har tilgang til forrom og sluse i tilknytning til dyrerom der du holder fjørfe?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "50.3.10",
    "tekst": "Overholder du kravet om at det ikke skal være pryd- og hobbyfjørfe på gårdsbruk med fjørfeproduksjon?",
    "dok": false,
    "krav": [
     "Ikke ha hobbyfjørfehold på egen gård.",
     "Unngå direkte kontakt med hobby- og prydfjørfe."
    ]
   },
   {
    "nr": "50.3.11",
    "tekst": "Sikrer du at personer som har besøkt dyrehold med fjørfe i utlandet, ikke får adgang til husdyrrom før det har gått 48 timer etter ankomst til Norge?",
    "dok": false,
    "krav": [
     "Sørge for at personer som har besøkt dyrehold med fjørfe i utlandet, skal ikke ha adgang til husdyrromet før det har gått 48 timer."
    ]
   },
   {
    "nr": "50.3.12",
    "tekst": "Sørger du for at Mattilsynet blir varslet ved mistanke om smittsom dyresykdom?",
    "dok": false,
    "krav": [
     "Ha rutiner for å varsle Mattilsynet, varemottaker og/eller veterinær dersom du har mistanke om mulig utbrudd av smittsom dyresykdom i dyreholdet ditt (eksempelvis fugleinfluensa, Newcastle sykdom, infeksiøs bronkitt, m.fl.).",
     "I samråd med Mattilsynet og aktuelle varemottakere umiddelbart iverksette nødvendige tiltak for å forebygge, redusere eller eliminere eventuelle skadevirkninger."
    ]
   },
   {
    "nr": "50.3.13",
    "tekst": "Er fjørfehuset sikret mot at rovdyr, smågnagere og fugler kan trenge seg inn?",
    "dok": false,
    "krav": [
     "Sikre fjørfehuset fysisk slik at rovdyr, smågnagere og fugler ikke kan trenge seg inn. Mus og rotter kan komme inn åpninger på henholdsvis 7 mm og 20 mm.",
     "Sørge for god orden og ryddighet i og rundt fjørfehuset for å redusere risikoen for smågnagere.",
     "Ha et aktivt og dokumentert opplegg for overvåking og bekjempelse av smågnagere.",
     "Kontrollere bygninger, ventiler, porter, dører og andre åpninger regelmessig, og utbedre forhold som kan gi skadedyr tilgang til huset."
    ]
   },
   {
    "nr": "50.3.14",
    "tekst": "Oppbevarer du fôr utilgjengelig for smågnagere og fugler?",
    "dok": false,
    "krav": [
     "Sørge for fysisk skjerming av fôr under transport og lagring. Det gjelder både levert fôr, egenprodusert fôr og miljøberikelser.",
     "Tildele for innendørs. Unngå fôrsøl."
    ]
   },
   {
    "nr": "50.3.15",
    "tekst": "Er det minst 2 meter vegetasjonsfri sone eller kortklipt plen rundt fjørfehuset?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "50.3.16",
    "tekst": "Er det ryddig rundt fjørfehus og i eggpakkerom, egglager og andre birom?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "50.4.1",
    "tekst": "Har du DVP-avtale (dyrevelferdsprogramavtale) med veterinær?",
    "dok": true,
    "krav": [
     "Du som driver en kommersiell fjørfebesetning ha en DVP-avtale med veterinær i Velferdsportal fjørfe om DVP besøk i din besetning.",
     "Sørge for at DVP-besøk blir gjennomført i samsvar med kravene som gjelder for din produksjon."
    ]
   },
   {
    "nr": "50.4.2",
    "tekst": "Har dyra tilsyn av kompetent person minimum 2 ganger daglig?",
    "dok": false,
    "krav": [
     "Sørge for at dyrene har tilsyn minst to ganger daglig.",
     "Tilsynet skal utføres av kompetente personer som skal kunne stelle dyra på en måte som sikrer god dyrevelferd, kjenne igjen tegn på dårlig dyrevelferd og iverksette tiltak der dette er nødvendig."
    ]
   },
   {
    "nr": "50.4.3",
    "tekst": "Er det rutiner på gården for å oppdage og avlive uhelbredelig syke eller sterkt svekkede dyr?",
    "dok": false,
    "krav": [
     "Ha rutiner for å oppdage syke, skadde eller sterkt svekkede dyr så tidlig som mulig.",
     "Avlive dyr uten unødig opphold dersom de er uhelbredelig syke eller skadde og videre liv vil medføre unødig lidelse.",
     "Sørge for at bedøving, avliving og etterkontroll bare utføres av personer med nødvendig teoretisk og praktisk opplæring. Elæringskurs skal dokumenteres.",
     "Ha tilgang til egnet utstyr for bedøving og avliving, og sikre at dette fungerer som forutsatt.",
     "Fjerne døde dyr fra dyrerommet daglig."
    ]
   },
   {
    "nr": "50.4.4",
    "tekst": "Blir døde dyr fjernet snarest mulig og minimum daglig fra dyrerommet?",
    "dok": false,
    "krav": [
     "Sørge for at døde dyr fjernes daglig fra dyrerommet.",
     "Sjekke reder daglig for døde dyr."
    ]
   },
   {
    "nr": "50.4.5",
    "tekst": "Blir døde dyr fryst ned og oppbevart midlertidig på et egnet sted, isolert fra dyrerom og egglager?",
    "dok": false,
    "krav": [
     "Oppbevare døde dyr nedfryst på et egnet sted fram til levering eller henting.",
     "Sørge for at oppbevaringsstedet er adskilt fra dyrerom, egglager, fôr og annet materiale som kan bli forurenset.",
     "Sørge for at døde dyr håndteres og lagres på en måte som reduserer risikoen for smittespredning og skadedyr."
    ]
   },
   {
    "nr": "50.4.6",
    "tekst": "Blir kadaver levert til godkjent mottak eller brent i godkjent forbrenningsanlegg?",
    "dok": false,
    "krav": [
     "Sørge for at døde dyr leveres til godkjent mottak eller håndteres i forbrenningsanlegg godkjent av",
     "Mattilsynet. Ved levering skal dyrene være nedfrosset.",
     "Det er etablert ordninger for innsamling av fjørfekadaver, og døde dyr skal leveres i samsvar med gjeldende krav. Kontakt eggpakkeri/slakteri for oversikt over hvem du kan kontakte i ditt område."
    ]
   },
   {
    "nr": "50.4.7",
    "tekst": "Melder du fra til eggpakkeriet/slakteriet om eventuelle tilbakeholdelsesfrister dersom dyra er medisinert?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "50.4.8",
    "tekst": "Tar du salmonellaprøver i samsvar med forskriften?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "50.5.1",
    "tekst": "Kontrollerer du at antall dyr pr. m2 (høner, livkylling) eller dyras levendevekt i kg pr. m2 (slaktekylling, kalkun) holder seg innenfor forskriftskravet?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "50.5.2",
    "tekst": "Fører du journal når du kjøper, selger, mottar eller gir bort fjørfe eller rugeegg?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "50.6.1",
    "tekst": "Har du rutiner for daglig kontroll av at fôr og vanntilførsel fungerer, og for å kontrollere forbruk?",
    "dok": false,
    "krav": [
     "Sørge for daglig kontroll av totalt vannforbruk og forforbruk i huset.",
     "Sørge for daglig kontroll av vann i alle nippelrekker/drikkekar og av fôr i forrenner/skåler."
    ]
   },
   {
    "nr": "50.6.2",
    "tekst": "Tar du vare på fôrprøver og varedeklarasjon/fôrseddel for innkjøpt kraftfôr?",
    "dok": false,
    "krav": [
     "Oppbevare en forprøve på ca. 0,5 kg fra hver forleveranse.",
     "Sørge for at prøven er tydelig merket",
     "Sørge for at prøven oppbevares tørt og kjølig. Forprøven kan lagres på kjøla/eggkjøla, men da i en lukket boks sikret for smågnagere."
    ]
   },
   {
    "nr": "50.6.3",
    "tekst": "Holder vannet drikkevannskvalitet?",
    "dok": true,
    "krav": [
     "Sørge for at alle dyr har tilgang på drikkevann av god kvalitet",
     "Vann kan bære med seg smittestoffer. Offentlig kontrollerte vannverk har rutiner for å overvåke dette."
    ]
   },
   {
    "nr": "50.7.1",
    "tekst": "Har dyrerommene for fjørfe alarm som varsler strømbrudd og for høy eller for lav temperatur?",
    "dok": false,
    "krav": [
     "Ha et alarmsystem som varsler ved strømbrudd og ved for høy eller for lav temperatur i dyrerommet.",
     "Sørge for at alarmen blir mottatt av personer som kan iverksette nødvendige tiltak.",
     "Ha rutiner for hvilke tiltak som skal iverksettes dersom alarmen utløses.",
     "Sørge for at tekniske innretninger som har betydning for dyrevelferden blir kontrollert daglig."
    ]
   },
   {
    "nr": "50.7.2",
    "tekst": "Kontrollerer du alarmen etter behov og minst en gang i uka?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "50.7.3",
    "tekst": "Er det rutiner på gården som sikrer at dyra får dekket behovene hvis det er strømbrudd eller en stopp i den ordinære vanntilførselen?",
    "dok": false,
    "krav": [
     "Ha godt innarbeidede rutiner for hvordan dyrenes behov skal ivaretas ved strømbrudd eller bortfall av ordinær vanntilførsel.",
     "Ha tilgang til nødvendig utstyr eller alternative løsninger som sikrer vannforsyning og tilfredsstillende driftsforhold fram til feilen er rettet.",
     "Sørge for at personer som har ansvar for dyrene kjenner rutinene og vet hvilke tiltak som skal settes i verk.",
     "Regelmessig at nødutstyr og beredskapsløsninger fungerer som forutsatt."
    ]
   },
   {
    "nr": "50.7.4",
    "tekst": "Har du en plan for funksjonstesting av nødstrømsaggregat?",
    "dok": false,
    "krav": [
     "Ha en plan for regelmessig funksjonstesting av nødstrømsaggregatet hvor du kontrollerer at aggregatet starter som forutsatt og kan levere strøm til kritiske funksjoner i fjørfehuset."
    ]
   },
   {
    "nr": "50.8.1",
    "tekst": "Har dyra tilgang til vann helt fram til plukkingen starter?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "50.8.2",
    "tekst": "Er det mulig å blende porten og andre større lysåpninger slik at det er mørkt nok i dyrerommet når dyra plukkes?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "50.8.3",
    "tekst": "Sikrer du at dyra plukkes og bæres skånsomt, og har du eller en annen med ansvar for dyra oppsyn under plukkinga?",
    "dok": false,
    "krav": []
   }
  ]
 },
 {
  "nr": 51,
  "navn": "Eggproduksjon",
  "versjon": "2026.7",
  "url": "https://www.ksl.no/ksl-standarden/eggproduksjon/",
  "seksjoner": [
   {
    "nr": "51.1",
    "navn": "Dyreholdet"
   },
   {
    "nr": "51.2",
    "navn": "Eggproduksjon"
   },
   {
    "nr": "51.3",
    "navn": "Verpehøner som avlives på gården"
   }
  ],
  "sporsmal": [
   {
    "nr": "51.1.1",
    "tekst": "Sørger du for at du får deklarasjoner for unghønene som du mottar, og lagrer du dokumentasjonen i minst 2 år?",
    "dok": true,
    "krav": [
     "Lagre deklarasjon for unghønene du mottar.",
     "Oppbevare opplysningene i minst 2 år og kunne legge dem fram når",
     "Mattilsynet ber om det."
    ]
   },
   {
    "nr": "51.1.2",
    "tekst": "Benytter du miljøberikelser gjennom hele innsettet for å forebygge adferdsproblemer hos frittgående høner?",
    "dok": false,
    "krav": [
     "Sørge for at det til enhver tid er tilgjengelige miljøberikelser i huset som gir hønene mulighet til å utøve naturlig hakke- og søkeatferd."
    ]
   },
   {
    "nr": "51.1.3",
    "tekst": "Har du rutine for å ta middprøve ved hvert innsett, og for å sende disse prøvene til Animalia?",
    "dok": false,
    "krav": [
     "Ta ut og sende inn middprøve til Animalia ved hvert innsett. Prøven bør tas etter at hønene har nådd 40 ukers alder.",
     "Oppbevare dokumentasjon på innsendte prøver og eventuelle prøvesvar.",
     "Følge opp eventuelle funn av blodmidd med nødvendige tiltak."
    ]
   },
   {
    "nr": "51.1.4",
    "tekst": "Dersom du har positiv middstatus: Har du inverksatt tiltak for å redusere problemer med blodmidd?",
    "dok": false,
    "krav": [
     "Umiddelbart gi eggpakkeriet ditt beskjed ved påvisning av blodmidd",
     "Kontakte veterinær eller fagansvarlig hos varemottaker for behandlingsplan for nåværende innsett",
     "Legge en plan for sanering i besetningen.",
     "Informere eventuelt ny oppaler i påfølgende innsett om middstatus."
    ]
   },
   {
    "nr": "51.1.5",
    "tekst": "Innredde bur: Etterfyller du strøbadene i innredede bur?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "51.1.6",
    "tekst": "Innredde bur: Dokumenterer du tidspunktet for etterfylling av strø og tidspunktet for åpning og lukking av strøbad i innredede bur?",
    "dok": true,
    "krav": [
     "Dokumentere tidspunkt for etterfylling av strø",
     "Dokumentere tidspunkt for åpning og lukking av strøbad i innredede bur",
     "Dokumentasjonen skal legges frem for revisor ved KSL-revisjon"
    ]
   },
   {
    "nr": "51.2.1",
    "tekst": "Blir eggene samlet daglig, sortert og pakket i samsvar med kravene fra eggpakkeriet og straks overført til kjølerom som holder 8–12 °C?",
    "dok": false,
    "krav": [
     "Samle inn egg minst en gang per dag",
     "Raskt overøfre eggene til kjølerom som holder 8–12 °C og 75–80 % luftfuktighet. Dette er viktig for å opprettholde god kvalitet på eggene.",
     "Egg som er lagt feil, skal plukkes regelmessig.",
     "Bare egg som er samlet inn daglig, kan leveres til eggpakkeri."
    ]
   },
   {
    "nr": "51.2.2",
    "tekst": "Oppbevares det kun egg og eggemballasje på egglageret?",
    "dok": false,
    "krav": [
     "Sørge for at det kun oppbevares egg og eggemballasje på egglageret."
    ]
   },
   {
    "nr": "51.2.3",
    "tekst": "Oppbevarer du tom eggemballasje tørt, luktfritt og best mulig sikret mot skadedyr og insekter?",
    "dok": false,
    "krav": [
     "Oppbevare tom eggemballasje tørt og rent.",
     "Sørge for at emballasjen er beskyttet mot støv, fuktighet og lukt.",
     "Oppbevare emballasjen på en måte som hindrer tilgang for skadedyr og insekter.",
     "Kontrollere emballasjen før bruk og kassere emballasje som er forurenset eller skadet."
    ]
   },
   {
    "nr": "51.2.4",
    "tekst": "Dersom du vasker egg, følger alle som utfører oppgaven bransjens retningslinjer?",
    "dok": false,
    "krav": [
     "På et synlig sted i eggpakkerommet henge opp plakaten \"vasking av egg\" (se lenker).",
     "Sørge for rutiner som samsvarer med denne.",
     "Sørge for at alle som utfører oppgaen har fått opplæring."
    ]
   },
   {
    "nr": "51.2.5",
    "tekst": "Har egglageret rampe med egen inngang for eggtransportøren?",
    "dok": false,
    "krav": [
     "Ha egen inngang eller løsning for utlevering av egg som reduserer risikoen for smitte mellom eggtransport og dyrehold.",
     "Sørge for at rampe, lasteområde og tilstøtende arealer holdes rene og ryddige.",
     "Sørge for at rampen er utformet slik at den kan rengjøres og ved behov desinfiseres.",
     "Ha rutiner som sikrer at eggtransportør følger gårdens smittevernrutiner ved henting av egg."
    ]
   },
   {
    "nr": "51.2.6",
    "tekst": "Hvis du produserer og selger rugeegg - er virksomheten sertifisert av Mattilsynet?",
    "dok": true,
    "krav": [
     "Mattilsynet dersom du produserer og selger rugeegg (avlsbesetning)."
    ]
   },
   {
    "nr": "51.3.1",
    "tekst": "Varsler du Mattilsynet på forhånd om verpehønene skal gassavlives i huset?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "51.3.2",
    "tekst": "Dersom dyrene skal avlives på gården, har de normal tilgang på fôr og vann frem til avlivingstidspunkt? Dersom dyrene skal sendes til slakt, følges skal slakteriets anbefaling for vann og fôr?",
    "dok": false,
    "krav": [
     "Sørge for at dyrene til enhver tid har tilgang til vann og fôres i tråd med normal driftsrutine helt frem til de plukkes eller avlives.",
     "Dersom dyrene skal sendes til slakt skal slakteriets anbefaling for vann og fôr overholdes."
    ]
   },
   {
    "nr": "51.3.3",
    "tekst": "Sikrer du at dyra plukkes og bæres i tråd med regelverket, og har du eller en annen med ansvar for dyra oppsyn under plukkinga?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "51.3.4",
    "tekst": "Avlives dyra av en kyndig person med dokumentert kompetanse?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "51.3.5",
    "tekst": "Blir kadavrene levert til et godkjent mottak?",
    "dok": false,
    "krav": [
     "Kadavrene skal leveres til godkjent mottak.",
     "Du kunne legge frem dokumentasjon på levering under KSL revisjon"
    ]
   }
  ]
 },
 {
  "nr": 52,
  "navn": "Oppal fjørfe",
  "versjon": "2026.7",
  "url": "https://www.ksl.no/ksl-standarden/oppal-fjorfe/",
  "seksjoner": [
   {
    "nr": "52.1",
    "navn": "Dyreholdet"
   },
   {
    "nr": "52.2",
    "navn": "Levering av unghøner"
   }
  ],
  "sporsmal": [
   {
    "nr": "52.1.1",
    "tekst": "Har virksomheten gyldig sertifisering fra Mattilsynet?",
    "dok": true,
    "krav": [
     "Sørge for at virksomheten er sertifisert av Mattilsynet dersom du oppdretter unghøner eller produserer rugeegg som skal flyttes til andre anlegg i Norge.",
     "Kun ta imot dyr eller rugeegg fra sertifiserte eller godkjente anlegg.",
     "Kunne legge fram dokumentasjon på sertifiseringen ved revisjon."
    ]
   },
   {
    "nr": "52.1.2",
    "tekst": "Registrerer du fortløpende dyras vektutvikling?",
    "dok": true,
    "krav": [
     "Daglig måle og registrere dyrenes vektutvikling.",
     "Sørge for at vekt og vektvariasjon (CV) ved ulike aldre fremkommer på deklarasjonsdokumentet."
    ]
   },
   {
    "nr": "52.1.3",
    "tekst": "For unghøner: Benytter du mijøberikelser underveis i innsettet for å legge til rette for naturlig atferd og forebygge adferdsproblemer?",
    "dok": false,
    "krav": [
     "Sørge for at det til enhver tid er tilgjengelige miljøberikelser i huset som gir hønene mulighet til å utøve naturlig hakke- og søkeatferd."
    ]
   },
   {
    "nr": "52.1.4",
    "tekst": "Har du rutiner for å ta middprøver under hvert innsett, og for å sende disse til Animalia?",
    "dok": false,
    "krav": [
     "Ta ut og sende inn middprøve til Animalia ved hvert innsett.",
     "Oppbevare dokumentasjon på innsendte prøver og eventuelle prøvesvar.",
     "Følge opp eventuelle funn av blodmidd med nødvendige tiltak."
    ]
   },
   {
    "nr": "52.1.5",
    "tekst": "Dersom du har positiv middstatus: Har du iverksatt tiltak for å redusere problemene med blodmidd?",
    "dok": false,
    "krav": [
     "Umiddelbart gi eggprodusentene dine beskjed ved påvisning av blodmidd",
     "Kontakte veterinær for behandlingsplan for nåværende innsett",
     "Legge en plan for sanering i besetningen."
    ]
   },
   {
    "nr": "52.1.6",
    "tekst": "Informerer du kundene dine så tidlig som mulig dersom du får påvist blodmidd?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "52.1.7",
    "tekst": "Har du rutine for å overføre produksjonsplan for flokken til eggprodusenten minimum 7 dager før leveringsdato?",
    "dok": false,
    "krav": [
     "Sørge for at alle unghøer du leverer følges av en produksjonsplan.",
     "Produksjonsplan skal som et minimum inneholde informasjon om:",
     "Foring",
     "Temperatur",
     "Lysstyring",
     "Eventuelle avvik/hendelser mens dyrene har vært hos deg som oppaler."
    ]
   },
   {
    "nr": "52.1.8",
    "tekst": "Sørger du for at alle unghøner du leverer følges av en fullstendig og oppdatert deklarasjon?",
    "dok": true,
    "krav": [
     "Senest på leveringsdato gi eggprodusenten en skriftlig deklarasjon om hønene.",
     "Deklarasjonen skal opplyse om følgende i oppalsperioden:",
     "daglengde",
     "lysstyrke",
     "dyretype",
     "antall dyr",
     "klekkedato",
     "dødelighet i oppalet"
    ]
   },
   {
    "nr": "52.1.9",
    "tekst": "Når du inngår salgskontrakt med eggprodusenten – framgår det av kontrakten om hønene har samme alder og hvor de skal ales opp?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "52.1.10",
    "tekst": "Melder du fra til eggprodusenten så tidlig som mulig dersom du ikke kan overholde salgskontrakten omtalt i sjekklistepunkt 52.1.9?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "52.2.1",
    "tekst": "Har dyra tilgang til vann helt fram til plukkingen starter?",
    "dok": false,
    "krav": [
     "Sørge for at dyrene til enhver tid har tilgang til vann helt frem til de plukkes."
    ]
   },
   {
    "nr": "52.2.2",
    "tekst": "Er det mulig å blende porten og andre større lysåpninger slik at det er mørkt nok i dyrerommet når dyra plukkes?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "52.2.3",
    "tekst": "Sikrer du at dyra plukkes og bæres i tråd med regelverk, og har du eller en annen med ansvar for dyra oppsyn under plukkinga?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "52.2.4",
    "tekst": "Får personellet som utfører plukkingen opplæring i riktig håndtering av dyr?",
    "dok": false,
    "krav": []
   }
  ]
 },
 {
  "nr": 53,
  "navn": "Slaktekyllingproduksjon",
  "versjon": "2026.3",
  "url": "https://www.ksl.no/ksl-standarden/slaktekylling/",
  "seksjoner": [
   {
    "nr": "53.1",
    "navn": "Dyreholdet"
   }
  ],
  "sporsmal": [
   {
    "nr": "53.1.1",
    "tekst": "Har du tatt kurs i dyrevelferd for slaktekyllingproduksjon?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "53.1.2",
    "tekst": "Har slaktekyllingene tilgang på egnet miljøberiking?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "53.1.3",
    "tekst": "Sikrer du en avstand på minimum 20 meter mellom fjørfehuset og områder der husdyr beiter eller husdyrgjødsel spres?",
    "dok": false,
    "krav": [
     "Sørge for at andre husdyr på beite ikke kommer nærmere fjørfehuset enn 20 meter.",
     "Sørge for at husdyrgjødsel ikke spres på arealer nærmere fjørfehuset enn 20 meter."
    ]
   },
   {
    "nr": "53.1.4",
    "tekst": "Lagres gjødsel minst 50 m fra nærmeste fjørfehus, og på en slik måte at det ikke spres smitte eller er fare for avrenning?",
    "dok": false,
    "krav": [
     "Oppbevare gjødsel slik at det ikke er risiko for smittespredning til fjørfehuset.",
     "Oppbevare gjødsel minst 50 meter fra nærmeste fjørfehus dersom den lagres utendørs."
    ]
   },
   {
    "nr": "53.1.5",
    "tekst": "Tar du Campylobacter-prøver av slaktekyllingflokkene i samsvar med handlingsplanen mot Campylobacter?",
    "dok": true,
    "krav": [
     "Ta Campylobacter-prøve av alle slaktekyllingflokker som slaktes ved 50 dagers alder eller yngre i perioden 1. mai til 31. oktober.",
     "Ta prøven så nær slaktedato som mulig, og senest 6 dager før slakting.",
     "Det skal ikke gå mer enn fem hele dager mellom prøvetaking og slakting.",
     "Dersom flokken slaktes i flere omganger, ta ny prøve før hver slakteomgang, med mindre slaktingen skjer to påfølgende dager.",
     "Sørge for at prøver tas, merkes og sendes inn i samsvar med gjeldende rutiner og ved bruk av prøvetakingsutstyr utsendt gjennom slakteriet."
    ]
   },
   {
    "nr": "53.1.6",
    "tekst": "Tilfredsstiller du kravet om at lysstyrken i dyrenes øyehøyde i perioden med lys er minst 20 lux på 80 % av dyrenes tilgjengelige areal?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "53.1.7",
    "tekst": "For deg som produserer slaktekylling med tetthet over 33 kg per m2: Har du oppdatert dokumentasjon som beskriver hus og utstyr i detalj?",
    "dok": true,
    "krav": []
   },
   {
    "nr": "53.1.8",
    "tekst": "For deg som produserer slaktekylling med tetthet over 33 kg per m2: Sikrer du at du overholder kravene som gjelder ammoniakk, karbondioksid, temperatur og luftfuktighet?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "53.1.9",
    "tekst": "Er dyra uten fôr minimum 6 og maksimum 12 timer før planlagt slaktestart?",
    "dok": false,
    "krav": []
   }
  ]
 },
 {
  "nr": 54,
  "navn": "Kalkun, ender og gjess",
  "versjon": "2026.7",
  "url": "https://www.ksl.no/ksl-standarden/kalkun-ender-og-gjess/",
  "seksjoner": [
   {
    "nr": "54.1",
    "navn": "Kalkunproduksjon"
   },
   {
    "nr": "54.2",
    "navn": "Andeproduksjon"
   }
  ],
  "sporsmal": [
   {
    "nr": "54.1.1",
    "tekst": "Sikrer du en avstand på minimum 20 meter mellom fjørfehuset og områder der husdyr beiter eller husdyrgjødsel spres?",
    "dok": false,
    "krav": [
     "Sørge for at andre husdyr på beite ikke kommer nærmere fjørfehuset enn 20 meter.",
     "Sørge for at husdyrgjødsel ikke spres på arealer nærmere fjørfehuset enn 20 meter."
    ]
   },
   {
    "nr": "54.1.2",
    "tekst": "Har kalkunene tilgang på egnet miljøberiking?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "54.2.1",
    "tekst": "Sikrer du en avstand på minimum 20 meter mellom fjørfehuset og områder der husdyr beiter eller husdyrgjødsel spres?",
    "dok": false,
    "krav": [
     "Sørge for at andre husdyr på beite ikke kommer nærmere fjørfehuset enn 20 meter.",
     "Sørge for at husdyrgjødsel ikke spres på arealer nærmere fjørfehuset enn 20 meter."
    ]
   },
   {
    "nr": "54.2.2",
    "tekst": "Registrerer du dyras vektutvikling?",
    "dok": true,
    "krav": [
     "Registrere dyrenes vektutvikling jevnlig gjennom oppdrettsperioden.",
     "Følge med på om vekst og utvikling er i samsvar med forventet utvikling for den aktuelle rasen eller produksjonsformen.",
     "Undersøke mulige årsaker og iverksette nødvendige tiltak dersom vektutviklingen avviker vesentlig fra det som er forventet."
    ]
   }
  ]
 },
 {
  "nr": 70,
  "navn": "Hest i næring",
  "versjon": "2026.9",
  "url": "https://www.ksl.no/ksl-standarden/hest-i-naering/",
  "seksjoner": [
   {
    "nr": "70.1",
    "navn": "Hestehold og stalldrift"
   },
   {
    "nr": "70.2",
    "navn": "Aktiviteter med hest"
   },
   {
    "nr": "70.3",
    "navn": "Generelle krav og HMS (for virksomheter uten gårdstilknytning)"
   },
   {
    "nr": "70.4",
    "navn": "Helsetilbud med hest"
   },
   {
    "nr": "70.5",
    "navn": "Turisme og turridning"
   },
   {
    "nr": "70.6",
    "navn": "Lærebedrift i hestefaget"
   },
   {
    "nr": "70.7",
    "navn": "Rideskole"
   },
   {
    "nr": "70.8",
    "navn": "Travstall"
   }
  ],
  "sporsmal": [
   {
    "nr": "70.1.1",
    "tekst": "Har du meldt fra til Mattilsynet eller søkt om tillatelse til å holde hester?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.1.2",
    "tekst": "Oppfyller hesteholderen kravet til kompetanse som er satt i forskrift om velferd for hest, og i Bransjestandard hest?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.1.3",
    "tekst": "Holder du god orden og har det ryddig på inne- og uteområder?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.1.4",
    "tekst": "Har du et oppslag på stedet, eller på nett, som gir en presentasjon av virksomheten?",
    "dok": false,
    "krav": [
     "og kunder. Du må ha en informasjonsplakat plassert på et godt synlig sted, med tekst som er skrevet spesielt for brukerne."
    ]
   },
   {
    "nr": "70.1.5",
    "tekst": "Har stallen en god plan for parkering av kjøretøy og sykler?",
    "dok": false,
    "krav": [
     "besøkende som så langt det er mulig er adskilt fra områder med hesteaktivitet."
    ]
   },
   {
    "nr": "70.1.6",
    "tekst": "Sørger du for at det blir godt nok brøytet og strødd?",
    "dok": false,
    "krav": [
     "brøyting og strøing er viktig for sikkerheten og trivselen til besøkende, ansatte og hester."
    ]
   },
   {
    "nr": "70.1.7",
    "tekst": "Har stallen egne rideveier og/eller kjøreveier til og fra treningsområder?",
    "dok": false,
    "krav": [
     "egne rideveier og/eller kjøreveier til og fra treningsområder, slik at hesteaktiviteter holdes adskilt fra annen trafikk. Delt vei skal skiltes."
    ]
   },
   {
    "nr": "70.1.8",
    "tekst": "Er det godt underlag i luftegårder og på steder hvor hestene trenes og mosjoneres?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.1.9",
    "tekst": "Er hestenes velferd ivaretatt hvis du har driftsformer med utegang og leskur?",
    "dok": false,
    "krav": [
     "vennes gradvis til utegang, og kravene til stall (kapittel II og III i forskriften) gjelder så langt de passer. Kravene gjelder ikke hester på beite i vanlig beiteperiode."
    ]
   },
   {
    "nr": "70.1.10",
    "tekst": "Har du en plan for vedlikehold av inne- og uteområder?",
    "dok": false,
    "krav": [
     "Langsiktige planer for drift og vedlikehold gir lengre levetid og mer forutsigbare kostnader. Planen må legge vekt på sikkerhet og dyrevelferd."
    ]
   },
   {
    "nr": "70.1.11",
    "tekst": "Lagres gjødsel slik at det ikke fører til forurensning?",
    "dok": false,
    "krav": [
     "Sørge for at utgjødsling og lagring av gjødsel skjer på en hygienisk og forsvarlig måte.",
     "Sørge for at gjødsel som lagres på bakken er skjermet mot overflatevann.",
     "Sørge for at gjødsel ikke lagres i flomutsatte områder eller slik at det kan renne av til bekk, drenering eller vassdrag.",
     "Fjerne gjødsel som samler seg i luftegårder og på fôringsplasser minst én gang i vekstsesongen og én gang om høsten.",
     "Sørge for at lagringsstedet er egnet slik at gjødsla kan fjernes uten risiko for forurensning."
    ]
   },
   {
    "nr": "70.1.12",
    "tekst": "Er stallen eller anlegget utformet og innredet slik at hestene ikke kommer i fare for skade?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.1.13",
    "tekst": "Er det godt renhold i stallen?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.1.14",
    "tekst": "Er det et godt klima i stallen?",
    "dok": false,
    "krav": [
     "tilpasset hestenes behov. Jf. Forskrift om velferd for hest § 9."
    ]
   },
   {
    "nr": "70.1.15",
    "tekst": "Har virksomheten rutiner for regelmessig vurdering av hestenes hold?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.1.16",
    "tekst": "Er fôringen tilpasset behovet til hver enkelt hest?",
    "dok": false,
    "krav": [
     "Fôringen skal ta hensyn til den enkelte hestens alder, rase, arbeidsmengde, hold og helsestatus."
    ]
   },
   {
    "nr": "70.1.17",
    "tekst": "Er fôret oppbevart på en hygienisk og sikker måte?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.1.18",
    "tekst": "Har hestene fri tilgang til friskt vann av god kvalitet?",
    "dok": false,
    "krav": [
     "Sikre at hestene til enhver tid har tilgang til friskt vann.",
     "Bruker du drikkekar, må det fylles opp minst like fort som hesten drikker (ca. 5–8 liter i minuttet). -",
     "Drikkekar og vannautomater skal rengjøres regelmessig.",
     "Vanntrykk kan variere – sjekk flere steder i stallen."
    ]
   },
   {
    "nr": "70.1.19",
    "tekst": "Har virksomheten oversikt over arbeidsmengden til den enkelte hest?",
    "dok": false,
    "krav": [
     "enkelte hest, slik at ingen hest overbelastes."
    ]
   },
   {
    "nr": "70.1.20",
    "tekst": "Har virksomheten rutiner for egenkontroll av hestens helse og form før trening eller aktivitet?",
    "dok": false,
    "krav": [
     "og form før trening eller aktivitet."
    ]
   },
   {
    "nr": "70.1.21",
    "tekst": "Har du rutiner for smitteforebyggende tiltak knyttet til hesteholdet?",
    "dok": false,
    "krav": [
     "hestesykdommer sprer seg."
    ]
   },
   {
    "nr": "70.1.22",
    "tekst": "Har virksomheten en plan for hvordan hestene sikres nødvendig veterinærhjelp?",
    "dok": false,
    "krav": [
     "nødvendig veterinærhjelp, både ved akutte situasjoner og for løpende helseoppfølging."
    ]
   },
   {
    "nr": "70.1.23",
    "tekst": "Sørger du for at Mattilsynet blir varslet ved mistanke om smittsom hestesykdom?",
    "dok": false,
    "krav": [
     "og veterinær dersom du oppdager eller har mistanke om utbrudd av smittsom dyresykdom."
    ]
   },
   {
    "nr": "70.1.24",
    "tekst": "Har alle hestene i stallen hestepass?",
    "dok": false,
    "krav": [
     "Hesten skal ha hestepass senest når den fyller 12 måneder, eller når den permanent forlater stallen den er født på dersom dette skjer tidligere. Passet utstedes av godkjent stambokførende instans eller delegert organ. Jf. landdyrsporbarhetsforskriften."
    ]
   },
   {
    "nr": "70.1.25",
    "tekst": "Har virksomheten et oppdatert vaksinasjonsprogram for hestene?",
    "dok": false,
    "krav": [
     "hesteinfluensa etter et oppdatert vaksinasjonsprogram utarbeidet i samråd med veterinær. Vaksinasjon mot hesteinfluensa er ikke lovpålagt, men Bransjestandard Hest setter dette som krav."
    ]
   },
   {
    "nr": "70.1.26",
    "tekst": "Har virksomheten rutiner for oppfølging av hestenes hovpleie?",
    "dok": false,
    "krav": [
     "hestenes hovpleie, normalt hver 6. - 8. uke."
    ]
   },
   {
    "nr": "70.1.27",
    "tekst": "Har stallen førstehjelpsutstyr for hest lett tilgjengelig?",
    "dok": false,
    "krav": [
     "Førstehjelpsutstyr for hest og førstehjelpsutstyr for mennesker skal oppbevares adskilt, i hvert sitt skap eller på hver sin tydelig merkede plass."
    ]
   },
   {
    "nr": "70.1.28",
    "tekst": "Har virksomheten mulighet for å isolere syke hester?",
    "dok": false,
    "krav": [
     "for hest med smittsom sykdom. Isolatboksen skal være atskilt fra resten av stallen med egen inngang og separat ventilasjon. Isolatet skal ha eget utstyr (bøtter, grimer o.l.) som ikke deles med andre hester."
    ]
   },
   {
    "nr": "70.1.29",
    "tekst": "Er stallens rutiner og sikkerhetsregler lett tilgjengelige for kunder, deltakere og pårørende?",
    "dok": false,
    "krav": [
     "tilgjengelige for alle som ferdes i anlegget, for eksempel som oppslag i stallen, på nettside, i app eller som utdelt informasjon. Reglene skal være oppdaterte."
    ]
   },
   {
    "nr": "70.1.30",
    "tekst": "Har virksomheten rutiner for kontroll og vedlikehold av utstyr?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.1.31",
    "tekst": "Har virksomheten rutiner for tilpasning av sal/sele og annet utstyr til den enkelte hest?",
    "dok": false,
    "krav": [
     "til den enkelte hest."
    ]
   },
   {
    "nr": "70.1.32",
    "tekst": "Har hestene daglig utetid og mulighet for sosial kontakt med andre hester?",
    "dok": false,
    "krav": [
     "og er vant med hverandre, bør få mulighet til å gå sammen i flokk."
    ]
   },
   {
    "nr": "70.1.33",
    "tekst": "Går hester under to år i gruppe med andre hester?",
    "dok": false,
    "krav": [
     "annen hest når den er ute, slik at de har full fysisk kontakt. Unghest skal ikke gå alene i egen paddock eller luftegård. Gruppehold hele døgnet gir best sosial utvikling, men egen boks inne aksepteres når unghesten går ute i gruppe daglig. Fra boksen skal den kunne se og ha kontakt med andre hester."
    ]
   },
   {
    "nr": "70.1.34",
    "tekst": "Har virksomheten rutiner for avvenning av føll?",
    "dok": false,
    "krav": [
     "er seks måneder gammelt. Tidligere avvenning kan bare skje når hensynet til hoppas eller føllets helse gjør det nødvendig. Begrunnelsen skal kunne dokumenteres ved revisjon."
    ]
   },
   {
    "nr": "70.1.35",
    "tekst": "Er transportmidlene virksomheten eier eller bruker, godkjent for dyretransport?",
    "dok": false,
    "krav": [
     "være godkjent av Statens vegvesen og fremstilles for kontroll hvert tredje år."
    ]
   },
   {
    "nr": "70.1.36",
    "tekst": "Har sjåfører som transporterer hest i næring for virksomheten, kompetansebevis for transport av hest?",
    "dok": false,
    "krav": [
     "transport av hest ha kompetansebevis utstedt av Mattilsynet. Virksomheten skal i tillegg være godkjent som dyretransportør av Mattilsynet."
    ]
   },
   {
    "nr": "70.2.1",
    "tekst": "Har den som har ansvar for aktiviteten dere tilbyr, nødvendig kompetanse?",
    "dok": false,
    "krav": [
     "dokumentere at alle som leder eller gjennomfører aktiviteter har den kompetansen som kreves for den aktuelle aktivitetstypen. Spesifikke kompetansekrav for din aktivitet finner du under det aktuelle temakapittelet (rideskole, turridning, oppdragskjøring, trening, oppstalling, hest i helsesammenheng m.fl.)."
    ]
   },
   {
    "nr": "70.2.2",
    "tekst": "Sørger virksomheten for at alle ansatte har nødvendig kompetanse for sin rolle?",
    "dok": false,
    "krav": [
     "ansatte og medhjelpere har den kompetansen som kreves for de oppgavene de utfører."
    ]
   },
   {
    "nr": "70.2.3",
    "tekst": "Har den som kjører hest i virksomhetens tilbud, kuskesertifikat?",
    "dok": false,
    "krav": [
     "ha kuskesertifikat fra Norsk Hestesenter."
    ]
   },
   {
    "nr": "70.2.4",
    "tekst": "Brukes sikkerhetsutstyr i samsvar med bransjens anbefalinger?",
    "dok": false,
    "krav": [
     "tilgjengelig og alltid brukes under aktivitet med hest. Godkjent hjelm er obligatorisk for alle som deltar i ridning, travkjøring og kjøreopplæring. Ved ridning skal det brukes ridestøvler eller egnede sko med hæl — aldri joggesko eller lignende. Sikkerhetsstigbøyler og utløser for stigbøylerem må kontrolleres før aktivitet."
    ]
   },
   {
    "nr": "70.2.5",
    "tekst": "Egner hestene seg til de aktivitetene de deltar i, og trives de i hverdagen sin?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.2.6",
    "tekst": "Er en kompetent hesteansvarlig alltid til stede når kunder eller deltakere er i kontakt med virksomhetens hester?",
    "dok": false,
    "krav": [
     "stede med tilsyn når kunder eller deltakere er i kontakt med virksomhetens hester."
    ]
   },
   {
    "nr": "70.2.7",
    "tekst": "Har virksomheten fastsatt et maksimalt antall deltakere per instruktør eller ansvarlig?",
    "dok": false,
    "krav": [
     "antall deltakere per ansvarlig person."
    ]
   },
   {
    "nr": "70.2.8",
    "tekst": "Får deltakerne sikkerhetsgjennomgang og instruksjoner tilpasset aktiviteten før start?",
    "dok": false,
    "krav": [
     "sikkerhetsutstyr, rutiner og hvordan man opptrer rundt hestene før aktiviteten starter. Gjennomgangen kan være muntlig eller skriftlig, men må være tilpasset aktivitetstype og deltakernes erfaringsnivå. Nye deltakere skal alltid få en grundig gjennomgang. For deltakere som kommer regelmessig, er det tilstrekkelig med påminnelse ved endringer i rutiner eller ved nye aktiviteter."
    ]
   },
   {
    "nr": "70.2.9",
    "tekst": "Har virksomheten et system for å registrere og følge opp avvik?",
    "dok": false,
    "krav": [
     "registreres:",
     "Ulykker og nestenulykker som involverer mennesker eller hester",
     "Alle fall fra hest, også fall uten skade",
     "HMS-avvik som avdekkes ved vernerunde eller ellers",
     "Klager fra kunder, oppstallører og andre brukere"
    ]
   },
   {
    "nr": "70.2.10",
    "tekst": "Er det alltid minst én person med oppdatert førstehjelpskompetanse til stede under aktiviteter?",
    "dok": false,
    "krav": [
     "alltid være til stede når det pågår aktiviteter med deltakere eller kunder. Førstehjelpskurset bør fornyes minimum hvert andre år."
    ]
   },
   {
    "nr": "70.2.11",
    "tekst": "Har du risikovurdert de enkelte aktivitetene du tilbyr, med tanke på brukernes sikkerhet?",
    "dok": false,
    "krav": [
     "arbeidsplassen, ha vurdert risiko knyttet til hver aktivitet du tilbyr – sett fra brukerens ståsted."
    ]
   },
   {
    "nr": "70.2.12",
    "tekst": "Er politiattest fremlagt for ansatte og frivillige med kontakt med mindreårige eller sårbare grupper, der virksomheten er underlagt krav om dette?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.2.13",
    "tekst": "Har virksomheten regler og rutiner for å forebygge og håndtere trakassering, mobbing og overgrep, og er disse kjent for alle på anlegget?",
    "dok": false,
    "krav": [
     "inkludering, en rutine for hva som gjøres når noe skjer, og en måte ansatte, lærlinger, elever og oppstallører kan varsle på."
    ]
   },
   {
    "nr": "70.2.14",
    "tekst": "Har virksomheten forsikringer som er tilpasset aktivitetene som tilbys?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.2.15",
    "tekst": "Har du inngått oppstallingsavtale med alle oppstallører/hesteeiere?",
    "dok": false,
    "krav": [
     "Avtalen bør som minimum regulere ansvar, forsikring, ordensregler, oppsigelsesvilkår og bruk av fellesarealer. Bransjestandard Hest setter krav om oppstallingsavtale."
    ]
   },
   {
    "nr": "70.2.16",
    "tekst": "Drives virksomheten din i samsvar med relevante regler for produksjon, håndtering og servering av mat?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.2.17",
    "tekst": "Drives virksomheten din i samsvar med relevante regler som gjelder for overnatting?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.3.1",
    "tekst": "Har du satt mål for arbeid med helse, miljø og sikkerhet (HMS) på gården?",
    "dok": true,
    "krav": [
     "Skrive mål for følgende områder",
     "Mål for arbeidsmiljø",
     "Mål for arbeid mot brann",
     "Mål for arbeid med el-sikkerhet",
     "Skrive ned hvem som er ansvarlig for HMS-arbeidet"
    ]
   },
   {
    "nr": "70.3.2",
    "tekst": "Har du gjennomført vernerunde på anlegget siste år?",
    "dok": false,
    "krav": [
     "Ha dokumentasjon på at det er gått vernerunde der det framgår hvilke punkt som er sjekket og eventuelle avvik som er funnet på runden."
    ]
   },
   {
    "nr": "70.3.3",
    "tekst": "Har du dokumentasjon på risikovurdering av farlige arbeidsoppgaver? (se eksempler i veiledningstekst)",
    "dok": true,
    "krav": [
     "Ha skriftlig beskrivelse av farlige arbeidsoppgaver med en vurdering av risikomoment og hva som gjøres for å minske risiko"
    ]
   },
   {
    "nr": "70.3.4",
    "tekst": "Gjennomfører du tiltak for å sikre at arbeidsplassen ikke medfører økt fare for helseskade?",
    "dok": false,
    "krav": [
     "– Gå gjennom driften og vurdere om det er behov for tiltak på områdene støy, vibrasjoner, belastninger på kroppen, belysning, støv og ventilasjon"
    ]
   },
   {
    "nr": "70.3.5",
    "tekst": "Gjennomføres det faglig kontroll av det elektriske anlegget minimum hvert tredje år?",
    "dok": true,
    "krav": [
     "I god tid før det har gått tre år, bestille el-kontroll av et sertifisert kontrollforetak",
     "Sjekke at kontrollforetaket gjennomfører kontrollen i henhold til NEK 405- 3 med tillegg landbruk",
     "Rette feil som avdekkes, og ta vare på rapporten"
    ]
   },
   {
    "nr": "70.3.6",
    "tekst": "Har du som arbeidsgiver, og eventuelle arbeidsledere på gården, gjennomgått lovpålagt opplæring i HMS-arbeid?",
    "dok": true,
    "krav": [
     "Gjennomføre opplæring i HMS for arbeidsledere"
    ]
   },
   {
    "nr": "70.3.7",
    "tekst": "Har alle ansatte skriftlig arbeidsavtale?",
    "dok": true,
    "krav": [
     "Ha en skriftlig arbeidsavtale med alle ansatte, på et språk som både arbeidsgiver og arbeidstaker forstår"
    ]
   },
   {
    "nr": "70.3.8",
    "tekst": "Er det tilstrekkelige personalrom for ansatte?",
    "dok": false,
    "krav": [
     "Ha rom der ansatte har tilgang til toalett, vask, dusj, garderobe med skiftemulighet og mulighet til å tørke klær, og spiserom"
    ]
   },
   {
    "nr": "70.3.9",
    "tekst": "Dersom du har barn eller ungdom under 18 år i arbeid hos deg, kjenner du til begrensningene i arbeidstid og type oppgaver de kan utføre?",
    "dok": false,
    "krav": [
     "Sette deg inn i regelverket for arbeid utført av personer under 18 år",
     "Gjennomføre risikovurdering før barn eller ungdom settes i arbeid",
     "Ha skriftlig samtykke fra foreldre eller foresatte før barn under 15 år settes i arbeid"
    ]
   },
   {
    "nr": "70.3.10",
    "tekst": "Har du en avfallshåndteringsplan for din gård?",
    "dok": true,
    "krav": [
     "Hvordan ulike typer avfall oppbevares/håndteres (farlig avfall, produksjonsavfall, inkludert landbruksplast, og organisk avfall).",
     "Hvor du leverer ulike typer avfall.",
     "Mal til avfallsplan finnes under \"kravliste\"."
    ]
   },
   {
    "nr": "70.3.11",
    "tekst": "Har virksomheten en oppdatert beredskapsplan lett tilgjengelig for alle?",
    "dok": true,
    "krav": [
     "Utarbeide en skriftlig beredskapsplan der det er beskrevet hva som skal gjøres i de aktuelle situasjonene.",
     "Lage en beredskapsplakat med skisse over bygninger og med nødvendig informasjon om hva bygg inneholder"
    ]
   },
   {
    "nr": "70.3.12",
    "tekst": "Har stallen rømningsveier og brannslokkeutstyr?",
    "dok": false,
    "krav": [
     "For å oppfylle kravet må stallen ha rømningsveier som er brede nok til at hester kan ledes ut trygt, og det bør være minst to uavhengige utganger."
    ]
   },
   {
    "nr": "70.4.1",
    "tekst": "Har virksomheten personell med relevant helse- eller pedagogisk fagkompetanse tilknyttet tilbudet?",
    "dok": false,
    "krav": [
     "finnes det mange forskjellige tilbud, og søker du om godkjenning for et helserelatert tilbud, må søknaden din vurderes individuelt."
    ]
   },
   {
    "nr": "70.4.2",
    "tekst": "Er fasiliteter og utstyr tilrettelagt for deltakere med funksjonsnedsettelser?",
    "dok": false,
    "krav": [
     "montering/stigeblokker, tilpassede saler, ekstra hjelpere osv."
    ]
   },
   {
    "nr": "70.4.3",
    "tekst": "Har virksomheten samarbeid med autorisert helsepersonell for deltakeroppfølging?",
    "dok": false,
    "krav": [
     "følge opp deltakere ved behov."
    ]
   },
   {
    "nr": "70.4.4",
    "tekst": "Har virksomheten rutiner for å innhente helseopplysninger og nødkontakt for deltakere?",
    "dok": false,
    "krav": [
     "pårørende/nødkontakt innhentes før oppstart. Opplysningene skal behandles konfidensielt og oppbevares i tråd med personopplysningsloven."
    ]
   },
   {
    "nr": "70.4.5",
    "tekst": "Har virksomheten skriftlig avtale eller individuell tiltaksplan for hver deltaker?",
    "dok": false,
    "krav": [
     "tilbudet og mål for deltakeren."
    ]
   },
   {
    "nr": "70.4.6",
    "tekst": "Tilpasses aktivitetene til hver enkelt deltakers forutsetninger og behov?",
    "dok": false,
    "krav": [
     "kognitive og emosjonelle forutsetninger."
    ]
   },
   {
    "nr": "70.4.7",
    "tekst": "Er alle ansatte og involverte forpliktet til taushetsplikt om deltakerinformasjon?",
    "dok": false,
    "krav": [
     "ha signert taushetserklæring. Jf. personopplysningsloven."
    ]
   },
   {
    "nr": "70.4.8",
    "tekst": "Henter virksomheten systematisk inn tilbakemeldinger for å forbedre tilbudet?",
    "dok": false,
    "krav": [
     "deltakere, pårørende og/eller oppdragsgivere."
    ]
   },
   {
    "nr": "70.5.1",
    "tekst": "Har bedriften innhentet nødvendige tillatelser for ridning eller kjøring i områdene som benyttes?",
    "dok": false,
    "krav": [
     "vernemyndighet der det kreves for organisert ferdsel."
    ]
   },
   {
    "nr": "70.5.2",
    "tekst": "Er ansvarlig turleder over 18 år?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.5.3",
    "tekst": "Har alle turledere gjennomført kurs i førstehjelp og sikkerhet?",
    "dok": false,
    "krav": [
     "For turer i utmark bør turledere også ha kunnskap om orientering og kommunikasjonsutstyr."
    ]
   },
   {
    "nr": "70.5.4",
    "tekst": "Har bedriften rutiner for å vurdere deltakeres skikkethet før tur?",
    "dok": false,
    "krav": [
     "ferdigheter vurderes opp mot turen som planlegges. Den som deler ut hester, skal kjenne hestene godt."
    ]
   },
   {
    "nr": "70.5.5",
    "tekst": "Er virksomheten medlem av reisegarantifondet?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.6.1",
    "tekst": "Har lærebedriften gjennomført oppstartssamtale med lærling/lærekandidat?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.6.2",
    "tekst": "Har bedriften gått gjennom HMS-rutiner med lærling/lærekandidat?",
    "dok": false,
    "krav": [
     "ved oppstart."
    ]
   },
   {
    "nr": "70.6.3",
    "tekst": "Er bedriften godt kjent med læreplanen (HST03-02) og kompetansemålene?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.6.4",
    "tekst": "Har bedriften en skriftlig intern plan for hvordan opplæringen skal foregå?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.6.5",
    "tekst": "Gjennomfører lærebedriften halvårlige faglige vurderinger med lærling/lærekandidat?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.6.6",
    "tekst": "Føres det timelister eller oversikt over arbeidstid for lærling/lærekandidat?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.6.7",
    "tekst": "Lages det forutsigbar arbeidsplan for lærling/lærekandidat?",
    "dok": false,
    "krav": [
     "for lærlingen, slik at arbeidstider er forutsigbare."
    ]
   },
   {
    "nr": "70.6.8",
    "tekst": "Er eventuelle private avtaler om oppstalling/husrom skriftlige?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.6.9",
    "tekst": "Er lærebedriften kjent med lærlingens rettigheter og rutiner for oppsigelse/heving?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.6.10",
    "tekst": "Får lærlingen tilstrekkelig tid til opplæring og arbeid med hest, i tråd med kompetansemålene i læreplanen?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.6.11",
    "tekst": "Har faglig leder gjennomført instruktørkurs eller tilsvarende opplæring i veiledning av lærlinger?",
    "dok": false,
    "krav": [
     "lærlinger, for eksempel instruktørkurs i regi av fylkeskommunen eller opplæringskontoret."
    ]
   },
   {
    "nr": "70.7.1",
    "tekst": "Innehar en eller flere av instruktørene utdanning tilsvarende Ridelærer trinn 1 eller høyere?",
    "dok": false,
    "krav": [
     "tilstrekkelig kompetanse."
    ]
   },
   {
    "nr": "70.7.2",
    "tekst": "Innehar én eller flere i ledelsen kompetanse for å drifte et ridesenter?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.7.3",
    "tekst": "Gjennomgår rideskolen årlig om kompetansen blant de ansatte dekker virksomhetens behov?",
    "dok": false,
    "krav": [
     "kompetansekrav, og vurdere årlig om det er behov for kompetanseheving."
    ]
   },
   {
    "nr": "70.7.4",
    "tekst": "Føres det oppdaterte hestebruksskjemaer med oversikt over belastningsgrad per rideskoletime?",
    "dok": false,
    "krav": [
     "rideskolehest, per uke og år. Det anbefales også å ha oversikt over belastningsgrad per rideskoletime (f.eks. nybegynnertime vs. sprangtime), slik at den samlede belastningen på den enkelte hest kan vurderes. Forskrift om velferd for hest § 29 krever at arbeidet hesten utfører skal være forsvarlig ut fra hestens alder, utvikling og kondisjon."
    ]
   },
   {
    "nr": "70.7.5",
    "tekst": "Er rideskolen tilrettelagt for personer med nedsatt funksjonsevne (universell utforming)?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.7.6",
    "tekst": "Har rideskolen tilstrekkelige fasiliteter for elever og besøkende (toalett, garderobe, vaskemulighet)?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.7.7",
    "tekst": "Er belysningen på ridebaner og i ridehall tilstrekkelig for sikker aktivitet?",
    "dok": false,
    "krav": [
     "aktivitet, også i mørke årstider. Utendørs ridebaner som brukes på kveldstid må ha funksjonerende lysanlegg. Belysningen bør inngå i vedlikeholdsplanen (se"
    ]
   },
   {
    "nr": "70.1.12",
    "tekst": "). § Krav Veileder idrettsanlegg Informasjon",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.8.1",
    "tekst": "Har treneren gode rutiner for egenkontroll av hest i tråd med «Hestens velferd i fokus» før hesten skal delta i løp?",
    "dok": false,
    "krav": [
     "hestens helsetilstand og form før løpsstart, i samsvar med DNTs sjekkliste «Hestens velferd i fokus»."
    ]
   },
   {
    "nr": "70.8.2",
    "tekst": "Har treneren rutiner for å sikre at alle hester som stiller til start er i konkurransemessig god stand, og utenfor karenstider på eventuelle behandlinger",
    "dok": false,
    "krav": [
     "kontroll av karenstider etter veterinærbehandling før påmelding til løp,",
     "kontroll av fôr og fôrtilsetninger mot forbudte stoffer,",
     "sikker oppbevaring og merking av legemidler i avlåst skap,",
     "dokumentasjon av all legemiddelbruk på hestens helsekort."
    ]
   },
   {
    "nr": "70.8.3",
    "tekst": "Har treneren skriftlig avtale med hesteeier for hester i trening?",
    "dok": false,
    "krav": [
     "for alle hester i trening."
    ]
   },
   {
    "nr": "70.8.4",
    "tekst": "Brukes utstyr i trening i samsvar med bransjens regelverk og god hestevelferd?",
    "dok": false,
    "krav": [
     "Kun bruke utstyr i trening som er i samsvar med god hestevelferd.",
     "Kjenne til at bruk av utstyr i løp er regulert av DNTs reglement.",
     "Ha et bevisst forhold til bruk av hjelpemidler/tvangsmidler i trening og vurdere om bruken er forholdsmessig og nødvendig.",
     "Sikre at den som kjører/trener hesten har kompetanse til å bruke utstyret korrekt.",
     "Tilvenne unge hester gradvis til utstyr og trening"
    ]
   },
   {
    "nr": "70.8.5",
    "tekst": "Er trener og ansatte kjent med plikten til å varsle om kritikkverdige forhold knyttet til hestevelferd?",
    "dok": false,
    "krav": []
   },
   {
    "nr": "70.8.6",
    "tekst": "Har treneren sikret at ansatte som trener og håndterer hester, har tilstrekkelig kompetanse?",
    "dok": false,
    "krav": [
     "oppgavene i stallen og sikre at ansatte som kjører hester i trening, eller håndterer hester i krevende situasjoner, har nødvendig erfaring og ferdigheter."
    ]
   }
  ]
 }
];
