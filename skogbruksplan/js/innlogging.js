// Innlogging i appen (se auth.js på serveren). Lastes først av fullversjonen, SkogIQ Felt og kontroller-siden.
//   * På Railway holder informasjonskapselen økten; serveren sender uinnloggede til logginn.html.
//   * På GitHub Pages (annen adresse) lagres økten som token i nettleseren og sendes som Authorization-hode på alle
//     kall til SkogIQ-serveren. Uten gyldig økt sendes brukeren til logginn.html.
//   * Uten nett slipper en enhet som har vært innlogget før inn (planene ligger lokalt); serverkall krever ny innlogging.
export const RAILWAY = 'https://skogiq-production.up.railway.app';
export const LS_OKT = 'skogiq-okt';
const LS_SETT = 'skogiq-innlogget-for';
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* privat modus */ } }, del: (k) => { try { localStorage.removeItem(k); } catch { /* ignorer */ } } };
const erPages = typeof location !== 'undefined' && /github\.io$/.test(location.hostname);
const API = erPages ? RAILWAY : '';

// Tokenet er «data.signatur»; data er base64url-JSON med utløpstid (exp, ms). Signaturen sjekkes på serveren.
export function tokenUtloper(t) { try { return JSON.parse(atob(String(t).split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))).exp || 0; } catch { return 0; } }
export function gyldigToken() { const t = ls.get(LS_OKT); return t && tokenUtloper(t) > Date.now() ? t : null; }
const vaartApi = (url) => { const u = String(url || ''); return u.startsWith(`${RAILWAY}/api/`) || (!/^[a-z]+:/i.test(u) && /^\/?api\//.test(u)) || (typeof location !== 'undefined' && u.startsWith(`${location.origin}/api/`)); };
export const innloggingUrl = () => `logginn.html?neste=${encodeURIComponent((location.pathname.replace(/^.*\//, '') || './') + location.search + location.hash)}`;
function tilInnlogging() { if (!/logginn\.html$/.test(location.pathname)) location.replace(innloggingUrl()); }

if (typeof window !== 'undefined' && !window.__skogiqInnlogging && !/logginn\.html$/.test(location.pathname)) {
  window.__skogiqInnlogging = true;
  const opprinnelig = window.fetch.bind(window);
  // Økten følger med alle kall til SkogIQ-serveren. 401 fra serveren = økten er utløpt → logg inn på nytt.
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (!vaartApi(url) || /\/api\/(logginn|meg)$/.test(url)) return opprinnelig(input, init);
    const t = gyldigToken(); let o = init;
    if (t) { const h = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined)); if (!h.has('Authorization')) h.set('Authorization', `Bearer ${t}`); o = { ...init, headers: h }; }
    const r = await opprinnelig(input, o);
    if (r.status === 401 && r.headers.get('content-type')?.includes('json')) { const d = await r.clone().json().catch(() => ({})); if (d.innlogging) { ls.del(LS_OKT); tilInnlogging(); } }
    return r;
  };
  // Sjekk økten mot serveren. Uten token skjules siden til svaret er klart.
  const harToken = !!gyldigToken();
  if (erPages && !harToken) document.documentElement.style.visibility = 'hidden';
  (async () => {
    try {
      const t = gyldigToken();
      const r = await opprinnelig(`${API}/api/meg`, { headers: t ? { Authorization: `Bearer ${t}` } : {}, credentials: 'same-origin', cache: 'no-store' });
      if (r.status === 401) { ls.del(LS_OKT); tilInnlogging(); return; }
      const d = await r.json().catch(() => ({})); if (d.bruker) ls.set(LS_SETT, '1');
      if (d.aktiv && d.bruker) { meg = d; visBruker(); startBruk(opprinnelig); window.dispatchEvent(new CustomEvent('skogiq-innlogget', { detail: d })); }
    } catch {
      // Uten nett: slipp inn en enhet som har vært innlogget før.
      if (erPages && !ls.get(LS_SETT)) { tilInnlogging(); return; }
    }
    document.documentElement.style.visibility = '';
  })();
  document.addEventListener('click', (e) => { if (e.target.closest?.('[data-logg-ut]')) { e.preventDefault(); loggUt(); } });
}

// ---------- hvem er innlogget, og bruksstatistikk ----------
let meg = null; let brukFetch = null; let sistAktivitet = 0; let sistSendt = 0;
// Fyller [data-bruker-info] (f.eks. i Om-boksen): «Innlogget som …», Admin-lenke og «Bytt passord».
export function visBruker() {
  if (typeof document === 'undefined' || !meg?.bruker) return;
  for (const el of document.querySelectorAll('[data-profil-knapp]')) { el.hidden = !meg.registrering; el.title = `Min profil – ${String(meg.navn || meg.bruker)}`; const s = el.querySelector('span'); if (s) s.textContent = String(meg.navn || meg.bruker || '?').trim().charAt(0).toUpperCase(); }
  for (const el of document.querySelectorAll('[data-bruker-info]')) el.innerHTML = `Innlogget som <b>${String(meg.navn || meg.bruker).replace(/[<>&"]/g, '')}</b>${meg.admin ? ' · <a href="admin.html">Admin</a>' : ''}${meg.registrering ? ' · <a href="#" data-bytt-passord>👤 Min profil</a>' : ''} · `;
}
export const innloggetBruker = () => meg;
const sendBruk = (type, detalj = '') => { if (!brukFetch || !meg?.bruker) return; brukFetch(`${API}/api/bruk`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(gyldigToken() ? { Authorization: `Bearer ${gyldigToken()}` } : {}) }, credentials: 'same-origin', body: JSON.stringify({ type, detalj }), keepalive: true }).catch(() => {}); };
// Modulbruk (faner i appen). Samme fane flere ganger på rad teller én gang.
let sistFane = '';
export function registrerBruk(type, detalj = '') { if (type === 'fane') { if (detalj === sistFane) return; sistFane = detalj; } sendBruk(type, detalj); }
// Aktiv tid: ett minutt telles når brukeren har gjort noe (klikk, tast, berøring, rulling) siste to minutter og siden er synlig.
function startBruk(f) {
  brukFetch = f; if (typeof document === 'undefined' || window.__skogiqBruk) return; window.__skogiqBruk = true;
  const merk = () => { sistAktivitet = Date.now(); };
  for (const h of ['pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(h, merk, { passive: true });
  merk();
  setInterval(() => { const t = Date.now(); if (document.visibilityState === 'visible' && t - sistAktivitet < 120000 && t - sistSendt >= 59000) { sistSendt = t; sendBruk('aktiv'); } }, 15000);
  document.addEventListener('click', (e) => { if (e.target.closest?.('[data-bytt-passord]')) { e.preventDefault(); minProfil(); } });
}
// Min profil: navn, kontaktinformasjon, rolle og gård/foretak (lagres på serveren, /api/konto/profil), og kontoen:
// e-post (for «glemt passord») og nytt passord, som krever nåværende passord. Viser også bruken av skylagringen.
export const ROLLER = { skogeier: 'Skogeier', bonde: 'Bonde / gårdbruker', radgiver: 'Rådgiver / skogbruksleder', entreprenor: 'Entreprenør', annet: 'Annet' };
const rens = (v) => String(v ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
const autHode = () => (gyldigToken() ? { Authorization: `Bearer ${gyldigToken()}` } : {});
export async function minProfil() {
  const f0 = brukFetch || window.fetch.bind(window);
  let data = {};
  try { const r = await f0(`${API}/api/konto/profil`, { headers: autHode(), credentials: 'same-origin', cache: 'no-store' }); data = r.ok ? await r.json() : {}; } catch { /* uten nett */ }
  const p = data.profil || { navn: meg?.navn, epost: meg?.epost }; const sky = data.sky;
  const d = document.createElement('dialog'); d.className = 'profil-dialog';
  d.style.cssText = 'border:0;border-radius:18px;padding:0;max-width:560px;width:calc(100% - 24px);max-height:calc(100% - 24px);font:15px/1.4 system-ui,sans-serif;color:#10241c;background:#fbfcfa';
  const felt = 'padding:9px;border-radius:8px;border:1px solid #bbb;font:inherit;width:100%;box-sizing:border-box';
  const inp = (navn, etikett, type = 'text', ekstra = '') => `<label style="display:grid;gap:3px;font-size:13px">${etikett}<input type="${type}" name="${navn}" value="${rens(p[navn])}" style="${felt}" ${ekstra}></label>`;
  const mbT = (b) => `${(b / 1048576).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} MB`;
  d.innerHTML = `<form method="dialog" style="display:grid;gap:12px;padding:20px">
    <div style="display:flex;gap:12px;align-items:center"><span style="width:48px;height:48px;border-radius:50%;background:#1f6b4a;color:#fff;display:grid;place-items:center;font-weight:800;font-size:20px;flex:none">${rens(String(p.navn || meg?.bruker || '?').trim().charAt(0).toUpperCase())}</span><div><b style="font-size:18px">Min profil</b><div style="font-size:13px;color:#555">${rens(meg?.bruker)}${meg?.admin ? ' · administrator' : ''}</div></div></div>
    <fieldset style="border:0;padding:0;margin:0;display:grid;gap:8px;grid-template-columns:1fr 1fr">
      <legend style="font-weight:700;margin-bottom:6px">Om deg</legend>
      <div style="grid-column:1/-1">${inp('navn', 'Navn', 'text', 'required autocomplete="name"')}</div>
      ${inp('telefon', 'Telefon', 'tel', 'autocomplete="tel"')}
      <label style="display:grid;gap:3px;font-size:13px">Rolle<select name="rolle" style="${felt}"><option value="">Velg …</option>${Object.entries(ROLLER).map(([k, v]) => `<option value="${k}" ${p.rolle === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      ${inp('foretak', 'Gård / foretak', 'text', 'autocomplete="organization"')}${inp('orgnr', 'Organisasjonsnummer', 'text', 'inputmode="numeric"')}
      <div style="grid-column:1/-1">${inp('adresse', 'Adresse', 'text', 'autocomplete="street-address"')}</div>
      ${inp('postnr', 'Postnummer', 'text', 'inputmode="numeric" maxlength="4" autocomplete="postal-code"')}${inp('poststed', 'Poststed', 'text', 'autocomplete="address-level2"')}
      ${inp('kommune', 'Kommune (forslag når du lager planer)')}${inp('andelslag', 'Skogeierandelslag')}
      <label style="display:grid;gap:3px;font-size:13px;grid-column:1/-1">Om gården og skogen <small style="color:#555">(brukes av «Spør AI» og i rapporter)</small><textarea name="om" rows="3" maxlength="600" style="${felt}">${rens(p.om)}</textarea></label>
    </fieldset>
    ${sky ? `<div style="padding:10px 12px;border-radius:12px;background:#eef3ef;font-size:13px">☁ <b>Skylagring:</b> ${sky.antall} plan${sky.antall === 1 ? '' : 'er'} · ${mbT(sky.bytes)} av ${mbT(sky.kvote)}${sky.papirkurv ? ` · ${sky.papirkurv} i papirkurven` : ''}. Planene dine er lagret på SkogIQ-serveren og er tilgjengelige på alle enhetene du logger inn på.</div>` : ''}
    <details style="border-top:1px solid #ddd;padding-top:10px"><summary style="font-weight:700;cursor:pointer">Konto: e-post og passord</summary>
      <div style="display:grid;gap:8px;margin-top:8px">
      <input type="text" name="u" autocomplete="username" value="${rens(meg?.bruker)}" hidden>
      <label style="display:grid;gap:3px;font-size:13px">E-post <small style="color:#555">(for «Glemt passord»)</small><input type="email" name="e" autocomplete="email" value="${rens(meg?.epost ?? p.epost)}" style="${felt}"></label>
      <label style="display:grid;gap:3px;font-size:13px">Nytt passord <small style="color:#555">(la stå tomt for å beholde)</small><input type="password" name="n" autocomplete="new-password" minlength="8" style="${felt}"></label>
      <label style="display:grid;gap:3px;font-size:13px">Nåværende passord <small style="color:#555">(kreves bare for å endre e-post eller passord)</small><input type="password" name="g" autocomplete="current-password" style="${felt}"></label></div>
    </details>
    <div data-f style="color:#b4302f;min-height:18px;font-size:13px"></div>
    <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap"><button value="ut" formnovalidate data-logg-ut style="padding:9px 14px;border-radius:9px;border:1px solid #bbb;background:#fff">Logg ut</button><span style="display:flex;gap:8px"><button value="avbryt" formnovalidate style="padding:9px 14px;border-radius:9px;border:1px solid #bbb;background:#fff">Avbryt</button><button value="ok" style="padding:9px 14px;border-radius:9px;border:0;background:#1f6b4a;color:#fff;font-weight:700">Lagre</button></span></div></form>`;
  document.body.appendChild(d); d.showModal();
  d.querySelector('form').addEventListener('submit', async (e) => {
    if (e.submitter?.value !== 'ok') { d.close(); d.remove(); return; }
    e.preventDefault(); const f = e.target; const vis = (t) => { d.querySelector('[data-f]').textContent = t; };
    const profil = Object.fromEntries(['navn', 'telefon', 'rolle', 'foretak', 'orgnr', 'adresse', 'postnr', 'poststed', 'kommune', 'andelslag', 'om'].map((k) => [k, f[k].value.trim()]));
    const post = (sti, metode, kropp) => f0(`${API}${sti}`, { method: metode, headers: { 'Content-Type': 'application/json', ...autHode() }, credentials: 'same-origin', body: JSON.stringify(kropp) }).then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }), () => ({ ok: false, j: { feil: 'Ingen kontakt med serveren' } }));
    const pr = await post('/api/konto/profil', 'PUT', { profil });
    if (!pr.ok) { vis(pr.j.feil || 'Klarte ikke å lagre profilen'); return; }
    meg = { ...meg, navn: pr.j.profil?.navn || profil.navn, profil: pr.j.profil };
    const nyEpost = f.e.value.trim(); const endreKonto = f.n.value || nyEpost !== (meg?.epost || '');
    if (endreKonto) {
      if (!f.g.value) { vis('Skriv nåværende passord for å endre e-post eller passord.'); f.querySelector('details').open = true; f.g.focus(); return; }
      const r = await post('/api/passord', 'POST', { gammelt: f.g.value, nytt: f.n.value || undefined, epost: nyEpost });
      if (!r.ok) { vis(r.j.feil || 'Klarte ikke å endre kontoen'); return; }
      if (r.j.token) ls.set(LS_OKT, r.j.token); meg = { ...meg, epost: r.j.epost ?? nyEpost };
      if (f.n.value) try { if (window.PasswordCredential) await navigator.credentials.store(new PasswordCredential({ id: meg.bruker, password: f.n.value })); } catch { /* ikke støttet */ }
    }
    visBruker(); window.dispatchEvent(new CustomEvent('skogiq-profil', { detail: meg }));
    d.close(); d.remove(); alert(f.n.value ? 'Profilen er lagret, og passordet er byttet.' : 'Profilen er lagret.');
  });
}

export async function loggUt() {
  try { await window.fetch(`${API}/api/loggut`, { method: 'POST', credentials: 'same-origin' }); } catch { /* uten nett */ }
  ls.del(LS_OKT); ls.del(LS_SETT); location.replace('logginn.html');
}
