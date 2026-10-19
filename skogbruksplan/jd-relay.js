// Mellomledd til John Deere Operations Center (MyJohnDeere API) for SkogIQ.ai. Klienthemmeligheten og brukernes
// tokens ligger bare på serveren; nettleseren har en tilfeldig nøkkel (32 hex) som peker til tilkoblingen sin.
//
// Oppsett (miljøvariabler på serveren, se README):
//   JD_CLIENT_ID, JD_CLIENT_SECRET  – fra applikasjonen på developer.deere.com
//   JD_REDIRECT                     – https://<server>/api/jd/callback (registreres som «Redirect URI» hos Deere)
//   JD_API                          – https://sandboxapi.deere.com/platform (sandkasse, standard) eller
//                                     https://partnerapi.deere.com/platform når appen er godkjent for produksjon
//   JD_FIL                          – valgfri fil for å huske tilkoblingene mellom omstarter
// Flyt: /api/jd/logginn → John Deere-innlogging → /api/jd/callback (kode byttes mot token) → tilbake til appen. Har ikke
// appen tilgang til organisasjonen ennå, sendes brukeren videre til Deeres «connections»-side for å gi tilgang.
// Bare Node sitt standardbibliotek.
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export const JD_WELL_KNOWN = 'https://signin.johndeere.com/oauth2/aus78tnlaysMraFhC1t7/.well-known/oauth-authorization-server';
export const JD_SANDKASSE = 'https://sandboxapi.deere.com/platform';
export const JD_SCOPE = 'openid profile offline_access ag1 ag2 ag3 org1 org2 files';
const AXIOM = 'application/vnd.deere.axiom.v3+json';
const MAKS_FIL = 30 * 1024 * 1024;
const gyldigNokkel = (n) => typeof n === 'string' && /^[a-f0-9]{32}$/.test(n);
const gyldigId = (v) => typeof v === 'string' && /^[\w.-]{1,80}$/.test(v);

export function lagJdRelay({ klientId = '', hemmelighet = '', tilbakeUrl = '', api = JD_SANDKASSE, wellKnown = JD_WELL_KNOWN, scope = JD_SCOPE, fil = null, hent = (u, o) => fetch(u, o), naa = () => Date.now() } = {}) {
  let data = { tilkoblinger: {} };
  if (fil) { try { data = JSON.parse(readFileSync(fil, 'utf8')); } catch { /* ny */ } }
  const ventende = new Map(); // state → { nokkel, tilbake, tid }
  let oppdagelse = null;
  const lagre = () => { if (fil) { try { writeFileSync(fil, JSON.stringify(data)); } catch { /* ignorer */ } } };
  const konfigurert = () => !!(klientId && hemmelighet && tilbakeUrl);
  async function endepunkter() {
    if (oppdagelse) return oppdagelse;
    const r = await hent(wellKnown, { headers: { Accept: 'application/json' } }); if (!r.ok) throw new Error(`John Deere-innlogging svarte ${r.status}`);
    oppdagelse = await r.json(); return oppdagelse;
  }
  async function tokenKall(skjema) {
    const ep = await endepunkter();
    const r = await hent(ep.token_endpoint, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${klientId}:${hemmelighet}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams(skjema).toString() });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.access_token) { const f = new Error(d.error_description || d.error || `Token-feil ${r.status}`); f.status = 401; throw f; }
    return d;
  }
  const lagreToken = (nokkel, d, gammel = {}) => { data.tilkoblinger[nokkel] = { access: d.access_token, refresh: d.refresh_token || gammel.refresh, utloper: naa() + (Number(d.expires_in) || 3600) * 1000, laget: gammel.laget || naa(), brukt: naa() }; lagre(); };
  async function token(nokkel) {
    const t = gyldigNokkel(nokkel) ? data.tilkoblinger[nokkel] : null;
    if (!t) { const f = new Error('Ikke koblet til John Deere'); f.status = 401; throw f; }
    if (t.utloper - naa() > 60000) { t.brukt = naa(); return t.access; }
    if (!t.refresh) { delete data.tilkoblinger[nokkel]; lagre(); const f = new Error('Tilkoblingen er utløpt – koble til John Deere på nytt'); f.status = 401; throw f; }
    try { lagreToken(nokkel, await tokenKall({ grant_type: 'refresh_token', refresh_token: t.refresh, redirect_uri: tilbakeUrl, scope }), t); } catch (e) { delete data.tilkoblinger[nokkel]; lagre(); throw e; }
    return data.tilkoblinger[nokkel].access;
  }
  // Kall mot API-et. sti kan være relativ (/organizations) eller en full lenke fra et tidligere svar (samme vert).
  async function kall(nokkel, sti, { metode = 'GET', kropp, type, accept = AXIOM, hoder = {} } = {}) {
    const url = /^https:\/\//.test(sti) ? sti : `${api}${sti}`;
    if (new URL(url).host !== new URL(api).host) throw new Error('Ugyldig adresse');
    const r = await hent(url, { method: metode, redirect: 'follow', headers: { Authorization: `Bearer ${await token(nokkel)}`, Accept: accept, ...(type ? { 'Content-Type': type } : {}), ...hoder }, body: kropp });
    if (r.status === 401 || r.status === 403) { const f = new Error(r.status === 403 ? 'John Deere nekter tilgang – gi SkogIQ tilgang til organisasjonen i Operations Center' : 'Ikke koblet til John Deere'); f.status = r.status; throw f; }
    return r;
  }
  async function json(nokkel, sti, o) { const r = await kall(nokkel, sti, o); if (!r.ok) { const f = new Error(`John Deere svarte ${r.status}`); f.status = 502; throw f; } return r.json(); }
  // Alle sider av en liste (lenken «nextPage»), maks 20 sider.
  async function alle(nokkel, sti) {
    const ut = []; let neste = sti;
    for (let i = 0; neste && i < 20; i++) { const d = await json(nokkel, neste); ut.push(...(d.values || [])); neste = (d.links || []).find((l) => l.rel === 'nextPage')?.uri || null; }
    return ut;
  }
  return {
    konfigurert, api,
    status(nokkel) { return { konfigurert: konfigurert(), tilkoblet: !!(gyldigNokkel(nokkel) && data.tilkoblinger[nokkel]), miljo: /sandbox/.test(api) ? 'sandkasse' : 'produksjon' }; },
    async startInnlogging(nokkel, tilbake) {
      if (!konfigurert()) { const f = new Error('John Deere er ikke satt opp på serveren (JD_CLIENT_ID, JD_CLIENT_SECRET og JD_REDIRECT)'); f.status = 503; throw f; }
      if (!gyldigNokkel(nokkel)) { const f = new Error('Ugyldig nøkkel'); f.status = 400; throw f; }
      for (const [k, v] of ventende) if (naa() - v.tid > 15 * 60000) ventende.delete(k);
      const state = randomBytes(16).toString('hex'); ventende.set(state, { nokkel, tilbake, tid: naa() });
      const ep = await endepunkter();
      return `${ep.authorization_endpoint}?${new URLSearchParams({ response_type: 'code', client_id: klientId, redirect_uri: tilbakeUrl, scope, state })}`;
    },
    // Gir adressen brukeren sendes videre til: Deeres «connections»-side hvis appen mangler tilgang, ellers appen.
    async callback(code, state) {
      const v = ventende.get(state); ventende.delete(state);
      if (!v || !code) { const f = new Error('Innloggingen er utløpt eller ugyldig – prøv igjen'); f.status = 400; throw f; }
      lagreToken(v.nokkel, await tokenKall({ grant_type: 'authorization_code', code, redirect_uri: tilbakeUrl }));
      const tilbake = `${v.tilbake}${v.tilbake.includes('?') ? '&' : '?'}jd=tilkoblet`;
      try {
        const org = await json(v.nokkel, '/organizations');
        const c = (org.values || []).flatMap((o) => o.links || []).find((l) => l.rel === 'connections');
        if (c) return `${c.uri}?${new URLSearchParams({ redirect_uri: tilbake })}`;
      } catch { /* går tilbake til appen uansett */ }
      return tilbake;
    },
    loggUt(nokkel) { if (gyldigNokkel(nokkel) && data.tilkoblinger[nokkel]) { delete data.tilkoblinger[nokkel]; lagre(); } return true; },
    async organisasjoner(nokkel) { return (await alle(nokkel, '/organizations')).map((o) => ({ id: String(o.id), navn: o.name, tilgang: !(o.links || []).some((l) => l.rel === 'connections') })); },
    async skifter(nokkel, org) { return (await alle(nokkel, `/organizations/${encodeURIComponent(org)}/fields`)).map((f) => ({ id: String(f.id), navn: f.name })); },
    async operasjoner(nokkel, org, felt, aar) {
      const q = new URLSearchParams({ startDate: `${aar}-01-01T00:00:00.000Z`, endDate: `${aar}-12-31T23:59:59.999Z` });
      return (await alle(nokkel, `/organizations/${encodeURIComponent(org)}/fields/${encodeURIComponent(felt)}/fieldOperations?${q}`)).map((o) => ({ id: String(o.id), type: o.fieldOperationType, start: o.startDate, slutt: o.endDate, avling: o.cropName || null, produkter: (o.products || o.varieties || []).map((p) => p.name).filter(Boolean) }));
    },
    // Shapefile (ZIP) av en operasjon, metrisk. 202 = Deere lager fila ennå (prøv igjen om litt).
    async operasjonFil(nokkel, id) {
      const r = await kall(nokkel, `/fieldOps/${encodeURIComponent(id)}`, { accept: 'application/zip', hoder: { 'Accept-UOM-System': 'METRIC' } });
      if (r.status === 202) return { venter: true };
      if (!r.ok) { const f = new Error(`John Deere svarte ${r.status}`); f.status = 502; throw f; }
      return { data: Buffer.from(await r.arrayBuffer()) };
    },
    // Laster opp en fil (ZIP) til Filer i organisasjonen. Derfra sendes den trådløst til skjermen (Data Sync / Send til maskin).
    async lastOppFil(nokkel, org, navn, bytes) {
      const r = await kall(nokkel, `/organizations/${encodeURIComponent(org)}/files`, { metode: 'POST', type: AXIOM, kropp: JSON.stringify({ name: navn }) });
      if (r.status !== 201) { const f = new Error(`John Deere svarte ${r.status} da fila skulle opprettes`); f.status = 502; throw f; }
      const lenke = r.headers.get('location'); const id = lenke?.split('/').pop();
      if (!lenke || !id) { const f = new Error('John Deere ga ingen adresse for fila'); f.status = 502; throw f; }
      const p = await kall(nokkel, lenke, { metode: 'PUT', type: 'application/zip', kropp: bytes, accept: AXIOM });
      if (!p.ok) { const f = new Error(`John Deere svarte ${p.status} på opplastingen`); f.status = 502; throw f; }
      return { id };
    },
  };
}

// HTTP: /api/jd/… – gir true når forespørselen er håndtert.
const TILLATT_OPPHAV = /^(https:\/\/(skogiq-production\.up\.railway\.app|trond-web\.github\.io)|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
const tillattTilbake = (u) => { try { const x = new URL(u); return TILLATT_OPPHAV.test(x.origin); } catch { return false; } };
export function jdApi(relay, req, res, sti, ekstraHoder = {}) {
  if (!sti.startsWith('/api/jd/')) return false;
  const opphav = req.headers.origin;
  const cors = opphav && TILLATT_OPPHAV.test(opphav) ? { 'Access-Control-Allow-Origin': opphav, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Expose-Headers': 'X-JD-Venter', Vary: 'Origin' } : {};
  const json = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors, ...ekstraHoder }); res.end(JSON.stringify(obj)); };
  const videre = (url) => { res.writeHead(302, { Location: url, 'Cache-Control': 'no-store', ...ekstraHoder }); res.end(); };
  if (req.method === 'OPTIONS') { res.writeHead(204, { ...cors, 'Access-Control-Max-Age': '600' }); res.end(); return true; }
  const q = new URL(req.url, 'http://x').searchParams; const n = q.get('n');
  const kropp = () => new Promise((ok) => { let len = 0; const deler = []; req.on('data', (d) => { len += d.length; if (len > MAKS_FIL) { req.destroy(); ok(null); } else deler.push(d); }); req.on('end', () => ok(Buffer.concat(deler))); req.on('error', () => ok(null)); });
  (async () => {
    if (sti === '/api/jd/status') return json(200, relay.status(n));
    if (sti === '/api/jd/logginn') {
      const tilbake = q.get('tilbake') || '';
      if (!tillattTilbake(tilbake)) return json(400, { feil: 'Ugyldig tilbake-adresse' });
      return videre(await relay.startInnlogging(n, tilbake));
    }
    if (sti === '/api/jd/callback') {
      if (q.get('error')) return json(400, { feil: `John Deere: ${q.get('error_description') || q.get('error')}` });
      return videre(await relay.callback(q.get('code'), q.get('state')));
    }
    if (sti === '/api/jd/loggut' && req.method === 'POST') return json(200, { ok: relay.loggUt(n) });
    const org = q.get('org'); const felt = q.get('felt');
    if (sti === '/api/jd/organisasjoner') return json(200, await relay.organisasjoner(n));
    if (sti === '/api/jd/skifter') { if (!gyldigId(org)) return json(400, { feil: 'Mangler organisasjon' }); return json(200, await relay.skifter(n, org)); }
    if (sti === '/api/jd/operasjoner') { const aar = Number(q.get('aar')); if (!gyldigId(org) || !gyldigId(felt) || !(aar > 2000 && aar < 2100)) return json(400, { feil: 'Ugyldig forespørsel' }); return json(200, await relay.operasjoner(n, org, felt, aar)); }
    if (sti === '/api/jd/operasjon') {
      const id = q.get('id'); if (!gyldigId(id)) return json(400, { feil: 'Ugyldig id' });
      const r = await relay.operasjonFil(n, id);
      if (r.venter) { res.writeHead(202, { 'Content-Type': 'application/json; charset=utf-8', 'X-JD-Venter': '1', 'Cache-Control': 'no-store', ...cors, ...ekstraHoder }); return res.end(JSON.stringify({ venter: true })); }
      res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': r.data.length, 'Cache-Control': 'no-store', ...cors, ...ekstraHoder }); return res.end(r.data);
    }
    if (sti === '/api/jd/fil' && req.method === 'POST') {
      const navn = String(q.get('navn') || 'SkogIQ.zip').replace(/[^\w. -]/g, '_').slice(0, 80);
      if (!gyldigId(org)) return json(400, { feil: 'Mangler organisasjon' });
      const b = await kropp(); if (!b || !b.length) return json(413, { feil: 'Fila mangler eller er for stor' });
      if (b[0] !== 0x50 || b[1] !== 0x4b) return json(400, { feil: 'Fila må være en ZIP-fil' });
      return json(200, await relay.lastOppFil(n, org, navn, b));
    }
    return json(404, { feil: 'Finnes ikke' });
  })().catch((e) => json(e.status || 500, { feil: e.message || 'Serverfeil' }));
  return true;
}
