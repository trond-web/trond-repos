// 💰 Fanen «Tilskudd»: ordningene gårdbrukeren kan søke, med beløp, krav og frister tilpasset gården (tilskudd.js).
import { tilskuddsoversikt, kommendeFrister, OMRADE_NAVN } from './tilskudd.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kr = (x) => `${Math.round(x).toLocaleString('nb-NO')} kr`;
const LOKALE = () => (document.documentElement.lang === 'en' ? 'en-GB' : 'nb-NO');
const STATUS = { aktuell: { navn: 'Aktuelle for deg', ikon: '✅' }, mulig: { navn: 'Kan bli aktuelle', ikon: '🔎' }, ikke: { navn: 'Ikke aktuelle nå', ikon: '⏸' } };

export function initTilskudd({ hentPlan, endret, iAar = new Date().getFullYear() }) {
  const aapne = new Set();
  function kort(x) {
    const open = aapne.has(x.id) || x.status === 'aktuell';
    return `<details class="ts-kort ts-${x.status}" data-ts="${x.id}" ${open ? 'open' : ''}><summary>
        <span class="ts-tittel"><b>${esc(x.navn)}</b><span class="hint">${esc(OMRADE_NAVN[x.omrade] || '')} · ${esc(x.forvalterNavn)}${x.sats ? ` · ${esc(x.sats)}` : ''}</span></span>
        <span class="ts-belop">${x.belop?.kr ? `${x.belop.usikker ? 'inntil ' : 'ca. '}${kr(x.belop.kr)}` : ''}</span></summary>
      <p class="ts-grunn">${x.status === 'aktuell' ? '✓' : x.status === 'mulig' ? '○' : '–'} ${esc(x.grunn)}</p>
      ${x.belop?.tekst ? `<p class="hint">${esc(x.belop.tekst)}</p>` : ''}
      ${x.belop?.sats ? `<label class="ts-sats">Kommunens sats <input type="number" min="0" max="100" step="1" data-ts-sats="${x.belop.sats}" value="${hentPlan().tilskudd?.satser?.[x.belop.sats] ?? ''}" placeholder="%"> %</label>` : ''}
      ${x.belop?.deler?.length ? `<table class="tabell sp-tabell ts-deler"><tbody>${x.belop.deler.map((d) => `<tr><td>${esc(d.navn)}</td><td class="hint">${esc(d.grunnlag)}</td><td class="tall">${kr(d.belop)}</td></tr>`).join('')}</tbody></table>` : ''}
      <p>${esc(x.kort)}</p>
      <h4 class="undertittel">Krav og vilkår</h4><ul class="sp-regler">${x.krav.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>
      <p><b>Frist:</b> ${esc(x.frist)}</p>
      <p class="ts-lenker"><a href="${esc(x.url)}" target="_blank" rel="noopener">Om ordningen (Landbruksdirektoratet)</a>${x.regionalUrl ? ` · <a href="${esc(x.regionalUrl)}" target="_blank" rel="noopener">${esc(x.forvalter === 'statsforvalter' || x.forvalterNavn.startsWith('Statsforvalteren') ? x.forvalterNavn : 'Statsforvalteren i ditt fylke')} – regionale satser og vilkår</a>` : ''}</p>
    </details>`;
  }
  function tegn() {
    const el = $('#tilskuddInnhold'); if (!el) return;
    const S = hentPlan(); const o = tilskuddsoversikt(S, iAar); const fr = kommendeFrister(o);
    const r = o.region; const grupper = ['aktuell', 'mulig', 'ikke'].map((st) => ({ st, liste: o.liste.filter((x) => x.status === st) })).filter((g) => g.liste.length);
    el.innerHTML = `
      <div class="kort ts-topp">
        <p class="hint">${r.kommune ? `${esc(r.kommune)} kommune` : 'Kommunen er ukjent'}${r.fylke ? `, ${esc(r.fylke)}` : ''} · regionale ordninger: <a href="${esc(r.statsforvalter.url)}" target="_blank" rel="noopener">${esc(r.statsforvalter.navn)}</a></p>
        <div class="kl-kpi"><div><small>Kan søkes i ${iAar}–${iAar + 1}</small><b class="kl-gronn">${o.sum ? kr(o.sum) : '–'}</b><span>anslag ut fra planen</span></div><div><small>I tillegg inntil</small><b>${o.inntil ? kr(o.inntil) : '–'}</b><span>avhenger av utgifter og regler</span></div><div><small>Aktuelle ordninger</small><b>${o.liste.filter((x) => x.status === 'aktuell').length}</b><span>av ${o.liste.length}</span></div></div>
        <p class="hint">Beløpene er anslag ut fra dyr, arealer, grøfteplaner og planlagte tiltak i planen. Regionale satser (RMP, skogkultur, veibygging, beitelag) fastsettes av Statsforvalteren og kommunen. Satser og krav kontrollert ${new Date(`${o.kontrollert}T12:00:00`).toLocaleDateString(LOKALE())}, og kildene sjekkes hver uke.</p>
      </div>
      ${fr.length ? `<div class="kort"><h3>📅 Kommende frister</h3><div class="ts-frister">${fr.map((f) => `<div><b>${f.dato.toLocaleDateString(LOKALE(), { day: 'numeric', month: 'long', year: 'numeric' })}</b><span>${esc(f.tekst)}</span><span class="hint">${f.dager <= 0 ? 'i dag' : `om ${f.dager} dager`}</span></div>`).join('')}</div><p class="hint">Kommunen fastsetter fristene for skogkultur, drenering, SMIL og veibygging – sjekk med landbrukskontoret.</p></div>` : ''}
      ${grupper.map((g) => `<div class="ts-gruppe"><h3>${STATUS[g.st].ikon} ${STATUS[g.st].navn} <span class="hint">(${g.liste.length})</span></h3>${g.liste.map(kort).join('')}</div>`).join('')}`;
  }
  document.addEventListener('toggle', (e) => { const d = e.target; if (d?.dataset?.ts) { if (d.open) aapne.add(d.dataset.ts); else aapne.delete(d.dataset.ts); } }, true);
  document.addEventListener('change', (e) => {
    const t = e.target; if (!t.dataset?.tsSats || !t.closest('#tilskuddInnhold')) return;
    const S = hentPlan(); S.tilskudd = { ...(S.tilskudd || {}), satser: { ...(S.tilskudd?.satser || {}), [t.dataset.tsSats]: t.value === '' ? null : Number(t.value) } };
    endret({ kart: false }); tegn();
  });
  return { tegn };
}
