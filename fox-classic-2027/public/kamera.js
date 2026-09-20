const STORAGE_KEY = "foxClassicArrangorCredentials";

const loginCard = document.getElementById("loginCard");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const brukernavnInput = document.getElementById("brukernavnInput");
const passordInput = document.getElementById("passordInput");
const mainContent = document.getElementById("mainContent");
const logoutBtn = document.getElementById("logoutBtn");

const raceClockTime = document.getElementById("raceClockTime");
const startRaceBtn = document.getElementById("startRaceBtn");
const resetRaceBtn = document.getElementById("resetRaceBtn");
const raceClockHint = document.getElementById("raceClockHint");

const video = document.getElementById("video");
const overlayCanvas = document.getElementById("overlayCanvas");
const overlayCtx = overlayCanvas.getContext("2d");
const cameraPlaceholder = document.getElementById("cameraPlaceholder");
const startCameraBtn = document.getElementById("startCameraBtn");
const lockLineBtn = document.getElementById("lockLineBtn");
const unlockLineBtn = document.getElementById("unlockLineBtn");
const cameraHint = document.getElementById("cameraHint");
const pendingList = document.getElementById("pendingList");

let participants = [];
let credentials = null;
let raceStartTime = null;

let cameraStarted = false;
let lineLocked = false;
let lineFraction = 0.5; // 0 (top) .. 1 (bottom), fraction of video height
let dragging = false;

let sampleCanvas = null;
let sampleCtx = null;
let previousBand = null;
let monitorTimer = null;
let cooldownUntil = 0;
let lastMotionScore = 0;

let pendingEntries = [];
let ocrWorker = null;
let ocrWorkerPromise = null;

function authHeaders() {
  return {
    "x-arrangor-brukernavn": credentials.brukernavn,
    "x-arrangor-passord": credentials.passord,
  };
}

async function init() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    showLogin();
    return;
  }
  try {
    credentials = JSON.parse(stored);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    showLogin();
    return;
  }
  const res = await fetch("/api/arrangor/verify", { headers: authHeaders() });
  if (res.ok) {
    showMain();
  } else {
    localStorage.removeItem(STORAGE_KEY);
    credentials = null;
    showLogin();
  }
}

function showLogin() {
  loginCard.style.display = "block";
  mainContent.style.display = "none";
}

function showMain() {
  loginCard.style.display = "none";
  mainContent.style.display = "block";
  loadParticipants();
  loadRace();
  setInterval(loadParticipants, 10000);
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const candidate = { brukernavn: brukernavnInput.value.trim(), passord: passordInput.value };
  const res = await fetch("/api/arrangor/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(candidate),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    loginMessage.textContent = body.error || "Kunne ikke logge inn.";
    loginMessage.className = "form-message error";
    return;
  }
  credentials = candidate;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate));
  passordInput.value = "";
  loginMessage.textContent = "";
  showMain();
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  credentials = null;
  showLogin();
});

async function authFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), ...authHeaders() },
  });
  if (res.status === 401) {
    localStorage.removeItem(STORAGE_KEY);
    credentials = null;
    showLogin();
    loginMessage.textContent = "Du ble logget ut. Logg inn på nytt.";
    loginMessage.className = "form-message error";
  }
  return res;
}

async function loadParticipants() {
  participants = await fcFetchParticipants();
  renderPending();
}

async function loadRace() {
  const res = await fetch("/api/race");
  const race = await res.json();
  raceStartTime = race.startTime;
  updateRaceClockUI();
}

function updateRaceClockUI() {
  if (raceStartTime) {
    startRaceBtn.style.display = "none";
    resetRaceBtn.style.display = "inline-block";
    raceClockHint.textContent = "Løpet er i gang.";
    const elapsedSeconds = Math.max(0, (Date.now() - new Date(raceStartTime).getTime()) / 1000);
    raceClockTime.textContent = fcFormatClock(elapsedSeconds);
  } else {
    startRaceBtn.style.display = "inline-block";
    resetRaceBtn.style.display = "none";
    raceClockTime.textContent = "–";
    raceClockHint.textContent = "Trykk når konkurranseklassen starter.";
  }
}

setInterval(() => {
  if (!raceStartTime) return;
  const elapsedSeconds = Math.max(0, (Date.now() - new Date(raceStartTime).getTime()) / 1000);
  raceClockTime.textContent = fcFormatClock(elapsedSeconds);
}, 1000);

startRaceBtn.addEventListener("click", async () => {
  const res = await authFetch("/api/race/start", { method: "POST" });
  if (!res.ok) return;
  const race = await res.json();
  raceStartTime = race.startTime;
  updateRaceClockUI();
});

resetRaceBtn.addEventListener("click", async () => {
  if (!confirm("Nullstille starttidspunktet for løpet?")) return;
  const res = await authFetch("/api/race/reset", { method: "POST" });
  if (!res.ok) return;
  const race = await res.json();
  raceStartTime = race.startTime;
  updateRaceClockUI();
});

// --- Camera + finish line -------------------------------------------------

startCameraBtn.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    alert("Fikk ikke tilgang til kamera: " + err.message);
    return;
  }

  cameraPlaceholder.style.display = "none";
  cameraStarted = true;
  startCameraBtn.style.display = "none";
  lockLineBtn.style.display = "inline-block";

  sizeOverlay();
  drawOverlay();
});

window.addEventListener("resize", () => {
  if (cameraStarted) sizeOverlay();
});

function sizeOverlay() {
  const rect = video.getBoundingClientRect();
  overlayCanvas.width = rect.width;
  overlayCanvas.height = rect.height;
}

function drawOverlay() {
  const w = overlayCanvas.width;
  const h = overlayCanvas.height;
  overlayCtx.clearRect(0, 0, w, h);

  const y = lineFraction * h;
  const bandPx = Math.max(6, h * 0.05);

  overlayCtx.fillStyle = lineLocked ? "rgba(31,138,76,0.18)" : "rgba(224,129,47,0.18)";
  overlayCtx.fillRect(0, y - bandPx / 2, w, bandPx);

  overlayCtx.strokeStyle = lineLocked ? "#1f8a4c" : "#e0812f";
  overlayCtx.lineWidth = 3;
  overlayCtx.beginPath();
  overlayCtx.moveTo(0, y);
  overlayCtx.lineTo(w, y);
  overlayCtx.stroke();

  if (lineLocked && monitorTimer) {
    overlayCtx.fillStyle = "rgba(0,0,0,0.55)";
    overlayCtx.fillRect(8, 8, 150, 26);
    overlayCtx.fillStyle = "#fff";
    overlayCtx.font = "13px sans-serif";
    overlayCtx.fillText(`Bevegelse: ${Math.round(lastMotionScore)}%`, 14, 26);
  }
}

function pointerYToFraction(clientY) {
  const rect = overlayCanvas.getBoundingClientRect();
  const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
  return y / rect.height;
}

overlayCanvas.addEventListener("pointerdown", (e) => {
  if (lineLocked) return;
  dragging = true;
  lineFraction = pointerYToFraction(e.clientY);
  drawOverlay();
});

overlayCanvas.addEventListener("pointermove", (e) => {
  if (!dragging || lineLocked) return;
  lineFraction = pointerYToFraction(e.clientY);
  drawOverlay();
});

window.addEventListener("pointerup", () => {
  dragging = false;
});

lockLineBtn.addEventListener("click", () => {
  lineLocked = true;
  lockLineBtn.style.display = "none";
  unlockLineBtn.style.display = "inline-block";
  cameraHint.textContent =
    'Overvåker mållinja. Når noen krysser den fryses tiden automatisk, og du får en boks under der du bekrefter startnummeret.';
  startMonitoring();
});

unlockLineBtn.addEventListener("click", () => {
  lineLocked = false;
  unlockLineBtn.style.display = "none";
  lockLineBtn.style.display = "inline-block";
  cameraHint.textContent = "Dra den røde linja til den treffer mållinja i bildet, og lås den igjen.";
  stopMonitoring();
  drawOverlay();
});

// --- Motion detection ------------------------------------------------------

function startMonitoring() {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return;

  sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = 160;
  sampleCanvas.height = Math.round((160 * h) / w);
  sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  previousBand = null;
  cooldownUntil = 0;

  monitorTimer = setInterval(monitorTick, 120);
}

function stopMonitoring() {
  if (monitorTimer) clearInterval(monitorTimer);
  monitorTimer = null;
  previousBand = null;
}

function monitorTick() {
  if (!sampleCtx) return;
  sampleCtx.drawImage(video, 0, 0, sampleCanvas.width, sampleCanvas.height);

  const bandHeight = Math.max(3, Math.round(sampleCanvas.height * 0.06));
  const bandY = Math.min(
    Math.max(Math.round(lineFraction * sampleCanvas.height - bandHeight / 2), 0),
    sampleCanvas.height - bandHeight
  );
  const band = sampleCtx.getImageData(0, bandY, sampleCanvas.width, bandHeight);

  if (previousBand) {
    lastMotionScore = bandDiffScore(band.data, previousBand.data);
    drawOverlay();

    const now = Date.now();
    if (lastMotionScore > 8 && now >= cooldownUntil) {
      cooldownUntil = now + 1800;
      handleCrossingDetected();
    }
  }

  previousBand = band;
}

function bandDiffScore(a, b) {
  // Percentage of pixels in the band that changed significantly between two
  // samples. Averaging the raw diff over the whole band width dilutes a
  // narrow moving subject (a runner, or our synthetic bib) against a mostly
  // static background, so we count how much of the band actually changed
  // instead of how much it changed on average.
  let changed = 0;
  const len = Math.min(a.length, b.length);
  const pixelCount = len / 4;
  for (let i = 0; i < len; i += 4) {
    const diff = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    if (diff > 60) changed++;
  }
  return pixelCount > 0 ? (changed / pixelCount) * 100 : 0;
}

// --- Crossing → capture → OCR → confirm queue ------------------------------

function handleCrossingDetected() {
  const crossedAt = new Date();

  const captureCanvas = document.createElement("canvas");
  const maxWidth = 640;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  captureCanvas.width = Math.round(video.videoWidth * scale);
  captureCanvas.height = Math.round(video.videoHeight * scale);
  const captureCtx = captureCanvas.getContext("2d");
  captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);

  const entry = {
    id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random()),
    crossedAt,
    thumbSrc: captureCanvas.toDataURL("image/jpeg", 0.7),
    numberValue: "",
    ocrStatus: "pending",
  };
  pendingEntries.unshift(entry);
  renderPending();

  runOcr(captureCanvas, entry.id);
}

let tesseractLoadPromise = null;

function loadTesseractScript() {
  if (window.Tesseract) return Promise.resolve();
  if (!tesseractLoadPromise) {
    tesseractLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Kunne ikke laste OCR-biblioteket (nettverk?)."));
      document.head.appendChild(script);
    });
  }
  return tesseractLoadPromise;
}

// OCR is a best-effort convenience, never a requirement — the confirm queue
// always lets you type the startnummer by hand, so a slow/unreachable CDN
// (likely on venue wifi) must never block login, camera, or detection.
async function getOcrWorker() {
  if (ocrWorker) return ocrWorker;
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      await loadTesseractScript();
      const worker = await Tesseract.createWorker("eng");
      await worker.setParameters({ tessedit_char_whitelist: "0123456789" });
      ocrWorker = worker;
      return worker;
    })();
  }
  return ocrWorkerPromise;
}

async function runOcr(canvas, entryId) {
  try {
    const worker = await getOcrWorker();
    const {
      data: { text },
    } = await worker.recognize(canvas);
    const match = text.replace(/\s+/g, "").match(/\d+/);
    const entry = pendingEntries.find((e) => e.id === entryId);
    if (!entry) return;
    entry.ocrStatus = "done";
    if (match && !entry.numberEdited) {
      entry.numberValue = match[0];
    }
    renderPending();
  } catch (err) {
    const entry = pendingEntries.find((e) => e.id === entryId);
    if (entry) {
      entry.ocrStatus = "failed";
      renderPending();
    }
  }
}

function findMatch(numberValue) {
  const query = numberValue.trim();
  if (!query) return null;
  return participants.find((p) => p.startnummer === query) || null;
}

function renderPending() {
  pendingList.innerHTML = "";
  for (const entry of pendingEntries) {
    pendingList.appendChild(buildPendingCard(entry));
  }
}

function buildPendingCard(entry) {
  const card = document.createElement("div");
  card.className = "card pending-card";

  const thumb = document.createElement("img");
  thumb.className = "pending-thumb";
  thumb.src = entry.thumbSrc;
  thumb.alt = "Bilde av kryssingen";
  card.appendChild(thumb);

  const info = document.createElement("div");
  info.className = "pending-info";

  const time = document.createElement("div");
  time.className = "pending-time";
  time.textContent = raceStartTime
    ? fcFormatClock(Math.max(0, (entry.crossedAt.getTime() - new Date(raceStartTime).getTime()) / 1000))
    : entry.crossedAt.toLocaleTimeString("nb-NO");
  info.appendChild(time);

  const numberField = document.createElement("input");
  numberField.type = "text";
  numberField.inputMode = "numeric";
  numberField.className = "edit-input startnr-input";
  numberField.placeholder = entry.ocrStatus === "pending" ? "Leser…" : "Startnr";
  numberField.value = entry.numberValue;
  info.appendChild(numberField);

  const lookup = document.createElement("div");
  lookup.className = "pending-lookup";
  info.appendChild(lookup);

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "btn btn-mal";
  confirmBtn.textContent = "✅ Bekreft";

  function updateLookup() {
    const match = findMatch(numberField.value);
    if (!match) {
      lookup.textContent = numberField.value.trim()
        ? "Ingen deltaker med dette startnummeret."
        : "Skriv inn startnummer.";
      lookup.className = "pending-lookup warn";
      confirmBtn.disabled = true;
    } else if (match.ovelse === "Konkurranse med tid" ? match.tid : match.fullfort) {
      lookup.textContent = `#${match.startnummer} ${match.fornavn} ${match.etternavn} er allerede registrert.`;
      lookup.className = "pending-lookup warn";
      confirmBtn.disabled = true;
    } else {
      lookup.textContent = `${match.fornavn} ${match.etternavn} · ${match.ovelse}`;
      lookup.className = "pending-lookup ok";
      confirmBtn.disabled = false;
    }
  }

  numberField.addEventListener("input", () => {
    entry.numberValue = numberField.value;
    entry.numberEdited = true;
    updateLookup();
  });

  confirmBtn.addEventListener("click", async () => {
    const match = findMatch(numberField.value);
    if (!match) return;
    confirmBtn.disabled = true;
    const res = await authFetch(`/api/participants/${match.id}/mal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tidspunkt: entry.crossedAt.toISOString() }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status !== 401) alert(body.error || "Kunne ikke registrere mål.");
      confirmBtn.disabled = false;
      return;
    }
    const updated = await res.json();
    const idx = participants.findIndex((p) => p.id === match.id);
    if (idx !== -1) participants[idx] = updated;
    pendingEntries = pendingEntries.filter((e) => e.id !== entry.id);
    renderPending();
  });

  const discardBtn = document.createElement("button");
  discardBtn.type = "button";
  discardBtn.className = "btn btn-ghost btn-small";
  discardBtn.textContent = "✕ Forkast";
  discardBtn.addEventListener("click", () => {
    pendingEntries = pendingEntries.filter((e) => e.id !== entry.id);
    renderPending();
  });

  const actions = document.createElement("div");
  actions.className = "pending-actions";
  actions.appendChild(confirmBtn);
  actions.appendChild(discardBtn);

  card.appendChild(info);
  card.appendChild(actions);

  updateLookup();
  return card;
}

init();
