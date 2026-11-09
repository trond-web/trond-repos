// Del skogdata med tømmerkjøpere: skogeieren velger bestand og hva som skal deles, og hver kjøper får en personlig
// lenke (tommer.html?f=id&k=kode) uten innlogging. Kjøperen ser eiendommen, kart, bestand, volumer, driftsforhold og
// miljøhensyn, kan laste ned data (CSV og GeoJSON) og gi prisforslag per sortiment. Skogeieren ser når lenken er åpnet,
// sammenligner forslagene etter anslått netto til skogeier, velger kjøper og kan stoppe delingen når som helst.
// Serveren er et mellomlager (tilbud-relay.js under /api/tommer); planen har sin egen kopi. Ingen DOM – kan testes i Node.
import { framskriv, hogstAndel, HOGSTTYPER, TRESLAG, HK_ROMERTALL, STANDARD_INNSTILLINGER, laavesteHogstalder, startTilstand } from './model.js';
import { vurdering as brattVurdering } from './bratthet.js';
import { vurdering as fuktVurdering } from './markfukt.js';
import { SORTIMENT, rensSvar, sjekkSvar, vurderSvar, csv, geojson } from './tommer-felles.js';

export { SORTIMENT, rensSvar, sjekkSvar, vurderSvar, csv, geojson };

// Sagtømmerandelen er et grovt anslag for vanlig skog i Sør-Norge (sluttavvirkning); i tynning er andelen lavere.
// Kjøperen ser at det er et anslag.
export const SAGANDEL = { sluttavvirkning: { G: 0.6, F: 0.5, L: 0 }, lukkethogst: { G: 0.5, F: 0.45, L: 0 }, tynning: { G: 0.2, F: 0.25, L: 0 } };
export const SALGSFORM = {
  leveranse: { navn: 'Leveransevirke', tekst: 'Kjøperen organiserer hogst og utkjøring. Pris per m³ for hvert sortiment, og driftskostnaden som trekkes.' },
  rot: { navn: 'Rotsalg', tekst: 'Kjøperen hogger og kjøper tømmeret på rot. Oppgi netto pris per m³ til skogeier (driftskostnad allerede trukket).' },
  samlet: { navn: 'Samlet tilbud', tekst: 'Fast sum til skogeier for hele hogsten.' },
};
export const UTVALG = {
  planlagt: 'Bestand med planlagt hogst',
  hogstmoden: 'Hogstmoden skog (hogstklasse V)',
  alle: 'Alle bestand med volum',
};
// Det som kan tas med. Skogeierens egne verdianslag og priser deles aldri.
export const INNHOLD = {
  kart: 'Kart med bestandsgrenser',
  drift: 'Driftsforhold (bratthet og markfuktighet)',
  hensyn: 'Miljøhensyn (miljøfigurer og merknader)',
  eiendom: 'Gårds- og bruksnummer',
};
export const STATUS = { utkast: { navn: 'Utkast', farge: '#8a8a85' }, sendt: { navn: 'Delt – venter på forslag', farge: '#2a78d6' }, tildelt: { navn: 'Kjøper valgt', farge: '#0ca30c' }, avsluttet: { navn: 'Delingen er stoppet', farge: '#d03b3b' } };
// Vanlige kjøpere (forslag i skjemaet – kontaktinformasjon legger skogeieren inn selv).
export const KJOPERE = ['Glommen Mjøsen Skog', 'Viken Skog', 'AT Skog', 'Allskog', 'Vestskog', 'Nortømmer', 'Moelven', 'Norske Skog', 'Statskog'];

const iDag = () => new Date().toISOString().slice(0, 10);
const plussDager = (d, n) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const r0 = (v) => Math.round(v || 0); const r1 = (v) => Math.round((v || 0) * 10) / 10;
const avrund = (g) => JSON.parse(JSON.stringify(g, (k, v) => (typeof v === 'number' ? Math.round(v * 1e5) / 1e5 : v)));

// Neste planlagte hogst i bestandet.
export function nesteHogst(b) {
  return (b.tiltak || []).filter((t) => HOGSTTYPER.includes(t.type) && t.status !== 'utfort').sort((a, c) => (a.aar || 0) - (c.aar || 0))[0] || null;
}
// Stående volum nå og volum ved planlagt hogst (m³) – samme framskriving som resten av planen.
export function volumer(b, { inn = STANDARD_INNSTILLINGER, iAar = new Date().getFullYear() } = {}) {
  const t = nesteHogst(b); const aarFrem = t ? Math.max(0, (t.aar || iAar) - iAar) : 0;
  const rader = framskriv([b], aarFrem, inn, { folgPlan: false, startAar: iAar }).perBestand.get(b.id) || [];
  const areal = b.areal || 0; const naa = (rader[0]?.volumDaa || 0) * areal;
  const uttak = t ? (rader[aarFrem]?.volumDaa || 0) * (t.arealDaa ?? areal) * hogstAndel(t.type, inn, t) : null;
  return { staaende: naa, hogst: t ? { type: t.type, aar: t.aar || iAar, m3: uttak, areal: t.arealDaa ?? areal } : null, alder: rader[0]?.alder ?? null };
}
// Forslag til bestand: planlagt hogst innen 5 år, hogstklasse V, eller alle med volum.
export function foreslaaBestand(S, utvalg = 'planlagt', { inn = STANDARD_INNSTILLINGER, iAar = new Date().getFullYear(), aar = 5 } = {}) {
  return (S.bestand || []).filter((b) => {
    if (utvalg === 'planlagt') { const t = nesteHogst(b); return t && (t.aar || iAar) <= iAar + aar; }
    if (utvalg === 'hogstmoden') { if (b.miljo) return false; const min = laavesteHogstalder(b, inn); const st = startTilstand(b); return (b.hogstklasse === 5) || (min && st.alder >= min); }
    return (b.volumDaa || 0) > 0 || startTilstand(b).volumDaa > 0;
  }).map((b) => b.id);
}

export function nyDeling(S, { idag = iDag(), kontakt = {}, utvalg = null, inn, iAar } = {}) {
  // Uten valgt utvalg: planlagt hogst, ellers hogstmoden skog, ellers alt med volum.
  if (!utvalg) utvalg = ['planlagt', 'hogstmoden', 'alle'].find((u) => foreslaaBestand(S, u, { inn, iAar }).length) || 'planlagt';
  return {
    id: `td${Math.random().toString(36).slice(2, 9)}`, status: 'utkast', laget: idag,
    tittel: `Tømmer fra ${S.eiendom?.navn || 'skogeiendommen'}`,
    bestand: foreslaaBestand(S, utvalg, { inn, iAar }), utvalg,
    ta: { kart: true, drift: true, hensyn: true, eiendom: true },
    salgsform: 'leveranse', periode: { fra: '', til: '' },
    svarfrist: plussDager(idag, 21), utloper: plussDager(idag, 90),
    kommentar: '', kontakt: { navn: kontakt.navn || '', telefon: kontakt.telefon || '', epost: kontakt.epost || '' },
    mottakere: [], svar: [], valgt: null,
  };
}

// Volum per sortiment (m³) fra volumet per treslag og hogstform.
export function fordelSortiment(rader) {
  const ut = Object.fromEntries(SORTIMENT.map((s) => [s.id, 0]));
  for (const r of rader) {
    const andel = (SAGANDEL[r.hogst] || SAGANDEL.sluttavvirkning)[r.treslag] ?? 0;
    const m3 = r.m3 || 0; const ts = r.treslag === 'F' ? 'f' : r.treslag === 'L' ? 'l' : 'g';
    if (ts === 'l') ut.lm += m3; else { ut[`${ts}s`] += m3 * andel; ut[`${ts}m`] += m3 * (1 - andel); }
  }
  return Object.fromEntries(Object.entries(ut).map(([k, v]) => [k, r0(v)]));
}

// Det kjøperne ser: uten eierens nøkler, priser, verdianslag eller andre kjøperes navn.
export function delingPakke(S, d, { inn = STANDARD_INNSTILLINGER, iAar = new Date().getFullYear(), tiltakNavn = (t) => t } = {}) {
  const valgte = new Set(d.bestand); const ta = d.ta || {};
  const liste = (S.bestand || []).filter((b) => valgte.has(b.id));
  const bestand = liste.map((b) => {
    const v = volumer(b, { inn, iAar }); const st = startTilstand(b);
    const bratt = ta.drift && b.bratthet ? brattVurdering(b.bratthet) : null; const fukt = ta.drift && b.markfukt ? fuktVurdering(b.markfukt) : null;
    return {
      nr: b.nr, teig: b.teig || '', areal: r1(b.areal), treslag: b.treslag || '', treslagNavn: TRESLAG[b.treslag] || '', bonitet: b.bonitet ?? null,
      hogstklasse: b.hogstklasse ? HK_ROMERTALL[b.hogstklasse] : '', alder: v.alder != null ? r0(v.alder) : (st.alder != null ? r0(st.alder) : null),
      m3Daa: b.areal ? r1(v.staaende / b.areal) : null, m3: r0(v.staaende),
      hogst: v.hogst ? { type: v.hogst.type, navn: tiltakNavn(v.hogst.type), aar: v.hogst.aar, m3: r0(v.hogst.m3), areal: r1(v.hogst.areal) } : null,
      ...(ta.drift ? { drift: { bratt: bratt ? { niva: bratt.niva, tekst: bratt.tekst } : null, fukt: fukt ? { niva: fukt.niva, tekst: fukt.tekst } : null } } : {}),
      ...(ta.hensyn ? { miljo: !!b.miljo, merknad: b.merknad || '' } : {}),
      _geo: b.geometri,
    };
  });
  // Volumet som selges: planlagt uttak når det finnes, ellers stående volum – men aldri i miljøfigurer uten planlagt hogst.
  const miljo = new Set(liste.filter((b) => b.miljo).map((b) => b.nr));
  const salg = bestand.map((b) => ({ treslag: b.treslag || 'G', hogst: b.hogst?.type || 'sluttavvirkning', m3: b.hogst ? b.hogst.m3 : miljo.has(b.nr) ? 0 : b.m3 }));
  const perTreslag = { G: 0, F: 0, L: 0 }; for (const r of salg) perTreslag[r.treslag in perTreslag ? r.treslag : 'G'] += r.m3;
  const hogstAar = bestand.map((b) => b.hogst?.aar).filter(Boolean);
  const e = S.eiendom || {};
  return {
    v: 1, tittel: d.tittel, sted: [e.navn, e.kommune].filter(Boolean).join(', '), ...(ta.eiendom && e.gnrbnr ? { gnrbnr: e.gnrbnr } : {}),
    salgsform: d.salgsform, salgsformNavn: SALGSFORM[d.salgsform]?.navn || '', salgsformTekst: SALGSFORM[d.salgsform]?.tekst || '',
    periode: d.periode || {}, svarfrist: d.svarfrist, utloper: d.utloper, kommentar: d.kommentar || '', kontakt: d.kontakt || {},
    bestand: bestand.map(({ _geo, ...b }) => b),
    sum: { bestand: bestand.length, areal: r1(bestand.reduce((s, b) => s + (b.areal || 0), 0)), staaende: r0(bestand.reduce((s, b) => s + b.m3, 0)), salg: r0(salg.reduce((s, r) => s + r.m3, 0)), perTreslag: Object.fromEntries(Object.entries(perTreslag).map(([k, v]) => [k, r0(v)])), sortiment: fordelSortiment(salg), fraAar: hogstAar.length ? Math.min(...hogstAar) : null, tilAar: hogstAar.length ? Math.max(...hogstAar) : null },
    sortiment: SORTIMENT.map(({ id, navn, treslag }) => ({ id, navn, treslag })),
    kart: ta.kart ? bestand.filter((b) => b._geo).map((b) => ({ nr: b.nr, geometri: avrund(b._geo) })) : [],
    merknad: 'Volumene er anslag fra skogbruksplanen, framskrevet til i dag og til planlagt hogstår. Fordelingen på sortiment er et grovt anslag. Endelig volum og kvalitet måles ved innmåling.',
  };
}

export function sammenlign(d, pakke, { idag = iDag() } = {}) {
  const rader = (d.svar || []).map((s) => {
    const m = d.mottakere.find((x) => x.id === s.mottakerId) || {};
    const v = vurderSvar(pakke, s);
    return { ...s, ...v, navn: s.firma || m.firma || m.navn || 'Ukjent', gyldig: s.gyldigTil ? s.gyldigTil >= idag : true, etterFrist: !!(d.svarfrist && s.mottatt && s.mottatt.slice(0, 10) > d.svarfrist) };
  }).sort((a, b) => b.netto - a.netto);
  const best = rader.find((r) => r.gyldig && !r.mangler.length && r.netto > 0);
  return rader.map((r) => ({ ...r, best: !!best && r.mottakerId === best.mottakerId }));
}
export function velgKjoper(d, mottakerId, pakke, { idag = iDag() } = {}) {
  const s = (d.svar || []).find((x) => x.mottakerId === mottakerId); if (!s) return null;
  const v = vurderSvar(pakke, s);
  d.valgt = mottakerId; d.status = 'tildelt'; d.solgt = { dato: idag, firma: s.firma, kontakt: s.kontaktperson, telefon: s.telefon, epost: s.epost, netto: Math.round(v.netto), perM3: v.perM3 != null ? Math.round(v.perM3) : null };
  return d;
}
export function mangler(d) {
  const m = [];
  if (!d.bestand.length) m.push('minst ett bestand');
  if (!d.mottakere.length) m.push('minst én kjøper');
  if (!d.kontakt?.navn || !(d.kontakt?.telefon || d.kontakt?.epost)) m.push('kontaktperson med telefon eller e-post');
  return m;
}

// ---------- meldinger ----------
const datoTekst = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
export function delingTekst(p, mottaker, lenke) {
  const tid = p.sum.fraAar ? (p.sum.fraAar === p.sum.tilAar ? ` med planlagt hogst i ${p.sum.fraAar}` : ` med planlagt hogst ${p.sum.fraAar}–${p.sum.tilAar}`) : '';
  return {
    emne: `Skogdata og tømmer: ${p.tittel}`,
    tekst: `Hei ${mottaker.navn || ''},\n\nJeg deler skogdata for ${p.sted || 'eiendommen min'}: ${p.sum.bestand} bestand, ${p.sum.areal} daa og ca. ${p.sum.salg} m³${tid}.\n\nKart, bestand, volumer og driftsforhold – og skjema for prisforslag – finner du her:\n${lenke}\n\n${p.svarfrist ? `Jeg ønsker forslag innen ${datoTekst(p.svarfrist)}. ` : ''}Lenken virker til ${datoTekst(p.utloper)}.\n\nMed vennlig hilsen\n${p.kontakt?.navn || ''}${p.kontakt?.telefon ? `\n${p.kontakt.telefon}` : ''}`,
  };
}
export function valgtTekst(p, s) {
  return { emne: `Tømmer fra ${p.sted || p.tittel}: forslaget ditt er valgt`, tekst: `Hei ${s.kontaktperson || ''},\n\nTakk for forslaget. Jeg ønsker å gå videre med ${s.firma}. Ta kontakt for befaring og kontrakt.\n\nMed vennlig hilsen\n${p.kontakt?.navn || ''}${p.kontakt?.telefon ? `\n${p.kontakt.telefon}` : ''}` };
}
