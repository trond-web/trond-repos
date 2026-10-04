// Fagmodell: normalisering av bestandsdata, hogstmodenhet, tilvekst/framskriving, økonomi og tiltaksforslag.
// Modellene er forenklede og ment for planlegging – alle satser kan justeres under Innstillinger.

export const TRESLAG = { G: 'Gran', F: 'Furu', L: 'Lauv' };
export const HOGSTKLASSER = [1, 2, 3, 4, 5];
export const HK_NAVN = { 1: 'I – Skogfornyelse', 2: 'II – Ungskog', 3: 'III – Yngre produksjonsskog', 4: 'IV – Eldre produksjonsskog', 5: 'V – Hogstmoden skog' };
export const HK_ROMERTALL = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
export const BONITETER = [6, 8, 11, 14, 17, 20, 23, 26];

export const TILTAKSTYPER = {
  sluttavvirkning: { navn: 'Sluttavvirkning', gruppe: 'hogst' },
  tynning: { navn: 'Tynning', gruppe: 'hogst' },
  planting: { navn: 'Planting', gruppe: 'kultur' },
  suppleringsplanting: { navn: 'Suppleringsplanting', gruppe: 'kultur' },
  markberedning: { navn: 'Markberedning', gruppe: 'kultur' },
  ungskogpleie: { navn: 'Ungskogpleie', gruppe: 'kultur' },
  stammekvisting: { navn: 'Stammekvisting', gruppe: 'kultur' },
  gjodsling: { navn: 'Gjødsling', gruppe: 'kultur' },
  groftrensk: { navn: 'Grøfterensk', gruppe: 'annet' },
  vei: { navn: 'Vei/driftsvei', gruppe: 'annet' },
  miljo: { navn: 'Miljøtiltak/nøkkelbiotop', gruppe: 'annet' },
  annet: { navn: 'Annet', gruppe: 'annet' },
};

export const STANDARD_INNSTILLINGER = {
  pris: { G: 480, F: 440, L: 330 },            // kr/m³ snittpris tømmer+massevirke
  drift: { G: 160, F: 165, L: 180 },           // kr/m³ hogst og utkjøring, sluttavvirkning
  driftTynning: 250,                           // kr/m³ i tynning
  tynningUttak: 0.25,                          // andel av volum som tas ut i tynning
  kostPerDaa: { planting: 1900, suppleringsplanting: 800, markberedning: 450, ungskogpleie: 650, stammekvisting: 900, gjodsling: 600, groftrensk: 300 },
  skogfondProsent: 15,                         // 4–40 % i henhold til skogfondsordningen
  co2PerM3: 1.4,
  hogstFordelingAar: 10,                       // spre foreslått sluttavvirkning over så mange år (1 = alt nå)                               // tonn CO₂ per m³ stammetilvekst inkl. greiner/røtter (grovt)
  // Laveste hogstalder etter bonitet (H40). Veiledende – kontroller mot gjeldende forskrift.
  hogstalder: {
    G: { 6: 120, 8: 120, 11: 100, 14: 90, 17: 80, 20: 70, 23: 60, 26: 60 },
    F: { 6: 140, 8: 120, 11: 100, 14: 90, 17: 80, 20: 70, 23: 60, 26: 60 },
    L: { 6: 70, 8: 70, 11: 60, 14: 60, 17: 50, 20: 50, 23: 40, 26: 40 },
  },
};

// SR16 treslagskode: 1 grandominert, 2 furudominert, 3 barblanding, 4 blanding (bar/lauv), 5 lauvdominert.
export const SR16_TRESLAG_TEKST = { 1: 'grandominert', 2: 'furudominert', 3: 'barblanding', 4: 'blanding', 5: 'lauvdominert' };
// Gir G/F/L. Bruker andel per treslag når den finnes (størst andel vinner), ellers koden.
export function treslagFraSR16(kode, andel = null) {
  if (andel) {
    const best = Object.entries(andel).filter(([, v]) => Number.isFinite(v)).sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > 0) return best[0];
  }
  return { 1: 'G', 2: 'F', 3: 'G', 4: 'L', 5: 'L' }[parseInt(kode, 10)] || null;
}

// ---------- Normalisering av importerte attributter ----------

const FELT = {
  nr: ['BESTANDNR', 'BESTAND_NR', 'BESTANDSNR', 'BESTNR', 'BEST_NR', 'BESTAND', 'NR', 'BESTANDSNUMMER', 'ID'],
  teig: ['TEIG', 'TEIGNR', 'TEIG_NR'],
  areal: ['AREAL_DAA', 'AREALDAA', 'PRODUKTIVT_AREAL', 'PROD_AREAL', 'AREAL', 'DAA', 'DEKAR'],
  treslag: ['TRESLAG', 'HOVEDTRESLAG', 'TRESL', 'TRESLAG_KODE', 'TSL', 'TRESLAGSKODE'],
  bonitet: ['BONITET', 'BON', 'H40', 'SI', 'BONITET_H40', 'SITEINDEX'],
  hogstklasse: ['HOGSTKLASSE', 'HKL', 'HK', 'HOGSTKL'],
  alder: ['ALDER', 'BESTANDSALDER', 'ALDER_TOT', 'TOTALALDER', 'ALDER_BRH'],
  volumDaa: ['VOLUM_DAA', 'M3_DAA', 'VOLUM_PR_DAA', 'VOLDAA', 'M3DAA', 'VOLUM_PER_DAA'],
  volum: ['VOLUM', 'VOLUM_TOTAL', 'TOTALVOLUM', 'M3', 'VOL', 'VOLUM_M3', 'TOT_VOLUM'],
  treantall: ['TREANTALL', 'TREANTALL_DAA', 'TREANT_DAA', 'TRE_DAA', 'STAMMETALL', 'N_DAA'],
  hoyde: ['MIDDELHOYDE', 'HOYDE', 'HL', 'LOREYS_HOYDE', 'MHOYDE'],
  gran: ['GRAN_PST', 'GRAN_PROSENT', 'ANDEL_GRAN', 'PST_GRAN'],
  furu: ['FURU_PST', 'FURU_PROSENT', 'ANDEL_FURU', 'PST_FURU'],
  lauv: ['LAUV_PST', 'LAUV_PROSENT', 'ANDEL_LAUV', 'PST_LAUV'],
  tiltak: ['TILTAK', 'TILTAK1', 'TILTAKSKODE', 'FORESLATT_TILTAK', 'TILTAKSTYPE'],
  tiltakAar: ['TILTAK_AAR', 'TILTAKAAR', 'TILTAKSAAR', 'AAR_TILTAK', 'TILTAK1_AAR'],
  merknad: ['MERKNAD', 'KOMMENTAR', 'BESKRIVELSE', 'NOTAT', 'NOTE'],
  miljo: ['MILJOFIGUR', 'NOKKELBIOTOP', 'MIS', 'MILJO'],
};

export function normaliserNokkel(k) {
  return String(k).toUpperCase()
    .replace(/Æ/g, 'AE').replace(/Ø/g, 'O').replace(/Å/g, 'AA')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function tall(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function tolkTreslag(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim().toUpperCase();
  if (['1', 'G', 'GRAN', 'GR'].includes(s) || s.startsWith('GRAN')) return 'G';
  if (['2', 'F', 'FURU', 'FU'].includes(s) || s.startsWith('FURU')) return 'F';
  if (['3', '4', 'L', 'LAUV', 'LAUVTRE', 'BJORK', 'BJØRK', 'B'].includes(s) || s.startsWith('LAUV') || s.startsWith('BJ')) return 'L';
  if (/^[GFL]\d+$/.test(s)) return s[0];
  return null;
}

export function tolkBonitet(v) {
  if (v === null || v === undefined || v === '') return { h40: null, treslag: null };
  const s = String(v).trim().toUpperCase();
  const m = s.match(/^([GFLB])\s*(\d+)$/);
  if (m) return { h40: Number(m[2]), treslag: m[1] === 'B' ? 'L' : m[1] };
  const n = tall(s);
  return { h40: n, treslag: null };
}

export function tolkHogstklasse(v) {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim().toUpperCase().replace(/[^IVX0-9]/g, '');
  const rom = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
  if (rom[s]) return rom[s];
  const n = parseInt(s, 10);
  return n >= 1 && n <= 5 ? n : null;
}

export function tolkTiltak(v) {
  if (!v) return null;
  const s = normaliserNokkel(v);
  if (/SLUTT|FLATE|AVVIRK|SNAUHOGST/.test(s)) return 'sluttavvirkning';
  if (/TYNN/.test(s)) return 'tynning';
  if (/SUPPL/.test(s)) return 'suppleringsplanting';
  if (/PLANT/.test(s)) return 'planting';
  if (/MARKB/.test(s)) return 'markberedning';
  if (/UNGSKOG|RYDD|PLEIE/.test(s)) return 'ungskogpleie';
  if (/KVIST/.test(s)) return 'stammekvisting';
  if (/GJOD/.test(s)) return 'gjodsling';
  if (/GROFT/.test(s)) return 'groftrensk';
  if (/VEI/.test(s)) return 'vei';
  return 'annet';
}

let teller = 0;
export function nyId(prefiks = 'b') {
  teller += 1;
  return `${prefiks}${Date.now().toString(36)}${teller.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Gjør om et vilkårlig attributtsett til et bestandsobjekt. arealGeom er areal fra geometri i daa.
export function normaliserBestand(props, geometri, arealGeomDaa, iAar = new Date().getFullYear()) {
  const p = {};
  for (const [k, v] of Object.entries(props || {})) p[normaliserNokkel(k)] = v;
  const hent = (felt) => {
    for (const k of FELT[felt]) if (p[k] !== undefined && p[k] !== null && p[k] !== '') return p[k];
    return null;
  };
  const brukt = new Set(Object.values(FELT).flat());

  const bon = tolkBonitet(hent('bonitet'));
  let treslag = tolkTreslag(hent('treslag')) || bon.treslag;
  if (!treslag) {
    const andel = { G: tall(hent('gran')) || 0, F: tall(hent('furu')) || 0, L: tall(hent('lauv')) || 0 };
    const max = Object.entries(andel).sort((a, b) => b[1] - a[1])[0];
    treslag = max[1] > 0 ? max[0] : 'G';
  }
  let areal = tall(hent('areal'));
  if (areal !== null && areal > 5000) areal /= 1000; // trolig m²
  if (areal === null || areal <= 0) areal = arealGeomDaa || 0;

  let volumDaa = tall(hent('volumDaa'));
  const volumTot = tall(hent('volum'));
  if (volumDaa === null && volumTot !== null && areal > 0) volumDaa = volumTot / areal;

  const tiltak = [];
  const tType = tolkTiltak(hent('tiltak'));
  if (tType) {
    tiltak.push({ id: nyId('t'), type: tType, aar: tall(hent('tiltakAar')) || iAar, status: 'planlagt', prioritet: 2, kommentar: String(hent('tiltak')) });
  }

  const ekstra = {};
  for (const [k, v] of Object.entries(props || {})) {
    if (!brukt.has(normaliserNokkel(k)) && !k.startsWith('_') && v !== null && typeof v !== 'object') ekstra[k] = v;
  }

  return {
    id: nyId('b'),
    nr: String(hent('nr') ?? '').trim(),
    teig: hent('teig') !== null ? String(hent('teig')) : '',
    areal: runde(areal, 2),
    treslag,
    bonitet: bon.h40,
    hogstklasse: tolkHogstklasse(hent('hogstklasse')),
    alder: tall(hent('alder')),
    volumDaa: volumDaa !== null ? runde(volumDaa, 2) : null,
    treantall: tall(hent('treantall')),
    hoyde: tall(hent('hoyde')),
    miljo: Boolean(hent('miljo')) && !['0', 'NEI', 'N', 'FALSE'].includes(String(hent('miljo')).toUpperCase()),
    merknad: hent('merknad') ? String(hent('merknad')) : '',
    tiltak,
    ekstra,
    takstAar: iAar,
    geometri: geometri || null,
  };
}

export function runde(v, d = 0) {
  if (v === null || v === undefined || !Number.isFinite(v)) return v;
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

// ---------- Hogstmodenhet ----------

function naermesteBonitet(h40) {
  return BONITETER.reduce((a, b) => (Math.abs(b - h40) < Math.abs(a - h40) ? b : a));
}

export function laavesteHogstalder(b, inn = STANDARD_INNSTILLINGER) {
  if (!b.bonitet) return null;
  const tab = inn.hogstalder[b.treslag || 'G'] || inn.hogstalder.G;
  return tab[naermesteBonitet(b.bonitet)] ?? null;
}

// Hogstklasse ut fra alder og laveste hogstalder (brukes i framskriving og når HK mangler).
export function beregnetHogstklasse(alder, minAlder, volumDaa) {
  if (alder === null || alder === undefined || !minAlder) return null;
  if (alder < 3 || volumDaa === 0) return alder < 3 ? 1 : 2;
  if (alder < 0.3 * minAlder) return 2;
  if (alder < 0.65 * minAlder) return 3;
  if (alder < minAlder) return 4;
  return 5;
}

// ---------- Tilvekstmodell ----------
// Forenklet Chapman–Richards-kurve for volum per daa som funksjon av alder og bonitet.
// Brukes relativt: fremtidig volum = nåvolum × f(alder+t)/f(alder), slik at registrerte data er ankeret.

const MAKS_FAKTOR = { G: 3.0, F: 2.4, L: 2.0 };

export function volumKurve(alder, h40, treslag = 'G') {
  if (!h40 || alder <= 0) return 0;
  const k = 0.012 + 0.0012 * h40;
  return MAKS_FAKTOR[treslag] * h40 * (1 - Math.exp(-k * alder)) ** 3;
}

function estimerAlder(volumDaa, h40, treslag) {
  if (!volumDaa || !h40) return null;
  let lo = 1; let hi = 250;
  if (volumDaa >= volumKurve(hi, h40, treslag)) return hi;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (volumKurve(mid, h40, treslag) < volumDaa) lo = mid; else hi = mid;
  }
  return Math.round(lo);
}

// Startverdier for et bestand (alder/volum) med fallback der data mangler.
export function startTilstand(b) {
  const h40 = b.bonitet || 11;
  let alder = b.alder;
  let volumDaa = b.volumDaa;
  if (alder === null || alder === undefined) alder = estimerAlder(volumDaa, h40, b.treslag) ?? (b.hogstklasse === 1 ? 0 : null);
  if ((volumDaa === null || volumDaa === undefined) && alder !== null) volumDaa = volumKurve(alder, h40, b.treslag);
  return { alder: alder ?? 0, volumDaa: volumDaa ?? 0, h40 };
}

function vekst(volumDaa, alder, h40, treslag, aar) {
  const f0 = volumKurve(alder, h40, treslag);
  const f1 = volumKurve(alder + aar, h40, treslag);
  if (volumDaa > 0 && f0 > 0.5) return volumDaa * (f1 / f0);
  // Svært unge bestand eller manglende volum: følg kurven direkte.
  return Math.max(volumDaa, f1);
}

export function arligTilvekstDaa(b) {
  const s = startTilstand(b);
  return Math.max(0, vekst(s.volumDaa, s.alder, s.h40, b.treslag, 1) - s.volumDaa);
}

// ---------- Økonomi ----------

export function rotnettoPerM3(treslag, inn = STANDARD_INNSTILLINGER, tynning = false) {
  const pris = inn.pris[treslag] ?? inn.pris.G;
  const drift = tynning ? inn.driftTynning : (inn.drift[treslag] ?? inn.drift.G);
  return pris - drift;
}

export function tiltakKostnad(type, arealDaa, inn = STANDARD_INNSTILLINGER) {
  return (inn.kostPerDaa[type] || 0) * (arealDaa || 0);
}

// ---------- Framskriving ----------
// Simulerer hele eiendommen år for år. Med folgPlan = true utføres planlagte sluttavvirkninger og tynninger.
export function framskriv(bestandListe, aarFrem, inn = STANDARD_INNSTILLINGER, { folgPlan = true, startAar = new Date().getFullYear() } = {}) {
  const tilstand = bestandListe.map((b) => ({ b, ...startTilstand(b) }));
  const aarRader = [];
  const perBestand = new Map(bestandListe.map((b) => [b.id, []]));

  for (let t = 0; t <= aarFrem; t++) {
    const aar = startAar + t;
    let staaende = 0; let tilvekst = 0; let avvirkning = 0; let inntekt = 0; let kostnad = 0;
    for (const s of tilstand) {
      const { b } = s;
      const areal = b.areal || 0;
      staaende += s.volumDaa * areal; // stående volum ved inngangen av året, før årets hogst
      if (folgPlan) {
        for (const tk of b.tiltak || []) {
          if (tk.status === 'utfort' || tk.aar !== aar) continue;
          if (tk.type === 'sluttavvirkning' && s.volumDaa > 0) {
            const m3 = s.volumDaa * areal;
            avvirkning += m3;
            inntekt += m3 * rotnettoPerM3(b.treslag, inn);
            s.volumDaa = 0; s.alder = 0;
          } else if (tk.type === 'tynning' && s.volumDaa > 0) {
            const m3 = s.volumDaa * areal * inn.tynningUttak;
            avvirkning += m3;
            inntekt += m3 * rotnettoPerM3(b.treslag, inn, true);
            s.volumDaa *= (1 - inn.tynningUttak);
          } else {
            kostnad += tiltakKostnad(tk.type, areal, inn);
          }
        }
      }
      const minAlder = laavesteHogstalder({ ...b, bonitet: s.h40 }, inn);
      perBestand.get(b.id).push({ aar, alder: Math.round(s.alder), volumDaa: s.volumDaa, hk: beregnetHogstklasse(s.alder, minAlder, s.volumDaa) });
      const neste = vekst(s.volumDaa, s.alder, s.h40, b.treslag, 1);
      tilvekst += (neste - s.volumDaa) * areal;
      s.volumDaa = neste;
      s.alder += 1;
    }
    aarRader.push({ aar, staaende, tilvekst, avvirkning, inntekt, kostnad, co2: tilvekst * inn.co2PerM3 });
  }
  return { aarRader, perBestand };
}

// ---------- Tiltaksforslag ----------
export function foreslaaTiltak(b, inn = STANDARD_INNSTILLINGER, iAar = new Date().getFullYear()) {
  const forslag = [];
  const s = startTilstand(b);
  const minAlder = laavesteHogstalder(b, inn);
  const hk = b.hogstklasse || beregnetHogstklasse(s.alder, minAlder, s.volumDaa);
  const har = (type) => (b.tiltak || []).some((t) => t.type === type && t.status !== 'utfort');
  if (b.miljo) return forslag; // aldri foreslå hogst i miljøfigurer

  const hogstmoden = hk === 5 || (minAlder && s.alder >= minAlder);
  if (hogstmoden && b.volumDaa !== null && b.volumDaa !== undefined && b.volumDaa < 8) {
    // Gammel nok, men lite volum: trolig allerede hogd, glissen eller feil i data. Hogst lønner seg ikke.
    if (!har('annet')) forslag.push({ type: 'annet', aar: iAar, prioritet: 2, kommentar: `Kontroller i felt: alder ${Math.round(s.alder)} år, men bare ${String(runde(b.volumDaa, 1)).replace(".", ",")} m³/daa – hogd, glissen eller feil alder?` });
  } else if (hogstmoden) {
    if (!har('sluttavvirkning')) {
      const overmoden = minAlder && s.alder >= minAlder + 20;
      forslag.push({ type: 'sluttavvirkning', aar: iAar, prioritet: overmoden ? 1 : 2, kommentar: `Alder ${Math.round(s.alder)} år ≥ laveste hogstalder ${minAlder ?? '?'} år` });
      if (!har('planting') && (s.h40 >= 11 && b.treslag !== 'L')) {
        forslag.push({ type: 'planting', aar: iAar + 1, prioritet: 1, kommentar: 'Foryngelse etter hogst (plikt etter skogbruksloven)' });
      }
    }
  } else if (hk === 1 && !har('planting') && s.h40 >= 11) {
    forslag.push({ type: 'planting', aar: iAar, prioritet: 1, kommentar: 'Skogfornyelsesflate uten registrert foryngelse' });
  } else if (hk === 2 && !har('ungskogpleie') && ((b.treantall ?? 0) > 280 || (b.treantall == null && s.alder >= 6 && s.alder <= 20))) {
    forslag.push({ type: 'ungskogpleie', aar: iAar, prioritet: (b.treantall ?? 0) > 400 ? 1 : 2, kommentar: b.treantall ? `${b.treantall} trær/daa – vurder regulering` : 'Vurder behov for ungskogpleie' });
  } else if (hk === 3 && !har('tynning') && s.h40 >= 14 && b.treslag !== 'L' && ((b.treantall ?? 0) > 150 || (b.treantall == null && s.volumDaa >= 12))) {
    forslag.push({ type: 'tynning', aar: iAar + 2, prioritet: 3, kommentar: 'Tett bestand på god bonitet – vurder tynning' });
  }
  return forslag;
}

// Forslag for hele eiendommen. Sluttavvirkning spres over inn.hogstFordelingAar år for jevn avvirkning:
// mest overmodne bestand først, hvert år fylles opp mot et volummål. Planting følger året etter hogst.
export function foreslaaForEiendom(bestandListe, inn = STANDARD_INNSTILLINGER, iAar = new Date().getFullYear()) {
  const alle = bestandListe.flatMap((b) => foreslaaTiltak(b, inn, iAar).map((f) => ({ ...f, b })));
  const hogst = alle.filter((f) => f.type === 'sluttavvirkning');
  const n = Math.max(1, Math.round(inn.hogstFordelingAar || 1));
  if (hogst.length && n > 1) {
    const vol = (b) => startTilstand(b).volumDaa * (b.areal || 0);
    const overskudd = (b) => startTilstand(b).alder - (laavesteHogstalder(b, inn) || 0);
    hogst.sort((x, y) => x.prioritet - y.prioritet || overskudd(y.b) - overskudd(x.b));
    const sum = hogst.reduce((s, f) => s + vol(f.b), 0);
    const maal = sum / n;
    const perAar = new Array(n).fill(0);
    for (const f of hogst) {
      // Første år med plass; et stort bestand får et tomt år for seg selv.
      let i = perAar.findIndex((v) => v === 0 || v + vol(f.b) <= maal * 1.0001);
      if (i < 0) i = perAar.indexOf(Math.min(...perAar));
      perAar[i] += vol(f.b);
      f.aar = iAar + i;
      const planting = alle.find((x) => x.b === f.b && x.type === 'planting');
      if (planting) planting.aar = f.aar + 1;
    }
  }
  return alle;
}

// ---------- Sammendrag ----------
export function sammendrag(bestandListe, inn = STANDARD_INNSTILLINGER) {
  let areal = 0; let volum = 0; let tilvekst = 0; let verdiHogstmoden = 0;
  const perHk = {}; const perTreslag = { G: 0, F: 0, L: 0 };
  for (const hk of HOGSTKLASSER) perHk[hk] = { G: 0, F: 0, L: 0 };
  let utenHk = 0;
  for (const b of bestandListe) {
    const s = startTilstand(b);
    const a = b.areal || 0;
    areal += a;
    volum += s.volumDaa * a;
    tilvekst += arligTilvekstDaa(b) * a;
    perTreslag[b.treslag || 'G'] += s.volumDaa * a;
    const hk = b.hogstklasse || beregnetHogstklasse(s.alder, laavesteHogstalder(b, inn), s.volumDaa);
    if (hk) perHk[hk][b.treslag || 'G'] += a; else utenHk += a;
    if (hk === 5) verdiHogstmoden += s.volumDaa * a * rotnettoPerM3(b.treslag, inn);
  }
  return { areal, volum, tilvekst, verdiHogstmoden, perHk, perTreslag, utenHk, co2: tilvekst * inn.co2PerM3, antall: bestandListe.length };
}
