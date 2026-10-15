// Veiledning for å legge appen på hjemskjermen, tilpasset telefon og nettleser.
// Rene funksjoner uten DOM, så de kan testes.

// Finner plattformen ut fra nettleserens user agent.
//   installert      appen er allerede åpnet fra hjemskjermen
//   innebygd        lenken er åpnet inne i en annen app (Messenger, Facebook, Instagram, Snapchat …)
//   ios-safari      iPhone/iPad i Safari
//   ios-annen       iPhone/iPad i Chrome, Firefox eller Edge
//   android-chrome  Android i Chrome (eller Edge/Brave/Opera, som virker likt)
//   android-samsung Samsung Internet
//   android-firefox Firefox på Android
//   pc              datamaskin
export const erIos = (ua = '', berøring = 0) => /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && berøring > 1);

export function plattform(ua = '', { standalone = false, berøring = 0 } = {}) {
  if (standalone) return 'installert';
  const ios = erIos(ua, berøring);
  const android = /Android/.test(ua);
  if (/FBAN|FBAV|FB_IAB|Instagram|Messenger|Snapchat|LinkedInApp|Line\/|MicroMessenger|; wv\)/.test(ua)) return 'innebygd';
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'ios-annen' : 'ios-safari';
  if (android) {
    if (/SamsungBrowser/.test(ua)) return 'android-samsung';
    if (/Firefox/.test(ua)) return 'android-firefox';
    return 'android-chrome';
  }
  return 'pc';
}

export const erMobil = (p) => p !== 'pc' && p !== 'installert';

const DEL_IKON = '<svg class="ikon-inline" viewBox="0 0 24 24" aria-label="Del-knappen"><path d="M12 3v12M8 7l4-4 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11H5v10h14V11h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
const MENY_IKON = '<b class="tast">⋮</b>';

// Stegene for å legge til på hjemskjermen. `harPrompt` er sann når Chrome tilbyr installasjon direkte.
export function steg(p, { harPrompt = false, ipad = false } = {}) {
  switch (p) {
    case 'ios-safari': return [
      `Trykk på Del-knappen ${DEL_IKON} ${ipad ? 'øverst til høyre' : 'nederst på skjermen'}.`,
      'Bla ned og velg <b>«Legg til på Hjem-skjerm»</b>.',
      'Trykk <b>«Legg til»</b> øverst til høyre.',
      'Åpne appen fra det nye ikonet <b>«Villrein»</b> på hjemskjermen.',
    ];
    case 'ios-annen': return [
      `Trykk på Del-knappen ${DEL_IKON} (i Chrome står den øverst til høyre i adressefeltet).`,
      'Velg <b>«Legg til på Hjem-skjerm»</b>. Ser du det ikke, trykk <b>«Mer»</b> eller bla nedover.',
      'Trykk <b>«Legg til»</b>, og åpne appen fra ikonet <b>«Villrein»</b>.',
      'Virker det ikke, åpne adressen i <b>Safari</b> og gjør det derfra.',
    ];
    case 'android-chrome': return harPrompt ? [
      'Trykk på knappen <b>«Installer appen»</b> under.',
      'Bekreft med <b>«Installer»</b>.',
      'Åpne appen fra ikonet <b>«Villrein»</b> på startskjermen.',
    ] : [
      `Trykk på menyen ${MENY_IKON} øverst til høyre.`,
      'Velg <b>«Installer app»</b> eller <b>«Legg til på startsiden»</b>.',
      'Bekreft med <b>«Installer»</b> og åpne appen fra ikonet <b>«Villrein»</b>.',
    ];
    case 'android-samsung': return [
      'Trykk på menyen <b class="tast">≡</b> nederst til høyre.',
      'Velg <b>«Legg til side på»</b> og så <b>«Startskjerm»</b>.',
      'Åpne appen fra ikonet <b>«Villrein»</b>.',
    ];
    case 'android-firefox': return [
      `Trykk på menyen ${MENY_IKON}.`,
      'Velg <b>«Installer»</b> (eller «Legg til på startskjermen»).',
      'Åpne appen fra ikonet <b>«Villrein»</b>.',
    ];
    case 'innebygd': return [
      'Du har åpnet lenken inne i en annen app (f.eks. Messenger eller Facebook). Derfra kan den ikke legges på hjemskjermen.',
      'Trykk på <b>⋯</b> eller <b>⋮</b> øverst og velg <b>«Åpne i nettleser»</b> (Safari eller Chrome), eller kopier lenken under og lim den inn i nettleseren.',
      'Følg så veiledningen som kommer opp der.',
    ];
    case 'pc': return [
      'Appen er laget for mobil. Åpne denne adressen på telefonen, så får du veiledning der:',
    ];
    default: return [];
  }
}

// Råd etter installasjon – likt for alle, med detaljer for iPhone eller Android.
export function etterpaa(ios) {
  return [
    '<b>Tillat posisjon</b> når appen spør første gang du trykker ◎. ' + (ios
      ? 'Velg «Tillat når appen er i bruk», og la «Presis posisjon» være på.'
      : 'Velg «Mens appen er i bruk» og «Nøyaktig».'),
    '<b>Last ned kartet</b> under Meny → Offline mens du er på wifi. Da virker kart, eiendomsgrenser og GPS på fjellet uten dekning.',
    '<b>Lagre jaktgrunnene dine</b> i appen. ' + (ios
      ? 'På iPhone har appen på hjemskjermen egen lagring – det du har lagret i Safari, følger ikke med, så gjør det i appen.'
      : 'Det du lagrer, følger med i appen.'),
  ];
}

export function gpsHjelp(ios) {
  return ios
    ? 'iPhone: Innstillinger → Personvern og sikkerhet → Stedstjenester (må være på) → Safari-nettsteder → «Ved bruk av appen». Lukk appen helt og åpne den igjen.'
    : 'Android: Innstillinger → Posisjon (må være på). Trykk så hengelåsen eller ⓘ ved adressen (eller hold inne app-ikonet → Appinfo → Tillatelser) og tillat posisjon.';
}
