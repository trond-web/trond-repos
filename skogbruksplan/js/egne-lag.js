// 📌 Egne kartlag: les inn GPX, KML, KMZ og GeoJSON som egne datalag i planen (f.eks. mastefester og traséer fra
// Statnett/nettselskap, stier, poster, grenser fra andre). Lagene lagres i planen (S.egneLag), vises i kartet i
// fullversjonen og i SkogIQ Felt, og følger planen ved synkronisering. Ingen DOM: parsing med regulære uttrykk, så den
// testes i Node. KMZ pakkes ut med DecompressionStream (nettleser) – eller en inflate-funksjon som gis inn (Node).
export const FILTYPER = '.gpx,.kml,.kmz,.geojson,.json';
export const ER_EGET_LAG = /\.(gpx|kml|kmz)$/i;
export const MAKS_OBJEKTER = 20000;
export const MAKS_BYTE = 15 * 1024 * 1024;
export const FARGER = ['#e5007d', '#7b2fd0', '#ff7a00', '#0077c8', '#00a19a', '#c0392b', '#2d6a1f', '#6b4f2a'];

const avr = (v) => Math.round(v * 1e7) / 1e7;
const ent = (s) => String(s ?? '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const rensTekst = (s, n = 2000) => ent(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
// Første <tag>…</tag> (uten navnerom-prefiks) i teksten
const tagg = (x, t) => { const m = x.match(new RegExp(`<(?:\\w+:)?${t}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${t}>`, 'i')); return m ? m[1] : null; };
const alle = (x, t) => [...x.matchAll(new RegExp(`<(?:\\w+:)?${t}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</(?:\\w+:)?${t}>)`, 'gi'))].map((m) => ({ hel: m[0], indre: m[1] ?? '' }));
const attr = (x, a) => { const m = x.match(new RegExp(`\\s${a}\\s*=\\s*["']([^"']*)["']`, 'i')); return m ? m[1] : null; };
const gyldig = ([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

// ---------- GPX ----------
export function parseGpx(tekst) {
  const f = [];
  const pkt = (x) => { const lat = Number(attr(x, 'lat')); const lon = Number(attr(x, 'lon')); return [avr(lon), avr(lat)]; };
  const egenskaper = (x) => {
    const p = {}; const n = tagg(x, 'name'); const d = tagg(x, 'desc') || tagg(x, 'cmt'); const s = tagg(x, 'sym'); const t = tagg(x, 'type'); const e = tagg(x, 'ele');
    if (n) p.navn = rensTekst(n, 200); if (d) p.beskrivelse = rensTekst(d); if (s) p.symbol = rensTekst(s, 60); if (t) p.type = rensTekst(t, 60); if (e && Number.isFinite(Number(e))) p.hoyde = Math.round(Number(e));
    return p;
  };
  for (const w of alle(tekst, 'wpt')) { const k = pkt(w.hel); if (gyldig(k)) f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: k }, properties: egenskaper(w.indre) }); }
  for (const r of alle(tekst, 'rte')) {
    const k = alle(r.indre, 'rtept').map((p) => pkt(p.hel)).filter(gyldig);
    if (k.length > 1) f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: k }, properties: egenskaper(r.indre.replace(/<rtept[\s\S]*?(<\/rtept>|\/>)/gi, '')) });
  }
  for (const t of alle(tekst, 'trk')) {
    const seg = alle(t.indre, 'trkseg').map((s) => alle(s.indre, 'trkpt').map((p) => pkt(p.hel)).filter(gyldig)).filter((s) => s.length > 1);
    if (!seg.length) continue;
    f.push({ type: 'Feature', geometry: seg.length === 1 ? { type: 'LineString', coordinates: seg[0] } : { type: 'MultiLineString', coordinates: seg }, properties: egenskaper(t.indre.replace(/<trkseg[\s\S]*?<\/trkseg>/gi, '')) });
  }
  return { type: 'FeatureCollection', features: f, navn: rensTekst(tagg(tagg(tekst, 'metadata') || '', 'name') || '', 120) || null };
}

// ---------- KML ----------
const koordinater = (s) => String(s || '').trim().split(/\s+/).map((c) => c.split(',').map(Number)).filter((c) => c.length >= 2).map(([lon, lat]) => [avr(lon), avr(lat)]).filter(gyldig);
// KML-farge aabbggrr → #rrggbb
const kmlFarge = (c) => { const m = String(c || '').trim().match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i); return m ? `#${m[4]}${m[3]}${m[2]}`.toLowerCase() : null; };
function kmlGeometrier(x) {
  const g = [];
  for (const p of alle(x, 'Point')) { const k = koordinater(tagg(p.indre, 'coordinates')); if (k.length) g.push({ type: 'Point', coordinates: k[0] }); }
  for (const l of alle(x, 'LineString')) { const k = koordinater(tagg(l.indre, 'coordinates')); if (k.length > 1) g.push({ type: 'LineString', coordinates: k }); }
  for (const p of alle(x, 'Polygon')) {
    const ytre = koordinater(tagg(tagg(p.indre, 'outerBoundaryIs') || '', 'coordinates')); if (ytre.length < 3) continue;
    const indre = alle(p.indre, 'innerBoundaryIs').map((i) => koordinater(tagg(i.indre, 'coordinates'))).filter((r) => r.length >= 3);
    const lukk = (r) => (r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1] ? r : [...r, r[0]]);
    g.push({ type: 'Polygon', coordinates: [lukk(ytre), ...indre.map(lukk)] });
  }
  for (const t of alle(x, 'Track')) { const k = alle(t.indre, 'coord').map((c) => c.indre.trim().split(/\s+/).map(Number)).map(([lon, lat]) => [avr(lon), avr(lat)]).filter(gyldig); if (k.length > 1) g.push({ type: 'LineString', coordinates: k }); }
  return g;
}
export function parseKml(tekst) {
  // Stiler: id → farge (linje/ikon/flate); StyleMap peker til «normal»-stilen
  const stiler = {};
  for (const s of alle(tekst, 'Style')) { const id = attr(s.hel, 'id'); if (!id) continue; stiler[id] = kmlFarge(tagg(tagg(s.indre, 'IconStyle') || '', 'color')) || kmlFarge(tagg(tagg(s.indre, 'LineStyle') || '', 'color')) || kmlFarge(tagg(tagg(s.indre, 'PolyStyle') || '', 'color')); }
  for (const s of alle(tekst, 'StyleMap')) { const id = attr(s.hel, 'id'); const par = alle(s.indre, 'Pair').find((p) => /normal/i.test(tagg(p.indre, 'key') || '')); const url = par && (tagg(par.indre, 'styleUrl') || '').replace(/^.*#/, ''); if (id && url) stiler[id] = stiler[url] || null; }
  const f = [];
  for (const pm of alle(tekst, 'Placemark')) {
    const x = pm.indre; const p = {};
    const n = tagg(x, 'name'); if (n) p.navn = rensTekst(n, 200);
    const d = tagg(x, 'description'); if (d && rensTekst(d)) p.beskrivelse = rensTekst(d);
    for (const dd of alle(x, 'Data')) { const k = attr(dd.hel, 'name'); const v = tagg(dd.indre, 'value'); if (k && v != null && rensTekst(v)) (p.data ||= {})[rensTekst(k, 60)] = rensTekst(v, 300); }
    for (const sd of alle(x, 'SimpleData')) { const k = attr(sd.hel, 'name'); if (k && rensTekst(sd.indre)) (p.data ||= {})[rensTekst(k, 60)] = rensTekst(sd.indre, 300); }
    if (p.data && Object.keys(p.data).length > 40) p.data = Object.fromEntries(Object.entries(p.data).slice(0, 40));
    const su = (tagg(x, 'styleUrl') || '').replace(/^.*#/, ''); const innebygd = tagg(x, 'Style');
    const farge = (innebygd && (kmlFarge(tagg(tagg(innebygd, 'IconStyle') || '', 'color')) || kmlFarge(tagg(tagg(innebygd, 'LineStyle') || '', 'color')))) || stiler[su];
    if (farge && farge !== '#ffffff') p.farge = farge;
    const g = kmlGeometrier(x);
    if (!g.length) continue;
    f.push({ type: 'Feature', geometry: g.length === 1 ? g[0] : { type: 'GeometryCollection', geometries: g }, properties: p });
  }
  const hode = (tagg(tekst, 'Document') || tagg(tekst, 'Folder') || '').split(/<(?:\w+:)?(?:Placemark|Folder|Style|StyleMap)\b/)[0]; const navn = tagg(hode, 'name');
  return { type: 'FeatureCollection', features: f, navn: navn ? rensTekst(navn, 120) : null };
}

// ---------- KMZ (ZIP) ----------
// Finner KML-fila i arkivet (doc.kml, ellers første .kml) via sentralkatalogen og pakker den ut.
export async function pakkUtKmz(buf, { inflate = null } = {}) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf); const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('KMZ-fila er ikke et gyldig ZIP-arkiv');
  const antall = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const filer = [];
  for (let i = 0; i < antall && dv.getUint32(p, true) === 0x02014b50; i++) {
    const nl = dv.getUint16(p + 28, true); const xl = dv.getUint16(p + 30, true); const cl = dv.getUint16(p + 32, true);
    filer.push({ navn: new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)), metode: dv.getUint16(p + 10, true), str: dv.getUint32(p + 20, true), lho: dv.getUint32(p + 42, true) });
    p += 46 + nl + xl + cl;
  }
  const kml = filer.find((f) => /(^|\/)doc\.kml$/i.test(f.navn)) || filer.find((f) => /\.kml$/i.test(f.navn));
  if (!kml) throw new Error('Fant ingen KML-fil i KMZ-arkivet');
  const start = kml.lho + 30 + dv.getUint16(kml.lho + 26, true) + dv.getUint16(kml.lho + 28, true);
  const data = u8.subarray(start, start + kml.str);
  if (kml.metode === 0) return new TextDecoder().decode(data);
  if (kml.metode !== 8) throw new Error('Ukjent komprimering i KMZ-fila');
  if (inflate) return new TextDecoder().decode(await inflate(data));
  const strom = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(strom).text();
}

// ---------- GeoJSON ----------
export function parseGeojson(tekst) {
  let j; try { j = JSON.parse(tekst); } catch { throw new Error('Fila er ikke gyldig GeoJSON'); }
  const f = j.type === 'FeatureCollection' ? j.features : j.type === 'Feature' ? [j] : j.type && j.coordinates ? [{ type: 'Feature', geometry: j, properties: {} }] : null;
  if (!f) throw new Error('Fila er ikke GeoJSON');
  const forste = (g) => (!g ? null : g.type === 'Point' ? g.coordinates : g.type === 'GeometryCollection' ? forste(g.geometries[0]) : forste({ type: 'Point', coordinates: g.coordinates.flat(3).slice(0, 2) }));
  const k = f.map((x) => forste(x.geometry)).find(Boolean);
  if (k && !gyldig(k)) throw new Error('GeoJSON-fila må være i WGS84 (lengde/bredde i grader)');
  return { type: 'FeatureCollection', features: f.filter((x) => x.geometry).map((x) => ({ type: 'Feature', geometry: x.geometry, properties: { ...(x.properties?.name || x.properties?.navn ? { navn: String(x.properties.name || x.properties.navn).slice(0, 200) } : {}), data: Object.fromEntries(Object.entries(x.properties || {}).filter(([, v]) => v != null && typeof v !== 'object').slice(0, 40).map(([a, v]) => [a, String(v).slice(0, 300)])) } })), navn: j.name || null };
}

// Les en fil (navn + innhold) til { navn, geojson, antall }.
export async function lesEgenFil(filnavn, buf, { inflate } = {}) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (u8.length > MAKS_BYTE) throw new Error(`Fila er for stor (maks ${Math.round(MAKS_BYTE / 1048576)} MB)`);
  const tekst = () => new TextDecoder().decode(u8);
  let fc;
  if (/\.gpx$/i.test(filnavn)) fc = parseGpx(tekst());
  else if (/\.kml$/i.test(filnavn)) fc = parseKml(tekst());
  else if (/\.kmz$/i.test(filnavn)) fc = parseKml(await pakkUtKmz(u8, { inflate }));
  else if (/\.(geo)?json$/i.test(filnavn)) fc = parseGeojson(tekst());
  else throw new Error('Ukjent filtype – bruk GPX, KML, KMZ eller GeoJSON');
  if (!fc.features.length) throw new Error('Fant ingen punkter, linjer eller flater i fila');
  if (fc.features.length > MAKS_OBJEKTER) throw new Error(`Fila har ${fc.features.length} objekter – maks ${MAKS_OBJEKTER}`);
  return { navn: fc.navn || filnavn.replace(/\.[^.]+$/, ''), geojson: { type: 'FeatureCollection', features: fc.features }, antall: telle(fc) };
}

export function telle(fc) {
  const a = { punkt: 0, linjer: 0, flater: 0 };
  const t = (g) => { if (!g) return; if (g.type === 'GeometryCollection') g.geometries.forEach(t); else if (/Point/.test(g.type)) a.punkt++; else if (/LineString/.test(g.type)) a.linjer++; else if (/Polygon/.test(g.type)) a.flater++; };
  for (const f of fc.features || []) t(f.geometry);
  return a;
}
export const antallTekst = (a) => [a.punkt && `${a.punkt} punkt`, a.linjer && `${a.linjer} ${a.linjer === 1 ? 'linje' : 'linjer'}`, a.flater && `${a.flater} ${a.flater === 1 ? 'flate' : 'flater'}`].filter(Boolean).join(', ') || 'tomt';

// Nytt lag til S.egneLag
export function nyttLag(r, { id, filnavn = '', brukte = [], naa = new Date().toISOString() } = {}) {
  const farge = FARGER.find((c) => !brukte.includes(c)) || FARGER[brukte.length % FARGER.length];
  return { id, navn: String(r.navn || filnavn || 'Eget lag').slice(0, 80), farge, synlig: true, filnavn: String(filnavn).slice(0, 120), importert: naa, endret: naa, antall: r.antall, geojson: r.geojson };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function popupHtml(p = {}, lag = null) {
  const rader = [p.type && ['Type', p.type], p.symbol && ['Symbol', p.symbol], p.hoyde != null && ['Høyde', `${p.hoyde} moh.`], ...Object.entries(p.data || {})].filter(Boolean);
  return `<div style="max-width:260px"><b>${esc(p.navn || 'Uten navn')}</b>${lag ? `<div style="font-size:11.5px;color:#666">📌 ${esc(lag.navn)}</div>` : ''}${p.beskrivelse ? `<div style="margin-top:4px;font-size:12.5px">${esc(p.beskrivelse)}</div>` : ''}${rader.length ? `<table style="margin-top:4px;font-size:12px">${rader.map(([k, v]) => `<tr><td style="color:#666;padding-right:6px">${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>` : ''}</div>`;
}

// Leaflet-lag for et eget lag (L gis inn). Punkter som runde markører, linjer og flater i lagets farge.
export function lagKartlag(L, lag, { pane, popup = true, etiketter = false } = {}) {
  const farge = (f) => f.properties?.farge || lag.farge;
  return L.geoJSON(lag.geojson, {
    ...(pane ? { pane } : {}), bubblingMouseEvents: false,
    style: (f) => ({ color: farge(f), weight: 3, opacity: 0.95, fillColor: farge(f), fillOpacity: 0.18 }),
    pointToLayer: (f, ll) => L.circleMarker(ll, { ...(pane ? { pane } : {}), bubblingMouseEvents: false, radius: 6, color: '#fff', weight: 2, fillColor: farge(f), fillOpacity: 1 }),
    onEachFeature: (f, l) => {
      if (popup) l.bindPopup(popupHtml(f.properties, lag));
      if (etiketter && f.properties?.navn && f.geometry?.type === 'Point') l.bindTooltip(esc(f.properties.navn), { permanent: true, direction: 'right', offset: [6, 0], className: 'eget-lag-etikett' });
    },
  });
}
