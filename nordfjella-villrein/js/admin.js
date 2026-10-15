// Admin: innlogging, endring av valdgrenser (flytt jaktfelt mellom vald, rediger grense) og samjakt.
import { VALD, farge, feltTekst, etikettpunkt } from './jaktfelt.js';
import { status as samjaktStatus, periodeTekst, osloDato } from './samjakt.js';
import { VERSJON } from './versjon.js';

const $ = (s, r = document) => r.querySelector(s);
const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tid = (t) => new Date(t).toLocaleString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
let melderTimer;
function melding(tekst, ms = 4000) {
  const el = $('#melding'); el.textContent = tekst; el.hidden = false;
  clearTimeout(melderTimer); melderTimer = setTimeout(() => { el.hidden = true; }, ms);
}
for (const el of document.querySelectorAll('.versjon')) el.textContent = VERSJON;

async function kall(metode, sti, data) {
  const r = await fetch(`api/${sti}`, {
    method: metode, credentials: 'same-origin', cache: 'no-store',
    headers: { 'X-NFV': '1', ...(data ? { 'Content-Type': 'application/json' } : {}) },
    body: data ? JSON.stringify(data) : undefined,
  });
  const svar = await r.json().catch(() => ({}));
  if (r.status === 401 && sti.startsWith('admin/')) { visLogin(); throw new Error('Du er logget ut. Logg inn igjen.'); }
  if (!r.ok) throw new Error(svar.feil || `Feil fra serveren (${r.status})`);
  return svar;
}

// ---------- Innlogging ----------

function visLogin() {
  $('#a-flate').hidden = true; $('#a-bruker').hidden = true; $('#a-login').hidden = false;
  setTimeout(() => $('#login-skjema').bruker.focus(), 50);
}
$('#login-skjema').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  $('#login-feil').hidden = true;
  try {
    const s = await kall('POST', 'login', { bruker: f.bruker.value, passord: f.passord.value });
    f.passord.value = '';
    start(s.innlogget);
  } catch (err) { $('#login-feil').textContent = err.message; $('#login-feil').hidden = false; }
});
$('#b-loggut').addEventListener('click', async () => { await kall('POST', 'logout').catch(() => {}); location.reload(); });


// ---------- Arbeidsflate ----------

let kart, jaktfelt, lagFor = new Map(), valgt = null, redigerer = null, samjakt = [], samjaktLag;

async function start(bruker) {
  $('#a-login').hidden = true; $('#a-flate').hidden = false;
  $('#a-bruker').textContent = `Innlogget: ${bruker}`; $('#a-bruker').hidden = false;
  if (kart) return;
  kart = L.map('a-kart', { zoomControl: true, maxZoom: 18 });
  L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png', { maxZoom: 18, attribution: '© Kartverket' }).addTo(kart);
  L.tileLayer.wms('https://wms.geonorge.no/skwms1/wms.matrikkelkart', { layers: 'eiendomsgrense', format: 'image/png', transparent: true, minZoom: 14, attribution: 'Eiendom © Kartverket' }).addTo(kart);
  const omraade = await fetch('data/nordfjella.geojson').then((r) => r.json());
  L.geoJSON(omraade, { style: { color: '#b91c1c', weight: 3, fill: false }, interactive: false, pmIgnore: true }).addTo(kart);
  kart.fitBounds(L.geoJSON(omraade).getBounds());
  samjaktLag = L.layerGroup().addTo(kart);
  kart.pm.setLang('no');
  await lastJaktfelt();
  byggSamjaktSkjema();
  await lastSamjakt();
}

new ResizeObserver(() => kart?.invalidateSize()).observe($('#a-kart'));

document.querySelector('.faner').addEventListener('click', (e) => {
  const b = e.target.closest('[data-fane]'); if (!b) return;
  for (const f of document.querySelectorAll('.faner [data-fane]')) { f.setAttribute('aria-selected', String(f === b)); $(`#${f.dataset.fane}`).hidden = f !== b; }
  if (b.dataset.fane === 't-logg') lastLogg();
  if (b.dataset.fane !== 't-samjakt') samjaktLag?.clearLayers();
});

// ---------- Valdgrenser ----------

const stil = (e, aktiv) => ({ color: aktiv ? '#facc15' : farge(e), weight: aktiv ? 5 : 2.4, opacity: 1, fillColor: farge(e), fillOpacity: aktiv ? 0.25 : 0.08, dashArray: e.type === 'jaktfelt' ? null : '8 6' });

async function lastJaktfelt(velgId) {
  if (redigerer) avsluttRedigering();
  jaktfelt = await fetch('api/jaktfelt', { cache: 'no-store' }).then((r) => r.json());
  for (const l of lagFor.values()) l.remove();
  lagFor = new Map();
  for (const f of jaktfelt.features) {
    const e = f.properties;
    const lag = L.geoJSON(f, { style: () => stil(e, false) }).getLayers()[0];
    lag.feature = f;
    lag.bindTooltip(`<b>${h(e.nr || 'Uten jaktfelt')}</b>${e.navn ? `<br>${h(e.navn)}` : ''}${e.vald ? `<br>Vald ${e.vald} ${h(VALD[e.vald]?.navn)}` : ''}`, { sticky: true });
    lag.on('click', () => { if (!redigerer) velg(e.id); });
    lag.addTo(kart);
    lagFor.set(e.id, lag);
  }
  const sortert = [...jaktfelt.features].sort((a, b) => (a.properties.vald || 99) - (b.properties.vald || 99) || String(a.properties.nr || a.properties.id).localeCompare(String(b.properties.nr || b.properties.id)));
  $('#g-velg').innerHTML = '<option value="">Velg jaktfelt …</option>' + Object.entries(VALD).map(([nr, v]) => `<optgroup label="Vald ${nr} ${h(v.navn)}">${sortert.filter((f) => f.properties.vald === Number(nr)).map((f) => `<option value="${h(f.properties.id)}">${h(feltTekst(f.properties))}</option>`).join('')}</optgroup>`).join('')
    + `<optgroup label="Uten vald / tvist">${sortert.filter((f) => !f.properties.vald).map((f) => `<option value="${h(f.properties.id)}">${h(f.properties.nr ? feltTekst(f.properties) : `Uten jaktfelt (${f.properties.id})`)}</option>`).join('')}</optgroup>`;
  const endret = jaktfelt.features.filter((f) => f.properties.endret).sort((a, b) => b.properties.endret.localeCompare(a.properties.endret));
  $('#g-endret').innerHTML = endret.length ? endret.map((f) => `<li><span class="tekst"><b>${h(feltTekst(f.properties) || f.properties.id)}</b><small>${h(tid(f.properties.endret))} av ${h(f.properties.endretAv)}</small></span><button type="button" class="knapp liten-knapp" data-velg="${h(f.properties.id)}">Vis</button></li>`).join('') : '<li class="tom">Ingen endringer – alt er som i valdkartet.</li>';
  if (velgId || valgt) velg(velgId || valgt, false);
}
$('#g-velg').addEventListener('change', (e) => { if (e.target.value) velg(e.target.value); });
$('#g-endret').addEventListener('click', (e) => { const id = e.target.closest('[data-velg]')?.dataset.velg; if (id) velg(id); });

function velg(id, zoom = true) {
  if (redigerer) return;
  if (valgt && lagFor.get(valgt)) lagFor.get(valgt).setStyle(stil(lagFor.get(valgt).feature.properties, false));
  valgt = id;
  const lag = lagFor.get(id); if (!lag) return;
  const e = lag.feature.properties;
  lag.setStyle(stil(e, true)); lag.bringToFront();
  if (zoom) kart.fitBounds(lag.getBounds(), { padding: [30, 30], maxZoom: 14 });
  $('#g-velg').value = id;
  $('#g-valgt').innerHTML = `
    <div class="valgt-kort">
      <h3>${h(e.nr ? feltTekst(e) : 'Område uten jaktfelt')}</h3>
      <p class="liten">${e.daa ? `Ca. ${e.daa.toLocaleString('nb-NO')} daa i valdkartet · ` : ''}${e.endret ? `Endret ${h(tid(e.endret))} av ${h(e.endretAv)}` : 'Som i valdkartet'}</p>
      <label class="felt">Vald
        <select id="g-vald" class="velger">
          <option value="">Uten vald</option>
          ${Object.entries(VALD).map(([nr, v]) => `<option value="${nr}" ${e.vald === Number(nr) ? 'selected' : ''}>Vald ${nr} ${h(v.navn)}</option>`).join('')}
        </select></label>
      <div class="knapperad">
        <button type="button" class="knapp hoved" id="g-rediger">✏️ Rediger grense</button>
        ${e.endret ? '<button type="button" class="knapp fare" id="g-tilbake">Tilbakestill til valdkartet</button>' : ''}
      </div>
    </div>`;
  $('#g-vald').addEventListener('change', async (ev) => {
    const ny = ev.target.value ? Number(ev.target.value) : null;
    const tekst = ny ? `vald ${ny} ${VALD[ny].navn}` : 'uten vald';
    if (!confirm(`Flytte ${e.nr || 'feltet'} til ${tekst}? Endringen vises for alle med en gang.`)) { ev.target.value = e.vald || ''; return; }
    try { await kall('PUT', `admin/jaktfelt/${encodeURIComponent(id)}`, { vald: ny }); melding(`${e.nr || 'Feltet'} er flyttet til ${tekst}.`); await lastJaktfelt(id); } catch (err) { melding(err.message); ev.target.value = e.vald || ''; }
  });
  $('#g-rediger').addEventListener('click', () => startRedigering(id));
  $('#g-tilbake')?.addEventListener('click', async () => {
    if (!confirm(`Tilbakestille ${e.nr || 'feltet'} til grense og vald fra valdkartet?`)) return;
    try { await kall('DELETE', `admin/jaktfelt/${encodeURIComponent(id)}`); melding('Tilbakestilt til valdkartet.'); await lastJaktfelt(id); } catch (err) { melding(err.message); }
  });
}

function startRedigering(id) {
  const lag = lagFor.get(id); const e = lag.feature.properties;
  redigerer = id;
  for (const [x, l] of lagFor) if (x !== id) l.setStyle({ fillOpacity: 0.03, opacity: 0.6 });
  // Bare punktene nærmest musa/fingeren vises (raskt også på store felt). Fester til naboflatene når du drar nær dem.
  lag.pm.enable({ allowSelfIntersection: false, limitMarkersToCount: 300, snappable: true, snapDistance: 18, removeLayerBelowMinVertexCount: false });
  $('#g-valgt').innerHTML = `
    <div class="valgt-kort redigerer">
      <h3>Redigerer ${h(e.nr ? feltTekst(e) : id)}</h3>
      <ul class="punktliste liten">
        <li>Dra et punkt for å flytte grensen. Punktene nærmest pekeren vises.</li>
        <li>Dra et midtpunkt (det svake punktet mellom to hjørner) for å legge til et hjørne.</li>
        <li>Høyreklikk (eller hold inne) på et punkt for å slette det.</li>
        <li>Punktet festes til nabofeltets grense når du drar det nær.</li>
      </ul>
      <div class="knapperad">
        <button type="button" class="knapp hoved" id="g-lagre">Lagre grense</button>
        <button type="button" class="knapp" id="g-avbryt">Avbryt</button>
      </div>
    </div>`;
  $('#g-avbryt').addEventListener('click', () => { avsluttRedigering(); lastJaktfelt(id); });
  $('#g-lagre').addEventListener('click', async () => {
    const geometri = lag.toGeoJSON(6).geometry;
    if (!confirm(`Lagre ny grense for ${e.nr || 'feltet'}? Den vises for alle med en gang.`)) return;
    try {
      await kall('PUT', `admin/jaktfelt/${encodeURIComponent(id)}`, { geometry: geometri, etikett: etikettpunkt(geometri) });
      avsluttRedigering(); melding('Grensen er lagret.'); await lastJaktfelt(id);
    } catch (err) { melding(err.message, 7000); }
  });
}
function avsluttRedigering() {
  const lag = lagFor.get(redigerer);
  lag?.pm.disable();
  redigerer = null;
  for (const l of lagFor.values()) l.setStyle(stil(l.feature.properties, false));
}
addEventListener('beforeunload', (e) => { if (redigerer) { e.preventDefault(); e.returnValue = ''; } });

// ---------- Samjakt ----------

function byggSamjaktSkjema() {
  $('#s-vald').innerHTML = Object.entries(VALD).map(([nr, v]) => `<label><input type="checkbox" name="vald" value="${nr}"><i style="background:${v.farge}"></i>${nr} ${h(v.navn)}</label>`).join('');
  const f = $('#s-skjema'); const idag = osloDato();
  f.fra.value = idag; f.til.value = idag; f.fra.min = idag;
  f.fra.addEventListener('change', () => { if (f.til.value < f.fra.value) f.til.value = f.fra.value; f.til.min = f.fra.value; });
  f.addEventListener('change', () => visSamjaktIKart([...f.querySelectorAll('[name=vald]:checked')].map((x) => Number(x.value))));
}

$('#s-skjema').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const vald = [...f.querySelectorAll('[name=vald]:checked')].map((x) => Number(x.value));
  $('#s-feil').hidden = true;
  try {
    await kall('POST', 'admin/samjakt', { vald, fra: f.fra.value, til: f.til.value, navn: f.navn.value.trim() || null });
    melding(`Samjakt for vald ${vald.join(' + ')} er opprettet.`);
    f.navn.value = ''; for (const x of f.querySelectorAll('[name=vald]')) x.checked = false;
    samjaktLag.clearLayers();
    await lastSamjakt();
  } catch (err) { $('#s-feil').textContent = err.message; $('#s-feil').hidden = false; }
});

async function lastSamjakt() {
  ({ samjakt } = await kall('GET', 'admin/samjakt'));
  const rekkefølge = { aktiv: 0, kommende: 1, avsluttet: 2 };
  samjakt.sort((a, b) => rekkefølge[a.status] - rekkefølge[b.status] || a.fra.localeCompare(b.fra));
  $('#s-liste').innerHTML = samjakt.length ? samjakt.map((s) => `
    <li><span class="tekst"><span class="chip ${s.status}">${{ aktiv: 'Aktiv nå', kommende: 'Kommende', avsluttet: 'Avsluttet' }[s.status]}</span>
      <b>${h(s.navn || `Samjakt ${s.vald.map((v) => VALD[v]?.navn).join(' + ')}`)}</b>
      <small>Vald ${s.vald.map((v) => `${v} ${h(VALD[v]?.navn)}`).join(' + ')} · ${h(periodeTekst(s))} · opprettet av ${h(s.av)}</small></span>
      <button type="button" class="knapp liten-knapp" data-vis="${h(s.id)}">Vis</button>
      ${s.status === 'aktiv' ? `<button type="button" class="knapp liten-knapp" data-avslutt="${h(s.id)}">Avslutt nå</button>` : ''}
      <button type="button" class="knapp liten-knapp fare" data-slett="${h(s.id)}" aria-label="Slett">Slett</button></li>`).join('')
    : '<li class="tom">Ingen samjakter er registrert.</li>';
}
$('#s-liste').addEventListener('click', async (e) => {
  const d = e.target.closest('button')?.dataset; if (!d) return;
  const s = samjakt.find((x) => x.id === (d.vis || d.avslutt || d.slett)); if (!s) return;
  try {
    if (d.vis) { visSamjaktIKart(s.vald, true); return; }
    if (d.avslutt && confirm('Avslutte samjakten nå? Den slås av i appen med en gang.')) { await kall('POST', `admin/samjakt/${s.id}/avslutt`); melding('Samjakten er avsluttet.'); }
    if (d.slett && confirm('Slette samjakten?')) { await kall('DELETE', `admin/samjakt/${s.id}`); melding('Samjakten er slettet.'); samjaktLag.clearLayers(); }
    await lastSamjakt();
  } catch (err) { melding(err.message); }
});

function visSamjaktIKart(vald, zoom = false) {
  samjaktLag.clearLayers();
  const felt = jaktfelt.features.filter((f) => vald.includes(f.properties.vald));
  if (!felt.length) return;
  const lag = L.geoJSON({ type: 'FeatureCollection', features: felt }, { style: { color: '#111', weight: 1, fillColor: '#facc15', fillOpacity: 0.35 }, interactive: false, pmIgnore: true }).addTo(samjaktLag);
  if (zoom) kart.fitBounds(lag.getBounds(), { padding: [20, 20] });
}

// ---------- Logg ----------

async function lastLogg() {
  try {
    const { logg } = await kall('GET', 'admin/logg');
    $('#l-liste').innerHTML = logg.length ? logg.map((l) => `<li><span class="tekst"><time>${h(tid(l.tid))} · ${h(l.av)}</time>${h(l.hva)}</span></li>`).join('') : '<li class="tom">Ingen endringer ennå.</li>';
  } catch (err) { melding(err.message); }
}

// ---------- Konto ----------

$('#p-skjema').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, m = $('#p-melding');
  try { await kall('POST', 'admin/passord', { gammelt: f.gammelt.value, nytt: f.nytt.value }); f.reset(); m.className = 'ok'; m.textContent = 'Passordet er byttet.'; }
  catch (err) { m.className = 'feil'; m.textContent = err.message; }
  m.hidden = false;
});

// Til bruk i tester og feilsøking.
window.nfvAdmin = { get kart() { return kart; }, get lagFor() { return lagFor; } };

// ---------- Oppstart ----------

let status = null;
try { status = await kall('GET', 'status'); } catch { $('#a-utenserver').hidden = false; }
if (status?.innlogget) start(status.innlogget).catch((e) => melding(`Feil ved oppstart: ${e.message}`, 10000));
else if (status) visLogin();
