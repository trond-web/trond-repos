// Enkel statisk server for SkogIQ.ai (Railway m.fl.). Ingen avhengigheter – kun Node sitt standardbibliotek.
// Kjør: PORT=8080 node server.js
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createGzip } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;

const TYPER = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.sos': 'text/plain; charset=utf-8',
};
// Mapper og filer som ikke skal publiseres.
const SKJULT = /^\/(tests|verktoy|node_modules)(\/|$)|^\/(server\.js|package(-lock)?\.json|railway\.json)$|\/\./;
const KOMPRIMER = /^(text\/|application\/(json|geo\+json|manifest\+json)|image\/svg)/;

const SIKKERHET = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'geolocation=(self), camera=(self)',
};

// Mellomledd til NVE GridTimeSeries (seNorge: teledyp, snø, vannmetning, nedbør). NVE tillater ikke kall direkte fra
// nettleseren (CORS). Bare GridTimeSeries-punktkall med kjente temaer slippes gjennom, og svarene bufres i 30 minutter.
const NVE_STI = /^\/api\/nve\/GridTimeSeries\/(\d{5,7})\/(\d{6,7})\/(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})\/(gwb_frd|sd|gwb_sssrel|gwb_sssdev|rr|tm|swe|qsw)\.json$/;
const nveBuffer = new Map();
async function nve(sti, res) {
  const m = sti.match(NVE_STI);
  if (!m) return svar(res, 400, 'Ugyldig NVE-forespørsel');
  const naa = Date.now(); const lagret = nveBuffer.get(sti);
  if (lagret && naa - lagret.tid < 30 * 60 * 1000) { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'max-age=900', 'X-Buffer': 'treff', ...SIKKERHET }); return res.end(lagret.body); }
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(`https://gts.nve.no/api/GridTimeSeries/${m[1]}/${m[2]}/${m[3]}/${m[4]}/${m[5]}.json`, { signal: ctrl.signal, headers: { 'User-Agent': 'SkogIQ.ai (skogiq-production.up.railway.app)' } });
    clearTimeout(t);
    const body = await r.text();
    if (!r.ok) return svar(res, 502, `NVE svarte ${r.status}`);
    if (nveBuffer.size > 5000) nveBuffer.delete(nveBuffer.keys().next().value);
    nveBuffer.set(sti, { tid: naa, body });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'max-age=900', ...SIKKERHET });
    res.end(body);
  } catch (e) { svar(res, 504, `NVE svarte ikke: ${e.message}`); }
}

function svar(res, status, tekst) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...SIKKERHET });
  res.end(tekst);
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return svar(res, 405, 'Metoden er ikke tillatt');
  let sti;
  try { sti = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return svar(res, 400, 'Ugyldig adresse'); }
  if (sti === '/healthz') return svar(res, 200, 'ok');
  if (sti.startsWith('/api/nve/')) return nve(sti, res);
  if (sti.endsWith('/')) sti += 'index.html';
  if (SKJULT.test(sti)) return svar(res, 404, 'Finnes ikke');
  const fil = path.join(ROT, path.normalize(sti));
  if (!fil.startsWith(ROT + path.sep)) return svar(res, 403, 'Ikke tillatt');
  const type = TYPER[path.extname(fil).toLowerCase()];
  let info;
  try { info = await stat(fil); } catch { info = null; }
  if (!info?.isFile() || !type) return svar(res, 404, 'Finnes ikke');

  // Alle appfiler valideres ved hver last (ETag), slik at nye versjoner kommer fram med en gang.
  // Service workeren håndterer offline-bruk.
  const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
  const hoder = { 'Content-Type': type, ETag: etag, 'Last-Modified': info.mtime.toUTCString(), 'Cache-Control': 'no-cache', ...SIKKERHET };
  if (path.basename(fil) === 'sw.js') hoder['Service-Worker-Allowed'] = '/';
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, hoder); return res.end(); }
  const gzip = KOMPRIMER.test(type) && info.size > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  if (gzip) { hoder['Content-Encoding'] = 'gzip'; hoder.Vary = 'Accept-Encoding'; } else hoder['Content-Length'] = info.size;
  res.writeHead(200, hoder);
  if (req.method === 'HEAD') return res.end();
  const strom = createReadStream(fil);
  strom.on('error', () => res.destroy());
  (gzip ? strom.pipe(createGzip()) : strom).pipe(res);
});

server.listen(PORT, () => console.log(`SkogIQ.ai kjører på port ${PORT}`));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
