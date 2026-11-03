// Brukerveiledning som vises i appen under «Veiledning».
export const UTVIKLER = 'Trond Harald Sand';

const del = (tittel, innhold, apen = false) => `<details class="veiledning-del"${apen ? ' open' : ''}><summary>${tittel}</summary><div>${innhold}</div></details>`;

export function veiledningHtml() {
  return `
  <section class="kort veiledning">
    <h1>Brukerveiledning</h1>
    <p>Skogsprotokoll harehund er laget for dommere på jaktprøver for drivende hunder under NHKF. Du fører loggen i skogen
    med store knapper. Appen strekker losminuttene, regner lospoeng, egenskapspoeng og premiegrad etter jaktprøvereglene
    (gjeldende fra 01.07.2025), og lager ferdig jaktprøveprotokoll og premieliste. Trykk på en overskrift for å lese mer.</p>

    ${del('1. Kom i gang', `
      <ol>
        <li>Åpne appen og logg inn med brukernavn og passord. Telefonen husker innloggingen til du trykker «Logg ut» nederst på oversikten.</li>
        <li>Legg appen på hjemskjermen: i Safari trykker du Del-knappen og «Legg til på Hjem-skjerm», i Chrome menyen ⋮ og «Legg til på startskjermen».</li>
        <li>Åpne appen én gang med nett før du går i skogen. Etter det virker den uten dekning.</li>
        <li>Trykk «Vis eksempel» på oversikten for å se en ferdig utfylt prøve.</li>
      </ol>`, true)}

    ${del('2. Ny prøve – hund og prøve', `
      <p>Trykk «+ Ny prøve». Fanen <strong>Hund og prøve</strong> åpnes.</p>
      <ul>
        <li><strong>Rase:</strong> velg fra lista over rasene NHKF har ansvar for. Gruppen settes automatisk: beagle og drever blir småhund, og feltet for boghøyde dukker opp.</li>
        <li><strong>Født:</strong> brukes til alder (minst 15 måneder) og til grensene for klovdyrjag (under eller over 24 måneder).</li>
        <li><strong>Prøvetype:</strong> ÅP, SP, EP eller annen. Ved EP velger du dag 1, og trykker «Opprett dag 2 for samme hund» når det er aktuelt.</li>
        <li><strong>Temperatur:</strong> skriv tallet og trykk «−/+» for minusgrader. Under −15 °C får du varsel.</li>
        <li><strong>Utstyr:</strong> kryss av for peileutstyr hvis hunden går med peil (gir knappen «Los kun på peil»), og for GPS hvis du vil lagre posisjonen på hver hendelse.</li>
      </ul>
      <p>Alt lagres fortløpende. Trykk «Til skogen →» når du er klar.</p>`)}

    ${del('3. I skogen – knappene', `
      <p>Knappene endrer seg etter hva hunden gjør. Den store knappen er alltid det som normalt skjer videre.</p>
      <table class="tabell">
        <thead><tr><th>Når</th><th>Stor knapp</th><th>Andre knapper</th></tr></thead>
        <tbody>
          <tr><td>Før slipp / koblet</td><td>Slipp</td><td>–</td></tr>
          <tr><td>Søk</td><td>Fot</td><td>Uttak / los (rett i los), Kobling</td></tr>
          <tr><td>Fot påvist</td><td>Uttak / los</td><td>Nytt fot, Kobling</td></tr>
          <tr><td>Los</td><td>Tap</td><td>Ut av hørehold, Los kun på peil, Losdyr sett, Hund sett, Stålos (hjort), Gått inn (LIB), Slutt los, Kobling</td></tr>
          <tr><td>Tap</td><td>Gjentak</td><td>Dødtap / slutt los, Gått inn (LIB), Kobling</td></tr>
          <tr><td>Ute av hørehold / peil</td><td>Inn i hørehold – full los</td><td>Slutt los, Kobling</td></tr>
        </tbody>
      </table>
      <ul>
        <li><strong>Uttak / los:</strong> velg losdyr. Lospoeng gis bare når arten er konstatert. Er du usikker, velg «Ukjent losdyr».</li>
        <li><strong>Kobling:</strong> velg grunn. Ved LIB, samjag, fare eller forulykket losdyr slås en ny los på samme art sammen med den forrige.</li>
        <li><strong>Losdyr sett:</strong> velg avstand til hunden. To observasjoner med ulik avstand trengs for nyansering 5.</li>
        <li><strong>Klovdyrjag, Innkalling og Notat</strong> finnes hele tiden. Innkalling fra los utenfor synsvidde trengs for lydighet 5.</li>
        <li><strong>Avslutt prøven</strong> kobler hunden og tar deg til Bedømming.</li>
      </ul>`)}

    ${del('4. Stoppeklokka og varslene', `
      <ul>
        <li>Øverst ser du klokka, løs-tid og hvor lenge hunden har vært i søk, fot, los eller tap.</li>
        <li>Måleren viser lospoeng for losen, med streker for kravene til 3., 2. og 1. premie.</li>
        <li><strong>Tap:</strong> under 5:00 står det «Tap – ikke noterbart (noterbart om m:ss)». Et tap på 4:59 eller kortere teller som los. Ved 5:00 skifter det til «Noterbart tap» og telefonen vibrerer.</li>
        <li><strong>Full tid</strong> (støver 120 på hare og 90 på rev, beagle/drever 90): telefonen vibrerer og du får beskjed om å beordre kobling.</li>
        <li>Du får også varsel ved klovdyrjag over grensen for hundens alder, jag av bufe og under 5 timer løs (skal gi T).</li>
      </ul>`)}

    ${del('5. Rette tider og legge til i ettertid', `
      <ul>
        <li>Alle klokkeslett i <strong>Skogslogg</strong> kan rettes, også sekundene. Trykk på tiden og endre den.</li>
        <li>Trykk «+ Legg til i ettertid» for å føre inn hendelser fra papir eller hukommelse.</li>
        <li>Trykk ✕ for å slette en hendelse som ble feil.</li>
        <li>Lospoeng, tap og tilleggsregistreringer regnes om med en gang.</li>
      </ul>`)}

    ${del('6. Loser og premielos', `
      <ul>
        <li>Appen foreslår losen som gir best resultat. Fører bestemmer losdyr, og du kan velge en annen los under <strong>Bedømming</strong>.</li>
        <li>En los er <strong>premielos</strong> først når den har nok lospoeng til 3. premie: støver 60 på hare og 40 på rev, beagle/drever 40. Kortere loser vises som «Ikke premielos» med hvor mye som mangler.</li>
        <li>Streking starter ett minutt etter uttak. Ute av hørehold (LUH) gir tillegg på maks 20 per gang. LUH og peil til sammen kan ikke bli mer enn hørt los.</li>
        <li>Gjentak eller inn i hørehold etter 90 minutter eller mer regnes som ny los.</li>
        <li>LIB gir 20 lospoeng én gang per dag etter minst 30 minutter hørt los.</li>
        <li>Du kan slå sammen eller skille loser med avkrysningene under premielosen.</li>
      </ul>`)}

    ${del('7. Bedømming', `
      <ul>
        <li>Gi 1–5 for hvert moment (3 er en gjennomsnittlig prestasjon), eller G. Vekttallene regnes inn automatisk.</li>
        <li>Momenter som ikke skal bedømmes etter lostiden, er grået ut (ingen los, under 30 minutter eller over 30 minutter hørt los).</li>
        <li>Under et moment kan det komme varsel når poenget ikke holder etter reglene, for eksempel jaktlyst 5 under 6 timer.</li>
        <li>Merk av mål: enstonig (E) eller to-/flertonig (T/F).</li>
        <li><strong>Avslutning uten premiering:</strong> G, T, U eller A. Grunnen skal stå i tilleggsopplysninger.</li>
        <li>Trykk «Sett inn påkrevde opplysninger» for å få forslag til tekst om tilleggsloser, sammenslåing og lignende.</li>
        <li>Sammendraget øverst viser poengene og hva som mangler til neste premiegrad.</li>
      </ul>`)}

    ${del('8. Protokoll, signatur og deling', `
      <ul>
        <li>Fanen <strong>Protokoll</strong> viser ferdig utfylt jaktprøveprotokoll med Los 1–4, tilleggsregistreringer og skogsloggen.</li>
        <li>Dommer og fører kan signere med fingeren i feltene nederst.</li>
        <li>«Skriv ut / lagre PDF» lager protokollen for utskrift eller som PDF.</li>
        <li>«Del sammendrag» sender en kort tekst med resultatet, for eksempel på SMS.</li>
        <li>Øverst ser du hvordan resultatet blir i DogWeb.</li>
      </ul>`)}

    ${del('9. Resultater og premieliste', `
      <ul>
        <li>Trykk «Resultater» på oversikten.</li>
        <li><strong>Premieliste:</strong> satt opp som i DogWeb/Arra, med vektede poeng og rangert etter premiegrad og konkurransepoeng. Prøver med samme ref.nr. samles i én liste. Skriv ut liggende, eller last ned som CSV til Excel.</li>
        <li><strong>Per hund:</strong> som fanen «Harehundprøve» i DogWeb. Trykk på en linje for detaljene (MA, LD, LT, JL, SK, FO, MF, MT, AL, AT, MN, MH, KO, LY, Mål, Premie).</li>
        <li>Bare avsluttede prøver kommer med.</li>
      </ul>`)}

    ${del('10. Lagring, sikkerhetskopi og ny telefon', `
      <ul>
        <li>Protokollene lagres bare på denne telefonen, ikke på nett.</li>
        <li>Trykk «Eksporter (JSON)» i protokollen for å ta vare på en prøve eller sende den til andre.</li>
        <li>Trykk «Importer…» på oversikten for å hente inn en eksportert prøve, for eksempel på ny telefon.</li>
        <li>Sletter du nettleserdata for siden, forsvinner protokollene. Eksporter først.</li>
      </ul>`)}

    ${del('11. Ordliste', `
      <dl class="ordliste">
        <dt>LUH</dt><dd>Los ut av hørehold</dd>
        <dt>LPP</dt><dd>Los registrert på peileutstyr</dd>
        <dt>LIB</dt><dd>Losdyret har gått inn / gått i berg</dd>
        <dt>SLH</dt><dd>Stålos på hjort</dd>
        <dt>Noterbart tap</dt><dd>Tap på 5 minutter eller mer</dd>
        <dt>Premielos</dt><dd>Los med nok lospoeng til minst 3. premie</dd>
        <dt>G / T / U / A</dt><dd>Graverende feil / trukket / avsluttet pga. vær og føre / alvorlig, akutt skade</dd>
        <dt>IS</dt><dd>Ikke startet (dag 2 på EP)</dd>
      </dl>`)}

    <p class="dempet">Appen hjelper dommeren, men dommerkollegiet fastsetter alltid endelig premiering.</p>
    <p class="laget-av">Laget av <strong>${UTVIKLER}</strong></p>
  </section>`;
}
