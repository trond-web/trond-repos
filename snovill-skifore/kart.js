/* ------------------------------------------------------------------ *
 *  🗺️ Løypekart: løyper rundt hvert sted fra Sporet.no og Løyper.net,
 *  farget etter hvor lenge siden de ble kjørt.
 *
 *  - Sporet.no: kartlaget «Loypetype» (Sporet_simple/MapServer/6) hentes
 *    direkte fra nettleseren for et område rundt stedet.
 *  - Løyper.net: tillater ikke kall fra nettleseren, så Pages-workflowen
 *    legger strekningene ved som data/loyper.json (se data/hent-loyper.mjs).
 *
 *  Leaflet lastes først når kartet kommer til syne. Bruker LOCATIONS,
 *  $, escapeHtml, timeAgo og storageGet/storageSet fra app.js.
 * ------------------------------------------------------------------ */

const MAP_RADIUS_KM = 8;
const LEAFLET = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/";
const SPORET_TRAILS =
  "https://ags.sporet.no/arcgis/rest/services/Sporet_simple/MapServer/6/query" +
  "?geometryType=esriGeometryEnvelope&inSR=4326&outSR=4326&spatialRel=esriSpatialRelIntersects" +
  "&outFields=id,destinationid,prepsymbol,trailtypesymbol&returnGeometry=true" +
  "&maxAllowableOffset=0.00008&geometryPrecision=5&f=json";

// Klasser etter tid siden kjøring – samme inndeling som Sporet bruker
const GROOM_CLASSES = [
  { id: 20, label: "Kjørt siste 6 t", color: "#00a651", maxH: 6 },
  { id: 30, label: "6–18 t siden", color: "#7bc043", maxH: 18 },
  { id: 40, label: "18 t – 2 døgn", color: "#f2b500", maxH: 48 },
  { id: 50, label: "2–14 døgn", color: "#f07c22", maxH: 14 * 24 },
  { id: 60, label: "Over 14 døgn", color: "#8d97a5", maxH: Infinity },
  { id: 70, label: "Ikke kjørt i år / ukjent", color: "#b9c0ca", maxH: null },
];
const classById = Object.fromEntries(GROOM_CLASSES.map((c) => [c.id, c]));

const TRAIL_TYPES = {
  10: "Maskinpreparert",
  11: "Maskinpreparert lysløype",
  12: "Maskinpreparert + labbeløype",
  13: "Maskinpreparert + labbeløype, med lys",
  20: "Scooterspor",
  21: "Scooterspor med lys",
  22: "Scooterspor + labbeløype",
  23: "Scooterspor + labbeløype, med lys",
  30: "Labbeløype",
  31: "Maskinpreparert lysløype",
  40: "Historisk løype",
};

const kart = {
  map: null,
  layers: { sporet: null, loyper: null, place: null },
  loc: null,
  show: { sporet: true, loyper: true },
  sporetCache: new Map(),
  dests: null,
  loyperData: undefined,
  leaflet: null,
  seq: 0,
};

// Kjørt for mer enn ~4 måneder siden regnes som forrige sesong
const LAST_SEASON_H = 120 * 24;

function classForHours(h) {
  if (h == null || !Number.isFinite(h) || h > LAST_SEASON_H) return classById[70];
  return GROOM_CLASSES.find((c) => c.maxH != null && h < c.maxH) || classById[60];
}

// Løyper.net oppgir norsk/svensk lokal tid uten tidssone («2026-03-10 14:54:13»)
function parseLocalTime(s) {
  if (!s) return null;
  const d = new Date(s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

function lineKm(coords) {
  let km = 0;
  for (let i = 1; i < coords.length; i++) km += distanceKm(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
  return km;
}

function boxAround(loc, km) {
  const dLat = km / 111.2;
  const dLon = km / (111.2 * Math.cos((loc.lat * Math.PI) / 180));
  return { s: loc.lat - dLat, n: loc.lat + dLat, w: loc.lon - dLon, e: loc.lon + dLon };
}

function loadLeaflet() {
  if (kart.leaflet) return kart.leaflet;
  kart.leaflet = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = LEAFLET + "leaflet.min.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = LEAFLET + "leaflet.min.js";
    js.onload = () => resolve(window.L);
    js.onerror = () => reject(new Error("Kartbiblioteket ble ikke lastet"));
    document.head.appendChild(js);
  });
  return kart.leaflet;
}

async function sporetTrails(loc) {
  if (kart.sporetCache.has(loc.id)) return kart.sporetCache.get(loc.id);
  const b = boxAround(loc, MAP_RADIUS_KM);
  const [data, dests] = await Promise.all([
    fetchJson(`${SPORET_TRAILS}&geometry=${b.w},${b.s},${b.e},${b.n}`),
    kart.dests || SporetWatch.fetchDestinations().catch(() => []),
  ]);
  if (data.error) throw new Error(data.error.message || "Sporet-kartet svarte med feil");
  kart.dests = dests;
  const names = Object.fromEntries(dests.map((d) => [d.id, d.name]));
  const trails = (data.features || [])
    .filter((f) => f.geometry?.paths?.length)
    .map((f) => {
      const a = f.attributes;
      const prep = Math.floor((a.prepsymbol || 70) / 10) * 10;
      return {
        cls: classById[prep] || classById[70],
        type: TRAIL_TYPES[a.trailtypesymbol] || "Løype",
        area: names[a.destinationid] || null,
        lines: f.geometry.paths.map((p) => p.map(([lon, lat]) => [lat, lon])),
      };
    });
  kart.sporetCache.set(loc.id, trails);
  return trails;
}

async function loyperData() {
  if (kart.loyperData !== undefined) return kart.loyperData;
  try {
    const res = await fetch(`data/loyper.json?t=${Math.floor(Date.now() / 3600000)}`);
    kart.loyperData = res.ok ? await res.json() : null;
  } catch {
    kart.loyperData = null;
  }
  return kart.loyperData;
}

function loyperTrails(data, loc) {
  const segs = data?.steder?.[loc.name] || [];
  return segs.map((s) => {
    const t = parseLocalTime(s.tid);
    const h = t ? (Date.now() - t.getTime()) / 3600000 : null;
    return {
      cls: s.aapenUpreppet && (h == null || h > 48) ? classById[70] : classForHours(h),
      time: t,
      lit: s.lys,
      openNotGroomed: s.aapenUpreppet,
      area: data.omraader?.[s.omr]?.navn || s.omr,
      lines: s.linjer,
    };
  });
}

function drawTrails(L, trails, dashed, popup) {
  const group = L.layerGroup();
  // Eldste først, så ferske løyper ligger øverst
  const order = (t) => GROOM_CLASSES.length - GROOM_CLASSES.indexOf(t.cls);
  for (const t of [...trails].sort((a, b) => order(a) - order(b))) {
    const weight = t.cls.id === 70 ? 3 : 4;
    L.polyline(t.lines, { color: "#ffffff", weight: weight + 3, opacity: 0.85, interactive: false }).addTo(group);
    L.polyline(t.lines, { color: t.cls.color, weight, opacity: 1, dashArray: dashed ? "7 6" : null, lineCap: dashed ? "butt" : "round" })
      .bindPopup(popup(t))
      .addTo(group);
  }
  return group;
}

function sporetPopup(t) {
  return `<strong>${escapeHtml(t.area || "Sporet.no")}</strong><br>${escapeHtml(t.type)}<br>${escapeHtml(t.cls.label)}<br><span class="map-src">Kilde: Sporet.no</span>`;
}

function loyperPopup(t) {
  const when = t.time
    ? `Kjørt ${escapeHtml(timeAgo(t.time))} (${t.time.toLocaleString("nb-NO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })})`
    : "Ikke registrert kjørt";
  const extra = [t.lit ? "💡 Lysløype" : "", t.openNotGroomed ? "Åpen, ikke preparert" : ""].filter(Boolean).join(" · ");
  return `<strong>${escapeHtml(t.area || "Løyper.net")}</strong><br>${when}${extra ? `<br>${extra}` : ""}<br><span class="map-src">Kilde: Løyper.net</span>`;
}

function summarize(trails) {
  let total = 0;
  let fresh = 0;
  for (const t of trails) {
    const km = t.lines.reduce((s, l) => s + lineKm(l), 0);
    total += km;
    if (t.cls.id <= 30) fresh += km;
  }
  return { total, fresh };
}

function renderMapInfo(parts) {
  $("mapInfo").innerHTML = parts.map((p) => `<span class="map-chip">${p}</span>`).join("");
}

async function showMapPlace(id) {
  const loc = LOCATIONS.find((l) => l.id === id) || LOCATIONS[0];
  kart.loc = loc;
  storageSet("snovill.kartsted", loc.id);
  const seq = ++kart.seq;
  const L = await loadLeaflet();
  if (!kart.map) {
    kart.map = L.map("trailMap", { scrollWheelZoom: false, zoomSnap: 0.5 });
    L.tileLayer("https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png", {
      maxZoom: 17,
      attribution: '© <a href="https://www.kartverket.no/">Kartverket</a> · Løyper: <a href="https://sporet.no/">Sporet.no</a>, <a href="https://www.loyper.net/">Løyper.net</a>',
    }).addTo(kart.map);
  }
  const b = boxAround(loc, MAP_RADIUS_KM * 0.7);
  kart.map.fitBounds([[b.s, b.w], [b.n, b.e]]);
  for (const k of Object.keys(kart.layers)) {
    if (kart.layers[k]) kart.map.removeLayer(kart.layers[k]);
    kart.layers[k] = null;
  }
  kart.layers.place = L.circleMarker([loc.lat, loc.lon], { radius: 7, color: "#ffffff", weight: 2, fillColor: "#2a78d6", fillOpacity: 1 })
    .bindTooltip(`${loc.emoji} ${escapeHtml(loc.name)}`, { permanent: true, direction: "top", offset: [0, -8], className: "map-place" })
    .addTo(kart.map);
  renderMapInfo(['<span class="spinner"></span> Henter løyper …']);

  const [sp, lp] = await Promise.allSettled([sporetTrails(loc), loyperData()]);
  if (seq !== kart.seq) return; // brukeren har byttet sted i mellomtiden

  const info = [];
  if (sp.status === "fulfilled") {
    kart.layers.sporet = drawTrails(L, sp.value, false, sporetPopup);
    if (kart.show.sporet) kart.layers.sporet.addTo(kart.map);
    const s = summarize(sp.value);
    info.push(`<b>Sporet.no</b> ${fmt0(s.total)} km${s.fresh >= 0.5 ? ` · 🟢 ${fmt0(s.fresh)} km kjørt siste 18 t` : ""}`);
  } else {
    info.push("<b>Sporet.no</b> svarte ikke");
  }
  const data = lp.status === "fulfilled" ? lp.value : null;
  if (data) {
    const trails = loyperTrails(data, loc);
    kart.layers.loyper = drawTrails(L, trails, true, loyperPopup);
    if (kart.show.loyper) kart.layers.loyper.addTo(kart.map);
    const s = summarize(trails);
    const fetched = data.hentet ? ` · hentet ${escapeHtml(timeAgo(new Date(data.hentet)))}` : "";
    info.push(
      trails.length
        ? `<b>Løyper.net</b> ${fmt0(s.total)} km${s.fresh >= 0.5 ? ` · 🟢 ${fmt0(s.fresh)} km kjørt siste 18 t` : ""}${fetched}`
        : `<b>Løyper.net</b> ingen løyper her${fetched}`
    );
  } else {
    info.push("<b>Løyper.net</b> ikke tilgjengelig ennå");
  }
  if (kart.layers.place) kart.layers.place.bringToFront();
  renderMapInfo(info);
}

function renderMapLegend() {
  $("mapLegend").innerHTML =
    GROOM_CLASSES.map((c) => `<span class="map-key"><i style="background:${c.color}"></i>${escapeHtml(c.label)}</span>`).join("") +
    '<span class="map-key"><i class="line-solid"></i>Sporet.no</span><span class="map-key"><i class="line-dashed"></i>Løyper.net</span>';
}

function initTrailMap() {
  const sel = $("mapLoc");
  const box = $("trailMap");
  if (!sel || !box) return;
  sel.innerHTML = LOCATIONS.map((l) => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join("");
  const saved = storageGet("snovill.kartsted");
  sel.value = LOCATIONS.some((l) => l.id === saved) ? saved : LOCATIONS[0].id;
  renderMapLegend();

  const start = () => showMapPlace(sel.value).catch((err) => renderMapInfo([`Kartet kunne ikke vises: ${escapeHtml(err.message)}`]));
  sel.addEventListener("change", start);
  for (const src of ["sporet", "loyper"]) {
    $(`mapShow_${src}`).addEventListener("change", (e) => {
      kart.show[src] = e.target.checked;
      const layer = kart.layers[src];
      if (!kart.map || !layer) return;
      if (e.target.checked) layer.addTo(kart.map);
      else kart.map.removeLayer(layer);
      kart.layers.place?.bringToFront();
    });
  }

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        start();
      }
    }, { rootMargin: "300px" });
    io.observe(box);
  } else {
    start();
  }
}

initTrailMap();
