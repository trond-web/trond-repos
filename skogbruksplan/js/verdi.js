// Verdiberegning for skogeiendommen.
//   Slaktverdi        – netto (rotnetto) om alt stående volum hogges nå.
//   Jordverdi (LEV)   – Faustmanns jordforventningsverdi for snaumark: nåverdien av uendelig mange omløp.
//   Bestandsverdi     – forventningsverdi: nåverdien av å hogge bestandet på beste tidspunkt, pluss jordverdien etterpå.
//                       Hogsttidspunktet kan aldri være under PEFCs nedre aldersgrense.
//   Eiendomsverdi     – sum bestandsverdier pluss kapitaliserte årlige inntekter og kostnader.
// Alle beløp er reelle (uten inflasjon), før skatt. Ingen DOM – kan testes i Node.
import { startTilstand, volumKurve, rotnettoPerM3, framskriv, beregnetHogstklasse, laavesteHogstalder } from './model.js';
import { pefcAlder } from './pefc.js';

export const STANDARD_VERDI = {
  rente: 3.0,            // % reell kalkulasjonsrente
  horisont: 30,          // år for nåverdi av tiltaksplanen
  annenInntekt: 0,       // kr/år, f.eks. jakt, fiske, utleie
  fasteKostnader: 0,     // kr/år, f.eks. forsikring, administrasjon, eiendomsskatt
  medVeivedlikehold: true,
  ungskogpleieAar: 12,   // år etter foryngelse da ungskogpleie regnes
};

// ---------- SSB: gjennomsnittlig tømmerpris i kommunen ----------
const SSB = 'https://data.ssb.no/api/v0/no/table';
async function ssb(hent, tabell, query) {
  const r = await hent(`${SSB}/${tabell}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, response: { format: 'json-stat2' } }) });
  if (!r.ok) throw new Error(`SSB svarte ${r.status}`);
  return r.json();
}
// Gjør json-stat2 om til en funksjon som slår opp verdien for en kombinasjon av kategorier.
function jsonStat(d) {
  const idx = d.id.map((dim) => d.dimension[dim].category.index);
  return (valg) => {
    let pos = 0;
    d.id.forEach((dim, i) => { pos = pos * d.size[i] + (idx[i][valg[dim]] ?? 0); });
    return d.value[pos];
  };
}
const TRESLAG_KODE = (kode) => ({ 1: 'G', 2: 'F', 3: 'L' }[kode[0]]);
const ER_VED = (kode) => kode[1] === '8';
const ER_SAG = (kode) => kode[1] === '1';

export async function hentSsbPriser(kommunenr, { hent = fetch } = {}) {
  const regioner = [kommunenr, kommunenr.slice(0, 2), '0'];
  const verdi = await ssb(hent, '03794', [{ code: 'Region', selection: { filter: 'item', values: regioner } }, { code: 'Tid', selection: { filter: 'top', values: ['3'] } }]);
  const aarListe = Object.keys(verdi.dimension.Tid.category.index).sort().reverse();
  const v = jsonStat(verdi);
  const aar = aarListe.find((a) => v({ Region: kommunenr, ContentsCode: 'Bruttoverdi', Tid: a }) != null) || aarListe[0];
  const kvantum = await ssb(hent, '03895', [{ code: 'Region', selection: { filter: 'item', values: regioner } }, { code: 'Treslag', selection: { filter: 'all', values: ['*'] } }, { code: 'Tid', selection: { filter: 'item', values: [aar] } }]);
  const k = jsonStat(kvantum);
  const koder = Object.keys(kvantum.dimension.Treslag.category.index);
  const region = (nr, navn) => {
    const brutto = (v({ Region: nr, ContentsCode: 'Bruttoverdi', Tid: aar }) || 0) * 1000;
    const perTreslag = { G: 0, F: 0, L: 0 }; const sag = { G: 0, F: 0, L: 0 }; let total = 0;
    for (const kode of koder) {
      const m3 = k({ Region: nr, Treslag: kode, ContentsCode: 'Kvantum', Tid: aar }) || 0;
      total += m3;
      if (ER_VED(kode)) continue;
      const t = TRESLAG_KODE(kode); perTreslag[t] += m3;
      if (ER_SAG(kode)) sag[t] += m3; else if (kode.endsWith('160')) sag[t] += m3 / 2; // «sams» telles halvt
    }
    return { nr, navn, brutto, volum: total, pris: total ? brutto / total : null, perTreslag, sagandel: Object.fromEntries(Object.entries(perTreslag).map(([t, m]) => [t, m ? sag[t] / m : null])) };
  };
  const navn = (nr) => verdi.dimension.Region.category.label[nr] || nr;
  const kommune = region(kommunenr, navn(kommunenr));
  const fylke = region(kommunenr.slice(0, 2), navn(kommunenr.slice(0, 2)));
  const land = region('0', 'Hele landet');
  // Små kommunetall gir tilfeldige utslag; bruk fylket når kommunen har solgt under 5000 m³.
  const grunnlag = kommune.volum >= 5000 && kommune.pris ? kommune : fylke.pris ? fylke : land;
  return { aar: Number(aar), kommune, fylke, land, grunnlag: grunnlag.nr, hentet: new Date().toISOString() };
}

// Skalerer prisene per treslag slik at volumvektet snitt treffer SSB-prisen, med samme innbyrdes forhold som før.
export function kalibrerPriser(ssbData, pris) {
  const g = [ssbData.kommune, ssbData.fylke, ssbData.land].find((r) => r.nr === ssbData.grunnlag);
  const vol = g.perTreslag; const sumVol = vol.G + vol.F + vol.L;
  if (!g.pris || !sumVol) return null;
  const snittNaa = (vol.G * pris.G + vol.F * pris.F + vol.L * pris.L) / sumVol;
  const faktor = g.pris / snittNaa;
  return { G: Math.round(pris.G * faktor), F: Math.round(pris.F * faktor), L: Math.round(pris.L * faktor), faktor, grunnlag: g };
}

// ---------- verdier ----------
const r100 = (v) => v / 100;

function volumMot(alderNaa, volumNaa, h40, treslag) {
  // Samme forankring som framskrivingen: dagens volum skaleres med vekstkurven.
  const f0 = volumKurve(alderNaa, h40, treslag);
  return (alder) => (volumNaa > 0 && f0 > 0.5 ? volumNaa * (volumKurve(alder, h40, treslag) / f0) : Math.max(volumNaa, volumKurve(alder, h40, treslag)));
}

// Faustmann: LEV = (R(T) − Σ K_t·(1+r)^(T−t)) / ((1+r)^T − 1). Beste omløp T ≥ PEFCs nedre aldersgrense.
const levCache = new Map();
export function jordverdi(treslag, h40, inn, vInn = STANDARD_VERDI) {
  const nokkel = `${treslag}|${h40}|${vInn.rente}|${inn.pris[treslag]}|${inn.drift[treslag]}|${inn.kostPerDaa.planting}|${inn.kostPerDaa.ungskogpleie}`;
  if (levCache.has(nokkel)) return levCache.get(nokkel);
  const r = r100(vInn.rente);
  const netto = rotnettoPerM3(treslag, inn);
  const kultur = treslag === 'L' ? 0 : (inn.kostPerDaa.planting || 0);
  const pleie = inn.kostPerDaa.ungskogpleie || 0;
  const tu = vInn.ungskogpleieAar ?? 12;
  const nedre = pefcAlder(h40)?.nedre ?? 40;
  let best = { lev: -Infinity, omlop: null };
  for (let T = Math.max(nedre, 30); T <= 160; T++) {
    const R = volumKurve(T, h40, treslag) * netto;
    const C = kultur * (1 + r) ** T + pleie * (1 + r) ** (T - tu);
    const lev = (R - C) / ((1 + r) ** T - 1);
    if (lev > best.lev) best = { lev, omlop: T };
  }
  levCache.set(nokkel, best);
  return best;
}

export function bestandsverdi(b, inn, vInn = STANDARD_VERDI, { iAar = new Date().getFullYear(), utenProduksjon = false } = {}) {
  const s = startTilstand(b);
  const h40 = s.h40; const treslag = b.treslag || 'G';
  const netto = rotnettoPerM3(treslag, inn);
  const slakt = Math.max(0, s.volumDaa * netto);
  if (utenProduksjon) return { perDaa: 0, slaktPerDaa: slakt, hogstAar: null, alderVedHogst: null, lev: 0, merknad: 'Miljøfigur – settes av' };
  const { lev } = jordverdi(treslag, h40, inn, vInn);
  const r = r100(vInn.rente);
  const nedre = pefcAlder(h40)?.nedre ?? 0;
  const V = volumMot(s.alder, s.volumDaa, h40, treslag);
  const forst = Math.max(0, Math.ceil(nedre - s.alder));
  let best = { verdi: -Infinity, s: forst };
  for (let t = forst; t <= forst + 150; t++) {
    const verdi = (V(s.alder + t) * netto + lev) / (1 + r) ** t;
    if (verdi > best.verdi) best = { verdi, s: t };
  }
  return { perDaa: best.verdi, slaktPerDaa: slakt, hogstAar: iAar + best.s, alderVedHogst: Math.round(s.alder + best.s), lev, volumVedHogst: V(s.alder + best.s) };
}

export function verdiberegning(S, vInn = STANDARD_VERDI, { iAar = new Date().getFullYear(), utenProduksjonIder = new Set() } = {}) {
  const inn = S.innstillinger;
  const r = r100(vInn.rente);
  const rader = S.bestand.map((b) => {
    const v = bestandsverdi(b, inn, vInn, { iAar, utenProduksjon: b.miljo || utenProduksjonIder.has(b.id) });
    const s = startTilstand(b);
    const hk = b.hogstklasse || beregnetHogstklasse(s.alder, laavesteHogstalder(b, inn), s.volumDaa);
    return { id: b.id, nr: b.nr, treslag: b.treslag, bonitet: b.bonitet, hk, areal: b.areal || 0, alder: Math.round(s.alder), volum: s.volumDaa * (b.areal || 0), ...v, verdi: v.perDaa * (b.areal || 0), slakt: v.slaktPerDaa * (b.areal || 0) };
  });
  const skog = rader.reduce((s, x) => s + x.verdi, 0);
  const slakt = rader.reduce((s, x) => s + x.slakt, 0);
  const hogstmodenSlakt = rader.filter((x) => x.hk === 5).reduce((s, x) => s + x.slakt, 0);
  const jord = rader.reduce((s, x) => s + Math.max(0, x.lev) * x.areal, 0);
  // Veivedlikehold: snitt av planlagt vedlikehold de neste fem årene.
  const vei = vInn.medVeivedlikehold ? (S.veier?.vedlikehold || []).filter((l) => l.status === 'planlagt' && l.aar >= iAar && l.aar < iAar + 5).reduce((s, l) => s + (l.kostnad || 0), 0) / 5 : 0;
  const aarlig = (vInn.annenInntekt || 0) - (vInn.fasteKostnader || 0) - vei;
  const kapitalisert = r > 0 ? aarlig / r : 0;
  // Nåverdi av tiltaksplanen (planlagte hogster og kulturtiltak) i horisonten.
  const { aarRader } = framskriv(S.bestand, vInn.horisont, inn, { folgPlan: true, startAar: iAar });
  const plan = aarRader.reduce((s, x, t) => s + (x.inntekt - x.kostnad) / (1 + r) ** t, 0);
  return { rader, skog, slakt, hogstmodenSlakt, jord, veiPerAar: vei, aarlig, kapitalisert, eiendom: skog + kapitalisert, plan, areal: rader.reduce((s, x) => s + x.areal, 0) };
}

export function folsomhet(S, vInn, renter = [2, 3, 4, 5], opts = {}) {
  return renter.map((rente) => ({ rente, ...(({ eiendom, skog, jord }) => ({ eiendom, skog, jord }))(verdiberegning(S, { ...vInn, rente }, opts)) }));
}
