// Samrådsskjema ved skogbrannfare for hogst- og tynningsoppdrag. Etter «Retningslinjer for skogsdrift og skjøtsel i
// skogbrannsesongen» (Skogbrand m.fl., april 2026): ved stor fare (rød) skal entreprenør/maskinfører gjennomføre
// samråd med tømmerkjøper/oppdragsgiver, samrådet dokumenteres og tid for nytt samråd avtales. Ved ekstra stor fare
// (mørkerød) forespørres brannvesenet om å delta eller få kopi, og skjemaet skal ha mobildekning og kontaktnumre,
// nøyaktig posisjon, utstyr og personer som kan bidra ved brann, og adkomst og vanntilgang. Punktene i MEFs
// samrådsskjema (brannfare, utstyr, mobildekning, tilgang for brannbil og vann, bebyggelse, sikringstiltak og
// kostnadsfordeling) er også med. Skjemaet fylles ut digitalt, lagres i oppdraget og kan lastes ned som PDF.
// Ingen DOM – kan testes i Node.
import { BRANNNIVAA, brannnivaa, RETNINGSLINJER } from './skade.js';
import { HOGSTOPPDRAG, typeFor, linjer } from './oppdrag.js';
import { lagPdf } from './pdf-enkel.js';

export const KILDE = { navn: 'Skogbrand m.fl.: Retningslinjer for skogsdrift og skjøtsel i skogbrannsesongen (april 2026)', url: 'https://www.skogbrand.no/retningslinjer-for-skogsdrift-og-skjotsel-i-skogbrannsesongen-23/' };
const RANG = Object.fromEntries(BRANNNIVAA.map((n, i) => [n.id, i]));
const iDag = () => new Date().toISOString().slice(0, 10);
const leggTilDager = (d, n) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

export const ROLLER = {
  entreprenor: { navn: 'Entreprenør / maskinfører', paakrevd: true },
  oppdragsgiver: { navn: 'Tømmerkjøper / oppdragsgiver', paakrevd: true },
  skogeier: { navn: 'Skogeier' },
  brannvakt: { navn: 'Brannvakt' },
  brannvesen: { navn: 'Brannvesenet' },
};
export const RISIKO = [
  { id: 'skogtype', tekst: 'Skogtype, vegetasjon, skogbunn og topografi' },
  { id: 'spredning', tekst: 'Spredningsrisiko, vind og begrensningslinjer' },
  { id: 'bebyggelse', tekst: 'Nærhet til bebyggelse og infrastruktur' },
  { id: 'mobil', tekst: 'Mobildekning i området (ev. sikringsradio)' },
  { id: 'brannbil', tekst: 'Tilgang for brannbil (vei, bommer, nøkler, snuplass)' },
  { id: 'vann', tekst: 'Tilgang til vann (vannkilder, avstand, uttak)' },
];
export const UTSTYR = [
  { id: 'pakke', tekst: 'Beredskapspakke på maskinen: skogbrannstryker, fylt vanndunk 25 l, spredekanne og spade/hakke' },
  { id: 'kurs', tekst: 'Entreprenør og maskinfører har skogbrannkurs fra de siste 3 årene' },
  { id: 'roykeforbud', tekst: 'Røyke- og bålforbud er formidlet på arbeidstakerens språk' },
  { id: 'fat', tekst: 'Flyttbar vannkilde (1000 l fat), pumpe og slanger', morkerod: true },
];
export const TILTAK = [
  { id: 'belter', tekst: 'Kjøring uten belter/kjettinger' },
  { id: 'prioriter', tekst: 'Prioritere granskog og fuktige områder – unngå tørr, blokkrik furumark og sør- og vestvendte lier' },
  { id: 'utkjoring', tekst: 'Utkjøring tett på hogst' },
  { id: 'tid', tekst: 'Tidsbegrenset kjøring (natt/morgen)' },
  { id: 'vakt', tekst: 'Vakthold under og etter drift' },
  { id: 'vanning', tekst: 'Vanning av utkjøringsveier' },
  { id: 'kontakt', tekst: 'Forhåndskontakt med brannvesenet' },
];
export const BESLUTNING = {
  normal: 'Drift som normalt med beredskap',
  tiltak: 'Drift med sikringstiltak',
  begrenset: 'Drift bare i avtalte tidsrom',
  stans: 'Driften stanses til faren er lavere',
};

// Høyeste farenivå i oppdragsperioden (eller de neste dagene) ut fra prognosen. dager: [{ dato, fwi, nivaa }]
export function fareIPerioden(o, dager = [], { idag = iDag() } = {}) {
  const fra = o.periode?.fra && o.periode.fra > idag ? o.periode.fra : idag;
  const til = o.periode?.til && o.periode.til >= fra ? o.periode.til : leggTilDager(fra, 13);
  const i = (dager || []).filter((d) => d.dato >= fra && d.dato <= til && d.fwi != null).map((d) => ({ ...d, nivaa: d.nivaa || brannnivaa(d.fwi) }));
  if (!i.length) return { fra, til, dager: [], maks: null, idag: null };
  const maks = i.reduce((a, d) => (RANG[d.nivaa?.id] > RANG[a.nivaa?.id] ? d : a), i[0]);
  return { fra, til, dager: i, maks, idag: i.find((d) => d.dato === idag) || null };
}

// Er samråd påkrevd for oppdraget? Bare hogst og tynning (sluttavvirkning, tynning, lukket hogst) som ikke er avsluttet.
export function krav(o, dager = [], { idag = iDag() } = {}) {
  if (!HOGSTOPPDRAG.includes(o.type) || ['utfort', 'avbrutt', 'kansellert'].includes(o.status)) return { gjelder: false };
  const f = fareIPerioden(o, dager, { idag });
  const n = f.maks?.nivaa?.id;
  return {
    gjelder: true, fare: f, ukjent: !f.maks,
    paakrevd: n === 'rod' || n === 'morkerod',
    brannvesen: n === 'morkerod',
    tekst: !f.maks ? 'Prognose for skogbrannfare mangler – hent den, eller gjør en egen vurdering.'
      : n === 'morkerod' ? `Ekstra stor skogbrannfare ${datoNb(f.maks.dato)}: samråd er obligatorisk, og brannvesenet skal forespørres om å delta eller få kopi av skjemaet.`
        : n === 'rod' ? `Stor skogbrannfare ${datoNb(f.maks.dato)}: samråd mellom entreprenør og tømmerkjøper/oppdragsgiver er obligatorisk før og under driften.`
          : `Høyeste fare i perioden: ${f.maks.nivaa.navn.toLowerCase()}. Samråd er ikke påkrevd, men vurder sikringstiltak.`,
  };
}
const datoNb = (d) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : '');

// Nytt skjema, fylt ut med det planen og oppdraget vet.
export function nytt(S, o, { nyId = (p) => `${p}${Date.now()}`, dager = [], idag = iDag(), naa = new Date() } = {}) {
  const f = fareIPerioden(o, dager, { idag }); const ber = S.skogbrand?.beredskap || {};
  const bestand = [...new Map(linjer(S, o).map((x) => [x.bestand.id, x.bestand])).values()];
  const pos = senter(bestand.map((b) => b.geometri).filter(Boolean)) || senter([S.eiendom?.grense].filter(Boolean));
  const vann = (S.skogbrand?.vannkilder || []).map((v) => `${v.navn || 'Vannkilde'}${v.geometri?.coordinates ? ` (${v.geometri.coordinates[1].toFixed(5)} N, ${v.geometri.coordinates[0].toFixed(5)} Ø)` : ''}`).join('; ');
  const tid = `${String(naa.getHours()).padStart(2, '0')}:${String(naa.getMinutes()).padStart(2, '0')}`;
  return {
    id: nyId('sr'), dato: idag, tid, opprettet: naa.toISOString(),
    sted: {
      eiendom: S.eiendom?.navn || '', gnrbnr: S.eiendom?.gnrbnr || '', kommune: S.eiendom?.kommune || '',
      bestand: bestand.map((b) => b.nr).join(', '), posisjon: pos ? `${pos[1].toFixed(5)} N, ${pos[0].toFixed(5)} Ø` : '',
      adkomst: '', moteplass: '',
    },
    fare: { nivaa: (f.idag || f.maks)?.nivaa?.id || '', fwi: (f.idag || f.maks)?.fwi ?? null, maks: f.maks ? { dato: f.maks.dato, nivaa: f.maks.nivaa.id, fwi: f.maks.fwi } : null, farevarsel: '', torke: '' },
    risiko: Object.fromEntries(RISIKO.map((r) => [r.id, { ok: false, merknad: r.id === 'mobil' ? ber.mobil || '' : r.id === 'vann' ? vann : '' }])),
    utstyr: Object.fromEntries(UTSTYR.map((u) => [u.id, false])), utstyrPersoner: '',
    tiltak: Object.fromEntries(TILTAK.map((t) => [t.id, false])), tiltakAndre: '',
    beslutning: '', tidsrom: '', kostnad: '', nyttSamrad: '',
    brannvesen: { forespurt: false, deltok: false, navn: '', telefon: '', epost: '', kopiSendt: '' },
    deltakere: [
      { rolle: 'entreprenor', navn: o.utforer?.kontakt || o.utforer?.navn || '', firma: o.utforer?.navn || '', telefon: o.utforer?.telefon || '', bekreftet: null },
      { rolle: 'oppdragsgiver', navn: '', firma: o.felt?.kjoper || '', telefon: '', bekreftet: null },
      { rolle: 'skogeier', navn: ber.kontakt || '', firma: '', telefon: ber.telefon || '', bekreftet: null },
    ],
  };
}
function senter(geoms) {
  const p = []; const gaa = (c) => { if (typeof c[0] === 'number') p.push(c); else c.forEach(gaa); };
  for (const g of geoms) if (g?.coordinates) gaa(g.coordinates);
  if (!p.length) return null;
  return [p.reduce((s, x) => s + x[0], 0) / p.length, p.reduce((s, x) => s + x[1], 0) / p.length];
}

// Hva mangler før skjemaet er fullført? brannvesen = ekstra stor fare.
export function mangler(sk, { brannvesen = false } = {}) {
  const ut = [];
  if (!sk.dato) ut.push('dato for samrådet');
  if (!sk.sted?.posisjon) ut.push('nøyaktig posisjon');
  if (!sk.fare?.nivaa) ut.push('skogbrannfare (nivå)');
  const ikkeVurdert = RISIKO.filter((r) => !sk.risiko?.[r.id]?.ok);
  if (ikkeVurdert.length) ut.push(`risikovurdering (${ikkeVurdert.length} av ${RISIKO.length} punkter er ikke vurdert)`);
  if (!sk.utstyr?.pakke) ut.push('beredskapspakke på maskinen');
  if (!sk.beslutning) ut.push('beslutning');
  if (sk.beslutning === 'begrenset' && !sk.tidsrom) ut.push('tidsrom for drift');
  if (!sk.nyttSamrad && sk.beslutning !== 'stans') ut.push('tid for nytt samråd');
  for (const [rolle, r] of Object.entries(ROLLER)) if (r.paakrevd && !sk.deltakere?.some((d) => d.rolle === rolle && d.navn && d.bekreftet)) ut.push(`bekreftelse fra ${r.navn.toLowerCase()}`);
  if (brannvesen) {
    if (!sk.brannvesen?.forespurt) ut.push('brannvesenet er forespurt om å delta eller få kopi');
    if (!sk.sted?.adkomst) ut.push('adkomst for brannvesenet');
    if (!sk.risiko?.mobil?.merknad) ut.push('mobildekning og kontaktnumre');
    if (!sk.utstyrPersoner) ut.push('utstyr og personer som kan bidra ved brann');
    if (!sk.risiko?.vann?.merknad) ut.push('vanntilgang');
  }
  return ut;
}

// Gjeldende samråd: siste fullførte skjema der tid for nytt samråd ikke er passert.
export function gjeldende(o, { naa = new Date(), brannvesen = false } = {}) {
  const liste = (o.samrad || []).filter((s) => !mangler(s, { brannvesen }).length).sort((a, b) => `${b.dato} ${b.tid}`.localeCompare(`${a.dato} ${a.tid}`));
  const s = liste[0]; if (!s) return null;
  const utlopt = s.nyttSamrad && new Date(s.nyttSamrad) < naa;
  return { skjema: s, utlopt, stans: s.beslutning === 'stans' };
}

// Status for oppdraget: ok | mangler | utlopt | stans | ikke-pakrevd | ukjent
export function status(o, dager, { naa = new Date(), idag = iDag() } = {}) {
  const k = krav(o, dager, { idag });
  if (!k.gjelder) return { id: 'ikke-relevant', k };
  const g = gjeldende(o, { naa, brannvesen: k.brannvesen });
  if (!k.paakrevd) return { id: k.ukjent ? 'ukjent' : 'ikke-pakrevd', k, g };
  if (!g) return { id: 'mangler', k, g };
  if (g.stans) return { id: 'stans', k, g };
  if (g.utlopt) return { id: 'utlopt', k, g };
  return { id: 'ok', k, g };
}

export function filnavn(S, o, sk) { return `samradsskjema-${String(o.nr || 'oppdrag').replace(/[^\w-]+/g, '')}-${sk.dato}.pdf`; }

// PDF av skjemaet (Uint8Array).
export function pdf(S, o, sk, { signatur = 'SkogIQ.ai' } = {}) {
  const niv = (id) => BRANNNIVAA.find((n) => n.id === id)?.navn || '–';
  const b = [];
  const h2 = (t) => b.push({ type: 'h2', tekst: t }); const kv = (e, v) => b.push({ type: 'kv', etikett: e, verdi: v });
  b.push({ type: 'h1', tekst: 'Samrådsskjema – skogsdrift ved skogbrannfare' });
  b.push({ type: 'liten', tekst: `Etter ${KILDE.navn}. Samrådet dokumenteres, og tid for nytt samråd avtales. Ved ekstra stor fare forespørres brannvesenet om å delta eller få kopi av skjemaet.` });
  h2('Oppdrag og sted');
  kv('Oppdrag', `${o.nr || ''} ${typeFor(o.type).navn}${o.tittel ? ` – ${o.tittel}` : ''}`);
  kv('Eiendom', `${sk.sted.eiendom}${sk.sted.gnrbnr ? ` (gnr/bnr ${sk.sted.gnrbnr})` : ''}${sk.sted.kommune ? `, ${sk.sted.kommune} kommune` : ''}`);
  kv('Bestand', sk.sted.bestand); kv('Nøyaktig posisjon', sk.sted.posisjon);
  kv('Adkomst for brannvesenet', sk.sted.adkomst); kv('Møteplass for nødetater', sk.sted.moteplass);
  kv('Samråd gjennomført', `${datoNb(sk.dato)} kl. ${sk.tid || ''}`);
  h2('Skogbrannfare');
  kv('Skogbrannindeks (met.no)', `${niv(sk.fare.nivaa)}${sk.fare.fwi != null ? ` (FWI ${String(Math.round(sk.fare.fwi * 10) / 10).replace('.', ',')})` : ''}`);
  if (sk.fare.maks) kv('Høyeste i perioden', `${niv(sk.fare.maks.nivaa)} ${datoNb(sk.fare.maks.dato)}`);
  kv('Farevarsel', sk.fare.farevarsel); kv('Tørke, nedbør og vind', sk.fare.torke);
  h2('Risikovurdering');
  for (const r of RISIKO) { b.push({ type: 'sjekk', tekst: `${r.tekst}${sk.risiko[r.id]?.merknad ? ` – ${sk.risiko[r.id].merknad}` : ''}`, ok: sk.risiko[r.id]?.ok }); }
  h2('Utstyr og personer');
  for (const u of UTSTYR) b.push({ type: 'sjekk', tekst: u.tekst, ok: sk.utstyr[u.id] });
  kv('Utstyr og personer som kan bidra ved brann', sk.utstyrPersoner);
  h2('Sikringstiltak');
  for (const t of TILTAK) b.push({ type: 'sjekk', tekst: t.tekst, ok: sk.tiltak[t.id] });
  if (sk.tiltakAndre) kv('Andre tiltak', sk.tiltakAndre);
  h2('Beslutning');
  kv('Beslutning', BESLUTNING[sk.beslutning] || '–'); if (sk.tidsrom) kv('Tidsrom for drift', sk.tidsrom);
  kv('Kostnader og fordeling', sk.kostnad);
  kv('Tid for nytt samråd', sk.nyttSamrad ? `${datoNb(sk.nyttSamrad.slice(0, 10))} kl. ${sk.nyttSamrad.slice(11, 16)}` : (sk.beslutning === 'stans' ? 'Når faren er lavere' : '–'));
  h2('Brannvesenet');
  b.push({ type: 'sjekk', tekst: 'Brannvesenet er forespurt om å delta i samrådet eller få kopi av skjemaet', ok: sk.brannvesen.forespurt });
  b.push({ type: 'sjekk', tekst: 'Brannvesenet deltok i samrådet', ok: sk.brannvesen.deltok });
  kv('Kontakt i brannvesenet', [sk.brannvesen.navn, sk.brannvesen.telefon, sk.brannvesen.epost].filter(Boolean).join(', '));
  kv('Kopi sendt brannvesenet', sk.brannvesen.kopiSendt ? datoNb(sk.brannvesen.kopiSendt) : '');
  h2('Deltakere og kontaktnumre');
  for (const d of sk.deltakere) kv(ROLLER[d.rolle]?.navn || d.rolle, [d.navn, d.firma, d.telefon].filter(Boolean).join(', '));
  b.push({ type: 'liten', tekst: 'Ved brann: ring 110 og oppgi posisjonen over. Slokk små branner hvis det er trygt.' });
  h2('Bekreftelse');
  for (const d of sk.deltakere.filter((x) => x.navn)) b.push({ type: 'signatur', etikett: ROLLER[d.rolle]?.navn || d.rolle, verdi: d.navn, tid: d.bekreftet ? `Bekreftet digitalt ${new Date(d.bekreftet).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })}` : 'Ikke bekreftet' });
  return lagPdf(b, { tittel: `Samrådsskjema ${o.nr || ''} ${datoNb(sk.dato)}`, bunntekst: `${signatur} · ${S.eiendom?.navn || ''} · ${o.nr || ''}` });
}

export { RETNINGSLINJER };
