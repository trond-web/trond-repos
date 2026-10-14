// Registrering av rein til bruk i forvaltningen: flokkobservasjoner med struktur, felte dyr,
// skadeskyting og syk/død rein. Rene funksjoner uten DOM, så de kan testes.
import { utm } from './geo.js';

export const TYPER = {
  obs: { ikon: '👀', navn: 'Observasjon', rein: true },
  felt: { ikon: '🦌', navn: 'Felt dyr', rein: true },
  skadet: { ikon: '🩸', navn: 'Skadeskutt', rein: true },
  syk: { ikon: '⚠️', navn: 'Syk/død rein', rein: true },
  bil: { ikon: '🚙', navn: 'Bil' },
  leir: { ikon: '⛺', navn: 'Leir/hytte' },
  annet: { ikon: '📍', navn: 'Punkt' },
};

// Strukturklasser som i strukturtellinger for villrein.
export const STRUKTUR = [
  { id: 'kalv', navn: 'Kalv' },
  { id: 'simle', navn: 'Simle', hint: 'voksen hunn' },
  { id: 'ungdyr', navn: 'Ungdyr', hint: 'åring, 1½ år' },
  { id: 'bukkSmaa', navn: 'Bukk, liten', hint: '2½ år' },
  { id: 'bukkMellom', navn: 'Bukk, middels' },
  { id: 'bukkStor', navn: 'Bukk, stor' },
  { id: 'ukjent', navn: 'Ukjent' },
];

export const ALDER = { kalv: 'Kalv', aaring: 'Åring (1½ år)', eldre: 'Eldre (2½ år +)' };
export const KJONN = { bukk: 'Bukk', simle: 'Simle' };
export const RETNINGER = ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'];
export const ATFERD = { beiter: 'Står/beiter', trekker: 'Trekker', flykter: 'Flykter', ligger: 'Ligger' };

const tall = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };

// Antall dyr i en observasjon: oppgitt total, ellers summen av strukturen.
export function antallDyr(o = {}) {
  const sum = STRUKTUR.reduce((a, s) => a + tall(o[s.id]), 0);
  return Math.max(tall(o.total), sum);
}

// Flytter et punkt `meter` i kompassretning `grader` (for å plassere flokken ut fra der man står).
export function flytt([lon, lat], meter, grader) {
  const R = 6371008.8, d = meter / R, b = (grader * Math.PI) / 180, φ1 = (lat * Math.PI) / 180, λ1 = (lon * Math.PI) / 180;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(b));
  const λ2 = λ1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2));
  return [(λ2 * 180) / Math.PI, (φ2 * 180) / Math.PI];
}

// Jaktår regnes fra 1. april, som i Hjorteviltregisteret.
export const jaktaar = (t) => { const d = new Date(t); return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; };

const forhold = (a, b) => (b > 0 ? Math.round((100 * a) / b) : null);
const snitt = (l) => (l.length ? Math.round((10 * l.reduce((a, b) => a + b, 0)) / l.length) / 10 : null);

export function oppsummering(punkter, { aar = null, vald = null } = {}) {
  const utvalg = punkter.filter((p) => (aar == null || jaktaar(p.tid) === aar) && (!vald || p.vald === vald));
  const obs = utvalg.filter((p) => p.type === 'obs');
  const felt = utvalg.filter((p) => p.type === 'felt');
  const struktur = Object.fromEntries(STRUKTUR.map((s) => [s.id, obs.reduce((a, p) => a + tall(p.obs?.[s.id]), 0)]));
  const bukker = struktur.bukkSmaa + struktur.bukkMellom + struktur.bukkStor;
  const klassifisert = STRUKTUR.filter((s) => s.id !== 'ukjent').reduce((a, s) => a + struktur[s.id], 0);
  const kategorier = {};
  for (const p of felt) {
    const k = `${p.felt?.alder || 'ukjent'}-${p.felt?.kjonn || 'ukjent'}`;
    (kategorier[k] ||= { antall: 0, vekter: [] }).antall++;
    if (tall(p.felt?.vekt) > 0) kategorier[k].vekter.push(Number(p.felt.vekt));
  }
  for (const k of Object.values(kategorier)) { k.snittvekt = snitt(k.vekter); delete k.vekter; }
  return {
    obs: {
      registreringer: obs.length,
      dyr: obs.reduce((a, p) => a + antallDyr(p.obs), 0),
      klassifisert,
      struktur,
      bukker,
      kalvPer100Simler: forhold(struktur.kalv, struktur.simle),
      bukkerPer100Simler: forhold(bukker, struktur.simle),
      andelStoreBukker: forhold(struktur.bukkStor, bukker),
      merketFlokker: obs.filter((p) => p.obs?.merket).length,
    },
    felt: {
      antall: felt.length,
      kategorier,
      snittvekt: snitt(felt.map((p) => tall(p.felt?.vekt)).filter((v) => v > 0)),
      kjever: felt.filter((p) => p.felt?.kjeve).length,
      cwd: felt.filter((p) => p.felt?.cwd).length,
      manglerCwd: felt.filter((p) => !p.felt?.cwd).map((p) => p.navn),
      merket: felt.filter((p) => p.felt?.merket).length,
    },
    skadet: utvalg.filter((p) => p.type === 'skadet').length,
    syk: utvalg.filter((p) => p.type === 'syk').length,
  };
}

export function oppsummeringTekst(o, { tittel = 'Villrein Nordfjella' } = {}) {
  const l = [tittel];
  l.push(`Observasjoner: ${o.obs.registreringer} registreringer, ${o.obs.dyr} dyr sett (${o.obs.klassifisert} klassifisert).`);
  if (o.obs.klassifisert) {
    const s = o.obs.struktur;
    l.push(`Struktur: ${s.kalv} kalv, ${s.simle} simle, ${s.ungdyr} ungdyr, ${o.obs.bukker} bukk (${s.bukkSmaa} små, ${s.bukkMellom} middels, ${s.bukkStor} store), ${s.ukjent} ukjent.`);
    if (o.obs.kalvPer100Simler != null) l.push(`Kalv per 100 simler: ${o.obs.kalvPer100Simler}. Bukk per 100 simler: ${o.obs.bukkerPer100Simler}.`);
  }
  l.push(`Felt: ${o.felt.antall} dyr${o.felt.snittvekt ? `, snitt slaktevekt ${o.felt.snittvekt} kg` : ''}. Kjever: ${o.felt.kjever}/${o.felt.antall}. CWD-prøver: ${o.felt.cwd}/${o.felt.antall}.`);
  for (const [k, v] of Object.entries(o.felt.kategorier)) {
    const [alder, kjonn] = k.split('-');
    l.push(`  ${ALDER[alder] || 'Ukjent alder'} ${(KJONN[kjonn] || '').toLowerCase()}: ${v.antall}${v.snittvekt ? ` (snitt ${v.snittvekt} kg)` : ''}`);
  }
  if (o.skadet) l.push(`Skadeskyting/ettersøk: ${o.skadet}.`);
  if (o.syk) l.push(`Syk/død rein meldt: ${o.syk}.`);
  return l.join('\n');
}

const csvFelt = (v) => { const s = String(v ?? ''); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export function csv(punkter) {
  const kol = ['tid', 'type', 'navn', 'vald', 'lat', 'lon', 'utm32_ost', 'utm32_nord', 'hoyde', 'gps_noyaktighet_m',
    'antall_totalt', ...STRUKTUR.map((s) => s.id), 'atferd', 'trekkretning', 'merket_dyr',
    'kjonn', 'alder', 'slaktevekt_kg', 'kjeve_tatt', 'kjevenr', 'cwd_prove', 'cwd_provenr', 'jeger',
    'ettersok_varslet', 'tilstand', 'notat'];
  const rader = punkter.map((p) => {
    const u = utm([p.lon, p.lat], 32);
    const o = p.obs || {}, f = p.felt || {}, a = p.annet || {};
    const merket = p.type === 'obs' ? o.merket : f.merket;
    return [new Date(p.tid).toISOString(), TYPER[p.type]?.navn || p.type, p.navn, p.vald, p.lat.toFixed(6), p.lon.toFixed(6), Math.round(u.øst), Math.round(u.nord),
      p.hoyde != null ? Math.round(p.hoyde) : '', p.acc != null ? Math.round(p.acc) : '',
      p.type === 'obs' ? antallDyr(o) : p.type === 'syk' ? a.antall ?? '' : '', ...STRUKTUR.map((s) => (p.type === 'obs' ? o[s.id] ?? '' : '')),
      ATFERD[o.atferd] || '', o.retning || a.retning || '', merket ? 'ja' : '',
      KJONN[f.kjonn] || '', ALDER[f.alder] || '', f.vekt ?? '', p.type === 'felt' ? (f.kjeve ? 'ja' : 'nei') : '', f.kjevenr || '',
      p.type === 'felt' ? (f.cwd ? 'ja' : 'nei') : '', f.cwdnr || '', f.jeger || '',
      p.type === 'skadet' ? (a.ettersok ? 'ja' : 'nei') : '', a.tilstand || '', p.notat || ''].map(csvFelt).join(';');
  });
  // BOM slik at Excel leser æøå riktig.
  return `﻿${kol.join(';')}\n${rader.join('\n')}\n`;
}
