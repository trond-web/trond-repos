// Henter åpne data om én eiendom. Alle tjenestene tillater kall direkte fra nettleseren (CORS).
//   Kartverket: adressesøk, kommuneliste, eiendomsgrense (eiendom-API)
//   Geonorge: Matrikkelen – bygningspunkt (WFS), Kulturminner – lokaliteter/enkeltminner/sikringssoner (WFS)
//   Riksantikvaren: SEFRAK-bygninger, freda bygninger og kulturmiljøer (OGC API Features)
//   DiBK Nasjonal arealplanbase: reguleringsplaner og kommuneplaner (WMS GetFeatureInfo)
import { bbox as bboxAv, utvidBbox, slaaSammen } from './geo.js';

export const URL = {
  kartverket: 'https://api.kartverket.no',
  adresser: 'https://ws.geonorge.no/adresser/v1',
  bygningspunkt: 'https://wfs.geonorge.no/skwms1/wfs.matrikkelen-bygningspunkt',
  kulturminnerWfs: 'https://wfs.geonorge.no/skwms1/wfs.kulturminner',
  ra: 'https://api.ra.no',
  reguleringsplaner: 'https://nap.ft.dibk.no/services/wms/reguleringsplaner/',
  kommuneplaner: 'https://nap.ft.dibk.no/services/wms/kommuneplaner/',
};

async function medForsok(fn, forsok = 3) {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= forsok - 1 || e.endelig) throw e;
      await new Promise((r) => setTimeout(r, 700 * 2 ** i));
    }
  }
}

export async function hentTekst(url, { hent = fetch, tidsavbrudd = 30000 } = {}) {
  return medForsok(async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), tidsavbrudd);
    try {
      const r = await hent(url, { signal: ctrl.signal });
      if (!r.ok) {
        const e = new Error(`${new globalThis.URL(url).host} svarte ${r.status}`);
        if (r.status >= 400 && r.status < 500) e.endelig = true;
        throw e;
      }
      return await r.text();
    } catch (e) {
      if (e.name === 'AbortError') throw new Error(`${new globalThis.URL(url).host} svarte ikke innen ${tidsavbrudd / 1000} sekunder`);
      throw e;
    } finally { clearTimeout(timer); }
  });
}
const hentJson = async (url, o) => JSON.parse(await hentTekst(url, o));

// ---------- Kommuner, adresser og eiendom ----------

export async function hentKommuner(o) {
  const liste = await hentJson(`${URL.kartverket}/kommuneinfo/v1/kommuner`, o);
  return liste.map((k) => ({ nr: k.kommunenummer, navn: k.kommunenavnNorsk || k.kommunenavn })).sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));
}

// Tolker «Nannestad», «3238» eller «Nannestad (3238)».
export function finnKommune(tekst, kommuner) {
  const s = String(tekst || '').trim();
  const nr = s.match(/\b(\d{4})\b/);
  if (nr) return kommuner.find((k) => k.nr === nr[1]) || { nr: nr[1], navn: s.replace(/\(?\b\d{4}\b\)?/, '').trim() || nr[1] };
  const lav = s.toLowerCase();
  const eksakt = kommuner.find((k) => k.navn.toLowerCase() === lav);
  if (eksakt) return eksakt;
  const start = kommuner.filter((k) => k.navn.toLowerCase().startsWith(lav));
  return start.length === 1 ? start[0] : null;
}

// Tolker «32/16», «32/16/0», «3238-32/16» og «Nannestad 32/16».
export function tolkMatrikkel(tekst) {
  const m = String(tekst || '').trim().match(/^(?:(.*?)[\s,-]+)?(\d+)\s*\/\s*(\d+)(?:\s*\/\s*(\d+))?(?:\s*\/\s*(\d+))?$/);
  if (!m) return null;
  return { kommune: (m[1] || '').trim() || null, gnr: +m[2], bnr: +m[3], fnr: m[4] ? +m[4] : 0, snr: m[5] ? +m[5] : 0 };
}

export async function sokAdresse(tekst, o) {
  const q = new URLSearchParams({ sok: tekst, treffPerSide: '8', utkoordsys: '4258', asciiKompatibel: 'true' });
  const d = await hentJson(`${URL.adresser}/sok?${q}`, o);
  return (d.adresser || []).map((a) => ({
    tekst: `${a.adressetekst}, ${a.postnummer || ''} ${a.poststed || ''}`.replace(/\s+/g, ' ').trim(),
    kommune: { nr: a.kommunenummer, navn: tittel(a.kommunenavn) },
    gnr: a.gardsnummer, bnr: a.bruksnummer, fnr: a.festenummer || 0, snr: 0,
    punkt: a.representasjonspunkt ? [a.representasjonspunkt.lon, a.representasjonspunkt.lat] : null,
  }));
}

export const tittel = (s) => String(s || '').toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

export async function eiendomFraPunkt([lon, lat], o) {
  const q = new URLSearchParams({ nord: lat, ost: lon, koordsys: '4258', radius: '1', treffPerSide: '5' });
  const d = await hentJson(`${URL.kartverket}/eiendom/v1/punkt?${q}`, o);
  const e = (d.eiendom || []).sort((a, b) => a.meterFraPunkt - b.meterFraPunkt)[0];
  if (!e) return null;
  return { kommune: { nr: e.kommunenummer }, gnr: e.gardsnummer, bnr: e.bruksnummer, fnr: e.festenummer || 0, snr: e.seksjonsnummer || 0 };
}

export async function hentEiendom({ kommune, gnr, bnr, fnr = 0 }, o) {
  const q = new URLSearchParams({ kommunenummer: kommune.nr, gardsnummer: gnr, bruksnummer: bnr, omrade: 'true', utkoordsys: '4258' });
  if (fnr) q.set('festenummer', fnr);
  const d = await hentJson(`${URL.kartverket}/eiendom/v1/geokoding?${q}`, o);
  const teiger = (d.features || []).filter((f) => f.geometry && /Polygon/.test(f.geometry.type) && (fnr ? true : !f.properties?.festenummer));
  if (!teiger.length) {
    const e = new Error(`Fant ingen eiendomsgrense for ${gnr}/${bnr}${fnr ? `/${fnr}` : ''} i ${kommune.navn || kommune.nr}. Sjekk kommune, gårds- og bruksnummer.`);
    e.endelig = true; throw e;
  }
  const geometri = slaaSammen(teiger.map((t) => t.geometry));
  const p = teiger[0].properties || {};
  return {
    kommune, gnr, bnr, fnr, geometri, antallTeiger: teiger.length,
    noyaktighet: [...new Set(teiger.map((t) => t.properties?.['nøyaktighetsklasseteig']).filter(Boolean))],
    oppdatert: p.oppdateringsdato || null,
  };
}

// ---------- GML (WFS 2.0) ----------

const tekstAv = (xml, tag) => { const m = xml.match(new RegExp(`<app:${tag}>([^<]*)</app:${tag}>`)); return m ? avXml(m[1]) : null; };
const alleAv = (xml, tag) => [...xml.matchAll(new RegExp(`<app:${tag}>([^<]*)</app:${tag}>`, 'g'))].map((m) => avXml(m[1]));
const avXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');

// GML i EPSG:4258 har akserekkefølge lat lon – snus til [lon, lat].
const posListe = (s) => { const t = s.trim().split(/\s+/).map(Number); const ut = []; for (let i = 0; i + 1 < t.length; i += 2) ut.push([t[i + 1], t[i]]); return ut; };

export function gmlGeometri(xml) {
  const polys = [...xml.matchAll(/<gml:Polygon[\s\S]*?<\/gml:Polygon>/g)].map(([p]) => {
    const ytre = p.match(/<gml:exterior>[\s\S]*?<gml:posList[^>]*>([^<]*)<\/gml:posList>/);
    const hull = [...p.matchAll(/<gml:interior>[\s\S]*?<gml:posList[^>]*>([^<]*)<\/gml:posList>/g)].map((m) => posListe(m[1]));
    return ytre ? [posListe(ytre[1]), ...hull] : null;
  }).filter(Boolean);
  if (polys.length === 1) return { type: 'Polygon', coordinates: polys[0] };
  if (polys.length > 1) return { type: 'MultiPolygon', coordinates: polys };
  const pkt = xml.match(/<gml:Point[\s\S]*?<gml:pos[^>]*>([^<]*)<\/gml:pos>/);
  if (pkt) return { type: 'Point', coordinates: posListe(pkt[1])[0] };
  const linje = xml.match(/<gml:LineString[\s\S]*?<gml:posList[^>]*>([^<]*)<\/gml:posList>/);
  if (linje) return { type: 'LineString', coordinates: posListe(linje[1]) };
  return null;
}

export function parseWfs(xml, type) {
  return [...xml.matchAll(new RegExp(`<app:${type}\\b[\\s\\S]*?</app:${type}>`, 'g'))].map(([x]) => x);
}

const wfsUrl = (base, type, [a, b, c, d], antall = 2000) => `${base}?${new URLSearchParams({
  service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: `app:${type}`, count: String(antall),
  bbox: `${b},${a},${d},${c},urn:ogc:def:crs:EPSG::4258`,
})}`;

// ---------- Bygninger (matrikkelen) ----------

export function parseBygninger(xml) {
  return parseWfs(xml, 'Bygning').map((x) => ({
    bygningsnummer: tekstAv(x, 'bygningsnummer'),
    bygningstype: tekstAv(x, 'bygningstype'),
    bygningsstatus: tekstAv(x, 'bygningsstatus'),
    harSefrak: tekstAv(x, 'harSefrakminne') === 'true',
    harKulturminne: tekstAv(x, 'harKulturminne') === 'true',
    matrikkelenhetId: [...new Set(alleAv(x, 'matrikkelenhetId'))],
    oppdatert: tekstAv(x, 'oppdateringsdato'),
    geometri: gmlGeometri(x),
  })).filter((b) => b.geometri);
}

export async function hentBygninger(boks, o) {
  return parseBygninger(await hentTekst(wfsUrl(URL.bygningspunkt, 'Bygning', boks, 5000), o));
}

// ---------- Riksantikvaren OGC API ----------

async function hentOgc(sti, boks, o, maks = 5000) {
  let url = `${URL.ra}/${sti}/items?${new URLSearchParams({ f: 'json', limit: '1000', bbox: boks.join(',') })}`;
  const ut = [];
  while (url && ut.length < maks) {
    const d = await hentJson(url, o);
    ut.push(...(d.features || []));
    url = (d.links || []).find((l) => l.rel === 'next')?.href || null;
  }
  return ut;
}

// SEFRAK med kodene oversatt til tekst (Riksantikvarens «sefrak_kartverket»-utgave).
export async function hentSefrak(boks, o) {
  return (await hentOgc('sefrak_kartverket/collections/sefrakbygninger', boks, o)).map((f) => ({ ...f.properties, id: f.id, geometri: f.geometry }));
}

export async function hentFredaBygninger(boks, o) {
  return (await hentOgc('KulturminnerFredaBygninger/collections/fredabygninger', boks, o)).map((f) => ({ ...f.properties, geometri: f.geometry }));
}

export async function hentKulturmiljoer(boks, o) {
  return (await hentOgc('KulturminnerKulturmiljoer/collections/kulturmiljoer', boks, o)).map((f) => ({ ...f.properties, geometri: f.geometry }));
}

// ---------- Kulturminner (Askeladden via Geonorge WFS) ----------

export function parseKulturminner(xml, type) {
  return parseWfs(xml, type).map((x) => {
    const uten = x.replace(/<app:informasjon>[\s\S]*?<\/app:informasjon>/, '');
    return {
      type,
      id: tekstAv(uten, 'kulturminneId') || tekstAv(uten, 'lokalId'),
      navn: tekstAv(uten, 'navn'),
      kategori: tekstAv(uten, 'enkeltminnekategori') || tekstAv(uten, 'lokalitetskategori'),
      art: tekstAv(uten, 'enkeltminneart') || tekstAv(uten, 'lokalitetsart'),
      vernetype: tekstAv(uten, 'vernetype'),
      vernedato: tekstAv(uten, 'vernedato'),
      datering: (uten.match(/<app:Datering>\s*<app:datering>([^<]*)/) || [])[1] || null,
      informasjon: (x.match(/<app:informasjon>([\s\S]*?)<\/app:informasjon>/) || [])[1]?.trim() || null,
      linkKulturminnesok: tekstAv(uten, 'linkKulturminnesøk'),
      linkAskeladden: tekstAv(uten, 'linkAskeladden'),
      opphav: tekstAv(uten, 'opphav'),
      geometri: gmlGeometri(uten),
    };
  }).map((k) => ({ ...k, informasjon: k.informasjon ? avXml(k.informasjon) : null })).filter((k) => k.geometri);
}

export async function hentKulturminner(boks, o) {
  const typer = ['Enkeltminne', 'Lokalitet', 'Sikringssone'];
  const svar = await Promise.all(typer.map((t) => hentTekst(wfsUrl(URL.kulturminnerWfs, t, boks, 2000), o).then((x) => parseKulturminner(x, t))));
  return Object.fromEntries(typer.map((t, i) => [t, svar[i]]));
}

// ---------- Arealplaner (DiBK Nasjonal arealplanbase) ----------

const REG_LAG = ['rpomrade_vn1', 'rpomrade_vn2', 'rpomrade_vn3', 'arealformal_vn1', 'arealformal_vn2', 'arealformal_vn3', 'hensynssoner_vn1', 'hensynssoner_vn2', 'hensynssoner_vn3', 'bestemmelsesomrader_vn2', 'bebyggelseomrade_vn2', 'bebyggelse_arealformal_vn2', 'bebyggelse_hensynssoner_vn2'];
const KP_LAG = ['kpomrade', 'arealformal_kp', 'hensynssone-bestemmelsesomrade_kp', 'kdpomrade', 'arealformal_kdp', 'hensynssone-bestemmelsesomrade_kdp'];

function featureInfoUrl(base, lag, [lon, lat]) {
  const d = 0.00015;
  return `${base}?${new URLSearchParams({
    service: 'WMS', version: '1.3.0', request: 'GetFeatureInfo', layers: lag.join(','), query_layers: lag.join(','), styles: '',
    crs: 'EPSG:4326', bbox: `${lat - d},${lon - d},${lat + d},${lon + d}`, width: '101', height: '101', i: '50', j: '50',
    info_format: 'application/json', feature_count: '50',
  })}`;
}

// Spør i hvert punkt (bygninger + et punkt inne på eiendommen) og slår sammen treffene.
export async function hentPlaner(punkter, o) {
  const funn = new Map();
  const feil = [];
  const jobber = punkter.flatMap((p) => [[URL.reguleringsplaner, REG_LAG, p], [URL.kommuneplaner, KP_LAG, p]]);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(4, jobber.length) }, async () => {
    while (i < jobber.length) {
      const [base, lag, p] = jobber[i++];
      try {
        const d = await hentJson(featureInfoUrl(base, lag, p), { ...o, tidsavbrudd: 20000 });
        for (const f of d.features || []) {
          const pr = f.properties || {};
          const nokkel = `${pr.objekttypenavn}|${pr['identifikasjon.lokalId'] || f.id}`;
          if (!funn.has(nokkel)) funn.set(nokkel, { ...pr, punkter: [] });
          funn.get(nokkel).punkter.push(p);
        }
      } catch (e) { feil.push(e.message); }
    }
  }));
  return { objekter: [...funn.values()], feil: [...new Set(feil)] };
}

// ---------- Alt for én eiendom ----------

export async function hentAlt(eiendomRef, { hent = fetch, logg = () => {} } = {}) {
  const o = { hent };
  logg('eiendom', 'aktiv', 'Henter eiendomsgrense fra Kartverket …');
  const eiendom = await hentEiendom(eiendomRef, o);
  logg('eiendom', 'ok', `Eiendomsgrense: ${eiendom.antallTeiger} teig${eiendom.antallTeiger > 1 ? 'er' : ''}`);
  const boks = bboxAv(eiendom.geometri);
  const vid = utvidBbox(boks, 40);
  const trygt = async (nokkel, tekst, fn, tom) => {
    logg(nokkel, 'aktiv', tekst);
    try { const r = await fn(); logg(nokkel, 'ok', null, r); return r; } catch (e) { logg(nokkel, 'feil', e.message); return Object.assign(Array.isArray(tom) ? [] : {}, tom, { feil: e.message }); }
  };
  const [bygninger, sefrak, freda, kulturminner, kulturmiljoer] = await Promise.all([
    trygt('bygninger', 'Henter bygninger fra matrikkelen …', () => hentBygninger(vid, o), []),
    trygt('sefrak', 'Henter SEFRAK-registreringer fra Riksantikvaren …', () => hentSefrak(vid, o), []),
    trygt('freda', 'Henter fredete bygninger …', () => hentFredaBygninger(vid, o), []),
    trygt('kulturminner', 'Henter kulturminner fra Askeladden …', () => hentKulturminner(vid, o), {}),
    trygt('kulturmiljoer', 'Henter kulturmiljøer …', () => hentKulturmiljoer(vid, o), []),
  ]);
  return { eiendom, bygninger, sefrak, freda, kulturminner, kulturmiljoer };
}
