# Turveier i Gran

En nettleserapp for innbyggerne i Gran som viser de **mest brukte tur- og sykkelveiene** i kommunen, rangert etter
faktisk bruk. Målet er bedre folkehelse: gjøre det lett å finne en tur nær deg og komme i gang.

- **Tre lister:** turstier (merkede ruter), sykkelruter (merkede ruter og de mest syklede vegene) og gang- og
  sykkelveger (hverdagsaktivitet til skole, jobb og butikk). Hver rute har en **bruksindeks** fra 0 til 100 og
  et nivå fra «lite brukt» til «svært mye brukt».
- **Kart** med rutene tegnet tykkere og sterkere jo mer de brukes, og Stravas varmekart (alle aktiviteter,
  til fots eller sykling) som eget lag.
- **Turer nær meg:** sorter etter avstand fra din posisjon eller en adresse i Gran. Filtrer på lengde, eller
  sorter etter kortest, lengst eller minst stigning.
- **For hver rute:** lengde i Gran, tidsbruk, stigning, høydeprofil, anslått energiforbruk og skritt, underlag,
  gradering, hvem som vedlikeholder ruta, været ved start de neste timene (MET), GPX-fil, veibeskrivelse til
  start og delingslenke (`#rute=…`).
- **Ukemål:** Helsedirektoratet anbefaler minst 150 minutter moderat aktivitet i uka. Trykk «Jeg har gått
  denne», eller legg til annen aktivitet, så ser du hvor nær du er målet. Lagres bare i nettleseren.
- **Ukens tur:** samme forslag til alle innbyggere hele uka, valgt blant de mye brukte stiene på 3–12 km.

## Datakilder

| Data | Tjeneste |
|---|---|
| Merkede turstier og sykkelruter | Kartverkets [Turrutebasen](https://wfs.geonorge.no/skwms1/wfs.turogfriluftsruter?service=WFS&request=GetCapabilities) (WFS, åpne data) |
| Veger og gang- og sykkelveger | Statens vegvesens [NVDB](https://nvdbapiles.atlas.vegvesen.no/) (NLOD) |
| Bruk | [Strava Global Heatmap](https://www.strava.com/maps/global-heatmap): anonymisert og samlet over det siste året |
| Kommunegrensa | Kartverkets [kommuneinfo-API](https://api.kartverket.no/kommuneinfo/v1/) |
| Høydeprofil | Kartverkets [høydedata-API](https://ws.geonorge.no/hoydedata/v1/) (terrengmodell 1 m) |
| Navn på ruter uten navn | Kartverkets [stedsnavn-API](https://ws.geonorge.no/stedsnavn/v1/) (nærmeste gård, vann, topp …) |
| Adressesøk og vær | Kartverkets adresse-API og MET [Locationforecast](https://api.met.no/weatherapi/locationforecast/2.0/documentation) |

**Vurderte kilder som ikke er brukt:**

- **Strava Metro** gir antall turer per vegstrekning og er gratis for kommuner, men krever avtale. Gran kommune
  kan søke om tilgang på [metro.strava.com](https://metro.strava.com). Da kan bruksindeksen byttes ut med
  faktiske antall.
- **Strava-API-et** gir bare den innloggede brukerens egne aktiviteter, ikke samlet bruk.
- **Inatur** selger jakt- og fiskekort og hytteutleie. Tjenesten har ingen åpne data om turbruk eller tur- og sykkelveger.
- **Statens vegvesens sykkeltellepunkter** (trafikkdata.no): det er ingen tellepunkter for sykkel i Gran.

## Slik måles bruken

For hver rute leses intensiteten i Stravas varmekart hver 15. meter langs traseen. Varmekartet er åpent til
zoom 11. Der er nesten alle veger mettet, fordi Strava normaliserer fargene lokalt. Indeksen er derfor et vektet
snitt over zoom 8, 9 og 10, der grovere piksler samler flere aktiviteter og skiller bedre mellom travle og
rolige ruter. Andelen av ruta med spor måles ved zoom 11, og en rute der bare en kort bit har spor, trekkes ned.
Turstier rangeres etter aktiviteter til fots (løping, gåing og fotturer), sykkelruter etter sykling, og gang- og
sykkelveger etter alle aktiviteter. Nivåene (1–5) er kvintiler innenfor hver liste.

Indeksen er **relativ**. Den forteller hvilke ruter som brukes mest sammenlignet med andre ruter i Gran, ikke
hvor mange som går der. Strava-brukere er ikke et representativt utvalg: løpere og syklister er
overrepresentert, turgåere, barn og eldre underrepresentert.

Varmekartet er Stravas innhold. Appen viser det som eget kartlag med kildehenvisning og lagrer bare den
utledede indeksen. Før en offisiell lansering i kommunens regi bør bruken avklares med Strava, eller
kommunen bør gå over til Strava Metro.

## Utvikling

```sh
node data/hent-data.mjs        # nytt øyeblikksbilde i data/ruter.json (ca. 1 minutt)
node tests/run.mjs             # enhetstester
LIVE=1 node tests/run.mjs      # også mot de ekte tjenestene
python3 -m http.server         # og åpne http://localhost:8000/
```

`data/ruter.json` lages på nytt ved hver publisering (GitHub Pages-workflowen). Feiler innhentingen, publiseres
øyeblikksbildet som ligger i repoet.
