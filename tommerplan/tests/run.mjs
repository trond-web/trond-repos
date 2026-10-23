// Kjør med: node tommerplan/tests/run.mjs
import assert from 'node:assert/strict';
import {
  planlegg, hogstRate, lassbererRate, turTimer, isoUke, tilDag, tilIso, iPeriode, sesong, driftTillatt, vegApen,
  neste_mandag, leveranseCsv, totalVolum, STANDARD_INNSTILLINGER as INN,
} from '../js/motor.js';
import { demoPlan } from '../js/demo.js';
import { lesCsv, finnKolonner, tolkSortiment, tall, dato, importerOrdre, ordreFraPlan, ordreCsv, MAL_CSV } from '../js/ordre.js';

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

test('CSV, tall, datoer og kolonnenavn fra VSYS-uttrekk', () => {
  const { kolonner, rader } = lesCsv('﻿Ordrenr;Sortiment;Volum\r\n1;"Sag, gran";"1 234,5"\r\n\r\n2;Massevirke gran;800\r\n');
  assert.deepEqual(kolonner, ['Ordrenr', 'Sortiment', 'Volum']);
  assert.equal(rader.length, 2);
  assert.equal(rader[0].Sortiment, 'Sag, gran');
  assert.equal(tall(rader[0].Volum), 1234.5);
  assert.equal(tall('1.234,50'), 1234.5);
  assert.equal(dato('3.1.2027'), '2027-01-03');
  assert.equal(dato('2027-01-03T00:00'), '2027-01-03');
  const k = finnKolonner(['Ordrenummer', 'Skogeier', 'Velteplass', 'Sortimentskode', 'Kvantum', 'Salgsordrenr', 'Fremkjørt']);
  assert.equal(k.ordrenr, 'Ordrenummer');
  assert.equal(k.leverandor, 'Skogeier');
  assert.equal(k.hentested, 'Velteplass');
  assert.equal(k.volum, 'Kvantum');
  assert.equal(k.kobletSo, 'Salgsordrenr');
  assert.equal(k.framkjort, 'Fremkjørt');
  assert.equal(lesCsv('a,b\n1,2').rader[0].b, '2');
});

test('sortimenter tolkes fra navn, og egne koder går foran', () => {
  assert.equal(tolkSortiment('Sagtømmer gran'), 'gs');
  assert.equal(tolkSortiment('Gran sagtømmer'), 'gs');
  assert.equal(tolkSortiment('Furu skurtømmer'), 'fs');
  assert.equal(tolkSortiment('Massevirke gran'), 'gm');
  assert.equal(tolkSortiment('Gran slipmasse'), 'gm');
  assert.equal(tolkSortiment('Furu cellulose'), 'fm');
  assert.equal(tolkSortiment('Bjørk massevirke'), 'lm');
  assert.equal(tolkSortiment('Energiflis'), 'en');
  assert.equal(tolkSortiment('1210'), null);
  assert.equal(tolkSortiment('1210', { 1210: 'gs' }), 'gs');
});

test('import av IO, SO og PO kobler til drift, mottak og lag', () => {
  const p = demoPlan('2026-10-26');
  const r = importerOrdre(p, MAL_CSV);
  assert.equal(r.feil, undefined);
  assert.deepEqual([r.io, r.so, r.po], [1, 2, 1]);
  assert.deepEqual(r.nyeDrifter, []);
  assert.deepEqual(r.nyeMottak, []);
  const io = p.ordre.io[0];
  assert.equal(io.drift, 'd1');
  assert.equal(io.linjer.length, 2);
  const so = p.ordre.so.find((x) => x.ordrenr === '500118');
  assert.equal(so.mottak, 'sag');
  assert.equal(so.fra, '2026-11-01');
  assert.equal(io.linjer[0].so, so.id); // IO–SO-kobling
  const po = p.ordre.po[0];
  assert.equal(po.drift, 'd1');
  assert.equal(po.lag, 'lag1');
  assert.equal(po.faktisk.produsert, 850);
  // Samme fil på nytt oppdaterer i stedet for å lage nye ordre
  importerOrdre(p, MAL_CSV);
  assert.equal(p.ordre.io.length, 1);
  assert.equal(p.ordre.so.length, 2);
});

test('ukjent drift og mottak opprettes, ukjente sortimentkoder meldes', () => {
  const p = { innstillinger: {}, lag: [lag], mottak: [], drifter: [] };
  const r = importerOrdre(p, 'Ordrenr;Skogeier;Hentested;Sortiment;Volum\n9;Kari;Nytt felt;Sagtømmer gran;300\n9;Kari;Nytt felt;1210;50\n', 'io');
  assert.deepEqual(r.nyeDrifter, ['Nytt felt']);
  assert.deepEqual(r.ukjenteSortimenter, ['1210']);
  assert.equal(p.drifter[0].lag, 'l');
  const s = importerOrdre(p, 'Ordrenr;Kunde;Leveringssted;Sortiment;Volum\n5;Sag AS;Sagbruket;Sagtømmer gran;300\n', 'so');
  assert.deepEqual(s.nyeMottak, ['Sagbruket']);
  assert.deepEqual(p.mottak[0].sortimenter, ['gs']);
  assert.ok(importerOrdre(p, 'Navn;Volum\nx;1\n').feil);
});

test('salgsordre styrer kvote per sortiment og periode, IO-volum styrer drifta', () => {
  const p = plan({
    mottak: [mottak({ kvote: 99999 })],
    ordre: {
      io: [{ id: 'io1', ordrenr: '1', drift: 'd', linjer: [{ sortiment: 'gs', volum: 400 }, { sortiment: 'gm', volum: 200 }] }],
      so: [
        { id: 's1', ordrenr: '10', mottak: 'm', fra: '2027-05-17', til: '2027-06-13', linjer: [{ sortiment: 'gs', volum: 400, pris: 500 }] },
        { id: 's2', ordrenr: '11', mottak: 'm', fra: '2027-05-03', til: '2027-07-11', linjer: [{ sortiment: 'gm', volum: 200 }] },
      ],
    },
  });
  const r = planlegg(p);
  assert.equal(Math.round(r.drifter[0].tot), 600); // fra IO, ikke drift.volum (1000)
  const gs = r.leveranser.filter((l) => l.sortiment === 'gs');
  assert.ok(gs.every((l) => l.dato >= '2027-05-17' && l.so === 's1'), gs.map((l) => l.dato).join(','));
  for (const u of r.uker) assert.ok(u.levert.gs <= 100 + 40 + 1e-6); // 400 m³ over 4 uker, hele lass kan gå ett lass over
  const so1 = r.ordre.so.find((x) => x.id === 's1');
  assert.equal(Math.round(so1.innenPeriode), 400);
  for (const so of r.ordre.so) assert.ok(so.levert <= so.volum + 1e-6, `${so.ordrenr}: ${so.levert} > ${so.volum}`); // ingen overlevering
  assert.equal(so1.verdi, 400 * 500);
  assert.equal(r.mottak[0].salgsordre, true);
  assert.equal(Math.round(r.ordre.io[0].levert), 600);
});

test('IO-linje koblet til SO leverer bare dit, og salg uten dekning varsles', () => {
  const p = plan({
    mottak: [mottak(), mottak({ id: 'nær', navn: 'Nær', lon: 10.92 })],
    ordre: {
      io: [{ id: 'io1', drift: 'd', linjer: [{ sortiment: 'gs', volum: 300, so: 's1' }] }],
      so: [
        { id: 's1', ordrenr: 'A', mottak: 'm', linjer: [{ sortiment: 'gs', volum: 300 }] },
        { id: 's2', ordrenr: 'B', mottak: 'nær', linjer: [{ sortiment: 'gs', volum: 900 }] },
      ],
    },
  });
  const r = planlegg(p);
  assert.ok(r.leveranser.length > 0 && r.leveranser.every((l) => l.mottak === 'm'));
  assert.ok(r.varsler.some((v) => /større enn det som er kjøpt inn/.test(v.tekst)));
  assert.ok(r.varsler.some((v) => /Salgsordre B/.test(v.tekst)));
});

test('produksjonsordre: faktisk produsert, framkjørt og transportert er startpunktet', () => {
  const p = plan({
    ordre: { po: [{ id: 'p1', ordrenr: '7', drift: 'd', faktisk: { produsert: 600, framkjort: 500, transportert: 300, dato: '2027-04-30' } }] },
  });
  const r = planlegg(p);
  const d = r.drifter[0];
  assert.equal(Math.round(d.levert), 1000);
  assert.equal(d.levertFor, 300);
  assert.equal(Math.round(r.uker.reduce((s, u) => s + u.hogd, 0)), 400); // bare resten hogges
  assert.equal(Math.round(r.nokkel.levert), 700); // planlagte lass etter statusdato
  assert.ok(d.start <= '2027-04-30');
  const forste = r.leveranser[0];
  assert.ok(forste.alder >= 3); // virket ved vegen ble lagt der før planstart
  assert.equal(r.ordre.po[0].drift, 'd');
});

test('ordreutkast fra planen og eksport av ordreplanen', () => {
  const p = demoPlan('2026-10-26');
  const r0 = planlegg(p);
  const n = ordreFraPlan(p, r0);
  assert.deepEqual(n, { io: 8, so: 3, po: 8 });
  const r = planlegg(p);
  assert.ok(Math.abs(r.nokkel.totVolum - r0.nokkel.totVolum) < 1);
  // SO-volumet spres jevnt over perioden, som er strengere enn en fast ukekvote
  assert.ok(r.nokkel.levert > 0.8 * r0.nokkel.levert, `${r.nokkel.levert} mot ${r0.nokkel.levert}`);
  assert.equal(r.varsler.filter((v) => v.niva === 'feil').length, 0);
  const csv = ordreCsv(p, r);
  const rader = csv.split('\r\n');
  assert.ok(rader[0].startsWith('﻿Ordretype;Ordrenr'));
  assert.equal(rader.filter((x) => x.startsWith('PO;')).length, 8);
  // Eksporten kan leses inn igjen
  const { rader: lest } = lesCsv(csv);
  assert.equal(lest.length, rader.length - 1);
});

test('ordreutkast dekker sortimenter som mangler salgsordre etter import', () => {
  const p = demoPlan('2026-10-26');
  importerOrdre(p, MAL_CSV);
  const r0 = planlegg(p);
  assert.ok(r0.varsler.some((v) => v.niva === 'feil' && /tar bare imot sortimentene/.test(v.tekst)));
  ordreFraPlan(p, r0);
  const r = planlegg(p);
  assert.equal(r.varsler.filter((v) => v.niva === 'feil').length, 0, r.varsler.filter((v) => v.niva === 'feil').map((v) => v.tekst).join(' | '));
  // Sagbruket har nå SO 500118 fra VSYS (gran) og ett utkast for resten av granen og furua
  const sag = p.ordre.so.filter((x) => x.mottak === 'sag');
  assert.equal(sag.length, 2);
  assert.deepEqual(sag[1].linjer.map((l) => l.sortiment), ['gs', 'fs']);
  assert.ok(!r.varsler.some((v) => /mangler salgsordre/.test(v.tekst)));
  assert.ok(r0.varsler.some((v) => /mangler salgsordre for \d+ m³ sagtømmer gran/.test(v.tekst)));
});

test('mangler koordinater: standardavstand brukes og meldes', () => {
  const r = planlegg(plan({ drifter: [drift({ lat: '', lon: '' })] }));
  assert.ok(r.nokkel.levert > 0);
  assert.ok(r.varsler.some((v) => /mangler koordinater/.test(v.tekst)));
});

console.log(`\n${ok} tester ok`);
