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
    tilskuer: participants.filter((p) => p.ovelse === "Tilskuer").length,
  };
}

/**
 * Renders the participants table.
 * options.editable: boolean — show edit fields + delete button
 * options.onEdit(id, patch): async callback for field edits
 * options.onDelete(id): async callback for delete
 * options.onFinish(id): async callback for the "Mål" button (arrangør only)
 * options.raceStarted: boolean — gates the Mål button for timed participants
 */
function fcRenderTable(tbody, participants, options) {
  const editable = !!options.editable;
  tbody.innerHTML = "";

  for (const p of fcSortByName(participants)) {
    const row = document.createElement("tr");

    row.appendChild(fcStartnummerCell(p, editable, options));
    row.appendChild(fcTextOrEditCell(p, "fornavn", editable, options, true));
    row.appendChild(fcTextOrEditCell(p, "etternavn", editable, options, true));
    row.appendChild(fcKlubbCell(p, editable, options));
    row.appendChild(fcSelectOrTextCell(p, "kjonn", ["Mann", "Kvinne"], editable, options));
    row.appendChild(
      fcSelectOrTextCell(p, "ovelse", ["Trim uten tid", "Konkurranse med tid", "Tilskuer"], editable, options)
    );
    row.appendChild(fcStatusCell(p, editable, options));

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

function fcTextOrEditCell(p, field, editable, options, required) {
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
    if (required && !value) {
      input.value = p[field];
      return;
    }
    await options.onEdit(p.id, { [field]: value });
  });
  td.appendChild(input);
  return td;
}

function fcStartnummerCell(p, editable, options) {
  const td = document.createElement("td");
  if (!editable) {
    td.textContent = p.startnummer || "–";
    return td;
  }
  const input = document.createElement("input");
  input.type = "text";
  input.className = "edit-input startnr-input";
  input.placeholder = "Startnr";
  input.value = p.startnummer || "";
  input.addEventListener("change", async () => {
    await options.onEdit(p.id, { startnummer: input.value.trim() });
  });
  td.appendChild(input);
  return td;
}

function fcKlubbCell(p, editable, options) {
  const td = document.createElement("td");
  if (!editable) {
    td.textContent = p.klubb || "–";
    return td;
  }
  const input = document.createElement("input");
  input.type = "text";
  input.className = "edit-input";
  input.placeholder = "Klubb/team";
  input.value = p.klubb || "";
  input.addEventListener("change", async () => {
    await options.onEdit(p.id, { klubb: input.value.trim() });
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

function fcStatusCell(p, editable, options) {
  const td = document.createElement("td");
  const isTimed = p.ovelse === "Konkurranse med tid";

  if (!editable) {
    if (isTimed) {
      td.textContent = p.tid || "–";
    } else {
      td.textContent = p.fullfort ? "Fullført" : "–";
    }
    return td;
  }

  const wrap = document.createElement("div");
  wrap.className = "status-cell";

  if (isTimed) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "tid-input";
    input.placeholder = "tt:mm:ss";
    input.value = p.tid || "";
    input.addEventListener("change", async () => {
      await options.onEdit(p.id, { tid: input.value.trim() || null });
    });
    wrap.appendChild(input);

    const malBtn = document.createElement("button");
    malBtn.type = "button";
    malBtn.className = "btn btn-mal";
    malBtn.textContent = "🏁 Mål";
    malBtn.disabled = !options.raceStarted;
    malBtn.title = options.raceStarted ? "Registrer måltid nå" : "Løpet er ikke startet ennå";
    malBtn.addEventListener("click", () => options.onFinish(p.id));
    wrap.appendChild(malBtn);
  } else if (p.fullfort) {
    const badge = document.createElement("span");
    badge.className = "fullfort-badge";
    badge.textContent = "✅ Fullført";
    wrap.appendChild(badge);

    const undoBtn = document.createElement("button");
    undoBtn.type = "button";
    undoBtn.className = "undo-btn";
    undoBtn.title = "Angre fullført";
    undoBtn.textContent = "↺";
    undoBtn.addEventListener("click", () => options.onEdit(p.id, { fullfort: false }));
    wrap.appendChild(undoBtn);
  } else {
    const malBtn = document.createElement("button");
    malBtn.type = "button";
    malBtn.className = "btn btn-mal";
    malBtn.textContent = "🏁 Mål";
    malBtn.title = "Marker som fullført";
    malBtn.addEventListener("click", () => options.onFinish(p.id));
    wrap.appendChild(malBtn);
  }

  td.appendChild(wrap);
  return td;
}

function fcRenderResults(container, participants, filterKjonn) {
  container.innerHTML = "";
  const inClass = (p) =>
    p.ovelse === "Konkurranse med tid" && (!filterKjonn || p.kjonn === filterKjonn);
  const finished = participants
    .filter((p) => inClass(p) && p.tid)
    .sort((a, b) => fcTidToSeconds(a.tid) - fcTidToSeconds(b.tid));
  const waiting = participants.filter((p) => inClass(p) && !p.tid);

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
    for (const heading of ["Plass", "Startnr", "Fornavn", "Etternavn", "Klubb", "Kjønn", "Tid"]) {
      const th = document.createElement("th");
      th.textContent = heading;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    finished.forEach((p, i) => {
      const row = document.createElement("tr");
      for (const value of [i + 1, p.startnummer || "–", p.fornavn, p.etternavn, p.klubb || "–", p.kjonn, p.tid]) {
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

function fcFormatClock(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
