# Fox Classic 2026 – påmelding

Enkel påmeldingsløsning for **Fox Classic 2026**, et terrengløp lørdag 19. september 2026.

- **Distanse:** 5,3 km
- **Start/mål:** Rud-Øde
- **Pris:** Gratis
- **Øvelser:** Trim uten tidtaking, og Konkurranse med tidtaking (start kl. 11:00)

## Tre sider

- **`/` – deltakerside.** Melde på deltaker, se påmeldingslisten (filtrerbar på
  kjønn/øvelse), se resultater. Ingen mulighet til å endre eller slette data –
  startnummer vises, men kan ikke endres her.
- **`/arrangor` – arrangørside.** Samme funksjonalitet som deltakersiden, i tillegg
  til å tildele startnummer, registrere tid, redigere deltakerfelt og slette
  deltakere. Låst bak et arrangørpassord (se under).
- **`/arrangor/tid` – tidtakingsside.** En smal, fokusert side kun for tidtaking
  under selve løpet: løpsklokke (start/nullstill) øverst, og et søkefelt der
  arrangør skriver startnummer (ev. filtrert på øvelse) for raskt å finne riktig
  deltaker og trykke "🏁 Mål". Trykk Enter i søkefeltet registrerer mål direkte
  når søket gir nøyaktig ett treff. Viser ingen full liste, skjema eller
  redigeringsmuligheter – bare det som trengs for å ta tider raskt. Samme
  innlogging som `/arrangor`.

To lag med beskyttelse på arrangørsidene:

1. **Sidetilgang:** `/arrangor`, `/arrangor.html`, `/arrangor.js`, `/arrangor/tid`,
   `/tidtaking.html` og `/tidtaking.js` krever HTTP Basic-innlogging (nettleserens
   innebygde passord-dialog) før noe som helst av innholdet lastes. En deltaker
   som går til disse sidene får bare en innloggingsdialog – ingen side, ingen data.
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
- Egen resultatliste (rangert etter tid) for "Konkurranse med tid".
- **Løpsklokke og "Mål"-knapp på arrangørsiden:** arrangør trykker "Start løpet"
  når konkurranseklassen starter, og trykker "🏁 Mål" for hver deltaker når de
  kommer i mål – tiden regnes automatisk ut fra starttidspunktet. Manuell
  inntasting av tid (tt:mm:ss) er fortsatt mulig for korrigering. Trim-deltakere
  får "Fullført" ved samme knappetrykk, uten at noen tid vises eller lagres.
- Reve-maskoten er med på begge sider (favicon, header og på arrangørens
  "rev-hi"-innlogging), med et lite lekent preg på tekst og knapper.

## Kjøre lokalt

```bash
cd fox-classic-2026
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

Er live på Railway: <https://fox-classic-2026-production.up.railway.app>. Der er
det koblet på en persistent volume montert på `/data`, og appen lagrer dit når
miljøvariabelen `RAILWAY_VOLUME_MOUNT_PATH` er satt – slik overlever
påmeldingene redeploys og restarter.

## Arrangørinnlogging i drift

Sett miljøvariablene `ARRANGOR_BRUKERNAVN` (standard: `admin`) og
`ARRANGOR_PASSORD` på driftsmiljøet (f.eks. `railway variables set
ARRANGOR_PASSORD=...`). Uten `ARRANGOR_PASSORD` er `/arrangor`-innlogging og
alle skrivbare endepunkter avslått. Innloggingen kan byttes når som helst –
arrangører må da logge inn på nytt.

## Mulig utvidelse

Løpsstart lagres i `data/race.json` (samme persistente volum som deltakerne),
uavhengig av `data/participants.json`. En fremtidig utvidelse kan f.eks. bygge
videre på dette med splittider eller strekk-tider per deltaker.
