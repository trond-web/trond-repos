# ⛷️ Snøvill Skiføre

En morsom skiføre-radar for **Sjusjøen**, **Øyerfjellet**, **Nordseter** og **Synnfjell**. Appen
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
| **Netatmo** | Live-temperatur og nedbør fra private værstasjoner rundt hyttefeltene. **Krever eget access token**, som du limer inn under ⚙️ Innstillinger (lages på [dev.netatmo.com](https://dev.netatmo.com/apps) med scope `read_station`, varer ca. 3 timer) | `api.netatmo.com/api/getpublicdata` |

Alle fire tillater kall fra nettleseren (CORS). Svarene mellomlagres i 20 minutter i
`localStorage`.

> TV 2- og Sporet-endepunktene er ikke offisielt dokumenterte API-er. Om de endrer seg,
> markeres kilden med ✗ i appen, og beregningen bruker de kildene som fortsatt svarer.

## Slik regnes skiføret ut

1. Prognosen deles i tidsblokker (1 t / 3 t / 6 t / døgn) og plasseres på lokal dato.
2. Nedbør blir snø ved ≤ 0 °C og regn ved ≥ +2 °C, med lineær overgang mellom. 1 mm ≈ 1 cm snø.
3. Snømodellen per døgn: `dybde = dybde·0,97 + nysnø − 1,2·graddøgn − 0,15·regn`.
4. **Sannsynlighet**: 30 varianter (Yr og Storm × temperaturavvik −2…+2 × spredning som
   øker med tiden × nedbør 60/100/140 %). Andelen varianter med snødybde over grensen gir to sjanser:
   - 🎿 **oppkjørte spor**: snødybde ≥ 25 cm (kan justeres 10–50 cm)
   - 👣 **tråkke spor selv**: snødybde ≥ 2 cm (kan justeres 1–20 cm)
5. **Snøvill-indeks** (0–100) = 0,75 × sjansen for å tråkke selv + 0,25 × sjansen for oppkjørte spor.
   Snøvill blir glad bare det er snø å tråkke i, og oppkjørte spor gir full pott.
6. **Startdybde**: «Auto» anslår ut fra Sporet (kjørt siste 2 døgn → 35 cm, siste uke →
   25 cm, siste 3 uker → 10 cm, ellers 0). Kan overstyres per sted i innstillingene.

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
