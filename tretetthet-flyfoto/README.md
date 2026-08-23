# Tretetthet fra flyfoto

En enkel webapp for å anslå **antall trær per dekar** ut fra et opplastet flyfoto,
med kart- og oppslagsverktøy rettet mot **Østlandet**.

## Funksjonalitet

1. **Kart over Østlandet** (Leaflet, OpenStreetMap + Kartverkets åpne topografiske
   WMTS-cache) med stedsnavnsøk mot [Geonorge Stedsnavn-API](https://ws.geonorge.no/stedsnavn/v1/).
   Søketreff i Østlandsfylkene (Oslo, Akershus/Viken, Innlandet, Vestfold og
   Telemark, Buskerud) prioriteres i listen. Klikk i kartet eller velg et
   søketreff for å notere posisjon, og bruk lenkene til å åpne:
   - [Norge i bilder](https://norgeibilder.no/) – Kartverket/Geovekst sin
     offisielle visningsløsning for ortofoto, for å hente ned et ekte flyfoto
     av området.
   - [Kilden (NIBIO)](https://kilden.nibio.no/) – skogressurskartet **SR16**,
     til å sammenligne det automatiske estimatet med offisiell skogstatistikk.
   - [Norgeskart](https://norgeskart.no/) – generell kartreferanse.
2. **Opplasting av flyfoto** (JPG/PNG) via dra-og-slipp eller filvelger.
3. **Skalakalibrering** – bakkeoppløsning (GSD, meter/piksel) angis enten via
   forhåndsvalg for vanlige Geovekst/Norge i bilder-oppløsninger (0,10–0,50
   m/px), egendefinert verdi, eller ved å måle opp en kjent avstand direkte på
   bildet (klikk to punkter, oppgi avstanden i meter).
4. **Trededeteksjon**, kjørt lokalt i nettleseren på canvas-pikseldata:
   - Grønnhetsindeks («excess green»: `2G − R − B`) beregnes per piksel.
   - Otsu-terskling skiller vegetasjon fra bakgrunn (finjusterbar med en
     glidebryter).
   - Morfologisk åpning fjerner støy, etterfulgt av fjerning av små
     bildekomponenter (flatefylling/BFS).
   - Avstandstransform + lokale maksima (med minsteavstand basert på forventet
     krondiameter) skiller enkelttrær i sammenhengende kronedekke.
   - Deteksjoner tegnes som markører oppå bildet.
5. **Resultat**: antall registrerte trær, dekket areal i dekar, tetthet i
   trær/dekar og trær/hektar, samt nedlastbar tekstrapport.

## Kjøre lokalt

Rendyrket statisk app – ingen bygg-steg eller avhengigheter:

```bash
cd tretetthet-flyfoto
python3 -m http.server 8000
```

Åpne <http://localhost:8000>. (Man kan også bare åpne `index.html` direkte i
nettleseren, men en enkel lokal server unngår ev. begrensninger på
`file://`-opplasting i enkelte nettlesere.)

## Begrensninger

Dette er et **automatisert estimat**, ikke en sertifisert skogtakst:

- Nøyaktigheten avhenger av bildekvalitet, lysforhold, skyggekast og hvor rett
  ovenfra («ortogonalt») bildet er tatt.
- Algoritmen bruker kun synlig lys (RGB) og skiller ikke arter. Tett,
  overlappende kronedekke kan gi under- eller overtelling.
- Arealberegningen forutsetter korrekt oppgitt bakkeoppløsning (m/piksel) –
  feil skala gir feil dekar-tall.

For offisielle tall om skogressurser på Østlandet, bruk NIBIOs skogressurskart
**SR16** via [Kilden](https://kilden.nibio.no/) som referanse/kryssjekk.

## Mulig utvidelse

- Automatisk henting av georeferert ortofoto direkte fra en åpen WMS/WMTS for
  valgt kartutsnitt (i dag må brukeren selv hente ned bildet fra Norge i
  bilder og laste det opp), når en stabil, fritt tilgjengelig endepunkt uten
  IP-basert tilgangsbegrensning er identifisert.
- Artsklassifisering eller kronehøyde-estimat ved å kombinere med Kartverkets
  laserdata (høydemodell).
