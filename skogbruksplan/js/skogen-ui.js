// 🌲 «Skogen siste døgn» for alle innloggede brukere: et lite merke (🌲 12) som viser hvor mange som har vært i
// SkogIQ.ai de siste 24 timene, og hvor mange som er der nå. Trykk viser den lille skogen – uten navn, bare antall
// (/api/skogen, tellingen gjøres på serveren). Fyller alle elementer med [data-skogen]. Brukes i fullversjonen
// (sidemenyen) og i SkogIQ Felt (Mer).
import { API } from './plan-synk.js';
import { skogKort, anonymeBrukere, gjeng } from './admin-skog.js';

let sist = null;
const CSS = `
.skogen-merke { border: 0; background: rgba(255,255,255,.06); color: inherit; border-radius: 10px; padding: 4px 6px; font: 700 12px/1.15 system-ui, sans-serif; cursor: pointer; display: grid; justify-items: center; gap: 1px; }
.skogen-merke:hover { background: rgba(255,255,255,.14); }
.skogen-merke small { font-weight: 600; font-size: 9.5px; opacity: .8; white-space: nowrap; }
.skogen-merke .prikk { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #4fd18b; margin-right: 3px; vertical-align: 1px; animation: skogenPuls 2s ease-in-out infinite; }
@keyframes skogenPuls { 50% { opacity: .35 } } @media (prefers-reduced-motion: reduce) { .skogen-merke .prikk { animation: none } }
.skogen-linje { display: flex; align-items: center; gap: 8px; width: 100%; border: 1px solid rgba(127,140,133,.35); background: transparent; color: inherit; border-radius: 12px; padding: 9px 12px; font: inherit; font-size: 14px; cursor: pointer; text-align: left; }
.skogen-dialog { border: 0; border-radius: 18px; padding: 16px 18px; width: min(760px, calc(100% - 20px)); background: #fbfcfa; color: #10241c; box-shadow: 0 24px 70px rgba(0,0,0,.35); font: 14px/1.45 system-ui, -apple-system, sans-serif; --accent: #1f6b4a; }
.skogen-dialog::backdrop { background: rgba(8,20,14,.45); } .skogen-dialog h2 { margin: 0 34px 8px 0; font-size: 18px; } .skogen-dialog .hint { color: #5d6d64; font-size: 12.5px; }
.skogen-dialog .lukk { position: absolute; top: 10px; right: 10px; border: 0; background: #eef3ef; width: 32px; height: 32px; border-radius: 50%; font-size: 17px; cursor: pointer; }
@media (prefers-color-scheme: dark) { .skogen-dialog { background: #15241d; color: #e6efe9; --accent: #4fae7a; } .skogen-dialog .hint { color: #a9bcb1; } .skogen-dialog .lukk { background: #1b2d25; color: #e6efe9; } }
`;
function sikreCss() { if (document.getElementById('skogen-stil')) return; const s = document.createElement('style'); s.id = 'skogen-stil'; s.textContent = CSS; document.head.appendChild(s); }

export function merkeHtml(s) {
  if (!s) return '🌲';
  return `<span aria-hidden="true">🌲 ${s.siste24}</span><small>${s.naa ? `<span class="prikk"></span>${s.naa} nå` : 'siste døgn'}</small>`;
}
export const merkeTittel = (s) => (s ? `${s.siste24} ${s.siste24 === 1 ? 'skogbruker' : 'skogbrukere'} i SkogIQ.ai siste døgn – ${s.naa} i skogen akkurat nå. ${gjeng(s.siste24).tekst}` : 'Skogen siste døgn');

function tegn() {
  for (const el of document.querySelectorAll('[data-skogen]')) {
    if (el.dataset.skogen === 'linje') el.innerHTML = `<span style="font-size:20px">🌲</span><span><b>${sist ? sist.siste24 : '–'}</b> i skogen siste døgn${sist?.naa ? ` · <b>${sist.naa}</b> akkurat nå` : ''}<br><span style="opacity:.75;font-size:12.5px">${sist ? gjeng(sist.siste24).tekst : ''}</span></span>`;
    else el.innerHTML = merkeHtml(sist);
    el.title = merkeTittel(sist); el.setAttribute('aria-label', merkeTittel(sist)); el.hidden = !sist;
  }
}
export async function oppdaterSkogen() {
  if (typeof document === 'undefined') return null;
  try { const r = await fetch(`${API}/api/skogen`, { credentials: 'same-origin', cache: 'no-store' }); if (r.ok) sist = await r.json(); } catch { /* frakoblet */ }
  sikreCss(); tegn(); return sist;
}
function apne() {
  if (!sist || document.querySelector('.skogen-dialog')) return; sikreCss();
  const d = document.createElement('dialog'); d.className = 'skogen-dialog'; d.setAttribute('aria-label', 'Skogen siste døgn');
  d.innerHTML = `<button type="button" class="lukk" aria-label="Lukk">×</button>${skogKort(anonymeBrukere(sist), { anonym: true })}`;
  document.body.appendChild(d); d.showModal();
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('.lukk')) d.close(); });
  d.addEventListener('close', () => d.remove());
}
let startet = false;
export function startSkogen() {
  if (startet || typeof document === 'undefined') return; startet = true;
  document.addEventListener('click', (e) => { if (e.target.closest('[data-skogen]')) { e.preventDefault(); apne(); } });
  oppdaterSkogen();
  setInterval(() => { if (document.visibilityState === 'visible') oppdaterSkogen(); }, 2 * 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') oppdaterSkogen(); });
}
export const tegnSkogen = () => { sikreCss(); tegn(); };
