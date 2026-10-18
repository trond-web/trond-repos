// Overføring av droneoppdrag fra SkogIQ Felt (telefonen) til fjernkontrollen (DJI RC Plus / RC Pro Enterprise).
// Kontrollersiden (kontroller.html) får en hemmelig id og en kort koblingskode. Telefonen skriver inn koden én gang og
// får id-en; deretter sender den ruter (KMZ) dit med ett trykk, og kontrollersiden henter dem automatisk.
// Bare Node sitt standardbibliotek. Data holdes i minnet (og lagres i en fil når KONTROLLER_FIL er satt) – oppdrag
// slettes etter 14 dager. Dette er et mellomlager for overføring, ikke et arkiv.
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export const KODE_TEGN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // uten 0/O, 1/I
export const KODE_GYLDIG_MS = 15 * 60 * 1000;
export const OPPDRAG_TTL_MS = 14 * 24 * 3600 * 1000;
export const MAKS_KMZ = 3 * 1024 * 1024; // byte
export const MAKS_OPPDRAG = 30;

const lagKode = () => { const b = randomBytes(6); return [...b].map((x) => KODE_TEGN[x % KODE_TEGN.length]).join(''); };
export const normKode = (k) => String(k || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function lagRelay({ fil = null, naa = () => Date.now() } = {}) {
  let data = { kontrollere: {} };
  if (fil) { try { data = JSON.parse(readFileSync(fil, 'utf8')); } catch { /* ny */ } }
  let lagreTimer = null;
  const lagre = () => { if (!fil) return; clearTimeout(lagreTimer); lagreTimer = setTimeout(() => { try { writeFileSync(fil, JSON.stringify(data)); } catch { /* ignorer */ } }, 500); };
  const rydd = () => {
    const t = naa();
    for (const [id, k] of Object.entries(data.kontrollere)) {
      k.oppdrag = (k.oppdrag || []).filter((o) => t - o.sendt < OPPDRAG_TTL_MS);
      if (!k.oppdrag.length && t - (k.sist || k.opprettet) > OPPDRAG_TTL_MS * 4) delete data.kontrollere[id];
    }
  };
  const k = (id) => (typeof id === 'string' && /^[a-f0-9]{32}$/.test(id) ? data.kontrollere[id] : null);
  const nyKode = (kt) => {
    let kode; do { kode = lagKode(); } while (Object.values(data.kontrollere).some((x) => x.kode === kode && x.kodeTil > naa()));
    kt.kode = kode; kt.kodeTil = naa() + KODE_GYLDIG_MS; return kode;
  };
  const meta = (o) => ({ oid: o.oid, navn: o.navn, info: o.info, sendt: o.sendt, hentet: o.hentet || null, status: o.status || 'sendt', storrelse: o.storrelse });

  return {
    // Kontrollersiden: ny kontroller (eller ny kode for en kjent).
    registrer(id = null) {
      rydd();
      let kt = k(id);
      if (!kt) { id = randomBytes(16).toString('hex'); kt = data.kontrollere[id] = { opprettet: naa(), oppdrag: [], telefoner: 0 }; }
      const kode = nyKode(kt); kt.sist = naa(); lagre();
      return { id, kode, utloper: kt.kodeTil, telefoner: kt.telefoner, oppdrag: kt.oppdrag.map(meta) };
    },
    // Telefonen: bytt koden mot kontrollerens id. Koden kan brukes én gang.
    kobl(kode) {
      const n = normKode(kode); if (n.length !== 6) return null;
      const funnet = Object.entries(data.kontrollere).find(([, x]) => x.kode === n && x.kodeTil > naa());
      if (!funnet) return null;
      const [id, kt] = funnet; kt.kode = null; kt.kodeTil = 0; kt.telefoner = (kt.telefoner || 0) + 1; kt.sist = naa(); lagre();
      return { id };
    },
    liste(id) { const kt = k(id); if (!kt) return null; kt.sist = naa(); return kt.oppdrag.map(meta); },
    send(id, { navn, info = {}, kmz }) {
      const kt = k(id); if (!kt) return { feil: 'Ukjent kontroller', status: 404 };
      let buf; try { buf = Buffer.from(String(kmz || ''), 'base64'); } catch { buf = null; }
      if (!buf || buf.length < 22 || buf[0] !== 0x50 || buf[1] !== 0x4b) return { feil: 'Ugyldig KMZ', status: 400 };
      if (buf.length > MAKS_KMZ) return { feil: 'Ruten er for stor', status: 413 };
      rydd();
      const o = { oid: randomBytes(8).toString('hex'), navn: String(navn || 'Droneoppdrag').slice(0, 80), info: JSON.parse(JSON.stringify(info || {}).slice(0, 2000) || '{}'), sendt: naa(), kmz: buf.toString('base64'), storrelse: buf.length };
      kt.oppdrag = [o, ...kt.oppdrag].slice(0, MAKS_OPPDRAG); kt.sist = naa(); lagre();
      return { oid: o.oid };
    },
    hent(id, oid) {
      const kt = k(id); const o = kt?.oppdrag.find((x) => x.oid === oid); if (!o) return null;
      if (!o.hentet) { o.hentet = naa(); o.status = 'hentet'; lagre(); }
      return { navn: o.navn, data: Buffer.from(o.kmz, 'base64') };
    },
    status(id, oid, status) {
      const kt = k(id); const o = kt?.oppdrag.find((x) => x.oid === oid); if (!o || !['sendt', 'hentet', 'importert', 'flydd'].includes(status)) return false;
      o.status = status; lagre(); return true;
    },
    slett(id, oid) { const kt = k(id); if (!kt) return false; const f = kt.oppdrag.length; kt.oppdrag = kt.oppdrag.filter((x) => x.oid !== oid); lagre(); return kt.oppdrag.length < f; },
  };
}

// HTTP: /api/kontroller… – gir true når forespørselen er håndtert.
const TILLATT_OPPHAV = /^(https:\/\/(skogiq-production\.up\.railway\.app|trond-web\.github\.io)|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
export function kontrollerApi(relay, req, res, sti, ekstraHoder = {}) {
  if (!sti.startsWith('/api/kontroller') && sti !== '/api/kobling') return false;
  const opphav = req.headers.origin;
  const cors = opphav && TILLATT_OPPHAV.test(opphav) ? { 'Access-Control-Allow-Origin': opphav, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : {};
  const json = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors, ...ekstraHoder }); res.end(JSON.stringify(obj)); };
  if (req.method === 'OPTIONS') { res.writeHead(204, { ...cors, 'Access-Control-Max-Age': '600' }); res.end(); return true; }
  const kropp = () => new Promise((ok) => {
    let n = 0; const deler = [];
    req.on('data', (d) => { n += d.length; if (n > MAKS_KMZ * 1.5) { req.destroy(); ok(null); } else deler.push(d); });
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(deler).toString('utf8') || '{}')); } catch { ok(null); } });
    req.on('error', () => ok(null));
  });
  (async () => {
    const m = sti.match(/^\/api\/kontroller(?:\/([a-f0-9]{32}))?(?:\/oppdrag(?:\/([a-f0-9]{16})(\.kmz|\/status)?)?)?$/);
    if (sti === '/api/kobling' && req.method === 'POST') { const b = await kropp(); const r = b && relay.kobl(b.kode); return r ? json(200, r) : json(404, { feil: 'Koden er ukjent eller utløpt. Lag en ny kode på kontrolleren.' }); }
    if (!m) return json(404, { feil: 'Finnes ikke' });
    const [, id, oid, del] = m;
    if (!id && req.method === 'POST') { const b = await kropp(); return json(200, relay.registrer(b?.id || null)); }
    if (id && !oid && sti.endsWith('/oppdrag') && req.method === 'GET') { const l = relay.liste(id); return l ? json(200, l) : json(404, { feil: 'Ukjent kontroller' }); }
    if (id && !oid && sti.endsWith('/oppdrag') && req.method === 'POST') { const b = await kropp(); if (!b) return json(400, { feil: 'Ugyldig forespørsel' }); const r = relay.send(id, b); return r.feil ? json(r.status, { feil: r.feil }) : json(200, r); }
    if (id && oid && del === '.kmz' && req.method === 'GET') {
      const f = relay.hent(id, oid); if (!f) return json(404, { feil: 'Finnes ikke' });
      const navn = f.navn.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_|_$/g, '') || 'droneoppdrag';
      res.writeHead(200, { 'Content-Type': 'application/vnd.google-earth.kmz', 'Content-Disposition': `attachment; filename="${navn}.kmz"`, 'Content-Length': f.data.length, 'Cache-Control': 'no-store', ...cors, ...ekstraHoder });
      return res.end(f.data);
    }
    if (id && oid && del === '/status' && req.method === 'POST') { const b = await kropp(); return relay.status(id, oid, b?.status) ? json(200, { ok: true }) : json(400, { feil: 'Ugyldig status' }); }
    if (id && oid && !del && req.method === 'DELETE') return relay.slett(id, oid) ? json(200, { ok: true }) : json(404, { feil: 'Finnes ikke' });
    return json(405, { feil: 'Metoden er ikke tillatt' });
  })().catch(() => json(500, { feil: 'Serverfeil' }));
  return true;
}
