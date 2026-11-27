// Skogbrand › ⚠ Varsel 5 døgn: skadevarsel for skog i alle kommuner med skog, sortert etter anslått skade. Data fra
// /api/skadevarsel (skadevarsel.js på serveren: SR16-skogprofil per kommune og vær fra met.no). Herfra går man rett til
// skadesimuleringen for kommunen (Kommune-fanen).
import { API } from './plan-synk.js';
import { BRANNNIVAA } from './skade.js';
import { himmel } from './skadesim.js';
import { fmt } from './charts.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LOKALE = () => (typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en-GB' : 'nb-NO');
const dag = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString(LOKALE(), { weekday: 'short', day: 'numeric', month: 'numeric' }) : '');
const kr = (v) => (v >= 1e6 ? `${fmt(v / 1e6, 1)} mill. kr` : `${fmt(Math.round(v / 1000) * 1000)} kr`);
const NIVAA = (kr0) => (kr0 >= 5e6 ? { id: 'hoy', navn: 'Stor', farge: '#b3261e' } : kr0 >= 5e5 ? { id: 'middels', navn: 'Middels', farge: '#e0602c' } : kr0 >= 5e4 ? { id: 'lav', navn: 'Liten', farge: '#f2c230' } : { id: 'ingen', navn: 'Ingen', farge: '#9aa59a' });
const SORTER = { samlet: 'Samlet anslått skade', storm: 'Storm', sno: 'Snøbrekk', brann: 'Brannfare' };

export function lagSkadevarselUi({ kart, hentPlan, melding, aapneSimulering }) {
  const lag = L.layerGroup(); let data = null; let henter = false; let feil = ''; let sortering = 'samlet'; let bareSkade = true; let sok = ''; let synlig = false; let hentetTid = 0; let zoomet = false;
  async function hent(tving = false) {
    if (henter || (!tving && data && Date.now() - hentetTid < 10 * 60e3)) return;
    henter = true; feil = ''; tegn?.();
    try {
      const r = await fetch(`${API}/api/skadevarsel`, { credentials: 'same-origin', cache: 'no-store' });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.feil || `Serveren svarte ${r.status}`);
      data = j; hentetTid = Date.now();
    } catch (e) { feil = e.message; } finally { henter = false; tegn?.(); }
  }
  const verdi = (k) => (sortering === 'storm' ? k.storm?.kr || 0 : sortering === 'sno' ? k.sno?.kr || 0 : sortering === 'brann' ? k.brann?.fwi ?? -1 : k.kr);
  function liste() {
    let l = [...(data?.kommuner || [])];
    if (sok) { const q = sok.toLowerCase(); l = l.filter((k) => k.navn.toLowerCase().includes(q) || k.fylke?.toLowerCase().includes(q) || k.nr === sok); }
    else if (bareSkade) l = l.filter((k) => (sortering === 'brann' ? (k.brann?.fwi ?? 0) >= 5.2 : verdi(k) >= 5e4));
    return l.sort((a, b) => verdi(b) - verdi(a));
  }
  let tegn = null;
  function html() {
    const minKommune = hentPlan()?.eiendom?.kommunenr;
    if (!data && henter) return '<section class="kort"><p class="hint">Henter skadevarselet …</p></section>';
    if (feil) return `<section class="kort"><h3>⚠ Skadevarsel for skog – neste 5 døgn</h3><p class="sf-varsel">Fikk ikke hentet varselet: ${esc(feil)}</p><button type="button" class="knapp liten" data-sv="hent">Prøv igjen</button></section>`;
    const st = data?.status || {};
    if (!data?.kommuner?.length) return `<section class="kort"><h3>⚠ Skadevarsel for skog – neste 5 døgn</h3><p class="hint">${st.fase === 'skogprofiler' ? `Serveren bygger skogprofil for kommunene fra SR16 (${st.ferdig} av ${st.totalt}). Det tar noen minutter første gang.` : st.fase === 'vær' ? `Henter værprognosen for kommunene (${st.ferdig} av ${st.totalt}) …` : 'Varselet er ikke klart ennå.'}</p><button type="button" class="knapp liten" data-sv="hent">Oppdater</button></section>`;
    const l = liste(); const vis = l.slice(0, 60);
    const totalt = data.kommuner.filter((k) => k.kr >= 5e4).length;
    const min = minKommune ? data.kommuner.find((k) => k.nr === minKommune) : null;
    return `<section class="kort sv">
      <div class="detalj-topp"><h3>⚠ Skadevarsel for skog – neste 5 døgn</h3><button type="button" class="knapp liten" data-sv="hent" ${henter ? 'disabled' : ''}>${henter ? 'Henter …' : 'Oppdater'}</button></div>
      <p class="hint"><span>Anslått skade på skog fra storm og snøbrekk de neste 5 døgnene</span> <span data-ikke-oversett>(${esc(dag(data.dager?.[0]))}–${esc(dag(data.dager?.at(-1)))})</span> <span>for ${fmt(data.kommuner.length)} kommuner med skog, og skogbrannfaren.</span> ${totalt ? `<span><b>${totalt} kommuner</b> har varslet skade.</span>` : '<span>Ingen kommuner har varslet skade av betydning.</span>'} <span>Oppdatert ${esc(new Date(data.oppdatert).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' }))}.</span></p>
      ${min ? `<div class="sv-min">Din kommune <b data-ikke-oversett>${esc(min.navn)}</b>: ${min.kr >= 5e4 ? `anslått skade ${esc(kr(min.kr))}` : 'ingen varslet skade av betydning'}${min.brann ? ` · brannfare ${esc(BRANNNIVAA.find((n) => n.id === min.brann.nivaa)?.navn?.toLowerCase() || '')}` : ''} <button type="button" class="knapp liten primar" data-sv-sim="${esc(min.nr)}">Simuler →</button></div>` : ''}
      <div class="verktoyrad sv-verktoy">
        <select data-sv-sorter aria-label="Sorter">${Object.entries(SORTER).map(([id, n]) => `<option value="${id}" ${id === sortering ? 'selected' : ''}>Sorter: ${esc(n)}</option>`).join('')}</select>
        <input type="search" data-sv-sok placeholder="Finn kommune eller fylke" value="${esc(sok)}" aria-label="Finn kommune">
        <label class="avkrysning"><input type="checkbox" data-sv-bare ${bareSkade ? 'checked' : ''}> Bare kommuner med varslet ${sortering === 'brann' ? 'brannfare' : 'skade'}</label>
      </div>
      ${vis.length ? `<ol class="sv-liste">
        ${vis.map((k, i) => { const n = NIVAA(k.kr); const maksDag = Math.max(1, ...k.perDag.map((d) => d.kr)); const bn = k.brann ? BRANNNIVAA.find((x) => x.id === k.brann.nivaa) : null;
          return `<li data-sv-rad="${esc(k.nr)}" class="sv-rad ${k.nr === minKommune ? 'sv-min-rad' : ''}" style="--farge:${n.farge}">
            <span class="sv-nr">${i + 1}</span>
            <div class="sv-navn"><b data-ikke-oversett>${esc(k.navn)}</b> <span class="hint"><span data-ikke-oversett>${esc(k.fylke || '')}</span> · <span>${fmt(Math.round(k.skogDaa / 1000))} km² skog</span></span></div>
            <div class="sv-sum"><span class="sv-niva">${esc(k.kr >= 5e4 ? kr(k.kr) : 'Ingen skade')}</span><button type="button" class="knapp liten ${k.kr >= 5e4 ? 'primar' : ''}" data-sv-sim="${esc(k.nr)}">Simuler →</button></div>
            <div class="sv-detaljer">
              <span title="Kraftigste vindkast">🌪 ${k.storm?.kast != null ? `<span>${k.storm.kast} m/s${k.storm.retning != null ? ` fra ${esc(himmel(k.storm.retning))}` : ''}</span> · <span data-ikke-oversett>${esc(dag(k.storm.dato))}</span>${k.storm.kr ? ` · <b>${esc(kr(k.storm.kr))}</b>` : ''}` : '–'}</span>
              ${k.sno?.cm ? `<span title="Nysnø over to døgn">❄ ${k.sno.cm} cm · <span data-ikke-oversett>${esc(dag(k.sno.dato))}</span>${k.sno.kr ? ` · <b>${esc(kr(k.sno.kr))}</b>` : ''}</span>` : ''}
              ${bn ? `<span title="Skogbrannindeks (FWI)"><span class="pille" style="--farge:${bn.farge}">🔥 ${esc(bn.navn)}</span> FWI ${fmt(k.brann.fwi, 1)} · <span data-ikke-oversett>${esc(dag(k.brann.dato))}</span></span>` : ''}
              <span class="sv-dager" title="Anslått skade per døgn">${k.perDag.map((d) => `<span title="${esc(dag(d.dato))}: ${esc(kr(d.kr))} · kast ${d.kast} m/s · snø ${d.sno} cm"><i style="height:${Math.max(2, Math.round((d.kr / maksDag) * 18))}px;background:${NIVAA(d.kr).farge}"></i></span>`).join('')}</span>
            </div></li>`; }).join('')}
      </ol>${l.length > vis.length ? `<p class="hint">Viser de ${vis.length} første av ${l.length}. Søk etter en kommune for å finne den.</p>` : ''}` : `<p class="hint">${sok ? 'Fant ingen kommune med det navnet.' : 'Ingen kommuner har varslet skade de neste 5 døgnene. Slå av «Bare kommuner med varslet skade» for å se alle.'}</p>`}
      <details class="ekstra"><summary>Slik lages varselet</summary><p class="hint">For hver kommune lages en skogprofil fra NIBIOs skogressurskart SR16 (treslag, middelhøyde og volum, ca. 100 m oppløsning innenfor kommunegrensa), med hvor mye skog som har åpen kant mot hver vindretning. Værprognosen og skogbrannindeksen fra Meteorologisk institutt hentes i et punkt i hver kommune hver 3. time. Storm og snøbrekk regnes med de samme modellene som simuleringen (kritisk vindkast og snølast), og anslått skade er verditapet etter prisene i appen. Store kommuner kan ha store forskjeller i vær – åpne simuleringen for å se værprognosen i flere punkter. Anslagene er forenklede og ikke prognoser.</p><p class="hint">Kilder: ${esc(data.kilde || '')}.</p></details>
    </section>`;
  }
  function tegnKart() {
    lag.clearLayers(); if (!synlig || !data?.kommuner?.length) return;
    for (const k of data.kommuner) {
      const n = NIVAA(k.kr); const b = k.brann && ['rod', 'morkerod'].includes(k.brann.nivaa);
      if (n.id === 'ingen' && !b) continue;
      L.circleMarker([k.pos[1], k.pos[0]], { radius: n.id === 'hoy' ? 11 : n.id === 'middels' ? 9 : 7, color: b ? '#5c0a0a' : '#fff', weight: b ? 3 : 2, fillColor: n.id === 'ingen' ? '#f08a24' : n.farge, fillOpacity: 0.95 })
        .bindTooltip(`<b>${esc(k.navn)}</b><br>${k.kr >= 5e4 ? `Anslått skade ${esc(kr(k.kr))}` : 'Liten skade'}${k.storm?.kast ? `<br>Vindkast ${k.storm.kast} m/s` : ''}${k.sno?.cm ? `<br>Snø ${k.sno.cm} cm` : ''}${k.brann ? `<br>Brannfare FWI ${fmt(k.brann.fwi, 1)}` : ''}`)
        .on('click', () => { const r = document.querySelector(`[data-sv-rad="${k.nr}"]`); if (r) { r.scrollIntoView({ block: 'center', behavior: 'smooth' }); r.classList.add('sv-blink'); setTimeout(() => r.classList.remove('sv-blink'), 1500); } else { sok = k.navn; tegn?.(); } })
        .addTo(lag);
    }
  }
  function klikk(e) {
    const s = e.target.closest('[data-sv-sim]'); if (s) { const k = data?.kommuner?.find((x) => x.nr === s.dataset.svSim); if (k) aapneSimulering(k); return true; }
    const r = e.target.closest('[data-sv-rad]'); if (r && !e.target.closest('button')) { const k = data?.kommuner?.find((x) => x.nr === r.dataset.svRad); if (k) kart.setView([k.pos[1], k.pos[0]], 10); return true; }
    if (e.target.closest('[data-sv="hent"]')) { hent(true); return true; }
    return false;
  }
  function endring(e) {
    if (e.target.matches('[data-sv-sorter]')) { sortering = e.target.value; tegn?.(); return true; }
    if (e.target.matches('[data-sv-bare]')) { bareSkade = e.target.checked; tegn?.(); return true; }
    return false;
  }
  function input(e) { if (!e.target.matches('[data-sv-sok]')) return false; sok = e.target.value.trim(); const pos = e.target.selectionStart; tegn?.(); const f = document.querySelector('[data-sv-sok]'); if (f) { f.focus(); f.setSelectionRange(pos, pos); } return true; }
  return {
    html, klikk, endring, input,
    koble(t) { tegn = () => { t(); tegnKart(); }; },
    vis() { synlig = true; lag.addTo(kart); hent().then(() => { if (!zoomet && data?.kommuner?.length) { zoomet = true; const m = data.kommuner.filter((k) => k.kr >= 5e4 || ['rod', 'morkerod'].includes(k.brann?.nivaa)); const b = L.latLngBounds((m.length ? m : data.kommuner).map((k) => [k.pos[1], k.pos[0]])); kart.fitBounds(b.pad(0.3), { maxZoom: 8 }); } }); tegnKart(); },
    skjul() { synlig = false; lag.remove(); },
  };
}
