// Bygger js/sprak-en.js: slår sammen eksisterende ordbok med nye oversettelser.
// Bruk: node verktoy/sprak-bygg.mjs <mangler.json fra sprak-samle.mjs> <mappe med oversettelser {indeks: engelsk}.json>
// Tekster uten oversettelse (navn, e-post, tall) hoppes over. Eksisterende oversettelser beholdes.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const her = path.dirname(fileURLToPath(import.meta.url)); const ut = path.join(her, '..', 'js', 'sprak-en.js');
const [manglerFil, mappe] = process.argv.slice(2);
const { ORD } = await import(`file://${ut}?${Date.now()}`);
const ord = { ...ORD }; const mangler = JSON.parse(fs.readFileSync(manglerFil, 'utf8')); let nye = 0;
// Filer som slutter på .ord.json er direkte oppslag { norsk: engelsk } (setninger, mønstre med *).
for (const f of fs.readdirSync(mappe).filter((x) => x.endsWith('.ord.json'))) for (const [nb, en] of Object.entries(JSON.parse(fs.readFileSync(path.join(mappe, f), 'utf8')))) if (en && !(nb in ord)) { ord[nb] = en; nye++; }
for (const f of fs.readdirSync(mappe).filter((x) => x.endsWith('.json') && !x.endsWith('.ord.json'))) {
  for (const [i, en] of Object.entries(JSON.parse(fs.readFileSync(path.join(mappe, f), 'utf8')))) { const nb = mangler[Number(i)]; if (nb && en && !(nb in ord)) { ord[nb] = en; nye++; } }
}
const linjer = Object.keys(ord).sort((a, b) => a.localeCompare(b, 'nb')).map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(ord[k])},`);
fs.writeFileSync(ut, `// Engelsk ordbok for js/sprak.js: norsk tekst (tall som {0}, {1} …) → engelsk. Generert og vedlikeholdt med\n// verktoy/sprak-samle.mjs og verktoy/sprak-bygg.mjs; rett gjerne for hånd.\nexport const ORD = {\n${linjer.join('\n')}\n};\n`);
console.log(`${nye} nye oversettelser – ${Object.keys(ord).length} i alt`);
