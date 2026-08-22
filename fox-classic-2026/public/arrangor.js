const STORAGE_KEY = "foxClassicArrangorPassord";

const loginCard = document.getElementById("loginCard");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const passordInput = document.getElementById("passordInput");
const mainContent = document.getElementById("mainContent");
const logoutBtn = document.getElementById("logoutBtn");

const form = document.getElementById("registrationForm");
const formMessage = document.getElementById("formMessage");
const fornavnInput = document.getElementById("fornavn");
const filterKjonn = document.getElementById("filterKjonn");
const filterOvelse = document.getElementById("filterOvelse");
const exportBtn = document.getElementById("exportBtn");
const participantsBody = document.getElementById("participantsBody");
const participantsTable = document.getElementById("participantsTable");
const emptyState = document.getElementById("emptyState");
const counts = document.getElementById("counts");
const resultsContainer = document.getElementById("resultsContainer");

let participants = [];
let passord = null;

async function init() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    showLogin();
    return;
  }
  const res = await fetch("/api/arrangor/verify", {
    headers: { "x-arrangor-passord": stored },
  });
  if (res.ok) {
    passord = stored;
    showMain();
  } else {
    localStorage.removeItem(STORAGE_KEY);
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
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const candidate = passordInput.value;
  const res = await fetch("/api/arrangor/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passord: candidate }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    loginMessage.textContent = body.error || "Kunne ikke logge inn.";
    loginMessage.className = "form-message error";
    return;
  }
  passord = candidate;
  localStorage.setItem(STORAGE_KEY, candidate);
  passordInput.value = "";
  loginMessage.textContent = "";
  showMain();
});

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  passord = null;
  showLogin();
});

async function authFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), "x-arrangor-passord": passord },
  });
  if (res.status === 401) {
    localStorage.removeItem(STORAGE_KEY);
    passord = null;
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

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const kjonnInput = form.querySelector('input[name="kjonn"]:checked');
  const ovelseInput = form.querySelector('input[name="ovelse"]:checked');

  const payload = {
    fornavn: fornavnInput.value.trim(),
    etternavn: document.getElementById("etternavn").value.trim(),
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
  showFormMessage(`${payload.fornavn} ${payload.etternavn} er meldt på!`, false);
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

function render() {
  const filtered = fcFilterParticipants(participants, filterKjonn.value, filterOvelse.value);

  if (filtered.length === 0) {
    participantsTable.style.display = "none";
    emptyState.style.display = "block";
  } else {
    participantsTable.style.display = "table";
    emptyState.style.display = "none";
    fcRenderTable(participantsBody, filtered, {
      editable: true,
      onEdit: handleEdit,
      onDelete: handleDelete,
    });
  }

  const c = fcCounts(filtered);
  counts.textContent = `Totalt: ${c.total} · Trim: ${c.trim} · Konkurranse: ${c.konkurranse}`;

  fcRenderResults(resultsContainer, participants);
}

init();
