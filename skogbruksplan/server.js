// Enkel statisk server for SkogIQ.ai (Railway m.fl.). Ingen avhengigheter – kun Node sitt standardbibliotek.
// Kjør: PORT=8080 node server.js
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createGzip } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lagRelay, kontrollerApi } from './kontroller-relay.js';
import { lagPlanRelay, planApi } from './plan-relay.js';
import { lagJdRelay, jdApi, JD_SANDKASSE } from './jd-relay.js';
import { lagInnlogging, innloggingApi, krevInnlogging, corsFor, lagEpostSender } from './auth.js';
import { lagTilbudRelay, tilbudApi } from './tilbud-relay.js';
import { lagSkyLager, skyApi } from './sky-lager.js';

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
const SKJULT = /^\/(tests|verktoy|node_modules)(\/|$)|^\/(server\.js|kontroller-relay\.js|plan-relay\.js|jd-relay\.js|auth\.js|tilbud-relay\.js|sky-lager\.js|package(-lock)?\.json|railway\.json)$|\/\./;
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
// Nettleseren på GitHub Pages (og lokalt) får lese svarene (CORS), f.eks. snødybde til været i den virtuelle skogen.
const NVE_OPPHAV = /^(https:\/\/(skogiq-production\.up\.railway\.app|trond-web\.github\.io)|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;
async function nve(sti, res, req) {
  const o = req?.headers?.origin; const cors = o && NVE_OPPHAV.test(o) ? { 'Access-Control-Allow-Origin': o, Vary: 'Origin' } : {};
  const m = sti.match(NVE_STI);
  if (!m) return svar(res, 400, 'Ugyldig NVE-forespørsel');
  const naa = Date.now(); const lagret = nveBuffer.get(sti);
  if (lagret && naa - lagret.tid < 30 * 60 * 1000) { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'max-age=900', 'X-Buffer': 'treff', ...cors, ...SIKKERHET }); return res.end(lagret.body); }
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(`https://gts.nve.no/api/GridTimeSeries/${m[1]}/${m[2]}/${m[3]}/${m[4]}/${m[5]}.json`, { signal: ctrl.signal, headers: { 'User-Agent': 'SkogIQ.ai (skogiq-production.up.railway.app)' } });
    clearTimeout(t);
    const body = await r.text();
    if (!r.ok) return svar(res, 502, `NVE svarte ${r.status}`);
    if (nveBuffer.size > 5000) nveBuffer.delete(nveBuffer.keys().next().value);
    nveBuffer.set(sti, { tid: naa, body });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'max-age=900', ...cors, ...SIKKERHET });
    res.end(body);
  } catch (e) { svar(res, 504, `NVE svarte ikke: ${e.message}`); }
}

// Overføring av droneoppdrag til fjernkontrollen (se kontroller-relay.js).
const relay = lagRelay({ fil: process.env.KONTROLLER_FIL || null });
// Overføring og synkronisering av planer mellom PC og mobil (se plan-relay.js).
const planRelay = lagPlanRelay({ fil: process.env.PLAN_FIL || null });
// Tilbudsforespørsler til utførere (tilbud-relay.js). Mottakerne svarer via lenke uten innlogging.
const tilbudRelay = lagTilbudRelay({ fil: process.env.TILBUD_FIL || null });
// Innlogging (auth.js): brukernavn og passord settes som miljøvariabler på serveren, aldri i koden.
// Med APP_REGISTRERING=1 registrerer brukerne seg selv; brukere og bruksstatistikk lagres i BRUKER_FIL (Railway-volum).
// Skylagring av planene per bruker (sky-lager.js). SKY_MAPPE, eller mappen «sky» ved siden av BRUKER_FIL (Railway-volumet).
const SKY_MAPPE = process.env.SKY_MAPPE || (process.env.BRUKER_FIL ? path.join(path.dirname(process.env.BRUKER_FIL), 'sky') : null);
const sky = lagSkyLager({ mappe: SKY_MAPPE });
if (!sky.permanent) console.warn('SKY_MAPPE er ikke satt – planene i skyen forsvinner når serveren startes på nytt.');
const innlogging = lagInnlogging({
  bruker: process.env.APP_BRUKER || '', passord: process.env.APP_PASSORD || '', hemmelighet: process.env.APP_HEMMELIGHET || '',
  registrering: process.env.APP_REGISTRERING === '1', fil: process.env.BRUKER_FIL || null, admin: process.env.APP_ADMIN || '', kode: process.env.APP_REGISTRERINGSKODE || '',
  sendEpost: lagEpostSender({ nokkel: process.env.EPOST_NOKKEL || '', fra: process.env.EPOST_FRA || '' }),
  ekstraBruker: (u) => ({ sky: sky.bruk(u) }), vedSlett: (u) => sky.slettBruker(u),
});
// Uten innlogging (lokal utvikling) brukes én lokal bruker med profil i minnet.
const lokalProfil = { navn: 'Lokal bruker', epost: '' };
const skyOppsett = {
  bruker: (req) => (innlogging.aktiv ? innlogging.fraForesporsel(req)?.u || null : 'lokal'),
  profil: innlogging.registrering ? { hent: (u) => innlogging.hentProfil(u), lagre: (u, d) => innlogging.lagreProfil(u, d) } : { hent: () => lokalProfil, lagre: (u, d) => { Object.assign(lokalProfil, d); return { ok: true, profil: lokalProfil }; } },
  cors: corsFor,
};
if (innlogging.registrering && !innlogging.permanent) console.warn('BRUKER_FIL er ikke satt – registrerte brukere forsvinner når serveren startes på nytt.');
// John Deere Operations Center (se jd-relay.js). Uten JD_CLIENT_ID/JD_CLIENT_SECRET svarer /api/jd/status at det ikke er satt opp.
const jdRelay = lagJdRelay({ klientId: process.env.JD_CLIENT_ID || '', hemmelighet: process.env.JD_CLIENT_SECRET || '', tilbakeUrl: process.env.JD_REDIRECT || '', api: process.env.JD_API || JD_SANDKASSE, fil: process.env.JD_FIL || null });

function svar(res, status, tekst) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...SIKKERHET });
  res.end(tekst);
}

const server = http.createServer(async (req, res) => {
  let sti;
  try { sti = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return svar(res, 400, 'Ugyldig adresse'); }
  // Forhåndssjekk (CORS) fra appen på GitHub Pages: Authorization-hodet bærer innloggingen.
  if (req.method === 'OPTIONS' && sti.startsWith('/api/')) { const c = corsFor(req); res.writeHead(204, { ...c, ...(c['Access-Control-Allow-Origin'] ? { 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' } : {}) }); return res.end(); }
  if (innloggingApi(innlogging, req, res, sti, SIKKERHET)) return;
  // Utførernes visning og svar er åpne (personlig kode i lenken). Oppdragsgiverens kall (opprette, hente svar, tildele)
  // krever innlogging når den er slått på, og eiernøkkelen.
  const utforerKall = (req.method === 'GET' && /^\/api\/tilbud\/[a-f0-9]{16}$/.test(sti)) || (req.method === 'POST' && /^\/api\/tilbud\/[a-f0-9]{16}\/svar$/.test(sti));
  if (utforerKall && tilbudApi(tilbudRelay, req, res, sti, SIKKERHET)) return;
  if (krevInnlogging(innlogging, req, res, sti, SIKKERHET)) return;
  if (tilbudApi(tilbudRelay, req, res, sti, SIKKERHET)) return;
  if (kontrollerApi(relay, req, res, sti, SIKKERHET)) return;
  if (skyApi(sky, skyOppsett, req, res, sti, SIKKERHET)) return;
  if (planApi(planRelay, req, res, sti, SIKKERHET)) return;
  if (jdApi(jdRelay, req, res, sti, SIKKERHET)) return;
  if (req.method !== 'GET' && req.method !== 'HEAD') return svar(res, 405, 'Metoden er ikke tillatt');
  if (sti === '/k' || sti === '/kontroller') { res.writeHead(302, { Location: '/kontroller.html', ...SIKKERHET }); return res.end(); }
  if (sti === '/healthz') return svar(res, 200, 'ok');
  if (sti.startsWith('/api/nve/')) return nve(sti, res, req);
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
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => { try { innlogging.lager?.flush(); } catch { /* ignorer */ } server.close(() => process.exit(0)); });
