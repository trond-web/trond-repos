// Maskindata for presisjonslandbruk: utveksling med John Deere (Gen4/G5-skjermer og Operations Center) og andre
// ISOBUS-terminaler. Ingen DOM – kan testes i Node.
//
// Til traktoren (eksport):
//   * Skiftegrenser som Shapefile (WGS84) og ISOXML (ISO 11783-10, TASKDATA.XML).
//   * Kjørespor (AB-linjer) langs den lengste siden av hvert skifte – mindre overlapp og hull.
//   * Gjødselkart (Rx) for en planlagt gjødsling. Har skiftet avlingskart fra tidligere år, deles det i soner, og
//     N-mengden justeres etter forventet avling i sonen med Gjødslingshåndbokas korreksjon (kg N per 100 kg avling).
//   * Pakket som ZIP med mappene Rx/ (Gen4/G5: importeres fra rota på USB-pinnen), SkogIQ/ (grenser og kjørespor) og
//     TASKDATA/ (ISOXML), eller lastet opp til Operations Center (jd-relay.js).
// Fra traktoren (import):
//   * Shapefile-eksport fra Operations Center (utført gjødsling/sprøyting, såing og avlingskart) – også i ZIP.
//   * ISOXML TASKDATA med tidslogger (TLG*.XML/BIN) fra ISOBUS-oppgaver.
//   Dataene fordeles på skiftene: gjødslingen registreres som utført i gjødseljournalen (en planlagt gjødsling med
//   samme produkt blir merket utført), sprøyting går til sprøytejournalen, og avlingen lagres per skifte med et
//   avlingskart i 20 m-ruter. Dette dekker KSL 1.1.3, 1.2.3 og 1.5.4 (se ksl.js).
import { geoTilUtm, utmTilGeo, arealM2 } from './proj.js';
import { KULTURER, MINERAL, gjodselbehov } from './skifteplan.js';

export const KILDER = {
  isoxml: { navn: 'ISO 11783-10 (ISOXML) – oppgavedata for ISOBUS', url: 'https://www.aef-online.org/the-aef/isobus/isobus-standard.html' },
  jdApi: { navn: 'John Deere Developer – Operations Center API', url: 'https://developer.deere.com' },
  jdGen4: { navn: 'John Deere Gen4/G5: import av data fra USB (Data Manager)', url: 'https://www.deere.com/assets/pdfs/common/stellarsupport/18-2Gen4-CommandCenter-NewFeatures-English.pdf' },
};

// ---------- små hjelpere ----------
const r1 = (v) => Math.round(v * 10) / 10;
const ringerAv = (g) => (g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []);
const signert = (r) => { let s = 0; for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return s / 2; };
const tilUtm = (r) => r.map(([x, y]) => geoTilUtm(x, y, 33));
function iRing(x, y, r) { let inne = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i]; const [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inne = !inne; } return inne; }
export const iGeometri = ([x, y], g) => ringerAv(g).some((p) => iRing(x, y, p[0]) && !p.slice(1).some((h) => iRing(x, y, h)));
const bboxAv = (g) => { let a = Infinity; let b = Infinity; let c = -Infinity; let d = -Infinity; for (const p of ringerAv(g)) for (const [x, y] of p[0]) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; } return [a, b, c, d]; };
const filnavn = (t) => String(t || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/æ/gi, 'ae').replace(/ø/gi, 'o').replace(/å/gi, 'a').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'SkogIQ';
const xmlEsc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- CRC32 og ZIP ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
const tekstTilBytes = (t) => new TextEncoder().encode(t);
// ZIP uten komprimering (lagret). filer: [{ navn, data: Uint8Array | string }]
export function lagZip(filer, dato = new Date()) {
  const deler = []; const sentral = []; let pos = 0;
  const tid = ((dato.getHours() << 11) | (dato.getMinutes() << 5) | (dato.getSeconds() >> 1)) & 0xffff;
  const dag = (((dato.getFullYear() - 1980) << 9) | ((dato.getMonth() + 1) << 5) | dato.getDate()) & 0xffff;
  for (const f of filer) {
    const data = typeof f.data === 'string' ? tekstTilBytes(f.data) : f.data; const navn = tekstTilBytes(f.navn); const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, tid, true); lh.setUint16(12, dag, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, navn.length, true); lh.setUint16(28, 0, true);
    deler.push(new Uint8Array(lh.buffer), navn, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, tid, true); ch.setUint16(14, dag, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, navn.length, true); ch.setUint32(42, pos, true);
    sentral.push(new Uint8Array(ch.buffer), navn);
    pos += 30 + navn.length + data.length;
  }
  const sLengde = sentral.reduce((s, d) => s + d.length, 0);
  const slutt = new DataView(new ArrayBuffer(22));
  slutt.setUint32(0, 0x06054b50, true); slutt.setUint16(8, filer.length, true); slutt.setUint16(10, filer.length, true); slutt.setUint32(12, sLengde, true); slutt.setUint32(16, pos, true);
  const alle = [...deler, ...sentral, new Uint8Array(slutt.buffer)]; const ut = new Uint8Array(alle.reduce((s, d) => s + d.length, 0)); let o = 0;
  for (const d of alle) { ut.set(d, o); o += d.length; }
  return ut;
}
async function inflateRaw(u8) {
  if (typeof DecompressionStream !== 'function') throw new Error('Nettleseren kan ikke pakke ut ZIP-filer – oppdater nettleseren.');
  return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
}
// Leser en ZIP (lagret eller deflate). Gir [{ navn, data }]. Mapper og filer i __MACOSX hoppes over.
export async function lesZip(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let e = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('Filen er ikke en gyldig ZIP-fil');
  const antall = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const ut = [];
  for (let n = 0; n < antall; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Ødelagt ZIP-katalog');
    const metode = dv.getUint16(p + 10, true); const kLengde = dv.getUint32(p + 20, true); const nl = dv.getUint16(p + 28, true); const xl = dv.getUint16(p + 30, true); const kl = dv.getUint16(p + 32, true); const off = dv.getUint32(p + 42, true);
    const navn = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + kl;
    if (navn.endsWith('/') || /(^|\/)__MACOSX\//.test(navn)) continue;
    const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true); const raa = u8.subarray(start, start + kLengde);
    if (metode === 0) ut.push({ navn, data: raa.slice() });
    else if (metode === 8) ut.push({ navn, data: await inflateRaw(raa) });
    else throw new Error(`ZIP-metode ${metode} støttes ikke (${navn})`);
  }
  return ut;
}

// ---------- DBF ----------
const latin1 = (t) => { const s = String(t ?? ''); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); u[i] = c < 256 ? c : 63; } return u; };
// felter: [{ navn (≤ 10 tegn), type: 'C' | 'N', lengde, des }]
export function lagDbf(felter, rader) {
  const hode = 32 + 32 * felter.length + 1; const rad = 1 + felter.reduce((s, f) => s + f.lengde, 0);
  const u = new Uint8Array(hode + rad * rader.length + 1); const dv = new DataView(u.buffer); const d = new Date();
  u[0] = 0x03; u[1] = d.getFullYear() - 1900; u[2] = d.getMonth() + 1; u[3] = d.getDate();
  dv.setUint32(4, rader.length, true); dv.setUint16(8, hode, true); dv.setUint16(10, rad, true);
  felter.forEach((f, i) => { const o = 32 + i * 32; u.set(latin1(f.navn.slice(0, 10)), o); u[o + 11] = f.type.charCodeAt(0); u[o + 16] = f.lengde; u[o + 17] = f.des || 0; });
  u[hode - 1] = 0x0d;
  rader.forEach((r, i) => {
    let o = hode + i * rad; u[o++] = 0x20;
    for (const f of felter) {
      const v = r[f.navn]; let s;
      if (f.type === 'N') s = v == null || v === '' || !Number.isFinite(Number(v)) ? '' : Number(v).toFixed(f.des || 0);
      else s = String(v ?? '');
      s = f.type === 'N' ? s.slice(0, f.lengde).padStart(f.lengde, ' ') : s.slice(0, f.lengde).padEnd(f.lengde, ' ');
      u.set(latin1(s), o); o += f.lengde;
    }
  });
  u[u.length - 1] = 0x1a;
  return u;
}
export function lesDbf(u8, tegnsett = 'windows-1252') {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const n = dv.getUint32(4, true); const hode = dv.getUint16(8, true); const rad = dv.getUint16(10, true);
  const dek = (() => { try { return new TextDecoder(tegnsett); } catch { return new TextDecoder('latin1'); } })();
  const felter = []; for (let o = 32; o < hode - 1 && u8[o] !== 0x0d; o += 32) { const nb = u8.subarray(o, o + 11); const navn = dek.decode(nb.subarray(0, nb.indexOf(0) >= 0 ? nb.indexOf(0) : 11)).trim(); felter.push({ navn, type: String.fromCharCode(u8[o + 11]), lengde: u8[o + 16], des: u8[o + 17] }); }
  const ut = [];
  for (let i = 0; i < n; i++) {
    let o = hode + i * rad; if (o + rad > u8.length) break; if (u8[o] === 0x2a) { ut.push(null); continue; } o++;
    const r = {};
    for (const f of felter) {
      const s = dek.decode(u8.subarray(o, o + f.lengde)).trim(); o += f.lengde;
      r[f.navn] = f.type === 'N' || f.type === 'F' ? (s === '' || /^\*+$/.test(s) ? null : Number(s)) : f.type === 'L' ? /^[YyTt]$/.test(s) : f.type === 'D' && /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6)}` : s;
    }
    ut.push(r);
  }
  return { felter, rader: ut };
}

// ---------- Shapefile ----------
export const PRJ_WGS84 = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
// Lager .shp/.shx/.dbf/.prj. type: 'polygon' (geometri Polygon/MultiPolygon) | 'linje' (LineString) | 'punkt' (Point).
// Ringene snus etter Shapefile-regelen: ytre ring med klokka, hull mot klokka.
export function lagShapefile(objekter, felter, type = 'polygon') {
  const kode = { punkt: 1, linje: 3, polygon: 5 }[type];
  const innhold = objekter.map((o) => {
    if (type === 'punkt') { const [x, y] = o.geometri.coordinates; const b = new DataView(new ArrayBuffer(20)); b.setInt32(0, 1, true); b.setFloat64(4, x, true); b.setFloat64(12, y, true); return { bytes: new Uint8Array(b.buffer), bb: [x, y, x, y] }; }
    let deler;
    if (type === 'linje') deler = [o.geometri.coordinates];
    else deler = ringerAv(o.geometri).flatMap((p) => p.map((r, i) => { const cw = signert(r) < 0; return (i === 0) === cw ? r : [...r].reverse(); }));
    const pts = deler.flat(); const bb = [Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1]))];
    const b = new DataView(new ArrayBuffer(44 + 4 * deler.length + 16 * pts.length));
    b.setInt32(0, kode, true); bb.forEach((v, i) => b.setFloat64(4 + i * 8, v, true)); b.setInt32(36, deler.length, true); b.setInt32(40, pts.length, true);
    let s = 0; deler.forEach((d, i) => { b.setInt32(44 + i * 4, s, true); s += d.length; });
    pts.forEach(([x, y], i) => { const o2 = 44 + 4 * deler.length + i * 16; b.setFloat64(o2, x, true); b.setFloat64(o2 + 8, y, true); });
    return { bytes: new Uint8Array(b.buffer), bb };
  });
  const bb = innhold.length ? [Math.min(...innhold.map((i) => i.bb[0])), Math.min(...innhold.map((i) => i.bb[1])), Math.max(...innhold.map((i) => i.bb[2])), Math.max(...innhold.map((i) => i.bb[3]))] : [0, 0, 0, 0];
  const hode = (lengdeOrd) => { const h = new DataView(new ArrayBuffer(100)); h.setInt32(0, 9994, false); h.setInt32(24, lengdeOrd, false); h.setInt32(28, 1000, true); h.setInt32(32, kode, true); bb.forEach((v, i) => h.setFloat64(36 + i * 8, v, true)); return new Uint8Array(h.buffer); };
  const shpLengde = 100 + innhold.reduce((s, i) => s + 8 + i.bytes.length, 0);
  const shp = new Uint8Array(shpLengde); const shx = new Uint8Array(100 + 8 * innhold.length);
  shp.set(hode(shpLengde / 2)); shx.set(hode(shx.length / 2));
  const sdv = new DataView(shp.buffer); const xdv = new DataView(shx.buffer); let o = 100;
  innhold.forEach((i, n) => { xdv.setInt32(100 + n * 8, o / 2, false); xdv.setInt32(104 + n * 8, i.bytes.length / 2, false); sdv.setInt32(o, n + 1, false); sdv.setInt32(o + 4, i.bytes.length / 2, false); shp.set(i.bytes, o + 8); o += 8 + i.bytes.length; });
  return { shp, shx, dbf: lagDbf(felter, objekter.map((x) => x.egenskaper || {})), prj: PRJ_WGS84 };
}
// UTM-sone fra .prj (f.eks. «ETRS89 / UTM zone 32N», «WGS_1984_UTM_Zone_33N», EUREF89 UTM sone 33).
export function utmSoneFraPrj(prj) { const m = String(prj || '').match(/UTM[ _]*(?:zone|sone)?[ _]*(\d{2})\s*N?/i); return m ? Number(m[1]) : null; }
// Leser .shp (+ .dbf og .prj) til GeoJSON-objekter i lon/lat. Støtter punkt, linje, polygon og multipunkt (også Z/M).
export function lesShapefile(shp, dbf = null, prj = null) {
  const dv = new DataView(shp.buffer, shp.byteOffset, shp.byteLength);
  if (dv.getInt32(0, false) !== 9994) throw new Error('Ikke en gyldig .shp-fil');
  const sone = utmSoneFraPrj(prj);
  const rader = dbf ? lesDbf(dbf).rader : [];
  const ut = []; let o = 100; let n = 0; const slutt = Math.min(shp.length, dv.getInt32(24, false) * 2);
  // Prosjiserte koordinater uten .prj: anta UTM 33 (EUREF89 / ETRS89, vanlig i Norge).
  const geo = ([x, y]) => (sone || Math.abs(x) > 360 ? utmTilGeo(x, y, sone || 33) : [x, y]);
  while (o + 8 <= slutt) {
    const lengde = dv.getInt32(o + 4, false) * 2; const c = o + 8; const t = dv.getInt32(c, true); const rad = rader[n++] || {}; o = c + lengde;
    if (rad === null) continue;
    const base = t % 10; // 1/11/21 punkt, 3/13/23 linje, 5/15/25 polygon, 8/18/28 multipunkt
    if (t === 0) continue;
    if (base === 1) { ut.push({ geometri: { type: 'Point', coordinates: geo([dv.getFloat64(c + 4, true), dv.getFloat64(c + 12, true)]) }, egenskaper: rad }); continue; }
    if (base === 8) { const np = dv.getInt32(c + 36, true); for (let i = 0; i < np; i++) ut.push({ geometri: { type: 'Point', coordinates: geo([dv.getFloat64(c + 40 + i * 16, true), dv.getFloat64(c + 48 + i * 16, true)]) }, egenskaper: rad }); continue; }
    const nd = dv.getInt32(c + 36, true); const np = dv.getInt32(c + 40, true); const deler = []; for (let i = 0; i < nd; i++) deler.push(dv.getInt32(c + 44 + i * 4, true));
    const p0 = c + 44 + nd * 4; const pts = []; for (let i = 0; i < np; i++) pts.push(geo([dv.getFloat64(p0 + i * 16, true), dv.getFloat64(p0 + i * 16 + 8, true)]));
    const biter = deler.map((s, i) => pts.slice(s, i + 1 < nd ? deler[i + 1] : np));
    if (base === 3) { ut.push({ geometri: biter.length === 1 ? { type: 'LineString', coordinates: biter[0] } : { type: 'MultiLineString', coordinates: biter }, egenskaper: rad }); continue; }
    if (base === 5) {
      // Med klokka (negativt areal i lon/lat) = ytre ring, mot klokka = hull i forrige ytre ring.
      const poly = [];
      for (const r of biter) { if (r.length < 4) continue; if (signert(r) <= 0 || !poly.length) poly.push([[...r].reverse()]); else poly.at(-1).push([...r].reverse()); }
      if (poly.length) ut.push({ geometri: poly.length === 1 ? { type: 'Polygon', coordinates: poly[0] } : { type: 'MultiPolygon', coordinates: poly }, egenskaper: rad });
    }
  }
  return ut;
}

// ---------- ISOXML (ISO 11783-10) ----------
// DDI-er for mengder som brukes ved import og eksport. f gjør om til enhet per daa.
export const DDI = {
  1: { navn: 'Planlagt mengde (volum)', enhet: 'l/daa', f: 0.001, type: 'volum', plan: true },
  2: { navn: 'Utført mengde (volum)', enhet: 'l/daa', f: 0.001, type: 'volum' },
  6: { navn: 'Planlagt mengde (vekt)', enhet: 'kg/daa', f: 0.001, type: 'vekt', plan: true },
  7: { navn: 'Utført mengde (vekt)', enhet: 'kg/daa', f: 0.001, type: 'vekt' },
};
const ddiHex = (n) => n.toString(16).toUpperCase().padStart(4, '0');
const pnt = (type, [lon, lat]) => `<PNT A="${type}" C="${lat.toFixed(9)}" D="${lon.toFixed(9)}"/>`;
const lsg = (type, r) => `<LSG A="${type}">${r.map((p) => pnt(2, p)).join('')}</LSG>`;
const pln = (type, g, navn = '') => ringerAv(g).map((p) => `<PLN A="${type}"${navn ? ` B="${xmlEsc(navn)}"` : ''} C="${Math.round(Math.abs(arealM2({ type: 'Polygon', coordinates: p })))}">${p.map((r, i) => lsg(i === 0 ? 1 : 2, r)).join('')}</PLN>`).join('');
// TASKDATA.XML: kunde (eier), gård, skifter med grenser og AB-linjer, produkter og oppgaver med behandlingssoner.
export function lagIsoxml({ eier = 'SkogIQ', gaard = 'Gård', skifter = [], resepter = [], versjon = '' } = {}) {
  const pdt = new Map(); const pfdId = new Map();
  for (const r of resepter) if (!pdt.has(r.produkt)) pdt.set(r.produkt, `PDT${pdt.size + 1}`);
  const deler = [`<?xml version="1.0" encoding="UTF-8"?>`, `<ISO11783_TaskData VersionMajor="4" VersionMinor="0" ManagementSoftwareManufacturer="SkogIQ.ai" ManagementSoftwareVersion="${xmlEsc(versjon)}" DataTransferOrigin="1">`,
    `<CTR A="CTR1" B="${xmlEsc(eier)}"/>`, `<FRM A="FRM1" B="${xmlEsc(gaard)}" I="CTR1"/>`];
  for (const [navn, id] of pdt) deler.push(`<PDT A="${id}" B="${xmlEsc(navn)}"/>`);
  skifter.forEach((s, i) => {
    const id = `PFD${i + 1}`; pfdId.set(s.id, id);
    const ab = s.ab ? `<GGP A="GGP${i + 1}" B="AB ${xmlEsc(s.navn)}"><GPN A="GPN${i + 1}" B="AB ${xmlEsc(s.navn)}" C="1" E="1" F="1"><LSG A="5">${pnt(6, s.ab.a)}${pnt(7, s.ab.b)}</LSG></GPN></GGP>` : '';
    deler.push(`<PFD A="${id}" C="${xmlEsc(s.navn)}" D="${Math.round(Math.abs(arealM2(s.geometri)))}" E="CTR1" F="FRM1">${pln(1, s.geometri)}${ab}</PFD>`);
  });
  resepter.forEach((r, i) => {
    const vekt = r.enhet !== 'l/daa'; const ddi = vekt ? 6 : 1;
    const soner = r.soner.map((z, j) => `<TZN A="${j + 1}" B="${xmlEsc(z.navn)}">${z.geometrier.map((g) => pln(2, g)).join('')}<PDV A="${ddiHex(ddi)}" B="${Math.round(z.mengde * 1000)}" C="${pdt.get(r.produkt)}"/></TZN>`).join('');
    deler.push(`<TSK A="TSK${i + 1}" B="${xmlEsc(r.navn)}" C="CTR1" D="FRM1" E="${pfdId.get(r.skifteId) || ''}" G="1" H="${r.soner.length > 1 ? 2 : 1}">${soner}</TSK>`);
  });
  deler.push('</ISO11783_TaskData>');
  return deler.join('\n');
}
const attr = (tag) => { const o = {}; for (const [, k, v] of tag.matchAll(/\s([A-Z])="([^"]*)"/g)) o[k] = v; return o; };
// Tidslogg (TLG): XML-hodet sier hvilke felt som ligger i binærfila. Gir [{ tid, lat, lon, verdier: { ddi: verdi } }].
export function lesTlg(xml, bin) {
  const tim = xml.match(/<TIM\b[^>]*>/)?.[0]; if (!tim) throw new Error('TLG mangler TIM');
  const ptn = attr(xml.match(/<PTN\b[^>]*\/?>/)?.[0] || '');
  const dlv = [...xml.matchAll(/<DLV\b[^>]*\/?>/g)].map((m) => attr(m[0]));
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength); const ut = []; let o = 0;
  const tom = (o2, k) => k in o2 && o2[k] === '';
  const PTN_FELT = [['A', 4, 'i'], ['B', 4, 'i'], ['C', 4, 'i'], ['D', 1, 'u'], ['E', 2, 'u'], ['F', 2, 'u'], ['G', 1, 'u'], ['H', 4, 'u'], ['I', 2, 'u']];
  while (o + 6 <= bin.length) {
    const ms = dv.getUint32(o, true); const dager = dv.getUint16(o + 4, true); o += 6;
    const rec = { tid: new Date(Date.UTC(1980, 0, 1) + dager * 86400000 + ms).toISOString(), verdier: {} };
    for (const [k, n, t] of PTN_FELT) {
      if (!tom(ptn, k)) continue; if (o + n > bin.length) return ut;
      const v = n === 4 ? (t === 'i' ? dv.getInt32(o, true) : dv.getUint32(o, true)) : n === 2 ? dv.getUint16(o, true) : dv.getUint8(o); o += n;
      if (k === 'A') rec.lat = v * 1e-7; else if (k === 'B') rec.lon = v * 1e-7; else if (k === 'D') rec.status = v;
    }
    if (rec.lat == null && ptn.A) rec.lat = Number(ptn.A); if (rec.lon == null && ptn.B) rec.lon = Number(ptn.B);
    if (o + 1 > bin.length) break; const nv = dv.getUint8(o); o += 1;
    for (let i = 0; i < nv && o + 5 <= bin.length; i++) { const idx = dv.getUint8(o); const v = dv.getInt32(o + 1, true); o += 5; const d = dlv[idx]; if (d) rec.verdier[parseInt(d.A, 16)] = v; }
    ut.push(rec);
  }
  return ut;
}

// ---------- kjørespor (AB-linjer) ----------
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const kryss = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const ned = []; for (const q of p) { while (ned.length >= 2 && kryss(ned.at(-2), ned.at(-1), q) <= 0) ned.pop(); ned.push(q); }
  const opp = []; for (const q of [...p].reverse()) { while (opp.length >= 2 && kryss(opp.at(-2), opp.at(-1), q) <= 0) opp.pop(); opp.push(q); }
  return [...ned.slice(0, -1), ...opp.slice(0, -1)];
}
// AB-linje parallelt med den lengste siden av skiftets konvekse omriss, forlenget over hele skiftet. Gir { a, b, retning } i lon/lat.
export function abLinje(geometri) {
  const ytre = ringerAv(geometri).map((p) => tilUtm(p[0])); if (!ytre.length) return null;
  const h = hull(ytre.flat()); if (h.length < 2) return null;
  let best = null; for (let i = 0; i < h.length; i++) { const a = h[i]; const b = h[(i + 1) % h.length]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!best || l > best.l) best = { a, b, l }; }
  const ux = (best.b[0] - best.a[0]) / best.l; const uy = (best.b[1] - best.a[1]) / best.l;
  // Projiser alle punkter på retningen og legg linja gjennom midten av skiftet.
  const t = h.map(([x, y]) => (x - best.a[0]) * ux + (y - best.a[1]) * uy); const s = h.map(([x, y]) => -(x - best.a[0]) * uy + (y - best.a[1]) * ux);
  const midt = (Math.min(...s) + Math.max(...s)) / 2; const t0 = Math.min(...t); const t1 = Math.max(...t);
  const punkt = (tt) => utmTilGeo(best.a[0] + ux * tt - uy * midt, best.a[1] + uy * tt + ux * midt, 33);
  return { a: punkt(t0), b: punkt(t1), retning: Math.round(((Math.atan2(ux, uy) * 180) / Math.PI + 360) % 180), lengde: Math.round(t1 - t0) };
}

// ---------- gjødselkart (Rx) ----------
export const RUTE = 20; // m, avlingskartet og sonene
const SONER = [{ id: 'lav', navn: 'Lav avling', farge: '#d9773a' }, { id: 'middels', navn: 'Middels avling', farge: '#e9c46a' }, { id: 'hoy', navn: 'Høy avling', farge: '#4f9d4a' }];
const ruteGeometri = (e, n, s = RUTE) => ({ type: 'Polygon', coordinates: [[[e, n], [e + s, n], [e + s, n + s], [e, n + s], [e, n]].map(([x, y]) => utmTilGeo(x, y, 33))] });
// Avlingskartet fra siste år før planåret (eller planåret selv).
export function sisteAvlingskart(sk, aar) {
  const aarene = Object.keys(sk.avlingskart || {}).map(Number).filter((a) => a <= aar).sort((a, b) => b - a);
  return aarene.length ? { aar: aarene[0], ...sk.avlingskart[aarene[0]] } : null;
}
// Gjødselkart for én gjødsling på ett skifte. g = gjødslingen (produkt, mengde kg/daa). Med avlingskart justeres N etter
// forventet avling i sonen: ΔN = (avling i sonen − forventet avling) / 100 × kN (Gjødslingshåndboka), maks ±25 %.
export function resept(sk, aar, g) {
  const navn = g.innhold?.navn || MINERAL[g.produkt]?.navn || 'Gjødsel'; const pst = (g.innhold || MINERAL[g.produkt] || {}).N || 0;
  const flat = { skifteId: sk.id, navn: `Skifte ${sk.nr} – ${navn}`, produkt: navn, enhet: g.type === 'husdyr' ? 't/daa' : 'kg/daa', dato: g.dato || '', planlagt: Number(g.mengde) || 0 };
  const kart = sisteAvlingskart(sk, aar); const b = gjodselbehov(sk, aar); const k = KULTURER[sk.vekster?.[aar]?.kultur];
  if (!kart?.ruter?.length || !b || !k?.kN || !pst || g.type === 'husdyr') {
    return { ...flat, soner: [{ id: 'hele', navn: 'Hele skiftet', mengde: flat.planlagt, andel: 1, geometrier: [sk.geometri] }], variabel: false, totalt: flat.planlagt * (sk.areal || 0), flatTotalt: flat.planlagt * (sk.areal || 0) };
  }
  const snitt = kart.ruter.reduce((s, r) => s + r[2], 0) / kart.ruter.length;
  const klasse = (v) => (v < snitt * 0.92 ? 0 : v > snitt * 1.08 ? 2 : 1);
  const grupper = SONER.map((z) => ({ ...z, ruter: [] })); for (const r of kart.ruter) grupper[klasse(r[2])].ruter.push(r);
  const nPerKg = pst / 100; const forventet = b.avling;
  const soner = grupper.filter((z) => z.ruter.length).map((z) => {
    const rel = z.ruter.reduce((s, r) => s + r[2], 0) / z.ruter.length / snitt; // relativ avling i sonen
    const dN = ((forventet * rel - forventet) / 100) * k.kN;
    const mengde = Math.round(Math.min(flat.planlagt * 1.25, Math.max(flat.planlagt * 0.75, flat.planlagt + dN / nPerKg)));
    return { id: z.id, navn: z.navn, farge: z.farge, relAvling: r1(rel * 100), mengde, andel: z.ruter.length / kart.ruter.length, geometrier: z.ruter.map(([e, n]) => ruteGeometri(e, n, kart.rute || RUTE)) };
  });
  const totalt = soner.reduce((s, z) => s + z.mengde * z.andel * (sk.areal || 0), 0);
  return { ...flat, soner, variabel: soner.length > 1, avlingsAar: kart.aar, totalt, flatTotalt: flat.planlagt * (sk.areal || 0) };
}
// Planlagte gjødslinger i året, gruppert på produkt og dato (ett valg gir gjødselkart for alle skiftene med den).
export function planlagteGjodslinger(plan, aar) {
  const m = new Map();
  for (const sk of plan?.skifter || []) for (const g of sk.gjodsling || []) {
    if (Number(g.aar) !== aar || g.status === 'utfort' || !sk.geometri) continue;
    const k = `${g.type}|${g.produkt}|${g.dato || ''}`; const x = m.get(k) || { nokkel: k, type: g.type, produkt: g.produkt, navn: g.innhold?.navn || MINERAL[g.produkt]?.navn || g.produkt, dato: g.dato || '', skifter: [] };
    x.skifter.push({ sk, g }); m.set(k, x);
  }
  return [...m.values()].sort((a, b) => String(a.dato).localeCompare(String(b.dato)));
}

// ---------- eksportpakke ----------
// Gir [{ navn, data }] for ZIP: Rx/ (gjødselkart), SkogIQ/ (skiftegrenser og AB-linjer) og TASKDATA/TASKDATA.XML.
export function eksportPakke(S, aar, { valg = null, grenser = true, kjorespor = true, isoxml = true, versjon = '' } = {}) {
  const plan = S.skifteplan; const skifter = (plan?.skifter || []).filter((s) => s.geometri);
  const gaard = S.eiendom?.navn || 'Gård'; const eier = S.eiendom?.eier || gaard; const filer = []; const leggTil = (mappe, navn, sf) => { for (const [ext, data] of Object.entries(sf)) filer.push({ navn: `${mappe}/${navn}.${ext}`, data }); };
  const ab = new Map(skifter.map((s) => [s.id, kjorespor ? abLinje(s.geometri) : null]));
  if (grenser && skifter.length) {
    leggTil('SkogIQ', `${filnavn(gaard)}_skifter`, lagShapefile(skifter.map((s) => ({ geometri: s.geometri, egenskaper: { CLIENT: eier, FARM: gaard, FIELD: `Skifte ${s.nr}${s.navn ? ` ${s.navn}` : ''}`, SKIFTE: s.nr, AREAL_DAA: s.areal, VEKST: KULTURER[s.vekster?.[aar]?.kultur]?.navn || '' } })), [
      { navn: 'CLIENT', type: 'C', lengde: 40 }, { navn: 'FARM', type: 'C', lengde: 40 }, { navn: 'FIELD', type: 'C', lengde: 40 }, { navn: 'SKIFTE', type: 'C', lengde: 10 }, { navn: 'AREAL_DAA', type: 'N', lengde: 10, des: 1 }, { navn: 'VEKST', type: 'C', lengde: 40 }]));
  }
  if (kjorespor && skifter.length) {
    const linjer = skifter.filter((s) => ab.get(s.id)).map((s) => { const l = ab.get(s.id); return { geometri: { type: 'LineString', coordinates: [l.a, l.b] }, egenskaper: { FIELD: `Skifte ${s.nr}`, NAME: `AB ${s.nr}`, RETNING: l.retning, LENGDE_M: l.lengde } }; });
    if (linjer.length) leggTil('SkogIQ', `${filnavn(gaard)}_AB_linjer`, lagShapefile(linjer, [{ navn: 'FIELD', type: 'C', lengde: 40 }, { navn: 'NAME', type: 'C', lengde: 30 }, { navn: 'RETNING', type: 'N', lengde: 5 }, { navn: 'LENGDE_M', type: 'N', lengde: 7 }], 'linje'));
  }
  const resepter = [];
  if (valg) {
    for (const { sk, g } of valg.skifter) {
      const r = resept(sk, aar, g); resepter.push(r);
      const obj = r.soner.flatMap((z) => z.geometrier.map((geo) => ({ geometri: geo, egenskaper: { PRODUCT: r.produkt, RATE_KGHA: z.mengde * 10, RATE_DAA: z.mengde, SONE: z.navn, FIELD: `Skifte ${sk.nr}` } })));
      leggTil('Rx', filnavn(`${gaard}_S${sk.nr}_${r.produkt}_${aar}`), lagShapefile(obj, [{ navn: 'PRODUCT', type: 'C', lengde: 40 }, { navn: 'RATE_KGHA', type: 'N', lengde: 10, des: 0 }, { navn: 'RATE_DAA', type: 'N', lengde: 8, des: 1 }, { navn: 'SONE', type: 'C', lengde: 20 }, { navn: 'FIELD', type: 'C', lengde: 40 }]));
    }
  }
  if (isoxml && skifter.length) filer.push({ navn: 'TASKDATA/TASKDATA.XML', data: lagIsoxml({ eier, gaard, versjon, skifter: skifter.map((s) => ({ id: s.id, navn: `Skifte ${s.nr}${s.navn ? ` ${s.navn}` : ''}`, geometri: s.geometri, ab: ab.get(s.id) })), resepter }) });
  filer.push({ navn: 'LES_MEG.txt', data: lesMeg(gaard, aar, resepter, skifter.length) });
  return { filer, resepter, ab };
}
function lesMeg(gaard, aar, resepter, n) {
  return [`SkogIQ.ai – data til traktoren (${gaard}, ${aar})`, '',
    'John Deere Gen4 / G5 (4600, 4640, G5, G5Plus):',
    '  1. Kopier hele innholdet i ZIP-fila til rota på en tom USB-pinne (FAT32). Mappa Rx skal ligge øverst.',
    '  2. Sett pinnen i skjermen: Data Manager > Import Data > USB. Velg skifter, AB-linjer og gjødselkart.',
    '  3. Gjødselkart (Rx): velg kolonnen RATE_KGHA og enheten kg/ha. RATE_DAA er samme mengde i kg/daa.',
    `  Skiftegrenser og AB-linjer ligger i mappa SkogIQ (${n} skifter), gjødselkart i Rx (${resepter.length}).`,
    '', 'ISOBUS-terminaler (også John Deere med ISOBUS TC): bruk mappa TASKDATA (ISOXML, ISO 11783-10).',
    '', 'Trådløst: last opp ZIP-fila under Filer i John Deere Operations Center, eller koble SkogIQ til Operations Center under Skifteplan > Maskin.',
    '', 'Etter kjøring: eksporter utført gjødsling, sprøyting og avling som Shapefile fra Operations Center (eller ISOXML fra terminalen) og les dem inn i SkogIQ under Skifteplan > Maskin. Da fylles gjødseljournal, sprøytejournal og avling per skifte ut automatisk (KSL 1.1.3, 1.2.3 og 1.5.4).'].join('\r\n');
}

// ---------- import ----------
const finnFelt = (felter, ...mønstre) => { for (const m of mønstre) { const f = felter.find((x) => m.test(x)); if (f) return f; } return null; };
// Mengdeenheter i eksportfilene og omregning til per daa.
export const ENHETER = {
  'kg/ha': { f: 0.1, type: 'vekt', ut: 'kg/daa' }, 't/ha': { f: 100, type: 'vekt', ut: 'kg/daa' }, 'kg/daa': { f: 1, type: 'vekt', ut: 'kg/daa' },
  'l/ha': { f: 0.1, type: 'volum', ut: 'l/daa' }, 'l/daa': { f: 1, type: 'volum', ut: 'l/daa' }, 'm3/ha': { f: 0.1, type: 'volum', ut: 'm³/daa' },
  'lb/ac': { f: 0.112085, type: 'vekt', ut: 'kg/daa' }, 'gal/ac': { f: 0.935396, type: 'volum', ut: 'l/daa' }, 'bu/ac': { f: 6.7253, type: 'vekt', ut: 'kg/daa' },
};
const median = (l) => { const s = [...l].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
// Gjetter type og enhet ut fra kolonnenavn og verdier (Operations Center: metrisk eksport).
export function tolkObjekter(objekter, { kilde = 'Shapefile', fil = '' } = {}) {
  const felter = Object.keys(objekter.find((o) => o.egenskaper)?.egenskaper || {});
  const avling = finnFelt(felter, /^yld_mass_d/i, /yld.?mass.?dr/i, /^yld_mass/i, /dry.?yield|yield.?dry/i, /^yield$/i, /avling/i, /yld_vol_dr/i, /yld/i);
  const rate = finnFelt(felter, /^appliedrate$/i, /appl.*rate|rate.*appl|ar_.*rate/i, /^applied/i, /^rate_?app/i, /^rate$/i, /^ar_?rate/i, /utf.rt|mengde/i, /^target/i, /tgt.?rate|rate.?tgt|^rate/i);
  const produkt = finnFelt(felter, /^product$/i, /^product_?na/i, /^prod/i, /produkt|preparat/i, /variety|sort/i);
  const datoF = finnFelt(felter, /^isotime$/i, /^date$/i, /date|dato/i, /time/i);
  const fukt = finnFelt(felter, /^moisture$/i, /moist|fukt|vann/i);
  const verdiFelt = avling || rate; if (!verdiFelt) throw new Error(`Fant ingen kolonne med mengde eller avling (kolonner: ${felter.join(', ') || 'ingen'})`);
  const verdier = objekter.map((o) => Number(o.egenskaper?.[verdiFelt])).filter((v) => Number.isFinite(v) && v > 0);
  const med = median(verdier) ?? 0; const p = String(objekter.find((o) => o.egenskaper?.[produkt])?.egenskaper?.[produkt] || '');
  let type; let enhet;
  if (avling) { type = 'hosting'; enhet = /vol/i.test(verdiFelt) && med < 300 ? 'bu/ac' : med < 30 ? 't/ha' : 'kg/ha'; }
  else {
    const flytende = /(^|[^a-z])(l|liter)\b|herbic|fungic|insektic|roundup|glyfos|ugras|sopp|middel|ml/i.test(p);
    const gjodsel = /\d{1,2}-\d{1,2}-\d{1,2}|npk|gjødsel|gjodsel|fertil|urea|salpeter|kas\b|opti|yara|kalk|biorest|husdyr|blaut|manure|slurry/i.test(p);
    type = gjodsel ? 'gjodsling' : flytende ? 'sproyting' : med > 1500 ? 'husdyr' : 'gjodsling';
    enhet = type === 'sproyting' ? 'l/ha' : type === 'husdyr' ? 'kg/ha' : 'kg/ha';
  }
  const datoer = objekter.map((o) => tilDato(o.egenskaper?.[datoF])).filter(Boolean).sort();
  return { kilde, fil, type, enhet, felt: { verdi: verdiFelt, produkt, dato: datoF, fukt }, produkt: p, dato: datoer[0] || '', tilDato: datoer.at(-1) || '', antall: objekter.length, objekter };
}
export function tilDato(v) {
  if (v == null || v === '') return null; const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/); if (m) { const [a, b] = [Number(m[1]), Number(m[2])]; const usa = a <= 12 && b > 12; return `${m[3]}-${String(usa ? a : b).padStart(2, '0')}-${String(usa ? b : a).padStart(2, '0')}`; }
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}
// Leser valgte filer (ZIP, .shp/.dbf/.prj eller ISOXML) til én eller flere operasjoner.
export async function lesMaskinfiler(filer) {
  let alle = [];
  for (const f of filer) {
    const data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
    if (/\.zip$/i.test(f.navn) || (data[0] === 0x50 && data[1] === 0x4b)) alle.push(...(await lesZip(data)).map((x) => ({ ...x, zip: f.navn })));
    else alle.push({ navn: f.navn, data });
  }
  alle = alle.map((x) => ({ ...x, kort: x.navn.split('/').pop(), base: x.navn.replace(/\.[^./]+$/, '').toLowerCase() }));
  const ops = [];
  // ISOXML
  const task = alle.find((x) => /(^|\/)taskdata\.xml$/i.test(x.navn));
  if (task) ops.push(...lesIsoxmlLogger(alle, new TextDecoder().decode(task.data)));
  // Shapefiler
  for (const shp of alle.filter((x) => /\.shp$/i.test(x.navn))) {
    const finn = (ext) => alle.find((x) => x.base === shp.base && x.navn.toLowerCase().endsWith(ext))?.data || null;
    const prj = finn('.prj'); const obj = lesShapefile(shp.data, finn('.dbf'), prj ? new TextDecoder().decode(prj) : null);
    if (!obj.length) continue;
    try { ops.push(tolkObjekter(obj, { kilde: 'Shapefile', fil: shp.kort })); } catch (e) { ops.push({ feil: e.message, fil: shp.kort }); }
  }
  if (!ops.length) throw new Error('Fant ingen maskindata i filene. Bruk Shapefile (ZIP) fra Operations Center eller ISOXML (TASKDATA).');
  return ops;
}
function lesIsoxmlLogger(alle, xml) {
  const ops = []; const finnFil = (navn) => alle.find((x) => x.kort.toUpperCase() === navn.toUpperCase());
  const pdt = Object.fromEntries([...xml.matchAll(/<PDT\b[^>]*>/g)].map((m) => attr(m[0])).map((a) => [a.A, a.B]));
  const pfd = Object.fromEntries([...xml.matchAll(/<PFD\b[^>]*>/g)].map((m) => attr(m[0])).map((a) => [a.A, a.C]));
  for (const t of xml.matchAll(/<TSK\b([^>]*)>([\s\S]*?)<\/TSK>/g)) {
    const a = attr(`<TSK${t[1]}>`); const indre = t[2];
    const produkt = [...indre.matchAll(/<PDV\b[^>]*>/g)].map((m) => pdt[attr(m[0]).C]).find(Boolean) || [...indre.matchAll(/<PAN\b[^>]*>/g)].map((m) => pdt[attr(m[0]).A]).find(Boolean) || (Object.keys(pdt).length === 1 ? Object.values(pdt)[0] : '');
    const punkter = [];
    for (const tlg of indre.matchAll(/<TLG\b[^>]*>/g)) {
      const id = attr(tlg[0]).A; const x = finnFil(`${id}.XML`); const b = finnFil(`${id}.BIN`); if (!x || !b) continue;
      punkter.push(...lesTlg(new TextDecoder().decode(x.data), b.data));
    }
    if (!punkter.length) continue;
    const ddi = [7, 2, 6, 1].find((d) => punkter.some((p) => p.verdier[d] > 0)); if (!ddi) continue;
    const def = DDI[ddi];
    const objekter = punkter.filter((p) => p.lat != null && p.lon != null && (p.status == null || p.status > 0)).map((p) => ({ geometri: { type: 'Point', coordinates: [p.lon, p.lat] }, egenskaper: { verdi: p.verdier[ddi] * def.f, dato: p.tid.slice(0, 10) } }));
    const datoer = objekter.map((o) => o.egenskaper.dato).sort();
    const sproyt = def.type === 'volum' && !/\d{1,2}-\d{1,2}-\d{1,2}|gjødsel|gjodsel|fertil|blaut|husdyr/i.test(produkt);
    ops.push({ kilde: 'ISOXML', fil: `${a.B || a.A} (${pfd[a.E] || 'uten skifte'})`, type: def.type === 'vekt' ? 'gjodsling' : sproyt ? 'sproyting' : 'husdyr', enhet: def.enhet, felt: { verdi: 'verdi', dato: 'dato' }, produkt, dato: datoer[0] || '', tilDato: datoer.at(-1) || '', antall: objekter.length, objekter, ddi });
  }
  return ops;
}

// Fordeler en operasjon på skiftene: snitt (per daa) vektet med areal for flater, dekning og overlapp.
export function fordelPaaSkifter(op, plan, enhet = op.enhet) {
  const e = ENHETER[enhet] || { f: 1, ut: enhet }; const skifter = (plan?.skifter || []).filter((s) => s.geometri);
  const bokser = skifter.map((s) => ({ s, bb: bboxAv(s.geometri) }));
  const per = new Map();
  for (const o of op.objekter) {
    const v = Number(o.egenskaper?.[op.felt.verdi]); if (!Number.isFinite(v) || v <= 0) continue;
    let p; let areal = null;
    if (o.geometri.type === 'Point') p = o.geometri.coordinates;
    else if (/Polygon/.test(o.geometri.type)) { const r = ringerAv(o.geometri)[0][0]; p = [r.reduce((s, q) => s + q[0], 0) / r.length, r.reduce((s, q) => s + q[1], 0) / r.length]; areal = Math.abs(arealM2(o.geometri)); }
    else if (/LineString/.test(o.geometri.type)) { const l = o.geometri.type === 'LineString' ? o.geometri.coordinates : o.geometri.coordinates[0]; p = l[Math.floor(l.length / 2)]; }
    if (!p) continue;
    const treff = bokser.find(({ s, bb }) => p[0] >= bb[0] && p[0] <= bb[2] && p[1] >= bb[1] && p[1] <= bb[3] && iGeometri(p, s.geometri)); if (!treff) continue;
    const x = per.get(treff.s.id) || { sk: treff.s, sum: 0, vekt: 0, n: 0, areal: 0, min: Infinity, max: -Infinity, punkter: [] };
    const verdi = v * e.f; const w = areal ?? 1;
    x.sum += verdi * w; x.vekt += w; x.n++; x.areal += areal || 0; x.min = Math.min(x.min, verdi); x.max = Math.max(x.max, verdi);
    x.punkter.push([...geoTilUtm(p[0], p[1], 33), verdi]); per.set(treff.s.id, x);
  }
  return [...per.values()].map((x) => {
    const skAreal = (x.sk.areal || 0) * 1000;
    // Dekning: flater gir kjørt areal (over 100 % = overlapp). Punkter: andelen 20 m-ruter med data.
    const ruter = new Set(x.punkter.map(([ee, nn]) => `${Math.floor(ee / RUTE)}|${Math.floor(nn / RUTE)}`));
    const dekning = x.areal ? x.areal / skAreal : Math.min(1, (ruter.size * RUTE * RUTE) / Math.max(skAreal, 1));
    // Små mengder (sprøytemidler i l/daa) med tre desimaler, ellers én.
    const rund = (v) => (Math.abs(v) >= 10 ? r1(v) : Math.round(v * 1000) / 1000);
    return { skifteId: x.sk.id, nr: x.sk.nr, snitt: rund(x.sum / x.vekt), min: rund(x.min), max: rund(x.max), antall: x.n, dekning: Math.round(dekning * 100) / 100, overlapp: x.areal ? Math.max(0, Math.round((dekning - 1) * 100)) : null, enhet: e.ut, punkter: x.punkter };
  }).sort((a, b) => String(a.nr).localeCompare(String(b.nr), 'nb', { numeric: true }));
}
// Avlingskart i 20 m-ruter (UTM 33, øst/nord nederst til venstre) fra punktene i ett skifte.
export function lagAvlingskart(punkter, rute = RUTE) {
  const m = new Map(); for (const [e, n, v] of punkter) { const k = `${Math.floor(e / rute)}|${Math.floor(n / rute)}`; const x = m.get(k) || [0, 0]; x[0] += v; x[1]++; m.set(k, x); }
  const ruter = [...m].filter(([, [, n]]) => n >= 2 || punkter.length < 200).map(([k, [s, n]]) => { const [i, j] = k.split('|').map(Number); return [i * rute, j * rute, Math.round(s / n)]; });
  return { rute, ruter };
}
// Mineralgjødsel fra produktnavnet: kjent produkt, eller N-P-K lest fra navnet (f.eks. «YaraMila 22-3-10»).
export function produktFraNavn(navn) {
  const t = String(navn || '').toLowerCase();
  const kjent = Object.entries(MINERAL).find(([id, p]) => t.includes(p.navn.toLowerCase()) || (t.match(/(\d{1,2}(?:[,.]\d)?)-(\d{1,2})-(\d{1,2})/) && `${p.N}-${p.P}-${p.K}` === t.match(/(\d{1,2}(?:[,.]\d)?)-(\d{1,2})-(\d{1,2})/).slice(1).map((x) => Number(x.replace(',', '.'))).join('-')) || (id === 'kas' && /kalkammon|\bkas\b|27-0-0/.test(t)));
  if (kjent) return { produkt: kjent[0], innhold: null };
  const m = t.match(/(\d{1,2}(?:[,.]\d)?)-(\d{1,2}(?:[,.]\d)?)-(\d{1,2}(?:[,.]\d)?)/);
  return { produkt: 'annet', innhold: { navn: navn || 'Ukjent gjødsel', N: m ? Number(m[1].replace(',', '.')) : 0, P: m ? Number(m[2].replace(',', '.')) : 0, K: m ? Number(m[3].replace(',', '.')) : 0 } };
}
// Endringene en operasjon gir i skifteplanen (for forhåndsvisning). Gjenkjenner operasjoner som allerede er lest inn.
export function importId(op) { return `m${crc32(tekstTilBytes(`${op.fil}|${op.type}|${op.dato}|${op.tilDato}|${op.antall}|${op.produkt}`)).toString(36)}`; }
export function forslag(S, op, { enhet = op.enhet, type = op.type, aar = null } = {}) {
  const plan = S.skifteplan; const fordeling = fordelPaaSkifter(op, plan, enhet); const a = aar || Number(String(op.dato).slice(0, 4)) || plan?.aar;
  const id = importId(op); const alleredeInne = (plan?.maskindata || []).some((x) => x.id === id);
  const endringer = fordeling.map((f) => {
    const sk = plan.skifter.find((s) => s.id === f.skifteId);
    if (type === 'hosting') { const k = KULTURER[sk.vekster?.[a]?.kultur]; return { ...f, tekst: `Avling ${Math.round(f.snitt)} ${f.enhet}${k ? ` (${k.navn.toLowerCase()}, forventet ${sk.vekster[a].avling || k.normavling} ${k.enhet}/daa)` : ''} og avlingskart` }; }
    if (type === 'sproyting') return { ...f, tekst: `Sprøyting ${op.produkt || ''} ${r1(f.snitt * (f.enhet === 'l/daa' ? 1000 : 1))} ${f.enhet === 'l/daa' ? 'ml/daa' : f.enhet} – fyll ut skadegjører og karens` };
    const pr = produktFraNavn(op.produkt);
    const planlagt = (sk.gjodsling || []).find((g) => Number(g.aar) === a && g.status !== 'utfort' && (g.produkt === pr.produkt || type === 'husdyr' && g.type === 'husdyr'));
    return { ...f, planlagt: planlagt?.id || null, plan: planlagt ? Number(planlagt.mengde) : null, tekst: planlagt ? `Planlagt ${planlagt.mengde} → utført ${f.snitt} ${f.enhet} (merkes utført)` : `Ny utført gjødsling ${f.snitt} ${f.enhet}` };
  });
  return { id, alleredeInne, aar: a, type, enhet, endringer, utenfor: op.antall - fordeling.reduce((s, f) => s + f.antall, 0) };
}
// Legger operasjonen inn i skifteplanen. Gir antall endrede skifter.
export function brukImport(S, op, { enhet = op.enhet, type = op.type, aar = null, nyId = (p) => `${p}${Math.random().toString(36).slice(2, 9)}`, utforer = '' } = {}) {
  const plan = S.skifteplan; const f = forslag(S, op, { enhet, type, aar }); if (f.alleredeInne || !f.endringer.length) return { antall: 0, ...f };
  const a = f.aar; const dato = op.dato || `${a}-01-01`; const pr = produktFraNavn(op.produkt);
  if (type === 'sproyting') {
    const x = { id: nyId('sp'), dato, skifter: f.endringer.map((e) => e.skifteId), preparat: op.produkt || '', dose: String(r1(f.endringer.reduce((s, e) => s + e.snitt, 0) / f.endringer.length * (f.endringer[0].enhet === 'l/daa' ? 1000 : 1))), enhet: f.endringer[0].enhet === 'l/daa' ? 'ml/daa' : f.endringer[0].enhet, skadegjorer: '', begrunnelse: '', effekt: '', karens: '', utforer, vaer: '', vekststadium: '', kilde: 'maskin', maskinId: f.id };
    plan.sproyting = [...(plan.sproyting || []), x];
  }
  for (const e of f.endringer) {
    const sk = plan.skifter.find((s) => s.id === e.skifteId);
    if (type === 'hosting') {
      sk.vekster = sk.vekster || {}; sk.vekster[a] = { ...(sk.vekster[a] || {}), avlingRegistrert: Math.round(e.snitt), avlingKilde: 'maskin' };
      sk.avlingskart = { ...(sk.avlingskart || {}), [a]: { ...lagAvlingskart(e.punkter), enhet: e.enhet, kilde: op.kilde, dato } };
    } else if (type === 'gjodsling' || type === 'husdyr') {
      const husdyr = type === 'husdyr'; const mengde = husdyr && e.enhet === 'kg/daa' ? r1(e.snitt / 1000) : r1(e.snitt); // husdyrgjødsel i tonn (≈ m³) per daa
      const g = e.planlagt && sk.gjodsling.find((x) => x.id === e.planlagt);
      if (g) Object.assign(g, { status: 'utfort', mengde, dato, utfortDato: dato, kilde: 'maskin', maskinId: f.id, planlagtMengde: g.mengde });
      else sk.gjodsling.push({ id: nyId('g'), aar: a, type: husdyr ? 'husdyr' : 'mineral', produkt: husdyr ? 'storfe' : pr.produkt, ...(husdyr || !pr.innhold ? {} : { innhold: pr.innhold }), mengde, enhet: husdyr ? 't/daa' : 'kg/daa', dato, status: 'utfort', kilde: 'maskin', maskinId: f.id, ...(husdyr ? { spredemaate: 'nedmoldet' } : {}) });
    }
  }
  plan.maskindata = [...(plan.maskindata || []), { id: f.id, fil: op.fil, kilde: op.kilde, type, produkt: op.produkt, dato, tilDato: op.tilDato, enhet: f.endringer[0]?.enhet, importert: new Date().toISOString().slice(0, 10), skifter: f.endringer.map((e) => ({ id: e.skifteId, snitt: e.snitt, dekning: e.dekning, overlapp: e.overlapp, plan: e.plan ?? null })) }];
  if (Number(plan.aar) !== a && !plan.aar) plan.aar = a;
  return { antall: f.endringer.length, ...f };
}

// ---------- økonomi ----------
export const STANDARD_PRISER = { gjodsel: 7.5, korn: 4.0, sproytemiddel: 300 }; // kr/kg, kr/kg, kr/l – anslag, kan endres
// Gevinsten av maskindataene i året: avvik fra plan, overlapp (seksjonskontroll), variabel gjødsling og avling.
export function presisjonsOkonomi(S, aar, priser = STANDARD_PRISER) {
  const plan = S.skifteplan; const ut = { aar, avvik: [], overlapp: [], vra: [], avling: [], journal: 0 };
  if (!plan) return ut;
  const sk = (id) => plan.skifter.find((s) => s.id === id);
  for (const m of (plan.maskindata || []).filter((x) => Number(String(x.dato).slice(0, 4)) === aar)) {
    ut.journal += m.skifter.length;
    for (const x of m.skifter) {
      const s = sk(x.id); if (!s) continue; const areal = s.areal || 0;
      if (m.type === 'husdyr') continue; // husdyrgjødsel har ingen innkjøpspris
      const pris = m.type === 'sproyting' ? priser.sproytemiddel : priser.gjodsel; // kr per kg (gjødsel) eller per l (sprøytemiddel)
      if (x.plan != null && m.type !== 'hosting') { const d = x.snitt - x.plan; ut.avvik.push({ nr: s.nr, produkt: m.produkt, plan: x.plan, utfort: x.snitt, kg: r1(d * areal), kr: Math.round(d * areal * pris) }); }
      if (x.overlapp != null && x.overlapp > 0 && m.type !== 'hosting') ut.overlapp.push({ nr: s.nr, produkt: m.produkt, pst: x.overlapp, kr: Math.round((x.overlapp / 100) * x.snitt * areal * pris) });
    }
  }
  for (const s of plan.skifter) {
    const v = s.vekster?.[aar]; const k = KULTURER[v?.kultur];
    if (v?.avlingRegistrert && k?.enhet === 'kg') { const forv = Number(v.avling) || k.normavling; ut.avling.push({ nr: s.nr, kultur: k.navn, forventet: forv, registrert: v.avlingRegistrert, kr: Math.round((v.avlingRegistrert - forv) * (s.areal || 0) * priser.korn) }); }
    for (const g of (s.gjodsling || []).filter((x) => Number(x.aar) === aar && x.status !== 'utfort' && x.type === 'mineral')) {
      const r = resept(s, aar, g); if (!r.variabel) continue;
      const flytt = r.soner.reduce((sum, z) => sum + Math.abs(z.mengde - r.planlagt) * z.andel * (s.areal || 0), 0) / 2;
      ut.vra.push({ nr: s.nr, produkt: r.produkt, soner: r.soner.length, flatKg: Math.round(r.flatTotalt), vraKg: Math.round(r.totalt), flyttetKg: Math.round(flytt), sparteKr: Math.round((r.flatTotalt - r.totalt) * priser.gjodsel) });
    }
  }
  const sum = (l, k) => l.reduce((s, x) => s + (x[k] || 0), 0);
  ut.sum = { avvikKr: sum(ut.avvik, 'kr'), overlappKr: sum(ut.overlapp, 'kr'), vraSpartKr: sum(ut.vra, 'sparteKr'), vraFlyttetKg: sum(ut.vra, 'flyttetKg'), avlingKr: sum(ut.avling, 'kr') };
  return ut;
}
