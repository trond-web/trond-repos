// Demostevne for å prøve løsningen. Programmene er egne øvingsprogram i samme oppsett som NRYFs protokoller
// (NRYFs program er opphavsrettslig beskyttet og legges inn av arrangøren i programredigeringen).
import { hashPassord, lagPassord, lagKode } from './auth.js';
import { tomDatabase } from './lagring.js';

const HELHET_L = [
  { tekst: 'Takt – rene og regelmessige gangarter', koeff: 2 },
  { tekst: 'Løsgjorthet og kontakt – harmoni, aksept av hjelperne', koeff: 2 },
  { tekst: 'Rytterens sits og hjelpere', koeff: 2 },
  { tekst: 'Nøyaktighet – riktig bruk av banens veier', koeff: 2 },
];

export const DEMOPROGRAMMER = [
  {
    id: 'demo-lc', navn: 'Øvingsprogram LC', nivaa: 'LC', type: 'standard', bane: '20 x 40 m', bisling: 'Trinse', tid: 5, karakterSteg: 0.5,
    ovelser: [
      { punkt: 'A–X', tekst: 'Innridning i arbeidstrav, holdt – hilsning – fremridning', koeff: 1 },
      { punkt: 'C–E', tekst: 'Venstre hånd, arbeidstrav', koeff: 1 },
      { punkt: 'E', tekst: 'Volte 15 m', koeff: 1 },
      { punkt: 'K–X–M', tekst: 'Vend igjennom, vis forlenging av steget', koeff: 2 },
      { punkt: 'C', tekst: 'Overgang til mellomskritt', koeff: 1 },
      { punkt: 'H–X–F', tekst: 'Fritt skritt', koeff: 2 },
      { punkt: 'F–A', tekst: 'Mellomskritt, ta tøylene', koeff: 1 },
      { punkt: 'A', tekst: 'Arbeidstrav, deretter venstre arbeidsgalopp', koeff: 1 },
      { punkt: 'E–B–E', tekst: 'Storvolte i arbeidsgalopp', koeff: 1 },
      { punkt: 'E–K', tekst: 'Arbeidstrav (overgangen)', koeff: 1 },
      { punkt: 'F', tekst: 'Høyre arbeidsgalopp, storvolte ved B', koeff: 1 },
      { punkt: 'M–C', tekst: 'Arbeidstrav (overgangen)', koeff: 1 },
      { punkt: 'A–X', tekst: 'Vend opp midtlinjen, holdt – hilsning', koeff: 1 },
    ],
    helhet: HELHET_L,
  },
  {
    id: 'demo-la', navn: 'Øvingsprogram LA', nivaa: 'LA', type: 'standard', bane: '20 x 60 m', bisling: 'Trinse', tid: 6, karakterSteg: 0.5,
    ovelser: [
      { punkt: 'A–X', tekst: 'Innridning i samlet trav, holdt – hilsning', koeff: 1 },
      { punkt: 'C–M–B', tekst: 'Høyre hånd, arbeidstrav', koeff: 1 },
      { punkt: 'B–X', tekst: 'Sjenkelvikning', koeff: 2 },
      { punkt: 'F–X–H', tekst: 'Mellomtrav', koeff: 2 },
      { punkt: 'C', tekst: 'Holdt, rygging 4 steg', koeff: 1 },
      { punkt: 'M–X–K', tekst: 'Fritt skritt', koeff: 2 },
      { punkt: 'K–A–F', tekst: 'Mellomskritt', koeff: 1 },
      { punkt: 'F', tekst: 'Høyre arbeidsgalopp', koeff: 1 },
      { punkt: 'B', tekst: 'Volte 15 m', koeff: 1 },
      { punkt: 'H–X–F', tekst: 'Mellomgalopp', koeff: 1 },
      { punkt: 'A', tekst: 'Kontragalopp gjennom kortsiden', koeff: 1 },
      { punkt: 'K–X–M', tekst: 'Enkelt galoppombytte over X', koeff: 1 },
      { punkt: 'C', tekst: 'Arbeidstrav, deretter A–X holdt – hilsning', koeff: 1 },
    ],
    helhet: HELHET_L,
  },
  {
    id: 'demo-kur-mb', navn: 'Kür MB (øving)', nivaa: 'MB', type: 'kur', bane: '20 x 60 m', bisling: 'Valgfri', tid: 5, kurTid: '4:30–5:00', karakterSteg: 0.5,
    ovelser: [
      { punkt: '', tekst: 'Samlet skritt', koeff: 1 },
      { punkt: '', tekst: 'Øket skritt', koeff: 2 },
      { punkt: '', tekst: 'Versade i trav til høyre og venstre', koeff: 1 },
      { punkt: '', tekst: 'Øket trav', koeff: 1 },
      { punkt: '', tekst: 'Travers i galopp til høyre og venstre', koeff: 1 },
      { punkt: '', tekst: 'Changement', koeff: 1 },
      { punkt: '', tekst: 'Øket galopp', koeff: 1 },
      { punkt: '', tekst: 'Innridning og avslutning med holdt', koeff: 1 },
    ],
    helhet: [
      { tekst: 'Rytme, energi og elastisitet', koeff: 3 },
      { tekst: 'Harmoni mellom hest og rytter', koeff: 3, rolle: 'harmoni' },
      { tekst: 'Koreografi – bruk av banen, oppfinnsomhet', koeff: 4, rolle: 'koreografi' },
      { tekst: 'Vanskelighetsgrad', koeff: 3 },
      { tekst: 'Musikk og tolkning av musikken', koeff: 3 },
    ],
  },
];

export function lagDemo(dato = new Date()) {
  const d = new Date(dato.getTime() + 14 * 86400_000);
  const iso = d.toISOString().slice(0, 10);
  const frist = new Date(d.getTime() - 5 * 86400_000).toISOString().slice(0, 10) + 'T23:59';
  const db = tomDatabase();
  db.stevne = {
    navn: 'Høstdressur på Rud', sted: 'Rud ridesenter', arrangor: 'Rud rideklubb', stevnenivaa: 'D', datoFra: iso, datoTil: iso,
    pameldingsfrist: frist, tillatEtteranmelding: true, etteranmeldingsgebyr: 200, overdommer: 'Kari Nordmann', kontakt: 'sekretariat@example.no',
    info: 'Oppvarming på utebanen fra kl. 08.30. Startlister publiseres senest dagen før.',
  };
  db.programmer = DEMOPROGRAMMER.map((p) => structuredClone(p));
  const passord = { kari: lagPassord(), ola: lagPassord() };
  db.dommere = [
    { id: 'd-kari', navn: 'Kari Nordmann', brukernavn: 'kari', autorisasjon: 'Nasjonal dommer', epost: '', passordHash: hashPassord(passord.kari) },
    { id: 'd-ola', navn: 'Ola Hansen', brukernavn: 'ola', autorisasjon: 'Distriktsdommer', epost: '', passordHash: hashPassord(passord.ola) },
  ];
  const felles = { dato: iso, intervall: 7, pauseEtter: 8, pauseMin: 15, startavgift: 350, apen: true, status: 'planlagt', premieAndel: 0.25, maksStartende: 40, offisiell: false };
  db.klasser = [
    { id: 'k1', nr: 1, navn: 'LC åpen', programId: 'demo-lc', starttid: '09:00', dommere: { C: 'd-kari', E: 'd-ola' }, ...felles },
    { id: 'k2', nr: 2, navn: 'LA åpen', programId: 'demo-la', starttid: '11:00', dommere: { C: 'd-kari', E: 'd-ola' }, ...felles },
    { id: 'k3', nr: 3, navn: 'Kür MB', programId: 'demo-kur-mb', starttid: '13:30', intervall: 8, dommere: { C: 'd-kari', H: 'd-ola' }, ...felles, maksStartende: 20 },
  ];
  const ekvipasjer = [
    ['Ingrid Berg', 2006, 'Rud rideklubb', 'Solvind', 2014, 'Hoppe'],
    ['Maja Lie', 2010, 'Gran rideklubb', 'Prins Oskar', 2012, 'Vallak'],
    ['Sofie Dahl', 1995, 'Hadeland rideklubb', 'Cassandra', 2016, 'Hoppe'],
    ['Nora Bakken', 2008, 'Rud rideklubb', 'Dancer', 2015, 'Vallak'],
    ['Emma Holm', 1988, 'Lunner rideklubb', 'Fiorella', 2013, 'Hoppe'],
    ['Ingrid Berg', 2006, 'Rud rideklubb', 'Tindra', 2017, 'Hoppe'],
  ];
  const opprettet = new Date().toISOString();
  ekvipasjer.forEach(([navn, fa, klubb, hest, hfa, kjonn], i) => {
    const kode = lagKode();
    const klasser = i % 3 === 2 ? ['k2', 'k3'] : i % 2 ? ['k1', 'k2'] : ['k1'];
    for (const klasseId of klasser) {
      db.paameldinger.push({
        id: `p${db.paameldinger.length + 1}`, kode, klasseId, status: 'pameldt', etteranmeldt: false, betalt: false, opprettet,
        rytter: { navn, fodselsaar: fa, klubb, lisens: '', epost: `${navn.split(' ')[0].toLowerCase()}@example.no`, tlf: '' },
        hest: { navn: hest, pass: '', fodselsaar: hfa, kjonn, type: 'hest', eier: '' },
        startnr: null, startrekke: null, starttid: null,
      });
    }
  });
  return { db, passord };
}
