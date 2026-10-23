// Lagring i én JSON-fil. Skrives atomisk (tmp + rename) slik at et avbrudd aldri gir halvskrevet fil.
import fs from 'node:fs';
import path from 'node:path';

export function tomDatabase() {
  return {
    versjon: 1,
    stevne: {
      navn: 'Dressurstevne', sted: '', arrangor: '', stevnenivaa: 'Klubb', datoFra: '', datoTil: '',
      pameldingsfrist: '', tillatEtteranmelding: false, etteranmeldingsgebyr: 0, overdommer: '', kontakt: '', info: '',
    },
    programmer: [],
    klasser: [],
    dommere: [],
    paameldinger: [],
    bedommelser: {},
    logg: [],
  };
}

export function lagLager(mappe) {
  const fil = path.join(mappe, 'dressur.json');
  let db;
  try {
    db = { ...tomDatabase(), ...JSON.parse(fs.readFileSync(fil, 'utf8')) };
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    db = tomDatabase();
  }
  return {
    fil,
    get db() { return db; },
    erstatt(ny) { db = { ...tomDatabase(), ...ny }; this.lagre(); },
    lagre() {
      fs.mkdirSync(mappe, { recursive: true });
      const tmp = `${fil}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
      fs.renameSync(tmp, fil);
    },
  };
}
