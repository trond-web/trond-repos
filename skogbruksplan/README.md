# SkogIQ.ai – forvaltning av skogbruksplandata

**Versjon 1.1.1** (2026-10-07) · Utviklet av **Trond Harald Sand**. Versjonsnummeret ligger i `js/versjon.js` og `package.json` (testene sjekker at de er like) og vises i appen, i rapportene og i utskrifter.

**Design:** Kartet fyller hele skjermen. Til venstre er en smal ikonliste, og til høyre en flytende arbeidsflate som kan
felles inn. Kommandolinjen (⌘K / Ctrl K eller /) finner bestand, planer, veier og handlinger, og «Kommune 29/2» lager plan
direkte. På mobil blir arbeidsflaten et bunnark som kan dras opp, og ikonlisten en fanerad. Appen har lyst og mørkt tema,
og i mørkt tema blir også topografikartet mørkt. Skrifter: Bricolage Grotesque og Schibsted Grotesk.

**Innsikt** på oversikten er regelbaserte funn fra planens egne data (`js/innsikt.js`). Eksempler er hogstmoden skog uten
planlagt hogst, forfalte tiltak, bestand som trolig er hogd siden takst, ungskogpleie, terrengtransport, veistatus og
CO₂. Hvert funn har en handling som tar deg dit det kan følges opp. Det brukes ingen språkmodell.

En nettleserapp for å forvalte egen skogbruksplan: kart, bestandsliste, tiltaksplan,
framskriving av volum og økonomi, og feltregistrering med GPS. Den kjører i nettleseren uten server og
uten innlogging. Dataene lagres bare på din egen enhet (IndexedDB), og du kan når som helst eksportere dem.

## Hva den gjør

| Område | Funksjon |
|---|---|
| **Import** | SOSI (`.sos`), GeoJSON og CSV. Feltnavn som `BESTANDNR`, `TRESLAG`, `BONITET` (`17` eller `G17`), `HOGSTKLASSE` (`5` eller `V`), `ALDER`, `VOLUM`/`VOLUM_DAA`, `TREANTALL`, `TILTAK` gjenkjennes automatisk. Koordinatsystem (EUREF89 UTM32/33/35 eller WGS84) leses fra filen eller gjettes. Ved ny import flettes data på bestandsnummer, så du kan oppdatere planen uten å miste egne tiltak. |
| **Kart** | Kartverkets topografiske kart (farge og gråtone) og flyfoto. Overlegg fra NIBIO: SR16 volum, treslag, bonitet og trehøyde, og AR5 arealtype. Du kan sammenligne planen med nyere fjernmålingsdata. Bestandene kan fargelegges etter hogstklasse, treslag, bonitet, volum, planlagte tiltak eller hogstklasse i et framtidig år. |
| **Bestand** | Tabell som kan sorteres og filtreres, med summer. Alle felt kan redigeres, du kan tegne nye bestand og flytte grenser. Hvert bestand viser beregnet tilvekst, volum om 10 år, når det blir hogstmodent og rotnetto ved hogst nå. Felt fra importen som appen ikke kjenner, tas vare på. |
| **Tiltak** | Tiltaksplan per år med m³, netto og skogfondavsetning. **«Foreslå tiltak»** finner hogstmodne bestand og foreslår sluttavvirkning, planting, ungskogpleie og tynning. Sluttavvirkningen **spres jevnt over N år**. Miljøfigurer får aldri forslag om hogst. Når et tiltak markeres som utført, oppdateres bestandet (f.eks. til HK I etter hogst). |
| **Framskriving** | Simulerer eiendommen år for år i 10–50 år, med eller uten tiltaksplanen. Viser stående volum, tilvekst, avvirkning, netto og CO₂. Glidebryteren viser hogstklassekartet i et valgt år. |
| **Felt** | GPS-posisjon som viser hvilket bestand du står i. Registreringer (skade, barkbille, miljøverdi …) med bilde lagres på kartet. Kartet kan **lastes ned for offline bruk** i skogen, og appen kan installeres på mobilen (PWA). |
| **Eksport** | Full sikkerhetskopi (JSON), GeoJSON, SOSI (UTM32/33), bestandsliste og tiltaksplan som CSV (åpnes i Excel), og en utskriftsvennlig rapport/PDF. |
| **Innstillinger** | Tømmerpriser, driftskostnader, kostnader for kulturtiltak, skogfondsats, uttak i tynning, CO₂-faktor, hvor mange år hogsten spres over, og en tabell for laveste hogstalder. |

## Kom i gang

1. Åpne `index.html` via en webserver, f.eks. `python3 -m http.server` i denne mappen, og gå til <http://localhost:8000>.
   Mappen publiseres også på GitHub Pages under `/skogbruksplan/`.
2. Trykk **Last demo-eiendom** for å prøve, eller gå til **Data** og dra inn SOSI-, GeoJSON- eller CSV-filen fra planen din.
   `tests/eksempel.sos` er en liten eksempelfil.
3. Trykk **Tiltak → Foreslå tiltak**, og se resultatet under **Framskriving**.

## Viktig om modellene

Tilvekst, verdier og CO₂ er **forenklede estimater** til planlegging, ikke takst:

- Volumutviklingen følger en Chapman–Richards-kurve per treslag og bonitet. Den forankres i registrert volum og alder,
  slik at framskrivingen starter fra dine data.
- Hogstmoden alder følger PEFC N 02:2022: vanlig omløpstid for gran og furu, og nedre aldersgrense for lauv. Tabellen kan
  endres under Innstillinger, men bør ikke settes lavere enn PEFCs nedre aldersgrense.
- Priser og kostnader er eksempelverdier. Legg inn tall fra skogeierandelslaget ditt.

## Teknisk

- Ren HTML/CSS/JavaScript (ES-moduler). Eneste eksterne bibliotek er Leaflet.
- `js/proj.js`: EUREF89 UTM ↔ geografiske koordinater, kontrollert mot PROJ på millimeternivå. Inneholder også areal og punkt-i-polygon.
- `js/sosi.js`: SOSI-leser (FLATE/KURVE-referanser, hull, ENHET, ORIGO-NØ, tegnsett) og SOSI-eksport.
- `js/model.js`: normalisering av felt, hogstmodenhet, tilvekst, framskriving, økonomi og tiltaksforslag.
- `sw.js`: service worker som gjør appen og nedlastede kartfliser tilgjengelige offline.
- Tester: `node tests/run.mjs`

## Lag plan fra gårds- og bruksnummer (i appen)

Under **Planer** skriver du inn kommune (navn eller nummer), gårdsnummer, bruksnummer og eventuelt festenummer.
Appen henter dataene direkte fra Kartverket og NIBIO i nettleseren (`js/generator.js`, med Turf til geometri).
Underveis vises fremdriften for hvert steg. Når planen er ferdig, vises et sammendrag og knappen
**«Åpne skogbruksplanen»**. Alle planer lagres lokalt under «Mine skogbruksplaner», og du kan bytte mellom dem.

Store eiendommer støttes:
- **Oppdeling ved 1000-taket:** NIBIOs kartjeneste gir maks 1000 flater per svar. Treffes taket, deles området i fire ruter (gjentatt ved behov). Ruter utenfor teigene hoppes over.
- **Raskere henting:** attributter hentes samlet per rute, ikke én forespørsel per flate.
- **Rask geometri:** polygonklipping gjøres med `polygon-clipping`, med Turf som reserve.
- **Delte bestand:** bestand som NIBIO har lagret som flere flater med samme nummer, slås sammen. Har delene ulike data, får de bokstav etter nummeret (f.eks. 1-45a og 1-45b).
- **Eksempel:** Flå 22/1 (12 teiger, 11 455 daa) gir 563 bestand på 9 822 daa skog.

## Tiltaksmotor – automatiske tiltak (fanen «Tiltak»)

`js/tiltaksmotor.js` lager tiltak for kort sikt (0–10 år) og lang sikt (10–30 år) ut fra biologi, bærekraft og økonomi. Når en plan lages, spør appen om tiltaksplanen skal lages automatisk. Motoren kan også kjøres når som helst fra Tiltak-fanen, med forhåndsvisning.

| Tiltak | Regel | Grunnlag |
|---|---|---|
| Flatehogst | Hogstår ved økonomisk optimum (forventningsverdi, Faustmann), aldri under PEFCs laveste hogstalder. Følges av markberedning, planting, ungskogpleie og tynning. | PEFC N 02:2022, verdiberegningen |
| Lukket hogst | Velges ved gran på middels/lav bonitet, gammel skog, friluftsliv, naturtyper eller kantsone mot vann. Velges ikke ved høy bonitet, høy stormrisiko eller lauv. Uttak 35 %, nytt inngrep hvert 15. år, mer enn 15 trær/daa igjen. | NIBIO/NINA for Miljødirektoratet (2025), Store norske leksikon |
| Frøtrestilling | Furu på middels/lav bonitet: 5–10 frøtrær/daa, markberedning, frøtrærne fjernes etter ca. 10 år. | Forskriften § 6 |
| Planting | Tilrådd plantetall for treslag og bonitet (f.eks. G20: 220/daa, minst 150), våren etter hogst. | Forskrift om bærekraftig skogbruk § 7 |
| Markberedning | Før planting på bonitet 11 og høyere, og ved frøtrestilling. | NIBIOs snutebilleundersøkelse 2017 |
| Ungskogpleie | Ved 1–5 m høyde, ned til 150–250 trær/daa (100–140 i stormutsatte bestand). | Statsforvalteren/Skogkurs, Skogbrand |
| Tynning | Første tynning ved 12–14 m overhøyde (gran G14+, furu F11+), andre i furu ved 16–18 m. Bare når uttaket er minst 3 m³/daa. | NIBIO: Tynning og skogproduksjon |

- **Bærekraft:** sluttavvirkning og lukket hogst fordeles slik at hver femårsperiode holder seg nær tilveksten. Miljøfigurer, nøkkelbiotoper og verneområder får ingen tiltak.
- **Prinsipper:** «balansert», «økonomi først» (mer flatehogst, større rom for tidlig hogst) og «biologi og miljø først» (mer lukket hogst, 10 år lengre omløp, avvirkning under tilveksten).
- **Begrunnelse:** hvert tiltak har en begrunnelse og kilder («Hvorfor?») og er merket som automatisk. Manuelle tiltak endres aldri.
- **Endringer:** når et bestand endres (alder, volum, høyde, treantall, treslag, bonitet, areal eller utførte tiltak), varsler appen i bestandsdetaljen, i Tiltak-fanen og under Innsikt. Du kan oppdatere tiltakene med ett klikk eller beholde dem som de er.
- **Lukket hogst** er en egen tiltakstype. Den er med i framskriving, økonomi, hogstprognose, verdiberegning og PEFC-klarering.

## Markslag og uproduktiv mark (AR5)

Når planen lages, hentes markslag fra NIBIOs arealressurskart AR5 (`js/markslag.js`).

- **Kategorier:**
  - produktiv skog (skogbonitet lav–særs høy)
  - uproduktiv skog (impediment) og myr
  - åpen fastmark, jordbruk, bebyggelse, samferdsel, vann og snø/is
- **Ingen volum på uproduktiv mark:** alt som ikke er produktiv skog, trekkes ut av bestandene før volum beregnes. Merknaden på bestandet sier hvor mye som er trukket ut.
- **Uproduktive figurer** lagres som U1, U2 … med AR5-treslag, grunnforhold og kartleggingsdato.
- **Kartsymboler:** myr (strek med tuster på blå bunn), impediment (prikker og små trær), åpen fastmark (prikker), jordbruk (skravur), bebygd (kryss), samferdsel (strek) og vann (bølger). Symbolene er med i tegnforklaringen og kan slås av i kartlagsmenyen.
- **Oversikt** viser arealfordelingen per markslag. For planer laget tidligere kan markslag hentes og trekkes ut av bestandene derfra.
- **Rapportene:** hovedtall har arealfordeling og kart med symboler. Bestandslisten har en liste over uproduktive arealer med summer per markslag. Begge finnes også i CSV.
- **Henting:** AR5-tjenesten tegner bare flater i stor målestokk og svarer 500 på ruter med mange flater. Hentingen bruker derfor ruter på maks 4 km og deler dem videre ved behov.

## Rapporter (fanen «Rapporter»)

Fire rapporter som A4-dokumenter. Hver kan vises i appen, skrives ut eller lagres som PDF, og lastes ned som CSV (`js/rapporter.js`):

- **Hovedtall:** nøkkeltall, arealfordeling per markslag og bestandskart farget etter hogstklasse, med symboler for uproduktiv mark. Areal og volum per hogstklasse og treslag (med diagram), areal per bonitet, tilvekst per hogstklasse, avvirkningsmuligheter (hogstmodent nå og innen 10 år, bærekraftig nivå), verdi og prisforutsetninger.
- **Bestandsliste:** alle bestand per teig med areal, hogstklasse, treslag, bonitet, alder, høyde, treantall, volum, tilvekst, planlagte tiltak og merknader, med delsum per teig. Skrives ut liggende.
- **Hogstprognose:** 10, 20 eller 30 år. Viser planlagt sluttavvirkning og tynning, netto og hogstmodent volum uten plan per femårsperiode (diagram og tabell), tilvekst og stående volum, og lister over planlagt hogst og hogstmodne bestand.
- **PEFC-rapport:** status per kravpunkt (gruppert på tema, med dokumentasjon), samlede avvik og oppfølgingspunkter, kart og liste over miljøobjekter, klarering før hogst, datagrunnlag og eiendomsopplysninger, med signaturfelt.

«Alle rapporter» setter de fire sammen til ett dokument.

## Skogbrand – skadeforebygging og skaderegistrering (fanen «Skogbrand»)

Bygger på Skogbrands råd om forebygging og oppfølging etter skade, vilkårene i skogforsikringen og «Retningslinjer for skogsdrift og skjøtsel i skogbrannsesongen» (april 2026). Data hentes åpent fra Meteorologisk institutt og NIBIO (`js/skade.js`, `js/skade-data.js`, `js/skogbrand-ui.js`).

**Risiko nå**
- **Skogbrannfare:** skogbrannindeks (FWI) for eiendommen i dag og 13 dager frem (met.no THREDDS). Fargene følger met.no, mens grensene er de europeiske EFFIS-klassene og kan avvike litt fra met.no sin norske indeks.
- **Drift ved dagens nivå:** retningslinjene for drift ved nivåene grønn, gul og oransje, rød og mørkerød, med planlagte drifter i år og et utskrivbart samrådsskjema.
- **Farevarsler:** varsler fra met.no (MetAlerts) for eiendommen.
- **Vind:** vindkast per dag de neste 9 dagene.
- **Granbarkbille:** barkbillevarsel for sonen og fangst i de nærmeste fellene, sammenlignet med historisk utbruddsnivå (NIBIO).
- **Kartlag:** skogbrannindeks, barkbillevarsel, skogskader.no og barkbillefeller.

**Forebygging**
- **Risiko per bestand** (0–100) for storm, granbarkbille, snøbrekk og brann, med begrunnelse. Risikoen bygger på treslag, høyde, tetthet, tynning, nye hogstkanter mot fremherskende vind, skader i nærheten og barkbillevarsel. Kartet kan fargelegges etter hver risiko.
- **Forslag til tiltak** etter Skogbrands råd: ungskogpleie ved ca. 4 m, tynning før 14 m, prioritert hogst og korte kanter. Forslagene kan legges rett inn i tiltaksplanen.
- **Beredskap:** sjekkliste (beredskapspakke, kurs, plakater, brannvesen), kontaktperson og brannvannkilder i kartet.
- **Forsikring:** selskap, polise, egenandel og dekninger.

**Skader**
- **Typer:** brann, storm, snø, smågnagere, granbarkbille, sopp og råte, vilt, tørke, flom, ras og annet. Skaden tegnes som område, som punkt i kartet eller ved GPS-posisjonen.
- **Beregning:** berørte bestand med areal, volum og verdi beregnes fra planen.
- **Forsikringsvurdering** etter vilkårene: storm og snø krever over 2 ha og minst 25 % skadde trær, brann dekkes alltid, og følgeskader dekkes ikke.
- **Oppfølging** med frister, for eksempel å vente med opprydding til skaden er taksert og å fjerne vindfelt gran før billesvermingen.
- **Forsikringssak, bilder og timeliste:** skadenummer, takst og erstatning; bilder fra kamera; timeliste for vakthold og slokking ved brann (300 kr/t).
- **Skademelding:** kan kopieres, skrives ut med bilder eller lastes ned som GeoJSON.
- **Kobling til resten av planen:** brann blir en brannflate i PEFC-modulen, og opprydding og foryngelse kan legges inn i tiltaksplanen.

## Skifteplan – jordbruksskifter, gjødslingsplan og plantevernjournal (fanen «Skifteplan»)

Skifteplan for jordbruksarealet på eiendommen, bygget rundt kravene i
[forskrift om lagring og bruk av gjødsel mv. (2025)](https://lovdata.no/forskrift/2025-01-29-115) og forskrift om plantevernmidler.

- **Skifter**: hentes fra AR5 (fulldyrka, overflatedyrka og innmarksbeite på eiendommen) eller tegnes i kartet. Per skifte: vekst per år
  (forgrøde, planår og neste år), forventet avling, jordarbeiding, jordprøve (pH, P-AL, K-AL, K-HNO₃, mold) og notat.
  Jordsmonn (tekstur, drenering, organisk materiale, begrensning) og erosjonsrisiko hentes automatisk fra NIBIO (WMS
  `jordsmonn_harmonisert` og `jordsmonn_erosjonsrisiko`), og kan vises som kartlag.
- **Automatisk skifteinndeling** når skogbruksplanen opprettes (eget steg i genereringen), og med «Ny automatisk inndeling» i fanen:
  1. AR5-figurene (fulldyrka, overflatedyrka, innmarksbeite) er utgangspunktet – de er avgrenset av vei, vassdrag, skog og arealtype.
  2. Arealtypene holdes adskilt.
  3. Figurer over 20 daa deles der jordsmonnet skifter (NIBIOs jordsmonnkart, hentet som polygoner med egenskaper): sand/grus,
     silt og lettleire, mellomleire/stiv leire og organisk jord, og god eller svak naturlig drenering – slik at én blandprøve er
     representativ.
  4. Deler under 10 daa (eller 15 % av figuren) slås sammen med naboen; flater under 2 daa og striper under 8 m slås sammen med nabo av
     samme type eller utelates. Restbiter ryddes bort.
  5. Nummerering nord → sør, vest → øst. Hvert skifte får begrunnelse for inndelingen og jordsmonn (dominerende figur, andel,
     erosjonsrisiko). Store skifter får råd om antall delprøver (ca. 1 per 10–15 daa).
- **Gjødselbehov** etter NIBIOs Gjødslingshåndbok: normer for korn og eng/beite/grønnfôr, korrigert for avling, moldinnhold, forgrøde,
  P-AL og K-AL/K-HNO₃. Oljevekster, belgvekster, potet og grønnsaker har veiledende anslag (merket i appen).
- **Gjødslingsplan** (§ 26): mineral- og husdyrgjødsel per skifte med N/P/K, forslag som dekker resten av behovet (delt gjødsling på eng med
  flere slåtter), «Utført»-knapp, sum mot behov, utskrift med kartskisse over skifteinndelingen, og CSV.
- **Plantevernjournal**: integrert plantevern (årlig sjekkliste), sprøytejournal (skifte, kultur, preparat, dose, skadegjører, begrunnelse,
  stadium, vær, behandlingsfrist → tidligste høsting, effekt, utført av) og vannjournal-merknad for skifter under 50 m fra vann (AR5).
- **Krav**: påkrevd gjødslingsplan (> 25 daa, eller > 5 daa potet/grønnsaker), manglende felt, jordprøvealder (8 år, 4 år for
  fosforkrevende kulturer), pH, høy P-AL, N/P over behov, fosforgrense fra 2027 (2,8 → 2,5 → 2,3 kg P/daa i snitt over tre år; Rogaland og
  Troms/Finnmark egne grenser), spredeperiode og nedmolding for husdyrgjødsel, erosjon ved høstpløying og ensidig vekstskifte. Avvik vises
  også under Innsikt i Oversikt.

Kilder: [Landbruksdirektoratet om § 26](https://www.landbruksdirektoratet.no/nb/jordbruk/miljo-og-klima/husdyrgjodsel-og-gjodsling/forskrift-om-lagring-og-bruk-av-gjodsel-mv.-kommentarer-til-regelverk/-26.krav-til-gjodslingsplan),
[NIBIO Gjødslingshåndbok](https://www.nibio.no/tema/jord/gjodslingshandbok),
[Mattilsynet: krav til sprøytejournalen](https://www.mattilsynet.no/planter-og-dyrking/plantevernmidler/veileder-til-forskrift-om-plantevernmidler/journalforing-ved-bruk-av-plantevernmidler/krav-til-sproytejournalen),
[NLR: plantevernjournalen](https://www.nlr.no/nyhetsarkiv/default/2025/slik-fyller-du-ut-plantevernjournalen).
Tallene for husdyrgjødsel er typiske verdier – bruk egen gjødselanalyse når den finnes.

## Publisering på Railway

I produksjon: **https://skogiq-production.up.railway.app** (Railway-prosjekt `skogiq`, tjenesten er koblet til `main` og publiseres på nytt ved hver endring i `skogbruksplan/`).

Appen er statisk og kjøres med en liten Node-server uten avhengigheter (`server.js`). Den har komprimering, ETag/304,
sikkerhetshoder og helsesjekk på `/healthz`. Testfiler, verktøy og konfigurasjon publiseres ikke.

1. Gå til [railway.com](https://railway.com) → **New Project** → **Deploy from GitHub repo** → velg `trond-web/trond-repos`.
2. Under tjenestens **Settings**:
   - **Root Directory**: `/skogbruksplan`
   - **Branch**: grenen som skal publiseres (f.eks. `main`)
   - **Start Command**: `node server.js`, **Healthcheck Path**: `/healthz`, **Watch Paths**: `/skogbruksplan/**`
     (Railway har faset ut `railway.json` som «Config File»; filen ligger igjen som dokumentasjon av innstillingene)
3. **Networking** → **Generate Domain** for å få en offentlig adresse (`*.up.railway.app`), eller legg til eget domene.

Railway bygger med Railpack (Node ≥ 20) og starter `node server.js` på porten i `PORT`. Ingen miljøvariabler er nødvendige –
AI-nøkkelen legges inn av hver bruker i appen og lagres bare i nettleseren.

Lokalt: `npm start` (port 8080) eller `PORT=3000 npm start`. Tester: `npm test`.

## Driftsforhold og kjøreskader (Kommune → Sluttavvirkning)

«Analyser driftsforhold» prioriterer hogstflatene i kommuneanalysen etter hvor og når de kan drives med minst mulig
sporskader fra hogstmaskin og lassbærer.

- **Markfuktighet (55 %)** – NIBIOs markfuktighetskart (DTW, fra laserdata DTM1): andel av flaten med grunnvann 0–1 m under
  overflaten, lest piksel for piksel fra WMS-laget «markfuktighetsklasser» (én PNG per 2 × 2 km). Våte partier vektes opp.
- **Bæreevne (30 %)** – NGU løsmassekart: morene/breelv god, elve-/vindavsetning middels, leire/silt dårlig, torv/myr svært dårlig.
- **Helning (15 %)** – Kartverkets høydedata (3 × 3 punkter per flate, planutjevning) i terrengklasser; > 50 % krever kabel eller
  beltegående maskin.
- **Mark og vær** – NVE seNorge per km²: teledyp, snødybde, vannmetning i jord og nedbør, 3 dager bakover og 9 dager prognose.
  NVE tillater ikke kall fra nettleseren, så `server.js` videresender dem (`/api/nve/GridTimeSeries/...`, kun kjente temaer,
  bufret 30 min). Uten server (GitHub Pages) brukes nedbør fra MET Locationforecast.

Hver flate får grunnrisiko og driftssesong (helårsdrift / tørr barmark eller vinter / vinterdrift / kun tele eller snø), risiko
for valgt dag (gode – akseptable – utsett – ikke kjør), beste dag i prognosen og prioritet (70 % driftbarhet, 30 % rotnetto).
Kartet fargelegges etter risiko, markfuktighetskartet kan vises som kartlag, og alt følger med i GeoJSON/CSV-eksporten.

## Nøkkelbiotoper (MiS) i kartene

Nøkkelbiotoper vises likt i alle kart (plankart i alle faner, Kommuneanalyse og rapportene) via `js/miljokart.js`:
magenta diagonal skravur med hvit halo, kraftig omriss og et «MiS»-merke (fra zoom 12–13, med verktøytips om at figuren settes
av urørt etter PEFC krav 22). Bestand merket som miljøfigur får stiplet magenta omriss. Laget «Nøkkelbiotoper (MiS)» ligger
over bestandene, kan slås av i lagvelgeren og slipper klikk gjennom til bestandene.

NIBIOs MiS-tjeneste leverer figurene som omriss (`LineString`) i KML. `js/kml.js` gjør lukkede linjer om til flater (indre
ringer blir hull), slik at nøkkelbiotopene kommer med ved oppretting av planen (miljøfigurer), i PEFC-data og i kommuneanalysen.
Lagrede kommuneanalyser uten nøkkelbiotoper oppdateres automatisk når de åpnes.

## Spør AI (fanen «Spør AI»)

En chat der du stiller spørsmål om skogbruksplanen og får svar fra Claude (Anthropic, modell `claude-opus-5-5`). Svaret strømmes inn mens det skrives.

- **Grunnlag:** assistenten får hele planen som tekst. Det gjelder eiendom, sammendrag, alle bestand (areal, treslag, bonitet, hogstklasse, alder, volum, tilvekst, hogstmoden-år, tiltak og merknader), framskriving i 20 år, verdiberegning, veier, PEFC-avvik, datakilder og feltregistreringer (`js/ai-kontekst.js`).
- **Klikkbare bestand:** bestandsnumre i svaret er knapper som viser bestandet i kartet.
- **Endringer underveis:** endrer du planen midt i samtalen, sendes oppdaterte data med neste spørsmål. Tidligere meldinger i samtalen endres ikke.
- **API-nøkkel:** du trenger din egen nøkkel fra console.anthropic.com. Den lagres bare i nettleseren (localStorage) og sendes bare til api.anthropic.com. Bruken faktureres på din Anthropic-konto.
- **Avslag:** serverside fallback (`fallbacks: "default"`) er slått på, slik at et avslag fra sikkerhetsfiltrene prøves på nytt med en annen modell.
- **Hurtigsøk:** et spørsmål i kommandolinjen, f.eks. «Hvilke bestand er hogstmodne?», kan sendes rett til assistenten.

## Dele et bestand i to

Velg bestandet og trykk «Del i to». Klikk punkter for en linje tvers over bestandet (linjen kan ha knekk). Den kan starte og slutte litt innenfor grensen; da forlenges den ut til grensen. De to delene vises med areal mens du tegner. Dobbeltklikk, Enter eller «Del» avslutter, Backspace eller ↶ fjerner siste punkt, og Esc avbryter. Den største delen beholder nummeret, og den andre får neste ledige nummer i teigen (f.eks. 1-79). Begge delene beholder bestandsdata per daa og planlagte tiltak. «Angre deling» setter bestandet sammen igjen.

## Datagrunnlag (dashboard i PEFC-fanen)

Når en plan lages fra kommune/gnr/bnr hentes alt datagrunnlaget automatisk: eiendomsgrense (Kartverket), tidligere skogbruksplan, SR16 og MiS (NIBIO), verneområder, naturtyper (DN-HB13, NiN, utvalgte), artsområder og friluftslivsområder (Miljødirektoratet), kulturminner (Riksantikvaren), skogsbilveier (NVDB) og tømmerpriser (SSB). Dashboardet «Datagrunnlag» viser for hver kilde når den sist ble hentet, hvor gamle selve dataene er, og hvilke PEFC-kravpunkter den dekker:

- grønn = hentet siste 90 dager, gul = 90–365 dager, rød = eldre, mangler eller feilet
- egne varsler når SR16 er målt for over 10 år siden eller forrige takst er over 15 år gammel
- manuelle registreringer (takst, MiS-år, rovfugl/tiurleik, vurderte kravpunkter, klareringer) vises ved siden av
- «Oppdater alle» henter miljødata, veier og priser på nytt

## Verdiberegning (fanen «Verdi»)

- **Slaktverdi**: stående volum × rotnetto (pris − driftskostnad), totalt og for hogstklasse V.
- **Jordverdi** (Faustmann): LEV = (R(T) − Σ K·(1+r)^(T−t)) / ((1+r)^T − 1), med optimal omløpstid, aldri under PEFCs nedre aldersgrense.
- **Skogverdi** (forventningsverdi): per bestand nåverdien av hogst på beste tidspunkt pluss jordverdien etterpå.
- **Eiendomsverdi**: skogverdi + kapitaliserte andre inntekter og faste kostnader, inkludert planlagt veivedlikehold.
- **Nåverdi av tiltaksplanen** i valgt horisont.
- Følsomhetstabell for renten (2–5 %), verdi per hogstklasse og en sorterbar tabell per bestand med optimalt hogstår.
- Tømmerprisene kalibreres mot SSBs gjennomsnittspris (tabell 03794/03895) for kommunen, eller for fylket når kommunen har solgt under 5000 m³, med samme forhold mellom treslagene som før.
- Bestand i nøkkelbiotoper, BVO og verneområder regnes uten tømmerproduksjon.
- Alle beløp er reelle og før skatt. Dette er et estimat, ikke en takst.

## PEFC skogstandard (fanen «PEFC»)

Bygger på **Norsk PEFC Skogstandard, PEFC N 02:2022** (gjeldende fra 1. mars 2023). Kravpunktene, aldertabellen og
sonene rundt rovfuglreir er hentet fra standardteksten (`js/pefc.js`).

- **Status for alle 30 kravpunkter**, gruppert som i standarden. Statusen kombinerer automatiske kontroller med skogeiers
  egen vurdering, dato og dokumentasjon for hvert kravpunkt.
- **Automatiske kontroller (20 kravpunkter)**:
  - Planens alder og innhold (K3), landskapsplan over 10 000 daa (K4), planlagte veier gjennom miljøverdier (K5) og friluftsliv (K6).
  - Omdisponering over 5 % (K8), verneområder og stier (K11), livsløpstrær med 10 per hektar, kartfestet etter hogst (K13).
  - Nedre aldersgrense for hogst, foryngelse innen 3 år og vurdering av ungskogpleie (K15).
  - Markberedning: forbudte arealer og avstander (K16), gjødslingsfri sone (K19), spredningskontroll for utenlandske treslag (K20).
  - Nøkkelbiotoper og miljøregistrering, og registrerte naturtyper og artsområder (K22), samt 5 % BVO over 1500 daa (K23).
  - Rovfugl og ugler: hensynsområde og buffersone per art (K24), tiurleik (K25), hekketid (K26) og kantsoner (K27).
  - Myr og sumpskog (K28), brannflater (K29) og kulturminner (K30).
- **Klarering før hogst** for hver planlagt sluttavvirkning og tynning. Klareringen viser funnene for bestandet, valg av
  hogstform og foryngelsesmetode, begrunnelse ved hogst under nedre aldersgrense, og sjekkliste for operativ planlegging
  med lenker til Artskart, Naturbase, Kulturminnesøk og NVE.
- **Hent miljødata for eiendommen** fra NIBIO (MiS-nøkkelbiotoper), Miljødirektoratet (verneområder, naturtyper A/B,
  NiN-naturtyper, utvalgte naturtyper, funksjonsområder for rødlistede og prioriterte arter, viktige friluftslivsområder)
  og Riksantikvaren (sikringssoner for kulturminner).
- **Registrer selv**: rovfugl- og uglereir (art og siste hekking gir automatiske soner i kartet), tiurleik, nøkkelbiotop,
  BVO, livsløpstrær, bekker og vann, myr, stier, kulturminner, friluftsområder, brannflater og utenlandske treslag.
- PEFC-avvik vises i innsikten på Oversikt og i rapporten.

Appen kan ikke garantere etterlevelse. Den kontrollerer det som kan kontrolleres med planens data, og gir sjekklister
for resten. Skogeier er ansvarlig, og gruppesertifikatholderen kan ha egne rutiner. Rovfuglreir og tiurleiker er ikke
åpent tilgjengelige, og bekker og stier hentes ikke automatisk.

## Skogsbilveier (fanen «Veier»)

Hver plan har sitt eget veiregister:

- **Hent veier fra NVDB.** Skogsbilveier (vegkategori S) og eventuelt private veier (P) som går på eller inntil eiendommen
  hentes fra Nasjonal vegdatabank. Med dem følger landbruksvegklasse (objekttype 822), bommer, snuplasser og stikkrenner der
  de er registrert. Klassen er ofte ikke registrert. Da settes den manuelt.
- **Tegn veier** (eksisterende eller planlagte) og **plasser punkter**: bom, stikkrenne, snuplass, velteplass, møteplass,
  bru og skade.
- **Per vei:** klasse (Landbruksdirektoratets klasse 1–8), tilstand, dekke, bredde, aksellast, totalvekt, åpningstid,
  byggeår, veilag og **eierandeler**.
- **Vedlikehold:** logg over utført vedlikehold og en plan. «Foreslå vedlikehold» bruker intervall per type (høvling,
  grusing, grøfterensk, kantrydding), siste registrerte utførelse og tilstand. Planen viser kostnad per år og hvordan
  kostnadene **fordeles mellom eierne** etter andeler.
- **Planlagte veier:** byggekostnad per meter etter klasse, minus tilskudd.
- **Terrengtransport:** luftlinjeavstand fra midten av hvert bestand til nærmeste bilvei. Bestand over grensen
  (500 m) listes, og kartet kan fargelegges etter «Avstand til bilvei». Bestandsdetaljen viser avstanden.
- Veiene kommer med i sikkerhetskopien og rapporten, og kan lastes ned som GeoJSON. Satser og intervaller kan endres.

## Kommuneanalyse (fanen «Kommune»)

Går gjennom alle SR16-skogflatene i en kommune og finner tre typer områder:

| Kategori | Standardkriterier (kan endres i appen) |
|---|---|
| **Sluttavvirkning** | Alder ≥ laveste hogstalder for treslag og bonitet, og volum ≥ 15 m³/daa. Bartre. Estimert rotnetto vises. |
| **Lukket hogst** | Gran, alder ≥ 80 % av hogstalder, bonitet ≤ 17, volum ≥ 10 m³/daa, og flersjiktet (middelhøyde/overhøyde ≤ 0,84) eller blandingsskog (< 75 % gran). Gir bledning eller gruppehogst. Furu som er hogstmoden på bonitet ≤ 14 gir frøtre- eller skjermstilling. |
| **Ungskogpleie** | Høyde 1,5–7 m, bonitet ≥ 11, og ≥ 30 % lauv eller tett (≥ 100 trær/daa i SR16, som undervurderer småtrær). |

Skogflater i naturvernområder (Miljødirektoratet) og MiS-nøkkelbiotoper får aldri forslag om hogst. Klikk på en flate,
velg «Finn eiendom» for å se gårds- og bruksnummer fra matrikkelen, og «Lag skogbruksplan» for å lage plan for eiendommen.
Resultatet kan lastes ned som GeoJSON eller CSV og lagres lokalt per kommune.

Teknisk: kommunen deles i ruter på 2,5 × 2,5 km. For hver rute hentes geometri som KMZ, id-er som `text/plain` og
attributter som gzip-komprimert HTML fra NIBIOs WMS (`RADIUS=bbox`). Det er rundt åtte ganger mindre data enn GML.
Rekkefølgen i HTML- og tekstsvaret er kontrollert mot GML. Hele Nannestad (22 000 flater) tar under ett minutt.
SR16-dataene for Nannestad er stort sett fra 2015. Skog kan være hogd siden, så kontroller mot flyfoto.

SR16s treslagskode er 1 grandominert, 2 furudominert, 3 barblanding, 4 blanding og 5 lauvdominert. Der andelen per
treslag finnes, brukes den.

## Plan fra åpne data med Python (`verktoy/lag_plan_fra_apne_data.py`)

Lager et utkast til skogbruksplan for én eiendom ut fra gårds- og bruksnummer:

| Kilde | Brukes til |
|---|---|
| Kartverket, eiendom-API | Eiendomsgrensen (matrikkelens teiger) |
| NIBIO WMS `skogbruksplan` / `hogstklasser` | Bestandsgrenser, bestandsnr, hogstklasse, bonitet og alder (fremskrevet) fra tidligere skogbruksplan |
| NIBIO SR16 vektor (`SRVTRESLAG`) | Volum u.b., middelhøyde, treantall, treslag og trealder. Verdiene er arealvektet innenfor hvert bestand. Skog som ikke var med i den gamle planen, blir egne bestand (`S1`, `S2` …) |
| NIBIO MiS (`Nokkelbiotop`) | Miljøfigurer |

```
pip install shapely pyproj requests
python3 verktoy/lag_plan_fra_apne_data.py --kommune 3238 --gnr 29 --bnr 2 --ut data/nannestad-29-2.geojson
```

Skriptet sammenligner den gamle planen med SR16. Bestand som var hogstklasse IV–V, men som har lite volum i SR16,
merkes som «mulig hogd» eller «trolig hogd eller glissen». Avvik i treslag merkes også. Hogstklasse skrives ikke
til filen, så appen beregner den fra dagens alder. Hogstklassen fra planen ligger i feltet `PLAN_HOGSTKLASSE`.

`data/nannestad-29-2.geojson` er laget slik (Nannestad 29/2) og kan lastes med knappen under **Data**.
Resultatet er et **utkast** som må kontrolleres i felt.
