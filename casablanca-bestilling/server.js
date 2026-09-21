const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const session = require("express-session");

const DATA_DIR = path.join(__dirname, "data");
const MENU_FILE = path.join(DATA_DIR, "menu.json");
const SEED_MENU_FILE = path.join(__dirname, "seed-menu.json");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

const USERNAME = process.env.CASABLANCA_USERNAME || "IKT";
const PASSWORD = process.env.CASABLANCA_PASSWORD || "Kebabhverfredag";
const SESSION_SECRET = process.env.SESSION_SECRET || "casablanca-gran-ikt-hemmelighet";

const STRENGTH_VALUES = ["Mild", "Medium", "Sterk"];

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function newRound() {
  return { roundId: crypto.randomUUID(), startedAt: new Date().toISOString(), orders: [] };
}

fs.mkdirSync(DATA_DIR, { recursive: true });

let menu = readJson(MENU_FILE, null);
if (!menu) {
  menu = readJson(SEED_MENU_FILE, { updatedAt: new Date().toISOString(), categories: [] });
  writeJson(MENU_FILE, menu);
}

let currentRound = readJson(ORDERS_FILE, null);
if (!currentRound) {
  currentRound = newRound();
  writeJson(ORDERS_FILE, currentRound);
}

let history = readJson(HISTORY_FILE, []);

function saveMenu() {
  writeJson(MENU_FILE, menu);
}
function saveOrders() {
  writeJson(ORDERS_FILE, currentRound);
}
function saveHistory() {
  writeJson(HISTORY_FILE, history);
}

// Build a lookup of itemId+sizeId -> pricing info from the current menu
function buildMenuIndex() {
  const index = new Map();
  for (const category of menu.categories) {
    for (const item of category.items) {
      for (const size of item.sizes) {
        index.set(`${item.id}:${size.id}`, {
          itemId: item.id,
          sizeId: size.id,
          itemName: item.name,
          categoryName: category.name,
          sizeLabel: size.label,
          price: size.price,
          hasStrength: !!item.hasStrength,
        });
      }
    }
  }
  return index;
}

function sanitizeOrderForClient(order) {
  const { editToken, ...rest } = order;
  return rest;
}

function computeOrderTotal(order) {
  return order.lines.reduce((sum, line) => sum + line.price * line.qty, 0);
}

const app = express();
app.disable("x-powered-by");
app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    name: "casablanca.sid",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  })
);

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.status(401).json({ error: "Ikke innlogget." });
}

// --- Auth ---

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === USERNAME && password === PASSWORD) {
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: "Feil brukernavn eller passord." });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("casablanca.sid");
    res.json({ ok: true });
  });
});

app.get("/api/session", (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

// --- Menu ---

app.get("/api/menu", requireAuth, (req, res) => {
  res.json(menu);
});

app.put("/api/menu", requireAuth, (req, res) => {
  const body = req.body || {};
  if (!Array.isArray(body.categories)) {
    return res.status(400).json({ error: "Meny må inneholde en liste med kategorier." });
  }

  const categories = [];
  for (const rawCategory of body.categories) {
    const categoryName = String(rawCategory.name || "").trim();
    if (!categoryName) return res.status(400).json({ error: "Alle kategorier må ha et navn." });
    if (!Array.isArray(rawCategory.items)) {
      return res.status(400).json({ error: `Kategorien "${categoryName}" mangler retter.` });
    }

    const items = [];
    for (const rawItem of rawCategory.items) {
      const itemName = String(rawItem.name || "").trim();
      if (!itemName) return res.status(400).json({ error: `En rett i "${categoryName}" mangler navn.` });
      if (!Array.isArray(rawItem.sizes) || rawItem.sizes.length === 0) {
        return res.status(400).json({ error: `Retten "${itemName}" må ha minst én pris.` });
      }

      const sizes = [];
      for (const rawSize of rawItem.sizes) {
        const price = Number(rawSize.price);
        if (!Number.isFinite(price) || price < 0) {
          return res.status(400).json({ error: `Ugyldig pris for "${itemName}".` });
        }
        sizes.push({
          id: rawSize.id && String(rawSize.id).trim() ? String(rawSize.id) : crypto.randomUUID(),
          label: String(rawSize.label || "").trim(),
          price,
        });
      }

      items.push({
        id: rawItem.id && String(rawItem.id).trim() ? String(rawItem.id) : crypto.randomUUID(),
        name: itemName,
        description: String(rawItem.description || "").trim(),
        sizes,
        hasStrength: !!rawItem.hasStrength,
        appliesTo: Array.isArray(rawItem.appliesTo) ? rawItem.appliesTo.filter((v) => typeof v === "string") : [],
      });
    }

    categories.push({
      id: rawCategory.id && String(rawCategory.id).trim() ? String(rawCategory.id) : crypto.randomUUID(),
      name: categoryName,
      note: String(rawCategory.note || "").trim(),
      imageUrl: String(rawCategory.imageUrl || "").trim(),
      items,
    });
  }

  menu = { updatedAt: new Date().toISOString(), categories };
  saveMenu();
  res.json(menu);
});

// --- Orders (current round) ---

app.get("/api/orders", requireAuth, (req, res) => {
  res.json({
    roundId: currentRound.roundId,
    startedAt: currentRound.startedAt,
    orders: currentRound.orders.map(sanitizeOrderForClient),
  });
});

function buildLines(rawLines, index) {
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    return { error: "Bestillingen må inneholde minst én rett." };
  }
  const lines = [];
  for (const rawLine of rawLines) {
    const key = `${rawLine.itemId}:${rawLine.sizeId}`;
    const info = index.get(key);
    if (!info) return { error: "En eller flere retter finnes ikke lenger i menyen. Last siden på nytt." };
    const qty = Number(rawLine.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
      return { error: `Ugyldig antall for "${info.itemName}".` };
    }
    lines.push({
      itemId: info.itemId,
      sizeId: info.sizeId,
      itemName: info.itemName,
      categoryName: info.categoryName,
      sizeLabel: info.sizeLabel,
      price: info.price,
      qty,
      strength: info.hasStrength ? (STRENGTH_VALUES.includes(rawLine.strength) ? rawLine.strength : "Medium") : null,
      notes: String(rawLine.notes || "").trim().slice(0, 200),
    });
  }
  return { lines };
}

app.post("/api/orders", requireAuth, (req, res) => {
  const body = req.body || {};
  const person = String(body.person || "").trim().slice(0, 80);
  if (!person) return res.status(400).json({ error: "Navn er påkrevd." });

  const index = buildMenuIndex();
  const { lines, error } = buildLines(body.lines, index);
  if (error) return res.status(400).json({ error });

  const now = new Date().toISOString();
  const order = {
    id: crypto.randomUUID(),
    editToken: crypto.randomUUID(),
    person,
    comment: String(body.comment || "").trim().slice(0, 300),
    lines,
    createdAt: now,
    updatedAt: now,
  };
  order.total = computeOrderTotal(order);

  currentRound.orders.push(order);
  saveOrders();
  res.status(201).json(order);
});

function findOrder(id) {
  return currentRound.orders.find((o) => o.id === id);
}

app.put("/api/orders/:id", requireAuth, (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Fant ikke bestillingen." });

  const body = req.body || {};
  if (body.token !== order.editToken) {
    return res.status(403).json({ error: "Du kan bare endre din egen bestilling." });
  }

  const person = String(body.person || "").trim().slice(0, 80);
  if (!person) return res.status(400).json({ error: "Navn er påkrevd." });

  const index = buildMenuIndex();
  const { lines, error } = buildLines(body.lines, index);
  if (error) return res.status(400).json({ error });

  order.person = person;
  order.comment = String(body.comment || "").trim().slice(0, 300);
  order.lines = lines;
  order.total = computeOrderTotal(order);
  order.updatedAt = new Date().toISOString();

  saveOrders();
  res.json(order);
});

app.delete("/api/orders/:id", requireAuth, (req, res) => {
  const order = findOrder(req.params.id);
  if (!order) return res.status(404).json({ error: "Fant ikke bestillingen." });

  const token = req.body && req.body.token ? req.body.token : req.query.token;
  if (token !== order.editToken) {
    return res.status(403).json({ error: "Du kan bare slette din egen bestilling." });
  }

  currentRound.orders = currentRound.orders.filter((o) => o.id !== order.id);
  saveOrders();
  res.status(204).end();
});

app.post("/api/orders/close", requireAuth, (req, res) => {
  if (currentRound.orders.length === 0) {
    return res.status(400).json({ error: "Ingen bestillinger å avslutte." });
  }

  const archived = {
    roundId: currentRound.roundId,
    startedAt: currentRound.startedAt,
    closedAt: new Date().toISOString(),
    orders: currentRound.orders.map(sanitizeOrderForClient),
    total: currentRound.orders.reduce((sum, o) => sum + o.total, 0),
  };

  history.unshift(archived);
  history = history.slice(0, 50);
  saveHistory();

  currentRound = newRound();
  saveOrders();

  res.json({ archived, round: { roundId: currentRound.roundId, startedAt: currentRound.startedAt, orders: [] } });
});

app.get("/api/history", requireAuth, (req, res) => {
  res.json(history);
});

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Casablanca-bestilling kjører på http://localhost:${PORT}`);
});
