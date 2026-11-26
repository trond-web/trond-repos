// Feltoppdrag – felles logikk for SkogIQ Entreprenør (entreprenor.html) og oppdraget på web: rapporten
// entreprenøren fyller ut i felt (framdrift og mengde per bestand, miljøsjekk, avvik med bilde og posisjon,
// sluttrapport med signatur), hva som mangler før ferdigmelding, og hvordan rapporten tas inn i planen.
// Ingen DOM – kan testes i Node. Serveren: feltoppdrag.js.
import { typeFor, linjer } from './oppdrag.js';

export const HOGST = ['sluttavvirkning', 'tynning', 'lukkethogst'];
export const STOTTEDE = [...HOGST, 'planting', 'suppleringsplanting', 'markberedning', 'ungskogpleie', 'gjodsling'];
export const STATUS = { sendt: { navn: 'Sendt', farge: '#2a78d6' }, mottatt: { navn: 'Mottatt', farge: '#2a78d6' }, pagar: { navn: 'Pågår', farge: '#fab219' }, ferdigmeldt: { navn: 'Ferdigmeldt', farge: '#0ca30c' }, godkjent: { navn: 'Godkjent', farge: '#1f6b4a' }, trukket: { navn: 'Trukket', farge: '#8a8a85' } };
// Hva som måles per oppdragstype (utover areal).
export const MENGDE = {
  sluttavvirkning: { navn: 'Hogd volum', enhet: 'm³' }, tynning: { navn: 'Tynnet volum', enhet: 'm³' }, lukkethogst: { navn: 'Hogd volum', enhet: 'm³' },
  planting: { navn: 'Planter satt ut', enhet: 'stk' }, suppleringsplanting: { navn: 'Planter satt ut', enhet: 'stk' },
  markberedning: null, ungskogpleie: { navn: 'Trær igjen per daa', enhet: 'per daa' }, gjodsling: { navn: 'Gjødsel spredd', enhet: 'kg' },
};
// Avvik som kan registreres i felt (erstatter avviksskjema på papir/PDF).
export const AVVIK = {
  kjoreskade: { navn: 'Kjøreskade / spor', ikon: '🛞', pefc: 14 },
  miljo: { navn: 'Nøkkelbiotop eller miljøfigur berørt', ikon: '🦋', pefc: 22 },
  kulturminne: { navn: 'Kulturminne berørt', ikon: '🏛', pefc: 30 },
  vann: { navn: 'Kantsone, bekk eller myr berørt', ikon: '💧', pefc: 27 },
  forurensning: { navn: 'Olje- eller drivstoffsøl', ikon: '🛢' },
  livslop: { navn: 'Livsløps- eller gjensettingstrær', ikon: '🌳', pefc: 13 },
  friluft: { navn: 'Sti, løype eller friluftsliv berørt', ikon: '🥾', pefc: 6 },
  skade: { navn: 'Skade på gjenstående trær', ikon: '🪵' },
  grense: { navn: 'Grense eller nabo', ikon: '📍' },
  annet: { navn: 'Annet', ikon: '⚠️' },
};
const idag = () => new Date().toISOString().slice(0, 10);

// Tom rapport for oppdraget: én linje per tiltak (nøkkel = tiltak-id).
export function nyRapport(S, o) {
  return { linjer: Object.fromEntries(linjer(S, o).map(({ tiltak: t }) => [t.id, { status: 'ikke', start: '', ferdig: '', areal: null, mengde: null, merknad: '' }])), miljo: {}, avvik: [], slutt: null, timer: null };
}
// Fyller inn linjer som mangler (tiltak lagt til etter at rapporten ble laget).
export function sikreRapport(S, o, r) {
  const ny = nyRapport(S, o); if (!r) return ny;
  return { ...ny, ...r, linjer: { ...ny.linjer, ...(r.linjer || {}) }, miljo: r.miljo || {}, avvik: r.avvik || [] };
}

// Miljøsjekken: punktene i oppdragstypens sjekkliste (PEFC), med skogeierens svar fra web og entreprenørens i felt.
export function miljoPunkter(o, r = null) {
  return (typeFor(o.type).sjekk || []).map((k) => ({ ...k, web: !!o.sjekk?.[k.id], felt: r?.miljo?.[k.id] || null }));
}

// Framdrift: antall bestand ferdig, areal og mengde.
export function framdrift(S, o, r) {
  const ls = linjer(S, o); const rl = r?.linjer || {};
  const ferdig = ls.filter(({ tiltak: t }) => rl[t.id]?.status === 'ferdig').length;
  const pagar = ls.filter(({ tiltak: t }) => rl[t.id]?.status === 'pagar').length;
  const areal = ls.reduce((s, { tiltak: t, bestand: b }) => s + (rl[t.id]?.status === 'ferdig' ? (rl[t.id].areal ?? t.arealDaa ?? b.areal ?? 0) : 0), 0);
  const planAreal = ls.reduce((s, { tiltak: t, bestand: b }) => s + (t.arealDaa ?? b.areal ?? 0), 0);
  const mengde = ls.reduce((s, { tiltak: t }) => s + (rl[t.id]?.mengde || 0), 0);
  return { totalt: ls.length, ferdig, pagar, areal: Math.round(areal * 10) / 10, planAreal: Math.round(planAreal * 10) / 10, mengde, andel: ls.length ? ferdig / ls.length : 0 };
}

// Hva mangler før oppdraget kan ferdigmeldes? Gir en liste med tekster (tom = klar).
export function mangler(S, o, r) {
  const ut = []; const f = framdrift(S, o, r);
  if (f.ferdig < f.totalt) ut.push(`${f.totalt - f.ferdig} av ${f.totalt} bestand er ikke markert ferdig`);
  const ubesvart = miljoPunkter(o, r).filter((p) => !p.felt);
  if (ubesvart.length) ut.push(`${ubesvart.length} punkt i miljøsjekken er ikke besvart`);
  const avvikUtenTekst = (r?.avvik || []).filter((a) => !a.beskrivelse);
  if (avvikUtenTekst.length) ut.push(`${avvikUtenTekst.length} avvik mangler beskrivelse`);
  const avvikIMiljo = miljoPunkter(o, r).filter((p) => p.felt?.svar === 'avvik' && !p.felt.merknad);
  if (avvikIMiljo.length) ut.push(`${avvikIMiljo.length} punkt i miljøsjekken er merket avvik uten merknad`);
  return ut;
}

// Sluttrapporten: bekreftelse med navn, dato og signatur (bilde fra signaturfeltet).
export function ferdigmeld(r, { navn, signatur, merknad = '', dato = idag() }) {
  if (!navn || !signatur) throw new Error('Skriv navnet ditt og signer');
  return { ...r, slutt: { navn, signatur, merknad, dato } };
}

// Tar rapporten inn i planen (skogeieren på web): ferdige linjer blir utførte tiltak med dato, areal og mengde, og
// oppdraget får rapporten. Gir listen over tiltak som ble satt utført ([{ bestand, tiltak }]) – appen spør selv om
// bestandene skal oppdateres (hogstklasse I osv.).
export function brukRapport(S, o, r, { kilde = '' } = {}) {
  const endret = [];
  for (const { bestand: b, tiltak: t } of linjer(S, o)) {
    const l = r?.linjer?.[t.id]; if (l?.status !== 'ferdig') continue;
    const m = MENGDE[o.type];
    t.utfortRapport = { dato: l.ferdig || r.slutt?.dato || idag(), areal: l.areal ?? null, mengde: l.mengde ?? null, enhet: m?.enhet || null, merknad: l.merknad || '', kilde };
    if (l.areal != null && l.areal > 0) t.arealDaa = l.areal;
    if (m?.enhet === 'm³' && l.mengde != null) t.volum = l.mengde;
    if (t.status !== 'utfort') endret.push({ bestand: b, tiltak: t, dato: t.utfortRapport.dato });
  }
  o.feltrapport = { mottatt: idag(), avvik: (r?.avvik || []).map(({ bilder, ...a }) => ({ ...a, bilder: (bilder || []).length })), miljo: r?.miljo || {}, slutt: r?.slutt ? { navn: r.slutt.navn, dato: r.slutt.dato, merknad: r.slutt.merknad } : null, kilde };
  if (r?.slutt) { o.status = 'utfort'; o.utfortDato = r.slutt.dato || idag(); }
  return endret;
}

// Kort tekst om status for et feltoppdrag (liste og varsler).
export function statusTekst(d) {
  const st = STATUS[d.status]?.navn || d.status;
  return `${st}${d.avvik ? ` · ${d.avvik} avvik` : ''}${d.ferdigmeldt ? ` · ferdigmeldt ${d.ferdigmeldt}` : ''}`;
}
