// Profilbilder: valgfritt bilde av brukeren, vist i Min profil og i Nettverk (katalog, koblinger og chat).
// Bildet beskjæres og skaleres i nettleseren (kvadrat, 320 px, JPEG) før det lastes opp. Serveren godtar bare JPEG,
// PNG og WebP (sjekker filhodet; SVG avvises), høyst 400 kB. Filene ligger i <datamappe>/profilbilder med en tilfeldig
// id som navn; id-en lagres i profilen (profil.bilde) og byttes ved hver opplasting. Bildene kan bare hentes av
// innloggede brukere. Slettes sammen med kontoen og er med i «Last ned mine data». Bare Node sitt standardbibliotek.
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';

export const MAKS_BYTES = 400 * 1024;
const GYLDIG_ID = /^[a-f0-9]{24}$/;
// Bildetype fra filhodet (magiske bytes), ikke fra det klienten sier.
export function bildetype(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

export function lagProfilbilder({ mappe = null } = {}) {
  const minne = new Map(); // uten mappe (test/utvikling)
  const fil = (id) => path.join(mappe, `${id}.bin`);
  if (mappe) try { mkdirSync(mappe, { recursive: true }); } catch { /* opprettes ved første lagring */ }
  return {
    // Lagre et nytt bilde (data-URL eller Buffer). Gir { id, type } eller { feil, status }.
    lagre(data) {
      let buf = data;
      if (typeof data === 'string') { const m = data.match(/^data:image\/[a-z+.-]+;base64,([A-Za-z0-9+/=]+)$/); if (!m) return { feil: 'Ugyldig bilde', status: 400 }; buf = Buffer.from(m[1], 'base64'); }
      if (!Buffer.isBuffer(buf) || !buf.length) return { feil: 'Ugyldig bilde', status: 400 };
      if (buf.length > MAKS_BYTES) return { feil: 'Bildet er for stort (høyst 400 kB)', status: 413 };
      const type = bildetype(buf); if (!type) return { feil: 'Bare JPEG, PNG eller WebP', status: 415 };
      const id = randomBytes(12).toString('hex');
      // Mappen opprettes ved behov; en skrivefeil gir 500 i stedet for å stoppe serveren.
      if (mappe) { try { mkdirSync(mappe, { recursive: true }); writeFileSync(fil(id), Buffer.concat([Buffer.from(`${type}\n`), buf])); } catch (e) { console.error('Profilbilde: klarte ikke å lagre:', e.message); return { feil: 'Klarte ikke å lagre bildet', status: 500 }; } } else minne.set(id, { type, data: buf });
      return { id, type };
    },
    hent(id) {
      if (!GYLDIG_ID.test(String(id))) return null;
      if (!mappe) return minne.get(id) || null;
      if (!existsSync(fil(id))) return null;
      try { const b = readFileSync(fil(id)); const i = b.indexOf(10); return { type: b.subarray(0, i).toString('ascii'), data: b.subarray(i + 1) }; } catch { return null; }
    },
    slett(id) { if (!GYLDIG_ID.test(String(id))) return; try { if (mappe) rmSync(fil(id), { force: true }); else minne.delete(id); } catch (e) { console.error('Profilbilde: klarte ikke å slette:', e.message); } },
    dataUrl(id) { const x = this.hent(id); return x ? `data:${x.type};base64,${x.data.toString('base64')}` : null; },
  };
}

// HTTP: PUT/DELETE /api/konto/bilde (eget bilde), GET /api/bilde/:id (krever innlogging).
// konto: { bruker(req) → brukernavn|null, hentProfil(u) → profil, settBilde(u, id|null) }.
export function profilbildeApi(pb, konto, req, res, sti, { cors = () => ({}), ekstraHoder = {} } = {}) {
  if (sti !== '/api/konto/bilde' && !sti.startsWith('/api/bilde/')) return false;
  const json = (s, o) => { res.writeHead(s, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors(req), ...ekstraHoder }); res.end(JSON.stringify(o)); };
  const u = konto.bruker(req); if (!u) { json(401, { feil: 'Logg inn i SkogIQ.ai', innlogging: true }); return true; }
  if (sti.startsWith('/api/bilde/')) {
    const x = pb.hent(sti.slice('/api/bilde/'.length)); if (!x) { json(404, { feil: 'Finnes ikke' }); return true; }
    res.writeHead(200, { 'Content-Type': x.type, 'Content-Length': x.data.length, 'Cache-Control': 'private, max-age=604800, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'", ...cors(req), ...ekstraHoder }); res.end(x.data); return true;
  }
  const gammel = konto.hentProfil(u)?.bilde || null;
  if (req.method === 'DELETE') { if (gammel) pb.slett(gammel); konto.settBilde(u, null); json(200, { ok: true, bilde: null }); return true; }
  if (req.method !== 'PUT') { json(405, { feil: 'Metoden er ikke tillatt' }); return true; }
  let n = 0; const d = [];
  req.on('data', (c) => { n += c.length; if (n > MAKS_BYTES * 1.4 + 1000) { req.destroy(); } else d.push(c); });
  req.on('end', () => {
    let b = null; try { b = JSON.parse(Buffer.concat(d).toString('utf8') || '{}'); } catch { /* ugyldig */ }
    if (!b?.bilde) return json(400, { feil: 'Mangler bilde' });
    const r = pb.lagre(b.bilde); if (r.feil) return json(r.status, { feil: r.feil });
    if (gammel) pb.slett(gammel); konto.settBilde(u, r.id); json(200, { ok: true, bilde: r.id });
  });
  return true;
}
