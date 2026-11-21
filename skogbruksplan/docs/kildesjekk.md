# Ukentlig kildesjekk – holder SkogIQ.ai oppdatert på gjeldende krav

SkogIQ.ai bygger på lover, forskrifter, tilskuddssatser, standarder, priser og offentlige datakilder som endres.
En planlagt oppgave kjører hver mandag morgen og sjekker alt dette. Når noe er endret, får eieren beskjed og et
forslag til endring (pull request). Ingenting flettes inn uten at eieren godkjenner det.

## Hva som sjekkes (`verktoy/kildesjekk.mjs`)

| Gruppe | Kilder | Hvordan |
|---|---|---|
| Lover og forskrifter | Skogbrukslova, berekraftig skogbruk, NMSK, landbruksveier, konsesjonsloven, odelslova, naturmangfoldloven, gjødselforskriften, plantevernmidler, produksjonstilskudd, dyrevelferdsloven, storfe, småfe, høns og kalkun, svin, hest, internkontroll, skiltforskriften, tariff (allmenngjøring) | «Sist endret» og om forskriften er opphevet (Lovdata) |
| Satser og tilskudd | Produksjonstilskudd (nye satser), skogfond, skogkultur, gjødsling og tettere planting (klimatiltak), veibygging, nye ordninger for skogbruk, regionalt miljøtilskudd | Endringer i relevante linjer og lenker (Landbruksdirektoratet) |
| Standarder | Norsk PEFC Skogstandard, alle 14 KSL-kapitler i appen | Standardkode og versjon i PDF-filnavnet sammenlignes med koden |
| Veiledere | Mattilsynet (storfe, hest), NIBIO Gjødslingshåndbok (korn, eng) | Endringer i relevante linjer |
| Priser og kostnader | SSB 03794/03895 (tømmerpris), 06108 (skogkultur), 05543 (gjødsling), 09066 (skogfond) | Nye tall, og SSB-snittprisen mot standardprisene i `js/model.js` (varsel ved over 10 % avvik) |
| Datakilder | NIBIO (AR5, SR16, beite, jordsmonn, markfuktighet), Miljødirektoratet, Kartverket, Geonorge, NVDB, MET, SSB | Svarer tjenesten? |
| Lenker i appen | Alle lenker i `js/*.js` og `*.html` | Døde lenker (404/410/5xx) |
| For hånd | Rundskriv om konsesjon (regjeringen.no blokkerer roboter), jordbruksavtalen, Statsforvalterens NMSK-satser, prislister og driftspriser fra skogeierandelslagene | Står i rapporten; den ukentlige oppgaven søker etter dem på nettet |

Referansen fra forrige kjøring ligger i `docs/kildestatus.json`. Rapporten deler funn i 🔴 viktig (krav eller satser
i appen må trolig endres), 🟡 varsel (kilde eller lenke virker ikke) og ℹ️ info (nye tall uten at appen må endres).

```bash
node verktoy/kildesjekk.mjs --lenker --rapport rapport.md --json funn.json   # sjekk
node verktoy/kildesjekk.mjs --lenker --oppdater                               # lagre ny referanse
```

## Rutinen for den ukentlige oppgaven

1. Hent siste `main` av `trond-web/trond-repos` og lag en gren `claude/kildesjekk-ÅÅÅÅ-MM-DD`.
2. Kjør `node verktoy/kildesjekk.mjs --lenker --rapport /tmp/kildesjekk.md --json /tmp/kildesjekk.json` i `skogbruksplan/`.
3. For hvert 🔴-funn: les kilden (for Lovdata også endringsforskriften, `https://lovdata.no/dokument/LTI/forskrift/<id>`), og finn ut hva som er endret og om det påvirker tall, krav eller tekster i appen. Søk i koden etter berørte konstanter (f.eks. `P_GRENSE`, `PT`, `PLASS`, `DYRESLAG`, `STANDARD_INNSTILLINGER`, `KSL_KAPITLER`, `pefc-data.js`).
4. Gjør i tillegg disse sjekkene som skriptet ikke kan gjøre alene:
   - Tømmerpriser og driftspriser: søk etter de nyeste prislistene fra skogeierandelslagene (Glommen Mjøsen, Viken Skog, AT Skog, Allskog, Vestskog) og sammenlign med `STANDARD_INNSTILLINGER.pris`, `drift` og `driftTynning` i `js/model.js`.
   - Jordbruksoppgjøret (mai–juni): nye foreløpige satser for produksjonstilskudd. Endelige satser kommer i januar og oppdages av skriptet.
   - Kostnader for skogkultur (planting, ungskogpleie, markberedning) mot `kostPerDaa`.
5. Er det klare endringer fra en offisiell kilde (ny sats, nytt krav, ny KSL-versjon, ny lenke): gjør endringen på grenen, kjør `node tests/run.mjs`, oppdater referansen (`--oppdater`), følg utgivelsesrutinen i `CLAUDE.md` (versjon, endringslogg, cachenavn), push grenen og opprett en pull request. **Ikke flett inn** – eieren godkjenner.
6. Er endringen usikker eller et faglig valg (f.eks. nye standardpriser): ikke endre koden, men beskriv funnet, kilden og et konkret forslag.
7. Har bare referansen endret seg (nye SSB-tall, endret side uten betydning for appen): legg den oppdaterte `docs/kildestatus.json` i en liten pull request.
8. Avslutt med en kort oppsummering på norsk til eieren: hva som er endret siden forrige uke, hva som må endres i løsningen, lenke til pull requesten, og hva som må sjekkes for hånd. Er alt uendret: «Ingen endringer i krav, satser eller priser denne uken.»

Rutinen henter bare offentlige sider og sender ingen brukerdata ut.
