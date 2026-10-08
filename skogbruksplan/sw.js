// Service worker: appen og besøkte/nedlastede kartfliser fungerer uten nett.
const APP = 'skogiq-app-v28';
const FLISER = 'kartfliser-v1';
const SKALL = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icon.svg',
  'js/app.js', 'js/model.js', 'js/proj.js', 'js/sosi.js', 'js/importers.js', 'js/store.js', 'js/charts.js', 'js/demo.js', 'js/generator.js', 'js/kommuneanalyse.js', 'js/kommune-ui.js', 'js/veier.js', 'js/veier-ui.js', 'js/innsikt.js', 'js/kommando.js', 'js/pefc.js', 'js/pefc-data.js', 'js/pefc-ui.js', 'js/verdi.js', 'js/verdi-ui.js', 'js/datagrunnlag.js', 'js/del.js', 'js/assistent.js', 'js/skade.js', 'js/skade-data.js', 'js/skogbrand-ui.js', 'js/rapporter.js', 'js/markslag.js', 'js/tiltaksmotor.js', 'js/skifteplan.js', 'js/skifteplan-ui.js', 'js/versjon.js', 'js/driftsforhold.js', 'js/miljokart.js', 'js/kml.js', 'js/vegetasjon.js', 'js/kartutsnitt.js', 'js/ai-kontekst.js',
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
  if (url.origin === location.origin && url.pathname.includes('/api/')) return; // data fra serveren (NVE) bufres ikke her
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
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(APP).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((svar) => { if (svar.ok) c.put(e.request, svar.clone()); return svar; })));
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
