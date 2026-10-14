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

## Publisering på Railway

Appen er statisk og kjøres med en liten Node-server uten avhengigheter (`server.js`), samme oppsett som SkogIQ. Serveren har
komprimering, ETag/304, sikkerhetshoder og helsesjekk på `/healthz`. Testfiler, README og konfigurasjon publiseres ikke.

1. Gå til [railway.com](https://railway.com), og åpne prosjektet `skogiq` (eller lag et nytt med **New Project**).
   Velg **New** → **GitHub Repo** → `trond-web/trond-repos`.
2. Under tjenestens **Settings**:
   - **Root Directory**: `/nordfjella-villrein`
   - **Branch**: `main`
   - **Start Command**: `node server.js`, **Healthcheck Path**: `/healthz`, **Watch Paths**: `/nordfjella-villrein/**`
3. **Networking** → **Generate Domain** for å få en offentlig adresse (`*.up.railway.app`), eller legg til eget domene.

Railway bygger med Railpack (Node ≥ 20) og starter `node server.js` på porten i `PORT`. Ingen miljøvariabler er nødvendige.
Appen publiseres også på GitHub Pages (`https://trond-web.github.io/trond-repos/nordfjella-villrein/`).

## Utvikling

Ren statisk side (Leaflet fra unpkg, ES-moduler) uten byggesteg. Kjør `npm start` (port 8080) i mappen og åpne i nettleseren.

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
