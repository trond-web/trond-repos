// Vær i den virtuelle skogen: dagens vær fra MET (Locationforecast), snødybde fra seNorge (NVE, via serverens
// mellomledd /api/nve) og solens stilling for stedet og tidspunktet. Gjør været om til innstillinger for scenen
// (himmel, tåke, lys, nedbør, vind og snø på bakken). Ingen DOM – kan testes i Node.
import { utmTilGeo } from './proj.js';

const RAD = Math.PI / 180;
export const VAER_VALG = {
  av: { navn: 'Standard (klart)', ikon: '☀️' },
  dagens: { navn: 'Dagens vær', ikon: '📡' },
  sol: { navn: 'Sol', ikon: '☀️' },
  overskyet: { navn: 'Overskyet', ikon: '☁️' },
  regn: { navn: 'Regn', ikon: '🌧️' },
  sno: { navn: 'Snøvær', ikon: '🌨️' },
  take: { navn: 'Tåke', ikon: '🌫️' },
  torden: { navn: 'Tordenbyger', ikon: '⛈️' },
};
export const TID_VALG = { naa: 'Nå', dag: 'Midt på dagen', kveld: 'Kveld', natt: 'Natt' };

// Solens høyde over horisonten og retning (grader, retning med klokka fra nord). Forenklet NOAA-algoritme (±0,5°).
export function solposisjon(dato, lat, lon) {
  const d = dato.getTime() / 86400000 + 2440587.5 - 2451545.0;
  const g = ((357.529 + 0.98560028 * d) % 360) * RAD; const q = (280.459 + 0.98564736 * d) % 360;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD; const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)); const dek = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
  const H = (gmst * 15 + lon) * RAD - ra; const f = lat * RAD;
  const hoyde = Math.asin(Math.sin(f) * Math.sin(dek) + Math.cos(f) * Math.cos(dek) * Math.cos(H)) / RAD;
  const asimut = (Math.atan2(-Math.sin(H), Math.tan(dek) * Math.cos(f) - Math.sin(f) * Math.cos(H)) / RAD + 360) % 360;
  return { hoyde, asimut };
}
// Tidspunkt for valget (nå, kl. 12, kveld = når sola står 3° over horisonten etter kl. 12, natt = kl. 01).
export function tidFor(valg, lat, lon, naa = new Date()) {
  const dag = (t) => { const d = new Date(naa); d.setHours(t, 0, 0, 0); return d; };
  if (valg === 'dag') return dag(12);
  if (valg === 'natt') return dag(1);
  if (valg === 'kveld') {
    for (let m = 12 * 60; m < 24 * 60; m += 10) { const d = new Date(dag(0).getTime() + m * 60000); if (solposisjon(d, lat, lon).hoyde < 3) return d; }
    return dag(21);
  }
  return naa;
}

// ---------- henting ----------
async function json(hent, url, ms = 15000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try { const r = await hent(url, { signal: ctrl.signal }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json(); } finally { clearTimeout(t); }
}
// MET-varselet for tidspunktet (nærmeste time) + snødybde fra seNorge. senter = UTM33 [x, y].
export async function hentVaer(senter, { hent = (u, o) => fetch(u, o), nveBase = 'api/nve', tid = new Date() } = {}) {
  const [lon, lat] = utmTilGeo(senter[0], senter[1], 33);
  const [met, sno] = await Promise.all([
    json(hent, `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`).catch(() => null),
    (async () => {
      const dag = tid.toISOString().slice(0, 10); const x = Math.round(senter[0]); const y = Math.round(senter[1]);
      const j = await json(hent, `${nveBase}/GridTimeSeries/${x}/${y}/${dag}/${dag}/sd.json`);
      const v = (j.Data || [])[0]; return v == null || v === j.NoDataValue ? null : v;
    })().catch(() => null),
  ]);
  return { ...tolkMet(met, tid), snodybde: sno, lat, lon, raa: met };
}
export function tolkMet(met, tid = new Date()) {
  const serie = met?.properties?.timeseries || [];
  if (!serie.length) return { ok: false };
  let best = serie[0]; let bd = Infinity;
  for (const s of serie) { const d = Math.abs(new Date(s.time) - tid); if (d < bd) { bd = d; best = s; } }
  const i = best.data.instant.details; const n1 = best.data.next_1_hours || best.data.next_6_hours;
  return {
    ok: true, tid: best.time, temp: i.air_temperature, vind: i.wind_speed, vindFra: i.wind_from_direction, skydekke: i.cloud_area_fraction,
    fukt: i.relative_humidity, taake: i.fog_area_fraction ?? null, symbol: n1?.summary?.symbol_code || null,
    nedbor: best.data.next_1_hours ? n1?.details?.precipitation_amount ?? 0 : (n1?.details?.precipitation_amount ?? 0) / 6,
  };
}
// Faste værtyper (uten nett, eller for å se skogen i annet vær).
export function forhandsvaer(valg) {
  return {
    sol: { ok: true, temp: 18, vind: 2, vindFra: 225, skydekke: 5, fukt: 55, symbol: 'clearsky_day', nedbor: 0 },
    overskyet: { ok: true, temp: 9, vind: 4, vindFra: 240, skydekke: 100, fukt: 80, symbol: 'cloudy', nedbor: 0 },
    regn: { ok: true, temp: 8, vind: 6, vindFra: 210, skydekke: 100, fukt: 95, symbol: 'rain', nedbor: 2.5 },
    sno: { ok: true, temp: -4, vind: 3, vindFra: 20, skydekke: 100, fukt: 90, symbol: 'snow', nedbor: 1.5, snodybde: 45 },
    take: { ok: true, temp: 4, vind: 0.5, vindFra: 180, skydekke: 100, fukt: 100, symbol: 'fog', nedbor: 0, taake: 100 },
    torden: { ok: true, temp: 19, vind: 9, vindFra: 200, skydekke: 100, fukt: 90, symbol: 'heavyrainshowersandthunder_day', nedbor: 6 },
  }[valg] || null;
}

// ---------- vær → scene ----------
const blandF = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.min(1, Math.max(0, t)));
export function vaerScene(v, sol, { R = 250 } = {}) {
  const sym = String(v?.symbol || 'clearsky');
  const torden = /thunder/.test(sym);
  const type = /sleet/.test(sym) ? 'sludd' : /snow/.test(sym) ? 'sno' : /rain/.test(sym) ? 'regn' : /fog/.test(sym) || (v?.taake ?? 0) > 50 ? 'taake' : null;
  const mm = Math.max(0, v?.nedbor ?? 0);
  const mengde = type && type !== 'taake' ? Math.min(1, Math.max(/light/.test(sym) ? 0.2 : /heavy/.test(sym) ? 0.75 : 0.45, mm / 4)) : 0;
  const sky = Math.min(100, Math.max(0, v?.skydekke ?? (type ? 100 : 20))) / 100;
  // Dagslys: 1 når sola står over 14°, ned mot månelys når den er under −6°.
  const lys = Math.min(1, Math.max(0.06, ((sol?.hoyde ?? 40) + 6) / 20));
  const lavSol = sol && sol.hoyde > -4 && sol.hoyde < 10 ? 1 - Math.abs(sol.hoyde - 3) / 7 : 0;
  let himmel = blandF([0.61, 0.76, 0.9], [0.7, 0.73, 0.76], sky); // klart blått → grått
  if (type === 'regn' || type === 'sludd' || torden) himmel = blandF(himmel, [0.5, 0.54, 0.58], 0.4 + mengde * 0.4);
  if (type === 'sno') himmel = blandF(himmel, [0.82, 0.84, 0.87], 0.6);
  if (type === 'taake') himmel = [0.8, 0.82, 0.83];
  himmel = blandF(himmel, [0.98, 0.62, 0.36], lavSol * (1 - sky) * 0.6); // morgen-/kveldsrødt når det er klart
  himmel = himmel.map((x) => x * (0.12 + 0.88 * lys));
  if (lys < 0.15) himmel = blandF(himmel, [0.04, 0.06, 0.12], 0.6); // natt: mørk blå
  // Sikt (tåke i scenen)
  let naer = 40; let fjern = Math.max(120, R * 0.9);
  if (sky > 0.7) fjern = Math.min(fjern, 220);
  if (type === 'regn' || type === 'sludd') { naer = 12; fjern = 160 - mengde * 100; }
  if (type === 'sno') { naer = 6; fjern = 120 - mengde * 75; }
  if (type === 'taake') { naer = 2; fjern = (v?.fukt ?? 100) >= 99 ? 35 : 55; }
  if ((v?.fukt ?? 0) >= 97 && type !== 'taake' && (v?.vind ?? 5) < 2) { naer = Math.min(naer, 10); fjern = Math.min(fjern, 90); } // dis
  const solStyrke = 1.3 * lys * (1 - 0.82 * sky) * (type ? 0.5 : 1);
  return {
    type, torden, mengde, sky, lys, natt: lys < 0.15,
    himmel, taake: { naer, fjern },
    sol: { styrke: solStyrke, hoyde: sol?.hoyde ?? 40, asimut: sol?.asimut ?? 200, farge: blandF([1, 0.95, 0.85], [1, 0.62, 0.35], lavSol) },
    halvkule: 0.55 + 1.15 * lys * (1 - 0.25 * sky), omgivelse: 0.12 + 0.25 * lys,
    vind: v?.vind ?? 0, vindFra: v?.vindFra ?? 0,
    snoDekke: Math.min(1, Math.max(0, (v?.snodybde ?? (type === 'sno' && (v?.temp ?? 0) < 0 ? 8 : 0)) / 15)), snodybde: v?.snodybde ?? null,
  };
}
const SYMBOL_TEKST = [[/thunder/, 'torden'], [/heavysnow/, 'kraftig snø'], [/lightsnow/, 'lett snø'], [/snow/, 'snø'], [/sleet/, 'sludd'], [/heavyrain/, 'kraftig regn'], [/lightrain/, 'lett regn'], [/rain/, 'regn'], [/fog/, 'tåke'], [/partlycloudy/, 'delvis skyet'], [/fair/, 'lettskyet'], [/cloudy/, 'skyet'], [/clearsky/, 'klarvær']];
const RETNING = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'];
export function vaerTekst(v) {
  if (!v?.ok) return 'Værdata er ikke tilgjengelig';
  const s = SYMBOL_TEKST.find(([r]) => r.test(v.symbol || ''))?.[1] || '';
  const k = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
  return [`${Math.round(v.temp)} °C`, s, v.vind != null ? `vind ${k(v.vind)} m/s fra ${RETNING[Math.round(((v.vindFra || 0) % 360) / 45) % 8]}` : null, v.nedbor > 0 ? `${k(v.nedbor)} mm/t` : null, v.snodybde != null ? `${Math.round(v.snodybde)} cm snø` : null].filter(Boolean).join(' · ');
}
