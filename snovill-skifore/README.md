# ⛷️ Snøvill Skiføre

En morsom skiføre-radar for **Sjusjøen**, **Øyerfjellet**, **Nordseter**, **Oppsjøen** (Nordre Land), **Høgmåsan** og **Råsjøen** (begge Nannestad). Appen
henter vær og løypedata, kjører en liten snømodell og viser **sannsynlighet for
skiføre de neste 10 dagene**, med smøretips, «Snøvill-indeks» og en
«Ta fri»-generator for den beste dagen.

Ren statisk HTML/CSS/JS, uten byggesteg. Alt hentes direkte fra nettleseren.

## Datakilder

| Kilde | Hva | Endepunkt |
|---|---|---|
| **Yr / MET Norge** | Time-for-time-prognose (~10 dager) for temperatur og nedbør, høydejustert | `api.met.no/weatherapi/locationforecast/2.0/compact` |
| **Storm (StormGeo)** | Storm.no viderekobler i dag til TV 2 Vær, som viser StormGeo-prognoser (15 dager). Hentes fra TV 2s GraphQL-API med sted-ID = base64(`#` + geohash) | `www.tv2.no/vaer/backend-api` |
| **Sporet.no** | Siste preparering per løype innenfor 3–4 km av hvert sted | `api.sporet.no/loypeapi/publicfree/skiroutes/detailsbybbox` (UTM33) |
| **Webkamera (Sporet.no)** | Alle Sporet-kameraer (POI-type `CAM`) innenfor 20 km av hvert sted. Nærmeste kamera vises stort i kortet, resten under «Vis flere». Bildeadressene hentes fra `pois/{id}/webcams`; bare https-bilder vises, og lagrede kopier fra søkemotorer filtreres bort. Listen mellomlagres i et døgn | `ags.sporet.no/.../Sporet_simple/MapServer/2` + `api.sporet.no/loypeapi/publicfree/pois/{id}/webcams` |
| **NVE / seNorge** | Snødybde, snømengde (vannekvivalent), nysnø, smelting, flytende vann og døgntemperatur per dag for hvert sted – samme kilde som Yr viser snødybde fra. Hentes av Pages-workflowen ved hver bygging (også kl. 05:17 og 19:17 UTC) og legges ved som `data/nve-sno.json`, fordi NVE ikke tillater kall fra nettleseren | `gts.nve.no/api/GridTimeSeries/{x}/{y}/{fra}/{til}/{tema}.json` |
| **Løyper.net (FMS Nordic)** | Løypestrekninger med tid for siste kjøring, lysløype og «åpen, ikke preparert» innenfor 10 km av hvert sted. Leses fra vektorfliser (zoom 11) av Pages-workflowen og legges ved som `data/loyper.json`, fordi Løyper.net ikke tillater kall fra nettleseren | `api.loyper.net/segments/{z}/{x}/{y}` |
| **Løypekart (Sporet.no)** | Løypelinjer med preparering og løypetype innenfor 8 km, hentet direkte i nettleseren | `ags.sporet.no/.../Sporet_simple/MapServer/6` |
| **Ekstra webkamera** | Faste kamera som ikke finnes i Sporet, lagt inn i `EXTRA_WEBCAMS` i `app.js` og vist først for valgte steder. Nå: Pellestova Hotell (Hafjell) for Øyerfjellet, en YouTube-direktesending. Appen viser stillbildet YouTube oppdaterer fra sendingen (`i.ytimg.com/vi/{id}/maxresdefault_live.jpg`), og bildet lenker til sendingen. Starter hotellet en ny sending med ny video-ID, må ID-en byttes | YouTube |
| **Netatmo** | Live-temperatur og nedbør fra private værstasjoner rundt hyttefeltene. **Krever eget access token**, som du limer inn under ⚙️ Innstillinger (lages på [dev.netatmo.com](https://dev.netatmo.com/apps) med scope `read_station`, varer ca. 3 timer) | `api.netatmo.com/api/getpublicdata` |

Alle fire tillater kall fra nettleseren (CORS). Svarene mellomlagres i 20 minutter i
`localStorage`.

> TV 2- og Sporet-endepunktene er ikke offisielt dokumenterte API-er. Om de endrer seg,
> markeres kilden med ✗ i appen, og beregningen bruker de kildene som fortsatt svarer.

## Slik regnes skiføret ut

1. Prognosen deles i tidsblokker (1 t / 3 t / 6 t / døgn) og plasseres på lokal dato.
2. Nedbør blir snø ved ≤ 0 °C og regn ved ≥ +2 °C, med lineær overgang mellom.
3. **Snømodellen** går time for time og følger snømengde (SWE, mm vann) og tetthet, så snøen
   bæres videre fra dag til dag – 20 cm i dag blir ikke 0 cm i morgen:
   - **Nysnø:** tettheten avhenger av temperatur (Anderson: 50 + 1,7·(T+15)^1,5 kg/m³, tyngre når våt)
     og vind (vind pakker snøen). Over 6 m/s blåser en del av nysnøen bort.
   - **Smelting:** 4 mm vann per plussgrad per døgn, regnet time for time (døgnblokker bruker en
     sinuskurve mellom min og maks), pluss varme fra regn, varm bakke (0,3 mm/døgn) og fordamping i vind.
   - **Snøfokk:** over 7 m/s i kulde flyttes løs, lett snø bort fra åpne flater til den er pakket.
   - **Setning:** snøen pakker seg mot 350 kg/m³ (450 når den er våt), raskest i mildvær og vind.
   - Modellen gjelder åpent terreng; i skog blåser det mindre, og snøen ligger ofte lenger.
4. **Sannsynlighet**: 30 varianter (Yr og Storm × temperaturavvik −2…+2 × spredning som
   øker med tiden × nedbør 60/100/140 %). Andelen varianter med snødybde over grensen gir to sjanser:
   - 🎿 **oppkjørte spor**: snødybde ≥ 25 cm (kan justeres 10–50 cm)
   - 👣 **tråkke spor selv**: snødybde ≥ 2 cm (kan justeres 1–20 cm)
5. **Snøvill-indeks** (0–100) = 0,75 × sjansen for å tråkke selv + 0,25 × sjansen for oppkjørte spor.
   Snøvill blir glad bare det er snø å tråkke i, og oppkjørte spor gir full pott.
6. **Startpunkt:** manuell dybde fra innstillingene, ellers **NVE/seNorge** sin snødybde og snømengde
   for i dag (eller i går), ellers et anslag fra Sporet (kjørt siste 2 døgn → 35 cm, siste uke → 25 cm,
   siste 3 uker → 10 cm, ellers 0).
7. **Sammenligning:** dagsrutene, verktøytipset og tabellen viser NVEs egen prognose for snødybde
   ved siden av modellen. Modellen viser snødybden ved dagens slutt, og sammenlignes derfor med NVE
   kl. 06 neste morgen.

## 🗺️ Løypekart

Hvert stedskort har sitt eget løypekart, mellom 10-dagersvarselet og webkameraene, så snøforhold, løyper og
kamera ligger samlet. Kartet viser løypene rundt stedet på Kartverkets topografiske kart (Leaflet, lastes først
når kartet kommer til syne, og beholder zoom og data når kortene tegnes på nytt). Fargen viser hvor lenge siden løypa ble kjørt, med samme inndeling som Sporet: siste 6 t,
6–18 t, 18 t–2 døgn, 2–14 døgn, eldre, og ikke kjørt i år/ukjent. Heltrukne linjer er Sporet.no, stiplede er
Løyper.net. Under kartet står antall km løype og hvor mange km som er kjørt siste 18 timer.

- **Sporet.no** hentes direkte fra kartlaget `Loypetype`, med navn på skiområdet fra `Destinasjoner_prep`.
- **Løyper.net** hentes av `data/hent-loyper.mjs` (med en liten vektorflis-leser i `data/mvt.mjs`) ved hver
  bygging av Pages, også kl. 05:17 og 19:17 UTC. Tidene tolkes som norsk tid.
- Løyper.net dekker blant annet Nannestad–Maura, Åsen/Romeriksåsen, Skjerva, Hakadal, Synnfjell og Åstdalen,
  mens Sporet dekker de fleste løypelag. Samme løype kan derfor finnes i begge kildene.

## 🧴 Smøreguide

Seksjonen «Smøreguide» foreslår feste og gli fra **Swix, Rode, Start, Vauhti, Holmenkol, Toko, Rex og Skigo**
for valgt sted og dag, pluss **Snøvills egen anbefaling** (fargefamilie, glidertype og tips). Logikk og
produktdata ligger i [`smoring.js`](smoring.js).

1. **Forhold per dag** fra Yr/Storm: temperatur og luftfuktighet på dagtid (kl. 9–16), min/maks,
   nysnø i dag og i går, regn, og om det har vært plussgrader de siste tre dagene.
2. **Snøtype:** ingen snø · nysnø · våt nysnø · finkornet eldre snø · omdannet/grovkornet (etter mildvær) ·
   isete (etter mildvær og kald natt) · våt gammel snø.
3. **Fuktighet:** tørr (RF < 70 % eller ≤ −10 °C), normal, fuktig/våt (RF ≥ 90 % nær null, våt snø).
   Fuktig luft flytter valget én grad varmere, tørr luft én grad kaldere.
4. **Festetype:** hardvoks på nysnø og finkornet snø, klister på omdannet, isete og våt snø.
5. **Valg per leverandør:** produktet med snøtype som passer og temperaturområde som dekker forholdene
   (glider vektes også på fuktighet, f.eks. Swix PF/PC Dry/Mid/Wet). Treffer ingenting, vises nærmeste
   produkt merket «≈ nærmeste».

Temperaturområdene er hentet fra leverandørenes egne sider (Swix, Vauhti) eller fra forhandlere der
produsenten ikke publiserer tabell. Kilden står ved hvert produkt. Sortimentet er ikke komplett, og
fluorholdige produkter er utelatt.

## 🔔 Løypevarsler – når maskinen starter

Varslene dekker **alle 850+ skiområder i Sporet.no**, ikke bare de faste stedene:

- Kartlaget `Destinasjoner_prep` (`ags.sporet.no/.../Sporet_simple/MapServer/4`) gir status for
  hvert skiområde i Norge i ett kall. Kode 20 betyr «kjørt siste 6 timer». Et område går over til 20
  straks første strekning er kjørt, så **overgangen til 20 = løypemaskinen har startet**.
- Varselet tar med de første løypene som er kjørt (fra `skiroutes/detailsbybbox`).
- Første sjekk lagrer bare hvilke områder som er aktive nå. Etter det varsles hvert område én gang
  per oppstart. Kjøres et område igjen innen 6 timer, regnes det som samme økt.
- Sporet viser ikke maskinenes GPS-posisjon offentlig. «Startet» betyr derfor at første strekning
  er registrert kjørt, som for maskiner med GPS skjer automatisk mens de kjører.

**I appen:** velg **📍 Der jeg er** eller et sted og en radius (5–50 km). Listen viser alle
Sporet-områder i nærheten med status (🟢 kjøres nå). Mens appen er åpen sjekkes det hvert 5. minutt.
`sw.js` viser varslene og bruker Periodic Background Sync når appen er installert i Chrome/Edge.

Felles logikk for nettleser, service worker og GitHub-jobben ligger i `sporet-watch.js`.

### 📲 Push til mobilen via ntfy (også når appen er lukket)

Workflowen `.github/workflows/sporet-varsler.yml` kjører hvert 10. minutt på GitHub Actions,
sjekker alle Sporet-områder innenfor radiusen rundt stedene i [`varsler/steder.json`](varsler/steder.json)
(standard 10–12 km) og sender push via [ntfy](https://ntfy.sh) når løypemaskinen starter.

**Oppsett (én gang):**

1. Installer **ntfy**-appen (App Store / Google Play) og abonner på et emne med et navn som
   er vanskelig å gjette, f.eks. `snovill-k3x9q7wz2m`. Alle som kjenner navnet kan lese varslene.
2. Legg emnenavnet inn som repository secret **`NTFY_TOPIC`** under
   *Settings → Secrets and variables → Actions → New repository secret*.
3. Merge til `main` (planlagte workflows kjører bare fra standardgrenen).
4. Test: *Actions → Snøvill løypevarsler → Run workflow* sender et testvarsel.

**Tilpasning:**

- Legg til hytta eller andre steder i `steder.json` (`navn`, `lat`, `lon`, `radiusKm`).
- `stilleTimer` (norsk tid): varsler i dette tidsrommet sendes med lav prioritet, uten lyd.
- Egen ntfy-server: sett repository variable `NTFY_SERVER`, og eventuelt secret `NTFY_TOKEN`.
- Hvilke områder som kjøres nå lagres i Actions-cachen mellom kjøringer. Første kjøring lagrer
  bare en grunnlinje, så du får ikke varsel for maskiner som allerede har gått en stund.
- GitHub kan forsinke planlagte kjøringer med noen minutter, og slår dem av etter 60 dager
  uten aktivitet i repoet (kan slås på igjen under Actions).
- Lokal test uten å sende: `DRY_RUN=true node snovill-skifore/varsler/sjekk-sporet.mjs`.

## Kjøre lokalt

```bash
cd snovill-skifore
python3 -m http.server 8000
# åpne http://localhost:8000
```

## Publisering

GitHub Pages-workflowen (`.github/workflows/deploy-pages.yml`) legger appen under
`/snovill-skifore/` ved siden av tretetthet-appen ved push til `main`.
