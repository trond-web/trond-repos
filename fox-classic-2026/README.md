# Fox Classic 2026 – påmelding

Enkel påmeldingsløsning for **Fox Classic 2026**, et terrengløp lørdag 19. september 2026.

- **Distanse:** 5,3 km
- **Start/mål:** Rud-Øde
- **Pris:** Gratis
- **Øvelser:** Trim uten tidtaking, og Konkurranse med tidtaking (start kl. 11:00)

## To sider

- **`/` – deltakerside.** Melde på deltaker, se påmeldingslisten (filtrerbar på
  kjønn/øvelse), se resultater. Ingen mulighet til å endre eller slette data.
- **`/arrangor` – arrangørside.** Samme funksjonalitet som deltakersiden, i tillegg
  til å registrere tid, redigere deltakerfelt og slette deltakere. Låst bak et
  arrangørpassord (se under).

Deltakersiden viser aldri rediger-/slett-kontroller, og de tilhørende
API-endepunktene (`PATCH`/`DELETE /api/participants/:id`) krever passordet
uansett hvilken side kallet kommer fra – så en deltaker kan ikke endre data selv
om de prøver å kalle API-et direkte.

## Funksjonalitet

- Påmeldingsskjema (fornavn, etternavn, kjønn, øvelse) som tømmes automatisk etter
  hver registrering, slik at det er raskt å legge til flere deltakere på rad.
- Påmeldingslisten er delt og synlig for alle som åpner siden (lagres på serveren,
  ikke i den enkelte nettlesers lokale lagring).
- Filtrering på kjønn og øvelse, med løpende telling.
- Eksport til Excel (.xlsx) av hele eller filtrert liste.
- Egen resultatliste (rangert etter tid) for "Konkurranse med tid".
- Arrangører kan registrere tid, redigere deltakerfelt og slette deltakere fra
  `/arrangor` – et første steg mot en fremtidig stoppeklokke-funksjon for
  tidtaking på løpsdagen.

## Kjøre lokalt

```bash
cd fox-classic-2026
npm install
ARRANGOR_PASSORD=hemmelig npm start
```

Åpne <http://localhost:3000> (deltakerside) og <http://localhost:3000/arrangor>
(arrangørside, logg inn med passordet du satte i `ARRANGOR_PASSORD`).

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

## Arrangørpassord i drift

Sett miljøvariabelen `ARRANGOR_PASSORD` på driftsmiljøet (f.eks.
`railway variables set ARRANGOR_PASSORD=...`). Uten denne variabelen er
`/arrangor`-innlogging og alle skrivbare endepunkter avslått. Passordet kan
byttes når som helst – arrangører må da logge inn på nytt.

## Mulig utvidelse

Datamodellen har allerede et `tid`-felt per deltaker i konkurranseøvelsen, slik at
en fremtidig stoppeklokke-funksjon for løpsdagen kan bygges videre på dette uten
å endre datastrukturen.
