# Skogsprotokoll harehund

Mobilapp for dommere på jaktprøver for drivende hunder (harehund) under NHKF. Dommeren fører skogsloggen med store knapper
(slipp, fot, uttak, tap, gjentak, LUH/LPP, LIB, kobling, losdyr sett, klovdyrjag, innkalling). Appen regner ut lospoeng,
tilleggsregistreringer, egenskapspoeng, premiepoeng, konkurransepoeng og premiegrad, og lager en utfylt jaktprøveprotokoll
som kan skrives ut eller lagres som PDF. Alt lagres lokalt på telefonen og virker uten nett (PWA).

Bygger på «Regler for jaktprøver for hunder tilsluttet NHKF», gjeldende fra 01.07.2025:

- Losminutter strekes fra ett minutt etter uttak. Ikke noterbare tap (under 5 min) teller som los.
- LUH gir tillegg lik antall minutter, maks 20 per gang. LUH og LPP til sammen kan ikke overstige hørt los.
  Gjentak eller inn i hørehold etter 90 min eller mer er ny los.
- LIB gir 20 lospoeng én gang per dag etter minst 30 min hørt los. Ny los på samme art etter LIB, samjag,
  fare eller forulykket losdyr slås sammen (dommeren kan overstyre).
- Full tid: støver 120 på hare og 90 på rev, beagle/drever 90. Rådyr og hjort: bare lospoeng innen 180 min etter uttak.
- Egenskaper 1–5 med vekttall (maks 80). Hvilke momenter som bedømmes, følger lostiden (ingen los, under 30 min, over 30 min).
- Premiekrav for støver hare og rev og for beagle/drever, G/T/U/A og eliteprøve over to dager (321/261/195).
- Regelsjekk: varsel ved full tid, klovdyrjag over aldersgrensen, under 5 timer løs, og poeng som krever mer
  (for eksempel jaktlyst 5 under 6 timer eller nyansering 5 uten to observasjoner).

Resultater settes opp som i DogWeb:

- **Premieliste** per prøve (samme ref.nr. samles) med kolonnene fra Arra/DogWeb-premielisten: vektede egenskapspoeng,
  egenskapspoeng, lospoeng, premiepoeng, premiegrad, kondisjon, lydighet, konkurransepoeng, losdyr, mark, G, trukket og RR.
  Rangert etter premiegrad og konkurransepoeng. Kan skrives ut liggende eller lastes ned som CSV.
- **Per hund** som fanen «Harehundprøve» i DogWeb: dato, sted, premie og arrangør, med detaljer i DogWebs koder
  (MA, LD, LT, JL, SK, FO, MF, MT, AL, AT, MN, MH, KO, LY, Mål, Premie). EP vises som én linje med premie per dag.

Dommerkollegiet fastsetter alltid endelig premiering.

## Kjøre lokalt

```
python3 -m http.server -d harehund-skogsprotokoll 8000
node harehund-skogsprotokoll/tests/run.mjs
```

Utviklet av Trond Harald Sand.
