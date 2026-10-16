/* ------------------------------------------------------------------ *
 *  Minimal leser for Mapbox Vector Tiles (protobuf), uten avhengigheter.
 *  Gir linjer i lengde-/breddegrad med egenskaper. Brukes av hent-loyper.mjs.
 * ------------------------------------------------------------------ */

function reader(buf) {
  let pos = 0;
  const varint = () => {
    let v = 0, shift = 0, b;
    do {
      b = buf[pos++];
      v += (b & 0x7f) * 2 ** shift;
      shift += 7;
    } while (b & 0x80);
    return v;
  };
  return {
    get pos() { return pos; },
    end: () => pos >= buf.length,
    varint,
    tag() { const t = varint(); return [t >>> 3, t & 7]; },
    bytes() { const len = varint(); const out = buf.subarray(pos, pos + len); pos += len; return out; },
    skip(wire) {
      if (wire === 0) varint();
      else if (wire === 1) pos += 8;
      else if (wire === 2) pos += varint();
      else if (wire === 5) pos += 4;
      else throw new Error(`Ukjent wire-type ${wire}`);
    },
  };
}

const zigzag = (n) => (n % 2 ? -(n + 1) / 2 : n / 2);

function packed(bytes) {
  const r = reader(bytes);
  const out = [];
  while (!r.end()) out.push(r.varint());
  return out;
}

function value(bytes) {
  const r = reader(bytes);
  let v = null;
  while (!r.end()) {
    const [f, w] = r.tag();
    if (f === 1) v = new TextDecoder().decode(r.bytes());
    else if (f === 2) { v = new DataView(bytes.buffer, bytes.byteOffset + r.pos, 4).getFloat32(0, true); r.skip(w); }
    else if (f === 3) { v = new DataView(bytes.buffer, bytes.byteOffset + r.pos, 8).getFloat64(0, true); r.skip(w); }
    else if (f === 4 || f === 5) v = r.varint();
    else if (f === 6) v = zigzag(r.varint());
    else if (f === 7) v = !!r.varint();
    else r.skip(w);
  }
  return v;
}

// Geometri-kommandoer → liste av linjer i flisekoordinater
function lines(cmds) {
  const out = [];
  let x = 0, y = 0, cur = null, i = 0;
  while (i < cmds.length) {
    const c = cmds[i++];
    const id = c & 7, count = c >> 3;
    if (id === 7) { if (cur?.length) cur.push(cur[0]); continue; }
    for (let k = 0; k < count; k++) {
      x += zigzag(cmds[i++]);
      y += zigzag(cmds[i++]);
      if (id === 1) { cur = [[x, y]]; out.push(cur); } else cur.push([x, y]);
    }
  }
  return out;
}

/** Leser én flis og returnerer { lagnavn: [{ props, lines: [[[lat, lon], …]] }] } */
export function decodeTile(buf, z, tx, ty) {
  const r = reader(buf);
  const result = {};
  while (!r.end()) {
    const [f, w] = r.tag();
    if (f !== 3) { r.skip(w); continue; }
    const lr = reader(r.bytes());
    let name = "", extent = 4096;
    const keys = [], values = [], feats = [];
    while (!lr.end()) {
      const [lf, lw] = lr.tag();
      if (lf === 1) name = new TextDecoder().decode(lr.bytes());
      else if (lf === 2) feats.push(lr.bytes());
      else if (lf === 3) keys.push(new TextDecoder().decode(lr.bytes()));
      else if (lf === 4) values.push(value(lr.bytes()));
      else if (lf === 5) extent = lr.varint();
      else lr.skip(lw);
    }
    const n = 2 ** z;
    const toLatLon = ([px, py]) => {
      const lon = ((tx + px / extent) / n) * 360 - 180;
      const my = Math.PI * (1 - (2 * (ty + py / extent)) / n);
      return [Math.atan(Math.sinh(my)) * (180 / Math.PI), lon];
    };
    result[name] = feats.map((fb) => {
      const fr = reader(fb);
      const props = {};
      let geom = [], type = 0;
      while (!fr.end()) {
        const [ff, fw] = fr.tag();
        if (ff === 2) { const t = packed(fr.bytes()); for (let i = 0; i < t.length; i += 2) props[keys[t[i]]] = values[t[i + 1]]; }
        else if (ff === 3) type = fr.varint();
        else if (ff === 4) geom = packed(fr.bytes());
        else fr.skip(fw);
      }
      return { type, props, lines: type === 2 ? lines(geom).map((l) => l.map(toLatLon)) : [] };
    });
  }
  return result;
}
