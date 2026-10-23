// Resultatoppsett som i DogWeb/Arra: premieliste per prøve og resultatlinjer per hund.
// Kodene (MA, LD, LT, JL …) og rekkefølgen er de samme som DogWeb bruker for harehundprøver.
import { LOSDYR, MOMENTER, TILLEGG, beregn, beregnEP } from './regler.js';

// DogWeb-koder for egenskapene, i DogWebs rekkefølge.
export const DOGWEB_KODER = [
  ['JL', 'jaktlyst', 'Jaktlyst'], ['SK', 'samarbeid', 'Søk og samarbeid'], ['FO', 'fotarbeid', 'Fotarbeid/evne til uttak'],
  ['MF', 'malbrukFot', 'Målbruk i fot'], ['MT', 'malbrukTap', 'Målbruk i tap'], ['AL', 'arbeidLos', 'Arbeid i los'],
  ['AT', 'arbeidTap', 'Arbeid i tap'], ['MN', 'nyansering', 'Mål – nyansering'], ['MH', 'horbarhet', 'Mål – hørbarhet'],
  ['KO', 'kondisjon', 'Kondisjon/styrke'], ['LY', 'lydighet', 'Lydighet'],
];

const forkort = (tekst, n) => (tekst ? String(tekst).slice(0, n) : '');
const losdyrKort = (r) => (r.premielos ? forkort(LOSDYR[r.premielos.losdyr], 2) : '');
const vekt = Object.fromEntries([...MOMENTER, ...TILLEGG].map((m) => [m.id, m.vekt]));

export function ferdig(p, r = beregn(p)) {
  return r.logg.avsluttet || !!p.utfall || !!p.ikkeStartet;
}

// Én resultatlinje slik DogWeb viser den på hundens side.
export function dogwebResultat(p, r = beregn(p)) {
  const karakter = (id) => (r.aktive.ids.includes(id) && Number.isInteger(p.poeng?.[id]) ? p.poeng[id] : null);
  const felter = [];
  if (p.mark) felter.push(['MA', forkort(p.mark, 2)]);
  if (losdyrKort(r)) felter.push(['LD', losdyrKort(r)]);
  if (r.lospoeng) felter.push(['LT', r.lospoeng]);
  for (const [kode, id] of DOGWEB_KODER) if (karakter(id)) felter.push([kode, karakter(id)]);
  if (p.mal) felter.push(['Mål', forkort(p.mal, 1)]);
  felter.push(['Premie', r.premiegrad]);
  return {
    dato: p.dato,
    sted: p.terreng || '',
    arrangor: p.arrangor || '',
    klasse: p.type === 'EP' ? `EP dag ${p.dag}` : p.type,
    dommer: p.dommer || '',
    premie: r.utfall ? r.utfall : p.ikkeStartet ? 'IS' : r.premiegrad ? `${r.premiegrad}. premie` : '',
    felter,
  };
}

// Resultatlinjer per hund. EP-dager slås sammen til én linje med premie per dag, som i DogWeb.
export function resultaterPerHund(prover) {
  const hunder = new Map();
  const brukt = new Set();
  const ferdige = prover.filter((p) => ferdig(p));
  for (const p of ferdige) {
    if (brukt.has(p.id)) continue;
    const nokkel = (p.hund.regnr || p.hund.navn || p.id).trim().toUpperCase();
    if (!hunder.has(nokkel)) hunder.set(nokkel, { hund: p.hund, eier: p.eier, linjer: [] });
    const linje = dogwebResultat(p);
    if (p.type === 'EP') {
      const dag1 = p.dag === 1 ? p : prover.find((x) => x.id === p.epPar);
      const dag2 = p.dag === 2 ? p : prover.find((x) => x.epPar === p.id);
      const ep = beregnEP(dag1 || p, dag2 && ferdig(dag2) ? dag2 : null);
      for (const d of [dag1, dag2]) if (d) brukt.add(d.id);
      linje.klasse = 'EP';
      linje.premie = ep.premie ? `${ep.premie}. premie` : '';
      linje.dager = ep.dager.map((d, i) => `Dag ${i + 1}: ${d ? (d.utfall || `${d.premiegrad}. premie`) : '–'}`);
      linje.dagerDetaljer = [dag1, dag2].filter(Boolean).filter((d) => ferdig(d)).map((d) => ({ dag: d.dag, ...dogwebResultat(d) }));
      linje.premiepoeng = ep.premiepoeng;
    }
    hunder.get(nokkel).linjer.push(linje);
  }
  const ut = [...hunder.values()];
  for (const h of ut) h.linjer.sort((a, b) => (b.dato || '').localeCompare(a.dato || ''));
  return ut.sort((a, b) => (a.hund.navn || '').localeCompare(b.hund.navn || '', 'no'));
}

// Premieliste-rad med vektede poeng, som i Arra/DogWeb-premielisten.
export function premielisteRad(p, r = beregn(p)) {
  const sum = (id) => (r.aktive.ids.includes(id) && Number.isInteger(p.poeng?.[id]) && !r.utfall ? p.poeng[id] * vekt[id] : '');
  const utfall = r.utfall || (p.ikkeStartet ? 'IS' : '');
  return {
    id: p.id,
    kat: p.katnr || '',
    regnr: p.hund.regnr || '',
    navn: p.hund.navn || '',
    rase: p.hund.rase || '',
    eier: p.eier || '',
    dag: p.type === 'EP' ? p.dag : null,
    poeng: Object.fromEntries(DOGWEB_KODER.map(([, id]) => [id, sum(id)])),
    egenskapspoeng: r.egenskapspoeng,
    lospoeng: r.lospoeng,
    premiepoeng: r.premiepoeng,
    premiegrad: r.premiegrad,
    konkurransepoeng: r.konkurransepoeng,
    losdyr: losdyrKort(r),
    mark: forkort(p.mark, 2),
    graverende: r.utfall === 'G' ? 'G' : '',
    trukket: ['T', 'U', 'A', 'IS'].includes(utfall) ? utfall : '',
    rr: p.rr === 'Bestått' ? 'B' : p.rr === 'Ikke godkjent' ? 'IG' : p.rr === 'Omprøve' ? 'O' : '',
    ferdig: ferdig(p, r),
  };
}

// Rangering som i premielisten: premiegrad først (1, 2, 3, så 0), deretter konkurransepoeng.
function rangering(a, b) {
  const g = (x) => (x.premiegrad ? x.premiegrad : 9);
  return g(a) - g(b) || b.konkurransepoeng - a.konkurransepoeng || b.premiepoeng - a.premiepoeng || String(a.kat).localeCompare(String(b.kat), 'no', { numeric: true });
}

// Grupperer prøvene i premielister etter prøvens ref.nr. (eller arrangør, type og dato).
export function premielister(prover) {
  const lister = new Map();
  for (const p of prover) {
    const nokkel = p.refnr ? `ref:${p.refnr.trim().toUpperCase()}|${p.type}` : `${p.arrangor}|${p.type}|${p.type === 'EP' ? '' : p.dato}`;
    if (!lister.has(nokkel)) lister.set(nokkel, { refnr: p.refnr || '', arrangor: p.arrangor || '', type: p.type, prover: [] });
    lister.get(nokkel).prover.push(p);
  }
  const ut = [];
  for (const l of lister.values()) {
    const datoer = l.prover.map((p) => p.dato).filter(Boolean).sort();
    const rader = l.prover.map((p) => premielisteRad(p)).filter((x) => x.ferdig);
    rader.sort(rangering);
    const sted = [...new Set(l.prover.map((p) => p.terreng).filter(Boolean))].join(', ');
    const ep = l.type === 'EP' ? epSammendrag(l.prover) : [];
    ut.push({ ...l, fra: datoer[0] || '', til: datoer[datoer.length - 1] || '', sted, rader, ep, uferdige: l.prover.length - rader.length });
  }
  return ut.sort((a, b) => (b.til || '').localeCompare(a.til || ''));
}

// EP: samlet resultat per hund over to dager.
function epSammendrag(prover) {
  const dag1 = prover.filter((p) => p.dag === 1);
  return dag1.map((d1) => {
    const d2 = prover.find((x) => x.epPar === d1.id);
    const ep = beregnEP(d1, d2 && ferdig(d2) ? d2 : null);
    return { navn: d1.hund.navn, regnr: d1.hund.regnr, kat: d1.katnr, premiepoeng: ep.premiepoeng, premie: ep.premie, merknader: ep.merknader };
  }).sort((a, b) => (a.premie || 9) - (b.premie || 9) || b.premiepoeng - a.premiepoeng);
}

const PREMIELISTE_KOLONNER = [
  ['Kat.', 'kat'], ['Reg.nr.', 'regnr'], ['Hundens navn', 'navn'], ['Rase', 'rase'], ['Eier', 'eier'],
  ...DOGWEB_KODER.slice(0, 9).map(([, id, navn]) => [navn, (r) => r.poeng[id]]),
  ['Egensk.poeng', 'egenskapspoeng'], ['Lospoeng', 'lospoeng'], ['Sum premiepoeng', 'premiepoeng'], ['Premiegrad', 'premiegrad'],
  ...DOGWEB_KODER.slice(9).map(([, id, navn]) => [navn, (r) => r.poeng[id]]),
  ['Sum konk.poeng', 'konkurransepoeng'], ['Losdyr', 'losdyr'], ['Mark', 'mark'], ['Graverende', 'graverende'], ['Trukket', 'trukket'], ['RR-prøve', 'rr'],
];

export function premielisteCsv(liste) {
  const celle = (v) => {
    const s = String(v ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const hode = [...(liste.type === 'EP' ? ['Dag'] : []), ...PREMIELISTE_KOLONNER.map(([n]) => n)];
  const linjer = liste.rader.map((r) => [...(liste.type === 'EP' ? [r.dag] : []), ...PREMIELISTE_KOLONNER.map(([, k]) => (typeof k === 'function' ? k(r) : r[k]))]);
  return [hode, ...linjer].map((l) => l.map(celle).join(';')).join('\r\n');
}
