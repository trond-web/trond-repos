// Tjenester appen kaller direkte fra nettleseren: Kartverkets adressesøk og MET-værvarsel (begge tillater CORS).
import { GRAN } from './geo.js';

const ADRESSER = 'https://ws.geonorge.no/adresser/v1/sok';
const MET = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';

export async function hentJson(url, { forsok = 3 } = {}) {
  let feil;
  for (let i = 0; i < forsok; i++) {
    try {
      const svar = await fetch(url, { headers: { Accept: 'application/json' } });
      if (svar.ok) return await svar.json();
      feil = new Error(`${svar.status} fra ${new URL(url).host}`);
      if (svar.status < 500 && svar.status !== 429) break;
    } catch (e) { feil = e; }
    await new Promise(r => setTimeout(r, 400 * 2 ** i));
  }
  throw feil;
}

export async function sokAdresse(tekst) {
  const q = new URLSearchParams({ sok: tekst, treffPerSide: '6', utkoordsys: '4258', fuzzy: 'true', kommunenummer: GRAN.kommunenummer });
  const d = await hentJson(`${ADRESSER}?${q}`);
  return (d.adresser || []).map(t => ({
    tekst: `${t.adressetekst}, ${t.postnummer} ${t.poststed.charAt(0)}${t.poststed.slice(1).toLowerCase()}`,
    punkt: [t.representasjonspunkt.lat, t.representasjonspunkt.lon],
  }));
}

export const vaerUrl = ([lat, lon]) => `${MET}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;

// De neste timene fra MET: temperatur, vind, nedbør og symbol.
export function tolkMet(d, antall = 12) {
  return (d?.properties?.timeseries || []).slice(0, antall).map(t => {
    const n = t.data.instant.details;
    const neste = t.data.next_1_hours || t.data.next_6_hours;
    return {
      tid: t.time,
      temp: n.air_temperature,
      vind: n.wind_speed,
      symbol: neste?.summary?.symbol_code || null,
      nedbor: neste?.details?.precipitation_amount ?? null,
    };
  });
}

export const hentVaer = async punkt => tolkMet(await hentJson(vaerUrl(punkt)));

const SYMBOLTEKST = {
  clearsky: 'Klarvær', fair: 'Lettskyet', partlycloudy: 'Delvis skyet', cloudy: 'Skyet', fog: 'Tåke',
  lightrain: 'Lett regn', rain: 'Regn', heavyrain: 'Kraftig regn',
  lightrainshowers: 'Lette regnbyger', rainshowers: 'Regnbyger', heavyrainshowers: 'Kraftige regnbyger',
  lightsleet: 'Lett sludd', sleet: 'Sludd', heavysleet: 'Kraftig sludd',
  lightsleetshowers: 'Lette sluddbyger', sleetshowers: 'Sluddbyger', heavysleetshowers: 'Kraftige sluddbyger',
  lightsnow: 'Lett snø', snow: 'Snø', heavysnow: 'Kraftig snø',
  lightsnowshowers: 'Lette snøbyger', snowshowers: 'Snøbyger', heavysnowshowers: 'Kraftige snøbyger',
};

export function symbolTekst(symbol) {
  if (!symbol) return '';
  const grunn = symbol.replace(/_(day|night|polartwilight)$/, '');
  const torden = grunn.endsWith('andthunder');
  const tekst = SYMBOLTEKST[grunn.replace(/andthunder$/, '')] || grunn;
  return torden ? `${tekst} og torden` : tekst;
}

// Et kort råd om turværet de neste timene.
export function turvaer(serie) {
  if (!serie?.length) return '';
  const nedbor = serie.slice(0, 3).reduce((s, t) => s + (t.nedbor || 0), 0);
  const temp = serie[0].temp, vind = serie[0].vind;
  if (nedbor >= 3) return 'Mye nedbør de neste timene – regntøy anbefales.';
  if (vind >= 10) return 'Kraftig vind – velg gjerne en tur i skogen.';
  if (temp <= -10) return 'Kaldt – kle deg godt, og ta med varm drikke.';
  if (temp >= 25) return 'Varmt – ta med nok vann.';
  if (nedbor > 0.3) return 'Litt nedbør – ta med en jakke.';
  return 'Fint turvær de neste timene.';
}
