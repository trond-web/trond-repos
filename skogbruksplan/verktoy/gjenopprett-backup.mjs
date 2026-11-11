#!/usr/bin/env node
// Gjenoppretter en sikkerhetskopi fra backup.js. Den dekrypteres med BACKUP_NOKKEL og pakkes ut i en mappe.
//
//   BACKUP_NOKKEL=… node verktoy/gjenopprett-backup.mjs skogiq-2026-11-11T0300.tar.gz.enc --til ./gjenopprettet
//   BACKUP_NOKKEL=… node verktoy/gjenopprett-backup.mjs --s3 siste --til ./gjenopprettet   (BACKUP_S3_* må være satt)
//   node verktoy/gjenopprett-backup.mjs <fil> --liste                                      (vis innholdet)
//   node verktoy/gjenopprett-backup.mjs --s3 liste                                          (vis kopiene i S3)
//
// Slik gjenoppretter du på Railway:
//   1. Pakk ut i en tom mappe lokalt og kontroller innholdet (brukere.json, sky/, nettverk.json …).
//   2. Stopp tjenesten, eller lag en ny tjeneste med et tomt volum.
//   3. Kopier filene til volumet, slik at de havner i mappen til BRUKER_FIL (/data), og start tjenesten igjen.
// Nøkkelen (BACKUP_NOKKEL) må oppbevares utenfor Railway, for eksempel i en passordbehandler. Uten den kan kopiene ikke leses.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, utimesSync } from 'node:fs';
import path from 'node:path';
import { pakkUt, lagS3 } from '../backup.js';

const arg = process.argv.slice(2);
const flagg = (n) => { const i = arg.indexOf(n); return i >= 0 ? (arg[i + 1] && !arg[i + 1].startsWith('--') ? arg[i + 1] : true) : null; };
const ut = (t) => process.stdout.write(`${t}\n`);
const stopp = (t) => { process.stderr.write(`Feil: ${t}\n`); process.exit(1); };
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;

async function main() {
  const nokkel = process.env.BACKUP_NOKKEL || '';
  let data; let navn;
  const s3Valg = flagg('--s3');
  if (s3Valg) {
    const e = process.env; if (!e.BACKUP_S3_ENDPOINT || !e.BACKUP_S3_BUCKET || !e.BACKUP_S3_NOKKEL_ID || !e.BACKUP_S3_HEMMELIG) stopp('Sett BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET, BACKUP_S3_NOKKEL_ID og BACKUP_S3_HEMMELIG');
    const s3 = lagS3({ endpoint: e.BACKUP_S3_ENDPOINT, bucket: e.BACKUP_S3_BUCKET, region: e.BACKUP_S3_REGION || 'eu-central-1', id: e.BACKUP_S3_NOKKEL_ID, hemmelig: e.BACKUP_S3_HEMMELIG, prefiks: e.BACKUP_S3_PREFIKS || 'skogiq/' });
    const liste = await s3.liste();
    if (s3Valg === 'liste' || s3Valg === true) { for (const x of liste) ut(`${x.navn}  ${mb(x.storrelse)}`); ut(`${liste.length} kopier`); return; }
    navn = s3Valg === 'siste' ? liste.at(-1)?.navn : s3Valg; if (!navn) stopp('Fant ingen sikkerhetskopi i S3');
    ut(`Henter ${navn} fra S3 …`); data = await s3.hent(navn);
  } else {
    navn = arg.find((a) => !a.startsWith('--') && arg[arg.indexOf(a) - 1] !== '--til'); if (!navn) stopp('Oppgi filen som skal gjenopprettes (se toppen av verktoy/gjenopprett-backup.mjs)');
    data = readFileSync(navn);
  }
  const filer = pakkUt(data, nokkel);
  const sum = filer.reduce((s, f) => s + f.data.length, 0);
  ut(`${path.basename(navn)}: ${filer.length} filer, ${mb(sum)}`);
  if (flagg('--liste')) { for (const f of filer) ut(`  ${f.navn}  ${f.data.length} B`); return; }
  const til = flagg('--til'); if (!til || til === true) stopp('Oppgi --til <mappe>');
  if (existsSync(til) && readdirSync(til).length && !flagg('--overskriv')) stopp(`Mappen ${til} er ikke tom. Bruk en tom mappe, eller --overskriv`);
  const rot = path.resolve(til);
  for (const f of filer) {
    const mal = path.resolve(rot, f.navn); if (!mal.startsWith(rot + path.sep)) stopp(`Ugyldig filnavn i kopien: ${f.navn}`);
    mkdirSync(path.dirname(mal), { recursive: true }); writeFileSync(mal, f.data); if (f.mtid) utimesSync(mal, f.mtid / 1000, f.mtid / 1000);
  }
  ut(`Gjenopprettet til ${rot}`);
}
main().catch((e) => stopp(e.message));
