// Service worker: appen og besøkte/nedlastede kartfliser fungerer uten nett.
const APP = 'skogplan-app-v1';
const FLISER = 'kartfliser-v1';
const SKALL = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icon.svg',
  'js/app.js', 'js/model.js', 'js/proj.js', 'js/sosi.js', 'js/importers.js', 'js/store.js', 'js/charts.js', 'js/demo.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(SKALL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== APP && n !== FLISER).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname === 'cache.kartverket.no') {
    // Kartfliser: cache først, lagre nye fliser fortløpende.
    e.respondWith(caches.open(FLISER).then(async (c) => {
      const treff = await c.match(e.request.url);
      if (treff) return treff;
      const svar = await fetch(e.request);
      if (svar.ok) c.put(e.request.url, svar.clone());
      return svar;
    }));
    return;
  }
  if (url.origin === location.origin || url.hostname === 'unpkg.com') {
    // Appfiler: nett først (får oppdateringer), cache som reserve offline.
    e.respondWith(fetch(e.request).then((svar) => {
      if (svar.ok) { const kopi = svar.clone(); caches.open(APP).then((c) => c.put(e.request, kopi)); }
      return svar;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
  }
});
