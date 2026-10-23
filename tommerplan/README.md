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
| **Ordre (VSYS)** | Innkjøpsordre (IO), salgsordre (SO) og produksjonsordre (PO) som i Skogdata VSYS Virkeshandel. Les inn CSV-uttrekk, lag ordreutkast fra planen, rediger ordrene og last ned ordreplanen med planlagte datoer og volum. |
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

## Sammenheng med Skogdata VSYS Virkeshandel

Planen henger sammen med ordrekjeden i Virkeshandel:

- **Innkjøpsordre (IO)** mot skogeier eller leverandør gir volum per sortiment på drifta. Hentestedet kobles til drifta på navn,
  og drifta opprettes hvis den mangler. En IO-linje kan kobles til en salgsordre (som IO–SO-koblingen i VSYS), og da går virket bare dit.
- **Salgsordre (SO)** mot kunde styrer mottaket. Ordrevolumet fordeles jevnt per uke og sortiment i ordreperioden og blir
  aldri overlevert. Et mottak med salgsordre tar bare imot sortimentene i ordrene. Planen varsler når salgsordrene
  ikke blir levert innen perioden, og når det er solgt mer eller mindre enn det som skal hogges.
- **Produksjonsordre (PO)** gir maskinlag (entreprenør), tidligst start og frist. Faktisk produsert, framkjørt og transportert
  per statusdato er startpunktet: det som er produsert men ikke framkjørt, ligger i skogen, og det som er framkjørt men ikke
  transportert, ligger ved velteplassen.

Data går inn og ut som CSV (VH-klienten, Excel eller uttrekk fra replikadatabasen). Én rad per ordrelinje, og vanlige kolonnenavn
gjenkjennes (Ordrenr, Ordretype, Leverandør/Skogeier, Kunde, Hentested, Leveringssted, Sortiment, Volum, Pris, Fra, Til,
Salgsordre, Entreprenør, Innkjøpsordre, Produsert, Framkjørt, Transportert, Statusdato). Sortimentsnavn tolkes automatisk, og
egne sortimentkoder kan knyttes til appens sortimenter. Ordre med samme nummer oppdateres ved ny innlesing. Direkte kobling mot
Skogdatas API eller replikadatabase krever tilgang fra Skogdata og en server, og er ikke med her.

Tallene er utgangspunkt og ikke fasit. Kalibrer mot entreprenørens produksjonstall, lokale aksellastlister og kjøperens krav.

## Kjøre lokalt

```
python3 -m http.server -d tommerplan 8000
node tommerplan/tests/run.mjs
```

Laget av Trond Harald Sand.
