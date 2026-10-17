// Sporlogg for utførte tiltak: GPS-sporet fra en tur i skogen gjøres om til en dekningsflate (sporet med arbeidsbredde),
// som fordeles på bestandene. Hvert bestand får forslag om å markere et planlagt tiltak som utført, slå sammen med et
// utført tiltak av samme type samme år (flatene slås sammen, så overlapp ikke telles to ganger), eller et nytt tiltak.
// Ingen DOM. Polygonoperasjonene bruker polygon-clipping (sendes inn som PC), i UTM 33 (meter).
import { geoTilUtm, utmTilGeo, arealM2 } from './proj.js';

// Arbeidsbredde (m) per tiltakstype: hvor bredt belte rundt sporet som regnes som behandlet.
export const SPOR_TILTAK = {
  ungskogpleie: { bredde: 8, tekst: 'Ryddesag: ca. 4 m til hver side når du går i striper' },
  planting: { bredde: 5, tekst: 'Plantestriper på ca. 2,5 m til hver side' },
  suppleringsplanting: { bredde: 6, tekst: 'Supplering langs sporet' },
  markberedning: { bredde: 4, tekst: 'Markbereder: ca. 2 aggregater á 2 m' },
  tynning: { bredde: 20, tekst: 'Hogstmaskin: kranrekkevidde ca. 10 m til hver side' },
  sluttavvirkning: { bredde: 20, tekst: 'Hogstmaskin: kranrekkevidde ca. 10 m til hver side' },
  lukkethogst: { bredde: 20, tekst: 'Hogstmaskin: kranrekkevidde ca. 10 m til hver side' },
  stammekvisting: { bredde: 6, tekst: 'Stammekvisting langs sporet' },
  gjodsling: { bredde: 15, tekst: 'Spredning til begge sider' },
  groftrensk: { bredde: 4, tekst: 'Grøft med kantsone' },
  miljo: { bredde: 6, tekst: 'Miljøtiltak langs sporet' },
  annet: { bredde: 6, tekst: 'Fritt valgt bredde' },
};
export const MIN_DAA = 0.1;          // mindre dekning i et bestand regnes som gjennomgang, ikke tiltak
export const HELT_ANDEL = 0.7;       // over denne andelen foreslås hele bestandet

const tilUtm = ([lon, lat]) => geoTilUtm(lon, lat, 33);
const tilGeo = ([x, y]) => utmTilGeo(x, y, 33);
const avstand = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Fjerner unøyaktige punkter, GPS-støy når du står stille og hopp som er urealistisk raske (over 4 m/s til fots).
// punkter: [{ lat, lon, noyaktighet, tid }]
export function rensSpor(punkter, { maksNoyaktighet = 25, minAvstand = 2, maksFart = 4, tillatFart = null } = {}) {
  const ut = []; let forrige = null;
  const grense = tillatFart ?? maksFart;
  for (const p of punkter) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    if (p.noyaktighet != null && p.noyaktighet > maksNoyaktighet) continue;
    const u = tilUtm([p.lon, p.lat]);
    if (forrige) {
      const d = avstand(u, forrige.u);
      if (d < minAvstand) continue;
      const dt = (p.tid && forrige.p.tid) ? (p.tid - forrige.p.tid) / 1000 : null;
      if (dt && dt > 0 && d / dt > grense && d > 30) continue;
    }
    ut.push(p); forrige = { p, u };
  }
  return ut;
}

// Douglas–Peucker på UTM-punkter.
export function forenkle(pts, tol = 1) {
  if (pts.length < 3) return pts.slice();
  const behold = new Uint8Array(pts.length); behold[0] = 1; behold[pts.length - 1] = 1;
  const stabel = [[0, pts.length - 1]];
  while (stabel.length) {
    const [a, b] = stabel.pop(); let maks = 0; let idx = -1;
    const [x1, y1] = pts[a]; const [x2, y2] = pts[b]; const L = Math.hypot(x2 - x1, y2 - y1) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs((x2 - x1) * (y1 - pts[i][1]) - (x1 - pts[i][0]) * (y2 - y1)) / L; if (d > maks) { maks = d; idx = i; } }
    if (maks > tol && idx > 0) { behold[idx] = 1; stabel.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => behold[i]);
}

export const sporLengde = (punkter) => { let s = 0; for (let i = 1; i < punkter.length; i++) s += avstand(tilUtm([punkter[i - 1].lon, punkter[i - 1].lat]), tilUtm([punkter[i].lon, punkter[i].lat])); return s; };

// Belte rundt sporet: rektangel per segment + åttekant i hvert knekkpunkt, slått sammen i grupper.
function sirkel([x, y], r, n = 8) { const ring = []; for (let i = 0; i < n; i++) { const v = (i / n) * 2 * Math.PI; ring.push([x + r * Math.cos(v), y + r * Math.sin(v)]); } ring.push(ring[0]); return [ring]; }
function rektangel(a, b, r) {
  const dx = b[0] - a[0]; const dy = b[1] - a[1]; const L = Math.hypot(dx, dy) || 1e-9; const nx = (-dy / L) * r; const ny = (dx / L) * r;
  return [[[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny], [a[0] + nx, a[1] + ny]]];
}
function samleUnion(PC, deler, gruppe = 150) {
  let lag = deler;
  while (lag.length > 1) {
    const neste = [];
    for (let i = 0; i < lag.length; i += gruppe) { const g = lag.slice(i, i + gruppe); neste.push(g.length === 1 ? g[0] : PC.union(...g)); }
    lag = neste;
  }
  return lag[0] || [];
}
// Dekningsflaten i UTM (MultiPolygon-koordinater) for ett eller flere spor (lister av {lat, lon}).
export function dekningUtm(spor, breddeM, PC) {
  const r = breddeM / 2; const deler = [];
  for (const punkter of spor) {
    const pts = forenkle(punkter.map((p) => tilUtm([p.lon, p.lat])), Math.min(1.5, r / 4));
    if (!pts.length) continue;
    for (let i = 0; i < pts.length; i++) { deler.push(sirkel(pts[i], r)); if (i) deler.push(rektangel(pts[i - 1], pts[i], r)); }
  }
  return deler.length ? samleUnion(PC, deler) : [];
}
const mpTilUtm = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).map((p) => p.map((ring) => ring.map(tilUtm)));
const mpTilGeo = (mp) => mp.map((p) => p.map((ring) => ring.map(tilGeo)));
export const tilGeometri = (mpUtm) => (mpUtm.length ? { type: 'MultiPolygon', coordinates: mpTilGeo(mpUtm) } : null);
const arealUtm = (mp) => mp.reduce((s, p) => s + p.reduce((t, ring, i) => { let a = 0; for (let k = 1; k < ring.length; k++) a += ring[k - 1][0] * ring[k][1] - ring[k][0] * ring[k - 1][1]; return t + (i ? -1 : 1) * Math.abs(a / 2); }, 0), 0);

// Fordeler dekningsflaten på bestandene. Gir [{ b, daa, andel, geometri }] sortert etter areal.
export function fordelPaaBestand(dekning, bestand, PC) {
  if (!dekning.length) return [];
  const xs = dekning.flat(2).map((p) => p[0]); const ys = dekning.flat(2).map((p) => p[1]);
  const bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const ut = [];
  for (const b of bestand) {
    if (!b.geometri) continue;
    const g = mpTilUtm(b.geometri);
    const gx = g.flat(2).map((p) => p[0]); const gy = g.flat(2).map((p) => p[1]);
    if (Math.max(...gx) < bb[0] || Math.min(...gx) > bb[2] || Math.max(...gy) < bb[1] || Math.min(...gy) > bb[3]) continue;
    let snitt;
    try { snitt = PC.intersection(g, dekning); } catch { continue; }
    const m2 = arealUtm(snitt);
    if (m2 < 1) continue;
    const bestandM2 = arealUtm(g) || 1;
    ut.push({ b, daa: m2 / 1000, andel: Math.min(1, m2 / bestandM2), geometri: tilGeometri(snitt), utm: snitt });
  }
  return ut.sort((x, y) => y.daa - x.daa);
}

// Forslag per bestand. aar = året tiltaket ble utført. Gir [{ b, daa, andel, geometri, handling, tiltak?, nyttDaa, velg }].
export function foreslaa(fordeling, type, { aar = new Date().getFullYear(), PC = null } = {}) {
  return fordeling.map((f) => {
    const liste = f.b.tiltak || [];
    const utfortSammeAar = liste.find((t) => t.type === type && t.status === 'utfort' && Number(String(t.utfortDato || t.aar).slice(0, 4)) === aar && t.dekning);
    const planlagt = liste.filter((t) => t.type === type && t.status !== 'utfort').sort((a, b) => Math.abs((a.aar || aar) - aar) - Math.abs((b.aar || aar) - aar))[0];
    let handling = 'nytt'; let tiltak = null; let nyttDaa = f.daa;
    if (utfortSammeAar && PC) {
      handling = 'slaa-sammen'; tiltak = utfortSammeAar;
      try { nyttDaa = arealUtm(PC.union(mpTilUtm(utfortSammeAar.dekning), f.utm)) / 1000; } catch { nyttDaa = (utfortSammeAar.arealDaa || 0) + f.daa; }
    } else if (planlagt && Math.abs((planlagt.aar || aar) - aar) <= 3) { handling = 'utfor-planlagt'; tiltak = planlagt; }
    return { ...f, handling, tiltak, nyttDaa, helt: f.andel >= HELT_ANDEL, velg: f.daa >= MIN_DAA };
  });
}

// Lagrer forslagene i bestandene. Gir antall tiltak som ble endret eller laget.
export function bruk(forslag, type, { dato = new Date().toISOString().slice(0, 10), sporId = null, PC = null, nyId = () => `t${Math.random().toString(36).slice(2, 9)}` } = {}) {
  let n = 0; const aar = Number(dato.slice(0, 4));
  for (const f of forslag) {
    if (!f.velg) continue;
    const b = f.b; b.tiltak = b.tiltak || [];
    const helt = f.brukHelt ?? f.helt;
    const daa = helt ? b.areal : Math.round(f.nyttDaa * 100) / 100;
    const tekst = `Registrert med sporlogg: ${String(Math.round(daa * 10) / 10).replace('.', ',')} daa${helt ? ' (hele bestandet)' : ` (${Math.round(Math.min(1, daa / (b.areal || daa)) * 100)} % av bestandet)`}`;
    if (f.handling === 'slaa-sammen' && f.tiltak) {
      const t = f.tiltak;
      try { t.dekning = tilGeometri(PC.union(mpTilUtm(t.dekning), f.utm)); } catch { /* behold gammel flate */ }
      t.arealDaa = daa; t.helt = helt; t.kommentar = tekst; t.sporIder = [...new Set([...(t.sporIder || []), sporId].filter(Boolean))]; t.utfortDato = dato;
    } else if (f.handling === 'utfor-planlagt' && f.tiltak) {
      Object.assign(f.tiltak, { status: 'utfort', utfortDato: dato, aar, arealDaa: daa, helt, dekning: f.geometri, kommentar: [f.tiltak.kommentar, tekst].filter(Boolean).join(' · '), sporIder: [sporId].filter(Boolean) });
    } else {
      b.tiltak.push({ id: nyId('t'), type, aar, status: 'utfort', utfortDato: dato, prioritet: 2, kilde: 'sporlogg', arealDaa: daa, helt, dekning: f.geometri, kommentar: tekst, sporIder: [sporId].filter(Boolean) });
    }
    n++;
  }
  return n;
}

// ---------- GPX ----------
export function tilGpx(spor, navn = 'SkogIQ sporlogg') {
  const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="SkogIQ Felt" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${esc(navn)}</name>${spor.map((seg) => `<trkseg>${seg.map((p) => `<trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">${p.tid ? `<time>${new Date(p.tid).toISOString()}</time>` : ''}</trkpt>`).join('')}</trkseg>`).join('')}</trk></gpx>`;
}
// Leser spor fra GPX (trkseg/trkpt, og rtept som reserve). Gir en liste av segmenter.
export function lesGpx(tekst) {
  const seg = [];
  const deler = tekst.split(/<trkseg[^>]*>/i).slice(1);
  const punkter = (s) => [...s.matchAll(/<(?:trkpt|rtept)\b([^>]*)>([\s\S]*?)<\/(?:trkpt|rtept)>|<(?:trkpt|rtept)\b([^>]*)\/>/gi)].map((m) => {
    const attr = m[1] || m[3] || ''; const indre = m[2] || '';
    const lat = Number((attr.match(/lat\s*=\s*["']([^"']+)/i) || [])[1]); const lon = Number((attr.match(/lon\s*=\s*["']([^"']+)/i) || [])[1]);
    const t = (indre.match(/<time>([^<]+)<\/time>/i) || [])[1];
    return { lat, lon, tid: t ? Date.parse(t) : null, noyaktighet: null };
  }).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  for (const d of deler) { const p = punkter(d.split(/<\/trkseg>/i)[0]); if (p.length) seg.push(p); }
  if (!seg.length) { const p = punkter(tekst); if (p.length) seg.push(p); }
  return seg;
}

export { arealM2 };
