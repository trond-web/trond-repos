// Enkel varig lagring i én JSON-fil. På Railway ligger fila på et volum (DATA_DIR=/data), så den overlever nye publiseringer.
// Skriving skjer i kø og atomisk (skriv til midlertidig fil, så rename), så fila aldri blir halvskrevet.
// Sikkerhetskopier: forrige versjon (nordfjella.forrige.json) og én kopi per dag i kopier/ (de siste 30 dagene).
import { readFile, writeFile, rename, mkdir, copyFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';

const TOM = () => ({ versjon: 1, revisjon: 0, brukere: {}, jaktfelt: {}, samjakt: [], logg: [] });
const BEHOLD_DAGER = 30;

export async function aapneLager(mappe) {
  await mkdir(mappe, { recursive: true });
  const fil = path.join(mappe, 'nordfjella.json');
  const forrige = path.join(mappe, 'nordfjella.forrige.json');
  const kopier = path.join(mappe, 'kopier');
  await mkdir(kopier, { recursive: true });
  let data;
  try { data = { ...TOM(), ...JSON.parse(await readFile(fil, 'utf8')) }; } catch (e) {
    if (e.code !== 'ENOENT') throw new Error(`Kunne ikke lese ${fil}: ${e.message}`);
    data = TOM();
  }

  // Daglig kopi: første skriving hver dag tar vare på slik fila var, og eldre kopier enn 30 dager slettes.
  async function dagskopi() {
    const dag = new Date().toISOString().slice(0, 10);
    const mål = path.join(kopier, `nordfjella-${dag}.json`);
    const finnes = await readFile(mål).then(() => true, () => false);
    if (finnes) return;
    try { await copyFile(fil, mål); } catch (e) { if (e.code !== 'ENOENT') throw e; return; }
    const filer = (await readdir(kopier)).filter((f) => /^nordfjella-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
    for (const gammel of filer.slice(0, Math.max(0, filer.length - BEHOLD_DAGER))) await unlink(path.join(kopier, gammel)).catch(() => {});
  }

  let ko = Promise.resolve();
  const lagre = () => {
    const kopi = JSON.stringify(data);
    ko = ko.then(async () => {
      await dagskopi().catch((e) => console.error('Dagskopi feilet:', e.message));
      await copyFile(fil, forrige).catch(() => {});
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
    // Oversikt over sikkerhetskopiene som finnes på volumet.
    async kopiliste() {
      return (await readdir(kopier)).filter((f) => f.endsWith('.json')).sort().reverse();
    },
  };
}
