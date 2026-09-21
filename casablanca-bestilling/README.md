# Casablanca-bestilling

Intern bestillingsløsning for IKT-enheten i Gran kommune, for felles matbestilling fra
[Casablanca Kjøkken](https://www.casablanca-kjokken.no/meny) i Gran.

## Funksjonalitet

- **Rask registrering:** Hver medarbeider velger retter fra menyen (med størrelse/pris),
  legger dem i en handlekurv og sender inn bestillingen sin under eget navn.
- **Delt oversikt:** Alle bestillinger denne runden vises samlet, med hva hver enkelt har
  bestilt og hva de skal betale.
- **Samlet bestilling:** En egen tabell viser alle retter summert på tvers av alle
  bestillinger – klar til å ringes inn til restauranten. En knapp kopierer en intern
  oversikt (samlet bestilling + hva hver person skal betale) for f.eks. Teams eller
  e-post internt.
- **Rediger egen bestilling:** Den som har lagt inn en bestilling kan redigere eller slette
  den (gjenkjennes automatisk i samme nettleser, ingen egen innlogging per person).
- **Meny-administrasjon:** Menyen kan redigeres direkte i løsningen («Rediger meny»), slik
  at den kan holdes oppdatert hver tirsdag uten å røre kode. Kategorier, retter, priser og
  størrelser kan legges til, endres og fjernes.
- **Avslutt runde:** Når bestillingen er sendt inn og betalingen samlet inn, kan runden
  avsluttes med ett klikk. Bestillingene arkiveres i historikken og listen tømmes for en
  ny runde.
- Delt innlogging (brukernavn/passord) siden løsningen kun er ment for IKT-enheten.

## Kjøre lokalt

```bash
cd casablanca-bestilling
npm install
npm start
```

Åpne <http://localhost:3000>.

Standard innlogging er brukernavn `IKT` og passord `Kebabhverfredag`. Dette kan endres ved
å sette miljøvariablene `CASABLANCA_USERNAME` og `CASABLANCA_PASSWORD` før oppstart. Sett
også gjerne `SESSION_SECRET` til en egen hemmelighet i produksjon.

Data lagres i `data/`-mappen (`menu.json`, `orders.json`, `history.json`), som opprettes
automatisk og ikke er lagt inn i git. Menyen fylles med et utgangspunkt fra
`seed-menu.json` (hentet fra Casablanca Kjøkkens meny) første gang appen starter – etter
det styres menyen via «Rediger meny» i appen.

## Deploy

Vanlig Node/Express-app. Kjør `npm install && npm start`, sett `PORT` til det tjenesten
forventer, og ta gjerne jevnlig backup av `data/`-mappen. Så lenge alle bruker samme
kjørende instans, er bestillingslisten og menyen delt for alle.

## Sikkerhet

Løsningen er en intern hjelpeløsning for én avdeling, ikke et system for sensitive
personopplysninger. Innloggingen er delt (samme brukernavn/passord for alle i IKT), og
redigering/sletting av egne bestillinger er beskyttet av en unik nøkkel lagret i
nettleseren – ikke en sikkerhetsgrense mot andre enn kollegaer med samme tilgang.
