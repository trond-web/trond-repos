const fs = require("fs");
const path = require("path");
const express = require("express");
const ExcelJS = require("exceljs");

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "participants.json");

const KJONN_VALUES = ["Mann", "Kvinne"];
const OVELSE_VALUES = ["Trim uten tid", "Konkurranse med tid"];
const TID_PATTERN = /^([0-9]{1,2}:)?[0-5]?[0-9]:[0-5][0-9]$/;

function loadParticipants() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

function saveParticipants(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

let participants = loadParticipants();

function validateParticipant(body) {
  const fornavn = String(body.fornavn || "").trim();
  const etternavn = String(body.etternavn || "").trim();
  const kjonn = String(body.kjonn || "").trim();
  const ovelse = String(body.ovelse || "").trim();

  if (!fornavn) return "Fornavn er påkrevd.";
  if (!etternavn) return "Etternavn er påkrevd.";
  if (!KJONN_VALUES.includes(kjonn)) return "Kjønn må være Mann eller Kvinne.";
  if (!OVELSE_VALUES.includes(ovelse)) {
    return "Øvelse må være Trim uten tid eller Konkurranse med tid.";
  }
  return null;
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/participants", (req, res) => {
  res.json(participants);
});

app.post("/api/participants", (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  if (items.length === 0) {
    return res.status(400).json({ error: "Ingen deltakere å registrere." });
  }

  for (const item of items) {
    const error = validateParticipant(item);
    if (error) return res.status(400).json({ error });
  }

  const created = items.map((item) => ({
    id: crypto.randomUUID(),
    fornavn: String(item.fornavn).trim(),
    etternavn: String(item.etternavn).trim(),
    kjonn: String(item.kjonn).trim(),
    ovelse: String(item.ovelse).trim(),
    tid: null,
    registrertTidspunkt: new Date().toISOString(),
  }));

  participants = participants.concat(created);
  saveParticipants(participants);
  res.status(201).json(created);
});

app.patch("/api/participants/:id", (req, res) => {
  const participant = participants.find((p) => p.id === req.params.id);
  if (!participant) {
    return res.status(404).json({ error: "Fant ikke deltaker." });
  }

  if ("tid" in req.body) {
    const tid = req.body.tid === null ? null : String(req.body.tid).trim();
    if (tid !== null && tid !== "" && !TID_PATTERN.test(tid)) {
      return res.status(400).json({ error: "Tid må være på format tt:mm:ss eller mm:ss." });
    }
    participant.tid = tid || null;
  }

  saveParticipants(participants);
  res.json(participant);
});

app.delete("/api/participants/:id", (req, res) => {
  const before = participants.length;
  participants = participants.filter((p) => p.id !== req.params.id);
  if (participants.length === before) {
    return res.status(404).json({ error: "Fant ikke deltaker." });
  }
  saveParticipants(participants);
  res.status(204).end();
});

app.get("/api/export", async (req, res) => {
  const { kjonn, ovelse } = req.query;
  let rows = participants;
  if (kjonn && KJONN_VALUES.includes(kjonn)) {
    rows = rows.filter((p) => p.kjonn === kjonn);
  }
  if (ovelse && OVELSE_VALUES.includes(ovelse)) {
    rows = rows.filter((p) => p.ovelse === ovelse);
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Påmeldte");
  sheet.columns = [
    { header: "Fornavn", key: "fornavn", width: 18 },
    { header: "Etternavn", key: "etternavn", width: 18 },
    { header: "Kjønn", key: "kjonn", width: 10 },
    { header: "Øvelse", key: "ovelse", width: 22 },
    { header: "Tid", key: "tid", width: 12 },
    { header: "Registrert", key: "registrertTidspunkt", width: 22 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const p of rows) {
    sheet.addRow({
      fornavn: p.fornavn,
      etternavn: p.etternavn,
      kjonn: p.kjonn,
      ovelse: p.ovelse,
      tid: p.tid || "",
      registrertTidspunkt: new Date(p.registrertTidspunkt).toLocaleString("nb-NO"),
    });
  }

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", 'attachment; filename="fox-classic-2026-paameldte.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Fox Classic 2026-påmelding kjører på http://localhost:${PORT}`);
});
