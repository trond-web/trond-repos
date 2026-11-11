// Sikkerhetskopi av dataene på serveren (DPIA-tiltak T2). Bruker bare Node sitt standardbibliotek.
//
// Hva: alle filene i datamappen (Railway-volumet, mappen til BRUKER_FIL). Det er brukere, skylagrede planer,
//   nettverk og chat, tømmerdeling, tilbud, PC↔mobil-synk, droneoppdrag og John Deere-koblinger. Mappen «backup»
//   og midlertidige filer (*.tmp) er ikke med.
// Format: tar (ustar) komprimert med gzip. Med BACKUP_NOKKEL krypteres filen med AES-256-GCM. Nøkkelen avledes
//   med scrypt fra BACKUP_NOKKEL og et tilfeldig salt i filen. Oppsett: «SKOGIQB1» | salt (16) | iv (12) |
//   kryptert innhold | tag (16). Etter dekryptering kan filen pakkes ut med vanlig `tar xzf`
//   (se verktoy/gjenopprett-backup.mjs).
// Hvor:
//   * lokalt i <datamappe>/backup. De siste BACKUP_BEHOLD_LOKALT (7) beholdes. Dette beskytter mot feil og sletting,
//     men ikke mot tap av volumet.
//   * utenfor Railway, i S3-kompatibel lagring i EU, når BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET,
//     BACKUP_S3_NOKKEL_ID og BACKUP_S3_HEMMELIG er satt (og eventuelt BACKUP_S3_REGION og BACKUP_S3_PREFIKS).
//     De siste BACKUP_BEHOLD_S3 (30) beholdes. Kopier sendes aldri ut ukryptert: uten BACKUP_NOKKEL lagres de
//     bare lokalt.
// Når: ved oppstart hvis siste kopi er eldre enn intervallet, og deretter hver time så lenge siste kopi er eldre enn
//   BACKUP_INTERVALL_TIMER (24). Administrator kan også ta en kopi med en gang (admin.html).
import { createHash, createHmac, randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync, rmSync, existsSync, renameSync } from 'node:fs';
import path from 'node:path';

export const MAGI = Buffer.from('SKOGIQB1');
export const MAKS_BYTES = 1024 * 1024 * 1024; // 1 GB ukomprimert – større datamengder må få strømmende kopi
const UTELAT = (rel) => rel === 'backup' || rel.startsWith('backup/') || /\.tmp$/.test(rel) || rel === 'lost+found' || rel.startsWith('lost+found/');

// ---------- tar (ustar) ----------
function oktal(n, lengde) { return Buffer.from(`${n.toString(8).padStart(lengde - 1, '0')}\0`, 'ascii'); }
// Navn som ikke passer i ustar (100 + 155 byte), skrives med GNU «././@LongLink» (type L) foran – det leser både
// lesTar og vanlig tar.
const passer = (navn) => { if (Buffer.byteLength(navn) <= 100) return { n: navn, prefiks: '' }; const i = navn.lastIndexOf('/', 155); if (i <= 0) return null; const n = navn.slice(i + 1); const prefiks = navn.slice(0, i); return Buffer.byteLength(n) <= 100 && Buffer.byteLength(prefiks) <= 155 ? { n, prefiks } : null; };
function tarHode(navn, storrelse, mtid, type = '0') {
  const h = Buffer.alloc(512);
  const p = passer(navn) || { n: Buffer.from(navn).subarray(0, 100).toString('utf8').replace(/\uFFFD$/, ''), prefiks: '' };
  h.write(p.n, 0, 'utf8'); oktal(0o644, 8).copy(h, 100); oktal(0, 8).copy(h, 108); oktal(0, 8).copy(h, 116);
  oktal(storrelse, 12).copy(h, 124); oktal(Math.floor(mtid / 1000), 12).copy(h, 136);
  h.fill(' ', 148, 156); h.write(type, 156, 'ascii'); h.write('ustar\0', 257, 'ascii'); h.write('00', 263, 'ascii');
  h.write(p.prefiks, 345, 'utf8');
  let sum = 0; for (const b of h) sum += b; oktal(sum, 7).copy(h, 148); h[155] = 0x20;
  return h;
}
export function lagTar(filer) {
  const deler = [];
  const legg = (hode, data) => { deler.push(hode, data); const rest = data.length % 512; if (rest) deler.push(Buffer.alloc(512 - rest)); };
  for (const f of filer) {
    if (!passer(f.navn)) { const n = Buffer.from(`${f.navn}\0`); legg(tarHode('././@LongLink', n.length, 0, 'L'), n); }
    legg(tarHode(f.navn, f.data.length, f.mtid || Date.now()), f.data);
  }
  deler.push(Buffer.alloc(1024));
  return Buffer.concat(deler);
}
export function lesTar(buf) {
  const filer = []; let o = 0; let langt = null;
  while (o + 512 <= buf.length) {
    const h = buf.subarray(o, o + 512); if (h.every((b) => b === 0)) break;
    const str = (a, b) => h.subarray(a, b).toString('utf8').replace(/\0.*$/s, '');
    const navn = [str(345, 500), str(0, 100)].filter(Boolean).join('/');
    const storrelse = parseInt(str(124, 136).trim() || '0', 8); const type = String.fromCharCode(h[156] || 48);
    const data = buf.subarray(o + 512, o + 512 + storrelse);
    if (type === 'L') langt = data.toString('utf8').replace(/\0.*$/s, '');
    else if (type === '0' || type === '\0') { filer.push({ navn: langt || navn, data: Buffer.from(data), mtid: parseInt(str(136, 148).trim() || '0', 8) * 1000 }); langt = null; }
    o += 512 + Math.ceil(storrelse / 512) * 512;
  }
  return filer;
}

// ---------- kryptering ----------
const avled = (passord, salt) => scryptSync(String(passord), salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
export function krypter(data, passord) {
  const salt = randomBytes(16); const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', avled(passord, salt), iv);
  const kryptert = Buffer.concat([c.update(data), c.final()]);
  return Buffer.concat([MAGI, salt, iv, kryptert, c.getAuthTag()]);
}
export function dekrypter(buf, passord) {
  if (!buf.subarray(0, 8).equals(MAGI)) throw new Error('Ikke en kryptert SkogIQ-sikkerhetskopi');
  const salt = buf.subarray(8, 24); const iv = buf.subarray(24, 36); const tag = buf.subarray(buf.length - 16);
  const d = createDecipheriv('aes-256-gcm', avled(passord, salt), iv); d.setAuthTag(tag);
  try { return Buffer.concat([d.update(buf.subarray(36, buf.length - 16)), d.final()]); } catch { throw new Error('Feil nøkkel, eller filen er skadet'); }
}

// Pakk ut en sikkerhetskopi (kryptert eller ikke) til en liste med filer.
export function pakkUt(buf, passord = '') {
  const gz = buf.subarray(0, 8).equals(MAGI) ? dekrypter(buf, passord || (() => { throw new Error('Sikkerhetskopien er kryptert – oppgi BACKUP_NOKKEL'); })()) : buf;
  return lesTar(gunzipSync(gz));
}

// ---------- S3 (signatur v4) ----------
const sha = (d) => createHash('sha256').update(d).digest('hex');
const hmac = (k, d) => createHmac('sha256', k).update(d).digest();
export const rfc3986 = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
// Ren signering (testes mot AWS sitt eksempel). headers: små bokstaver → verdi (host må være med).
export function signerS3({ metode, sti, query = {}, headers, payloadHash, amzDato, region, id, hemmelig }) {
  const dato = amzDato.slice(0, 8);
  const navn = Object.keys(headers).map((k) => k.toLowerCase()).sort();
  const kanHoder = navn.map((k) => `${k}:${String(headers[k]).trim()}\n`).join('');
  const signerte = navn.join(';');
  const kanQuery = Object.keys(query).sort().map((k) => `${rfc3986(k)}=${rfc3986(String(query[k]))}`).join('&');
  const foresporsel = [metode, sti, kanQuery, kanHoder, signerte, payloadHash].join('\n');
  const scope = `${dato}/${region}/s3/aws4_request`;
  const tekst = ['AWS4-HMAC-SHA256', amzDato, scope, sha(foresporsel)].join('\n');
  const k = hmac(hmac(hmac(hmac(`AWS4${hemmelig}`, dato), region), 's3'), 'aws4_request');
  return `AWS4-HMAC-SHA256 Credential=${id}/${scope}, SignedHeaders=${signerte}, Signature=${createHmac('sha256', k).update(tekst).digest('hex')}`;
}
export function lagS3({ endpoint, bucket, region = 'eu-central-1', id, hemmelig, prefiks = 'skogiq/', hent = fetch, naa = () => Date.now() }) {
  const base = new URL(endpoint);
  const kall = async (metode, nokkel = '', { query = {}, body = null } = {}) => {
    const sti = `${base.pathname.replace(/\/$/, '')}/${rfc3986(bucket)}${nokkel ? `/${nokkel.split('/').map(rfc3986).join('/')}` : ''}`;
    const amzDato = new Date(naa()).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const payloadHash = sha(body || '');
    const headers = { host: base.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDato };
    const auth = signerS3({ metode, sti, query, headers, payloadHash, amzDato, region, id, hemmelig });
    const qs = Object.keys(query).sort().map((k) => `${rfc3986(k)}=${rfc3986(String(query[k]))}`).join('&');
    const r = await hent(`${base.protocol}//${base.host}${sti}${qs ? `?${qs}` : ''}`, { method: metode, headers: { ...headers, Authorization: auth, ...(body ? { 'Content-Type': 'application/octet-stream' } : {}) }, body });
    if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(`S3 ${metode} svarte ${r.status}${(t.match(/<Code>([^<]+)/) || [])[1] ? ` (${t.match(/<Code>([^<]+)/)[1]})` : ''}`); }
    return r;
  };
  return {
    prefiks,
    last: (navn, data) => kall('PUT', `${prefiks}${navn}`, { body: data }),
    hent: async (navn) => Buffer.from(await (await kall('GET', `${prefiks}${navn}`)).arrayBuffer()),
    slett: (navn) => kall('DELETE', `${prefiks}${navn}`),
    async liste() {
      const ut = []; let token = null;
      do {
        const r = await kall('GET', '', { query: { 'list-type': '2', prefix: prefiks, ...(token ? { 'continuation-token': token } : {}) } });
        const x = await r.text();
        for (const m of x.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) { const k = (m[1].match(/<Key>([^<]+)<\/Key>/) || [])[1]; const s = Number((m[1].match(/<Size>(\d+)<\/Size>/) || [])[1] || 0); if (k) ut.push({ navn: k.slice(prefiks.length), storrelse: s }); }
        token = /<IsTruncated>true<\/IsTruncated>/.test(x) ? (x.match(/<NextContinuationToken>([^<]+)</) || [])[1] : null;
      } while (token);
      return ut.filter((x) => /^skogiq-[\dT-]+\.tar\.gz(\.enc)?$/.test(x.navn)).sort((a, b) => a.navn.localeCompare(b.navn));
    },
  };
}

// ---------- selve sikkerhetskopien ----------
export function samleFiler(mappe) {
  const ut = []; let sum = 0;
  const gaa = (rel) => {
    for (const n of readdirSync(path.join(mappe, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${n.name}` : n.name; if (UTELAT(r)) continue;
      if (n.isDirectory()) gaa(r);
      else if (n.isFile()) { const p = path.join(mappe, r); const data = readFileSync(p); sum += data.length; if (sum > MAKS_BYTES) throw new Error('Datamengden er over 1 GB – sikkerhetskopien må lages på en annen måte'); ut.push({ navn: r, data, mtid: statSync(p).mtimeMs }); }
    }
  };
  gaa(''); return ut.sort((a, b) => a.navn.localeCompare(b.navn));
}
const navnFor = (t, kryptert) => `skogiq-${new Date(t).toISOString().slice(0, 16).replace(/:/g, '')}.tar.gz${kryptert ? '.enc' : ''}`;

export function lagBackup({ mappe, nokkel = '', s3 = null, beholdLokalt = 7, beholdS3 = 30, intervallTimer = 24, naa = () => Date.now(), forKopi = null, logg = console } = {}) {
  const lokal = mappe ? path.join(mappe, 'backup') : null;
  const statusFil = lokal ? path.join(lokal, 'status.json') : null;
  let status = { siste: null, sisteForsok: null, feil: null, s3Siste: null, s3Feil: null, historikk: [] };
  if (statusFil) try { status = { ...status, ...JSON.parse(readFileSync(statusFil, 'utf8')) }; } catch { /* ny */ }
  const lagreStatus = () => { if (!statusFil) return; try { mkdirSync(lokal, { recursive: true }); writeFileSync(`${statusFil}.tmp`, JSON.stringify(status)); renameSync(`${statusFil}.tmp`, statusFil); } catch (e) { logg.error('Sikkerhetskopi: klarte ikke å lagre status:', e.message); } };
  let pagar = null; let timer = null;
  const lokaleFiler = () => (lokal && existsSync(lokal) ? readdirSync(lokal).filter((f) => /^skogiq-[\dT-]+\.tar\.gz(\.enc)?$/.test(f)).sort() : []);

  async function kjor({ kilde = 'plan' } = {}) {
    if (!mappe) return { feil: 'Ingen datamappe (BRUKER_FIL er ikke satt)', status: 400 };
    if (pagar) return pagar;
    pagar = (async () => {
      await null; // pagar må være satt før kopien kjøres (også når den er ferdig uten å vente)
      const t = naa(); status.sisteForsok = t;
      try {
        try { forKopi?.(); } catch (e) { logg.error('Sikkerhetskopi: lagring før kopi feilet:', e.message); }
        const filer = samleFiler(mappe);
        const gz = gzipSync(lagTar(filer), { level: 6 });
        const data = nokkel ? krypter(gz, nokkel) : gz;
        const navn = navnFor(t, !!nokkel);
        mkdirSync(lokal, { recursive: true }); writeFileSync(path.join(lokal, `${navn}.tmp`), data); renameSync(path.join(lokal, `${navn}.tmp`), path.join(lokal, navn));
        for (const f of lokaleFiler().slice(0, -beholdLokalt)) rmSync(path.join(lokal, f), { force: true });
        const rad = { tid: t, navn, filer: filer.length, bytes: filer.reduce((s, f) => s + f.data.length, 0), storrelse: data.length, kryptert: !!nokkel, kilde, s3: null };
        status.siste = t; status.feil = null;
        if (s3 && nokkel) {
          try {
            await s3.last(navn, data); rad.s3 = 'ok'; status.s3Siste = t; status.s3Feil = null;
            const liste = await s3.liste(); for (const x of liste.slice(0, -beholdS3)) await s3.slett(x.navn).catch((e) => logg.error('Sikkerhetskopi: sletting i S3 feilet:', e.message));
          } catch (e) { rad.s3 = 'feil'; status.s3Feil = e.message; logg.error('Sikkerhetskopi: opplasting feilet:', e.message); }
        } else if (s3) { rad.s3 = 'ukryptert'; status.s3Feil = 'BACKUP_NOKKEL mangler – sendes ikke ut ukryptert'; }
        status.historikk = [rad, ...(status.historikk || [])].slice(0, 30);
        lagreStatus(); return { ok: true, ...rad };
      } catch (e) {
        status.feil = e.message; lagreStatus(); logg.error('Sikkerhetskopi feilet:', e.message); return { feil: e.message, status: 500 };
      } finally { pagar = null; }
    })();
    return pagar;
  }
  const forfalt = () => !status.siste || naa() - status.siste >= intervallTimer * 3600 * 1000;
  return {
    aktiv: !!mappe,
    kjor,
    lokaleFiler,
    hentLokal(navn) { if (!/^skogiq-[\dT-]+\.tar\.gz(\.enc)?$/.test(String(navn)) || !lokaleFiler().includes(navn)) return null; return readFileSync(path.join(lokal, navn)); },
    status: () => ({ aktiv: !!mappe, kryptert: !!nokkel, s3: !!s3, s3Kryptert: !!(s3 && nokkel), intervallTimer, beholdLokalt, beholdS3, ...status, forfalt: forfalt(), lokale: lokaleFiler().map((n) => ({ navn: n, storrelse: statSync(path.join(lokal, n)).size })).reverse() }),
    // Sjekk hver time; ta kopi når forrige er eldre enn intervallet (første sjekk etter et minutt).
    start() { if (!mappe || timer) return; const sjekk = () => { if (forfalt()) kjor({ kilde: 'plan' }); }; setTimeout(sjekk, 60 * 1000).unref?.(); timer = setInterval(sjekk, 3600 * 1000); timer.unref?.(); },
    stopp() { clearInterval(timer); timer = null; },
  };
}

// HTTP for administrator: GET /api/admin/backup (status), POST /api/admin/backup (ta kopi nå),
// GET /api/admin/backup/fil?navn=… (last ned en lokal kopi). erAdmin(req) → true/false/null (null = ikke innlogget).
export function backupApi(b, { erAdmin, cors = () => ({}) }, req, res, sti, ekstraHoder = {}) {
  if (sti !== '/api/admin/backup' && sti !== '/api/admin/backup/fil') return false;
  const json = (s, o) => { res.writeHead(s, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req), ...ekstraHoder }); res.end(JSON.stringify(o)); };
  const a = erAdmin(req); if (!a) { json(a === null ? 401 : 403, { feil: 'Bare for administrator', innlogging: a === null }); return true; }
  if (!b?.aktiv) { json(200, { aktiv: false }); return true; }
  if (sti === '/api/admin/backup/fil') {
    const navn = new URL(req.url, 'http://x').searchParams.get('navn'); const data = b.hentLokal(navn);
    if (!data) { json(404, { feil: 'Finnes ikke' }); return true; }
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="${navn}"`, 'Content-Length': data.length, 'Cache-Control': 'no-store', ...cors(req), ...ekstraHoder }); res.end(data); return true;
  }
  if (req.method === 'POST') { b.kjor({ kilde: 'manuell' }).then((r) => json(r.feil ? r.status || 500 : 200, { ...r, status: b.status() })); return true; }
  json(200, b.status()); return true;
}
