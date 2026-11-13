// Innlogging i appen (se auth.js på serveren). Lastes først av fullversjonen, SkogIQ Felt og kontroller-siden.
//   * På Railway holder informasjonskapselen økten; serveren sender uinnloggede til logginn.html.
//   * På GitHub Pages (annen adresse) lagres økten som token i nettleseren og sendes som Authorization-hode på alle
//     kall til SkogIQ-serveren. Uten gyldig økt sendes brukeren til logginn.html.
//   * Uten nett slipper en enhet som har vært innlogget før inn (planene ligger lokalt); serverkall krever ny innlogging.
import { VILKAR, KORT } from './personvern.js';
import { fyllBilder, lesBilde, lagreBilde } from './profilbilde-ui.js';
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
      if (d.aktiv && d.bruker) { meg = d; visBruker(); startBruk(opprinnelig); window.dispatchEvent(new CustomEvent('skogiq-innlogget', { detail: d })); const spor = () => sporVilkar().then(sporRoller); if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', spor, { once: true }); else spor(); }
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
  for (const el of document.querySelectorAll('[data-profil-knapp]')) { el.hidden = !meg.registrering; el.title = `Min profil – ${String(meg.navn || meg.bruker)}`; const s = el.querySelector('span'); if (s) { const id = meg.profil?.bilde || ''; if (s.dataset.bilde !== id) { s.removeAttribute('style'); s.classList.remove('med-bilde'); delete s.dataset.bildeLastet; } s.textContent = String(meg.navn || meg.bruker || '?').trim().charAt(0).toUpperCase(); if (id) { s.dataset.bilde = id; s.style.cssText = 'display:block;width:100%;height:100%;border-radius:50%'; } else delete s.dataset.bilde; } }
  fyllBilder(document);
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
// Brukerroller (én eller flere, obligatorisk). Samme nøkler som BRUKERROLLER i auth.js.
export const BRUKERROLLER = { skogeier: { navn: 'Skogeier', ikon: '🌲', tekst: 'Eier eller forvalter skog' }, entreprenor: { navn: 'Entreprenør', ikon: '🚜', tekst: 'Hogst, skogkultur, vei' }, innkjoper: { navn: 'Innkjøper', ikon: '🪵', tekst: 'Kjøper tømmer' }, offentlig: { navn: 'Offentlig', ikon: '🏛', tekst: 'Kommune, statsforvalter, etat' } };
// Forslag ut fra den eldre enkeltrollen i profilen.
const FRA_GAMMEL = { skogeier: 'skogeier', bonde: 'skogeier', entreprenor: 'entreprenor' };
const rolleValg = (valgt, navn = 'roller') => `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${Object.entries(BRUKERROLLER).map(([k, r]) => `<label style="display:flex;gap:8px;align-items:flex-start;padding:9px 10px;border:1.5px solid ${valgt.includes(k) ? '#1f6b4a' : '#cfd6d1'};border-radius:12px;cursor:pointer;background:${valgt.includes(k) ? '#e6f0ea' : '#fff'};font-size:14px" data-rolle-kort><input type="checkbox" name="${navn}" value="${k}" ${valgt.includes(k) ? 'checked' : ''} style="width:18px;height:18px;margin-top:2px;accent-color:#1f6b4a;flex:none"><span style="display:grid;gap:1px"><b>${r.ikon} ${r.navn}</b><small style="color:#555;font-size:11.5px">${r.tekst}</small></span></label>`).join('')}</div>`;
const merkKort = (d) => d.addEventListener('change', (e) => { const l = e.target.closest('[data-rolle-kort]'); if (!l) return; const p = e.target.checked; l.style.borderColor = p ? '#1f6b4a' : '#cfd6d1'; l.style.background = p ? '#e6f0ea' : '#fff'; });
// Vilkår og personvern (js/personvern.js): brukere som ikke har godtatt gjeldende versjon (eldre brukere, eller etter en
// vesentlig endring), må godta ved innlogging før de går videre. Dialogen kan ikke lukkes uten å godta eller logge ut.
export function sporVilkar() {
  if (typeof document === 'undefined' || !meg?.bruker || !meg.registrering || !meg.vilkar?.kreves || document.querySelector('.vilkar-dialog')) return Promise.resolve();
  const f0 = brukFetch || window.fetch.bind(window);
  const ny = !!meg.vilkar.godtatt;
  const d = document.createElement('dialog'); d.className = 'vilkar-dialog';
  d.style.cssText = 'border:0;border-radius:18px;padding:0;max-width:480px;width:calc(100% - 24px);font:15px/1.45 system-ui,sans-serif;color:#10241c;background:#fbfcfa;box-shadow:0 20px 60px rgba(0,0,0,.3)';
  d.innerHTML = `<form method="dialog" style="display:grid;gap:12px;padding:20px">
    <div><b style="font-size:19px">${ny ? 'Vi har oppdatert vilkårene' : 'Vilkår og personvern'}</b><p style="margin:4px 0 0;color:#43544b;font-size:14px">${ny ? `Brukervilkårene og personvernerklæringen er endret (versjon ${rens(VILKAR.versjon)}). Les gjennom og godta for å fortsette.` : 'For å bruke SkogIQ.ai må du godta brukervilkårene og personvernerklæringen. Kort fortalt:'}</p></div>
    <ul style="margin:0;padding:0;list-style:none;display:grid;gap:6px;font-size:14px">${KORT.map((t) => `<li style="background:#eef3ef;border-radius:10px;padding:8px 12px"><b style="color:#1f6b4a">✓</b> ${rens(t)}</li>`).join('')}</ul>
    <a href="personvern.html" target="_blank" rel="noopener" style="color:#1f6b4a;font-size:14px;font-weight:600">Les hele erklæringen ↗</a>
    <label style="display:flex;gap:10px;align-items:flex-start;font-size:14px;padding:10px 12px;border:1.5px solid #cfd6d1;border-radius:12px;cursor:pointer"><input type="checkbox" name="godta" style="width:20px;height:20px;flex:none;margin:0;accent-color:#1f6b4a"><span>Jeg har lest og godtar brukervilkårene og personvernerklæringen.</span></label>
    <div data-f style="color:#b4302f;min-height:18px;font-size:13px"></div>
    <div style="display:flex;gap:8px;justify-content:space-between;align-items:center"><button type="button" data-logg-ut style="padding:9px 12px;border-radius:9px;border:0;background:none;color:#555;text-decoration:underline;cursor:pointer">Logg ut</button><button value="ok" style="padding:11px 18px;border-radius:10px;border:0;background:#1f6b4a;color:#fff;font-weight:700;cursor:pointer">Godta og fortsett</button></div></form>`;
  document.body.appendChild(d);
  d.addEventListener('cancel', (e) => e.preventDefault());
  d.showModal();
  return new Promise((ferdig) => {
    d.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault(); const vis = (t) => { d.querySelector('[data-f]').textContent = t; };
      if (!d.querySelector('[name="godta"]').checked) { vis('Kryss av for at du godtar vilkårene.'); return; }
      try {
        const r = await f0(`${API}/api/samtykke`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...autHode() }, credentials: 'same-origin', body: JSON.stringify({ versjon: VILKAR.versjon }) });
        const j = await r.json().catch(() => ({})); if (!r.ok) { vis(j.feil || 'Klarte ikke å lagre'); return; }
        meg = { ...meg, vilkar: j.vilkar }; d.close(); d.remove(); ferdig();
      } catch { vis('Ingen kontakt med serveren. Prøv igjen.'); }
    });
  });
}
// Brukere uten rolle får en enkel dialog ved innlogging: kryss av og lagre (kan ikke lukkes uten å velge).
export async function sporRoller() {
  if (typeof document === 'undefined' || !meg?.bruker || !meg.registrering || (meg.roller || []).length || document.querySelector('.rolle-dialog')) return;
  const f0 = brukFetch || window.fetch.bind(window);
  const forslag = FRA_GAMMEL[meg.profil?.rolle] ? [FRA_GAMMEL[meg.profil.rolle]] : [];
  const d = document.createElement('dialog'); d.className = 'rolle-dialog';
  d.style.cssText = 'border:0;border-radius:18px;padding:0;max-width:460px;width:calc(100% - 24px);font:15px/1.4 system-ui,sans-serif;color:#10241c;background:#fbfcfa;box-shadow:0 20px 60px rgba(0,0,0,.3)';
  d.innerHTML = `<form method="dialog" style="display:grid;gap:12px;padding:20px">
    <div><b style="font-size:19px">Hvilken rolle har du?</b><p style="margin:4px 0 0;color:#43544b;font-size:14px">Hei ${rens(String(meg.navn || '').split(' ')[0] || '')}! Vi har lagt til roller i SkogIQ.ai. Velg én eller flere – det tar bare et øyeblikk, og du kan endre det senere i Min profil.</p></div>
    ${rolleValg(forslag)}
    <div data-f style="color:#b4302f;min-height:18px;font-size:13px"></div>
    <div style="display:flex;gap:8px;justify-content:space-between;align-items:center"><button type="button" data-logg-ut style="padding:9px 12px;border-radius:9px;border:0;background:none;color:#555;text-decoration:underline;cursor:pointer">Logg ut</button><button value="ok" style="padding:11px 18px;border-radius:10px;border:0;background:#1f6b4a;color:#fff;font-weight:700;cursor:pointer">Lagre</button></div></form>`;
  document.body.appendChild(d); merkKort(d);
  d.addEventListener('cancel', (e) => e.preventDefault()); // Esc lukker ikke – rollen er obligatorisk
  d.showModal();
  d.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault(); const roller = [...d.querySelectorAll('input[name="roller"]:checked')].map((x) => x.value);
    const vis = (t) => { d.querySelector('[data-f]').textContent = t; };
    if (!roller.length) { vis('Velg minst én rolle.'); return; }
    try {
      const r = await f0(`${API}/api/konto/profil`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...autHode() }, credentials: 'same-origin', body: JSON.stringify({ profil: { navn: meg.navn || meg.bruker, roller } }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) { vis(j.feil || 'Klarte ikke å lagre'); return; }
      meg = { ...meg, roller: j.profil?.roller || roller, profil: j.profil || meg.profil }; visBruker(); window.dispatchEvent(new CustomEvent('skogiq-profil', { detail: meg }));
      d.close(); d.remove();
    } catch { vis('Ingen kontakt med serveren. Prøv igjen.'); }
  });
}
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
    <div style="display:flex;gap:14px;align-items:center"><span data-pb-avatar ${p.bilde ? `data-bilde="${rens(p.bilde)}"` : ''} style="width:72px;height:72px;border-radius:50%;background:#1f6b4a;color:#fff;display:grid;place-items:center;font-weight:800;font-size:26px;flex:none">${rens(String(p.navn || meg?.bruker || '?').trim().charAt(0).toUpperCase())}</span><div style="display:grid;gap:4px"><b style="font-size:18px">Min profil</b><div style="font-size:13px;color:#555">${rens(meg?.bruker)}${meg?.admin ? ' · administrator' : ''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><label style="padding:6px 10px;border-radius:8px;border:1px solid #bbb;background:#fff;font-size:13px;cursor:pointer">📷 ${p.bilde ? 'Bytt bilde' : 'Last opp bilde'}<input type="file" accept="image/*" data-pb-fil hidden></label><button type="button" data-pb-fjern ${p.bilde ? '' : 'hidden'} style="padding:6px 10px;border-radius:8px;border:1px solid #bbb;background:#fff;font-size:13px;cursor:pointer">Fjern</button></div>
      <small style="color:#555;font-size:11.5px">Vises i Nettverk for dem du samhandler med. Valgfritt.</small></div></div>
    <fieldset style="border:0;padding:0;margin:0;display:grid;gap:8px;grid-template-columns:1fr 1fr">
      <legend style="font-weight:700;margin-bottom:6px">Om deg</legend>
      <div style="grid-column:1/-1">${inp('navn', 'Navn', 'text', 'required autocomplete="name"')}</div>
      ${inp('telefon', 'Telefon', 'tel', 'autocomplete="tel"')}
      <div></div>
      <div style="grid-column:1/-1;display:grid;gap:4px"><span style="font-size:13px">Roller <small style="color:#555">(minst én)</small></span>${rolleValg(p.roller || meg?.roller || [])}</div>
      ${inp('foretak', 'Gård / foretak', 'text', 'autocomplete="organization"')}${inp('orgnr', 'Organisasjonsnummer', 'text', 'inputmode="numeric"')}
      <div style="grid-column:1/-1">${inp('adresse', 'Adresse', 'text', 'autocomplete="street-address"')}</div>
      ${inp('postnr', 'Postnummer', 'text', 'inputmode="numeric" maxlength="4" autocomplete="postal-code"')}${inp('poststed', 'Poststed', 'text', 'autocomplete="address-level2"')}
      ${inp('kommune', 'Kommune (forslag når du lager planer)')}${inp('andelslag', 'Skogeierandelslag')}
      <label style="display:grid;gap:3px;font-size:13px;grid-column:1/-1">Om gården og skogen <small style="color:#555">(brukes av «Spør AI» og i rapporter)</small><textarea name="om" rows="3" maxlength="600" style="${felt}">${rens(p.om)}</textarea></label>
    </fieldset>
    ${sky ? `<div style="padding:10px 12px;border-radius:12px;background:#eef3ef;font-size:13px">☁ <b>Skylagring:</b> ${sky.antall} plan${sky.antall === 1 ? '' : 'er'} · ${mbT(sky.bytes)} av ${mbT(sky.kvote)}${sky.papirkurv ? ` · ${sky.papirkurv} i papirkurven` : ''}. Planene dine er lagret på SkogIQ-serveren og er tilgjengelige på alle enhetene du logger inn på.</div>` : ''}
    <details data-personvern style="border-top:1px solid #ddd;padding-top:10px"><summary style="font-weight:700;cursor:pointer">Personvern og dine data</summary>
      <div style="display:grid;gap:10px;margin-top:8px;font-size:14px">
      <p style="margin:0;color:#43544b">Du godtok vilkårene${meg?.vilkar?.godtatt ? ` (versjon ${rens(meg.vilkar.godtatt)}${meg.vilkar.tid ? `, ${new Date(meg.vilkar.tid).toLocaleDateString('nb-NO')}` : ''})` : ''}. <a href="personvern.html" target="_blank" rel="noopener" style="color:#1f6b4a">Les vilkår og personvernerklæring ↗</a></p>
      <label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer"><input type="checkbox" data-pv-statistikk ${meg?.statistikk === false ? '' : 'checked'} style="width:18px;height:18px;flex:none;margin:1px 0 0;accent-color:#1f6b4a"><span>Tillat bruksstatistikk <small style="color:#555;display:block">Hvilke faner som brukes og aktiv tid, så vi kan forbedre SkogIQ.ai. Slår du det av, slettes statistikken som er samlet inn.</small></span></label>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" data-pv-eksport style="padding:9px 14px;border-radius:9px;border:1px solid #bbb;background:#fff;cursor:pointer">⬇ Last ned mine data</button><button type="button" data-pv-slett style="padding:9px 14px;border-radius:9px;border:1px solid #b4302f;background:#fff;color:#b4302f;cursor:pointer">Slett kontoen min …</button></div>
      <div data-pv-slett-boks hidden style="display:grid;gap:8px;padding:12px;border-radius:12px;background:#fbeaea">
        <b style="color:#b4302f">Slette kontoen for godt?</b><span>Profilen, skylagrede planer, koblinger og chatmeldinger og bruksstatistikken din slettes med en gang og kan ikke gjenopprettes. Planer som ligger lokalt på enhetene dine, blir liggende der. Last ned dataene dine først hvis du vil ta vare på dem.</span>
        <label style="display:grid;gap:3px;font-size:13px">Passordet ditt<input type="password" data-pv-passord autocomplete="current-password" style="${felt}"></label>
        <button type="button" data-pv-slett-bekreft style="padding:9px 14px;border-radius:9px;border:0;background:#b4302f;color:#fff;font-weight:700;cursor:pointer">Slett kontoen min</button></div>
      </div>
    </details>
    <details style="border-top:1px solid #ddd;padding-top:10px"><summary style="font-weight:700;cursor:pointer">Konto: e-post og passord</summary>
      <div style="display:grid;gap:8px;margin-top:8px">
      <input type="text" name="u" autocomplete="username" value="${rens(meg?.bruker)}" hidden>
      <label style="display:grid;gap:3px;font-size:13px">E-post <small style="color:#555">(for «Glemt passord»)</small><input type="email" name="e" autocomplete="email" value="${rens(meg?.epost ?? p.epost)}" style="${felt}"></label>
      <label style="display:grid;gap:3px;font-size:13px">Nytt passord <small style="color:#555">(la stå tomt for å beholde)</small><input type="password" name="n" autocomplete="new-password" minlength="8" style="${felt}"></label>
      <label style="display:grid;gap:3px;font-size:13px">Nåværende passord <small style="color:#555">(kreves bare for å endre e-post eller passord)</small><input type="password" name="g" autocomplete="current-password" style="${felt}"></label></div>
    </details>
    <div data-f style="color:#b4302f;min-height:18px;font-size:13px"></div>
    <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap"><button value="ut" formnovalidate data-logg-ut style="padding:9px 14px;border-radius:9px;border:1px solid #bbb;background:#fff">Logg ut</button><span style="display:flex;gap:8px"><button value="avbryt" formnovalidate style="padding:9px 14px;border-radius:9px;border:1px solid #bbb;background:#fff">Avbryt</button><button value="ok" style="padding:9px 14px;border-radius:9px;border:0;background:#1f6b4a;color:#fff;font-weight:700">Lagre</button></span></div></form>`;
  document.body.appendChild(d); merkKort(d); d.showModal(); fyllBilder(d);
  // Profilbilde: velg, beskjær og last opp med en gang (profilbilde-ui.js), eller fjern.
  const settAvatar = (id) => { const a = d.querySelector('[data-pb-avatar]'); a.removeAttribute('style'); a.classList.remove('med-bilde'); a.style.cssText = 'width:72px;height:72px;border-radius:50%;background:#1f6b4a;color:#fff;display:grid;place-items:center;font-weight:800;font-size:26px;flex:none'; delete a.dataset.bildeLastet; a.textContent = String(p.navn || meg?.bruker || '?').trim().charAt(0).toUpperCase(); if (id) a.dataset.bilde = id; else delete a.dataset.bilde; fyllBilder(d); meg = { ...meg, profil: { ...(meg.profil || {}), bilde: id || undefined } }; d.querySelector('[data-pb-fjern]').hidden = !id; d.querySelector('[data-pb-fil]').closest('label').firstChild.textContent = id ? '📷 Bytt bilde' : '📷 Last opp bilde'; visBruker(); window.dispatchEvent(new CustomEvent('skogiq-profil', { detail: meg })); };
  d.querySelector('[data-pb-fil]').addEventListener('change', async (e) => {
    const f = e.target.files?.[0]; if (!f) return; const vis = (t) => { d.querySelector('[data-f]').textContent = t; }; vis('Laster opp bildet …');
    try { const id = await lagreBilde(await lesBilde(f)); settAvatar(id); vis(''); } catch (x) { vis(x.message || 'Klarte ikke å laste opp bildet'); }
    e.target.value = '';
  });
  d.querySelector('[data-pb-fjern]').addEventListener('click', async () => { try { await lagreBilde(null); settAvatar(null); } catch (x) { d.querySelector('[data-f]').textContent = x.message; } });
  // Personvern: statistikk av/på, last ned mine data og slett kontoen.
  const pvVis = (t) => { d.querySelector('[data-f]').textContent = t; };
  d.querySelector('[data-pv-statistikk]').addEventListener('change', async (e) => {
    const paa = e.target.checked;
    try { const r = await f0(`${API}/api/konto/innstillinger`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...autHode() }, credentials: 'same-origin', body: JSON.stringify({ statistikk: paa }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.feil); meg = { ...meg, statistikk: j.statistikk }; pvVis(''); } catch (x) { e.target.checked = !paa; pvVis(x.message || 'Klarte ikke å lagre innstillingen'); }
  });
  d.querySelector('[data-pv-eksport]').addEventListener('click', async () => {
    try {
      const r = await f0(`${API}/api/konto/eksport`, { headers: autHode(), credentials: 'same-origin', cache: 'no-store' }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).feil);
      const url = URL.createObjectURL(await r.blob()); const a = document.createElement('a'); a.href = url; a.download = `skogiq-mine-data-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (x) { pvVis(x.message || 'Klarte ikke å hente dataene'); }
  });
  d.querySelector('[data-pv-slett]').addEventListener('click', () => { const b = d.querySelector('[data-pv-slett-boks]'); b.hidden = !b.hidden; if (!b.hidden) d.querySelector('[data-pv-passord]').focus(); });
  d.querySelector('[data-pv-slett-bekreft]').addEventListener('click', async () => {
    const p = d.querySelector('[data-pv-passord]').value; if (!p) { pvVis('Skriv passordet ditt for å slette kontoen.'); return; }
    if (!confirm('Siste sjanse: slette kontoen og alle dataene dine i SkogIQ.ai for godt?')) return;
    try {
      const r = await f0(`${API}/api/konto/slett`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...autHode() }, credentials: 'same-origin', body: JSON.stringify({ passord: p }) }); const j = await r.json().catch(() => ({}));
      if (!r.ok) { pvVis(j.feil || 'Klarte ikke å slette kontoen'); return; }
      ls.del(LS_OKT); ls.del(LS_SETT); alert('Kontoen din er slettet. Takk for at du brukte SkogIQ.ai.'); location.replace('logginn.html');
    } catch { pvVis('Ingen kontakt med serveren.'); }
  });
  d.querySelector('form').addEventListener('submit', async (e) => {
    if (e.submitter?.value !== 'ok') { d.close(); d.remove(); return; }
    e.preventDefault(); const f = e.target; const vis = (t) => { d.querySelector('[data-f]').textContent = t; };
    const profil = Object.fromEntries(['navn', 'telefon', 'foretak', 'orgnr', 'adresse', 'postnr', 'poststed', 'kommune', 'andelslag', 'om'].map((k) => [k, f[k].value.trim()]));
    profil.roller = [...f.querySelectorAll('input[name="roller"]:checked')].map((x) => x.value);
    if (!profil.roller.length) { vis('Velg minst én rolle.'); return; }
    const post = (sti, metode, kropp) => f0(`${API}${sti}`, { method: metode, headers: { 'Content-Type': 'application/json', ...autHode() }, credentials: 'same-origin', body: JSON.stringify(kropp) }).then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => ({})) }), () => ({ ok: false, j: { feil: 'Ingen kontakt med serveren' } }));
    const pr = await post('/api/konto/profil', 'PUT', { profil });
    if (!pr.ok) { vis(pr.j.feil || 'Klarte ikke å lagre profilen'); return; }
    meg = { ...meg, navn: pr.j.profil?.navn || profil.navn, profil: pr.j.profil, roller: pr.j.profil?.roller || profil.roller };
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
