// Kjør med: node tests/run.mjs        (LIVE=1 node tests/run.mjs tester også mot de ekte datatjenestene)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bbox, punktIPolygon, avstandTilGrense, avstandM, retning, himmelretning, utm, utmTekst, fliserFor, flisBbox3857, flisX, flisY, gpx } from '../js/geo.js';
import { wmsUrl, WMS, flisUrl, BAKGRUNNER, tolkTeig, teigNavn, teigI, hoydeI, lesGeoJson } from '../js/kilder.js';
import { plattform, erIos, erMobil, steg, etterpaa, gpsHjelp } from '../js/installer.js';
import { VERSJON, UTVIKLER } from '../js/versjon.js';
import { VALD, forbered, jaktfeltI, beskriv, valdTekst, feltTekst, etikettpunkt } from '../js/jaktfelt.js';
import { status as samjaktStatus, aktive, samjaktForVald, valider as validerSamjakt, osloDato, periodeTekst } from '../js/samjakt.js';
import { hashPassord, sjekkPassord, lagSesjon, lesSesjon, lagSperre } from '../server/auth.js';
import { sjekkGeometri } from '../server/api.js';

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

test('samjakt: periode, status og kontroll', () => {
  const s = { vald: [2, 3], fra: '2026-08-20', til: '2026-08-25' };
  assert.equal(samjaktStatus(s, '2026-08-19'), 'kommende');
  assert.equal(samjaktStatus(s, '2026-08-20'), 'aktiv');
  assert.equal(samjaktStatus(s, '2026-08-25'), 'aktiv');
  assert.equal(samjaktStatus(s, '2026-08-26'), 'avsluttet');
  assert.equal(aktive([s], '2026-08-22').length, 1);
  assert.equal(samjaktForVald(3, [s], '2026-08-22').length, 1);
  assert.equal(samjaktForVald(4, [s], '2026-08-22').length, 0);
  // Norsk dato uansett tidssone: 23.30 UTC 31. aug er 1. sep i Norge (sommertid).
  assert.equal(osloDato(new Date('2026-08-31T23:30:00Z')), '2026-09-01');
  const v = [1, 2, 3, 4, 5, 6];
  assert.equal(validerSamjakt(s, v), null);
  assert.match(validerSamjakt({ ...s, vald: [2] }, v), /minst to/);
  assert.match(validerSamjakt({ ...s, vald: [2, 9] }, v), /Ukjent vald/);
  assert.match(validerSamjakt({ ...s, til: '2026-08-19' }, v), /før startdato/);
  assert.match(validerSamjakt({ ...s, fra: '2026-02-30' }, v), /Ugyldig dato/);
  assert.equal(periodeTekst(s), '20. aug.–25. aug.');
});

test('innlogging: passord-hash og signert sesjon', async () => {
  const h = await hashPassord('et langt passord');
  assert.equal(await sjekkPassord('et langt passord', h), true);
  assert.equal(await sjekkPassord('feil passord', h), false);
  assert.equal(await sjekkPassord('x', undefined), false);
  const t = lagSesjon('hemmelig', 'trond', 1000);
  assert.equal(lesSesjon('hemmelig', t, 2000), 'trond');
  assert.equal(lesSesjon('annen', t, 2000), null); // feil nøkkel
  assert.equal(lesSesjon('hemmelig', t, 1000 + 13 * 3600e3), null); // utløpt
  const [d, sig] = t.split('.');
  const falsk = Buffer.from(JSON.stringify({ b: 'admin', utl: 9e15 })).toString('base64url');
  assert.equal(lesSesjon('hemmelig', `${falsk}.${sig}`, 2000), null); // endret innhold
  assert.ok(d);
  const sp = lagSperre({ maks: 2, vindu: 1000 });
  sp.feil('ip', 0); sp.feil('ip', 1);
  assert.equal(sp.sperret('ip', 2), true);
  assert.equal(sp.sperret('ip', 2000), false);
});

test('admin: kontroll av grensegeometri og navnepunkt', () => {
  const ok = sjekkGeometri({ type: 'Polygon', coordinates: [[[8.1, 60.9], [8.12, 60.9], [8.12, 60.91]]] });
  assert.equal(ok.type, 'MultiPolygon');
  assert.deepEqual(ok.coordinates[0][0].at(-1), [8.1, 60.9]); // ringen lukkes
  assert.match(sjekkGeometri({ type: 'Point', coordinates: [8, 60] }), /flate/);
  assert.match(sjekkGeometri({ type: 'Polygon', coordinates: [[[18, 60.9], [8.12, 60.9], [8.12, 60.91]]] }), /utenfor/);
  assert.match(sjekkGeometri({ type: 'Polygon', coordinates: [[[8.1, 60.9], [8.12, 60.9]]] }), /tre hjørner/);
  const g = { type: 'MultiPolygon', coordinates: [[[[8, 60], [8.1, 60], [8.1, 60.05], [8, 60.05], [8, 60]]], [[[9, 60], [9.01, 60], [9.01, 60.01], [9, 60]]]] };
  const e = etikettpunkt(g);
  assert.ok(punktIPolygon(e, { type: 'Polygon', coordinates: g.coordinates[0] })); // i den største delen
});

test('server: API, innlogging, samjakt og endring av jaktfelt', async () => {
  const { spawn } = await import('node:child_process');
  const os = await import('node:os');
  const dir = fs.mkdtempSync(`${os.tmpdir()}/nfv-test-`);
  const port = 18000 + Math.floor(Math.random() * 1000);
  const proc = spawn(process.execPath, ['server.js'], { cwd: new URL('..', import.meta.url).pathname, env: { ...process.env, PORT: String(port), DATA_DIR: dir, ADMIN_BRUKER: 'Trond', ADMIN_PASSORD: 'hemmelig-passord-1', USIKRE_KAPSLER: '1' }, stdio: 'ignore' });
  const U = `http://127.0.0.1:${port}/api/`;
  try {
    for (let i = 0; i < 50; i++) { try { await fetch(`${U}status`); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
    let kake = '';
    const kall = async (metode, sti, data, hoder = {}) => {
      const r = await fetch(U + sti, { method: metode, headers: { 'X-NFV': '1', 'Content-Type': 'application/json', Cookie: kake, ...hoder }, body: data ? JSON.stringify(data) : undefined });
      const sc = r.headers.get('set-cookie'); if (sc) kake = sc.split(';')[0];
      return { status: r.status, data: await r.json().catch(() => null) };
    };
    assert.equal((await kall('GET', 'status')).data.innlogget, null);
    assert.equal((await kall('GET', 'admin/logg')).status, 401);
    assert.equal((await kall('POST', 'login', { bruker: 'trond', passord: 'feil' })).status, 401);
    assert.equal((await kall('POST', 'login', { bruker: 'trond', passord: 'hemmelig-passord-1' }, { 'X-NFV': '' })).status, 403);
    assert.equal((await kall('POST', 'login', { bruker: 'TROND', passord: 'hemmelig-passord-1' })).data.innlogget, 'trond');
    assert.match(kake, /^nfv_sesjon=/);
    // Samjakt
    const idag = osloDato();
    const ny = await kall('POST', 'admin/samjakt', { vald: [3, 2], fra: idag, til: idag });
    assert.equal(ny.status, 201); assert.deepEqual(ny.data.samjakt.vald, [2, 3]);
    assert.equal((await kall('GET', 'samjakt')).data.samjakt.length, 1);
    assert.equal((await kall('POST', `admin/samjakt/${ny.data.samjakt.id}/avslutt`)).status, 200);
    assert.equal((await kall('GET', 'samjakt')).data.samjakt.length, 0); // avsluttet = borte fra appen
    assert.equal((await kall('GET', 'admin/samjakt')).data.samjakt[0].status, 'avsluttet');
    // Jaktfelt: flytt vald, endre grense, tilbakestill
    assert.equal((await kall('PUT', 'admin/jaktfelt/NF101', { vald: 4 })).status, 200);
    assert.equal((await kall('PUT', 'admin/jaktfelt/NF101', { vald: 9 })).status, 400);
    assert.equal((await kall('PUT', 'admin/jaktfelt/FINNESIKKE', { vald: 1 })).status, 404);
    const geo = { type: 'Polygon', coordinates: [[[8.1, 60.9], [8.12, 60.9], [8.12, 60.91], [8.1, 60.9]]] };
    assert.equal((await kall('PUT', 'admin/jaktfelt/NF101', { geometry: geo, etikett: [8.11, 60.902] })).status, 200);
    let fc = (await kall('GET', 'jaktfelt')).data;
    let f = fc.features.find((x) => x.properties.id === 'NF101');
    assert.equal(f.properties.vald, 4); assert.equal(f.properties.endretAv, 'trond'); assert.equal(f.geometry.coordinates[0][0].length, 4);
    assert.equal((await kall('DELETE', 'admin/jaktfelt/NF101')).status, 200);
    fc = (await kall('GET', 'jaktfelt')).data;
    f = fc.features.find((x) => x.properties.id === 'NF101');
    assert.equal(f.properties.vald, 1); assert.equal(f.properties.endret, undefined);
    // Passord og logg
    assert.equal((await kall('POST', 'admin/passord', { gammelt: 'hemmelig-passord-1', nytt: 'kort' })).status, 400);
    assert.equal((await kall('POST', 'admin/passord', { gammelt: 'hemmelig-passord-1', nytt: 'nytt-langt-passord' })).status, 200);
    const logg = (await kall('GET', 'admin/logg')).data.logg.map((l) => l.hva).join(' | ');
    assert.match(logg, /Opprettet samjakt vald 2 \+ 3/); assert.match(logg, /Tilbakestilte NF101/); assert.match(logg, /Byttet passord/);
    // Sikkerhetskopi: nedlasting uten sesjonsnøkkel, dagskopi og forrige versjon på disk
    const kopi = await kall('GET', 'admin/sikkerhetskopi');
    assert.equal(kopi.status, 200); assert.equal(kopi.data.type, 'nordfjella-villrein-sikkerhetskopi');
    assert.equal(kopi.data.data.samjakt.length, 1); assert.equal(kopi.data.data.hemmelighet, undefined);
    assert.ok((await kall('GET', 'admin/kopier')).data.kopier.length >= 1);
    assert.ok(fs.existsSync(`${dir}/nordfjella.forrige.json`));
    await kall('POST', 'logout');
    assert.equal((await kall('GET', 'admin/sikkerhetskopi')).status, 401);
    assert.equal((await kall('POST', 'login', { bruker: 'trond', passord: 'nytt-langt-passord' })).status, 200);
    // Data er lagret på disk og ikke tilgjengelig som fil
    const lagret = JSON.parse(fs.readFileSync(`${dir}/nordfjella.json`, 'utf8'));
    assert.equal(lagret.samjakt.length, 1); assert.ok(!JSON.stringify(lagret).includes('nytt-langt-passord'));
    for (const sti of ['server/api.js', 'verktoy/gpkg.py', '.lokaldata/nordfjella.json']) assert.equal((await fetch(`http://127.0.0.1:${port}/${sti}`)).status, 404, sti);
  } finally { proc.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
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
