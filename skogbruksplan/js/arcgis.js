// Overføring av skogbruksplanen til ArcGIS Online eller ArcGIS Enterprise (én vei: SkogIQ → ArcGIS).
//   * Innlogging med OAuth 2.0 + PKCE direkte mot brukerens portal (ingen hemmeligheter på serveren; SkogIQ ser aldri
//     passordet). Krever en registrert ArcGIS-app (klient-ID) med SkogIQs tilbakekall-adresse.
//   * Første gang opprettes et hosted feature layer i brukerens egen organisasjon (createService + addToDefinition),
//     med lag for bestand, tiltak, veier, punkter, eiendom, miljø og skader. Senere synkronisering erstatter innholdet
//     i lagene (deleteFeatures + addFeatures), slik at ArcGIS alltid speiler planen.
//   * Shapefile (ZIP) til ArcGIS Pro som reserve uten innlogging.
// Ingen DOM – kan testes i Node med en falsk fetch.
import { TILTAKSTYPER, TRESLAG, startTilstand } from './model.js';
import { lagShapefile, lagZip } from './maskindata.js';

export const ARCGIS_ONLINE = 'https://www.arcgis.com';
export const TILBAKEKALL = 'arcgis-callback.html';
export const LS_NOKKEL = 'skogiq-arcgis';

// ---------------------------------------------------------------- PKCE
const b64url = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export async function lagPkce(krypto = globalThis.crypto) {
  const r = new Uint8Array(32); krypto.getRandomValues(r); const verifier = b64url(r);
  const challenge = b64url(new Uint8Array(await krypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const s = new Uint8Array(12); krypto.getRandomValues(s);
  return { verifier, challenge, state: b64url(s) };
}
export const rensPortal = (p) => String(p || ARCGIS_ONLINE).trim().replace(/\/+$/, '').replace(/\/(sharing|home)(\/.*)?$/, '');
export function autoriserUrl({ portal, klientId, tilbake, challenge, state }) {
  const q = new URLSearchParams({ client_id: klientId, response_type: 'code', redirect_uri: tilbake, code_challenge: challenge, code_challenge_method: 'S256', state, expiration: '20160' });
  return `${rensPortal(portal)}/sharing/rest/oauth2/authorize?${q}`;
}

// ---------------------------------------------------------------- REST
export function lagKlient({ hent = (u, o) => fetch(u, o) } = {}) {
  async function post(url, felt) {
    const kropp = new URLSearchParams({ f: 'json', ...Object.fromEntries(Object.entries(felt).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])) });
    const r = await hent(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: kropp.toString() });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) { const e = j.error || {}; throw Object.assign(new Error(`ArcGIS: ${e.message || `svarte ${r.status}`}${e.details?.length ? ` (${e.details.join('; ')})` : ''}`), { kode: e.code || r.status }); }
    return j;
  }
  const portalUrl = (k) => rensPortal(k.portal);
  return {
    post,
    async byttKode({ portal, klientId, tilbake, kode, verifier }) {
      const j = await post(`${rensPortal(portal)}/sharing/rest/oauth2/token`, { grant_type: 'authorization_code', client_id: klientId, redirect_uri: tilbake, code: kode, code_verifier: verifier });
      return { portal: rensPortal(portal), klientId, token: j.access_token, utloper: Date.now() + (j.expires_in || 1800) * 1000 - 60e3, refresh: j.refresh_token || null, refreshUtloper: j.refresh_token_expires_in ? Date.now() + j.refresh_token_expires_in * 1000 : null, bruker: j.username };
    },
    async fornyToken(k) {
      if (!k.refresh) throw new Error('Innloggingen til ArcGIS er utløpt. Koble til på nytt.');
      const j = await post(`${portalUrl(k)}/sharing/rest/oauth2/token`, { grant_type: 'refresh_token', client_id: k.klientId, refresh_token: k.refresh });
      return { ...k, token: j.access_token, utloper: Date.now() + (j.expires_in || 1800) * 1000 - 60e3 };
    },
    async portal(k) { return post(`${portalUrl(k)}/sharing/rest/portals/self`, { token: k.token }); },
    async opprettTjeneste(k, { navn, beskrivelse, utstrekning }) {
      const cp = { name: navn, serviceDescription: beskrivelse, hasStaticData: false, maxRecordCount: 2000, supportedQueryFormats: 'JSON', capabilities: 'Create,Delete,Query,Update,Editing', spatialReference: { wkid: 4326 }, initialExtent: { ...utstrekning, spatialReference: { wkid: 4326 } }, allowGeometryUpdates: true, units: 'esriDecimalDegrees', xssPreventionInfo: { xssPreventionEnabled: true, xssPreventionRule: 'InputOnly', xssInputRule: 'rejectInvalid' } };
      const j = await post(`${portalUrl(k)}/sharing/rest/content/users/${encodeURIComponent(k.bruker)}/createService`, { createParameters: cp, outputType: 'featureService', token: k.token });
      if (!j.serviceurl) throw new Error('ArcGIS opprettet ikke tjenesten.');
      return { url: j.serviceurl, itemId: j.itemId };
    },
    async leggTilLag(k, url, lag) { return post(`${url.replace('/rest/services/', '/rest/admin/services/')}/addToDefinition`, { addToDefinition: { layers: lag }, token: k.token }); },
    async oppdaterElement(k, itemId, felt) { return post(`${portalUrl(k)}/sharing/rest/content/users/${encodeURIComponent(k.bruker)}/items/${itemId}/update`, { ...felt, token: k.token }); },
    async tjeneste(k, url) { return post(url, { token: k.token }); },
    async slettAlt(k, url, lagId) { return post(`${url}/${lagId}/deleteFeatures`, { where: '1=1', token: k.token }); },
    async leggTil(k, url, lagId, features) {
      let n = 0;
      for (let i = 0; i < features.length; i += 500) { const j = await post(`${url}/${lagId}/addFeatures`, { features: features.slice(i, i + 500), rollbackOnFailure: 'true', token: k.token }); n += (j.addResults || []).filter((x) => x.success).length; }
      return n;
    },
  };
}

// ---------------------------------------------------------------- lag og felt
const S_ = (name, alias, length = 255) => ({ name, alias, type: 'esriFieldTypeString', length, nullable: true, editable: true });
const D_ = (name, alias) => ({ name, alias, type: 'esriFieldTypeDouble', nullable: true, editable: true });
const I_ = (name, alias) => ({ name, alias, type: 'esriFieldTypeInteger', nullable: true, editable: true });
const T_ = (name, alias) => ({ name, alias, type: 'esriFieldTypeDate', length: 8, nullable: true, editable: true });
const FELLES = [S_('skogiq_id', 'SkogIQ-ID', 64), T_('oppdatert', 'Oppdatert fra SkogIQ')];
export const LAG = [
  { id: 0, navn: 'Bestand', geometri: 'esriGeometryPolygon', farge: [90, 164, 105, 140], felt: [S_('bestand_nr', 'Bestand', 20), S_('teig', 'Teig', 20), S_('treslag', 'Treslag (kode)', 4), S_('treslag_navn', 'Treslag', 40), I_('bonitet', 'Bonitet (H40)'), S_('hogstklasse', 'Hogstklasse', 10), I_('alder', 'Alder (år)'), D_('areal_daa', 'Areal (daa)'), D_('volum_daa', 'Volum (m³/daa)'), D_('volum_m3', 'Volum (m³)'), I_('treantall_daa', 'Treantall per daa'), D_('hoyde_m', 'Middelhøyde (m)'), S_('miljofigur', 'Miljøfigur', 100), S_('merknad', 'Merknad', 1000)] },
  { id: 1, navn: 'Tiltak', geometri: 'esriGeometryPolygon', farge: [224, 123, 42, 120], felt: [S_('bestand_nr', 'Bestand', 20), S_('type', 'Tiltakstype (kode)', 40), S_('tiltak', 'Tiltak', 80), I_('aar', 'År'), S_('status', 'Status', 20), S_('prioritet', 'Prioritet', 20), D_('areal_daa', 'Areal (daa)'), S_('kommentar', 'Kommentar', 1000)] },
  { id: 2, navn: 'Veier', geometri: 'esriGeometryPolyline', farge: [139, 90, 43, 255], felt: [S_('navn', 'Navn', 120), S_('vegnummer', 'Vegnummer', 30), S_('status', 'Status', 20), I_('klasse', 'Vegklasse'), S_('tilstand', 'Tilstand', 30), D_('lengde_m', 'Lengde (m)')] },
  { id: 3, navn: 'Punkter', geometri: 'esriGeometryPoint', farge: [28, 92, 171, 255], felt: [S_('type', 'Type', 40), S_('navn', 'Navn', 120), S_('merknad', 'Merknad', 500)] },
  { id: 4, navn: 'Eiendom', geometri: 'esriGeometryPolygon', farge: [208, 59, 59, 0], felt: [S_('navn', 'Eiendom', 120), S_('gnrbnr', 'Gnr/bnr', 60), S_('kommune', 'Kommune', 60), S_('kommunenr', 'Kommunenr', 8), D_('areal_daa', 'Areal (daa)')] },
  { id: 5, navn: 'Miljø og hensyn', geometri: 'esriGeometryPolygon', farge: [52, 199, 89, 90], felt: [S_('type', 'Type', 40), S_('navn', 'Navn', 200), S_('lenke', 'Lenke', 500)] },
  { id: 6, navn: 'Skader', geometri: 'esriGeometryPolygon', farge: [208, 59, 59, 110], felt: [S_('type', 'Skadetype', 40), S_('dato', 'Dato', 10), S_('status', 'Status', 30), I_('skadeprosent', 'Skadeprosent')] },
];
export function lagDefinisjoner(utstrekning) {
  return LAG.map((l) => ({
    id: l.id, name: l.navn, type: 'Feature Layer', geometryType: l.geometri, objectIdField: 'OBJECTID', displayField: l.felt[0].name, hasAttachments: false, htmlPopupType: 'esriServerHTMLPopupTypeAsHTMLText',
    extent: { ...utstrekning, spatialReference: { wkid: 4326 } }, capabilities: 'Create,Delete,Query,Update,Editing', allowGeometryUpdates: true,
    fields: [{ name: 'OBJECTID', alias: 'OBJECTID', type: 'esriFieldTypeOID', nullable: false, editable: false }, ...FELLES, ...l.felt],
    drawingInfo: { renderer: { type: 'simple', symbol: l.geometri === 'esriGeometryPoint' ? { type: 'esriSMS', style: 'esriSMSCircle', size: 8, color: l.farge, outline: { color: [255, 255, 255, 255], width: 1 } } : l.geometri === 'esriGeometryPolyline' ? { type: 'esriSLS', style: 'esriSLSSolid', color: l.farge, width: 2 } : { type: 'esriSFS', style: 'esriSFSSolid', color: l.farge, outline: { type: 'esriSLS', style: 'esriSLSSolid', color: [...l.farge.slice(0, 3), 255], width: 1 } } } },
  }));
}

// ---------------------------------------------------------------- GeoJSON → Esri JSON
const areal = (r) => { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]); return s / 2; }; // > 0 = med klokka
const lukk = (r) => (r.length && (r[0][0] !== r.at(-1)[0] || r[0][1] !== r.at(-1)[1]) ? [...r, r[0]] : r);
export function esriGeometri(g) {
  if (!g) return null; const sr = { wkid: 4326 };
  if (g.type === 'Point') return { x: g.coordinates[0], y: g.coordinates[1], spatialReference: sr };
  if (g.type === 'LineString') return { paths: [g.coordinates], spatialReference: sr };
  if (g.type === 'MultiLineString') return { paths: g.coordinates, spatialReference: sr };
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : null; if (!polys) return null;
  // Esri: ytre ringer med klokka, hull mot klokka.
  const rings = polys.flatMap((p) => p.map((r, i) => { const l = lukk(r); const medKlokka = areal(l) > 0; return (i === 0) === medKlokka ? l : [...l].reverse(); }));
  return { rings, spatialReference: sr };
}
const nar = Date.now;
export function tilEsri(S, { tid = nar() } = {}) {
  const ut = Object.fromEntries(LAG.map((l) => [l.id, []]));
  const f = (lag, id, geometri, attr) => { const g = esriGeometri(geometri); if (g) ut[lag].push({ geometry: g, attributes: { skogiq_id: String(id ?? ''), oppdatert: tid, ...attr } }); };
  for (const b of S.bestand || []) {
    const st = startTilstand(b);
    f(0, b.id, b.geometri, { bestand_nr: String(b.nr ?? ''), teig: b.teig ? String(b.teig) : null, treslag: b.treslag || null, treslag_navn: TRESLAG[b.treslag] || null, bonitet: b.bonitet ?? null, hogstklasse: b.hogstklasse != null ? String(b.hogstklasse) : null, alder: st.alder != null ? Math.round(st.alder) : null, areal_daa: b.areal ?? null, volum_daa: st.volumDaa != null ? Math.round(st.volumDaa * 10) / 10 : null, volum_m3: st.volumDaa != null && b.areal ? Math.round(st.volumDaa * b.areal) : null, treantall_daa: b.treantall ?? null, hoyde_m: b.hoyde ?? null, miljofigur: b.miljo ? (typeof b.miljo === 'string' ? b.miljo : 'Ja') : null, merknad: b.merknad || null });
    for (const t of b.tiltak || []) f(1, t.id, t.geometri || b.geometri, { bestand_nr: String(b.nr ?? ''), type: t.type, tiltak: TILTAKSTYPER[t.type]?.navn || t.type, aar: t.aar ?? null, status: t.status || 'planlagt', prioritet: t.prioritet || null, areal_daa: t.arealDaa ?? b.areal ?? null, kommentar: t.kommentar || null });
  }
  for (const v of S.veier?.veier || []) f(2, v.id, v.geometri, { navn: v.navn || null, vegnummer: v.vegnummer || null, status: v.status || null, klasse: Number.isFinite(Number(v.klasse)) ? Number(v.klasse) : null, tilstand: v.tilstand || null, lengde_m: v.lengde ?? null });
  for (const p of S.veier?.punkter || []) if (p.geometri?.type === 'Point') f(3, p.id, p.geometri, { type: p.type || null, navn: p.navn || null, merknad: p.merknad || null });
  if (S.eiendom?.grense) f(4, 'eiendom', S.eiendom.grense, { navn: S.eiendom.navn || null, gnrbnr: S.eiendom.gnrbnr || null, kommune: S.eiendom.kommune || null, kommunenr: S.eiendom.kommunenr || null, areal_daa: (S.bestand || []).reduce((s, b) => s + (b.areal || 0), 0) || null });
  for (const o of S.pefc?.objekter || []) if (/Polygon/.test(o.geometri?.type || '')) f(5, o.id || o.navn, o.geometri, { type: o.type || null, navn: o.navn || null, lenke: o.lenke || null });
  for (const s of S.skogbrand?.skader || []) if (/Polygon/.test(s.geometri?.type || '')) f(6, s.id, s.geometri, { type: s.type || null, dato: s.dato || null, status: s.status || null, skadeprosent: s.skadeprosent ?? null });
  return ut;
}
export function utstrekning(S) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  const gaa = (c) => { if (typeof c[0] === 'number') { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); } else c.forEach(gaa); };
  for (const g of [S.eiendom?.grense, ...(S.bestand || []).map((b) => b.geometri)]) if (g?.coordinates) gaa(g.coordinates);
  return Number.isFinite(x0) ? { xmin: x0, ymin: y0, xmax: x1, ymax: y1 } : { xmin: 4, ymin: 57, xmax: 32, ymax: 72 };
}
export const tjenesteNavn = (S, id = Math.random().toString(36).slice(2, 7)) => `SkogIQ_${String(S.eiendom?.navn || 'skogbruksplan').replace(/æ/g, 'ae').replace(/Æ/g, 'Ae').replace(/ø/g, 'o').replace(/Ø/g, 'O').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)}_${id}`;

// ---------------------------------------------------------------- overføring
// k: innlogging { portal, token, bruker, … }; mal: S.arcgis { url, itemId } eller null. Gir oppdatert S.arcgis.
export async function overfor(S, k, { klient = lagKlient(), framdrift = () => {}, tid = Date.now() } = {}) {
  let mal = S.arcgis?.url && S.arcgis.portal === k.portal && S.arcgis.bruker === k.bruker ? S.arcgis : null;
  const data = tilEsri(S, { tid });
  if (mal) { try { await klient.tjeneste(k, mal.url); } catch (e) { if (/not found|does not exist|400|404|Invalid URL/i.test(e.message) || e.kode === 400 || e.kode === 404) mal = null; else throw e; } }
  if (!mal) {
    framdrift('Oppretter lag i ArcGIS …');
    const ut = utstrekning(S); const t = await klient.opprettTjeneste(k, { navn: tjenesteNavn(S), beskrivelse: `Skogbruksplan for ${S.eiendom?.navn || 'eiendommen'} fra SkogIQ.ai`, utstrekning: ut });
    await klient.leggTilLag(k, t.url, lagDefinisjoner(ut));
    await klient.oppdaterElement(k, t.itemId, { title: `Skogbruksplan – ${S.eiendom?.navn || 'eiendom'}${S.eiendom?.gnrbnr ? ` (${S.eiendom.gnrbnr})` : ''}`, tags: 'SkogIQ,skogbruksplan,skog,bestand', snippet: 'Skogbruksplan fra SkogIQ.ai – oppdateres fra SkogIQ (rediger i SkogIQ)', description: 'Laget og oppdatert av SkogIQ.ai. Endringer gjøres i SkogIQ; laget overskrives ved neste synkronisering.' });
    mal = { url: t.url, itemId: t.itemId, portal: k.portal, bruker: k.bruker, opprettet: new Date(tid).toISOString() };
  }
  const antall = {};
  for (const l of LAG) {
    framdrift(`Oppdaterer ${l.navn.toLowerCase()} …`);
    await klient.slettAlt(k, mal.url, l.id);
    antall[l.navn] = data[l.id].length ? await klient.leggTil(k, mal.url, l.id, data[l.id]) : 0;
  }
  return { ...mal, sist: new Date(tid).toISOString(), antall };
}
export const elementUrl = (a) => (a?.itemId ? `${rensPortal(a.portal)}/home/item.html?id=${a.itemId}` : null);
export const kartUrl = (a) => (a?.itemId ? `${rensPortal(a.portal)}/home/webmap/viewer.html?useExisting=1&layers=${a.itemId}` : null);

// ---------------------------------------------------------------- Shapefile (ZIP) til ArcGIS Pro
const DBF = (navn, type = 'C', lengde = 60, des = 0) => ({ navn, type, lengde, des });
export function shapefilZip(S) {
  const e = tilEsri(S); const filer = [];
  const tilGeo = (g) => (g.rings ? { type: 'Polygon', coordinates: g.rings } : g.paths ? { type: 'MultiLineString', coordinates: g.paths } : { type: 'Point', coordinates: [g.x, g.y] });
  const leggTil = (navn, lag, type, felt, kart) => {
    if (!e[lag].length) return;
    const obj = e[lag].map((x) => ({ geometri: type === 'linje' ? { type: 'LineString', coordinates: x.geometry.paths[0] } : tilGeo(x.geometry), egenskaper: kart(x.attributes) }));
    const sf = lagShapefile(obj, felt, type); for (const [ext, data] of Object.entries(sf)) filer.push({ navn: `${navn}.${ext}`, data });
    filer.push({ navn: `${navn}.cpg`, data: 'ISO-8859-1' }); // tegnsett for DBF (æøå)
  };
  leggTil('bestand', 0, 'polygon', [DBF('ID', 'C', 40), DBF('BESTAND', 'C', 20), DBF('TRESLAG', 'C', 4), DBF('BONITET', 'N', 4), DBF('HKL', 'C', 10), DBF('ALDER', 'N', 5), DBF('AREAL_DAA', 'N', 12, 2), DBF('VOL_DAA', 'N', 10, 1), DBF('VOLUM_M3', 'N', 12), DBF('MERKNAD', 'C', 200)],
    (a) => ({ ID: a.skogiq_id, BESTAND: a.bestand_nr, TRESLAG: a.treslag, BONITET: a.bonitet, HKL: a.hogstklasse, ALDER: a.alder, AREAL_DAA: a.areal_daa, VOL_DAA: a.volum_daa, VOLUM_M3: a.volum_m3, MERKNAD: a.merknad }));
  leggTil('tiltak', 1, 'polygon', [DBF('ID', 'C', 40), DBF('BESTAND', 'C', 20), DBF('TYPE', 'C', 40), DBF('TILTAK', 'C', 80), DBF('AAR', 'N', 4), DBF('STATUS', 'C', 20), DBF('AREAL_DAA', 'N', 12, 2)],
    (a) => ({ ID: a.skogiq_id, BESTAND: a.bestand_nr, TYPE: a.type, TILTAK: a.tiltak, AAR: a.aar, STATUS: a.status, AREAL_DAA: a.areal_daa }));
  leggTil('veier', 2, 'linje', [DBF('ID', 'C', 40), DBF('NAVN', 'C', 120), DBF('STATUS', 'C', 20), DBF('KLASSE', 'N', 2), DBF('LENGDE_M', 'N', 10)],
    (a) => ({ ID: a.skogiq_id, NAVN: a.navn, STATUS: a.status, KLASSE: a.klasse, LENGDE_M: a.lengde_m }));
  leggTil('punkter', 3, 'punkt', [DBF('ID', 'C', 40), DBF('TYPE', 'C', 40), DBF('NAVN', 'C', 120)], (a) => ({ ID: a.skogiq_id, TYPE: a.type, NAVN: a.navn }));
  leggTil('eiendom', 4, 'polygon', [DBF('NAVN', 'C', 120), DBF('GNRBNR', 'C', 60), DBF('KOMMUNE', 'C', 60)], (a) => ({ NAVN: a.navn, GNRBNR: a.gnrbnr, KOMMUNE: a.kommune }));
  leggTil('miljo', 5, 'polygon', [DBF('TYPE', 'C', 40), DBF('NAVN', 'C', 200)], (a) => ({ TYPE: a.type, NAVN: a.navn }));
  leggTil('skader', 6, 'polygon', [DBF('TYPE', 'C', 40), DBF('DATO', 'C', 10), DBF('STATUS', 'C', 30), DBF('PROSENT', 'N', 3)], (a) => ({ TYPE: a.type, DATO: a.dato, STATUS: a.status, PROSENT: a.skadeprosent }));
  filer.push({ navn: 'LES_MEG.txt', data: `Skogbruksplan fra SkogIQ.ai – ${S.eiendom?.navn || ''}\r\nKoordinatsystem: WGS 84 (EPSG:4326). ArcGIS Pro projiserer automatisk til kartets koordinatsystem (f.eks. EUREF89 UTM 32/33).\r\nLag: bestand, tiltak, veier, punkter, eiendom, miljo, skader.\r\n` });
  return lagZip(filer);
}
