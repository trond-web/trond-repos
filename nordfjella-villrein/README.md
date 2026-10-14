# Nordfjella villrein – jaktkart for mobil

Kartapp for villreinjakt i Nordfjella villreinområde. Laget for telefon, og virker uten mobildekning når kartet er lastet ned.
Legg den til på hjemskjermen (Safari: Del → «Legg til på Hjem-skjerm», Chrome: «Installer app»).

## Hva den gjør

- **Grensa for villreinområdet** (Miljødirektoratets leveområde for Nordfjella), med området utenfor skyggelagt.
  Grensa følger med appen og virker alltid uten nett.
- **Eiendomsgrenser** fra Kartverket (fra zoom 14), og gårds- og bruksnummer når du zoomer helt inn.
- **GPS-status** nederst på skjermen: innenfor eller utenfor villreinområdet, avstand og retning til grensa,
  eiendom (gnr/bnr og kommune), og UTM 32-koordinater med GPS-nøyaktighet.
- **Jaktgrunn**: trykk på en eiendom i kartet og lagre den som jaktgrunn. Appen sier fra om du står på din jaktgrunn,
  og hvor langt det er til grensa, også uten nett.
- **Bil, leir og andre punkter**, «gå hit» med avstand og retning, og eksport som GPX.
- **Uten nett**: last ned hele området (oversikt ca. 30 MB, standard ca. 85 MB, detaljert ca. 285 MB). Mangler en kartrute,
  forstørrer appen en lagret rute fra et lavere zoomnivå.
- **Egne grenser**: legg inn jaktfelt eller soner som GeoJSON, KML eller GPX.

Jaktgrunner og punkter blir værende på telefonen. Ved oppslag av eiendom og høyde sendes bare koordinatet til Kartverket.

## Datakilder

| Data | Kilde |
|---|---|
| Grensa for Nordfjella (`data/nordfjella.geojson`, lokalId BV00003542) | Miljødirektoratet, *Villreinområder* (`villrein_leveomrade_grense`) |
| Trekk- og kalvingsområder | Miljødirektoratet, WMS *Villrein* |
| Eiendomsgrenser, gnr/bnr | Kartverket, WMS *Matrikkelkart* |
| Eiendom i punkt (teig med geometri) | Kartverket `api.kartverket.no/eiendom/v1/punkt/omrader` |
| Høyde | Kartverket `ws.geonorge.no/hoydedata` |
| Kart | Kartverket topografisk, turkart (raster), gråtone. Flyfoto fra Esri |

Grensa for villreinområdet hentes slik (oppdater filen hvis Miljødirektoratet endrer den):

```
https://kart.miljodirektoratet.no/arcgis/rest/services/villrein/MapServer/0/query?where=OBJECTID%3D541&outFields=*&outSR=4326&f=geojson
```

## Utvikling

Ren statisk side (Leaflet fra unpkg, ES-moduler) uten byggesteg. Kjør `python3 -m http.server` i mappen og åpne i nettleseren.

```
node tests/run.mjs          # enhetstester
LIVE=1 node tests/run.mjs   # også mot Kartverket og Miljødirektoratet
```

| Fil | Innhold |
|---|---|
| `js/app.js` | Kart, GPS-status, jaktgrunner, punkter, meny og offline-nedlasting |
| `js/geo.js` | Punkt i flate, avstand til grense, UTM, kartruter og GPX |
| `js/kilder.js` | Kartlag, eiendoms- og høydeoppslag og import av filer |
| `sw.js` | Service worker: appen og kartrutene uten nett |
