# 🌲 Skogbruksplan – forvaltning av skogbruksplandata

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
- Laveste hogstalder er veiledende verdier etter bonitet. **Kontroller dem mot gjeldende forskrift om bærekraftig skogbruk.**
  Tabellen kan endres under Innstillinger.
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
