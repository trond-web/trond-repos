// Innlogging for SkogIQ.ai på serveren. Bare Node sitt standardbibliotek.
//
// To måter (miljøvariabler på serveren, aldri i koden):
//   * Registrering (APP_REGISTRERING=1): alle registrerer seg med brukernavn og passord. Passordene lagres bare som
//     scrypt-hash med eget salt. Brukere og bruksstatistikk lagres i BRUKER_FIL (JSON, f.eks. på et Railway-volum
//     /data/brukere.json); uten BRUKER_FIL holdes de bare i minnet til serveren startes på nytt.
//     APP_BRUKER/APP_PASSORD oppretter administratoren første gang serveren starter (passordet byttes deretter i appen).
//     APP_ADMIN = flere administratornavn (kommaseparert); de er reservert og kan ikke registreres av andre.
//     APP_REGISTRERINGSKODE (valgfri) må oppgis for å registrere seg.
//   * Én bruker (APP_BRUKER + APP_PASSORD uten APP_REGISTRERING): som før.
//   Uten noen av dem er innloggingen av.
// Økten er signert (HMAC) og ligger i en HttpOnly-informasjonskapsel, og som Bearer-token for appen på GitHub Pages
// (annen adresse, informasjonskapselen følger ikke med). Nytt passord eller sperring gjør gamle økter ugyldige.
import { createHmac, createHash, timingSafeEqual, randomBytes, scryptSync } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';

export const OKT_NAVN = 'skogiq_okt';
const DAG = 24 * 3600 * 1000;
const b64 = (s) => Buffer.from(s).toString('base64url');
const lik = (a, b) => timingSafeEqual(createHash('sha256').update(String(a)).digest(), createHash('sha256').update(String(b)).digest());
export const GYLDIG_BRUKERNAVN = /^[a-z0-9][a-z0-9._-]{2,31}$/;
export const MIN_PASSORD = 8;
const dagNokkel = (t) => new Date(t).toISOString().slice(0, 10);
const tekst = (v, n) => String(v ?? '').trim().slice(0, n);

// scrypt med eget salt per bruker (N = 2^14, r = 8, p = 1 → ca. 16 MB og noen titalls millisekunder).
export function hashPassord(passord, salt = randomBytes(16).toString('hex')) { return { salt, hash: scryptSync(String(passord), salt, 32, { N: 16384, r: 8, p: 1 }).toString('hex') }; }
const riktigPassord = (passord, b) => b?.hash && lik(hashPassord(passord, b.salt).hash, b.hash);

// Brukere og bruk i én JSON-fil. Skrives samlet etter et halvt sekund, via midlertidig fil (aldri halvskrevet).
export function lagBrukerlager({ fil = null, naa = () => Date.now() } = {}) {
  let data = { hemmelighet: randomBytes(32).toString('hex'), brukere: {}, bruk: {} };
  let lest = false;
  if (fil) { try { data = { ...data, ...JSON.parse(readFileSync(fil, 'utf8')) }; lest = true; } catch { /* ny fil */ } }
  let timer = null;
  const lagre = () => { if (!fil) return; clearTimeout(timer); timer = setTimeout(() => { try { writeFileSync(`${fil}.tmp`, JSON.stringify(data)); renameSync(`${fil}.tmp`, fil); } catch (e) { console.error('Klarte ikke å lagre brukerne:', e.message); } }, 500); };
  if (fil && !lest) lagre();
  return {
    permanent: !!fil, data,
    hent: (u) => data.brukere[String(u || '').toLowerCase()] || null,
    alle: () => Object.values(data.brukere),
    lagre(b) { data.brukere[b.navn] = b; lagre(); return b; },
    slett(u) { delete data.brukere[u]; for (const d of Object.values(data.bruk)) delete d[u]; lagre(); },
    // Bruk per dag og bruker: s = sidevisninger, k = kall til serveren, m = aktive minutter, f = faner/moduler.
    bruk(u, type, detalj = '') {
      const dag = dagNokkel(naa()); const d = data.bruk[dag] || (data.bruk[dag] = {}); const x = d[u] || (d[u] = { s: 0, k: 0, m: 0, f: {} });
      if (type === 'side') x.s++; else if (type === 'kall') x.k++; else if (type === 'aktiv') x.m += 1; else if (type === 'fane' && detalj) x.f[detalj] = (x.f[detalj] || 0) + 1;
      const b = data.brukere[u]; if (b) b.sistAktiv = naa();
      // Hold 400 dager
      const dager = Object.keys(data.bruk); if (dager.length > 400) for (const k of dager.sort().slice(0, dager.length - 400)) delete data.bruk[k];
      lagre();
    },
    flush() { if (fil) { clearTimeout(timer); writeFileSync(`${fil}.tmp`, JSON.stringify(data)); renameSync(`${fil}.tmp`, fil); } },
  };
}

export function lagInnlogging({ bruker = '', passord = '', hemmelighet = '', registrering = false, fil = null, admin = '', kode = '', dager = 30, naa = () => Date.now(), lager = null } = {}) {
  const enkel = !!(bruker && passord);
  const aktiv = enkel || !!registrering;
  const store = registrering ? (lager || lagBrukerlager({ fil, naa })) : null;
  const admins = new Set(String(admin || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
  // Administratoren fra APP_BRUKER/APP_PASSORD opprettes første gang (endres ikke senere – passordet byttes i appen).
  if (store && enkel && !store.hent(bruker)) { store.lagre({ navn: bruker.toLowerCase(), visning: bruker, epost: '', ...hashPassord(passord), pv: 0, rolle: 'admin', sperret: false, opprettet: naa(), innlogginger: 0 }); admins.add(bruker.toLowerCase()); }
  // Uten egen hemmelighet: tilfeldig og lagret med brukerne (registrering), eller avledet av brukernavn og passord (én bruker).
  const nokkel = hemmelighet || (store ? store.data.hemmelighet : createHash('sha256').update(`skogiq|${bruker}|${passord}`).digest('hex'));
  const signer = (data) => createHmac('sha256', nokkel).update(data).digest('base64url');
  const feil = new Map(); // ip → [tidspunkter for feil passord]
  const reg = new Map(); // ip → [tidspunkter for registreringer]
  const erAdmin = (u) => { const b = store?.hent(u); return !!(store ? b && (b.rolle === 'admin' || admins.has(b.navn)) : enkel && u === bruker); };
  const offentlig = (b) => ({ bruker: b.navn, navn: b.visning || b.navn, epost: b.epost || '', admin: erAdmin(b.navn) });
  return {
    aktiv, registrering: !!store, permanent: store ? store.permanent : true, kodeKreves: !!(store && kode), dager, lager: store,
    erAdmin,
    lagToken(u = bruker) { const b = store?.hent(u); const data = b64(JSON.stringify({ u: b ? b.navn : u, pv: b?.pv || 0, exp: naa() + dager * DAG, n: randomBytes(6).toString('hex') })); return `${data}.${signer(data)}`; },
    lesToken(t) {
      if (typeof t !== 'string' || !t.includes('.')) return null;
      const [data, sig] = t.split('.');
      if (!sig || !lik(sig, signer(data))) return null;
      let o; try { o = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')); } catch { return null; }
      if (!(o.exp > naa())) return null;
      if (!store) return o.u === bruker ? o : null;
      const b = store.hent(o.u); return b && !b.sperret && (b.pv || 0) === (o.pv || 0) ? o : null;
    },
    // Høyst 10 feil passord per IP-adresse på 15 minutter.
    sperret(ip) { const t = naa(); const l = (feil.get(ip) || []).filter((x) => t - x < 15 * 60000); feil.set(ip, l); return l.length >= 10; },
    sjekk(ip, b, p) {
      if (this.sperret(ip)) return { ok: false, sperret: true };
      const navn = String(b || '').trim().toLowerCase();
      let ok = false; let blokkert = false;
      if (store) { const x = store.hent(navn); ok = !!x && riktigPassord(String(p || ''), x); if (ok && x.sperret) { ok = false; blokkert = true; } if (ok) store.lagre({ ...x, sistInnlogget: naa(), innlogginger: (x.innlogginger || 0) + 1 }); }
      else ok = aktiv && lik(navn, bruker.toLowerCase()) && lik(String(p || ''), passord);
      if (!ok && !blokkert) { feil.get(ip).push(naa()); if (feil.size > 10000) feil.delete(feil.keys().next().value); }
      return { ok, blokkert, bruker: ok ? (store ? navn : bruker) : null };
    },
    registrer(ip, { bruker: b, passord: p, navn, epost, kode: k } = {}) {
      if (!store) return { feil: 'Registrering er ikke slått på', status: 403 };
      const t = naa(); const l = (reg.get(ip) || []).filter((x) => t - x < 3600000); reg.set(ip, l);
      if (l.length >= 5) return { feil: 'For mange registreringer fra denne adressen – prøv igjen om en time', status: 429 };
      if (kode && !lik(String(k || '').trim(), kode)) return { feil: 'Feil registreringskode', status: 403 };
      const u = String(b || '').trim().toLowerCase();
      if (!GYLDIG_BRUKERNAVN.test(u)) return { feil: 'Brukernavnet må være 3–32 tegn: små bokstaver a–z, tall, punktum, bindestrek eller understrek', status: 400 };
      if (String(p || '').length < MIN_PASSORD) return { feil: `Passordet må ha minst ${MIN_PASSORD} tegn`, status: 400 };
      if (String(p).toLowerCase().includes(u)) return { feil: 'Passordet kan ikke inneholde brukernavnet', status: 400 };
      const e = tekst(epost, 120); if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { feil: 'Ugyldig e-postadresse', status: 400 };
      if (store.hent(u)) return { feil: 'Brukernavnet er opptatt', status: 409 };
      // Administratornavnene (APP_ADMIN) er reservert: ellers kunne hvem som helst registrere dem først og bli admin.
      if (admins.has(u)) return { feil: 'Brukernavnet er reservert', status: 403 };
      l.push(t);
      const ny = store.lagre({ navn: u, visning: tekst(navn, 80) || u, epost: e, ...hashPassord(p), pv: 0, rolle: 'bruker', sperret: false, opprettet: t, sistInnlogget: t, innlogginger: 1 });
      return { ok: true, bruker: ny.navn };
    },
    byttPassord(u, gammelt, nytt) {
      const b = store?.hent(u); if (!b) return { feil: 'Passord kan bare byttes når registrering er slått på', status: 400 };
      if (!riktigPassord(String(gammelt || ''), b)) return { feil: 'Feil nåværende passord', status: 401 };
      if (String(nytt || '').length < MIN_PASSORD) return { feil: `Passordet må ha minst ${MIN_PASSORD} tegn`, status: 400 };
      store.lagre({ ...b, ...hashPassord(nytt), pv: (b.pv || 0) + 1 }); return { ok: true };
    },
    bruk(u, type, detalj) { if (store?.hent(u)) store.bruk(store.hent(u).navn, type, tekst(detalj, 40)); },
    meg(u) { const b = store?.hent(u); return b ? offentlig(b) : u ? { bruker: u, navn: u, epost: '', admin: erAdmin(u) } : null; },
    // Oversikt for administratoren: brukerne med bruk, og bruk per dag og per modul de siste «dager» dagene.
    oversikt({ antallDager = 30 } = {}) {
      if (!store) return { brukere: [], dager: [], faner: {}, permanent: true };
      const dagliste = []; for (let i = antallDager - 1; i >= 0; i--) dagliste.push(dagNokkel(naa() - i * DAG));
      const perBruker = {}; const faner = {};
      const dagRader = dagliste.map((d) => {
        const x = store.data.bruk[d] || {}; let s = 0; let k = 0; let m = 0;
        for (const [u, v] of Object.entries(x)) { s += v.s; k += v.k; m += v.m; const p = perBruker[u] || (perBruker[u] = { dager: 0, s: 0, k: 0, m: 0, f: {} }); p.dager++; p.s += v.s; p.k += v.k; p.m += v.m; for (const [f, n] of Object.entries(v.f || {})) { p.f[f] = (p.f[f] || 0) + n; faner[f] = (faner[f] || 0) + n; } }
        return { dag: d, aktive: Object.keys(x).length, sider: s, kall: k, minutter: m };
      });
      const iDag = dagNokkel(naa()); const aktiveSiden = (n) => store.alle().filter((b) => b.sistAktiv && b.sistAktiv > naa() - n * DAG).length;
      return {
        permanent: store.permanent, totalt: store.alle().length, aktiveIdag: (store.data.bruk[iDag] && Object.keys(store.data.bruk[iDag]).length) || 0, aktive7: aktiveSiden(7), aktive30: aktiveSiden(30),
        dager: dagRader, faner,
        brukere: store.alle().map((b) => ({ ...offentlig(b), rolle: b.rolle, sperret: !!b.sperret, opprettet: b.opprettet, sistInnlogget: b.sistInnlogget || null, sistAktiv: b.sistAktiv || null, innlogginger: b.innlogginger || 0, ...(perBruker[b.navn] ? { aktiveDager: perBruker[b.navn].dager, sider: perBruker[b.navn].s, kall: perBruker[b.navn].k, minutter: perBruker[b.navn].m, faner: perBruker[b.navn].f } : { aktiveDager: 0, sider: 0, kall: 0, minutter: 0, faner: {} }) })).sort((a, b) => (b.sistAktiv || 0) - (a.sistAktiv || 0)),
      };
    },
    endreBruker(adminU, u, handling) {
      const b = store?.hent(u); if (!b) return { feil: 'Finner ikke brukeren', status: 404 };
      if (b.navn === String(adminU).toLowerCase() && ['sperr', 'slett', 'fjern-admin'].includes(handling)) return { feil: 'Du kan ikke sperre, slette eller fjerne admin for deg selv', status: 400 };
      if (handling === 'sperr') store.lagre({ ...b, sperret: true, pv: (b.pv || 0) + 1 });
      else if (handling === 'aapne') store.lagre({ ...b, sperret: false });
      else if (handling === 'admin') store.lagre({ ...b, rolle: 'admin' });
      else if (handling === 'fjern-admin') { if (admins.has(b.navn)) return { feil: 'Brukeren er admin via APP_ADMIN på serveren', status: 400 }; store.lagre({ ...b, rolle: 'bruker' }); }
      else if (handling === 'slett') store.slett(b.navn);
      else return { feil: 'Ukjent handling', status: 400 };
      return { ok: true };
    },
    fraForesporsel(req) {
      const a = req.headers.authorization || ''; if (a.startsWith('Bearer ')) return this.lesToken(a.slice(7).trim());
      const c = String(req.headers.cookie || '').split(/;\s*/).find((x) => x.startsWith(`${OKT_NAVN}=`));
      return c ? this.lesToken(decodeURIComponent(c.slice(OKT_NAVN.length + 1))) : null;
    },
  };
}

// Det som kan hentes uten innlogging: innloggingssiden, helsesjekken, ikoner og manifester (lastes uten
// informasjonskapsel når appen installeres).
const APENT = /^\/(logginn\.html|tilbud\.html|js\/tilbud-svar\.js|js\/innlogging\.js|healthz|api\/logginn|api\/registrer|api\/meg|icon\.svg|ikon-[\w-]+\.png|manifest\.webmanifest|felt\.webmanifest|favicon\.ico)$/;
const TILLATT_OPPHAV = /^(https:\/\/(skogiq-production\.up\.railway\.app|trond-web\.github\.io)|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
export const corsFor = (req) => { const o = req.headers.origin; return o && TILLATT_OPPHAV.test(o) ? { 'Access-Control-Allow-Origin': o, Vary: 'Origin' } : {}; };
const ip = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '?';
const kapsel = (req, verdi, maxAlder) => `${OKT_NAVN}=${encodeURIComponent(verdi)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAlder}${req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`;
const API_STIER = ['/api/logginn', '/api/loggut', '/api/meg', '/api/registrer', '/api/passord', '/api/bruk', '/api/admin/oversikt', '/api/admin/bruker'];

// Innlogging, registrering, passord, bruk og admin. Gir true når forespørselen er håndtert.
export function innloggingApi(inn, req, res, sti, ekstraHoder = {}) {
  if (!API_STIER.includes(sti)) return false;
  const json = (status, obj, hoder = {}) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...corsFor(req), ...ekstraHoder, ...hoder }); res.end(JSON.stringify(obj)); };
  const okt = inn.fraForesporsel(req);
  if (sti === '/api/meg') { return json(inn.aktiv && !okt ? 401 : 200, { aktiv: inn.aktiv, registrering: inn.registrering, kodeKreves: inn.kodeKreves, ...(okt ? inn.meg(okt.u) : { bruker: null }), utloper: okt?.exp || null }), true; }
  if (sti === '/api/admin/oversikt') {
    if (!okt || !inn.erAdmin(okt.u)) return json(okt ? 403 : 401, { feil: 'Bare for administrator', innlogging: !okt }), true;
    const n = Math.min(400, Math.max(7, Number(new URL(req.url, 'http://x').searchParams.get('dager')) || 30));
    return json(200, inn.oversikt({ antallDager: n })), true;
  }
  if (req.method !== 'POST') return json(405, { feil: 'Metoden er ikke tillatt' }), true;
  if (sti === '/api/loggut') return json(200, { ok: true }, { 'Set-Cookie': kapsel(req, '', 0) }), true;
  let len = 0; const deler = [];
  req.on('data', (d) => { len += d.length; if (len > 4096) req.destroy(); else deler.push(d); });
  req.on('end', () => {
    let b = {}; try { b = JSON.parse(Buffer.concat(deler).toString('utf8') || '{}'); } catch { /* tom */ }
    const loggInn = (u, status = 200) => { const token = inn.lagToken(u); json(status, { token, utloper: Date.now() + inn.dager * DAG, ...inn.meg(u) }, { 'Set-Cookie': kapsel(req, token, inn.dager * 86400) }); };
    if (sti === '/api/logginn') {
      if (!inn.aktiv) return json(200, { aktiv: false, token: null });
      const r = inn.sjekk(ip(req), b.bruker, b.passord);
      if (r.sperret) return json(429, { feil: 'For mange forsøk – vent 15 minutter' });
      if (r.blokkert) return json(403, { feil: 'Brukeren er sperret. Kontakt administrator.' });
      if (!r.ok) return json(401, { feil: 'Feil brukernavn eller passord' });
      inn.bruk(r.bruker, 'side'); return loggInn(r.bruker);
    }
    if (sti === '/api/registrer') { const r = inn.registrer(ip(req), b); if (r.feil) return json(r.status || 400, { feil: r.feil }); return loggInn(r.bruker, 201); }
    if (!okt) return json(401, { feil: 'Logg inn i SkogIQ.ai', innlogging: true });
    if (sti === '/api/passord') { const r = inn.byttPassord(okt.u, b.gammelt, b.nytt); if (r.feil) return json(r.status || 400, { feil: r.feil }); return loggInn(okt.u); }
    if (sti === '/api/bruk') { if (['aktiv', 'fane'].includes(b.type)) inn.bruk(okt.u, b.type, b.detalj); return json(200, { ok: true }); }
    if (sti === '/api/admin/bruker') {
      if (!inn.erAdmin(okt.u)) return json(403, { feil: 'Bare for administrator' });
      const r = inn.endreBruker(okt.u, b.bruker, b.handling); return r.feil ? json(r.status || 400, { feil: r.feil }) : json(200, { ok: true });
    }
    return json(404, { feil: 'Finnes ikke' });
  });
  return true;
}

// Stopper forespørsler uten gyldig økt. Sider sendes til innloggingen, alt annet får 401. Gir true når stoppet.
// For innloggede brukere telles sidevisninger og kall til serveren (bruksstatistikken).
export function krevInnlogging(inn, req, res, sti, ekstraHoder = {}) {
  if (!inn.aktiv || req.method === 'OPTIONS' || APENT.test(sti)) return false;
  const okt = inn.fraForesporsel(req);
  const side = req.method === 'GET' && /text\/html/.test(req.headers.accept || '') && !sti.startsWith('/api/');
  if (okt) {
    if (side && /(^\/$|\.html$)/.test(sti)) inn.bruk(okt.u, 'side'); else if (sti.startsWith('/api/')) inn.bruk(okt.u, 'kall');
    if (sti === '/admin.html' && !inn.erAdmin(okt.u)) { res.writeHead(302, { Location: '/', 'Cache-Control': 'no-store', ...ekstraHoder }); res.end(); return true; }
    return false;
  }
  if (side || (req.method === 'GET' && sti.startsWith('/api/jd/') && /text\/html/.test(req.headers.accept || ''))) {
    const neste = new URL(req.url, 'http://x'); res.writeHead(302, { Location: `/logginn.html?neste=${encodeURIComponent(neste.pathname + neste.search)}`, 'Cache-Control': 'no-store', ...ekstraHoder }); res.end(); return true;
  }
  res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...corsFor(req), ...ekstraHoder }); res.end(JSON.stringify({ feil: 'Logg inn i SkogIQ.ai', innlogging: true })); return true;
}
