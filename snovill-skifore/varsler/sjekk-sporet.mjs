#!/usr/bin/env node
/* ------------------------------------------------------------------ *
 *  Løypevakt for GitHub Actions: sjekker Sporet.no for nykjørte løyper
 *  rundt stedene i steder.json og sender push-varsel via ntfy.
 *
 *  Miljøvariabler:
 *    NTFY_TOPIC   ntfy-emnet varslene sendes til (påkrevd for å sende)
 *    NTFY_SERVER  standard https://ntfy.sh
 *    NTFY_TOKEN   valgfritt tilgangstoken for ntfy
 *    STATE_FILE   hvor «sist sett» lagres (standard .sporet-state/state.json)
 *    TEST_VARSEL  "true" sender et testvarsel uansett
 *    DRY_RUN      "true" skriver varslene til loggen i stedet for å sende
 * ------------------------------------------------------------------ */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "../sporet-watch.js";

const { fetchRoutes, message, FRESH_MS } = globalThis.SporetWatch;
const here = dirname(fileURLToPath(import.meta.url));

const env = process.env;
const STATE_FILE = env.STATE_FILE || ".sporet-state/state.json";
const NTFY_SERVER = (env.NTFY_SERVER || "https://ntfy.sh").replace(/\/$/, "");
const DRY_RUN = env.DRY_RUN === "true";

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

function osloHour(date = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Oslo", hour: "2-digit", hour12: false }).format(date)) % 24;
}

function isQuiet(cfg) {
  if (!cfg) return false;
  const h = osloHour();
  return cfg.fra > cfg.til ? h >= cfg.fra || h < cfg.til : h >= cfg.fra && h < cfg.til;
}

async function send({ title, body, quiet, click }) {
  const payload = {
    topic: env.NTFY_TOPIC,
    title,
    message: body,
    tags: ["tractor", "skier"],
    // Om natta sendes varselet stille, så det ligger klart når du våkner
    priority: quiet ? 2 : 4,
    click,
  };
  if (DRY_RUN || !env.NTFY_TOPIC) {
    console.log(`[${DRY_RUN ? "dry-run" : "ingen NTFY_TOPIC"}] ${title} – ${body}`);
    return;
  }
  const headers = { "content-type": "application/json" };
  if (env.NTFY_TOKEN) headers.authorization = `Bearer ${env.NTFY_TOKEN}`;
  const res = await fetch(NTFY_SERVER, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`ntfy svarte ${res.status}: ${await res.text()}`);
  console.log(`Sendt: ${title} – ${body}`);
}

async function main() {
  const config = JSON.parse(await readFile(join(here, "steder.json"), "utf8"));
  const state = await readJson(STATE_FILE, { seen: {}, steder: [] });
  const quiet = isQuiet(config.stilleTimer);

  if (!env.NTFY_TOPIC && !DRY_RUN) {
    console.log("::warning::NTFY_TOPIC er ikke satt – legg den inn som repository secret for å få varsler.");
  }

  if (env.TEST_VARSEL === "true") {
    const n = message([{ name: "Sjusjøvannet rundt", prepped: new Date(Date.now() - 7 * 60000).toISOString() }], "ved Sjusjøen");
    await send({ title: `${n.title} (test)`, body: n.body, quiet: false, click: config.appUrl });
  }

  const now = Date.now();
  const notified = new Set();
  const nextSeen = { ...state.seen };
  const doneSteder = new Set(state.steder);

  for (const sted of config.steder) {
    let routes;
    try {
      routes = await fetchRoutes(sted.lat, sted.lon, sted.radiusKm || 5);
    } catch (err) {
      console.log(`::warning::${sted.navn}: ${err.message}`);
      continue;
    }
    // Første gang et sted sjekkes lagres bare en grunnlinje
    const baseline = !doneSteder.has(sted.navn);
    const fresh = baseline
      ? []
      : routes.filter((r) => {
          const t = Date.parse(r.prepped);
          const before = state.seen[r.id] ? Date.parse(state.seen[r.id]) : 0;
          return t > before && now - t < FRESH_MS && !notified.has(r.id);
        });
    for (const r of routes) nextSeen[r.id] = r.prepped;
    doneSteder.add(sted.navn);

    console.log(`${sted.navn}: ${routes.length} løyper, ${fresh.length} nykjørte${baseline ? " (grunnlinje lagret)" : ""}`);
    if (fresh.length) {
      fresh.forEach((r) => notified.add(r.id));
      const n = message(fresh, `ved ${sted.navn}`);
      await send({ title: n.title, body: n.body, quiet, click: config.appUrl });
    }
  }

  await mkdir(dirname(STATE_FILE), { recursive: true });
  await writeFile(STATE_FILE, JSON.stringify({ seen: nextSeen, steder: [...doneSteder], sistSjekket: new Date().toISOString() }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
