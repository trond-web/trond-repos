# Næringsmuligheter Nannestad – kart og analyse for eiendomsutvikling

En nettleserapp som viser hvilke muligheter en eiendom i Nannestad har for næringsutvikling, og hvordan den kan
utnyttes bærekraftig og lønnsomt. Den åpner med **gnr. 29 bnr. 2 (Rud-Ødegutua 8–10)**. Du kan også søke opp en
adresse eller et gnr/bnr, eller klikke på en eiendom i kartet.

- **Mulighetskart:** Et rutenett over eiendommen der hver rute får anbefalt bruk: matproduksjon (dyrka jord),
  skogproduksjon (produktiv skog), natur/myr, tunnæring (rundt bygningene) og kandidat for innspill til sol eller næring
  (lavproduktiv mark).
- **Eiendommen:** areal, arealtyper (AR5), skogbonitet, kommuneplan og reguleringsplan, hensynssoner (flystøy),
  løsmasser, kvikkleire, bygninger, avstand til Oslo lufthavn og sentrum, og nærmeste utbyggingsområder i kommuneplanen.
- **Muligheter, rangert:** skogbruk, matproduksjon, solceller på tak, bakkemontert solpark, utleie av driftsbygninger,
  hestesenter, myrrestaurering, jakt/friluftsliv, massemottak, omregulering til næring og bolig. Hver mulighet har
  egnethet (0–100), planvei (kan gjøres nå → krever ny plan), bærekraft og økonomi (1–5), begrunnelse, neste steg og
  risiko. «Vis aktuelt areal i kartet» markerer rutene som er aktuelle for tiltaket.
- **Økonomi:** Kalkyle per mulighet der du endrer forutsetningene (tilvekst, priser, areal, investering). Endringene
  huskes i nettleseren. Oversikten summerer en anbefalt kombinasjon av tiltak som ikke krever ny plan.
- **Nannestad:** Alle områder til næring, råstoff, tjenesteyting, sentrum og annen bebyggelse i kommuneplanens arealdel,
  med areal, status (nåværende/framtidig) og avstand fra eiendommen.
- Kartlag: kommuneplan (arealformål og hensynssoner), reguleringsplaner, AR5, løsmasser, kvikkleire og eiendomsgrenser.

Lenker kan deles: `…/nannestad-naering/#3238-29-2`.

## Hovedfunn for 29/2

| | |
|---|---|
| Areal | ca. 1 440 daa: ~1 040 daa skog av høy bonitet, ~260 daa fulldyrka jord, ~80 daa myr |
| Plan | LNFR i kommuneplanens arealdel 2018–2035. Ingen reguleringsplan |
| Flystøy | ca. 85–90 % i gul flystøysone (H220) – utelukker nye boliger, men ikke næring og landbruk |
| Grunn | i hovedsak marin leire (NGU), torv i myrene. Ingen kartlagt kvikkleiresone på eiendommen, én like ved |
| Beliggenhet | ca. 5 km til Oslo lufthavn og 3,6 km til Nannestad sentrum. Næringsområde N39 og råstoffområde R3 ligger 0,2–0,4 km unna |

Anbefalingen er å beholde og styrke skog og jord som kjerne, og å legge til inntekter som ikke bygger ned areal:
utleie av driftsbygninger, hestehold, solceller på tak og myrrestaurering. Omregulering av skog til næring er mulig
på lang sikt, men krever innspill til kommuneplanen og har usikkert utfall (jordvern, flystøy, leire).

## Datakilder

Alt hentes direkte fra nettleseren (alle tjenestene tillater CORS). Det er ingen server og ingen innlogging.

| Data | Tjeneste |
|---|---|
| Eiendomsgrense, eiendom i punkt, adressesøk | Kartverket `api.kartverket.no/eiendom`, `ws.geonorge.no/adresser` |
| Arealtype, bonitet, treslag | NIBIO AR5, WMS GetFeatureInfo i et rutenett (høyst ca. 320 punkter) |
| Løsmasser | NGU `LosmasserWMS2` |
| Kommuneplan, reguleringsplaner, hensynssoner | DiBK Nasjonal arealplanbase (WMS GetFeatureInfo) |
| Kvikkleire | NVE `SkredKvikkleire2` (ArcGIS REST) |
| Bygninger | Geonorge WFS *Matrikkelen – bygningspunkt* |
| Kart | Kartverket topografisk/gråtone, Esri flyfoto |

`data/` inneholder forhåndsberegnede filer:

- `naeringsomrader.geojson`: Utbyggingsområdene i kommuneplanen. Plankartet hentes som bilde fra Nasjonal arealplanbase,
  deles i sammenhengende fargeflater, og hver flate identifiseres med GetFeatureInfo. Omrissene har ca. 12 m oppløsning.
  Lag fila på nytt med `python3 -I verktoy/bygg_data.py` (krever Pillow).
- `kommune.geojson`: kommunegrensen (samme skript).
- `eiendom-3238-29-2.json`: rådata for 29/2, slik at startsiden vises med en gang. Lag fila på nytt med
  `node verktoy/forhandsberegn.mjs 3238 29 2`. «Hent på nytt» i appen henter alt live.

## Begrensninger

- Økonomitallene er grove anslag med typiske priser og ingen takst. Endre forutsetningene og snakk med fagfolk.
- AR5 og løsmassekartet har begrenset nøyaktighet (løsmasser 1:50 000). Ruter langs eiendomsgrensen kan gå litt utenfor.
- Plandata kan være utdatert eller mangle. Juridisk gjeldende plan står i kommunens planinnsyn.
- Løsningen er en planleggingshjelp, ikke en juridisk vurdering. Kommunen avgjør søknader og planinnspill.

## Teknisk

- Ren HTML/CSS/JavaScript (ES-moduler). Eneste eksterne bibliotek er Leaflet.
- `js/kilder.js`: henting og tolking. `js/analyse.js`: fakta, muligheter, mulighetskart og kalkyler (ren funksjon,
  testes i Node). `js/geo.js`: geometri.
- Tester: `node tests/run.mjs`. Med `LIVE=1 node tests/run.mjs` testes også mot de ekte tjenestene.
- Kjør lokalt: `python3 -m http.server` i repo-roten og åpne <http://localhost:8000/nannestad-naering/>.
