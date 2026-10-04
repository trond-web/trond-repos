# SkogIQ.ai – forvaltning av skogbruksplandata

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
