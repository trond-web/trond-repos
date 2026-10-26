// Rene funksjoner for turveiene: geometri, bruksindeks fra varmekart, høydeprofil og folkehelse-tall.
// Brukes både av nettleseren (js/app.js) og av datainnhentingen i Node (data/hent-data.mjs).
// Koordinater er [lat, lon] overalt, som i Leaflet.

export const GRAN = { navn: 'Gran', kommunenummer: '3446', sentrum: [60.392953, 10.560421] };

// Varmekartet «run» i Strava omfatter alle aktiviteter til fots (løping, gåing og fotturer), «ride» sykling.

// Helsedirektoratet anbefaler voksne minst 150 minutter moderat fysisk aktivitet i uka.
export const UKEMAAL_MIN = 150;

export const TYPER = {
  tur: { navn: 'Turstier', entall: 'Tursti', farge: '#0f766e', varmekart: 'run' },
  sykkel: { navn: 'Sykkelruter', entall: 'Sykkelrute', farge: '#c2410c', varmekart: 'ride' },
  hverdag: { navn: 'Gang- og sykkelveger', entall: 'Gang- og sykkelveg', farge: '#6d28d9', varmekart: 'all' },
};

// Hva ruta følger, fra Turrutebasen (ruteFølger) og NVDB (typeVeg).
export const UNDERLAG = {
  ST: 'sti', TR: 'traktorveg', SB: 'skogsbilveg', BV: 'bilveg', GS: 'gang- og sykkelveg', TV: 'turveg',
};
export const SPESIALTYPE = { HF: 'historisk ferdselsveg', KS: 'kultursti', NT: 'natursti', PG: 'pilegrimsled' };
export const GRADERING = { G: 'grønn (enkel)', B: 'blå (middels)', R: 'rød (krevende)', S: 'svart (ekspert)' };

const R = 6371008.8;
const rad = g => (g * Math.PI) / 180;

export function avstandM([lat1, lon1], [lat2, lon2]) {
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const linjeLengde = linje => linje.reduce((s, p, i) => (i ? s + avstandM(linje[i - 1], p) : 0), 0);
export const lengde = deler => deler.reduce((s, l) => s + linjeLengde(l), 0);

// Punkter langs linja med fast avstand (meter), inkludert endepunktene.
export function punkterLangs(linje, steg) {
  if (linje.length < 2) return linje.slice();
  const ut = [linje[0]];
  let rest = steg;
  for (let i = 1; i < linje.length; i++) {
    const [a, b] = [linje[i - 1], linje[i]];
    const d = avstandM(a, b);
    let pos = rest;
    while (pos <= d) {
      const t = pos / d;
      ut.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      pos += steg;
    }
    rest = pos - d;
  }
  const siste = linje[linje.length - 1];
  if (avstandM(ut[ut.length - 1], siste) > steg / 4) ut.push(siste);
  return ut;
}

// Douglas–Peucker med toleranse i meter (lokal flat projeksjon er godt nok innenfor en kommune).
export function forenkle(linje, tol = 8) {
  if (linje.length < 3) return linje.slice();
  const kx = 111320 * Math.cos(rad(linje[0][0])), ky = 110540;
  const xy = linje.map(([la, lo]) => [lo * kx, la * ky]);
  const behold = new Uint8Array(linje.length);
  behold[0] = behold[linje.length - 1] = 1;
  const stabel = [[0, linje.length - 1]];
  while (stabel.length) {
    const [i, j] = stabel.pop();
    const [ax, ay] = xy[i], [bx, by] = xy[j];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let maks = 0, k = -1;
    for (let m = i + 1; m < j; m++) {
      const [px, py] = xy[m];
      const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > maks) { maks = d; k = m; }
    }
    if (maks > tol) { behold[k] = 1; stabel.push([i, k], [k, j]); }
  }
  return linje.filter((_, i) => behold[i]);
}

// Polygon som GeoJSON-ringer i [lon, lat] (som fra Kartverkets kommuneinfo). Hull håndteres med partallsregelen.
export function iPolygon([lat, lon], multipolygon) {
  let inne = false;
  for (const polygon of multipolygon) {
    for (const ring of polygon) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inne = !inne;
      }
    }
  }
  return inne;
}

// Deler en linje i bitene som ligger innenfor kommunen.
export function klipp(linje, multipolygon) {
  const deler = [];
  let del = [];
  for (const p of linje) {
    if (iPolygon(p, multipolygon)) del.push(p);
    else { if (del.length > 1) deler.push(del); del = []; }
  }
  if (del.length > 1) deler.push(del);
  return deler;
}

// Slår sammen linjebiter som henger sammen i endene, slik at en rute blir så få linjer som mulig.
export function skjoet(linjer, toleranse = 3) {
  const igjen = linjer.map(l => l.slice());
  const ut = [];
  while (igjen.length) {
    let l = igjen.shift();
    let fant = true;
    while (fant) {
      fant = false;
      for (let i = 0; i < igjen.length; i++) {
        const m = igjen[i];
        const [a, b] = [l[0], l[l.length - 1]];
        const [c, d] = [m[0], m[m.length - 1]];
        if (avstandM(b, c) <= toleranse) l = l.concat(m.slice(1));
        else if (avstandM(b, d) <= toleranse) l = l.concat(m.slice(0, -1).reverse());
        else if (avstandM(a, d) <= toleranse) l = m.concat(l.slice(1));
        else if (avstandM(a, c) <= toleranse) l = m.slice().reverse().concat(l.slice(1));
        else continue;
        igjen.splice(i, 1);
        fant = true;
        break;
      }
    }
    ut.push(l);
  }
  return ut;
}

// ---------- Varmekart (Strava Global Heatmap) ----------

// Varmekartet er åpent til zoom 11 med 512-pikselfliser, dvs. omtrent 19 m per piksel i Gran.
export const VARMEKART_ZOOM = 11;
export const VARMEKART_FLIS = 512;

export function tilPiksel([lat, lon], z = VARMEKART_ZOOM, flis = VARMEKART_FLIS) {
  const n = 2 ** z * flis;
  const x = ((lon + 180) / 360) * n;
  const y = ((1 - Math.asinh(Math.tan(rad(lat))) / Math.PI) / 2) * n;
  return { x: Math.floor(x), y: Math.floor(y) };
}

export function fliserFor([[s, v], [n, o]], z = VARMEKART_ZOOM, flis = VARMEKART_FLIS) {
  const a = tilPiksel([n, v], z, flis), b = tilPiksel([s, o], z, flis);
  const ut = [];
  for (let x = Math.floor(a.x / flis); x <= Math.floor(b.x / flis); x++)
    for (let y = Math.floor(a.y / flis); y <= Math.floor(b.y / flis); y++) ut.push({ z, x, y });
  return ut;
}

// Leser intensiteten (0–255) i varmekartet rundt et punkt. `pikselVed(x, y)` gir verdien i en global
// pikselkoordinat. Vi tar største verdi innenfor ±radius piksler, fordi rutene i Turrutebasen kan ligge
// noen titalls meter ved siden av sporene.
export function intensitetVed(p, pikselVed, radius = 1, z = VARMEKART_ZOOM) {
  const { x, y } = tilPiksel(p, z);
  let maks = 0;
  for (let dx = -radius; dx <= radius; dx++)
    for (let dy = -radius; dy <= radius; dy++) maks = Math.max(maks, pikselVed(x + dx, y + dy) || 0);
  return maks;
}

// Bruk langs en rute: snitt av intensiteten og andelen av ruta der det finnes spor.
export function bruk(deler, pikselVed, { steg = 15, radius = 1, z = VARMEKART_ZOOM } = {}) {
  let sum = 0, antall = 0, medSpor = 0;
  for (const linje of deler) {
    for (const p of punkterLangs(linje, steg)) {
      const v = intensitetVed(p, pikselVed, radius, z);
      sum += v; antall++;
      if (v > 0) medSpor++;
    }
  }
  return antall ? { snitt: sum / antall, andel: medSpor / antall } : { snitt: 0, andel: 0 };
}

// Ved zoom 11 er nesten alle veger og mye brukte stier mettet (255), fordi Strava normaliserer fargene lokalt.
// Grovere zoomnivåer samler flere aktiviteter per piksel og skiller bedre mellom travle og rolige ruter.
// Bruksindeksen er derfor et vektet snitt over zoom 8–10, mens andelen med spor måles ved zoom 11.
export const VARMEKART_ZOOMER = [{ z: 8, vekt: 0.25 }, { z: 9, vekt: 0.45 }, { z: 10, vekt: 0.3 }];

// Bruksindeks 0–100. En rute der bare en kort bit har spor, trekkes ned.
export const bruksindeks = ({ snitt, andel }) => Math.round(Math.min(100, (snitt / 255) * 100 * (0.5 + 0.5 * andel)));

// Nivå 1–5 ut fra rangering innenfor samme type (kvintiler), så ordene betyr det samme for sti og sykkel.
export const NIVAA = ['Lite brukt', 'Noe brukt', 'Middels brukt', 'Mye brukt', 'Svært mye brukt'];
export function settNivaa(ruter) {
  for (const type of Object.keys(TYPER)) {
    const liste = ruter.filter(r => r.type === type).sort((a, b) => b.indeks - a.indeks);
    liste.forEach((r, i) => {
      r.rang = i + 1;
      r.nivaa = r.indeks === 0 ? 0 : 5 - Math.min(4, Math.floor((i / liste.length) * 5));
    });
  }
  return ruter;
}

// ---------- Høyde ----------

// Samlet stigning og fall med en enkel terskel, så støy i terrengmodellen ikke telles som klatring.
export function stigning(hoyder, terskel = 3) {
  let opp = 0, ned = 0, ref = hoyder.find(h => h != null);
  for (const h of hoyder) {
    if (h == null || ref == null) continue;
    if (h - ref >= terskel) { opp += h - ref; ref = h; }
    else if (ref - h >= terskel) { ned += ref - h; ref = h; }
  }
  return { opp: Math.round(opp), ned: Math.round(ned) };
}

// ---------- Folkehelse ----------

// Tidsbruk: gange 4,5 km/t + 1 min per 10 høydemeter opp. Sykkel 16 km/t + 1 min per 15 høydemeter opp.
export function minutter(r, modus = r.type === 'sykkel' ? 'sykkel' : 'gange') {
  const km = r.lengde / 1000, opp = r.opp || 0;
  return modus === 'sykkel' ? Math.round((km / 16) * 60 + opp / 15) : Math.round((km / 4.5) * 60 + opp / 10);
}

// Energiforbruk med MET-verdier (Compendium of Physical Activities): gange 3,5, gange i bratt terreng opp
// mot 6, sykling i rolig tempo 6,8. Gjelder en person med vekt `kg`.
export function kalorier(r, kg = 70, modus = r.type === 'sykkel' ? 'sykkel' : 'gange') {
  const timer = minutter(r, modus) / 60;
  const bratthet = r.lengde ? Math.min(1, (r.opp || 0) / r.lengde / 0.08) : 0;
  const met = modus === 'sykkel' ? 6.8 : 3.5 + 2.5 * bratthet;
  return Math.round(met * kg * timer);
}

export const skritt = r => Math.round((r.lengde / 1000) * 1350 / 100) * 100;

// Grov vanskelighetsgrad ut fra lengde og stigning når ruta ikke har gradering i Turrutebasen.
export function anstrengelse(r) {
  const poeng = r.lengde / 1000 + (r.opp || 0) / 100;
  return poeng < 4 ? 'Lett' : poeng < 10 ? 'Middels' : 'Krevende';
}

// Mandag 00:00 lokal tid i uka `dato` tilhører.
export function ukestart(dato = new Date()) {
  const d = new Date(dato);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

export function ukenummer(dato = new Date()) {
  const d = new Date(Date.UTC(dato.getFullYear(), dato.getMonth(), dato.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const aar = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - aar) / 864e5 + 1) / 7);
}

// Minutter logget denne uka (logg: [{ dato: ISO, min }]).
export const ukensMinutter = (logg, naa = new Date()) => {
  const start = ukestart(naa).getTime();
  return logg.filter(l => new Date(l.dato).getTime() >= start).reduce((s, l) => s + l.min, 0);
};

// Ukens tur: samme forslag for alle innbyggere hele uka, valgt blant de mest brukte navngitte stiene på 3–12 km.
export function ukensTur(ruter, dato = new Date()) {
  const kandidater = ruter
    .filter(r => r.type === 'tur' && r.lengde >= 3000 && r.lengde <= 12000 && r.nivaa >= 3 && !/^Sti ved /.test(r.navn))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!kandidater.length) return null;
  return kandidater[(dato.getFullYear() * 53 + ukenummer(dato)) % kandidater.length];
}

// Avstand fra et punkt til nærmeste punkt på ruta (meter).
export function avstandTilRute(p, r) {
  let min = Infinity;
  for (const l of r.linjer) for (const q of l) min = Math.min(min, avstandM(p, q));
  return min;
}

// ---------- GPX ----------

const xml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

export function gpx(r) {
  const spor = r.linjer.map(l => `<trkseg>${l.map(([la, lo]) => `<trkpt lat="${la}" lon="${lo}"/>`).join('')}</trkseg>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Turveier i Gran" xmlns="http://www.topografix.com/GPX/1/1">` +
    `<metadata><name>${xml(r.navn)}</name></metadata><trk><name>${xml(r.navn)}</name>${spor}</trk></gpx>\n`;
}

export const filnavn = s => s.toLowerCase().replace(/[æ]/g, 'ae').replace(/[ø]/g, 'o').replace(/[å]/g, 'a')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'rute';
