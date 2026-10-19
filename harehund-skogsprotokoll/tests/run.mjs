// Kjør med: node tests/run.mjs
import assert from 'node:assert/strict';
import {
  beregn, beregnEP, lesLogg, losgrupper, premiegradFor, maksLospoeng, aktiveMomenter, gruppeForRase, alderMnd, klovdyrGrense, MIN,
} from '../js/regler.js';

const T0 = new Date('2025-11-15T08:00:00').getTime();
const kl = (m) => T0 + m * MIN; // minutter etter 08:00
let seq = 0;
const h = (m, type, ekstra = {}) => ({ id: `e${++seq}`, t: kl(m), seq, type, ...ekstra });
const prove = (hendelser, ekstra = {}) => ({ dato: '2025-11-15', hund: { gruppe: 'stover', rase: 'Dunker', fodt: '2022-03-01' }, hendelser, poeng: {}, ...ekstra });

let ok = 0;
const test = (navn, fn) => { fn(); ok++; console.log('✓', navn); };

test('premiegrad støver hare og rev, småhund', () => {
  assert.equal(premiegradFor('stover', 'hare', 120, 55), 1);
  assert.equal(premiegradFor('stover', 'hare', 119, 70), 2);
  assert.equal(premiegradFor('stover', 'hare', 90, 44), 3);
  assert.equal(premiegradFor('stover', 'hare', 65, 55), 3); // eksempelet fra Buskerud: 65 + 55 = 120 → 3. premie
  assert.equal(premiegradFor('stover', 'hare', 59, 80), 0);
  assert.equal(premiegradFor('stover', 'rev', 90, 55), 1);
  assert.equal(premiegradFor('stover', 'radyr', 90, 80), 0);
  assert.equal(premiegradFor('smahund', 'radyr', 90, 55), 1);
  assert.equal(premiegradFor('smahund', 'hare', 40, 35), 3);
  assert.equal(maksLospoeng('stover', 'hare'), 120);
  assert.equal(maksLospoeng('stover', 'rev'), 90);
  assert.equal(maksLospoeng('smahund', 'hare'), 90);
});

test('rase gir gruppe', () => {
  assert.equal(gruppeForRase('Beagle'), 'smahund');
  assert.equal(gruppeForRase('drever'), 'smahund');
  assert.equal(gruppeForRase('Finsk støver'), 'stover');
  assert.equal(alderMnd('2024-01-20', '2025-11-15'), 21);
  assert.deepEqual(klovdyrGrense(21), { enkelt: 20, sum: 40 });
  assert.deepEqual(klovdyrGrense(30), { enkelt: 10, sum: 20 });
});

test('enkel harelos: første minutt strekes ikke, løs-tid', () => {
  const p = prove([h(0, 'slipp'), h(20, 'fot'), h(65, 'uttak', { losdyr: 'hare' }), h(131, 'slutt'), h(360, 'avslutt')]);
  const r = beregn(p);
  assert.equal(r.logg.losTid, 360 * MIN);
  assert.equal(r.grupper.length, 1);
  assert.equal(r.premielos.hortMin, 65);
  assert.equal(r.lospoeng, 65);
  assert.equal(r.premielos.reg.fotTilUttak, 45);
  assert.equal(r.premielos.reg.uttakTil60, 61);
  assert.equal(r.premielos.reg.uttakTilSlutt, 66);
  assert.equal(r.premielos.reg.lengsteSekvens, 66);
});

test('ikke noterbare tap teller som los, noterbare gjør ikke', () => {
  const p = prove([
    h(0, 'slipp'), h(10, 'uttak', { losdyr: 'hare' }),
    h(40, 'tap'), h(43, 'gjentak'), // 3 min – ikke noterbart
    h(70, 'tap'), h(82, 'gjentak'), // 12 min – noterbart
    h(100, 'tap'), h(130, 'slutt'), // dødtap
    h(400, 'avslutt'),
  ]);
  const g = beregn(p).premielos;
  // hørt: 10–70 = 60 min (inkl. 3 min ikke noterbart tap) + 82–100 = 18 → 78 − 1 = 77
  assert.equal(g.hortMin, 77);
  assert.equal(g.reg.antallTap, 1);
  assert.equal(g.reg.lengsteTap, 12);
  assert.equal(g.reg.lengsteSekvens, 60);
  assert.equal(g.reg.uttakTilSlutt, 90);
});

test('LUH gir tillegg maks 20 per gang, og LUH+LPP kan ikke overstige hørt los', () => {
  const p = prove([
    h(0, 'slipp'), h(10, 'uttak', { losdyr: 'hare' }),
    h(51, 'utav', { modus: 'LUH' }), h(86, 'inn'), // 35 min LUH → 20
    h(100, 'utav', { modus: 'LUH' }), h(108, 'inn'), // 8 min → 8
    h(120, 'slutt'), h(400, 'avslutt'),
  ]);
  const g = beregn(p).premielos;
  assert.equal(g.hortMin, 41 + 14 + 12 - 1);
  assert.equal(g.luhLpp, 28);
  assert.equal(g.lospoeng, 66 + 28);
  const p2 = prove([h(0, 'slipp'), h(10, 'uttak', { losdyr: 'hare' }), h(16, 'utav', { modus: 'LPP' }), h(60, 'inn'), h(61, 'slutt'), h(400, 'avslutt')]);
  const g2 = beregn(p2).premielos;
  assert.equal(g2.hortMin, 6);
  assert.equal(g2.luhLpp, 6);
});

test('LUH og gjentak på 90 min eller mer gir ny los', () => {
  const p = prove([
    h(0, 'slipp'), h(10, 'uttak', { losdyr: 'hare' }), h(40, 'utav', { modus: 'LUH' }), h(140, 'inn'),
    h(180, 'tap'), h(275, 'gjentak'), h(300, 'slutt'), h(420, 'avslutt'),
  ]);
  const r = beregn(p);
  assert.equal(r.grupper.length, 3);
  assert.equal(r.grupper[0].hortMin, 29);
  assert.equal(r.grupper[0].luhLpp, 0);
  assert.equal(r.grupper[1].hortMin, 39);
  assert.equal(r.grupper[2].hortMin, 24);
});

test('full tid kappes på maks og varsles under pågående los', () => {
  const p = prove([h(0, 'slipp'), h(10, 'uttak', { losdyr: 'hare' })]);
  const r = beregn(p, kl(140));
  assert.equal(r.premielos.lospoeng, 120);
  assert.ok(r.premielos.fullTid);
  assert.ok(r.regelsjekk.some((v) => v.niva === 'feil' && /Full tid/.test(v.tekst)));
  const rev = beregn(prove([h(0, 'slipp'), h(10, 'uttak', { losdyr: 'rev' })]), kl(140));
  assert.equal(rev.premielos.lospoeng, 90);
});

test('LIB gir 20 lospoeng etter minst 30 min hørt los, og ny los samme art slås sammen', () => {
  const p = prove([
    h(0, 'slipp'), h(10, 'uttak', { losdyr: 'hare' }), h(50, 'lib'), h(51, 'kobling', { grunn: 'lib' }),
    h(70, 'slipp'), h(90, 'uttak', { losdyr: 'hare' }), h(120, 'slutt'), h(400, 'avslutt'),
  ]);
  const r = beregn(p);
  assert.equal(r.grupper.length, 1);
  const g = r.premielos;
  assert.equal(g.deler.length, 2);
  assert.equal(g.hortMin, 39 + 29);
  assert.equal(g.libTillegg, 20);
  assert.equal(g.lospoeng, 88);
  // LIB før 30 min: ingen tillegg uten sammenslåing som når 30
  const kort = beregn(prove([h(0, 'slipp'), h(10, 'uttak', { losdyr: 'hare' }), h(25, 'lib'), h(26, 'kobling', { grunn: 'lib' }), h(400, 'avslutt')]));
  assert.equal(kort.premielos.libTillegg, 0);
  // Dommeren kan oppheve sammenslåing
  const r2 = beregn({ ...p, losValg: { [r.grupper[0].deler[1].id]: { sammenslaa: false } } });
  assert.equal(r2.grupper.length, 2);
});

test('rådyr for småhund: bare lospoeng innen 180 min etter uttak', () => {
  const p = prove([h(0, 'slipp'), h(10, 'uttak', { losdyr: 'radyr' }), h(30, 'utav', { modus: 'LUH' }), h(200, 'inn'), h(260, 'slutt'), h(420, 'avslutt')], { hund: { gruppe: 'smahund', rase: 'Beagle' } });
  const r = beregn(p);
  // første los: 19 min hørt (LUH 170 min ≥ 90 → ny los), ny los 200–260 = 59
  assert.equal(r.grupper.length, 2);
  assert.equal(r.grupper[1].hortMin, 59);
});

test('aktive momenter etter lostid', () => {
  assert.equal(aktiveMomenter(null, false).ids.join(), 'jaktlyst,samarbeid,lydighet');
  assert.ok(aktiveMomenter(null, true).ids.includes('malbrukFot'));
  const kort = aktiveMomenter({ losdyr: 'hare', hortMin: 20 }, true).ids;
  assert.ok(!kort.includes('arbeidLos') && !kort.includes('kondisjon') && kort.includes('nyansering'));
  assert.equal(aktiveMomenter({ losdyr: 'hare', hortMin: 45 }, true).ids.length, 11);
});

test('komplett protokoll gir 1. premie, konkurransepoeng og regelsjekk', () => {
  const p = prove([h(0, 'slipp'), h(15, 'fot'), h(40, 'uttak', { losdyr: 'hare' }), h(161, 'slutt'), h(165, 'kobling', { grunn: 'fulltid' }), h(380, 'avslutt')], {
    poeng: { jaktlyst: 4, samarbeid: 3, fotarbeid: 4, malbrukFot: 4, malbrukTap: 5, arbeidLos: 4, arbeidTap: 3, nyansering: 3, horbarhet: 4, kondisjon: 5, lydighet: 4 },
    mal: 'T/F',
  });
  const r = beregn(p);
  assert.equal(r.lospoeng, 120);
  assert.equal(r.egenskapspoeng, 12 + 3 + 8 + 4 + 10 + 8 + 6 + 3 + 8);
  assert.equal(r.premiepoeng, 120 + 62);
  assert.equal(r.konkurransepoeng, 182 + 9);
  assert.equal(r.premiegrad, 1);
  assert.ok(r.regelsjekk.some((v) => v.moment === 'kondisjon'), 'kondisjon 5 under 6 timer skal varsles');
  assert.ok(r.regelsjekk.some((v) => v.moment === 'arbeidLos') === false);
});

test('under 5 timer løs varsles som T, og utfall nuller poengene', () => {
  const p = prove([h(0, 'slipp'), h(10, 'uttak', { losdyr: 'hare' }), h(70, 'slutt'), h(200, 'avslutt')], { poeng: { jaktlyst: 3 } });
  assert.ok(beregn(p).regelsjekk.some((v) => /under 5 timer/.test(v.tekst)));
  const g = beregn({ ...p, utfall: 'T' });
  assert.equal(g.premiepoeng, 0);
  assert.equal(g.premiegrad, 0);
});

test('klovdyrjag over grensen varsles', () => {
  const p = prove([h(0, 'slipp'), h(10, 'klovStart', { art: 'radyr' }), h(22, 'klovSlutt'), h(400, 'avslutt')]);
  assert.ok(beregn(p).regelsjekk.some((v) => /Klovdyrjag på 12 min/.test(v.tekst)));
  const ung = prove([h(0, 'slipp'), h(10, 'klovStart', { art: 'radyr' }), h(22, 'klovSlutt'), h(400, 'avslutt')], { hund: { gruppe: 'stover', fodt: '2024-06-01' } });
  assert.ok(!beregn(ung).regelsjekk.some((v) => /Klovdyrjag på/.test(v.tekst)));
});

test('eliteprøve summerer to dager', () => {
  const full = (poeng) => prove([h(0, 'slipp'), h(30, 'uttak', { losdyr: 'hare' }), h(151, 'slutt'), h(330, 'avslutt')], { poeng });
  const toppen = { jaktlyst: 4, samarbeid: 4, fotarbeid: 4, malbrukFot: 4, malbrukTap: 4, arbeidLos: 4, arbeidTap: 4, nyansering: 4, horbarhet: 4 };
  const ep = beregnEP(full(toppen), full(toppen));
  assert.equal(ep.premiepoeng, 2 * (120 + 64));
  assert.equal(ep.premie, 1);
  const svak = { ...toppen, jaktlyst: 3, horbarhet: 3 };
  const d2 = prove([h(0, 'slipp'), h(30, 'uttak', { losdyr: 'hare' }), h(111, 'slutt'), h(330, 'avslutt')], { poeng: svak });
  assert.equal(beregnEP(full(svak), d2).premie, 2);
  const kortDag = prove([h(0, 'slipp'), h(30, 'uttak', { losdyr: 'hare' }), h(151, 'slutt'), h(200, 'avslutt')], { poeng: toppen });
  assert.equal(beregnEP(full(toppen), kortDag).premie, 0);
});

console.log(`\n${ok} tester OK`);
