/* ------------------------------------------------------------------ *
 *  Løypevakt – felles kode for siden (app.js) og service workeren (sw.js)
 *  Sjekker Sporet.no og varsler når løypemaskinen starter i områder i nærheten.
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

  /* ---------------- alle Sporet-områder (destinasjoner) i Norge ---------------- *
   * Kartlaget «Destinasjoner_prep» gir status for hvert område. Kode 20 = kjørt
   * siste 6 timer, og et område går over til 20 straks første strekning er kjørt.
   * Overgangen til 20 brukes derfor som «løypemaskinen har startet».
   */
  const DEST_URL =
    "https://ags.sporet.no/arcgis/rest/services/Sporet_simple/MapServer/4/query" +
    "?where=is_active%3D1&outFields=id,name,prepsymbol,municipalname&outSR=4326&f=json";
  const ACTIVE = 20;
  const PREP_LABELS = {
    20: "Kjøres nå / siste 6 t",
    30: "Kjørt for over 6 t siden",
    40: "Kjørt for over 18 t siden",
    50: "Kjørt for over 2 døgn siden",
    60: "Kjørt for over 14 dager siden",
    70: "Ikke kjørt denne sesongen",
  };

  async function fetchDestinations() {
    const res = await fetch(DEST_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Sporet-kartet svarte ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(`Sporet-kartet: ${data.error.message}`);
    return (data.features || []).map((f) => ({
      id: f.attributes.id,
      name: f.attributes.name,
      municipality: f.attributes.municipalname,
      prep: f.attributes.prepsymbol,
      lat: f.geometry.y,
      lon: f.geometry.x,
    }));
  }

  function distanceKm(lat1, lon1, lat2, lon2) {
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(a));
  }

  function nearby(dests, lat, lon, radiusKm) {
    return dests
      .map((d) => ({ ...d, km: distanceKm(lat, lon, d.lat, d.lon) }))
      .filter((d) => d.km <= radiusKm)
      .sort((a, b) => a.km - b.km);
  }

  // Finn de første løypene som er kjørt i et område som nettopp har startet
  async function firstRoutes(dest) {
    try {
      const routes = await fetchRoutes(dest.lat, dest.lon, 3);
      return routes.filter((r) => Date.now() - Date.parse(r.prepped) < FRESH_MS).slice(0, 3);
    } catch {
      return [];
    }
  }

  /**
   * Sammenligner med forrige sjekk og finner områder der maskinen har startet.
   * prevActive: id-er som var aktive sist (hele Norge), eller null første gang.
   * areas: [{ lat, lon, radiusKm, label }] – områdene brukeren følger.
   */
  async function detectStarts(prevActive, areas) {
    const dests = await fetchDestinations();
    const activeNow = dests.filter((d) => d.prep === ACTIVE).map((d) => d.id);
    const prev = prevActive ? new Set(prevActive) : null;
    const notified = new Set();
    const perArea = [];
    for (const area of areas) {
      const near = nearby(dests, area.lat, area.lon, area.radiusKm);
      const started = prev ? near.filter((d) => d.prep === ACTIVE && !prev.has(d.id) && !notified.has(d.id)) : [];
      started.forEach((d) => notified.add(d.id));
      for (const d of started.slice(0, 5)) d.routes = await firstRoutes(d);
      perArea.push({ area, near, started });
    }
    return { activeNow, perArea, baseline: !prev, total: dests.length };
  }

  function ago(iso) {
    const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    if (min < 60) return `${min} min siden`;
    return `${Math.round(min / 60)} t siden`;
  }

  function startMessage(started, place) {
    const where = place ? ` ${place}` : "";
    if (started.length === 1) {
      const d = started[0];
      const routes = d.routes?.length
        ? ` Første spor: ${d.routes.map((r) => r.name).join(", ")} (${ago(d.routes[0].prepped)}).`
        : "";
      return {
        title: `🚜 Løypemaskinen har startet på ${d.name}!`,
        body: `Det kjøres spor${where} nå.${routes} Gjør klar skiene, Snøvill! ⛷️`,
      };
    }
    const names = started.slice(0, 4).map((d) => d.name).join(", ");
    const more = started.length > 4 ? ` + ${started.length - 4} til` : "";
    return {
      title: `🚜 Løypemaskinene har startet ${started.length} steder${where}!`,
      body: `${names}${more}. Ferske spor på vei! ⛷️`,
    };
  }

  global.SporetWatch = {
    kvGet,
    kvSet,
    toUtm33,
    fetchRoutes,
    fetchDestinations,
    nearby,
    detectStarts,
    startMessage,
    PREP_LABELS,
    ACTIVE,
    FRESH_MS,
  };
})(typeof self !== "undefined" ? self : globalThis);
