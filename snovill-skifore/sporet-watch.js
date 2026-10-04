/* ------------------------------------------------------------------ *
 *  Løypevakt – felles kode for siden (app.js) og service workeren (sw.js)
 *  Sjekker Sporet.no for løyper som nylig er kjørt innenfor en radius.
 * ------------------------------------------------------------------ */

(function (global) {
  "use strict";

  const DB_NAME = "snovill-watch";
  const STORE = "kv";
  // Bare preparering nyere enn dette regnes som «nettopp kjørt»
  const FRESH_MS = 6 * 3600000;

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function kvGet(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function kvSet(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // WGS84 → UTM sone 33 (EPSG:25833), som Sporet-API-et bruker
  function toUtm33(lat, lon) {
    const a = 6378137.0;
    const f = 1 / 298.257223563;
    const k0 = 0.9996;
    const e2 = f * (2 - f);
    const ep2 = e2 / (1 - e2);
    const phi = (lat * Math.PI) / 180;
    const lam = (lon * Math.PI) / 180;
    const lam0 = (15 * Math.PI) / 180;
    const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
    const T = Math.tan(phi) ** 2;
    const C = ep2 * Math.cos(phi) ** 2;
    const A = Math.cos(phi) * (lam - lam0);
    const M =
      a *
      ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * phi -
        ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * phi) +
        ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * phi) -
        ((35 * e2 ** 3) / 3072) * Math.sin(6 * phi));
    const x =
      k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5) / 120) + 500000;
    const y =
      k0 *
      (M +
        N *
          Math.tan(phi) *
          (A ** 2 / 2 + ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 + ((61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6) / 720));
    return [x, y];
  }

  async function fetchRoutes(lat, lon, radiusKm) {
    const [x, y] = toUtm33(lat, lon);
    const r = radiusKm * 1000;
    const url =
      `https://api.sporet.no/loypeapi/publicfree/skiroutes/detailsbybbox` +
      `?xMin=${Math.round(x - r)}&yMin=${Math.round(y - r)}&xMax=${Math.round(x + r)}&yMax=${Math.round(y + r)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Sporet svarte ${res.status}`);
    const routes = await res.json();
    return routes
      .filter((rt) => rt.preppedTime)
      .map((rt) => ({ id: rt.id, name: rt.name, prepped: rt.preppedTime }))
      .sort((a, b) => Date.parse(b.prepped) - Date.parse(a.prepped));
  }

  /**
   * Henter løyper rundt posisjonen og finner de som er kjørt siden forrige sjekk.
   * Første gang lagres bare en grunnlinje, så man ikke får varsel for gammel preparering.
   */
  async function check({ lat, lon, radiusKm }) {
    const routes = await fetchRoutes(lat, lon, radiusKm);
    const seen = await kvGet("seen");
    const now = Date.now();
    const fresh = seen
      ? routes.filter((r) => {
          const t = Date.parse(r.prepped);
          const before = seen[r.id] ? Date.parse(seen[r.id]) : 0;
          return t > before && now - t < FRESH_MS;
        })
      : [];
    const nextSeen = { ...(seen || {}) };
    for (const r of routes) nextSeen[r.id] = r.prepped;
    await kvSet("seen", nextSeen);
    await kvSet("lastCheck", { t: now, count: routes.length, freshCount: fresh.length });
    return { routes, fresh, baseline: !seen };
  }

  function ago(iso) {
    const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    if (min < 60) return `${min} min siden`;
    return `${Math.round(min / 60)} t siden`;
  }

  function message(fresh, place) {
    const where = place ? ` ${place}` : " i nærheten";
    if (fresh.length === 1) {
      return {
        title: "🚜 Løypemaskinen er ute!",
        body: `${fresh[0].name} ble kjørt ${ago(fresh[0].prepped)}${where}. Smør skiene, Snøvill! ⛷️`,
      };
    }
    const names = fresh.slice(0, 3).map((r) => r.name).join(", ");
    const more = fresh.length > 3 ? ` + ${fresh.length - 3} til` : "";
    return {
      title: `🚜 ${fresh.length} løyper nykjørt${where}!`,
      body: `${names}${more}. Ferske spor venter! ⛷️`,
    };
  }

  global.SporetWatch = { kvGet, kvSet, toUtm33, fetchRoutes, check, message, FRESH_MS };
})(typeof self !== "undefined" ? self : window);
