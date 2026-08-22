# Fox Classic 2026 – påmelding

Enkel påmeldingsløsning for **Fox Classic 2026**, et terrengløp lørdag 19. september 2026.

- **Distanse:** 5,3 km
- **Start/mål:** Rud-Øde
- **Pris:** Gratis
- **Øvelser:** Trim uten tidtaking, og Konkurranse med tidtaking (start kl. 11:00)

## Funksjonalitet

- Påmeldingsskjema (fornavn, etternavn, kjønn, øvelse) som tømmes automatisk etter
  hver registrering, slik at det er raskt å legge til flere deltakere på rad.
- Påmeldingslisten er delt og synlig for alle som åpner siden (lagres på serveren,
  ikke i den enkelte nettlesers lokale lagring).
- Filtrering på kjønn og øvelse, med løpende telling.
- Eksport til Excel (.xlsx) av hele eller filtrert liste.
- Enkel manuell tidsregistrering per deltaker i "Konkurranse med tid" – et første
  steg mot en fremtidig stoppeklokke-funksjon for tidtaking på løpsdagen.

## Kjøre lokalt

```bash
cd fox-classic-2026
npm install
npm start
```

Åpne <http://localhost:3000>.

Påmeldte lagres i `data/participants.json` (opprettes automatisk, og er ikke
lagt inn i git). Ta gjerne jevnlig backup av denne filen under selve arrangementet.

## Deploy

Løsningen er en vanlig Node/Express-app og kan driftes på f.eks. Render, Railway,
Fly.io eller en egen server – kjør `npm install && npm start` og pek `PORT`-miljø-
variabelen dit tjenesten forventer. Så lenge alle bruker samme kjørende instans,
vil påmeldingslisten være delt for alle.

## Mulig utvidelse

Datamodellen har allerede et `tid`-felt per deltaker i konkurranseøvelsen, slik at
en fremtidig stoppeklokke-funksjon for løpsdagen kan bygges videre på dette uten
å endre datastrukturen.
