// Lager data/ruter.json: tur- og sykkelruter i Gran med bruksindeks, lengde, høydeprofil og geometri.
// Kjør med: node gran-turveier/data/hent-data.mjs [utfil]
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  hentGrense, boks, hentTurruter, grupperTurruter, hentVegnett, grupperVeger, hentVarmekart, settBruk, vegnavn,
  hentHoyder, stedsnavnVed, midtpunkt, visningsnavn, ferdig, utenOverlapp, settNivaa, stigning, iParallell,
} from './ruter.mjs';
import { lengde, forenkle, VARMEKART_ZOOM, VARMEKART_ZOOMER } from '../js/geo.js';

const utfil = process.argv[2] || fileURLToPath(new URL('./ruter.json', import.meta.url));
// Hvor mange vegstrekninger fra NVDB som tas med (de mest brukte), og minste lengde.
const ANTALL_SYKKELVEGER = 45, MIN_SYKKELVEG = 1500;
const ANTALL_HVERDAG = 40, MIN_HVERDAG = 300;
const MIN_TURRUTE = 300;

const logg = (...a) => console.log(...a);

const grense = await hentGrense();
const bboks = boks(grense);
logg('Kommunegrense hentet', bboks);

const [fot, sykkel] = await Promise.all([hentTurruter('Fotrute', bboks), hentTurruter('Sykkelrute', bboks)]);
const turruter = [...grupperTurruter(fot, 'tur', grense), ...grupperTurruter(sykkel, 'sykkel', grense)]
  .filter(r => lengde(r.linjer) >= MIN_TURRUTE);
logg(`Turrutebasen: ${fot.length} sti-segmenter og ${sykkel.length} sykkelsegmenter → ${turruter.length} ruter i Gran`);

const [gs, bilveg, privat] = await Promise.all([
  hentVegnett('typeveg=gangOgSykkelveg,sykkelveg,gangveg'),
  hentVegnett('vegsystemreferanse=E,R,F,K&typeveg=kanalisertVeg,enkelBilveg'),
  hentVegnett('vegsystemreferanse=P,S&typeveg=enkelBilveg'),
]);
logg(`NVDB: ${gs.length} gang-/sykkelvegsegmenter, ${bilveg.length + privat.length} bilvegsegmenter`);

const varmekart = {};
for (const aktivitet of ['all', 'run', 'ride']) {
  varmekart[aktivitet] = {};
  for (const z of [...VARMEKART_ZOOMER.map(v => v.z), VARMEKART_ZOOM]) varmekart[aktivitet][z] = await hentVarmekart(aktivitet, bboks, z);
}
logg('Varmekart hentet (alle aktiviteter, til fots og sykling)');

// Turrutebasen kan ligge noen titalls meter fra sporene (N50-geometri), derfor større søkeradius.
settBruk(turruter, varmekart, 2);
const hverdag = settBruk(grupperVeger(gs, 'hverdag', vegnavn([...bilveg, ...privat])), varmekart, 1)
  .filter(r => lengde(r.linjer) >= MIN_HVERDAG).sort((a, b) => b.indeks - a.indeks);
const sykkelveger = settBruk(grupperVeger([...bilveg, ...privat], 'sykkel'), varmekart, 1)
  .filter(r => lengde(r.linjer) >= MIN_SYKKELVEG).sort((a, b) => b.indeks - a.indeks);

let ruter = [
  ...turruter,
  ...utenOverlapp(sykkelveger).slice(0, ANTALL_SYKKELVEGER),
  ...utenOverlapp(hverdag).slice(0, ANTALL_HVERDAG),
];

// Navn til ruter som mangler det, ut fra nærmeste stedsnavn.
await iParallell(ruter, 4, async r => {
  const sted = r.navn ? '' : await stedsnavnVed(midtpunkt(r)).catch(() => '');
  r.navn = visningsnavn(r, sted);
});

ruter = ruter.map(ferdig);
await iParallell(ruter, 4, async r => {
  try {
    Object.assign(r, await hentHoyder(r));
    // Stigningen regnes på hele lengden, skalert fra den lengste sammenhengende delen.
    // Retningen i kildene er tilfeldig. Ruter som går mest nedover snus, så de starter nederst (som regel
    // ved parkeringen) og stigningen viser klatringen.
    let s = stigning(r.profil);
    if (s.ned > s.opp) {
      r.linjer = r.linjer.map(l => l.slice().reverse()).reverse();
      r.profil.reverse();
      s = { opp: s.ned, ned: s.opp };
    }
    const skala = r.lengde / Math.max(1, r.profilLengde);
    r.opp = Math.round(s.opp * skala);
    r.ned = Math.round(s.ned * skala);
  } catch (e) {
    console.warn(`Uten høyde: ${r.navn} (${e.message})`);
  }
});
settNivaa(ruter);
ruter.sort((a, b) => a.type.localeCompare(b.type) || a.rang - b.rang);

const grenseForenklet = grense.map(poly => poly.map(ring =>
  forenkle(ring.map(([lo, la]) => [la, lo]), 25).map(([la, lo]) => [+la.toFixed(5), +lo.toFixed(5)])));

await writeFile(utfil, JSON.stringify({ hentet: new Date().toISOString(), grense: grenseForenklet, ruter }) + '\n');
for (const type of ['tur', 'sykkel', 'hverdag']) {
  const t = ruter.filter(r => r.type === type);
  logg(`${type}: ${t.length} ruter. Mest brukt: ${t.slice(0, 5).map(r => `${r.navn} (${r.indeks})`).join(', ')}`);
}
logg(`→ ${utfil}`);
