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
const tabVenterBtn = document.getElementById("tabVenterBtn");
const tabIMalBtn = document.getElementById("tabIMalBtn");
const ventendeCount = document.getElementById("ventendeCount");
const iMalCount = document.getElementById("iMalCount");

let participants = [];
let credentials = null;
let raceStartTime = null;
let activeTab = "venter";

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
  render();
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
  render();
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

function isFinished(p) {
  return p.ovelse === "Konkurranse med tid" ? !!p.tid : !!p.fullfort;
}

function sortByStartnummer(list) {
  return [...list].sort((a, b) => {
    const an = parseInt(a.startnummer, 10);
    const bn = parseInt(b.startnummer, 10);
    if (!isNaN(an) && !isNaN(bn) && an !== bn) return an - bn;
    return String(a.startnummer).localeCompare(String(b.startnummer), "nb");
  });
}

function getFilteredList(finished) {
  const query = startnrInput.value.trim().toLowerCase();
  return sortByStartnummer(
    participants.filter((p) => {
      if (!p.startnummer) return false;
      if (isFinished(p) !== finished) return false;
      if (ovelseFilter.value && p.ovelse !== ovelseFilter.value) return false;
      if (query && !p.startnummer.toLowerCase().startsWith(query)) return false;
      return true;
    })
  );
}

function setActiveTab(tab) {
  activeTab = tab;
  tabVenterBtn.classList.toggle("tab-btn-active", tab === "venter");
  tabIMalBtn.classList.toggle("tab-btn-active", tab === "imal");
  render();
}

tabVenterBtn.addEventListener("click", () => setActiveTab("venter"));
tabIMalBtn.addEventListener("click", () => setActiveTab("imal"));

function render() {
  const venter = getFilteredList(false);
  const iMal = getFilteredList(true);
  ventendeCount.textContent = `(${venter.length})`;
  iMalCount.textContent = `(${iMal.length})`;

  const list = activeTab === "venter" ? venter : iMal;
  searchResults.innerHTML = "";

  if (list.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.style.display = "block";
    empty.textContent =
      activeTab === "venter" ? "Ingen venter på mål (med disse filtrene)." : "Ingen registrert i mål enda.";
    searchResults.appendChild(empty);
    return;
  }

  for (const p of list) {
    searchResults.appendChild(buildResultCard(p, activeTab === "imal"));
  }
}

function buildResultCard(p, finished) {
  const card = document.createElement("div");
  card.className = "card result-card" + (finished ? " result-card-finished" : "");

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

  card.appendChild(info);

  if (!finished) {
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
  } else {
    const actions = document.createElement("div");
    actions.className = "result-card-actions";

    const result = document.createElement("div");
    result.className = "result-card-result";
    result.textContent = p.ovelse === "Konkurranse med tid" ? p.tid : "Fullført";
    actions.appendChild(result);

    const undoBtn = document.createElement("button");
    undoBtn.type = "button";
    undoBtn.className = "undo-btn";
    undoBtn.title = "Angre";
    undoBtn.textContent = "↺";
    undoBtn.addEventListener("click", () => handleUndo(p));
    actions.appendChild(undoBtn);

    card.appendChild(actions);
  }

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

  const resultText = updated.ovelse === "Konkurranse med tid" ? updated.tid : "Fullført";
  showConfirmation(`✅ #${updated.startnummer} ${updated.fornavn} ${updated.etternavn} – ${resultText} registrert!`);

  startnrInput.value = "";
  render();
  startnrInput.focus();
}

async function handleUndo(p) {
  const patch = p.ovelse === "Konkurranse med tid" ? { tid: null } : { fullfort: false };
  const res = await authFetch(`/api/participants/${p.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    if (res.status !== 401) alert("Kunne ikke angre registrering.");
    return;
  }
  const updated = await res.json();
  const idx = participants.findIndex((x) => x.id === p.id);
  if (idx !== -1) participants[idx] = updated;
  render();
}

function showConfirmation(text) {
  confirmBanner.textContent = text;
  confirmBanner.style.display = "block";
  clearTimeout(showConfirmation._timer);
  showConfirmation._timer = setTimeout(() => {
    confirmBanner.style.display = "none";
  }, 4000);
}

startnrInput.addEventListener("input", render);
ovelseFilter.addEventListener("change", render);

startnrInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const matches = getFilteredList(false);
  if (matches.length === 1) {
    handleFinish(matches[0].id);
  }
});

init();
