// «📏 Mål» i kartet: trykk punkter for å måle lengde, eller en flate for areal, omkrets og volum per treslag innenfor
// flaten. Verdiene oppdateres mens du tegner (strikk til markøren), punktene kan dras etterpå, og resultatet kan
// kopieres. Hurtigtaster: Enter fullfører, Backspace angrer siste punkt, Esc avslutter. Logikken ligger i maaling.js.
import * as M from './maaling.js';
import { TRESLAG } from './model.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nb = (v, d = 0) => Number(v).toLocaleString('nb-NO', { minimumFractionDigits: d, maximumFractionDigits: d });
const FARGE = { G: '#1f6b4a', F: '#c98500', L: '#8fbf3f' };

export function lagMaaling({ L, kart, rot, hentPlan, lastPC, settKartKlikk, melding, visBestand = () => {} }) {
  let aktiv = false; let modus = 'areal'; let pts = []; let ferdig = false; let mus = null;
  let lag = null; let strikk = null; let markorer = []; let tips = null; let vol = null; let beregner = false; let tid = null;
  const S = () => hentPlan();

  function start(m = modus) {
    if (aktiv) { nullstill(); modus = m; tegnPanel(); return; }
    aktiv = true; modus = m; pts = []; ferdig = false;
    lag = L.layerGroup().addTo(kart);
    settKartKlikk((ll) => klikk(ll));
    kart.doubleClickZoom.disable(); kart.getContainer().classList.add('maaler');
    kart.on('mousemove', bevegelse); kart.on('dblclick', dobbel);
    document.addEventListener('keydown', taster);
    tegnPanel();
  }
  function stopp() {
    if (!aktiv) return; aktiv = false;
    settKartKlikk(null); kart.doubleClickZoom.enable(); kart.getContainer().classList.remove('maaler');
    kart.off('mousemove', bevegelse); kart.off('dblclick', dobbel); document.removeEventListener('keydown', taster);
    lag?.remove(); lag = null; strikk = null; markorer = []; tips?.remove(); tips = null; vol = null;
    const el = rot(); if (el) { el.hidden = true; el.innerHTML = ''; }
  }
  function nullstill() { pts = []; ferdig = false; vol = null; tegnGeometri(); tegnPanel(); }

  // ---------- kart ----------
  function klikk(ll) {
    if (ferdig) { nullstill(); }
    // Trykk på første punkt lukker flaten.
    if (modus === 'areal' && pts.length >= 3) { const p0 = kart.latLngToContainerPoint([pts[0][1], pts[0][0]]); const p = kart.latLngToContainerPoint(ll); if (p0.distanceTo(p) < 14) { fullfor(); return; } }
    pts.push([ll.lng, ll.lat]); tegnGeometri(); tegnPanel();
  }
  function dobbel() { if (pts.length >= (modus === 'areal' ? 3 : 2)) fullfor(); }
  function fullfor() {
    if (pts.length < (modus === 'areal' ? 3 : 2)) { melding(modus === 'areal' ? 'Sett minst tre punkter for en flate.' : 'Sett minst to punkter.'); return; }
    // Dobbeltklikk legger til et punkt for mye på samme sted – fjern det.
    while (pts.length > 2 && Math.hypot(pts.at(-1)[0] - pts.at(-2)[0], pts.at(-1)[1] - pts.at(-2)[1]) < 1e-7) pts.pop();
    ferdig = true; mus = null; tegnGeometri(); tegnPanel(); if (modus === 'areal') beregnVolum();
  }
  function bevegelse(e) {
    if (!aktiv || ferdig || !pts.length) { tips?.remove(); tips = null; return; }
    mus = [e.latlng.lng, e.latlng.lat]; tegnStrikk();
    const alle = [...pts, mus];
    const tekst = modus === 'lengde' ? `${M.lengdeTekst(M.lengde(alle).total)}<br><small>+ ${M.lengdeTekst(M.lengde([pts.at(-1), mus]).total)}</small>` : alle.length >= 3 ? `${M.arealTekst(M.flate(alle).areal)}` : M.lengdeTekst(M.lengde(alle).total);
    if (!tips) tips = L.tooltip({ permanent: true, direction: 'right', offset: [14, 0], className: 'maal-tips' }).setLatLng(e.latlng).setContent(tekst).addTo(kart);
    else tips.setLatLng(e.latlng).setContent(tekst);
  }
  function tegnStrikk() {
    if (!lag) return; const ll = (p) => [p[1], p[0]];
    const linje = mus && !ferdig ? (modus === 'areal' && pts.length >= 2 ? [ll(pts.at(-1)), ll(mus), ll(pts[0])] : [ll(pts.at(-1)), ll(mus)]) : [];
    if (!strikk) strikk = L.polyline(linje, { color: '#ffd400', weight: 2, dashArray: '5 5', interactive: false }).addTo(lag); else strikk.setLatLngs(linje);
  }
  function tegnGeometri() {
    if (!lag) return; lag.clearLayers(); strikk = null; markorer = []; tips?.remove(); tips = null;
    if (!pts.length) return; const ll = pts.map((p) => [p[1], p[0]]);
    const stil = { color: '#ffd400', weight: 3, interactive: false };
    if (modus === 'areal' && pts.length >= 3) L.polygon(ll, { ...stil, fillColor: '#ffd400', fillOpacity: ferdig ? 0.18 : 0.1, dashArray: ferdig ? null : '6 4' }).addTo(lag);
    else L.polyline(ll, stil).addTo(lag);
    // Lengde per strekk.
    if (modus === 'lengde' || ferdig) {
      const sett = modus === 'areal' ? [...pts, pts[0]] : pts; const d = M.lengde(sett).deler;
      d.forEach((m, i) => { if (m < 5) return; const a = sett[i]; const b = sett[i + 1]; L.marker([(a[1] + b[1]) / 2, (a[0] + b[0]) / 2], { interactive: false, icon: L.divIcon({ className: 'maal-strekk', html: `<span>${M.lengdeTekst(m)}</span>`, iconSize: null }) }).addTo(lag); });
    }
    pts.forEach((p, i) => {
      const m = L.marker([p[1], p[0]], { draggable: true, keyboard: false, icon: L.divIcon({ className: `maal-punkt${i === 0 && modus === 'areal' && !ferdig && pts.length >= 3 ? ' forste' : ''}`, iconSize: [14, 14], iconAnchor: [7, 7] }), title: i === 0 && modus === 'areal' && !ferdig ? 'Trykk her for å lukke flaten' : 'Dra for å flytte' }).addTo(lag);
      m.on('click', (e) => { L.DomEvent.stopPropagation(e); if (i === 0 && modus === 'areal' && !ferdig && pts.length >= 3) fullfor(); });
      m.on('drag', () => { const q = m.getLatLng(); pts[i] = [q.lng, q.lat]; oppdaterFormer(); });
      m.on('dragend', () => { tegnGeometri(); tegnPanel(); if (ferdig && modus === 'areal') beregnVolum(); });
      markorer.push(m);
    });
    tegnStrikk();
  }
  function oppdaterFormer() { lag?.eachLayer((l) => { if (l instanceof L.Polygon || (l instanceof L.Polyline && l !== strikk)) l.setLatLngs(pts.map((p) => [p[1], p[0]])); }); tegnPanel(); }
  function taster(e) {
    if (!aktiv || e.target.closest?.('input, textarea, select')) return;
    if (e.key === 'Escape') { e.preventDefault(); if (pts.length && !ferdig) nullstill(); else stopp(); }
    if (e.key === 'Enter') { e.preventDefault(); fullfor(); }
    if (e.key === 'Backspace' && pts.length && !ferdig) { e.preventDefault(); pts.pop(); tegnGeometri(); tegnPanel(); }
  }

  // ---------- volum ----------
  function beregnVolum() {
    clearTimeout(tid); beregner = true; tegnPanel();
    tid = setTimeout(async () => {
      try { const PC = await lastPC(); if (!PC) throw new Error('Fikk ikke lastet geometribiblioteket.'); vol = M.volum(S(), pts, PC); }
      catch (e) { vol = null; melding(e.message || 'Klarte ikke å beregne volumet.', 'feil'); }
      beregner = false; tegnPanel();
    }, 30);
  }

  // ---------- panel ----------
  function volumHtml() {
    if (beregner) return '<p class="hint">Beregner volum …</p>';
    if (!vol) return '';
    if (!vol.rader.length) return '<p class="hint">Flaten dekker ingen bestand i planen – ikke noe volum å vise.</p>';
    const tot = vol.m3 || 1;
    return `<div class="maal-vol">
      <div class="maal-stor"><b>${nb(vol.m3)} m³</b><span>stående volum · ${nb(vol.m3Daa, 1)} m³/daa</span></div>
      <div class="maal-stolpe" role="img" aria-label="Volum per treslag">${['G', 'F', 'L'].filter((t) => vol.perTreslag[t] > 0).map((t) => `<span style="flex:${vol.perTreslag[t]};background:${FARGE[t]}" title="${TRESLAG[t]}: ${nb(vol.perTreslag[t])} m³"></span>`).join('')}</div>
      <table class="maal-tabell"><tbody>${['G', 'F', 'L'].map((t) => `<tr><td><i style="background:${FARGE[t]}"></i>${TRESLAG[t]}</td><td class="t"><b>${nb(vol.perTreslag[t] || 0)} m³</b></td><td class="t hint">${nb(((vol.perTreslag[t] || 0) / tot) * 100)} %</td></tr>`).join('')}</tbody></table>
      ${vol.utenfor > 50 ? `<p class="hint">${M.arealTekst(vol.utenfor)} av flaten ligger utenfor bestandene (ikke med i volumet).</p>` : ''}
      ${vol.miljo > 0.5 ? `<p class="hint">⚠️ ${nb(vol.miljo)} m³ står i miljøfigurer.</p>` : ''}
      <details class="maal-best"><summary>${vol.rader.length} bestand i flaten</summary><table class="maal-tabell"><thead><tr><th>Bestand</th><th class="t">Areal</th><th class="t">m³/daa</th><th class="t">m³</th></tr></thead><tbody>
        ${vol.rader.map((r) => `<tr><td><a href="#" data-maal-b="${esc(r.id)}">${esc(r.nr)}</a> <span class="hint">${esc(r.treslag || '')}${r.miljo ? ' 🦉' : ''}</span></td><td class="t">${nb(r.areal / 1000, 1)} daa${r.andelAvBestand != null && r.andelAvBestand < 0.98 ? ` <span class="hint">(${nb(r.andelAvBestand * 100)} %)</span>` : ''}</td><td class="t">${nb(r.m3Daa, 1)}</td><td class="t">${nb(r.m3)}</td></tr>`).join('')}
      </tbody></table></details>
      <p class="hint maal-kilde">Volum i dag fra planen (framskrevet). ${vol.fordelingKilde === 'andel' ? 'Fordelt etter treslagsandelene i bestandene.' : vol.fordelingKilde === 'blandet' ? 'Fordelt etter treslagsandeler der de finnes, ellers etter hovedtreslag.' : 'Fordelt etter hovedtreslaget i hvert bestand (planen har ikke treslagsandeler).'}</p>
    </div>`;
  }
  function tegnPanel() {
    const el = rot(); if (!el) return; if (!aktiv) { el.hidden = true; return; }
    el.hidden = false;
    const alle = ferdig || !mus ? pts : [...pts, mus];
    const len = M.lengde(modus === 'areal' && ferdig ? [...pts, pts[0]] : pts); const fl = M.flate(pts);
    const hjelp = !pts.length ? 'Trykk i kartet for å sette første punkt.' : ferdig ? 'Dra punktene for å justere, eller trykk i kartet for en ny måling.' : modus === 'areal' ? (pts.length < 3 ? 'Trykk flere punkter rundt flaten.' : 'Trykk på første punkt, dobbeltklikk eller trykk «Ferdig» for å lukke flaten.') : 'Trykk flere punkter. Dobbeltklikk eller «Ferdig» når du er ferdig.';
    void alle;
    el.innerHTML = `<div class="maal-topp"><b>📏 Mål i kartet</b><button type="button" class="knapp liten" data-maal="lukk" aria-label="Lukk måleverktøyet">✕</button></div>
      <div class="maal-modus" role="tablist"><button type="button" role="tab" data-maal="modus" data-m="lengde" aria-selected="${modus === 'lengde'}" class="${modus === 'lengde' ? 'aktiv' : ''}">📏 Lengde</button><button type="button" role="tab" data-maal="modus" data-m="areal" aria-selected="${modus === 'areal'}" class="${modus === 'areal' ? 'aktiv' : ''}">⬠ Areal og volum</button></div>
      <p class="hint maal-hjelp">${hjelp}</p>
      ${modus === 'lengde'
        ? `<div class="maal-stor"><b>${M.lengdeTekst(len.total)}</b><span>${len.deler.length ? `${len.deler.length} strekk` : 'lengde'}</span></div>`
        : `<div class="maal-rad"><div class="maal-stor"><b>${pts.length >= 3 ? nb(fl.areal / 1000, fl.areal < 10000 ? 2 : 1) : '–'} daa</b><span>${pts.length >= 3 ? `${nb(fl.areal)} m² · ${nb(fl.areal / 10000, 2)} ha` : 'areal'}</span></div><div class="maal-stor"><b>${pts.length >= 2 ? M.lengdeTekst(fl.omkrets) : '–'}</b><span>omkrets</span></div></div>
           ${ferdig ? volumHtml() : pts.length >= 3 ? '<p class="hint">Volumet beregnes når flaten er lukket.</p>' : ''}`}
      <div class="knapperad maal-knapper">
        ${!ferdig && pts.length >= (modus === 'areal' ? 3 : 2) ? '<button type="button" class="knapp liten primar" data-maal="ferdig">✓ Ferdig</button>' : ''}
        ${!ferdig && pts.length ? '<button type="button" class="knapp liten" data-maal="angre" title="Backspace">↶ Angre punkt</button>' : ''}
        ${pts.length ? '<button type="button" class="knapp liten" data-maal="ny">Ny måling</button>' : ''}
        ${ferdig ? '<button type="button" class="knapp liten" data-maal="kopier">📋 Kopier</button>' : ''}
      </div>
      <p class="hint maal-taster">Enter = ferdig · Backspace = angre · Esc = avslutt</p>`;
  }
  // Panelets knapper.
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-maal-b]'); if (b && aktiv) { e.preventDefault(); visBestand(b.dataset.maalB); return; }
    const k = e.target.closest('[data-maal]'); if (!k || !aktiv) return; const h = k.dataset.maal;
    if (h === 'lukk') stopp();
    if (h === 'modus') { modus = k.dataset.m; nullstill(); }
    if (h === 'ferdig') fullfor();
    if (h === 'angre') { pts.pop(); tegnGeometri(); tegnPanel(); }
    if (h === 'ny') nullstill();
    if (h === 'kopier') {
      const tekst = M.sammendrag({ modus, len: M.lengde(pts), fl: M.flate(pts), vol: modus === 'areal' ? vol : null });
      try { await navigator.clipboard.writeText(tekst); melding('Målingen er kopiert.'); } catch { prompt('Kopier målingen:', tekst); }
    }
  });
  return { start, stopp, aktiv: () => aktiv };
}
