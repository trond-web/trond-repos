# StanForD 2010 – hva standarden gir, og hva verktøyet bruker

StanForD 2010 er Skogforsks standard for data mellom skogsmaskiner og
kontor/skogsystem. Alle meldinger er XML i navnerommet `urn:skogforsk:stanford2010`,
med faste enheter (mm, cm, m³, kg, ha). En melding er én fil, og filendelsen sier
meldingstypen. Komprimerte filer får `z` bakerst (`.hprz`, regel R2.1).

Versjoner: 1.0 (2011) til 3.6 (2020) er utbredt i maskinene i dag, 4.0 (2022) og 4.1 (2025)
er de nyeste. Verktøyet skriver 3.6 som standard og leser alle.

## Meldingstypene

| Fil | Retning | Innhold | Hva du kan bruke den til | I verktøyet |
|---|---|---|---|---|
| **pin** | til maskin | Produkter: diameter- og lengdeklasser, prismatrise, forbudte celler, kappvindu, volumregler, fordelingskrav, fargemerking | Styre apteringen (verdioptimering) | Lage, validere, redigere i web, trekke ut fra hpr |
| **spi** | til maskin | Treslagsgrupper: barkfunksjon, rotavsmalning, kvalitetsklasser, DBH-høyde | Riktig volum og diameter under bark | Lage, validere, trekke ut fra hpr |
| **oin** | til maskin | Hogstobjekt: ID, navn, eier, oppdragsgiver, sertifisering, delobjekter | Knytte produksjonen til teig/kontrakt | Lage, validere |
| **ogi** | begge | Kart: grenser, hensynsområder, stikkveger, punkter | Vise hensyn og grenser i maskinens kart | Lest generisk |
| **foi / fdi** | til lassbærer | Objekt og leveranser (sortiment til velteplass) | Styre framkjøringen | Gjenkjennes, sendes via hub |
| **hpr** | fra hogstmaskin | Hver stamme: treslag, DBH, posisjon, tidspunkt, stokker med produkt, lengde, diametre, volum, kappårsak; ofte hele diameterprofilen | Produksjon, sortiment, verdi, kart, produktivitet, oppgjør | **Les + full analyse** |
| **thp** | fra hogstmaskin | Summert produksjon (uten enkeltstammer) | Rask oppfølging når hpr er for stor | Lest generisk |
| **hqc** | fra hogstmaskin | Kontrollstammer målt både av maskin og manuelt, kalibreringshistorikk, innstillinger for tilfeldig kontroll | Målekvalitet, kalibrering, dokumentasjon av målingen | **Les + full analyse** |
| **mom** | fra maskin | Tidsfordeling (driftstid per arbeidsoperasjon, stopp med årsak, pauser), drivstoff, kjørt distanse, motortid, produksjon per periode, skift | Produktivitet (m³/G15-t), drivstoff (l/m³), teknisk utnyttelse, stopp-analyse | **Les + full analyse** |
| **fpr** | fra lassbærer | Lass og dellass: sortiment, volum, vekt, leveransested, kjøreavstand, tidspunkt | Framkjørt volum, lassstørrelse, transportplanlegging | **Les + full analyse** |
| **fqc** | fra lassbærer | Kontroll av kranvekt | Kalibrering av vekt | Lest generisk |
| **bpr / boi** | feller-buncher | Felt/buntet produksjon og instruksjon | Flerstammehogst | Lest generisk |
| **udi** | til maskin | Brukerdefinerte data | Egne tillegg | Gjenkjennes |
| **env** | begge | Konvolutt rundt flere meldinger | Sende flere filer samlet | Gjenkjennes |

`Extension`-elementer brukes av produsentene til eget innhold (f.eks. GNSS-kvalitet,
hogsttid per stamme, diameterfall). Verktøyet analyserer dem ikke, men de følger med i JSON-eksporten (`sf2010 eksport --json`).

## Hva analysen henter ut

### hpr – hogstproduksjon
- Volum (m³fub og m³pb) per treslag, sortiment, fører, dag og delobjekt; andeler
- Middelstamme, snitt-DBH og kvadratisk middeldiameter, stokker per stamme, snittlengde
- Diameterfordeling i 2 cm-klasser per treslag
- **Apteringsutfall:** antall stokker i hver celle av prismatrisen, og stokker i forbudte celler
- **Verdi:** pris i cellen × prisvolum (`m3 (price)`, ellers m³fub) per stokk. Klassen finnes
  med samme regel som i maskinen: diameter etter `diameterClassCategory` (topp/midt/rot,
  under eller på bark) og lengde etter nedre klassegrense.
- Kappårsaker (automatisk, manuell, råte, toppbrekk osv.)
- **Produktivitet (anslag):** tiden mellom stammer summeres; opphold over 15 min
  (innstillbart) regnes som pause. Gir m³/t og stammer/t per dag og fører.
- **Kart og areal:** stammepunkter; areal innenfor ytterste stammer (konveks hull) gir
  anslag på stammer/ha og m³/ha
- **Datakvalitet:** hull i stammenummer, dubletter, manglende koordinater/tid, ukjente produkter

### hqc – kontrollmåling
- Avvik maskin − manuelt mål for lengde og hver diameter (rot/midt/topp, på/under bark):
  snitt, standardavvik, min/maks, andel innenfor toleranse, fordeling
- Godkjent/ikke godkjent etter innstillbare krav. Standard: lengde 60 % innenfor ±2 cm og
  standardavvik maks 3 cm, diameter 50 % innenfor ±4 mm (Skogforsks mål). Sjekk mot
  avtalen dere har; Biometria og oppkjøpere kan ha egne krav.
- Forslag til kalibrering når snittavviket er systematisk
- Kalibreringshistorikk (dato, type, justering, årsak)

### mom – driftsoppfølging
- Maskintid fordelt på drift (per arbeidsoperasjon), stopp (reparasjon, service,
  forstyrrelse med årsak) og stillestående (pauser)
- G15-tid (drift + avbrudd på maks 15 min), effektiv tid, teknisk utnyttelse
- Drivstoff totalt, per motortime, per G15-time og per m³
- Produksjon fra `HarvesterData`/`ForwarderData`: m³/G15-t, stammer/G15-t
- Per dag, fører og objekt. Både individuelt (`IndividualMachineWorkTime`) og kombinert
  (`CombinedMachineWorkTime`) format.

Merk: maskinen filtrerer selv – avbrudd kortere enn `MonitoringFilterTimeDown` regnes som
driftstid. Korte avbrudd (`IndividualShortDownTime`) ligger inne i driftstidsavsnittene og
legges ikke til på nytt.

### fpr – lassbærer
- Antall lass og dellass, volum og vekt per leveranse/sortiment, snitt og største lass
- Lasstørrelsesfordeling, volum per dag, kjøreavstand fra forrige lossing

### Samlet over flere filer
- Nyeste hpr per maskin og objekt (hpr er akkumulert)
- hpr koblet mot mom for samme maskin: m³/G15-t og l/m³ for hele perioden

## Muligheter som ikke er bygget ennå

- **Diameterprofil per stamme** (`StemDiameters`): avsmalning, sjekk av barkfunksjon,
  simulere ny aptering på samme stammer for å teste en ny prismatrise
- **Stammekvalitet** (`StemGrade`) og kvalitetsfordeling langs stammen
- **ogi-filer:** lage grenser og hensynsområder fra kart (GeoJSON → ogi)
- **foi/fdi:** lage instruksjoner til lassbærer fra hpr (sortiment per velteplass)
- **thp:** sammenligne summert produksjon med hpr
- **GNSS-kvalitet og kranposisjon** (`BoomPositioning`, `Extension`) for mer nøyaktig stammekart
- Analyse i web-verktøyet (i dag: kommandolinje, Python og HTML-rapport)

## Kilder

- Skogforsk: StanForD 2010 – skjemaer, regler og dokumentasjon
  <https://www.skogforsk.se/english/projects/stanford/stanford-2010/>
- Skogforsk: Kontrollinställningar og kvalitetssäkring av skördarmätning (toleranser for hqc)
- Biometria: Kvalitetssäkrad mätning med skördare (2026)
- sf2010r (NIBIO) – eksempelfiler fra flere produsenter <https://github.com/hbelbo/sf2010r>
