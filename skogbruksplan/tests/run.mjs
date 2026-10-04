// Kjør med: node tests/run.mjs
import assert from 'node:assert/strict';
import { utmTilGeo, geoTilUtm, arealM2, punktIGeometri } from '../js/proj.js';
import { parseSosi, lagSosi } from '../js/sosi.js';
import { normaliserBestand, framskriv, foreslaaForEiendom, treslagFraSR16, foreslaaTiltak, laavesteHogstalder, sammendrag, tolkHogstklasse, tolkTreslag } from '../js/model.js';
import { lesGeojson, lesCsv, lesSosi, slaaSammen } from '../js/importers.js';
import { lagDemo } from '../js/demo.js';
import { finnKommune } from '../js/generator.js';
import { klassifiser, parseHtmlAlle, pakkUtKmz, parseKml } from '../js/kommuneanalyse.js';
import zlib from 'node:zlib';
import { lengdeM, avstandTilLinje, terrengtransport, foreslaaVedlikehold, fordelKostnad, wktTilGeo, nyVeiKostnad, STANDARD_VEIINNSTILLINGER } from '../js/veier.js';

let ok = 0;
const venter = [];
const test = (navn, fn) => { venter.push((async () => { try { await fn(); ok++; console.log(`✓ ${navn}`); } catch (e) { console.error(`✗ ${navn}\n  ${e.stack}`); process.exitCode = 1; } })()); };

test('UTM32 -> geo kjent punkt (Hamar-området)', () => {
  // Referanse fra pyproj (EPSG:4326 -> EPSG:25832): Ø 612 648,067, N 6 742 287,364
  const [o, n] = geoTilUtm(11.07, 60.8, 32);
  const [lon, lat] = utmTilGeo(o, n, 32);
  assert.ok(Math.abs(lon - 11.07) < 1e-8 && Math.abs(lat - 60.8) < 1e-8);
  assert.ok(Math.abs(o - 612648.067) < 0.01 && Math.abs(n - 6742287.364) < 0.01, `${o} ${n}`);
});

test('UTM33 rundtur', () => {
  const [o, n] = geoTilUtm(15.5, 68.2, 33);
  assert.ok(Math.abs(o - 520721.661) < 0.01 && Math.abs(n - 7565246.739) < 0.01, `${o} ${n}`);
  const [lon, lat] = utmTilGeo(o, n, 33);
  assert.ok(Math.abs(lon - 15.5) < 1e-8 && Math.abs(lat - 68.2) < 1e-8);
});

test('areal 100x100 m ≈ 10 daa', () => {
  const ring = [[600000, 6700000], [600100, 6700000], [600100, 6700100], [600000, 6700100], [600000, 6700000]]
    .map(([x, y]) => utmTilGeo(x, y, 32));
  const a = arealM2({ type: 'Polygon', coordinates: [ring] });
  assert.ok(Math.abs(a - 10000) < 60, String(a));
  assert.ok(punktIGeometri(utmTilGeo(600050, 6700050, 32), { type: 'Polygon', coordinates: [ring] }));
});

const SOSI = `.HODE
..TEGNSETT UTF-8
..TRANSPAR
...KOORDSYS 22
...ORIGO-NØ 0 0
...ENHET 0.01
.FLATE 1:
..OBJTYPE Bestand
..BESTANDNR 12
..TRESLAG 1
..BONITET 17
..HOGSTKLASSE 5
..ALDER 95
..VOLUM_DAA 32,5
..TILTAK "Sluttavvirkning"
..REF :2 -3 (:4)
..NØ
670005000 60005000
.KURVE 2:
..OBJTYPE Bestandsgrense
..NØ
670000000 60000000
670000000 60010000
670010000 60010000
.KURVE 3:
..NØ
670000000 60000000
670010000 60010000
.KURVE 4:
..NØ
670004000 60004000
670004000 60006000
670006000 60006000
670006000 60004000
670004000 60004000
.SLUTT
`;

test('SOSI: flate med REF, reversert kurve og hull', () => {
  const fc = parseSosi(SOSI);
  assert.equal(fc.koordsys, 'UTM32');
  assert.equal(fc.features.length, 1);
  const g = fc.features[0].geometry;
  assert.equal(g.coordinates.length, 2);
  assert.deepEqual(g.coordinates[0][0], [600000, 6700000]);
  assert.equal(g.coordinates[0].length, 4);
  assert.equal(fc.features[0].properties.BESTANDNR, 12);
});

test('SOSI -> bestand med normaliserte felt og areal fra geometri', () => {
  const r = lesSosi(new TextEncoder().encode(SOSI).buffer, 'auto', 2026);
  const b = r.bestand[0];
  assert.equal(b.nr, '12'); assert.equal(b.treslag, 'G'); assert.equal(b.bonitet, 17);
  assert.equal(b.hogstklasse, 5); assert.equal(b.volumDaa, 32.5);
  assert.ok(Math.abs(b.areal - (5 - 0.4)) < 0.1, String(b.areal)); // trekant 5 daa minus hull 0,4 daa
  assert.equal(b.tiltak[0].type, 'sluttavvirkning');
});

test('SOSI eksport kan leses inn igjen', () => {
  const fc = parseSosi(SOSI);
  const ut = lagSosi(fc.features, 'UTM32');
  const inn = parseSosi(ut);
  assert.equal(inn.features.length, 1);
  assert.equal(inn.features[0].geometry.coordinates.length, 2);
  assert.equal(inn.features[0].properties.BESTANDNR, 12);
});

test('GeoJSON i UTM gjenkjennes automatisk', () => {
  const gj = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { 'Bestand nr': '3', Treslag: 'Furu', Bonitet: 'F14', HKL: 'IV' }, geometry: { type: 'Polygon', coordinates: [[[600000, 6700000], [600200, 6700000], [600200, 6700100], [600000, 6700000]]] } }] };
  const r = lesGeojson(JSON.stringify(gj), 'auto', 2026);
  assert.equal(r.koordsys, 'UTM32');
  const b = r.bestand[0];
  assert.equal(b.nr, '3'); assert.equal(b.treslag, 'F'); assert.equal(b.bonitet, 14); assert.equal(b.hogstklasse, 4);
  assert.ok(Math.abs(b.areal - 10) < 0.2);
});

test('CSV med semikolon og desimalkomma', () => {
  const r = lesCsv('Bestandsnr;Treslag;Bonitet;Areal;Volum m3\n1;G;17;12,5;250\n2;F;11;8;40', 2026);
  assert.equal(r.bestand.length, 2);
  assert.equal(r.bestand[0].volumDaa, 20);
});

test('tolking av koder', () => {
  assert.equal(tolkHogstklasse('III'), 3); assert.equal(tolkHogstklasse('5'), 5);
  assert.equal(tolkTreslag('Bjørk'), 'L'); assert.equal(tolkTreslag(2), 'F');
});

test('flett oppdaterer på bestandsnr', () => {
  const a = normaliserBestand({ nr: '1', areal: 10, bonitet: 14 });
  const b = normaliserBestand({ nr: '1', alder: 50 });
  const r = slaaSammen([a], [b]);
  assert.equal(r.liste.length, 1); assert.equal(r.liste[0].alder, 50); assert.equal(r.liste[0].areal, 10);
});

test('hogstalder, forslag og framskriving', () => {
  const b = normaliserBestand({ nr: '1', treslag: 'G', bonitet: 17, alder: 95, volum_daa: 35, areal: 10, hogstklasse: 5 });
  assert.equal(laavesteHogstalder(b), 80);
  const f = foreslaaTiltak(b, undefined, 2026);
  assert.equal(f[0].type, 'sluttavvirkning');
  b.tiltak.push({ id: 'x', type: 'sluttavvirkning', aar: 2027, status: 'planlagt' });
  const { aarRader } = framskriv([b], 10, undefined, { startAar: 2026 });
  assert.ok(aarRader[1].avvirkning > 340, String(aarRader[1].avvirkning));
  assert.ok(aarRader[2].staaende < 5);
  const uten = framskriv([b], 10, undefined, { startAar: 2026, folgPlan: false });
  assert.ok(uten.aarRader[10].staaende > 350);
});

test('demo-data gir fornuftig sammendrag', () => {
  const d = lagDemo(2026);
  const s = sammendrag(d.bestand);
  assert.ok(d.bestand.length >= 15);
  assert.ok(s.areal > 300 && s.volum > 1000, JSON.stringify(s));
});

test('lite volum i gammel skog gir kontroll, ikke hogst', () => {
  const b = normaliserBestand({ nr: '9', treslag: 'G', bonitet: 14, alder: 93, volum_daa: 6, areal: 5 });
  const f = foreslaaTiltak(b, undefined, 2026);
  assert.equal(f.length, 1); assert.equal(f[0].type, 'annet');
});

test('hogstforslag spres jevnt over år', () => {
  const d = lagDemo(2026);
  const f = foreslaaForEiendom(d.bestand, undefined, 2026);
  const hogst = f.filter((x) => x.type === 'sluttavvirkning');
  assert.ok(hogst.length >= 4);
  assert.ok(new Set(hogst.map((x) => x.aar)).size >= Math.min(hogst.length, 6), 'skal fordeles på flere år');
  assert.ok(hogst.every((x) => x.aar >= 2026 && x.aar < 2036));
  for (const p of f.filter((x) => x.type === 'planting')) {
    const h = hogst.find((x) => x.b === p.b);
    if (h) assert.equal(p.aar, h.aar + 1);
  }
});

test('SR16 treslagskoder', () => {
  assert.equal(treslagFraSR16('1'), 'G'); assert.equal(treslagFraSR16('2'), 'F');
  assert.equal(treslagFraSR16('3'), 'G'); assert.equal(treslagFraSR16('5'), 'L');
  assert.equal(treslagFraSR16('3', { G: 42.9, F: 50, L: 7.1 }), 'F');
});

test('kommune tolkes fra navn eller nummer', () => {
  const k = [{ nr: '3238', navn: 'Nannestad' }, { nr: '3240', navn: 'Eidsvoll' }, { nr: '3901', navn: 'Horten' }];
  assert.equal(finnKommune('nannestad', k).nr, '3238');
  assert.equal(finnKommune('Eidsvoll (3240)', k).nr, '3240');
  assert.equal(finnKommune('3238', k).navn, 'Nannestad');
  assert.equal(finnKommune('Nannestad (3238)', []).navn, 'Nannestad');
  assert.equal(finnKommune('Eid', k).nr, '3240');
  assert.equal(finnKommune('Ukjentby', k), null);
});

const flate = (o) => ({ id: o.id, areal: 10, treslag: 'G', bonitet: 17, alder: 50, volumDaa: 20, hoyde: 16, overhoyde: 18, treantall: 60, andel: { G: 95, F: 0, L: 5 }, mis: false, vern: null, ...o });
test('kommuneanalyse: klassifisering', () => {
  const r = klassifiser([
    flate({ id: 'hogst', alder: 95, volumDaa: 30 }),
    flate({ id: 'lite-volum', alder: 95, volumDaa: 8 }),
    flate({ id: 'vernet', alder: 95, volumDaa: 30, vern: 'Naturreservat: X' }),
    flate({ id: 'lukket-blandet', bonitet: 14, alder: 80, volumDaa: 18, andel: { G: 60, F: 10, L: 30 } }),
    flate({ id: 'ensjiktet', bonitet: 14, alder: 80, volumDaa: 18, hoyde: 16, overhoyde: 18 }),
    flate({ id: 'furu-skjerm', treslag: 'F', bonitet: 11, alder: 110, volumDaa: 12, andel: { G: 0, F: 90, L: 10 } }),
    flate({ id: 'ung-lauv', alder: 12, hoyde: 4, volumDaa: 2, bonitet: 17, andel: { G: 50, F: 0, L: 50 } }),
    flate({ id: 'ung-ren', alder: 12, hoyde: 4, volumDaa: 2, bonitet: 17, treantall: 40, andel: { G: 100, F: 0, L: 0 } }),
    flate({ id: 'liten', areal: 1, alder: 95, volumDaa: 30 }),
  ]);
  const ider = (l) => l.map((f) => f.id).sort();
  assert.deepEqual(ider(r.hogst), ['hogst']);
  assert.deepEqual(ider(r.lukket), ['furu-skjerm', 'lukket-blandet']);
  assert.deepEqual(ider(r.ungskog), ['ung-lauv']);
  assert.ok(r.hogst[0].rotnetto > 0);
});

test('kommuneanalyse: HTML-attributter kobles til id i rekkefølge', () => {
  const tab = (alder, gran) => `<table><tr><td>Bestandsalder</td><td><b>${alder}</b><td></td></tr><tr><td>Volum uten bark (m³/ha)</td><td><b>250</b></td></tr><tr><td>Prosentandel gran</td><td><b>${gran}</b><td></td></tr></table>`;
  const a = parseHtmlAlle(`<html>${tab(80, 90)}${tab(20, 10)}</html>`, ['11', '22']);
  assert.equal(a[1].gid, '22'); assert.equal(a[1].srtrealder, '20'); assert.equal(a[0].srvolub, '250');
  assert.equal(parseHtmlAlle(tab(1, 1), ['1', '2']), null, 'ulikt antall skal gi null');
});

test('kommuneanalyse: KMZ pakkes ut', async () => {
  const kml = '<kml><Placemark><name>SRVTRESLAG.42</name><Polygon><outerBoundaryIs><LinearRing><coordinates>11,60 11.001,60 11.001,60.001 11,60</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>';
  const data = zlib.deflateRawSync(Buffer.from(kml));
  const navn = Buffer.from('doc.kml');
  const lok = Buffer.alloc(30); lok.writeUInt32LE(0x04034b50, 0); lok.writeUInt16LE(8, 8); lok.writeUInt32LE(data.length, 18); lok.writeUInt32LE(kml.length, 22); lok.writeUInt16LE(navn.length, 26);
  const sentral = Buffer.alloc(46); sentral.writeUInt32LE(0x02014b50, 0); sentral.writeUInt16LE(8, 10); sentral.writeUInt32LE(data.length, 20); sentral.writeUInt32LE(kml.length, 24); sentral.writeUInt16LE(navn.length, 28); sentral.writeUInt32LE(0, 42);
  const cdStart = lok.length + navn.length + data.length;
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(sentral.length + navn.length, 12); eocd.writeUInt32LE(cdStart, 16);
  const zip = Buffer.concat([lok, navn, data, sentral, navn, eocd]);
  const tekst = await pakkUtKmz(zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.length));
  assert.equal(tekst, kml);
  assert.equal(parseKml(tekst).get('42').type, 'Polygon');
});

test('veier: lengde, avstand og WKT', () => {
  const a = utmTilGeo(280000, 6680000, 33); const b = utmTilGeo(281000, 6680000, 33);
  const vei = { type: 'LineString', coordinates: [a, b] };
  assert.ok(Math.abs(lengdeM(vei) - 1000) < 0.5, String(lengdeM(vei)));
  assert.ok(Math.abs(avstandTilLinje(utmTilGeo(280500, 6680300, 33), vei) - 300) < 0.5);
  assert.ok(Math.abs(avstandTilLinje(utmTilGeo(282000, 6680000, 33), vei) - 1000) < 0.5, 'utenfor enden måles til endepunktet');
  const g = wktTilGeo('LINESTRING Z (280000 6680000 100, 281000 6680000 110)');
  assert.equal(g.type, 'LineString'); assert.ok(Math.abs(g.coordinates[1][0] - b[0]) < 1e-6);
  assert.equal(wktTilGeo('POINT Z (280000 6680000 5)').type, 'Point');
});

test('veier: terrengtransport bruker bare bilveier', () => {
  const kv = (x0, y0) => ({ type: 'Polygon', coordinates: [[[x0, y0], [x0 + 100, y0], [x0 + 100, y0 + 100], [x0, y0 + 100], [x0, y0]].map(([x, y]) => utmTilGeo(x, y, 33))] });
  const bestand = [{ id: 'naer', geometri: kv(280450, 6680050) }, { id: 'langt', geometri: kv(280450, 6680750) }];
  const linje = (y) => ({ type: 'LineString', coordinates: [utmTilGeo(280000, y, 33), utmTilGeo(281000, y, 33)] });
  const veier = [{ id: 'bil', klasse: 3, geometri: linje(6680000) }, { id: 'traktor', klasse: 7, geometri: linje(6680800) }];
  const t = terrengtransport(bestand, veier);
  assert.ok(Math.abs(t.get('naer').meter - 100) < 1);
  assert.ok(Math.abs(t.get('langt').meter - 800) < 1, 'traktorveien skal ikke telle');
});

test('veier: vedlikeholdsforslag og kostnadsfordeling', () => {
  const veier = [{ id: 'v1', klasse: 3, lengde: 1000, tilstand: 'god' }, { id: 'v2', klasse: 7, lengde: 500, tilstand: 'darlig' }];
  const logg = [{ veiId: 'v1', type: 'grusing', aar: 2024, status: 'utfort' }, { veiId: 'v1', type: 'hovling', aar: 2026, status: 'planlagt' }];
  const f = foreslaaVedlikehold(veier, logg, 2026);
  const finn = (v, t) => f.find((x) => x.veiId === v && x.type === t);
  assert.equal(finn('v1', 'grusing').aar, 2030, 'grusing hvert 6. år');
  assert.equal(finn('v1', 'grusing').kostnad, 30000);
  assert.equal(finn('v1', 'hovling'), undefined, 'allerede planlagt');
  assert.equal(finn('v2', 'hovling'), undefined, 'traktorvei høvles ikke');
  assert.equal(finn('v2', 'grofterensk').aar, 2026, 'dårlig tilstand gir tiltak nå');
  const d = fordelKostnad(10000, [{ navn: 'A', andel: 60 }, { navn: 'B', andel: 60 }]);
  assert.equal(d[0].belop, 5000, 'andeler normaliseres');
  assert.equal(fordelKostnad(800, [])[0].belop, 800);
  const ny = nyVeiKostnad({ klasse: 3, lengde: 1000 }, STANDARD_VEIINNSTILLINGER);
  assert.equal(ny.brutto, 900000); assert.equal(ny.netto, 450000);
});

await Promise.all(venter);
console.log(`\n${ok} tester bestått`);
