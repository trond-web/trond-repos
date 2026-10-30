// Kjør med: node tests/run.mjs        (LIVE=1 node tests/run.mjs tester også mot de ekte datatjenestene)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tolkMatrikkel, rutenett, utvalg, parseAR5, parseBygninger, tolkPlanobjekt, hentAlt } from '../js/kilder.js';
import { fakta, muligheter, mulighetskart, brukAreal, kategori, standardVerdier, regnUt, KALKYLER, bygningsgruppe } from '../js/analyse.js';
import { arealM2 } from '../js/geo.js';

let ok = 0;
const venter = [];
const test = (navn, fn) => venter.push((async () => {
  try { await fn(); ok++; console.log(`✓ ${navn}`); } catch (e) { console.error(`✗ ${navn}\n  ${e.stack}`); process.exitCode = 1; }
})());
const les = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));

test('tolker matrikkelnummer', () => {
  assert.deepEqual(tolkMatrikkel('29/2'), { kommune: null, gnr: 29, bnr: 2, fnr: 0 });
  assert.deepEqual(tolkMatrikkel('Nannestad 29/2'), { kommune: 'Nannestad', gnr: 29, bnr: 2, fnr: 0 });
  assert.deepEqual(tolkMatrikkel('3238-29/2/1'), { kommune: '3238', gnr: 29, bnr: 2, fnr: 1 });
  assert.equal(tolkMatrikkel('Rud-Ødegutua 10'), null);
});

test('rutenett holder seg inne i flaten og under maks', () => {
  const g = { type: 'Polygon', coordinates: [[[11, 60], [11.02, 60], [11.02, 60.01], [11, 60.01], [11, 60]]] }; // ca. 1 100 × 1 110 m
  const { steg, punkter } = rutenett(g, 100);
  assert.ok(punkter.length <= 115 && punkter.length > 50, `${punkter.length} punkter`);
  assert.ok(Math.abs((punkter.length * steg * steg) / arealM2(g) - 1) < 0.25);
  assert.equal(utvalg(punkter, 10).length, 10);
});

test('tolker AR5, bygninger og planobjekter', () => {
  const a = parseAR5('<Arealtype_feature><artype>30</artype><artype_beskrivelse>Skog</artype_beskrivelse><arskogbon_beskrivelse>Høy</arskogbon_beskrivelse></Arealtype_feature>');
  assert.equal(kategori(a), 'skog_hoy');
  assert.equal(kategori({ arealtype: 'Fulldyrka jord' }), 'fulldyrka');
  assert.equal(kategori({ arealtype: 'Myr' }), 'myr');
  assert.equal(parseAR5('<msGMLOutput></msGMLOutput>'), null);
  const b = parseBygninger('<app:Bygning gml:id="x"><gml:pos>60.23 11.06</gml:pos><app:bygningsnummer>1</app:bygningsnummer><app:bygningstype>241</app:bygningstype></app:Bygning>');
  assert.deepEqual(b, [{ nr: '1', type: 241, punkt: [11.06, 60.23] }]);
  assert.equal(bygningsgruppe(241), 'landbruk'); assert.equal(bygningsgruppe(111), 'bolig');
  assert.equal(tolkPlanobjekt({ objekttypenavn: 'KpStøySone', støy: '220', hensynSonenavn: 'H220', beskrivelse: 'Gul flystøysone' }).art, 'sone');
  assert.deepEqual(tolkPlanobjekt({ objekttypenavn: 'KpArealformålOmråde', arealformål: '5100', arealbruksstatus: '1' }).kode, '5100');
});

test('kalkylene regner riktig', () => {
  assert.equal(regnUt('skog', { daa: 1000, tilvekst: 0.8, rotnetto: 300, skogfond: 0 }).aarlig, 240000);
  const sol = regnUt('solTak', { tak: 500, kwpm2: 0.2, kwh: 900, pris: 1, kost: 10000 });
  assert.equal(sol.aarlig, 90000); assert.equal(sol.invest, 1000000);
  assert.equal(regnUt('naering', { daa: 10, pris: 300, kost: 100, skogverdi: 0 }).engang, 2000000);
  for (const [id, k] of Object.entries(KALKYLER)) assert.ok(k.felt.length && typeof k.regn === 'function', id);
});

test('analyse av 29/2 (forhåndsberegnet)', () => {
  const data = les('eiendom-3238-29-2.json'); const naering = les('naeringsomrader.geojson');
  const f = fakta(data, naering);
  assert.ok(f.daa > 1400 && f.daa < 1480, `areal ${f.daa}`);
  assert.ok(f.skogHoy > 800, 'mye skog av høy bonitet');
  assert.ok(f.fulldyrka > 200, 'fulldyrka jord');
  assert.ok(f.flystoyGul > 0.5, 'gul flystøysone');
  assert.ok(f.lnfAndel > 0.9, 'LNF');
  const m = muligheter(f);
  assert.equal(m[0].id, 'skog');
  assert.equal(m.find((x) => x.id === 'bolig').planvei, 'stopp');
  assert.equal(m.find((x) => x.id === 'naering').planvei, 'plan');
  const celler = mulighetskart(data, f);
  const a = brukAreal(celler, f);
  assert.ok(Math.abs(Object.values(a).reduce((s, v) => s + v, 0) - f.daa) < 1);
  assert.ok(a.mat > 200 && a.skog > 800);
  assert.equal(standardVerdier('skog', f).daa, Math.round(f.skog - (f.areal.skog_lav || 0)));
});

test('næringsområdene har gyldig geometri', () => {
  const n = les('naeringsomrader.geojson');
  assert.ok(n.features.length > 30);
  for (const x of n.features) {
    assert.ok(x.geometry.coordinates.every((r) => r.length >= 4 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]), x.properties.id);
    assert.ok(['1130', '1160', '1200', '1300', '1500', '1800'].includes(x.properties.arealformal));
  }
});

if (process.env.LIVE) test('LIVE: henter og analyserer 29/2', async () => {
  const d = await hentAlt({ kommune: { nr: '3238', navn: 'Nannestad' }, gnr: 29, bnr: 2 });
  assert.ok(d.celler.filter((c) => c.ar5).length > d.celler.length * 0.9);
  assert.ok(d.plan.some((p) => p.objekter.length));
  assert.ok(muligheter(fakta(d)).length > 5);
});

await Promise.all(venter);
console.log(`\n${ok} av ${venter.length} tester OK`);
