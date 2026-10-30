/* ------------------------------------------------------------------ *
 *  🗺️ Løypekart: løyper rundt hvert sted fra Sporet.no og Løyper.net,
 *  farget etter hvor lenge siden de ble kjørt.
 *
 *  - Sporet.no: kartlaget «Loypetype» (Sporet_simple/MapServer/6) hentes
 *    direkte fra nettleseren for et område rundt stedet.
 *  - Løyper.net: tillater ikke kall fra nettleseren, så Pages-workflowen
 *    legger strekningene ved som data/loyper.json (se data/hent-loyper.mjs).
 *
 *  Hvert stedskort i app.js har en plassholder (.resort-map-slot). Kartet
 *  lages én gang per sted og flyttes inn i kortet hver gang kortene tegnes
 *  på nytt, så det beholder zoom og data. Leaflet lastes først når et kart
 *  kommer til syne. Bruker LOCATIONS, escapeHtml, timeAgo, fmt0, distanceKm
 *  og fetchJson fra app.js.
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
  maps: new Map(), // sted-id → { el, map, layers, show, seq, observed }
  sporetCache: new Map(),
  dests: null,
  loyperData: undefined,
  leaflet: null,
  io: null,
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
    kart.dests || state.dests || SporetWatch.fetchDestinations().catch(() => []),
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

function legendHtml() {
  return (
    GROOM_CLASSES.map((c) => `<span class="map-key"><i style="background:${c.color}"></i>${escapeHtml(c.label)}</span>`).join("") +
    '<span class="map-key"><i class="line-solid"></i>Sporet.no</span><span class="map-key"><i class="line-dashed"></i>Løyper.net</span>'
  );
}

// Kartblokken for ett sted lages én gang og gjenbrukes når kortene tegnes på nytt
function mapEntry(loc) {
  if (kart.maps.has(loc.id)) return kart.maps.get(loc.id);
  const el = document.createElement("section");
  el.className = "resort-map";
  el.setAttribute("aria-label", `Løypekart for ${loc.name}`);
  el.innerHTML = `
    <div class="resort-map-head">
      <h3>🗺️ Løypekart <small class="muted">${MAP_RADIUS_KM} km rundt</small></h3>
      <div class="map-toggles">
        <label class="map-toggle"><input type="checkbox" data-src="sporet" checked> Sporet.no</label>
        <label class="map-toggle"><input type="checkbox" data-src="loyper" checked> Løyper.net</label>
      </div>
    </div>
    <div class="trail-map" role="region" aria-label="Kart over løyper ved ${escapeHtml(loc.name)}"></div>
    <div class="map-info" aria-live="polite"><span class="map-chip">Kartet lastes når du kommer hit</span></div>
    <details class="map-legend-wrap"><summary>Fargeforklaring</summary><div class="map-legend">${legendHtml()}</div></details>`;
  const entry = { loc, el, map: null, layers: { sporet: null, loyper: null, place: null }, show: { sporet: true, loyper: true }, seq: 0, started: false };
  el.querySelectorAll("input[data-src]").forEach((input) =>
    input.addEventListener("change", (e) => {
      const src = e.target.dataset.src;
      entry.show[src] = e.target.checked;
      const layer = entry.layers[src];
      if (!entry.map || !layer) return;
      if (e.target.checked) layer.addTo(entry.map);
      else entry.map.removeLayer(layer);
      entry.layers.place?.bringToFront();
    })
  );
  kart.maps.set(loc.id, entry);
  return entry;
}

function renderMapInfo(entry, parts) {
  entry.el.querySelector(".map-info").innerHTML = parts.map((p) => `<span class="map-chip">${p}</span>`).join("");
}

async function drawMap(entry) {
  const { loc } = entry;
  const seq = ++entry.seq;
  const L = await loadLeaflet();
  if (!entry.map) {
    entry.map = L.map(entry.el.querySelector(".trail-map"), { scrollWheelZoom: false, zoomSnap: 0.5 });
    L.tileLayer("https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png", {
      maxZoom: 17,
      attribution: '© <a href="https://www.kartverket.no/">Kartverket</a> · Løyper: <a href="https://sporet.no/">Sporet.no</a>, <a href="https://www.loyper.net/">Løyper.net</a>',
    }).addTo(entry.map);
    const b = boxAround(loc, MAP_RADIUS_KM * 0.7);
    entry.map.fitBounds([[b.s, b.w], [b.n, b.e]]);
  }
  for (const k of Object.keys(entry.layers)) {
    if (entry.layers[k]) entry.map.removeLayer(entry.layers[k]);
    entry.layers[k] = null;
  }
  entry.layers.place = L.circleMarker([loc.lat, loc.lon], { radius: 7, color: "#ffffff", weight: 2, fillColor: "#2a78d6", fillOpacity: 1 })
    .bindTooltip(`${loc.emoji} ${escapeHtml(loc.name)}`, { permanent: true, direction: "top", offset: [0, -8], className: "map-place" })
    .addTo(entry.map);
  renderMapInfo(entry, ['<span class="spinner"></span> Henter løyper …']);

  const [sp, lp] = await Promise.allSettled([sporetTrails(loc), loyperData()]);
  if (seq !== entry.seq) return; // en nyere opptegning er på vei

  const info = [];
  if (sp.status === "fulfilled") {
    entry.layers.sporet = drawTrails(L, sp.value, false, sporetPopup);
    if (entry.show.sporet) entry.layers.sporet.addTo(entry.map);
    const s = summarize(sp.value);
    info.push(`<b>Sporet.no</b> ${fmt0(s.total)} km${s.fresh >= 0.5 ? ` · 🟢 ${fmt0(s.fresh)} km kjørt siste 18 t` : ""}`);
  } else {
    info.push("<b>Sporet.no</b> svarte ikke");
  }
  const data = lp.status === "fulfilled" ? lp.value : null;
  if (data) {
    const trails = loyperTrails(data, loc);
    entry.layers.loyper = drawTrails(L, trails, true, loyperPopup);
    if (entry.show.loyper) entry.layers.loyper.addTo(entry.map);
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
  entry.layers.place?.bringToFront();
  renderMapInfo(entry, info);
}

function startMap(entry) {
  if (entry.started) return;
  entry.started = true;
  drawMap(entry).catch((err) => {
    entry.started = false;
    renderMapInfo(entry, [`Kartet kunne ikke vises: ${escapeHtml(err.message)}`]);
  });
}

/** Kalles av renderResorts i app.js etter at stedskortene er tegnet. */
function mountResortMaps() {
  if (!kart.io && "IntersectionObserver" in window) {
    kart.io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          kart.io.unobserve(e.target);
          const entry = kart.maps.get(e.target.dataset.loc);
          if (entry) startMap(entry);
        }
      },
      { rootMargin: "400px" }
    );
  }
  document.querySelectorAll(".resort-map-slot[data-loc]").forEach((slot) => {
    const loc = LOCATIONS.find((l) => l.id === slot.dataset.loc);
    if (!loc) return;
    const entry = mapEntry(loc);
    slot.appendChild(entry.el);
    if (entry.map) {
      entry.map.invalidateSize();
    } else if (kart.io) {
      entry.el.dataset.loc = loc.id;
      kart.io.observe(entry.el);
    } else {
      startMap(entry);
    }
  });
}

mountResortMaps();
