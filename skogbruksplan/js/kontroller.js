// SkogIQ på fjernkontrollen (DJI RC Plus / RC Pro Enterprise – Android, nettleseren). Viser en koblingskode som skrives
// inn i SkogIQ Felt på telefonen. Etterpå kommer droneoppdragene hit automatisk (henter hvert 5. sekund), og ruten
// lastes ned med ett trykk og importeres i DJI Pilot 2. Server: kontroller-relay.js.
import './innlogging.js'; // først: økten følger med alle kall til serveren
const API = location.hostname.endsWith('github.io') ? 'https://skogiq-production.up.railway.app' : '';
const LS = 'skogiq-kontroller-id';
const ls = { get: () => { try { return localStorage.getItem(LS); } catch { return null; } }, set: (v) => { try { localStorage.setItem(LS, v); } catch { /* privat */ } } };
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v, d = 0) => (v == null || Number.isNaN(v) ? '–' : Number(v).toLocaleString('nb-NO', { maximumFractionDigits: d, minimumFractionDigits: d }));
const kl = (t) => new Date(t).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const visKode = (k) => (k ? `${k.slice(0, 3)} ${k.slice(3)}` : '');

let id = ls.get(); let kode = null; let utloper = 0; let telefoner = 0; let oppdrag = []; let sett = new Set(); let apen = null;

async function api(sti, opt = {}) {
  const r = await fetch(API + sti, { ...opt, headers: { 'Content-Type': 'application/json', ...(opt.headers || {}) } });
  if (!r.ok) throw Object.assign(new Error((await r.json().catch(() => ({}))).feil || r.statusText), { status: r.status });
  return r.json();
}
async function registrer() {
  const r = await api('/api/kontroller', { method: 'POST', body: JSON.stringify({ id }) });
  id = r.id; ls.set(id); kode = r.kode; utloper = r.utloper; telefoner = r.telefoner; oppdrag = r.oppdrag; sett = new Set(oppdrag.map((o) => o.oid));
  tegn();
}
async function oppdater() {
  try {
    if (!id) { await registrer(); return; }
    if (Date.now() > utloper - 30000) { await registrer(); setStatus(true); return; }
    const l = await api(`/api/kontroller/${id}/oppdrag`);
    const nye = l.filter((o) => !sett.has(o.oid));
    oppdrag = l; if (nye.length) { telefoner = Math.max(telefoner, 1); try { navigator.vibrate?.(200); } catch { /* ingen vibrasjon */ } }
    tegn(nye.map((o) => o.oid)); setStatus(true);
  } catch (e) { if (e.status === 404) { id = null; await registrer().catch(() => {}); } setStatus(false); }
}
function setStatus(ok) { const s = $('#status'); s.textContent = ok ? (navigator.onLine ? 'Tilkoblet – venter på oppdrag' : 'Uten nett') : 'Ingen kontakt med SkogIQ – prøver igjen'; s.classList.toggle('av', !ok); }

function tegn(nye = []) {
  for (const n of nye) sett.add(n);
  $('#kobling').innerHTML = `<h2>Koble til telefonen</h2>
    <p>I SkogIQ Felt på telefonen: <b>Mer → Droneoppdrag</b>, åpne et oppdrag → <b>Start oppdraget</b> → <b>Send til kontrolleren</b>, og skriv inn koden:</p>
    <div class="kode ${telefoner || oppdrag.length ? 'liten' : ''}">${esc(visKode(kode))}</div>
    <p class="dempet">Koden gjelder til ${new Date(utloper).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })} og kan brukes én gang. Kontrolleren husker koblingen – neste gang sender du bare.${telefoner ? ` ${telefoner} telefon${telefoner > 1 ? 'er' : ''} er koblet til.` : ''}</p>
    <div class="knapper"><button class="knapp" data-k="ny-kode">Ny kode</button></div>
    <h2 style="margin-top:22px">Tips</h2>
    <p class="dempet">Legg denne siden som bokmerke eller på startskjermen på kontrolleren (adresse: ${esc(location.host)}/k). Siden må være åpen for at nye oppdrag skal dukke opp.</p>`;
  $('#liste').innerHTML = oppdrag.map((o) => {
    const i = o.info || {}; const ny = sett.has(o.oid) && nye.includes(o.oid);
    const merke = o.status === 'flydd' ? '<span class="merke flydd">Flydd</span>' : o.status === 'importert' ? '<span class="merke">Importert</span>' : o.hentet ? '<span class="merke">Lastet ned</span>' : '<span class="merke ny">Ny</span>';
    return `<article class="o ${o.hentet ? '' : 'ny'}" data-oid="${o.oid}">
      <div class="tittel">${esc(o.navn)} ${merke}</div>
      <div class="tall">${i.arealDaa != null ? `<span><b>${fmt(i.arealDaa, 1)}</b> daa</span>` : ''}${i.hoyde ? `<span><b>${fmt(i.hoyde)}</b> m</span>` : ''}${i.gsd ? `<span><b>${fmt(i.gsd, 1)}</b> cm/px</span>` : ''}${i.flytid ? `<span><b>${fmt(i.flytid)}</b> min</span>` : ''}${i.batterier ? `<span><b>${i.batterier}</b> batteri${i.batterier > 1 ? 'er' : ''}</span>` : ''}${i.bilder ? `<span><b>${fmt(i.bilder)}</b> bilder</span>` : ''}${i.drone ? `<span>${esc(i.drone)}</span>` : ''}<span>sendt ${esc(kl(o.sendt))}</span></div>
      <div class="knapper"><a class="knapp primar" href="${API}/api/kontroller/${id}/oppdrag/${o.oid}.kmz" download data-k="last-ned">⬇ Last ned rute</a>${o.status !== 'flydd' ? '<button class="knapp" data-k="importert">✓ Importert i Pilot 2</button><button class="knapp" data-k="flydd">✓ Flydd</button>' : ''}<button class="knapp fare" data-k="slett">Slett</button></div>
      ${apen === o.oid || (o.hentet && o.status === 'hentet') ? `<div class="steg"><b>Neste:</b><ol><li>Åpne <b>DJI Pilot 2</b> → <b>Ruter</b> (Flight Route).</li><li>Trykk <b>Importer rute</b> (ikonet øverst til høyre) → <b>Nedlastinger</b> (Download) → velg <i>${esc(o.navn)}.kmz</i>.</li><li>Kontroller ruten, slå på terrengfølging ved bratt terreng, og trykk <b>Start</b>.</li></ol></div>` : ''}
    </article>`;
  }).join('') || '<div class="tom">Ingen droneoppdrag ennå. Send et fra SkogIQ Felt på telefonen – det dukker opp her automatisk.</div>';
}

document.addEventListener('click', async (e) => {
  const k = e.target.closest('[data-k]')?.dataset.k; if (!k) return;
  const oid = e.target.closest('[data-oid]')?.dataset.oid;
  try {
    if (k === 'ny-kode') { await registrer(); return; }
    if (k === 'last-ned') { apen = oid; setTimeout(oppdater, 1500); return; }
    if (k === 'slett') { if (!confirm('Slette oppdraget fra kontrolleren?')) return; await api(`/api/kontroller/${id}/oppdrag/${oid}`, { method: 'DELETE' }); }
    if (k === 'importert' || k === 'flydd') await api(`/api/kontroller/${id}/oppdrag/${oid}/status`, { method: 'POST', body: JSON.stringify({ status: k }) });
    await oppdater();
  } catch (err) { alert(err.message); }
});
window.addEventListener('online', oppdater); window.addEventListener('offline', () => setStatus(true));
registrer().then(() => setStatus(true)).catch(() => setStatus(false));
setInterval(oppdater, 5000);
