// Kjør med: node tests/run.mjs
import assert from 'node:assert/strict';
import { utmTilGeo, geoTilUtm, arealM2, punktIGeometri, etikettPunkt } from '../js/proj.js';
import { parseSosi, lagSosi } from '../js/sosi.js';
import { hkGrenser, beregnetHogstklasse, hogstklasseAvvik, framskrivTilAar, startTilstand as startT } from '../js/model.js';
import { STANDARD_INNSTILLINGER, normaliserBestand, framskriv, foreslaaForEiendom, treslagFraSR16, foreslaaTiltak, laavesteHogstalder, sammendrag, tolkHogstklasse, tolkTreslag } from '../js/model.js';
import { lesGeojson, lesCsv, lesSosi, slaaSammen } from '../js/importers.js';
import { lagDemo } from '../js/demo.js';
import { finnKommune, ryddKanterOgHull } from '../js/generator.js';
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
import { klassifiser as klassifiserMarkslag, lagFigurer, arealfordeling, svgTilGeometri, lesMvt, mvtFlateGeometri, hentAr5 } from '../js/markslag.js';
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
import * as KSL from '../js/ksl.js';
import * as MD from '../js/maskindata.js';
import * as SAT from '../js/satellitt.js';
import * as DREN from '../js/drenering.js';
import * as KRAV from '../js/krav.js';
import * as KB from '../js/karbon.js';
import { planBoks, hkFor, EIENDOM_FARGER } from '../js/flere-eiendommer.js';
import { flisUrler } from '../js/offline-kart.js';
import * as SPOR from '../js/sporlogg.js';
import * as TE from '../js/tiltak-endring.js';
import * as FG from '../js/flate-geometri.js';
import * as TR from '../js/treff.js';
import * as US from '../js/ungskog.js';
import * as OU from '../js/oppdrag-utvalg.js';
import * as TT from '../js/tetthet.js';
import * as DR from '../js/drone.js';
import * as SK from '../js/skog3d-data.js';
import * as SV from '../js/skog3d-veg.js';
import * as SO from '../js/skog3d-omgivelser.js';
import * as AR from '../js/ar-data.js';
import * as PS from '../js/plan-synk.js';
import * as VR from '../js/skog3d-vaer.js';
import { lagPlanRelay } from '../plan-relay.js';
import { lagRelay, KODE_GYLDIG_MS } from '../kontroller-relay.js';
import { tolkTetthet, alderFraHoyde, startTilstand as startT2, hogstklasseFor, foryngelse, vurderLiteVolum, rettFeilHogd, minForyngelse } from '../js/model.js';
import { ungskogHtml, effektHtml } from '../js/effekt-html.js';
import { genererTiltak as motorTiltak } from '../js/tiltaksmotor.js';
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
  assert.equal(klassifiserMarkslag({ artype: '60', arskogbon: '12' }), 'myr', 'myr skilles alltid ut, også skogkledd myr med bonitet');
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
  // Etter regulering etter bonitet: 150–250, høyere på høy bonitet; furu litt tettere
  assert.deepEqual([6, 11, 14, 17, 20, 23, 26].map((bo) => maalTetthet('G', bo)), [150, 160, 180, 200, 220, 240, 250]);
  assert.ok(maalTetthet('F', 14) > maalTetthet('G', 14)); assert.equal(maalTetthet('L', 23), 120); assert.equal(maalTetthet('G', 18), 200);
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

test('KSL: sjekklister, svar og avvik, kontroller med frister, dokumentasjon fra planen og egenrevisjon', () => {
  // Sjekklistene: kapittel 1 (2026.8), 10 (2026.9) og 15 (2024.4) med dokumentasjonskrav
  const k1 = KSL.KSL_KAPITLER.find((k) => k.nr === 1); const k10 = KSL.KSL_KAPITLER.find((k) => k.nr === 10);
  assert.equal(k1.versjon, '2026.8'); assert.equal(k1.sporsmal.length, 44); assert.equal(k10.sporsmal.length, 56);
  assert.ok(KSL.sporsmal('1.2.1').dok && KSL.sporsmal('10.2.1').dok && !KSL.sporsmal('1.3.1').dok);
  for (const k of KSL.KSL_KAPITLER) for (const q of k.sporsmal) assert.ok(k.seksjoner.some((sk) => q.nr.startsWith(`${sk.nr}.`)), q.nr);
  for (const t of [...Object.values(KSL.KONTROLLTYPER), ...Object.values(KSL.DOKUMENTTYPER)]) for (const nr of t.ksl) assert.ok(KSL.sporsmal(nr), `ukjent KSL-punkt ${nr}`);
  assert.equal(KSL.leggTilMnd('2026-01-31', 1), '2026-02-28');
  let n = 0; const nyId = (p) => `${p}${++n}`;
  const S = { skifteplan: { aar: 2026, skifter: [
    { id: 's1', nr: '1', areal: 20, vekster: { 2026: { kultur: 'engInt3' } }, jordprove: { dato: '2022-05-01' }, gjodsling: [{ id: 'g1', aar: 2026, type: 'mineral', mengde: 40, dato: '2026-05-02', status: 'utfort' }] },
    { id: 's2', nr: '2', areal: 10, vekster: { 2026: { kultur: 'bygg' } }, jordprove: { dato: '2015-05-01' }, gjodsling: [] },
  ], sproyting: [], ipv: {} } };
  const ksl = KSL.sikreKsl(S);
  assert.deepEqual(ksl.kapitler, [1, 10, 15], 'kapittel 15 tas med når gården har skifter');
  // Dokumentasjon fra skifteplanen
  assert.equal(KSL.appBevis(S, '1.2.1', 2026).status, 'delvis', 'skifte 2 har jordprøve eldre enn 8 år');
  assert.equal(KSL.appBevis(S, '1.2.2', 2026).status, 'delvis', 'skifte 2 mangler planlagt gjødsling');
  assert.equal(KSL.appBevis(S, '1.2.3', 2026).status, 'ok');
  assert.equal(KSL.appBevis({ skifteplan: { skifter: [{ id: 'x', nr: '1', vekster: {} }] } }, '1.2.1', 2026).status, 'mangler', 'skifter uten vekst');
  assert.equal(KSL.appBevis(S, '10.2.1', 2026, '2026-10-09').status, 'mangler');
  // Kontroller og frister
  ksl.kontroller.push({ id: 'k1', type: 'vernerunde', dato: '2025-09-01' }, { id: 'k2', type: 'funksjonstest', dato: '2025-04-01' });
  const st = KSL.kontrollStatus(ksl, '2026-10-09');
  assert.equal(st.find((k) => k.type === 'vernerunde').status, 'forfalt'); assert.equal(st.find((k) => k.type === 'vernerunde').neste, '2026-09-01');
  assert.equal(st.find((k) => k.type === 'funksjonstest').neste, '2028-04-01'); assert.equal(st.find((k) => k.type === 'funksjonstest').status, 'ok');
  assert.equal(KSL.appBevis(S, '1.5.7', 2026, '2026-10-09').status, 'ok');
  // Svar «nei» gir avvik, dokument dekker dokumentasjonskravet
  const r = KSL.revisjon(ksl, 2026, { nyId });
  KSL.settSvar(ksl, r, '10.3.1', 'nei', { nyId, idag: '2026-10-09' });
  KSL.settSvar(ksl, r, '10.3.1', 'nei', { nyId, idag: '2026-10-09' });
  assert.equal(ksl.avvik.length, 1, 'ett åpent avvik per punkt'); assert.equal(ksl.avvik[0].frist, '2026-11-09');
  ksl.dokumenter.push({ id: 'd1', type: 'risikovurdering', navn: 'Risikovurdering 2026', dato: '2026-03-01', ksl: [] });
  const v = KSL.vurdering(S, 2026, '2026-10-09');
  assert.ok(v.find((q) => q.nr === '10.3.1').dokumentert, 'dokumenttypen dekker 10.3.1');
  assert.ok(!v.find((q) => q.nr === '1.1.1').dokumentert);
  // Varsler og fullføring
  const vars = KSL.kslVarsler(S, 2026, '2026-10-09');
  assert.ok(vars.some((x) => /egenrevisjon/i.test(x.tittel)) && vars.some((x) => /kontroller/i.test(x.tittel)));
  assert.equal(KSL.fullfor(S, 2026, { dato: '2026-10-09', nyId }).ok, false, 'ubesvarte spørsmål');
  for (const q of KSL.vurdering(S, 2026)) if (!q.svar) KSL.settSvar(ksl, r, q.nr, 'ja', { nyId });
  assert.equal(KSL.fullfor(S, 2026, { dato: '2026-10-09', utfortAv: 'Test', nyId }).ok, true);
  const o = KSL.oppsummering(S, 2026, '2026-10-09');
  assert.ok(o.ferdig && !o.revisjonForfalt); assert.equal(o.nesteRevisjon, '2027-10-09');
  assert.equal(KSL.kontrollStatus(ksl, '2026-10-09').find((k) => k.type === 'egenrevisjon').status, 'ok');
});

test('Kantsoner og hull: smale SR16-rester slås sammen eller blir kantsone, hull fylles og store hull blir bestand', async () => {
  let T = null; let pc = null;
  try { T = await import('@turf/turf'); pc = (await import('polygon-clipping')).default; } catch { return; /* valgfritt i testmiljøet */ }
  const g = (x, y) => utmTilGeo(300000 + x, 6700000 + y, 33);
  const rekt = (x0, x1, y0, y1) => ({ type: 'Polygon', coordinates: [[g(x0, y0), g(x1, y0), g(x1, y1), g(x0, y1), g(x0, y0)]] });
  const feat = (geometry) => ({ type: 'Feature', geometry, properties: {} });
  const fraPC = (mp) => (mp && mp.length ? feat(mp.length === 1 ? { type: 'Polygon', coordinates: mp[0] } : { type: 'MultiPolygon', coordinates: mp }) : null);
  const forening = (l) => fraPC(pc.union(...l.map((f) => f.geometry.coordinates)));
  const snitt = (a, b) => fraPC(pc.intersection(a.geometry.coordinates, b.geometry.coordinates));
  const trygg = (fn) => { try { return fn(); } catch { return null; } };
  // Eiendom 300 × 200 m. Plan: 1-1 (0–200 × 0–200). SR16-stripe S1 8 m bred langs 1-1 (200–208).
  // Stripe S2 (10 m bred) mot åkeren 208–290 × 0–90. Hullet 208–300 × 90–200 (ca. 10 daa, 110 m bredt) blir nytt bestand.
  const bestand = [
    { nr: '1-1', areal: 40, geometri: rekt(0, 200, 0, 200), merknad: '' },
    { nr: 'S1', areal: 1.6, geometri: rekt(200, 208, 0, 200), merknad: '' },
    { nr: 'S2', areal: 0.9, geometri: rekt(290, 300, 0, 90), merknad: '' },
  ];
  const markslag = [{ nr: 'U1', kategori: 'jordbruk', areal: 7.4, geometri: rekt(208, 290, 0, 90) }];
  const eiendom = feat(rekt(0, 300, 0, 200));
  let nye = 0;
  const r = ryddKanterOgHull({ bestand, markslag, eiendom, T, PC: pc, feat, arealM2: (x) => (x ? T.area(x) : 0), forening, snitt, trygg, nyId: (p) => `${p}1`, nyttBestand: (geo) => { nye++; return { nr: 'S', areal: T.area(geo) / 1000, geometri: geo, merknad: 'ny' }; } });
  assert.equal(r.kantsoner, 2, 'S1 slås sammen med 1-1, S2 med det nye bestandet');
  const b11 = bestand.find((b) => b.nr === '1-1');
  assert.ok(Math.abs(b11.areal - 41.6) < 0.5, `${b11.areal}`); assert.match(b11.merknad, /Kantsone/);
  assert.equal(nye, 1, 'stort hull blir nytt bestand');
  assert.equal(r.tilMarkslag, 0, 'S2 grenser mot det nye bestandet og slås sammen med det');
  assert.ok(!bestand.some((b) => b.nr === 'S2' && b.areal < 1), 'ingen smal stripe igjen som eget bestand');
  // Alt er dekket: bestand + markslag = eiendom
  const sum = bestand.reduce((s, b) => s + b.areal, 0) + markslag.reduce((s, m) => s + m.areal, 0);
  assert.ok(Math.abs(sum - 60) < 0.8, `dekning ${sum}`);
  // Isolert stripe mot åker uten nabobestand blir markslagsfigur «Kantsone»
  const b2 = [{ nr: 'S1', areal: 0.9, geometri: rekt(290, 300, 0, 90), merknad: '' }];
  const m2 = [{ nr: 'U1', kategori: 'jordbruk', areal: 26.1, geometri: rekt(0, 290, 0, 90) }];
  const r2 = ryddKanterOgHull({ bestand: b2, markslag: m2, eiendom: feat(rekt(0, 300, 0, 90)), T, PC: pc, feat, arealM2: (x) => (x ? T.area(x) : 0), forening, snitt, trygg, nyId: (p) => `${p}2` });
  assert.equal(r2.tilMarkslag, 1); assert.equal(b2.length, 0); assert.equal(m2.at(-1).kategori, 'kantsone'); assert.equal(m2.at(-1).nr, 'U2');
});

test('AR5: geometri fra SVG-utskriften (flater med ugyldig geometri i KML)', () => {
  // Boks 100 × 100 m tegnet i 1000 × 1000 px: ytre ring 10–90 m med hull 40–60 m, og en egen flate 92–98 m.
  const b = [300000, 6700000, 300100, 6700100];
  const svg = `<svg><g><path style="fill:red" d="M 100 100 L 900 100 L 900 900 L 100 900 Z M 400 400 L 600 400 L 600 600 L 400 600 Z M 400 400 "/><path d="M 920 920 L 980 920 L 980 980 L 920 980 Z"/></g></svg>`;
  const g = svgTilGeometri(svg, b, 1000, 1000);
  assert.equal(g.type, 'MultiPolygon'); assert.equal(g.coordinates.length, 2);
  assert.equal(g.coordinates[0].length, 2, 'hullet hører til den store flaten');
  assert.ok(Math.abs(arealM2(g) - (6400 - 400 + 36)) < 60, `${arealM2(g)}`); // kuleflate mot UTM: under 1 %
  const [x, y] = geoTilUtm(...g.coordinates[0][0][0], 33);
  assert.ok(Math.abs(x - 300010) < 0.5 && Math.abs(y - 6700090) < 0.5, `${x} ${y}`);
  assert.equal(svgTilGeometri('<svg></svg>', b, 1000, 1000), null);
});

test('Markslag: AR5 som vektorflis (MVT) – attributter, hull, klipping mot ruten og henting', async () => {
  // Minimal protobuf-skriver for testflisen.
  const vi = (n) => { const u = []; do { let b = n % 128; n = Math.floor(n / 128); if (n) b |= 128; u.push(b); } while (n); return u; };
  const fld = (f, bytes) => [...vi(f * 8 + 2), ...vi(bytes.length), ...bytes]; const tall = (f, n) => [...vi(f * 8), ...vi(n)];
  const str = (t) => [...new TextEncoder().encode(t)]; const zz = (n) => (n < 0 ? -2 * n - 1 : 2 * n);
  const geom = (...rr) => { let x = 0; let y = 0; return rr.flatMap((pts) => { const g = [...vi((1 & 7) | (1 << 3))]; g.push(...vi(zz(pts[0][0] - x)), ...vi(zz(pts[0][1] - y))); [x, y] = pts[0]; g.push(...vi(2 | ((pts.length - 1) << 3))); for (const [a, b] of pts.slice(1)) { g.push(...vi(zz(a - x)), ...vi(zz(b - y))); x = a; y = b; } g.push(...vi(7 | (1 << 3))); return g; }); };
  // Flate 1: kvadrat fra -160 til 2048 (går ut i bufferen) med et hull; flate 2: lite kvadrat. Attributter som i AR5.
  const g1 = geom([[-160, -160], [2048, -160], [2048, 2048], [-160, 2048]], [[500, 500], [500, 1000], [1000, 1000], [1000, 500]]);
  const g2 = geom([[3000, 3000], [3500, 3000], [3500, 3500], [3000, 3500]]);
  const lag = [...fld(1, str('Arealtype')), ...fld(3, str('artype')), ...fld(3, str('arskogbon')), ...fld(3, str('sl_sdeid')), ...fld(3, str('artype_beskrivelse')),
    ...fld(4, tall(5, 30)), ...fld(4, tall(5, 13)), ...fld(4, tall(5, 111)), ...fld(4, fld(1, str('Skog'))), ...fld(4, tall(5, 60)), ...fld(4, tall(5, 222)), ...fld(4, fld(1, str('Myr'))),
    ...fld(2, [...tall(1, 111), ...fld(2, [0, 0, 1, 1, 2, 2, 3, 3]), ...tall(3, 3), ...fld(4, g1)]),
    ...fld(2, [...tall(1, 222), ...fld(2, [0, 4, 2, 5, 3, 6]), ...tall(3, 3), ...fld(4, g2)]), ...tall(5, 4096), ...tall(15, 2)];
  const u8 = new Uint8Array(fld(3, lag));
  const [l] = lesMvt(u8);
  assert.equal(l.navn, 'Arealtype'); assert.equal(l.utstrekning, 4096); assert.equal(l.flater.length, 2);
  assert.deepEqual(l.flater[0].attributter, { artype: 30, arskogbon: 13, sl_sdeid: 111, artype_beskrivelse: 'Skog' });
  assert.equal(l.flater[1].attributter.artype_beskrivelse, 'Myr'); assert.equal(l.flater[0].ringer.length, 2);
  // Ruten er 2048 × 2048 m → 0,5 m per enhet. Bufferen klippes bort: flate 1 blir 1024 × 1024 m minus hullet 250 × 250 m.
  const b = [300000, 6700000, 302048, 6702048];
  const g = mvtFlateGeometri(l.flater[0], b, 4096);
  assert.equal(g.type, 'Polygon'); assert.equal(g.coordinates.length, 2, 'hullet er med');
  assert.ok(Math.abs(arealM2(g) - (1024 * 1024 - 250 * 250)) / (1024 * 1024) < 0.01, `${arealM2(g)}`);
  const [x, y] = geoTilUtm(...g.coordinates[0].reduce((a, p) => (p[0] < a[0] ? p : a)), 33);
  assert.ok(Math.abs(x - 300000) < 0.5 && y <= 6702048.5 && y >= 6701023, `${x} ${y}`);
  // Henting: én rute dekker en liten eiendom; myra klassifiseres og vann/attributter følger med.
  const [lo0, la0] = utmTilGeo(300100, 6700100, 33); const [lo1, la1] = utmTilGeo(301900, 6701900, 33);
  const grense = { type: 'Polygon', coordinates: [[[lo0, la0], [lo1, la0], [lo1, la1], [lo0, la1], [lo0, la0]]] };
  const urler = [];
  const hent = async (u) => { urler.push(u); return { ok: true, status: 200, arrayBuffer: async () => u8.slice().buffer }; };
  const fl = await hentAr5(grense, { hent });
  assert.ok(urler.every((u) => /FORMAT=mvt/.test(u)) && urler.length >= 1, urler.join('\n'));
  assert.deepEqual(fl.map((f) => f.kategori).sort(), ['myr', 'produktiv']);
  assert.equal(fl.find((f) => f.kategori === 'produktiv').ar5.bonitet, 'Middels');
  // Leverer ikke tjenesten vektorfliser (XML-feilmelding), brukes KML.
  const kml = []; const hentX = async (u) => { kml.push(u); return /FORMAT=mvt/.test(u) ? { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode('<?xml version="1.0"?><ServiceExceptionReport/>').buffer } : { ok: true, status: 200, text: async () => '<kml></kml>' }; };
  await hentAr5(grense, { hent: hentX }).catch(() => null);
  assert.ok(kml.some((u) => /FORMAT=kml/.test(u)));
});

test('Karbon: faktorer, scenarioer mot referanse, usikkerhet, egnethet, prosjekt og varsler', () => {
  // Faktorer: stamme (IPCC-densitet) × ekspansjon til hele treet – innenfor 1,1–1,5 t CO₂/m³.
  for (const v of Object.values(KB.KARBON_FAKTOR)) assert.ok(v > 1.05 && v < 1.5, `${v}`);
  const S = lagDemo(2026);
  const sc = KB.scenarioer(S, { iAar: 2026 });
  assert.equal(sc.rader.length, 31);
  assert.ok(sc.hogstProsjekt < sc.hogstRef, 'karbonbanen hogger mindre enn referansen');
  assert.ok(sc.merSlutt > 0 && sc.kreditter > 0 && sc.kreditter < sc.merSlutt, 'kreditter etter fradrag er mindre enn merlageret');
  // Kreditter: aldri mer enn merlageret × fradragsfaktor, og bufferen er avsatt.
  const f = (1 - sc.k.lekkasje / 100) * (1 - sc.u.fradrag / 100);
  const maks = Math.max(...sc.rader.map((r) => r.mer)) * f;
  assert.ok(Math.abs(sc.kreditter + sc.buffer - maks) < 1, `${sc.kreditter + sc.buffer} vs ${maks}`);
  // Usikkerhet: VM0045 halvbredde − 15, minst 10 % (CRCF); uten prøveflater høyt fradrag.
  assert.equal(KB.usikkerhet({ proveflater: 0, cv: 45 }).fradrag, 30);
  const u = KB.usikkerhet({ proveflater: 20, cv: 45 }); assert.ok(Math.abs(u.halvbredde - 19.72) < 0.05); assert.equal(u.fradrag, 10);
  assert.ok(KB.usikkerhet({ proveflater: 4, cv: 45 }).fradrag > 25);
  assert.equal(KB.proveflaterFor({ cv: 45 }, 10), 13);
  // Vernede bestand er utenfor.
  const vern = S.bestand.find((b) => b.miljo);
  if (vern) assert.ok(!sc.bestandIder.includes(vern.id));
  // Egnethet med manuelle punkter.
  const e = KB.egnethet(S, { iAar: 2026 });
  assert.ok(e.punkter.some((x) => x.id === 'proveflater') && e.punkter.some((x) => x.id === 'juridisk' && x.manuell));
  KB.sikreKarbon(S).sjekk.juridisk = true;
  assert.equal(KB.egnethet(S, { iAar: 2026 }).punkter.find((x) => x.id === 'juridisk').status, 'ok');
  // Prosjekt: karbontiltak i planen, karbonreglene i motoren og varsel ved hogst utenfor karbonbanen.
  const p = KB.nyttProsjekt(S, { iAar: 2026 });
  assert.ok(p.bestand.length > 0 && p.status === 'vurdering');
  KB.settStatus(S, 'forberedelse');
  const n = KB.brukKarbontiltak(S, { iAar: 2026 });
  assert.ok(n > 0);
  assert.ok(S.bestand.some((b) => (b.tiltak || []).some((t) => t.karbon && t.type === 'gjodsling')), 'gjødsling før hogst i karbonbanen');
  assert.equal(KB.karbonVarsler(S, { iAar: 2026 }).length, 0);
  const b = S.bestand.find((x) => p.bestand.includes(x.id));
  b.tiltak.push({ id: 'x', type: 'sluttavvirkning', aar: 2028, status: 'planlagt' });
  assert.ok(KB.karbonVarsler(S, { iAar: 2026 }).some((v) => v.nivaa === 'hoy' && v.bestand === b.id));
  // Verifisering og kredittstatus.
  KB.settStatus(S, 'registrert'); KB.sikreKarbon(S).prosjekt.startAar = 2020;
  assert.ok(KB.karbonVarsler(S, { iAar: 2026 }).some((v) => v.tittel === 'Verifisering forfaller'));
  KB.nyVerifikasjon(S, { aar: 2026, verifisertT: 1000, bufferT: 150, utstedtT: 850, solgtT: 500, prisNok: 290 });
  const st = KB.kredittstatus(S); assert.equal(st.beholdning, 350); assert.equal(st.inntekt, 145000);
});

test('Tiltaksmotor: prinsippet «karbon og klima» og bestand i karbonprosjekt', () => {
  const S = lagDemo(2026);
  const bal = genererTiltak(S, { iAar: 2026, prinsipp: 'balansert' }); const kar = genererTiltak(S, { iAar: 2026, prinsipp: 'karbon' });
  const hogst = (l) => l.filter((f) => f.type === 'sluttavvirkning').length;
  assert.ok(hogst(kar) < hogst(bal), `${hogst(kar)} < ${hogst(bal)}`);
  const pl = kar.find((f) => f.type === 'planting');
  if (pl) assert.match(pl.kommentar, /foredlede planter/);
  // Organisk jord: lukket hogst i stedet for flatehogst.
  const b = S.bestand.find((x) => x.treslag === 'G' && (x.alder || 0) > 70 && !x.miljo);
  b.vegetasjon = { kode: '8c', navn: 'Fuktskog' };
  const f = genererTiltak(S, { iAar: 2026, prinsipp: 'karbon' }).filter((x) => x.b === b && ['sluttavvirkning', 'lukkethogst'].includes(x.type));
  assert.ok(f.length && f.every((x) => x.type === 'lukkethogst'), f.map((x) => x.type).join());
  // Bestand i aktivt karbonprosjekt får karbonreglene selv om planen ellers er «økonomi først».
  S.karbon = { prosjekt: { status: 'registrert', bestand: [b.id] } };
  const oko = genererTiltak(S, { iAar: 2026, prinsipp: 'okonomi' }).filter((x) => x.b === b && ['sluttavvirkning', 'lukkethogst'].includes(x.type));
  assert.ok(oko.every((x) => x.type === 'lukkethogst'));
});

test('Flere eiendommer: avgrensning per plan og hogstklasse med planens egne innstillinger', () => {
  const S = lagDemo(2026);
  const bb = planBoks(S);
  assert.ok(bb && bb[0] < bb[2] && bb[1] < bb[3]);
  const utenGrense = { bestand: S.bestand };
  const bb2 = planBoks(utenGrense); assert.ok(bb2[0] >= bb[0] - 1e-9 && bb2[2] <= bb[2] + 1e-9);
  assert.equal(planBoks({ bestand: [] }), null);
  const b = { ...S.bestand.find((x) => x.alder > 0), hogstklasse: null };
  assert.ok([1, 2, 3, 4, 5].includes(hkFor(b, { ...STANDARD_INNSTILLINGER, ...S.innstillinger })));
  assert.equal(hkFor({ ...b, hogstklasse: 3 }, STANDARD_INNSTILLINGER), 3);
  assert.ok(new Set(EIENDOM_FARGER).size === EIENDOM_FARGER.length);
});

test('Offline (PWA): service workeren bufrer alle moduler for fullversjonen og SkogIQ Felt, og kartfliser for eiendommen', async () => {
  const fs = await import('node:fs'); const path = await import('node:path');
  const rot = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
  const sw = fs.readFileSync(path.join(rot, 'sw.js'), 'utf8');
  const skall = new Set([...sw.slice(sw.indexOf('const SKALL'), sw.indexOf('];', sw.indexOf('const SKALL'))).matchAll(/'([^']+)'/g)].map((m) => m[1]));
  // Alle moduler som importeres (rekursivt) fra app.js og felt-app.js må ligge i SKALL.
  const besokt = new Set(); const mangler = [];
  const gaa = (fil) => {
    if (besokt.has(fil)) return; besokt.add(fil);
    if (!skall.has(fil)) mangler.push(fil);
    const kode = fs.readFileSync(path.join(rot, fil), 'utf8');
    for (const m of kode.matchAll(/(?:import|export)[^'"]*from\s*['"](\.\/[^'"]+)['"]/g)) gaa(path.posix.join(path.posix.dirname(fil), m[1]));
  };
  gaa('js/app.js'); gaa('js/felt-app.js');
  assert.deepEqual(mangler, [], `mangler i sw.js: ${mangler.join(', ')}`);
  for (const f of ['felt.html', 'felt.css', 'felt.webmanifest', 'index.html', 'manifest.webmanifest', 'ikon-192.png', 'ikon-512.png']) {
    assert.ok(skall.has(f), f); assert.ok(fs.existsSync(path.join(rot, f)), `${f} finnes`);
  }
  for (const m of ['manifest.webmanifest', 'felt.webmanifest']) {
    const j = JSON.parse(fs.readFileSync(path.join(rot, m), 'utf8'));
    assert.ok(j.icons.some((i) => i.sizes === '512x512') && j.icons.some((i) => i.sizes === '192x192') && j.display === 'standalone', m);
  }
  // Kartfliser: alle zoomnivåer 10–17 og begge kartlag.
  const u = flisUrler([11.0, 60.0, 11.02, 60.01]);
  assert.ok(u.length > 100 && u.every((x) => x.startsWith('https://cache.kartverket.no/')));
  assert.ok(u.some((x) => x.includes('/topo/default/webmercator/17/')) && u.some((x) => x.includes('/topograatone/default/webmercator/10/')));
});

test('Sporlogg: rensing, dekningsflate per bestand, planlagt → utført, sammenslåing uten dobbelttelling og GPX', async () => {
  // GPS-støy: unøyaktige punkter, stillestående og urealistiske hopp fjernes.
  const t0 = Date.parse('2026-10-01T08:00:00Z');
  const rå = [{ lat: 60, lon: 11, noyaktighet: 5, tid: t0 }, { lat: 60, lon: 11.000005, noyaktighet: 5, tid: t0 + 1000 }, { lat: 60.0001, lon: 11, noyaktighet: 80, tid: t0 + 2000 }, { lat: 60.01, lon: 11, noyaktighet: 5, tid: t0 + 3000 }, { lat: 60.00005, lon: 11, noyaktighet: 5, tid: t0 + 4000 }];
  const rene = SPOR.rensSpor(rå);
  assert.equal(rene.length, 2, JSON.stringify(rene));
  // GPX tur–retur
  const gpx = SPOR.tilGpx([rene]); const lest = SPOR.lesGpx(gpx);
  assert.equal(lest.length, 1); assert.equal(lest[0].length, 2); assert.ok(Math.abs(lest[0][1].lat - rene[1].lat) < 1e-6 && lest[0][0].tid === t0);
  let PC; try { PC = (await import('polygon-clipping')).default; } catch { return; } // geometrien krever polygon-clipping
  const S = lagDemo(2026);
  const b = S.bestand.find((x) => x.nr === '2');
  b.tiltak = [{ id: 'p1', type: 'ungskogpleie', aar: 2026, status: 'planlagt' }];
  const [lon, lat] = etikettPunkt(b.geometri); const [x0, y0] = geoTilUtm(lon, lat, 33);
  const stripe = (dy) => Array.from({ length: 31 }, (_, k) => { const [lo, la] = utmTilGeo(x0 - 60 + k * 4, y0 + dy, 33); return { lat: la, lon: lo, noyaktighet: 5, tid: t0 + k * 3000 }; });
  // To striper 8 m fra hverandre med 8 m bredde: ca. 2 × 120 m × 8 m ≈ 1,9 daa (+ ender)
  const dek = SPOR.dekningUtm([stripe(0), stripe(8)], 8, PC);
  const fd = SPOR.fordelPaaBestand(dek, S.bestand, PC);
  const i2 = fd.find((f) => f.b === b);
  assert.ok(i2 && i2.daa > 1.8 && i2.daa < 2.2, `${i2?.daa}`);
  const f1 = SPOR.foreslaa(fd, 'ungskogpleie', { aar: 2026, PC });
  assert.equal(f1.find((f) => f.b === b).handling, 'utfor-planlagt');
  assert.ok(SPOR.bruk(f1, 'ungskogpleie', { dato: '2026-10-01', sporId: 's1', PC }) >= 1);
  const t = b.tiltak.find((x) => x.id === 'p1');
  assert.equal(t.status, 'utfort'); assert.equal(t.utfortDato, '2026-10-01'); assert.ok(t.dekning && Math.abs(t.arealDaa - i2.daa) < 0.02);
  // Samme stripe en gang til + én ny: slås sammen, og bare den nye stripen øker arealet.
  const fd2 = SPOR.fordelPaaBestand(SPOR.dekningUtm([stripe(8), stripe(16)], 8, PC), S.bestand, PC);
  const f2 = SPOR.foreslaa(fd2, 'ungskogpleie', { aar: 2026, PC });
  const r2 = f2.find((f) => f.b === b);
  assert.equal(r2.handling, 'slaa-sammen');
  assert.ok(r2.nyttDaa > t.arealDaa + 0.8 && r2.nyttDaa < t.arealDaa + 1.1, `${t.arealDaa} → ${r2.nyttDaa}`);
  SPOR.bruk(f2, 'ungskogpleie', { dato: '2026-10-02', sporId: 's2', PC });
  assert.equal(b.tiltak.filter((x) => x.type === 'ungskogpleie' && x.status === 'utfort').length, 1, 'ett sammenslått tiltak');
  assert.deepEqual(t.sporIder, ['s1', 's2']);
  // Annet år eller annen type gir nytt tiltak.
  const f3 = SPOR.foreslaa(fd2, 'markberedning', { aar: 2026, PC }); assert.equal(f3.find((f) => f.b === b).handling, 'nytt');
  const f4 = SPOR.foreslaa(fd2, 'ungskogpleie', { aar: 2027, PC }); assert.equal(f4.find((f) => f.b === b).handling, 'nytt');
  // Tegnet område: polygonet er dekningen (100 × 50 m = 5 daa), også når omrisset krysser seg selv.
  const hj = [[-50, -25], [50, -25], [50, 25], [-50, 25]].map(([dx, dy]) => { const [lo, la] = utmTilGeo(x0 + dx, y0 + dy, 33); return { lat: la, lon: lo }; });
  assert.ok(Math.abs(SPOR.flateArealM2(hj) - 5000) < 5);
  const fdF = SPOR.fordelPaaBestand(SPOR.dekningFlate(hj, PC), S.bestand, PC);
  assert.ok(Math.abs(fdF.reduce((s, f) => s + f.daa, 0) - 5) < 0.1, `${fdF.map((f) => f.daa)}`);
  assert.ok(SPOR.dekningFlate([hj[0], hj[2], hj[1], hj[3]], PC).length >= 1, 'sløyfe ryddes');
  assert.deepEqual(SPOR.dekningFlate(hj.slice(0, 2), PC), []);
  // «Hele bestandet» bruker bestandets areal.
  const f5 = f3.map((f) => ({ ...f, brukHelt: true }));
  SPOR.bruk(f5.filter((f) => f.b === b), 'markberedning', { dato: '2026-10-03', PC });
  assert.equal(b.tiltak.find((x) => x.type === 'markberedning').arealDaa, b.areal);
});

test('Endre og slette tiltak: kontroll av verdier, status, areal, motor → manuell og opprydding i oppdrag/sporlogg', () => {
  const b = { id: 'b1', nr: '7', areal: 20, tiltak: [] };
  const t = { id: 't1', type: 'tynning', aar: 2027, status: 'planlagt', kilde: 'motor', prioritet: 2 };
  b.tiltak.push(t);
  const idag = '2026-10-17';
  // Ugyldige verdier endrer ingenting.
  let r = TE.endreTiltak(b, t, { type: 'tull', aar: 'x' }, { idag });
  assert.equal(r.ok, false); assert.equal(r.feil.length, 2); assert.equal(t.type, 'tynning');
  r = TE.endreTiltak(b, t, { arealDaa: '25', helt: false }, { idag }); assert.equal(r.ok, false, 'større enn bestandet');
  r = TE.endreTiltak(b, t, { status: 'utfort', utfortDato: '2027-01-01' }, { idag }); assert.equal(r.ok, false, 'fram i tid');
  // Gyldig endring: type, år, areal med komma, kommentar. Motorens tiltak blir manuelt.
  r = TE.endreTiltak(b, t, { type: 'ungskogpleie', aar: '2028', arealDaa: '12,5', helt: false, kommentar: ' Østre del ' }, { idag });
  assert.ok(r.ok && r.byttetType);
  assert.deepEqual([t.type, t.aar, t.arealDaa, t.kommentar, t.kilde], ['ungskogpleie', 2028, 12.5, 'Østre del', 'manuell']);
  // Utført med dato setter året fra datoen; tilbake til planlagt fjerner datoen.
  r = TE.endreTiltak(b, t, { status: 'utfort', utfortDato: '2026-06-03' }, { idag });
  assert.ok(r.ok); assert.equal(t.status, 'utfort'); assert.equal(t.aar, 2026); assert.equal(t.utfortDato, '2026-06-03');
  r = TE.endreTiltak(b, t, { status: 'planlagt', aar: 2029 }, { idag });
  assert.ok(r.ok); assert.equal(t.utfortDato, undefined); assert.equal(t.aar, 2029);
  // Hele bestandet fjerner arealet; fjern dekning fjerner flaten.
  t.dekning = { type: 'Polygon', coordinates: [] }; t.sporIder = ['s1'];
  r = TE.endreTiltak(b, t, { helt: true, fjernDekning: true }, { idag });
  assert.ok(r.ok); assert.equal(t.arealDaa, undefined); assert.equal(t.dekning, undefined); assert.equal(t.sporIder, undefined);
  // Skjemaverdier
  assert.equal(TE.skjemaVerdier(b, t).helt, true);
  // Sletting fjerner tiltaket fra bestandet, oppdraget og sporloggen.
  const t2 = { id: 't2', type: 'planting', aar: 2027, status: 'utfort', oppdragId: 'o1', sporIder: ['s9'], dekning: {} }; b.tiltak.push(t2);
  const S = { bestand: [b], oppdrag: [{ id: 'o1', linjer: [{ tiltakId: 't2' }, { tiltakId: 'tx' }] }], sporlogger: [{ id: 's9', bestand: ['b1'] }] };
  assert.match(TE.slettTekst(b, t2), /oppdraget.*flaten/);
  TE.slettTiltak(S, b, t2);
  assert.deepEqual(b.tiltak.map((x) => x.id), ['t1']);
  assert.deepEqual(S.oppdrag[0].linjer, [{ tiltakId: 'tx' }]);
  assert.deepEqual(S.sporlogger[0].bestand, []);
});

test('Endre flate: forenkling til redigerbare punkter, legg til / fjern område og klipping mot bestandet', async () => {
  let PC; try { PC = (await import('polygon-clipping')).default; } catch { return; }
  // Sirkel med 400 punkter → høyst 160 punkter, nesten samme areal.
  const sirkel = [Array.from({ length: 401 }, (_, i) => { const v = (i % 400) / 400 * 2 * Math.PI; return [300000 + 50 * Math.cos(v), 6700000 + 50 * Math.sin(v)]; })];
  const f = FG.forenkleForRedigering([sirkel]);
  assert.ok(FG.antallPunkter(f) <= 160 && FG.antallPunkter(f) >= 8, `${FG.antallPunkter(f)}`);
  assert.ok(Math.abs(FG.arealUtm(f) - Math.PI * 2500) / (Math.PI * 2500) < 0.03);
  // Små biter fjernes.
  const smaa = [[[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]], ...f];
  assert.equal(FG.forenkleForRedigering(smaa).length, 1);
  // Kvadrat 100 × 100 m; legg til et 100 × 50 m rektangel inntil, fjern et 20 × 20 m hull.
  const k = (x0, y0, w, h) => [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]];
  let mp = FG.kombiner([], k(0, 0, 100, 100), 'ny', PC);
  assert.ok(Math.abs(FG.arealUtm(mp) - 10000) < 1);
  mp = FG.kombiner(mp, k(100, 0, 100, 50), 'legg-til', PC); assert.ok(Math.abs(FG.arealUtm(mp) - 15000) < 1);
  mp = FG.kombiner(mp, k(40, 40, 20, 20), 'fjern', PC); assert.ok(Math.abs(FG.arealUtm(mp) - 14600) < 1);
  assert.equal(mp[0].length, 2, 'hullet er med');
  assert.deepEqual(FG.kombiner(mp, k(0, 0, 1, 1), 'ny', PC).length, 1);
  // Klipping mot et bestand (GeoJSON): flaten går 50 m utenfor på én side.
  const S = lagDemo(2026); const b = S.bestand.find((x) => x.nr === '2');
  const [lon, lat] = etikettPunkt(b.geometri); const [x0, y0] = geoTilUtm(lon, lat, 33);
  const inne = FG.kombiner([], k(x0 - 20, y0 - 20, 40, 40), 'ny', PC);
  const r = FG.klippTilBestand(inne, b.geometri, PC);
  assert.ok(Math.abs(r.daa - 1.6) < 0.02 && r.andel > 0 && r.andel < 1, `${r.daa}`);
  const hele = FG.klippTilBestand(FG.fraGeometri(b.geometri), b.geometri, PC);
  assert.ok(Math.abs(hele.andel - 1) < 0.001);
  // Rundtur GeoJSON → UTM → GeoJSON
  const g = FG.tilGeometri(inne); assert.equal(g.type, 'MultiPolygon'); assert.ok(Math.abs(FG.arealUtm(FG.fraGeometri(g)) - 1600) < 1);
  assert.equal(FG.tilGeometri([]), null);
});

test('Identifisering i kartet: tiltaksflater og bestand i et punkt, synlighet og rekkefølge', () => {
  const S = lagDemo(2026); const b = S.bestand.find((x) => x.nr === '2');
  const [lon, lat] = etikettPunkt(b.geometri); const [x0, y0] = geoTilUtm(lon, lat, 33);
  const kv = (dx0, dy0, w, h) => ({ type: 'Polygon', coordinates: [[[dx0, dy0], [dx0 + w, dy0], [dx0 + w, dy0 + h], [dx0, dy0 + h], [dx0, dy0]].map(([dx, dy]) => utmTilGeo(x0 + dx, y0 + dy, 33))] });
  const g = (dx, dy) => { const [lo, la] = utmTilGeo(x0 + dx, y0 + dy, 33); return [la, lo]; };
  b.tiltak = [
    { id: 'u', type: 'ungskogpleie', status: 'utfort', utfortDato: '2026-09-01', aar: 2026, arealDaa: 4, dekning: kv(-60, -30, 80, 50) },
    { id: 'p', type: 'markberedning', status: 'planlagt', aar: 2027, dekning: kv(0, -30, 60, 50) },
    { id: 'gml', type: 'planting', status: 'utfort', utfortDato: '2019-05-01', aar: 2019, dekning: kv(-60, -30, 120, 50) },
    { id: 'uten', type: 'tynning', status: 'planlagt', aar: 2030 },
  ];
  // Synlige: planlagte og utførte siste 2 år – ikke gamle eller uten flate.
  assert.deepEqual(TR.synligeTiltaksflater(S, { iAar: 2026 }).map(({ t }) => t.id).sort(), ['p', 'u']);
  // Overlapp: planlagt først, så utført, og bestandet.
  let h = TR.treffVed(S, ...g(10, -5), { iAar: 2026 });
  assert.deepEqual(h.tiltak.map(({ t }) => t.id), ['p', 'u']); assert.equal(h.bestand, b);
  h = TR.treffVed(S, ...g(-40, -5), { iAar: 2026 }); assert.deepEqual(h.tiltak.map(({ t }) => t.id), ['u']);
  h = TR.treffVed(S, ...g(0, 60), { iAar: 2026 }); assert.equal(h.tiltak.length, 0); assert.equal(h.bestand, b);
  // Tekster
  assert.match(TR.tiltakLinje(b, b.tiltak[0]), /utført .*4,0 daa/);
  assert.match(TR.tiltakLinje(b, b.tiltak[3]), /planlagt 2030 · hele bestandet/);
  const d = Object.fromEntries(TR.tiltakDetaljer(b, b.tiltak[0]));
  assert.match(d.Areal, /4,0 daa \(\d+ % av bestandet\)/); assert.equal(d.Registrert, 'Tegnet');
  assert.equal(TR.tiltakStil(b.tiltak[1], true).color, '#ffd400'); assert.ok(TR.tiltakStil(b.tiltak[1]).dashArray);
});

test('Ungskog: felt for HK I–II – registrert, fra data eller beregnet', () => {
  const b = { id: 'u1', nr: '9', treslag: 'G', bonitet: 17, alder: 8, areal: 10, hogstklasse: 2, tiltak: [] };
  assert.ok(US.erUngskog(b)); assert.ok(!US.erUngskog({ ...b, hogstklasse: 4 }));
  let d = US.ungskogData(b);
  assert.equal(d.treantallFor.kilde, 'beregnet'); assert.ok(d.treantallFor.verdi > 300, `${d.treantallFor.verdi}`);
  assert.equal(d.treantallEtter.verdi, 200); assert.equal(d.treantallEtter.kilde, 'beregnet'); assert.match(d.treantallEtter.forklaring, /G17.*ikke regulert ennå/);
  assert.equal(d.hoydeBar.kilde, 'beregnet'); assert.ok(d.hoydeLauv.verdi > d.hoydeBar.verdi);
  b.treantall = 520; b.hoyde = 2.4;
  d = US.ungskogData(b);
  assert.equal(d.treantallFor.kilde, 'data'); assert.equal(d.treantallFor.verdi, 520); assert.equal(d.hoydeBar.verdi, 2.4); assert.equal(d.hoydeLauv.kilde, 'beregnet');
  // Registrering: komma godtas, ugyldig avvises, tom verdi fjerner
  assert.ok(US.settUngskog(b, 'hoydeLauv', '3,46')); assert.equal(b.ungskog.hoydeLauv, 3.5);
  assert.ok(US.settUngskog(b, 'treantallFor', '640')); assert.ok(!US.settUngskog(b, 'treantallFor', 'mange')); assert.ok(!US.settUngskog(b, 'hoydeBar', '-1')); assert.ok(!US.settUngskog(b, 'tull', '1'));
  d = US.ungskogData(b);
  assert.equal(d.treantallFor.kilde, 'registrert'); assert.equal(d.treantallFor.verdi, 640); assert.equal(d.hoydeLauv.verdi, 3.5);
  // Motoren bruker registrert treantall før regulering
  assert.ok(motorTiltak({ bestand: [b] }, { iAar: 2026, balanser: false }).some((f) => f.type === 'ungskogpleie' && /640/.test(f.kommentar)));
  // Etter utført pleie
  b.tiltak.push({ id: 't', type: 'ungskogpleie', status: 'utfort', utfortDato: '2025-06-01', aar: 2025 });
  d = US.ungskogData({ ...b, ungskog: undefined, treantall: 200 });
  assert.equal(d.treantallEtter.kilde, 'beregnet'); assert.equal(d.treantallEtter.verdi, 200); assert.equal(d.treantallFor.kilde, 'beregnet');
  US.settUngskog(b, 'treantallFor', ''); US.settUngskog(b, 'hoydeLauv', ''); assert.equal(b.ungskog, undefined);
  const html = ungskogHtml(US.ungskogData(b), { inputs: true });
  assert.equal((html.match(/data-ungskog=/g) || []).length, 4);
});

test('Ungskog: økonomisk effekt av å gjennomføre, utsette eller ikke gjennomføre', () => {
  const b = { id: 'u2', nr: '9', treslag: 'G', bonitet: 17, alder: 10, areal: 12, hogstklasse: 2, treantall: 450, hoyde: 3, tiltak: [] };
  const e = US.effektUngskogpleie(b, { iAar: 2026 });
  assert.equal(e.type, 'ungskogpleie'); assert.ok(e.behov);
  assert.ok(e.alt.naa.nv > e.alt.utsett.nv && e.alt.utsett.nv > e.alt.uten.nv, JSON.stringify(Object.values(e.alt).map((a) => Math.round(a.nv))));
  assert.ok(e.gevinstTotal > 0 && Math.abs(e.gevinstTotal - e.gevinst * 12) < 1e-6);
  assert.ok(e.alt.uten.hogstAar > e.alt.naa.hogstAar);
  // Lauv over bar gir større tap uten pleie
  const lauv = US.effektUngskogpleie({ ...b, ungskog: { hoydeLauv: 5 } }, { iAar: 2026 });
  assert.ok(lauv.lauvOver && lauv.gevinst > e.gevinst); assert.ok(lauv.andre.some((x) => x.type === 'advarsel' && /Lauvet/.test(x.tekst)));
  // Høyere trær gir dyrere pleie
  assert.ok(US.pleieKostPerDaa(6, 800) > US.pleieKostPerDaa(2, 400));
  // Planting på snaumark
  const s = { id: 'u3', nr: '8', treslag: 'G', bonitet: 20, alder: 0, areal: 5, hogstklasse: 1, tiltak: [] };
  const p = US.effektFor(s, { iAar: 2026 });
  assert.equal(p.type, 'planting'); assert.ok(p.alt.naa.nv > p.alt.uten.nv);
  // Ungskogpleie prioriteres når den er planlagt
  assert.equal(US.effektFor({ ...s, tiltak: [{ id: 'x', type: 'ungskogpleie', status: 'planlagt', aar: 2028 }] }, { iAar: 2026 }).type, 'ungskogpleie');
  assert.equal(US.effektFor({ ...b, hogstklasse: 4 }, { iAar: 2026 }), null);
  const html = effektHtml(e);
  assert.match(html, /Gjennomfør nå/); assert.match(html, /effekt-best/); assert.match(html, /Utsetter du 5 år/);
  assert.doesNotMatch(effektHtml(e, { kompakt: true }), /Forutsetninger/);
});

test('Oppdrag: utvalg fra liste, trykk i kartet og tegnet flate – med angre og tilbakerulling', () => {
  const S = lagDemo(2026); S.oppdrag = [];
  let n = 0; const nyId = (p) => `${p}${++n}`;
  const by = (nr) => S.bestand.find((x) => x.nr === nr);
  for (const b of S.bestand) b.tiltak = (b.tiltak || []).filter((t) => t.type !== 'ungskogpleie');
  by('2').tiltak.push({ id: 'p2', type: 'ungskogpleie', aar: 2027, status: 'planlagt' });
  by('3').tiltak.push({ id: 'p3', type: 'ungskogpleie', aar: 2026, status: 'planlagt' });
  const u = OU.nyttUtvalg({ type: 'ungskogpleie' });
  assert.deepEqual(OU.kandidater(S, 'ungskogpleie').map(({ t }) => t.id), ['p3', 'p2']);
  assert.equal(OU.bestandStatus(S, u, by('2')), 'kandidat'); assert.equal(OU.bestandStatus(S, u, by('4')), 'tom');
  // Trykk: velger eksisterende, lager nytt, tar ut igjen
  assert.equal(OU.trykkBestand(S, u, by('2'), { nyId, iAar: 2026 }).handling, 'valgt');
  const ant4 = by('4').tiltak.length;
  const r = OU.trykkBestand(S, u, by('4'), { nyId, iAar: 2026 });
  assert.equal(r.handling, 'nytt'); assert.equal(by('4').tiltak.length, ant4 + 1); assert.equal(OU.bestandStatus(S, u, by('4')), 'valgt');
  assert.equal(OU.trykkBestand(S, u, by('4'), { nyId, iAar: 2026 }).handling, 'fjernet'); assert.equal(by('4').tiltak.length, ant4);
  assert.ok(OU.angre(u)); assert.equal(by('4').tiltak.length, ant4 + 1); assert.equal(OU.bestandStatus(S, u, by('4')), 'valgt');
  // Liste
  OU.settValgt(u, 'p3', true);
  assert.equal(OU.oppsummer(S, u).tiltak, 3);
  // Tegnet flate: delvis i 2, nesten hele 3, liten kant i 5 (tas ikke med), nytt i 6
  const g = (b) => b.geometri;
  const fordeling = [{ b: by('2'), daa: 1.5, andel: 0.2, geometri: g(by('2')) }, { b: by('3'), daa: by('3').areal, andel: 0.99, geometri: g(by('3')) }, { b: by('5'), daa: 0.05, andel: 0.01, geometri: g(by('5')) }, { b: by('6'), daa: 2, andel: 0.3, geometri: g(by('6')) }];
  const f = OU.brukFlate(S, u, fordeling, { nyId, iAar: 2026 });
  assert.equal(f.antall, 3); assert.equal(f.nye, 1);
  const t2 = by('2').tiltak.find((t) => t.id === 'p2'); assert.equal(t2.arealDaa, 1.5); assert.ok(t2.dekning);
  assert.equal(by('3').tiltak.find((t) => t.id === 'p3').dekning, undefined);
  assert.ok(Math.abs(OU.oppsummer(S, u).daa - (1.5 + by('3').areal + by('4').areal + 2)) < 1e-9);
  assert.ok(OU.oppsummer(S, u).kost > 0);
  // Angre flaten
  OU.angre(u); assert.equal(t2.arealDaa, undefined); assert.equal(t2.dekning, undefined); assert.equal(OU.bestandStatus(S, u, by('6')), 'tom');
  // Opptatt i et annet oppdrag
  const lag = (S2) => { const v = OU.valgteLinjer(S2, u); return v; };
  assert.equal(lag(S).length, 3);
  assert.ok(OU.harEndringer(u));
  // Avbryt: alt rulles tilbake
  OU.rullTilbake(u); assert.equal(by('4').tiltak.length, ant4); assert.equal(u.valgte.size, 0);
  // Opptatt
  const u2 = OU.nyttUtvalg({ type: 'ungskogpleie' }); OU.trykkBestand(S, u2, by('2'), { nyId });
  S.oppdrag.push({ id: 'o1', nr: 'O-2026-01', status: 'bestilt', type: 'ungskogpleie', linjer: [] }); by('3').tiltak.find((t) => t.id === 'p3').oppdragId = 'o1';
  assert.equal(OU.trykkBestand(S, u2, by('3'), { nyId }).handling, 'opptatt');
  assert.equal(OU.trykkBestand(S, OU.nyttUtvalg({ type: 'annet' }), by('7'), { nyId }).handling, 'ugyldig');
  // Sammendraget i oppdraget bruker tiltakets areal
  const o = { linjer: [{ bestandId: by('2').id, tiltakId: 'p2' }], type: 'ungskogpleie' }; t2.arealDaa = 1.5;
  assert.equal(OPP.sammendrag(S, o).areal, 1.5);
});

test('Tetthetsklasse: SOSI SP_HKL og SP_-felt, «2A»/«II b», beregning for HK II, hint for III–V og supplering', () => {
  for (const [v, h, k] of [['21', 2, 'a'], ['22', 2, 'b'], ['52', 5, 'b'], ['2A', 2, 'a'], ['II b', 2, 'b'], ['2 B', 2, 'b'], ['IIa', 2, 'a'], ['4', 4, null], ['IV', 4, null]]) {
    assert.equal(tolkHogstklasse(v), h, v); assert.equal(tolkTetthet(v), k, v);
  }
  // Planfirmaenes SOSI med SP_-navn og grupper (..SP_BSKRIV / ...SP_HKL)
  const sos = SOSI.replace(/\.\.BESTANDNR 12\n\.\.TRESLAG 1\n\.\.BONITET 17\n\.\.HOGSTKLASSE 5\n\.\.ALDER 95\n\.\.VOLUM_DAA 32,5\n\.\.TILTAK "Sluttavvirkning"\n/,
    '..SP_BESTAND\n...SP_BESTNR 7\n..SP_BSKRIV\n...SP_HKL 22\n...SP_ALDER 9\n...SP_TREFREG 420\n...SP_TREEREG 80\n...SP_HBAR 2,5\n...SP_HLAUV 3,1\n..SP_AKLASS\n...SP_AGJBON 17\n...SP_ABONTRE 1\n');
  const b = lesSosi(new TextEncoder().encode(sos).buffer, 'auto', 2026).bestand[0];
  assert.equal(b.nr, '7'); assert.equal(b.hogstklasse, 2); assert.equal(b.tetthetsklasse, 'b'); assert.equal(b.bonitet, 17); assert.equal(b.treslag, 'G'); assert.equal(b.alder, 9);
  assert.deepEqual(b.ungskog, { treantallFor: 420, treantallEtter: 80, hoydeBar: 2.5, hoydeLauv: 3.1, kilde: 'import' });
  assert.equal(US.ungskogData(b).treantallEtter.forklaring, 'Fra importert skogbruksplan');
  assert.equal(TT.hkTekst(b), 'II b'); assert.equal(TT.sosiHkl(b), 22);
  assert.equal(TT.tetthet(b).kilde, 'registrert');
  // Motoren foreslår supplering i II b (registrert)
  assert.ok(motorTiltak({ bestand: [b] }, { iAar: 2026, balanser: false }).some((f) => f.type === 'suppleringsplanting'));
  // Beregnet for HK II fra målt treantall; ikke supplering når treantallet bare er fra SR16/takst
  const c = { id: 'c', nr: '8', treslag: 'G', bonitet: 17, alder: 6, hogstklasse: 2, areal: 3, tiltak: [], ungskog: { treantallEtter: 70 } };
  assert.deepEqual([TT.tetthet(c).klasse, TT.tetthet(c).kilde, TT.tetthet(c).grunnlag], ['b', 'beregnet', 'ungskog']);
  assert.ok(motorTiltak({ bestand: [c] }, { iAar: 2026, balanser: false }).some((f) => f.type === 'suppleringsplanting'));
  const d = { ...c, ungskog: undefined, treantall: 70 };
  assert.equal(TT.tetthet(d).grunnlag, 'data');
  assert.ok(!motorTiltak({ bestand: [d] }, { iAar: 2026, balanser: false }).some((f) => f.type === 'suppleringsplanting'));
  assert.equal(TT.tetthet({ ...c, ungskog: { treantallEtter: 200 } }).klasse, 'a');
  // HK III–V: ikke beregnet, men hint
  const e = { id: 'e', nr: '9', treslag: 'G', bonitet: 14, alder: 80, volumDaa: 9, hogstklasse: 4, areal: 5, tiltak: [] };
  const te = TT.tetthet(e); assert.equal(te.klasse, null); assert.match(te.hint, /kan tyde på mindre tilfredsstillende/);
  assert.equal(TT.hkTekst(e), 'IV');
  assert.equal(TT.tetthetNavn(1, 'b'), 'ikke tilfredsstillende ryddet');
});

test('Ungskog: treantallsmodell for alle stammer – SR16 (bare trær over 5 cm) er bare en nedre grense', () => {
  const sr = { id: 's', nr: '1-4', treslag: 'G', bonitet: 14, alder: 15, hogstklasse: 2, areal: 5, treantall: 92, tiltak: [], ekstra: { KILDE: 'Tidligere skogbruksplan (NIBIO) + SR16' } };
  assert.ok(US.fraSr16(sr)); assert.ok(!US.fraSr16({ ...sr, ekstra: {} }));
  const m = US.treantallModell(sr);
  assert.ok(m.verdi > 350 && m.verdi < 500, `${m.verdi}`); assert.ok(m.lauv > m.bar);
  const d = US.ungskogData(sr).treantallFor;
  assert.equal(d.kilde, 'beregnet'); assert.equal(d.verdi, m.verdi); assert.match(d.forklaring, /SR16 viser 92\/daa/);
  // Høyere bonitet gir mer lauv; høyere og eldre bestand gir selvtynning
  assert.ok(US.treantallModell({ ...sr, bonitet: 23 }).verdi > m.verdi);
  assert.ok(US.treantallModell({ ...sr, alder: 35 }).verdi < m.verdi);
  // Takst (ikke SR16) brukes som den er
  assert.equal(US.ungskogData({ ...sr, ekstra: {} }).treantallFor.verdi, 92);
  // SR16 høyere enn modellen: SR16 brukes
  assert.equal(US.ungskogData({ ...sr, treantall: 900 }).treantallFor.verdi, 900);
  // Hogstflate uten planting: ingen bartrær
  assert.match(US.treantallModell({ ...sr, alder: 0, hogstklasse: 1 }).forklaring, /ikke plantet/);
  // Tiltaksmotoren ser bestandet som tett og foreslår ungskogpleie; tetthetsklassen bruker modellen
  assert.ok(motorTiltak({ bestand: [sr] }, { iAar: 2026, balanser: false }).some((f) => f.type === 'ungskogpleie'));
  assert.deepEqual([TT.tetthet(sr).klasse, TT.tetthet(sr).grunnlag], ['a', 'modell']);
});

test('Hogstklasse I = ikke tilfredsstillende forynget (ikke alder), og glissen skog er ikke hogd', () => {
  const flate = { id: 'f', nr: '1', treslag: 'G', bonitet: 17, alder: 1, areal: 4, tiltak: [] };
  assert.equal(hogstklasseFor(flate), 1); assert.equal(foryngelse(flate), null);
  // Plantet: HK II samme dag, også med alder 0
  assert.equal(hogstklasseFor({ ...flate, alder: 0, tiltak: [{ type: 'planting', status: 'utfort', utfortDato: '2026-05-10' }] }), 2);
  // Hogd for 6 år siden og ikke forynget: fortsatt HK I selv om alderen sier II
  const hogd = { ...flate, alder: 6, tiltak: [{ type: 'sluttavvirkning', status: 'utfort', utfortDato: '2020-03-01' }] };
  assert.equal(hogstklasseFor(hogd), 1); assert.equal(foryngelse(hogd), 'ikke');
  // … men plantet etter hogst gir II
  assert.equal(hogstklasseFor({ ...hogd, tiltak: [...hogd.tiltak, { type: 'planting', status: 'utfort', utfortDato: '2021-05-01' }] }), 2);
  // Treantall mot minste plantetall (forskriften § 7): takst og målt ungskog
  assert.equal(minForyngelse('G', 17), 100); assert.equal(minForyngelse('G', 20), 150); assert.equal(minForyngelse('F', 8), 50);
  assert.equal(hogstklasseFor({ ...flate, treantall: 120 }), 2);
  assert.equal(hogstklasseFor({ ...flate, alder: 5, treantall: 60 }), 1);
  assert.equal(hogstklasseFor({ ...flate, alder: 5, ungskog: { treantallFor: 300 } }), 2);
  // Registrert hogstklasse og eldre skog påvirkes ikke
  assert.equal(hogstklasseFor({ ...flate, hogstklasse: 1, treantall: 500 }), 1);
  assert.equal(hogstklasseFor({ ...flate, alder: 70, treantall: 10 }), 4);
  // SR16 (over 5 cm): lite volum mot HK IV–V i gammel plan
  assert.equal(vurderLiteVolum({ treantall: 12, hoyde: 2.5, srAlder: 25 }), 'hogd');
  assert.equal(vurderLiteVolum({ treantall: 70, hoyde: 10, srAlder: 110 }), 'glissen');
  assert.equal(vurderLiteVolum({ treantall: 60, hoyde: 4.5, srAlder: 18 }), 'gjenvekst');
  const gml = { id: 'g', nr: '1-15', treslag: 'G', bonitet: 6, alder: 0, volumDaa: 2.8, treantall: 79, hoyde: 9.5, areal: 6, tiltak: [], ekstra: { KILDE: 'Tidligere skogbruksplan (NIBIO) + SR16', SR16_ALDER: 110 },
    merknad: 'Mulig hogd etter 2009: SR16 viser 2,8 m³/daa mot HK 4 i planen – kontroller; Overlapper MiS-nøkkelbiotop' };
  const ekte = { ...gml, id: 'h', nr: '2-2147', treantall: 7, hoyde: 1.9, merknad: 'Mulig hogd etter 2009: SR16 viser 0,7 m³/daa mot HK 5 i planen – kontroller' };
  assert.equal(rettFeilHogd([gml, ekte]), 1);
  assert.equal(gml.alder, 110); assert.match(gml.merknad, /^Glissen skog: SR16 viser 2,8 m³\/daa, men 79 trær\/daa over 5 cm og 9,5 m høyde – ikke hogd \(HK 4 i planen 2009\), kontroller; Overlapper MiS/);
  assert.ok(hogstklasseFor(gml) >= 4); assert.equal(ekte.alder, 0); assert.equal(hogstklasseFor(ekte), 1);
  assert.equal(rettFeilHogd([gml]), 0); // bare én gang
});

test('Ungskog på hogd flate (Nannestad 29/2, bestand 1-19): alder fra målt høyde, ungskogpleie anbefales, internrente', () => {
  const b = { id: 'x', nr: '1-19', treslag: 'G', bonitet: 11, alder: 0, volumDaa: 1, treantall: 20, hoyde: 1.1, areal: 48.5, tiltak: [], ekstra: { KILDE: 'Tidligere skogbruksplan (NIBIO) + SR16' },
    merknad: 'Mulig hogd etter 2013: SR16 viser 1,0 m³/daa mot HK 5 i planen – kontroller', ungskog: { treantallFor: 900, treantallEtter: 180, hoydeBar: 2 } };
  assert.ok(alderFraHoyde(2, 11) >= 9 && alderFraHoyde(2, 11) <= 14); assert.ok(alderFraHoyde(2, 20) < alderFraHoyde(2, 11));
  assert.equal(startT2(b).alder, alderFraHoyde(2, 11)); assert.equal(hogstklasseFor(b), 2);
  const f = motorTiltak({ bestand: [b] }, { iAar: 2026, balanser: false });
  assert.deepEqual(f.map((x) => x.type), ['ungskogpleie']); assert.equal(f[0].aar, 2026);
  const e = US.effektUngskogpleie(b, { iAar: 2026 });
  assert.ok(e.behov); assert.ok(e.internrente > 2 && e.internrente < 4, String(e.internrente));
  assert.equal(e.forutsetninger.lev >= 0, true);
  assert.match(effektHtml(e), /Ungskogpleie anbefales/);
  // Lønnsomheten øker med bonitet, og tilskudd gjør tiltaket lønnsomt
  assert.ok(US.effektUngskogpleie({ ...b, bonitet: 17 }, { iAar: 2026 }).gevinst > 500);
  assert.ok(US.effektUngskogpleie(b, { iAar: 2026, vInn: { ...STANDARD_VERDI, tilskuddUngskogpleie: 40 } }).gevinst > 0);
});

test('Delvis ungskogpleie: resten foreslås fullført, middelhøyde = snitt av registrert bar og lauv', () => {
  const b = { id: 'x', nr: '1-19', treslag: 'G', bonitet: 11, alder: 0, volumDaa: 1, treantall: 20, hoyde: 1.1, areal: 48.5, ekstra: { KILDE: 'Tidligere skogbruksplan (NIBIO) + SR16' },
    tiltak: [{ id: 'u', type: 'ungskogpleie', status: 'utfort', utfortDato: '2026-10-17', aar: 2026, arealDaa: 6.2 }], ungskog: { treantallFor: 900, treantallEtter: 180, hoydeBar: 2 } };
  const p = US.pleieDekning(b); assert.equal(p.daa, 6.2); assert.equal(p.rest, 42.3); assert.ok(!p.helt);
  assert.equal(US.ungskogData(b).pleid, null); assert.equal(US.ungskogData(b).delvis.rest, 42.3);
  const f = motorTiltak({ bestand: [b] }, { iAar: 2026, balanser: false });
  assert.equal(f.length, 1); assert.equal(f[0].type, 'ungskogpleie'); assert.equal(f[0].arealDaa, 42.3); assert.equal(f[0].aar, 2026); assert.match(f[0].kommentar, /Fullfør ungskogpleien på resterende 42,3 daa/);
  const e = US.effektFor(b, { iAar: 2026 });
  assert.equal(e.arealDaa, 42.3); assert.ok(e.delvis); assert.equal(e.alt.naa.navn, 'Fullfør resten nå');
  assert.match(effektHtml(e), /Fullfør ungskogpleien.*6,2 av 48,5 daa/); assert.ok(e.andre[0].tekst.includes('bare utført på 6,2 av 48,5 daa'));
  // Hele bestandet pleiet: ingen nye forslag
  const hel = { ...b, tiltak: [{ ...b.tiltak[0], arealDaa: 46 }] };
  assert.ok(US.pleieDekning(hel).helt); assert.ok(!motorTiltak({ bestand: [hel] }, { iAar: 2026, balanser: false }).some((x) => x.type === 'ungskogpleie'));
  // Middelhøyde: registrerte høyder (lauv beregnet når den ikke er målt), og bestandsdataene følger med
  const m = US.middelhoyde(b); assert.equal(m.kilde, 'registrert'); assert.ok(m.verdi > 2 && m.verdi < 2.6, String(m.verdi));
  US.settUngskog(b, 'hoydeLauv', '3'); assert.equal(US.middelhoyde(b).verdi, 2.5); assert.equal(b.hoyde, 2.5);
  assert.equal(US.middelhoyde({ ...b, ungskog: undefined }).verdi, 2.5); // bestandsdataene er oppdatert
});

test('Droneoppdrag: flylinjer over området, GSD/overlapp/flytid og DJI WPML-rute (KMZ)', () => {
  const S = lagDemo(2026); const b = S.bestand.find((x) => x.nr === '17');
  // GSD for Mavic 3 Enterprise: ca. 2,7 cm/px på 100 m, og høyden for 3 cm/px er ca. 113 m
  const k = DR.kamera('m3e', 100); assert.ok(Math.abs(k.gsd - 2.67) < 0.05, String(k.gsd)); assert.ok(Math.abs(DR.hoydeForGsd('m3e', 3) - 112.6) < 1);
  const p = DR.planlegg(b.geometri, { hoyde: 100, overlappFram: 80, overlappSide: 80 });
  assert.ok(Math.abs(p.linjeavstand - k.bredde * 0.2) < 0.01); assert.ok(Math.abs(p.bildeavstand - k.lengde * 0.2) < 0.01);
  assert.ok(Math.abs(p.arealDaa - b.areal) / b.areal < 0.02, `${p.arealDaa} ${b.areal}`);
  assert.ok(p.linjer.length >= 4 && p.bilder > 50 && p.flytid > 3 && p.flytid < 20 && p.batterier === 1, JSON.stringify([p.linjer.length, p.bilder, p.flytid]));
  // Linjene dekker hele området: antall linjer × linjeavstand ≥ bredden på tvers av flyretningen
  const a = ((90 - p.retning) * Math.PI) / 180; const ys = p.linjer.flat().map(([x, y]) => -x * Math.sin(a) + y * Math.cos(a));
  assert.ok(Math.max(...ys) - Math.min(...ys) + p.linjeavstand >= 0.9 * p.linjeavstand * p.linjer.length);
  assert.ok(p.intervall >= 1 - 1e-9 && p.fart <= 12);
  // Lavere høyde → flere linjer og bilder; fast retning brukes
  const lav = DR.planlegg(b.geometri, { hoyde: 60, retning: 0 }); assert.ok(lav.bilder > p.bilder); assert.equal(lav.retning, 0);
  assert.equal(DR.planlegg(b.geometri, { hoyde: 400 }).hoyde, 120);
  // Terreng
  assert.equal(DR.terrengVurdering([200, 205, 210], p).niva, 'ok'); assert.equal(DR.terrengVurdering([200, 260, 270], p).niva, 'fare');
  // KMZ: ZIP med wpmz/template.kml (mapping2d) og wpmz/waylines.wpml (fotografering per avstand)
  const z = DR.lagKmz(p, { naa: 1 }); const tekst = new TextDecoder().decode(z);
  assert.equal(z[0], 0x50); assert.equal(z[1], 0x4b); assert.ok(tekst.includes('wpmz/template.kml') && tekst.includes('wpmz/waylines.wpml'));
  const tpl = DR.lagTemplateKml(p, { naa: 1 }); const wl = DR.lagWaylinesWpml(p);
  assert.match(tpl, /<wpml:templateType>mapping2d<\/wpml:templateType>/); assert.match(tpl, /<wpml:orthoCameraOverlapH>80</); assert.match(tpl, /<wpml:droneEnumValue>77</); assert.match(tpl, /<wpml:payloadEnumValue>66</);
  assert.match(tpl, /<Polygon><outerBoundaryIs><LinearRing><coordinates>[\d.]+,[\d.]+,0 /);
  assert.equal((wl.match(/<Placemark>/g) || []).length, p.linjer.length * 2);
  assert.match(wl, new RegExp(`<wpml:actionTriggerType>multipleDistance</wpml:actionTriggerType><wpml:actionTriggerParam>${p.bildeavstand.toFixed(1).replace(/\.0$/, '')}<`));
  assert.match(wl, /<wpml:gimbalPitchRotateAngle>-90</);
  assert.match(DR.lagOmradeKml(p, 'Test & co'), /<name>Test &amp; co<\/name>/);
  assert.ok(DR.SJEKKLISTE.length >= 8);
});

test('Kontroller-overføring: kobling med kode, sending av KMZ, nedlasting og status', () => {
  let t = 1_000_000; const r = lagRelay({ naa: () => t });
  const k = r.registrer(); assert.match(k.id, /^[a-f0-9]{32}$/); assert.match(k.kode, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(r.kobl('FEIL12'), null);
  assert.deepEqual(r.kobl(`${k.kode.slice(0, 3)} ${k.kode.slice(3).toLowerCase()}`), { id: k.id }); // mellomrom og små bokstaver går fint
  assert.equal(r.kobl(k.kode), null); // bare én gang
  const k2 = r.registrer(k.id); assert.equal(k2.id, k.id); assert.equal(k2.telefoner, 1);
  t += KODE_GYLDIG_MS + 1; assert.equal(r.kobl(k2.kode), null); // utløpt
  const S = lagDemo(2026); const p = DR.planlegg(S.bestand[0].geometri, {});
  const kmz = Buffer.from(DR.lagKmz(p)).toString('base64');
  assert.equal(r.send(k.id, { navn: 'x', kmz: Buffer.from('ikke zip').toString('base64') }).status, 400);
  assert.equal(r.send('0'.repeat(32), { navn: 'x', kmz }).status, 404);
  const { oid } = r.send(k.id, { navn: 'Ortofoto bestand 1', info: { gsd: 2.7 }, kmz });
  let l = r.liste(k.id); assert.equal(l.length, 1); assert.equal(l[0].status, 'sendt'); assert.equal(l[0].info.gsd, 2.7); assert.equal(l[0].kmz, undefined);
  const f = r.hent(k.id, oid); assert.equal(f.data[0], 0x50); assert.equal(f.data.length, Buffer.from(kmz, 'base64').length);
  assert.equal(r.liste(k.id)[0].status, 'hentet');
  assert.ok(r.status(k.id, oid, 'flydd')); assert.ok(!r.status(k.id, oid, 'tull')); assert.equal(r.liste(k.id)[0].status, 'flydd');
  assert.ok(r.slett(k.id, oid)); assert.equal(r.liste(k.id).length, 0);
  assert.equal(r.liste('ugyldig'), null);
});

test('Virtuell skog: trær fra bestandsdataene (treslag, høyde, treantall, hogstklasse), fast tilfeldighet og terreng', () => {
  const S = lagDemo(2026);
  const ung = { id: 'u', nr: 'U', treslag: 'G', bonitet: 17, alder: 10, hogstklasse: 2, areal: 5, tiltak: [], ungskog: { treantallFor: 800, hoydeBar: 2.5, hoydeLauv: 3.5 } };
  const pu = SK.bestandTraer(ung);
  assert.equal(pu.hk, 2); const N = pu.arter.reduce((x, a) => x + a.N, 0); assert.ok(Math.abs(N - 800) < 1);
  assert.equal(pu.arter.find((a) => a.art === 'G').H, 2.5); assert.equal(pu.arter.find((a) => a.art === 'L').H, 3.5);
  assert.ok(pu.arter.find((a) => a.art === 'G').kroneStart <= 0.05); // krone ned til bakken i ungskog
  const gml = SK.bestandTraer({ id: 'g', nr: 'G', treslag: 'G', bonitet: 17, alder: 90, hogstklasse: 5, volumDaa: 35, treantall: 70, hoyde: 22, areal: 5, tiltak: [] });
  assert.ok(Math.abs(gml.arter.reduce((x, a) => x + a.N, 0) - 70) < 1); assert.equal(gml.arter[0].art, 'G'); assert.equal(gml.arter[0].H, 22); assert.ok(gml.arter[0].kroneStart >= 0.25 && gml.arter[0].kroneStart > pu.arter[0].kroneStart * 4);
  assert.ok(SK.bestandTraer({ id: 'f', nr: 'F', treslag: 'G', bonitet: 17, alder: 1, areal: 5, tiltak: [] }).arter.some((a) => a.N <= 5 && a.H > 10)); // hogstflate med livsløpstrær
  // Skogen rundt bestand 17: maks antall, trærne ligger i bestandene, og samme skog hver gang
  const b = S.bestand.find((x) => x.nr === '17'); const start = etikettPunkt(b.geometri);
  const a1 = SK.lagSkog(S, { start, maks: 8000 }); const a2 = SK.lagSkog(S, { start, maks: 8000 });
  assert.ok(a1.traer.length > 1000 && a1.traer.length <= 9600, String(a1.traer.length)); assert.ok(a1.radius < 250);
  assert.deepEqual(a1.traer.slice(0, 20), a2.traer.slice(0, 20));
  const mp = a1.bestand.find((x) => x.b.id === b.id).mp;
  assert.ok(a1.traer.filter((t) => t.bid === b.id).slice(0, 200).every((t) => SK.iPolygon(t.x, t.y, mp)));
  assert.ok(a1.traer.every((t) => Math.hypot(t.x, t.y) <= a1.radius + 1e-6));
  // Terreng: bilineær interpolasjon i rutenettet, laveste punkt = 0
  const h = SK.lagTerreng([100, 110, 120, 130], 50, 2); assert.equal(h(-50, -50), 0); assert.equal(h(0, 0), 15); assert.ok(Math.abs(h(50, 50) - 30) < 0.1);
  assert.equal(SK.terrengPunkter([600000, 6700000], 100, 10).length, 100);
});

test('Virtuell skog: bakkevegetasjon etter vegetasjonstypen', () => {
  const b = (x) => ({ id: 'v', nr: 'V', treslag: 'G', bonitet: 14, alder: 70, hogstklasse: 4, treantall: 100, areal: 5, tiltak: [], ...x });
  const blab = SV.vegProfil(b({ vegetasjon: { kode: '7b' } }));
  assert.equal(blab.kode, '7b'); assert.equal(blab.anslaatt, false);
  assert.ok(blab.elementer.find((e) => e.type === 'blabaer').tetthet >= 2);
  const lav = SV.vegProfil(b({ treslag: 'F', vegetasjon: { kode: '6a' } }));
  assert.ok(lav.elementer[0].type === 'lav' && lav.bakke[0] > 0.6); // lys bakke
  assert.ok(SV.vegProfil(b({ vegetasjon: { kode: '8b' } })).elementer.some((e) => e.type === 'torvmose'));
  assert.ok(SV.vegProfil(b({ vegetasjon: { kode: '5b' } })).elementer.some((e) => e.type === 'hoystaude'));
  // anslag uten vegetasjonstype
  assert.equal(SV.anslaattKode({ treslag: 'F', bonitet: 8 }), '6a'); assert.equal(SV.anslaattKode({ treslag: 'G', bonitet: 14 }), '7b'); assert.equal(SV.anslaattKode({ treslag: 'G', bonitet: 20 }), '7c');
  const ans = SV.vegProfil(b({})); assert.equal(ans.anslaatt, true); assert.equal(ans.kode, '7b');
  // lys: hogstflate mer gras, tett granskog mindre blåbær enn glissen
  const flate = SV.vegProfil(b({ alder: 1, hogstklasse: 1, treantall: 0, vegetasjon: { kode: '7b' } }));
  const tett = SV.vegProfil(b({ treantall: 200, vegetasjon: { kode: '7b' } }));
  const sum = (p, t) => p.elementer.filter((e) => e.type === t).reduce((s, e) => s + e.tetthet, 0);
  assert.ok(sum(flate, 'gras') > sum(blab, 'gras') * 3);
  assert.ok(sum(tett, 'blabaer') < sum(blab, 'blabaer'));
  // rute: fast, innenfor ruta og omtrent riktig tetthet
  const r1 = SV.vegRute(10, 20, 5, blab, 'v'); const r2 = SV.vegRute(10, 20, 5, blab, 'v');
  assert.deepEqual(r1, r2);
  assert.ok(r1.every((p) => p.x >= 10 && p.x <= 15 && p.y >= 20 && p.y <= 25 && p.h > 0));
  const forventet = blab.elementer.reduce((s, e) => s + e.tetthet, 0) * 25;
  assert.ok(Math.abs(r1.length - forventet) <= forventet * 0.1 + 3, `${r1.length} vs ${forventet}`);
  assert.notDeepEqual(SV.vegRute(15, 20, 5, blab, 'v').map((p) => p.x - 5), r1.map((p) => p.x));
});

test('Virtuell skog: omgivelser – bygninger, stier, veier, hindre og skog utenfor planen', async () => {
  const { tilGeoPunkt } = await import('../js/flate-geometri.js');
  // Matrikkelen bygningspunkt (GML) og turrutebasen
  const byggXml = `<wfs:FeatureCollection><wfs:member><app:Bygning><app:bygningsnummer>1</app:bygningsnummer><app:bygningsstatus>TB</app:bygningsstatus><app:bygningstype>111</app:bygningstype><gml:Point><gml:pos>60.2 11.0</gml:pos></gml:Point></app:Bygning></wfs:member>
    <wfs:member><app:Bygning><app:bygningsnummer>2</app:bygningsnummer><app:bygningsstatus>RA</app:bygningsstatus><app:bygningstype>241</app:bygningstype><gml:Point><gml:pos>60.21 11.01</gml:pos></gml:Point></app:Bygning></wfs:member></wfs:FeatureCollection>`;
  const bygg = SO.parseBygninger(byggXml);
  assert.equal(bygg.length, 1); assert.deepEqual([bygg[0].lon, bygg[0].lat, bygg[0].type], [11, 60.2, 111]); // rammetillatelse (RA) er ikke bygd
  const ruter = SO.parseRuter('<wfs:member><app:Fotrute><app:ruteFølger>TR</app:ruteFølger><gml:posList>60.1 11.1 60.2 11.2</gml:posList></app:Fotrute></wfs:member>');
  assert.deepEqual(ruter[0], { linje: [[11.1, 60.1], [11.2, 60.2]], folger: 'TR', navn: null });
  const nv = SO.parseNvdbVeier([{ type: 'HOVED', topologinivå: 'Vegtrase', typeVeg: 'Enkel bilveg', geometri: { wkt: 'LINESTRING Z (100 200 5, 110 210 6)' }, vegsystemreferanse: { vegsystem: { vegkategori: 'F' } }, adresse: { navn: 'Testvegen' } }, { type: 'HOVED', topologinivå: 'Kjørebane', geometri: { wkt: 'LINESTRING (0 0, 1 1)' } }]);
  assert.equal(nv.length, 1); assert.deepEqual(nv[0].linje, [[100, 200], [110, 210]]); assert.equal(nv[0].navn, 'Testvegen');
  assert.equal(SO.veiProfil({ kat: 'F' }).flate, 'asfalt'); assert.equal(SO.veiProfil({ kat: 'P' }).flate, 'grus'); assert.equal(SO.veiProfil({ klasse: 7 }).flate, 'traktor');
  // Bygningsmal etter type, fast for samme nummer
  assert.equal(SO.byggMal(111, 'a').navn, 'Bolig'); assert.equal(SO.byggMal(241, 'a').navn, 'Driftsbygning (låve/fjøs)'); assert.equal(SO.byggMal(161, 'a').navn, 'Fritidsbolig');
  assert.deepEqual(SO.byggMal(111, 'x'), SO.byggMal(111, 'x')); assert.ok(SO.byggMal(241, 'x').l > SO.byggMal(181, 'x').l);
  // Hindre: vei, sti, bekk, bygning og innsjø
  const omg = { veier: [{ linje: [[-50, 0], [50, 0]], bredde: 4, flate: 'grus' }, { linje: [[0, 20], [0, 60]], bredde: 0.7, flate: 'sti' }], bekker: [{ linje: [[-50, -30], [50, -30]], bredde: 1.4 }], innsjoer: [{ mp: [[[[60, 60], [90, 60], [90, 90], [60, 90], [60, 60]]]] }], bygg: [{ x: 30, y: 30, rot: 0, mal: { l: 10, b: 8 } }] };
  const h = SO.lagHinder(omg);
  assert.equal(h(10, 1), 'vei'); assert.equal(h(10, 5), null); assert.equal(h(0.2, 40), 'sti'); assert.equal(h(0, -30.3), 'vann'); assert.equal(h(75, 75), 'vann'); assert.equal(h(30, 31), 'bygg'); assert.equal(h(-40, 40), null);
  assert.ok(SO.iBygning(omg, 33, 31)); assert.equal(SO.iBygning(omg, 36, 31), null);
  assert.equal(SO.avstandTilLinje(5, 3, [[0, 0], [10, 0]]), 3);
  const opp = SO.lagOppslag([{ id: 'a', mp: [[[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]] }]); assert.equal(opp(5, 5).id, 'a'); assert.equal(opp(15, 5), null);
  // Skog utenfor planen fra AR5, og at planens bestand går foran
  const ring = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([x, y]) => tilGeoPunkt([x, y]));
  const plan = { id: 'p', nr: '1', treslag: 'G', bonitet: 14, alder: 70, hogstklasse: 4, treantall: 100, hoyde: 18, areal: 10, tiltak: [], geometri: { type: 'Polygon', coordinates: [ring(600000, 6700000, 600100, 6700100)] } };
  const nabo = SO.naboBestand({ ar5: [{ id: 9, kategori: 'produktiv', treslag: 'L', bonitet: 14, beskrivelse: 'Skog', geometri: { type: 'Polygon', coordinates: [ring(599900, 6699900, 600200, 6700200)] } }, { id: 8, kategori: 'jordbruk', geometri: { type: 'Polygon', coordinates: [ring(0, 0, 1, 1)] } }] });
  assert.equal(nabo.length, 1); assert.ok(nabo[0].nabo && nabo[0].treslag === 'L');
  const start = tilGeoPunkt([600050, 6700050]);
  const skog = SK.lagSkog({ bestand: [plan, ...nabo] }, { start, radius: 140, fri: (x, y) => Math.abs(y) > 3 });
  const iPlan = (t) => Math.abs(t.x) < 50 && Math.abs(t.y) < 50;
  assert.ok(skog.traer.filter((t) => t.bid === 'ar5-9').every((t) => !iPlan(t))); // nabotrær bare utenfor planen
  assert.ok(skog.traer.some((t) => t.bid === 'ar5-9') && skog.traer.some((t) => t.bid === 'p'));
  assert.ok(skog.traer.every((t) => Math.abs(t.y) > 3)); // ingen trær der fri() sier nei (vei)
  assert.equal(SV.markProfil('jordbruk').beskrivelse, 'eng og beite'); assert.equal(SV.markProfil('produktiv'), null);
  // Henting: hver kilde kan feile alene
  const svar = (u) => (u.includes('bygningspunkt') ? byggXml : u.includes('turogfriluft') ? '' : u.includes('Elvenett') ? JSON.stringify({ features: [{ geometry: { type: 'LineString', coordinates: [[10.0, 60.0], [10.001, 60.0]] }, properties: { elvenavn: null } }] }) : u.includes('Innsjo') ? JSON.stringify({ features: [] }) : null);
  const hent = async (u) => { const t = svar(u); if (t == null) { const f = new Error('nede'); f.status = 503; throw f; } return { ok: true, text: async () => t, json: async () => JSON.parse(t) }; };
  const senter = [586000, 6655000];
  const o = await SO.hentOmgivelser(senter, 200, { hent, maksTid: 3000, S: { eiendom: { grense: { type: 'Polygon', coordinates: [ring(585900, 6654900, 586100, 6655100)] } } } });
  assert.equal(o.status.veier, 'feil'); assert.equal(o.status.markslag, 'feil'); assert.equal(o.status.bygninger, 1);
  assert.equal(o.grense.length, 1); assert.ok(Math.abs(o.grense[0][0][0] + 100) < 0.5);
  assert.ok(SO.terrengOppløsning(250) > 10 && SO.terrengOppløsning(250) <= 41);
});

test('Virtuell skog: framtidsskog i ungskog – hogstmoden med og uten ungskogpleie', () => {
  const ung = { id: 'u', nr: 'U', treslag: 'G', bonitet: 17, alder: 12, hogstklasse: 2, areal: 4, tiltak: [], ungskog: { treantallFor: 600, hoydeBar: 3, hoydeLauv: 4 } };
  const med = SK.framtidsskog(ung, 'pleid', { iAar: 2026 }); const uten = SK.framtidsskog(ung, 'upleid', { iAar: 2026 });
  const N = (f) => f.arter.reduce((s, a) => s + a.N, 0); const lauv = (f) => f.arter.filter((a) => a.art === 'L').reduce((s, a) => s + a.N, 0) / N(f);
  assert.equal(med.hk, 5); assert.ok(med.hogstAar < uten.hogstAar); // hogst senere uten pleie
  assert.ok(med.volum > uten.volum && med.nv > uten.nv);
  assert.ok(N(med) < N(uten)); assert.ok(lauv(med) <= 0.2 && lauv(uten) > lauv(med));
  assert.ok(med.arter[0].tykkelse > 1 && uten.arter[0].tykkelse < 1); // grove mot tynne trær
  assert.ok(med.arter[0].kroneStart < uten.arter[0].kroneStart && med.arter[0].kroneBredde > uten.arter[0].kroneBredde);
  assert.ok(med.hoyde > 15 && med.hoyde < 30);
  // lagSkog med overstyring bytter bare trærne i det ene bestandet
  const b2 = { id: 'n', nr: 'N', treslag: 'G', bonitet: 14, alder: 70, hogstklasse: 4, treantall: 100, hoyde: 18, areal: 4, tiltak: [] };
  const geo = (x0) => ({ type: 'Polygon', coordinates: [[[x0, 0], [x0 + 100, 0], [x0 + 100, 100], [x0, 100], [x0, 0]].map(([x, y]) => SK.terrengPunkter([600000 + x + 50, 6700000 + y + 50], 50, 2)[0])] });
  const S2 = { bestand: [{ ...ung, geometri: geo(0) }, { ...b2, geometri: geo(100) }] };
  const start = SK.terrengPunkter([600150, 6700100], 50, 2)[0];
  const idag = SK.lagSkog(S2, { start, radius: 200 }); const fram = SK.lagSkog(S2, { start, radius: 200, overstyr: { u: med } });
  const hU = (x) => x.traer.filter((t) => t.bid === 'u'); const snitt = (l) => l.reduce((s, t) => s + t.h, 0) / l.length;
  assert.ok(snitt(hU(fram)) > snitt(hU(idag)) * 3); // hogstmoden mot ungskog
  assert.equal(fram.traer.filter((t) => t.bid === 'n').length, idag.traer.filter((t) => t.bid === 'n').length);
  assert.equal(fram.bestand.find((x) => x.b.id === 'u').hk, 5);
});

test('Virtuell skog: arbeidsinstruks for ungskogpleie – merket før og rett etter', async () => {
  const ung = { id: 'u', nr: '5', treslag: 'G', bonitet: 14, alder: 10, hogstklasse: 2, areal: 11.87, tiltak: [{ id: 't', type: 'ungskogpleie', aar: 2027, status: 'planlagt' }], ungskog: { treantallFor: 300, hoydeBar: 3, hoydeLauv: 3.5 } };
  const N = (f, filt = () => true) => f.arter.filter(filt).reduce((s, a) => s + a.N, 0);
  const m = SK.ungskogpleieVisning(ung, 'merket', { iAar: 2026 }); const e = SK.ungskogpleieVisning(ung, 'etter', { iAar: 2026 });
  assert.equal(m.hk, 2); assert.equal(m.treantallFor, 300); assert.equal(m.startAar, 2027); assert.ok(m.kostDaa > 0);
  // Merket: alle trærne i dag er med (trær + kratt), og det som beholdes er målet.
  assert.ok(Math.abs(N(m, (a) => a.merke !== 'fjern' || a.H > 1.5) + N(m, (a) => a.merke === 'fjern' && a.H <= 1.5) - (300 + m.kratt)) < 1);
  assert.ok(Math.abs(N(m, (a) => a.merke !== 'fjern') - m.treantall) < 1);
  assert.ok(m.arter.some((a) => a.art === 'R' && a.merke === 'ros') && m.arter.some((a) => a.art === 'L' && a.merke === 'fjern'));
  // Etter: målet står igjen med jevn avstand, ROS-trær beholdt, stubber etter det som er fjernet.
  assert.ok(Math.abs(N(e, (a) => a.art !== 'S') - e.treantall) < 1 && e.treantall < 300);
  assert.ok(e.arter.filter((a) => a.art === 'G').every((a) => a.jevn));
  assert.equal(N(e, (a) => a.art === 'R'), SK.ROS_PER_DAA);
  assert.ok(N(e, (a) => a.art === 'S') > 50 && e.arter.find((a) => a.art === 'S').H < 0.3);
  assert.ok(e.avstand > 2 && e.avstand < 3.2);
  // I scenen: merkingen følger trærne, og jevn avstand gir jevnere nærmeste nabo enn ungskogen i dag.
  const geo = { type: 'Polygon', coordinates: [[[0, 0], [60, 0], [60, 60], [0, 60], [0, 0]].map(([x, y]) => SK.terrengPunkter([600000 + x + 50, 6700000 + y + 50], 50, 2)[0])] };
  const S2 = { bestand: [{ ...ung, geometri: geo }] }; const start = SK.terrengPunkter([600080, 6700080], 50, 2)[0];
  const sm = SK.lagSkog(S2, { start, radius: 100, overstyr: { u: m } });
  assert.ok(sm.traer.some((t) => t.merke === 'fjern') && sm.traer.some((t) => t.merke === 'behold') && sm.traer.some((t) => t.merke === 'ros'));
  const se = SK.lagSkog(S2, { start, radius: 100, overstyr: { u: e } });
  const gran = se.traer.filter((t) => t.art === 'G'); const naer = gran.slice(0, 150).map((t) => Math.min(...gran.filter((u) => u !== t).map((u) => Math.hypot(u.x - t.x, u.y - t.y))));
  assert.ok(Math.min(...naer) > e.avstand * 0.45, `${Math.min(...naer)}`);
  const { MERKE_FARGE } = await import('../js/skog3d-traer.js');
  assert.ok(MERKE_FARGE.fjern[0] > 1 && MERKE_FARGE.fjern[1] < 1 && MERKE_FARGE.behold[1] > 1);
});

test('Maskindata: ZIP, Shapefile, ISOXML og TLG – eksport til traktoren', async () => {
  const { tilGeoPunkt } = await import('../js/flate-geometri.js');
  const o = [600000, 6700000]; const ring = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([x, y]) => tilGeoPunkt([o[0] + x, o[1] + y]));
  // ZIP: lagret og deflate (som Operations Center), også mapper.
  const z = MD.lagZip([{ navn: 'Rx/a.txt', data: 'hei æøå' }, { navn: 'b.bin', data: new Uint8Array([1, 2, 3]) }]);
  const lest = await MD.lesZip(z); assert.deepEqual(lest.map((f) => f.navn), ['Rx/a.txt', 'b.bin']); assert.equal(new TextDecoder().decode(lest[0].data), 'hei æøå');
  assert.equal(MD.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const raw = zlib.deflateRawSync(Buffer.from('komprimert '.repeat(50)));
  const zd = MD.lagZip([{ navn: 'x.txt', data: new Uint8Array(raw) }]); const dv = new DataView(zd.buffer); dv.setUint16(8, 8, true); // metode 8 i lokalt hode
  const cOff = dv.getUint32(zd.length - 6, true); dv.setUint16(cOff + 10, 8, true); dv.setUint32(cOff + 24, 550, true);
  assert.equal(new TextDecoder().decode((await MD.lesZip(zd))[0].data), 'komprimert '.repeat(50));
  // Shapefile: polygon med hull tur–retur, med attributter (æøå i latin1).
  const poly = { type: 'Polygon', coordinates: [ring(0, 0, 200, 100), [...ring(50, 25, 100, 75)].reverse()] };
  const sf = MD.lagShapefile([{ geometri: poly, egenskaper: { FIELD: 'Skifte 1 Nordre jorde', RATE_KGHA: 400 } }], [{ navn: 'FIELD', type: 'C', lengde: 40 }, { navn: 'RATE_KGHA', type: 'N', lengde: 10, des: 0 }]);
  const tilbake = MD.lesShapefile(sf.shp, sf.dbf, sf.prj);
  assert.equal(tilbake.length, 1); assert.equal(tilbake[0].geometri.type, 'Polygon'); assert.equal(tilbake[0].geometri.coordinates.length, 2);
  assert.equal(tilbake[0].egenskaper.FIELD, 'Skifte 1 Nordre jorde'); assert.equal(tilbake[0].egenskaper.RATE_KGHA, 400);
  assert.ok(Math.abs(arealM2(tilbake[0].geometri) - (20000 - 2500)) < 200, `${arealM2(tilbake[0].geometri)}`);
  assert.equal(sf.shx.length, 108); assert.ok(sf.prj.includes('WGS_1984'));
  // UTM-shapefil (EUREF89 UTM 32) leses om til lon/lat.
  const pkt = MD.lagShapefile([{ geometri: { type: 'Point', coordinates: [597000, 6650000] }, egenskaper: { V: 1 } }], [{ navn: 'V', type: 'N', lengde: 3 }], 'punkt');
  const [lon, lat] = MD.lesShapefile(pkt.shp, pkt.dbf, 'PROJCS["ETRS89 / UTM zone 32N"]')[0].geometri.coordinates; assert.ok(lon > 10.6 && lon < 10.8 && lat > 59.9 && lat < 60.1, `${lon} ${lat}`);
  // AB-linje langs den lange siden (øst–vest → retning ca. 90°), forlenget over skiftet.
  const ab = MD.abLinje({ type: 'Polygon', coordinates: [ring(0, 0, 300, 80)] }); assert.ok(Math.abs(ab.retning - 90) <= 1 && Math.abs(ab.lengde - 300) < 2, JSON.stringify(ab));
  // Skifteplan med planlagt gjødsling og avlingskart fra i fjor → variabelt gjødselkart (Rx) og ISOXML.
  const sk = { id: 's1', nr: '1', navn: 'Nordre', geometri: { type: 'Polygon', coordinates: [ring(0, 0, 200, 100)] }, areal: 20, vekster: { 2026: { kultur: 'bygg', avling: 500 } }, jordprove: {}, gjodsling: [{ id: 'g1', aar: 2026, type: 'mineral', produkt: 'f22310', mengde: 50, dato: '2026-05-05', status: 'planlagt' }] };
  sk.avlingskart = { 2025: { rute: 20, ruter: [...Array(50)].map((_, i) => [o[0] + (i % 10) * 20, o[1] + Math.floor(i / 10) * 20, i % 10 < 3 ? 380 : i % 10 > 6 ? 620 : 500]) } };
  const S = { eiendom: { navn: 'Testgard', eier: 'Ola' }, skifteplan: { aar: 2026, skifter: [sk], sproyting: [] } };
  const valg = MD.planlagteGjodslinger(S.skifteplan, 2026); assert.equal(valg.length, 1); assert.equal(valg[0].skifter.length, 1);
  const r = MD.resept(sk, 2026, sk.gjodsling[0]);
  assert.ok(r.variabel && r.soner.length === 3, JSON.stringify(r.soner.map((x) => x.mengde)));
  const lav = r.soner.find((x) => x.id === 'lav'); const hoy = r.soner.find((x) => x.id === 'hoy');
  assert.ok(lav.mengde < 50 && hoy.mengde > 50 && lav.mengde >= 37.5 && hoy.mengde <= 62.5, `${lav.mengde} ${hoy.mengde}`);
  const pk = MD.eksportPakke(S, 2026, { valg: valg[0], versjon: 'test' });
  const navn = pk.filer.map((f) => f.navn);
  for (const n of ['SkogIQ/Testgard_skifter.shp', 'SkogIQ/Testgard_AB_linjer.shp', 'TASKDATA/TASKDATA.XML', 'LES_MEG.txt']) assert.ok(navn.includes(n), `${n} i ${navn}`);
  assert.ok(navn.some((n) => /^Rx\/.*\.shp$/.test(n)) && navn.some((n) => /^Rx\/.*\.dbf$/.test(n)) && navn.some((n) => /^Rx\/.*\.prj$/.test(n)));
  const rx = pk.filer.find((f) => /^Rx\/.*\.shp$/.test(f.navn)); const rxDbf = pk.filer.find((f) => /^Rx\/.*\.dbf$/.test(f.navn));
  const rxObj = MD.lesShapefile(rx.data, rxDbf.data); assert.equal(rxObj.length, 50); assert.ok(rxObj.every((x) => x.egenskaper.RATE_KGHA === x.egenskaper.RATE_DAA * 10));
  const xml = pk.filer.find((f) => f.navn === 'TASKDATA/TASKDATA.XML').data;
  for (const t of ['<ISO11783_TaskData VersionMajor="4"', '<PFD A="PFD1"', '<PLN A="1"', '<LSG A="1">', '<GPN A="GPN1"', '<PNT A="6"', '<TSK A="TSK1"', '<TZN A="1"', '<PDV A="0006"', '<PDT A="PDT1" B="Fullgjødsel 22-3-10"/>']) assert.ok(xml.includes(t), t);
  assert.ok(xml.includes(`B="${hoy.mengde * 1000}"`)); // kg/daa → mg/m²
  const zip = MD.lagZip(pk.filer); assert.equal((await MD.lesZip(zip)).length, pk.filer.length);
  // TLG (ISOXML-tidslogg): posisjon og utført mengde (DDI 7, mg/m²).
  const tlgXml = '<TIM A="" D="4"><PTN A="" B="" D=""/><DLV A="0007" B="" C="DET-1"/></TIM>';
  const rec = (ms, lat0, lon0, v) => { const b = new DataView(new ArrayBuffer(6 + 9 + 1 + 5)); b.setUint32(0, ms, true); b.setUint16(4, 16567, true); b.setInt32(6, Math.round(lat0 * 1e7), true); b.setInt32(10, Math.round(lon0 * 1e7), true); b.setUint8(14, 4); b.setUint8(15, 1); b.setUint8(16, 0); b.setInt32(17, v, true); return new Uint8Array(b.buffer); };
  const [la0, lo0] = [...tilGeoPunkt([o[0] + 50, o[1] + 50])].reverse();
  const bin = new Uint8Array([...rec(36000000, la0, lo0, 45000), ...rec(36001000, la0 + 0.0001, lo0, 47000)]);
  const t = MD.lesTlg(tlgXml, bin); assert.equal(t.length, 2); assert.equal(t[0].verdier[7], 45000); assert.ok(Math.abs(t[0].lat - la0) < 1e-6);
  assert.equal(t[0].tid.slice(0, 10), '2025-05-11');
});

test('Maskindata: import fra Operations Center og ISOXML til gjødseljournal, sprøytejournal, avling, KSL og økonomi', async () => {
  const { tilGeoPunkt } = await import('../js/flate-geometri.js');
  const o = [600000, 6700000]; const ring = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([x, y]) => tilGeoPunkt([o[0] + x, o[1] + y]));
  const sk1 = { id: 's1', nr: '1', geometri: { type: 'Polygon', coordinates: [ring(0, 0, 200, 100)] }, areal: 20, vekster: { 2026: { kultur: 'bygg', avling: 500 } }, jordprove: {}, gjodsling: [{ id: 'g1', aar: 2026, type: 'mineral', produkt: 'f22310', mengde: 50, dato: '2026-05-05', status: 'planlagt' }] };
  const sk2 = { id: 's2', nr: '2', geometri: { type: 'Polygon', coordinates: [ring(300, 0, 400, 100)] }, areal: 10, vekster: { 2026: { kultur: 'bygg' } }, jordprove: {}, gjodsling: [] };
  const S = { eiendom: { navn: 'Testgard' }, skifteplan: { aar: 2026, skifter: [sk1, sk2], sproyting: [], ipv: {} } };
  // Utført gjødsling fra Operations Center: punkter med AppliedRate i kg/ha og produktnavn.
  const pts = []; for (let x = 5; x < 400; x += 10) for (let y = 5; y < 100; y += 10) if (x < 200 || x > 300) pts.push({ geometri: { type: 'Point', coordinates: tilGeoPunkt([o[0] + x, o[1] + y]) }, egenskaper: { AppliedRate: x < 200 ? 520 : 400, Product: 'YaraMila 22-3-10', IsoTime: '2026-05-06T09:12:00Z' } });
  const sf = MD.lagShapefile(pts, [{ navn: 'AppliedRate', type: 'N', lengde: 8, des: 1 }, { navn: 'Product', type: 'C', lengde: 30 }, { navn: 'IsoTime', type: 'C', lengde: 24 }], 'punkt');
  const zip = MD.lagZip([{ navn: 'Testgard_application/doc.shp', data: sf.shp }, { navn: 'Testgard_application/doc.dbf', data: sf.dbf }, { navn: 'Testgard_application/doc.prj', data: sf.prj }]);
  const [op] = await MD.lesMaskinfiler([{ navn: 'export.zip', data: zip }]);
  assert.equal(op.type, 'gjodsling'); assert.equal(op.enhet, 'kg/ha'); assert.equal(op.dato, '2026-05-06'); assert.equal(op.produkt, 'YaraMila 22-3-10');
  const f = MD.forslag(S, op); assert.equal(f.endringer.length, 2); assert.equal(f.endringer[0].snitt, 52); assert.equal(f.endringer[0].planlagt, 'g1'); assert.ok(f.endringer[0].dekning > 0.95);
  const b = MD.brukImport(S, op); assert.equal(b.antall, 2);
  assert.equal(sk1.gjodsling[0].status, 'utfort'); assert.equal(sk1.gjodsling[0].mengde, 52); assert.equal(sk1.gjodsling[0].planlagtMengde, 50); assert.equal(sk1.gjodsling[0].dato, '2026-05-06');
  assert.equal(sk2.gjodsling.length, 1); assert.equal(sk2.gjodsling[0].produkt, 'f22310'); assert.equal(sk2.gjodsling[0].mengde, 40);
  assert.equal(MD.brukImport(S, op).antall, 0, 'samme fil leses ikke inn to ganger');
  // KSL 1.2.3 (gjødseljournal) er nå dokumentert fra maskindataene.
  const bevis = KSL.appBevis(S, '1.2.3', 2026); assert.equal(bevis.status, 'ok'); assert.ok(/maskin/i.test(bevis.tekst), bevis.tekst);
  // Sprøyting (l/ha) → sprøytejournalen med dose i ml/daa, mangler skadegjører (kontrollen varsler).
  const spPts = pts.filter((p, i) => i % 2).map((p) => ({ ...p, egenskaper: { AppliedRate: 2.5, Product: 'Roundup Flex', IsoTime: '2026-06-10T07:00:00Z' } }));
  const spf = MD.lagShapefile(spPts, [{ navn: 'AppliedRate', type: 'N', lengde: 8, des: 2 }, { navn: 'Product', type: 'C', lengde: 30 }, { navn: 'IsoTime', type: 'C', lengde: 24 }], 'punkt');
  const [sp] = await MD.lesMaskinfiler([{ navn: 'sp.shp', data: spf.shp }, { navn: 'sp.dbf', data: spf.dbf }]);
  assert.equal(sp.type, 'sproyting'); MD.brukImport(S, sp);
  const j = S.skifteplan.sproyting[0]; assert.equal(j.preparat, 'Roundup Flex'); assert.equal(j.dose, '250'); assert.equal(j.enhet, 'ml/daa'); assert.deepEqual(j.skifter, ['s1', 's2']);
  assert.equal(KSL.appBevis(S, '1.5.4', 2026).status, 'delvis');
  // Avling (t/ha) → avling per skifte og avlingskart i 20 m-ruter; neste års gjødselkart blir variabelt.
  const hPts = pts.filter((p) => p.egenskaper.AppliedRate === 520).map((p, i) => ({ ...p, egenskaper: { Yld_Mass_D: i % 10 < 3 ? 4.2 : 6.0, Moisture: 16, IsoTime: '2026-08-28T15:00:00Z' } }));
  const hf = MD.lagShapefile(hPts, [{ navn: 'Yld_Mass_D', type: 'N', lengde: 8, des: 2 }, { navn: 'Moisture', type: 'N', lengde: 6, des: 1 }, { navn: 'IsoTime', type: 'C', lengde: 24 }], 'punkt');
  const [h] = await MD.lesMaskinfiler([{ navn: 'h.zip', data: MD.lagZip([{ navn: 'yield.shp', data: hf.shp }, { navn: 'yield.dbf', data: hf.dbf }]) }]);
  assert.equal(h.type, 'hosting'); assert.equal(h.enhet, 't/ha'); MD.brukImport(S, h);
  assert.ok(sk1.vekster[2026].avlingRegistrert > 450 && sk1.vekster[2026].avlingRegistrert < 600, String(sk1.vekster[2026].avlingRegistrert));
  assert.ok(sk1.avlingskart[2026].ruter.length >= 40);
  sk1.vekster[2027] = { kultur: 'bygg', avling: 500 }; sk1.gjodsling.push({ id: 'g2', aar: 2027, type: 'mineral', produkt: 'f22310', mengde: 50, dato: '2027-05-05', status: 'planlagt' });
  assert.ok(MD.resept(sk1, 2027, sk1.gjodsling.at(-1)).variabel);
  // ISOXML-oppgave med tidslogg (DDI 7) leses også.
  const tlgXml = '<TIM A="" D="4"><PTN A="" B=""/><DLV A="0007" B="" C="DET-1"/></TIM>';
  const recs = []; for (let x = 310; x < 400; x += 15) for (let y = 10; y < 100; y += 15) { const [lo, la] = tilGeoPunkt([o[0] + x, o[1] + y]); const d = new DataView(new ArrayBuffer(6 + 8 + 1 + 5)); d.setUint32(0, 40000000, true); d.setUint16(4, Math.round((Date.UTC(2026, 3, 20) - Date.UTC(1980, 0, 1)) / 86400000), true); d.setInt32(6, Math.round(la * 1e7), true); d.setInt32(10, Math.round(lo * 1e7), true); d.setUint8(14, 1); d.setUint8(15, 0); d.setInt32(16, 30000, true); recs.push(...new Uint8Array(d.buffer)); }
  const task = '<ISO11783_TaskData><PDT A="PDT1" B="Kalkammonsalpeter 27-0-0"/><PFD A="PFD1" C="Skifte 2"/><TSK A="TSK1" B="KAS" E="PFD1"><TLG A="TLG00001"/></TSK></ISO11783_TaskData>';
  const iso = await MD.lesMaskinfiler([{ navn: 'TASKDATA/TASKDATA.XML', data: new TextEncoder().encode(task) }, { navn: 'TASKDATA/TLG00001.XML', data: new TextEncoder().encode(tlgXml) }, { navn: 'TASKDATA/TLG00001.BIN', data: new Uint8Array(recs) }]);
  assert.equal(iso.length, 1); assert.equal(iso[0].type, 'gjodsling'); assert.equal(iso[0].enhet, 'kg/daa'); assert.equal(iso[0].dato, '2026-04-20');
  const fi = MD.forslag(S, iso[0]); assert.equal(fi.endringer.length, 1); assert.equal(fi.endringer[0].snitt, 30);
  MD.brukImport(S, iso[0]); assert.equal(sk2.gjodsling.at(-1).produkt, 'kas');
  // Økonomi: avvik fra plan (+2 kg/daa × 20 daa), avling mot forventet, journalføringer.
  const ok = MD.presisjonsOkonomi(S, 2026);
  assert.equal(ok.avvik[0].kg, 40); assert.equal(ok.avvik[0].kr, 300); assert.ok(ok.avling.length === 1 && ok.journal >= 5);
  const ok27 = MD.presisjonsOkonomi(S, 2027); assert.equal(ok27.vra.length, 1); assert.ok(ok27.vra[0].flyttetKg > 0);
  // Produktnavn → gjødseltype
  assert.equal(MD.produktFraNavn('OPTI-KAS 27-0-0').produkt, 'kas'); assert.deepEqual(MD.produktFraNavn('Yara 20-4-11').innhold, { navn: 'Yara 20-4-11', N: 20, P: 4, K: 11 });
  assert.equal(MD.tilDato('5/14/2026 10:00'), '2026-05-14'); assert.equal(MD.tilDato('14.05.2026'), '2026-05-14');
});

test('John Deere Operations Center: innlogging, fornyet token, filer og operasjoner via serveren', async () => {
  const { lagJdRelay, jdApi } = await import('../jd-relay.js');
  let tid = 1_000_000; const kall = [];
  const WK = 'https://signin.example/.well-known';
  const svar = (status, kropp, hoder = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: (k) => hoder[k.toLowerCase()] ?? null }, json: async () => kropp, arrayBuffer: async () => (kropp instanceof Uint8Array ? kropp.buffer : new ArrayBuffer(0)) });
  let tokenNr = 0; let tilgang = false;
  const hent = async (url, o = {}) => {
    kall.push({ url, metode: o.method || 'GET', auth: o.headers?.Authorization, accept: o.headers?.Accept, body: o.body });
    if (url === WK) return svar(200, { authorization_endpoint: 'https://signin.example/authorize', token_endpoint: 'https://signin.example/token' });
    if (url === 'https://signin.example/token') { const p = new URLSearchParams(o.body); assert.ok(o.headers.Authorization.startsWith('Basic ')); tokenNr++; return svar(200, { access_token: `A${tokenNr}`, refresh_token: p.get('grant_type') === 'refresh_token' ? 'R2' : 'R1', expires_in: 3600 }); }
    assert.ok(url.startsWith('https://sandboxapi.deere.com/platform/'), url);
    const sti = url.slice('https://sandboxapi.deere.com/platform'.length);
    if (sti === '/organizations') return svar(200, { values: [{ id: 123, name: 'Testgard', links: tilgang ? [] : [{ rel: 'connections', uri: 'https://connections.deere.com/connections/abc/select-organizations' }] }] });
    if (sti === '/organizations/123/fields') return svar(200, { values: [{ id: 'f1', name: 'Skifte 1' }], links: [{ rel: 'nextPage', uri: 'https://sandboxapi.deere.com/platform/organizations/123/fields?page=2' }] });
    if (sti === '/organizations/123/fields?page=2') return svar(200, { values: [{ id: 'f2', name: 'Skifte 2' }], links: [] });
    if (sti.startsWith('/organizations/123/fields/f1/fieldOperations?')) { assert.ok(sti.includes('startDate=2026-01-01')); return svar(200, { values: [{ id: 'op1', fieldOperationType: 'application', startDate: '2026-05-06T08:00:00Z', products: [{ name: 'YaraMila 22-3-10' }] }] }); }
    if (sti === '/fieldOps/op1') { assert.equal(o.headers.Accept, 'application/zip'); assert.equal(o.headers['Accept-UOM-System'], 'METRIC'); return svar(200, new Uint8Array([0x50, 0x4b, 3, 4])); }
    if (sti === '/fieldOps/op2') return svar(202, {});
    if (sti === '/organizations/123/files' && o.method === 'POST') { assert.deepEqual(JSON.parse(o.body), { name: 'SkogIQ.zip' }); return svar(201, {}, { location: 'https://sandboxapi.deere.com/platform/files/F9' }); }
    if (sti === '/files/F9' && o.method === 'PUT') { assert.equal(o.headers['Content-Type'], 'application/zip'); return svar(204, {}); }
    return svar(404, {});
  };
  const relay = lagJdRelay({ klientId: 'id', hemmelighet: 'hemmelig', tilbakeUrl: 'https://skogiq.example/api/jd/callback', wellKnown: WK, hent, naa: () => tid });
  const n = 'a'.repeat(32);
  assert.deepEqual(relay.status(n), { konfigurert: true, tilkoblet: false, miljo: 'sandkasse' });
  assert.equal(lagJdRelay({}).status(n).konfigurert, false);
  const url = new URL(await relay.startInnlogging(n, 'https://trond-web.github.io/trond-repos/skogbruksplan/?full'));
  assert.equal(url.origin + url.pathname, 'https://signin.example/authorize'); assert.equal(url.searchParams.get('client_id'), 'id'); assert.ok(url.searchParams.get('scope').includes('offline_access'));
  assert.ok(!url.toString().includes('hemmelig'));
  const state = url.searchParams.get('state');
  // Første gang mangler appen tilgang til organisasjonen → Deeres connections-side, deretter tilbake til appen.
  const videre = await relay.callback('KODE', state);
  assert.ok(videre.startsWith('https://connections.deere.com/') && decodeURIComponent(videre).includes('skogbruksplan/?full&jd=tilkoblet'), videre);
  await assert.rejects(relay.callback('KODE', state)); // state kan bare brukes én gang
  assert.equal(relay.status(n).tilkoblet, true);
  tilgang = true;
  assert.deepEqual(await relay.organisasjoner(n), [{ id: '123', navn: 'Testgard', tilgang: true }]);
  assert.deepEqual((await relay.skifter(n, '123')).map((f) => f.id), ['f1', 'f2']); // to sider
  const ops = await relay.operasjoner(n, '123', 'f1', 2026); assert.equal(ops[0].type, 'application'); assert.deepEqual(ops[0].produkter, ['YaraMila 22-3-10']);
  assert.equal((await relay.operasjonFil(n, 'op1')).data[0], 0x50); assert.deepEqual(await relay.operasjonFil(n, 'op2'), { venter: true });
  assert.deepEqual(await relay.lastOppFil(n, '123', 'SkogIQ.zip', Buffer.from([0x50, 0x4b])), { id: 'F9' });
  // Token fornyes med refresh token når det er utløpt.
  tid += 3600 * 1000; await relay.organisasjoner(n);
  assert.ok(kall.some((k) => k.url === 'https://signin.example/token' && String(k.body).includes('grant_type=refresh_token')));
  assert.equal(kall.at(-1).auth, 'Bearer A2');
  // Ukjent nøkkel avvises.
  await assert.rejects(relay.organisasjoner('b'.repeat(32)), /Ikke koblet/);
  // HTTP-laget: tilbake-adressen må være appens egen (ingen åpen videresending).
  const kjor = (sti, url2, metode = 'GET') => new Promise((ok) => { const res = { hoder: null, status: 0, writeHead(s, h) { this.status = s; this.hoder = h; }, end(b) { ok({ status: this.status, hoder: this.hoder, kropp: b }); } }; jdApi(relay, { method: metode, url: url2, headers: { origin: 'https://trond-web.github.io' }, on: () => {} }, res, sti); });
  assert.equal((await kjor('/api/jd/logginn', `/api/jd/logginn?n=${n}&tilbake=${encodeURIComponent('https://ond.example/')}`)).status, 400);
  const ok = await kjor('/api/jd/logginn', `/api/jd/logginn?n=${n}&tilbake=${encodeURIComponent('https://trond-web.github.io/trond-repos/skogbruksplan/')}`);
  assert.equal(ok.status, 302); assert.ok(ok.hoder.Location.startsWith('https://signin.example/authorize'));
  const st = await kjor('/api/jd/status', `/api/jd/status?n=${n}`); assert.equal(JSON.parse(st.kropp).tilkoblet, true); assert.equal(st.hoder['Access-Control-Allow-Origin'], 'https://trond-web.github.io');
  const ukjent = await kjor('/api/jd/organisasjoner', `/api/jd/organisasjoner?n=${'c'.repeat(32)}`); assert.equal(ukjent.status, 401);
  assert.equal(relay.loggUt(n), true); assert.equal(relay.status(n).tilkoblet, false);
});

test('Satellitt: Sentinel-2-utsnitt og bildestripe per bestand', async () => {
  const { tilGeoPunkt } = await import('../js/flate-geometri.js');
  const o = [600000, 6700000]; const ring = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([x, y]) => tilGeoPunkt([o[0] + x, o[1] + y]));
  assert.deepEqual(SAT.SATELLITT_AAR.slice(0, 2), [2018, 2019]); assert.equal(SAT.SISTE_SATELLITTAAR, SAT.SATELLITT_AAR.at(-1));
  const g = { type: 'Polygon', coordinates: [ring(0, 0, 400, 100)] };
  const u = SAT.utsnitt(g, { px: 200, margin: 0.25 });
  assert.ok(Math.abs((u.bbox[2] - u.bbox[0]) - (u.bbox[3] - u.bbox[1])) < 1e-6, 'kvadratisk');
  assert.ok(u.sideM > 550 && u.sideM < 650, String(u.sideM)); // 400 m × 1,5
  const tall = u.sti.match(/-?\d+(\.\d+)?/g).map(Number); assert.ok(tall.every((v) => v >= 0 && v <= 200)); assert.ok(u.sti.startsWith('M') && u.sti.endsWith('Z'));
  // Lite bestand: minst 250 m utsnitt
  assert.ok(SAT.utsnitt({ type: 'Polygon', coordinates: [ring(0, 0, 20, 20)] }, { margin: 0 }).sideM >= 249);
  const url = new URL(SAT.bildeUrl(2025, u.bbox, 300));
  assert.equal(url.origin + url.pathname, 'https://wms.geonorge.no/skwms1/wms.sentinel2');
  assert.equal(url.searchParams.get('LAYERS'), '2025'); assert.equal(url.searchParams.get('CRS'), 'EPSG:3857'); assert.equal(url.searchParams.get('WIDTH'), '300');
  const html = SAT.bestandStripeHtml({ geometri: g, takstAar: 2020 });
  assert.equal((html.match(/data-sat-aar=/g) || []).length, SAT.SATELLITT_AAR.length);
  assert.equal((html.match(/for-takst/g) || []).length, 3); // 2018–2020
  assert.ok(html.includes('CC BY 4.0') && html.includes('loading="lazy"'));
  assert.equal(SAT.bestandStripeHtml({}), '');
});

test('Innlogging: brukernavn og passord, signert økt, sperre og beskyttede sider', async () => {
  const { lagInnlogging, innloggingApi, krevInnlogging, OKT_NAVN } = await import('../auth.js');
  let tid = 1_000_000_000;
  const inn = lagInnlogging({ bruker: 'test', passord: 'hemmelig1', naa: () => tid });
  assert.equal(lagInnlogging({}).aktiv, false);
  assert.ok(inn.sjekk('1', 'Test', 'hemmelig1').ok, 'brukernavn uten store/små bokstaver');
  assert.ok(!inn.sjekk('1', 'test', 'feil').ok);
  const t = inn.lagToken(); assert.equal(inn.lesToken(t).u, 'test');
  assert.equal(inn.lesToken(`${t.split('.')[0]}.forfalsket`), null);
  const [d] = t.split('.'); const endret = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(d, 'base64url')), exp: tid * 10 })).toString('base64url');
  assert.equal(inn.lesToken(`${endret}.${t.split('.')[1]}`), null, 'endret utløp avvises');
  assert.equal(lagInnlogging({ bruker: 'test', passord: 'nytt', naa: () => tid }).lesToken(t), null, 'nytt passord gjør gamle økter ugyldige');
  tid += 31 * 86400000; assert.equal(inn.lesToken(t), null, 'utløpt'); tid -= 31 * 86400000;
  for (let i = 0; i < 10; i++) inn.sjekk('9.9.9.9', 'test', 'galt');
  assert.ok(inn.sjekk('9.9.9.9', 'test', 'hemmelig1').sperret, 'sperret etter 10 feil'); assert.ok(inn.sjekk('8.8.8.8', 'test', 'hemmelig1').ok);
  // HTTP
  const res = () => { const r = { status: 0, hoder: {}, kropp: '', writeHead(s, h = {}) { r.status = s; r.hoder = h; }, end(b = '') { r.kropp = String(b); r.ferdig?.(); } }; return r; };
  const req = (metode, url, { hoder = {}, kropp = null } = {}) => { const h = {}; const q = { method: metode, url, headers: hoder, socket: { remoteAddress: '1.2.3.4' }, on: (e, f) => { h[e] = f; if (e === 'end') setTimeout(() => { if (kropp) h.data?.(Buffer.from(kropp)); f(); }, 0); }, destroy() {} }; return q; };
  const kjorApi = (q) => new Promise((ok) => { const r = res(); r.ferdig = () => ok(r); const sti = new URL(q.url, 'http://x').pathname; if (!innloggingApi(inn, q, r, sti)) ok(null); });
  const feilPw = await kjorApi(req('POST', '/api/logginn', { kropp: JSON.stringify({ bruker: 'test', passord: 'x' }) })); assert.equal(feilPw.status, 401);
  const ok = await kjorApi(req('POST', '/api/logginn', { hoder: { 'x-forwarded-proto': 'https', origin: 'https://trond-web.github.io' }, kropp: JSON.stringify({ bruker: 'test', passord: 'hemmelig1' }) }));
  assert.equal(ok.status, 200); const { token } = JSON.parse(ok.kropp); assert.ok(inn.lesToken(token));
  assert.ok(ok.hoder['Set-Cookie'].startsWith(`${OKT_NAVN}=`) && /HttpOnly/.test(ok.hoder['Set-Cookie']) && /Secure/.test(ok.hoder['Set-Cookie']) && /SameSite=Lax/.test(ok.hoder['Set-Cookie']));
  assert.equal(ok.hoder['Access-Control-Allow-Origin'], 'https://trond-web.github.io');
  assert.equal((await kjorApi(req('GET', '/api/meg'))).status, 401);
  assert.equal(JSON.parse((await kjorApi(req('GET', '/api/meg', { hoder: { authorization: `Bearer ${token}` } }))).kropp).bruker, 'test');
  // Beskyttelse: sider → innloggingen, API → 401, åpne filer og gyldig økt slipper gjennom.
  const sjekk = (q) => { const r = res(); return krevInnlogging(inn, q, r, new URL(q.url, 'http://x').pathname) ? r : null; };
  const side = sjekk(req('GET', '/felt.html?kode=AB', { hoder: { accept: 'text/html' } })); assert.equal(side.status, 302); assert.equal(side.hoder.Location, '/logginn.html?neste=%2Ffelt.html%3Fkode%3DAB');
  assert.equal(sjekk(req('GET', '/js/app.js')).status, 401);
  assert.equal(sjekk(req('GET', '/api/plan/abc')).status, 401);
  assert.equal(sjekk(req('GET', '/api/jd/logginn?n=1', { hoder: { accept: 'text/html' } })).status, 302);
  for (const fri of ['/logginn.html', '/js/innlogging.js', '/healthz', '/icon.svg', '/ikon-192.png', '/manifest.webmanifest']) assert.equal(sjekk(req('GET', fri)), null, fri);
  assert.equal(sjekk(req('OPTIONS', '/api/plan')), null);
  assert.equal(sjekk(req('GET', '/js/app.js', { hoder: { cookie: `a=1; ${OKT_NAVN}=${encodeURIComponent(token)}` } })), null);
  assert.equal(sjekk(req('GET', '/api/plan/abc', { hoder: { authorization: `Bearer ${token}` } })), null);
  assert.equal(krevInnlogging(lagInnlogging({}), req('GET', '/js/app.js'), res(), '/js/app.js'), false, 'uten innlogging satt opp er alt åpent');
  // Klienten leser utløpstiden fra tokenet.
  const { tokenUtloper } = await import('../js/innlogging.js'); assert.equal(tokenUtloper(token), inn.lesToken(token).exp); assert.equal(tokenUtloper('tull'), 0);
});

test('Grøfteplan: avstand fra jordart, fall fra terrenget, rør, utløp, økonomi og eksport', async () => {
  const { tilGeoPunkt, tilUtmPunkt } = await import('../js/flate-geometri.js');
  const o = [600000, 6700000]; const ring = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([x, y]) => tilGeoPunkt([o[0] + x, o[1] + y]));
  const sk = { id: 's1', nr: '1', areal: 60, geometri: { type: 'Polygon', coordinates: [ring(0, 0, 300, 200)] }, jordsmonn: { tekstur: 'Siltig mellomleire', drenering: 'Delvis selvdrenert' }, vekster: { 2026: { kultur: 'bygg' } } };
  assert.equal(DREN.jordartFor(sk), 'leire'); assert.equal(DREN.jordartFor({ jordsmonn: { tekstur: 'Sand' } }), 'sand'); assert.equal(DREN.jordartFor({ jordsmonn: { tekstur: 'Torv', organisk: 'Myr' } }), 'myrOmdannet');
  const f = DREN.foreslaParametre(sk); assert.deepEqual(f.intervall, [5, 8]); assert.ok(f.avstand >= 5 && f.avstand <= 6.5, String(f.avstand)); assert.ok(f.dybde >= 0.9 && f.dybde <= 1);
  assert.ok(DREN.foreslaParametre({ ...sk, jordsmonn: { tekstur: 'Torv' } }).dybde >= 1.2);
  assert.deepEqual(DREN.foreslaParametre(sk, { nedbor: '800-1200' }).intervall, [4, 8]);
  // Terreng som faller 2 % mot sør (y-retning).
  const terreng = DREN.lagTerreng({ x0: o[0] - 10, y0: o[1] - 10, x1: o[0] + 310, y1: o[1] + 210, n: 9, z: [...Array(81)].map((_, k) => 100 + Math.floor(k / 9) * (220 / 8) * 0.02) });
  const p = DREN.lagGrofteplan(sk, terreng, { avstand: 8, dybde: 1, pris: 3.9 });
  assert.ok(Math.abs(p.helning - 2) < 0.1, String(p.helning)); assert.equal(p.retning, 180);
  // Samlegrøft med fallet (nord–sør), utløp i sør (laveste ende)
  const [ux, uy] = tilUtmPunkt(p.utlop[0]); assert.ok(uy - o[1] < 5 && Math.abs(ux - o[0] - 150) < 5, `${ux - o[0]} ${uy - o[1]}`);
  assert.ok(p.samle[0].fall > 1.9 && p.samle[0].fall < 2.1); assert.ok(p.samle[0].lengde > 190);
  // Sugegrøfter på tvers av fallet med minst 1:200 fall mot samlegrøften
  assert.ok(p.sug.length > 40 && p.sug.every((g) => g.fall >= 0.5 - 1e-6), p.sug.map((g) => g.fall).join(','));
  assert.ok(p.vinkel > 5 && p.vinkel < 25, String(p.vinkel));
  assert.ok(Math.abs(p.sum.perDaa - 1000 / 8) < 25, String(p.sum.perDaa)); // ca. 125 m grøft per daa ved 8 m avstand
  assert.equal(p.samle[0].ror >= 100, true); assert.ok(Math.abs(p.samle[0].q - 6) < 0.01); // 60 daa × 0,1 l/s
  assert.equal(p.okonomi.tilskudd, 240000); assert.ok(p.okonomi.kostnad > p.okonomi.tilskudd); assert.ok(p.okonomi.breakEvenKg > 0);
  assert.deepEqual(p.varsler, []);
  // Flatt skifte: varsel om at fallet må lages med dybden
  const flat = DREN.lagGrofteplan(sk, DREN.lagTerreng({ x0: o[0] - 10, y0: o[1] - 10, x1: o[0] + 310, y1: o[1] + 210, n: 9, z: Array(81).fill(50) }), { avstand: 8 });
  assert.ok(flat.varsler.some((v) => /flatt/.test(v)) && flat.sug.length > 0);
  // Rør: kapasitet øker med diameter og fall
  assert.ok(DREN.kapasitet(83, 0.005) > DREN.kapasitet(50, 0.005) * 2.5); assert.equal(DREN.velgRor(1, 0.01).ytre, 60); assert.ok(DREN.velgRor(80, 0.003).ytre >= 160);
  // Eksport og status
  sk.drenering = { plan: p, avstand: 8, dybde: 1, status: 'plan' };
  const gj = DREN.grofterGeojson(sk); assert.equal(gj.features.filter((x) => x.properties.type === 'sugegrøft').length, p.sug.length); assert.equal(gj.features.filter((x) => x.properties.type === 'utløp').length, 1);
  assert.ok(DREN.grofteSkisse(sk).startsWith('<svg') && DREN.grofteSkisse(sk).includes('Utløp'));
  assert.deepEqual(DREN.dreneringStatus(sk.drenering).mangler, ['om arealet er grøftet før', 'beskrivelse av utløp', 'planlagt oppstart']);
  // Høydedata fra Kartverket (punkt-API, maks 50 per kall)
  const kall = []; const hent = async (u) => { const pts = JSON.parse(new URL(u).searchParams.get('punkter')); kall.push(pts.length); return { ok: true, json: async () => ({ punkter: pts.map(([, y]) => ({ z: 100 + (y - 60) * 1000 })) }) }; };
  const t2 = await DREN.hentTerreng(sk.geometri, { hent, n: 9 }); assert.deepEqual(kall, [50, 31]); assert.ok(Number.isFinite(t2(o[0] + 10, o[1] + 10)));
});

test('Krav og frister: gjødsel, plantevern, søknader, drenering, husdyr, beite, legemidler og skog', async () => {
  const { tilGeoPunkt } = await import('../js/flate-geometri.js');
  const o = [600000, 6700000]; const ring = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([x, y]) => tilGeoPunkt([o[0] + x, o[1] + y]));
  const sk = { id: 's1', nr: '1', areal: 100, geometri: { type: 'Polygon', coordinates: [ring(0, 0, 400, 250)] }, vekster: { 2026: { kultur: 'bygg', avling: 500, jordarbeiding: 'hostploying' }, 2025: { kultur: 'bygg' } }, jordprove: { dato: '2022-05-01' }, jordsmonn: { erosjon: { klasse: 3, tekst: 'Høy erosjonsrisiko' } }, gjodsling: [{ id: 'g', aar: 2026, type: 'mineral', produkt: 'f22310', mengde: 50, dato: '2026-05-05', status: 'utfort' }] };
  const S = { eiendom: { navn: 'Testgard' }, skifteplan: { aar: 2026, region: 'innland', skifter: [sk], sproyting: [{ id: 'sp', dato: '2026-06-01', skifter: ['s1'], preparat: 'X', dose: '100', skadegjorer: 'ugras', karens: 30 }], ipv: {} }, bestand: [] };
  const k = (id, s = S, idag = '2026-10-24') => KRAV.vurderKrav(s, 2026, idag).find((x) => x.id === id);
  assert.equal(k('gjodseljournal').status, 'ok');
  assert.equal(k('erosjon').status, 'delvis');
  assert.equal(k('funksjonstest').status, 'mangler'); assert.equal(k('autorisasjon').status, 'mangler');
  assert.equal(k('pt').status, 'delvis'); assert.equal(k('pt', S, '2026-11-02').status, 'mangler');
  KRAV.sikreGard(S).soknader[2026] = { pt: '2026-10-10' }; assert.equal(k('pt').status, 'ok');
  assert.equal(k('lager'), undefined, 'uten husdyr gjelder ikke husdyrkravene');
  // Husdyr: lager, spredeareal (fosfor), beite, legemiddeljournal
  const g = KRAV.sikreGard(S); g.husdyr.typer = ['storfe']; g.husdyr.oppstalling = 'bas'; g.husdyr.sone = '1-4';
  g.husdyr.gjodsel = [{ type: 'storfe', tonn: 600 }]; g.husdyr.lager = 300;
  assert.equal(k('lager').status, 'mangler'); g.husdyr.lager = 420; assert.equal(k('lager').status, 'ok'); // 8/12 × 600 = 400 m³
  const sp = k('spredeareal'); assert.equal(sp.status, 'ok', sp.tekst); // 600 t × 0,5 kg P = 300 kg P på 100 daa = 3,0 ≤ 3,5
  g.husdyr.gjodsel[0].tonn = 800; assert.equal(k('spredeareal').status, 'mangler'); assert.ok(/daa mer spredeareal/.test(k('spredeareal').tekst));
  assert.ok(/16 uker/.test(k('beite').navn)); g.beite[2026] = { slipp: '2026-05-20', inn: '2026-09-01' }; assert.equal(k('beite').status, 'mangler'); g.beite[2026].inn = '2026-09-20'; assert.equal(k('beite').status, 'ok');
  assert.equal(k('legemiddel').status, 'delvis'); g.legemiddel.push({ id: 'l', dato: '2026-03-03', dyr: 'Ku 123', legemiddel: 'Penicillin', mengde: '20 ml', tilbakeholdMelk: 5, tilbakeholdKjott: 10 }); assert.equal(k('legemiddel').status, 'ok');
  assert.equal(k('ptVaar').status, 'mangler');
  // RMP: stubb over vinteren gir tiltak
  sk.vekster[2026].jordarbeiding = 'stubb'; assert.deepEqual(KRAV.rmpTiltak(S, 2026).map((t) => t.id), ['stubb']); assert.equal(k('erosjon').status, 'ok');
  // Drenering: oppstart passert uten søknad → mangler
  sk.drenering = { plan: { sum: {} }, status: 'plan', oppstart: '2026-09-01' }; assert.equal(k('drenering-s1').status, 'mangler');
  sk.drenering.sokt = '2026-08-15'; assert.equal(k('drenering-s1').status, 'ok'); sk.drenering.utfort = '2026-10-01'; assert.equal(k('drenering-s1').status, 'delvis');
  // Skog: foryngelsesplikt 3 år etter hogst
  S.bestand = [{ id: 'b1', nr: '7', tiltak: [{ type: 'sluttavvirkning', status: 'utfort', utfortDato: '2022-06-10' }] }];
  assert.equal(k('foryngelse-b1').status, 'mangler'); assert.equal(k('foryngelse-b1').frist, '2025-06-10');
  S.bestand[0].tiltak.push({ type: 'planting', status: 'utfort', utfortDato: '2023-05-20' }); assert.equal(k('foryngelse-b1').status, 'ok');
  // Årshjul: sortert, innen 12 måneder, med faste frister
  const h = KRAV.aarshjul(S, 2026, '2026-10-24'); assert.ok(h.length >= 2 && h.every((x, i) => !i || h[i - 1].dato <= x.dato));
  assert.ok(h.some((x) => x.dato === '2027-03-15') && h.some((x) => x.dato === '2027-04-01'));
  assert.ok(h.every((x) => x.dato >= '2026-10-24' && x.dato <= '2027-10-24'));
});

test('AR i felt: grenser, stier, miljø, kulturminner, retning og varsler', async () => {
  const { tilGeoPunkt } = await import('../js/flate-geometri.js');
  const o = [600000, 6700000]; const ring = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([x, y]) => tilGeoPunkt([o[0] + x, o[1] + y]));
  const P = {
    eiendom: { grense: { type: 'Polygon', coordinates: [ring(-200, -200, 200, 200)] } },
    bestand: [{ id: 'b1', nr: '7', treslag: 'G', bonitet: 17, hogstklasse: 3, areal: 12, geometri: { type: 'Polygon', coordinates: [ring(-50, -50, 50, 50)] } }, { id: 'b2', nr: '8', treslag: 'F', geometri: { type: 'Polygon', coordinates: [ring(3000, 3000, 3100, 3100)] } }],
    veier: { veier: [{ klasse: 3, navn: 'Skogsbilvei', geometri: { type: 'LineString', coordinates: [tilGeoPunkt([o[0] - 100, o[1] + 60]), tilGeoPunkt([o[0] + 100, o[1] + 60])] } }, { klasse: 7, status: 'planlagt', geometri: { type: 'LineString', coordinates: [tilGeoPunkt(o), tilGeoPunkt([o[0] + 10, o[1]])] } }] },
    pefc: { objekter: [{ type: 'kulturminne', navn: 'Kulturminne 123: Kullgrop', kildeId: 'ra-123', geometri: { type: 'Polygon', coordinates: [ring(80, -10, 90, 0)] } }, { type: 'noekkelbiotop', navn: 'Nøkkelbiotop (MiS 9)', kildeId: 'mis-9', geometri: { type: 'Polygon', coordinates: [ring(-40, -40, -20, -20)] } }] },
    registreringer: [{ lat: tilGeoPunkt([o[0] + 5, o[1] + 5])[1], lon: tilGeoPunkt([o[0] + 5, o[1] + 5])[0], kategori: 'Barkbille', tekst: 'Angrep' }],
  };
  const inn = AR.arInnhold(P, o, { R: 500, ekstraMiljo: [{ type: 'kulturminne', navn: 'dublett', kildeId: 'ra-123', geometri: P.pefc.objekter[0].geometri }], ruter: [{ linje: [tilGeoPunkt([o[0], o[1] - 100]), tilGeoPunkt([o[0], o[1] + 100])], folger: 'ST', navn: 'Kultursti' }] });
  const typer = (l) => l.map((x) => x.type);
  assert.ok(typer(inn.linjer).includes('bestand') && typer(inn.linjer).includes('eiendom') && typer(inn.linjer).includes('vei') && typer(inn.linjer).includes('sti'));
  assert.equal(inn.linjer.filter((l) => l.type === 'kulturminne').length, 1); // dubletten er fjernet
  assert.ok(!typer(inn.linjer).includes('traktor')); // planlagt vei vises ikke
  assert.equal(inn.punkter.filter((p) => p.type === 'bestand').length, 1); // bestand 8 er utenfor R
  assert.ok(inn.punkter.some((p) => p.type === 'registrering' && p.tittel === 'Barkbille'));
  const b = inn.punkter.find((p) => p.type === 'bestand'); assert.equal(b.under, 'G17 · HK III · 12 daa');
  assert.ok(Math.abs(inn.linjer.find((l) => l.type === 'bestand').punkter[0][0] + 50) < 0.5); // lokale meter
  // Hvor er jeg, nærmeste og varsler
  assert.equal(AR.hvorEr(inn, 0, 0).bestand.nr, '7'); assert.equal(AR.hvorEr(inn, -30, -30).miljo[0].type, 'noekkelbiotop');
  const n = AR.naermeste(inn, 0, 0, { kurs: 90 }); assert.ok(n[0].avstand < n.at(-1).avstand);
  const km = AR.naermeste(inn, 0, 0, { lag: new Set(['kultur']), kurs: 90 })[0]; assert.equal(km.kompass, 'Ø'); assert.ok(Math.abs(km.relativ) < 10);
  assert.equal(AR.varsler(inn, 85, -5)[0].niva, 'stopp'); assert.equal(AR.varsler(inn, 70, -5)[0].niva, 'advarsel'); assert.equal(AR.varsler(inn, 0, 0).length, 0);
  assert.ok(AR.varsler(inn, -30, -30).some((v) => /nøkkelbiotop/.test(v.tekst)));
  assert.ok(Math.abs(AR.avstandTilFlate(100, -5, inn.flater.find((f) => f.type === 'kulturminne').mp) - 10) < 0.01);
  // Kompass: iPhone (webkitCompassHeading) og Android (absolutt alpha), med misvisning
  assert.equal(AR.kursFraOrientering({ webkitCompassHeading: 90 }, { deklinasjon: 4 }), 94);
  assert.equal(AR.kursFraOrientering({ alpha: 270, absolute: true }, { deklinasjon: 0 }), 90);
  assert.equal(AR.kursFraOrientering({ alpha: 10 }), null);
  assert.equal(AR.glattVinkel(350, 10, 0.5), 0); assert.equal(AR.peiling(0, 0, 0, 10).retning, 0); assert.equal(AR.kompassTekst(225), 'SV');
});

test('Plan fra PC til mobil: relé, pakking, fletting og synkronisering begge veier', async () => {
  // Relé: opprett, kode, kobling, versjoner og konflikt
  let klokke = 1e12; const relay = lagPlanRelay({ naa: () => klokke });
  const a = relay.send({ plan: 'QUJD', navn: 'Test' }); assert.equal(a.versjon, 1); assert.match(a.id, /^[a-f0-9]{32}$/);
  const k = relay.kode(a.id); assert.equal(k.kode.length, 6); assert.equal(relay.kobl(k.kode.toLowerCase()).id, a.id); assert.equal(relay.kobl(k.kode).id, a.id); // flere mobiler kan bruke koden
  assert.equal(relay.send({ id: a.id, plan: 'REVG', grunnVersjon: 0 }).status, 409);
  assert.equal(relay.send({ id: a.id, plan: 'REVG', grunnVersjon: 1 }).versjon, 2);
  klokke += 16 * 60 * 1000; assert.equal(relay.kobl(k.kode), null); // utløpt
  assert.equal(relay.send({ plan: '' }).status, 400);
  const ukjent = 'ab'.repeat(16); assert.equal(relay.send({ id: ukjent, plan: 'QUJD' }).id, ukjent); // gjenopprettes etter omstart
  // Pakking (gzip + base64) og fingeravtrykk
  const plan = { planId: 'p1', eiendom: { navn: 'Øvre Skog' }, endret: '2026-10-01T10:00:00Z', bestand: [{ id: 'b1', nr: '1', tiltak: [{ id: 't1', type: 'tynning', aar: 2027, status: 'planlagt' }] }], registreringer: [], synk: { id: 'x' } };
  const pk = await PS.pakk(plan); assert.equal(pk.gzip, true); const ut = await PS.pakkUt(pk); assert.equal(ut.eiendom.navn, 'Øvre Skog'); assert.equal(ut.synk, undefined);
  assert.equal(PS.planHash(plan), PS.planHash({ ...plan, endret: 'annen', synk: null })); assert.notEqual(PS.planHash(plan), PS.planHash({ ...plan, registreringer: [{ id: 'r' }] }));
  // Fletting: registreringer og tiltak fra begge, nyeste versjon per id, slettede kommer ikke tilbake
  const pc = { ...plan, endret: '2026-10-02T10:00:00Z', bestand: [{ id: 'b1', nr: '1', tiltak: [{ id: 't1', type: 'tynning', aar: 2028, status: 'planlagt', endret: '2026-10-02' }, { id: 't2', type: 'planting', aar: 2027 }] }], registreringer: [{ id: 'r1', tekst: 'PC' }] };
  const mob = { ...plan, endret: '2026-10-01T12:00:00Z', bestand: [{ id: 'b1', nr: '1', tiltak: [{ id: 't1', type: 'tynning', aar: 2027, status: 'utfort', utfortDato: '2026-10-03' }, { id: 't3', type: 'ungskogpleie', aar: 2026 }] }], registreringer: [{ id: 'r2', tekst: 'Barkbille' }] };
  PS.merkSlettet(pc, 'tiltak', 't3');
  const f = PS.flettPlaner(pc, mob);
  assert.deepEqual(f.registreringer.map((r) => r.id).sort(), ['r1', 'r2']);
  const tt = f.bestand[0].tiltak; assert.deepEqual(tt.map((t) => t.id).sort(), ['t1', 't2']); // t3 er slettet på PC
  assert.equal(tt.find((t) => t.id === 't1').status, 'utfort'); // nyeste versjon (utført i felt etter PC-endringen)
  assert.deepEqual(f.slettet.tiltak, ['t3']);
  // Synk mot reléet (falsk fetch rett mot planApi-logikken)
  const r2 = lagPlanRelay();
  const hent = async (url, o = {}) => {
    const sti = url.replace(/^https?:\/\/[^/]+/, ''); const kropp = o.body ? JSON.parse(o.body) : {}; const m = sti.match(/^\/api\/plan(?:\/([a-f0-9]{32}))?(\/kode|\/info)?$/);
    let d; let st = 200;
    if (sti === '/api/plankobling') { d = r2.kobl(kropp.kode); if (!d) { st = 404; d = { feil: 'ukjent' }; } }
    else if (!m[1]) d = r2.send(kropp); else if (m[2] === '/kode') d = r2.kode(m[1]); else if (m[2] === '/info') { d = r2.info(m[1]); if (!d) { st = 404; d = {}; } }
    else if (o.method === 'PUT') d = r2.send({ ...kropp, id: m[1] }); else { d = r2.hent(m[1]); if (!d) { st = 404; d = {}; } }
    if (d?.status && d.feil) st = d.status;
    return { ok: st < 300, status: st, json: async () => d };
  };
  const PCs = PS.lagPlanSynk({ hent, api: '', enhet: 'pc' }); const MOBs = PS.lagPlanSynk({ hent, api: '', enhet: 'mobil' });
  const delt = await PCs.del({ ...pc, synk: null }); assert.equal(delt.kode.length, 6); assert.equal(delt.status, 'sendt');
  let paMobil = await MOBs.hentMedKode(delt.kode); assert.equal(paMobil.planId, 'p1'); assert.equal(paMobil.synk.id, delt.plan.synk.id);
  assert.equal((await MOBs.synk(paMobil)).status, 'lik');
  paMobil = { ...paMobil, endret: '2026-10-05T08:00:00Z', registreringer: [...paMobil.registreringer, { id: 'r9', tekst: 'Vindfall' }] };
  const s1 = await MOBs.synk(paMobil); assert.equal(s1.status, 'sendt');
  const s2 = await PCs.synk(delt.plan); assert.equal(s2.status, 'hentet'); assert.ok(s2.plan.registreringer.some((r) => r.id === 'r9'));
  // Begge endrer samtidig → flettes
  const pcEndret = { ...s2.plan, endret: '2026-10-06T08:00:00Z', registreringer: [...s2.plan.registreringer, { id: 'rPC', tekst: 'fra PC' }] };
  const mobEndret = { ...s1.plan, endret: '2026-10-06T09:00:00Z', registreringer: [...s1.plan.registreringer, { id: 'rMOB', tekst: 'fra mobil' }] };
  assert.equal((await PCs.synk(pcEndret)).status, 'sendt');
  const s3 = await MOBs.synk(mobEndret); assert.equal(s3.status, 'flettet'); assert.ok(['rPC', 'rMOB', 'r9'].every((id) => s3.plan.registreringer.some((r) => r.id === id)));
  // Serveren glemmer planen (omstart): begge laster opp på nytt – den siste fletter i stedet for å overskrive
  r2.slett(s3.plan.synk.id);
  const pcEtter = { ...s3.plan, synk: (await PCs.synk(pcEndret)).plan.synk ?? s3.plan.synk, registreringer: [...s3.plan.registreringer, { id: 'rPC2', tekst: 'PC etter omstart' }] };
  r2.slett(s3.plan.synk.id);
  assert.equal((await PCs.synk(pcEtter)).status, 'sendt');
  const mobEtter = { ...s3.plan, registreringer: [...s3.plan.registreringer, { id: 'rMOB2', tekst: 'mobil etter omstart' }] };
  const s4 = await MOBs.synk(mobEtter); assert.equal(s4.status, 'flettet'); assert.ok(['rPC2', 'rMOB2'].every((id) => s4.plan.registreringer.some((r) => r.id === id)));
  assert.equal(PS.lenkeMedKode('ABC123', 'https://x.no/skog/index.html'), 'https://x.no/skog/felt.html?kode=ABC123');
});

test('Framskriving: ung skog med mer volum enn kurven vokser rimelig, og målt volum følges', async () => {
  const M = await import('../js/model.js');
  // Volum langt over kurven for alderen (f.eks. for lav alder): følger kurven fra samme volum, ikke ganget opp
  const a = { treslag: 'G', bonitet: 20, alder: 7, volumDaa: 6.8, takstAar: 2015 }; M.framskrivTilAar(a, 2026);
  assert.equal(a.alder, 18); assert.ok(a.volumDaa > 6.8 && a.volumDaa < 35, `volum ${a.volumDaa}`);
  // Svært ung skog: veksten langs kurven legges til målt volum
  const b = { treslag: 'L', bonitet: 17, alder: 3, volumDaa: 4.7, takstAar: 2015 }; M.framskrivTilAar(b, 2026);
  assert.ok(b.volumDaa > 4.7, `volum ${b.volumDaa}`);
  // Vanlig produksjonsskog: proporsjonal vekst langs kurven som før
  const c = { treslag: 'G', bonitet: 17, alder: 48, volumDaa: 20.1, takstAar: 2015 }; const f0 = M.volumKurve(48, 17, 'G'); const f1 = M.volumKurve(59, 17, 'G'); M.framskrivTilAar(c, 2026);
  assert.ok(Math.abs(c.volumDaa - 20.1 * (f1 / f0)) < 0.2);
  assert.ok(M.arligTilvekstDaa({ treslag: 'G', bonitet: 20, alder: 18, volumDaa: 60 }) < 3); // ingen urimelig tilvekst
});

test('Vær i den virtuelle skogen: sol, MET-varsel, snødybde og værscener', async () => {
  // Sola i Oslo ved sommersolverv kl. 13:15 (sann middag) står ca. 53° over horisonten i sør
  const s = VR.solposisjon(new Date('2026-06-21T11:15:00Z'), 59.91, 10.75); assert.ok(Math.abs(s.hoyde - 53.5) < 1.5, `${s.hoyde}`); assert.ok(Math.abs(s.asimut - 180) < 10, `${s.asimut}`);
  assert.ok(VR.solposisjon(new Date('2026-12-21T23:00:00Z'), 59.91, 10.75).hoyde < -40); // midnatt i desember
  const kveld = VR.tidFor('kveld', 60.2, 11.0, new Date('2026-10-18T09:00:00')); const hk = VR.solposisjon(kveld, 60.2, 11).hoyde; assert.ok(hk < 3 && hk > -2, `${hk}`); assert.ok(VR.solposisjon(new Date(kveld.getTime() - 3 * 3600000), 60.2, 11).hoyde > hk); // ettermiddag, sola på vei ned
  // MET-svar → nærmeste time
  const met = { properties: { timeseries: [
    { time: '2026-10-18T10:00:00Z', data: { instant: { details: { air_temperature: 3.2, wind_speed: 5.1, wind_from_direction: 225, cloud_area_fraction: 100, relative_humidity: 93 } }, next_1_hours: { summary: { symbol_code: 'lightrain' }, details: { precipitation_amount: 0.6 } } } },
    { time: '2026-10-18T11:00:00Z', data: { instant: { details: { air_temperature: -1, wind_speed: 2, wind_from_direction: 10, cloud_area_fraction: 100, relative_humidity: 90 } }, next_1_hours: { summary: { symbol_code: 'snow' }, details: { precipitation_amount: 1.2 } } } }] } };
  const v = VR.tolkMet(met, new Date('2026-10-18T10:10:00Z')); assert.equal(v.symbol, 'lightrain'); assert.equal(v.temp, 3.2);
  assert.equal(VR.tolkMet(met, new Date('2026-10-18T10:50:00Z')).symbol, 'snow');
  // Henting: MET + seNorge, og at feil i én kilde ikke stopper
  const hent = async (u) => ({ ok: true, json: async () => (u.includes('met.no') ? met : { StartDate: '18.10.2026', NoDataValue: 65535, Data: [37] }) });
  const h = await VR.hentVaer([600000, 6700000], { hent, nveBase: '/api/nve', tid: new Date('2026-10-18T10:10:00Z') }); assert.equal(h.snodybde, 37); assert.equal(h.symbol, 'lightrain');
  const uten = await VR.hentVaer([600000, 6700000], { hent: async () => { throw new Error('nede'); } }); assert.equal(uten.ok, false);
  // Scener
  const dag = { hoyde: 30, asimut: 180 }; const natt = { hoyde: -25, asimut: 0 };
  const regn = VR.vaerScene(v, dag); assert.equal(regn.type, 'regn'); assert.ok(regn.mengde > 0 && regn.taake.fjern < 200);
  const sno = VR.vaerScene({ ...VR.forhandsvaer('sno') }, dag); assert.equal(sno.type, 'sno'); assert.equal(sno.snoDekke, 1);
  const taake = VR.vaerScene(VR.forhandsvaer('take'), dag); assert.equal(taake.type, 'taake'); assert.ok(taake.taake.fjern <= 55);
  const klart = VR.vaerScene(VR.forhandsvaer('sol'), dag); assert.equal(klart.type, null); assert.ok(klart.sol.styrke > 1);
  assert.ok(VR.vaerScene(VR.forhandsvaer('sol'), natt).natt); assert.ok(VR.vaerScene(VR.forhandsvaer('sol'), natt).sol.styrke < 0.2);
  assert.ok(VR.vaerScene(VR.forhandsvaer('torden'), dag).torden);
  assert.match(VR.vaerTekst({ ...v, snodybde: 37 }), /3 °C · lett regn · vind 5,1 m\/s fra SV · 0,6 mm\/t · 37 cm snø/);
});

await Promise.all(venter);
console.log(`\n${ok} tester bestått`);
