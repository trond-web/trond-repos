// Datakilder for Gran kommune: Enhetsregisteret (Brreg), Kartverkets adresse- og stedsnavn-API,
// MET (locationforecast) og OSRM for kjøreavstand. Alle tillater kall rett fra nettleseren (CORS).
// Modulen virker både i nettleseren og i Node 22 (global fetch).

export const GRAN = { navn: 'Gran kommune', kommunenummer: '3446', orgnr: '961381541' };

// Rådhuset er utgangspunkt for alle avstander. Koordinaten er slått opp i adresseregisteret og brukes
// hvis oppslaget feiler.
export const RAADHUS = {
  navn: 'Gran rådhus', adresse: 'Rådhusvegen 39', postnummer: '2770', poststed: 'Jaren',
  lat: 60.392953, lon: 10.560421,
};

const BRREG = 'https://data.brreg.no/enhetsregisteret/api';
const ADRESSER = 'https://ws.geonorge.no/adresser/v1/sok';
const STEDSNAVN = 'https://ws.geonorge.no/stedsnavn/v1/navn';
const MET = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const OSRM = 'https://router.project-osrm.org/table/v1/driving/';

// Kategorier i den rekkefølgen de vises. Når flere virksomheter deler adresse, vinner den første.
export const KATEGORIER = [
  { id: 'raadhus', navn: 'Rådhus og administrasjon', farge: '#9b2c2c' },
  { id: 'skole', navn: 'Skoler og SFO', farge: '#1d5fa8' },
  { id: 'barnehage', navn: 'Barnehager', farge: '#d97706' },
  { id: 'helse', navn: 'Helse og omsorg', farge: '#0f8a6c' },
  { id: 'kultur', navn: 'Kultur, idrett og fritid', farge: '#7c3aed' },
  { id: 'teknisk', navn: 'Teknisk, vann og avløp', farge: '#57534e' },
  { id: 'beredskap', navn: 'Brann, legevakt og NAV', farge: '#c2410c' },
  { id: 'andre', navn: 'Andre (ikke kommunale)', farge: '#64748b' },
];
const PRIORITET = Object.fromEntries(KATEGORIER.map((k, i) => [k.id, i]));

// Ikke-kommunale tjenester i Gran som er nyttige å ha med: private barnehager, videregående,
// sykehjem og politi. Hentes som underenheter med beliggenhet i kommunen.
export const ANDRE_NAERINGSKODER = ['85.100', '85.310', '85.320', '87.102', '84.240'];

// ---------- Hjelpere ----------

export async function hentJson(url, { forsok = 3, signal } = {}) {
  let feil;
  for (let i = 0; i < forsok; i++) {
    try {
      const svar = await fetch(url, { signal, headers: { Accept: 'application/json' } });
      if (svar.ok) return await svar.json();
      feil = new Error(`${svar.status} fra ${new URL(url).host}`);
      if (svar.status < 500 && svar.status !== 429) break;
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      feil = e;
    }
    await new Promise(r => setTimeout(r, 400 * 2 ** i));
  }
  throw feil;
}

// Kjører fn over listen med høyst `antall` samtidige kall.
export async function iParallell(liste, antall, fn) {
  const ut = new Array(liste.length);
  let neste = 0;
  const arbeider = async () => {
    while (neste < liste.length) {
      const i = neste++;
      ut[i] = await fn(liste[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(antall, liste.length) }, arbeider));
  return ut;
}

const STORE_ORD = new Set(['SFO', 'AS', 'SA', 'NAV', 'DA', 'ANS', 'IT', 'UH-KO', 'APO']);

// Stedsnavn som skal ha stor forbokstav inne i et navn. Ord fra virksomhetens egen adresse og poststed
// legges til i tillegg, slik at «SØNDRE ÅLSVEGEN 72» blir «Søndre Ålsvegen 72».
const STEDER = ['Gran', 'Brandbu', 'Jaren', 'Bjoneroa', 'Hadeland', 'Lunner', 'Harestua', 'Roa', 'Innlandet',
  'Marka', 'Skjervum', 'Romholt', 'Moen', 'Tingelstad', 'Fluberg', 'Lygna', 'Randsfjorden', 'Nordre', 'Søndre'];

const storForbokstav = o => o.replace(/(^|[(\/])(\p{L})/gu, (_, f, b) => f + b.toLocaleUpperCase('nb'));

// Normaliserer navn fra Enhetsregisteret (store bokstaver) til vanlig skrivemåte:
// «GRAN KOMMUNE SKJERVUM HELSE- OG OMSORGSSENTER» → «Skjervum helse- og omsorgssenter».
export function penNavn(navn, ekstraSteder = []) {
  const n = String(navn || '').trim().replace(/^GRAN KOMMUNE\s+(?=\S)/i, '');
  const steder = new Set([...STEDER, ...ekstraSteder].map(o => o.toLocaleLowerCase('nb')));
  return n.split(/\s+/).map((o, i) => {
    const ren = o.replace(/[()]/g, '');
    if (STORE_ORD.has(ren.toUpperCase()) && ren === ren.toUpperCase() && (i > 0 || ren.length <= 3)) return o;
    const lav = o.toLocaleLowerCase('nb');
    const kjerne = lav.replace(/[(),]/g, '');
    const erSted = steder.has(kjerne) || (kjerne.length >= 5 && [...steder].some(s => s.startsWith(kjerne)));
    return i === 0 || erSted ? storForbokstav(lav) : lav;
  }).join(' ');
}

// ---------- Kategorisering ----------

export function kategoriFor({ naeringskode = '', navn = '', kommunal = true }) {
  const n = navn.toUpperCase();
  if (!kommunal) return 'andre';
  if (/BRANN|LEGEVAKT|^NAV\b/.test(n)) return 'beredskap';
  if (naeringskode.startsWith('85.1')) return 'barnehage';
  if (/SFO\b/.test(n) || naeringskode.startsWith('85.2') || naeringskode.startsWith('85.3') || naeringskode === '85.691') return 'skole';
  if (naeringskode === '85.521') return 'kultur';
  if (/^8[67]\./.test(naeringskode) || naeringskode === '88.102' || naeringskode === '88.991'
    || naeringskode === '88.996' && /HJELPEMIDDEL/.test(n)) return 'helse';
  if (/^(36|37|42|81)\./.test(naeringskode)) return 'teknisk';
  if (/^(59|79|91|93)\./.test(naeringskode) || naeringskode.startsWith('88.9')) return 'kultur';
  if (naeringskode.startsWith('84.') || naeringskode.startsWith('56.')) return 'raadhus';
  return 'kultur';
}

// ---------- Enhetsregisteret ----------

async function alleSider(url, nokkel) {
  const ut = [];
  for (let side = 0; side < 20; side++) {
    const d = await hentJson(`${url}${url.includes('?') ? '&' : '?'}size=200&page=${side}`);
    ut.push(...(d._embedded?.[nokkel] || []));
    if (!d.page || side + 1 >= d.page.totalPages) break;
  }
  return ut;
}

const stedsord = a => [...(a.adresse || []), a.poststed || ''].join(' ').split(/[\s,]+/).filter(o => /^\p{L}{3,}$/u.test(o));

export function tilVirksomhet(e, { kommunal = true, avdeling = '' } = {}) {
  const a = e.beliggenhetsadresse || e.forretningsadresse || {};
  const naeringskode = e.naeringskode1?.kode || '';
  const v = {
    orgnr: e.organisasjonsnummer,
    navn: penNavn(e.navn, stedsord(a)),
    registrertNavn: e.navn,
    naeringskode,
    naering: e.naeringskode1?.beskrivelse || '',
    ansatte: e.antallAnsatte ?? null,
    avdeling,
    kommunal,
    adresse: (a.adresse || []).filter(l => !/^(c\/o|v\/)\s/i.test(l) && !/legesenter$/i.test(l)).join(', '),
    postnummer: a.postnummer || '',
    poststed: a.poststed ? penNavn(a.poststed) : '',
    kommunenummer: a.kommunenummer || '',
  };
  v.kategori = kategoriFor(v);
  return v;
}

// Henter alle virksomheter (underenheter) som hører til Gran kommune, via organisasjonsleddene
// (kommunedirektør, oppvekst, helse og omsorg, ...). Tar også med ikke-kommunale tjenester i kommunen.
export async function hentVirksomheter({ medAndre = true } = {}) {
  const ledd = await alleSider(`${BRREG}/enheter?overordnetEnhet=${GRAN.orgnr}`, 'enheter');
  const foreldre = [{ organisasjonsnummer: GRAN.orgnr, navn: GRAN.navn }, ...ledd.filter(e => !e.slettedato)];
  const lister = await iParallell(foreldre, 4, async f => {
    const under = await alleSider(`${BRREG}/underenheter?overordnetEnhet=${f.organisasjonsnummer}`, 'underenheter');
    const avdeling = f.organisasjonsnummer === GRAN.orgnr ? '' : penNavn(f.navn);
    return under.filter(u => !u.slettedato && !u.nedleggelsesdato).map(u => tilVirksomhet(u, { avdeling }));
  });
  const virksomheter = lister.flat();
  if (medAndre) {
    const kjente = new Set(virksomheter.map(v => v.orgnr));
    const andre = await iParallell(ANDRE_NAERINGSKODER, 3, kode =>
      alleSider(`${BRREG}/underenheter?kommunenummer=${GRAN.kommunenummer}&naeringskode=${kode}`, 'underenheter'));
    for (const u of andre.flat()) {
      if (kjente.has(u.organisasjonsnummer) || u.slettedato || u.nedleggelsesdato) continue;
      kjente.add(u.organisasjonsnummer);
      virksomheter.push(tilVirksomhet(u, { kommunal: false }));
    }
  }
  return virksomheter;
}

// ---------- Gruppering på adresse ----------

export function adresseNokkel(adresse, postnummer) {
  return `${String(adresse).toLocaleLowerCase('nb').replace(/\s+/g, ' ').trim()}|${postnummer}`;
}

// Mange virksomheter deler adresse (f.eks. alt på rådhuset). Kartet viser ett punkt per adresse.
export function grupperSteder(virksomheter) {
  const steder = new Map();
  for (const v of virksomheter) {
    const nokkel = v.adresse ? adresseNokkel(v.adresse, v.postnummer) : `org:${v.orgnr}`;
    if (!steder.has(nokkel)) {
      steder.set(nokkel, { id: nokkel, adresse: v.adresse, postnummer: v.postnummer, poststed: v.poststed, virksomheter: [] });
    }
    steder.get(nokkel).virksomheter.push(v);
  }
  const ut = [...steder.values()];
  for (const s of ut) {
    s.virksomheter.sort((a, b) => PRIORITET[a.kategori] - PRIORITET[b.kategori] || a.navn.localeCompare(b.navn, 'nb'));
    const hoved = hovedvirksomhet(s);
    s.kategori = hoved.kategori;
    s.kategorier = [...new Set(s.virksomheter.map(v => v.kategori))];
    s.erRaadhus = adresseNokkel(s.adresse, s.postnummer) === adresseNokkel(RAADHUS.adresse, RAADHUS.postnummer);
    if (s.erRaadhus) s.kategori = 'raadhus';
    s.tittel = s.erRaadhus ? RAADHUS.navn : hoved.navn;
    s.kommunal = s.virksomheter.some(v => v.kommunal);
  }
  return ut.sort((a, b) => (b.erRaadhus - a.erRaadhus) || a.tittel.localeCompare(b.tittel, 'nb'));
}

// Stedet får navn og kategori etter den største virksomheten på adressen (flest ansatte),
// men en skole går foran sin egen SFO.
export function hovedvirksomhet(s) {
  const kandidater = s.virksomheter.filter(v => !/SFO$/.test(v.navn));
  const liste = kandidater.length ? kandidater : s.virksomheter;
  return liste.reduce((best, v) => ((v.ansatte ?? -1) > (best.ansatte ?? -1) ? v : best), liste[0]);
}

// ---------- Geokoding ----------

function gateOgNummer(adresse) {
  const m = String(adresse).match(/^(.*?)\s+(\d+)\s*([A-Za-z]?)$/);
  return m ? { gate: m[1], nummer: m[2], bokstav: m[3].toUpperCase() } : { gate: String(adresse), nummer: '', bokstav: '' };
}

export function velgAdresse(treff, adresse) {
  if (!treff?.length) return null;
  const { gate, nummer, bokstav } = gateOgNummer(adresse);
  const lik = t => t.adressenavn?.toLocaleLowerCase('nb') === gate.toLocaleLowerCase('nb');
  return treff.find(t => lik(t) && String(t.nummer) === nummer && (t.bokstav || '') === bokstav)
    || treff.find(t => lik(t) && String(t.nummer) === nummer)
    || treff.find(lik)
    || treff[0];
}

// Finner koordinat for et sted. Prøver adresseregisteret, så stedsnavn (for adresser som «Rogne»),
// og til slutt navnet på virksomheten (for virksomheter uten registrert adresse).
export async function geokod(sted) {
  const fraAdresse = async (sok, postnummer) => {
    const q = new URLSearchParams({ sok, treffPerSide: '20', utkoordsys: '4258' });
    if (postnummer) q.set('postnummer', postnummer);
    const d = await hentJson(`${ADRESSER}?${q}`);
    const t = velgAdresse(d.adresser, sok);
    return t && { lat: t.representasjonspunkt.lat, lon: t.representasjonspunkt.lon, presisjon: 'adresse', treff: t.adressetekst, kommunenummer: t.kommunenummer };
  };
  const fraStedsnavn = async sok => {
    const q = new URLSearchParams({ sok, knr: GRAN.kommunenummer, treffPerSide: '5', utkoordsys: '4258' });
    const d = await hentJson(`${STEDSNAVN}?${q}`);
    const t = d.navn?.[0];
    return t && { lat: t.representasjonspunkt.nord, lon: t.representasjonspunkt['øst'], presisjon: 'stedsnavn', treff: t.skrivemåte };
  };
  try {
    if (sted.adresse) {
      if (/\d/.test(sted.adresse)) {
        const r = await fraAdresse(sted.adresse, sted.postnummer);
        if (r) return r;
      }
      // Husnummeret finnes ikke (lenger) i adresseregisteret: bruk stedsnavnet eller en annen adresse i samme gate.
      const { gate } = gateOgNummer(sted.adresse);
      const r = await fraStedsnavn(gate) || await fraAdresse(gate, sted.postnummer);
      if (r) return { ...r, presisjon: 'omtrentlig' };
    }
    // Uten adresse: prøv egennavnet i virksomhetsnavnet («Markatun bofellesskap» → «Markatun»).
    const egennavn = sted.virksomheter?.[0]?.navn.split(' ')[0];
    if (egennavn) {
      const r = await fraAdresse(egennavn, sted.postnummer) || await fraStedsnavn(egennavn);
      if (r) return { ...r, presisjon: 'omtrentlig' };
    }
  } catch (e) {
    return { feil: e.message };
  }
  return null;
}

// Søk etter en vilkårlig adresse (for å legge til egne punkter).
export async function sokAdresse(tekst, { kunGran = true } = {}) {
  const q = new URLSearchParams({ sok: tekst, treffPerSide: '8', utkoordsys: '4258', fuzzy: 'true' });
  if (kunGran) q.set('kommunenummer', GRAN.kommunenummer);
  const d = await hentJson(`${ADRESSER}?${q}`);
  return (d.adresser || []).map(t => ({
    adresse: t.adressetekst, postnummer: t.postnummer, poststed: penNavn(t.poststed),
    lat: t.representasjonspunkt.lat, lon: t.representasjonspunkt.lon,
  }));
}

// ---------- Avstand ----------

export function avstandKm(a, b) {
  const R = 6371.0088, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Kompassretning fra a til b, f.eks. «NØ».
export function retning(a, b) {
  const rad = Math.PI / 180;
  const y = Math.sin((b.lon - a.lon) * rad) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lon - a.lon) * rad);
  const grader = (Math.atan2(y, x) / rad + 360) % 360;
  return ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'][Math.round(grader / 45) % 8];
}

// Kjøreavstand og -tid fra rådhuset til alle punktene i ett kall (OSRM table-tjenesten).
export async function hentKjoreavstander(fra, punkter) {
  const ut = new Array(punkter.length).fill(null);
  const BIT = 90;
  for (let start = 0; start < punkter.length; start += BIT) {
    const del = punkter.slice(start, start + BIT);
    const koord = [fra, ...del].map(p => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
    const d = await hentJson(`${OSRM}${koord}?sources=0&annotations=distance,duration`, { forsok: 2 });
    if (d.code !== 'Ok') throw new Error(`OSRM: ${d.code}`);
    del.forEach((_, i) => {
      const m = d.distances?.[0]?.[i + 1], s = d.durations?.[0]?.[i + 1];
      if (m != null && s != null) ut[start + i] = { km: m / 1000, min: s / 60 };
    });
  }
  return ut;
}

// ---------- Vær (MET) ----------

export function vaerUrl(lat, lon) {
  return `${MET}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
}

export function tolkMet(d) {
  return (d?.properties?.timeseries || []).map(t => {
    const n = t.data.instant.details;
    const neste = t.data.next_1_hours || t.data.next_6_hours;
    return {
      tid: t.time,
      temp: n.air_temperature,
      vind: n.wind_speed,
      vindretning: n.wind_from_direction,
      fukt: n.relative_humidity,
      skyer: n.cloud_area_fraction,
      symbol: neste?.summary?.symbol_code || null,
      nedbor: neste?.details?.precipitation_amount ?? null,
      nedborTimer: t.data.next_1_hours ? 1 : t.data.next_6_hours ? 6 : null,
    };
  });
}

export async function hentVaer(lat, lon) {
  return tolkMet(await hentJson(vaerUrl(lat, lon)));
}

// Punktet i tidsserien nærmest et gitt tidspunkt.
export function vaerVed(serie, tid) {
  if (!serie?.length) return null;
  const t = +new Date(tid);
  let best = serie[0];
  for (const p of serie) if (Math.abs(+new Date(p.tid) - t) < Math.abs(+new Date(best.tid) - t)) best = p;
  return best;
}

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

export function vindretningTekst(grader) {
  if (grader == null) return '';
  return ['nord', 'nordøst', 'øst', 'sørøst', 'sør', 'sørvest', 'vest', 'nordvest'][Math.round(((grader % 360) + 360) % 360 / 45) % 8];
}
