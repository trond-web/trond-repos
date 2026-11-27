// 🧭 Åpningsdashboard for Jord, Husdyr og Gården (Skog bruker Oversikt i app.js). Hvert område i menylinja
// (js/driftsomrader.js MENY) starter her: nøkkeltall, det som trenger oppfølging, og snarveier til fanene i området.
// Lenker skrives som data-gaa="fane" eller data-gaa="skifteplan:underfane", og data-gaa-omrade="område".
import { oppsummer, kontroller, KULTURER, GRUPPER } from './skifteplan.js';
import { husdyrgjodsel, forbalanse, kontrollerHusdyr, kontrollerBeite, kontrollerRom, produksjonstilskudd, verdier } from './husdyr.js';
import { klimabalanse } from './klima.js';
import { tilskuddsoversikt, kommendeFrister } from './tilskudd.js';
import { oppsummering as kslOppsummering } from './ksl.js';
import { drift, hvaFinnes, MENY } from './driftsomrader.js';
import { fmt } from './charts.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n0 = (x) => fmt(Math.round(x || 0), 0);
const n1 = (x) => fmt(x || 0, 1);
const kpi = (verdi, etikett, under = '', lenke = '') => `<div class="kpi${lenke ? ' kpi-lenke' : ''}"${lenke ? ` data-gaa="${esc(lenke)}" role="link" tabindex="0"` : ''}><div class="verdi">${verdi}</div><div class="etikett">${etikett}</div>${under ? `<div class="under">${under}</div>` : ''}</div>`;
const NIV = { avvik: '✕', varsel: '!', info: 'i' };
const FARGE = { avvik: 'var(--critical)', varsel: '#c77800', info: 'var(--accent)' };
const funnListe = (funn, maks = 5) => funn.slice(0, maks).map((x) => `<div class="sp-funn" style="--farge:${FARGE[x.nivaa] || FARGE.info}"><i>${NIV[x.nivaa] || 'i'}</i><div><b>${esc(x.tittel)}</b>${x.tekst ? `<div class="hint">${esc(x.tekst)}</div>` : ''}</div></div>`).join('');
const sorterFunn = (f) => f.filter((x) => x.nivaa !== 'ok').sort((a, b) => ['avvik', 'varsel', 'info'].indexOf(a.nivaa) - ['avvik', 'varsel', 'info'].indexOf(b.nivaa));
// Snarveier: rutenett med knapper til fanene i området.
const snarveier = (liste) => `<div class="omr-snarveier">${liste.map(([gaa, ikon, navn, tekst]) => `<button type="button" class="omr-snarvei" data-gaa="${esc(gaa)}"><span class="omr-ikon" aria-hidden="true">${ikon}</span><span><b>${esc(navn)}</b><span class="hint">${esc(tekst)}</span></span></button>`).join('')}</div>`;
const trygt = (f, reserve = null) => { try { return f(); } catch (e) { console.warn(e); return reserve; } };
const planAar = (S, iAar) => Number(S?.skifteplan?.aar) || iAar;

// ---------- 🌾 Jord ----------
export function jordHtml(S, iAar) {
  const a = planAar(S, iAar); const plan = S?.skifteplan; const skifter = plan?.skifter || [];
  const sv = snarveier([
    ['skifteplan:skifter', '🗺️', 'Skifter', 'Skifteinndeling, vekster, jordprøver og grøfteplan'],
    ['skifteplan:gjodsling', '💧', 'Gjødsling', 'Gjødslingsplan, forslag og gjødseljournal'],
    ['skifteplan:sproyting', '🧴', 'Plantevern', 'Sprøytejournal, IPV og vannjournal'],
    ['skifteplan:maskin', '🚜', 'Maskin', 'John Deere og ISOBUS'],
    ['skifteplan:krav', '✓', 'Krav', 'Kontroll mot gjødsel- og plantevernregelverket'],
  ]);
  if (!skifter.length) {
    return `<div class="kort helt omr-helt"><h3>🌾 Jordbruket</h3><p>Ingen skifter ennå. Hent skiftene fra AR5 eller tegn dem i kartet – så får du gjødslingsplan, plantevernjournal og kontroll mot regelverket.</p>
      <div class="knapperad"><button type="button" class="knapp primar" data-gaa="skifteplan:skifter">Kom i gang med skifteplanen</button></div></div>${sv}`;
  }
  const o = trygt(() => oppsummer(S, a)) || { antall: skifter.length, areal: 0, aktivtAreal: 0, perGruppe: {}, sum: {}, avvik: 0, varsel: 0, sproytinger: 0 };
  const utenVekst = skifter.filter((sk) => !sk.vekster?.[a]?.kultur).length;
  const utenProve = skifter.filter((sk) => !sk.jordprove?.dato || (a - Number(String(sk.jordprove.dato).slice(0, 4))) > 8).length;
  const dekning = (t, b) => (b ? `${Math.round((t / b) * 100)} % av behovet` : 'ikke beregnet');
  const grupper = Object.entries(o.perGruppe).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
  const maks = Math.max(1, ...grupper.map(([, v]) => v));
  const funn = sorterFunn(trygt(() => kontroller(S, a), []).filter((f) => f.tema !== 'husdyr'));
  return `<div class="omr-topp"><span class="hint">Planår ${a}</span></div>
    <div class="kpi-rad">
      ${kpi(n1(o.areal), 'daa i skifteplanen', `${o.antall} skifter`, 'skifteplan:skifter')}
      ${kpi(n1(o.aktivtAreal), `daa med vekst ${a}`, utenVekst ? `${utenVekst} skifter uten vekst` : 'Alle skifter har vekst', 'skifteplan:skifter')}
      ${kpi(n0(o.sum.N), 'kg N planlagt', dekning(o.sum.N, o.sum.behovN), 'skifteplan:gjodsling')}
      ${kpi(n0(o.sum.P), 'kg P planlagt', dekning(o.sum.P, o.sum.behovP), 'skifteplan:gjodsling')}
      ${kpi(n0(o.sproytinger), `sprøytinger ${a}`, 'i plantevernjournalen', 'skifteplan:sproyting')}
      ${kpi(o.avvik ? `<span class="omr-rod">${o.avvik}</span>` : '0', 'avvik', `${o.varsel} varsler`, 'skifteplan:krav')}
    </div>
    ${grupper.length ? `<div class="kort"><h3>Vekster ${a}</h3><div class="omr-stolper">${grupper.map(([g, v]) => `<div class="omr-stolpe"><span>${esc(GRUPPER[g]?.navn || 'Ikke satt')}</span><span class="omr-bar"><i style="width:${(v / maks) * 100}%;background:${GRUPPER[g]?.farge || 'var(--line)'}"></i></span><span class="tall">${n1(v)} daa</span></div>`).join('')}</div></div>` : ''}
    <div class="kort"><div class="detalj-topp"><h3>Følg opp</h3><a href="#" data-gaa="skifteplan:krav" class="hint">Alle krav ›</a></div>
      ${funn.length || utenProve ? `${utenProve ? funnListe([{ nivaa: 'varsel', tittel: `${utenProve} skifter mangler jordprøve eller har prøve eldre enn 8 år`, tekst: 'Jordprøver er grunnlaget for gjødslingsplanen.' }]) : ''}${funnListe(funn, 5)}` : '<p class="hint">✓ Ingen avvik eller varsler i skifteplanen.</p>'}
    </div>
    ${sv}`;
}

// ---------- 🐄 Husdyr ----------
export function husdyrHtml(S, iAar) {
  const a = planAar(S, iAar); const dyr = (S?.skifteplan?.dyrehold?.dyr || []).filter((r) => Number(r.antall) > 0);
  const sv = snarveier([
    ['skifteplan:husdyr', '🐄', 'Dyr og fjøs', 'Dyrehold, avvik og plass i fjøset'],
    ['skifteplan:husdyr-gjodsel', '💩', 'Husdyrgjødsel', 'Mengde, fosfor, lager og spredeareal'],
    ['skifteplan:husdyr-for', '🌾', 'Fôr og beite', 'Fôrbalanse, rundballer og beiteplan'],
    ['skifteplan:husdyr-mattilsynet', '🛡️', 'Mattilsynet', 'Dyrevelferd, tilsyn og dokumentasjon'],
    ['skifteplan:husdyr-tilskudd', '💰', 'Produksjonstilskudd', 'Anslag for dyreholdet og arealene'],
  ]);
  if (!dyr.length) {
    return `<div class="kort helt omr-helt"><h3>🐄 Husdyrholdet</h3><p>Ingen dyr registrert ennå. Legg inn dyrene på gården, så beregnes husdyrgjødsla, fôrbalansen mot avlingene, plassen i fjøset og produksjonstilskuddet.</p>
      <div class="knapperad"><button type="button" class="knapp primar" data-gaa="skifteplan:husdyr">Legg inn dyrene</button></div></div>${sv}`;
  }
  const g = trygt(() => husdyrgjodsel(S, a)); const f = trygt(() => forbalanse(S, a)); const pt = trygt(() => produksjonstilskudd(S, a));
  const funn = sorterFunn(trygt(() => [...kontrollerHusdyr(S, a), ...kontrollerBeite(S, a), ...kontrollerRom(S)], []));
  const ok = (x, ja, nei) => (x >= 0 ? `<span class="hd-ok">✓ ${ja}</span>` : `<span class="hd-ikke">✕ ${nei}</span>`);
  return `<div class="omr-topp"><span class="hint">Planår ${a}</span></div>
    <div class="kort"><div class="detalj-topp"><h3>Dyrene</h3><a href="#" data-gaa="skifteplan:husdyr" class="hint">Endre ›</a></div>
      <div class="omr-dyr">${dyr.map((r) => { const v = verdier(r); return `<span class="omr-dyr-rad"><span aria-hidden="true">${v.ikon}</span><b>${n0(r.antall)}</b> ${esc(v.navn)}</span>`; }).join('')}</div></div>
    <div class="kpi-rad">
      ${g ? kpi(n0(g.tonn), 'tonn husdyrgjødsel', `${n0(g.P)} kg fosfor i året`, 'skifteplan:husdyr-gjodsel') : ''}
      ${g?.areal ? kpi(n1(g.PperDaa), 'kg P/daa', `grense ${n1(g.grense)} · ${ok((g.grense || 0) - g.PperDaa, 'innenfor', 'over grensen')}`, 'skifteplan:husdyr-gjodsel') : ''}
      ${g ? kpi(n0(g.lagerBehov), 'm³ lager trengs', g.lager == null ? 'Legg inn lageret ditt' : ok(g.lager - g.lagerBehov, `${n0(g.lager)} m³ – nok`, `${n0(g.lager)} m³ – for lite`), 'skifteplan:husdyr-gjodsel') : ''}
      ${f ? kpi(`${f.balanse.grovfor >= 0 ? '+' : ''}${n0(f.balanse.grovfor)}`, 'FEm grovfôr i balanse', ok(f.balanse.grovfor, 'nok grovfôr', 'for lite grovfôr'), 'skifteplan:husdyr-for') : ''}
      ${f ? kpi(n0(f.rundballerBehov), 'rundballer trengs', `${n0(f.rundballerProd)} høstes`, 'skifteplan:husdyr-for') : ''}
      ${pt ? kpi(n0(pt.sum), 'kr produksjonstilskudd', 'grovt anslag', 'skifteplan:husdyr-tilskudd') : ''}
    </div>
    <div class="kort"><h3>Følg opp</h3>${funn.length ? funnListe(funn, 6) : '<p class="hint">✓ Ingen avvik eller varsler for husdyrholdet.</p>'}</div>
    ${sv}`;
}

// ---------- 🏡 Gården (felles) ----------
export function gardHtml(S, iAar) {
  const d = drift(S); const finnes = trygt(() => hvaFinnes(S), {});
  const omr = ['skog', 'jord', 'husdyr'].filter((k) => d[k]);
  const kortOmr = `<div class="omr-omrader">${omr.map((k) => `<button type="button" class="omr-omrade" data-gaa-omrade="${k}"><span class="omr-ikon" aria-hidden="true">${MENY[k].ikon}</span><span><b>${esc(MENY[k].navn)}</b><span class="hint">${esc(finnes[k]?.tekst || '')}</span></span><span aria-hidden="true">›</span></button>`).join('')}</div>`;
  const kb = trygt(() => klimabalanse(S, iAar));
  const ts = trygt(() => tilskuddsoversikt(S, iAar));
  const frister = ts ? trygt(() => kommendeFrister(ts), []).slice(0, 4) : [];
  const ksl = S?.ksl ? trygt(() => kslOppsummering(S, iAar)) : null;
  const harKsl = d.jord || d.husdyr;
  const klimaTekst = kb && (kb.poster?.length) ? `${kb.netto > 0 ? '+' : ''}${n0(kb.netto)}` : '–';
  const datoTekst = (x) => x.dato.toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'nb-NO', { day: 'numeric', month: 'long' });
  return `${kortOmr}
    <div class="kpi-rad">
      ${kpi(klimaTekst, 't CO₂e netto per år', kb?.poster?.length ? (kb.netto > 0 ? 'Utslipp større enn binding' : 'Skogen binder mer enn gården slipper ut') : 'Ikke beregnet ennå', 'klima')}
      ${ts ? kpi(ts.sum ? n0(ts.sum) : '–', 'kr i aktuelle tilskudd', `${ts.liste.filter((x) => x.status === 'aktuell').length} ordninger${ts.inntil ? ` · inntil ${n0(ts.inntil)} kr til` : ''}`, 'tilskudd') : ''}
      ${harKsl ? kpi(ksl ? n0(ksl.apneAvvik.length) : '–', 'åpne KSL-avvik', ksl ? (ksl.revisjonForfalt ? '<span class="omr-rod">Egenrevisjon forfalt</span>' : `Neste revisjon ${esc(ksl.nesteRevisjon || '')}`) : 'Egenrevisjon ikke startet', 'ksl') : ''}
    </div>
    ${frister.length ? `<div class="kort"><div class="detalj-topp"><h3>Kommende frister</h3><a href="#" data-gaa="tilskudd" class="hint">Alle tilskudd ›</a></div>
      <div class="omr-frister">${frister.map((x) => `<div class="omr-frist"><span class="omr-dato">${esc(datoTekst(x))}</span><span>${esc(x.tekst)}</span><span class="hint">${x.dager} dager</span></div>`).join('')}</div></div>` : ''}
    ${snarveier([
    ['verdi', '¤', 'Verdi', 'Eiendomsverdi, slaktverdi, landbrukstakst og tømmersalg'],
    ['klima', '🌍', 'Klima', 'Gårdens klimabalanse og tiltak'],
    ['tilskudd', '💰', 'Tilskudd', 'Ordningene du kan søke, med beløp og frister'],
    ...(harKsl ? [['ksl', '✓', 'KSL', 'Egenrevisjon, krav og frister, avvik og arkiv']] : []),
    ['rapporter', '📄', 'Rapporter', 'Samlet rapport og utskrift'],
  ])}`;
}
