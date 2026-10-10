// Kjør med: node tests/run.mjs        (LIVE=1 node tests/run.mjs tester også mot de ekte datatjenestene)
import assert from 'node:assert/strict';
import { punktIPolygon, overlapper, avstandTilFlate, arealM2, indrePunkt, utvidBbox } from '../js/geo.js';
import { tolkMatrikkel, finnKommune, gmlGeometri, parseBygninger, parseKulturminner, hentAlt, hentPlaner } from '../js/kilder.js';
import { analyser, sefrakNivaa, tidsrom, tolkPlanobjekt, veiledTiltak, TILTAK, raadForBygning, tittelFraSefrak } from '../js/analyse.js';
import { bygningstype, fylkeFor } from '../js/koder.js';

let ok = 0;
const venter = [];
const test = (navn, fn) => venter.push((async () => {
  try { await fn(); ok++; console.log(`✓ ${navn}`); } catch (e) { console.error(`✗ ${navn}\n  ${e.stack}`); process.exitCode = 1; }
})());

// Kvadrat ca. 110 × 55 m rundt (11.0, 60.0), med hull i nordøst.
const kvadrat = { type: 'Polygon', coordinates: [[[11.0, 60.0], [11.002, 60.0], [11.002, 60.001], [11.0, 60.001], [11.0, 60.0]], [[11.0015, 60.0007], [11.0018, 60.0007], [11.0018, 60.0009], [11.0015, 60.0009], [11.0015, 60.0007]]] };

test('punkt i polygon med hull', () => {
  assert.equal(punktIPolygon([11.001, 60.0005], kvadrat), true);
  assert.equal(punktIPolygon([11.0016, 60.0008], kvadrat), false);
  assert.equal(punktIPolygon([11.003, 60.0005], kvadrat), false);
});

test('overlapp, avstand, areal og indre punkt', () => {
  const ut = { type: 'Polygon', coordinates: [[[11.0019, 60.0002], [11.003, 60.0002], [11.003, 60.0004], [11.0019, 60.0004], [11.0019, 60.0002]]] };
  const langt = { type: 'Polygon', coordinates: [[[11.01, 60.01], [11.011, 60.01], [11.011, 60.011], [11.01, 60.01]]] };
  assert.equal(overlapper(ut, kvadrat), true);
  assert.equal(overlapper(langt, kvadrat), false);
  assert.equal(avstandTilFlate([11.001, 60.0005], kvadrat), 0);
  assert.ok(Math.abs(avstandTilFlate([11.001, 60.0011], kvadrat) - 11.1) < 0.5);
  const a = arealM2({ type: 'Polygon', coordinates: [kvadrat.coordinates[0]] });
  assert.ok(Math.abs(a - 111.5 * 111.3) / a < 0.02, `areal ${a}`);
  assert.equal(punktIPolygon(indrePunkt(kvadrat), kvadrat), true);
  const [x0, y0, x1, y1] = utvidBbox([11, 60, 11.002, 60.001], 100);
  assert.ok(x0 < 11 && y0 < 60 && x1 > 11.002 && y1 > 60.001);
});

test('tolker matrikkelnummer og kommune', () => {
  assert.deepEqual(tolkMatrikkel('Nannestad 32/16'), { kommune: 'Nannestad', gnr: 32, bnr: 16, fnr: 0, snr: 0 });
  assert.deepEqual(tolkMatrikkel('3238-32/16/2'), { kommune: '3238', gnr: 32, bnr: 16, fnr: 2, snr: 0 });
  assert.deepEqual(tolkMatrikkel('32 / 16'), { kommune: null, gnr: 32, bnr: 16, fnr: 0, snr: 0 });
  assert.equal(tolkMatrikkel('Storgata 1'), null);
  const kl = [{ nr: '3238', navn: 'Nannestad' }, { nr: '3240', navn: 'Eidsvoll' }, { nr: '3242', navn: 'Nes' }, { nr: '3243', navn: 'Nesodden' }];
  assert.equal(finnKommune('nannes', kl).nr, '3238');
  assert.equal(finnKommune('Nes', kl).nr, '3242');
  assert.equal(finnKommune('Ne', kl), null);
  assert.equal(finnKommune('3240', kl).navn, 'Eidsvoll');
});

const BYGG_GML = `<wfs:member><app:Bygning gml:id="b.1"><app:bygningsnummer>151854133</app:bygningsnummer><app:bygningsstatus>TB</app:bygningsstatus>
<app:harKulturminne>false</app:harKulturminne><app:harSefrakminne>true</app:harSefrakminne><app:bruksenhet><app:Bruksenhet><app:matrikkelenhetId>42</app:matrikkelenhetId></app:Bruksenhet></app:bruksenhet>
<app:representasjonspunkt><gml:Point srsName="urn:ogc:def:crs:EPSG::4258"><gml:pos>60.0005 11.0010</gml:pos></gml:Point></app:representasjonspunkt><app:bygningstype>182</app:bygningstype></app:Bygning></wfs:member>`;

test('leser bygninger fra WFS (lat/lon snus)', () => {
  const [b] = parseBygninger(BYGG_GML);
  assert.equal(b.bygningsnummer, '151854133');
  assert.equal(b.harSefrak, true);
  assert.deepEqual(b.matrikkelenhetId, ['42']);
  assert.deepEqual(b.geometri, { type: 'Point', coordinates: [11.001, 60.0005] });
  assert.equal(bygningstype(b.bygningstype), 'Garasje, uthus, anneks knyttet til fritidsbolig');
});

test('leser kulturminner med polygon og hull', () => {
  const xml = `<app:Enkeltminne gml:id="e.1"><app:informasjon>Gammel &amp; fin</app:informasjon><app:område><gml:Polygon><gml:exterior><gml:LinearRing><gml:posList>60.0 11.0 60.0 11.002 60.001 11.002 60.0 11.0</gml:posList></gml:LinearRing></gml:exterior>
<gml:interior><gml:LinearRing><gml:posList>60.0002 11.0012 60.0002 11.0015 60.0004 11.0015 60.0002 11.0012</gml:posList></gml:LinearRing></gml:interior></gml:Polygon></app:område>
<app:navn>Stue</app:navn><app:kulturminneId>123-1</app:kulturminneId><app:enkeltminnekategori>E-BYG</app:enkeltminnekategori><app:vern><app:Vern><app:vernetype>VED</app:vernetype></app:Vern></app:vern>
<app:linkKulturminnesøk>https://kulturminnesok.no/ra/lokalitet/123</app:linkKulturminnesøk></app:Enkeltminne>`;
  const [k] = parseKulturminner(xml, 'Enkeltminne');
  assert.equal(k.navn, 'Stue');
  assert.equal(k.vernetype, 'VED');
  assert.equal(k.informasjon, 'Gammel & fin');
  assert.equal(k.geometri.coordinates.length, 2);
  assert.deepEqual(k.geometri.coordinates[0][1], [11.002, 60.0]);
  assert.equal(gmlGeometri('<x/>'), null);
});

test('SEFRAK-nivå og datering', () => {
  assert.deepEqual(tidsrom('1800-1899'), { fra: 1800, til: 1899 });
  assert.equal(sefrakNivaa({ sefrakStatus: 2, tidsangivelse: '1800-1899' }), 4);
  assert.equal(sefrakNivaa({ sefrakStatus: 1, tidsangivelse: '1900-1924' }), 1);
  assert.equal(sefrakNivaa({ sefrakStatus: 0, tidsangivelse: '1750-1774' }), 0);
  assert.equal(sefrakNivaa({ sefrakStatus: 0, tidsangivelse: '1750-1774' }, true), 4, 'finnes i matrikkelen → vurderes etter datering');
  assert.equal(sefrakNivaa({ sefrakStatus: 1, vernevedtak: 'X' }), 5);
  assert.equal(tittelFraSefrak('STABBUR, GRANBERG, GRASMOVEIEN, MOREPPEN'), 'Stabbur, Granberg');
});

test('tolker planobjekter', () => {
  assert.equal(tolkPlanobjekt({ objekttypenavn: 'RpAngittHensynSone', angittHensyn: '570', hensynSonenavn: 'H570_1', 'arealplanId.planidentifikasjon': 'r1' }).kultur, true);
  assert.equal(tolkPlanobjekt({ objekttypenavn: 'KpStøySone', støy: '210' }).navn, 'Rød støysone');
  const f = tolkPlanobjekt({ objekttypenavn: 'KpArealformålOmråde', arealformål: '5100' });
  assert.equal(f.art, 'formal'); assert.equal(f.lnf, true);
  const p = tolkPlanobjekt({ objekttypenavn: 'RpOmråde', plannavn: 'Sentrum', plantype: '35', planstatus: '3', ikrafttredelsesdato: '2011-03-23Z', link: 'https://x' });
  assert.equal(p.art, 'plan'); assert.equal(p.plantype, 'Detaljregulering'); assert.equal(p.vedtatt, '2011-03-23');
  assert.equal(tolkPlanobjekt({ objekttypenavn: 'RbBevaringOmråde', reguleringsformål: '661' }).kultur, true);
});

const eiendom = { kommune: { nr: '3238', navn: 'Nannestad' }, gnr: 32, bnr: 16, fnr: 0, geometri: kvadrat, antallTeiger: 1, noyaktighet: [] };
const sefrakPost = (id, nr, status, tid, pt, navn) => ({ sefrakId: id, bygningsnummer: nr, sefrakStatus: status, tidsangivelse: tid, objektnavn: navn, yttervegg: 'Lafteverk', underbyggingsKonstr: 'Punktvis bæring. Stående trepeler (stabber e.l.)', geometri: { type: 'Point', coordinates: pt } });

test('analyse: SEFRAK før 1850, revet bygning og plan', () => {
  const bygninger = parseBygninger(BYGG_GML);
  const sefrak = [
    sefrakPost('0238-0201-099', 151854133, 2, '1800-1899', [11.0010, 60.0005], 'STABBUR, GRANBERG'),
    sefrakPost('0238-0201-500', 999, 0, '1850-1874', [11.0005, 60.0003], 'LÅVE, GRANBERG'),
    sefrakPost('0238-0201-600', 998, 1, '1900-1924', [11.01, 60.01], 'LANGT UNNA'),
  ];
  const planer = { objekter: [{ objekttypenavn: 'RpAngittHensynSone', angittHensyn: '570', hensynSonenavn: 'H570_1', 'arealplanId.planidentifikasjon': 'r1', punkter: [[11.001, 60.0005]] }], feil: [] };
  const r = analyser({ eiendom, bygninger, sefrak, planer });
  assert.equal(r.bygninger.length, 2, 'SEFRAK langt unna tas ikke med');
  const stabbur = r.bygninger.find((b) => b.bygningsnummer === '151854133');
  assert.equal(stabbur.nivaa, 4);
  assert.ok(stabbur.grunner.some((g) => g.nivaa === 3 && /kulturmiljø/.test(g.tekst)));
  const laave = r.bygninger.find((b) => b.sefrak?.sefrakId === '0238-0201-500');
  assert.equal(laave.revet, true);
  assert.equal(r.hoyesteNivaa, 4);
  assert.equal(r.teller.sefrakFor1850, 1);
  const titler = r.begrensninger.map((b) => b.tittel).join('\n');
  assert.match(titler, /eldre enn 1850/);
  assert.match(titler, /Bevaring i arealplan/);
  assert.ok(r.tilskudd.some((t) => t.navn === 'Kulturminnefondet'));
  assert.ok(raadForBygning(stabbur).some(([t]) => t === 'Laftet tømmer'));
  assert.ok(raadForBygning(stabbur).some(([t]) => t === 'Står på stabber'));
});

test('analyse: fredet bygning og automatisk fredet kulturminne i grunnen', () => {
  const bygninger = parseBygninger(BYGG_GML);
  const freda = [{ bygningsnummer: '151854133', navn: 'Stabburet', vernetype: 'VED', verneparagraf: '15', geometri: { type: 'Point', coordinates: [11.001, 60.0005] } }];
  const kulturminner = { Lokalitet: [{ type: 'Lokalitet', id: '9-1', navn: 'Gravfelt', kategori: 'L-ARK', vernetype: 'AUT', geometri: { type: 'Polygon', coordinates: [[[11.0001, 60.0001], [11.0003, 60.0001], [11.0003, 60.0002], [11.0001, 60.0001]]] } }], Enkeltminne: [], Sikringssone: [] };
  const r = analyser({ eiendom, bygninger, freda, kulturminner });
  assert.equal(r.bygninger[0].nivaa, 5);
  assert.equal(r.begrensninger[0].nivaa, 'streng');
  assert.ok(r.begrensninger.some((b) => /i grunnen/.test(b.tittel)));
  assert.ok(r.tilskudd.some((t) => /fredete/.test(t.navn)));
  assert.ok(r.sjekkliste.some((s) => /graving/.test(s)));
});

test('analyse: eiendom uten vern', () => {
  const r = analyser({ eiendom, bygninger: parseBygninger(BYGG_GML.replace('>true<', '>false<')) });
  assert.equal(r.hoyesteNivaa, 0);
  assert.equal(r.begrensninger.at(-1).tittel.startsWith('Gjelder alle bygninger'), true);
  assert.equal(r.tilskudd.some((t) => t.navn === 'Kulturminnefondet'), false);
});

test('tiltaksveileder dekker alle tiltak og nivåer', () => {
  for (const t of TILTAK) for (const n of [0, 1, 2, 3, 4, 5]) {
    const v = veiledTiltak(t.id, n);
    assert.ok(['fri', 'avklar', 'soknad', 'tillatelse'].includes(v.status), `${t.id}/${n}`);
    assert.ok(v.tekst.length > 20);
  }
  assert.equal(veiledTiltak('vinduer', 5).status, 'tillatelse');
  assert.equal(veiledTiltak('maling', 0).status, 'fri');
  assert.equal(veiledTiltak('riving', 4).status, 'soknad');
  assert.match(veiledTiltak('riving', 4).tekst, /fire uker/);
  assert.match(veiledTiltak('bruksendring', 1, { lnf: true }).tekst, /LNFR/);
});

test('fylkeskommune fra kommunenummer', () => {
  assert.equal(fylkeFor('3238').myndighet, 'Akershus fylkeskommune');
  assert.equal(fylkeFor('0301').myndighet, 'Byantikvaren i Oslo');
  assert.equal(fylkeFor('301').myndighet, 'Byantikvaren i Oslo');
  assert.equal(fylkeFor('5001').navn, 'Trøndelag');
});

if (process.env.LIVE) {
  test('LIVE: Nannestad 32/16 har SEFRAK-bygninger fra før 1850', async () => {
    const d = await hentAlt({ kommune: { nr: '3238', navn: 'Nannestad' }, gnr: 32, bnr: 16 });
    let r = analyser(d);
    d.planer = await hentPlaner([r.eiendom.senter, ...r.paaEiendom.map((b) => b.punkt)]);
    r = analyser(d);
    assert.ok(r.teller.sefrakFor1850 >= 1);
    assert.ok(r.planer.planer.length >= 1);
  });
}

await Promise.all(venter);
console.log(`\n${ok} av ${venter.length} tester ok`);
