// Kommuneanalyse: henter alle SR16-skogflater i en kommune og finner
//   * hogstmoden skog (sluttavvirkning)
//   * skog der lukket hogst (bledning, gruppe- eller skjermhogst) kan være aktuelt
//   * ungskog med behov for ungskogpleie
// Skogflater i MiS-nøkkelbiotoper og naturvernområder holdes utenfor hogstforslagene.
// Modulen bruker ikke DOM og kan kjøres i både nettleser og Node.
import { geoTilUtm, arealM2, punktIGeometri } from './proj.js';
import { laavesteHogstalder, STANDARD_INNSTILLINGER, treslagFraSR16, SR16_TRESLAG_TEKST } from './model.js';

const KARTVERKET = 'https://api.kartverket.no';
const NIBIO = 'https://wms.nibio.no/cgi-bin';
const VERN = 'https://kart.miljodirektoratet.no/arcgis/rest/services/vern/MapServer/0/query';
const RUTE_M = 2500;

export const STANDARD_KRITERIER = {
  minAreal: 2,                 // daa – mindre flater vises ikke
  hogstMinVolum: 15,           // m³/daa u.b.
  hogstTaMedLauv: false,
  lukketMinAlderAndel: 0.8,    // andel av laveste hogstalder
  lukketMaksBonitetGran: 17,   // lavere/middels bonitet egner seg best for lukket hogst i gran
  lukketMaksHoydeforhold: 0.84,// middelhøyde / overhøyde – lavere verdi tyder på flere sjikt (ca. 10 % mest sjiktede av eldre granflater i Nannestad)
  lukketMaksAndelGran: 75,     // eller blandingsskog: gran under denne andelen (%), resten furu/lauv
  lukketMinVolum: 10,
  lukketMaksBonitetFuru: 14,   // furu på lav bonitet: frøtre- eller skjermstilling
  ungMinHoyde: 1.5, ungMaksHoyde: 7,  // m
  ungMinTreantall: 100,        // trær per daa – SR16 ser dårlig småtrær, så tallet er lavere enn ved feltregistrering
  ungMinAndelLauv: 30,         // % lauv i ungskogen – lauvoppslag som konkurrerer med bartrærne
  ungMinBonitet: 11,           // på svært lav bonitet er ungskogpleie sjelden lønnsomt
};

// ---------- nett ----------
async function hentData(hent, url, type = 'text', tidsavbrudd = 60000, forsok = 4) {
  for (let i = 0; ; i++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), tidsavbrudd);
    try {
      const r = await hent(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error(`${new URL(url).host} svarte ${r.status}`);
      return await r[type]();
    } catch (e) {
      if (i >= forsok - 1) throw e.name === 'AbortError' ? new Error(`${new URL(url).host} svarte ikke`) : e;
      await new Promise((r) => setTimeout(r, 800 * 2 ** i));
    } finally { clearTimeout(timer); }
  }
}
const hentTekst = (hent, url, tidsavbrudd) => hentData(hent, url, 'text', tidsavbrudd);

// KMZ er en ZIP-fil med én KML. Pakkes ut med DecompressionStream (deflate-raw).
export async function pakkUtKmz(buf) {
  const u8 = new Uint8Array(buf); const dv = new DataView(buf);
  let e = u8.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) return new TextDecoder().decode(u8); // ikke ZIP – trolig ren KML eller feilmelding
  const p = dv.getUint32(e + 16, true);
  const metode = dv.getUint16(p + 10, true);
  const csize = dv.getUint32(p + 20, true);
  const lho = dv.getUint32(p + 42, true);
  const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
  const data = u8.subarray(start, start + csize);
  if (metode === 0) return new TextDecoder().decode(data);
  const strom = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(strom).text();
}

async function parallelt(liste, antall, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(antall, liste.length) }, async () => {
    while (i < liste.length) { const n = i++; await fn(liste[n], n); }
  }));
}

// ---------- parsing ----------
const avrund = (v) => Math.round(v * 1e6) / 1e6;
export function parseKml(tekst) {
  const ut = new Map();
  const ring = (s) => s.trim().split(/\s+/).map((p) => { const [x, y] = p.split(','); return [avrund(+x), avrund(+y)]; });
  for (const [, pm] of tekst.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)) {
    const id = (pm.match(/<name>[^<]*?\.(\w+)<\/name>/) || [])[1];
    if (!id) continue;
    const polys = [];
    for (const [, poly] of pm.matchAll(/<Polygon>([\s\S]*?)<\/Polygon>/g)) {
      const ytre = poly.match(/<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
      if (!ytre) continue;
      polys.push([ring(ytre[1]), ...[...poly.matchAll(/<innerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g)].map((m) => ring(m[1]))]);
    }
    if (polys.length) ut.set(id, polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys });
  }
  return ut;
}

const FELT = ['gid', 'srtreslag', 'srbonitet', 'srvolub', 'srhoydem', 'srhoydeo', 'srkronedek', 'srtrean', 'srtrealder', 'srdiam'];
export function parseGmlAlle(tekst, lag) {
  const ut = [];
  for (const [, f] of tekst.matchAll(new RegExp(`<${lag}_feature>([\\s\\S]*?)</${lag}_feature>`, 'g'))) {
    const a = {};
    for (const k of FELT) { const m = f.match(new RegExp(`<${k}>([^<]*)</${k}>`)); if (m) a[k] = m[1]; }
    if (a.gid) ut.push(a);
  }
  return ut;
}

// GetFeatureInfo som HTML er gzip-komprimert fra NIBIO (ca. 14 ganger mindre enn GML), men mangler id.
// ID-ene hentes som text/plain i samme rekkefølge.
const HTML_FELT = {
  'Areal (daa)': 'areal', 'Middelhøyde (dm)': 'srhoydem', 'Overhøyde (dm)': 'srhoydeo', 'Volum uten bark (m³/ha)': 'srvolub',
  'Dominerende treslag': 'dominerende', 'Bonitet (H40)': 'srbonitet', 'Kronedekning (prosent)': 'srkronedek',
  'Middeldiameter (cm)': 'srdiam', 'Treantall (cm)': 'srtrean', '3D-fjernmålingsår': 'maaleaar', 'Bestandsalder': 'srtrealder',
  'Prosentandel gran': 'gran', 'Prosentandel furu': 'furu', 'Prosentandel lauv': 'lauv',
};
export function parseHtmlAlle(html, ider) {
  const tabeller = html.split('<table').slice(1);
  if (tabeller.length !== ider.length) return null;
  return tabeller.map((t, i) => {
    const a = { gid: ider[i] };
    for (const [, navn, verdi] of t.matchAll(/<tr><td>([^<]+)<\/td><td><b>([^<]*)<\/b>/g)) {
      const k = HTML_FELT[navn.trim()];
      if (k) a[k] = verdi.trim();
    }
    return a;
  });
}

// ---------- geometri ----------
function ytreRinger(g) { return g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map((p) => p[0]); }
function senter(g) {
  // Tyngdepunkt av største ytre ring; faller tilbake på et toppunkt hvis det havner utenfor.
  const r = ytreRinger(g).sort((a, b) => b.length - a.length)[0];
  let x = 0; let y = 0;
  for (const [px, py] of r) { x += px; y += py; }
  const c = [x / r.length, y / r.length];
  return punktIGeometri(c, g) ? c : r[0];
}
function bboxAv(g) {
  let a = Infinity; let b = Infinity; let c = -Infinity; let d = -Infinity;
  for (const r of ytreRinger(g)) for (const [x, y] of r) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; }
  return [a, b, c, d];
}

function ruter(kommuneGeom) {
  const pts = ytreRinger(kommuneGeom).flat().map(([x, y]) => geoTilUtm(x, y, 33));
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const utmPoly = { type: 'MultiPolygon', coordinates: (kommuneGeom.type === 'Polygon' ? [kommuneGeom.coordinates] : kommuneGeom.coordinates).map((p) => p.map((r) => r.map(([x, y]) => geoTilUtm(x, y, 33)))) };
  const ut = [];
  for (let x = x0; x < x1; x += RUTE_M) {
    for (let y = y0; y < y1; y += RUTE_M) {
      const b = [x, y, x + RUTE_M, y + RUTE_M];
      // Ta med ruten hvis et prøvepunkt ligger i kommunen eller et grensepunkt ligger i ruten.
      let treff = pts.some(([px, py]) => px >= b[0] && px <= b[2] && py >= b[1] && py <= b[3]);
      for (let i = 0; i <= 4 && !treff; i++) for (let j = 0; j <= 4 && !treff; j++) treff = punktIGeometri([x + (RUTE_M * i) / 4, y + (RUTE_M * j) / 4], utmPoly);
      if (treff) ut.push(b);
    }
  }
  return ut;
}

// ---------- henting ----------
export async function hentKommunegrense(nr, hent = fetch) {
  const j = JSON.parse(await hentTekst(hent, `${KARTVERKET}/kommuneinfo/v1/kommuner/${nr}/omrade?utkoordsys=4258`));
  return { navn: j.kommunenavn, nr: j.kommunenummer, geometri: j.omrade };
}

export async function hentKommunedata(kommune, { hent = fetch, framdrift = () => {}, parallelle = 4 } = {}) {
  framdrift({ steg: 'grense', tekst: `Henter kommunegrense for ${kommune.navn} …` });
  const grense = await hentKommunegrense(kommune.nr, hent);
  const alleRuter = ruter(grense.geometri);
  const flater = new Map();
  const mis = new Map();
  let ferdig = 0;
  framdrift({ steg: 'sr16', tekst: `Henter SR16 i ${alleRuter.length} ruter …`, andel: 0 });
  let lastet = 0;
  const kmz = typeof DecompressionStream !== 'undefined';
  const hentGeometri = async (tjeneste, lag, base) => (kmz
    ? pakkUtKmz(await hentData(hent, `${NIBIO}/${tjeneste}?${base}&REQUEST=GetMap&LAYERS=${lag}&WIDTH=2000&HEIGHT=2000&FORMAT=kmz`, 'arrayBuffer'))
    : hentTekst(hent, `${NIBIO}/${tjeneste}?${base}&REQUEST=GetMap&LAYERS=${lag}&WIDTH=2000&HEIGHT=2000&FORMAT=kml`));
  await parallelt(alleRuter, parallelle, async (b) => {
    const bb = b.map((v) => v.toFixed(1)).join(',');
    const base = `SERVICE=WMS&VERSION=1.1.1&SRS=EPSG:25833&BBOX=${bb}&STYLES=`;
    const gfi = `${NIBIO}/sr16?${base}&REQUEST=GetFeatureInfo&LAYERS=SRVTRESLAG&QUERY_LAYERS=SRVTRESLAG&WIDTH=1000&HEIGHT=1000&X=500&Y=500&RADIUS=bbox&FEATURE_COUNT=100000&INFO_FORMAT=`;
    const [kml, ider, html, misKml] = await Promise.all([
      hentGeometri('sr16', 'SRVTRESLAG', base),
      hentTekst(hent, `${gfi}text/plain`).then((t) => [...t.matchAll(/Feature (\d+):/g)].map((m) => m[1])),
      hentTekst(hent, `${gfi}text/html`),
      hentGeometri('mis', 'Nokkelbiotop', base).catch(() => ''),
    ]);
    lastet += kml.length / 8 + html.length / 14; // grovt anslag på overført mengde (komprimert)
    let attr = parseHtmlAlle(html, ider);
    if (!attr) attr = parseGmlAlle(await hentTekst(hent, `${gfi}application/vnd.ogc.gml`), 'SRVTRESLAG');
    const geom = parseKml(kml);
    for (const a of attr) {
      if (flater.has(a.gid)) continue;
      const g = geom.get(a.gid);
      if (g) flater.set(a.gid, { attr: a, geometri: g });
    }
    for (const [id, g] of parseKml(misKml)) mis.set(id, g);
    ferdig++;
    framdrift({ steg: 'sr16', tekst: `Rute ${ferdig} av ${alleRuter.length} – ${flater.size.toLocaleString('nb-NO')} skogflater`, andel: ferdig / alleRuter.length });
  });

  framdrift({ steg: 'vern', tekst: 'Henter naturvernområder (Miljødirektoratet) …' });
  const [gx0, gy0, gx1, gy1] = bboxAv(grense.geometri);
  let vern = [];
  try {
    const q = new URLSearchParams({ where: '1=1', geometry: `${gx0},${gy0},${gx1},${gy1}`, geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: 'navn,verneform', f: 'geojson' });
    vern = JSON.parse(await hentTekst(hent, `${VERN}?${q}`)).features.map((f) => ({ navn: f.properties.navn, verneform: f.properties.verneform, geometri: f.geometry }))
      .filter((v) => v.geometri && (ytreRinger(v.geometri).some((r) => r.some((pt) => punktIGeometri(pt, grense.geometri)))
        || ytreRinger(grense.geometri).some((r) => r.some((pt) => punktIGeometri(pt, v.geometri)))));
  } catch { /* vernedata er valgfritt */ }

  framdrift({ steg: 'tolk', tekst: 'Klargjør skogflater …' });
  const ut = [];
  for (const [gid, { attr: a, geometri }] of flater) {
    const c = senter(geometri);
    if (!punktIGeometri(c, grense.geometri)) continue; // flater som hører til nabokommunen
    const num = (k, f = 1) => { const v = parseFloat(a[k]); return Number.isFinite(v) ? v * f : null; };
    ut.push({
      id: gid, geometri, senter: c,
      areal: arealM2(geometri) / 1000,
      treslag: treslagFraSR16(a.srtreslag, a.gran !== undefined ? { G: parseFloat(a.gran), F: parseFloat(a.furu), L: parseFloat(a.lauv) } : null),
      bonitet: num('srbonitet'), alder: num('srtrealder'),
      volumDaa: num('srvolub', 0.1), hoyde: num('srhoydem', 0.1), overhoyde: num('srhoydeo', 0.1),
      treantall: num('srtrean', 0.1), kronedekning: num('srkronedek'), diameter: num('srdiam'),
      maaleaar: num('maaleaar'), dominerende: a.dominerende || SR16_TRESLAG_TEKST[parseInt(a.srtreslag, 10)] || null,
      andel: a.gran !== undefined ? { G: num('gran'), F: num('furu'), L: num('lauv') } : null,
    });
  }
  const misListe = [...mis.values()];
  for (const f of ut) {
    f.mis = misListe.some((m) => punktIGeometri(f.senter, m));
    const v = vern.find((o) => o.geometri && punktIGeometri(f.senter, o.geometri));
    f.vern = v ? `${v.verneform || 'Verneområde'}: ${v.navn}` : null;
  }
  return { kommune: grense, flater: ut, mis: misListe, vern, hentet: new Date().toISOString(), ruter: alleRuter.length };
}

// ---------- klassifisering ----------
export function klassifiser(flater, k = STANDARD_KRITERIER, inn = STANDARD_INNSTILLINGER) {
  const hogst = []; const lukket = []; const ungskog = [];
  for (const f of flater) {
    if (f.areal < k.minAreal || !f.treslag || !f.bonitet) continue;
    const min = laavesteHogstalder({ treslag: f.treslag, bonitet: f.bonitet }, inn);
    const vernet = f.mis || f.vern;
    const forhold = f.hoyde && f.overhoyde ? f.hoyde / f.overhoyde : null;
    const grunner = [];

    // Ungskogpleie
    if (f.hoyde !== null && f.hoyde >= k.ungMinHoyde && f.hoyde <= k.ungMaksHoyde && f.bonitet >= k.ungMinBonitet) {
      const lauv = f.andel ? f.andel.L : (f.treslag === 'L' ? 100 : null);
      if (lauv !== null && lauv >= k.ungMinAndelLauv) grunner.push(`${Math.round(lauv)} % lauv`);
      if (f.treantall >= k.ungMinTreantall) grunner.push(`tett (${Math.round(f.treantall)} trær/daa i SR16)`);
      if (grunner.length) ungskog.push({ ...f, grunn: `Ungskog ${f.hoyde.toFixed(1).replace('.', ',')} m høy, bonitet ${f.bonitet}: ${grunner.join(', ')}`, poeng: f.areal * f.bonitet });
    }
    if (vernet || !min || f.alder === null) continue;

    // Sluttavvirkning
    if (f.alder >= min && f.volumDaa >= k.hogstMinVolum && (f.treslag !== 'L' || k.hogstTaMedLauv)) {
      const pris = (inn.pris[f.treslag] ?? inn.pris.G) - (inn.drift[f.treslag] ?? inn.drift.G);
      hogst.push({ ...f, minAlder: min, rotnetto: f.volumDaa * f.areal * pris, grunn: `Alder ${Math.round(f.alder)} ≥ ${min} år, ${f.volumDaa.toFixed(0)} m³/daa`, poeng: f.volumDaa * f.areal });
    }

    // Lukket hogst
    const sjiktet = forhold !== null && forhold <= k.lukketMaksHoydeforhold;
    const blandet = f.andel && f.andel.G !== null && f.andel.G < k.lukketMaksAndelGran;
    if (f.treslag === 'G' && f.alder >= k.lukketMinAlderAndel * min && f.bonitet <= k.lukketMaksBonitetGran
      && f.volumDaa >= k.lukketMinVolum && (sjiktet || blandet)) {
      const struktur = [sjiktet && `flersjiktet (middelhøyde ${Math.round(forhold * 100)} % av overhøyden)`, blandet && `blandingsskog (${Math.round(f.andel.G)} % gran)`].filter(Boolean).join(', ');
      lukket.push({ ...f, minAlder: min, metode: 'Bledning eller gruppehogst', grunn: `Gran, bonitet ${f.bonitet}, ${struktur}`, poeng: f.volumDaa * f.areal });
    } else if (f.treslag === 'F' && f.alder >= min && f.bonitet <= k.lukketMaksBonitetFuru && f.volumDaa >= k.lukketMinVolum * 0.8) {
      lukket.push({ ...f, minAlder: min, metode: 'Frøtre- eller skjermstilling', grunn: `Hogstmoden furu på bonitet ${f.bonitet} – naturlig foryngelse`, poeng: f.volumDaa * f.areal });
    }
  }
  const sorter = (l) => l.sort((a, b) => b.poeng - a.poeng);
  return { hogst: sorter(hogst), lukket: sorter(lukket), ungskog: sorter(ungskog) };
}

export function oppsummer(liste) {
  return {
    antall: liste.length,
    areal: liste.reduce((s, f) => s + f.areal, 0),
    volum: liste.reduce((s, f) => s + (f.volumDaa || 0) * f.areal, 0),
    rotnetto: liste.reduce((s, f) => s + (f.rotnetto || 0), 0),
  };
}

// Eiendom(mer) i et punkt – til knappen «Lag skogbruksplan for eiendommen».
export async function eiendomIPunkt([lon, lat], hent = fetch) {
  const j = JSON.parse(await hentTekst(hent, `${KARTVERKET}/eiendom/v1/punkt?nord=${lat}&ost=${lon}&koordsys=4258&radius=1&treffPerSide=10`, 20000));
  const sett = new Map();
  for (const e of j.eiendom || []) {
    const n = `${e.gardsnummer}/${e.bruksnummer}${e.festenummer ? `/${e.festenummer}` : ''}`;
    if (!sett.has(n)) sett.set(n, { kommunenr: e.kommunenummer, gnr: e.gardsnummer, bnr: e.bruksnummer, fnr: e.festenummer || 0, tekst: n });
  }
  return [...sett.values()];
}
