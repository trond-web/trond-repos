// Data › 🗺 ArcGIS: koble til ArcGIS Online eller ArcGIS Enterprise og overføre skogbruksplanen som hosted feature layer
// i brukerens egen organisasjon – med ett trykk eller automatisk når planen endres. Shapefile til ArcGIS Pro som reserve.
// Innloggingen (token) lagres bare på denne enheten (localStorage), aldri i planen eller på SkogIQ-serveren.
import * as A from './arcgis.js';
import { API } from './plan-synk.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get: (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }, set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* privat modus */ } } };
const ss = { get: (k) => { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch { return null; } }, set: (k, v) => { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
const tid = (iso) => (iso ? new Date(iso).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' }) : '');

export function lagArcgisUi({ hentPlan, endret, melding }) {
  const klient = A.lagKlient();
  let k = ls.get(A.LS_NOKKEL); let oppsett = null; let arbeider = ''; let feil = ''; let valg = { type: k?.portal && k.portal !== A.ARCGIS_ONLINE ? 'enterprise' : 'online', portal: k?.portal && k.portal !== A.ARCGIS_ONLINE ? k.portal : '', klientId: '' };
  let autoTimer = null;
  const el = () => document.getElementById('arcgisPanel');
  const tilbake = () => new URL(A.TILBAKEKALL, location.href).href.split('#')[0].split('?')[0];

  async function hentOppsett() {
    if (oppsett) return oppsett;
    try { const r = await fetch(`${API}/api/arcgis/oppsett`, { credentials: 'same-origin', cache: 'no-store' }); oppsett = r.ok ? await r.json() : { klientId: '' }; } catch { oppsett = { klientId: '' }; }
    return oppsett;
  }
  async function gyldig() {
    if (!k) throw new Error('Ikke koblet til ArcGIS.');
    if (Date.now() > k.utloper) { k = await klient.fornyToken(k); ls.set(A.LS_NOKKEL, k); }
    return k;
  }

  // ---------- innlogging
  async function kobleTil() {
    const o = await hentOppsett();
    const portal = valg.type === 'online' ? A.ARCGIS_ONLINE : A.rensPortal(valg.portal);
    const klientId = valg.klientId || (valg.type === 'online' ? o.klientId : '');
    if (valg.type === 'enterprise' && !/^https:\/\//.test(portal)) { melding('Skriv inn adressen til portalen (https://…).'); return; }
    if (!klientId) { feil = valg.type === 'online' ? 'ArcGIS-tilkoblingen er ikke satt opp ennå (klient-ID mangler). Se «Oppsett for administrator».' : 'Skriv inn klient-ID for SkogIQ-appen i portalen deres.'; tegn(); return; }
    const p = await A.lagPkce(); const t = tilbake();
    ss.set('skogiq-arcgis-pkce', { ...p, portal, klientId, tilbake: t });
    const url = A.autoriserUrl({ portal, klientId, tilbake: t, challenge: p.challenge, state: p.state });
    const w = window.open(url, 'skogiq-arcgis', 'width=520,height=720');
    if (!w) { location.href = url; return; } // popup blokkert – full side, svaret tas imot når appen lastes igjen
    arbeider = 'Logg inn i ArcGIS-vinduet …'; feil = ''; tegn();
  }
  async function taImotSvar(svar) {
    const p = ss.get('skogiq-arcgis-pkce'); ss.set('skogiq-arcgis-pkce', null);
    if (!svar || !p) return;
    if (svar.error) { arbeider = ''; feil = svar.error === 'access_denied' ? 'Innloggingen ble avbrutt.' : `ArcGIS: ${svar.error_description || svar.error}`; tegn(); return; }
    if (svar.state !== p.state) { arbeider = ''; feil = 'Ugyldig svar fra ArcGIS (state stemmer ikke). Prøv igjen.'; tegn(); return; }
    try {
      arbeider = 'Fullfører innloggingen …'; tegn();
      k = await klient.byttKode({ portal: p.portal, klientId: p.klientId, tilbake: p.tilbake, kode: svar.code, verifier: p.verifier });
      if (!k.bruker) { const s = await klient.portal(k); k.bruker = s.user?.username; }
      const self = await klient.portal(k).catch(() => null); k.org = self?.name || ''; k.kanPublisere = !!self?.user?.privileges?.some?.((x) => /createUpdateCapableGroup|publishFeatures|createItem/.test(x)) || self?.user?.privileges == null;
      ls.set(A.LS_NOKKEL, k); arbeider = ''; feil = ''; melding(`Koblet til ArcGIS som ${k.bruker}.`); tegn();
    } catch (e) { arbeider = ''; feil = e.message; tegn(); }
  }
  window.addEventListener('message', (e) => { if (e.origin === location.origin && e.data?.arcgis) taImotSvar(e.data.arcgis); });
  // Svar etter full sideomlasting (popup blokkert)
  const lagret = ls.get('skogiq-arcgis-svar'); if (lagret) { ls.set('skogiq-arcgis-svar', null); setTimeout(() => taImotSvar(lagret), 500); }

  // ---------- overføring
  async function overfor({ stille = false } = {}) {
    const S = hentPlan(); if (!S.bestand?.length) { if (!stille) melding('Planen har ingen bestand å overføre.'); return; }
    try {
      arbeider = 'Overfører til ArcGIS …'; feil = ''; tegn();
      const kk = await gyldig(); const auto = S.arcgis?.auto ?? false;
      const r = await A.overfor(S, kk, { klient, framdrift: (t) => { arbeider = t; const a = el()?.querySelector('.ag-arbeider'); if (a) a.textContent = `⏳ ${t}`; } });
      S.arcgis = { ...r, auto }; endret({ kart: false, bare: 'arcgis' });
      const n = Object.values(r.antall).reduce((s, x) => s + x, 0);
      if (!stille) melding(`Planen er overført til ArcGIS (${n} objekter).`, 5000);
    } catch (e) { feil = e.message; if (!stille) melding(e.message, 7000); } finally { arbeider = ''; tegn(); }
  }
  function vedEndring() {
    const S = hentPlan(); if (!k || !S?.arcgis?.auto || !S.arcgis.url) return;
    clearTimeout(autoTimer); autoTimer = setTimeout(() => overfor({ stille: true }), 60e3);
  }
  function lastNedShape() {
    const S = hentPlan(); const zip = A.shapefilZip(S);
    const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' })); const a = document.createElement('a');
    a.href = url; a.download = `${(S.eiendom?.navn || 'skogbruksplan').replace(/[^\wæøåÆØÅ-]+/g, '_')}_arcgis.zip`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
    melding('Shapefil-pakken er lastet ned. Pakk ut og dra lagene inn i ArcGIS Pro.');
  }

  // ---------- panel
  function tegn() {
    const e = el(); if (!e) return; const S = hentPlan(); const a = S?.arcgis;
    const tilkoblet = !!k; const sammePortal = a && k && a.portal === k.portal && a.bruker === k.bruker;
    e.innerHTML = `<h3>🗺 ArcGIS</h3>
      <p class="hint">Overfør skogbruksplanen til ArcGIS Online eller ArcGIS Enterprise. Planen blir et lag i din egen organisasjon – bestand, tiltak, veier, punkter, eiendom, miljø og skader – og kan brukes i ArcGIS Pro, Field Maps og Dashboards. SkogIQ er hovedkilden: laget oppdateres herfra.</p>
      ${!tilkoblet ? `<div class="skjema to-kol">
          <label>Plattform<select data-ag="type"><option value="online" ${valg.type === 'online' ? 'selected' : ''}>ArcGIS Online</option><option value="enterprise" ${valg.type === 'enterprise' ? 'selected' : ''}>ArcGIS Enterprise (egen portal)</option></select></label>
          ${valg.type === 'enterprise' ? `<label>Portal-adresse<input data-ag="portal" value="${esc(valg.portal)}" placeholder="https://gis.eksempel.no/portal"></label><label class="hel">Klient-ID for SkogIQ i portalen<input data-ag="klientId" value="${esc(valg.klientId)}" placeholder="Fra administrator (OAuth-app i portalen)"></label>` : '<span></span>'}
        </div>
        <div class="knapperad"><button type="button" class="knapp primar" data-ag="koble" ${arbeider ? 'disabled' : ''}>Koble til ArcGIS</button></div>`
      : `<p class="ag-status">✓ Koblet til <b data-ikke-oversett>${esc(k.org || (k.portal === A.ARCGIS_ONLINE ? 'ArcGIS Online' : k.portal))}</b> som <b data-ikke-oversett>${esc(k.bruker)}</b> <button type="button" class="knapp liten" data-ag="koble-fra">Koble fra</button></p>
        ${a?.url ? `<div class="ag-lag"><div><b>Laget i ArcGIS</b>${sammePortal ? '' : ' <span class="hint">(laget i en annen ArcGIS-konto – ny overføring lager et nytt lag her)</span>'}<div class="hint"><span>Sist overført ${esc(tid(a.sist))}</span>${a.antall ? Object.entries(a.antall).filter(([, n]) => n).map(([n2, n]) => ` · <span>${n} ${esc(n2.toLowerCase())}</span>`).join('') : ''}</div></div>
          <div class="knapperad"><a class="knapp liten" href="${esc(A.elementUrl(a))}" target="_blank" rel="noopener">Åpne i ArcGIS</a><a class="knapp liten" href="${esc(A.kartUrl(a))}" target="_blank" rel="noopener">Vis i kart</a></div></div>` : ''}
        <div class="knapperad"><button type="button" class="knapp primar" data-ag="overfor" ${arbeider ? 'disabled' : ''}>${a?.url && sammePortal ? 'Oppdater ArcGIS nå' : 'Overfør planen til ArcGIS'}</button>
          ${a?.url && sammePortal ? `<label class="avkrysning"><input type="checkbox" data-ag="auto" ${a.auto ? 'checked' : ''}> Oppdater automatisk når planen endres</label>` : ''}</div>`}
      ${arbeider ? `<p class="hs-arbeider ag-arbeider">⏳ ${esc(arbeider)}</p>` : ''}
      ${feil ? `<p class="sf-varsel">${esc(feil)}</p>` : ''}
      <div class="knapperad"><button type="button" class="knapp liten" data-ag="shape">⬇ Shapefile for ArcGIS Pro (.zip)</button></div>
      <details class="ekstra"><summary>Oppsett for administrator</summary>
        <p class="hint">Tilkoblingen bruker OAuth 2.0 med PKCE – innloggingen skjer hos ArcGIS, og SkogIQ ser aldri passordet. Det trengs en registrert app (klient-ID) i ArcGIS:</p>
        <ol class="hint"><li><b>ArcGIS Online:</b> Innhold › Nytt element › Utviklerlegitimasjon › OAuth 2.0-legitimasjon. Legg inn omdirigerings-adressene under, og sett klient-ID-en som miljøvariabelen <code>ARCGIS_CLIENT_ID</code> på serveren.</li>
          <li><b>ArcGIS Enterprise:</b> portaladministratoren registrerer en app på samme måte i portalen og gir brukerne klient-ID-en.</li></ol>
        <p class="hint">Omdirigerings-adresser (redirect URI):<br><code>https://skogiq-production.up.railway.app/arcgis-callback.html</code><br><code>https://trond-web.github.io/trond-repos/skogbruksplan/arcgis-callback.html</code></p>
        <p class="hint">Brukeren må ha rettighet til å opprette innhold og publisere hosted feature layers. Laget er privat til brukeren deler det.</p></details>`;
  }
  function klikk(e) {
    const b = e.target.closest('[data-ag]'); if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT') return false;
    const h = b.dataset.ag;
    if (h === 'koble') kobleTil();
    if (h === 'koble-fra') { ls.set(A.LS_NOKKEL, null); k = null; melding('Koblet fra ArcGIS på denne enheten. Laget i ArcGIS beholdes.'); tegn(); }
    if (h === 'overfor') overfor();
    if (h === 'shape') lastNedShape();
    return true;
  }
  function endring(e) {
    const t = e.target.closest('[data-ag]'); if (!t) return false; const h = t.dataset.ag;
    if (h === 'type') { valg.type = t.value; tegn(); }
    if (h === 'portal') valg.portal = t.value.trim();
    if (h === 'klientId') valg.klientId = t.value.trim();
    if (h === 'auto') { const S = hentPlan(); if (S.arcgis) { S.arcgis.auto = t.checked; endret({ kart: false, bare: 'arcgis' }); melding(t.checked ? 'ArcGIS oppdateres automatisk ett minutt etter at planen er endret.' : 'Automatisk oppdatering er slått av.'); } }
    return true;
  }
  document.addEventListener('click', (e) => { if (e.target.closest('#arcgisPanel')) klikk(e); });
  document.addEventListener('change', (e) => { if (e.target.closest('#arcgisPanel')) endring(e); });
  return { tegn, vedEndring, lastNedShape, overfor };
}
