// Skadevarsel for skog de neste 5 døgnene, for alle kommuner med skog (server).
//   1. Skogprofil per kommune (én gang, fornyes hver 30. dag): SR16-rasterkartene fra NIBIO (treslag, middelhøyde og
//      volum) hentes som bilder over kommunen (ca. 100–250 m per piksel) og avgrenses med kommunegrensa fra Kartverket.
//      Resultatet er areal per kombinasjon av treslag × høydeklasse × volumklasse, og hvor mye av hver som har åpen
//      kant (ikke skog) i hver av 8 vindretninger.
//   2. Vær hver 3. time: værprognosen (met.no Locationforecast) og skogbrannindeksen (met.no FWI) i et punkt per kommune.
//   3. Varsel: storm og snøbrekk regnes med de samme modellene som simuleringen (js/skadesim.js) for hver dag og
//      kombinasjon; brannfaren vises som nivå. Kommunene sorteres etter anslått tap.
// Bruker ingen personopplysninger. Svarene lagres i én fil på volumet.
import fs from 'node:fs';
import zlib from 'node:zlib';
import * as SIM from './js/skadesim.js';
import { rotnettoPerM3, STANDARD_INNSTILLINGER } from './js/model.js';
import { hentBrannfare, hentVaer } from './js/skade-data.js';

const KV = 'https://api.kartverket.no/kommuneinfo/v1';
const SR16 = 'https://wms.nibio.no/cgi-bin/sr16';
export const PROFIL_ALDER_DAGER = 30;
export const VAER_TIMER = 3;
export const MIN_SKOG_DAA = 2000; // kommuner med mindre produktiv skog tas ikke med

// ---------------------------------------------------------------- PNG (8 bit, RGB/RGBA/palett, ikke interlaced)
export function dekodPng(buf) {
  const b = Buffer.from(buf); if (b.readUInt32BE(0) !== 0x89504e47) throw new Error('Ikke PNG');
  let o = 8; let w = 0; let h = 0; let bit = 0; let type = 0; const idat = []; let pal = null; let trns = null;
  while (o < b.length) {
    const n = b.readUInt32BE(o); const t = b.toString('ascii', o + 4, o + 8); const d = b.subarray(o + 8, o + 8 + n);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bit = d[8]; type = d[9]; if (d[12]) throw new Error('Interlaced PNG støttes ikke'); }
    else if (t === 'PLTE') pal = d; else if (t === 'tRNS') trns = d; else if (t === 'IDAT') idat.push(d); else if (t === 'IEND') break;
    o += 12 + n;
  }
  if (bit !== 8) throw new Error(`PNG med ${bit} bit støttes ikke`);
  const kan = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type]; const rad = w * kan; const raa = zlib.inflateSync(Buffer.concat(idat));
  const ut = new Uint8Array(w * h * 4); let forrige = new Uint8Array(rad); const cur = new Uint8Array(rad);
  for (let y = 0; y < h; y++) {
    const f = raa[y * (rad + 1)]; const s = y * (rad + 1) + 1;
    for (let i = 0; i < rad; i++) {
      const x = raa[s + i]; const a = i >= kan ? cur[i - kan] : 0; const up = forrige[i]; const c = i >= kan ? forrige[i - kan] : 0;
      let v = x; if (f === 1) v = x + a; else if (f === 2) v = x + up; else if (f === 3) v = x + ((a + up) >> 1); else if (f === 4) { const p = a + up - c; const pa = Math.abs(p - a); const pb = Math.abs(p - up); const pc = Math.abs(p - c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? up : c); }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) {
      const q = (y * w + x) * 4;
      if (type === 2) { ut[q] = cur[x * 3]; ut[q + 1] = cur[x * 3 + 1]; ut[q + 2] = cur[x * 3 + 2]; ut[q + 3] = 255; }
      else if (type === 6) { ut[q] = cur[x * 4]; ut[q + 1] = cur[x * 4 + 1]; ut[q + 2] = cur[x * 4 + 2]; ut[q + 3] = cur[x * 4 + 3]; }
      else if (type === 3) { const i = cur[x]; ut[q] = pal[i * 3]; ut[q + 1] = pal[i * 3 + 1]; ut[q + 2] = pal[i * 3 + 2]; ut[q + 3] = trns && i < trns.length ? trns[i] : 255; }
      else if (type === 0) { ut[q] = ut[q + 1] = ut[q + 2] = cur[x]; ut[q + 3] = 255; }
      else { ut[q] = ut[q + 1] = ut[q + 2] = cur[x * 2]; ut[q + 3] = cur[x * 2 + 1]; }
    }
    forrige = Uint8Array.from(cur);
  }
  return { w, h, data: ut };
}

// ---------------------------------------------------------------- SR16-farger (tegnforklaringene i NIBIOs WMS)
const TRESLAG_F = [[82, 176, 56, 'G'], [205, 170, 101, 'F'], [255, 220, 130, 'L']];
export const HOYDE_KL = [1, 3, 5, 7, 9, 11, 13, 15, 16.5, 19]; // meter, midt i klassen
const HOYDE_F = [[247, 252, 245], [229, 245, 224], [199, 233, 192], [161, 217, 155], [116, 196, 118], [65, 171, 93], [35, 139, 69], [0, 109, 44], [0, 68, 27], [0, 40, 15]];
export const VOLUM_KL = [5, 15, 25, 35, 45]; // m³/daa, midt i klassen (0–100 … >400 m³/ha)
const VOLUM_F = [[204, 236, 230], [153, 216, 201], [102, 194, 164], [44, 162, 95], [0, 109, 44]];
const naer = (r, g, b, liste) => { let best = -1; let bd = 1200; liste.forEach((f, i) => { const d = (r - f[0]) ** 2 + (g - f[1]) ** 2 + (b - f[2]) ** 2; if (d < bd) { bd = d; best = i; } }); return best; };
export const kombiNokkel = (t, h, v) => t * 50 + h * 5 + v;
export const fraNokkel = (k) => ({ t: ['G', 'F', 'L'][Math.floor(k / 50)], h: Math.floor((k % 50) / 5), v: k % 5 });
const RETNINGER = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]]; // N, NØ, Ø, SØ, S, SV, V, NV (x øst, y nord)

// Skogprofil fra tre bilder (samme utsnitt) og en maske for kommunen. Gir { pikselDaa, skogDaa, kombi: { nøkkel: [n, kant0..kant7] } }.
export function lagProfil({ w, h, treslag, hoyde, volum, iKommune, pikselM }) {
  const skog = new Int16Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x; const q = p * 4; if (!iKommune(x, y)) continue;
    const t = naer(treslag[q], treslag[q + 1], treslag[q + 2], TRESLAG_F); if (t < 0) continue;
    const hk = naer(hoyde[q], hoyde[q + 1], hoyde[q + 2], HOYDE_F); const vk = naer(volum[q], volum[q + 1], volum[q + 2], VOLUM_F);
    skog[p] = kombiNokkel(t, hk < 0 ? 5 : hk, vk < 0 ? 1 : vk);
  }
  const kombi = {}; let n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = skog[y * w + x]; if (k < 0) continue; n++;
    const r = (kombi[k] ||= new Array(9).fill(0)); r[0]++;
    // Åpen kant mot retning d: nabopikselen i retningen (bildet har nord øverst) er ikke skog med trær over 5 m.
    RETNINGER.forEach(([dx, dy], d) => { const xx = x + dx; const yy = y - dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) return; const nk = skog[yy * w + xx]; if (nk < 0 || HOYDE_KL[fraNokkel(nk).h] < 5) r[d + 1]++; });
  }
  const pikselDaa = (pikselM * pikselM) / 1000;
  return { pikselDaa, skogDaa: Math.round(n * pikselDaa), kombi };
}

// Maske for kommunen på bilderutenettet (rad 0 = nord). Skannlinjer i stedet for punkt-i-polygon per piksel, som er
// alt for tregt for kommuner med lange kystlinjer (titusenvis av punkter).
export function kommuneMaske(g, { x0, y1, w, h, pikselM }) {
  const m = new Uint8Array(w * h); const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  const kanter = []; for (const p of polys) for (const r of p) for (let a = 0, b = r.length - 1; a < r.length; b = a++) kanter.push([r[b][0], r[b][1], r[a][0], r[a][1]]);
  for (let y = 0; y < h; y++) {
    const yy = y1 - (y + 0.5) * pikselM; const xs = [];
    for (const [xa, ya, xb, yb] of kanter) if ((ya > yy) !== (yb > yy)) xs.push(xa + ((yy - ya) * (xb - xa)) / (yb - ya));
    xs.sort((a, b) => a - b);
    for (let t = 0; t + 1 < xs.length; t += 2) { const i0 = Math.max(0, Math.ceil((xs[t] - x0) / pikselM - 0.5)); const i1 = Math.min(w - 1, Math.floor((xs[t + 1] - x0) / pikselM - 0.5)); for (let i = i0; i <= i1; i++) m[y * w + i] = 1; }
  }
  return m;
}

// ---------------------------------------------------------------- varsel for én kommune
const alderFraHoyde = (h, h40 = 14) => Math.round(40 * Math.min(3, (h / (0.85 * h40)) ** (1 / 0.75)));
function kombiInfo(k, iAar) {
  const { t, h, v } = fraNokkel(Number(k)); const hm = HOYDE_KL[h];
  return { b: { id: k, treslag: t, bonitet: 14, merknad: '', tiltak: [] }, st: { alder: alderFraHoyde(hm), h40: 14, volumDaa: VOLUM_KL[v] }, h: hm, anslag: true, tynnet: null, tetthet: null, iAar };
}
// Daglige værverdier → varsel. dager: [{ dato, kast, vind, retning, sno, tempMin, tempMaks }]; fwi: [{ dato, fwi }]
export function varselForKommune(profil, dager, fwi = [], { iAar = new Date().getFullYear(), inn = STANDARD_INNSTILLINGER } = {}) {
  const pris = { G: rotnettoPerM3('G', inn), F: rotnettoPerM3('F', inn), L: rotnettoPerM3('L', inn) };
  const kombi = Object.entries(profil.kombi).map(([k, r]) => ({ x: kombiInfo(k, iAar), r }));
  const perDag = dager.slice(0, 5).map((d, i) => {
    const retn = Math.round(((d.retning ?? 240) % 360) / 45) % 8; const kast = d.kast ?? (d.vind ?? 0) * 1.5;
    // snø de siste to døgnene (snølasten bygger seg opp)
    const sno = (d.sno || 0) + (i > 0 ? dager[i - 1].sno || 0 : 0); const temp = ((d.tempMin ?? 0) + (d.tempMaks ?? 0)) / 2;
    const ps = { ...SIM.standard('storm'), kast, retning: d.retning ?? 240 };
    const pn = { ...SIM.standard('sno'), nysno: sno, temp, snotype: temp > -2 ? 'vat' : temp > -6 ? 'middels' : 'torr', vind: d.vind ?? 0 };
    let sKr = 0; let sM3 = 0; let sDaa = 0; let nKr = 0; let nM3 = 0; let nDaa = 0;
    for (const { x, r } of kombi) {
      const daa = r[0] * profil.pikselDaa; const kant = r[retn + 1] * profil.pikselDaa; const v = x.st.volumDaa; const p = pris[x.b.treslag] ?? pris.G;
      // Under 10 % sannsynlighet regnes som ingen skade – ellers gir halen av kurven støy over store arealer.
      const a5 = (v2) => (v2.p < 0.1 ? 0 : v2.andel);
      if (kast >= 14) { const aK = a5(SIM.stormVurdering(x, ps, true)); const aU = a5(SIM.stormVurdering(x, ps, false)); const skadet = kant * aK + (daa - kant) * aU; sDaa += skadet; sM3 += skadet * v; sKr += skadet * v * p * SIM.TYPER.storm.tapFaktor; }
      if (sno >= 10) { const a = a5(SIM.snoVurdering(x, pn)); nDaa += daa * a; nM3 += daa * a * v; nKr += daa * a * v * p * SIM.TYPER.sno.tapFaktor; }
    }
    const f = fwi.find((y) => y.dato === d.dato);
    return { dato: d.dato, kast: Math.round(kast), retning: d.retning != null ? Math.round(d.retning) : null, sno: Math.round(sno), temp: Math.round(temp * 10) / 10, fwi: f?.fwi != null ? Math.round(f.fwi * 10) / 10 : null,
      storm: { kr: Math.round(sKr), m3: Math.round(sM3), daa: Math.round(sDaa) }, snoSkade: { kr: Math.round(nKr), m3: Math.round(nM3), daa: Math.round(nDaa) } };
  });
  const maks = (sel) => perDag.reduce((a, d) => (sel(d) > sel(a) ? d : a), perDag[0] || {});
  const ds = maks((d) => d.storm.kr); const dn = maks((d) => d.snoSkade.kr); const df = maks((d) => d.fwi ?? -1);
  const brannNiv = SIM.TYPER && df?.fwi != null ? (df.fwi >= 38 ? 'morkerod' : df.fwi >= 21.3 ? 'rod' : df.fwi >= 11.2 ? 'oransje' : df.fwi >= 5.2 ? 'gul' : 'gronn') : null;
  const furu = Object.entries(profil.kombi).filter(([k]) => fraNokkel(Number(k)).t === 'F').reduce((s, [, r]) => s + r[0], 0) * profil.pikselDaa;
  const kr = (ds?.storm?.kr || 0) + (dn?.snoSkade?.kr || 0);
  return {
    kr, storm: ds?.storm?.kr ? { ...ds.storm, dato: ds.dato, kast: ds.kast, retning: ds.retning } : { kr: 0, m3: 0, daa: 0, dato: maks((d) => d.kast).dato, kast: maks((d) => d.kast).kast, retning: maks((d) => d.kast).retning },
    sno: dn?.snoSkade?.kr ? { ...dn.snoSkade, dato: dn.dato, cm: dn.sno, temp: dn.temp } : { kr: 0, m3: 0, daa: 0, dato: maks((d) => d.sno).dato, cm: maks((d) => d.sno).sno, temp: maks((d) => d.sno).temp },
    brann: df?.fwi != null ? { fwi: df.fwi, nivaa: brannNiv, dato: df.dato, furuDaa: Math.round(furu) } : null,
    perDag: perDag.map((d) => ({ dato: d.dato, kr: d.storm.kr + d.snoSkade.kr, kast: d.kast, sno: d.sno, fwi: d.fwi })),
  };
}

// ---------------------------------------------------------------- tjenesten
export function lagSkadevarsel({ fil = null, hent = fetch, logg = (...a) => console.log(...a), ua = 'SkogIQ.ai (+https://skogiq-production.up.railway.app)', parallelle = 3, start = true } = {}) {
  let tilstand = { profiler: {}, varsel: null, kommuner: null };
  try { if (fil && fs.existsSync(fil)) tilstand = { ...tilstand, ...JSON.parse(fs.readFileSync(fil, 'utf8')) }; } catch (e) { logg('Skadevarsel: kunne ikke lese lagret fil', e.message); }
  const lagre = () => { if (!fil) return; try { fs.writeFileSync(`${fil}.tmp`, JSON.stringify(tilstand)); fs.renameSync(`${fil}.tmp`, fil); } catch (e) { logg('Skadevarsel: kunne ikke lagre', e.message); } };
  const hentMedUa = (url, opt = {}) => hent(url, { ...opt, headers: { 'User-Agent': ua, ...(opt.headers || {}) } });
  const json = async (url) => { const r = await hentMedUa(url); if (!r.ok) throw new Error(`${new URL(url).host} svarte ${r.status}`); return r.json(); };
  let jobb = null; let status = { fase: 'venter', ferdig: 0, totalt: 0 };
  const iParallell = async (liste, fn) => { let i = 0; await Promise.all(Array.from({ length: parallelle }, async () => { while (i < liste.length) { const x = liste[i++]; try { await fn(x); } catch (e) { logg(`Skadevarsel: ${x.navn || x.nr}: ${e.message}`); } status.ferdig++; } })); };

  async function kommuner() {
    if (tilstand.kommuner && Date.now() - tilstand.kommuner.hentet < PROFIL_ALDER_DAGER * 864e5) return tilstand.kommuner.liste;
    const liste = (await json(`${KV}/kommuner`)).map((k) => ({ nr: k.kommunenummer, navn: k.kommunenavnNorsk || k.kommunenavn }));
    tilstand.kommuner = { hentet: Date.now(), liste }; return liste;
  }
  async function profil(k) {
    const info = await json(`${KV}/kommuner/${k.nr}`); const omr = await json(`${KV}/kommuner/${k.nr}/omrade?utkoordsys=25833`);
    const g = omr.omrade; let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    const gaa = (c) => { if (typeof c[0] === 'number') { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); } else c.forEach(gaa); }; gaa(g.coordinates);
    const pikselM = Math.max(100, Math.ceil(Math.max(x1 - x0, y1 - y0) / 1000 / 25) * 25); // høyst ca. 1000 piksler og minst 100 m per piksel
    const w = Math.max(1, Math.ceil((x1 - x0) / pikselM)); const h = Math.max(1, Math.ceil((y1 - y0) / pikselM));
    const bb = [x0, y1 - h * pikselM, x0 + w * pikselM, y1].map((v) => v.toFixed(1)).join(',');
    const bilde = async (lag) => { const r = await hentMedUa(`${SR16}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${lag}&STYLES=&SRS=EPSG:25833&BBOX=${bb}&WIDTH=${w}&HEIGHT=${h}&FORMAT=image/png`); if (!r.ok) throw new Error(`NIBIO svarte ${r.status}`); const p = dekodPng(Buffer.from(await r.arrayBuffer())); if (p.w !== w || p.h !== h) throw new Error('Uventet bildestørrelse'); return p.data; };
    const [treslag, hoyde, volum] = [await bilde('SRRTRESLAG'), await bilde('SRRHOYDEM'), await bilde('SRRVOLUB')];
    const maske = kommuneMaske(g, { x0, y1, w, h, pikselM });
    const p = lagProfil({ w, h, treslag, hoyde, volum, pikselM, iKommune: (x, y) => maske[y * w + x] === 1 });
    const pos = info.punktIOmrade?.coordinates || [(info.avgrensningsboks?.coordinates?.[0]?.[0]?.[0] + info.avgrensningsboks?.coordinates?.[0]?.[2]?.[0]) / 2, (info.avgrensningsboks?.coordinates?.[0]?.[0]?.[1] + info.avgrensningsboks?.coordinates?.[0]?.[2]?.[1]) / 2];
    tilstand.profiler[k.nr] = { nr: k.nr, navn: k.navn, fylke: info.fylkesnavn || '', pos, pikselM, hentet: Date.now(), ...p };
  }
  async function byggProfiler() {
    const liste = (await kommuner()).filter((k) => !tilstand.profiler[k.nr] || Date.now() - tilstand.profiler[k.nr].hentet > PROFIL_ALDER_DAGER * 864e5);
    if (!liste.length) return; status = { fase: 'skogprofiler', ferdig: 0, totalt: liste.length };
    logg(`Skadevarsel: henter skogprofil for ${liste.length} kommuner fra SR16 …`);
    let n = 0; await iParallell(liste, async (k) => { await profil(k); if (++n % 20 === 0) lagre(); }); lagre();
  }
  async function oppdaterVaer() {
    const prof = Object.values(tilstand.profiler).filter((p) => p.skogDaa >= MIN_SKOG_DAA);
    status = { fase: 'vær', ferdig: 0, totalt: prof.length }; const ut = []; const iAar = new Date().getFullYear();
    await iParallell(prof, async (p) => {
      const [lon, lat] = p.pos; const v = await hentVaer(lon, lat, { hent: hentMedUa });
      let fwi = []; try { fwi = (await hentBrannfare(lon, lat, { hent: hentMedUa })).dager; } catch { /* FWI er ikke alltid tilgjengelig (utenfor sesong) */ }
      ut.push({ nr: p.nr, navn: p.navn, fylke: p.fylke, pos: p.pos, skogDaa: p.skogDaa, ...varselForKommune(p, v.dager, fwi, { iAar }) });
    });
    ut.sort((a, b) => b.kr - a.kr || (b.brann?.fwi ?? 0) - (a.brann?.fwi ?? 0));
    const dager = [...new Set(ut.flatMap((k) => k.perDag.map((d) => d.dato)))].sort().slice(0, 5);
    tilstand.varsel = { oppdatert: new Date().toISOString(), dager, kommuner: ut, kilde: 'Meteorologisk institutt (Locationforecast og FWI), NIBIO SR16, Kartverket' };
    lagre(); logg(`Skadevarsel: oppdatert for ${ut.length} kommuner.`);
  }
  async function kjor() {
    if (jobb) return jobb;
    jobb = (async () => { try { await byggProfiler(); await oppdaterVaer(); status = { fase: 'klar', ferdig: 0, totalt: 0 }; } catch (e) { logg('Skadevarsel feilet:', e.message); status = { fase: 'feil', feil: e.message }; } finally { jobb = null; } })();
    return jobb;
  }
  let timer = null;
  if (start) { setTimeout(() => kjor(), 15000); timer = setInterval(() => kjor(), VAER_TIMER * 3600e3); timer.unref?.(); }
  return {
    hent: () => (tilstand.varsel ? { ...tilstand.varsel, status } : { status, kommuner: [] }),
    kjor, status: () => status, stopp: () => clearInterval(timer),
    _tilstand: () => tilstand,
  };
}

export function skadevarselApi(sv, req, res, sti, ekstraHoder = {}, cors = () => ({})) {
  if (sti !== '/api/skadevarsel') return false;
  const svar = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, max-age=300', ...cors(req), ...ekstraHoder }); res.end(JSON.stringify(obj)); };
  if (req.method !== 'GET') { svar(405, { feil: 'Bare GET' }); return true; }
  if (!sv) { svar(503, { feil: 'Skadevarselet er ikke satt opp på serveren' }); return true; }
  svar(200, sv.hent()); return true;
}
