// Kjør med: node tests/run.mjs        (LIVE=1 node tests/run.mjs tester også mot de ekte datatjenestene)
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  RAADHUS, penNavn, kategoriFor, tilVirksomhet, grupperSteder, hovedvirksomhet, velgAdresse, avstandKm, retning,
  tolkMet, vaerVed, symbolTekst, vindretningTekst, iParallell, hentVirksomheter, geokod, hentVaer, hentKjoreavstander,
} from '../js/kilder.js';

let ok = 0;
const venter = [];
const test = (navn, fn) => venter.push((async () => {
  try { await fn(); ok++; console.log(`✓ ${navn}`); } catch (e) { console.error(`✗ ${navn}\n  ${e.stack}`); process.exitCode = 1; }
})());

test('navn fra Enhetsregisteret blir lesbare', () => {
  assert.equal(penNavn('GRAN KOMMUNE SKJERVUM HELSE- OG OMSORGSSENTER'), 'Skjervum helse- og omsorgssenter');
  assert.equal(penNavn('BRANDBU BARNESKOLE SFO'), 'Brandbu barneskole SFO');
  assert.equal(penNavn('NAV LUNNER OG GRAN'), 'NAV Lunner og Gran');
  assert.equal(penNavn('GRAN KOMMUNE SØNDRE ÅLSVEGEN 72', ['Søndre', 'Ålsvegen']), 'Søndre Ålsvegen 72');
  assert.equal(penNavn('GRAN KOMMUNE NORDRE ÅLSVEG BOFELLESSKAP', ['Nordre', 'Ålsvegen']), 'Nordre Ålsveg bofellesskap');
  assert.equal(penNavn('GRAN KOMMUNE'), 'Gran kommune');
  assert.equal(penNavn('RAKALAUV BARNEHAGE SA'), 'Rakalauv barnehage SA');
});

test('kategorier ut fra næringskode og navn', () => {
  assert.equal(kategoriFor({ naeringskode: '85.201', navn: 'JAREN SKOLE' }), 'skole');
  assert.equal(kategoriFor({ naeringskode: '88.910', navn: 'JAREN SFO' }), 'skole');
  assert.equal(kategoriFor({ naeringskode: '88.910', navn: 'ARENA LUNNER' }), 'kultur');
  assert.equal(kategoriFor({ naeringskode: '85.100', navn: 'MARKA BARNEHAGE' }), 'barnehage');
  assert.equal(kategoriFor({ naeringskode: '87.102', navn: 'SKJERVUM' }), 'helse');
  assert.equal(kategoriFor({ naeringskode: '86.210', navn: 'LUNNER OG GRAN INTERKOMMUNALE LEGEVAKT' }), 'beredskap');
  assert.equal(kategoriFor({ naeringskode: '84.250', navn: 'LUNNER OG GRAN BRANN OG REDNING' }), 'beredskap');
  assert.equal(kategoriFor({ naeringskode: '36.000', navn: 'VANNVERK' }), 'teknisk');
  assert.equal(kategoriFor({ naeringskode: '91.111', navn: 'BIBLIOTEK' }), 'kultur');
  assert.equal(kategoriFor({ naeringskode: '84.110', navn: 'KOMMUNEDIREKTØR' }), 'raadhus');
  assert.equal(kategoriFor({ naeringskode: '85.100', navn: 'PRIVAT', kommunal: false }), 'andre');
});

const enhet = (orgnr, navn, kode, adresse, postnummer, ansatte = null) => ({
  organisasjonsnummer: orgnr, navn, naeringskode1: { kode, beskrivelse: '' }, antallAnsatte: ansatte,
  beliggenhetsadresse: { adresse: [adresse], postnummer, poststed: 'GRAN', kommunenummer: '3446' },
});

test('virksomheter grupperes per adresse, rådhuset kjennes igjen', () => {
  const v = [
    tilVirksomhet(enhet('1', 'TRINTOM SFO', '88.910', 'Søndre Ålsvegen 2', '2750', 20)),
    tilVirksomhet(enhet('2', 'TRINTOM SKOLE', '85.201', 'Søndre Ålsvegen 2', '2750', 66)),
    tilVirksomhet(enhet('3', 'GRAN KOMMUNE HJEMMETJENESTEN', '86.941', 'Rådhusvegen 39', '2770', 187)),
    tilVirksomhet(enhet('4', 'GRAN KOMMUNE KOMMUNEDIREKTØR', '84.110', 'RÅDHUSVEGEN 39', '2770', 41)),
    tilVirksomhet(enhet('5', 'MARKA HELSE', '87.102', 'Markavegen 22', '2760', 198)),
    tilVirksomhet(enhet('6', 'AKTIVITETSTILBUD MARKA', '88.102', 'Markavegen  22', '2760')),
  ];
  const s = grupperSteder(v);
  assert.equal(s.length, 3);
  assert.equal(s[0].tittel, 'Gran rådhus');
  assert.equal(s[0].kategori, 'raadhus');
  assert.equal(s[0].virksomheter.length, 2);
  const trintom = s.find(x => x.adresse === 'Søndre Ålsvegen 2');
  assert.equal(trintom.tittel, 'Trintom skole');
  assert.equal(trintom.kategori, 'skole');
  assert.equal(s.find(x => x.postnummer === '2760').tittel, 'Marka helse');
  assert.equal(hovedvirksomhet({ virksomheter: [v[0]] }).navn, 'Trintom SFO');
});

test('c/o-linjer fjernes fra adressen', () => {
  const v = tilVirksomhet({ organisasjonsnummer: '9', navn: 'LEGE', naeringskode1: { kode: '86.210' }, beliggenhetsadresse: { adresse: ['c/o Gran legesenter', 'Hovsvegen 4'], postnummer: '2750', poststed: 'GRAN' } });
  assert.equal(v.adresse, 'Hovsvegen 4');
});

test('riktig treff velges fra adresseregisteret', () => {
  const treff = [
    { adressenavn: 'Skolevegen', nummer: 44, bokstav: '' },
    { adressenavn: 'Skolevegen', nummer: 5, bokstav: 'B' },
    { adressenavn: 'Skolevegen', nummer: 5, bokstav: '' },
  ];
  assert.equal(velgAdresse(treff, 'Skolevegen 5'), treff[2]);
  assert.equal(velgAdresse(treff, 'Skolevegen 5B'), treff[1]);
  assert.equal(velgAdresse(treff, 'Skolevegen 99'), treff[0]);
  assert.equal(velgAdresse([], 'x'), null);
});

test('avstand og retning fra rådhuset', () => {
  assert.equal(avstandKm(RAADHUS, RAADHUS), 0);
  // Bjoneroa skole ligger ca. 20 km nordvest for rådhuset
  const bjoneroa = { lat: 60.516333, lon: 10.296139 };
  const km = avstandKm(RAADHUS, bjoneroa);
  assert.ok(km > 19 && km < 20.5, `fikk ${km}`);
  assert.equal(retning(RAADHUS, bjoneroa), 'NV');
  assert.ok(Math.abs(avstandKm({ lat: 60, lon: 10 }, { lat: 61, lon: 10 }) - 111.2) < 0.1);
});

test('MET-varsel tolkes og nærmeste tidspunkt velges', () => {
  const met = { properties: { timeseries: [
    { time: '2026-10-19T10:00:00Z', data: { instant: { details: { air_temperature: 4.2, wind_speed: 3.1, wind_from_direction: 200, relative_humidity: 80 } }, next_1_hours: { summary: { symbol_code: 'lightrain' }, details: { precipitation_amount: 0.4 } } } },
    { time: '2026-10-19T11:00:00Z', data: { instant: { details: { air_temperature: 5.0, wind_speed: 2.0, wind_from_direction: 10, relative_humidity: 75 } }, next_6_hours: { summary: { symbol_code: 'cloudy' }, details: { precipitation_amount: 0 } } } },
  ] } };
  const s = tolkMet(met);
  assert.equal(s.length, 2);
  assert.deepEqual([s[0].temp, s[0].symbol, s[0].nedbor, s[0].nedborTimer], [4.2, 'lightrain', 0.4, 1]);
  assert.equal(s[1].nedborTimer, 6);
  assert.equal(vaerVed(s, '2026-10-19T10:20:00Z'), s[0]);
  assert.equal(vaerVed(s, '2026-10-19T10:40:00Z'), s[1]);
  assert.equal(vaerVed([], 0), null);
  assert.equal(symbolTekst('partlycloudy_night'), 'Delvis skyet');
  assert.equal(symbolTekst('heavyrainshowersandthunder_day'), 'Kraftige regnbyger og torden');
  assert.equal(vindretningTekst(200), 'sør');
  assert.equal(vindretningTekst(350), 'nord');
});

test('iParallell holder rekkefølgen og taket på samtidige kall', async () => {
  let aktive = 0, maks = 0;
  const ut = await iParallell([1, 2, 3, 4, 5, 6, 7], 3, async x => {
    aktive++; maks = Math.max(maks, aktive);
    await new Promise(r => setTimeout(r, 5 * (8 - x)));
    aktive--;
    return x * 2;
  });
  assert.deepEqual(ut, [2, 4, 6, 8, 10, 12, 14]);
  assert.ok(maks <= 3);
});

test('øyeblikksbildet har rådhuset og posisjon for alle steder', async () => {
  const d = JSON.parse(await readFile(new URL('../data/steder.json', import.meta.url)));
  assert.ok(d.steder.length > 30);
  assert.ok(d.steder[0].erRaadhus);
  for (const s of d.steder) {
    assert.ok(s.posisjon?.lat > 59.5 && s.posisjon.lat < 61 && s.posisjon.lon > 9.5 && s.posisjon.lon < 11.5, `${s.tittel} mangler gyldig posisjon`);
  }
  for (const k of ['skole', 'barnehage', 'helse']) assert.ok(d.steder.some(s => s.kategori === k), `ingen ${k}`);
});

if (process.env.LIVE) {
  test('LIVE: Enhetsregisteret, geokoding, MET og OSRM', async () => {
    const v = await hentVirksomheter();
    assert.ok(v.some(x => /Trintom skole/.test(x.navn)));
    const steder = grupperSteder(v);
    const raadhus = steder.find(s => s.erRaadhus);
    const pos = await geokod(raadhus);
    assert.ok(avstandKm(pos, RAADHUS) < 0.2);
    const vaer = await hentVaer(pos.lat, pos.lon);
    assert.ok(vaer.length > 24 && typeof vaer[0].temp === 'number');
    const kj = await hentKjoreavstander(RAADHUS, [{ lat: 60.516333, lon: 10.296139 }]);
    assert.ok(kj[0].km > 20 && kj[0].km < 40, `kjøring ${kj[0]?.km}`);
  });
}

await Promise.all(venter);
console.log(`\n${ok} av ${venter.length} tester ok`);
