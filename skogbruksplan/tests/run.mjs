// Kjør med: node tests/run.mjs
import assert from 'node:assert/strict';
import { utmTilGeo, geoTilUtm, arealM2, punktIGeometri, etikettPunkt } from '../js/proj.js';
import { parseSosi, lagSosi } from '../js/sosi.js';
import { hkGrenser, beregnetHogstklasse, hogstklasseAvvik, framskrivTilAar, startTilstand as startT } from '../js/model.js';
import { STANDARD_INNSTILLINGER, normaliserBestand, framskriv, foreslaaForEiendom, treslagFraSR16, foreslaaTiltak, laavesteHogstalder, sammendrag, tolkHogstklasse, tolkTreslag } from '../js/model.js';
import { lesGeojson, lesCsv, lesSosi, slaaSammen } from '../js/importers.js';
import { lagDemo } from '../js/demo.js';
import { finnKommune } from '../js/generator.js';
import { klassifiser, parseHtmlAlle, pakkUtKmz, parseKml } from '../js/kommuneanalyse.js';
import zlib from 'node:zlib';
import { pefcAlder, avstand, kontroller, kravStatus, klareringStatus, tomPefc, KRAVPUNKTER, ROVFUGLER, arealDaa } from '../js/pefc.js';
import { jordverdi, bestandsverdi, verdiberegning, kalibrerPriser, folsomhet, STANDARD_VERDI } from '../js/verdi.js';
import { kildeStatus } from '../js/pefc-ui.js';
import { hentDatagrunnlag } from '../js/datagrunnlag.js';
import { delFlate, nyttNr } from '../js/del.js';
import { lagKontekst } from '../js/ai-kontekst.js';
import { markdownTilHtml } from '../js/assistent.js';
import { brannnivaa, retningslinjerFor, risikoPerBestand, forebyggendeTiltak, nySkade, beregnSkade, forsikringsvurdering, oppgaverFor, brannkostnader, skademeldingTekst, naboer, iBrannsesong } from '../js/skade.js';
import { RAPPORTER, lagRapport, lagRapportCsv, hogstprognose } from '../js/rapporter.js';
import { klassifiser as klassifiserMarkslag, lagFigurer, arealfordeling } from '../js/markslag.js';
import { genererTiltak, anvend as anvendMotor, endringer as motorEndringer, plantetall, maalTetthet, oppdaterBestand } from '../js/tiltaksmotor.js';
import * as SP from '../js/skifteplan.js';
import * as DF from '../js/driftsforhold.js';
import { placemarkGeometri } from '../js/kml.js';
import { misFigurer } from '../js/miljokart.js';
import { parseKml as parseKmlKommune } from '../js/kommuneanalyse.js';
import { VERSJON, UTVIKLER, signatur } from '../js/versjon.js';
import { VEIKLASSER } from '../js/veier.js';
const VEIKLASSER_TEST = (k) => VEIKLASSER[k].bilvei;
import { readFileSync } from 'node:fs';
import * as VEG from '../js/vegetasjon.js';
import * as OPP from '../js/oppdrag.js';
import { TILTAKSTYPER as TILTAKSTYPER_T } from '../js/model.js';
import { lengdeM, avstandTilLinje, terrengtransport, foreslaaVedlikehold, fordelKostnad, wktTilGeo, nyVeiKostnad, STANDARD_VEIINNSTILLINGER, kjedeSammen, hentTraktorveierOgStier, slaaInnFkb, tomtVeiregister } from '../js/veier.js';

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

const kv = (x0, y0, s = 100) => ({ type: 'Polygon', coordinates: [[[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s], [x0, y0]].map(([x, y]) => utmTilGeo(x, y, 33))] });
const pkt = (x, y) => ({ type: 'Point', coordinates: utmTilGeo(x, y, 33) });
const plan = (bestand, ekstra = {}) => ({ eiendom: { takstAar: 2024, grense: kv(279000, 6679000, 3000) }, bestand, veier: { veier: [{ id: 'v' }] }, innstillinger: STANDARD_INNSTILLINGER, ...ekstra });
const best = (id, x, y, o = {}) => ({ ...normaliserBestand({ nr: id, treslag: 'G', bonitet: 17, alder: 90, volum_daa: 30, areal: 10 }, kv(x, y), 10, 2026), id, ...o });

test('PEFC: 30 kravpunkter og alderstabell fra standarden', () => {
  assert.equal(KRAVPUNKTER.length, 30);
  assert.deepEqual(KRAVPUNKTER.map((k) => k.nr), Array.from({ length: 30 }, (_, i) => i + 1));
  assert.equal(pefcAlder(17).nedre, 60); assert.equal(pefcAlder(17).omlop, 80);
  assert.equal(pefcAlder(26).nedre, 45); assert.equal(pefcAlder(6).nedre, 95); assert.equal(pefcAlder(11).nedre, 80);
  assert.equal(ROVFUGLER.hubro.buffer, 400); assert.equal(ROVFUGLER.honsehauk.hensyn, 80); assert.equal(ROVFUGLER.musvak.buffer, 50);
});

test('PEFC: avstand og areal', () => {
  assert.equal(avstand(kv(280000, 6680000), kv(280050, 6680050)), 0, 'overlapp');
  assert.ok(Math.abs(avstand(kv(280000, 6680000), kv(280300, 6680000)) - 200) < 0.5);
  assert.ok(Math.abs(avstand(kv(280000, 6680000), pkt(280150, 6680050)) - 50) < 0.5);
  assert.equal(avstand(kv(280000, 6680000), pkt(280050, 6680050)), 0, 'punkt inni');
  assert.ok(Math.abs(arealDaa(kv(280000, 6680000)) - 10) < 0.01);
  assert.equal(avstand(kv(280000, 6680000), kv(281000, 6680000), 100), Infinity, 'rask avvisning');
});

test('PEFC: minstealder for sluttavvirkning (K15)', () => {
  const ung = best('ung', 280000, 6680000, { alder: 50 });
  ung.tiltak = [{ id: 't1', type: 'sluttavvirkning', aar: 2026, status: 'planlagt' }];
  let f = kontroller(plan([ung]), tomPefc(), { iAar: 2026 });
  assert.ok(f.some((x) => x.krav === 15 && x.nivaa === 'avvik' && x.tiltakId === 't1'), 'G17 50 år < 60');
  const P = tomPefc(); P.klareringer.t1 = { begrunnelseMinstealder: 'Utilfredsstillende tetthet' };
  f = kontroller(plan([ung]), P, { iAar: 2026 });
  assert.ok(!f.some((x) => x.krav === 15 && x.nivaa === 'avvik'), 'begrunnelse lukker avviket');
});

test('PEFC: foryngelse innen 3 år (K15)', () => {
  const b = best('h', 280000, 6680000);
  b.tiltak = [{ id: 's', type: 'sluttavvirkning', aar: 2021, status: 'utfort', utfortDato: '2021-05-01' }];
  let f = kontroller(plan([b]), tomPefc(), { iAar: 2026 });
  assert.ok(f.some((x) => x.krav === 15 && x.nivaa === 'avvik' && /Foryngelse/.test(x.tittel)));
  b.tiltak.push({ id: 'p', type: 'planting', aar: 2022, status: 'utfort' });
  f = kontroller(plan([b]), tomPefc(), { iAar: 2026 });
  assert.ok(!f.some((x) => x.krav === 15 && /Foryngelse|Planting/.test(x.tittel)));
});

test('PEFC: rovfugl, nøkkelbiotop, BVO og livsløpstrær', () => {
  const b = best('b', 280000, 6680000);
  b.tiltak = [{ id: 's', type: 'sluttavvirkning', aar: 2026, status: 'planlagt' }];
  const P = tomPefc();
  P.objekter.push({ id: 'r', type: 'rovfuglreir', art: 'honsehauk', sisteHekking: 2024, geometri: pkt(280150, 6680050) }); // 50 m unna
  P.objekter.push({ id: 'n', type: 'noekkelbiotop', geometri: kv(280080, 6680080, 40) });
  let f = kontroller(plan([b]), P, { iAar: 2026 });
  assert.ok(f.some((x) => x.krav === 24 && x.nivaa === 'avvik'), 'innenfor 80 m hensynsområde');
  assert.ok(f.some((x) => x.krav === 24 && x.nivaa === 'varsel' && /1. mars–31. juli/.test(x.tittel)));
  assert.ok(f.some((x) => x.krav === 22 && x.nivaa === 'avvik' && x.bestandId === 'b'), 'hogst i nøkkelbiotop');
  P.objekter[0].sisteHekking = 2010; // over 10 år siden
  f = kontroller(plan([b]), P, { iAar: 2026 });
  assert.ok(!f.some((x) => x.krav === 24), 'hensyn utløpt');
  // BVO-krav over 1500 daa
  const mange = Array.from({ length: 160 }, (_, i) => best(`m${i}`, 282000 + (i % 40) * 100, 6681000 + Math.floor(i / 40) * 100));
  f = kontroller(plan(mange), tomPefc(), { iAar: 2026 });
  assert.ok(f.some((x) => x.krav === 23 && x.nivaa === 'avvik'));
  // Livsløpstrær etter utført hogst
  const h = best('h', 280000, 6680000); h.tiltak = [{ id: 'u', type: 'sluttavvirkning', aar: 2025, status: 'utfort', utfortDato: '2025-01-01' }, { id: 'p', type: 'planting', aar: 2026, status: 'planlagt' }];
  const P2 = tomPefc(); P2.objekter.push({ id: 'l', type: 'livslopstre', antall: 9, geometri: pkt(280050, 6680050) });
  f = kontroller(plan([h]), P2, { iAar: 2026 });
  assert.ok(f.some((x) => x.krav === 13 && x.nivaa === 'avvik' && /9 av minst 10/.test(x.tekst)));
  P2.objekter[0].antall = 10;
  f = kontroller(plan([h]), P2, { iAar: 2026 });
  assert.ok(f.some((x) => x.krav === 13 && x.nivaa === 'ok'));
});

test('PEFC: kantsone, kulturminne og status per kravpunkt', () => {
  const b = best('b', 280000, 6680000); b.tiltak = [{ id: 's', type: 'sluttavvirkning', aar: 2026, status: 'planlagt' }, { id: 'm', type: 'markberedning', aar: 2027, status: 'planlagt' }];
  const P = tomPefc();
  P.objekter.push({ id: 'v', type: 'vann', geometri: { type: 'LineString', coordinates: [utmTilGeo(280000, 6680110, 33), utmTilGeo(280100, 6680110, 33)] } });
  P.objekter.push({ id: 'k', type: 'kulturminne', geometri: kv(280040, 6680040, 5) });
  const f = kontroller(plan([b]), P, { iAar: 2026 });
  assert.ok(f.some((x) => x.krav === 27), 'kantsone mot bekk 10 m unna');
  assert.ok(f.some((x) => x.krav === 30));
  assert.ok(f.some((x) => x.krav === 16 && /5 m fra kulturminner/.test(x.tekst)));
  const st = kravStatus(f, P);
  assert.equal(st[27].status, 'varsel'); assert.equal(st[2].status, 'ikke-vurdert');
  P.kravstatus[2] = { status: 'ok' };
  assert.equal(kravStatus(f, P)[2].status, 'ok');
  const kl = klareringStatus(b.tiltak[0], b, f, P);
  assert.equal(kl.klar, false); assert.ok(kl.mangler > 10);
});

test('Verdi: jordverdi følger Faustmann og omløpet respekterer PEFC', () => {
  const inn = STANDARD_INNSTILLINGER;
  const { lev, omlop } = jordverdi('G', 17, inn, STANDARD_VERDI);
  assert.ok(omlop >= pefcAlder(17).nedre, `omløp ${omlop}`);
  assert.ok(lev > 0, `LEV ${lev}`);
  // Høyere rente gir lavere jordverdi
  assert.ok(jordverdi('G', 17, inn, { ...STANDARD_VERDI, rente: 5 }).lev < lev);
});

test('Verdi: bestandsverdi, slaktverdi og eiendomsverdi', () => {
  const inn = STANDARD_INNSTILLINGER;
  const gammel = normaliserBestand({ id: 'a', nr: '1', areal: 10, treslag: 'G', bonitet: 17, alder: 110, volumDaa: 30 });
  const ung = normaliserBestand({ id: 'b', nr: '2', areal: 10, treslag: 'G', bonitet: 17, alder: 20, volumDaa: 3 });
  const vg = bestandsverdi(gammel, inn, STANDARD_VERDI, { iAar: 2026 });
  assert.ok(vg.perDaa >= vg.slaktPerDaa, 'forventningsverdi ≥ slaktverdi for moden skog');
  assert.ok(vg.hogstAar >= 2026 && vg.hogstAar <= 2036, `hogstår ${vg.hogstAar}`);
  const vu = bestandsverdi(ung, inn, STANDARD_VERDI, { iAar: 2026 });
  assert.ok(vu.alderVedHogst >= pefcAlder(17).nedre, 'ikke hogst under nedre aldersgrense');
  assert.ok(vu.perDaa > vu.slaktPerDaa, 'ung skog er verdt mer enn slaktverdien');
  const S = { bestand: [gammel, ung], innstillinger: inn, veier: { vedlikehold: [{ status: 'planlagt', aar: 2027, kostnad: 5000 }] } };
  const r = verdiberegning(S, { ...STANDARD_VERDI, annenInntekt: 3000 }, { iAar: 2026 });
  assert.ok(Math.abs(r.skog - (vg.perDaa + vu.perDaa) * 10) < 1);
  assert.equal(r.veiPerAar, 1000);
  assert.ok(Math.abs(r.eiendom - (r.skog + 2000 / 0.03)) < 1);
  const uten = verdiberegning(S, STANDARD_VERDI, { iAar: 2026, utenProduksjonIder: new Set([gammel.id]) });
  assert.equal(uten.rader[0].verdi, 0);
  const fs = folsomhet(S, STANDARD_VERDI, [2, 4], { iAar: 2026 });
  assert.ok(fs[0].skog > fs[1].skog);
});

test('Verdi: kalibrering mot SSB-pris beholder forholdet mellom treslag', () => {
  const reg = (nr, pris) => ({ nr, navn: nr, pris, volum: 10000, perTreslag: { G: 8000, F: 2000, L: 0 } });
  const d = { aar: 2025, kommune: reg('3238', 500), fylke: reg('32', 480), land: reg('0', 470), grunnlag: '3238' };
  const k = kalibrerPriser(d, { G: 600, F: 400, L: 300 });
  assert.ok(Math.abs((0.8 * k.G + 0.2 * k.F) - 500) < 2);
  assert.ok(Math.abs(k.G / k.F - 1.5) < 0.01);
});

test('Datagrunnlag: alder på kilder og feil som ikke stopper', async () => {
  const naa = Date.parse('2026-10-04T12:00:00Z');
  assert.equal(kildeStatus(null).niva, 'mangler');
  assert.equal(kildeStatus({ hentet: '2026-10-01T12:00:00Z' }, naa).niva, 'fersk');
  assert.equal(kildeStatus({ hentet: '2026-03-01T12:00:00Z' }, naa).niva, 'bor');
  assert.equal(kildeStatus({ hentet: '2024-01-01T12:00:00Z' }, naa).niva, 'gammel');
  assert.equal(kildeStatus({ hentet: '2026-10-01T12:00:00Z', feil: 'x' }, naa).niva, 'feil');
  const plan = { eiendom: { grense: { type: 'Polygon', coordinates: [[[11, 60], [11.01, 60], [11.01, 60.01], [11, 60]]] } }, bestand: [] };
  let n = 0;
  const r = await hentDatagrunnlag(plan, { hvilke: ['nvdb', 'ssb'], kommunenr: '3238', nyId: () => `id${n++}`, hent: async () => { throw new Error('nede'); } });
  assert.equal(r.feil.length, 2);
  assert.ok(plan.datakilder && !plan.datakilder.ssb);
});

test('Etikettpunkt ligger inne i en L-formet flate', () => {
  const L = { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 2], [2, 2], [2, 10], [0, 10], [0, 0]]].map((r) => r.map(([x, y]) => [11 + x / 1000, 60 + y / 2000])) };
  const p = etikettPunkt(L);
  assert.ok(punktIGeometri(p, L));
  const mp = { type: 'MultiPolygon', coordinates: [L.coordinates, [[[12, 61], [12.0001, 61], [12.0001, 61.0001], [12, 61]]]] };
  assert.ok(punktIGeometri(etikettPunkt(mp), L), 'bruker største del');
});

test('Deling av bestand med linje', () => {
  const g = (pts) => pts.map(([x, y]) => [11 + x / 10000, 60 + y / 20000]);
  const kv = { type: 'Polygon', coordinates: [g([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]])] };
  const hel = arealM2(kv);
  // Linje tvers over, med knekk
  let r = delFlate(kv, g([[3, -2], [4, 5], [3, 12]]));
  assert.ok(r.deler, r.feil);
  assert.ok(Math.abs(arealM2(r.deler[0]) + arealM2(r.deler[1]) - hel) < 0.01);
  assert.ok(arealM2(r.deler[0]) >= arealM2(r.deler[1]));
  // Linje som starter og slutter inne i flaten forlenges til grensen
  r = delFlate(kv, g([[5, 1], [5, 9]]));
  assert.ok(Math.abs(arealM2(r.deler[0]) - hel / 2) / hel < 1e-6);
  // Linje som ikke krysser
  assert.ok(delFlate(kv, g([[20, 0], [20, 10]])).feil);
  // Hull havner i riktig del
  const medHull = { type: 'Polygon', coordinates: [...kv.coordinates, g([[7, 4], [8, 4], [8, 5], [7, 5], [7, 4]])] };
  r = delFlate(medHull, g([[5, -1], [5, 11]]));
  assert.equal(r.deler.reduce((s, d) => s + d.coordinates.length, 0), 3);
  assert.ok(Math.abs(arealM2(r.deler[0]) + arealM2(r.deler[1]) - arealM2(medHull)) < 0.01);
  assert.ok(delFlate(medHull, g([[7.5, -1], [7.5, 11]])).feil, 'krysser hull');
  // L-form der linjen kutter av en arm
  const L = { type: 'Polygon', coordinates: [g([[0, 0], [10, 0], [10, 2], [2, 2], [2, 10], [0, 10], [0, 0]])] };
  r = delFlate(L, g([[-1, 6], [3, 6]]));
  assert.ok(Math.abs(arealM2(r.deler[0]) + arealM2(r.deler[1]) - arealM2(L)) < 0.01);
  assert.equal(nyttNr('1-9', ['1-9', '1-12', '2-30']), '1-13');
  assert.equal(nyttNr('17', ['17', '3']), '18');
});

test('AI: plankontekst og trygg visning av svar', () => {
  const d = lagDemo(2026);
  const S = { ...d, innstillinger: STANDARD_INNSTILLINGER, registreringer: [] };
  const k = lagKontekst(S, { iAar: 2026 });
  assert.ok(k.includes('## Bestand') && k.includes('Demoskogen'));
  const del = k.split('## Bestand')[1].split('\n\n')[0];
  assert.equal(del.split('\n').length - 2, S.bestand.length, 'én linje per bestand');
  const b = S.bestand[0];
  const html = markdownTilHtml(`**Hogst** i [[${b.nr}]] og [[999]]\n- en <script>alert(1)</script>\n| a | b |\n|---|---|\n| 1 | 2 |`, (nr) => S.bestand.find((x) => String(x.nr) === nr));
  assert.ok(html.includes(`data-ai-bestand="${b.id}"`));
  assert.ok(html.includes('<b>999</b>'), 'ukjent bestand blir ren tekst');
  assert.ok(!html.includes('<script>') && html.includes('&lt;script&gt;'));
  assert.ok(html.includes('<table') && html.includes('<td>2</td>') && html.includes('<li>'));
});

test('Skogbrand: brannfare, retningslinjer og forsikringsvilkår', () => {
  assert.equal(brannnivaa(2).id, 'gronn'); assert.equal(brannnivaa(8).id, 'gul'); assert.equal(brannnivaa(15).id, 'oransje'); assert.equal(brannnivaa(25).id, 'rod'); assert.equal(brannnivaa(45).id, 'morkerod');
  assert.ok(retningslinjerFor('gronn').some((r) => /25 liter/.test(r)));
  assert.ok(!retningslinjerFor('gronn').some((r) => /SAMRÅD/.test(r)));
  assert.ok(retningslinjerFor('morkerod').some((r) => /SAMRÅD/.test(r)) && retningslinjerFor('morkerod').some((r) => /Markberedning/.test(r)));
  assert.ok(iBrannsesong(new Date('2026-07-01')) && !iBrannsesong(new Date('2026-10-01')) && iBrannsesong(new Date('2026-04-15')));
  const storm = { type: 'storm', skadeprosent: 30 };
  assert.equal(forsikringsvurdering(storm, { skadeDaa: 25 }).status, 'ok');
  assert.equal(forsikringsvurdering(storm, { skadeDaa: 15 }).status, 'under');
  assert.equal(forsikringsvurdering({ type: 'storm', skadeprosent: 20 }, { skadeDaa: 40 }).status, 'under');
  assert.equal(forsikringsvurdering({ type: 'bille', skadeprosent: 80 }, { skadeDaa: 40 }).status, 'ikke');
  assert.equal(forsikringsvurdering({ type: 'brann', skadeprosent: 100 }, { skadeDaa: 1 }).status, 'ok');
  assert.deepEqual(brannkostnader({ timer: [{ timer: 4, type: 'vakthold', attestert: true }, { timer: 2, type: 'traktor' }] }), { timer: 6, kr: 2400, attestert: 1200 });
  const o = oppgaverFor({ type: 'storm', dato: '2026-10-04', oppdaget: '2026-10-04' });
  assert.equal(o.find((x) => x.id === 'bille').frist, '2027-05-01');
  assert.ok(o.some((x) => x.id === 'vent'));
});

test('Skogbrand: risiko per bestand, naboer og skadeberegning', () => {
  const kv = (x, y, s = 200) => ({ type: 'Polygon', coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]].map(([a, b]) => utmTilGeo(a, b, 33))] });
  const b = (id, x, props) => ({ ...normaliserBestand({ nr: id, areal: 40, ...props }, kv(x, 6680000), 40, 2026), id });
  const hoy = b('1', 280000, { treslag: 'G', bonitet: 20, alder: 75, hoyde: 24, volumDaa: 40 });
  const naboHogd = b('2', 280200, { treslag: 'G', bonitet: 20, alder: 2, volumDaa: 1 });
  const furu = b('3', 280600, { treslag: 'F', bonitet: 8, alder: 90, hoyde: 13, volumDaa: 10 });
  const ung = b('4', 281000, { treslag: 'G', bonitet: 17, alder: 30, hoyde: 13, treantall: 180, volumDaa: 12 });
  const S = { bestand: [hoy, naboHogd, furu, ung], innstillinger: STANDARD_INNSTILLINGER, skogbrand: { skader: [] } };
  const nab = naboer(S.bestand);
  assert.deepEqual(nab.get('1').map((x) => x.id), ['2']);
  assert.equal(nab.get('3').length, 0);
  const r = risikoPerBestand(S, { iAar: 2026 });
  assert.equal(r.get('1').storm.nivaa.id, 'hoy', JSON.stringify(r.get('1').storm));
  assert.ok(r.get('1').storm.grunner.some((g) => /hogstkant/.test(g)));
  assert.ok(r.get('3').brann.p > r.get('1').brann.p, 'tørr furumark brenner lettere');
  assert.ok(r.get('3').bille.p < 10, 'furu: lav billerisiko');
  const forslag = forebyggendeTiltak(S, r, { iAar: 2026 });
  assert.ok(forslag.some((f) => f.b.id === '4' && f.type === 'tynning'), 'ung tett gran skal tynnes');
  // Uryddet stormskade ved siden av gir høyere billerisiko
  const skade = nySkade('storm', kv(280000, 6680000, 150));
  S.skogbrand.skader.push(skade);
  const r2 = risikoPerBestand(S, { iAar: 2026 });
  assert.ok(r2.get('1').bille.p > r.get('1').bille.p);
  const bs = beregnSkade(S, skade);
  assert.equal(bs.rader.length, 1); assert.equal(bs.rader[0].nr, '1');
  assert.ok(Math.abs(bs.skadeDaa - 22.5) < 0.5, `areal ${bs.skadeDaa}`);
  const tekst = skademeldingTekst({ ...S, eiendom: { navn: 'Test 1/1', kommune: 'Testby' } }, skade, bs);
  assert.ok(/STORMFELLING/.test(tekst) && /Bestand 1:/.test(tekst) && /Testby/.test(tekst));
});

test('Rapporter: hovedtall, bestandsliste, hogstprognose og PEFC', () => {
  const d = lagDemo(2026);
  const S = { ...d, innstillinger: STANDARD_INNSTILLINGER, registreringer: [] };
  const b = S.bestand.find((x) => x.alder >= 90);
  b.tiltak.push({ id: 'h1', type: 'sluttavvirkning', aar: 2028, status: 'planlagt' }, { id: 'p1', type: 'planting', aar: 2029, status: 'planlagt' });
  const h = hogstprognose(S, { iAar: 2026, aar: 10 });
  assert.equal(h.perioder.length, 2);
  assert.equal(h.hogst.length, 1); assert.equal(h.hogst[0].aar, 2028);
  assert.ok(h.perioder[0].slutt > 0 && h.perioder[0].kostnad > 0);
  assert.ok(!h.potensial.some((x) => x.b.id === b.id), 'bestand med planlagt hogst er ikke potensial');
  const pf = tomPefc(); const funn = kontroller(S, pf, { iAar: 2026 });
  for (const t of [...Object.keys(RAPPORTER), 'alle']) {
    const html = lagRapport(t, S, { iAar: 2026, pefc: { funn, status: kravStatus(funn, pf), P: pf } });
    assert.ok(html.startsWith('<!doctype html>') && !/NaN|undefined/.test(html), t);
  }
  const csvTekst = lagRapportCsv('bestandsliste', S, { iAar: 2026 });
  assert.equal(csvTekst.split('\n').length, S.bestand.length + 1);
  assert.ok(csvTekst.startsWith('\ufeffTeig;Bestand;Areal daa'));
});

test('Markslag: klassifisering av AR5, figurer og arealfordeling', () => {
  assert.equal(klassifiserMarkslag({ artype: '30', arskogbon: '13' }), 'produktiv');
  assert.equal(klassifiserMarkslag({ artype: '30', arskogbon: '11' }), 'impediment');
  assert.equal(klassifiserMarkslag({ artype: '60', arskogbon: '11' }), 'myr');
  assert.equal(klassifiserMarkslag({ artype: '60', arskogbon: '12' }), 'produktiv', 'skog på myr med bonitet er produktiv');
  assert.equal(klassifiserMarkslag({ artype: '50' }), 'apen');
  assert.equal(klassifiserMarkslag({ artype: '22' }), 'jordbruk');
  assert.equal(klassifiserMarkslag({ artype: '81' }), 'vann');
  const kv = { type: 'Polygon', coordinates: [[[11, 60], [11.001, 60], [11.001, 60.001], [11, 60]]] };
  const fig = lagFigurer([{ kategori: 'produktiv', areal: 50, geometri: kv }, { kategori: 'myr', areal: 3, geometri: kv }, { kategori: 'impediment', areal: 9, geometri: kv }, { kategori: 'impediment', areal: 12, geometri: kv }]);
  assert.deepEqual(fig.map((f) => [f.nr, f.kategori, f.areal]), [['U1', 'impediment', 12], ['U2', 'impediment', 9], ['U3', 'myr', 3]]);
  const d = lagDemo(2026);
  const S = { ...d, innstillinger: STANDARD_INNSTILLINGER, markslag: fig, metadata: { eiendomDaa: 900 } };
  const a = arealfordeling(S);
  assert.equal(a.rader.impediment.areal, 21); assert.equal(a.rader.myr.antall, 1);
  assert.equal(a.uproduktivSkog, 24); assert.equal(a.total, 900);
  const html = lagRapport('hovedtall', S, { iAar: 2026 });
  assert.ok(html.includes('Arealfordeling (markslag)') && html.includes('Uproduktiv skog (impediment)'));
  const liste = lagRapport('bestandsliste', S, { iAar: 2026 });
  assert.ok(liste.includes('Uproduktive arealer') && liste.includes('U3'));
});

test('Tiltaksmotor: biologi, bærekraft og økonomi – kort og lang sikt, endringer', () => {
  assert.deepEqual([plantetall('G', 20).anbefalt, plantetall('G', 17).min, plantetall('F', 8).intervall], [220, 100, '80–130']);
  assert.equal(maalTetthet('G', 17), 200); assert.equal(maalTetthet('G', 17, true), 120);
  const lag = (props) => normaliserBestand({ areal: 20, ...props }, null, props.areal || 20, 2026);
  const hogstmoden = lag({ nr: '1', treslag: 'G', bonitet: 20, alder: 80, volumDaa: 45, hoyde: 24 });
  const gammelLav = lag({ nr: '2', treslag: 'G', bonitet: 11, alder: 125, volumDaa: 18 });
  const ungTett = lag({ nr: '3', treslag: 'G', bonitet: 17, alder: 12, volumDaa: 2, hoyde: 3, treantall: 320 });
  const tynn = lag({ nr: '4', treslag: 'G', bonitet: 17, alder: 38, volumDaa: 20, hoyde: 13, treantall: 180 });
  const flate = lag({ nr: '5', treslag: 'G', bonitet: 17, alder: 0, volumDaa: 0 });
  const miljo = lag({ nr: '6', treslag: 'G', bonitet: 20, alder: 120, volumDaa: 50, miljo: 'Ja' });
  const S = { bestand: [hogstmoden, gammelLav, ungTett, tynn, flate, miljo], innstillinger: STANDARD_INNSTILLINGER };
  const f = genererTiltak(S, { iAar: 2026, horisont: 30 });
  const av = (b) => f.filter((x) => x.b === b).map((x) => `${x.type}:${x.aar}`);
  assert.ok(av(hogstmoden).some((x) => x.startsWith('sluttavvirkning')), 'hogstmoden G20 hogges (flate)');
  assert.ok(av(hogstmoden).some((x) => x.startsWith('planting')) && av(hogstmoden).some((x) => x.startsWith('markberedning')), 'flatehogst følges av markberedning og planting');
  assert.ok(av(gammelLav).some((x) => x.startsWith('lukkethogst')), 'gammel gran på lav bonitet → lukket hogst');
  assert.ok(av(ungTett).some((x) => x.startsWith('ungskogpleie:2026')), 'tett ungskog → ungskogpleie nå');
  assert.ok(av(tynn).some((x) => x.startsWith('tynning:2026')), '13 m høy gran på G17 → tynning nå');
  assert.ok(av(flate).some((x) => x.startsWith('planting')), 'hogstflate → planting');
  assert.equal(av(miljo).length, 0, 'miljøfigur får ingen tiltak');
  assert.ok(f.some((x) => x.periode === 'lang') && f.some((x) => x.periode === 'kort'));
  assert.ok(f.every((x) => x.begrunnelse && x.kilder.length), 'alle forslag har begrunnelse og kilder');
  // Biologi-prinsippet gir mer lukket hogst og senere hogst enn økonomi
  const bio = genererTiltak(S, { iAar: 2026, prinsipp: 'biologi' }); const oko = genererTiltak(S, { iAar: 2026, prinsipp: 'okonomi' });
  const forste = (l, b) => l.find((x) => x.b === b && ['sluttavvirkning', 'lukkethogst'].includes(x.type))?.aar ?? 9999;
  assert.ok(forste(bio, hogstmoden) >= forste(oko, hogstmoden));
  // Anvend og endringer
  const o = anvendMotor(S, { iAar: 2026 });
  assert.ok(o.antall > 5 && S.motor && S.bestand.every((b) => b.motor));
  assert.equal(motorEndringer(S, { iAar: 2026 }).length, 0, 'ingen endringer rett etter kjøring');
  const sa = tynn.tiltak.find((t) => t.type === 'tynning'); sa.status = 'utfort'; sa.aar = 2026;
  flate.tiltak.filter((t) => t.kilde === 'motor').forEach((t) => { t.status = 'utfort'; });
  ungTett.treantall = 160; // ungskogpleie utført i felt
  const e = motorEndringer(S, { iAar: 2026 });
  const eu = e.find((x) => x.b === ungTett);
  assert.ok(eu && eu.fjern.some((t) => t.type === 'ungskogpleie'), 'ungskogpleie fjernes når treantallet er lavt');
  oppdaterBestand(S, eu);
  assert.ok(!ungTett.tiltak.some((t) => t.type === 'ungskogpleie' && t.status !== 'utfort'));
  assert.equal(motorEndringer(S, { iAar: 2026, bestandIder: [ungTett.id] }).length, 0);
});

test('Skifteplan: gjødselbehov, forslag, fosforgrense, krav og journal', () => {
  const plan = SP.tomSkifteplan(2026, '3238');
  assert.equal(plan.region, 'innland'); assert.equal(SP.regionFraKommune('1103'), 'rogaland'); assert.equal(SP.regionFraKommune('5501'), 'nord');
  // Korreksjonstabeller (NIBIO)
  assert.equal(SP.pAlKorreksjon(1.5), 100); assert.equal(SP.pAlKorreksjon(6), 0); assert.equal(SP.pAlKorreksjon(12), -25); assert.equal(SP.pAlKorreksjon(20), -75);
  assert.equal(SP.kKorreksjon(5, 20), 50); assert.equal(SP.kKorreksjon(20, 120), -25); assert.equal(SP.moldKorreksjon(2), 2); assert.equal(SP.moldKorreksjon(8), 0); assert.equal(SP.moldKorreksjon(30), -2);
  // Fosforgrenser § 20
  assert.equal(SP.fosforgrense(2026), null); assert.equal(SP.fosforgrense(2027), 2.8); assert.equal(SP.fosforgrense(2031), 2.5); assert.equal(SP.fosforgrense(2035), 2.3); assert.equal(SP.fosforgrense(2028, 'rogaland'), 3.1);
  // AR5 → skifter (beite får kultur)
  const geo = (x) => ({ type: 'Polygon', coordinates: [[[x, 60.2], [x + 0.004, 60.2], [x + 0.004, 60.202], [x, 60.202], [x, 60.2]]] });
  const fig = [{ id: 'a', kategori: 'jordbruk', geometri: geo(11), areal: 50, ar5: { artype: 'Fulldyrka jord' } }, { id: 'b', kategori: 'jordbruk', geometri: geo(11.01), areal: 20, ar5: { artype: 'Innmarksbeite' } }, { id: 'c', kategori: 'myr', geometri: geo(11.02), areal: 9 }, { id: 'd', kategori: 'jordbruk', geometri: geo(11.03), areal: 0.4, ar5: { artype: 'Fulldyrka jord' } }];
  const nye = SP.skifterFraMarkslag(plan, fig, { iAar: 2026 });
  assert.equal(nye.length, 2); assert.equal(nye[0].artype, 21); assert.equal(nye[1].vekster[2026].kultur, 'beite');
  assert.equal(SP.skifterFraMarkslag(plan, fig, { iAar: 2026 }).length, 0, 'ingen duplikater');
  // Bygg etter eng med jordprøve
  const [a, b] = plan.skifter;
  a.vekster = { 2025: { kultur: 'engInt2' }, 2026: { kultur: 'bygg', avling: 550 } };
  a.jordprove = { dato: '2023-04-01', pH: 6.2, PAL: 12, KAL: 9, KHNO3: 60, mold: 3.5 };
  const be = SP.gjodselbehov(a, 2026);
  assert.equal(be.N, 9.9); assert.equal(be.P, 1.44); assert.equal(be.K, 8.1); // 11,1+0,8+1−3 · 1,925×0,75 · 6,5×1,25
  assert.equal(SP.gjodselbehov(b, 2026).N, 13 - 1.5); // beite 300 FEm: 13 + (300−400)/100 × 1,5
  const f = SP.foreslaGjodsling(a, 2026); assert.equal(f.length, 1);
  const n = SP.naering(f[0]); assert.ok(Math.abs(n.N - be.N) < 1.2, 'forslaget dekker N-behovet');
  a.gjodsling.push(...f.map((x, i) => ({ ...x, id: `g${i}` })));
  assert.equal(SP.foreslaGjodsling(a, 2026).length, 0, 'ikke nye forslag når behovet er dekket');
  // Husdyrgjødsel: plantetilgjengelig N = NH4 × virkningsgrad
  assert.deepEqual(SP.naering({ type: 'husdyr', produkt: 'storfe', mengde: 3, spredemaate: 'nedfelt' }), { N: 3.8, Ntot: 9, P: 1.5, K: 9 });
  // Krav
  b.gjodsling.push({ id: 'h', aar: 2026, type: 'husdyr', produkt: 'storfe', mengde: 3, spredemaate: 'overflate', dato: '2026-10-10', status: 'planlagt' });
  const S = { skifteplan: plan, markslag: [{ kategori: 'vann', geometri: geo(11.0045) }] };
  const k = SP.kontroller(S, 2026); const titler = k.map((x) => x.tittel).join(' | ');
  assert.ok(/påkrevd/.test(titler), 'gjødslingsplan påkrevd over 25 daa');
  assert.ok(k.some((x) => x.nivaa === 'avvik' && /utenfor spredeperioden/.test(x.tittel)), 'spredning i oktober er avvik');
  assert.ok(k.some((x) => x.nivaa === 'avvik' && x.skifteId === b.id && /ufullstendig/.test(x.tittel)), 'beite mangler jordprøve');
  a.jordprove.dato = '2015-04-01';
  assert.ok(SP.kontroller(S, 2026).some((x) => x.nivaa === 'avvik' && /11 år gammel/.test(x.tittel)), 'jordprøve over 8 år er avvik');
  // Fosfor over grensen fra 2027
  for (const x of [a, b]) { x.vekster[2027] = { kultur: 'engInt2', avling: 600 }; x.gjodsling.push({ id: `p${x.nr}`, aar: 2027, type: 'mineral', produkt: 'f22310', mengde: 200, dato: '2027-05-01', status: 'utfort' }); }
  assert.ok(SP.kontroller(S, 2027).some((x) => x.nivaa === 'avvik' && /over grensen/.test(x.tittel)));
  // Plantevern og vannjournal
  const sp = SP.nySproyting({ dato: '2026-06-10', skifter: [a.id] }); Object.assign(sp, { preparat: 'X', dose: 100, skadegjorer: 'ugras', karens: 30 });
  plan.sproyting.push(sp);
  assert.equal(SP.tidligsteHosting(sp), '2026-07-10');
  assert.ok(SP.avstandTilVann(a, S) < 50);
  assert.ok(SP.kontroller(S, 2026).some((x) => /Vannjournal/.test(x.tittel)));
  assert.ok(SP.sproytejournalCsv(S, 2026).split('\n').length === 2 && SP.gjodslingsplanCsv(S, 2026).includes('Bygg'));
  assert.ok(SP.kartskisse(plan, 2026).startsWith('<svg'));
  const o = SP.oppsummer(S, 2026); assert.equal(o.antall, 2); assert.ok(o.avvik >= 1);
});

test('Skifteplan: automatisk skifteinndeling (AR5 + jordsmonn)', async () => {
  assert.equal(SP.teksturGruppe('Siltig mellomsand og siltig finsand, lite grus'), 'sand');
  assert.equal(SP.teksturGruppe('Sandig silt og silt, lite grus'), 'silt');
  assert.equal(SP.teksturGruppe('Siltig lettleire, lite grus'), 'lettleire');
  assert.equal(SP.teksturGruppe('Siltig mellomleire, lite grus'), 'mellomleire');
  assert.equal(SP.jordKlasse({ tekstur: 'Siltig lettleire', drenering: 'Delvis selvdrenert' }), 'siltlett|svak');
  assert.equal(SP.jordKlasse({ tekstur: 'Sandig silt og silt', drenering: 'Selvdrenert' }), 'siltlett|god');
  // Geometri: 1 km × 100 m (= 100 daa) ved 60° N. Lengdegrad er halvparten så lang som breddegrad.
  const dLon = (m) => m / (111320 * 0.5); const dLat = (m) => m / 111320;
  const rekt = (x0, x1, y0 = 0, y1 = 100) => ({ type: 'Polygon', coordinates: [[[10 + dLon(x0), 60 + dLat(y0)], [10 + dLon(x1), 60 + dLat(y0)], [10 + dLon(x1), 60 + dLat(y1)], [10 + dLon(x0), 60 + dLat(y1)], [10 + dLon(x0), 60 + dLat(y0)]]] });
  assert.ok(Math.abs(SP.middelbredde(rekt(0, 1000)) - 2 * 100000 / 2200) < 3);
  const felt = { id: 'a', kategori: 'jordbruk', geometri: rekt(0, 1000), areal: 100, ar5: { artype: 'Fulldyrka jord' } };
  const stripe = { id: 'b', kategori: 'jordbruk', geometri: rekt(1000, 1300, 0, 5), areal: 1.5, ar5: { artype: 'Fulldyrka jord' } };
  const beite = { id: 'c', kategori: 'jordbruk', geometri: rekt(0, 300, 200, 300), areal: 30, ar5: { artype: 'Innmarksbeite' } };
  // Uten klipping: én AR5-figur = ett skifte, stripa utelates
  const u = SP.lagSkifteinndeling([felt, stripe, beite], { iAar: 2026 });
  assert.equal(u.skifter.length, 2); assert.equal(u.logg.utelatt, 1);
  assert.equal(u.skifter[0].artype, 23, 'nordligste (beitet) får nr 1'); assert.equal(u.skifter[0].vekster[2026].kultur, 'beite');
  let pc = null; try { pc = (await import('polygon-clipping')).default; } catch { /* valgfritt i testmiljøet */ }
  if (!pc) return;
  // Jordsmonn: vestre 600 m silt/selvdrenert, østre 400 m leire/ikke selvdrenert, liten organisk flekk (3 daa) i vest
  const jord = [
    { id: 'j1', geometri: rekt(-50, 600, -50, 150), tekstur: 'Sandig silt og silt', drenering: 'Selvdrenert' },
    { id: 'j2', geometri: rekt(600, 1400, -50, 150), tekstur: 'Siltig mellomleire', drenering: 'Ikke selvdrenert' },
  ];
  jord[0].geometri.coordinates.push(rekt(100, 130, 0, 100).coordinates[0].slice().reverse());
  jord.push({ id: 'j3', geometri: rekt(100, 130, 0, 100), tekstur: 'Torv', drenering: 'Ikke selvdrenert' });
  const r = SP.lagSkifteinndeling([felt, beite], { klipping: pc, jordsmonn: jord, iAar: 2026 });
  const fra = r.skifter.filter((x) => x.ar5Id === 'a').sort((x, y) => y.areal - x.areal);
  assert.equal(fra.length, 2, 'feltet deles i to etter jordsmonn; den organiske flekken (3 daa) slås inn');
  assert.ok(Math.abs(fra[0].areal - 60) < 1.5 && Math.abs(fra[1].areal - 40) < 1.5, `${fra.map((x) => x.areal)}`);
  assert.equal(fra[0].inndeling.klasse, 'siltlett|god'); assert.equal(fra[1].inndeling.klasse, 'leire|svak');
  assert.ok(fra[0].jordsmonn.tekstur && fra.every((x) => x.inndeling.delt));
});

test('Versjon og utvikler', () => {
  const pk = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pk.version, VERSJON, 'package.json og js/versjon.js må ha samme versjon');
  assert.equal(pk.author, 'Trond Harald Sand'); assert.equal(UTVIKLER, 'Trond Harald Sand');
  assert.match(VERSJON, /^\d+\.\d+\.\d+$/);
  const S = lagDemo(2026); S.innstillinger = { ...STANDARD_INNSTILLINGER, ...S.innstillinger };
  const html = lagRapport('hovedtall', S, { iAar: 2026 });
  assert.ok(html.includes(signatur()), 'rapporten viser versjon og utvikler');
});

test('Driftsforhold: markfuktighet, bæreevne, helning, vær og prioritering', () => {
  // DTW-farger fra NIBIOs WMS
  assert.equal(DF.dtwKlasse(0, 0, 255, 255), 'd0'); assert.equal(DF.dtwKlasse(135, 206, 250, 255), 'd75'); assert.equal(DF.dtwKlasse(0, 0, 0, 0), 'torr'); assert.equal(DF.dtwKlasse(255, 0, 0, 255), null);
  // Raster 10×10 piksler à 10 m: venstre halvdel 0–0,25 m, høyre halvdel tørr. Flate dekker hele ruten.
  const data = new Uint8ClampedArray(10 * 10 * 4);
  for (let j = 0; j < 10; j++) for (let i = 0; i < 5; i++) { const o = (j * 10 + i) * 4; data[o + 2] = 255; data[o + 3] = 255; }
  const flate = { type: 'Polygon', coordinates: [[[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]] };
  const a = DF.dtwForFlate(flate, { w: 10, h: 10, data, bbox: [0, 0, 100, 100] });
  assert.ok(Math.abs(a.d0 - 0.5) < 0.01 && Math.abs(a.torr - 0.5) < 0.01);
  assert.equal(DF.fuktIndeks(a), 0.8);
  // Bæreevne
  assert.equal(DF.baereevne('Torv og myr'), 'svaktDarlig'); assert.equal(DF.baereevne('Hav- og fjordavsetning, sammenhengende dekke'), 'darlig');
  assert.equal(DF.baereevne('Elve- og bekkeavsetning (Fluvial avsetning)'), 'middels'); assert.equal(DF.baereevne('Morenemateriale, sammenhengende dekke'), 'god');
  // Helning: plan som stiger 25 m per 100 m østover
  const pk = []; for (const x of [0, 50, 100]) for (const y of [0, 50, 100]) pk.push({ x, y, z: 0.25 * x + 100 });
  assert.ok(Math.abs(DF.helningProsent(pk) - 25) < 0.01); assert.equal(DF.helningKlasse(25).klasse, 3); assert.equal(DF.helningKlasse(60).klasse, 5);
  // Statisk risiko og sesong
  const torrMorene = DF.statiskRisiko({ dtw: { torr: 0.95, d75: 0.05 }, losmasse: 'Morenemateriale', helning: 8 });
  const vatLeire = DF.statiskRisiko({ dtw: { torr: 0.4, d0: 0.3, d25: 0.3 }, losmasse: 'Hav- og fjordavsetning', helning: 5 });
  const myr = DF.statiskRisiko({ dtw: { d0: 0.8, vann: 0.1, d25: 0.1 }, losmasse: 'Torv og myr', helning: 2 });
  assert.equal(torrMorene.sesong, 'helaar'); assert.ok(['vinter', 'tele'].includes(vatLeire.sesong)); assert.equal(myr.sesong, 'tele');
  assert.ok(torrMorene.poeng < vatLeire.poeng && vatLeire.poeng < myr.poeng);
  // Vær: tele gjør selv myr kjørbar, vannmettet jord og regn gjør leire verre
  assert.equal(DF.risikoNaa(myr, { teledyp: 25, snodybde: 40 }).nivaa.id, 'god');
  const vatt = DF.risikoNaa(vatLeire, { teledyp: 0, vannmetning: 95, nedbor3: 45 });
  assert.ok(vatt.risiko > vatLeire.poeng && ['utsett', 'stopp'].includes(vatt.nivaa.id));
  assert.ok(DF.risikoNaa(vatLeire, { teledyp: 0, vannmetning: 25 }).risiko < vatLeire.poeng, 'tørr mark senker risikoen');
  // NVE-svar og beste dag
  const nve = DF.parseNve({ StartDate: '05.10.2026 06:00:00', NoDataValue: 65535, Data: [1, 65535, 3] });
  assert.deepEqual(nve.map((x) => x.dato), ['2026-10-05', '2026-10-06', '2026-10-07']); assert.equal(nve[1].v, null);
  const dager = DF.medNedbor3([{ dato: '2026-10-06', vannmetning: 95, nedbor: 30 }, { dato: '2026-10-07', vannmetning: 92, nedbor: 20 }, { dato: '2026-10-08', teledyp: 25 }]);
  assert.equal(dager[1].nedbor3, 50);
  assert.equal(DF.besteDag(vatLeire, dager, '2026-10-06').dato, '2026-10-08');
  // Prioritering: kjørbar flate før verdifull, men våt flate
  const fl = [{ id: 'a', rotnetto: 900000, drift: { naa: { risiko: 80 } } }, { id: 'b', rotnetto: 300000, drift: { naa: { risiko: 10 } } }, { id: 'c', rotnetto: 800000, drift: { naa: { risiko: 12 } } }];
  assert.deepEqual(DF.prioriter(fl).map((f) => f.id), ['c', 'b', 'a']);
  assert.equal(DF.celleFor(11.0, 60.2), DF.celleFor(11.0005, 60.2001));
});

test('Nøkkelbiotoper: MiS som linjer i KML blir flater, og vises i rapportkartet', () => {
  const ring = (x0, y0, d) => `${x0},${y0} ${x0 + d},${y0} ${x0 + d},${y0 + d} ${x0},${y0 + d} ${x0},${y0}`;
  // NIBIO leverer MiS som <LineString>; indre ring blir hull
  const pm = `<name>Nokkelbiotop.4071</name><MultiGeometry><LineString><coordinates>${ring(11, 60, 0.01)}</coordinates></LineString><LineString><coordinates>${ring(11.004, 60.004, 0.002)}</coordinates></LineString></MultiGeometry>`;
  const g = placemarkGeometri(pm);
  assert.equal(g.type, 'Polygon'); assert.equal(g.coordinates.length, 2, 'ytre ring + hull');
  const m = parseKmlKommune(`<kml><Placemark>${pm}</Placemark><Placemark><name>Nokkelbiotop.9</name><LineString><coordinates>11.1,60.1 11.11,60.1 11.11,60.11</coordinates></LineString></Placemark></kml>`);
  assert.equal(m.size, 2); assert.equal(m.get('9').coordinates[0].length, 4, 'åpen linje lukkes');
  // Polygoner tolkes som før
  assert.equal(placemarkGeometri(`<Polygon><outerBoundaryIs><LinearRing><coordinates>${ring(10, 59, 0.01)}</coordinates></LinearRing></outerBoundaryIs></Polygon>`).type, 'Polygon');
  // Figurer fra planen og rapportkart
  const S = lagDemo(2026); S.innstillinger = { ...STANDARD_INNSTILLINGER, ...S.innstillinger };
  const b0 = S.bestand.find((b) => b.geometri);
  S.pefc = { objekter: [{ id: 'o1', type: 'noekkelbiotop', navn: 'Nøkkelbiotop (MiS 1)', geometri: b0.geometri }] };
  S.bestand[1].miljo = true;
  const f = misFigurer(S);
  assert.ok(f.some((x) => x.type === 'mis') && f.some((x) => x.type === 'miljofigur'));
  const html = lagRapport('hovedtall', S, { iAar: 2026 });
  assert.ok(html.includes('rkmis-skravur') && html.includes('Nøkkelbiotop (MiS)'), 'rapportkartet viser MiS med skravur');
});

test('Hogstklasse: aldersgrenser etter treslag og bonitet (kalibrert mot NIBIO-planer)', () => {
  const hk = (ts, bon, alder) => { const g = hkGrenser({ treslag: ts, bonitet: bon }); return beregnetHogstklasse(alder, g.V, 10, g); };
  // G20: III fra 20, IV fra 45, V fra 70 år (Landsskogtakseringen / NIBIO)
  assert.deepEqual(hkGrenser({ treslag: 'G', bonitet: 20 }), { III: 20, IV: 45, V: 70 });
  assert.deepEqual([19, 20, 44, 45, 69, 70].map((a) => hk('G', 20, a)), [2, 3, 3, 4, 4, 5]);
  // Takstmennenes klasser i dataene: G11 HK3 opp til 65 år, HK4 fra 70; G6 HK V fra 120; furu som gran
  assert.equal(hk('G', 11, 65), 3); assert.equal(hk('G', 11, 70), 4); assert.equal(hk('G', 11, 100), 5);
  assert.equal(hk('G', 6, 119), 4); assert.equal(hk('F', 6, 120), 5); assert.equal(hk('F', 14, 60), 4);
  // Lauv: L17 III fra 20, IV fra 40, V fra 60
  assert.deepEqual([15, 20, 40, 60].map((a) => hk('L', 17, a)), [2, 3, 4, 5]);
  // Grensene øker jevnt når boniteten synker, og III < IV < V
  for (const ts of ['G', 'F', 'L']) {
    let forrige = null;
    for (const bon of [26, 23, 20, 17, 14, 11, 8, 6]) {
      const g = hkGrenser({ treslag: ts, bonitet: bon });
      assert.ok(g.III < g.IV && g.IV < g.V, `${ts}${bon}`);
      if (forrige) assert.ok(g.III >= forrige.III && g.IV >= forrige.IV && g.V >= forrige.V, `${ts}${bon} monoton`);
      forrige = g;
    }
  }
  // Hogstklasse I ved alder under 3 år eller hogd (volum 0)
  assert.equal(beregnetHogstklasse(0, 70, 0, hkGrenser({ treslag: 'G', bonitet: 20 })), 1);
  // Avvik: registrert HK V på 40 år gammel G17 varsles; HK II på ung skog godtas
  const av = hogstklasseAvvik({ treslag: 'G', bonitet: 17, alder: 40, volumDaa: 12, hogstklasse: 5 });
  assert.equal(av.registrert, 5); assert.equal(av.beregnet, 3);
  assert.equal(hogstklasseAvvik({ treslag: 'G', bonitet: 17, alder: 10, volumDaa: 1, hogstklasse: 2 }), null);
  assert.equal(hogstklasseAvvik({ treslag: 'G', bonitet: 17, alder: 60, volumDaa: 20, hogstklasse: 4 }), null);
  assert.equal(hogstklasseAvvik({ treslag: 'G', bonitet: 17, alder: 60, volumDaa: 20 }), null, 'uten registrert HK – ingen kontroll');
});

test('Hogstklasse: alder og volum skrives frem fra takståret', () => {
  const b = { treslag: 'G', bonitet: 20, alder: 68, volumDaa: 30, takstAar: 2026 };
  const hkNaa = (x) => { const s2 = startT(x); const g = hkGrenser(x); return beregnetHogstklasse(s2.alder, g.V, s2.volumDaa, g); };
  assert.equal(hkNaa(b), 4);
  assert.equal(framskrivTilAar(b, 2026), 0, 'samme år: uendret');
  assert.equal(framskrivTilAar(b, 2028), 2);
  assert.equal(b.alder, 70); assert.equal(b.takstAar, 2028); assert.ok(b.volumDaa > 30, 'volumet har vokst');
  assert.equal(hkNaa(b), 5, '70 år på G20 er hogstklasse V');
  assert.equal(framskrivTilAar(b, 2028), 0, 'skrives ikke frem to ganger');
  const hogd = { treslag: 'G', bonitet: 17, alder: 0, volumDaa: 0, takstAar: 2020 };
  framskrivTilAar(hogd, 2026); assert.equal(hogd.alder, 6, 'hogstflate eldes også');
});

test('Vegetasjonstype: NIBIO vegetasjonskart, anslag fra treslag/bonitet og import', async () => {
  // Anslag: gran blåbær/småbregne, furu lav/lyng, høy bonitet lauv, organisk jord gir sumpskog
  assert.equal(VEG.anslaVegetasjon({ treslag: 'G', bonitet: 14 }).kode, '7b');
  assert.equal(VEG.anslaVegetasjon({ treslag: 'G', bonitet: 20 }).kode, '7c');
  assert.equal(VEG.anslaVegetasjon({ treslag: 'F', bonitet: 8 }).kode, '6a');
  assert.equal(VEG.anslaVegetasjon({ treslag: 'L', bonitet: 17 }).navn, 'Engbjørkeskog');
  assert.equal(VEG.anslaVegetasjon({ treslag: 'G', bonitet: 11, organisk: 0.7 }).kode, '8c');
  assert.equal(VEG.anslaVegetasjon({ treslag: 'G', bonitet: null }), null);
  // Import: kode, kode + navn, navn og fritekst
  assert.equal(VEG.tolkVegetasjon('7b').navn, 'Blåbærgranskog');
  assert.equal(VEG.tolkVegetasjon('6a Lav- og lyngrik furuskog').kode, '6a');
  assert.equal(VEG.tolkVegetasjon('Blåbærbjørkeskog').kode, '4b');
  assert.equal(VEG.tolkVegetasjon('storbregne gran').kode, '7c');
  assert.equal(VEG.tolkVegetasjon('Rik sumpskog').kode, '8d');
  assert.equal(normaliserBestand({ BESTANDNR: '1', VEGETASJONSTYPE: '7c Enggranskog' }, null, 1).vegetasjon.kode, '7c');
  assert.equal(normaliserBestand({ BESTANDNR: '1' }, null, 1).vegetasjon, null);
  // GML-egenskaper fra GetFeatureInfo
  const gml = `<msGMLOutput><Vegetasjonstypar_layer><Vegetasjonstypar_feature><figur_id>11</figur_id><reg_aar>2019</reg_aar><kartleggingsenhet_type1>7b</kartleggingsenhet_type1><type1_beskrivelse>Blåbærgranskog</type1_beskrivelse><hovudtype_beskrivelse>Granskog</hovudtype_beskrivelse></Vegetasjonstypar_feature><Vegetasjonstypar_feature><figur_id>12</figur_id><reg_aar>2019</reg_aar><kartleggingsenhet_type1>9c</kartleggingsenhet_type1><type1_beskrivelse>Grasmyr</type1_beskrivelse></Vegetasjonstypar_feature></Vegetasjonstypar_layer></msGMLOutput>`;
  assert.equal(VEG.parseVkGml(gml).get('12').type1_beskrivelse, 'Grasmyr');
  let pc = null; try { pc = (await import('polygon-clipping')).default; } catch { /* valgfritt i testmiljøet */ }
  if (!pc) return;
  // Kartlagt område: vestre 70 % blåbærgranskog, østre 30 % grasmyr. Bestand 1 ligger der; bestand 2 er utenfor.
  const firkant = (x0, x1, y0, y1) => ({ type: 'Polygon', coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] });
  const kmlPm = (id, g) => `<Placemark><name>Vegetasjonstypar.${id}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${g.coordinates[0].map((p) => p.join(',')).join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
  const kml = `<kml><Document>${kmlPm(11, firkant(11.0, 11.007, 60.0, 60.01))}${kmlPm(12, firkant(11.007, 11.02, 60.0, 60.01))}</Document></kml>`;
  const hent = async (url) => ({ ok: true, text: async () => (/GetMap/.test(url) ? kml : gml) });
  const bestand = [
    { nr: '1', treslag: 'G', bonitet: 14, geometri: firkant(11.0, 11.01, 60.0, 60.01) },
    { nr: '2', treslag: 'F', bonitet: 8, geometri: firkant(11.5, 11.51, 60.5, 60.51) },
    { nr: '3', treslag: 'G', bonitet: 20, geometri: firkant(11.5, 11.51, 60.5, 60.51), vegetasjon: { kode: '8d', navn: 'Rik sumpskog', kilde: 'manuell' } },
  ];
  const r = await VEG.settVegetasjon(bestand, { klipping: pc, hent });
  assert.equal(r.kartlagt, 1); assert.equal(r.anslatt, 1); assert.equal(r.aar, 2019);
  assert.equal(bestand[0].vegetasjon.kilde, 'vk'); assert.equal(bestand[0].vegetasjon.kode, '7b');
  assert.ok(Math.abs(bestand[0].vegetasjon.andel - 0.7) < 0.02, `${bestand[0].vegetasjon.andel}`);
  assert.equal(bestand[0].vegetasjon.typer[1].kode, '9c');
  assert.equal(bestand[1].vegetasjon.kilde, 'anslag'); assert.equal(bestand[1].vegetasjon.kode, '6a');
  assert.equal(bestand[2].vegetasjon.kode, '8d', 'manuell type beholdes');
  // Kartlagt som myr/hei (lite skog): skogtypen anslås, det kartlagte følger med
  const ikkeSkog = VEG.velgVegetasjon({ treslag: 'G', bonitet: 11 }, { vk: { dekning: 1, typer: [{ kode: '2e', navn: 'Rishei', andel: 0.8 }, { kode: '7b', navn: 'Blåbærgranskog', andel: 0.2 }] }, aar: 1986 });
  assert.equal(ikkeSkog.kilde, 'anslag'); assert.equal(ikkeSkog.kode, '7b'); assert.equal(ikkeSkog.kartlagt.typer[0].kode, '2e');
  const blandet = VEG.velgVegetasjon({ treslag: 'G', bonitet: 11 }, { vk: { dekning: 1, typer: [{ kode: '9c', navn: 'Grasmyr', andel: 0.6 }, { kode: '7c', navn: 'Enggranskog', andel: 0.4 }] } });
  assert.equal(blandet.kilde, 'vk'); assert.equal(blandet.kode, '7c', 'skogtypen velges når den dekker minst 25 %');
  // Tjenesten svarer ikke: alle anslås, feilen rapporteres
  const b2 = [{ nr: '1', treslag: 'G', bonitet: 17, geometri: firkant(11.0, 11.01, 60.0, 60.01) }];
  const r2 = await VEG.settVegetasjon(b2, { klipping: pc, hent: async () => ({ ok: false, status: 503 }) });
  assert.ok(r2.feil); assert.equal(b2[0].vegetasjon.kode, '7c');
});

test('Traktorveier og stier fra Kartverket FKB: henting, sammenslåing og fletting', async () => {
  // Eiendom ca. 1 × 1 km rundt UTM33 (300000, 6700000)
  const g = (x, y) => utmTilGeo(x, y, 33);
  const grense = { type: 'Polygon', coordinates: [[g(300000, 6700000), g(301000, 6700000), g(301000, 6701000), g(300000, 6701000), g(300000, 6700000)]] };
  // To traktorveilenker som henger sammen, én frittliggende, én sti, og én traktorvei langt utenfor eiendommen
  const f = (typeveg, ...pts) => ({ type: 'Feature', properties: { typeveg, klasselandbruksveg: '' }, geometry: { type: 'LineString', coordinates: pts } });
  const fc = { type: 'FeatureCollection', features: [
    f('traktorveg', [300100, 6700100], [300400, 6700100]), f('traktorveg', [300400, 6700100], [300400, 6700500]),
    f('traktorveg', [300800, 6700800], [300900, 6700900]),
    f('sti', [300200, 6700600], [300600, 6700600]),
    f('traktorveg', [305000, 6705000], [305500, 6705000]),
  ] };
  let url = '';
  const hent = async (u) => { url = u; return { ok: true, json: async () => fc }; };
  const r = await hentTraktorveierOgStier(grense, { hent });
  assert.ok(/typeNames=ms:traktorveg_sti/.test(url) && /srsName=EPSG:25833/.test(url));
  assert.equal(r.traktorveier.length, 2, 'to sammenhengende lenker blir én vei, lenken utenfor er utelatt');
  assert.ok(Math.abs(r.traktorveier[0].lengde - 700) < 3, `${r.traktorveier[0].lengde}`);
  assert.equal(r.traktorveier[0].klasse, 7); assert.equal(r.traktorveier[0].navn, 'Traktorvei 1');
  assert.equal(r.stier.length, 1); assert.ok(Math.abs(r.stier[0].lengde - 400) < 3);
  assert.equal(kjedeSammen([[g(0, 0), g(10, 0)], [g(10, 0), g(20, 0)], [g(50, 0), g(60, 0)]].map((l) => l)).length, 2);
  // Fletting: ny henting beholder tilstand og vedlikehold, legger ikke til duplikater
  let n = 0; const nyId = (p) => `${p}${++n}`;
  const reg = tomtVeiregister();
  reg.veier.push({ id: 'nvdb1', nvdb: true, navn: 'PV1', klasse: 2, geometri: { type: 'LineString', coordinates: [g(300000, 6700000), g(300100, 6700000)] }, lengde: 100 });
  const a = slaaInnFkb(reg, r, nyId);
  assert.equal(a.nye, 2); assert.equal(reg.veier.length, 3); assert.equal(reg.stier.length, 1);
  const v1 = reg.veier.find((v) => v.fkb && v.navn === 'Traktorvei 1');
  v1.tilstand = 'darlig'; reg.vedlikehold.push({ id: 'l1', veiId: v1.id, type: 'grofterensk', aar: 2027 });
  const b = slaaInnFkb(reg, await hentTraktorveierOgStier(grense, { hent }), nyId);
  assert.equal(b.nye, 0); assert.equal(b.oppdatert, 2); assert.equal(reg.veier.length, 3); assert.equal(reg.stier.length, 1);
  assert.equal(reg.veier.find((v) => v.id === v1.id).tilstand, 'darlig', 'tilstand beholdes');
  // Terrengtransport regner bare bilvei – traktorveier endrer ikke avstanden
  assert.equal(VEIKLASSER_TEST(7), false);
});

test('Oppdrag: én oppdragstype per tiltakstype, valg av tiltak, linjer, sammendrag og sletting', () => {
  // Alle tiltakstyper har en oppdragstype med felt og sjekkliste, og PEFC-henvisningene finnes
  for (const k of Object.keys(TILTAKSTYPER_T)) {
    const ot = OPP.OPPDRAGSTYPER[k];
    assert.ok(ot && ot.navn && ot.felt.length && ot.sjekk.length, k);
    for (const sj of ot.sjekk) if (sj.pefc) assert.ok(KRAVPUNKTER.some((kp) => kp.nr === sj.pefc), `${k}: PEFC ${sj.pefc}`);
  }
  let n = 0; const nyId = (p) => `${p}${++n}`;
  const S = { bestand: [
    { id: 'b1', nr: '1-1', areal: 10, tiltak: [{ id: 't1', type: 'sluttavvirkning', aar: 2027, status: 'planlagt' }, { id: 't2', type: 'planting', aar: 2028, status: 'planlagt' }] },
    { id: 'b2', nr: '1-2', areal: 5, tiltak: [{ id: 't3', type: 'sluttavvirkning', aar: 2026, status: 'planlagt' }, { id: 't4', type: 'tynning', aar: 2026, status: 'utfort' }] },
  ] };
  const v = (bi, ti) => ({ bestand: S.bestand[bi], tiltak: S.bestand[bi].tiltak[ti] });
  const r = OPP.lagOppdrag(S, [v(0, 0), v(1, 0), v(0, 1), v(1, 1)], { nyId, iAar: 2026, idag: '2026-10-08' });
  assert.equal(r.oppdrag.length, 2, 'hogst og planting blir to oppdrag');
  assert.equal(r.hoppetOver.length, 1, 'utført tiltak hoppes over');
  const hogst = r.oppdrag.find((o) => o.type === 'sluttavvirkning');
  assert.equal(hogst.nr, 'O-2026-01'); assert.equal(hogst.status, 'utkast'); assert.equal(hogst.linjer.length, 2);
  assert.equal(hogst.felt.driftsmetode, 'Hogstmaskin og lassbærer', 'standardverdier fylles inn');
  assert.equal(r.oppdrag.find((o) => o.type === 'planting').nr, 'O-2026-02');
  assert.equal(S.bestand[0].tiltak[0].oppdragId, hogst.id);
  // Samme tiltak kan ikke legges i to aktive oppdrag
  const r2 = OPP.lagOppdrag(S, [v(0, 0)], { nyId, iAar: 2026 });
  assert.equal(r2.oppdrag.length, 0); assert.equal(r2.hoppetOver.length, 1);
  // Sammendrag: areal, m³ fra økonomifunksjonen, plantetall fra feltet
  const sm = OPP.sammendrag(S, hogst, (t) => ({ m3: t.bestand.areal * 20, netto: 1000 }));
  assert.equal(sm.areal, 15); assert.equal(sm.m3, 300); assert.equal(sm.aar, 2026); assert.equal(sm.sjekk, 0);
  const pl = r.oppdrag.find((o) => o.type === 'planting');
  assert.equal(OPP.sammendrag(S, pl).antall, 2200, '220 planter per daa × 10 daa');
  // Fjerne linje og slette oppdrag frigjør tiltakene
  OPP.fjernLinje(S, hogst, 't3'); assert.equal(hogst.linjer.length, 1); assert.equal(S.bestand[1].tiltak[0].oppdragId, undefined);
  assert.equal(OPP.leggTil(S, hogst, [v(1, 0), v(0, 1)]), 1, 'bare samme type legges til');
  OPP.slettOppdrag(S, hogst); assert.equal(S.oppdrag.length, 1); assert.equal(S.bestand[0].tiltak[0].oppdragId, undefined);
  // Avsluttet oppdrag frigjør tiltaket for nytt oppdrag
  pl.status = 'avbrutt'; assert.ok(OPP.ledig(S.bestand[0].tiltak[1], S.oppdrag));
  assert.equal(OPP.nesteNr(S.oppdrag, 2026), 'O-2026-03');
});

await Promise.all(venter);
console.log(`\n${ok} tester bestått`);
