// Brukerveiledning i appen: kapitler med søk, innholdsliste og utskrift. Åpnes fra «?» i menyen, kommandolinjen
// («hjelp») og fra «?»-knapper med data-hjelp (kapittel-id) der funksjonene er. Ingen DOM i innholdet – kan testes i Node.

const steg = (liste) => `<ol class="hj-steg">${liste.map((x) => `<li>${x}</li>`).join('')}</ol>`;
const tips = (t) => `<p class="hj-tips">💡 ${t}</p>`;
const obs = (t) => `<p class="hj-obs">⚠️ ${t}</p>`;

export const KAPITLER = [
  {
    id: 'kom-i-gang', ikon: '🚀', tittel: 'Kom i gang',
    tekst: `<p>SkogIQ.ai er skogbruksplanen din i kart: bestand, tiltak, økonomi og oppdrag på ett sted – på PC, nettbrett og mobil.</p>
      ${steg([
        '<b>Lag eller åpne en plan</b> under <b>Planer</b> i menyen til venstre. Skriv kommune og gårds-/bruksnummer, så henter SkogIQ eiendomsgrensen og skogdata (skogbruksplan, SR16 og markslag). Du kan også importere en plan (SOSI, GeoJSON, CSV) eller prøve <b>demoskogen</b>.',
        '<b>Se over bestandene</b> i <b>Oversikt</b> og <b>Bestand</b>. Trykk på et bestand i kartet for detaljer.',
        '<b>Lag tiltaksplanen</b> under <b>Tiltak</b> – med tiltaksmotoren eller for hånd.',
        '<b>Lag oppdrag</b> av det som skal gjøres, og følg arbeidsflyten: driftsveg, skiltplan, tilbud, maskin og sjekkliste.',
        '<b>Rapporter</b> gir utskrifter og PDF til banken, kommunen, tømmerkjøperen eller sertifiseringen.',
      ])}
      ${tips('Trykk <kbd>Ctrl</kbd> + <kbd>K</kbd> (eller søkefeltet øverst) for å søke etter bestand, funksjoner og handlinger – det er ofte den raskeste veien.')}
      <p>Planene lagres på enheten og i skyen når du er logget inn, så du har dem på alle enhetene dine.</p>`,
  },
  {
    id: 'kart', ikon: '🗺️', tittel: 'Kart og kartlag',
    tekst: `<p>Kartet viser bestandene farget etter valget i <b>Farge etter</b> (hogstklasse, treslag, bonitet, alder, tiltak …).</p>
      <ul><li><b>Kartlag</b> (knappen med lag-ikonet) slår på bakgrunnskart, flyfoto, bratthet, markfuktighet, naturtyper, arter, kulturminner, naboeiendommer, kommunale planer og mer.</li>
      <li><b>Trykk i kartet</b> på et bestand for detaljer, eller på et naturtype-, arts- eller kulturminneområde for faktaark.</li>
      <li><b>Tegnforklaringen</b> nede til venstre forklarer fargene. Den kan felles sammen.</li>
      <li><b>Tegn bestand</b> lar deg tegne et nytt bestand; i bestandsvisningen kan du endre grensen eller dele bestandet i to.</li></ul>
      ${tips('Knappen med sikte-ikonet viser hvor du står (GPS) – nyttig ute i skogen.')}`,
  },
  {
    id: 'bestand', ikon: '🌲', tittel: 'Bestand',
    tekst: `<p>Et bestand er en del av skogen med noenlunde lik skog. Bestandsvisningen viser treslag, bonitet, alder, volum, hogstklasse, tetthet, driftsforhold (bratthet og markfuktighet), miljøfigur og tiltak.</p>
      <ul><li><b>Endre</b> verdiene direkte i skjemaet – alt lagres automatisk.</li>
      <li><b>Legg til tiltak</b> i bestandet; de havner i tiltaksplanen.</li>
      <li><b>🥽 Gå inn i skogen</b> viser bestandet i 3D – også med VR-briller.</li>
      <li><b>Rediger grense</b> og <b>Del i to</b> endrer kartet.</li></ul>
      ${tips('Miljøfigurer (🦉) får aldri forslag om hogst, og holdes utenfor driftsveger og oppdrag.')}`,
  },
  {
    id: 'tiltak', ikon: '✅', tittel: 'Tiltak og tiltaksplan',
    tekst: `<p>Tiltaksplanen (<b>Tiltak › Tiltaksplan</b>) er listen over alt som skal gjøres i skogen, sortert på år. Hvert tiltak viser bestand, areal, volum og anslått netto eller kostnad.</p>
      <h4>Få tiltak inn i planen</h4>
      ${steg([
        '<b>Tiltaksmotor</b>: velg prinsipp (balansert, økonomi først, biologi og miljø først, karbon og klima) og horisont, og trykk <b>Lag forslag</b>. Forslagene vises med begrunnelse («Hvorfor?»).',
        'Gå gjennom forslagene og trykk <b>＋ Legg til i planen</b> på dem du vil ha – eller <b>Legg til alle</b>.',
        'Eller legg til tiltak for hånd fra bestandsvisningen.',
      ])}
      <h4>Knappene på hvert tiltak</h4>
      <ul><li><b>✓ Marker utført</b> – når tiltaket er gjort (trykk igjen for å angre).</li>
      <li><b>＋ Oppdrag</b> – lag et oppdrag med dette ene tiltaket.</li>
      <li><b>🔍 Kart</b> – vis bestandet i kartet. <b>✎ Endre</b> – type, år, areal, prioritet og kommentar. <b>✕</b> – slett.</li>
      <li>Merket <b>O-2026-01 · Utkast</b> viser at tiltaket ligger i et oppdrag – trykk for å åpne det.</li>
      <li><b>P1–P3</b> er prioritet (P1 er viktigst). <b>⚠️ forfalt</b> betyr at året er passert uten at tiltaket er utført.</li></ul>
      <h4>Filtre</h4><p>Velg <b>Planlagte</b>, <b>Utførte</b> eller <b>Alle</b>, og en tiltakstype, for å korte ned listen.</p>
      ${tips('Tiltak med sporlogg (fra SkogIQ Felt) har eget areal – bare den delen av bestandet som faktisk er behandlet.')}`,
  },
  {
    id: 'oppdrag', ikon: '📋', tittel: 'Oppdrag – fra plan til utført jobb',
    tekst: `<p>Et <b>oppdrag</b> samler ett eller flere tiltak av samme type til en bestilling til en utfører: hogstentreprenør, tømmerkjøper, planteleverandør eller ungskogpleier. Oppdraget har sin egen arbeidsflyt.</p>
      <h4>Lage oppdrag</h4>
      ${steg([
        '<b>Ett tiltak:</b> trykk <b>＋ Oppdrag</b> på tiltaket i tiltaksplanen.',
        '<b>Flere tiltak:</b> trykk <b>Nytt oppdrag</b>, kryss av tiltakene (eller velg type og trykk på bestandene i kartet), og trykk <b>Lag oppdrag</b>. Ulike typer blir egne oppdrag.',
        'Oppdraget åpnes under <b>Tiltak › Oppdrag</b>.',
      ])}
      <h4>Fanene i oppdraget</h4>
      <ul><li><b>Oversikt</b> – arbeidsflyten (neste steg er markert), tittel, status, periode, felt for oppdragstypen, instruks til utfører og tiltakene i oppdraget.</li>
      <li><b>Planlegging</b> – <a href="#" data-hjelp="driftsveg">forslag til driftsveg</a> og <a href="#" data-hjelp="skiltplan">skiltplan</a>.</li>
      <li><b>Utfører</b> – <a href="#" data-hjelp="tilbud">be om tilbud</a>, eller skriv inn utføreren direkte.</li>
      <li><b>Maskin</b> (hogst) – <a href="#" data-hjelp="maskin">filsett til hogstmaskinen</a> og produksjonsfiler tilbake.</li>
      <li><b>Sjekkliste</b> – PEFC-krav og praktiske punkter for oppdragstypen.</li></ul>
      <h4>Arbeidsflyten</h4>
      <p>Øverst i Oversikt ser du stegene i rekkefølge, med ✓ for det som er gjort og ➜ for <b>neste steg</b>. Trykk på et steg for å gå dit. Valgfrie steg kan hoppes over.</p>
      ${steg(['Sett periode', 'Lag driftsveg (hogst, valgfritt)', 'Lag skiltplan', 'Be om tilbud eller velg utfører', 'Marker som bestilt', 'Send filsett til maskin (hogst, valgfritt)', 'Gå gjennom sjekklisten', 'Marker som utført – tiltakene i planen merkes utført'])}
      <h4>Status</h4><p><b>Utkast</b> → <b>Bestilt</b> → <b>Pågår</b> → <b>Utført</b> (eller <b>Avbrutt</b>). Et tiltak kan bare ligge i ett aktivt oppdrag om gangen.</p>
      ${tips('<b>Skriv ut arbeidsordre</b> gir utføreren kart, tiltak, instruks, sjekkliste – og driftsvegen hvis du har beholdt den.')}
      ${obs('<b>Slett oppdraget</b> (nederst i Oversikt) sletter bare oppdraget – tiltakene blir liggende i tiltaksplanen.')}`,
  },
  {
    id: 'driftsveg', ikon: '🛤️', tittel: 'Driftsveg',
    tekst: `<p>For hogstoppdrag lager SkogIQ et forslag til <b>basveg</b> for lassbæreren: fra hogstflatene til velteplass ved bilvei, med minst mulig kjørespor og inngrep i terrenget, og der det står mest tømmer.</p>
      ${steg(['Åpne oppdraget › <b>Planlegging</b>.', 'Velg lengste stikkveg (50 m anbefales; 30 m gir tettere nett, 80 m færre spor).', 'Trykk <b>Foreslå driftsveg</b>. Høydedata, markfuktighet, kulturminner, naturtyper og veier hentes – det tar et halvt minutt.', 'Se forslaget i kartet (oransje stiplet linje, blå velteplasser) og tallene: nytt spor, dekning, våt mark, helning.', '<b>Behold</b> eller <b>Slett</b>. Et beholdt forslag kommer på arbeidsordren og kan lastes ned som <b>GPX</b> til GPS-en i maskinen.'])}
      <p>Forslaget unngår vann, kulturminner (med sikringssone), miljøfigurer og terreng som er for bratt sidelengs eller i stigning, går helst utenom våt mark og naturtyper, og bruker eksisterende traktorveier. Private veier foretrekkes som endepunkt, fordi velteplass ved offentlig vei krever arbeidsvarsling.</p>
      ${obs('Forslaget er et utgangspunkt – entreprenøren justerer i terrenget. Permanent traktorveg med graving eller planering krever godkjenning fra kommunen.')}
      ${tips('Legg inn bilveier og velteplasser i <b>Veier</b>-fanen og miljøfigurer i bestandene – da blir forslaget bedre.')}`,
  },
  {
    id: 'skiltplan', ikon: '🚧', tittel: 'Skiltplan og arbeidsvarsling',
    tekst: `<p>Skiltplanen finner ut om oppdraget berører offentlig vei eller stier, og hvilke skilt og søknader som trengs.</p>
      ${steg(['Lag gjerne driftsveg først (eller legg inn velteplassen i Veier-fanen).', 'Åpne oppdraget › <b>Planlegging</b> › <b>Lag skiltplan</b>.', 'Se stedene som krever varsling, skiltene med plassering (også i kartet), søknaden og kravlisten.', 'Fyll inn <b>ansvarlig for arbeidsvarslingen</b> med kompetansebevis, og når skiltene settes opp og tas ned.', '<b>Skriv ut skiltplan</b> og legg den ved søknaden. Kryss av kravene etter hvert.'])}
      <h4>Når trengs arbeidsvarslingsplan?</h4>
      <ul><li>Tømmer legges ved <b>offentlig vei</b> (velteplass).</li><li>Tømmertransport <b>krysser</b> offentlig vei.</li><li>Det hogges <b>inntil</b> offentlig vei.</li></ul>
      <p>Riks- og fylkesvei: søk hos Statens vegvesen på Din side (tjenesten «Arbeidsvarsling»). Kommunal vei: søk hos kommunen. Planen gjelder til siste lass er hentet. Den ansvarlige må ha kurs i arbeidsvarsling (kompetansebevis gyldig i 5 år).</p>
      <h4>Tømmer ved offentlig vei</h4>
      <ul><li>Minst 3 m fra vegkanten, aldri i skjæring eller på fylling.</li><li>Må ikke kunne rulle ut i veien eller grøfta, eller ta sikten i kryss.</li><li>Bunnfloa høyst 1 m over eller under kjørebanen. Ikke under strømførende ledninger.</li></ul>
      ${obs('Skiltplanen er et forslag. Endelig plan godkjennes av Statens vegvesen eller kommunen.')}`,
  },
  {
    id: 'tilbud', ikon: '📨', tittel: 'Be om tilbud fra utførere',
    tekst: `${steg(['Åpne oppdraget › <b>Utfører</b> › <b>Be om tilbud</b>.', 'Fyll inn beskrivelse, prisform (enhetspris eller fastpris), frister, betaling og seriøsitetskrav.', 'Legg til mottakerne og send hver sin <b>personlige lenke</b> på e-post, SMS eller kopier lenken. Mottakerne trenger ikke innlogging.', 'Trykk <b>Hent svar</b>. Tilbudene sammenlignes på pris, krav og frister – det billigste fullstendige er markert.', '<b>Tildel</b> oppdraget. Utføreren, prisen og perioden føres inn i oppdraget, og du kan sende aksept og avslag.'])}
      ${tips('Har du allerede avtale, skriv bare inn utføreren i feltene under tilbudsdelen.')}`,
  },
  {
    id: 'maskin', ikon: '🌲', tittel: 'Hogstmaskin og lassbærer (StanForD)',
    tekst: `<p>For hogstoppdrag kan du laste ned et <b>filsett</b> som hogstmaskin og lassbærer åpner (StanForD 2010): oppdraget, bestandene, kart med hensyn og velteplasser, og apteringsinstruks.</p>
      ${steg(['Åpne oppdraget › <b>Maskin</b>.', 'Velg versjon og koordinatsystem (standardvalgene passer de fleste maskiner).', '<b>Last ned filsett (ZIP)</b>, kopier til minnepinne og importer i maskinen (se LES_MEG.txt).', 'Etter drift: <b>Les inn produksjonsfiler</b> (.hpr, .fpr …). Tiltakene merkes utført med virkelig volum, og hogd flate vises i kartet.'])}`,
  },
  {
    id: 'tommerkjoper', ikon: '🤝', tittel: 'Del med tømmerkjøper',
    tekst: `<p>Under <b>Verdi › Del med tømmerkjøper</b> deler du bestand, volumer, kart og driftsforhold med en eller flere tømmerkjøpere – og får prisforslag tilbake.</p>
      ${steg(['Trykk <b>Ny deling</b> og velg bestand (planlagt hogst, hogstmoden skog eller egne valg).', 'Velg hva som deles, salgsform og frister, og legg til kjøperne.', 'Send den personlige lenken. Du ser når hver kjøper har åpnet den.', '<b>Hent forslag</b>: forslagene sorteres etter anslått netto til deg. <b>Velg</b> kjøper – eller <b>Stopp delingen</b>, så slutter lenkene å virke.'])}
      ${tips('Dine egne priser og verdianslag deles aldri, og kjøperne ser ikke hverandre.')}`,
  },
  {
    id: 'verdi', ikon: '💰', tittel: 'Verdi og økonomi',
    tekst: `<p><b>Verdi</b> viser slaktverdi, jordverdi, bestandsverdi og eiendomsverdi med dine forutsetninger (rente, priser, kostnader). Tømmerprisene kan kalibreres mot SSB for kommunen. <b>Følsomhet</b> viser hvordan verdien endrer seg med renten.</p>
      <p><b>Prognose</b> (framskriving) viser stående volum, tilvekst, avvirkning og økonomi år for år med tiltaksplanen.</p>`,
  },
  {
    id: 'veier', ikon: '🛣️', tittel: 'Veier',
    tekst: `<p><b>Veier</b> er registeret over skogsbilveier og traktorveier på eiendommen, med punkter (bom, stikkrenne, snuplass, velteplass), vedlikeholdslogg og -plan, kostnadsfordeling mellom eiere og terrengtransport. Veier kan hentes fra NVDB og Kartverket.</p>
      ${tips('Velteplasser du legger inn her, brukes av driftsvegen, skiltplanen og filsettet til hogstmaskinen.')}`,
  },
  {
    id: 'rapporter', ikon: '🖨️', tittel: 'Rapporter og utskrift',
    tekst: `<p><b>Rapporter</b> lager utskrifter og PDF: skogbruksplan, bestandsliste, tiltaksplan, verdi, miljø, PEFC og mer. Velg rapport, se forhåndsvisning og skriv ut eller lagre som PDF.</p>`,
  },
  {
    id: 'felt', ikon: '📍', tittel: 'SkogIQ Felt (mobil)',
    tekst: `<p><b>SkogIQ Felt</b> er planen på mobilen ute i skogen: kart med din posisjon, bestandsinfo, registrering av tiltak og skader med bilde, sporlogg av utført arbeid, og kart som virker uten dekning (lagre kartutsnitt før du går ut).</p>
      ${tips('Under <b>Felt</b> i menyen trykker du <b>Send planen til mobilen</b> og skanner QR-koden med telefonen. Registreringer kommer tilbake automatisk.')}`,
  },
  {
    id: 'vr', ikon: '🥽', tittel: 'Virtuell skog (3D og VR)',
    tekst: `<p>Fra et bestand trykker du <b>🥽 Gå inn i skogen</b> for å gå rundt i en 3D-modell av skogen – med terreng, veier, bygninger, vær og minikart. Med VR-briller kan du gå inn i modellen. Markfuktighet (💧) kan vises på bakken i skog og på myr.</p>`,
  },
  {
    id: 'kommune', ikon: '🏘️', tittel: 'Kommune og naboeiendommer',
    tekst: `<p><b>Kommune</b> analyserer hogstflater og skog i hele kommunen, med avstand til vei, gårds- og bruksnummer, naturtyper og kulturminner. Kartlaget <b>Naboeiendommer</b> viser eiendommene rundt og om de har skogbruksplan – trykk for å lage plan der den mangler.</p>`,
  },
  {
    id: 'miljo', ikon: '🛡️', tittel: 'PEFC, KSL, karbon og skogbrand',
    tekst: `<ul><li><b>PEFC</b> kontrollerer planen mot de 30 kravpunktene i Norsk PEFC Skogstandard og gir sjekklister for resten.</li>
      <li><b>KSL</b> er egenrevisjon, avvik og dokumentasjon for gården.</li>
      <li><b>Karbon</b> viser potensial for karbonkreditter og følger opp prosjekt.</li>
      <li><b>Skogbrand</b> gir skadeforebygging og skaderegistrering.</li>
      <li><b>Skifteplan</b> dekker jordbruksskifter, gjødslingsplan og plantevernjournal.</li></ul>`,
  },
  {
    id: 'data', ikon: '💾', tittel: 'Data, lagring og deling',
    tekst: `<ul><li><b>Lagring:</b> alt lagres automatisk på enheten, og i skyen når du er logget inn (Min profil).</li>
      <li><b>Data</b>-fanen viser datagrunnlaget (kilder og hvor gamle de er), import av hogstmaskindata og eksport.</li>
      <li><b>Sikkerhetskopi:</b> søk «sikkerhetskopi» i kommandolinjen for å laste ned hele planen.</li>
      <li><b>Spør AI</b> svarer på spørsmål om planen din.</li></ul>`,
  },
  {
    id: 'tips', ikon: '⌨️', tittel: 'Tips og snarveier',
    tekst: `<ul><li><kbd>Ctrl</kbd> + <kbd>K</kbd> – søk etter alt (bestand, funksjoner, handlinger, hjelp).</li>
      <li>Trykk på versjonsnummeret nederst i menyen for å se <b>hva som er nytt</b>.</li>
      <li>«?»-knappene i Tiltak og i oppdragene åpner riktig kapittel i denne veiledningen.</li>
      <li>På mobil drar du panelet opp og ned for å se mer av kartet.</li></ul>`,
  },
];

const finn = (id) => KAPITLER.find((k) => k.id === id) || KAPITLER[0];
const ren = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
// Kapitler som matcher søket, best først: treff i tittelen teller mest, deretter hvor ofte ordene står i teksten.
export function sok(q) {
  const ord = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!ord.length) return KAPITLER;
  const antall = (t, o) => t.split(o).length - 1;
  return KAPITLER.map((k) => { const tit = k.tittel.toLowerCase(); const t = ren(k.tekst); const ok = ord.every((o) => tit.includes(o) || t.includes(o)); return { k, ok, poeng: ord.reduce((s, o) => s + antall(tit, o) * 10 + antall(t, o), 0) }; })
    .filter((x) => x.ok).sort((a, b) => b.poeng - a.poeng).map((x) => x.k);
}
export function innholdHtml(id) {
  const k = finn(id);
  return `<article class="hj-kapittel" data-kapittel="${k.id}"><h3>${k.ikon} ${k.tittel}</h3>${k.tekst}</article>`;
}
export function tocHtml(aktiv, liste = KAPITLER) {
  return liste.length ? liste.map((k) => `<button type="button" class="${k.id === aktiv ? 'aktiv' : ''}" data-hj-kap="${k.id}"><span aria-hidden="true">${k.ikon}</span> ${k.tittel}</button>`).join('') : '<p class="hint">Ingen treff.</p>';
}
// Hele veiledningen som én side (utskrift/PDF).
export function heleHtml(app = 'SkogIQ.ai', versjon = '') {
  return `<h1>Brukerveiledning – ${app}${versjon ? ` ${versjon}` : ''}</h1><nav><ol>${KAPITLER.map((k) => `<li>${k.tittel}</li>`).join('')}</ol></nav>${KAPITLER.map((k) => `<section><h2>${k.ikon} ${k.tittel}</h2>${k.tekst}</section>`).join('')}`;
}
