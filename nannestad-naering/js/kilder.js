// Henter data om en eiendom fra åpne tjenester. Alle tillater CORS, så alt kjører direkte i nettleseren (og i Node for tester).
//   Kartverket: adressesøk, eiendomsgrense, eiendom i punkt
//   NIBIO AR5: arealtype, skogbonitet, treslag, grunnforhold (WMS GetFeatureInfo i et rutenett over eiendommen)
//   NGU: løsmasser (WMS GetFeatureInfo)
//   DiBK Nasjonal arealplanbase: kommuneplan og reguleringsplaner (WMS GetFeatureInfo)
//   NVE: kartlagte kvikkleiresoner (ArcGIS REST)
//   Geonorge: matrikkelens bygningspunkt (WFS)
import { bbox as bboxAv, punktIPolygon, slaaSammen, arealM2, utvidBbox, overlapper } from './geo.js';

export const URL = {
  kartverket: 'https://api.kartverket.no',
  adresser: 'https://ws.geonorge.no/adresser/v1',
  ar5: 'https://wms.nibio.no/cgi-bin/ar5',
  losmasser: 'https://geo.ngu.no/mapserver/LosmasserWMS2',
  kommuneplaner: 'https://nap.ft.dibk.no/services/wms/kommuneplaner/',
  reguleringsplaner: 'https://nap.ft.dibk.no/services/wms/reguleringsplaner/',
  kvikkleire: 'https://kart.nve.no/enterprise/rest/services/SkredKvikkleire2/MapServer',
  bygningspunkt: 'https://wfs.geonorge.no/skwms1/wfs.matrikkelen-bygningspunkt',
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

// Kjører jobbene med begrenset samtidighet og samler feilmeldinger i stedet for å avbryte.
async function iParallell(liste, fn, samtidig = 8) {
  const ut = new Array(liste.length); const feil = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(samtidig, liste.length) }, async () => {
    while (i < liste.length) {
      const n = i++;
      try { ut[n] = await fn(liste[n], n); } catch (e) { ut[n] = null; feil.push(e.message); }
    }
  }));
  return { ut, feil: [...new Set(feil)] };
}

// ---------- Søk og eiendom ----------

export const tittel = (s) => String(s || '').toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

// Tolker «29/2», «29/2/0», «3238-29/2» og «Nannestad 29/2».
export function tolkMatrikkel(tekst) {
  const m = String(tekst || '').trim().match(/^(?:(.*?)[\s,-]+)?(\d+)\s*\/\s*(\d+)(?:\s*\/\s*(\d+))?$/);
  if (!m) return null;
  return { kommune: (m[1] || '').trim() || null, gnr: +m[2], bnr: +m[3], fnr: m[4] ? +m[4] : 0 };
}

export async function sokAdresse(tekst, o) {
  const q = new URLSearchParams({ sok: tekst, treffPerSide: '8', utkoordsys: '4258', asciiKompatibel: 'true' });
  const d = await hentJson(`${URL.adresser}/sok?${q}`, o);
  return (d.adresser || []).map((a) => ({
    tekst: `${a.adressetekst}, ${a.postnummer || ''} ${tittel(a.poststed)}`.replace(/\s+/g, ' ').trim(),
    kommune: { nr: a.kommunenummer, navn: tittel(a.kommunenavn) },
    gnr: a.gardsnummer, bnr: a.bruksnummer, fnr: a.festenummer || 0,
    punkt: a.representasjonspunkt ? [a.representasjonspunkt.lon, a.representasjonspunkt.lat] : null,
  }));
}

export async function eiendomFraPunkt([lon, lat], o) {
  const q = new URLSearchParams({ nord: lat, ost: lon, koordsys: '4258', radius: '1', treffPerSide: '5' });
  const d = await hentJson(`${URL.kartverket}/eiendom/v1/punkt?${q}`, o);
  const e = (d.eiendom || []).sort((a, b) => a.meterFraPunkt - b.meterFraPunkt)[0];
  if (!e) return null;
  return { kommune: { nr: e.kommunenummer }, gnr: e.gardsnummer, bnr: e.bruksnummer, fnr: e.festenummer || 0 };
}

export async function hentEiendom({ kommune, gnr, bnr, fnr = 0 }, o) {
  const q = new URLSearchParams({ kommunenummer: kommune.nr, gardsnummer: gnr, bruksnummer: bnr, omrade: 'true', utkoordsys: '4258' });
  if (fnr) q.set('festenummer', fnr);
  const d = await hentJson(`${URL.kartverket}/eiendom/v1/geokoding?${q}`, o);
  const teiger = (d.features || []).filter((f) => f.geometry && /Polygon/.test(f.geometry.type) && (fnr ? true : !f.properties?.festenummer));
  if (!teiger.length) {
    const e = new Error(`Fant ingen eiendomsgrense for ${gnr}/${bnr} i ${kommune.navn || kommune.nr}. Sjekk gårds- og bruksnummer.`);
    e.endelig = true; throw e;
  }
  const geometri = slaaSammen(teiger.map((t) => t.geometry));
  return { kommune, gnr, bnr, fnr, geometri, antallTeiger: teiger.length, daa: arealM2(geometri) / 1000 };
}

// ---------- Rutenett over eiendommen ----------

// Punkter i et kvadratisk rutenett inne på eiendommen. Avstanden velges slik at det blir høyst ca. `maks` punkter.
export function rutenett(geom, maks = 320) {
  const [a, b, c, d] = bboxAv(geom);
  const kx = Math.cos(((b + d) / 2) * Math.PI / 180) * 111320;
  const areal = arealM2(geom);
  let steg = Math.max(10, Math.ceil(Math.sqrt(areal / maks) / 5) * 5);
  for (;;) {
    const dy = steg / 111320; const dx = steg / kx; const pkt = [];
    for (let y = b + dy / 2; y < d; y += dy) for (let x = a + dx / 2; x < c; x += dx) if (punktIPolygon([x, y], geom)) pkt.push([+x.toFixed(6), +y.toFixed(6)]);
    if (pkt.length <= maks * 1.15 || steg > 2000) {
      if (!pkt.length) pkt.push([(a + c) / 2, (b + d) / 2]);
      return { steg, punkter: pkt };
    }
    steg += 5;
  }
}

// Et jevnt utvalg på høyst n av punktene.
export const utvalg = (pkt, n) => (pkt.length <= n ? pkt : Array.from({ length: n }, (_, i) => pkt[Math.floor((i * pkt.length) / n)]));

const wmsInfo = (base, lag, [lon, lat], format, d = 0.00005, ekstra = {}) => `${base}?${new URLSearchParams({
  service: 'WMS', version: '1.3.0', request: 'GetFeatureInfo', layers: lag, query_layers: lag, styles: '',
  crs: 'EPSG:4326', bbox: `${lat - d},${lon - d},${lat + d},${lon + d}`, width: '101', height: '101', i: '50', j: '50',
  info_format: format, feature_count: '20', ...ekstra,
})}`;

const tag = (xml, t) => { const m = xml.match(new RegExp(`<${t}>([^<]*)</${t}>`)); return m ? m[1].trim() || null : null; };

// ---------- AR5 ----------

export function parseAR5(xml) {
  if (!/<Arealtype_feature>/.test(xml)) return null;
  return {
    artype: +tag(xml, 'artype') || null, arealtype: tag(xml, 'artype_beskrivelse'),
    bonitet: tag(xml, 'arskogbon_beskrivelse'), treslag: tag(xml, 'artreslag_beskrivelse'), grunnforhold: tag(xml, 'argrunnf_beskrivelse'),
    klasse: tag(xml, 'vanlig_beskrivelse'),
  };
}

export async function hentAR5(punkter, o) {
  return iParallell(punkter, async (p) => parseAR5(await hentTekst(wmsInfo(URL.ar5, 'Arealtype', p, 'application/vnd.ogc.gml'), o)), 8);
}

// ---------- Løsmasser (NGU) ----------

export async function hentLosmasser(punkter, o) {
  return iParallell(punkter, async (p) => {
    const x = await hentTekst(wmsInfo(URL.losmasser, 'Losmasse_flate', p, 'application/vnd.ogc.gml', 0.0001), o);
    return x.includes('<Losmasse_flate_feature>') ? { kode: +tag(x, 'losmassetype'), tekst: tag(x, 'losmassetype_tekst') } : null;
  }, 6);
}

// ---------- Arealplaner (DiBK) ----------

const KP_LAG = 'kpomrade,arealformal_kp,hensynssone-bestemmelsesomrade_kp,kdpomrade,arealformal_kdp,hensynssone-bestemmelsesomrade_kdp';
const RP_LAG = 'rpomrade_vn2,arealformal_vn2,hensynssoner_vn2,rpomrade_vn1,arealformal_vn1';

export function tolkPlanobjekt(pr) {
  const type = pr.objekttypenavn || '';
  if (/Område$/.test(type) && pr.plannavn) {
    return { art: 'plan', kommuneplan: /^K(d)?p/.test(type), navn: pr.plannavn, id: pr['arealplanId.planidentifikasjon'], link: pr.link || null };
  }
  if (pr['arealformål'] != null || pr['reguleringsformål'] != null) {
    return { art: 'formal', kommuneplan: /^K(d)?p/.test(type), kode: String(pr['arealformål'] ?? pr['reguleringsformål']), status: pr.arealbruksstatus === '2' ? 'framtidig' : 'nåværende', felt: pr.områdenavn || pr.feltbetegnelse || null, planId: pr['arealplanId.planidentifikasjon'] };
  }
  const sone = ['støy', 'fare', 'faresone', 'angittHensyn', 'båndlegging', 'sikring', 'infrastruktur', 'raSkred', 'flom', 'gjennomføring', 'detaljering'].map((f) => pr[f]).find((v) => v != null && v !== '');
  if (sone || /Sone$/.test(type)) return { art: 'sone', kode: String(sone || ''), navn: pr.beskrivelse || pr.hensynSonenavn || type, sonenavn: pr.hensynSonenavn || null };
  return null;
}

export async function hentPlaner(punkter, o) {
  const jobber = punkter.flatMap((p) => [[URL.kommuneplaner, KP_LAG, p], [URL.reguleringsplaner, RP_LAG, p]]);
  const { ut, feil } = await iParallell(jobber, async ([base, lag, p]) => {
    const d = JSON.parse(await hentTekst(wmsInfo(base, lag, p, 'application/json', 0.00015), { ...o, tidsavbrudd: 25000 }));
    return { p, kp: base === URL.kommuneplaner, objekter: (d.features || []).map((f) => tolkPlanobjekt(f.properties || {})).filter(Boolean) };
  }, 6);
  // Per punkt: kommuneplan- og reguleringsfunn slått sammen.
  const perPunkt = new Map(punkter.map((p) => [p.join(','), { p, objekter: [] }]));
  for (const r of ut) if (r) perPunkt.get(r.p.join(',')).objekter.push(...r.objekter.map((x) => ({ ...x, kp: r.kp })));
  return { punkter: [...perPunkt.values()], feil };
}

// ---------- Kvikkleire (NVE) ----------

// Soner i eiendommens bbox. `overlapper` sier om sonen faktisk berører eiendommen.
export async function hentKvikkleire(geom, o) {
  const [a, b, c, d] = bboxAv(geom);
  const q = new URLSearchParams({
    geometry: `${a},${b},${c},${d}`, geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects',
    outFields: 'skredomrnavn,faregrad,risiko,konsekvens', returnGeometry: 'true', geometryPrecision: '6', f: 'json',
  });
  const r = await hentJson(`${URL.kvikkleire}/0/query?${q}`, o);
  return (r.features || []).map((f) => ({ ...f.attributes, geometri: { type: 'Polygon', coordinates: f.geometry?.rings || [] } }))
    .filter((k) => k.geometri.coordinates.length).map((k) => ({ ...k, overlapper: overlapper(k.geometri, geom) }));
}

// ---------- Bygninger (matrikkelen) ----------

export function parseBygninger(xml) {
  return [...xml.matchAll(/<app:Bygning\b[\s\S]*?<\/app:Bygning>/g)].map(([b]) => {
    const pos = b.match(/<gml:pos>([^<]*)<\/gml:pos>/);
    const [lat, lon] = pos ? pos[1].trim().split(/\s+/).map(Number) : [];
    const t = b.match(/<app:bygningstype>(\d+)</);
    const n = b.match(/<app:bygningsnummer>(\d+)</);
    return { nr: n ? n[1] : null, type: t ? +t[1] : null, punkt: [lon, lat] };
  }).filter((b) => Number.isFinite(b.punkt[0]));
}

export async function hentBygninger(geom, o) {
  const [a, b, c, d] = utvidBbox(bboxAv(geom), 10);
  const q = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: 'app:Bygning', bbox: `${b},${a},${d},${c},urn:ogc:def:crs:EPSG::4326`, count: '2000' });
  const alle = parseBygninger(await hentTekst(`${URL.bygningspunkt}?${q}`, o));
  return alle.filter((x) => punktIPolygon(x.punkt, geom));
}

// ---------- Alt for én eiendom ----------

export async function hentAlt(ref, { hent = fetch, logg = () => {} } = {}) {
  const o = { hent };
  const feil = {};
  logg('eiendom', 'aktiv', 'Henter eiendomsgrense fra Kartverket …');
  const eiendom = await hentEiendom(ref, o);
  logg('eiendom', 'ok', `Eiendomsgrense: ${Math.round(eiendom.daa).toLocaleString('nb-NO')} daa`);

  const nett = rutenett(eiendom.geometri);
  logg('ar5', 'aktiv', `Arealtyper fra NIBIO AR5 i ${nett.punkter.length} punkter …`);
  logg('grunn', 'aktiv', 'Løsmasser (NGU) og kvikkleire (NVE) …');
  logg('plan', 'aktiv', 'Kommuneplan og reguleringsplaner …');
  logg('bygg', 'aktiv', 'Bygninger fra matrikkelen …');

  const [ar5, los, kvikk, plan, bygg] = await Promise.all([
    hentAR5(nett.punkter, o).then((r) => { logg('ar5', r.feil.length ? 'feil' : 'ok', `Arealtyper: ${r.ut.filter(Boolean).length} av ${nett.punkter.length} punkter`); return r; }),
    hentLosmasser(utvalg(nett.punkter, 60), o),
    hentKvikkleire(eiendom.geometri, o).catch((e) => { feil.kvikkleire = e.message; return null; }),
    hentPlaner(utvalg(nett.punkter, 24), o).then((r) => { logg('plan', r.feil.length ? 'feil' : 'ok', 'Arealplaner hentet'); return r; }),
    hentBygninger(eiendom.geometri, o).then((r) => { logg('bygg', 'ok', `Bygninger: ${r.length}`); return r; }).catch((e) => { feil.bygninger = e.message; logg('bygg', 'feil', 'Bygninger: ikke tilgjengelig'); return []; }),
  ]);
  logg('grunn', 'ok', 'Grunnforhold hentet');
  if (ar5.feil.length) feil.ar5 = ar5.feil.join('; ');
  if (los.feil.length) feil.losmasser = los.feil.join('; ');
  if (plan.feil.length) feil.plan = plan.feil.join('; ');
  const losPunkter = utvalg(nett.punkter, 60);
  return {
    hentet: new Date().toISOString(),
    eiendom: { kommune: eiendom.kommune, gnr: eiendom.gnr, bnr: eiendom.bnr, fnr: eiendom.fnr, daa: eiendom.daa, geometri: eiendom.geometri },
    steg: nett.steg,
    celler: nett.punkter.map((p, i) => ({ p, ar5: ar5.ut[i] })),
    losmasser: losPunkter.map((p, i) => ({ p, ...(los.ut[i] || {}) })),
    kvikkleire: kvikk,
    plan: plan.punkter,
    bygninger: bygg,
    feil,
  };
}
