// Ajourføring av skogbruksplanen fra hogstmaskindata (HPR, StanForD 2010): stammene med posisjon gir hogd flate, og
// SkogIQ lager et endringsforslag per bestand som brukeren går gjennom og velger fra før noe endres:
//   * grenser:    dele bestandet (den hogde delen blir et nytt bestand) eller oppdatere hele bestandet
//   * egenskaper: hogstklasse, alder, volum, treantall og høyde – før og etter
//   * tiltak:     planlagt hogst merkes utført med virkelig volum, tiltak som ikke lenger er aktuelle ryddes bort,
//                 og nye tiltak foreslås (markberedning, planting/naturlig foryngelse og ungskogpleie etter flatehogst –
//                 foryngelsesplikten etter forskrift om berekraftig skogbruk § 6 gjelder innen tre år)
//   * hogd flate utenfor bestandene kan bli et nytt bestand
// Hver ajourføring lagres med en kopi av det som ble endret, slik at den kan angres.
// Ingen DOM – kan testes i Node. polygon-clipping sendes inn som PC (som i flate-geometri.js).
import { geoTilUtm, utmTilGeo } from './proj.js';
import { forenkle, mpTilUtm, arealUtm } from './sporlogg.js';
import { startTilstand, nyId as lagId, TILTAKSTYPER } from './model.js';
import { nyttNr } from './del.js';

export const STANDARD = {
  celle: 5,          // m – rutenett for hogd flate
  radius: 7,         // m – hogd område rundt hver stamme (kranspissposisjon ± fallet tre)
  lukk: 2,           // ruter – tetter hull mellom stikkveger (dilatasjon og erosjon)
  minFlate: 300,     // m² – mindre øyer av hogd flate tas ikke med
  minHull: 600,      // m² – mindre hull i hogd flate fylles
  flatehogst: 0.55,  // uttak av volumet (m³/daa) som regnes som flatehogst
  helBestand: 0.85,  // dekning – over dette oppdateres hele bestandet
  minDel: 1000,      // m² – minste del og rest ved deling
  minStammer: 10, minM3: 3,
};
const HOGST = ['sluttavvirkning', 'tynning', 'lukkethogst'];
// Tiltak som ikke lenger er aktuelle etter flatehogst (planlagte, i den hogde delen).
const UAKTUELL_ETTER_FLATE = ['sluttavvirkning', 'tynning', 'lukkethogst', 'ungskogpleie', 'stammekvisting', 'gjodsling'];
const r = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const tilUtm = ([lon, lat]) => geoTilUtm(lon, lat, 33);
const tilGeo = ([x, y]) => utmTilGeo(x, y, 33).map((v) => Math.round(v * 1e7) / 1e7);
const mpGeo = (mp) => (mp.length ? { type: 'MultiPolygon', coordinates: mp.map((p) => p.map((ring) => ring.map(tilGeo))) } : null);
const daa = (mp) => arealUtm(mp) / 1000;
const kopi = (x) => JSON.parse(JSON.stringify(x));
const iRing = (p, ring) => { let inn = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i]; const [xj, yj] = ring[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inn = !inn; } return inn; };
const iMp = (p, mp) => mp.some((poly) => iRing(p, poly[0]) && !poly.slice(1).some((h) => iRing(p, h)));
const boks = (mp) => { let a = Infinity; let b = Infinity; let c = -Infinity; let d = -Infinity; for (const p of mp) for (const [x, y] of p[0]) { if (x < a) a = x; if (x > c) c = x; if (y < b) b = y; if (y > d) d = y; } return [a, b, c, d]; };

// ---------- hogd flate fra stammene ----------
// Stammene (lon/lat) → rutenett med hogde ruter → MultiPolygon i UTM (polygon-clipping-format), forenklet.
export function hogdFlate(stammer, PC, o = STANDARD) {
  const pts = stammer.filter((s) => s.pos).map((s) => tilUtm(s.pos)); if (!pts.length) return { mp: [], ruter: 0 };
  const c = o.celle; const rr = Math.ceil(o.radius / c);
  const x0 = Math.min(...pts.map((p) => p[0])) - o.radius - (o.lukk + 2) * c; const y0 = Math.min(...pts.map((p) => p[1])) - o.radius - (o.lukk + 2) * c;
  const nx = Math.ceil((Math.max(...pts.map((p) => p[0])) + o.radius + (o.lukk + 2) * c - x0) / c) + 1; const ny = Math.ceil((Math.max(...pts.map((p) => p[1])) + o.radius + (o.lukk + 2) * c - y0) / c) + 1;
  let g = new Uint8Array(nx * ny);
  for (const [x, y] of pts) { const i = Math.floor((x - x0) / c); const j = Math.floor((y - y0) / c); for (let b = -rr; b <= rr; b++) for (let a = -rr; a <= rr; a++) { if ((a * c) ** 2 + (b * c) ** 2 > o.radius ** 2 + c * c) continue; const ii = i + a; const jj = j + b; if (ii >= 0 && jj >= 0 && ii < nx && jj < ny) g[jj * nx + ii] = 1; } }
  const morf = (inn, verdi) => { const ut = new Uint8Array(inn.length); for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { let treff = !verdi; for (let b = -1; b <= 1 && treff !== verdi; b++) for (let a = -1; a <= 1; a++) { const ii = i + a; const jj = j + b; const v = ii >= 0 && jj >= 0 && ii < nx && jj < ny ? inn[jj * nx + ii] : 0; if (!!v === verdi) { treff = verdi; break; } } ut[j * nx + i] = treff ? 1 : 0; } return ut; };
  for (let k = 0; k < o.lukk; k++) g = morf(g, true); for (let k = 0; k < o.lukk; k++) g = morf(g, false);
  // Komponenter: fjern små øyer (1) og fyll små hull (0).
  const komp = (verdi, maks) => { const sett = new Uint8Array(nx * ny); for (let s = 0; s < nx * ny; s++) { if (sett[s] || g[s] !== verdi) continue; const ko = [s]; const del = []; sett[s] = 1; let kant = false; while (ko.length) { const v = ko.pop(); del.push(v); const i = v % nx; const j = (v - i) / nx; if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) kant = true; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a; const jj = j + b; if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue; const q = jj * nx + ii; if (!sett[q] && g[q] === verdi) { sett[q] = 1; ko.push(q); } } } if (del.length * c * c < maks && !(verdi === 0 && kant)) for (const v of del) g[v] = verdi ? 0 : 1; } };
  komp(1, o.minFlate); komp(0, o.minHull);
  // Rader med sammenhengende ruter → rektangler → union.
  const rekt = []; let n = 0;
  for (let j = 0; j < ny; j++) { let s = -1; for (let i = 0; i <= nx; i++) { const v = i < nx ? g[j * nx + i] : 0; if (v) n++; if (v && s < 0) s = i; if (!v && s >= 0) { const a = x0 + s * c; const b = x0 + i * c; const yy = y0 + j * c; rekt.push([[[a, yy], [b, yy], [b, yy + c], [a, yy + c], [a, yy]]]); s = -1; } } }
  if (!rekt.length) return { mp: [], ruter: 0 };
  let mp = rekt.length === 1 ? [rekt[0]] : PC.union(...rekt);
  mp = mp.map((poly) => poly.map((ring) => { const f = forenkle(ring.slice(0, -1), c * 0.45); return f.length >= 3 ? [...f, f[0]] : ring; })).filter((p) => p[0].length >= 4);
  return { mp, ruter: n };
}

// ---------- endringsforslag ----------
const nesteAar = (aar, iAar) => Math.max(aar, iAar);
function forslagTiltak({ b, type, hogstAar, iAar, m3, stammer, dato, eksisterende }) {
  const ut = []; const planlagt = (eksisterende || []).filter((t) => t.status !== 'utfort');
  // 1. Planlagt hogst som er gjort.
  const passer = (t) => (type === 'flatehogst' ? ['sluttavvirkning', 'lukkethogst'].includes(t.type) : ['tynning', 'lukkethogst'].includes(t.type));
  const match = planlagt.filter((t) => HOGST.includes(t.type)).sort((a, c) => (passer(c) - passer(a)) || Math.abs((a.aar || hogstAar) - hogstAar) - Math.abs((c.aar || hogstAar) - hogstAar))[0];
  if (match && (passer(match) || Math.abs((match.aar || hogstAar) - hogstAar) <= 5)) ut.push({ id: `u-${match.id}`, handling: 'utfort', tiltakId: match.id, type: match.type, aar: match.aar, tekst: `${TILTAKSTYPER[match.type]?.navn || match.type} ${match.aar} merkes utført (${r(m3, 0)} m³, ${stammer} stammer${dato ? `, ${dato}` : ''})`, valgt: true });
  else ut.push({ id: 'ny-hogst', handling: 'registrer', type: type === 'flatehogst' ? 'sluttavvirkning' : 'tynning', aar: hogstAar, tekst: `${type === 'flatehogst' ? 'Sluttavvirkning' : 'Tynning'} ${hogstAar} registreres som utført (${r(m3, 0)} m³) – den var ikke planlagt`, valgt: true });
  // 2. Tiltak som ikke lenger er aktuelle.
  for (const t of planlagt) {
    if (match && t.id === match.id) continue;
    if (type === 'flatehogst' && UAKTUELL_ETTER_FLATE.includes(t.type)) ut.push({ id: `f-${t.id}`, handling: 'fjern', tiltakId: t.id, type: t.type, aar: t.aar, tekst: `${TILTAKSTYPER[t.type]?.navn || t.type} ${t.aar} fjernes – ikke aktuelt etter flatehogst`, valgt: true });
    if (type === 'tynning' && t.type === 'tynning' && Math.abs((t.aar || hogstAar) - hogstAar) <= 8) ut.push({ id: `f-${t.id}`, handling: 'fjern', tiltakId: t.id, type: t.type, aar: t.aar, tekst: `Tynning ${t.aar} fjernes – bestandet er nettopp tynnet`, valgt: true });
  }
  // 3. Nye tiltak etter flatehogst (foryngelse innen tre år, og ungskogpleie).
  if (type === 'flatehogst') {
    const har = (ty) => planlagt.some((t) => t.type === ty);
    const naturlig = b.treslag === 'F' && (b.bonitet || 11) <= 11;
    const aar1 = nesteAar(hogstAar + 1, iAar);
    if (!har('markberedning')) ut.push({ id: 'ny-markberedning', handling: 'ny', type: 'markberedning', aar: aar1, prioritet: 1, kommentar: naturlig ? 'Flekk-/harvemarkberedning for naturlig foryngelse under frøtrær' : 'Markberedning før planting', tekst: `Markberedning ${aar1} (ny)`, valgt: true });
    if (naturlig) ut.push({ id: 'ny-kontroll', handling: 'ny', type: 'annet', aar: nesteAar(hogstAar + 5, iAar), prioritet: 2, kommentar: 'Kontroller naturlig foryngelse (furu) – suppler med planting om tettheten er for lav', tekst: `Kontroll av naturlig foryngelse ${nesteAar(hogstAar + 5, iAar)} (ny)`, valgt: true });
    else if (!har('planting')) ut.push({ id: 'ny-planting', handling: 'ny', type: 'planting', aar: aar1, prioritet: 1, kommentar: `Foryngelsesplikt: tilfredsstillende foryngelse innen tre år etter hogst${b.treslag === 'F' ? ' (furu)' : ' (gran)'}`, tekst: `Planting ${aar1} (ny) – foryngelsesplikt innen tre år`, valgt: true });
    const us = nesteAar(hogstAar + (b.treslag === 'L' ? 8 : 12), iAar);
    if (!har('ungskogpleie')) ut.push({ id: 'ny-ungskogpleie', handling: 'ny', type: 'ungskogpleie', aar: us, prioritet: 2, kommentar: 'Ungskogpleie når foryngelsen er 2–4 m', tekst: `Ungskogpleie ${us} (ny)`, valgt: true });
  }
  return ut;
}

// Forslag for alle bestand stammene ligger i. stammer: [{ pos:[lon,lat], treslag, fub, dato, delobjekt }].
export function lagForslag(S, stammer, PC, { iAar = new Date().getFullYear(), o = STANDARD, kilde = 'HPR' } = {}) {
  const hogd = hogdFlate(stammer, PC, o); const hb = hogd.mp.length ? boks(hogd.mp) : null;
  const medPos = stammer.filter((s) => s.pos).map((s) => ({ s, p: tilUtm(s.pos) }));
  const bestand = (S.bestand || []).filter((b) => b.geometri && /Polygon/.test(b.geometri.type)).map((b) => ({ b, mp: mpTilUtm(b.geometri) }));
  const forslag = []; const brukt = new Set();
  for (const { b, mp } of bestand) {
    const bb = boks(mp); if (hb && (bb[2] < hb[0] || bb[0] > hb[2] || bb[3] < hb[1] || bb[1] > hb[3])) continue;
    const her = medPos.filter(({ p }) => p[0] >= bb[0] && p[0] <= bb[2] && p[1] >= bb[1] && p[1] <= bb[3] && iMp(p, mp));
    const m3 = her.reduce((s, x) => s + (x.s.fub || 0), 0);
    if (her.length < o.minStammer || m3 < o.minM3) continue;
    for (const x of her) brukt.add(x.s);
    const del = hogd.mp.length ? PC.intersection(mp, hogd.mp) : [];
    const arealB = daa(mp); let arealDel = del.length ? daa(del) : 0; if (arealDel > arealB) arealDel = arealB;
    const dekning = arealB ? arealDel / arealB : 0;
    const volFor = b.volumDaa ?? startTilstand(b).volumDaa ?? null;
    const m3Daa = arealDel ? m3 / arealDel : m3 / Math.max(arealB, 0.1);
    const uttak = volFor ? m3Daa / volFor : null;
    const planlagt = (b.tiltak || []).filter((t) => t.status !== 'utfort' && HOGST.includes(t.type));
    const type = uttak != null ? (uttak >= o.flatehogst ? 'flatehogst' : 'tynning') : planlagt.some((t) => t.type === 'sluttavvirkning') || m3Daa >= 12 ? 'flatehogst' : 'tynning';
    const datoer = her.map((x) => x.s.dato).filter(Boolean).sort(); const dato = datoer.at(-1) || null;
    const hogstAar = dato ? Number(dato.slice(0, 4)) : iAar;
    const treslag = { G: 0, F: 0, L: 0 }; for (const x of her) treslag[x.s.treslag in treslag ? x.s.treslag : 'L'] += x.s.fub || 0;
    // Grenser: dele eller hele.
    const rest = del.length ? PC.difference(mp, hogd.mp) : mp; const arealRest = daa(rest);
    const kanDele = arealDel * 1000 >= o.minDel && arealRest * 1000 >= o.minDel;
    const anbefalt = dekning >= o.helBestand || !kanDele ? 'hele' : type === 'flatehogst' || dekning < 0.7 ? 'del' : 'hele';
    // Egenskaper etter hogst (for den hogde delen ved deling, ellers hele bestandet).
    // Egenskaper etter hogst – for den hogde delen (ved deling) og for hele bestandet.
    const etterFor = (areal) => (type === 'flatehogst'
      ? { hogstklasse: 1, alder: 0, volumDaa: 0, treantall: null, hoyde: null, tetthetsklasse: null, takstAar: hogstAar }
      : { volumDaa: volFor != null ? Math.max(0, r(volFor - m3 / Math.max(areal, 0.1), 1)) : b.volumDaa ?? null, treantall: b.treantall ? Math.max(0, Math.round(b.treantall - her.length / Math.max(areal, 0.1))) : b.treantall ?? null });
    const etter = { del: etterFor(arealDel || arealB), hele: etterFor(arealB) };
    const tiltak = forslagTiltak({ b, type, hogstAar, iAar, m3, stammer: her.length, dato, eksisterende: b.tiltak });
    forslag.push({
      id: `a-${b.id}`, bestandId: b.id, nr: b.nr, type, dekning: r(dekning, 3), arealBestand: r(arealB, 1), arealDel: r(arealDel, 1), arealRest: r(arealRest, 1),
      m3: r(m3, 1), stammer: her.length, m3Daa: r(m3Daa, 1), uttak: uttak != null ? r(uttak, 2) : null, volFor: volFor != null ? r(volFor, 1) : null, treslag: Object.fromEntries(Object.entries(treslag).map(([k, v]) => [k, r(v, 1)])), dato, hogstAar,
      kanDele, anbefalt, valg: anbefalt, egenskaperValgt: true, etter, tiltak,
      geo: { del: mpGeo(del), rest: mpGeo(rest) }, kilde,
    });
  }
  // Hogd flate utenfor bestandene.
  const utenforStammer = medPos.filter((x) => !brukt.has(x.s));
  let utenfor = null;
  if (hogd.mp.length && bestand.length) {
    const naer = bestand.filter(({ mp }) => { const bb = boks(mp); return !(bb[2] < hb[0] || bb[0] > hb[2] || bb[3] < hb[1] || bb[1] > hb[3]); }).map((x) => x.mp);
    const ut = naer.length ? PC.difference(hogd.mp, ...naer) : hogd.mp;
    const stor = ut.filter((p) => daa([p]) * 1000 >= o.minDel);
    if (stor.length) { const m3u = utenforStammer.filter((x) => iMp(x.p, stor)).reduce((s, x) => s + (x.s.fub || 0), 0); utenfor = { id: 'utenfor', areal: r(daa(stor), 1), m3: r(m3u, 1), geo: mpGeo(stor), valgt: false }; }
  }
  return {
    kilde, laget: new Date().toISOString(), stammer: stammer.length, medPosisjon: medPos.length, m3: r(stammer.reduce((s, x) => s + (x.fub || 0), 0), 1),
    hogd: mpGeo(hogd.mp), hogdAreal: r(daa(hogd.mp), 1), forslag: forslag.sort((a, c) => String(a.nr).localeCompare(String(c.nr), 'nb', { numeric: true })), utenfor,
    utenforM3: r(utenforStammer.reduce((s, x) => s + (x.s.fub || 0), 0), 1),
  };
}

// Egenskapene som endres (før → etter) med valget som er gjort.
export function egenskaper(S, f) {
  const b = (S.bestand || []).find((x) => x.id === f.bestandId); if (!b) return [];
  const etter = f.valg === 'del' ? f.etter.del : f.etter.hele;
  return Object.keys(etter).filter((k) => k !== 'takstAar' && (b[k] ?? null) !== (etter[k] ?? null)).map((k) => ({ felt: k, for: b[k] ?? null, etter: etter[k] ?? null }));
}
// Tiltaksendringene som gjelder med valget: ved deling blir planlagte tiltak liggende på resten (ingen fjerning).
export const tiltakFor = (f) => (f.valg === 'ingen' ? [] : f.tiltak.filter((t) => !(f.valg === 'del' && t.handling === 'fjern')));

// Kort oppsummering av ett forslag (til listen).
const k = (v) => String(v).replace('.', ',');
export function oppsummer(f) {
  const t = f.type === 'flatehogst' ? 'flatehogst' : 'tynning';
  return `${Math.round(f.dekning * 100)} % av bestandet hogd (${k(f.arealDel)} av ${k(f.arealBestand)} daa) · ${k(Math.round(f.m3))} m³ (${k(f.m3Daa)} m³/daa${f.uttak != null ? `, ${Math.round(f.uttak * 100)} % av volumet` : ''}) – tolket som ${t}`;
}

// ---------- bruk valgte endringer ----------
// Gir { logg, angre } og lagrer angreinformasjonen i S.ajourforinger.
export function anvend(S, res, { nyId = lagId, idag = new Date().toISOString().slice(0, 10), oppdrag = null } = {}) {
  const for_ = new Map(); const nye = []; const logg = [];
  const husk = (b) => { if (!for_.has(b.id)) for_.set(b.id, kopi(b)); };
  const alle = () => S.bestand.map((x) => x.nr);
  for (const f of res.forslag) {
    if (f.valg === 'ingen') continue;
    const b = S.bestand.find((x) => x.id === f.bestandId); if (!b) continue;
    husk(b);
    let maal = b; // bestandet som får endringene
    if (f.valg === 'del' && f.geo.del && f.geo.rest) {
      const nb = { ...kopi(b), id: nyId('b'), nr: nyttNr(b.nr, alle()), geometri: f.geo.del, areal: f.arealDel, tiltak: [], hogsthistorikk: [] };
      delete nb.oppdragId;
      b.geometri = f.geo.rest; b.areal = f.arealRest;
      S.bestand.push(nb); nye.push(nb.id); maal = nb;
      logg.push(`Bestand ${b.nr} delt: hogd del (${k(f.arealDel)} daa) er nytt bestand ${nb.nr}, resten (${k(f.arealRest)} daa) beholder ${b.nr}.`);
    }
    // Egenskaper
    if (f.egenskaperValgt !== false) { Object.assign(maal, maal === b ? f.etter.hele : f.etter.del); if (f.type === 'flatehogst') delete maal.ungskog; }
    maal.hogsthistorikk = [...(maal.hogsthistorikk || []), { dato: f.dato || idag, type: f.type === 'flatehogst' ? 'sluttavvirkning' : 'tynning', m3: f.m3, stammer: f.stammer, treslag: f.treslag, kilde: f.kilde, areal: maal === b ? f.arealBestand : f.arealDel }];
    maal.merknad = [maal.merknad, `${f.type === 'flatehogst' ? 'Hogd' : 'Tynnet'} ${f.dato || f.hogstAar} (${f.kilde}, ${f.m3} m³)`].filter(Boolean).join(' · ');
    // Tiltak
    for (const t of tiltakFor(f)) {
      if (!t.valgt) continue;
      if (t.handling === 'utfort') {
        const orig = b.tiltak.find((x) => x.id === t.tiltakId); if (!orig) continue;
        if (maal !== b) {
          // Den hogde delen tar med seg tiltaket (også i oppdraget). Resten får et nytt, planlagt tiltak.
          b.tiltak = b.tiltak.filter((x) => x !== orig); maal.tiltak.push(orig);
          if (f.arealRest * 1000 >= 1000 && orig.type !== 'tynning') b.tiltak.push({ ...kopi(orig), id: nyId('t'), status: 'planlagt', oppdragId: undefined, kommentar: [orig.kommentar, 'Restarealet etter delvis hogst'].filter(Boolean).join(' · ') });
          for (const o of S.oppdrag || []) for (const l of o.linjer || []) if (l.tiltakId === orig.id && l.bestandId === b.id) l.bestandId = maal.id;
          delete orig.arealDaa;
        }
        Object.assign(orig, { status: 'utfort', utfortDato: f.dato || idag, utfortM3: f.m3, utfortStammer: f.stammer, utfortKilde: f.kilde, utfortDaa: maal === b ? f.arealDel : undefined });
        logg.push(`${TILTAKSTYPER[orig.type]?.navn} ${orig.aar} i bestand ${maal.nr} er merket utført.`);
      } else if (t.handling === 'registrer') {
        maal.tiltak = [...(maal.tiltak || []), { id: nyId('t'), type: t.type, aar: t.aar, status: 'utfort', utfortDato: f.dato || idag, utfortM3: f.m3, utfortStammer: f.stammer, utfortKilde: f.kilde, prioritet: 2, kommentar: `Registrert fra ${f.kilde}`, kilde: 'hpr' }];
        logg.push(`${TILTAKSTYPER[t.type]?.navn} ${t.aar} registrert som utført i bestand ${maal.nr}.`);
      } else if (t.handling === 'fjern') {
        const fjernFra = maal === b ? b : null; if (!fjernFra) continue; // ved deling ligger tiltakene på resten
        const x = fjernFra.tiltak.find((y) => y.id === t.tiltakId); if (!x) continue;
        fjernFra.tiltak = fjernFra.tiltak.filter((y) => y !== x);
        for (const o of S.oppdrag || []) o.linjer = (o.linjer || []).filter((l) => l.tiltakId !== x.id);
        logg.push(`${TILTAKSTYPER[x.type]?.navn} ${x.aar} er fjernet fra bestand ${b.nr}.`);
      } else if (t.handling === 'ny') {
        maal.tiltak = [...(maal.tiltak || []), { id: nyId('t'), type: t.type, aar: t.aar, status: 'planlagt', prioritet: t.prioritet || 2, kommentar: t.kommentar || '', kilde: 'hpr' }];
        logg.push(`${t.tekst.replace(/ \(ny\).*$/, '')} lagt til i bestand ${maal.nr}.`);
      }
    }
  }
  if (res.utenfor?.valgt && res.utenfor.geo) {
    const nb = { id: nyId('b'), nr: nyttNr(String(Math.max(0, ...S.bestand.map((x) => parseInt(x.nr, 10) || 0)) + 1), alle()), teig: '', areal: res.utenfor.areal, treslag: 'G', bonitet: null, hogstklasse: 1, alder: 0, volumDaa: 0, treantall: null, hoyde: null, miljo: false, merknad: `Hogd flate fra ${res.kilde} utenfor bestandene – kontroller treslag og bonitet`, ekstra: {}, tiltak: [], takstAar: Number(idag.slice(0, 4)), geometri: res.utenfor.geo };
    S.bestand.push(nb); nye.push(nb.id); logg.push(`Nytt bestand ${nb.nr} (${res.utenfor.areal} daa) av hogd flate utenfor bestandene.`);
  }
  const post = { id: `aj${Date.now().toString(36)}`, dato: idag, kilde: res.kilde, oppdragId: oppdrag?.id || null, logg, for: [...for_.values()], nye, m3: res.m3 };
  S.ajourforinger = [...(S.ajourforinger || []), post].slice(-10);
  return post;
}

// Angre en ajourføring: bestandene får tilbake egenskaper, grenser og tiltak, og nye bestand fjernes.
// Senere endringer i de samme bestandene går tapt – derfor bare den siste kan angres.
export function angre(S, id) {
  const liste = S.ajourforinger || []; const post = liste.find((x) => x.id === id); if (!post) return false;
  if (liste.at(-1) !== post) return false;
  S.bestand = S.bestand.filter((b) => !post.nye.includes(b.id));
  for (const b of post.for) { const i = S.bestand.findIndex((x) => x.id === b.id); if (i >= 0) S.bestand[i] = b; else S.bestand.push(b); }
  // Oppdragslinjer som ble flyttet til nye bestand, flyttes tilbake.
  const tilbake = new Map(post.for.flatMap((b) => (b.tiltak || []).map((t) => [t.id, b.id])));
  for (const o of S.oppdrag || []) for (const l of o.linjer || []) if (tilbake.has(l.tiltakId)) l.bestandId = tilbake.get(l.tiltakId);
  // Oppdrag som ble satt til utført, men som nå har tiltak som ikke er utført, går tilbake til «pågår».
  for (const o of S.oppdrag || []) {
    if (o.status !== 'utfort') continue;
    const ts = (o.linjer || []).map((l) => S.bestand.find((b) => b.id === l.bestandId)?.tiltak?.find((t) => t.id === l.tiltakId)).filter(Boolean);
    if (ts.some((t) => t.status !== 'utfort')) { o.status = 'pagar'; delete o.utfortDato; }
  }
  S.ajourforinger = liste.filter((x) => x !== post);
  return true;
}

// ---------- kartlag ----------
// Hogstmaskindata lagret i planen for kartet (komprimert): stammer [lon, lat, treslag, dl], hogd flate og spor.
export function lagreKart(S, { id, navn, stammer, hogd, spor = [], dato }, { maks = 15000 } = {}) {
  const med = stammer.filter((s) => s.pos); const steg = Math.max(1, Math.ceil(med.length / maks));
  const st = []; for (let i = 0; i < med.length; i += steg) { const s = med[i]; st.push([r(s.pos[0], 6), r(s.pos[1], 6), 'GFL'.indexOf(s.treslag), Math.round((s.fub || 0) * 1000)]); }
  const post = { id, navn, dato, antall: stammer.length, m3: r(stammer.reduce((s, x) => s + (x.fub || 0), 0), 1), stammer: st, hogd, spor: spor.slice(0, 300) };
  S.hogstdata = [...(S.hogstdata || []).filter((x) => x.id !== id), post].slice(-8);
  return post;
}
export function kartGeojson(liste, { forslag = null } = {}) {
  const f = [];
  for (const h of liste || []) {
    if (h.hogd) f.push({ type: 'Feature', geometry: h.hogd, properties: { lag: 'hogd', navn: h.navn, m3: h.m3, antall: h.antall, dato: h.dato } });
    for (const l of h.spor || []) f.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: l }, properties: { lag: 'spor' } });
    for (const [lon, lat, t, dl] of h.stammer || []) f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { lag: 'stamme', treslag: 'GFL'[t] || 'L', m3: dl / 1000 } });
  }
  if (forslag) for (const x of forslag.forslag) if (x.valg === 'del' && x.geo.del) f.push({ type: 'Feature', geometry: x.geo.del, properties: { lag: 'ny-grense', nr: x.nr } });
  if (forslag?.utenfor?.valgt) f.push({ type: 'Feature', geometry: forslag.utenfor.geo, properties: { lag: 'ny-grense', nr: 'nytt' } });
  return { type: 'FeatureCollection', features: f };
}
