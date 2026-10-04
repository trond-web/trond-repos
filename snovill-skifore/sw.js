/* Service worker: viser løypevarsler og sjekker Sporet i bakgrunnen der nettleseren støtter det */
importScripts("sporet-watch.js");

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

async function backgroundCheck() {
  const cfg = await SporetWatch.kvGet("config");
  if (!cfg?.enabled || cfg.lat == null) return;
  const { fresh } = await SporetWatch.check(cfg);
  if (!fresh.length) return;
  const n = SporetWatch.message(fresh, cfg.placeLabel);
  await self.registration.showNotification(n.title, {
    body: n.body,
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: "sporet-prep",
    renotify: true,
    data: { url: self.registration.scope },
  });
}

// Periodic Background Sync (Chrome/Edge på Android og desktop når appen er installert)
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "sporet-check") event.waitUntil(backgroundCheck());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.registration.scope;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if (c.url.startsWith(self.registration.scope) && "focus" in c) return c.focus();
      return self.clients.openWindow(url);
    })
  );
});
