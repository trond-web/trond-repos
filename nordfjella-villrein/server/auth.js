// Innlogging for admin: passord lagres som scrypt-hash, og sesjonen er en signert, tidsbegrenset kapsel.
import { scrypt as scryptCb, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const SESJON_TIMER = 12;
export const KAPSEL = 'nfv_sesjon';

export async function hashPassord(passord) {
  const salt = randomBytes(16).toString('base64url');
  const hash = (await scrypt(passord, salt, 64)).toString('base64url');
  return { salt, hash };
}

export async function sjekkPassord(passord, lagret) {
  if (!lagret?.salt || !lagret?.hash) {
    await scrypt(passord, 'dummy-salt-for-lik-tid', 64); // samme tidsbruk når brukeren ikke finnes
    return false;
  }
  const a = await scrypt(passord, lagret.salt, 64);
  const b = Buffer.from(lagret.hash, 'base64url');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function godtPassord(p) {
  return typeof p === 'string' && p.length >= 10 && p.length <= 200;
}

const signer = (hemmelighet, data) => createHmac('sha256', hemmelighet).update(data).digest('base64url');

export function lagSesjon(hemmelighet, bruker, naa = Date.now()) {
  const data = Buffer.from(JSON.stringify({ b: bruker, utl: naa + SESJON_TIMER * 3600e3 })).toString('base64url');
  return `${data}.${signer(hemmelighet, data)}`;
}

export function lesSesjon(hemmelighet, verdi, naa = Date.now()) {
  if (typeof verdi !== 'string' || !verdi.includes('.')) return null;
  const [data, sig] = verdi.split('.');
  const forventet = signer(hemmelighet, data);
  if (!sig || sig.length !== forventet.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(forventet))) return null;
  try {
    const s = JSON.parse(Buffer.from(data, 'base64url').toString());
    return s.utl > naa ? s.b : null;
  } catch { return null; }
}

export function lesKapsler(header = '') {
  const ut = {};
  for (const del of header.split(';')) {
    const i = del.indexOf('=');
    if (i > 0) ut[del.slice(0, i).trim()] = decodeURIComponent(del.slice(i + 1).trim());
  }
  return ut;
}

export function kapselHeader(verdi, { sikker = true, maxAlder = SESJON_TIMER * 3600 } = {}) {
  return `${KAPSEL}=${encodeURIComponent(verdi)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAlder}${sikker ? '; Secure' : ''}`;
}

// Begrenser antall innloggingsforsøk per IP: 8 feil på 15 minutter gir pause.
export function lagSperre({ maks = 8, vindu = 15 * 60e3 } = {}) {
  const forsok = new Map();
  return {
    sperret(ip, naa = Date.now()) {
      const f = (forsok.get(ip) || []).filter((t) => naa - t < vindu);
      forsok.set(ip, f);
      return f.length >= maks;
    },
    feil(ip, naa = Date.now()) { forsok.set(ip, [...(forsok.get(ip) || []), naa]); },
    nullstill(ip) { forsok.delete(ip); },
  };
}
