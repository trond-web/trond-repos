// Planleggingsmotor for tømmerproduksjon: hogst → terrengtransport → velteplass → tømmerbil → mottak.
// Ren logikk uten DOM, slik at den kan testes med node. Simulerer dag for dag og summerer per uke.
//
// Produktivitetsmodellene er enkle standardkurver for norske forhold. De er ment som utgangspunkt og
// bør kalibreres mot entreprenørens egne tall (m³ per G15-time) – faktorene ligger i innstillingene.

export const SORTIMENTER = [
  { id: 'gs', navn: 'Sagtømmer gran', kort: 'Sag gran', treslag: 'gran', sag: true },
  { id: 'gm', navn: 'Massevirke gran', kort: 'Masse gran', treslag: 'gran', sag: false },
  { id: 'fs', navn: 'Sagtømmer furu', kort: 'Sag furu', treslag: 'furu', sag: true },
  { id: 'fm', navn: 'Massevirke furu', kort: 'Masse furu', treslag: 'furu', sag: false },
  { id: 'lm', navn: 'Massevirke lauv', kort: 'Lauv', treslag: 'lauv', sag: false },
  { id: 'en', navn: 'Energivirke', kort: 'Energi', treslag: 'blandet', sag: false },
];
export const SORT_ID = SORTIMENTER.map((s) => s.id);
export const sortiment = (id) => SORTIMENTER.find((s) => s.id === id);

// Vegklasser etter Landbruksdirektoratets normaler for landbruksveger.
export const VEGKLASSER = {
  1: 'Kl. 1–2 helårs bilveg',
  3: 'Kl. 3 helårs, stengt i teleløsning',
  4: 'Kl. 4 sommerbilveg (åpen vinter ved tele)',
  5: 'Kl. 5 barmarksveg (bare barmark)',
};

export const FORE = {
  helaar: 'Helårsdrift',
  barmark: 'Barmark (ikke vinter/teleløsning)',
  frost: 'Vinterdrift (frossen mark)',
};

export const HOGSTFORMER = { slutt: 'Sluttavvirkning', tynning: 'Tynning' };
export const MASKINSTORRELSE = { liten: 'Liten', middels: 'Middels', stor: 'Stor' };

// Driftsvanskelighet 1 (lett) – 5 (svært vanskelig): helling, bæreevne og ujevnhet samlet.
const TERRENG_HOGST = [1, 0.92, 0.83, 0.73, 0.62];
const MASKIN_HOGST = { liten: 0.85, middels: 1, stor: 1.15 };
const LASS_LASSBERER = { liten: 10, middels: 14, stor: 18 };

export const STANDARD_INNSTILLINGER = {
  startdato: '',
  uker: 30,
  arbeidsdager: 5,
  bilDager: 5,
  // Sesonger som ISO-ukenummer (fra–til, kan gå over nyttår)
  vinterFra: 50, vinterTil: 12,
  teleFra: 14, teleTil: 19,
  sommerFra: 21, sommerTil: 35,
  // Maks lagring ved velteplass i dager: sommer gjelder sagtømmer og gran (blåved og barkbille)
  maksLagringSommer: 21,
  maksLagring: 60,
  // Tømmerbil
  biler: 2,
  bilTimer: 11,
  lassM3: 40,
  fartVei: 65,
  fartSkogsbilvei: 25,
  lastetid: 0.75,
  lossetid: 0.4,
  veifaktor: 1.3,
  // Kalibrering av hogstmaskin: m³/G15h = hogstA · middelstamme^hogstB
  hogstA: 40,
  hogstB: 0.6,
  tynningFaktor: 0.75,
  lassbererFart: 3.2, // km/t snitt tom og lastet
};

// ---------- Datoer (UTC, så tidssoner ikke flytter dager) ----------
const DAG = 86400000;
export const tilDag = (iso) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAG);
export const tilIso = (dag) => new Date(dag * DAG).toISOString().slice(0, 10);
export const ukedag = (dag) => (new Date(dag * DAG).getUTCDay() + 6) % 7; // 0 = mandag

export function isoUke(dag) {
  const d = new Date(dag * DAG);
  const torsdag = dag - ukedag(dag) + 3;
  const t = new Date(torsdag * DAG);
  const aar = t.getUTCFullYear();
  const uke = 1 + Math.floor((torsdag - Math.floor(Date.UTC(aar, 0, 1) / DAG)) / 7);
  return { aar, uke, mandag: dag - ukedag(dag), dato: d };
}

export const iPeriode = (uke, fra, til) => (fra <= til ? uke >= fra && uke <= til : uke >= fra || uke <= til);

export function neste_mandag(iso) {
  const d = tilDag(iso);
  return tilIso(d + ((7 - ukedag(d)) % 7));
}

export function sesong(dag, inn) {
  const { uke } = isoUke(dag);
  return {
    uke,
    vinter: iPeriode(uke, inn.vinterFra, inn.vinterTil),
    tele: iPeriode(uke, inn.teleFra, inn.teleTil),
    sommer: iPeriode(uke, inn.sommerFra, inn.sommerTil),
  };
}

// Kan det hogges og kjøres i terrenget på denne drifta i dag?
export function driftTillatt(drift, s) {
  if (drift.fore === 'frost') return s.vinter;
  if (drift.fore === 'barmark') return !s.vinter && !s.tele;
  return true;
}

// Kan tømmerbilen kjøre på skogsbilvegen i dag?
export function vegApen(vegklasse, s) {
  const kl = +vegklasse || 1;
  if (kl <= 2) return true;
  if (kl === 5) return !s.tele && !s.vinter;
  return !s.tele;
}

// ---------- Produktivitet ----------
export function hogstRate(drift, lag, inn = STANDARD_INNSTILLINGER) {
  const ms = Math.max(0.03, +drift.middelstamme || 0.3);
  let r = inn.hogstA * ms ** inn.hogstB;
  if (drift.hogstform === 'tynning') r *= inn.tynningFaktor;
  r *= TERRENG_HOGST[(clamp(+drift.terreng || 2, 1, 5)) - 1];
  r *= MASKIN_HOGST[lag?.maskin] ?? 1;
  return r; // m³ per G15-time
}

export function lassbererRate(drift, lag, inn = STANDARD_INNSTILLINGER) {
  const lass = LASS_LASSBERER[lag?.maskin] ?? 14;
  const kl = clamp(+drift.terreng || 2, 1, 5);
  const terminal = 0.2 + 0.03 * lass * (drift.hogstform === 'tynning' ? 1.3 : 1);
  const kjoring = ((2 * (+drift.kjoreavstand || 300)) / 1000 / inn.lassbererFart) * (1 + 0.1 * (kl - 1));
  return lass / (terminal + kjoring); // m³ per G15-time
}

export const totalVolum = (drift) => SORT_ID.reduce((s, id) => s + (+drift.volum?.[id] || 0), 0);

export function avstandKm(a, b) {
  if (![a?.lat, a?.lon, b?.lat, b?.lon].every((x) => Number.isFinite(+x) && x !== '')) return null;
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

// Veilengde fra velteplass til mottak (offentlig vei). Overstyring per drift går foran luftlinje × veifaktor.
export function veiKm(drift, mottak, inn) {
  const over = drift.avstander?.[mottak.id];
  if (over !== undefined && over !== '' && Number.isFinite(+over)) return +over;
  const luft = avstandKm(drift, mottak);
  return luft === null ? null : luft * inn.veifaktor;
}

// Timer for én tur: tom inn, lastet ut, lasting og lossing.
export function turTimer(drift, mottak, inn) {
  const km = veiKm(drift, mottak, inn);
  if (km === null) return null;
  const skog = +drift.skogsbilveiKm || 0;
  return 2 * (skog / inn.fartSkogsbilvei + km / inn.fartVei) + inn.lastetid + inn.lossetid;
}

// Lagring som regnes som risiko: sommer for sagtømmer og granvirke (blåved, barkbille), ellers generell grense.
export function maksAlder(sortId, s, inn) {
  const so = sortiment(sortId);
  if (s.sommer && (so.sag || so.treslag === 'gran')) return inn.maksLagringSommer;
  return inn.maksLagring;
}

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const r1 = (x) => Math.round(x * 10) / 10;

// ---------- Simulering ----------
export function planlegg(plan) {
  const inn = { ...STANDARD_INNSTILLINGER, ...(plan.innstillinger || {}) };
  const startIso = inn.startdato || neste_mandag(new Date().toISOString().slice(0, 10));
  const start = tilDag(startIso);
  const antDager = Math.max(1, Math.round(inn.uker)) * 7;
  const lagListe = plan.lag || [];
  const mottakListe = plan.mottak || [];
  const drifter = (plan.drifter || []).filter((d) => totalVolum(d) > 0);

  const varsler = [];
  const varsle = (niva, tekst, ekstra = {}) => varsler.push({ niva, tekst, ...ekstra });
  const varsletEn = new Set();
  const varsleEn = (nokkel, niva, tekst, ekstra) => { if (!varsletEn.has(nokkel)) { varsletEn.add(nokkel); varsle(niva, tekst, ekstra); } };

  // Tilstand per drift
  const D = new Map(drifter.map((d) => {
    const tot = totalVolum(d);
    const andel = Object.fromEntries(SORT_ID.map((id) => [id, (+d.volum?.[id] || 0) / tot]));
    return [d.id, {
      drift: d, tot, andel, hogd: 0, iSkog: 0, framkjort: 0, levert: 0,
      lager: Object.fromEntries(SORT_ID.map((id) => [id, []])), // FIFO-partier { dag, m3 }
      start: null, hogstFerdig: null, framkjortFerdig: null, sisteLevering: null, fullDager: 0,
    }];
  }));
  const lagerSum = (st, id) => st.lager[id].reduce((s, p) => s + p.m3, 0);
  const lagerTot = (st) => SORT_ID.reduce((s, id) => s + lagerSum(st, id), 0);
  const ferdigFramkjort = (st) => st.hogd >= st.tot - 1e-6 && st.iSkog < 1e-6;

  // Tilstand per maskinlag
  const L = lagListe.map((lag) => ({
    lag, aktiv: null, flyttIgjen: 0, sted: null, segmenter: [], ventDager: 0,
    ko: drifter.filter((d) => d.lag === lag.id).sort((a, b) => (+a.rekkefolge || 0) - (+b.rekkefolge || 0)),
  }));
  for (const d of drifter) {
    if (!lagListe.some((l) => l.id === d.lag)) varsle('feil', `«${d.navn}» har ikke noe maskinlag og blir ikke hogd.`, { drift: d.id });
  }
  for (const d of drifter) {
    for (const id of SORT_ID) {
      if ((+d.volum?.[id] || 0) > 0 && !mottakListe.some((m) => m.sortimenter?.includes(id))) {
        varsleEn(`ingenmottak-${id}`, 'feil', `Ingen mottak tar imot ${sortiment(id).navn.toLowerCase()}. Legg til et mottak eller en leveranseavtale.`);
      }
    }
  }

  const leggSegment = (l, type, dag, drift) => {
    const sist = l.segmenter[l.segmenter.length - 1];
    if (sist && sist.type === type && sist.drift === drift && sist.til >= dag - 3) sist.til = dag; // helger slås sammen
    else l.segmenter.push({ type, drift, fra: dag, til: dag });
  };

  const uker = [];
  let uke = null;
  const kvoteIgjen = {};
  const leveranser = [];
  let bilTimerBrukt = 0;
  let bilTimerTilgj = 0;
  let maksLager = 0;
  const stengt = new Map(); // perioder der virke står ved stengt skogsbilveg
  const dagLagerTot = () => [...D.values()].reduce((s, st) => s + lagerTot(st), 0);

  for (let dag = start; dag < start + antDager; dag++) {
    const s = sesong(dag, inn);
    const ud = ukedag(dag);
    if (ud === 0 || !uke) {
      uke = {
        uke: s.uke, aar: isoUke(dag).aar, mandag: tilIso(dag - ud), sesong: { vinter: s.vinter, tele: s.tele, sommer: s.sommer },
        hogd: 0, framkjort: 0, levert: Object.fromEntries(SORT_ID.map((id) => [id, 0])), lager: {},
        perMottak: Object.fromEntries(mottakListe.map((m) => [m.id, 0])), bilTimer: 0, bilTimerTilgj: 0, lass: 0,
      };
      uker.push(uke);
      for (const m of mottakListe) kvoteIgjen[m.id] = +m.kvote || 0;
    }

    // 1) Hogst og terrengtransport
    if (ud < inn.arbeidsdager) {
      for (const l of L) {
        if (l.lag.start && dag < tilDag(l.lag.start)) continue;
        if (l.flyttIgjen > 0) { l.flyttIgjen--; leggSegment(l, 'flytt', dag, l.aktiv); continue; }
        let st = l.aktiv ? D.get(l.aktiv) : null;
        if (st && (ferdigFramkjort(st) || !driftTillatt(st.drift, s))) st = null;
        if (!st) {
          const neste = l.ko.find((d) => {
            const x = D.get(d.id);
            return !ferdigFramkjort(x) && driftTillatt(d, s) && (!d.tidligst || dag >= tilDag(d.tidligst));
          });
          if (!neste) {
            if (l.ko.some((d) => !ferdigFramkjort(D.get(d.id)))) { leggSegment(l, 'vent', dag, null); l.ventDager++; }
            l.aktiv = null;
            continue;
          }
          const byttet = l.sted !== neste.id;
          l.aktiv = neste.id;
          l.sted = neste.id;
          const flytt = Math.max(0, Math.round(+l.lag.flyttDager || 0));
          if (byttet && flytt > 0 && l.segmenter.length) {
            l.flyttIgjen = flytt - 1;
            leggSegment(l, 'flytt', dag, neste.id);
            continue;
          }
          st = D.get(neste.id);
        }
        const timer = +l.lag.timer || 9;
        const d = st.drift;
        if (st.start === null) st.start = dag;
        const h = Math.min(st.tot - st.hogd, hogstRate(d, l.lag, inn) * timer);
        st.hogd += h;
        st.iSkog += h;
        if (st.hogd >= st.tot - 1e-6 && st.hogstFerdig === null) st.hogstFerdig = dag;
        let f = Math.min(st.iSkog, lassbererRate(d, l.lag, inn) * timer);
        const kap = +d.velteplass || Infinity;
        const plass = Math.max(0, kap - lagerTot(st));
        if (f > plass + 1e-6) {
          f = plass;
          st.fullDager++;
          varsleEn(`full-${d.id}`, 'advarsel', `Velteplassen på «${d.navn}» er full ${tilIso(dag)}. Lassbæreren må vente på tømmerbil – øk transporten eller lag større velteplass.`, { drift: d.id, dato: tilIso(dag) });
        }
        st.iSkog -= f;
        st.framkjort += f;
        if (f > 0) for (const id of SORT_ID) if (st.andel[id] > 0) st.lager[id].push({ dag, m3: f * st.andel[id] });
        if (ferdigFramkjort(st) && st.framkjortFerdig === null) st.framkjortFerdig = dag;
        uke.hogd += h;
        uke.framkjort += f;
        leggSegment(l, 'drift', dag, d.id);
      }
    }

    // 2) Tømmerbil: eldste og mest utsatte virke først, nærmeste mottak med ledig kvote
    if (ud < inn.bilDager) {
      let timerIgjen = inn.biler * inn.bilTimer;
      bilTimerTilgj += timerIgjen;
      uke.bilTimerTilgj += timerIgjen;
      const kandidater = [];
      for (const st of D.values()) {
        for (const id of SORT_ID) {
          const p = st.lager[id];
          if (!p.length) continue;
          const alder = dag - p[0].dag;
          kandidater.push({ st, id, alder, risiko: alder / maksAlder(id, s, inn) });
        }
      }
      kandidater.sort((a, b) => b.risiko - a.risiko);
      for (const k of kandidater) {
        const { st, id } = k;
        const d = st.drift;
        if (!vegApen(d.vegklasse, s)) {
          const arsak = s.tele ? 'teleløsning' : 'vinter';
          const nokkel = `${d.id}-${arsak}`;
          const sp = stengt.get(nokkel);
          if (sp && sp.tilDag >= dag - 7) { sp.tilDag = dag; sp.til = s.uke; sp.maks = Math.max(sp.maks, lagerTot(st)); }
          else stengt.set(nokkel + (sp ? `-${dag}` : ''), { d, arsak, fra: s.uke, til: s.uke, fraDag: dag, tilDag: dag, maks: lagerTot(st) });
          continue;
        }
        const valg = mottakListe
          .filter((m) => m.sortimenter?.includes(id) && kvoteIgjen[m.id] > 0)
          .map((m) => ({ m, t: turTimer(d, m, inn) }))
          .filter((x) => x.t !== null)
          .sort((a, b) => a.t - b.t);
        for (const { m, t } of valg) {
          if (t > inn.bilTimer) varsleEn(`lang-${d.id}-${m.id}`, 'info', `En tur fra «${d.navn}» til ${m.navn} tar ${r1(t)} t, mer enn én bildag.`, { drift: d.id });
          while (timerIgjen >= Math.min(t, inn.bilTimer) && kvoteIgjen[m.id] > 0) {
            const paLager = lagerSum(st, id);
            const helLass = paLager >= inn.lassM3 - 1e-6;
            // Restlass kjøres når drifta er ferdig framkjørt, eller når det haster
            if (!helLass && !(ferdigFramkjort(st) || k.alder >= maksAlder(id, s, inn) * 0.8) ) break;
            if (paLager < 0.5) break;
            const m3 = Math.min(inn.lassM3, paLager);
            let igjen = m3;
            let alderSum = 0;
            while (igjen > 1e-9) {
              const p = st.lager[id][0];
              const ta = Math.min(p.m3, igjen);
              alderSum += ta * (dag - p.dag);
              p.m3 -= ta;
              igjen -= ta;
              if (p.m3 < 1e-9) st.lager[id].shift();
            }
            timerIgjen -= t;
            bilTimerBrukt += t;
            uke.bilTimer += t;
            uke.lass++;
            kvoteIgjen[m.id] -= m3;
            st.levert += m3;
            st.sisteLevering = dag;
            uke.levert[id] += m3;
            uke.perMottak[m.id] += m3;
            leveranser.push({ dato: tilIso(dag), drift: d.id, sortiment: id, mottak: m.id, m3, alder: alderSum / m3, timer: t });
          }
          if (!st.lager[id].length) break;
        }
      }
    }

    // 3) Lagringsrisiko og lagernivå ved dagens slutt
    for (const st of D.values()) {
      const gamle = SORT_ID.filter((id) => st.lager[id][0] && dag - st.lager[id][0].dag > maksAlder(id, s, inn) && !varsletEn.has(`alder-${st.drift.id}-${id}`));
      if (!gamle.length) continue;
      gamle.forEach((id) => varsletEn.add(`alder-${st.drift.id}-${id}`));
      const grenser = [...new Set(gamle.map((id) => maksAlder(id, s, inn)))].join('/');
      const navn = gamle.map((id, i) => (i ? sortiment(id).navn.toLowerCase() : sortiment(id).navn)).join(', ');
      varsle('advarsel', `${navn} på «${st.drift.navn}» har ligget mer enn ${grenser} dager ved velteplass (${tilIso(dag)})${s.sommer ? ' – risiko for blåved og barkbille' : ''}.`,
        { drift: st.drift.id, dato: tilIso(dag) });
    }
    const tot = dagLagerTot();
    if (tot > maksLager) maksLager = tot;
    if (ud === 6 || dag === start + antDager - 1) {
      for (const id of SORT_ID) uke.lager[id] = [...D.values()].reduce((sum, st) => sum + lagerSum(st, id), 0);
    }
  }

  // Oppsummering per drift
  const sluttDag = start + antDager - 1;
  const driftRes = drifter.map((d) => {
    const st = D.get(d.id);
    const rest = st.tot - st.levert;
    if (st.start === null) {
      varsle('advarsel', `«${d.navn}» blir ikke startet innen planperioden.`, { drift: d.id });
    } else if (st.framkjortFerdig === null) {
      varsle('advarsel', `«${d.navn}» blir ikke ferdig hogd og framkjørt innen planperioden.`, { drift: d.id });
    }
    if (d.frist && (st.framkjortFerdig === null || st.framkjortFerdig > tilDag(d.frist))) {
      varsle('advarsel', `«${d.navn}» er ikke ferdig framkjørt innen fristen ${d.frist}.`, { drift: d.id });
    }
    if (rest > 1 && st.framkjortFerdig !== null) {
      varsle('info', `${Math.round(lagerTot(st))} m³ fra «${d.navn}» står igjen ved velteplass når planperioden slutter.`, { drift: d.id });
    }
    return {
      id: d.id, navn: d.navn, tot: st.tot, hogd: st.hogd, framkjort: st.framkjort, levert: st.levert, igjen: lagerTot(st),
      start: st.start === null ? null : tilIso(st.start),
      hogstFerdig: st.hogstFerdig === null ? null : tilIso(st.hogstFerdig),
      framkjortFerdig: st.framkjortFerdig === null ? null : tilIso(st.framkjortFerdig),
      sisteLevering: st.sisteLevering === null ? null : tilIso(st.sisteLevering),
      fullDager: st.fullDager,
    };
  });

  for (const sp of stengt.values()) {
    varsle('info', `Skogsbilvegen til «${sp.d.navn}» er stengt (${sp.arsak}) uke ${sp.fra === sp.til ? sp.fra : `${sp.fra}–${sp.til}`} mens opptil ${Math.round(sp.maks)} m³ står ved velteplass.`,
      { drift: sp.d.id, dato: tilIso(sp.fraDag) });
  }
  for (const l of L) {
    if (l.ventDager >= 5) {
      varsle('info', `${l.lag.navn} står ${l.ventDager} arbeidsdager uten drift det kan jobbes på (sesong eller tidligst-dato). Vurder en helårsdrift i køen.`, { lag: l.lag.id });
    }
  }

  // Mottak: leveranse mot avtale
  const mottakRes = mottakListe.map((m) => {
    const levert = uker.reduce((s, u) => s + u.perMottak[m.id], 0);
    const avtalt = (+m.kvote || 0) * uker.length;
    return { id: m.id, navn: m.navn, levert, avtalt, andel: avtalt ? levert / avtalt : null };
  });

  const totLevert = leveranser.reduce((s, l) => s + l.m3, 0);
  const snittAlder = totLevert ? leveranser.reduce((s, l) => s + l.alder * l.m3, 0) / totLevert : 0;
  const totVolum = driftRes.reduce((s, d) => s + d.tot, 0);
  const ferdige = driftRes.filter((d) => d.framkjortFerdig).map((d) => d.framkjortFerdig).sort();

  const rekkefolge = { feil: 0, advarsel: 1, info: 2 };
  varsler.sort((a, b) => rekkefolge[a.niva] - rekkefolge[b.niva] || String(a.dato || '').localeCompare(String(b.dato || '')));

  return {
    inn, start: startIso, slutt: tilIso(sluttDag), uker, leveranser, varsler,
    drifter: driftRes, mottak: mottakRes,
    lag: L.map((l) => ({ id: l.lag.id, navn: l.lag.navn, segmenter: l.segmenter.map((x) => ({ ...x, fra: tilIso(x.fra), til: tilIso(x.til) })), ventDager: l.ventDager })),
    nokkel: {
      totVolum, levert: totLevert, hogd: driftRes.reduce((s, d) => s + d.hogd, 0),
      lass: leveranser.length, snittAlder, maksLager,
      bilUtnyttelse: bilTimerTilgj ? bilTimerBrukt / bilTimerTilgj : 0,
      sisteFramkjort: ferdige.length === driftRes.length && ferdige.length ? ferdige[ferdige.length - 1] : null,
    },
  };
}

// Leveranseplan som CSV (semikolon, åpnes i Excel)
export function leveranseCsv(res, plan) {
  const navnDrift = Object.fromEntries((plan.drifter || []).map((d) => [d.id, d.navn]));
  const navnMottak = Object.fromEntries((plan.mottak || []).map((m) => [m.id, m.navn]));
  const linjer = [['Dato', 'Uke', 'Drift', 'Sortiment', 'Mottak', 'm³', 'Lagret dager', 'Turtid t'].join(';')];
  for (const l of res.leveranser) {
    linjer.push([l.dato, isoUke(tilDag(l.dato)).uke, navnDrift[l.drift], sortiment(l.sortiment).navn, navnMottak[l.mottak],
      l.m3.toFixed(1).replace('.', ','), l.alder.toFixed(0), l.timer.toFixed(2).replace('.', ',')].map(csvFelt).join(';'));
  }
  return '﻿' + linjer.join('\r\n');
}
const csvFelt = (v) => (/[;"\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
