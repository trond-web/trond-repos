// Kjør med: node tommerplan/tests/run.mjs
import assert from 'node:assert/strict';
import {
  planlegg, hogstRate, lassbererRate, turTimer, isoUke, tilDag, tilIso, iPeriode, sesong, driftTillatt, vegApen,
  neste_mandag, leveranseCsv, totalVolum, STANDARD_INNSTILLINGER as INN,
} from '../js/motor.js';
import { demoPlan } from '../js/demo.js';

let ok = 0;
const test = (navn, fn) => { fn(); ok++; console.log('✓', navn); };

const lag = { id: 'l', navn: 'Lag', maskin: 'middels', timer: 9, flyttDager: 0 };
const mottak = (ekstra = {}) => ({ id: 'm', navn: 'Mottak', lat: 60, lon: 11, sortimenter: ['gs', 'gm'], kvote: 10000, ...ekstra });
const drift = (ekstra = {}) => ({
  id: 'd', navn: 'Drift', lat: 60, lon: 10.9, lag: 'l', rekkefolge: 1, hogstform: 'slutt', middelstamme: 0.35, terreng: 2,
  kjoreavstand: 300, vegklasse: 1, skogsbilveiKm: 1, velteplass: 5000, fore: 'helaar', volum: { gs: 600, gm: 400 }, ...ekstra,
});
const plan = (ekstra = {}) => ({ innstillinger: { startdato: '2027-05-03', uker: 10 }, lag: [lag], mottak: [mottak()], drifter: [drift()], ...ekstra });

test('datoer og ISO-uker', () => {
  assert.equal(tilIso(tilDag('2027-01-04')), '2027-01-04');
  assert.equal(isoUke(tilDag('2027-01-04')).uke, 1);
  assert.equal(isoUke(tilDag('2026-12-31')).uke, 53);
  assert.equal(isoUke(tilDag('2026-10-23')).uke, 43);
  assert.equal(neste_mandag('2026-10-23'), '2026-10-26');
  assert.equal(neste_mandag('2026-10-26'), '2026-10-26');
  assert.ok(iPeriode(2, 50, 12) && iPeriode(51, 50, 12) && !iPeriode(20, 50, 12));
});

test('sesong styrer føre og veg', () => {
  const vinter = sesong(tilDag('2027-02-01'), INN);
  const tele = sesong(tilDag('2027-04-20'), INN);
  const sommer = sesong(tilDag('2027-07-01'), INN);
  assert.ok(vinter.vinter && tele.tele && sommer.sommer);
  assert.ok(driftTillatt({ fore: 'frost' }, vinter) && !driftTillatt({ fore: 'frost' }, sommer));
  assert.ok(!driftTillatt({ fore: 'barmark' }, tele) && !driftTillatt({ fore: 'barmark' }, vinter) && driftTillatt({ fore: 'barmark' }, sommer));
  assert.ok(vegApen(1, tele) && !vegApen(3, tele) && vegApen(3, vinter) && vegApen(4, vinter) && !vegApen(5, vinter));
});

test('produktivitet følger middelstamme, terreng og kjøreavstand', () => {
  const liten = hogstRate(drift({ middelstamme: 0.1 }), lag);
  const stor = hogstRate(drift({ middelstamme: 0.6 }), lag);
  assert.ok(stor > 2 * liten);
  assert.ok(hogstRate(drift({ hogstform: 'tynning' }), lag) < hogstRate(drift(), lag));
  assert.ok(hogstRate(drift({ terreng: 5 }), lag) < hogstRate(drift({ terreng: 1 }), lag));
  const kort = lassbererRate(drift({ kjoreavstand: 200 }), lag);
  const lang = lassbererRate(drift({ kjoreavstand: 1200 }), lag);
  assert.ok(kort > 12 && kort < 25, `kort ${kort}`);
  assert.ok(lang < kort * 0.7);
});

test('turtid regnes fra skogsbilvei og offentlig vei', () => {
  const t = turTimer(drift(), mottak(), INN);
  // ca. 5,6 km luftlinje × 1,3 + 1 km skogsbilvei
  assert.ok(t > 1.4 && t < 1.8, `turtid ${t}`);
  assert.equal(turTimer(drift({ avstander: { m: 65 } }), mottak(), { ...INN, fartVei: 65 }), 2 * (1 / 25 + 1) + 0.75 + 0.4);
});

test('enkel drift: alt hogges, framkjøres og leveres', () => {
  const r = planlegg(plan());
  const d = r.drifter[0];
  assert.equal(Math.round(d.hogd), 1000);
  assert.equal(Math.round(d.levert), 1000);
  assert.equal(d.start, '2027-05-03');
  assert.ok(d.framkjortFerdig);
  assert.equal(Math.round(r.nokkel.levert), 1000);
  // Hele lass, unntatt rester når drifta er ferdig
  const hele = r.leveranser.filter((l) => Math.abs(l.m3 - 40) < 1e-6).length;
  assert.ok(hele >= 22, `hele lass ${hele}`);
  assert.equal(r.varsler.filter((v) => v.niva === 'feil').length, 0);
  assert.ok(totalVolum(drift()) === 1000);
});

test('kvote begrenser leveransen per uke', () => {
  const r = planlegg(plan({ mottak: [mottak({ kvote: 200 })] }));
  for (const u of r.uker) assert.ok(u.perMottak.m <= 200 + 1e-6, `uke ${u.uke}: ${u.perMottak.m}`);
  assert.ok(r.nokkel.maksLager > 300);
});

test('full velteplass bremser lassbæreren og gir varsel', () => {
  const r = planlegg(plan({ drifter: [drift({ velteplass: 120 })], mottak: [mottak({ kvote: 80 })] }));
  assert.ok(r.drifter[0].fullDager > 0);
  assert.ok(r.varsler.some((v) => /full/.test(v.tekst)));
});

test('sommerlagring over grensen gir varsel om blåved og barkbille', () => {
  const r = planlegg(plan({ innstillinger: { startdato: '2027-06-07', uker: 8 }, mottak: [mottak({ kvote: 40 })] }));
  assert.ok(r.varsler.some((v) => /blåved/.test(v.tekst)));
});

test('vinterdrift venter til frost, og teleløsning stenger klasse 3-veg', () => {
  const r = planlegg(plan({ innstillinger: { startdato: '2026-11-02', uker: 8 }, drifter: [drift({ fore: 'frost' })] }));
  assert.ok(r.drifter[0].start >= '2026-12-07', r.drifter[0].start); // uke 50
  assert.ok(r.lag[0].ventDager > 0);

  const t = planlegg(plan({ innstillinger: { startdato: '2027-03-29', uker: 6 }, drifter: [drift({ vegklasse: 3 })] }));
  const iTele = t.leveranser.filter((l) => isoUke(tilDag(l.dato)).uke >= 14 && isoUke(tilDag(l.dato)).uke <= 19);
  assert.equal(iTele.length, 0);
  assert.ok(t.varsler.some((v) => /teleløsning\) uke 14–18/.test(v.tekst)));
});

test('lag går gjennom køen i rekkefølge med flyttedag', () => {
  const p = plan({
    lag: [{ ...lag, flyttDager: 1 }],
    drifter: [drift({ id: 'a', navn: 'A', rekkefolge: 2, volum: { gs: 200 } }), drift({ id: 'b', navn: 'B', rekkefolge: 1, volum: { gs: 200 } })],
  });
  const r = planlegg(p);
  const b = r.drifter.find((d) => d.id === 'b');
  const a = r.drifter.find((d) => d.id === 'a');
  assert.ok(b.start < a.start);
  assert.ok(r.lag[0].segmenter.some((s) => s.type === 'flytt'));
});

test('demo-planen går gjennom uten feil og leverer det meste', () => {
  const p = demoPlan('2026-10-26');
  const r = planlegg(p);
  assert.equal(r.uker.length, 36);
  assert.equal(r.varsler.filter((v) => v.niva === 'feil').length, 0);
  assert.ok(r.nokkel.levert > 0.8 * r.nokkel.totVolum, `levert ${r.nokkel.levert} av ${r.nokkel.totVolum}`);
  const csv = leveranseCsv(r, p);
  assert.ok(csv.split('\r\n').length === r.leveranser.length + 1);
  assert.ok(csv.includes('Sagbruk (Eidsvoll)'));
});

test('drift uten mottak for sortimentet gir feil', () => {
  const r = planlegg(plan({ drifter: [drift({ volum: { gs: 100, en: 50 } })] }));
  assert.ok(r.varsler.some((v) => v.niva === 'feil' && /energivirke/.test(v.tekst)));
});

console.log(`\n${ok} tester ok`);
