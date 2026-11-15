// Service worker: appen, valdgrenser, nedlastede og besøkte kartruter virker uten nett og starter raskt ved dårlig dekning.
// Mangler en kartrute uten nett, lages den ved å forstørre en lagret rute fra et lavere zoomnivå.
const APP = 'nfv-app-v8';
const FLISER = 'nfv-fliser-v1';
const API = 'nfv-api-v1'; // siste svar fra serveren (valdgrenser, samjakt) – beholdes på tvers av versjoner
const SKALL = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icon.svg', 'data/nordfjella.geojson', 'data/fliser.json',
  'js/app.js', 'js/geo.js', 'js/kilder.js', 'js/versjon.js', 'js/installer.js', 'js/jaktfelt.js', 'js/samjakt.js',
  'ikoner/logo.svg', 'ikoner/logo-lys.svg', 'ikoner/icon-192.png', 'ikoner/icon-512.png', 'ikoner/apple-touch-icon.png',
  'vendor/leaflet/leaflet.css', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/images/layers.png', 'vendor/leaflet/images/layers-2x.png'];
const FLISVERTER = ['cache.kartverket.no', 'wms.geonorge.no', 'kart.miljodirektoratet.no', 'server.arcgisonline.com'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    await (await caches.open(APP)).addAll(SKALL);
    // Fra eldre versjoner lå siste valdkart/samjakt i app-cachen: flytt dem over, så de virker uten nett etter oppdateringen.
    const api = await caches.open(API);
    for (const sti of ['api/jaktfelt', 'api/samjakt']) {
      const url = new URL(sti, self.registration.scope).href;
      if (await api.match(url)) continue;
      const gammel = await caches.match(url);
      if (gammel) await api.put(url, gammel);
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n.startsWith('nfv-') && ![APP, FLISER, API].includes(n)).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (FLISVERTER.includes(url.hostname) && (url.pathname.includes('/wmts/') || /REQUEST=GetMap/i.test(url.search) || url.pathname.includes('/tile/'))) {
    e.respondWith(flis(e.request));
    return;
  }
  if (url.origin !== location.origin) return;
  const sti = url.pathname.slice(SCOPE.length);
  if (sti.startsWith('api/')) { e.respondWith(api(e.request)); return; }
  // Appskallet (lagret ved installasjon) hentes alltid fra telefonen, så appen starter med en gang også med
  // dårlig dekning. Nye versjoner kommer med en ny service worker, som laster ned hele det nye skallet i bakgrunnen.
  if (e.request.mode === 'navigate' && (sti === '' || sti === 'index.html')) { e.respondWith(fraSkall('index.html', e.request)); return; }
  if (SKALL.includes(sti)) { e.respondWith(fraSkall(sti, e.request)); return; }
  // Andre filer (admin o.l.): nett først, lagret kopi som reserve.
  e.respondWith(fetch(e.request).then((svar) => {
    if (svar.ok) { const kopi = svar.clone(); caches.open(APP).then((c) => c.put(e.request, kopi)); }
    return svar;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || Response.error())));
});

const SCOPE = new URL(self.registration.scope).pathname;

async function fraSkall(sti, req) {
  const treff = await caches.match(sti, { cacheName: APP, ignoreSearch: true });
  return treff || fetch(req);
}

// API: alltid fra nettet når det går, og siste svar tas vare på. Appen leser selv lagret kopi ved oppstart
// (se hentLagret i app.js), så den aldri venter på nettet før kartet vises.
async function api(req) {
  try {
    const svar = await fetch(req);
    if (svar.ok) { const kopi = svar.clone(); caches.open(API).then((c) => c.put(req.url.replace(/[?#].*$/, ''), kopi)); }
    return svar;
  } catch {
    const lagret = await caches.match(req.url.replace(/[?#].*$/, ''), { cacheName: API });
    return lagret || new Response('{"feil":"Uten nett"}', { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}

const medTidsavbrudd = (p, ms) => Promise.race([p, new Promise((_, nei) => setTimeout(() => nei(new Error('tidsavbrudd')), ms))]);

async function flis(req) {
  const cache = await caches.open(FLISER);
  const treff = await cache.match(req.url);
  if (treff) return treff;
  try {
    // Dårlig dekning på fjellet: gi opp etter 8 s og bruk det vi har.
    const svar = await medTidsavbrudd(fetch(req), 8000);
    if (svar.ok) { cache.put(req.url, svar.clone()); return svar; }
    throw new Error(`HTTP ${svar.status}`);
  } catch (feil) {
    const erstatning = await fraForelder(cache, req.url).catch(() => null);
    if (erstatning) return erstatning;
    return new Response('', { status: 504, statusText: 'Uten nett' });
  }
}

// ---------- Forstørre rute fra lavere zoomnivå ----------

const S = 2 * Math.PI * 6378137, O = S / 2;
const bbox3857 = (x, y, z) => { const d = S / 2 ** z; return [x * d - O, O - (y + 1) * d, (x + 1) * d - O, O - y * d]; };

// Tolker en flis-URL til {z, x, y, lag(zz, xx, yy) → URL}. Støtter Kartverkets WMTS og WMS-rutene appen lager.
function tolk(url) {
  const m = url.match(/^(.*\/)(\d+)\/(\d+)\/(\d+)\.png$/);
  if (m) return { z: +m[2], y: +m[3], x: +m[4], lag: (z, x, y) => `${m[1]}${z}/${y}/${x}.png` };
  const b = url.match(/([?&]BBOX=)([-\d.,]+)/i);
  if (b && /WIDTH=256/.test(url)) {
    const [minx, , maxx, maxy] = b[2].split(',').map(Number);
    const z = Math.round(Math.log2(S / (maxx - minx)));
    const d = S / 2 ** z;
    return { z, x: Math.round((minx + O) / d), y: Math.round((O - maxy) / d), lag: (zz, xx, yy) => url.replace(b[0], `${b[1]}${bbox3857(xx, yy, zz).map((v) => v.toFixed(2)).join(',')}`) };
  }
  return null;
}

async function fraForelder(cache, url) {
  const t = tolk(url);
  if (!t || typeof OffscreenCanvas === 'undefined') return null;
  for (let dz = 1; dz <= 6 && t.z - dz >= 0; dz++) {
    const k = 2 ** dz;
    const fx = Math.floor(t.x / k), fy = Math.floor(t.y / k);
    const treff = await cache.match(t.lag(t.z - dz, fx, fy));
    if (!treff) continue;
    const bilde = await createImageBitmap(await treff.blob());
    const side = bilde.width / k;
    const lerret = new OffscreenCanvas(256, 256);
    const ctx = lerret.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bilde, (t.x - fx * k) * side, (t.y - fy * k) * side, side, side, 0, 0, 256, 256);
    const blob = await lerret.convertToBlob({ type: 'image/png' });
    return new Response(blob, { headers: { 'Content-Type': 'image/png', 'X-Nfv': `forstørret-${dz}` } });
  }
  return null;
}
