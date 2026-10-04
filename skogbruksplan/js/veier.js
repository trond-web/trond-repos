// Skogsbilveier: register, vedlikehold, kostnadsfordeling, terrengtransport og import fra NVDB.
// Ingen DOM – kan testes i Node.
import { geoTilUtm, utmTilGeo, punktIGeometri } from './proj.js';

// Landbruksdirektoratets vegklasser (samme inndeling som NVDB-objekttype 822 «Landbruksvegklasse»).
export const VEIKLASSER = {
  1: { navn: 'Helårs landbruksbilvei', kort: 'Kl. 1', bilvei: true },
  2: { navn: 'Helårs bilvei', kort: 'Kl. 2', bilvei: true },
  3: { navn: 'Sommerbilvei, tømmerbil med henger', kort: 'Kl. 3', bilvei: true },
  4: { navn: 'Sommerbilvei, tømmerbil uten henger', kort: 'Kl. 4', bilvei: true },
  5: { navn: 'Vinterbilvei', kort: 'Kl. 5', bilvei: true },
  7: { navn: 'Traktorvei', kort: 'Kl. 7', bilvei: false },
  8: { navn: 'Enkel traktorvei', kort: 'Kl. 8', bilvei: false },
  0: { navn: 'Ukjent klasse', kort: 'Ukjent', bilvei: true },
};
const NVDB_KLASSE = {
  'Helårs landbruksbilveg': 1, 'Helårs bilveg': 2, 'Landbruksbilveg': 2,
  'Sommerbilveg, tømmerbil med henger': 3, 'Sommerbilveg, tømmerbil uten henger': 4,
  'Vinterbilveg': 5, 'Traktorveg': 7, 'Enkel traktorveg': 8,
};

export const TILSTAND = {
  god: { navn: 'God', farge: '#0ca30c' },
  middels: { navn: 'Middels', farge: '#fab219' },
  darlig: { navn: 'Dårlig', farge: '#d03b3b' },
  ukjent: { navn: 'Ikke vurdert', farge: '#8a8a85' },
};

export const PUNKTTYPER = {
  bom: { navn: 'Bom', bokstav: 'B' },
  stikkrenne: { navn: 'Stikkrenne', bokstav: 'S' },
  snuplass: { navn: 'Snuplass', bokstav: 'T' },
  velteplass: { navn: 'Velteplass / tømmerplass', bokstav: 'V' },
  moteplass: { navn: 'Møteplass', bokstav: 'M' },
  bru: { navn: 'Bru', bokstav: 'Br' },
  skade: { navn: 'Skade / utbedring', bokstav: '!' },
};

// Vedlikeholdstyper med standard intervall (år) og kostnad. Satsene er eksempler og kan endres i appen.
export const VEDLIKEHOLDSTYPER = {
  hovling: { navn: 'Høvling', intervall: 1, krPerM: 3, gjelder: 'bilvei' },
  grusing: { navn: 'Grusing (slitelag)', intervall: 6, krPerM: 30, gjelder: 'bilvei' },
  grofterensk: { navn: 'Grøfterensk', intervall: 8, krPerM: 10, gjelder: 'alle' },
  kantrydding: { navn: 'Kantrydding', intervall: 5, krPerM: 4, gjelder: 'alle' },
  stikkrenne: { navn: 'Skifte/rense stikkrenne', intervall: 0, krPerStk: 15000, gjelder: 'alle' },
  stovbinding: { navn: 'Støvbinding', intervall: 0, krPerM: 5, gjelder: 'bilvei' },
  broyting: { navn: 'Brøyting', intervall: 0, krPerM: 2, gjelder: 'bilvei' },
  annet: { navn: 'Annet', intervall: 0, krPerM: 0, gjelder: 'alle' },
};

export const STANDARD_VEIINNSTILLINGER = {
  vedlikehold: Object.fromEntries(Object.entries(VEDLIKEHOLDSTYPER).map(([k, v]) => [k, { intervall: v.intervall, krPerM: v.krPerM ?? 0, krPerStk: v.krPerStk ?? 0 }])),
  nybyggKrPerM: { 3: 900, 4: 650, 5: 300, 7: 120, 8: 60 }, // kr/m for nye veier, eksempelsatser
  tilskuddProsent: 50,                                      // statstilskudd/NMSK – typisk 30–70 %, avhenger av kommunen
  maksTerrengtransport: 500,                                // m – lengre avstand regnes som lang terrengtransport
};

// ---------- geometri (meter, via UTM33) ----------
const tilM = ([lon, lat]) => geoTilUtm(lon, lat, 33);
function linjer(geom) {
  if (!geom) return [];
  if (geom.type === 'LineString') return [geom.coordinates];
  if (geom.type === 'MultiLineString') return geom.coordinates;
  return [];
}
export function lengdeM(geom) {
  let sum = 0;
  for (const l of linjer(geom)) {
    for (let i = 1; i < l.length; i++) {
      const [x0, y0] = tilM(l[i - 1]); const [x1, y1] = tilM(l[i]);
      sum += Math.hypot(x1 - x0, y1 - y0);
    }
  }
  return sum;
}
function avstandPunktSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax; const dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
export function avstandTilLinje(punktLonLat, geom) {
  const p = tilM(punktLonLat);
  let min = Infinity;
  for (const l of linjer(geom)) {
    const m = l.map(tilM);
    for (let i = 1; i < m.length; i++) min = Math.min(min, avstandPunktSegment(p, m[i - 1], m[i]));
    if (m.length === 1) min = Math.min(min, Math.hypot(p[0] - m[0][0], p[1] - m[0][1]));
  }
  return min;
}

// Et punkt inne i bestandet: tyngdepunkt av ytre ring, eller et toppunkt hvis tyngdepunktet havner utenfor.
export function bestandSenter(geom) {
  const ring = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates.map((p) => p[0]).sort((a, b) => b.length - a.length)[0];
  const pts = ring.length > 1 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring;
  let x = 0; let y = 0;
  for (const [a, b] of pts) { x += a; y += b; }
  const c = [x / pts.length, y / pts.length];
  return punktIGeometri(c, geom) ? c : ring[0];
}

// Avstand fra hvert bestand til nærmeste bilvei (traktorveier teller ikke). Returnerer Map bestandId -> {meter, veiId}.
export function terrengtransport(bestand, veier) {
  const bilveier = veier.filter((v) => v.status !== 'planlagt' && (VEIKLASSER[v.klasse] || VEIKLASSER[0]).bilvei && v.geometri);
  const ut = new Map();
  for (const b of bestand) {
    if (!b.geometri) continue;
    const c = bestandSenter(b.geometri);
    let best = { meter: Infinity, veiId: null };
    for (const v of bilveier) {
      const d = avstandTilLinje(c, v.geometri);
      if (d < best.meter) best = { meter: d, veiId: v.id };
    }
    ut.set(b.id, best);
  }
  return ut;
}

// ---------- vedlikehold og kostnader ----------
export function vedlikeholdKostnad(type, vei, inn = STANDARD_VEIINNSTILLINGER, antall = 1) {
  const s = inn.vedlikehold[type] || {};
  if (type === 'stikkrenne') return (s.krPerStk || 0) * antall;
  return (s.krPerM || 0) * (vei?.lengde || 0);
}

// Foreslår vedlikehold der siste utførte tiltak av en type er eldre enn intervallet (eller aldri er registrert).
export function foreslaaVedlikehold(veier, logg, iAar = new Date().getFullYear(), inn = STANDARD_VEIINNSTILLINGER) {
  const forslag = [];
  for (const v of veier) {
    if (v.status === 'planlagt') continue;
    const bil = (VEIKLASSER[v.klasse] || VEIKLASSER[0]).bilvei;
    for (const [type, def] of Object.entries(VEDLIKEHOLDSTYPER)) {
      const intervall = inn.vedlikehold[type]?.intervall ?? def.intervall;
      if (!intervall || (def.gjelder === 'bilvei' && !bil)) continue;
      const egne = logg.filter((l) => l.veiId === v.id && l.type === type);
      if (egne.some((l) => l.status === 'planlagt')) continue;
      const sist = Math.max(-Infinity, ...egne.filter((l) => l.status === 'utfort').map((l) => l.aar));
      // Dårlig tilstand gjør at tiltaket foreslås nå uansett.
      const forfall = Number.isFinite(sist) ? sist + intervall : iAar;
      const aar = v.tilstand === 'darlig' ? iAar : Math.max(iAar, forfall);
      if (aar > iAar + 5) continue;
      forslag.push({
        veiId: v.id, type, aar, status: 'planlagt', kostnad: Math.round(vedlikeholdKostnad(type, v, inn)),
        kommentar: Number.isFinite(sist) ? `Sist utført ${sist}, intervall ${intervall} år` : `Ikke registrert utført – intervall ${intervall} år`,
      });
    }
  }
  return forslag.sort((a, b) => a.aar - b.aar);
}

// Fordeler en kostnad etter eierandeler. Andeler som ikke summerer til 100 normaliseres; uten eiere går alt til «Eiendommen».
export function fordelKostnad(kostnad, eiere) {
  const gyldige = (eiere || []).filter((e) => e.navn && e.andel > 0);
  if (!gyldige.length) return [{ navn: 'Eiendommen', andel: 100, belop: kostnad }];
  const sum = gyldige.reduce((s, e) => s + e.andel, 0);
  return gyldige.map((e) => ({ navn: e.navn, andel: (e.andel / sum) * 100, belop: (kostnad * e.andel) / sum }));
}

export function nyVeiKostnad(vei, inn = STANDARD_VEIINNSTILLINGER) {
  const brutto = (inn.nybyggKrPerM[vei.klasse] || 0) * (vei.lengde || 0);
  const tilskudd = (brutto * (inn.tilskuddProsent || 0)) / 100;
  return { brutto, tilskudd, netto: brutto - tilskudd };
}

// ---------- NVDB ----------
const NVDB = 'https://nvdbapiles.atlas.vegvesen.no';
const HODER = { 'X-Client': 'skogbruksplan-app', Accept: 'application/json' };

async function hentJson(hent, url, forsok = 4) {
  for (let i = 0; ; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 45000);
    try {
      const r = await hent(url, { headers: HODER, signal: ctrl.signal });
      if (!r.ok) throw new Error(`NVDB svarte ${r.status}`);
      return await r.json();
    } catch (e) {
      if (i >= forsok - 1) throw e.name === 'AbortError' ? new Error('NVDB svarte ikke') : e;
      await new Promise((res) => setTimeout(res, 800 * 2 ** i));
    } finally { clearTimeout(t); }
  }
}

async function hentAlle(hent, url) {
  const ut = [];
  let neste = url;
  for (let side = 0; neste && side < 20; side++) {
    const d = await hentJson(hent, neste);
    ut.push(...(d.objekter || []));
    neste = d.metadata?.returnert && d.metadata?.neste?.href !== neste ? d.metadata?.neste?.href : null;
    if (!d.metadata?.returnert) break;
  }
  return ut;
}

// Tolker WKT i UTM33 (srid 5973) til GeoJSON i lon/lat. Høyde (Z) droppes.
export function wktTilGeo(wkt) {
  const tall = (s) => s.trim().split(',').map((p) => { const [x, y] = p.trim().split(/\s+/).map(Number); return utmTilGeo(x, y, 33).map((v) => Math.round(v * 1e7) / 1e7); });
  const m = wkt.match(/^(\w+)(?:\s+Z)?\s*\((.*)\)$/s);
  if (!m) return null;
  const [, type, innhold] = m;
  if (type === 'POINT') return { type: 'Point', coordinates: tall(innhold)[0] };
  if (type === 'LINESTRING') return { type: 'LineString', coordinates: tall(innhold) };
  if (type === 'MULTILINESTRING') return { type: 'MultiLineString', coordinates: innhold.replace(/^\(|\)$/g, '').split(/\)\s*,\s*\(/).map(tall) };
  return null;
}

function naerEiendom(geom, grense, maksM) {
  const pts = geom.type === 'Point' ? [geom.coordinates] : linjer(geom).flat();
  if (pts.some((p) => punktIGeometri(p, grense))) return true;
  const ringer = grense.type === 'Polygon' ? grense.coordinates : grense.coordinates.flat();
  const kant = { type: 'MultiLineString', coordinates: ringer };
  return pts.some((p, i) => i % 3 === 0 && avstandTilLinje(p, kant) <= maksM);
}

// Henter skogsbilveier (S) og eventuelt private veier (P) som ligger på eller inntil eiendommen,
// pluss landbruksvegklasse, bommer, snuplasser og stikkrenner.
export async function hentNvdbVeier(grense, { hent = fetch, medPrivate = true, logg = () => {} } = {}) {
  const pts = (grense.type === 'Polygon' ? grense.coordinates : grense.coordinates.flat()).flat().map(tilM);
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  const bb = [Math.min(...xs) - 300, Math.min(...ys) - 300, Math.max(...xs) + 300, Math.max(...ys) + 300].map((v) => Math.round(v)).join(',');
  const kategorier = medPrivate ? ['S', 'P'] : ['S'];
  logg('Henter veinett fra NVDB …');
  const segmenter = (await Promise.all(kategorier.map((k) => hentAlle(hent, `${NVDB}/vegnett/api/v4/veglenkesekvenser/segmentert?kartutsnitt=${bb}&srid=5973&vegsystemreferanse=${k}&antall=1000`)))).flat();
  logg('Henter veiklasser, bommer, snuplasser og stikkrenner …');
  const [klasser, bommer, snuplasser, stikkrenner] = await Promise.all([822, 23, 40, 79].map((t) => hentAlle(hent, `${NVDB}/vegobjekter/api/v4/vegobjekter/${t}?kartutsnitt=${bb}&srid=5973&inkluder=egenskaper,geometri,lokasjon&antall=1000`).catch(() => [])));

  // Slå sammen segmentene per vegnummer (f.eks. «SV630» eller «PV98834»).
  const perVei = new Map();
  for (const s of segmenter) {
    const geo = s.geometri?.wkt && wktTilGeo(s.geometri.wkt);
    if (!geo || !naerEiendom(geo, grense, 30)) continue;
    const ref = s.vegsystemreferanse?.kortform || '';
    const nummer = ref.split(' ')[0] || `NVDB ${s.veglenkesekvensid}`;
    if (!perVei.has(nummer)) perVei.set(nummer, { nummer, deler: [], sekvenser: new Set(), typeVeg: s.typeVeg });
    const v = perVei.get(nummer);
    v.deler.push(geo.type === 'LineString' ? [geo.coordinates] : geo.coordinates);
    v.sekvenser.add(s.veglenkesekvensid);
  }
  const egenskap = (o, navn) => o.egenskaper?.find((e) => e.navn === navn)?.verdi;
  const veier = [...perVei.values()].map((v) => {
    const geometri = { type: 'MultiLineString', coordinates: v.deler.flat() };
    // Klasse fra 822 på samme veglenkesekvens.
    const k = klasser.find((o) => o.lokasjon?.stedfestinger?.some((st) => v.sekvenser.has(st.veglenkesekvensid)));
    const klasseTekst = k && egenskap(k, 'Klasse');
    return {
      navn: v.nummer, vegnummer: v.nummer, nvdb: true, status: 'eksisterende',
      klasse: NVDB_KLASSE[klasseTekst] ?? 0, klasseKilde: klasseTekst ? 'NVDB' : null,
      kategori: v.nummer.startsWith('S') ? 'Skogsbilvei (S)' : v.nummer.startsWith('P') ? 'Privat vei (P)' : '',
      geometri, lengde: Math.round(lengdeM(geometri)),
    };
  });
  const vegLinjer = { type: 'MultiLineString', coordinates: veier.flatMap((v) => v.geometri.coordinates) };
  const punkt = (liste, type, tekst) => liste.map((o) => {
    const g = o.geometri?.wkt && wktTilGeo(o.geometri.wkt);
    if (!g || g.type !== 'Point') return null;
    const paaEiendom = punktIGeometri(g.coordinates, grense) || (veier.length && avstandTilLinje(g.coordinates, vegLinjer) < 15);
    if (!paaEiendom) return null;
    return { type, navn: tekst(o), geometri: g, nvdbId: o.id, egenskaper: Object.fromEntries((o.egenskaper || []).filter((e) => !/Geometri|Liste|Assosiert|Eier|Vedlikehold/.test(e.navn) && e.verdi !== undefined && typeof e.verdi !== 'object').map((e) => [e.navn, e.verdi])) };
  }).filter(Boolean);
  const punkter = [
    ...punkt(bommer, 'bom', (o) => egenskap(o, 'Navn') || 'Bom'),
    ...punkt(snuplasser, 'snuplass', () => 'Snuplass'),
    ...punkt(stikkrenner, 'stikkrenne', (o) => {
      const dia = egenskap(o, 'Diameter, innvendig');
      const hb = egenskap(o, 'Høyde, innvendig') && egenskap(o, 'Bredde, innvendig') ? `${egenskap(o, 'Bredde, innvendig')}×${egenskap(o, 'Høyde, innvendig')} mm` : null;
      return ['Stikkrenne', egenskap(o, 'Materialtype')?.toLowerCase(), dia ? `Ø${dia} mm` : hb].filter(Boolean).join(' ');
    }),
  ];
  logg(`Fant ${veier.length} veier (${Math.round(veier.reduce((s, v) => s + v.lengde, 0))} m) og ${punkter.length} punkter`);
  return { veier, punkter };
}
