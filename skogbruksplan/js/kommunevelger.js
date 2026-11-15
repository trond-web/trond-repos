// Kommunevelger: velg én eller flere kommuner (søk, «hele fylket», brikker som kan fjernes). Brukes for hvor innkjøpere
// og entreprenører opererer, og hvor skogeiere har skog (Min profil, dialogen ved innlogging og Nettverk).
// Kommunelisten hentes fra Kartverket (kommuneinfo, åpen) og huskes i nettleseren i 30 dager. Ingen andre importer.
const KV = 'https://ws.geonorge.no/kommuneinfo/v1';
const LS = 'skogiq-kommuneliste';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

// Rens en liste med kommuner til [{ nr: '3412', navn: 'Løten' }], unike på nummer (brukes også på serveren).
export function rensKommuner(liste, maks = 400) {
  const ut = []; const sett = new Set();
  for (const k of Array.isArray(liste) ? liste : []) {
    const nr = String(k?.nr ?? '').trim(); const navn = String(k?.navn ?? '').trim().slice(0, 60);
    if (!/^\d{4}$/.test(nr) || !navn || sett.has(nr)) continue; sett.add(nr); ut.push({ nr, navn });
    if (ut.length >= maks) break;
  }
  return ut.sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));
}
export const kommuneTekst = (liste, maks = 3) => { const l = (liste || []).map((k) => k.navn); return l.length <= maks ? l.join(', ') : `${l.slice(0, maks).join(', ')} og ${l.length - maks} til`; };

let lasting = null; let lastet = false;
// { kommuner: [{ nr, navn, fylke }], fylker: [{ nr, navn }] }
export function hentKommuneliste({ hent = (u) => fetch(u) } = {}) {
  if (lasting) return lasting;
  lasting = (async () => {
    try { const c = JSON.parse(localStorage.getItem(LS) || 'null'); if (c && Date.now() - c.tid < 30 * 864e5 && c.kommuner?.length > 300) { lastet = true; return c; } } catch { /* ingen lagring */ }
    const [k, f] = await Promise.all([hent(`${KV}/kommuner`).then((r) => r.json()), hent(`${KV}/fylker`).then((r) => r.json())]);
    const d = { tid: Date.now(), kommuner: k.map((x) => ({ nr: x.kommunenummer, navn: x.kommunenavnNorsk || x.kommunenavn, fylke: String(x.kommunenummer).slice(0, 2) })).sort((a, b) => a.navn.localeCompare(b.navn, 'nb')), fylker: f.map((x) => ({ nr: x.fylkesnummer, navn: x.fylkesnavn })).sort((a, b) => a.navn.localeCompare(b.navn, 'nb')) };
    try { localStorage.setItem(LS, JSON.stringify(d)); } catch { /* privat modus */ }
    lastet = true; return d;
  })().catch((e) => { lasting = null; throw e; });
  return lasting;
}

// Søk: navn som begynner med teksten først, så navn som inneholder den, så nummer.
export function sokKommuner(alle, tekst, valgt = [], maks = 8) {
  const t = norm(tekst); if (!t) return [];
  const v = new Set(valgt.map((k) => k.nr));
  const treff = alle.filter((k) => !v.has(k.nr) && (norm(k.navn).includes(t) || k.nr.startsWith(t)));
  return treff.sort((a, b) => Number(!norm(a.navn).startsWith(t)) - Number(!norm(b.navn).startsWith(t)) || a.navn.localeCompare(b.navn, 'nb')).slice(0, maks);
}

const CSS = `
.kv { display: grid; gap: 8px; font-size: 14px; }
.kv-rad { display: flex; gap: 6px; flex-wrap: wrap; }
.kv-sok { position: relative; flex: 1 1 200px; } .kv-sok input { width: 100%; box-sizing: border-box; padding: 9px 10px; border-radius: 9px; border: 1px solid #bbb; font: inherit; }
.kv-forslag { position: absolute; left: 0; right: 0; top: 100%; z-index: 30; background: #fff; border: 1px solid #ccd5cf; border-radius: 10px; margin-top: 3px; box-shadow: 0 8px 24px rgba(0,0,0,.14); max-height: 260px; overflow: auto; }
.kv-forslag button { display: flex; justify-content: space-between; width: 100%; border: 0; background: none; padding: 8px 10px; font: inherit; text-align: left; cursor: pointer; color: #10241c; }
.kv-forslag button:hover, .kv-forslag button.aktiv { background: #e6f0ea; } .kv-forslag small { color: #6b7b72; }
.kv select { padding: 8px; border-radius: 9px; border: 1px solid #bbb; font: inherit; background: #fff; color: #10241c; }
.kv-valgt { display: flex; gap: 6px; flex-wrap: wrap; min-height: 30px; align-items: center; }
.kv-brikke { display: inline-flex; gap: 4px; align-items: center; background: #e6f0ea; color: #1f6b4a; border-radius: 99px; padding: 4px 6px 4px 11px; font-weight: 600; font-size: 13px; }
.kv-brikke button { border: 0; background: rgba(31,107,74,.15); color: #1f6b4a; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; font-size: 13px; line-height: 1; }
.kv-tom { color: #6b7b72; font-size: 13px; } .kv-lenke { border: 0; background: none; color: #1f6b4a; text-decoration: underline; cursor: pointer; font: inherit; font-size: 13px; padding: 0; }
@media (prefers-color-scheme: dark) { .kv-forslag, .kv select, .kv-sok input { background: #0e1a15; color: #e6efe9; border-color: #2a3d34; } .kv-forslag button { color: #e6efe9; } .kv-forslag button:hover, .kv-forslag button.aktiv, .kv-brikke { background: #1f3a2c; color: #8fd1ad; } .kv-brikke button { color: #8fd1ad; } }
`;
function sikreCss() { if (typeof document === 'undefined' || document.getElementById('kv-stil')) return; const s = document.createElement('style'); s.id = 'kv-stil'; s.textContent = CSS; document.head.appendChild(s); }

// Lag en velger i elementet. valgt = [{ nr, navn }]. vedEndring(liste) kalles ved hver endring. Gir { verdi(), sett(liste) }.
export function lagKommunevelger(el, { valgt = [], vedEndring = () => {}, plassholder = 'Søk etter kommune …' } = {}) {
  sikreCss();
  let liste = rensKommuner(valgt); let alle = null; let fylker = []; let markert = 0; let forslag = [];
  el.classList.add('kv');
  el.innerHTML = `<div class="kv-rad"><div class="kv-sok"><input type="search" data-kv-sok placeholder="${esc(plassholder)}" autocomplete="off" aria-label="Søk etter kommune"><div class="kv-forslag" data-kv-forslag hidden role="listbox"></div></div>
    <select data-kv-fylke aria-label="Legg til alle kommunene i et fylke"><option value="">+ Hele fylket …</option></select></div>
    <div class="kv-valgt" data-kv-valgt></div><div data-kv-melding class="kv-tom" hidden></div>`;
  const $ = (s) => el.querySelector(s);
  const tegnValgt = () => {
    $('[data-kv-valgt]').innerHTML = liste.length ? `${liste.map((k) => `<span class="kv-brikke">${esc(k.navn)}<button type="button" data-kv-fjern="${k.nr}" aria-label="Fjern ${esc(k.navn)}">×</button></span>`).join('')}${liste.length > 1 ? ' <button type="button" class="kv-lenke" data-kv-tom>Fjern alle</button>' : ''}` : '<span class="kv-tom">Ingen kommuner valgt ennå.</span>';
  };
  const endre = (ny) => { liste = rensKommuner(ny); tegnValgt(); vedEndring(liste); };
  const tegnForslag = () => {
    const f = $('[data-kv-forslag]'); f.hidden = !forslag.length;
    f.innerHTML = forslag.map((k, i) => `<button type="button" role="option" data-kv-legg="${k.nr}" class="${i === markert ? 'aktiv' : ''}"><span>${esc(k.navn)}</span><small>${esc(fylker.find((x) => x.nr === k.fylke)?.navn || '')} · ${k.nr}</small></button>`).join('');
  };
  const legg = (nr) => { const k = alle?.find((x) => x.nr === nr); if (k) endre([...liste, k]); const s = $('[data-kv-sok]'); s.value = ''; forslag = []; tegnForslag(); s.focus(); };
  tegnValgt();
  const sokFelt = $('[data-kv-sok]'); if (!lastet) sokFelt.placeholder = 'Henter kommuner …';
  hentKommuneliste().then((d) => {
    alle = d.kommuner; fylker = d.fylker; sokFelt.placeholder = plassholder;
    // Skrev brukeren før listen var hentet, søkes det nå.
    if (sokFelt.value.trim()) { forslag = sokKommuner(alle, sokFelt.value, liste); markert = 0; tegnForslag(); }
    $('[data-kv-fylke]').insertAdjacentHTML('beforeend', fylker.map((f) => `<option value="${f.nr}">${esc(f.navn)} (${alle.filter((k) => k.fylke === f.nr).length})</option>`).join(''));
  }).catch(() => { const m = $('[data-kv-melding]'); m.hidden = false; m.textContent = 'Fikk ikke hentet kommunelisten fra Kartverket. Sjekk nettet og prøv igjen.'; });
  el.addEventListener('input', (e) => { if (!e.target.matches('[data-kv-sok]') || !alle) return; forslag = sokKommuner(alle, e.target.value, liste); markert = 0; tegnForslag(); });
  el.addEventListener('keydown', (e) => {
    if (!e.target.matches('[data-kv-sok]')) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (forslag.length) { markert = (markert + (e.key === 'ArrowDown' ? 1 : -1) + forslag.length) % forslag.length; tegnForslag(); } }
    if (e.key === 'Enter') { e.preventDefault(); if (forslag[markert]) legg(forslag[markert].nr); }
    if (e.key === 'Escape' && forslag.length) { e.stopPropagation(); forslag = []; tegnForslag(); }
  });
  el.addEventListener('click', (e) => {
    const l = e.target.closest('[data-kv-legg]'); if (l) { legg(l.dataset.kvLegg); return; }
    const f = e.target.closest('[data-kv-fjern]'); if (f) { endre(liste.filter((k) => k.nr !== f.dataset.kvFjern)); return; }
    if (e.target.closest('[data-kv-tom]')) endre([]);
  });
  el.addEventListener('change', (e) => { if (!e.target.matches('[data-kv-fylke]') || !e.target.value || !alle) return; endre([...liste, ...alle.filter((k) => k.fylke === e.target.value)]); e.target.value = ''; });
  el.addEventListener('focusout', () => setTimeout(() => { if (!el.contains(document.activeElement)) { forslag = []; tegnForslag(); } }, 150));
  return { verdi: () => liste.slice(), sett: (ny) => { liste = rensKommuner(ny); tegnValgt(); } };
}
