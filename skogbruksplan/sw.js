// Service worker: appen og besøkte/nedlastede kartfliser fungerer uten nett.
const APP = 'skogiq-app-v43';
const FLISER = 'kartfliser-v1';
const SKALL = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icon.svg', 'ikon-180.png', 'ikon-192.png', 'ikon-512.png', 'ikon-maskerbar-512.png',
  'felt.html', 'felt.css', 'felt.webmanifest', 'js/felt-app.js', 'js/offline-kart.js', 'js/sporlogg.js', 'js/sporlogg-ui.js', 'js/tiltak-endring.js', 'js/flate-geometri.js', 'js/flate-redigering.js', 'js/treff.js', 'js/oppdrag-felt.js',
  'js/app.js', 'js/model.js', 'js/proj.js', 'js/sosi.js', 'js/importers.js', 'js/store.js', 'js/charts.js', 'js/demo.js', 'js/generator.js', 'js/kommuneanalyse.js', 'js/kommune-ui.js', 'js/veier.js', 'js/veier-ui.js', 'js/innsikt.js', 'js/kommando.js', 'js/pefc.js', 'js/pefc-data.js', 'js/pefc-ui.js', 'js/verdi.js', 'js/verdi-ui.js', 'js/datagrunnlag.js', 'js/del.js', 'js/assistent.js', 'js/skade.js', 'js/skade-data.js', 'js/skogbrand-ui.js', 'js/rapporter.js', 'js/markslag.js', 'js/tiltaksmotor.js', 'js/skifteplan.js', 'js/skifteplan-ui.js', 'js/versjon.js', 'js/driftsforhold.js', 'js/miljokart.js', 'js/kml.js', 'js/vegetasjon.js', 'js/kartutsnitt.js', 'js/oppdrag.js', 'js/oppdrag-ui.js', 'js/ksl.js', 'js/ksl-ui.js', 'js/ksl-standard.js', 'js/karbon.js', 'js/karbon-ui.js', 'js/flere-eiendommer.js', 'js/ai-kontekst.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];

// Biblioteker som lastes ved behov (planlaging, deling av bestand). Bufres hvis mulig, men stopper ikke installasjonen.
const VALGFRITT = ['https://unpkg.com/@turf/turf@7.2.0/turf.min.js', 'https://unpkg.com/polygon-clipping@0.15.7/dist/polygon-clipping.umd.min.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP).then(async (c) => {
    await c.addAll(SKALL);
    await Promise.all(VALGFRITT.map((u) => c.add(u).catch(() => {})));
  }).then(() => self.skipWaiting()));
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
    }).catch(async () => {
      const r = await caches.match(e.request, { ignoreSearch: true });
      if (r) return r;
      // Uten nett: sidevisninger får riktig side fra cachen (mobilversjonen eller fullversjonen).
      if (e.request.mode === 'navigate') return caches.match(url.pathname.endsWith('felt.html') ? 'felt.html' : 'index.html');
      return Response.error();
    }));
  }
});
