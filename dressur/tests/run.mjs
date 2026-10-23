// Kjør med: node tests/run.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  punkter, maksPoeng, gyldigKarakter, rund3, feilridningTrekk, dommerResultat, ekvipasjeResultat, rangering, manglerBegrunnelse, snittAvAndre,
} from '../public/js/beregning.js';
import { trekkRekkefolge, beregnStarttider, konflikter, rytterNokkel } from '../lib/startliste.js';
import { sjekkPamelding, rytterKategori } from '../lib/validering.js';
import { DEMOPROGRAMMER } from '../lib/demo.js';
import { tomDatabase } from '../lib/lagring.js';

let ok = 0;
const tester = [];
const test = (navn, fn) => tester.push([navn, fn]);

// Program i samme oppsett som LC:1 NRYF 2025: 17 øvelser × 1 og fire helhetskarakterer × 2 = 250 poeng, poeng / 2,5 = prosent
const lc = {
  type: 'standard', karakterSteg: 0.5,
  ovelser: Array.from({ length: 17 }, (_, i) => ({ punkt: '', tekst: `Øvelse ${i + 1}`, koeff: 1 })),
  helhet: ['Takt', 'Løsgjorthet og kontakt', 'Sits og hjelpere', 'Nøyaktighet'].map((tekst) => ({ tekst, koeff: 2 })),
};
const alle = (program, v) => Object.fromEntries(punkter(program).map((p) => [p.id, v]));

test('maks poeng og prosent som på LC-protokollen', () => {
  assert.equal(maksPoeng(lc), 250);
  const r = dommerResultat(lc, { karakterer: alle(lc, 7) });
  assert.equal(r.poeng, 175);
  assert.equal(r.prosent, 70);
  assert.equal(r.komplett, true);
  const halv = dommerResultat(lc, { karakterer: { ...alle(lc, 7), o1: 7.5 } });
  assert.equal(halv.prosent, 70.2); // 175,5 / 2,5
});

test('gyldige karakterer: 0–10 i halve, tideler for kür kunstnerisk', () => {
  assert.ok(gyldigKarakter(7.5, 0.5));
  assert.ok(gyldigKarakter(0, 0.5));
  assert.ok(gyldigKarakter(10, 0.5));
  assert.ok(!gyldigKarakter(7.3, 0.5));
  assert.ok(!gyldigKarakter(10.5, 0.5));
  assert.ok(!gyldigKarakter(-1, 0.5));
  assert.ok(!gyldigKarakter('', 0.5));
  assert.ok(gyldigKarakter(7.3, 0.1));
  const kur = DEMOPROGRAMMER.find((p) => p.type === 'kur');
  assert.equal(punkter(kur).find((p) => p.del === 'helhet').steg, 0.1);
  assert.equal(punkter(kur).find((p) => p.del === 'ovelse').steg, 0.5);
});

test('avrunding til 3 desimaler (§ 450.5.a)', () => {
  assert.equal(rund3(66.66666), 66.667);
  assert.equal(rund3(66.6664), 66.666);
  assert.equal(rund3(66.6665), 66.667);
  assert.equal(rund3(1.0005), 1.001); // flyttall: 1.0005 * 1000 = 1000.4999…
  assert.equal(rund3(null), null);
});

test('feilridning −0,5, −1,0 og eliminering, tekniske feil −0,5 per gang', () => {
  assert.equal(feilridningTrekk(0), 0);
  assert.equal(feilridningTrekk(1), 0.5);
  assert.equal(feilridningTrekk(2), 1.5);
  assert.equal(feilridningTrekk(3), null);
  const k = alle(lc, 7);
  assert.equal(dommerResultat(lc, { karakterer: k }, { feilridning: 1 }).prosent, 69.5);
  assert.equal(dommerResultat(lc, { karakterer: k }, { feilridning: 2, tekniske: ['hilsen'] }).prosent, 68);
});

test('flere dommere: snitt av prosent, status og dommermøte ved 7 prosentpoengs avvik', () => {
  const dommere = { C: 'a', E: 'b', M: 'c' };
  const prot = {
    C: { karakterer: alle(lc, 7), signert: 't' }, E: { karakterer: alle(lc, 6.5), signert: 't' }, M: { karakterer: alle(lc, 6.5), signert: 't' },
  };
  const r = ekvipasjeResultat(lc, dommere, prot, {});
  assert.equal(r.status, 'ferdig');
  assert.equal(r.prosent, 66.667);
  assert.equal(r.avvik, 5);
  assert.equal(r.dommermote, false);
  const ulik = ekvipasjeResultat(lc, dommere, { ...prot, M: { karakterer: alle(lc, 5.5), signert: 't' } }, {});
  assert.equal(ulik.prosent, rund3((70 + 65 + 55) / 3));
  assert.equal(ulik.avvik, 15);
  assert.equal(ulik.dommermote, true);
  const forel = ekvipasjeResultat(lc, dommere, { C: prot.C, E: { karakterer: { o1: 6 } } }, {});
  assert.equal(forel.status, 'foreløpig');
  assert.equal(forel.prosent, 70);
  assert.equal(ekvipasjeResultat(lc, dommere, {}, {}).status, 'ikke-startet-enda');
  assert.equal(ekvipasjeResultat(lc, dommere, prot, { feilridning: 3 }).status, 'eliminert');
  assert.equal(ekvipasjeResultat(lc, dommere, prot, { eliminert: true, elimGrunn: 'Halt hest' }).elimGrunn, 'Halt hest');
  assert.equal(ekvipasjeResultat(lc, dommere, prot, {}, 'trukket').status, 'trukket');
  // usignert dommer vises ikke med prosent
  assert.equal(forel.perDommer.E.prosent, null);
});

test('rangering: likhet blant de tre første avgjøres av allment inntrykk, under 50 % plasseres ikke, 1/4 premieres', () => {
  const lag = (id, prosent, helhetSum, status = 'ferdig') => ({ id, resultat: { prosent, helhetSum, kunstSum: helhetSum, harmoniSum: 0, koreografiSum: 0, status } });
  const { rader, antallPremier, startende } = rangering(lc, { premieAndel: 0.25 }, [
    lag('a', 68, 60), lag('b', 70, 50), lag('c', 68, 64), lag('d', 49.9, 40), lag('e', 62, 50), lag('f', 62, 55),
    lag('g', null, 0, 'eliminert'), lag('h', null, 0, 'trukket'), lag('i', 60, 50),
  ]);
  const plass = Object.fromEntries(rader.map((r) => [r.id, r.plassering]));
  assert.deepEqual(plass, { b: 1, c: 2, a: 3, e: 4, f: 4, i: 6, d: null, g: null, h: null });
  assert.equal(startende, 8); // trukket teller ikke, eliminert gjør
  assert.equal(antallPremier, 2);
  assert.deepEqual(rader.filter((r) => r.premie).map((r) => r.id), ['b', 'c']);
  assert.equal(rader.find((r) => r.id === 'd').godkjent, false);
});

test('clear round gir sløyfe til alle med 50 % eller mer, uten plassering', () => {
  const lag = (id, prosent) => ({ id, resultat: { prosent, helhetSum: 0, status: 'ferdig' } });
  const { rader } = rangering(lc, { clearRound: true }, [lag('a', 64), lag('b', 48)]);
  assert.deepEqual(rader.map((r) => [r.id, r.plassering, r.clearRound]), [['a', null, true], ['b', null, false]]);
});

test('kür: teknisk og kunstnerisk delt på to, tidsavvik −0,5 fra kunstnerisk, likhet etter kunstnerisk/harmoni/koreografi', () => {
  const kur = DEMOPROGRAMMER.find((p) => p.type === 'kur');
  const k = alle(kur, 7);
  for (const p of punkter(kur).filter((x) => x.del === 'helhet')) k[p.id] = 8;
  const r = dommerResultat(kur, { karakterer: k }, {});
  assert.equal(r.tekniskProsent, 70);
  assert.equal(r.kunstProsent, 80);
  assert.equal(r.prosent, 75);
  assert.equal(dommerResultat(kur, { karakterer: k }, { kurTidAvvik: true }).prosent, 74.75);
  assert.equal(dommerResultat(kur, { karakterer: k }, { feilridning: 2 }).prosent, 75); // ingen feilridning i kür
  const lag = (id, kunstSum, harmoniSum) => ({ id, resultat: { prosent: 70, kunstSum, harmoniSum, koreografiSum: 0, status: 'ferdig' } });
  const { rader } = rangering(kur, {}, [lag('a', 100, 8), lag('b', 100, 9), lag('c', 101, 1)]);
  assert.deepEqual(rader.map((x) => x.id), ['c', 'b', 'a']);
  assert.deepEqual(rader.map((x) => x.plassering), [1, 2, 3]);
});

test('karakter 0–4 krever begrunnelse, ikke vist øvelse får snittet av de andre', () => {
  const prot = { karakterer: { ...alle(lc, 7), o3: 4 }, kommentarer: {} };
  assert.deepEqual(manglerBegrunnelse(lc, prot), ['o3']);
  prot.kommentarer.o3 = 'Brudd i takten';
  assert.deepEqual(manglerBegrunnelse(lc, prot), []);
  const p2 = { karakterer: { o1: 6, o2: 7, o3: 8 } };
  assert.equal(snittAvAndre(lc, p2, 'o4'), 7);
  assert.equal(snittAvAndre(lc, { karakterer: { o1: 6, o2: 7 } }, 'o3'), 6.5);
});

test('trekning gir minst fem ekvipasjer mellom samme rytter', () => {
  let seed = 7;
  const tilf = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const liste = [];
  for (let i = 0; i < 12; i++) liste.push({ id: `x${i}`, rytter: { navn: `Rytter ${i}` } });
  for (let i = 0; i < 3; i++) liste.push({ id: `a${i}`, rytter: { navn: 'Anna Aas' } });
  const rekke = trekkRekkefolge(liste, tilf);
  assert.equal(rekke.length, 15);
  const pos = rekke.map((p, i) => (rytterNokkel(p) === 'anna aas' ? i : null)).filter((x) => x != null);
  for (let i = 1; i < pos.length; i++) assert.ok(pos[i] - pos[i - 1] > 5, `for tett: ${pos}`);
});

test('starttider med pause og minst 12 minutter mellom samme rytter', () => {
  const k = { starttid: '09:00', intervall: 7, pauseEtter: 2, pauseMin: 10 };
  const r = (navn) => ({ id: navn + Math.random(), rytter: { navn } });
  const tider = beregnStarttider(k, [r('A'), r('B'), r('C'), r('A')]);
  assert.deepEqual(tider.map((t) => t.starttid), ['09:00', '09:07', '09:24', '09:31']);
  const tett = beregnStarttider({ starttid: '10:00', intervall: 5 }, [r('A'), r('A')]);
  assert.deepEqual(tett.map((t) => t.starttid), ['10:00', '10:12']);
  assert.equal(tett[1].ekstraPause, true);
  const kl = [{ id: 'k1', navn: 'LA', dato: '2026-11-06' }, { id: 'k2', navn: 'LB', dato: '2026-11-06' }];
  const pam = [{ klasseId: 'k1', starttid: '10:00', rytter: { navn: 'A' } }, { klasseId: 'k2', starttid: '10:05', rytter: { navn: 'A' } }];
  assert.equal(konflikter(pam, kl).length, 1);
});

test('påmeldingskontroll: alder på hest, én klasse per dag i MA og høyere, ponni, frist', () => {
  const db = tomDatabase();
  db.programmer = [{ id: 'pma', nivaa: 'MA' }, { id: 'pla', nivaa: 'LA' }, { id: 'pmb', nivaa: 'MB' }];
  db.klasser = [
    { id: 'ma', navn: 'MA', programId: 'pma', dato: '2026-11-06', apen: true, status: 'planlagt' },
    { id: 'la', navn: 'LA', programId: 'pla', dato: '2026-11-06', apen: true, status: 'planlagt' },
    { id: 'mb', navn: 'MB', programId: 'pmb', dato: '2026-11-07', apen: true, status: 'planlagt' },
    { id: 'pony', navn: 'LA ponni', programId: 'pla', dato: '2026-11-07', apen: true, status: 'planlagt', ponni: true },
  ];
  const rytter = { navn: 'Test', epost: 't@e.no', fodselsaar: 2000 };
  const naa = new Date('2026-10-01');
  assert.deepEqual(sjekkPamelding({ rytter, hest: { navn: 'H', fodselsaar: 2015 }, klasseIder: ['la'] }, db, naa).feil, []);
  assert.match(sjekkPamelding({ rytter, hest: { navn: 'H', fodselsaar: 2015 }, klasseIder: ['ma', 'la'] }, db, naa).feil.join(), /én klasse per dag/);
  assert.match(sjekkPamelding({ rytter, hest: { navn: 'H', fodselsaar: 2021 }, klasseIder: ['mb'] }, db, naa).feil.join(), /minst 6 år/);
  assert.match(sjekkPamelding({ rytter, hest: { navn: 'H', fodselsaar: 2015, type: 'hest' }, klasseIder: ['pony'] }, db, naa).feil.join(), /ponni/);
  assert.match(sjekkPamelding({ rytter: { ...rytter, epost: 'x' }, hest: { navn: 'H', fodselsaar: 2015 }, klasseIder: ['la'] }, db, naa).feil.join(), /e-post/);
  db.stevne.pameldingsfrist = '2026-09-01T23:59';
  assert.match(sjekkPamelding({ rytter, hest: { navn: 'H', fodselsaar: 2015 }, klasseIder: ['la'] }, db, naa).feil.join(), /fristen/);
  db.stevne.tillatEtteranmelding = true;
  const etter = sjekkPamelding({ rytter, hest: { navn: 'H', fodselsaar: 2015 }, klasseIder: ['la'] }, db, naa);
  assert.deepEqual(etter.feil, []);
  assert.equal(etter.etteranmeldt, true);
  assert.equal(rytterKategori(2014, 2026), 'Children');
  assert.equal(rytterKategori(2009, 2026), 'Junior');
  assert.equal(rytterKategori(1990, 2026), 'Senior');
});

// ---------- ende-til-ende mot serveren ----------

test('API: påmelding → trekning → dommere fører og signerer → offisiell liste → protokoll til rytter', async () => {
  const mappe = fs.mkdtempSync(path.join(os.tmpdir(), 'dressur-'));
  process.env.DATA_DIR = mappe;
  process.env.SEKRETARIAT_PASSORD = 'test-passord-123';
  const { server } = await import('../server.js');
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const klient = () => {
    let cookie = '';
    return async (metode, sti, data) => {
      const svar = await fetch(base + sti, {
        method: metode, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
        body: data ? JSON.stringify(data) : undefined,
      });
      const sc = svar.headers.get('set-cookie');
      if (sc) cookie = sc.split(';')[0];
      const type = svar.headers.get('content-type') || '';
      return { status: svar.status, data: type.includes('json') ? await svar.json() : await svar.text() };
    };
  };
  try {
    const sek = klient();
    const anonym = klient();
    assert.equal((await anonym('GET', '/api/admin/oversikt')).status, 401);
    assert.equal((await sek('POST', '/api/logginn', { brukernavn: 'sekretariat', passord: 'feil' })).status, 401);
    assert.equal((await sek('POST', '/api/logginn', { brukernavn: 'sekretariat', passord: 'test-passord-123' })).data.rolle, 'sekretariat');
    const demo = await sek('POST', '/api/admin/demo', {});
    assert.equal(demo.status, 200);
    assert.equal((await anonym('POST', '/api/admin/demo', {})).status, 401);

    // Påmelding fra publikum
    const pam = await anonym('POST', '/api/paamelding', {
      rytter: { navn: 'Test Rytter', fodselsaar: 1999, klubb: 'Testklubb', epost: 'test@example.no' },
      hest: { navn: 'Testhest', fodselsaar: 2015, type: 'hest' }, klasser: ['k1'],
    });
    assert.equal(pam.status, 200, JSON.stringify(pam.data));
    const kode = pam.data.kode;
    assert.equal(pam.data.sum, 350);
    const dobbel = await anonym('POST', '/api/paamelding', {
      rytter: { navn: 'Test Rytter', fodselsaar: 1999, epost: 'test@example.no' }, hest: { navn: 'Testhest', fodselsaar: 2015 }, klasser: ['k1'],
    });
    assert.equal(dobbel.status, 400);
    assert.equal((await anonym('GET', `/api/mine?kode=${kode}`)).data.paameldinger.length, 1);

    // Startlisten er skjult til den publiseres
    assert.equal((await anonym('GET', '/api/startliste/k1')).data.rader.length, 0);
    const trekk = await sek('POST', '/api/admin/klasser/k1/trekning', {});
    assert.equal(trekk.status, 200);
    const oversikt = (await sek('GET', '/api/admin/oversikt')).data;
    const k1 = oversikt.klasser.find((k) => k.id === 'k1');
    assert.equal((await sek('PUT', '/api/admin/klasser/k1', { ...k1, startlistePublisert: true })).status, 200);
    const startliste = (await anonym('GET', '/api/startliste/k1')).data.rader;
    assert.equal(startliste.length, 5);
    assert.ok(startliste.every((r) => r.startnr && r.starttid));
    assert.equal(startliste[0].starttid, '09:00');

    // Dommerne logger inn
    const kari = klient();
    const ola = klient();
    assert.equal((await kari('POST', '/api/logginn', { brukernavn: 'kari', passord: demo.data.passord.kari })).data.rolle, 'dommer');
    assert.equal((await ola('POST', '/api/logginn', { brukernavn: 'ola', passord: demo.data.passord.ola })).data.rolle, 'dommer');
    assert.equal((await kari('GET', '/api/admin/oversikt')).status, 403);
    const kk = (await kari('GET', '/api/dommer/klasser/k1')).data;
    assert.equal(kk.minPosisjon, 'C');
    assert.equal(kk.hoveddommer, true);
    const punktIder = kk.program.punkter.map((p) => p.id);
    const fullt = (v) => Object.fromEntries(punktIder.map((id) => [id, v]));

    const [forste, andre, tredje] = startliste;
    // Ugyldig karakter avvises
    assert.equal((await kari('PUT', `/api/dommer/protokoll/${forste.id}`, { karakterer: { o1: 7.3 } })).status, 400);
    // Karakter 4 uten kommentar kan ikke signeres
    assert.equal((await kari('PUT', `/api/dommer/protokoll/${forste.id}`, { karakterer: { ...fullt(7), o2: 4 } })).status, 200);
    const uten = await kari('POST', `/api/dommer/protokoll/${forste.id}/signer`, {});
    assert.equal(uten.status, 400);
    assert.match(uten.data.feil, /begrunnes/);
    await kari('PUT', `/api/dommer/protokoll/${forste.id}`, { karakterer: { ...fullt(7), o2: 4 }, kommentarer: { o2: 'Mistet takten' } });
    // Bare hoveddommeren fører feilridning
    assert.equal((await ola('PUT', `/api/dommer/fradrag/${forste.id}`, { feilridning: 1 })).status, 403);
    assert.equal((await kari('PUT', `/api/dommer/fradrag/${forste.id}`, { feilridning: 1 })).status, 200);
    assert.equal((await kari('POST', `/api/dommer/protokoll/${forste.id}/signer`, {})).status, 200);
    // Signert protokoll kan ikke endres direkte, bare rettes med grunn
    assert.equal((await kari('PUT', `/api/dommer/protokoll/${forste.id}`, { karakterer: fullt(8) })).status, 409);
    assert.equal((await kari('POST', `/api/dommer/protokoll/${forste.id}/rett`, { punkt: 'o1', verdi: 7.5 })).status, 400);
    assert.equal((await kari('POST', `/api/dommer/protokoll/${forste.id}/rett`, { punkt: 'o1', verdi: 7.5, grunn: 'Skrivefeil' })).status, 200);

    // Foreløpig resultat etter én av to dommere
    let res = (await anonym('GET', '/api/resultater/k1')).data;
    let rad = res.rader.find((r) => r.id === forste.id);
    assert.equal(rad.status, 'foreløpig');
    assert.equal(rad.perDommer.E.prosent, null);

    // Ola (E) dømmer også, og ser ikke Karis karakterer
    const olaProt = (await ola('GET', `/api/dommer/protokoll/${forste.id}`)).data;
    assert.deepEqual(olaProt.protokoll.karakterer, {});
    await ola('PUT', `/api/dommer/protokoll/${forste.id}`, { karakterer: fullt(6.5) });
    assert.equal((await ola('POST', `/api/dommer/protokoll/${forste.id}/signer`, {})).status, 200);

    // Andre ekvipasje: begge gir 7 → 70 %; tredje elimineres
    for (const [d, v] of [[kari, 7], [ola, 7]]) {
      await d('PUT', `/api/dommer/protokoll/${andre.id}`, { karakterer: fullt(v) });
      assert.equal((await d('POST', `/api/dommer/protokoll/${andre.id}/signer`, {})).status, 200);
    }
    assert.equal((await kari('PUT', `/api/dommer/fradrag/${tredje.id}`, { eliminert: true })).status, 400); // grunn påkrevd
    assert.equal((await kari('PUT', `/api/dommer/fradrag/${tredje.id}`, { eliminert: true, elimGrunn: 'Halt hest' })).status, 200);

    // Ikke offisiell før alle startede er ferdig dømt – resten startet ikke
    for (const r of startliste.slice(3)) await kari('PUT', `/api/dommer/fradrag/${r.id}`, { ikkeStartet: true });
    res = (await anonym('GET', '/api/resultater/k1')).data;
    rad = res.rader.find((r) => r.id === forste.id);
    // Kari: 7 overalt unntatt o1 = 7,5 og o2 = 4 → (195 - 3 + 0,5) / 290 → minus 0,5 for feilridning; Ola: 6,5 → 65 % minus 0,5
    const maks = kk.program.maks;
    const kariP = rund3(((7 * maks / 10) - 3 + 0.5) / maks * 100 - 0.5);
    assert.equal(rad.perDommer.C.prosent, kariP);
    assert.equal(rad.perDommer.E.prosent, 64.5);
    assert.equal(rad.prosent, rund3((kariP + 64.5) / 2));
    assert.equal(res.rader[0].id, andre.id);
    assert.equal(res.rader[0].plassering, 1);
    assert.equal(res.rader[1].plassering, 2);
    assert.equal(res.rader.find((r) => r.id === tredje.id).status, 'eliminert');

    // Rytteren får ikke protokollen før listen er offisiell
    const minId = startliste.find((r) => r.rytter.navn === 'Test Rytter')?.id;
    assert.ok(minId);
    const ingen = await anonym('GET', `/api/protokoll/${minId}?kode=${kode}`);
    assert.equal(ingen.status, 409);
    assert.equal((await sek('POST', '/api/admin/klasser/k1/offisiell', { offisiell: true })).status, 200);
    assert.equal((await kari('PUT', `/api/dommer/fradrag/${forste.id}`, { feilridning: 0 })).status, 409);
    assert.equal((await anonym('GET', `/api/protokoll/${minId}?kode=FEILKODE`)).status, 403);
    const p = await anonym('GET', `/api/protokoll/${minId}?kode=${kode}`);
    assert.equal(p.status, 200);
    assert.equal(p.data.protokoller.length, 2);

    // Eksport og logg
    const csv = await sek('GET', '/api/admin/eksport/resultater-k1.csv');
    assert.match(csv.data, /Prosent/);
    const logg = (await sek('GET', '/api/admin/logg')).data;
    assert.ok(logg.some((l) => /Rettet/.test(l.hva)));
    // Data er lagret på disk
    assert.ok(fs.existsSync(path.join(mappe, 'dressur.json')));
    // Statiske sider og at serverfiler ikke serveres
    assert.equal((await anonym('GET', '/dommer')).status, 200);
    assert.equal((await anonym('GET', '/../server.js')).status, 404);
  } finally {
    server.close();
    fs.rmSync(mappe, { recursive: true, force: true });
  }
});

for (const [navn, fn] of tester) {
  try { await fn(); ok++; console.log('✓', navn); } catch (e) { console.error('✗', navn); console.error(e); process.exitCode = 1; }
}
console.log(`\n${ok} av ${tester.length} tester bestått.`);
