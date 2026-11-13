# Vurdering av personvernkonsekvenser (DPIA) – SkogIQ.ai

| | |
|---|---|
| **Status** | Utkast til godkjenning hos behandlingsansvarlig |
| **Dato** | 2026-11-11 |
| **Bygger på** | Vilkår og personvernerklæring, erklæring versjon: 1.5 (`js/personvern.js`) |
| **Behandlingsansvarlig** | Trond Harald Sand (SkogIQ.ai), trond@strafferunden.no. Organisasjonsnummer legges inn når foretak er etablert |
| **Neste gjennomgang** | Ved endringene i kapittel 8, og senest 2027-11-11 |

Dokumentet følger strukturen i GDPR artikkel 35 nr. 7 og Datatilsynets veiledning: beskrivelse, nødvendighet og proporsjonalitet, risikovurdering og tiltak. Det er et faglig utkast og ikke juridisk rådgivning. Behandlingsansvarlig må gå gjennom, justere og godkjenne det (kapittel 9).

---

## 1. Er DPIA påkrevd?

GDPR artikkel 35 krever DPIA når en behandling *sannsynligvis vil medføre høy risiko*. Vurderingen bygger på Datatilsynets liste over behandlinger som alltid krever DPIA, og på Personvernrådets (EDPB) ni kriterier. Treffer en behandling to eller flere av kriteriene, er DPIA normalt påkrevd.

| Kriterium (EDPB) | SkogIQ.ai | Treff |
|---|---|---|
| 1. Vurdering eller scoring av personer | Nei. Beregningene gjelder skogen (volum, verdi, tiltak), ikke personen. | Nei |
| 2. Automatiserte avgjørelser med rettsvirkning | Nei. Alle forslag er veiledende, og brukeren bestemmer. | Nei |
| 3. Systematisk overvåking | GPS og sporlogg i SkogIQ Felt starter brukeren selv for ett tiltak. Ingen kontinuerlig sporing på serveren. | Delvis |
| 4. Særlige kategorier eller svært personlige opplysninger | Nei | Nei |
| 5. Stor skala | Nei. Få brukere, regional bruk. | Nei (i dag) |
| 6. Sammenstilling av datasett | Eiendom (matrikkel) kobles med SR16, natur- og kulturminnedata og brukerens egne data. Formålet er skogen, ikke profiler av personer. | Delvis |
| 7. Sårbare registrerte | Nei. Mulig unntak er ansatte hos entreprenører som bruker Felt (kapittel 4, R9). | Nei |
| 8. Ny teknologi | «Spør AI» (KI), droner, AR og VR. KI-en er valgfri og bruker brukerens egen nøkkel. | Delvis |
| 9. Hindrer utøvelse av rettigheter eller tjenester | Nei. Innsyn, sletting og protest er innebygd. | Nei |

**Vurdering:** Ingen kriterier er klart oppfylt, men tre er delvis oppfylt (3, 6 og 8). DPIA er derfor **trolig ikke påkrevd** i dag. Den gjennomføres likevel frivillig fordi:
- Datatilsynet anbefaler DPIA ved tvil.
- KI og sammenstilling av data er grensetilfeller.
- Profesjonelle kunder (skogeierandelslag, tømmerkjøpere og kommuner) vil etterspørre dokumentasjonen.
- Artikkel 24 og 32 krever uansett at risikoen vurderes og dokumenteres.

## 2. Beskrivelse av behandlingen

**Tjenesten:** SkogIQ.ai er et verktøy for skogbruksplanlegging, skogsdrift og samarbeid mellom skogeiere, entreprenører og innkjøpere. Det består av:
- en nettapp (fullversjon)
- SkogIQ Felt for mobil, som også virker uten nett
- en server på Railway (region Amsterdam, EU) med innlogging, skylagring, deling og chat

**Registrerte:**
- skogeiere
- entreprenører
- innkjøpere
- offentlige brukere
- mottakere av tilbudsforespørsler og delingslenker (uten konto)

**Behandlingene** er beskrevet i `BEHANDLINGER` i `js/personvern.js`. Tabellen gir en oversikt.

| Behandling (id) | Opplysninger | Grunnlag | Lagring |
|---|---|---|---|
| Konto og innlogging (`konto`) | E-post, navn, passord-hash, roller, godkjenninger | Avtale | Til kontoen slettes |
| Profil (`profil`) | Kontakt, foretak, adresse, kommune, fritekst, valgfritt profilbilde (vises i Nettverk, bare for innloggede) | Avtale | Til endret eller slettet |
| Bruksstatistikk (`bruk`) | Sidevisninger, kall, aktive minutter og faner per dag | Berettiget interesse (kan slås av) | 400 dager |
| Tilbakemeldinger og forslag (`tilbakemelding`) | Stjerner, type, fritekst, fane, versjon, navn og e-post; status og svar fra administrator | Brukerens initiativ | Til kontoen slettes, eller administrator sletter |
| Skylagring (`sky`) | Skogbruksplaner med eiendom, notater, bilder og sporlogger | Avtale | Til brukeren sletter; 10 versjoner og 30 dager i papirkurv |
| Overføring mellom enheter (`synk`) | Plan eller drone-rute med tilfeldig id | Brukerens initiativ | 90 dager (planer) og 14 dager (droneoppdrag) |
| Tilbudsforespørsler (`tilbud`) | Oppdrag, kontakt, mottakere, svar | Brukerens initiativ | 180 dager uten bruk |
| Deling med tømmerkjøper (`tommer`) | Utvalgte bestand, volumer, kontakt | Brukerens initiativ | Til sluttdato, senest 180 dager uten bruk |
| Nettverk og chat (`nettverk`) | Koblinger, chatmeldinger, lest-status | Avtale | Til koblingen eller kontoen slettes; høyst 2000 meldinger per kobling |
| John Deere (`jd`) | Tilgangsnøkler til Operations Center | Brukerens initiativ | Til brukeren kobler fra |
| Kart og offentlige data (`offentlig`) | Koordinater og eiendomsnummer i oppslag; IP-adressen hos leverandørene | Avtale | Lagres ikke av SkogIQ.ai |
| Spør AI (`ai`) | Spørsmål og plansammendrag til Anthropic, med brukerens egen nøkkel | Brukerens initiativ | Lagres ikke på serveren |
| Lagring i nettleseren (`lokal`) | Planer, kartfliser, innstillinger, økt | Avtale | På enheten |

**Dataflyt:**
- Nettleseren snakker med SkogIQ-serveren (HTTPS, Bearer-token eller HttpOnly-kapsel).
- Serveren lagrer data i JSON-filer på et Railway-volum.
- Nettleseren henter kart og fagdata direkte fra offentlige kilder.
- Valgfrie integrasjoner: Anthropic (fra nettleseren), John Deere (via serveren) og Resend (e-post for glemt passord, via serveren).
- **Sikkerhetskopi** (`backup.js`): hele datamappen pakkes, komprimeres og krypteres (AES-256-GCM) én gang i døgnet. Kopiene ligger på volumet (7 stykker) og, når det er satt opp, i S3-kompatibel lagring i EU utenfor Railway (30 stykker). Nøkkelen (`BACKUP_NOKKEL`) oppbevares utenfor Railway, og kopier sendes aldri ut ukryptert.

## 3. Nødvendighet og proporsjonalitet

- **Formålsbegrensning:** Opplysningene brukes bare til å levere tjenesten. Ingen reklame, ikke salg av data og ingen profilering.
- **Dataminimering:**
  - E-post er eneste obligatoriske kontaktopplysning.
  - Profilfeltene er frivillige.
  - Katalogen i Nettverk viser aldri e-post.
  - Skogeiere kan ikke ses av andre skogeiere, og aktører kan ikke søke etter skogeiere.
  - Maskinimporten (HPR) bruker ikke førerfeltene (`OperatorDefinition`).
- **Lagringsbegrensning:**
  - Faste lagringstider for delingslenker, mellomlagre og statistikk.
  - Sletting av konto sletter skylagring, nettverk og chat med en gang.
  - Sikkerhetskopier roteres. Slettede data er borte fra dem etter høyst 30 dager.
- **Riktighet:** Brukeren retter selv profil og roller, og kan registrere målte verdier.
- **Åpenhet:** Personvernerklæringen godtas ved registrering, og på nytt ved vesentlige endringer. Godkjenningene logges.
- **Rettigheter** under Min profil:
  - innsyn og dataportabilitet (nedlasting av egne data)
  - sletting av konto
  - protest mot bruksstatistikk
- **Databehandlere og overføring:**
  - Railway lagrer i EU, men er et amerikansk selskap.
  - Resend og Anthropic er amerikanske selskaper. Overføring krever EUs standardavtaler (SCC) eller EU–US Data Privacy Framework.

## 4. Risikovurdering

**Skalaer:**
- Sannsynlighet: **L** (lav), **M** (middels), **H** (høy).
- Konsekvens for de registrerte: **L**, **M**, **H**.
- **Restrisiko** gjelder etter eksisterende tiltak.

| # | Risiko (behandling) | Eksisterende tiltak | S | K | Restrisiko |
|---|---|---|---|---|---|
| R1 | Uautorisert tilgang til konto ved gjetting eller lekket passord (`konto`) | scrypt-hash med eget salt; minst 8 tegn og ikke e-postnavnet; høyst 10 feil per IP per 15 min; signerte økter; passordbytte og sperring gjør gamle økter ugyldige; HttpOnly og Secure på informasjonskapselen | L | M | **Lav**. Mangler tofaktor for administrator (T1). |
| R2 | Administrator ser mer enn nødvendig (`bruk`, `profil`) | Bare administratorrollen har brukeroversikten; statistikken kan slås av av brukeren; 400 dagers lagring | L | L | **Lav**. Ingen logg over admininnsyn (T6). |
| R3 | Lekkasje av skogdata via delingslenker (`tilbud`, `tommer`) | Lange tilfeldige koder; hver mottaker ser bare sitt; sluttdato; sletting etter 180 dager uten bruk; delingen skjer bare på brukerens initiativ | L | M | **Lav**. Lenker kan videresendes. Forespørsler er ikke knyttet til kontoen og slettes ikke ved kontosletting (T4). |
| R4 | Kartlegging av skogeiere, for eksempel innkjøpere som finner hvem som har hogstmoden skog (`nettverk`, `tommer`) | Skogeiere vises ikke i katalogen; aktører når bare skogeiere som har bedt om kobling eller som de kjenner e-posten til; skogeieren styrer all deling | L | M | **Lav**. Se trigger 8.2. |
| R5 | Trakassering eller spam i chat (`nettverk`) | Den andre parten må godta koblingen; høyst 30 meldinger/min og 2000 tegn; koblingen kan avsluttes; administrator kan sperre kontoer | L | M | **Lav**. Mangler «Rapporter»-knapp (T5). |
| R6 | Tap av data eller manglende tilgjengelighet (`sky`) | Versjonshistorikk (10), papirkurv (30 dager), lokal kopi på enhetene, eksport av planer; daglig kryptert sikkerhetskopi på volumet og utenfor Railway (`backup.js`), gjenoppretting testet med `verktoy/gjenopprett-backup.mjs`; alle mellomlagre lagres på volumet (ikke bare i minnet) | L | M | **Lav** når lagring utenfor Railway og `BACKUP_NOKKEL` er satt. **Middels** til da (T2). Mistes nøkkelen, kan kopiene ikke leses, så den må oppbevares sikkert utenfor Railway. |
| R7 | Overføring til tredjeland og leverandørtilgang (alle) | Lagring i EU (Amsterdam); Anthropic bare med brukerens egen nøkkel; e-post bare når slått på | L | M | **Lav–middels** til databehandleravtaler er inngått (T3). Google Fonts og CDN-er ser IP-adressen (T7). |
| R8 | Plandata til KI-leverandør (`ai`) | Skjer bare når brukeren stiller et spørsmål, med egen nøkkel og etter Anthropics vilkår; opplyst i erklæringen | L | L | **Lav** |
| R9 | Overvåking av ansatte via GPS og sporlogg i Felt (`sky`, `lokal`) | Sporlogg startes og stoppes av brukeren, knyttes til ett tiltak, og er ingen kontinuerlig sporing | L | M | **Lav**. Arbeidsgivere som bruker Felt på ansatte, er selv ansvarlige og må informere (T8). |
| R10 | Kobling av maskindata (HPR, John Deere) til fører (`jd`) | Importen bruker ikke førerfeltene; John Deere-nøkler bare på serveren | L | M | **Lav**. Endres dette, kreves ny DPIA (8.1). |
| R11 | Injeksjon eller XSS som lekker data (alle) | Escaping av all brukertekst; `nosniff`, `X-Frame-Options`, `Referrer-Policy`; CORS begrenset til egne adresser | L | H | **Lav–middels**. Mangler Content-Security-Policy (T9). |
| R12 | Ufullstendig sletting (`synk`, `tilbud`, `tommer`) | Kontosletting fjerner skylagring, nettverk og chat; mellomlagre har faste lagringstider; sikkerhetskopier roteres etter høyst 30 dager | M | L | **Lav** (T4) |
| R13 | Feil i modeller gir feil beslutninger (ikke personvern, men tillit) | Vilkårene sier at beregninger er veiledende; kilder og «beregnet/registrert» vises | M | M | Håndteres i vilkårene |
| R14 | Fritekst i tilbakemeldinger kan inneholde personopplysninger om andre (`tilbakemelding`) | Bare administrator ser tilbakemeldingene; teksten er begrenset til 3000 tegn og 10 per time; slettes med kontoen; administrator kan slette enkeltmeldinger | L | L | **Lav** |

**Samlet restrisiko:** lav, bortsett fra **R6** (middels til lagring utenfor Railway er satt opp) og **R7/R11** (lav–middels) inntil tiltakene under er gjennomført. Ingen restrisiko er høy, så forhåndsdrøfting med Datatilsynet (art. 36) er ikke nødvendig.

## 5. Tiltak og handlingsplan

| # | Tiltak | Risiko | Prioritet | Status |
|---|---|---|---|---|
| T1 | Tofaktor (TOTP) for administratorkontoer | R1 | Middels | Åpen |
| T2 | Automatisk sikkerhetskopi av Railway-volumet til lagring utenfor Railway i EU, med test av gjenoppretting | R6 | Høy | Bygget (versjon 1.73.0): daglig kryptert kopi lokalt og til S3 i EU, gjenopprettingsverktøy og test. Gjenstår: opprette lagring i EU, sette `BACKUP_NOKKEL` og `BACKUP_S3_*` på Railway, og prøve en gjenoppretting |
| T3 | Inngå databehandleravtale (DPA) med Railway, og med Resend når e-post slås på | R7 | Høy | Åpen |
| T4 | Knytte tilbuds- og tømmerforespørsler til kontoen, slik at de slettes ved kontosletting og tas med i innsyn | R3, R12 | Middels | Åpen |
| T5 | «Rapporter»-knapp i chat og varsel til administrator | R5 | Lav | Åpen |
| T6 | Logg over administratorhandlinger (sperring, sletting, lenker for nytt passord) | R2 | Lav | Åpen |
| T7 | Levere skrifttyper og biblioteker fra egen server (ikke Google Fonts eller CDN) | R7 | Lav | Åpen |
| T8 | Tekst i brukerveiledningen: arbeidsgiver må informere ansatte som bruker sporlogg | R9 | Lav | Åpen |
| T9 | Content-Security-Policy på serveren | R11 | Middels | Åpen |
| T10 | Fylle ut behandlingsansvarlig (`ANSVARLIG`) med navn, organisasjonsnummer og e-post | Åpenhet | Høy | Navn og e-post er gjennomført (versjon 1.72.1); organisasjonsnummer legges inn når foretak er etablert |

## 6. Rådføring

- **Personvernombud:** ikke pålagt (art. 37). Ingen kjernevirksomhet med storskala overvåking eller særlige kategorier.
- **Registrerte:** Erklæringen godtas av alle brukere, og tilbakemeldinger tas imot via administrator. Ved store endringer bør et utvalg brukere spørres, for eksempel et skogeierandelslag.

## 7. Konklusjon

Behandlingen gir ikke høy risiko for de registrertes rettigheter og friheter. Det forutsetter at dagens tiltak opprettholdes og at handlingsplanen følges. Høyest prioritet har T2 og T3. Behandlingen kan fortsette.

## 8. Når DPIA-en må gjøres på nytt

Vurderingen skal oppdateres, og vil trolig bli **påkrevd**, hvis noe av dette innføres:

1. **Maskindata knyttet til fører:** førernavn eller ID, arbeidstid eller produktivitet per person (HPR `OperatorDefinition`, John Deere).
2. **Profilering eller rangering av skogeiere** for innkjøpere eller entreprenører, for eksempel «skogeiere med hogstmoden skog nær deg» eller anbefalinger og leads.
3. **KI på serveren** med SkogIQ.ai sin nøkkel og brukernes data, eller KI som tar avgjørelser.
4. **Kontinuerlig posisjonssporing** av personer eller maskiner.
5. **Stor skala**, for eksempel avtaler med skogeierandelslag eller kommuner som omfatter mange tusen skogeiere, eller import av eierregistre.
6. **Nye tredjeparter** som mottar personopplysninger, eller lagring utenfor EU/EØS.
7. **Særlige kategorier** eller opplysninger om barn.
8. **Vesentlige endringer** i vilkår og personvernerklæring, det vil si ny `VILKAR.versjon` med `kreverGodkjenning`.

Endres erklæringen (`VILKAR.versjon`), skal tabellen øverst oppdateres. Testene sjekker at versjonen her er lik `js/personvern.js`, og at alle behandlingene er med.

## 9. Godkjenning

| Rolle | Navn | Dato | Signatur |
|---|---|---|---|
| Behandlingsansvarlig | Trond Harald Sand | | |
| Utarbeidet av | Utviklingsteamet (utkast) | 2026-11-11 | |
