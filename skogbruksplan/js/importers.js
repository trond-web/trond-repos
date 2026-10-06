// Import av skogbruksplandata: GeoJSON, SOSI og CSV/tekst (bestandsliste uten kart).
import { parseSosi } from './sosi.js';
import { tilWgs84, gjettKoordsys, arealM2, bbox } from './proj.js';
import { normaliserBestand } from './model.js';

function crsFraGeojson(gj) {
  const navn = gj?.crs?.properties?.name || '';
  if (/25832|UTM zone 32|32632/i.test(navn)) return 'UTM32';
  if (/25833|UTM zone 33|32633/i.test(navn)) return 'UTM33';
  if (/25835|UTM zone 35|32635/i.test(navn)) return 'UTM35';
  if (/4326|4258|CRS84/i.test(navn)) return 'WGS84';
  return null;
}

// Gjør om polygon-features (i gitt koordsys) til bestand i WGS84.
export function featuresTilBestand(features, koordsys, iAar) {
  const bestand = [];
  let hoppetOver = 0;
  for (const f of features) {
    const g = f.geometry;
    if (!g || !['Polygon', 'MultiPolygon'].includes(g.type)) { hoppetOver++; continue; }
    const geo = tilWgs84(g, koordsys);
    const daa = arealM2(geo) / 1000;
    bestand.push(normaliserBestand(f.properties, geo, daa, iAar));
  }
  return { bestand, hoppetOver };
}

export function lesGeojson(tekst, valgtKoordsys = 'auto', iAar) {
  const gj = JSON.parse(tekst);
  const features = gj.type === 'FeatureCollection' ? gj.features : gj.type === 'Feature' ? [gj] : [];
  let koordsys = valgtKoordsys !== 'auto' ? valgtKoordsys : crsFraGeojson(gj);
  if (!koordsys) {
    const bb = bbox(features.map((f) => f.geometry));
    koordsys = bb ? gjettKoordsys(bb[0], bb[1]) : 'WGS84';
  }
  if (!koordsys) throw new Error('Klarte ikke å avgjøre koordinatsystem. Velg det manuelt.');
  const eiendomsgrense = gj.eiendomsgrense ? tilWgs84(gj.eiendomsgrense, koordsys) : null;
  return { ...featuresTilBestand(features, koordsys, iAar), koordsys, advarsler: [], eiendomsgrense, metadata: gj.metadata || null };
}

export function lesSosi(buffer, valgtKoordsys = 'auto', iAar) {
  const fc = parseSosi(buffer);
  let koordsys = valgtKoordsys !== 'auto' ? valgtKoordsys : fc.koordsys;
  if (!koordsys) {
    const bb = bbox(fc.features.map((f) => f.geometry));
    koordsys = bb ? gjettKoordsys(bb[0], bb[1]) : null;
  }
  if (!koordsys) throw new Error('Ukjent koordinatsystem i SOSI-filen. Velg det manuelt.');
  // Ta bare med flater som ser ut som bestand (eller alle flater hvis OBJTYPE mangler/er ukjent).
  const erBestand = (f) => /BESTAND|SKOG|BEST/i.test(String(f.properties.OBJTYPE || 'Bestand'));
  const kandidater = fc.features.filter((f) => f.geometry.type === 'Polygon');
  const flater = kandidater.some(erBestand) ? kandidater.filter(erBestand) : kandidater;
  return { ...featuresTilBestand(flater, koordsys, iAar), koordsys, advarsler: fc.advarsler };
}

export function parseCsv(tekst) {
  const linjer = tekst.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (!linjer.length) return [];
  const forste = linjer[0];
  const skilletegn = [';', '\t', ','].sort((a, b) => forste.split(b).length - forste.split(a).length)[0];
  const del = (l) => {
    const ut = []; let cur = ''; let iAnf = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') { if (iAnf && l[i + 1] === '"') { cur += '"'; i++; } else iAnf = !iAnf; } else if (c === skilletegn && !iAnf) { ut.push(cur); cur = ''; } else cur += c;
    }
    ut.push(cur);
    return ut.map((s) => s.trim());
  };
  const hode = del(linjer[0]);
  return linjer.slice(1).map((l) => {
    const v = del(l);
    return Object.fromEntries(hode.map((h, i) => [h, v[i] ?? '']));
  });
}

export function lesCsv(tekst, iAar) {
  const rader = parseCsv(tekst);
  return { bestand: rader.map((r) => normaliserBestand(r, null, 0, iAar)), hoppetOver: 0, koordsys: null, advarsler: [] };
}

export async function lesFil(fil, valgtKoordsys, iAar) {
  const navn = fil.name.toLowerCase();
  if (navn.endsWith('.sos') || navn.endsWith('.sosi')) return lesSosi(await fil.arrayBuffer(), valgtKoordsys, iAar);
  if (navn.endsWith('.geojson') || navn.endsWith('.json')) return lesGeojson(await fil.text(), valgtKoordsys, iAar);
  if (navn.endsWith('.csv') || navn.endsWith('.txt') || navn.endsWith('.tsv')) return lesCsv(await fil.text(), iAar);
  throw new Error(`Ukjent filtype: ${fil.name}. Støttet: .sos, .geojson/.json, .csv`);
}

// Slår sammen importerte bestand med eksisterende: samme bestandsnr oppdateres, nye legges til.
export function slaaSammen(eksisterende, nye, modus = 'flett') {
  if (modus === 'erstatt') return { liste: nye, oppdatert: 0, lagtTil: nye.length };
  const liste = eksisterende.map((b) => ({ ...b }));
  let oppdatert = 0; let lagtTil = 0;
  for (const n of nye) {
    const treff = n.nr ? liste.find((b) => b.nr === n.nr && (b.teig || '') === (n.teig || '')) : null;
    if (treff) {
      for (const [k, v] of Object.entries(n)) {
        if (k === 'id' || k === 'tiltak') continue;
        if (k === 'geometri' && !v) continue;
        if (v !== null && v !== '' && !(k === 'areal' && !v)) treff[k] = v;
      }
      for (const t of n.tiltak) if (!treff.tiltak.some((x) => x.type === t.type && x.aar === t.aar)) treff.tiltak.push(t);
      oppdatert++;
    } else { liste.push(n); lagtTil++; }
  }
  return { liste, oppdatert, lagtTil };
}
