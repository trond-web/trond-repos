// Grøfteplan (systematisk drenering) for et jordbruksskifte. Ingen DOM – kan testes i Node.
//   * Grøfteavstand og -dybde foreslås fra jordarten (NIBIO jordsmonn) og årsnedbøren, etter vanlig norsk praksis.
//   * Terrenget (Kartverkets høydedata) gir fallretningen: samlegrøften legges med fallet, og sugegrøftene på tvers
//     av fallet med så mye vinkel at de får minst 1:200 fall mot samlegrøften. Utløpet legges i den laveste enden.
//   * Rørene dimensjoneres for 0,1 l/s per daa (vanlig krav i mineraljord for korn og gras).
//   * Kostnad, tilskudd (4000 kr/daa ved systematisk grøfting) og lønnsomhet (30 års levetid, 4 % rente).
// Resultatet kan skrives ut som dreneringsplan til søknaden (kommunen, før arbeidet starter) og sendes til grøftemaskin.
import { geoTilUtm, utmTilGeo } from './proj.js';
import { teksturGruppe, KULTURER } from './skifteplan.js';

export const KILDER = {
  praksis: { navn: 'NLR Østafjells: Praktisk drenering – teori og økonomi (2023)', url: 'https://ringerike.kommune.no/globalassets/bilder-blokker-og-filarkiv/bilder-og-dokumenter/samfunn/landbruk/praktisk-drenering-teori-og-okonomi-februar-2023.pdf' },
  tilskudd: { navn: 'Statsforvalteren: Tilskudd til drenering av jordbruksjord', url: 'https://www.statsforvalteren.no/agder/landbruk-og-mat/tilskot-innan-jordbruk-og-skogbruk/tilskudd-til-drenering-av-jordbruksareal' },
  rundskriv: { navn: 'Landbruksdirektoratet: Forvaltning av tilskudd til drenering (rundskriv)', url: 'https://www.landbruksdirektoratet.no/nb/filarkiv/rundskriv/drenering/Rundskriv%202019-15_UTG%C3%85TT_%20Forvaltning%20av%20tilskudd%20til%20drenering%20av%20jordbruksjord.pdf' },
  hoydedata: { navn: 'Kartverket: høydedata (punkt-API)', url: 'https://ws.geonorge.no/hoydedata/v1/' },
};

// Grøfteavstand (m) etter jordart og årsnedbør (NLR: «Praktisk drenering», tabell over grøfteavstand).
// Sand er ikke i tabellen – der er usystematisk grøfting vanligst; avstanden for systematisk grøfting er et anslag.
export const AVSTAND = {
  leire: { navn: 'Leire og silt', '600-800': [5, 8], '800-1200': [4, 8] },
  morene: { navn: 'Morene / lettleire', '600-800': [6, 12], '800-1200': [6, 10] },
  myrOmdannet: { navn: 'Sterkt omdannet myr', '600-800': [6, 8], '800-1200': [4, 8] },
  myrLite: { navn: 'Lite omdannet myr', '600-800': [10, 12], '800-1200': [8, 10] },
  sand: { navn: 'Sand og grus', '600-800': [10, 15], '800-1200': [8, 12], anslag: true },
};
export const NEDBOR = { '600-800': '600–800 mm/år', '800-1200': '800–1200 mm/år' };
// Rør (korrugerte drensrør, innv./utv. diameter mm) og minste fall (NLR / Statsforvalteren).
export const ROR = [{ id: 50, indre: 50, ytre: 60, minFall: 1 / 200 }, { id: 100, indre: 83, ytre: 100, minFall: 1 / 300 }, { id: 118, indre: 104, ytre: 118, minFall: 1 / 350 }, { id: 160, indre: 140, ytre: 160, minFall: 1 / 400 }, { id: 200, indre: 180, ytre: 200, minFall: 1 / 450 }];
export const FILTER = { sagflis: 'Sagflis / sagnugg', grus: 'Grus', filterror: 'Filterrør (kokos/fiber)', ingen: 'Uten filter' };
export const STANDARD = { nedbor: '600-800', kant: 3, maksSug: 200, kapasitet: 0.1, kostPerM: 50, kostKum: 6000, tilskuddDaa: 4000, rente: 0.04, levetid: 30 };
export const STATUS = { plan: 'Plan', sokt: 'Søkt tilskudd', innvilget: 'Innvilget', utfort: 'Utført', ferdigmeldt: 'Ferdigmeldt' };

export function jordartFor(sk) {
  const js = sk.jordsmonn || {}; const t = teksturGruppe(js.tekstur);
  if (t === 'organisk' || /myr|torv/i.test(js.organisk || '')) return /lite omdan|fibrig|sphagnum/i.test(`${js.tekstur} ${js.organisk}`) ? 'myrLite' : 'myrOmdannet';
  if (t === 'stivleire' || t === 'mellomleire' || t === 'silt') return 'leire';
  if (t === 'lettleire' || t === 'annet') return 'morene';
  if (t === 'sand') return 'sand';
  return null;
}
// Forslag til grøfteavstand og dybde. Svak drenering eller eng/korn med behov for tidlig jord gir avstand i nedre del.
export function foreslaParametre(sk, { nedbor = STANDARD.nedbor, jordart = null } = {}) {
  const j = jordart || jordartFor(sk) || 'morene'; const [lo, hi] = AVSTAND[j][nedbor] || AVSTAND[j]['600-800'];
  const svak = /ikke selvdrenert|delvis|dårlig/i.test(sk.jordsmonn?.drenering || '');
  const avstand = Math.round((svak ? lo + (hi - lo) * 0.3 : (lo + hi) / 2) * 2) / 2;
  const myr = j.startsWith('myr');
  const dybde = myr ? 1.3 : j === 'sand' || j === 'morene' ? 1.05 : 0.95;
  return { jordart: j, nedbor, avstand, dybde, intervall: [lo, hi], begrunnelse: `${AVSTAND[j].navn} ved ${NEDBOR[nedbor]}: ${lo}–${hi} m${svak ? ', svak naturlig drenering → tett' : ''}. Dybde ${myr ? '1,2–1,5 m på myr' : '0,9–1,0 m på fastmark (1,0–1,2 m på lettere jord)'}.${AVSTAND[j].anslag ? ' Sand: avstanden er et anslag – vurder usystematisk grøfting.' : ''}${!jordartFor(sk) ? ' Jordarten er ikke kjent – hent jordsmonn for skiftet.' : ''}` };
}

// ---------- geometri (UTM 33) ----------
const ringerAv = (g) => (g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : []);
const tilUtm = (g) => ringerAv(g).map((p) => p.map((r) => r.map(([x, y]) => geoTilUtm(x, y, 33))));
function iRing(x, y, r) { let inne = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i]; const [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inne = !inne; } return inne; }
const inne = (x, y, mp) => mp.some((p) => iRing(x, y, p[0]) && !p.slice(1).some((h) => iRing(x, y, h)));
// Delene av linjestykket a–b som ligger inne i flaten (multipolygon i UTM).
function klippLinje(a, b, mp) {
  const t = [0, 1]; const dx = b[0] - a[0]; const dy = b[1] - a[1];
  for (const p of mp) for (const r of p) for (let i = 0; i < r.length - 1; i++) {
    const [x1, y1] = r[i]; const [x2, y2] = r[i + 1]; const ex = x2 - x1; const ey = y2 - y1; const d = dx * ey - dy * ex; if (Math.abs(d) < 1e-12) continue;
    const s = ((x1 - a[0]) * ey - (y1 - a[1]) * ex) / d; const u = ((x1 - a[0]) * dy - (y1 - a[1]) * dx) / d;
    if (s > 0 && s < 1 && u >= 0 && u <= 1) t.push(s);
  }
  t.sort((x, y) => x - y); const ut = [];
  for (let i = 0; i < t.length - 1; i++) { if (t[i + 1] - t[i] < 1e-9) continue; const m = (t[i] + t[i + 1]) / 2; if (inne(a[0] + dx * m, a[1] + dy * m, mp)) ut.push([[a[0] + dx * t[i], a[1] + dy * t[i]], [a[0] + dx * t[i + 1], a[1] + dy * t[i + 1]]]); }
  return ut;
}
const lengde = (l) => { let s = 0; for (let i = 1; i < l.length; i++) s += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); return s; };
const r2 = (v) => Math.round(v * 100) / 100;

// ---------- terreng ----------
// Rutenett av høyder over skiftet fra Kartverket (punkt-API, maks 50 punkter per kall). Gir terreng(x, y) i UTM.
export async function hentTerreng(geometri, { hent = (u, o) => fetch(u, o), n = 9 } = {}) {
  const mp = tilUtm(geometri); const pts = mp.flat(2);
  const x0 = Math.min(...pts.map((p) => p[0])); const x1 = Math.max(...pts.map((p) => p[0])); const y0 = Math.min(...pts.map((p) => p[1])); const y1 = Math.max(...pts.map((p) => p[1]));
  const grid = []; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) grid.push([x0 + ((x1 - x0) * i) / (n - 1), y0 + ((y1 - y0) * j) / (n - 1)]);
  const geo = grid.map(([x, y]) => utmTilGeo(x, y, 33).map((v) => Number(v.toFixed(6))));
  const z = [];
  for (let k = 0; k < geo.length; k += 50) {
    const del = geo.slice(k, k + 50);
    const r = await hent(`https://ws.geonorge.no/hoydedata/v1/punkt?koordsys=4258&geojson=false&punkter=${encodeURIComponent(JSON.stringify(del))}`);
    if (!r.ok) throw new Error(`Kartverket (høydedata) svarte ${r.status}`);
    const j = await r.json(); z.push(...(j.punkter || []).map((p) => (Number.isFinite(p.z) ? p.z : null)));
  }
  return lagTerreng({ x0, y0, x1, y1, n, z });
}
// Bilineær interpolasjon i rutenettet. Manglende punkter får snittet.
export function lagTerreng({ x0, y0, x1, y1, n, z }) {
  const ok = z.filter(Number.isFinite); const snitt = ok.length ? ok.reduce((s, v) => s + v, 0) / ok.length : 0; const g = z.map((v) => (Number.isFinite(v) ? v : snitt));
  const f = (x, y) => {
    const fx = Math.min(n - 1.0001, Math.max(0, ((x - x0) / (x1 - x0 || 1)) * (n - 1))); const fy = Math.min(n - 1.0001, Math.max(0, ((y - y0) / (y1 - y0 || 1)) * (n - 1)));
    const i = Math.floor(fx); const j = Math.floor(fy); const u = fx - i; const v = fy - j;
    return g[j * n + i] * (1 - u) * (1 - v) + g[j * n + i + 1] * u * (1 - v) + g[(j + 1) * n + i] * (1 - u) * v + g[(j + 1) * n + i + 1] * u * v;
  };
  f.rutenett = { x0, y0, x1, y1, n, z: g };
  return f;
}
// Fallretning (enhetsvektor nedover) og helning (m/m) fra et plan tilpasset terrenget inne i skiftet.
export function fall(terreng, mp) {
  const { x0, y0, x1, y1 } = terreng.rutenett; const pts = [];
  for (let j = 0; j <= 12; j++) for (let i = 0; i <= 12; i++) { const x = x0 + ((x1 - x0) * i) / 12; const y = y0 + ((y1 - y0) * j) / 12; if (inne(x, y, mp)) pts.push([x, y, terreng(x, y)]); }
  if (pts.length < 3) return null;
  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length; const my = pts.reduce((s, p) => s + p[1], 0) / pts.length; const mz = pts.reduce((s, p) => s + p[2], 0) / pts.length;
  let sxx = 0; let sxy = 0; let syy = 0; let sxz = 0; let syz = 0;
  for (const [x, y, z] of pts) { const dx = x - mx; const dy = y - my; const dz = z - mz; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; sxz += dx * dz; syz += dy * dz; }
  const det = sxx * syy - sxy * sxy; if (Math.abs(det) < 1e-9) return null;
  const b = (sxz * syy - syz * sxy) / det; const c = (syz * sxx - sxz * sxy) / det; const s = Math.hypot(b, c);
  return { retning: s > 1e-6 ? [-b / s, -c / s] : [0, -1], helning: s, maksZ: Math.max(...pts.map((p) => p[2])), minZ: Math.min(...pts.map((p) => p[2])) };
}

// ---------- rør ----------
// Kapasitet (l/s) for fullt rør etter Manning (korrugert rør, n = 0,016).
export const kapasitet = (indreMm, fall) => { const d = indreMm / 1000; const A = (Math.PI * d * d) / 4; return (1 / 0.016) * A * (d / 4) ** (2 / 3) * Math.sqrt(Math.max(fall, 1e-5)) * 1000; };
export function velgRor(arealDaa, fallMm, { kapasitetDaa = STANDARD.kapasitet } = {}) {
  const q = arealDaa * kapasitetDaa; const f = Math.max(fallMm, 1 / 500);
  return { ...(ROR.find((r) => kapasitet(r.indre, f) >= q * 1.2) || ROR.at(-1)), q: r2(q) };
}

// ---------- grøfteplan ----------
// sk = skiftet (geometri i lon/lat), terreng(x, y) i UTM. Gir linjer i lon/lat og nøkkeltall. Sugegrøftene legges på tvers
// av fallet med vinkel θ mot høydekotene slik at fallet blir minst 1:200 (helning × sin θ), maks 35°.
export function lagGrofteplan(sk, terreng, { avstand = 8, dybde = 1, kant = STANDARD.kant, maksSug = STANDARD.maksSug, kostPerM = STANDARD.kostPerM, kostKum = STANDARD.kostKum, tilskuddDaa = STANDARD.tilskuddDaa, pris = null } = {}) {
  const mp = tilUtm(sk.geometri); if (!mp.length) return null;
  const f = fall(terreng, mp); const varsler = [];
  const flatt = !f || f.helning < 0.002;
  const [ux, uy] = f && !flatt ? f.retning : [0, -1]; // u = nedover, v = på tvers
  const vx = -uy; const vy = ux;
  const tilUV = ([x, y]) => [x * ux + y * uy, x * vx + y * vy]; const fraUV = ([u, v]) => [u * ux + v * vx, u * uy + v * vy];
  const uv = mp.flat(2).map(tilUV); const uMin = Math.min(...uv.map((p) => p[0])); const uMaks = Math.max(...uv.map((p) => p[0])); const vMin = Math.min(...uv.map((p) => p[1])); const vMaks = Math.max(...uv.map((p) => p[1]));
  const bredde = vMaks - vMin;
  if (flatt) varsler.push('Skiftet er nesten flatt (under 0,2 % fall). Fallet på grøftene må lages med dybden – sett av god tid til nivellering, og vurder laser på grøftemaskinen.');
  // Samlegrøfter med fallet; hver betjener sugegrøfter opp til maksSug på hver side.
  const nSamle = Math.max(1, Math.ceil(bredde / (2 * maksSug)));
  const vSamle = [...Array(nSamle)].map((_, k) => vMin + (bredde * (2 * k + 1)) / (2 * nSamle));
  const s = flatt ? 0 : f.helning; const minFall = ROR[0].minFall * 1.1;
  const theta = flatt ? 0 : Math.min((35 * Math.PI) / 180, Math.asin(Math.min(1, minFall / s)));
  if (!flatt && s * Math.sin(theta) < minFall * 0.999) varsler.push(`Helningen er bare ${r2(s * 100)} %: sugegrøftene får ikke 1:200 fall fra terrenget alene – grav dypere mot samlegrøften.`);
  const samle = []; const sug = [];
  for (const vc of vSamle) {
    for (const [a, b] of klippLinje(fraUV([uMin - 5, vc]), fraUV([uMaks + 5, vc]), mp)) { const l = lengde([a, b]); if (l > 10) samle.push({ linje: tilUV(a)[0] < tilUV(b)[0] ? [a, b] : [b, a], v: vc }); }
    // Sugegrøfter: én rad per avstand langs fallet, på begge sider av samlegrøften.
    const du = avstand / Math.max(0.5, Math.cos(theta));
    for (let u = uMin + du / 2; u < uMaks; u += du) {
      for (const side of [-1, 1]) {
        const vEnde = side < 0 ? Math.max(vMin, vc - maksSug) : Math.min(vMaks, vc + maksSug);
        const lv = Math.abs(vEnde - vc); if (lv < 5) continue;
        const start = fraUV([u, vc]); const ende = fraUV([u - lv * Math.tan(theta), vEnde]);
        for (const [a, b] of klippLinje(start, ende, mp)) {
          // Den delen som går helt inn til samlegrøften (nærmeste ende ved samlegrøften), kortet av `kant` m mot kanten.
          const [pa, pb] = Math.abs(tilUV(a)[1] - vc) < Math.abs(tilUV(b)[1] - vc) ? [a, b] : [b, a];
          const L = lengde([pa, pb]); if (L < kant + 6) continue;
          const ender = [pa, [pb[0] - ((pb[0] - pa[0]) * kant) / L, pb[1] - ((pb[1] - pa[1]) * kant) / L]];
          sug.push({ linje: [ender[1], ender[0]], vedSamle: Math.abs(tilUV(pa)[1] - vc) < avstand }); // fra øverste ende mot samlegrøften
        }
      }
    }
  }
  if (!samle.length) return { feil: 'Fant ikke plass til samlegrøft i skiftet' };
  const z = ([x, y]) => terreng(x, y);
  const medFall = (g) => { const L = lengde(g.linje); const dz = z(g.linje[0]) - z(g.linje.at(-1)); return { ...g, lengde: Math.round(L), fall: L ? dz / L : 0 }; };
  const sugF = sug.map(medFall); const samleF = samle.map(medFall);
  const areal = sk.areal || 0;
  for (const g of samleF) { g.areal = areal / samleF.length; g.ror = velgRor(g.areal, Math.max(g.fall, 0)); if (g.fall < g.ror.minFall) varsler.push(`Samlegrøften har ${r2(g.fall * 100)} % fall i terrenget – minst ${r2(g.ror.minFall * 100)} % for ${g.ror.ytre} mm rør. Øk dybden mot utløpet.`); }
  const lite = sugF.filter((g) => g.fall < ROR[0].minFall).length; if (lite && !flatt) varsler.push(`${lite} av ${sugF.length} sugegrøfter har under 1:200 fall i terrenget – juster dybden langs grøftene.`);
  if (sugF.some((g) => g.lengde > maksSug)) varsler.push(`Noen sugegrøfter er over ${maksSug} m – del dem med en ekstra samlegrøft.`);
  const utlop = samleF.map((g) => g.linje.at(-1)); // nederste ende
  const lSug = sugF.reduce((t, g) => t + g.lengde, 0); const lSamle = samleF.reduce((t, g) => t + g.lengde, 0);
  const kummer = samleF.length + utlop.length; // én ved hver samlegrøft (øverst/samling) og ved utløpet
  const kostnad = Math.round((lSug + lSamle) * kostPerM + kummer * kostKum);
  const tilskudd = Math.round(areal * tilskuddDaa);
  const annuitet = (STANDARD.rente) / (1 - (1 + STANDARD.rente) ** -STANDARD.levetid);
  const perDaaAar = areal ? ((kostnad - tilskudd) / areal) * annuitet : 0;
  const geo = (l) => l.map(([x, y]) => utmTilGeo(x, y, 33).map((v) => Math.round(v * 1e7) / 1e7));
  const kultur = KULTURER[Object.values(sk.vekster || {}).map((v) => v.kultur).filter(Boolean).at(-1)];
  return {
    avstand, dybde, helning: f ? r2(f.helning * 100) : 0, retning: Math.round(((Math.atan2(ux, uy) * 180) / Math.PI + 360) % 360), hoydeforskjell: f ? Math.round((f.maksZ - f.minZ) * 10) / 10 : 0,
    vinkel: Math.round((theta * 180) / Math.PI),
    samle: samleF.map((g) => ({ linje: geo(g.linje), lengde: g.lengde, fall: r2(g.fall * 100), ror: g.ror.ytre, rorIndre: g.ror.indre, q: g.ror.q, areal: Math.round(g.areal * 10) / 10 })),
    sug: sugF.map((g) => ({ linje: geo(g.linje), lengde: g.lengde, fall: r2(g.fall * 100), ror: 60 })),
    utlop: utlop.map((p) => geo([p])[0]), kummer,
    sum: { sug: lSug, samle: lSamle, totalt: lSug + lSamle, perDaa: areal ? Math.round((lSug + lSamle) / areal) : 0, antallSug: sugF.length },
    okonomi: { kostnad, tilskudd, netto: kostnad - tilskudd, perDaaAar: Math.round(perDaaAar), kultur: kultur?.navn || null, prisKg: pris, breakEvenKg: pris ? Math.round(perDaaAar / pris) : null },
    varsler, laget: new Date().toISOString().slice(0, 10),
  };
}

// Status og mangler i dreneringssaken (for KSL/krav og søknaden).
export function dreneringStatus(d) {
  if (!d?.plan) return null;
  const m = [];
  if (!d.tidligereGroftet) m.push('om arealet er grøftet før');
  if (!d.utlop) m.push('beskrivelse av utløp');
  if (!d.oppstart) m.push('planlagt oppstart');
  return { status: d.status || 'plan', mangler: m, klarTilSoknad: !m.length };
}
// Grøftene som GeoJSON (til kart, grøftemaskin eller kommunen).
export function grofterGeojson(sk) {
  const p = sk.drenering?.plan; if (!p) return null;
  const f = (l, egen) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: l }, properties: egen });
  return { type: 'FeatureCollection', features: [
    ...p.samle.map((g, i) => f(g.linje, { type: 'samlegrøft', nr: i + 1, ror_mm: g.ror, lengde_m: g.lengde, fall_pst: g.fall, dybde_m: p.dybde, skifte: sk.nr })),
    ...p.sug.map((g, i) => f(g.linje, { type: 'sugegrøft', nr: i + 1, ror_mm: g.ror, lengde_m: g.lengde, fall_pst: g.fall, dybde_m: p.dybde, avstand_m: p.avstand, skifte: sk.nr })),
    ...p.utlop.map((pt, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: pt }, properties: { type: 'utløp', nr: i + 1, skifte: sk.nr } })),
  ] };
}
// Kartskisse (SVG) av grøfteplanen for utskrift.
export function grofteSkisse(sk, { bredde = 640, hoyde = 460 } = {}) {
  const p = sk.drenering?.plan; const mp = tilUtm(sk.geometri); if (!mp.length) return '';
  const alle = [...mp.flat(2), ...(p ? [...p.samle, ...p.sug].flatMap((g) => g.linje.map(([x, y]) => geoTilUtm(x, y, 33))) : [])];
  const x0 = Math.min(...alle.map((q) => q[0])); const x1 = Math.max(...alle.map((q) => q[0])); const y0 = Math.min(...alle.map((q) => q[1])); const y1 = Math.max(...alle.map((q) => q[1]));
  hoyde = Math.round(Math.min(hoyde, Math.max(220, ((bredde - 40) * (y1 - y0)) / (x1 - x0 || 1) + 60))); // høyden etter skiftets form
  const sk2 = Math.min((bredde - 40) / (x1 - x0 || 1), (hoyde - 40) / (y1 - y0 || 1)); const px = ([x, y]) => [20 + (x - x0) * sk2, hoyde - 20 - (y - y0) * sk2];
  const sti = (l) => l.map((q, i) => `${i ? 'L' : 'M'}${px(q).map((v) => v.toFixed(1)).join(' ')}`).join('');
  const geoSti = (l) => sti(l.map(([x, y]) => geoTilUtm(x, y, 33)));
  const flate = mp.map((pp) => pp.map((r) => `${sti(r)}Z`).join('')).join('');
  const m10 = 50 * sk2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bredde} ${hoyde}" width="100%" style="max-width:${bredde}px;border:1px solid #ccc;background:#fbfaf3">
    <path d="${flate}" fill="#e9efcf" stroke="#3d3108" stroke-width="2" fill-rule="evenodd"/>
    ${p ? p.sug.map((g) => `<path d="${geoSti(g.linje)}" stroke="#2b7bb9" stroke-width="1.2" fill="none"/>`).join('') : ''}
    ${p ? p.samle.map((g) => `<path d="${geoSti(g.linje)}" stroke="#0b3d91" stroke-width="3.2" fill="none"/>`).join('') : ''}
    ${p ? p.utlop.map((q) => { const [x, y] = px(geoTilUtm(q[0], q[1], 33)); return `<circle cx="${x}" cy="${y}" r="6" fill="#d9533a"/><text x="${x + 8}" y="${y + 4}" font-size="12" font-family="sans-serif">Utløp</text>`; }).join('') : ''}
    <path d="M${bredde - 30} 50 l0 -26 m-6 10 l6 -10 l6 10" stroke="#111" stroke-width="1.6" fill="none"/><text x="${bredde - 34}" y="64" font-size="12" font-family="sans-serif">N</text>
    <path d="M20 ${hoyde - 8} h${m10.toFixed(1)}" stroke="#111" stroke-width="2"/><text x="${24 + m10}" y="${hoyde - 4}" font-size="11" font-family="sans-serif">50 m</text>
  </svg>`;
}
