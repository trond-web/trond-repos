// Dressurstevne – påmelding, startlister, dommermodul og resultatservice. Ingen avhengigheter – kun Node sitt standardbibliotek.
// Kjør: SEKRETARIAT_PASSORD=hemmelig node server.js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  POSISJONER, NIVAAER, TEKNISKE_FEIL, ELIMINERINGSGRUNNER, punkter, maksPoeng, gyldigKarakter, manglerBegrunnelse,
  ekvipasjeResultat, rangering, dommerResultat, formatProsent, STATUSTEKST,
} from './public/js/beregning.js';
import { trekkRekkefolge, beregnStarttider, konflikter, rytterNokkel } from './lib/startliste.js';
import { rensRytter, rensHest, sjekkPamelding, rytterKategori } from './lib/validering.js';
import {
  hashPassord, sjekkPassord, likeStrenger, lagPassord, lagKode, nyOkt, hentOkt, slettOkt, slettOkterFor, oktCookie,
  sperret, registrerFeil, nullstillFeil,
} from './lib/auth.js';
import { lagLager } from './lib/lagring.js';
import { lagDemo } from './lib/demo.js';

const ROT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROT, 'public');
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(ROT, 'data');
const SEK_BRUKER = process.env.SEKRETARIAT_BRUKERNAVN || 'sekretariat';
let SEK_PASSORD = process.env.SEKRETARIAT_PASSORD || '';
if (!SEK_PASSORD) {
  SEK_PASSORD = lagPassord(14);
  console.log(`SEKRETARIAT_PASSORD er ikke satt. Midlertidig passord for «${SEK_BRUKER}» til neste omstart: ${SEK_PASSORD}`);
}
const SIKKER_COOKIE = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;

const lager = lagLager(DATA_DIR);
const db = () => lager.db;

// ---------- hjelpere ----------

class Feil extends Error {
  constructor(status, melding) { super(melding); this.status = status; }
}
const nyId = (prefiks) => `${prefiks}-${crypto.randomBytes(5).toString('hex')}`;
const tekst = (v, maks = 200) => String(v ?? '').trim().slice(0, maks);
const ip = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

function sendJson(res, status, data, ekstra = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...ekstra });
  res.end(body);
}

async function lesJson(req) {
  if (!/^application\/json/i.test(req.headers['content-type'] || '')) throw new Feil(415, 'Forventet JSON.');
  const deler = [];
  let lengde = 0;
  for await (const d of req) {
    lengde += d.length;
    if (lengde > 5_000_000) throw new Feil(413, 'For stor forespørsel.');
    deler.push(d);
  }
  if (!lengde) return {};
  try { return JSON.parse(Buffer.concat(deler).toString('utf8')); } catch { throw new Feil(400, 'Ugyldig JSON.'); }
}

function logg(hvem, hva) {
  db().logg.push({ tid: new Date().toISOString(), hvem, hva });
  if (db().logg.length > 5000) db().logg.splice(0, db().logg.length - 5000);
}

const finnKlasse = (id) => db().klasser.find((k) => k.id === id) || (() => { throw new Feil(404, 'Fant ikke klassen.'); })();
const finnProgram = (id) => db().programmer.find((p) => p.id === id) || (() => { throw new Feil(404, 'Fant ikke programmet.'); })();
const finnPamelding = (id) => db().paameldinger.find((p) => p.id === id) || (() => { throw new Feil(404, 'Fant ikke påmeldingen.'); })();
const dommerNavn = (id) => db().dommere.find((d) => d.id === id)?.navn || '';
const bedommelse = (pid) => (db().bedommelser[pid] ||= { protokoller: {}, fradrag: {} });

function programOppsummering(p) {
  if (!p) return null;
  return { id: p.id, navn: p.navn, nivaa: p.nivaa, type: p.type, bane: p.bane, bisling: p.bisling, tid: p.tid, kurTid: p.kurTid || '', maks: maksPoeng(p) };
}

function aktive(klasseId) {
  return db().paameldinger.filter((p) => p.klasseId === klasseId && p.status !== 'trukket');
}

function offentligKlasse(k) {
  const pam = aktive(k.id);
  return {
    id: k.id, nr: k.nr, navn: k.navn, dato: k.dato, starttid: k.starttid, apen: !!k.apen, status: k.status || 'planlagt',
    offisiell: !!k.offisiell, clearRound: !!k.clearRound, ponni: !!k.ponni, startavgift: Number(k.startavgift) || 0,
    maksStartende: Number(k.maksStartende) || 0, minAlder: k.minAlder || null, maksAlder: k.maksAlder || null, merknad: k.merknad || '',
    antallPameldt: pam.filter((p) => p.status === 'pameldt').length, antallVenteliste: pam.filter((p) => p.status === 'venteliste').length,
    dommere: POSISJONER.filter((pos) => k.dommere?.[pos]).map((pos) => ({ pos, navn: dommerNavn(k.dommere[pos]) })),
    program: programOppsummering(db().programmer.find((p) => p.id === k.programId)),
    startlistePublisert: !!k.startlistePublisert,
  };
}

function sortertStartliste(klasseId) {
  return aktive(klasseId).filter((p) => p.status === 'pameldt')
    .sort((a, b) => (a.startrekke ?? 1e9) - (b.startrekke ?? 1e9) || a.opprettet.localeCompare(b.opprettet));
}

function startlisteRad(p) {
  return {
    id: p.id, startnr: p.startnr, startrekke: p.startrekke, starttid: p.starttid,
    rytter: { navn: p.rytter.navn, klubb: p.rytter.klubb }, hest: { navn: p.hest.navn, type: p.hest.type },
  };
}

function resultatliste(klasseId, { admin = false } = {}) {
  const k = finnKlasse(klasseId);
  const program = db().programmer.find((p) => p.id === k.programId);
  if (!program) throw new Feil(409, 'Klassen mangler program.');
  const rader = db().paameldinger.filter((p) => p.klasseId === k.id && p.status !== 'venteliste').map((p) => {
    const b = db().bedommelser[p.id] || { protokoller: {}, fradrag: {} };
    const resultat = ekvipasjeResultat(program, k.dommere, b.protokoller, b.fradrag, p.status);
    const sist = Object.values(b.protokoller).map((x) => x.signert || '').sort().pop() || null;
    return { id: p.id, p, resultat, sist };
  });
  const { rader: rangert, startende, antallPremier } = rangering(program, k, rader);
  const posisjoner = POSISJONER.filter((pos) => k.dommere?.[pos]);
  return {
    klasse: offentligKlasse(k),
    posisjoner,
    startende, antallPremier,
    rader: rangert.map(({ p, resultat, plassering, premie, godkjent, clearRound, sist }) => ({
      id: p.id, startnr: p.startnr, starttid: p.starttid, rytter: { navn: p.rytter.navn, klubb: p.rytter.klubb }, hest: { navn: p.hest.navn },
      plassering, premie, godkjent, clearRound, status: resultat.status, statusTekst: STATUSTEKST[resultat.status] || resultat.status,
      prosent: resultat.prosent, elimGrunn: resultat.elimGrunn || '', sist,
      perDommer: Object.fromEntries(posisjoner.map((pos) => [pos, {
        prosent: resultat.perDommer[pos]?.prosent ?? null, signert: !!resultat.perDommer[pos]?.signert,
        ...(admin ? { poeng: resultat.perDommer[pos]?.poeng } : {}),
      }])),
      ...(admin ? { avvik: resultat.avvik, dommermote: resultat.dommermote } : {}),
    })),
  };
}

function protokollVisning(pid) {
  const p = finnPamelding(pid);
  const k = finnKlasse(p.klasseId);
  const program = finnProgram(k.programId);
  const b = db().bedommelser[p.id] || { protokoller: {}, fradrag: {} };
  const res = ekvipasjeResultat(program, k.dommere, b.protokoller, b.fradrag, p.status);
  return {
    stevne: { navn: db().stevne.navn, sted: db().stevne.sted },
    klasse: offentligKlasse(k),
    program: { ...programOppsummering(program), punkter: punkter(program) },
    ekvipasje: { startnr: p.startnr, rytter: { navn: p.rytter.navn, klubb: p.rytter.klubb }, hest: { navn: p.hest.navn } },
    fradrag: b.fradrag,
    resultat: { prosent: res.prosent, status: res.status, statusTekst: STATUSTEKST[res.status] },
    protokoller: POSISJONER.filter((pos) => k.dommere?.[pos]).map((pos) => {
      const prot = b.protokoller[pos] || {};
      return {
        pos, dommer: dommerNavn(k.dommere[pos]), karakterer: prot.karakterer || {}, kommentarer: prot.kommentarer || {},
        sluttkommentar: prot.sluttkommentar || '', signert: prot.signert || null, rettelser: prot.rettelser || [],
        ...dommerResultat(program, prot, b.fradrag),
      };
    }),
  };
}

function tildelStartnummer() {
  const brukt = new Map();
  let neste = 1;
  for (const p of db().paameldinger) {
    if (p.startnr) { brukt.set(`${rytterNokkel(p)}|${(p.hest.pass || p.hest.navn).toLowerCase()}`, p.startnr); neste = Math.max(neste, p.startnr + 1); }
  }
  // Samme ekvipasje (rytter + hest) beholder samme startnummer gjennom hele stevnet
  for (const p of db().paameldinger) {
    if (p.startnr || p.status === 'trukket') continue;
    const nokkel = `${rytterNokkel(p)}|${(p.hest.pass || p.hest.navn).toLowerCase()}`;
    if (!brukt.has(nokkel)) brukt.set(nokkel, neste++);
    p.startnr = brukt.get(nokkel);
  }
}

function oppdaterStarttider(k) {
  const liste = sortertStartliste(k.id);
  for (const t of beregnStarttider(k, liste)) Object.assign(finnPamelding(t.id), { startrekke: t.startrekke, starttid: t.starttid });
}

// Fyller ledige plasser fra ventelisten i påmeldingsrekkefølge
function flyttFraVenteliste(k) {
  const maks = Number(k.maksStartende) || 0;
  if (!maks) return;
  const pameldt = () => aktive(k.id).filter((p) => p.status === 'pameldt').length;
  const vente = aktive(k.id).filter((p) => p.status === 'venteliste').sort((a, b) => a.opprettet.localeCompare(b.opprettet));
  while (pameldt() < maks && vente.length) vente.shift().status = 'pameldt';
}

function harBedommelse(klasseId) {
  return db().paameldinger.some((p) => p.klasseId === klasseId && Object.keys(db().bedommelser[p.id]?.protokoller || {}).length);
}

function csv(rader) {
  const celle = (v) => {
    const s = String(v ?? '');
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rader.map((r) => r.map(celle).join(';')).join('\r\n');
}

// ---------- validering av admin-data ----------

function rensProgram(b, gammel = {}) {
  const type = b.type === 'kur' ? 'kur' : 'standard';
  const ovelser = (Array.isArray(b.ovelser) ? b.ovelser : []).slice(0, 60).map((o) => ({
    punkt: tekst(o.punkt, 40), tekst: tekst(o.tekst, 300), koeff: Math.min(5, Math.max(1, Number(o.koeff) || 1)),
  })).filter((o) => o.tekst);
  const helhet = (Array.isArray(b.helhet) ? b.helhet : []).slice(0, 12).map((h) => ({
    tekst: tekst(h.tekst, 300), koeff: Math.min(10, Math.max(0.5, Number(h.koeff) || 1)),
    ...(Number(h.steg) ? { steg: [0.1, 0.2, 0.5, 1].includes(Number(h.steg)) ? Number(h.steg) : 0.5 } : {}),
    ...(['harmoni', 'koreografi'].includes(h.rolle) ? { rolle: h.rolle } : {}),
  })).filter((h) => h.tekst);
  const p = {
    ...gammel, navn: tekst(b.navn, 80), nivaa: NIVAAER.includes(b.nivaa) ? b.nivaa : '', type, bane: tekst(b.bane, 20),
    bisling: tekst(b.bisling, 40), tid: Number(b.tid) || null, kurTid: tekst(b.kurTid, 20),
    karakterSteg: [0.1, 0.2, 0.5, 1].includes(Number(b.karakterSteg)) ? Number(b.karakterSteg) : 0.5, ovelser, helhet,
  };
  if (!p.navn) throw new Feil(400, 'Programmet må ha navn.');
  if (!ovelser.length) throw new Feil(400, 'Programmet må ha minst én øvelse.');
  if (type === 'kur' && !helhet.length) throw new Feil(400, 'Kür må ha karakterer for kunstnerisk inntrykk.');
  return p;
}

function rensKlasse(b, gammel = {}) {
  const dommere = {};
  for (const pos of POSISJONER) {
    const id = b.dommere?.[pos];
    if (id) {
      if (!db().dommere.some((d) => d.id === id)) throw new Feil(400, `Ukjent dommer på ${pos}.`);
      dommere[pos] = id;
    }
  }
  if (Object.keys(dommere).length && !dommere.C) throw new Feil(400, 'Hoveddommeren skal alltid sitte på C (KR IV § 461.3).');
  const k = {
    ...gammel, nr: Number(b.nr) || null, navn: tekst(b.navn, 80), programId: tekst(b.programId, 40), dato: tekst(b.dato, 10),
    starttid: /^\d{1,2}:\d{2}$/.test(b.starttid || '') ? b.starttid : '09:00', intervall: Math.max(1, Number(b.intervall) || 7),
    pauseEtter: Math.max(0, Number(b.pauseEtter) || 0), pauseMin: Math.max(0, Number(b.pauseMin) || 0),
    startavgift: Math.max(0, Number(b.startavgift) || 0), maksStartende: Math.max(0, Number(b.maksStartende) || 0),
    premieAndel: Math.min(1, Math.max(0, b.premieAndel == null || b.premieAndel === '' ? 0.25 : Number(b.premieAndel))),
    minAlder: Number(b.minAlder) || null, maksAlder: Number(b.maksAlder) || null, merknad: tekst(b.merknad, 300),
    apen: !!b.apen, clearRound: !!b.clearRound, ponni: !!b.ponni, startlistePublisert: !!b.startlistePublisert,
    status: ['planlagt', 'pagar', 'avsluttet'].includes(b.status) ? b.status : (gammel.status || 'planlagt'),
    offisiell: !!gammel.offisiell, dommere,
  };
  if (!k.navn) throw new Feil(400, 'Klassen må ha navn.');
  if (!db().programmer.some((p) => p.id === k.programId)) throw new Feil(400, 'Velg et program for klassen.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k.dato)) throw new Feil(400, 'Klassen må ha dato.');
  return k;
}

// ---------- ruter ----------

const ruter = [];
const rute = (metode, monster, tilgang, fn) => ruter.push({ metode, monster, tilgang, fn });

function krevTilgang(tilgang, okt) {
  if (tilgang === 'alle') return;
  if (!okt) throw new Feil(401, 'Du må logge inn.');
  if (tilgang === 'sekretariat' && okt.rolle !== 'sekretariat') throw new Feil(403, 'Krever innlogging som sekretariat.');
  if (tilgang === 'dommer' && okt.rolle !== 'dommer') throw new Feil(403, 'Krever innlogging som dommer.');
}

rute('GET', '/healthz', 'alle', () => ({ ok: true }));

rute('GET', '/api/stevne', 'alle', () => ({
  stevne: db().stevne,
  klasser: [...db().klasser].sort((a, b) => (a.dato || '').localeCompare(b.dato || '') || (a.nr || 0) - (b.nr || 0)).map(offentligKlasse),
  tekniskeFeil: TEKNISKE_FEIL, elimineringsgrunner: ELIMINERINGSGRUNNER,
}));

rute('GET', /^\/api\/startliste\/([\w-]+)$/, 'alle', ({ m, okt }) => {
  const k = finnKlasse(m[1]);
  const vis = k.startlistePublisert || okt;
  return { klasse: offentligKlasse(k), publisert: !!k.startlistePublisert, rader: vis ? sortertStartliste(k.id).map(startlisteRad) : [] };
});

rute('GET', /^\/api\/resultater\/([\w-]+)$/, 'alle', ({ m }) => resultatliste(m[1]));

rute('GET', /^\/api\/protokoll\/([\w-]+)$/, 'alle', ({ m, url }) => {
  const p = finnPamelding(m[1]);
  if (!likeStrenger(url.searchParams.get('kode') || '', p.kode)) throw new Feil(403, 'Feil påmeldingskode.');
  if (!finnKlasse(p.klasseId).offisiell) throw new Feil(409, 'Protokollene blir tilgjengelige når resultatlisten for klassen er offisiell.');
  return protokollVisning(p.id);
});

const pameldingsForsok = new Map();
rute('POST', '/api/paamelding', 'alle', async ({ req }) => {
  const nokkel = ip(req);
  const f = pameldingsForsok.get(nokkel);
  if (f && f.til > Date.now() && f.antall >= 40) throw new Feil(429, 'For mange påmeldinger fra samme adresse. Prøv igjen senere.');
  if (!f || f.til < Date.now()) pameldingsForsok.set(nokkel, { antall: 1, til: Date.now() + 3600_000 }); else f.antall++;

  const b = await lesJson(req);
  const rytter = rensRytter(b.rytter);
  const hest = rensHest(b.hest);
  const klasseIder = [...new Set(Array.isArray(b.klasser) ? b.klasser.map(String) : [])];
  const sjekk = sjekkPamelding({ rytter, hest, klasseIder }, db());
  if (sjekk.feil.length) throw new Feil(400, sjekk.feil.join('\n'));
  const kode = tekst(b.kode, 12).toUpperCase();
  const eksisterende = kode && db().paameldinger.find((p) => p.kode === kode && p.rytter.epost === rytter.epost);
  const nyKode = eksisterende ? kode : lagKode();
  const opprettet = new Date().toISOString();
  const nye = klasseIder.map((klasseId) => {
    const k = finnKlasse(klasseId);
    const fullt = Number(k.maksStartende) && aktive(k.id).filter((p) => p.status === 'pameldt').length >= Number(k.maksStartende);
    const p = {
      id: nyId('p'), kode: nyKode, klasseId, status: fullt ? 'venteliste' : 'pameldt', etteranmeldt: sjekk.etteranmeldt,
      betalt: false, opprettet, rytter, hest, startnr: null, startrekke: null, starttid: null, merknad: tekst(b.merknad, 300),
    };
    db().paameldinger.push(p);
    return p;
  });
  lager.lagre();
  return {
    kode: nyKode, advarsler: sjekk.advarsler, kategori: rytterKategori(rytter.fodselsaar, new Date().getFullYear()),
    paameldinger: nye.map((p) => ({ id: p.id, klasse: finnKlasse(p.klasseId).navn, status: p.status })),
    sum: nye.reduce((s, p) => s + (Number(finnKlasse(p.klasseId).startavgift) || 0), 0) + (sjekk.etteranmeldt ? Number(db().stevne.etteranmeldingsgebyr) || 0 : 0),
  };
});

function minePameldinger(kode) {
  const k = tekst(kode, 12).toUpperCase();
  if (k.length < 8) throw new Feil(400, 'Ugyldig kode.');
  const liste = db().paameldinger.filter((p) => likeStrenger(p.kode, k));
  if (!liste.length) throw new Feil(404, 'Fant ingen påmeldinger med denne koden.');
  return liste;
}

rute('GET', '/api/mine', 'alle', ({ url }) => {
  const liste = minePameldinger(url.searchParams.get('kode'));
  return {
    rytter: liste[0].rytter.navn,
    paameldinger: liste.map((p) => {
      const k = finnKlasse(p.klasseId);
      return {
        id: p.id, klasse: offentligKlasse(k), status: p.status, hest: p.hest.navn, etteranmeldt: p.etteranmeldt,
        startnr: k.startlistePublisert ? p.startnr : null, starttid: k.startlistePublisert ? p.starttid : null,
        protokoll: !!k.offisiell && p.status === 'pameldt', kanTrekkes: p.status !== 'trukket' && (k.status || 'planlagt') === 'planlagt',
      };
    }),
  };
});

rute('POST', '/api/mine/trekk', 'alle', async ({ req }) => {
  const b = await lesJson(req);
  const p = minePameldinger(b.kode).find((x) => x.id === b.id);
  if (!p) throw new Feil(404, 'Fant ikke påmeldingen.');
  const k = finnKlasse(p.klasseId);
  if ((k.status || 'planlagt') !== 'planlagt') throw new Feil(409, 'Klassen er i gang – kontakt sekretariatet.');
  p.status = 'trukket';
  flyttFraVenteliste(k);
  logg(p.rytter.navn, `Trakk ${p.hest.navn} fra ${k.navn}`);
  lager.lagre();
  return { ok: true };
});

// ---------- innlogging ----------

rute('POST', '/api/logginn', 'alle', async ({ req, res }) => {
  const b = await lesJson(req);
  const bruker = tekst(b.brukernavn, 60).toLowerCase();
  const nokkel = `${ip(req)}|${bruker}`;
  if (sperret(nokkel)) throw new Feil(429, 'For mange mislykkede forsøk. Vent 15 minutter.');
  let okt = null;
  if (bruker === SEK_BRUKER.toLowerCase() && likeStrenger(b.passord, SEK_PASSORD)) okt = { rolle: 'sekretariat', navn: 'Sekretariat' };
  const d = db().dommere.find((x) => x.brukernavn.toLowerCase() === bruker);
  if (!okt && d && sjekkPassord(b.passord, d.passordHash)) okt = { rolle: 'dommer', dommerId: d.id, navn: d.navn };
  if (!okt) { registrerFeil(nokkel); throw new Feil(401, 'Feil brukernavn eller passord.'); }
  nullstillFeil(nokkel);
  res.setHeader('Set-Cookie', oktCookie(nyOkt(okt), SIKKER_COOKIE));
  return { rolle: okt.rolle, navn: okt.navn };
});

rute('POST', '/api/loggut', 'alle', ({ res, okt }) => {
  if (okt) slettOkt(okt.token);
  res.setHeader('Set-Cookie', oktCookie('', SIKKER_COOKIE));
  return { ok: true };
});

rute('GET', '/api/meg', 'alle', ({ okt }) => (okt ? { rolle: okt.rolle, navn: okt.navn } : { rolle: null }));

// ---------- dommermodul ----------

function dommerPosisjon(k, okt) {
  const pos = POSISJONER.find((p) => k.dommere?.[p] === okt.dommerId);
  if (!pos) throw new Feil(403, 'Du er ikke satt opp som dommer i denne klassen.');
  return pos;
}

rute('GET', '/api/dommer/klasser', 'dommer', ({ okt }) => ({
  navn: okt.navn,
  klasser: db().klasser.filter((k) => POSISJONER.some((p) => k.dommere?.[p] === okt.dommerId))
    .sort((a, b) => (a.dato || '').localeCompare(b.dato || '') || (a.starttid || '').localeCompare(b.starttid || ''))
    .map((k) => ({ ...offentligKlasse(k), minPosisjon: dommerPosisjon(k, okt) })),
}));

rute('GET', /^\/api\/dommer\/klasser\/([\w-]+)$/, 'dommer', ({ m, okt }) => {
  const k = finnKlasse(m[1]);
  const pos = dommerPosisjon(k, okt);
  const program = finnProgram(k.programId);
  return {
    klasse: offentligKlasse(k), minPosisjon: pos, hoveddommer: pos === 'C',
    program: { ...program, ...programOppsummering(program), punkter: punkter(program) },
    // Dommeren ser bare sin egen protokollstatus – ikke de andre dommernes karakterer (§ 450.1.d–e)
    startliste: sortertStartliste(k.id).map((p) => {
      const b = db().bedommelser[p.id] || { protokoller: {}, fradrag: {} };
      const prot = b.protokoller[pos] || {};
      return {
        ...startlisteRad(p), signert: prot.signert || null, paabegynt: Object.keys(prot.karakterer || {}).length > 0, fradrag: b.fradrag,
        minProsent: prot.signert ? dommerResultat(program, prot, b.fradrag).prosent : null,
      };
    }),
  };
});

function dommerKontekst(pid, okt) {
  const p = finnPamelding(pid);
  const k = finnKlasse(p.klasseId);
  const pos = dommerPosisjon(k, okt);
  const program = finnProgram(k.programId);
  if (p.status !== 'pameldt') throw new Feil(409, 'Ekvipasjen er ikke på startlisten.');
  return { p, k, pos, program, b: bedommelse(p.id) };
}

rute('GET', /^\/api\/dommer\/protokoll\/([\w-]+)$/, 'dommer', ({ m, okt }) => {
  const { p, k, pos, program, b } = dommerKontekst(m[1], okt);
  const prot = b.protokoller[pos] || {};
  return {
    ekvipasje: startlisteRad(p), klasse: offentligKlasse(k), minPosisjon: pos, hoveddommer: pos === 'C',
    program: { ...program, ...programOppsummering(program), punkter: punkter(program) },
    protokoll: { karakterer: {}, kommentarer: {}, sluttkommentar: '', ...prot }, fradrag: b.fradrag,
    resultat: dommerResultat(program, prot, b.fradrag),
  };
});

rute('PUT', /^\/api\/dommer\/protokoll\/([\w-]+)$/, 'dommer', async ({ m, okt, req }) => {
  const { k, pos, program, b } = dommerKontekst(m[1], okt);
  if (k.offisiell) throw new Feil(409, 'Resultatlisten er offisiell – protokollen er låst.');
  const prot = (b.protokoller[pos] ||= { karakterer: {}, kommentarer: {}, sluttkommentar: '' });
  if (prot.signert) throw new Feil(409, 'Protokollen er signert. Bruk retting.');
  const body = await lesJson(req);
  const alle = punkter(program);
  const karakterer = {};
  const kommentarer = {};
  for (const pkt of alle) {
    const v = body.karakterer?.[pkt.id];
    if (v !== '' && v != null) {
      if (!gyldigKarakter(v, pkt.steg)) throw new Feil(400, `Ugyldig karakter ${v} for ${pkt.nr}. Tillatt 0–10 i steg på ${String(pkt.steg).replace('.', ',')}.`);
      karakterer[pkt.id] = Number(v);
    }
    const kom = tekst(body.kommentarer?.[pkt.id], 500);
    if (kom) kommentarer[pkt.id] = kom;
  }
  Object.assign(prot, {
    karakterer, kommentarer, sluttkommentar: tekst(body.sluttkommentar, 2000),
    ikkeVist: (Array.isArray(body.ikkeVist) ? body.ikkeVist : []).filter((id) => alle.some((x) => x.id === id)),
    oppdatert: new Date().toISOString(), dommerId: okt.dommerId,
  });
  if (k.status === 'planlagt') k.status = 'pagar';
  lager.lagre();
  return { ok: true, resultat: dommerResultat(program, prot, b.fradrag) };
});

rute('POST', /^\/api\/dommer\/protokoll\/([\w-]+)\/signer$/, 'dommer', ({ m, okt }) => {
  const { p, k, pos, program, b } = dommerKontekst(m[1], okt);
  if (k.offisiell) throw new Feil(409, 'Resultatlisten er offisiell – protokollen er låst.');
  const prot = b.protokoller[pos];
  const elim = b.fradrag.eliminert || (program.type !== 'kur' && b.fradrag.feilridning >= 3);
  if (!prot) throw new Feil(400, 'Protokollen er tom.');
  if (prot.signert) return { ok: true };
  const r = dommerResultat(program, prot, b.fradrag);
  if (!r.komplett && !elim) throw new Feil(400, `Mangler karakter på ${r.mangler.length} punkt.`);
  const uten = manglerBegrunnelse(program, prot);
  if (uten.length) {
    const nr = punkter(program).filter((x) => uten.includes(x.id)).map((x) => x.nr).join(', ');
    throw new Feil(400, `Karakterer fra 0 til 4 skal alltid begrunnes (KR IV § 461.2.a). Mangler kommentar på: ${nr}.`);
  }
  prot.signert = new Date().toISOString();
  prot.signertAv = okt.navn;
  logg(okt.navn, `Signerte protokoll (${pos}) for nr ${p.startnr ?? '–'} ${p.rytter.navn} / ${p.hest.navn} i ${k.navn}: ${formatProsent(r.prosent)} %`);
  lager.lagre();
  return { ok: true, resultat: r };
});

// Retting etter signering: opprinnelig karakter beholdes i loggen sammen med grunnen (§ 450.1.c)
rute('POST', /^\/api\/dommer\/protokoll\/([\w-]+)\/rett$/, 'dommer', async ({ m, okt, req }) => {
  const { p, k, pos, program, b } = dommerKontekst(m[1], okt);
  if (k.offisiell) throw new Feil(409, 'Resultatlisten er offisiell – kontakt sekretariatet.');
  const prot = b.protokoller[pos];
  if (!prot?.signert) throw new Feil(409, 'Protokollen er ikke signert – endre direkte.');
  const body = await lesJson(req);
  const pkt = punkter(program).find((x) => x.id === body.punkt);
  if (!pkt) throw new Feil(400, 'Ukjent punkt.');
  if (!gyldigKarakter(body.verdi, pkt.steg)) throw new Feil(400, 'Ugyldig karakter.');
  const grunn = tekst(body.grunn, 200);
  if (!grunn) throw new Feil(400, 'Oppgi grunnen til rettingen (åpenbar skrivefeil eller manglende karakter).');
  const fra = prot.karakterer[pkt.id] ?? null;
  prot.karakterer[pkt.id] = Number(body.verdi);
  const kom = tekst(body.kommentar, 500);
  if (kom) prot.kommentarer[pkt.id] = kom;
  if (manglerBegrunnelse(program, prot).includes(pkt.id)) { prot.karakterer[pkt.id] = fra; throw new Feil(400, 'Karakterer fra 0 til 4 skal begrunnes.'); }
  (prot.rettelser ||= []).push({ punkt: pkt.id, nr: pkt.nr, fra, til: Number(body.verdi), grunn, tid: new Date().toISOString(), av: okt.navn });
  logg(okt.navn, `Rettet ${pkt.nr} fra ${fra} til ${body.verdi} (${pos}) for ${p.rytter.navn} / ${p.hest.navn} i ${k.navn}: ${grunn}`);
  lager.lagre();
  return { ok: true, resultat: dommerResultat(program, prot, b.fradrag) };
});

// Feilridning, tekniske feil og eliminering bestemmes av hoveddommeren og trekkes hos alle dommerne (§ 450.2)
function settFradrag(pid, body, hvem) {
  const p = finnPamelding(pid);
  const k = finnKlasse(p.klasseId);
  const program = finnProgram(k.programId);
  if (k.offisiell) throw new Feil(409, 'Resultatlisten er offisiell.');
  const koder = TEKNISKE_FEIL.map((t) => t.kode);
  const fradrag = {
    feilridning: program.type === 'kur' ? 0 : Math.min(3, Math.max(0, Number(body.feilridning) || 0)),
    tekniske: (Array.isArray(body.tekniske) ? body.tekniske : []).filter((x) => koder.includes(x)).slice(0, 10),
    eliminert: !!body.eliminert, elimGrunn: body.eliminert ? tekst(body.elimGrunn, 200) : '',
    kurTidAvvik: program.type === 'kur' && !!body.kurTidAvvik, ikkeStartet: !!body.ikkeStartet,
  };
  if (fradrag.eliminert && !fradrag.elimGrunn) throw new Feil(400, 'Årsaken til eliminering skal angis (§ 450.2.c).');
  const b = bedommelse(p.id);
  const for_ = JSON.stringify(b.fradrag);
  b.fradrag = fradrag;
  if (for_ !== JSON.stringify(fradrag)) logg(hvem, `Fradrag for ${p.rytter.navn} / ${p.hest.navn} i ${k.navn}: ${JSON.stringify(fradrag)}`);
  lager.lagre();
  return { ok: true, fradrag };
}

rute('PUT', /^\/api\/dommer\/fradrag\/([\w-]+)$/, 'dommer', async ({ m, okt, req }) => {
  const p = finnPamelding(m[1]);
  if (dommerPosisjon(finnKlasse(p.klasseId), okt) !== 'C') throw new Feil(403, 'Bare hoveddommeren (C) bestemmer feilridning, feil og eliminering.');
  return settFradrag(p.id, await lesJson(req), okt.navn);
});

rute('PUT', /^\/api\/dommer\/klasser\/([\w-]+)\/status$/, 'dommer', async ({ m, okt, req }) => {
  const k = finnKlasse(m[1]);
  if (dommerPosisjon(k, okt) !== 'C') throw new Feil(403, 'Bare hoveddommeren kan endre status for klassen.');
  const b = await lesJson(req);
  if (['planlagt', 'pagar', 'avsluttet'].includes(b.status)) k.status = b.status;
  lager.lagre();
  return { ok: true, status: k.status };
});

// ---------- sekretariat ----------

rute('GET', '/api/admin/oversikt', 'sekretariat', () => ({
  stevne: db().stevne,
  programmer: db().programmer.map((p) => ({ ...p, maks: maksPoeng(p), laast: db().klasser.some((k) => k.programId === p.id && harBedommelse(k.id)) })),
  klasser: db().klasser.map((k) => ({ ...k, ...offentligKlasse(k), dommere: k.dommere, harBedommelse: harBedommelse(k.id) })),
  dommere: db().dommere.map(({ passordHash, ...d }) => d),
  paameldinger: db().paameldinger,
  konflikter: konflikter(db().paameldinger, db().klasser),
  sekretariatBruker: SEK_BRUKER,
}));

rute('PUT', '/api/admin/stevne', 'sekretariat', async ({ req }) => {
  const b = await lesJson(req);
  db().stevne = {
    navn: tekst(b.navn, 120), sted: tekst(b.sted, 120), arrangor: tekst(b.arrangor, 120), stevnenivaa: tekst(b.stevnenivaa, 30),
    datoFra: tekst(b.datoFra, 10), datoTil: tekst(b.datoTil, 10), pameldingsfrist: tekst(b.pameldingsfrist, 16),
    tillatEtteranmelding: !!b.tillatEtteranmelding, etteranmeldingsgebyr: Math.max(0, Number(b.etteranmeldingsgebyr) || 0),
    overdommer: tekst(b.overdommer, 80), kontakt: tekst(b.kontakt, 200), info: tekst(b.info, 3000),
  };
  lager.lagre();
  return db().stevne;
});

rute('POST', '/api/admin/programmer', 'sekretariat', async ({ req }) => {
  const p = { id: nyId('prog'), ...rensProgram(await lesJson(req)) };
  db().programmer.push(p);
  lager.lagre();
  return p;
});
rute('PUT', /^\/api\/admin\/programmer\/([\w-]+)$/, 'sekretariat', async ({ m, req }) => {
  const gammel = finnProgram(m[1]);
  const ny = rensProgram(await lesJson(req), gammel);
  const laast = db().klasser.some((k) => k.programId === gammel.id && harBedommelse(k.id));
  if (laast && (ny.ovelser.length !== gammel.ovelser.length || ny.helhet.length !== gammel.helhet.length
    || ny.type !== gammel.type || ny.ovelser.some((o, i) => o.koeff !== gammel.ovelser[i].koeff) || ny.helhet.some((h, i) => h.koeff !== gammel.helhet[i].koeff))) {
    throw new Feil(409, 'Programmet er i bruk i en klasse med karakterer. Bare tekster kan endres.');
  }
  Object.assign(gammel, ny);
  lager.lagre();
  return gammel;
});
rute('DELETE', /^\/api\/admin\/programmer\/([\w-]+)$/, 'sekretariat', ({ m }) => {
  if (db().klasser.some((k) => k.programId === m[1])) throw new Feil(409, 'Programmet brukes i en klasse.');
  db().programmer = db().programmer.filter((p) => p.id !== m[1]);
  lager.lagre();
  return { ok: true };
});

rute('POST', '/api/admin/klasser', 'sekretariat', async ({ req }) => {
  const k = { id: nyId('k'), ...rensKlasse(await lesJson(req)), status: 'planlagt', offisiell: false };
  db().klasser.push(k);
  lager.lagre();
  return k;
});
rute('PUT', /^\/api\/admin\/klasser\/([\w-]+)$/, 'sekretariat', async ({ m, req }) => {
  const k = finnKlasse(m[1]);
  const ny = rensKlasse(await lesJson(req), k);
  if (ny.programId !== k.programId && harBedommelse(k.id)) throw new Feil(409, 'Kan ikke bytte program når det er gitt karakterer.');
  Object.assign(k, ny);
  flyttFraVenteliste(k);
  lager.lagre();
  return k;
});
rute('DELETE', /^\/api\/admin\/klasser\/([\w-]+)$/, 'sekretariat', ({ m }) => {
  if (harBedommelse(m[1])) throw new Feil(409, 'Klassen har karakterer og kan ikke slettes.');
  if (db().paameldinger.some((p) => p.klasseId === m[1] && p.status !== 'trukket')) throw new Feil(409, 'Klassen har påmeldte. Flytt eller trekk dem først.');
  db().klasser = db().klasser.filter((k) => k.id !== m[1]);
  lager.lagre();
  return { ok: true };
});

rute('POST', /^\/api\/admin\/klasser\/([\w-]+)\/trekning$/, 'sekretariat', ({ m }) => {
  const k = finnKlasse(m[1]);
  if (harBedommelse(k.id)) throw new Feil(409, 'Klassen er i gang – startrekkefølgen kan ikke trekkes på nytt.');
  const rekke = trekkRekkefolge(sortertStartliste(k.id));
  rekke.forEach((p, i) => { p.startrekke = i + 1; });
  tildelStartnummer();
  oppdaterStarttider(k);
  logg('Sekretariat', `Trakk startrekkefølge i ${k.navn}`);
  lager.lagre();
  return { rader: sortertStartliste(k.id).map(startlisteRad) };
});

rute('PUT', /^\/api\/admin\/klasser\/([\w-]+)\/rekkefolge$/, 'sekretariat', async ({ m, req }) => {
  const k = finnKlasse(m[1]);
  const { ider } = await lesJson(req);
  if (!Array.isArray(ider)) throw new Feil(400, 'Mangler rekkefølge.');
  ider.forEach((id, i) => { const p = finnPamelding(id); if (p.klasseId === k.id) p.startrekke = i + 1; });
  oppdaterStarttider(k);
  lager.lagre();
  return { rader: sortertStartliste(k.id).map(startlisteRad) };
});

rute('POST', /^\/api\/admin\/klasser\/([\w-]+)\/offisiell$/, 'sekretariat', async ({ m, req }) => {
  const k = finnKlasse(m[1]);
  const { offisiell } = await lesJson(req);
  if (offisiell) {
    const liste = resultatliste(k.id);
    const uferdig = liste.rader.filter((r) => ['foreløpig', 'under-bedomming'].includes(r.status));
    if (uferdig.length) throw new Feil(409, `${uferdig.length} ekvipasje(r) mangler signerte protokoller fra alle dommere.`);
    k.status = 'avsluttet';
  }
  k.offisiell = !!offisiell;
  logg('Sekretariat', `${k.navn}: resultatlisten ${offisiell ? 'gjort offisiell' : 'åpnet igjen'}`);
  lager.lagre();
  return { ok: true };
});

rute('PUT', /^\/api\/admin\/fradrag\/([\w-]+)$/, 'sekretariat', async ({ m, req }) => settFradrag(m[1], await lesJson(req), 'Sekretariat'));

rute('GET', /^\/api\/admin\/resultater\/([\w-]+)$/, 'sekretariat', ({ m }) => resultatliste(m[1], { admin: true }));
rute('GET', /^\/api\/admin\/protokoll\/([\w-]+)$/, 'sekretariat', ({ m }) => protokollVisning(m[1]));
rute('GET', /^\/api\/admin\/klasser\/([\w-]+)\/protokoller$/, 'sekretariat', ({ m }) => sortertStartliste(finnKlasse(m[1]).id).map((p) => protokollVisning(p.id)));
rute('GET', '/api/admin/logg', 'sekretariat', () => db().logg.slice(-500).reverse());

rute('POST', '/api/admin/dommere', 'sekretariat', async ({ req }) => {
  const b = await lesJson(req);
  const brukernavn = tekst(b.brukernavn, 40).toLowerCase();
  if (!/^[a-z0-9._-]{2,40}$/.test(brukernavn)) throw new Feil(400, 'Brukernavn: 2–40 tegn, bokstaver a–z, tall, punktum eller bindestrek.');
  if (brukernavn === SEK_BRUKER.toLowerCase() || db().dommere.some((d) => d.brukernavn === brukernavn)) throw new Feil(409, 'Brukernavnet er i bruk.');
  const navn = tekst(b.navn, 80);
  if (!navn) throw new Feil(400, 'Dommeren må ha navn.');
  const passord = lagPassord();
  const d = { id: nyId('d'), navn, brukernavn, autorisasjon: tekst(b.autorisasjon, 60), epost: tekst(b.epost, 120), passordHash: hashPassord(passord) };
  db().dommere.push(d);
  lager.lagre();
  const { passordHash, ...ut } = d;
  return { ...ut, passord };
});
rute('PUT', /^\/api\/admin\/dommere\/([\w-]+)$/, 'sekretariat', async ({ m, req }) => {
  const d = db().dommere.find((x) => x.id === m[1]);
  if (!d) throw new Feil(404, 'Fant ikke dommeren.');
  const b = await lesJson(req);
  Object.assign(d, { navn: tekst(b.navn, 80) || d.navn, autorisasjon: tekst(b.autorisasjon, 60), epost: tekst(b.epost, 120) });
  let passord;
  if (b.nyttPassord) { passord = lagPassord(); d.passordHash = hashPassord(passord); slettOkterFor(d.id); }
  lager.lagre();
  const { passordHash, ...ut } = d;
  return { ...ut, ...(passord ? { passord } : {}) };
});
rute('DELETE', /^\/api\/admin\/dommere\/([\w-]+)$/, 'sekretariat', ({ m }) => {
  if (db().klasser.some((k) => Object.values(k.dommere || {}).includes(m[1]))) throw new Feil(409, 'Dommeren er satt opp i en klasse.');
  db().dommere = db().dommere.filter((d) => d.id !== m[1]);
  slettOkterFor(m[1]);
  lager.lagre();
  return { ok: true };
});

rute('PUT', /^\/api\/admin\/paameldinger\/([\w-]+)$/, 'sekretariat', async ({ m, req }) => {
  const p = finnPamelding(m[1]);
  const b = await lesJson(req);
  const gammelKlasse = finnKlasse(p.klasseId);
  if (b.rytter) p.rytter = rensRytter({ ...p.rytter, ...b.rytter });
  if (b.hest) p.hest = rensHest({ ...p.hest, ...b.hest });
  if (b.klasseId && b.klasseId !== p.klasseId) {
    if (Object.keys(db().bedommelser[p.id]?.protokoller || {}).length) throw new Feil(409, 'Ekvipasjen har karakterer i klassen.');
    finnKlasse(b.klasseId);
    Object.assign(p, { klasseId: b.klasseId, startrekke: null, starttid: null });
  }
  if (['pameldt', 'venteliste', 'trukket'].includes(b.status)) p.status = b.status;
  if (b.startnr !== undefined) p.startnr = Number(b.startnr) || null;
  if (b.betalt !== undefined) p.betalt = !!b.betalt;
  if (b.merknad !== undefined) p.merknad = tekst(b.merknad, 300);
  flyttFraVenteliste(gammelKlasse);
  lager.lagre();
  return p;
});
rute('DELETE', /^\/api\/admin\/paameldinger\/([\w-]+)$/, 'sekretariat', ({ m }) => {
  const p = finnPamelding(m[1]);
  if (Object.keys(db().bedommelser[p.id]?.protokoller || {}).length) throw new Feil(409, 'Ekvipasjen har karakterer – sett status Trukket i stedet.');
  db().paameldinger = db().paameldinger.filter((x) => x.id !== p.id);
  delete db().bedommelser[p.id];
  flyttFraVenteliste(finnKlasse(p.klasseId));
  lager.lagre();
  return { ok: true };
});
rute('POST', '/api/admin/startnummer', 'sekretariat', () => { tildelStartnummer(); lager.lagre(); return { ok: true }; });

rute('GET', '/api/admin/sikkerhetskopi', 'sekretariat', ({ res }) => {
  res.setHeader('Content-Disposition', `attachment; filename="dressur-${new Date().toISOString().slice(0, 16).replace(':', '')}.json"`);
  return db();
});
rute('POST', '/api/admin/gjenopprett', 'sekretariat', async ({ req }) => {
  const b = await lesJson(req);
  if (!b || !Array.isArray(b.klasser) || !Array.isArray(b.paameldinger) || !b.stevne) throw new Feil(400, 'Filen ser ikke ut som en sikkerhetskopi.');
  lager.erstatt(b);
  return { ok: true };
});
rute('POST', '/api/admin/demo', 'sekretariat', () => {
  const { db: ny, passord } = lagDemo();
  lager.erstatt(ny);
  return { ok: true, passord };
});

function csvSvar(res, navn, rader) {
  res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${navn}"`, 'Cache-Control': 'no-store' });
  res.end(csv(rader));
  return undefined;
}
rute('GET', '/api/admin/eksport/paameldinger.csv', 'sekretariat', ({ res }) => csvSvar(res, 'paameldinger.csv', [
  ['Klasse', 'Status', 'Startnr', 'Starttid', 'Rytter', 'Fødselsår', 'Kategori', 'Klubb', 'Lisens', 'E-post', 'Telefon', 'Hest', 'Pass/UELN', 'Hest født', 'Kjønn', 'Type', 'Eier', 'Etteranmeldt', 'Betalt', 'Påmeldt', 'Merknad'],
  ...db().paameldinger.map((p) => {
    const k = db().klasser.find((x) => x.id === p.klasseId);
    return [k?.navn, p.status, p.startnr, p.starttid, p.rytter.navn, p.rytter.fodselsaar, rytterKategori(p.rytter.fodselsaar, Number((k?.dato || '').slice(0, 4)) || new Date().getFullYear()),
      p.rytter.klubb, p.rytter.lisens, p.rytter.epost, p.rytter.tlf, p.hest.navn, p.hest.pass, p.hest.fodselsaar, p.hest.kjonn, p.hest.type, p.hest.eier,
      p.etteranmeldt ? 'Ja' : '', p.betalt ? 'Ja' : '', p.opprettet.slice(0, 16).replace('T', ' '), p.merknad || ''];
  }),
]));
rute('GET', /^\/api\/admin\/eksport\/resultater-([\w-]+)\.csv$/, 'sekretariat', ({ m, res }) => {
  const r = resultatliste(m[1], { admin: true });
  return csvSvar(res, `resultater-${r.klasse.nr || r.klasse.id}.csv`, [
    ['Plass', 'Startnr', 'Rytter', 'Klubb', 'Hest', ...r.posisjoner.map((p) => `${p} (${r.klasse.dommere.find((d) => d.pos === p)?.navn})`), 'Prosent', 'Status', 'Premie'],
    ...r.rader.map((x) => [x.plassering ?? '', x.startnr ?? '', x.rytter.navn, x.rytter.klubb, x.hest.navn,
      ...r.posisjoner.map((p) => formatProsent(x.perDommer[p].prosent)), formatProsent(x.prosent),
      x.status === 'eliminert' ? `Eliminert${x.elimGrunn ? ` (${x.elimGrunn})` : ''}` : x.statusTekst, x.premie ? 'Ja' : '']),
  ]);
});

// ---------- statiske filer ----------

const TYPER = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
};
const SIDER = { '/': 'index.html', '/sekretariat': 'sekretariat.html', '/dommer': 'dommer.html', '/protokoll': 'protokoll.html' };
const SIKKERHET = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

function statisk(sti, res) {
  const fil = path.normalize(path.join(PUBLIC, SIDER[sti] || sti));
  if (!fil.startsWith(PUBLIC + path.sep)) return false;
  let st;
  try { st = fs.statSync(fil); } catch { return false; }
  if (!st.isFile()) return false;
  res.writeHead(200, { 'Content-Type': TYPER[path.extname(fil)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(fil).pipe(res);
  return true;
}

export const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SIKKERHET)) res.setHeader(k, v);
  const url = new URL(req.url, 'http://lokal');
  const sti = decodeURIComponent(url.pathname);
  try {
    for (const r of ruter) {
      if (r.metode !== req.method) continue;
      const m = typeof r.monster === 'string' ? (r.monster === sti ? [sti] : null) : r.monster.exec(sti);
      if (!m) continue;
      const okt = hentOkt(req);
      krevTilgang(r.tilgang, okt);
      const svar = await r.fn({ req, res, m, url, okt });
      if (svar !== undefined && !res.headersSent) sendJson(res, 200, svar);
      return;
    }
    if (sti.startsWith('/api/')) throw new Feil(404, 'Ukjent adresse.');
    if (req.method === 'GET' && statisk(sti, res)) return;
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Fant ikke siden.');
  } catch (e) {
    if (!(e instanceof Feil)) console.error(e);
    if (!res.headersSent) sendJson(res, e.status || 500, { feil: e instanceof Feil ? e.message : 'Noe gikk galt på serveren.' });
    else res.end();
  }
});

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => console.log(`Dressurstevne kjører på http://localhost:${PORT}`));
}
