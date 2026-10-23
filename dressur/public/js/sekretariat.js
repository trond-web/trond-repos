// Sekretariatet: stevne, program, klasser, dommere, påmeldinger, startlister, resultater og sikkerhetskopi.
import { api, html, raw, $, $$, kortDato, kr, melding, skjemaData, lastNed, tidspunkt, STATUS_KLASSE, STATUS_PAMELDING } from './felles.js';
import { sikreInnlogging } from './innlogging.js';
import { POSISJONER, NIVAAER, formatProsent, formatKarakter } from './beregning.js';

const app = $('#app');
const FANER = [
  ['stevne', 'Stevnet'], ['klasser', 'Klasser'], ['programmer', 'Program'], ['dommere', 'Dommere'],
  ['paameldinger', 'Påmeldinger'], ['startlister', 'Startlister'], ['resultater', 'Resultater'], ['system', 'Logg og backup'],
];
let o = null;

async function start() {
  await sikreInnlogging('sekretariat', 'Logg inn i sekretariatet');
  const nav = $('#faner');
  nav.hidden = false;
  nav.innerHTML = FANER.map(([id, navn]) => html`<a href="#/${id}">${navn}</a>`).join('');
  window.addEventListener('hashchange', rute);
  rute();
}

async function last() {
  o = await api('/api/admin/oversikt');
  $('#undertittel').textContent = o.stevne.navn || 'Dressurstevne';
}

async function rute() {
  const [, side = 'stevne', id] = location.hash.replace(/^#/, '').split('/');
  $$('#faner a').forEach((a) => a.classList.toggle('aktiv', a.getAttribute('href') === `#/${side}`));
  try {
    await last();
    const vis = { stevne: visStevne, klasser: visKlasser, programmer: visProgrammer, dommere: visDommere, paameldinger: visPameldinger, startlister: visStartlister, resultater: visResultater, system: visSystem }[side] || visStevne;
    await vis(id);
  } catch (e) {
    if (e.status === 401) location.reload();
    app.innerHTML = html`<div class="varsel fare">${e.message}</div>`;
  }
}

const klasseNavn = (id) => { const k = o.klasser.find((x) => x.id === id); return k ? `${k.nr ? `${k.nr}. ` : ''}${k.navn}` : '?'; };
const dommerNavn = (id) => o.dommere.find((d) => d.id === id)?.navn || '';
const felt = (navn, etikett, verdi, attr = '') => raw(html`<div class="felt"><label>${etikett}<input name="${navn}" value="${verdi ?? ''}" ${raw(attr)}></label></div>`);
const avkryss = (navn, etikett, verdi) => raw(html`<label class="avkryss"><input type="checkbox" name="${navn}" ${verdi ? 'checked' : ''}> ${etikett}</label>`);

async function lagreOgVis(fn, tekst = 'Lagret.') {
  try { await fn(); melding(tekst); await rute(); } catch (e) { melding(e.message, 'feil'); }
}

// ---------- stevnet ----------

function visStevne() {
  const s = o.stevne;
  const antall = o.paameldinger.filter((p) => p.status !== 'trukket').length;
  app.innerHTML = html`
    <section class="rutenett" style="margin-bottom:16px">
      <div class="kort"><small>Klasser</small><h2>${o.klasser.length}</h2></div>
      <div class="kort"><small>Aktive påmeldinger</small><h2>${antall}</h2></div>
      <div class="kort"><small>Dommere</small><h2>${o.dommere.length}</h2></div>
      <div class="kort"><small>Startavgifter</small><h2>${kr(o.paameldinger.filter((p) => p.status === 'pameldt').reduce((sum, p) => sum + (o.klasser.find((k) => k.id === p.klasseId)?.startavgift || 0), 0))}</h2></div>
    </section>
    ${o.konflikter.length ? raw(html`<div class="varsel advarsel"><b>Starttider å se på:</b>${o.konflikter.map((k) => raw(html`<br>${k.tekst}`))}</div>`) : ''}
    <form class="kort" id="stevneskjema">
      <h2>Stevnet</h2>
      <div class="felter">
        ${felt('navn', 'Navn på stevnet', s.navn, 'required')}
        ${felt('sted', 'Sted', s.sted)}
        ${felt('arrangor', 'Arrangør', s.arrangor)}
        <div class="felt"><label>Stevnenivå<select name="stevnenivaa">${['Klubb', 'Rekruttering', 'D', 'L', 'E'].map((n) => raw(html`<option ${s.stevnenivaa === n ? 'selected' : ''}>${n}</option>`))}</select></label></div>
        ${felt('datoFra', 'Fra dato', s.datoFra, 'type="date"')}
        ${felt('datoTil', 'Til dato', s.datoTil, 'type="date"')}
        ${felt('pameldingsfrist', 'Påmeldingsfrist', s.pameldingsfrist, 'type="datetime-local"')}
        ${felt('etteranmeldingsgebyr', 'Etteranmeldingsgebyr (kr)', s.etteranmeldingsgebyr, 'type="number" min="0"')}
        ${felt('overdommer', 'Overdommer', s.overdommer)}
        ${felt('kontakt', 'Kontakt (e-post/telefon)', s.kontakt)}
      </div>
      ${avkryss('tillatEtteranmelding', 'Tillat etteranmelding etter fristen', s.tillatEtteranmelding)}
      <div class="felt"><label>Informasjon til deltakerne<textarea name="info" rows="4">${s.info}</textarea></label></div>
      <button class="primar">Lagre</button>
    </form>
    <p class="dempet">Rekkefølge for oppsett: 1) legg inn program, 2) opprett dommere, 3) opprett klasser med program og dommere (C er hoveddommer), 4) åpne klassene for påmelding, 5) trekk startrekkefølge og publiser startlistene, 6) dommerne logger inn på <a href="/dommer">/dommer</a>, 7) gjør resultatlistene offisielle.</p>`;
  $('#stevneskjema').onsubmit = (e) => { e.preventDefault(); lagreOgVis(() => api('/api/admin/stevne', { metode: 'PUT', data: skjemaData(e.target) })); };
}

// ---------- klasser ----------

function visKlasser(id) {
  if (id) return redigerKlasse(id === 'ny' ? null : o.klasser.find((k) => k.id === id));
  app.innerHTML = html`
    <div class="rad mellom"><h1>Klasser</h1><a class="knapp primar" href="#/klasser/ny">Ny klasse</a></div>
    ${o.programmer.length ? '' : raw('<div class="varsel advarsel">Legg inn minst ett program før du oppretter klasser.</div>')}
    <div class="kort tabell-boks"><table>
      <thead><tr><th>Nr</th><th>Klasse</th><th>Dato</th><th>Program</th><th>Dommere</th><th class="tall">Påmeldt</th><th>Status</th><th></th></tr></thead>
      <tbody>${[...o.klasser].sort((a, b) => a.dato.localeCompare(b.dato) || (a.nr || 0) - (b.nr || 0)).map((k) => raw(html`<tr>
        <td>${k.nr ?? ''}</td><td><b>${k.navn}</b>${k.apen ? '' : raw(' <span class="merkelapp">Stengt</span>')}</td>
        <td>${kortDato(k.dato)} ${k.starttid}</td><td>${k.program ? `${k.program.nivaa} ${k.program.navn}` : ''}</td>
        <td>${POSISJONER.filter((p) => k.dommere?.[p]).map((p) => `${p}: ${dommerNavn(k.dommere[p])}`).join(', ')}</td>
        <td class="tall">${k.antallPameldt}${k.antallVenteliste ? ` (+${k.antallVenteliste})` : ''}</td>
        <td>${STATUS_KLASSE[k.status]}${k.offisiell ? raw(' <span class="merkelapp ok">Offisiell</span>') : ''}</td>
        <td><a class="knapp liten" href="#/klasser/${k.id}">Rediger</a></td></tr>`))}</tbody>
    </table></div>`;
}

function redigerKlasse(k) {
  const ny = !k;
  k = k || { apen: true, intervall: 7, pauseEtter: 8, pauseMin: 15, premieAndel: 0.25, starttid: '09:00', dato: o.stevne.datoFra, dommere: {}, maksStartende: 0, status: 'planlagt' };
  app.innerHTML = html`
    <a href="#/klasser">← Klasser</a>
    <form class="kort" id="klasseskjema" style="margin-top:10px">
      <h2>${ny ? 'Ny klasse' : `Rediger ${k.navn}`}</h2>
      <div class="felter">
        ${felt('nr', 'Klassenr.', k.nr, 'type="number" min="1"')}
        ${felt('navn', 'Navn', k.navn, 'required placeholder="F.eks. LA åpen"')}
        <div class="felt"><label>Program<select name="programId" required ${k.harBedommelse ? 'disabled' : ''}><option value="">Velg …</option>${o.programmer.map((p) => raw(html`<option value="${p.id}" ${p.id === k.programId ? 'selected' : ''}>${p.nivaa} – ${p.navn}</option>`))}</select></label></div>
        ${felt('dato', 'Dato', k.dato, 'type="date" required')}
        ${felt('starttid', 'Første start', k.starttid, 'type="time" required')}
        ${felt('intervall', 'Minutter per ekvipasje', k.intervall, 'type="number" min="1"')}
        ${felt('pauseEtter', 'Pause etter hver … start (0 = ingen)', k.pauseEtter, 'type="number" min="0"')}
        ${felt('pauseMin', 'Pauselengde (min)', k.pauseMin, 'type="number" min="0"')}
        ${felt('startavgift', 'Startavgift (kr)', k.startavgift, 'type="number" min="0"')}
        ${felt('maksStartende', 'Maks startende (0 = ubegrenset)', k.maksStartende, 'type="number" min="0"')}
        ${felt('premieAndel', 'Andel premierte (0,25 = 1/4)', k.premieAndel, 'type="number" min="0" max="1" step="0.01"')}
        ${felt('minAlder', 'Rytter minst (år)', k.minAlder, 'type="number" min="0"')}
        ${felt('maksAlder', 'Rytter høyst (år)', k.maksAlder, 'type="number" min="0"')}
        <div class="felt"><label>Status<select name="status">${Object.entries(STATUS_KLASSE).map(([v, t]) => raw(html`<option value="${v}" ${k.status === v ? 'selected' : ''}>${t}</option>`))}</select></label></div>
      </div>
      <h3>Dommere</h3>
      <p class="dempet">Hoveddommeren sitter alltid på C. Med to dommere: C og E eller B; tre: C, M og E eller C, H og B; fem: alle (KR IV § 430.8).</p>
      <div class="felter">${POSISJONER.map((pos) => raw(html`<div class="felt"><label>${pos}${pos === 'C' ? ' (hoveddommer)' : ''}<select name="dommere.${pos}"><option value="">–</option>${o.dommere.map((d) => raw(html`<option value="${d.id}" ${k.dommere?.[pos] === d.id ? 'selected' : ''}>${d.navn}</option>`))}</select></label></div>`))}</div>
      ${avkryss('apen', 'Åpen for påmelding', k.apen)}
      ${avkryss('startlistePublisert', 'Startlisten er publisert', k.startlistePublisert)}
      ${avkryss('clearRound', 'Clear round (ingen rangering, 50 % eller mer gir sløyfe)', k.clearRound)}
      ${avkryss('ponni', 'Klasse for ponni', k.ponni)}
      <div class="felt"><label>Merknad (vises offentlig)<input name="merknad" value="${k.merknad || ''}"></label></div>
      <div class="rad"><button class="primar">Lagre</button>${ny ? '' : raw('<button type="button" class="fare" id="slett">Slett klassen</button>')}</div>
    </form>`;
  $('#klasseskjema').onsubmit = async (e) => {
    e.preventDefault();
    const d = skjemaData(e.target);
    if (k.harBedommelse) d.programId = k.programId;
    try {
      await api(ny ? '/api/admin/klasser' : `/api/admin/klasser/${k.id}`, { metode: ny ? 'POST' : 'PUT', data: d });
      melding('Klassen er lagret.');
      location.hash = '#/klasser';
    } catch (err) { melding(err.message, 'feil'); }
  };
  $('#slett')?.addEventListener('click', async () => {
    if (!confirm(`Slette ${k.navn}?`)) return;
    try { await api(`/api/admin/klasser/${k.id}`, { metode: 'DELETE' }); location.hash = '#/klasser'; } catch (err) { melding(err.message, 'feil'); }
  });
}

// ---------- program ----------

function visProgrammer(id) {
  if (id) return redigerProgram(id === 'ny' ? null : o.programmer.find((p) => p.id === id));
  app.innerHTML = html`
    <div class="rad mellom"><h1>Program</h1><a class="knapp primar" href="#/programmer/ny">Nytt program</a></div>
    <p class="dempet">Legg inn dressurprogrammene som brukes, med øvelser, koeffisienter og allment inntrykk slik de står på protokollen. NRYFs og FEIs program er opphavsrettslig beskyttet og hentes fra rytter.no.</p>
    <div class="kort tabell-boks"><table>
      <thead><tr><th>Nivå</th><th>Program</th><th>Type</th><th>Bane</th><th class="tall">Øvelser</th><th class="tall">Maks</th><th></th></tr></thead>
      <tbody>${o.programmer.map((p) => raw(html`<tr><td>${p.nivaa}</td><td><b>${p.navn}</b>${p.laast ? raw(' <span class="merkelapp">I bruk</span>') : ''}</td><td>${p.type === 'kur' ? 'Kür' : 'Standard'}</td><td>${p.bane}</td>
        <td class="tall">${p.ovelser.length} + ${p.helhet.length}</td><td class="tall">${p.maks}</td><td><a class="knapp liten" href="#/programmer/${p.id}">Rediger</a></td></tr>`))}</tbody>
    </table></div>`;
}

function redigerProgram(p) {
  const ny = !p;
  p = p ? structuredClone(p) : {
    navn: '', nivaa: 'LC', type: 'standard', bane: '20 x 40 m', bisling: 'Trinse', tid: 5, karakterSteg: 0.5, ovelser: [{ punkt: '', tekst: '', koeff: 1 }],
    helhet: [{ tekst: 'Takt', koeff: 2 }, { tekst: 'Løsgjorthet og kontakt', koeff: 2 }, { tekst: 'Rytterens sits og hjelpere', koeff: 2 }, { tekst: 'Nøyaktighet', koeff: 2 }],
  };
  const tegn = () => {
    const maks = p.ovelser.reduce((s, x) => s + (Number(x.koeff) || 1) * 10, 0) + p.helhet.reduce((s, x) => s + (Number(x.koeff) || 1) * 10, 0);
    app.innerHTML = html`
      <a href="#/programmer">← Program</a>
      <form class="kort" id="progskjema" style="margin-top:10px">
        <h2>${ny ? 'Nytt program' : p.navn}</h2>
        ${p.laast ? raw('<div class="varsel advarsel">Programmet er i bruk i en klasse med karakterer. Bare tekster kan endres.</div>') : ''}
        <div class="felter">
          ${felt('navn', 'Navn', p.navn, 'required placeholder="F.eks. LA:1 NRYF 2025"')}
          <div class="felt"><label>Nivå<select name="nivaa">${NIVAAER.map((n) => raw(html`<option ${p.nivaa === n ? 'selected' : ''}>${n}</option>`))}</select></label></div>
          <div class="felt"><label>Type<select name="type"><option value="standard">Standard</option><option value="kur" ${p.type === 'kur' ? 'selected' : ''}>Kür</option></select></label></div>
          ${felt('bane', 'Bane', p.bane)}
          ${felt('bisling', 'Bisling', p.bisling)}
          ${felt('tid', 'Tid (ca. min)', p.tid, 'type="number" step="0.5"')}
          ${p.type === 'kur' ? felt('kurTid', 'Kür-tid (f.eks. 4:30–5:00)', p.kurTid) : ''}
          <div class="felt"><label>Karaktersteg<select name="karakterSteg">${[[0.5, 'Halve (7,5)'], [0.1, 'Tideler (7,1)'], [1, 'Hele']].map(([v, t]) => raw(html`<option value="${v}" ${Number(p.karakterSteg) === v ? 'selected' : ''}>${t}</option>`))}</select></label></div>
        </div>
        <h3>Øvelser <small class="dempet">(bedømmingsgrupper)</small></h3>
        ${p.ovelser.map((x, i) => raw(html`<div class="prog-rad"><span><b>${i + 1}</b></span>
          <input data-o="${i}" data-f="punkt" value="${x.punkt}" placeholder="Punkt, f.eks. KXM">
          <input data-o="${i}" data-f="tekst" value="${x.tekst}" placeholder="Øvelse">
          <input data-o="${i}" data-f="koeff" type="number" min="1" max="5" value="${x.koeff}" title="Koeffisient">
          <button type="button" class="liten" data-slett-o="${i}" title="Fjern">✕</button></div>`))}
        <div class="rad"><button type="button" class="liten" id="ny-o">+ Øvelse</button>
          <details><summary class="dempet" style="cursor:pointer">Lim inn mange</summary>
            <textarea id="lim" rows="6" placeholder="Én øvelse per linje: punkt;øvelse;koeffisient&#10;A–X;Innridning i samlet trav, holdt – hilsning;1"></textarea>
            <button type="button" class="liten" id="lim-inn">Legg til linjene</button></details></div>
        <h3 style="margin-top:16px">${p.type === 'kur' ? 'Kunstnerisk inntrykk' : 'Allment inntrykk'}</h3>
        ${p.helhet.map((x, i) => raw(html`<div class="prog-rad helhet"><span><b>${i + 1}</b></span>
          <input data-h="${i}" data-f="tekst" value="${x.tekst}" placeholder="Karakter">
          <input data-h="${i}" data-f="koeff" type="number" min="0.5" step="0.5" value="${x.koeff}" title="Koeffisient">
          <select data-h="${i}" data-f="steg" title="Karaktersteg"><option value="">Som program</option><option value="0.1" ${Number(x.steg) === 0.1 ? 'selected' : ''}>0,1</option><option value="0.5" ${Number(x.steg) === 0.5 ? 'selected' : ''}>0,5</option></select>
          <select data-h="${i}" data-f="rolle" title="Brukes ved lik plassering i kür"><option value="">–</option><option value="harmoni" ${x.rolle === 'harmoni' ? 'selected' : ''}>Harmoni</option><option value="koreografi" ${x.rolle === 'koreografi' ? 'selected' : ''}>Koreografi</option></select>
          <button type="button" class="liten" data-slett-h="${i}">✕</button></div>`))}
        <button type="button" class="liten" id="ny-h">+ Karakter</button>
        <p style="margin-top:14px"><b>Maks poeng: ${maks}</b>${p.type === 'kur' ? ' · Teknisk og kunstnerisk regnes hver for seg og deles på to' : ''}</p>
        <div class="rad"><button class="primar">Lagre program</button>${ny ? '' : raw('<button type="button" class="fare" id="slett">Slett</button>')}</div>
      </form>`;
    const form = $('#progskjema');
    const les = () => {
      Object.assign(p, Object.fromEntries(['navn', 'nivaa', 'type', 'bane', 'bisling', 'tid', 'kurTid', 'karakterSteg'].filter((n) => form[n]).map((n) => [n, form[n].value])));
      $$('[data-o]', form).forEach((el) => { p.ovelser[el.dataset.o][el.dataset.f] = el.value; });
      $$('[data-h]', form).forEach((el) => { p.helhet[el.dataset.h][el.dataset.f] = el.value; });
    };
    form.type.onchange = () => { les(); tegn(); };
    $$('[data-o][data-f=koeff],[data-h][data-f=koeff]', form).forEach((el) => el.addEventListener('change', () => { les(); tegn(); }));
    $('#ny-o').onclick = () => { les(); p.ovelser.push({ punkt: '', tekst: '', koeff: 1 }); tegn(); };
    $('#ny-h').onclick = () => { les(); p.helhet.push({ tekst: '', koeff: 1 }); tegn(); };
    $$('[data-slett-o]', form).forEach((b) => b.addEventListener('click', () => { les(); p.ovelser.splice(b.dataset.slettO, 1); tegn(); }));
    $$('[data-slett-h]', form).forEach((b) => b.addEventListener('click', () => { les(); p.helhet.splice(b.dataset.slettH, 1); tegn(); }));
    $('#lim-inn').onclick = () => {
      les();
      const linjer = $('#lim').value.split('\n').map((l) => l.split(/;|\t/).map((x) => x.trim())).filter((x) => x.join(''));
      p.ovelser = p.ovelser.filter((x) => x.tekst);
      for (const [punkt, tekst, koeff] of linjer) p.ovelser.push(tekst ? { punkt, tekst, koeff: Number(koeff) || 1 } : { punkt: '', tekst: punkt, koeff: 1 });
      tegn();
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      les();
      try {
        await api(ny ? '/api/admin/programmer' : `/api/admin/programmer/${p.id}`, { metode: ny ? 'POST' : 'PUT', data: p });
        melding('Programmet er lagret.');
        location.hash = '#/programmer';
      } catch (err) { melding(err.message, 'feil'); }
    };
    $('#slett')?.addEventListener('click', async () => {
      if (!confirm('Slette programmet?')) return;
      try { await api(`/api/admin/programmer/${p.id}`, { metode: 'DELETE' }); location.hash = '#/programmer'; } catch (err) { melding(err.message, 'feil'); }
    });
  };
  tegn();
}

// ---------- dommere ----------

function visDommere() {
  app.innerHTML = html`
    <h1>Dommere</h1>
    <div id="nyttpassord"></div>
    <div class="kort tabell-boks"><table>
      <thead><tr><th>Navn</th><th>Brukernavn</th><th>Autorisasjon</th><th>Klasser</th><th></th></tr></thead>
      <tbody>${o.dommere.map((d) => raw(html`<tr><td><b>${d.navn}</b><br><small>${d.epost}</small></td><td><code>${d.brukernavn}</code></td><td>${d.autorisasjon}</td>
        <td>${o.klasser.filter((k) => Object.values(k.dommere || {}).includes(d.id)).map((k) => `${k.navn} (${POSISJONER.find((p) => k.dommere[p] === d.id)})`).join(', ')}</td>
        <td class="rad"><button class="liten" data-passord="${d.id}">Nytt passord</button><button class="liten fare" data-slett="${d.id}">Slett</button></td></tr>`))}</tbody>
    </table></div>
    <form class="kort" id="nydommer">
      <h2>Ny dommer</h2>
      <div class="felter">${felt('navn', 'Navn', '', 'required')}${felt('brukernavn', 'Brukernavn', '', 'required autocapitalize="none" pattern="[a-z0-9._-]{2,40}"')}${felt('autorisasjon', 'Autorisasjon', '', 'placeholder="F.eks. Nasjonal dommer"')}${felt('epost', 'E-post', '', 'type="email"')}</div>
      <button class="primar">Opprett og lag passord</button>
    </form>
    <p class="dempet">Dommerne logger inn på <b>${location.origin}/dommer</b>. Passordet vises bare én gang – gi det til dommeren personlig.</p>`;
  const visPassord = (d) => {
    $('#nyttpassord').innerHTML = html`<div class="varsel ok">Innlogging for <b>${d.navn}</b>: brukernavn <code>${d.brukernavn}</code>, passord <code style="font-size:1.2rem">${d.passord}</code></div>`;
  };
  $('#nydommer').onsubmit = async (e) => {
    e.preventDefault();
    try { const d = await api('/api/admin/dommere', { metode: 'POST', data: skjemaData(e.target) }); await rute(); visPassord(d); } catch (err) { melding(err.message, 'feil'); }
  };
  $$('[data-passord]').forEach((b) => b.addEventListener('click', async () => {
    const d = o.dommere.find((x) => x.id === b.dataset.passord);
    if (!confirm(`Lage nytt passord for ${d.navn}? Det gamle slutter å virke.`)) return;
    try { const svar = await api(`/api/admin/dommere/${d.id}`, { metode: 'PUT', data: { ...d, nyttPassord: true } }); visPassord(svar); } catch (err) { melding(err.message, 'feil'); }
  }));
  $$('[data-slett]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Slette dommeren?')) return;
    lagreOgVis(() => api(`/api/admin/dommere/${b.dataset.slett}`, { metode: 'DELETE' }), 'Slettet.');
  }));
}

// ---------- påmeldinger ----------

let filter = { klasse: '', status: '', sok: '' };
function visPameldinger() {
  const liste = o.paameldinger.filter((p) => (!filter.klasse || p.klasseId === filter.klasse) && (!filter.status || p.status === filter.status)
    && (!filter.sok || `${p.rytter.navn} ${p.hest.navn} ${p.rytter.klubb} ${p.kode}`.toLowerCase().includes(filter.sok.toLowerCase())));
  app.innerHTML = html`
    <div class="rad mellom"><h1>Påmeldinger</h1><span class="rad"><button class="liten" id="startnr">Tildel startnummer</button><a class="knapp liten" href="/api/admin/eksport/paameldinger.csv">Last ned (Excel/CSV)</a></span></div>
    <div class="kort rad">
      <select id="f-klasse" style="max-width:240px"><option value="">Alle klasser</option>${o.klasser.map((k) => raw(html`<option value="${k.id}" ${filter.klasse === k.id ? 'selected' : ''}>${klasseNavn(k.id)}</option>`))}</select>
      <select id="f-status" style="max-width:160px"><option value="">Alle statuser</option>${Object.entries(STATUS_PAMELDING).map(([v, t]) => raw(html`<option value="${v}" ${filter.status === v ? 'selected' : ''}>${t}</option>`))}</select>
      <input id="f-sok" placeholder="Søk navn, hest, klubb eller kode" value="${filter.sok}" style="max-width:280px">
      <span class="dempet">${liste.length} rader</span>
    </div>
    <div class="kort tabell-boks"><table>
      <thead><tr><th class="tall">Nr</th><th>Rytter</th><th>Hest</th><th>Klasse</th><th>Status</th><th>Betalt</th><th></th></tr></thead>
      <tbody>${liste.map((p) => raw(html`<tr>
        <td class="tall"><input type="number" min="1" value="${p.startnr ?? ''}" data-startnr="${p.id}" style="width:72px;min-height:34px;padding:4px"></td>
        <td><b>${p.rytter.navn}</b> <small>(${p.rytter.fodselsaar || '?'})</small><br><small>${p.rytter.klubb} · ${p.rytter.epost} ${p.rytter.tlf} ${p.rytter.lisens ? `· lisens ${p.rytter.lisens}` : ''}</small></td>
        <td>${p.hest.navn}<br><small>${[p.hest.fodselsaar, p.hest.kjonn, p.hest.type === 'ponni' ? 'ponni' : '', p.hest.pass].filter(Boolean).join(' · ')}</small></td>
        <td><select data-klasse="${p.id}" style="min-height:34px;padding:4px">${o.klasser.map((k) => raw(html`<option value="${k.id}" ${k.id === p.klasseId ? 'selected' : ''}>${klasseNavn(k.id)}</option>`))}</select>
          ${p.etteranmeldt ? raw('<br><span class="merkelapp advarsel">Etteranmeldt</span>') : ''}${p.merknad ? raw(html`<br><small>💬 ${p.merknad}</small>`) : ''}</td>
        <td><select data-status="${p.id}" style="min-height:34px;padding:4px">${Object.entries(STATUS_PAMELDING).map(([v, t]) => raw(html`<option value="${v}" ${p.status === v ? 'selected' : ''}>${t}</option>`))}</select><br><small>Kode ${p.kode}</small></td>
        <td><input type="checkbox" data-betalt="${p.id}" ${p.betalt ? 'checked' : ''} style="width:22px;height:22px"></td>
        <td><button class="liten fare" data-slett="${p.id}" title="Slett">✕</button></td>
      </tr>`))}</tbody>
    </table></div>`;
  const oppdater = (id, data) => api(`/api/admin/paameldinger/${id}`, { metode: 'PUT', data }).then(() => melding('Lagret.')).catch((e) => { melding(e.message, 'feil'); rute(); });
  $('#f-klasse').onchange = (e) => { filter.klasse = e.target.value; visPameldinger(); };
  $('#f-status').onchange = (e) => { filter.status = e.target.value; visPameldinger(); };
  $('#f-sok').oninput = (e) => { filter.sok = e.target.value; clearTimeout(e.target._t); e.target._t = setTimeout(() => { visPameldinger(); $('#f-sok').focus(); $('#f-sok').setSelectionRange(99, 99); }, 300); };
  $$('[data-startnr]').forEach((el) => el.addEventListener('change', () => oppdater(el.dataset.startnr, { startnr: el.value })));
  $$('[data-klasse]').forEach((el) => el.addEventListener('change', () => oppdater(el.dataset.klasse, { klasseId: el.value }).then(rute)));
  $$('[data-status]').forEach((el) => el.addEventListener('change', () => oppdater(el.dataset.status, { status: el.value }).then(rute)));
  $$('[data-betalt]').forEach((el) => el.addEventListener('change', () => oppdater(el.dataset.betalt, { betalt: el.checked })));
  $$('[data-slett]').forEach((b) => b.addEventListener('click', () => {
    if (confirm('Slette påmeldingen helt? (Bruk heller status Trukket hvis rytteren trekker seg.)')) lagreOgVis(() => api(`/api/admin/paameldinger/${b.dataset.slett}`, { metode: 'DELETE' }), 'Slettet.');
  }));
  $('#startnr').onclick = () => lagreOgVis(() => api('/api/admin/startnummer', { metode: 'POST', data: {} }), 'Startnummer tildelt.');
}

// ---------- startlister ----------

async function visStartlister(id) {
  const k = o.klasser.find((x) => x.id === id) || [...o.klasser].sort((a, b) => a.dato.localeCompare(b.dato) || (a.nr || 0) - (b.nr || 0))[0];
  if (!k) { app.innerHTML = '<p class="dempet">Ingen klasser ennå.</p>'; return; }
  const s = await api(`/api/startliste/${k.id}`);
  app.innerHTML = html`
    <div class="rad ikke-utskrift" style="margin-bottom:12px">${o.klasser.map((x) => raw(html`<a class="knapp liten ${x.id === k.id ? 'primar' : ''}" href="#/startlister/${x.id}">${klasseNavn(x.id)}</a>`))}</div>
    ${o.konflikter.length ? raw(html`<div class="varsel advarsel ikke-utskrift">${o.konflikter.map((x) => raw(html`${x.tekst}<br>`))}</div>`) : ''}
    <section class="kort">
      <div class="rad mellom"><h1>${klasseNavn(k.id)}</h1>
        <span class="rad ikke-utskrift">
          <button class="liten" id="trekk" ${k.harBedommelse ? 'disabled' : ''}>Trekk startrekkefølge</button>
          <button class="liten ${k.startlistePublisert ? '' : 'primar'}" id="publiser">${k.startlistePublisert ? 'Skjul startlisten' : 'Publiser startlisten'}</button>
          <button class="liten" data-skriv-ut>Skriv ut</button>
        </span></div>
      <p class="dempet">${kortDato(k.dato)} fra kl. ${k.starttid} · ${k.intervall} min per ekvipasje${k.pauseEtter ? ` · ${k.pauseMin} min pause etter hver ${k.pauseEtter}. start` : ''} · ${k.startlistePublisert ? 'publisert' : 'ikke publisert'}</p>
      <div class="tabell-boks"><table>
        <thead><tr><th class="tall">#</th><th>Tid</th><th class="tall">Nr</th><th>Rytter</th><th>Klubb</th><th>Hest</th><th class="ikke-utskrift"></th></tr></thead>
        <tbody>${s.rader.map((r, i) => raw(html`<tr><td class="tall">${r.startrekke ?? ''}</td><td>${r.starttid ?? ''}</td><td class="tall"><b>${r.startnr ?? ''}</b></td><td>${r.rytter.navn}</td><td>${r.rytter.klubb}</td><td>${r.hest.navn}</td>
          <td class="ikke-utskrift rad"><button class="liten" data-opp="${i}" ${i ? '' : 'disabled'}>▲</button><button class="liten" data-ned="${i}" ${i < s.rader.length - 1 ? '' : 'disabled'}>▼</button></td></tr>`))}</tbody>
      </table></div>
      <p class="dempet ikke-utskrift">Trekningen spreder ryttere med flere hester med minst fem ekvipasjer mellom, og starttidene får ekstra pause om noen ellers får under 12 minutter mellom startene (KR IV § 424.4). Flytt med pilene for å justere – tidene regnes ut på nytt.</p>
    </section>`;
  $('#trekk').onclick = () => {
    if (s.rader.some((r) => r.startrekke) && !confirm('Trekke ny startrekkefølge? Den gamle forsvinner.')) return;
    lagreOgVis(() => api(`/api/admin/klasser/${k.id}/trekning`, { metode: 'POST', data: {} }), 'Startrekkefølgen er trukket.');
  };
  $('#publiser').onclick = () => lagreOgVis(() => api(`/api/admin/klasser/${k.id}`, { metode: 'PUT', data: { ...k, startlistePublisert: !k.startlistePublisert } }));
  const flytt = (i, j) => {
    const ider = s.rader.map((r) => r.id);
    [ider[i], ider[j]] = [ider[j], ider[i]];
    lagreOgVis(() => api(`/api/admin/klasser/${k.id}/rekkefolge`, { metode: 'PUT', data: { ider } }), 'Flyttet.');
  };
  $$('[data-opp]').forEach((b) => b.addEventListener('click', () => flytt(Number(b.dataset.opp), Number(b.dataset.opp) - 1)));
  $$('[data-ned]').forEach((b) => b.addEventListener('click', () => flytt(Number(b.dataset.ned), Number(b.dataset.ned) + 1)));
  if (location.hash !== `#/startlister/${k.id}`) history.replaceState(null, '', `#/startlister/${k.id}`);
}

// ---------- resultater ----------

let resultatTimer = null;
async function visResultater(id) {
  clearTimeout(resultatTimer);
  const k = o.klasser.find((x) => x.id === id) || o.klasser.find((x) => x.status === 'pagar') || o.klasser[0];
  if (!k) { app.innerHTML = '<p class="dempet">Ingen klasser ennå.</p>'; return; }
  const r = await api(`/api/admin/resultater/${k.id}`);
  const moter = r.rader.filter((x) => x.dommermote);
  app.innerHTML = html`
    <div class="rad ikke-utskrift" style="margin-bottom:12px">${o.klasser.map((x) => raw(html`<a class="knapp liten ${x.id === k.id ? 'primar' : ''}" href="#/resultater/${x.id}">${klasseNavn(x.id)}</a>`))}</div>
    <section class="kort">
      <div class="rad mellom"><h1>${klasseNavn(k.id)}</h1>
        <span class="rad ikke-utskrift">
          <span class="merkelapp ${k.offisiell ? 'ok' : 'gull'}">${k.offisiell ? 'Offisiell' : STATUS_KLASSE[k.status]}</span>
          <button class="liten ${k.offisiell ? '' : 'primar'}" id="offisiell">${k.offisiell ? 'Åpne for retting' : 'Gjør resultatlisten offisiell'}</button>
          <a class="knapp liten" href="/api/admin/eksport/resultater-${k.id}.csv">CSV</a>
          <a class="knapp liten" href="/protokoll?klasse=${k.id}" target="_blank">Alle protokoller</a>
          <button class="liten" data-skriv-ut>Skriv ut</button>
        </span></div>
      <p class="dempet">${r.startende} startende · ${k.clearRound ? 'Clear round' : `${r.antallPremier} premier (${Math.round((k.premieAndel ?? 0.25) * 100)} %)`} · oppdateres automatisk</p>
      ${moter.length ? raw(html`<div class="varsel advarsel">Avvik på 7 prosentpoeng eller mer mellom dommerne for ${moter.map((x) => `${x.startnr ?? ''} ${x.rytter.navn}`).join(', ')}. Hoveddommeren vurderer dommermøte (KR IV § 450.6).</div>`) : ''}
      <div class="tabell-boks"><table>
        <thead><tr><th class="tall">Plass</th><th class="tall">Nr</th><th>Rytter / hest</th>${r.posisjoner.map((p) => raw(html`<th class="tall">${p}<br><small>${dommerNavn(k.dommere[p])}</small></th>`))}<th class="tall">Prosent</th><th class="tall">Avvik</th><th class="ikke-utskrift"></th></tr></thead>
        <tbody>${r.rader.map((x) => raw(html`<tr class="${x.premie ? 'premie' : ''}">
          <td class="tall plass">${x.clearRound ? 'CR' : x.plassering ?? ''}</td><td class="tall">${x.startnr ?? ''}</td>
          <td><b>${x.rytter.navn}</b> – ${x.hest.navn}<br><small>${x.rytter.klubb}</small></td>
          ${r.posisjoner.map((p) => raw(html`<td class="tall">${x.perDommer[p].prosent != null ? formatProsent(x.perDommer[p].prosent) : x.perDommer[p].poeng ? raw(html`<small>${formatKarakter(x.perDommer[p].poeng)} p</small>`) : ''}${x.perDommer[p].signert ? '' : raw('<br><small>ikke signert</small>')}</td>`))}
          <td class="tall"><span class="prosent">${x.prosent != null ? formatProsent(x.prosent) : ''}</span>${x.status !== 'ferdig' ? raw(html`<br><small>${x.statusTekst}${x.elimGrunn ? `: ${x.elimGrunn}` : ''}</small>`) : ''}${x.premie ? raw('<br><span class="merkelapp gull">Premie</span>') : ''}</td>
          <td class="tall">${x.avvik != null ? raw(html`<span class="${x.dommermote ? 'merkelapp advarsel' : ''}">${formatProsent(x.avvik)}</span>`) : ''}</td>
          <td class="ikke-utskrift"><a class="knapp liten" href="/protokoll?id=${x.id}" target="_blank">Protokoll</a></td>
        </tr>`))}</tbody>
      </table></div>
    </section>`;
  $('#offisiell').onclick = () => {
    const ny = !k.offisiell;
    if (ny && !confirm('Gjøre resultatlisten offisiell? Protokollene låses, og rytterne kan hente sine protokoller med påmeldingskoden.')) return;
    lagreOgVis(() => api(`/api/admin/klasser/${k.id}/offisiell`, { metode: 'POST', data: { offisiell: ny } }), ny ? 'Resultatlisten er offisiell.' : 'Åpnet for retting.');
  };
  if (location.hash !== `#/resultater/${k.id}`) history.replaceState(null, '', `#/resultater/${k.id}`);
  if (!k.offisiell) resultatTimer = setTimeout(() => { if (location.hash === `#/resultater/${k.id}`) rute(); }, 10000);
}

// ---------- logg og sikkerhetskopi ----------

async function visSystem() {
  const logg = await api('/api/admin/logg');
  app.innerHTML = html`
    <section class="kort">
      <h2>Sikkerhetskopi</h2>
      <p>Last ned alt (stevne, program, klasser, dommere, påmeldinger og protokoller) som én fil. Ta kopi jevnlig under stevnet.</p>
      <div class="rad"><button class="primar" id="backup">Last ned sikkerhetskopi</button>
        <label class="knapp" style="margin:0">Gjenopprett fra fil<input type="file" id="gjenopprett" accept="application/json" hidden></label></div>
    </section>
    <section class="kort">
      <h2>Demostevne</h2>
      <p>Erstatter alle data med et demostevne med tre klasser, to dommere og seks ekvipasjer, slik at løsningen kan prøves.</p>
      <button class="fare" id="demo">Last inn demostevne</button>
      <div id="demopassord"></div>
    </section>
    <section class="kort">
      <h2>Logg</h2>
      <div class="tabell-boks"><table><tbody>${logg.map((l) => raw(html`<tr><td style="white-space:nowrap">${tidspunkt(l.tid)}</td><td>${l.hvem}</td><td>${l.hva}</td></tr>`))}</tbody></table></div>
    </section>`;
  $('#backup').onclick = async () => {
    const data = await api('/api/admin/sikkerhetskopi');
    lastNed(`dressur-${new Date().toISOString().slice(0, 16).replace(':', '')}.json`, JSON.stringify(data, null, 1));
  };
  $('#gjenopprett').onchange = async (e) => {
    const fil = e.target.files[0];
    if (!fil || !confirm('Erstatte alle data med innholdet i filen?')) return;
    try { await api('/api/admin/gjenopprett', { metode: 'POST', data: JSON.parse(await fil.text()) }); melding('Gjenopprettet.'); rute(); } catch (err) { melding(err.message, 'feil'); }
  };
  $('#demo').onclick = async () => {
    if (!confirm('Erstatte ALLE data med demostevnet?')) return;
    try {
      const svar = await api('/api/admin/demo', { metode: 'POST', data: {} });
      await last();
      $('#demopassord').innerHTML = html`<div class="varsel ok" style="margin-top:10px">Demostevnet er lastet. Dommerinnlogging på /dommer:<br>kari / <code>${svar.passord.kari}</code> (C, hoveddommer)<br>ola / <code>${svar.passord.ola}</code></div>`;
    } catch (err) { melding(err.message, 'feil'); }
  };
}

start();
