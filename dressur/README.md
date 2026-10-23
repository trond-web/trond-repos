# Dressurstevne – påmelding, dommermodul og resultatservice

Komplett løsning for dressurstevner etter NRYFs konkurransereglement for dressur (**KR IV, 09.03.2026**):
påmelding på nett, trekning av startrekkefølge og starttider, egen dommermodul med innlogging der dommerne fører
protokollen på nettbrett, live resultater og offisielle resultatlister, og dommerprotokoller til rytterne etterpå.

Ingen avhengigheter – bare Node 20+ og standardbiblioteket. Data lagres i én JSON-fil.

## Fire sider

| Side | Hvem | Hva |
|---|---|---|
| `/` | Alle | Stevneinfo og klasser, påmelding, startlister, live resultater, «Mine påmeldinger» (se, trekke, hente protokoller med påmeldingskoden) |
| `/dommer` | Dommere (egen innlogging) | Mine klasser, startliste, protokoll per ekvipasje med karaktertaster, kommentarer, signering og retting |
| `/sekretariat` | Sekretariatet | Stevne, program, klasser, dommere, påmeldinger, trekning, resultater, offisiell liste, eksport, logg og sikkerhetskopi |
| `/protokoll` | Rytter / sekretariat | Dommerprotokollene for utskrift eller PDF |

## Reglene som er bygget inn

**Karakterer og utregning (§ 450)**
- Karakterer 0–10 med halve karakterer; tideler kan velges for kür kunstnerisk inntrykk og andre punkter. Koeffisient per øvelse og per karakter for allment inntrykk.
- Prosent per dommer = poeng / maks × 100, deretter fradrag. Sluttresultat = snittet av dommernes prosent, 3 desimaler, fjerde siffer 1–4 ned og 5–9 opp.
- Feilridning −0,5 første gang, −1,0 andre gang, eliminering tredje gang. Tekniske feil (hilsen, start før signal, over 45 sek, antrekk, pisk, benbelegg …) −0,5 per gang. Fradraget trekkes hos **hver** dommer.
- **Hoveddommeren på C** bestemmer feilridning, feil og eliminering (med årsak) – de andre dommerne ser det, men kan ikke endre det.
- Øvelse som ikke ble vist fordi en feilridning ikke ble oppdaget, kan få snittet av de andre øvelsene (§ 450.3.f).
- Kür: teknisk og kunstnerisk prosent regnes hver for seg og deles på to, ingen feilridning, −0,5 % fra kunstnerisk ved tidsavvik (§ 451).
- Karakter 0–4 må begrunnes før protokollen kan signeres (§ 461.2.a).
- Etter signering kan karakterer bare rettes med grunn; opprinnelig karakter, ny karakter og grunn logges og står på protokollen (§ 450.1.c).
- Dommerne ser bare sine egne protokoller og ingen resultatlister i dommermodulen (§ 450.1.d–e).

**Rangering og premiering**
- Høyest prosent vinner. Likhet på de tre første plassene avgjøres av høyest sum for allment inntrykk; i kür kunstnerisk inntrykk, så harmoni, så koreografi (§ 450.5.b). Ellers delt plassering.
- Under 50 % gir ikke plassering eller premie (§ 450.5.c). Clear round-klasser gir sløyfe til alle på 50 % eller mer.
- Andel premierte settes per klasse (standard 1/4 av startende, rundet opp).
- Varsel om dommermøte når dommerne skiller 7 prosentpoeng eller mer (§ 450.6).
- Foreløpig resultat per dommer og foreløpig sluttresultat vises fortløpende; offisiell liste med hver dommers navn og prosent (§ 455).
- Protokollene blir tilgjengelige for rytteren når resultatlisten er offisiell (§ 455.3).

**Påmelding og startliste**
- Rytter (navn, fødselsår → kategori, klubb, lisensnr., e-post, mobil) og hest (navn, pass/UELN, fødselsår, kjønn, hest/ponni, eier). Flere klasser i samme påmelding.
- Kontroll: minstealder for hest (MB 6, MA/VB 7, VA 9 år, § 423), hest i MA eller høyere bare én klasse per dag (§ 424.3), ponniklasser, aldersgrenser per klasse, dobbel påmelding, påmeldingsfrist og etteranmelding med gebyr.
- Maks antall startende med automatisk venteliste som rykker opp når noen trekker seg.
- Loddtrekning som gir minst fem ekvipasjer mellom samme rytters hester, og starttider med fast intervall, planlagte pauser og ekstra pause om noen ellers får under 12 minutter mellom startene (§ 424.4). Konflikter på tvers av klasser vises i sekretariatet.
- Samme ekvipasje beholder samme startnummer gjennom hele stevnet.
- Hoveddommer skal sitte på C (§ 461.3); 1–5 dommere på C, E, H, M og B.

## Program

NRYFs og FEIs dressurprogram er opphavsrettslig beskyttet og følger derfor ikke med. Sekretariatet legger dem inn under
**Program** (punkt, øvelse og koeffisient per linje – kan limes inn fra et regneark), med karakterene for allment inntrykk.
Demostevnet bruker egne øvingsprogram i samme oppsett. Et program kan ikke få endret antall punkter eller koeffisienter
når det er gitt karakterer i en klasse som bruker det.

## Kjøre lokalt

```bash
cd dressur
SEKRETARIAT_PASSORD=hemmelig npm start   # http://localhost:3000
npm test
```

Logg inn på `/sekretariat` med brukernavn `sekretariat` og passordet. Under **Logg og backup** kan du laste et
demostevne – da vises passordene til to demodommere (`kari` på C og `ola`).

Uten `SEKRETARIAT_PASSORD` lager serveren et tilfeldig passord ved oppstart og skriver det i loggen.

## Drift

Kjøres som Node-tjeneste (f.eks. Railway, som `skogbruksplan`; `railway.json` ligger klar med `/healthz`).
Miljøvariabler:

- `SEKRETARIAT_PASSORD` (påkrevd i drift) og `SEKRETARIAT_BRUKERNAVN` (standard `sekretariat`)
- `RAILWAY_VOLUME_MOUNT_PATH` eller `DATA_DIR` – mappe for `dressur.json`. Bruk et persistent volum.
- `PORT`

Dommerpassord lagres som scrypt-hash, innlogging gir en HttpOnly/SameSite-økt i 14 timer, og gjentatte feil
sperrer innlogging i 15 minutter. Last ned sikkerhetskopi jevnlig under stevnet.

## Ikke med ennå

Utdanningsprogram (felles vurdering 4–10), unghest- og children-klasser med teknisk/kvalitet-protokoller,
lagkonkurranser og mesterskap (kap. 7), betaling på nett og e-postutsending. Utregningen er bygd slik at dette
kan legges til som egne programtyper.

Utviklet av Trond Harald Sand.
