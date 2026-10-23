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
    } catch {
      // Uten nett: slipp inn en enhet som har vært innlogget før.
      if (erPages && !ls.get(LS_SETT)) { tilInnlogging(); return; }
    }
    document.documentElement.style.visibility = '';
  })();
  document.addEventListener('click', (e) => { if (e.target.closest?.('[data-logg-ut]')) { e.preventDefault(); loggUt(); } });
}

export async function loggUt() {
  try { await window.fetch(`${API}/api/loggut`, { method: 'POST', credentials: 'same-origin' }); } catch { /* uten nett */ }
  ls.del(LS_OKT); ls.del(LS_SETT); location.replace('logginn.html');
}
