// Offentlig side: stevneinfo, påmelding, startlister, live resultater og egne påmeldinger.
import { api, html, raw, $, $$, datoTekst, kortDato, kr, melding, skjemaData, STATUS_KLASSE, STATUS_PAMELDING } from './felles.js';
import { formatProsent } from './beregning.js';

const app = $('#app');
let data = null;
let oppdatering = null;
const sistSett = new Map();

async function lastStevne() {
  data = await api('/api/stevne');
  const s = data.stevne;
  document.title = s.navn ? `${s.navn} – dressur` : 'Dressurstevne';
  $('#stevnenavn').innerHTML = html`${s.navn || 'Dressurstevne'}<small>${[s.sted, s.datoFra && kortDato(s.datoFra)].filter(Boolean).join(' · ') || 'Påmelding og resultater'}</small>`;
}

function klassemeta(k) {
  return [kortDato(k.dato), k.starttid && `kl. ${k.starttid}`, k.program && `${k.program.nivaa} · ${k.program.navn}`].filter(Boolean).join(' · ');
}

function visStevne() {
  const s = data.stevne;
  const frist = s.pameldingsfrist ? new Date(s.pameldingsfrist) : null;
  const perDag = new Map();
  for (const k of data.klasser) { if (!perDag.has(k.dato)) perDag.set(k.dato, []); perDag.get(k.dato).push(k); }
  app.innerHTML = html`
    <section class="kort">
      <h1>${s.navn || 'Dressurstevne'}</h1>
      <p class="dempet">${[s.sted, s.arrangor && `Arrangør: ${s.arrangor}`, s.stevnenivaa && `Stevnenivå: ${s.stevnenivaa}`].filter(Boolean).join(' · ')}</p>
      ${s.datoFra ? raw(html`<p><b>${datoTekst(s.datoFra)}${s.datoTil && s.datoTil !== s.datoFra ? ` – ${datoTekst(s.datoTil)}` : ''}</b></p>`) : ''}
      ${frist ? raw(html`<p>Påmeldingsfrist: <b>${frist.toLocaleString('nb-NO', { dateStyle: 'long', timeStyle: 'short' })}</b>${s.tillatEtteranmelding ? ` · etteranmelding mulig${s.etteranmeldingsgebyr ? ` (gebyr ${kr(s.etteranmeldingsgebyr)})` : ''}` : ''}</p>`) : ''}
      ${s.overdommer ? raw(html`<p>Overdommer: ${s.overdommer}</p>`) : ''}
      ${s.info ? raw(html`<p style="white-space:pre-line">${s.info}</p>`) : ''}
      ${s.kontakt ? raw(html`<p class="dempet">Kontakt: ${s.kontakt}</p>`) : ''}
      <a class="knapp primar" href="#/pamelding">Meld på</a>
    </section>
    ${[...perDag].map(([dato, klasser]) => raw(html`
      <h2>${datoTekst(dato)}</h2>
      <div class="rutenett">${klasser.map((k) => raw(klassekort(k)))}</div>`))}
    ${data.klasser.length ? '' : raw('<p class="dempet">Ingen klasser er lagt ut ennå.</p>')}`;
}

function klassekort(k) {
  return html`
    <article class="kort klassekort">
      <div class="rad mellom"><h3>${k.nr ? `${k.nr}. ` : ''}${k.navn}</h3><span class="merkelapp ${k.status === 'pagar' ? 'gull' : k.status === 'avsluttet' ? 'ok' : ''}">${STATUS_KLASSE[k.status]}</span></div>
      <p class="meta">${klassemeta(k)}</p>
      <p class="meta">${[k.program?.bane && `Bane ${k.program.bane}`, k.program?.bisling, k.program?.tid && `ca. ${k.program.tid} min`, k.clearRound && 'Clear round', k.ponni && 'Ponni'].filter(Boolean).join(' · ')}</p>
      <p class="meta">Dommere: ${k.dommere.map((d) => `${d.pos}: ${d.navn}`).join(', ') || 'ikke satt opp'}</p>
      <p class="meta">${k.antallPameldt} påmeldt${k.maksStartende ? ` av ${k.maksStartende}` : ''}${k.antallVenteliste ? ` · ${k.antallVenteliste} på venteliste` : ''}${k.startavgift ? ` · ${kr(k.startavgift)}` : ''}</p>
      ${k.merknad ? raw(html`<p class="meta">${k.merknad}</p>`) : ''}
      <div class="rad">
        ${k.startlistePublisert ? raw(html`<a class="knapp liten" href="#/startlister/${k.id}">Startliste</a>`) : ''}
        ${k.status !== 'planlagt' ? raw(html`<a class="knapp liten" href="#/resultater/${k.id}">Resultater</a>`) : ''}
      </div>
    </article>`;
}

function visPamelding() {
  const s = data.stevne;
  const aapne = data.klasser.filter((k) => k.apen && k.status === 'planlagt');
  const frist = s.pameldingsfrist ? new Date(s.pameldingsfrist) : null;
  const etter = frist && new Date() > frist;
  if (etter && !s.tillatEtteranmelding) {
    app.innerHTML = html`<section class="kort"><h1>Påmelding</h1><p>Påmeldingsfristen gikk ut ${frist.toLocaleString('nb-NO')}. Kontakt sekretariatet${s.kontakt ? ` (${s.kontakt})` : ''}.</p></section>`;
    return;
  }
  const lagret = (() => { try { return JSON.parse(localStorage.getItem('dressur-rytter') || 'null'); } catch { return null; } })();
  app.innerHTML = html`
    <form class="kort" id="pameldingsskjema" novalidate>
      <h1>Påmelding</h1>
      ${etter ? raw(html`<div class="varsel advarsel">Påmeldingsfristen er ute. Dette blir en etteranmelding${s.etteranmeldingsgebyr ? ` med gebyr ${kr(s.etteranmeldingsgebyr)}` : ''}.</div>`) : ''}
      <h2>Rytter</h2>
      <div class="felter">
        <div class="felt"><label for="r-navn">Navn *</label><input id="r-navn" name="rytter.navn" required autocomplete="name" value="${lagret?.navn || ''}"></div>
        <div class="felt"><label for="r-fa">Fødselsår *</label><input id="r-fa" name="rytter.fodselsaar" type="number" inputmode="numeric" min="1920" max="2030" required value="${lagret?.fodselsaar || ''}"></div>
        <div class="felt"><label for="r-klubb">Klubb</label><input id="r-klubb" name="rytter.klubb" autocomplete="organization" value="${lagret?.klubb || ''}"></div>
        <div class="felt"><label for="r-lisens">Rytterlisens nr.</label><input id="r-lisens" name="rytter.lisens" value="${lagret?.lisens || ''}"></div>
        <div class="felt"><label for="r-epost">E-post *</label><input id="r-epost" name="rytter.epost" type="email" required autocomplete="email" value="${lagret?.epost || ''}"></div>
        <div class="felt"><label for="r-tlf">Mobil</label><input id="r-tlf" name="rytter.tlf" type="tel" autocomplete="tel" value="${lagret?.tlf || ''}"></div>
      </div>
      <h2>Hest</h2>
      <div class="felter">
        <div class="felt"><label for="h-navn">Hestens navn *</label><input id="h-navn" name="hest.navn" required></div>
        <div class="felt"><label for="h-pass">Pass-/UELN-nr.</label><input id="h-pass" name="hest.pass"></div>
        <div class="felt"><label for="h-fa">Fødselsår *</label><input id="h-fa" name="hest.fodselsaar" type="number" inputmode="numeric" min="1980" max="2030" required></div>
        <div class="felt"><label for="h-kjonn">Kjønn</label><select id="h-kjonn" name="hest.kjonn"><option value="">–</option><option>Hoppe</option><option>Vallak</option><option>Hingst</option></select></div>
        <div class="felt"><label for="h-type">Type</label><select id="h-type" name="hest.type"><option value="hest">Hest</option><option value="ponni">Konkurranseponni</option></select></div>
        <div class="felt"><label for="h-eier">Eier</label><input id="h-eier" name="hest.eier"></div>
      </div>
      <h2>Klasser</h2>
      ${aapne.length ? '' : raw('<p class="dempet">Ingen klasser er åpne for påmelding nå.</p>')}
      <div id="klassevalg">${aapne.map((k) => raw(html`
        <label class="valg-klasse"><input type="checkbox" name="klasser" data-liste value="${k.id}">
          <span><b>${k.nr ? `${k.nr}. ` : ''}${k.navn}</b><br><small>${klassemeta(k)}${k.startavgift ? ` · ${kr(k.startavgift)}` : ''}${k.maksStartende && k.antallPameldt >= k.maksStartende ? ' · fullt – venteliste' : ''}${k.ponni ? ' · bare ponni' : ''}</small></span>
        </label>`))}</div>
      <div class="felt"><label for="merknad">Merknad til sekretariatet</label><textarea id="merknad" name="merknad" placeholder="F.eks. ønske om starttid, deler hest med …"></textarea></div>
      <p class="dempet">Startrekkefølgen trekkes etter påmeldingsfristen. Ryttere med flere hester får minst fem ekvipasjer eller 12 minutter mellom startene (KR IV § 424). Trekk fra en klasse før klassen starter under «Mine påmeldinger».</p>
      <div id="skjemafeil"></div>
      <div class="rad"><button class="primar" type="submit">Send påmelding</button><span id="sum" class="dempet"></span></div>
    </form>`;
  const form = $('#pameldingsskjema');
  const oppdaterSum = () => {
    const valgt = $$('input[name=klasser]:checked', form).map((x) => data.klasser.find((k) => k.id === x.value));
    const sum = valgt.reduce((s2, k) => s2 + (k.startavgift || 0), 0) + (etter && valgt.length ? Number(s.etteranmeldingsgebyr) || 0 : 0);
    $('#sum').textContent = valgt.length ? `${valgt.length} klasse${valgt.length > 1 ? 'r' : ''} · ${kr(sum)}` : '';
  };
  form.addEventListener('change', oppdaterSum);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = skjemaData(form);
    $('#skjemafeil').innerHTML = '';
    try {
      const svar = await api('/api/paamelding', { metode: 'POST', data: d });
      try { localStorage.setItem('dressur-rytter', JSON.stringify(d.rytter)); localStorage.setItem('dressur-kode', svar.kode); } catch { /* privat modus */ }
      app.innerHTML = html`
        <section class="kort">
          <h1>Takk for påmeldingen!</h1>
          ${svar.advarsler.map((a) => raw(html`<div class="varsel advarsel">${a}</div>`))}
          <p>Din påmeldingskode er <b style="font-size:1.4rem;letter-spacing:.08em">${svar.kode}</b>. Ta vare på den – du trenger den for å se eller trekke påmeldingen og for å hente dommerprotokollene etter klassen.</p>
          <table><tbody>${svar.paameldinger.map((p) => raw(html`<tr><td>${p.klasse}</td><td>${p.status === 'venteliste' ? raw('<span class="merkelapp advarsel">Venteliste</span>') : raw('<span class="merkelapp ok">Påmeldt</span>')}</td></tr>`))}</tbody></table>
          <p style="margin-top:1em">Å betale: <b>${kr(svar.sum)}</b>${svar.kategori ? ` · Rytterkategori: ${svar.kategori}` : ''}</p>
          <div class="rad"><a class="knapp" href="#/mine">Mine påmeldinger</a><button id="ny" class="primar">Meld på en hest til</button></div>
        </section>`;
      $('#ny').onclick = () => visPamelding();
      await lastStevne();
    } catch (err) {
      $('#skjemafeil').innerHTML = html`<div class="varsel fare"><pre>${err.message}</pre></div>`;
    }
  });
}

async function visStartlister(klasseId) {
  const synlige = data.klasser.filter((k) => k.startlistePublisert);
  if (!klasseId) {
    app.innerHTML = html`<h1>Startlister</h1>${synlige.length ? '' : raw('<p class="dempet">Startlistene er ikke publisert ennå.</p>')}
      <div class="rutenett">${synlige.map((k) => raw(html`<a class="kort" href="#/startlister/${k.id}" style="text-decoration:none;color:inherit"><h3>${k.nr ? `${k.nr}. ` : ''}${k.navn}</h3><p class="dempet">${klassemeta(k)}</p><span class="merkelapp">${k.antallPameldt} startende</span></a>`))}</div>`;
    return;
  }
  const s = await api(`/api/startliste/${klasseId}`);
  const k = s.klasse;
  app.innerHTML = html`
    <a href="#/startlister" class="ikke-utskrift">← Alle startlister</a>
    <section class="kort" style="margin-top:10px">
      <div class="rad mellom"><h1>${k.nr ? `${k.nr}. ` : ''}${k.navn}</h1><button class="liten" data-skriv-ut>Skriv ut</button></div>
      <p class="dempet">${klassemeta(k)} · Dommere: ${k.dommere.map((d) => `${d.pos}: ${d.navn}`).join(', ')}</p>
      ${s.publisert ? '' : raw('<div class="varsel advarsel">Startlisten er ikke publisert ennå.</div>')}
      <div class="tabell-boks"><table>
        <thead><tr><th class="tall">#</th><th>Tid</th><th class="tall">Startnr</th><th>Rytter</th><th>Klubb</th><th>Hest</th></tr></thead>
        <tbody>${s.rader.map((r, i) => raw(html`<tr><td class="tall">${r.startrekke || i + 1}</td><td>${r.starttid || ''}</td><td class="tall"><b>${r.startnr || ''}</b></td><td>${r.rytter.navn}</td><td>${r.rytter.klubb}</td><td>${r.hest.navn}</td></tr>`))}</tbody>
      </table></div>
    </section>`;
}

function prosentCelle(v) { return v == null ? '' : formatProsent(v); }

async function visResultater(klasseId) {
  const aktuelle = data.klasser.filter((k) => k.status !== 'planlagt');
  if (!klasseId) {
    app.innerHTML = html`<h1>Resultater</h1>${aktuelle.length ? '' : raw('<p class="dempet">Ingen klasser har startet ennå.</p>')}
      <div class="rutenett">${aktuelle.map((k) => raw(html`<a class="kort" href="#/resultater/${k.id}" style="text-decoration:none;color:inherit"><div class="rad mellom"><h3>${k.nr ? `${k.nr}. ` : ''}${k.navn}</h3><span class="merkelapp ${k.offisiell ? 'ok' : 'gull'}">${k.offisiell ? 'Offisiell' : k.status === 'pagar' ? 'Live' : 'Foreløpig'}</span></div><p class="dempet">${klassemeta(k)}</p></a>`))}</div>`;
    return;
  }
  const r = await api(`/api/resultater/${klasseId}`);
  const k = r.klasse;
  const nyeste = r.rader.filter((x) => x.sist).sort((a, b) => b.sist.localeCompare(a.sist))[0];
  const forrige = sistSett.get(klasseId);
  sistSett.set(klasseId, nyeste?.sist || null);
  app.innerHTML = html`
    <a href="#/resultater" class="ikke-utskrift">← Alle resultater</a>
    <section class="kort" style="margin-top:10px">
      <div class="rad mellom">
        <h1>${k.nr ? `${k.nr}. ` : ''}${k.navn}</h1>
        <span class="rad"><span class="merkelapp ${k.offisiell ? 'ok' : 'gull'}">${k.offisiell ? 'Offisiell resultatliste' : 'Foreløpige resultater'}</span><button class="liten" data-skriv-ut>Skriv ut</button></span>
      </div>
      <p class="dempet">${klassemeta(k)} · ${r.startende} startende · ${k.clearRound ? 'Clear round (50 % eller mer)' : `${r.antallPremier} premier`}</p>
      ${nyeste && !k.offisiell ? raw(html`<div class="varsel ok">Siste resultat: <b>${nyeste.startnr ? `${nyeste.startnr} ` : ''}${nyeste.rytter.navn} – ${nyeste.hest.navn}</b>: ${nyeste.prosent != null ? `${formatProsent(nyeste.prosent)} %` : nyeste.statusTekst} ${nyeste.status === 'foreløpig' ? '(foreløpig)' : ''}</div>`) : ''}
      <div class="tabell-boks"><table>
        <thead><tr><th class="tall">Plass</th><th class="tall">Nr</th><th>Ekvipasje</th>
          ${r.posisjoner.map((p) => raw(html`<th class="tall dommerkol" title="${k.dommere.find((d) => d.pos === p)?.navn}">${p}</th>`))}<th class="tall">Prosent</th></tr></thead>
        <tbody>${r.rader.map((x) => raw(html`
          <tr class="${x.premie ? 'premie' : ''} ${forrige !== undefined && x.sist && x.sist === nyeste?.sist && x.sist !== forrige ? 'ny' : ''}">
            <td class="tall plass">${x.clearRound ? 'CR' : x.plassering ?? ''}</td>
            <td class="tall">${x.startnr ?? ''}</td>
            <td><b>${x.rytter.navn}</b> – ${x.hest.navn}<br><small>${x.rytter.klubb}</small></td>
            ${r.posisjoner.map((p) => raw(html`<td class="tall dommerkol">${prosentCelle(x.perDommer[p].prosent)}</td>`))}
            <td class="tall"><span class="prosent">${x.prosent != null ? formatProsent(x.prosent) : ''}</span>
              ${r.posisjoner.some((p) => x.perDommer[p].prosent != null) ? raw(html`<small class="dommerlinje">${r.posisjoner.filter((p) => x.perDommer[p].prosent != null).map((p) => `${p} ${prosentCelle(x.perDommer[p].prosent)}`).join(' · ')}</small>`) : ''}
              ${x.status !== 'ferdig' ? raw(html`<br><small>${x.statusTekst}${x.elimGrunn ? `: ${x.elimGrunn}` : ''}</small>`) : x.godkjent ? '' : raw('<br><small>Under 50 %</small>')}</td>
          </tr>`))}</tbody>
      </table></div>
      <p class="dempet" style="margin-top:10px">Dommere: ${k.dommere.map((d) => `${d.pos}: ${d.navn}`).join(' · ')}. Resultatet er snittet av dommernes prosent etter fradrag, med 3 desimaler (KR IV § 450.5). Ekvipasjer under 50 % plasseres ikke.</p>
    </section>`;
  clearTimeout(oppdatering);
  if (!k.offisiell) oppdatering = setTimeout(() => location.hash === `#/resultater/${klasseId}` && visResultater(klasseId).catch(() => {}), 10000);
}

async function visMine(kode) {
  let lagret = '';
  try { lagret = localStorage.getItem('dressur-kode') || ''; } catch { /* privat modus */ }
  kode = kode || lagret;
  app.innerHTML = html`
    <form class="kort" id="kodeskjema">
      <h1>Mine påmeldinger</h1>
      <div class="rad"><input name="kode" placeholder="Påmeldingskode" value="${kode}" style="max-width:220px;text-transform:uppercase" autocomplete="off"><button class="primar">Vis</button></div>
    </form><div id="mine"></div>`;
  $('#kodeskjema').onsubmit = (e) => { e.preventDefault(); hentMine($('#kodeskjema').kode.value.trim().toUpperCase()); };
  if (kode) hentMine(kode);
}

async function hentMine(kode) {
  const boks = $('#mine');
  try {
    const m = await api(`/api/mine?kode=${encodeURIComponent(kode)}`);
    boks.innerHTML = html`<section class="kort"><h2>${m.rytter}</h2><div class="tabell-boks"><table>
      <thead><tr><th>Klasse</th><th>Hest</th><th>Status</th><th>Start</th><th></th></tr></thead>
      <tbody>${m.paameldinger.map((p) => raw(html`<tr>
        <td>${p.klasse.navn}<br><small>${klassemeta(p.klasse)}</small></td><td>${p.hest}</td>
        <td><span class="merkelapp ${p.status === 'pameldt' ? 'ok' : p.status === 'trukket' ? 'fare' : 'advarsel'}">${STATUS_PAMELDING[p.status]}</span>${p.etteranmeldt ? raw('<br><small>Etteranmeldt</small>') : ''}</td>
        <td>${p.starttid ? `kl. ${p.starttid}` : ''}${p.startnr ? ` · nr ${p.startnr}` : ''}</td>
        <td class="rad">${p.protokoll ? raw(html`<a class="knapp liten" href="/protokoll?id=${p.id}&kode=${kode}">Protokoller</a>`) : ''}
          ${p.kanTrekkes ? raw(html`<button class="liten fare" data-trekk="${p.id}">Trekk</button>`) : ''}</td>
      </tr>`))}</tbody></table></div></section>`;
    $$('[data-trekk]', boks).forEach((b) => b.addEventListener('click', async () => {
      if (!confirm('Trekke ekvipasjen fra klassen?')) return;
      try { await api('/api/mine/trekk', { metode: 'POST', data: { kode, id: b.dataset.trekk } }); melding('Trukket fra klassen.'); hentMine(kode); } catch (e) { melding(e.message, 'feil'); }
    }));
    try { localStorage.setItem('dressur-kode', kode); } catch { /* privat modus */ }
  } catch (e) {
    boks.innerHTML = html`<div class="varsel fare">${e.message}</div>`;
  }
}

async function rute() {
  clearTimeout(oppdatering);
  const [, side = '', id] = location.hash.replace(/^#/, '').split('/');
  $$('#faner a').forEach((a) => a.classList.toggle('aktiv', a.getAttribute('href') === `#/${side}`));
  try {
    if (!data || !id) await lastStevne();
    if (side === 'pamelding') visPamelding();
    else if (side === 'startlister') await visStartlister(id);
    else if (side === 'resultater') await visResultater(id);
    else if (side === 'mine') await visMine(id);
    else visStevne();
  } catch (e) {
    app.innerHTML = html`<div class="varsel fare">${e.message}</div>`;
  }
}

window.addEventListener('hashchange', rute);
rute();
