# ⛷️ Snøvill Skiføre

En morsom skiføre-radar for **Sjusjøen**, **Øyerfjellet** og **Nordseter**. Appen
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
   øker med tiden × nedbør 60/100/140 %). Andel varianter med snødybde ≥ grensen
   (standard 25 cm, kan justeres) = sjansen for skiføre.
5. **Startdybde**: «Auto» anslår ut fra Sporet (kjørt siste 2 døgn → 35 cm, siste uke →
   25 cm, siste 3 uker → 10 cm, ellers 0). Kan overstyres per sted i innstillingene.

## 🔔 Løypevarsler

Kortet «Løypevarsler» varsler når løyper nær deg blir kjørt opp:

- Velg **📍 Der jeg er** (posisjon fra nettleseren) eller ett av de tre stedene, og en radius (3–20 km).
- Appen henter løypene i området fra Sporet (`skiroutes/detailsbybbox`) og husker «sist preparert»
  for hver løype i IndexedDB. Første sjekk lagrer bare en grunnlinje. Etter det varsles løyper
  som har fått nytt prepareringstidspunkt de siste 6 timene.
- Mens appen er åpen sjekkes det hvert 5. minutt og når fanen blir synlig igjen.
- `sw.js` (service worker) viser varslene, og når appen er installert som PWA i Chrome/Edge
  registreres også **Periodic Background Sync**, så nettleseren kan sjekke når appen er lukket
  (hvor ofte bestemmer nettleseren). iPhone: legg til på Hjem-skjerm (iOS 16.4+).
- Sporet viser ikke løypemaskinenes posisjon offentlig, så varselet kommer når føreren
  melder løypa som preparert, ikke idet maskinen kjører ut.

Felles logikk for side og service worker ligger i `sporet-watch.js`.

### 📲 Push til mobilen via ntfy (også når appen er lukket)

Workflowen `.github/workflows/sporet-varsler.yml` kjører hvert 10. minutt på GitHub Actions,
sjekker Sporet rundt stedene i [`varsler/steder.json`](varsler/steder.json) og sender push via
[ntfy](https://ntfy.sh) når løyper blir kjørt.

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
- «Sist sett» per løype lagres i Actions-cachen mellom kjøringer. Første kjøring lagrer
  bare en grunnlinje, så du får ikke varsel for gammel preparering.
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
