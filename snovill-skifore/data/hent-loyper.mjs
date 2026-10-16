#!/usr/bin/env node
/* ------------------------------------------------------------------ *
 *  Henter løypestrekninger fra Løyper.net (FMS Nordic) rundt stedene i
 *  varsler/steder.json, og skriver én JSON-fil som løypekartet i appen leser.
 *  Løyper.net tillater ikke kall fra nettleseren, så Pages-workflowen
 *  henter dataene ved hver bygging, som for NVE.
 *
 *  Bruk: node snovill-skifore/data/hent-loyper.mjs <utfil.json>
 *
 *  Kilde: vektorfliser fra api.loyper.net (segments og områdelisten).
 *  Zoom 11 gir samme detaljnivå som de høyeste zoomnivåene, med få fliser.
 * ------------------------------------------------------------------ */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeTile } from "./mvt.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || join(here, "loyper.json");
const Z = 11;
const RADIUS_KM = 10;
const LOCATIONS_URL = "https://www.loyper.net/api/locations?apiKey=be01c226-67f6-4006-bb06-fc80764b6da8&application=ski&domain=loyper";

const round = (v) => Math.round(v * 1e5) / 1e5;

function tileOf(lat, lon) {
  const n = 2 ** Z;
  const r = (lat * Math.PI) / 180;
  return [Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)];
}

function bbox(lat, lon, km) {
  const dLat = km / 111.2;
  const dLon = km / (111.2 * Math.cos((lat * Math.PI) / 180));
  return { s: lat - dLat, n: lat + dLat, w: lon - dLon, e: lon + dLon };
}

const inBox = (b) => ([la, lo]) => la >= b.s && la <= b.n && lo >= b.w && lo <= b.e;

async function tile(x, y, tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(`https://api.loyper.net/segments/${Z}/${x}/${y}`);
      if (res.status === 204) return [];
      if (!res.ok) throw new Error(`Løyper.net svarte ${res.status}`);
      return decodeTile(new Uint8Array(await res.arrayBuffer()), Z, x, y).segments || [];
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

async function main() {
  const { steder } = JSON.parse(await readFile(join(here, "..", "varsler", "steder.json"), "utf8"));
  const result = { hentet: new Date().toISOString(), kilde: "Løyper.net / FMS Nordic (api.loyper.net)", omraader: {}, steder: {} };

  try {
    const res = await fetch(LOCATIONS_URL);
    if (res.ok) for (const l of await res.json()) result.omraader[l.id] = { navn: l.name.trim(), url: l.external_url || null };
  } catch (err) {
    console.log(`::warning::Områdelisten fra Løyper.net: ${err.message}`);
  }

  const tiles = new Map();
  for (const sted of steder) {
    const b = bbox(sted.lat, sted.lon, RADIUS_KM);
    const [x0, y0] = tileOf(b.n, b.w);
    const [x1, y1] = tileOf(b.s, b.e);
    const segs = new Map();
    try {
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          const key = `${x}/${y}`;
          if (!tiles.has(key)) tiles.set(key, await tile(x, y));
          for (const f of tiles.get(key)) {
            const p = f.props;
            if (p.show_on_map === false || p.is_active === false) continue;
            const lines = f.lines.filter((l) => l.length > 1 && l.some(inBox(b))).map((l) => l.map(([la, lo]) => [round(la), round(lo)]));
            if (!lines.length) continue;
            // En strekning kan være delt mellom fliser; samle delene under samme id
            const seg = segs.get(p.id) || {
              id: p.id,
              omr: p.location_id,
              tid: p.last_update || null,
              lys: !!p.lighted,
              aapenUpreppet: !!p.open_not_groomed,
              type: p.track_id || null,
              linjer: [],
            };
            seg.linjer.push(...lines);
            segs.set(p.id, seg);
          }
        }
      }
      result.steder[sted.navn] = [...segs.values()];
      const areas = [...new Set(result.steder[sted.navn].map((s) => result.omraader[s.omr]?.navn || s.omr))];
      console.log(`${sted.navn}: ${segs.size} strekninger (${areas.join(", ") || "ingen"})`);
    } catch (err) {
      console.log(`::warning::${sted.navn}: ${err.message}`);
    }
  }

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(result));
  console.log(`Skrev ${out} (${tiles.size} fliser)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
