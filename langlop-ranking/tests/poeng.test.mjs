// Kjør: node --test langlop-ranking/tests/*.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { tidspoeng, bonus, distansevekt, kobleLopere, sammeNavn, slaSammenDuplikater, erLanglop, lagRanking, REGLER } from "../innsamling/poeng.mjs";
import { navnNokkel, snuNavn, tidTilTideler, sesongFor, penNavn } from "../innsamling/felles.mjs";

const rad = (navn, tid, ekstra = {}) => [navn, ekstra.klubb ?? "", ekstra.nasjon ?? "NOR", tid, ekstra.aar ?? null, ekstra.eq ?? null, ekstra.fis ?? null, ekstra.nif ?? null];

test("tidspoeng: vinneren får 100, saktere får mindre", () => {
  assert.equal(tidspoeng(1000, 1000), 100);
  assert.ok(Math.abs(tidspoeng(1000, 1100) - 75.13) < 0.01);
  assert.equal(tidspoeng(1000, 2000), 12.5);
});

test("plasseringsbonus og distansevekt", () => {
  assert.equal(bonus(1), 50);
  assert.equal(bonus(15), 2);
  assert.equal(bonus(16), 0);
  assert.equal(distansevekt(54), 1.0);
  assert.equal(distansevekt(42), 0.9);
  assert.equal(distansevekt(25), 0.8);
  assert.equal(distansevekt(null), 1.0);
});

test("navn: rekkefølge, komma og særnorske bokstaver", () => {
  assert.equal(snuNavn("Fleten, Emilie"), "Emilie Fleten");
  assert.equal(navnNokkel("Alnæs, Anikken Gjerde"), navnNokkel("Anikken Gjerde Alnæs"));
  assert.equal(navnNokkel("Håvard Solås Taugbøl"), navnNokkel("Havard Solas Taugbol"));
  assert.equal(penNavn("TAUGBØL Håvard Solås"), "Taugbøl Håvard Solås");
});

test("tider og sesonger", () => {
  assert.equal(tidTilTideler("2:23:17.7"), 85977);
  assert.equal(tidTilTideler("04:24:26"), 158660);
  assert.equal(tidTilTideler("1:50:22,6"), 66226);
  assert.equal(sesongFor("2026-03-21"), "2025-26");
  assert.equal(sesongFor("2025-08-01"), "2025-26");
  assert.equal(sesongFor("2026-11-21"), "2026-27");
});

test("kobling: FIS-kode slår sammen ulike navneformer, fødselsår skiller navnebrødre", () => {
  const rader = [
    { navn: "Ole Hansen", aar: 1980, eq: 1 },
    { navn: "Ole Hansen", aar: 1995, eq: 2 },
    { navn: "Ole Hansen", aar: 1980, eq: 3 }, // samme person, ny EQ-konto
    { navn: "Anikken Gjerde Alnæs", fis: "3425863" },
    { navn: "Anikken Alnaes Hagen", fis: "3425863" },
    { navn: "Kari Nordmann" },
    { navn: "Kari Nordmann" },
  ];
  const p = kobleLopere(rader);
  assert.equal(p[0], p[2]);
  assert.notEqual(p[0], p[1]);
  assert.equal(p[3], p[4]);
  assert.equal(p[5], p[6]);
});

test("samme løp hos Ski Classics og tidtakeren slås sammen", () => {
  assert.ok(sammeNavn("Holmenkollmarsjen 2026 – Holmenkollmarsjen 52km", "Holmenkollmarsjen"));
  assert.ok(sammeNavn("Furusjøen Rundt-rennet 2026", "Furusjen Rundt-rennet"));
  assert.ok(!sammeNavn("Trysil Skimaraton", "Hafjell Ski Marathon"));
  const eq = { id: "eq-1-1", kilde: "eq", navn: "Holmenkollmarsjen 52km", dato: "2026-02-14", km: 52, res: { M: [rad("Ola Elite", 8600), rad("Per Mosjon", 12000)], K: [] } };
  const sc = { id: "sc-1", kilde: "skiclassics", serie: "challengers", navn: "Holmenkollmarsjen", dato: "2026-02-14", res: { M: [rad("Ola Elite", 8600, { fis: "123" })], K: [] } };
  const ut = slaSammenDuplikater([eq, sc]);
  assert.equal(ut.length, 1);
  assert.equal(ut[0].serie, "challengers");
  assert.equal(ut[0].res.M[0][6], "123");
});

test("rulleski og sprint hos Ski Classics holdes utenfor", () => {
  const res = { M: [rad("A", 100), rad("B", 110), rad("C", 120)], K: [] };
  assert.ok(!erLanglop({ kilde: "skiclassics", navn: "Värnamorullen", dato: "2025-09-01", res }));
  assert.ok(!erLanglop({ kilde: "skiclassics", navn: "Bedřichov Sprint", dato: "2026-01-29", res }));
  assert.ok(erLanglop({ kilde: "skiclassics", navn: "Kangaroo Hoppet", dato: "2025-08-23", res }));
  assert.ok(erLanglop({ kilde: "skiclassics", navn: "Marcialonga", dato: "2026-01-25", res }));
});

test("ranking: menn og kvinner hver for seg, beste 8 teller, pro-løp veier tyngst", () => {
  const lop = [];
  for (let i = 0; i < 10; i++) {
    lop.push({
      id: `t${i}`,
      kilde: "eq",
      navn: `Turrenn ${i}`,
      dato: `2026-02-${String(i + 1).padStart(2, "0")}`,
      km: 50,
      res: { M: [rad("Turrenn Vinner", 100000, { eq: 7 }), rad("Nr To", 101000), rad("Nr Tre", 102000)], K: [rad("Kari Kvinne", 110000, { eq: 9 }), rad("Kvinne To", 120000), rad("Kvinne Tre", 130000)] },
    });
  }
  lop.push({ id: "pro", kilde: "eq", serie: "pro", navn: "Stort løp", dato: "2026-03-01", km: 54, res: { M: [rad("Pro Vinner", 90000), rad("Nr To", 95000), rad("Nr Tre", 96000)], K: [] } });
  const r = lagRanking(lop, { sesong: "2025-26", sesongNavn: "2025/26", oppdatert: "x" });
  const vinner = r.M.find((p) => p[0] === "Turrenn Vinner");
  assert.equal(vinner[5], 10); // ti løp
  assert.equal(vinner[7].filter((x) => x[4]).length, REGLER.besteAntall); // åtte teller
  assert.ok(r.K.every((p) => !r.M.some((m) => m[0] === p[0])));
  const proPoeng = r.M.find((p) => p[0] === "Pro Vinner")[7][0][3];
  const turPoeng = vinner[7][0][3];
  assert.ok(proPoeng > turPoeng);
  // Sortert etter poeng
  for (let i = 1; i < r.M.length; i++) assert.ok(r.M[i - 1][4] >= r.M[i][4]);
});

test("lister uten ekte tider, med plassholdertider eller umulig fart droppes", async () => {
  const { gyldigListe } = await import("../innsamling/poeng.mjs");
  const plassholder = 17500000000000000;
  assert.equal(gyldigListe([rad("A", plassholder), rad("B", plassholder), rad("C", plassholder)], 30).length, 0);
  assert.equal(gyldigListe([rad("A", 500), rad("B", 500), rad("C", 500), rad("D", 500)], 30).length, 0);
  assert.equal(gyldigListe([rad("A", 4580), rad("B", 4600), rad("C", 4700)], 20).length, 0); // 20 km på 7,6 min
  assert.equal(gyldigListe([rad("A", 40000), rad("B", 41000), rad("C", 42000)], 30).length, 3);
});

test("feltstyrken holder seg mellom 0,8 og 1 også med delte plasser", () => {
  const lik = Array.from({ length: 40 }, (_, i) => rad(`Løper ${i}`, 10000 + (i < 20 ? 0 : i)));
  const lop = [
    { id: "a", kilde: "eq", navn: "Likt løp", dato: "2026-02-01", km: 30, res: { M: lik, K: [] } },
    { id: "b", kilde: "eq", navn: "Annet løp", dato: "2026-02-02", km: 30, res: { M: lik.slice(0, 30).map((r, i) => [r[0], "", "NOR", 9000 + i * 10, null, null, null, null]), K: [] } },
  ];
  const r = lagRanking(lop, { sesong: "2025-26", sesongNavn: "2025/26", oppdatert: "x" });
  for (const l of r.lop) if (l.felt.M !== undefined) assert.ok(l.felt.M >= 0.8 && l.felt.M <= 1, `felt ${l.felt.M}`);
});
