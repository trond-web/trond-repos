// AR i felt: hva som skal vises rundt deg – bestandsgrenser, eiendomsgrense, veier og stier, miljøinformasjon
// (nøkkelbiotoper, naturtyper, verneområder, artsområder, friluftsområder), kulturminner med sikringssone og
// registreringer. Alt i lokale meter rundt et origo (UTM33, x øst, y nord). Ingen DOM – kan testes i Node.
import { geoTilUtm, etikettPunkt } from './proj.js';

export const AR_LAG = { bestand: 'Bestand', stier: 'Stier og veier', miljo: 'Miljø', kultur: 'Kulturminner', reg: 'Registreringer' };
export const AR_FARGE = {
  bestand: '#ffd400', eiendom: '#ff3b30', vei: '#c9c2b4', traktor: '#b08a5a', sti: '#d2691e',
  noekkelbiotop: '#34c759', naturtype: '#00c7be', vern: '#1f9d55', artsomrade: '#ff9500', friluftsomrade: '#0a84ff', kulturminne: '#bf5af2', registrering: '#64d2ff',
};
const MILJO_NAVN = { noekkelbiotop: 'Nøkkelbiotop', naturtype: 'Naturtype', vern: 'Verneområde', artsomrade: 'Artsområde', friluftsomrade: 'Friluftsområde', kulturminne: 'Kulturminne' };
const IKON = { noekkelbiotop: '🌿', naturtype: '🦋', vern: '🛡️', artsomrade: '🦉', friluftsomrade: '🥾', kulturminne: '🏛️', registrering: '📍' };
// Høyden på «gjerdet» som markerer en grense (m over bakken) – synlig over lyng og småbusker.
const GJERDE = { bestand: 1.1, eiendom: 1.8, miljo: 0.7, kultur: 0.9 };

const ringer = (g) => (!g ? [] : g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : []);
const linjerAv = (g) => (!g ? [] : g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []);
const iRing = (x, y, r) => { let inne = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i]; const [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inne = !inne; } return inne; };
// Polygoner som [[ytre, ...hull], ...] i lokale meter
const polygoner = (g, tl) => (!g ? [] : (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []).map((p) => p.map((r) => r.map(tl))));
export const iFlate = (x, y, mp) => mp.some((p) => iRing(x, y, p[0]) && !p.slice(1).some((h) => iRing(x, y, h)));

// Lokal omregning rundt origo [x, y] i UTM33
export const tilLokal = ([ox, oy]) => ([lon, lat]) => { const [x, y] = geoTilUtm(lon, lat, 33); return [x - ox, y - oy]; };

// Alt innenfor R meter fra origo. ekstraMiljo = miljøobjekter hentet for området (samme form som P.pefc.objekter),
// ruter = stier fra turrutebasen [{ linje: [[lon, lat]...], folger, navn }].
export function arInnhold(P, origo, { R = 500, ekstraMiljo = [], ruter = [] } = {}) {
  const tl = tilLokal(origo); const naer = (pts) => pts.some(([x, y]) => x * x + y * y < R * R);
  const linjer = []; const punkter = []; const flater = [];
  const ring = (lag, type, r, navn, hoyde) => { const pts = r.map(tl); if (pts.length > 2 && naer(pts)) linjer.push({ lag, type, farge: AR_FARGE[type] || AR_FARGE.bestand, punkter: pts, lukket: true, gjerde: hoyde, navn }); };
  // Bestand: gul grense + skilt med nummer, treslag/bonitet og hogstklasse
  for (const b of P?.bestand || []) {
    if (!b.geometri) continue;
    for (const r of ringer(b.geometri)) ring('bestand', 'bestand', r, `Bestand ${b.nr}`, GJERDE.bestand);
    const mp = polygoner(b.geometri, tl); flater.push({ lag: 'bestand', type: 'bestand', mp, b, navn: `Bestand ${b.nr}` });
    const [x, y] = tl(etikettPunkt(b.geometri));
    if (x * x + y * y < R * R) punkter.push({ lag: 'bestand', type: 'bestand', x, y, ikon: '🌲', tittel: `Bestand ${b.nr}`, under: [b.treslag && `${b.treslag}${b.bonitet ?? ''}`, b.hogstklasse && `HK ${['', 'I', 'II', 'III', 'IV', 'V'][b.hogstklasse] || b.hogstklasse}`, b.areal && `${String(Math.round(b.areal * 10) / 10).replace('.', ',')} daa`].filter(Boolean).join(' · '), farge: AR_FARGE.bestand, hoyde: 2.2 });
  }
  if (P?.eiendom?.grense) for (const r of ringer(P.eiendom.grense)) ring('bestand', 'eiendom', r, 'Eiendomsgrense', GJERDE.eiendom);
  // Veier og stier: planens veiregister og turrutebasen
  for (const v of P?.veier?.veier || []) {
    if (!v.geometri || v.status === 'planlagt') continue;
    const k = Number(v.klasse); const type = k === 7 || k === 8 ? 'traktor' : 'vei';
    for (const l of linjerAv(v.geometri)) { const pts = l.map(tl); if (pts.length > 1 && naer(pts)) linjer.push({ lag: 'stier', type, farge: AR_FARGE[type], punkter: pts, bredde: type === 'vei' ? 4 : 2.5, navn: v.navn || (type === 'vei' ? 'Skogsbilvei' : 'Traktorvei') }); }
  }
  for (const r of ruter) { if (r.folger === 'BV') continue; const pts = r.linje.map(tl); if (pts.length > 1 && naer(pts)) linjer.push({ lag: 'stier', type: r.folger === 'TR' ? 'traktor' : 'sti', farge: AR_FARGE[r.folger === 'TR' ? 'traktor' : 'sti'], punkter: pts, bredde: r.folger === 'TR' ? 2.5 : 0.9, navn: r.navn || (r.folger === 'TR' ? 'Traktorvei' : 'Sti') }); }
  // Miljø og kulturminner (fra planen + hentet for området), uten duplikater
  const sett = new Set(); const miljo = [];
  for (const o of [...(P?.pefc?.objekter || []), ...ekstraMiljo]) { const k = o.kildeId || `${o.type}|${o.navn}`; if (sett.has(k)) continue; sett.add(k); miljo.push(o); }
  for (const o of miljo) {
    const lag = o.type === 'kulturminne' ? 'kultur' : 'miljo'; const farge = AR_FARGE[o.type] || AR_FARGE.naturtype;
    const mp = polygoner(o.geometri, tl); if (!mp.length) continue;
    if (!mp.some((p) => naer(p[0]))) continue;
    for (const p of mp) linjer.push({ lag, type: o.type, farge, punkter: p[0], lukket: true, gjerde: lag === 'kultur' ? GJERDE.kultur : GJERDE.miljo, navn: o.navn });
    flater.push({ lag, type: o.type, mp, navn: o.navn, obj: o });
    const [x, y] = tl(etikettPunkt(o.geometri));
    punkter.push({ lag, type: o.type, x, y, ikon: IKON[o.type] || 'ℹ️', tittel: o.navn, under: o.type === 'kulturminne' ? 'Sikringssone 5 m – ikke kjør over' : MILJO_NAVN[o.type] || '', farge, hoyde: lag === 'kultur' ? 3 : 2.6, info: o.beskrivelse || null, lenke: o.lenke || null });
  }
  // Registreringer fra felt
  for (const r of P?.registreringer || []) {
    if (r.lat == null || r.lon == null) continue; const [x, y] = tl([r.lon, r.lat]); if (x * x + y * y > R * R) continue;
    punkter.push({ lag: 'reg', type: 'registrering', x, y, ikon: IKON.registrering, tittel: r.kategori || 'Registrering', under: (r.tekst || '').slice(0, 60), farge: AR_FARGE.registrering, hoyde: 1.8 });
  }
  return { linjer, punkter, flater };
}

// Hvor står jeg? Bestandet og miljøflatene som dekker punktet.
export function hvorEr(innhold, x, y) {
  const her = innhold.flater.filter((f) => iFlate(x, y, f.mp));
  return { bestand: her.find((f) => f.type === 'bestand')?.b || null, miljo: her.filter((f) => f.type !== 'bestand') };
}

// Avstand fra punktet til nærmeste kant av en flate (m); 0 inne i flaten.
export function avstandTilFlate(x, y, mp) {
  if (iFlate(x, y, mp)) return 0;
  let min = Infinity;
  for (const p of mp) for (const r of p) for (let i = 0; i < r.length - 1; i++) {
    const [x0, y0] = r[i]; const [x1, y1] = r[i + 1]; const dx = x1 - x0; const dy = y1 - y0; const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l2)) : 0; const d = Math.hypot(x - x0 - t * dx, y - y0 - t * dy); if (d < min) min = d;
  }
  return min;
}

const RETNING = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'];
export const kompassTekst = (grader) => RETNING[Math.round((((grader % 360) + 360) % 360) / 45) % 8];
// Retning (grader med klokka fra nord) og avstand fra (x, y) til (x2, y2)
export function peiling(x, y, x2, y2) { return { avstand: Math.hypot(x2 - x, y2 - y), retning: (((Math.atan2(x2 - x, y2 - y) * 180) / Math.PI) + 360) % 360 }; }

// Nærmeste skilt (punkter) i de valgte lagene, med avstand, retning og retning i forhold til der du ser (relativ).
export function naermeste(innhold, x, y, { lag = null, n = 4, kurs = null } = {}) {
  return innhold.punkter.filter((p) => !lag || lag.has(p.lag)).map((p) => { const pe = peiling(x, y, p.x, p.y); return { ...p, ...pe, kompass: kompassTekst(pe.retning), relativ: kurs == null ? null : ((pe.retning - kurs + 540) % 360) - 180 }; })
    .sort((a, b) => a.avstand - b.avstand).slice(0, n);
}

// Varsler når du er i eller nær sårbare områder (kulturminner, nøkkelbiotoper, verneområder, artsområder).
export function varsler(innhold, x, y) {
  const ut = [];
  for (const f of innhold.flater) {
    if (f.type === 'bestand') continue;
    const d = avstandTilFlate(x, y, f.mp);
    if (f.type === 'kulturminne' && d <= 15) ut.push({ niva: d === 0 ? 'stopp' : 'advarsel', tekst: d === 0 ? `Du står i sikringssonen til ${f.navn}. Ikke kjør over eller gjør inngrep.` : `${Math.round(d)} m til sikringssonen for ${f.navn}.` });
    else if (['noekkelbiotop', 'vern', 'artsomrade'].includes(f.type) && d === 0) ut.push({ niva: 'advarsel', tekst: `Du er i ${MILJO_NAVN[f.type].toLowerCase()}: ${f.navn}.` });
  }
  return ut.sort((a, b) => (a.niva === 'stopp' ? -1 : 0) - (b.niva === 'stopp' ? -1 : 0));
}

// Kompasskurs (grader med klokka fra geografisk nord) fra en deviceorientation-hendelse.
// iOS gir webkitCompassHeading (magnetisk); Android gir absolutt alpha (mot klokka fra nord). Deklinasjon legges til
// (i Norge 2–10° øst, standard 4°). skjerm = skjermens rotasjon i grader (0 = stående).
export function kursFraOrientering(e, { skjerm = 0, deklinasjon = 4 } = {}) {
  let k = null;
  if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) k = e.webkitCompassHeading;
  else if (e.absolute && typeof e.alpha === 'number') k = 360 - e.alpha;
  if (k == null) return null;
  return (((k + skjerm + deklinasjon) % 360) + 360) % 360;
}

// Glatter vinkler (grader) uten hopp ved 0/360.
export function glattVinkel(forrige, ny, a = 0.15) {
  if (forrige == null) return ny; const d = ((ny - forrige + 540) % 360) - 180; return (forrige + d * a + 360) % 360;
}
