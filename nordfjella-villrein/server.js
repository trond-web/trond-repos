// Enkel statisk server for Nordfjella villrein (Railway m.fl.). Ingen avhengigheter – kun Node sitt standardbibliotek.
// Kjør: PORT=8080 node server.js
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readFile } from 'node:fs/promises';
import { gzip as gzipCb } from 'node:zlib';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { aapneLager } from './server/lager.js';
import { lagApi } from './server/api.js';

const ROT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;

const TYPER = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
// Mapper og filer som ikke skal publiseres.
const SKJULT = /^\/(tests|verktoy|server|pages-videresending|node_modules)(\/|$)|^\/(server\.js|package(-lock)?\.json|railway\.json|README\.md)$|\/\./;
const KOMPRIMER = /^(text\/|application\/(json|geo\+json|manifest\+json)|image\/svg)/;

const SIKKERHET = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'geolocation=(self)',
};

// Komprimerte filer holdes i minnet, så hver fil bare gzippes én gang (til den endres).
const gzip = promisify(gzipCb);
const gzBuffer = new Map(); // fil → { nokkel, data }
async function komprimert(fil, info) {
  const nokkel = `${info.size}-${info.mtimeMs}`;
  const lagret = gzBuffer.get(fil);
  if (lagret?.nokkel === nokkel) return lagret.data;
  const data = gzip(await readFile(fil), { level: 9 });
  gzBuffer.set(fil, { nokkel, data });
  data.catch(() => gzBuffer.delete(fil));
  return data;
}

function svar(res, status, tekst) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...SIKKERHET });
  res.end(tekst);
}

// Varige data (admins endringer av jaktfelt, samjakt, brukere) ligger i DATA_DIR – på Railway et volum på /data.
const DATA_DIR = process.env.DATA_DIR || path.join(ROT, '.lokaldata');
const lager = await aapneLager(DATA_DIR);
const api = await lagApi({ lager, grunnfil: path.join(ROT, 'data', 'jaktfelt.geojson'), sikkerhetshoder: SIKKERHET, sikreKapsler: process.env.USIKRE_KAPSLER !== '1' });
console.log(`Data lagres i ${lager.fil} (${Object.keys(lager.data.brukere).length} admin-brukere)`);

const server = http.createServer(async (req, res) => {
  let sti;
  try { sti = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return svar(res, 400, 'Ugyldig adresse'); }
  if (sti.startsWith('/api/')) return api(req, res, sti);
  if (req.method !== 'GET' && req.method !== 'HEAD') return svar(res, 405, 'Metoden er ikke tillatt');
  if (sti === '/healthz') return svar(res, 200, 'ok');
  if (sti.endsWith('/')) sti += 'index.html';
  if (SKJULT.test(sti)) return svar(res, 404, 'Finnes ikke');
  const fil = path.join(ROT, path.normalize(sti));
  if (!fil.startsWith(ROT + path.sep)) return svar(res, 403, 'Ikke tillatt');
  const type = TYPER[path.extname(fil).toLowerCase()];
  let info;
  try { info = await stat(fil); } catch { info = null; }
  if (!info?.isFile() || !type) return svar(res, 404, 'Finnes ikke');

  // Alle appfiler valideres ved hver last (ETag), slik at nye versjoner kommer fram med en gang.
  // Service workeren håndterer bruk uten nett.
  const etag = `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
  const hoder = { 'Content-Type': type, ETag: etag, 'Last-Modified': info.mtime.toUTCString(), 'Cache-Control': 'no-cache', ...SIKKERHET };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, hoder); return res.end(); }
  if (KOMPRIMER.test(type) && info.size > 1024) {
    hoder.Vary = 'Accept-Encoding';
    if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      let data;
      try { data = await komprimert(fil, info); } catch { return svar(res, 500, 'Kunne ikke lese fila'); }
      res.writeHead(200, { ...hoder, 'Content-Encoding': 'gzip', 'Content-Length': data.length });
      return res.end(req.method === 'HEAD' ? undefined : data);
    }
  }
  hoder['Content-Length'] = info.size;
  res.writeHead(200, hoder);
  if (req.method === 'HEAD') return res.end();
  const strom = createReadStream(fil);
  strom.on('error', () => res.destroy());
  strom.pipe(res);
});

server.listen(PORT, () => console.log(`Nordfjella villrein kjører på port ${PORT}`));
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => process.exit(0)));
