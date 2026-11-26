// 🐄 Mattilsynet – husdyrhold og matproduksjon: journalene og rutinene Mattilsynet kan be om ved tilsyn, samlet på
// ett sted og vurdert ut fra dyreholdet i planen. Ingen DOM – kan testes i Node. Visning: mattilsynet-ui.js.
// Kravene er en hjelp til å holde orden; regelverket og veiledere hos Mattilsynet gjelder. KSL-sjekklistene i
// fanen KSL går gjennom det samme regelverket punkt for punkt.
import { DYRESLAG } from './husdyr.js';

export const HJEMMEL = {
  matloven: { navn: 'Matloven § 7 (registrering) og § 19 (internkontroll)', url: 'https://lovdata.no/lov/2003-12-19-124' },
  dyrevelferd: { navn: 'Dyrevelferdsloven', url: 'https://lovdata.no/lov/2009-06-19-97' },
  dyrehelse: { navn: 'Dyrehelseforskriften (biosikkerhet, varsling, registre)', url: 'https://lovdata.no/forskrift/2022-04-06-631' },
  storfe: { navn: 'Forskrift om hold av storfe (§ 17 tilsyn, § 32 løsdrift)', url: 'https://lovdata.no/forskrift/2004-04-22-665' },
  fjorfe: { navn: 'Forskrift om hold av høns og kalkun (§ 11 alarm, aggregat, dødelighet)', url: 'https://lovdata.no/forskrift/2001-12-12-1494' },
  svin: { navn: 'Forskrift om hold av svin', url: 'https://lovdata.no/forskrift/2003-02-18-175' },
  smafe: { navn: 'Forskrift om velferd for småfe', url: 'https://lovdata.no/forskrift/2005-02-18-160' },
  hest: { navn: 'Forskrift om velferd for hest', url: 'https://lovdata.no/forskrift/2005-06-02-505' },
  hygiene: { navn: 'Næringsmiddelhygieneforskriften (primærproduksjon, journaler)', url: 'https://lovdata.no/forskrift/2008-12-22-1623' },
  animalie: { navn: 'Animaliehygieneforskriften (melk og egg)', url: 'https://lovdata.no/forskrift/2008-12-22-1624' },
  for: { navn: 'Forskrift om fôrvarer (fôrvarehygiene, sporbarhet)', url: 'https://lovdata.no/forskrift/2002-11-07-1290' },
  biprodukt: { navn: 'Animaliebiproduktforskriften (kadaver)', url: 'https://lovdata.no/forskrift/2016-09-14-1064' },
  vann: { navn: 'Drikkevannsforskriften (vann til dyr og næringsmidler)', url: 'https://lovdata.no/forskrift/2016-12-22-1868' },
  legemiddel: { navn: 'Mattilsynet: dokumentasjon av legemiddelbruk på matproduserende dyr', url: 'https://mattilsynet.no/dyr/dyrehelsepersonell/legemidler-til-dyr' },
};

// Journalene (feltene som vises i skjemaet og i tilsynsmappen).
export const JOURNALER = {
  sykdom: { navn: 'Sykdom og dødelighet', ikon: '🩺', felt: [['dato', 'Dato', 'date'], ['slag', 'Dyreslag', 'slag'], ['dyr', 'Dyr (ID eller gruppe/hus)', 'text'], ['hendelse', 'Hendelse', ['Sykdom', 'Skade', 'Død', 'Avlivet']], ['antall', 'Antall', 'number'], ['beskrivelse', 'Symptomer / diagnose', 'text'], ['tiltak', 'Tiltak (behandling, veterinær)', 'text'], ['smitte', 'Mistanke om smittsom sykdom', 'bool'], ['meldt', 'Meldt til Mattilsynet/veterinær', 'bool']] },
  tilsyn: { navn: 'Tilsyn og teknisk kontroll', ikon: '👀', felt: [['dato', 'Dato', 'date'], ['tid', 'Tid', 'time'], ['av', 'Utført av', 'text'], ['hva', 'Hva', ['Tilsyn med dyra', 'Teknisk kontroll (vann, fôr, ventilasjon)', 'Test av alarm', 'Test av aggregat']], ['merknad', 'Merknad / avvik', 'text']] },
  temperatur: { navn: 'Temperatur (melk og egg)', ikon: '🌡', felt: [['dato', 'Dato', 'date'], ['sted', 'Hvor', ['Melketank', 'Eggrom', 'Kjølerom', 'Annet']], ['temp', 'Temperatur (°C)', 'number'], ['merknad', 'Merknad', 'text']] },
  vann: { navn: 'Vannprøver', ikon: '💧', felt: [['dato', 'Dato', 'date'], ['kilde', 'Vannkilde', ['Egen brønn', 'Kommunalt', 'Bekk/vann', 'Annet']], ['bruk', 'Brukes til', ['Drikkevann til dyr', 'Melkerom/vask', 'Vanning av grønnsaker/bær', 'Annet']], ['resultat', 'Resultat', ['Godkjent', 'Avvik']], ['lab', 'Laboratorium', 'text'], ['merknad', 'Merknad / tiltak', 'text']] },
  for: { navn: 'Fôr (sporbarhet)', ikon: '🌾', felt: [['dato', 'Dato', 'date'], ['for', 'Fôr', 'text'], ['leverandor', 'Leverandør', 'text'], ['parti', 'Parti/lotnummer', 'text'], ['mengde', 'Mengde', 'text'], ['til', 'Til dyr', 'text']] },
  kadaver: { navn: 'Kadaver', ikon: '⚰', felt: [['dato', 'Dato', 'date'], ['slag', 'Dyreslag', 'slag'], ['antall', 'Antall', 'number'], ['levert', 'Levert til / håndtert', ['Henting (Norsk Protein e.l.)', 'Kadaverkjøler, venter henting', 'Nedgravd etter tillatelse', 'Annet']], ['merknad', 'Merknad', 'text']] },
  besok: { navn: 'Besøkslogg (smittevern)', ikon: '🧑‍🌾', felt: [['dato', 'Dato', 'date'], ['navn', 'Navn', 'text'], ['firma', 'Firma / ærend', 'text'], ['kontakt', 'Inne i dyrerom', 'bool'], ['utland', 'Hatt dyrekontakt i utlandet siste 48 t', 'bool'], ['merknad', 'Merknad', 'text']] },
};

const grupper = (S) => new Set((S?.skifteplan?.dyrehold?.dyr || []).filter((r) => Number(r.antall) > 0).map((r) => DYRESLAG[r.slag]?.gruppe).filter(Boolean));
const slag = (S) => new Set((S?.skifteplan?.dyrehold?.dyr || []).filter((r) => Number(r.antall) > 0).map((r) => r.slag));
export const antallPerGruppe = (S) => (S?.skifteplan?.dyrehold?.dyr || []).filter((r) => Number(r.antall) > 0).reduce((a, r) => { const g = DYRESLAG[r.slag]?.gruppe; if (g) a[g] = (a[g] || 0) + Number(r.antall); return a; }, {});
export function tomt() { return { virksomhet: { produsentnr: '', registrert: false, tilsynsrutine: '', smittevern: '', egenBronn: false }, register: {}, beredskap: { strom: '', vann: '', ventilasjon: '', alarm: '', brann: '', kontakter: '' }, journal: Object.fromEntries(Object.keys(JOURNALER).map((k) => [k, []])) }; }
export function sikre(S) {
  // Fyller ut på stedet, slik at referanser til objektene fortsatt gjelder etter et nytt kall.
  const t = tomt(); if (!S.mattilsynet) S.mattilsynet = t; const m = S.mattilsynet;
  for (const k of ['virksomhet', 'register', 'beredskap', 'journal']) m[k] = m[k] ? Object.assign(m[k], { ...t[k], ...m[k] }) : t[k];
  return m;
}
const dagerSiden = (d, idag) => (d ? Math.floor((new Date(`${idag}T12:00:00`) - new Date(`${String(d).slice(0, 10)}T12:00:00`)) / 864e5) : Infinity);
const siste = (liste, f = () => true) => liste.filter(f).map((x) => x.dato).filter(Boolean).sort().at(-1) || null;
// Melk: rå melk kjøles til høyst 8 °C ved daglig henting og 6 °C ellers (animaliehygieneforskriften, EU 853/2004).
export const MELK_MAKS = { daglig: 8, ikkeDaglig: 6 };

// Vurdering. Gir [{ id, navn, status: ok | delvis | mangler | avvik | info, tekst, hjemmel, journal? }]
export function vurdering(S, { idag = new Date().toISOString().slice(0, 10), henting = 'daglig' } = {}) {
  const m = sikre(S); const g = grupper(S); const sl = slag(S); const j = m.journal; const ut = [];
  const krav = (x) => ut.push(x);
  if (!g.size) return [{ id: 'ingen', navn: 'Ingen dyr i dyreholdet', status: 'info', tekst: 'Legg inn dyrene under Dyrehold, så vises kravene som gjelder for gården.' }];
  krav({ id: 'registrert', navn: 'Registrert hos Mattilsynet (produsentnummer)', hjemmel: HJEMMEL.matloven, status: m.virksomhet.produsentnr && m.virksomhet.registrert ? 'ok' : m.virksomhet.produsentnr || m.virksomhet.registrert ? 'delvis' : 'mangler', tekst: m.virksomhet.produsentnr ? `Produsentnummer ${m.virksomhet.produsentnr}.` : 'Alle som holder produksjonsdyr eller produserer mat for salg, skal være registrert hos Mattilsynet. Skriv inn produsentnummeret.' });
  // Husdyrregisteret: antall registrert mot dyreholdet (storfe, småfe og svin skal merkes og registreres).
  const ant = antallPerGruppe(S);
  for (const gr of ['Storfe', 'Småfe', 'Svin'].filter((x) => g.has(x))) {
    const r = m.register[gr] || {}; const reg = Number(r.antall); const plan = ant[gr];
    const avvik = Number.isFinite(reg) && reg > 0 && plan ? Math.abs(reg - plan) / plan : null;
    krav({ id: `register-${gr}`, navn: `Merking og Husdyrregisteret – ${gr.toLowerCase()}`, hjemmel: HJEMMEL.dyrehelse, status: !r.antall ? 'mangler' : dagerSiden(r.dato, idag) > 365 ? 'delvis' : avvik > 0.1 ? 'delvis' : 'ok',
      tekst: !r.antall ? `Skriv inn hvor mange dyr som står i Husdyrregisteret, og når du sjekket. Dyreholdet i planen har ${plan}.` : `${reg} registrert (sjekket ${r.dato || '–'}), ${plan} i dyreholdet${avvik > 0.1 ? ' – stemmer ikke, sjekk fødsler, flytting og slakt (frist 7 dager)' : ''}.` });
  }
  // Tilsyn: storfe minst to ganger daglig inne (§ 17), fjørfe minst to ganger daglig; andre daglig.
  const tilsynsKrav = g.has('Storfe') || g.has('Fjørfe') ? 'minst to ganger daglig (storfe inne og fjørfe)' : 'minst én gang daglig';
  krav({ id: 'tilsyn', navn: `Tilsyn ${tilsynsKrav}`, hjemmel: g.has('Fjørfe') ? HJEMMEL.fjorfe : HJEMMEL.storfe, status: m.virksomhet.tilsynsrutine ? 'ok' : 'mangler', tekst: m.virksomhet.tilsynsrutine ? `Rutine: ${m.virksomhet.tilsynsrutine}` : 'Beskriv hvem som har tilsyn, hvor ofte, og hvem som overtar ved fravær (avløser). Tilsynsloggen under er valgfri – men nyttig ved tilsyn.' });
  // Sykdom og dødelighet; mistanke om smittsom sykdom skal varsles.
  const umeldt = j.sykdom.filter((x) => x.smitte && !x.meldt);
  const sisteDod = siste(j.sykdom, (x) => ['Død', 'Avlivet'].includes(x.hendelse));
  krav({ id: 'sykdom', navn: 'Sykdoms- og dødelighetsjournal', hjemmel: HJEMMEL.dyrehelse, journal: 'sykdom',
    status: umeldt.length ? 'avvik' : sl.has('slaktekylling') && dagerSiden(siste(j.sykdom), idag) > 7 ? 'delvis' : j.sykdom.length ? 'ok' : 'info',
    tekst: umeldt.length ? `${umeldt.length} tilfelle med mistanke om smittsom sykdom er ikke meldt. Varsle Mattilsynet eller veterinær straks.` : sl.has('slaktekylling') ? 'Slaktekylling: dødeligheten skal registreres daglig per innsett og hus (forskrift om hold av høns og kalkun).' : `Før sykdom, skader og dødsfall${sisteDod ? ` – siste dødsfall ${sisteDod}` : ''}. Uvanlig sykdom eller dødelighet skal meldes.` });
  krav({ id: 'legemiddel', navn: 'Legemiddeljournal (tilbakeholdelsestid, oppbevares 5 år)', hjemmel: HJEMMEL.legemiddel, status: 'info', tekst: `${(S.gard?.legemiddel || []).length} ${(S.gard?.legemiddel || []).length === 1 ? 'behandling' : 'behandlinger'} ført. Journalen ligger under Skifteplan › Krav og frister.`, fane: 'krav' });
  // Melk og egg.
  if (sl.has('melkeku') || sl.has('geit')) {
    const grense = MELK_MAKS[henting === 'ikke-daglig' ? 'ikkeDaglig' : 'daglig'];
    const tank = j.temperatur.filter((x) => x.sted === 'Melketank' && dagerSiden(x.dato, idag) <= 30); const over = tank.filter((x) => Number(x.temp) > grense);
    krav({ id: 'melk', navn: `Melkekjøling (høyst ${grense} °C)`, hjemmel: HJEMMEL.animalie, journal: 'temperatur', status: over.length ? 'avvik' : tank.length ? 'ok' : 'info', tekst: over.length ? `${over.length} ${over.length === 1 ? 'måling' : 'målinger'} over ${grense} °C siste 30 dager – sjekk kjøleanlegget og varsle meieriet.` : tank.length ? `${tank.length} ${tank.length === 1 ? 'måling' : 'målinger'} siste 30 dager, alle innenfor.` : 'Før temperaturen i melketanken – eller ta vare på tankens egen logg.' });
  }
  if (sl.has('verpehone')) krav({ id: 'egg', navn: 'Egg: rene, kjølige og tørre forhold', hjemmel: HJEMMEL.animalie, journal: 'temperatur', status: siste(j.temperatur, (x) => x.sted === 'Eggrom') ? 'ok' : 'info', tekst: 'Før temperaturen i eggrommet. Eggene skal lagres rent, tørt og ved jevn temperatur.' });
  // Vann.
  const sisteVann = siste(j.vann); const vannAvvik = j.vann.filter((x) => x.resultat === 'Avvik' && dagerSiden(x.dato, idag) <= 365);
  krav({ id: 'vann', navn: 'Vannkvalitet (dyr og matproduksjon)', hjemmel: HJEMMEL.vann, journal: 'vann', status: vannAvvik.length ? 'avvik' : m.virksomhet.egenBronn ? (dagerSiden(sisteVann, idag) <= 365 ? 'ok' : 'delvis') : sisteVann ? 'ok' : 'info', tekst: vannAvvik.length ? 'Vannprøve med avvik siste år – følg opp tiltak og ta ny prøve.' : m.virksomhet.egenBronn ? (sisteVann ? `Siste prøve ${sisteVann}.` : 'Egen brønn: ta vannprøve av vannet til dyra og melkerommet (anbefalt minst én gang i året).') : 'Kommunalt vann: prøver tas av kommunen. Før egne prøver hvis du har egen brønn.' });
  // Fôr.
  krav({ id: 'for', navn: 'Fôr: sporbarhet og hygiene', hjemmel: HJEMMEL.for, journal: 'for', status: j.for.some((x) => dagerSiden(x.dato, idag) <= 365) ? 'ok' : 'info', tekst: 'Ta vare på følgesedler, eller før innkjøpt fôr med leverandør og parti, slik at fôret kan spores.' });
  // Kadaver.
  krav({ id: 'kadaver', navn: 'Kadaver hentes eller håndteres forskriftsmessig', hjemmel: HJEMMEL.biprodukt, journal: 'kadaver', status: j.kadaver.some((x) => x.levert === 'Annet' && !x.merknad) ? 'delvis' : 'ok', tekst: 'Døde dyr skal oppbevares slik at de ikke sprer smitte, og hentes til godkjent anlegg. Nedgraving krever tillatelse.' });
  // Beredskap: fjørfe og svin trenger alarm og aggregat.
  const b = m.beredskap; const tekniske = g.has('Fjørfe') || g.has('Svin');
  const testet = siste(j.tilsyn, (x) => /alarm|aggregat/i.test(x.hva || ''));
  const mangler = ['strom', 'vann', 'brann', 'kontakter', ...(tekniske ? ['ventilasjon', 'alarm'] : [])].filter((k) => !b[k]);
  krav({ id: 'beredskap', navn: `Beredskapsplan${tekniske ? ' med alarm og aggregat' : ''}`, hjemmel: tekniske ? HJEMMEL.fjorfe : HJEMMEL.dyrevelferd, status: mangler.length ? (mangler.length > 3 ? 'mangler' : 'delvis') : tekniske && dagerSiden(testet, idag) > 365 ? 'delvis' : 'ok', tekst: mangler.length ? `Fyll inn: ${mangler.map((k) => ({ strom: 'strømbrudd', vann: 'vannforsyning', brann: 'brann', kontakter: 'kontaktpersoner', ventilasjon: 'ventilasjon', alarm: 'alarm' }[k])).join(', ')}.` : tekniske ? (testet ? `Alarm/aggregat sist testet ${testet}.` : 'Test alarm og aggregat jevnlig, og før det i tilsynsloggen.') : 'Planen er fylt ut.' });
  // Smittevern.
  krav({ id: 'smittevern', navn: 'Smittevern og besøk', hjemmel: HJEMMEL.dyrehelse, journal: 'besok', status: m.virksomhet.smittevern ? 'ok' : 'delvis', tekst: m.virksomhet.smittevern ? `Rutine: ${m.virksomhet.smittevern}` : 'Beskriv smittesluse, besøksrutine og karantene for nye dyr. Før besøkende som går inn i dyrerommet.' });
  // Løsdrift for storfe.
  const bas = (S?.skifteplan?.dyrehold?.rom || []).filter((r) => r.type === 'basfjos');
  if (g.has('Storfe') && bas.length) krav({ id: 'losdrift', navn: 'Løsdrift for storfe innen 1. januar 2034', hjemmel: HJEMMEL.storfe, status: 'delvis', tekst: `${bas.map((r) => r.navn || 'Båsfjøs').join(', ')} er registrert som båsfjøs. Båsfjøs bygd før 22. april 2004 og i sammenhengende bruk kan brukes til 31. desember 2033 (§ 32). Planlegg ombygging – det finnes investeringsstøtte (Tilskudd-fanen).` });
  return ut;
}
export const STATUS = { ok: { navn: 'OK', farge: '#0ca30c' }, delvis: { navn: 'Delvis', farge: '#e0a800' }, mangler: { navn: 'Mangler', farge: '#d03b3b' }, avvik: { navn: 'Avvik', farge: '#d03b3b' }, info: { navn: 'Info', farge: '#2a78d6' } };

// CSV for én journal.
export function csv(S, nokkel) {
  const def = JOURNALER[nokkel]; const rader = (sikre(S).journal[nokkel] || []).slice().sort((a, b) => String(a.dato).localeCompare(String(b.dato)));
  const v = (x, f) => { const y = x[f[0]]; return f[2] === 'bool' ? (y ? 'Ja' : 'Nei') : f[2] === 'slag' ? (DYRESLAG[y]?.navn || y || '') : y ?? ''; };
  return [def.felt.map((f) => f[1]), ...rader.map((x) => def.felt.map((f) => v(x, f)))].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
}
