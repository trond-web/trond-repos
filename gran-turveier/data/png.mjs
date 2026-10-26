// Minimal PNG-dekoder for varmekartflisene (8-bits palett eller gråtone, uten interlace).
// Vi trenger bare palettindeksen: i Stravas varmekart er indeksen selve intensiteten (0–255).
import { inflateSync } from 'node:zlib';

export function dekodPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Ikke en PNG');
  let pos = 8, bredde, hoyde, dybde, farge, interlace;
  const data = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const innhold = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      bredde = innhold.readUInt32BE(0); hoyde = innhold.readUInt32BE(4);
      dybde = innhold[8]; farge = innhold[9]; interlace = innhold[12];
    } else if (type === 'IDAT') data.push(innhold);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (dybde !== 8 || interlace || ![0, 3].includes(farge)) throw new Error(`PNG-format støttes ikke (dybde ${dybde}, farge ${farge})`);
  const raa = inflateSync(Buffer.concat(data));
  const ut = new Uint8Array(bredde * hoyde);
  let forrige = new Uint8Array(bredde);
  for (let y = 0; y < hoyde; y++) {
    const filter = raa[y * (bredde + 1)];
    const rad = raa.subarray(y * (bredde + 1) + 1, (y + 1) * (bredde + 1));
    const linje = new Uint8Array(bredde);
    for (let x = 0; x < bredde; x++) {
      const a = x ? linje[x - 1] : 0, b = forrige[x], c = x ? forrige[x - 1] : 0;
      let v = rad[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      linje[x] = v & 255;
    }
    ut.set(linje, y * bredde);
    forrige = linje;
  }
  return { bredde, hoyde, piksler: ut };
}
