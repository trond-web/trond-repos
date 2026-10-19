// Regelmotor for skogsprotokoll på jaktprøver for drivende hunder (harehund).
// Bygger på «Regler for jaktprøver for hunder tilsluttet NHKF», gjeldende fra 01.07.2025
// (kap. 11.4 EP, 14 gjennomføring og 15 bedømmelse og premiering).
// Ren logikk uten DOM, slik at den kan testes med node.

export const MIN = 60000;

export const LOSDYR = {
  hare: 'Hare', rev: 'Rev', radyr: 'Rådyr', hjort: 'Hjort', ukjent: 'Ukjent losdyr',
};

// Støvere premieres på hare og rev. Beagle/drever (småhund) også på rådyr og hjort (kap. 14.4).
export const LOVLIGE_LOSDYR = { stover: ['hare', 'rev'], smahund: ['hare', 'rev', 'radyr', 'hjort'] };

// Rasene NHKF har ansvar for (nhkf.net/raser). Beagle og drever prøves som småhund.
export const RASER = [
  ['Bernerstøver', 'stover'], ['Dunker', 'stover'], ['Finsk støver', 'stover'], ['Gotlandsstøver', 'stover'],
  ['Haldenstøver', 'stover'], ['Hamiltonstøver', 'stover'], ['Hygen', 'stover'], ['Istarski korthåret støver', 'stover'],
  ['Istarski strihåret støver', 'stover'], ['Jurastøver', 'stover'], ['Luzernstøver', 'stover'], ['Russisk flekket støver', 'stover'],
  ['Russisk støver', 'stover'], ['Schillerstøver', 'stover'], ['Schweizerstøver', 'stover'], ['Smålandsstøver', 'stover'],
  ['Beagle', 'smahund'], ['Drever', 'smahund'],
];

export function gruppeForRase(rase) {
  const r = RASER.find(([navn]) => navn.toLowerCase() === String(rase || '').trim().toLowerCase());
  if (r) return r[1];
  return /beagle|drever/i.test(rase || '') ? 'smahund' : 'stover';
}

// Egenskapsmomenter med vekttall (kap. 15.5). Maks egenskapspoeng = 5 × 16 = 80.
export const MOMENTER = [
  { id: 'jaktlyst', nr: '1', navn: 'Jaktlyst', vekt: 3 },
  { id: 'samarbeid', nr: '2', navn: 'Søk og samarbeid', vekt: 1 },
  { id: 'fotarbeid', nr: '3', navn: 'Fotarbeid/evne til uttak', vekt: 2 },
  { id: 'malbrukFot', nr: '4a', navn: 'Målbruk i fot', vekt: 1 },
  { id: 'malbrukTap', nr: '4b', navn: 'Målbruk i tap', vekt: 2 },
  { id: 'arbeidLos', nr: '5a', navn: 'Arbeid i los', vekt: 2 },
  { id: 'arbeidTap', nr: '5b', navn: 'Arbeid i tap', vekt: 2 },
  { id: 'nyansering', nr: '6a', navn: 'Mål – nyansering', vekt: 1 },
  { id: 'horbarhet', nr: '6b', navn: 'Mål – hørbarhet og kvalitet', vekt: 2 },
];

// Tilleggspoeng for konkurranser (kap. 15.6). Teller ikke for premiegrad.
export const TILLEGG = [
  { id: 'kondisjon', nr: '7', navn: 'Kondisjon/styrke', vekt: 1 },
  { id: 'lydighet', nr: '8', navn: 'Lydighet', vekt: 1 },
];

export const SKALA = { 1: 'Dårlig', 2: 'Mindre godt', 3: 'Godt', 4: 'Meget godt', 5: 'Særdeles godt' };

export const UTFALL = {
  G: 'Graverende feil / utslått',
  T: 'Trukket uten gyldig grunn',
  U: 'Avsluttet pga. uforsvarlig vær/føre',
  A: 'Alvorlig, akutt skade',
};

// Premiekrav (kap. 15.7). Alle tall er minimum, unntatt full lostid som også er maks.
export const PREMIEKRAV = {
  stover_hare: [{ grad: 1, pp: 175, los: 120, ep: 55 }, { grad: 2, pp: 135, los: 90, ep: 45 }, { grad: 3, pp: 95, los: 60, ep: 35 }],
  stover_rev: [{ grad: 1, pp: 145, los: 90, ep: 55 }, { grad: 2, pp: 105, los: 60, ep: 45 }, { grad: 3, pp: 75, los: 40, ep: 35 }],
  smahund: [{ grad: 1, pp: 145, los: 90, ep: 55 }, { grad: 2, pp: 105, los: 60, ep: 45 }, { grad: 3, pp: 75, los: 40, ep: 35 }],
};

export function kravTabell(gruppe, losdyr) {
  if (gruppe === 'smahund') return LOVLIGE_LOSDYR.smahund.includes(losdyr) ? PREMIEKRAV.smahund : null;
  if (losdyr === 'hare') return PREMIEKRAV.stover_hare;
  if (losdyr === 'rev') return PREMIEKRAV.stover_rev;
  return null;
}

// Maks lospoeng per los = full tid: støver 120 på hare, 90 på rev; beagle/drever 90.
export function maksLospoeng(gruppe, losdyr) {
  if (gruppe === 'smahund') return 90;
  return losdyr === 'hare' ? 120 : 90;
}

export function premiegradFor(gruppe, losdyr, lospoeng, egenskapspoeng) {
  const tab = kravTabell(gruppe, losdyr);
  if (!tab) return 0;
  for (const k of tab) if (lospoeng >= k.los && egenskapspoeng >= k.ep && lospoeng + egenskapspoeng >= k.pp) return k.grad;
  return 0;
}

// Hva som mangler for neste premiegrad – nyttig for dommeren underveis.
export function manglerTil(gruppe, losdyr, lospoeng, egenskapspoeng) {
  const tab = kravTabell(gruppe, losdyr);
  if (!tab) return [];
  return tab.map((k) => ({
    grad: k.grad,
    los: Math.max(0, k.los - lospoeng),
    ep: Math.max(0, k.ep - egenskapspoeng),
    pp: Math.max(0, k.pp - lospoeng - egenskapspoeng),
  }));
}

// Kobling som avbryter losen av grunner der en ny los på samme art senere skal slås sammen (kap. 15.4).
export const KOBLINGSGRUNNER = {
  pause: 'Kobling / pause',
  fulltid: 'Jaget full tid',
  lib: 'Losdyr gått inn (LIB)',
  samjag: 'Samjag / fremmed hund',
  fare: 'Fare for hundens liv og helse',
  forulykket: 'Losdyr forulykket / sykt / skadet',
  flytting: 'Flytting til ny terrengdel',
};
const SAMMENSLAA_ETTER = new Set(['lib', 'samjag', 'fare', 'forulykket']);

export const HENDELSER = {
  slipp: 'Slipp',
  kobling: 'Kobling',
  fot: 'Fot / fotarbeid',
  uttak: 'Uttak – los',
  tap: 'Tap',
  gjentak: 'Gjentak',
  utav: 'Ut av hørehold',
  inn: 'Inn i hørehold',
  stalosStart: 'Stålos (hjort)',
  stalosSlutt: 'Stålos slutt',
  lib: 'Losdyr gått inn (LIB)',
  slutt: 'Slutt los / dødtap',
  settLosdyr: 'Losdyr sett',
  settHund: 'Hund sett',
  klovStart: 'Klovdyrjag start',
  klovSlutt: 'Klovdyrjag slutt',
  innkalling: 'Innkalling',
  notat: 'Notat',
  avslutt: 'Prøven avsluttet',
};

export function sorterHendelser(hendelser) {
  return [...(hendelser || [])].sort((a, b) => a.t - b.t || (a.seq || 0) - (b.seq || 0));
}

// Leser hendelsesloggen fra skogen og bygger opp løs-tid, loser med segmenter og klovdyrjag.
// `naa` brukes for en pågående prøve: åpne tilstander regnes fram til dette tidspunktet.
export function lesLogg(prove, naa = null) {
  const hend = sorterHendelser(prove.hendelser);
  const loser = [];
  const klovdyr = [];
  const innkallinger = [];
  const varsler = [];
  let los = false; let losFra = 0; let losTid = 0;
  let cur = null; let modus = null; let modusFra = 0;
  let fot = null; let harVaertIFot = false;
  let klov = null;
  let sisteKobling = null;
  let slipp = null; let slutt = null;
  let avsluttet = false;

  const lukkModus = (t, ekstra = {}) => {
    if (cur && modus) cur.seg.push({ type: modus, fra: modusFra, til: t, ...ekstra });
    modus = null;
  };
  const avsluttLos = (t, grunn) => {
    if (!cur) return;
    if (modus === 'tap') lukkModus(t, { siste: true });
    else lukkModus(t);
    cur.slutt = t;
    cur.sluttGrunn = grunn;
    loser.push(cur);
    cur = null;
  };
  const nyLos = (e, losdyr, t, kilde) => {
    const forrige = loser[loser.length - 1];
    cur = {
      id: e.id, losdyr, uttak: t, fot, seg: [], sett: [], hund: 0, lib: false, kilde,
      sammenslaaStandard: !!(forrige && forrige.losdyr === losdyr && SAMMENSLAA_ETTER.has(forrige.sluttGrunn)),
    };
    modus = 'hort'; modusFra = t; fot = null;
  };

  for (const e of hend) {
    const t = e.t;
    switch (e.type) {
      case 'slipp':
        if (!los) { los = true; losFra = t; if (slipp == null) slipp = t; }
        break;
      case 'kobling':
      case 'avslutt': {
        const grunn = e.type === 'avslutt' ? 'avslutt' : (e.grunn || 'pause');
        if (cur) avsluttLos(t, grunn);
        else if (loser.length && grunn !== 'pause' && grunn !== 'avslutt') {
          // Kobling etter at losen er slutt, f.eks. etter LIB: grunnen gjelder den forrige losen.
          const f = loser[loser.length - 1];
          if (!SAMMENSLAA_ETTER.has(f.sluttGrunn)) f.sluttGrunn = grunn;
        }
        if (los) { losTid += t - losFra; los = false; }
        if (klov) { klov.til = t; klovdyr.push(klov); klov = null; }
        fot = null;
        sisteKobling = grunn;
        if (e.type === 'avslutt') { slutt = t; avsluttet = true; }
        break;
      }
      case 'fot':
        if (!cur) { fot = t; harVaertIFot = true; }
        break;
      case 'uttak':
        if (!los) varsler.push({ niva: 'info', tekst: `Uttak kl. ${klokke(t)} er registrert uten at hunden er sluppet.` });
        if (cur) avsluttLos(t, 'nyttUttak');
        nyLos(e, e.losdyr || 'ukjent', t, 'uttak');
        if (cur.fot != null) harVaertIFot = true;
        break;
      case 'tap':
        if (cur && (modus === 'hort' || modus === 'slh')) { lukkModus(t); modus = 'tap'; modusFra = t; }
        break;
      case 'gjentak':
        if (cur && modus === 'tap') {
          if (t - modusFra >= 90 * MIN) {
            // Gjentak etter 90 minutter eller mer regnes som ny los (kap. 15.3).
            const losdyr = cur.losdyr;
            const tapFra = modusFra;
            lukkModus(t, { siste: true });
            cur.slutt = tapFra; cur.sluttGrunn = 'tap90';
            loser.push(cur); cur = null;
            nyLos(e, losdyr, t, 'gjentak90');
          } else { lukkModus(t); modus = 'hort'; modusFra = t; }
        }
        break;
      case 'utav':
        if (cur && modus === 'hort') { lukkModus(t); modus = e.modus === 'LPP' ? 'lpp' : 'luh'; modusFra = t; }
        break;
      case 'inn':
        if (cur && (modus === 'luh' || modus === 'lpp')) {
          if (modus === 'luh' && t - modusFra >= 90 * MIN) {
            // Inn i hørehold etter 90 min eller mer ute av hørehold er ny los. LUH-delen gir ikke tillegg.
            const losdyr = cur.losdyr;
            lukkModus(t, { forLang: true });
            cur.slutt = t; cur.sluttGrunn = 'luh90';
            loser.push(cur); cur = null;
            nyLos(e, losdyr, t, 'luh90');
          } else { lukkModus(t); modus = 'hort'; modusFra = t; }
        }
        break;
      case 'stalosStart':
        if (cur && cur.losdyr === 'hjort' && modus === 'hort') { lukkModus(t); modus = 'slh'; modusFra = t; }
        break;
      case 'stalosSlutt':
        if (cur && modus === 'slh') { lukkModus(t); modus = 'hort'; modusFra = t; }
        break;
      case 'lib':
        if (cur) { cur.lib = true; avsluttLos(t, 'lib'); }
        else if (loser.length) { const f = loser[loser.length - 1]; f.lib = true; f.sluttGrunn = 'lib'; }
        break;
      case 'slutt':
        if (cur) avsluttLos(t, 'dodtap');
        break;
      case 'settLosdyr':
        if (cur) cur.sett.push({ t, avstand: e.avstand || '' });
        break;
      case 'settHund':
        if (cur) cur.hund += 1;
        break;
      case 'klovStart':
        if (!klov) klov = { fra: t, til: null, art: e.art || 'klovdyr' };
        break;
      case 'klovSlutt':
        if (klov) { klov.til = t; klovdyr.push(klov); klov = null; }
        break;
      case 'innkalling':
        innkallinger.push({ t, fra: e.fra || '', utenforSyn: !!e.utenforSyn, lyktes: e.lyktes !== false });
        break;
      default:
        break;
    }
  }

  const sist = hend.length ? hend[hend.length - 1].t : 0;
  const ende = naa != null && !avsluttet ? Math.max(naa, sist) : sist;
  let tilstand = { los, modus: cur ? modus : null, modusFra, losdyr: cur ? cur.losdyr : null, fot: fot != null, klov: !!klov };
  let paagaaende = null;
  if (cur) {
    // Pågående los: lukk virtuelt ved `ende` (et åpent tap regnes som tap inntil det er avklart).
    const kopi = { ...cur, seg: [...cur.seg], aapen: true };
    if (modus) kopi.seg.push({ type: modus, fra: modusFra, til: ende, aapen: true, ...(modus === 'tap' ? { siste: true } : {}) });
    kopi.slutt = ende;
    loser.push(kopi);
    paagaaende = kopi;
  }
  if (los) losTid += ende - losFra;
  if (klov) klovdyr.push({ ...klov, til: ende, aapen: true });

  return {
    loser, klovdyr, innkallinger, varsler, losTid, harVaertIFot, slipp, slutt, avsluttet, sisteKobling,
    tilstand, paagaaende, ende,
  };
}

// Regner ut minutter og lospoeng for én del-los (én los fra uttak til slutt).
function delLos(los, gruppe) {
  const klipp = (los.losdyr === 'radyr' || los.losdyr === 'hjort') ? los.uttak + 180 * MIN : Infinity;
  let hort = 0; let lpp = 0; let slh = 0; let sekv = 0;
  const luh = []; const sekvenser = []; const tap = [];
  for (const s of los.seg) {
    const fra = Math.min(s.fra, klipp); const til = Math.min(s.til, klipp);
    const d = Math.max(0, til - fra);
    if (s.type === 'hort') { hort += d; sekv += d; continue; }
    if (s.type === 'tap' && !s.siste && !s.aapen && s.til - s.fra < 5 * MIN) { hort += d; sekv += d; continue; } // ikke noterbart tap
    if (sekv) { sekvenser.push(sekv); sekv = 0; }
    if (s.type === 'tap' && !s.siste && !s.aapen) tap.push(s.til - s.fra);
    else if (s.type === 'luh' && !s.forLang) luh.push(d);
    else if (s.type === 'lpp') lpp += d;
    else if (s.type === 'slh') slh += d;
  }
  if (sekv) sekvenser.push(sekv);
  // Streking av losminutter starter ett minutt etter at uttaket er registrert (kap. 15.3).
  const hortMin = Math.max(0, Math.floor(hort / MIN) - 1);
  const luhMin = luh.reduce((s, d) => s + Math.min(20, Math.floor(d / MIN)), 0);
  const lppMin = Math.floor(lpp / MIN);
  const slhMin = Math.min(20, Math.floor(slh / MIN));
  // LUH og LPP kan til sammen ikke overstige antall minutter hørt los.
  const luhLpp = Math.min(luhMin + lppMin, hortMin);
  const sisteTelte = [...los.seg].reverse().find((s) => s.type !== 'tap' || (!s.siste && !s.aapen));
  return {
    hortMin, luhMin, lppMin, slhMin, luhLpp, sekvenser, tap,
    sluttLos: sisteTelte ? Math.min(sisteTelte.til, klipp) : los.uttak,
    fotTilUttak: los.fot != null ? Math.round((los.uttak - los.fot) / MIN) : null,
    tidTil: (maal) => tidTilPoeng(los, maal, klipp),
  };
}

// Tid fra uttak til hunden har oppnådd `maal` lospoeng (hørt los, ikke noterbare tap, LUH-tillegg, peil).
function tidTilPoeng(los, maal, klipp) {
  let p = -1; // første minutt etter uttak strekes ikke
  for (const s of los.seg) {
    const fra = Math.min(s.fra, klipp); const til = Math.min(s.til, klipp);
    const d = (til - fra) / MIN;
    const teller = s.type === 'hort' || s.type === 'lpp' || s.type === 'slh'
      || (s.type === 'tap' && !s.siste && !s.aapen && s.til - s.fra < 5 * MIN);
    if (teller) {
      if (p + d >= maal) return Math.round((fra + (maal - p) * MIN - los.uttak) / MIN);
      p += d;
    } else if (s.type === 'luh' && !s.forLang) {
      p += Math.min(20, Math.floor(d));
      if (p >= maal) return Math.round((til - los.uttak) / MIN);
    }
  }
  return null;
}

// Slår sammen loser til grupper. Hver gruppe er en mulig premielos.
export function losgrupper(prove, logg) {
  const valg = prove.losValg || {};
  const grupper = [];
  for (const l of logg.loser) {
    const v = valg[l.id] || {};
    const slaaSammen = v.sammenslaa != null ? v.sammenslaa : l.sammenslaaStandard;
    const forrige = grupper[grupper.length - 1];
    if (slaaSammen && forrige && forrige.losdyr === l.losdyr) forrige.deler.push(l);
    else grupper.push({ id: l.id, losdyr: l.losdyr, deler: [l] });
  }
  const gruppe = prove.hund?.gruppe || 'stover';
  let libBrukt = false;
  for (const g of grupper) {
    const d = g.deler.map((l) => ({ los: l, ...delLos(l, gruppe) }));
    g.hortMin = d.reduce((s, x) => s + x.hortMin, 0);
    g.luhMin = d.reduce((s, x) => s + x.luhMin, 0);
    g.lppMin = d.reduce((s, x) => s + x.lppMin, 0);
    g.slhMin = Math.min(20, d.reduce((s, x) => s + x.slhMin, 0));
    g.luhLpp = Math.min(g.luhMin + g.lppMin, g.hortMin);
    // LIB: 20 ekstra lospoeng én gang per prøvedag, etter minimum 30 minutter hørt los (også sammenslått).
    g.lib = g.deler.some((l) => l.lib);
    g.libTillegg = 0;
    if (g.lib && !libBrukt && g.hortMin >= 30) { g.libTillegg = 20; libBrukt = true; }
    g.maks = maksLospoeng(gruppe, g.losdyr);
    g.lospoengRaa = g.hortMin + g.luhLpp + g.slhMin + g.libTillegg;
    g.lospoeng = g.losdyr === 'ukjent' ? 0 : Math.min(g.maks, g.lospoengRaa);
    g.fullTid = g.losdyr !== 'ukjent' && g.lospoengRaa >= g.maks;
    g.sekvenser = d.flatMap((x) => x.sekvenser);
    const tap = d.flatMap((x) => x.tap);
    g.sett = g.deler.flatMap((l) => l.sett);
    g.hundSett = g.deler.reduce((s, l) => s + l.hund, 0);
    g.aapen = g.deler.some((l) => l.aapen);
    g.uttak = g.deler[0].uttak;
    // Tilleggsregistreringer (kap. 15.9), også for sammenslåtte loser.
    const fot = d.map((x) => x.fotTilUttak).filter((x) => x != null);
    let til60 = null; let rest = 60; let brukt = 0;
    for (const x of d) {
      const t = x.tidTil(rest);
      if (t != null) { til60 = brukt + t; break; }
      brukt += Math.round((x.sluttLos - x.los.uttak) / MIN);
      rest -= x.hortMin + Math.min(x.luhMin + x.lppMin, x.hortMin) + x.slhMin;
      if (rest <= 0) { til60 = brukt; break; }
    }
    g.reg = {
      fotTilUttak: fot.length ? Math.min(...fot) : null,
      uttakTil60: g.lospoeng >= 60 ? til60 : null,
      uttakTilSlutt: d.reduce((s, x) => s + Math.round((x.sluttLos - x.los.uttak) / MIN), 0),
      lengsteSekvens: g.sekvenser.length ? Math.floor(Math.max(...g.sekvenser) / MIN) : 0,
      lengsteTap: tap.length ? Math.round(Math.max(...tap) / MIN) : 0,
      antallTap: tap.length,
    };
    g.tidTilFullTid = d.length === 1 ? d[0].tidTil(g.maks) : null;
  }
  return grupper;
}

// Velger premielos: førerens valg, ellers gruppen som gir høyest premiegrad og flest premiepoeng.
export function velgPremielos(prove, grupper, egenskapspoeng = 0) {
  const gruppe = prove.hund?.gruppe || 'stover';
  const lovlige = grupper.filter((g) => g.losdyr !== 'ukjent');
  if (prove.premielos) {
    const valgt = grupper.find((g) => g.id === prove.premielos || g.deler.some((l) => l.id === prove.premielos));
    if (valgt) return valgt;
  }
  if (!lovlige.length) return grupper.find((g) => g.losdyr === 'ukjent') || null;
  const score = (g) => {
    const pg = premiegradFor(gruppe, g.losdyr, g.lospoeng, egenskapspoeng);
    return [pg ? 4 - pg : 0, g.lospoeng, g.hortMin];
  };
  return [...lovlige].sort((a, b) => {
    const sa = score(a); const sb = score(b);
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return sb[i] - sa[i];
    return 0;
  })[0];
}

// Hvilke momenter skal bedømmes (kap. 15.5)?
export function aktiveMomenter(premielos, harVaertIFot) {
  const alle = [...MOMENTER, ...TILLEGG].map((m) => m.id);
  if (!premielos || premielos.losdyr === 'ukjent' || premielos.hortMin <= 0) {
    return { ids: ['jaktlyst', 'samarbeid', ...(harVaertIFot ? ['malbrukFot'] : []), 'lydighet'], grunn: 'Ingen los på konstatert losdyr: bare moment 1, 2, 4a (hvis hunden har vært i fot) og 8 bedømmes.' };
  }
  if (premielos.hortMin < 30) {
    return { ids: alle.filter((id) => !['arbeidLos', 'arbeidTap', 'kondisjon'].includes(id)), grunn: 'Hørt los under 30 minutter: moment 5 og 7 bedømmes ikke.' };
  }
  return { ids: alle, grunn: 'Hørt los over 30 minutter på kjent, lovlig losdyr: alle momenter bedømmes.' };
}

export function alderMnd(fodt, dato) {
  if (!fodt || !dato) return null;
  const f = new Date(fodt); const d = new Date(dato);
  if (Number.isNaN(+f) || Number.isNaN(+d)) return null;
  let m = (d.getFullYear() - f.getFullYear()) * 12 + (d.getMonth() - f.getMonth());
  if (d.getDate() < f.getDate()) m -= 1;
  return m;
}

// Grenser for klovdyrjag før G (kap. 14.4 og 15.5).
export function klovdyrGrense(alder) {
  return alder != null && alder < 24 ? { enkelt: 20, sum: 40 } : { enkelt: 10, sum: 20 };
}

// Komplett beregning av protokollen: lospoeng, egenskapspoeng, premiegrad og regelsjekk.
export function beregn(prove, naa = null) {
  const logg = lesLogg(prove, naa);
  const grupper = losgrupper(prove, logg);
  const gruppe = prove.hund?.gruppe || 'stover';
  const p = prove.poeng || {};
  const verdi = (id) => (Number.isInteger(p[id]) ? p[id] : null);

  // Foreløpig egenskapssum (for valg av premielos), deretter endelig med riktige aktive momenter.
  const sumFor = (ids) => MOMENTER.filter((m) => ids.includes(m.id)).reduce((s, m) => s + (verdi(m.id) || 0) * m.vekt, 0);
  const forelopig = sumFor(MOMENTER.map((m) => m.id));
  const premielos = velgPremielos(prove, grupper, forelopig);
  const aktive = aktiveMomenter(premielos, logg.harVaertIFot);
  const egenskapspoeng = sumFor(aktive.ids);
  const tilleggspoeng = TILLEGG.filter((m) => aktive.ids.includes(m.id)).reduce((s, m) => s + (verdi(m.id) || 0) * m.vekt, 0);
  const harGIMoment = [...MOMENTER, ...TILLEGG].some((m) => p[m.id] === 'G');
  const utfall = prove.utfall || (harGIMoment ? 'G' : null);

  const lospoeng = premielos && premielos.losdyr !== 'ukjent' ? premielos.lospoeng : 0;
  let premiepoeng = egenskapspoeng + lospoeng;
  let konkurransepoeng = premiepoeng + tilleggspoeng;
  let premiegrad = premielos ? premiegradFor(gruppe, premielos.losdyr, lospoeng, egenskapspoeng) : 0;
  const nullstilt = !!utfall || prove.ikkeStartet;
  if (nullstilt) { premiepoeng = 0; konkurransepoeng = 0; premiegrad = 0; }

  const regelsjekk = sjekkRegler(prove, logg, grupper, premielos, aktive, { egenskapspoeng, lospoeng });
  return {
    logg, grupper, premielos, aktive, gruppe,
    egenskapspoeng: nullstilt ? 0 : egenskapspoeng,
    lospoeng: nullstilt ? 0 : lospoeng,
    tilleggspoeng: nullstilt ? 0 : tilleggspoeng,
    premiepoeng, konkurransepoeng, premiegrad, utfall,
    mangler: premielos && !nullstilt ? manglerTil(gruppe, premielos.losdyr, lospoeng, egenskapspoeng) : [],
    regelsjekk,
  };
}

function sjekkRegler(prove, logg, grupper, premielos, aktive, sum) {
  const ut = [];
  const p = prove.poeng || {};
  const timer = logg.losTid / (60 * MIN);
  const alder = alderMnd(prove.hund?.fodt, prove.dato);
  const gruppe = prove.hund?.gruppe || 'stover';
  const varsel = (niva, tekst, moment) => ut.push({ niva, tekst, moment });
  for (const v of logg.varsler) ut.push(v);

  // Prøvetid 5–8 timer (kap. 14.1)
  if (logg.avsluttet && timer < 5 && !['U', 'A', 'G'].includes(prove.utfall)) {
    varsel('feil', `Hunden har arbeidet løs ${fmtTid(logg.losTid)} – under 5 timer. Avsluttes prøven slik, skal den tildeles T (med mindre U eller A gjelder).`);
  }
  if (timer > 8) varsel('advarsel', `Løs-tiden er ${fmtTid(logg.losTid)}, over prøvetidens ramme på 8 timer.`);

  // Full tid
  for (const g of grupper) {
    if (g.fullTid && g.aapen) varsel('feil', `Full tid på ${LOSDYR[g.losdyr].toLowerCase()} (${g.maks} lospoeng). Kobling skal beordres, og hunden flyttes til ny terrengdel om det gjenstår prøvetid.`);
  }
  // Losdyr ikke premieberettiget for gruppen
  if (premielos && premielos.losdyr !== 'ukjent' && !kravTabell(gruppe, premielos.losdyr)) {
    varsel('advarsel', `${gruppe === 'stover' ? 'Støvere' : 'Småhund'} kan ikke premieres på ${LOSDYR[premielos.losdyr].toLowerCase()}.`);
  }
  if (gruppe === 'smahund' && Number(prove.hund?.boghoyde) > 41 && grupper.some((g) => g.losdyr === 'radyr' || g.losdyr === 'hjort')) {
    varsel('feil', 'Småhund med boghøyde over 41 cm kan ikke prøves på rådyr/hjort – jag av disse bedømmes som graverende feil (G).');
  }
  // Klovdyrjag
  const grense = klovdyrGrense(alder);
  let sumKlov = 0;
  for (const k of logg.klovdyr) {
    const d = Math.round((k.til - k.fra) / MIN);
    sumKlov += d;
    if (k.art === 'bufe') varsel('feil', 'Jag av bufe er alltid graverende feil (G), uansett lengde.');
    else if (d > grense.enkelt) varsel('feil', `Klovdyrjag på ${d} min overstiger ${grense.enkelt} min (${alder != null && alder < 24 ? 'under' : 'over'} 24 mnd) – skal tildeles G.`);
    else if (k.aapen) varsel('advarsel', `Klovdyrjag pågår: ${d} av maks ${grense.enkelt} min.`);
  }
  if (sumKlov > grense.sum) varsel('feil', `Sum klovdyrjag ${sumKlov} min overstiger ${grense.sum} min – skal tildeles G.`);

  const v = (id) => p[id];
  const pl = premielos;
  if (v('jaktlyst') === 5 && timer < 6) varsel('advarsel', 'Jaktlyst 5 krever at hunden har arbeidet med stor energi i minst 6 timer.', 'jaktlyst');
  if (v('kondisjon') === 5 && timer < 6) varsel('advarsel', 'Kondisjon/styrke 5 krever effektivt arbeid i minst 6 timer.', 'kondisjon');
  if (Number.isInteger(v('samarbeid')) && v('samarbeid') <= 2) varsel('info', 'Søk og samarbeid ≤ 2: årsaken (dårlig kontakt eller uønsket stort kontaktbehov) skal føres i tilleggsopplysninger.', 'samarbeid');
  if (Number.isInteger(v('nyansering')) && v('nyansering') <= 2) varsel('info', 'Nyansering ≤ 2: årsaken (uønsket løshet eller trang målbruk) skal føres i tilleggsopplysninger.', 'nyansering');
  if (pl) {
    const uttakLovlig = grupper.filter((g) => g.losdyr !== 'ukjent').reduce((s, g) => s + g.deler.length, 0);
    if (v('fotarbeid') === 5 && uttakLovlig < 2) varsel('advarsel', 'Fotarbeid 5 krever at hunden har reist minst to stykker lovlig vilt effektivt i løpet av dagen.', 'fotarbeid');
    if (pl.reg.fotTilUttak == null && aktive.ids.includes('fotarbeid') && v('fotarbeid') !== 3) varsel('info', 'Fotarbeid er ikke registrert før uttak – da skal det normalt gis 3 poeng, med merknad i tilleggsopplysninger.', 'fotarbeid');
    if (!logg.harVaertIFot && aktive.ids.includes('malbrukFot') && v('malbrukFot') !== 5) varsel('info', 'Fotarbeid er ikke konstatert – målbruk i fot skal da gis 5 poeng.', 'malbrukFot');
    if (pl.reg.antallTap === 0 && aktive.ids.includes('malbrukTap') && v('malbrukTap') !== 5) varsel('info', 'Ingen tapsarbeid registrert – målbruk i tap skal da gis 5 poeng (ikke noterbare tap kan likevel vurderes).', 'malbrukTap');
    const lange = pl.sekvenser.filter((s) => s >= 30 * MIN).length;
    if (v('arbeidLos') === 5 && !(lange >= 2 || pl.sekvenser.some((s) => s >= 50 * MIN))) varsel('advarsel', 'Arbeid i los 5 krever minst to serier full los på minst 30 min, eller én serie på minst 50 min.', 'arbeidLos');
    const avstander = new Set(pl.sett.map((s) => s.avstand).filter(Boolean));
    if (v('nyansering') === 5 && (pl.sett.length < 2 || avstander.size < 2)) varsel('advarsel', 'Nyansering 5 krever at losdyret er sett i losen minst 2 ganger med ulik avstand mellom losdyr og hund.', 'nyansering');
    if (aktive.ids.includes('horbarhet') && !prove.mal) varsel('info', 'Merk av om hunden er enstonig (E) eller to-/flertonig (T/F).', 'horbarhet');
  }
  if (v('lydighet') === 5 && !logg.innkallinger.some((i) => i.fra === 'los' && i.utenforSyn && i.lyktes)) varsel('advarsel', 'Lydighet 5 kan bare gis hund som lar seg innkalle fra los utenfor synsvidde.', 'lydighet');
  for (const m of [...MOMENTER, ...TILLEGG]) {
    if (aktive.ids.includes(m.id) && v(m.id) == null && logg.avsluttet && !prove.utfall) varsel('info', `${m.nr} ${m.navn} er ikke bedømt.`, m.id);
  }
  if (prove.utfall && !String(prove.tilleggsopplysninger || '').trim()) varsel('advarsel', `${prove.utfall} skal begrunnes i tilleggsopplysninger.`);
  const sammenslatt = grupper.filter((g) => g.deler.length > 1);
  if (sammenslatt.length) varsel('info', 'Innstilling basert på sammenslåtte loser skal komme fram i tilleggsopplysninger.');
  return ut;
}

// Forslag til tekst i tilleggsopplysninger (kap. 15.8).
export function forslagTilleggsopplysninger(prove, res) {
  const linjer = [];
  const pl = res.premielos;
  for (const g of res.grupper) {
    if (g === pl) continue;
    if (g.losdyr === 'ukjent') linjer.push(`Los på ukjent losdyr kl. ${klokke(g.uttak)}: ${g.hortMin} min.`);
    else linjer.push(`Tilleggslos ${LOSDYR[g.losdyr].toLowerCase()} kl. ${klokke(g.uttak)}: ${g.lospoeng} lospoeng.`);
  }
  if (pl && pl.deler.length > 1) linjer.push(`Premielosen er sammenslått av ${pl.deler.length} loser (${pl.deler.map((l) => klokke(l.uttak)).join(' og ')}).`);
  if (pl && pl.libTillegg) linjer.push('Losdyret gikk inn (LIB) – 20 lospoeng ekstra.');
  if (pl && pl.reg.fotTilUttak == null && res.aktive.ids.includes('fotarbeid') && prove.poeng?.fotarbeid === 3) linjer.push('Poengsettingen under punkt 3 er basert på mangelfull observasjon.');
  if (prove.utfall) linjer.push(`${prove.utfall}: ${UTFALL[prove.utfall]}. Grunn: `);
  return linjer;
}

// Eliteprøve: to prøvedager, premie etter samlet premiepoeng (kap. 11.4).
export function beregnEP(dag1, dag2) {
  const r = [dag1, dag2].map((d) => (d ? beregn(d) : null));
  const ut = { dager: r, premiepoeng: 0, premie: 0, merknader: [] };
  if (!r[0]) return ut;
  const utf = r.map((x, i) => (x ? x.utfall : null));
  if (utf.includes('G')) { ut.merknader.push('G under EP: hunden tildeles ikke poeng på prøven.'); return ut; }
  if (['G', 'T', 'A'].includes(utf[0])) ut.merknader.push(`${utf[0]} dag 1: hunden kan ikke starte dag 2.`);
  const pp = r.map((x) => (x && !x.utfall ? x.premiepoeng : 0));
  ut.premiepoeng = pp[0] + pp[1];
  if (!r[1]) { ut.merknader.push('Dag 2 er ikke registrert ennå.'); return ut; }
  const rev = r.some((x) => x?.premielos?.losdyr === 'rev');
  if (rev) ut.merknader.push('Ved revepremiering kan ikke elitepremie oppnås.');
  const fem = r.every((x) => x && x.logg.losTid >= 5 * 60 * MIN);
  if (!fem) ut.merknader.push('EP-premie krever at hunden har arbeidet løs minst 5 timer begge prøvedager.');
  const forsteAP = r.some((x) => x && !x.utfall && x.premielos?.losdyr === 'hare' && x.lospoeng >= 120 && x.egenskapspoeng >= 55);
  let premie = ut.premiepoeng >= 321 ? 1 : ut.premiepoeng >= 261 ? 2 : ut.premiepoeng >= 195 ? 3 : 0;
  if (premie === 1 && !forsteAP) { premie = 2; ut.merknader.push('1. premie EP krever at kravene til 1. premie ÅP (120 + 55) er nådd en av dagene.'); }
  ut.premie = !rev && fem ? premie : 0;
  return ut;
}

export function klokke(t) {
  if (t == null) return '–';
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function fmtTid(ms) {
  const m = Math.max(0, Math.floor(ms / MIN));
  return `${Math.floor(m / 60)} t ${String(m % 60).padStart(2, '0')} min`;
}
