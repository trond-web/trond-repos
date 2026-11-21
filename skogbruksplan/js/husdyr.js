// 🐄 Husdyr på gården: dyrehold, husdyrgjødsel (mengde, fosfor, lager og spredeareal) og fôrbalanse (grovfôr, beite og
// kraftfôr mot avlingene i skifteplanen). Dyreholdet ligger i skifteplanen (S.skifteplan.dyrehold). Ingen DOM.
// Tallene per dyr er typiske anslag (forenklet etter Gjødslingshåndboka og tidligere gjødseldyrenheter, 1 GDE = 14 kg P)
// og kan justeres per dyreslag i appen.
import { KULTURER, HUSDYR, aktiveSkifter, fosforgrense } from './skifteplan.js';

// P = kg fosfor i gjødsla per dyr og år. gjodsel = type i HUSDYR. inne = måneder innefôring (resten på beite).
// grovfor = FEm grovfôr per dyr og år (inkludert beite). kraftfor = kg kraftfôr per dyr og år.
// ksl = KSL-kapitlene (sjekklister) som gjelder dyreslaget. Hest i næring (70) gjelder bare når hestene inngår i næring.
// per = hva antallet gjelder (plass = gjennomsnittlig antall dyr, produsert = dyr produsert per år).
export const DYRESLAG = {
  melkeku: { navn: 'Melkeku', ikon: '🐄', gruppe: 'Storfe', per: 'plass', P: 14, gjodsel: 'storfe', inne: 9, grovfor: 3500, kraftfor: 2000, ksl: [30, 31, 35] },
  ammeku: { navn: 'Ammeku med kalv', ikon: '🐂', gruppe: 'Storfe', per: 'plass', P: 11, gjodsel: 'storfe', inne: 8, grovfor: 2700, kraftfor: 200, ksl: [30, 31] },
  ungdyr: { navn: 'Ungdyr storfe (kvige)', ikon: '🐮', gruppe: 'Storfe', per: 'plass', P: 5, gjodsel: 'storfe', inne: 8, grovfor: 1500, kraftfor: 300, ksl: [30, 31] },
  okse: { navn: 'Okse til slakt', ikon: '🐂', gruppe: 'Storfe', per: 'plass', P: 5, gjodsel: 'storfe', inne: 12, grovfor: 1800, kraftfor: 900, ksl: [30, 31] },
  sau: { navn: 'Sau, vinterfôret (med lam)', ikon: '🐑', gruppe: 'Småfe', per: 'plass', P: 2, gjodsel: 'sau', inne: 7, grovfor: 450, kraftfor: 60, ksl: [30, 32] },
  geit: { navn: 'Melkegeit', ikon: '🐐', gruppe: 'Småfe', per: 'plass', P: 2, gjodsel: 'sau', inne: 9, grovfor: 600, kraftfor: 250, ksl: [30, 32, 35] },
  hest: { navn: 'Hest', ikon: '🐎', gruppe: 'Hest', per: 'plass', P: 7, gjodsel: 'hest', inne: 7, grovfor: 2800, kraftfor: 300, ksl: [70] },
  ponni: { navn: 'Ponni / lettere hest', ikon: '🐴', gruppe: 'Hest', per: 'plass', P: 4, gjodsel: 'hest', inne: 7, grovfor: 1700, kraftfor: 100, ksl: [70] },
  alpakka: { navn: 'Alpakka / lama', ikon: '🦙', gruppe: 'Andre', per: 'plass', P: 1.5, gjodsel: 'sau', inne: 6, grovfor: 350, kraftfor: 30, ksl: [30] },
  verpehone: { navn: 'Verpehøne', ikon: '🐔', gruppe: 'Fjørfe', per: 'plass', P: 0.175, gjodsel: 'fjorfe', inne: 12, grovfor: 0, kraftfor: 42, ksl: [50, 51] },
  slaktekylling: { navn: 'Slaktekylling', ikon: '🐤', gruppe: 'Fjørfe', per: 'produsert', P: 0.012, gjodsel: 'fjorfe', inne: 12, grovfor: 0, kraftfor: 3.5, ksl: [50, 53] },
  kalkun: { navn: 'Kalkun', ikon: '🦃', gruppe: 'Fjørfe', per: 'produsert', P: 0.09, gjodsel: 'fjorfe', inne: 12, grovfor: 0, kraftfor: 28, ksl: [50, 54] },
  purke: { navn: 'Avlspurke (med smågris)', ikon: '🐖', gruppe: 'Svin', per: 'plass', P: 5.6, gjodsel: 'svin', inne: 12, grovfor: 0, kraftfor: 1300, ksl: [40] },
  slaktegris: { navn: 'Slaktegris', ikon: '🐷', gruppe: 'Svin', per: 'produsert', P: 0.78, gjodsel: 'svin', inne: 12, grovfor: 0, kraftfor: 250, ksl: [40] },
};
// Forutsetninger for fôrbalansen (kan overstyres i dyrehold.forutsetninger).
export const FORUTSETNINGER = { tapKonservering: 15, beiteUtnyttelse: 75, femPerRundball: 230, lagerKrav: 8 };

export const tomtDyrehold = () => ({ dyr: [], beiting: [], lager: null, forutsetninger: {} });
export const nyttDyr = (slag = 'melkeku', nyId) => ({ id: nyId ? nyId('dy') : `dy${Math.random().toString(36).slice(2, 9)}`, slag, antall: 0 });
const tallEller = (v, d) => (v === '' || v == null || !Number.isFinite(Number(v)) ? d : Number(v));
// Verdier for én rad: standard for dyreslaget, overstyrt av egne tall på raden.
export function verdier(rad) {
  const d = DYRESLAG[rad?.slag] || DYRESLAG.melkeku;
  return { ...d, P: tallEller(rad.P, d.P), inne: Math.min(12, Math.max(0, tallEller(rad.inne, d.inne))), grovfor: tallEller(rad.grovfor, d.grovfor), kraftfor: tallEller(rad.kraftfor, d.kraftfor) };
}
const forut = (dh) => ({ ...FORUTSETNINGER, ...Object.fromEntries(Object.entries(dh?.forutsetninger || {}).filter(([, v]) => v !== '' && v != null && Number.isFinite(Number(v))).map(([k, v]) => [k, Number(v)])) });

// Husdyrgjødsel per år: mengde (tonn ≈ m³), fosfor, andel til lager og på beite, lagerbehov og spredeareal.
export function husdyrgjodsel(S, aar) {
  const plan = S?.skifteplan; const dh = plan?.dyrehold; const f = forut(dh);
  const rader = (dh?.dyr || []).filter((r) => Number(r.antall) > 0).map((r) => {
    const v = verdier(r); const n = Number(r.antall); const h = HUSDYR[v.gjodsel];
    const P = n * v.P; const tonn = h?.P ? P / h.P : 0; const andelInne = v.inne / 12;
    return { id: r.id, slag: r.slag, navn: v.navn, ikon: v.ikon, antall: n, per: v.per, inne: v.inne, gjodsel: v.gjodsel, gjodselNavn: h?.navn, P, N: tonn * (h?.N || 0), K: tonn * (h?.K || 0), tonn, tonnLager: tonn * andelInne, Pbeite: P * (1 - andelInne),
      lagerBehov: v.inne ? (tonn * andelInne / v.inne) * Math.min(f.lagerKrav, v.inne) : 0 };
  });
  const sum = (k) => rader.reduce((s, r) => s + r[k], 0);
  const aktive = plan ? aktiveSkifter(plan, aar) : [];
  const areal = aktive.reduce((s, x) => s + (x.areal || 0), 0);
  const region = plan?.region || 'innland';
  const grense = fosforgrense(Math.max(aar, 2027), region);
  const P = sum('P');
  // Husdyrgjødsel som er lagt inn i gjødslingsplanen for året (tonn og kg P).
  let planTonn = 0; let planP = 0;
  for (const sk of plan?.skifter || []) for (const g of sk.gjodsling || []) if (g.type === 'husdyr' && Number(g.aar) === aar) { const t = (Number(g.mengde) || 0) * (sk.areal || 0); planTonn += t; planP += t * ((g.innhold || HUSDYR[g.produkt] || {}).P || 0); }
  return {
    rader, P, N: sum('N'), K: sum('K'), tonn: sum('tonn'), tonnLager: sum('tonnLager'), Pbeite: sum('Pbeite'), lagerBehov: sum('lagerBehov'), lager: dh?.lager === '' || dh?.lager == null ? null : Number(dh.lager), lagerKrav: f.lagerKrav,
    areal, PperDaa: areal ? P / areal : null, grense, grenseAar: Math.max(aar, 2027), arealBehov: grense ? P / grense : null, planTonn, planP,
  };
}

// Fôrbalanse: behov for grovfôr (vinterfôr og beite) og kraftfôr mot avling fra eng, grønnfôr, beite og korn.
export function forbalanse(S, aar) {
  const plan = S?.skifteplan; const dh = plan?.dyrehold; const f = forut(dh);
  const rader = (dh?.dyr || []).filter((r) => Number(r.antall) > 0).map((r) => {
    const v = verdier(r); const n = Number(r.antall);
    return { id: r.id, navn: v.navn, ikon: v.ikon, antall: n, vinter: n * v.grovfor * (v.inne / 12), beite: n * v.grovfor * (1 - v.inne / 12), kraftfor: n * v.kraftfor };
  });
  const behov = { vinter: rader.reduce((s, r) => s + r.vinter, 0), beite: rader.reduce((s, r) => s + r.beite, 0), kraftfor: rader.reduce((s, r) => s + r.kraftfor, 0) };
  const prod = { vinter: 0, beite: 0, korn: 0, engAreal: 0, beiteAreal: 0, kornAreal: 0, engSnitt: null };
  let engFem = 0;
  for (const sk of plan?.skifter || []) {
    const v = sk.vekster?.[aar]; const k = KULTURER[v?.kultur]; if (!k || k.utenGjodsel) continue;
    const a = sk.areal || 0; const avling = Number(v.avling) || k.normavling;
    if (k.gruppe === 'eng' || k.gruppe === 'gronnfor') { prod.vinter += avling * a * (1 - f.tapKonservering / 100); prod.engAreal += a; engFem += avling * a; }
    else if (k.gruppe === 'beite') { prod.beite += avling * a * (f.beiteUtnyttelse / 100); prod.beiteAreal += a; }
    else if (k.gruppe === 'korn') { prod.korn += avling * a; prod.kornAreal += a; }
  }
  prod.engSnitt = prod.engAreal ? engFem / prod.engAreal : null;
  // Beiteplanen: beite i utmark dekker behovet i periodene, og høstbeite på eng gir det graset tåler.
  prod.utmark = 0; prod.hostbeite = 0;
  if ((dh?.beiting || []).length) for (const p of beiteplan(S, aar).perioder) {
    if (!p.skifte) prod.utmark += p.behov;
    else if (KULTURER[p.skifte.vekster?.[aar]?.kultur]?.gruppe === 'eng') prod.hostbeite += Math.min(p.behov, p.kapasitet || 0);
  }
  prod.beite += prod.utmark + prod.hostbeite;
  // Overskudd av vinterfôr kan dekke beitebehov (og omvendt delvis ved høstbeite på eng) – vises samlet.
  const balanse = { vinter: prod.vinter - behov.vinter, beite: prod.beite - behov.beite, grovfor: prod.vinter + prod.beite - behov.vinter - behov.beite, kraftfor: prod.korn - behov.kraftfor };
  const netto = engFem ? (prod.engSnitt * (1 - f.tapKonservering / 100)) : null;
  return {
    rader, behov, prod, balanse, forutsetninger: f,
    rundballerBehov: behov.vinter / f.femPerRundball, rundballerProd: prod.vinter / f.femPerRundball,
    // Hvor mye mer eng som trengs ved underskudd på grovfôr (med snittavlingen på engene, ellers 500 FEm/daa).
    ekstraEngDaa: balanse.grovfor < 0 ? -balanse.grovfor / (netto || 500 * (1 - f.tapKonservering / 100)) : 0,
  };
}

// Kontrollpunkter for Krav-fanen (samme format som kontroller() i skifteplan.js).
export function kontrollerHusdyr(S, aar) {
  const ut = []; const g = husdyrgjodsel(S, aar); if (!g.rader.length) return ut;
  const push = (nivaa, tittel, tekst) => ut.push({ nivaa, tema: 'husdyr', tittel, tekst, skifteId: null, kilde: 'gjodselforskrift' });
  const f1 = (x) => (Math.round(x * 10) / 10).toLocaleString('nb-NO');
  if (!g.areal) push('varsel', 'Husdyrgjødsel uten spredeareal', `Dyreholdet gir ca. ${Math.round(g.P)} kg fosfor i året, men ingen skifter har vekst i ${aar}. Legg inn vekster, eller avtal spredeareal hos andre.`);
  else if (g.grense && g.PperDaa > g.grense) push('avvik', `For lite spredeareal for husdyrgjødsla (${f1(g.PperDaa)} kg P/daa)`, `Husdyrgjødsla gir ca. ${Math.round(g.P)} kg P på ${f1(g.areal)} daa. Fosforgrensen fra ${g.grenseAar} er ${f1(g.grense)} kg P/daa i snitt – det trengs ca. ${f1(g.arealBehov)} daa, eller avtale om å levere gjødsel.`);
  else if (g.grense && g.PperDaa > g.grense * 0.85) push('varsel', `Nær fosforgrensen (${f1(g.PperDaa)} av ${f1(g.grense)} kg P/daa)`, 'Lite rom for mineralgjødsel med fosfor. Grensene strammes inn i 2030 og 2033.');
  if (g.lager != null && g.lagerBehov > g.lager) push('avvik', `For lite gjødsellager (${Math.round(g.lager)} av ca. ${Math.round(g.lagerBehov)} m³)`, `Lageret bør romme gjødsla for ${g.lagerKrav} måneder. Husk også nedbør og vaskevann i åpne lagre.`);
  else if (g.lager == null && g.tonnLager > 5) push('info', 'Legg inn størrelsen på gjødsellageret', `Behovet er anslått til ca. ${Math.round(g.lagerBehov)} m³ for ${g.lagerKrav} måneder.`);
  if (g.P > 75) push('info', 'Gjødseljournal kan være påkrevd', `Dyreholdet gir ca. ${Math.round(g.P)} kg P i året. Leverer du fra deg eller tar imot husdyrgjødsel med mer enn 75 kg fosfor, skal det føres journal (§ 27).`);
  if (g.areal && g.tonnLager > 1 && g.planTonn < g.tonnLager * 0.7) push('varsel', `Husdyrgjødsla er ikke lagt inn i gjødslingsplanen (${Math.round(g.planTonn)} av ca. ${Math.round(g.tonnLager)} tonn)`, 'Fordel husdyrgjødsla på skiftene under Gjødsling, så blir behovet for mineralgjødsel riktig.');
  return ut;
}

// Forslag til fordeling av husdyrgjødsla (det som havner i lageret) på skiftene med vekst i året, etter fosforbehovet.
// Skifter som allerede har husdyrgjødsel i året, og beite (får gjødsel fra dyrene), hoppes over.
// Gir [{ skifteId, gjodsling }] – gjodsling har samme form som i skifteplanen (uten id).
export function fordelHusdyrgjodsel(S, aar, { gjodselbehov }) {
  const g = husdyrgjodsel(S, aar); const plan = S?.skifteplan; if (!plan) return [];
  const perType = {}; for (const r of g.rader) perType[r.gjodsel] = (perType[r.gjodsel] || 0) + r.tonnLager;
  for (const sk of plan.skifter) for (const x of sk.gjodsling || []) if (x.type === 'husdyr' && Number(x.aar) === aar && perType[x.produkt]) perType[x.produkt] = Math.max(0, perType[x.produkt] - (Number(x.mengde) || 0) * (sk.areal || 0));
  const kandidater = aktiveSkifter(plan, aar).filter((sk) => KULTURER[sk.vekster[aar].kultur].gruppe !== 'beite' && !(sk.gjodsling || []).some((x) => x.type === 'husdyr' && Number(x.aar) === aar))
    .map((sk) => ({ sk, rest: (gjodselbehov(sk, aar)?.P || 0) * (sk.areal || 0) })).filter((x) => x.rest > 0 && x.sk.areal > 0);
  const ut = [];
  // Mest fosfor per tonn først (fjørfe), så fordeles resten.
  for (const [type, tonn] of Object.entries(perType).sort((a, b) => (HUSDYR[b[0]]?.P || 0) - (HUSDYR[a[0]]?.P || 0))) {
    const pT = HUSDYR[type]?.P; if (!pT || tonn < 0.5) continue;
    const kap = kandidater.reduce((s, x) => s + x.rest, 0); if (kap <= 0) break;
    // Tørr gjødsel (mye fosfor per tonn) samles på de minste skiftene, så mengden per daa blir mulig å spre.
    // Blautgjødsel fordeles forholdsvis på alle skiftene.
    const torr = pT >= 3; const steg = torr ? 20 : 2;
    let igjenP = tonn * pT; const andel = Math.min(1, igjenP / kap);
    const rekke = torr ? [...kandidater].sort((p1, p2) => p1.sk.areal - p2.sk.areal) : kandidater;
    for (const x of rekke) {
      if (x.rest <= 0 || igjenP <= 0) continue;
      const P = torr ? Math.min(x.rest, igjenP) : x.rest * andel;
      const tPerDaa = Math.round((P / pT / x.sk.areal) * steg) / steg; if (tPerDaa < 1 / steg) continue;
      const gr = KULTURER[x.sk.vekster[aar].kultur].gruppe; const eng = gr === 'eng' || gr === 'gronnfor';
      const brukt = tPerDaa * x.sk.areal * pT; x.rest -= brukt; igjenP -= brukt;
      ut.push({ skifteId: x.sk.id, gjodsling: { aar, type: 'husdyr', produkt: type, mengde: tPerDaa, spredemaate: eng ? 'nedfelt' : 'nedmoldet', dato: `${aar}-${eng ? '04-20' : '04-30'}`, status: 'planlagt', forslag: true, kommentar: 'Fra dyreholdet' } });
    }
  }
  return ut;
}

// KSL-kapitlene dyreholdet tilsier (husdyrkapitlene i KSL-standarden).
export function kslKapitlerFor(S) {
  return [...new Set((S?.skifteplan?.dyrehold?.dyr || []).filter((r) => Number(r.antall) > 0).flatMap((r) => DYRESLAG[r.slag]?.ksl || []))].sort((a, b) => a - b);
}

// ---------- Beiteplan ----------
// En beiteperiode: { id, skifteId (null = utmark/fellesbeite), navn, dyrId (rad i dyreholdet), antall, fra, til }.
// Kapasitet: innmarksbeite = avling × areal × utnyttelse over beitesesongen. Eng brukt som høstbeite regnes med
// ENG_SOM_BEITE av årsavlingen (gjenvekst etter siste slått). Utmark har ingen beregnet kapasitet.
export const ENG_SOM_BEITE = 0.25;
export const dm = (d) => (/^\d{4}-\d{2}-\d{2}/.test(d || '') ? `${Number(d.slice(8, 10))}.${Number(d.slice(5, 7))}.` : '');
export const nyBeiteperiode = ({ aar, nyId, dyrId = null, skifteId = null } = {}) => ({ id: nyId ? nyId('bp') : `bp${Math.random().toString(36).slice(2, 9)}`, skifteId, navn: '', dyrId, antall: null, fra: `${aar}-05-20`, til: `${aar}-09-15` });
const dagerMellom = (fra, til) => { const a = Date.parse(fra); const b = Date.parse(til); return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.round((b - a) / 864e5) + 1 : 0; };
export function beitekapasitet(sk, aar, f = FORUTSETNINGER) {
  const v = sk?.vekster?.[aar]; const k = KULTURER[v?.kultur]; if (!k) return 0;
  const avling = Number(v.avling) || k.normavling; const utn = (f.beiteUtnyttelse ?? 75) / 100;
  if (k.gruppe === 'beite') return avling * (sk.areal || 0) * utn;
  if (k.gruppe === 'eng') return avling * (sk.areal || 0) * ENG_SOM_BEITE * utn;
  return 0;
}
export function beiteplan(S, aar) {
  const plan = S?.skifteplan; const dh = plan?.dyrehold; const f = { ...forut(dh), beitedager: 120, ...(Number(dh?.forutsetninger?.beitedager) > 0 ? { beitedager: Number(dh.forutsetninger.beitedager) } : {}) };
  const dyr = new Map((dh?.dyr || []).map((r) => [r.id, r]));
  const perioder = (dh?.beiting || []).filter((p) => String(p.fra || '').startsWith(String(aar)) || String(p.til || '').startsWith(String(aar))).map((p) => {
    const r = dyr.get(p.dyrId); const v = r ? verdier(r) : null; const antall = p.antall === '' || p.antall == null ? Number(r?.antall) || 0 : Number(p.antall);
    const dager = dagerMellom(p.fra, p.til); const behov = v ? antall * (v.grovfor / 365) * dager : 0;
    const sk = p.skifteId ? plan.skifter.find((s) => s.id === p.skifteId) : null;
    const kap = sk ? beitekapasitet(sk, aar, f) * Math.min(1, dager / f.beitedager) : null;
    return { ...p, dyr: v, antall, dager, behov, skifte: sk, kapasitet: kap, trykk: kap ? behov / kap : null, dyrPerDaa: sk?.areal ? antall / sk.areal : null };
  });
  const perSkifte = new Map();
  for (const p of perioder) {
    if (!p.skifte) continue;
    const x = perSkifte.get(p.skifte.id) || { skifte: p.skifte, kapasitet: beitekapasitet(p.skifte, aar, f), behov: 0, dager: 0 };
    x.behov += p.behov; x.dager += p.dager; perSkifte.set(p.skifte.id, x);
  }
  const skifter = [...perSkifte.values()].map((x) => ({ ...x, trykk: x.kapasitet ? x.behov / x.kapasitet : null }));
  // Dekning: planlagte dyrebeitedager mot beiteperioden dyreholdet tilsier (måneder ute × 30,4 dager).
  const dekning = (dh?.dyr || []).filter((r) => Number(r.antall) > 0 && verdier(r).inne < 12).map((r) => {
    const v = verdier(r); const forventet = Number(r.antall) * (12 - v.inne) * 30.4;
    const planlagt = perioder.filter((p) => p.dyrId === r.id).reduce((s, p) => s + p.antall * p.dager, 0);
    return { id: r.id, navn: v.navn, ikon: v.ikon, forventet, planlagt, andel: forventet ? planlagt / forventet : null };
  });
  const ledigeBeiter = (plan?.skifter || []).filter((s) => beitekapasitet(s, aar, f) > 0 && !perSkifte.has(s.id));
  return { perioder, skifter, dekning, ledigeBeiter, forutsetninger: f };
}
export function kontrollerBeite(S, aar) {
  const b = beiteplan(S, aar); const ut = [];
  const push = (nivaa, tittel, tekst, skifteId = null) => ut.push({ nivaa, tema: 'husdyr', tittel, tekst, skifteId, kilde: null });
  for (const p of b.perioder) if (p.trykk > 1.15) push('varsel', `Skifte ${p.skifte.nr}: for høyt beitetrykk ${dm(p.fra)}–${dm(p.til)} (${Math.round(p.trykk * 100)} %)`, 'Dyrene trenger mer fôr enn beitet gir i perioden. Fare for nedbeiting, tråkkskader og dårlig tilvekst – kort ned perioden, flytt dyrene tidligere, gi tilleggsfôr eller del beitet.', p.skifte.id);
  for (const x of b.skifter) if (KULTURER[x.skifte.vekster?.[aar]?.kultur]?.gruppe === 'beite' && x.trykk != null && x.trykk < 0.4) push('info', `Skifte ${x.skifte.nr}: beitet utnyttes bare ca. ${Math.round(x.trykk * 100)} % av sesongen`, 'Graset blir trolig gammelt og lite smakelig. Vurder flere dyr, en ny beiterunde senere i sesongen, eller pussing.', x.skifte.id);
  for (const p of b.perioder) {
    if (!p.dager) push('varsel', `Beiteperiode ${p.skifte ? `på skifte ${p.skifte.nr}` : p.navn || 'i utmark'} mangler gyldige datoer`, 'Fra-datoen må være før til-datoen.');
    if (!p.dyr) push('varsel', `Beiteperiode ${p.skifte ? `på skifte ${p.skifte.nr}` : p.navn || 'i utmark'} mangler dyr`, 'Velg hvilke dyr som beiter.');
  }
  return ut;
}

// ---------- Plass i dyrerom ----------
// m2 = areal per dyr som står samtidig. kilde: 'forskrift' = minstekrav i forskriften, 'veiledende' = vanlig anbefaling
// (forskriften har ikke et tall per dyr). For dyr som telles som produsert per år: dyr samtidig = antall ÷ innsett,
// og arealet per dyr = levendevekt ved slakt ÷ maks dyretetthet (kg/m²).
export const FORSKRIFTER = {
  storfe: { navn: 'Forskrift om hold av storfe', url: 'https://lovdata.no/dokument/SF/forskrift/2004-04-22-665' },
  smafe: { navn: 'Forskrift om velferd for småfe', url: 'https://lovdata.no/dokument/SF/forskrift/2005-02-18-160' },
  hons: { navn: 'Forskrift om hold av høns og kalkun', url: 'https://lovdata.no/dokument/SF/forskrift/2001-12-12-1494' },
  svin: { navn: 'Forskrift om hold av svin', url: 'https://lovdata.no/dokument/SF/forskrift/2003-02-18-175' },
  hest: { navn: 'Forskrift om velferd for hest', url: 'https://lovdata.no/dokument/SF/forskrift/2005-07-01-505' },
};
export const PLASS = {
  melkeku: { m2: 7, kilde: 'veiledende', forskrift: 'storfe', tekst: 'Løsdrift: minst én liggebås per dyr (§ 22). Ca. 7 m² per ku med gangareal er vanlig.' },
  ammeku: { m2: 7, kilde: 'veiledende', forskrift: 'storfe', tekst: 'Ku med kalv i løsdrift. Kalvegjemme med tett gulv på minst 0,7 m² per kalv (§ 23).' },
  ungdyr: { m2: 2.0, kilde: 'forskrift', forskrift: 'storfe', tekst: 'Fellesbinge: minst 1,5 m² fritt areal per kalv under 150 kg, 1,8 m² for 150–220 kg og 2,0 m² over 220 kg (§ 23). Eldre ungdyr trenger mer.' },
  okse: { m2: 3.0, kilde: 'veiledende', forskrift: 'storfe', tekst: 'Minst 2,0 m² for kalv over 220 kg (§ 23). Ca. 3 m² per okse er vanlig.' },
  sau: { m2: 0.8, kilde: 'veiledende', forskrift: 'smafe', tekst: 'Alle dyrene skal kunne ligge samtidig (§ 11). Ca. 0,7–0,9 m² per søye, mer i lammingstida.' },
  geit: { m2: 0.8, kilde: 'veiledende', forskrift: 'smafe', tekst: 'Alle dyrene skal kunne ligge samtidig (§ 11). Ca. 0,8 m² per geit.' },
  hest: { m2: 9, kilde: 'veiledende', forskrift: 'hest', tekst: 'Boks på ca. 9 m² for en vanlig hest ((2 × mankehøyden)² er en vanlig tommelfingerregel).' },
  ponni: { m2: 6, kilde: 'veiledende', forskrift: 'hest', tekst: 'Boks på ca. 6 m² for ponni.' },
  alpakka: { m2: 1.5, kilde: 'veiledende', forskrift: null, tekst: 'Ingen egen forskrift. Ca. 1,5 m² per dyr innendørs.' },
  verpehone: { m2: 1 / 9, kilde: 'forskrift', forskrift: 'hons', tekst: 'Frittgående: høyst 9 høner per m² bruksareal (§ 25).' },
  slaktekylling: { innsett: 7, vekt: 1.9, tetthet: 36, kilde: 'forskrift', forskrift: 'hons', tekst: 'Høyst 36 kg levendevekt per m² med dyrevelferdsprogram, ellers 25 kg/m² (§ 35a). Regnet med 7 innsett i året og 1,9 kg ved slakt.' },
  kalkun: { innsett: 2.5, vekt: 10, tetthet: 44, kilde: 'forskrift', forskrift: 'hons', tekst: 'Høyst 44 kg/m² når snittvekten er over 7 kg (38 kg/m² under 7 kg) (§ 36). Regnet med 2,5 innsett i året og 10 kg ved slakt.' },
  purke: { m2: 2.25, kilde: 'forskrift', forskrift: 'svin', tekst: 'Purker i grupper på 6–40: minst 2,25 m² fritt areal per purke. Fødebinger minst 6 m² (§ 25).' },
  slaktegris: { innsett: 3.3, vekt: 110, m2: 0.8, kilde: 'forskrift', forskrift: 'svin', tekst: 'Minst 0,80 m² fritt areal per gris på 85–110 kg (§ 26). Regnet med 3,3 innsett i året.' },
};
// Areal per dyr (m²) og antall dyr samtidig for en rad i dyreholdet.
export function plassFor(rad) {
  const v = verdier(rad); const p = PLASS[rad.slag] || { m2: 1, kilde: 'veiledende' }; const n = Number(rad.antall) || 0;
  const m2 = tallEller(rad.m2, p.tetthet ? p.vekt / p.tetthet : p.m2);
  const samtidig = v.per === 'produsert' ? n / (tallEller(rad.innsett, p.innsett) || 1) : n;
  return { ...p, m2, samtidig, areal: samtidig * m2, egen: rad.m2 !== '' && rad.m2 != null };
}
// Rom: { id, navn, areal (m² bruksareal/fritt areal), type: 'losdrift'|'basfjos'|'annet', dyr: [rad-id] }.
export const nyttRom = (nyId, navn = '') => ({ id: nyId ? nyId('rom') : `rom${Math.random().toString(36).slice(2, 9)}`, navn, areal: null, type: 'losdrift', dyr: [] });
export function dyrerom(S) {
  const dh = S?.skifteplan?.dyrehold; const rader = (dh?.dyr || []).filter((r) => Number(r.antall) > 0);
  const behov = rader.map((r) => ({ id: r.id, slag: r.slag, navn: verdier(r).navn, ikon: verdier(r).ikon, ...plassFor(r) }));
  const rom = (dh?.rom || []).map((rm) => {
    const her = behov.filter((b) => (rm.dyr || []).includes(b.id)); const trengs = her.reduce((s, b) => s + b.areal, 0); const areal = Number(rm.areal) || 0;
    // Ledig plass: hvor mange flere av dyreslaget som tar mest plass (bare når rommet har ett dyreslag).
    const ledig = her.length === 1 && areal ? Math.floor((areal - trengs) / her[0].m2) : null;
    return { ...rm, her, trengs, arealTall: areal, andel: areal ? trengs / areal : null, ledig };
  });
  const iRom = new Set(rom.flatMap((r) => r.dyr || []));
  return { behov, rom, utenRom: behov.filter((b) => !iRom.has(b.id) && verdier((dh.dyr || []).find((r) => r.id === b.id)).inne > 0) };
}
export function kontrollerRom(S) {
  const d = dyrerom(S); const ut = [];
  const push = (nivaa, tittel, tekst) => ut.push({ nivaa, tema: 'husdyr', tittel, tekst, skifteId: null, kilde: null });
  for (const r of d.rom) {
    if (!r.arealTall || !r.her.length) continue;
    const forskrift = r.her.some((b) => b.kilde === 'forskrift');
    if (r.andel > 1) push(forskrift ? 'avvik' : 'varsel', `${r.navn || 'Dyrerom'}: for lite plass (${Math.round(r.trengs)} m² trengs, ${Math.round(r.arealTall)} m² finnes)`, `${forskrift ? 'Minstekravet i forskriften er ikke oppfylt for' : 'Under vanlig anbefaling for'} ${r.her.map((b) => b.navn.toLowerCase()).join(', ')}. Færre dyr, mer areal eller færre dyr per innsett.`);
    if (r.type === 'basfjos' && r.her.some((b) => DYRESLAG[b.slag]?.gruppe === 'Storfe')) push('varsel', `${r.navn || 'Dyrerom'}: båsfjøs for storfe`, 'Storfe skal holdes i løsdrift. Båsfjøs bygd før 22. april 2004 må være lagt om til løsdrift innen 1. januar 2034 (forskrift om hold av storfe § 32).');
  }
  return ut;
}

// ---------- Produksjonstilskudd ----------
// Endelige satser for søknadsåret 2025 (utbetalt 2026), Landbruksdirektoratet. Trinn: [til og med antall, kr per dyr].
export const PT_KILDE = { navn: 'Landbruksdirektoratet: produksjonstilskudd og avløsertilskudd – endelige satser 2025', url: 'https://www.landbruksdirektoratet.no/nb/jordbruk/ordninger-for-jordbruk/produksjonstilskudd-og-avlosertilskudd-i-jordbruket/produksjonstilskudd-og-avlosertilskudd--endelige-satser', aar: 2025 };
export const PT = {
  husdyr: {
    melkeku: [[14, 8933], [30, 7211], [50, 5684], [Infinity, 4857]],
    ammeku: [[50, 6166], [Infinity, 2166]],
    ovrigStorfe: [[Infinity, 1647]],
    melkegeit: [[125, 1719], [Infinity, 695]],
    sau: [[75, 2105], [150, 1565], [Infinity, 211]],
    avlsgris: { jaeren: [[35, 484]], nord: [[35, 994]], ovrig: [[35, 633]] },
    slaktegris: { jaeren: [[1400, 20]], nord: [[1400, 24]], ovrig: [[1400, 24]] },
    verpehone: { jaeren: [[1000, 14], [7500, 14]], nord: [[1000, 28], [7500, 14]], ovrig: [[1000, 14], [7500, 14]] },
  },
  smaaMelk: [[23, 3590], [50, -2949]], // 6–50 melkekyr
  driftMelk: { '1-4': 291100, 5: 344300, '6-7': 373000, perKuUnder5: { '1-4': 58220, 5: 68860, '6-7': 74600 } },
  driftGeit: { foretak: 346130, perGeit: 12820, grense: 27 },
  driftStorfe: { '1-4': { perDyr: 7132, foretak: 285280 }, '5-7': { perDyr: 9412, foretak: 376480 } },
  beite: { smaa: 131, stor: 1001 }, // sau, lam, geit, kje, alpakka / storfe, hest, lama
  utmark: { stor: 1763, smaa: 581 },
  kulturlandskap: 300,
  areal: { 1: { grovfor: 50, korn: 309 }, 2: { grovfor: 50, korn: 442 }, 3: { grovfor: 160, korn: 442 }, 4: { grovfor: 180, korn: 552 }, '5A': { grovfor: 390, korn: 572 }, '5B': { grovfor: 445, korn: 572 }, 6: { grovfor: 460, korn: 572 }, 7: { grovfor: 506, korn: 572 } },
  avlosning: { melkeku: 5336, ammeku: 1473, ovrigStorfe: 889, melkegeit: 1229, sau: 612, avlsgris: 1759, slaktegris: 60, verpehone: 15.45, hest: 1759, ponni: 1759, kalkun: 5.38, slaktekylling: 0.66, maks: 139100, min: 5000 },
};
export const SONER = ['1', '2', '3', '4', '5A', '5B', '6', '7'];
const KAT = { melkeku: 'melkeku', ammeku: 'ammeku', ungdyr: 'ovrigStorfe', okse: 'ovrigStorfe', sau: 'sau', geit: 'melkegeit', purke: 'avlsgris', slaktegris: 'slaktegris', verpehone: 'verpehone' };
const STOR = new Set(['melkeku', 'ammeku', 'ungdyr', 'okse', 'hest', 'ponni']); const SMAA = new Set(['sau', 'geit', 'alpakka']);
export function trinnvis(antall, trinn) {
  let rest = antall; let fra = 0; let sum = 0;
  for (const [til, sats] of trinn) { const n = Math.max(0, Math.min(rest, til - fra)); sum += n * sats; rest -= n; fra = til; if (rest <= 0) break; }
  return sum;
}
export function ptRegion(kommunenr) {
  const k = String(kommunenr || '').padStart(4, '0');
  if (['1103', '1108', '1119', '1120', '1121', '1122', '1124', '1127'].includes(k)) return 'jaeren';
  if (['18', '55', '56'].includes(k.slice(0, 2))) return 'nord';
  return 'ovrig';
}
// Anslag på produksjonstilskudd for dyreholdet og arealene i skifteplanen. Tar ikke med bunnfradrag, økologisk drift,
// bevaringsverdige raser, regionale miljøtilskudd eller maksimalt antall støtteberettigede dyr.
export function produksjonstilskudd(S, aar) {
  const plan = S?.skifteplan; const dh = plan?.dyrehold; const pt = dh?.tilskudd || {};
  const sone = SONER.includes(String(pt.sone)) ? String(pt.sone) : '3'; const region = pt.region || ptRegion(S?.eiendom?.kommunenr);
  const antall = {}; for (const r of dh?.dyr || []) if (Number(r.antall) > 0) antall[r.slag] = (antall[r.slag] || 0) + Number(r.antall);
  const poster = []; const post = (gruppe, navn, belop, grunnlag = '') => { if (belop) poster.push({ gruppe, navn, belop: Math.round(belop), grunnlag }); };
  const kat = {}; for (const [slag, n] of Object.entries(antall)) if (KAT[slag]) kat[KAT[slag]] = (kat[KAT[slag]] || 0) + n;
  for (const [k, n] of Object.entries(kat)) {
    const t = PT.husdyr[k]; const trinn = Array.isArray(t) ? t : t[region];
    const navn = { melkeku: 'Melkeku', ammeku: 'Ammeku', ovrigStorfe: 'Øvrig storfe', melkegeit: 'Melkegeit og melkesau', sau: 'Sau', avlsgris: 'Avlsgris', slaktegris: 'Slaktegris', verpehone: 'Verpehøne' }[k];
    post('Husdyrtilskudd', navn, trinnvis(n, trinn), `${Math.round(n)} dyr`);
  }
  const ku = antall.melkeku || 0;
  if (ku >= 6 && ku <= 50) post('Husdyrtilskudd', 'Tilskudd til små og mellomstore melkebruk', trinnvis(ku, PT.smaaMelk), `${ku} melkekyr`);
  const dsone = ['5A', '5B'].includes(sone) ? 5 : ['6', '7'].includes(sone) ? '6-7' : '1-4';
  if (ku) post('Driftstilskudd', 'Driftstilskudd til melkeproduksjon (kumelk)', ku >= 5 ? PT.driftMelk[dsone] : ku * PT.driftMelk.perKuUnder5[dsone], ku >= 5 ? 'per foretak' : `${ku} kyr`);
  const geit = antall.geit || 0;
  if (geit) post('Driftstilskudd', 'Driftstilskudd til melkeproduksjon (geitemelk)', geit >= PT.driftGeit.grense ? PT.driftGeit.foretak : geit * PT.driftGeit.perGeit, geit >= 27 ? 'per foretak' : `${geit} geiter`);
  const amme = antall.ammeku || 0; const ds = dsone === '1-4' ? PT.driftStorfe['1-4'] : PT.driftStorfe['5-7'];
  if (!ku && amme >= 6) post('Driftstilskudd', 'Driftstilskudd til spesialisert storfeproduksjon', amme >= 40 ? ds.foretak : amme * ds.perDyr, amme >= 40 ? 'per foretak' : `${amme} ammekyr`);
  // Beite: dyr som er ute minst 12 uker (16 uker for storfe i melkeproduksjon) – her: inne høyst 9 måneder.
  let smaaBeite = 0; let storBeite = 0;
  for (const r of dh?.dyr || []) { if (!(Number(r.antall) > 0) || verdier(r).inne > 9) continue; if (STOR.has(r.slag)) storBeite += Number(r.antall); else if (SMAA.has(r.slag)) smaaBeite += Number(r.antall); }
  post('Beite', 'Beitetilskudd, storfe og hest', storBeite * PT.beite.stor, `${storBeite} dyr`);
  post('Beite', 'Beitetilskudd, sau, geit og alpakka', smaaBeite * PT.beite.smaa, `${smaaBeite} dyr`);
  // Utmarksbeite: dyr i beiteplanen som er i utmark minst 5 uker.
  const utm = { stor: 0, smaa: 0 };
  for (const p of beiteplan(S, aar).perioder) if (!p.skifte && p.dager >= 35 && p.dyr) { const slag = (dh.dyr.find((r) => r.id === p.dyrId) || {}).slag; if (STOR.has(slag)) utm.stor += p.antall; else if (SMAA.has(slag) && slag !== 'alpakka') utm.smaa += p.antall; }
  post('Beite', 'Utmarksbeitetilskudd, storfe og hest', utm.stor * PT.utmark.stor, `${utm.stor} dyr`);
  post('Beite', 'Utmarksbeitetilskudd, sau, geit og lam', utm.smaa * PT.utmark.smaa, `${utm.smaa} dyr (fra beiteplanen)`);
  // Areal fra skifteplanen.
  let grovfor = 0; let korn = 0; let jordbruk = 0;
  for (const sk of plan?.skifter || []) { const k = KULTURER[sk.vekster?.[aar]?.kultur]; if (!k || k.utenGjodsel) continue; jordbruk += sk.areal || 0; if (['eng', 'beite', 'gronnfor'].includes(k.gruppe)) grovfor += sk.areal || 0; else if (k.gruppe === 'korn') korn += sk.areal || 0; }
  const as = PT.areal[sone];
  post('Areal', `Arealtilskudd grovfôr (sone ${sone})`, grovfor * as.grovfor, `${Math.round(grovfor * 10) / 10} daa`);
  post('Areal', `Arealtilskudd korn (sone ${sone})`, korn * as.korn, `${Math.round(korn * 10) / 10} daa`);
  post('Areal', 'Kulturlandskapstilskudd', jordbruk * PT.kulturlandskap, `${Math.round(jordbruk * 10) / 10} daa`);
  // Avløsning: grunnlaget dekker dokumenterte utgifter til avløsning, høyst 139 100 kr og minst 5 000 kr.
  let avl = 0; for (const [slag, n] of Object.entries(antall)) { const k = KAT[slag] || slag; const sats = PT.avlosning[k]; if (sats) avl += n * sats; }
  const avlosning = avl >= PT.avlosning.min ? Math.min(avl, PT.avlosning.maks) : 0;
  const sum = poster.reduce((s, p) => s + p.belop, 0);
  return { poster, sum, avlosning: Math.round(avlosning), avlosningGrunnlag: Math.round(avl), sone, region, satserAar: PT_KILDE.aar, areal: { grovfor, korn, jordbruk } };
}
