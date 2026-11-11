# SkogIQ.ai – regler for videre utvikling

## Personvern og vilkår skal alltid være oppdatert

`js/personvern.js` er den eneste kilden for brukervilkårene og personvernerklæringen. Den brukes av:
- `personvern.html`
- registreringen i `logginn.html`
- godkjenningsdialogen i `js/innlogging.js`
- serveren (`auth.js`)

Ved hver ny funksjon eller endring, sjekk om den:
- lagrer, deler eller sender personopplysninger (navn, e-post, kontaktinfo, posisjon, eiendom, meldinger, filer)
- legger til en ny `/api`-sti på serveren
- tar i bruk en ny tredjepart (API, CDN, e-post, AI, maskinleverandør)
- endrer lagringstid, mottakere eller formål

Gjør den noe av dette:
1. Oppdater `BEHANDLINGER` med formål, opplysninger, grunnlag, lagringstid, mottakere og `api`. Oppdater `TREDJEPARTER` og eventuelt `VILKAAR` og `RETTIGHETER`.
2. Øk `VILKAR.versjon` og `VILKAR.dato`, og legg den nye sjekksummen inn i `PERSONVERN_SJEKKSUM` i `tests/run.mjs`. Testen skriver ut hvilken sjekksum som skal inn.
3. Er endringen vesentlig, settes `VILKAR.kreverGodkjenning` til den nye versjonen. Da må alle brukere godta på nytt ved neste innlogging. Vesentlig betyr nytt formål, ny mottaker eller tredjepart, eller lengre lagring.
4. Data som hører til en bruker, skal slettes ved `vedSlett` og være med i `eksport` (`server.js`).
5. Nevn endringen i endringsloggen (`js/endringslogg.js`).

Testene stopper:
- en ny `/api`-sti som ikke er ført inn i `BEHANDLINGER`
- tekstendringer i erklæringen uten ny versjon

## Utgivelse

1. Kjør `node tests/run.mjs`. Alle testene skal bestå.
2. Øk versjonen i `js/versjon.js`, `package.json` og README (`**Versjon X** (dato)`).
3. Legg til en ny første linje i `js/endringslogg.js`, og lag CHANGELOG.md på nytt:
   `node -e "import('./js/endringslogg.js').then(m=>require('fs').writeFileSync('CHANGELOG.md', m.markdown()))"`
4. Øk cachenavnet i `sw.js` (`skogiq-app-vN`), og legg nye moduler inn i `SKALL`.
5. Aldri passord, nøkler eller tokens i koden. Repoet er offentlig, og hemmeligheter ligger som miljøvariabler på Railway.
