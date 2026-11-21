// 🌲 SkogIQ Skogkarakter: hvor godt og bærekraftig skogeiendommen drives – en karakter A–E (0–100 poeng) satt sammen
// av seks områder. Ingen DOM – testes i Node. Kildene for hva «godt drevet» er:
//   * Skogbruksloven § 6 og forskrift om berekraftig skogbruk: foryngelse innen tre år etter hogst, med minst 150 / 100
//     / 50 planter per daa etter bonitet (kommunen kontrollerer 3 år gamle hogstflater hvert år).
//   * Norsk PEFC Skogstandard (PEFC N 02:2022): kravpunktene som appen kontrollerer (js/pefc.js).
//   * Landbruksdirektoratets kartlegging av foryngelse og miljøhensyn ved hogst.
// Indikatorer uten data gir ikke minuspoeng: de står som «ukjent», og datadekningen vises. Karakteren er en
// egenvurdering for skogeieren; den deles bare når eieren selv velger det.
import { hogstklasseFor, startTilstand, STANDARD_INNSTILLINGER } from './model.js';
import { kontroller, kravStatus, klareringStatus, tomPefc, pefcAlder } from './pefc.js';
import { ungskogData, pleieDekning } from './ungskog.js';
import { plantetall } from './tiltaksmotor.js';
import { vurderBestand } from './artsfilter.js';

export const OMRADER = [
  { id: 'foryngelse', navn: 'Foryngelse og skogkultur', ikon: '🌱', vekt: 25 },
  { id: 'oppfolging', navn: 'Oppfølging av tiltak', ikon: '✅', vekt: 20 },
  { id: 'miljo', navn: 'Miljøverdier', ikon: '🦋', vekt: 25 },
  { id: 'produksjon', navn: 'Langsiktig produksjon', ikon: '📈', vekt: 15 },
  { id: 'dokumentasjon', navn: 'Dokumentasjon', ikon: '📋', vekt: 10 },
  { id: 'risiko', navn: 'Skog- og skaderisiko', ikon: '🛡️', vekt: 5 },
];
export const KARAKTERER = [
  { k: 'A', min: 85, navn: 'Fremragende', farge: '#1f6b4a' },
  { k: 'B', min: 70, navn: 'God', farge: '#4f8a2b' },
  { k: 'C', min: 55, navn: 'Tilfredsstillende', farge: '#9a7600' },
  { k: 'D', min: 40, navn: 'Svak', farge: '#c0661c' },
  { k: 'E', min: 0, navn: 'Mangelfull', farge: '#b4302f' },
];
export const karakterFor = (poeng) => KARAKTERER.find((x) => poeng >= x.min) || KARAKTERER.at(-1);
export const MIN_DEKNING = 50; // under dette er karakteren foreløpig
export const KILDER = [
  { navn: 'Forskrift om berekraftig skogbruk (foryngelse etter hogst)', url: 'https://lovdata.no/dokument/SF/forskrift/2006-06-07-593' },
  { navn: 'Norsk PEFC Skogstandard (PEFC N 02:2022)', url: 'https://www.pefc.no/' },
  { navn: 'Landbruksdirektoratet: Kartlegging av foryngelse og miljøhensyn ved hogst', url: 'https://www.landbruksdirektoratet.no/nb/filarkiv/rapporter/Kartlegging%20av%20foryngelse%20og%20milj%C3%B8hensyn%20ved%20hogst%202024%20Rapport%202025%2028.pdf' },
];

const HOGST = ['sluttavvirkning', 'tynning', 'lukkethogst'];
const FORYNG = ['planting', 'suppleringsplanting', 'saing', 'naturlig'];
const aarFor = (t) => Number(String(t.utfortDato || t.aar || '').slice(0, 4)) || null;
const utforte = (b, typer) => (b.tiltak || []).filter((t) => typer.includes(t.type) && t.status === 'utfort');
const sisteHogst = (b) => utforte(b, ['sluttavvirkning']).map(aarFor).filter(Boolean).sort().at(-1) || null;
const vektSnitt = (l) => { const m = l.filter((x) => x.poeng != null); const v = m.reduce((s, x) => s + x.vekt, 0); return v ? m.reduce((s, x) => s + x.poeng * x.vekt, 0) / v : null; };
const andel = (ok, alle) => (alle > 0 ? ok / alle : null);
const daa = (v) => `${(Math.round(v * 10) / 10).toLocaleString('nb-NO')} daa`;

// ---------- 1. Foryngelse og skogkultur ----------
function foryngelse(S, { inn, iAar }) {
  // a) Hogstflater eldre enn tre år skal være forynget (forskriften): planting/såing utført etter hogsten, eller registrert
  //    treantall / tetthetsklasse a.
  const flater = S.bestand.filter((b) => { const h = sisteHogst(b); return h ? h <= iAar - 3 : hogstklasseFor(b, inn) === 1 && (startTilstand(b).alder ?? 0) >= 3 && !(b.tiltak || []).some((t) => FORYNG.includes(t.type) && t.status === 'utfort'); });
  let okA = 0; let allA = 0; const fF = [];
  for (const b of flater) {
    const h = sisteHogst(b) || iAar - Math.round(startTilstand(b).alder || 3);
    const foryng = utforte(b, FORYNG).some((t) => (aarFor(t) || 0) >= h);
    const min = b.treslag === 'L' ? 100 : plantetall(b.treslag || 'G', startTilstand(b).h40 || 11).min;
    const reg = b.ungskog?.treantallFor != null ? b.ungskog.treantallFor >= min : b.tetthetsklasse === 'a';
    allA += b.areal || 0;
    if (foryng || reg) okA += b.areal || 0;
    else fF.push({ tekst: `Bestand ${b.nr}: hogd ${h} – foryng (plant/så) eller registrer foryngelsen (minst ${min} planter/daa)`, bestandId: b.id });
  }
  // b) Ungskogpleie: HK II med høyde 2–8 m og mye mer enn målet for treantall, uten utført pleie.
  const hk2 = S.bestand.filter((b) => hogstklasseFor(b, inn) === 2);
  let okB = 0; let allB = 0; const fB = [];
  for (const b of hk2) {
    const d = ungskogData(b, { inn }); const h = d.hoydeBar.verdi; const N = d.treantallFor.verdi; const a = b.areal || 0; allB += a;
    const behov = h != null && h >= 2 && h <= 8 && N != null && N > d.maal * 1.5 && !pleieDekning(b)?.helt;
    if (!behov) { okB += a; continue; }
    const planlagt = (b.tiltak || []).find((t) => t.type === 'ungskogpleie' && t.status !== 'utfort' && t.aar >= iAar);
    if (planlagt) okB += a * 0.5;
    fB.push({ tekst: `Bestand ${b.nr}: ungskogpleie (${Math.round(N)} trær/daa, ${String(h).replace('.', ',')} m – målet er ${d.maal})${planlagt ? ` er planlagt ${planlagt.aar}` : ' – legg inn og gjennomfør'}`, bestandId: b.id });
  }
  // c) Tetthet: andel ungskog med tilfredsstillende tetthet (klasse a) der klassen er registrert.
  const reg = S.bestand.filter((b) => [1, 2].includes(hogstklasseFor(b, inn)) && ['a', 'b'].includes(b.tetthetsklasse));
  const aReg = reg.reduce((s, b) => s + (b.areal || 0), 0); const okC = reg.filter((b) => b.tetthetsklasse === 'a').reduce((s, b) => s + (b.areal || 0), 0);
  return [
    { id: 'foryngelse3', navn: 'Foryngelse innen 3 år etter hogst', vekt: 3, poeng: andel(okA, allA), tekst: allA ? `${daa(okA)} av ${daa(allA)} hogstflater eldre enn 3 år er forynget` : 'Ingen hogstflater eldre enn 3 år', forbedringer: fF },
    { id: 'ungskogpleie', navn: 'Ungskogpleie i tide', vekt: 2, poeng: andel(okB, allB), tekst: allB ? `${fB.length ? `${fB.length} ungskogbestand trenger pleie` : 'Ingen ungskog med pleiebehov'}` : 'Ingen ungskog (HK II)', forbedringer: fB },
    { id: 'tetthet', navn: 'Tilfredsstillende tetthet i ungskog', vekt: 1, poeng: andel(okC, aReg), tekst: aReg ? `${daa(okC)} av ${daa(aReg)} registrert ungskog har tetthetsklasse a` : 'Tetthetsklasse ikke registrert', forbedringer: reg.filter((b) => b.tetthetsklasse === 'b').map((b) => ({ tekst: `Bestand ${b.nr}: tetthetsklasse b – vurder suppleringsplanting`, bestandId: b.id })) },
  ];
}

// ---------- 2. Oppfølging av tiltak ----------
function oppfolging(S, { iAar }) {
  const alle = S.bestand.flatMap((b) => (b.tiltak || []).map((t) => ({ t, b })));
  const forfalt = alle.filter(({ t }) => t.aar && t.aar < iAar);
  const v = (t) => ({ 1: 3, 2: 2, 3: 1 }[t.prioritet] || 2);
  const vAlle = forfalt.reduce((s, { t }) => s + v(t), 0); const vOk = forfalt.filter(({ t }) => t.status === 'utfort').reduce((s, { t }) => s + v(t), 0);
  const apne = forfalt.filter(({ t }) => t.status !== 'utfort').sort((a, b) => a.t.aar - b.t.aar);
  const gamle = apne.filter(({ t }) => t.aar <= iAar - 2);
  const takst = S.eiendom?.takstAar ? Number(S.eiendom.takstAar) : null; const alder = takst ? iAar - takst : null;
  return [
    { id: 'itide', navn: 'Tiltak gjennomført i tide', vekt: 3, poeng: andel(vOk, vAlle), tekst: forfalt.length ? `${forfalt.length - apne.length} av ${forfalt.length} tiltak med passert frist er utført (vektet etter prioritet)` : 'Ingen tiltak med passert frist', forbedringer: apne.slice(0, 12).map(({ t, b }) => ({ tekst: `Bestand ${b.nr}: ${t.type} fra ${t.aar} – gjennomfør eller flytt fristen`, bestandId: b.id, tiltakId: t.id })) },
    { id: 'etterslep', navn: 'Ingen langvarig etterslep', vekt: 2, poeng: forfalt.length ? 1 - gamle.length / forfalt.length : null, tekst: forfalt.length ? `${gamle.length} tiltak er mer enn 2 år forsinket` : 'Ingen tiltak med passert frist', forbedringer: [] },
    { id: 'planalder', navn: 'Oppdatert skogbruksplan', vekt: 1, poeng: alder == null ? null : alder <= 10 ? 1 : alder <= 15 ? 0.8 : alder <= 20 ? 0.5 : 0, tekst: alder == null ? 'Takstår ukjent' : `Takstår ${takst} (${alder} år) – PEFC: revideres hvert 15.–20. år`, forbedringer: alder > 15 ? [{ tekst: 'Revider skogbruksplanen (eller lag ny fra gnr/bnr i SkogIQ)' }] : [] },
  ];
}

// ---------- PEFC-krav som indikator ----------
const STATUS_POENG = { ok: 1, varsel: 0.6, avvik: 0 };
function pefcIndikator(id, navn, vekt, krav, status, funn) {
  const v = krav.map((k) => STATUS_POENG[status[k]?.status]).filter((x) => x != null);
  const f = funn.filter((x) => krav.includes(x.krav) && ['avvik', 'varsel'].includes(x.nivaa)).sort((a, b) => (a.nivaa === 'avvik' ? -1 : 1) - (b.nivaa === 'avvik' ? -1 : 1));
  return { id, navn, vekt, poeng: v.length ? v.reduce((s, x) => s + x, 0) / v.length : null, tekst: v.length ? `${v.filter((x) => x === 1).length} av ${v.length} kontrollerte kravpunkter i orden${f.length ? ` – ${f.filter((x) => x.nivaa === 'avvik').length} avvik, ${f.filter((x) => x.nivaa === 'varsel').length} varsler` : ''}` : 'Ikke kontrollert', forbedringer: f.slice(0, 10).map((x) => ({ tekst: `${x.nivaa === 'avvik' ? '⚠ ' : ''}PEFC krav ${x.krav}: ${x.tittel}`, bestandId: x.bestandId || null })) };
}

// ---------- 3. Miljøverdier ----------
function miljo(S, { inn, iAar, status, funn }) {
  const MILJOKRAV = [13, 16, 19, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30];
  // Hogst utført i miljøfigur/nøkkelbiotop (bestandet merket som miljøfigur)
  const mf = S.bestand.filter((b) => b.miljo);
  const hogdI = mf.filter((b) => utforte(b, HOGST).length);
  const plan = mf.filter((b) => (b.tiltak || []).some((t) => HOGST.includes(t.type) && t.status !== 'utfort'));
  // Rødlistede arter: planlagte tiltak med S1-konflikt
  let arter = null; const fA = [];
  if (S.artsfunn?.funn) {
    const med = S.bestand.filter((b) => (b.tiltak || []).some((t) => t.status !== 'utfort'));
    let konflikt = 0;
    for (const b of med) { const v = vurderBestand(S.artsfunn, b, { inn, iAar }); if (v.antall.S1) { konflikt++; fA.push({ tekst: `Bestand ${b.nr}: planlagt tiltak berører rødlistet art (S1) – vurder før tiltaket`, bestandId: b.id }); } }
    arter = med.length ? 1 - konflikt / med.length : 1;
  }
  return [
    pefcIndikator('pefcmiljo', 'PEFC-krav til miljø (nøkkelbiotoper, kantsoner, myr, fugl, kulturminner, livsløpstrær …)', 4, MILJOKRAV, status, funn),
    { id: 'miljofigurer', navn: 'Miljøfigurer og nøkkelbiotoper får stå', vekt: 3, poeng: mf.length ? (hogdI.length ? 0 : plan.length ? 0.5 : 1) : null, tekst: mf.length ? `${mf.length} miljøfigurer${hogdI.length ? ` – hogst registrert i ${hogdI.length}` : plan.length ? ` – hogst planlagt i ${plan.length}` : ' – urørt'}` : 'Ingen miljøfigurer i planen', forbedringer: [...hogdI, ...plan].map((b) => ({ tekst: `Bestand ${b.nr}: miljøfigur med ${hogdI.includes(b) ? 'utført' : 'planlagt'} hogst – la den stå`, bestandId: b.id })) },
    { id: 'arter', navn: 'Hensyn til rødlistede arter', vekt: 2, poeng: arter, tekst: arter == null ? 'Artsfunn ikke hentet (Artskart)' : fA.length ? `${fA.length} bestand med planlagt tiltak i konflikt (S1)` : 'Ingen S1-konflikter i planlagte tiltak', forbedringer: arter == null ? [{ tekst: 'Hent rødlistede artsfunn fra Artskart (Kartlag › Rødlistede artsfunn)' }] : fA },
  ];
}

// ---------- 4. Langsiktig produksjon ----------
function produksjon(S, { inn, iAar, status, funn }) {
  const areal = S.bestand.reduce((s, b) => s + (b.areal || 0), 0);
  // Hogst siste 10 år mot bærekraftig flateuttak (produktivt areal / omløpstid × 10 år)
  const hogd = S.bestand.filter((b) => { const h = sisteHogst(b); return h && h > iAar - 10; }).reduce((s, b) => s + (b.areal || 0), 0);
  const omlop = areal ? S.bestand.reduce((s, b) => s + (b.areal || 0) * (pefcAlder(startTilstand(b).h40 || 11)?.omlop || 90), 0) / areal : 90;
  const baerekraftig = areal * (10 / omlop);
  const r = hogd && baerekraftig ? hogd / baerekraftig : null;
  const pR = r == null ? null : r <= 1.3 ? 1 : r >= 2 ? 0.2 : 1 - ((r - 1.3) / 0.7) * 0.8;
  // Overmoden skog: HK V eldre enn omløpstid + 30 år (skogen hogges ikke – men har også miljøverdi, så mild vekt)
  const overmoden = S.bestand.filter((b) => !b.miljo && hogstklasseFor(b, inn) === 5 && (startTilstand(b).alder || 0) > (pefcAlder(startTilstand(b).h40 || 11)?.omlop || 90) + 30).reduce((s, b) => s + (b.areal || 0), 0);
  const aO = areal ? overmoden / areal : null;
  return [
    { id: 'avvirkning', navn: 'Hogst i takt med tilveksten', vekt: 2, poeng: pR, tekst: r == null ? 'Ingen registrert sluttavvirkning siste 10 år' : `${daa(hogd)} hogd siste 10 år – ${Math.round(r * 100)} % av bærekraftig flateuttak (${daa(baerekraftig)})`, forbedringer: r > 1.3 ? [{ tekst: 'Hogsten de siste 10 årene er høyere enn tilveksten tilsier – vurder lavere uttak framover' }] : [] },
    pefcIndikator('nedrealder', 'Hogst etter nedre aldersgrense (PEFC krav 15)', 2, [15], status, funn),
    { id: 'overmoden', navn: 'Hogstmoden skog tas ut i tide', vekt: 1, poeng: aO == null ? null : aO <= 0.15 ? 1 : aO >= 0.45 ? 0.4 : 1 - ((aO - 0.15) / 0.3) * 0.6, tekst: aO == null ? '' : `${Math.round(aO * 100)} % av skogen er langt over vanlig omløpstid`, forbedringer: [] },
  ];
}

// ---------- 5. Dokumentasjon ----------
function dokumentasjon(S, { inn, iAar, status, funn, P }) {
  // Klarering (PEFC-sjekklisten) for hogst planlagt i år og neste år
  const naer = S.bestand.flatMap((b) => (b.tiltak || []).filter((t) => HOGST.includes(t.type) && t.status !== 'utfort' && t.aar >= iAar && t.aar <= iAar + 1).map((t) => ({ t, b })));
  const klar = naer.filter(({ t, b }) => klareringStatus(t, b, funn, P).klar);
  // Ajourført etter hogst: bestand med utført sluttavvirkning skal ikke lenger stå som eldre skog
  const hogd = S.bestand.filter((b) => sisteHogst(b));
  const ajour = hogd.filter((b) => hogstklasseFor(b, inn) <= 2);
  return [
    pefcIndikator('plandata', 'Skogbruksplan med miljøregistreringer (PEFC krav 3)', 2, [3], status, funn),
    { id: 'klarering', navn: 'PEFC-sjekkliste før hogst', vekt: 2, poeng: naer.length ? klar.length / naer.length : null, tekst: naer.length ? `${klar.length} av ${naer.length} hogster i år og neste år er klarert` : 'Ingen hogst planlagt i år eller neste år', forbedringer: naer.filter((x) => !klar.includes(x)).map(({ t, b }) => ({ tekst: `Bestand ${b.nr}: fyll ut PEFC-sjekklisten før ${t.type} ${t.aar}`, bestandId: b.id, tiltakId: t.id })) },
    { id: 'ajour', navn: 'Planen ajourført etter hogst', vekt: 1, poeng: hogd.length ? ajour.length / hogd.length : null, tekst: hogd.length ? `${ajour.length} av ${hogd.length} hogde bestand er oppdatert (ny hogstklasse/alder)` : 'Ingen registrert sluttavvirkning', forbedringer: hogd.filter((b) => !ajour.includes(b)).map((b) => ({ tekst: `Bestand ${b.nr}: oppdater alder/hogstklasse etter hogsten (eller bruk hogstmaskindata)`, bestandId: b.id })) },
  ];
}

// ---------- 6. Skog- og skaderisiko ----------
function risiko(S, { iAar }) {
  const sk = (S.skogbrand?.skader || []).filter((x) => x.dato && Number(String(x.dato).slice(0, 4)) <= iAar - 1);
  const ok = sk.filter((x) => x.status === 'avsluttet');
  return [
    { id: 'skader', navn: 'Skader fulgt opp', vekt: 1, poeng: sk.length ? ok.length / sk.length : null, tekst: sk.length ? `${ok.length} av ${sk.length} registrerte skader (eldre enn ett år) er avsluttet` : 'Ingen eldre skader registrert', forbedringer: sk.filter((x) => x.status !== 'avsluttet').map((x) => ({ tekst: `Skade fra ${x.dato}: følg opp (opprydding, foryngelse, forsikring)` })) },
  ];
}

// ---------- samlet ----------
export function beregnSkogkarakter(S, { iAar = new Date().getFullYear() } = {}) {
  const inn = S.innstillinger || STANDARD_INNSTILLINGER; const P = S.pefc || tomPefc();
  const Sx = S.innstillinger ? S : { ...S, innstillinger: inn };
  const funn = (Sx.bestand || []).length ? kontroller(Sx, P, { iAar }) : []; const status = kravStatus(funn, P);
  const ctx = { inn, iAar, status, funn, P };
  const fn = { foryngelse, oppfolging, miljo, produksjon, dokumentasjon, risiko };
  const totalVekt = OMRADER.reduce((s, o) => s + o.vekt, 0);
  const omrader = OMRADER.map((o) => {
    const ind = fn[o.id](Sx, ctx); const p = vektSnitt(ind); const iv = ind.reduce((s, x) => s + x.vekt, 0);
    // Poeng å hente per forbedring: indikatorens manglende poeng fordelt på forbedringene.
    for (const x of ind) { const mangler = x.poeng == null ? 0 : (1 - x.poeng) * (x.vekt / iv) * (o.vekt / totalVekt) * 100; for (const f of x.forbedringer) { if (x.poeng == null) { f.poeng = 0; f.data = true; } else f.poeng = Math.max(mangler > 0 ? 1 : 0, Math.round(mangler / x.forbedringer.length)); } }
    return { ...o, poeng: p == null ? null : Math.round(p * 100), indikatorer: ind, dekning: ind.filter((x) => x.poeng != null).reduce((s, x) => s + x.vekt, 0) / iv };
  });
  const med = omrader.filter((o) => o.poeng != null); const mv = med.reduce((s, o) => s + o.vekt, 0);
  const total = mv ? Math.round(med.reduce((s, o) => s + o.poeng * o.vekt, 0) / mv) : null;
  const dekning = Math.round(omrader.reduce((s, o) => s + o.vekt * o.dekning, 0) / totalVekt * 100);
  const alleF = omrader.flatMap((o) => o.indikatorer.flatMap((x) => x.forbedringer.map((f) => ({ ...f, omrade: o.id, ikon: o.ikon }))));
  const forbedringer = alleF.filter((f) => f.poeng > 0).sort((a, b) => b.poeng - a.poeng);
  // Mer data gir sikrere karakter (ikke flere poeng): indikatorer uten data som har et konkret neste steg.
  const datatiltak = alleF.filter((f) => f.data);
  const kar = total == null ? null : karakterFor(total);
  return { total, karakter: kar?.k || null, navn: kar?.navn || 'Ikke vurdert', farge: kar?.farge || '#888', dekning, forelopig: dekning < MIN_DEKNING, omrader, forbedringer, datatiltak, dato: new Date().toISOString().slice(0, 10), aar: iAar };
}

// Årlig øyeblikksbilde (S.skogkarakter.historikk): ett per år, siste beregning gjelder.
export function lagreOyeblikk(S, r) {
  S.skogkarakter = S.skogkarakter || { historikk: [] };
  const h = S.skogkarakter.historikk.filter((x) => x.aar !== r.aar);
  h.push({ aar: r.aar, dato: r.dato, total: r.total, karakter: r.karakter, dekning: r.dekning, omrader: Object.fromEntries(r.omrader.map((o) => [o.id, o.poeng])) });
  S.skogkarakter.historikk = h.sort((a, b) => a.aar - b.aar).slice(-30);
  return S.skogkarakter.historikk;
}

// Stempelet som SVG: klassisk segl med farget bånd og hvit tekst rundt («SKOGIQ SKOGKARAKTER» øverst, vurderingen
// nederst), gran-symboler som skille, og et hvitt midtfelt med stor bokstav, poengbånd og år. Brukes i appen, i
// karakterbeviset og i nedlastet stempel. Fargen følger karakteren.
export function stempelSvg(r, { str = 160, id = 'sk' } = {}) {
  const k = r.karakter || '–'; const f = r.farge || '#888'; const aar = r.aar || new Date().getFullYear();
  const s = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const navn = `${s(r.navn || 'Ikke vurdert').toUpperCase()} · ${aar}`; const lang = navn.length > 18;
  const SANS = "font-family=\"'Schibsted Grotesk',system-ui,-apple-system,'Segoe UI',sans-serif\"";
  // Gran (symbol) sentrert i (x, y) med høyde h
  const gran = (x, y, h, farge) => { const w = h * 0.78; return `<g transform="translate(${x} ${y - h / 2}) scale(${h / 30})" fill="${farge}"><path d="M0,0 L7.5,9 L4.2,9 L10.5,17 L6.2,17 L13.5,26 L-13.5,26 L-6.2,17 L-10.5,17 L-4.2,9 L-7.5,9 Z"/><rect x="-1.8" y="26" width="3.6" height="4" rx=".6"/></g>`.replace(/scale\([^)]*\)/, `scale(${(w / 27).toFixed(3)} ${(h / 30).toFixed(3)})`); };
  return `<svg class="sk-stempel" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${str}" height="${str}" role="img" aria-label="SkogIQ Skogkarakter ${s(k)}${r.total != null ? `, ${r.total} av 100 poeng` : ''}">
  <defs>
    <path id="${id}-topp" d="M 17,100 A 83,83 0 0 1 183,100"/>
    <path id="${id}-bunn" d="M 9,100 A 91,91 0 0 0 191,100"/>
  </defs>
  <circle cx="100" cy="100" r="98" fill="${f}"/>
  <circle cx="100" cy="100" r="95" fill="none" stroke="#fff" stroke-width="1" opacity=".55"/>
  <circle cx="100" cy="100" r="74" fill="#fff"/>
  <circle cx="100" cy="100" r="70" fill="none" stroke="${f}" stroke-width="1.2"/>
  <text ${SANS} font-size="14" font-weight="800" letter-spacing="2.6" fill="#fff"><textPath href="#${id}-topp" startOffset="50%" text-anchor="middle">SKOGIQ SKOGKARAKTER</textPath></text>
  <text ${SANS} font-size="${lang ? 10.5 : 12.5}" font-weight="800" letter-spacing="${lang ? 1.2 : 2.2}" fill="#fff"><textPath href="#${id}-bunn" startOffset="50%" text-anchor="middle">${navn}</textPath></text>
  ${gran(13.5, 100, 11, '#fff')}${gran(186.5, 100, 11, '#fff')}
  ${gran(100, 52, 17, f)}
  <text x="100" y="124" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="64" font-weight="700" fill="${f}">${s(k)}</text>
  ${r.total != null ? `<rect x="66" y="131" width="68" height="17" rx="8.5" fill="${f}"/><text x="100" y="143.5" text-anchor="middle" ${SANS} font-size="11.5" font-weight="800" fill="#fff">${r.total} / 100</text>` : ''}
  ${r.forelopig ? `<text x="100" y="${r.total != null ? 160 : 150}" text-anchor="middle" ${SANS} font-size="8.5" font-weight="800" letter-spacing="1.6" fill="${f}">FORELØPIG</text>` : ''}
</svg>`;
}
