# Nordfjella villrein – jaktkart for mobil

Kartapp for villreinjakt i Nordfjella villreinområde. Laget for telefon, og virker uten mobildekning når kartet er lastet ned.
Legg den til på hjemskjermen (Safari: Del → «Legg til på Hjem-skjerm», Chrome: «Installer app»).

## Hva den gjør

- **Grensa for villreinområdet** (Miljødirektoratets leveområde for Nordfjella), med området utenfor skyggelagt.
  Grensa følger med appen og virker alltid uten nett.
- **Eiendomsgrenser** fra Kartverket (fra zoom 14), og gårds- og bruksnummer når du zoomer helt inn.
- **GPS-status** nederst på skjermen: innenfor eller utenfor villreinområdet, avstand og retning til grensa,
  vald, eiendom (gnr/bnr og kommune), og UTM 32-koordinater med GPS-nøyaktighet.
- **Vald og jaktgrunn**: trykk på en eiendom i kartet, velg valdnummer og lagre den som jaktgrunn. Appen sier fra om du står
  i ditt vald eller på din jaktgrunn, og hvor langt det er til grensa, også uten nett. Villreinvaldene i Nordfjella
  (`2211V0007` Ulvik villreinvald, `2211V0009` Hol 2, `2211V0011` Aurland 2) hentes fra Hjorteviltregisteret.
  Andre valdnummer kan legges inn for hånd. Det finnes ingen åpne kartdata med valdgrenser. Har du valdkart som fil med et
  valdnummerfelt (`valdnr`, `valdnummer` eller lignende), kan du legge den inn under «Egne grenser», og så kjenner appen igjen valdet.
- **Reinregistrering for forvaltningen**
  - *Observasjon*: antall dyr og struktur (kalv, simle, ungdyr, bukk liten/middels/stor, ukjent), atferd, trekkretning og
    merkede dyr. Flokken kan plasseres ut fra avstand og retning fra der du står.
  - *Felt dyr*: kjønn, alder (kalv/åring/eldre), slaktevekt, kjeve (med nummer), prøve for skrantesjuke (CWD, med prøvenummer),
    merket dyr og jeger.
  - *Skadeskutt* (retning, ettersøk varslet) og *syk/død rein* (med påminnelse om å melde til Mattilsynet).
  - Valdet fylles ut automatisk. **Oppsummering per jaktår og vald** viser kalv per 100 simler, bukk per 100 simler,
    andelen store bukker, felte dyr per kategori med snittvekt, og hvor mange kjever og CWD-prøver som er tatt.
    Du kan dele oppsummeringen som tekst (SMS/e-post) eller laste den ned som CSV for Excel.
- **Bil, leir og andre punkter**, «gå hit» med avstand og retning, og eksport som GPX.
- **Uten nett**: last ned hele området (oversikt ca. 30 MB, standard ca. 85 MB, detaljert ca. 285 MB). Mangler en kartrute,
  forstørrer appen en lagret rute fra et lavere zoomnivå.
- **Egne grenser**: legg inn jaktfelt, soner eller valdgrenser som GeoJSON, KML eller GPX.

Alt du registrerer blir værende på telefonen. Ved oppslag av eiendom og høyde sendes bare koordinatet til Kartverket.
Oppsummeringen er laget for jaktlaget og valdet, og fellingsrapporten må fortsatt leveres i Hjorteviltregisteret.

## Datakilder

| Data | Kilde |
|---|---|
| Grensa for Nordfjella (`data/nordfjella.geojson`, lokalId BV00003542) | Miljødirektoratet, *Villreinområder* (`villrein_leveomrade_grense`) |
| Trekk- og kalvingsområder | Miljødirektoratet, WMS *Villrein* |
| Eiendomsgrenser, gnr/bnr | Kartverket, WMS *Matrikkelkart* |
| Eiendom i punkt (teig med geometri) | Kartverket `api.kartverket.no/eiendom/v1/punkt/omrader` |
| Høyde | Kartverket `ws.geonorge.no/hoydedata` |
| Villreinvald | Hjorteviltregisteret |
| Kart | Kartverket topografisk, turkart (raster), gråtone. Flyfoto fra Esri |

Grensa for villreinområdet hentes slik (oppdater filen hvis Miljødirektoratet endrer den):

```
https://kart.miljodirektoratet.no/arcgis/rest/services/villrein/MapServer/0/query?where=OBJECTID%3D541&outFields=*&outSR=4326&f=geojson
```

## Utvikling

Ren statisk side (Leaflet fra unpkg, ES-moduler) uten byggesteg. Kjør `python3 -m http.server` i mappen og åpne i nettleseren.

```
node tests/run.mjs          # enhetstester
LIVE=1 node tests/run.mjs   # også mot Kartverket, Miljødirektoratet og Hjorteviltregisteret
```

| Fil | Innhold |
|---|---|
| `js/app.js` | Kart, GPS-status, vald, registrering, meny og offline-nedlasting |
| `js/geo.js` | Punkt i flate, avstand til grense, UTM, kartruter og GPX |
| `js/kilder.js` | Kartlag, eiendoms- og høydeoppslag, vald og import av filer |
| `js/registrering.js` | Reinregistrering: struktur, oppsummering og CSV |
| `sw.js` | Service worker: appen og kartrutene uten nett |
