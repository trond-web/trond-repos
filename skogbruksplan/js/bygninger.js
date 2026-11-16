// Bygninger på eiendommen fra Kartverket (åpne data) – til landbrukstaksten (js/landbrukstakst.js).
//   * Matrikkelen – bygningspunkt (WFS): bygningsnummer, bygningstype (NS 3457), status og SEFRAK-/kulturminne.
//   * FKB-Bygning (WMS): grunnflaten måles fra kartbildet – fylte piksler som henger sammen med bygningspunktet,
//     innenfor bygningens avgrensningsboks (GetFeatureInfo), så sammenbygde naboer ikke telles med.
// Åpne data har verken bruksareal (BRA/BTA) eller byggeår. BTA anslås som grunnflate × en etasjefaktor per type, og
// byggeår settes til «før 1900» for SEFRAK-registrerte bygninger. Resten må fylles inn (f.eks. fra seeiendom.no).
// Ingen DOM her: tellPiksler (bilde → maske) gis inn fra appen, så modulen kan testes i Node.
import { punktIGeometri, geoTilUtm, bbox } from './proj.js';

export const KILDER = {
  punkt: 'https://wfs.geonorge.no/skwms1/wfs.matrikkelen-bygningspunkt',
  fkb: 'https://wms.geonorge.no/skwms1/wms.fkb',
  seeiendom: 'https://seeiendom.kartverket.no/',
};
// Matrikkelens bygningstyper (NS 3457, utvalg) → navn og type i taksten. etasjer = BTA / grunnflate (anslag).
const BOLIG = { type: 'bolig', etasjer: 1.6 };
export const BYGNINGSTYPER = {
  111: { navn: 'Enebolig', ...BOLIG }, 112: { navn: 'Enebolig med hybel/sokkelleilighet', ...BOLIG }, 113: { navn: 'Våningshus', ...BOLIG },
  121: { navn: 'Tomannsbolig, vertikaldelt', ...BOLIG }, 122: { navn: 'Tomannsbolig, horisontaldelt', ...BOLIG }, 123: { navn: 'Våningshus, tomannsbolig, vertikaldelt', ...BOLIG }, 124: { navn: 'Våningshus, tomannsbolig, horisontaldelt', ...BOLIG },
  161: { navn: 'Fritidsbygning', type: 'annet', etasjer: 1.2 }, 162: { navn: 'Helårsbolig brukt som fritidsbolig', type: 'annet', etasjer: 1.4 }, 163: { navn: 'Våningshus brukt som fritidsbolig', type: 'annet', etasjer: 1.4 },
  171: { navn: 'Seterhus, sel, rorbu o.l.', type: 'annet', etasjer: 1 }, 172: { navn: 'Skogs- og utmarkskoie, gamme', type: 'annet', etasjer: 1 },
  181: { navn: 'Garasje, uthus, anneks til bolig', type: 'redskapshus', etasjer: 1 }, 182: { navn: 'Garasje, uthus, anneks til fritidsbolig', type: 'redskapshus', etasjer: 1 }, 183: { navn: 'Naust, båthus, sjøbu', type: 'lager', etasjer: 1 },
  231: { navn: 'Lagerhall', type: 'lager', etasjer: 1 }, 233: { navn: 'Silobygning', type: 'lager', etasjer: 1 }, 239: { navn: 'Annen lagerbygning', type: 'lager', etasjer: 1 },
  241: { navn: 'Hus for dyr, fôrlager, strølager, landbrukssilo o.l.', type: 'driftsbygning', etasjer: 1.3 }, 243: { navn: 'Veksthus', type: 'annet', etasjer: 1 },
  244: { navn: 'Driftsbygning for fiske og fangst', type: 'annet', etasjer: 1 }, 245: { navn: 'Naust/redskapshus for fiske', type: 'lager', etasjer: 1 }, 248: { navn: 'Annen fiskeri- og fangstbygning', type: 'annet', etasjer: 1 },
  249: { navn: 'Annen landbruksbygning', type: 'redskapshus', etasjer: 1 },
};
const typeFor = (kode) => BYGNINGSTYPER[kode] || { navn: `Bygningstype ${kode}`, type: 'annet', etasjer: 1 };
// Statuser som ikke er stående bygninger (rammetillatelse, igangsettingstillatelse, revet, flyttet, utgått, avlyst, ...).
const IKKE_STAENDE = ['RA', 'IP', 'IG', 'BR', 'BF', 'BU', 'BA', 'GR', 'MD'];

// GML fra bygningspunkt-WFS (EPSG:4258, lat lon).
export function parseBygningspunkt(xml) {
  const ut = [];
  for (const del of String(xml).split(/<wfs:member>/).slice(1)) {
    const pos = del.match(/<gml:pos>\s*([-\d.]+)\s+([-\d.]+)/); if (!pos) continue;
    const felt = (n) => (del.match(new RegExp(`<app:${n}>([^<]*)<`)) || [])[1];
    const status = felt('bygningsstatus') || ''; if (IKKE_STAENDE.includes(status)) continue;
    ut.push({ nr: felt('bygningsnummer') || null, kode: Number(felt('bygningstype')) || 0, status, lat: Number(pos[1]), lon: Number(pos[2]), sefrak: felt('harSefrakminne') === 'true', kulturminne: felt('harKulturminne') === 'true' });
  }
  return ut;
}
// Avgrensningsboks (UTM 33) for bygningen i punktet, fra FKB GetFeatureInfo (GML): [minØ, minN, maksØ, maksN].
export function parseBoks(gml) {
  const m = String(gml).match(/<gml:coordinates[^>]*>\s*([-\d.]+),([-\d.]+)\s+([-\d.]+),([-\d.]+)/); if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
}
// Teller fylte piksler som henger sammen med senterpikselen, bare innenfor boksen. maske(x, y) → true for fylt.
export function tellFotavtrykk(maske, w, h, { senter = [Math.floor(w / 2), Math.floor(h / 2)], innenfor = [0, 0, w - 1, h - 1] } = {}) {
  const [x0, y0, x1, y1] = innenfor; let start = senter;
  if (!maske(...start)) { // nærmeste fylte piksel innenfor boksen
    let best = null; let bd = Infinity;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (maske(x, y)) { const d = (x - senter[0]) ** 2 + (y - senter[1]) ** 2; if (d < bd) { bd = d; best = [x, y]; } }
    if (!best) return 0; start = best;
  }
  const sett = new Set([start[1] * w + start[0]]); const stakk = [start];
  while (stakk.length) {
    const [x, y] = stakk.pop();
    for (const [a, b] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (a < x0 || a > x1 || b < y0 || b > y1) continue; const k = b * w + a;
      if (!sett.has(k) && maske(a, b)) { sett.add(k); stakk.push([a, b]); }
    }
  }
  return sett.size;
}

const fkbUrl = (req, [a, b, c, d], w, h, ekstra = '') => `${KILDER.fkb}?SERVICE=WMS&VERSION=1.3.0&REQUEST=${req}&LAYERS=bygning&STYLES=&CRS=EPSG:25833&BBOX=${a.toFixed(2)},${b.toFixed(2)},${c.toFixed(2)},${d.toFixed(2)}&WIDTH=${w}&HEIGHT=${h}${ekstra}`;
// Grunnflate (m²) for bygningen i punktet (UTM 33). tellPiksler(url, w, h) → maske(x, y). Null når det ikke lar seg måle.
export async function grunnflate(e, n, { hent = (u, o) => fetch(u, o), tellPiksler, R = 30, opplosning = 0.1 } = {}) {
  const v = [e - R, n - R, e + R, n + R]; const px = Math.round((2 * R) / opplosning);
  let boks = null;
  try { boks = parseBoks(await (await hent(fkbUrl('GetFeatureInfo', v, 101, 101, '&QUERY_LAYERS=bygning&I=50&J=50&INFO_FORMAT=application/vnd.ogc.gml&FEATURE_COUNT=1'))).text()); } catch { /* uten boks */ }
  if (boks && (boks[2] - boks[0] > 2 * R - 2 || boks[3] - boks[1] > 2 * R - 2)) return { m2: Math.round((boks[2] - boks[0]) * (boks[3] - boks[1])), metode: 'boks' }; // svært stor: bruk boksen
  if (!tellPiksler) return boks ? { m2: Math.round((boks[2] - boks[0]) * (boks[3] - boks[1]) * 0.85), metode: 'boks' } : null;
  const maske = await tellPiksler(fkbUrl('GetMap', v, px, px, '&FORMAT=image/png&TRANSPARENT=true'), px, px);
  if (!maske) return null;
  const tilPx = (x, y) => [Math.floor((x - v[0]) / opplosning), Math.floor((v[3] - y) / opplosning)];
  const innenfor = boks ? (() => { const [a, d] = tilPx(boks[0], boks[1]); const [c, b] = tilPx(boks[2], boks[3]); return [Math.max(0, a - 1), Math.max(0, b - 1), Math.min(px - 1, c + 1), Math.min(px - 1, d + 1)]; })() : [0, 0, px - 1, px - 1];
  const antall = tellFotavtrykk(maske, px, px, { innenfor });
  return antall ? { m2: Math.round(antall * opplosning * opplosning), metode: boks ? 'kart' : 'kart uten boks' } : null;
}

// Alle stående bygninger innenfor eiendomsgrensen (WGS84-polygon), med grunnflate når tellPiksler er gitt.
export async function hentBygninger(grense, { hent = (u, o) => fetch(u, o), tellPiksler = null, maks = 40, logg = () => {} } = {}) {
  const [a, b, c, d] = bbox([grense]);
  const url = `${KILDER.punkt}?service=WFS&version=2.0.0&request=GetFeature&typeNames=app:Bygning&count=2000&bbox=${b.toFixed(6)},${a.toFixed(6)},${d.toFixed(6)},${c.toFixed(6)},urn:ogc:def:crs:EPSG::4258`;
  const r = await hent(url); if (!r.ok) throw new Error(`Matrikkelen svarte ${r.status}`);
  const innenfor = parseBygningspunkt(await r.text()).filter((x) => punktIGeometri([x.lon, x.lat], grense));
  const alle = innenfor.slice(0, maks); const ut = []; ut.totalt = innenfor.length;
  for (const [i, x] of alle.entries()) {
    logg(`Måler grunnflate ${i + 1} av ${alle.length} …`);
    const [e, n] = geoTilUtm(x.lon, x.lat, 33);
    let g = null; try { g = await grunnflate(e, n, { hent, tellPiksler }); } catch { /* uten areal */ }
    ut.push({ ...x, grunnflate: g?.m2 ?? null, flatemetode: g?.metode || null });
  }
  return ut;
}

// Bygning i taksten (js/landbrukstakst.js). Første bolig blir våningshus, neste kårbolig.
export function tilTakstbygg(x, { nyId, harVaaningshus = false } = {}) {
  const t = typeFor(x.kode);
  const type = t.type === 'bolig' ? (harVaaningshus ? 'kaarbolig' : 'vaaningshus') : t.type;
  const bta = x.grunnflate ? Math.round(x.grunnflate * t.etasjer) : null;
  return {
    id: nyId('bg'), type, navn: t.navn, bta, byggeaar: x.sefrak ? 1890 : null, tilstand: 'normal',
    kilde: 'matrikkel', bygningsnummer: x.nr, bygningstype: x.kode, grunnflate: x.grunnflate, sefrak: x.sefrak || x.kulturminne || false,
    merknad: [x.grunnflate ? `Grunnflate ${x.grunnflate} m² (FKB)${t.etasjer !== 1 ? `, BTA anslått × ${String(t.etasjer).replace('.', ',')}` : ''}` : 'Grunnflate ikke målt', x.sefrak ? 'SEFRAK – bygd før 1900' : ''].filter(Boolean).join(' · '),
  };
}
// Slår sammen med bygningene som finnes: nye legges til, kjente (samme bygningsnummer) får grunnflate/BTA bare der det mangler.
export function slaSammen(eksisterende, nye, { nyId }) {
  const liste = [...eksisterende]; let lagtTil = 0; let oppdatert = 0;
  for (const x of nye) {
    const fins = liste.find((g) => g.bygningsnummer && g.bygningsnummer === x.nr);
    if (fins) { if (!fins.bta && x.grunnflate) { const t = tilTakstbygg(x, { nyId }); fins.bta = t.bta; fins.grunnflate = t.grunnflate; oppdatert++; } continue; }
    liste.push(tilTakstbygg(x, { nyId, harVaaningshus: liste.some((g) => g.type === 'vaaningshus') })); lagtTil++;
  }
  return { liste, lagtTil, oppdatert };
}
