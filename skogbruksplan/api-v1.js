// Integrasjons-API (/api/v1): eksterne systemer henter og oppdaterer én brukers skogbruksplaner med en API-nøkkel
// (api-nokler.js) som administrator har opprettet. Planene ligger i skylagringen (sky-lager.js); en skriving lagres som
// ny versjon (med grunnversjon), så appene (fullversjon og Felt) får endringen ved neste synkronisering.
// Beregninger (skogkarakter, landbrukstakst) bruker de samme modulene som appen (js/…).
// Admin: /api/admin/apinokler (opprette, liste, trekke tilbake nøkler; logg over kall).
// Dokumentasjon: GET /api/v1/openapi.json (api-dok.js) og i admin.
import { gzipSync, gunzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { TILTAKSTYPER } from './js/model.js';
import { OPPDRAGSSTATUS } from './js/oppdrag.js';
import { openapi } from './api-dok.js';

export const VERSJON = '1.0';
const MAKS_KROPP = 2 * 1024 * 1024;
const nyId = (p) => `${p}${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
const iso = () => new Date().toISOString();
const dato = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
const tekst = (v, n = 2000) => (v == null ? '' : String(v).slice(0, n));

// Planen i skylagringen: base64 (+ gzip) JSON
export function pakkUt(p) { let b = Buffer.from(p.plan, 'base64'); if (p.gzip) b = gunzipSync(b); return JSON.parse(b.toString('utf8')); }
export function pakk(plan) { const { synk, sky, ...uten } = plan; return { plan: gzipSync(Buffer.from(JSON.stringify(uten))).toString('base64'), gzip: true }; }
const planMeta = (S) => ({ areal: (S.bestand || []).reduce((s, b) => s + (b.areal || 0), 0), antall: (S.bestand || []).length, kommune: S.eiendom?.kommune || '', kommunenr: S.eiendom?.kommunenr || '', gnrbnr: S.eiendom?.gnrbnr || '' });

// Kort form av bestand og tiltak i svarene
const bestandKort = (b) => ({ id: b.id, nr: b.nr, teig: b.teig || '', areal: b.areal, treslag: b.treslag, bonitet: b.bonitet, hogstklasse: b.hogstklasse ?? null, alder: b.alder, volumDaa: b.volumDaa, treantall: b.treantall, hoyde: b.hoyde, miljo: !!b.miljo, vegetasjon: b.vegetasjon?.kode || null, kantsone: b.kantsone || null, antallTiltak: (b.tiltak || []).length });
const tiltakKort = (t, b) => ({ id: t.id, bestandId: b.id, bestandNr: b.nr, type: t.type, navn: TILTAKSTYPER[t.type]?.navn || t.type, aar: t.aar, status: t.status || 'planlagt', prioritet: t.prioritet ?? null, kommentar: t.kommentar || '', utfortDato: t.utfortDato || null, arealDaa: t.arealDaa ?? null, endret: t.endret || null, kilde: t.kilde || null });

export function apiV1(ctx, req, res, sti) {
  const { nokler, sky, ekstraHoder = {} } = ctx;
  if (sti !== '/api/v1' && !sti.startsWith('/api/v1/')) return false;
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, X-API-Key, Content-Type, If-Match', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'Access-Control-Expose-Headers': 'ETag' };
  let nokkel = null;
  const json = (status, obj, hoder = {}) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors, ...ekstraHoder, ...hoder }); res.end(JSON.stringify(obj)); if (nokkel?.id) nokler.logg({ nokkel: nokkel.id, bruker: nokkel.bruker, metode: req.method, sti, status }); };
  const feil = (status, melding, kode) => json(status, { feil: melding, kode: kode || String(status) });
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return true; }
  const kropp = () => new Promise((ok) => { let n = 0; const d = []; req.on('data', (b) => { n += b.length; if (n > MAKS_KROPP) { req.destroy(); ok(null); } else d.push(b); }); req.on('end', () => { try { ok(JSON.parse(Buffer.concat(d).toString('utf8') || '{}')); } catch { ok(null); } }); req.on('error', () => ok(null)); });
  (async () => {
    // Åpne: informasjon og dokumentasjon
    if (sti === '/api/v1/openapi.json' && req.method === 'GET') return json(200, openapi());
    const h = req.headers.authorization || ''; const tok = h.startsWith('Bearer ') ? h.slice(7).trim() : String(req.headers['x-api-key'] || '').trim();
    if (sti === '/api/v1' && req.method === 'GET' && !tok) return json(200, { navn: 'SkogIQ.ai API', versjon: VERSJON, dokumentasjon: '/api/v1/openapi.json', autentisering: 'Authorization: Bearer <API-nøkkel> eller X-API-Key' });
    if (!tok) return feil(401, 'Mangler API-nøkkel (Authorization: Bearer … eller X-API-Key)', 'mangler_nokkel');
    const v = nokler.verifiser(tok);
    if (v?.grense) return feil(429, 'For mange kall – vent litt', 'rate_grense');
    if (!v) return feil(401, 'Ugyldig eller tilbaketrukket API-nøkkel', 'ugyldig_nokkel');
    nokkel = v; const u = v.bruker;
    const skrive = () => { if (v.tilgang !== 'skriv') { feil(403, 'Nøkkelen har bare lesetilgang', 'bare_les'); return false; } return true; };
    if (sti === '/api/v1' && req.method === 'GET') return json(200, { navn: 'SkogIQ.ai API', versjon: VERSJON, bruker: u, tilgang: v.tilgang, nokkel: v.navn, dokumentasjon: '/api/v1/openapi.json' });

    if (sti === '/api/v1/planer' && req.method === 'GET') return json(200, { planer: sky.liste(u).map((p) => ({ id: p.id, navn: p.navn, versjon: p.versjon, endret: new Date(p.endret).toISOString(), ...p.meta })) });
    const m = sti.match(/^\/api\/v1\/planer\/([A-Za-z0-9_-]{4,64})(?:\/([a-z]+)(?:\/([A-Za-z0-9_.-]{1,80}))?)?$/);
    if (!m) return feil(404, 'Finnes ikke', 'ukjent_sti');
    const [, pid, del, delId] = m;
    const post = sky.hent(u, pid); if (!post) return feil(404, 'Fant ikke planen', 'ukjent_plan');
    let S; try { S = pakkUt(post); } catch { return feil(500, 'Kunne ikke lese planen', 'lesefeil'); }
    const etag = { ETag: `"${post.versjon}"` };
    const finnBestand = (id) => (S.bestand || []).find((b) => b.id === id || String(b.nr) === String(id));
    const alleTiltak = () => (S.bestand || []).flatMap((b) => (b.tiltak || []).map((t) => ({ t, b })));
    // Lagrer planen som ny versjon (If-Match: versjon gir optimistisk låsing)
    const lagre = (endring) => {
      const im = String(req.headers['if-match'] || '').replace(/"/g, ''); if (im && Number(im) !== post.versjon) return { feil: 'Planen er endret siden du hentet den', status: 409 };
      S.endret = iso(); const p = pakk(S);
      const r = sky.lagre(u, pid, { ...p, navn: S.eiendom?.navn || post.navn, meta: planMeta(S), grunnVersjon: post.versjon, enhet: `api:${v.navn}`.slice(0, 40) });
      if (r.feil) return r; return { ok: true, versjon: r.versjon, endring };
    };
    const svarLagret = (r, status, obj) => (r.feil ? feil(r.status || 400, r.feil, r.status === 409 ? 'konflikt' : 'lagrefeil') : json(status, { ...obj, versjon: r.versjon }, { ETag: `"${r.versjon}"` }));
    const GET = req.method === 'GET';

    if (!del && GET) return json(200, { id: pid, versjon: post.versjon, endret: new Date(post.endret).toISOString(), plan: S }, etag);
    if (del === 'eiendom' && GET) return json(200, { type: 'Feature', geometry: S.eiendom?.grense || null, properties: { navn: S.eiendom?.navn || '', kommune: S.eiendom?.kommune || '', kommunenr: S.eiendom?.kommunenr || '', gnrbnr: S.eiendom?.gnrbnr || '', takstAar: S.eiendom?.takstAar || null } }, etag);
    if (del === 'bestand' && GET && !delId) {
      if (new URL(req.url, 'http://x').searchParams.get('format') === 'geojson') return json(200, { type: 'FeatureCollection', features: (S.bestand || []).filter((b) => b.geometri).map((b) => ({ type: 'Feature', geometry: b.geometri, properties: bestandKort(b) })) }, etag);
      return json(200, { bestand: (S.bestand || []).map(bestandKort) }, etag);
    }
    if (del === 'bestand' && GET && delId) { const b = finnBestand(delId); return b ? json(200, { bestand: b }, etag) : feil(404, 'Fant ikke bestandet', 'ukjent_bestand'); }
    if (del === 'kantsone' && GET) return json(200, { type: 'Feature', geometry: S.kantsone?.geometri || null, properties: { bredde: S.kantsone?.bredde ?? null, bred: S.kantsone?.bred ?? null, daa: S.kantsone?.daa ?? null, hentet: S.kantsone?.hentet || null, kilde: S.kantsone?.kilde || null } }, etag);
    if (del === 'skogkarakter' && GET) { const K = await import('./js/skogkarakter.js'); const r = K.beregnSkogkarakter(S); return json(200, { total: r.total, karakter: r.karakter, navn: r.navn, dekning: r.dekning, forelopig: r.forelopig, omrader: r.omrader.map((o) => ({ id: o.id, navn: o.navn, vekt: o.vekt, poeng: o.poeng, indikatorer: o.indikatorer.map((x) => ({ id: x.id, navn: x.navn, poeng: x.poeng == null ? null : Math.round(x.poeng * 100), tekst: x.tekst })) })), forbedringer: r.forbedringer.slice(0, 20).map(({ tekst: t, poeng, bestandId, tiltakId, omrade }) => ({ tekst: t, poeng, bestandId: bestandId || null, tiltakId: tiltakId || null, omrade })) }, etag); }
    if (del === 'landbrukstakst' && GET) { const LT = await import('./js/landbrukstakst.js'); const r = LT.beregnTakst(S); return json(200, { varianter: r.varianter, deler: r.deler.map(({ id, navn, gruppe, areal, metode, verdi }) => ({ id, navn, gruppe, areal: areal ?? null, metode, verdi })), sum: r.sum, priskontroll: r.priskontroll, konsesjonsplikt: r.konsesjonsplikt, merknad: 'Beregnet verdivurdering – ikke en sertifisert takst' }, etag); }

    // Tiltak
    if (del === 'tiltak' && GET && !delId) {
      const q = new URL(req.url, 'http://x').searchParams; let l = alleTiltak();
      if (q.get('status')) l = l.filter(({ t }) => (t.status || 'planlagt') === q.get('status'));
      if (q.get('aar')) l = l.filter(({ t }) => String(t.aar) === q.get('aar'));
      if (q.get('bestand')) l = l.filter(({ b }) => b.id === q.get('bestand') || String(b.nr) === q.get('bestand'));
      return json(200, { tiltak: l.map(({ t, b }) => tiltakKort(t, b)) }, etag);
    }
    if (del === 'tiltak' && GET && delId) { const x = alleTiltak().find(({ t }) => t.id === delId); return x ? json(200, { tiltak: tiltakKort(x.t, x.b) }, etag) : feil(404, 'Fant ikke tiltaket', 'ukjent_tiltak'); }
    if (del === 'tiltak' && req.method === 'POST' && !delId) {
      if (!skrive()) return; const d = await kropp(); if (!d) return feil(400, 'Ugyldig JSON', 'ugyldig_json');
      const b = finnBestand(d.bestandId || d.bestandNr); if (!b) return feil(400, 'Ukjent bestandId', 'ukjent_bestand');
      if (!TILTAKSTYPER[d.type]) return feil(400, `Ukjent tiltakstype. Gyldige: ${Object.keys(TILTAKSTYPER).join(', ')}`, 'ugyldig_type');
      const aar = Number(d.aar); if (!Number.isInteger(aar) || aar < 1990 || aar > 2200) return feil(400, 'Ugyldig år', 'ugyldig_aar');
      const t = { id: nyId('t'), type: d.type, aar, status: 'planlagt', prioritet: [1, 2, 3].includes(Number(d.prioritet)) ? Number(d.prioritet) : 2, kommentar: tekst(d.kommentar, 500), kilde: 'api', endret: iso(), ...(Number.isFinite(Number(d.arealDaa)) && d.arealDaa !== undefined ? { arealDaa: Number(d.arealDaa) } : {}) };
      b.tiltak = b.tiltak || []; b.tiltak.push(t);
      return svarLagret(lagre(`tiltak opprettet ${t.id}`), 201, { tiltak: tiltakKort(t, b) });
    }
    if (del === 'tiltak' && delId && (req.method === 'PATCH' || req.method === 'DELETE')) {
      if (!skrive()) return; const x = alleTiltak().find(({ t }) => t.id === delId); if (!x) return feil(404, 'Fant ikke tiltaket', 'ukjent_tiltak');
      if (req.method === 'DELETE') { x.b.tiltak = x.b.tiltak.filter((t) => t.id !== delId); S.slettet = { ...(S.slettet || {}), tiltak: [...new Set([...(S.slettet?.tiltak || []), delId])] }; return svarLagret(lagre(`tiltak slettet ${delId}`), 200, { slettet: delId }); }
      const d = await kropp(); if (!d) return feil(400, 'Ugyldig JSON', 'ugyldig_json'); const t = x.t;
      if (d.status !== undefined) { if (!['planlagt', 'utfort'].includes(d.status)) return feil(400, 'status må være planlagt eller utfort', 'ugyldig_status'); t.status = d.status; if (d.status === 'utfort') t.utfortDato = dato(d.utfortDato) || iso().slice(0, 10); else delete t.utfortDato; }
      else if (d.utfortDato !== undefined) t.utfortDato = dato(d.utfortDato);
      if (d.aar !== undefined) { const aar = Number(d.aar); if (!Number.isInteger(aar) || aar < 1990 || aar > 2200) return feil(400, 'Ugyldig år', 'ugyldig_aar'); t.aar = aar; }
      if (d.prioritet !== undefined) t.prioritet = [1, 2, 3].includes(Number(d.prioritet)) ? Number(d.prioritet) : t.prioritet;
      if (d.kommentar !== undefined) t.kommentar = tekst(d.kommentar, 500);
      if (d.arealDaa !== undefined) t.arealDaa = Number.isFinite(Number(d.arealDaa)) ? Number(d.arealDaa) : t.arealDaa;
      t.endret = iso();
      return svarLagret(lagre(`tiltak endret ${t.id}`), 200, { tiltak: tiltakKort(t, x.b) });
    }

    // Oppdrag
    if (del === 'oppdrag' && GET && !delId) return json(200, { oppdrag: (S.oppdrag || []).map((o) => ({ id: o.id, nr: o.nr, type: o.type, status: o.status, utforer: o.utforer?.navn || null, periode: o.periode || null, linjer: (o.linjer || []).length, endret: o.endret || null })) }, etag);
    if (del === 'oppdrag' && GET && delId) { const o = (S.oppdrag || []).find((x) => x.id === delId || x.nr === delId); return o ? json(200, { oppdrag: o }, etag) : feil(404, 'Fant ikke oppdraget', 'ukjent_oppdrag'); }
    if (del === 'oppdrag' && delId && req.method === 'PATCH') {
      if (!skrive()) return; const o = (S.oppdrag || []).find((x) => x.id === delId || x.nr === delId); if (!o) return feil(404, 'Fant ikke oppdraget', 'ukjent_oppdrag');
      const d = await kropp(); if (!d) return feil(400, 'Ugyldig JSON', 'ugyldig_json');
      if (d.status !== undefined) { if (!OPPDRAGSSTATUS[d.status]) return feil(400, `Ugyldig status. Gyldige: ${Object.keys(OPPDRAGSSTATUS).join(', ')}`, 'ugyldig_status'); o.status = d.status; }
      if (d.merknad !== undefined) o.merknad = tekst(d.merknad, 4000);
      if (d.periode !== undefined) o.periode = { fra: dato(d.periode?.fra), til: dato(d.periode?.til) };
      o.endret = iso();
      return svarLagret(lagre(`oppdrag endret ${o.id}`), 200, { oppdrag: { id: o.id, nr: o.nr, status: o.status, periode: o.periode || null } });
    }

    // Registreringer (feltobservasjoner)
    if (del === 'registreringer' && GET) return json(200, { registreringer: (S.registreringer || []).map(({ bilde, ...r }) => ({ ...r, harBilde: !!bilde })) }, etag);
    if (del === 'registreringer' && req.method === 'POST') {
      if (!skrive()) return; const d = await kropp(); if (!d) return feil(400, 'Ugyldig JSON', 'ugyldig_json');
      const lat = Number(d.lat); const lon = Number(d.lon); if (!(lat > 57 && lat < 72 && lon > 3 && lon < 32)) return feil(400, 'lat/lon må være i Norge (WGS84)', 'ugyldig_posisjon');
      const r = { id: nyId('r'), dato: iso(), kategori: tekst(d.kategori || 'Observasjon', 60), tekst: tekst(d.tekst, 2000), lat, lon, bestandId: finnBestand(d.bestandId)?.id || null, kilde: 'api', endret: iso() };
      S.registreringer = [r, ...(S.registreringer || [])];
      return svarLagret(lagre(`registrering ${r.id}`), 201, { registrering: r });
    }
    return feil(405, 'Metoden er ikke støttet her', 'metode');
  })().catch((e) => { try { feil(500, 'Serverfeil', 'serverfeil'); } catch { /* svaret er sendt */ } console.error('api/v1:', e.message); });
  return true;
}

// Admin: /api/admin/apinokler – liste, opprette og trekke tilbake nøkler, og se loggen. erAdmin(req) → brukernavn | null.
export function apiNoklerAdmin({ nokler, admin, brukere, cors = () => ({}) }, req, res, sti, ekstraHoder = {}) {
  if (sti !== '/api/admin/apinokler' && !sti.startsWith('/api/admin/apinokler/')) return false;
  const json = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req), ...ekstraHoder }); res.end(JSON.stringify(obj)); };
  const a = admin(req); if (!a) { json(a === null ? 401 : 403, { feil: 'Bare for administrator' }); return true; }
  const kropp = () => new Promise((ok) => { const d = []; req.on('data', (b) => d.push(b)); req.on('end', () => { try { ok(JSON.parse(Buffer.concat(d).toString('utf8') || '{}')); } catch { ok(null); } }); });
  (async () => {
    if (sti === '/api/admin/apinokler' && req.method === 'GET') return json(200, { nokler: nokler.liste(), logg: nokler.sisteLogg(150), brukere: brukere() });
    if (sti === '/api/admin/apinokler' && req.method === 'POST') {
      const d = await kropp(); if (!d) return json(400, { feil: 'Ugyldig JSON' });
      if (!brukere().some((b) => b.bruker === String(d.bruker || '').toLowerCase())) return json(400, { feil: 'Ukjent bruker' });
      const r = nokler.opprett({ bruker: d.bruker, navn: d.navn, tilgang: d.tilgang, av: a }); return r.feil ? json(r.status, { feil: r.feil }) : json(201, r);
    }
    const m = sti.match(/^\/api\/admin\/apinokler\/([0-9a-f]{10})$/);
    if (m && req.method === 'DELETE') { const r = nokler.trekk(m[1]); return r.feil ? json(r.status, { feil: r.feil }) : json(200, r); }
    return json(405, { feil: 'Metoden er ikke tillatt' });
  })().catch(() => json(500, { feil: 'Serverfeil' }));
  return true;
}
