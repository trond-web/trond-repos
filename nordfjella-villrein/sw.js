// Service worker: appen, nedlastede og besøkte kartruter virker uten nett.
// Mangler en kartrute uten nett, lages den ved å forstørre en lagret rute fra et lavere zoomnivå.
const APP = 'nfv-app-v1';
const FLISER = 'nfv-fliser-v1';
const SKALL = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icon.svg', 'data/nordfjella.geojson',
  'js/app.js', 'js/geo.js', 'js/kilder.js', 'js/registrering.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/images/layers.png'];
const FLISVERTER = ['cache.kartverket.no', 'wms.geonorge.no', 'kart.miljodirektoratet.no', 'server.arcgisonline.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(SKALL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n.startsWith('nfv-') && n !== APP && n !== FLISER).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (FLISVERTER.includes(url.hostname) && (url.pathname.includes('/wmts/') || /REQUEST=GetMap/i.test(url.search) || url.pathname.includes('/tile/'))) {
    e.respondWith(flis(e.request));
    return;
  }
  if (url.origin === location.origin || url.hostname === 'unpkg.com') {
    // Appfiler: nett først (får oppdateringer), cache som reserve uten nett.
    e.respondWith(medTidsavbrudd(fetch(e.request), 6000).then((svar) => {
      if (svar.ok) { const kopi = svar.clone(); caches.open(APP).then((c) => c.put(e.request, kopi)); }
      return svar;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))));
  }
});

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
