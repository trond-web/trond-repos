// «Si det rett ut»: tilbakemelding og forbedringsforslag med 1–5 stjerner, med litt skoghumor. Brukes i
// fullversjonen (📣 i sidemenyen og kommandopaletten) og i SkogIQ Felt (Mer). Brukeren ser status og svar fra
// administrator under «Mine». Serveren: tilbakemelding.js (/api/tilbakemelding). Stilene ligger her, så modulen
// virker likt i begge appene.
import { API } from './plan-synk.js';
import { VERSJON } from './versjon.js';

export const STJERNE_TEKST = { 1: '🪲 Barkbille-nivå. Au.', 2: '🪵 Mer kvist enn stamme', 3: '🌲 Helt grei gran', 4: '🌲🌲 Fin furu, dette!', 5: '✨ Hogstmoden genialitet!' };
export const TYPER = {
  forslag: { ikon: '💡', navn: 'Forbedringsforslag', ph: 'Hva skal vi plante? Beskriv hva du vil få til – «det hadde vært fint om …». Jo mer konkret, jo raskere spirer det.' },
  feil: { ikon: '🪲', navn: 'Barkbille (feil)', ph: 'Hva gjorde du, hva skjedde, og hva ventet du skulle skje? Gode spor gjør billen lettere å finne.' },
  ros: { ikon: '🌸', navn: 'Ros', ph: 'Ros gjør utvikleren 20 % mer produktiv. (Ikke vitenskapelig dokumentert, men vi tror på det.)' },
  annet: { ikon: '🦉', navn: 'Annet', ph: 'Ugla lytter. Hva tenker du på?' },
};
export const STATUS = { ny: '🌱 Spirer', vurderes: '🔍 På befaring', planlagt: '🪓 På hogstplanen', lost: '✅ Hogd og levert', avvist: '🍂 Ble liggende i skogen' };
const TAKK = [
  'Forslaget er levert til utviklingsavdelingen (én person og en svært motivert motorsag). 🪓',
  'Ugla har notert det i den store boka. 🦉',
  'Tilbakemeldingen er stablet pent ved bilveien og hentes med første tømmerbil. 🚛',
  'Lagt rett på hogstplanen for vurdering. Ingen barkbiller ble skadet. 🌲',
];
export function takkTekst({ stjerner, type }, tilfeldig = Math.random) {
  if (stjerner === 5) return 'Fem stjerner! Utvikleren tar en ekstra kopp bålkaffe i kveld. ☕🔥';
  if (stjerner === 1) return 'Au. Takk for ærligheten – vi henter motorsagen og rydder opp. 🪚';
  if (type === 'feil') return 'Barkbillen er meldt. Vi går på jakt med lupe og lommelykt. 🔦🪲';
  return TAKK[Math.floor(tilfeldig() * TAKK.length) % TAKK.length];
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dato = (t) => new Date(t).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
const stjerneTekst = (n) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '');
async function kall(sti, { metode = 'GET', kropp } = {}) {
  const r = await fetch(`${API}${sti}`, { method: metode, headers: kropp ? { 'Content-Type': 'application/json' } : {}, credentials: 'same-origin', body: kropp ? JSON.stringify(kropp) : undefined });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.feil || (r.status === 401 ? 'Logg inn for å gi tilbakemelding.' : `Serveren svarte ${r.status}`)); return j;
}

const CSS = `
.tb-dialog { border: 0; border-radius: 20px; padding: 0; width: min(520px, calc(100% - 24px)); max-height: calc(100% - 24px); background: #fbfcfa; color: #10241c; box-shadow: 0 24px 70px rgba(0,0,0,.35); font: 15px/1.45 system-ui, -apple-system, sans-serif; }
.tb-dialog::backdrop { background: rgba(8,20,14,.45); }
.tb-inn { display: grid; gap: 12px; padding: 18px 20px 20px; }
.tb-topp { display: flex; justify-content: space-between; align-items: start; gap: 10px; }
.tb-topp h2 { margin: 0; font-size: 20px; letter-spacing: -.2px; } .tb-topp p { margin: 3px 0 0; color: #43544b; font-size: 14px; }
.tb-lukk { border: 0; background: #eef3ef; width: 34px; height: 34px; border-radius: 50%; font-size: 18px; cursor: pointer; color: #10241c; flex: none; }
.tb-faner { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: #eef3ef; padding: 4px; border-radius: 12px; }
.tb-faner button { border: 0; background: transparent; padding: 8px; border-radius: 9px; font: inherit; font-size: 14px; cursor: pointer; color: #43544b; }
.tb-faner button[aria-selected="true"] { background: #fff; color: #10241c; font-weight: 700; box-shadow: 0 1px 4px rgba(0,0,0,.12); }
.tb-stjerner { display: flex; gap: 2px; align-items: center; } .tb-stjerner button { border: 0; background: none; font-size: 34px; line-height: 1; padding: 2px 3px; cursor: pointer; color: #c9d2cc; transition: transform .1s; }
.tb-stjerner button.paa { color: #e0a100; } .tb-stjerner button:hover { transform: scale(1.15); }
.tb-stjerne-tekst { min-height: 20px; font-weight: 700; color: #1f6b4a; font-size: 14px; }
.tb-typer { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
.tb-typer button { border: 1.5px solid #cfd6d1; background: #fff; border-radius: 12px; padding: 9px 10px; font: inherit; font-size: 14px; cursor: pointer; text-align: left; color: #10241c; }
.tb-typer button[aria-pressed="true"] { border-color: #1f6b4a; background: #e6f0ea; font-weight: 700; }
.tb-dialog textarea { width: 100%; box-sizing: border-box; min-height: 110px; padding: 10px 12px; border-radius: 12px; border: 1px solid #bbb; font: inherit; resize: vertical; background: #fff; color: #10241c; }
.tb-lofte { margin: 0; font-size: 12.5px; color: #43544b; background: #f4f1e6; border-radius: 10px; padding: 8px 12px; }
.tb-feil { color: #b4302f; font-size: 13px; min-height: 18px; }
.tb-knapper { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
.tb-knapper button { border: 0; border-radius: 10px; padding: 11px 16px; font: inherit; font-weight: 700; cursor: pointer; }
.tb-knapper .primar { background: #1f6b4a; color: #fff; } .tb-knapper .sekundar { background: #eef3ef; color: #10241c; }
.tb-takk { text-align: center; padding: 10px 6px; display: grid; gap: 8px; } .tb-takk .stor { font-size: 54px; line-height: 1; } .tb-takk b { font-size: 18px; }
.tb-liste { display: grid; gap: 8px; max-height: 52vh; overflow: auto; }
.tb-rad { border: 1px solid #dde4df; border-radius: 12px; padding: 10px 12px; display: grid; gap: 4px; background: #fff; }
.tb-rad .meta { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; color: #5d6d64; flex-wrap: wrap; }
.tb-rad .st { color: #e0a100; letter-spacing: 1px; } .tb-rad p { margin: 0; white-space: pre-wrap; font-size: 14px; }
.tb-pille { font-size: 12px; font-weight: 700; padding: 1px 8px; border-radius: 99px; background: #eef3ef; color: #1f6b4a; white-space: nowrap; }
.tb-svar { background: #e6f0ea; border-radius: 10px; padding: 7px 10px; font-size: 13.5px; } .tb-svar b { display: block; font-size: 12px; color: #1f6b4a; }
@media (prefers-color-scheme: dark) { .tb-dialog { background: #15241d; color: #e6efe9; } .tb-topp p, .tb-lofte, .tb-rad .meta { color: #a9bcb1; } .tb-lukk, .tb-faner, .tb-knapper .sekundar { background: #1b2d25; color: #e6efe9; } .tb-faner button[aria-selected="true"], .tb-typer button, .tb-dialog textarea, .tb-rad { background: #0e1a15; color: #e6efe9; border-color: #2a3d34; } .tb-typer button[aria-pressed="true"], .tb-svar { background: #1f3a2c; } .tb-lofte { background: #2a2a1e; } .tb-stjerne-tekst, .tb-svar b, .tb-pille { color: #8fd1ad; } .tb-pille { background: #1b2d25; } }
`;
function sikreCss() { if (document.getElementById('tb-stil')) return; const s = document.createElement('style'); s.id = 'tb-stil'; s.textContent = CSS; document.head.appendChild(s); }

// Åpner dialogen. fane = hvor i appen brukeren er (følger med tilbakemeldingen). visning: 'ny' | 'mine'.
export function apneTilbakemelding({ fane = '', visning = 'ny' } = {}) {
  if (typeof document === 'undefined' || document.querySelector('.tb-dialog')) return;
  sikreCss();
  const st = { visning, stjerner: 0, type: 'forslag', tekst: '', feil: '', sender: false, takk: null, mine: null };
  const d = document.createElement('dialog'); d.className = 'tb-dialog'; d.setAttribute('aria-label', 'Tilbakemelding');
  document.body.appendChild(d);
  const lukk = () => { d.close(); d.remove(); };
  const hentMine = async () => { try { st.mine = (await kall('/api/tilbakemelding/mine')).liste; } catch (e) { st.mine = []; st.feil = e.message; } tegn(); };

  function nyHtml() {
    if (st.takk) return `<div class="tb-takk"><div class="stor">${st.takk.stjerner === 5 ? '🏆' : st.takk.stjerner === 1 ? '🪚' : st.takk.type === 'feil' ? '🔦' : '🌲'}</div><b>Takk!</b><p style="margin:0">${esc(takkTekst(st.takk))}</p><p class="tb-lofte">${st.takk.type === 'forslag' ? 'Gode forslag som lar seg gjennomføre, løses i løpet av noen dager. Følg med under «Mine» – der ser du status og svar.' : 'Du ser status og eventuelle svar under «Mine».'}</p>
      <div class="tb-knapper" style="justify-content:center"><button type="button" class="sekundar" data-tb="mine">Se mine tilbakemeldinger</button><button type="button" class="primar" data-tb="lukk">Tilbake til skogen</button></div></div>`;
    const t = TYPER[st.type];
    return `<div><div class="tb-stjerner" role="radiogroup" aria-label="Hvor fornøyd er du?">${[1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" aria-checked="${st.stjerner === n}" aria-label="${n} stjerne${n > 1 ? 'r' : ''}" data-tb-stjerne="${n}" class="${n <= st.stjerner ? 'paa' : ''}">★</button>`).join('')}</div>
      <div class="tb-stjerne-tekst" data-tb-stjerne-tekst>${st.stjerner ? esc(STJERNE_TEKST[st.stjerner]) : 'Hvor fornøyd er du med SkogIQ.ai? (valgfritt)'}</div></div>
      <div class="tb-typer">${Object.entries(TYPER).map(([k, x]) => `<button type="button" data-tb-type="${k}" aria-pressed="${st.type === k}">${x.ikon} ${esc(x.navn)}</button>`).join('')}</div>
      <textarea data-tb-tekst maxlength="3000" placeholder="${esc(t.ph)}" aria-label="${esc(t.navn)}">${esc(st.tekst)}</textarea>
      ${st.type === 'forslag' ? '<p class="tb-lofte">💡 Gode forslag som lar seg gjennomføre, løses i løpet av <b>noen dager</b>. Resten legges i et lunt skogholt og vurderes igjen når det er tid.</p>' : ''}
      <div class="tb-feil" role="alert">${esc(st.feil)}</div>
      <div class="tb-knapper"><button type="button" class="sekundar" data-tb="lukk">Avbryt</button><button type="button" class="primar" data-tb="send" ${st.sender ? 'disabled' : ''}>${st.sender ? 'Sender …' : 'Send til skogen 🌲'}</button></div>`;
  }
  function mineHtml() {
    if (!st.mine) return '<p>Henter …</p>';
    if (!st.mine.length) return `<p>Ingen tilbakemeldinger ennå. Skogen venter spent. 🌲</p>${st.feil ? `<div class="tb-feil">${esc(st.feil)}</div>` : ''}`;
    return `<div class="tb-liste">${st.mine.map((x) => `<div class="tb-rad"><div class="meta"><span>${TYPER[x.type]?.ikon || ''} ${esc(TYPER[x.type]?.navn || x.type)} · ${dato(x.tid)} ${x.stjerner ? `<span class="st" aria-label="${x.stjerner} stjerner">${stjerneTekst(x.stjerner)}</span>` : ''}</span><span class="tb-pille">${esc(STATUS[x.status] || x.status)}</span></div>
      ${x.tekst ? `<p>${esc(x.tekst)}</p>` : ''}${x.svar ? `<div class="tb-svar"><b>Svar fra SkogIQ.ai · ${dato(x.svarTid)}</b>${esc(x.svar)}</div>` : ''}</div>`).join('')}</div>`;
  }
  function tegn() {
    d.innerHTML = `<div class="tb-inn"><div class="tb-topp"><div><h2>📣 Si det rett ut</h2><p>Skogen tåler litt vind. Ros, ris og gode idéer tas imot med takk.</p></div><button type="button" class="tb-lukk" data-tb="lukk" aria-label="Lukk">×</button></div>
      <div class="tb-faner" role="tablist"><button type="button" role="tab" data-tb-vis="ny" aria-selected="${st.visning === 'ny'}">Gi tilbakemelding</button><button type="button" role="tab" data-tb-vis="mine" aria-selected="${st.visning === 'mine'}">Mine${st.mine?.length ? ` (${st.mine.length})` : ''}</button></div>
      ${st.visning === 'ny' ? nyHtml() : mineHtml()}</div>`;
    if (st.visning === 'ny' && !st.takk) setTimeout(() => d.querySelector('[data-tb-tekst]')?.focus({ preventScroll: true }), 0);
  }
  async function send() {
    st.tekst = d.querySelector('[data-tb-tekst]')?.value || st.tekst; st.feil = '';
    if (!st.stjerner && !st.tekst.trim()) { st.feil = 'Gi noen stjerner eller skriv et par ord – ugla er nysgjerrig. 🦉'; tegn(); return; }
    st.sender = true; tegn();
    try {
      const r = await kall('/api/tilbakemelding', { metode: 'POST', kropp: { stjerner: st.stjerner || null, type: st.type, tekst: st.tekst, fane, versjon: VERSJON } });
      st.takk = r.tilbakemelding; st.mine = null; st.tekst = ''; st.stjerner = 0;
    } catch (e) { st.feil = e.message; }
    st.sender = false; tegn();
  }
  d.addEventListener('click', (e) => {
    const s = e.target.closest('[data-tb-stjerne]'); if (s) { st.tekst = d.querySelector('[data-tb-tekst]')?.value ?? st.tekst; const n = Number(s.dataset.tbStjerne); st.stjerner = st.stjerner === n ? 0 : n; tegn(); return; }
    const t = e.target.closest('[data-tb-type]'); if (t) { st.tekst = d.querySelector('[data-tb-tekst]')?.value ?? st.tekst; st.type = t.dataset.tbType; tegn(); return; }
    const v = e.target.closest('[data-tb-vis]'); if (v) { st.tekst = d.querySelector('[data-tb-tekst]')?.value ?? st.tekst; st.visning = v.dataset.tbVis; st.takk = null; st.feil = ''; tegn(); if (st.visning === 'mine' && !st.mine) hentMine(); return; }
    const h = e.target.closest('[data-tb]')?.dataset.tb;
    if (h === 'lukk') lukk(); else if (h === 'send') send(); else if (h === 'mine') { st.visning = 'mine'; st.takk = null; tegn(); hentMine(); }
  });
  // Forhåndsvisning av stjerneteksten når musen er over en stjerne
  d.addEventListener('mouseover', (e) => { const s = e.target.closest('[data-tb-stjerne]'); const el = d.querySelector('[data-tb-stjerne-tekst]'); if (s && el) el.textContent = STJERNE_TEKST[s.dataset.tbStjerne]; });
  d.addEventListener('mouseout', (e) => { if (!e.target.closest('[data-tb-stjerne]')) return; const el = d.querySelector('[data-tb-stjerne-tekst]'); if (el) el.textContent = st.stjerner ? STJERNE_TEKST[st.stjerner] : 'Hvor fornøyd er du med SkogIQ.ai? (valgfritt)'; });
  d.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
  d.addEventListener('close', () => d.remove());
  tegn(); d.showModal();
  if (visning === 'mine') hentMine();
}
