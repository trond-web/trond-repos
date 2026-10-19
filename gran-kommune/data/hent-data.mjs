// Lager et øyeblikksbilde av Gran kommunes virksomheter med koordinater (data/steder.json).
// Appen viser dette med en gang, og oppdaterer fra registrene i bakgrunnen.
// Kjør med: node gran-kommune/data/hent-data.mjs [utfil]
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { hentVirksomheter, grupperSteder, geokod, iParallell } from '../js/kilder.js';
import { hentSkytebaner, leggTilTillegg } from '../js/skytebaner.js';

const utfil = process.argv[2] || fileURLToPath(new URL('./steder.json', import.meta.url));

const steder = grupperSteder(await hentVirksomheter());
await iParallell(steder, 4, async s => { s.posisjon = await geokod(s); });

const uten = steder.filter(s => !s.posisjon?.lat);
for (const s of uten) console.warn(`Uten posisjon: ${s.tittel} (${s.adresse || 'ingen adresse'})`);

const tillegg = JSON.parse(await readFile(new URL('./skytebaner-tillegg.json', import.meta.url), 'utf8'));
const skytebaner = leggTilTillegg(await hentSkytebaner(), tillegg);
console.log(`${skytebaner.length} skytebaner: ${skytebaner.map(s => s.tittel).join(', ')}`);

await writeFile(utfil, JSON.stringify({ hentet: new Date().toISOString(), steder, skytebaner }, null, 1) + '\n');
console.log(`${steder.length} steder, ${steder.reduce((n, s) => n + s.virksomheter.length, 0)} virksomheter → ${utfil}`);
