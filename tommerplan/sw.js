// Service worker: planleggeren virker uten nett.
const APP = 'tommerplan-v3';
const SKALL = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icon.svg', 'js/app.js', 'js/motor.js', 'js/demo.js', 'js/graf.js', 'js/logistikk.js', 'js/ordre.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(SKALL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== APP).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Nett først (får oppdateringer), cache som reserve uten dekning.
  e.respondWith(fetch(e.request).then((svar) => {
    if (svar.ok) { const kopi = svar.clone(); caches.open(APP).then((c) => c.put(e.request, kopi)); }
    return svar;
  }).catch(async () => (await caches.match(e.request, { ignoreSearch: true })) || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())));
});
