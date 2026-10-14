// Kjør med: node tests/run.mjs        (LIVE=1 node tests/run.mjs tester også mot de ekte datatjenestene)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { punktIPolygon, avstandTilGrense, avstandM, retning, himmelretning, utm, utmTekst, fliserFor, flisBbox3857, flisX, flisY, gpx } from '../js/geo.js';
import { wmsUrl, WMS, flisUrl, BAKGRUNNER, tolkTeig, teigNavn, teigI, hoydeI, lesGeoJson } from '../js/kilder.js';

let ok = 0;
const venter = [];
const test = (navn, fn) => venter.push((async () => {
  try { await fn(); ok++; console.log(`✓ ${navn}`); } catch (e) { console.error(`✗ ${navn}\n  ${e.stack}`); process.exitCode = 1; }
})());

const omraade = JSON.parse(fs.readFileSync(new URL('../data/nordfjella.geojson', import.meta.url)));
const kvadrat = { type: 'Polygon', coordinates: [[[11.0, 60.0], [11.002, 60.0], [11.002, 60.001], [11.0, 60.001], [11.0, 60.0]], [[11.0015, 60.0007], [11.0018, 60.0007], [11.0018, 60.0009], [11.0015, 60.0009], [11.0015, 60.0007]]] };

test('punkt i polygon med hull', () => {
  assert.equal(punktIPolygon([11.001, 60.0005], kvadrat), true);
  assert.equal(punktIPolygon([11.0016, 60.0008], kvadrat), false);
  assert.equal(punktIPolygon([11.003, 60.0005], kvadrat), false);
});

test('avstand til grense', () => {
  const d = avstandTilGrense([11.001, 60.0011], kvadrat);
  assert.ok(Math.abs(d.meter - 11.1) < 0.5, d.meter);
  assert.ok(Math.abs(d.punkt[1] - 60.001) < 1e-6);
  assert.ok(Math.abs(avstandTilGrense([11.001, 60.0005], kvadrat).meter - 35.6) < 1); // nærmest hjørnet av hullet
});

test('avstand og retning', () => {
  assert.ok(Math.abs(avstandM([8, 60], [8, 61]) - 111195) < 50);
  assert.equal(himmelretning(retning([8, 60], [8, 61])), 'N');
  assert.equal(himmelretning(retning([8, 60], [9, 60])), 'Ø');
  assert.equal(himmelretning(retning([8, 60], [7, 59])), 'SV');
});

test('UTM sone 32 stemmer med kjente verdier', () => {
  const u = utm([9, 60]);
  assert.equal(u.sone, 32); assert.equal(u.bånd, 'V');
  assert.ok(Math.abs(u.øst - 500000) < 0.01);
  assert.ok(Math.abs(u.nord - 6651411.19) < 0.5, u.nord);
  const u2 = utm([7.9, 60.85], 32); // sjekket mot Kartverkets transformasjon
  assert.ok(Math.abs(u2.øst - 440227) < 2 && Math.abs(u2.nord - 6746581) < 2, `${u2.øst} ${u2.nord}`);
  assert.equal(utmTekst([7.9, 60.85], 32), '32V 440227Ø 6746581N');
});

test('Nordfjella: punkter innenfor og utenfor', () => {
  assert.equal(omraade.features[0].properties.lokalId, 'BV00003542');
  assert.equal(punktIPolygon([7.9, 60.85], omraade), true); // Ål-fjellet, 130/1
  assert.equal(punktIPolygon([10.75, 59.91], omraade), false); // Oslo
  assert.equal(punktIPolygon([8.25, 60.6], omraade), false); // Geilo, sør for området
  const d = avstandTilGrense([7.9, 60.85], omraade);
  assert.ok(d.meter > 100 && d.meter < 40000, d.meter);
});

test('fliser for hele området', () => {
  const l = fliserFor(omraade, 6, 13);
  const per = (z) => l.filter(([zz]) => zz === z).length;
  assert.equal(per(6), 1);
  assert.ok(per(13) > 600 && per(13) < 900, per(13));
  // Alle barn av en flis er med på neste nivå bare om de ligger i/nær området, og ingen duplikater.
  assert.equal(new Set(l.map((f) => f.join('/'))).size, l.length);
  // Ruta der 130/1 ligger er med på z13.
  assert.ok(l.some(([z, x, y]) => z === 13 && x === flisX(7.9, 13) && y === flisY(60.85, 13)));
});

test('WMS-URL har fast oppsett og riktig bbox', () => {
  const u = wmsUrl(WMS.eiendom, 14, 8551, 4565);
  assert.match(u, /^https:\/\/wms\.geonorge\.no\/skwms1\/wms\.matrikkelkart\?SERVICE=WMS&VERSION=1\.3\.0&REQUEST=GetMap&LAYERS=eiendomsgrense&/);
  const b = flisBbox3857(8551, 4565, 14);
  assert.ok(u.includes(`BBOX=${b.map((v) => v.toFixed(2)).join(',')}&WIDTH=256`));
  assert.ok(Math.abs(b[2] - b[0] - 2445.98) < 0.01);
  assert.equal(flisUrl(BAKGRUNNER.topo.url, 13, 4276, 2281), 'https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/13/2281/4276.png');
});

test('tolk teig fra eiendoms-API', () => {
  const geom = { type: 'Polygon', coordinates: [[[7.9, 60.8], [8, 60.8], [8, 60.9], [7.9, 60.8]]] };
  const t = tolkTeig([
    { geometry: geom, properties: { kommunenummer: '3328', gardsnummer: 130, bruksnummer: 1, festenummer: 0, lokalid: 474688405, matrikkelnummertekst: '130/1', 'nøyaktighetsklasseteig': 'Rødt', teigmedflerematrikkelenheter: true } },
    { geometry: geom, properties: { kommunenummer: '3328', gardsnummer: 130, bruksnummer: 2, festenummer: 0, lokalid: 474688405, matrikkelnummertekst: '130/2', 'nøyaktighetsklasseteig': 'Rødt', teigmedflerematrikkelenheter: true } },
  ]);
  assert.equal(t.id, '474688405');
  assert.equal(t.noyaktighet, 'lav');
  assert.equal(t.sameie, true);
  assert.equal(teigNavn(t), '130/1, 130/2 i Ål');
});

test('GeoJSON-import avviser UTM-koordinater', () => {
  assert.equal(lesGeoJson('{"type":"Polygon","coordinates":[[[7.9,60.8],[8,60.8],[8,60.9],[7.9,60.8]]]}').features.length, 1);
  assert.throws(() => lesGeoJson('{"type":"Point","coordinates":[440227,6746581]}'), /UTM/);
});

test('GPX-eksport', () => {
  const x = gpx([{ lat: 60.85, lon: 7.9, tid: 0, navn: 'Bukk <2>', type: 'felt', notat: 'Ved vatnet', hoyde: 1267 }]);
  assert.match(x, /<wpt lat="60\.850000" lon="7\.900000"><ele>1267\.0<\/ele>/);
  assert.match(x, /<name>Bukk &lt;2&gt;<\/name>/);
});

if (process.env.LIVE) {
  test('LIVE: teig og høyde fra Kartverket', async () => {
    const t = await teigI([7.9, 60.85]);
    assert.equal(t.kommunenr, '3328');
    assert.ok(t.enheter.some((e) => e.tekst === '130/1'), JSON.stringify(t.enheter));
    assert.equal(punktIPolygon([7.9, 60.85], t.geometri), true);
    const z = await hoydeI([7.9, 60.85]);
    assert.ok(z > 1100 && z < 1400, z);
  });
  test('LIVE: kartruter og eiendomsgrenser svarer', async () => {
    for (const url of [flisUrl(BAKGRUNNER.topo.url, 13, flisX(7.9, 13), flisY(60.85, 13)), wmsUrl(WMS.eiendom, 14, flisX(7.9, 14), flisY(60.85, 14)), wmsUrl(WMS.trekk, 10, flisX(7.9, 10), flisY(60.85, 10))]) {
      const r = await fetch(url);
      assert.equal(r.status, 200, url);
      assert.equal(r.headers.get('content-type'), 'image/png', url);
    }
  });
}

await Promise.all(venter);
console.log(`\n${ok} tester ok`);
