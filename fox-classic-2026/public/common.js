async function fcFetchParticipants() {
  const res = await fetch("/api/participants");
  return res.json();
}

function fcFormatRegistrert(iso) {
  return new Date(iso).toLocaleString("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fcFilterParticipants(participants, filterKjonn, filterOvelse) {
  return participants.filter((p) => {
    if (filterKjonn && p.kjonn !== filterKjonn) return false;
    if (filterOvelse && p.ovelse !== filterOvelse) return false;
    return true;
  });
}

function fcSortByName(list) {
  return [...list].sort(
    (a, b) => a.etternavn.localeCompare(b.etternavn, "nb") || a.fornavn.localeCompare(b.fornavn, "nb")
  );
}

function fcCounts(participants) {
  return {
    total: participants.length,
    trim: participants.filter((p) => p.ovelse === "Trim uten tid").length,
    konkurranse: participants.filter((p) => p.ovelse === "Konkurranse med tid").length,
  };
}

/**
 * Renders the participants table.
 * options.editable: boolean — show edit fields + delete button
 * options.onEdit(id, patch): async callback for field edits
 * options.onDelete(id): async callback for delete
 */
function fcRenderTable(tbody, participants, options) {
  const editable = !!options.editable;
  tbody.innerHTML = "";

  for (const p of fcSortByName(participants)) {
    const row = document.createElement("tr");

    row.appendChild(fcTextOrEditCell(p, "fornavn", editable, options));
    row.appendChild(fcTextOrEditCell(p, "etternavn", editable, options));
    row.appendChild(fcSelectOrTextCell(p, "kjonn", ["Mann", "Kvinne"], editable, options));
    row.appendChild(
      fcSelectOrTextCell(p, "ovelse", ["Trim uten tid", "Konkurranse med tid"], editable, options)
    );
    row.appendChild(fcTidCell(p, editable, options));

    if (editable) {
      const deleteCell = document.createElement("td");
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-btn";
      deleteBtn.textContent = "✕";
      deleteBtn.title = "Fjern deltaker";
      deleteBtn.addEventListener("click", async () => {
        if (!confirm(`Fjerne ${p.fornavn} ${p.etternavn} fra påmeldingslisten?`)) return;
        await options.onDelete(p.id);
      });
      deleteCell.appendChild(deleteBtn);
      row.appendChild(deleteCell);
    }

    tbody.appendChild(row);
  }
}

function fcTextOrEditCell(p, field, editable, options) {
  const td = document.createElement("td");
  if (!editable) {
    td.textContent = p[field];
    return td;
  }
  const input = document.createElement("input");
  input.type = "text";
  input.className = "edit-input";
  input.value = p[field];
  input.addEventListener("change", async () => {
    const value = input.value.trim();
    if (!value) {
      input.value = p[field];
      return;
    }
    await options.onEdit(p.id, { [field]: value });
  });
  td.appendChild(input);
  return td;
}

function fcSelectOrTextCell(p, field, values, editable, options) {
  const td = document.createElement("td");
  if (!editable) {
    td.textContent = p[field];
    return td;
  }
  const select = document.createElement("select");
  select.className = "edit-select";
  for (const value of values) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    if (value === p[field]) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener("change", async () => {
    await options.onEdit(p.id, { [field]: select.value });
  });
  td.appendChild(select);
  return td;
}

function fcTidCell(p, editable, options) {
  const td = document.createElement("td");
  if (p.ovelse !== "Konkurranse med tid") {
    td.textContent = "–";
    return td;
  }
  if (!editable) {
    td.textContent = p.tid || "–";
    return td;
  }
  const input = document.createElement("input");
  input.type = "text";
  input.className = "tid-input";
  input.placeholder = "tt:mm:ss";
  input.value = p.tid || "";
  input.addEventListener("change", async () => {
    await options.onEdit(p.id, { tid: input.value.trim() || null });
  });
  td.appendChild(input);
  return td;
}

function fcRenderResults(container, participants) {
  container.innerHTML = "";
  const finished = participants
    .filter((p) => p.ovelse === "Konkurranse med tid" && p.tid)
    .sort((a, b) => fcTidToSeconds(a.tid) - fcTidToSeconds(b.tid));
  const waiting = participants.filter((p) => p.ovelse === "Konkurranse med tid" && !p.tid);

  if (finished.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.style.display = "block";
    empty.textContent = "Ingen resultater enda – de raskeste revene er fortsatt ute i skogen. 🌲🦊";
    container.appendChild(empty);
  } else {
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const heading of ["Plass", "Fornavn", "Etternavn", "Kjønn", "Tid"]) {
      const th = document.createElement("th");
      th.textContent = heading;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    finished.forEach((p, i) => {
      const row = document.createElement("tr");
      for (const value of [i + 1, p.fornavn, p.etternavn, p.kjonn, p.tid]) {
        const td = document.createElement("td");
        td.textContent = value;
        row.appendChild(td);
      }
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  if (waiting.length > 0) {
    const note = document.createElement("p");
    note.className = "form-hint";
    note.textContent = `${waiting.length} deltaker(e) i konkurranseklassen venter fortsatt på registrert tid.`;
    container.appendChild(note);
  }
}

function fcTidToSeconds(tid) {
  const parts = tid.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}
