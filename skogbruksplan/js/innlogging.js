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
  for (const el of document.querySelectorAll('[data-bruker-info]')) el.innerHTML = `Innlogget som <b>${String(meg.navn || meg.bruker).replace(/[<>&"]/g, '')}</b>${meg.admin ? ' · <a href="admin.html">Admin</a>' : ''}${meg.registrering ? ' · <a href="#" data-bytt-passord>Min konto</a>' : ''} · `;
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
  document.addEventListener('click', (e) => { if (e.target.closest?.('[data-bytt-passord]')) { e.preventDefault(); byttPassord(); } });
}
// Min konto: e-post (for «glemt passord») og nytt passord i en liten dialog. Krever nåværende passord.
function byttPassord() {
  const d = document.createElement('dialog'); d.style.cssText = 'border:0;border-radius:16px;padding:20px;max-width:340px;width:calc(100% - 32px);font:15px/1.4 system-ui,sans-serif';
  const felt = 'padding:9px;border-radius:8px;border:1px solid #bbb'; const rens = (v) => String(v || '').replace(/"/g, '');
  d.innerHTML = `<form method="dialog" style="display:grid;gap:10px"><b style="font-size:17px">Min konto</b><span style="font-size:13px;color:#555">${rens(meg?.navn)} · ${rens(meg?.bruker)}</span>
    <input type="text" name="u" autocomplete="username" value="${rens(meg?.bruker)}" hidden>
    <label style="display:grid;gap:4px">E-post <small style="color:#555">(for «Glemt passord»)</small><input type="email" name="e" autocomplete="email" value="${rens(meg?.epost)}" style="${felt}"></label>
    <label style="display:grid;gap:4px">Nytt passord <small style="color:#555">(la stå tomt for å beholde)</small><input type="password" name="n" autocomplete="new-password" minlength="8" style="${felt}"></label>
    <label style="display:grid;gap:4px">Nåværende passord <small style="color:#555">(kreves for å lagre)</small><input type="password" name="g" autocomplete="current-password" required style="${felt}"></label>
    <div data-f style="color:#b4302f;min-height:18px;font-size:13px"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button value="avbryt" formnovalidate style="padding:9px 14px;border-radius:9px;border:1px solid #bbb;background:#fff">Avbryt</button><button value="ok" style="padding:9px 14px;border-radius:9px;border:0;background:#1f6b4a;color:#fff;font-weight:700">Lagre</button></div></form>`;
  document.body.appendChild(d); d.showModal();
  d.querySelector('form').addEventListener('submit', async (e) => {
    if (e.submitter?.value !== 'ok') { d.close(); d.remove(); return; }
    e.preventDefault(); const f = e.target;
    const r = await brukFetch(`${API}/api/passord`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(gyldigToken() ? { Authorization: `Bearer ${gyldigToken()}` } : {}) }, credentials: 'same-origin', body: JSON.stringify({ gammelt: f.g.value, nytt: f.n.value || undefined, epost: f.e.value.trim() }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : { feil: 'Ingen kontakt med serveren' };
    if (!r?.ok) { d.querySelector('[data-f]').textContent = j.feil || 'Klarte ikke å bytte passord'; return; }
    if (j.token) ls.set(LS_OKT, j.token); meg = { ...meg, epost: j.epost ?? f.e.value.trim() };
    if (f.n.value) try { if (window.PasswordCredential) await navigator.credentials.store(new PasswordCredential({ id: meg.bruker, password: f.n.value })); } catch { /* ikke støttet */ }
    d.close(); d.remove(); alert(f.n.value ? 'Kontoen er lagret, og passordet er byttet.' : 'Kontoen er lagret.');
  });
}

export async function loggUt() {
  try { await window.fetch(`${API}/api/loggut`, { method: 'POST', credentials: 'same-origin' }); } catch { /* uten nett */ }
  ls.del(LS_OKT); ls.del(LS_SETT); location.replace('logginn.html');
}
