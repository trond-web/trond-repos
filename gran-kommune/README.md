# Gran kommune – steder og vær

En nettleserapp med kart over Gran kommunes adresser: rådhuset, skoler og SFO, barnehager, helse- og
omsorgsinstitusjoner, kultur og idrett, teknisk drift, brann/legevakt/NAV, og nyttige ikke-kommunale steder
(private barnehager, Hadeland videregående, Fagertun sykehjem, politiet). For hvert sted vises:

- **Vær og temperatur** fra Meteorologisk institutt, rett i kartmarkøren. Velg *nå*, *om 3/6 timer*, *i kveld*
  eller *i morgen* øverst. Klikk et sted for vind, nedbør, luftfuktighet og varsel time for time.
- **Avstand fra Gran rådhus** (Rådhusvegen 39, Jaren): luftlinje med retning, og kjøreavstand/-tid med bil.
  Avstandsringer på 5, 10, 20 og 30 km i kartet.
- **Virksomhetene på adressen** med organisasjonsnummer (lenke til Brønnøysundregistrene) og antall ansatte.
  Mange virksomheter deler adresse – f.eks. ligger 23 virksomheter på rådhuset – og vises som ett punkt.

Lista kan filtreres på kategori og tekst, sorteres på avstand, navn, temperatur eller kategori, og lastes ned
som CSV (åpnes i Excel). Du kan også legge til egne adresser i Gran; de huskes i nettleseren.

## Datakilder

Alt hentes direkte fra nettleseren. Det er ingen server og ingen innlogging.

| Data | Tjeneste |
|---|---|
| Kommunens virksomheter og adresser | [Enhetsregisteret](https://data.brreg.no/enhetsregisteret/api/docs/index.html): underenheter under Gran kommune (961381541) og organisasjonsleddene (oppvekst, helse og omsorg, …) |
| Ikke-kommunale steder | Enhetsregisteret, underenheter i kommune 3446 med næringskode barnehage, videregående, sykehjem og politi |
| Koordinater | Kartverkets [adresse-API](https://ws.geonorge.no/adresser/v1/) og [stedsnavn-API](https://ws.geonorge.no/stedsnavn/v1/) |
| Vær | MET [Locationforecast 2.0](https://api.met.no/weatherapi/locationforecast/2.0/documentation), symboler fra [metno/weathericons](https://github.com/metno/weathericons) |
| Kjøreavstand | [OSRM](https://project-osrm.org/) (OpenStreetMap) |
| Kart | Kartverket topografisk / gråtone, Esri flyfoto |

Kategori settes ut fra næringskoden i Enhetsregisteret. Har en virksomhet adresse som ikke finnes i
adresseregisteret (f.eks. «Rogne» eller et nedlagt husnummer), brukes stedsnavn eller en annen adresse i samme
gate, og stedet merkes «omtrentlig plassering».

`data/steder.json` er et øyeblikksbilde av virksomhetene med koordinater, slik at kartet vises med en gang.
Appen henter likevel ferske data fra registrene hver gang den åpnes, og øyeblikksbildet lages på nytt ved
hver publisering.

## Utvikling

```sh
node data/hent-data.mjs        # nytt øyeblikksbilde i data/steder.json
node tests/run.mjs             # enhetstester
LIVE=1 node tests/run.mjs      # også mot de ekte tjenestene
python3 -m http.server         # og åpne http://localhost:8000/
```
