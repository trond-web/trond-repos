#!/usr/bin/env node
/* ------------------------------------------------------------------ *
 *  Henter snødata fra NVE/seNorge (samme kilde som Yr viser snødybde fra)
 *  for stedene i varsler/steder.json, og skriver én JSON-fil som appen
 *  leser. Kjøres av Pages-workflowen ved hver bygging (også hver 3. time).
 *
 *  Bruk: node snovill-skifore/data/hent-nve.mjs <utfil.json>
 *
 *  Temaer: sd (snødybde cm), swe (snømengde mm vannekvivalent),
 *  fsw (nysnø siste døgn mm), qsw (snøsmelting siste døgn mm),
 *  lwc (flytende vann i snøen %), tm (døgntemperatur °C).
 *  Verdiene gjelder kl. 06 hver dag. Datoer etter i dag er NVEs prognose.
 * ------------------------------------------------------------------ */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import "../sporet-watch.js";

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || join(here, "nve-sno.json");
const THEMES = ["sd", "swe", "fsw", "qsw", "lwc", "tm"];
const DAYS_BACK = 7;
const DAYS_AHEAD = 9;

const iso = (d) => d.toISOString().slice(0, 10);

function parseNveDate(s) {
  // «14.10.2026 06:00:00» → «2026-10-14»
  const [d, m, y] = s.split(" ")[0].split(".");
  return `${y}-${m}-${d}`;
}

async function theme(x, y, from, to, th) {
  const url = `https://gts.nve.no/api/GridTimeSeries/${x}/${y}/${from}/${to}/${th}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NVE ${th} svarte ${res.status}`);
  return res.json();
}

async function main() {
  const { steder } = JSON.parse(await readFile(join(here, "..", "varsler", "steder.json"), "utf8"));
  const now = new Date();
  const from = iso(new Date(now.getTime() - DAYS_BACK * 86400000));
  const to = iso(new Date(now.getTime() + DAYS_AHEAD * 86400000));
  const result = { hentet: now.toISOString(), kilde: "NVE/seNorge (gts.nve.no)", steder: {} };

  for (const sted of steder) {
    const [x, y] = globalThis.SporetWatch.toUtm33(sted.lat, sted.lon).map(Math.round);
    try {
      const series = {};
      let start = null;
      let altitude = null;
      for (const th of THEMES) {
        const d = await theme(x, y, from, to, th);
        start = start || parseNveDate(d.StartDate);
        altitude = altitude ?? d.Altitude;
        series[th] = d.Data.map((v) => (v === d.NoDataValue ? null : v));
      }
      const n = series.sd.length;
      const startMs = Date.parse(`${start}T00:00:00Z`);
      const days = [];
      for (let i = 0; i < n; i++) {
        const row = { date: iso(new Date(startMs + i * 86400000)) };
        for (const th of THEMES) row[th] = series[th][i];
        days.push(row);
      }
      result.steder[sted.navn] = { x, y, altitude, days };
      console.log(`${sted.navn}: ${days.length} dager, snødybde i dag ${days.find((r) => r.date === iso(now))?.sd ?? "–"} cm`);
    } catch (err) {
      console.log(`::warning::${sted.navn}: ${err.message}`);
    }
  }

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(result));
  console.log(`Skrev ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
