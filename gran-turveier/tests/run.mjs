// Kjør med: node tests/run.mjs        (LIVE=1 node tests/run.mjs tester også mot de ekte datatjenestene)
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import {
  avstandM, linjeLengde, punkterLangs, forenkle, iPolygon, klipp, skjoet, tilPiksel, fliserFor, bruk, bruksindeks,
  settNivaa, stigning, minutter, kalorier, skritt, ukestart, ukensMinutter, ukensTur, gpx, filnavn, avstandTilRute,
} from '../js/geo.js';
import { tolkMet, symbolTekst, turvaer } from '../js/kilder.js';
import { dekodPng } from '../data/png.mjs';
import { tolkTurruter, grupperTurruter, tolkWkt, grupperVeger, vegnavn, visningsnavn, hentGrense, hentTurruter } from '../data/ruter.mjs';

let ok = 0;
const venter = [];
const test = (navn, fn) => venter.push((async () => {
  try { await fn(); ok++; console.log(`✓ ${navn}`); } catch (e) { console.error(`✗ ${navn}\n  ${e.stack}`); process.exitCode = 1; }
})());

const naer = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} er ikke nær ${b}`);

test('avstand og lengde', () => {
  naer(avstandM([60.39, 10.56], [60.40, 10.56]), 1112, 2);
  naer(linjeLengde([[60.39, 10.56], [60.40, 10.56], [60.41, 10.56]]), 2224, 4);
});

test('punkter langs en linje har fast avstand', () => {
  const p = punkterLangs([[60.39, 10.56], [60.40, 10.56]], 100);
  assert.equal(p.length, 12); // 0, 100, …, 1100 m; siste punkt (1112 m) er for nær til å tas med
  naer(avstandM(p[0], p[1]), 100, 0.5);
});

test('forenkling beholder endepunkter og fjerner punkter på rett linje', () => {
  const linje = Array.from({ length: 11 }, (_, i) => [60.39 + i * 0.001, 10.56]);
  assert.deepEqual(forenkle(linje), [linje[0], linje[10]]);
  const knekk = [[60.39, 10.56], [60.395, 10.57], [60.40, 10.56]];
  assert.equal(forenkle(knekk).length, 3);
});

const kvadrat = [[[[10, 60], [11, 60], [11, 61], [10, 61], [10, 60]]]]; // [lon, lat]

test('punkt i polygon og klipping til kommunen', () => {
  assert.ok(iPolygon([60.5, 10.5], kvadrat));
  assert.ok(!iPolygon([60.5, 11.5], kvadrat));
  const deler = klipp([[60.5, 10.2], [60.5, 10.8], [60.5, 11.2], [60.5, 11.4], [60.6, 10.9], [60.6, 10.8]], kvadrat);
  assert.deepEqual(deler, [[[60.5, 10.2], [60.5, 10.8]], [[60.6, 10.9], [60.6, 10.8]]]);
});

test('linjebiter skjøtes i endene, også når en er snudd', () => {
  const a = [[60, 10], [60, 10.01]], b = [[60, 10.02], [60, 10.01]], c = [[61, 10], [61, 10.01]];
  const ut = skjoet([a, b, c]);
  assert.equal(ut.length, 2);
  assert.deepEqual(ut[0], [[60, 10], [60, 10.01], [60, 10.02]]);
});

test('pikselkoordinater og fliser for varmekartet', () => {
  const { x, y } = tilPiksel([60.37, 10.55]);
  assert.equal(Math.floor(x / 512), 1084);
  assert.equal(Math.floor(y / 512), 590);
  assert.ok(fliserFor([[60.31, 10.12], [60.56, 10.93]]).length >= 4);
});

test('bruk langs en rute fra et syntetisk varmekart', () => {
  const linje = [[60.39, 10.50], [60.39, 10.52]];
  const { y } = tilPiksel(linje[0]);
  // Spor bare på den vestre halvdelen av ruta.
  const midt = tilPiksel([60.39, 10.51]).x;
  const b = bruk([linje], (px, py) => (py === y && px < midt ? 200 : 0), { radius: 0 });
  naer(b.andel, 0.5, 0.05);
  naer(b.snitt, 100, 10);
  assert.equal(bruksindeks({ snitt: 255, andel: 1 }), 100);
  assert.equal(bruksindeks({ snitt: 255, andel: 0 }), 50);
  assert.equal(bruksindeks({ snitt: 0, andel: 0 }), 0);
});

test('nivå settes per type ut fra rangering', () => {
  const ruter = settNivaa([
    ...[90, 70, 50, 30, 10].map((indeks, i) => ({ id: `t${i}`, type: 'tur', indeks })),
    { id: 's0', type: 'sykkel', indeks: 5 }, { id: 's1', type: 'sykkel', indeks: 0 },
  ]);
  assert.deepEqual(ruter.filter(r => r.type === 'tur').map(r => r.nivaa), [5, 4, 3, 2, 1]);
  assert.deepEqual(ruter.filter(r => r.type === 'sykkel').map(r => [r.rang, r.nivaa]), [[1, 5], [2, 0]]);
});

test('stigning ignorerer støy under terskelen', () => {
  assert.deepEqual(stigning([100, 101, 100, 102, 110, 120, 115, 100]), { opp: 20, ned: 20 });
  assert.deepEqual(stigning([null, 100, null, 104]), { opp: 4, ned: 0 });
});

test('tid, energi og skritt', () => {
  const tur = { type: 'tur', lengde: 4500, opp: 100 };
  assert.equal(minutter(tur), 70);
  assert.equal(minutter({ type: 'sykkel', lengde: 16000, opp: 150 }), 70);
  assert.equal(skritt({ lengde: 5000 }), 6800);
  assert.ok(kalorier(tur, 70) > kalorier({ ...tur, opp: 0 }, 70));
  assert.ok(kalorier(tur, 90) > kalorier(tur, 70));
});

test('ukemål teller bare inneværende uke (mandag–søndag)', () => {
  const ons = new Date(2026, 9, 28, 12);
  assert.equal(ukestart(ons).getDate(), 26);
  const logg = [
    { dato: new Date(2026, 9, 25, 20).toISOString(), min: 60 },
    { dato: new Date(2026, 9, 26, 8).toISOString(), min: 30 },
    { dato: new Date(2026, 9, 28, 9).toISOString(), min: 45 },
  ];
  assert.equal(ukensMinutter(logg, ons), 75);
});

test('ukens tur er lik hele uka og velges blant mye brukte stier', () => {
  const ruter = [
    { id: 'a', type: 'tur', lengde: 5000, nivaa: 5 }, { id: 'b', type: 'tur', lengde: 6000, nivaa: 4 },
    { id: 'c', type: 'tur', lengde: 1000, nivaa: 5 }, { id: 'd', type: 'sykkel', lengde: 5000, nivaa: 5 },
    { id: 'e', type: 'tur', lengde: 5000, nivaa: 1 },
  ];
  const man = ukensTur(ruter, new Date(2026, 9, 26)), son = ukensTur(ruter, new Date(2026, 10, 1));
  assert.equal(man.id, son.id);
  assert.ok(['a', 'b'].includes(man.id));
  assert.equal(ukensTur([], new Date()), null);
});

test('GPX og filnavn', () => {
  const r = { navn: 'Sølvsberget & Bergsrud', linjer: [[[60.1, 10.1], [60.2, 10.2]]] };
  const x = gpx(r);
  assert.match(x, /<name>Sølvsberget &amp; Bergsrud<\/name>/);
  assert.match(x, /<trkpt lat="60.2" lon="10.2"\/>/);
  assert.equal(filnavn('Grua – Nysætra – Snellingen gård'), 'grua-nysaetra-snellingen-gard');
  naer(avstandTilRute([60.1, 10.1], r), 0, 0.01);
});

test('PNG med palett dekodes til indekser', () => {
  // 3×2 piksler, filtertype 0 og 1 (Sub)
  const raa = Buffer.from([0, 5, 10, 255, 1, 7, 1, 1]);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(3, 0); ihdr.writeUInt32BE(2, 4); ihdr[8] = 8; ihdr[9] = 3;
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr),
    chunk('PLTE', Buffer.alloc(768)), chunk('IDAT', deflateSync(raa)), chunk('IEND', Buffer.alloc(0))]);
  const d = dekodPng(png);
  assert.deepEqual([...d.piksler], [5, 10, 255, 7, 8, 9]);
});

const gml = `<wfs:FeatureCollection><wfs:member><app:Fotrute><gml:posList>60.40 10.50 60.41 10.50 60.42 10.50</gml:posList>
<app:ruteFølger>ST</app:ruteFølger><app:fotruteInfo><app:FotruteInfo><app:rutenavn>Granavollen - Gammehaugen</app:rutenavn>
<app:rutenummer>139</app:rutenummer><app:vedlikeholdsansvarlig>DNT | Hadeland Turlag</app:vedlikeholdsansvarlig>
<app:spesialFotrutetype>KS</app:spesialFotrutetype><app:gradering>G</app:gradering></app:FotruteInfo></app:fotruteInfo></app:Fotrute></wfs:member>
<wfs:member><app:Fotrute><gml:posList>60.42 10.50 60.43 10.50</gml:posList><app:ruteFølger>TR</app:ruteFølger><app:fotruteInfo><app:FotruteInfo>
<app:rutenavn>Ukjent</app:rutenavn><app:rutenummer>139</app:rutenummer><app:vedlikeholdsansvarlig>Gran kommune</app:vedlikeholdsansvarlig>
</app:FotruteInfo></app:fotruteInfo></app:Fotrute></wfs:member></wfs:FeatureCollection>`;

test('Turrutebasen: segmenter tolkes og samles til ruter', () => {
  const seg = tolkTurruter(gml);
  assert.equal(seg.length, 2);
  assert.equal(seg[0].info[0].ansvarlig, 'Hadeland Turlag');
  const [r] = grupperTurruter(seg, 'tur', kvadrat);
  assert.equal(r.navn, 'Granavollen - Gammehaugen');
  assert.equal(r.linjer.length, 1);
  assert.equal(r.linjer[0].length, 4);
  assert.deepEqual(r.ansvarlig, ['Hadeland Turlag', 'Gran kommune']);
  assert.deepEqual(r.spesial, ['kultursti']);
  assert.equal(r.gradering, 'grønn (enkel)');
  assert.ok(r.folger.sti > r.folger.traktorveg);
});

test('NVDB: WKT, vegnavn og grupperte strekninger', () => {
  assert.deepEqual(tolkWkt('LINESTRING Z (60.41 10.54 266.4, 60.42 10.55 267.2)'), [[60.41, 10.54], [60.42, 10.55]]);
  const veg = (nummer, navn, wkt, kat = 'F', typeVeg_sosi = 'enkelBilveg') => ({
    vegsystemreferanse: { vegsystem: { vegkategori: kat, nummer } }, adresse: navn ? { navn } : undefined,
    geometri: { wkt }, lengde: 100, typeVeg_sosi,
  });
  const biler = [veg(34, 'Hornslinna', 'LINESTRING (60.40 10.50, 60.41 10.50)'), veg(34, 'Hornslinna', 'LINESTRING (60.41 10.50, 60.42 10.50)')];
  const navn = vegnavn(biler);
  assert.equal(navn.get('F34'), 'Hornslinna');
  const [s] = grupperVeger(biler, 'sykkel');
  assert.equal(s.linjer.length, 1);
  assert.equal(visningsnavn(s), 'Hornslinna (Fv34)');
  const [g] = grupperVeger([veg(34, null, 'LINESTRING (60.40 10.501, 60.41 10.501)', 'F', 'gangOgSykkelveg')], 'hverdag', navn);
  assert.equal(visningsnavn(g), 'Gang- og sykkelveg langs Hornslinna (Fv34)');
  const [skog] = grupperVeger([veg(5, null, 'LINESTRING (60.40 10.6, 60.41 10.6)', 'S')], 'sykkel');
  assert.equal(visningsnavn(skog, 'Lygna'), 'Skogsbilveg ved Lygna');
});

test('MET-varsel tolkes og gir turråd', () => {
  const d = { properties: { timeseries: [
    { time: '2026-10-26T12:00:00Z', data: { instant: { details: { air_temperature: 6.2, wind_speed: 3 } }, next_1_hours: { summary: { symbol_code: 'fair_day' }, details: { precipitation_amount: 0 } } } },
  ] } };
  const s = tolkMet(d);
  assert.equal(s[0].temp, 6.2);
  assert.equal(symbolTekst(s[0].symbol), 'Lettskyet');
  assert.equal(turvaer(s), 'Fint turvær de neste timene.');
  assert.match(turvaer([{ temp: 5, vind: 2, nedbor: 4 }]), /regntøy/);
});

test('øyeblikksbildet i data/ruter.json er gyldig', async () => {
  const d = JSON.parse(await readFile(new URL('../data/ruter.json', import.meta.url), 'utf8'));
  for (const type of ['tur', 'sykkel', 'hverdag']) assert.ok(d.ruter.filter(r => r.type === type).length >= 10, type);
  const ider = new Set();
  for (const r of d.ruter) {
    assert.ok(r.navn && r.lengde > 0 && r.linjer.length && r.rang >= 1, r.id);
    assert.ok(r.indeks >= 0 && r.indeks <= 100 && r.nivaa >= 0 && r.nivaa <= 5, r.id);
    assert.ok(!ider.has(r.id), `duplikat ${r.id}`);
    ider.add(r.id);
  }
  assert.ok(d.grense.length >= 1);
});

if (process.env.LIVE) {
  test('LIVE: kommunegrense og turruter fra Kartverket', async () => {
    const grense = await hentGrense();
    assert.ok(iPolygon([60.392953, 10.560421], grense), 'Gran rådhus ligger i Gran');
    const seg = await hentTurruter('Sykkelrute', [[60.3, 10.4], [60.5, 10.8]]);
    assert.ok(seg.length > 0);
  });
}

await Promise.all(venter);
console.log(`\n${ok} av ${venter.length} tester OK`);
