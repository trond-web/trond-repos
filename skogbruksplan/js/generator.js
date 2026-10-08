// Lager et utkast til skogbruksplan for én eiendom direkte i nettleseren fra åpne data:
//   Kartverket eiendom-API (grense), NIBIO «skogbruksplan/hogstklasser» (bestand fra tidligere plan),
//   NIBIO SR16 vektor (volum, høyde, treantall, treslag, alder) og NIBIO MiS (nøkkelbiotoper).
// Geometrioperasjoner gjøres med Turf (sendes inn, slik at modulen også kan kjøres i Node).
import { normaliserBestand, treslagFraSR16, SR16_TRESLAG_TEKST, nyId } from './model.js';
import { hentAr5, lagFigurer, MARKSLAG } from './markslag.js';
import { tomSkifteplan, lagSkifteinndeling, hentJordsmonnFlater, jordbruksBoks } from './skifteplan.js';
import { geoTilUtm, utmTilGeo, punktIGeometri, etikettPunkt } from './proj.js';
import { placemarkGeometri } from './kml.js';
import { settVegetasjon } from './vegetasjon.js';

const KARTVERKET = 'https://api.kartverket.no';
const NIBIO = 'https://wms.nibio.no/cgi-bin';
const PLAN_TRESLAG = { Gran: 'G', Furu: 'F', Lauv: 'L', Bjørk: 'L' };
// AR5-skogbonitet → H40 (laveste trinn i klassen: lav 6–8, middels 11–14, høy 17–20, særs høy 23–26).
const AR5_BONITET_H40 = { lav: 8, middels: 11, 'høy': 17, 'særs høy': 23 };
// NIBIOs MapServer gir maks 1000 objekter per KML-svar. Treffes taket, deles området i fire og hentes på nytt.
export const KML_MAKS = 1000;

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
  for (const [, pm] of tekst.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)) {
    const id = (pm.match(/<name>[^<]*?\.?(\w+)<\/name>/) || [])[1];
    const geometry = placemarkGeometri(pm);
    if (geometry) ut.push({ id, geometry });
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

export async function genererPlan({ kommune, gnr, bnr, festenr = 0 }, { turf, klipping = null, hent = fetch, logg = () => {}, minDaa = 1, iAar = new Date().getFullYear() }) {
  const T = turf;
  const trygg = (fn) => { try { return fn(); } catch { return null; } };
  const arealM2 = (g) => (g ? T.area(g) : 0);
  const feat = (geometry, properties = {}) => ({ type: 'Feature', geometry, properties });
  // polygon-clipping er mange ganger raskere enn Turf 7s polygonoperasjoner; Turf brukes hvis det mangler.
  const PC = klipping;
  const fraPC = (mp) => (mp && mp.length ? feat(mp.length === 1 ? { type: 'Polygon', coordinates: mp[0] } : { type: 'MultiPolygon', coordinates: mp }) : null);
  const koord = (f) => f.geometry.coordinates;
  // Feiler polygon-clipping på en vanskelig geometri, prøves Turf før vi gir opp.
  const medReserve = (pc, tf) => { if (PC) { try { return pc(); } catch { /* prøv Turf */ } } return trygg(tf); };
  const snitt = (a, b) => medReserve(() => fraPC(PC.intersection(koord(a), koord(b))), () => T.intersect(T.featureCollection([a, b])));
  const minus = (a, b) => medReserve(() => fraPC(PC.difference(koord(a), koord(b))), () => T.difference(T.featureCollection([a, b])));
  const forening = (liste) => (liste.length === 1 ? liste[0] : medReserve(() => fraPC(PC.union(...liste.map(koord))), () => T.union(T.featureCollection(liste))) || liste[0]);

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
  const bredde = 2000;
  const kmlUrl = (tjeneste, lag, b = ub) => {
    const h = Math.max(200, Math.round((bredde * (b[3] - b[1])) / (b[2] - b[0])));
    return `${NIBIO}/${tjeneste}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${lag}&STYLES=&SRS=EPSG:25833&BBOX=${b.map((v) => v.toFixed(1)).join(',')}&WIDTH=${bredde}&HEIGHT=${h}&FORMAT=kml`;
  };
  // Avgrensningsbokser per teig gir rask utsortering før den dyre geometrisjekken.
  const teigBokser = teiger.map((t) => T.bbox(t.geometry));
  const boksTreff = (bb) => teigBokser.some((t) => bb[0] <= t[2] && t[0] <= bb[2] && bb[1] <= t[3] && t[1] <= bb[3]);
  // Klipper mot bare de teigene som kan overlappe – mye raskere enn mot hele eiendommen for store eiendommer.
  const teigFeat = teiger.map((t) => feat(t.geometry));
  // Kanter (som [x1, y1, x2, y2]) for hver teig, brukt til en rask og eksakt test før klipping.
  const ringer = (g) => (g.type === 'Polygon' ? g.coordinates : g.coordinates.flat());
  const kanter = (g) => ringer(g).flatMap((r) => r.slice(1).map((p, j) => [r[j][0], r[j][1], p[0], p[1]]));
  const teigKanter = teiger.map((t) => kanter(t.geometry));
  const krysser = (a, b) => {
    const d1 = (b[2] - b[0]) * (a[1] - b[1]) - (b[3] - b[1]) * (a[0] - b[0]);
    const d2 = (b[2] - b[0]) * (a[3] - b[1]) - (b[3] - b[1]) * (a[2] - b[0]);
    const d3 = (a[2] - a[0]) * (b[1] - a[1]) - (a[3] - a[1]) * (b[0] - a[0]);
    const d4 = (a[2] - a[0]) * (b[3] - a[1]) - (a[3] - a[1]) * (b[2] - a[0]);
    return (d1 * d2 <= 0) && (d3 * d4 <= 0);
  };
  const klipp = (geom) => {
    const bb = T.bbox(geom); const f = feat(geom);
    const aktuelle = teigFeat.map((t, i) => i).filter((i) => { const t = teigBokser[i]; return bb[0] <= t[2] && t[0] <= bb[2] && bb[1] <= t[3] && t[1] <= bb[3]; });
    const fk = kanter(geom);
    const maaKlippes = [];
    for (const i of aktuelle) {
      // Teigkanter innenfor flatens boks; krysser ingen av dem flatens kanter, ligger flaten helt inne i eller helt utenfor teigen.
      const tk = teigKanter[i].filter((e) => Math.max(e[0], e[2]) >= bb[0] && Math.min(e[0], e[2]) <= bb[2] && Math.max(e[1], e[3]) >= bb[1] && Math.min(e[1], e[3]) <= bb[3]);
      if (tk.some((e) => fk.some((g) => krysser(g, e)))) { maaKlippes.push(i); continue; }
      if (tk.length && punktIGeometri([tk[0][0], tk[0][1]], geom)) { maaKlippes.push(i); continue; } // hull eller teig inni flaten
      if (punktIGeometri(fk[0].slice(0, 2), teiger[i].geometry)) return f;
    }
    const deler = maaKlippes.map((i) => snitt(f, teigFeat[i])).filter(Boolean);
    return deler.length ? forening(deler) : null;
  };
  const iEiendom = (o) => { if (!boksTreff(T.bbox(o.geometry))) return false; o.klipp = klipp(o.geometry); return o.klipp && arealM2(o.klipp) > 20; };
  // Henter alle flater i et område, med oppdeling når svaret er kuttet ved KML_MAKS. Ruter utenfor eiendommen hoppes over.
  const hentKml = async (tjeneste, lag, b = ub, dybde = 0, ruter = []) => {
    const flater = parseKml(await hentTekst(hent, kmlUrl(tjeneste, lag, b)));
    if (flater.length < KML_MAKS || dybde >= 5) { ruter.push(b); return flater; }
    const mx = (b[0] + b[2]) / 2; const my = (b[1] + b[3]) / 2;
    const deler = [[b[0], b[1], mx, my], [mx, b[1], b[2], my], [b[0], my, mx, b[3]], [mx, my, b[2], b[3]]].filter((d) => {
      const h = [[d[0], d[1]], [d[0], d[3]], [d[2], d[1]], [d[2], d[3]]].map(([x, y]) => utmTilGeo(x, y, 33));
      const gb = [Math.min(...h.map((p) => p[0])), Math.min(...h.map((p) => p[1])), Math.max(...h.map((p) => p[0])), Math.max(...h.map((p) => p[1]))];
      return boksTreff(gb) && trygg(() => T.booleanIntersects(T.bboxPolygon(gb), eiendom)) !== false;
    });
    const sett = new Map();
    for (const d of deler) for (const f of await hentKml(tjeneste, lag, d, dybde + 1, ruter)) if (!sett.has(f.id)) sett.set(f.id, f);
    return [...sett.values()];
  };
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
  // Attributter for alle flater i hver rute med én spørring (GML, RADIUS=bbox). Svaret mangler av og til
  // enkelte flater ved rutekanten; de hentes etterpå med punktspørring.
  const masseAttributter = async (tjeneste, lag, ruter, idfelt) => {
    const alle = new Map();
    await parallelt(ruter, 3, async (b) => {
      const url = `${NIBIO}/${tjeneste}?SERVICE=WMS&VERSION=1.1.1&SRS=EPSG:25833&BBOX=${b.map((v) => v.toFixed(1)).join(',')}&STYLES=&REQUEST=GetFeatureInfo&LAYERS=${lag}&QUERY_LAYERS=${lag}&WIDTH=1000&HEIGHT=1000&X=500&Y=500&RADIUS=bbox&FEATURE_COUNT=100000&INFO_FORMAT=application/vnd.ogc.gml`;
      let tekst = '';
      try { tekst = await hentTekst(hent, url, 90000); } catch { return; }
      for (const del of tekst.split(`<${lag}_feature>`).slice(1)) {
        const a = {};
        for (const [, k, v] of del.split(`</${lag}_feature>`)[0].matchAll(/<(\w+)>([^<]*)<\/\1>/g)) a[k] = v;
        if (a[idfelt]) alle.set(String(a[idfelt]), a);
      }
    });
    return alle;
  };
  const hentAttributter = async (tjeneste, lag, objekter, ruter, idfelt, steg, tekst) => {
    logg(steg, 'aktiv', `${tekst} …`);
    const m = await masseAttributter(tjeneste, lag, ruter, idfelt);
    const mangler = [];
    for (const o of objekter) { o.attr = m.get(String(o.id)) || null; if (!o.attr) mangler.push(o); }
    if (mangler.length) await attributter(tjeneste, lag, mangler, idfelt === 'gid' ? 'gid' : null, steg, tekst);
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
  const planRuter = [];
  const plan = (await hentKml('skogbruksplan', 'hogstklasser', ub, 0, planRuter)).filter(iEiendom);
  if (plan.length) await hentAttributter('skogbruksplan', 'hogstklasser', plan, planRuter, 'sl_sdeid', 'plan', 'Henter bestandsdata');
  logg('plan', 'ok', plan.length ? `Tidligere skogbruksplan: ${plan.length} bestand` : 'Ingen tidligere skogbruksplan i NIBIOs data – bruker bare SR16');

  // 3. SR16
  logg('sr16', 'aktiv', 'Henter skogressurskart SR16 …');
  const sr16Ruter = [];
  const sr16 = (await hentKml('sr16', 'SRVTRESLAG', ub, 0, sr16Ruter)).filter(iEiendom);
  if (sr16.length) await hentAttributter('sr16', 'SRVTRESLAG', sr16, sr16Ruter, 'gid', 'sr16', 'Henter SR16-verdier');
  const sr16Data = sr16.filter((s) => s.attr);
  sr16Data.forEach((s) => { s.bbox = T.bbox(s.geometry); });
  // Fjernmålingsår og årsversjon finnes bare i HTML-svaret; én spørring over hele eiendommen holder.
  let sr16Aar = null;
  try {
    const html = await hentTekst(hent, `${NIBIO}/sr16?SERVICE=WMS&VERSION=1.1.1&SRS=EPSG:25833&BBOX=${ub.join(',')}&STYLES=&REQUEST=GetFeatureInfo&LAYERS=SRVTRESLAG&QUERY_LAYERS=SRVTRESLAG&WIDTH=1000&HEIGHT=1000&X=500&Y=500&RADIUS=bbox&FEATURE_COUNT=5000&INFO_FORMAT=text/html`);
    const aar = [...html.matchAll(/3D-fjernmålingsår<\/td><td><b>(\d{4})/g)].map((m) => +m[1]).sort((a, b) => a - b);
    const versjon = [...html.matchAll(/Årsversjon<\/td><td><b>(\d{4})/g)].map((m) => +m[1]);
    if (aar.length) sr16Aar = { fra: aar[0], til: aar.at(-1), median: aar[Math.floor(aar.length / 2)], versjon: versjon.length ? Math.max(...versjon) : null };
  } catch { /* årstall er nyttig, men ikke nødvendig */ }
  logg('sr16', 'ok', `SR16: ${sr16Data.length} skogflater${sr16Aar ? `, målt ${sr16Aar.fra === sr16Aar.til ? sr16Aar.fra : `${sr16Aar.fra}–${sr16Aar.til}`}` : ''}`);

  // 4. MiS
  logg('mis', 'aktiv', 'Henter miljøregistreringer (MiS) …');
  let mis = [];
  try { mis = (await hentKml('mis', 'Nokkelbiotop')).filter(iEiendom); } catch { /* MiS er valgfritt */ }
  const misUnion = mis.length ? forening(mis.map((m) => feat(m.geometry))) : null;
  const misBb = misUnion ? T.bbox(misUnion) : null;
  logg('mis', 'ok', `MiS-nøkkelbiotoper: ${mis.length}`);

  // 5. Markslag (AR5): uproduktiv skog, myr, åpen fastmark, jordbruk, bebyggelse og vann skilles ut.
  logg('markslag', 'aktiv', 'Henter markslag fra AR5 (NIBIO) …');
  let ar5 = []; let ar5Feil = null;
  try {
    ar5 = await hentAr5(eiendom.geometry, { hent, boksTreff, klipp: (g) => klipp(g)?.geometry || null, logg: (t) => logg('markslag', 'aktiv', t) });
  } catch (e) { ar5Feil = e.message; }
  const uproduktiv = ar5.filter((f) => f.kategori !== 'produktiv').map((f) => ({ ...f, f: feat(f.geometri), bb: T.bbox(f.geometri) }));
  const ar5Sum = {}; for (const f of ar5) ar5Sum[f.kategori] = (ar5Sum[f.kategori] || 0) + f.areal;
  logg('markslag', ar5Feil ? 'feil' : 'ok', ar5Feil ? `AR5 kunne ikke hentes (${ar5Feil}) – uproduktiv mark er ikke skilt ut` : `Markslag: ${Object.entries(ar5Sum).filter(([k]) => k !== 'produktiv').map(([k, v]) => `${MARKSLAG[k].kort} ${Math.round(v)} daa`).join(', ') || 'ingen uproduktiv mark'}`);

  // 5b. Skifteinndeling av jordbruksarealet (AR5 + jordsmonn) – se skifteplan.js for prinsippene.
  const markslag = lagFigurer(ar5, nyId);
  let skifteplan = null;
  if (markslag.some((f) => f.kategori === 'jordbruk')) {
    logg('skifter', 'aktiv', 'Henter jordsmonn og deler jordbruksarealet i skifter …');
    let jordsmonn = []; let jordFeil = null;
    if (klipping) {
      try { jordsmonn = await hentJordsmonnFlater(jordbruksBoks(markslag), { hent, logg: (t) => logg('skifter', 'aktiv', t) }); } catch (e) { jordFeil = e.message; }
    }
    const r = lagSkifteinndeling(markslag, { klipping, jordsmonn, iAar, nyId });
    skifteplan = { ...tomSkifteplan(iAar, kommune.nr), skifter: r.skifter, inndeling: { ...r.logg, laget: new Date().toISOString().slice(0, 10), jordsmonn: jordsmonn.length, feil: jordFeil } };
    logg('skifter', 'ok', `${r.skifter.length} skifter på ${Math.round(r.logg.areal)} daa jordbruksareal${r.logg.delt ? ` – ${r.logg.delt} AR5-figurer delt etter jordsmonn` : ''}${jordFeil ? ` (jordsmonn kunne ikke hentes: ${jordFeil})` : !klipping ? ' (uten jordsmonndeling)' : ''}`);
  } else logg('skifter', 'ok', 'Ingen jordbruksareal på eiendommen');

  // 5. Sett sammen bestand
  logg('bygg', 'aktiv', 'Setter sammen bestand og sammenligner plan med SR16 …');
  const kandidater = [];
  const overlapper = (a, b) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
  // NIBIO lagrer noen bestand som flere separate flater med samme bestandsnummer. Like data → slås sammen.
  const likeData = (a, b) => ['hogstkl_verdi', 'bonitet_beskrivelse', 'bontre_beskrivelse', 'alder_korr', 'alder'].every((f) => (a[f] ?? '') === (b[f] ?? ''));
  const perNr = new Map();
  for (const p of plan) {
    if (!p.klipp) continue;
    const a = p.attr || {}; const nr = a.teig_best_nr;
    const finnes = nr && (perNr.get(nr) || []).find((x) => likeData(x.attr, a));
    if (finnes) { finnes.deler.push(p.klipp); continue; }
    const kand = { kilde: 'plan', deler: [p.klipp], attr: a };
    if (nr) perNr.set(nr, [...(perNr.get(nr) || []), kand]);
    kandidater.push(kand);
  }
  for (const kand of kandidater) { kand.g = kand.deler.length > 1 ? forening(kand.deler) : kand.deler[0]; kand.bb = T.bbox(kand.g); delete kand.deler; }
  // Samme nummer med ulike data blir egne bestand med bokstav etter nummeret.
  for (const liste of perNr.values()) if (liste.length > 1) liste.forEach((kand, i) => { kand.nrTillegg = String.fromCharCode(97 + i); });
  const planKand = [...kandidater];
  for (const s of sr16Data) {
    let rest = s.klipp;
    // Trekk fra bare planbestand som kan overlappe (ikke hele planen samlet).
    for (const p of planKand) { if (!rest) break; if (overlapper(s.bbox, p.bb)) rest = minus(rest, p.g); }
    if (rest && arealM2(rest) / 1000 >= minDaa) kandidater.push({ kilde: 'sr16', g: rest, attr: {} });
  }

  // Uproduktiv mark trekkes ut av bestandene, slik at det ikke beregnes volum der. Små rester (< 0,3 daa) fjernes.
  const utenSmaa = (g) => {
    if (!g) return null;
    const polys = g.geometry.type === 'Polygon' ? [g.geometry.coordinates] : g.geometry.coordinates;
    const beholdt = polys.filter((pp) => arealM2({ type: 'Polygon', coordinates: pp }) >= 300);
    return beholdt.length ? feat(beholdt.length === 1 ? { type: 'Polygon', coordinates: beholdt[0] } : { type: 'MultiPolygon', coordinates: beholdt }) : null;
  };
  for (const k of kandidater) {
    const bb = T.bbox(k.g); let naa = arealM2(k.g); const trukket = {};
    for (const u of uproduktiv) {
      if (!k.g || !overlapper(bb, u.bb)) continue;
      const etter = minus(k.g, u.f); const ny = etter ? arealM2(etter) : 0;
      if (naa - ny > 1) trukket[u.kategori] = (trukket[u.kategori] || 0) + (naa - ny);
      k.g = etter; naa = ny;
    }
    k.g = utenSmaa(k.g);
    const sum = Object.values(trukket).reduce((x, y) => x + y, 0);
    if (sum > 500) k.uproduktiv = Object.entries(trukket).filter(([, v]) => v > 100).map(([kat, v]) => `${(v / 1000).toFixed(1).replace('.', ',')} daa ${MARKSLAG[kat].kort.toLowerCase()}`).join(', ');
  }

  const bestand = [];
  let lopenr = 0;
  for (const k of kandidater) {
    if (!k.g) continue;
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
      nr = k.attr.teig_best_nr ? `${k.attr.teig_best_nr}${k.nrTillegg || ''}` : `P${bestand.length + 1}`;
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
    // SR16 mangler ofte bonitet på gammel skog med lite volum. Da brukes skogboniteten i AR5 (lav, middels, høy,
    // særs høy), satt til laveste H40-trinn i klassen – forsiktig valg som gir høyere hogstalder.
    let bonitetFraAr5 = null;
    if (!bonitet) {
      const pt = etikettPunkt(k.g.geometry);
      const f = pt && ar5.find((x) => x.kategori === 'produktiv' && x.ar5?.bonitet && punktIGeometri(pt, x.geometri));
      const h40 = f ? AR5_BONITET_H40[String(f.ar5.bonitet).toLowerCase()] : null;
      if (h40) { bonitet = h40; bonitetFraAr5 = f.ar5.bonitet; }
    }
    const treslag = srTreslag && dekning > 0.5 ? srTreslag : (planTs || srTreslag || 'G');
    const merknader = [];
    if (k.kilde === 'sr16') merknader.push('Ikke med i tidligere plan – data fra SR16');
    if (bonitetFraAr5) merknader.push(`Bonitet anslått fra AR5 (${String(bonitetFraAr5).toLowerCase()} bonitet) – kontroller i felt`);
    if (hkPlan >= 4 && volub !== null && volub < 3 && dekning > 0.5) {
      merknader.push(`Mulig hogd etter ${regaar}: SR16 viser ${komma(volub)} m³/daa mot HK ${hkPlan} i planen – kontroller`);
      alder = 0;
    } else if (hkPlan >= 4 && volub !== null && hoydeM !== null && volub < 8 && hoydeM < 10 && dekning > 0.5) {
      merknader.push(`Avvik: HK ${hkPlan} i planen (${regaar}), men SR16 viser ${komma(volub)} m³/daa og ${komma(hoydeM)} m høyde – trolig hogd eller glissen, kontroller`);
    }
    if (planTs && srTreslag && planTs !== srTreslag && dekning > 0.5) merknader.push(`Treslag: plan ${planTs}, SR16 ${srTreslag}`);
    const miljoSnitt = misUnion && overlapper(bb, misBb) ? arealM2(snitt(k.g, misUnion)) : 0;
    const miljo = miljoSnitt > Math.max(500, 0.2 * areal);
    if (miljo) merknader.push('Overlapper MiS-nøkkelbiotop');
    if (!deler.length) merknader.push('Ingen SR16-data – volum er ikke kjent');
    if (k.uproduktiv) merknader.push(`Uproduktiv mark trukket ut etter AR5: ${k.uproduktiv}`);

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
  // Siste reserve for bonitet: nærmeste nabobestand med bonitet innenfor 300 m (små kantflater utenfor AR5-figurene).
  const senterUtm = new Map(bestand.map((b) => { const p = etikettPunkt(b.geometri); return [b, p ? geoTilUtm(p[0], p[1], 33) : null]; }));
  for (const b of bestand.filter((x) => !x.bonitet)) {
    const c = senterUtm.get(b); if (!c) continue;
    let best = null; let bd = 300;
    for (const n of bestand) { if (!n.bonitet || n === b) continue; const d = senterUtm.get(n); if (!d) continue; const avst = Math.hypot(c[0] - d[0], c[1] - d[1]); if (avst < bd) { bd = avst; best = n; } }
    if (!best) continue;
    b.bonitet = best.bonitet;
    b.merknad = [b.merknad, `Bonitet anslått fra nabobestand ${best.nr} (${Math.round(bd)} m unna) – kontroller i felt`].filter(Boolean).join('; ');
  }
  const nokkel = (b) => [b.nr.startsWith('S') ? 1 : 0, ...b.nr.replace(/^S/, '').split('-').map((x) => parseInt(x, 10) || 0)];
  bestand.sort((a, b) => { const x = nokkel(a); const y = nokkel(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0); } return 0; });

  const skogDaa = bestand.reduce((s, b) => s + b.areal, 0);
  const flagget = bestand.filter((b) => /hogd/.test(b.merknad)).length;
  logg('bygg', 'ok', `${bestand.length} bestand på ${skogDaa.toFixed(0)} daa skog${flagget ? `, ${flagget} merket for kontroll` : ''}`);
  if (!bestand.length) throw new Error('Fant ingen skogdata innenfor eiendommen. Er eiendommen skogkledd?');

  // 6. Vegetasjonstype per bestand: NIBIOs vegetasjonskart der det finnes, ellers anslag fra treslag, bonitet og
  // AR5-grunnforhold (organiske jordlag gir sumpskog). Se vegetasjon.js.
  logg('vegetasjon', 'aktiv', 'Henter vegetasjonskart (NIBIO) …');
  const organisk = ar5.filter((f) => /organisk/i.test(f.ar5?.grunnforhold || '')).map((f) => ({ geometri: f.geometri, bb: T.bbox(f.geometri) }));
  const veg = await settVegetasjon(bestand, { klipping, hent, organisk, logg: (t) => logg('vegetasjon', 'aktiv', t) });
  logg('vegetasjon', veg.feil && !veg.anslatt ? 'feil' : 'ok', veg.kartlagt
    ? `${veg.kartlagt} bestand fra vegetasjonskartet${veg.aar ? ` (kartlagt ${veg.aar})` : ''}, ${veg.anslatt} anslått fra treslag og bonitet`
    : `Ikke vegetasjonskartlagt her – ${veg.anslatt} bestand anslått fra treslag, bonitet og AR5${veg.feil ? ` (vegetasjonskartet svarte ikke: ${veg.feil})` : ''}`);

  const naa = new Date().toISOString();
  const oppdatert = teiger.map((t) => t.properties?.oppdateringsdato).filter(Boolean).sort();
  const planAar = [...new Set(plan.map((p) => p.attr?.regaar_korr).filter(Boolean))].sort();
  const kilder = {
    eiendom: { id: 'eiendom', navn: 'Eiendomsgrense (matrikkelen)', eier: 'Kartverket', hentet: naa, antall: teiger.length, dataFra: oppdatert[0]?.slice(0, 10) || null, dataTil: oppdatert.at(-1)?.slice(0, 10) || null, krav: [3] },
    plan: { id: 'plan', navn: 'Tidligere skogbruksplan', eier: 'NIBIO', hentet: naa, antall: plan.length, dataFra: planAar[0] ? `${planAar[0]}` : null, dataTil: planAar.at(-1) ? `${planAar.at(-1)}` : null, krav: [3] },
    sr16: { id: 'sr16', navn: 'Skogressurskart SR16', eier: 'NIBIO', hentet: naa, antall: sr16Data.length, dataFra: sr16Aar ? `${sr16Aar.fra}` : null, dataTil: sr16Aar ? `${sr16Aar.til}` : null, versjon: sr16Aar?.versjon || null, krav: [3] },
  };
  const ar5Datoer = ar5.map((f) => f.ar5.datafangst).filter(Boolean).map((d) => d.split('.').reverse().join('-')).sort();
  kilder.vegetasjon = { id: 'vegetasjon', navn: 'Vegetasjonskart', eier: 'NIBIO', hentet: naa, antall: veg.flater, dataFra: veg.aar ? `${veg.aar}` : null, dataTil: veg.aar ? `${veg.aar}` : null, feil: veg.feil, merknad: veg.kartlagt ? `${veg.kartlagt} bestand kartlagt, ${veg.anslatt} anslått` : 'Ikke kartlagt her – vegetasjonstype anslått fra treslag, bonitet og AR5', krav: [3] };
  kilder.ar5 = { id: 'ar5', navn: 'Markslag AR5', eier: 'NIBIO', hentet: naa, antall: ar5.length, dataFra: ar5Datoer[0] || null, dataTil: ar5Datoer.at(-1) || null, feil: ar5Feil, krav: [3] };
  return {
    kilder,
    eiendom: {
      navn: `${kommune.navn} ${gnr}/${bnr}${festenr ? `/${festenr}` : ''}`,
      kommune: kommune.navn, kommunenr: kommune.nr, gnrbnr: `${gnr}/${bnr}${festenr ? `/${festenr}` : ''}`,
      eier: '', takstAar: iAar, grense: eiendom.geometry,
    },
    bestand,
    markslag,
    skifteplan,
    metadata: {
      laget: new Date().toISOString(),
      eiendomDaa, skogDaa, antallFraPlan: plan.length, antallSr16: sr16Data.length, mis: mis.length,
      planRegistrert: planAar.join(', ') || null,
      sr16Aar,
      ar5: Object.fromEntries(Object.entries(ar5Sum).map(([k, v]) => [k, Math.round(v * 10) / 10])),
      kilder: ['Kartverket eiendom-API', 'NIBIO skogbruksplan/hogstklasser', 'NIBIO SR16 (SRV)', 'NIBIO MiS', 'NIBIO AR5'],
    },
  };
}
