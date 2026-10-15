# Nordfjella villrein – jaktkart for mobil

Kartapp for villreinjakt i Nordfjella villreinområde. Laget for telefon, og virker uten mobildekning når kartet er lastet ned.

Versjon 1.3.0 · Utviklet av Trond Harald Sand · I produksjon: **https://nordfjella.up.railway.app**

## Hva den gjør

- **Grensa for villreinområdet** (Miljødirektoratets leveområde for Nordfjella), med området utenfor skyggelagt.
  Grensa følger med appen og virker alltid uten nett.
- **Valdgrenser og jaktfelt** fra valdkartet for Nordfjella (2026): 132 jaktfelt i seks vald, hvert vald med egen farge
  (1 Hemsedal, 2 Ål, 3 Hol, 4 Aurland, 5 Lærdal, 6 Ulvik). Jaktfeltnummer (NFxxx) og navn vises fra zoom 11–12.
  Omstridte områder («Tvist») er stiplet rødt, og områder uten jaktfelt i kartet er stiplet grått. Valdkartet følger med
  appen og virker alltid, også uten nett. Statuskortet viser hvilket jaktfelt og vald du står i, og avstanden til feltgrensa.
- **Eiendomsgrenser** fra Kartverket (fra zoom 14), og gårds- og bruksnummer når du zoomer helt inn.
- **GPS-status** nederst på skjermen: innenfor eller utenfor villreinområdet, avstand og retning til grensa,
  eiendom (gnr/bnr og kommune), og UTM 32-koordinater med GPS-nøyaktighet.
- **Jaktgrunn**: trykk på en eiendom i kartet og lagre den som jaktgrunn. Appen sier fra om du står på din jaktgrunn,
  og hvor langt det er til grensa, også uten nett.
- **Bil, leir og andre punkter**, «gå hit» med avstand og retning, og eksport som GPX.
- **Uten nett**: last ned hele området (oversikt ca. 30 MB, standard ca. 85 MB, detaljert ca. 285 MB). Mangler en kartrute,
  forstørrer appen en lagret rute fra et lavere zoomnivå.
- **Egne grenser**: legg inn jaktfelt eller soner som GeoJSON, KML eller GPX.
- **Veiledning for hjemskjermen**: første gang appen åpnes på mobil, viser den steg for steg hvordan den legges på
  hjemskjermen, tilpasset telefonen og nettleseren (iPhone/iPad i Safari eller Chrome, Android i Chrome, Samsung Internet
  eller Firefox). Åpnes lenken inne i Messenger, Facebook o.l., forklarer appen hvordan den åpnes i nettleseren. På Android
  kan den installeres med én knapp. Når appen åpnes fra hjemskjermen første gang, får brukeren råd om GPS-tillatelse,
  nedlasting av kart og lagring av jaktgrunner. Nekter brukeren GPS-tilgang, viser appen hvordan det slås på.
  Veiledningen kan åpnes igjen fra Meny og under Om.

Jaktgrunner og punkter blir værende på telefonen. Ved oppslag av eiendom og høyde sendes bare koordinatet til Kartverket.

## Admin (for valdansvarlige)

`https://nordfjella.up.railway.app/admin.html` – innlogging med brukernavn og passord. Lenke ligger under Meny → Om i appen.

- **Valdgrenser**: klikk på et jaktfelt (eller velg i lista). Feltet kan flyttes til et annet vald, og grensen kan
  redigeres ved å dra punktene (punkter festes til nabofeltets grense når du drar nær). «Tilbakestill til valdkartet»
  fjerner endringen. Endringer vises for alle brukere med en gang og lagres i en logg med hvem som gjorde hva.
- **Samjakt**: velg vald som skal jakte sammen og periode (fra og med – til og med, norsk dato). I appen vises samjakten
  med gult banner øverst, gul skravur over feltene i valdene og en linje i statuskortet («Samjakt med …»). Den slås av
  automatisk etter siste dag – også på telefoner uten nett, fordi appen selv sjekker datoene. «Avslutt nå» slår den av med en gang.
- **Logg** og **Konto** (bytt passord).

Teknisk: serveren (`server.js`, `server/`) har et lite API uten eksterne avhengigheter. Data (endringer, samjakt, brukere,
logg) lagres i `nordfjella.json` i `DATA_DIR` – på Railway et volum montert på `/data`, så de overlever nye publiseringer.
Passord lagres som scrypt-hash, innloggingen er en signert, HttpOnly-kapsel som varer i 12 timer, og det er sperre etter
8 feil på 15 minutter. Endringer krever egen header og samme opprinnelse (vern mot CSRF).

Miljøvariabler på Railway: `DATA_DIR=/data`, `ADMIN_BRUKER` og `ADMIN_PASSORD` (første admin opprettes ved oppstart når det
ikke finnes brukere), `SESJON_HEMMELIGHET`.

| Endepunkt | |
|---|---|
| `GET /api/jaktfelt` | Valdkartet med admins endringer (ETag, gzip) |
| `GET /api/samjakt` | Samjakter som er aktive eller kommende |
| `POST /api/login`, `/api/logout` | Innlogging |
| `PUT/DELETE /api/admin/jaktfelt/:id` | Endre vald/grense, tilbakestille |
| `GET/POST /api/admin/samjakt`, `DELETE /api/admin/samjakt/:id`, `POST …/:id/avslutt` | Samjakt |
| `GET /api/admin/logg`, `POST /api/admin/passord` | Logg, bytt passord |

På GitHub Pages finnes ikke serveren; der bruker appen valdkartet som følger med, uten samjakt og admin.

## Datakilder

| Data | Kilde |
|---|---|
| Grensa for Nordfjella (`data/nordfjella.geojson`, lokalId BV00003542) | Miljødirektoratet, *Villreinområder* (`villrein_leveomrade_grense`) |
| Trekk- og kalvingsområder | Miljødirektoratet, WMS *Villrein* |
| Valdgrenser og jaktfelt (`data/jaktfelt.geojson`) | Valdkart for Nordfjella, `verktoy/valdkart_2026_10_15.gpkg` (UTM 32) |
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
| `js/installer.js` | Veiledning for hjemskjermen: plattform, steg og GPS-hjelp |
| `js/versjon.js` | Versjonsnummer og utvikler (vises i appen) |
| `js/jaktfelt.js` | Jaktfelt og vald: farger, oppslag i punkt og tekst til statuskortet |
| `js/kilder.js` | Kartlag, eiendoms- og høydeoppslag og import av filer |
| `ikoner/` | PNG-ikoner for hjemskjerm (iPhone krever PNG, Android krever 192 og 512 px) |
| `sw.js` | Service worker: appen og kartrutene uten nett |

Ved ny versjon: oppdater `js/versjon.js` og `package.json`, og øk cachenavnet `APP` i `sw.js`.

### Oppdatere valdkartet

Legg ny GeoPackage i `verktoy/` (lag `nordfjella_valdgr` med feltene `VALD`, `Feltnavn`, `Jaktfeltna`) og kjør

```
python3 verktoy/lag-jaktfelt.py verktoy/<ny fil>.gpkg data/jaktfelt.geojson
node tests/run.mjs
```

Skriptet regner om fra UTM 32 til grader, forenkler linjene med 1 m toleranse, slår sammen deler av samme jaktfelt og
finner et punkt inne i hvert felt til navnet. Øk så versjonen og cachenavnet i `sw.js`, så telefonene henter det nye kartet.
