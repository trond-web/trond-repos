# 📡 Børsradar

Kjøp-, hold- og selgsignaler for ca. 90 av de mest omsatte aksjene på **Oslo Børs**, på **kort sikt (1–3 mnd)** og **lang sikt (6–12 mnd)**.
Bygger på kurser, trender, børsmeldinger, innsidehandel og analytikerdata.

> Dette er et regnestykke, ikke investeringsrådgivning. Historisk avkastning er ingen garanti for fremtidig avkastning.

## Ukesvalg (1 uke)

`analyse/uke.mjs` velger 5 aksjer for neste uke (høyst 2 per sektor). Faktorstudie fredag til fredag 2017–2026:
12-mnd momentum, sektortrend, innsidekjøp siste 10 dager og kontraktsmeldinger siste uke har virket. Uvanlig høyt volum siste uke har virket negativt.
«Kjøp etter fall», RSI-oversolgt og 1-ukes reversering har ikke virket.
Forskjellene er ca. 0,3 % per uke, omtrent det et bytte koster. En aksje beholdes derfor så lenge den er blant de 15 beste.

Test med 0,3 % kostnad per bytte: ca. 38 % per år mot 12 % for OSEBX, største fall −31 %. Porteføljen slo OSEBX i 57 % av ukene, mens hver enkelt aksje gjorde det bare i 51 % av ukene.
Tallene er trolig for gode (overlevelsesskjevhet, vekter valgt i ettertid).

## Krypto

`analyse/krypto.mjs` skriver `data/krypto.json`, som vises i fanen «Krypto».
Trendmodell for Bitcoin og Ethereum (70/30). Andelen er snittet av 7 trendsignaler: kurs over 50/100/150/200-dagers snitt, og opp siste 30/90/180 dager.
Modellen handler bare når andelen endres med minst 25 %, og sjekkes ukentlig.

Test 2018–2026 med 1 % gebyr + spread per handel. Testen omfatter 43 mynter, også mynter som kollapset (LUNA, FTT, EOS …):

| | Per år | Største fall |
|---|---|---|
| Trendmodell 70/30 BTC/ETH | ca. 28 % | ca. −46 % |
| Kjøp og hold Bitcoin | ca. 33 % | ca. −74 % |
| 20 største mynter likt vektet | ca. 2 % | ca. −85 % |

Trendmodellen gir ikke mer avkastning enn å holde Bitcoin. Den gir omtrent det samme med betydelig mindre fall.
Fanen forklarer også kjøp, salg, gebyrer, sikkerhet og skatt i Norge.

## Min portefølje

Under «Min portefølje» limer du inn beholdningen fra nettbanken: én linje per aksje med ticker, markedsverdi og urealisert gevinst/tap,
f.eks. `KOG 29 244,60 −2 453,05`. Antall og kjøpskurs regnes ut fra dagens kurs. Porteføljen kan også sendes inn i lenken:
`…/borsradar/#portefolje=KOG:29244.6:-2453.05,MPCC:36175:9182`. Lenkedelen etter `#` sendes ikke til serveren, og alt lagres bare i nettleseren.

Hver aksje får en handling (Selg, Vurder å selge, Reduser, Behold, Behold/kjøp mer) ut fra signalene på kort og lang sikt, vekten i porteføljen og sektorvekten.
Siden viser også varsler om store tap (kjøpskursen påvirker ikke hvor aksjen går videre), lav likviditet og kommende rapporter.
Til slutt foreslår den hvor pengene fra salgene kan plasseres: aksjer med kjøpssignal i sektorer porteføljen har lite av.

## Datakilder

| Kilde | Hva |
|---|---|
| Yahoo Finance | 10 års daglige kurser (justert for utbytte), Brent-olje og USD/NOK; nøkkeltall (P/E, P/B, resultat, egenkapital); analytikere (anbefalinger, kursmål, estimatendringer, resultat mot estimat, neste rapportdato) |
| Oslo Børs Newsweb (`api3.oslo.oslobors.no/v1/newsreader`) | Alle børsmeldinger siden 2016: kvartalsrapporter, kontrakter, emisjoner, varsler, oppkjøp og tilbakekjøp. Meldinger om innsidehandel leses og tolkes som kjøp eller salg (`analyse/innside.mjs`) |

## Filer

| Fil | Hva |
|---|---|
| `analyse/analyser.mjs` | Hovedskript: henter data, bygger historisk panel, tester modellene og skriver `data/analyse.json` |
| `analyse/kilder.mjs` | Henting fra Yahoo og Newsweb |
| `analyse/faktorer.mjs` | Ca. 30 faktorer per aksje og dato (bare data kjent på datoen) |
| `analyse/modell.mjs` | Modellene (vekter), IC-beregning og selvlærende kontrollmodell |
| `analyse/innside.mjs` | Tolker innsidemeldinger: kjøp, salg, tilbakekjøp eller annet (aksjeprogram, opsjoner, emisjon …) |
| `analyse/tickere.json` | Aksjene som analyseres |
| `data/innsidehandel.json` | Lager over tolkede innsidemeldinger, så de ikke må leses på nytt hver dag |
| `index.html`, `app.js`, `style.css` | Nettsiden |

GitHub Actions (`deploy-pages.yml`) kjører analysen hver handelsdag kl. 16:45 UTC og publiserer på GitHub Pages under `/borsradar/`.
Feiler hentingen, publiseres siste `data/analyse.json` fra repoet.

```bash
node borsradar/analyse/analyser.mjs      # ca. 20 sek (2 min første gang)
python3 -m http.server -d borsradar 8000  # åpne http://localhost:8000
```

## Modellene

Ca. 30 faktorer er testet måned for måned på Oslo Børs fra 2017. Hver faktor fikk en informasjonskoeffisient (IC) for 1 og 12 måneder frem i tid, og hendelser ble testet med hendelsesstudier.
En modell som lærte alle vektene selv (walk-forward) ga bare ca. 16 % i året, under «alle aksjer likt vektet». Med ca. 70 aksjer er det for mye støy til å lære mange vekter.
Derfor bygger modellene på faktorer som er godt dokumentert i forskning, og som har virket i **begge halvdeler** av perioden:

**Kort sikt:** momentum 12 mnd (30), momentum 6 mnd (20), trend (20), sektortrend (20), momentum 3 mnd (10), utbytte (10), innsidekjøp (10), store dagshopp/«lotteri» (−10), kontraktsmeldinger (5), nyhetsreaksjon (5), reaksjon på kvartalsrapport (5), negative varsler (−5).
Analytikerdata teller 15 %: estimatendringer, endring i anbefalinger og siste resultat mot estimat.

**Lang sikt:** trend (40), sektortrend (20), momentum 12 mnd (20), momentum 6 mnd (20), utbytte (10), innsidekjøp (10).
Analytikerdata og nøkkeltall teller 25 %: P/E, P/B, egenkapitalavkastning, estimatendringer og kursmål.

**Signal:** KJØP ved score ≥ 75 og kurs over 200-dagers snitt. SELG ved score ≤ 25 eller tydelig fallende trend. HOLD ellers.

Testet uten effekt (derfor utelatt): lave kurssvingninger, RSI, 1-mnd reversering, sesong, tilbakekjøp, oljefølsomhet og markedsfilter (kontanter når OSEBX er under 200-dagers snitt).

## Historisk test (2017–2026, 10 aksjer, 0,4 % kostnad per bytte)

| | Per år | Største fall |
|---|---|---|
| Kort sikt (bytter månedlig) | ca. 29 % | ca. −22 % |
| Lang sikt (12-mnd pakker) | ca. 25 % | ca. −21 % |
| Selvlærende kontrollmodell (fra 2019) | ca. 16 % | ca. −20 % |
| OSEBX | ca. 11 % | ca. −25 % |
| Alle aksjene likt vektet | ca. 17 % | ca. −34 % |

Tallene er trolig for gode:
- **Overlevelsesskjevhet:** dagens aksjeliste er brukt, så selskaper som forsvant underveis er ikke med.
- **Valgt i ettertid:** modellvektene er valgt etter å ha sett dataene.
- **Ikke testet:** analytikerdata og nøkkeltall finnes bare for i dag.

Kursbrudd i Yahoo-dataene (uregistrerte spleiser o.l.) holdes utenfor beregningene.
