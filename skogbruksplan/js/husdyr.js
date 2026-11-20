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
