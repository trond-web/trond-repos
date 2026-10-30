// Henter alle data for én eiendom og lagrer dem i data/, slik at appen kan vise den uten å vente.
// Kjør: node verktoy/forhandsberegn.mjs 3238 29 2
import { writeFileSync } from 'node:fs';
import { hentAlt } from '../js/kilder.js';

const [nr = '3238', gnr = '29', bnr = '2'] = process.argv.slice(2);
const data = await hentAlt({ kommune: { nr, navn: 'Nannestad' }, gnr: +gnr, bnr: +bnr }, { logg: (id, s, t) => console.log(s.padEnd(5), t) });
const fil = new URL(`../data/eiendom-${nr}-${gnr}-${bnr}.json`, import.meta.url);
writeFileSync(fil, JSON.stringify(data));
console.log('Lagret', fil.pathname, Object.keys(data.feil).length ? data.feil : '');
