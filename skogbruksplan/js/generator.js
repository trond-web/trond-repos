// Lager et utkast til skogbruksplan for én eiendom direkte i nettleseren fra åpne data:
//   Kartverket eiendom-API (grense), NIBIO «skogbruksplan/hogstklasser» (bestand fra tidligere plan),
//   NIBIO SR16 vektor (volum, høyde, treantall, treslag, alder) og NIBIO MiS (nøkkelbiotoper).
// Geometrioperasjoner gjøres med Turf (sendes inn, slik at modulen også kan kjøres i Node).
import { normaliserBestand, treslagFraSR16, SR16_TRESLAG_TEKST } from './model.js';
import { geoTilUtm } from './proj.js';

const KARTVERKET = 'https://api.kartverket.no';
const NIBIO = 'https://wms.nibio.no/cgi-bin';
const PLAN_TRESLAG = { Gran: 'G', Furu: 'F', Lauv: 'L', Bjørk: 'L' };

export async function hentKommuner(hent = fetch) {
  return JSON.parse(await hentTekst(hent, `${KARTVERKET}/kommuneinfo/v1/kommuner`, 20000)).map((k) => ({ nr: k.kommunenummer, navn: k.kommunenavnNorsk || k.kommunenavn }))
    .sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));
}

// Tolker «Nannestad», «3238» eller «Nannestad (3238)».
export function finnKommune(tekst, kommuner) {
  const s = String(tekst || '').trim();
  const nr = s.match(/\b(\d{4})\b/);
  if (nr) {
    const navn = s.replace(/\(?\b\d{4}\b\)?/, '').trim();
    return kommuner.find((k) => k.nr === nr[1]) || { nr: nr[1], navn: navn || nr[1] };
  }
  const lav = s.toLowerCase();
  return kommuner.find((k) => k.navn.toLowerCase() === lav)
    || (kommuner.filter((k) => k.navn.toLowerCase().startsWith(lav)).length === 1 ? kommuner.find((k) => k.navn.toLowerCase().startsWith(lav)) : null);
}

async function medForsok(fn, forsok = 4) {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (i >= forsok - 1) throw e;
      await new Promise((r) => setTimeout(r, 600 * 2 ** i));
    }
  }
}

async function hentTekst(hent, url, tidsavbrudd = 45000) {
  return medForsok(async () => {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl && setTimeout(() => ctrl.abort(), tidsavbrudd);
    try {
      const r = await hent(url, ctrl ? { signal: ctrl.signal } : undefined);
      if (!r.ok) throw new Error(`${new URL(url).host} svarte ${r.status}`);
      return await r.text();
    } catch (e) {
      if (e.name === 'AbortError') throw new Error(`${new URL(url).host} svarte ikke innen ${tidsavbrudd / 1000} sekunder`);
      throw e;
    } finally { if (timer) clearTimeout(timer); }
  });
}

function parseKml(tekst) {
  const ut = [];
  const tall = (s) => s.trim().split(/\s+/).map((p) => p.split(',').slice(0, 2).map(Number));
  for (const [, pm] of tekst.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)) {
    const id = (pm.match(/<name>[^<]*?\.?(\w+)<\/name>/) || [])[1];
    const polys = [];
    for (const [, poly] of pm.matchAll(/<Polygon>([\s\S]*?)<\/Polygon>/g)) {
      const ytre = poly.match(/<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
      if (!ytre) continue;
      const indre = [...poly.matchAll(/<innerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g)].map((m) => tall(m[1]));
      polys.push([tall(ytre[1]), ...indre]);
    }
    if (polys.length) ut.push({ id, geometry: polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys } });
  }
  return ut;
}

function parseGml(tekst, lag) {
  const f = tekst.match(new RegExp(`<${lag}_feature>([\\s\\S]*?)</${lag}_feature>`));
  if (!f) return null;
  const attr = {};
  for (const [, k, v] of f[1].matchAll(/<(\w+)>([^<]*)<\/\1>/g)) attr[k] = v;
  return attr;
}

const tall = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const komma = (v) => v.toFixed(1).replace('.', ',');

async function parallelt(liste, antall, fn, framdrift) {
  let i = 0; let ferdig = 0;
  const ut = new Array(liste.length);
  await Promise.all(Array.from({ length: Math.min(antall, liste.length) }, async () => {
    while (i < liste.length) {
      const n = i++;
      ut[n] = await fn(liste[n]);
      ferdig++;
      framdrift?.(ferdig, liste.length);
    }
  }));
  return ut;
}

export async function genererPlan({ kommune, gnr, bnr, festenr = 0 }, { turf, hent = fetch, logg = () => {}, minDaa = 1, iAar = new Date().getFullYear() }) {
  const T = turf;
  const trygg = (fn) => { try { return fn(); } catch { return null; } };
  const arealM2 = (g) => (g ? T.area(g) : 0);
  const snitt = (a, b) => trygg(() => T.intersect(T.featureCollection([a, b])));
  const minus = (a, b) => trygg(() => T.difference(T.featureCollection([a, b])));
  const forening = (liste) => (liste.length === 1 ? liste[0] : trygg(() => T.union(T.featureCollection(liste))) || liste[0]);
  const feat = (geometry, properties = {}) => ({ type: 'Feature', geometry, properties });

  // 1. Eiendom
  logg('eiendom', 'aktiv', `Henter eiendomsgrense for ${kommune.navn} ${gnr}/${bnr}${festenr ? `/${festenr}` : ''} fra Kartverket …`);
  const q = new URLSearchParams({ kommunenummer: kommune.nr, gardsnummer: gnr, bruksnummer: bnr, omrade: 'true', utkoordsys: '4258' });
  if (festenr) q.set('festenummer', festenr);
  const eiendomJson = JSON.parse(await hentTekst(hent, `${KARTVERKET}/eiendom/v1/geokoding?${q}`));
  const teiger = (eiendomJson.features || []).filter((f) => f.geometry && /Polygon/.test(f.geometry.type)
    && (festenr ? true : !f.properties?.festenummer));
  if (!teiger.length) throw new Error(`Fant ingen teiger for ${gnr}/${bnr} i ${kommune.navn}. Sjekk kommune, gårds- og bruksnummer.`);
  const eiendom = forening(teiger.map((t) => feat(t.geometry)));
  const eiendomDaa = arealM2(eiendom) / 1000;
  logg('eiendom', 'ok', `Eiendomsgrense: ${teiger.length} teig${teiger.length > 1 ? 'er' : ''}, ${eiendomDaa.toFixed(0)} daa`);

  const [minx, miny, maxx, maxy] = T.bbox(T.buffer(eiendom, 0.05, { units: 'kilometers' }));
  // KML-eksporten fra MapServer gir grader bare når kartet bes i et projisert system; UTM33 dekker hele landet.
  const hjorner = [[minx, miny], [minx, maxy], [maxx, miny], [maxx, maxy]].map(([x, y]) => geoTilUtm(x, y, 33));
  const ux = hjorner.map((h) => h[0]); const uy = hjorner.map((h) => h[1]);
  const ub = [Math.min(...ux), Math.min(...uy), Math.max(...ux), Math.max(...uy)];
  const bredde = 2000; const hoyde = Math.max(200, Math.round((bredde * (ub[3] - ub[1])) / (ub[2] - ub[0])));
  const kmlUrl = (tjeneste, lag) => `${NIBIO}/${tjeneste}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${lag}&STYLES=&SRS=EPSG:25833&BBOX=${ub.join(',')}&WIDTH=${bredde}&HEIGHT=${hoyde}&FORMAT=kml`;
  const iEiendom = (o) => { const s = snitt(feat(o.geometry), eiendom); return s && arealM2(s) > 20; };
  // Punkter godt inne i polygonet (lengst fra kanten først), slik at punktspørringen ikke treffer naboflaten.
  const indrePunkter = (geom) => {
    const f = feat(geom);
    const kant = trygg(() => T.polygonToLine(f));
    const linjer = kant ? (kant.type === 'FeatureCollection' ? kant.features : [kant]) : [];
    const [x0, y0, x1, y1] = T.bbox(f);
    const kandidater = [T.pointOnFeature(f)];
    const n = 7;
    for (let i = 1; i < n; i++) for (let j = 1; j < n; j++) kandidater.push(T.point([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * j) / n]));
    return kandidater.filter((p) => T.booleanPointInPolygon(p, f))
      .map((p) => ({ p, d: Math.min(...linjer.map((l) => trygg(() => T.pointToLineDistance(p, l, { units: 'meters' })) ?? 0)) }))
      .sort((a, b) => b.d - a.d).slice(0, 3).map((k) => k.p.geometry.coordinates);
  };
  const attributter = async (tjeneste, lag, objekter, idfelt, steg, tekst) => parallelt(objekter, 6, async (o) => {
    o.attr = null;
    for (const [x, y] of indrePunkter(o.geometry)) {
      const d = 0.00001;
      const url = `${NIBIO}/${tjeneste}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&LAYERS=${lag}&QUERY_LAYERS=${lag}&SRS=EPSG:4326&BBOX=${x - d},${y - d},${x + d},${y + d}&WIDTH=3&HEIGHT=3&X=1&Y=1&INFO_FORMAT=application/vnd.ogc.gml&FEATURE_COUNT=1`;
      const a = parseGml(await hentTekst(hent, url), lag);
      if (a && (!idfelt || a[idfelt] === o.id)) { o.attr = a; return; }
      if (!idfelt) return;
    }
  }, (n, tot) => logg(steg, 'aktiv', `${tekst} ${n}/${tot} …`));

  // 2. Tidligere skogbruksplan
  logg('plan', 'aktiv', 'Henter bestand fra tidligere skogbruksplan (NIBIO) …');
  const plan = parseKml(await hentTekst(hent, kmlUrl('skogbruksplan', 'hogstklasser'))).filter(iEiendom);
  await attributter('skogbruksplan', 'hogstklasser', plan, null, 'plan', 'Henter bestandsdata');
  logg('plan', 'ok', plan.length ? `Tidligere skogbruksplan: ${plan.length} bestand` : 'Ingen tidligere skogbruksplan i NIBIOs data – bruker bare SR16');

  // 3. SR16
  logg('sr16', 'aktiv', 'Henter skogressurskart SR16 …');
  const sr16 = parseKml(await hentTekst(hent, kmlUrl('sr16', 'SRVTRESLAG'))).filter(iEiendom);
  await attributter('sr16', 'SRVTRESLAG', sr16, 'gid', 'sr16', 'Henter SR16-verdier');
  const sr16Data = sr16.filter((s) => s.attr);
  sr16Data.forEach((s) => { s.bbox = T.bbox(s.geometry); });
  logg('sr16', 'ok', `SR16: ${sr16Data.length} skogflater`);

  // 4. MiS
  logg('mis', 'aktiv', 'Henter miljøregistreringer (MiS) …');
  let mis = [];
  try { mis = parseKml(await hentTekst(hent, kmlUrl('mis', 'Nokkelbiotop'))).filter(iEiendom); } catch { /* MiS er valgfritt */ }
  const misUnion = mis.length ? forening(mis.map((m) => feat(m.geometry))) : null;
  logg('mis', 'ok', `MiS-nøkkelbiotoper: ${mis.length}`);

  // 5. Sett sammen bestand
  logg('bygg', 'aktiv', 'Setter sammen bestand og sammenligner plan med SR16 …');
  const kandidater = [];
  for (const p of plan) {
    const g = snitt(feat(p.geometry), eiendom);
    if (g) kandidater.push({ kilde: 'plan', g, attr: p.attr || {} });
  }
  const planUnion = kandidater.length ? forening(kandidater.map((k) => k.g)) : null;
  for (const s of sr16Data) {
    let rest = snitt(feat(s.geometry), eiendom);
    if (rest && planUnion) rest = minus(rest, planUnion);
    if (rest && arealM2(rest) / 1000 >= minDaa) kandidater.push({ kilde: 'sr16', g: rest, attr: {} });
  }
  const overlapper = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

  const bestand = [];
  let lopenr = 0;
  for (const k of kandidater) {
    const areal = arealM2(k.g);
    if (areal / 1000 < minDaa) continue;
    const bb = T.bbox(k.g);
    const deler = [];
    for (const s of sr16Data) {
      if (!overlapper(bb, s.bbox)) continue;
      const i = snitt(feat(s.geometry), k.g);
      const ia = arealM2(i);
      if (ia > 1) deler.push([ia, s.attr]);
    }
    const vektet = (felt, faktor = 1) => {
      let sum = 0; let vekt = 0;
      for (const [a, attr] of deler) { const v = tall(attr[felt]); if (v !== null) { sum += v * a; vekt += a; } }
      return vekt ? (sum / vekt) * faktor : null;
    };
    const dekning = deler.reduce((s, d) => s + d[0], 0) / areal;
    const tsAreal = {};
    const typeAreal = {};
    for (const [a, attr] of deler) {
      const t = treslagFraSR16(attr.srtreslag); if (t) tsAreal[t] = (tsAreal[t] || 0) + a;
      const tekst = SR16_TRESLAG_TEKST[parseInt(attr.srtreslag, 10)]; if (tekst) typeAreal[tekst] = (typeAreal[tekst] || 0) + a;
    }
    const srType = Object.keys(typeAreal).sort((x, y) => typeAreal[y] - typeAreal[x])[0] || null;
    const srTreslag = Object.keys(tsAreal).sort((x, y) => tsAreal[y] - tsAreal[x])[0] || null;
    const volub = vektet('srvolub', 0.1); const volmb = vektet('srvolmb', 0.1);
    const hoydeM = vektet('srhoydem', 0.1); const trean = vektet('srtrean', 0.1);
    const srAlder = vektet('srtrealder'); const srBon = vektet('srbonitet'); const usikker = vektet('srvolub_s');

    let nr; let bonitet; let planTs = null; let alder; let hkPlan = null; let regaar = null;
    if (k.kilde === 'plan') {
      nr = k.attr.teig_best_nr || `P${bestand.length + 1}`;
      bonitet = tall((k.attr.bonitet_beskrivelse || '').replace('Bonitet', '')) ?? (srBon ? Math.round(srBon) : null);
      planTs = PLAN_TRESLAG[k.attr.bontre_beskrivelse] || null;
      alder = tall(k.attr.alder_korr) ?? tall(k.attr.alder);
      hkPlan = tall(k.attr.hogstkl_verdi);
      regaar = k.attr.regaar_korr || null;
    } else {
      lopenr += 1;
      nr = `S${lopenr}`;
      bonitet = srBon ? Math.round(srBon) : null;
      alder = srAlder ? Math.round(srAlder) : null;
    }
    const treslag = srTreslag && dekning > 0.5 ? srTreslag : (planTs || srTreslag || 'G');
    const merknader = [];
    if (k.kilde === 'sr16') merknader.push('Ikke med i tidligere plan – data fra SR16');
    if (hkPlan >= 4 && volub !== null && volub < 3 && dekning > 0.5) {
      merknader.push(`Mulig hogd etter ${regaar}: SR16 viser ${komma(volub)} m³/daa mot HK ${hkPlan} i planen – kontroller`);
      alder = 0;
    } else if (hkPlan >= 4 && volub !== null && hoydeM !== null && volub < 8 && hoydeM < 10 && dekning > 0.5) {
      merknader.push(`Avvik: HK ${hkPlan} i planen (${regaar}), men SR16 viser ${komma(volub)} m³/daa og ${komma(hoydeM)} m høyde – trolig hogd eller glissen, kontroller`);
    }
    if (planTs && srTreslag && planTs !== srTreslag && dekning > 0.5) merknader.push(`Treslag: plan ${planTs}, SR16 ${srTreslag}`);
    const miljoSnitt = misUnion ? arealM2(snitt(k.g, misUnion)) : 0;
    const miljo = miljoSnitt > Math.max(500, 0.2 * areal);
    if (miljo) merknader.push('Overlapper MiS-nøkkelbiotop');
    if (!deler.length) merknader.push('Ingen SR16-data – volum er ikke kjent');

    const r1 = (v) => (v === null || v === undefined ? null : Math.round(v * 10) / 10);
    const props = {
      BESTANDNR: nr,
      TEIG: String(nr).includes('-') ? String(nr).split('-')[0] : null,
      AREAL_DAA: r1(areal / 1000),
      TRESLAG: treslag,
      BONITET: bonitet ? Math.round(bonitet) : null,
      ALDER: alder !== null && alder !== undefined ? Math.round(alder) : null,
      VOLUM_DAA: r1(volub),
      TREANTALL: trean !== null ? Math.round(trean) : null,
      MIDDELHOYDE: r1(hoydeM),
      MILJOFIGUR: miljo ? 'Ja' : null,
      MERKNAD: merknader.join('; ') || null,
      KILDE: k.kilde === 'plan' ? 'Tidligere skogbruksplan (NIBIO) + SR16' : 'SR16',
      PLAN_HOGSTKLASSE: hkPlan,
      PLAN_REGISTRERT: regaar,
      SR16_SKOGTYPE: srType,
      SR16_ALDER: srAlder ? Math.round(srAlder) : null,
      SR16_BONITET: srBon ? Math.round(srBon) : null,
      SR16_VOLUM_MB_DAA: r1(volmb),
      SR16_VOLUM_USIKKERHET_PST: usikker ? Math.round(usikker) : null,
      SR16_DEKNING_PST: Math.round(dekning * 100),
    };
    const b = normaliserBestand(props, k.g.geometry, areal / 1000, iAar);
    b.hogstklasse = null; // beregnes av appen fra dagens alder; planens HK ligger i ekstra
    bestand.push(b);
  }
  const nokkel = (b) => [b.nr.startsWith('S') ? 1 : 0, ...b.nr.replace(/^S/, '').split('-').map((x) => parseInt(x, 10) || 0)];
  bestand.sort((a, b) => { const x = nokkel(a); const y = nokkel(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0); } return 0; });

  const skogDaa = bestand.reduce((s, b) => s + b.areal, 0);
  const flagget = bestand.filter((b) => /hogd/.test(b.merknad)).length;
  logg('bygg', 'ok', `${bestand.length} bestand på ${skogDaa.toFixed(0)} daa skog${flagget ? `, ${flagget} merket for kontroll` : ''}`);
  if (!bestand.length) throw new Error('Fant ingen skogdata innenfor eiendommen. Er eiendommen skogkledd?');

  return {
    eiendom: {
      navn: `${kommune.navn} ${gnr}/${bnr}${festenr ? `/${festenr}` : ''}`,
      kommune: kommune.navn, kommunenr: kommune.nr, gnrbnr: `${gnr}/${bnr}${festenr ? `/${festenr}` : ''}`,
      eier: '', takstAar: iAar, grense: eiendom.geometry,
    },
    bestand,
    metadata: {
      laget: new Date().toISOString(),
      eiendomDaa, skogDaa, antallFraPlan: plan.length, antallSr16: sr16Data.length, mis: mis.length,
      planRegistrert: [...new Set(plan.map((p) => p.attr?.regaar_korr).filter(Boolean))].join(', ') || null,
      kilder: ['Kartverket eiendom-API', 'NIBIO skogbruksplan/hogstklasser', 'NIBIO SR16 (SRV)', 'NIBIO MiS'],
    },
  };
}
