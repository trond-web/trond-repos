// Tømmerplan – produksjonsplanlegger for tømmer. Alt lagres lokalt i nettleseren.
import {
  planlegg, leveranseCsv, hogstRate, lassbererRate, turTimer, veiKm, totalVolum, neste_mandag,
  SORTIMENTER, SORT_ID, sortiment, VEGKLASSER, FORE, HOGSTFORMER, MASKINSTORRELSE, STANDARD_INNSTILLINGER,
} from './motor.js';
import { demoPlan } from './demo.js';
import { maskinplan, stabletSoyle, linjer, forklaring, aktiverTips } from './graf.js';
import { logistikkSide } from './logistikk.js';

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
    if (p && Array.isArray(p.drifter)) return { innstillinger: {}, lag: [], mottak: [], ...p };
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
  ['leveranser', 'Leveranseplan'], ['innstillinger', 'Innstillinger'], ['logistikk', 'God logistikk'],
];
const side = () => (location.hash.replace(/^#\/?/, '') || 'oversikt');
window.addEventListener('hashchange', vis);

function vis() {
  beregn();
  const s = SIDER.some(([id]) => id === side()) ? side() : 'oversikt';
  document.getElementById('faner').innerHTML = SIDER.map(([id, navn]) => `<a href="#/${id}" ${id === s ? 'aria-current="page"' : ''}>${navn}</a>`).join('');
  const feil = res.varsler.filter((v) => v.niva !== 'info').length;
  document.getElementById('topp-status').textContent = `${plan.drifter.length} drifter · ${fmt(res.nokkel.totVolum)} m³${feil ? ` · ${feil} varsler` : ''}`;
  app.innerHTML = { oversikt, drifter: drifterSide, lag: lagSide, mottak: mottakSide, leveranser: leveranseSide, innstillinger: innstillingSide, logistikk: logistikkSide }[s](res);
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
    ? `<ul class="varsler">${r.varsler.map((v) => `<li class="v-${v.niva}"><span class="v-ikon" aria-hidden="true">${NIVA[v.niva][0]}</span><span><b>${NIVA[v.niva][1]}:</b> ${esc(v.tekst)}${v.drift ? ` <a href="#/drifter" data-drift="${v.drift}" class="lenke-rediger">Endre drift</a>` : ''}</span></li>`).join('')}</ul>`
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
              <td><b>${esc(d.navn)}</b><br><small class="dempet">${HOGSTFORMER[d.hogstform] || ''} · midd.st. ${fmt(+d.middelstamme, 2)} m³ · ${fmt(+d.kjoreavstand)} m kjøring</small></td>
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
      <fieldset><legend>Volum per sortiment (m³)</legend><div class="rad6">
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
    <p class="dempet">Sagbruk, massevirkefabrikker, terminaler og energianlegg. Kvoten er det kjøperen tar imot per uke etter avtalen.</p>
    <section class="kort"><div class="tabell-rull"><table class="tabell"><thead><tr><th>Mottak</th><th>Sortimenter</th><th>Kvote/uke</th><th>Levert</th><th>Av avtalt</th><th></th></tr></thead><tbody>
      ${plan.mottak.map((m) => {
        const x = r.mottak.find((y) => y.id === m.id) || {};
        return `<tr><td><b>${esc(m.navn)}</b></td><td><small>${(m.sortimenter || []).map((id) => sortiment(id)?.navn).join(', ')}</small></td><td>${fmt(+m.kvote)} m³</td>
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

// ---------- Leveranseplan ----------
function leveranseSide(r) {
  const navnDrift = Object.fromEntries(plan.drifter.map((d) => [d.id, d.navn]));
  const kvote = Object.fromEntries(plan.mottak.map((m) => [m.id, +m.kvote || 0]));
  return `
    <div class="verktoy"><h1>Leveranseplan</h1><span>
      <button class="knapp sekundar" data-handling="csv">Last ned CSV</button>
      <button class="knapp sekundar" data-handling="skriv">Skriv ut</button></span></div>
    <section class="kort"><h2>Per mottak og uke (m³)</h2>
      <p class="dempet">Prosent av ukekvoten. Lav prosent betyr at kjøperen får mindre enn avtalt, og høy at kapasiteten er brukt opp.</p>
      <div class="tabell-rull"><table class="tabell"><thead><tr><th>Uke</th><th>Mandag</th>${plan.mottak.map((m) => `<th>${esc(m.navn)}</th>`).join('')}<th>Lass</th></tr></thead><tbody>
      ${r.uker.map((u) => `<tr><td>${u.uke}${u.sesong.tele ? ' <small class="merke-tele">tele</small>' : u.sesong.vinter ? ' <small class="merke-vinter">vinter</small>' : u.sesong.sommer ? ' <small class="merke-sommer">sommer</small>' : ''}</td><td>${dato(u.mandag)}</td>
        ${plan.mottak.map((m) => { const v = u.perMottak[m.id] || 0; const p = kvote[m.id] ? v / kvote[m.id] : 0; return `<td class="${v > 0 && p < 0.5 ? 'lav' : ''}">${fmt(v)} <small class="dempet">${kvote[m.id] ? fmt(100 * p) + ' %' : ''}</small></td>`; }).join('')}
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
    case 'csv': last(leveranseCsv(res, plan), `leveranseplan-${res.start}.csv`, 'text/csv'); break;
    case 'skriv': window.print(); break;
    case 'eksport': last(JSON.stringify(plan, null, 2), `tommerplan-${idag()}.json`, 'application/json'); break;
    case 'demo': if (confirm('Erstatte planen med demo-planen?')) { plan = demoPlan(neste_mandag(idag())); lagre(); } break;
    case 'tom': if (confirm('Slette alle drifter, lag og mottak?')) { plan = { versjon: 1, innstillinger: { startdato: neste_mandag(idag()), uker: 26 }, lag: [], mottak: [], drifter: [] }; lagre(); } break;
    default:
  }
});

app.addEventListener('change', async (e) => {
  if (e.target.dataset.handling !== 'import' || !e.target.files[0]) return;
  try {
    const p = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(p.drifter)) throw new Error('mangler drifter');
    plan = { versjon: 1, innstillinger: {}, lag: [], mottak: [], ...p };
    lagre();
  } catch (err) { alert(`Kunne ikke lese filen: ${err.message}`); }
});

app.addEventListener('submit', (e) => {
  const f = e.target;
  if (!f.dataset.skjema) return;
  e.preventDefault();
  const tall = (n) => +f.elements[n].value;
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
  const liste = { drift: plan.drifter, lag: plan.lag, mottak: plan.mottak }[type];
  const i = liste.findIndex((x) => x.id === id);
  if (valg === 'slett') {
    if (!confirm('Slette?')) return;
    liste.splice(i, 1);
    if (type === 'lag') plan.drifter.forEach((d) => { if (d.lag === id) d.lag = ''; });
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
