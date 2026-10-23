// Innlogging for sekretariat og dommere: scrypt-hashede passord, økter i minnet og enkel sperre mot gjetting.
import crypto from 'node:crypto';

const OKT_TIMER = 14;
const okter = new Map();
const forsok = new Map();

export function hashPassord(passord) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(passord), salt, 32).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function sjekkPassord(passord, lagret) {
  const [type, salt, hash] = String(lagret || '').split('$');
  if (type !== 'scrypt' || !salt || !hash) return false;
  const kandidat = crypto.scryptSync(String(passord ?? ''), salt, 32);
  const fasit = Buffer.from(hash, 'hex');
  return fasit.length === kandidat.length && crypto.timingSafeEqual(kandidat, fasit);
}

export function likeStrenger(a, b) {
  const x = crypto.createHash('sha256').update(String(a ?? '')).digest();
  const y = crypto.createHash('sha256').update(String(b ?? '')).digest();
  return crypto.timingSafeEqual(x, y);
}

// Passord som er lette å lese opp og skrive inn på nettbrett (uten 0/O og 1/l)
export function lagPassord(lengde = 10) {
  const tegn = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(lengde), (b) => tegn[b % tegn.length]).join('');
}

export function lagKode() {
  const tegn = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.randomBytes(8), (b) => tegn[b % tegn.length]).join('');
}

export function nyOkt(data) {
  const token = crypto.randomBytes(32).toString('base64url');
  okter.set(token, { ...data, utloper: Date.now() + OKT_TIMER * 3600_000 });
  return token;
}

export function hentOkt(req) {
  const m = /(?:^|;\s*)dressur_okt=([A-Za-z0-9_-]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const okt = okter.get(m[1]);
  if (!okt) return null;
  if (okt.utloper < Date.now()) { okter.delete(m[1]); return null; }
  return { ...okt, token: m[1] };
}

export function slettOkt(token) { okter.delete(token); }

// Logger ut alle økter for en dommer, f.eks. når passordet byttes eller dommeren slettes
export function slettOkterFor(dommerId) {
  for (const [t, o] of okter) if (o.dommerId === dommerId) okter.delete(t);
}

export function oktCookie(token, sikker) {
  const maks = token ? OKT_TIMER * 3600 : 0;
  return `dressur_okt=${token || ''}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maks}${sikker ? '; Secure' : ''}`;
}

// Maks 10 mislykkede forsøk per IP og brukernavn per 15 minutter
export function sperret(nokkel) {
  const f = forsok.get(nokkel);
  if (!f || f.til < Date.now()) return false;
  return f.antall >= 10;
}
export function registrerFeil(nokkel) {
  const f = forsok.get(nokkel);
  if (!f || f.til < Date.now()) forsok.set(nokkel, { antall: 1, til: Date.now() + 15 * 60_000 });
  else f.antall++;
}
export function nullstillFeil(nokkel) { forsok.delete(nokkel); }
