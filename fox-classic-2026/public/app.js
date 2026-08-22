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

let participants = [];

async function loadParticipants() {
  const res = await fetch("/api/participants");
  participants = await res.json();
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
  showMessage(`${payload.fornavn} ${payload.etternavn} er meldt på!`, false);
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

function getFiltered() {
  return participants.filter((p) => {
    if (filterKjonn.value && p.kjonn !== filterKjonn.value) return false;
    if (filterOvelse.value && p.ovelse !== filterOvelse.value) return false;
    return true;
  });
}

function render() {
  const filtered = getFiltered();
  participantsBody.innerHTML = "";

  if (filtered.length === 0) {
    participantsTable.style.display = "none";
    emptyState.style.display = "block";
  } else {
    participantsTable.style.display = "table";
    emptyState.style.display = "none";

    const sorted = [...filtered].sort(
      (a, b) => a.etternavn.localeCompare(b.etternavn, "nb") || a.fornavn.localeCompare(b.fornavn, "nb")
    );

    for (const p of sorted) {
      const row = document.createElement("tr");

      row.appendChild(cell(p.fornavn));
      row.appendChild(cell(p.etternavn));
      row.appendChild(cell(p.kjonn));
      row.appendChild(cell(p.ovelse));
      row.appendChild(tidCell(p));

      const deleteCell = document.createElement("td");
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-btn";
      deleteBtn.textContent = "✕";
      deleteBtn.title = "Fjern deltaker";
      deleteBtn.addEventListener("click", () => deleteParticipant(p.id));
      deleteCell.appendChild(deleteBtn);
      row.appendChild(deleteCell);

      participantsBody.appendChild(row);
    }
  }

  renderCounts();
}

function cell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

function tidCell(p) {
  const td = document.createElement("td");
  if (p.ovelse !== "Konkurranse med tid") {
    td.textContent = "–";
    return td;
  }
  const input = document.createElement("input");
  input.type = "text";
  input.className = "tid-input";
  input.placeholder = "tt:mm:ss";
  input.value = p.tid || "";
  input.addEventListener("change", () => saveTid(p.id, input));
  td.appendChild(input);
  return td;
}

async function saveTid(id, input) {
  const res = await fetch(`/api/participants/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tid: input.value.trim() || null }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    alert(body.error || "Kunne ikke lagre tid.");
    return;
  }
  const updated = await res.json();
  const idx = participants.findIndex((p) => p.id === id);
  if (idx !== -1) participants[idx] = updated;
}

async function deleteParticipant(id) {
  const participant = participants.find((p) => p.id === id);
  if (!participant) return;
  if (!confirm(`Fjerne ${participant.fornavn} ${participant.etternavn} fra påmeldingslisten?`)) return;

  const res = await fetch(`/api/participants/${id}`, { method: "DELETE" });
  if (!res.ok) {
    alert("Kunne ikke fjerne deltaker.");
    return;
  }
  participants = participants.filter((p) => p.id !== id);
  render();
}

function renderCounts() {
  const filtered = getFiltered();
  const trim = filtered.filter((p) => p.ovelse === "Trim uten tid").length;
  const konkurranse = filtered.filter((p) => p.ovelse === "Konkurranse med tid").length;
  counts.textContent = `Totalt: ${filtered.length} · Trim: ${trim} · Konkurranse: ${konkurranse}`;
}

loadParticipants();
