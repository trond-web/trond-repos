// Brukervilkår og personvernerklæring for SkogIQ.ai: én kilde for teksten (personvern.html, innloggingssiden,
// godkjenningsdialogen i appen) og for serveren (gjeldende versjon som må godtas).
//
// HOLD DENNE OPPDATERT: Ny funksjon som lagrer, deler eller sender personopplysninger (nye /api-stier, nye
// tredjeparter, ny lagringstid) skal føres inn i BEHANDLINGER eller TREDJEPARTER. Testene stopper endringer som
// ikke er ført inn:
//   * hver /api-sti på serveren må tilhøre en behandling (api-listene under)
//   * innholdet har en sjekksum per versjon i tests/run.mjs. Endres teksten, må VILKAR.versjon økes.
// Settes VILKAR.kreverGodkjenning til den nye versjonen, må alle brukere godta på nytt ved neste innlogging.
// Brukes ved vesentlige endringer: nye formål, nye mottakere eller lengre lagring. Små språkendringer krever det ikke.

export const VILKAR = { versjon: '1.4', dato: '2026-11-13', kreverGodkjenning: '1.0' };

// Behandlingsansvarlig. Fylles ut av eieren av tjenesten (navn, organisasjonsnummer og e-post for personvern).
export const ANSVARLIG = { navn: 'Trond Harald Sand (SkogIQ.ai)', orgnr: '', epost: 'trond@strafferunden.no', adresse: '' };

// Behandlingsgrunnlag etter personvernforordningen (GDPR) artikkel 6 nr. 1.
export const GRUNNLAG = {
  avtale: 'Avtale (art. 6 nr. 1 b): nødvendig for å levere tjenesten du har registrert deg for',
  interesse: 'Berettiget interesse (art. 6 nr. 1 f): drift, sikkerhet og forbedring av tjenesten. Du kan protestere',
  forpliktelse: 'Rettslig forpliktelse (art. 6 nr. 1 c)',
  initiativ: 'Avtale (art. 6 nr. 1 b): skjer bare når du selv velger å bruke funksjonen',
};

// Hva SkogIQ.ai behandler, hvorfor, hvor lenge og hvem som får det. api = /api-stiene som hører til (se testene).
export const BEHANDLINGER = [
  { id: 'konto', navn: 'Konto og innlogging', formaal: 'Gi deg en egen konto, holde deg innlogget og la deg bytte passord.',
    opplysninger: 'E-postadresse (brukernavn), navn, passord (bare som scrypt-hash med eget salt), roller, når du registrerte deg og sist logget inn, og hvilken versjon av vilkårene du har godtatt og når.',
    grunnlag: 'avtale', lagring: 'Til kontoen slettes. Lenker for nytt passord gjelder i 1 time (24 timer når administrator lager dem).',
    mottakere: 'Ingen. Driftsleverandøren lagrer dataene (se Tredjeparter). E-post for glemt passord sendes via Resend når e-post er slått på.',
    api: ['/api/logginn', '/api/loggut', '/api/meg', '/api/registrer', '/api/glemt', '/api/tilbakestill', '/api/passord', '/api/samtykke', '/api/konto'] },
  { id: 'profil', navn: 'Profil', formaal: 'Tilpasse løsningen til rollen din, fylle ut skjemaer og rapporter, og gi «Spør AI» bakgrunn.',
    opplysninger: 'Det du selv fyller ut: telefon, gård eller foretak, organisasjonsnummer, adresse, kommune, skogeierandelslag og en kort tekst om gården.',
    grunnlag: 'avtale', lagring: 'Til du endrer det, eller kontoen slettes.', mottakere: 'Ingen. Navn, foretak, kommune og roller vises i Nettverk-katalogen for innkjøpere og entreprenører (se Nettverk).', api: [] },
  { id: 'bruk', navn: 'Bruksstatistikk', formaal: 'Se hvilke deler av løsningen som brukes, rette feil og prioritere videre utvikling. Administrator ser statistikken.',
    opplysninger: 'Per dag: antall sidevisninger og serverkall, aktive minutter og hvilke faner du har åpnet. Ingen sporing på tvers av nettsteder og ingen reklame.',
    grunnlag: 'interesse', lagring: '400 dager.', mottakere: 'Ingen.', api: ['/api/bruk', '/api/admin'] },
  { id: 'tilbakemelding', navn: 'Tilbakemeldinger og forslag', formaal: 'Ta imot ros, feilmeldinger og forbedringsforslag, svare deg og forbedre SkogIQ.ai.',
    opplysninger: 'Stjerner (1–5), type, teksten du skriver, hvilken del av appen du var i, appversjon, navnet ditt og e-postadressen (brukernavnet), og status og svar fra administrator.',
    grunnlag: 'initiativ', lagring: 'Til du sletter kontoen, eller administrator sletter tilbakemeldingen.', mottakere: 'Bare administrator.', api: ['/api/tilbakemelding'] },
  { id: 'sky', navn: 'Skylagring av skogbruksplaner', formaal: 'Lagre planene dine på serveren, slik at de er tilgjengelige på alle enhetene dine.',
    opplysninger: 'Skogbruksplanene med eiendom, bestand, tiltak, notater, bilder og sporlogger du har lagt inn.',
    grunnlag: 'avtale', lagring: 'Til du sletter planen. De 10 siste versjonene tas vare på, og slettede planer ligger 30 dager i papirkurven.',
    mottakere: 'Ingen, med mindre du selv deler (se Tilbud, Tømmerkjøper og Nettverk).', api: ['/api/sky'] },
  { id: 'synk', navn: 'Overføring mellom enheter', formaal: 'Flytte en plan mellom PC og SkogIQ Felt med en kort kode, og sende droneoppdrag til fjernkontrollen.',
    opplysninger: 'Planen eller droneruten som overføres, med en tilfeldig id.', grunnlag: 'initiativ',
    lagring: 'Planer: 90 dager uten bruk. Droneoppdrag: 14 dager. Koder: 15 minutter.', mottakere: 'Bare enhetene du kobler til.', api: ['/api/plan', '/api/plankobling', '/api/kontroller', '/api/kobling'] },
  { id: 'tilbud', navn: 'Tilbudsforespørsler', formaal: 'Sende forespørsel om tilbud på et oppdrag til utførere du velger, og ta imot svarene.',
    opplysninger: 'Oppdraget (område, tiltak, frister og vilkår), kontaktinformasjonen du oppgir, og navnet og e-postadressen til mottakerne du velger. Svarene fra mottakerne.',
    grunnlag: 'initiativ', lagring: '180 dager uten bruk.', mottakere: 'Mottakerne du velger. Hver mottaker ser bare forespørselen og sitt eget svar.', api: ['/api/tilbud'] },
  { id: 'tommer', navn: 'Deling med tømmerkjøper', formaal: 'Dele utvalgte bestand og volumer med en tømmerkjøper, som kan svare med pris eller anslag.',
    opplysninger: 'Det du velger å dele: eiendom, bestand, volumer og kart, og kontaktinformasjonen din.',
    grunnlag: 'initiativ', lagring: 'Til lenken utløper (du velger dato), og senest 180 dager uten bruk.', mottakere: 'Tømmerkjøperne du sender lenken til.', api: ['/api/tommer'] },
  { id: 'nettverk', navn: 'Nettverk og chat', formaal: 'Koble skogeiere med innkjøpere og entreprenører, og la dem skrive til hverandre i SkogIQ.ai.',
    opplysninger: 'Koblingene dine (hvem, rolle, status og tidspunkter) og chatmeldingene med tidspunkt og når de ble lest. Innkjøpere og entreprenører vises i en katalog med navn, foretak, kommune og roller, aldri e-post.',
    grunnlag: 'avtale', lagring: 'Til koblingen eller kontoen slettes. Høyst 2000 meldinger per kobling (de eldste slettes først).',
    mottakere: 'Den du er koblet til, ser meldingene i samtalen deres. Skogeiere ser ikke andre skogeiere, og aktører kan ikke søke etter skogeiere.', api: ['/api/nettverk'] },
  { id: 'jd', navn: 'John Deere Operations Center', formaal: 'Hente maskindata (HPR og sporlogger) fra John Deere når du kobler til kontoen din der.',
    opplysninger: 'Tilgangsnøkler (tokens) fra John Deere og hvilken organisasjon du har gitt tilgang til.', grunnlag: 'initiativ',
    lagring: 'Til du kobler fra.', mottakere: 'Deere & Company (USA) – dataene hentes derfra etter din innlogging hos John Deere.', api: ['/api/jd'] },
  { id: 'offentlig', navn: 'Kart og offentlige data', formaal: 'Vise kart, eiendomsgrenser, skogdata, vær, flom og andre fagdata for eiendommen din.',
    opplysninger: 'Kartutsnitt, koordinater og eiendomsnummer som slås opp. Nettleseren sender IP-adressen din til leverandørene, slik den gjør for alle nettsider.',
    grunnlag: 'avtale', lagring: 'SkogIQ.ai lagrer ikke oppslagene. Leverandørene har egne regler for logger.',
    mottakere: 'Offentlige kilder som Kartverket, NIBIO, Meteorologisk institutt, NVE, Miljødirektoratet, Artsdatabanken (artsfunn og rødliste), Statens vegvesen og Riksantikvaren. Vær- og flomdata fra NVE hentes via SkogIQ-serveren.', api: ['/api/nve'] },
  { id: 'ai', navn: 'Spør AI', formaal: 'Svare på spørsmål om skogbruksplanen din.',
    opplysninger: 'Spørsmålet ditt og et sammendrag av planen (eiendom, bestand, tiltak, økonomi og profilteksten om gården).',
    grunnlag: 'initiativ', lagring: 'SkogIQ.ai lagrer ikke samtalen på serveren. Nøkkelen din lagres bare i nettleseren.',
    mottakere: 'Anthropic (USA), direkte fra nettleseren med din egen API-nøkkel, etter Anthropics vilkår. Brukes bare når du selv stiller et spørsmål.', api: [] },
  { id: 'lokal', navn: 'Lagring i nettleseren', formaal: 'Bruke appen uten nett og huske innstillinger.',
    opplysninger: 'Planer, kartfliser, innstillinger og innloggingsøkt lagres på enheten din (IndexedDB, localStorage og én informasjonskapsel for innloggingen).',
    grunnlag: 'avtale', lagring: 'Til du logger ut, sletter planen eller tømmer nettleseren.',
    mottakere: 'Ingen. Bare strengt nødvendige informasjonskapsler (ekomloven § 3-15), derfor ikke samtykke til informasjonskapsler.', api: [] },
];

// Leverandører som behandler data på vegne av SkogIQ.ai (databehandlere), eller som nettleseren henter innhold fra.
export const TREDJEPARTER = [
  { navn: 'Railway Corporation', rolle: 'Drift av serveren og lagring av data (databehandler)', land: 'Serveren og lagringen er i Railway sin region i Amsterdam (EU). Selskapet er amerikansk, og overføring er sikret med EUs standardavtaler (SCC).' },
  { navn: 'Lagring av sikkerhetskopier', rolle: 'Krypterte sikkerhetskopier av dataene på serveren, utenfor Railway (databehandler). Kopiene krypteres med en nøkkel bare SkogIQ.ai har, før de sendes ut', land: 'S3-kompatibel lagring i EU/EØS.' },
  { navn: 'GitHub (Microsoft)', rolle: 'Leverer selve appen (filene) fra github.io', land: 'USA/EU. Ser IP-adressen din. Data om skogen din sendes ikke dit.' },
  { navn: 'Resend', rolle: 'Sender e-post for glemt passord, når e-post er slått på (databehandler)', land: 'USA, EUs standardavtaler (SCC).' },
  { navn: 'jsDelivr, unpkg og Google Fonts', rolle: 'Programbiblioteker og skrifttyper som nettleseren henter', land: 'Globale nettverk. Ser IP-adressen din.' },
  { navn: 'Anthropic', rolle: 'Spør AI, bare med din egen API-nøkkel', land: 'USA.' },
  { navn: 'Deere & Company', rolle: 'John Deere Operations Center, bare når du kobler til', land: 'USA.' },
  { navn: 'Offentlige kartkilder', rolle: 'Kartverket, NIBIO, MET, NVE, Miljødirektoratet, Artsdatabanken, Statens vegvesen, Riksantikvaren m.fl.', land: 'Norge.' },
];

export const RETTIGHETER = [
  ['Innsyn og dataportabilitet', 'Under Min profil → Personvern kan du laste ned alle opplysningene SkogIQ.ai har om deg som en JSON-fil. Planene eksporterer du fra appen.'],
  ['Retting', 'Endre navn, kontaktinformasjon og roller under Min profil.'],
  ['Sletting', 'Under Min profil → Personvern kan du slette kontoen. Da slettes profilen, skylagrede planer, koblinger og chatmeldinger og bruksstatistikken din med en gang. Krypterte sikkerhetskopier slettes fortløpende og er borte etter høyst 30 dager.'],
  ['Protest', 'Under Min profil → Personvern kan du slå av bruksstatistikken for kontoen din. Da slettes også statistikken som er samlet inn.'],
  ['Klage', 'Du kan klage til Datatilsynet (datatilsynet.no) hvis du mener vi behandler opplysningene dine i strid med regelverket.'],
];

export const VILKAAR = [
  ['Tjenesten', 'SkogIQ.ai er et verktøy for skogbruksplanlegging, skogsdrift og samarbeid mellom skogeiere, entreprenører og innkjøpere. Funksjoner kan endres, legges til eller fjernes.'],
  ['Beregninger er veiledende', 'Prognoser, volum, verdier, tilvekst, driftsveier, skiltplaner, kart og AI-svar bygger på modeller og offentlige data med usikkerhet. De erstatter ikke befaring i felt, fagkyndige vurderinger eller lovpålagte søknader og meldinger. Du er selv ansvarlig for beslutningene du tar.'],
  ['Ditt innhold', 'Du eier dataene du legger inn. Du gir SkogIQ.ai rett til å lagre og behandle dem for å levere tjenesten, og ikke til noe annet. Du skal ha rett til å bruke dataene du laster opp og deler.'],
  ['Deling og chat', 'Du bestemmer selv hva du deler og med hvem. Opptre saklig i chat og forespørsler. Spam, trakassering eller misbruk kan føre til at kontoen sperres.'],
  ['Konto og sikkerhet', 'Kontoen er personlig. Hold passordet hemmelig, og si fra hvis du tror noen andre har fått tilgang.'],
  ['Tilgjengelighet og ansvar', 'Vi gjør vårt beste for at tjenesten er tilgjengelig og at data ikke går tapt, men kan ikke garantere det. Ta jevnlig eksport av viktige planer. SkogIQ.ai er ikke ansvarlig for indirekte tap.'],
  ['Endringer', 'Ved vesentlige endringer i vilkårene eller personvernerklæringen får du beskjed ved neste innlogging og må godta på nytt for å fortsette.'],
  ['Avslutning', 'Du kan slette kontoen når som helst. Kontoer som bryter vilkårene, kan sperres.'],
];

const e = (v) => String(v ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
export const datoTekst = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
export const kontaktTekst = () => (ANSVARLIG.epost ? `<a href="mailto:${e(ANSVARLIG.epost)}">${e(ANSVARLIG.epost)}</a>` : 'administratoren for SkogIQ.ai');

// Innholdet som har sjekksum (testene): endres noe av dette, må versjonen økes.
export const innhold = () => JSON.stringify({ ANSVARLIG, GRUNNLAG, BEHANDLINGER, TREDJEPARTER, RETTIGHETER, VILKAAR, kreverGodkjenning: VILKAR.kreverGodkjenning });

// Kort sammendrag for godkjenningsdialogen.
export const KORT = [
  'Du eier dataene dine. Vi bruker dem bare til å levere SkogIQ.ai, og selger dem aldri.',
  'Du bestemmer selv hva du deler med entreprenører, innkjøpere og andre.',
  'Beregninger og kart er veiledende og må kontrolleres i felt.',
  'Du kan laste ned dataene dine og slette kontoen når som helst under Min profil.',
];

// Hele erklæringen som HTML (personvern.html og dialogen «Les hele»).
export function html() {
  const ans = ANSVARLIG;
  return `<p class="pv-meta">Versjon ${e(VILKAR.versjon)} · gjelder fra ${e(datoTekst(VILKAR.dato))}</p>
<h2 id="vilkar">Brukervilkår</h2>
${VILKAAR.map(([t, x]) => `<h3>${e(t)}</h3><p>${e(x)}</p>`).join('')}
<h2 id="personvern">Personvernerklæring</h2>
<p><b>Behandlingsansvarlig</b> er ${e(ans.navn)}${ans.orgnr ? ` (org.nr. ${e(ans.orgnr)})` : ''}${ans.adresse ? `, ${e(ans.adresse)}` : ''}. Spørsmål om personvern: ${kontaktTekst()}.</p>
<p>Vi behandler så lite personopplysninger som mulig, bare for å levere tjenesten, og aldri for reklame. Vi selger ikke data.</p>
<h3>Hva vi behandler</h3>
<div class="pv-liste">${BEHANDLINGER.map((b) => `<details class="pv-beh" id="pv-${e(b.id)}"><summary><b>${e(b.navn)}</b><span>${e(b.formaal)}</span></summary><dl>
<dt>Opplysninger</dt><dd>${e(b.opplysninger)}</dd><dt>Grunnlag</dt><dd>${e(GRUNNLAG[b.grunnlag])}</dd><dt>Lagringstid</dt><dd>${e(b.lagring)}</dd><dt>Mottakere</dt><dd>${e(b.mottakere)}</dd></dl></details>`).join('')}</div>
<h3>Leverandører og overføring</h3>
<table class="pv-tabell"><thead><tr><th>Leverandør</th><th>Rolle</th><th>Hvor</th></tr></thead><tbody>${TREDJEPARTER.map((t) => `<tr><td>${e(t.navn)}</td><td>${e(t.rolle)}</td><td>${e(t.land)}</td></tr>`).join('')}</tbody></table>
<h3>Sikkerhet</h3><p>All trafikk er kryptert (HTTPS). Passord lagres bare som hash. Det tas daglig kryptert sikkerhetskopi (AES-256), som oppbevares i høyst 30 dager. Delingslenker har tilfeldige, hemmelige koder, og innloggingen er beskyttet mot gjentatte gjetteforsøk. Bare administrator har tilgang til brukeroversikten.</p>
<h3>Dine rettigheter</h3>
<dl class="pv-rett">${RETTIGHETER.map(([t, x]) => `<dt>${e(t)}</dt><dd>${e(x)}</dd>`).join('')}</dl>`;
}
