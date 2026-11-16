// Mellomledd for tilbudsforespørsler (se js/tilbud.js). Oppdragsgiveren legger inn forespørselen og får en eiernøkkel;
// hver mottaker får sin egen kode i lenken (tilbud.html?f=id&k=kode), ser bare forespørselen og sitt eget svar, og kan
// sende og endre tilbudet til saken er avgjort. Mottakerne trenger ikke innlogging. Data slettes etter 180 dager uten bruk.
// Bare Node sitt standardbibliotek. Data i minnet, og i en fil når TILBUD_FIL er satt.
// Det samme mellomleddet brukes for deling med tømmerkjøpere (/api/tommer, js/tommerkjoper.js) med egne svarfelt
// (rens/sjekk) og en sluttdato for lenkene (utloper).
// Nettverket: en mottaker kan være en innkjøper/entreprenør skogeieren er koblet til (mottaker.bruker). Da leveres
// forespørselen i SkogIQ.ai – i mottakerens innboks (innboks(u), «Tilbudsforespørsler» under Nettverk) – i tillegg til lenken.
// Serveren godtar bare brukere avsenderen faktisk er koblet til (ctx.koblet).
import { randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export const TTL_MS = 180 * 24 * 3600 * 1000;
export const MAKS_FORESPORSEL = 400 * 1024; export const MAKS_SVAR = 20 * 1024; export const MAKS_MOTTAKERE = 25; export const MAKS_ANTALL = 5000;
const hex = (n) => randomBytes(n).toString('hex');
const lik = (a, b) => typeof a === 'string' && typeof b === 'string' && timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
const gyldigId = (v) => typeof v === 'string' && /^[a-f0-9]{16}$/.test(v);
const rensTekst = (v, n = 2000) => (v == null ? '' : String(v).slice(0, n));
// Feltene et svar kan ha (alt annet forkastes).
function rensSvar(s = {}) {
  const tall = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
  const dato = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
  const krav = {}; for (const [k, v] of Object.entries(s.krav || {})) if (/^[a-z]{2,20}$/.test(k)) krav[k] = !!v;
  return { prisform: s.prisform === 'fast' ? 'fast' : 'enhet', pris: tall(s.pris), enhetspris: tall(s.enhetspris), oppstart: dato(s.oppstart), ferdig: dato(s.ferdig), gyldigTil: dato(s.gyldigTil), firma: rensTekst(s.firma, 120), orgnr: rensTekst(s.orgnr, 20).replace(/\D/g, ''), kontaktperson: rensTekst(s.kontaktperson, 120), telefon: rensTekst(s.telefon, 40), epost: rensTekst(s.epost, 120), kommentar: rensTekst(s.kommentar, 3000), krav };
}

const datoNaa = (n) => new Date(n).toISOString().slice(0, 10);
const gyldigDato = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
const standardSjekk = (r) => (r.pris == null && r.enhetspris == null ? 'Oppgi pris' : null);
export function lagTilbudRelay({ fil = null, naa = () => Date.now(), rens = rensSvar, sjekk = standardSjekk } = {}) {
  let data = { f: {} };
  if (fil) { try { data = JSON.parse(readFileSync(fil, 'utf8')); } catch { /* ny */ } }
  let t = null; const lagre = () => { if (!fil) return; clearTimeout(t); t = setTimeout(() => { try { writeFileSync(fil, JSON.stringify(data)); } catch { /* ignorer */ } }, 1000); };
  const rydd = () => { const n = naa(); for (const [id, f] of Object.entries(data.f)) if (n - f.brukt > TTL_MS) delete data.f[id]; const ider = Object.keys(data.f); if (ider.length > MAKS_ANTALL) ider.sort((a, b) => data.f[a].brukt - data.f[b].brukt).slice(0, ider.length - MAKS_ANTALL).forEach((id) => delete data.f[id]); };
  const feil = (status, tekst) => ({ feil: tekst, status });
  const sjekkData = (d) => { const s = JSON.stringify(d ?? null); if (!d || typeof d !== 'object') return feil(400, 'Mangler forespørsel'); if (s.length > MAKS_FORESPORSEL) return feil(413, 'Forespørselen er for stor'); return null; };
  // ctx = { fra: { bruker, navn } | null, koblet(fra, til) } – nettverksmottakere godtas bare når de er koblet til avsenderen.
  const leggTilMottakere = (f, liste, ctx = {}) => {
    const koder = {};
    for (const m of liste || []) {
      if (!m?.id || Object.keys(f.mottakere).length >= MAKS_MOTTAKERE) continue;
      const fins = Object.entries(f.mottakere).find(([, x]) => x.id === String(m.id));
      if (fins) { koder[m.id] = fins[0]; fins[1].navn = rensTekst(m.navn, 120); continue; }
      const bruker = m.bruker && ctx.fra?.bruker && ctx.koblet?.(ctx.fra.bruker, String(m.bruker).toLowerCase()) ? String(m.bruker).toLowerCase() : null;
      const kode = hex(12); f.mottakere[kode] = { id: String(m.id).slice(0, 40), navn: rensTekst(m.navn, 120), apnet: null, ...(bruker ? { bruker } : {}) }; koder[m.id] = kode;
    }
    return koder;
  };
  const eier = (id, e) => { const f = gyldigId(id) ? data.f[id] : null; return f && lik(e, f.eier) ? f : null; };
  const mottaker = (id, k) => { const f = gyldigId(id) ? data.f[id] : null; if (!f || typeof k !== 'string') return null; const kode = Object.keys(f.mottakere).find((x) => lik(k, x)); return kode ? { f, m: f.mottakere[kode], kode } : null; };
  const utlopt = (f) => f.utloper && datoNaa(naa()) > f.utloper;
  return {
    opprett({ data: d, mottakere, utloper } = {}, ctx = {}) {
      const s = sjekkData(d); if (s) return s; rydd();
      const id = hex(8); const f = data.f[id] = { eier: hex(16), data: d, status: 'sendt', mottakere: {}, svar: {}, laget: naa(), brukt: naa(), utloper: gyldigDato(utloper), ...(ctx.fra?.bruker ? { fra: { bruker: ctx.fra.bruker, navn: rensTekst(ctx.fra.navn, 120) } } : {}) };
      const koder = leggTilMottakere(f, mottakere, ctx); lagre();
      return { id, eier: f.eier, koder, nettverk: Object.values(f.mottakere).filter((m) => m.bruker).map((m) => m.bruker) };
    },
    oppdater(id, e, { data: d, status, mottakere, utloper } = {}, ctx = {}) {
      const f = eier(id, e); if (!f) return feil(404, 'Forespørselen finnes ikke');
      if (utloper !== undefined) f.utloper = gyldigDato(utloper);
      if (d !== undefined) { const s = sjekkData(d); if (s) return s; f.data = d; }
      if (status && ['sendt', 'tildelt', 'avsluttet'].includes(status)) f.status = status;
      if (status === 'tildelt' && mottakere?.valgt) f.valgt = String(mottakere.valgt);
      const for0 = new Set(Object.values(f.mottakere).filter((m) => m.bruker).map((m) => m.bruker));
      const koder = leggTilMottakere(f, Array.isArray(mottakere) ? mottakere : [], { ...ctx, fra: f.fra || ctx.fra });
      f.brukt = naa(); lagre(); return { ok: true, koder, nettverk: Object.values(f.mottakere).filter((m) => m.bruker && !for0.has(m.bruker)).map((m) => m.bruker) };
    },
    svarFor(id, e) {
      const f = eier(id, e); if (!f) return feil(404, 'Forespørselen finnes ikke'); f.brukt = naa();
      return { status: f.status, utloper: f.utloper || null, svar: Object.entries(f.svar).map(([mid, s]) => ({ mottakerId: mid, ...s })), apnet: Object.fromEntries(Object.values(f.mottakere).map((m) => [m.id, m.apnet])), visninger: Object.fromEntries(Object.values(f.mottakere).map((m) => [m.id, { antall: m.visninger || 0, sist: m.sist || null }])) };
    },
    // Det mottakeren ser. Første visning merkes som «åpnet».
    vis(id, k) {
      const x = mottaker(id, k); if (!x) return feil(404, 'Lenken er ugyldig eller utløpt');
      if (utlopt(x.f)) return feil(410, 'Lenken er utløpt. Ta kontakt med avsenderen for ny tilgang.');
      if (!x.m.apnet) x.m.apnet = naa(); x.m.visninger = (x.m.visninger || 0) + 1; x.m.sist = naa(); x.f.brukt = naa(); lagre();
      return { data: x.f.data, status: x.f.status, utloper: x.f.utloper || null, mottaker: { navn: x.m.navn }, svar: x.f.svar[x.m.id] || null, vunnet: x.f.status === 'tildelt' ? x.f.valgt === x.m.id : null };
    },
    svar(id, k, s) {
      const x = mottaker(id, k); if (!x) return feil(404, 'Lenken er ugyldig eller utløpt');
      if (utlopt(x.f)) return feil(410, 'Lenken er utløpt');
      if (x.f.status !== 'sendt') return feil(409, 'Forespørselen er avgjort – tilbud kan ikke sendes eller endres');
      if (JSON.stringify(s || {}).length > MAKS_SVAR) return feil(413, 'Tilbudet er for stort');
      const r = rens(s); const mangel = sjekk(r); if (mangel) return feil(400, mangel);
      x.f.svar[x.m.id] = { ...r, mottatt: new Date(naa()).toISOString(), endret: x.f.svar[x.m.id] ? true : false }; x.f.brukt = naa(); lagre();
      return { ok: true, mottatt: x.f.svar[x.m.id].mottatt };
    },
    // Lagrede data (internt: tittel og sted i varselet når mottakere legges til senere).
    dataFor: (id) => (gyldigId(id) ? data.f[id]?.data || null : null),
    // Innboksen til en innkjøper/entreprenør: forespørslene der hen er nettverksmottaker, nyeste først.
    innboks(u) {
      const ut = []; const idag = datoNaa(naa());
      for (const [id, f] of Object.entries(data.f)) for (const [kode, m] of Object.entries(f.mottakere)) {
        if (m.bruker !== u) continue; const d = f.data || {}; const om = d.omfang?.bestand || [];
        const svar = f.svar[m.id] || null;
        ut.push({ id, kode, tittel: d.tittel || d.typeNavn || 'Tilbudsforespørsel', typeNavn: d.typeNavn || '', sted: d.sted || '', bestand: om.length, areal: Math.round(om.reduce((s, b) => s + (Number(b.areal) || 0), 0) * 10) / 10, svarfrist: d.svarfrist || null, fra: f.fra?.navn || d.kontakt?.navn || '', fraBruker: f.fra?.bruker || null, laget: f.laget, status: f.status, apnet: m.apnet || null, svart: svar ? svar.mottatt : null, vunnet: f.status === 'tildelt' ? f.valgt === m.id : null, fristUte: !!(d.svarfrist && d.svarfrist < idag), utlopt: utlopt(f) });
      }
      return ut.sort((a, b) => b.laget - a.laget);
    },
    slett(id, e) { const f = eier(id, e); if (!f) return feil(404, 'Forespørselen finnes ikke'); delete data.f[id]; lagre(); return { ok: true }; },
  };
}

// HTTP: /api/tilbud… – gir true når forespørselen er håndtert.
const TILLATT_OPPHAV = /^(https:\/\/(skogiq-production\.up\.railway\.app|trond-web\.github\.io)|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
// Mottakerens kall (visning og svar) er åpne – koden i lenken gir tilgang.
export const erMottakerKall = (metode, sti, prefiks = '/api/tilbud') => (metode === 'GET' && sti.startsWith(`${prefiks}/`) && /^\/[a-f0-9]{16}$/.test(sti.slice(prefiks.length))) || (metode === 'POST' && sti.startsWith(`${prefiks}/`) && /^\/[a-f0-9]{16}\/svar$/.test(sti.slice(prefiks.length)));
// ctx (valgfritt, innloggede kall): { bruker(req) → { bruker, navn } | null, koblet(fra, til), varsle(fra, til, tekst, f) }.
export function tilbudApi(relay, req, res, sti, ekstraHoder = {}, prefiks = '/api/tilbud', ctx = null) {
  if (sti !== prefiks && !sti.startsWith(`${prefiks}/`)) return false;
  const o = req.headers.origin; const cors = o && TILLATT_OPPHAV.test(o) ? { 'Access-Control-Allow-Origin': o, Vary: 'Origin' } : {};
  const json = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors, ...ekstraHoder }); res.end(JSON.stringify(obj)); };
  const svar = (r) => (r?.feil ? json(r.status || 400, { feil: r.feil }) : json(200, r));
  const q = new URL(req.url, 'http://x').searchParams;
  const kropp = () => new Promise((ok) => { let n = 0; const d = []; req.on('data', (b) => { n += b.length; if (n > MAKS_FORESPORSEL + 10000) { req.destroy(); ok(null); } else d.push(b); }); req.on('end', () => { try { ok(JSON.parse(Buffer.concat(d).toString('utf8') || '{}')); } catch { ok(null); } }); req.on('error', () => ok(null)); });
  (async () => {
    if (sti === `${prefiks}/innboks`) { const b = ctx?.bruker(req); if (!b) return json(401, { feil: 'Logg inn i SkogIQ.ai', innlogging: true }); return json(200, { innboks: relay.innboks ? relay.innboks(b.bruker) : [] }); }
    const fra = ctx?.bruker(req) || null; const rctx = ctx ? { fra, koblet: ctx.koblet } : {};
    // Gi beskjed i nettverket (chat) til nettverksmottakerne.
    const varsle = (brukere, d) => { if (!fra || !ctx?.varsle) return; for (const til of brukere || []) try { ctx.varsle(fra.bruker, til, d); } catch { /* varsel er ikke kritisk */ } };
    const m = sti.slice(prefiks.length).match(/^(?:\/([a-f0-9]{16}))?(\/svar)?$/); if (!m) return json(404, { feil: 'Finnes ikke' });
    const [, id, del] = m; const e = q.get('e'); const k = q.get('k');
    if (!id && req.method === 'POST') { const b = await kropp(); if (!b) return json(400, { feil: 'Ugyldig forespørsel' }); const r = relay.opprett(b, rctx); if (!r.feil) varsle(r.nettverk, b.data); return svar(r); }
    if (id && !del && req.method === 'PUT') { const b = await kropp(); if (!b) return json(400, { feil: 'Ugyldig forespørsel' }); const r = relay.oppdater(id, e, b, rctx); if (!r.feil) varsle(r.nettverk, b.data || relay.dataFor?.(id)); return svar(r); }
    if (id && !del && req.method === 'DELETE') return svar(relay.slett(id, e));
    if (id && !del && req.method === 'GET') return svar(relay.vis(id, k));
    if (id && del && req.method === 'GET') return svar(relay.svarFor(id, e));
    if (id && del && req.method === 'POST') { const b = await kropp(); return b ? svar(relay.svar(id, k, b)) : json(400, { feil: 'Ugyldig tilbud' }); }
    return json(405, { feil: 'Metoden er ikke tillatt' });
  })().catch(() => json(500, { feil: 'Serverfeil' }));
  return true;
}
