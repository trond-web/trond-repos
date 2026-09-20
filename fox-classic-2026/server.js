const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const ExcelJS = require("exceljs");

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "participants.json");
const RACE_FILE = path.join(DATA_DIR, "race.json");

const KJONN_VALUES = ["Mann", "Kvinne"];
const OVELSE_VALUES = ["Trim uten tid", "Konkurranse med tid", "Tilskuer"];
const TID_PATTERN = /^([0-9]{1,2}:)?[0-5]?[0-9]:[0-5][0-9]$/;
const ARRANGOR_PASSORD = process.env.ARRANGOR_PASSORD || "";
const ARRANGOR_BRUKERNAVN = process.env.ARRANGOR_BRUKERNAVN || "admin";

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

function loadRace() {
  try {
    const raw = fs.readFileSync(RACE_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return { startTime: null };
    throw err;
  }
}

function saveRace(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(RACE_FILE, JSON.stringify(state, null, 2));
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

let participants = loadParticipants();
let race = loadRace();

function validateParticipant(body) {
  const fornavn = String(body.fornavn || "").trim();
  const etternavn = String(body.etternavn || "").trim();
  const kjonn = String(body.kjonn || "").trim();
  const ovelse = String(body.ovelse || "").trim();

  if (!fornavn) return "Fornavn er påkrevd.";
  if (!etternavn) return "Etternavn er påkrevd.";
  if (!KJONN_VALUES.includes(kjonn)) return "Kjønn må være Mann eller Kvinne.";
  if (!OVELSE_VALUES.includes(ovelse)) {
    return "Øvelse må være Trim uten tid, Konkurranse med tid eller Tilskuer.";
  }
  return null;
}

function timingSafeEqualStr(candidate, expected) {
  if (typeof candidate !== "string" || !expected) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function isCorrectCredentials(brukernavn, passord) {
  if (!ARRANGOR_PASSORD) return false;
  return timingSafeEqualStr(brukernavn, ARRANGOR_BRUKERNAVN) && timingSafeEqualStr(passord, ARRANGOR_PASSORD);
}

function requireArrangor(req, res, next) {
  const brukernavn = req.header("x-arrangor-brukernavn") || "";
  const passord = req.header("x-arrangor-passord") || "";
  if (!isCorrectCredentials(brukernavn, passord)) {
    return res.status(401).json({ error: "Feil eller manglende innlogging." });
  }
  next();
}

// Gates the arrangør page itself (not just the API) so deltakere can't reach
// or view the arrangør UI at all without logging in.
function requireArrangorBasicAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    const brukernavn = separatorIndex === -1 ? decoded : decoded.slice(0, separatorIndex);
    const passord = separatorIndex === -1 ? "" : decoded.slice(separatorIndex + 1);
    if (isCorrectCredentials(brukernavn, passord)) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="Fox Classic 2026 - Arrangor"');
  res.status(401).send("Innlogging som arrangør kreves.");
}

const app = express();
app.use(express.json());

app.get(
  [
    "/arrangor",
    "/arrangor.html",
    "/arrangor.js",
    "/arrangor/tid",
    "/tidtaking.html",
    "/tidtaking.js",
    "/arrangor/kamera",
    "/kamera.html",
    "/kamera.js",
  ],
  requireArrangorBasicAuth
);

app.get("/arrangor", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "arrangor.html"));
});

app.get("/arrangor/tid", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "tidtaking.html"));
});

app.get("/arrangor/kamera", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "kamera.html"));
});

app.get("/resultater", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "resultater.html"));
});

app.get("/historikk", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "historikk.html"));
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/participants", (req, res) => {
  res.json(participants);
});

app.post("/api/arrangor/login", (req, res) => {
  if (!ARRANGOR_PASSORD) {
    return res.status(500).json({ error: "Arrangørinnlogging er ikke konfigurert på serveren." });
  }
  const { brukernavn, passord } = req.body || {};
  if (!isCorrectCredentials(brukernavn, passord)) {
    return res.status(401).json({ error: "Feil brukernavn eller passord." });
  }
  res.json({ ok: true });
});

app.get("/api/arrangor/verify", requireArrangor, (req, res) => {
  res.json({ ok: true });
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
    klubb: item.klubb ? String(item.klubb).trim() || null : null,
    kjonn: String(item.kjonn).trim(),
    ovelse: String(item.ovelse).trim(),
    startnummer: null,
    tid: null,
    fullfort: false,
    registrertTidspunkt: new Date().toISOString(),
  }));

  participants = participants.concat(created);
  saveParticipants(participants);
  res.status(201).json(created);
});

app.patch("/api/participants/:id", requireArrangor, (req, res) => {
  const participant = participants.find((p) => p.id === req.params.id);
  if (!participant) {
    return res.status(404).json({ error: "Fant ikke deltaker." });
  }

  const updates = {};

  if ("fornavn" in req.body) {
    const fornavn = String(req.body.fornavn || "").trim();
    if (!fornavn) return res.status(400).json({ error: "Fornavn er påkrevd." });
    updates.fornavn = fornavn;
  }
  if ("etternavn" in req.body) {
    const etternavn = String(req.body.etternavn || "").trim();
    if (!etternavn) return res.status(400).json({ error: "Etternavn er påkrevd." });
    updates.etternavn = etternavn;
  }
  if ("klubb" in req.body) {
    const klubb = String(req.body.klubb || "").trim();
    updates.klubb = klubb || null;
  }
  if ("startnummer" in req.body) {
    const startnummer = String(req.body.startnummer || "").trim();
    updates.startnummer = startnummer || null;
  }
  if ("kjonn" in req.body) {
    const kjonn = String(req.body.kjonn || "").trim();
    if (!KJONN_VALUES.includes(kjonn)) {
      return res.status(400).json({ error: "Kjønn må være Mann eller Kvinne." });
    }
    updates.kjonn = kjonn;
  }
  if ("ovelse" in req.body) {
    const ovelse = String(req.body.ovelse || "").trim();
    if (!OVELSE_VALUES.includes(ovelse)) {
      return res.status(400).json({ error: "Øvelse må være Trim uten tid, Konkurranse med tid eller Tilskuer." });
    }
    updates.ovelse = ovelse;
  }
  if ("tid" in req.body) {
    const tid = req.body.tid === null ? null : String(req.body.tid).trim();
    if (tid !== null && tid !== "" && !TID_PATTERN.test(tid)) {
      return res.status(400).json({ error: "Tid må være på format tt:mm:ss eller mm:ss." });
    }
    updates.tid = tid || null;
  }
  if ("fullfort" in req.body) {
    updates.fullfort = Boolean(req.body.fullfort);
  }

  Object.assign(participant, updates);
  saveParticipants(participants);
  res.json(participant);
});

app.get("/api/race", (req, res) => {
  res.json(race);
});

app.post("/api/race/start", requireArrangor, (req, res) => {
  race = { startTime: new Date().toISOString() };
  saveRace(race);
  res.json(race);
});

app.post("/api/race/reset", requireArrangor, (req, res) => {
  race = { startTime: null };
  saveRace(race);
  res.json(race);
});

app.post("/api/participants/:id/mal", requireArrangor, (req, res) => {
  const participant = participants.find((p) => p.id === req.params.id);
  if (!participant) {
    return res.status(404).json({ error: "Fant ikke deltaker." });
  }

  if (participant.ovelse === "Konkurranse med tid") {
    if (!race.startTime) {
      return res.status(400).json({ error: "Løpet er ikke startet ennå." });
    }
    // Callers (e.g. the camera-modulen) may report the moment the runner
    // actually crossed the line, since OCR/confirmation can take a few
    // seconds after that — the finish time must reflect the crossing, not
    // whenever the arrangør finished confirming it.
    let crossedAt = new Date();
    if (req.body && req.body.tidspunkt) {
      const parsed = new Date(req.body.tidspunkt);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({ error: "Ugyldig tidspunkt." });
      }
      crossedAt = parsed;
    }
    const elapsedMs = crossedAt.getTime() - new Date(race.startTime).getTime();
    participant.tid = formatElapsed(elapsedMs);
  } else {
    participant.fullfort = true;
  }

  saveParticipants(participants);
  res.json(participant);
});

app.delete("/api/participants", requireArrangor, (req, res) => {
  participants = [];
  saveParticipants(participants);
  res.status(204).end();
});

app.delete("/api/participants/:id", requireArrangor, (req, res) => {
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
    { header: "Startnr", key: "startnummer", width: 10 },
    { header: "Fornavn", key: "fornavn", width: 18 },
    { header: "Etternavn", key: "etternavn", width: 18 },
    { header: "Klubb/team", key: "klubb", width: 20 },
    { header: "Kjønn", key: "kjonn", width: 10 },
    { header: "Øvelse", key: "ovelse", width: 22 },
    { header: "Tid", key: "tid", width: 12 },
    { header: "Registrert", key: "registrertTidspunkt", width: 22 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const p of rows) {
    const tidText = p.ovelse === "Konkurranse med tid" ? p.tid || "" : p.fullfort ? "Fullført" : "";
    sheet.addRow({
      startnummer: p.startnummer || "",
      fornavn: p.fornavn,
      etternavn: p.etternavn,
      klubb: p.klubb || "",
      kjonn: p.kjonn,
      ovelse: p.ovelse,
      tid: tidText,
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
