# Fox Classic 2027 – påmelding

Enkel påmeldingsløsning for **Fox Classic 2027**, et terrengløp lørdag 18. september 2027.

- **Distanse:** 5,3 km
- **Start/mål:** Rud-Øde
- **Pris:** Gratis
- **Øvelser:** Trim uten tidtaking (fri start 09:45–10:30), Konkurranse med
  tidtaking (start kl. 11:00), og Barn 300 meter (uten tidtaking)

## Fire sider

- **`/` – deltakerside.** Melde på deltaker, se påmeldingslisten (filtrerbar på
  kjønn/øvelse), se resultater. Ingen mulighet til å endre eller slette data –
  startnummer vises, men kan ikke endres her.
- **`/arrangor` – arrangørside.** Samme funksjonalitet som deltakersiden, i tillegg
  til å tildele startnummer, registrere tid, redigere deltakerfelt og slette
  deltakere. Låst bak et arrangørpassord (se under).
- **`/arrangor/tid` – tidtakingsside.** En smal, fokusert side kun for tidtaking
  under selve løpet: løpsklokke (start/nullstill) øverst, et søkefelt (startnummer
  + valgfritt øvelsesfilter), og to faner – **⏳ Venter** (sortert på startnummer,
  med stor "🏁 Mål"-knapp per deltaker) og **✅ I mål** (viser registrert
  tid/"Fullført", med angre-knapp). Trykk Enter i søkefeltet registrerer mål
  direkte når søket gir nøyaktig ett treff i "Venter". Viser ingen full liste,
  skjema eller feltredigering – bare det som trengs for å ta tider raskt. Samme
  innlogging som `/arrangor`.
- **`/arrangor/kamera` – eksperimentell kamera-mål-modul.** Se eget avsnitt under.

To lag med beskyttelse på arrangørsidene:

1. **Sidetilgang:** `/arrangor`, `/arrangor.html`, `/arrangor.js`, `/arrangor/tid`,
   `/tidtaking.html`, `/tidtaking.js`, `/arrangor/kamera`, `/kamera.html` og
   `/kamera.js` krever HTTP Basic-innlogging (nettleserens innebygde
   passord-dialog) før noe som helst av innholdet lastes. En deltaker som går
   til disse sidene får bare en innloggingsdialog – ingen side, ingen data.
2. **API-tilgang:** Etter innlogging på arrangørsiden må man i tillegg logge inn
   i selve appen. `PATCH`/`DELETE /api/participants/:id` krever passordet i en
   header uansett hvilken side kallet kommer fra – så en deltaker kan ikke
   endre data selv om de skulle prøve å kalle API-et direkte.

Begge lagene bruker samme brukernavn/passord: `ARRANGOR_BRUKERNAVN` (standard: `admin`)
og `ARRANGOR_PASSORD`.

## Funksjonalitet

- Påmeldingsskjema (fornavn, etternavn, klubb/team, kjønn, øvelse) som tømmes
  automatisk etter hver registrering, slik at det er raskt å legge til flere
  deltakere på rad. Klubb/team er valgfritt.
- Startnummer tildeles av arrangør (redigerbart felt på `/arrangor`), vises på
  alle sider men kan kun endres av arrangør.
- Påmeldingslisten er delt og synlig for alle som åpner siden (lagres på serveren,
  ikke i den enkelte nettlesers lokale lagring).
- Filtrering på kjønn og øvelse, med løpende telling.
- Eksport til Excel (.xlsx) av hele eller filtrert liste.
- "Slett alle deltakere"-knapp på arrangørsiden (med bekreftelsesdialog) for å
  nullstille hele påmeldingslisten, f.eks. mellom en test og selve arrangementet.
- Egen resultatliste (rangert etter tid) for "Konkurranse med tid".
- **Løpsklokke og "Mål"-knapp på arrangørsiden:** arrangør trykker "Start løpet"
  når konkurranseklassen starter, og trykker "🏁 Mål" for hver deltaker når de
  kommer i mål – tiden regnes automatisk ut fra starttidspunktet. Manuell
  inntasting av tid (tt:mm:ss) er fortsatt mulig for korrigering. Trim- og
  Barn 300 meter-deltakere får "Fullført" ved samme knappetrykk, uten at noen
  tid vises eller lagres.
- Reve-maskoten er med på begge sider (favicon, header og på arrangørens
  "rev-hi"-innlogging), med et lite lekent preg på tekst og knapper.

## Kjøre lokalt

```bash
cd fox-classic-2027
npm install
ARRANGOR_PASSORD=hemmelig npm start
```

Åpne <http://localhost:3000> (deltakerside) og <http://localhost:3000/arrangor>
(arrangørside, logg inn med brukernavn `admin` og passordet du satte i
`ARRANGOR_PASSORD`).

Påmeldte lagres i `data/participants.json` (opprettes automatisk, og er ikke
lagt inn i git). Ta gjerne jevnlig backup av denne filen under selve arrangementet.

## Deploy

Løsningen er en vanlig Node/Express-app og kan driftes på f.eks. Render, Railway,
Fly.io eller en egen server – kjør `npm install && npm start` og pek `PORT`-miljø-
variabelen dit tjenesten forventer. Så lenge alle bruker samme kjørende instans,
vil påmeldingslisten være delt for alle.

Er live på Railway: <https://fox-classic-2027-production.up.railway.app>. Der er
det koblet på en persistent volume montert på `/data`, og appen lagrer dit når
miljøvariabelen `RAILWAY_VOLUME_MOUNT_PATH` er satt – slik overlever
påmeldingene redeploys og restarter.

## Arrangørinnlogging i drift

Sett miljøvariablene `ARRANGOR_BRUKERNAVN` (standard: `admin`) og
`ARRANGOR_PASSORD` på driftsmiljøet (f.eks. `railway variables set
ARRANGOR_PASSORD=...`). Uten `ARRANGOR_PASSORD` er `/arrangor`-innlogging og
alle skrivbare endepunkter avslått. Innloggingen kan byttes når som helst –
arrangører må da logge inn på nytt.

## Kamera-mål (`/arrangor/kamera`) – eksperimentell

En egen, separat modul på arrangørsiden som bruker mobilkameraet til å
oppdage automatisk når en løper krysser mållinja, og fryse tiden i det
øyeblikket – uten at noen må trykke "Mål" manuelt.

Slik virker den:

1. Arrangør åpner `/arrangor/kamera` på en mobil, monterer den fast rettet
   mot mållinja, og trykker "Start kamera".
2. En rød linje dras til å ligge over selve mållinja i bildet, og låses.
3. Appen sammenligner et smalt bildeutsnitt rundt linja mellom bilderammer
   (enkel bevegelsesdeteksjon i nettleseren, ingen ML-modell) for å oppdage
   når noe beveger seg over linja. Ved en kryssing fryses tidspunktet
   umiddelbart, og et bilde av øyeblikket lagres.
4. Startnummeret forsøkes lest automatisk fra bildet med Tesseract.js
   (OCR, lastes fra CDN først når det faktisk trengs – blokkerer aldri
   innlogging eller kamera dersom nettet er dårlig eller CDN-en er
   utilgjengelig). Dette er **kun et forslag**.
5. Kryssingen havner i en kø under kameraet, med bilde, klokkeslett/tid og et
   startnummerfelt (forhåndsutfylt av OCR om den lyktes). Arrangør må alltid
   se på bildet og **bekrefte eller rette** startnummeret før noe registreres
   – trykker man "✅ Bekreft" kalles samme mål-registrering som på
   `/arrangor/tid`, med det opprinnelige kryssingstidspunktet (ikke
   bekreftelsestidspunktet). "✕ Forkast" fjerner forslaget uten å registrere
   noe.

**Viktig – dette er bevisst bygget som et forsøk ved siden av, ikke en
erstatning:** automatisk kryssingsdeteksjon og OCR fra et enkelt mobilkamera
er grunnleggende upålitelig (lys, vinkel, flere løpere samtidig, bevegelse i
bakgrunnen). Modulen er derfor designet til aldri å registrere noe uten
menneskelig bekreftelse, og `/arrangor/tid` er og forblir hovedløsningen for
tidtaking. Bruk kamera-modulen som et tillegg for å fange kryssingstidspunkt
og få startnummerforslag – ikke som eneste tidtaking.

Testet med en Playwright-basert ende-til-ende-test (syntetisk kamerastrøm med
et bevegelig startnummer) som bekrefter at: kryssing oppdages til riktig tid,
bildet som lagres er tydelig, manuell inntasting av startnummer fungerer når
OCR ikke leser riktig (eller er utilgjengelig), bekreft-knappen registrerer
riktig tid via samme API som `/arrangor/tid`, og forkast-knappen ikke
registrerer noe.

## Mulig utvidelse

Løpsstart lagres i `data/race.json` (samme persistente volum som deltakerne),
uavhengig av `data/participants.json`. En fremtidig utvidelse kan f.eks. bygge
videre på dette med splittider eller strekk-tider per deltaker.
