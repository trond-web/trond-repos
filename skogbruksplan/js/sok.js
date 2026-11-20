// 🔎 Egenskapssøk på bestand og tiltak. Et søk er { id, navn, mal: 'bestand' | 'tiltak', logikk: 'alle' | 'minst',
// vilkar: [{ felt, op, verdi, verdi2 }] }. Lagrede søk ligger i planen (S.sok), følger planen ved synkronisering og kan
// åpnes i SkogIQ Felt. Ingen DOM – testes i Node.
import { startTilstand, hogstklasseFor, laavesteHogstalder, TILTAKSTYPER, TRESLAG, STANDARD_INNSTILLINGER } from './model.js';
import { harKantsone } from './kantsone.js';
import { skjotselsbehov } from './skjotsel.js';

const HK = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
// type: tall | valg | ja | tekst. hent(b, ctx) gir verdien for et bestand.
export const BESTAND_FELT = {
  treslag: { navn: 'Treslag', type: 'valg', valg: Object.entries(TRESLAG).map(([k, v]) => [k, v]), hent: (b) => b.treslag },
  hogstklasse: { navn: 'Hogstklasse', type: 'valg', valg: Object.entries(HK).map(([k, v]) => [k, `HK ${v}`]), hent: (b, c) => (c.hk(b) ? String(c.hk(b)) : null) },
  bonitet: { navn: 'Bonitet (H40)', type: 'tall', hent: (b) => b.bonitet ?? null },
  alder: { navn: 'Alder (år)', type: 'tall', hent: (b, c) => (b.alder != null || c.st(b).alder ? Math.round(c.st(b).alder) : null) },
  areal: { navn: 'Areal (daa)', type: 'tall', hent: (b) => b.areal ?? null },
  volumDaa: { navn: 'Volum (m³/daa)', type: 'tall', hent: (b, c) => c.st(b).volumDaa ?? null },
  volum: { navn: 'Volum i bestandet (m³)', type: 'tall', hent: (b, c) => (c.st(b).volumDaa ?? 0) * (b.areal || 0) },
  treantall: { navn: 'Treantall (per daa)', type: 'tall', hent: (b) => b.treantall ?? null },
  hoyde: { navn: 'Middelhøyde (m)', type: 'tall', hent: (b) => b.hoyde ?? null },
  vegetasjon: { navn: 'Vegetasjonstype (kode)', type: 'tekst', hent: (b) => b.vegetasjon?.kode || null },
  hogstmoden: { navn: 'Hogstmoden', type: 'ja', hent: (b, c) => { const m = laavesteHogstalder(b, c.inn); return !!(m && c.st(b).alder >= m); } },
  skjotsel: { navn: 'Skjøtselsbehov', type: 'valg', valg: [['ungskog', 'Ungskogpleie'], ['tynning', 'Tynning'], ['ingen', 'Ingen']], hent: (b, c) => c.skjotsel().get(b.id) || 'ingen' },
  planlagt: { navn: 'Har planlagte tiltak', type: 'ja', hent: (b) => (b.tiltak || []).some((t) => t.status !== 'utfort') },
  miljo: { navn: 'Miljøfigur', type: 'ja', hent: (b) => !!b.miljo },
  kantsone: { navn: 'Kantsone mot vann', type: 'ja', hent: (b) => harKantsone(b) },
  nr: { navn: 'Bestandsnummer', type: 'tekst', hent: (b) => String(b.nr ?? '') },
  teig: { navn: 'Teig', type: 'tekst', hent: (b) => String(b.teig ?? '') },
  merknad: { navn: 'Merknad', type: 'tekst', hent: (b) => b.merknad || '' },
};
export const TILTAK_FELT = {
  type: { navn: 'Tiltakstype', type: 'valg', valg: Object.entries(TILTAKSTYPER).map(([k, v]) => [k, v.navn]), hent: (t) => t.type },
  aar: { navn: 'År', type: 'tall', hent: (t) => t.aar ?? null },
  status: { navn: 'Status', type: 'valg', valg: [['planlagt', 'Planlagt'], ['utfort', 'Utført']], hent: (t) => (t.status === 'utfort' ? 'utfort' : 'planlagt') },
  prioritet: { navn: 'Prioritet', type: 'valg', valg: [['1', '1 – høy'], ['2', '2 – middels'], ['3', '3 – lav']], hent: (t) => (t.prioritet != null ? String(t.prioritet) : null) },
  flate: { navn: 'Har egen flate (tegnet/sporlogg)', type: 'ja', hent: (t) => !!t.dekning },
  kommentar: { navn: 'Kommentar', type: 'tekst', hent: (t) => t.kommentar || '' },
};
export const OPERATORER = {
  tall: [['=', '='], ['≠', '≠'], ['>', '>'], ['≥', '≥'], ['<', '<'], ['≤', '≤'], ['mellom', 'mellom']],
  valg: [['er', 'er'], ['ikke', 'er ikke'], ['en av', 'er en av']],
  ja: [['ja', 'ja'], ['nei', 'nei']],
  tekst: [['inneholder', 'inneholder'], ['er', 'er'], ['ikke', 'inneholder ikke']],
};
// Feltene for en søkemal: tiltakssøk kan også bruke bestandets egenskaper («b.treslag» osv.).
export function feltFor(mal) {
  if (mal !== 'tiltak') return BESTAND_FELT;
  return { ...TILTAK_FELT, ...Object.fromEntries(Object.entries(BESTAND_FELT).map(([k, f]) => [`b.${k}`, { ...f, navn: `Bestand: ${f.navn}`, bestand: true }])) };
}
export const nyttVilkar = (mal = 'bestand') => { const [felt, f] = Object.entries(feltFor(mal))[0]; return { felt, op: OPERATORER[f.type][0][0], verdi: f.type === 'valg' ? f.valg[0][0] : '' }; };

const tallv = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
function test(f, v, { op, verdi, verdi2 }) {
  if (f.type === 'ja') return op === 'nei' ? !v : !!v;
  if (f.type === 'tekst') { const s = String(v ?? '').toLowerCase(); const q = String(verdi ?? '').trim().toLowerCase(); if (!q) return true; return op === 'er' ? s === q : op === 'ikke' ? !s.includes(q) : s.includes(q); }
  if (f.type === 'valg') { const liste = Array.isArray(verdi) ? verdi.map(String) : String(verdi ?? '').split(',').map((x) => x.trim()).filter(Boolean); if (!liste.length) return true; const har = v != null && liste.includes(String(v)); return op === 'ikke' ? !har : har; }
  const x = tallv(v); const a = tallv(verdi); if (x == null || !Number.isFinite(x)) return false; if (a == null || !Number.isFinite(a)) return true;
  switch (op) { case '=': return x === a; case '≠': return x !== a; case '>': return x > a; case '≥': return x >= a; case '<': return x < a; case '≤': return x <= a; case 'mellom': { const b = tallv(verdi2); return x >= a && (b == null || x <= b); } default: return true; }
}

function kontekst(S, inn) {
  const st = new Map(); const hk = new Map(); let sk = null;
  return {
    inn,
    st: (b) => { if (!st.has(b.id)) st.set(b.id, startTilstand(b)); return st.get(b.id); },
    hk: (b) => { if (!hk.has(b.id)) hk.set(b.id, hogstklasseFor(b, inn)); return hk.get(b.id); },
    skjotsel: () => { if (!sk) { const r = skjotselsbehov(S, { inn }); sk = new Map([...r.ungskog.map((x) => [x.b.id, 'ungskog']), ...r.tynning.map((x) => [x.b.id, 'tynning'])]); } return sk; },
  };
}

// Kjører søket. Gir { bestand: [b], tiltak: [{ b, t }], ider: Set<bestand-id>, sum: { antall, areal, volum } }.
export function kjorSok(S, sok, { inn = S?.innstillinger || STANDARD_INNSTILLINGER } = {}) {
  const mal = sok?.mal === 'tiltak' ? 'tiltak' : 'bestand'; const felt = feltFor(mal); const c = kontekst(S, inn);
  const vilkar = (sok?.vilkar || []).filter((v) => felt[v.felt]);
  const sjekk = (verdiFor) => { if (!vilkar.length) return true; const r = vilkar.map((v) => test(felt[v.felt], verdiFor(v.felt), v)); return sok.logikk === 'minst' ? r.some(Boolean) : r.every(Boolean); };
  const bestand = []; const tiltak = [];
  for (const b of S?.bestand || []) {
    if (mal === 'bestand') { if (sjekk((k) => felt[k].hent(b, c))) bestand.push(b); continue; }
    for (const t of b.tiltak || []) if (sjekk((k) => (felt[k].bestand ? BESTAND_FELT[k.slice(2)].hent(b, c) : felt[k].hent(t, c)))) tiltak.push({ b, t });
  }
  if (mal === 'tiltak') tiltak.sort((x, y) => (x.t.aar ?? 9999) - (y.t.aar ?? 9999));
  const ider = new Set(mal === 'tiltak' ? tiltak.map((x) => x.b.id) : bestand.map((b) => b.id));
  const iSok = (S?.bestand || []).filter((b) => ider.has(b.id));
  return { mal, bestand, tiltak, ider, sum: { antall: mal === 'tiltak' ? tiltak.length : bestand.length, bestand: iSok.length, areal: iSok.reduce((s, b) => s + (b.areal || 0), 0), volum: iSok.reduce((s, b) => s + (c.st(b).volumDaa ?? 0) * (b.areal || 0), 0) } };
}

// Kort tekst: «Hogstklasse er HK III og Bonitet ≥ 14»
export function beskrivSok(sok) {
  const felt = feltFor(sok?.mal);
  const del = (sok?.vilkar || []).filter((v) => felt[v.felt]).map((v) => {
    const f = felt[v.felt]; const navn = f.navn.replace(/ \(.*\)$/, '');
    if (f.type === 'ja') return `${navn}: ${v.op === 'nei' ? 'nei' : 'ja'}`;
    if (f.type === 'valg') { const l = (Array.isArray(v.verdi) ? v.verdi : String(v.verdi ?? '').split(',')).map((x) => f.valg.find(([k]) => k === String(x).trim())?.[1] || x).join(' / '); return `${navn} ${OPERATORER.valg.find(([k]) => k === v.op)?.[1] || 'er'} ${l}`; }
    if (f.type === 'tall' && v.op === 'mellom') return `${navn} ${v.verdi}–${v.verdi2 ?? ''}`;
    return `${navn} ${OPERATORER[f.type].find(([k]) => k === v.op)?.[1] || v.op} ${v.verdi}`;
  });
  return del.length ? del.join(sok.logikk === 'minst' ? ' eller ' : ' og ') : (sok?.mal === 'tiltak' ? 'Alle tiltak' : 'Alle bestand');
}

// Rydder et søk før lagring (bare kjente felt, korte tekster).
export function rensSok(sok, { id, navn, naa = new Date().toISOString() } = {}) {
  const mal = sok?.mal === 'tiltak' ? 'tiltak' : 'bestand'; const felt = feltFor(mal);
  return {
    id: id || sok.id, navn: String(navn ?? sok.navn ?? '').trim().slice(0, 60) || beskrivSok(sok).slice(0, 60), mal, logikk: sok.logikk === 'minst' ? 'minst' : 'alle',
    vilkar: (sok.vilkar || []).filter((v) => felt[v.felt]).slice(0, 12).map((v) => ({ felt: v.felt, op: String(v.op || ''), verdi: Array.isArray(v.verdi) ? v.verdi.map(String).slice(0, 20) : String(v.verdi ?? '').slice(0, 80), ...(v.verdi2 != null && v.verdi2 !== '' ? { verdi2: String(v.verdi2).slice(0, 20) } : {}) })),
    laget: sok.laget || naa, endret: naa,
  };
}
