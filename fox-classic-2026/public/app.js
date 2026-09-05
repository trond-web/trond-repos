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
const mascotWrap = document.getElementById("mascotWrap");

let participants = [];

function celebrateMascot() {
  if (!mascotWrap) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  mascotWrap.classList.remove("celebrate");
  void mascotWrap.offsetWidth; // restart the animation even if it's already running
  mascotWrap.classList.add("celebrate");
}

if (mascotWrap) {
  mascotWrap.addEventListener("animationend", (e) => {
    if (e.target === mascotWrap) mascotWrap.classList.remove("celebrate");
  });
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
    showMessage(body.error || "Noe gikk galt. Prøv igjen.", true);
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
  showMessage(`🦊 ${payload.fornavn} ${payload.etternavn} er meldt på og klar for løypa!`, false);
  celebrateMascot();
  fornavnInput.focus();
});

function showMessage(text, isError) {
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

function render() {
  const filtered = fcFilterParticipants(participants, filterKjonn.value, filterOvelse.value);

  if (filtered.length === 0) {
    participantsTable.style.display = "none";
    participantsBody.innerHTML = "";
    emptyState.style.display = "block";
  } else {
    participantsTable.style.display = "table";
    emptyState.style.display = "none";
    fcRenderTable(participantsBody, filtered, { editable: false });
  }

  const c = fcCounts(filtered);
  counts.textContent = `Totalt: ${c.total} · Trim: ${c.trim} · Konkurranse: ${c.konkurranse} · Tilskuer: ${c.tilskuer}`;

  fcRenderResults(resultsContainer, participants);
}

loadParticipants();
