// Enkel SOSI-leser for skogbruksplaner: leser .FLATE med ..REF til .KURVE/.LINJE,
// hull i parentes, ..ENHET, ..ORIGO-NØ og ..KOORDSYS. Attributter samles flatt per objekt.

const KOORDSYS_SOSI = { 22: 'UTM32', 23: 'UTM33', 25: 'UTM35', 84: 'WGS84' };

// Velger tegnsett ut fra ..TEGNSETT i hodet. Tar en ArrayBuffer eller streng.
export function dekodSosi(input) {
  if (typeof input === 'string') return input;
  const bytes = new Uint8Array(input);
  const hode = new TextDecoder('latin1').decode(bytes.slice(0, 4000));
  const m = hode.match(/\.\.TEGNSETT\s+(\S+)/i);
  const ts = m ? m[1].toUpperCase() : '';
  if (ts.startsWith('UTF')) return new TextDecoder('utf-8').decode(bytes);
  if (ts.startsWith('ISO8859') || ts === 'ANSI' || ts === 'ISO8859-10') return new TextDecoder('latin1').decode(bytes);
  // Ukjent: prøv UTF-8, fall tilbake til latin1 hvis det gir erstatningstegn.
  const utf = new TextDecoder('utf-8').decode(bytes);
  return utf.includes('�') ? new TextDecoder('latin1').decode(bytes) : utf;
}

function tolkVerdi(v) {
  const s = v.trim();
  if (/^".*"$/.test(s) || /^'.*'$/.test(s)) return s.slice(1, -1);
  if (/^-?\d+([.,]\d+)?$/.test(s)) return Number(s.replace(',', '.'));
  return s;
}

export function parseSosi(input) {
  const tekst = dekodSosi(input).replace(/\r/g, '');
  const linjer = tekst.split('\n');
  const objekter = [];
  let gjeldende = null;
  let modus = null; // 'koord' | 'ref' | null

  for (const raa of linjer) {
    const linje = raa.replace(/!.*$/, '').trim(); // ! innleder kommentar i SOSI
    if (!linje) continue;
    const mObj = linje.match(/^\.([A-ZÆØÅa-zæøå-]+)\s*(\d+)?\s*:?\s*(.*)$/);
    if (mObj && !linje.startsWith('..')) {
      gjeldende = { type: mObj[1].toUpperCase(), id: mObj[2] ? Number(mObj[2]) : null, attr: {}, koord: [], ref: [], hode: {} };
      objekter.push(gjeldende);
      modus = null;
      continue;
    }
    if (!gjeldende) continue;
    if (linje.startsWith('..')) {
      const m = linje.match(/^\.+([^\s]+)\s*(.*)$/);
      const navn = m[1].toUpperCase();
      const rest = m[2] || '';
      if (navn === 'NØ' || navn === 'NØH' || navn === 'NO' || navn === 'NOH') {
        modus = 'koord';
        if (rest) leggTilKoord(gjeldende, rest);
      } else if (navn === 'REF') {
        modus = 'ref';
        gjeldende.ref.push(rest);
      } else {
        modus = null;
        if (rest !== '') {
          // ...ORIGO-NØ har to verdier
          const verdier = rest.match(/"[^"]*"|'[^']*'|\S+/g) || [];
          gjeldende.attr[navn] = verdier.length > 1 && navn.includes('NØ') ? verdier.map(tolkVerdi) : tolkVerdi(rest);
        }
      }
      continue;
    }
    if (modus === 'koord') leggTilKoord(gjeldende, linje);
    else if (modus === 'ref') gjeldende.ref.push(linje);
  }

  const hode = objekter.find((o) => o.type === 'HODE');
  const enhet = Number(hode?.attr.ENHET ?? 1) || 1;
  const origo = Array.isArray(hode?.attr['ORIGO-NØ']) ? hode.attr['ORIGO-NØ'] : [0, 0];
  const koordsysKode = Number(hode?.attr.KOORDSYS);
  const koordsys = KOORDSYS_SOSI[koordsysKode] || null;
  const advarsler = [];
  if (koordsysKode && !koordsys) advarsler.push(`KOORDSYS ${koordsysKode} støttes ikke (bare EUREF89 UTM 32/33/35). Konverter filen først.`);

  // Koordinater i SOSI er N Ø; vi lagrer [x=Ø, y=N].
  const tilXY = ([n, o]) => [o * enhet + Number(origo[1] || 0), n * enhet + Number(origo[0] || 0)];
  const kurver = new Map();
  for (const o of objekter) {
    if (o.id != null && o.koord.length) kurver.set(o.id, o.koord.map(tilXY));
  }

  const features = [];
  for (const o of objekter) {
    if (o.type === 'FLATE') {
      const ringer = byggRinger(o.ref.join(' '), kurver, advarsler, o.id);
      if (!ringer.length) continue;
      features.push({ type: 'Feature', properties: { ...o.attr, _sosiId: o.id }, geometry: { type: 'Polygon', coordinates: ringer } });
    } else if (o.type === 'PUNKT' && o.koord.length) {
      features.push({ type: 'Feature', properties: { ...o.attr, _sosiId: o.id }, geometry: { type: 'Point', coordinates: tilXY(o.koord[0]) } });
    }
  }
  return { type: 'FeatureCollection', features, koordsys, advarsler };
}

function leggTilKoord(obj, tekst) {
  const tall = (tekst.match(/-?\d+(\.\d+)?/g) || []).map(Number);
  // Hopper over evt. ...KP-merking etter koordinatene; tar par (eller tripler hvis NØH er brukt med 3 tall per linje).
  const steg = tall.length === 3 ? 3 : 2;
  for (let i = 0; i + 1 < tall.length; i += steg) obj.koord.push([tall[i], tall[i + 1]]);
}

function byggRinger(refTekst, kurver, advarsler, flateId) {
  // Deler i ytre ring og hull: "(...)"-grupper er hull.
  const grupper = [];
  const ytre = refTekst.replace(/\(([^)]*)\)/g, (_, inne) => { grupper.push(inne); return ' '; });
  const ringer = [];
  for (const del of [ytre, ...grupper]) {
    const refs = del.match(/-?:?\d+/g) || [];
    const ring = [];
    for (const r of refs) {
      const id = Math.abs(Number(r.replace(':', '')));
      const kurve = kurver.get(id);
      if (!kurve) { advarsler.push(`Flate ${flateId}: mangler kurve ${id}`); continue; }
      const pts = r.startsWith('-') ? [...kurve].reverse() : kurve;
      for (const p of pts) {
        const siste = ring[ring.length - 1];
        if (!siste || siste[0] !== p[0] || siste[1] !== p[1]) ring.push(p);
      }
    }
    if (ring.length >= 3) {
      const [f, l] = [ring[0], ring[ring.length - 1]];
      if (f[0] !== l[0] || f[1] !== l[1]) ring.push([...f]);
      ringer.push(ring);
    }
  }
  return ringer;
}

// Enkel SOSI-eksport (UTM, ENHET 0.01). Hver flate får sin egen kurve.
export function lagSosi(features, koordsys, objtype = 'Bestand') {
  const kode = Object.entries(KOORDSYS_SOSI).find(([, v]) => v === koordsys)?.[0] || 22;
  const ut = ['.HODE', '..TEGNSETT UTF-8', '..TRANSPAR', `...KOORDSYS ${kode}`, '...ORIGO-NØ 0 0', '...ENHET 0.01', '..SOSI-VERSJON 4.5'];
  let id = 1;
  const kurveLinjer = [];
  for (const f of features) {
    if (!f.geometry || f.geometry.type !== 'Polygon') continue;
    const flateId = id++;
    const refs = [];
    f.geometry.coordinates.forEach((ring, i) => {
      const kid = id++;
      refs.push(i === 0 ? `:${kid}` : `(:${kid})`);
      kurveLinjer.push(`.KURVE ${kid}:`, '..OBJTYPE Bestandsgrense', '..NØ');
      for (const [x, y] of ring) kurveLinjer.push(`${Math.round(y * 100)} ${Math.round(x * 100)}`);
    });
    ut.push(`.FLATE ${flateId}:`, `..OBJTYPE ${objtype}`);
    for (const [k, v] of Object.entries(f.properties || {})) {
      if (v === null || v === undefined || v === '' || typeof v === 'object') continue;
      const navn = k.toUpperCase().replace(/[^A-ZÆØÅ0-9_-]/g, '_');
      ut.push(`..${navn} ${typeof v === 'number' ? v : `"${String(v).replace(/"/g, "'")}"`}`);
    }
    ut.push(`..REF ${refs.join(' ')}`);
    const [x, y] = f.geometry.coordinates[0][0];
    ut.push('..NØ', `${Math.round(y * 100)} ${Math.round(x * 100)}`);
  }
  return [...ut, ...kurveLinjer, '.SLUTT', ''].join('\n');
}
