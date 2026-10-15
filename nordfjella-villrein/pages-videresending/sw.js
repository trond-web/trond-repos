// Avvikler den gamle appen på GitHub Pages: sletter lagrede filer, avregistrerer seg og laster siden på nytt,
// slik at brukerne kommer til videresendingen til https://nordfjella.up.railway.app/.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const navn of await caches.keys()) await caches.delete(navn);
    await self.registration.unregister();
    for (const klient of await self.clients.matchAll({ type: 'window' })) klient.navigate(klient.url);
  })());
});
