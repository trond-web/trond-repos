// API for appen og admin. Offentlig: valdgrenser/jaktfelt (med admins endringer) og samjakt.
// Krever innlogging: endre jaktfelt, samjakt, logg og passord.
import { readFile } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { hashPassord, sjekkPassord, godtPassord, lagSesjon, lesSesjon, lesKapsler, kapselHeader, lagSperre, KAPSEL } from './auth.js';
import { valider as validerSamjakt, osloDato, status as samjaktStatus } from '../js/samjakt.js';

const VALD = [1, 2, 3, 4, 5, 6];
const MAKS_KROPP = 6 * 1024 * 1024;
// Grovt område rundt Nordfjella (lengde/bredde), for å stoppe åpenbart feile koordinater.
const OMRAADE = [5.5, 59.8, 10.5, 61.8];

export async function lagApi({ lager, grunnfil, sikkerhetshoder, sikreKapsler = true }) {
  const grunn = JSON.parse(await readFile(grunnfil, 'utf8'));
  const sperre = lagSperre();

  // Hemmelighet for sesjoner: fra miljøet, ellers lagret én gang i lageret (overlever omstart).
  let hemmelighet = process.env.SESJON_HEMMELIGHET;
  if (!hemmelighet) {
    if (!lager.data.hemmelighet) await lager.endre((d) => { d.hemmelighet = randomBytes(32).toString('base64url'); });
    hemmelighet = lager.data.hemmelighet;
  }
  // Første admin opprettes fra miljøvariablene når det ikke finnes noen brukere.
  const forsteBruker = (process.env.ADMIN_BRUKER || 'admin').trim().toLowerCase();
  if (!Object.keys(lager.data.brukere).length && process.env.ADMIN_PASSORD) {
    const h = await hashPassord(process.env.ADMIN_PASSORD);
    await lager.endre((d) => { d.brukere[forsteBruker] = { ...h, opprettet: new Date().toISOString() }; }, { av: 'system', hva: `Opprettet admin «${forsteBruker}»` });
  }

  const json = (res, status, data, hoder = {}) => {
    const body = JSON.stringify(data);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...sikkerhetshoder, ...hoder });
    res.end(body);
  };
  const feil = (res, status, melding) => json(res, status, { feil: melding });

  // Jaktfelt med admins endringer lagt over valdkartet.
  let buffer = { revisjon: -1 };
  function jaktfelt() {
    if (buffer.revisjon === lager.data.revisjon) return buffer;
    const endr = lager.data.jaktfelt;
    const features = grunn.features.map((f) => {
      const e = endr[f.properties.id];
      if (!e) return f;
      const props = { ...f.properties, endret: e.endret, endretAv: e.av };
      if ('vald' in e) props.vald = e.vald;
      if (e.etikett) props.etikett = e.etikett;
      return { ...f, properties: props, geometry: e.geometry || f.geometry };
    });
    const body = JSON.stringify({ ...grunn, revisjon: lager.data.revisjon, features });
    const etag = `"${createHash('sha1').update(body).digest('base64url').slice(0, 20)}"`;
    buffer = { revisjon: lager.data.revisjon, body, gz: gzipSync(body), etag };
    return buffer;
  }

  const bruker = (req) => {
    const b = lesSesjon(hemmelighet, lesKapsler(req.headers.cookie)[KAPSEL]);
    return b && lager.data.brukere[b] ? b : null;
  };

  async function kropp(req) {
    let lengde = 0; const deler = [];
    for await (const del of req) {
      lengde += del.length;
      if (lengde > MAKS_KROPP) throw Object.assign(new Error('For stor forespørsel'), { status: 413 });
      deler.push(del);
    }
    try { return JSON.parse(Buffer.concat(deler).toString() || '{}'); } catch { throw Object.assign(new Error('Ugyldig JSON'), { status: 400 }); }
  }

  // Endringer må komme fra appens egen side (SameSite-kapsel + egen header + samme opprinnelse).
  function fraEgenSide(req) {
    if (req.headers['x-nfv'] !== '1') return false;
    const o = req.headers.origin;
    if (!o) return true;
    try { return new URL(o).host === req.headers.host; } catch { return false; }
  }

  return async function api(req, res, sti) {
    const metode = req.method;
    try {
      if (sti === '/api/status' && metode === 'GET') return json(res, 200, { server: true, innlogget: bruker(req), idag: osloDato() });

      if (sti === '/api/jaktfelt' && (metode === 'GET' || metode === 'HEAD')) {
        const j = jaktfelt();
        const hoder = { 'Content-Type': 'application/geo+json; charset=utf-8', ETag: j.etag, 'Cache-Control': 'no-cache', Vary: 'Accept-Encoding', ...sikkerhetshoder };
        if (req.headers['if-none-match'] === j.etag) { res.writeHead(304, hoder); return res.end(); }
        const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
        if (gz) hoder['Content-Encoding'] = 'gzip';
        res.writeHead(200, hoder);
        return res.end(metode === 'HEAD' ? undefined : gz ? j.gz : j.body);
      }

      if (sti === '/api/samjakt' && metode === 'GET') {
        // Avsluttede samjakter sendes ikke ut. Appen sjekker også datoene selv, så de slås av uten nett.
        const idag = osloDato();
        return json(res, 200, { idag, samjakt: lager.data.samjakt.filter((s) => samjaktStatus(s, idag) !== 'avsluttet') }, { 'Cache-Control': 'no-cache' });
      }

      if (sti === '/api/login' && metode === 'POST') {
        if (!fraEgenSide(req)) return feil(res, 403, 'Ikke tillatt');
        // Bak Railways proxy er siste adresse i X-Forwarded-For den proxyen selv har sett (den første kan klienten sette).
        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',').pop().trim();
        if (sperre.sperret(ip)) return feil(res, 429, 'For mange forsøk. Vent 15 minutter.');
        const { bruker: navn, passord } = await kropp(req);
        const n = String(navn || '').trim().toLowerCase();
        const ok = typeof passord === 'string' && await sjekkPassord(passord, lager.data.brukere[n]);
        if (!ok) { sperre.feil(ip); return feil(res, 401, 'Feil brukernavn eller passord'); }
        sperre.nullstill(ip);
        return json(res, 200, { innlogget: n }, { 'Set-Cookie': kapselHeader(lagSesjon(hemmelighet, n), { sikker: sikreKapsler }) });
      }

      if (sti === '/api/logout' && metode === 'POST') {
        return json(res, 200, { innlogget: null }, { 'Set-Cookie': kapselHeader('', { sikker: sikreKapsler, maxAlder: 0 }) });
      }

      // ---------- Alt under krever innlogging ----------
      if (!sti.startsWith('/api/admin/')) return feil(res, 404, 'Finnes ikke');
      const meg = bruker(req);
      if (!meg) return feil(res, 401, 'Ikke innlogget');
      if (metode !== 'GET' && !fraEgenSide(req)) return feil(res, 403, 'Ikke tillatt');
      const del = sti.slice('/api/admin/'.length).split('/');

      if (del[0] === 'passord' && metode === 'POST') {
        const { gammelt, nytt } = await kropp(req);
        if (!(await sjekkPassord(String(gammelt || ''), lager.data.brukere[meg]))) return feil(res, 400, 'Feil nåværende passord');
        if (!godtPassord(nytt)) return feil(res, 400, 'Nytt passord må ha minst 10 tegn');
        const h = await hashPassord(nytt);
        await lager.endre((d) => { d.brukere[meg] = { ...d.brukere[meg], ...h, endret: new Date().toISOString() }; }, { av: meg, hva: 'Byttet passord' });
        return json(res, 200, { ok: true });
      }

      if (del[0] === 'logg' && metode === 'GET') return json(res, 200, { logg: lager.data.logg.slice(0, 200) });

      if (del[0] === 'sikkerhetskopi' && metode === 'GET') {
        // Alt som trengs for å gjenopprette (uten sesjonsnøkkelen). Passordene ligger bare som hash.
        const { hemmelighet, ...kopi } = lager.data;
        const dag = osloDato();
        return json(res, 200, { type: 'nordfjella-villrein-sikkerhetskopi', laget: new Date().toISOString(), av: meg, data: kopi },
          { 'Content-Disposition': `attachment; filename="nordfjella-sikkerhetskopi-${dag}.json"` });
      }
      if (del[0] === 'kopier' && metode === 'GET') return json(res, 200, { kopier: await lager.kopiliste() });

      if (del[0] === 'jaktfelt' && del[1]) {
        const id = del[1];
        const f = grunn.features.find((x) => x.properties.id === id);
        if (!f) return feil(res, 404, 'Ukjent jaktfelt');
        const navn = f.properties.nr ? `${f.properties.nr}${f.properties.navn ? ` ${f.properties.navn}` : ''}` : id;
        if (metode === 'PUT') {
          const k = await kropp(req);
          const endring = {};
          if ('geometry' in k) {
            const g = sjekkGeometri(k.geometry);
            if (typeof g === 'string') return feil(res, 400, g);
            endring.geometry = g;
            if (Array.isArray(k.etikett) && k.etikett.length === 2 && k.etikett.every(Number.isFinite)) endring.etikett = k.etikett;
          }
          if ('vald' in k) {
            if (k.vald !== null && !VALD.includes(Number(k.vald))) return feil(res, 400, 'Ukjent vald');
            endring.vald = k.vald === null ? null : Number(k.vald);
          }
          if (!Object.keys(endring).length) return feil(res, 400, 'Ingen endring');
          const hva = [endring.geometry && 'grense', 'vald' in endring && `vald → ${endring.vald ?? 'ingen'}`].filter(Boolean).join(', ');
          await lager.endre((d) => { d.jaktfelt[id] = { ...d.jaktfelt[id], ...endring, endret: new Date().toISOString(), av: meg }; }, { av: meg, hva: `Endret ${navn}: ${hva}` });
          return json(res, 200, { ok: true, revisjon: lager.data.revisjon });
        }
        if (metode === 'DELETE') {
          if (!lager.data.jaktfelt[id]) return json(res, 200, { ok: true });
          await lager.endre((d) => { delete d.jaktfelt[id]; }, { av: meg, hva: `Tilbakestilte ${navn} til valdkartet` });
          return json(res, 200, { ok: true, revisjon: lager.data.revisjon });
        }
      }

      if (del[0] === 'samjakt') {
        if (metode === 'GET' && !del[1]) {
          const idag = osloDato();
          return json(res, 200, { idag, samjakt: lager.data.samjakt.map((s) => ({ ...s, status: samjaktStatus(s, idag) })) });
        }
        if (metode === 'POST' && !del[1]) {
          const k = await kropp(req);
          const f = validerSamjakt(k, VALD);
          if (f) return feil(res, 400, f);
          const s = { id: randomBytes(6).toString('base64url'), navn: (k.navn || '').trim() || null, vald: [...new Set(k.vald.map(Number))].sort(), fra: k.fra, til: k.til, opprettet: new Date().toISOString(), av: meg };
          await lager.endre((d) => { d.samjakt.push(s); }, { av: meg, hva: `Opprettet samjakt vald ${s.vald.join(' + ')}, ${s.fra}–${s.til}` });
          return json(res, 201, { samjakt: s });
        }
        const s = del[1] && lager.data.samjakt.find((x) => x.id === del[1]);
        if (!s) return feil(res, 404, 'Ukjent samjakt');
        if (metode === 'DELETE') {
          await lager.endre((d) => { d.samjakt = d.samjakt.filter((x) => x.id !== s.id); }, { av: meg, hva: `Slettet samjakt vald ${s.vald.join(' + ')}, ${s.fra}–${s.til}` });
          return json(res, 200, { ok: true });
        }
        if (metode === 'POST' && del[2] === 'avslutt') {
          // Avslutt nå: siste dag blir i går, så samjakten slås av med en gang.
          const igaar = osloDato(new Date(Date.now() - 864e5));
          await lager.endre((d) => { const x = d.samjakt.find((y) => y.id === s.id); x.til = igaar < x.fra ? x.fra : igaar; if (igaar < x.fra) x.fra = x.til = igaar; }, { av: meg, hva: `Avsluttet samjakt vald ${s.vald.join(' + ')}` });
          return json(res, 200, { ok: true });
        }
      }

      return feil(res, 404, 'Finnes ikke');
    } catch (e) {
      if (e.status) return feil(res, e.status, e.message);
      console.error(e);
      return feil(res, 500, 'Noe gikk galt på serveren');
    }
  };
}

// Godtar Polygon/MultiPolygon med lukkede ringer og koordinater i området. Returnerer MultiPolygon eller feilmelding.
export function sjekkGeometri(g) {
  if (!g || !['Polygon', 'MultiPolygon'].includes(g.type) || !Array.isArray(g.coordinates)) return 'Grensen må være en flate';
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let punkter = 0;
  const ut = [];
  for (const p of polys) {
    if (!Array.isArray(p) || !p.length) return 'Tom flate';
    const ringer = [];
    for (const r of p) {
      if (!Array.isArray(r) || r.length < 3) return 'En flate må ha minst tre hjørner';
      const ring = r.map((c) => [Number(c[0]), Number(c[1])]);
      for (const [x, y] of ring) {
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < OMRAADE[0] || x > OMRAADE[2] || y < OMRAADE[1] || y > OMRAADE[3]) return 'Koordinater utenfor Nordfjella-området';
      }
      const [a, b] = [ring[0], ring[ring.length - 1]];
      if (a[0] !== b[0] || a[1] !== b[1]) ring.push([...a]);
      if (ring.length < 4) return 'En flate må ha minst tre hjørner';
      punkter += ring.length;
      ringer.push(ring.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]));
    }
    ut.push(ringer);
  }
  if (punkter > 60000) return 'For mange punkter i grensen';
  return { type: 'MultiPolygon', coordinates: ut };
}
