const STORAGE_KEY = "foxClassicArrangorCredentials";

const loginCard = document.getElementById("loginCard");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const brukernavnInput = document.getElementById("brukernavnInput");
const passordInput = document.getElementById("passordInput");
const mainContent = document.getElementById("mainContent");
const logoutBtn = document.getElementById("logoutBtn");

const form = document.getElementById("registrationForm");
const formMessage = document.getElementById("formMessage");
const fornavnInput = document.getElementById("fornavn");
const filterKjonn = document.getElementById("filterKjonn");
const filterOvelse = document.getElementById("filterOvelse");
const exportBtn = document.getElementById("exportBtn");
const deleteAllBtn = document.getElementById("deleteAllBtn");
const participantsBody = document.getElementById("participantsBody");
const participantsTable = document.getElementById("participantsTable");
const emptyState = document.getElementById("emptyState");
const counts = document.getElementById("counts");
const resultsContainer = document.getElementById("resultsContainer");
const raceClockTime = document.getElementById("raceClockTime");
const startRaceBtn = document.getElementById("startRaceBtn");
const resetRaceBtn = document.getElementById("resetRaceBtn");
const raceClockHint = document.getElementById("raceClockHint");
const overrideTimeInput = document.getElementById("overrideTimeInput");
const overrideTimeBtn = document.getElementById("overrideTimeBtn");

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
  render();
}

function updateRaceClockUI() {
  if (raceStartTime) {
    startRaceBtn.style.display = "none";
    resetRaceBtn.style.display = "inline-block";
    raceClockHint.textContent = "Løpet er i gang. Trykk «🏁 Mål» per deltaker i lista under når de kommer i mål.";
    const elapsedSeconds = Math.max(0, (Date.now() - new Date(raceStartTime).getTime()) / 1000);
    raceClockTime.textContent = fcFormatClock(elapsedSeconds);
  } else {
    startRaceBtn.style.display = "inline-block";
    resetRaceBtn.style.display = "none";
    raceClockTime.textContent = "–";
    raceClockHint.textContent = 'Trykk «🏁 Start løpet» når konkurranseklassen starter (planlagt kl. 11:00).';
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
  render();
});

resetRaceBtn.addEventListener("click", async () => {
  if (!confirm("Nullstille starttidspunktet for løpet?")) return;
  const res = await authFetch("/api/race/reset", { method: "POST" });
  if (!res.ok) return;
  const race = await res.json();
  raceStartTime = race.startTime;
  updateRaceClockUI();
  render();
});

overrideTimeBtn.addEventListener("click", async () => {
  const startTime = fcTimeInputToDate(overrideTimeInput.value);
  if (!startTime) {
    alert("Angi et gyldig klokkeslett.");
    return;
  }
  const res = await authFetch("/api/race/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startTime: startTime.toISOString() }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    alert(body.error || "Kunne ikke sette starttid.");
    return;
  }
  const race = await res.json();
  raceStartTime = race.startTime;
  overrideTimeInput.value = "";
  updateRaceClockUI();
  render();
});

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
  render();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const kjonnInput = form.querySelector('input[name="kjonn"]:checked');
  const ovelseInput = form.querySelector('input[name="ovelse"]:checked');

  const payload = {
    fornavn: fornavnInput.value.trim(),
    etternavn: document.getElementById("etternavn").value.trim(),
    klubb: document.getElementById("klubb").value.trim(),
    kjonn: kjonnInput ? kjonnInput.value : "",
    ovelse: ovelseInput ? ovelseInput.value : "",
  };

  const res = await fetch("/api/participants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    showFormMessage(body.error || "Noe gikk galt. Prøv igjen.", true);
    return;
  }

  const [created] = await res.json();
  participants.push(created);
  render();

  const kjonnValue = payload.kjonn;
  const ovelseValue = payload.ovelse;
  form.reset();
  form.querySelector(`input[name="kjonn"][value="${CSS.escape(kjonnValue)}"]`).checked = true;
  form.querySelector(`input[name="ovelse"][value="${CSS.escape(ovelseValue)}"]`).checked = true;
  showFormMessage(`🦊 ${payload.fornavn} ${payload.etternavn} er meldt på og klar for løypa!`, false);
  fornavnInput.focus();
});

function showFormMessage(text, isError) {
  formMessage.textContent = text;
  formMessage.className = "form-message" + (isError ? " error" : " success");
}

filterKjonn.addEventListener("change", render);
filterOvelse.addEventListener("change", render);

exportBtn.addEventListener("click", () => {
  const params = new URLSearchParams();
  if (filterKjonn.value) params.set("kjonn", filterKjonn.value);
  if (filterOvelse.value) params.set("ovelse", filterOvelse.value);
  window.location.href = "/api/export?" + params.toString();
});

async function handleEdit(id, patch) {
  const res = await authFetch(`/api/participants/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status !== 401) alert(body.error || "Kunne ikke lagre endringen.");
    return;
  }
  const updated = await res.json();
  const idx = participants.findIndex((p) => p.id === id);
  if (idx !== -1) participants[idx] = updated;
  render();
}

async function handleDelete(id) {
  const res = await authFetch(`/api/participants/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 401) {
    alert("Kunne ikke fjerne deltaker.");
    return;
  }
  if (res.ok) {
    participants = participants.filter((p) => p.id !== id);
    render();
  }
}

deleteAllBtn.addEventListener("click", async () => {
  if (participants.length === 0) return;
  const count = participants.length;
  if (!confirm(`Slette ALLE ${count} deltakere fra påmeldingslisten? Dette kan ikke angres.`)) return;

  const res = await authFetch("/api/participants", { method: "DELETE" });
  if (!res.ok && res.status !== 401) {
    alert("Kunne ikke slette deltakere.");
    return;
  }
  if (res.ok) {
    participants = [];
    render();
  }
});

function render() {
  const filtered = fcFilterParticipants(participants, filterKjonn.value, filterOvelse.value);

  if (filtered.length === 0) {
    participantsTable.style.display = "none";
    participantsBody.innerHTML = "";
    emptyState.style.display = "block";
  } else {
    participantsTable.style.display = "table";
    emptyState.style.display = "none";
    fcRenderTable(participantsBody, filtered, {
      editable: true,
      onEdit: handleEdit,
      onDelete: handleDelete,
      onFinish: handleFinish,
      raceStarted: !!raceStartTime,
    });
  }

  const c = fcCounts(filtered);
  counts.textContent = `Totalt: ${c.total} · Trim: ${c.trim} · Konkurranse: ${c.konkurranse} · Tilskuer: ${c.tilskuer}`;

  fcRenderResults(resultsContainer, participants);
}

init();
