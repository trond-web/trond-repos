// 🌐 Språk: norsk (standard) eller engelsk. Appen er skrevet på norsk; med engelsk valgt oversettes teksten på skjermen
// fra en ordbok (js/sprak-en.js) mens den vises – også alt som kommer til senere (dialoger, lister, meldinger).
//   * Tall normaliseres: «12 bestand · 34,2 daa» slås opp som «{0} bestand · {1} daa», og tallene settes tilbake.
//   * Finnes ikke hele teksten, prøves delene (skilt med «·», «–», «:», «|») og teksten uten innledende symbol/emoji.
//   * Brukerdata (inndatafelt, tekstområder, [data-ikke-oversett]) røres ikke.
//   * alert/confirm/prompt og dokumenttittelen oversettes også.
// Valget lagres i nettleseren (skogiq-sprak) og gjelder fullversjonen, SkogIQ Felt og de andre sidene.
// Med localStorage «skogiq-sprak-samle» = 1 samles tekster som mangler i ordboken (window.__sprakMangler) – til
// utvidelse av ordboken (verktoy/sprak-samle.mjs). Oversettelsen bruker ingen tredjepart.

export const LS_SPRAK = 'skogiq-sprak';
export const SPRAK = { nb: 'Norsk', en: 'English' };
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* privat modus */ } } };
export const sprak = () => (ls.get(LS_SPRAK) === 'en' ? 'en' : 'nb');
export function settSprak(s) { ls.set(LS_SPRAK, s === 'en' ? 'en' : 'nb'); if (typeof location !== 'undefined') location.reload(); }

// Tall (med mellomrom/hardt mellomrom som tusenskille og komma/punktum som desimaltegn) → {0}, {1} …
const TALL = /\d+(?:[   ]\d{3})*(?:[.,]\d+)?/g;
export function normaliser(tekst) { const tall = []; const k = String(tekst).replace(TALL, (m) => { tall.push(m); return `{${tall.length - 1}}`; }); return { k, tall }; }
const fyll = (mal, tall) => mal.replace(/\{(\d+)\}/g, (m, i) => (tall[Number(i)] ?? m));
const SKILLE = /(\s+[·–|]\s+|:\s+|\s+—\s+|\n)/;
const BOKSTAV = /\p{L}/u;

export function lagOversetter(ordbok = {}, { mangler = null } = {}) {
  const cache = new Map(); const utdata = new Set(); // utdata: allerede oversatt tekst (MutationObserver ser våre egne endringer)
  // Nøkler med * er mønstre der * er et navn e.l. som beholdes: «Åpnet *.» → «Opened *.»
  const monstre = Object.keys(ordbok).filter((k) => k.includes('*')).map((k) => ({ re: new RegExp(`^${k.split('*').map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.+?)')}$`, 's'), en: ordbok[k] }));
  function slaaOpp(t) {
    if (Object.prototype.hasOwnProperty.call(ordbok, t)) return ordbok[t];
    const { k, tall } = normaliser(t);
    if (k !== t && Object.prototype.hasOwnProperty.call(ordbok, k)) return fyll(ordbok[k], tall);
    for (const m of monstre) { const r = t.match(m.re); if (r) { let i = 1; return m.en.replace(/\*/g, () => { const d = r[i++] ?? ''; return BOKSTAV.test(d) ? oversettDel(d) : d; }); } }
    return null;
  }
  function kjerne(t) {
    // Innledende symboler/emoji og avsluttende tegn holdes utenfor oppslaget: «🌲 Skogen siste døgn» → «Skogen siste døgn»
    const m = t.match(/^([^\p{L}\d{]*)(.*?)([\s.:!?…»)]*)$/su); if (!m || !m[2]) return null;
    const hel = slaaOpp(m[2]); if (hel != null) return m[1] + hel + m[3];
    // Ledd delt med «·», «–», «:» osv. Avsluttende tegn tas med i siste ledd, så «Fjøset: for lite plass (… finnes)» beholder parentesen.
    const delt = (m[2] + m[3]).split(SKILLE);
    if (delt.length > 1) {
      let treff = false; const ut = delt.map((d, i) => { if (i % 2 || !BOKSTAV.test(d)) return d; const o = oversettDel(d); if (o !== d) treff = true; return o; });
      if (treff) return m[1] + ut.join('');
    }
    // Flere setninger i én tekst (f.eks. begrunnelser fra tiltaksmotoren): oversett setning for setning.
    const setn = (m[2] + m[3]).split(/(?<=[.!?])\s+(?=[\p{Lu}«(\d])/u);
    if (setn.length > 1) { let treff = false; const ut = setn.map((d) => { const o = slaaOpp(d) ?? kjerne(d); if (o != null && o !== d) { treff = true; return o; } return d; }); if (treff) return m[1] + ut.join(' '); }
    return null;
  }
  function oversettDel(d) { const m = d.match(/^(\s*)(.*?)(\s*)$/s); const o = slaaOpp(m[2]) ?? kjerne(m[2]); return o == null ? d : m[1] + o + m[3]; }
  function oversett(tekst) {
    if (tekst == null) return tekst; const s = String(tekst);
    if (!BOKSTAV.test(s)) return s;
    if (cache.has(s)) return cache.get(s);
    if (utdata.has(s)) return s;
    const m = s.match(/^(\s*)(.*?)(\s*)$/s); const kjernetekst = m[2];
    let o = slaaOpp(kjernetekst) ?? kjerne(kjernetekst);
    if (o == null) { mangler?.add(normaliser(kjernetekst).k); o = kjernetekst; }
    const ut = m[1] + o + m[3]; if (cache.size > 20000) { cache.clear(); utdata.clear(); } cache.set(s, ut); utdata.add(ut); return ut;
  }
  return { oversett, harOrd: (t) => slaaOpp(t) != null };
}

const ATTR = ['title', 'placeholder', 'aria-label', 'alt'];
const HOPP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'NOSCRIPT', 'svg', 'SVG']);
function hopp(el) { for (let e = el; e && e.nodeType === 1; e = e.parentElement) { if (HOPP.has(e.tagName) || e.isContentEditable || e.hasAttribute?.('data-ikke-oversett')) return true; } return false; }

// Oversetter et DOM-tre (tekstnoder, attributter, knappeverdier) og alt som kommer til senere.
export function oversettDom(rot, o) {
  const doc = rot.ownerDocument || rot; const NF = doc.defaultView?.NodeFilter || { SHOW_TEXT: 4 };
  const tekstNode = (n) => { const v = n.nodeValue; if (!v || !BOKSTAV.test(v) || hopp(n.parentElement)) return; const ny = o.oversett(v); if (ny !== v) n.nodeValue = ny; };
  const element = (el) => {
    if (hopp(el)) return;
    for (const a of ATTR) { const v = el.getAttribute?.(a); if (v && BOKSTAV.test(v)) { const ny = o.oversett(v); if (ny !== v) el.setAttribute(a, ny); } }
    if ((el.tagName === 'INPUT' && ['button', 'submit', 'reset'].includes(el.type)) && el.value) { const ny = o.oversett(el.value); if (ny !== el.value) el.value = ny; }
  };
  // Rapporter vises i iframe (srcdoc, samme opprinnelse): oversett dokumentet i rammen når det er lastet.
  const ramme = (f) => { const kjor = () => { try { const d = f.contentDocument; if (d?.body && !d.__oversatt) { d.__oversatt = true; oversettDom(d.body, o); d.title = o.oversett(d.title); } } catch { /* annen opprinnelse */ } }; f.addEventListener('load', () => { try { if (f.contentDocument) f.contentDocument.__oversatt = false; } catch { /* annen opprinnelse */ } kjor(); }); kjor(); };
  const tre = (n) => {
    if (n.nodeType === 1 && n.tagName === 'IFRAME') { ramme(n); return; }
    if (n.nodeType === 1) for (const f of n.querySelectorAll?.('iframe') || []) ramme(f);
    if (n.nodeType === 3) { tekstNode(n); return; }
    if (n.nodeType !== 1 && n.nodeType !== 9 && n.nodeType !== 11) return;
    if (n.nodeType === 1) { if (hopp(n)) return; element(n); for (const e of n.querySelectorAll('[title],[placeholder],[aria-label],[alt],input[type=button],input[type=submit]')) element(e); }
    const w = doc.createTreeWalker(n, NF.SHOW_TEXT); let t; while ((t = w.nextNode())) tekstNode(t);
  };
  tre(rot);
  const View = doc.defaultView; if (!View?.MutationObserver) return null;
  const obs = new View.MutationObserver((liste) => {
    for (const m of liste) {
      if (m.type === 'childList') for (const n of m.addedNodes) tre(n);
      else if (m.type === 'characterData') tekstNode(m.target);
      else if (m.type === 'attributes' && ATTR.includes(m.attributeName)) element(m.target);
    }
  });
  obs.observe(rot.nodeType === 9 ? rot.documentElement : rot, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
  return obs;
}

let aktiv = null;
// Starter oversettingen når engelsk er valgt. Kalles tidlig på hver side (fullversjon, Felt, admin, innlogging …).
export async function startSprak() {
  if (typeof document === 'undefined' || sprak() !== 'en' || aktiv) return aktiv;
  document.documentElement.lang = 'en';
  aktiv = (async () => {
    const { ORD } = await import('./sprak-en.js');
    const mangler = ls.get('skogiq-sprak-samle') === '1' ? (window.__sprakMangler = new Set()) : null;
    const o = lagOversetter(ORD, { mangler });
    window.__oversett = o.oversett;
    // Utskriftsvinduer (window.open + document.write): oversett før vinduet lukkes for skriving og skrives ut.
    const aapne = window.open.bind(window);
    window.open = (...arg) => { const w = aapne(...arg); try { if (w?.document) { const d = w.document; const lukk = d.close.bind(d); d.close = () => { const r = lukk(); try { oversettDom(d.body, o); d.title = o.oversett(d.title); } catch { /* ingen tilgang */ } return r; }; } } catch { /* annen opprinnelse */ } return w; };
    for (const f of ['alert', 'confirm', 'prompt']) { const opp = window[f].bind(window); window[f] = (tekst, ...r) => opp(o.oversett(tekst), ...r); }
    document.title = o.oversett(document.title);
    const tittel = document.querySelector('title'); if (tittel) new MutationObserver(() => { const ny = o.oversett(document.title); if (ny !== document.title) document.title = ny; }).observe(tittel, { childList: true, characterData: true, subtree: true });
    const kjor = () => oversettDom(document.body, o);
    if (document.body) kjor(); else document.addEventListener('DOMContentLoaded', kjor, { once: true });
    return o;
  })();
  return aktiv;
}
// Oversetter en tekst i kode (f.eks. lerret/canvas i VR) – gir teksten uendret på norsk eller før ordboken er lastet.
export const t = (tekst) => (typeof window !== 'undefined' && window.__oversett ? window.__oversett(tekst) : tekst);

// Knapper og valg for språk: [data-sprak-bytt] veksler (teksten viser språket man bytter til), select[data-sprak-velg] velger.
export function kobleSprakKnapper(rot = typeof document !== 'undefined' ? document : null) {
  if (!rot) return;
  const merk = () => {
    for (const k of rot.querySelectorAll('[data-sprak-bytt]')) { k.setAttribute('data-ikke-oversett', ''); k.textContent = sprak() === 'en' ? 'NO' : 'EN'; k.title = sprak() === 'en' ? 'Bytt til norsk' : 'Switch to English'; k.setAttribute('aria-label', k.title); }
    for (const s of rot.querySelectorAll('select[data-sprak-velg]')) { s.setAttribute('data-ikke-oversett', ''); s.innerHTML = Object.entries(SPRAK).map(([k, v]) => `<option value="${k}" ${k === sprak() ? 'selected' : ''}>${v}</option>`).join(''); }
  };
  merk();
  rot.addEventListener('click', (e) => { if (e.target.closest?.('[data-sprak-bytt]')) settSprak(sprak() === 'en' ? 'nb' : 'en'); });
  rot.addEventListener('change', (e) => { if (e.target.matches?.('select[data-sprak-velg]')) settSprak(e.target.value); });
  // Knapper som tegnes senere (f.eks. i et ark i SkogIQ Felt)
  if (typeof MutationObserver !== 'undefined' && rot.body) new MutationObserver(() => { if (rot.querySelector('[data-sprak-bytt]:not([data-ikke-oversett]), select[data-sprak-velg]:not([data-ikke-oversett])')) merk(); }).observe(rot.body, { childList: true, subtree: true });
}
