// Kjør med: node tests/run.mjs        (LIVE=1 node tests/run.mjs tester også mot de ekte datatjenestene)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bbox, punktIPolygon, avstandTilGrense, avstandM, retning, himmelretning, utm, utmTekst, fliserFor, flisBbox3857, flisX, flisY, gpx } from '../js/geo.js';
import { wmsUrl, WMS, flisUrl, BAKGRUNNER, tolkTeig, teigNavn, teigI, hoydeI, lesGeoJson } from '../js/kilder.js';
import { plattform, erIos, erMobil, steg, etterpaa, gpsHjelp } from '../js/installer.js';
import { VERSJON, UTVIKLER } from '../js/versjon.js';
import { VALD, forbered, jaktfeltI, beskriv, valdTekst, feltTekst } from '../js/jaktfelt.js';

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

test('plattform for hjemskjerm-veiledning', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
  const chromeIos = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1';
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
  const samsung = 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36';
  const firefox = 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0';
  const messenger = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/480.0]';
  const pc = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
  assert.equal(plattform(iphone), 'ios-safari');
  assert.equal(plattform(ipad, { berøring: 5 }), 'ios-safari');
  assert.equal(plattform(ipad), 'pc'); // ekte Mac
  assert.equal(plattform(chromeIos), 'ios-annen');
  assert.equal(plattform(android), 'android-chrome');
  assert.equal(plattform(samsung), 'android-samsung');
  assert.equal(plattform(firefox), 'android-firefox');
  assert.equal(plattform(messenger), 'innebygd');
  assert.equal(plattform(pc), 'pc');
  assert.equal(plattform(iphone, { standalone: true }), 'installert');
  assert.equal(erMobil('ios-safari'), true);
  assert.equal(erMobil('pc'), false);
  assert.equal(erIos(iphone), true);
  assert.equal(erIos(android), false);
});

test('veiledningssteg finnes for alle plattformer', () => {
  for (const p of ['ios-safari', 'ios-annen', 'android-chrome', 'android-samsung', 'android-firefox', 'innebygd', 'pc']) assert.ok(steg(p).length >= 1, p);
  assert.match(steg('ios-safari').join(' '), /Legg til på Hjem-skjerm/);
  assert.match(steg('ios-safari', { ipad: true })[0], /øverst til høyre/);
  assert.match(steg('android-chrome', { harPrompt: true })[0], /Installer appen/);
  assert.match(steg('android-chrome')[1], /Installer app/);
  assert.equal(etterpaa(true).length, 3);
  assert.match(etterpaa(true)[2], /egen lagring/);
  assert.match(gpsHjelp(true), /Stedstjenester/);
  assert.match(gpsHjelp(false), /Android/);
});

test('versjon, utvikler og ikoner', () => {
  assert.match(VERSJON, /^\d+\.\d+\.\d+$/);
  assert.equal(UTVIKLER, 'Trond Harald Sand');
  const pakke = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(pakke.version, VERSJON);
  const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.webmanifest', import.meta.url)));
  for (const str of ['192x192', '512x512']) assert.ok(manifest.icons.some((i) => i.sizes === str && i.type === 'image/png'), str);
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'));
  for (const i of manifest.icons) assert.ok(fs.existsSync(new URL(`../${i.src}`, import.meta.url)), i.src);
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /rel="apple-touch-icon" href="ikoner\/apple-touch-icon\.png"/);
  assert.match(html, /Utviklet av Trond Harald Sand/);
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  for (const f of ['js/versjon.js', 'js/installer.js', 'ikoner/apple-touch-icon.png']) assert.ok(sw.includes(`'${f}'`), f);
});

test('valdkart: jaktfelt, vald og oppslag i punkt', () => {
  const fc = forbered(JSON.parse(fs.readFileSync(new URL('../data/jaktfelt.geojson', import.meta.url))));
  const p = (nr) => fc.features.find((f) => f.properties.nr === nr);
  assert.equal(fc.features.filter((f) => f.properties.type === 'jaktfelt').length, 132);
  assert.deepEqual([...new Set(fc.features.map((f) => f.properties.vald).filter(Boolean))].sort(), [1, 2, 3, 4, 5, 6]);
  // Navnepunktet ligger inne i sitt eget felt, og oppslaget finner feltet igjen.
  for (const f of fc.features.filter((x) => x.properties.type === 'jaktfelt')) {
    const e = f.properties;
    assert.ok(punktIPolygon(e.etikett, f.geometry), `etikett utenfor ${e.nr}`);
    const funnet = jaktfeltI(e.etikett, fc);
    assert.ok(funnet, e.nr);
    assert.ok(funnet === f || funnet.properties.type === 'tvist', `${e.nr} ga ${funnet.properties.nr}`);
  }
  const hallingskarvet = p('NF351');
  assert.equal(hallingskarvet.properties.navn, 'Hallingskarvet statsallmenning');
  assert.equal(valdTekst(hallingskarvet.properties), 'Vald 3 Hol');
  assert.equal(feltTekst(hallingskarvet.properties), 'NF351 Hallingskarvet statsallmenning');
  const b = beskriv(hallingskarvet.properties.etikett, fc);
  assert.equal(b.klasse, 'ok'); assert.equal(b.vald, 'Vald 3 Hol'); assert.ok(b.grense.meter > 0);
  assert.equal(p('NF601').properties.vald, 6); // Ulvik har NF6xx-nummer, men ikke valdnummer i fila
  assert.equal(beskriv([10.75, 59.91], fc).tekst, 'Ikke i noe jaktfelt i valdkartet');
  const tvist = fc.features.find((f) => f.properties.type === 'tvist');
  assert.equal(beskriv(tvist.properties.etikett, fc).klasse, 'feil');
  // Konverteringen fra UTM 32 stemmer med valdkartets utstrekning (395258–481104 Ø, 6708130–6779514 N).
  const [v, s, ø, n] = bbox(fc);
  const sv = utm([v, s], 32), nø = utm([ø, n], 32);
  assert.ok(sv.øst > 393000 && sv.øst < 397000 && nø.nord > 6778000 && nø.nord < 6781000, `${sv.øst} ${nø.nord}`);
  for (const nr of Object.keys(VALD)) assert.match(VALD[nr].farge, /^#[0-9a-f]{6}$/);
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
