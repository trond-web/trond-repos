/* Service worker: viser varsler når løypemaskinen starter, og sjekker Sporet i bakgrunnen der det støttes */
importScripts("sporet-watch.js");

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

async function backgroundCheck() {
  const cfg = await SporetWatch.kvGet("config");
  if (!cfg?.enabled || cfg.lat == null) return;
  const prev = await SporetWatch.kvGet("active");
  const result = await SporetWatch.detectStarts(prev || null, [{ lat: cfg.lat, lon: cfg.lon, radiusKm: cfg.radiusKm }]);
  await SporetWatch.kvSet("active", result.activeNow);
  const { started } = result.perArea[0];
  if (!started.length) return;
  const n = SporetWatch.startMessage(started, cfg.placeLabel);
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
