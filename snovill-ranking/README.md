# Snøvill-ranking

Rangering av løpere i turrenn og langløp på ski, med egne lister for menn og kvinner.
Resultatene samles inn automatisk, og rankingen regnes ut på nytt hver gang siden publiseres
(flere ganger i døgnet via `.github/workflows/deploy-pages.yml`).

## Kilder

| Kilde | Hva | Hvordan |
| --- | --- | --- |
| [EQ Timing](https://live.eqtiming.com) | De fleste norske turrenn og mange svenske langløp | Åpent JSON-API (`/api/Events`, `/api/Event/{id}`, `/api/Result/Gender/...`) |
| [Birken](https://birken.no/no/resultatservice) | Birkebeinerrennet, SkøyteBirken, HalvBirken | `tiur.birken.no/embed/result.ashx` (maks 750 rader per søk, deles opp på klasse og pulje) |
| [Vasaloppet](https://results.vasaloppet.se) | Vasaloppet, Vasaloppet 45 og 30, Tjejvasan | Resultatlistene (HTML, 100 per side) |
| [Ski Classics](https://skiclassics.com/results/) | Pro Tour og Challengers over hele verden | Resultatsidene; løper-ID-en er FIS-koden |

Med i rankingen er turrenn og langløp på minst 20 km. Mangler distansen hos arrangøren, tas klassen med
når vinneren brukte minst 50 minutter. Ordinære langrenn (krets-, sone- og landsrenn med intervallstart),
karuseller, mesterskap, sprint, stafetter, ungdomsrenn, klasser uten tidtaking, rulleski og alt fra mai
til oktober (unntatt skiløp på den sørlige halvkule) er holdt utenfor. Klasser i samme løype samme dag
(konkurranse, trim med tid, elite) slås sammen til én resultatliste.

Når samme løp finnes både hos tidtakeren og hos Ski Classics, brukes tidtakerens fullstendige liste,
mens nivået (Pro Tour / Challengers), datoen og FIS-kodene hentes fra Ski Classics.

## Poengsystemet

```
Løpspoeng = Løpsvekt × (Tidspoeng + Plasseringsbonus)
Tidspoeng = 100 × (vinnertid / egen tid)^3
Plasseringsbonus = 50, 40, 32, 26, 22, 18, 15, 12, 10, 8, 6, 5, 4, 3, 2 for plass 1–15
Løpsvekt = Nivå × Distanse × Feltstyrke
  Nivå:       Pro Tour 1,0 · Challengers 0,8 · FIS-løp 0,7 · øvrige turrenn 0,6
  Distanse:   20–29 km 0,8 · 30–49 km 0,9 · 50 km og lengre 1,0
  Feltstyrke: 0,8–1,0 ut fra rankingpoengene til de ti beste i løpet (regnes i tre runder)
Sesongpoeng = summen av de 8 beste løpspoengene
```

Alle tall ligger i `REGLER` i `innsamling/poeng.mjs`.

Løperne kobles på tvers av løp med FIS-kode, NIF-ID og EQ Timings person-ID. Ellers kobles de på navn,
og fødselsår og klubb skiller personer med samme navn.

## Kommende renn

Påmeldingslistene til kommende turrenn hentes fra EQ Timing (`/api/Contestants/{id}`). Birken og Vasaloppet
har ikke åpne påmeldingslister ennå. Hver påmeldt kobles til rankingen med EQ-ID, FIS-kode, NIF-ID eller navn
og fødselsår, og får formpoeng:

```
Formpoeng  = summen av de 8 beste løpspoengene i fjor og i år, der fjorårets løp teller 75 %
Feltstyrke = formpoengene til de 10 beste påmeldte, i prosent av de 10 beste i hele rankingen
```

De påmeldte sorteres etter formpoeng (forventet resultatliste), og rennene kan sorteres etter feltstyrke.
Resultatet skrives til `data/kommende.json`. Siste nedlastede påmeldingsliste lagres i `data/kommende/eq.json`.

## Filer

- `innsamling/hent.mjs` – finner nye løp, henter resultatene og skriver rankingen
- `innsamling/kilder/*.mjs` – én fil per kilde
- `innsamling/poeng.mjs` – poengsystemet, sammenslåing av like løp og kobling av løpere
- `innsamling/kommende.mjs` – kommende renn: formpoeng for påmeldte og feltstyrke
- `data/lop/<sesong>/*.json` – resultatene per løp (sesongen 2025/26 ligger i repoet)
- `data/ranking-<sesong>.json`, `data/sesonger.json` – det siden viser
- `index.html`, `app.js`, `style.css` – siden

## Kjøre lokalt

```sh
node snovill-ranking/innsamling/hent.mjs                 # hent nye resultater og regn ut rankingen
node snovill-ranking/innsamling/hent.mjs --uten-nett     # bare regn ut på nytt fra lagrede løp
node snovill-ranking/innsamling/hent.mjs --sesong 2025-26
node --test snovill-ranking/tests/*.test.mjs
python3 -m http.server -d snovill-ranking 8080           # åpne http://localhost:8080
```

Et løp hentes på nytt de første tre dagene etter løpsdagen (i tilfelle listene rettes). Deretter regnes
det som ferdig og hentes ikke igjen. I GitHub Actions tas resultatene vare på i Actions-cachen mellom
kjøringene, med resultatene i repoet som utgangspunkt.
