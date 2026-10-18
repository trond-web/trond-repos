// Overføring og synkronisering av skogbruksplaner mellom enheter (fullversjonen på PC ↔ SkogIQ Felt på mobilen).
// En plan lastes opp komprimert (gzip, base64) og får en hemmelig synk-id (32 hex). En kort kode (6 tegn, 15 min)
// lar en annen enhet hente planen uten å skrive inn id-en. Deretter synkroniserer enhetene med id-en og et
// versjonsnummer: den som sender med feil grunnversjon, får 409 og den nyeste planen tilbake for fletting.
// Serveren er et mellomlager, ikke et arkiv: enhetene har alltid sin egen kopi. Planer slettes etter 90 dager uten
// bruk, og en ukjent id som sendes med en plan, opprettes på nytt (f.eks. etter at serveren er startet på nytt).
// Bare Node sitt standardbibliotek. Data i minnet, og i en fil når PLAN_FIL er satt.
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { KODE_TEGN, normKode } from './kontroller-relay.js';

export const PLAN_KODE_MS = 15 * 60 * 1000;
export const PLAN_TTL_MS = 90 * 24 * 3600 * 1000;
export const MAKS_PLAN = 25 * 1024 * 1024; // byte base64
export const MAKS_PLANER = 5000;

const lagKode = () => [...randomBytes(6)].map((x) => KODE_TEGN[x % KODE_TEGN.length]).join('');
const gyldigId = (id) => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id);

export function lagPlanRelay({ fil = null, naa = () => Date.now() } = {}) {
  let data = { planer: {} };
  if (fil) { try { data = JSON.parse(readFileSync(fil, 'utf8')); } catch { /* ny */ } }
  let timer = null;
  const lagre = () => { if (!fil) return; clearTimeout(timer); timer = setTimeout(() => { try { writeFileSync(fil, JSON.stringify(data)); } catch { /* ignorer */ } }, 1000); };
  const rydd = () => {
    const t = naa();
    for (const [id, p] of Object.entries(data.planer)) if (t - p.brukt > PLAN_TTL_MS) delete data.planer[id];
    const ider = Object.keys(data.planer);
    if (ider.length > MAKS_PLANER) ider.sort((a, b) => data.planer[a].brukt - data.planer[b].brukt).slice(0, ider.length - MAKS_PLANER).forEach((id) => delete data.planer[id]);
  };
  const sjekk = (plan) => {
    if (typeof plan !== 'string' || !plan.length) return { feil: 'Mangler plan', status: 400 };
    if (plan.length > MAKS_PLAN) return { feil: 'Planen er for stor', status: 413 };
    if (!/^[A-Za-z0-9+/=]+$/.test(plan.slice(0, 2000))) return { feil: 'Ugyldig plan', status: 400 };
    return null;
  };
  const nyKode = (p) => { let k; do { k = lagKode(); } while (Object.values(data.planer).some((x) => x.kode === k && x.kodeTil > naa())); p.kode = k; p.kodeTil = naa() + PLAN_KODE_MS; return k; };
  const info = (id, p) => ({ id, versjon: p.versjon, endret: p.endret, navn: p.navn, enhet: p.enhet, storrelse: p.plan.length });
  return {
    // Ny plan (eller ny versjon av en kjent): { plan, navn, enhet, id?, grunnVersjon? }
    send({ id = null, plan, navn = '', enhet = '', grunnVersjon = null, gzip = true } = {}) {
      const f = sjekk(plan); if (f) return f;
      rydd();
      let p = gyldigId(id) ? data.planer[id] : null;
      // grunnVersjon 0 = «last opp på nytt»: finnes planen allerede (den andre enheten var først), må den flettes.
      if (p && grunnVersjon != null && grunnVersjon !== p.versjon) return { feil: 'Planen er endret på en annen enhet', status: 409, gjeldende: info(id, p) };
      if (!p) { if (!gyldigId(id)) id = randomBytes(16).toString('hex'); p = data.planer[id] = { versjon: 0, laget: naa() }; }
      Object.assign(p, { plan, gzip: !!gzip, navn: String(navn).slice(0, 120), enhet: String(enhet).slice(0, 40), versjon: p.versjon + 1, endret: naa(), brukt: naa() });
      lagre();
      return info(id, p);
    },
    kode(id) { const p = gyldigId(id) ? data.planer[id] : null; if (!p) return null; const kode = nyKode(p); p.brukt = naa(); lagre(); return { kode, utloper: p.kodeTil }; },
    // Koden kan brukes flere ganger mens den er gyldig (flere mobiler kan hente samme plan).
    kobl(kode) { const n = normKode(kode); if (n.length !== 6) return null; const f = Object.entries(data.planer).find(([, p]) => p.kode === n && p.kodeTil > naa()); return f ? { id: f[0] } : null; },
    hent(id) { const p = gyldigId(id) ? data.planer[id] : null; if (!p) return null; p.brukt = naa(); return { ...info(id, p), plan: p.plan, gzip: p.gzip }; },
    info(id) { const p = gyldigId(id) ? data.planer[id] : null; return p ? info(id, p) : null; },
    slett(id) { if (!data.planer[id]) return false; delete data.planer[id]; lagre(); return true; },
  };
}

// HTTP: /api/plan… – gir true når forespørselen er håndtert.
const TILLATT_OPPHAV = /^(https:\/\/(skogiq-production\.up\.railway\.app|trond-web\.github\.io)|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
export function planApi(relay, req, res, sti, ekstraHoder = {}) {
  if (!sti.startsWith('/api/plan')) return false;
  const opphav = req.headers.origin;
  const cors = opphav && TILLATT_OPPHAV.test(opphav) ? { 'Access-Control-Allow-Origin': opphav, 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : {};
  const json = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors, ...ekstraHoder }); res.end(JSON.stringify(obj)); };
  if (req.method === 'OPTIONS') { res.writeHead(204, { ...cors, 'Access-Control-Max-Age': '600' }); res.end(); return true; }
  const kropp = () => new Promise((ok) => {
    let n = 0; const deler = [];
    req.on('data', (d) => { n += d.length; if (n > MAKS_PLAN + 100000) { req.destroy(); ok(null); } else deler.push(d); });
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(deler).toString('utf8') || '{}')); } catch { ok(null); } });
    req.on('error', () => ok(null));
  });
  (async () => {
    if (sti === '/api/plankobling' && req.method === 'POST') { const b = await kropp(); const r = b && relay.kobl(b.kode); return r ? json(200, r) : json(404, { feil: 'Koden er ukjent eller utløpt. Lag en ny kode på PC-en.' }); }
    const m = sti.match(/^\/api\/plan(?:\/([a-f0-9]{32}))?(\/kode|\/info)?$/);
    if (!m) return json(404, { feil: 'Finnes ikke' });
    const [, id, del] = m;
    if (!id && req.method === 'POST') { const b = await kropp(); if (!b) return json(400, { feil: 'Ugyldig forespørsel' }); const r = relay.send({ ...b, id: null }); return r.feil ? json(r.status, r) : json(200, r); }
    if (id && !del && req.method === 'PUT') { const b = await kropp(); if (!b) return json(400, { feil: 'Ugyldig forespørsel' }); const r = relay.send({ ...b, id }); return r.feil ? json(r.status, r) : json(200, r); }
    if (id && !del && req.method === 'GET') { const r = relay.hent(id); return r ? json(200, r) : json(404, { feil: 'Planen finnes ikke på serveren' }); }
    if (id && del === '/info' && req.method === 'GET') { const r = relay.info(id); return r ? json(200, r) : json(404, { feil: 'Planen finnes ikke på serveren' }); }
    if (id && del === '/kode' && req.method === 'POST') { const r = relay.kode(id); return r ? json(200, r) : json(404, { feil: 'Planen finnes ikke på serveren' }); }
    if (id && !del && req.method === 'DELETE') return relay.slett(id) ? json(200, { ok: true }) : json(404, { feil: 'Finnes ikke' });
    return json(405, { feil: 'Metoden er ikke tillatt' });
  })().catch(() => json(500, { feil: 'Serverfeil' }));
  return true;
}
