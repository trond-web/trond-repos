# stanford2010-verktoy

Verktøy for **StanForD 2010** – standarden skogsmaskiner bruker for å utveksle data.
Løsningen kan:

- **Lese** rapporter fra maskinen: `hpr` (hogstproduksjon), `hqc` (kontrollmåling),
  `fpr` (lassbærer), `mom` (driftsoppfølging) m.fl. → tabeller, CSV og JSON
- **Lage** instruksjoner til maskinen: `pin` (aptering/prismatrise), `spi` (treslag),
  `oin` (hogstobjekt) – fra enkle JSON-filer, eller ved å **trekke ut oppsettet fra en
  hpr** og kopiere det til en annen maskin
- **Validere** mot regler fra Skogforsk (og mot offisielle XSD-er, valgfritt)
- **Kommunisere med maskinen** via mappe/minnepinne, eller via en **REST-hub** som
  følger Skogforsks spesifikasjon *StanForD File REST v1.0*, med en gateway-agent på
  maskinsiden
- **Simulere** en hogstmaskin for å teste hele kjeden uten ekte maskin

Kun Python-standardbiblioteket (3.9+). `lxml` trengs bare for XSD-validering.

Testet mot ekte filer fra John Deere TimberMatic H (v3.0–3.6), Komatsu
MaxiXplorer/MaxiXT, Ponsse Opti4G, Rottne og Vimek.

---

## Installasjon

```bash
pip install .            # gir kommandoen sf2010
pip install .[xsd]       # med XSD-validering
python -m unittest discover -s tests -v
```
Uten installasjon: `python -m stanford2010 <kommando>` fra prosjektmappa gjør det samme som `sf2010`.

## Kom i gang

```bash
# Les en hpr fra maskinen
sf2010 info objekt.hpr
sf2010 eksport objekt.hpr --ut eksport/          # stammer, stokker, sammendrag som CSV (;-separert)

# Lag instruksjoner
sf2010 lag pin examples/produkter.json --ut aptering.pin
sf2010 lag spi examples/treslag.json   --ut treslag.spi
sf2010 lag oin examples/objekt.json    --ut objekt.oin
sf2010 valider aptering.pin treslag.spi objekt.oin

# Kopier oppsett fra én maskin til en annen
sf2010 trekk-ut maskinA.hpr --ut oppsett/        # gir maskinA.pin og maskinA.spi

# Test uten maskin
sf2010 simuler aptering.pin --stammer 100 --ut test.hpr
```

### JSON for produkter (pin)

Se `examples/produkter.json`. Viktigste felt:

| Felt | Betydning |
|---|---|
| `product_user_id` | Produktets ID hos dere (må være unik, store/små bokstaver telles likt) |
| `species_group_user_id` | Kobling til treslag i spi, f.eks. `NO1_Gran` |
| `diameter_classes_mm`, `length_classes_cm` | Klassenes nedre grenser |
| `diameter_max_mm`, `length_max_cm` | Øvre grense (må være over største klasse) |
| `prices` | Tall, `{"default":…, "by_diameter":{…}}` eller full `matrix` [diameter][lengde] |
| `forbidden_cells` | `[[diameter, lengde], …]` som maskinen ikke får kappe |
| `cutting_window_cm` | `[nedre, øvre]` kappvindu |
| `volume_diameter_category` m.fl. | Volumregel, f.eks. `"Calculated Norwegian mid"` |

## Python

```python
from stanford2010 import open_file, build_pin, validate, write_file

f = open_file("objekt.hpr")          # også .hprz (komprimert)
f.machine, f.objects(), f.stems(), f.logs(), f.summary()
f.control_comparison()               # hqc: maskin mot manuelt kontrollmål
f.loads()                            # fpr: lass

pin = build_pin({"products": [...]})
print(validate(pin))                 # validate(pin, xsd_dir="skjema/") for XSD
write_file(pin, "aptering.pin")
```

## Web-verktøy

`sf2010 server` gir også et web-verktøy på **`/app`** (f.eks. `http://server:8710/app`):

- **Les rapport:** slipp inn hpr/hqc/fpr/mom og få volum per treslag og produkt, kart over
  stammene, stokkliste, kontrollmåling (hqc) og lass (fpr), med CSV-eksport.
- **Lag instruksjon:** rediger produkter med prismatrise (skriv `X` for å forby kapping),
  treslag og hogstobjekt. Kontrollen kjøres mens du skriver. Last ned eller send rett til maskinen.
- **Valider:** sjekk vilkårlige StanForD-filer.
- **Maskiner:** logg inn med API-nøkkel, se når maskinene sist var i kontakt, åpne rapporter
  fra huben og send pin/spi/oin til én maskin eller alle maskiner hos en oppdragsgiver.

Siden er én HTML-fil uten byggesteg (`stanford2010/web/index.html`). Etter endringer i
`stanford2010/web/app.html`: kjør `python tools/build_web.py`. Uten internett faller skrifttypene
tilbake til systemskrift, og zip-nedlasting av flere filer krever tilgang til cdnjs.

---

## Kommunikasjon med hogstmaskinen

StanForD 2010 standardiserer **filene**, ikke transporten. Regel R2.2 sier at maskinen
skal ha en fast mappe for filene, og Skogforsk har publisert en REST-spesifikasjon – men
den har per i dag ingen kjente implementasjoner i maskinene. Løsningen dekker derfor tre veier:

```
 Kontor / skogsystem                        Hub                      Maskin
 ───────────────────                ─────────────────────      ──────────────────────
 sf2010 send PIN ...   ──POST──▶    sf2010 server     ◀─poll─  sf2010 agent
 sf2010 hent HPR ...   ◀──GET───    (StanForD REST    ──────▶  ├─ importmappe ← pin/spi/oin
                                     + SQLite-arkiv)   ◀─POST─ └─ eksportmappe → hpr/hqc/mom
```

**1. Minnepinne / delt mappe** (fungerer med alle maskiner i dag)
```bash
sf2010 til-mappe aptering.pin treslag.spi --til /media/usb/import   # validerer, skriver atomisk
sf2010 importer /media/usb/export --arkiv arkiv/ --csv csv/          # dubletter hoppes over
```

**2. REST-hub** (StanForD File REST v0.1)
```bash
sf2010 server --lager hub/ --brukere examples/users.json --vert 0.0.0.0 --port 8710 \
              --cert cert.pem --key key.pem
sf2010 send PIN aptering.pin --url https://hub:8710 --nokkel <kontor-nøkkel> --maskin <maskin-ID>
sf2010 send SPI treslag.spi  --url https://hub:8710 --nokkel <kontor-nøkkel> --oppdragsgiver 999888777
sf2010 hent HPR --url https://hub:8710 --nokkel <kontor-nøkkel> --til innboks/   # kjør f.eks. hver time
```
Implementerte endepunkter: `/`, `/Capabilities`, `/File/v0.1`, liste/HEAD/GET av
HPR/HQC/MOM/FPR m.fl. med filtrene `BaseMachineManufacturerID`, `ObjectUserID`,
`StartDate`, `EndDate`, POST av SPI/PIN/OIN til én maskin eller (SPI/PIN/FDI) til alle
maskiner hos en oppdragsgiver, og `status/syncronization/{maskin}` (stavet som i
spesifikasjonen). Tilgang styres per oppdragsgiver (`BusinessID` i ObjectDefinition), som
spesifikasjonen beskriver. Både `/File/v0.1` og `/File_v0.1` godtas.

**3. Gateway-agent ved maskinen** – en PC/Raspberry Pi som ser maskinens filmapper (nettverksdeling,
eller mappa produsentens skytjeneste synker til):
```bash
sf2010 agent --url https://hub:8710 --nokkel <maskin-nøkkel> --maskin 1WJ1170GTPL003867 \
             --eksportmappe /mnt/maskin/export --importmappe /mnt/maskin/import --intervall 60
```
Agenten laster opp nye rapporter (venter til fila er ferdigskrevet), henter instruksjoner,
validerer dem, skriver dem atomisk og kvitterer. Ved nettbrudd prøver den igjen.
Opplasting fra maskin og innboks/kvittering er **utvidelser** av spesifikasjonen (den sier ikke
noe om maskinsiden) og er merket slik i koden.

Prøv hele kjeden lokalt med en simulert maskin:
```bash
sf2010 server --lager hub/ --brukere examples/users.json &
sf2010 send PIN aptering.pin --url http://127.0.0.1:8710 --nokkel kontor-ENDRE-MEG --maskin 1WJ1170GTPL003867
sf2010 agent --url http://127.0.0.1:8710 --nokkel maskin-ENDRE-MEG --maskin 1WJ1170GTPL003867 \
             --eksportmappe sim/eksport --importmappe sim/import --simuler --intervall 5
sf2010 hent HPR --url http://127.0.0.1:8710 --nokkel kontor-ENDRE-MEG --til innboks/
```

---

## Viktig før bruk mot maskiner i drift

- **Valider mot de offisielle XSD-ene.** Last ned «Released schemas» for versjonen maskinen
  kjører (oftest 3.x) fra [Skogforsk](https://www.skogforsk.se/english/projects/stanford/stanford-2010/),
  pakk ut og kjør `sf2010 valider fil.pin --xsd skjema/`. Strukturen i `pin` følger
  skjemadokumentasjonen; `spi` og `oin` er bygget etter strukturen i ekte hpr-filer og
  **må** sjekkes mot XSD før de sendes til en maskin.
- **Test instruksjoner i produsentens kontorprogram eller på én maskin først.** Feil i en
  prismatrise gir feil aptering og verdi­tap.
- **Barkfunksjonene i `examples/treslag.json` er plassholdere.** Bruk Skogforsks anbefalte
  norske spi-fil som utgangspunkt, eller `sf2010 trekk-ut` fra en maskin som er kalibrert.
- **hpr er akkumulert:** maskinen skriver hele objektet på nytt hver gang. Nyeste fil per
  maskin og objekt gjelder. Hull i stammenummer meldes som advarsel (delrapport eller tapt data).
- Maskiner kan rapportere **flere versjoner av samme produkt** (endret underveis i hogsten).
  `trekk-ut` beholder nyeste per `ProductUserID`.
- Bruk HTTPS ved fjerntilgang (`--cert/--key` eller en proxy foran), og bytt nøklene i
  `examples/users.json`.
- Simulatoren bruker en forenklet stammemodell og skal ikke brukes til virkesmåling.

## Struktur

```
stanford2010/
  messages.py     meldingstyper, navnerom, versjoner
  xmlio.py        lesing/skriving, komprimerte filer (.hprz)
  reader.py       hpr/hqc/fpr/mom → tabeller
  writer.py       pin/spi/oin/hpr-byggere, uttrekk fra hpr
  validate.py     regelsjekk + XSD
  simulator.py    simulert hogstmaskin
  store.py        arkiv (SQLite + filer)
  rest_server.py  StanForD File REST-hub
  rest_client.py  klient (kontor og maskin)
  sync.py         minnepinne/mappe og gateway-agent
  cli.py          kommandoen sf2010
  web/            web-verktøyet (app.html → index.html)
tools/build_web.py
examples/         produkter.json, treslag.json, objekt.json, users.json
tests/            enhetstester og ende-til-ende-test
```

## Kilder

- Skogforsk: StanForD 2010 – skjemaer, regler og REST-spesifikasjon
  <https://www.skogforsk.se/english/projects/stanford/stanford-2010/>
- StanForD File REST v1.0 (2021-02-07)
- StanForD2010 rules table v1.8
- sf2010r (NIBIO) – R-pakke med eksempelfiler fra flere maskinprodusenter, brukt til testing
  <https://github.com/hbelbo/sf2010r>
