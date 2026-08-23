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

const startnrInput = document.getElementById("startnrInput");
const ovelseFilter = document.getElementById("ovelseFilter");
const searchResults = document.getElementById("searchResults");
const confirmBanner = document.getElementById("confirmBanner");

let participants = [];
let credentials = null;
let raceStartTime = null;

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
  startnrInput.focus();
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
  renderSearch();
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
  renderSearch();
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

function getMatches() {
  const query = startnrInput.value.trim().toLowerCase();
  if (!query) return [];
  return participants.filter((p) => {
    if (!p.startnummer) return false;
    if (!p.startnummer.toLowerCase().startsWith(query)) return false;
    if (ovelseFilter.value && p.ovelse !== ovelseFilter.value) return false;
    return true;
  });
}

function renderSearch() {
  const matches = getMatches();
  searchResults.innerHTML = "";

  if (startnrInput.value.trim() === "") return;

  if (matches.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.style.display = "block";
    empty.textContent = "Ingen deltaker med det startnummeret.";
    searchResults.appendChild(empty);
    return;
  }

  for (const p of matches) {
    searchResults.appendChild(buildResultCard(p));
  }
}

function buildResultCard(p) {
  const card = document.createElement("div");
  card.className = "card result-card";

  const info = document.createElement("div");
  info.className = "result-card-info";

  const name = document.createElement("div");
  name.className = "result-card-name";
  name.textContent = `#${p.startnummer} – ${p.fornavn} ${p.etternavn}`;
  info.appendChild(name);

  const meta = document.createElement("div");
  meta.className = "result-card-meta";
  const metaParts = [p.ovelse];
  if (p.klubb) metaParts.push(p.klubb);
  meta.textContent = metaParts.join(" · ");
  info.appendChild(meta);

  const status = document.createElement("div");
  status.className = "result-card-status";
  if (p.ovelse === "Konkurranse med tid") {
    status.textContent = p.tid ? `Registrert: ${p.tid}` : "Venter på måltid";
  } else {
    status.textContent = p.fullfort ? "Registrert: Fullført" : "Venter på registrering";
  }
  info.appendChild(status);

  card.appendChild(info);

  const isTimed = p.ovelse === "Konkurranse med tid";
  const malBtn = document.createElement("button");
  malBtn.type = "button";
  malBtn.className = "btn btn-mal btn-mal-big";
  malBtn.textContent = "🏁 Mål";
  if (isTimed && !raceStartTime) {
    malBtn.disabled = true;
    malBtn.title = "Løpet er ikke startet ennå";
  }
  malBtn.addEventListener("click", () => handleFinish(p.id));
  card.appendChild(malBtn);

  return card;
}

async function handleFinish(id) {
  const res = await authFetch(`/api/participants/${id}/mal`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status !== 401) alert(body.error || "Kunne ikke registrere mål.");
    return;
  }
  const updated = await res.json();
  const idx = participants.findIndex((p) => p.id === id);
  if (idx !== -1) participants[idx] = updated;

  const resultText =
    updated.ovelse === "Konkurranse med tid" ? updated.tid : "Fullført";
  showConfirmation(`✅ #${updated.startnummer} ${updated.fornavn} ${updated.etternavn} – ${resultText} registrert!`);

  startnrInput.value = "";
  renderSearch();
  startnrInput.focus();
}

function showConfirmation(text) {
  confirmBanner.textContent = text;
  confirmBanner.style.display = "block";
  clearTimeout(showConfirmation._timer);
  showConfirmation._timer = setTimeout(() => {
    confirmBanner.style.display = "none";
  }, 4000);
}

startnrInput.addEventListener("input", renderSearch);
ovelseFilter.addEventListener("change", renderSearch);

startnrInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const matches = getMatches();
  if (matches.length === 1) {
    handleFinish(matches[0].id);
  }
});

init();
