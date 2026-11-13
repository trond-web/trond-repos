// Profilbilder i nettleseren (serveren: profilbilde.js). Bildet beskjæres til et kvadrat og skaleres til 320 px
// JPEG før opplasting. Visning: avatar() lager en rund plass med initialer, og fyllBilder() henter bildene med
// innloggingen (bildene krever innlogging, så de hentes med fetch og vises som blob-URL – det virker også på
// GitHub Pages, der vanlige <img>-kall ikke sender med økten). Ingen import av andre moduler (unngår løkker).
const API = typeof location !== 'undefined' && /github\.io$/.test(location.hostname) ? 'https://skogiq-production.up.railway.app' : '';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const initialer = (n) => String(n || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('') || '?';

const cache = new Map(); // id → Promise<blob-URL | null>
export function bildeUrl(id) {
  if (!id) return Promise.resolve(null);
  if (!cache.has(id)) cache.set(id, fetch(`${API}/api/bilde/${encodeURIComponent(id)}`, { credentials: 'same-origin' }).then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? URL.createObjectURL(b) : null)).catch(() => null));
  return cache.get(id);
}
// Rund avatar: initialer, og bildet når det er hentet (fyllBilder).
export function avatar({ navn = '', bilde = null } = {}, klasse = 'nv-avatar') {
  return `<span class="${klasse}"${bilde ? ` data-bilde="${esc(bilde)}"` : ''} aria-hidden="true">${esc(initialer(navn))}</span>`;
}
export function fyllBilder(rot = document) {
  if (!rot?.querySelectorAll) return;
  for (const el of rot.querySelectorAll('[data-bilde]')) {
    if (el.dataset.bildeLastet === el.dataset.bilde) continue; el.dataset.bildeLastet = el.dataset.bilde;
    bildeUrl(el.dataset.bilde).then((u) => { if (!u || el.dataset.bilde !== el.dataset.bildeLastet) return; Object.assign(el.style, { backgroundImage: `url("${u}")`, backgroundSize: 'cover', backgroundPosition: 'center' }); el.textContent = ''; el.classList.add('med-bilde'); });
  }
}
// Les et valgt bilde, beskjær til kvadrat (midten) og skaler. Gir en data-URL (JPEG).
export async function lesBilde(fil, storrelse = 320) {
  if (!fil || !/^image\//.test(fil.type || 'image/')) throw new Error('Velg en bildefil');
  const url = URL.createObjectURL(fil);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const s = Math.min(img.naturalWidth, img.naturalHeight); if (!s) throw new Error('Klarte ikke å lese bildet');
    const c = document.createElement('canvas'); c.width = c.height = storrelse;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, storrelse, storrelse);
    g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, storrelse, storrelse);
    return c.toDataURL('image/jpeg', 0.86);
  } finally { URL.revokeObjectURL(url); }
}
// Last opp (data-URL) eller fjern eget bilde. Gir ny id (eller null).
export async function lagreBilde(dataUrl) {
  const r = await fetch(`${API}/api/konto/bilde`, { method: dataUrl ? 'PUT' : 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: dataUrl ? JSON.stringify({ bilde: dataUrl }) : undefined });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.feil || `Serveren svarte ${r.status}`);
  return j.bilde || null;
}
