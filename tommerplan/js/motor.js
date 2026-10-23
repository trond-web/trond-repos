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
  standardKm: 50, // brukes når drift eller mottak mangler koordinater og km ikke er overstyrt
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
  return luft === null ? (+inn.standardKm || null) : luft * inn.veifaktor;
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

// ---------- Ordre (som i VSYS Virkeshandel) ----------
// Innkjøpsordre (IO) mot skogeier/leverandør gir volum per sortiment på en drift. En IO-linje kan kobles til en
// salgsordre (SO), og da går virket bare dit. SO mot kunde gir hvor mye et mottak tar imot per uke og sortiment
// innenfor ordreperioden. Produksjonsordre (PO) gir maskinlag og datoer, og faktisk produsert, framkjørt og
// transportert brukes som utgangspunkt slik at resten planlegges fra der drifta står.
export function anvendOrdre(plan) {
  const o = plan.ordre || {};
  const drifter = (plan.drifter || []).map((d) => ({ ...d, volum: { ...(d.volum || {}) }, _io: [], _po: [] }));
  const finn = (id) => drifter.find((d) => d.id === id);
  for (const io of o.io || []) {
    const d = finn(io.drift);
    if (!d) continue;
    const linjer = (io.linjer || []).filter((l) => SORT_ID.includes(l.sortiment));
    if (linjer.length && !d._io.some((x) => x.linjer?.length)) d.volum = {};
    d._io.push(io);
    for (const l of linjer) {
      d.volum[l.sortiment] = (+d.volum[l.sortiment] || 0) + (+l.volum || 0);
      if (l.so) (d.binding ||= {})[l.sortiment] = l.so;
    }
  }
  for (const po of o.po || []) {
    const d = finn(po.drift) || finn((o.io || []).find((io) => io.id === po.io)?.drift);
    if (!d) continue;
    d._po.push(po);
    if (po.lag) d.lag = po.lag;
    if (po.fra) d.tidligst = po.fra;
    if (po.til) d.frist = po.til;
    const f = po.faktisk;
    if (f && ['produsert', 'framkjort', 'transportert'].some((k) => +f[k] > 0)) {
      const g = d.faktisk || { produsert: 0, framkjort: 0, transportert: 0, dato: '' };
      d.faktisk = {
        produsert: g.produsert + (+f.produsert || 0), framkjort: g.framkjort + (+f.framkjort || 0),
        transportert: g.transportert + (+f.transportert || 0), dato: [g.dato, f.dato].filter(Boolean).sort().pop() || '',
      };
    }
  }
  return drifter;
}

const soPeriode = (so, start, slutt) => {
  const fra = so.fra ? Math.max(tilDag(so.fra), start) : start;
  const til = so.til ? tilDag(so.til) : slutt;
  return { fra, til, uker: Math.max(1, Math.ceil((til - (so.fra ? tilDag(so.fra) : start) + 1) / 7)) };
};

// ---------- Simulering ----------
export function planlegg(plan) {
  const inn = { ...STANDARD_INNSTILLINGER, ...(plan.innstillinger || {}) };
  const startIso = inn.startdato || neste_mandag(new Date().toISOString().slice(0, 10));
  const start = tilDag(startIso);
  const antDager = Math.max(1, Math.round(inn.uker)) * 7;
  const lagListe = plan.lag || [];
  const mottakListe = plan.mottak || [];
  const drifter = anvendOrdre(plan).filter((d) => totalVolum(d) > 0);
  const salg = (plan.ordre?.so || []).filter((so) => so.linjer?.length);
  const sluttDag = start + antDager - 1;

  const varsler = [];
  const varsle = (niva, tekst, ekstra = {}) => varsler.push({ niva, tekst, ...ekstra });
  const varsletEn = new Set();
  const varsleEn = (nokkel, niva, tekst, ekstra) => { if (!varsletEn.has(nokkel)) { varsletEn.add(nokkel); varsle(niva, tekst, ekstra); } };

  // Tilstand per drift. Faktiske tall fra produksjonsordren er utgangspunktet.
  const D = new Map(drifter.map((d) => {
    const f = d.faktisk || {};
    const hogd = Math.max(0, +f.produsert || 0);
    const framkjort = Math.min(hogd, Math.max(0, +f.framkjort || 0));
    const levert = Math.min(framkjort, Math.max(0, +f.transportert || 0));
    const tot = Math.max(totalVolum(d), hogd);
    const andel = Object.fromEntries(SORT_ID.map((id) => [id, (+d.volum?.[id] || 0) / totalVolum(d)]));
    const fd = f.dato ? Math.min(tilDag(f.dato), start) : start;
    const lager = Object.fromEntries(SORT_ID.map((id) => [id, andel[id] > 0 && framkjort - levert > 0.5 ? [{ dag: fd, m3: (framkjort - levert) * andel[id] }] : []]));
    const st = {
      drift: d, tot, andel, hogd, iSkog: hogd - framkjort, framkjort, levert, levertFor: levert, faktisk: hogd > 0,
      lager, // FIFO-partier { dag, m3 }
      start: hogd > 0 ? fd : null, hogstFerdig: hogd >= tot - 1e-6 && hogd > 0 ? fd : null, framkjortFerdig: null, sisteLevering: null, fullDager: 0,
    };
    if (hogd >= tot - 1e-6 && st.iSkog < 1e-6 && hogd > 0) st.framkjortFerdig = fd;
    return [d.id, st];
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
  const mottakMedSo = new Set(salg.map((so) => so.mottak));
  const mal = [
    ...mottakListe.filter((m) => !mottakMedSo.has(m.id)).map((m) => ({ key: m.id, m, sortimenter: m.sortimenter || [] })),
    ...salg.flatMap((so) => {
      const m = mottakListe.find((x) => x.id === so.mottak);
      if (!m) { varsle('feil', `Salgsordre ${so.ordrenr || 'utkast'} (${so.kunde || 'uten kunde'}) har ikke noe mottak/leveringssted i planen.`, { so: so.id }); return []; }
      const p = soPeriode(so, start, sluttDag);
      return so.linjer.map((l, i) => ({ key: `${so.id}|${i}`, m, so, linje: i, sortimenter: [l.sortiment], ...p, rate: (+l.volum || 0) / p.uker, volum: +l.volum || 0 }));
    }),
  ];
  for (const d of drifter) {
    const mangler = mal.filter((x) => x.sortimenter.some((id) => +d.volum?.[id] > 0) && avstandKm(d, x.m) === null && !(d.avstander?.[x.m.id] > 0));
    if (mangler.length) {
      varsle('info', `«${d.navn}» mangler koordinater eller km til ${[...new Set(mangler.map((x) => x.m.navn))].join(', ')}. Bruker ${inn.standardKm} km til det er lagt inn.`, { drift: d.id });
    }
    for (const [sort, soId] of Object.entries(d.binding || {})) {
      if (!mal.some((x) => x.so?.id === soId && x.sortimenter.includes(sort))) {
        varsle('feil', `«${d.navn}»: ${sortiment(sort).navn.toLowerCase()} er koblet til en salgsordre som ikke har linje for dette sortimentet.`, { drift: d.id });
      }
    }
  }
  for (const d of drifter) {
    for (const id of SORT_ID) {
      if ((+d.volum?.[id] || 0) > 0 && !mal.some((x) => x.sortimenter.includes(id))) {
        varsleEn(`ingenmottak-${id}`, 'feil', `Ingen mottak tar imot ${sortiment(id).navn.toLowerCase()}. Legg til et mottak eller en salgsordre${mottakMedSo.size ? ' (mottak med salgsordre tar bare imot sortimentene som står i ordrene)' : ''}.`);
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
  const soIgjen = {}; // resterende volum per SO-linje, så ordren ikke overleveres
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
        perMottak: Object.fromEntries(mottakListe.map((m) => [m.id, 0])), kvote: Object.fromEntries(mottakListe.map((m) => [m.id, 0])),
        bilTimer: 0, bilTimerTilgj: 0, lass: 0,
      };
      uker.push(uke);
      const ma = dag - ud;
      for (const x of mal) {
        if (x.so && soIgjen[x.key] === undefined) soIgjen[x.key] = x.volum;
        const k = x.so ? (ma + 6 >= x.fra && ma <= x.til ? Math.min(x.rate, soIgjen[x.key]) : 0) : (+x.m.kvote || 0);
        kvoteIgjen[x.key] = k;
        uke.kvote[x.m.id] += k;
      }
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
        const bundet = d.binding?.[id];
        const valg = mal
          .filter((x) => x.sortimenter.includes(id) && kvoteIgjen[x.key] > 0 && (!bundet || x.so?.id === bundet))
          .map((x) => ({ ...x, t: turTimer(d, x.m, inn) }))
          .filter((x) => x.t !== null)
          .sort((a, b) => a.t - b.t);
        for (const { m, t, key, so } of valg) {
          if (t > inn.bilTimer) varsleEn(`lang-${d.id}-${m.id}`, 'info', `En tur fra «${d.navn}» til ${m.navn} tar ${r1(t)} t, mer enn én bildag.`, { drift: d.id });
          while (timerIgjen >= Math.min(t, inn.bilTimer) && kvoteIgjen[key] > 0) {
            const paLager = lagerSum(st, id);
            const helLass = paLager >= inn.lassM3 - 1e-6;
            // Restlass kjøres når drifta er ferdig framkjørt, eller når det haster
            if (!helLass && !(ferdigFramkjort(st) || k.alder >= maksAlder(id, s, inn) * 0.8) ) break;
            if (paLager < 0.5) break;
            if (so && soIgjen[key] < 0.5) break;
            const m3 = Math.min(inn.lassM3, paLager, so ? Math.max(soIgjen[key], inn.lassM3 / 2) : Infinity);
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
            kvoteIgjen[key] -= m3;
            if (so) soIgjen[key] -= m3;
            st.levert += m3;
            st.sisteLevering = dag;
            uke.levert[id] += m3;
            uke.perMottak[m.id] += m3;
            leveranser.push({ dato: tilIso(dag), drift: d.id, sortiment: id, mottak: m.id, so: so?.id || null, soKey: so ? key : null, io: d._io[0]?.id || null, m3, alder: alderSum / m3, timer: t });
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
      const sommergrense = s.sommer && gamle.some((id) => maksAlder(id, s, inn) === inn.maksLagringSommer);
      varsle('advarsel', `${navn} på «${st.drift.navn}» har ligget mer enn ${grenser} dager ved velteplass (${tilIso(dag)})${sommergrense ? ' – risiko for blåved og barkbille' : ''}.`,
        { drift: st.drift.id, dato: tilIso(dag) });
    }
    const tot = dagLagerTot();
    if (tot > maksLager) maksLager = tot;
    if (ud === 6 || dag === start + antDager - 1) {
      for (const id of SORT_ID) uke.lager[id] = [...D.values()].reduce((sum, st) => sum + lagerSum(st, id), 0);
    }
  }

  // Oppsummering per drift
  const driftRes = drifter.map((d) => {
    const st = D.get(d.id);
    const rest = st.tot - st.levert;
    if (st.levert > st.tot + 1) varsle('advarsel', `«${d.navn}»: transportert (${Math.round(st.levert)} m³) er mer enn volumet i innkjøpsordren.`, { drift: d.id });
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
      fullDager: st.fullDager, levertFor: st.levertFor, faktisk: st.faktisk,
      io: d._io.map((x) => x.id), po: d._po.map((x) => x.id),
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

  // Mottak: leveranse mot avtale (ukekvote eller salgsordre)
  const mottakRes = mottakListe.map((m) => {
    const levert = uker.reduce((s, u) => s + u.perMottak[m.id], 0);
    const avtalt = uker.reduce((s, u) => s + u.kvote[m.id], 0);
    return { id: m.id, navn: m.navn, levert, avtalt, andel: avtalt ? levert / avtalt : null, salgsordre: mottakMedSo.has(m.id) };
  });

  // Ordre: planlagt mot avtalt
  const sum = (liste) => liste.reduce((s, l) => s + l.m3, 0);
  const soRes = salg.map((so) => {
    const linjer = so.linjer.map((l, i) => {
      const lev = leveranser.filter((x) => x.soKey === `${so.id}|${i}`);
      const p = soPeriode(so, start, sluttDag);
      const levert = sum(lev);
      const innen = sum(lev.filter((x) => tilDag(x.dato) <= p.til));
      return { sortiment: l.sortiment, volum: +l.volum || 0, pris: +l.pris || 0, levert, innenPeriode: innen, verdi: levert * (+l.pris || 0) };
    });
    const volum = linjer.reduce((s, l) => s + l.volum, 0);
    const innen = linjer.reduce((s, l) => s + l.innenPeriode, 0);
    const til = so.til || tilIso(sluttDag);
    if (volum > 0 && innen < volum * 0.98 && til <= tilIso(sluttDag)) {
      varsle('advarsel', `Salgsordre ${so.ordrenr || 'utkast'} (${so.kunde || 'kunde'}): planen leverer ${Math.round(innen)} av ${Math.round(volum)} m³ innen ${til}.`, { so: so.id, dato: til });
    }
    return { id: so.id, ordrenr: so.ordrenr, volum, levert: linjer.reduce((s, l) => s + l.levert, 0), innenPeriode: innen, verdi: linjer.reduce((s, l) => s + l.verdi, 0), linjer };
  });
  const ioRes = (plan.ordre?.io || []).map((io) => {
    const dr = driftRes.find((d) => d.id === io.drift);
    const lev = leveranser.filter((x) => x.drift === io.drift);
    const linjer = (io.linjer || []).map((l) => ({ sortiment: l.sortiment, volum: +l.volum || 0, so: l.so || '', levert: sum(lev.filter((x) => x.sortiment === l.sortiment)) }));
    const volum = linjer.reduce((s, l) => s + l.volum, 0);
    if (!dr) varsle('feil', `Innkjøpsordre ${io.ordrenr || 'utkast'} (${io.leverandor || 'leverandør'}) er ikke koblet til noen drift.`, { io: io.id });
    return { id: io.id, ordrenr: io.ordrenr, volum, levert: dr ? dr.levert : 0, start: dr?.start || null, framkjortFerdig: dr?.framkjortFerdig || null, sisteLevering: dr?.sisteLevering || null, linjer };
  });
  const poRes = (plan.ordre?.po || []).map((po) => {
    const dId = po.drift || (plan.ordre?.io || []).find((io) => io.id === po.io)?.drift;
    const dr = driftRes.find((d) => d.id === dId);
    if (!dr) varsle('feil', `Produksjonsordre ${po.ordrenr || 'utkast'} er ikke koblet til noen drift.`, { po: po.id });
    return { id: po.id, ordrenr: po.ordrenr, drift: dId, start: dr?.start || null, hogstFerdig: dr?.hogstFerdig || null, framkjortFerdig: dr?.framkjortFerdig || null, hogd: dr?.hogd || 0, framkjort: dr?.framkjort || 0 };
  });
  // Balanse: salg mot det som er kjøpt inn (IO) eller planlagt hogd, per sortiment
  for (const id of SORT_ID) {
    const solgt = salg.reduce((s, so) => s + so.linjer.filter((l) => l.sortiment === id).reduce((a, l) => a + (+l.volum || 0), 0), 0);
    const tilgang = drifter.reduce((s, d) => s + (+d.volum?.[id] || 0), 0);
    if (solgt > tilgang * 1.02 && solgt > 0) {
      varsle('advarsel', `Salgsordrene på ${sortiment(id).navn.toLowerCase()} (${Math.round(solgt)} m³) er større enn det som er kjøpt inn eller planlagt hogd (${Math.round(tilgang)} m³).`);
    }
    const friMottak = mal.some((x) => !x.so && x.sortimenter.includes(id));
    if (salg.length && !friMottak && mal.some((x) => x.sortimenter.includes(id)) && tilgang > solgt * 1.02 + 1) {
      varsle('advarsel', `Det mangler salgsordre for ${Math.round(tilgang - solgt)} m³ ${sortiment(id).navn.toLowerCase()}: ${Math.round(tilgang)} m³ skal hogges, men bare ${Math.round(solgt)} m³ er solgt.`);
    }
  }

  const totLevert = leveranser.reduce((s, l) => s + l.m3, 0);
  const snittAlder = totLevert ? leveranser.reduce((s, l) => s + l.alder * l.m3, 0) / totLevert : 0;
  const totVolum = driftRes.reduce((s, d) => s + d.tot, 0);
  const ferdige = driftRes.filter((d) => d.framkjortFerdig).map((d) => d.framkjortFerdig).sort();

  const rekkefolge = { feil: 0, advarsel: 1, info: 2 };
  varsler.sort((a, b) => rekkefolge[a.niva] - rekkefolge[b.niva] || String(a.dato || '').localeCompare(String(b.dato || '')));

  return {
    inn, start: startIso, slutt: tilIso(sluttDag), uker, leveranser, varsler,
    drifter: driftRes, mottak: mottakRes, ordre: { so: soRes, io: ioRes, po: poRes },
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
