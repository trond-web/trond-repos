# 📡 Børsradar

Kjøp-, hold- og selgsignaler for ca. 75 av de største og mest omsatte aksjene på **Oslo Børs**.

> Dette er et regnestykke, ikke investeringsrådgivning. Historisk avkastning er ingen garanti for fremtidig avkastning.

## Slik er det bygget

| Del | Hva |
|---|---|
| `analyse/analyser.mjs` | Henter 10 års kurser (utbyttejustert) og nøkkeltall fra Yahoo Finance, regner ut score og signal for hver aksje, og kjører en historisk test. Ren Node 18+, ingen avhengigheter. |
| `analyse/tickere.json` | Aksjene som analyseres (ticker, navn, sektor). Legg til eller fjern linjer her. |
| `data/analyse.json` | Resultatet som nettsiden viser. |
| `index.html`, `app.js`, `style.css` | Statisk nettside: signalliste, detaljer med kursgraf, egen portefølje (lagres i nettleseren), historisk test og metode. |

GitHub Actions (`deploy-pages.yml`) kjører analysen hver handelsdag kl. 16:45 UTC og publiserer på GitHub Pages under `/borsradar/`.
Feiler hentingen, publiseres siste `data/analyse.json` fra repoet.

Kjør lokalt:

```bash
node borsradar/analyse/analyser.mjs      # oppdaterer borsradar/data/analyse.json
python3 -m http.server -d borsradar 8000  # åpne http://localhost:8000
```

## Modellen

**Score (0–100)** = 70 % teknisk + 30 % fundamental. Hver delscore er aksjens plassering (prosentil) mot de andre aksjene.

- **Teknisk:** momentum 12 mnd uten siste måned (35 %), momentum 6 mnd (25 %), trend mot 200- og 50-dagers snitt (25 %), momentum 3 mnd (15 %).
- **Fundamental:** inntjening 1/(P/E) (35 %), utbytte (25 %), bokverdi 1/(P/B) (20 %), egenkapitalavkastning (20 %).

**Signal**
- **KJØP:** score ≥ 70 og kurs over 200-dagers snitt
- **SELG:** score ≤ 30, eller fallende trend (kurs og 50-d snitt under 200-d snitt, og negativt 12-mnd momentum)
- **HOLD:** resten

## Historisk test (2017–2026)

Hver måned kjøpes de 10 KJØP-aksjene med høyest teknisk score, likt vektet, med 0,1 % kurtasje per handel.

| | Per år | Største fall |
|---|---|---|
| Modellportefølje | ca. 25 % | ca. −23 % |
| OSEBX | ca. 11 % | ca. −25 % |
| Alle aksjene likt vektet | ca. 18 % | ca. −32 % |

Måneden etter et signal har KJØP-aksjene i snitt steget 1,9 %, mot 1,4 % for HOLD og SELG.

Vektene ble valgt etter en faktoranalyse på de samme dataene. Momentum og trend virket. Lav volatilitet, nærhet til 52-ukers topp, RSI og 1-måneds reversering virket ikke på Oslo Børs, og er derfor tatt ut av scoren.
Testen bruker dagens aksjeliste (overlevelsesskjevhet), og vektene er valgt i ettertid. Tallene er derfor trolig for gode.
Nøkkeltallene finnes ikke historisk og er ikke testet.
