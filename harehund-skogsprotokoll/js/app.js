// Skogsprotokoll for harehundprøver – grensesnitt. All logikk for poeng og regler ligger i regler.js.
import {
  LOSDYR, LOVLIGE_LOSDYR, RASER, MOMENTER, TILLEGG, SKALA, UTFALL, KOBLINGSGRUNNER, HENDELSER, MIN,
  beregn, beregnEP, gruppeForRase, alderMnd, klokke, fmtTid, forslagTilleggsopplysninger, sorterHendelser, kravTabell,
} from './regler.js';

const NOKKEL = 'harehund-skogsprotokoll-v1';
const app = document.getElementById('app');
const ark = document.getElementById('ark');

// ---------- Lagring (bare i denne nettleseren) ----------
let data = { prover: [] };
try { data = JSON.parse(localStorage.getItem(NOKKEL)) || data; } catch { /* privat modus e.l. */ }
if (!Array.isArray(data.prover)) data.prover = [];
let lagreFeilet = false;
function lagre() {
  try { localStorage.setItem(NOKKEL, JSON.stringify(data)); lagreFeilet = false; } catch { lagreFeilet = true; }
}

const nyId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const iDag = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const finn = (id) => data.prover.find((p) => p.id === id);
const datoNo = (d) => (d ? new Date(`${d}T12:00`).toLocaleDateString('no-NO', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const vibrer = (ms = 25) => { try { navigator.vibrate?.(ms); } catch { /* ikke støttet */ } };

function nyProve(mal = {}) {
  return {
    id: nyId(), opprettet: Date.now(), type: 'ÅP', dag: 1, epPar: null,
    refnr: '', katnr: '', arrangor: '', dato: iDag(), dommer: '', dommerNr: '', elev: '', terreng: '', mark: 'Snø', vaer: '', temp: '',
    hund: { navn: '', regnr: '', idnr: '', rase: '', gruppe: 'stover', kjonn: '', fodt: '', boghoyde: '', idKontrollert: false },
    eier: '', forer: '', forerTlf: '', peil: false, gps: false,
    hendelser: [], poeng: {}, mal: '', utfall: null, ikkeStartet: false, premielos: null, losValg: {},
    tilleggsopplysninger: '', rr: '', signaturDommer: '', signaturForer: '',
    ...mal,
  };
}

function erLive(p) {
  const r = beregn(p);
  return !r.logg.avsluttet && p.dato === iDag() && p.hendelser.length > 0;
}
const beregnNaa = (p) => beregn(p, erLive(p) ? Date.now() : null);

// ---------- Ruting ----------
function rute() {
  const [, side, id, fane] = location.hash.split('/');
  stoppTikk();
  if (side === 'prove' && finn(id)) return visProve(finn(id), fane || 'skog');
  return visListe();
}
window.addEventListener('hashchange', rute);

// ---------- Oversikt ----------
function visListe() {
  document.getElementById('topp-status').textContent = '';
  delete app.dataset.prove;
  delete app.dataset.fane;
  const prover = [...data.prover].sort((a, b) => (b.dato || '').localeCompare(a.dato || '') || b.opprettet - a.opprettet);
  app.innerHTML = `
    <section class="kort intro">
      <h1>Skogsprotokoll for harehundprøver</h1>
      <p>Før loggen i skogen med store knapper – slipp, fot, uttak, tap, gjentak, LUH og kobling. Appen strekker losminutter,
      regner lospoeng, tilleggsregistreringer, egenskapspoeng og premiegrad etter NHKFs jaktprøveregler (gjeldende fra 01.07.2025),
      og lager en ferdig utfylt jaktprøveprotokoll. Alt lagres på telefonen og virker uten dekning.</p>
      <div class="knapperad">
        <button class="knapp primar" data-handling="ny">+ Ny prøve</button>
        <button class="knapp" data-handling="eksempel">Vis eksempel</button>
        <label class="knapp">Importer…<input type="file" accept="application/json,.json" data-handling="importer" hidden></label>
      </div>
      ${lagreFeilet ? '<p class="varsel feil">Klarte ikke å lagre i nettleseren. Eksporter protokollen før du lukker appen.</p>' : ''}
    </section>
    ${prover.length ? `<section class="liste">${prover.map(listeKort).join('')}</section>`
    : '<p class="tom">Ingen prøver ennå. Trykk «Ny prøve» når du har fått hund og terreng.</p>'}
    <p class="fot">Bygger på «Regler for jaktprøver for hunder tilsluttet NHKF», gjeldende fra 01.07.2025. Dommerkollegiet fastsetter endelig premiering.
    Utviklet av Trond Harald Sand.</p>`;
}

function listeKort(p) {
  const r = beregn(p);
  const status = r.logg.avsluttet ? (r.utfall ? r.utfall : r.premiegrad ? `${r.premiegrad}. premie` : '0 premie') : p.hendelser.length ? 'Pågår' : 'Ikke startet';
  return `<a class="kort prove-kort" href="#/prove/${p.id}/${p.hendelser.length ? 'skog' : 'info'}">
    <div><strong>${esc(p.hund.navn || 'Uten navn')}</strong> <span class="dempet">${esc(p.hund.rase)} ${esc(p.hund.regnr)}</span></div>
    <div class="dempet">${datoNo(p.dato)} · ${esc(p.type)}${p.type === 'EP' ? ` dag ${p.dag}` : ''}${p.terreng ? ` · ${esc(p.terreng)}` : ''}</div>
    <div class="prove-tall"><span class="merkelapp ${r.premiegrad ? `p${r.premiegrad}` : ''}">${esc(status)}</span>
    <span>LP ${r.lospoeng} · EP ${r.egenskapspoeng} · PP ${r.premiepoeng}</span></div>
  </a>`;
}

// ---------- Prøve med faner ----------
const FANER = [['info', 'Hund og prøve'], ['skog', 'Skog'], ['poeng', 'Bedømming'], ['protokoll', 'Protokoll']];

function visProve(p, fane) {
  const r = beregnNaa(p);
  document.getElementById('topp-status').textContent = `${p.hund.navn || 'Prøve'} · ${datoNo(p.dato)}`;
  const innhold = { info: infoFane, skog: skogFane, poeng: poengFane, protokoll: protokollFane }[fane] || skogFane;
  app.innerHTML = `
    <nav class="faner">${FANER.map(([id, navn]) => `<a href="#/prove/${p.id}/${id}" class="${id === fane ? 'aktiv' : ''}">${navn}</a>`).join('')}</nav>
    <div id="fane">${innhold(p, r)}</div>`;
  app.dataset.prove = p.id;
  app.dataset.fane = fane;
  if (fane === 'skog') startTikk(p);
  if (fane === 'protokoll') klargjorSignaturer(p);
}

function oppdater(p, tegnPaaNytt = true) {
  lagre();
  if (tegnPaaNytt) {
    const y = window.scrollY;
    visProve(p, app.dataset.fane);
    window.scrollTo(0, y);
  }
}

// ---------- Fane: hund og prøve ----------
function felt(navn, etikett, verdi, type = 'text', ekstra = '') {
  return `<label class="felt"><span>${etikett}</span><input type="${type}" name="${navn}" value="${esc(verdi)}" ${ekstra}></label>`;
}
function velg(navn, etikett, verdi, valg) {
  return `<label class="felt"><span>${etikett}</span><select name="${navn}">${valg.map(([v, t]) => `<option value="${esc(v)}" ${v === verdi ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
}

function infoFane(p) {
  const h = p.hund;
  const alder = alderMnd(h.fodt, p.dato);
  const ep = p.type === 'EP';
  const par = p.epPar ? finn(p.epPar) : data.prover.find((x) => x.epPar === p.id);
  return `
  <form class="kort skjema" data-skjema="info">
    <h2>Hunden</h2>
    <div class="rutenett">
      ${felt('hund.navn', 'Hundens navn', h.navn)}
      ${felt('hund.regnr', 'Reg.nr.', h.regnr, 'text', 'placeholder="NO12345/22"')}
      ${felt('hund.idnr', 'ID-nr. (chip)', h.idnr, 'text', 'inputmode="numeric"')}
      <label class="felt"><span>Rase</span><input name="hund.rase" list="raser" value="${esc(h.rase)}"></label>
      ${velg('hund.gruppe', 'Gruppe', h.gruppe, [['stover', 'Støver (hare/rev)'], ['smahund', 'Beagle/drever (småhund)']])}
      ${velg('hund.kjonn', 'Kjønn', h.kjonn, [['', '–'], ['hann', 'Hann'], ['tispe', 'Tispe']])}
      ${felt('hund.fodt', `Født${alder != null ? ` (${alder} mnd på prøvedagen)` : ''}`, h.fodt, 'date')}
      ${h.gruppe === 'smahund' ? felt('hund.boghoyde', 'Boghøyde (cm)', h.boghoyde, 'number', 'step="0.5" inputmode="decimal"') : ''}
      <label class="felt hake"><input type="checkbox" name="hund.idKontrollert" ${h.idKontrollert ? 'checked' : ''}> ID kontrollert</label>
    </div>
    <datalist id="raser">${RASER.map(([r]) => `<option value="${esc(r)}">`).join('')}</datalist>
    ${alder != null && alder < 15 ? '<p class="varsel feil">Hunden må være fylt 15 måneder senest på prøvedagen.</p>' : ''}
    <h2>Eier og fører</h2>
    <div class="rutenett">
      ${felt('eier', 'Eier', p.eier)}
      ${felt('forer', 'Fører', p.forer)}
      ${felt('forerTlf', 'Førers telefon', p.forerTlf, 'tel')}
    </div>
    <h2>Prøven</h2>
    <div class="rutenett">
      ${velg('type', 'Prøvetype', p.type, [['ÅP', 'Åpen prøve (ÅP)'], ['SP', 'Småhundprøve (SP)'], ['EP', 'Eliteprøve (EP)'], ['Annen', 'Annen / trening']])}
      ${ep ? velg('dag', 'Prøvedag', String(p.dag), [['1', 'Dag 1'], ['2', 'Dag 2']]) : ''}
      ${felt('dato', 'Dato', p.dato, 'date')}
      ${felt('refnr', 'Prøvens ref.nr.', p.refnr)}
      ${felt('katnr', 'Katalognr.', p.katnr, 'text', 'inputmode="numeric"')}
      ${felt('arrangor', 'Arrangør', p.arrangor)}
      ${felt('dommer', 'Dommer', p.dommer)}
      ${felt('dommerNr', 'Dommernr.', p.dommerNr, 'text', 'inputmode="numeric"')}
      ${felt('elev', 'Elev/aspirant', p.elev)}
      ${felt('terreng', 'Terreng', p.terreng)}
      ${velg('mark', 'Mark', p.mark, [['Snø', 'Snø'], ['Barmark', 'Barmark (minst 2/3 av arealet)']])}
      ${felt('vaer', 'Vær og føre', p.vaer)}
      ${felt('temp', 'Temperatur (°C)', p.temp, 'number', 'inputmode="numeric"')}
    </div>
    ${p.temp !== '' && Number(p.temp) < -15 ? '<p class="varsel advarsel">Under −15 °C bør prøven avlyses (kap. 8). Avsluttes prøven for hunden av den grunn, tildeles U.</p>' : ''}
    <h2>Utstyr</h2>
    <div class="rutenett">
      <label class="felt hake"><input type="checkbox" name="peil" ${p.peil ? 'checked' : ''}> Hunden går med peileutstyr (LPP)</label>
      <label class="felt hake"><input type="checkbox" name="gps" ${p.gps ? 'checked' : ''}> Lagre min GPS-posisjon på hver hendelse</label>
    </div>
    ${ep ? `<h2>Eliteprøve</h2>
      ${par ? `<p>Koblet til <a href="#/prove/${par.id}/protokoll">${esc(par.hund.navn)} dag ${par.dag} (${datoNo(par.dato)})</a>.</p>`
    : p.dag === 1 ? '<button type="button" class="knapp" data-handling="ep-dag2">Opprett dag 2 for samme hund</button>' : ''}
      <p class="dempet">Samme dommer og terreng kan ikke brukes begge dager.</p>` : ''}
    <div class="knapperad">
      <a class="knapp primar" href="#/prove/${p.id}/skog">Til skogen →</a>
      <button type="button" class="knapp fare" data-handling="slett">Slett prøven</button>
    </div>
  </form>`;
}

// ---------- Fane: skog (loggføring) ----------
function tilstandTekst(r) {
  const t = r.logg.tilstand;
  if (r.logg.avsluttet) return ['Prøven er avsluttet', 'av'];
  if (!t.los) return [r.logg.slipp ? 'Hunden er koblet' : 'Ikke sluppet ennå', 'av'];
  if (!t.modus) return [t.fot ? 'Søk – fot påvist' : 'Søk', 'sok'];
  const losdyr = LOSDYR[t.losdyr]?.toLowerCase() || '';
  return {
    hort: [`Los – ${losdyr}`, 'los'], tap: ['Tap', 'tap'], luh: ['Ute av hørehold (LUH)', 'luh'],
    lpp: ['Los på peil (LPP)', 'luh'], slh: ['Stålos (hjort)', 'los'],
  }[t.modus] || ['', ''];
}

function statusKort(p, r) {
  const [tekst, klasse] = tilstandTekst(r);
  const t = r.logg.tilstand;
  const naa = r.logg.ende;
  const pl = r.logg.paagaaende ? r.grupper.find((g) => g.deler.includes(r.logg.paagaaende)) : r.premielos;
  const varighet = t.modus ? fmtKort(naa - t.modusFra) : '';
  const krav = pl ? kravTabell(r.gruppe, pl.losdyr) : null;
  const lp = pl ? pl.lospoeng : 0;
  const maks = pl ? pl.maks : 120;
  return `
    <div class="status ${klasse}">
      <div class="status-topp">
        <div><div class="stor">${klokke(Date.now())}</div><div class="dempet">Løs ${fmtTid(r.logg.losTid)}</div></div>
        <div class="tilstand"><div>${esc(tekst)}</div><div class="stor">${varighet}</div></div>
      </div>
      ${pl && pl.losdyr !== 'ukjent' ? `
      <div class="losmaler">
        <div class="maaler"><div style="width:${Math.min(100, (lp / maks) * 100)}%"></div>
          ${krav ? krav.map((k) => `<i style="left:${(k.los / maks) * 100}%" title="${k.grad}. premie"></i>`).join('') : ''}</div>
        <div class="maaler-tekst"><strong>${lp}</strong> / ${maks} lospoeng ${LOSDYR[pl.losdyr].toLowerCase()}${pl.deler.length > 1 ? ' (sammenslått)' : ''}${pl.libTillegg ? ' inkl. LIB' : ''}
          ${krav ? ` · ${krav.slice().reverse().map((k) => `<span class="${lp >= k.los ? 'nadd' : ''}">${k.grad}.pr ${k.los}</span>`).join(' ')}` : ''}</div>
      </div>` : pl ? `<div class="dempet">Ukjent losdyr: ${pl.hortMin} min</div>` : ''}
      ${r.logg.tilstand.klov ? '<div class="varsel feil">Klovdyrjag pågår!</div>' : ''}
    </div>`;
}
const fmtKort = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); const m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`; };

function handlingsKnapper(p, r) {
  const t = r.logg.tilstand;
  const k = (type, tekst, klasse = '', ekstra = '') => `<button class="hk ${klasse}" data-hendelse="${type}" ${ekstra}>${tekst}</button>`;
  if (r.logg.avsluttet) return '<p class="dempet">Prøven er avsluttet. Du kan fortsatt rette tider i loggen under, eller gå videre til bedømmingen.</p>';
  const knapper = [];
  if (!t.los) {
    knapper.push(k('slipp', 'Slipp', 'primar stor-knapp'));
  } else if (!t.modus) {
    knapper.push(k('uttak', 'Uttak / los', 'primar stor-knapp'), k('fot', t.fot ? 'Ny fot' : 'Fot'), k('kobling', 'Kobling'));
  } else if (t.modus === 'hort' || t.modus === 'slh') {
    knapper.push(k('tap', 'Tap', 'tap stor-knapp'));
    if (t.modus === 'slh') knapper.push(k('stalosSlutt', 'Stålos slutt'));
    knapper.push(k('utav', 'Ut av hørehold', '', 'data-modus="LUH"'));
    if (p.peil) knapper.push(k('utav', 'Los kun på peil', '', 'data-modus="LPP"'));
    knapper.push(k('settLosdyr', 'Losdyr sett'), k('settHund', 'Hund sett'));
    if (t.losdyr === 'hjort' && t.modus === 'hort') knapper.push(k('stalosStart', 'Stålos'));
    knapper.push(k('lib', 'Gått inn (LIB)'), k('slutt', 'Slutt los'), k('kobling', 'Kobling'));
  } else if (t.modus === 'tap') {
    knapper.push(k('gjentak', 'Gjentak', 'primar stor-knapp'), k('slutt', 'Dødtap / slutt los'), k('lib', 'Gått inn (LIB)'), k('kobling', 'Kobling'));
  } else {
    knapper.push(k('inn', 'Inn i hørehold – full los', 'primar stor-knapp'), k('slutt', 'Slutt los'), k('kobling', 'Kobling'));
  }
  knapper.push(t.klov ? k('klovSlutt', 'Klovdyrjag slutt', 'fare') : k('klovStart', 'Klovdyrjag', 'fare-lys'));
  knapper.push(k('innkalling', 'Innkalling'), k('notat', 'Notat'));
  if (r.logg.slipp) knapper.push(k('avslutt', 'Avslutt prøven', 'avslutt'));
  return `<div class="handlinger">${knapper.join('')}</div>`;
}

function skogFane(p, r) {
  const varsler = r.regelsjekk.filter((v) => v.niva !== 'info' || !v.moment);
  return `
    <div id="status">${statusKort(p, r)}</div>
    <div id="handlinger">${handlingsKnapper(p, r)}</div>
    ${varsler.length ? `<div class="varsler">${varsler.map((v) => `<p class="varsel ${v.niva}">${esc(v.tekst)}</p>`).join('')}</div>` : ''}
    ${p.hund.navn ? '' : `<p class="varsel info">Husk å fylle inn hund og prøve under <a href="#/prove/${p.id}/info">Hund og prøve</a>.</p>`}
    ${losOversikt(p, r)}
    <section class="kort">
      <div class="rad-mellom"><h2>Skogslogg</h2><button class="knapp liten" data-handling="etterregistrer">+ Legg til i ettertid</button></div>
      ${loggListe(p)}
    </section>`;
}

function losOversikt(p, r) {
  if (!r.grupper.length) return '';
  return `<section class="kort">
    <h2>Loser</h2>
    <table class="tabell">
      <thead><tr><th>Uttak</th><th>Losdyr</th><th>Hørt</th><th>LUH/LPP</th><th>LIB</th><th>Lospoeng</th></tr></thead>
      <tbody>${r.grupper.map((g) => `<tr class="${g === r.premielos ? 'valgt' : ''}">
        <td>${g.deler.map((l) => klokke(l.uttak)).join(' + ')}</td><td>${LOSDYR[g.losdyr]}</td><td>${g.hortMin}</td>
        <td>${g.luhLpp || ''}</td><td>${g.libTillegg || ''}</td><td><strong>${g.lospoeng}</strong>${g.fullTid ? ' (full tid)' : ''}</td></tr>`).join('')}</tbody>
    </table>
    ${r.premielos ? `<p class="dempet">Uthevet los er premielos nå. Fører bestemmer losdyr – endre under Bedømming.</p>` : ''}
  </section>`;
}

function hendelseTekst(e) {
  let t = HENDELSER[e.type] || e.type;
  if (e.type === 'uttak') t = `Uttak – ${LOSDYR[e.losdyr]?.toLowerCase() || ''}`;
  if (e.type === 'kobling' && e.grunn && e.grunn !== 'pause') t = `Kobling – ${KOBLINGSGRUNNER[e.grunn]?.toLowerCase()}`;
  if (e.type === 'utav') t = e.modus === 'LPP' ? 'Los kun på peil (LPP)' : 'Ut av hørehold (LUH)';
  if (e.type === 'settLosdyr' && e.avstand) t += ` – ${e.avstand}`;
  if (e.type === 'klovStart') t += ` – ${e.art}`;
  if (e.type === 'innkalling') t += ` fra ${e.fra}${e.utenforSyn ? ', utenfor synsvidde' : ''}${e.lyktes === false ? ' – kom ikke' : ''}`;
  return t;
}

function loggListe(p) {
  const h = sorterHendelser(p.hendelser).reverse();
  if (!h.length) return '<p class="dempet">Ingen hendelser ennå. Trykk «Slipp» når hunden slippes.</p>';
  return `<ol class="logg">${h.map((e) => `
    <li class="h-${e.type}">
      <input type="time" value="${klokke(e.t)}" data-tid="${e.id}" aria-label="Klokkeslett">
      <div class="logg-tekst"><div>${esc(hendelseTekst(e))}</div>${e.tekst ? `<div class="dempet">${esc(e.tekst)}</div>` : ''}
        ${e.pos ? `<div class="dempet liten">${e.pos.lat.toFixed(5)}, ${e.pos.lon.toFixed(5)}</div>` : ''}</div>
      <button class="ikon" data-slett="${e.id}" aria-label="Slett hendelse">✕</button>
    </li>`).join('')}</ol>`;
}

let tikk = null;
function startTikk(p) {
  if (!erLive(p)) return;
  let fullTidVarslet = false;
  tikk = setInterval(() => {
    const el = document.getElementById('status');
    if (!el || app.dataset.fane !== 'skog') return stoppTikk();
    const r = beregn(p, Date.now());
    el.innerHTML = statusKort(p, r);
    const full = r.grupper.some((g) => g.fullTid && g.aapen);
    if (full && !fullTidVarslet) { fullTidVarslet = true; vibrer([200, 100, 200]); oppdater(p); }
  }, 1000);
}
function stoppTikk() { if (tikk) clearInterval(tikk); tikk = null; }

// Registrer en hendelse nå (eller på oppgitt tid).
function registrer(p, type, ekstra = {}, t = Date.now()) {
  const sist = p.hendelser.reduce((m, e) => Math.max(m, e.seq || 0), 0);
  const e = { id: nyId(), t, seq: sist + 1, type, ...ekstra };
  p.hendelser.push(e);
  vibrer();
  if (p.gps && navigator.geolocation && t >= Date.now() - 5000) {
    navigator.geolocation.getCurrentPosition((pos) => {
      e.pos = { lat: pos.coords.latitude, lon: pos.coords.longitude, n: Math.round(pos.coords.accuracy) };
      lagre();
    }, () => {}, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  }
  oppdater(p);
}

// ---------- Ark (dialoger) ----------
function visArk(html, ved) {
  ark.innerHTML = `<form method="dialog" class="ark-innhold">${html}<div class="knapperad"><button value="avbryt" class="knapp" formnovalidate>Avbryt</button></div></form>`;
  ark.onclick = (ev) => {
    const b = ev.target.closest('[data-valg]');
    if (b) { ev.preventDefault(); ark.close(); ved(b.dataset.valg, ark.querySelector('form')); }
    if (ev.target === ark) ark.close();
  };
  ark.showModal();
}

function velgFor(p, type, ekstraFelles = {}, t = undefined) {
  const reg = (ekstra) => registrer(p, type, { ...ekstraFelles, ...ekstra }, t ?? Date.now());
  const r = beregn(p);
  if (type === 'uttak') {
    const lovlige = LOVLIGE_LOSDYR[p.hund.gruppe || 'stover'];
    const forrige = r.grupper[r.grupper.length - 1];
    return visArk(`<h2>Uttak – hvilket losdyr?</h2><p class="dempet">Lospoeng gis bare når losdyrets art er konstatert (sett, eller sikkert sporsyn).</p>
      <div class="valg">${[...lovlige, 'ukjent'].map((l) => `<button class="hk ${l === forrige?.losdyr ? 'primar' : ''}" data-valg="${l}">${LOSDYR[l]}</button>`).join('')}</div>`, (v) => reg({ losdyr: v }));
  }
  if (type === 'kobling') {
    return visArk(`<h2>Kobling – grunn</h2><div class="valg">${Object.entries(KOBLINGSGRUNNER).map(([k, tx]) => `<button class="hk" data-valg="${k}">${tx}</button>`).join('')}</div>
      <p class="dempet">Ved LIB, samjag, fare eller forulykket losdyr slås en ny los på samme art sammen med denne.</p>`, (v) => reg({ grunn: v }));
  }
  if (type === 'settLosdyr') {
    return visArk('<h2>Losdyr sett – avstand til hunden</h2><div class="valg"><button class="hk" data-valg="tett på">Tett på hunden</button><button class="hk" data-valg="middels">Middels</button><button class="hk" data-valg="langt foran">Langt foran</button></div><p class="dempet">Nyansering 5 krever at losdyret er sett minst 2 ganger med ulik avstand.</p>', (v) => reg({ avstand: v }));
  }
  if (type === 'klovStart') {
    return visArk('<h2>Klovdyrjag – art</h2><div class="valg">' + [['radyr', 'Rådyr'], ['hjort', 'Hjort'], ['elg', 'Elg'], ['rein', 'Rein'], ['villsvin', 'Villsvin'], ['bufe', 'Bufe (sau, geit, storfe)']].map(([k, tx]) => `<button class="hk" data-valg="${k}">${tx}</button>`).join('') + '</div>', (v) => reg({ art: v }));
  }
  if (type === 'innkalling') {
    return visArk(`<h2>Innkalling</h2>
      <label class="felt hake"><input type="checkbox" name="utenforSyn"> Hunden var utenfor synsvidde</label>
      <label class="felt hake"><input type="checkbox" name="lyktes" checked> Hunden kom på innkalling</label>
      <div class="valg"><button class="hk" data-valg="los">Fra los</button><button class="hk" data-valg="tap">Fra tap</button><button class="hk" data-valg="søk">Fra søk</button></div>`,
    (v, f) => reg({ fra: v, utenforSyn: f.utenforSyn.checked, lyktes: f.lyktes.checked }));
  }
  if (type === 'notat') {
    return visArk('<h2>Notat</h2><textarea name="tekst" rows="4" class="fullbredde" placeholder="Observasjon, vær, terreng …"></textarea><div class="valg"><button class="hk primar" data-valg="lagre">Lagre notat</button></div>',
      (v, f) => { if (f.tekst.value.trim()) reg({ tekst: f.tekst.value.trim() }); });
  }
  if (type === 'avslutt') {
    return visArk(`<h2>Avslutte prøven?</h2><p>Hunden har vært løs ${fmtTid(r.logg.losTid)}. ${r.logg.losTid < 5 * 60 * MIN ? '<strong>Under 5 timer – hunden skal da tildeles T, med mindre U (vær/føre) eller A (skade) gjelder.</strong>' : ''}</p>
      <div class="valg"><button class="hk primar" data-valg="ja">Avslutt og koble</button></div>`, () => { reg({}); location.hash = `#/prove/${p.id}/poeng`; });
  }
  return reg({});
}

function etterregistrer(p) {
  const typer = Object.entries(HENDELSER);
  visArk(`<h2>Legg til hendelse i ettertid</h2>
    <label class="felt"><span>Klokkeslett</span><input type="time" name="tid" value="${klokke(Date.now())}" required></label>
    <label class="felt"><span>Hendelse</span><select name="type">${typer.map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></label>
    <div class="valg"><button class="hk primar" data-valg="ok">Fortsett</button></div>`, (v, f) => {
    const t = tidPaaDato(p, f.tid.value);
    if (t == null) return;
    const type = f.type.value;
    if (type === 'utav') return visArk('<h2>Ute av hørehold eller peil?</h2><div class="valg"><button class="hk" data-valg="LUH">LUH</button><button class="hk" data-valg="LPP">Kun på peil (LPP)</button></div>', (m) => registrer(p, 'utav', { modus: m }, t));
    if (['uttak', 'kobling', 'settLosdyr', 'klovStart', 'innkalling', 'notat'].includes(type)) return velgFor(p, type, {}, t);
    registrer(p, type, {}, t);
  });
}

function tidPaaDato(p, hhmm) {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const d = new Date(`${p.dato || iDag()}T${hhmm}:00`);
  return Number.isNaN(+d) ? null : d.getTime();
}

// ---------- Fane: bedømming ----------
function poengFane(p, r) {
  const sjekk = (id) => r.regelsjekk.filter((v) => v.moment === id);
  const rad = (m) => {
    const aktiv = r.aktive.ids.includes(m.id);
    const v = p.poeng[m.id];
    const sum = Number.isInteger(v) && aktiv ? v * m.vekt : '';
    return `<div class="moment ${aktiv ? '' : 'inaktiv'}">
      <div class="moment-navn"><span class="nr">${m.nr}</span> ${m.navn} <span class="dempet">× ${m.vekt}</span><span class="sum">${sum}</span></div>
      <div class="skala" role="radiogroup" aria-label="${m.navn}">
        ${[1, 2, 3, 4, 5].map((n) => `<button class="${v === n ? 'valgt' : ''}" data-poeng="${m.id}" data-verdi="${n}" title="${SKALA[n]}" ${aktiv ? '' : 'disabled'}>${n}</button>`).join('')}
        <button class="g ${v === 'G' ? 'valgt' : ''}" data-poeng="${m.id}" data-verdi="G" ${aktiv ? '' : 'disabled'}>G</button>
      </div>
      ${aktiv ? sjekk(m.id).map((s) => `<p class="varsel ${s.niva}">${esc(s.tekst)}</p>`).join('') : ''}
    </div>`;
  };
  const pl = r.premielos;
  return `
    <section class="kort sammendrag">${sammendrag(r)}</section>
    <section class="kort">
      <h2>Premielos</h2>
      ${r.grupper.length ? `<div class="valg-liste">${r.grupper.map((g) => `
        <label class="los-valg ${g === pl ? 'valgt' : ''}">
          <input type="radio" name="premielos" value="${g.id}" ${g === pl ? 'checked' : ''} data-premielos>
          <span><strong>${LOSDYR[g.losdyr]}</strong> kl. ${g.deler.map((l) => klokke(l.uttak)).join(' + ')} – ${g.lospoeng} lospoeng
          <span class="dempet">(hørt ${g.hortMin}${g.luhLpp ? `, LUH/LPP ${g.luhLpp}` : ''}${g.libTillegg ? ', LIB 20' : ''})</span></span>
        </label>`).join('')}
        ${r.logg.loser.slice(1).map((l) => {
    const g = r.grupper.find((x) => x.deler.includes(l));
    const sammen = g.deler.indexOf(l) > 0;
    return `<label class="felt hake liten"><input type="checkbox" data-sammenslaa="${l.id}" ${sammen ? 'checked' : ''}> Slå los kl. ${klokke(l.uttak)} (${LOSDYR[l.losdyr].toLowerCase()}) sammen med forrige</label>`;
  }).join('')}
        ${p.premielos ? '<button class="knapp liten" data-handling="auto-premielos">La appen velge beste los</button>' : ''}</div>`
    : '<p class="dempet">Ingen los registrert.</p>'}
    </section>
    <section class="kort">
      <h2>Egenskaper</h2>
      <p class="dempet">${esc(r.aktive.grunn)} En gjennomsnittlig prestasjon gis 3 (godt). 1 dårlig · 2 mindre godt · 3 godt · 4 meget godt · 5 særdeles godt.</p>
      ${MOMENTER.map(rad).join('')}
      <div class="moment">
        <div class="moment-navn">Mål (avmerkes i protokollen)</div>
        <div class="skala bred">${[['E', 'Enstonig (E)'], ['T/F', 'To-/flertonig (T/F)']].map(([k, t]) => `<button class="${p.mal === k ? 'valgt' : ''}" data-mal="${k}">${t}</button>`).join('')}</div>
      </div>
      <h2>Tilleggspoeng (konkurranse)</h2>
      ${TILLEGG.map(rad).join('')}
    </section>
    <section class="kort">
      <h2>Avslutning uten premiering</h2>
      <div class="skala bred">${[['', 'Ingen'], ...Object.keys(UTFALL).map((k) => [k, k])].map(([k, t]) => `<button class="${(p.utfall || '') === k ? 'valgt' : ''}" data-utfall="${k}" title="${esc(UTFALL[k] || '')}">${t}</button>`).join('')}</div>
      <p class="dempet">${p.utfall ? esc(UTFALL[p.utfall]) + '. Grunnen skal stå i tilleggsopplysninger.' : 'G: graverende feil · T: trukket · U: uforsvarlig vær/føre · A: alvorlig, akutt skade. G må tildeles i skogen.'}</p>
      ${p.type === 'EP' && p.dag === 2 ? `<label class="felt hake"><input type="checkbox" data-ikke-startet ${p.ikkeStartet ? 'checked' : ''}> Ikke startet dag 2 (IS)</label>` : ''}
    </section>
    <section class="kort">
      <h2>Tilleggsopplysninger</h2>
      <textarea class="fullbredde" rows="5" data-tilleggsopplysninger placeholder="Korte og presise opplysninger som utfyller poengsettingen">${esc(p.tilleggsopplysninger)}</textarea>
      <button class="knapp liten" data-handling="forslag">Sett inn påkrevde opplysninger</button>
      <label class="felt"><span>RR-prøve</span><select data-rr>${[['', '–'], ['Bestått', 'Bestått'], ['Ikke godkjent', 'Ikke godkjent'], ['Omprøve', 'Omprøve']].map(([k, t]) => `<option value="${k}" ${p.rr === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    </section>
    <div class="knapperad"><a class="knapp primar" href="#/prove/${p.id}/protokoll">Se protokollen →</a></div>`;
}

function sammendrag(r) {
  const mangler = r.mangler.find((m) => m.los + m.ep + m.pp > 0 && r.premiegrad !== m.grad && (r.premiegrad === 0 || m.grad < r.premiegrad));
  return `<div class="tall">
      <div><span>Egenskapspoeng</span><strong>${r.egenskapspoeng}</strong><small>av 80</small></div>
      <div><span>Lospoeng</span><strong>${r.lospoeng}</strong><small>av ${r.premielos?.maks || 120}</small></div>
      <div><span>Premiepoeng</span><strong>${r.premiepoeng}</strong></div>
      <div><span>Konkurranse</span><strong>${r.konkurransepoeng}</strong></div>
      <div class="premie ${r.premiegrad ? `p${r.premiegrad}` : ''}"><span>Innstilling</span><strong>${r.utfall || (r.premiegrad ? `${r.premiegrad}. pr` : '0')}</strong></div>
    </div>
    ${mangler && !r.utfall ? `<p class="dempet">Til ${mangler.grad}. premie mangler: ${[mangler.los && `${mangler.los} lospoeng`, mangler.ep && `${mangler.ep} egenskapspoeng`, mangler.pp && `${mangler.pp} premiepoeng`].filter(Boolean).join(', ')}.</p>` : ''}`;
}

// ---------- Fane: protokoll ----------
function protokollFane(p, r) {
  const h = p.hund;
  const pl = r.premielos;
  const loser = pl ? [pl, ...r.grupper.filter((g) => g !== pl)].slice(0, 4) : r.grupper.slice(0, 4);
  const ps = (id) => (r.aktive.ids.includes(id) ? (p.poeng[id] ?? '') : '');
  const sum = (m) => (Number.isInteger(p.poeng[m.id]) && r.aktive.ids.includes(m.id) ? p.poeng[m.id] * m.vekt : '');
  const reg = pl?.reg || {};
  const ep = p.type === 'EP' ? epResultat(p) : '';
  return `
  <div class="verktoy ikke-print">
    <button class="knapp primar" data-handling="skriv">Skriv ut / lagre PDF</button>
    <button class="knapp" data-handling="del">Del sammendrag</button>
    <button class="knapp" data-handling="eksporter">Eksporter (JSON)</button>
  </div>
  ${r.regelsjekk.filter((v) => v.niva !== 'info').map((v) => `<p class="varsel ${v.niva} ikke-print">${esc(v.tekst)}</p>`).join('')}
  <article class="protokoll">
    <header>
      <div><strong>NHKF</strong> · Jaktprøveprotokoll${p.arrangor ? ` · ${esc(p.arrangor)}` : ''}</div>
      <div>Ref.nr. ${esc(p.refnr) || '—'} · ${esc(p.type)}${p.type === 'EP' ? ` dag ${p.dag}` : ''} · Kat.nr. ${esc(p.katnr) || '—'}</div>
    </header>
    <table class="hode">
      <tr><th>Hundens navn</th><td>${esc(h.navn)}</td><th>Reg.nr.</th><td>${esc(h.regnr)}</td></tr>
      <tr><th>Rase</th><td>${esc(h.rase)}</td><th>ID-nr.</th><td>${esc(h.idnr)} ${h.idKontrollert ? '✓ kontrollert' : ''}</td></tr>
      <tr><th>Eier</th><td>${esc(p.eier)}</td><th>Fører</th><td>${esc(p.forer)}</td></tr>
      <tr><th>Dommer</th><td>${esc(p.dommer)} ${p.dommerNr ? `(${esc(p.dommerNr)})` : ''}</td><th>Elev/aspirant</th><td>${esc(p.elev)}</td></tr>
      <tr><th>Prøvedato</th><td>${datoNo(p.dato)}</td><th>Terreng</th><td>${esc(p.terreng)}</td></tr>
      <tr><th>Slipp kl.</th><td>${klokke(r.logg.slipp)}</td><th>Avsluttet kl.</th><td>${klokke(r.logg.slutt)}</td></tr>
      <tr><th>Mark</th><td>${esc(p.mark)}</td><th>Løs-tid</th><td>${fmtTid(r.logg.losTid)}</td></tr>
      ${h.gruppe === 'smahund' && h.boghoyde ? `<tr><th>Boghøyde</th><td>${esc(h.boghoyde)} cm</td><th>Vær</th><td>${esc(p.vaer)} ${p.temp !== '' ? `${esc(p.temp)} °C` : ''}</td></tr>` : `<tr><th>Vær</th><td colspan="3">${esc(p.vaer)} ${p.temp !== '' ? `${esc(p.temp)} °C` : ''}</td></tr>`}
    </table>
    <div class="to-kol">
      <table class="poeng">
        <thead><tr><th></th><th>Moment</th><th>Poeng</th><th>Vekt</th><th>Sum</th></tr></thead>
        <tbody>
          ${MOMENTER.map((m) => `<tr><td>${m.nr}</td><td>${m.navn}</td><td>${ps(m.id)}</td><td>${m.vekt}</td><td>${sum(m)}</td></tr>`).join('')}
          <tr class="sum"><td></td><td>Sum egenskapspoeng (A) (80)</td><td></td><td></td><td>${r.egenskapspoeng}</td></tr>
          <tr class="sum"><td></td><td>Sum lospoeng (B) (${r.gruppe === 'smahund' ? '90' : '120/90'})</td><td></td><td></td><td>${r.lospoeng}</td></tr>
          <tr class="sum"><td></td><td>Premiepoeng (A+B)</td><td></td><td></td><td>${r.premiepoeng}</td></tr>
          ${TILLEGG.map((m) => `<tr><td>${m.nr}</td><td>${m.navn}</td><td>${ps(m.id)}</td><td>${m.vekt}</td><td>${sum(m)}</td></tr>`).join('')}
          <tr class="sum"><td></td><td>Konkurransepoeng (A+B+7+8)</td><td></td><td></td><td>${r.konkurransepoeng}</td></tr>
        </tbody>
      </table>
      <div>
        <table class="loser">
          <thead><tr><th></th>${[0, 1, 2, 3].map((i) => `<th>Los ${i + 1}</th>`).join('')}</tr></thead>
          <tbody>
            <tr><th>Losdyr</th>${[0, 1, 2, 3].map((i) => `<td>${loser[i] ? LOSDYR[loser[i].losdyr] : ''}</td>`).join('')}</tr>
            <tr><th>Lostid min</th>${[0, 1, 2, 3].map((i) => `<td>${loser[i] ? loser[i].hortMin : ''}</td>`).join('')}</tr>
            <tr><th>Tillegg LUH/LPP</th>${[0, 1, 2, 3].map((i) => `<td>${loser[i]?.luhLpp || ''}</td>`).join('')}</tr>
            <tr><th>Tillegg LIB</th>${[0, 1, 2, 3].map((i) => `<td>${loser[i]?.libTillegg || ''}</td>`).join('')}</tr>
            <tr><th>Sum lospoeng</th>${[0, 1, 2, 3].map((i) => `<td>${loser[i] ? loser[i].lospoeng : ''}</td>`).join('')}</tr>
          </tbody>
        </table>
        <table class="hode">
          <tr><th>G for</th><td>${p.utfall === 'G' ? 'Ja' : ''}</td><th>Mål</th><td>${esc(p.mal)}</td></tr>
          <tr><th>Trukket?</th><td>${p.utfall === 'T' ? 'Ja' : ''}</td><th>Har vært i fot?</th><td>${r.logg.harVaertIFot ? 'Ja' : 'Nei'}</td></tr>
          <tr><th>RR-prøve</th><td>${esc(p.rr)}</td><th>Utfall</th><td>${p.utfall ? `${p.utfall} – ${esc(UTFALL[p.utfall])}` : p.ikkeStartet ? 'IS' : ''}</td></tr>
        </table>
        <h3>Tilleggsregistreringer for hovedlosen (min)</h3>
        <table class="hode">
          <tr><th>Fot til uttak</th><td>${reg.fotTilUttak ?? ''}</td><th>Uttak til 60 min</th><td>${reg.uttakTil60 ?? ''}</td></tr>
          <tr><th>Uttak til slutt</th><td>${pl && pl.hortMin >= 30 ? reg.uttakTilSlutt : ''}</td><th>Lengste lossekvens</th><td>${pl && pl.hortMin >= 30 ? reg.lengsteSekvens : ''}</td></tr>
          <tr><th>Lengste tap</th><td>${pl && pl.hortMin >= 30 ? reg.lengsteTap : ''}</td><th>Antall tap</th><td>${pl && pl.hortMin >= 30 ? reg.antallTap : ''}</td></tr>
        </table>
      </div>
    </div>
    <h3>Tilleggsopplysninger</h3>
    <p class="fritekst">${esc(p.tilleggsopplysninger) || '—'}</p>
    <div class="innstilling">Hunden innstilles til: <strong>${r.utfall ? r.utfall : r.premiegrad ? `${r.premiegrad}. premie` : '0 premie'}</strong>
      ${ep}</div>
    <div class="signaturer">
      <div><canvas data-signatur="signaturDommer" width="600" height="160"></canvas><div class="rad-mellom"><span>Dato og dommers underskrift</span><button class="knapp liten ikke-print" data-tom-signatur="signaturDommer">Tøm</button></div></div>
      <div><canvas data-signatur="signaturForer" width="600" height="160"></canvas><div class="rad-mellom"><span>Gjennomgått med fører</span><button class="knapp liten ikke-print" data-tom-signatur="signaturForer">Tøm</button></div></div>
    </div>
    <h3 class="ny-side">Skogsprotokoll – logg</h3>
    <table class="tabell logg-tabell">
      <thead><tr><th>Kl.</th><th>Hendelse</th><th>Merknad</th></tr></thead>
      <tbody>${sorterHendelser(p.hendelser).map((e) => `<tr><td>${klokke(e.t)}</td><td>${esc(hendelseTekst(e))}</td><td>${esc(e.tekst || '')}${e.pos ? ` <span class="dempet">${e.pos.lat.toFixed(5)}, ${e.pos.lon.toFixed(5)}</span>` : ''}</td></tr>`).join('')}</tbody>
    </table>
    <p class="dempet liten">Laget med Skogsprotokoll harehund etter NHKFs jaktprøveregler (01.07.2025). Dommerkollegiet fastsetter endelig premiering.</p>
  </article>`;
}

function epResultat(p) {
  const d1 = p.dag === 1 ? p : finn(p.epPar);
  const d2 = p.dag === 2 ? p : data.prover.find((x) => x.epPar === p.id);
  if (!d1) return '';
  const ep = beregnEP(d1, d2);
  return `<div class="ep"><strong>Eliteprøve samlet:</strong> ${ep.premiepoeng} premiepoeng (${ep.dager.map((d, i) => (d ? `dag ${i + 1}: ${d.utfall || d.premiepoeng}` : `dag ${i + 1}: –`)).join(', ')})
    → <strong>${ep.premie ? `${ep.premie}. premie EP` : 'ingen EP-premie'}</strong>
    ${ep.merknader.map((m) => `<div class="dempet">${esc(m)}</div>`).join('')}
    <div class="dempet">1. EP 321–400 · 2. EP 261–320 · 3. EP 195–260 premiepoeng.</div></div>`;
}

// ---------- Signatur ----------
function klargjorSignaturer(p) {
  document.querySelectorAll('canvas[data-signatur]').forEach((c) => {
    const felt = c.dataset.signatur;
    const ctx = c.getContext('2d');
    const farge = getComputedStyle(document.body).getPropertyValue('--blekk').trim() || '#111';
    if (p[felt]) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = p[felt]; }
    let tegner = false;
    const pos = (e) => { const b = c.getBoundingClientRect(); return [(e.clientX - b.left) * (c.width / b.width), (e.clientY - b.top) * (c.height / b.height)]; };
    c.addEventListener('pointerdown', (e) => { tegner = true; c.setPointerCapture(e.pointerId); ctx.beginPath(); ctx.moveTo(...pos(e)); });
    c.addEventListener('pointermove', (e) => { if (!tegner) return; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = farge; ctx.lineTo(...pos(e)); ctx.stroke(); });
    const slutt = () => { if (!tegner) return; tegner = false; p[felt] = c.toDataURL('image/png'); lagre(); };
    c.addEventListener('pointerup', slutt);
    c.addEventListener('pointercancel', slutt);
  });
}

// ---------- Hendelser i grensesnittet ----------
app.addEventListener('click', (ev) => {
  const p = finn(app.dataset.prove);
  const b = ev.target.closest('button, [data-handling]');
  if (!b) return;
  const handling = b.dataset.handling;
  if (handling === 'ny') { const n = nyProve(); data.prover.push(n); lagre(); location.hash = `#/prove/${n.id}/info`; return; }
  if (handling === 'eksempel') { const n = eksempel(); data.prover.push(n); lagre(); location.hash = `#/prove/${n.id}/protokoll`; return; }
  if (!p || location.hash === '' || location.hash === '#/') return;
  if (b.dataset.hendelse) {
    const type = b.dataset.hendelse;
    if (type === 'utav') return registrer(p, 'utav', { modus: b.dataset.modus });
    return velgFor(p, type);
  }
  if (b.dataset.slett) {
    if (!confirm('Slette denne hendelsen?')) return;
    p.hendelser = p.hendelser.filter((e) => e.id !== b.dataset.slett);
    return oppdater(p);
  }
  if (b.dataset.poeng) {
    const v = b.dataset.verdi === 'G' ? 'G' : Number(b.dataset.verdi);
    if (p.poeng[b.dataset.poeng] === v) delete p.poeng[b.dataset.poeng]; else p.poeng[b.dataset.poeng] = v;
    if (v === 'G' && p.poeng[b.dataset.poeng] === 'G') p.utfall = 'G';
    return oppdater(p);
  }
  if (b.dataset.mal != null) { p.mal = p.mal === b.dataset.mal ? '' : b.dataset.mal; return oppdater(p); }
  if (b.dataset.utfall != null) { p.utfall = b.dataset.utfall || null; return oppdater(p); }
  if (b.dataset.tomSignatur) { p[b.dataset.tomSignatur] = ''; return oppdater(p); }
  switch (handling) {
    case 'slett':
      if (confirm('Slette hele prøven? Dette kan ikke angres.')) { data.prover = data.prover.filter((x) => x !== p); lagre(); location.hash = '#/'; }
      break;
    case 'ep-dag2': {
      const n = nyProve({ type: 'EP', dag: 2, epPar: p.id, refnr: p.refnr, katnr: p.katnr, arrangor: p.arrangor, hund: { ...p.hund }, eier: p.eier, forer: p.forer, forerTlf: p.forerTlf, peil: p.peil, gps: p.gps, mark: p.mark });
      const d = new Date(`${p.dato}T12:00`); d.setDate(d.getDate() + 1); n.dato = d.toISOString().slice(0, 10);
      data.prover.push(n); lagre(); location.hash = `#/prove/${n.id}/info`;
      break;
    }
    case 'etterregistrer': etterregistrer(p); break;
    case 'auto-premielos': p.premielos = null; oppdater(p); break;
    case 'forslag': {
      const r = beregn(p);
      const linjer = forslagTilleggsopplysninger(p, r).filter((l) => !String(p.tilleggsopplysninger).includes(l));
      p.tilleggsopplysninger = [p.tilleggsopplysninger.trim(), ...linjer].filter(Boolean).join('\n');
      oppdater(p);
      break;
    }
    case 'skriv': window.print(); break;
    case 'eksporter': lastNed(`skogsprotokoll-${(p.hund.navn || 'hund').replace(/\W+/g, '-')}-${p.dato}.json`, JSON.stringify(p, null, 2)); break;
    case 'del': {
      const tekst = delTekst(p, beregn(p));
      if (navigator.share) navigator.share({ title: 'Skogsprotokoll', text: tekst }).catch(() => {});
      else navigator.clipboard?.writeText(tekst).then(() => alert('Sammendraget er kopiert.'));
      break;
    }
    default: break;
  }
});

app.addEventListener('change', (ev) => {
  const el = ev.target;
  const p = finn(app.dataset.prove);
  if (el.dataset.handling === 'importer') return importer(el.files[0]);
  if (!p) return;
  if (el.dataset.tid) {
    const t = tidPaaDato(p, el.value);
    const e = p.hendelser.find((x) => x.id === el.dataset.tid);
    if (e && t != null) { e.t = t; oppdater(p); }
    return;
  }
  if (el.dataset.premielos != null) { p.premielos = el.value; return oppdater(p); }
  if (el.dataset.sammenslaa) { p.losValg = { ...p.losValg, [el.dataset.sammenslaa]: { sammenslaa: el.checked } }; p.premielos = null; return oppdater(p); }
  if (el.dataset.ikkeStartet != null) { p.ikkeStartet = el.checked; return oppdater(p); }
  if (el.dataset.rr != null) { p.rr = el.value; return oppdater(p, false); }
  if (el.closest('[data-skjema="info"]') && el.name) {
    const verdi = el.type === 'checkbox' ? el.checked : el.value;
    const [a, b] = el.name.split('.');
    if (b) p[a][b] = verdi; else p[a] = a === 'dag' ? Number(verdi) : verdi;
    if (el.name === 'hund.rase' && el.value) p.hund.gruppe = gruppeForRase(el.value);
    oppdater(p, ['hund.rase', 'hund.gruppe', 'type', 'hund.fodt', 'temp', 'dato'].includes(el.name));
  }
});

app.addEventListener('input', (ev) => {
  const p = finn(app.dataset.prove);
  if (p && ev.target.dataset.tilleggsopplysninger != null) { p.tilleggsopplysninger = ev.target.value; lagre(); }
});

function lastNed(navn, innhold) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([innhold], { type: 'application/json' }));
  a.download = navn;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importer(fil) {
  if (!fil) return;
  fil.text().then((tekst) => {
    const inn = JSON.parse(tekst);
    const liste = Array.isArray(inn) ? inn : Array.isArray(inn.prover) ? inn.prover : [inn];
    let antall = 0;
    for (const x of liste) {
      if (!x || !Array.isArray(x.hendelser)) continue;
      const n = nyProve({ ...x, hund: { ...nyProve().hund, ...x.hund } });
      if (finn(x.id)) n.id = nyId();
      data.prover.push(n); antall++;
    }
    lagre(); alert(`Importerte ${antall} prøve(r).`); rute();
  }).catch(() => alert('Kunne ikke lese filen. Velg en JSON-fil eksportert fra Skogsprotokoll.'));
}

function delTekst(p, r) {
  const pl = r.premielos;
  return [
    `Skogsprotokoll ${p.type}${p.type === 'EP' ? ` dag ${p.dag}` : ''} ${datoNo(p.dato)}`,
    `${p.hund.navn} (${p.hund.rase}, ${p.hund.regnr}) – dommer ${p.dommer}`,
    `Slipp ${klokke(r.logg.slipp)}, avsluttet ${klokke(r.logg.slutt)}, løs ${fmtTid(r.logg.losTid)}`,
    pl ? `Premielos: ${LOSDYR[pl.losdyr]}, uttak ${klokke(pl.uttak)}, ${pl.lospoeng} lospoeng` : 'Ingen los',
    `Egenskapspoeng ${r.egenskapspoeng} · Lospoeng ${r.lospoeng} · Premiepoeng ${r.premiepoeng} · Konkurransepoeng ${r.konkurransepoeng}`,
    `Innstilling: ${r.utfall || (r.premiegrad ? `${r.premiegrad}. premie` : '0 premie')}`,
    p.tilleggsopplysninger ? `\n${p.tilleggsopplysninger}` : '',
  ].join('\n');
}

// Eksempel: en dunker på hare som når 1. premie.
function eksempel() {
  const dato = iDag();
  const kl = (hhmm) => new Date(`${dato}T${hhmm}:00`).getTime();
  let seq = 0;
  const e = (hhmm, type, x = {}) => ({ id: nyId(), t: kl(hhmm), seq: ++seq, type, ...x });
  return nyProve({
    dato, refnr: 'EKSEMPEL', katnr: '1', arrangor: 'Eksempel harehundklubb', dommer: 'Ola Dommer', dommerNr: '1234567', terreng: 'Nordskogen', mark: 'Snø', vaer: 'Lett overskyet, vindstille', temp: '-4',
    hund: { navn: 'Eksempel Rapp', regnr: 'NO12345/22', idnr: '578000000000000', rase: 'Dunker', gruppe: 'stover', kjonn: 'hann', fodt: '2022-03-10', boghoyde: '', idKontrollert: true },
    eier: 'Kari Eier', forer: 'Kari Eier', peil: true,
    hendelser: [
      e('08:10', 'slipp'), e('08:32', 'fot'), e('09:05', 'uttak', { losdyr: 'hare' }), e('09:20', 'settLosdyr', { avstand: 'langt foran' }),
      e('09:47', 'tap'), e('09:50', 'gjentak'), e('10:12', 'tap'), e('10:24', 'gjentak'), e('10:31', 'settLosdyr', { avstand: 'tett på' }),
      e('10:40', 'utav', { modus: 'LUH' }), e('10:52', 'inn'), e('11:20', 'tap'), e('11:38', 'slutt'), e('11:45', 'notat', { tekst: 'Dødtap ved bekken, hunden arbeider godt i tapet.' }),
      e('12:30', 'fot'), e('13:02', 'uttak', { losdyr: 'hare' }), e('13:41', 'tap'), e('14:05', 'slutt'),
      e('14:20', 'innkalling', { fra: 'søk', utenforSyn: true, lyktes: true }), e('14:21', 'kobling', { grunn: 'pause' }), e('14:40', 'slipp'), e('15:25', 'avslutt'),
    ],
    poeng: { jaktlyst: 4, samarbeid: 4, fotarbeid: 4, malbrukFot: 4, malbrukTap: 3, arbeidLos: 4, arbeidTap: 4, nyansering: 4, horbarhet: 4, kondisjon: 4, lydighet: 4 },
    mal: 'T/F',
    tilleggsopplysninger: 'Eksempel laget av appen. Tilleggslos hare kl. 13:02: 38 lospoeng.',
  });
}

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
rute();
