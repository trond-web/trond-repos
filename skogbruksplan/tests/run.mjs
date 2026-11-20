// Kjør med: node tests/run.mjs
import { VILKAR as PV_VILKAR } from '../js/personvern.js';
import assert from 'node:assert/strict';
import { utmTilGeo, geoTilUtm, arealM2, punktIGeometri, etikettPunkt } from '../js/proj.js';
import { parseSosi, lagSosi } from '../js/sosi.js';
import { hkGrenser, beregnetHogstklasse, hogstklasseAvvik, framskrivTilAar, startTilstand as startT } from '../js/model.js';
import { STANDARD_INNSTILLINGER, normaliserBestand, framskriv, foreslaaForEiendom, treslagFraSR16, foreslaaTiltak, laavesteHogstalder, sammendrag, tolkHogstklasse, tolkTreslag } from '../js/model.js';
import { lesGeojson, lesCsv, lesSosi, slaaSammen } from '../js/importers.js';
import { lagDemo } from '../js/demo.js';
import { finnKommune, ryddKanterOgHull, genererPlan } from '../js/generator.js';
import { klassifiser, parseHtmlAlle, pakkUtKmz, parseKml, STANDARD_KRITERIER as STANDARD_KRIT } from '../js/kommuneanalyse.js';
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
import { parseKml as parseKmlKommune, STANDARD_KRITERIER as STANDARD_KRITERIER_KOMMUNE } from '../js/kommuneanalyse.js';
import { VERSJON, UTVIKLER, signatur, UTGITT as UTGITT_APP } from '../js/versjon.js';
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
import * as TB from '../js/tilbud.js';
import * as SF from '../js/stanford.js';
import * as HS from '../js/hpr-sr16.js';
import * as MK from '../js/skog3d-kart.js';
import * as BR from '../js/bratthet.js';
import * as MF from '../js/markfukt.js';
import * as AP from '../js/arealplan.js';
import * as SKY from '../js/sky.js';
import * as KV from '../js/kommune-vei.js';
import * as NABO from '../js/naboeiendommer.js';
import * as NATUR from '../js/naturdata.js';
import * as KULTUR from '../js/kulturminner.js';
import * as LOGG from '../js/endringslogg.js';
import { lagSkyLager, skyApi } from '../sky-lager.js';
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

test('kommuneanalyse: tynningsbehov i hogstklasse III og IV, per treslag og sortering', async () => {
  const { klassifiser: kl, perTreslag, oppsummer: opp, grunnflate, TRESLAG_REKKEFOLGE } = await import('../js/kommuneanalyse.js');
  const { beregnetHogstklasse, hkGrenser, laavesteHogstalder } = await import('../js/model.js');
  const hk = (o) => beregnetHogstklasse(o.alder, laavesteHogstalder(o), o.volumDaa, hkGrenser(o));
  // Finn en alder i HK III for gran G17 og furu F14, og HK IV
  const alderFor = (o, klasse) => { for (let a = 5; a < 150; a++) if (hk({ ...o, alder: a, volumDaa: 20 }) === klasse) return a; return null; };
  const g3 = alderFor({ treslag: 'G', bonitet: 17 }, 3); const g4 = alderFor({ treslag: 'G', bonitet: 17 }, 4); const f3 = alderFor({ treslag: 'F', bonitet: 14 }, 3);
  assert.ok(g3 && g4 && f3);
  const r = kl([
    flate({ id: 'gran-tett', alder: g3 + 2, overhoyde: 13, hoyde: 11, treantall: 220, volumDaa: 18 }),
    flate({ id: 'gran-grunnflate', alder: g3 + 2, overhoyde: 16, treantall: 120, diameter: 18, volumDaa: 22 }),
    flate({ id: 'gran-glissen', alder: g3 + 2, overhoyde: 16, treantall: 80, diameter: 14, volumDaa: 12 }),
    flate({ id: 'gran-lav-bonitet', bonitet: 11, alder: alderFor({ treslag: 'G', bonitet: 11 }, 3) + 1, overhoyde: 12, treantall: 250, volumDaa: 12 }),
    flate({ id: 'gran-for-hoy', alder: g3 + 2, overhoyde: 23, treantall: 250, volumDaa: 30 }),
    flate({ id: 'gran-for-lav', alder: g3, overhoyde: 8, treantall: 300, volumDaa: 8 }),
    flate({ id: 'gran-hk4', alder: g4 + 1, overhoyde: 18, treantall: 200, volumDaa: 25 }),
    flate({ id: 'furu-tett', treslag: 'F', bonitet: 14, alder: f3 + 3, overhoyde: 12, treantall: 200, volumDaa: 14, andel: { G: 5, F: 90, L: 5 } }),
    flate({ id: 'lauv-middels', treslag: 'L', bonitet: 14, alder: 30, overhoyde: 14, treantall: 250, volumDaa: 12 }),
    flate({ id: 'gran-mis', alder: g3 + 2, overhoyde: 13, treantall: 220, volumDaa: 18, mis: true }),
  ]);
  const ider = r.tynning.map((f) => f.id).sort();
  assert.deepEqual(ider, ['furu-tett', 'gran-grunnflate', 'gran-hk4', 'gran-tett']);
  const t = r.tynning.find((f) => f.id === 'gran-tett'); assert.equal(t.hk, 3); assert.equal(t.metode, 'Førstegangstynning'); assert.ok(Math.abs(t.uttakM3 - 18 * 10 * 0.25) < 1e-9); assert.ok(t.rotnetto > 0);
  assert.match(t.grunn, /HK III, gran bonitet 17, overhøyde 13 m, 220 trær\/daa/);
  assert.equal(r.tynning.find((f) => f.id === 'gran-hk4').hk, 4); assert.equal(r.tynning.find((f) => f.id === 'gran-hk4').metode, 'Tynning');
  assert.ok(Math.abs(grunnflate(120, 18) - 30.54) < 0.01); assert.equal(grunnflate(null, 18), null);
  assert.ok(!r.hogst.some((f) => f.id.startsWith('gran-hk4')), 'ikke både tynning og sluttavvirkning');
  // Lauv bare på høy bonitet (standard 17) – kan senkes
  assert.deepEqual(kl([flate({ id: 'l', treslag: 'L', bonitet: 14, alder: 30, overhoyde: 14, treantall: 250, volumDaa: 12 })], { ...STANDARD_KRIT, tynnMinBonitetLauv: 11 }).tynning.map((f) => f.id), hk({ treslag: 'L', bonitet: 14, alder: 30, volumDaa: 12 }) === 3 ? ['l'] : []);
  const pt = perTreslag(r.tynning); assert.equal(pt.G.antall, 3); assert.equal(pt.F.antall, 1); assert.ok(!pt.L); assert.ok(Math.abs(pt.G.areal - 30) < 1e-9);
  assert.ok(opp(r.tynning).uttak > 0); assert.deepEqual(Object.keys(TRESLAG_REKKEFOLGE), ['G', 'F', 'L']);
});

test('Store kommuner: romlig indeks gir samme svar som full gjennomgang, og stegvis matching gir pusterom', async () => {
  const P = await import('../js/proj.js'); const { merkMisOgVern } = await import('../js/kommuneanalyse.js');
  const V = await import('../js/kommune-vei.js'); const N = await import('../js/naturdata.js'); const KU = await import('../js/kulturminner.js');
  const ruteGeo = (x, y, s = 0.004) => ({ type: 'Polygon', coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]] });
  // 30 × 30 flater og 25 «MiS»/naturflater spredt over et område på ca. 0,4 × 0,4 grader
  const flater = []; for (let i = 0; i < 30; i++) for (let j = 0; j < 30; j++) { const x = 10 + i * 0.013; const y = 60 + j * 0.013; flater.push({ id: `${i}-${j}`, geometri: ruteGeo(x, y), senter: [x + 0.002, y + 0.002] }); }
  const mis = []; for (let k = 0; k < 25; k++) mis.push(ruteGeo(10 + (k % 5) * 0.08 + 0.001, 60 + Math.floor(k / 5) * 0.08 + 0.001, 0.02));
  const vern = [{ navn: 'Testreservatet', verneform: 'Naturreservat', geometri: ruteGeo(10.2, 60.2, 0.05) }];
  merkMisOgVern(flater, mis, vern);
  for (const f of flater) { assert.equal(f.mis, mis.some((m) => P.punktIGeometri(f.senter, m)), f.id); assert.equal(f.vern, P.punktIGeometri(f.senter, vern[0].geometri) ? 'Naturreservat: Testreservatet' : null, f.id); }
  assert.ok(flater.some((f) => f.mis) && flater.some((f) => f.vern));
  // Indeksen finner alle som krysser, hver én gang
  const ix = P.lagBoksIndeks(mis, (g) => P.boksFor(g)); const sp = [10.05, 60.05, 10.2, 60.2];
  assert.deepEqual(ix.sok(sp).length, mis.filter((m) => P.kryssBoks(sp, P.boksFor(m))).length);
  assert.deepEqual(P.boksFor({ type: 'MultiPolygon', coordinates: [[[[1, 2], [3, 4], [0, 9]]]] }), [0, 2, 3, 9]);
  const stor = { type: 'Polygon', coordinates: [Array.from({ length: 300000 }, (_, i) => [10 + Math.sin(i) * 0.1, 60 + Math.cos(i) * 0.1])] };
  assert.ok(P.boksFor(stor)[0] < 10, 'ingen RangeError for store geometrier');
  // Stegvis = samme svar, med framdrift
  const n = { nin: mis.slice(0, 10).map((g, i) => ({ id: `n${i}`, type: 'nin', navn: 'X', geometri: g })), art: [] };
  const fr = []; const a = N.merkFlater(flater, n); const b = await N.merkFlaterStegvis(flater, n, { framdrift: (x) => fr.push(x) });
  assert.deepEqual([...a.keys()].sort(), [...b.keys()].sort()); assert.ok(a.size > 0);
  const km = mis.slice(10, 14).map((g, i) => ({ id: `k${i}`, navn: 'Gravfelt', geometri: g }));
  assert.deepEqual([...KU.merkFlater(flater, km).keys()].sort(), [...(await KU.merkFlaterStegvis(flater, km)).keys()].sort());
  const veier = [[[600000, 6650000], [620000, 6690000]], [[605000, 6700000], [640000, 6660000]]].map((l) => l.map(([x, y]) => [x, y]));
  const v1 = V.avstanderTilVei(flater, veier); const v2 = await V.avstanderTilVeiStegvis(flater, veier);
  assert.deepEqual([...v1.entries()], [...v2.entries()]);
  // Den nye beskjæringen gir samme svar som et rått søk mot alle segmenter
  const seg = veier.flatMap((l) => l.slice(1).map((p, i) => [...l[i], ...p]));
  for (const f of flater.slice(0, 120)) {
    const pk = V.kantpunkter(f.geometri); let best = Infinity;
    for (const [ax, ay, bx, by] of seg) for (const [px, py] of pk) { const dx = bx - ax; const dy = by - ay; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy)); }
    assert.equal(v1.get(f.id), best <= V.MAKS_AVSTAND ? Math.round(best / 10) * 10 : null, f.id);
  }
  // Kompakt lagring: geometrien pakkes i typede tabeller og pakkes ut likt
  const { pakkKommunedata, pakkUtKommunedata } = await import('../js/kommuneanalyse.js');
  const multi = { id: 'm', geometri: { type: 'MultiPolygon', coordinates: [[[[1, 2], [3, 4], [5, 6], [1, 2]], [[1.5, 2.5], [2, 3], [1.5, 2.5]]], [[[7, 8], [9, 10], [7, 8]]]] }, senter: [1, 2], treslag: 'G' };
  const d0 = { kommune: { nr: '1' }, flater: [...flater.slice(0, 50), multi], mis };
  const pk = pakkKommunedata(d0); assert.ok(pk.geoPakket.k instanceof Float64Array && pk.geoPakket.st instanceof Int32Array); assert.equal(pk.flater[0].geometri, undefined); assert.ok(d0.flater[0].geometri, 'originalen er urørt');
  const ut = pakkUtKommunedata(structuredClone(pk)); assert.deepEqual(ut.flater, d0.flater); assert.equal(ut.geoPakket, undefined); assert.deepEqual(ut.mis, mis);
  assert.equal(pakkUtKommunedata(d0), d0, 'upakket (eldre lagring) brukes som før'); assert.equal(pakkKommunedata(pk), pk);
  let kall = 0; await P.stegvis(Array.from({ length: 5000 }), () => kall++, { hver: 1000, framdrift: (x) => fr.push(x) }); assert.equal(kall, 5000); assert.ok(fr.includes(1));
});

test('Skjøtselsbehov i planen: ungskogpleie og tynning i innsikten, samme regler som kommuneanalysen, og tiltak', async () => {
  const SK = await import('../js/skjotsel.js'); const { lagInnsikt } = await import('../js/innsikt.js');
  const { STANDARD_INNSTILLINGER: INN, beregnetHogstklasse, hkGrenser, laavesteHogstalder } = await import('../js/model.js');
  const alderFor = (o, klasse) => { for (let x = 5; x < 150; x++) if (beregnetHogstklasse(x, laavesteHogstalder(o), 20, hkGrenser(o)) === klasse) return x; return null; };
  const g3 = alderFor({ treslag: 'G', bonitet: 17 }, 3);
  const best = (o) => ({ id: o.nr, nr: o.nr, areal: 10, treslag: 'G', bonitet: 17, alder: g3 + 2, volumDaa: 18, treantall: 220, hoyde: 12, tiltak: [], ekstra: { OVERHOYDE: 13, MIDDELDIAMETER: 14 }, takstAar: 2026, ...o });
  const S = { innstillinger: INN, bestand: [
    best({ nr: '1' }),                                                         // tynning
    best({ nr: '2', tiltak: [{ id: 't', type: 'tynning', aar: 2027, status: 'planlagt' }] }), // allerede planlagt
    best({ nr: '3', miljo: true }),                                            // miljøfigur
    best({ nr: '4', alder: 12, volumDaa: 2, hoyde: 4, treantall: 40, treslagAndel: { G: 0.5, F: 0, L: 0.5 }, ekstra: { KILDE: 'SR16' } }), // ungskog, lauv
    best({ nr: '5', alder: 12, volumDaa: 2, hoyde: 4, treantall: 40, treslagAndel: { G: 1, F: 0, L: 0 }, ekstra: { KILDE: 'SR16' } }),     // ren, glissen
    best({ nr: '6', treantall: 90, ekstra: { OVERHOYDE: 16, MIDDELDIAMETER: 22 } }), // tynning via grunnflate (90 · 10 · π · 0,11² ≈ 34 m²/ha)
  ] };
  const r = SK.skjotselsbehov(S);
  assert.deepEqual(r.tynning.map((x) => x.b.nr).sort(), ['1', '6']); assert.deepEqual(r.ungskog.map((x) => x.b.nr), ['4']);
  assert.match(r.ungskog[0].grunn, /50 % lauv/); assert.equal(r.tynning.find((x) => x.b.nr === '1').metode, 'Førstegangstynning');
  // Samme regel som kommuneanalysen for samme skog
  const f = SK.bestandSomFlate(S.bestand[0], INN); const k = SK.vurderTynning({ ...f, hk: undefined }, SK.SKJOTSEL_KRITERIER, INN);
  assert.equal(k.hk, f.hk); assert.equal(k.grunn, r.tynning.find((x) => x.b.nr === '1').grunn);
  const ins = lagInnsikt(S, { iAar: 2026 });
  const ty = ins.find((i) => /trenger trolig tynning/.test(i.tittel)); const un = ins.find((i) => /ungskogpleie/.test(i.tittel));
  assert.ok(ty && un); assert.equal(ty.handling.id, 'skjotsel:tynning'); assert.equal(ty.handling2.id, 'farge:skjotsel'); assert.match(ty.tittel, /^2 bestand/); assert.match(ty.tekst, /bestand 1, 6|bestand 6, 1/);
  assert.ok(ins.indexOf(ty) < 4 && ins.indexOf(un) < 4, 'vises blant de fire øverste når det ikke er mer alvorlige funn');
  const tt = SK.skjotselsTiltak(r, 'tynning', 2026); assert.equal(tt.length, 2); assert.equal(tt[0].tiltak.type, 'tynning'); assert.equal(tt[0].tiltak.aar, 2027); assert.equal(tt[0].tiltak.status, 'planlagt');
  assert.equal(SK.skjotselsTiltak(r, 'ungskog', 2026)[0].tiltak.type, 'ungskogpleie');
  // Når tiltakene er lagt inn, forsvinner funnet
  for (const { bid, tiltak } of [...tt, ...SK.skjotselsTiltak(r, 'ungskog', 2026)]) S.bestand.find((b) => b.id === bid).tiltak.push({ ...tiltak, id: `x${bid}` });
  const etter = SK.skjotselsbehov(S); assert.equal(etter.tynning.length + etter.ungskog.length, 0);
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
  // Beregnet for HK I–II fra treantall før regulering; ikke supplering når treantallet bare er fra SR16/takst
  const c = { id: 'c', nr: '8', treslag: 'G', bonitet: 17, alder: 6, hogstklasse: 2, areal: 3, tiltak: [], ungskog: { treantallFor: 70 } };
  assert.deepEqual([TT.tetthet(c).klasse, TT.tetthet(c).kilde, TT.tetthet(c).grunnlag], ['b', 'beregnet', 'ungskog']);
  assert.ok(motorTiltak({ bestand: [c] }, { iAar: 2026, balanser: false }).some((f) => f.type === 'suppleringsplanting'));
  const d = { ...c, ungskog: undefined, treantall: 70 };
  assert.equal(TT.tetthet(d).grunnlag, 'data');
  assert.ok(!motorTiltak({ bestand: [d] }, { iAar: 2026, balanser: false }).some((f) => f.type === 'suppleringsplanting'));
  assert.equal(TT.tetthet({ ...c, ungskog: { treantallFor: 200 } }).klasse, 'a');
  assert.equal(TT.tetthet({ ...c, ungskog: { treantallEtter: 40, treantallFor: 300 } }).klasse, 'a', 'før regulering avgjør');
  assert.match(TT.tetthet(c).forklaring, /70 trær\/daa før regulering \(registrert\) – minst 100 for G17.*per treslag/);
  // Barskog: bare bartrærne teller (lauv er ikke med)
  const lauvrik = { ...c, ungskog: { treslagFor: { G: 60, F: 0, L: 400 }, treantallFor: 460 } };
  assert.equal(TT.tetthet(lauvrik).klasse, 'b'); assert.match(TT.tetthet(lauvrik).forklaring, /Bare bartrær teller i barskog \(400 lauv\/daa/);
  assert.equal(TT.tetthet({ ...lauvrik, treslag: 'L', treslagAndel: { L: 0.8, G: 0.2 } }).klasse, 'a', 'lauvbestand: alle treslag teller');
  // HK I beregnes også (ikke lenger «rydding»): ikke plantet ennå → b, nok planter → a
  const hk1 = { id: 'h1', nr: '10', treslag: 'G', bonitet: 17, alder: 0, hogstklasse: 1, areal: 4, tiltak: [] };
  assert.deepEqual([TT.tetthet(hk1).klasse, TT.tetthet(hk1).kilde], ['b', 'beregnet']); assert.equal(TT.hkTekst(hk1), 'I b');
  assert.equal(TT.tetthet({ ...hk1, ungskog: { treantallFor: 180 } }).klasse, 'a');
  // HK III–V: ikke beregnet, men hint
  const e = { id: 'e', nr: '9', treslag: 'G', bonitet: 14, alder: 80, volumDaa: 9, hogstklasse: 4, areal: 5, tiltak: [] };
  const te = TT.tetthet(e); assert.equal(te.klasse, null); assert.match(te.hint, /kan tyde på mindre tilfredsstillende/);
  assert.equal(TT.hkTekst(e), 'IV');
  assert.equal(TT.tetthetNavn(1, 'b'), 'mindre tilfredsstillende tetthet');
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

test('Tilbud: forespørsel fra oppdrag, offentlig innhold, sammenligning og tildeling', async () => {
  const OP = await import('../js/oppdrag.js');
  const { tilGeoPunkt } = await import('../js/flate-geometri.js');
  const o0 = [600000, 6700000]; const ring = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([x, y]) => tilGeoPunkt([o0[0] + x, o0[1] + y]));
  let n = 0; const nyId = (p) => `${p}${++n}`;
  const S = { eiendom: { navn: 'Testskogen', kommune: 'Løten', eier: 'Ola Nordmann' }, bestand: [
    { id: 'b1', nr: '5', areal: 12, treslag: 'G', bonitet: 17, alder: 85, geometri: { type: 'Polygon', coordinates: [ring(0, 0, 100, 120)] }, tiltak: [{ id: 't1', type: 'planting', aar: 2027, status: 'planlagt' }] },
    { id: 'b2', nr: '6', areal: 8, treslag: 'G', bonitet: 14, alder: 90, geometri: { type: 'Polygon', coordinates: [ring(100, 0, 180, 100)] }, tiltak: [{ id: 't2', type: 'planting', aar: 2027, status: 'planlagt' }] }] };
  const { oppdrag: [o] } = OP.lagOppdrag(S, S.bestand.map((b) => ({ bestand: b, tiltak: b.tiltak[0] })), { nyId, iAar: 2026 });
  const f = TB.nyForesporsel(S, o, { idag: '2026-10-28', kontakt: { navn: 'Ola', telefon: '900 00 000' } });
  assert.equal(f.prisform, 'enhet'); assert.equal(f.enhet, 'plante'); assert.equal(f.mengde, 4400); // 220 planter/daa × 20 daa
  assert.equal(f.svarfrist, '2026-11-11'); assert.ok(f.krav.includes('skatteattest') && f.krav.includes('tariff') && f.krav.includes('pefc') && !f.krav.includes('sha'));
  assert.ok(f.beskrivelse.includes('Plantetall: 220 per daa'));
  assert.ok(TB.nyForesporsel(S, { ...o, type: 'vei' }, {}).krav.includes('sha'));
  assert.equal(TB.prisformFor('sluttavvirkning').enhet, 'm³'); assert.equal(TB.prisformFor('vei').form, 'fast');
  assert.deepEqual(TB.mangler(f), ['minst én mottaker']);
  f.mottakere = [{ id: 'm1', navn: 'Kari', firma: 'Plantelaget AS', epost: 'kari@example.no' }, { id: 'm2', navn: 'Per', firma: 'Skogkultur Per', telefon: '+47 911 11 111' }, { id: 'm3', navn: 'Lise', firma: 'Billig & Rask', epost: 'l@example.no' }];
  assert.deepEqual(TB.mangler(f), []);
  // Det utførerne ser: omfang, kart og krav – ikke andre mottakere, nøkler eller eierens interne data.
  const pub = TB.offentligForesporsel(S, o, f, { tiltakNavn: (t) => (t === 'planting' ? 'Planting' : t) });
  assert.equal(pub.omfang.bestand.length, 2); assert.equal(pub.omfang.areal, 20); assert.equal(pub.kart.length, 2); assert.equal(pub.sted, 'Testskogen, Løten');
  const json = JSON.stringify(pub); assert.ok(!json.includes('Plantelaget') && !json.includes('kari@') && !json.includes('mottaker'));
  assert.ok(pub.krav.every((k) => k.tekst));
  // Sammenligning: total fra enhetspris × mengde, krav, frist og gyldighet.
  f.svar = [
    { mottakerId: 'm1', prisform: 'enhet', enhetspris: 4.5, oppstart: '2027-05-10', ferdig: '2027-06-01', gyldigTil: '2099-01-01', krav: Object.fromEntries(f.krav.map((k) => [k, true])), mottatt: '2026-11-05T10:00:00Z' },
    { mottakerId: 'm2', prisform: 'enhet', enhetspris: 4.2, krav: Object.fromEntries(f.krav.map((k) => [k, true])), mottatt: '2026-11-12T10:00:00Z' },
    { mottakerId: 'm3', prisform: 'enhet', enhetspris: 3.1, krav: { mva: true }, mottatt: '2026-11-06T10:00:00Z' }];
  const r = TB.sammenlign(f, 20);
  assert.deepEqual(r.map((x) => x.mottakerId), ['m3', 'm2', 'm1']);
  assert.equal(r.find((x) => x.mottakerId === 'm1').total, 19800); assert.equal(r.find((x) => x.mottakerId === 'm1').perDaa, 990);
  assert.ok(r.find((x) => x.mottakerId === 'm2').billigst, 'billigste med alle krav (m3 mangler krav)');
  assert.ok(r.find((x) => x.mottakerId === 'm2').etterFrist); assert.ok(!r.find((x) => x.mottakerId === 'm3').kravAlle);
  // Tildeling: utfører, avtale, periode og status i oppdraget.
  TB.tildel(o, f, 'm1', { idag: '2026-11-15' });
  assert.equal(f.status, 'tildelt'); assert.equal(o.status, 'bestilt'); assert.equal(o.utforer.navn, 'Plantelaget AS'); assert.equal(o.avtale.pris, 19800); assert.equal(o.periode.fra, '2027-05-10');
  // Meldinger
  const t = TB.foresporselTekst(pub, f.mottakere[0], 'https://x/tilbud.html?f=1&k=2'); assert.ok(t.tekst.includes('https://x/tilbud.html?f=1&k=2') && t.emne.includes(o.nr));
  assert.ok(TB.akseptTekst(o, f, f.svar[0], f.mottakere[0]).tekst.replace(/\s/g, ' ').includes('19 800'));
  assert.ok(TB.mailto('a@b.no', t).startsWith('mailto:a%40b.no?subject=')); assert.ok(TB.smsLenke('+47 911 11 111', 'hei').startsWith('sms:+4791111111?body='));
});

test('Tilbud på serveren: eiernøkkel, personlige koder, svar, avgjort og opprydding', async () => {
  const { lagTilbudRelay, tilbudApi } = await import('../tilbud-relay.js');
  let tid = 1_000_000; const r = lagTilbudRelay({ naa: () => tid });
  const ny = r.opprett({ data: { tittel: 'Planting', svarfrist: '2026-11-11' }, mottakere: [{ id: 'm1', navn: 'Kari' }, { id: 'm2', navn: 'Per' }] });
  assert.match(ny.id, /^[a-f0-9]{16}$/); assert.match(ny.eier, /^[a-f0-9]{32}$/); assert.ok(ny.koder.m1 && ny.koder.m2 && ny.koder.m1 !== ny.koder.m2);
  assert.equal(r.vis(ny.id, 'feil').status, 404); assert.equal(r.svarFor(ny.id, 'feil').status, 404);
  const v = r.vis(ny.id, ny.koder.m1); assert.equal(v.data.tittel, 'Planting'); assert.equal(v.mottaker.navn, 'Kari'); assert.equal(v.svar, null);
  assert.ok(!JSON.stringify(v).includes('Per'), 'mottakeren ser ikke de andre');
  assert.equal(r.svar(ny.id, ny.koder.m1, { kommentar: 'uten pris' }).status, 400);
  assert.ok(r.svar(ny.id, ny.koder.m1, { prisform: 'enhet', enhetspris: '4,5'.replace(',', '.'), firma: 'Plantelaget', orgnr: '912 345 678', krav: { pefc: true, 'ond<script>': true }, ukjent: 'x' }).ok);
  const sv = r.svarFor(ny.id, ny.eier); assert.equal(sv.svar.length, 1); assert.equal(sv.svar[0].enhetspris, 4.5); assert.equal(sv.svar[0].orgnr, '912345678'); assert.deepEqual(sv.svar[0].krav, { pefc: true }); assert.equal(sv.svar[0].ukjent, undefined);
  assert.ok(sv.apnet.m1 && !sv.apnet.m2);
  assert.equal(r.vis(ny.id, ny.koder.m1).svar.enhetspris, 4.5, 'mottakeren ser sitt eget svar');
  // Ny mottaker etter utsending
  const d = r.oppdater(ny.id, ny.eier, { mottakere: [{ id: 'm3', navn: 'Lise' }] }); assert.ok(d.koder.m3);
  // Tildeling: ingen nye svar, vinneren ser at tilbudet er akseptert
  r.oppdater(ny.id, ny.eier, { status: 'tildelt', mottakere: { valgt: 'm1' } });
  assert.equal(r.svar(ny.id, ny.koder.m2, { enhetspris: 3 }).status, 409);
  assert.equal(r.vis(ny.id, ny.koder.m1).vunnet, true); assert.equal(r.vis(ny.id, ny.koder.m2).vunnet, false);
  assert.equal(r.opprett({ data: { x: 'a'.repeat(500 * 1024) } }).status, 413);
  // Rydding etter 180 dager uten bruk
  tid += 181 * 86400000; r.opprett({ data: { tittel: 'ny' } }); assert.equal(r.vis(ny.id, ny.koder.m1).status, 404);
  // HTTP
  const kjor = (metode, url, kropp) => new Promise((ok) => { const h = {}; const req = { method: metode, url, headers: { origin: 'https://trond-web.github.io' }, on: (e, f) => { h[e] = f; if (e === 'end') setTimeout(() => { if (kropp) h.data?.(Buffer.from(JSON.stringify(kropp))); f(); }, 0); }, destroy() {} }; const res = { writeHead(s, hd) { this.s = s; this.h = hd; }, end(b) { ok({ status: this.s, hoder: this.h, kropp: JSON.parse(b) }); } }; tilbudApi(r, req, res, new URL(url, 'http://x').pathname); });
  const p = await kjor('POST', '/api/tilbud', { data: { tittel: 'Vei' }, mottakere: [{ id: 'a', navn: 'A' }] }); assert.equal(p.status, 200); assert.equal(p.hoder['Access-Control-Allow-Origin'], 'https://trond-web.github.io');
  assert.equal((await kjor('GET', `/api/tilbud/${p.kropp.id}?k=${p.kropp.koder.a}`)).kropp.data.tittel, 'Vei');
  assert.equal((await kjor('POST', `/api/tilbud/${p.kropp.id}/svar?k=${p.kropp.koder.a}`, { pris: 250000 })).status, 200);
  assert.equal((await kjor('GET', `/api/tilbud/${p.kropp.id}/svar?e=${p.kropp.eier}`)).kropp.svar[0].pris, 250000);
  assert.equal((await kjor('GET', `/api/tilbud/${p.kropp.id}/svar?e=feil`)).status, 404);
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

// Plan med tre hogstbestand, miljøobjekter og velteplass for StanForD-testene.
function stanfordPlan() {
  const S = lagDemo(2026);
  const kand = S.bestand.filter((b) => b.geometri).sort((a, b) => (b.volumDaa || 0) - (a.volumDaa || 0)).slice(0, 3);
  kand.forEach((b, i) => { b.tiltak = [{ id: `t${i}`, type: i === 2 ? 'tynning' : 'sluttavvirkning', aar: 2026, status: 'planlagt' }]; b.treantall = 120; });
  const [lx, ly] = kand[0].geometri.coordinates.flat(Infinity);
  S.pefc = { ...tomPefc(), objekter: [
    { id: 'km1', type: 'kulturminne', navn: 'Kullgrop', geometri: { type: 'Polygon', coordinates: [[[lx, ly], [lx + 0.0003, ly], [lx + 0.0003, ly + 0.0002], [lx, ly]]] } },
    { id: 'll1', type: 'livslopstre', navn: 'Gammel osp', geometri: { type: 'Point', coordinates: [lx + 0.0002, ly + 0.0001] } },
    { id: 'b1', type: 'vann', navn: 'Bekk', geometri: { type: 'LineString', coordinates: [[lx, ly], [lx + 0.001, ly + 0.001]] } }] };
  S.veier = { veier: [], stier: [], punkter: [{ id: 'vp1', type: 'velteplass', navn: 'Velteplass ved bommen', geometri: { type: 'Point', coordinates: [lx, ly] } }] };
  const { oppdrag } = OPP.lagOppdrag(S, kand.map((b) => ({ bestand: b, tiltak: b.tiltak[0] })), { nyId: (p) => `${p}${Math.random().toString(36).slice(2, 8)}`, iAar: 2026 });
  const hogst = oppdrag.find((o) => o.type === 'sluttavvirkning'); hogst.felt.kjoper = 'Viken Skog'; hogst.merknad = 'Pass på <bekk> & stier';
  return { S, kand, hogst, tynning: oppdrag.find((o) => o.type === 'tynning') };
}
const tekstFiler = (filer) => filer.map((f) => ({ navn: f.navn, data: typeof f.data === 'string' ? new TextEncoder().encode(f.data) : f.data }));

test('StanForD 2010: filsett til hogstmaskin og lassbærer (oin, ogi med Shapefile, spi, pin, foi, fdi, env)', async () => {
  const { S, kand, hogst } = stanfordPlan();
  const fs = SF.lagFilsett(S, hogst, { versjon: '3.6', naa: new Date('2026-10-28T10:00:00') });
  const navn = fs.filer.map((f) => f.navn);
  for (const e of ['oin', 'ogi', 'spi', 'pin', 'foi', 'fdi']) assert.ok(navn.some((n) => n.endsWith(`.${e}`)), e);
  assert.ok(navn.some((n) => n.endsWith('_kart.env')) && navn.includes('LES_MEG.txt'));
  const fil = (e) => fs.filer.find((f) => f.navn.endsWith(e)).data;
  // oin: objekt-ID, ett delobjekt per bestand, sortimenter og tekst til fører (escapet).
  const oin = SF.lesXml(fil('.oin')).c[0];
  assert.equal(oin.n, 'ObjectInstruction'); assert.equal(oin.a.messageType, 'oin'); assert.equal(oin.a.version, '3.6');
  assert.match(fil('.oin'), /xmlns="urn:skogforsk:stanford2010"/);
  assert.match(fil('.oin'), /<ObjectUserID agency="ForestOwner">SkogIQ-O-2026-01<\/ObjectUserID>/);
  assert.match(fil('.oin'), /<CreationDate>2026-10-28T10:00:00[+-]\d\d:\d\d<\/CreationDate>/);
  const def = oin.c.find((c) => c.n === 'ObjectDefinition');
  const sub = def.c.filter((c) => c.n === 'SubObject').map((c) => c.c.find((x) => x.n === 'SubObjectUserID').t);
  assert.deepEqual(sub.sort(), kand.slice(0, 2).map((b) => b.id).sort());
  assert.ok(def.c.filter((c) => c.n === 'ProductUserID').length >= 4);
  assert.match(def.c.find((c) => c.n === 'TextToMachine').t, /Viken Skog[\s\S]*Pass på <bekk> & stier[\s\S]*Kulturminne/);
  assert.match(fil('.oin'), /Pass på &lt;bekk&gt; &amp; stier/);
  // ogi: kartlag med shapefiler som finnes i filsettet, varsel og sporlag.
  const lag = [...fil('.ogi').matchAll(/<GISFileName>([^<]+)<\/GISFileName>/g)].map((m) => m[1]);
  assert.ok(lag.length >= 5); for (const l of lag) for (const e of ['shp', 'shx', 'dbf', 'prj']) assert.ok(navn.includes(l.replace(/shp$/, e)), l);
  assert.match(fil('.ogi'), /<TrackingFile>true<\/TrackingFile>/); assert.match(fil('.ogi'), /<ColumnNameWarningDistance>VARSELAVST<\/ColumnNameWarningDistance>/);
  const hensyn = MD.lesShapefile(fil('_hensyn.shp'), fil('_hensyn.dbf'), fil('_hensyn.prj'));
  assert.equal(hensyn.find((h) => h.egenskaper.TYPE === 'kulturminne').egenskaper.VARSELAVST, 5);
  const best = MD.lesShapefile(fil('_bestand.shp'), fil('_bestand.dbf'), fil('_bestand.prj'));
  assert.equal(best.length, 2); assert.ok(Math.abs(arealM2(best[0].geometri) - arealM2(kand.find((b) => b.id === best[0].egenskaper.DELOBJEKT).geometri)) < 50);
  assert.equal(MD.lesShapefile(fil('_velteplass.shp'), fil('_velteplass.dbf')).length, 1);
  // UTM: koordinater i meter, .prj med sone.
  const utm = SF.lagFilsett(S, hogst, { versjon: '3.3', koordsys: 'EPSG:25833' });
  const uf = (e) => utm.filer.find((f) => f.navn.endsWith(e)).data;
  assert.match(new TextDecoder().decode(uf('_bestand.prj')), /UTM_Zone_33N/); assert.ok(new DataView(uf('_bestand.shp').buffer).getFloat64(36, true) > 100000);
  assert.doesNotMatch(uf('.oin'), /countryCodeCategory/); // 3.3 har ikke attributtet
  // pin og fdi: sortiment per treslag, prismatrise og leveranse per sortiment med kjøper.
  assert.match(fil('.pin'), /<ProductName>Gran sagtømmer<\/ProductName>[\s\S]*<ProductMatrixItem diameterClassLowerLimit="130" lengthClassLowerLimit="370">/);
  assert.match(fil('.fdi'), /<DeliveryUserID agency="ForestOwner">LEV_GRAN_SAG<\/DeliveryUserID>[\s\S]*<DeliveryDestination>Viken Skog<\/DeliveryDestination>/);
  assert.match(fil('.foi'), /<LocationName>Velteplass ved bommen<\/LocationName>/);
  // env: ogi og kartfilene innebygd – kan pakkes ut igjen.
  const ut = await SF.lesProduksjonsfiler(tekstFiler([...SF.simulerDrift(S, hogst, { maksStammer: 50 }), { navn: 'kart.env', data: fil('_kart.env') }]));
  assert.ok(ut.filer.some((f) => f.endsWith('.ogi')) && ut.filer.filter((f) => f.endsWith('.shp')).length >= 5);
  // ZIP med mappe.
  const zip = await MD.lesZip(SF.zipAv(fs)); assert.equal(zip.length, fs.filer.length); assert.ok(zip.every((z) => z.navn.startsWith(`${fs.mappe}/`)));
  assert.throws(() => SF.lagFilsett(S, { ...hogst, linjer: [] }), /ingen bestand/);
});

test('StanForD 2010: produksjonsfiler tilbake – ajourføring av oppdrag, bestand og kart', async () => {
  const { S, kand, hogst, tynning } = stanfordPlan();
  const sim = tekstFiler(SF.simulerDrift(S, hogst, { naa: new Date('2026-11-02T12:00:00') }));
  const data = await SF.lesProduksjonsfiler(sim);
  assert.deepEqual(data.meldinger.map((m) => m.type).sort(), ['fpr', 'hpr']);
  const res = SF.beregnResultat(S, hogst, data);
  assert.equal(res.bestand.length, 2); assert.equal(res.utenfor, 0);
  assert.ok(res.m3 > 1000 && res.stammer > 2000, `${res.m3} ${res.stammer}`);
  assert.ok(res.sortiment.sagtommer > 0 && res.sortiment.massevirke > 0 && res.treslag.G > res.treslag.F);
  assert.ok(res.bestand.every((b) => b.dekning > 0.6 && b.fra === '2026-10-31' || b.fra === '2026-11-01'));
  assert.ok(Math.abs(res.lassbaerer.m3 - res.m3) < 1);
  const liste = SF.ajourfor(S, hogst, res, data, { importId: SF.importNokkel(sim), naa: new Date('2026-11-02T12:00:00') });
  assert.equal(liste.length, 2);
  for (const b of kand.slice(0, 2)) { assert.equal(b.alder, 0); assert.equal(b.volumDaa, 0); assert.equal(b.tiltak[0].status, 'utfort'); assert.ok(b.tiltak[0].utfortM3 > 100); assert.equal(b.hogsthistorikk.length, 1); }
  assert.equal(hogst.status, 'utfort'); assert.ok(hogst.utfortDato);
  const gj = SF.kartGeojson(hogst);
  assert.ok(gj.features.some((f) => f.properties.lag === 'hogd' && f.geometry.type === 'MultiPolygon'));
  assert.ok(gj.features.filter((f) => f.properties.lag === 'stamme').length > 1000 && gj.features.some((f) => f.properties.lag === 'velteplass'));
  // Samme filer igjen: ingen dobbel ajourføring.
  SF.ajourfor(S, hogst, SF.beregnResultat(S, hogst, await SF.lesProduksjonsfiler(sim)), data, { importId: SF.importNokkel(sim) });
  assert.equal(hogst.stanford.importer.length, 1); assert.equal(kand[0].hogsthistorikk.length, 1);

  // Tynning: volum og treantall reduseres med uttaket; ny fil senere trekker bare fra endringen.
  const b3 = kand[2]; const for_ = b3.volumDaa;
  const d1 = await SF.lesProduksjonsfiler(tekstFiler(SF.simulerDrift(S, tynning, { andel: 0.5, seed: 3 })));
  const r1 = SF.beregnResultat(S, tynning, d1); SF.ajourfor(S, tynning, r1, d1);
  const etter1 = b3.volumDaa; assert.ok(etter1 < for_ && Math.abs(etter1 - (for_ - r1.m3 / b3.areal)) < 0.2, `${for_} ${etter1}`);
  assert.ok(b3.treantall < 120);
  const d2 = await SF.lesProduksjonsfiler(tekstFiler(SF.simulerDrift(S, tynning, { andel: 1, seed: 3 })));
  const r2 = SF.beregnResultat(S, tynning, d2); const e2 = SF.endringer(S, tynning, r2);
  assert.ok(Math.abs(e2[0].delta - (r2.m3 - r1.m3)) < 0.2); SF.ajourfor(S, tynning, r2, d2);
  assert.ok(Math.abs(b3.volumDaa - Math.max(0, for_ - r2.m3 / b3.areal)) < 0.3, `${b3.volumDaa}`);
  assert.equal(tynning.status, 'utfort');
});

test('StanForD 2010: lesing av hpr fra maskin (Komatsu-format), hprz, thp, mom, fpr og ogr', async () => {
  const { S, kand, hogst } = stanfordPlan();
  const [lon, lat] = (() => { const g = kand[0].geometri; const r = (g.type === 'Polygon' ? g.coordinates : g.coordinates[0])[0]; const c = r.reduce((a, p) => [a[0] + p[0] / r.length, a[1] + p[1] / r.length], [0, 0]); return MD.iGeometri(c, g) ? c : r[0]; })();
  // Utdrag med samme oppbygging som en hpr fra Komatsu MaxiXT (navnerom-prefiks, ukjent delobjekt, flere volumkategorier).
  const hpr = `<?xml version="1.0" encoding="utf-8"?><sf:HarvestedProduction xmlns:sf="urn:skogforsk:stanford2010" messageType="hpr" version="3.3" versionDate="2017-02-06" areaUnit="ha" diameterUnit="mm" lengthUnit="cm" volumeUnit="m3" weightUnit="kg">
    <sf:Machine machineCategory="Harvester"><sf:MachineKey>637151882044030000</sf:MachineKey><sf:MachineUserID>9013061272</sf:MachineUserID><sf:MachineBaseManufacturer>Komatsu Forest</sf:MachineBaseManufacturer><sf:MachineBaseModel>901XC-6</sf:MachineBaseModel>
    <sf:SpeciesGroupDefinition><sf:SpeciesGroupUserID agency="Seller">NO1_GRAN</sf:SpeciesGroupUserID><sf:SpeciesGroupName>GRAN</sf:SpeciesGroupName><sf:Extension><x>1</x></sf:Extension><sf:SpeciesGroupKey>446</sf:SpeciesGroupKey></sf:SpeciesGroupDefinition>
    <sf:ProductDefinition><sf:ProductKey>8015</sf:ProductKey><sf:ClassifiedProductDefinition><sf:ProductName>197 Massevirke</sf:ProductName><sf:ProductGroupName>Massevirke</sf:ProductGroupName><sf:ProductMatrixes><sf:ProductMatrixItem/></sf:ProductMatrixes></sf:ClassifiedProductDefinition></sf:ProductDefinition>
    <sf:ProductDefinition><sf:ProductKey>8019</sf:ProductKey><sf:ClassifiedProductDefinition><sf:ProductName>140 SCA Sagtømmer</sf:ProductName><sf:ProductGroupName>Tømmer</sf:ProductGroupName></sf:ClassifiedProductDefinition></sf:ProductDefinition>
    <sf:ObjectDefinition><sf:ObjectUserID agency="LoggingOrganisation">61221</sf:ObjectUserID><sf:ObjectName>Kjøpers objekt</sf:ObjectName><sf:ObjectKey>91</sf:ObjectKey><sf:SubObject><sf:SubObjectUserID agency="Other">abc</sf:SubObjectUserID><sf:SubObjectName>Sluttavvirkning</sf:SubObjectName><sf:SubObjectKey>184</sf:SubObjectKey></sf:SubObject></sf:ObjectDefinition>
    ${[0, 1, 2].map((i) => `<sf:Stem><sf:StemKey>${337463 + i}</sf:StemKey><sf:ObjectKey>91</sf:ObjectKey><sf:SubObjectKey>184</sf:SubObjectKey><sf:SpeciesGroupKey>446</sf:SpeciesGroupKey><sf:HarvestDate>2026-10-1${i}T08:00:00+02:00</sf:HarvestDate>
      <sf:StemCoordinates receiverPosition="Base machine position" coordinateReferenceSystem="WGS84"><sf:Latitude latitudeCategory="North">${lat + 0.01}</sf:Latitude><sf:Longitude longitudeCategory="East">${lon}</sf:Longitude><sf:Altitude>537</sf:Altitude></sf:StemCoordinates>
      <sf:StemCoordinates receiverPosition="Crane tip position when felling the tree" coordinateReferenceSystem="WGS84"><sf:Latitude latitudeCategory="North">${lat}</sf:Latitude><sf:Longitude longitudeCategory="East">${lon}</sf:Longitude><sf:Altitude>537</sf:Altitude></sf:StemCoordinates>
      <sf:Extension><sf:Extension>nested</sf:Extension></sf:Extension>
      <sf:SingleTreeProcessedStem><sf:DBH>456</sf:DBH><sf:StemDiameters><sf:DiameterValue diameterPosition="0">559</sf:DiameterValue></sf:StemDiameters>
        <sf:Log><sf:LogKey>1</sf:LogKey><sf:ProductKey>8019</sf:ProductKey><sf:LogVolume logVolumeCategory="m3 (price)" logMeasurementCategory="Machine">0.4589</sf:LogVolume><sf:LogVolume logVolumeCategory="m3sob" logMeasurementCategory="Machine">0.5095</sf:LogVolume><sf:LogVolume logVolumeCategory="m3sub" logMeasurementCategory="Machine">0.4500</sf:LogVolume></sf:Log>
        <sf:Log><sf:LogKey>2</sf:LogKey><sf:ProductKey>8015</sf:ProductKey><sf:LogVolume logVolumeCategory="m3sub" logMeasurementCategory="Machine">0.1000</sf:LogVolume></sf:Log>
      </sf:SingleTreeProcessedStem></sf:Stem>`).join('')}
    </sf:Machine></sf:HarvestedProduction>`;
  const mom = `<OperationalMonitoring xmlns="urn:skogforsk:stanford2010" messageType="mom" version="3.3"><Machine machineCategory="Harvester"><MachineBaseManufacturer>Komatsu Forest</MachineBaseManufacturer><ObjectDefinition><ObjectUserID>61221</ObjectUserID><ObjectKey>91</ObjectKey></ObjectDefinition>
    <CombinedMachineWorkTime><ObjectKey>91</ObjectKey><CombinedMachineRunTime><MachineRunTimeCategory>Processing</MachineRunTimeCategory><TimeLength>5400</TimeLength></CombinedMachineRunTime><CombinedMachineRunTime><MachineRunTimeCategory>Terrain travel</MachineRunTimeCategory><TimeLength>1800</TimeLength></CombinedMachineRunTime><OtherMachineData><FuelConsumption>31</FuelConsumption></OtherMachineData></CombinedMachineWorkTime></Machine></OperationalMonitoring>`;
  const thp = `<TotalHarvestedProduction xmlns="urn:skogforsk:stanford2010" messageType="thp" version="3.6"><Machine machineCategory="Harvester"><SpeciesGroupDefinition><SpeciesGroupName>Furu</SpeciesGroupName><SpeciesGroupKey>2</SpeciesGroupKey></SpeciesGroupDefinition><ProductDefinition><ProductKey>5</ProductKey><ClassifiedProductDefinition><ProductName>Furu sag</ProductName></ClassifiedProductDefinition></ProductDefinition>
    <ObjectDefinition><ObjectUserID>SkogIQ-O-2026-01</ObjectUserID><ObjectKey>1</ObjectKey><SubObject><SubObjectUserID>${kand[1].id}</SubObjectUserID><SubObjectKey>7</SubObjectKey></SubObject></ObjectDefinition>
    <Total><ObjectKey>1</ObjectKey><SubObjectKey>7</SubObjectKey><SpeciesGroupKey>2</SpeciesGroupKey><TotalNumberOfStems>40</TotalNumberOfStems><TotalStemVolume totalStemVolumeCategory="m3sub">22.5</TotalStemVolume><TotalLogs><ProductKey>5</ProductKey><TotalProductNumberOfLogs>80</TotalProductNumberOfLogs><TotalProductVolume totalProductVolumeCategory="m3sub">22.5</TotalProductVolume></TotalLogs></Total></Machine></TotalHarvestedProduction>`;
  const gz = new Uint8Array(zlib.gzipSync(Buffer.from(hpr)));
  const data = await SF.lesProduksjonsfiler([{ navn: 'K901.hprz', data: gz }, { navn: 'K901.mom', data: new TextEncoder().encode(mom) }]);
  const h = data.meldinger.find((m) => m.type === 'hpr');
  assert.equal(h.stammer.length, 3); assert.equal(h.maskiner[0].produsent, 'Komatsu Forest');
  const s0 = h.stammer[0]; assert.equal(s0.treslag, 'G'); assert.deepEqual(s0.pos, [lon, lat]); assert.equal(s0.fub, 0.55); assert.equal(s0.dato, '2026-10-10');
  assert.deepEqual(s0.stokker.map((l) => l.sortiment), ['sagtommer', 'massevirke']);
  const res = SF.beregnResultat(S, hogst, data);
  assert.equal(res.bestand.length, 1); assert.equal(res.bestand[0].bestandId, kand[0].id); assert.equal(res.stammer, 3);
  assert.deepEqual(res.andreObjekter, ['61221']); assert.equal(res.m3, 1.7); assert.equal(res.sortiment.sagtommer, 1.4);
  assert.deepEqual(res.drift, { timer: 2, drivstoff: 31 });
  // Bare thp (ingen posisjoner): summer per delobjekt.
  const d2 = await SF.lesProduksjonsfiler([{ navn: 'a.thp', data: new TextEncoder().encode(thp) }]);
  const r2 = SF.beregnResultat(S, hogst, d2); assert.equal(r2.bestand[0].bestandId, kand[1].id); assert.equal(r2.bestand[0].m3, 22.5); assert.equal(r2.treslag.F, 22.5); assert.equal(r2.bestand[0].dekning, null);
  // ogr med kjørespor og et nytt objekt registrert av føreren.
  const spor = MD.lagShapefile([{ geometri: { type: 'LineString', coordinates: [[lon, lat], [lon + 0.001, lat]] }, egenskaper: {} }], [{ navn: 'ID', type: 'C', lengde: 4 }], 'linje');
  const ny = MD.lagShapefile([{ geometri: { type: 'Point', coordinates: [lon, lat] }, egenskaper: { TYPE: 'kulturminne', ID: 'n1', BESKR: 'Steingard' } }, { geometri: { type: 'Point', coordinates: [lon, lat] }, egenskaper: { TYPE: 'livslopstre', ID: 'll1', BESKR: 'Kjent' } }], [{ navn: 'TYPE', type: 'C', lengde: 16 }, { navn: 'ID', type: 'C', lengde: 8 }, { navn: 'BESKR', type: 'C', lengde: 20 }], 'punkt');
  const ogr = `<ObjectGeographicalReport xmlns="urn:skogforsk:stanford2010" messageType="ogr"><GISLayer><GISFileName>spor.shp</GISFileName><TrackingFile>true</TrackingFile></GISLayer><GISLayer><GISFileName>hensynpkt.shp</GISFileName><GISFileModified>true</GISFileModified></GISLayer></ObjectGeographicalReport>`;
  const pakke = MD.lagZip([{ navn: 'x.ogr', data: ogr }, { navn: 'spor.shp', data: spor.shp }, { navn: 'spor.dbf', data: spor.dbf }, { navn: 'hensynpkt.shp', data: ny.shp }, { navn: 'hensynpkt.dbf', data: ny.dbf }, { navn: 'K901.hpr', data: hpr }]);
  const d3 = await SF.lesProduksjonsfiler([{ navn: 'maskin.zip', data: pakke }]);
  assert.equal(d3.spor.length, 1); const nye = SF.nyeHensyn(S, d3); assert.equal(nye.length, 1); assert.equal(nye[0].type, 'kulturminne');
  const r3 = SF.beregnResultat(S, hogst, d3); SF.ajourfor(S, hogst, r3, d3);
  assert.equal(SF.kartGeojson(hogst).features.filter((f) => f.properties.lag === 'spor').length, 1);
  assert.equal(hogst.status, 'pagar'); // bare ett av to bestand har stammer
  await assert.rejects(() => SF.lesProduksjonsfiler([{ navn: 'tom.txt', data: new TextEncoder().encode('hei') }]), /Fant ingen produksjonsfiler/);
});

test('Plan fra gnr/bnr: lang, smal eiendom – WMS-bildet holdes under NIBIOs grense, og feilsvar blir ikke «0 flater»', async () => {
  let T = null; let pc = null;
  try { T = await import('@turf/turf'); pc = (await import('polygon-clipping')).default; } catch { return; /* valgfritt i testmiljøet */ }
  // Som Øvre Eiker 2/1: ca. 2 × 6 km. Før ga fast bredde 2000 px en høyde på over 5000 px, og NIBIO svarte med feil.
  const g = (x, y) => utmTilGeo(216000 + x, 6628000 + y, 33);
  const teig = { type: 'Polygon', coordinates: [[g(0, 0), g(1800, 0), g(1800, 5600), g(0, 5600), g(0, 0)]] };
  const storrelser = [];
  const mock = (sr16Feil) => async (url) => {
    const u = new URL(url); const q = u.searchParams; const svar = (tekst) => ({ ok: true, status: 200, text: async () => tekst, json: async () => JSON.parse(tekst), arrayBuffer: async () => new ArrayBuffer(0) });
    if (u.host === 'api.kartverket.no') return svar(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: teig, properties: {} }] }));
    const unntak = (m) => svar(`<?xml version='1.0'?><ServiceExceptionReport version="1.1.1"><ServiceException>${m}</ServiceException></ServiceExceptionReport>`);
    if (q.get('REQUEST') === 'GetMap' && q.get('FORMAT') === 'kml') {
      const w = Number(q.get('WIDTH')); const h = Number(q.get('HEIGHT')); storrelser.push(Math.max(w, h));
      if (w > 4096 || h > 4096) return unntak('msWMSLoadGetMapParams(): WMS server error. Image size out of range, WIDTH and HEIGHT must be between 1 and 4096 pixels.');
      if (sr16Feil && u.pathname.endsWith('/sr16')) return unntak('Intern feil');
      return svar('<kml><Document></Document></kml>');
    }
    return svar('');
  };
  const k = { nr: '3314', navn: 'Øvre Eiker' };
  await genererPlan({ kommune: k, gnr: 2, bnr: 1 }, { turf: T, klipping: pc, hent: mock(false), iAar: 2026 }).catch(() => null);
  assert.ok(storrelser.length >= 3 && Math.max(...storrelser) <= 2000, `bildestørrelser ${storrelser}`);
  await assert.rejects(() => genererPlan({ kommune: k, gnr: 2, bnr: 1 }, { turf: T, klipping: pc, hent: mock(true), iAar: 2026 }), /NIBIO \(sr16\) svarte med feil: Intern feil/);
});

test('Hogstmaskindata mot SR16: HPR for planen, SR16-flater, diametergrense, hogst registrert av NIBIO, bestand og CSV', async () => {
  // To bestand side om side (200 × 200 m hver) og to SR16-flater som dekker hvert sitt bestand.
  const g = (x, y) => utmTilGeo(250000 + x, 6650000 + y, 33);
  const rekt = (x0, x1, y0, y1) => ({ type: 'Polygon', coordinates: [[g(x0, y0), g(x1, y0), g(x1, y1), g(x0, y1), g(x0, y0)]] });
  const S = { bestand: [{ id: 'bA', nr: '1', treslag: 'G', bonitet: 14, areal: 40, treantall: 80, geometri: rekt(0, 200, 0, 200) }, { id: 'bB', nr: '2', treslag: 'G', bonitet: 11, areal: 40, treantall: 60, geometri: rekt(200, 400, 0, 200) }] };
  // Stammer: hogst av den vestlige halvdelen i begge bestandene (100 × 200 m = 20 daa hver), 1 stamme per 12,5 m².
  let k = 0; const stammer = [];
  for (let x = 2.5; x < 100; x += 5) for (let y = 2.5; y < 200; y += 5) for (const ox of [0, 200]) for (const dy of [0, 2]) {
    const dbh = (++k % 10 === 0) ? 70 : 180; // 10 % under 8 cm
    stammer.push({ k: `m:${k}`, pos: g(ox + x, y + dy), dbh, fub: 0.3, treslag: 'G', dato: '2026-09-01', stokker: [] });
  }
  stammer.push({ k: 'utenfor', pos: g(-500, -500), dbh: 200, fub: 0.5, treslag: 'F', dato: '2026-09-02', stokker: [] });
  // SR16: flate 1 med 800 trær/ha ≥ 10 cm (= 1600 på 20 daa), flate 2 der NIBIO har registrert hogsten i 2026.
  const kmlPm = (id, r) => `<Placemark><name>SRVTRESLAG.${id}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${r.coordinates[0].map((p) => p.join(',')).join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
  const gmlF = (gid, a) => `<SRVTRESLAG_feature><gid>${gid}</gid>${Object.entries(a).map(([k2, v]) => `<${k2}>${v}</${k2}>`).join('')}</SRVTRESLAG_feature>`;
  const attrA = { srtrean: 1200, srtrean_ge8: 900, srtrean_ge10: 800, srtrean_ge16: 500, srvolub: 250, srdiam_ge8: 19, srhoydem: 180, srbonitet: 14, gran_prosent: 90, furu_prosent: 5, lauv_prosent: 5, treslag_txt: 'grandominert', d3faar: 2022, hogst: '', areal_da: 40 };
  const urls = [];
  const hent = async (url) => { urls.push(url); const q = new URL(url).searchParams; const ok = (t) => ({ ok: true, status: 200, text: async () => t });
    if (q.get('REQUEST') === 'GetMap') return ok(`<kml><Document>${kmlPm(11, rekt(-5, 200, -5, 205))}${kmlPm(22, rekt(200, 405, -5, 205))}</Document></kml>`);
    return ok(`<msGMLOutput>${gmlF(11, attrA)}${gmlF(22, { ...attrA, srtrean_ge10: 0, hogst: 2026 })}</msGMLOutput>`); };
  const flater = await HS.hentSr16(HS.boksFor(stammer.filter((s) => s.pos)), { hent });
  assert.equal(flater.length, 2); assert.equal(flater[0].trean[10], 800); assert.equal(flater[1].hogst, 2026);
  assert.ok(urls.every((u) => { const q = new URL(u).searchParams; return Math.max(Number(q.get('WIDTH')), Number(q.get('HEIGHT'))) <= 2000; }));
  const res = HS.sammenlign(S, stammer, flater);
  const t = res.total;
  assert.equal(t.stammer, stammer.length); assert.ok(Math.abs(t.hogdDaa - 40.1) < 0.3, `${t.hogdDaa}`);
  // Bare flate 1 er sammenlignbar: 20 daa, 1600 hogde stammer, 90 % over 8 cm.
  assert.ok(Math.abs(t.smlDaa - 20) < 0.3, `${t.smlDaa}`);
  assert.equal(t.stammerTerskel[10], 1440); assert.equal(t.stammerTerskel[5], 1600);
  assert.ok(Math.abs(t.sr16[10] - 1600) < 30, `${t.sr16[10]}`);
  assert.ok(Math.abs(HS.andel(t, 10) - 0.9) < 0.02); assert.equal(HS.vurdering(t, 10).niva, 'ok');
  assert.equal(t.ruterEtterHogst > 0, true); assert.equal(res.utenforPlan, 1); assert.equal(t.ruterUtenSr16, 1);
  const fB = res.flater.find((f) => f.id === '22'); assert.match(fB.varsel.join(), /registrert hogsten \(2026\)/); assert.equal(HS.andel(fB, 10), null);
  assert.match(HS.vurdering(fB, 10).tekst, /oppdatert etter hogsten/);
  // Per bestand: planens treantall (per daa) på hogd areal sammenlignes med alle hogde stammer.
  const bB = res.bestand.find((b) => b.nr === '2'); assert.ok(Math.abs(bB.plan - 1200) < 20, `${bB.plan}`); assert.equal(bB.planStammer, 1600);
  assert.equal(res.bestand.length, 2); assert.ok(res.bestand[0].dbhSnitt > 16);
  // Diametergrense 16 cm og 5 cm.
  assert.equal(HS.vurdering(t, 16).niva, 'hoy'); // 1440 hogd mot 1000 i SR16
  // Kart og CSV.
  const gj = HS.kartGeojson(res, 10); assert.ok(gj.features.some((f) => f.properties.lag === 'hogd' && f.properties.niva === 'ok') && gj.features.some((f) => f.properties.niva === 'ukjent'));
  assert.match(HS.csv(res, 'bestand'), /"Bestand";"Treslag"[\s\S]*"1";"G";40;80;20;20;1600;1440;1600;90;/);
  assert.match(HS.csv(res, 'flater'), /"22";"grandominert";2022;2026;/);
  // Tynning: få stammer gir «uttak».
  const tynn = HS.sammenlign(S, stammer.filter((s, i) => i % 8 === 0), flater); assert.equal(HS.vurdering(tynn.total, 10).niva, 'uttak');
  // Fil uten hpr.
  await assert.rejects(() => HS.lesStammer([{ navn: 'a.thp', data: new TextEncoder().encode('<TotalHarvestedProduction xmlns="urn:skogforsk:stanford2010" messageType="thp"/>') }]), /thp/);
});

test('Tynning med HPR mot SR16: grunnflate før/etter, kvotient, diameterklasser, stikkveier fra maskinposisjon og krav', () => {
  const g = (x, y) => utmTilGeo(250000 + x, 6650000 + y, 33);
  const rekt = (x0, x1, y0, y1) => ({ type: 'Polygon', coordinates: [[g(x0, y0), g(x1, y0), g(x1, y1), g(x0, y1), g(x0, y0)]] });
  const b = { id: 'b1', nr: '7', treslag: 'G', bonitet: 14, areal: 40, treantall: 140, geometri: rekt(0, 200, 0, 200), tiltak: [{ type: 'tynning', status: 'planlagt' }] };
  const st = HS.simulerTynning(b, { dato: '2026-09-01' });
  assert.ok(st.length > 1500 && st.every((s) => s.basePos && s.dbh));
  const gHa = 1400 * (Math.PI / 4) * (0.17 ** 2 + 0.055 ** 2); // samme skog som simuleringen
  const fl = [HS.sr16Flate('1', rekt(-50, 250, -50, 250), { srtrean: 1400, srtrean_ge8: 1330, srtrean_ge10: 1250, srtrean_ge16: 780, srvolub: 180, srgrflate: gHa.toFixed(1), srhoydeo: 165, srbonitet: 14, gran_prosent: 80, furu_prosent: 8, lauv_prosent: 12, treslag_txt: 'grandominert', d3faar: 2023 })];
  const res = HS.sammenlign({ bestand: [b] }, st, fl);
  assert.ok(HS.erTynning(res, { bestand: [b] }));
  assert.ok(res.harBasePos && res.kran > 2 && res.kran < 10 && res.kart.stikkveier.length >= 8);
  const k = HS.tynning(res.total, { treslag: 'G' });
  assert.ok(Math.abs(k.uttakG - 0.3) < 0.03, `uttak ${k.uttakG}`); // simulert ca. 30 % av grunnflaten
  assert.ok(Math.abs(k.gFor - gHa) < 0.2 && Math.abs(k.gEtter - (k.gFor - k.gUttak)) < 0.11);
  assert.ok(k.kvotient > 0.7 && k.kvotient < 1, `kvotient ${k.kvotient}`); // nedenfra
  assert.ok(k.klasser[0].andel > k.klasser[3].andel, 'mer av de små trærne tatt');
  assert.ok(Math.abs(k.avstand - 22) < 3, `stikkveiavstand ${k.avstand}`); // simulert hver 22. m
  assert.ok(k.stikkveiAndel > 0.15 && k.stikkveiAndel < 0.22);
  const krit = Object.fromEntries(k.kriterier.map((c) => [c.id, c]));
  assert.equal(krit.uttak.ok, true); assert.equal(krit.form.ok, true); assert.equal(krit.stikkvei.ok, true); assert.equal(krit.tidspunkt.ok, true);
  assert.equal(krit.grunnflate.ok, false); assert.match(krit.grunnflate.krav, /26 m²\/ha/); // bonitet 14 ved 16,5 m: 26 m²/ha
  // Tette stikkveier (11 m) og kraftig uttak gir avvik.
  const tett = HS.sammenlign({ bestand: [b] }, HS.simulerTynning(b, { avstand: 11, uttak: 0.45 }), fl);
  const k2 = HS.tynning(tett.total); const kr2 = Object.fromEntries(k2.kriterier.map((c) => [c.id, c]));
  assert.equal(kr2.stikkvei.ok, false); assert.equal(kr2.uttak.ok, false);
  // GPS-flakking når maskinen står stille teller ikke som kjøring.
  const stille = Array.from({ length: 40 }, (_, i) => ({ basePos: g(100 + (i % 2) * 1.5, 100 + (i % 3)), pos: g(105, 100) }));
  assert.equal(HS.stikkveier(stille).lengde, 0);
  assert.equal(HS.grunnflateGrense(11), 24); assert.equal(HS.grunnflateGrense(17), 28);
});

test('Virtuell skog: minikart med posisjon, blikkretning, gangretning, spor og bestand', () => {
  // Kompass og retning (x = øst, y = nord)
  assert.equal(MK.retningGrader(0, 1), 0); assert.equal(MK.retningGrader(1, 0), 90); assert.equal(MK.retningGrader(0, -1), 180); assert.equal(MK.retningGrader(-1, 0), 270);
  assert.equal(MK.kompassTekst(44), 'NØ 44°'); assert.equal(MK.kompassTekst(359.6), 'N 0°'); assert.equal(MK.kompassTekst(225), 'SV 225°');
  assert.equal(MK.malestokk(80), 50); assert.equal(MK.malestokk(40), 20);
  // Projeksjon: nord opp – punkt 10 m nord havner rett over midten; blikket opp – det du ser mot havner over midten.
  const P = MK.projeksjon({ x: 0, y: 0, radius: 50, storrelse: 200 });
  assert.deepEqual(P([0, 10]).map(Math.round), [100, 80]); assert.deepEqual(P([10, 0]).map(Math.round), [120, 100]);
  const Q = MK.projeksjon({ x: 0, y: 0, radius: 50, storrelse: 200, retning: 90, nordOpp: false });
  assert.deepEqual(Q([10, 0]).map(Math.round), [100, 80]); // øst er opp når du ser mot øst
  // Spor og gangretning: står stille → ingen retning; går nordøstover → ca. 45°.
  const sp = MK.lagSpor();
  for (let i = 0; i < 5; i++) sp.legg(0.2 * (i % 2), 0.1 * (i % 2)); assert.equal(sp.bevegelse(0.2, 0.1), null); assert.equal(sp.punkter.length, 1);
  for (let i = 1; i <= 10; i++) sp.legg(i, i); assert.ok(Math.abs(sp.bevegelse(10, 10) - 45) < 1);
  // Tegning på et falskt lerret: synlige bestand og veier, uthevet bestand og målestokk.
  const kall = []; const ctx = new Proxy({}, { get: (_, k) => (k in ctx2 ? ctx2[k] : (...a) => kall.push([k, ...a])), set: (_, k, v) => { ctx2[k] = v; kall.push(['=' + String(k), v]); return true; } }); const ctx2 = {};
  const rekt = (x0, x1, y0, y1) => [[[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]];
  const mk = MK.lagMinikart({ bestand: [{ id: 'a', nr: '12', mp: rekt(-40, 0, -40, 40) }, { id: 'b', nr: '13', mp: rekt(0, 40, -40, 40) }, { id: 'c', nr: '99', mp: rekt(900, 950, 900, 950) }], veier: [{ linje: [[-50, 5], [50, 5]], flate: 'sti' }], bekker: [{ linje: [[0, -50], [0, 50]] }] });
  const syn = mk.tegn(ctx, { x: -10, y: 0, retning: 30, bevegelse: 30, spor: sp.punkter, herBid: 'a', radius: 80, storrelse: 384 });
  assert.deepEqual(syn.bestand, ['12', '13']); assert.equal(syn.veier, 1);
  assert.ok(kall.some((k) => k[0] === 'fillText' && k[1] === '12') && kall.some((k) => k[0] === 'fillText' && k[1] === '50 m') && kall.some((k) => k[0] === 'fillText' && k[1] === 'N'));
  assert.ok(kall.some((k) => k[0] === '=strokeStyle' && k[1] === '#c25e10'), 'bestandet du står i er uthevet');
});

test('Bratthet: helning fra høydedata, klasser for drivbarhet, flater, andel per bestand og minikart', async () => {
  // Klasser og grader
  assert.equal(BR.klasseFor(20).id, 'lett'); assert.equal(BR.klasseFor(33).id, 'bratt'); assert.equal(BR.klasseFor(49.9).id, 'bratt');
  assert.equal(BR.klasseFor(50).id, 'svart'); assert.equal(BR.klasseFor(80).id, 'vinsj'); assert.equal(BR.klasseFor(120).id, 'taubane');
  assert.equal(BR.klasseFor(50).drivbar, false); assert.equal(BR.klasseFor(40).drivbar, true);
  assert.equal(Math.round(BR.grader(100)), 45); assert.equal(Math.round(BR.grader(33)), 18);
  assert.match(BR.tekst(62), /62 % \(32°\) – spesialdrift · bratt nok for snøskred/);
  // Helning i et rutenett: plan med 60 % stigning mot nord (z = 0,6·y), 10 m mellom punktene
  const nx = 6; const ny = 5; const z = []; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) z.push(0.6 * j * 10);
  const h = BR.helning(z, nx, ny, 10); assert.ok(h.every((v) => Math.abs(v - 60) < 1e-9));
  const h2 = BR.helning(z.map((v, k) => (k === 7 ? NaN : v)), nx, ny, 10); assert.equal(h2[8], null); // manglende nabo
  // Rutenett og henting: et område 200 × 100 m der vestre halvdel er flat og østre halvdel er bratt (70 %)
  const g = (x, y) => utmTilGeo(300000 + x, 6700000 + y, 33);
  const rekt = (x0, x1, y0, y1) => ({ type: 'Polygon', coordinates: [[g(x0, y0), g(x1, y0), g(x1, y1), g(x0, y1), g(x0, y0)]] });
  const omr = rekt(0, 200, 0, 100);
  const nett = BR.rutenett(omr, { maksPunkter: 6000, kant: 0 }); assert.equal(nett.d, 10); assert.ok(nett.punkter.length <= 6000);
  assert.ok(BR.rutenett(rekt(0, 5000, 0, 5000)).d > 80); // store eiendommer får grovere nett
  const hoyde = ([lon, lat]) => { const [x] = geoTilUtm(lon, lat, 33); const lx = x - 300000; return lx < 100 ? 0 : 0.7 * (lx - 100); };
  let kall = 0; const br = await BR.hentBratthet(omr, { hentHoyder: async (pts) => { kall++; return pts.map(hoyde); } });
  assert.equal(kall, 1); assert.equal(br.d, 10);
  const fl = BR.flater(br); assert.ok(fl.svart && !fl.taubane, Object.keys(fl).join());
  // Bestandene: vest (flatt) og øst (bratt)
  const vest = BR.statistikk(br, rekt(10, 80, 10, 90), punktIGeometri); const ost = BR.statistikk(br, rekt(120, 190, 10, 90), punktIGeometri);
  assert.equal(vest.ikkeDrivbar, 0); assert.equal(BR.vurdering(vest).niva, 'lett');
  assert.equal(ost.ikkeDrivbar, 1); assert.equal(BR.vurdering(ost).niva, 'svart'); assert.match(BR.vurdering(ost).tekst, /100 % av arealet er brattere enn 50 %/);
  await assert.rejects(() => BR.hentBratthet(omr, { hentHoyder: async (pts) => pts.map(() => null) }), /høydedata/);
  // Minikartet tegner bratte ruter
  const kall2 = []; const ctx = new Proxy({}, { get: (_, k) => (k in c2 ? c2[k] : (...a) => kall2.push([k, ...a])), set: (_, k, v) => { c2[k] = v; kall2.push(['=' + String(k), v]); return true; } }); const c2 = {};
  const pst = []; for (let j = 0; j < 11; j++) for (let i = 0; i < 11; i++) pst.push(i < 5 ? 10 : 65);
  const mk = MK.lagMinikart({ bratthet: { x0: -50, y0: -50, d: 10, nx: 11, ny: 11, pst }, farge: (p) => BR.klasseFor(p)?.farge });
  const syn = mk.tegn(ctx, { x: 0, y: 0, radius: 80, storrelse: 256 });
  assert.equal(syn.bratt, 66); assert.ok(kall2.some((k) => k[0] === '=fillStyle' && k[1] === '#ef8a2c'));
});

test('Markfuktighet: NIBIO-fargene til rutenett, klasse i punkt, andel per bestand, vurdering og minikart', async () => {
  // Syntetisk WMS-bilde 100 × 100 px over 200 × 200 m: vestre halvdel svært vått (0–25 cm), en bekk (vann) i x = 60–62 px,
  // et fuktig belte øverst (nord), resten tørt (gjennomsiktig).
  const w = 100; const h = 100; const data = new Uint8ClampedArray(w * h * 4);
  const sett = (c, r, rgb, a = 255) => { const o = (r * w + c) * 4; data[o] = rgb[0]; data[o + 1] = rgb[1]; data[o + 2] = rgb[2]; data[o + 3] = a; };
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (c < 50) sett(c, r, [0, 0, 255]); else if (c >= 60 && c < 62) sett(c, r, [0, 0, 128]); else if (r < 10) sett(c, r, [0, 191, 255]); else sett(c, r, [0, 0, 0], 0);
  }
  const bilde = { w, h, data };
  const g = MF.tilRutenett(bilde, [1000, 2000, 1200, 2200], 10);
  assert.equal(g.nx, 20); assert.equal(g.ny, 20); assert.equal(g.d, 10);
  assert.equal(MF.klasseI(g, 1050, 2100), 'd0'); assert.equal(MF.klasseI(g, 1150, 2100), null); // tørt øst
  assert.equal(MF.klasseI(g, 1122, 2100), 'vann'); // bekken (2 px) forsvinner ikke i 10 m-rutene
  assert.equal(MF.klasseI(g, 1150, 2195), 'd50'); // fuktig belte i nord (bildets øverste rader)
  assert.equal(MF.klasseI(g, 5000, 5000), null);
  assert.match(MF.tekst('d0'), /Svært vått: grunnvann 0–0,25 m/); assert.match(MF.tekst(null), /Tørt/);
  assert.match(MF.url([0, 0, 2000, 2000], 500, 500), /markfuktighetsklasser.*WIDTH=500&HEIGHT=500/);
  // Henting med falsk dekoder og per bestand (ruter på 2 km)
  const vr = await MF.hent([1000, 2000, 1200, 2200], { dekod: async (u) => { assert.match(u, /BBOX=1000\.0,2000\.0,1200\.0,2200\.0/); return bilde; }, celle: 10 });
  assert.equal(vr.k.filter((k) => k === 'd0').length, 200);
  const gU = (x, y) => utmTilGeo(x, y, 33); const rekt = (x0, x1, y0, y1) => ({ type: 'Polygon', coordinates: [[gU(x0, y0), gU(x1, y0), gU(x1, y1), gU(x0, y1), gU(x0, y0)]] });
  const rute = 2000; const stort = new Uint8ClampedArray(500 * 500 * 4); // 4 m piksler, vestre halvdel av ruta svært våt
  for (let r = 0; r < 500; r++) for (let c = 0; c < 500; c++) { const o = (r * 500 + c) * 4; if (c < 250) { stort[o + 2] = 255; stort[o + 3] = 255; } }
  const st = await MF.perBestand([{ id: 'v', geometri: rekt(300100, 300400, 6700100, 6700400) }, { id: 'o', geometri: rekt(301500, 301800, 6700100, 6700400) }], { dekod: async () => ({ w: 500, h: 500, data: stort }), rute });
  assert.equal(st.get('v').andeler.d0, 1); assert.equal(st.get('o').andeler.torr, 1);
  assert.equal(MF.vurdering(st.get('v')).niva, 'svart'); assert.match(MF.vurdering(st.get('v')).tekst, /100 % av arealet har grunnvann nærmere enn 25 cm/);
  assert.equal(MF.vurdering(st.get('o')).niva, 'torr');
  assert.equal(MF.vurdering({ andeler: { d25: 0.3, torr: 0.7 }, vat: 0.3 }).niva, 'vat');
  // Minikartet tegner våt mark under brattheten
  const kall = []; const ctx = new Proxy({}, { get: (_, k) => (k in c2 ? c2[k] : (...a) => kall.push([k, ...a])), set: (_, k, v) => { c2[k] = v; kall.push(['=' + String(k), v]); return true; } }); const c2 = {};
  const lok = { ...g, x0: g.x0 - 1100, y0: g.y0 - 2100 };
  const syn = MK.lagMinikart({ fukt: lok, fuktFarge: (k) => (k && k !== 'd75' ? MF.klasse(k).farge : null) }).tegn(ctx, { x: 0, y: 0, radius: 80, storrelse: 256 });
  assert.ok(syn.fukt > 150); assert.ok(kall.some((k) => k[0] === '=fillStyle' && k[1] === '#0000ff'));
});

test('Registrering: e-post som brukernavn, hashet passord, innlogging, konto, sperring, bruksstatistikk og admin', async () => {
  const { lagInnlogging, innloggingApi, krevInnlogging, hashPassord, lagBrukerlager } = await import('../auth.js');
  const { mkdtempSync, readFileSync: les, rmSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
  let tid = Date.UTC(2026, 9, 31, 10); const mappe = mkdtempSync(join(tmpdir(), 'skogiq-')); const fil = join(mappe, 'brukere.json');
  const inn = lagInnlogging({ registrering: true, fil, admin: 'trond,sjef@example.no', bruker: 'trond', passord: 'skog-og-mark', naa: () => tid });
  assert.ok(inn.aktiv && inn.registrering && inn.permanent && !inn.epostAktiv);
  const h1 = hashPassord('abc12345'); const h2 = hashPassord('abc12345'); assert.notEqual(h1.hash, h2.hash); assert.equal(hashPassord('abc12345', h1.salt).hash, h1.hash);
  // Brukernavnet er e-postadressen
  assert.match(inn.registrer('1', { bruker: 'kari', passord: 'langtpassord' }).feil, /e-postadressen/);
  assert.equal(inn.registrer('1', { bruker: 'kari@example.no', passord: 'kort' }).status, 400);
  assert.equal(inn.registrer('1', { bruker: 'kari@example.no', passord: 'kari2026!!' }).status, 400, 'passord med e-postnavnet');
  assert.equal(inn.registrer('1', { bruker: 'Kari@Example.no', passord: 'skogen-2026', navn: 'Kari Skog' }).status, 400, 'rolle er obligatorisk');
  assert.equal(inn.registrer('1', { bruker: 'Kari@Example.no', passord: 'skogen-2026', vilkar: PV_VILKAR.versjon, roller: ['tulling'] }).status, 400, 'ukjent rolle');
  assert.ok(inn.registrer('1', { bruker: 'Kari@Example.no', passord: 'skogen-2026', navn: 'Kari Skog', vilkar: PV_VILKAR.versjon, roller: ['skogeier', 'Innkjoper', 'skogeier'] }).ok);
  assert.deepEqual(inn.lager.hent('kari@example.no').profil.roller, ['skogeier', 'innkjoper'], 'roller renses og lagres i profilen');
  assert.deepEqual(inn.meg('kari@example.no').roller, ['skogeier', 'innkjoper']);
  assert.equal(inn.lagreProfil('kari@example.no', { navn: 'Kari Skog', roller: [] }).status, 400, 'kan ikke fjerne alle roller');
  assert.deepEqual(inn.lagreProfil('kari@example.no', { navn: 'Kari Skog', roller: ['entreprenor', 'offentlig'] }).profil.roller, ['entreprenor', 'offentlig']);
  assert.deepEqual(inn.lagreProfil('kari@example.no', { navn: 'Kari Skog', telefon: '900 00 000' }).profil.roller, ['entreprenor', 'offentlig'], 'andre profilendringer beholder rollene');
  assert.equal(inn.registrer('2', { bruker: 'kari@example.no', passord: 'annet-passord' }).status, 409, 'opptatt');
  assert.equal(inn.registrer('1', { bruker: 'sjef@example.no', passord: 'noe-passord-1' }).status, 403, 'administratornavn er reservert');
  const kari = inn.lager.hent('kari@example.no'); assert.equal(kari.visning, 'Kari Skog'); assert.equal(kari.epost, 'kari@example.no'); assert.ok(kari.hash && kari.salt && !JSON.stringify(kari).includes('skogen-2026'));
  assert.equal(inn.lager.hent(inn.registrer('3', { bruker: 'ola.nordmann@example.no', passord: 'granskog-11', vilkar: PV_VILKAR.versjon, roller: ['skogeier'] }).bruker).visning, 'ola.nordmann');
  // Innlogging med e-post (store/små bokstaver) og med eldre brukernavn
  assert.ok(inn.sjekk('1', 'KARI@example.no', 'skogen-2026').ok); assert.ok(!inn.sjekk('1', 'kari@example.no', 'feil').ok);
  assert.ok(inn.erAdmin('trond') && !inn.erAdmin('kari@example.no')); assert.ok(inn.sjekk('1', 'trond', 'skog-og-mark').ok);
  const t = inn.lagToken('kari@example.no'); assert.equal(inn.lesToken(t).u, 'kari@example.no');
  // Min konto: e-post på administratoren (eldre brukernavn), så han kan logge inn med e-post og bruke «glemt passord»
  assert.equal(inn.byttPassord('trond', 'feil', undefined, 'trond@example.no').status, 401);
  assert.equal(inn.byttPassord('trond', 'skog-og-mark', undefined, 'kari@example.no').status, 409, 'e-post brukt av en annen');
  assert.ok(inn.byttPassord('trond', 'skog-og-mark', undefined, 'trond@example.no').ok); assert.ok(inn.sjekk('1', 'trond@example.no', 'skog-og-mark').ok, 'innlogging med e-post');
  const tTrond = inn.lagToken('trond'); assert.ok(inn.lesToken(tTrond), 'bare e-post endret: økten gjelder fortsatt');
  // Passordbytte gjør gamle økter ugyldige
  assert.ok(inn.byttPassord('kari@example.no', 'skogen-2026', 'nytt-passord1').ok); assert.equal(inn.lesToken(t), null); assert.ok(inn.sjekk('1', 'kari@example.no', 'nytt-passord1').ok);
  // Bruk
  inn.bruk('kari@example.no', 'side'); inn.bruk('kari@example.no', 'aktiv'); inn.bruk('kari@example.no', 'aktiv'); inn.bruk('kari@example.no', 'fane', 'tiltak'); inn.bruk('kari@example.no', 'fane', 'tiltak'); inn.bruk('kari@example.no', 'fane', 'veier'); inn.bruk('ukjent', 'side');
  tid += 86400000; inn.bruk('kari@example.no', 'side'); inn.bruk('trond', 'aktiv');
  const o = inn.oversikt({ antallDager: 7 });
  assert.equal(o.totalt, 3); assert.equal(o.aktiveIdag, 2);
  const ko = o.brukere.find((b) => b.bruker === 'kari@example.no'); assert.equal(ko.aktiveDager, 2); assert.equal(ko.sider, 2); assert.equal(ko.minutter, 2); assert.deepEqual(ko.faner, { tiltak: 2, veier: 1 });
  assert.ok(!JSON.stringify(o).includes('"hash"') && !JSON.stringify(o).includes('salt'));
  // Sperring
  const t2 = inn.lagToken('kari@example.no');
  assert.equal(inn.endreBruker('trond', 'trond', 'sperr').status, 400);
  assert.ok(inn.endreBruker('trond', 'kari@example.no', 'sperr').ok); assert.equal(inn.lesToken(t2), null); assert.ok(inn.sjekk('5', 'kari@example.no', 'nytt-passord1').blokkert);
  assert.ok(inn.endreBruker('trond', 'kari@example.no', 'aapne').ok); assert.ok(inn.sjekk('5', 'kari@example.no', 'nytt-passord1').ok);
  // Lagret og lest inn igjen
  inn.lager.flush(); assert.ok(JSON.parse(les(fil, 'utf8')).brukere['kari@example.no']);
  const inn2 = lagInnlogging({ registrering: true, fil, admin: 'trond', naa: () => tid }); assert.ok(inn2.sjekk('1', 'kari@example.no', 'nytt-passord1').ok); assert.equal(inn2.lesToken(inn.lagToken('trond')).u, 'trond');
  // Grenser og kode
  for (let i = 0; i < 5; i++) inn.registrer('7.7.7.7', { bruker: `spam${i}@example.no`, passord: 'passord-123', vilkar: PV_VILKAR.versjon, roller: ['skogeier'] });
  assert.equal(inn.registrer('7.7.7.7', { bruker: 'spam9@example.no', passord: 'passord-123', vilkar: PV_VILKAR.versjon, roller: ['skogeier'] }).status, 429);
  const medKode = lagInnlogging({ registrering: true, kode: 'SKOG2026', naa: () => tid }); assert.ok(medKode.kodeKreves && !medKode.permanent);
  assert.equal(medKode.registrer('1', { bruker: 'ola@example.no', passord: 'passord-123' }).status, 403); assert.ok(medKode.registrer('1', { bruker: 'ola@example.no', passord: 'passord-123', kode: 'SKOG2026', vilkar: PV_VILKAR.versjon, roller: ['offentlig'] }).ok);
  // HTTP
  const res = () => { const r = { status: 0, hoder: {}, kropp: '', writeHead(st, hd = {}) { r.status = st; r.hoder = hd; }, end(b = '') { r.kropp = String(b); r.ferdig?.(); } }; return r; };
  const req = (metode, url, { hoder = {}, kropp = null } = {}) => { const h = {}; return { method: metode, url, headers: { host: 'skogiq.test', ...hoder }, socket: { remoteAddress: '3.3.3.3' }, on: (e, f) => { h[e] = f; if (e === 'end') setTimeout(() => { if (kropp) h.data?.(Buffer.from(kropp)); f(); }, 0); }, destroy() {} }; };
  const api = (q, i = inn) => new Promise((ok) => { const r = res(); r.ferdig = () => ok(r); if (!innloggingApi(i, q, r, new URL(q.url, 'http://x').pathname)) ok(null); });
  const ny = await api(req('POST', '/api/registrer', { kropp: JSON.stringify({ bruker: 'per@example.no', passord: 'granskog-77', navn: 'Per', vilkar: PV_VILKAR.versjon, roller: ['entreprenor'] }) })); assert.equal(ny.status, 201);
  const { token, admin } = JSON.parse(ny.kropp); assert.ok(token); assert.equal(admin, false);
  const meg = JSON.parse((await api(req('GET', '/api/meg', { hoder: { authorization: `Bearer ${token}` } }))).kropp); assert.equal(meg.navn, 'Per'); assert.equal(meg.epost, 'per@example.no'); assert.equal(meg.epost === 'per@example.no' && meg.registrering, true);
  assert.equal((await api(req('POST', '/api/bruk', { hoder: { authorization: `Bearer ${token}` }, kropp: JSON.stringify({ type: 'fane', detalj: 'karbon' }) }))).status, 200);
  assert.equal((await api(req('GET', '/api/admin/oversikt', { hoder: { authorization: `Bearer ${token}` } }))).status, 403);
  const adminToken = inn.lagToken('trond');
  assert.equal(JSON.parse((await api(req('GET', '/api/admin/oversikt?dager=14', { hoder: { authorization: `Bearer ${adminToken}` } }))).kropp).dager.length, 14);
  // Glemt passord uten e-posttjeneste: samme svar uansett, forespørselen vises for administrator
  const g1 = JSON.parse((await api(req('POST', '/api/glemt', { kropp: JSON.stringify({ epost: 'per@example.no' }) }))).kropp);
  const g2 = JSON.parse((await api(req('POST', '/api/glemt', { kropp: JSON.stringify({ epost: 'finnes.ikke@example.no' }) }))).kropp);
  assert.deepEqual(g1, g2); assert.deepEqual(g1, { ok: true, epost: false });
  assert.ok(inn.oversikt().brukere.find((b) => b.bruker === 'per@example.no').glemt);
  const ln = JSON.parse((await api(req('POST', '/api/admin/bruker', { hoder: { authorization: `Bearer ${adminToken}`, 'x-forwarded-proto': 'https' }, kropp: JSON.stringify({ bruker: 'per@example.no', handling: 'lenke' }) }))).kropp);
  assert.match(ln.lenke, /^https:\/\/skogiq\.test\/logginn\.html#tilbakestill=[\w-]{20,}$/); assert.equal(ln.epost, 'per@example.no');
  const rt = ln.lenke.split('=')[1];
  assert.equal((await api(req('POST', '/api/tilbakestill', { kropp: JSON.stringify({ token: rt, passord: 'kort' }) }))).status, 400);
  assert.equal((await api(req('POST', '/api/tilbakestill', { kropp: JSON.stringify({ token: 'feil-token', passord: 'nytt-passord-9' }) }))).status, 400);
  const tb = await api(req('POST', '/api/tilbakestill', { kropp: JSON.stringify({ token: rt, passord: 'nytt-passord-9' }) })); assert.equal(tb.status, 200); assert.equal(JSON.parse(tb.kropp).bruker, 'per@example.no');
  assert.equal(inn.lesToken(token), null, 'gamle økter ugyldige'); assert.ok(inn.sjekk('1', 'per@example.no', 'nytt-passord-9').ok);
  assert.ok(!inn.oversikt().brukere.find((b) => b.bruker === 'per@example.no').glemt, 'forespørselen er borte');
  assert.equal((await api(req('POST', '/api/tilbakestill', { kropp: JSON.stringify({ token: rt, passord: 'enda-et-pw-1' }) }))).status, 400, 'lenken kan brukes én gang');
  // Glemt passord med e-posttjeneste: lenke sendes til e-posten, gyldig én time
  const sendt = []; const medEpost = lagInnlogging({ registrering: true, naa: () => tid, sendEpost: async (m) => { sendt.push(m); } });
  medEpost.registrer('1', { bruker: 'lise@example.no', passord: 'bjorkeskog-1', navn: 'Lise', vilkar: PV_VILKAR.versjon, roller: ['skogeier'] });
  const g3 = JSON.parse((await api(req('POST', '/api/glemt', { kropp: JSON.stringify({ epost: 'LISE@example.no' }) }), medEpost)).kropp); assert.deepEqual(g3, { ok: true, epost: true });
  assert.equal(sendt.length, 1); assert.equal(sendt[0].til, 'lise@example.no'); assert.match(sendt[0].tekst, /Hei Lise![\s\S]*logginn\.html#tilbakestill=/);
  await api(req('POST', '/api/glemt', { kropp: JSON.stringify({ epost: 'ukjent@example.no' }) }), medEpost); assert.equal(sendt.length, 1, 'ingen e-post til ukjente');
  const lt = sendt[0].tekst.match(/tilbakestill=([\w-]+)/)[1];
  tid += 61 * 60000; assert.match(medEpost.tilbakestill(lt, 'nytt-pw-123').feil, /utløpt/); tid -= 61 * 60000;
  assert.ok(medEpost.tilbakestill(lt, 'nytt-pw-123').ok);
  for (let i = 0; i < 6; i++) await medEpost.glemt('6.6.6.6', 'lise@example.no', (x) => x); assert.equal((await medEpost.glemt('6.6.6.6', 'lise@example.no', (x) => x)).status, 429);
  // Beskyttelse
  const sjekk = (q) => { const r = res(); return krevInnlogging(inn, q, r, new URL(q.url, 'http://x').pathname) ? r : null; };
  for (const fri of ['/api/registrer', '/api/glemt', '/api/tilbakestill']) assert.equal(sjekk(req('POST', fri)), null, fri);
  const kariT = inn.lagToken('kari@example.no');
  assert.equal(sjekk(req('GET', '/admin.html', { hoder: { accept: 'text/html', authorization: `Bearer ${kariT}` } })).hoder.Location, '/');
  assert.equal(sjekk(req('GET', '/admin.html', { hoder: { accept: 'text/html', authorization: `Bearer ${adminToken}` } })), null);
  rmSync(mappe, { recursive: true, force: true });
  assert.ok(lagBrukerlager().permanent === false);
});

test('Velkomst: hilsen med navn, humor etter været, vær og driftsråd, og motiverende tekst om tiltakene', async () => {
  const VK = await import('../js/velkommen.js');
  const d = new Date(2026, 9, 31, 8, 30);
  assert.equal(VK.fornavn('Trond Harald Sand'), 'Trond'); assert.equal(VK.fornavn('kari.skog@example.no'), 'Kari'); assert.equal(VK.fornavn(''), '');
  assert.equal(VK.hilsen('Trond Harald Sand', d), 'God morgen, Trond!'); assert.equal(VK.hilsen('kari@x.no', new Date(2026, 9, 31, 19)), 'God kveld, Kari!');
  const regn = { ok: true, temp: 6, vind: 4, vindFra: 200, symbol: 'rain', nedbor: 1.4 }; const frost = { ok: true, temp: -6, vind: 2, vindFra: 0, symbol: 'clearsky_day', nedbor: 0 };
  assert.equal(VK.vaerType(regn, d), 'regn'); assert.equal(VK.vaerType(frost, d), 'sol'); assert.equal(VK.vaerType({ ok: true, temp: -1, nedbor: 0.5, symbol: 'snow' }, d), 'sno'); assert.equal(VK.vaerType(null), 'ukjent');
  assert.equal(VK.humor(regn, { bruker: 'a', dato: d }), VK.humor(regn, { bruker: 'a', dato: d }), 'samme tekst hele dagen');
  assert.match(VK.humor(regn, { bruker: 'a', dato: d }), /[Rr]egn|[Vv]åt/);
  assert.match(VK.vaerLinje(regn, 'Demoskogen'), /^Demoskogen nå: 6 °C · /);
  assert.match(VK.driftsraad(frost), /Frost i bakken/); assert.match(VK.driftsraad(regn), /Mye nedbør/); assert.equal(VK.driftsraad({ ok: true, temp: 10, vind: 3, nedbor: 0 }), '');
  // Tiltak
  assert.match(VK.tiltakTekst({ bestand: [] }).tekst, /Lag en skogbruksplan/);
  const S = { bestand: [
    { id: 'a', nr: '5', areal: 12, tiltak: [{ id: 't1', type: 'tynning', aar: 2025, status: 'planlagt', prioritet: 1 }] },
    { id: 'b', nr: '7', areal: 20, tiltak: [{ id: 't2', type: 'tynning', aar: 2026, status: 'planlagt' }, { id: 't3', type: 'planting', aar: 2026, status: 'planlagt' }] },
    { id: 'c', nr: '9', areal: 8, tiltak: [{ id: 't4', type: 'ungskogpleie', aar: 2030, status: 'planlagt' }, { id: 't5', type: 'sluttavvirkning', aar: 2026, status: 'utfort', utfortDato: '2026-03-01' }] },
  ] };
  const tt = VK.tiltakTekst(S, 2026);
  assert.match(tt.tekst, /I år står 2 tynning og 1 planting på planen \(52 daa\)\. 1 av dem har ventet siden 2025\. Start med tynning i bestand 5/);
  assert.match(tt.tekst, /1 tiltak unna i år/); assert.equal(tt.antall, 3);
  const ferdig = VK.tiltakTekst({ bestand: [{ id: 'c', nr: '9', tiltak: [{ type: 'ungskogpleie', aar: 2030, status: 'planlagt' }] }] }, 2026);
  assert.match(ferdig.tekst, /Ingenting står på planen for i år\. Neste er ungskogpleie i bestand 9 i 2030/);
  const v = VK.lagVelkomst({ navn: 'Trond Harald Sand', bruker: 'trond', S, v: frost, sted: 'Demoskogen', dato: d });
  assert.equal(v.tittel, 'God morgen, Trond!'); assert.ok(v.humor && v.vaer && v.raad && v.tiltak.tekst);
  assert.equal(VK.lagVelkomst({ navn: 'x' }).vaer, '');
});

test('Arealplan: koder, grupper og hensynssoner', () => {
  assert.equal(AP.gruppeFor('5100'), 'lnfr'); assert.equal(AP.gruppeFor('5112'), 'lnfr'); assert.equal(AP.gruppeFor('5220'), 'spredt');
  assert.equal(AP.gruppeFor('1110'), 'bolig'); assert.equal(AP.gruppeFor('1120'), 'fritid'); assert.equal(AP.gruppeFor('1201'), 'rastoff');
  assert.equal(AP.gruppeFor('2011'), 'samferdsel'); assert.equal(AP.gruppeFor('3040'), 'gronn'); assert.equal(AP.gruppeFor('5300'), 'vern');
  assert.equal(AP.gruppeFor('6001'), 'vann'); assert.equal(AP.gruppeFor('210'), 'lnfr'); assert.equal(AP.gruppeFor('150'), 'fritid'); assert.equal(AP.gruppeFor('650'), 'vern'); assert.equal(AP.gruppeFor(''), 'annet');
  assert.equal(AP.formalInfo('1120').navn, 'Fritidsbebyggelse'); assert.equal(AP.formalInfo('5112').navn, 'Skogbruk');
  assert.equal(AP.kortFormalNavn(AP.formalInfo('5100').navn), 'LNFR – landbruk, natur og friluftsliv');
  assert.match(AP.formalInfo('9999').navn, /9999/);
  assert.equal(AP.hensynKode({ fare: '310', hensynSonenavn: 'H310_5' }), 310);
  assert.equal(AP.hensynKode({ hensynSonenavn: 'H 320' }), 320);
  assert.equal(AP.hensynKode({ angittHensyn: '560' }), 560);
  assert.equal(AP.hensynKode({ reguleringsformål: '646' }), 110);
  assert.equal(AP.hensynKode({ reguleringsformål: '520' }), 390);
  assert.equal(AP.hensynKode({}), null);
  assert.equal(AP.hensynInfo(720).alvor, 2); assert.equal(AP.hensynInfo(311).navn, 'Ras- og skredfare'); assert.match(AP.hensynInfo(null).navn, /Bestemmelse/);
  // UTFGrid-tegn: hopper over " og \
  assert.equal(AP.utfIndeks(' '), 0); assert.equal(AP.utfIndeks('!'), 1); assert.equal(AP.utfIndeks('#'), 2); assert.equal(AP.utfIndeks(']'), 59);
  const r = AP.rutenettFor({ type: 'Polygon', coordinates: [[[10, 60], [10.02, 60], [10.02, 60.01], [10, 60.01], [10, 60]]] }, { margin: 0 });
  assert.equal(r.w % 4, 0); assert.ok(Math.abs(r.celleM.x - 10) < 1 && Math.abs(r.celleM.y - 10) < 1, JSON.stringify(r.celleM));
  const stor = AP.rutenettFor({ type: 'Polygon', coordinates: [[[10, 60], [10.5, 60], [10.5, 60.2], [10, 60]]] });
  assert.ok(stor.w <= 2048 && stor.h <= 2048);
  assert.match(AP.utfgridUrl(AP.KP_WMS, 'arealformal_kp', r), /request=GetMap.*layers=arealformal_kp.*format=application%2Fjson%3Btype%3Dutfgrid/);
  assert.match(AP.punktUrl(AP.RP_WMS, 'rpomrade_vn2', 60, 10), /GetFeatureInfo.*info_format=application\/json/);
});

test('Arealplan: analyse av rutenett, prioritet regulering > kommuneplan, bestand og vurdering', () => {
  const enc = (i) => { let c = i + 32; if (c >= 34) c++; if (c >= 92) c++; return String.fromCharCode(c); };
  const grid = (rader) => ({ grid: rader.map((r) => r.map(enc).join('')), keys: ['', 'a', 'b', 'c'], data: {} });
  // 4 × 4 ruter à 10 × 10 m (0,1 daa). Eiendommen dekker hele boksen.
  const res = { rutenett: { bbox: [10, 60, 10.004, 60.004], w: 16, h: 16, celleM: { x: 10, y: 10 } }, feil: [], lag: {} };
  const kp = grid([[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 2, 2], [1, 1, 2, 2]]);
  kp.data = { a: { arealformål: '5100', 'arealplanId.planidentifikasjon': 'KP1', områdenavn: 'L' }, b: { arealformål: '1120', 'arealplanId.planidentifikasjon': 'KP1' } };
  const rp = grid([[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 1]]);
  rp.data = { a: { arealformål: '3040', feltbetegnelse: 'FRI1', 'arealplanId.planidentifikasjon': 'R1' } };
  const hensyn = grid([[1, 1, 0, 0], [1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]);
  hensyn.data = { a: { objekttypenavn: 'KpFareSone', fare: '310', hensynSonenavn: 'H310_1', beskrivelse: 'Kvikkleire' } };
  const omr = grid([[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]]);
  omr.data = { a: { plannavn: 'Kommuneplanens arealdel 2024', plantype: '20', planstatus: '3', 'arealplanId.planidentifikasjon': 'KP1', link: 'https://example.no/plan', ikrafttredelsesdato: '2024-12-11Z' } };
  res.lag = { 'kp-formal': kp, 'kp-hensyn': hensyn, 'kp-omrade': omr, 'rp-formal': rp, 'rp-hensyn': null, 'rp-omrade': null };
  const eiendom = { type: 'Polygon', coordinates: [[[10, 60], [10.004, 60], [10.004, 60.004], [10, 60.004], [10, 60]]] };
  const bestand = [{ id: 'b1', geometri: { type: 'Polygon', coordinates: [[[10, 60.002], [10.002, 60.002], [10.002, 60.004], [10, 60.004], [10, 60.002]]] } }];
  const a = AP.analyser(res, eiendom, { punktIGeometri, bestand, hentet: '2026-10-31' });
  assert.equal(a.daa, 1.6);
  const f = Object.fromEntries(a.formal.map((x) => [`${x.plan}|${x.kode}`, x]));
  assert.equal(f['kp|5100'].andel, 0.75); assert.equal(f['kp|1120'].andel, 0.188); assert.equal(f['rp|3040'].andel, 0.063, 'regulering går foran kommuneplanen');
  assert.deepEqual(f['rp|3040'].felt, ['FRI1']);
  assert.equal(a.dekning.kp, 1); assert.equal(a.dekning.rp, 0.063);
  assert.equal(a.hensyn[0].kode, 310); assert.equal(a.hensyn[0].andel, 0.25); assert.equal(a.hensyn[0].beskrivelse, 'Kvikkleire');
  assert.equal(a.planer[0].type, 'Kommuneplanens arealdel'); assert.equal(a.planer[0].status, 'Endelig vedtatt'); assert.equal(a.planer[0].ikraft, '2024-12-11'); assert.equal(a.planer[0].lenke, 'https://example.no/plan');
  // Bestandet ligger i øvre venstre kvadrant: LNFR og skredfare overalt.
  assert.deepEqual(a.bestand.b1, { formal: [{ kode: '5100', andel: 1 }], hensyn: [{ kode: 310, andel: 1 }] });
  const bt = AP.bestandTekst(a.bestand.b1); assert.equal(bt.alvor, 2); assert.match(bt.tekst, /LNFR.*Ras- og skredfare/); assert.match(bt.raad, /skredvurdering/);
  const v = AP.vurdering(a);
  assert.match(v.tittel, /^75 % landbruk.*skogbruk er hovedformålet.*1 hensynssone/); assert.equal(v.niva, 'begrenset');
  assert.ok(v.muligheter.some((m) => m.gruppe === 'fritid' && /hytter/.test(m.tekster[0])));
  assert.equal(v.begrensninger[0].alvor, 2);
  assert.ok(v.begrensninger.some((m) => m.hensyn === 310 && /Kvikkleire/.test(m.om)));
  assert.ok(v.merknader.some((m) => /regulert/.test(m)));
  // Ingen planer
  const tom = AP.vurdering({ formal: [], planer: [], hensyn: [], dekning: { kp: 0, kdp: 0, rp: 0 } });
  assert.equal(tom.niva, 'ukjent'); assert.match(tom.merknader[0], /planinnsyn/);
});

test('Arealplan: henting med feil i enkelt-lag og punktoppslag', async () => {
  const geom = { type: 'Polygon', coordinates: [[[10, 60], [10.002, 60], [10.002, 60.002], [10, 60.002], [10, 60]]] };
  const kall = [];
  const res = await AP.hent(geom, { hentJson: async (u) => { kall.push(u); if (/hensynssoner_vn2/.test(u)) throw new Error('nede'); return { grid: [], keys: [''], data: {} }; } });
  assert.equal(kall.length, AP.LAG.length); assert.equal(res.feil.length, 1); assert.equal(res.lag['rp-hensyn'], null);
  await assert.rejects(AP.hent(geom, { hentJson: async () => { throw new Error('x'); } }), /kontakt med plantjenesten/);
  const p = AP.tolkPunkt([
    { id: 1, properties: { objekttypenavn: 'KpArealformålOmråde', arealformål: '5100', områdenavn: 'L', 'identifikasjon.lokalId': 'x1' } },
    { id: 2, properties: { objekttypenavn: 'KpArealformålOmråde', arealformål: '5100', 'identifikasjon.lokalId': 'x1' } },
    { id: 3, properties: { objekttypenavn: 'RpFareSone', fare: '370', hensynSonenavn: 'H370' } },
    { id: 4, properties: { objekttypenavn: 'RpOmråde', plannavn: 'Detaljplan Ås', plantype: '35', link: 'javascript:alert(1)' } },
  ]);
  assert.equal(p.formal.length, 1); assert.equal(p.formal[0].felt, 'L'); assert.equal(p.hensyn[0].navn, 'Høyspenningsanlegg');
  assert.equal(p.planer[0].type, 'Detaljregulering'); assert.equal(p.planer[0].lenke, null, 'bare http(s)-lenker');
});

test('Skylagring på serveren: versjoner, konflikt, historikk, papirkurv, kvote og filer på disk', async () => {
  const { mkdtempSync, existsSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const path = await import('node:path');
  let t = 1000; const naa = () => t;
  for (const mappe of [null, mkdtempSync(path.join(tmpdir(), 'skogiq-sky-'))]) {
    const L = lagSkyLager({ mappe, naa, kvote: 2000, historikk: 3 });
    assert.equal(L.permanent, !!mappe);
    const a = L.lagre('kari@x.no', 'plan1', { plan: 'QUJD', navn: 'Skogen', meta: { areal: 12.345, antall: 3, kommune: 'Ås' } });
    assert.equal(a.versjon, 1); assert.deepEqual(a.meta, { areal: 12.3, antall: 3, kommune: 'Ås', kommunenr: '', gnrbnr: '' });
    assert.equal(L.lagre('kari@x.no', 'plan1', { plan: 'QUJE' }).status, 409, 'ny plan med samme id uten grunnversjon');
    const k = L.lagre('kari@x.no', 'plan1', { plan: 'QUJE', grunnVersjon: 0 }); assert.equal(k.status, 409); assert.equal(k.gjeldende.versjon, 1);
    t = 2000; assert.equal(L.lagre('kari@x.no', 'plan1', { plan: 'QUJF', grunnVersjon: 1 }).versjon, 2);
    for (let v = 2; v < 6; v++) { t += 1000; L.lagre('kari@x.no', 'plan1', { plan: `QUJ${v}`, grunnVersjon: v }); }
    assert.deepEqual(L.versjoner('kari@x.no', 'plan1').map((x) => x.versjon), [6, 5, 4, 3], 'gjeldende + 3 i historikken');
    assert.equal(L.hent('kari@x.no', 'plan1', { versjon: 4 }).plan, 'QUJ3'); assert.equal(L.hent('kari@x.no', 'plan1').plan, 'QUJ5');
    assert.equal(L.hent('kari@x.no', 'plan1', { versjon: 1 }), null, 'for gammel versjon');
    // Brukerne er skilt fra hverandre
    assert.equal(L.hent('ola@x.no', 'plan1'), null); assert.deepEqual(L.liste('ola@x.no'), []);
    // Ugyldig
    assert.equal(L.lagre('kari@x.no', '../x', { plan: 'QUJD' }).status, 400);
    assert.equal(L.lagre('kari@x.no', 'plan2', { plan: '<script>' }).status, 400);
    assert.equal(L.lagre('kari@x.no', 'plan2', { plan: 'A'.repeat(2500) }).status, 507, 'kvote');
    // Papirkurv
    assert.ok(L.slett('kari@x.no', 'plan1')); assert.equal(L.liste('kari@x.no').length, 0); assert.equal(L.liste('kari@x.no', { slettede: true }).length, 1);
    assert.equal(L.info('kari@x.no', 'plan1').slettet, t);
    assert.equal(L.lagre('kari@x.no', 'plan1', { plan: 'QUJD', grunnVersjon: 6 }).status, 410, 'en annen enhet kan ikke vekke en slettet plan');
    const g = L.gjenopprett('kari@x.no', 'plan1'); assert.equal(g.versjon, 7); assert.equal(L.liste('kari@x.no').length, 1);
    L.slett('kari@x.no', 'plan1'); t += 31 * 864e5; assert.equal(L.liste('kari@x.no', { slettede: true }).length, 0, 'tømt etter 30 dager');
    assert.equal(L.bruk('kari@x.no').antall, 0);
    L.lagre('kari@x.no', 'plan3', { plan: 'QUJD' }); L.slettBruker('kari@x.no'); assert.deepEqual(L.liste('kari@x.no'), []);
    if (mappe) assert.ok(existsSync(mappe));
  }
});

test('Skylagring: synkronisering mellom to enheter – opplasting, nye planer, fletting, sletting og profil (HTTP)', async () => {
  const http = await import('node:http');
  const L = lagSkyLager({});
  const profiler = {};
  const srv = http.createServer((req, res) => {
    const sti = new URL(req.url, 'http://x').pathname;
    if (!skyApi(L, { bruker: (r) => (r.headers.authorization === 'Bearer kari' ? 'kari@x.no' : null), profil: { hent: (u) => profiler[u] || { navn: u }, lagre: (u, d) => ({ ok: true, profil: (profiler[u] = { ...d }) }) } }, req, res, sti)) { res.writeHead(404); res.end(); }
  });
  await new Promise((ok) => srv.listen(0, ok)); const api = `http://127.0.0.1:${srv.address().port}`;
  try {
    const klient = (navn, token = 'kari') => SKY.lagSkyKlient({ api, token: () => token, enhet: navn });
    const enhet = () => { const m = new Map(); return { m, liste: async () => [...m.values()].map((p) => ({ id: p.planId, navn: p.eiendom?.navn, eier: p.eier || null })), hent: async (id) => (m.has(id) ? structuredClone(m.get(id)) : null), lagre: async (p) => { m.set(p.planId, structuredClone(p)); }, slett: async (id) => { m.delete(id); } }; };
    const plan = (id, navn) => ({ planId: id, versjon: 1, eiendom: { navn }, bestand: [{ id: 'b1', nr: '1', areal: 10, tiltak: [] }], registreringer: [], endret: '2026-10-01T10:00:00Z' });
    const pc = enhet(); const mob = enhet(); const kPc = klient('PC'); const kMob = klient('mobil');
    await assert.rejects(klient('x', 'feil').liste(), (e) => e.status === 401);
    // 1. PC har to planer lokalt (før skylagring): begge lastes opp og får eier.
    await pc.lagre(plan('planA', 'Nordskogen')); await pc.lagre(plan('planB', 'Sørskogen'));
    let r = await SKY.synkAlle(kPc, pc, { eier: 'kari@x.no' });
    assert.equal(r.sendt, 2); assert.equal(r.bruk.antall, 2);
    assert.equal(pc.m.get('planA').eier, 'kari@x.no'); assert.equal(pc.m.get('planA').sky.versjon, 1);
    assert.equal((await SKY.synkAlle(kPc, pc, { eier: 'kari@x.no' })).lik, 2, 'ingenting nytt');
    // 2. Ny mobil: planene hentes ned.
    r = await SKY.synkAlle(kMob, mob, { eier: 'kari@x.no' });
    assert.equal(r.nye, 2); assert.equal(mob.m.get('planB').eiendom.navn, 'Sørskogen'); assert.ok(!SKY.endretLokalt(mob.m.get('planB')));
    // 3. Begge endrer samme plan uten nett: mobilen legger til en registrering, PC-en et tiltak.
    const m = mob.m.get('planA'); m.registreringer.push({ id: 'r1', tekst: 'Barkbille', dato: '2026-10-02' }); m.endret = '2026-10-02T10:00:00Z'; await mob.lagre(m);
    const p = pc.m.get('planA'); p.bestand[0].tiltak.push({ id: 't1', type: 'tynning', aar: 2027 }); p.endret = '2026-10-03T10:00:00Z'; await pc.lagre(p);
    assert.equal((await SKY.synkAlle(kMob, mob, { eier: 'kari@x.no' })).sendt, 1);
    r = await SKY.synkAlle(kPc, pc, { eier: 'kari@x.no' }); assert.equal(r.flettet, 1);
    assert.deepEqual(pc.m.get('planA').registreringer.map((x) => x.id), ['r1']); assert.deepEqual(pc.m.get('planA').bestand[0].tiltak.map((x) => x.id), ['t1']);
    r = await SKY.synkAlle(kMob, mob, { eier: 'kari@x.no' }); assert.equal(r.hentet, 1);
    assert.deepEqual(mob.m.get('planA').bestand[0].tiltak.map((x) => x.id), ['t1'], 'mobilen får tiltaket fra PC-en');
    // 4. Den åpne planen håndteres av appen (paaAktiv).
    const mp = mob.m.get('planB'); mp.registreringer.push({ id: 'r2' }); mp.endret = '2026-10-04T00:00:00Z'; await mob.lagre(mp);
    await SKY.synkAlle(kMob, mob, { eier: 'kari@x.no' });
    const sett = []; await SKY.synkAlle(kPc, pc, { eier: 'kari@x.no', aktivId: 'planB', paaAktiv: (x) => sett.push(x.status) });
    assert.deepEqual(sett, ['hentet']); assert.equal(pc.m.get('planB').registreringer.length, 0, 'appen bestemmer for den åpne planen');
    // 5. Slettet på PC-en → fjernes på mobilen; ligger i papirkurven.
    await kPc.slett('planB'); pc.m.delete('planB');
    r = await SKY.synkAlle(kMob, mob, { eier: 'kari@x.no' }); assert.equal(r.slettet, 1); assert.ok(!mob.m.has('planB'));
    assert.deepEqual((await kPc.liste({ slettede: true })).planer.map((x) => x.id), ['planB']);
    // 6. Gjenopprett og tidligere versjoner
    await kPc.gjenopprett('planB'); assert.equal((await SKY.synkAlle(kMob, mob, { eier: 'kari@x.no' })).nye, 1);
    const v = (await kPc.versjoner('planA')).versjoner; assert.ok(v.length >= 3); assert.equal(v[0].enhet, 'PC', 'siste versjon er den flettede fra PC-en'); assert.equal(v[1].enhet, 'mobil');
    const gml = await kPc.last('planA', { versjon: 1 }); assert.equal(gml.plan.registreringer.length, 0);
    // 7. Planer til en annen bruker på samme enhet røres ikke.
    await pc.lagre({ ...plan('planX', 'Olas skog'), eier: 'ola@x.no' });
    r = await SKY.synkAlle(kPc, pc, { eier: 'kari@x.no' }); assert.equal(L.info('kari@x.no', 'planX'), null);
    // 8. Profil
    assert.deepEqual((await kPc.lagreProfil({ navn: 'Kari', rolle: 'skogeier' })).profil, { navn: 'Kari', rolle: 'skogeier' });
    const pr = await kPc.profil(); assert.equal(pr.profil.rolle, 'skogeier'); assert.equal(pr.sky.antall, 2);
    assert.match(SKY.synkTekst({ nye: 2, sendt: 1 }), /2 planer hentet fra skyen, 1 lagret i skyen/);
  } finally { srv.close(); }
});

test('Profil på serveren: felt, validering og navn', async () => {
  const { lagInnlogging } = await import('../auth.js');
  const inn = lagInnlogging({ registrering: true });
  const r = inn.registrer('1.1.1.1', { bruker: 'per@gard.no', passord: 'langtpassord1', navn: 'Per', vilkar: PV_VILKAR.versjon, roller: ['skogeier'] }); assert.ok(r.ok);
  assert.deepEqual(inn.hentProfil('per@gard.no'), { navn: 'Per', epost: 'per@gard.no', roller: ['skogeier'] });
  assert.equal(inn.lagreProfil('per@gard.no', { navn: '' }).status, 400);
  assert.equal(inn.lagreProfil('per@gard.no', { navn: 'Per', rolle: 'konge' }).status, 400);
  assert.equal(inn.lagreProfil('per@gard.no', { navn: 'Per', postnr: '12' }).status, 400);
  assert.equal(inn.lagreProfil('per@gard.no', { navn: 'Per', orgnr: '12345' }).status, 400);
  const ok = inn.lagreProfil('per@gard.no', { navn: 'Per Hansen', rolle: 'bonde', telefon: '+47 900 00 000', orgnr: '123 456 789', postnr: '2050', kommune: 'Ullensaker', om: 'x'.repeat(900), ukjent: 'bort' });
  assert.ok(ok.ok); assert.equal(ok.profil.navn, 'Per Hansen'); assert.equal(ok.profil.om.length, 600); assert.equal(ok.profil.ukjent, undefined);
  assert.equal(inn.meg('per@gard.no').navn, 'Per Hansen'); assert.equal(inn.meg('per@gard.no').profil.kommune, 'Ullensaker');
  const sett = []; const inn2 = lagInnlogging({ registrering: true, bruker: 'admin', passord: 'adminpassord9', ekstraBruker: (u) => ({ sky: { antall: u.length } }), vedSlett: (u) => sett.push(u) });
  inn2.registrer('1.1.1.2', { bruker: 'ola@x.no', passord: 'langtpassord2', vilkar: PV_VILKAR.versjon, roller: ['skogeier'] });
  assert.equal(inn2.oversikt().brukere.find((b) => b.bruker === 'ola@x.no').sky.antall, 8);
  inn2.endreBruker('admin', 'ola@x.no', 'slett'); assert.deepEqual(sett, ['ola@x.no'], 'skydata slettes med brukeren');
  // AI-konteksten tar med profilen
  assert.match(lagKontekst({ ...lagDemo(), innstillinger: STANDARD_INNSTILLINGER }, { profil: { rolle: 'bonde', om: 'Melkeproduksjon og 400 daa skog' } }), /Brukeren: rolle bonde.*Melkeproduksjon/);
});

test('Kommuneanalyse: avstand til bilvei fra NVDB (rutenett, kantpunkter, paging og filtrering av veityper)', async () => {
  assert.deepEqual(KV.wktLinjer('LINESTRING Z (0 0 5, 100 0 6)'), [[[0, 0], [100, 0]]]);
  assert.deepEqual(KV.wktLinjer('MULTILINESTRING ((0 0, 1 1), (2 2, 3 3))'), [[[0, 0], [1, 1]], [[2, 2], [3, 3]]]);
  assert.deepEqual(KV.wktLinjer('POINT (1 2)'), []);
  const vei = [[[600000, 6700000], [601000, 6700000]]];
  const ix = KV.lagIndeks(vei, 500);
  assert.equal(Math.round(KV.naermesteVei(ix, [[600500, 6700250]])), 250);
  assert.equal(Math.round(KV.naermesteVei(ix, [[602000, 6700000]])), 1000, 'søker i ringer utover');
  assert.equal(KV.naermesteVei(ix, [[620000, 6700000]]), null, 'over 10 km');
  assert.equal(KV.naermesteVei(KV.lagIndeks([]), [[0, 0]]), null);
  // Flate (lon/lat) 300 m nord for veien
  const { utmTilGeo } = await import('../js/proj.js');
  const ring = [[600400, 6700300], [600600, 6700300], [600600, 6700500], [600400, 6700500], [600400, 6700300]].map(([x, y]) => utmTilGeo(x, y, 33));
  const av = KV.avstanderTilVei([{ id: 'f1', geometri: { type: 'Polygon', coordinates: [ring] } }], vei);
  assert.equal(av.get('f1'), 300, 'korteste avstand fra kanten av flaten, avrundet til 10 m');
  assert.equal(KV.avstandTekst(0), 'ved vei'); assert.equal(KV.avstandTekst(340), '340 m'); assert.equal(KV.avstandTekst(1500), '1,5 km'); assert.equal(KV.avstandTekst(null), 'over 10 km');
  // NVDB: to sider, gang- og sykkelvei og konnektering tas ikke med
  const kall = [];
  const side = (objekter, neste) => ({ ok: true, json: async () => ({ objekter, metadata: { returnert: objekter.length, sidestørrelse: 2, ...(neste ? { neste: { href: neste } } : {}) } }) });
  const hent = async (u) => { kall.push(u); return kall.length === 1
    ? side([{ typeVeg_sosi: 'enkelBilveg', type: 'HOVED', geometri: { wkt: 'LINESTRING Z (0 0 1, 10 0 1)' } }, { typeVeg_sosi: 'gangOgSykkelveg', type: 'HOVED', geometri: { wkt: 'LINESTRING (0 5, 9 5)' } }], 'https://nvdbapiles.atlas.vegvesen.no/vegnett/veglenkesekvenser/segmentert?kommune=3314&start=x')
    : side([{ typeVeg_sosi: 'kanalisertVeg', type: 'KONNEKTERING', geometri: { wkt: 'LINESTRING (0 0, 1 1)' } }]); };
  const n = await KV.hentVeinett('3314', { hent });
  assert.equal(n.antall, 1); assert.equal(kall.length, 2);
  assert.match(kall[0], /kommune=3314&srid=5973/); assert.match(kall[1], /\/vegnett\/api\/v4\/veglenkesekvenser\/segmentert\?kommune=3314&start=x/, 'neste-lenken får api/v4');
  // Kriteriet finnes med 0 = alle
  assert.equal(STANDARD_KRITERIER_KOMMUNE.maksAvstandVei, 0);
});

test('Naboeiendommer: teiger per matrikkelenhet, NIBIO-dekning fra bilde, status og planer i SkogIQ', async () => {
  const { utmTilGeo } = await import('../js/proj.js');
  const kv = (x0, y0, s) => [[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s], [x0, y0]].map(([x, y]) => utmTilGeo(x, y, 33));
  const teig = (gnr, bnr, ring, fnr = 0, id) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { kommunenummer: '3238', gardsnummer: gnr, bruksnummer: bnr, festenummer: fnr, lokalid: id } });
  const teiger = [teig(29, 2, kv(600000, 6700000, 400), 0, 1), teig(29, 2, kv(601000, 6700000, 100), 0, 2), teig(30, 1, kv(600400, 6700000, 400), 0, 3), teig(31, 5, kv(600000, 6700400, 400), 0, 4), teig(32, 9, kv(600400, 6700400, 50), 0, 5)];
  const e = NABO.grupper(teiger);
  assert.equal(e.length, 4); const e292 = e.find((x) => x.tekst === '29/2');
  assert.equal(e292.teiger, 2); assert.ok(Math.abs(e292.daa - 170) < 1, `${e292.daa} daa`); assert.equal(e292.id, '3238-29/2');
  // Søkeområder og bildeområde
  const { omrader, bbox } = NABO.sokeomrader({ type: 'Polygon', coordinates: [kv(600000, 6700000, 400)] });
  assert.equal(omrader.length, 1); assert.ok(omrader[0].radius <= 3000 && omrader[0].radius > 900);
  const bb = NABO.bildeomrade(e, bbox); assert.ok(bb[2] >= 601100 - 1, 'tar med teigen øst for søket');
  assert.match(NABO.planBildeUrl(bb).url, /skogbruksplan\?.*LAYERS=hogstklasser.*SRS=EPSG:25833/);
  // Kunstig bilde 100 × 100 px over 599500–601500: venstre halvdel dekket av plan
  const w = 100; const hgt = 100; const data = new Uint8ClampedArray(w * hgt * 4);
  for (let y = 0; y < hgt; y++) for (let x = 0; x < 50; x++) data[(y * w + x) * 4 + 3] = 255;
  const rb = [599500, 6699500, 601500, 6701500];
  const d30 = NABO.planDekning(e.find((x) => x.tekst === '30/1'), { w, h: hgt, data }, rb); // x 600400–600800: delvis til 600500
  assert.ok(d30.andel > 0.15 && d30.andel < 0.35, `andel ${d30.andel}`); assert.ok(d30.punkt);
  const d31 = NABO.planDekning(e.find((x) => x.tekst === '31/5'), { w, h: hgt, data }, rb); assert.equal(d31.andel, 1);
  assert.equal(NABO.planDekning(e292, { w, h: hgt, data }, [0, 0, 10, 10]), null, 'utenfor bildet = ukjent');
  // Status
  const mine = NABO.planNokler([{ id: 'p1', kommunenr: '3238', gnrbnr: '31/5' }, { id: 'p2', eiendom: { kommunenr: '3238', gnrbnr: '40/1/2' } }]);
  assert.deepEqual([...mine.keys()], ['3238-31/5', '3238-40/1/2']);
  const dekning = new Map([['3238-30/1', d30], ['3238-31/5', d31]]);
  const st = Object.fromEntries(NABO.settStatus(e, { egen: new Set(['3238-29/2']), mine, dekning }).map((x) => [x.tekst, x.status]));
  assert.deepEqual(st, { '29/2': 'egen', '30/1': 'nibio', '31/5': 'skogiq', '32/9': 'liten' });
  const st2 = NABO.settStatus([{ ...e.find((x) => x.tekst === '30/1') }], {})[0];
  assert.equal(st2.status, 'mangler');
  const o = NABO.oppsummer(NABO.settStatus(e, { egen: new Set(['3238-29/2']), mine, dekning })); assert.equal(o.nibio.antall, 1); assert.equal(o.liten.antall, 1);
  // Takstår fra GetFeatureInfo
  assert.deepEqual(NABO.tolkPlanInfo('<x><prosjekt>ØvreEike_2008</prosjekt><regaar_korr>2009</regaar_korr></x>'), { aar: 2009, prosjekt: 'ØvreEike_2008' });
  assert.equal(NABO.tolkPlanInfo('<msGMLOutput></msGMLOutput>'), null);
  assert.match(NABO.planInfoUrl([600000, 6700000]), /GetFeatureInfo.*BBOX=599950,6699950,600050,6700050/);
  // Henting: dubletter (samme lokalid) fjernes, flere søk slås sammen
  const kall = []; const hent = async (u) => { kall.push(u); return { ok: true, json: async () => ({ features: teiger.slice(0, 3) }) }; };
  const t = await NABO.hentTeiger([{ utm: [600000, 6700000], radius: 800 }, { utm: [602000, 6700000], radius: 800 }], { hent, utmTilGeo });
  assert.equal(t.length, 3); assert.equal(kall.length, 2); assert.match(kall[0], /punkt\/omrader\?nord=.*radius=800.*maksTreff=500/);
});

test('Naturdata: NiN-naturtyper og arter – tolkning, utvalg, punktoppslag, henting med sider og merking av flater', async () => {
  const n = NATUR.tolkNin({ Naturtype: 'Kalkfuruskog', Lokalitetskvalitet: 1, UK_Truet: 1, 'Områdenavn': 'Vierndroget Ø', 'Kartleggingsår': 2024, Faktaark: 'https://nin-faktaark.miljodirektoratet.no/naturtyper?id=X', NiNID: 'X' });
  assert.equal(n.kvalitetTekst, 'svært høy kvalitet'); assert.ok(n.truet); assert.ok(NATUR.viktigNin(n));
  assert.equal(NATUR.tekst(n), 'Kalkfuruskog (Vierndroget Ø) – svært høy kvalitet, truet naturtype');
  assert.ok(!NATUR.viktigNin(NATUR.tolkNin({ Naturtype: 'x', Lokalitetskvalitet: 4 })), 'lav kvalitet tas ikke med');
  assert.ok(NATUR.viktigNin(NATUR.tolkNin({ Naturtype: 'x', Lokalitetskvalitet: 5, 'UK_NærTruet': 1 })), 'nær truet tas med');
  assert.equal(NATUR.tolkNin({ Faktaark: 'javascript:alert(1)' }).lenke, null);
  const a = NATUR.tolkArt({ norskNavn: 'Hønsehauk', funksjon: 8, roedlisteStatus: 'NT', prioritertArt: 0, faktaark: 'https://faktaark.naturbase.no?id=1' });
  assert.equal(NATUR.tekst(a), 'Hønsehauk – yngleområde (NT, nær truet)'); assert.ok(NATUR.viktigArt(a));
  assert.ok(!NATUR.viktigArt(NATUR.tolkArt({ norskNavn: 'Elg', funksjon: 1 })), 'beiteområde for elg tas ikke med');
  const tl = NATUR.tolkArt({ norskNavn: 'Trelerke', funksjon: 9, roedlisteStatus: 'NTº' });
  assert.equal(tl.rodliste, 'NT', 'tegn bak koden fjernes'); assert.ok(NATUR.viktigArt(tl));
  const eu = new URL(NATUR.eksportUrl('art', [1, 2, 3, 4], 512));
  assert.match(eu.pathname, /artfunksjon\/MapServer\/export$/); assert.equal(eu.searchParams.get('size'), '512,512');
  assert.match(JSON.parse(eu.searchParams.get('layerDefs'))[0], /roedlisteStatus LIKE 'NT%'.*funksjon IN \(3,7,8\)/);
  assert.equal(new URL(NATUR.eksportUrl('nin', [1, 2, 3, 4])).searchParams.get('layers'), 'show:2,3,4,5,6,7', 'uten dekningskartet');
  assert.match(NATUR.punktUrl('nin', 10.5, 59.8), /naturtyper_nin\/MapServer\/0\/query\?geometry=10.5%2C59.8.*distance=15/);
  assert.match(NATUR.punktUrl('art', 10.5, 59.8), /artfunksjon/);
  assert.equal(NATUR.tolkPunkt('art', { features: [{ attributes: { norskNavn: 'Tiur', funksjon: 7 } }] })[0].funksjonTekst, 'spill-/parringsområde');
  // Henting med sider: NiN gir to sider (grensen nådd på første), arter én
  const kv = (x, y, d) => ({ type: 'Polygon', coordinates: [[[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]]] });
  const kall = [];
  const hent = async (u) => { kall.push(u); const nin = /naturtyper_nin/.test(u); const off = Number(new URL(u).searchParams.get('resultOffset'));
    const feats = nin ? (off === 0 ? [{ geometry: kv(10, 60, 0.01), properties: { Naturtype: 'Gammel granskog', Lokalitetskvalitet: 2, NiNID: 'a' } }, { geometry: kv(10.5, 60, 0.01), properties: { Naturtype: 'Lav', Lokalitetskvalitet: 5, NiNID: 'b' } }] : [{ geometry: kv(11, 60, 0.01), properties: { Naturtype: 'Rik sumpskog', Lokalitetskvalitet: 3, NiNID: 'c' } }])
      : [{ geometry: kv(10.003, 60.003, 0.002), properties: { norskNavn: 'Hvitryggspett', funksjon: 9, roedlisteStatus: 'VU', artFunksjonId: 7 } }];
    return { ok: true, json: async () => ({ features: feats, exceededTransferLimit: nin && off === 0 }) }; };
  const d = await NATUR.hentForBoks([9.9, 59.9, 11.1, 60.1], { hent });
  assert.equal(d.nin.length, 2, 'lav kvalitet filtrert bort'); assert.equal(d.art.length, 1); assert.equal(kall.length, 3);
  assert.match(kall[0], /maxAllowableOffset=0.00005/);
  const flater = [{ id: 'f1', geometri: kv(10.002, 60.002, 0.004) }, { id: 'f2', geometri: kv(10.8, 60, 0.01) }];
  const m = NATUR.merkFlater(flater, d);
  assert.deepEqual(m.get('f1').map((o) => o.navn), ['Gammel granskog', 'Hvitryggspett']); assert.equal(m.has('f2'), false);
  assert.equal(m.get('f1')[0].geometri, undefined, 'uten geometri i resultatet');
});

test('Kulturminner: klikk-info fra Riksantikvaren (GML), sikringssone, henting for kommunen og merking av flater', async () => {
  const gml = `<msGMLOutput><Lokaliteter_layer><gml:name>Lokaliteter</gml:name><Lokaliteter_feature><kulturminneid>118607</kulturminneid><kommune>Nannestad</kommune>
    <linkaskeladden>https://askeladden.ra.no/askeladden/?kid=118607</linkaskeladden><linkkulturminnesok>https://kulturminnesok.no/ra/lokalitet/118607</linkkulturminnesok>
    <lokalitetsart>Bosetning-aktivitetsområde</lokalitetsart><lokaliteteskategori>Arkeologisk minne</lokaliteteskategori><navn>Engelstad østre</navn><vernetype>Automatisk fredet</vernetype></Lokaliteter_feature>
    <Lokaliteter_feature><kulturminneid>9</kulturminneid><navn>Gamle Rud</navn><vernetype>Listeført</vernetype><linkkulturminnesok>javascript:x</linkkulturminnesok></Lokaliteter_feature></Lokaliteter_layer>
    <Sikringssoner_layer><gml:name>Sikringssoner</gml:name><Sikringssoner_feature><kulturminneid>118607</kulturminneid></Sikringssoner_feature></Sikringssoner_layer></msGMLOutput>`;
  const l = KULTUR.tolkPunkt(gml);
  assert.equal(l.length, 2);
  assert.deepEqual({ navn: l[0].navn, sone: l[0].sikringssone, fredet: KULTUR.erFredet(l[0]), lenke: l[0].lenke }, { navn: 'Engelstad østre', sone: true, fredet: true, lenke: 'https://kulturminnesok.no/ra/lokalitet/118607' });
  assert.equal(l[1].sikringssone, false); assert.equal(l[1].lenke, null); assert.equal(KULTUR.erFredet(l[1]), false);
  assert.equal(KULTUR.tekst(l[0]), 'Engelstad østre – bosetning-aktivitetsområde (automatisk fredet)');
  assert.deepEqual(KULTUR.tolkPunkt(''), []);
  assert.match(KULTUR.punktUrl(60.18, 11.02), /kulturminner2\?.*GetFeatureInfo.*query_layers=Lokaliteter%2CSikringssoner.*vnd.ogc.gml/);
  // Kommunen: sikringssoner fra api.ra.no med neste-lenke, merking av flater
  const kv = (x, y, d) => ({ type: 'Polygon', coordinates: [[[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]]] });
  const kall = [];
  const hent = async (u) => { kall.push(u); const side2 = /offset=1/.test(u); return { ok: true, json: async () => ({ features: [{ geometry: side2 ? kv(10.5, 60, 0.001) : kv(10.002, 60.002, 0.0005), properties: { kulturminneId: side2 ? '2' : '1', informasjon: 'R01.1: Gravhaug. Godt synlig' } }], links: side2 ? [] : [{ rel: 'next', href: 'https://api.ra.no/x?offset=1' }] }) }; };
  const km = await KULTUR.hentForBoks([10, 60, 11, 60.1], { hent });
  assert.equal(km.length, 2); assert.equal(kall.length, 2); assert.match(km[0].navn, /Kulturminne 1: Gravhaug/);
  const m = KULTUR.merkFlater([{ id: 'f1', geometri: kv(10, 60, 0.005) }, { id: 'f2', geometri: kv(10.8, 60, 0.005) }], km);
  assert.deepEqual([...m.keys()], ['f1']); assert.equal(m.get('f1')[0].geometri, undefined);
});

test('Del med tømmerkjøper: utvalg, pakke uten eierens data, forslag, sammenligning og nedlasting', async () => {
  const TK = await import('../js/tommerkjoper.js');
  const kv = (x, y, d) => ({ type: 'Polygon', coordinates: [[[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]]] });
  const S = { eiendom: { navn: 'Testskogen', kommune: 'Løten', gnrbnr: '12/3', eier: 'Ola Nordmann' }, verdi: { rente: 3 }, bestand: [
    { id: 'b1', nr: '1', areal: 20, treslag: 'G', bonitet: 17, alder: 90, volumDaa: 30, geometri: kv(11, 60.9, 0.002), bratthet: { andel: { taubane: 0, vinsj: 0 }, ikkeDrivbar: 0, bratt: 0, snitt: 8, maks: 20 }, markfukt: { andeler: { d25: 0.3 }, vat: 0.3 }, tiltak: [{ id: 't1', type: 'sluttavvirkning', aar: 2026, status: 'planlagt' }] },
    { id: 'b2', nr: '2', areal: 10, treslag: 'F', bonitet: 11, alder: 70, volumDaa: 20, geometri: kv(11.01, 60.9, 0.002), tiltak: [{ id: 't2', type: 'tynning', aar: 2028, status: 'planlagt' }] },
    { id: 'b3', nr: '3', areal: 5, treslag: 'G', bonitet: 14, alder: 10, volumDaa: 1, miljo: true, merknad: 'Bekkekløft', tiltak: [] },
    { id: 'b4', nr: '4', areal: 5, treslag: 'G', bonitet: 14, alder: 95, volumDaa: 25, tiltak: [{ id: 't4', type: 'sluttavvirkning', aar: 2020, status: 'utfort' }] }] };
  assert.deepEqual(TK.foreslaaBestand(S, 'planlagt', { iAar: 2026 }), ['b1', 'b2']);
  assert.ok(TK.foreslaaBestand(S, 'hogstmoden', { iAar: 2026 }).includes('b4'), 'utført hogst teller ikke som planlagt, men gammel skog er hogstmoden');
  assert.ok(!TK.foreslaaBestand(S, 'hogstmoden', { iAar: 2026 }).includes('b3'), 'miljøfigur er ikke hogstmoden');
  const d = TK.nyDeling(S, { idag: '2026-11-09', kontakt: { navn: 'Ola', telefon: '900 00 000' }, iAar: 2026 });
  assert.equal(d.svarfrist, '2026-11-30'); assert.equal(d.utloper, '2027-02-07'); assert.deepEqual(d.bestand, ['b1', 'b2']);
  assert.deepEqual(TK.mangler(d), ['minst én kjøper']);
  d.mottakere = [{ id: 'k1', firma: 'Kjøper A', navn: 'Kari', epost: 'kari@a.no' }, { id: 'k2', firma: 'Kjøper B' }, { id: 'k3', firma: 'Kjøper C' }];
  d.bestand.push('b3');
  const p = TK.delingPakke(S, d, { iAar: 2026, tiltakNavn: (t) => ({ sluttavvirkning: 'Sluttavvirkning', tynning: 'Tynning' }[t]) });
  assert.equal(p.sum.bestand, 3); assert.equal(p.sum.areal, 35); assert.equal(p.sted, 'Testskogen, Løten'); assert.equal(p.gnrbnr, '12/3');
  const b1 = p.bestand.find((b) => b.nr === '1'); const b2 = p.bestand.find((b) => b.nr === '2');
  assert.equal(b1.m3, 600); assert.equal(b1.hogst.m3, 600); assert.equal(b1.hogst.navn, 'Sluttavvirkning');
  assert.equal(b2.hogst.aar, 2028); assert.ok(b2.hogst.m3 > 50 && b2.hogst.m3 < 70, `tynning tar 25 % av framskrevet volum (${b2.hogst.m3})`);
  assert.equal(b1.drift.fukt.niva, 'vat'); assert.equal(b1.drift.bratt.niva, 'lett'); assert.equal(p.bestand.find((b) => b.nr === '3').miljo, true);
  assert.equal(p.sum.salg, 600 + b2.hogst.m3, 'planlagt uttak der hogst er planlagt – miljøfiguren uten hogst selges ikke');
  assert.equal(p.sum.sortiment.gs, 360); assert.equal(p.sum.sortiment.gm, 240); assert.equal(p.sum.sortiment.lm, 0);
  const S4 = { ...S, bestand: [S.bestand[3]] }; const p4 = TK.delingPakke(S4, { ...d, bestand: ['b4'] }, { iAar: 2026 }); assert.equal(p4.sum.salg, p4.bestand[0].m3, 'uten planlagt hogst: stående volum');
  assert.equal(p.kart.length, 2);
  const json = JSON.stringify(p); for (const hemmelig of ['Ola Nordmann', 'rente', 'Kari', 'kari@', 'Kjøper A', 'Kjøper B', 'eier']) assert.ok(!json.includes(hemmelig), `deles ikke: ${hemmelig}`);
  const p2 = TK.delingPakke(S, { ...d, ta: { kart: false, drift: false, hensyn: false, eiendom: false } }, { iAar: 2026 });
  assert.equal(p2.kart.length, 0); assert.equal(p2.gnrbnr, undefined); assert.equal(p2.bestand[0].drift, undefined); assert.equal(p2.bestand[0].miljo, undefined);
  // Svar: rensing og sjekk (samme som serveren bruker)
  assert.equal(TK.sjekkSvar(TK.rensSvar({ firma: 'A' })), 'Oppgi minst én pris eller en fast sum');
  assert.equal(TK.sjekkSvar(TK.rensSvar({ priser: { gs: 500 } })), 'Oppgi firma');
  const r = TK.rensSvar({ firma: 'A', priser: { gs: '520', gm: 300, fs: -5, xx: 9 }, drift: '170', ondsinnet: '<script>' });
  assert.deepEqual(r.priser, { gs: 520, gm: 300, fs: null, fm: null, lm: null }); assert.equal(r.drift, 170); assert.equal(r.ondsinnet, undefined);
  // Netto: pris × sortiment − drift × m³; fast sum; manglende sortiment flagges
  const alle = { gs: 520, gm: 310, fs: 500, fm: 300 };
  const v = TK.vurderSvar(p, { priser: alle, drift: 170 });
  const brutto = Object.entries(alle).reduce((a, [k, x]) => a + x * p.sum.sortiment[k], 0);
  assert.equal(v.brutto, brutto); assert.equal(v.netto, brutto - 170 * p.sum.salg); assert.deepEqual(v.mangler, []);
  assert.deepEqual(TK.vurderSvar(p, { priser: { gs: 520 } }).mangler, ['Gran massevirke', 'Furu sagtømmer', 'Furu massevirke']);
  assert.equal(TK.vurderSvar(p, { priser: {}, fastSum: 200000 }).netto, 200000);
  d.svar = [{ mottakerId: 'k1', firma: 'Kjøper A', priser: alle, drift: 170, gyldigTil: '2099-01-01', mottatt: '2026-11-20T10:00:00Z' },
    { mottakerId: 'k2', firma: 'Kjøper B', priser: { ...alle, gs: 560 }, drift: 175, gyldigTil: '2026-11-10', mottatt: '2026-11-21T10:00:00Z' },
    { mottakerId: 'k3', firma: 'Kjøper C', priser: { gs: 900 }, drift: 100, mottatt: '2026-12-05T10:00:00Z' }];
  const rader = TK.sammenlign(d, p, { idag: '2026-11-25' });
  assert.equal(rader.find((x) => x.best).mottakerId, 'k1', 'B er utløpt, C mangler priser');
  assert.ok(rader.find((x) => x.mottakerId === 'k3').etterFrist); assert.ok(!rader.find((x) => x.mottakerId === 'k2').gyldig);
  TK.velgKjoper(d, 'k1', p, { idag: '2026-11-25' });
  assert.equal(d.status, 'tildelt'); assert.equal(d.valgt, 'k1'); assert.equal(d.solgt.netto, Math.round(v.netto));
  // Nedlasting og meldinger
  const c = TK.csv(p); assert.ok(c.startsWith('﻿Bestand;')); assert.equal(c.trim().split('\r\n').length, 4); assert.ok(c.includes('Bekkekløft'));
  const g = TK.geojson(p); assert.equal(g.features.length, 2); assert.equal(g.features[0].properties.bestand, '1'); assert.equal(g.features[0].properties.uttak_m3, 600);
  const t = TK.delingTekst(p, d.mottakere[0], 'https://x/tommer.html?f=1&k=2'); assert.ok(t.tekst.includes('https://x/tommer.html?f=1&k=2')); assert.match(t.tekst, /planlagt hogst 2026–2028/);
});

test('Del med tømmerkjøper på serveren: egne svarfelt, utløpsdato, visninger og stopp', async () => {
  const { lagTilbudRelay, tilbudApi, erMottakerKall } = await import('../tilbud-relay.js');
  const F = await import('../js/tommer-felles.js');
  let tid = Date.parse('2026-11-09T12:00:00Z');
  const r = lagTilbudRelay({ naa: () => tid, rens: F.rensSvar, sjekk: F.sjekkSvar });
  const { id, eier, koder } = r.opprett({ data: { tittel: 'Tømmer' }, mottakere: [{ id: 'a', navn: 'A' }, { id: 'b', navn: 'B' }], utloper: '2026-12-01' });
  assert.equal(r.vis(id, koder.a).data.tittel, 'Tømmer'); r.vis(id, koder.a);
  assert.equal(r.svar(id, koder.a, { priser: { gs: 500 } }).status, 400, 'firma mangler');
  assert.ok(r.svar(id, koder.a, { firma: 'A AS', priser: { gs: 500 }, drift: 160 }).ok);
  const sv = r.svarFor(id, eier); assert.equal(sv.svar[0].priser.gs, 500); assert.equal(sv.visninger.a.antall, 2); assert.equal(sv.visninger.b.antall, 0); assert.equal(sv.utloper, '2026-12-01');
  tid = Date.parse('2026-12-02T12:00:00Z');
  assert.equal(r.vis(id, koder.b).status, 410, 'utløpt lenke'); assert.equal(r.svar(id, koder.a, { firma: 'A', fastSum: 1 }).status, 410);
  assert.ok(r.oppdater(id, eier, { utloper: '2027-01-01' }).ok); assert.equal(r.vis(id, koder.b).data.tittel, 'Tømmer', 'forlenget');
  assert.ok(r.slett(id, eier).ok); assert.equal(r.vis(id, koder.a).status, 404, 'stoppet deling');
  // HTTP under /api/tommer, og åpne mottakerkall
  assert.ok(erMottakerKall('GET', '/api/tommer/0123456789abcdef', '/api/tommer')); assert.ok(erMottakerKall('POST', '/api/tommer/0123456789abcdef/svar', '/api/tommer'));
  assert.ok(!erMottakerKall('POST', '/api/tommer', '/api/tommer')); assert.ok(!erMottakerKall('GET', '/api/tommer/0123456789abcdef/svar', '/api/tommer')); assert.ok(!erMottakerKall('GET', '/api/tommer/0123456789abcdef', '/api/tilbud'));
  assert.ok(erMottakerKall('GET', '/api/tilbud/0123456789abcdef'));
  const kjor = (metode, url, kropp) => new Promise((ok) => { const h = {}; const req = { method: metode, url, headers: {}, on: (e, f) => { h[e] = f; if (e === 'end') setTimeout(() => { if (kropp) h.data?.(Buffer.from(JSON.stringify(kropp))); f(); }, 0); }, destroy() {} }; const res = { writeHead(s) { this.s = s; }, end(b) { ok({ status: this.s, kropp: JSON.parse(b) }); } }; assert.ok(tilbudApi(r, req, res, new URL(url, 'http://x').pathname, {}, '/api/tommer')); });
  const p = await kjor('POST', '/api/tommer', { data: { tittel: 'T' }, mottakere: [{ id: 'a', navn: 'A' }] }); assert.equal(p.status, 200);
  assert.equal((await kjor('POST', `/api/tommer/${p.kropp.id}/svar?k=${p.kropp.koder.a}`, { firma: 'A', fastSum: 100000 })).status, 200);
  assert.equal((await kjor('GET', `/api/tommer/${p.kropp.id}/svar?e=${p.kropp.eier}`)).kropp.svar[0].fastSum, 100000);
  const res0 = { writeHead() {}, end() {} }; assert.equal(tilbudApi(r, { method: 'GET', url: '/api/tilbud', headers: {} }, res0, '/api/tilbud', {}, '/api/tommer'), false);
  assert.equal(tilbudApi(r, { method: 'GET', url: '/api/tommerx', headers: {} }, res0, '/api/tommerx', {}, '/api/tommer'), false);
});

test('Driftsveg: unngår våt mark, kulturminner og bratt sideterreng, gjenbruker spor og dekker tømmeret', async () => {
  const DV = await import('../js/driftsveg.js');
  const { geoTilUtm } = await import('../js/proj.js');
  const X = 600000; const Y = 6700000;
  const kv = (x0, y0, x1, y1) => ({ type: 'Polygon', coordinates: [[[X + x0, Y + y0], [X + x1, Y + y0], [X + x1, Y + y1], [X + x0, Y + y1], [X + x0, Y + y0]]] });
  const felt = [{ geometri: kv(0, 200, 300, 500), m3: 6000 }, { geometri: kv(300, 200, 500, 400), m3: 1000 }];
  const veier = [{ type: 'LineString', coordinates: [[X - 200, Y], [X + 700, Y]] }];
  const g = DV.lagRutenett(felt.map((f) => f.geometri), veier, { celle: 10 });
  assert.equal(g.d, 10); assert.ok(g.y0 <= Y, 'rutenettet tar med bilveien');
  // Myr (y 100–140) med en tørr åpning ved x 380–420, og et kulturminne mellom veien og hogstflaten.
  const fukt = { x0: g.x0, y0: g.y0, d: g.d, nx: g.nx, ny: g.ny, k: Array.from({ length: g.nx * g.ny }, (_, k) => { const [x, y] = DV.senter(g, k); return y - Y > 100 && y - Y < 140 && !(x - X > 380 && x - X < 420) ? 'd0' : null; }) };
  const z = Array.from({ length: g.nx * g.ny }, (_, k) => { const [x, y] = DV.senter(g, k); return 100 + (x - X < 60 ? (60 - (x - X)) * 0.6 : 0) + (y - Y) * 0.05; });
  const sperret = [kv(120, 150, 160, 190)];
  const f = DV.lagForslag(g, { felt, veier, sperret, fukt, z }, {});
  assert.ok(!f.feil, f.feil); assert.equal(f.status, 'forslag');
  const pts = f.geometri.coordinates.flat().map(([lon, lat]) => geoTilUtm(lon, lat, 33)).map(([x, y]) => [x - X, y - Y]);
  assert.equal(f.stat.vaat, 0, 'krysser myra i den tørre åpningen');
  assert.ok(!pts.some(([x, y]) => x > 115 && x < 165 && y > 145 && y < 195), 'går utenom kulturminnet med sikringssone');
  assert.ok(f.stat.dekketAndel >= 90, `dekker tømmeret (${f.stat.dekketAndel} %)`);
  assert.ok(f.stat.maksSide <= DV.STANDARD.maksSide, 'sidehelling innenfor grensen');
  assert.equal(f.velteplasser.length >= 1, true);
  const rett = f.rett; assert.ok(rett.vaat > 0, 'rett linje til veien ville gått over myr');
  // Eksisterende traktorvei gjennom åpningen brukes (ingen nye inngrep der).
  const spor = [{ type: 'LineString', coordinates: [[X + 400, Y], [X + 400, Y + 300]] }];
  const f2 = DV.lagForslag(g, { felt, veier, sperret: [], fukt, z, spor }, {});
  assert.ok(f2.stat.paaSpor > 100, `bruker traktorveien (${f2.stat.paaSpor} m)`); assert.ok(f2.stat.nyttSpor < f.stat.lengde, 'mindre nytt spor');
  // Uten bilvei: feilmelding. Helt sperret: feilmelding.
  assert.match(DV.lagForslag(DV.lagRutenett(felt.map((x) => x.geometri), [], { celle: 20 }), { felt, veier: [] }).feil, /bilvei/);
  assert.match(DV.lagForslag(g, { felt, veier, sperret: [kv(-100, 150, 800, 190)] }).feil, /farbar/);
  // Offentlig veg: sporet kan ende der (og rådet nevner arbeidsvarsling), men en privat veg litt lenger unna foretrekkes.
  const fo = DV.lagForslag(g, { felt, veier: [], offentlige: veier, fukt, z }, {});
  assert.ok(fo.stat.offentligVelteplass); assert.ok(fo.rad.some((r) => /arbeidsvarslingsplan/.test(r)));
  const privat = [{ type: 'LineString', coordinates: [[X - 50, Y + 560], [X + 520, Y + 560]] }];
  const g3 = DV.lagRutenett(felt.map((x) => x.geometri), [...veier, ...privat], { celle: 10 });
  const fp = DV.lagForslag(g3, { felt, veier: privat, offentlige: veier }, {});
  assert.ok(!fp.stat.offentligVelteplass, 'privat veg nord for flatene velges framfor fylkesvegen');
  // Råd og GPX
  assert.ok(f.rad.some((r) => /kommunen/.test(r))); assert.match(DV.lagForslag(g, { felt, veier, fukt, z }, { dekning: 80 }).rad[0], /høyst 80 m/);
  const x = DV.gpx('Driftsveg 2026-1', f.geometri, f.velteplasser); assert.match(x, /<trkseg>/); assert.match(x, /Velteplass 1/);
});

test('Skiltplan: arbeidsvarsling ved velteplass, kryssing og hogst inntil offentlig veg, stier og krav', async () => {
  const SP = await import('../js/skiltplan.js');
  const X = 600000; const Y = 6700000; const P = (x, y) => [X + x, Y + y];
  const kv = (x0, y0, x1, y1) => ({ type: 'Polygon', coordinates: [[P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1), P(x0, y0)]] });
  const fv = { kategori: 'F', ref: 'FV224', linjer: [[P(-1000, 0), P(-200, 0)], [P(-200, 0), P(1000, 0)]], fartDeler: [{ fart: 80, linjer: [[P(-1000, 0), P(1000, 0)]] }] };
  const g = { felt: [kv(-100, 20, 100, 200)], velteplasser: [P(0, 10)], driftsveg: [[P(300, -100), P(300, 100)]], offentlige: [fv], stier: [[P(-400, 150), P(-50, 150)]], idag: '2026-11-09' };
  const r = SP.lagSkiltplan(g);
  assert.deepEqual(r.situasjoner.map((s) => s.type).sort(), ['hogst-ved-veg', 'kryssing', 'sti', 'velteplass']);
  // Velteplass: 110 Vegarbeid + 808 «Tømmerlasting» 200 m før i begge retninger (80 km/t), og nedsatt fart 60.
  const v = r.skilt.filter((s) => s.situasjon === 'A1' && s.skilt[0] === '110');
  assert.equal(v.length, 2); assert.equal(v[0].tekst, 'Tømmerlasting');
  const xs = v.map((s) => Math.round(SP.utmPunkt(s.punkt)[0] - X)).sort((a, b) => a - b);
  assert.ok(Math.abs(xs[0] + 200) <= 6 && Math.abs(xs[1] - 200) <= 6, `200 m hver vei langs vegen, også over skjøten mellom segmentene (${xs})`);
  assert.equal(r.skilt.filter((s) => s.situasjon === 'A1' && s.skilt[0] === '362').every((s) => s.fart === 60), true);
  // Kryssing: 156 Annen fare med «Kryssende tømmertransport».
  const k = r.skilt.filter((s) => s.skilt[0] === '156'); assert.equal(k.length, 2); assert.equal(k[0].tekst, 'Kryssende tømmertransport');
  // Sti inn i fareområdet (hogstflaten + 90 m).
  const sti = r.skilt.filter((s) => s.situasjon.startsWith('D')); assert.equal(sti.length, 1); assert.match(sti[0].tekst, /90 m/);
  assert.ok(Math.abs(SP.utmPunkt(sti[0].punkt)[0] - X + 190) < 8, 'skiltet står der stien når sikkerhetssonen');
  // Søknad og krav
  assert.equal(r.soknader.length, 1); assert.equal(r.soknader[0].myndighet, 'Statens vegvesen'); assert.match(r.soknader[0].hvordan, /Din side/);
  const krav = r.krav.map((x) => x.id); for (const id of ['plan', 'kompetanse', 'avstand3', 'skjaering', 'bunnflo', 'kryssing', 'felling', 'sti-skilt', 'sti-rydd', 'kraft', 'fjern']) assert.ok(krav.includes(id), id);
  assert.ok(r.krav.every((x) => SP.KILDER[x.kilde]), 'alle krav har kilde');
  // Kommunal veg 40 km/t: kortere avstand, kommunen søkes, ingen fartsreduksjon.
  const r2 = SP.lagSkiltplan({ ...g, driftsveg: [], stier: [], offentlige: [{ kategori: 'K', ref: 'KV1001', linjer: fv.linjer, fart: 40 }] });
  assert.equal(r2.soknader[0].myndighet, 'kommunen'); assert.ok(!r2.skilt.some((s) => s.skilt.includes('362'))); assert.equal(r2.situasjoner[0].avstand, 75);
  // Velteplass ved privat skogsbilveg, langt fra offentlig veg: ingen søknad, infoskilt.
  const r3 = SP.lagSkiltplan({ felt: [kv(-100, 1020, 100, 1200)], velteplasser: [P(0, 1010)], offentlige: [fv], private: [{ kategori: 'S', ref: 'SV12', linjer: [[P(-300, 1005), P(300, 1005)]] }], stier: [] });
  assert.equal(r3.soknader.length, 0); assert.equal(r3.situasjoner[0].type, 'velteplass-privat'); assert.match(r3.skilt[0].merknad, /kommunen/);
  assert.ok(!r3.krav.some((x) => x.id === 'plan'));
  // Avstand etter fart, og vegens ende
  // Spor som bare ender ved vegen er ingen kryssing; to velteplasser tett langs samme veg deler skiltsett.
  assert.equal(SP.krysninger([[P(300, 300), P(300, 2)]], fv.linjer).length, 0); assert.equal(SP.krysninger([[P(300, 100), P(300, -100)]], fv.linjer).length, 1);
  const r4 = SP.lagSkiltplan({ ...g, driftsveg: [], stier: [], velteplasser: [P(0, 10), P(80, 12)] });
  const a2 = r4.situasjoner.find((s) => s.id === 'A2'); assert.equal(a2.sammeSkilt, 'A1'); assert.equal(r4.skilt.filter((s) => s.skilt[0] === '110' && s.tekst === 'Tømmerlasting').length, 2);
  assert.deepEqual([30, 50, 60, 80, 90].map(SP.skiltAvstand), [75, 75, 150, 200, 250]);
  const kort = SP.langsVeg(P(0, 0), [{ linjer: [[P(-50, 0), P(400, 0)]] }], 200).map((x) => x.avstand).sort((a, b) => a - b);
  assert.ok(kort[0] <= 52 && kort[1] >= 195, `vegen slutter etter 50 m den ene veien (${kort})`);
  assert.match(SP.skiltSvg(r.skilt[0]), /<svg/); assert.match(SP.skiltTekst({ skilt: ['362'], fart: 60 }), /362 Fartsgrense 60/);
});

test('Oppdrag: arbeidsflyt med neste steg, og brukerveiledningen dekker alle hjelpelenker', async () => {
  const OP = await import('../js/oppdrag.js'); const HJ = await import('../js/hjelp.js');
  const o = { type: 'sluttavvirkning', status: 'utkast', sjekk: {} };
  let st = OP.stegFor(o);
  assert.deepEqual(st.map((x) => x.id), ['periode', 'driftsveg', 'skiltplan', 'utforer', 'bestilt', 'maskin', 'sjekk', 'utfort']);
  assert.equal(st.find((x) => x.neste).id, 'periode');
  o.periode = { fra: '2027-01-10' }; st = OP.stegFor(o);
  assert.equal(st.find((x) => x.neste).id, 'skiltplan', 'valgfri driftsveg hoppes over når neste velges');
  o.skiltplan = { status: 'beholdt' }; o.utforer = { navn: 'Hogst AS' }; o.status = 'bestilt'; st = OP.stegFor(o);
  assert.equal(st.find((x) => x.neste).id, 'sjekk'); assert.match(st.find((x) => x.id === 'sjekk').tekst, /0 av \d+/);
  for (const k of OP.typeFor('sluttavvirkning').sjekk) o.sjekk[k.id] = true; o.status = 'utfort'; st = OP.stegFor(o);
  assert.ok(!st.some((x) => x.neste), 'ferdig oppdrag har ikke neste steg');
  const p = OP.stegFor({ type: 'planting', status: 'utkast' }); assert.ok(!p.some((x) => x.id === 'driftsveg' || x.id === 'maskin')); assert.ok(p.find((x) => x.id === 'skiltplan').valgfri);
  // Hjelpelenker i kode og HTML peker til kapitler som finnes, og søket finner dem.
  const ider = new Set(HJ.KAPITLER.map((k) => k.id)); assert.equal(ider.size, HJ.KAPITLER.length);
  const filer = ['../index.html', '../js/app.js', '../js/oppdrag-ui.js', '../js/hjelp.js'].map((f) => readFileSync(new URL(f, import.meta.url), 'utf8')).join('\n');
  const brukt = [...filer.matchAll(/data-hjelp="([a-z-]+)"/g)].map((m) => m[1]);
  assert.ok(brukt.length >= 6); for (const id of brukt) assert.ok(ider.has(id), `kapittel ${id} finnes`);
  for (const id of ['tiltak', 'oppdrag', 'driftsveg', 'skiltplan', 'tilbud', 'maskin']) assert.ok(ider.has(id));
  assert.equal(HJ.sok('arbeidsvarsling')[0].id, 'skiltplan'); assert.ok(HJ.sok('stikkveg').some((k) => k.id === 'driftsveg')); assert.equal(HJ.sok('xyzzy').length, 0);
  assert.match(HJ.innholdHtml('oppdrag'), /Neste steg|neste steg/); assert.match(HJ.heleHtml('SkogIQ.ai', '1.0'), /<h2>.*Kom i gang/);
});

test('Ajourføring fra HPR: hogd flate, deling, egenskaper, tiltak, rydding, nytt bestand og angre', async () => {
  let PC = null; try { PC = (await import('polygon-clipping')).default; } catch { return; /* valgfritt i testmiljøet */ }
  const AJ = await import('../js/ajourforing.js');
  const X = 600000; const Y = 6700000; const g = (x, y) => utmTilGeo(X + x, Y + y, 33);
  const kv = (x0, y0, x1, y1) => ({ type: 'Polygon', coordinates: [[g(x0, y0), g(x1, y0), g(x1, y1), g(x0, y1), g(x0, y0)]] });
  let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const stammer = [];
  for (let i = 0; i < 2000; i++) stammer.push({ pos: g(rnd() * 100, rnd() * 200), treslag: 'G', fub: 0.25, dato: '2026-10-02' }); // flatehogst i vestre halvdel av A
  for (let i = 0; i < 600; i++) stammer.push({ pos: g(220 + rnd() * 180, rnd() * 170), treslag: 'F', fub: 0.2, dato: '2026-10-05' }); // tynning i B
  for (let i = 0; i < 400; i++) stammer.push({ pos: g(500 + rnd() * 50, rnd() * 50), treslag: 'L', fub: 0.1, dato: '2026-10-06' }); // utenfor planen
  const S = { bestand: [
    { id: 'A', nr: '6', areal: 40, treslag: 'G', bonitet: 17, alder: 90, volumDaa: 25, treantall: 60, hogstklasse: 5, geometri: kv(0, 0, 200, 200), tiltak: [{ id: 't1', type: 'sluttavvirkning', aar: 2026, status: 'planlagt' }, { id: 't2', type: 'gjodsling', aar: 2028, status: 'planlagt' }] },
    { id: 'B', nr: '7', areal: 36, treslag: 'F', bonitet: 11, alder: 60, volumDaa: 18, treantall: 90, hogstklasse: 4, geometri: kv(210, 0, 410, 180), tiltak: [{ id: 't3', type: 'tynning', aar: 2027, status: 'planlagt' }, { id: 't4', type: 'tynning', aar: 2032, status: 'planlagt' }, { id: 't5', type: 'sluttavvirkning', aar: 2050, status: 'planlagt' }] },
  ], oppdrag: [{ id: 'o1', linjer: [{ bestandId: 'A', tiltakId: 't1' }] }] };
  const hf = AJ.hogdFlate(stammer.slice(0, 2000), PC); const ha = AJ.hogdFlate(stammer.slice(0, 2000), PC).mp;
  assert.ok(hf.mp.length === 1, 'én sammenhengende hogd flate'); void ha;
  const res = AJ.lagForslag(S, stammer, PC, { iAar: 2026 });
  const [fa, fb] = res.forslag;
  assert.equal(fa.nr, '6'); assert.equal(fa.type, 'flatehogst'); assert.equal(fa.anbefalt, 'del'); assert.ok(fa.dekning > 0.45 && fa.dekning < 0.62, `dekning ${fa.dekning}`);
  assert.ok(fa.arealDel > 19 && fa.arealDel < 24 && Math.abs(fa.arealDel + fa.arealRest - 40) < 0.2, 'del + rest = bestandet');
  assert.deepEqual(AJ.egenskaper(S, fa).map((x) => x.felt), ['hogstklasse', 'alder', 'volumDaa', 'treantall']);
  assert.deepEqual(AJ.tiltakFor(fa).map((x) => `${x.handling}:${x.type}`), ['utfort:sluttavvirkning', 'ny:markberedning', 'ny:planting', 'ny:ungskogpleie']);
  // Velger brukeren «hele», ryddes også tiltak som ikke er aktuelle etter flatehogst (gjødsling).
  fa.valg = 'hele'; assert.ok(AJ.tiltakFor(fa).some((x) => x.handling === 'fjern' && x.type === 'gjodsling')); fa.valg = 'del';
  assert.equal(fb.type, 'tynning'); assert.equal(fb.anbefalt, 'hele');
  assert.deepEqual(AJ.tiltakFor(fb).map((x) => `${x.handling}:${x.type}:${x.aar}`), ['utfort:tynning:2027', 'fjern:tynning:2032'], 'sluttavvirkning 2050 beholdes');
  assert.deepEqual(AJ.egenskaper(S, fb).map((x) => [x.felt, x.etter]), [['volumDaa', 14.7], ['treantall', 73]]);
  assert.ok(res.utenfor && res.utenfor.areal > 1.5 && !res.utenfor.valgt, 'hogd flate utenfor planen foreslås, men er ikke valgt');
  // Bruker fjerner ungskogpleie, og vil ha nytt bestand av flaten utenfor.
  fa.tiltak.find((x) => x.type === 'ungskogpleie').valgt = false; res.utenfor.valgt = true;
  let n = 0; const post = AJ.anvend(S, res, { idag: '2026-11-10', nyId: (p) => `${p}${++n}` });
  const ny = S.bestand.find((b) => b.id === 'b1'); const a = S.bestand.find((b) => b.id === 'A'); const b = S.bestand.find((x) => x.id === 'B');
  assert.equal(S.bestand.length, 4); assert.equal(ny.nr, '8'); assert.equal(ny.hogstklasse, 1); assert.equal(ny.alder, 0); assert.equal(ny.volumDaa, 0);
  assert.deepEqual(ny.tiltak.map((x) => `${x.type}:${x.status}`), ['sluttavvirkning:utfort', 'markberedning:planlagt', 'planting:planlagt']);
  assert.equal(ny.tiltak[0].utfortM3, 500); assert.equal(S.oppdrag[0].linjer[0].bestandId, 'b1', 'oppdraget følger det utførte tiltaket');
  assert.equal(a.hogstklasse, 5); assert.equal(a.areal, fa.arealRest); assert.deepEqual(a.tiltak.map((x) => `${x.type}:${x.status}`).sort(), ['gjodsling:planlagt', 'sluttavvirkning:planlagt'], 'resten beholder planlagte tiltak');
  assert.equal(b.volumDaa, 14.7); assert.deepEqual(b.tiltak.map((x) => `${x.type}:${x.aar}:${x.status}`), ['tynning:2027:utfort', 'sluttavvirkning:2050:planlagt']);
  assert.ok(S.bestand.some((x) => /utenfor bestandene/.test(x.merknad || '')), 'nytt bestand av flaten utenfor');
  assert.ok(post.logg.length >= 7); assert.equal(S.ajourforinger.length, 1);
  // Kart og angre
  AJ.lagreKart(S, { id: post.id, navn: 'test.hpr', stammer, hogd: res.hogd, dato: post.dato });
  const gj = AJ.kartGeojson(S.hogstdata); assert.ok(gj.features.some((f) => f.properties.lag === 'hogd')); assert.equal(gj.features.filter((f) => f.properties.lag === 'stamme').length, 3000);
  S.oppdrag[0].status = 'utfort'; assert.match(AJ.oppsummer(res.forslag[0]), /\(\d+,\d av /, 'desimalkomma');
  assert.ok(AJ.angre(S, post.id)); assert.equal(S.oppdrag[0].status, 'pagar', 'oppdraget er ikke lenger utført'); assert.equal(S.bestand.length, 2); assert.equal(S.bestand.find((x) => x.id === 'A').areal, 40); assert.equal(S.bestand.find((x) => x.id === 'B').tiltak.length, 3);
  assert.equal(S.oppdrag[0].linjer[0].bestandId, 'A'); assert.equal(S.ajourforinger.length, 0);
  // «Ikke endre» gir ingen endringer.
  const r2 = AJ.lagForslag(S, stammer, PC, { iAar: 2026 }); for (const f of r2.forslag) f.valg = 'ingen'; AJ.anvend(S, r2, {}); assert.equal(S.bestand.find((x) => x.id === 'A').hogstklasse, 5);
});

test('Be om tilbud (enkel veiviser): kandidater per type, tiltak i aktive oppdrag holdes utenfor', async () => {
  const HT = await import('../js/tilbud-hurtig.js');
  const S = { bestand: [
    { id: 'a', nr: '2', tiltak: [{ id: 't1', type: 'sluttavvirkning', aar: 2027, status: 'planlagt' }, { id: 't2', type: 'planting', aar: 2028, status: 'planlagt' }] },
    { id: 'b', nr: '10', tiltak: [{ id: 't3', type: 'sluttavvirkning', aar: 2026, status: 'planlagt' }, { id: 't4', type: 'tynning', aar: 2026, status: 'utfort' }] },
    { id: 'c', nr: '3', tiltak: [{ id: 't5', type: 'sluttavvirkning', aar: 2026, status: 'planlagt', oppdragId: 'o1' }, { id: 't6', type: 'ungskogpleie', aar: 2030, status: 'planlagt' }] },
  ], oppdrag: [{ id: 'o1', status: 'bestilt', linjer: [{ bestandId: 'c', tiltakId: 't5' }] }] };
  const g = HT.grupper(S, 2026);
  assert.deepEqual(g.map((x) => x.type), ['sluttavvirkning', 'planting', 'ungskogpleie'], 'tidligste år først, utførte tiltak er ikke med');
  assert.deepEqual(g[0].liste.map((x) => x.bestand.nr), ['10', '2'], 'sortert på år, og tiltaket i et aktivt oppdrag er utelatt');
  S.oppdrag[0].status = 'utfort'; assert.equal(HT.grupper(S, 2026)[0].liste.length, 3, 'avsluttet oppdrag binder ikke tiltaket');
});

test('Måleverktøy: lengde, areal, omkrets og volum per bestand og treslag', async () => {
  const MA = await import('../js/maaling.js'); const MO = await import('../js/model.js');
  const X = 600000; const Y = 6700000; const g = (x, y) => utmTilGeo(X + x, Y + y, 33);
  const kv = (x0, y0, x1, y1) => ({ type: 'Polygon', coordinates: [[g(x0, y0), g(x1, y0), g(x1, y1), g(x0, y1), g(x0, y0)]] });
  const l = MA.lengde([g(0, 0), g(300, 0), g(300, 400)]); assert.ok(Math.abs(l.total - 700) < 0.5); assert.equal(l.deler.length, 2);
  const f = MA.flate([g(0, 0), g(100, 0), g(100, 100), g(0, 100)]); assert.ok(Math.abs(f.areal - 10000) < 5); assert.ok(Math.abs(f.omkrets - 400) < 0.5, 'flaten lukkes automatisk');
  assert.equal(MA.lengdeTekst(1234), '1,23 km'); assert.match(MA.arealTekst(2500), /2,5 daa/); assert.match(MA.arealTekst(150000), /15,0 ha/);
  // Treslagsandeler fra importfelt (prosent) og fra SR16-skogtype.
  assert.deepEqual(MO.treslagAndel({ G: 60, F: 30, L: 10 }), { G: 0.6, F: 0.3, L: 0.1 }); assert.equal(MO.treslagAndel({}), null);
  const nb = MO.normaliserBestand({ BESTANDNR: '1', GRAN_PST: 70, FURU_PST: 30 }, null, 10); assert.deepEqual(nb.treslagAndel, { G: 0.7, F: 0.3, L: 0 });
  let PC = null; try { PC = (await import('polygon-clipping')).default; } catch { return; /* valgfritt i testmiljøet */ }
  const S = { bestand: [
    { id: 'a', nr: '1', treslag: 'G', areal: 20, volumDaa: 20, treslagAndel: { G: 0.6, F: 0.4, L: 0 }, geometri: kv(0, 0, 200, 100) },
    { id: 'b', nr: '2', treslag: 'L', areal: 20, volumDaa: 10, geometri: kv(200, 0, 400, 100) },
    { id: 'c', nr: '3', treslag: 'F', areal: 20, volumDaa: 30, geometri: kv(0, 500, 200, 600) },
  ] };
  // Flate over halve bestand 1 (10 daa) og halve bestand 2 (10 daa), og 5 daa utenfor bestandene.
  const v = MA.volum(S, [g(100, -50), g(300, -50), g(300, 100), g(100, 100)], PC);
  assert.equal(v.rader.length, 2); assert.ok(Math.abs(v.m3 - 300) < 1, `200 + 100 m³ (${v.m3})`);
  assert.ok(Math.abs(v.perTreslag.G - 120) < 1 && Math.abs(v.perTreslag.F - 80) < 1 && Math.abs(v.perTreslag.L - 100) < 1, JSON.stringify(v.perTreslag));
  assert.ok(Math.abs(v.utenfor - 10000) < 20, 'arealet utenfor bestandene'); assert.ok(Math.abs(v.m3Daa - 15) < 0.1, 'm³/daa på skogarealet');
  assert.equal(v.fordelingKilde, 'blandet'); assert.ok(Math.abs(v.rader.find((r) => r.nr === '1').andelAvBestand - 0.5) < 0.01);
  assert.match(MA.sammendrag({ modus: 'areal', len: MA.lengde([]), fl: MA.flate([g(100, -50), g(300, -50), g(300, 100), g(100, 100)]), vol: v }), /Gran: 120 m³/);
  assert.equal(MA.volum(S, [g(0, 0), g(10, 0)], PC), null, 'for få punkter');
});

test('Treslag: fordeling med kilde, volum per treslag, registrering og treantall per treslag i hogstklasse II', async () => {
  const T = await import('../js/treslag.js'); const { normaliserBestand } = await import('../js/model.js');
  // Bare hovedtreslag → alt på det
  const b = { id: 'b1', nr: '1', treslag: 'G', bonitet: 17, areal: 10, alder: 70, volumDaa: 30, hogstklasse: 5, tiltak: [] };
  let v = T.volumPerTreslag(b); assert.equal(v.kilde, 'hovedtreslag'); assert.equal(v.rader[0].m3, 300); assert.equal(v.rader[2].m3, 0);
  // Registrert fordeling (prosent, skaleres til 100 %)
  assert.ok(T.settTreslagAndel(b, { G: '60', F: '30', L: '10' })); v = T.volumPerTreslag(b);
  assert.equal(v.kilde, 'registrert'); assert.deepEqual(v.rader.map((r) => Math.round(r.m3)), [180, 90, 30]); assert.equal(Math.round(v.rader[1].daa), 9);
  assert.ok(T.settTreslagAndel(b, { G: '2', F: '1', L: '1' })); assert.deepEqual(b.treslagAndel, { G: 0.5, F: 0.25, L: 0.25 });
  assert.equal(T.settTreslagAndel(b, { G: 'x' }), false); assert.equal(T.settTreslagAndel(b, { G: '120' }), false);
  assert.ok(T.settTreslagAndel(b, { F: '80', G: '20' })); assert.equal(T.avvikHovedtreslag(b), 'F', 'furu dominerer, men hovedtreslaget er gran');
  assert.ok(T.settTreslagAndel(b, {})); assert.equal(b.treslagAndel, undefined); assert.equal(T.fordeling(b).kilde, 'hovedtreslag');
  // Import fra plan og fra SR16
  const imp = normaliserBestand({ BESTNR: '2', TRESLAG: 'G', AREAL: 5, GRAN_PST: 70, FURU_PST: 20, LAUV_PST: 10, VOLUM_DAA: 20 }); assert.equal(T.fordeling(imp).kilde, 'import'); assert.equal(T.fordeling(imp).andel.G, 0.7);
  const sr = normaliserBestand({ BESTNR: '3', TRESLAG: 'G', AREAL: 5, GRAN_PST: 50, FURU_PST: 50, KILDE: 'SR16' }); assert.equal(T.fordeling(sr).kilde, 'sr16');
  // Rotnetto veies etter fordelingen (verdi, tiltak og rapporter bruker samme)
  const M = await import('../js/model.js'); const I = M.STANDARD_INNSTILLINGER;
  const bl = { ...b, treslagAndel: { G: 0.6, F: 0.4 } };
  assert.equal(Math.round(M.rotnettoPerM3(bl, I) * 100), Math.round((0.6 * M.rotnettoPerM3('G', I) + 0.4 * M.rotnettoPerM3('F', I)) * 100));
  assert.equal(M.rotnettoPerM3({ treslag: 'F' }, I), M.rotnettoPerM3('F', I), 'uten fordeling: hovedtreslaget');
  assert.equal(Math.round(M.hogstNettoPerM3('lukkethogst', bl, I)), Math.round(M.rotnettoPerM3(bl, I) - (I.lukketTillegg ?? 40)));
  const vb = T.volumPerTreslag(bl, I); assert.equal(Math.round(vb.netto), Math.round(vb.m3 * M.rotnettoPerM3(bl, I))); assert.equal(Math.round(vb.rader[1].netto), Math.round(vb.rader[1].m3 * M.rotnettoPerM3('F', I)));
  assert.match(T.treslagKortHtml(vb), /Gran 60 %[\s\S]*Furu 40 %/);
  // Hogstklasse II: treantall per treslag
  const u = { id: 'u', nr: '4', treslag: 'G', bonitet: 17, areal: 8, alder: 12, hogstklasse: 2, treslagAndel: { G: 0.8, F: 0.2 }, tiltak: [] };
  assert.ok(T.visTreantallTreslag(u)); assert.ok(!T.visTreantallTreslag(b));
  let d = T.treantallPerTreslag(u); assert.equal(d.for.kilde, 'beregnet'); assert.ok(d.for.L > 0 && d.for.G > d.for.F, 'gran mer enn furu etter fordelingen');
  assert.ok(Math.abs(d.for.sum - (await import('../js/ungskog.js')).ungskogData(u).treantallFor.verdi) <= 2, 'summen er treantallet før regulering');
  assert.ok(d.etter.sum <= d.maal + 1 && d.etter.G + d.etter.F >= d.etter.L, 'etter regulering: bartrærne spares');
  assert.ok(T.settTreantallTreslag(u, 'for', { G: '900', F: '100', L: '1 400' }, { idag: '2026-11-11' }));
  d = T.treantallPerTreslag(u); assert.deepEqual([d.for.G, d.for.F, d.for.L, d.for.sum, d.for.kilde], [900, 100, 1400, 2400, 'registrert']); assert.equal(u.ungskog.treantallFor, 2400);
  assert.equal(d.etter.kilde, 'beregnet'); assert.ok(d.etter.G > d.etter.F);
  assert.ok(T.settTreantallTreslag(u, 'etter', { G: 180, F: 20, L: 20 })); assert.equal(T.treantallPerTreslag(u).etter.sum, 220); assert.equal(u.ungskog.treantallEtter, 220);
  assert.equal(T.settTreantallTreslag(u, 'for', { G: '-1' }), false); assert.equal(T.settTreantallTreslag(u, 'feil', {}), false);
  // Ny total via ungskogfeltet erstatter fordelingen per treslag
  const { settUngskog } = await import('../js/ungskog.js'); settUngskog(u, 'treantallFor', '1500'); assert.equal(u.ungskog.treslagFor, undefined); assert.equal(T.treantallPerTreslag(u).for.kilde, 'fordelt'); assert.equal(T.treantallPerTreslag(u).for.sum, 1500);
  assert.ok(T.settTreantallTreslag(u, 'etter', { G: '', F: '', L: '' })); assert.equal(u.ungskog.treantallEtter, undefined);
});

test('Artsfilter: Artskart og Rødlista, livsmiljøprofil, plassering og S1–S3 per tiltak', async () => {
  const A = await import('../js/artsfilter.js');
  const grense = { type: 'Polygon', coordinates: [[[11.30, 60.80], [11.32, 60.80], [11.32, 60.81], [11.30, 60.81], [11.30, 60.80]]] };
  const b = A.boks(grense, 200); assert.ok(b[0] < 11.30 && b[1] < 60.80 && b[2] > 11.32 && b[3] > 60.81); assert.match(A.wkt(b), /^POLYGON\(\(/);
  // Falske tjenester: Artskart (2 sider) og Rødlista (id, og norsk navn for arter med nytt vitenskapelig navn)
  const obs = (id, navn, vit, sci, status, lon, lat, ekstra = {}) => ({ Id: id, Name: navn, ScientificName: vit, ScientificNameId: sci, Status: status, klass: ekstra.klass || 'Lecanoromycetes', kingdom: ekstra.kingdom || 'Fungi', East: lon, North: lat, Precision: ekstra.pres ?? '25', CollectedDate: ekstra.dato || '12.06.2021', Habitat: 'gammel granskog', ObsUrl: `https://artskart/${id}`, Behavior: ekstra.atferd || [], Collector: 'Hemmelig Person', PropertyUrls: [{ Type: 'Norsk Rødliste 2021', Url: `https://rl/${sci}` }] });
  const side0 = [obs('a', 'gubbeskjegg', 'Alectoria sarmentosa', 1, 'NT', 11.31, 60.805), obs('b', 'hønsehauk', 'Astur gentilis', 2, 'VUº', 11.311, 60.805, { klass: 'Aves', kingdom: 'Animalia' }), obs('c', 'gråmåke', 'Larus argentatus', 3, 'VU', 11.315, 60.806, { klass: 'Aves', kingdom: 'Animalia' })];
  const side1 = [obs('d', 'rynkeskinn', 'Phlebia centrifuga', 4, 'VU', 11.36, 60.84, { dato: '03.1950' }), obs('e', 'kjempebarkbille', 'Dendroctonus micans', 5, 'NT', 11.3105, 60.8051, { pres: '900' }), obs('f', 'storfugl', 'Tetrao urogallus', 6, 'NT', 11.312, 60.805, { klass: 'Aves', kingdom: 'Animalia', atferd: ['reproductive'] })];
  const RL = { 1: { id: 11, scientificNameId: 1, scientificName: 'Alectoria sarmentosa', popularName: 'gubbeskjegg', category: 'NT', speciesGroup: 'Lav', mainHabitat: ['Fastmarksskogsmark'], expertStatement: '<i>Gubbeskjegg</i> vokser på greiner av gran i gammel skog med lang kontinuitet og høy luftfuktighet.' },
    3: { id: 13, scientificNameId: 3, scientificName: 'Larus argentatus', popularName: 'gråmåke', category: 'VU', speciesGroup: 'Fugler', mainHabitat: ['Saltvannssystemer', 'Ferskvannssystemer'], expertStatement: 'Hekker ved kysten.' },
    4: { id: 14, scientificNameId: 4, scientificName: 'Phlebia centrifuga', popularName: 'rynkeskinn', category: 'VU', speciesGroup: 'Sopper', mainHabitat: ['Fastmarksskogsmark'], expertStatement: 'Vokser på læger av gran i gammel skog.' },
    5: { id: 15, scientificNameId: 5, scientificName: 'Dendroctonus micans', popularName: 'kjempebarkbille', category: 'NT', speciesGroup: 'Biller', mainHabitat: ['Fastmarksskogsmark'], expertStatement: 'Lever under barken på gamle graner.' },
    6: { id: 16, scientificNameId: 6, scientificName: 'Tetrao urogallus', popularName: 'storfugl', category: 'NT', speciesGroup: 'Fugler', mainHabitat: ['Fastmarksskogsmark', 'Våtmarkssystemer'], expertStatement: 'Storfugl hekker i eldre barskog.' } };
  const hauk = { id: 12, scientificNameId: 3853, scientificName: 'Accipiter gentilis', popularName: 'hønsehauk', category: 'VU', speciesGroup: 'Fugler', mainHabitat: ['Fastmarksskogsmark'], expertStatement: 'Hekker i eldre skog.' };
  const kall = [];
  const hent = async (url) => { kall.push(url); const u = new URL(url);
    if (url.startsWith(A.ARTSKART)) { const s = Number(u.searchParams.get('pageIndex')); assert.equal(u.searchParams.get('filter.status'), 'CR,EN,VU,NT,DD'); return { ok: true, json: async () => ({ TotalCount: 6, TotalPages: 2, Observations: s === 0 ? side0 : side1 }) }; }
    const f = u.searchParams.get('$filter'); assert.match(f, /assessmentArea eq 'N'/);
    if (/scientificNameId in/.test(f)) { const ider = f.match(/in \(([^)]+)\)/)[1].split(',').map(Number); return { ok: true, json: async () => ({ value: ider.map((i) => RL[i]).filter(Boolean) }) }; }
    if (/popularName in/.test(f)) return { ok: true, json: async () => ({ value: /hønsehauk/.test(f) ? [hauk] : [] }) };
    return { ok: false, status: 400 }; };
  const d = await A.hentForEiendom(grense, { hent, naa: () => new Date('2026-11-13T10:00:00Z') });
  assert.equal(d.funn.length, 6); assert.ok(!JSON.stringify(d).includes('Hemmelig Person'), 'innsamlerens navn lagres ikke');
  assert.equal(d.funn[1].status, 'VU', 'tegn bak kategorien fjernes'); assert.equal(d.funn[5].hekking, true); assert.equal(d.funn[3].aar, 1950);
  assert.equal(d.arter[2].navn, 'hønsehauk', 'nytt vitenskapelig navn → slått opp på norsk navn'); assert.ok(kall.some((k) => /popularName/.test(decodeURIComponent(k))));
  assert.match(d.arter[1].tekst, /^Gubbeskjegg vokser/, 'HTML fjernet');
  // Profil
  const pg = A.profil(d.arter[1]); assert.ok(pg.skog && pg.skogHoved && pg.trekk.includes('gammel') && pg.trekk.includes('epifytt') && pg.treslag.includes('G'));
  assert.ok(A.profil(d.arter[5]).trekk.includes('dodved') === false && A.profil(d.arter[4]).trekk.includes('dodved'));
  assert.equal(A.profil(d.arter[3]).skog, false); assert.ok(A.profil(d.arter[6]).mobil && A.profil(d.arter[6]).trekk.includes('hekker'));
  // Plassering
  assert.equal(A.plassering({ lon: 11.31, lat: 60.805, presisjon: 25 }, grense).sted, 'i');
  assert.equal(A.plassering({ lon: 11.31, lat: 60.805, presisjon: 900 }, grense).sted, 'kanskje');
  const naer = A.plassering({ lon: 11.3215, lat: 60.805, presisjon: 10 }, grense); assert.equal(naer.sted, 'naer'); assert.ok(naer.avstand > 50 && naer.avstand < 120);
  // Vurdering per tiltak
  const best = { id: 'b', nr: '1', treslag: 'G', bonitet: 17, alder: 110, hogstklasse: 5, areal: 20, geometri: grense, tiltak: [{ type: 'sluttavvirkning', status: 'planlagt', aar: 2027 }, { type: 'groftrensk', status: 'planlagt', aar: 2027 }, { type: 'tynning', status: 'utfort', aar: 2010 }] };
  const v = A.vurderBestand(d, best, { iAar: 2026 }); assert.deepEqual(v.tiltak.map((t) => t.type), ['sluttavvirkning', 'groftrensk'], 'bare planlagte tiltak');
  const s = Object.fromEntries(v.tiltak[0].arter.map((a) => [a.navn, a]));
  assert.equal(s.gubbeskjegg.niva, 'S1'); assert.match(s.gubbeskjegg.grunner.join(' '), /gammel skog.*sårbar for hogst/);
  assert.equal(s.gråmåke.niva, 'S3'); assert.match(s.gråmåke.grunner.join(' '), /lever ikke i skog/);
  assert.equal(s.hønsehauk.niva, 'S2', 'mobil art uten hekking i bestandet'); assert.match(s.hønsehauk.grunner.join(' '), /mobil art/);
  assert.equal(s.storfugl.niva, 'S1', 'hekking registrert i bestandet'); assert.match(s.storfugl.grunner.join(' '), /hekketida/);
  assert.equal(s.kjempebarkbille.funn[0].sted, 'kanskje');
  assert.ok(!s.rynkeskinn, 'funn over 1 km unna tas ikke med');
  assert.equal(v.tiltak[1].arter.find((a) => a.navn === 'gubbeskjegg').niva, 'S2', 'grøfting påvirker gubbeskjegg mindre enn hogst');
  // Ungskog: arten trenger gammel skog, gammelt funn → ned ett nivå
  const ung = { ...best, hogstklasse: 2, alder: 12, tiltak: [{ type: 'sluttavvirkning', status: 'planlagt' }] };
  const dGammel = { ...d, funn: d.funn.map((f) => (f.sciId === 1 ? { ...f, aar: 1990 } : f)) };
  assert.match(A.vurderBestand(dGammel, ung, { iAar: 2026 }).tiltak[0].arter.find((a) => a.navn === 'gubbeskjegg').grunner.join(' '), /hogstklasse 2/);
  // Uten planlagte tiltak vurderes sluttavvirkning; lenker
  assert.equal(A.vurderBestand(d, { ...best, tiltak: [] }).tiltak[0].antatt, true);
  assert.ok(A.lenker(s.gubbeskjegg).some((l) => /scholar/.test(l.url)) && A.lenker(s.gubbeskjegg)[0].url === 'https://artsdatabanken.no/lister/rodlisteforarter/2021/11');
  assert.deepEqual(A.vurderBestand(null, best).antall, { S1: 0, S2: 0, S3: 0 });
});

test('Tilbud til nettverket: bare koblede mottakere, innboks med status, varsel i chatten, og lenke for de andre', async () => {
  const { lagTilbudRelay, tilbudApi } = await import('../tilbud-relay.js'); const { lagNettverk } = await import('../nettverk.js'); const TN = await import('../js/tilbud-nettverk.js');
  const B = { 'ola@x.no': { navn: 'ola@x.no', visning: 'Ola Skog', profil: { roller: ['skogeier'] } }, 'kari@x.no': { navn: 'kari@x.no', visning: 'Kari', profil: { roller: ['innkjoper'], foretak: 'Tømmer AS' } }, 'per@x.no': { navn: 'per@x.no', visning: 'Per', profil: { roller: ['entreprenor'] } } };
  let tid = Date.UTC(2026, 10, 16, 9); const n = lagNettverk({ brukere: { hent: (u) => B[u] || null, alle: () => Object.values(B) }, naa: () => tid });
  const k = n.be('ola@x.no', { til: 'kari@x.no', rolle: 'innkjoper' }); n.svar('kari@x.no', k.kobling, 'godta');
  assert.equal(n.koblingMellom('ola@x.no', 'kari@x.no'), k.kobling); assert.equal(n.koblingMellom('kari@x.no', 'ola@x.no'), k.kobling); assert.equal(n.koblingMellom('ola@x.no', 'per@x.no'), null);
  const relay = lagTilbudRelay({ naa: () => tid }); const varsler = [];
  const ctx = (bruker) => ({ bruker: () => (bruker ? { bruker, navn: B[bruker]?.visning } : null), koblet: (a, b) => !!n.koblingMellom(a, b), varsle: (a, b, d) => { varsler.push([a, b, d.tittel]); const kid = n.koblingMellom(a, b); if (kid) n.send(a, kid, `📨 Ny tilbudsforespørsel: ${d.tittel}`); } });
  const kjor = (metode, url, bruker, kropp) => new Promise((ok) => { const h = {}; const req = { method: metode, url, headers: {}, on: (e, f) => { h[e] = f; if (e === 'end') setTimeout(() => { if (kropp) h.data?.(Buffer.from(JSON.stringify(kropp))); f(); }, 0); }, destroy() {} }; const res = { writeHead(st) { this.s = st; }, end(b) { ok({ status: this.s, d: JSON.parse(b) }); } }; tilbudApi(relay, req, res, new URL(url, 'http://x').pathname, {}, '/api/tilbud', ctx(bruker)); });
  const data = { tittel: 'Sluttavvirkning bestand 3 og 7', typeNavn: 'Sluttavvirkning', sted: 'Løten', svarfrist: '2026-11-30', omfang: { bestand: [{ nr: '3', areal: 12.5 }, { nr: '7', areal: 8 }] }, kontakt: { navn: 'Ola' } };
  // Per er ikke koblet til Ola → kan ikke være nettverksmottaker (bare lenke)
  const r = await kjor('POST', '/api/tilbud', 'ola@x.no', { data, mottakere: [{ id: 'm1', navn: 'Tømmer AS', bruker: 'KARI@x.no' }, { id: 'm2', navn: 'Per', bruker: 'per@x.no' }, { id: 'm3', navn: 'Ekstern AS' }] });
  assert.equal(r.status, 200); assert.deepEqual(r.d.nettverk, ['kari@x.no'], 'bare koblede brukere godtas');
  assert.deepEqual(varsler.map((v) => v[1]), ['kari@x.no']); assert.equal(n.oversikt('kari@x.no').ulest, 1, 'melding i chatten'); assert.match(n.meldinger('kari@x.no', k.kobling).meldinger.at(-1).tekst, /Ny tilbudsforespørsel: Sluttavvirkning/);
  // Innboks
  assert.equal((await kjor('GET', '/api/tilbud/innboks', null)).status, 401);
  let inn = (await kjor('GET', '/api/tilbud/innboks', 'kari@x.no')).d.innboks; assert.equal(inn.length, 1);
  assert.deepEqual([inn[0].tittel, inn[0].fra, inn[0].bestand, inn[0].areal, inn[0].status, inn[0].apnet, inn[0].svart], ['Sluttavvirkning bestand 3 og 7', 'Ola Skog', 2, 20.5, 'sendt', null, null]);
  assert.equal((await kjor('GET', '/api/tilbud/innboks', 'per@x.no')).d.innboks.length, 0, 'Per får den ikke i innboksen');
  // Kari åpner med koden fra innboksen og svarer
  assert.equal(relay.vis(inn[0].id, inn[0].kode).data.tittel, data.tittel);
  assert.ok(relay.svar(inn[0].id, inn[0].kode, { pris: 120000, prisform: 'fast' }).ok);
  inn = relay.innboks('kari@x.no'); assert.ok(inn[0].apnet && inn[0].svart);
  // Tildelt Kari → «Du fikk oppdraget»
  const m1 = Object.values(relay.innboks('kari@x.no'))[0]; relay.oppdater(r.d.id, r.d.eier, { status: 'tildelt', mottakere: { valgt: 'm1' } }); assert.equal(relay.innboks('kari@x.no')[0].vunnet, true);
  // Legg til en nettverksmottaker senere (PUT) gir varsel bare til den nye
  const p2 = n.be('per@x.no', { til: 'ola@x.no', rolle: 'entreprenor' }); n.svar('ola@x.no', p2.kobling, 'godta'); varsler.length = 0;
  const r2 = await kjor('POST', '/api/tilbud', 'ola@x.no', { data: { ...data, tittel: 'Planting' }, mottakere: [{ id: 'a', navn: 'Kari', bruker: 'kari@x.no' }] });
  const pu = await kjor('PUT', `/api/tilbud/${r2.d.id}?e=${r2.d.eier}`, 'ola@x.no', { mottakere: [{ id: 'b', navn: 'Per', bruker: 'per@x.no' }] }); assert.deepEqual(pu.d.nettverk, ['per@x.no']); assert.deepEqual(varsler.map((v) => v[1]), ['kari@x.no', 'per@x.no']);
  assert.equal(relay.innboks('per@x.no')[0].tittel, 'Planting');
  // Uten innlogging (lenke-mottakere og tømmerdeling): ingen nettverksmottakere
  const r3 = relay.opprett({ data, mottakere: [{ id: 'z', navn: 'X', bruker: 'kari@x.no' }] }); assert.deepEqual(r3.nettverk, []);
  // Klientens hjelpere
  assert.equal(TN.passerRolle('sluttavvirkning'), 'innkjoper'); assert.equal(TN.passerRolle('planting'), 'entreprenor');
  const mt = TN.somMottaker({ bruker: 'kari@x.no', navn: 'Kari', foretak: 'Tømmer AS' }, (p) => `${p}1`); assert.deepEqual([mt.bruker, mt.firma, mt.epost, mt.nettverk], ['kari@x.no', 'Tømmer AS', '', true]);
});

test('Tilbud: svar i appen, «ikke aktuelt», beskjed til skogeieren og påminnelse før fristen', async () => {
  const { lagTilbudRelay, tilbudApi, erMottakerKall } = await import('../tilbud-relay.js');
  let tid = Date.UTC(2026, 10, 16, 9); const relay = lagTilbudRelay({ naa: () => tid });
  const ctx = { fra: { bruker: 'ola@x.no', navn: 'Ola' }, koblet: (a, b) => b !== 'ekstern@x.no' };
  const data = { tittel: 'Planting bestand 4', typeNavn: 'Planting', sted: 'Løten', svarfrist: '2026-11-20', enhet: 'planter' };
  const r = relay.opprett({ data, mottakere: [{ id: 'k', navn: 'Kari', bruker: 'kari@x.no' }, { id: 'p', navn: 'Per', bruker: 'per@x.no' }, { id: 'e', navn: 'Ekstern AS' }] }, ctx);
  const kode = (u) => relay.innboks(u)[0].kode;
  assert.ok(erMottakerKall('POST', `/api/tilbud/${r.id}/avslag`)); assert.ok(!erMottakerKall('PUT', `/api/tilbud/${r.id}/avslag`));
  // Påminnelse: ikke før to dager før fristen, deretter én gang per mottaker som ikke har svart
  assert.deepEqual(relay.paminnelser(), []);
  tid = Date.UTC(2026, 10, 18, 9);
  // Kari svarer, Per takker nei
  const sv = relay.svar(r.id, kode('kari@x.no'), { prisform: 'fast', pris: 50000, firma: 'Plant AS' });
  assert.deepEqual([sv.varsel.type, sv.varsel.fra, sv.varsel.til, sv.varsel.firma, sv.varsel.pris], ['svar', 'kari@x.no', 'ola@x.no', 'Plant AS', 50000]);
  assert.equal(relay.svar(r.id, kode('kari@x.no'), { prisform: 'fast', pris: 48000, firma: 'Plant AS' }).varsel.type, 'endret');
  assert.equal(relay.avslaa(r.id, kode('kari@x.no'), { grunn: 'x' }).status, 409, 'har allerede gitt tilbud');
  const av = relay.avslaa(r.id, kode('per@x.no'), { grunn: 'Full ordrebok i desember' });
  assert.deepEqual([av.varsel.type, av.varsel.grunn], ['avslag', 'Full ordrebok i desember']);
  assert.equal(relay.vis(r.id, kode('per@x.no')).avslag.grunn, 'Full ordrebok i desember');
  assert.ok(relay.innboks('per@x.no')[0].avslatt);
  assert.deepEqual(relay.paminnelser(), [], 'ingen påminnelse når alle i nettverket har svart eller takket nei');
  // Skogeierens «nye svar», og sett=1 fjerner dem
  let ny = relay.nyeSvar('ola@x.no'); assert.equal(ny.length, 1); assert.equal(ny[0].svar[0].pris, 48000); assert.equal(ny[0].avslag[0].navn, 'Per');
  assert.deepEqual(relay.nyeSvar('kari@x.no'), []);
  const sf = relay.svarFor(r.id, r.eier); assert.equal(sf.avslag[0].mottakerId, 'p'); assert.equal(relay.nyeSvar('ola@x.no').length, 1, 'stille henting fjerner ikke merket');
  relay.svarFor(r.id, r.eier, { sett: true }); assert.deepEqual(relay.nyeSvar('ola@x.no'), []);
  // Per ombestemmer seg: tilbud opphever avslaget
  tid += 60000; relay.svar(r.id, kode('per@x.no'), { prisform: 'fast', pris: 52000 }); assert.equal(relay.svarFor(r.id, r.eier).avslag.length, 0); assert.equal(relay.nyeSvar('ola@x.no')[0].svar[0].navn, 'Per');
  // Påminnelse til den som verken har svart eller takket nei
  const r2 = relay.opprett({ data: { ...data, tittel: 'Hogst', svarfrist: '2026-11-20' }, mottakere: [{ id: 'k', navn: 'Kari', bruker: 'kari@x.no' }, { id: 'e', navn: 'Ekstern' }] }, ctx);
  const p = relay.paminnelser(); assert.deepEqual(p.map((x) => [x.fra, x.til, x.tittel]), [['ola@x.no', 'kari@x.no', 'Hogst']]);
  assert.deepEqual(relay.paminnelser(), [], 'bare én påminnelse');
  // HTTP: avslag via åpent kall gir svarVarsel, og varselet sendes ikke til klienten
  const varsler = [];
  const kjor = (url, kropp) => new Promise((ok) => { const h = {}; const req = { method: 'POST', url, headers: {}, on: (e, f) => { h[e] = f; if (e === 'end') setTimeout(() => { h.data?.(Buffer.from(JSON.stringify(kropp))); f(); }, 0); }, destroy() {} }; const res = { writeHead(st) { this.s = st; }, end(b) { ok({ status: this.s, d: JSON.parse(b) }); } }; tilbudApi(relay, req, res, new URL(url, 'http://x').pathname, {}, '/api/tilbud', null, (v) => varsler.push(v)); });
  const h = await kjor(`/api/tilbud/${r2.id}/avslag?k=${relay.innboks('kari@x.no').find((x) => x.tittel === 'Hogst').kode}`, { grunn: 'For langt unna' });
  assert.equal(h.status, 200); assert.equal(h.d.varsel, undefined); assert.deepEqual(varsler.map((v) => [v.type, v.til, v.grunn]), [['avslag', 'ola@x.no', 'For langt unna']]);
  assert.equal((await kjor(`/api/tilbud/${r2.id}/avslag?k=feil`, {})).status, 404);
  // Svarsiden kan vises i appen og gir beskjed til appen
  const { readFileSync: les } = await import('node:fs'); const js = les(new URL('../js/tilbud-svar.js', import.meta.url), 'utf8');
  assert.match(js, /postMessage\(\{ skogiq: 'tilbud'/); assert.match(js, /\/avslag\?k=/);
});

test('Stolpepotensial: furu med høyde, diameter, sakte vekst og alder; gran telles ikke; anslag, feltsjekk og melding', async () => {
  const ST = await import('../js/stolpe.js'); const { lagDemo } = await import('../js/demo.js');
  const base = { id: 'b1', nr: '7', areal: 20, treslag: 'F', bonitet: 11, alder: 110, hogstklasse: 5, volumDaa: 25, treantall: 60, hoyde: 19, ekstra: { OVERHOYDE: 21.5, MIDDELDIAMETER: 27, FURU_PST: 90 }, tiltak: [] };
  const topp = ST.stolpeScore(base, { avstandVei: 120 });
  assert.equal(topp.stjerner, 5, JSON.stringify(topp)); assert.ok(topp.grunner.some((g) => /21,5 m \(SR16\)/.test(g)) && topp.grunner.some((g) => /27 cm/.test(g)) && topp.grunner.some((g) => /F11: sakte vekst/.test(g)));
  // Gran telles ikke, heller ikke blandingsskog med lite furu
  assert.match(ST.stolpeScore({ ...base, treslag: 'G', ekstra: { ...base.ekstra, FURU_PST: 10 }, treslagAndel: { G: 0.9, F: 0.1 } }).uegnet, /For lite furu/);
  assert.match(ST.stolpeScore({ ...base, treslag: 'G', ekstra: { OVERHOYDE: 22 } }).uegnet, /Ikke furu/);
  // For lav, for ung, miljøfigur
  assert.match(ST.stolpeScore({ ...base, ekstra: { ...base.ekstra, OVERHOYDE: 14 } }).uegnet, /For lave trær/);
  assert.match(ST.stolpeScore({ ...base, alder: 40, hogstklasse: 3 }).uegnet, /for unge/);
  assert.match(ST.stolpeScore({ ...base, miljo: true }).uegnet, /Miljøfigur/);
  // Høy bonitet (rask vekst) og tynne trær trekker ned; lang vei litt
  assert.ok(ST.stolpeScore({ ...base, bonitet: 20 }).score < topp.score * 0.5);
  assert.ok(ST.stolpeScore({ ...base, ekstra: { ...base.ekstra, MIDDELDIAMETER: 16 } }).stjerner <= 2);
  assert.ok(ST.stolpeScore(base, { avstandVei: 1500 }).score < ST.stolpeScore(base, { avstandVei: 100 }).score);
  // Diameter beregnet fra middeltreet når SR16 mangler: 25 m³/daa / 60 trær ≈ 0,42 m³ per tre ved 19 m → ca. 25 cm
  const d = ST.middeldiameter({ ...base, ekstra: {} }); assert.equal(d.kilde, 'beregnet'); assert.ok(d.verdi > 22 && d.verdi < 28, `${d.verdi}`);
  // Anslag: 5–10 % av furutrærne (20 daa × 60 × 0,9 = 1080 trær → 54–108 stolper), merverdi mot furu-tømmerpris
  const a = ST.stolpeAnslag(base, topp); assert.deepEqual(a.stolper, { min: 54, maks: 108 }); assert.ok(a.m3.maks > a.m3.min && a.merverdi.maks > 0);
  // Feltsjekk: alle krav må være oppfylt
  const regs = [{ kategori: 'Stolpetre', bestandId: 'b1', stolpe: { antall: 3, sjekk: { rett: true, kvist: true, rate: true, dim: true } } }, { kategori: 'Stolpetre', bestandId: 'b1', stolpe: { antall: 2, sjekk: { rett: true } } }, { kategori: 'Observasjon', bestandId: 'b1' }];
  assert.deepEqual([ST.feltStolper(regs, 'b1').antall, ST.feltStolper(regs, 'b1').godkjent, ST.feltStolper(regs, 'b2').antall], [5, 3, 0]);
  // Melding til stolpekjøper
  const t = ST.befaringTekst([{ b: base, ...topp, anslag: a }], { eiendom: 'Skogli', kommune: 'Løten', navn: 'Ola' });
  assert.match(t.emne, /Stolpebefaring – Skogli/); assert.match(t.tekst, /Bestand 7: ★★★★★/); assert.match(t.tekst, /54–108 stolper/); assert.doesNotMatch(t.tekst, /Scanpole|WOPAS/);
  // Demoen har ett furubestand med potensial
  const l = ST.toppliste(lagDemo(2026).bestand); assert.ok(l.length >= 1 && l.every((x) => ST.furuAndel(x.b) >= 0.6));
  // Kjøpere nevnes ikke ved navn i appen
  const { readFileSync: les } = await import('node:fs'); for (const f of ['../js/stolpe.js', '../js/stolpe-ui.js']) assert.doesNotMatch(les(new URL(f, import.meta.url), 'utf8').replace(/https?:\/\/\S+/g, ''), /Scanpole|WOPAS/, f);
});

test('Landbrukstakst: delverdier (skog 4 %, jord, bygninger, rettigheter, boverdi), varianter, priskontroll og konsesjonsplikt', async () => {
  const LT = await import('../js/landbrukstakst.js'); const { lagDemo } = await import('../js/demo.js');
  // Bygninger: kostnadsverdi med fradrag for alder, tilstand og bruksverdi; skjønn overstyrer
  const hus = LT.bygningsverdi({ type: 'vaaningshus', bta: 214, byggeaar: 1960, renovert: 2008 }, 2026);
  assert.equal(hus.alder, 34); assert.equal(hus.verdi, Math.round((214 * 22000 * (1 - 34 / 80)) / 1000) * 1000);
  assert.ok(LT.bygningsverdi({ type: 'driftsbygning', bta: 500, byggeaar: 2000, bruksverdi: 'ingen' }, 2026).verdi < LT.bygningsverdi({ type: 'driftsbygning', bta: 500, byggeaar: 2000 }, 2026).verdi * 0.2);
  assert.equal(LT.bygningsverdi({ type: 'lager', bta: 100, byggeaar: 1900 }, 2026).rest, 0.1, 'restverdi aldri under 10 %');
  const ukj = LT.bygningsverdi({ type: 'vaaningshus', bta: 100 }, 2026); assert.deepEqual([ukj.rest, ukj.ukjentAar, ukj.verdi], [0.5, true, 1100000], 'ukjent byggeår: 50 % restverdi');
  assert.deepEqual([LT.bygningsverdi({ type: 'lager', bta: 100, skjonn: 123456 }).verdi, LT.bygningsverdi({ type: 'lager', skjonn: 5000 }).skjonn], [123000, true]);
  // Arealer fra AR5 (fulldyrka/overflatedyrka/innmarksbeite) og overstyring
  const S = { ...lagDemo(2026), markslag: [{ kategori: 'jordbruk', areal: 40, ar5: { artype: 'Fulldyrka jord' } }, { kategori: 'jordbruk', areal: 5, ar5: { artype: 'Overflatedyrka jord' } }, { kategori: 'jordbruk', areal: 3, ar5: { artype: 'Innmarksbeite' } }, { kategori: 'myr', areal: 10 }] };
  let a = LT.arealer(S); assert.deepEqual([a.full, a.overflate, a.beite, a.myr, a.dyrka], [40, 5, 3, 10, 45]);
  S.takst = { arealer: { full: 30 } }; a = LT.arealer(S); assert.deepEqual([a.full, a.fraPlan.full, a.dyrka], [30, 40, 35]);
  // Hele beregningen
  S.takst = { arealer: {}, jord: { full: 140, overflate: 90, beite: 40, rasjonalisering: 50 }, bygninger: [{ id: 'g1', type: 'vaaningshus', bta: 200, byggeaar: 1990 }, { id: 'g2', type: 'driftsbygning', bta: 400, byggeaar: 2010 }], rettigheter: [{ id: 'j', navn: 'Jakt', aarlig: 2000, belop: 0 }, { id: 'f', navn: 'Fiske', aarlig: 0, belop: 20000 }], boverdi: 2000000, borett: 100000, asetefradrag: 20 };
  const r = LT.beregnTakst(S, { iAar: 2026 }); const del = (id) => r.deler.find((d) => d.id === id);
  assert.ok(del('skog').verdi > 0 && /4 %/.test(del('skog').metode));
  assert.equal(del('full').perDaa, Math.round((140 / 0.04) * 1.5)); assert.equal(del('full').verdi, Math.round((40 * 140 / 0.04 * 1.5) / 1000) * 1000);
  assert.equal(del('j').verdi, 50000, 'jakt 2000 kr/år ÷ 4 %'); assert.equal(del('f').verdi, 20000);
  assert.equal(del('boverdi').verdi, LT.BOVERDI_MAKS, 'boverdi høyst 1,5 mill.'); assert.equal(del('borett').verdi, -100000);
  assert.equal(r.sum, r.deler.reduce((s, d) => s + d.verdi, 0));
  assert.equal(r.varianter.konsesjon.verdi, Math.round(r.sum / 10000) * 10000); assert.equal(r.varianter.odel.verdi, r.varianter.konsesjon.verdi);
  assert.equal(r.varianter.asete.verdi, Math.round(((r.sum - LT.BOVERDI_MAKS) * 0.8) / 10000) * 10000, 'åsete: uten boverdi, 20 % fradrag');
  assert.ok(r.varianter.asete.verdi < r.varianter.odel.verdi);
  // Priskontroll og konsesjonsplikt
  assert.equal(r.priskontroll.svar, 'ja'); assert.equal(r.konsesjonsplikt.plikt, true); assert.match(r.konsesjonsplikt.boplikt, /boplikt/);
  assert.equal(LT.priskontroll({ dyrka: 50, beite: 0, produktiv: 0 }, { harBolig: true, verdi: 3000000 }).svar, 'nei', 'under 3,5 mill. med bolighus');
  assert.equal(LT.priskontroll({ dyrka: 20, beite: 0, produktiv: 100 }, { harBolig: true, verdi: 9e6 }).svar, 'nei');
  assert.equal(LT.priskontroll({ dyrka: 10, beite: 0, produktiv: 0 }, { harBolig: false, verdi: 1e6 }).svar, 'ja', 'ubebygd med dyrka jord');
  // § 9 a fra 1. juli 2025: ubebygd alltid (også ren skog), bebygd over 35 daa dyrka eller over 500 daa produktiv skog
  assert.equal(LT.priskontroll({ dyrka: 0, beite: 0, produktiv: 80 }, { harBolig: false, verdi: 5e5 }).svar, 'ja', 'ubebygd ren skog, uansett størrelse');
  assert.match(LT.priskontroll({ dyrka: 0, beite: 0, produktiv: 80 }, { harBolig: false, verdi: 5e5 }).merknad, /forhåndsuttalelse.*§ 15 a/);
  assert.equal(LT.priskontroll({ dyrka: 10, beite: 0, produktiv: 600 }, { harBolig: true, verdi: 6e6 }).svar, 'ja', 'bebygd med over 500 daa skog');
  assert.equal(LT.priskontroll({ dyrka: 10, beite: 0, produktiv: 400 }, { harBolig: true, verdi: 6e6 }).svar, 'nei');
  assert.equal(LT.priskontroll({ dyrka: 0, beite: 0, produktiv: 600 }, { harBolig: true, verdi: 3e6 }).svar, 'nei', 'brukbart bolighus under 3,5 mill.');
  assert.equal(LT.konsesjonsplikt({ total: 90, dyrka: 30, produktiv: 50 }, { harBolig: true }).plikt, false);
  assert.equal(LT.konsesjonsplikt({ total: 90, dyrka: 30, produktiv: 50 }, { harBolig: false }).plikt, true, 'ubebygd er konsesjonspliktig');
  // Skog som i takstpraksis: utnyttelse, faste kostnader og fordeling av hogstmoden skog trekker ned – og normalskog av
  // god middels bonitet (G14) havner rundt Glommen Mjøsens nivå (ca. 4 000 kr/daa ved 4 %)
  const M2 = await import('../js/model.js');
  const normal = (h) => ({ bestand: Array.from({ length: M2.STANDARD_INNSTILLINGER.hogstalder.G[h] }, (_, i) => ({ id: `n${i}`, nr: String(i), treslag: 'G', bonitet: h, alder: i + 1, areal: 1 })), innstillinger: M2.STANDARD_INNSTILLINGER });
  const g14 = LT.skogTakst(normal(14), {}, { iAar: 2026 }); assert.ok(g14.info.perDaa > 3300 && g14.info.perDaa < 4500, `${g14.info.perDaa}`);
  const ren = LT.skogTakst(normal(14), { utnyttelse: 100, fasteKostnader: 0, fordelingAar: 1 }, { iAar: 2026 }); assert.ok(ren.verdi > g14.verdi * 1.3, 'uten takstjusteringer blir verdien klart høyere');
  assert.ok(LT.skogTakst(normal(8), {}, { iAar: 2026 }).info.perDaa < LT.skogTakst(normal(20), {}, { iAar: 2026 }).info.perDaa / 4);
  const dm = lagDemo(2026); const d0 = LT.skogTakst(dm, {}, { iAar: 2026 }); const d1 = LT.skogTakst(dm, { fordelingAar: 1 }, { iAar: 2026 });
  assert.ok(d0.info.fordelingAar > 1 && d0.verdi < d1.verdi, 'hogstmoden skog fordelt over flere år gir lavere verdi'); assert.match(d0.metode, /80 % utnyttelse.*fordelt over \d+ år.*faste kostnader 10 kr\/daa/);
  assert.equal(LT.skogTakst(dm, { fasteKostnader: 20 }, { iAar: 2026 }).info.faste, Math.round(20 * dm.bestand.reduce((s0, b) => s0 + b.areal, 0) / 0.04));
  assert.ok(d0.info.utenJustering > d0.verdi * 1.2, 'uten justeringer (100 % utnyttelse, ingen fordeling eller faste kostnader)');
  // Uten takstdata: standardverdier, ingen bygninger
  const r0 = LT.beregnTakst(lagDemo(2026), { iAar: 2026 }); assert.ok(r0.sum > 0 && r0.deler.every((d) => d.gruppe === 'skog'));
});

test('Bygninger fra Kartverket: matrikkelpunkt, grunnflate fra FKB-kartet, BTA-anslag og sammenslåing i taksten', async () => {
  const B = await import('../js/bygninger.js');
  const xml = `<wfs:FeatureCollection><wfs:member><app:Bygning><app:bygningsnummer>101</app:bygningsnummer><app:bygningstype>113</app:bygningstype><app:bygningsstatus>TB</app:bygningsstatus><app:harSefrakminne>true</app:harSefrakminne><gml:pos>60.835 11.310</gml:pos></app:Bygning></wfs:member>
    <wfs:member><app:Bygning><app:bygningsnummer>102</app:bygningsnummer><app:bygningstype>241</app:bygningstype><app:bygningsstatus>FA</app:bygningsstatus><app:harSefrakminne>false</app:harSefrakminne><gml:pos>60.8351 11.3101</gml:pos></app:Bygning></wfs:member>
    <wfs:member><app:Bygning><app:bygningsnummer>103</app:bygningsnummer><app:bygningstype>111</app:bygningstype><app:bygningsstatus>RA</app:bygningsstatus><gml:pos>60.8352 11.3102</gml:pos></app:Bygning></wfs:member>
    <wfs:member><app:Bygning><app:bygningsnummer>104</app:bygningsnummer><app:bygningstype>181</app:bygningstype><app:bygningsstatus>TB</app:bygningsstatus><gml:pos>61.5 11.9</gml:pos></app:Bygning></wfs:member></wfs:FeatureCollection>`;
  const p = B.parseBygningspunkt(xml); assert.deepEqual(p.map((x) => x.nr), ['101', '102', '104'], 'rammetillatelse (RA) er ikke en stående bygning'); assert.equal(p[0].sefrak, true);
  assert.deepEqual(B.parseBoks('<gml:coordinates decimal="." cs="," ts=" ">299849.38,6749774.78 299860.08,6749783.54</gml:coordinates>'), [299849.38, 6749774.78, 299860.08, 6749783.54]);
  // Pikseltelling: to sammenbygde bygninger skilles med boksen
  const maske = (x, y) => (x >= 10 && x < 30 && y >= 10 && y < 20) || (x >= 30 && x < 50 && y >= 10 && y < 40);
  assert.equal(B.tellFotavtrykk(maske, 60, 60, { senter: [15, 15] }), 200 + 600, 'uten boks: hele klyngen');
  assert.equal(B.tellFotavtrykk(maske, 60, 60, { senter: [15, 15], innenfor: [10, 10, 29, 19] }), 200, 'med boks: bare bygningen');
  assert.equal(B.tellFotavtrykk(maske, 60, 60, { senter: [5, 5], innenfor: [0, 0, 29, 29] }), 200, 'starter i nærmeste fylte piksel');
  assert.equal(B.tellFotavtrykk(() => false, 10, 10), 0);
  // Grunnflate: boks fra GetFeatureInfo + maske fra kartbildet (0,1 m per piksel)
  const hent = async (u) => ({ ok: true, text: async () => (/GetFeatureInfo/.test(u) ? '<gml:coordinates>995,995 1005,1003</gml:coordinates>' : '') });
  const tell = async (url, w, h) => { const res = 60 / w; return (x, y) => { const e = 970 + x * res; const n = 1030 - y * res; return e >= 995 && e < 1005 && n >= 995 && n < 1003; }; };
  const g = await B.grunnflate(1000, 1000, { hent, tellPiksler: tell }); assert.equal(g.metode, 'kart'); assert.ok(Math.abs(g.m2 - 80) <= 2, `${g.m2}`);
  assert.equal((await B.grunnflate(1000, 1000, { hent })).m2, 68, 'uten kartbilde: boks × 0,85');
  // Hele innhentingen innenfor eiendomsgrensen
  const grense = { type: 'Polygon', coordinates: [[[11.30, 60.83], [11.32, 60.83], [11.32, 60.84], [11.30, 60.84], [11.30, 60.83]]] };
  const urler = []; const hent2 = async (u) => { urler.push(u); return { ok: true, text: async () => (/wfs/.test(u) ? xml : '<gml:coordinates>0,0 10,12</gml:coordinates>') }; };
  const l = await B.hentBygninger(grense, { hent: hent2 }); assert.deepEqual(l.map((x) => x.nr), ['101', '102'], 'bygning 104 ligger utenfor grensen'); assert.equal(l.totalt, 2);
  assert.deepEqual([(await B.hentBygninger(grense, { hent: hent2, maks: 1 })).length, (await B.hentBygninger(grense, { hent: hent2, maks: 1 })).totalt], [1, 2]);
  assert.match(urler[0], /wfs\.matrikkelen-bygningspunkt.*bbox=60\.830000,11\.300000,60\.840000,11\.320000/); assert.equal(l[0].grunnflate, 102);
  // Til taksten: våningshus, driftsbygning, BTA-anslag, SEFRAK → før 1900, og ingen dobbel ved ny henting
  let i = 0; const nyId = (x) => `${x}${++i}`;
  const r = B.slaSammen([], [{ ...l[0], grunnflate: 120 }, { ...l[1], grunnflate: 400 }], { nyId });
  assert.deepEqual(r.liste.map((g) => [g.type, g.bta, g.byggeaar, g.bygningsnummer]), [['vaaningshus', 192, 1890, '101'], ['driftsbygning', 520, null, '102']]);
  const r2 = B.slaSammen(r.liste, [{ ...l[0], grunnflate: 150 }, { nr: '105', kode: 111, grunnflate: 90 }], { nyId }); assert.equal(r2.lagtTil, 1); assert.equal(r2.liste.length, 3); assert.equal(r2.liste[2].type, 'kaarbolig'); assert.equal(r2.liste[0].bta, 192, 'BTA som finnes, overskrives ikke');
});

test('ØK-kart: UTM-sone, affin innretting av flisen og WMS-adresse i UTM', async () => {
  const OK = await import('../js/ok-kart.js');
  assert.deepEqual([OK.utmSone(5), OK.utmSone(10.7), OK.utmSone(13), OK.utmSone(25), OK.utmSone(31)], [32, 32, 33, 35, 35]);
  // Affin: tre punkter sendes nøyaktig dit de skal, også med rotasjon
  const m = OK.affin([[10, 20], [110, 30], [5, 120]], [[0, 0], [256, 0], [0, 256]]);
  const T = ([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  for (const [p, t] of [[[10, 20], [0, 0]], [[110, 30], [256, 0]], [[5, 120], [0, 256]]]) { const q = T(p); assert.ok(Math.abs(q[0] - t[0]) < 1e-9 && Math.abs(q[1] - t[1]) < 1e-9, JSON.stringify(q)); }
  assert.equal(OK.affin([[0, 0], [1, 1], [2, 2]], [[0, 0], [1, 0], [0, 1]]), null, 'kolineære punkter');
  // Flis ved Løten (≈ 11,37° Ø): sone 32 (6–12° Ø), boks i meter, og hjørnene innenfor bildet
  const hj = [[11.37, 60.895], [11.38, 60.895], [11.37, 60.89], [11.38, 60.89]];
  const plan = OK.flisPlan(hj, { px: 320 }); assert.equal(plan.sone, 32);
  assert.ok(plan.boks[2] - plan.boks[0] > 500 && plan.boks[2] - plan.boks[0] < 650, `${plan.boks}`);
  for (const [x, y] of plan.bildePunkter) assert.ok(x >= 0 && x <= 320 && y >= 0 && y <= 320);
  assert.match(OK.okUrl('n5raster', plan), /wms\.n5raster2\?.*LAYERS=n5raster&.*CRS=EPSG:25832&BBOX=\d+\.\d,\d+\.\d,\d+\.\d,\d+\.\d&WIDTH=320/);
  // Øst i landet: sone 35
  assert.equal(OK.flisPlan([[29, 70.1], [29.01, 70.1], [29, 70.09], [29.01, 70.09]]).sone, 35);
});

test('SkogIQ Skogkarakter: områder, indikatorer, ukjent gir ikke minuspoeng, forbedringer, historikk og stempel', async () => {
  const K = await import('../js/skogkarakter.js'); const { lagDemo } = await import('../js/demo.js');
  assert.equal(K.OMRADER.reduce((s, o) => s + o.vekt, 0), 100);
  assert.deepEqual([85, 84, 70, 55, 40, 39, 0].map((p) => K.karakterFor(p).k), ['A', 'B', 'B', 'C', 'D', 'E', 'E']);
  const ny = (b) => ({ id: b.id, nr: b.id, areal: 10, treslag: 'G', bonitet: 14, tiltak: [], ...b });
  const base = () => ({ eiendom: { takstAar: 2022, navn: 'Test' }, bestand: [ny({ id: 'a', alder: 60, volumDaa: 20 }), ny({ id: 'b', alder: 95, volumDaa: 30 })] });
  // Foryngelse: hogst 2021 uten planting → mangel; med planting etter hogsten → i orden
  const S1 = base(); S1.bestand.push(ny({ id: 'h', alder: 4, tiltak: [{ id: 't1', type: 'sluttavvirkning', status: 'utfort', aar: 2021 }] }));
  let r = K.beregnSkogkarakter(S1, { iAar: 2026 }); const ind = (r0, o, i) => r0.omrader.find((x) => x.id === o).indikatorer.find((x) => x.id === i);
  assert.equal(ind(r, 'foryngelse', 'foryngelse3').poeng, 0); assert.match(ind(r, 'foryngelse', 'foryngelse3').forbedringer[0].tekst, /Bestand h: hogd 2021 – foryng/);
  S1.bestand[2].tiltak.push({ id: 't2', type: 'planting', status: 'utfort', aar: 2022 }); r = K.beregnSkogkarakter(S1, { iAar: 2026 });
  assert.equal(ind(r, 'foryngelse', 'foryngelse3').poeng, 1);
  // Oppfølging: forfalte tiltak vektet etter prioritet, og langvarig etterslep
  const S2 = base(); S2.bestand[0].tiltak = [{ id: 'x1', type: 'tynning', status: 'utfort', aar: 2024, prioritet: 1 }, { id: 'x2', type: 'tynning', status: 'planlagt', aar: 2022, prioritet: 3 }, { id: 'x3', type: 'ungskogpleie', status: 'planlagt', aar: 2030 }];
  r = K.beregnSkogkarakter(S2, { iAar: 2026 }); assert.equal(ind(r, 'oppfolging', 'itide').poeng, 3 / 4); assert.equal(ind(r, 'oppfolging', 'etterslep').poeng, 0.5);
  assert.ok(r.forbedringer.some((f) => f.tiltakId === 'x2' && f.poeng > 0), 'forsinket tiltak gir forbedring med poeng');
  // Ukjent gir ikke minuspoeng: uten skader er risiko-området ukjent og teller ikke
  assert.equal(r.omrader.find((o) => o.id === 'risiko').poeng, null);
  const S3 = base(); S3.skogbrand = { skader: [{ dato: '2024-05-01', status: 'registrert' }] }; const r3 = K.beregnSkogkarakter(S3, { iAar: 2026 });
  assert.equal(r3.omrader.find((o) => o.id === 'risiko').poeng, 0);
  // Miljøfigur med utført hogst gir 0, urørt gir full score
  const S4 = base(); S4.bestand[1].miljo = true; assert.equal(ind(K.beregnSkogkarakter(S4, { iAar: 2026 }), 'miljo', 'miljofigurer').poeng, 1);
  S4.bestand[1].tiltak = [{ id: 'm', type: 'sluttavvirkning', status: 'utfort', aar: 2025 }]; assert.equal(ind(K.beregnSkogkarakter(S4, { iAar: 2026 }), 'miljo', 'miljofigurer').poeng, 0);
  // Planalder
  assert.equal(ind(K.beregnSkogkarakter({ ...base(), eiendom: { takstAar: 2003 } }, { iAar: 2026 }), 'oppfolging', 'planalder').poeng, 0);
  // Demo: total og karakter, datadekning, datatiltak uten poeng
  const D = lagDemo(2026); const rd = K.beregnSkogkarakter(D, { iAar: 2026 });
  assert.ok(rd.total >= 0 && rd.total <= 100 && rd.karakter); assert.ok(rd.dekning > 0 && rd.dekning <= 100); assert.ok(rd.datatiltak.every((f) => f.poeng === 0));
  // Historikk: ett per år
  K.lagreOyeblikk(D, rd); K.lagreOyeblikk(D, { ...rd, total: 10 }); K.lagreOyeblikk(D, { ...rd, aar: 2027 });
  assert.deepEqual(D.skogkarakter.historikk.map((h) => [h.aar, h.total]), [[2026, 10], [2027, rd.total]]);
  // Stempel
  const svg = K.stempelSvg({ ...rd, karakter: 'B', total: 78, navn: 'God', forelopig: true });
  assert.match(svg, /SKOGIQ SKOGKARAKTER/); assert.match(svg, />B</); assert.match(svg, /78 \/ 100/); assert.match(svg, /FORELØPIG/); assert.match(svg, /aria-label="SkogIQ Skogkarakter B, 78 av 100 poeng"/);
});

test('Ny plan fra kartet (Felt): eiendom i punktet, grense uten festetomter, kommune og planobjekt', async () => {
  const P = await import('../js/plan-fra-kart.js');
  const urler = [];
  const hent = async (u) => { urler.push(u); const j = (o) => ({ ok: true, json: async () => o, text: async () => JSON.stringify(o) });
    if (/eiendom\/v1\/punkt/.test(u)) return j({ eiendom: [{ kommunenummer: '3420', gardsnummer: 15, bruksnummer: 16, festenummer: 0, meterFraPunkt: 0 }, { kommunenummer: '3420', gardsnummer: 15, bruksnummer: 16, festenummer: 0, meterFraPunkt: 3 }, { kommunenummer: '3420', gardsnummer: 15, bruksnummer: 129, festenummer: 0, meterFraPunkt: 1, teigmedflerematrikkelenheter: true }, { kommunenummer: '3420', gardsnummer: 0, bruksnummer: 0 }] });
    if (/geokoding/.test(u)) return j({ features: [{ geometry: { type: 'Polygon', coordinates: [[[11, 60], [11.1, 60], [11.1, 60.1], [11, 60]]] }, properties: { festenummer: 0 } }, { geometry: { type: 'Polygon', coordinates: [[[11.2, 60], [11.3, 60], [11.3, 60.1], [11.2, 60]]] }, properties: { festenummer: 7 } }] });
    if (/kommuneinfo/.test(u)) return j([{ kommunenummer: '3420', kommunenavnNorsk: 'Elverum' }]);
    return { ok: false, status: 404 }; };
  const l = await P.eiendomVed(60.95, 11.45, { hent });
  assert.deepEqual(l.map((x) => [x.kommunenr, x.tekst, x.avstand, x.sameie]), [['3420', '15/16', 0, false], ['3420', '15/129', 1, true]], 'unike matrikkelenheter, nærmeste først, uten ugyldige');
  assert.match(urler[0], /eiendom\/v1\/punkt\?nord=60\.950000&ost=11\.450000&koordsys=4258/);
  const g = await P.eiendomGrense(l[0], { hent }); assert.equal(g.type, 'MultiPolygon'); assert.equal(g.coordinates.length, 1, 'festetomtene er ikke med');
  assert.equal((await P.eiendomGrense({ ...l[0], fnr: 7 }, { hent })).coordinates.length, 1);
  assert.deepEqual(await P.kommuneFor('3420', { hent }), { nr: '3420', navn: 'Elverum' });
  assert.ok(P.GEN_STEG.some(([id]) => id === 'sr16'));
  // Felt-modulen bruker samme motor og henter datagrunnlaget i bakgrunnen
  const { readFileSync: les } = await import('node:fs'); const f = les(new URL('../js/felt-nyplan.js', import.meta.url), 'utf8');
  assert.match(f, /lagSkogbruksplan\(/); assert.match(f, /hentDatagrunnlag\(/); assert.match(les(new URL('../js/felt-app.js', import.meta.url), 'utf8'), /data-np="gps"/);
});

test('Kantsone 15 m mot vann: henting fra NVE, buffer innenfor eiendommen, per bestand, PEFC krav 27 og tekster', async () => {
  const K = await import('../js/kantsone.js'); const PEFC = await import('../js/pefc.js');
  // Henting: bekker (linjer) og vann (flater) i et område litt større enn eiendommen
  const urler = []; const grense = { type: 'Polygon', coordinates: [[[11, 60], [11.01, 60], [11.01, 60.01], [11, 60.01], [11, 60]]] };
  const hent = async (u) => { urler.push(u); return { ok: true, json: async () => (/Elvenett/.test(u) ? { features: [{ geometry: { type: 'LineString', coordinates: [[11.005, 59.99], [11.005, 60.02]] }, properties: { elvenavn: 'Bekken', objekttype: 'ElvBekk' } }, { geometry: null }] } : { features: [{ geometry: { type: 'Polygon', coordinates: [[[11.02, 60], [11.03, 60], [11.03, 60.01], [11.02, 60]]] }, properties: { navn: 'Tjernet' } }] }) }; };
  const v = await K.hentVann(grense, { hent }); assert.deepEqual([v.linjer.length, v.linjer[0].navn, v.flater[0].navn], [1, 'Bekken', 'Tjernet']);
  assert.ok(urler.every((u) => /f=geojson/.test(u)) && /geometry=10\.99/.test(urler[0]), 'boksen har marg rundt eiendommen');
  assert.ok(K.BERORTE_TILTAK.includes('markberedning') && K.BERORTE_TILTAK.includes('sluttavvirkning')); assert.equal(K.BREDDE, 15);
  // Geometri (polygon-clipping + enkel Turf-erstatning: rektangulær buffer og plant areal)
  let PC; try { PC = (await import('polygon-clipping')).default; } catch { PC = null; }
  if (PC) {
    const mLat = 1 / 111320; const mLon = (lat) => 1 / (111320 * Math.cos((lat * Math.PI) / 180));
    const bb = (g) => { const p = JSON.stringify(g.coordinates).match(/-?\d+\.?\d*/g).map(Number); const xs = p.filter((_, i) => i % 2 === 0); const ys = p.filter((_, i) => i % 2 === 1); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
    const turf = {
      buffer: (f, m) => { const [a, b, c, d] = bb(f.geometry); const dx = m * mLon(b); const dy = m * mLat; return { geometry: { type: 'Polygon', coordinates: [[[a - dx, b - dy], [c + dx, b - dy], [c + dx, d + dy], [a - dx, d + dy], [a - dx, b - dy]]] } }; },
      area: (f) => { let s0 = 0; const ringer = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates; for (const poly of ringer) poly.forEach((r, ri) => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += (r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]); s0 += (ri ? -1 : 1) * Math.abs(a / 2) / (mLon(60) * mLat); }); return s0; },
    };
    const sone = K.lagKantsone(v, grense, { turf, PC });
    assert.equal(sone.type, 'MultiPolygon');
    const daa = turf.area({ geometry: sone }) / 1000; const lengde = 0.01 * 111320; // bekken krysser hele eiendommen nord–sør
    assert.ok(Math.abs(daa - (lengde * 30) / 1000) < 3, `ca. 30 m bred stripe langs bekken: ${daa}`);
    // Bestand vest (inntil bekken) og øst (langt unna)
    const vest = { id: 'v', nr: '1', areal: 278, geometri: { type: 'Polygon', coordinates: [[[11, 60], [11.005, 60], [11.005, 60.01], [11, 60.01], [11, 60]]] } };
    const ost = { id: 'o', nr: '2', areal: 100, geometri: { type: 'Polygon', coordinates: [[[11.008, 60], [11.01, 60], [11.01, 60.01], [11.008, 60.01], [11.008, 60]]] } };
    const per = K.kantsonePerBestand([vest, ost], sone, { turf, PC }); assert.ok(per.v && !per.o); assert.ok(per.v.daa > 15 && per.v.daa < 18, `${per.v.daa}`);
    // Hele oppdateringen legger S.kantsone og b.kantsone inn i planen (AR5-vann tas med)
    const S = { eiendom: { grense }, bestand: [vest, ost], markslag: [{ kategori: 'vann', geometri: { type: 'Polygon', coordinates: [[[11.0085, 60.004], [11.0095, 60.004], [11.0095, 60.005], [11.0085, 60.004]]] } }] };
    const r = await K.oppdaterKantsone(S, { turf, PC, hent }); assert.ok(r.daa > 0 && S.kantsone.bekker === 1 && S.kantsone.vann === 2 && S.kantsone.navn.includes('Bekken'));
    assert.ok(K.harKantsone(vest) && K.harKantsone(ost), 'AR5-tjernet gir kantsone også i øst');
    assert.equal(vest.kantsone.bredde, 15);
    // 30 m i edellauv-, høgstaude-, storbregne- og sumpskog (PEFC krav 27): vest som rik edellauvskog får dobbel bredde
    const vest2 = { ...vest, kantsone: undefined, vegetasjon: { kode: '5b', navn: 'Rik edellauvskog' } }; const S2 = { eiendom: { grense }, bestand: [vest2, { ...ost, kantsone: undefined }], markslag: [] };
    await K.oppdaterKantsone(S2, { turf, PC, hent }); assert.equal(vest2.kantsone.bredde, 30); assert.equal(vest2.kantsone.grunn, 'edellauvskog');
    assert.ok(vest2.kantsone.daa > vest.kantsone.daa * 1.8 && vest2.kantsone.daa < vest.kantsone.daa * 2.2, `${vest2.kantsone.daa} mot ${vest.kantsone.daa}`);
    assert.equal(S2.kantsone.bred, 30); assert.equal(S2.kantsone.bredeBestand, 1);
    assert.match(K.kantsoneTekst(vest2), /\(30 m – edellauvskog\)/);
    assert.deepEqual(['5a', '5b', '4c', '4e', '6c', '7c', '8c', '8d', '7b', '8b'].map((k) => K.bredFor({ vegetasjon: { kode: k } })), [30, 30, 30, 30, 30, 30, 30, 30, 15, 15]);
  }
  // Tekster og PEFC krav 27 for alle berørte tiltak (ikke bare hogst)
  const b = { id: 'x', nr: '7', areal: 20, treslag: 'G', bonitet: 14, alder: 60, geometri: { type: 'Polygon', coordinates: [[[11, 60], [11.001, 60], [11.001, 60.001], [11, 60]]] }, kantsone: { daa: 2.4, andel: 0.12 }, tiltak: [{ id: 't', type: 'markberedning', status: 'planlagt', aar: 2027 }] };
  assert.equal(K.kantsoneTekst(b), '2,4 daa kantsone mot vann (15 m) – 12 % av bestandet'); assert.equal(K.kantsoneTekst({}), '');
  const { STANDARD_INNSTILLINGER } = await import('../js/model.js');
  const funn = PEFC.kontroller({ eiendom: {}, bestand: [b], innstillinger: STANDARD_INNSTILLINGER, kantsone: { bredde: 15 } }, PEFC.tomPefc(), { iAar: 2026 });
  const k27 = funn.find((f) => f.krav === 27); assert.ok(k27, 'markberedning i bestand med kantsone gir varsel'); assert.match(k27.tekst, /2,4 daa.*15 m.*ingen kjøring/);
  assert.ok(!PEFC.kontroller({ eiendom: {}, bestand: [{ ...b, tiltak: [] }], innstillinger: STANDARD_INNSTILLINGER }, PEFC.tomPefc(), { iAar: 2026 }).some((f) => f.krav === 27), 'ingen tiltak – ingen varsel');
});

test('Integrasjons-API /api/v1: nøkler per bruker, lese/skrive, versjonering, rate-grense, logg og admin', async () => {
  const { lagApiNokler } = await import('../api-nokler.js'); const { apiV1, apiNoklerAdmin, pakk, pakkUt } = await import('../api-v1.js'); const { lagSkyLager } = await import('../sky-lager.js'); const { openapi } = await import('../api-dok.js');
  let tid = Date.UTC(2026, 10, 19, 10); const nokler = lagApiNokler({ naa: () => tid }); const sky = lagSkyLager({ naa: () => tid });
  const plan = { planId: 'p1', eiendom: { navn: 'Skogli', kommune: 'Løten', grense: { type: 'Polygon', coordinates: [[[11, 60], [11.01, 60], [11.01, 60.01], [11, 60]]] } }, bestand: [{ id: 'b1', nr: '7', areal: 20, treslag: 'G', bonitet: 14, alder: 60, volumDaa: 20, geometri: { type: 'Polygon', coordinates: [[[11, 60], [11.001, 60], [11.001, 60.001], [11, 60]]] }, tiltak: [{ id: 't1', type: 'tynning', aar: 2027, status: 'planlagt' }] }], registreringer: [], oppdrag: [{ id: 'o1', nr: 'O-1', type: 'hogst', status: 'bestilt' }] };
  const lagre = (u, S, grunn = null) => sky.lagre(u, 'plan1', { ...pakk(S), navn: S.eiendom.navn, grunnVersjon: grunn });
  lagre('ola@x.no', plan); lagre('kari@x.no', { ...plan, eiendom: { navn: 'Kari sin' } });
  const kall = (metode, url, { tok, kropp, hoder = {} } = {}) => new Promise((ok) => { const h = {}; const req = { method: metode, url, headers: { ...(tok ? { authorization: `Bearer ${tok}` } : {}), ...hoder }, on: (e, f) => { h[e] = f; if (e === 'end') setTimeout(() => { if (kropp) h.data?.(Buffer.from(JSON.stringify(kropp))); f(); }, 0); }, destroy() {} }; const res = { writeHead(st, hd) { this.s = st; this.h = hd; }, end(b) { ok({ status: this.s, hoder: this.h, d: b ? JSON.parse(b) : null }); } }; const sti = new URL(url, 'http://x').pathname; if (!apiV1({ nokler, sky }, req, res, sti)) ok(null); });
  // Åpne endepunkter og OpenAPI
  assert.equal((await kall('GET', '/api/v1')).d.navn, 'SkogIQ.ai API'); const spec = (await kall('GET', '/api/v1/openapi.json')).d;
  assert.equal(spec.openapi, '3.1.0'); assert.ok(spec.paths['/api/v1/planer/{planId}/tiltak'].post && spec['x-interne-endepunkter'].some((e) => e.sti === '/api/sky/planer'));
  assert.equal(openapi().components.securitySchemes.apiNokkel.scheme, 'bearer');
  assert.equal((await kall('GET', '/api/v1/planer')).status, 401); assert.equal((await kall('GET', '/api/v1/planer', { tok: 'skiq_0000000000_feilfeilfeilfeilfeilfeil' })).status, 401);
  // Lesenøkkel for Ola: ser bare Olas planer
  const les = nokler.opprett({ bruker: 'OLA@x.no', navn: 'ERP', tilgang: 'les', av: 'admin@x.no' }); assert.match(les.nokkel, /^skiq_[0-9a-f]{10}_[A-Za-z0-9_-]{40,}$/);
  assert.ok(!JSON.stringify(nokler._data()).includes(les.nokkel.split('_')[2]), 'bare hash av hemmeligheten lagres');
  const pl = await kall('GET', '/api/v1/planer', { tok: les.nokkel }); assert.deepEqual(pl.d.planer.map((p) => p.navn), ['Skogli']);
  const full = await kall('GET', '/api/v1/planer/plan1', { tok: les.nokkel }); assert.equal(full.d.plan.eiendom.navn, 'Skogli'); assert.equal(full.hoder.ETag, '"1"');
  assert.equal((await kall('GET', '/api/v1/planer/plan1/bestand', { tok: les.nokkel })).d.bestand[0].nr, '7');
  assert.equal((await kall('GET', '/api/v1/planer/plan1/bestand?format=geojson', { tok: les.nokkel })).d.type, 'FeatureCollection');
  assert.deepEqual((await kall('GET', '/api/v1/planer/plan1/tiltak?status=planlagt', { tok: les.nokkel })).d.tiltak.map((t) => [t.id, t.navn, t.bestandNr]), [['t1', 'Tynning', '7']]);
  assert.ok((await kall('GET', '/api/v1/planer/plan1/skogkarakter', { tok: les.nokkel })).d.karakter);
  assert.ok((await kall('GET', '/api/v1/planer/plan1/landbrukstakst', { tok: les.nokkel })).d.varianter.konsesjon);
  assert.equal((await kall('POST', '/api/v1/planer/plan1/tiltak', { tok: les.nokkel, kropp: { bestandId: 'b1', type: 'planting', aar: 2027 } })).status, 403, 'lesenøkkel kan ikke skrive');
  assert.equal((await kall('GET', '/api/v1/planer/ukjent', { tok: les.nokkel })).status, 404);
  // Skrivenøkkel: opprett, endre (utført), versjon og If-Match, slett med gravstein
  const skriv = nokler.opprett({ bruker: 'ola@x.no', navn: 'Entreprenør', tilgang: 'skriv' });
  assert.equal((await kall('POST', '/api/v1/planer/plan1/tiltak', { tok: skriv.nokkel, kropp: { bestandId: '7', type: 'tull', aar: 2027 } })).status, 400);
  const ny = await kall('POST', '/api/v1/planer/plan1/tiltak', { tok: skriv.nokkel, kropp: { bestandId: '7', type: 'ungskogpleie', aar: 2028, prioritet: 1 } }); assert.equal(ny.status, 201); assert.equal(ny.d.versjon, 2); assert.equal(ny.d.tiltak.kilde, 'api');
  assert.equal((await kall('PATCH', '/api/v1/planer/plan1/tiltak/t1', { tok: skriv.nokkel, kropp: { status: 'utfort' }, hoder: { 'if-match': '"1"' } })).status, 409, 'If-Match med gammel versjon gir konflikt');
  const ut = await kall('PATCH', '/api/v1/planer/plan1/tiltak/t1', { tok: skriv.nokkel, kropp: { status: 'utfort', utfortDato: '2026-11-18' }, hoder: { 'if-match': '"2"' } }); assert.equal(ut.status, 200); assert.equal(ut.d.tiltak.status, 'utfort');
  let S = pakkUt(sky.hent('ola@x.no', 'plan1')); assert.equal(S.bestand[0].tiltak.find((t) => t.id === 't1').utfortDato, '2026-11-18'); assert.ok(S.bestand[0].tiltak.find((t) => t.id === 't1').endret);
  assert.equal(sky.hent('ola@x.no', 'plan1').enhet, 'api:Entreprenør');
  assert.equal((await kall('DELETE', `/api/v1/planer/plan1/tiltak/${ny.d.tiltak.id}`, { tok: skriv.nokkel })).status, 200); S = pakkUt(sky.hent('ola@x.no', 'plan1')); assert.deepEqual(S.slettet.tiltak, [ny.d.tiltak.id]);
  assert.equal((await kall('PATCH', '/api/v1/planer/plan1/oppdrag/O-1', { tok: skriv.nokkel, kropp: { status: 'pagar' } })).d.oppdrag.status, 'pagar');
  assert.equal((await kall('PATCH', '/api/v1/planer/plan1/oppdrag/o1', { tok: skriv.nokkel, kropp: { status: 'tull' } })).status, 400);
  assert.equal((await kall('POST', '/api/v1/planer/plan1/registreringer', { tok: skriv.nokkel, kropp: { kategori: 'Stormfall', lat: 60.95, lon: 11.45 } })).status, 201);
  assert.equal((await kall('POST', '/api/v1/planer/plan1/registreringer', { tok: skriv.nokkel, kropp: { lat: 10, lon: 10 } })).status, 400);
  // Logg og tilbaketrekking
  assert.ok(nokler.sisteLogg().length >= 10 && nokler.sisteLogg()[0].nokkel === skriv.info.id);
  assert.equal(nokler.liste().find((n) => n.id === les.info.id).antallKall > 5, true);
  nokler.trekk(les.info.id); assert.equal((await kall('GET', '/api/v1/planer', { tok: les.nokkel })).status, 401, 'tilbaketrukket nøkkel avvises');
  // Rate-grense
  const r2 = nokler.opprett({ bruker: 'kari@x.no', tilgang: 'les' }); for (let i = 0; i < 300; i++) nokler.verifiser(r2.nokkel); assert.equal((await kall('GET', '/api/v1/planer', { tok: r2.nokkel })).status, 429);
  // Sletting av bruker fjerner nøklene
  nokler.slettForBruker('ola@x.no'); assert.equal(nokler.forBruker('ola@x.no').length, 0); assert.equal((await kall('GET', '/api/v1/planer', { tok: skriv.nokkel })).status, 401);
  // Admin-endepunktet: bare administrator
  const adminKall = (metode, url, admin, kropp) => new Promise((ok) => { const h = {}; const req = { method: metode, url, headers: {}, on: (e, f) => { h[e] = f; if (e === 'end') setTimeout(() => { if (kropp) h.data?.(Buffer.from(JSON.stringify(kropp))); f(); }, 0); } }; const res = { writeHead(st) { this.s = st; }, end(b) { ok({ status: this.s, d: JSON.parse(b) }); } }; apiNoklerAdmin({ nokler, admin: () => admin, brukere: () => [{ bruker: 'kari@x.no', navn: 'Kari' }] }, req, res, new URL(url, 'http://x').pathname); });
  assert.equal((await adminKall('GET', '/api/admin/apinokler', null)).status, 401); assert.equal((await adminKall('GET', '/api/admin/apinokler', false)).status, 403);
  const opp = await adminKall('POST', '/api/admin/apinokler', 'admin@x.no', { bruker: 'kari@x.no', navn: 'Regnskap', tilgang: 'les' }); assert.equal(opp.status, 201); assert.match(opp.d.nokkel, /^skiq_/);
  assert.equal((await adminKall('POST', '/api/admin/apinokler', 'admin@x.no', { bruker: 'ukjent@x.no' })).status, 400);
  const liste = await adminKall('GET', '/api/admin/apinokler', 'admin@x.no'); assert.ok(liste.d.nokler.some((n) => n.navn === 'Regnskap' && n.lagetAv === 'admin@x.no') && !JSON.stringify(liste.d).includes(opp.d.nokkel));
  assert.equal((await adminKall('DELETE', `/api/admin/apinokler/${opp.d.info.id}`, 'admin@x.no')).d.info.aktiv, false);
});

test('Roller: rådgiver/regnskapsfører, og samme rolleliste på serveren, registreringen, dialogen, admin og nettverk', async () => {
  const A = await import('../auth.js'); const { readFileSync: les } = await import('node:fs');
  const nokler = Object.keys(A.BRUKERROLLER); assert.ok(nokler.includes('radgiver')); assert.equal(A.BRUKERROLLER.radgiver, 'Rådgiver / regnskapsfører');
  assert.deepEqual(A.rensRoller(['Radgiver', 'skogeier', 'tull']), ['radgiver', 'skogeier']);
  const { VILKAR } = await import('../js/personvern.js'); const inn = A.lagInnlogging({ registrering: true });
  assert.ok(inn.registrer('1', { bruker: 'revisor@x.no', passord: 'regnskap-2026', roller: ['radgiver'], vilkar: VILKAR.versjon }).ok); assert.deepEqual(inn.meg('revisor@x.no').roller, ['radgiver']);
  const kilde = (f) => les(new URL(`../${f}`, import.meta.url), 'utf8');
  const fraHtml = [...kilde('logginn.html').matchAll(/name="roller" value="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(fraHtml.sort(), [...nokler].sort(), 'registreringen har alle rollene');
  for (const f of ['js/innlogging.js', 'js/admin.js', 'js/nettverk-ui.js', 'js/ai-kontekst.js']) for (const k of nokler) assert.match(kilde(f), new RegExp(`\\b${k}: [{']`), `${f} mangler rollen ${k}`);
});

test('Juletresjekken: på 15. nov–23. des, av julaften; score etter høyde, gran, bonitet, tetthet, vei og miljø', async () => {
  const J = await import('../js/juletre.js');
  const d = (m, dag) => new Date(2026, m - 1, dag, 12);
  assert.deepEqual([d(11, 14), d(11, 15), d(12, 1), d(12, 23), d(12, 24), d(12, 31), d(1, 10), d(7, 1)].map((x) => J.erJuletid(x)), [false, true, true, true, false, false, false, false]);
  assert.equal(J.dagerTilJul(d(12, 23)), 1); assert.equal(J.dagerTilJul(d(12, 24)), 0); assert.equal(J.dagerTilJul(d(11, 24)), 30);
  const base = { id: 'a', nr: '1', treslag: 'G', bonitet: 11, alder: 14, hogstklasse: 2, areal: 5, hoyde: 2.5, tiltak: [], ungskog: { treantallFor: 300 } };
  const topp = J.juletreScore(base, { avstandVei: 80 });
  assert.equal(topp.stjerner, 5); assert.ok(topp.score >= 95, `${topp.score}`); assert.ok(topp.grunner.some((g) => /juletrehøyde/.test(g)) && topp.grunner.some((g) => /80 m fra bilvei/.test(g)));
  assert.ok(J.juletreScore({ ...base, treslag: 'F' }).score < topp.score, 'furu er nest best');
  assert.equal(J.juletreScore({ ...base, treslag: 'L' }).score < 20, true, 'lauv gir ikke juletrær');
  assert.match(J.glimtTips(0), /hos naboen\. Men ikke stol på AI/); assert.equal(J.glimtTips(5), J.glimtTips(0));
  assert.ok(J.juletreScore({ ...base, bonitet: 23 }).score < topp.score, 'høy bonitet gir glisne trær');
  assert.ok(J.juletreScore({ ...base, ungskog: { treantallFor: 1500 } }).score < topp.score, 'for tett');
  assert.ok(J.juletreScore(base, { avstandVei: 900 }).score < J.juletreScore(base, { avstandVei: 100 }).score, 'langt å bære');
  assert.match(J.juletreScore({ ...base, hogstklasse: 5, alder: 90, hoyde: 22 }).uegnet, /for store/);
  assert.match(J.juletreScore({ ...base, hoyde: 0.4, ungskog: { hoydeBar: 0.4, treantallFor: 300 } }).uegnet, /for små/);
  assert.equal(J.juletreScore({ ...base, miljo: true }).score, 0, 'miljøfigur');
  const pleie = J.juletreScore({ ...base, bonitet: 20, tiltak: [{ type: 'ungskogpleie', status: 'planlagt' }] });
  assert.ok(pleie.bonus && pleie.grunner.some((g) => /skulle uansett ut/.test(g)));
  const liste = J.toppliste([{ ...base, id: 'x', treslag: 'L' }, { ...base, id: 'y' }, { ...base, id: 'z', hogstklasse: 5, alder: 90, hoyde: 22 }, { ...base, id: 'w', treslag: 'F' }], { avstand: () => 100 });
  assert.deepEqual(liste.map((x) => x.b.id), ['y', 'w'], 'sortert; uegnede og svært svake (lauv) er ute');
  assert.ok(J.KRITERIER.length >= 5 && J.KILDER.every((k) => /^https:/.test(k.url))); assert.match(J.nisseTips(1), /lys/);
});

test('Kommuner: velger (søk, rensing), profil, og skogeiere ser bare aktører i sine skogkommuner', async () => {
  const KV = await import('../js/kommunevelger.js');
  assert.deepEqual(KV.rensKommuner([{ nr: '3412', navn: 'Løten' }, { nr: '3412', navn: 'Løten' }, { nr: '34', navn: 'x' }, { nr: '3420', navn: 'Elverum' }, { nr: '3401', navn: '' }]), [{ nr: '3420', navn: 'Elverum' }, { nr: '3412', navn: 'Løten' }]);
  const alle = [{ nr: '3412', navn: 'Løten', fylke: '34' }, { nr: '3420', navn: 'Elverum', fylke: '34' }, { nr: '3419', navn: 'Våler', fylke: '34' }, { nr: '3114', navn: 'Våler', fylke: '31' }, { nr: '3403', navn: 'Hamar', fylke: '34' }, { nr: '1507', navn: 'Ålesund', fylke: '15' }];
  assert.deepEqual(KV.sokKommuner(alle, 'vål').map((k) => k.nr).sort(), ['3114', '3419'], 'begge Våler (ulike fylker)');
  assert.deepEqual(KV.sokKommuner(alle, 'el').map((k) => k.navn), ['Elverum'], 'starter med først'); assert.deepEqual(KV.sokKommuner(alle, 'alesund').map((k) => k.navn), ['Ålesund'], 'uten aksenter');
  assert.deepEqual(KV.sokKommuner(alle, 'l', [{ nr: '3412' }]).map((k) => k.nr).includes('3412'), false, 'valgte vises ikke'); assert.equal(KV.sokKommuner(alle, '34').length, 4, 'søk på nummer');
  assert.equal(KV.kommuneTekst([{ navn: 'A' }, { navn: 'B' }, { navn: 'C' }, { navn: 'D' }, { navn: 'E' }]), 'A, B, C og 2 til');
  // Profil
  const { lagInnlogging } = await import('../auth.js'); const { VILKAR } = await import('../js/personvern.js');
  const inn = lagInnlogging({ registrering: true }); inn.registrer('1', { bruker: 'kari@x.no', passord: 'bjorkeskog-1', roller: ['innkjoper'], vilkar: VILKAR.versjon });
  const r = inn.lagreProfil('kari@x.no', { navn: 'Kari', kommuner: [{ nr: '3420', navn: 'Elverum' }, { nr: 'tull', navn: 'X' }, { nr: '3412', navn: 'Løten' }] });
  assert.deepEqual(r.profil.kommuner, [{ nr: '3420', navn: 'Elverum' }, { nr: '3412', navn: 'Løten' }]); assert.deepEqual(inn.lagreProfil('kari@x.no', { navn: 'Kari', telefon: '900 00 000' }).profil.kommuner.length, 2, 'andre endringer beholder kommunene');
  // Nettverk: filter
  const { lagNettverk, nettverkApi, kommuneSett } = await import('../nettverk.js');
  const B = { 'ola@x.no': { navn: 'ola@x.no', visning: 'Ola', profil: { roller: ['skogeier'] } },
    'liv@x.no': { navn: 'liv@x.no', visning: 'Liv', profil: { roller: ['skogeier'], kommuner: [{ nr: '3419', navn: 'Våler' }] } },
    'kari@x.no': { navn: 'kari@x.no', visning: 'Kari', profil: { roller: ['innkjoper'], kommuner: [{ nr: '3420', navn: 'Elverum' }, { nr: '3412', navn: 'Løten' }] } },
    'per@x.no': { navn: 'per@x.no', visning: 'Per', profil: { roller: ['entreprenor'], kommuner: [{ nr: '3114', navn: 'Våler' }] } },
    'ny@x.no': { navn: 'ny@x.no', visning: 'Ny', profil: { roller: ['entreprenor'] } } };
  const sky = { 'ola@x.no': [{ nr: '3412', navn: 'Løten' }] };
  const n = lagNettverk({ brukere: { hent: (u) => B[u] || null, alle: () => Object.values(B) }, skogKommuner: (u) => sky[u] || [] });
  assert.deepEqual(n.aktorer('ola@x.no', { kommuner: n.skogKommunerFor('ola@x.no') }).map((a) => a.bruker), ['kari@x.no'], 'plan i Løten (skyen) → Kari');
  assert.deepEqual(n.aktorer('liv@x.no', { kommuner: n.skogKommunerFor('liv@x.no') }).map((a) => a.bruker), [], 'Våler i Innlandet ≠ Våler i Østfold (nummer avgjør)');
  assert.deepEqual(n.aktorer('ola@x.no', { kommuner: n.skogKommunerFor('ola@x.no', [{ nr: '3114' }]) }).map((a) => a.bruker).sort(), ['kari@x.no', 'per@x.no'], 'plan på enheten legges til');
  assert.ok(!n.aktorer('ola@x.no', { kommuner: kommuneSett([[{ nr: '3412' }, { nr: '3420' }, { nr: '3114' }]]) }).some((a) => a.bruker === 'ny@x.no'), 'aktører uten kommuner vises ikke');
  assert.deepEqual(n.aktorer('ola@x.no', { kommuner: kommuneSett([[{ navn: 'løten' }]]) }).map((a) => a.bruker), ['kari@x.no'], 'kommunenavn uten nummer (eldre planer)');
  assert.deepEqual(n.aktorer('ola@x.no').length, 3, 'uten filter: alle (brukes ikke i katalogen)');
  assert.deepEqual(n.aktorer('ola@x.no', { kommuner: n.skogKommunerFor('ola@x.no') })[0].kommuner, ['Elverum', 'Løten']);
  // HTTP
  const kjor = (url, bruker) => new Promise((ok) => { const req = { method: 'GET', url, headers: {}, on() {}, destroy() {} }; const res = { writeHead(st) { this.s = st; }, end(b) { ok({ status: this.s, d: JSON.parse(b) }); } }; nettverkApi(n, { bruker: () => bruker }, req, res, new URL(url, 'http://x').pathname); });
  const tom = await kjor('/api/nettverk/aktorer', 'liv@x.no'); assert.equal(tom.d.manglerKommune, false); assert.equal(tom.d.aktorer.length, 0);
  sky['ola@x.no'] = []; const mangler = await kjor('/api/nettverk/aktorer', 'ola@x.no'); assert.equal(mangler.d.manglerKommune, true); assert.equal(mangler.d.aktorer.length, 0);
  const med = await kjor('/api/nettverk/aktorer?kommuner=3114,abc&kommunenavn=L%C3%B8ten', 'ola@x.no'); assert.deepEqual(med.d.aktorer.map((a) => a.bruker).sort(), ['kari@x.no', 'per@x.no']); assert.equal(med.d.mineKommuner.length, 2);
});

test('Profilbilde: filtype fra filhodet, størrelse, lagring, bytte, tilgang og sletting med kontoen', async () => {
  const { lagProfilbilder, profilbildeApi, bildetype, MAKS_BYTES } = await import('../profilbilde.js');
  const { mkdtempSync, readdirSync, rmSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]); const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(50)]);
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(20)]); const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  assert.deepEqual([bildetype(jpg), bildetype(png), bildetype(webp), bildetype(svg)], ['image/jpeg', 'image/png', 'image/webp', null]);
  const mappe = mkdtempSync(join(tmpdir(), 'skogiq-pb-')); const pb = lagProfilbilder({ mappe });
  assert.equal(pb.lagre(`data:image/svg+xml;base64,${svg.toString('base64')}`).status, 415, 'SVG avvises (filhodet avgjør)');
  assert.equal(pb.lagre(`data:image/jpeg;base64,${svg.toString('base64')}`).status, 415, 'feil type selv om data-URL sier jpeg');
  assert.equal(pb.lagre(Buffer.concat([jpg, Buffer.alloc(MAKS_BYTES)])).status, 413); assert.equal(pb.lagre('tull').status, 400);
  const r = pb.lagre(`data:image/jpeg;base64,${jpg.toString('base64')}`); assert.match(r.id, /^[a-f0-9]{24}$/);
  assert.ok(pb.hent(r.id).data.equals(jpg)); assert.equal(pb.hent(r.id).type, 'image/jpeg'); assert.equal(pb.hent('../brukere'), null); assert.match(pb.dataUrl(r.id), /^data:image\/jpeg;base64,/);
  // HTTP med en enkel konto
  const profiler = { ola: {} }; const konto = { bruker: (q) => q.u || null, hentProfil: (u) => profiler[u], settBilde: (u, id) => { if (id) profiler[u].bilde = id; else delete profiler[u].bilde; } };
  const kjor = (metode, url, u, kropp) => new Promise((ok) => { const h = {}; const res = { writeHead(st, hd) { res.st = st; res.h = hd; }, end(x) { res.b = x; ok(res); } }; const req = { method: metode, url, headers: {}, u, on: (e, f) => { h[e] = f; if (e === 'end') setTimeout(() => { if (kropp) h.data?.(Buffer.from(JSON.stringify(kropp))); f(); }, 0); }, destroy() {} }; profilbildeApi(pb, konto, req, res, url); });
  assert.equal((await kjor('PUT', '/api/konto/bilde', null, { bilde: 'x' })).st, 401);
  const opp = await kjor('PUT', '/api/konto/bilde', 'ola', { bilde: `data:image/png;base64,${png.toString('base64')}` }); assert.equal(opp.st, 200); const id1 = JSON.parse(opp.b).bilde; assert.equal(profiler.ola.bilde, id1);
  const vis = await kjor('GET', `/api/bilde/${id1}`, 'kari'); assert.equal(vis.st, 200); assert.equal(vis.h['Content-Type'], 'image/png'); assert.match(vis.h['Cache-Control'], /private/); assert.equal(vis.h['X-Content-Type-Options'], 'nosniff');
  assert.equal((await kjor('GET', `/api/bilde/${id1}`, null)).st, 401, 'bare innloggede');
  const bytt = JSON.parse((await kjor('PUT', '/api/konto/bilde', 'ola', { bilde: `data:image/webp;base64,${webp.toString('base64')}` })).b).bilde;
  assert.notEqual(bytt, id1); assert.equal(pb.hent(id1), null, 'gammelt bilde slettes ved bytte'); assert.equal((await kjor('GET', `/api/bilde/${id1}`, 'kari')).st, 404);
  assert.equal((await kjor('DELETE', '/api/konto/bilde', 'ola')).st, 200); assert.equal(profiler.ola.bilde, undefined); assert.equal(pb.hent(bytt), null);
  assert.equal(readdirSync(mappe).length, 1, 'bare bildet fra det første lagre-kallet ligger igjen'); rmSync(mappe, { recursive: true, force: true });
  assert.match(pb.lagre(jpg).id, /^[a-f0-9]{24}$/, 'mappen opprettes på nytt hvis den er borte'); rmSync(mappe, { recursive: true, force: true });
  // Kontosletting sender med brukeren, så bildet kan slettes (auth.js → vedSlett(u, b))
  const { lagInnlogging } = await import('../auth.js'); const { VILKAR } = await import('../js/personvern.js'); let slettet = null;
  const inn = lagInnlogging({ registrering: true, vedSlett: (u, b) => { slettet = b?.profil?.bilde; } });
  inn.registrer('1', { bruker: 'per@x.no', passord: 'granskog-1', roller: ['skogeier'], vilkar: VILKAR.versjon }); inn.lager.lagre({ ...inn.lager.hent('per@x.no'), profil: { roller: ['skogeier'], bilde: 'abc' } });
  inn.slettMeg('per@x.no', 'granskog-1'); assert.equal(slettet, 'abc');
  // Nettverket viser bildet til motparten
  const { lagNettverk } = await import('../nettverk.js'); const B = { 'o@x.no': { navn: 'o@x.no', visning: 'O', profil: { roller: ['skogeier'] } }, 'k@x.no': { navn: 'k@x.no', visning: 'K', profil: { roller: ['innkjoper'], bilde: 'b'.repeat(24) } } };
  const n = lagNettverk({ brukere: { hent: (u) => B[u] || null, alle: () => Object.values(B) } }); assert.equal(n.aktorer('o@x.no')[0].bilde, 'b'.repeat(24));
});

test('Tilbakemelding: stjerner, typer, spamgrense, mine, admin med status og svar, sletting og tilgang', async () => {
  const { lagTilbakemelding, tilbakemeldingApi } = await import('../tilbakemelding.js'); const U = await import('../js/tilbakemelding-ui.js');
  let tid = Date.UTC(2026, 10, 13, 9); const tb = lagTilbakemelding({ naa: () => tid });
  assert.equal(tb.send('ola', { stjerner: 6 }).status, 400); assert.equal(tb.send('ola', { stjerner: 2.5 }).status, 400);
  assert.equal(tb.send('ola', {}).status, 400, 'tom'); assert.equal(tb.send('ola', { type: 'forslag', tekst: 'ja' }).status, 400, 'for kort forslag');
  const a = tb.send('ola', { stjerner: 5, type: 'ros', tekst: '' }, { navn: 'Ola' }); assert.ok(a.ok); assert.equal(a.tilbakemelding.status, 'ny');
  tid += 1000; const b = tb.send('ola', { stjerner: 3, type: 'forslag', tekst: '  Vis treslag i Felt  ', fane: 'bestand', versjon: '1.73.2' }); assert.equal(b.tilbakemelding.tekst, 'Vis treslag i Felt');
  tb.send('kari', { stjerner: 1, type: 'feil', tekst: 'Kartet blinker', fane: 'planer' }); tb.send('kari', { type: 'ukjent', tekst: 'hei' });
  assert.equal(tb.mine('ola').length, 2); assert.equal(tb.mine('ola')[0].tekst, 'Vis treslag i Felt', 'nyeste først');
  const alle = tb.alle(); assert.equal(alle.antall, 4); assert.equal(alle.snitt, 3); assert.deepEqual(alle.fordeling, [1, 0, 1, 0, 1]); assert.equal(alle.status.ny, 4); assert.equal(alle.liste.find((x) => x.tekst === 'hei').type, 'annet');
  assert.equal(tb.oppdater(b.tilbakemelding.id, { status: 'planlagt', svar: 'Kommer i neste versjon!' }).tilbakemelding.svar, 'Kommer i neste versjon!');
  assert.equal(tb.mine('ola')[0].status, 'planlagt'); assert.equal(tb.mine('ola')[0].svarTid, tid); assert.equal(tb.oppdater('x', {}).status, 404); assert.equal(tb.oppdater(b.tilbakemelding.id, { status: 'tull' }).status, 400);
  for (let i = 0; i < 12; i++) tb.send('spam', { stjerner: 4 }); assert.equal(tb.send('spam', { stjerner: 4 }).status, 429);
  tb.slettBruker('ola'); assert.equal(tb.mine('ola').length, 0); assert.equal(tb.eksport('kari').length, 2);
  // HTTP
  const res = () => { const r = { writeHead(st) { r.st = st; }, end(x) { r.d = JSON.parse(x); r.ferdig?.(); } }; return r; };
  const kjor = (metode, url, meg, kropp) => new Promise((ok) => { const h = {}; const r = res(); r.ferdig = () => ok(r); const req = { method: metode, url, headers: {}, on: (e, f) => { h[e] = f; if (e === 'end') setTimeout(() => { if (kropp) h.data?.(Buffer.from(JSON.stringify(kropp))); f(); }, 0); }, destroy() {} }; tilbakemeldingApi(tb, { meg: () => meg }, req, r, url.split('?')[0]); });
  const per = { bruker: 'per', navn: 'Per', admin: false }; const sjef = { bruker: 'sjef', navn: 'Sjef', admin: true };
  assert.equal((await kjor('POST', '/api/tilbakemelding', null, { stjerner: 4 })).st, 401);
  const ny = await kjor('POST', '/api/tilbakemelding', per, { stjerner: 4, type: 'forslag', tekst: 'Mørk modus i Felt' }); assert.equal(ny.st, 201);
  assert.equal((await kjor('GET', '/api/tilbakemelding/mine', per)).d.liste[0].tekst, 'Mørk modus i Felt');
  assert.equal((await kjor('GET', '/api/admin/tilbakemelding', per)).st, 403, 'bare administrator ser alle');
  const adm = await kjor('GET', '/api/admin/tilbakemelding', sjef); assert.equal(adm.d.liste[0].bruker, 'per');
  assert.equal((await kjor('PUT', `/api/admin/tilbakemelding/${ny.d.tilbakemelding.id}`, sjef, { status: 'lost', svar: 'Ferdig!' })).d.tilbakemelding.status, 'lost');
  assert.equal((await kjor('PUT', `/api/admin/tilbakemelding/${ny.d.tilbakemelding.id}`, per, { status: 'avvist' })).st, 403);
  assert.equal((await kjor('DELETE', `/api/admin/tilbakemelding/${ny.d.tilbakemelding.id}`, sjef)).st, 200); assert.equal((await kjor('DELETE', '/api/admin/tilbakemelding/finnesikke', sjef)).st, 404);
  // Humoren: stjernetekster og takk
  assert.equal(Object.keys(U.STJERNE_TEKST).length, 5); assert.match(U.takkTekst({ stjerner: 5 }), /Fem stjerner/); assert.match(U.takkTekst({ stjerner: 1 }), /motorsagen/); assert.match(U.takkTekst({ stjerner: 3, type: 'feil' }), /Barkbillen/);
  assert.equal(Object.keys(U.STATUS).join(), 'ny,vurderes,planlagt,lost,avvist');
});

test('Tilbakemelding som samtale: tråd begge veier, statuslogg, uleste, gjenåpning, gamle svar og tilgang', async () => {
  const { lagTilbakemelding, tilbakemeldingApi } = await import('../tilbakemelding.js');
  let tid = Date.UTC(2026, 10, 19, 9); const tb = lagTilbakemelding({ naa: () => tid });
  const x = tb.send('frode', { type: 'forslag', tekst: 'Import av gpx og kmz?' }, { navn: 'Frode' }).tilbakemelding;
  assert.deepEqual(x.traad, []); assert.equal(tb.uleste('frode'), 0); assert.equal(tb.alle().uleste, 0, 'uleste for admin gjelder svar i tråden (nye saker har status «ny»)');
  tid += 1000; tb.oppdater(x.id, { melding: 'Ja – kommer i 1.93.0!', status: 'lost', navn: 'Trond' });
  const t1 = tb.mine('frode')[0].traad; assert.equal(t1.length, 2); assert.deepEqual(t1[0], { fra: 'admin', tekst: 'Ja – kommer i 1.93.0!', tid, navn: 'Trond' }); assert.deepEqual(t1[1], { fra: 'system', tekst: 'Status: Løst', tid });
  assert.equal(tb.uleste('frode'), 1); assert.equal(tb.mine('frode')[0].ulest, 1); assert.equal(tb.alle().uleste, 0, 'lest av admin når admin svarer');
  assert.equal(tb.mine('frode')[0].svar, 'Ja – kommer i 1.93.0!', 'siste svar for eldre klienter');
  // Brukeren leser og svarer – saken åpnes igjen
  tid += 1000; assert.ok(tb.lestBruker('frode', x.id).ok); assert.equal(tb.uleste('frode'), 0);
  tid += 1000; const r = tb.skriv('frode', x.id, '  Kan den også lese GeoJSON?  '); assert.ok(r.ok);
  assert.equal(r.tilbakemelding.status, 'vurderes'); assert.deepEqual(r.tilbakemelding.traad.slice(-2).map((m) => [m.fra, m.tekst]), [['bruker', 'Kan den også lese GeoJSON?'], ['system', 'Status: Vurderes (åpnet igjen)']]);
  assert.equal(tb.alle().uleste, 1); assert.equal(tb.alle().liste[0].ulest, 1); assert.equal(tb.uleste('frode'), 0, 'egne meldinger er ikke uleste');
  tid += 1000; tb.oppdater(x.id, { lest: true }); assert.equal(tb.alle().uleste, 0);
  assert.equal(tb.skriv('kari', x.id, 'hei').status, 404, 'bare egen tråd'); assert.equal(tb.skriv('frode', x.id, '   ').status, 400);
  // Status uten endring logges ikke; samme status to ganger gir én linje
  tb.oppdater(x.id, { status: 'vurderes' }); assert.equal(tb.mine('frode')[0].traad.filter((m) => m.fra === 'system').length, 2);
  // Sortering: siste aktivitet først
  tid += 1000; const y = tb.send('frode', { stjerner: 5, type: 'ros' }).tilbakemelding; assert.equal(tb.mine('frode')[0].id, y.id);
  tid += 1000; tb.oppdater(x.id, { melding: 'Ja, GeoJSON i WGS84 går også.' }); assert.equal(tb.mine('frode')[0].id, x.id);
  // Eldre data med ett svar-felt blir tråd
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
  const fil = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tb-')), 'tb.json');
  fs.writeFileSync(fil, JSON.stringify({ liste: [{ id: 'abc123abc123', bruker: 'ola', navn: 'Ola', stjerner: 4, type: 'forslag', tekst: 'Mørk modus', tid: 1, status: 'lost', svar: 'Fikset!', svarTid: 5 }] }));
  const gml = lagTilbakemelding({ fil, naa: () => tid });
  assert.deepEqual(gml.mine('ola')[0].traad, [{ fra: 'admin', tekst: 'Fikset!', tid: 5 }]); assert.equal(gml.uleste('ola'), 0, 'gamle svar regnes som lest');
  // HTTP
  const res = () => { const q = { writeHead(st) { q.st = st; }, end(z) { q.d = JSON.parse(z); q.ferdig?.(); } }; return q; };
  const kjor = (metode, url, meg, kropp) => new Promise((ok) => { const h = {}; const q = res(); q.ferdig = () => ok(q); const req = { method: metode, url, headers: {}, on: (e, f) => { h[e] = f; if (e === 'end') setTimeout(() => { if (kropp) h.data?.(Buffer.from(JSON.stringify(kropp))); f(); }, 0); }, destroy() {} }; if (!tilbakemeldingApi(tb, { meg: () => meg }, req, q, url)) ok(null); });
  const frode = { bruker: 'frode', navn: 'Frode', admin: false }; const kari = { bruker: 'kari', navn: 'Kari', admin: false }; const sjef = { bruker: 'sjef', navn: 'Trond', admin: true };
  assert.equal((await kjor('GET', '/api/tilbakemelding/uleste', frode)).d.uleste, 1);
  const m = await kjor('GET', '/api/tilbakemelding/mine', frode); assert.equal(m.d.uleste, 1); assert.equal(m.d.liste[0].traad.at(-1).tekst, 'Ja, GeoJSON i WGS84 går også.');
  assert.equal((await kjor('POST', `/api/tilbakemelding/${x.id}/lest`, frode)).st, 200); assert.equal((await kjor('GET', '/api/tilbakemelding/uleste', frode)).d.uleste, 0);
  assert.equal((await kjor('POST', `/api/tilbakemelding/${x.id}/melding`, frode, { tekst: 'Takk!' })).st, 201);
  assert.equal((await kjor('POST', `/api/tilbakemelding/${x.id}/melding`, kari, { tekst: 'Snik' })).st, 404, 'andre kan ikke skrive i tråden');
  assert.equal((await kjor('POST', `/api/tilbakemelding/${x.id}/melding`, null, { tekst: 'x' })).st, 401);
  assert.equal((await kjor('GET', `/api/tilbakemelding/${x.id}/melding`, frode)).st, 405);
  const adm = await kjor('PUT', `/api/admin/tilbakemelding/${x.id}`, sjef, { melding: 'Bare hyggelig!' }); assert.equal(adm.d.tilbakemelding.traad.at(-1).navn, 'Trond');
  assert.equal((await kjor('PUT', `/api/admin/tilbakemelding/${x.id}`, frode, { melding: 'Jeg er admin' })).st, 403);
});

test('Skogen siste døgn (admin): hvem som har vært innom, hvem som er der nå, gjeng-tekst og tre per bruker', async () => {
  const S = await import('../js/admin-skog.js'); const naa = Date.UTC(2026, 10, 20, 12);
  const b = [
    { bruker: 'a@x.no', navn: 'Anne', sistAktiv: naa - 60000 }, { bruker: 'b@x.no', navn: 'Bjørn', sistAktiv: naa - 3 * 3600000 },
    { bruker: 'c@x.no', navn: 'C', sistAktiv: naa - 25 * 3600000 }, { bruker: 'd@x.no', navn: 'D', sistAktiv: null }, { bruker: 'e@x.no', navn: '<Eva>', sistAktiv: naa - 4 * 60000 },
  ];
  const l = S.iSkogen(b, naa); assert.deepEqual(l.map((x) => x.navn), ['Anne', '<Eva>', 'Bjørn']); assert.deepEqual(l.map((x) => x.naa), [true, true, false]);
  assert.equal(S.siden(30000), 'akkurat nå'); assert.equal(S.siden(12 * 60000), 'for 12 min siden'); assert.equal(S.siden(3600000), 'for 1 time siden'); assert.equal(S.siden(5 * 3600000), 'for 5 timer siden');
  assert.match(S.gjeng(0).tekst, /ugla/); assert.match(S.gjeng(1).tekst, /ensom/); assert.match(S.gjeng(6).tekst, /elgjaktlag/); assert.match(S.gjeng(500).tekst, /bygda/);
  const h = S.skogKort(b, { naa, timeNaa: 12 }); assert.match(h, /aria-label="3 brukere siste døgn, 2 pålogget nå"/);
  assert.equal((h.match(/<title>/g) || []).length, 3, 'ett tre per bruker'); assert.equal((h.match(/class="skog-svai"/g) || []).length, 2, 'de som er der nå, svaier');
  assert.match(h, /Bjørn \(b@x\.no\) – for 3 timer siden/); assert.ok(!h.includes('<Eva>') && h.includes('&lt;Eva&gt;'), 'navn escapes');
  assert.match(S.skogKort([], { naa, timeNaa: 2 }), /🦉/); assert.match(S.skogKort([], { naa, timeNaa: 2 }), /#0b1d3a/, 'nattehimmel');
});

test('Skogen siste døgn for alle: /api/skogen gir bare antall (ingen navn), krever innlogging, og anonym skog', async () => {
  const { lagInnlogging, innloggingApi } = await import('../auth.js');
  const { mkdtempSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
  let tid = Date.UTC(2026, 10, 20, 12); const fil = join(mkdtempSync(join(tmpdir(), 'skogiq-')), 'brukere.json');
  const inn = lagInnlogging({ registrering: true, fil, bruker: 'trond', passord: 'skog-og-mark', naa: () => tid });
  for (const [u, min] of [['anne@x.no', 2], ['bjorn@x.no', 50], ['carl@x.no', 125], ['dag@x.no', 26 * 60]]) { tid = Date.UTC(2026, 10, 20, 12) - min * 60000; inn.registrer(u, { bruker: u, passord: 'granskogen-77', vilkar: PV_VILKAR.versjon, roller: ['skogeier'] }); inn.bruk(u, 'kall'); }
  tid = Date.UTC(2026, 10, 20, 12);
  const s = inn.skogen(); assert.equal(s.siste24, 3); assert.equal(s.naa, 1); assert.equal(s.timer.length, 24); assert.deepEqual(s.timer.slice(0, 3), [2, 0, 1]);
  assert.ok(!JSON.stringify(s).includes('@'), 'ingen e-post eller navn');
  const svar = (sti, cookie) => new Promise((ok) => { const r = { writeHead(st) { r.st = st; }, end(x) { r.d = JSON.parse(x); ok(r); } }; innloggingApi(inn, { method: 'GET', url: sti, headers: cookie ? { cookie } : {}, socket: {} }, r, sti); });
  assert.equal((await svar('/api/skogen')).st, 401);
  const token = inn.lagToken ? inn.lagToken('anne@x.no') : null;
  if (token) { const r = await svar('/api/skogen', `skogiq_okt=${token}`); if (r.st === 200) assert.equal(r.d.siste24, 3); }
  const S = await import('../js/admin-skog.js'); const naa = Date.UTC(2026, 10, 20, 12);
  const anon = S.anonymeBrukere(s, naa); assert.equal(anon.length, 3); assert.equal(S.iSkogen(anon, naa).filter((x) => x.naa).length, 1);
  const h = S.skogKort(anon, { naa, timeNaa: 12, anonym: true }); assert.match(h, /aria-label="3 brukere siste døgn, 1 pålogget nå"/); assert.match(h, /En skogbruker – i skogen nå/); assert.match(h, /En skogbruker – for 2–3 timer siden/);
  assert.ok(!/naa-0|t0-|t2-/.test(h), 'ingen interne id-er i visningen'); assert.match(h, /Ingen navn vises/);
  const U = await import('../js/skogen-ui.js'); assert.match(U.merkeHtml({ siste24: 12, naa: 3 }), /🌲 12[\s\S]*3 nå/); assert.match(U.merkeHtml({ siste24: 2, naa: 0 }), /siste døgn/); assert.match(U.merkeTittel({ siste24: 1, naa: 0 }), /1 skogbruker i SkogIQ/);
});

test('E-post via eget e-postprogram: mailto med riktig koding', async () => {
  const { mailto } = await import('../js/epost.js');
  const u = mailto({ til: 'ola@x.no', emne: 'Glemt passord – SkogIQ.ai', tekst: 'Hei!\n\nLinje 2 & mer?' });
  assert.ok(u.startsWith('mailto:ola@x.no?subject=')); assert.ok(!/[\s]/.test(u), 'ingen rå mellomrom eller linjeskift');
  const q = new URLSearchParams(u.split('?')[1].replace(/\+/g, '%2B')); assert.equal(q.get('subject'), 'Glemt passord – SkogIQ.ai'); assert.equal(q.get('body'), 'Hei!\n\nLinje 2 & mer?');
});

test('Sikkerhetskopi: tar, kryptering, S3-signatur, kopi med opprydding, opplasting og gjenoppretting', async () => {
  const B = await import('../backup.js');
  const { mkdtempSync, mkdirSync, writeFileSync, readFileSync: les, readdirSync, rmSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const { join } = await import('node:path');
  // tar fram og tilbake (også lange stier og binærdata)
  const lang = `sky/${'a'.repeat(60)}/${'b'.repeat(70)}.json`;
  const filer = [{ navn: 'brukere.json', data: Buffer.from('{"x":1}') }, { navn: lang, data: Buffer.from([0, 1, 2, 255]) }, { navn: 'tom.txt', data: Buffer.alloc(0) }, { navn: `sky/x/${'p'.repeat(150)}.json`, data: Buffer.from('langt navn (GNU LongLink)') }];
  assert.deepEqual(B.lesTar(B.lagTar(filer)).map((f) => [f.navn, f.data.toString('hex')]), filer.map((f) => [f.navn, f.data.toString('hex')]));
  // kryptering
  const k = B.krypter(Buffer.from('hemmelig innhold'), 'riktig-nøkkel'); assert.ok(k.subarray(0, 8).equals(B.MAGI)); assert.ok(!k.includes(Buffer.from('hemmelig')));
  assert.equal(B.dekrypter(k, 'riktig-nøkkel').toString(), 'hemmelig innhold'); assert.throws(() => B.dekrypter(k, 'feil'), /Feil nøkkel/);
  // AWS signatur v4: eksempelet «GET Object» fra AWS-dokumentasjonen
  assert.equal(B.signerS3({ metode: 'GET', sti: '/test.txt', headers: { host: 'examplebucket.s3.amazonaws.com', range: 'bytes=0-9', 'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'x-amz-date': '20130524T000000Z' }, payloadHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', amzDato: '20130524T000000Z', region: 'us-east-1', id: 'AKIAIOSFODNN7EXAMPLE', hemmelig: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' }),
    'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41');
  // Falsk S3 i minnet
  const lager = new Map(); const kall = [];
  const hent = async (url, o) => { const u = new URL(url); kall.push({ metode: o.method, url, auth: o.headers.Authorization });
    const svar = (status, body = '') => ({ ok: status < 300, status, text: async () => String(body), arrayBuffer: async () => body });
    if (o.method === 'PUT') { lager.set(decodeURIComponent(u.pathname), Buffer.from(o.body)); return svar(200); }
    if (o.method === 'DELETE') { lager.delete(decodeURIComponent(u.pathname)); return svar(204); }
    if (u.searchParams.get('list-type')) { const pre = `/bøtte/${u.searchParams.get('prefix')}`; return svar(200, `<ListBucketResult>${[...lager.keys()].filter((x) => x.startsWith(pre)).map((x) => `<Contents><Key>${x.slice('/bøtte/'.length)}</Key><Size>${lager.get(x).length}</Size></Contents>`).join('')}<IsTruncated>false</IsTruncated></ListBucketResult>`); }
    const d = lager.get(decodeURIComponent(u.pathname)); return d ? svar(200, d.buffer.slice(d.byteOffset, d.byteOffset + d.length)) : svar(404, '<Code>NoSuchKey</Code>'); };
  let tid = Date.UTC(2026, 10, 11, 3, 0);
  const s3 = B.lagS3({ endpoint: 'https://s3.eu.example', bucket: 'bøtte', id: 'ID', hemmelig: 'HEM', hent, naa: () => tid });
  // Datamappe med filer, backup-mappe og midlertidige filer
  const mappe = mkdtempSync(join(tmpdir(), 'skogiq-bk-')); mkdirSync(join(mappe, 'sky', 'abc', 'h'), { recursive: true });
  writeFileSync(join(mappe, 'brukere.json'), '{"brukere":{"ola":{}}}'); writeFileSync(join(mappe, 'nettverk.json'), '{"koblinger":{}}');
  writeFileSync(join(mappe, 'sky', 'abc', 'p1.json'), 'plan'); writeFileSync(join(mappe, 'sky', 'abc', 'h', '1.json'), 'historikk'); writeFileSync(join(mappe, 'brukere.json.tmp'), 'halv');
  let flushet = 0; const stille = { error() {} };
  const bk = B.lagBackup({ mappe, nokkel: 'test-nøkkel', s3, beholdLokalt: 2, beholdS3: 3, naa: () => tid, forKopi: () => { flushet++; }, logg: stille });
  assert.ok(bk.status().forfalt);
  const r1 = await bk.kjor(); assert.ok(r1.ok, r1.feil); assert.equal(r1.filer, 4, 'backup-mappen og .tmp er ikke med'); assert.equal(r1.s3, 'ok'); assert.ok(r1.kryptert); assert.equal(flushet, 1);
  assert.ok(kall.every((c) => /^AWS4-HMAC-SHA256 Credential=ID\/20261111\/eu-central-1\/s3\/aws4_request/.test(c.auth)), 'alle kall er signert');
  assert.ok(!bk.status().forfalt);
  for (let i = 1; i <= 4; i++) { tid += 24 * 3600 * 1000; writeFileSync(join(mappe, 'nettverk.json'), `{"versjon":${i}}`); assert.ok((await bk.kjor()).ok); }
  assert.equal(bk.lokaleFiler().length, 2, 'beholder 2 lokalt'); assert.equal([...lager.keys()].length, 3, 'beholder 3 i S3');
  assert.equal(bk.status().historikk.length, 5); assert.equal(bk.status().s3Siste, tid);
  // Status overlever omstart
  assert.equal(B.lagBackup({ mappe, nokkel: 'x', logg: stille }).status().siste, tid);
  // Gjenoppretting fra S3 og fra lokal fil gir samme innhold som datamappen
  const siste = (await s3.liste()).at(-1).navn; assert.equal(siste, bk.lokaleFiler().at(-1));
  const ut = B.pakkUt(await s3.hent(siste), 'test-nøkkel'); assert.deepEqual(ut.map((f) => f.navn), ['brukere.json', 'nettverk.json', 'sky/abc/h/1.json', 'sky/abc/p1.json']);
  assert.equal(ut.find((f) => f.navn === 'nettverk.json').data.toString(), '{"versjon":4}');
  assert.throws(() => B.pakkUt(bk.hentLokal(siste), ''), /kryptert/);
  // Kommandolinjeverktøyet
  const { execFileSync } = await import('node:child_process'); const fil = join(mappe, 'backup', siste); const til = join(mappe, '..', `gjenopprettet-${Date.now()}`);
  const o = execFileSync(process.execPath, [new URL('../verktoy/gjenopprett-backup.mjs', import.meta.url).pathname, fil, '--til', til], { env: { ...process.env, BACKUP_NOKKEL: 'test-nøkkel' } }).toString();
  assert.match(o, /4 filer/); assert.equal(les(join(til, 'sky', 'abc', 'p1.json'), 'utf8'), 'plan'); assert.equal(les(join(til, 'brukere.json'), 'utf8'), '{"brukere":{"ola":{}}}');
  // Uten nøkkel: bare lokalt, aldri ukryptert ut
  const n0 = lager.size; const bk2 = B.lagBackup({ mappe: mkdtempSync(join(tmpdir(), 'skogiq-bk2-')), s3, naa: () => tid, logg: stille });
  const r2 = await bk2.kjor(); assert.ok(r2.ok && !r2.kryptert); assert.equal(r2.s3, 'ukryptert'); assert.equal(lager.size, n0); assert.match(bk2.status().s3Feil, /BACKUP_NOKKEL/);
  // Feil i S3 stopper ikke den lokale kopien
  const bk3 = B.lagBackup({ mappe, nokkel: 'k', s3: B.lagS3({ endpoint: 'https://x', bucket: 'b', id: 'i', hemmelig: 'h', hent: async () => ({ ok: false, status: 403, text: async () => '<Code>AccessDenied</Code>' }) }), naa: () => tid + 1, logg: stille });
  const r3 = await bk3.kjor(); assert.ok(r3.ok); assert.equal(r3.s3, 'feil'); assert.match(bk3.status().s3Feil, /403 \(AccessDenied\)/);
  // HTTP: bare administrator
  const res = () => { const r = { writeHead(st, h = {}) { r.st = st; r.h = h; }, end(b) { r.b = b; r.ferdig?.(); } }; return r; };
  const api = (metode, url, adm) => new Promise((ok) => { const r = res(); r.ferdig = () => ok(r); B.backupApi(bk, { erAdmin: () => adm }, { method: metode, url, headers: {} }, r, new URL(url, 'http://x').pathname); });
  assert.equal((await api('GET', '/api/admin/backup', null)).st, 401); assert.equal((await api('GET', '/api/admin/backup', false)).st, 403);
  const st = JSON.parse((await api('GET', '/api/admin/backup', true)).b); assert.ok(st.aktiv && st.kryptert && st.s3); assert.equal(st.lokale.length, 2);
  const dl = await api('GET', `/api/admin/backup/fil?navn=${st.lokale[0].navn}`, true); assert.equal(dl.st, 200); assert.ok(Buffer.from(dl.b).subarray(0, 8).equals(B.MAGI));
  assert.equal((await api('GET', '/api/admin/backup/fil?navn=../brukere.json', true)).st, 404, 'bare kopifiler kan lastes ned');
  rmSync(mappe, { recursive: true, force: true }); rmSync(til, { recursive: true, force: true });
});

// Sjekksum for innholdet i vilkår og personvernerklæring per versjon (js/personvern.js). Endres teksten, må
// VILKAR.versjon økes og en ny linje legges til her. Gamle linjer blir stående som historikk.
const PERSONVERN_SJEKKSUM = {
  '1.0': '16a230b34f20c608',
  '1.1': 'e0995a4ed43e36bc', // behandlingsansvarlig og kontakt fylt ut
  '1.2': '11b0ad685a83bd45', // krypterte sikkerhetskopier (30 dager) og leverandør for lagring
  '1.3': '43615e4bebe0642f', // tilbakemeldinger og forbedringsforslag
  '1.4': '1d48addaab85b157', // Artsdatabanken (artsfunn og rødliste) som offentlig kilde
  '1.5': '1eee6ddd5e27e456', // profilbilde (valgfritt), vist i Nettverk
  '1.6': 'a0fb42021e2ae582',
  '1.7': 'ad76546af094b915',
  '1.8': '1b41be6f78760f90',
  '1.9': '95e150ddf143b146', '1.10': 'bcad0c3ed7405b42', '1.11': '4fdc156246a1088c',
};

test('Personvern: erklæringen dekker alle /api-stier, versjon og sjekksum, og sidene lenker til den', async () => {
  const PV = await import('../js/personvern.js'); const { readFileSync: les, readdirSync } = await import('node:fs'); const { createHash } = await import('node:crypto');
  // Hver /api-sti på serveren må tilhøre en behandling i erklæringen (første ledd i stien).
  const filer = ['server.js', 'auth.js', ...readdirSync(new URL('..', import.meta.url)).filter((f) => /^[\w-]+\.js$/.test(f) && f !== 'server.js' && f !== 'auth.js')];
  const ledd = new Set(); for (const f of filer) for (const m of les(new URL(`../${f}`, import.meta.url), 'utf8').matchAll(/['`"]\/api\/([a-z0-9_-]+)/g)) ledd.add(m[1]);
  const dekket = new Set(PV.BEHANDLINGER.flatMap((b) => b.api.map((x) => x.split('/')[2])));
  const mangler = [...ledd].filter((x) => !dekket.has(x));
  assert.deepEqual(mangler, [], `Nye /api-stier må føres inn i BEHANDLINGER i js/personvern.js (formål, opplysninger, lagringstid, mottakere): ${mangler.join(', ')}`);
  for (const b of PV.BEHANDLINGER) { for (const k of ['id', 'navn', 'formaal', 'opplysninger', 'lagring', 'mottakere']) assert.ok(String(b[k] || '').length > 1, `${b.id}: ${k}`); assert.ok(PV.GRUNNLAG[b.grunnlag], `${b.id}: grunnlag`); }
  assert.equal(new Set(PV.BEHANDLINGER.map((b) => b.id)).size, PV.BEHANDLINGER.length);
  // Versjon og sjekksum: tekstendringer krever ny versjon, og kreverGodkjenning kan ikke være nyere enn versjonen.
  const sum = createHash('sha256').update(PV.innhold()).digest('hex').slice(0, 16);
  assert.equal(PERSONVERN_SJEKKSUM[PV.VILKAR.versjon], sum, `Vilkår/personvern er endret uten ny versjon. Øk VILKAR.versjon i js/personvern.js (og kreverGodkjenning ved vesentlige endringer), og legg til '${PV.VILKAR.versjon === Object.keys(PERSONVERN_SJEKKSUM).at(-1) ? 'NY_VERSJON' : PV.VILKAR.versjon}': '${sum}' i PERSONVERN_SJEKKSUM`);
  const { sammenlignVersjon } = await import('../auth.js');
  assert.ok(sammenlignVersjon(PV.VILKAR.kreverGodkjenning, PV.VILKAR.versjon) <= 0); assert.equal(sammenlignVersjon('1.10', '1.9'), 1); assert.equal(sammenlignVersjon('1.0', '1'), 0);
  assert.match(PV.VILKAR.dato, /^\d{4}-\d{2}-\d{2}$/);
  // HTML-en har alle behandlingene og leverandørene, og sidene lenker til erklæringen.
  const h = PV.html(); for (const b of PV.BEHANDLINGER) assert.ok(h.includes(`id="pv-${b.id}"`)); for (const t of PV.TREDJEPARTER) assert.ok(h.includes(t.navn.replace(/&/g, '&amp;')));
  assert.match(les(new URL('../logginn.html', import.meta.url), 'utf8'), /personvern\.html[\s\S]*name="vilkar"|name="vilkar"[\s\S]*personvern\.html/);
  assert.match(les(new URL('../js/innlogging.js', import.meta.url), 'utf8'), /\/api\/samtykke/);
  // DPIA-en følger erklæringen: samme versjon, og alle behandlingene er vurdert.
  const dpia = les(new URL('../docs/DPIA.md', import.meta.url), 'utf8');
  assert.match(dpia, new RegExp(`erklæring versjon: ${PV.VILKAR.versjon.replace('.', '\\.')}\\b`), `docs/DPIA.md bygger på en eldre versjon av erklæringen – oppdater DPIA-en til versjon ${PV.VILKAR.versjon}`);
  for (const b of PV.BEHANDLINGER) assert.ok(dpia.includes(`(\`${b.id}\`)`), `docs/DPIA.md mangler behandlingen «${b.navn}» (${b.id}) i kapittel 2`);
});

test('Personvern: godkjenning ved registrering og innlogging, innsyn, statistikk av og sletting av egen konto', async () => {
  const { lagInnlogging, innloggingApi } = await import('../auth.js'); const { VILKAR } = await import('../js/personvern.js');
  let tid = Date.UTC(2026, 10, 11, 9); let slettet = null;
  const inn = lagInnlogging({ registrering: true, admin: 'sjef@x.no', naa: () => tid, vedSlett: (u) => { slettet = u; }, eksport: (u) => ({ nettverk: [{ med: 'kjop@x.no', meldinger: [{ tekst: `hei ${u}` }] }] }) });
  assert.equal(inn.registrer('1', { bruker: 'ola@x.no', passord: 'granskog-1', roller: ['skogeier'] }).status, 400, 'må godta vilkårene');
  assert.equal(inn.registrer('1', { bruker: 'ola@x.no', passord: 'granskog-1', roller: ['skogeier'], vilkar: '0.1' }).status, 400, 'må godta gjeldende versjon');
  assert.ok(inn.registrer('1', { bruker: 'ola@x.no', passord: 'granskog-1', roller: ['skogeier'], vilkar: VILKAR.versjon }).ok);
  assert.ok(inn.registrer('1', { bruker: 'eldre.side@x.no', passord: 'granskog-1', roller: ['skogeier'], vilkar: VILKAR.kreverGodkjenning }).ok, 'eldre side med versjon ≥ kreverGodkjenning kan registrere');
  assert.equal(inn.registrer('1', { bruker: 'fram@x.no', passord: 'granskog-1', roller: ['skogeier'], vilkar: '99.0' }).status, 400, 'ukjent framtidig versjon');
  const ola = inn.lager.hent('ola@x.no'); assert.equal(ola.vilkar.versjon, VILKAR.versjon); assert.equal(ola.vilkar.tid, tid); assert.equal(ola.vilkarLogg.length, 1); assert.equal(ola.vilkarLogg[0].kilde, 'registrering');
  assert.deepEqual(inn.meg('ola@x.no').vilkar, { godtatt: VILKAR.versjon, tid, gjeldende: VILKAR.versjon, kreves: false });
  // Eldre bruker uten godkjenning (eller med eldre versjon enn kreverGodkjenning) må godta ved innlogging.
  inn.lager.lagre({ ...inn.lager.hent('ola@x.no'), navn: 'gammel@x.no', epost: 'gammel@x.no', vilkar: undefined, vilkarLogg: undefined });
  assert.equal(inn.meg('gammel@x.no').vilkar.kreves, true);
  inn.lager.lagre({ ...inn.lager.hent('gammel@x.no'), vilkar: { versjon: '0.9', tid: 1 } }); assert.equal(inn.meg('gammel@x.no').vilkar.kreves, true, 'eldre versjon');
  assert.equal(inn.godtaVilkar('gammel@x.no', '0.9').status, 409, 'bare gjeldende versjon kan godtas');
  tid += 1000; assert.equal(inn.godtaVilkar('gammel@x.no', VILKAR.versjon).vilkar.kreves, false); assert.equal(inn.lager.hent('gammel@x.no').vilkarLogg.at(-1).kilde, 'innlogging');
  // Over HTTP
  const res = () => { const r = { status: 0, hoder: {}, kropp: '', writeHead(st, hd = {}) { r.status = st; r.hoder = hd; }, end(b = '') { r.kropp = String(b); r.ferdig?.(); } }; return r; };
  const req = (metode, url, { token = null, kropp = null } = {}) => { const h = {}; return { method: metode, url, headers: { host: 'skogiq.test', ...(token ? { authorization: `Bearer ${token}` } : {}) }, socket: { remoteAddress: '4.4.4.4' }, on: (e, f) => { h[e] = f; if (e === 'end') setTimeout(() => { if (kropp) h.data?.(Buffer.from(JSON.stringify(kropp))); f(); }, 0); }, destroy() {} }; };
  const api = (q) => new Promise((ok) => { const r = res(); r.ferdig = () => ok({ status: r.status, hoder: r.hoder, d: JSON.parse(r.kropp || '{}') }); if (!innloggingApi(inn, q, r, new URL(q.url, 'http://x').pathname)) ok(null); });
  const reg = await api(req('POST', '/api/registrer', { kropp: { bruker: 'kari@x.no', passord: 'bjorkeskog-2', navn: 'Kari', roller: ['innkjoper'] } })); assert.equal(reg.status, 400);
  const ok = await api(req('POST', '/api/registrer', { kropp: { bruker: 'kari@x.no', passord: 'bjorkeskog-2', navn: 'Kari', roller: ['innkjoper'], vilkar: VILKAR.versjon } })); assert.equal(ok.status, 201); const token = ok.d.token;
  assert.equal((await api(req('POST', '/api/samtykke', { kropp: { versjon: VILKAR.versjon } }))).status, 401);
  assert.equal((await api(req('POST', '/api/samtykke', { token, kropp: { versjon: VILKAR.versjon } }))).d.ok, true);
  // Bruksstatistikk: slås av (og det som er samlet inn, slettes), og telles ikke lenger.
  inn.bruk('kari@x.no', 'fane', 'kart'); assert.ok(Object.values(inn.lager.data.bruk).some((d) => d['kari@x.no']));
  const av = await api(req('POST', '/api/konto/innstillinger', { token, kropp: { statistikk: false } })); assert.equal(av.d.statistikk, false);
  assert.ok(!Object.values(inn.lager.data.bruk).some((d) => d['kari@x.no']), 'statistikken er slettet'); inn.bruk('kari@x.no', 'fane', 'kart'); assert.ok(!Object.values(inn.lager.data.bruk).some((d) => d['kari@x.no']), 'telles ikke');
  assert.equal(inn.meg('kari@x.no').statistikk, false);
  // Innsyn: alt om brukeren, uten passord-hash, med data fra de andre modulene.
  const eks = await api(req('GET', '/api/konto/eksport', { token })); assert.equal(eks.status, 200); assert.match(eks.hoder['Content-Disposition'], /attachment; filename="skogiq-mine-data-/);
  assert.equal(eks.d.konto.epost, 'kari@x.no'); assert.equal(eks.d.konto.vilkar.versjon, VILKAR.versjon); assert.ok(!('hash' in eks.d.konto) && !('salt' in eks.d.konto)); assert.equal(eks.d.nettverk[0].meldinger[0].tekst, 'hei kari@x.no');
  assert.equal((await api(req('GET', '/api/konto/eksport'))).status, 401);
  // Sletting av egen konto: krever passord; administratorer kan ikke slette seg selv.
  assert.equal((await api(req('POST', '/api/konto/slett', { token, kropp: { passord: 'feil-passord' } }))).status, 401); assert.ok(inn.lager.hent('kari@x.no'));
  const sl = await api(req('POST', '/api/konto/slett', { token, kropp: { passord: 'bjorkeskog-2' } })); assert.equal(sl.status, 200); assert.match(sl.hoder['Set-Cookie'], /Max-Age=0/);
  assert.equal(inn.lager.hent('kari@x.no'), null); assert.equal(slettet, 'kari@x.no', 'skylagring og nettverk slettes også'); assert.equal(inn.lesToken(token), null, 'økten er ugyldig');
  inn.lager.lagre({ ...inn.lager.hent('ola@x.no'), navn: 'sjef@x.no', epost: 'sjef@x.no' }); assert.equal(inn.slettMeg('sjef@x.no', 'granskog-1').status, 400);
});

test('Nettverk: statistikk, katalog uten e-post, koblinger begge veier, tilgang, chat og uleste', async () => {
  const { lagNettverk, nettverkApi } = await import('../nettverk.js');
  const B = { 'ola@x.no': { navn: 'ola@x.no', visning: 'Ola Skog', epost: 'ola@x.no', profil: { roller: ['skogeier'], kommune: 'Løten' } },
    'kjop@x.no': { navn: 'kjop@x.no', visning: 'Kari Kjøper', epost: 'kjop@x.no', profil: { roller: ['innkjoper'], foretak: 'Tømmer AS', kommune: 'Elverum' } },
    'ent@x.no': { navn: 'ent@x.no', visning: 'Per Entreprenør', epost: 'ent@x.no', profil: { roller: ['entreprenor', 'innkjoper'], foretak: 'Hogst AS', kommuner: [{ nr: '3412', navn: 'Løten' }] } },
    'liv@x.no': { navn: 'liv@x.no', visning: 'Liv Skog', epost: 'liv@x.no', profil: { roller: ['skogeier'] } },
    'off@x.no': { navn: 'off@x.no', visning: 'Kommunen', profil: { roller: ['offentlig'] } },
    'sperret@x.no': { navn: 'sperret@x.no', visning: 'Sperret', sperret: true, profil: { roller: ['innkjoper'] } } };
  let tid = 1e12; const n = lagNettverk({ brukere: { hent: (u) => B[String(u).toLowerCase()] || null, alle: () => Object.values(B) }, naa: () => tid });
  assert.deepEqual(n.statistikk(), { skogeiere: 2, innkjopere: 2, entreprenorer: 1 }, 'sperrede brukere telles ikke');
  const kat = n.aktorer('ola@x.no'); assert.deepEqual(kat.map((x) => x.navn), ['Kari Kjøper', 'Per Entreprenør'], 'sortert på navn, sperrede er skjult'); assert.ok(!JSON.stringify(kat).includes('epost'), 'katalogen viser ikke e-post');
  assert.equal(n.aktorer('ola@x.no', { q: 'elverum' }).length, 1); assert.equal(n.aktorer('ola@x.no', { rolle: 'entreprenor' }).length, 1);
  // Skogeier ber om kobling til innkjøper; bare innkjøperen kan godta.
  const k1 = n.be('ola@x.no', { til: 'kjop@x.no', rolle: 'innkjoper' }); assert.equal(k1.status, 'foresporsel');
  assert.equal(n.be('ola@x.no', { til: 'kjop@x.no', rolle: 'innkjoper' }).status, 409, 'ikke to like forespørsler');
  assert.equal(n.svar('ola@x.no', k1.kobling, 'godta').status, 403, 'avsenderen kan ikke godta selv');
  assert.equal(n.send('ola@x.no', k1.kobling, 'hei').status, 409, 'chat bare i aktive koblinger');
  assert.equal(n.oversikt('kjop@x.no').forespørsler, 1);
  assert.equal(n.svar('kjop@x.no', k1.kobling, 'godta').status, 'aktiv');
  // Ugyldige koblinger
  assert.equal(n.be('ola@x.no', { til: 'liv@x.no', rolle: 'innkjoper' }).status, 400, 'skogeier til skogeier');
  assert.equal(n.be('ola@x.no', { til: 'kjop@x.no', rolle: 'entreprenor' }).status, 400, 'innkjøperen er ikke entreprenør');
  assert.equal(n.be('ola@x.no', { til: 'ukjent@x.no', rolle: 'innkjoper' }).status, 404); assert.equal(n.be('ola@x.no', { til: 'ola@x.no', rolle: 'innkjoper' }).status, 400);
  // Entreprenør inviterer skogeier med e-post; skogeieren ber om det samme → godtas automatisk.
  const k2 = n.be('ent@x.no', { til: 'Liv@X.no', rolle: 'entreprenor' }); assert.equal(k2.status, 'foresporsel');
  assert.equal(n.be('liv@x.no', { til: 'ent@x.no', rolle: 'entreprenor' }).status, 'aktiv');
  assert.equal(n.be('off@x.no', { til: 'liv@x.no', rolle: 'innkjoper' }).status, 400, 'offentlig kan ikke koble seg som innkjøper');
  // Chat og uleste
  tid += 1000; assert.ok(n.send('ola@x.no', k1.kobling, '  Hei, har du pris på gran?  ').ok); tid += 1000; n.send('ola@x.no', k1.kobling, 'Ca. 500 m³');
  let o = n.oversikt('kjop@x.no'); assert.equal(o.ulest, 2); assert.equal(o.koblinger[0].siste.tekst, 'Ca. 500 m³'); assert.equal(o.koblinger[0].motpart.navn, 'Ola Skog');
  const m = n.meldinger('kjop@x.no', k1.kobling); assert.equal(m.meldinger.length, 2); assert.equal(m.meldinger[0].tekst, 'Hei, har du pris på gran?'); assert.ok(!m.meldinger[0].fraMeg);
  assert.equal(n.oversikt('kjop@x.no').ulest, 0, 'lest etter henting'); assert.ok(n.meldinger('ola@x.no', k1.kobling).meldinger.every((x) => x.lest), 'avsender ser «lest»');
  assert.equal(n.meldinger('ola@x.no', k1.kobling, { etter: m.meldinger[0].tid }).meldinger.length, 1, 'bare nye meldinger');
  assert.equal(n.meldinger('liv@x.no', k1.kobling).status, 404, 'andre har ikke tilgang'); assert.equal(n.send('ola@x.no', k1.kobling, '   ').status, 400);
  assert.equal(n.send('ola@x.no', k1.kobling, 'x'.repeat(5000)).melding.tekst.length, 2000);
  for (let i = 0; i < 40; i++) n.send('liv@x.no', k2.kobling, `m${i}`); assert.equal(n.send('liv@x.no', k2.kobling, 'for mye').status, 429, 'spamgrense');
  // Avslutt og slett
  assert.equal(n.svar('kjop@x.no', k1.kobling, 'avslutt').status, 'avsluttet'); assert.equal(n.send('ola@x.no', k1.kobling, 'hei').status, 409);
  assert.equal(n.aktorer('ola@x.no').find((x) => x.bruker === 'kjop@x.no').kobling, null, 'kan be om ny kobling etter avslutning');
  n.slettBruker('liv@x.no'); assert.equal(n.oversikt('ent@x.no').koblinger.length, 0);
  // HTTP
  const kjor = (metode, url, bruker, kropp) => new Promise((ok) => { const h = {}; const req = { method: metode, url, headers: {}, on: (e, f) => { h[e] = f; if (e === 'end') setTimeout(() => { if (kropp) h.data?.(Buffer.from(JSON.stringify(kropp))); f(); }, 0); }, destroy() {} }; const res = { writeHead(st) { this.s = st; }, end(b) { ok({ status: this.s, kropp: JSON.parse(b) }); } }; nettverkApi(n, { bruker: () => bruker }, req, res, new URL(url, 'http://x').pathname); });
  assert.equal((await kjor('GET', '/api/nettverk', null)).status, 401);
  assert.equal((await kjor('GET', '/api/nettverk', 'ola@x.no')).kropp.statistikk.innkjopere, 2);
  const ny = await kjor('POST', '/api/nettverk/koblinger', 'ola@x.no', { til: 'ent@x.no', rolle: 'entreprenor' }); assert.equal(ny.kropp.status, 'foresporsel');
  assert.equal((await kjor('PUT', `/api/nettverk/koblinger/${ny.kropp.kobling}`, 'ent@x.no', { handling: 'godta' })).kropp.status, 'aktiv');
  assert.equal((await kjor('POST', `/api/nettverk/koblinger/${ny.kropp.kobling}/meldinger`, 'ent@x.no', { tekst: 'Hei Ola!' })).status, 200);
  assert.equal((await kjor('GET', `/api/nettverk/koblinger/${ny.kropp.kobling}/meldinger`, 'ola@x.no')).kropp.meldinger[0].tekst, 'Hei Ola!');
  assert.equal((await kjor('GET', '/api/nettverk/aktorer?q=hogst', 'ola@x.no')).kropp.aktorer.length, 1);
});

test('Egne kartlag: GPX, KML og KMZ (med stiler, ExtendedData, MultiGeometry) og GeoJSON blir lag i planen', async () => {
  const EL = await import('../js/egne-lag.js');
  const gpx = `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>Mastefester</name></metadata>
    <wpt lat="60.3501" lon="10.5602"><ele>412.3</ele><name>Mast 17</name><desc>Nytt fundament &amp; bardun</desc><sym>Flag</sym></wpt>
    <rte><name>Kjørerute</name><rtept lat="60.1" lon="10.1"><name>A</name></rtept><rtept lat="60.2" lon="10.2"/></rte>
    <trk><name>Trasé</name><trkseg><trkpt lat="60.35" lon="10.56"/><trkpt lat="60.351" lon="10.565"/></trkseg><trkseg><trkpt lat="60.36" lon="10.57"/><trkpt lat="60.37" lon="10.58"/></trkseg></trk></gpx>`;
  const g = await EL.lesEgenFil('master.gpx', new TextEncoder().encode(gpx));
  assert.equal(g.navn, 'Mastefester'); assert.deepEqual(g.antall, { punkt: 1, linjer: 2, flater: 0 });
  const w = g.geojson.features[0]; assert.deepEqual(w.geometry.coordinates, [10.5602, 60.3501]);
  assert.deepEqual(w.properties, { navn: 'Mast 17', beskrivelse: 'Nytt fundament & bardun', symbol: 'Flag', hoyde: 412 });
  assert.equal(g.geojson.features[1].properties.navn, 'Kjørerute'); assert.equal(g.geojson.features[2].geometry.type, 'MultiLineString');
  const kml = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Statnett tiltak</name>
    <Style id="s1"><IconStyle><color>ff0000ff</color></IconStyle></Style><StyleMap id="m1"><Pair><key>normal</key><styleUrl>#s1</styleUrl></Pair></StyleMap>
    <Folder><name>Master</name><Placemark><name>M1</name><styleUrl>#m1</styleUrl><ExtendedData><Data name="Eier"><value>Statnett</value></Data></ExtendedData><Point><coordinates>10.56,60.35,0</coordinates></Point></Placemark>
    <Placemark><name><![CDATA[Ryddebelte]]></name><description><![CDATA[<b>40 m</b> bredde]]></description><Polygon><outerBoundaryIs><LinearRing><coordinates>10.5,60.3 10.6,60.3 10.6,60.4</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
    <Placemark><MultiGeometry><Point><coordinates>10.1,60.1</coordinates></Point><LineString><coordinates>10.1,60.1 10.2,60.2</coordinates></LineString></MultiGeometry></Placemark></Folder></Document></kml>`;
  const k = await EL.lesEgenFil('tiltak.kml', new TextEncoder().encode(kml));
  assert.equal(k.navn, 'Statnett tiltak'); assert.deepEqual(k.antall, { punkt: 2, linjer: 1, flater: 1 });
  assert.deepEqual(k.geojson.features[0].properties, { navn: 'M1', data: { Eier: 'Statnett' }, farge: '#ff0000' });
  assert.equal(k.geojson.features[1].properties.beskrivelse, '40 m bredde');
  const ring = k.geojson.features[1].geometry.coordinates[0]; assert.deepEqual(ring[0], ring[ring.length - 1], 'ringen lukkes');
  // KMZ: ZIP med et bilde først og doc.kml (deflate) etterpå
  const zip = (filer) => {
    const lok = []; const sentral = []; let off = 0;
    for (const [navn, data, komp] of filer) {
      const n = Buffer.from(navn); const d = komp ? zlib.deflateRawSync(data) : Buffer.from(data);
      const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(komp ? 8 : 0, 8); h.writeUInt32LE(d.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
      const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(komp ? 8 : 0, 10); c.writeUInt32LE(d.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(off, 42);
      lok.push(h, n, d); sentral.push(c, n); off += 30 + n.length + d.length;
    }
    const cd = Buffer.concat(sentral); const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(filer.length, 8); e.writeUInt16LE(filer.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
    return new Uint8Array(Buffer.concat([...lok, cd, e]));
  };
  const kmz = await EL.lesEgenFil('tiltak.kmz', zip([['files/ikon.png', Buffer.alloc(50, 1), false], ['doc.kml', Buffer.from(kml), true]]), { inflate: (d) => zlib.inflateRawSync(d) });
  assert.deepEqual(kmz.antall, k.antall);
  await assert.rejects(EL.lesEgenFil('x.kmz', zip([['a.txt', Buffer.from('hei'), false]])), /Fant ingen KML/);
  await assert.rejects(EL.lesEgenFil('tom.gpx', new TextEncoder().encode('<gpx></gpx>')), /Fant ingen/);
  await assert.rejects(EL.lesEgenFil('utm.geojson', new TextEncoder().encode(JSON.stringify({ type: 'Point', coordinates: [600000, 6700000] }))), /WGS84/);
  const gj = await EL.lesEgenFil('poster.geojson', new TextEncoder().encode(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [10, 60] }, properties: { name: 'Post 1', nr: 1 } }] })));
  assert.equal(gj.geojson.features[0].properties.navn, 'Post 1'); assert.equal(gj.geojson.features[0].properties.data.nr, '1');
  const l1 = EL.nyttLag(g, { id: 'lag1', filnavn: 'master.gpx' }); const l2 = EL.nyttLag(k, { id: 'lag2', brukte: [l1.farge] });
  assert.equal(l1.navn, 'Mastefester'); assert.notEqual(l1.farge, l2.farge); assert.equal(l1.synlig, true);
  assert.match(EL.popupHtml(w.properties, l1), /Mast 17[\s\S]*412 moh/); assert.doesNotMatch(EL.popupHtml({ navn: '<script>' }), /<script>/);
  assert.equal(EL.antallTekst(k.antall), '2 punkt, 1 linje, 1 flate');
  assert.ok(EL.ER_EGET_LAG.test('A.KMZ') && !EL.ER_EGET_LAG.test('plan.sos'));
});

test('Versjonslogg: følger versjonsnummeret, er sortert, «nytt siden sist» og CHANGELOG.md er oppdatert', () => {
  assert.equal(LOGG.ENDRINGER[0].versjon, VERSJON, 'første oppføring er gjeldende versjon');
  for (let i = 1; i < LOGG.ENDRINGER.length; i++) { const a = LOGG.ENDRINGER[i - 1]; const b = LOGG.ENDRINGER[i]; assert.ok(LOGG.nyere(a.versjon, b.versjon), `${a.versjon} før ${b.versjon}`); assert.ok(a.dato >= b.dato, `dato ${a.dato} ≥ ${b.dato}`); }
  for (const e of LOGG.ENDRINGER) { assert.ok(LOGG.TYPE[e.type], e.versjon); assert.match(e.dato, /^\d{4}-\d{2}-\d{2}$/); assert.ok(e.tittel && e.tekst); }
  assert.ok(LOGG.nyere('1.10.0', '1.9.0')); assert.ok(!LOGG.nyere('1.9.0', '1.10.0')); assert.ok(!LOGG.nyere('1.5.0', '1.5.0'));
  assert.deepEqual(LOGG.sidenSist('1.56.0').map((e) => e.versjon).slice(-1), ['1.57.0']); assert.deepEqual(LOGG.sidenSist(null), []); assert.deepEqual(LOGG.sidenSist(VERSJON), []);
  const h = LOGG.html({ nye: new Set([VERSJON]), antall: 2 }); assert.equal((h.match(/<li/g) || []).length, 2); assert.match(h, /ny-for-deg/); assert.match(h, /nytt siden sist/);
  assert.equal(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'), LOGG.markdown(), 'CHANGELOG.md lages fra js/endringslogg.js');
  assert.equal(UTGITT_APP, LOGG.ENDRINGER[0].dato, 'UTGITT i versjon.js følger loggen');
});

await Promise.all(venter);
console.log(`\n${ok} tester bestått`);
