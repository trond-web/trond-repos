// 🚛 Tømmertransport fra velteplass til terminal: kjørerute for tømmerbil, kontrollert mot vekt-, lengde- og
// høydebegrensninger og lastebilforbud langs hele ruten, slik at ingen kjører på en vei de ikke har lov til.
// Ingen DOM og ingen nettverkskall – kan testes i Node. Henting og kart: transport-ui.js.
//
// Data (åpne):
//   * Kjørerute: Valhalla (OpenStreetMap, lastebilprofil med lengde, vekt og høyde) – valhalla1.openstreetmap.de.
//   * Bruksklasse for tømmertransport (NVDB vegobjekttype 900): bruksklasse (tillatt totalvekt), maks vogntoglengde,
//     vinterbruksklasse og telerestriksjoner med datoer. Veglistene er den juridisk gjeldende kilden – NVDB er
//     Statens vegvesens database bak dem.
//   * Høydebegrensning (591) og trafikkreguleringer (856, f.eks. «Forbudt for lastebil og trekkbil»).
//   * Skogsbilveiene i planen (veiklasse 1–8 etter landbruksveiforskriften): klasse 4 bare uten henger, 5 bare
//     vinter, 7–8 traktorvei.
import { utmTilGeo, geoTilUtm } from './proj.js';

export const KILDER = {
  valhalla: { navn: 'Valhalla – ruting for lastebil på OpenStreetMap (FOSSGIS)', url: 'https://valhalla1.openstreetmap.de' },
  bruksklasse: { navn: 'NVDB – Bruksklasse, tømmertransport (vegobjekttype 900)', url: 'https://nvdbapiles.atlas.vegvesen.no/vegobjekttyper/900' },
  hoyde: { navn: 'NVDB – Høydebegrensning (591)', url: 'https://nvdbapiles.atlas.vegvesen.no/vegobjekttyper/591' },
  regulering: { navn: 'NVDB – Trafikkreguleringer (856)', url: 'https://nvdbapiles.atlas.vegvesen.no/vegobjekttyper/856' },
  veglister: { navn: 'Statens vegvesen – veglister for tømmertransport (juridisk gjeldende)', url: 'https://www.vegvesen.no/veglister' },
  terminal: { navn: 'Lierstranda tømmerterminal – avvikles etter planen innen utgangen av 2027 (Stortinget)', url: 'https://stortinget.no/no/Saker-og-publikasjoner/Publikasjoner/Referater/Stortinget/2025-2026/refs-202526-06-18/' },
};

// Terminaler. Posisjonen er innkjøringen til terminalområdet; den kan flyttes i kartet.
export const TERMINALER = {
  lierstranda: { navn: 'Lierstranda tømmerterminal (Drammen havn, Lier)', pos: [10.2561, 59.7487], merk: 'Terminalen avvikles etter planen innen utgangen av 2027 – sjekk med tømmerkjøperen hvor tømmeret skal leveres.' },
};

// Kjøretøy. lass = anslått m³ per lass (nyttelast ca. 0,9 t/m³ for rå gran) – til antall lass.
export const KJORETOY = {
  vogntog24: { navn: 'Tømmervogntog 24 m / 60 t', lengde: 24, vekt: 60, hoyde: 4.0, henger: true, lass: 42 },
  vogntog22: { navn: 'Tømmervogntog 22 m / 56 t', lengde: 22, vekt: 56, hoyde: 4.0, henger: true, lass: 38 },
  vogntog195: { navn: 'Vogntog 19,5 m / 50 t', lengde: 19.5, vekt: 50, hoyde: 4.0, henger: true, lass: 32 },
  bil: { navn: 'Tømmerbil uten henger 12,4 m / 32 t', lengde: 12.4, vekt: 32, hoyde: 4.0, henger: false, lass: 20 },
};
export const UTEN_HENGER = 'bil';

// ---------- geometri ----------
const R = 6371000;
const rad = (g) => (g * Math.PI) / 180;
export function avstand([lo1, la1], [lo2, la2]) { const x = rad(lo2 - lo1) * Math.cos(rad((la1 + la2) / 2)); const y = rad(la2 - la1); return Math.hypot(x, y) * R; }
// Lokal projeksjon (meter) rundt en breddegrad – godt nok for avstander på noen meter.
const proj = (la0) => { const k = Math.cos(rad(la0)) * R * Math.PI / 180; const m = R * Math.PI / 180; return ([lo, la]) => [lo * k, la * m]; };
function avstandTilLinje(p, a, b) { const dx = b[0] - a[0]; const dy = b[1] - a[1]; const l2 = dx * dx + dy * dy; let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }

// Valhalla sin «shape» (polyline med 6 desimaler) → [[lon, lat], …]
export function dekodPolyline(s, presisjon = 6) {
  const f = 10 ** presisjon; const ut = []; let i = 0; let lat = 0; let lon = 0;
  while (i < s.length) {
    for (const k of [0, 1]) { let r = 0; let sh = 0; let b; do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20); const d = r & 1 ? ~(r >> 1) : r >> 1; if (k === 0) lat += d; else lon += d; }
    ut.push([lon / f, lat / f]);
  }
  return ut;
}
// Punkter langs ruten med fast avstand: [{ p: [lon, lat], m: meter fra start }]
export function langsRuten(linje, steg = 25) {
  const ut = [{ p: linje[0], m: 0 }]; let m = 0; let rest = steg;
  for (let i = 1; i < linje.length; i++) {
    const a = linje[i - 1]; const b = linje[i]; const d = avstand(a, b); let pos = 0;
    while (d - pos >= rest) { pos += rest; const t = pos / d; ut.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], m: m + pos }); rest = steg; }
    rest -= d - pos; m += d;
  }
  const sist = linje.at(-1); if (ut.at(-1).p !== sist) ut.push({ p: sist, m });
  return ut;
}
// WKT (NVDB, srid 4326: «lat lon z») → [[[lon, lat], …], …] (linjer) eller [[lon, lat]] (punkt)
// Med utm: true er koordinatene «øst nord» i UTM33 (srid 5973) og regnes om til lengde- og breddegrad.
export function wktLinjer(wkt, { utm = false } = {}) {
  const tall = (s) => s.trim().split(',').map((x) => { const [a, b] = x.trim().split(/\s+/).map(Number); return utm ? utmTilGeo(a, b, 33) : [b, a]; }).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (/^POINT/i.test(wkt)) return [tall(wkt.replace(/^[^(]*\(+|\)+$/g, ''))];
  return (wkt.match(/\(([^()]+)\)/g) || []).map((x) => tall(x.slice(1, -1))).filter((l) => l.length);
}

// ---------- tolkning av NVDB ----------
// «EV6 S18D1 m4191 …» → «EV6»
export const vegnummer = (kortform) => String(kortform || '').split(' ')[0] || null;
const eg = (o) => Object.fromEntries((o.egenskaper || []).map((e) => [e.navn, e.verdi]));
const tallFra = (s) => { const m = String(s ?? '').match(/(\d+(?:[.,]\d+)?)/); return m ? Number(m[1].replace(',', '.')) : null; };
const iPeriode = (dato, fra, til) => !!(fra && til && dato >= fra && dato <= til);
// Bruksklasse for tømmertransport → { vekt (t), lengde (m), bk, vinter, tele, beskrivelse, vegref }
export function tolkBruksklasse(o, dato = new Date().toISOString().slice(0, 10)) {
  const e = eg(o);
  const vinter = iPeriode(dato, e['Vinterbruksklasse fra dato'], e['Vinterbruksklasse til dato']) && e['Bruksklasse vinter'];
  const bk = vinter || e.Bruksklasse || '';
  const vekt = /Spesiell/.test(bk) ? Number(e['Spesiell begrensning, totalvekt']) || null : tallFra(String(bk).split('-')[1]);
  const lTekst = e['Maks vogntoglengde'] || ''; const lengde = /Spesiell/.test(lTekst) ? Number(e['Spesiell begrensning, vogntoglengde']) || null : tallFra(lTekst);
  const tele = iPeriode(dato, e['Telerestriksjon fra dato'], e['Telerestriksjon til dato']) ? { aksellast: tallFra(e['Aksellast teleløsning']), til: e['Telerestriksjon til dato'] } : null;
  return { id: o.id, bk, vekt, lengde, vinter: !!vinter, tele, beskrivelse: e.Strekningsbeskrivelse || '', merknad: e.Merknad || '', vegref: o.lokasjon?.vegsystemreferanser?.[0]?.kortform || '' };
}
export function tolkHoyde(o) { const e = eg(o); return { id: o.id, hoyde: Number(e['Skilta høyde']) || Number(e['Beregnet høyde']) || null, type: e['Type hinder'] || '', navn: e.Navn || '', vegref: o.lokasjon?.vegsystemreferanser?.[0]?.kortform || '' }; }
export function tolkRegulering(o) {
  const e = eg(o); const r = e.Trafikkreguleringer || '';
  const forbud = /lastebil og trekkbil(?! m unntak)|Forbudt for motortrafikk(?! unntatt)/i.test(r) && !/m unntak/i.test(r);
  const usikker = /m unntak|kun tillatt for (varetransport|kjøring til eiendommer)/i.test(r);
  return { id: o.id, tekst: r.trim(), forbud, usikker, merknad: e.Merknad || '', vegref: o.lokasjon?.vegsystemreferanser?.[0]?.kortform || '' };
}

// ---------- romlig oppslag ----------
// Lager et søkenett av linjestykker (lokale meter) for raske nærmeste-oppslag.
export function lagIndeks(objekter, linjerFor, celle = 150) {
  if (!objekter.length) return { finn: () => null, retning: () => null };
  const la0 = linjerFor(objekter[0])[0]?.[0]?.[1] ?? 60; const P = proj(la0); const nett = new Map();
  objekter.forEach((o, oi) => { for (const l of linjerFor(o)) { const pr = l.map(P); if (pr.length === 1) pr.push(pr[0]); for (let i = 1; i < pr.length; i++) { const a = pr[i - 1]; const b = pr[i]; const x0 = Math.floor(Math.min(a[0], b[0]) / celle); const x1 = Math.floor(Math.max(a[0], b[0]) / celle); const y0 = Math.floor(Math.min(a[1], b[1]) / celle); const y1 = Math.floor(Math.max(a[1], b[1]) / celle); for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = `${x},${y}`; if (!nett.has(k)) nett.set(k, []); nett.get(k).push([a, b, oi]); } } } });
  return {
    // Retningen (radianer i lokale meter) fra a til b.
    retning(a, b) { const pa = P(a); const pb = P(b); return Math.atan2(pb[1] - pa[1], pb[0] - pa[0]); },
    finn(p, maks, retning = null) {
      const q = P(p); const cx = Math.floor(q[0] / celle); const cy = Math.floor(q[1] / celle); let best = null;
      for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) for (const [a, b, oi] of nett.get(`${x},${y}`) || []) {
        const d = avstandTilLinje(q, a, b); if (d > maks || (best && d >= best.d)) continue;
        // Retning: veien må gå omtrent samme vei som ruten (ellers er det en kryssende vei, bru eller undergang).
        if (retning != null && (a[0] !== b[0] || a[1] !== b[1])) { const r = Math.atan2(b[1] - a[1], b[0] - a[0]); let dv = Math.abs(r - retning) % Math.PI; if (dv > Math.PI / 2) dv = Math.PI - dv; if (dv > Math.PI / 5) continue; }
        best = { d, o: objekter[oi] };
      }
      return best;
    },
  };
}

// ---------- analyse ----------
// Sjekker ruten for et kjøretøy. data: { bruksklasse: [tolket], hoyde: [tolket med linjer], regulering: [tolket med
// linjer], planVeier: [{ klasse, linjer }] }. Gir strekninger med status (ok | ikke | ukjent), hindre (punkter) og sammendrag.
export function analyser(linje, data, kjoretoy, { steg = 25, maksAvvik = 14 } = {}) {
  const pkt = langsRuten(linje, steg);
  const bkIdx = lagIndeks(data.bruksklasse || [], (o) => o.linjer || []);
  const regIdx = lagIndeks(data.regulering || [], (o) => o.linjer || []);
  const veiIdx = lagIndeks(data.planVeier || [], (o) => o.linjer || []);
  const sett = new Set(); const hindre = [];
  const ret = (i) => { const a = pkt[Math.max(0, i - 1)].p; const b = pkt[Math.min(pkt.length - 1, i + 1)].p; const la0 = a[1]; const k = Math.cos(rad(la0)); return Math.atan2(b[1] - a[1], (b[0] - a[0]) * k); };
  const prover = pkt.map(({ p, m }, i) => {
    const grunn = []; let status = 'ok'; let kilde = null; const r = ret(i);
    const bk = bkIdx.finn(p, maksAvvik, r)?.o;
    if (bk) {
      kilde = { type: 'nvdb', bk: bk.bk, vekt: bk.vekt, lengde: bk.lengde, vegref: bk.vegref, beskrivelse: bk.beskrivelse, vinter: bk.vinter, tele: bk.tele };
      if (bk.vekt != null && kjoretoy.vekt > bk.vekt) { status = 'ikke'; grunn.push(`${bk.bk}${bk.vinter ? ' (vinter)' : ''}: maks ${bk.vekt} t`); }
      if (bk.lengde != null && kjoretoy.lengde > bk.lengde + 1e-6) { status = 'ikke'; grunn.push(`maks vogntoglengde ${String(bk.lengde).replace('.', ',')} m`); }
      if (bk.tele?.aksellast && status === 'ok') { status = 'tele'; grunn.push(`telerestriksjon: maks ${bk.tele.aksellast} t aksellast til ${bk.tele.til}`); }
    } else {
      const v = veiIdx.finn(p, maksAvvik, r)?.o;
      if (v) {
        kilde = { type: 'skogsbilvei', klasse: v.klasse, navn: v.navn };
        if ([7, 8].includes(v.klasse)) { status = 'ikke'; grunn.push(`${v.navn || 'Vei'}: traktorvei (klasse ${v.klasse})`); }
        else if (v.klasse === 4 && kjoretoy.henger) { status = 'ikke'; grunn.push(`${v.navn || 'Skogsbilvei'}: klasse 4 – bare tømmerbil uten henger`); }
        else if (v.klasse === 5) { status = 'tele'; grunn.push(`${v.navn || 'Skogsbilvei'}: klasse 5 – bare vinterbilvei (frossen mark)`); }
        else if (v.klasse === 3) { status = 'tele'; grunn.push(`${v.navn || 'Skogsbilvei'}: klasse 3 – sommerbilvei (ikke i teleløsningen)`); }
      } else { status = 'ukjent'; grunn.push('Ingen bruksklasse registrert (privat vei eller skogsbilvei utenfor planen) – avklar med veieier'); }
    }
    const reg = regIdx.finn(p, maksAvvik, r)?.o;
    if (reg?.forbud || reg?.usikker) {
      if (!sett.has(`r${reg.id}`)) { sett.add(`r${reg.id}`); hindre.push({ type: 'regulering', p, m, tekst: reg.tekst, vegref: reg.vegref, stopp: reg.forbud }); }
      if (reg.forbud) { status = 'ikke'; grunn.push(reg.tekst); } else if (status === 'ok') { status = 'ukjent'; grunn.push(reg.tekst); }
    }
    return { p, m, status, grunn, kilde, vegnr: bk ? vegnummer(bk.vegref) : null };
  });
  // Høydehindre langs ruten (punkt eller kort linje).
  const hIdx = lagIndeks(data.hoyde || [], (o) => o.linjer || []);
  for (const x of prover) { const h = hIdx.finn(x.p, maksAvvik)?.o; if (h && h.hoyde && h.hoyde < kjoretoy.hoyde && !sett.has(`h${h.id}`) && (!x.vegnr || !vegnummer(h.vegref) || vegnummer(h.vegref) === x.vegnr)) { sett.add(`h${h.id}`); hindre.push({ type: 'hoyde', p: x.p, m: x.m, tekst: `Høydebegrensning ${String(h.hoyde).replace('.', ',')} m${h.type ? ` (${h.type.toLowerCase()})` : ''}${h.navn ? ` – ${h.navn}` : ''}`, vegref: h.vegref, stopp: true }); x.status = 'ikke'; x.grunn.push(`høyde ${h.hoyde} m`); } }
  // Enkeltstående avvik på én prøve (i kryss og rundkjøringer) får statusen til naboene når de er like.
  for (let i = 1; i < prover.length - 1; i++) { const a = prover[i - 1]; const b = prover[i + 1]; const x = prover[i]; if (x.status !== a.status && a.status === b.status && a.grunn.join() === b.grunn.join() && !x.grunn.some((g) => /høyde/.test(g))) { x.status = a.status; x.grunn = [...a.grunn]; x.kilde = a.kilde; } }
  // Sammenhengende strekninger med samme status og grunn.
  const strekninger = [];
  for (const x of prover) {
    const nokkel = `${x.status}|${x.grunn.join(';')}`; const s = strekninger.at(-1);
    if (s && s.nokkel === nokkel) { s.tilM = x.m; s.linje.push(x.p); } else { if (s) s.linje.push(x.p); strekninger.push({ nokkel, status: x.status, grunn: x.grunn, kilde: x.kilde, fraM: x.m, tilM: x.m, linje: [x.p] }); }
  }
  // Korte treff på ramper og sideanlegg (KD/SD i vegsystemreferansen), eller på et annet vegnummer enn ruten har
  // før og etter, er ramper og kryssende veier tett inntil ruten – ikke veien bilen kjører på.
  for (let i = 1; i < strekninger.length - 1; i++) {
    const s = strekninger[i]; const a = strekninger[i - 1]; const b = strekninger[i + 1];
    const vn = vegnummer(s.kilde?.vegref); const annenVeg = vn && vegnummer(a.kilde?.vegref) && vegnummer(a.kilde?.vegref) === vegnummer(b.kilde?.vegref) && vn !== vegnummer(a.kilde?.vegref);
    if (s.status !== 'ok' && (/\s(KD|SD)\d/.test(s.kilde?.vegref || '') || annenVeg) && s.tilM - s.fraM < (annenVeg ? 150 : 300) && a.status === 'ok' && b.status === 'ok' && !s.grunn.some((g) => /høyde/.test(g))) { s.status = 'ok'; s.grunn = []; s.nokkel = 'ok|'; }
  }
  const lengde = pkt.at(-1).m;
  const sum = (st) => strekninger.filter((s) => s.status === st).reduce((a, s) => a + (s.tilM - s.fraM), 0);
  return { lengde, strekninger, hindre: hindre.sort((a, b) => a.m - b.m), prover, ok: sum('ikke') === 0 && !hindre.some((h) => h.stopp), ikkeM: sum('ikke'), ukjentM: sum('ukjent'), teleM: sum('tele') };
}

// Anbefaling ut fra analysen for valgt kjøretøy og for tømmerbil uten henger på samme rute.
// Gir { niva: 'ok' | 'uten-henger-start' | 'uten-henger' | 'omkjoring' | 'stopp', tekst, hengerplass? }
export function anbefaling(full, utenHenger, kjoretoy) {
  const ikke = full.strekninger.filter((s) => s.status === 'ikke');
  if (!ikke.length && !full.hindre.some((h) => h.stopp)) return { niva: 'ok', tekst: `Hele ruten er tillatt for ${kjoretoy.navn.toLowerCase()} etter bruksklassene i NVDB.` };
  if (!kjoretoy.henger) return { niva: 'omkjoring', tekst: 'Ruten har strekninger som ikke er tillatt for tømmerbil uten henger. Prøv omkjøring.' };
  const bilOk = (s) => utenHenger.prover.filter((p) => p.m >= s.fraM && p.m <= s.tilM).every((p) => p.status !== 'ikke');
  if (!ikke.every(bilOk) || utenHenger.hindre.some((h) => h.stopp)) return { niva: 'omkjoring', tekst: 'Noen strekninger er ikke tillatt selv uten henger (vekt, høyde eller forbud). Velg en annen rute.' };
  // Begrensningene ligger bare i starten: kjør uten henger dit, koble på henger etter siste begrensning.
  const sistIkke = Math.max(...ikke.map((s) => s.tilM));
  const andel = sistIkke / full.lengde;
  if (andel < 0.35) {
    const p = full.prover.find((x) => x.m >= sistIkke + 50) || full.prover.at(-1);
    return { niva: 'uten-henger-start', tekst: `Kjør uten henger de første ${fmtKm(sistIkke)} fra velteplassen (til begrensningen slutter), og koble på hengeren der. Pendle med bilen mellom velteplassen og hengerplassen.`, hengerplass: { p: p.p, m: p.m } };
  }
  return { niva: 'uten-henger', tekst: `Strekningene med begrensning er tillatt for tømmerbil uten henger, men de ligger spredt langs ruten (siste ved ${fmtKm(sistIkke)}). Kjør uten henger hele veien, eller velg omkjøring for fullt vogntog.` };
}
export const fmtKm = (m) => `${(m / 1000).toLocaleString('nb-NO', { maximumFractionDigits: m < 10000 ? 1 : 0 })} km`;

// Små polygoner rundt strekningene som ikke er tillatt – Valhalla kjører utenom dem (exclude_polygons).
export function unngaaPolygoner(analyse, { maks = 25, buffer = 0.0004 } = {}) {
  const ut = [];
  for (const s of analyse.strekninger.filter((x) => x.status === 'ikke')) {
    const midt = s.linje[Math.floor(s.linje.length / 2)];
    ut.push([[midt[0] - buffer * 2, midt[1] - buffer], [midt[0] + buffer * 2, midt[1] - buffer], [midt[0] + buffer * 2, midt[1] + buffer], [midt[0] - buffer * 2, midt[1] + buffer], [midt[0] - buffer * 2, midt[1] - buffer]]);
    if (ut.length >= maks) break;
  }
  for (const h of analyse.hindre.filter((x) => x.stopp)) { const p = h.p; ut.push([[p[0] - buffer, p[1] - buffer / 2], [p[0] + buffer, p[1] - buffer / 2], [p[0] + buffer, p[1] + buffer / 2], [p[0] - buffer, p[1] + buffer / 2], [p[0] - buffer, p[1] - buffer / 2]]); }
  return ut.slice(0, maks);
}

// Antall lass og kjørte km (tur-retur) for et volum.
export function lass(m3, kjoretoy, lengdeM) { if (!m3 || !kjoretoy) return null; const n = Math.ceil(m3 / kjoretoy.lass); return { lass: n, km: Math.round((n * 2 * lengdeM) / 1000) }; }

// Faste ruter (ca. 2,2 × 2,2 km) som ruten går gjennom. NVDB hentes per rute og mellomlagres, så omkjøringer og nye
// beregninger gjenbruker det som allerede er hentet. Gir [{ nokkel, boks: [minLon, minLat, maxLon, maxLat] }].
export const RUTE_LON = 0.04; export const RUTE_LAT = 0.02;
export function fliserLangs(linje) {
  const sett = new Map();
  for (const { p } of langsRuten(linje, 150)) { const x = Math.floor(p[0] / RUTE_LON); const y = Math.floor(p[1] / RUTE_LAT); const k = `${x},${y}`; if (!sett.has(k)) sett.set(k, { nokkel: k, boks: [x * RUTE_LON, y * RUTE_LAT, (x + 1) * RUTE_LON, (y + 1) * RUTE_LAT] }); }
  return [...sett.values()];
}
// Boksen til en rute i UTM33 (for NVDB med srid 5973, der geometritoleranse er i meter).
export function utmBoks(b) { const h = [geoTilUtm(b[0], b[1], 33), geoTilUtm(b[2], b[3], 33), geoTilUtm(b[0], b[3], 33), geoTilUtm(b[2], b[1], 33)]; return [Math.min(...h.map((p) => p[0])), Math.min(...h.map((p) => p[1])), Math.max(...h.map((p) => p[0])), Math.max(...h.map((p) => p[1]))].map(Math.round); }
// Trafikkreguleringer som kan stenge for tømmerbil (enum-id-er i NVDB, egenskap 9794) – filtreres hos NVDB.
export const REGULERING_FILTER = '(9794=19660 OR 9794=19661 OR 9794=15946 OR 9794=19643 OR 9794=15947 OR 9794=15948 OR 9794=15949 OR 9794=19673 OR 9794=19669)';
// Boks rundt ruten i biter (for NVDB-spørringer langs ruten): [[minLon, minLat, maxLon, maxLat], …]
export function bokserLangs(linje, { bitM = 8000, marg = 0.002 } = {}) {
  const pkt = langsRuten(linje, 200); const ut = []; let start = 0;
  while (start < pkt.length) {
    let slutt = start; while (slutt < pkt.length - 1 && pkt[slutt].m - pkt[start].m < bitM) slutt++;
    const del = pkt.slice(start, slutt + 1).map((x) => x.p);
    ut.push([Math.min(...del.map((p) => p[0])) - marg, Math.min(...del.map((p) => p[1])) - marg, Math.max(...del.map((p) => p[0])) + marg, Math.max(...del.map((p) => p[1])) + marg]);
    if (slutt === pkt.length - 1) break; start = slutt;
  }
  return ut;
}
