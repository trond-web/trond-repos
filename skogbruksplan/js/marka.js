// Oslomarka og markagrensa (markaloven, LOV-2009-06-05-35): om eiendommen og bestandene ligger innenfor lovens
// virkeområde, og hva det betyr for skogeieren – byggeforbud (også veier), motorferdsel og friluftsliv. Skogbehandling
// og hogst er unntatt fra loven (§ 2 annet ledd bokstav a) og følger skogbruksloven og PEFC.
// Grensa hentes fra Kartverkets WFS (Klima- og miljødepartementet, Geonorge), klippes til et område rundt eiendommen
// og lagres i planen (S.marka), slik at punkt- og linjesjekk virker uten nett. Ingen DOM – kan testes i Node.

export const WFS = 'https://wfs.geonorge.no/skwms1/wfs.markagrensen';
export const WMS = 'https://wms.geonorge.no/skwms1/wms.markagrensen';
export const WMS_LAG = 'lovVirkeonraadeGrense'; // bare grenselinja – fyllfargen tar for mye oppmerksomhet i kartet
const LOV = 'https://lovdata.no/dokument/NL/lov/2009-06-05-35';
export const HJEMMEL = {
  lov: { navn: 'Markaloven', url: LOV },
  unntak: { navn: 'Markaloven § 2 (skogbehandling og hogst er unntatt)', url: `${LOV}/§2` },
  bygg: { navn: 'Markaloven § 5 (byggeforbud, også veier)', url: `${LOV}/§5` },
  plan: { navn: 'Markaloven § 6 (tiltak i landbruket etter plan)', url: `${LOV}/§6` },
  motor: { navn: 'Markaloven § 10 (motorferdsel)', url: `${LOV}/§10` },
  disp: { navn: 'Markaloven § 15 (dispensasjon)', url: `${LOV}/§15` },
  forskrift: { navn: 'Markalovforskriften', url: 'https://lovdata.no/dokument/SF/forskrift/2015-09-04-1032' },
  kart: { navn: 'Markagrensen (Kartverket / Klima- og miljødepartementet)', url: 'https://kartkatalog.geonorge.no/metadata/45e9ba77-388c-40eb-87df-e34e9d9ab300' },
};
const MARGIN = 0.03; // grader rundt eiendommen (ca. 1,7–3 km) – nok for velteplasser og veier til eiendommen

const boks = (geom) => {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  const gaa = (c) => { if (typeof c[0] === 'number') { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); } else c.forEach(gaa); };
  gaa(geom.coordinates); return [x0, y0, x1, y1];
};

export function wfsUrl([x0, y0, x1, y1]) {
  return `${WFS}?service=WFS&version=2.0.0&request=GetFeature&typeNames=${encodeURIComponent('app:LovVirkeområde')}&srsName=EPSG:4326&bbox=${y0},${x0},${y1},${x1},urn:ogc:def:crs:EPSG::4326`;
}

// GML 3.2 fra WFS-en → liste med polygoner [[ytre ring, indre ringer …]] i [lon, lat]. srsName=EPSG:4326 gir lon lat.
export function tolkGml(gml) {
  const poly = []; const s = String(gml);
  for (const p of s.split(/<gml:Polygon\b/).slice(1)) {
    const ringer = [];
    for (const m of p.split('</gml:Polygon>')[0].matchAll(/<gml:(exterior|interior)>[\s\S]*?<gml:posList[^>]*>([^<]+)<\/gml:posList>/g)) {
      const v = m[2].trim().split(/\s+/).map(Number); const r = [];
      for (let i = 0; i + 1 < v.length; i += 2) r.push([v[i], v[i + 1]]);
      if (m[1] === 'exterior') ringer.unshift(r); else ringer.push(r);
    }
    if (ringer.length) poly.push(ringer);
  }
  return poly;
}

// Sutherland–Hodgman: klipp en ring mot et rektangel. Gir en gyldig ring for punkt-i-polygon innenfor rektangelet.
export function klippRing(ring, [x0, y0, x1, y1]) {
  let ut = ring;
  const kanter = [[(p) => p[0] >= x0, (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= x1, (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= y0, (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0]],
    [(p) => p[1] <= y1, (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1]]];
  for (const [inne, skjaer] of kanter) {
    const inn = ut; ut = [];
    for (let i = 0; i < inn.length; i++) {
      const a = inn[i]; const b = inn[(i + 1) % inn.length];
      if (inne(b)) { if (!inne(a)) ut.push(skjaer(a, b)); ut.push(b); } else if (inne(a)) ut.push(skjaer(a, b));
    }
    if (!ut.length) break;
  }
  return ut.map(([x, y]) => [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6]);
}

function iRing([x, y], r) {
  let inne = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i]; const [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inne = !inne;
  }
  return inne;
}
// Grenselinjene til visning i kartet: ringene delt opp i linjer, uten bitene som bare er kanten av utsnittet.
export function grenselinjer(m) {
  if (!m?.polygoner || !m.boks) return [];
  const [x0, y0, x1, y1] = m.boks; const e = 1e-6;
  const paaKant = (a, b) => (Math.abs(a[0] - x0) < e && Math.abs(b[0] - x0) < e) || (Math.abs(a[0] - x1) < e && Math.abs(b[0] - x1) < e)
    || (Math.abs(a[1] - y0) < e && Math.abs(b[1] - y0) < e) || (Math.abs(a[1] - y1) < e && Math.abs(b[1] - y1) < e);
  const ut = [];
  for (const rs of m.polygoner) for (const r of rs) {
    let linje = [];
    for (let i = 0; i < r.length; i++) {
      const a = r[i]; const b = r[(i + 1) % r.length];
      if (paaKant(a, b)) { if (linje.length > 1) ut.push(linje); linje = []; continue; }
      if (!linje.length) linje.push(a); linje.push(b);
    }
    if (linje.length > 1) ut.push(linje);
  }
  return ut;
}

// Ligger punktet [lon, lat] innenfor markagrensa? null = ukjent (ikke hentet, eller utenfor området som er lagret).
export function punktIMarka(m, pt) {
  if (!m?.polygoner || !pt) return null;
  const [x0, y0, x1, y1] = m.boks; if (pt[0] < x0 || pt[0] > x1 || pt[1] < y0 || pt[1] > y1) return null;
  return m.polygoner.some((rs) => rs[0].length > 2 && iRing(pt, rs[0]) && !rs.slice(1).some((r) => r.length > 2 && iRing(pt, r)));
}

// Andel av en flate (Polygon/MultiPolygon) innenfor markagrensa, med et rutenett av punkter i flaten.
export function andelFlate(m, geom, punktIGeometri, n = 24) {
  if (!m?.polygoner || !geom) return null;
  const [x0, y0, x1, y1] = boks(geom); let inne = 0; let alle = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const p = [x0 + ((i + 0.5) / n) * (x1 - x0), y0 + ((j + 0.5) / n) * (y1 - y0)];
    if (!punktIGeometri(p, geom)) continue; alle++; if (punktIMarka(m, p)) inne++;
  }
  return alle ? inne / alle : null;
}
// Andel av en linje (LineString/MultiLineString) innenfor markagrensa, målt i punkter med jevn avstand.
export function andelLinje(m, geom, steg = 0.0002) {
  if (!m?.polygoner || !geom) return null;
  const linjer = geom.type === 'MultiLineString' ? geom.coordinates : geom.type === 'LineString' ? [geom.coordinates] : [];
  let inne = 0; let alle = 0;
  for (const l of linjer) for (let i = 1; i < l.length; i++) {
    const [a, b] = [l[i - 1], l[i]]; const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / steg));
    for (let t = 0; t < k; t++) { const p = [a[0] + ((b[0] - a[0]) * t) / k, a[1] + ((b[1] - a[1]) * t) / k]; alle++; if (punktIMarka(m, p)) inne++; }
  }
  return alle ? inne / alle : null;
}

// Hent grensa rundt eiendommen. hentTekst(url) → GML-tekst (fetch i nettleseren, egen funksjon i testene).
export async function hent(eiendom, { hentTekst = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`Markagrensa: HTTP ${r.status}`); return r.text(); } } = {}) {
  const [x0, y0, x1, y1] = boks(eiendom); const b = [x0 - MARGIN, y0 - MARGIN / 2, x1 + MARGIN, y1 + MARGIN / 2];
  const gml = await hentTekst(wfsUrl(b));
  if (!/FeatureCollection/.test(gml)) throw new Error('Markagrensa: uventet svar fra Kartverket.');
  const polygoner = tolkGml(gml).map((rs) => rs.map((r) => klippRing(r, b)).filter((r, i) => i === 0 || r.length > 2)).filter((rs) => rs[0].length > 2);
  return { boks: b.map((v) => Math.round(v * 1e6) / 1e6), polygoner };
}

// Analyse for planen: andel av eiendommen og av hvert bestand innenfor markagrensa.
export function analyser(grense, eiendom, { punktIGeometri, bestand = [], hentet = new Date().toISOString().slice(0, 10) } = {}) {
  const m = { ...grense, hentet };
  m.andel = andelFlate(m, eiendom, punktIGeometri, 40) ?? 0;
  oppdaterBestand(m, bestand, punktIGeometri);
  m.iMarka = m.andel > 0 || Object.keys(m.bestand).length > 0;
  return m;
}

// Regner andelen per bestand på nytt (bestand kan være lagt til, endret eller slettet etter at grensa ble hentet).
// Rask: grensa ligger i planen. Gir true når noe er endret.
export function oppdaterBestand(m, bestand, punktIGeometri) {
  if (!m?.polygoner) return false;
  const ny = {};
  for (const b of bestand) { if (!b.geometri) continue; const a = andelFlate(m, b.geometri, punktIGeometri, 12); if (a) ny[b.id] = Math.round(a * 100) / 100; }
  const endret = JSON.stringify(ny) !== JSON.stringify(m.bestand || {}); m.bestand = ny; return endret;
}

// Det skogeieren må vite, med hjemmel. Til panelet, bestandsdetaljer og oppdrag.
export const REGLER = [
  { id: 'skog', ikon: '🌲', tittel: 'Hogst og skogkultur er tillatt', tekst: 'Skogbehandling, hogst og drift av jordbruksarealer er unntatt fra markaloven. De følger skogbruksloven, bærekraftforskriften og PEFC – med ekstra vekt på friluftslivet i Marka.', hjemmel: HJEMMEL.unntak },
  { id: 'bygg', ikon: '🚧', tittel: 'Byggeforbud – også skogsveier', tekst: 'Bygge- og anleggstiltak er forbudt, også anlegg av vei og parkeringsplass. Tiltak i landbruket, som bygninger og terrenginngrep, kan bare tillates når en kommunal plan åpner for det (§ 6), ellers kreves dispensasjon (§ 15). Avklar alltid nye skogsbilveier og traktorveier med kommunen før du planlegger dem.', hjemmel: HJEMMEL.bygg },
  { id: 'motor', ikon: '🚜', tittel: 'Motorferdsel etter markaloven', tekst: 'Motorferdsel i utmark er forbudt, og motorferdselloven gjelder ikke. Transport i jord- og skogbruksnæringen er unntatt (§ 10 bokstav c), men ikke jakt, fiske og bærplukking. Grusvei og vei som ikke brøytes, regnes som utmark. Grunneieren kan selv forby eller begrense motorferdsel på eiendommen.', hjemmel: HJEMMEL.motor },
  { id: 'friluft', ikon: '🥾', tittel: 'Friluftsliv', tekst: 'Marka er til for friluftsliv, naturopplevelse og idrett. Hold stier og løyper åpne under og etter drift, rydd hogstavfall av stiene, sett opp informasjon ved hogst nær stier og turmål, og unngå drift i helger og ferier der det går mye folk.', hjemmel: HJEMMEL.lov },
];

export function vurdering(m) {
  if (!m) return null;
  if (!m.iMarka) return { niva: 'ok', tittel: 'Eiendommen ligger utenfor markagrensa', tekst: 'Markaloven gjelder ikke for eiendommen.', regler: [] };
  const helt = m.andel >= 0.99;
  return {
    niva: 'hensyn',
    tittel: helt ? 'Hele eiendommen ligger i Marka' : `${Math.round(m.andel * 100)} % av eiendommen ligger i Marka`,
    tekst: 'Eiendommen ligger innenfor markagrensa (markaloven). Det gir begrensninger på bygging, veier og motorferdsel, mens vanlig skogbruk er tillatt.',
    regler: REGLER,
  };
}

// Er bestandet i Marka? Gir andel 0–1 (0 når analysen finnes og bestandet er utenfor, null når ikke hentet).
export const bestandAndel = (S, id) => (S?.marka ? (S.marka.bestand?.[id] || 0) : null);

// Varsel for en vei som skal bygges (planlagt eller under bygging) og som går gjennom Marka.
export function veiVarsel(S, vei) {
  if (!S?.marka?.polygoner || !vei?.geometri || vei.status === 'eksisterende') return null;
  const a = andelLinje(S.marka, vei.geometri);
  if (!a) return null;
  return { andel: a, tekst: `${a >= 0.99 ? 'Hele veien' : `${Math.round(a * 100)} % av veien`} ligger innenfor markagrensa. Veibygging er forbudt etter markaloven § 5 med mindre en kommunal plan åpner for landbrukstiltak (§ 6), ellers kreves dispensasjon (§ 15). Avklar med kommunen før du søker etter landbruksveiforskriften.`, hjemmel: HJEMMEL.bygg };
}
// Varsel for tømmertransport: velteplass eller rute i Marka.
export function transportVarsel(S, velteplass, rute = null) {
  if (!S?.marka?.polygoner) return null;
  const v = velteplass ? punktIMarka(S.marka, velteplass) : false; const r = rute ? andelLinje(S.marka, rute) : 0;
  if (!v && !r) return null;
  return { tekst: `${v ? 'Velteplassen ligger i Marka. ' : ''}Transport i skogbruksnæringen er tillatt etter markaloven § 10 bokstav c, også på grusvei (som regnes som utmark). Annen motorferdsel er forbudt. Ta hensyn til turgåere og syklister på skogsbilveiene, og unngå helger der det går mye folk.`, hjemmel: HJEMMEL.motor };
}
// Hensyn for et oppdrag (hogst, tynning, skogkultur): bestandene i oppdraget som ligger i Marka.
export function oppdragHensyn(S, bestandIder = []) {
  if (!S?.marka?.iMarka) return null;
  const i = bestandIder.filter((id) => (S.marka.bestand?.[id] || 0) > 0);
  if (!i.length) return null;
  return { antall: i.length, tekst: `${i.length} av ${bestandIder.length} bestand i oppdraget ligger i Marka. Hold stier og løyper åpne, rydd hogstavfall av stiene, sett opp informasjon ved drift nær stier og turmål, og kjør bare der det er avtalt. Motorferdsel i utmark er bare tillatt for selve skogbruksnæringen (markaloven § 10). Nye veier eller terrenginngrep krever plan eller dispensasjon (§ 5).`, hjemmel: HJEMMEL.motor };
}
