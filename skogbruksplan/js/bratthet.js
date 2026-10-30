// Bratthet og drivbarhet: hvor bratt terrenget er, og hva det betyr for om skogen kan drives. Helningen regnes fra
// Kartverkets høydedata (DTM1, punkt-API) i et rutenett, og deles i klasser etter hvilke driftsmetoder som virker.
// Ingen DOM – kan testes i Node.
//
// Grensene (helning i prosent, 100 % = 45°):
//   * Under 33 %: vanlig drift med hjulgående hogstmaskin og lassbærer. Landsskogtakseringen regner terreng under 34 %
//     som tilgjengelig for hjulmaskiner; over 33 % (18°) blir drift med vanlige skogsmaskiner «nokså utfordrende»
//     (NIBIO, Belbo og Hoffmann 2024).
//   * 33–50 %: bratt – krevende og fordyrende for vanlige maskiner (8WD, krantilt, erfaren fører). 50 % er også grensen
//     appen bruker i driftsforhold (terrengklasse 5: kabel eller beltegående).
//   * 50–75 %: svært bratt – ikke drivbart med vanlige skogsmaskiner. Krever vinsjstøttet maskin, gravedrift
//     (midlertidige driftsveier, opptil ca. 75 % / 37°, Lileng 2009) eller taubane. Hogstmaskin uten vinsj har
//     øvre grense rundt 38° (78 %), lassbærer rundt 35° (70 %) ifølge førerne.
//   * 75–85 %: bare vinsjstøttet maskin (T-winsj, opptil ca. 80–85 % / 38–40°) eller taubane.
//   * Over 85 %: bare taubane. I praksis ikke drivverdig skog i vanlig skogbruk.
//   Over 30° (58 %) kan snøskred løsne (NVE) – vernskog og hensyn til skred og erosjon (PEFC krav 3, skogbrukslova).
import { geoTilUtm, utmTilGeo } from './proj.js';

export const KILDER = {
  stroppen: { navn: 'NIBIO (Belbo og Hoffmann 2024): Skogsmaskiner i stroppen – helling for hjulmaskiner, gravedrift, vinsj og taubane', url: 'https://verdiskapingsfondet.no/wp-content/uploads/2024/06/Skogsmaskiner_i_stroppen_prosjektrapport.pdf' },
  hoydedata: { navn: 'Kartverket – høydedata (DTM1)', url: 'https://hoydedata.no' },
  nve: { navn: 'NVE – aktsomhetskart for snøskred (bratt terreng over 30°)', url: 'https://www.nve.no/naturfare/' },
};

export const KLASSER = [
  { id: 'lett', fra: 0, til: 33, navn: 'Under 33 % – vanlig maskinell drift', kort: 'Vanlig drift', farge: null, drivbar: true },
  { id: 'bratt', fra: 33, til: 50, navn: '33–50 % – bratt, krevende og dyrere for vanlige maskiner', kort: 'Krevende', farge: '#f2c94c', drivbar: true },
  { id: 'svart', fra: 50, til: 75, navn: '50–75 % – ikke drivbart med vanlige maskiner: vinsj, gravedrift eller taubane', kort: 'Spesialdrift', farge: '#ef8a2c', drivbar: false },
  { id: 'vinsj', fra: 75, til: 85, navn: '75–85 % – bare vinsjstøttet maskin eller taubane', kort: 'Vinsj eller taubane', farge: '#d63a2f', drivbar: false },
  { id: 'taubane', fra: 85, til: Infinity, navn: 'Over 85 % – bare taubane, i praksis ikke drivverdig', kort: 'Bare taubane', farge: '#7a1fa2', drivbar: false },
];
export const klasseFor = (pst) => (pst == null || !Number.isFinite(pst) ? null : KLASSER.find((k) => pst < k.til) || KLASSER.at(-1));
export const grader = (pst) => (Math.atan(pst / 100) * 180) / Math.PI;
export const SKRED_PST = 58; // 30°
export function tekst(pst) {
  const k = klasseFor(pst); if (!k) return '';
  return `Helning ${Math.round(pst)} % (${Math.round(grader(pst))}°) – ${k.kort.toLowerCase()}${pst >= SKRED_PST ? ' · bratt nok for snøskred' : ''}`;
}

// Helning i prosent i hvert punkt av et rutenett (n × m høyder, rad for rad fra sør, avstand d meter).
// Sentrerte differanser inne i nettet, ensidige på kanten. Manglende høyder gir null.
export function helning(z, nx, ny, d) {
  const ut = new Array(nx * ny).fill(null); const h = (i, j) => z[j * nx + i];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const i0 = Math.max(0, i - 1); const i1 = Math.min(nx - 1, i + 1); const j0 = Math.max(0, j - 1); const j1 = Math.min(ny - 1, j + 1);
    const a = h(i0, j); const b = h(i1, j); const c = h(i, j0); const e = h(i, j1);
    if (![a, b, c, e].every(Number.isFinite) || i1 === i0 || j1 === j0) continue;
    const dx = (b - a) / ((i1 - i0) * d); const dy = (e - c) / ((j1 - j0) * d);
    ut[j * nx + i] = Math.hypot(dx, dy) * 100;
  }
  return ut;
}

// Rutenett (UTM33) over en geometri (lon/lat). Avstanden velges slik at det blir høyst maksPunkter punkter.
export function rutenett(geometri, { maksPunkter = 3000, minAvstand = 10, kant = 20 } = {}) {
  const pts = []; const gaa = (k) => (typeof k[0] === 'number' ? pts.push(geoTilUtm(k[0], k[1], 33)) : k.forEach(gaa)); gaa(geometri.coordinates);
  const x0 = Math.min(...pts.map((p) => p[0])) - kant; const x1 = Math.max(...pts.map((p) => p[0])) + kant;
  const y0 = Math.min(...pts.map((p) => p[1])) - kant; const y1 = Math.max(...pts.map((p) => p[1])) + kant;
  const d = Math.max(minAvstand, Math.ceil(Math.sqrt(((x1 - x0) * (y1 - y0)) / maksPunkter)));
  const nx = Math.floor((x1 - x0) / d) + 1; const ny = Math.floor((y1 - y0) / d) + 1;
  return { x0, y0, d, nx, ny, punkter: Array.from({ length: nx * ny }, (_, k) => utmTilGeo(x0 + (k % nx) * d, y0 + Math.floor(k / nx) * d, 33)) };
}

// Henter høyder og regner helning for eiendommen. hentHoyder: (punkter lon/lat) => høyder (skog3d-omgivelser.js).
export async function hentBratthet(geometri, { hentHoyder, framdrift = () => {}, maksPunkter = 3000 } = {}) {
  const g = rutenett(geometri, { maksPunkter });
  framdrift(`Henter ${g.punkter.length.toLocaleString('nb-NO')} høydepunkter (${g.d} m mellom) fra Kartverket …`);
  let sist = 0; const z = await hentHoyder(g.punkter, { parallelle: 8, framdrift: (f, t) => { const pst = Math.round((f / t) * 100); if (pst >= sist + 20 || f === t) { sist = pst; framdrift(`Henter høydedata fra Kartverket … ${pst} %`); } } });
  if (z.filter(Number.isFinite).length < z.length * 0.5) throw new Error('Fikk ikke høydedata fra Kartverket for området.');
  const pst = helning(z, g.nx, g.ny, g.d).map((v) => (v == null ? null : Math.round(v * 10) / 10));
  return { x0: g.x0, y0: g.y0, d: g.d, nx: g.nx, ny: g.ny, pst, hentet: new Date().toISOString().slice(0, 10) };
}

// Flater (MultiPolygon, lon/lat) per bratthetsklasse. Hver rute er d × d rundt punktet; naboruter i samme rad og
// klasse slås sammen til rektangler.
export function flater(b) {
  const ut = {};
  for (const k of KLASSER.slice(1)) ut[k.id] = [];
  for (let j = 0; j < b.ny; j++) {
    let start = null; let kl = null;
    const lukk = (slutt) => { if (kl) { const xa = b.x0 + (start - 0.5) * b.d; const xb = b.x0 + (slutt + 0.5) * b.d; const ya = b.y0 + (j - 0.5) * b.d; const yb = ya + b.d; ut[kl].push([[[xa, ya], [xb, ya], [xb, yb], [xa, yb], [xa, ya]].map(([x, y]) => utmTilGeo(x, y, 33).map((v) => Math.round(v * 1e7) / 1e7))]); } };
    for (let i = 0; i <= b.nx; i++) {
      const k = i < b.nx ? klasseFor(b.pst[j * b.nx + i]) : null; const id = k && k.id !== 'lett' ? k.id : null;
      if (id !== kl) { lukk(i - 1); start = i; kl = id; }
    }
  }
  return Object.fromEntries(Object.entries(ut).filter(([, v]) => v.length).map(([k, v]) => [k, { type: 'MultiPolygon', coordinates: v }]));
}

// Andel av en flate (lon/lat) i hver klasse, og andelen som ikke er drivbar med vanlige maskiner (over 50 %).
export function statistikk(b, geometri, iGeometri) {
  const telle = Object.fromEntries(KLASSER.map((k) => [k.id, 0])); let n = 0; let maks = 0; let sum = 0;
  const pts = []; const gaa = (k) => (typeof k[0] === 'number' ? pts.push(geoTilUtm(k[0], k[1], 33)) : k.forEach(gaa)); gaa(geometri.coordinates);
  const i0 = Math.max(0, Math.floor((Math.min(...pts.map((p) => p[0])) - b.x0) / b.d)); const i1 = Math.min(b.nx - 1, Math.ceil((Math.max(...pts.map((p) => p[0])) - b.x0) / b.d));
  const j0 = Math.max(0, Math.floor((Math.min(...pts.map((p) => p[1])) - b.y0) / b.d)); const j1 = Math.min(b.ny - 1, Math.ceil((Math.max(...pts.map((p) => p[1])) - b.y0) / b.d));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const v = b.pst[j * b.nx + i]; if (v == null) continue;
    if (!iGeometri(utmTilGeo(b.x0 + i * b.d, b.y0 + j * b.d, 33), geometri)) continue;
    n++; telle[klasseFor(v).id]++; sum += v; if (v > maks) maks = v;
  }
  if (!n) return null;
  const andel = Object.fromEntries(Object.entries(telle).map(([k, v]) => [k, Math.round((v / n) * 1000) / 1000]));
  const ikkeDrivbar = andel.svart + andel.vinsj + andel.taubane;
  return { andel, ikkeDrivbar: Math.round(ikkeDrivbar * 1000) / 1000, bratt: Math.round((andel.bratt + ikkeDrivbar) * 1000) / 1000, snitt: Math.round(sum / n), maks: Math.round(maks), punkter: n };
}
// Kort vurdering av et bestand.
export function vurdering(st) {
  if (!st) return null;
  const p = (v) => `${Math.round(v * 100)} %`;
  if (st.andel.taubane + st.andel.vinsj >= 0.3) return { niva: 'taubane', tekst: `${p(st.andel.taubane + st.andel.vinsj)} av arealet er brattere enn 75 % – drift krever taubane eller vinsjstøttet maskin. Ofte ikke drivverdig.` };
  if (st.ikkeDrivbar >= 0.3) return { niva: 'svart', tekst: `${p(st.ikkeDrivbar)} av arealet er brattere enn 50 % – ikke drivbart med vanlige skogsmaskiner (vinsj, gravedrift eller taubane).` };
  if (st.bratt >= 0.3) return { niva: 'bratt', tekst: `${p(st.bratt)} av arealet er brattere enn 33 % – krevende og dyrere drift.` };
  return { niva: 'lett', tekst: `Vanlig maskinell drift (snitt ${st.snitt} %, maks ${st.maks} %).` };
}
