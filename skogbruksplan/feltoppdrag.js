// Feltoppdrag til entreprenører: skogeieren tildeler et oppdrag på web og sender det (med hele planen) til en
// entreprenør hen er koblet til i Nettverk. Entreprenøren gjennomfører oppdraget i SkogIQ Entreprenør
// (entreprenor.html): framdrift og mengde per bestand, miljøsjekk og avvik med bilde og posisjon, og sluttrapport
// med signatur. Rapporten går tilbake til skogeieren, som tar den inn i planen. Ingen PDF-skjema.
// Bare Node sitt standardbibliotek. Data i minnet, og i en fil (FELTOPPDRAG_FIL, ellers feltoppdrag.json på volumet).
//
//   * Bare skogeieren (eier) og entreprenøren (utforer) har tilgang. Krever aktiv kobling i Nettverk ved sending.
//   * Planen lagres som skogeieren sendte den (snapshot); skogeieren kan sende en oppdatert plan.
//   * Rapporten eies av entreprenøren og skrives med versjonsnummer (409 ved utdatert versjon).
//   * Lagres til delingen slettes, eller 365 dager etter at oppdraget er avsluttet. Slettes med kontoen til begge parter.
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export const MAKS_PLAN = 20 * 1024 * 1024; // tegn (JSON)
export const MAKS_RAPPORT = 8 * 1024 * 1024; // tegn – bilder er nedskalert i nettleseren
export const MAKS_BILDER = 30;
export const TTL_AVSLUTTET = 365 * 24 * 3600 * 1000;
export const STATUS = { sendt: 'Sendt', mottatt: 'Mottatt', pagar: 'Pågår', ferdigmeldt: 'Ferdigmeldt', godkjent: 'Godkjent', trukket: 'Trukket' };
export const STOTTEDE = ['sluttavvirkning', 'tynning', 'lukkethogst', 'planting', 'suppleringsplanting', 'markberedning', 'ungskogpleie', 'gjodsling'];
const id = () => randomBytes(10).toString('hex');
const tekst = (v, n) => String(v ?? '').trim().slice(0, n);

// Rapporten fra entreprenøren: bare kjente felt, med lengdegrenser.
export function rensRapport(r = {}) {
  const tall = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Math.max(0, Number(v)));
  const pos = (p) => (Array.isArray(p) && p.length === 2 && p.every((x) => Number.isFinite(Number(x))) ? [Number(p[0]), Number(p[1])] : null);
  const bilde = (b) => (typeof b === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b) && b.length < 600000 ? b : null);
  const linjer = {};
  for (const [k, v] of Object.entries(r.linjer || {}).slice(0, 500)) {
    if (!/^[\w-]{1,40}$/.test(k) || !v || typeof v !== 'object') continue;
    linjer[k] = { status: ['ikke', 'pagar', 'ferdig'].includes(v.status) ? v.status : 'ikke', start: tekst(v.start, 10), ferdig: tekst(v.ferdig, 10), areal: tall(v.areal), mengde: tall(v.mengde), merknad: tekst(v.merknad, 500) };
  }
  const miljo = {};
  for (const [k, v] of Object.entries(r.miljo || {}).slice(0, 60)) if (/^[\w-]{1,40}$/.test(k) && ['ok', 'avvik', 'ikke-aktuelt'].includes(v?.svar)) miljo[k] = { svar: v.svar, tid: tekst(v.tid, 30), merknad: tekst(v.merknad, 300) };
  let n = 0;
  const avvik = (Array.isArray(r.avvik) ? r.avvik : []).slice(0, 100).map((a) => ({
    id: tekst(a.id, 40) || id(), type: tekst(a.type, 40), beskrivelse: tekst(a.beskrivelse, 1000), tid: tekst(a.tid, 30), pos: pos(a.pos), bestandId: tekst(a.bestandId, 40), utbedret: !!a.utbedret,
    bilder: (Array.isArray(a.bilder) ? a.bilder : []).map(bilde).filter(Boolean).filter(() => n++ < MAKS_BILDER),
  }));
  const s = r.slutt && typeof r.slutt === 'object' ? { navn: tekst(r.slutt.navn, 80), dato: tekst(r.slutt.dato, 10), merknad: tekst(r.slutt.merknad, 2000), signatur: bilde(r.slutt.signatur) } : null;
  return { linjer, miljo, avvik, slutt: s?.signatur && s.navn ? s : null, timer: tall(r.timer) };
}

export function lagFeltoppdrag({ fil = null, naa = () => Date.now(), koblet = () => false, erEntreprenor = () => true, varsle = () => {} } = {}) {
  let data = { delinger: {} };
  if (fil) { try { data = { delinger: {}, ...JSON.parse(readFileSync(fil, 'utf8')) }; } catch { /* ny */ } }
  let t = null; const lagre = () => { if (!fil) return; clearTimeout(t); t = setTimeout(() => { try { writeFileSync(fil, JSON.stringify(data)); } catch (e) { console.error('Feltoppdrag ble ikke lagret:', e.message); } }, 500); };
  const feil = (status, f) => ({ feil: f, status });
  const rydd = () => { const n = naa(); for (const [k, d] of Object.entries(data.delinger)) if (['godkjent', 'trukket'].includes(d.status) && n - (d.oppdatert || 0) > TTL_AVSLUTTET) delete data.delinger[k]; };
  const kort = (d, u) => ({ id: d.id, nr: d.nr, tittel: d.tittel, type: d.type, status: d.status, eiendom: d.eiendom, eierNavn: d.eierNavn, utforerNavn: d.utforerNavn, jegEr: d.eier === u ? 'eier' : 'utforer', opprettet: d.opprettet, oppdatert: d.oppdatert, versjon: d.versjon, planVersjon: d.planVersjon, ferdigmeldt: d.rapport?.slutt?.dato || null, avvik: d.rapport?.avvik?.length || 0, mottatt: d.mottatt || null });
  const tilgang = (did, u) => { const d = data.delinger[did]; return d && (d.eier === u || d.utforer === u) ? d : null; };

  return {
    // Skogeieren sender (eller sender på nytt) oppdraget med planen til en entreprenør i nettverket.
    send(u, { utforer, oppdrag, plan, planId, eierNavn = '', utforerNavn = '' } = {}) {
      const ut = String(utforer || '').trim().toLowerCase();
      if (!ut || ut === u) return feil(400, 'Velg en entreprenør');
      if (!koblet(u, ut)) return feil(403, 'Dere må være koblet sammen i Nettverk før oppdraget kan sendes');
      if (!erEntreprenor(ut)) return feil(400, 'Mottakeren er ikke registrert som entreprenør');
      if (!oppdrag?.id || !STOTTEDE.includes(oppdrag.type)) return feil(400, 'Oppdragstypen støttes ikke i feltløsningen ennå (hogst, tynning og skogkultur)');
      const pl = JSON.stringify(plan || {}); if (pl.length > MAKS_PLAN) return feil(413, 'Planen er for stor til å sendes');
      if (!Array.isArray(plan?.bestand)) return feil(400, 'Planen mangler bestand');
      rydd();
      let d = Object.values(data.delinger).find((x) => x.eier === u && x.planId === planId && x.oppdragId === oppdrag.id && x.status !== 'trukket');
      const n = naa();
      if (d && d.utforer !== ut) return feil(409, 'Oppdraget er allerede sendt til en annen entreprenør – trekk det tilbake først');
      const ny = !d;
      if (!d) { const nid = id(); d = data.delinger[nid] = { id: nid, eier: u, utforer: ut, planId: tekst(planId, 80), oppdragId: tekst(oppdrag.id, 80), status: 'sendt', opprettet: n, versjon: 0, rapport: null }; }
      Object.assign(d, { nr: tekst(oppdrag.nr, 30), tittel: tekst(oppdrag.tittel, 200), type: oppdrag.type, eiendom: tekst(plan.eiendom?.navn, 120), eierNavn: tekst(eierNavn, 80), utforerNavn: tekst(utforerNavn, 80), oppdrag, plan, planVersjon: (d.planVersjon || 0) + 1, oppdatert: n });
      lagre(); varsle(u, ut, ny ? 'ny' : 'oppdatert', d);
      return { ok: true, id: d.id, status: d.status, ny };
    },
    liste(u) { return Object.values(data.delinger).filter((d) => (d.eier === u || d.utforer === u) && (d.utforer !== u || d.status !== 'trukket')).sort((a, b) => b.oppdatert - a.oppdatert).map((d) => kort(d, u)); },
    hent(u, did) {
      const d = tilgang(did, u); if (!d) return feil(404, 'Oppdraget finnes ikke');
      if (d.utforer === u && d.status === 'trukket') return feil(410, 'Skogeieren har trukket tilbake oppdraget');
      if (d.utforer === u && d.status === 'sendt') { d.status = 'mottatt'; d.mottatt = naa(); lagre(); }
      return { ...kort(d, u), oppdrag: d.oppdrag, plan: d.plan, rapport: d.rapport };
    },
    // Entreprenøren lagrer rapporten. grunnVersjon må være den siste hen hentet (ellers 409 med den nyeste).
    rapport(u, did, { rapport, grunnVersjon } = {}) {
      const d = tilgang(did, u); if (!d) return feil(404, 'Oppdraget finnes ikke');
      if (d.utforer !== u) return feil(403, 'Bare entreprenøren kan skrive rapporten');
      if (['trukket', 'godkjent'].includes(d.status)) return feil(409, `Oppdraget er ${STATUS[d.status].toLowerCase()} – rapporten kan ikke endres`);
      if (Number(grunnVersjon) !== d.versjon) return { ...feil(409, 'Rapporten er endret på en annen enhet'), rapport: d.rapport, versjon: d.versjon };
      if (JSON.stringify(rapport || {}).length > MAKS_RAPPORT) return feil(413, 'Rapporten er for stor (for mange eller for store bilder)');
      const r = rensRapport(rapport); const forSlutt = !!d.rapport?.slutt;
      d.rapport = r; d.versjon++; d.oppdatert = naa();
      if (r.slutt) d.status = 'ferdigmeldt'; else if (Object.values(r.linjer).some((x) => x.status !== 'ikke') || r.avvik.length || Object.keys(r.miljo).length) d.status = 'pagar';
      lagre(); if (r.slutt && !forSlutt) varsle(u, d.eier, 'ferdigmeldt', d);
      return { ok: true, versjon: d.versjon, status: d.status };
    },
    // Skogeieren godkjenner ferdigmeldingen (rapporten er tatt inn i planen), eller trekker oppdraget tilbake.
    status(u, did, handling) {
      const d = tilgang(did, u); if (!d) return feil(404, 'Oppdraget finnes ikke');
      if (d.eier !== u) return feil(403, 'Bare skogeieren kan endre status');
      if (handling === 'godkjenn') { if (d.status !== 'ferdigmeldt') return feil(409, 'Oppdraget er ikke ferdigmeldt'); d.status = 'godkjent'; }
      else if (handling === 'trekk') { d.status = 'trukket'; varsle(u, d.utforer, 'trukket', d); }
      else if (handling === 'gjenapne') { if (d.status !== 'ferdigmeldt') return feil(409, 'Bare ferdigmeldte oppdrag kan åpnes igjen'); d.status = 'pagar'; if (d.rapport) d.rapport.slutt = null; varsle(u, d.utforer, 'gjenapnet', d); }
      else return feil(400, 'Ukjent handling');
      d.oppdatert = naa(); lagre(); return { ok: true, status: d.status };
    },
    slettBruker(u) { for (const [k, d] of Object.entries(data.delinger)) if (d.eier === u || d.utforer === u) delete data.delinger[k]; lagre(); },
    eksport(u) { return Object.values(data.delinger).filter((d) => d.eier === u || d.utforer === u).map((d) => ({ ...kort(d, u), oppdrag: d.oppdrag, rapport: d.rapport })); },
    flush() { if (fil) { clearTimeout(t); writeFileSync(fil, JSON.stringify(data)); } },
    _data: () => data,
  };
}

// HTTP: /api/feltoppdrag… – krever innlogget bruker.
export function feltoppdragApi(fo, { bruker, navn = (u) => u, cors = () => ({}) }, req, res, sti, ekstraHoder = {}) {
  if (sti !== '/api/feltoppdrag' && !sti.startsWith('/api/feltoppdrag/')) return false;
  const json = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req), ...ekstraHoder }); res.end(JSON.stringify(obj)); };
  const svar = (r) => (r?.feil ? json(r.status || 400, { ...r, status: undefined }) : json(200, r));
  const u = bruker(req); if (!u) { json(401, { feil: 'Logg inn i SkogIQ.ai', innlogging: true }); return true; }
  if (!fo) { json(503, { feil: 'Feltoppdrag krever registrering av brukere på serveren' }); return true; }
  const kropp = (maks) => new Promise((ok) => { let n = 0; const d = []; req.on('data', (b) => { n += b.length; if (n > maks) { req.destroy(); ok(null); } else d.push(b); }); req.on('end', () => { try { ok(JSON.parse(Buffer.concat(d).toString('utf8') || '{}')); } catch { ok(null); } }); req.on('error', () => ok(null)); });
  (async () => {
    if (sti === '/api/feltoppdrag' && req.method === 'GET') return json(200, { oppdrag: fo.liste(u) });
    if (sti === '/api/feltoppdrag' && req.method === 'POST') { const b = await kropp(MAKS_PLAN + 200000); if (!b) return json(413, { feil: 'For stor eller ugyldig forespørsel' }); return svar(fo.send(u, { ...b, eierNavn: navn(u), utforerNavn: navn(String(b.utforer || '').toLowerCase()) })); }
    const m = sti.match(/^\/api\/feltoppdrag\/([a-f0-9]{20})(\/rapport|\/status)?$/); if (!m) return json(404, { feil: 'Finnes ikke' });
    const [, did, del] = m;
    if (!del && req.method === 'GET') return svar(fo.hent(u, did));
    if (del === '/rapport' && req.method === 'PUT') { const b = await kropp(MAKS_RAPPORT + 100000); if (!b) return json(413, { feil: 'For stor eller ugyldig rapport' }); return svar(fo.rapport(u, did, b)); }
    if (del === '/status' && req.method === 'PUT') { const b = await kropp(10000); return b ? svar(fo.status(u, did, b.handling)) : json(400, { feil: 'Ugyldig forespørsel' }); }
    return json(405, { feil: 'Metoden er ikke tillatt' });
  })().catch(() => json(500, { feil: 'Serverfeil' }));
  return true;
}
