// Innlogging for SkogIQ.ai på serveren: brukernavn og passord fra miljøvariabler (APP_BRUKER, APP_PASSORD – aldri i
// koden), signert økt (HMAC) i en HttpOnly-informasjonskapsel, og samme økt som Bearer-token for appen på GitHub Pages
// (annen adresse, informasjonskapselen følger ikke med). Uten APP_BRUKER/APP_PASSORD er innloggingen av.
// Bare Node sitt standardbibliotek.
import { createHmac, createHash, timingSafeEqual, randomBytes } from 'node:crypto';

export const OKT_NAVN = 'skogiq_okt';
const DAG = 24 * 3600 * 1000;
const b64 = (s) => Buffer.from(s).toString('base64url');
const lik = (a, b) => timingSafeEqual(createHash('sha256').update(String(a)).digest(), createHash('sha256').update(String(b)).digest());

export function lagInnlogging({ bruker = '', passord = '', hemmelighet = '', dager = 30, naa = () => Date.now() } = {}) {
  const aktiv = !!(bruker && passord);
  // Uten egen hemmelighet avledes den av brukernavn og passord: nytt passord gjør gamle økter ugyldige.
  const nokkel = hemmelighet || createHash('sha256').update(`skogiq|${bruker}|${passord}`).digest('hex');
  const signer = (data) => createHmac('sha256', nokkel).update(data).digest('base64url');
  const feil = new Map(); // ip → [tidspunkter for feil passord]
  return {
    aktiv,
    lagToken(u = bruker) { const data = b64(JSON.stringify({ u, exp: naa() + dager * DAG, n: randomBytes(6).toString('hex') })); return `${data}.${signer(data)}`; },
    lesToken(t) {
      if (typeof t !== 'string' || !t.includes('.')) return null;
      const [data, sig] = t.split('.');
      if (!sig || !lik(sig, signer(data))) return null;
      try { const o = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')); return o.exp > naa() && o.u === bruker ? o : null; } catch { return null; }
    },
    // Høyst 10 feil passord per IP-adresse på 15 minutter.
    sperret(ip) { const t = naa(); const l = (feil.get(ip) || []).filter((x) => t - x < 15 * 60000); feil.set(ip, l); return l.length >= 10; },
    sjekk(ip, b, p) {
      if (this.sperret(ip)) return { ok: false, sperret: true };
      const ok = aktiv && lik(String(b || '').trim().toLowerCase(), bruker.toLowerCase()) && lik(String(p || ''), passord);
      if (!ok) { feil.get(ip).push(naa()); if (feil.size > 10000) feil.delete(feil.keys().next().value); }
      return { ok };
    },
    fraForesporsel(req) {
      const a = req.headers.authorization || ''; if (a.startsWith('Bearer ')) return this.lesToken(a.slice(7).trim());
      const c = String(req.headers.cookie || '').split(/;\s*/).find((x) => x.startsWith(`${OKT_NAVN}=`));
      return c ? this.lesToken(decodeURIComponent(c.slice(OKT_NAVN.length + 1))) : null;
    },
    dager,
  };
}

// Det som kan hentes uten innlogging: innloggingssiden, helsesjekken, ikoner og manifester (lastes uten
// informasjonskapsel når appen installeres).
const APENT = /^\/(logginn\.html|js\/innlogging\.js|healthz|api\/logginn|api\/meg|icon\.svg|ikon-[\w-]+\.png|manifest\.webmanifest|felt\.webmanifest|favicon\.ico)$/;
const TILLATT_OPPHAV = /^(https:\/\/(skogiq-production\.up\.railway\.app|trond-web\.github\.io)|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
export const corsFor = (req) => { const o = req.headers.origin; return o && TILLATT_OPPHAV.test(o) ? { 'Access-Control-Allow-Origin': o, Vary: 'Origin' } : {}; };
const ip = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '?';
const kapsel = (req, verdi, maxAlder) => `${OKT_NAVN}=${encodeURIComponent(verdi)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAlder}${req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`;

// /api/logginn, /api/loggut og /api/meg. Gir true når forespørselen er håndtert.
export function innloggingApi(inn, req, res, sti, ekstraHoder = {}) {
  if (!['/api/logginn', '/api/loggut', '/api/meg'].includes(sti)) return false;
  const json = (status, obj, hoder = {}) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...corsFor(req), ...ekstraHoder, ...hoder }); res.end(JSON.stringify(obj)); };
  if (sti === '/api/meg') { const o = inn.fraForesporsel(req); return json(inn.aktiv && !o ? 401 : 200, { aktiv: inn.aktiv, bruker: o?.u || null, utloper: o?.exp || null }), true; }
  if (req.method !== 'POST') return json(405, { feil: 'Metoden er ikke tillatt' }), true;
  if (sti === '/api/loggut') return json(200, { ok: true }, { 'Set-Cookie': kapsel(req, '', 0) }), true;
  let len = 0; const deler = [];
  req.on('data', (d) => { len += d.length; if (len > 4096) req.destroy(); else deler.push(d); });
  req.on('end', () => {
    let b = {}; try { b = JSON.parse(Buffer.concat(deler).toString('utf8') || '{}'); } catch { /* tom */ }
    if (!inn.aktiv) return json(200, { aktiv: false, token: null });
    const r = inn.sjekk(ip(req), b.bruker, b.passord);
    if (r.sperret) return json(429, { feil: 'For mange forsøk – vent 15 minutter' });
    if (!r.ok) return json(401, { feil: 'Feil brukernavn eller passord' });
    const token = inn.lagToken();
    json(200, { token, utloper: Date.now() + inn.dager * DAG }, { 'Set-Cookie': kapsel(req, token, inn.dager * 86400) });
  });
  return true;
}

// Stopper forespørsler uten gyldig økt. Sider sendes til innloggingen, alt annet får 401. Gir true når stoppet.
export function krevInnlogging(inn, req, res, sti, ekstraHoder = {}) {
  if (!inn.aktiv || req.method === 'OPTIONS' || APENT.test(sti) || inn.fraForesporsel(req)) return false;
  const side = req.method === 'GET' && /text\/html/.test(req.headers.accept || '') && !sti.startsWith('/api/');
  if (side || (req.method === 'GET' && sti.startsWith('/api/jd/') && /text\/html/.test(req.headers.accept || ''))) {
    const neste = new URL(req.url, 'http://x'); res.writeHead(302, { Location: `/logginn.html?neste=${encodeURIComponent(neste.pathname + neste.search)}`, 'Cache-Control': 'no-store', ...ekstraHoder }); res.end(); return true;
  }
  res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...corsFor(req), ...ekstraHoder }); res.end(JSON.stringify({ feil: 'Logg inn i SkogIQ.ai', innlogging: true })); return true;
}
