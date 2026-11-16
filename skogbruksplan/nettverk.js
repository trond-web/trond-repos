// Nettverk mellom skogeiere og aktører (innkjøpere og entreprenører): koblinger og chat. Bare Node sitt
// standardbibliotek. Data i minnet, og i en fil (NETTVERK_FIL, ellers nettverk.json ved siden av BRUKER_FIL).
//
//   * Statistikk: hvor mange skogeiere, innkjøpere og entreprenører som er registrert.
//   * Katalog: aktørene (innkjøpere og entreprenører) med navn, foretak, kommune og roller – aldri e-post.
//     Skogeiere søker i katalogen. Aktører finner ikke skogeiere selv; de inviterer med skogeierens e-postadresse.
//   * Koblinger: én part ber om kobling (skogeier → aktør, eller aktør → skogeier), den andre godtar eller avslår.
//     En aktiv kobling kan avsluttes av begge. Rollen i koblingen er «innkjoper» eller «entreprenor».
//   * Chat: meldinger i hver aktiv kobling, med lest-markør per bruker (uleste telles).
// brukere: { hent(u) → { navn, visning, epost, profil:{ roller, foretak, kommune } } | null, alle() → [...] }
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

export const AKTOR_ROLLER = ['innkjoper', 'entreprenor'];
export const MAKS_TEKST = 2000; export const MAKS_MELDINGER = 2000; export const MAKS_PER_MINUTT = 30;
const id = () => randomBytes(8).toString('hex');
const tekst = (v, n) => String(v ?? '').trim().slice(0, n);
const roller = (b) => b?.profil?.roller || [];
// Kommuner: [{ nr, navn }]. Innkjøpere og entreprenører registrerer hvor de opererer; skogeiere ser bare aktører i
// kommunene der de har skog (profil.kommuner, planene i skyen og planene på enheten).
const kommunerFor = (b) => (Array.isArray(b?.profil?.kommuner) ? b.profil.kommuner : []);
const nrm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
export function kommuneSett(lister) { const nr = new Set(); const navn = new Set(); const liste = []; for (const k of lister.flat()) { if (!k) continue; const n = String(k.nr || '').trim(); const v = nrm(k.navn); if (!/^\d{4}$/.test(n) && !v) continue; if ((n && nr.has(n)) || (!n && navn.has(v))) continue; if (/^\d{4}$/.test(n)) nr.add(n); else if (v) navn.add(v); /* navn brukes bare der nummer mangler (flere kommuner heter det samme, f.eks. Våler) */ liste.push({ ...(n ? { nr: n } : {}), navn: k.navn || '' }); } return { nr, navn, liste }; }
const treffer = (aktor, sett) => kommunerFor(aktor).some((k) => sett.nr.has(k.nr) || sett.navn.has(nrm(k.navn)));

export function lagNettverk({ fil = null, brukere, naa = () => Date.now(), skogKommuner = () => [] } = {}) {
  let data = { koblinger: {}, meldinger: {}, lest: {} };
  if (fil) { try { data = { koblinger: {}, meldinger: {}, lest: {}, ...JSON.parse(readFileSync(fil, 'utf8')) }; } catch { /* ny */ } }
  let t = null; const lagre = () => { if (!fil) return; clearTimeout(t); t = setTimeout(() => { try { writeFileSync(fil, JSON.stringify(data)); } catch { /* ignorer */ } }, 500); };
  const sendt = new Map(); // bruker → tidspunkter (spamgrense)
  const feil = (status, f) => ({ feil: f, status });
  const kort = (b) => (b ? { bruker: b.navn, navn: b.visning || b.navn, foretak: b.profil?.foretak || '', kommune: b.profil?.kommune || '', roller: roller(b), bilde: b.profil?.bilde || null, kommuner: kommunerFor(b).map((k) => k.navn) } : null);
  const mine = (u) => Object.values(data.koblinger).filter((k) => k.skogeier === u || k.aktor === u);
  const motpart = (k, u) => (k.skogeier === u ? k.aktor : k.skogeier);
  const ulest = (k, u) => { const sist = data.lest[`${k.id}|${u}`] || 0; return (data.meldinger[k.id] || []).filter((m) => m.fra !== u && m.tid > sist).length; };
  const tilgang = (kid, u) => { const k = data.koblinger[kid]; return k && (k.skogeier === u || k.aktor === u) ? k : null; };

  return {
    statistikk() {
      const alle = brukere.alle().filter((b) => !b.sperret);
      const n = (r) => alle.filter((b) => roller(b).includes(r)).length;
      return { skogeiere: n('skogeier'), innkjopere: n('innkjoper'), entreprenorer: n('entreprenor') };
    },
    // Aktørene i katalogen (for skogeiere). q søker i navn, foretak og kommune.
    // kommuner (valgfritt): kommuneSett – da vises bare aktører som opererer i minst én av kommunene.
    aktorer(u, { q = '', rolle = '', kommuner = null } = {}) {
      const s = String(q || '').toLowerCase().trim();
      return brukere.alle().filter((b) => !b.sperret && b.navn !== u && roller(b).some((r) => AKTOR_ROLLER.includes(r)) && (!rolle || roller(b).includes(rolle)) && (!kommuner || treffer(b, kommuner)))
        .map(kort).filter((k) => !s || `${k.navn} ${k.foretak} ${k.kommune} ${k.kommuner.join(' ')}`.toLowerCase().includes(s))
        .map((k) => ({ ...k, kobling: mine(u).find((x) => motpart(x, u) === k.bruker && x.status !== 'avsluttet' && x.status !== 'avslatt')?.status || null }))
        .sort((a, b) => a.navn.localeCompare(b.navn, 'nb')).slice(0, 200);
    },
    // Aktiv kobling mellom to brukere (begge veier), eller null. Brukes av tilbudsforespørsler til nettverket.
    koblingMellom(a, b) { const k = Object.values(data.koblinger).find((x) => x.status === 'aktiv' && ((x.skogeier === a && x.aktor === b) || (x.skogeier === b && x.aktor === a))); return k ? k.id : null; },
    // Kommunene der skogeieren har skog: profilen, planene i skyen og planene på enheten (klient = [{ nr, navn }]).
    skogKommunerFor(u, klient = []) { const b = brukere.hent(u); return kommuneSett([kommunerFor(b), b?.profil?.kommune ? [{ navn: b.profil.kommune }] : [], skogKommuner(u) || [], klient]); },
    // Oversikten for en bruker: statistikk, koblingene med motpart og uleste meldinger.
    oversikt(u) {
      const k = mine(u).filter((x) => x.status !== 'avslatt' || x.fra !== u || naa() - (x.besvart || 0) < 7 * 864e5)
        .map((x) => { const m = (data.meldinger[x.id] || []).at(-1); return { id: x.id, rolle: x.rolle, status: x.status, jegEr: x.skogeier === u ? 'skogeier' : 'aktor', fraMeg: x.fra === u, opprettet: x.opprettet, besvart: x.besvart || null, motpart: kort(brukere.hent(motpart(x, u))) || { bruker: motpart(x, u), navn: motpart(x, u), roller: [] }, ulest: x.status === 'aktiv' ? ulest(x, u) : 0, siste: m ? { tekst: m.tekst.slice(0, 120), tid: m.tid, fraMeg: m.fra === u } : null }; })
        .sort((a, b) => (b.siste?.tid || b.opprettet) - (a.siste?.tid || a.opprettet));
      return { roller: roller(brukere.hent(u)), statistikk: this.statistikk(), koblinger: k, ulest: k.reduce((s, x) => s + x.ulest, 0), forespørsler: k.filter((x) => x.status === 'foresporsel' && !x.fraMeg).length };
    },
    // Be om kobling. til = brukernavn (fra katalogen) eller e-postadresse (invitasjon fra aktør).
    be(u, { til, rolle } = {}) {
      const meg = brukere.hent(u); const ann = brukere.hent(String(til || '').trim().toLowerCase());
      if (!meg) return feil(401, 'Logg inn');
      if (!ann || ann.sperret) return feil(404, 'Fant ingen bruker med den adressen i SkogIQ.ai. Be vedkommende registrere seg først.');
      if (ann.navn === u) return feil(400, 'Du kan ikke koble deg til deg selv');
      if (!AKTOR_ROLLER.includes(rolle)) return feil(400, 'Velg innkjøper eller entreprenør');
      // Hvem er skogeier og hvem er aktør i koblingen?
      let skogeier; let aktor;
      if (roller(meg).includes('skogeier') && roller(ann).includes(rolle)) { skogeier = u; aktor = ann.navn; }
      else if (roller(meg).includes(rolle) && roller(ann).includes('skogeier')) { skogeier = ann.navn; aktor = u; }
      else return feil(400, roller(meg).includes('skogeier') ? `Brukeren er ikke registrert som ${rolle === 'innkjoper' ? 'innkjøper' : 'entreprenør'}` : 'Den du inviterer, er ikke registrert som skogeier');
      const fins = Object.values(data.koblinger).find((k) => k.skogeier === skogeier && k.aktor === aktor && k.rolle === rolle && ['foresporsel', 'aktiv'].includes(k.status));
      if (fins) {
        // Har den andre parten allerede bedt om det samme, godtas koblingen.
        if (fins.status === 'foresporsel' && fins.fra !== u) { fins.status = 'aktiv'; fins.besvart = naa(); lagre(); return { ok: true, kobling: fins.id, status: 'aktiv' }; }
        return feil(409, fins.status === 'aktiv' ? 'Dere er allerede koblet' : 'Forespørselen er allerede sendt');
      }
      const k = { id: id(), skogeier, aktor, rolle, status: 'foresporsel', fra: u, opprettet: naa() };
      data.koblinger[k.id] = k; lagre();
      return { ok: true, kobling: k.id, status: k.status };
    },
    svar(u, kid, handling) {
      const k = tilgang(kid, u); if (!k) return feil(404, 'Koblingen finnes ikke');
      if (handling === 'godta' || handling === 'avsla') {
        if (k.status !== 'foresporsel') return feil(409, 'Forespørselen er allerede besvart');
        if (k.fra === u) return feil(403, 'Den andre parten må svare på forespørselen');
        k.status = handling === 'godta' ? 'aktiv' : 'avslatt'; k.besvart = naa();
      } else if (handling === 'trekk') {
        if (k.status !== 'foresporsel' || k.fra !== u) return feil(409, 'Kan bare trekke egne, ubesvarte forespørsler');
        delete data.koblinger[k.id]; lagre(); return { ok: true, status: 'trukket' };
      } else if (handling === 'avslutt') {
        if (k.status !== 'aktiv') return feil(409, 'Koblingen er ikke aktiv');
        k.status = 'avsluttet'; k.avsluttet = naa(); k.avsluttetAv = u;
      } else return feil(400, 'Ukjent handling');
      lagre(); return { ok: true, status: k.status };
    },
    meldinger(u, kid, { etter = 0 } = {}) {
      const k = tilgang(kid, u); if (!k) return feil(404, 'Koblingen finnes ikke');
      const alle = data.meldinger[k.id] || [];
      const sist = alle.at(-1)?.tid || 0; if (sist) { data.lest[`${k.id}|${u}`] = Math.max(data.lest[`${k.id}|${u}`] || 0, sist); lagre(); }
      const motLest = data.lest[`${k.id}|${motpart(k, u)}`] || 0;
      return { status: k.status, meldinger: alle.filter((m) => m.tid > Number(etter || 0)).slice(-300).map((m) => ({ id: m.id, fraMeg: m.fra === u, tekst: m.tekst, tid: m.tid, lest: m.fra === u ? m.tid <= motLest : true })), motpartLest: motLest };
    },
    send(u, kid, t) {
      const k = tilgang(kid, u); if (!k) return feil(404, 'Koblingen finnes ikke');
      if (k.status !== 'aktiv') return feil(409, 'Chat er bare åpen i aktive koblinger');
      const ren = tekst(t, MAKS_TEKST); if (!ren) return feil(400, 'Skriv en melding');
      const n = naa(); const l = (sendt.get(u) || []).filter((x) => n - x < 60000); if (l.length >= MAKS_PER_MINUTT) return feil(429, 'Du sender for mange meldinger – vent litt'); l.push(n); sendt.set(u, l);
      const liste = data.meldinger[k.id] || (data.meldinger[k.id] = []);
      const tid = Math.max(n, (liste.at(-1)?.tid || 0) + 1);
      const m = { id: id(), fra: u, tekst: ren, tid }; liste.push(m); if (liste.length > MAKS_MELDINGER) liste.splice(0, liste.length - MAKS_MELDINGER);
      data.lest[`${k.id}|${u}`] = tid; lagre();
      return { ok: true, melding: { id: m.id, fraMeg: true, tekst: m.tekst, tid: m.tid } };
    },
    // Når en bruker slettes: koblinger og meldinger fjernes.
    // Innsyn: koblingene og alle meldingene brukeren er part i.
    eksport(u) { return mine(u).map((k) => ({ ...k, motpart: kort(brukere.hent(motpart(k, u))), meldinger: (data.meldinger[k.id] || []).map((m) => ({ fraMeg: m.fra === u, tekst: m.tekst, tid: new Date(m.tid).toISOString() })) })); },
    slettBruker(u) { for (const k of Object.values(data.koblinger)) if (k.skogeier === u || k.aktor === u) { delete data.koblinger[k.id]; delete data.meldinger[k.id]; } lagre(); },
    _data: () => data,
  };
}

// HTTP: /api/nettverk… – krever innlogget bruker (bruker(req) → brukernavn eller null).
export function nettverkApi(nett, { bruker, cors = () => ({}) }, req, res, sti, ekstraHoder = {}) {
  if (sti !== '/api/nettverk' && !sti.startsWith('/api/nettverk/')) return false;
  const json = (status, obj) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req), ...ekstraHoder }); res.end(JSON.stringify(obj)); };
  const svar = (r) => (r?.feil ? json(r.status || 400, { feil: r.feil }) : json(200, r));
  const u = bruker(req); if (!u) { json(401, { feil: 'Logg inn i SkogIQ.ai', innlogging: true }); return true; }
  if (!nett) { json(503, { feil: 'Nettverket krever registrering av brukere på serveren' }); return true; }
  const q = new URL(req.url, 'http://x').searchParams;
  const kropp = () => new Promise((ok) => { let n = 0; const d = []; req.on('data', (b) => { n += b.length; if (n > 20000) { req.destroy(); ok(null); } else d.push(b); }); req.on('end', () => { try { ok(JSON.parse(Buffer.concat(d).toString('utf8') || '{}')); } catch { ok(null); } }); req.on('error', () => ok(null)); });
  (async () => {
    if (sti === '/api/nettverk' && req.method === 'GET') return json(200, nett.oversikt(u));
    if (sti === '/api/nettverk/aktorer' && req.method === 'GET') {
      // Skogeieren ser bare aktører i kommunene der hen har skog. Klienten sender kommunene til planene på enheten.
      const klient = [...(q.get('kommuner') || '').split(',').filter((x) => /^\d{4}$/.test(x)).map((nr) => ({ nr })), ...(q.get('kommunenavn') || '').split('|').map((x) => x.trim()).filter(Boolean).slice(0, 50).map((navn) => ({ navn: navn.slice(0, 60) }))];
      const sett = nett.skogKommunerFor(u, klient);
      return json(200, { aktorer: sett.liste.length ? nett.aktorer(u, { q: q.get('q') || '', rolle: q.get('rolle') || '', kommuner: sett }) : [], mineKommuner: sett.liste, manglerKommune: !sett.liste.length });
    }
    if (sti === '/api/nettverk/koblinger' && req.method === 'POST') { const b = await kropp(); return b ? svar(nett.be(u, b)) : json(400, { feil: 'Ugyldig forespørsel' }); }
    const m = sti.match(/^\/api\/nettverk\/koblinger\/([a-f0-9]{16})(\/meldinger)?$/); if (!m) return json(404, { feil: 'Finnes ikke' });
    const [, kid, meld] = m;
    if (!meld && req.method === 'PUT') { const b = await kropp(); return b ? svar(nett.svar(u, kid, b.handling)) : json(400, { feil: 'Ugyldig forespørsel' }); }
    if (meld && req.method === 'GET') return svar(nett.meldinger(u, kid, { etter: q.get('etter') || 0 }));
    if (meld && req.method === 'POST') { const b = await kropp(); return b ? svar(nett.send(u, kid, b.tekst)) : json(400, { feil: 'Ugyldig melding' }); }
    return json(405, { feil: 'Metoden er ikke tillatt' });
  })().catch(() => json(500, { feil: 'Serverfeil' }));
  return true;
}
