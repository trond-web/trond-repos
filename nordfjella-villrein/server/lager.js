// Enkel varig lagring i én JSON-fil. På Railway ligger fila på et volum (DATA_DIR=/data), så den overlever nye publiseringer.
// Skriving skjer i kø og atomisk (skriv til midlertidig fil, så rename), så fila aldri blir halvskrevet.
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';

const TOM = () => ({ versjon: 1, revisjon: 0, brukere: {}, jaktfelt: {}, samjakt: [], logg: [] });

export async function aapneLager(mappe) {
  await mkdir(mappe, { recursive: true });
  const fil = path.join(mappe, 'nordfjella.json');
  let data;
  try { data = { ...TOM(), ...JSON.parse(await readFile(fil, 'utf8')) }; } catch (e) {
    if (e.code !== 'ENOENT') throw new Error(`Kunne ikke lese ${fil}: ${e.message}`);
    data = TOM();
  }
  let ko = Promise.resolve();
  const lagre = () => {
    const kopi = JSON.stringify(data);
    ko = ko.then(async () => {
      const tmp = `${fil}.${process.pid}.tmp`;
      await writeFile(tmp, kopi);
      await rename(tmp, fil);
    });
    return ko;
  };
  return {
    fil,
    get data() { return data; },
    // Endrer data, øker revisjonen (brukes som ETag) og skriver til disk.
    async endre(fn, logg) {
      fn(data);
      data.revisjon += 1;
      if (logg) data.logg = [{ tid: new Date().toISOString(), ...logg }, ...data.logg].slice(0, 500);
      await lagre();
    },
  };
}
