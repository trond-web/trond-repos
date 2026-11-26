// Skifteplan › Husdyr › 🏛 Mattilsynet: status for kravene, virksomhet og rutiner, Husdyrregisteret, beredskapsplan,
// journalene (sykdom og dødelighet, tilsyn, temperatur, vann, fôr, kadaver, besøk) og tilsynsmappen med alt samlet.
// Logikken: mattilsynet.js.
import * as M from './mattilsynet.js';
import { DYRESLAG, kontrollerRom } from './husdyr.js';
import { signatur } from './versjon.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const idag = () => new Date().toISOString().slice(0, 10);
const datoNb = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('nb-NO') : '');

export function lagMattilsynetUi({ hentPlan, lagre, melding, nyId }) {
  let aktiv = 'sykdom'; const apne = new Set(); // hvilke sammenfoldede deler som er åpne, slik at de holder seg åpne når skjermen tegnes på nytt
  const d = (id) => `<details class="ekstra" data-mt-d="${id}" ${apne.has(id) ? 'open' : ''}>`;
  const m = () => M.sikre(hentPlan());
  const slagValg = (v) => `<option value="">–</option>${Object.entries(DYRESLAG).map(([k, d]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${esc(d.navn)}</option>`).join('')}`;
  const felt = ([id, navn, type]) => {
    if (type === 'bool') return `<label class="avkrysning"><input type="checkbox" data-mt-ny="${id}"> ${esc(navn)}</label>`;
    if (type === 'slag') return `<label>${esc(navn)}<select data-mt-ny="${id}">${slagValg('')}</select></label>`;
    if (Array.isArray(type)) return `<label>${esc(navn)}<select data-mt-ny="${id}">${type.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></label>`;
    return `<label>${esc(navn)}<input type="${type}" data-mt-ny="${id}" ${type === 'date' ? `value="${idag()}"` : ''} ${type === 'number' ? 'step="any"' : ''}></label>`;
  };
  const verdi = (x, [id, , type]) => (type === 'bool' ? (x[id] ? 'Ja' : '') : type === 'slag' ? DYRESLAG[x[id]]?.navn || '' : x[id] ?? '');

  function html() {
    const S = hentPlan(); const mt = m(); const v = mt.virksomhet; const vurd = M.vurdering(S, { henting: v.henting || 'daglig' }); const ant = M.antallPerGruppe(S);
    const def = M.JOURNALER[aktiv]; const rader = (mt.journal[aktiv] || []).slice().sort((a, b) => String(b.dato).localeCompare(String(a.dato)));
    const vfelt = (k, navn, type = 'text', hint = '') => `<label>${esc(navn)}<input type="${type}" data-mt-v="${k}" value="${esc(v[k] ?? '')}" placeholder="${esc(hint)}"></label>`;
    return `<div class="kort mt">
      <div class="detalj-topp"><h3>🏛 Mattilsynet – husdyrhold og matproduksjon</h3><button type="button" class="knapp liten primar" data-mt="mappe">📁 Tilsynsmappe</button></div>
      <p class="hint">Journalene og rutinene Mattilsynet kan be om ved tilsyn, vurdert ut fra dyreholdet. KSL-sjekklistene i fanen KSL går gjennom regelverket punkt for punkt. Regelverket og Mattilsynets veiledere gjelder.</p>
      <div class="mt-status">${vurd.map((k) => `<div class="mt-krav"><span class="pille" style="--farge:${M.STATUS[k.status]?.farge}">${esc(M.STATUS[k.status]?.navn)}</span><div><b>${esc(k.navn)}</b><div class="hint"><span>${esc(k.tekst)}</span>${k.hjemmel ? `<span> · </span><a href="${k.hjemmel.url}" target="_blank" rel="noopener">${esc(k.hjemmel.navn)}</a>` : ''}</div></div>${k.journal ? `<button type="button" class="knapp liten" data-mt-journal="${k.journal}">Journal</button>` : ''}</div>`).join('')}</div>
      ${d('virksomhet')}<summary>Virksomhet og rutiner</summary>
        <div class="skjema to-kol">${vfelt('produsentnr', 'Produsentnummer')}
          <label class="avkrysning"><input type="checkbox" data-mt-v="registrert" ${v.registrert ? 'checked' : ''}> Registrert hos Mattilsynet</label>
          <label class="avkrysning"><input type="checkbox" data-mt-v="egenBronn" ${v.egenBronn ? 'checked' : ''}> Egen brønn / egen vannforsyning</label>
          <label>Melkehenting<select data-mt-v="henting"><option value="daglig" ${v.henting !== 'ikke-daglig' ? 'selected' : ''}>Daglig (høyst 8 °C)</option><option value="ikke-daglig" ${v.henting === 'ikke-daglig' ? 'selected' : ''}>Ikke daglig (høyst 6 °C)</option></select></label>
          <label class="hel">Tilsynsrutine <textarea data-mt-v="tilsynsrutine" rows="2" placeholder="Hvem, hvor ofte, avløser ved fravær">${esc(v.tilsynsrutine)}</textarea></label>
          <label class="hel">Smittevern <textarea data-mt-v="smittevern" rows="2" placeholder="Smittesluse, besøksrutine, karantene for nye dyr, skadedyr">${esc(v.smittevern)}</textarea></label></div>
      </details>
      ${['Storfe', 'Småfe', 'Svin'].some((g) => ant[g]) ? `${d('register')}<summary>Husdyrregisteret – avstemming</summary><div class="skjema tre-kol">${['Storfe', 'Småfe', 'Svin'].filter((g) => ant[g]).map((g) => `<label>${g}: registrert <small>(${ant[g]} i dyreholdet)</small><input type="number" min="0" data-mt-reg="${g}" data-felt="antall" value="${esc(mt.register[g]?.antall ?? '')}"></label><label>Sjekket dato<input type="date" data-mt-reg="${g}" data-felt="dato" value="${esc(mt.register[g]?.dato ?? '')}"></label><span></span>`).join('')}</div><p class="hint">Fødsler, flytting, kjøp og slakt skal meldes til Husdyrregisteret innen 7 dager.</p></details>` : ''}
      ${d('beredskap')}<summary>Beredskapsplan</summary><div class="skjema to-kol">${[['strom', 'Strømbrudd (aggregat, hvem starter det)'], ['vann', 'Vannforsyning (reserve)'], ['ventilasjon', 'Ventilasjon (nødventilasjon)'], ['alarm', 'Alarm (hvem varsles, hvordan)'], ['brann', 'Brann (evakuering av dyr, slukkeutstyr)'], ['kontakter', 'Kontakter (veterinær, Mattilsynet, avløser, nabo)']].map(([k, n]) => `<label>${esc(n)}<textarea rows="2" data-mt-b="${k}">${esc(mt.beredskap[k])}</textarea></label>`).join('')}</div><p class="hint">Fjørfe og svin: alarm ved strømbrudd og feil temperatur, og strømaggregat når driften er avhengig av strøm. Før tester av alarm og aggregat i tilsynsloggen.</p></details>
      <h4 class="undertittel">Journaler</h4>
      <div class="mt-faner" role="tablist">${Object.entries(M.JOURNALER).map(([k, j]) => `<button type="button" role="tab" data-mt-journal="${k}" class="${k === aktiv ? 'aktiv' : ''}">${j.ikon} ${esc(j.navn)} <small>${(mt.journal[k] || []).length}</small></button>`).join('')}</div>
      <div class="skjema tre-kol mt-ny" data-mt-skjema="${aktiv}">${def.felt.map(felt).join('')}</div>
      <div class="knapperad"><button type="button" class="knapp primar" data-mt="legg-til">+ Før inn</button><button type="button" class="knapp liten" data-mt="csv">⬇ CSV</button></div>
      ${rader.length ? `<div class="tabell"><table class="sf-tabell"><thead><tr>${def.felt.map((f) => `<th>${esc(f[1])}</th>`).join('')}<th></th></tr></thead><tbody>${rader.slice(0, 50).map((x) => `<tr class="${x.smitte && !x.meldt ? 'mt-rad-avvik' : ''}">${def.felt.map((f) => `<td>${esc(verdi(x, f))}</td>`).join('')}<td><button type="button" class="knapp liten" data-mt-slett="${esc(x.id)}" aria-label="Slett">✕</button></td></tr>`).join('')}</tbody></table></div>${rader.length > 50 ? `<p class="hint">Viser de 50 nyeste av ${rader.length}. Alle er med i CSV og tilsynsmappen.</p>` : ''}` : '<p class="hint">Ingen føringer ennå.</p>'}
    </div>`;
  }

  function tilsynsmappe() {
    const S = hentPlan(); const mt = m(); const v = mt.virksomhet; const vurd = M.vurdering(S, { henting: v.henting || 'daglig' });
    const tab = (kopp, rader) => `<table><thead><tr>${kopp.map((k) => `<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${rader.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${kopp.length}">Ingen føringer</td></tr>`}</tbody></table>`;
    const ettAar = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10); const femAar = new Date(Date.now() - 5 * 365 * 864e5).toISOString().slice(0, 10);
    const journal = (k, fra) => { const d = M.JOURNALER[k]; const r = (mt.journal[k] || []).filter((x) => String(x.dato) >= fra).sort((a, b) => String(a.dato).localeCompare(String(b.dato))); return `<h2>${d.ikon} ${esc(d.navn)}</h2>${tab(d.felt.map((f) => f[1]), r.map((x) => d.felt.map((f) => verdi(x, f))))}`; };
    const lm = (S.gard?.legemiddel || []).filter((x) => String(x.dato) >= femAar).sort((a, b) => String(a.dato).localeCompare(String(b.dato)));
    const rom = kontrollerRom(S); const dyr = (S.skifteplan?.dyrehold?.dyr || []).filter((r) => Number(r.antall) > 0);
    const b = mt.beredskap; const ksl = S.ksl; const sisteRev = (ksl?.revisjoner || []).map((r) => r.dato).filter(Boolean).sort().at(-1);
    const kropp = `<h1>Tilsynsmappe – Mattilsynet</h1>
      <p>${esc(S.eiendom?.navn || '')}${S.eiendom?.gnrbnr ? ` (gnr/bnr ${esc(S.eiendom.gnrbnr)})` : ''} · produsentnummer ${esc(v.produsentnr || '–')} · utskrevet ${datoNb(idag())}</p>
      <h2>Status</h2>${tab(['Krav', 'Status', 'Merknad'], vurd.map((k) => [k.navn, M.STATUS[k.status]?.navn, k.tekst]))}
      <h2>Dyrehold</h2>${tab(['Dyreslag', 'Antall'], dyr.map((r) => [DYRESLAG[r.slag]?.navn || r.slag, r.antall]))}
      ${rom.length ? `<h2>Plass i dyrerom</h2><ul>${rom.map((x) => `<li><b>${esc(x.tittel)}</b> – ${esc(x.tekst)}</li>`).join('')}</ul>` : ''}
      <h2>Rutiner</h2><p><b>Tilsyn:</b> ${esc(v.tilsynsrutine || '–')}</p><p><b>Smittevern:</b> ${esc(v.smittevern || '–')}</p>
      <h2>Beredskapsplan</h2>${tab(['', ''], [['Strømbrudd', b.strom], ['Vann', b.vann], ['Ventilasjon', b.ventilasjon], ['Alarm', b.alarm], ['Brann', b.brann], ['Kontakter', b.kontakter]])}
      <h2>💊 Legemiddeljournal (siste 5 år)</h2>${tab(['Dato', 'Dyr', 'Diagnose', 'Legemiddel', 'Mengde', 'Tilbakeholdelse melk', 'Tilbakeholdelse kjøtt'], lm.map((x) => [x.dato, x.dyr, x.diagnose || x.grunn || '', x.legemiddel, x.mengde, x.tilbakeholdMelk ?? '', x.tilbakeholdKjott ?? '']))}
      ${journal('sykdom', femAar)}${journal('tilsyn', ettAar)}${journal('temperatur', ettAar)}${journal('vann', femAar)}${journal('for', ettAar)}${journal('kadaver', ettAar)}${journal('besok', ettAar)}
      <h2>KSL</h2><p>Kapitler: ${esc((ksl?.kapitler || []).join(', ') || '–')}${sisteRev ? ` · siste egenrevisjon ${esc(datoNb(sisteRev))}` : ''}. Sjekklistene ligger i fanen KSL.</p>`;
    const w = window.open('', '_blank'); if (!w) { melding('Nettleseren blokkerte utskriftsvinduet.'); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Tilsynsmappe – Mattilsynet</title><style>body{font:12px/1.45 system-ui,sans-serif;max-width:1000px;margin:20px auto;padding:0 16px;color:#111}h1{font-size:20px}h2{font-size:14px;margin:18px 0 6px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:3px 6px;text-align:left;vertical-align:top}th{background:#f1f1ee}@media print{h2{break-after:avoid}tr{break-inside:avoid}}</style>${kropp}<p style="color:#555;margin-top:18px">Laget med ${esc(signatur())}.</p><script>setTimeout(()=>print(),400)<\/script>`);
    w.document.close();
  }

  function klikk(e) {
    const t = e.target; const mt = m();
    const sum = t.closest('[data-mt-d] > summary'); if (sum) { const id = sum.parentElement.dataset.mtD; if (sum.parentElement.open) apne.delete(id); else apne.add(id); return false; }
    const j = t.closest('[data-mt-journal]'); if (j) { aktiv = j.dataset.mtJournal; lagre(false); setTimeout(() => document.querySelector('.mt-ny')?.scrollIntoView({ block: 'nearest' }), 30); return true; }
    const sl = t.closest('[data-mt-slett]'); if (sl) { if (confirm('Slette føringen?')) { mt.journal[aktiv] = mt.journal[aktiv].filter((x) => x.id !== sl.dataset.mtSlett); lagre(false); } return true; }
    const k = t.closest('[data-mt]')?.dataset.mt; if (!k) return false;
    if (k === 'mappe') { tilsynsmappe(); return true; }
    if (k === 'csv') { const url = URL.createObjectURL(new Blob([`﻿${M.csv(hentPlan(), aktiv)}`], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `${aktiv}-journal-${idag()}.csv`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000); return true; }
    if (k === 'legg-til') {
      const rot = t.closest('.mt').querySelector('[data-mt-skjema]'); const rad = { id: nyId('mt') };
      for (const el of rot.querySelectorAll('[data-mt-ny]')) rad[el.dataset.mtNy] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value.trim();
      if (!rad.dato) { melding('Skriv inn dato.'); return true; }
      mt.journal[aktiv] = [...(mt.journal[aktiv] || []), rad]; lagre(false);
      const grense = M.MELK_MAKS[mt.virksomhet.henting === 'ikke-daglig' ? 'ikkeDaglig' : 'daglig'];
      if (aktiv === 'temperatur' && rad.sted === 'Melketank' && rad.temp > grense) melding(`⚠️ ${rad.temp} °C er over grensen på ${grense} °C for melk. Sjekk kjøleanlegget og varsle meieriet.`, 8000); else if (rad.smitte && !rad.meldt) melding('⚠️ Mistanke om smittsom sykdom skal meldes til Mattilsynet eller veterinær straks.', 8000); else melding('Ført i journalen.');
      return true;
    }
    return false;
  }
  function endring(e) {
    const t = e.target; const mt = m();
    if (t.dataset.mtV) { mt.virksomhet[t.dataset.mtV] = t.type === 'checkbox' ? t.checked : t.value.trim(); lagre(false); return true; }
    if (t.dataset.mtB) { mt.beredskap[t.dataset.mtB] = t.value.trim(); lagre(false); return true; }
    if (t.dataset.mtReg) { mt.register[t.dataset.mtReg] = { ...(mt.register[t.dataset.mtReg] || {}), [t.dataset.felt]: t.type === 'number' ? (t.value === '' ? null : Number(t.value)) : t.value }; lagre(false); return true; }
    return !!t.closest?.('[data-mt-skjema]'); // skjemaet for ny føring lagres først ved «Før inn»
  }
  return { html, klikk, endring };
}
