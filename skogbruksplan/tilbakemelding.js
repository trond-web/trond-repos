// Tilbakemeldinger og forbedringsforslag fra brukerne (js/tilbakemelding-ui.js), med 1–5 stjerner for fornøydhet.
// Hver tilbakemelding er en samtale (tråd): brukeren og administrator skriver fram og tilbake, og statusendringer
// logges i tråden. Begge ser hele loggen – administrator i admin.html, brukeren under «Mine tilbakemeldinger» – og
// uleste meldinger telles for hver side (lestBruker/lestAdmin = tidspunkt sist lest). Lagres i en JSON-fil på volumet (ved siden av BRUKER_FIL), og slettes og eksporteres
// sammen med kontoen. Bare Node sitt standardbibliotek.
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';

export const TYPER = ['forslag', 'feil', 'ros', 'annet'];
export const STATUSER = ['ny', 'vurderes', 'planlagt', 'lost', 'avvist'];
export const MAKS_TEKST = 3000; export const MAKS_SVAR = 2000; export const PER_TIME = 10; export const MAKS_ANTALL = 5000; export const MAKS_MELDINGER = 200;
export const STATUS_NAVN = { ny: 'Ny', vurderes: 'Vurderes', planlagt: 'Planlagt', lost: 'Løst', avvist: 'Avvist' };
const tekst = (v, n) => String(v ?? '').replace(/\r/g, '').trim().slice(0, n);

export function lagTilbakemelding({ fil = null, naa = () => Date.now() } = {}) {
  let data = { liste: [] };
  if (fil) try { data = { liste: [], ...JSON.parse(readFileSync(fil, 'utf8')) }; } catch { /* ny */ }
  let t = null; const lagre = () => { if (!fil) return; clearTimeout(t); t = setTimeout(() => { try { writeFileSync(`${fil}.tmp`, JSON.stringify(data)); renameSync(`${fil}.tmp`, fil); } catch (e) { console.error('Tilbakemeldinger: klarte ikke å lagre:', e.message); } }, 300); };
  const sendt = new Map(); // bruker → tidspunkter (spamgrense)
  // Eldre tilbakemeldinger med ett svar-felt får svaret som første melding i tråden.
  const sikreTraad = (x) => { if (!x.traad) { x.traad = x.svar ? [{ fra: 'admin', tekst: x.svar, tid: x.svarTid || x.endret || x.tid }] : []; x.lestBruker ??= x.svar ? (x.svarTid || 0) : 0; x.lestAdmin ??= x.tid; } return x.traad; };
  for (const x of data.liste) sikreTraad(x);
  const sisteFra = (x, fra) => sikreTraad(x).filter((m) => m.fra === fra).at(-1) || null;
  const ulest = (x, side) => sikreTraad(x).filter((m) => m.fra === (side === 'bruker' ? 'admin' : 'bruker') && m.tid > (side === 'bruker' ? x.lestBruker || 0 : x.lestAdmin || 0)).length;
  const offentlig = (x, side = 'bruker') => { const s = sisteFra(x, 'admin'); return { id: x.id, stjerner: x.stjerner, type: x.type, tekst: x.tekst, fane: x.fane, versjon: x.versjon, tid: x.tid, status: x.status, traad: sikreTraad(x).map((m) => ({ fra: m.fra, tekst: m.tekst, tid: m.tid, ...(m.navn ? { navn: m.navn } : {}) })), ulest: ulest(x, side), sist: sikreTraad(x).at(-1)?.tid || x.tid, svar: s?.tekst || '', svarTid: s?.tid || null, endret: x.endret || null }; };
  // Siste aktivitet først; ved likt tidspunkt den sist mottatte først
  const nyesteForst = (l) => l.map((x, i) => [x, i]).sort((a, b) => b[0].sist - a[0].sist || b[1] - a[1]).map(([x]) => x);
  const leggTil = (x, m) => { sikreTraad(x).push(m); if (x.traad.length > MAKS_MELDINGER) x.traad.splice(0, x.traad.length - MAKS_MELDINGER); x.endret = m.tid; };
  return {
    // Ny tilbakemelding. Stjerner (1–5) og/eller tekst må være med.
    send(u, { stjerner, type = 'annet', tekst: tx = '', fane = '', versjon = '' } = {}, { navn = '' } = {}) {
      if (!u) return { feil: 'Logg inn', status: 401 };
      const s = stjerner == null || stjerner === '' ? null : Number(stjerner);
      if (s != null && !(Number.isInteger(s) && s >= 1 && s <= 5)) return { feil: 'Stjerner må være 1–5', status: 400 };
      const ty = TYPER.includes(type) ? type : 'annet'; const innhold = tekst(tx, MAKS_TEKST);
      if (!s && !innhold) return { feil: 'Gi stjerner eller skriv noen ord', status: 400 };
      if (ty !== 'ros' && ty !== 'annet' && innhold.length < 5) return { feil: 'Skriv litt mer, så vi skjønner hva du mener', status: 400 };
      const tid = naa(); const l = (sendt.get(u) || []).filter((x) => tid - x < 3600000);
      if (l.length >= PER_TIME) return { feil: 'Mange gode tanker på en gang! Prøv igjen om en stund.', status: 429 };
      l.push(tid); sendt.set(u, l);
      const x = { id: randomBytes(6).toString('hex'), bruker: u, navn: tekst(navn, 80), stjerner: s, type: ty, tekst: innhold, fane: tekst(fane, 40), versjon: tekst(versjon, 20), tid, status: 'ny', traad: [], lestBruker: tid, lestAdmin: 0 };
      data.liste.push(x); if (data.liste.length > MAKS_ANTALL) data.liste.splice(0, data.liste.length - MAKS_ANTALL);
      lagre(); return { ok: true, tilbakemelding: offentlig(x) };
    },
    mine(u) { return nyesteForst(data.liste.filter((x) => x.bruker === u).map((x) => offentlig(x))); },
    uleste(u) { return data.liste.filter((x) => x.bruker === u).reduce((n, x) => n + ulest(x, 'bruker'), 0); },
    // Brukeren skriver i sin egen tråd. En lukket sak (løst/avvist) åpnes igjen («vurderes»).
    skriv(u, id, tx) {
      const x = data.liste.find((y) => y.id === id && y.bruker === u); if (!x) return { feil: 'Finnes ikke', status: 404 };
      const innhold = tekst(tx, MAKS_SVAR); if (!innhold) return { feil: 'Skriv en melding', status: 400 };
      const tid = naa(); const l = (sendt.get(u) || []).filter((y) => tid - y < 3600000);
      if (l.length >= PER_TIME * 3) return { feil: 'Mange meldinger på kort tid – prøv igjen om en stund.', status: 429 };
      l.push(tid); sendt.set(u, l);
      leggTil(x, { fra: 'bruker', tekst: innhold, tid }); x.lestBruker = tid;
      if (['lost', 'avvist'].includes(x.status)) { x.status = 'vurderes'; leggTil(x, { fra: 'system', tekst: `Status: ${STATUS_NAVN.vurderes} (åpnet igjen)`, tid }); }
      lagre(); return { ok: true, tilbakemelding: offentlig(x) };
    },
    lestBruker(u, id) { const x = data.liste.find((y) => y.id === id && y.bruker === u); if (!x) return { feil: 'Finnes ikke', status: 404 }; x.lestBruker = naa(); lagre(); return { ok: true }; },
    // Oversikt for administrator: alle, med snitt og fordeling av stjerner og antall per status.
    alle() {
      const med = data.liste.filter((x) => x.stjerner);
      const fordeling = [1, 2, 3, 4, 5].map((n) => med.filter((x) => x.stjerner === n).length);
      const status = Object.fromEntries(STATUSER.map((s) => [s, data.liste.filter((x) => x.status === s).length]));
      const liste = nyesteForst(data.liste.map((x) => ({ ...offentlig(x, 'admin'), bruker: x.bruker, navn: x.navn })));
      return { antall: data.liste.length, snitt: med.length ? Math.round((med.reduce((s, x) => s + x.stjerner, 0) / med.length) * 10) / 10 : null, fordeling, status, uleste: liste.filter((x) => x.ulest).length, liste };
    },
    // Administrator: ny status (logges i tråden), ny melding (svar/melding) og/eller lest.
    oppdater(id, { status, svar, melding, lest, navn = '' } = {}) {
      const x = data.liste.find((y) => y.id === id); if (!x) return { feil: 'Finnes ikke', status: 404 };
      if (status !== undefined && !STATUSER.includes(status)) return { feil: 'Ukjent status', status: 400 };
      const tid = naa(); const innhold = tekst(melding ?? svar ?? '', MAKS_SVAR);
      if (innhold) leggTil(x, { fra: 'admin', tekst: innhold, tid, ...(navn ? { navn: tekst(navn, 80) } : {}) });
      if (status !== undefined && status !== x.status) { x.status = status; leggTil(x, { fra: 'system', tekst: `Status: ${STATUS_NAVN[status]}`, tid }); }
      if (innhold || lest) x.lestAdmin = tid;
      x.endret = tid; lagre(); return { ok: true, tilbakemelding: offentlig(x, 'admin') };
    },
    slett(id) { const i = data.liste.findIndex((y) => y.id === id); if (i < 0) return false; data.liste.splice(i, 1); lagre(); return true; },
    slettBruker(u) { const n = data.liste.length; data.liste = data.liste.filter((x) => x.bruker !== u); if (data.liste.length !== n) lagre(); },
    eksport(u) { return this.mine(u); },
    flush() { if (fil) { clearTimeout(t); writeFileSync(`${fil}.tmp`, JSON.stringify(data)); renameSync(`${fil}.tmp`, fil); } },
  };
}

// HTTP: POST /api/tilbakemelding (send), GET /api/tilbakemelding/mine, GET /api/tilbakemelding/uleste,
// POST /api/tilbakemelding/:id/melding (brukeren svarer), POST /api/tilbakemelding/:id/lest,
// GET /api/admin/tilbakemelding (alle), PUT/DELETE /api/admin/tilbakemelding/:id (status, melding, lest).
// meg(req) → { bruker, navn, admin } eller null.
export function tilbakemeldingApi(tb, { meg, cors = () => ({}) }, req, res, sti, ekstraHoder = {}) {
  const admin = sti === '/api/admin/tilbakemelding' || sti.startsWith('/api/admin/tilbakemelding/');
  const traad = sti.match(/^\/api\/tilbakemelding\/([0-9a-f]{6,24})\/(melding|lest)$/);
  if (sti !== '/api/tilbakemelding' && sti !== '/api/tilbakemelding/mine' && sti !== '/api/tilbakemelding/uleste' && !traad && !admin) return false;
  const json = (s, o) => { res.writeHead(s, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req), ...ekstraHoder }); res.end(JSON.stringify(o)); };
  const m = meg(req); if (!m) { json(401, { feil: 'Logg inn i SkogIQ.ai', innlogging: true }); return true; }
  if (!tb) { json(503, { feil: 'Tilbakemeldinger krever registrering av brukere' }); return true; }
  const kropp = () => new Promise((ok) => { let n = 0; const d = []; req.on('data', (c) => { n += c.length; if (n > 16384) { req.destroy(); ok(null); } else d.push(c); }); req.on('end', () => { try { ok(JSON.parse(Buffer.concat(d).toString('utf8') || '{}')); } catch { ok(null); } }); req.on('error', () => ok(null)); });
  if (admin) {
    if (!m.admin) { json(403, { feil: 'Bare for administrator' }); return true; }
    if (sti === '/api/admin/tilbakemelding') { if (req.method !== 'GET') json(405, { feil: 'Metoden er ikke tillatt' }); else json(200, tb.alle()); return true; }
    const id = sti.slice('/api/admin/tilbakemelding/'.length);
    if (req.method === 'DELETE') { const ok = tb.slett(id); json(ok ? 200 : 404, ok ? { ok: true } : { feil: 'Finnes ikke' }); return true; }
    if (req.method !== 'PUT') { json(405, { feil: 'Metoden er ikke tillatt' }); return true; }
    kropp().then((b) => { if (!b) return json(400, { feil: 'Ugyldig forespørsel' }); const r = tb.oppdater(id, { ...b, navn: m.navn }); json(r.feil ? r.status : 200, r); });
    return true;
  }
  if (sti === '/api/tilbakemelding/mine') { json(200, { liste: tb.mine(m.bruker), uleste: tb.uleste(m.bruker) }); return true; }
  if (sti === '/api/tilbakemelding/uleste') { json(200, { uleste: tb.uleste(m.bruker) }); return true; }
  if (traad) {
    if (req.method !== 'POST') { json(405, { feil: 'Metoden er ikke tillatt' }); return true; }
    if (traad[2] === 'lest') { const r = tb.lestBruker(m.bruker, traad[1]); json(r.feil ? r.status : 200, r); return true; }
    kropp().then((b) => { if (!b) return json(400, { feil: 'Ugyldig forespørsel' }); const r = tb.skriv(m.bruker, traad[1], b.tekst); json(r.feil ? r.status : 201, r); });
    return true;
  }
  if (req.method !== 'POST') { json(405, { feil: 'Metoden er ikke tillatt' }); return true; }
  kropp().then((b) => { if (!b) return json(400, { feil: 'Ugyldig forespørsel' }); const r = tb.send(m.bruker, b, { navn: m.navn }); json(r.feil ? r.status : 201, r); });
  return true;
}
