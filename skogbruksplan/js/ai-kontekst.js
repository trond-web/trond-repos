// Lager en kompakt tekstversjon av skogbruksplanen som AI-assistenten får som grunnlag. Ingen DOM.
import {
  TRESLAG, HK_NAVN, TILTAKSTYPER, startTilstand, arligTilvekstDaa, laavesteHogstalder, beregnetHogstklasse,
  rotnettoPerM3, sammendrag, framskriv,
} from './model.js';
import { KRAVPUNKTER, OBJEKTTYPER } from './pefc.js';
import { VEIKLASSER } from './veier.js';

const r1 = (v) => (v == null || Number.isNaN(v) ? '' : Math.round(v * 10) / 10);
const r0 = (v) => (v == null || Number.isNaN(v) ? '' : Math.round(v));
const csv = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export function lagKontekst(S, { iAar = new Date().getFullYear(), pefcFunn = [], verdi = null } = {}) {
  const inn = S.innstillinger;
  const e = S.eiendom || {};
  const s = sammendrag(S.bestand, inn);
  const d = [];
  d.push(`# Skogbruksplan: ${e.navn || 'uten navn'}`);
  d.push(`Kommune: ${e.kommune || '–'}${e.kommunenr ? ` (${e.kommunenr})` : ''}. Gnr/bnr: ${e.gnrbnr || '–'}. Eier: ${e.eier || '–'}. Takstår: ${e.takstAar || '–'}. Dagens år: ${iAar}.`);
  if (S.metadata) {
    const m = S.metadata;
    d.push(`Generert fra åpne data ${m.laget ? m.laget.slice(0, 10) : ''}: eiendom ${r0(m.eiendomDaa)} daa, skog ${r0(m.skogDaa)} daa, ${m.antallFraPlan || 0} bestand fra tidligere plan (registrert ${m.planRegistrert || '–'}), SR16 målt ${m.sr16Aar || '–'}.`);
  }
  d.push('');
  d.push('## Sammendrag');
  d.push(`Produktivt areal ${r1(s.areal)} daa i ${s.antall} bestand. Stående volum ${r0(s.volum)} m³ (${r1(s.areal ? s.volum / s.areal : 0)} m³/daa). Tilvekst ca. ${r0(s.tilvekst)} m³/år. CO₂-binding ca. ${r0(s.co2)} t/år. Rotnetto i hogstklasse V ca. ${r0(s.verdiHogstmoden)} kr.`);
  d.push(`Volum per treslag: ${Object.entries(s.perTreslag).map(([k, v]) => `${TRESLAG[k]} ${r0(v)} m³`).join(', ')}.`);
  d.push(`Areal per hogstklasse (daa): ${Object.entries(s.perHk).map(([h, v]) => `${HK_NAVN[h]} ${r1(v.G + v.F + v.L)}`).join(', ')}.`);
  d.push('');
  d.push('## Priser og forutsetninger');
  d.push(`Tømmerpris kr/m³: ${Object.entries(TRESLAG).map(([k, n]) => `${n} ${inn.pris[k]}`).join(', ')}. Driftskostnad kr/m³: ${Object.entries(TRESLAG).map(([k, n]) => `${n} ${inn.drift[k]}`).join(', ')}. Rotnetto kr/m³: ${Object.keys(TRESLAG).map((k) => `${TRESLAG[k]} ${r0(rotnettoPerM3(k, inn))}`).join(', ')}.`);
  d.push(`Kulturkostnader kr/daa: ${Object.entries(inn.kostPerDaa || {}).map(([k, v]) => `${TILTAKSTYPER[k]?.navn || k} ${v}`).join(', ')}. Skogfond ${inn.skogfondProsent} %.`);
  d.push('');
  d.push('## Bestand (semikolonseparert)');
  d.push('nr;teig;areal_daa;treslag;bonitet_H40;hogstklasse;alder;volum_m3_per_daa;volum_m3;tilvekst_m3_aar;laveste_hogstalder;hogstmoden_aar;rotnetto_nå_kr;miljøfigur;planlagte_tiltak;utførte_tiltak;merknad');
  for (const b of S.bestand) {
    const st = startTilstand(b);
    const min = laavesteHogstalder(b, inn);
    const hk = b.hogstklasse || beregnetHogstklasse(st.alder, min, st.volumDaa);
    const a = b.areal || 0;
    const planl = (b.tiltak || []).filter((t) => t.status !== 'utfort').map((t) => `${TILTAKSTYPER[t.type]?.navn || t.type} ${t.aar}`).join(' + ');
    const utf = (b.tiltak || []).filter((t) => t.status === 'utfort').map((t) => `${TILTAKSTYPER[t.type]?.navn || t.type} ${t.aar}`).join(' + ');
    d.push([b.nr, b.teig, r1(a), TRESLAG[b.treslag] || '', b.bonitet ?? '', hk || '', r0(st.alder), r1(st.volumDaa), r0(st.volumDaa * a), r1(arligTilvekstDaa(b) * a), min ?? '',
      min ? iAar + Math.max(0, Math.ceil(min - st.alder)) : '', r0(st.volumDaa * a * rotnettoPerM3(b.treslag, inn)), b.miljo ? 'ja' : '', planl, utf, b.merknad].map(csv).join(';'));
  }
  d.push('');
  const fr = framskriv(S.bestand, 20, inn, { folgPlan: true, startAar: iAar }).aarRader;
  d.push('## Framskriving 20 år (følger planlagte tiltak)');
  d.push('år;stående_m3;tilvekst_m3;avvirkning_m3;inntekt_kr;kostnad_kr');
  fr.filter((_, i) => i % 5 === 0 || i === fr.length - 1).forEach((x) => d.push([x.aar, r0(x.staaende), r0(x.tilvekst), r0(x.avvirkning), r0(x.inntekt), r0(x.kostnad)].join(';')));
  d.push('');
  if (verdi) {
    const v = verdi;
    d.push(`## Verdiberegning (rente ${S.verdi?.rente ?? 3} %, reelle verdier før skatt)`);
    d.push(`Eiendomsverdi ${r0(v.eiendom)} kr. Skogverdi (forventningsverdi) ${r0(v.skog)} kr. Slaktverdi ${r0(v.slakt)} kr (hogstklasse V: ${r0(v.hogstmodenSlakt)} kr). Jordverdi ${r0(v.jord)} kr. Nåverdi av tiltaksplanen ${r0(v.plan)} kr. Kapitaliserte andre inntekter/kostnader ${r0(v.kapitalisert)} kr.`);
    d.push(`Optimalt hogstår per bestand: ${v.rader.filter((x) => x.hogstAar).map((x) => `${x.nr} ${x.hogstAar}`).join(', ')}.`);
    d.push('');
  }
  const veier = S.veier?.veier || [];
  if (veier.length) {
    d.push('## Veier');
    for (const v of veier) d.push(`- ${v.navn || 'Vei'}: ${VEIKLASSER[v.klasse]?.navn || 'ukjent klasse'}, ${v.status || ''}, ${r0(v.lengde)} m, tilstand ${v.tilstand || 'ukjent'}`);
    const vedl = (S.veier.vedlikehold || []).filter((l) => l.status === 'planlagt');
    if (vedl.length) d.push(`Planlagt vedlikehold: ${vedl.map((l) => `${l.type} ${l.aar} (${r0(l.kostnad)} kr)`).join(', ')}`);
    d.push('');
  }
  const obj = S.pefc?.objekter || [];
  if (obj.length || pefcFunn.length) {
    d.push('## PEFC skogstandard');
    if (obj.length) d.push(`Miljøobjekter: ${obj.map((o) => `${OBJEKTTYPER[o.type]?.navn || o.type}${o.navn ? ` «${o.navn}»` : ''}${o.kilde === 'offentlig' ? ' (offentlig data)' : ''}`).join('; ')}.`);
    const viktige = pefcFunn.filter((f) => f.nivaa === 'avvik' || f.nivaa === 'varsel');
    for (const f of viktige.slice(0, 40)) d.push(`- [${f.nivaa}] K${f.krav} ${KRAVPUNKTER.find((k) => k.nr === f.krav)?.tittel || ''}: ${f.tittel}. ${f.tekst}`);
    d.push('');
  }
  const kilder = Object.values(S.datakilder || {});
  if (kilder.length) {
    d.push('## Datakilder (sist hentet)');
    for (const k of kilder) d.push(`- ${k.navn} (${k.eier}): hentet ${k.hentet ? k.hentet.slice(0, 10) : '–'}${k.dataFra ? `, data ${k.dataFra}${k.dataTil && k.dataTil !== k.dataFra ? `–${k.dataTil}` : ''}` : ''}${k.feil ? ', FEIL' : ''}`);
    d.push('');
  }
  const reg = S.registreringer || [];
  if (reg.length) {
    d.push('## Feltregistreringer');
    for (const r of reg.slice(-50)) d.push(`- ${r.dato ? String(r.dato).slice(0, 10) : ''} ${r.type || ''}: ${r.tekst || r.notat || ''}`);
  }
  return d.join('\n');
}
