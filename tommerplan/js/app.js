// Tømmerplan – produksjonsplanlegger for tømmer. Alt lagres lokalt i nettleseren.
import {
  planlegg, leveranseCsv, hogstRate, lassbererRate, turTimer, veiKm, totalVolum, neste_mandag,
  SORTIMENTER, SORT_ID, sortiment, VEGKLASSER, FORE, HOGSTFORMER, MASKINSTORRELSE, STANDARD_INNSTILLINGER,
} from './motor.js';
import { demoPlan } from './demo.js';
import { maskinplan, stabletSoyle, linjer, forklaring, aktiverTips } from './graf.js';
import { logistikkSide } from './logistikk.js';
import { importerOrdre, ordreFraPlan, ordreCsv, kobleOrdre, MAL_CSV, ORDRETYPER } from './ordre.js';

const NOKKEL = 'tommerplan-v1';
const app = document.getElementById('app');
const ark = document.getElementById('ark');
const FARGE = Object.fromEntries(SORTIMENTER.map((s, i) => [s.id, `var(--s${i + 1})`]));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (x, d = 0) => (x === null || x === undefined || Number.isNaN(x) ? '–' : Number(x).toLocaleString('nb-NO', { maximumFractionDigits: d, minimumFractionDigits: d }));
const dato = (iso) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: '2-digit' }) : '–');
const nyId = (p) => p + Math.random().toString(36).slice(2, 8);
const idag = () => new Date().toISOString().slice(0, 10);

// ---------- Lagring ----------
let plan = les();
function les() {
  try {
    const p = JSON.parse(localStorage.getItem(NOKKEL));
    if (p && Array.isArray(p.drifter)) return { innstillinger: {}, lag: [], mottak: [], ordre: { io: [], so: [], po: [] }, sortimentkoder: {}, ...p };
  } catch { /* tom eller blokkert lagring */ }
  return demoPlan(neste_mandag(idag()));
}
function lagre() {
  try { localStorage.setItem(NOKKEL, JSON.stringify(plan)); } catch { /* privat modus */ }
  vis();
}

let res = null;
const beregn = () => { res = planlegg(plan); return res; };

// ---------- Ruting ----------
const SIDER = [
  ['oversikt', 'Oversikt'], ['drifter', 'Drifter'], ['lag', 'Maskiner og biler'], ['mottak', 'Mottak'],
  ['ordre', 'Ordre (VSYS)'], ['leveranser', 'Leveranseplan'], ['innstillinger', 'Innstillinger'], ['logistikk', 'God logistikk'],
];
const side = () => (location.hash.replace(/^#\/?/, '') || 'oversikt');
window.addEventListener('hashchange', vis);

function vis() {
  beregn();
  const s = SIDER.some(([id]) => id === side()) ? side() : 'oversikt';
  document.getElementById('faner').innerHTML = SIDER.map(([id, navn]) => `<a href="#/${id}" ${id === s ? 'aria-current="page"' : ''}>${navn}</a>`).join('');
  const feil = res.varsler.filter((v) => v.niva !== 'info').length;
  document.getElementById('topp-status').textContent = `${plan.drifter.length} drifter · ${fmt(res.nokkel.totVolum)} m³${feil ? ` · ${feil} varsler` : ''}`;
  app.innerHTML = { oversikt, drifter: drifterSide, lag: lagSide, mottak: mottakSide, ordre: ordreSide, leveranser: leveranseSide, innstillinger: innstillingSide, logistikk: logistikkSide }[s](res);
  app.querySelectorAll('.grafboks').forEach(aktiverTips);
}

// ---------- Oversikt ----------
const NIVA = { feil: ['⛔', 'Feil'], advarsel: ['⚠️', 'Advarsel'], info: ['ℹ️', 'Info'] };

function oversikt(r) {
  const k = r.nokkel;
  const ferdig = k.sisteFramkjort ? dato(k.sisteFramkjort) : 'Ikke alt';
  const fliser = [
    ['Volum i planen', `${fmt(k.totVolum)} m³`, `${plan.drifter.length} drifter`],
    ['Levert til mottak', `${fmt(k.levert)} m³`, `${fmt(k.lass)} lass · ${fmt(k.totVolum ? (100 * k.levert) / k.totVolum : 0)} %`],
    ['Alt framkjørt', ferdig, `plan ${dato(r.start)} – ${dato(r.slutt)}`],
    ['Lagringstid', `${fmt(k.snittAlder, 1)} dager`, 'snitt ved velteplass'],
    ['Mest på velteplass', `${fmt(k.maksLager)} m³`, 'alle drifter samlet'],
    ['Bilutnyttelse', `${fmt(100 * k.bilUtnyttelse)} %`, `${plan.innstillinger.biler ?? STANDARD_INNSTILLINGER.biler} biler × ${plan.innstillinger.bilTimer ?? STANDARD_INNSTILLINGER.bilTimer} t`],
  ];
  const serier = SORTIMENTER.map((s) => ({ id: s.id, navn: s.navn, farge: FARGE[s.id] }));
  const brukt = serier.filter((se) => r.uker.some((u) => u.lager[se.id] > 0.5 || u.levert[se.id] > 0.5));
  const levertSum = (u) => SORT_ID.reduce((s, id) => s + u.levert[id], 0);
  const varselListe = r.varsler.length
    ? `<ul class="varsler">${r.varsler.map((v) => `<li class="v-${v.niva}"><span class="v-ikon" aria-hidden="true">${NIVA[v.niva][0]}</span><span><b>${NIVA[v.niva][1]}:</b> ${esc(v.tekst)}${v.drift ? ` <a href="#/drifter" data-drift="${v.drift}" class="lenke-rediger">Endre drift</a>` : ''}${['io', 'so', 'po'].filter((t) => v[t]).map((t) => ` <a href="#/ordre" data-ordre="${t}:${v[t]}" class="lenke-ordre">Åpne ${ORDRETYPER[t].toLowerCase()}</a>`).join('')}</span></li>`).join('')}</ul>`
    : '<p class="ok">✅ Ingen varsler. Planen går opp med dagens kapasitet.</p>';

  return `
    <section class="fliser">${fliser.map(([t, v, u]) => `<div class="flis"><span>${t}</span><b>${v}</b><small>${u}</small></div>`).join('')}</section>
    <section class="kort">
      <h2>Varsler og flaskehalser</h2>
      ${varselListe}
    </section>
    <section class="kort grafboks">
      <div class="kort-topp"><h2>Maskinplan</h2>${sesongForklaring()}</div>
      <p class="dempet">Hvert lag tar driftene i køen sin etter tur. Drifter som ikke kan kjøres i sesongen hoppes over til de kan.</p>
      <div class="rull">${maskinplan(r, plan)}</div>
      <div class="forklaring"><span><i class="seg-drift"></i>Drift</span><span><i class="seg-flytt"></i>Flytting</span><span><i class="seg-vent"></i>Venter på sesong</span></div>
    </section>
    <section class="kort grafboks">
      <h2>Lager ved velteplass, slutten av uka</h2>
      ${forklaring(brukt)}
      <div class="rull">${stabletSoyle(r.uker, brukt, (u, id) => u.lager[id] || 0, { tittel: 'Lager ved velteplass per uke' })}</div>
    </section>
    <section class="kort grafboks">
      <h2>Framkjørt og levert per uke</h2>
      ${forklaring([{ navn: 'Framkjørt til velteplass', farge: 'var(--s1)' }, { navn: 'Levert til mottak', farge: 'var(--s2)' }])}
      <div class="rull">${linjer(r.uker, [
        { navn: 'Framkjørt', farge: 'var(--s1)', verdier: r.uker.map((u) => u.framkjort) },
        { navn: 'Levert', farge: 'var(--s2)', verdier: r.uker.map(levertSum) },
      ], { tittel: 'Framkjørt og levert per uke' })}</div>
      <details><summary>Vis som tabell</summary>${ukeTabell(r)}</details>
    </section>`;
}

function sesongForklaring() {
  return `<div class="forklaring"><span><i class="band-vinter"></i>Vinter (frost)</span><span><i class="band-tele"></i>Teleløsning</span><span><i class="band-sommer"></i>Sommer (blåved/barkbille)</span></div>`;
}

function ukeTabell(r) {
  return `<div class="tabell-rull"><table class="tabell"><thead><tr><th>Uke</th><th>Hogd</th><th>Framkjørt</th><th>Levert</th><th>Lass</th><th>Lager</th><th>Bil-timer</th></tr></thead><tbody>
    ${r.uker.map((u) => `<tr><td>${u.uke}</td><td>${fmt(u.hogd)}</td><td>${fmt(u.framkjort)}</td><td>${fmt(SORT_ID.reduce((s, id) => s + u.levert[id], 0))}</td><td>${u.lass}</td><td>${fmt(SORT_ID.reduce((s, id) => s + (u.lager[id] || 0), 0))}</td><td>${fmt(u.bilTimer)} / ${fmt(u.bilTimerTilgj)}</td></tr>`).join('')}
  </tbody></table></div>`;
}

// ---------- Drifter ----------
function drifterSide(r) {
  const inn = { ...STANDARD_INNSTILLINGER, ...plan.innstillinger };
  const lagNavn = Object.fromEntries(plan.lag.map((l) => [l.id, l.navn]));
  const resD = Object.fromEntries(r.drifter.map((d) => [d.id, d]));
  const etterLag = [...plan.lag.map((l) => l.id), ''].map((lid) => [lid, plan.drifter.filter((d) => (d.lag || '') === lid || (!lid && !lagNavn[d.lag])).sort((a, b) => (+a.rekkefolge || 0) - (+b.rekkefolge || 0))]);
  return `
    <div class="verktoy"><h1>Drifter</h1><button class="knapp" data-handling="ny-drift">+ Ny drift</button></div>
    <p class="dempet">Rekkefølgen i hver kø bestemmer hvilken drift laget tar først. Bruk pilene for å flytte.</p>
    ${etterLag.filter(([, ds]) => ds.length).map(([lid, ds]) => `
      <section class="kort">
        <h2>${esc(lid ? lagNavn[lid] : 'Uten maskinlag')}</h2>
        <div class="tabell-rull"><table class="tabell">
          <thead><tr><th></th><th>Drift</th><th>m³</th><th>Føre / veg</th><th title="m³ per G15-time">Hogst</th><th title="m³ per G15-time">Lassbærer</th><th>Start</th><th>Framkjørt</th><th>Levert</th><th></th></tr></thead>
          <tbody>${ds.map((d, i) => {
            const lag = plan.lag.find((l) => l.id === d.lag);
            const x = resD[d.id] || {};
            const hr = hogstRate(d, lag, inn); const lr = lassbererRate(d, lag, inn);
            const flaske = hr > lr * 1.15 ? 'lassbærer' : lr > hr * 1.15 ? 'hogst' : '';
            return `<tr>
              <td class="pil">${i > 0 ? `<button data-handling="opp" data-id="${d.id}" aria-label="Flytt opp">▲</button>` : ''}${i < ds.length - 1 ? `<button data-handling="ned" data-id="${d.id}" aria-label="Flytt ned">▼</button>` : ''}</td>
              <td><b>${esc(d.navn)}</b>${ordreMerker(d.id)}<br><small class="dempet">${HOGSTFORMER[d.hogstform] || ''} · midd.st. ${fmt(+d.middelstamme, 2)} m³ · ${fmt(+d.kjoreavstand)} m kjøring</small></td>
              <td>${fmt(totalVolum(d))}</td>
              <td><small>${FORE[d.fore] || ''}<br>${VEGKLASSER[d.vegklasse] || ''}</small></td>
              <td class="${flaske === 'hogst' ? 'flaske' : ''}">${fmt(hr, 1)}</td>
              <td class="${flaske === 'lassbærer' ? 'flaske' : ''}">${fmt(lr, 1)}</td>
              <td>${dato(x.start)}</td><td>${dato(x.framkjortFerdig)}</td>
              <td>${fmt(x.levert)}${x.tot && x.levert < x.tot - 1 ? ` <small class="dempet">av ${fmt(x.tot)}</small>` : ''}</td>
              <td><button class="knapp liten" data-handling="rediger-drift" data-id="${d.id}">Endre</button></td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
      </section>`).join('') || '<p>Ingen drifter ennå.</p>'}
    <p class="dempet">Uthevet tall viser flaskehalsen i laget: den maskinen som bestemmer tempoet på drifta.</p>`;
}

function ordreMerker(driftId) {
  const o = plan.ordre || {};
  const io = (o.io || []).filter((x) => x.drift === driftId);
  const po = (o.po || []).filter((x) => x.drift === driftId || io.some((i) => i.id === x.io));
  return [...io.map((x) => `<span class="ordremerke io">IO ${esc(x.ordrenr || 'utkast')}</span>`), ...po.map((x) => `<span class="ordremerke po">PO ${esc(x.ordrenr || 'utkast')}</span>`)].join('');
}

const tallFelt = (navn, etikett, verdi, ekstra = '') => `<label>${etikett}<input type="number" name="${navn}" value="${esc(verdi)}" step="any" ${ekstra}></label>`;
const tekstFelt = (navn, etikett, verdi, ekstra = '') => `<label>${etikett}<input name="${navn}" value="${esc(verdi)}" ${ekstra}></label>`;
const valgFelt = (navn, etikett, verdi, valg) => `<label>${etikett}<select name="${navn}">${Object.entries(valg).map(([k, v]) => `<option value="${k}" ${String(k) === String(verdi) ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`;

function driftSkjema(d) {
  const lagValg = Object.fromEntries([['', '– ingen –'], ...plan.lag.map((l) => [l.id, l.navn])]);
  return `
    <form method="dialog" class="skjema" data-skjema="drift" data-id="${d.id}">
      <h2>${d.navn ? esc(d.navn) : 'Ny drift'}</h2>
      ${tekstFelt('navn', 'Navn', d.navn, 'required')}
      <div class="rad">${valgFelt('lag', 'Maskinlag', d.lag, lagValg)}${valgFelt('hogstform', 'Hogstform', d.hogstform, HOGSTFORMER)}</div>
      <fieldset><legend>Volum per sortiment (m³)</legend>${(plan.ordre?.io || []).some((x) => x.drift === d.id && x.linjer?.length) ? '<p class="dempet">Volumet hentes fra innkjøpsordren for drifta. Endre det under Ordre.</p>' : ''}<div class="rad6">
        ${SORTIMENTER.map((s) => tallFelt(`v_${s.id}`, s.kort, d.volum?.[s.id] ?? 0, 'min="0"')).join('')}
      </div></fieldset>
      <fieldset><legend>Driftsforhold</legend><div class="rad">
        ${tallFelt('middelstamme', 'Middelstamme (m³)', d.middelstamme, 'min="0.03" max="3"')}
        ${valgFelt('terreng', 'Driftsvanskelighet', d.terreng, { 1: '1 – lett', 2: '2 – middels lett', 3: '3 – middels', 4: '4 – vanskelig', 5: '5 – svært vanskelig' })}
        ${tallFelt('kjoreavstand', 'Terrengtransport (m)', d.kjoreavstand, 'min="0"')}
        ${valgFelt('fore', 'Føre', d.fore, FORE)}
      </div></fieldset>
      <fieldset><legend>Vei og velteplass</legend><div class="rad">
        ${valgFelt('vegklasse', 'Skogsbilveg', d.vegklasse, VEGKLASSER)}
        ${tallFelt('skogsbilveiKm', 'Skogsbilveg til offentlig vei (km)', d.skogsbilveiKm, 'min="0"')}
        ${tallFelt('velteplass', 'Plass på velteplass (m³)', d.velteplass, 'min="0"')}
        ${tallFelt('lat', 'Breddegrad', d.lat)}${tallFelt('lon', 'Lengdegrad', d.lon)}
      </div>
      <p class="dempet">Avstand til mottak regnes fra koordinatene (luftlinje × veifaktor). Du kan overstyre med faktisk veilengde:</p>
      <div class="rad">${plan.mottak.map((m) => tallFelt(`a_${m.id}`, `Km til ${m.navn}`, d.avstander?.[m.id] ?? '', 'min="0" placeholder="auto"')).join('')}</div>
      </fieldset>
      <div class="rad">${tekstFelt('tidligst', 'Tidligst start', d.tidligst, 'type="date"')}${tekstFelt('frist', 'Ferdig framkjørt innen', d.frist, 'type="date"')}</div>
      <div class="knapper">
        ${plan.drifter.some((x) => x.id === d.id) ? '<button class="knapp fare" value="slett">Slett</button>' : ''}
        <span></span><button class="knapp sekundar" value="avbryt" formnovalidate>Avbryt</button><button class="knapp" value="lagre">Lagre</button>
      </div>
    </form>`;
}

function lesDrift(f, d) {
  const g = (n) => f.elements[n]?.value ?? '';
  const n = (x) => (x === '' ? '' : +x);
  return {
    ...d, navn: g('navn').trim(), lag: g('lag'), hogstform: g('hogstform'),
    volum: Object.fromEntries(SORT_ID.map((id) => [id, +g(`v_${id}`) || 0])),
    middelstamme: +g('middelstamme') || 0.3, terreng: +g('terreng'), kjoreavstand: +g('kjoreavstand') || 0, fore: g('fore'),
    vegklasse: +g('vegklasse'), skogsbilveiKm: +g('skogsbilveiKm') || 0, velteplass: +g('velteplass') || 0,
    lat: n(g('lat')), lon: n(g('lon')),
    avstander: Object.fromEntries(plan.mottak.map((m) => [m.id, g(`a_${m.id}`)]).filter(([, v]) => v !== '').map(([k, v]) => [k, +v])),
    tidligst: g('tidligst'), frist: g('frist'),
  };
}

// ---------- Maskinlag og biler ----------
function lagSide(r) {
  const inn = { ...STANDARD_INNSTILLINGER, ...plan.innstillinger };
  const sumUker = r.uker.length;
  const timer = r.uker.reduce((s, u) => s + u.bilTimer, 0);
  return `
    <div class="verktoy"><h1>Maskiner og biler</h1><button class="knapp" data-handling="nytt-lag">+ Nytt maskinlag</button></div>
    <section class="kort">
      <h2>Maskinlag (hogstmaskin + lassbærer)</h2>
      <div class="tabell-rull"><table class="tabell"><thead><tr><th>Lag</th><th>Størrelse</th><th>G15-timer/dag</th><th>Flyttedager</th><th>Drifter</th><th>Står uten drift</th><th></th></tr></thead><tbody>
        ${plan.lag.map((l) => {
          const x = r.lag.find((y) => y.id === l.id);
          return `<tr><td><b>${esc(l.navn)}</b></td><td>${MASKINSTORRELSE[l.maskin] || ''}</td><td>${fmt(+l.timer)}</td><td>${fmt(+l.flyttDager)}</td>
            <td>${plan.drifter.filter((d) => d.lag === l.id).length}</td><td>${x ? `${x.ventDager} dager` : '–'}</td>
            <td><button class="knapp liten" data-handling="rediger-lag" data-id="${l.id}">Endre</button></td></tr>`;
        }).join('')}
      </tbody></table></div>
    </section>
    <section class="kort">
      <h2>Tømmerbiler</h2>
      <form class="skjema innebygd" data-skjema="biler">
        <div class="rad">
          ${tallFelt('biler', 'Antall biler', inn.biler, 'min="0"')}
          ${tallFelt('bilTimer', 'Timer per bil per dag', inn.bilTimer, 'min="1" max="24"')}
          ${tallFelt('bilDager', 'Kjøredager per uke', inn.bilDager, 'min="1" max="7"')}
          ${tallFelt('lassM3', 'm³ per lass', inn.lassM3, 'min="5"')}
        </div>
        <div class="rad">
          ${tallFelt('fartVei', 'Snittfart offentlig vei (km/t)', inn.fartVei, 'min="10"')}
          ${tallFelt('fartSkogsbilvei', 'Snittfart skogsbilveg (km/t)', inn.fartSkogsbilvei, 'min="5"')}
          ${tallFelt('lastetid', 'Lastetid (t)', inn.lastetid, 'min="0"')}
          ${tallFelt('lossetid', 'Lossetid (t)', inn.lossetid, 'min="0"')}
          ${tallFelt('veifaktor', 'Veifaktor (vei/luftlinje)', inn.veifaktor, 'min="1" max="3"')}
        </div>
        <p class="dempet">Vanlig tømmervogntog på 60 tonn tar rundt 40 m³ per lass. Der vegene er åpnet for 74 tonn, er det plass til mer.
        Bilene brukte ${fmt(timer)} av ${fmt(r.uker.reduce((s, u) => s + u.bilTimerTilgj, 0))} tilgjengelige timer (${fmt(100 * r.nokkel.bilUtnyttelse)} %) over ${sumUker} uker.</p>
        <button class="knapp">Lagre biler</button>
      </form>
    </section>
    <section class="kort">
      <h2>Turtid per drift og mottak</h2>
      <p class="dempet">En tur er tom inn, lastet ut, lasting og lossing.</p>
      <div class="tabell-rull"><table class="tabell"><thead><tr><th>Drift</th>${plan.mottak.map((m) => `<th>${esc(m.navn)}</th>`).join('')}</tr></thead><tbody>
        ${plan.drifter.map((d) => `<tr><td>${esc(d.navn)}</td>${plan.mottak.map((m) => {
          const t = turTimer(d, m, inn); const km = veiKm(d, m, inn);
          return `<td>${t === null ? '–' : `${fmt(t, 1)} t <small class="dempet">${fmt(km)} km · ${fmt(inn.bilTimer / t, 1)} lass/dag</small>`}</td>`;
        }).join('')}</tr>`).join('')}
      </tbody></table></div>
    </section>`;
}

function lagSkjema(l) {
  return `<form method="dialog" class="skjema" data-skjema="lag" data-id="${l.id}">
    <h2>${l.navn ? esc(l.navn) : 'Nytt maskinlag'}</h2>
    ${tekstFelt('navn', 'Navn', l.navn, 'required')}
    <div class="rad">
      ${valgFelt('maskin', 'Maskinstørrelse', l.maskin, MASKINSTORRELSE)}
      ${tallFelt('timer', 'Effektive timer per dag (G15)', l.timer, 'min="1" max="24"')}
      ${tallFelt('flyttDager', 'Dager for å flytte mellom drifter', l.flyttDager, 'min="0"')}
      ${tekstFelt('start', 'Ledig fra', l.start, 'type="date"')}
    </div>
    <p class="dempet">Ett skift gir vanligvis 8–9 G15-timer. Med to skift settes 15–17.</p>
    <div class="knapper">${plan.lag.some((x) => x.id === l.id) ? '<button class="knapp fare" value="slett">Slett</button>' : ''}<span></span>
      <button class="knapp sekundar" value="avbryt" formnovalidate>Avbryt</button><button class="knapp" value="lagre">Lagre</button></div>
  </form>`;
}

// ---------- Mottak ----------
function mottakSide(r) {
  return `
    <div class="verktoy"><h1>Mottak og leveranseavtaler</h1><button class="knapp" data-handling="nytt-mottak">+ Nytt mottak</button></div>
    <p class="dempet">Sagbruk, massevirkefabrikker, terminaler og energianlegg. Kvoten er det kjøperen tar imot per uke etter avtalen.
    Har mottaket salgsordrer, styrer de mengden: ordrevolumet fordeles jevnt per uke i ordreperioden, per sortiment.</p>
    <section class="kort"><div class="tabell-rull"><table class="tabell"><thead><tr><th>Mottak</th><th>Sortimenter</th><th>Kvote/uke</th><th>Levert</th><th>Av avtalt</th><th></th></tr></thead><tbody>
      ${plan.mottak.map((m) => {
        const x = r.mottak.find((y) => y.id === m.id) || {};
        const so = (plan.ordre?.so || []).filter((o) => o.mottak === m.id && o.linjer?.length);
        return `<tr><td><b>${esc(m.navn)}</b>${so.map((o) => `<span class="ordremerke so">SO ${esc(o.ordrenr || 'utkast')}</span>`).join('')}</td><td><small>${(m.sortimenter || []).map((id) => sortiment(id)?.navn).join(', ')}</small></td><td>${so.length ? '<small>Etter salgsordre</small>' : `${fmt(+m.kvote)} m³`}</td>
          <td>${fmt(x.levert)} m³</td><td>${x.andel === null || x.andel === undefined ? '–' : `<span class="maler"><i style="width:${Math.min(100, 100 * x.andel)}%"></i></span> ${fmt(100 * x.andel)} %`}</td>
          <td><button class="knapp liten" data-handling="rediger-mottak" data-id="${m.id}">Endre</button></td></tr>`;
      }).join('')}
    </tbody></table></div></section>`;
}

function mottakSkjema(m) {
  return `<form method="dialog" class="skjema" data-skjema="mottak" data-id="${m.id}">
    <h2>${m.navn ? esc(m.navn) : 'Nytt mottak'}</h2>
    ${tekstFelt('navn', 'Navn', m.navn, 'required')}
    <fieldset><legend>Tar imot</legend><div class="avkrysning">
      ${SORTIMENTER.map((s) => `<label><input type="checkbox" name="s_${s.id}" ${m.sortimenter?.includes(s.id) ? 'checked' : ''}> ${s.navn}</label>`).join('')}
    </div></fieldset>
    <div class="rad">${tallFelt('kvote', 'Kvote per uke (m³)', m.kvote, 'min="0"')}${tallFelt('lat', 'Breddegrad', m.lat)}${tallFelt('lon', 'Lengdegrad', m.lon)}</div>
    <div class="knapper">${plan.mottak.some((x) => x.id === m.id) ? '<button class="knapp fare" value="slett">Slett</button>' : ''}<span></span>
      <button class="knapp sekundar" value="avbryt" formnovalidate>Avbryt</button><button class="knapp" value="lagre">Lagre</button></div>
  </form>`;
}

// ---------- Ordre (VSYS Virkeshandel) ----------
let sisteImport = null;
let sisteFil = '';

function ordreSide(r) {
  const o = plan.ordre || { io: [], so: [], po: [] };
  const navnDrift = Object.fromEntries(plan.drifter.map((d) => [d.id, d.navn]));
  const navnMottak = Object.fromEntries(plan.mottak.map((m) => [m.id, m.navn]));
  const navnLag = Object.fromEntries(plan.lag.map((l) => [l.id, l.navn]));
  const soNr = Object.fromEntries((o.so || []).map((x) => [x.id, x.ordrenr || 'utkast']));
  const ioNr = Object.fromEntries((o.io || []).map((x) => [x.id, x.ordrenr || 'utkast']));
  const resD = Object.fromEntries(r.drifter.map((d) => [d.id, d]));
  const pst = (a, b) => (b ? `${fmt((100 * a) / b)} %` : '–');
  const linjeTekst = (l, medSo) => `${esc(sortiment(l.sortiment)?.kort || l.sortiment)} ${fmt(+l.volum)}${medSo && (l.so || l.soNr) ? ` → SO ${esc(soNr[l.so] || l.soNr)}` : ''}`;
  const tomt = !o.io?.length && !o.so?.length && !o.po?.length;

  const imp = sisteImport ? `<div class="importsvar ${sisteImport.feil ? 'v-feil' : ''}">${sisteImport.feil ? `⛔ ${esc(sisteImport.feil)}` : `
    ✅ Leste ${sisteImport.rader} rader: ${sisteImport.io} innkjøpsordre, ${sisteImport.so} salgsordre, ${sisteImport.po} produksjonsordre.
    ${sisteImport.nyeDrifter.length ? `<br>Nye drifter: ${esc(sisteImport.nyeDrifter.join(', '))}. Fyll inn driftsforhold og koordinater under Drifter.` : ''}
    ${sisteImport.nyeMottak.length ? `<br>Nye mottak: ${esc(sisteImport.nyeMottak.join(', '))}. Legg inn koordinater under Mottak.` : ''}
    ${sisteImport.nyeLag.length ? `<br>Nye maskinlag: ${esc(sisteImport.nyeLag.join(', '))}.` : ''}
    ${sisteImport.hoppetOver ? `<br>${sisteImport.hoppetOver} rader uten ordrenummer ble hoppet over.` : ''}
    <br><small class="dempet">Gjenkjente kolonner: ${Object.entries(sisteImport.kolonner).map(([k, v]) => `${k} = «${esc(v)}»`).join(', ')}</small>`}
    ${sisteImport.ukjenteSortimenter?.length ? `
      <form class="skjema innebygd koder" data-skjema="sortimentkoder">
        <p><b>Ukjente sortimenter.</b> Velg hva de tilsvarer og les inn filen på nytt:</p>
        <div class="rad">${sisteImport.ukjenteSortimenter.map((k) => `<label>${esc(k)}<select name="k_${esc(k)}"><option value="">– hopp over –</option>${SORTIMENTER.map((x) => `<option value="${x.id}">${x.navn}</option>`).join('')}</select></label>`).join('')}</div>
        <button class="knapp liten">Lagre koder</button>
      </form>` : ''}</div>` : '';

  return `
    <div class="verktoy"><h1>Ordre fra Skogdata VSYS Virkeshandel</h1></div>
    <p class="ingress">Planen henger sammen med ordrekjeden i Virkeshandel. <b>Innkjøpsordren</b> (IO) mot skogeier gir volum per sortiment på drifta.
      <b>Produksjonsordren</b> (PO) gir maskinlag og datoer, og faktisk produsert, framkjørt og transportert er startpunktet for resten.
      <b>Salgsordren</b> (SO) mot kunde bestemmer hvor mye mottaket tar imot per uke og sortiment i ordreperioden. En IO-linje som er koblet til en SO, leveres bare dit.</p>
    <section class="kort">
      <h2>Inn og ut av VSYS</h2>
      <div class="knapper venstre">
        <label class="knapp">Les inn ordre (CSV)<input type="file" accept=".csv,text/csv,.txt" data-handling="import-ordre" hidden></label>
        <label class="valg-type">Hvis filen mangler ordretype, er radene
          <select id="ordretype">${Object.entries(ORDRETYPER).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      </div>
      <div class="knapper venstre">
        <button class="knapp sekundar" data-handling="ordre-csv">Last ned ordreplan (CSV)</button>
        <button class="knapp sekundar" data-handling="ordre-utkast">Lag ordreutkast fra planen</button>
        <button class="knapp sekundar" data-handling="ordre-mal">Last ned mal</button>
      </div>
      <p class="dempet">Ta ut ordrene fra VH-klienten eller replikadatabasen som CSV (eller lagre som CSV fra Excel). Én rad per ordrelinje. Kolonnenavn som
        Ordrenr, Ordretype, Leverandør/Skogeier, Kunde, Hentested, Leveringssted, Sortiment, Volum, Pris, Fra, Til, Salgsordre (kobling), Entreprenør,
        Innkjøpsordre, Produsert, Framkjørt, Transportert og Statusdato blir gjenkjent. Ordre med samme nummer oppdateres, så du kan lese inn på nytt hver dag.</p>
      ${imp}
    </section>
    ${tomt ? '<section class="kort"><p>Ingen ordre ennå. Les inn fra VSYS, eller lag utkast fra planen.</p></section>' : ''}
    ${o.io?.length ? `<section class="kort"><div class="kort-topp"><h2>Innkjøpsordre (IO)</h2><button class="knapp liten" data-handling="ny-ordre" data-type="io">+ Ny IO</button></div>
      <div class="tabell-rull"><table class="tabell"><thead><tr><th>IO</th><th>Leverandør</th><th>Drift</th><th>Linjer m³</th><th>Planlagt levert</th><th>Start</th><th>Framkjørt</th><th>Siste lass</th><th></th></tr></thead><tbody>
      ${o.io.map((x) => { const rr = r.ordre.io.find((y) => y.id === x.id) || {}; return `<tr><td><b>${esc(x.ordrenr || 'utkast')}</b><br><small class="dempet">${esc(x.status || '')}</small></td>
        <td>${esc(x.leverandor || '')}<br><small class="dempet">${esc(x.eiendom || '')}</small></td><td>${esc(navnDrift[x.drift] || '–')}</td>
        <td><small>${(x.linjer || []).map((l) => linjeTekst(l, true)).join('<br>')}</small></td>
        <td>${fmt(rr.levert)} <small class="dempet">${pst(rr.levert, rr.volum)}</small></td><td>${dato(rr.start)}</td><td>${dato(rr.framkjortFerdig)}</td><td>${dato(rr.sisteLevering)}</td>
        <td><button class="knapp liten" data-handling="rediger-ordre" data-type="io" data-id="${x.id}">Endre</button></td></tr>`; }).join('')}
      </tbody></table></div></section>` : ''}
    ${o.po?.length ? `<section class="kort"><div class="kort-topp"><h2>Produksjonsordre (PO)</h2><button class="knapp liten" data-handling="ny-ordre" data-type="po">+ Ny PO</button></div>
      <div class="tabell-rull"><table class="tabell"><thead><tr><th>PO</th><th>Entreprenør / lag</th><th>Drift</th><th>IO</th><th>Faktisk (prod./framk./transp.)</th><th>Planlagt start</th><th>Hogst ferdig</th><th>Framkjørt</th><th></th></tr></thead><tbody>
      ${o.po.map((x) => { const rr = r.ordre.po.find((y) => y.id === x.id) || {}; const f = x.faktisk; const dr = resD[rr.drift] || {}; return `<tr><td><b>${esc(x.ordrenr || 'utkast')}</b><br><small class="dempet">${esc(x.status || '')}</small></td>
        <td>${esc(x.entreprenor || '')}${navnLag[x.lag] && navnLag[x.lag] !== x.entreprenor ? `<br><small class="dempet">${esc(navnLag[x.lag])}</small>` : ''}</td><td>${esc(navnDrift[rr.drift] || '–')}</td><td>${esc(ioNr[x.io] || '–')}</td>
        <td>${f ? `${fmt(+f.produsert)} / ${fmt(+f.framkjort)} / ${fmt(+f.transportert)} <small class="dempet">${dato(f.dato)}</small>` : '–'}<br><small class="dempet">${dr.tot ? `av ${fmt(dr.tot)} m³` : ''}</small></td>
        <td>${dato(rr.start)}</td><td>${dato(rr.hogstFerdig)}</td><td>${dato(rr.framkjortFerdig)}</td>
        <td><button class="knapp liten" data-handling="rediger-ordre" data-type="po" data-id="${x.id}">Endre</button></td></tr>`; }).join('')}
      </tbody></table></div></section>` : ''}
    ${o.so?.length ? `<section class="kort"><div class="kort-topp"><h2>Salgsordre (SO)</h2><button class="knapp liten" data-handling="ny-ordre" data-type="so">+ Ny SO</button></div>
      <div class="tabell-rull"><table class="tabell"><thead><tr><th>SO</th><th>Kunde</th><th>Leveringssted</th><th>Periode</th><th>Linjer m³</th><th>Planlagt innen perioden</th><th>Verdi</th><th></th></tr></thead><tbody>
      ${o.so.map((x) => { const rr = r.ordre.so.find((y) => y.id === x.id) || {}; return `<tr><td><b>${esc(x.ordrenr || 'utkast')}</b><br><small class="dempet">${esc(x.status || '')}</small></td>
        <td>${esc(x.kunde || '')}</td><td>${esc(navnMottak[x.mottak] || '–')}</td><td><small>${dato(x.fra)} – ${dato(x.til)}</small></td>
        <td><small>${(x.linjer || []).map((l) => linjeTekst(l)).join('<br>')}</small></td>
        <td class="${rr.volum && rr.innenPeriode < rr.volum * 0.98 ? 'lav' : ''}">${fmt(rr.innenPeriode)} <small class="dempet">av ${fmt(rr.volum)} · ${pst(rr.innenPeriode, rr.volum)}</small></td>
        <td>${rr.verdi ? `${fmt(rr.verdi)} kr` : '–'}</td>
        <td><button class="knapp liten" data-handling="rediger-ordre" data-type="so" data-id="${x.id}">Endre</button></td></tr>`; }).join('')}
      </tbody></table></div></section>` : ''}
    ${!tomt ? `<div class="knapper venstre">${['io', 'po', 'so'].filter((t) => !o[t]?.length).map((t) => `<button class="knapp sekundar liten" data-handling="ny-ordre" data-type="${t}">+ Ny ${ORDRETYPER[t].toLowerCase()}</button>`).join('')}
      <button class="knapp fare liten" data-handling="slett-alle-ordre">Fjern alle ordre</button></div>` : ''}`;
}

function ordreSkjema(type, x) {
  const valg = (liste) => Object.fromEntries([['', '– velg –'], ...liste.map((v) => [v.id, v.navn])]);
  const soValg = Object.fromEntries([['', '– ingen kobling –'], ...(plan.ordre?.so || []).map((s) => [s.id, `SO ${s.ordrenr || 'utkast'} – ${s.kunde || ''}`])]);
  const linje = (sid) => (x.linjer || []).find((l) => l.sortiment === sid) || {};
  const felles = `<div class="rad">${tekstFelt('ordrenr', 'Ordrenr i VSYS', x.ordrenr)}${tekstFelt('status', 'Status', x.status)}
    ${tekstFelt('fra', type === 'po' ? 'Tidligst start' : 'Fra', x.fra, 'type="date"')}${tekstFelt('til', type === 'po' ? 'Ferdig innen' : 'Til', x.til, 'type="date"')}</div>`;
  let innhold = '';
  if (type === 'io') {
    innhold = `<div class="rad">${tekstFelt('leverandor', 'Leverandør / skogeier', x.leverandor)}${tekstFelt('eiendom', 'Eiendom (gnr/bnr)', x.eiendom)}${valgFelt('drift', 'Drift (hentested)', x.drift, valg(plan.drifter))}</div>
      <fieldset><legend>Linjer</legend><table class="tabell linjer"><thead><tr><th>Sortiment</th><th>Volum m³</th><th>Pris kr/m³</th><th>Koblet salgsordre</th></tr></thead><tbody>
      ${SORTIMENTER.map((so) => { const l = linje(so.id); return `<tr><td>${so.navn}</td><td><input type="number" name="v_${so.id}" value="${esc(l.volum ?? '')}" min="0" step="any"></td><td><input type="number" name="p_${so.id}" value="${esc(l.pris || '')}" min="0" step="any"></td>
        <td><select name="s_${so.id}">${Object.entries(soValg).map(([k, v]) => `<option value="${k}" ${k === (l.so || '') ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></td></tr>`; }).join('')}
      </tbody></table></fieldset>`;
  } else if (type === 'so') {
    innhold = `<div class="rad">${tekstFelt('kunde', 'Kunde', x.kunde)}${valgFelt('mottak', 'Leveringssted (mottak)', x.mottak, valg(plan.mottak))}</div>
      <fieldset><legend>Linjer</legend><table class="tabell linjer"><thead><tr><th>Sortiment</th><th>Volum m³ i perioden</th><th>Pris kr/m³</th></tr></thead><tbody>
      ${SORTIMENTER.map((so) => { const l = linje(so.id); return `<tr><td>${so.navn}</td><td><input type="number" name="v_${so.id}" value="${esc(l.volum ?? '')}" min="0" step="any"></td><td><input type="number" name="p_${so.id}" value="${esc(l.pris || '')}" min="0" step="any"></td></tr>`; }).join('')}
      </tbody></table></fieldset>`;
  } else {
    const f = x.faktisk || {};
    const ioValg = Object.fromEntries([['', '– ingen –'], ...(plan.ordre?.io || []).map((i) => [i.id, `IO ${i.ordrenr || 'utkast'} – ${i.leverandor || ''}`])]);
    innhold = `<div class="rad">${tekstFelt('entreprenor', 'Entreprenør', x.entreprenor)}${valgFelt('lag', 'Maskinlag', x.lag, valg(plan.lag))}${valgFelt('drift', 'Drift', x.drift, valg(plan.drifter))}${valgFelt('io', 'Innkjøpsordre', x.io, ioValg)}</div>
      <fieldset><legend>Faktisk så langt (fra produksjonsmodulen)</legend><div class="rad">
        ${tallFelt('produsert', 'Produsert m³', f.produsert ?? '', 'min="0"')}${tallFelt('framkjort', 'Framkjørt m³', f.framkjort ?? '', 'min="0"')}
        ${tallFelt('transportert', 'Transportert m³', f.transportert ?? '', 'min="0"')}${tallFelt('innmalt', 'Innmålt m³', f.innmalt ?? '', 'min="0"')}
        ${tekstFelt('statusdato', 'Per dato', f.dato || '', 'type="date"')}</div>
        <p class="dempet">Planen regner resten fra disse tallene: det som er produsert men ikke framkjørt ligger i skogen, og det som er framkjørt men ikke transportert ligger ved velteplassen.</p></fieldset>`;
  }
  return `<form method="dialog" class="skjema" data-skjema="ordre" data-type="${type}" data-id="${x.id}">
    <h2>${ORDRETYPER[type]} ${esc(x.ordrenr || '')}</h2>${felles}${innhold}
    <div class="knapper">${(plan.ordre?.[type] || []).some((y) => y.id === x.id) ? '<button class="knapp fare" value="slett">Slett</button>' : ''}<span></span>
      <button class="knapp sekundar" value="avbryt" formnovalidate>Avbryt</button><button class="knapp" value="lagre">Lagre</button></div>
  </form>`;
}

function lesOrdre(f, type, gammel) {
  const g = (n) => f.elements[n]?.value ?? '';
  const o = { ...gammel, ordrenr: g('ordrenr').trim(), status: g('status').trim(), fra: g('fra'), til: g('til') };
  if (type === 'io' || type === 'so') {
    o.linjer = SORTIMENTER.filter((s) => +g(`v_${s.id}`) > 0).map((s) => ({ sortiment: s.id, volum: +g(`v_${s.id}`), pris: +g(`p_${s.id}`) || 0, ...(type === 'io' && g(`s_${s.id}`) ? { so: g(`s_${s.id}`) } : {}) }));
  }
  if (type === 'io') Object.assign(o, { leverandor: g('leverandor').trim(), eiendom: g('eiendom').trim(), drift: g('drift') });
  if (type === 'so') {
    Object.assign(o, { kunde: g('kunde').trim(), mottak: g('mottak') });
    const m = plan.mottak.find((x) => x.id === o.mottak);
    if (m) for (const l of o.linjer) if (!m.sortimenter.includes(l.sortiment)) m.sortimenter.push(l.sortiment);
  }
  if (type === 'po') {
    Object.assign(o, { entreprenor: g('entreprenor').trim(), lag: g('lag'), drift: g('drift'), io: g('io') });
    const fk = { produsert: +g('produsert') || 0, framkjort: +g('framkjort') || 0, transportert: +g('transportert') || 0, innmalt: +g('innmalt') || 0, dato: g('statusdato') };
    o.faktisk = fk.produsert || fk.framkjort || fk.transportert || fk.innmalt ? fk : undefined;
  }
  return o;
}

// ---------- Leveranseplan ----------
function leveranseSide(r) {
  const navnDrift = Object.fromEntries(plan.drifter.map((d) => [d.id, d.navn]));
  return `
    <div class="verktoy"><h1>Leveranseplan</h1><span>
      <button class="knapp sekundar" data-handling="csv">Last ned CSV</button>
      <button class="knapp sekundar" data-handling="skriv">Skriv ut</button></span></div>
    <section class="kort"><h2>Per mottak og uke (m³)</h2>
      <p class="dempet">Prosent av ukekvoten. Lav prosent betyr at kjøperen får mindre enn avtalt, og høy at kapasiteten er brukt opp.</p>
      <div class="tabell-rull"><table class="tabell"><thead><tr><th>Uke</th><th>Mandag</th>${plan.mottak.map((m) => `<th>${esc(m.navn)}</th>`).join('')}<th>Lass</th></tr></thead><tbody>
      ${r.uker.map((u) => `<tr><td>${u.uke}${u.sesong.tele ? ' <small class="merke-tele">tele</small>' : u.sesong.vinter ? ' <small class="merke-vinter">vinter</small>' : u.sesong.sommer ? ' <small class="merke-sommer">sommer</small>' : ''}</td><td>${dato(u.mandag)}</td>
        ${plan.mottak.map((m) => { const v = u.perMottak[m.id] || 0; const k = u.kvote[m.id] || 0; const p = k ? v / k : 0; return `<td class="${k > 0 && p < 0.5 ? 'lav' : ''}">${fmt(v)} <small class="dempet">${k ? fmt(100 * p) + ' %' : ''}</small></td>`; }).join('')}
        <td>${u.lass}</td></tr>`).join('')}
      </tbody></table></div>
    </section>
    <section class="kort"><h2>Per drift</h2>
      <div class="tabell-rull"><table class="tabell"><thead><tr><th>Drift</th><th>Volum</th><th>Hogst start</th><th>Hogst ferdig</th><th>Framkjørt</th><th>Siste lass</th><th>Levert</th><th>Igjen</th></tr></thead><tbody>
      ${r.drifter.map((d) => `<tr><td>${esc(navnDrift[d.id])}</td><td>${fmt(d.tot)}</td><td>${dato(d.start)}</td><td>${dato(d.hogstFerdig)}</td><td>${dato(d.framkjortFerdig)}</td><td>${dato(d.sisteLevering)}</td><td>${fmt(d.levert)}</td><td>${fmt(d.tot - d.levert)}</td></tr>`).join('')}
      </tbody></table></div>
    </section>`;
}

// ---------- Innstillinger ----------
function innstillingSide() {
  const inn = { ...STANDARD_INNSTILLINGER, ...plan.innstillinger };
  return `
    <h1>Innstillinger</h1>
    <form class="skjema innebygd" data-skjema="innstillinger">
      <section class="kort"><h2>Planperiode</h2><div class="rad">
        ${tekstFelt('startdato', 'Startdato', inn.startdato, 'type="date"')}
        ${tallFelt('uker', 'Antall uker', inn.uker, 'min="1" max="104"')}
        ${tallFelt('arbeidsdager', 'Hogstdager per uke', inn.arbeidsdager, 'min="1" max="7"')}
      </div></section>
      <section class="kort"><h2>Sesonger (ISO-uke)</h2>
        <p class="dempet">Teleløsningen varierer med år og sted. Følg med på kommunens og fylkets aksellastlister og skilting.</p>
        <div class="rad">
          ${tallFelt('vinterFra', 'Vinter (frost) fra uke', inn.vinterFra, 'min="1" max="53"')}${tallFelt('vinterTil', 'til uke', inn.vinterTil, 'min="1" max="53"')}
          ${tallFelt('teleFra', 'Teleløsning fra uke', inn.teleFra, 'min="1" max="53"')}${tallFelt('teleTil', 'til uke', inn.teleTil, 'min="1" max="53"')}
          ${tallFelt('sommerFra', 'Sommer fra uke', inn.sommerFra, 'min="1" max="53"')}${tallFelt('sommerTil', 'til uke', inn.sommerTil, 'min="1" max="53"')}
        </div></section>
      <section class="kort"><h2>Lagring ved velteplass</h2><div class="rad">
        ${tallFelt('maksLagringSommer', 'Maks dager om sommeren (sagtømmer og gran)', inn.maksLagringSommer, 'min="1"')}
        ${tallFelt('maksLagring', 'Maks dager ellers', inn.maksLagring, 'min="1"')}
      </div><p class="dempet">Om sommeren gir lang lagring blåved i sagtømmer og yngleplass for granbarkbille. Avtal grensene med tømmerkjøperen.</p></section>
      <section class="kort"><h2>Kalibrering av maskiner</h2>
        <p class="dempet">Hogstmaskin: m³ per G15-time = A × middelstamme<sup>B</sup> (sluttavvirkning, middels maskin, lett terreng). Juster mot entreprenørens egne tall.</p>
        <div class="rad">
          ${tallFelt('hogstA', 'A', inn.hogstA, 'min="1"')}${tallFelt('hogstB', 'B', inn.hogstB, 'min="0.1" max="1.5"')}
          ${tallFelt('tynningFaktor', 'Faktor tynning', inn.tynningFaktor, 'min="0.1" max="1.5"')}
          ${tallFelt('lassbererFart', 'Lassbærer snittfart (km/t)', inn.lassbererFart, 'min="0.5"')}
        </div></section>
      <button class="knapp">Lagre innstillinger</button>
    </form>
    <section class="kort"><h2>Data</h2>
      <p class="dempet">Planen lagres bare i denne nettleseren. Ta sikkerhetskopi for å flytte den til en annen enhet.</p>
      <div class="knapper venstre">
        <button class="knapp sekundar" data-handling="eksport">Last ned sikkerhetskopi (JSON)</button>
        <label class="knapp sekundar">Les inn sikkerhetskopi<input type="file" accept="application/json,.json" data-handling="import" hidden></label>
        <button class="knapp sekundar" data-handling="demo">Last demo-plan</button>
        <button class="knapp fare" data-handling="tom">Tøm planen</button>
      </div>
    </section>`;
}

// ---------- Hendelser ----------
function apne(html) {
  ark.innerHTML = html;
  ark.showModal();
}

app.addEventListener('click', (e) => {
  const lenke = e.target.closest('.lenke-rediger');
  if (lenke) { e.preventDefault(); const d = plan.drifter.find((x) => x.id === lenke.dataset.drift); if (d) apne(driftSkjema(d)); return; }
  const ol = e.target.closest('.lenke-ordre');
  if (ol) { e.preventDefault(); const [t, id] = ol.dataset.ordre.split(':'); const x = plan.ordre?.[t]?.find((y) => y.id === id); if (x) apne(ordreSkjema(t, x)); return; }
  const b = e.target.closest('[data-handling]');
  if (!b || b.tagName === 'INPUT') return;
  const id = b.dataset.id;
  switch (b.dataset.handling) {
    case 'ny-drift': {
      const lag = plan.lag[0]?.id || '';
      const nr = Math.max(0, ...plan.drifter.filter((d) => d.lag === lag).map((d) => +d.rekkefolge || 0)) + 1;
      apne(driftSkjema({ id: nyId('d'), navn: '', lag, rekkefolge: nr, hogstform: 'slutt', middelstamme: 0.3, terreng: 2, kjoreavstand: 300, vegklasse: 1, skogsbilveiKm: 1, velteplass: 600, fore: 'helaar', volum: {}, lat: '', lon: '', tidligst: '', frist: '' }));
      break;
    }
    case 'rediger-drift': apne(driftSkjema(plan.drifter.find((d) => d.id === id))); break;
    case 'opp': case 'ned': flytt(id, b.dataset.handling === 'opp' ? -1 : 1); break;
    case 'nytt-lag': apne(lagSkjema({ id: nyId('l'), navn: '', maskin: 'middels', timer: 9, flyttDager: 1, start: '' })); break;
    case 'rediger-lag': apne(lagSkjema(plan.lag.find((l) => l.id === id))); break;
    case 'nytt-mottak': apne(mottakSkjema({ id: nyId('m'), navn: '', sortimenter: [], kvote: 300, lat: '', lon: '' })); break;
    case 'rediger-mottak': apne(mottakSkjema(plan.mottak.find((m) => m.id === id))); break;
    case 'ny-ordre': {
      const t = b.dataset.type;
      apne(ordreSkjema(t, { id: `${t}${Math.random().toString(36).slice(2, 8)}`, ordrenr: '', status: '', linjer: [] }));
      break;
    }
    case 'rediger-ordre': apne(ordreSkjema(b.dataset.type, plan.ordre[b.dataset.type].find((x) => x.id === id))); break;
    case 'ordre-csv': last(ordreCsv(plan, res), `ordreplan-${res.start}.csv`, 'text/csv'); break;
    case 'ordre-mal': last('\ufeff' + MAL_CSV, 'vsys-ordre-mal.csv', 'text/csv'); break;
    case 'ordre-utkast': {
      const n = ordreFraPlan(plan, res);
      sisteImport = null;
      alert(`Laget ${n.io} innkjøpsordre, ${n.po} produksjonsordre og ${n.so} salgsordre som utkast. Legg inn ordrenumrene fra VSYS når de er opprettet der.`);
      lagre();
      break;
    }
    case 'slett-alle-ordre': if (confirm('Fjerne alle innkjøps-, salgs- og produksjonsordre fra planen? Drifter og mottak blir stående.')) { plan.ordre = { io: [], so: [], po: [] }; sisteImport = null; lagre(); } break;
    case 'csv': last(leveranseCsv(res, plan), `leveranseplan-${res.start}.csv`, 'text/csv'); break;
    case 'skriv': window.print(); break;
    case 'eksport': last(JSON.stringify(plan, null, 2), `tommerplan-${idag()}.json`, 'application/json'); break;
    case 'demo': if (confirm('Erstatte planen med demo-planen?')) { plan = demoPlan(neste_mandag(idag())); lagre(); } break;
    case 'tom': if (confirm('Slette alle drifter, lag og mottak?')) { plan = { versjon: 1, innstillinger: { startdato: neste_mandag(idag()), uker: 26 }, lag: [], mottak: [], drifter: [], ordre: { io: [], so: [], po: [] }, sortimentkoder: {} }; lagre(); } break;
    default:
  }
});

app.addEventListener('change', async (e) => {
  if (e.target.dataset.handling === 'import-ordre' && e.target.files[0]) {
    const fil = e.target.files[0];
    sisteFil = await fil.text();
    sisteImport = importerOrdre(plan, sisteFil, document.getElementById('ordretype')?.value || 'io');
    lagre();
    return;
  }
  if (e.target.dataset.handling !== 'import' || !e.target.files[0]) return;
  try {
    const p = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(p.drifter)) throw new Error('mangler drifter');
    plan = { versjon: 1, innstillinger: {}, lag: [], mottak: [], ordre: { io: [], so: [], po: [] }, sortimentkoder: {}, ...p };
    lagre();
  } catch (err) { alert(`Kunne ikke lese filen: ${err.message}`); }
});

app.addEventListener('submit', (e) => {
  const f = e.target;
  if (!f.dataset.skjema) return;
  e.preventDefault();
  const tall = (n) => +f.elements[n].value;
  if (f.dataset.skjema === 'sortimentkoder') {
    plan.sortimentkoder ||= {};
    for (const el of f.elements) if (el.name?.startsWith('k_') && el.value) plan.sortimentkoder[el.name.slice(2)] = el.value;
    if (sisteFil) sisteImport = importerOrdre(plan, sisteFil, document.getElementById('ordretype')?.value || 'io');
    lagre();
    return;
  }
  if (f.dataset.skjema === 'biler') {
    for (const n of ['biler', 'bilTimer', 'bilDager', 'lassM3', 'fartVei', 'fartSkogsbilvei', 'lastetid', 'lossetid', 'veifaktor']) plan.innstillinger[n] = tall(n);
  } else if (f.dataset.skjema === 'innstillinger') {
    plan.innstillinger.startdato = f.elements.startdato.value;
    for (const n of ['uker', 'arbeidsdager', 'vinterFra', 'vinterTil', 'teleFra', 'teleTil', 'sommerFra', 'sommerTil', 'maksLagringSommer', 'maksLagring', 'hogstA', 'hogstB', 'tynningFaktor', 'lassbererFart']) plan.innstillinger[n] = tall(n);
  }
  lagre();
});

ark.addEventListener('close', () => {
  const f = ark.querySelector('form');
  const valg = ark.returnValue;
  ark.returnValue = '';
  if (!f || !valg || valg === 'avbryt') return;
  const type = f.dataset.skjema; const id = f.dataset.id;
  if (type === 'ordre') {
    const t = f.dataset.type;
    plan.ordre ||= { io: [], so: [], po: [] };
    const ol = (plan.ordre[t] ||= []);
    const j = ol.findIndex((x) => x.id === id);
    if (valg === 'slett') { if (confirm('Slette ordren?')) { ol.splice(j, 1); lagre(); } return; }
    const ny = lesOrdre(f, t, j >= 0 ? ol[j] : { id });
    if (j >= 0) ol[j] = ny; else ol.push(ny);
    kobleOrdre(plan);
    lagre();
    return;
  }
  const liste = { drift: plan.drifter, lag: plan.lag, mottak: plan.mottak }[type];
  const i = liste.findIndex((x) => x.id === id);
  if (valg === 'slett') {
    if (!confirm('Slette?')) return;
    liste.splice(i, 1);
    if (type === 'lag') plan.drifter.forEach((d) => { if (d.lag === id) d.lag = ''; });
    if (type === 'drift' && plan.ordre) { plan.ordre.io = plan.ordre.io.filter((x) => x.drift !== id); plan.ordre.po = plan.ordre.po.filter((x) => x.drift !== id); }
    if (type === 'mottak' && plan.ordre) plan.ordre.so = plan.ordre.so.filter((x) => x.mottak !== id);
    lagre();
    return;
  }
  if (!f.elements.navn.value.trim()) return;
  let ny;
  if (type === 'drift') {
    const gammel = i >= 0 ? liste[i] : { id, rekkefolge: 999 };
    ny = lesDrift(f, gammel);
    if (gammel.lag !== ny.lag) ny.rekkefolge = Math.max(0, ...plan.drifter.filter((d) => d.lag === ny.lag).map((d) => +d.rekkefolge || 0)) + 1;
  } else if (type === 'lag') {
    ny = { ...(liste[i] || { id }), navn: f.elements.navn.value.trim(), maskin: f.elements.maskin.value, timer: +f.elements.timer.value || 9, flyttDager: +f.elements.flyttDager.value || 0, start: f.elements.start.value };
  } else {
    const n = (x) => (x === '' ? '' : +x);
    ny = { ...(liste[i] || { id }), navn: f.elements.navn.value.trim(), kvote: +f.elements.kvote.value || 0, lat: n(f.elements.lat.value), lon: n(f.elements.lon.value), sortimenter: SORT_ID.filter((s) => f.elements[`s_${s}`].checked) };
  }
  if (i >= 0) liste[i] = ny; else liste.push(ny);
  lagre();
});

function flytt(id, retning) {
  const d = plan.drifter.find((x) => x.id === id);
  const ko = plan.drifter.filter((x) => x.lag === d.lag).sort((a, b) => (+a.rekkefolge || 0) - (+b.rekkefolge || 0));
  const i = ko.indexOf(d); const j = i + retning;
  if (j < 0 || j >= ko.length) return;
  [ko[i], ko[j]] = [ko[j], ko[i]];
  ko.forEach((x, n) => { x.rekkefolge = n + 1; });
  lagre();
}

function last(innhold, filnavn, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([innhold], { type }));
  a.download = filnavn;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

vis();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
