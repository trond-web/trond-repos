// Adminsiden (admin.html): hvem som har registrert seg, og hvor mye SkogIQ.ai brukes. Data fra /api/admin/oversikt
// (auth.js). Bare for administratorer; andre sendes til appen av serveren.
import { RAILWAY, gyldigToken } from './innlogging.js';

const API = /github\.io$/.test(location.hostname) ? RAILWAY : '';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tall = (v) => Number(v || 0).toLocaleString('nb-NO');
const dato = (t) => (t ? new Date(t).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');
const tid = (t) => {
  if (!t) return '–'; const s = (Date.now() - t) / 1000;
  if (s < 120) return 'nå'; if (s < 3600) return `${Math.round(s / 60)} min siden`; if (s < 86400) return `${Math.round(s / 3600)} t siden`; if (s < 7 * 86400) return `${Math.round(s / 86400)} d siden`; return dato(t);
};
const timer = (m) => (m >= 60 ? `${Math.floor(m / 60)} t ${m % 60} min` : `${m} min`);
const ROLLE = { skogeier: 'Skogeier', bonde: 'Bonde', radgiver: 'Rådgiver', entreprenor: 'Entreprenør', annet: 'Annet' };
const mb = (b) => `${(Number(b || 0) / 1048576).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} MB`;
const FANER = { planer: 'Planer', kommune: 'Kommune', oversikt: 'Oversikt', bestand: 'Bestand', tiltak: 'Tiltak', framskriving: 'Prognose', felt: 'Felt', veier: 'Veier', verdi: 'Verdi', rapporter: 'Rapporter', skogbrand: 'Skogbrand', skifteplan: 'Skifteplan', ksl: 'KSL', karbon: 'Karbon', pefc: 'PEFC', data: 'Data', ai: 'Spør AI' };
const hode = () => (gyldigToken() ? { Authorization: `Bearer ${gyldigToken()}` } : {});

async function hent() {
  const r = await fetch(`${API}/api/admin/oversikt?dager=${$('#dager').value}`, { headers: hode(), credentials: 'same-origin', cache: 'no-store' });
  if (r.status === 401) { location.replace('logginn.html?neste=admin.html'); return null; }
  if (r.status === 403) { $('#innhold').innerHTML = '<div class="kort feil">Siden er bare for administrator.</div>'; return null; }
  if (!r.ok) throw new Error(`Serveren svarte ${r.status}`);
  return r.json();
}

// Aktive brukere per dag (søyler) med minutter som linje.
function graf(dager) {
  const w = 900; const h = 180; const p = { l: 30, r: 10, t: 12, b: 26 };
  const maks = Math.max(1, ...dager.map((d) => d.aktive)); const maksM = Math.max(1, ...dager.map((d) => d.minutter));
  const bw = (w - p.l - p.r) / dager.length; const y = (v) => p.t + (h - p.t - p.b) * (1 - v / maks);
  let s = `<svg class="graf" viewBox="0 0 ${w} ${h}" role="img" aria-label="Aktive brukere per dag">`;
  for (const v of [0, Math.ceil(maks / 2), maks]) s += `<line x1="${p.l}" x2="${w - p.r}" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" opacity=".12"/><text x="${p.l - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
  dager.forEach((d, i) => {
    const x = p.l + i * bw; s += `<rect x="${x + 1}" y="${y(d.aktive)}" width="${Math.max(1, bw - 2)}" height="${h - p.b - y(d.aktive)}" fill="var(--accent)" rx="2"><title>${d.dag}: ${d.aktive} aktive brukere · ${d.sider} sider · ${timer(d.minutter)} aktiv tid</title></rect>`;
    if (dager.length <= 31 ? i % Math.ceil(dager.length / 10) === 0 : d.dag.endsWith('-01')) s += `<text x="${x + bw / 2}" y="${h - 8}" text-anchor="middle">${d.dag.slice(5).replace('-', '.')}</text>`;
  });
  const pts = dager.map((d, i) => `${p.l + i * bw + bw / 2},${p.t + (h - p.t - p.b) * (1 - d.minutter / maksM)}`).join(' ');
  s += `<polyline points="${pts}" fill="none" stroke="#c98500" stroke-width="2" opacity=".85"/></svg>`;
  return `${s}<p class="hint"><span style="color:var(--accent)">■</span> aktive brukere per dag · <span style="color:#c98500">—</span> aktiv tid (maks ${timer(maksM)} på én dag)</p>`;
}

function vis(d) {
  const sum = (f) => d.dager.reduce((s, x) => s + x[f], 0);
  const faner = Object.entries(d.faner).sort((a, b) => b[1] - a[1]); const fMaks = Math.max(1, ...faner.map((f) => f[1]));
  $('#innhold').innerHTML = `
    ${d.permanent ? '' : '<div class="varsel">⚠ Brukerne lagres ikke permanent på serveren (BRUKER_FIL er ikke satt). Registreringer og statistikk forsvinner ved neste utrulling. Koble et Railway-volum til /data og sett BRUKER_FIL=/data/brukere.json.</div>'}
    <div class="kort"><div class="tall">
      <div><b>${tall(d.totalt)}</b><span>registrerte brukere</span></div>
      <div><b>${tall(d.aktiveIdag)}</b><span>aktive i dag</span></div>
      <div><b>${tall(d.aktive7)}</b><span>aktive siste 7 dager</span></div>
      <div><b>${tall(d.aktive30)}</b><span>aktive siste 30 dager</span></div>
      <div><b>${tall(sum('sider'))}</b><span>sidevisninger i perioden</span></div>
      <div><b>${timer(sum('minutter'))}</b><span>aktiv tid i perioden</span></div>
    </div></div>
    <div class="kort"><h2>Bruk per dag</h2>${graf(d.dager)}</div>
    <div class="kort"><h2>Mest brukte moduler</h2>${faner.length ? `<div class="moduler">${faner.slice(0, 16).map(([f, n]) => `<div><span>${esc(FANER[f] || f)}</span><i style="width:${Math.max(2, (n / fMaks) * 100)}%"></i><span class="hint">${tall(n)}</span></div>`).join('')}</div>` : '<p class="hint">Ingen modulbruk registrert i perioden.</p>'}</div>
    <div class="kort"><h2>Brukere (${d.brukere.length})</h2><div class="tabell"><table>
      <thead><tr><th>Bruker</th><th>Registrert</th><th>Sist aktiv</th><th class="t">Innlogginger</th><th class="t">Aktive dager</th><th class="t">Aktiv tid</th><th class="t">Sider</th><th class="t">Planer i skyen</th><th>Mest brukt</th><th></th></tr></thead>
      <tbody>${d.brukere.map((b) => { const mest = Object.entries(b.faner || {}).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([f]) => FANER[f] || f).join(', '); return `<tr>
        <td class="navn"><b>${esc(b.navn)}</b> ${b.admin ? '<span class="pille admin">admin</span>' : ''}${b.sperret ? ' <span class="pille sperret">sperret</span>' : ''}${b.glemt ? ` <span class="pille glemt" title="Ba om nytt passord ${dato(b.glemt)}">🔑 ber om nytt passord</span>` : ''}<br><span class="hint">${esc(b.bruker)}${b.epost && b.epost !== b.bruker ? ` · <a href="mailto:${esc(b.epost)}">${esc(b.epost)}</a>` : ''}</span>${b.profil ? `<br><span class="hint">${[b.profil.rolle && ROLLE[b.profil.rolle], b.profil.foretak, b.profil.kommune, b.profil.telefon && `<a href="tel:${esc(b.profil.telefon.replace(/\s/g, ''))}">${esc(b.profil.telefon)}</a>`].filter(Boolean).map((x) => (x.startsWith('<a') ? x : esc(x))).join(' · ')}</span>` : ''}</td>
        <td>${dato(b.opprettet)}</td><td>${tid(b.sistAktiv)}</td><td class="t">${tall(b.innlogginger)}</td><td class="t">${tall(b.aktiveDager)}</td><td class="t">${timer(b.minutter)}</td><td class="t">${tall(b.sider)}</td><td class="t">${b.sky ? `${tall(b.sky.antall)}<br><span class="hint">${mb(b.sky.bytes)}</span>` : '–'}</td><td class="hint">${esc(mest) || '–'}</td>
        <td><select data-bruker="${esc(b.bruker)}" aria-label="Handling for ${esc(b.bruker)}"><option value="">Handling …</option><option value="lenke">${b.glemt ? '🔑 ' : ''}Lag lenke for nytt passord</option>${b.sperret ? '<option value="aapne">Åpne</option>' : '<option value="sperr">Sperr</option>'}${b.rolle === 'admin' ? '<option value="fjern-admin">Fjern admin</option>' : '<option value="admin">Gjør til admin</option>'}<option value="slett">Slett bruker</option></select></td></tr>`; }).join('')}</tbody></table></div>
      <p class="hint">Bruken telles per bruker og dag: sidevisninger, aktiv tid (minutter med klikk eller tastetrykk) og hvilke moduler som åpnes. Planene til brukerne lagres i skyen per bruker (antall og plass vises over), men innholdet vises ikke her. Sletter du en bruker, slettes også planene i skyen.</p></div>`;
}

async function last() { try { const d = await hent(); if (d) vis(d); } catch (e) { $('#innhold').innerHTML = `<div class="kort feil">${esc(e.message)}</div>`; } }
$('#dager').addEventListener('change', last);
document.addEventListener('change', async (e) => {
  const s = e.target.closest('[data-bruker]'); if (!s || !s.value) return;
  if (s.value === 'lenke') { s.value = ''; return lagLenke(s.dataset.bruker); }
  const tekst = { sperr: 'Sperre', aapne: 'Åpne', admin: 'Gjøre til administrator', 'fjern-admin': 'Fjerne admin for', slett: 'Slette' }[s.value];
  if (!confirm(`${tekst} ${s.dataset.bruker}?${s.value === 'slett' ? ' Brukeren og bruksstatistikken slettes.' : ''}`)) { s.value = ''; return; }
  const r = await fetch(`${API}/api/admin/bruker`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...hode() }, credentials: 'same-origin', body: JSON.stringify({ bruker: s.dataset.bruker, handling: s.value }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) alert(j.feil || 'Klarte ikke å endre brukeren');
  last();
});
// Lenke for nytt passord (gyldig 24 timer): kopier eller send på e-post til brukeren.
async function lagLenke(bruker) {
  const r = await fetch(`${API}/api/admin/bruker`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...hode() }, credentials: 'same-origin', body: JSON.stringify({ bruker, handling: 'lenke' }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) { alert(j.feil || 'Klarte ikke å lage lenke'); return; }
  const emne = 'Nytt passord til SkogIQ.ai';
  const tekst = `Hei ${j.navn || ''}!\n\nHer er lenken for å velge nytt passord til SkogIQ.ai. Den gjelder i 24 timer:\n\n${j.lenke}\n\nHilsen Trond`;
  const d = document.createElement('dialog'); d.className = 'lenkedialog';
  d.innerHTML = `<b>Lenke for nytt passord</b><p class="hint">Gjelder i 24 timer for ${esc(j.navn)} (${esc(bruker)}). Send den til brukeren – den som har lenken, kan velge nytt passord.</p>
    <input readonly value="${esc(j.lenke)}" aria-label="Lenke">
    <div class="knapper"><button type="button" data-kopier>Kopier lenken</button>${j.epost ? `<a class="knapp" href="mailto:${encodeURIComponent(j.epost)}?subject=${encodeURIComponent(emne)}&body=${encodeURIComponent(tekst)}">Send e-post til ${esc(j.epost)}</a>` : ''}<button type="button" data-lukk>Lukk</button></div>`;
  document.body.appendChild(d); d.showModal(); d.querySelector('input').select();
  d.addEventListener('click', async (e) => {
    if (e.target.closest('[data-kopier]')) { try { await navigator.clipboard.writeText(j.lenke); e.target.textContent = 'Kopiert ✓'; } catch { d.querySelector('input').select(); document.execCommand?.('copy'); e.target.textContent = 'Kopiert ✓'; } }
    if (e.target.closest('[data-lukk]')) { d.close(); d.remove(); last(); }
  });
}
last();
setInterval(last, 60000);
