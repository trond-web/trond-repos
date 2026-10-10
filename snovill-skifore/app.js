"use strict";

/* ------------------------------------------------------------------ *
 *  Snøvill Skiføre – skiføre-radar for Sjusjøen, Øyerfjellet, Nordseter, Oppsjøen, Nordåsen og Bjertnessjøen
 * ------------------------------------------------------------------ */

const DAYS = 10;
const CACHE_MINUTES = 20;
const TZ = "Europe/Oslo";

const LOCATIONS = [
  {
    id: "sjusjoen",
    name: "Sjusjøen",
    lat: 61.1547,
    lon: 10.7019,
    altitude: 840,
    sporetId: 10084,
    utm: [268780, 6787617],
    sporetRadius: 3000,
    emoji: "🌲",
  },
  {
    id: "oyerfjellet",
    name: "Øyerfjellet",
    lat: 61.2788,
    lon: 10.564,
    altitude: 930,
    sporetId: 10114,
    utm: [262311, 6801919],
    sporetRadius: 4000,
    emoji: "🏔️",
  },
  {
    id: "nordseter",
    name: "Nordseter",
    lat: 61.1864,
    lon: 10.6194,
    altitude: 850,
    sporetId: 10154,
    utm: [264586, 6791437],
    sporetRadius: 3000,
    emoji: "🫎",
  },
  {
    id: "oppsjoen",
    name: "Oppsjøen",
    lat: 61.1624,
    lon: 9.819,
    altitude: 886,
    sporetId: 10142,
    utm: [221417, 6791915],
    sporetRadius: 5000,
    emoji: "🏞️",
  },
  {
    id: "nordasen",
    name: "Nordåsen",
    lat: 60.3008,
    lon: 11.0284,
    altitude: 344,
    sporetId: 10189,
    utm: [280579, 6691521],
    sporetRadius: 4000,
    emoji: "🏟️",
  },
  {
    id: "bjertnessjoen",
    name: "Bjertnessjøen",
    lat: 60.195,
    lon: 10.8811,
    altitude: 338,
    sporetId: 10822,
    utm: [271708, 6680251],
    sporetRadius: 4000,
    emoji: "🦆",
  },
];

// Steder som er byttet ut: lagrede innstillinger flyttes til det nye stedet
const RENAMED_LOCATIONS = { synnfjell: "oppsjoen" };

const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
];

const state = {
  settings: loadSettings(),
  results: {},
  sources: {},
  days: [],
};

const $ = (id) => document.getElementById(id);

/* ----------------------------- utils ------------------------------ */

const dateKeyFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat("nb-NO", { timeZone: TZ, weekday: "short" });
const weekdayLongFmt = new Intl.DateTimeFormat("nb-NO", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const dayMonthFmt = new Intl.DateTimeFormat("nb-NO", { timeZone: TZ, day: "numeric", month: "numeric" });

function dateKey(d) {
  return dateKeyFmt.format(d);
}

function nextDays(n) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    // Midt på dagen i UTC gir riktig lokal dato uansett sommertid
    const d = new Date(now.getTime() + i * 86400000);
    out.push({ key: dateKey(d), date: d });
  }
  // Fjern eventuelle duplikater rundt sommertid-overgang
  return out.filter((d, i, arr) => i === 0 || d.key !== arr[i - 1].key);
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fmt1(n) {
  return n == null || Number.isNaN(n) ? "–" : (Math.round(n * 10) / 10).toLocaleString("nb-NO");
}

function fmt0(n) {
  return n == null || Number.isNaN(n) ? "–" : (Math.round(n) || 0).toLocaleString("nb-NO");
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function quantile(arr, q) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

// Enkel deterministisk "tilfeldighet" så sitatene ikke hopper rundt ved hver oppdatering
function seededPick(arr, seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return arr[Math.abs(h) % arr.length];
}

function timeAgo(date) {
  const diffH = (Date.now() - date.getTime()) / 3600000;
  if (diffH < 1) return "under en time siden";
  if (diffH < 24) return `${Math.round(diffH)} t siden`;
  const d = Math.round(diffH / 24);
  if (d === 1) return "i går";
  if (d < 60) return `${d} dager siden`;
  return `${Math.round(d / 30)} mnd siden`;
}

function geohash(lat, lon, precision = 12) {
  const base32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  const latR = [-90, 90];
  const lonR = [-180, 180];
  let hash = "";
  let bit = 0;
  let ch = 0;
  let even = true;
  while (hash.length < precision) {
    const r = even ? lonR : latR;
    const v = even ? lon : lat;
    const mid = (r[0] + r[1]) / 2;
    if (v > mid) {
      ch |= 1 << (4 - bit);
      r[0] = mid;
    } else {
      r[1] = mid;
    }
    even = !even;
    if (++bit === 5) {
      hash += base32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

/* --------------------------- storage ------------------------------ */

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* privat modus o.l. – appen fungerer uten */
  }
}

function loadSettings() {
  const defaults = { threshold: 25, selfThreshold: 2, netatmoToken: "", baseDepth: {} };
  try {
    const saved = { ...defaults, ...JSON.parse(storageGet("snovill.settings") || "{}") };
    for (const [oldId, newId] of Object.entries(RENAMED_LOCATIONS)) {
      if (saved.baseDepth?.[oldId] != null) {
        if (saved.baseDepth[newId] == null) saved.baseDepth[newId] = saved.baseDepth[oldId];
        delete saved.baseDepth[oldId];
      }
    }
    return saved;
  } catch {
    return defaults;
  }
}

function saveSettings() {
  storageSet("snovill.settings", JSON.stringify(state.settings));
}

async function cached(key, loader, { force = false, minutes = CACHE_MINUTES } = {}) {
  const ck = "snovill.cache." + key;
  if (!force) {
    try {
      const hit = JSON.parse(storageGet(ck) || "null");
      if (hit && Date.now() - hit.t < minutes * 60000) return hit.v;
    } catch {
      /* ignorer ødelagt cache */
    }
  }
  const v = await loader();
  storageSet(ck, JSON.stringify({ t: Date.now(), v }));
  return v;
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

/* --------------------------- data: Yr ----------------------------- *
 * MET Norge Locationforecast – samme data som Yr viser.
 * Returnerer blokker: { start: ISO, hours, precip (mm), temp (°C) }
 */

async function fetchYr(loc, force) {
  return cached(`yr.${loc.id}`, async () => {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${loc.lat}&lon=${loc.lon}&altitude=${loc.altitude}`;
    const data = await fetchJson(url);
    const ts = data.properties.timeseries;
    const blocks = [];
    let coveredUntil = 0;
    for (let i = 0; i < ts.length; i++) {
      const t = Date.parse(ts[i].time);
      if (t < coveredUntil) continue;
      const next = ts[i + 1];
      const tNext = next ? Date.parse(next.time) : null;
      const temp0 = ts[i].data.instant.details.air_temperature;
      let hours = null;
      let precip = null;
      if (ts[i].data.next_1_hours && tNext && tNext - t === 3600000) {
        hours = 1;
        precip = ts[i].data.next_1_hours.details.precipitation_amount ?? 0;
      } else if (ts[i].data.next_6_hours) {
        hours = 6;
        precip = ts[i].data.next_6_hours.details.precipitation_amount ?? 0;
      } else if (ts[i].data.next_1_hours) {
        hours = 1;
        precip = ts[i].data.next_1_hours.details.precipitation_amount ?? 0;
      }
      if (hours == null) continue;
      // Snitt av temperaturen ved start og slutt på blokken
      const endIdx = ts.findIndex((x, j) => j > i && Date.parse(x.time) >= t + hours * 3600000);
      const temp1 = endIdx > -1 ? ts[endIdx].data.instant.details.air_temperature : temp0;
      blocks.push({ start: ts[i].time, hours, precip, temp: (temp0 + temp1) / 2 });
      coveredUntil = t + hours * 3600000;
    }
    return { blocks, now: ts[0]?.data.instant.details.air_temperature ?? null };
  }, { force });
}

/* -------------------------- data: Storm --------------------------- *
 * Storm.no er i dag TV 2 Vær, med prognoser fra StormGeo.
 * GraphQL-endepunktet tar et sted-ID som er base64("#" + geohash).
 */

const STORM_QUERY = `query($placeId: String!, $from: Date!, $to: Date!, $geoHash: Boolean = true) {
  forecastByPlaceId(placeId: $placeId, from: $from, to: $to, geoHash: $geoHash) {
    current { temperature symbol time }
    days {
      date
      dayForecast { minTemperature maxTemperature precipitation symbol }
      weatherOneHourSteps { startTime endTime precipitation temperature symbol }
      weatherThreeHourSteps { startTime endTime precipitation temperature symbol }
      weatherSixHourSteps { startTime endTime precipitation temperature symbol }
    }
  }
}`;

async function fetchStorm(loc, force) {
  return cached(`storm.${loc.id}`, async () => {
    const placeId = btoa("#" + geohash(loc.lat, loc.lon));
    const days = nextDays(16);
    const body = {
      query: STORM_QUERY,
      variables: { placeId, from: days[0].key, to: days[days.length - 1].key },
    };
    const data = await fetchJson("https://www.tv2.no/vaer/backend-api", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const fc = data?.data?.forecastByPlaceId;
    if (!fc) throw new Error("Tomt svar fra Storm");
    const blocks = [];
    for (const day of fc.days || []) {
      const steps =
        (day.weatherOneHourSteps?.length >= 20 && day.weatherOneHourSteps) ||
        (day.weatherThreeHourSteps?.length && day.weatherThreeHourSteps) ||
        (day.weatherSixHourSteps?.length && day.weatherSixHourSteps) ||
        null;
      if (steps) {
        for (const s of steps) {
          const hours = (Date.parse(s.endTime) - Date.parse(s.startTime)) / 3600000;
          if (!(hours > 0) || s.temperature == null) continue;
          blocks.push({ start: s.startTime, hours, precip: s.precipitation ?? 0, temp: s.temperature });
        }
      } else if (day.dayForecast) {
        const df = day.dayForecast;
        blocks.push({
          start: `${day.date}T00:00:00+01:00`,
          hours: 24,
          precip: df.precipitation ?? 0,
          temp: (df.minTemperature + df.maxTemperature) / 2,
          tmin: df.minTemperature,
          tmax: df.maxTemperature,
        });
      }
    }
    // Dagene kan overlappe (timesteg for én dag går inn i neste) – behold første dekning
    blocks.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    const unique = [];
    let coveredUntil = 0;
    for (const b of blocks) {
      const t = Date.parse(b.start);
      if (t < coveredUntil) continue;
      unique.push(b);
      coveredUntil = t + b.hours * 3600000;
    }
    return { blocks: unique, now: fc.current?.temperature ?? null };
  }, { force });
}

/* ------------------------- data: Sporet --------------------------- */

async function fetchSporet(loc, force) {
  return cached(`sporet2.${loc.id}`, async () => {
    const [x, y] = loc.utm;
    const r = loc.sporetRadius;
    const url = `https://api.sporet.no/loypeapi/publicfree/skiroutes/detailsbybbox?xMin=${x - r}&yMin=${y - r}&xMax=${x + r}&yMax=${y + r}`;
    const routes = await fetchJson(url);
    // Ved sesongstart nullstiller Sporet tidspunktene, så løyper uten preparering beholdes (sist i listen)
    return routes
      .map((rt) => ({ id: rt.id, name: rt.name, prepped: rt.preppedTime || null }))
      .sort((a, b) => (b.prepped ? Date.parse(b.prepped) : 0) - (a.prepped ? Date.parse(a.prepped) : 0));
  }, { force });
}

/* ------------------------ data: webkamera -------------------------- *
 * Sporet har webkameraer som egne kartpunkter (POI-type CAM). Ett kall gir alle
 * i Norge, og bildeadressene hentes for kameraene innenfor 20 km av et sted.
 */

const WEBCAM_RADIUS_KM = 20;

function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function stripHtml(html) {
  return String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchWebcams(force) {
  // Kameralisten endrer seg sjelden, så den mellomlagres et døgn
  return cached(`webcams.${LOCATIONS.map((l) => l.id).join(",")}`, async () => {
    const url =
      "https://ags.sporet.no/arcgis/rest/services/Sporet_simple/MapServer/2/query" +
      "?where=poitypeid%3D%27CAM%27&outFields=id,name&outSR=4326&f=json";
    const data = await fetchJson(url);
    const pois = (data.features || [])
      .map((f) => ({ id: f.attributes.id, name: f.attributes.name, lat: f.geometry.y, lon: f.geometry.x }))
      .filter((p) => LOCATIONS.some((l) => distanceKm(l.lat, l.lon, p.lat, p.lon) <= WEBCAM_RADIUS_KM));
    const results = await Promise.allSettled(
      pois.map((p) => fetchJson(`https://api.sporet.no/loypeapi/publicfree/pois/${p.id}/webcams`))
    );
    return pois
      .map((p, i) => ({
        ...p,
        cams: (results[i].status === "fulfilled" ? results[i].value : [])
          // Bare https (siden kjører på https) og ikke lagrede kopier fra søkemotorer
          .filter((c) => /^https:\/\//i.test(c.url || "") && !/bing\.com|google\./i.test(c.url))
          .map((c) => ({ url: c.url, text: stripHtml(c.description) })),
      }))
      .filter((p) => p.cams.length);
  }, { force, minutes: 24 * 60 });
}

function webcamsNear(loc) {
  return (state.webcams || [])
    .map((p) => ({ ...p, km: distanceKm(loc.lat, loc.lon, p.lat, p.lon) }))
    .filter((p) => p.km <= WEBCAM_RADIUS_KM)
    .sort((a, b) => a.km - b.km);
}

/* ------------------------- data: Netatmo -------------------------- */

async function fetchNetatmo(loc, token) {
  const d = 0.06;
  const params = new URLSearchParams({
    lat_ne: (loc.lat + d).toFixed(4),
    lon_ne: (loc.lon + d * 2).toFixed(4),
    lat_sw: (loc.lat - d).toFixed(4),
    lon_sw: (loc.lon - d * 2).toFixed(4),
    filter: "true",
  });
  const data = await fetchJson(`https://api.netatmo.com/api/getpublicdata?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const temps = [];
  const rain24 = [];
  for (const st of data.body || []) {
    for (const m of Object.values(st.measures || {})) {
      if (m.type && m.res) {
        const ti = m.type.indexOf("temperature");
        if (ti > -1) {
          const latest = Object.entries(m.res).sort((a, b) => b[0] - a[0])[0];
          if (latest && typeof latest[1][ti] === "number") temps.push(latest[1][ti]);
        }
      }
      if (typeof m.rain_24h === "number") rain24.push(m.rain_24h);
    }
  }
  return {
    stations: (data.body || []).length,
    temp: median(temps),
    tmin: temps.length ? Math.min(...temps) : null,
    tmax: temps.length ? Math.max(...temps) : null,
    rain24: rain24.length ? median(rain24) : null,
  };
}

/* ------------------------ snømodell ------------------------------- */

function snowFraction(t) {
  if (t <= 0) return 1;
  if (t >= 2) return 0;
  return 1 - t / 2;
}

function blocksByDay(blocks) {
  const map = {};
  for (const b of blocks) {
    // Blokken havner på den lokale datoen midt i blokken
    const mid = new Date(Date.parse(b.start) + (b.hours * 3600000) / 2);
    (map[dateKey(mid)] ||= []).push(b);
  }
  return map;
}

function daySummary(blocks) {
  if (!blocks?.length) return null;
  let precip = 0;
  let snow = 0;
  let hours = 0;
  let tsum = 0;
  let tmin = Infinity;
  let tmax = -Infinity;
  for (const b of blocks) {
    precip += b.precip;
    snow += b.precip * snowFraction(b.temp);
    hours += b.hours;
    tsum += b.temp * b.hours;
    tmin = Math.min(tmin, b.tmin ?? b.temp);
    tmax = Math.max(tmax, b.tmax ?? b.temp);
  }
  return { precip, snow, tmean: tsum / hours, tmin, tmax };
}

/**
 * Kjører snømodellen gjennom dagene for én variant.
 * dayBlocks: array (per dag) av blokker; offset: temperaturavvik per dag; pscale: nedbørsskalering.
 */
function simulate(dayBlocks, startDepth, offsets, pscale) {
  let depth = startDepth;
  const depths = [];
  const newSnow = [];
  dayBlocks.forEach((blocks, i) => {
    const off = offsets[i];
    let fresh = 0;
    let rain = 0;
    let degreeDays = 0;
    for (const b of blocks || []) {
      const t = b.temp + off;
      const p = b.precip * pscale;
      const f = snowFraction(t);
      fresh += p * f;
      rain += p * (1 - f);
      // Ved døgnsnitt (Storm langt frem) bruk halve spennet for å fange dagsmelting
      const tWarm = b.hours >= 24 && b.tmax != null ? (b.temp + b.tmax) / 2 + off : t;
      degreeDays += (Math.max(0, tWarm) * b.hours) / 24;
    }
    const melt = degreeDays * 1.2 + (depth > 0 ? rain * 0.15 : 0);
    depth = Math.max(0, depth * 0.97 + fresh - melt);
    depths.push(depth);
    newSnow.push(fresh);
  });
  return { depths, newSnow };
}

const TEMP_STEPS = [-2, -1, 0, 1, 2];
const PRECIP_SCALES = [0.6, 1, 1.4];

// Snøvill-indeks: Snøvill blir glad bare det er nok snø til å tråkke spor selv,
// men oppkjørte spor gjør dagen perfekt.
const INDEX_WEIGHTS = { self: 0.75, groom: 0.25 };

function snovillIndex(probSelf, probGroom) {
  return Math.round(INDEX_WEIGHTS.self * probSelf + INDEX_WEIGHTS.groom * probGroom);
}

/** thresholds: { groom: cm for oppkjørte spor, self: cm for å tråkke spor selv } */
function runEnsemble(sourceDays, days, startDepth, thresholds) {
  const sourceIds = Object.keys(sourceDays).filter((s) => sourceDays[s]);
  if (!sourceIds.length) return null;

  // Bygg per-kilde lister over blokker per dag, med fallback til den andre kilden
  const perSource = sourceIds.map((sid) =>
    days.map((d) => {
      const own = sourceDays[sid][d.key];
      if (own?.length) return own;
      for (const other of sourceIds) if (sourceDays[other][d.key]?.length) return sourceDays[other][d.key];
      return [];
    })
  );

  const scenarios = [];
  perSource.forEach((dayBlocks, si) => {
    for (const k of TEMP_STEPS) {
      const offsets = days.map((_, i) => k * (0.4 + 0.2 * i));
      for (const ps of PRECIP_SCALES) {
        scenarios.push({ source: sourceIds[si], k, ps, ...simulate(dayBlocks, startDepth, offsets, ps) });
      }
    }
  });

  const zero = days.map((_, i) => 0 * i);
  const central = perSource.map((dayBlocks) => simulate(dayBlocks, startDepth, zero, 1));

  return days.map((d, i) => {
    const depths = scenarios.map((s) => s.depths[i]);
    const share = (cm) => Math.round((depths.filter((v) => v >= cm).length / scenarios.length) * 100);
    const probGroom = share(thresholds.groom);
    const probSelf = share(thresholds.self);
    const fresh = scenarios.filter((s) => s.newSnow[i] >= 1).length;
    const summaries = {};
    sourceIds.forEach((sid) => {
      summaries[sid] = daySummary(sourceDays[sid][d.key]);
    });
    const sums = Object.values(summaries).filter(Boolean);
    const avg = (f) => (sums.length ? sums.reduce((a, s) => a + s[f], 0) / sums.length : null);
    return {
      key: d.key,
      date: d.date,
      prob: snovillIndex(probSelf, probGroom),
      probGroom,
      probSelf,
      probNewSnow: Math.round((fresh / scenarios.length) * 100),
      depth: median(central.map((c) => c.depths[i])),
      depthLo: quantile(depths, 0.1),
      depthHi: quantile(depths, 0.9),
      newSnow: median(central.map((c) => c.newSnow[i])),
      perSource: summaries,
      tmin: avg("tmin"),
      tmax: avg("tmax"),
      precip: avg("precip"),
    };
  });
}

function autoBaseDepth(routes) {
  if (!routes?.length) return { depth: 0, why: "ingen prepareringsdata" };
  if (!routes[0].prepped) return { depth: 0, why: "ikke kjørt ennå denne sesongen" };
  const newest = Date.parse(routes[0].prepped);
  const days = (Date.now() - newest) / 86400000;
  if (days <= 2) return { depth: 35, why: "løyper kjørt siste døgn" };
  if (days <= 7) return { depth: 25, why: "løyper kjørt siste uke" };
  if (days <= 21) return { depth: 10, why: "løyper kjørt siste tre uker" };
  return { depth: 0, why: "barmark siden sist preparering" };
}

/* ------------------------- moro-tekster --------------------------- */

const LEVELS = [
  { min: 80, face: "🤩", label: "Fullt Snøvill!", cls: "lvl-5" },
  { min: 55, face: "😎", label: "Lovende", cls: "lvl-4" },
  { min: 30, face: "🤔", label: "Kanskje …", cls: "lvl-3" },
  { min: 10, face: "🙄", label: "Drøm videre", cls: "lvl-2" },
  { min: 0, face: "🏃", label: "Joggesko", cls: "lvl-1" },
];

function level(p) {
  return LEVELS.find((l) => p >= l.min);
}

const QUIPS = {
  "lvl-5": [
    "Ring sjefen. Nå.",
    "Smør skiene, dette er ikke en øvelse!",
    "Sporene ligger og venter på deg, Snøvill.",
    "Kakao på termosen og appelsin i lomma!",
  ],
  "lvl-4": [
    "Dette lukter blåswix.",
    "Begynner å bli spennende – hold øye med varselet.",
    "Finn frem skiposen, men ikke pakk bilen ennå.",
  ],
  "lvl-3": [
    "Halvveis snøvill. Kan gå begge veier.",
    "Værgudene kaster mynt og kron.",
    "Myrene trenger litt mer pudder først.",
  ],
  "lvl-2": [
    "Rulleskiene kaller fortsatt.",
    "Mer høstløv enn nysnø her, dessverre.",
    "Du kan alltids danse snødans i stua.",
  ],
  "lvl-1": [
    "Joggeskoføre. Ta en tur i lyngen.",
    "Ikke en snøfnugg i sikte. Sukk.",
    "Perfekt vær for å vokse skiene … til senere.",
    "Elgen går fortsatt barbeint.",
  ],
};

const EXCUSES = [
  "Hei! Jeg har dessverre fått akutt Snøvill-syndrom. Eneste kjente kur er {km} km klassisk på {sted} {dag}. Er tilbake fullt restituert dagen etter.",
  "Hei sjef! Jeg skal på et viktig eksternt møte med {sted}-løypene {dag}. Agenda: glid, feste og vaffel.",
  "Beklager, jeg må jobbe hjemmefra {dag}. «Hjemme» er en hytte på {sted}, og «jobbe» betyr {km} km skøyting.",
  "Viktig beskjed: Værmodellene viser Snøvill-indeks {pct} på {sted} {dag}. Det er statistisk uforsvarlig å sitte inne.",
  "Hei! Jeg tar en avspaseringsdag {dag}. Grunn: Snøvill-indeks {pct} på {sted}. Håper du forstår. ❄️",
];

function waxTip(day) {
  if (day.depth < state.settings.selfThreshold || day.tmax == null) return { name: "Ingen snø", cls: "wax-none", short: "–" };
  if (day.tmax <= -10) return { name: "Grønn voks", cls: "wax-green", short: "Grønn" };
  if (day.tmax <= -3) return { name: "Blå voks", cls: "wax-blue", short: "Blå" };
  if (day.tmax <= 0) return { name: "Fiolett voks", cls: "wax-violet", short: "Fiolett" };
  if (day.newSnow >= 2 && day.tmax <= 2) return { name: "Rød voks", cls: "wax-red", short: "Rød" };
  return { name: "Klister (lykke til!)", cls: "wax-klister", short: "Klister" };
}

/* --------------------------- rendering ---------------------------- */

function renderSources() {
  const chips = [
    ["yr", "Yr"],
    ["storm", "Storm"],
    ["sporet", "Sporet"],
    ["netatmo", "Netatmo"],
  ].map(([id, label]) => {
    const s = state.sources[id] || { status: "loading" };
    const icon = { ok: "✓", error: "✗", loading: "…", missing: "🔑" }[s.status];
    const title = s.note ? ` title="${escapeHtml(s.note)}"` : "";
    return `<span class="chip chip-${s.status}"${title}><span class="chip-icon">${icon}</span>${label}</span>`;
  });
  $("sourceStatus").innerHTML = chips.join("");
}

function setSource(id, status, note) {
  state.sources[id] = { status, note };
  renderSources();
}

function renderResorts() {
  const html = LOCATIONS.map((loc, li) => {
    const r = state.results[loc.id];
    if (!r) return "";
    if (!r.days) {
      return `<article class="card resort"><h2>${loc.emoji} ${loc.name}</h2><p class="error">Fikk ikke værdata akkurat nå. Prøv «Oppdater» om litt.</p></article>`;
    }
    const best = r.days.reduce((a, b) => (b.prob > a.prob ? b : a), r.days[0]);
    const lvl = level(best.prob);
    const quip = seededPick(QUIPS[lvl.cls], loc.id + best.key + lvl.cls);

    const sporet = r.sporet;
    let sporetHtml = `<span class="muted">Ingen data</span>`;
    if (sporet?.length && !sporet[0].prepped) {
      sporetHtml = `<strong>Ikke kjørt ennå</strong><br><small>${sporet.length} løyper venter på sesongens første tur</small>`;
    } else if (sporet?.length) {
      const newest = new Date(sporet[0].prepped);
      const last24 = sporet.filter((s) => s.prepped && Date.now() - Date.parse(s.prepped) < 86400000).length;
      sporetHtml = `<strong>${timeAgo(newest)}</strong><br><small>${escapeHtml(sporet[0].name)}${last24 ? ` · ${last24} løyper kjørt siste døgn` : ""}</small>`;
    } else if (sporet && !sporet.length) {
      sporetHtml = `<span class="muted">Ingen løyper funnet</span>`;
    }

    let netatmoHtml = `<span class="muted">Legg inn token i ⚙️</span>`;
    if (r.netatmo?.error) netatmoHtml = `<span class="muted">${escapeHtml(r.netatmo.error)}</span>`;
    else if (r.netatmo && r.netatmo.temp != null) {
      netatmoHtml = `<strong>${fmt1(r.netatmo.temp)} °C</strong><br><small>${r.netatmo.stations} stasjoner · ${fmt1(r.netatmo.tmin)} til ${fmt1(r.netatmo.tmax)} °C${r.netatmo.rain24 != null ? ` · ${fmt1(r.netatmo.rain24)} mm siste døgn` : ""}</small>`;
    } else if (r.netatmo) netatmoHtml = `<span class="muted">Ingen stasjoner i nærheten</span>`;

    const nowHtml = `Yr <strong>${fmt1(r.yrNow)} °C</strong> · Storm <strong>${fmt1(r.stormNow)} °C</strong>`;

    const tiles = r.days
      .map((d, i) => {
        const l = level(d.prob);
        const wax = waxTip(d);
        const label = i === 0 ? "I dag" : i === 1 ? "I morgen" : cap(weekdayFmt.format(d.date).replace(".", ""));
        const yr = d.perSource.yr;
        const st = d.perSource.storm;
        const fight =
          yr && st
            ? `Yr ${fmt1(yr.snow)} cm vs Storm ${fmt1(st.snow)} cm nysnø`
            : yr
              ? `Yr ${fmt1(yr.snow)} cm nysnø`
              : st
                ? `Storm ${fmt1(st.snow)} cm nysnø`
                : "";
        const title = `${weekdayLongFmt.format(d.date)}: Snøvill-indeks ${d.prob}. Oppkjørte spor (≥ ${state.settings.threshold} cm): ${d.probGroom} %. Tråkke selv (≥ ${state.settings.selfThreshold} cm): ${d.probSelf} %. Beregnet snødybde ${fmt0(d.depth)} cm (${fmt0(d.depthLo)}–${fmt0(d.depthHi)}). ${fight}. Nedbør ${fmt1(d.precip)} mm. ${wax.name}.`;
        return `
          <li class="day ${l.cls}" title="${escapeHtml(title)}" tabindex="0">
            <span class="day-name">${escapeHtml(label)}</span>
            <span class="day-date">${dayMonthFmt.format(d.date)}</span>
            <span class="day-face" aria-hidden="true">${l.face}</span>
            <span class="day-prob">${d.prob}</span>
            <span class="bar"><span style="width:${d.prob}%"></span></span>
            <span class="day-split" aria-label="Oppkjørte spor ${d.probGroom} prosent, tråkke selv ${d.probSelf} prosent"><span title="Oppkjørte spor">🎿 ${d.probGroom}%</span><span title="Tråkke spor selv">👣 ${d.probSelf}%</span></span>
            <span class="day-snow">${d.newSnow >= 0.5 ? `❄️ ${fmt0(d.newSnow)} cm` : `<span class="muted">ingen nysnø</span>`}</span>
            <span class="day-temp">${fmt0(d.tmin)}° / ${fmt0(d.tmax)}°</span>
            <span class="wax ${wax.cls}">${wax.short}</span>
          </li>`;
      })
      .join("");

    return `
      <article class="card resort" style="--accent:${SERIES_COLORS[li]}">
        <header class="resort-head">
          <div>
            <h2>${loc.emoji} ${loc.name}</h2>
            <p class="resort-meta">${loc.altitude} moh · start ${fmt0(r.startDepth)} cm snø (${escapeHtml(r.startWhy)})</p>
          </div>
          <div class="resort-verdict ${lvl.cls}">
            <span class="verdict-face" aria-hidden="true">${lvl.face}</span>
            <span><strong>${lvl.label}</strong><br><small>${escapeHtml(quip)}</small></span>
          </div>
        </header>
        <div class="resort-stats">
          <div class="stat"><span class="stat-label">🚜 Sist preparert (Sporet)</span><span class="stat-value">${sporetHtml}</span></div>
          <div class="stat"><span class="stat-label">🌡️ Hyttenaboene (Netatmo)</span><span class="stat-value">${netatmoHtml}</span></div>
          <div class="stat"><span class="stat-label">📡 Akkurat nå</span><span class="stat-value">${nowHtml}</span></div>
        </div>
        <ol class="days">${tiles}</ol>
        ${renderWebcams(loc)}
        ${renderSporetList(sporet)}
      </article>`;
  }).join("");
  $("resorts").innerHTML = html;
}

function camUrl(url) {
  // Tidsstempel så nettleseren henter nytt bilde ved oppdatering
  return `${url}${url.includes("?") ? "&" : "?"}snovill=${state.camBust}`;
}

function camTile(p, c, big) {
  const title = c.text && c.text !== p.name ? c.text : "";
  return `
    <figure class="cam${big ? " cam-big" : ""}">
      <a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">
        <img src="${escapeHtml(camUrl(c.url))}" alt="Webkamera ${escapeHtml(p.name)}" loading="lazy"
          referrerpolicy="no-referrer" onerror="this.closest('.cam').classList.add('cam-broken')">
        <span class="cam-error">📷 Bildet er ikke tilgjengelig nå</span>
      </a>
      <figcaption><strong>${escapeHtml(p.name)}</strong> · ${fmt1(p.km)} km${title ? `<br><small>${escapeHtml(title)}</small>` : ""}</figcaption>
    </figure>`;
}

function renderWebcams(loc) {
  if (!state.webcams) return "";
  const near = webcamsNear(loc);
  const all = near.flatMap((p) => p.cams.map((c) => ({ p, c })));
  if (!all.length) {
    return `<p class="webcams-empty muted">📷 Ingen fungerende webkamera i Sporet innenfor ${WEBCAM_RADIUS_KM} km.</p>`;
  }
  const [first, ...rest] = all;
  return `
    <section class="webcams" aria-label="Webkamera ved ${escapeHtml(loc.name)}">
      <h3>📷 Webkamera <small class="muted">${all.length} innenfor ${WEBCAM_RADIUS_KM} km</small></h3>
      ${camTile(first.p, first.c, true)}
      ${rest.length ? `<details class="webcam-more"><summary>Vis ${rest.length} kamera${rest.length === 1 ? "" : "er"} til</summary><div class="cam-grid">${rest.map((x) => camTile(x.p, x.c, false)).join("")}</div></details>` : ""}
    </section>`;
}

function renderSporetList(routes) {
  if (!routes?.length) return "";
  const items = routes
    .slice(0, 6)
    .map((r) => `<li><span>${escapeHtml(r.name)}</span><span class="muted">${r.prepped ? timeAgo(new Date(r.prepped)) : "ikke kjørt i år"}</span></li>`)
    .join("");
  return `<details class="sporet-list"><summary>Løyper i nærheten (${routes.length})</summary><ul>${items}</ul></details>`;
}

function renderHero() {
  let bestProb = 0;
  let best = null;
  for (const loc of LOCATIONS) {
    const r = state.results[loc.id];
    if (!r?.days) continue;
    for (const d of r.days) {
      if (d.prob > bestProb) {
        bestProb = d.prob;
        best = { loc, day: d };
      }
    }
  }
  const lvl = level(bestProb);
  $("heroIndex").textContent = bestProb;
  $("heroMeter").style.setProperty("--pct", bestProb);
  $("heroMeter").setAttribute("aria-label", `Snøvill-indeks ${bestProb} av 100`);
  $("mascot").textContent = bestProb >= 80 ? "⛷️" : bestProb >= 55 ? "⛄" : bestProb >= 30 ? "🌨️" : bestProb >= 10 ? "🍂" : "🏃";
  $("tagline").textContent = best
    ? `Hei, Snøvill! ${lvl.label} – beste dag er ${best.loc.name} ${dayPhrase(best.day)} (Snøvill-indeks ${bestProb}).`
    : "Hei, Snøvill! Ingen skiføre i sikte de neste 10 dagene. Rulleskisesongen forlenges. 🛼";
  setSnowIntensity(bestProb);

  const card = $("bestDay");
  if (!best || bestProb < 10) {
    card.hidden = false;
    card.innerHTML = `<div class="best-body"><span class="best-emoji">🍂</span><div><h2>Ingen skidag i sikte ennå</h2><p>Modellene er enige om at det er for varmt eller for tørt. Smør rulleskiene og sjekk igjen i morgen!</p></div></div>`;
    return;
  }
  card.hidden = false;
  card.innerHTML = `
    <div class="best-body">
      <span class="best-emoji">${lvl.face}</span>
      <div>
        <h2>Beste skidag: ${escapeHtml(best.loc.name)} ${escapeHtml(dayPhrase(best.day))}</h2>
        <p>Snøvill-indeks ${bestProb} · 🎿 oppkjørte spor ${best.day.probGroom} % · 👣 tråkke selv ${best.day.probSelf} % · ca. ${fmt0(best.day.depth)} cm snø · ${fmt0(best.day.tmin)}° til ${fmt0(best.day.tmax)}° · ${escapeHtml(waxTip(best.day).name)}</p>
      </div>
      <button class="btn btn-accent" id="excuseBtn" type="button">📞 Ta fri-generator</button>
    </div>
    <div class="excuse" id="excuseBox" hidden>
      <p id="excuseText"></p>
      <button class="btn btn-ghost" id="copyExcuse" type="button">📋 Kopier</button>
      <button class="btn btn-ghost" id="newExcuse" type="button">🎲 Ny unnskyldning</button>
    </div>`;
  const makeExcuse = () => {
    const tpl = EXCUSES[Math.floor(Math.random() * EXCUSES.length)];
    $("excuseText").textContent = tpl
      .replace("{sted}", best.loc.name)
      .replace("{dag}", dayPhrase(best.day))
      .replace("{pct}", bestProb)
      .replace("{km}", 15 + Math.floor(Math.random() * 6) * 5);
    $("excuseBox").hidden = false;
  };
  $("excuseBtn").onclick = makeExcuse;
  $("newExcuse").onclick = makeExcuse;
  $("copyExcuse").onclick = async () => {
    try {
      await navigator.clipboard.writeText($("excuseText").textContent);
      $("copyExcuse").textContent = "✅ Kopiert!";
    } catch {
      $("copyExcuse").textContent = "Marker og kopier selv 🙃";
    }
    setTimeout(() => ($("copyExcuse").textContent = "📋 Kopier"), 2000);
  };
}

function dayPhrase(day) {
  const today = dateKey(new Date());
  const tomorrow = dateKey(new Date(Date.now() + 86400000));
  if (day.key === today) return "i dag";
  if (day.key === tomorrow) return "i morgen";
  return weekdayLongFmt.format(day.date);
}

/* ----------------------------- chart ------------------------------ */

function renderChart() {
  const svg = $("depthChart");
  const wrap = $("chartWrap");
  const series = LOCATIONS.map((loc, i) => ({ loc, color: SERIES_COLORS[i], days: state.results[loc.id]?.days })).filter((s) => s.days);
  if (!series.length) {
    svg.innerHTML = "";
    return;
  }
  const W = Math.max(320, wrap.clientWidth);
  const H = 260;
  const m = { t: 16, r: 16, b: 34, l: 46 };
  const threshold = state.settings.threshold;
  const n = series[0].days.length;
  const maxV = Math.max(threshold + 10, ...series.flatMap((s) => s.days.map((d) => d.depth)));
  const step = maxV > 80 ? 20 : 10;
  const yMax = Math.ceil(maxV / step) * step;
  const x = (i) => m.l + (i * (W - m.l - m.r)) / Math.max(1, n - 1);
  const y = (v) => m.t + (1 - v / yMax) * (H - m.t - m.b);

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);

  let out = "";
  const ticks = yMax / step;
  for (let k = 0; k <= ticks; k++) {
    const v = step * k;
    out += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`;
    out += `<text class="axis" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${fmt0(v)}${k === ticks ? " cm" : ""}</text>`;
  }
  const selfT = state.settings.selfThreshold;
  out += `<line class="threshold" x1="${m.l}" x2="${W - m.r}" y1="${y(threshold)}" y2="${y(threshold)}"/>`;
  out += `<text class="threshold-label" x="${W - m.r}" y="${y(threshold) - 6}" text-anchor="end">🎿 Oppkjørte spor ${threshold} cm</text>`;
  out += `<line class="threshold-self" x1="${m.l}" x2="${W - m.r}" y1="${y(selfT)}" y2="${y(selfT)}"/>`;
  out += `<text class="threshold-label" x="${m.l + 6}" y="${y(selfT) - 6}" text-anchor="start">👣 Tråkke selv ${selfT} cm</text>`;
  series[0].days.forEach((d, i) => {
    const label = i === 0 ? "I dag" : cap(weekdayFmt.format(d.date).replace(".", ""));
    out += `<text class="axis axis-x" x="${x(i)}" y="${H - 12}" text-anchor="middle">${escapeHtml(label)}</text>`;
  });

  for (const s of series) {
    const pts = s.days.map((d, i) => `${x(i).toFixed(1)},${y(d.depth).toFixed(1)}`).join(" ");
    out += `<polyline class="line" style="stroke:${s.color}" points="${pts}"/>`;
  }
  out += `<line class="crosshair" id="crosshair" y1="${m.t}" y2="${H - m.b}" x1="0" x2="0" visibility="hidden"/>`;
  for (const s of series) {
    s.days.forEach((d, i) => {
      out += `<circle class="dot" data-i="${i}" cx="${x(i)}" cy="${y(d.depth)}" r="4" style="fill:${s.color}" visibility="hidden"/>`;
    });
  }
  out += `<rect class="hit" x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent"/>`;
  svg.innerHTML = out;

  $("chartLegend").innerHTML = series
    .map((s) => `<span class="legend-item"><span class="swatch" style="background:${s.color}"></span>${s.loc.name}</span>`)
    .join("");

  const tip = $("chartTip");
  const hit = svg.querySelector(".hit");
  const cross = svg.querySelector("#crosshair");
  const show = (evt) => {
    const rect = svg.getBoundingClientRect();
    const px = ((evt.clientX - rect.left) / rect.width) * W;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / (W - m.l - m.r)) * (n - 1))));
    cross.setAttribute("x1", x(i));
    cross.setAttribute("x2", x(i));
    cross.setAttribute("visibility", "visible");
    svg.querySelectorAll(".dot").forEach((c) => c.setAttribute("visibility", +c.dataset.i === i ? "visible" : "hidden"));
    const rows = series
      .map(
        (s) =>
          `<div class="tip-row"><span class="swatch" style="background:${s.color}"></span>${s.loc.name}<strong>${fmt0(s.days[i].depth)} cm</strong><span class="muted">indeks ${s.days[i].prob}</span></div>`
      )
      .join("");
    tip.innerHTML = `<div class="tip-title">${escapeHtml(cap(weekdayLongFmt.format(series[0].days[i].date)))}</div>${rows}`;
    tip.hidden = false;
    const left = (x(i) / W) * rect.width;
    tip.style.left = `${Math.min(rect.width - tip.offsetWidth - 4, Math.max(4, left + 12))}px`;
    tip.style.top = `8px`;
  };
  hit.addEventListener("pointermove", show);
  hit.addEventListener("pointerdown", show);
  hit.addEventListener("pointerleave", () => {
    tip.hidden = true;
    cross.setAttribute("visibility", "hidden");
    svg.querySelectorAll(".dot").forEach((c) => c.setAttribute("visibility", "hidden"));
  });

  // Tabellvisning
  const head = series[0].days.map((d) => `<th>${escapeHtml(dayMonthFmt.format(d.date))}</th>`).join("");
  const body = series
    .map(
      (s) =>
        `<tr><th scope="row">${s.loc.name}</th>${s.days.map((d) => `<td>${fmt0(d.depth)} cm<br><small>indeks ${d.prob}</small></td>`).join("")}</tr>`
    )
    .join("");
  $("depthTable").innerHTML = `<div class="table-scroll"><table><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/* ---------------------------- settings ---------------------------- */

function renderSettings() {
  $("thresholdInput").value = state.settings.threshold;
  $("thresholdOut").textContent = `${state.settings.threshold} cm`;
  $("selfThresholdInput").value = state.settings.selfThreshold;
  $("selfThresholdOut").textContent = `${state.settings.selfThreshold} cm`;
  $("netatmoToken").value = state.settings.netatmoToken || "";
  $("baseDepthInputs").innerHTML = LOCATIONS.map((loc) => {
    const v = state.settings.baseDepth[loc.id];
    return `<label class="base-row"><span>${loc.name}</span>
      <input type="number" min="0" max="300" step="5" inputmode="numeric" data-loc="${loc.id}" placeholder="Auto" value="${v ?? ""}"> cm</label>`;
  }).join("");
}

function thresholds() {
  return { groom: state.settings.threshold, self: state.settings.selfThreshold };
}

function readSettings() {
  state.settings.threshold = Number($("thresholdInput").value) || 25;
  state.settings.selfThreshold = Number($("selfThresholdInput").value) || 2;
  state.settings.netatmoToken = $("netatmoToken").value.trim();
  const bd = {};
  document.querySelectorAll("#baseDepthInputs input").forEach((inp) => {
    if (inp.value !== "") bd[inp.dataset.loc] = Math.max(0, Number(inp.value));
  });
  state.settings.baseDepth = bd;
  saveSettings();
}

/* ---------------------------- snøfall ----------------------------- */

let snowTarget = 40;
function setSnowIntensity(pct) {
  snowTarget = 25 + Math.round(pct * 2.2);
}

function startSnow() {
  const canvas = $("snowCanvas");
  const ctx = canvas.getContext("2d");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const flakes = [];
  const resize = () => {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
  };
  resize();
  window.addEventListener("resize", resize);
  const spawn = (top) => ({
    x: Math.random() * canvas.width,
    y: top ? -10 : Math.random() * canvas.height,
    r: (1 + Math.random() * 2.6) * devicePixelRatio,
    vy: (0.4 + Math.random() * 1.1) * devicePixelRatio,
    drift: Math.random() * Math.PI * 2,
  });
  const tick = () => {
    while (flakes.length < snowTarget) flakes.push(spawn(flakes.length > 20));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--flake").trim() || "#fff";
    for (let i = flakes.length - 1; i >= 0; i--) {
      const f = flakes[i];
      f.y += f.vy;
      f.drift += 0.01;
      f.x += Math.sin(f.drift) * 0.4 * devicePixelRatio;
      if (f.y > canvas.height + 10) {
        if (flakes.length > snowTarget) flakes.splice(i, 1);
        else flakes[i] = spawn(true);
        continue;
      }
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(tick);
  };
  tick();
}

/* -------------------------- løypevarsler -------------------------- */

const WATCH_INTERVAL_MS = 5 * 60000;
const watch = { timer: null, swReg: null, config: null, busy: false };

function watchSupported() {
  return "Notification" in window && "indexedDB" in window;
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    watch.swReg = await navigator.serviceWorker.register("sw.js");
    await navigator.serviceWorker.ready;
  } catch (err) {
    console.warn("Service worker ble ikke registrert:", err);
    watch.swReg = null;
  }
  return watch.swReg;
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("Nettleseren støtter ikke posisjon"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (err) => reject(new Error(err.code === 1 ? "Du må gi tilgang til posisjon" : "Fant ikke posisjonen din")),
      { enableHighAccuracy: false, maximumAge: 10 * 60000, timeout: 20000 }
    );
  });
}

async function resolvePlace(cfg) {
  if (cfg.place !== "me") {
    const loc = LOCATIONS.find((l) => l.id === cfg.place);
    return { lat: loc.lat, lon: loc.lon, placeLabel: `ved ${loc.name}` };
  }
  try {
    const pos = await getPosition();
    return { ...pos, placeLabel: "i nærheten av deg" };
  } catch (err) {
    // Bruk siste kjente posisjon hvis vi har en
    if (cfg.lat != null) return { lat: cfg.lat, lon: cfg.lon, placeLabel: "i nærheten av deg", stale: true };
    throw err;
  }
}

async function notify(title, body) {
  const opts = { body, icon: "icon-192.png", badge: "icon-192.png", tag: "sporet-prep", renotify: true };
  const reg = watch.swReg || (await navigator.serviceWorker?.getRegistration?.());
  if (reg?.showNotification) return reg.showNotification(title, opts);
  // Fallback for nettlesere uten service worker
  return new Notification(title, opts);
}

async function watchCheck() {
  if (!watch.config?.enabled || watch.busy) return;
  watch.busy = true;
  try {
    const where = await resolvePlace(watch.config);
    watch.config = { ...watch.config, lat: where.lat, lon: where.lon, placeLabel: where.placeLabel };
    await SporetWatch.kvSet("config", watch.config);
    const prev = await SporetWatch.kvGet("active");
    const result = await SporetWatch.detectStarts(prev || null, [
      { lat: where.lat, lon: where.lon, radiusKm: watch.config.radiusKm },
    ]);
    await SporetWatch.kvSet("active", result.activeNow);
    const { near, started } = result.perArea[0];
    if (started.length && Notification.permission === "granted") {
      const n = SporetWatch.startMessage(started, where.placeLabel);
      await notify(n.title, n.body);
    }
    renderWatch({ near, started, baseline: result.baseline, stale: where.stale });
  } catch (err) {
    renderWatch({ error: err.message || String(err) });
  } finally {
    watch.busy = false;
  }
}

function startWatchTimer() {
  clearInterval(watch.timer);
  watch.timer = setInterval(watchCheck, WATCH_INTERVAL_MS);
}

async function registerPeriodicSync() {
  try {
    const reg = watch.swReg;
    if (!reg || !("periodicSync" in reg)) return false;
    const status = await navigator.permissions.query({ name: "periodic-background-sync" });
    if (status.state !== "granted") return false;
    await reg.periodicSync.register("sporet-check", { minInterval: 15 * 60000 });
    return true;
  } catch {
    return false;
  }
}

async function enableWatch() {
  if (!watchSupported()) {
    renderWatch({ error: "Denne nettleseren støtter ikke varsler. Prøv Chrome, Edge, Firefox eller Safari (installert på Hjem-skjerm)." });
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    renderWatch({ error: "Varsler er blokkert. Tillat varsler for denne siden i nettleserinnstillingene." });
    return;
  }
  watch.config = {
    ...(watch.config || {}),
    enabled: true,
    place: $("watchPlace").value,
    radiusKm: Number($("watchRadius").value),
  };
  await SporetWatch.kvSet("config", watch.config);
  await registerServiceWorker();
  watch.config.background = await registerPeriodicSync();
  await SporetWatch.kvSet("config", watch.config);
  startWatchTimer();
  await watchCheck();
}

async function disableWatch() {
  clearInterval(watch.timer);
  watch.config = { ...(watch.config || {}), enabled: false };
  await SporetWatch.kvSet("config", watch.config);
  try {
    await watch.swReg?.periodicSync?.unregister("sporet-check");
  } catch {
    /* ikke støttet */
  }
  renderWatch({});
}

function renderWatch({ near, started, baseline, error, stale } = {}) {
  const on = !!watch.config?.enabled;
  const btn = $("watchToggle");
  btn.textContent = on ? "🔕 Slå av varsler" : "🔔 Slå på varsler";
  btn.setAttribute("aria-pressed", String(on));
  $("watch").classList.toggle("watch-on", on);
  if (watch.config?.place) $("watchPlace").value = watch.config.place;
  if (watch.config?.radiusKm) $("watchRadius").value = String(watch.config.radiusKm);

  const status = $("watchStatus");
  const list = $("watchList");
  if (error) {
    status.innerHTML = `<span class="error">⚠️ ${escapeHtml(error)}</span>`;
    return;
  }
  if (!on) {
    status.textContent = "Varsler er av.";
    list.innerHTML = "";
    return;
  }
  if (!near) {
    status.textContent = "Sjekker Sporet …";
    return;
  }
  const r = watch.config.radiusKm;
  const bg = watch.config.background ? " · sjekker også i bakgrunnen" : "";
  const time = new Date().toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
  const running = near.filter((d) => d.prep === SporetWatch.ACTIVE).length;
  let msg = `✅ Følger med på ${near.length} skiområder i Sporet innenfor ${r} km ${escapeHtml(watch.config.placeLabel || "")}. Sist sjekket ${time}${bg}.`;
  if (stale) msg += " (bruker sist kjente posisjon)";
  if (baseline) msg += " Du får varsel neste gang en løypemaskin starter.";
  if (running) msg = `🟢 Det kjøres spor ${running} ${running === 1 ? "sted" : "steder"} nå! ` + msg;
  if (started?.length) msg = `🚜 Maskinen har startet: ${escapeHtml(started.map((d) => d.name).join(", "))}! ` + msg;
  status.innerHTML = msg;

  const startedIds = new Set((started || []).map((d) => d.id));
  list.innerHTML = near
    .slice(0, 12)
    .map((d) => {
      const on = d.prep === SporetWatch.ACTIVE;
      const label = SporetWatch.PREP_LABELS[d.prep] || "Ukjent status";
      return `<li class="${on ? "is-new" : ""}"><span>${on ? "🟢 " : ""}${startedIds.has(d.id) ? "🚜 " : ""}${escapeHtml(d.name)} <small class="muted">${fmt1(d.km)} km</small></span><span class="muted">${escapeHtml(label)}</span></li>`;
    })
    .join("");
  if (near.length > 12) list.innerHTML += `<li><span class="muted">+ ${near.length - 12} områder til lenger unna</span></li>`;
  if (!near.length) list.innerHTML = `<li><span class="muted">Ingen skiområder i Sporet innenfor ${r} km. Prøv større radius.</span></li>`;
}

async function initWatch() {
  if (!watchSupported()) {
    $("watchToggle").disabled = true;
    renderWatch({ error: "Denne nettleseren støtter ikke varsler." });
    return;
  }
  try {
    watch.config = (await SporetWatch.kvGet("config")) || null;
    if (watch.config && RENAMED_LOCATIONS[watch.config.place]) {
      watch.config.place = RENAMED_LOCATIONS[watch.config.place];
      await SporetWatch.kvSet("config", watch.config);
    }
  } catch {
    watch.config = null;
  }
  renderWatch({});

  $("watchToggle").addEventListener("click", () => (watch.config?.enabled ? disableWatch() : enableWatch()));
  const onChange = async () => {
    if (!watch.config?.enabled) return;
    watch.config.place = $("watchPlace").value;
    watch.config.radiusKm = Number($("watchRadius").value);
    await SporetWatch.kvSet("config", watch.config);
    renderWatch({});
    watchCheck();
  };
  $("watchPlace").addEventListener("change", onChange);
  $("watchRadius").addEventListener("change", onChange);
  $("watchTest").addEventListener("click", async () => {
    if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") {
      renderWatch({ error: "Varsler er blokkert for denne siden." });
      return;
    }
    if (!watch.swReg) await registerServiceWorker();
    const n = SporetWatch.startMessage(
      [{ name: "Sjusjøen", routes: [{ name: "Sjusjøvannet rundt", prepped: new Date(Date.now() - 7 * 60000).toISOString() }] }],
      "ved Sjusjøen"
    );
    await notify(n.title + " (test)", n.body);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") watchCheck();
  });

  if (watch.config?.enabled && Notification.permission === "granted") {
    await registerServiceWorker();
    startWatchTimer();
    watchCheck();
  } else if (watch.config?.enabled) {
    watch.config.enabled = false;
    renderWatch({});
  }
}

/* ------------------------------ main ------------------------------ */

async function loadAll(force = false) {
  state.days = nextDays(DAYS);
  ["yr", "storm", "sporet"].forEach((s) => setSource(s, "loading"));
  setSource("netatmo", state.settings.netatmoToken ? "loading" : "missing", "Legg inn Netatmo-token under Innstillinger");
  $("refreshBtn").disabled = true;

  const counts = { yr: 0, storm: 0, sporet: 0, netatmo: 0 };
  const errors = { yr: [], storm: [], sporet: [], netatmo: [] };

  state.camBust = Math.floor(Date.now() / 60000);
  const webcamsPromise = fetchWebcams(force)
    .then((w) => (state.webcams = w))
    .catch((err) => {
      console.warn("Webkamera ble ikke hentet:", err);
      state.webcams = state.webcams || [];
    });

  await Promise.all(
    LOCATIONS.map(async (loc) => {
      const [yr, storm, sporet, netatmo] = await Promise.allSettled([
        fetchYr(loc, force),
        fetchStorm(loc, force),
        fetchSporet(loc, force),
        state.settings.netatmoToken ? fetchNetatmo(loc, state.settings.netatmoToken) : Promise.resolve(null),
      ]);
      const val = (r, id) => {
        if (r.status === "fulfilled") {
          if (r.value != null) counts[id]++;
          return r.value;
        }
        errors[id].push(`${loc.name}: ${r.reason?.message || r.reason}`);
        return undefined;
      };
      const yrV = val(yr, "yr");
      const stormV = val(storm, "storm");
      const sporetV = val(sporet, "sporet");
      const netV = val(netatmo, "netatmo");

      const auto = autoBaseDepth(sporetV);
      const manual = state.settings.baseDepth[loc.id];
      const startDepth = manual != null ? manual : auto.depth;
      const startWhy = manual != null ? "satt manuelt" : auto.why;

      const sourceDays = {
        yr: yrV ? blocksByDay(yrV.blocks) : null,
        storm: stormV ? blocksByDay(stormV.blocks) : null,
      };
      state.results[loc.id] = {
        days: runEnsemble(sourceDays, state.days, startDepth, thresholds()),
        sporet: sporetV,
        netatmo: netatmo.status === "rejected" ? { error: netatmoError(netatmo.reason) } : netV,
        yrNow: yrV?.now,
        stormNow: stormV?.now,
        startDepth,
        startWhy,
        sourceDays,
      };
    })
  );

  for (const id of ["yr", "storm", "sporet"]) {
    setSource(id, counts[id] ? "ok" : "error", errors[id].join("\n") || `${counts[id]} av ${LOCATIONS.length} steder`);
  }
  if (state.settings.netatmoToken) {
    setSource("netatmo", counts.netatmo ? "ok" : "error", errors.netatmo.join("\n") || "OK");
  }

  await webcamsPromise;
  renderResorts();
  renderHero();
  renderChart();
  $("refreshBtn").disabled = false;
}

function netatmoError(err) {
  const msg = String(err?.message || err);
  if (msg.startsWith("401") || msg.startsWith("403")) return "Token utløpt – lag et nytt i ⚙️";
  return "Netatmo svarte ikke";
}

// Rask ny beregning uten nytt nettverkskall (når grense/snødybde endres)
function recompute() {
  for (const loc of LOCATIONS) {
    const r = state.results[loc.id];
    if (!r) continue;
    const auto = autoBaseDepth(r.sporet);
    const manual = state.settings.baseDepth[loc.id];
    r.startDepth = manual != null ? manual : auto.depth;
    r.startWhy = manual != null ? "satt manuelt" : auto.why;
    r.days = runEnsemble(r.sourceDays, state.days, r.startDepth, thresholds());
  }
  renderResorts();
  renderHero();
  renderChart();
}

function init() {
  renderSources();
  renderSettings();
  startSnow();

  $("refreshBtn").addEventListener("click", () => loadAll(true));
  $("settingsBtn").addEventListener("click", () => {
    const el = $("settings");
    el.hidden = !el.hidden;
    $("settingsBtn").setAttribute("aria-expanded", String(!el.hidden));
  });
  $("thresholdInput").addEventListener("input", (e) => {
    $("thresholdOut").textContent = `${e.target.value} cm`;
  });
  $("selfThresholdInput").addEventListener("input", (e) => {
    $("selfThresholdOut").textContent = `${e.target.value} cm`;
  });
  $("saveSettings").addEventListener("click", () => {
    const hadToken = state.settings.netatmoToken;
    readSettings();
    if (state.settings.netatmoToken !== hadToken) loadAll(false);
    else recompute();
    $("settings").hidden = true;
    $("settingsBtn").setAttribute("aria-expanded", "false");
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderChart, 150);
  });

  loadAll(false);
  initWatch();
}

init();
