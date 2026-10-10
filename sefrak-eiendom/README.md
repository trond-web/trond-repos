# SEFRAK-oppslag – vern, vedlikehold og oppussing for én eiendom

En nettleserapp der du slår opp en eiendom (adresse, «Kommune gnr/bnr» eller klikk i kartet). Den viser:

- **Bygningene på eiendommen** fra matrikkelen, koblet til **SEFRAK-registreringen** via bygningsnummer: datering,
  yttervegg, kledning, takform, grunnmur, kjeller, etasjer, skorsteiner, mål og opprinnelig miljø.
- **Vernestatus per bygning** i seks nivåer: fredet, eldre enn 1850, regulert til bevaring, verneverdig/listeført,
  SEFRAK 1850–1900 og ingen registrert vern. Hver vurdering har en begrunnelse og oppgir kilde.
- **Begrensninger** med lovhenvisning: kulturminneloven (fredning, § 25 for bygninger eldre enn 1850, automatisk
  fredete kulturminner og sikringssoner), hensynssoner og bevaringsformål i arealplan, LNFR, faresoner og søknadsplikt
  etter plan- og bygningsloven.
- **«Hva vil du gjøre?»** – velg bygning og tiltak (maling, vinduer, kledning, tak, etterisolering, grunnmur, pipe,
  innvendig, solceller/varmepumpe, tilbygg, bruksendring, riving). Du får om tiltaket kan gjøres fritt, bør avklares,
  er søknadspliktig eller krever tillatelse etter kulturminneloven, og råd om hvordan det bør gjøres.
- **Råd for vedlikehold tilpasset bygningen** ut fra SEFRAK-beskrivelsen, f.eks. lafteverk, bindingsverk, mur, puss,
  eternitplater, stabber, tørrmur, jordgolv og særpreget takform.
- **Arealplaner** med lenke til plandokumentene, arealformål og hensynssoner.
- **Kulturminner og kulturmiljøer** fra Askeladden som berører eiendommen.
- **Tilskudd** (Riksantikvaren, Kulturminnefondet, SMIL, regionale ordninger, eiendomsskattefritak), **sjekkliste**
  (huskes i nettleseren) og **kontakter**.
- **Utskrift/PDF** av hele rapporten.

Lenker kan deles: `…/sefrak-eiendom/#3238-32-16` åpner Nannestad 32/16 direkte.

## Datakilder

Alt hentes direkte fra nettleseren (alle tjenestene tillater CORS). Det er ingen server og ingen innlogging.

| Data | Tjeneste |
|---|---|
| Adressesøk, kommuner, eiendomsgrense, eiendom i punkt | Kartverket `ws.geonorge.no/adresser`, `api.kartverket.no/kommuneinfo`, `api.kartverket.no/eiendom` |
| Bygninger (bygningsnummer, type, status, SEFRAK-/kulturminneflagg) | Geonorge WFS *Matrikkelen – bygningspunkt* |
| SEFRAK-bygninger (med kodene oversatt til tekst) | Riksantikvaren OGC API `api.ra.no/sefrak_kartverket` |
| Fredete bygninger, kulturmiljøer | Riksantikvaren OGC API `api.ra.no` |
| Enkeltminner, lokaliteter, sikringssoner (Askeladden) | Geonorge WFS *Kulturminner* |
| Reguleringsplaner og kommuneplaner | DiBK Nasjonal arealplanbase, WMS GetFeatureInfo |
| Kart | Kartverket topografisk/gråtone, Esri flyfoto, Riksantikvarens SEFRAK-WMS |

### Hvordan vurderingen gjøres

- `sefrakStatus` i datasettet er ikke dokumentert. Ut fra dateringene tolkes **2** som eldre enn 1850 (rød trekant),
  **1** som 1850–1900 og **0** som revet/borte. Finnes bygningen fortsatt i matrikkelen, vurderes den ut fra
  dateringen i stedet.
- Fredning gjenkjennes fra *freda bygninger* (bygningsnummer, SEFRAK-ID eller posisjon), fra enkeltminner i
  Askeladden som dekker bygningen, og fra båndlegging etter kulturminneloven (H730) i plan.
- Planer sjekkes i hver bygnings posisjon og i ett punkt inne på eiendommen. Bevaring gjenkjennes fra H570 og fra
  eldre «spesialområde bevaring».
- Bygninger og SEFRAK-poster inntil 15–25 m utenfor eiendomsgrensen tas med og merkes «nær grensen», fordi
  eiendomsgrensene ofte er unøyaktige.

### Begrensninger i dataene

- SEFRAK ble registrert 1975–1995 og er ikke oppdatert. Datering og beskrivelse kan være feil eller utdatert.
- Kommunal listeføring og kommunale kulturminneplaner er bare delvis registrert i Askeladden.
- Ikke alle kommuner leverer til Nasjonal arealplanbase (bl.a. Oslo). Appen lenker da til kommunens planinnsyn.
- Kulturminneloven er under revisjon, så paragrafhenvisninger kan endres.
- Rapporten er en planleggingshjelp og ingen juridisk vurdering. Kommunen og fylkeskommunen avgjør.

## Teknisk

- Ren HTML/CSS/JavaScript (ES-moduler). Eneste eksterne bibliotek er Leaflet.
- `js/kilder.js`: henting og tolking (GML, GeoJSON, plan-JSON) med tidsavbrudd og nye forsøk.
- `js/analyse.js`: vernenivå, begrensninger, tiltaksveileder, råd, tilskudd og sjekkliste. Ren funksjon, testes i Node.
- `js/geo.js`: punkt-i-polygon, overlapp, avstand og areal. `js/koder.js`: kodelister.
- Tester: `node tests/run.mjs`. Med `LIVE=1 node tests/run.mjs` testes også mot de ekte tjenestene.
- Kjør lokalt: `python3 -m http.server` i repo-roten og åpne <http://localhost:8000/sefrak-eiendom/>.
  Mappen publiseres på GitHub Pages under `/sefrak-eiendom/`.
