// Dommermodul: dommeren ser sine klasser, fører karakterer og kommentarer per ekvipasje og signerer protokollen.
// Hoveddommeren (C) fører i tillegg feilridning, tekniske feil og eliminering, som trekkes hos alle dommerne.
import { api, html, raw, $, $$, kortDato, melding, tidspunkt, STATUS_KLASSE } from './felles.js';
import { sikreInnlogging } from './innlogging.js';
import {
  KARAKTERNAVN, TEKNISKE_FEIL, ELIMINERINGSGRUNNER, dommerResultat, gyldigKarakter, formatKarakter, formatProsent,
  manglerBegrunnelse, snittAvAndre, feilridningTrekk,
} from './beregning.js';

const app = $('#app');
let meg = null;

async function start() {
  meg = await sikreInnlogging('dommer', 'Logg inn som dommer');
  window.addEventListener('hashchange', rute);
  rute();
}

async function rute() {
  const [, side, id] = location.hash.replace(/^#/, '').split('/');
  try {
    if (side === 'klasse') await visKlasse(id);
    else if (side === 'protokoll') await visProtokoll(id);
    else await visKlasser();
  } catch (e) {
    if (e.status === 401) location.reload();
    app.innerHTML = html`<div class="varsel fare">${e.message}</div><a href="#/">Til mine klasser</a>`;
  }
}

async function visKlasser() {
  const d = await api('/api/dommer/klasser');
  app.innerHTML = html`
    <h1>Mine klasser</h1>
    ${d.klasser.length ? '' : raw('<p class="dempet">Du er ikke satt opp som dommer i noen klasser ennå. Kontakt sekretariatet.</p>')}
    <div class="rutenett">${d.klasser.map((k) => raw(html`
      <a class="kort" href="#/klasse/${k.id}" style="text-decoration:none;color:inherit">
        <div class="rad mellom"><h3>${k.nr ? `${k.nr}. ` : ''}${k.navn}</h3><span class="merkelapp gull">Dommer ${k.minPosisjon}${k.minPosisjon === 'C' ? ' · hoveddommer' : ''}</span></div>
        <p class="dempet">${kortDato(k.dato)} kl. ${k.starttid} · ${k.program?.nivaa} ${k.program?.navn}</p>
        <span class="merkelapp ${k.status === 'pagar' ? 'gull' : k.status === 'avsluttet' ? 'ok' : ''}">${STATUS_KLASSE[k.status]}</span>
        ${k.offisiell ? raw('<span class="merkelapp ok">Offisiell</span>') : ''}
        <span class="merkelapp">${k.antallPameldt} ekvipasjer</span>
      </a>`))}</div>
    <p class="dempet" style="margin-top:16px">Dommerne skal ikke følge med på andre dommeres karakterer eller resultatlister under bedømmingen (KR IV § 450.1). Du ser bare dine egne protokoller her.</p>`;
}

async function visKlasse(id) {
  const d = await api(`/api/dommer/klasser/${id}`);
  const k = d.klasse;
  const signert = d.startliste.filter((x) => x.signert).length;
  const neste = d.startliste.find((x) => !x.signert && !x.fradrag?.ikkeStartet);
  app.innerHTML = html`
    <a href="#/">← Mine klasser</a>
    <section class="kort" style="margin-top:10px">
      <div class="rad mellom"><h1>${k.nr ? `${k.nr}. ` : ''}${k.navn}</h1><span class="merkelapp gull">Du dømmer fra ${d.minPosisjon}</span></div>
      <p class="dempet">${kortDato(k.dato)} kl. ${k.starttid} · ${d.program.nivaa} ${d.program.navn} · Bane ${d.program.bane} · maks ${d.program.maks} poeng</p>
      <p>${signert} av ${d.startliste.length} protokoller signert.</p>
      ${d.hoveddommer ? raw(html`<div class="rad">
        <span>Klassens status: <b>${STATUS_KLASSE[k.status]}</b></span>
        ${k.status !== 'pagar' && !k.offisiell ? raw('<button class="liten" data-status="pagar">Start klassen</button>') : ''}
        ${k.status === 'pagar' ? raw('<button class="liten" data-status="avsluttet">Avslutt klassen</button>') : ''}
      </div>`) : ''}
      ${neste ? raw(html`<p style="margin-top:12px"><a class="knapp primar" href="#/protokoll/${neste.id}">Neste: ${neste.startnr ?? ''} ${neste.rytter.navn} – ${neste.hest.navn}</a></p>`) : ''}
    </section>
    <ul class="startliste-dommer">${d.startliste.map((x) => raw(html`
      <li><a href="#/protokoll/${x.id}">
        <span class="nr">${x.startnr ?? '–'}</span>
        <span style="flex:1"><b>${x.rytter.navn}</b> – ${x.hest.navn}<br><small>${x.starttid ? `kl. ${x.starttid}` : ''} ${x.rytter.klubb}</small></span>
        ${x.fradrag?.ikkeStartet ? raw('<span class="merkelapp">Startet ikke</span>')
    : x.fradrag?.eliminert ? raw('<span class="merkelapp fare">Eliminert</span>')
      : x.signert ? raw(html`<span class="merkelapp ok">Signert ${x.minProsent != null ? `${formatProsent(x.minProsent)} %` : ''}</span>`)
        : x.paabegynt ? raw('<span class="merkelapp advarsel">Påbegynt</span>') : ''}
      </a></li>`))}</ul>`;
  $$('[data-status]').forEach((b) => b.addEventListener('click', async () => {
    try { await api(`/api/dommer/klasser/${id}/status`, { metode: 'PUT', data: { status: b.dataset.status } }); visKlasse(id); } catch (e) { melding(e.message, 'feil'); }
  }));
}

// ---------- protokoll ----------

let tilstand = null;
let lagreTimer = null;
let lagrer = Promise.resolve();

async function visProtokoll(pid) {
  const d = await api(`/api/dommer/protokoll/${pid}`);
  const liste = await api(`/api/dommer/klasser/${d.klasse.id}`);
  const idx = liste.startliste.findIndex((x) => x.id === pid);
  tilstand = {
    pid, d, program: d.program, prot: { karakterer: {}, kommentarer: {}, sluttkommentar: '', ikkeVist: [], ...d.protokoll },
    fradrag: { feilridning: 0, tekniske: [], ...d.fradrag }, forrige: liste.startliste[idx - 1], neste: liste.startliste[idx + 1],
  };
  tegnProtokoll();
}

function laast() {
  return !!tilstand.prot.signert || tilstand.d.klasse.offisiell;
}

function tegnProtokoll() {
  const { d, program, prot, forrige, neste } = tilstand;
  const e = d.ekvipasje;
  const ovelser = program.punkter.filter((p) => p.del === 'ovelse');
  const helhet = program.punkter.filter((p) => p.del === 'helhet');
  app.innerHTML = html`
    <div class="protokoll-topp">
      <div class="rad mellom">
        <div><span class="navn">${e.startnr ? `Nr ${e.startnr} · ` : ''}${e.rytter.navn} – ${e.hest.navn}</span><br>
          <small>${d.klasse.navn} · ${program.nivaa} ${program.navn} · dommer ${d.minPosisjon}${e.starttid ? ` · kl. ${e.starttid}` : ''}</small></div>
        <div class="rad">
          <span class="lagre-status" id="lagrestatus">${prot.signert ? `Signert ${tidspunkt(prot.signert)}` : ''}</span>
          <a class="knapp liten" href="#/klasse/${d.klasse.id}">Startliste</a>
          ${forrige ? raw(html`<a class="knapp liten" href="#/protokoll/${forrige.id}" title="Forrige ekvipasje">◀</a>`) : ''}
          ${neste ? raw(html`<a class="knapp liten" href="#/protokoll/${neste.id}" title="Neste ekvipasje">▶</a>`) : ''}
        </div>
      </div>
    </div>
    ${prot.signert ? raw(html`<div class="varsel ok">Protokollen er signert. Rettinger logges med opprinnelig karakter og grunn (KR IV § 450.1.c).${d.klasse.offisiell ? ' Resultatlisten er offisiell, og protokollen er låst.' : ''}</div>`) : ''}
    <section id="fradrag"></section>
    <section>
      <h2>Øvelser</h2>
      ${ovelser.map((p) => raw(punktHtml(p)))}
      <h2>${program.type === 'kur' ? 'Kunstnerisk inntrykk' : 'Allment inntrykk'}</h2>
      ${helhet.map((p) => raw(punktHtml(p)))}
    </section>
    <section class="kort">
      <label for="slutt">Sluttkommentar</label>
      <textarea id="slutt" ${laast() ? 'disabled' : ''} placeholder="Kort oppsummering basert på utdanningsskalaen">${prot.sluttkommentar || ''}</textarea>
    </section>
    <section class="kort" id="sum"></section>`;
  tegnFradrag();
  tegnSum();
  koble();
}

function punktHtml(p) {
  const { prot } = tilstand;
  const v = prot.karakterer[p.id];
  const har = gyldigKarakter(v, p.steg);
  const heltall = har ? Math.floor(Number(v) + 1e-9) : null;
  const desimaler = p.steg < 0.5 ? Array.from({ length: Math.round(1 / p.steg) }, (_, i) => Math.round(i * p.steg * 10) / 10) : p.steg === 0.5 ? [0, 0.5] : [];
  const valgtDes = har ? Math.round((Number(v) - heltall) * 10) / 10 : null;
  const ikkeVist = (prot.ikkeVist || []).includes(p.id);
  return html`
    <div class="punkt ${har ? 'har' : ''}" id="p-${p.id}" data-id="${p.id}">
      <div class="punkt-hode">
        <span class="punkt-nr">${p.del === 'ovelse' ? p.nr : `${p.nr}`}</span>
        <span class="punkt-tekst">${p.punkt ? raw(html`<b>${p.punkt}</b> `) : ''}${p.tekst}${p.koeff !== 1 ? raw(html` <span class="koeff">× ${formatKarakter(p.koeff)}</span>`) : ''}
          ${ikkeVist ? raw('<br><small>Ikke vist – snittet av de andre øvelsene (§ 450.3.f)</small>') : ''}</span>
        <span class="karakter-vis" title="${har ? KARAKTERNAVN[heltall] : ''}">${har ? formatKarakter(v) : '–'}</span>
      </div>
      ${laast() ? (tilstand.d.klasse.offisiell ? '' : raw(html`<div class="rad" style="margin-top:6px"><button class="liten" data-rett="${p.id}">Rett karakter</button></div>`)) : raw(html`
        <div class="taster" role="group" aria-label="Karakter for ${p.nr}">
          ${Array.from({ length: 11 }, (_, i) => raw(html`<button type="button" data-heltall="${i}" class="${heltall === i ? 'valgt' : ''}" title="${KARAKTERNAVN[i]}">${i}</button>`))}
        </div>
        <div class="taster-ekstra">
          ${desimaler.map((x) => raw(html`<button type="button" class="liten ${valgtDes === x && har ? 'valgt' : ''}" data-des="${x}" ${!har || heltall === 10 ? 'disabled' : ''}>${x === 0 ? ',0' : formatKarakter(x).replace(/^0/, '')}</button>`))}
          ${p.del === 'ovelse' ? raw(html`<button type="button" class="liten" data-snitt>Ikke vist (snitt)</button>`) : ''}
          ${har ? raw('<button type="button" class="liten" data-tom>Tøm</button>') : ''}
        </div>`)}
      <textarea class="kommentar" data-kom="${p.id}" rows="1" placeholder="${har && Number(v) <= 4 ? 'Kommentar er påkrevd for karakter 0–4' : 'Kommentar'}" ${laast() ? 'disabled' : ''} style="margin-top:8px;min-height:42px">${prot.kommentarer[p.id] || ''}</textarea>
    </div>`;
}

function oppdaterPunkt(id) {
  const p = tilstand.program.punkter.find((x) => x.id === id);
  const gammel = $(`#p-${id}`);
  const fokus = document.activeElement?.dataset?.kom === id;
  const mal = document.createElement('template');
  mal.innerHTML = punktHtml(p).trim();
  gammel.replaceWith(mal.content.firstElementChild);
  kobleEtt($(`#p-${id}`));
  if (fokus) $(`#p-${id} textarea`).focus();
  merkManglende();
}

function settKarakter(id, verdi) {
  const { prot } = tilstand;
  if (verdi == null) delete prot.karakterer[id]; else prot.karakterer[id] = verdi;
  prot.ikkeVist = (prot.ikkeVist || []).filter((x) => x !== id);
  oppdaterPunkt(id);
  tegnSum();
  planleggLagring();
}

function kobleEtt(el) {
  const id = el.dataset.id;
  $$('[data-heltall]', el).forEach((b) => b.addEventListener('click', () => {
    const p = tilstand.program.punkter.find((x) => x.id === id);
    const gammel = tilstand.prot.karakterer[id];
    const n = Number(b.dataset.heltall);
    // Behold desimal (f.eks. ,5) når dommeren bytter heltall, men aldri over 10
    const des = gyldigKarakter(gammel, p.steg) ? Math.round((Number(gammel) - Math.floor(Number(gammel) + 1e-9)) * 10) / 10 : 0;
    settKarakter(id, n === 10 ? 10 : Math.round((n + des) * 10) / 10);
  }));
  $$('[data-des]', el).forEach((b) => b.addEventListener('click', () => {
    const n = Math.floor(Number(tilstand.prot.karakterer[id]) + 1e-9);
    settKarakter(id, Math.round((n + Number(b.dataset.des)) * 10) / 10);
  }));
  $('[data-tom]', el)?.addEventListener('click', () => settKarakter(id, null));
  $('[data-snitt]', el)?.addEventListener('click', () => {
    const snitt = snittAvAndre(tilstand.program, tilstand.prot, id);
    if (snitt == null) { melding('Gi karakter på de andre øvelsene først.', 'feil'); return; }
    settKarakter(id, snitt);
    tilstand.prot.ikkeVist = [...(tilstand.prot.ikkeVist || []), id];
    oppdaterPunkt(id);
  });
  $('[data-kom]', el)?.addEventListener('input', (e) => {
    tilstand.prot.kommentarer[id] = e.target.value;
    planleggLagring();
    merkManglende();
    tegnSum();
  });
  $('[data-rett]', el)?.addEventListener('click', () => rettKarakter(id));
}

function koble() {
  $$('.punkt').forEach(kobleEtt);
  $('#slutt')?.addEventListener('input', (e) => { tilstand.prot.sluttkommentar = e.target.value; planleggLagring(); });
  merkManglende();
}

function merkManglende() {
  const mangler = manglerBegrunnelse(tilstand.program, tilstand.prot);
  $$('.punkt').forEach((el) => el.classList.toggle('mangler-kommentar', mangler.includes(el.dataset.id)));
}

function tegnSum() {
  const { program, prot, fradrag } = tilstand;
  const r = dommerResultat(program, prot, fradrag);
  const elim = fradrag.eliminert || (program.type !== 'kur' && fradrag.feilridning >= 3);
  const uten = manglerBegrunnelse(program, prot);
  const kanSignere = !laast() && (r.komplett || elim) && !uten.length;
  $('#sum').innerHTML = html`
    <h2>Sum – dommer ${tilstand.d.minPosisjon}</h2>
    <div class="sum-boks">
      <div><small>Poeng</small><b>${formatKarakter(r.poeng)} / ${r.maks}</b></div>
      ${program.type === 'kur' ? raw(html`<div><small>Teknisk</small><b>${r.tekniskProsent != null ? `${formatProsent(r.tekniskProsent)} %` : '–'}</b></div><div><small>Kunstnerisk</small><b>${r.kunstProsent != null ? `${formatProsent(r.kunstProsent)} %` : '–'}</b></div>`) : ''}
      <div><small>Fradrag</small><b>${elim ? 'Elim.' : `${formatKarakter(trekk())} %`}</b></div>
      <div><small>Prosent</small><b>${elim ? 'Eliminert' : r.prosent != null ? `${formatProsent(r.prosent)} %` : '–'}</b></div>
    </div>
    ${r.mangler.length && !elim ? raw(html`<p class="dempet" style="margin-top:10px">Mangler karakter på ${r.mangler.length} punkt.</p>`) : ''}
    ${uten.length ? raw(html`<div class="varsel fare" style="margin-top:10px">Karakterer fra 0 til 4 skal alltid begrunnes (KR IV § 461.2.a). Mangler kommentar på ${uten.length} punkt.</div>`) : ''}
    ${laast() ? '' : raw(html`<div class="rad" style="margin-top:12px"><button class="primar" id="signer" ${kanSignere ? '' : 'disabled'}>Signer protokollen</button>
      <small>Etter signering kan karakterer bare rettes ved åpenbar skrivefeil eller manglende karakter.</small></div>`)}`;
  $('#signer')?.addEventListener('click', signer);
}

function trekk() {
  const { program, fradrag } = tilstand;
  const t = (fradrag.tekniske || []).length * 0.5;
  return program.type === 'kur' ? t + (fradrag.kurTidAvvik ? 0.25 : 0) : (feilridningTrekk(fradrag.feilridning) ?? 0) + t;
}

function tegnFradrag() {
  const { d, fradrag, program } = tilstand;
  const kur = program.type === 'kur';
  const kan = d.hoveddommer && !d.klasse.offisiell;
  const teller = {};
  for (const t of fradrag.tekniske || []) teller[t] = (teller[t] || 0) + 1;
  $('#fradrag').innerHTML = html`
    <div class="kort fradrag-panel">
      <div class="rad mellom"><h2>Feil og eliminering</h2><small>${d.hoveddommer ? 'Du er hoveddommer – fradraget gjelder alle dommerne.' : 'Føres av hoveddommeren på C.'}</small></div>
      ${kur ? raw(html`<label class="avkryss"><input type="checkbox" id="kurtid" ${fradrag.kurTidAvvik ? 'checked' : ''} ${kan ? '' : 'disabled'}> Tid over/under angitt tid (−0,5 % fra kunstnerisk)</label>`) : raw(html`
        <div class="rad"><b>Feilridning:</b>
          ${[0, 1, 2, 3].map((n) => raw(html`<button type="button" class="liten ${Number(fradrag.feilridning || 0) === n ? 'primar' : ''}" data-feilr="${n}" ${kan ? '' : 'disabled'}>${n === 0 ? 'Ingen' : n === 3 ? '3 = elim.' : `${n} (−${formatKarakter(feilridningTrekk(n))} %)`}</button>`))}
        </div>`)}
      <div style="margin-top:10px"><b>Tekniske feil</b> <small>(−0,5 % per gang)</small>
        ${TEKNISKE_FEIL.filter((t) => kur || !t.kode.startsWith('kur')).map((t) => raw(html`
          <div class="rad" style="margin:4px 0"><span style="flex:1">${t.tekst}</span>
            ${kan ? raw(html`<button type="button" class="liten" data-tek-minus="${t.kode}" ${teller[t.kode] ? '' : 'disabled'}>−</button>`) : ''}
            <b style="min-width:1.5em;text-align:center">${teller[t.kode] || 0}</b>
            ${kan ? raw(html`<button type="button" class="liten" data-tek-pluss="${t.kode}">+</button>`) : ''}</div>`))}
      </div>
      <div class="felter" style="margin-top:10px">
        <label class="avkryss"><input type="checkbox" id="elim" ${fradrag.eliminert ? 'checked' : ''} ${kan ? '' : 'disabled'}> Eliminert</label>
        <select id="elimgrunn" ${kan && fradrag.eliminert ? '' : 'disabled'}><option value="">Årsak til eliminering …</option>
          ${ELIMINERINGSGRUNNER.map((g) => raw(html`<option ${fradrag.elimGrunn === g ? 'selected' : ''}>${g}</option>`))}</select>
        <label class="avkryss"><input type="checkbox" id="ikkestartet" ${fradrag.ikkeStartet ? 'checked' : ''} ${kan ? '' : 'disabled'}> Startet ikke</label>
      </div>
    </div>`;
  if (!kan) return;
  const lagre = async (endring) => {
    const nytt = { ...tilstand.fradrag, ...endring };
    if (nytt.eliminert && !nytt.elimGrunn) { tilstand.fradrag = nytt; tegnFradrag(); tegnSum(); melding('Velg årsak til elimineringen.', 'feil'); return; }
    try {
      const svar = await api(`/api/dommer/fradrag/${tilstand.pid}`, { metode: 'PUT', data: nytt });
      tilstand.fradrag = svar.fradrag;
      tegnFradrag(); tegnSum();
    } catch (e) { melding(e.message, 'feil'); }
  };
  $$('[data-feilr]').forEach((b) => b.addEventListener('click', () => {
    const n = Number(b.dataset.feilr);
    lagre(n >= 3 ? { feilridning: 3, eliminert: true, elimGrunn: 'Tre feilridninger' } : { feilridning: n, ...(tilstand.fradrag.elimGrunn === 'Tre feilridninger' ? { eliminert: false, elimGrunn: '' } : {}) });
  }));
  $$('[data-tek-pluss]').forEach((b) => b.addEventListener('click', () => lagre({ tekniske: [...(tilstand.fradrag.tekniske || []), b.dataset.tekPluss] })));
  $$('[data-tek-minus]').forEach((b) => b.addEventListener('click', () => {
    const t = [...(tilstand.fradrag.tekniske || [])];
    t.splice(t.lastIndexOf(b.dataset.tekMinus), 1);
    lagre({ tekniske: t });
  }));
  $('#kurtid')?.addEventListener('change', (e) => lagre({ kurTidAvvik: e.target.checked }));
  $('#elim').addEventListener('change', (e) => { tilstand.fradrag.eliminert = e.target.checked; if (!e.target.checked) lagre({ eliminert: false, elimGrunn: '' }); else { tegnFradrag(); tegnSum(); } });
  $('#elimgrunn').addEventListener('change', (e) => lagre({ eliminert: true, elimGrunn: e.target.value }));
  $('#ikkestartet').addEventListener('change', (e) => lagre({ ikkeStartet: e.target.checked }));
}

function lagreLokalt() {
  try { localStorage.setItem(`dressur-prot-${tilstand.pid}`, JSON.stringify({ tid: Date.now(), prot: tilstand.prot })); } catch { /* fullt eller privat */ }
}

function planleggLagring() {
  if (laast()) return;
  lagreLokalt();
  const s = $('#lagrestatus');
  if (s) { s.textContent = 'Lagrer …'; s.classList.remove('feil'); }
  clearTimeout(lagreTimer);
  lagreTimer = setTimeout(lagreNaa, 500);
}

function lagreNaa() {
  clearTimeout(lagreTimer);
  const { pid, prot } = tilstand;
  const kopi = { karakterer: prot.karakterer, kommentarer: prot.kommentarer, sluttkommentar: prot.sluttkommentar, ikkeVist: prot.ikkeVist };
  lagrer = lagrer.then(async () => {
    try {
      await api(`/api/dommer/protokoll/${pid}`, { metode: 'PUT', data: kopi });
      if (tilstand.pid === pid) { const s = $('#lagrestatus'); if (s) { s.textContent = `Lagret ${new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`; s.classList.remove('feil'); } }
    } catch (e) {
      if (tilstand.pid === pid) {
        const s = $('#lagrestatus');
        if (s) { s.textContent = `Ikke lagret – prøver igjen (${e.message})`; s.classList.add('feil'); }
        if (!e.status || e.status >= 500) lagreTimer = setTimeout(lagreNaa, 4000);
        else melding(e.message, 'feil');
      }
    }
  });
  return lagrer;
}

async function signer() {
  const r = dommerResultat(tilstand.program, tilstand.prot, tilstand.fradrag);
  if (!confirm(`Signere protokollen for ${tilstand.d.ekvipasje.rytter.navn} – ${tilstand.d.ekvipasje.hest.navn}?\n\nDin prosent: ${r.prosent != null ? `${formatProsent(r.prosent)} %` : 'eliminert'}`)) return;
  try {
    await lagreNaa();
    await api(`/api/dommer/protokoll/${tilstand.pid}/signer`, { metode: 'POST', data: {} });
    try { localStorage.removeItem(`dressur-prot-${tilstand.pid}`); } catch { /* ok */ }
    melding('Protokollen er signert.');
    if (tilstand.neste) location.hash = `#/protokoll/${tilstand.neste.id}`;
    else location.hash = `#/klasse/${tilstand.d.klasse.id}`;
  } catch (e) { melding(e.message, 'feil'); }
}

async function rettKarakter(id) {
  const p = tilstand.program.punkter.find((x) => x.id === id);
  const verdi = prompt(`Ny karakter for ${p.nr} (${p.tekst}).\nNåværende: ${formatKarakter(tilstand.prot.karakterer[id])}`);
  if (verdi == null) return;
  const tall = Number(String(verdi).replace(',', '.'));
  if (!gyldigKarakter(tall, p.steg)) { melding(`Ugyldig karakter. Tillatt 0–10 i steg på ${formatKarakter(p.steg)}.`, 'feil'); return; }
  const grunn = prompt('Grunn til rettingen (åpenbar skrivefeil eller manglende karakter):');
  if (!grunn) return;
  let kommentar = '';
  if (tall <= 4 && !tilstand.prot.kommentarer[id]) kommentar = prompt('Karakter 0–4 skal begrunnes. Kommentar:') || '';
  try {
    await api(`/api/dommer/protokoll/${tilstand.pid}/rett`, { metode: 'POST', data: { punkt: id, verdi: tall, grunn, kommentar } });
    melding('Karakteren er rettet og logget.');
    visProtokoll(tilstand.pid);
  } catch (e) { melding(e.message, 'feil'); }
}

start();
