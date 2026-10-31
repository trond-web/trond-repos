// Skylagring: hver bruker har sine skogbruksplaner lagret på serveren, slik at de ikke er avhengige av én enhet.
// Enhetene (fullversjonen og SkogIQ Felt) har en lokal kopi for bruk uten nett, og synkroniserer med serveren
// (js/sky.js). Hver lagring får et versjonsnummer; den som sender med feil grunnversjon, får 409 og den gjeldende
// versjonen tilbake for fletting. De siste versjonene tas vare på (historikk), og slettede planer ligger i en
// papirkurv i 30 dager før de fjernes for godt.
// Lagring: én mappe per bruker (sha256 av brukernavnet) under SKY_MAPPE, med én JSON-fil per plan og historikk i
// undermapper. Filene skrives via midlertidig fil (aldri halvskrevne). Uten mappe holdes alt i minnet (test/utvikling).
// Bare Node sitt standardbibliotek.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, readdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';

export const GYLDIG_PLAN_ID = /^[A-Za-z0-9_-]{4,64}$/;
export const MAKS_PLAN = 25 * 1024 * 1024; // byte (base64)
export const KVOTE = 300 * 1024 * 1024; // per bruker
export const MAKS_ANTALL = 1000; // planer per bruker
export const HISTORIKK = 10; // tidligere versjoner per plan
export const PAPIRKURV_MS = 30 * 24 * 3600 * 1000;

const mappeFor = (bruker) => createHash('sha256').update(String(bruker).toLowerCase()).digest('hex').slice(0, 32);
const tekst = (v, n) => String(v ?? '').slice(0, n);
// Små metadata om planen (vises i planlisten uten å laste ned planen).
function rensMeta(m = {}) {
  const tall = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 10) / 10 : null);
  return { areal: tall(m.areal), antall: tall(m.antall), kommune: tekst(m.kommune, 60), gnrbnr: tekst(m.gnrbnr, 40) };
}

export function lagSkyLager({ mappe = null, naa = () => Date.now(), kvote = KVOTE, maksAntall = MAKS_ANTALL, historikk = HISTORIKK } = {}) {
  const minne = new Map(); // bruker → Map(id → post), og `${bruker}|h|${id}` → [tidligere poster]
  const brukerMappe = (b) => path.join(mappe, mappeFor(b));
  const skrivFil = (fil, data) => { mkdirSync(path.dirname(fil), { recursive: true }); writeFileSync(`${fil}.tmp`, JSON.stringify(data)); renameSync(`${fil}.tmp`, fil); };
  const lesFil = (fil) => { try { return JSON.parse(readFileSync(fil, 'utf8')); } catch { return null; } };

  function poster(bruker) {
    if (!mappe) { if (!minne.has(bruker)) minne.set(bruker, new Map()); return minne.get(bruker); }
    const m = new Map(); const d = brukerMappe(bruker);
    if (!existsSync(d)) return m;
    for (const f of readdirSync(d)) if (f.endsWith('.json')) { const p = lesFil(path.join(d, f)); if (p?.id) m.set(p.id, p); }
    return m;
  }
  const hentPost = (bruker, id) => (mappe ? lesFil(path.join(brukerMappe(bruker), `${id}.json`)) : poster(bruker).get(id) || null);
  const skrivPost = (bruker, p) => { if (mappe) skrivFil(path.join(brukerMappe(bruker), `${p.id}.json`), p); else poster(bruker).set(p.id, p); };
  const fjernPost = (bruker, id) => {
    if (mappe) { rmSync(path.join(brukerMappe(bruker), `${id}.json`), { force: true }); rmSync(path.join(brukerMappe(bruker), 'historikk', id), { recursive: true, force: true }); } else { poster(bruker).delete(id); minne.delete(`${bruker}|h|${id}`); }
  };
  function historikkListe(bruker, id) {
    if (!mappe) return minne.get(`${bruker}|h|${id}`) || [];
    const d = path.join(brukerMappe(bruker), 'historikk', id); if (!existsSync(d)) return [];
    return readdirSync(d).filter((f) => /^\d+\.json$/.test(f)).map((f) => lesFil(path.join(d, f))).filter(Boolean).sort((a, b) => b.versjon - a.versjon);
  }
  function leggIHistorikk(bruker, p) {
    if (!mappe) { const l = [p, ...historikkListe(bruker, p.id)].slice(0, historikk); minne.set(`${bruker}|h|${p.id}`, l); return; }
    const d = path.join(brukerMappe(bruker), 'historikk', p.id);
    skrivFil(path.join(d, `${p.versjon}.json`), p);
    const filer = readdirSync(d).filter((f) => /^\d+\.json$/.test(f)).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
    for (const f of filer.slice(historikk)) rmSync(path.join(d, f), { force: true });
  }
  const info = (p) => ({ id: p.id, navn: p.navn, versjon: p.versjon, endret: p.endret, laget: p.laget, enhet: p.enhet, storrelse: p.plan.length, meta: p.meta || {}, ...(p.slettet ? { slettet: p.slettet } : {}) });
  // Tømmer papirkurven for planer slettet for mer enn 30 dager siden.
  function rydd(bruker, alle) { for (const p of alle.values()) if (p.slettet && naa() - p.slettet > PAPIRKURV_MS) { fjernPost(bruker, p.id); alle.delete(p.id); } }

  return {
    permanent: !!mappe,
    liste(bruker, { slettede = false } = {}) {
      const alle = poster(bruker); rydd(bruker, alle);
      return [...alle.values()].filter((p) => !!p.slettet === slettede).map(info).sort((a, b) => b.endret - a.endret);
    },
    info(bruker, id) { if (!GYLDIG_PLAN_ID.test(String(id))) return null; const p = hentPost(bruker, id); return p ? info(p) : null; },
    hent(bruker, id, { versjon = null } = {}) {
      if (!GYLDIG_PLAN_ID.test(String(id))) return null;
      const p = hentPost(bruker, id); if (!p) return null;
      const v = versjon == null || Number(versjon) === p.versjon ? p : historikkListe(bruker, id).find((x) => x.versjon === Number(versjon));
      return v ? { ...info(v), plan: v.plan, gzip: v.gzip, gjeldendeVersjon: p.versjon } : null;
    },
    // Lagre en ny versjon. grunnVersjon er versjonen enheten bygget på (null for en ny plan).
    lagre(bruker, id, { plan, gzip = true, navn = '', meta = {}, grunnVersjon = null, enhet = '', gjenopprett = false } = {}) {
      if (!GYLDIG_PLAN_ID.test(String(id))) return { feil: 'Ugyldig plan-id', status: 400 };
      if (typeof plan !== 'string' || !plan.length) return { feil: 'Mangler plan', status: 400 };
      if (plan.length > MAKS_PLAN) return { feil: 'Planen er for stor (maks 25 MB)', status: 413 };
      if (!/^[A-Za-z0-9+/=]+$/.test(plan.slice(0, 2000))) return { feil: 'Ugyldig plan', status: 400 };
      const alle = poster(bruker); const gml = alle.get(id) || null;
      if (gml && !gml.slettet && grunnVersjon !== gml.versjon) return { feil: 'Planen er endret på en annen enhet', status: 409, gjeldende: info(gml) };
      // En slettet plan kommer ikke tilbake fordi en annen enhet fortsatt har den – bare ved uttrykkelig gjenoppretting.
      if (gml?.slettet && !gjenopprett) return { feil: 'Planen er slettet', status: 410, gjeldende: info(gml) };
      const brukt = [...alle.values()].reduce((s, p) => s + (p.id === id ? 0 : p.plan.length), 0);
      if (brukt + plan.length > kvote) return { feil: `Lagringsplassen er full (${Math.round(kvote / 1048576)} MB). Slett planer du ikke trenger, eller tøm papirkurven.`, status: 507 };
      if (!gml && [...alle.values()].filter((p) => !p.slettet).length >= maksAntall) return { feil: `Du kan ha høyst ${maksAntall} planer i skyen`, status: 507 };
      if (gml) leggIHistorikk(bruker, gml);
      const p = { id, plan, gzip: !!gzip, navn: tekst(navn, 120), meta: rensMeta(meta), enhet: tekst(enhet, 40), versjon: (gml?.versjon || 0) + 1, endret: naa(), laget: gml?.laget || naa() };
      skrivPost(bruker, p);
      return info(p);
    },
    // Myk sletting: planen havner i papirkurven og kan gjenopprettes i 30 dager.
    slett(bruker, id) { const p = GYLDIG_PLAN_ID.test(String(id)) ? hentPost(bruker, id) : null; if (!p || p.slettet) return false; skrivPost(bruker, { ...p, slettet: naa() }); return true; },
    gjenopprett(bruker, id) { const p = GYLDIG_PLAN_ID.test(String(id)) ? hentPost(bruker, id) : null; if (!p?.slettet) return null; const { slettet, ...rest } = p; const ny = { ...rest, versjon: p.versjon + 1, endret: naa() }; skrivPost(bruker, ny); return info(ny); },
    slettForGodt(bruker, id) { const p = GYLDIG_PLAN_ID.test(String(id)) ? hentPost(bruker, id) : null; if (!p) return false; fjernPost(bruker, id); return true; },
    versjoner(bruker, id) {
      const p = GYLDIG_PLAN_ID.test(String(id)) ? hentPost(bruker, id) : null; if (!p) return null;
      return [p, ...historikkListe(bruker, id)].map((x) => ({ versjon: x.versjon, endret: x.endret, enhet: x.enhet, storrelse: x.plan.length, meta: x.meta || {} }));
    },
    bruk(bruker) { const alle = poster(bruker); const aktive = [...alle.values()].filter((p) => !p.slettet); return { antall: aktive.length, papirkurv: alle.size - aktive.length, bytes: [...alle.values()].reduce((s, p) => s + p.plan.length, 0), kvote, sist: Math.max(0, ...aktive.map((p) => p.endret)) || null }; },
    slettBruker(bruker) { if (mappe) rmSync(brukerMappe(bruker), { recursive: true, force: true }); else { minne.delete(bruker); for (const k of [...minne.keys()]) if (k.startsWith(`${bruker}|h|`)) minne.delete(k); } },
  };
}

// HTTP: /api/sky/… og /api/konto/profil. bruker(req) gir innlogget brukernavn (null = ikke innlogget).
// profil: { hent(u), lagre(u, data) } fra innloggingen. Gir true når forespørselen er håndtert.
export function skyApi(lager, { bruker, profil, cors = () => ({}) }, req, res, sti, ekstraHoder = {}) {
  if (!sti.startsWith('/api/sky/') && sti !== '/api/konto/profil') return false;
  const json = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req), ...ekstraHoder }); res.end(JSON.stringify(obj)); };
  const u = bruker(req);
  if (!u) { json(401, { feil: 'Logg inn i SkogIQ.ai', innlogging: true }); return true; }
  const kropp = (maks) => new Promise((ok) => {
    let n = 0; const deler = [];
    req.on('data', (d) => { n += d.length; if (n > maks) { req.destroy(); ok(null); } else deler.push(d); });
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(deler).toString('utf8') || '{}')); } catch { ok(null); } });
    req.on('error', () => ok(null));
  });
  const q = new URL(req.url, 'http://x').searchParams;
  (async () => {
    if (sti === '/api/konto/profil') {
      if (req.method === 'GET') return json(200, { profil: profil.hent(u), sky: lager.bruk(u) });
      if (req.method === 'PUT') { const b = await kropp(20000); if (!b) return json(400, { feil: 'Ugyldig forespørsel' }); const r = profil.lagre(u, b.profil || b); return r.feil ? json(r.status || 400, r) : json(200, { profil: r.profil }); }
      return json(405, { feil: 'Metoden er ikke tillatt' });
    }
    if (sti === '/api/sky/planer' && req.method === 'GET') return json(200, { planer: lager.liste(u, { slettede: q.get('slettede') === '1' }), bruk: lager.bruk(u) });
    const m = sti.match(/^\/api\/sky\/planer\/([A-Za-z0-9_-]{4,64})(\/info|\/versjoner|\/gjenopprett)?$/);
    if (!m) return json(404, { feil: 'Finnes ikke' });
    const [, id, del] = m;
    if (!del && req.method === 'GET') { const r = lager.hent(u, id, { versjon: q.get('versjon') }); return r ? json(200, r) : json(404, { feil: 'Planen finnes ikke i skyen' }); }
    if (!del && req.method === 'PUT') { const b = await kropp(MAKS_PLAN + 100000); if (!b) return json(400, { feil: 'Ugyldig forespørsel' }); const r = lager.lagre(u, id, b); return r.feil ? json(r.status, r) : json(200, r); }
    if (!del && req.method === 'DELETE') { if (q.get('forGodt') === '1') return lager.slettForGodt(u, id) ? json(200, { ok: true }) : json(404, { feil: 'Finnes ikke' }); return lager.slett(u, id) ? json(200, { ok: true }) : json(404, { feil: 'Finnes ikke' }); }
    if (del === '/info' && req.method === 'GET') { const r = lager.info(u, id); return r ? json(200, r) : json(404, { feil: 'Planen finnes ikke i skyen' }); }
    if (del === '/versjoner' && req.method === 'GET') { const r = lager.versjoner(u, id); return r ? json(200, { versjoner: r }) : json(404, { feil: 'Finnes ikke' }); }
    if (del === '/gjenopprett' && req.method === 'POST') { const r = lager.gjenopprett(u, id); return r ? json(200, r) : json(404, { feil: 'Planen er ikke i papirkurven' }); }
    return json(405, { feil: 'Metoden er ikke tillatt' });
  })().catch((e) => { console.error('Skylagring:', e.message); json(500, { feil: 'Serverfeil ved lagring' }); });
  return true;
}
