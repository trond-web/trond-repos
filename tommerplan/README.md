# Tømmerplan – produksjonsplanlegger for tømmer

Laget av **Trond Harald Sand**.

Nettleserapp som planlegger hele kjeden fra hogst til mottak: hogstmaskin → lassbærer → velteplass → skogsbilveg →
tømmerbil → sagbruk, massevirke eller energi. Den simulerer dag for dag og viser hvor flaskehalsen er.
Alt lagres lokalt i nettleseren (ingen server og ingen innlogging), og appen virker uten nett (PWA).

## Hva den gjør

| Side | Innhold |
|---|---|
| **Oversikt** | Nøkkeltall, varsler og flaskehalser, maskinplan per lag (Gantt) med sesongbånd, lager ved velteplass per uke fordelt på sortiment, og framkjørt mot levert. |
| **Drifter** | Volum per sortiment, middelstamme, driftsvanskelighet, terrengtransport, føre (helår, barmark, vinter), vegklasse, velteplasskapasitet, koordinater, tidligst start og frist. Køen til hvert lag sorteres med pilene. Viser m³ per G15-time for hogstmaskin og lassbærer, og uthever flaskehalsen. |
| **Maskiner og biler** | Maskinlag (størrelse, G15-timer per dag, flyttedager) og tømmerbiler (antall, timer, m³ per lass, farter, laste- og lossetid). Turtid og lass per dag for hver drift og hvert mottak. |
| **Mottak** | Sortimenter som tas imot, ukekvote fra leveranseavtalen, og levert mot avtalt. |
| **Leveranseplan** | m³ per mottak og uke med prosent av kvoten, og tidslinje per drift. Kan lastes ned som CSV (Excel) og skrives ut. |
| **Innstillinger** | Planperiode, sesonguker (vinter, teleløsning, sommer), maks lagringstid, kalibrering av maskinmodellene, og sikkerhetskopi (JSON). |
| **God logistikk** | Hva som kreves for god tømmerlogistikk, hvordan planleggeren tar hensyn til det, og kilder. |

## Modellen

- **Hogstmaskin:** m³/G15h = A · middelstamme^B (standard 40 · v^0,6). Tynning ×0,75. Faktorer for terreng (1–5) og maskinstørrelse.
- **Lassbærer:** lass (10/14/18 m³) / (terminaltid + 2 · kjøreavstand / fart). Lagets tempo bestemmes av den tregeste maskinen.
- **Velteplass:** virket lagres i partier, først inn – først ut. Når plassen er full, venter lassbæreren.
- **Sesong:** vinterdrifter kjøres bare i vinterukene, og barmarksdrifter ikke i vinter eller teleløsning. Vegklasse 3–4 er stengt
  i teleløsningen, og klasse 5 også om vinteren. Når en drift ikke kan kjøres, tar laget neste drift i køen.
- **Tømmerbil:** kjører hele lass (restlass når drifta er ferdig eller virket haster). Den tar eldste og mest utsatte virke først,
  og kjører til nærmeste mottak med ledig ukekvote. Turtiden regnes fra skogsbilveg, offentlig veg (luftlinje × veifaktor, eller
  overstyrt km), lasting og lossing.
- **Varsler:** full velteplass, lagring over grensen (sommer 21 dager for sagtømmer og gran på grunn av blåved og barkbille, ellers 60),
  stengt veg mens virke venter, drifter som ikke blir ferdige eller går over fristen, ledige maskinlag og sortimenter uten mottak.

Tallene er utgangspunkt og ikke fasit. Kalibrer mot entreprenørens produksjonstall, lokale aksellastlister og kjøperens krav.

## Kjøre lokalt

```
python3 -m http.server -d tommerplan 8000
node tommerplan/tests/run.mjs
```

Laget av Trond Harald Sand.
