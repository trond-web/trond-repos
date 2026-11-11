// Treslag i bestandsinfoen. Har ingen DOM og kan testes i Node.
//   * fordeling: andel gran/furu/lauv, med kilden (registrert, import, SR16 eller bare hovedtreslaget)
//   * volum per treslag: stående volum i dag fordelt etter andelene (m³/daa og m³ for bestandet)
//   * treantall per treslag i hogstklasse II, før og etter regulering: registrert, eller fordelt fra modellen
//     (bar/lauv fra ungskogmodellen, bar fordelt på gran og furu etter treslagsfordelingen)
import { startTilstand, treslagAndel, hogstklasseFor, rotnettoPerM3, STANDARD_INNSTILLINGER } from './model.js';
import { ungskogData, treantallModell } from './ungskog.js';

export const TRESLAG_REKKE = ['G', 'F', 'L'];
export const TRESLAG_NAVN = { G: 'Gran', F: 'Furu', L: 'Lauv' };
export const TRESLAG_FARGE = { G: '#1f6b4a', F: '#c98500', L: '#8fbf3f' };
const erSr16 = (b) => /SR16/.test(String(b.ekstra?.KILDE || b.ekstra?.kilde || ''));

// { andel: { G, F, L } (sum 1), kilde, forklaring }
export function fordeling(b) {
  if (b.treslagAndel) {
    const a = treslagAndel(b.treslagAndel) || { [b.treslag || 'G']: 1 };
    const andel = Object.fromEntries(TRESLAG_REKKE.map((t) => [t, a[t] || 0]));
    if (b.treslagAndelKilde === 'registrert') return { andel, kilde: 'registrert', forklaring: 'Registrert' };
    if (erSr16(b)) return { andel, kilde: 'sr16', forklaring: 'Anslått fra skogtypen i SR16 (laserdata) – andel av arealet, kontroller i felt' };
    return { andel, kilde: 'import', forklaring: 'Fra skogbruksplanen (import)' };
  }
  const t = b.treslag || 'G';
  return { andel: Object.fromEntries(TRESLAG_REKKE.map((x) => [x, x === t ? 1 : 0])), kilde: 'hovedtreslag', forklaring: `Bare hovedtreslaget (${TRESLAG_NAVN[t].toLowerCase()}) er kjent – legg inn fordelingen` };
}

// Volum per treslag i dag og rotnetto ved hogst nå (pris – driftskostnad per treslag, Innstillinger):
// { rader: [{ t, andel, daa (m³/daa), m3, perM3, netto }], volumDaa, m3, netto, kilde, forklaring }
export function volumPerTreslag(b, inn = STANDARD_INNSTILLINGER) {
  const f = fordeling(b); const vd = startTilstand(b).volumDaa || 0; const areal = b.areal || 0;
  const rader = TRESLAG_REKKE.map((t) => { const m3 = vd * areal * f.andel[t]; const perM3 = rotnettoPerM3(t, inn); return { t, andel: f.andel[t], daa: vd * f.andel[t], m3, perM3, netto: m3 * perM3 }; });
  return { rader, volumDaa: vd, m3: vd * areal, netto: rader.reduce((s, r) => s + r.netto, 0), kilde: f.kilde, forklaring: f.forklaring };
}

// Treslag og volum som HTML (SkogIQ Felt): stolpe og tabell uten redigering.
export function treslagKortHtml(v, { fmt = (x) => String(Math.round(x)), esc = (x) => String(x) } = {}) {
  const pst = (x) => Math.round(x * 100);
  return `<div class="ts-kort"><div class="ts-stolpe" role="img" aria-label="Treslagsfordeling">${v.rader.filter((r) => r.andel > 0).map((r) => `<span style="flex:${r.andel};background:${TRESLAG_FARGE[r.t]}">${r.andel >= 0.15 ? `${TRESLAG_NAVN[r.t]} ${pst(r.andel)} %` : ''}</span>`).join('')}</div>
    <table class="ts-tabell"><thead><tr><th>Treslag</th><th class="t">Andel</th><th class="t">m³</th><th class="t">Rotnetto</th></tr></thead><tbody>${v.rader.map((r) => `<tr><td><i style="background:${TRESLAG_FARGE[r.t]}"></i>${TRESLAG_NAVN[r.t]}</td><td class="t">${pst(r.andel)} %</td><td class="t">${fmt(r.m3)}</td><td class="t">${fmt(r.netto / 1000)}k</td></tr>`).join('')}
    <tr class="sum"><td>Sum</td><td class="t">100 %</td><td class="t">${fmt(v.m3)}</td><td class="t">${fmt(v.netto / 1000)}k</td></tr></tbody></table>
    <small>${esc(v.forklaring)}. Rotnetto ved hogst nå (kr).</small></div>`;
}

// Registrer fordelingen i prosent { G, F, L } (tomme = 0). Alt tomt fjerner fordelingen. Gir false ved ugyldig verdi.
export function settTreslagAndel(b, pst) {
  const v = {};
  for (const t of TRESLAG_REKKE) {
    const r = pst?.[t]; const n = r === '' || r == null ? 0 : Number(String(r).replace(',', '.').replace('%', ''));
    if (!Number.isFinite(n) || n < 0 || n > 100) return false; v[t] = n;
  }
  const a = treslagAndel(v);
  if (!a) { delete b.treslagAndel; delete b.treslagAndelKilde; return true; }
  b.treslagAndel = a; b.treslagAndelKilde = 'registrert'; return true;
}

// Dominerende treslag i fordelingen, når det avviker fra hovedtreslaget (hint i bestandsinfoen).
export function avvikHovedtreslag(b) {
  if (!b.treslagAndel) return null;
  const f = fordeling(b).andel; const maks = TRESLAG_REKKE.reduce((x, y) => (f[y] > f[x] ? y : x));
  return maks !== (b.treslag || 'G') && f[maks] > 0.5 ? maks : null;
}

export const visTreantallTreslag = (b, inn = STANDARD_INNSTILLINGER) => hogstklasseFor(b, inn) === 2;

// Fordel et antall bartrær på gran og furu etter fordelingen (eller hovedtreslaget).
function delBar(b, bar) {
  const f = fordeling(b).andel; const sum = f.G + f.F;
  const g = sum > 0 ? f.G / sum : (b.treslag === 'F' ? 0 : 1);
  return { G: Math.round(bar * g), F: Math.round(bar * (1 - g)) };
}

// Treantall per treslag (trær/daa) før og etter regulering:
// { for: { G, F, L, sum, kilde }, etter: { G, F, L, sum, kilde }, forklaring }
export function treantallPerTreslag(b, { inn = STANDARD_INNSTILLINGER } = {}) {
  const d = ungskogData(b, { inn }); const u = b.ungskog || {};
  const reg = (x) => x && TRESLAG_REKKE.every((t) => Number.isFinite(x[t]));
  let forR;
  if (reg(u.treslagFor)) forR = { ...u.treslagFor, kilde: 'registrert' };
  else {
    // Andelen lauv fra ungskogmodellen, brukt på totalen (registrert, takst eller modell).
    const m = treantallModell(b); const tot = d.treantallFor.verdi || 0;
    const lauvAndel = (m.bar + m.lauv) > 0 ? m.lauv / (m.bar + m.lauv) : ((b.treslag || 'G') === 'L' ? 1 : 0);
    const lauv = Math.round(tot * lauvAndel); forR = { ...delBar(b, tot - lauv), L: lauv, kilde: d.treantallFor.kilde === 'registrert' ? 'fordelt' : 'beregnet' };
  }
  let etterR;
  if (reg(u.treslagEtter)) etterR = { ...u.treslagEtter, kilde: 'registrert' };
  else {
    // Ved regulering spares bartrærne først; litt lauv (ca. 10 %) beholdes for mangfold og som ammetrær.
    const maal = d.treantallEtter.verdi || 0; const barFor = forR.G + forR.F;
    const lauvMaal = (b.treslag || 'G') === 'L' ? maal : Math.round(maal * 0.1);
    const bar = Math.min(barFor, Math.max(0, maal - lauvMaal)); const lauv = Math.min(forR.L, maal - bar);
    const g = barFor > 0 ? forR.G / barFor : 1;
    etterR = { G: Math.round(bar * g), F: Math.round(bar * (1 - g)), L: Math.max(0, Math.round(lauv)), kilde: d.treantallEtter.kilde === 'registrert' ? 'fordelt' : 'beregnet' };
  }
  const sum = (x) => ({ ...x, sum: x.G + x.F + x.L });
  return { for: sum(forR), etter: sum(etterR), maal: d.maal,
    forklaring: 'Beregnet: lauvandelen fra ungskogmodellen, bartrærne fordelt på gran og furu etter treslagsfordelingen. Etter regulering spares bartrærne først, og ca. 10 % lauv beholdes. Tell i felt og skriv inn.' };
}

// Registrer treantall per treslag for 'for' eller 'etter' regulering. verdier = { G, F, L } (tall eller tomt);
// alle tomme fjerner registreringen. Totalen (treantall før/etter regulering) settes til summen.
export function settTreantallTreslag(b, fase, verdier, { idag = new Date().toISOString().slice(0, 10) } = {}) {
  if (!['for', 'etter'].includes(fase)) return false;
  const felt = fase === 'for' ? 'treslagFor' : 'treslagEtter'; const total = fase === 'for' ? 'treantallFor' : 'treantallEtter';
  const v = {}; let tom = true;
  for (const t of TRESLAG_REKKE) {
    const r = verdier?.[t]; if (r === '' || r == null) { v[t] = null; continue; }
    const n = Number(String(r).replace(',', '.').replace(/\s/g, '')); if (!Number.isFinite(n) || n < 0 || n > 20000) return false;
    v[t] = Math.round(n); tom = false;
  }
  b.ungskog = { ...(b.ungskog || {}) }; delete b.ungskog.kilde;
  if (tom) { delete b.ungskog[felt]; delete b.ungskog[total]; } else {
    for (const t of TRESLAG_REKKE) if (v[t] == null) v[t] = 0;
    b.ungskog[felt] = v; b.ungskog[total] = v.G + v.F + v.L;
  }
  b.ungskog.dato = idag;
  if (!Object.keys(b.ungskog).some((k) => !['dato'].includes(k))) delete b.ungskog;
  return true;
}
