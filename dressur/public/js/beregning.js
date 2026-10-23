// Resultatberegning for dressur etter NRYF KR IV (09.03.2026), § 450–455.
// Brukes både av serveren og i nettleseren, så ingen avhengigheter.

export const POSISJONER = ['C', 'E', 'H', 'M', 'B'];
export const NIVAAER = ['LD', 'LC', 'LB', 'LA', 'MC', 'MB', 'MA', 'VB', 'VA'];
// § 423: minstealder for hest per klassenivå
export const MINSTEALDER = { MB: 6, MA: 7, VB: 7, VA: 9 };
// § 424.3: hest som starter MA eller høyere kan bare starte én klasse per dag
export const EN_KLASSE_PER_DAG = ['MA', 'VB', 'VA'];

export const KARAKTERNAVN = {
  10: 'Utmerket', 9: 'Meget bra', 8: 'Bra', 7: 'Ganske bra', 6: 'Tilfredsstillende', 5: 'Godkjent',
  4: 'Ikke tilfredsstillende', 3: 'Ganske dårlig', 2: 'Dårlig', 1: 'Meget dårlig', 0: 'Ikke utført',
};

// Tekniske feil som gir -0,5 prosentpoeng per gang hos hver dommer (§ 450.2.b)
export const TEKNISKE_FEIL = [
  { kode: 'hilsen', tekst: 'Ikke korrekt utført hilsen' },
  { kode: 'for-tidlig', tekst: 'Start før startsignal er gitt' },
  { kode: '45sek', tekst: 'Start mer enn 45 sek etter startsignal' },
  { kode: 'antrekk', tekst: 'Avvik fra antrekk som ikke gir eliminering' },
  { kode: 'pisk', tekst: 'Start med pisk der det ikke er tillatt' },
  { kode: 'benbelegg', tekst: 'Start med belegg på hestens ben' },
  { kode: 'kur-musikk', tekst: 'Kür: signal til musikk mer enn 45 sek etter startsignal' },
  { kode: 'kur-20sek', tekst: 'Kür: start mer enn 20 sek etter at musikken startet' },
];
export const ELIMINERINGSGRUNNER = [
  'Tre feilridninger', 'Sporer, hjelm eller tekniske hjelpemidler i strid med reglene', 'Saling/bisling i strid med reglene',
  'Start mer enn 120 sek etter startsignal', 'Halt hest', 'Friskt blod', 'Styrt eller fall', 'Ekvipasjen forlot banen',
  'Ikke tillatt hjelp', 'Hesten leid inn på/ut av banen', 'Alvorlig ulydighet', 'Behersker åpenbart ikke klassens nivå',
  'Avstraffelse eller utilbørlig bruk av hjelperne', 'Musikken sviktet to ganger (kür)', 'Annet',
];

export const GODKJENT_GRENSE = 50; // § 450.5.c
export const DOMMERMOTE_AVVIK = 7; // § 450.6

// Avrunding til 3 desimaler, fjerde siffer 1–4 ned og 5–9 opp (§ 450.5.a). toFixed fjerner flyttallsstøy først.
export function rund3(x) {
  if (x == null || !Number.isFinite(x)) return null;
  return Math.round(Number((x * 1000).toFixed(6))) / 1000;
}

export function formatProsent(x) {
  return x == null ? '' : rund3(x).toFixed(3).replace('.', ',');
}

export function formatKarakter(x) {
  if (x == null || x === '') return '';
  return String(x).replace('.', ',');
}

// Alle bedømmingspunkter i protokollen med faste id-er: o1.. for øvelser, h1.. for allment inntrykk/kunstnerisk.
export function punkter(program) {
  const steg = Number(program.karakterSteg) || 0.5;
  const kur = program.type === 'kur';
  const ovelser = (program.ovelser || []).map((o, i) => ({
    id: `o${i + 1}`, del: 'ovelse', nr: o.nr ?? i + 1, punkt: o.punkt || '', tekst: o.tekst || '', koeff: Number(o.koeff) || 1, steg,
  }));
  const helhet = (program.helhet || []).map((h, i) => ({
    id: `h${i + 1}`, del: 'helhet', nr: h.nr ?? `${i + 1}`, punkt: '', tekst: h.tekst || '', koeff: Number(h.koeff) || 1,
    steg: Number(h.steg) || (kur ? 0.1 : steg), rolle: h.rolle || '',
  }));
  return [...ovelser, ...helhet];
}

export function maksPoeng(program, del) {
  return punkter(program).filter((p) => !del || p.del === del).reduce((s, p) => s + p.koeff * 10, 0);
}

export function gyldigKarakter(verdi, steg = 0.5) {
  const v = Number(verdi);
  if (verdi === '' || verdi == null || !Number.isFinite(v) || v < 0 || v > 10) return false;
  const n = v / steg;
  return Math.abs(n - Math.round(n)) < 1e-9;
}

// Feilridning: -0,5 første gang, -1,0 andre gang (til sammen -1,5), eliminering tredje gang (§ 450.2.a)
export function feilridningTrekk(antall) {
  const n = Number(antall) || 0;
  if (n >= 3) return null;
  return [0, 0.5, 1.5][n];
}

export function trekkProsent(program, fradrag = {}) {
  const tekniske = (fradrag.tekniske || []).length * 0.5;
  if (program.type === 'kur') return tekniske; // ingen feilridning i kür (§ 450.3.a)
  return (feilridningTrekk(fradrag.feilridning) ?? 0) + tekniske;
}

export function erEliminert(program, fradrag = {}) {
  return !!fradrag.eliminert || (program.type !== 'kur' && (Number(fradrag.feilridning) || 0) >= 3);
}

// Én dommers protokoll → poeng og prosent (§ 450.5.a)
export function dommerResultat(program, protokoll = {}, fradrag = {}) {
  const k = protokoll.karakterer || {};
  const alle = punkter(program);
  const mangler = alle.filter((p) => !gyldigKarakter(k[p.id], p.steg)).map((p) => p.id);
  const sum = (del) => alle.filter((p) => p.del === del && gyldigKarakter(k[p.id], p.steg)).reduce((s, p) => s + Number(k[p.id]) * p.koeff, 0);
  const ovelsePoeng = sum('ovelse');
  const helhetPoeng = sum('helhet');
  const poeng = ovelsePoeng + helhetPoeng;
  const maks = maksPoeng(program);
  const komplett = mangler.length === 0 && maks > 0;
  let prosent = null; let tekniskProsent = null; let kunstProsent = null;
  if (komplett) {
    if (program.type === 'kur') {
      tekniskProsent = (ovelsePoeng / maksPoeng(program, 'ovelse')) * 100;
      kunstProsent = (helhetPoeng / maksPoeng(program, 'helhet')) * 100 - (fradrag.kurTidAvvik ? 0.5 : 0); // § 451.4.b
      prosent = (tekniskProsent + kunstProsent) / 2 - trekkProsent(program, fradrag);
    } else {
      prosent = (poeng / maks) * 100 - trekkProsent(program, fradrag);
    }
  }
  const rolle = (r) => alle.filter((p) => p.rolle === r).reduce((s, p) => s + (Number(k[p.id]) || 0), 0);
  return {
    poeng, maks, ovelsePoeng, helhetPoeng, komplett, mangler,
    prosent: prosent == null ? null : rund3(prosent),
    tekniskProsent: rund3(tekniskProsent), kunstProsent: rund3(kunstProsent),
    harmoni: rolle('harmoni'), koreografi: rolle('koreografi'),
  };
}

// Karakterer 0–4 skal alltid begrunnes (§ 461.2.a). Gir liste over punkter som mangler kommentar.
export function manglerBegrunnelse(program, protokoll = {}) {
  const k = protokoll.karakterer || {};
  const kom = protokoll.kommentarer || {};
  return punkter(program).filter((p) => gyldigKarakter(k[p.id], p.steg) && Number(k[p.id]) <= 4 && !String(kom[p.id] || '').trim()).map((p) => p.id);
}

// Øvelse som ikke ble vist pga. feilridning som ikke ble oppdaget, får snittet av de andre øvelsene (§ 450.3.f)
export function snittAvAndre(program, protokoll, id) {
  const k = protokoll.karakterer || {};
  const ov = punkter(program).filter((p) => p.del === 'ovelse' && p.id !== id && gyldigKarakter(k[p.id], p.steg));
  if (!ov.length) return null;
  const snitt = ov.reduce((s, p) => s + Number(k[p.id]), 0) / ov.length;
  const steg = punkter(program).find((p) => p.id === id)?.steg || 0.5;
  return Math.round(snitt / steg) * steg;
}

// Samlet resultat for én ekvipasje. dommere: { C: dommerId, ... }, protokoller: { C: {...}, ... }
export function ekvipasjeResultat(program, dommere, protokoller = {}, fradrag = {}, pameldingStatus = 'pameldt') {
  const posisjoner = POSISJONER.filter((p) => dommere?.[p]);
  const perDommer = {};
  for (const pos of posisjoner) {
    const prot = protokoller[pos] || {};
    const r = dommerResultat(program, prot, fradrag);
    perDommer[pos] = { ...r, signert: !!prot.signert, prosent: prot.signert ? r.prosent : null };
  }
  const base = { perDommer, prosent: null, helhetSum: 0, kunstSum: 0, harmoniSum: 0, koreografiSum: 0, avvik: null, dommermote: false };
  if (pameldingStatus === 'trukket') return { ...base, status: 'trukket' };
  if (fradrag.ikkeStartet) return { ...base, status: 'ikke-startet' };
  const signerte = posisjoner.filter((p) => perDommer[p].signert && perDommer[p].prosent != null);
  const elim = erEliminert(program, fradrag);
  const startet = elim || posisjoner.some((p) => Object.keys(protokoller[p]?.karakterer || {}).length);
  if (!startet) return { ...base, status: 'ikke-startet-enda' };
  const prosenter = signerte.map((p) => perDommer[p].prosent);
  const prosent = prosenter.length ? rund3(prosenter.reduce((a, b) => a + b, 0) / prosenter.length) : null;
  const avvik = prosenter.length > 1 ? rund3(Math.max(...prosenter) - Math.min(...prosenter)) : null;
  const sumAv = (felt) => signerte.reduce((s, p) => s + perDommer[p][felt], 0);
  const res = {
    ...base, prosent, avvik, dommermote: avvik != null && avvik >= DOMMERMOTE_AVVIK,
    helhetSum: sumAv('helhetPoeng'), kunstSum: sumAv('helhetPoeng'), harmoniSum: sumAv('harmoni'), koreografiSum: sumAv('koreografi'),
    antallSignert: signerte.length, antallDommere: posisjoner.length,
  };
  if (elim) return { ...res, prosent: null, status: 'eliminert', elimGrunn: fradrag.elimGrunn || (Number(fradrag.feilridning) >= 3 ? 'Tre feilridninger' : '') };
  if (signerte.length && signerte.length === posisjoner.length) return { ...res, status: 'ferdig' };
  if (signerte.length) return { ...res, status: 'foreløpig' };
  return { ...res, status: 'under-bedomming' };
}

// Ved likt sluttresultat på de tre første plassene går høyest sum for allment inntrykk foran,
// i kür kunstnerisk inntrykk, deretter harmoni og koreografi (§ 450.5.b).
function likhetsNokler(program, r) {
  return program.type === 'kur' ? [r.kunstSum, r.harmoniSum, r.koreografiSum] : [r.helhetSum];
}
function sammenlignNokler(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
  return 0;
}

// rader: [{ id, resultat }] → samme rader sortert, med plassering, godkjent og premie
export function rangering(program, klasse = {}, rader = []) {
  const medProsent = rader.filter((r) => r.resultat.prosent != null && ['ferdig', 'foreløpig'].includes(r.resultat.status));
  const uten = rader.filter((r) => !medProsent.includes(r));
  const startende = rader.filter((r) => !['trukket', 'ikke-startet'].includes(r.resultat.status)).length;
  const andel = klasse.premieAndel == null ? 0.25 : Number(klasse.premieAndel);
  const antallPremier = startende ? Math.max(1, Math.ceil(startende * andel)) : 0;

  medProsent.sort((a, b) => (b.resultat.prosent - a.resultat.prosent) || sammenlignNokler(likhetsNokler(program, a.resultat), likhetsNokler(program, b.resultat)));
  const ut = [];
  let forrige = null;
  medProsent.forEach((r, i) => {
    const godkjent = r.resultat.prosent >= GODKJENT_GRENSE;
    let plassering = null; let premie = false; let clearRound = false;
    if (klasse.clearRound) {
      clearRound = godkjent; premie = godkjent;
    } else if (godkjent) {
      plassering = i + 1;
      if (forrige && forrige.resultat.prosent === r.resultat.prosent) {
        const avgjortVedLikhet = forrige.plassering <= 3 && sammenlignNokler(likhetsNokler(program, forrige.resultat), likhetsNokler(program, r.resultat)) !== 0;
        if (!avgjortVedLikhet) plassering = forrige.plassering;
      }
      premie = plassering <= antallPremier;
    }
    const rad = { ...r, plassering, godkjent, premie, clearRound };
    ut.push(rad);
    if (plassering) forrige = rad;
  });
  const rekkefolge = { 'under-bedomming': 0, 'ikke-startet-enda': 1, eliminert: 2, 'ikke-startet': 3, trukket: 4 };
  uten.sort((a, b) => (rekkefolge[a.resultat.status] ?? 9) - (rekkefolge[b.resultat.status] ?? 9));
  return { rader: [...ut, ...uten.map((r) => ({ ...r, plassering: null, godkjent: false, premie: false, clearRound: false }))], startende, antallPremier };
}

export const STATUSTEKST = {
  ferdig: 'Ferdig', 'foreløpig': 'Foreløpig', 'under-bedomming': 'Under bedømming', 'ikke-startet-enda': 'Ikke startet',
  eliminert: 'Eliminert', 'ikke-startet': 'Startet ikke', trukket: 'Trukket',
};
