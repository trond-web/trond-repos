// Rapporter for skogbruksplanen: hovedtall, bestandsliste, hogstprognose og PEFC.
// Hver rapport er et selvstendig HTML-dokument (A4, klart for utskrift/PDF) og har en CSV-variant. Ingen DOM.
import {
  TRESLAG, HK_NAVN, HK_ROMERTALL, HOGSTKLASSER, BONITETER, TILTAKSTYPER, startTilstand, arligTilvekstDaa,
  laavesteHogstalder, beregnetHogstklasse, rotnettoPerM3, tiltakKostnad, framskriv, sammendrag, HOGSTTYPER, hogstAndel, hogstNettoPerM3,
} from './model.js';
import { etikettPunkt } from './proj.js';
import { MARKSLAG, monsterDefs, symbolFyll, symbolRute, arealfordeling } from './markslag.js';
import { KRAVPUNKTER, TEMA, OBJEKTTYPER, KLARERING, HOGSTFORMER, FORYNGELSE, arealDaa, klareringStatus } from './pefc.js';

export const RAPPORTER = {
  hovedtall: { navn: 'Hovedtall', beskrivelse: 'Areal, volum, tilvekst og verdi fordelt på hogstklasse, treslag og bonitet, med kart og avvirkningsmuligheter.' },
  bestandsliste: { navn: 'Bestandsliste', beskrivelse: 'Alle bestand per teig med areal, treslag, bonitet, alder, høyde, treantall, volum, tilvekst, tiltak og merknader.', liggende: true },
  hogstprognose: { navn: 'Hogstprognose', beskrivelse: 'Planlagt hogst og hogstmodent volum per femårsperiode, med netto inntekt, tilvekst og utvikling i stående volum.' },
  pefc: { navn: 'PEFC-rapport', beskrivelse: 'Status for alle 30 kravpunkter i Norsk PEFC Skogstandard, avvik, miljøobjekter, klarering før hogst og datagrunnlag.' },
};

// ---------- hjelpere ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const tall = (v, d = 0) => (v === null || v === undefined || Number.isNaN(v) ? '–' : Number(v).toLocaleString('nb-NO', { minimumFractionDigits: d, maximumFractionDigits: d }));
const sortNr = (a, b) => String(a).localeCompare(String(b), 'nb', { numeric: true });
const hkFor = (b, inn) => { const s = startTilstand(b); return b.hogstklasse || beregnetHogstklasse(s.alder, laavesteHogstalder(b, inn), s.volumDaa); };
const HK_FARGER = { 1: '#fcfdfe', 2: '#f8f6a9', 3: '#d9f6c7', 4: '#9bd47f', 5: '#ef9a7c' };
const TS_FARGER = { G: '#1baf7a', F: '#eb6834', L: '#2a78d6' };
const csvCelle = (v) => { const s = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const csv = (rader) => `﻿${rader.map((r) => r.map(csvCelle).join(';')).join('\n')}`;

function hode(S, tittel, iAar) {
  const e = S.eiendom || {};
  return `<header class="r-hode"><div><div class="r-merke">SkogIQ<span>.ai</span></div><h1>${esc(tittel)}</h1>
    <div class="r-eiendom">${esc(e.navn || 'Eiendom')}${e.kommune ? ` · ${esc(e.kommune)} kommune` : ''}${e.gnrbnr ? ` · gnr/bnr ${esc(e.gnrbnr)}` : ''}${e.eier ? ` · ${esc(e.eier)}` : ''}</div></div>
    <div class="r-meta">Takstår ${esc(e.takstAar || '–')}<br>Utskrevet ${new Date().toLocaleDateString('nb-NO')}<br>Beregningsår ${iAar}</div></header>`;
}
const fot = (tekst) => `<footer class="r-fot">${tekst} Volum, tilvekst og verdier er beregnet med SkogIQ.ai sine modeller og innstilte priser, og er estimater. Laget med SkogIQ.ai.</footer>`;

// Kart over bestandene som SVG (skarpt på papir). farge(b) gir fyllfarge.
export function svgKart(S, farge, { bredde = 720, hoyde = 460, etiketter = true, ekstra = [], markslag = true } = {}) {
  const med = S.bestand.filter((b) => b.geometri && /Polygon/.test(b.geometri.type));
  const grense = S.eiendom?.grense;
  const ringer = (g) => (g.type === 'Polygon' ? g.coordinates : g.coordinates.flat());
  const ms = markslag ? (S.markslag || []).filter((f) => f.geometri) : [];
  const alle = [...med.flatMap((b) => ringer(b.geometri)), ...ms.flatMap((f) => ringer(f.geometri)), ...(grense ? ringer(grense) : [])].flat();
  if (!alle.length) return '';
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const [x, y] of alle) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const kx = Math.cos((((y0 + y1) / 2) * Math.PI) / 180);
  const w = (x1 - x0) * kx || 1e-6; const h = (y1 - y0) || 1e-6;
  const sk = Math.min((bredde - 20) / w, (hoyde - 20) / h);
  const ox = (bredde - w * sk) / 2; const oy = (hoyde - h * sk) / 2;
  const p = ([x, y]) => `${(ox + (x - x0) * kx * sk).toFixed(1)},${(oy + (y1 - y) * sk).toFixed(1)}`;
  const sti = (g) => ringer(g).map((r) => `M${r.map(p).join('L')}Z`).join('');
  const meter = (kx * 111320) / sk; // meter per piksel ≈ 1/sk grader → meter
  const malestokk = [100, 200, 500, 1000, 2000, 5000].find((m) => m / meter > 60) || 5000;
  let ut = `<svg class="r-kart" viewBox="0 0 ${bredde} ${hoyde}" xmlns="http://www.w3.org/2000/svg">${ms.length ? monsterDefs('rk') : ''}`;
  for (const f of ms) ut += `<path d="${sti(f.geometri)}" fill="${symbolFyll(f.kategori, 'rk')}" stroke="#6b6358" stroke-width="0.5" fill-rule="evenodd"/>`;
  for (const b of med) ut += `<path d="${sti(b.geometri)}" fill="${farge(b) || '#eee'}" stroke="#1b1c19" stroke-width="0.6" fill-rule="evenodd"/>`;
  if (grense) ut += `<path d="${sti(grense)}" fill="none" stroke="#d03b3b" stroke-width="1.6" stroke-dasharray="6 4"/>`;
  // Ekstra objekter (f.eks. miljøobjekter): flater, linjer og punkter i egen farge.
  for (const o of ekstra) {
    const g = o.geometri; if (!g) continue;
    if (g.type === 'Point') { const [sx, sy] = p(g.coordinates).split(','); ut += `<circle cx="${sx}" cy="${sy}" r="4" fill="${o.farge}" stroke="#fff" stroke-width="1"/>`; }
    else if (/Line/.test(g.type)) { const linjer = g.type === 'LineString' ? [g.coordinates] : g.coordinates; ut += `<path d="${linjer.map((l) => `M${l.map(p).join('L')}`).join('')}" fill="none" stroke="${o.farge}" stroke-width="2"/>`; }
    else if (/Polygon/.test(g.type)) ut += `<path d="${sti(g)}" fill="${o.farge}" fill-opacity="0.35" stroke="${o.farge}" stroke-width="1.2" fill-rule="evenodd"/>`;
  }
  if (etiketter) {
    for (const b of med) {
      const pt = etikettPunkt(b.geometri); if (!pt) continue;
      const bb = ringer(b.geometri)[0]; const bw = (Math.max(...bb.map((q) => q[0])) - Math.min(...bb.map((q) => q[0]))) * kx * sk;
      if (bw < 18) continue;
      const [sx, sy] = p(pt).split(',');
      ut += `<text x="${sx}" y="${sy}" class="r-knr">${esc(b.nr)}</text>`;
    }
  }
  ut += `<g transform="translate(${bredde - 20 - malestokk / meter},${hoyde - 14})"><rect width="${(malestokk / meter).toFixed(1)}" height="4" fill="#1b1c19"/><text x="0" y="-4" class="r-skala">0</text><text x="${(malestokk / meter).toFixed(1)}" y="-4" class="r-skala" text-anchor="end">${malestokk >= 1000 ? `${malestokk / 1000} km` : `${malestokk} m`}</text></g>`;
  ut += `<g transform="translate(16,16)"><path d="M0 14 L6 0 L12 14 L6 10 Z" fill="#1b1c19"/><text x="6" y="26" class="r-skala" text-anchor="middle">N</text></g></svg>`;
  return ut;
}

// Enkelt stablet søylediagram som SVG.
function svgSoyler(kategorier, serier, { hoyde = 200, bredde = 720, enhet = '' } = {}) {
  const sum = kategorier.map((k) => serier.reduce((s, se) => s + (k.verdier[se.key] || 0), 0));
  const maks = Math.max(1, ...sum);
  const steg = 10 ** Math.floor(Math.log10(maks)); const topp = Math.ceil(maks / steg) * steg;
  const m = { t: 10, b: 28, l: 56, r: 10 }; const iw = bredde - m.l - m.r; const ih = hoyde - m.t - m.b;
  const bw = iw / kategorier.length;
  let ut = `<svg class="r-diagram" viewBox="0 0 ${bredde} ${hoyde + 22}" xmlns="http://www.w3.org/2000/svg">`;
  for (let i = 0; i <= 4; i++) { const v = (topp / 4) * i; const y = m.t + ih - (v / topp) * ih; ut += `<line x1="${m.l}" x2="${bredde - m.r}" y1="${y}" y2="${y}" stroke="#ddd"/><text x="${m.l - 6}" y="${y + 4}" text-anchor="end" class="r-skala">${tall(v)}</text>`; }
  kategorier.forEach((k, i) => {
    let y = m.t + ih;
    for (const se of serier) { const v = k.verdier[se.key] || 0; const hh = (v / topp) * ih; y -= hh; if (hh > 0) ut += `<rect x="${m.l + i * bw + bw * 0.18}" y="${y}" width="${bw * 0.64}" height="${hh}" fill="${se.farge}"/>`; }
    ut += `<text x="${m.l + i * bw + bw / 2}" y="${m.t + ih + 16}" text-anchor="middle" class="r-skala">${esc(k.navn)}</text>`;
  });
  ut += `<text x="${m.l}" y="${hoyde + 16}" class="r-skala">${esc(enhet)}</text>`;
  let lx = m.l + 60; for (const se of serier) { ut += `<rect x="${lx}" y="${hoyde + 7}" width="10" height="10" fill="${se.farge}"/><text x="${lx + 14}" y="${hoyde + 16}" class="r-skala">${esc(se.navn)}</text>`; lx += 24 + se.navn.length * 6.5; }
  return `${ut}</svg>`;
}
const tegnforklaring = (rader) => `<div class="r-tegn">${rader.map(([f, t]) => `<span><i style="background:${f}"></i>${esc(t)}</span>`).join('')}</div>`;

// ---------- markslag ----------
const msForklaring = (S) => { const kat = [...new Set((S.markslag || []).map((f) => f.kategori))]; return kat.length ? `<div class="r-tegn">${Object.keys(MARKSLAG).filter((k) => kat.includes(k)).map((k) => `<span>${symbolRute(k, 'rl', 12)} ${esc(MARKSLAG[k].kort)}</span>`).join('')}</div>` : ''; };
function arealfordelingHtml(S) {
  const a = arealfordeling(S);
  if (!(S.markslag || []).length) return '<p class="r-liten">Markslag (AR5) er ikke hentet for planen – produktivt areal kan inneholde uproduktiv mark.</p>';
  return `<h2>Arealfordeling (markslag)</h2><table><thead><tr><th style="width:24px"></th><th>Markslag</th><th class="t">Figurer</th><th class="t">Areal daa</th><th class="t">%</th></tr></thead><tbody>
    ${Object.entries(a.rader).filter(([, r]) => r.areal > 0).map(([k, r]) => `<tr><td>${k === 'produktiv' ? `<span style="display:inline-block;width:12px;height:12px;border:1px solid #555;background:${MARKSLAG.produktiv.farge}"></span>` : symbolRute(k, 'ra', 12)}</td><td>${esc(MARKSLAG[k].navn)}</td><td class="t">${r.antall}</td><td class="t">${tall(r.areal, 1)}</td><td class="t">${tall(a.total ? (r.areal / a.total) * 100 : 0, 1)}</td></tr>`).join('')}
    ${a.ukjent > 0.5 ? `<tr><td></td><td>Ikke klassifisert</td><td></td><td class="t">${tall(a.ukjent, 1)}</td><td class="t">${tall((a.ukjent / a.total) * 100, 1)}</td></tr>` : ''}</tbody>
    <tfoot><tr><td></td><td>Sum eiendom</td><td></td><td class="t">${tall(a.total, 1)}</td><td class="t">100</td></tr></tfoot></table>
    <p class="r-liten">Produktiv skog er summen av bestandene. Uproduktiv mark er hentet fra AR5 (NIBIO) og er trukket ut av bestandene; her beregnes ikke volum eller tilvekst. Uproduktiv skog: ${tall(a.uproduktivSkog, 1)} daa (impediment, myr og åpen fastmark).</p>`;
}
function uproduktivHtml(S) {
  const fig = S.markslag || [];
  if (!fig.length) return '';
  const kat = Object.keys(MARKSLAG).filter((k) => fig.some((f) => f.kategori === k));
  return `<h2>Uproduktive arealer og annen markslag (AR5)</h2>
    <table class="r-bestand"><thead><tr><th style="width:20px"></th><th>Figur</th><th>Markslag</th><th class="t">Areal daa</th><th>Treslag (AR5)</th><th>Grunnforhold</th><th>Skogbonitet</th><th>Kartlagt</th></tr></thead><tbody>
    ${kat.map((k) => { const l = fig.filter((f) => f.kategori === k); return l.map((f) => `<tr><td>${symbolRute(k, "rb", 11)}</td><td><b>${esc(f.nr)}</b></td><td>${esc(MARKSLAG[k].navn)}</td><td class="t">${tall(f.areal, 1)}</td><td>${esc(f.ar5?.treslag || '')}</td><td>${esc(f.ar5?.grunnforhold || '')}</td><td>${esc(f.ar5?.bonitet || '')}</td><td>${esc(f.ar5?.datafangst || '')}</td></tr>`).join('') + `<tr class="r-sum"><td></td><td colspan="2">Sum ${esc(MARKSLAG[k].kort.toLowerCase())} (${l.length})</td><td class="t">${tall(l.reduce((s, f) => s + f.areal, 0), 1)}</td><td colspan="4"></td></tr>`; }).join('')}</tbody>
    <tfoot><tr><td></td><td colspan="2">Sum uproduktivt og annet areal</td><td class="t">${tall(fig.reduce((s, f) => s + f.areal, 0), 1)}</td><td colspan="4"></td></tr></tfoot></table>`;
}

// ---------- 1. Hovedtall ----------
function hovedtallData(S, iAar) {
  const inn = S.innstillinger;
  const s = sammendrag(S.bestand, inn);
  const perHk = {}; for (const h of HOGSTKLASSER) perHk[h] = { areal: { G: 0, F: 0, L: 0 }, volum: { G: 0, F: 0, L: 0 }, tilvekst: 0, antall: 0 };
  const perBon = {}; for (const bo of BONITETER) perBon[bo] = { G: 0, F: 0, L: 0 };
  let alderSum = 0; let modent10 = 0; let modentNaa = 0; let modentKr = 0; let miljoDaa = 0;
  for (const b of S.bestand) {
    const st = startTilstand(b); const a = b.areal || 0; const ts = b.treslag || 'G'; const hk = hkFor(b, inn) || 1;
    perHk[hk].areal[ts] += a; perHk[hk].volum[ts] += st.volumDaa * a; perHk[hk].tilvekst += arligTilvekstDaa(b) * a; perHk[hk].antall++;
    const bo = BONITETER.reduce((n, x) => (Math.abs(x - (b.bonitet || 11)) < Math.abs(n - (b.bonitet || 11)) ? x : n), 11);
    perBon[bo][ts] += a;
    alderSum += st.alder * a;
    if (b.miljo) { miljoDaa += a; continue; }
    const min = laavesteHogstalder(b, inn) || 999;
    if (st.alder >= min) { modentNaa += st.volumDaa * a; modentKr += st.volumDaa * a * rotnettoPerM3(ts, inn); }
    else if (st.alder + 10 >= min) modent10 += st.volumDaa * a;
  }
  const eiendomDaa = S.metadata?.eiendomDaa || null;
  return { s, perHk, perBon, middelalder: s.areal ? alderSum / s.areal : 0, modentNaa, modentKr, modent10, miljoDaa, eiendomDaa, inn };
}

function hovedtallHtml(S, { iAar, verdi = null }) {
  const d = hovedtallData(S, iAar); const { s, perHk, perBon, inn } = d;
  const ts = Object.keys(TRESLAG);
  const sumTs = (o) => ts.reduce((x, k) => x + (o[k] || 0), 0);
  const kpi = (v, t) => `<div class="r-kpi"><b>${v}</b><span>${t}</span></div>`;
  const hkTabell = (felt, d0) => `<table><thead><tr><th>Hogstklasse</th>${ts.map((k) => `<th class="t">${TRESLAG[k]}</th>`).join('')}<th class="t">Sum</th><th class="t">%</th></tr></thead><tbody>
    ${HOGSTKLASSER.map((h) => `<tr><td>${HK_NAVN[h]}</td>${ts.map((k) => `<td class="t">${tall(perHk[h][felt][k], d0)}</td>`).join('')}<td class="t"><b>${tall(sumTs(perHk[h][felt]), d0)}</b></td><td class="t">${tall((sumTs(perHk[h][felt]) / Math.max(1e-9, felt === 'areal' ? s.areal : s.volum)) * 100, 1)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td>Sum</td>${ts.map((k) => `<td class="t">${tall(HOGSTKLASSER.reduce((x, h) => x + perHk[h][felt][k], 0), d0)}</td>`).join('')}<td class="t">${tall(felt === 'areal' ? s.areal : s.volum, d0)}</td><td class="t">100</td></tr></tfoot></table>`;
  return `${hode(S, 'Hovedtall', iAar)}
    <section class="r-kpier">
      ${kpi(`${tall(s.areal)} daa`, 'produktiv skog')}
      ${d.eiendomDaa ? kpi(`${tall(d.eiendomDaa)} daa`, 'eiendommens totalareal') : kpi(tall(s.antall), 'bestand')}
      ${kpi(`${tall(s.volum)} m³`, `stående volum (${tall(s.areal ? s.volum / s.areal : 0, 1)} m³/daa)`)}
      ${kpi(`${tall(s.tilvekst)} m³`, `tilvekst per år (${tall(s.volum ? (s.tilvekst / s.volum) * 100 : 0, 1)} %)`)}
      ${kpi(`${tall(d.middelalder)} år`, 'arealveid middelalder')}
      ${kpi(`${tall(s.co2)} t`, 'CO₂ bundet per år')}
    </section>
    ${arealfordelingHtml(S)}
    <h2>Bestandskart – hogstklasser og markslag</h2>
    ${svgKart(S, (b) => HK_FARGER[hkFor(b, inn)] || '#eee')}
    ${tegnforklaring(HOGSTKLASSER.map((h) => [HK_FARGER[h], HK_NAVN[h]]))}
    ${msForklaring(S)}
    <h2>Areal per hogstklasse og treslag (daa)</h2>${hkTabell('areal', 1)}
    <h2>Volum per hogstklasse og treslag (m³)</h2>${hkTabell('volum', 0)}
    ${svgSoyler(HOGSTKLASSER.map((h) => ({ navn: `HK ${HK_ROMERTALL[h]}`, verdier: perHk[h].volum })), ts.map((k) => ({ key: k, navn: TRESLAG[k], farge: TS_FARGER[k] })), { enhet: 'm³' })}
    <div class="r-brudd"></div>
    <h2>Areal per bonitet og treslag (daa)</h2>
    <table><thead><tr><th>Bonitet (H40)</th>${ts.map((k) => `<th class="t">${TRESLAG[k]}</th>`).join('')}<th class="t">Sum</th></tr></thead><tbody>
    ${BONITETER.filter((bo) => sumTs(perBon[bo]) > 0).map((bo) => `<tr><td>${bo}</td>${ts.map((k) => `<td class="t">${tall(perBon[bo][k], 1)}</td>`).join('')}<td class="t"><b>${tall(sumTs(perBon[bo]), 1)}</b></td></tr>`).join('')}</tbody></table>
    <h2>Tilvekst per hogstklasse</h2>
    <table><thead><tr><th>Hogstklasse</th><th class="t">Bestand</th><th class="t">Tilvekst m³/år</th><th class="t">m³/daa/år</th></tr></thead><tbody>
    ${HOGSTKLASSER.map((h) => { const a = sumTs(perHk[h].areal); return `<tr><td>${HK_NAVN[h]}</td><td class="t">${perHk[h].antall}</td><td class="t">${tall(perHk[h].tilvekst)}</td><td class="t">${tall(a ? perHk[h].tilvekst / a : 0, 2)}</td></tr>`; }).join('')}</tbody></table>
    <h2>Avvirkningsmuligheter</h2>
    <table><tbody>
      <tr><td>Hogstmodent volum nå (alder ≥ laveste hogstalder)</td><td class="t">${tall(d.modentNaa)} m³</td><td class="t">ca. ${tall(d.modentKr / 1000)} k kr rotnetto</td></tr>
      <tr><td>Blir hogstmodent de neste 10 årene</td><td class="t">${tall(d.modent10)} m³</td><td></td></tr>
      <tr><td>Bærekraftig avvirkningsnivå (≈ årlig tilvekst)</td><td class="t">${tall(s.tilvekst)} m³/år</td><td class="t">${tall(s.tilvekst * 10)} m³ per 10 år</td></tr>
      <tr><td>Miljøfigurer og nøkkelbiotoper (holdes utenfor)</td><td class="t">${tall(d.miljoDaa, 1)} daa</td><td></td></tr>
    </tbody></table>
    ${verdi ? `<h2>Verdi (rente ${tall(S.verdi?.rente ?? 3, 1)} %)</h2><table><tbody>
      <tr><td>Eiendomsverdi (forventningsverdi + kapitaliserte andre poster)</td><td class="t">${tall(verdi.eiendom)} kr</td></tr>
      <tr><td>Slaktverdi – alt stående volum hogd nå</td><td class="t">${tall(verdi.slakt)} kr</td></tr>
      <tr><td>Slaktverdi – hogstklasse V</td><td class="t">${tall(verdi.hogstmodenSlakt)} kr</td></tr>
      <tr><td>Jordverdi</td><td class="t">${tall(verdi.jord)} kr</td></tr></tbody></table>` : ''}
    <h2>Priser og forutsetninger</h2>
    <p class="r-liten">Tømmerpris kr/m³: ${ts.map((k) => `${TRESLAG[k]} ${tall(inn.pris[k])}`).join(', ')}. Driftskostnad kr/m³: ${ts.map((k) => `${TRESLAG[k]} ${tall(inn.drift[k])}`).join(', ')}. Laveste hogstalder etter PEFC-tabellen for bonitet og treslag.${S.metadata?.sr16Aar ? ` SR16 målt ${S.metadata.sr16Aar.fra}–${S.metadata.sr16Aar.til}.` : ''}</p>
    ${fot('')}`;
}
function hovedtallCsv(S, { iAar }) {
  const d = hovedtallData(S, iAar); const ts = Object.keys(TRESLAG);
  const r = [['Hovedtall', S.eiendom?.navn || ''], [], ['Produktivt areal (daa)', d.s.areal], ['Stående volum (m3)', d.s.volum], ['Tilvekst (m3/år)', d.s.tilvekst], ['Middelalder (år)', d.middelalder], ['CO2 (t/år)', d.s.co2], [],
    ['Hogstklasse', ...ts.map((k) => `Areal ${TRESLAG[k]}`), 'Areal sum', ...ts.map((k) => `Volum ${TRESLAG[k]}`), 'Volum sum', 'Tilvekst m3/år']];
  for (const h of HOGSTKLASSER) { const x = d.perHk[h]; r.push([HK_NAVN[h], ...ts.map((k) => x.areal[k]), ts.reduce((s, k) => s + x.areal[k], 0), ...ts.map((k) => x.volum[k]), ts.reduce((s, k) => s + x.volum[k], 0), x.tilvekst]); }
  if ((S.markslag || []).length) { const a = arealfordeling(S); r.push([], ['Markslag', 'Figurer', 'Areal daa']); for (const [k, x] of Object.entries(a.rader)) if (x.areal > 0) r.push([MARKSLAG[k].navn, x.antall, x.areal]); r.push(['Sum eiendom', '', a.total]); }
  r.push([], ['Bonitet', ...ts.map((k) => TRESLAG[k])]);
  for (const bo of BONITETER) r.push([bo, ...ts.map((k) => d.perBon[bo][k])]);
  return r;
}

// ---------- 2. Bestandsliste ----------
function bestandRader(S, iAar) {
  const inn = S.innstillinger;
  const sr = (b) => (/^S\d/.test(b.nr) && !b.teig ? 1 : 0);
  return [...S.bestand].sort((a, b) => sr(a) - sr(b) || sortNr(a.teig || '', b.teig || '') || sortNr(a.nr, b.nr)).map((b) => {
    const st = startTilstand(b); const a = b.areal || 0; const tv = arligTilvekstDaa(b) * a;
    const tiltak = (b.tiltak || []).filter((t) => t.status !== 'utfort').sort((x, y) => x.aar - y.aar);
    return { b, teig: b.teig || (String(b.nr).includes('-') ? String(b.nr).split('-')[0] : /^S\d/.test(b.nr) ? 'SR16' : ''), nr: b.nr, areal: a, hk: hkFor(b, inn), treslag: b.treslag, bonitet: b.bonitet, alder: Math.round(st.alder), hoyde: b.hoyde, treantall: b.treantall, volumDaa: st.volumDaa, volum: st.volumDaa * a, tilvekst: tv, tilvekstPst: st.volumDaa * a ? (tv / (st.volumDaa * a)) * 100 : null, tiltak, miljo: b.miljo, merknad: b.merknad || '' };
  });
}
function bestandslisteHtml(S, { iAar }) {
  const rader = bestandRader(S, iAar);
  const teiger = [...new Set(rader.map((r) => r.teig))];
  const sumRad = (liste, tekst) => `<tr class="r-sum"><td colspan="2">${tekst}</td><td class="t">${tall(liste.reduce((s, r) => s + r.areal, 0), 1)}</td><td colspan="6"></td><td class="t">${tall(liste.reduce((s, r) => s + r.volum, 0))}</td><td class="t">${tall(liste.reduce((s, r) => s + r.tilvekst, 0), 1)}</td><td colspan="3"></td></tr>`;
  return `${hode(S, 'Bestandsliste', iAar)}
    <table class="r-bestand"><thead><tr><th>Teig</th><th>Bestand</th><th class="t">Areal daa</th><th>HK</th><th>Treslag</th><th class="t">Bon.</th><th class="t">Alder</th><th class="t">Høyde m</th><th class="t">Trær/daa</th><th class="t">Volum m³</th><th class="t">Tilv. m³/år</th><th class="t">m³/daa</th><th>Tiltak</th><th>Merknad</th></tr></thead>
    <tbody>${teiger.map((t) => { const liste = rader.filter((r) => r.teig === t); return liste.map((r) => `<tr${r.miljo ? ' class="r-miljo"' : ''}><td>${esc(r.teig)}</td><td><b>${esc(r.nr)}</b></td><td class="t">${tall(r.areal, 1)}</td><td>${HK_ROMERTALL[r.hk] || ''}</td><td>${esc(TRESLAG[r.treslag] || '')}</td><td class="t">${r.bonitet ?? ''}</td><td class="t">${r.alder}</td><td class="t">${r.hoyde ? tall(r.hoyde, 1) : ''}</td><td class="t">${r.treantall ?? ''}</td><td class="t">${tall(r.volum)}</td><td class="t">${tall(r.tilvekst, 1)}</td><td class="t">${tall(r.volumDaa, 1)}</td><td>${r.tiltak.map((x) => `${esc(TILTAKSTYPER[x.type]?.navn || x.type)} ${x.aar}`).join('<br>')}</td><td class="r-merk">${r.miljo ? '<b>Miljøfigur.</b> ' : ''}${esc(r.merknad)}</td></tr>`).join('') + (teiger.length > 1 ? sumRad(liste, `${t === 'SR16' ? 'Sum flater fra SR16 uten tidligere bestandsnummer' : `Sum teig ${esc(t)}`} (${liste.length} bestand)`) : ''); }).join('')}</tbody>
    <tfoot>${sumRad(rader, `Sum eiendom (${rader.length} bestand)`)}</tfoot></table>
    ${uproduktivHtml(S)}
    <p class="r-liten">HK = hogstklasse (I skogfornyelse, II ungskog, III yngre produksjonsskog, IV eldre produksjonsskog, V hogstmoden). Bonitet er H40 (overhøyde ved 40 år). Alder og volum er framskrevet til ${iAar}. Grå rader er miljøfigurer.</p>
    ${fot('')}`;
}
function bestandslisteCsv(S, { iAar }) {
  return [['Teig', 'Bestand', 'Areal daa', 'Hogstklasse', 'Treslag', 'Bonitet', 'Alder', 'Middelhøyde m', 'Treantall per daa', 'Volum m3/daa', 'Volum m3', 'Tilvekst m3/år', 'Tilvekst %', 'Miljøfigur', 'Planlagte tiltak', 'Merknad'],
    ...bestandRader(S, iAar).map((r) => [r.teig, r.nr, r.areal, r.hk, TRESLAG[r.treslag] || '', r.bonitet, r.alder, r.hoyde, r.treantall, r.volumDaa, r.volum, r.tilvekst, r.tilvekstPst, r.miljo ? 'Ja' : '', r.tiltak.map((x) => `${TILTAKSTYPER[x.type]?.navn} ${x.aar}`).join(', '), r.merknad]),
    ...((S.markslag || []).length ? [[], ['Uproduktive arealer (AR5)'], ['Figur', 'Markslag', 'Areal daa', 'Treslag', 'Grunnforhold', 'Skogbonitet', 'Kartlagt'], ...S.markslag.map((f) => [f.nr, MARKSLAG[f.kategori].navn, f.areal, f.ar5?.treslag, f.ar5?.grunnforhold, f.ar5?.bonitet, f.ar5?.datafangst])] : [])];
}

// ---------- 3. Hogstprognose ----------
export function hogstprognose(S, { iAar, aar = 30 }) {
  const inn = S.innstillinger;
  const perioder = []; for (let p = 0; p < aar; p += 5) perioder.push({ fra: iAar + p, til: iAar + p + 4, slutt: 0, tynning: 0, netto: 0, kostnad: 0, modent: 0, tilvekst: 0, staaende: 0 });
  const periode = (a) => perioder.find((p) => a >= p.fra && a <= p.til);
  // Planlagt hogst: volum framskrevet til hogståret (uten andre tiltak).
  const hogst = [];
  for (const b of S.bestand) for (const t of b.tiltak || []) {
    if (t.status === 'utfort' || t.aar < iAar || t.aar >= iAar + aar) continue;
    const p = periode(t.aar); if (!p) continue;
    if (HOGSTTYPER.includes(t.type)) {
      const fr = framskriv([b], t.aar - iAar, inn, { folgPlan: false }).perBestand.get(b.id).at(-1);
      const m3 = fr.volumDaa * (b.areal || 0) * hogstAndel(t.type, inn, t);
      const netto = m3 * hogstNettoPerM3(t.type, b.treslag, inn);
      hogst.push({ aar: t.aar, b, type: t.type, m3, netto, alder: fr.alder });
      p[t.type === 'tynning' ? 'tynning' : 'slutt'] += m3; p.netto += netto;
    } else { const k = tiltakKostnad(t.type, b.areal || 0, inn); p.kostnad += k; p.netto -= k; }
  }
  // Hogstmodent volum etter alder: bestand som når laveste hogstalder i perioden (eller er hogstmodne nå), uten planlagt hogst.
  const potensial = [];
  for (const b of S.bestand) {
    if (b.miljo || (b.tiltak || []).some((t) => ['sluttavvirkning', 'lukkethogst'].includes(t.type) && t.status !== 'utfort')) continue;
    const st = startTilstand(b); const min = laavesteHogstalder(b, inn); if (!min || !st.volumDaa && st.alder < 1) continue;
    const om = Math.max(0, Math.ceil(min - st.alder));
    if (om >= aar) continue;
    const fr = framskriv([b], om, inn, { folgPlan: false }).perBestand.get(b.id).at(-1);
    const m3 = fr.volumDaa * (b.areal || 0);
    if (m3 < 1) continue;
    periode(iAar + om).modent += m3;
    potensial.push({ aar: iAar + om, b, m3, netto: m3 * rotnettoPerM3(b.treslag, inn), alder: fr.alder, naa: om === 0 });
  }
  const fr = framskriv(S.bestand, aar, inn, { folgPlan: true, startAar: iAar }).aarRader;
  for (const p of perioder) { const r = fr.filter((x) => x.aar >= p.fra && x.aar <= p.til); p.tilvekst = r.reduce((s, x) => s + x.tilvekst, 0); p.staaende = r[0]?.staaende ?? 0; p.staaendeSlutt = (fr.find((x) => x.aar === p.til + 1) || fr.at(-1)).staaende; }
  return { perioder, hogst: hogst.sort((a, b) => a.aar - b.aar), potensial: potensial.sort((a, b) => a.aar - b.aar || b.m3 - a.m3), aar };
}
function hogstprognoseHtml(S, { iAar, aar = 30 }) {
  const h = hogstprognose(S, { iAar, aar });
  const sum = (f) => h.perioder.reduce((s, p) => s + p[f], 0);
  const tilv = sum('tilvekst');
  return `${hode(S, `Hogstprognose ${iAar}–${iAar + aar - 1}`, iAar)}
    <section class="r-kpier">
      <div class="r-kpi"><b>${tall(sum('slutt') + sum('tynning'))} m³</b><span>planlagt avvirkning, ${aar} år</span></div>
      <div class="r-kpi"><b>${tall(sum('netto'))} kr</b><span>netto av planlagte tiltak</span></div>
      <div class="r-kpi"><b>${tall(sum('modent'))} m³</b><span>hogstmodent volum uten plan</span></div>
      <div class="r-kpi"><b>${tall(tilv / aar)} m³/år</b><span>tilvekst i snitt (bærekraftig nivå)</span></div>
    </section>
    <h2>Volum per femårsperiode</h2>
    ${svgSoyler(h.perioder.map((p) => ({ navn: `${p.fra}–${String(p.til).slice(2)}`, verdier: { slutt: p.slutt, tynning: p.tynning, modent: p.modent } })), [{ key: 'slutt', navn: 'Planlagt sluttavvirkning og lukket hogst', farge: '#c0392b' }, { key: 'tynning', navn: 'Planlagt tynning', farge: '#e67e22' }, { key: 'modent', navn: 'Hogstmodent uten plan', farge: '#c9b79c' }], { enhet: 'm³' })}
    <table><thead><tr><th>Periode</th><th class="t">Sluttavv./lukket m³</th><th class="t">Tynning m³</th><th class="t">Netto hogst og kultur kr</th><th class="t">Hogstmodent uten plan m³</th><th class="t">Tilvekst m³</th><th class="t">Stående ved start m³</th></tr></thead><tbody>
    ${h.perioder.map((p) => `<tr><td>${p.fra}–${p.til}</td><td class="t">${tall(p.slutt)}</td><td class="t">${tall(p.tynning)}</td><td class="t">${tall(p.netto)}</td><td class="t">${tall(p.modent)}</td><td class="t">${tall(p.tilvekst)}</td><td class="t">${tall(p.staaende)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td>Sum</td><td class="t">${tall(sum('slutt'))}</td><td class="t">${tall(sum('tynning'))}</td><td class="t">${tall(sum('netto'))}</td><td class="t">${tall(sum('modent'))}</td><td class="t">${tall(tilv)}</td><td class="t">${tall(h.perioder.at(-1)?.staaendeSlutt)}</td></tr></tfoot></table>
    <p class="r-liten">Siste kolonne i summeringsraden er stående volum ved slutten av perioden når planen følges. Samlet avvirkning bør over tid ikke overstige tilveksten.</p>
    <h2>Planlagt hogst</h2>
    ${h.hogst.length ? `<table><thead><tr><th>År</th><th>Bestand</th><th>Tiltak</th><th>Treslag</th><th class="t">Bon.</th><th class="t">Alder</th><th class="t">Areal daa</th><th class="t">Volum m³</th><th class="t">Netto kr</th></tr></thead><tbody>
      ${h.hogst.map((x) => `<tr><td>${x.aar}</td><td>${esc(x.b.nr)}</td><td>${esc(TILTAKSTYPER[x.type].navn)}</td><td>${esc(TRESLAG[x.b.treslag] || '')}</td><td class="t">${x.b.bonitet ?? ''}</td><td class="t">${x.alder}</td><td class="t">${tall(x.b.areal, 1)}</td><td class="t">${tall(x.m3)}</td><td class="t">${tall(x.netto)}</td></tr>`).join('')}</tbody></table>` : '<p>Ingen hogst er planlagt. Bruk «Foreslå tiltak» i Tiltak-fanen for å lage en hogstplan.</p>'}
    <h2>Hogstmodne bestand uten planlagt hogst</h2>
    ${h.potensial.length ? `<table><thead><tr><th>Hogstmoden</th><th>Bestand</th><th>Treslag</th><th class="t">Bon.</th><th class="t">Alder</th><th class="t">Areal daa</th><th class="t">Volum m³</th><th class="t">Rotnetto kr</th></tr></thead><tbody>
      ${h.potensial.map((x) => `<tr><td>${x.naa ? 'Nå' : x.aar}</td><td>${esc(x.b.nr)}</td><td>${esc(TRESLAG[x.b.treslag] || '')}</td><td class="t">${x.b.bonitet ?? ''}</td><td class="t">${x.alder}</td><td class="t">${tall(x.b.areal, 1)}</td><td class="t">${tall(x.m3)}</td><td class="t">${tall(x.netto)}</td></tr>`).join('')}</tbody></table>` : '<p>Ingen bestand blir hogstmodne i perioden uten at hogst allerede er planlagt.</p>'}
    <p class="r-liten">Hogstmoden = alder ≥ laveste hogstalder etter PEFC-tabellen for bonitet og treslag. Volum er framskrevet med vekstmodellen til hogståret; netto er rotnetto med dagens priser og driftskostnader (tynning med egen driftskostnad og uttak ${tall((S.innstillinger.tynningUttak || 0) * 100)} %). Miljøfigurer er holdt utenfor.</p>
    ${fot('')}`;
}
function hogstprognoseCsv(S, { iAar, aar = 30 }) {
  const h = hogstprognose(S, { iAar, aar });
  return [['Periode', 'Sluttavvirkning m3', 'Tynning m3', 'Netto kr', 'Hogstmodent uten plan m3', 'Tilvekst m3', 'Stående ved start m3'], ...h.perioder.map((p) => [`${p.fra}-${p.til}`, p.slutt, p.tynning, p.netto, p.modent, p.tilvekst, p.staaende]),
    [], ['Planlagt hogst'], ['År', 'Bestand', 'Tiltak', 'Treslag', 'Bonitet', 'Alder', 'Areal daa', 'Volum m3', 'Netto kr'], ...h.hogst.map((x) => [x.aar, x.b.nr, TILTAKSTYPER[x.type].navn, TRESLAG[x.b.treslag], x.b.bonitet, x.alder, x.b.areal, x.m3, x.netto]),
    [], ['Hogstmodne uten plan'], ['År', 'Bestand', 'Treslag', 'Bonitet', 'Alder', 'Areal daa', 'Volum m3', 'Rotnetto kr'], ...h.potensial.map((x) => [x.aar, x.b.nr, TRESLAG[x.b.treslag], x.b.bonitet, x.alder, x.b.areal, x.m3, x.netto])];
}

// ---------- 4. PEFC ----------
const PSTATUS = { avvik: ['Avvik', '#c0392b'], varsel: ['Må følges opp', '#d68910'], ok: ['Ivaretatt', '#1e8449'], 'ikke-relevant': ['Ikke relevant', '#7f8c8d'], 'ikke-vurdert': ['Ikke vurdert', '#95a5a6'], info: ['Info', '#2e86c1'] };
function pefcHtml(S, { iAar, pefc }) {
  if (!pefc) return `${hode(S, 'PEFC-rapport', iAar)}<p>PEFC-data er ikke tilgjengelig. Åpne PEFC-fanen først.</p>`;
  const { funn, status, P } = pefc;
  const teller = {}; for (const k of KRAVPUNKTER) { const st = status[k.nr]?.status || 'ikke-vurdert'; teller[st] = (teller[st] || 0) + 1; }
  // Like funn for flere bestand (samme krav og beskrivelse) slås sammen til én rad.
  const grupper = new Map();
  for (const f of funn.filter((x) => x.nivaa === 'avvik' || x.nivaa === 'varsel')) {
    const k = `${f.krav}|${f.nivaa}|${f.tekst}`;
    if (!grupper.has(k)) grupper.set(k, { ...f, bestand: [] });
    const g = grupper.get(k); const b = f.bestandId && S.bestand.find((x) => x.id === f.bestandId);
    if (b) g.bestand.push(b.nr);
  }
  const aktuelle = [...grupper.values()].map((g) => (g.bestand.length > 1 ? { ...g, tittel: `${g.tittel.replace(/\s*\(?(i )?bestand [\w-]+\)?/i, '').trim()} – ${g.bestand.length} bestand: ${g.bestand.sort(sortNr).join(', ')}` } : g))
    .sort((a, b) => (a.nivaa === 'avvik' ? 0 : 1) - (b.nivaa === 'avvik' ? 0 : 1) || a.krav - b.krav);
  const obj = P.objekter || [];
  const perType = {}; for (const o of obj) { const t = OBJEKTTYPER[o.type]?.navn || o.type; perType[t] = perType[t] || { n: 0, daa: 0 }; perType[t].n++; if (o.geometri && /Polygon/.test(o.geometri.type)) perType[t].daa += arealDaa(o.geometri); }
  const kilder = Object.values(S.datakilder || {});
  const hogst = S.bestand.flatMap((b) => (b.tiltak || []).filter((t) => HOGSTTYPER.includes(t.type) && t.status !== 'utfort').map((t) => ({ b, t }))).sort((a, b) => a.t.aar - b.t.aar);
  const pille = (st) => `<span class="r-pille" style="--f:${PSTATUS[st]?.[1] || '#999'}">${PSTATUS[st]?.[0] || st}</span>`;
  return `${hode(S, 'PEFC-rapport – Norsk PEFC Skogstandard', iAar)}
    <p class="r-liten">Kontroll mot Norsk PEFC Skogstandard (PEFC N 02:2022), gjeldende fra 1. mars 2023. Automatiske kontroller er gjort med planens data og offentlige miljødata; øvrige punkter er dokumentert manuelt av skogeier.</p>
    <section class="r-kpier">${['avvik', 'varsel', 'ok', 'ikke-vurdert', 'ikke-relevant'].map((k) => `<div class="r-kpi" style="border-top:4px solid ${PSTATUS[k][1]}"><b>${teller[k] || 0}</b><span>${PSTATUS[k][0]}</span></div>`).join('')}</section>
    <h2>Avvik og oppfølging (${aktuelle.length})</h2>
    ${aktuelle.length ? `<table><thead><tr><th>Krav</th><th>Status</th><th>Funn</th><th>Beskrivelse</th></tr></thead><tbody>${aktuelle.map((f) => `<tr><td>K${f.krav}</td><td>${pille(f.nivaa)}</td><td>${esc(f.tittel)}</td><td class="r-merk">${esc(f.tekst)}</td></tr>`).join('')}</tbody></table>` : '<p>Ingen avvik eller oppfølgingspunkter.</p>'}
    <h2>Status per kravpunkt</h2>
    ${TEMA.map((tema, ti) => `<h3>${esc(tema)}</h3><table><thead><tr><th style="width:36px">Nr</th><th>Kravpunkt</th><th style="width:110px">Status</th><th>Dokumentasjon</th></tr></thead><tbody>
      ${KRAVPUNKTER.filter((k) => k.tema === ti).map((k) => { const st = status[k.nr] || {}; const m = P.kravstatus?.[k.nr] || {}; return `<tr><td>${k.nr}</td><td>${esc(k.tittel)}</td><td>${pille(st.status || 'ikke-vurdert')}</td><td class="r-merk">${esc(m.notat || '')}${m.dato ? ` <i>(${esc(m.dato)})</i>` : ''}</td></tr>`; }).join('')}</tbody></table>`).join('')}
    <div class="r-brudd"></div>
    <h2>Miljøobjekter (${obj.length})</h2>
    ${svgKart(S, (b) => (b.miljo ? '#b9d7a8' : '#f4f4f0'), { hoyde: 380, etiketter: false, ekstra: obj.filter((o) => o.geometri).map((o) => ({ geometri: o.geometri, farge: OBJEKTTYPER[o.type]?.farge || '#555' })) })}
    ${tegnforklaring([...new Set(obj.map((o) => o.type))].filter((t) => OBJEKTTYPER[t]).map((t) => [OBJEKTTYPER[t].farge, OBJEKTTYPER[t].navn]))}
    ${obj.length ? `<table><thead><tr><th>Type</th><th class="t">Antall</th><th class="t">Areal daa</th></tr></thead><tbody>${Object.entries(perType).sort((a, b) => b[1].n - a[1].n).map(([t, x]) => `<tr><td>${esc(t)}</td><td class="t">${x.n}</td><td class="t">${x.daa ? tall(x.daa, 1) : ''}</td></tr>`).join('')}</tbody></table>
      <table><thead><tr><th>Type</th><th>Navn</th><th>Kilde</th><th>Registrert</th></tr></thead><tbody>${obj.map((o) => `<tr><td>${esc(OBJEKTTYPER[o.type]?.navn || o.type)}</td><td>${esc(o.navn || '')}</td><td>${o.kilde === 'offentlig' ? 'Offentlig data' : 'Egen registrering'}</td><td>${esc(o.registrert || '')}</td></tr>`).join('')}</tbody></table>` : '<p>Ingen miljøobjekter registrert.</p>'}
    <h2>Klarering før hogst</h2>
    ${hogst.length ? `<table><thead><tr><th>År</th><th>Bestand</th><th>Tiltak</th><th>Status</th><th class="t">Sjekkpunkter</th><th>Hogstform</th><th>Foryngelse</th></tr></thead><tbody>${hogst.map(({ b, t }) => { const st = klareringStatus(t, b, funn, P); const k = st.k || {}; const ant = KLARERING.filter((x) => (k.sjekk || {})[x.id]).length; return `<tr><td>${t.aar}</td><td>${esc(b.nr)}</td><td>${esc(TILTAKSTYPER[t.type].navn)}</td><td>${st.klar ? pille('ok') : st.avvik ? pille('avvik') : pille('varsel')}</td><td class="t">${ant}/${KLARERING.length}</td><td>${esc(HOGSTFORMER[k.hogstform]?.navn || HOGSTFORMER[k.hogstform] || k.hogstform || '–')}</td><td>${esc(FORYNGELSE[k.foryngelse]?.navn || FORYNGELSE[k.foryngelse] || k.foryngelse || '–')}</td></tr>`; }).join('')}</tbody></table>` : '<p>Ingen planlagt hogst.</p>'}
    <h2>Datagrunnlag</h2>
    ${kilder.length ? `<table><thead><tr><th>Kilde</th><th>Eier</th><th>Hentet</th><th>Data fra</th><th class="t">Objekter</th></tr></thead><tbody>${kilder.map((k) => `<tr><td>${esc(k.navn)}</td><td>${esc(k.eier)}</td><td>${k.hentet ? new Date(k.hentet).toLocaleDateString('nb-NO') : '–'}${k.feil ? ' (feil)' : ''}</td><td>${esc(k.dataFra || '')}${k.dataTil && k.dataTil !== k.dataFra ? `–${esc(k.dataTil)}` : ''}</td><td class="t">${k.antall ?? ''}</td></tr>`).join('')}</tbody></table>` : '<p>Datagrunnlaget er ikke hentet.</p>'}
    <h2>Eiendom</h2>
    <table><tbody>
      <tr><td>Miljøregistrering (MiS) utført</td><td>${esc(P.eiendom?.miljoregistreringAar || '–')}</td></tr>
      <tr><td>Skogbruksplan / takstår</td><td>${esc(S.eiendom?.takstAar || '–')}</td></tr>
      <tr><td>Irreversibelt omdisponert areal etter 14.02.2016</td><td>${P.eiendom?.omdisponertDaa != null ? `${tall(P.eiendom.omdisponertDaa, 1)} daa` : '–'}</td></tr>
      <tr><td>Landskapsplan sist revidert</td><td>${esc(P.eiendom?.landskapsplanAar || '–')}</td></tr></tbody></table>
    <div class="r-signatur"><div>Sted og dato</div><div>Skogeier</div></div>
    ${fot('')}`;
}
function pefcCsv(S, { pefc }) {
  if (!pefc) return [['PEFC-data mangler']];
  const { funn, status, P } = pefc;
  return [['Nr', 'Tema', 'Kravpunkt', 'Status', 'Dokumentasjon'], ...KRAVPUNKTER.map((k) => [k.nr, TEMA[k.tema], k.tittel, PSTATUS[status[k.nr]?.status]?.[0] || '', P.kravstatus?.[k.nr]?.notat || '']),
    [], ['Funn'], ['Krav', 'Status', 'Tittel', 'Beskrivelse'], ...funn.filter((f) => f.nivaa !== 'ok').map((f) => [`K${f.krav}`, PSTATUS[f.nivaa]?.[0] || f.nivaa, f.tittel, f.tekst]),
    [], ['Miljøobjekter'], ['Type', 'Navn', 'Kilde', 'Registrert'], ...(P.objekter || []).map((o) => [OBJEKTTYPER[o.type]?.navn || o.type, o.navn || '', o.kilde, o.registrert || ''])];
}

// ---------- felles ----------
const CSS = `
@page { size: A4 portrait; margin: 14mm 13mm 16mm; }
@page liggende { size: A4 landscape; margin: 11mm 10mm 13mm; }
* { box-sizing: border-box; }
body { font: 9.5pt/1.4 "Schibsted Grotesk", "Segoe UI", system-ui, sans-serif; color: #1b1c19; margin: 0; padding: 18px; background: #fff; }
body.liggende { page: liggende; }
.r-hode { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1f6b4a; padding-bottom: 8px; margin-bottom: 12px; }
.r-merke { font: 800 10pt "Bricolage Grotesque", system-ui, sans-serif; color: #1f6b4a; letter-spacing: -.02em; } .r-merke span { color: #d03b3b; }
h1 { font: 800 19pt/1.15 "Bricolage Grotesque", system-ui, sans-serif; margin: 2px 0 2px; letter-spacing: -.02em; }
.r-eiendom { color: #444; } .r-meta { text-align: right; color: #555; font-size: 8.5pt; }
h2 { font: 700 12pt "Bricolage Grotesque", system-ui, sans-serif; margin: 16px 0 6px; color: #1f4d38; break-after: avoid; }
h3 { font-size: 10pt; margin: 10px 0 4px; break-after: avoid; }
table { width: 100%; border-collapse: collapse; margin: 4px 0 8px; font-variant-numeric: tabular-nums; }
th { text-align: left; font-weight: 600; font-size: 8pt; text-transform: uppercase; letter-spacing: .03em; color: #555; border-bottom: 1.5px solid #1b1c19; padding: 4px 5px; }
td { padding: 3px 5px; border-bottom: .5px solid #ddd; vertical-align: top; }
tr { break-inside: avoid; } thead { display: table-header-group; }
.t { text-align: right; white-space: nowrap; }
tfoot td, .r-sum td { font-weight: 700; border-top: 1px solid #1b1c19; border-bottom: none; background: #f4f6f2; }
.r-kpier { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 6px; margin: 8px 0 4px; }
.r-kpi { border: 1px solid #ddd; border-radius: 6px; padding: 6px 8px; } .r-kpi b { display: block; font: 800 13pt "Bricolage Grotesque", system-ui, sans-serif; } .r-kpi span { color: #555; font-size: 8pt; }
.r-kart { width: 100%; height: auto; border: 1px solid #ddd; border-radius: 6px; } .r-knr { font: 600 7px system-ui, sans-serif; text-anchor: middle; dominant-baseline: middle; paint-order: stroke; stroke: #fff; stroke-width: 2px; fill: #1b1c19; }
.r-skala { font: 9px system-ui, sans-serif; fill: #333; } .r-diagram { width: 100%; height: auto; margin: 4px 0; }
.r-tegn { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 4px 0 8px; font-size: 8.5pt; } .r-tegn i { display: inline-block; width: 11px; height: 11px; border: 1px solid #333; margin-right: 5px; vertical-align: -1px; }
.r-liten { font-size: 8pt; color: #555; } .r-merk { font-size: 8pt; color: #333; }
.r-bestand { font-size: 8pt; } .r-bestand td, .r-bestand th { padding: 2px 4px; } .r-miljo td { background: #f0f0ec; }
.r-pille { display: inline-block; padding: 0 6px; border-radius: 99px; border: 1px solid var(--f); color: var(--f); font-size: 7.5pt; font-weight: 600; white-space: nowrap; }
.r-brudd { break-after: page; }
.r-signatur { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; } .r-signatur div { border-top: 1px solid #1b1c19; padding-top: 4px; font-size: 8.5pt; color: #555; }
.r-fot { margin-top: 18px; padding-top: 6px; border-top: 1px solid #ddd; font-size: 7.5pt; color: #777; }
@media screen { body { max-width: 900px; margin: 0 auto; } body.liggende { max-width: 1250px; } .r-brudd { border-top: 1px dashed #ccc; margin: 18px 0; } }
`;

export function lagRapport(type, S, { iAar = new Date().getFullYear(), pefc = null, verdi = null, aar = 30 } = {}) {
  const r = type === 'alle' ? { navn: 'Skogbruksplan – alle rapporter' } : RAPPORTER[type];
  const en = (t) => (t === 'hovedtall' ? hovedtallHtml(S, { iAar, verdi }) : t === 'bestandsliste' ? bestandslisteHtml(S, { iAar }) : t === 'hogstprognose' ? hogstprognoseHtml(S, { iAar, aar }) : pefcHtml(S, { iAar, pefc }));
  const kropp = type === 'alle' ? Object.keys(RAPPORTER).map(en).join('<div class="r-brudd"></div>') : en(type);
  return `<!doctype html><html lang="nb"><head><meta charset="utf-8"><title>${esc(r.navn)} – ${esc(S.eiendom?.navn || 'skogbruksplan')}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;800&family=Schibsted+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">
    <style>${CSS}</style></head><body class="${r.liggende ? 'liggende' : ''}">${kropp}</body></html>`;
}
export function lagRapportCsv(type, S, opts = {}) {
  const o = { iAar: new Date().getFullYear(), ...opts };
  const rader = type === 'hovedtall' ? hovedtallCsv(S, o) : type === 'bestandsliste' ? bestandslisteCsv(S, o) : type === 'hogstprognose' ? hogstprognoseCsv(S, o) : pefcCsv(S, o);
  return csv(rader);
}
