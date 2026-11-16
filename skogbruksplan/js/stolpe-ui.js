// 🪵 Stolpepotensial i appen (js/stolpe.js): knapp og panel i kartet med de beste furubestandene, kort i bestandsinfoen,
// hint på hogsttiltak, og «Be om stolpebefaring» – melding i chatten til innkjøpere i nettverket, eller e-post.
import * as ST from './stolpe.js';
import { API } from './plan-synk.js';
import { hentNettverksmottakere, fyllBilder } from './tilbud-nettverk.js';
import { avatar } from './profilbilde-ui.js';
import { mailto } from './epost.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nb = (v, d = 0) => Number(v).toLocaleString('nb-NO', { maximumFractionDigits: d });
const stjerner = (n) => `<span class="st-stj" aria-label="${n} av 5">${'★'.repeat(n)}${'☆'.repeat(5 - n)}</span>`;
const HOGST = ['sluttavvirkning', 'tynning', 'lukkethogst'];

export function lagStolpeUi({ hentPlan, inn, avstand = () => null, kart, L, etikettPunkt, velgBestand, visFane = () => {}, melding = () => {}, innlogget = () => false, navn = () => '' }) {
  let lag = null;
  const S = () => hentPlan();
  const score = (b) => ST.stolpeScore(b, { inn: inn(), avstandVei: avstand(b) });
  const liste = () => ST.toppliste(S().bestand, { inn: inn(), avstand });
  const anslagTekst = (a) => (a ? `Anslått ${nb(a.stolper.min)}–${nb(a.stolper.maks)} stolper (${nb(a.m3.min)}–${nb(a.m3.maks)} m³)${a.merverdi.maks ? ` · merverdi mot vanlig tømmer opptil ca. ${nb(a.merverdi.maks / 1000)} tusen kr` : ''}` : '');

  // ---------- panel i kartet ----------
  function lukk() { document.querySelector('.stolpe-panel')?.remove(); lag?.clearLayers(); }
  function vis() {
    lukk(); const plan = S(); const l = liste();
    const p = document.createElement('div'); p.className = 'stolpe-panel'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Stolpepotensial');
    p.innerHTML = `<div class="jt-topp"><b>🪵 Stolpepotensial</b><button type="button" class="jt-lukk" data-st="lukk" aria-label="Lukk">×</button></div>
      <p class="st-ingress">Furubestand der det sannsynligvis står stolpetrær på ${esc(plan.eiendom?.navn || 'eiendommen')}. Stolper betales godt over sagtømmer (ca. ${nb(ST.PRIS.min)}–${nb(ST.PRIS.maks)} kr/m³).</p>
      ${!plan.bestand.length ? '<p class="hint">Last inn en plan først.</p>' : l.length ? `<ol class="jt-liste st-liste">${l.map((x, i) => `<li data-st-best="${esc(x.b.id)}"><span class="jt-nr st-nr">${i + 1}</span><div><b>Bestand ${esc(x.b.nr)}</b> ${stjerner(x.stjerner)} <span class="hint">${nb(x.b.areal || 0, 1)} daa</span>
        <small>${esc(x.grunner.join(' · '))}</small>${x.anslag ? `<small class="st-anslag">${esc(anslagTekst(x.anslag))}</small>` : ''}</div></li>`).join('')}</ol>
        <div class="knapperad" style="margin:6px 0"><button type="button" class="knapp primar liten" data-st="befaring">📨 Be om stolpebefaring</button></div>`
        : '<p class="hint">Ingen furubestand med stolpepotensial her. Stolper krever furu med overhøyde fra 16 m, middeldiameter rundt 20–40 cm og helst sakte vekst (bonitet F8–F14).</p>'}
      <details class="jt-def"><summary>Hva kreves av en stolpe?</summary><ul>${ST.KRAV.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>
        <p class="hint">5–10 % av furutrærne i et godt bestand blir stolper. ${esc(ST.SESONG)} Kilder: ${ST.KILDER.map((k) => `<a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.navn)}</a>`).join(' · ')}</p></details>
      <p class="hint jt-fot">⚠ Anslaget bygger på plandata og laserdata (SR16). Krok, kvist og råte kan bare sjekkes i skogen – stolpekjøperens stolpesyner avgjør. Gran telles ikke.</p>`;
    document.querySelector('#kart').parentElement.appendChild(p);
    const vl = document.querySelector('.kartverktoy'); if (vl && innerWidth > 860) p.style.top = `${vl.offsetTop + vl.offsetHeight + 8}px`;
    if (!lag) lag = L.layerGroup().addTo(kart);
    for (const [i, x] of l.entries()) { const pt = etikettPunkt(x.b.geometri); if (pt) L.marker([pt[1], pt[0]], { icon: L.divIcon({ className: 'st-markor', html: `<span>🪵<b>${i + 1}</b></span>`, iconSize: [34, 34], iconAnchor: [17, 30] }), keyboard: false, zIndexOffset: 1000 }).on('click', () => velgBestand(x.b.id)).addTo(lag); }
    p.addEventListener('click', (e) => {
      if (e.target.closest('[data-st="lukk"]')) { lukk(); return; }
      if (e.target.closest('[data-st="befaring"]')) { befaring(); return; }
      const r = e.target.closest('[data-st-best]'); if (r && !e.target.closest('a')) { visFane('bestand'); velgBestand(r.dataset.stBest); }
    });
  }

  // ---------- bestandsinfo og tiltak ----------
  function kortHtml(b) {
    if (ST.furuAndel(b) < 0.6) return ''; // bare furubestand
    const s = score(b); const felt = ST.feltStolper(S().registreringer || [], b.id);
    if (!s.stjerner && !felt.antall) { return s.uegnet && !/unge|Ikke furu|For lite furu|Miljø/.test(s.uegnet) ? `<div class="stolpe-kort svak"><b>🪵 Stolpepotensial</b> <span class="hint">${esc(s.uegnet)}</span></div>` : ''; }
    const a = ST.stolpeAnslag(b, s, { inn: inn() });
    return `<div class="stolpe-kort"><div class="stolpe-topp"><b>🪵 Stolpepotensial</b> ${stjerner(s.stjerner)}<button type="button" class="knapp liten" data-stolpe-befaring="${esc(b.id)}">📨 Be om stolpebefaring</button></div>
      <small>${esc(s.grunner.join(' · '))}</small>${a ? `<small class="st-anslag">${esc(anslagTekst(a))}</small>` : ''}
      ${felt.antall ? `<small>📍 Registrert i felt: <b>${felt.antall}</b> stolpetre${felt.antall === 1 ? '' : 'r'}${felt.godkjent < felt.antall ? ` (${felt.godkjent} med alle krav oppfylt)` : ' – alle krav oppfylt'}</small>` : ''}
      <small class="hint">Kvalitet (krok, kvist, råte) avgjøres i skogen av stolpekjøperens stolpesyner.</small></div>`;
  }
  // Hint på hogsttiltak i furubestand med stolpepotensial: be om stolpebefaring før hogst.
  function tiltakHint(t) {
    if (!t?.bestand || !HOGST.includes(t.type) || t.status === 'utfort') return '';
    const s = score(t.bestand); if (s.stjerner < 3) return '';
    return `<div class="stolpe-hint">🪵 Mulige stolpetrær ${stjerner(s.stjerner)} – <a href="#" data-stolpe-befaring="${esc(t.bestand.id)}">be om stolpebefaring</a> før hogsten, så stolpene sorteres ut.</div>`;
  }

  // ---------- «Be om stolpebefaring» ----------
  async function befaring(bestandId = null) {
    const plan = S(); let l = liste();
    if (bestandId) { const b = plan.bestand.find((x) => x.id === bestandId); if (b && !l.some((x) => x.b.id === b.id)) { const s = score(b); l = [{ b, ...s, anslag: ST.stolpeAnslag(b, s, { inn: inn() }) }, ...l]; } else l = [...l.filter((x) => x.b.id === bestandId), ...l.filter((x) => x.b.id !== bestandId)]; }
    if (!l.length) { melding('Ingen furubestand med stolpepotensial å be om befaring på.'); return; }
    const t = ST.befaringTekst(l.slice(0, 8), { eiendom: plan.eiendom?.navn || '', kommune: plan.eiendom?.kommune || '', navn: navn() });
    let nett = []; let nettFeil = '';
    if (innlogget()) { try { nett = (await hentNettverksmottakere()).filter((n) => n.rolle === 'innkjoper'); } catch (e) { nettFeil = e.message; } }
    document.querySelector('.st-dialog')?.remove();
    const d = document.createElement('dialog'); d.className = 'st-dialog';
    d.innerHTML = `<div class="st-dialog-inn"><div class="om-topp"><h2>📨 Be om stolpebefaring</h2><button type="button" class="tb-lukk" data-st-d="lukk" aria-label="Lukk">×</button></div>
      <p class="hint">En stolpesyner fra stolpekjøperen går gjennom bestandene og merker trærne som holder stolpekvalitet. ${esc(ST.SESONG)}</p>
      <h4 class="undertittel">🤝 Innkjøpere i nettverket ditt <span class="hint">– får meldingen i chatten</span></h4>
      ${nett.length ? `<div class="tn-liste">${nett.map((n) => `<label class="tn-kort"><input type="checkbox" data-st-til="${esc(n.kobling)}" checked>${avatar(n)}<span class="tn-tekst"><b>${esc(n.foretak || n.navn)}</b><small>${esc(n.foretak ? n.navn : 'Innkjøper')}</small></span></label>`).join('')}</div>`
        : `<p class="hint">${innlogget() ? 'Du er ikke koblet til noen innkjøpere ennå – finn dem under Nettverk.' : 'Logg inn for å sende til innkjøpere i nettverket.'}${nettFeil ? ` (${esc(nettFeil)})` : ''}</p>`}
      <label class="st-tekst">Melding <textarea rows="9" data-st-tekst>${esc(t.tekst)}</textarea></label>
      <div class="knapperad">${nett.length ? '<button type="button" class="knapp primar" data-st-d="send">Send i chatten</button>' : ''}<a class="knapp" data-st-d="epost" href="${esc(mailto({ emne: t.emne, tekst: t.tekst }))}">✉ E-post til stolpekjøper</a><button type="button" class="knapp" data-st-d="kopier">📋 Kopier</button></div></div>`;
    document.body.appendChild(d); fyllBilder(d); d.showModal();
    const tekst = () => d.querySelector('[data-st-tekst]').value;
    d.addEventListener('input', () => { d.querySelector('[data-st-d="epost"]').href = mailto({ emne: t.emne, tekst: tekst() }); });
    d.addEventListener('close', () => d.remove());
    d.addEventListener('click', async (e) => {
      const k = e.target.closest('[data-st-d]'); if (!k) { if (e.target === d) d.close(); return; }
      if (k.dataset.stD === 'lukk') d.close();
      if (k.dataset.stD === 'kopier') { try { await navigator.clipboard.writeText(tekst()); melding('Meldingen er kopiert.'); } catch { melding('Kunne ikke kopiere – merk teksten og kopier selv.'); } }
      if (k.dataset.stD === 'send') {
        const til = [...d.querySelectorAll('[data-st-til]:checked')].map((x) => x.dataset.stTil); if (!til.length) { melding('Velg minst én innkjøper.'); return; }
        k.disabled = true; let ok = 0;
        for (const kid of til) { try { const r = await fetch(`${API}/api/nettverk/koblinger/${encodeURIComponent(kid)}/meldinger`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ tekst: tekst() }) }); if (r.ok) ok++; } catch { /* prøver neste */ } }
        melding(ok ? `Forespørselen om stolpebefaring er sendt til ${ok} innkjøper${ok > 1 ? 'e' : ''} i chatten.` : 'Fikk ikke sendt meldingen. Prøv igjen.', ok ? undefined : 'feil');
        if (ok) d.close(); else k.disabled = false;
      }
    });
  }

  document.addEventListener('click', (e) => { const k = e.target.closest('[data-stolpe-befaring]'); if (!k) return; e.preventDefault(); befaring(k.dataset.stolpeBefaring); });
  return { vis, lukk, apen: () => !!document.querySelector('.stolpe-panel'), kortHtml, tiltakHint, befaring };
}
