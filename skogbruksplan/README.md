# SkogIQ.ai – forvaltning av skogbruksplandata

**Versjon 1.38.0** (2026-10-19) · Utviklet av **Trond Harald Sand**. Versjonsnummeret ligger i `js/versjon.js` og `package.json` (testene sjekker at de er like) og vises i appen (Om-boksen og versjonsmerket), i SkogIQ Felt, på kontroller-siden, i installasjonsbeskrivelsen, i rapportene og i utskrifter.

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

## Ungskog (HK I–II) og effekt av tiltak

For bestand i hogstklasse I og II viser bestandet (fullversjonen og SkogIQ Felt) fire felt: **treantall før regulering**, **treantall etter regulering**, **høyde bar** og **høyde lauv**. Tomme felt viser en beregnet verdi med kilde:

- *fra data*: treantall/middelhøyde i bestandsdataene.
- *beregnet*: plantetall × 85 % overlevelse + naturlige lauvtrær (etter bonitet og alder), høydekurve for bonitet og alder, lauv × 1,5 (under 10 år) / 1,25 (under 20 år) av barhøyden, og målet for ungskogpleie etter utført pleie.
- *Treantall etter regulering* beregnes alltid etter bonitet når det ikke er registrert (`maalTetthet` i `js/tiltaksmotor.js`).
  - Grunnlaget er standarden for ungskogpleie (150–250 stammer/daa) og Skogkurs, som anbefaler den øvre delen på høy bonitet.
  - Gran: G6–8 150, G11 160, G14 180, G17 200, G20 220, G23 240 og G26 250 trær/daa.
  - Furu holdes 20 trær/daa tettere, opp til 240. Lauvbestand og stormutsatt skog får 120.
  - Samme mål brukes av tiltaksmotoren («Ungskogpleie ned til ca. … trær/daa») og effektberegningen.
- *registrert*: målte verdier skrevet inn i feltet (i Felt: «✎ Registrer målte verdier»). Tøm feltet for å gå tilbake til beregnet verdi.

Registrert treantall og høyder brukes av tiltaksmotoren (behov for ungskogpleie, høyde om x år).

**Middelhøyde i ungskog:** Registrerte høyder er riktige. Bestandets middelhøyde er snittet av høyde bar og høyde lauv. Er bare den ene målt, fyller appen inn den andre som beregnet verdi. Når du registrerer høyde bar, oppdateres middelhøyden i bestandsdataene. Den nye høyden vises i bestandskortet i feltappen («m høyde (snitt bar/lauv)»), i bestandsskjemaet og i rapportene.

**Delvis ungskogpleie:** Appen summerer arealet av utførte ungskogpleier etter siste hogst (`pleieDekning`).
- Under 90 % av bestandet regnes som delvis.
- Tiltaksmotoren foreslår da «Fullfør ungskogpleien på resterende X daa» med prioritet 1 samme år, med arealet som tiltaksareal.
- Effektkortet regner på resten av arealet («Fullfør resten nå / Utsett resten 5 år / La resten stå») og har overskriften «Fullfør ungskogpleien – bare Y av Z daa er pleiet».
- I SkogIQ Felt viser bestandskortet tiltaksmotorens forslag når bestandet er endret, med knappene «Oppdater tiltak» og «Behold». Det gjelder for eksempel etter at du har målt verdier eller registrert et utført tiltak.
- Merket «best» på et alternativ vises bare når forskjellen er over 5 % av nåverdien. Har en hogd flate (alder 0) fått målt høyde, regnes alderen ut fra høyden (`alderFraHoyde`: år til brysthøyde + høydekurven; 2 m på G11 ≈ 11 år). Et bestand som er forynget, får ikke forslag om planting og markberedning.

**Treantall i ungskog og SR16.** SR16 teller bare trær som er over 5 cm i brysthøyde ([produktarket](https://nibio.no/tema/skog/kart-over-skogressurser/skogressurskart-sr16)). I hogstklasse II mangler derfor de fleste stammene, og på Flå 22/1 viste SR16 49–128 trær/daa. For bestand med treantall fra SR16 (`KILDE` inneholder «SR16») bruker appen derfor en treantallsmodell for alle stammer (`treantallModell` i `js/ungskog.js`). SR16-tallet brukes bare som nedre grense.

Modellen:
- **Bar:** plantet antall × 85 % overlevelse. Antallet er registrert plantetall eller tilrådd plantetall for bonitet. Furu på lav bonitet regnes som naturlig foryngelse, ca. 250 per daa.
- **Lauv:** naturlig oppslag på 120–700 per daa etter bonitet, med mest på høy bonitet. Oppslaget bygges opp over de første ca. 6 årene.
- **Selvtynning:** over ca. 6 m høyde (høydekurven) tas 8 % bort per meter, ned til halvparten.

Modellen gir Flå 22/1 en median på ca. 205 trær/daa i HK II, mot ca. 70 i SR16. På G17–G23 gir den 400–700. Tiltaksmotoren, tetthetsklassen og effektberegningen bruker modellen, og bestandskortet viser «trær/daa (modell)». Takserte treantall og målte verdier i ungskogfeltene går alltid foran. Nivåene er anslag, så mål gjerne i felt.

**Effekt av tiltaket** (ungskogpleie prioriteres, ellers planting i HK I) sammenligner tre alternativer med nåverdi per daa og for bestandet: *gjennomfør nå*, *utsett 5 år* og *ikke gjennomfør*. Nåverdien er hogstinntekt (rotnetto) og jordverdi etter hogst (Faustmann) minus kostnaden, med kalkulasjonsrenten fra Verdi.

- Uten ungskogpleie: 10–40 % lavere barvolum, 8–12 % lavere pris og hogst 5–8 år senere. Tapet er størst når bestandet er tett og lauvet er høyere enn baret. Det er kalibrert mot Bergseng (2016) i Skogtiltaksfondets rapport om ungskogpleie, der rotnettoen er om lag halvert når lauvet ikke ryddes, på både G17 og G11.
- Kostnaden regnes etter tilskudd og skattefordel ved bruk av skogfond. 85 % av beløpet er skattefritt, og skattesatsen er 22 % som standard. Tilskuddet er 0 % som standard, og begge kan endres under Verdi.
- Jordverdien etter hogst settes aldri lavere enn null. Ellers ville en negativ jordverdi på lav bonitet få utsettelse til å se lønnsomt ut.
- **Internrenten** er renten der pleie og ingen pleie gir samme nåverdi. Ved 900 trær/daa er den ca. 2,9 % på G11, 3,8 % på G14, 4,9 % på G17 og 6,1 % på G20.
- Er bestandet tett, men økonomien nær null, sier kortet «Ungskogpleie anbefales», med internrenten og forklaringen at det er lang tid til hogst. Det sier ikke lenger at tiltaket «ikke lønner seg».
- Utsatt pleie: 40 % av tapet, og høyere kostnad fordi trærne er høyere.
- Naturlig foryngelse i stedet for planting: 5–10 år senere etablering, 20–35 % lavere produksjon, lavere pris og forventet suppleringsplanting.

Kortet viser også andre effekter (riktig høydefase, lauv som skygger, stabilitet, PEFC-hensyn) og en knapp for å legge tiltaket i planen. Tallene er anslag. Logikken ligger i `js/ungskog.js` og visningen i `js/effekt-html.js`.

## Endre og slette tiltak

Tiltak kan endres og slettes både i fullversjonen og i SkogIQ Felt (`js/tiltak-endring.js`).

- **Hvor:**
  - I fullversjonen har hver tiltaksrad ✎ (endre) og ✕ (slett) i tiltakslisten og i bestandsdetaljen. ✎ åpner en dialog.
  - I Felt har hvert tiltak ✎ ved siden av utført-avkrysningen, både i bestandskortet og i tiltakslisten.
- **Hva kan endres:**
  - type
  - status (planlagt/utført)
  - år, eller utført-dato for utførte tiltak (året settes fra datoen)
  - areal, eller hele bestandet
  - prioritet (i fullversjonen) og kommentar
  - fjerning av en registrert sporlogg-flate
- **Kontroll:** ukjent type, ugyldig år, dato fram i tid og areal større enn bestandet avvises med melding. Ingenting endres før alt er gyldig.
- **Endre flaten i kartet** (`js/flate-redigering.js`, `js/flate-geometri.js`): knappen «Endre flate i kartet» (eller «Tegn flate i kartet») ligger i endre-skjemaet i begge versjonene.
  - **Hjørner:** dra hjørnene for å flytte dem. Dra eller trykk de små kantpunktene for å lage nye hjørner. Trykk et hjørne og «Slett punkt» for å fjerne det.
  - **Områder:** «＋ Legg til område» og «− Fjern område» tegner et område som slås sammen med eller trekkes fra flaten. Det egner seg godt for sporlogg-flater med mange punkter. «Tegn på nytt» erstatter flaten, og «Hele bestandet» bruker bestandets grense som start.
  - **Angre og avbryt:** Angre har opptil 30 steg. Avbryt eller Esc lar flaten være uendret.
  - **Forenkling:** flaten forenkles til høyst ca. 160 hjørner for redigering (Douglas–Peucker for lukkede ringer), og biter og hull under 10 m² fjernes.
  - **Ferdig:** flaten ryddes med union og klippes mot bestandet. Arealet og andelen regnes ut på nytt. Over 99,5 % regnes som hele bestandet.
  - **I kartet:** fullversjonen viser flatene til tiltakene i bestandet som er valgt.
- **Identifisere i kartet** (`js/treff.js`):
  - **I kartet:** tiltak med egen flate vises over bestandene. Planlagte er blå og stiplet, og utførte de siste to årene er grønne.
  - **Ett treff:** bestandet åpnes som før.
  - **Flere treff:** ligger det tiltaksflater der du trykker, vises «Her ligger», med tiltakene (planlagte først) og bestandet.
  - **I Felt** åpner valget et tiltakskort med status, areal og andel, bestand, kilde og kommentar. Kortet har knappene Merk utført/Angre, Endre, Endre flate, Bestand og Vis i kart, og den valgte flaten utheves med gult. Trykk på et tiltak i en liste åpner også kortet.
  - **I fullversjonen** vises listen og kortet i en popup i kartet. «Tiltaksflater» er eget lag i lagvelgeren og står i tegnforklaringen.
- **Motortiltak:** et tiltak fra tiltaksmotoren som endres for hånd, blir manuelt, slik at motoren ikke erstatter det.
- **Sletting:** du må bekrefte. Bekreftelsen sier fra om tiltaket ligger i et oppdrag eller har en sporlogg-flate. Tiltaket fjernes også fra oppdraget og fra sporloggens bestandsliste.
- **Gamle tiltak:** importerte tiltak uten id får id automatisk, slik at de kan endres.

## Fra PC til mobil – send planen med QR-kode og synkroniser begge veier

1. **På PC-en:** Trykk **📱 Til mobil** på planen i Planer, eller **Send planen til mobilen** i Felt-fanen. Etter at en ny plan er laget, finnes også knappen **📱 Send til mobilen**. Du får en QR-kode og en kode på 6 tegn, som gjelder i 15 minutter og kan brukes på flere mobiler.
2. **På mobilen:** Skann QR-koden med kameraet. Planen åpnes i SkogIQ Felt og lagres på telefonen. Du kan også åpne SkogIQ Felt, trykke på planvelgeren øverst og velge **Hent plan fra PC-en**, og skrive koden.
3. **Etterpå:** Planen virker uten nett på mobilen. Endringene synkroniseres automatisk begge veier når enhetene har nett:
   - Mobilen synkroniserer når appen åpnes, når den kommer fram igjen, når nettet kommer tilbake, og 8 s etter en endring.
   - PC-en synkroniserer når vinduet får fokus, hvert minutt, og 10 s etter en endring.
   - Du kan også trykke **⇅ Synkroniser nå**.
   - Planer som synkroniseres, er merket **⇅ mobil** i planlista.

**Fletting** (`js/plan-synk.js`):
- Det sist endrede eksemplaret er grunnlaget.
- Registreringer, tiltak, sporlogger, oppdrag og droneoppdrag fra begge sider tas med. For samme id vinner den nyeste versjonen, for eksempel et tiltak som er satt som utført i felt.
- Slettede tiltak og registreringer huskes (`plan.slettet`), så de ikke kommer tilbake fra den andre enheten.
- Om en plan er endret siden forrige synkronisering, avgjøres av et fingeravtrykk av innholdet, ikke av klokkeslett.

**Serveren** (`plan-relay.js`, API `/api/plan…`):
- Den er et mellomlager. Planen ligger alltid på enhetene.
- Planen sendes gzip-komprimert over HTTPS (typisk 0,1–0,5 MB) og får en hemmelig synk-id.
- En ny versjon må bygge på den siste. Ellers svarer serveren 409, og enheten fletter.
- Planer slettes etter 90 dager uten bruk. Med `PLAN_FIL` lagres de også på disk.
- Er serveren startet på nytt og har glemt planen, laster enhetene den opp på nytt med samme id. Den siste fletter i stedet for å overskrive.

**Raskere henting av eiendommer:**
- Planen er klar og kan åpnes etter ca. 10 s.
- Datagrunnlaget hentes samtidig i bakgrunnen og legges inn i planen når det kommer, også om planen er åpnet i mellomtiden. Det gjelder miljødata fra 8 kilder, NVDB-veier, traktorveier og stier fra FKB, og tømmerpriser fra SSB.
- Før tok hele hentingen ca. 2,5 minutter for Nannestad 29/2. Nå tar den ca. 30 s.
- SSB får ett nytt forsøk hvis første kall feiler.

## SkogIQ Felt – mobilversjon som fungerer offline (`felt.html`)

En egen mobilversjon der kartet fyller skjermen og bare det du trenger i skogen er med (`felt.html`, `felt.css`, `js/felt-app.js`). Den bruker de samme planene som fullversjonen (IndexedDB i nettleseren). Endringer synkroniseres mellom faner med `BroadcastChannel`.

- **Kart:** bestandene er farget etter hogstklasse med bestandsnummer, og eiendomsgrensen vises. Du kan bytte mellom gråtone, topografisk kart og flyfoto, og zoome til hele eiendommen.
- **GPS:** viser posisjonen med nøyaktighet og følger deg. Stripen øverst viser hvilket bestand du står i. Trykk på den for bestandskortet.
- **Bestandskort:** treslag, bonitet, hogstklasse, areal, alder, volum, treantall, høyde og planlagte tiltak. Tiltak krysses av som utført med dagens dato. Ved sluttavvirkning og planting tilbys oppdatering av bestandet, som i fullversjonen.
- **Registrering:** kategori, beskrivelse og bilde fra kameraet. Posisjonen tas fra GPS, eller fra et sikte midt i kartet. Registreringene vises i kartet og i fullversjonen.
- **Lukke panelene:** du kan lukke et panel på flere måter:
  - med krysset, som er 44 px og reagerer direkte på berøring, også rett etter rulling på iPhone
  - ved å sveipe ned fra toppen, eller fra innholdet når det er rullet helt opp
  - med et trykk i kartet utenfor panelet (ikke midt i et skjema)
  - med tilbakeknappen eller tilbakesveip, som lukker panelet i stedet for å forlate appen
  - med Esc
  Meldinger kan trykkes vekk.
- **Oppdrag** (`js/oppdrag-felt.js`, samme regler og data som fullversjonen i `js/oppdrag.js`): egen fane i bunnmenyen.
  - **Liste:** aktive oppdrag først, med status, antall bestand, areal, utfører og periode.
  - **Oppdragskort:**
    - status med ett trykk (Utkast → Bestilt → Pågår → Utført, eller Avbrutt)
    - utfører med knapper for å ringe (`tel:`) og sende e-post (`mailto:`), og periode
    - tiltakene, som krysses av som utført; når alle er utført, foreslås status Utført
    - oppdragsfeltene og PEFC-sjekklisten, som kan krysses av
    - «Vis i kart», og bestandene i oppdraget utheves i oransje
  - **Nytt oppdrag eller legg til:** velg type. Deretter fyller kart, tegning og liste samme utvalg (se «Velge tiltak til oppdrag» under Oppdrag).
  - **Endre:** fjern tiltak, rediger utfører, periode og merknad, og slett oppdraget. Tiltakene beholdes.
  - **Fra tiltakskortet:** «+ Legg i oppdrag» legger tiltaket i et aktivt oppdrag av samme type eller i et nytt. Merket «Oppdrag O-…» åpner oppdraget.
- **Tiltak:** liste over tiltak i år og neste år, senere tiltak og nylig utførte.
- **Offline:**
  - Service workeren lagrer appen, også Leaflet og bibliotekene, slik at begge versjonene åpner uten nett.
  - «Last ned kart for offline» lagrer Kartverkets topografiske kart for eiendommen (zoom 10–17). Flyfoto krever nett.
  - Registreringer og utførte tiltak lagres på telefonen uten nett. En prikk øverst viser nettstatus.
- **PWA:** egen manifestfil (`felt.webmanifest`) med PNG-ikoner og maskerbart ikon. Den kan installeres som «SkogIQ Felt», og har knapp for installering (Android/Chrome) eller veiledning for iPhone (Del → Legg til på Hjem-skjerm).
- **Sporlogg for utførte tiltak** (`js/sporlogg.js`, `js/sporlogg-ui.js`):
  - **Opptak:** trykk «Sporlogg», velg tiltak og arbeidsbredde, og gå over området mens tiltaket utføres. Standardbredden er for eksempel ungskogpleie 8 m, planting 5 m, markberedning 4 m og hogst med maskin 20 m.
  - **Under opptaket:** unøyaktige punkter, stillestående GPS-støy og urealistiske hopp filtreres bort. Skjermen holdes våken (Wake Lock). Opptaket kan pauses, og det lagres fortløpende, så det kan fortsettes etter omlasting.
  - **Ved Stopp:** sporet × bredde blir en dekningsflate (polygon-clipping i UTM 33), som klippes mot bestandene. Hvert bestand får areal og andel, og tre mulige forslag:
    - et planlagt tiltak av samme type (±3 år) markeres utført
    - et utført tiltak av samme type samme år slås sammen (flatene slås sammen, overlapp telles ikke dobbelt)
    - ellers lages et nytt utført tiltak
  - **Justering:** tiltak, bredde og dato kan endres før lagring. Under 0,1 daa i et bestand er ikke valgt. Over 50 % kan registreres som hele bestandet.
  - **Lagring:** tiltaket får `arealDaa`, `dekning` (GeoJSON) og `sporIder`. Sporet lagres i `plan.sporlogger`. Fullversjonen bruker arealet i økonomi og tiltakslister, og dekningen vises i feltkartet.
  - **Glemte du å starte sporloggen?** Velg «Tegn spor» eller «Tegn område» i Sporlogg:
    - Med «Tegn spor» trykker du punkter i kartet langs der du gikk, og linjen får arbeidsbredden.
    - Med «Tegn område» trykker du rundt flaten som ble behandlet, og polygonet blir dekningen.
    - Angre fjerner siste punkt, og Avbryt forkaster tegningen.
    - Datoen kan settes tilbake i tid før lagring.
    - Videre går det som med et GPS-spor: planlagt → utført, sammenslåing og nytt tiltak. Sporet lagres med kilde «tegnet».
  - **GPX:** nettlesere kan stoppe GPS når skjermen låses. Spor fra en annen app eller klokke kan derfor leses inn som GPX og behandles likt. Sporet kan også lastes ned som GPX.
- **Fullversjonen:** den har lenke til mobilversjonen i Felt-fanen, i Planer på mobil og i kommandopaletten. Fullversjonens manifest har snarveien «Felt».
- **Start i mobilversjonen:** dette kan slås på under «Mer». `./?full` åpner alltid fullversjonen.
- **Test:** testene sjekker at alle moduler som importeres fra `app.js` og `felt-app.js` ligger i service workerens liste. Ellers ville offline-støtten bryte uten at noen merket det.

## Virtuell skog – gå rundt i skogen, også med VR-briller (beta, fullversjonen)

Åpne et bestand og trykk **🥽 Gå inn i skogen**. Du står da i bestandet og kan gå rundt i skogen rundt deg, inn i nabobestandene. Dataene ligger i `js/skog3d-data.js` og visningen i `js/skog3d.js`. Visningen bruker Three.js 0.160 og WebXR.

**Trærne bygges av dataene i planen:**
- **Treslag og blanding:** grandominert skog er 85 % gran, 10 % lauv og 5 % furu. Furu og lauv har tilsvarende blandinger.
- **Høyde:** registrert høyde, middelhøyde eller høydekurven, med ±25 % variasjon mellom trærne.
- **Treantall:**
  - HK II: fra ungskogfeltene eller treantallsmodellen, med høyde bar og lauv hver for seg.
  - HK III–V: fra takst eller SR16. Mangler tallet, brukes standardtall som justeres mot volumet og tetthetsklasse b.
- **Tremodellene** ligger i `js/skog3d-traer.js`. Hver art har tre varianter med ulik form og fargevariasjon:
  - **Gran:** seks greinkranser i lag med ujevne, litt hengende kanter og spiss topp, i mørk blågrønn. Kronen går helt ned i ung skog og blir kortere med alderen og tettheten.
  - **Furu:** gråbrun stamme nederst og rødoransje øverst. Kronen er flat og klumpete, høyt oppe, med synlige greiner.
  - **Bjørk:** hvit stamme med svarte flekker og mørk, sprukket bark nederst. Kronen er luftig og lys gulgrønn, laget av mange klumper og tynne greiner.
- **Nivå av detaljer:** Trær nærmere enn 60 m (45 m i VR) får den detaljerte modellen, og trær lenger unna får enkle former. Fordelingen oppdateres når du har gått mer enn 6 m. Det er en åpning på 2–3 m rundt startpunktet, så du ikke starter inne i en krone.
- **Hogstflate (HK I):** livsløpstrær, eventuelt plantede småplanter og lauvoppslag.
- **Plassering:** Trærne står tilfeldig, men fast for hvert bestand, innenfor bestandsgrensen. Grensene vises som gule linjer på bakken.
- **Bakkevegetasjon etter vegetasjonstypen** (`js/skog3d-veg.js` og `js/skog3d-bunn.js`):
  - Bakkefargen følger bunnsjiktet: lys lav, brun lyng, grønn mose, gulgrønn torvmose, eng eller stein.
  - Feltsjiktet har egne modeller for lav, røsslyng, blåbær (med bær), tyttebær (med røde bær), mose, torvmose, gras, starr, urter med blomster, bregner, høgstauder, einer og stein. Tetthet (per m²) og høyde følger typen:
    - **Lav- og lyngfuruskog (6a):** reinlav, lyng, tyttebær, einer og stein.
    - **Blåbærskog (7b, 6b, 4b):** tett blåbærlyng og mose, litt tyttebær, bregner og gras.
    - **Småbregne- og storbregneskog, lågurtskog (7c, 6c, 4c, 5a):** gras, urter og bregner.
    - **Høgstaudeskog (5b, 4e, 4f, 3b, 8d):** høgstauder og store bregner.
    - **Kalkskog (6d, 4d):** urter og gras.
    - **Fuktskog, myr og sump (8a, 8b, 9a, 8c, 9c–9e):** torvmose, starr og lyng.
    - **Fjell og annen mark:** lavhei, rishei, grasmark og ur.
  - Mangler vegetasjonstypen, anslås den av treslag og bonitet, og HUD-en viser «(anslått)". Låg bonitet gir lyng- eller lavtype, middels gir blåbærtype og høy gir småbregnetype.
  - **Lys:** Hogstflater får mer gras og urter. Tett ungskog (over 600 trær/daa) har 45 % av feltsjiktet, og tett granskog har 60 %.
  - Plantene lages i ruter på 5 × 5 m innen 35 m fra deg (25 m i VR), med høyst 30 000 planter. Små planter vises bare innen 16 m, og rutene bygges på nytt når du har gått 6 m. Plantene står i flekker og er faste for hvert bestand.
- **Antall og terreng:** Det er høyst ca. 30 000 trær. Radiusen (opptil 250 m) krymper i tett ungskog. Terrenget hentes fra Kartverket (DTM1) med et punkt for omtrent hver 12. meter, høyst 41 × 41 punkter. Da kommer koller, søkk og bekkedaler fram. Uten nett blir det flatt.
- **Omgivelser** (`js/skog3d-omgivelser.js` for data og `js/skog3d-objekter.js` for 3D). Alt hentes direkte fra åpne tjenester, samtidig med terrenget. Hver kilde kan feile eller bruke for lang tid (over 25 s) uten at resten stopper:

  | Hva | Kilde | Slik ser det ut |
  |---|---|---|
  | Veier | Planens veiregister og NVDB vegnett (Statens vegvesen), også private veier og skogsbilveier | Asfalt med kantlinjer (E-, R-, F- og K-vei), grusvei med grøftekant, og traktorvei med to hjulspor. Bredden følger vegkategori og -klasse. |
  | Stier | Kartverkets turrutebase (Fotrute, AnnenRute) | Brun sti på 0,7 m. Ruter som følger traktorvei, vises som traktorvei. |
  | Bekker og elver | NVE Elvenett (ELVIS) | Blank vannstripe på 1,4 m (elver med navn 4 m) med mørk kant |
  | Innsjøer | NVE Innsjødatabasen, ellers AR5 vann | Flat, blank vannflate i strandhøyden |
  | Bygninger | Matrikkelen bygningspunkt (Kartverket) | Mål og farge etter bygningstype: bolig, fritidsbolig, koie, garasje/uthus, låve/fjøs, naust, veksthus, industri og næring. Saltak, grunnmur, vinduer med karm og dør, og port på låver. Bygningene vris etter nærmeste vei, og du kan ikke gå gjennom veggene. |
  | Markslag | NIBIO AR5 for hele området, også utenfor eiendommen | Jordbruk blir eng og beite, bebygd blir plen, åpen fastmark blir lyng og ris, og samferdsel blir grus. |
  | Skog utenfor planen | AR5 produktiv skog, impediment og myr | Generelle trær etter AR5-treslag og -bonitet. Impediment og myr får glissen, lav furu. Infoboksen sier at trærne er et anslag. |
  | Eiendomsgrense | Planens eiendomsgrense | Rød stripe på bakken, og grensemerker (rødmalt stake med steinrøys) i knekkpunktene, høyst ett per 10 m |

  - **Trær og planter** står ikke på veier, stier, i vann eller ved bygninger.
  - **Infoboksen** viser hva du står på: bestand, markslag fra AR5, eller skog utenfor planen. Den viser også veinavn når du står på en vei, og om du er ved vann eller en bygning.
  - **Demoeiendommen** har nå en eiendomsgrense. Den ligger på et ekte sted i Løten, så veier, bygninger og markslag rundt er ekte.

**Ungskogpleie og framtidsskog (HK II):** Når du står i et bestand i hogstklasse II, kommer valget **🌲 Ungskogpleie** fram: **I dag**, **✂️ Merket: hva fjernes**, **Etter pleie**, **Hogstmoden med ungskogpleie** eller **Hogstmoden uten pleie**. Bytt med F på tastaturet, eller med A (neste) og B (i dag) på høyre kontroller i VR. I VR vises valget på en tavle foran deg.
  - **Arbeidsinstruks i skogen** (`ungskogpleieVisning` i `js/skog3d-data.js`), etter instruksen «friske og vitale bartrær – rett treslag, rett tetthet og god kvalitet»:
    - **Merket:** ungskogen før tiltaket, med kratt og oppslag. Grønne trær er framtidstrær som beholdes, røde fjernes (lauv og kratt som konkurrerer med bartrærne, og overtallige bartrær), og gule er ROS-trær (rogn, osp og selje, 3 per daa) som beholdes.
    - **Etter pleie:** målet for treslag og bonitet står igjen (f.eks. 150–180 trær/daa) med jevn avstand. ROS-trærne står igjen, og det står stubber etter det som er fjernet. Er det for få bartrær, beholdes de beste lauvtrærne for å nå målet.
    - **Infoboksen:** før og etter (treantall, treslag og høyde), avstand mellom trærne, hva som er fjernet og beholdt, areal, planlagt år (fra tiltaket i planen), kostnad per daa og for hele bestandet, og prinsippene for utførelsen.
- **Tallene** (hogstår, volum, pris og nåverdi per daa) kommer fra samme modell som effektvisningen i bestandet (`effektUngskogpleie`).
- **Infoboksen** viser begge alternativene og forskjellen i nåverdi, per daa og for hele bestandet.
- **Med pleie:** hogst etter omløpstiden. Ca. 38 % av måltettheten står igjen ved hogst (50–110 trær/daa), med ca. 10 % lauv. Trærne er 25 % grovere enn normalt og har lange, brede kroner. Bakken får mer lys.
- **Uten pleie:** hogst 5–8 år senere. Det står 130–260 trær/daa, og lauvandelen følger treantallsmodellen (40–70 % bar). Trærne er tynne, med korte og smale kroner, og 8 % lavere høyde. I tillegg kommer et undertrykt sjikt, og bakken får mindre lys.
- **Høyden** ved hogst tas fra høydekurven (bonitet og alder). Bare det valgte bestandet endres. Resten av skogen er som i dag.

**Vær i skogen (🌦 Vær):** Velg værtype og tid på døgnet. Du kan bytte med V på tastaturet, eller med X (neste vær) og Y (tid på døgnet) på venstre kontroller i VR. I brillene vises valget på tavla.
- **Dagens vær:**
  - Varselet hentes fra MET Locationforecast (det samme som yr) for stedet: temperatur, skydekke, regn, sludd, snø, torden, tåke og vind. Nærmeste time til valgt tid brukes.
  - Snødybden hentes fra seNorge (NVE) gjennom serverens mellomledd `/api/nve`.
  - Uten nett vises overskyet vær.
- **Faste værtyper:** sol, overskyet, regn, snøvær (45 cm snø), tåke og tordenbyger.
- **Tid:** nå, midt på dagen, kveld (når sola står 3° over horisonten) eller natt. Solens høyde og retning regnes ut for stedet og tidspunktet.
- **Slik ser det ut** (`js/skog3d-vaer.js` for data og `js/skog3d-vaerlag.js` for effekter):
  - **Himmel og lys:** Fargen følger skydekke, tid på døgnet (med kvelds- og morgenrødt) og natt. Sola står riktig og er svakere når det er skyet. Lyset dempes fra dagslys ned mot månelys.
  - **Sikt:** Tåke og dis begrenser sikten, fra over 200 m i klarvær ned til 35 m i tett tåke. Regn og snø gir kortere sikt.
  - **Nedbør:** Regn og sludd faller som striper, og snø som fnugg som daler og driver med vinden. Nedbøren følger deg i en boks på 34 × 34 m.
  - **Torden:** Lynglimt med 6–20 sekunders mellomrom, og torden etter.
  - **Snø på bakken:** Bakken blir hvit etter snødybden. Planter forsvinner under snøen: mose og lav ved 10 cm, lyng og bær ved 25 cm, gras, urter og bregner ved 45 cm.
  - **Lyd:** Regn og vind (med vindkast) lages med støy i Web Audio, uten lydfiler. Lyden slås på første gang du velger vær og kan slås av.

**Styring:**
- **PC:** Klikk i bildet og se rundt med musa. Gå med W A S D eller piltastene, og hold Shift for å løpe.
- **Mobil og nettbrett:** Venstre halvdel av skjermen går, og høyre halvdel ser rundt.
- **VR:** Trykk **🥽 VR**. Knappen vises når nettleseren og brillene støtter WebXR, for eksempel Meta Quest-nettleseren. Venstre stikke går, med knapp for å løpe, og høyre stikke snur 30°.
- Øverst til venstre vises dataene for bestandet du står i: treslag, bonitet, hogstklasse med tetthet, alder, høyde, treantall og volum, og vegetasjonstypen.

Dette er en tolkning av dataene, ikke en skanning. Enkelttrær fra laserdata kan legges inn senere.

## AR i felt – grenser, stier, miljø og kulturminner i terrenget (beta, SkogIQ Felt)

Trykk AR-knappen i kartet (eller **Mer → 🥽 Start AR**). Det du trenger å se, legges over kamerabildet eller over virkeligheten i AR-briller. Koden ligger i `js/felt-ar.js` (visning) og `js/ar-data.js` (data, kan testes i Node).

**Dette vises:**

| Lag | Innhold | Slik ser det ut |
|---|---|---|
| Bestand | Bestandsgrenser og eiendomsgrense | Gult gjerde (1,1 m) med stolper og skilt med bestandsnummer, treslag/bonitet, hogstklasse og areal. Eiendomsgrensen er rød (1,8 m). |
| Stier og veier | Planens veiregister og Kartverkets turrutebase (merkede stier og traktorveier) | Stripe på bakken: grå skogsbilvei, brun traktorvei, oransje sti. Planlagte veier vises ikke. |
| Miljø | Planens miljødata (PEFC-fanen), og miljødata hentet for området rundt deg når du har nett: nøkkelbiotoper, naturtyper, verneområder, artsområder og friluftsområder | Lavt gjerde i farge etter type, med skilt |
| Kulturminner | Sikringssoner fra Riksantikvaren. De hentes først, så de kommer raskt. | Lilla gjerde rundt sikringssonen og en høy stang med skilt («ikke kjør over») |
| Registreringer | Feltregistreringer med posisjon | Blått skilt med kategori og tekst |

**Mens du går:**
- **Infoboksen** øverst viser bestandet du står i, GPS-nøyaktigheten og miljøflatene du er inne i. Den viser også de nærmeste skiltene med avstand, kompassretning og en pil i forhold til der du ser.
- **Varsel:** Rødt varsel når du står i sikringssonen til et kulturminne. Oransje varsel innen 15 m fra sonen og i nøkkelbiotoper, verneområder og artsområder.
- **Lagene** kan slås av og på hver for seg. Kompasskursen vises nederst.
- **Høyden** på grenser og skilt følger terrenget (Kartverkets høydedata) når du har nett. Uten nett regnes bakken som flat.

**Posisjon og retning:**
- **Telefon og nettbrett (iPhone og Android):**
  - Kamerabildet vises bak. Retningen kommer fra kompass og gyro, med misvisning på 4° øst, og posisjonen fra GPS med utjevning.
  - iPhone spør om tilgang til bevegelse og retning når du trykker på knappen.
  - Bommer grensene litt i retning (kompasset påvirkes av metall og magnetfelt), dreier du dem med ◀ ▶. Hvor mye du har justert, vises.
- **Briller (🥽 Briller):**
  - WebXR «immersive-ar» i Meta Quest 3/3S med gjennomsyn, og på Android-telefoner med ARCore.
  - Brillene sporer bevegelsen selv. Ved start legges kartet der GPS-en sier du er, og dreies etter kompasset.
  - GPS-målinger med nøyaktighet bedre enn 15 m drar grensene sakte på plass over tid.
  - Har brillene ikke GPS og kompass (Quest), brukes midten av kartet som startpunkt. Høyre stikke dreier grensene, og venstre stikke flytter dem til de stemmer med terrenget.
- **Uten nett:** Plandataene og 3D-biblioteket ligger i bufferen etter første bruk. Miljødata hentet for området utenfor planen, terreng og turruter krever nett.
- **Nøyaktighet:** GPS i skog er ofte ±3–10 m, og grensene kan derfor ligge noen meter feil. AR er et hjelpemiddel og erstatter ikke oppmåling av eiendomsgrenser.

## Droneoppdrag – ortofoto med DJI Enterprise (beta, SkogIQ Felt)

Feltappen lager flyruter for ortofoto som åpnes i **DJI Pilot 2**. Logikken ligger i `js/drone.js` og skjermbildene i `js/drone-felt.js`.

1. **Område:** Velg «Mer → ✈ Droneoppdrag → Tegn nytt område», eller «✈ Droneoppdrag» på bestandskortet. Området klippes mot eiendommen og kan endres senere.
2. **Plan:** Velg drone, flyhøyde (40–120 m) og overlapp. Standard er 80/80, fordi tretopper er vanskelige å sette sammen i ortofoto. Velg også flyretning; automatisk gir færrest vendinger. Appen beregner:
   - **Flylinjer:** parallelle linjer fram og tilbake over området, med en halv bildelengde ekstra i hver ende.
   - **Avstander:** linjeavstand fra sideoverlappen og bildeavstand fra overlappen fram.
   - **Fart:** høyst 12 m/s og minst 1–2 s mellom bildene.
   - **Resultat:** GSD (cm/px), antall bilder, km, flytid og batterier.
   - **Kartet:** viser linjene og startpunktet.
3. **Terrengsjekk:** Appen henter høyder fra Kartverket (DTM1, `ws.geonorge.no/hoydedata`) i hjørnene og et rutenett. Ruten flyr med fast høyde over startpunktet, så appen advarer når terrenget stiger så mye at dronen kommer nær tretoppene. Råd: start fra et høyt punkt, eller bruk terrengfølging i DJI Pilot 2.
4. **Start:** Kryss av i sjekklisten for regelverket i Norge: operatørregistrering, kompetansebevis A1/A3 og A2, luftrom (Ninox/Avinor), verneområder, maks 120 m, synsvidde, varsling av grunneier, vær og batteri. Last deretter ned ruten:
   - **KMZ i DJI WPML-format:** `wpmz/template.kml` med en kartleggingsmal (`mapping2d`, med polygon, overlapp, høyde, retning, gimbal −90° og høydeoptimalisering) og `wpmz/waylines.wpml` med veipunkter og fotografering med fast avstand (`multipleDistance` og `takePhoto`).
   - **KML:** bare området, for andre programmer.
   - **Del:** «Del …» bruker telefonens delingsmeny.
5. **I DJI Pilot 2:** Velg **Ruter → Importer rute**, kontroller ruten og trykk **Start**. Enklest er å åpne SkogIQ Felt i nettleseren på fjernkontrollen (RC Plus / RC Pro Enterprise). Du kan også overføre filen med USB, minnekort eller FlightHub 2.
6. Til slutt merker du oppdraget som flydd. Ortofotoet lages i DJI Terra, Pix4D, Metashape eller WebODM. Opplasting til SkogIQ kommer senere.

**Send til kontrolleren (uten kabel):**
- **Koble til én gang:** Åpne **/k** (`kontroller.html`) i nettleseren på DJI-fjernkontrolleren (RC Plus / RC Pro Enterprise, Android). Siden viser en kode på 6 tegn. Skriv koden inn i SkogIQ Felt på telefonen under «Start oppdraget → Send til kontrolleren». Kontrolleren husker koblingen, så neste gang trykker du bare **📡 Send til kontrolleren**.
- **Mottak:** Kontrollersiden henter nye oppdrag hvert 5. sekund og viser areal, høyde, GSD, flytid, batterier og bilder. Trykk **⬇ Last ned rute**. Deretter velger du i DJI Pilot 2 **Ruter → Importer rute → Nedlastinger**.
- **Status tilbake:** «Importert» og «Flydd» på kontrolleren vises på telefonen, og «Flydd» merker oppdraget i SkogIQ.
- **Teknisk:** Serveren (`kontroller-relay.js`) er et mellomlager for overføring:
  - Kontrolleren identifiseres med en hemmelig id på 128 bit. Koden gjelder i 15 minutter og kan brukes én gang.
  - En rute kan være opptil 3 MB, og hver kontroller kan ha 30 oppdrag. Oppdrag slettes etter 14 dager.
  - Data ligger i minnet, eller i fil når `KONTROLLER_FIL` er satt. Starter serveren på nytt uten fil, må kontrolleren kobles til på nytt.
  - API: `POST /api/kontroller`, `POST /api/kobling`, `GET|POST /api/kontroller/{id}/oppdrag`, `GET …/{oid}.kmz`, `POST …/{oid}/status`, `DELETE …/{oid}`. CORS er åpnet for Railway-domenet, GitHub Pages og localhost.
- **Planlagt app på kontrolleren:** En egen Android-app med DJI Mobile SDK v5 kan laste ruten rett inn i dronen og starte med ett trykk. Det krever en app-nøkkel fra DJI-utviklerkontoen og må testes på drone. Appen kan bruke det samme API-et.

**Støttede droner** (kodene fra WPML): Mavic 3 Enterprise, Multispectral og Thermal, Matrice 3D, M30 og M350 RTK med H20. Kameraparametrene (sensor, oppløsning, brennvidde) ligger i `DRONER`. Zenmuse P1/L2 og Matrice 4E mangler i WPML-dokumentasjonen og er ikke med ennå.

**Beta:** Ruten er laget etter DJIs offentlige WPML-spesifikasjon, men er ikke testet på alle droner og fastvareversjoner. DJI Pilot 2 kan regenerere linjene fra malen. Kontroller alltid ruten i Pilot 2 før du flyr.

## Flere eiendommer i kartet (fanen «Planer»)

Andre skogbruksplaner kan vises i kartet sammen med planen som er åpen (`js/flere-eiendommer.js`).

- Kryss av «I kartet» for hver plan under «Mine skogbruksplaner», eller bruk «Vis alle», «Skjul andre» og «Zoom til alle». Valget huskes i nettleseren.
- Hver eiendom får egen farge på den stiplede grensen og en navnelapp. Bestandene er farget etter hogstklasse og ligger under den åpne planen. Den åpne planen har fortsatt rød stiplet grense.
- Klikk på en annen eiendom for å se areal, antall bestand, volum og hogstmoden skog, med knapper for «Åpne planen» og «Skjul».
- Laget heter «Andre eiendommer (mine planer)» i lagvelgeren, og eiendommene vises i tegnforklaringen. Kommandopaletten har «Vis alle eiendommene mine i kartet».

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
- **Prinsipper:** «balansert», «økonomi først» (mer flatehogst, større rom for tidlig hogst), «biologi og miljø først» (mer lukket hogst, 10 år lengre omløp, avvirkning under tilveksten) og «karbon og klima» (se Karbon under). Bestand i et aktivt karbonprosjekt får alltid karbonreglene.
- **Begrunnelse:** hvert tiltak har en begrunnelse og kilder («Hvorfor?») og er merket som automatisk. Manuelle tiltak endres aldri.
- **Endringer:** når et bestand endres (alder, volum, høyde, treantall, treslag, bonitet, areal eller utførte tiltak), varsler appen i bestandsdetaljen, i Tiltak-fanen og under Innsikt. Du kan oppdatere tiltakene med ett klikk eller beholde dem som de er.
- **Lukket hogst** er en egen tiltakstype. Den er med i framskriving, økonomi, hogstprognose, verdiberegning og PEFC-klarering.

## Karbon – karbonkreditter fra skogen (fanen «Karbon»)

`js/karbon.js` og `js/karbon-ui.js` viser hva skogen kan gi av karbonkreditter, hva som må til, og følger opp et prosjekt. Alle standarder for forbedret skogforvaltning (IFM) gir kreditter bare for karbon som lagres **utover en referansebane**, etter fradrag for lekkasje og usikkerhet, og med en bufferandel mot tap.

- **Scenario:** tiltaksmotoren lager to baner for de samme bestandene. Referansen er vanlig drift (prinsippet «balansert», kan endres), og prosjektbanen er karbonforvaltning eller tiltaksplanen slik den er. Begge simuleres med framskrivingen, og lageret regnes ved inngangen av hvert år.
- **Lager:** levende biomasse over og under bakken. Gran 1,17, furu 1,15 og lauv 1,40 t CO₂ per m³ stammevolum (basisdensitet fra IPCC 2006 × 0,5 karbon × 44/12 × ekspansjon 1,5–1,6 til hele treet). Dødt trevirke, jord og treprodukter er holdt utenfor, som er konservativt.
- **Kreditter:** økning i merlageret × (1 − lekkasje) × (1 − usikkerhet), minus bufferandelen.
  - Lekkasje følger VM0045: 10, 20, 40 eller 70 %.
  - Usikkerhetsfradraget er halvbredden av 95 %-intervallet fra antall prøveflater minus 15 prosentpoeng (VM0045), men minst 10 % (CRCF).
  - Faller merlageret senere i perioden, vises det som reversering.
- **Økonomi:** nåverdi av tapt tømmerinntekt mot karboninntekt. Appen viser også karbonprisen der karbonforvaltning lønner seg. Den regner både med gruppeprosjekt (80 % til skogeier) og med eget prosjekt (kostnader til validering og verifisering).
- **Egnethet:** en sjekkliste for areal, datagrunnlag, eldre skog, vernede bestand, PEFC, torv, stormrisiko, tilskudd og prøveflater. Juridiske punkter, avtalepartner, statlige tilskudd og dobbelttelling bekrefter skogeier selv.
- **Karbon og klima (tiltaksmotoren):**
  - 20 år lengre omløp, med avvirkning under 60 % av tilveksten.
  - Lukket hogst på organisk jord (vegetasjonstype 8b–8d).
  - Plantetall i øvre del av tilrådd intervall med foredlede planter.
  - Tynning bare på god bonitet.
  - Gjødsling ca. 10 år før hogst. Teksten advarer om at klimatilskudd gjør tiltaket ikke-addisjonelt.
  - Stormutsatt skog hogges fortsatt i tide for å unngå tap.
- **Prosjekt:** status (vurdering → forberedelse → validering → registrert → overvåking → avsluttet), standard, partner, bestand (uthevet i kartet) og «Legg karbontiltakene inn i planen». Appen varsler om hogst i prosjektbestand som ikke er med i karbonbanen, tiltak med tilskudd og forfalt verifisering. Varslene vises i fanen og under Innsikt.
- **Oppfølging:** verifiseringer (verifisert, buffer, utstedt, solgt, pris) og hendelser med tap, med kryss for om de er meldt. Prosjektbeskrivelsen kan skrives ut som utkast til partner eller validering.
- **Status i oktober 2026** (kildene ligger i appen):
  - **EU CRCF:** Metoder er vedtatt for nyplanting, torvmark og landbruk, men ikke for forlenget omløp. Ordningen er ikke tatt inn i EØS-avtalen.
  - **Verra VM0045:** Versjon 1.2 har bare vedlegg for USA. Versjon 1.3 for nasjonale skogtakster (også Norge) var på høring i 2026.
  - **Nordiske gruppeprosjekter:** Aktører som Noora og Arbonics bruker utsatt hogst, ca. 40 års avtaler og 80/20-deling.
  - **Landbruksdirektoratet (2025):** PEFC omfatter ikke kreditter. Avtaler kan kreve delingssamtykke, konsesjon eller være en servitutt. Karboninntekt kan ikke settes på skogfond.
  - **Dobbelttelling:** Uten tilsvarende justering fra staten er kreditten et bidrag, ikke kompensasjon.

## KSL – Kvalitetssystem i landbruket (fanen «KSL»)

Modulen dekker dokumentasjonskravene i KSL-standarden fra Stiftelsen Norsk Mat for gården.

- **Sjekklister:** Disse er hentet fra de offisielle PDF-ene (`js/ksl-standard.js`).
  - Kapittel 1 *Generelle krav til gården* (versjon 2026.8): 44 spørsmål, hvorav 19 krever dokumentasjon.
  - Kapittel 10 *Helse, miljø og sikkerhet* (versjon 2026.9): 56 spørsmål, hvorav 18 krever dokumentasjon.
  - Kapittel 15 *Grovfôr, korn, frø, olje- og belgvekster* (versjon 2024.4): 4 spørsmål. Kapittelet velges automatisk når gården har skifter.
  - Dokumentasjonssymbolet er lest ut av PDF-ene. «Hva kreves» viser et utdrag av «For å oppfylle dette kravet må du».
- **Egenrevisjon per år:** Hvert spørsmål besvares Ja, Nei eller Ikke aktuelt, med kommentar.
  - «Nei» oppretter et avvik med frist om én måned.
  - «Fullfør egenrevisjon» krever at alle spørsmål er besvart, og registrerer revisjonen som en kontroll. Neste revisjon forfaller etter 12 måneder.
- **Dokumentasjon fra planen** (`appBevis`) vises ved hvert punkt med status ✓, ◐ eller ✕:
  - skifteregistrering (1.1.3)
  - jordprøver maks 8 år (1.2.1)
  - gjødslingsplan med skiftekart (1.2.2)
  - gjødseljournal (1.2.3)
  - spredetidspunkt for husdyrgjødsel (1.3.2)
  - sprøytejournal og IPV (1.5.4)
  - behandlingsfrist (1.5.8)
  - kulturminner fra Riksantikvaren (1.10.1)
  - avstand fra skifte til vann (1.10.2)
  - kontrollene nedenfor
- **Avvik:** avvik, tiltak, ansvarlig, frist og lukking (10.1.2).
- **Periodiske kontroller med frister:** vernerunde, el-egenkontroll, termografering (3 år), brannalarm (månedlig og årlig), brannslokkingsutstyr, tanker, gjødsellager, funksjonstest av sprøyte (3 år), sakkyndig kontroll, autorisasjon for plantevernmidler (10 år), varme arbeider (5 år), HMS-opplæring og førstehjelp.
- **Dokumentarkiv:** dokumenttyper som er koblet til KSL-punkter, med gyldighet. Filer (PDF, bilder, maks 15 MB) lagres lokalt i nettleseren (IndexedDB, nøkkel `fil:<id>`) og følger ikke med i sikkerhetskopien.
- **Innsikt** varsler om forfalt egenrevisjon, avvik og kontroller, og om punkter som mangler dokumentasjon.
- **KSL-mappe:** en utskrift med status, alle spørsmål med svar og dokumentasjon, avvik, kontroller og dokumentliste.
- **Begrensninger:**
  - Husdyr-, potet- og hagebrukskapitlene er ikke med.
  - Egenrevisjonen må fortsatt registreres på ksl.no.

## Oppdrag (Tiltak → Oppdrag)

Planlagte tiltak kan samles til **oppdrag** og sendes til en utfører, for eksempel en hogstentreprenør, et plantelag eller en veientreprenør.

- **Lage oppdrag:**
  1. Trykk «Velg til oppdrag» i Tiltaksplan og kryss av ett eller flere tiltak. «Velg alle synlige» tar med alt i gjeldende filter.
  2. Trykk «Lag oppdrag». Velger du flere tiltakstyper, lages ett oppdrag per type.
  3. Oppdragene nummereres O-år-løpenummer, for eksempel O-2026-01.
  - Et tiltak kan bare ligge i ett aktivt oppdrag (utkast, bestilt eller pågår). Utførte tiltak kan ikke velges.
- **Velge tiltak til oppdrag** (felles logikk i `js/oppdrag-utvalg.js` for Felt og fullversjonen). Tre innganger fyller samme utvalg:
  - **Trykk på bestand i kartet.** Har bestandet et ledig planlagt tiltak av typen, velges det. Ellers lages et nytt tiltak for hele bestandet. Et nytt trykk tar bestandet ut igjen, og et tiltak som ble laget i utvalget, slettes da.
  - **«✎ Tegn flate»** når bare en del skal med. Flaten kan gå over flere bestand og deles på dem. Hvert bestand får tiltaket med sin del av flaten og arealet, eller hele bestandet når over 95 % er dekket. Biter under 0,1 daa tas ikke med. Et eksisterende planlagt tiltak gjenbrukes, så det blir aldri dobbelttiltak.
  - **Listen** med avkryssing, som før.
  - Bestand med ledige tiltak av typen er stiplet oransje i kartet, og valgte bestand er fylt oransje. En linje viser antall bestand, areal og anslått kostnad. Bestand der tiltaket allerede ligger i et annet aktivt oppdrag, kan ikke velges.
  - «↶ Angre» tar ett steg tilbake. «Avbryt» fjerner nye tiltak og tegnede flater fra utvalget. Først «Lag oppdrag» gjør endringene varige.
  - I fullversjonen velger du typen i valglinjen («Velg i kartet») etter «Velg til oppdrag». I Felt er kartet standardvisning, og «☰ Liste» viser alle planlagte tiltak.
  - Oppdragets areal er summen av tiltakenes areal (tegnet del eller hele bestandet).
- **Én oppdragstype per tiltakstype** (`OPPDRAGSTYPER` i `js/oppdrag.js`), med egne felt og egen sjekkliste:
  - Sluttavvirkning, tynning og lukket hogst har felt for tømmerkjøper, driftsmetode, sortiment, velteplass, uttak og foryngelse.
  - Planting og suppleringsplanting har felt for treslag, plantetall, proveniens og plantetype.
  - Markberedning, ungskogpleie, stammekvisting, gjødsling, grøfterensk, vei, miljøtiltak og annet har hvert sitt sett med felt.
  - Sjekklistene viser til kravpunktene i Norsk PEFC Skogstandard, for eksempel nøkkelbiotoper (22), vannbeskyttelse (27), livsløpstrær (13), kulturminner (30) og terrengtransport (14).
- **Oppfølging:**
  - Hvert oppdrag har status (utkast, bestilt, pågår, utført eller avbrutt), utfører med kontaktinfo, oppstart og frist, og instruks.
  - Oppdraget viser areal, volum og plantetall, og estimert netto.
  - Når status settes til *utført*, kan alle tiltakene i oppdraget markeres som utført, og bestandene oppdateres som ved enkelttiltak.
  - Tiltak i et oppdrag får et merke med oppdragsnummer og status i tiltakslisten. Bestandene i oppdraget som er åpent, utheves med oransje i kartet.
- **Arbeidsordre:** «Skriv ut arbeidsordre» lager en side for utskrift eller PDF. Den har utfører, periode og omfang, de oppdragsspesifikke feltene og instruksen. Den har også kart med bestandene i oppdraget, bilvei, traktorvei, sti og velteplasser, en bestandstabell, sjekklisten og felt for kvittering.

## Takst eller SR16 – urørt eller endret siden taksten?

Når en plan lages fra gårds- og bruksnummer, vurderes hvert bestand fra den gamle skogbruksplanen (`js/generator.js`, steg 5a).
- **Taksten** gir grenser, alder i takståret, bonitet, treslag og hogstklasse, men ikke volum. NIBIOs `alder_korr` er alderen skrevet fram til i dag.
- **SR16** gir volum, høyde, treantall og alder i målingsåret. Medianen for eiendommen brukes.

**Er SR16 målt etter taksten, sammenlignes SR16 med det bestandet skulle vært i målingsåret.** Planens alder skrives fram til målingsåret, og høydekurven gir forventet høyde.

- **Urørt siden taksten:** Grenser, alder og bonitet kommer fra taksten, og alderen skrives fram til i dag. Volumet fra SR16 gjelder målingsåret og skrives fram til i dag med vekstmodellen, sammen med alderen. Tilveksten følger av dette.
- **Gjort noe med siden taksten:** Beregningen skjer fra SR16. Alder, treslag og volum i målingsåret skrives fram til i dag.
  - **Hogd:** Under 3 m³/daa og få eller lave trær, mot HK IV–V i taksten. Bestandet beregnes fra SR16-året, og det står at foryngelsen må kontrolleres i felt.
  - **Hogd og forynget:** SR16-høyden er under halvparten av forventet høyde, der forventet høyde er over 8 m. Alderen tas fra SR16 og kontrolleres mot høyden.
- **Bare en del er hogd:** Er minst 2 daa og 15–70 % av bestandet hogstflate i SR16, skilles den delen ut. Den hogde delen blir eget bestand (12b, beregnet fra SR16), og resten er urørt (12a). Er over 70 % hogd, beregnes hele bestandet fra SR16.
- **Frøtrær over ungskog:** I ungskog fra taksten (HK I–II) viser SR16 ofte 9–13 m høyde, men bare 5–8 m³/daa. SR16 måler de høyeste trærne over 5 cm, og det tyder på frø- eller livsløpstrær. Taksten beholdes, og bestandet får en merknad.
- **SR16 eldre enn taksten:** Taksten gjelder. Volumet fra SR16 skrives fram fra målingsåret.
- **SR16-flater utenfor taksten:** Disse beregnes fra SR16 og skrives fram. Avviker SR16-alderen mye fra høyden og boniteten, brukes alderen fra høyden.
- **Vekstmodellen:**
  - Ligger volumet langt over kurven for alderen (over 1,5 ganger), følges kurven fra punktet med samme volum. Det hindrer urimelig høy tilvekst når alderen er for lav.
  - I svært ung skog legges veksten langs kurven til det målte volumet.
- **Eksempel Nannestad 29/2** (takst 2013, SR16 2013–2015, median 2015):
  - 69 bestand er urørt, og 11 er gjort noe med (hogd, eller hogd og forynget). To av dem er delvis hogde bestand der den hogde delen er skilt ut.
  - Stående volum i dag er 17 946 m³, mot 11 937 da 2015-volumet ble brukt som dagens. Tilveksten er 689 m³/år (0,60 m³/daa).
  - 27 ungskogbestand har merknad om frøtrær.

## Markslag og uproduktiv mark (AR5)

Når planen lages, hentes markslag fra NIBIOs arealressurskart AR5 (`js/markslag.js`).

- **Henting:** AR5 hentes som vektorfliser (MVT) i ruter på 2 × 2 km. Hver flis har geometrien klippet til ruten, med id og alle attributter, og svarer på omtrent ett sekund. Biter av samme flate fra flere ruter slås sammen. Leverer ikke NIBIO vektorfliser, brukes KML som før.
  - **Hvorfor:** KML-utskriften sender hver flate uklippet. Store flater (f.eks. Randsfjorden, ca. 125 000 punkter) gjorde hver kartrute i nærheten flere MB stor og over ett minutt treg, og innlesingen stoppet opp (Gran 125/2).

- **Kategorier:**
  - produktiv skog (skogbonitet lav–særs høy)
  - uproduktiv skog (impediment) og myr
- **Myr:** Hadde forrige takst skog der (et bestand), følges taksten, og den delen regnes som skog. Bestandet får merknaden «AR5 viser myr her, men forrige takst hadde skog her». Der taksten ikke hadde skog, er det fortsatt myr, også om SR16 viser trær. Dekker taksten bare en del av myrfiguren, er resten fortsatt myr. Det gjelder også skogkledd myr med produktiv bonitet i AR5.
  - åpen fastmark, jordbruk, bebyggelse, samferdsel, vann og snø/is
- **Ingen volum på uproduktiv mark:** alt som ikke er produktiv skog, trekkes ut av bestandene før volum beregnes. Merknaden på bestandet sier hvor mye som er trukket ut.
- **Utdatert AR5 overstyres:** Mye av AR5 er feltkartlagt rundt 1990. Gjengrodd mark kan derfor fortsatt stå som impediment eller åpen fastmark (myr: se over). En slik figur regnes som produktiv skog når nyere data viser skog på minst halvparten av den, og trekkes da ikke ut av bestandene. Nyere data betyr enten SR16 med minst 5 m³/daa og bonitet 8 eller høyere, eller en skogbruksplan registrert etter AR5-kartleggingen. Bestandet får en merknad om hvorfor, og loggen viser antall figurer og areal.
- **Kantsoner og hull ved grensene:** SR16-flatene følger ikke grensene i den gamle planen og eiendommen nøyaktig. Det gir smale striper og flekker uten data. Etter at bestandene er satt sammen, ryddes dette opp (`ryddKanterOgHull` i `js/generator.js`):
  - **Smale SR16-rester (kantsoner):** Har resten middelbredde under 15 m, eller er den under 2 daa og under 20 m bred, slås den sammen med nabobestandet den deler lengst grense med. Bestand fra den gamle planen foretrekkes. Grenser stripa bare mot åker, vei eller eiendomsgrensen, blir den markslagsfiguren *Kantsone* i stedet for et eget bestand.
  - **Hull i dekningen:** Dette er arealer innenfor eiendommen som verken er bestand eller markslag. Små eller smale flekker legges til naboen med lengst felles grense. Store og brede flater (minst 2 daa og 20 m middelbredde) blir et eget bestand. Treslag og bonitet hentes da fra AR5, og bestandet får en merknad om registrering i felt.
  - Loggen viser hvor mange kantsoner og hull som er behandlet. Eiendommen er da dekket av bestand og markslag.
- **Uproduktive figurer** lagres som U1, U2 … med AR5-treslag, grunnforhold og kartleggingsdato.
- **Kartsymboler:** myr (strek med tuster på blå bunn), impediment (prikker og små trær), åpen fastmark (prikker), jordbruk (skravur), bebygd (kryss), samferdsel (strek) og vann (bølger). Symbolene er med i tegnforklaringen og kan slås av i kartlagsmenyen.
- **Oversikt** viser arealfordelingen per markslag. For planer laget tidligere kan markslag hentes og trekkes ut av bestandene derfra.
- **Rapportene:** hovedtall har arealfordeling og kart med symboler. Bestandslisten har en liste over uproduktive arealer med summer per markslag. Begge finnes også i CSV.
- **Henting:** AR5-tjenesten tegner bare flater i stor målestokk og svarer 500 på ruter med mange flater. Hentingen bruker derfor ruter på maks 4 km og deler dem videre ved behov.
- **Flater med ugyldig geometri hos NIBIO:** Enkelte AR5-flater, oftest myrer, kan ikke skrives ut som KML. Da svarer tjenesten 500 for hver rute som inneholder dem, uansett størrelse, og alle de andre flatene i ruten forsvinner også. Dette skjedde blant annet for Flå 22/1. Ruter som fortsatt feiler ved 250 m, reddes slik:
  1. Egenskapsoppslaget (GetFeatureInfo) gir flatene i ruten med utstrekning.
  2. Hver flate som mangler, hentes med KML filtrert på `sl_sdeid` (`FILTER`), som gir hele flaten.
  3. Gir heller ikke det noe, hentes geometrien fra SVG-utskriften med samme filter (`svgTilGeometri`). Oppløsningen er opptil 4000 px over flatens utstrekning.
- **Fart for store eiendommer:** Rutene hos NIBIO (AR5, skogbruksplan, SR16 og MiS) hentes med opptil 6 samtidige kall (`begrens` i `js/markslag.js`), og resultatene settes sammen i fast rekkefølge. Hull i dekningen regnes rute for rute: eiendommen deles i kvadranter ned til ca. 400 m, og bare figurene som overlapper ruten trekkes fra, i én operasjon. Uproduktiv mark og planbestand trekkes også fra i én operasjon (`minusAlle`). For Flå 22/1 (11 455 daa, 12 teiger) gikk dette fra ca. 5,5 til under 2 minutter, med samme resultat.

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

## Maskin – John Deere og ISOBUS (Skifteplan › 🚜 Maskin)

Skifteplanen henger sammen med traktoren: data går ut til skjermen, og utført arbeid kommer tilbake til gjødseljournalen, sprøytejournalen, avlingen per skifte og KSL. Logikken ligger i `js/maskindata.js` (ingen DOM), grensesnittet i `js/maskin-ui.js` og mellomleddet til John Deere i `jd-relay.js`.

**Til traktoren** (John Deere Gen4/G5 og andre ISOBUS-terminaler):
- **Skiftegrenser** som Shapefile (WGS84), med kolonnene CLIENT, FARM og FIELD, slik at skjermen kan knytte dem til kunde, gård og skifte.
- **Kjørespor (AB-linjer)** langs den lengste siden av hvert skifte, forlenget over hele skiftet. Linjene kan vises i kartet. De gir mindre overlapp og færre hull.
- **Gjødselkart (Rx)** for en planlagt gjødsling, med kolonnene `RATE_KGHA` (kg/ha) og `RATE_DAA`.
  - Har skiftet avlingskart fra en tidligere høsting, deles det i soner for lav, middels og høy avling.
  - N justeres etter forventet avling i sonen med Gjødslingshåndbokas korreksjon (kg N per 100 kg avling), maks ±25 %.
  - Gjødsel flyttes dit avlingspotensialet er, uten at totalen øker.
- **ISOXML** (ISO 11783-10, `TASKDATA/TASKDATA.XML`) med kunde, gård, skifter (PFD/PLN), AB-linjer (GGP/GPN) og oppgaver med behandlingssoner (TSK/TZN/PDV, DDI 0006 i mg/m²).
- **Overføring:**
  1. **USB:** «Last ned til USB (ZIP)». Pakk ut på rota av en USB-pinne, slik at mappa `Rx` ligger øverst. På skjermen: Data Manager › Import Data. `LES_MEG.txt` i pakka forklarer stegene.
  2. **Trådløst:** «Send til Operations Center» legger ZIP-fila under Filer i organisasjonen. Derfra sendes den til skjermen med Data Sync eller «Send til maskin» (JDLink).

**Fra traktoren:**
- **Kilder:**
  - Shapefile-eksport fra Operations Center (ZIP, også deflate-komprimert), som punkter eller flater.
  - ISOXML TASKDATA med tidslogger (`TLG*.XML/BIN`, DDI 1/2/6/7).
  - Henting rett fra Operations Center (Field Operations → Shapefile, metrisk).
- **Gjenkjenning:** Kolonnene gjenkjennes automatisk (AppliedRate, Yld_Mass_Dry, Product, IsoTime …). Type og enhet kan overstyres før innlesing. UTM-filer (f.eks. EUREF89 UTM 32/33) regnes om.
- **Fordeling på skiftene:** Punktene fordeles på skiftene med snitt, dekning og overlapp.
  - **Gjødsling:** registreres som utført i gjødseljournalen. En planlagt gjødsling med samme produkt merkes utført med faktisk mengde og dato, og den planlagte mengden tas vare på. Produktet kjennes igjen fra navnet («YaraMila 22-3-10», «OPTI-KAS») og NPK leses fra navnet.
  - **Sprøyting:** går til sprøytejournalen med preparat og dose i ml/daa. Skadegjører, begrunnelse og karenstid fylles ut etterpå, og kontrollen varsler til det er gjort.
  - **Høsting:** gir registrert avling per skifte og et avlingskart i 20 m-ruter. Det brukes i neste års gjødselkart.
- **Duplikater:** Samme fil leses ikke inn to ganger.
- **KSL:** 1.1.3 (skifteregistrering), 1.2.3 (gjødseljournal) og 1.5.4 (sprøytejournal) dokumenteres fra maskindataene. KSL viser hvor mange registreringer som kom fra maskinen.

**Økonomi:** Gevinsten regnes ut per år, med egne priser for gjødsel, korn og sprøytemiddel:
- avvik fra gjødslingsplanen i kg og kroner
- overlapp i prosent og kroner, som viser verdien av seksjonskontroll og AB-linjer
- gjødsel flyttet med variabel gjødsling
- avling mot forventet i kroner
- antall journalføringer som ikke måtte føres for hånd

**Oppsett av John Deere Operations Center** (valgfritt; alt over fungerer også med filer):
1. Registrer en applikasjon på [developer.deere.com](https://developer.deere.com). Be om tilgang til Organizations, Fields, Field Operations og Files.
2. Legg inn Redirect URI `https://skogiq-production.up.railway.app/api/jd/callback`.
3. Sett miljøvariablene på Railway:
   - `JD_CLIENT_ID` og `JD_CLIENT_SECRET`
   - `JD_REDIRECT` (som over)
   - `JD_API`: `https://partnerapi.deere.com/platform` når appen er godkjent for produksjon. Standard er sandkassen `https://sandboxapi.deere.com/platform`.
   - `JD_FIL` (valgfri): husker tilkoblingene mellom omstarter.
4. I appen: Skifteplan › Maskin › «Koble til John Deere». Har appen ikke tilgang til organisasjonen ennå, sendes du til Deeres side for å gi tilgang og deretter tilbake.

Klienthemmeligheten og tokenene ligger bare på serveren. Nettleseren har en tilfeldig nøkkel som peker til tilkoblingen. Token fornyes automatisk med refresh token. Tilbake-adressen må være appens egen, så serveren kan ikke brukes til å videresende brukere til andre sider.

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

## Vegetasjonstype per bestand

Når en plan lages fra gårds- og bruksnummer, får hvert bestand en vegetasjonstype i steget «Vegetasjonstype per bestand». Typene følger NIBIOs system for vegetasjonskartlegging (Rekdal & Larsson 2005), for eksempel *7b Blåbærgranskog* eller *6a Lav- og lyngrik furuskog*.

- **Kartlagt (NIBIO vegetasjonskart):** WMS-tjenesten `vegetasjon` har lag `Vegetasjonstypar`, med geometri fra KML og egenskaper fra GetFeatureInfo (GML). Dekker kartet minst halvparten av bestandet, og utgjør skogtyper (gruppe 4–8) minst 25 % av det, brukes den dominerende skogtypen. Andelene og kartleggingsåret lagres. Er bestandet kartlagt som hei, myr eller beite (ofte eldre kartlegging eller grove figurer), anslås skogtypen i stedet, og det kartlagte vises som opplysning. Kartet er feltkartlagt, men dekker bare om lag 25 000 km², mest utmark og fjell.
- **Anslått der kartet mangler:** Typen anslås fra treslag og bonitet (H40):
  - Gran: ≤ G8 gir 7a, G11–14 gir 7b og fra G17 gir 7c.
  - Furu og lauv følger samme inndeling, med 6a–6c og 4a–4c.
  - Er minst halve bestandet *organiske jordlag* i AR5, blir det sumpskog: 8b, 8c eller 8d etter bonitet.
  - Detaljen viser grunnlaget og den tilsvarende Larsson-typen, for eksempel «G14 (blåbær-/småbregnetype)». Anslaget bør kontrolleres i felt.
- **Import og manuelt:** Felt som `VEGETASJONSTYPE`, `VEGTYPE` eller `SKOGTYPE` i importerte filer tolkes. Både «7b», «7b Blåbærgranskog» og «blåbær gran» forstås. Typen kan også velges i bestandsdetaljen. Manuelle og importerte typer overskrives ikke.
- **I appen:** Velg «Farge etter → Vegetasjonstype» for å se typene i kartet. Anslåtte bestand har stiplet kant. Typen er også med i GeoJSON-, SOSI- og CSV-eksporten (`VEGETASJONSTYPE`). For eldre planer kan typen hentes fra bestandsdetaljen med «Hent for planen».
- Modulen ligger i `js/vegetasjon.js`.

## Hogstklasse

Hogstklassen beregnes fra dagens alder, treslag og bonitet (H40) med nedre aldersgrenser per klasse (`HK_GRENSER` i
`js/model.js`). Hogstklasse V starter ved laveste hogstalder (innstillingene, 60–120 år for bartrær).

| H40 | 26 | 23 | 20 | 17 | 14 | 11 | 8 | 6 |
|---|---|---|---|---|---|---|---|---|
| Gran/furu III fra | 15 | 15 | 20 | 25 | 30 | 35 | 45 | 55 |
| Gran/furu IV fra | 35 | 40 | 45 | 55 | 60 | 70 | 75 | 85 |
| Gran/furu V fra | 60 | 60 | 70 | 80 | 90 | 100 | 110 | 120 |
| Lauv III / IV / V fra | 10/25/45 | 15/30/45 | 15/30/50 | 20/40/60 | 25/45/70 | 30/55/80 | 35/60/85 | 40/65/95 |

Grensene er kalibrert mot NIBIOs skogbruksplandata (2 790 takserte bestand i hogstklasse II–V): beregnet klasse er lik
takstmannens i 99,9 % av bestandene (før: 97,1 %), og stemmer med Landsskogtakseringen (III fra 15–55 år; G20: III 20, IV 45,
V 70).

**Hogstklasse I** er skog under fornying, altså areal som ennå ikke er tilfredsstillende forynget, uavhengig av alder ([SNL](https://snl.no/hogstklasser), SOSI `SP_HKL` 11/12). Et plantet eller tilstrekkelig naturlig forynget areal går over i hogstklasse II samme dag. Appen bestemmer det slik (`hogstklasseFor` og `foryngelse` i `js/model.js`):

- **Plantet eller supplert etter siste hogst:** HK II, også når alderen er 0.
- **Treantall mot minste plantetall i forskriften § 7:**
  - Grensene er gran 50/100/150 og furu 50/100/150 etter bonitet, og lauv 100.
  - Appen bruker treantall i ungskogfeltene eller fra takst. Ligger tallet under minimum, blir bestandet HK I. Ligger det på eller over, blir det HK II.
  - SR16 teller bare trær over 5 cm og brukes bare når det alene viser nok trær.
- **Hogd uten registrert foryngelse:** HK I, selv om alderen tilsier II.
- **Ellers:** alder under 3 år gir HK I.
- Registrert hogstklasse fra planen eller manuelt går alltid foran.

**Lite volum er ikke det samme som hogd.** Generatoren satte tidligere «Mulig hogd» og alder 0 når SR16 viste under 3 m³/daa mot HK IV–V i en eldre plan. I glissen fjellskog står det likevel mange trær over 5 cm og høy skog. På Flå 22/1 gjaldt det 22 bestand med 40–95 trær/daa og 6–11 m høyde. Nå avgjør SR16-treantallet:

- **Hogd:** under 30 trær/daa over 5 cm.
- **Hogd og forynget:** over 30 trær/daa, under 6 m høyde og SR16-alder under 30 år.
- **Glissen skog:** resten. Appen beholder alderen og hogstklassen og legger inn merknaden «Glissen skog … – ikke hogd».

Eldre genererte planer rettes automatisk når de åpnes. Alderen settes da til SR16-alderen, og appen gir beskjed om hvor mange bestand som er rettet.

- Bonitet som mangler i SR16 anslås fra AR5-skogbonitet (laveste H40 i klassen), ellers fra nærmeste nabobestand innenfor 300 m
  – med merknad på bestandet.
- Manuelt satt eller importert hogstklasse som ikke stemmer med alder og bonitet varsles på bestandet og under Innsikt.
- Når en plan åpnes et senere år, skrives alder og volum frem fra takståret med vekstmodellen (én gang, lagres).

### Tetthetsklasse (a/b)

Hogstklassen har en underklasse a/b, som i SOSI-standarden «Skogbruksplan – bestand» (`SP_HKL`: 11, 12, 21 … 52).

- **HK I:** a = tilfredsstillende ryddet, b = ikke tilfredsstillende ryddet.
- **HK II–V:** a = tilfredsstillende tetthet, b = mindre tilfredsstillende tetthet.

Visning:
- Klassen vises som «II a» i bestandet, bestandstabellen og rapportene, og som «2a/ G20» i kartetikettene.
- Bestandslisten (CSV) har en egen kolonne for tetthetsklasse.
- SOSI-eksporten skriver `TETTHETSKLASSE` og `SP_HKL`, men bare når klassen er registrert.

Hvor klassen kommer fra:
- **Import:**
  - Koden `SP_HKL` (for eksempel 22 = II b).
  - En hogstklasse som «2A», «II b» eller «2 B».
  - Et eget felt `TETTHETSKLASSE`.
- **Planfirmaenes SOSI-felt:** Appen kjenner igjen feltnavnene i standarden, også inne i gruppene. I tillegg til `SP_HKL` gjelder det:

  | Felt | Betydning |
  |---|---|
  | `SP_BESTNR` | bestandsnummer |
  | `SP_TEIGNR` | teignummer |
  | `SP_BAREAL` | areal |
  | `SP_ABONTRE` | bonitetstreslag |
  | `SP_AGJBON` | bonitet |
  | `SP_ALDER` | alder |
  | `SP_AVOLPRDA` | volum per daa |
  | `SP_AVOLTOT` | totalvolum |
  | `SP_HOYDE` | middelhøyde |
  | `SP_AAR` | tiltaksår |

  Ungskogfeltene leses også: `SP_TREFREG`/`SP_TREEREG` (treantall før og etter regulering) og `SP_HBAR`/`SP_HLAUV` (høyde bar og lauv). Tidligere ble planer med disse feltnavnene ikke tolket.
- **Registrering:**
  - I fullversjonen velges klassen i bestandsskjemaet.
  - I SkogIQ Felt velges den med ett trykk (a, b eller Tøm) på bestandskortet.
- **Beregnet for HK II:** Treantallet sammenlignes med minste plantetall i forskriften § 7, for eksempel 150 per daa for G20 og 100 for G14. Appen bruker først treantall etter regulering, så treantall før regulering, og til slutt bestandsdataene.
- **HK III–V beregnes ikke.** Appen viser i stedet et hint: hvor mange prosent målt volum er av fullt bestokket skog ved samme alder og bonitet. Under 50 % gir teksten «kan tyde på mindre tilfredsstillende tetthet».
  - Grunnen er at SR16-volumene i fjellskog ofte ligger på 30–40 % av vekstmodellen. På Flå 22/1 ville en grense på 60 % gitt b på nesten tre av fire bestand.
- NIBIOs åpne skogbruksplandata (WMS «hogstklasser») har ikke tetthetsklasse, bare hogstklasse, bonitet, treslag og alder. Klassen må derfor komme fra planfirmaets SOSI-fil eller registreres i felt.

Tiltaksmotoren foreslår **suppleringsplanting** i II b når bestandet er under ca. 12 år. Forslaget kommer bare når klassen er registrert eller treantallet er målt i ungskogfeltene, fordi treantall fra SR16 er for usikkert i ung skog.

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
- **Traktorveier og stier fra Kartverket.** Disse hentes fra FKB-TraktorvegSti, en åpen WFS med GeoJSON i UTM33 (`wms.traktorveg_skogsbilveger`, lag `ms:traktorveg_sti`). Linjer på eller inntil eiendommen tas med:
  - FKB leverer korte veglenker. Lenker som henger sammen, slås sammen til «Traktorvei 1, 2 …» og «Sti 1, 2 …».
  - Traktorveier blir klasse 7 i veiregisteret, med tilstand, eiere og vedlikehold som andre veier. Stier lagres i en egen liste.
  - Begge hentes automatisk når planen lages (steget «Traktorveier og stier»). De kan også hentes eller oppdateres med «Hent traktorveier og stier» og «Oppdater alle».
  - Ved ny henting beholdes det som er registrert på en traktorvei.
  - I alle kart vises traktorvei som brun stiplet linje og sti som rød prikket linje, med egen del i tegnforklaringen.
  - Terrengtransport regnes fortsatt bare til bilvei.
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
