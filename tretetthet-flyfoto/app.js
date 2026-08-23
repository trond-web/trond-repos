const OSTLANDET_FYLKESNUMMER = new Set(["03", "30", "34", "39", "40"]);
const MAX_WORKING_DIM = 1400;

const state = {
  gsdMetersPerPixel: null,
  image: null,
  workingWidth: 0,
  workingHeight: 0,
  effectiveGsd: null,
  lineCalibration: { active: false, points: [] },
  lastResult: null,
  selectedPosition: null,
};

const els = {
  placeSearch: document.getElementById("placeSearch"),
  placeSearchBtn: document.getElementById("placeSearchBtn"),
  placeResults: document.getElementById("placeResults"),
  selectedPosition: document.getElementById("selectedPosition"),
  dropZone: document.getElementById("dropZone"),
  fileInput: document.getElementById("fileInput"),
  calibrationSection: document.getElementById("calibrationSection"),
  gsdPreset: document.getElementById("gsdPreset"),
  gsdCustom: document.getElementById("gsdCustom"),
  calibrateLineBtn: document.getElementById("calibrateLineBtn"),
  calibrateLineStatus: document.getElementById("calibrateLineStatus"),
  analysisSection: document.getElementById("analysisSection"),
  sourceCanvas: document.getElementById("sourceCanvas"),
  overlayCanvas: document.getElementById("overlayCanvas"),
  crownSlider: document.getElementById("crownSlider"),
  crownValue: document.getElementById("crownValue"),
  sensSlider: document.getElementById("sensSlider"),
  sensValue: document.getElementById("sensValue"),
  runBtn: document.getElementById("runBtn"),
  runStatus: document.getElementById("runStatus"),
  resultSection: document.getElementById("resultSection"),
  statCount: document.getElementById("statCount"),
  statArea: document.getElementById("statArea"),
  statDensity: document.getElementById("statDensity"),
  statPerHa: document.getElementById("statPerHa"),
  downloadReportBtn: document.getElementById("downloadReportBtn"),
  linkNorgeIBilder: document.getElementById("linkNorgeIBilder"),
  linkKilden: document.getElementById("linkKilden"),
  linkNorgeskart: document.getElementById("linkNorgeskart"),
};

try {
  initMap();
  initPlaceSearch();
} catch (err) {
  console.error("Kartdelen kunne ikke lastes:", err);
  els.selectedPosition.textContent = "Kartet kunne ikke lastes (sjekk nettforbindelsen). Opplasting og analyse fungerer likevel.";
}
initUpload();
initCalibration();
initAnalysisControls();

function initMap() {
  const map = L.map("map").setView([59.9139, 10.7522], 8);

  const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap-bidragsytere",
  }).addTo(map);

  const topo = L.tileLayer(
    "https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png",
    { maxZoom: 18, attribution: "© Kartverket" }
  );

  L.control.layers({ "OpenStreetMap": osm, "Kartverket topografisk": topo }).addTo(map);

  map.on("click", (e) => setSelectedPosition(e.latlng.lat, e.latlng.lng, map));

  state.map = map;
}

function setSelectedPosition(lat, lon, map) {
  state.selectedPosition = { lat, lon };
  els.selectedPosition.textContent =
    `Valgt posisjon: ${lat.toFixed(5)}, ${lon.toFixed(5)} (bruk lenkene under for å hente flyfoto/skogdata for stedet)`;

  if (state.marker) {
    state.marker.setLatLng([lat, lon]);
  } else {
    state.marker = L.marker([lat, lon]).addTo(map);
  }
  map.setView([lat, lon], Math.max(map.getZoom(), 13));
}

function initPlaceSearch() {
  async function search() {
    const query = els.placeSearch.value.trim();
    els.placeResults.innerHTML = "";
    if (!query) return;
    els.placeResults.innerHTML = "<li>Søker …</li>";
    try {
      const url = `https://ws.geonorge.no/stedsnavn/v1/navn?sok=${encodeURIComponent(query)}*&treffPerSide=15&fuzzy=true`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Søket feilet");
      const data = await res.json();
      renderPlaceResults(data.navn || []);
    } catch (err) {
      els.placeResults.innerHTML = `<li>Kunne ikke søke akkurat nå (${err.message}).</li>`;
    }
  }

  function renderPlaceResults(navn) {
    els.placeResults.innerHTML = "";
    if (navn.length === 0) {
      els.placeResults.innerHTML = "<li>Ingen treff.</li>";
      return;
    }
    const sorted = [...navn].sort((a, b) => {
      const aOst = a.fylker?.some((f) => OSTLANDET_FYLKESNUMMER.has(f.fylkesnummer)) ? 0 : 1;
      const bOst = b.fylker?.some((f) => OSTLANDET_FYLKESNUMMER.has(f.fylkesnummer)) ? 0 : 1;
      return aOst - bOst;
    });
    for (const n of sorted) {
      const li = document.createElement("li");
      const fylkesnavn = n.fylker?.map((f) => f.fylkesnavn).join(", ") || "";
      const kommunenavn = n.kommuner?.map((k) => k.kommunenavn).join(", ") || "";
      li.textContent = `${n.skrivemåte} — ${kommunenavn}${fylkesnavn ? ", " + fylkesnavn : ""}`;
      li.addEventListener("click", () => {
        const p = n.representasjonspunkt;
        if (p) setSelectedPosition(p.nord, p.øst, state.map);
        els.placeResults.innerHTML = "";
      });
      els.placeResults.appendChild(li);
    }
  }

  els.placeSearchBtn.addEventListener("click", search);
  els.placeSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      search();
    }
  });
}

function initUpload() {
  els.fileInput.addEventListener("change", () => {
    if (els.fileInput.files[0]) loadImageFile(els.fileInput.files[0]);
  });

  ["dragenter", "dragover"].forEach((evt) =>
    els.dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropZone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    els.dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropZone.classList.remove("dragover");
    })
  );
  els.dropZone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) loadImageFile(file);
  });
}

function loadImageFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    state.image = img;
    prepareCanvases(img);
    els.calibrationSection.hidden = false;
    els.analysisSection.hidden = false;
    els.resultSection.hidden = true;
    updateRunButtonState();
    URL.revokeObjectURL(url);
  };
  img.onerror = () => {
    alert("Kunne ikke lese bildefilen. Prøv et annet format (JPG/PNG).");
  };
  img.src = url;
}

function prepareCanvases(img) {
  const scale = Math.min(1, MAX_WORKING_DIM / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  state.workingWidth = w;
  state.workingHeight = h;
  state.uploadScale = scale;

  const src = els.sourceCanvas;
  src.width = w;
  src.height = h;
  const ctx = src.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);

  const overlay = els.overlayCanvas;
  overlay.width = w;
  overlay.height = h;
  overlay.getContext("2d").clearRect(0, 0, w, h);

  updateEffectiveGsd();
  setupLineCalibrationCanvas();
}

function initCalibration() {
  els.gsdPreset.addEventListener("change", () => {
    const val = els.gsdPreset.value;
    if (val === "custom") {
      els.gsdCustom.hidden = false;
      els.gsdCustom.focus();
    } else if (val) {
      els.gsdCustom.hidden = true;
      state.gsdMetersPerPixel = parseFloat(val);
      updateEffectiveGsd();
      updateRunButtonState();
    } else {
      els.gsdCustom.hidden = true;
      state.gsdMetersPerPixel = null;
      updateEffectiveGsd();
      updateRunButtonState();
    }
  });

  els.gsdCustom.addEventListener("input", () => {
    const val = parseFloat(els.gsdCustom.value);
    state.gsdMetersPerPixel = val > 0 ? val : null;
    updateEffectiveGsd();
    updateRunButtonState();
  });

  els.calibrateLineBtn.addEventListener("click", () => {
    state.lineCalibration = { active: true, points: [] };
    els.calibrateLineStatus.textContent = "Klikk to punkter på bildet som markerer en kjent avstand.";
  });
}

function setupLineCalibrationCanvas() {
  els.overlayCanvas.onclick = (e) => {
    if (!state.lineCalibration.active) return;
    const rect = els.overlayCanvas.getBoundingClientRect();
    const scaleX = els.overlayCanvas.width / rect.width;
    const scaleY = els.overlayCanvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    state.lineCalibration.points.push([x, y]);
    drawCalibrationMarkers();

    if (state.lineCalibration.points.length === 2) {
      const [[x1, y1], [x2, y2]] = state.lineCalibration.points;
      const pixelDist = Math.hypot(x2 - x1, y2 - y1);
      const realDist = parseFloat(prompt("Hvor mange meter tilsvarer denne linjen i virkeligheten?"));
      state.lineCalibration.active = false;
      if (realDist > 0 && pixelDist > 0) {
        const gsd = realDist / pixelDist;
        state.gsdMetersPerPixel = gsd;
        els.gsdPreset.value = "custom";
        els.gsdCustom.hidden = false;
        els.gsdCustom.value = gsd.toFixed(4);
        els.calibrateLineStatus.textContent = `Kalibrert: ${gsd.toFixed(4)} m/piksel.`;
        updateEffectiveGsd();
        updateRunButtonState();
      } else {
        els.calibrateLineStatus.textContent = "Ugyldig avstand oppgitt, prøv igjen.";
      }
      state.lineCalibration.points = [];
    }
  };
}

function drawCalibrationMarkers() {
  const ctx = els.overlayCanvas.getContext("2d");
  ctx.clearRect(0, 0, els.overlayCanvas.width, els.overlayCanvas.height);
  ctx.fillStyle = "#1976d2";
  ctx.strokeStyle = "#1976d2";
  ctx.lineWidth = 2;
  for (const [x, y] of state.lineCalibration.points) {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.lineCalibration.points.length === 2) {
    const [[x1, y1], [x2, y2]] = state.lineCalibration.points;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

function updateEffectiveGsd() {
  state.effectiveGsd =
    state.gsdMetersPerPixel && state.uploadScale
      ? state.gsdMetersPerPixel / state.uploadScale
      : null;
}

function updateRunButtonState() {
  els.runBtn.disabled = !(state.image && state.effectiveGsd);
}

function initAnalysisControls() {
  els.crownSlider.addEventListener("input", () => {
    els.crownValue.textContent = parseFloat(els.crownSlider.value).toFixed(1);
  });
  els.sensSlider.addEventListener("input", () => {
    els.sensValue.textContent = els.sensSlider.value;
  });
  els.runBtn.addEventListener("click", runDetection);
  els.downloadReportBtn.addEventListener("click", downloadReport);
}

function runDetection() {
  if (!state.image || !state.effectiveGsd) {
    alert("Last opp et bilde og angi skala (m/piksel) først.");
    return;
  }
  els.runStatus.textContent = "Analyserer bilde …";
  els.runBtn.disabled = true;

  setTimeout(() => {
    try {
      const result = detectTrees({
        canvas: els.sourceCanvas,
        gsd: state.effectiveGsd,
        crownDiameterM: parseFloat(els.crownSlider.value),
        sensitivityOffset: parseFloat(els.sensSlider.value),
      });
      state.lastResult = result;
      drawDetections(result.points);
      showResults(result);
      els.runStatus.textContent = result.note ? result.note : "Analyse ferdig.";
    } catch (err) {
      console.error(err);
      els.runStatus.textContent = "Noe gikk galt under analysen. Prøv et annet bilde eller andre innstillinger.";
    } finally {
      els.runBtn.disabled = false;
    }
  }, 20);
}

function detectTrees({ canvas, gsd, crownDiameterM, sensitivityOffset }) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  const indexArr = new Uint8ClampedArray(w * h);
  const hist = new Array(256).fill(0);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const raw = 2 * g - r - b;
    const norm = Math.round(((raw + 510) / 1020) * 255);
    indexArr[p] = norm;
    hist[norm]++;
  }

  const otsu = otsuThreshold(hist, w * h);
  const threshold = clamp(otsu + sensitivityOffset, 1, 254);

  let mask = new Uint8Array(w * h);
  let maskCount = 0;
  for (let p = 0; p < indexArr.length; p++) {
    mask[p] = indexArr[p] >= threshold ? 1 : 0;
    maskCount += mask[p];
  }

  const areaM2 = w * gsd * (h * gsd);
  const areaDekar = areaM2 / 1000;
  const foregroundFraction = maskCount / (w * h);
  if (maskCount === 0 || foregroundFraction > 0.95) {
    return {
      points: [],
      treeCount: 0,
      areaDekar,
      density: 0,
      threshold,
      gsd,
      note: "Fant ikke tydelig vegetasjon i bildet (for lite grønnkontrast). Prøv et annet flyfoto eller juster grønnhetsterskelen.",
    };
  }

  const openRadiusPx = Math.max(1, Math.round((crownDiameterM * 0.1) / gsd));
  mask = erode(mask, w, h, openRadiusPx);
  mask = dilate(mask, w, h, openRadiusPx);

  const minCrownRadiusM = crownDiameterM * 0.15;
  const minAreaPx = Math.max(3, Math.round(Math.PI * (minCrownRadiusM / gsd) ** 2));
  filterSmallComponents(mask, w, h, minAreaPx);

  const dist = distanceTransform(mask, w, h);

  const minDistPx = Math.max(2, (crownDiameterM / 2 / gsd) * 0.85);
  const minPeakValue = Math.max(1.2, openRadiusPx);
  const points = findLocalMaxima(dist, w, h, minPeakValue, minDistPx);

  return {
    points,
    treeCount: points.length,
    areaDekar,
    density: areaDekar > 0 ? points.length / areaDekar : 0,
    threshold,
    gsd,
  };
}

function otsuThreshold(hist, total) {
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let varMax = 0;
  let threshold = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = t;
    }
  }
  return threshold;
}

function erode(mask, w, h, r) {
  if (r <= 0) return mask.slice();
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 1;
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w || mask[y * w + xx] === 0) {
          v = 0;
          break;
        }
      }
      tmp[y * w + x] = v;
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = 1;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h || tmp[yy * w + x] === 0) {
          v = 0;
          break;
        }
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

function dilate(mask, w, h, r) {
  if (r <= 0) return mask.slice();
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx;
        if (xx >= 0 && xx < w && mask[y * w + xx]) {
          v = 1;
          break;
        }
      }
      tmp[y * w + x] = v;
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy >= 0 && yy < h && tmp[yy * w + x]) {
          v = 1;
          break;
        }
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

function filterSmallComponents(mask, w, h, minAreaPx) {
  const visited = new Uint8Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || visited[start]) continue;
    const comp = [start];
    visited[start] = 1;
    const stack = [start];
    while (stack.length) {
      const i = stack.pop();
      const x = i % w;
      const y = (i / w) | 0;
      const neighbors = [];
      if (x > 0) neighbors.push(i - 1);
      if (x < w - 1) neighbors.push(i + 1);
      if (y > 0) neighbors.push(i - w);
      if (y < h - 1) neighbors.push(i + w);
      for (const n of neighbors) {
        if (mask[n] && !visited[n]) {
          visited[n] = 1;
          comp.push(n);
          stack.push(n);
        }
      }
    }
    if (comp.length < minAreaPx) {
      for (const i of comp) mask[i] = 0;
    }
  }
}

function distanceTransform(mask, w, h) {
  const INF = 1e6;
  const dist = new Float32Array(w * h).fill(INF);
  for (let i = 0; i < w * h; i++) if (!mask[i]) dist[i] = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (dist[i] === 0) continue;
      let d = dist[i];
      if (x > 0) d = Math.min(d, dist[i - 1] + 1);
      if (y > 0) d = Math.min(d, dist[i - w] + 1);
      if (x > 0 && y > 0) d = Math.min(d, dist[i - w - 1] + 1.4142);
      if (x < w - 1 && y > 0) d = Math.min(d, dist[i - w + 1] + 1.4142);
      dist[i] = d;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let d = dist[i];
      if (x < w - 1) d = Math.min(d, dist[i + 1] + 1);
      if (y < h - 1) d = Math.min(d, dist[i + w] + 1);
      if (x < w - 1 && y < h - 1) d = Math.min(d, dist[i + w + 1] + 1.4142);
      if (x > 0 && y < h - 1) d = Math.min(d, dist[i + w - 1] + 1.4142);
      dist[i] = d;
    }
  }
  return dist;
}

function maxFilter(arr, w, h, r) {
  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let m = -Infinity;
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        const v = arr[y * w + xx];
        if (v > m) m = v;
      }
      tmp[y * w + x] = m;
    }
  }
  const out = new Float32Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let m = -Infinity;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        const v = tmp[yy * w + x];
        if (v > m) m = v;
      }
      out[y * w + x] = m;
    }
  }
  return out;
}

function findLocalMaxima(dist, w, h, minPeakValue, minDistPx) {
  const r = Math.max(1, Math.round(minDistPx));
  const filtered = maxFilter(dist, w, h, r);

  const candidates = [];
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] >= minPeakValue && dist[i] === filtered[i]) candidates.push(i);
  }
  candidates.sort((a, b) => dist[b] - dist[a]);

  const cellSize = Math.max(1, minDistPx);
  const grid = new Map();
  const minDistSq = minDistPx * minDistPx;
  const selected = [];

  const cellKey = (gx, gy) => gx * 1000003 + gy;

  for (const idx of candidates) {
    const x = idx % w;
    const y = (idx / w) | 0;
    const gx = (x / cellSize) | 0;
    const gy = (y / cellSize) | 0;
    let ok = true;
    for (let ngx = gx - 1; ngx <= gx + 1 && ok; ngx++) {
      for (let ngy = gy - 1; ngy <= gy + 1; ngy++) {
        const arr = grid.get(cellKey(ngx, ngy));
        if (!arr) continue;
        for (const [sx, sy] of arr) {
          const dx = sx - x;
          const dy = sy - y;
          if (dx * dx + dy * dy < minDistSq) {
            ok = false;
            break;
          }
        }
        if (!ok) break;
      }
    }
    if (ok) {
      selected.push([x, y]);
      const key = cellKey(gx, gy);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push([x, y]);
    }
  }
  return selected;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function drawDetections(points) {
  const ctx = els.overlayCanvas.getContext("2d");
  ctx.clearRect(0, 0, els.overlayCanvas.width, els.overlayCanvas.height);
  ctx.strokeStyle = "#e53935";
  ctx.fillStyle = "rgba(229, 57, 53, 0.25)";
  ctx.lineWidth = 1.5;
  for (const [x, y] of points) {
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

function showResults(result) {
  els.resultSection.hidden = false;
  els.statCount.textContent = result.treeCount;
  els.statArea.textContent = result.areaDekar.toFixed(2);
  els.statDensity.textContent = result.density.toFixed(1);
  els.statPerHa.textContent = (result.density * 10).toFixed(1);
}

function downloadReport() {
  const r = state.lastResult;
  if (!r) return;
  const lines = [
    "Tretetthet fra flyfoto – rapport",
    `Generert: ${new Date().toLocaleString("nb-NO")}`,
    state.selectedPosition
      ? `Posisjon: ${state.selectedPosition.lat.toFixed(5)}, ${state.selectedPosition.lon.toFixed(5)}`
      : "Posisjon: ikke angitt",
    `Bakkeoppløsning brukt i analysen: ${r.gsd.toFixed(4)} m/piksel`,
    `Areal analysert: ${r.areaDekar.toFixed(2)} dekar`,
    `Registrerte trær: ${r.treeCount}`,
    `Tetthet: ${r.density.toFixed(2)} trær/dekar (${(r.density * 10).toFixed(2)} trær/hektar)`,
    "",
    "Metode: Grønnhetsindeks (excess green) med Otsu-terskling, morfologisk åpning,",
    "avstandstransform og lokale maksima for å skille kroner. Automatisert estimat, ikke skogtakst.",
    "",
    "Datakilder: Kartverket/Geovekst Norge i bilder, NIBIO Kilden (SR16 skogressurskart),",
    "Geonorge Stedsnavn-API, Kartverket åpne kartdata, OpenStreetMap.",
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tretetthet-rapport.txt";
  a.click();
  URL.revokeObjectURL(url);
}
