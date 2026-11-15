// Lager data/fliser.json: kartrutene (zoom 6–14) som dekker villreinområdet, beregnet på forhånd så Offline-fanen
// ikke fryser telefonen i flere sekunder. Kjør fra appmappen når grensa endres: node verktoy/lag-fliser.mjs
import fs from 'node:fs';
import { fliserFor } from '../js/geo.js';

export function lagFliser(omraade) {
  const z = {};
  for (const [zz, x, y] of fliserFor(omraade, 6, 14)) (z[zz] ||= []).push(x, y);
  return { beskrivelse: 'Kartruter (x, y parvis per zoom) som dekker Nordfjella villreinområde med 500 m kant', z };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const omraade = JSON.parse(fs.readFileSync(new URL('../data/nordfjella.geojson', import.meta.url)));
  const ut = lagFliser(omraade);
  fs.writeFileSync(new URL('../data/fliser.json', import.meta.url), JSON.stringify(ut));
  console.log(Object.entries(ut.z).map(([z, l]) => `z${z}: ${l.length / 2}`).join(', '));
}
