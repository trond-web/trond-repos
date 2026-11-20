// 🔎 Egenskapssøk i fullversjonen: panel øverst i fanene Bestand og Tiltak. Vilkår (felt, operator, verdi), «alle» eller
// «minst ett», treffene oppsummert (antall, areal, volum), vist i kartet og i listen, og lagring av søket i planen
// (S.sok) – så det kan åpnes i SkogIQ Felt. Logikken ligger i js/sok.js.
import { feltFor, OPERATORER, nyttVilkar, kjorSok, beskrivSok, rensSok } from './sok.js';
import { TILTAKSTYPER } from './model.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tall = (v, d = 0) => Number(v || 0).toLocaleString('nb-NO', { maximumFractionDigits: d });

export function initSok({ hentPlan, endret, melding, nyId, uthev, zoomTil, velgBestand, oppdaterListe }) {
  const tom = (mal) => ({ mal, logikk: 'alle', vilkar: [] });
  const st = { bestand: { sok: tom('bestand'), apen: false, lagrer: false }, tiltak: { sok: tom('tiltak'), apen: false, lagrer: false } };
  const lagrede = (mal) => (hentPlan().sok || []).filter((s) => s.mal === mal);
  const aktiv = (mal) => st[mal].sok.vilkar.length > 0;
  const resultat = (mal) => (aktiv(mal) ? kjorSok(hentPlan(), st[mal].sok) : null);

  function vilkarHtml(mal, v, i) {
    const felt = feltFor(mal); const f = felt[v.felt];
    const verdi = f.type === 'ja' ? '' : f.type === 'valg'
      ? (v.op === 'en av'
        ? `<span class="sok-flere">${f.valg.map(([k, n]) => `<label><input type="checkbox" data-sok-flere="${i}" value="${esc(k)}" ${(Array.isArray(v.verdi) ? v.verdi : String(v.verdi).split(',')).includes(k) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</span>`
        : `<select data-sok-verdi="${i}">${f.valg.map(([k, n]) => `<option value="${esc(k)}" ${String(v.verdi) === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`)
      : `<input data-sok-verdi="${i}" value="${esc(v.verdi)}" ${f.type === 'tall' ? 'inputmode="decimal" style="width:80px"' : 'style="width:140px"'} placeholder="${f.type === 'tall' ? 'verdi' : 'tekst'}">${v.op === 'mellom' ? ` og <input data-sok-verdi2="${i}" value="${esc(v.verdi2 ?? '')}" inputmode="decimal" style="width:80px" placeholder="til">` : ''}`;
    return `<div class="sok-vilkar">
      <select data-sok-felt="${i}" aria-label="Egenskap">${Object.entries(felt).map(([k, x]) => `<option value="${k}" ${k === v.felt ? 'selected' : ''}>${esc(x.navn)}</option>`).join('')}</select>
      <select data-sok-op="${i}" aria-label="Operator">${OPERATORER[f.type].map(([k, n]) => `<option value="${esc(k)}" ${k === v.op ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      ${verdi}<button type="button" class="knapp liten" data-sok-fjern="${i}" aria-label="Fjern vilkåret">✕</button></div>`;
  }
  function resultatHtml(mal) {
    const r = resultat(mal); const s = st[mal];
    if (!r) return '<p class="hint" style="margin:6px 0 0">Legg til et vilkår, f.eks. «Hogstklasse er HK III» og «Bonitet ≥ 14».</p>';
    const linjer = mal === 'tiltak' ? r.tiltak.slice(0, 100).map(({ b, t }) => `<button type="button" class="sok-rad" data-sok-bestand="${esc(b.id)}"><b>${esc(TILTAKSTYPER[t.type]?.navn || t.type)} ${t.aar ?? ''}</b> · bestand ${esc(b.nr)} · ${tall(b.areal, 1)} daa · ${t.status === 'utfort' ? 'utført' : 'planlagt'}${t.prioritet ? ` · pri ${t.prioritet}` : ''}${t.kommentar ? `<span class="hint"> – ${esc(t.kommentar.slice(0, 80))}</span>` : ''}</button>`).join('') : '';
    return `<div class="sok-sum"><b>${tall(r.sum.antall)} ${mal === 'tiltak' ? (r.sum.antall === 1 ? 'tiltak' : 'tiltak') : 'bestand'}</b>${mal === 'tiltak' ? ` i ${tall(r.sum.bestand)} bestand` : ''} · ${tall(r.sum.areal, 1)} daa · ${tall(r.sum.volum)} m³
        <span class="sok-knapper"><button type="button" class="knapp liten" data-sok-kart ${r.ider.size ? '' : 'disabled'}>🗺 Vis i kartet</button><button type="button" class="knapp liten primar" data-sok-lagre>💾 Lagre søk</button></span></div>
      ${s.lagrer ? `<div class="sok-lagre"><input data-sok-navn maxlength="60" placeholder="Navn på søket, f.eks. Tynning gran G14+" value="${esc(s.sok.navn || '')}"><button type="button" class="knapp liten primar" data-sok-lagre-ok>Lagre</button><button type="button" class="knapp liten" data-sok-lagre-avbryt>Avbryt</button><span class="hint">Lagres i planen og kan åpnes i SkogIQ Felt.</span></div>` : ''}
      ${mal === 'bestand' ? (r.sum.antall ? '<p class="hint" style="margin:4px 0 0">Bestandslisten under viser bare treffene.</p>' : '') : `<div class="sok-liste">${linjer || '<p class="hint">Ingen tiltak passer.</p>'}${r.tiltak.length > 100 ? `<p class="hint">Viser 100 av ${tall(r.tiltak.length)}.</p>` : ''}</div>`}`;
  }
  function tegn(mal) {
    const el = document.querySelector(`[data-sok-panel="${mal}"]`); if (!el) return; const s = st[mal]; const l = lagrede(mal);
    el.innerHTML = `<details class="kort sok-panel" ${s.apen ? 'open' : ''}><summary><span>🔎 Egenskapssøk</span><span class="hint">${aktiv(mal) ? esc(beskrivSok(s.sok)) : `${mal === 'tiltak' ? 'tiltak' : 'bestand'} etter egenskaper${l.length ? ` · ${l.length} lagret` : ''}`}</span></summary>
      ${l.length ? `<div class="sok-lagrede">${l.map((x) => `<span class="sok-chip ${s.sok.id === x.id ? 'aktiv' : ''}"><button type="button" data-sok-last="${esc(x.id)}" title="${esc(beskrivSok(x))}">📌 ${esc(x.navn)}</button><button type="button" data-sok-slett="${esc(x.id)}" aria-label="Slett søket ${esc(x.navn)}">×</button></span>`).join('')}</div>` : ''}
      <div class="sok-vilkarliste">${s.sok.vilkar.map((v, i) => vilkarHtml(mal, v, i)).join('')}</div>
      <div class="sok-verktoy"><button type="button" class="knapp liten" data-sok-ny>＋ Vilkår</button>
        ${s.sok.vilkar.length > 1 ? `<select data-sok-logikk aria-label="Hvordan vilkårene kombineres"><option value="alle" ${s.sok.logikk !== 'minst' ? 'selected' : ''}>Alle vilkår må stemme</option><option value="minst" ${s.sok.logikk === 'minst' ? 'selected' : ''}>Minst ett vilkår</option></select>` : ''}
        ${aktiv(mal) ? '<button type="button" class="knapp liten" data-sok-nullstill>Nullstill</button>' : ''}</div>
      <div data-sok-resultat>${resultatHtml(mal)}</div></details>`;
  }
  const oppdaterResultat = (mal) => { const el = document.querySelector(`[data-sok-panel="${mal}"] [data-sok-resultat]`); if (el) el.innerHTML = resultatHtml(mal); const sm = document.querySelector(`[data-sok-panel="${mal}"] summary .hint`); if (sm) sm.textContent = aktiv(mal) ? beskrivSok(st[mal].sok) : ''; if (mal === 'bestand') oppdaterListe?.(); };
  const malFor = (el) => el.closest('[data-sok-panel]')?.dataset.sokPanel;
  const endreStruktur = (mal) => { st[mal].sok = { ...st[mal].sok, id: null }; tegn(mal); if (mal === 'bestand') oppdaterListe?.(); };

  document.addEventListener('toggle', (e) => { if (e.target.classList?.contains('sok-panel')) { const mal = malFor(e.target); if (mal) st[mal].apen = e.target.open; } }, true);
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-sok-panel] button, [data-sok-panel] [data-sok-bestand]'); if (!el) return; const mal = malFor(el); if (!mal) return; const s = st[mal];
    if (el.matches('[data-sok-ny]')) { s.sok.vilkar.push(nyttVilkar(mal)); endreStruktur(mal); }
    else if (el.matches('[data-sok-fjern]')) { s.sok.vilkar.splice(Number(el.dataset.sokFjern), 1); endreStruktur(mal); }
    else if (el.matches('[data-sok-nullstill]')) { s.sok = tom(mal); s.lagrer = false; uthev([]); tegn(mal); if (mal === 'bestand') oppdaterListe?.(); }
    else if (el.matches('[data-sok-kart]')) { const r = resultat(mal); if (r?.ider.size) { uthev([...r.ider]); zoomTil([...r.ider]); melding(`${r.ider.size} bestand er uthevet i kartet.`); } }
    else if (el.matches('[data-sok-lagre]')) { s.lagrer = true; oppdaterResultat(mal); setTimeout(() => document.querySelector(`[data-sok-panel="${mal}"] [data-sok-navn]`)?.focus(), 0); }
    else if (el.matches('[data-sok-lagre-avbryt]')) { s.lagrer = false; oppdaterResultat(mal); }
    else if (el.matches('[data-sok-lagre-ok]')) {
      const navn = document.querySelector(`[data-sok-panel="${mal}"] [data-sok-navn]`)?.value || ''; const S = hentPlan();
      const finnes = (S.sok || []).find((x) => x.id === s.sok.id || (navn.trim() && x.navn === navn.trim() && x.mal === mal));
      const ny = rensSok(s.sok, { id: finnes?.id || nyId('sok'), navn });
      S.sok = [...(S.sok || []).filter((x) => x.id !== ny.id), ny]; s.sok = { ...ny }; s.lagrer = false;
      endret(); tegn(mal); melding(`Søket «${ny.navn}» er lagret i planen – det kan åpnes i SkogIQ Felt.`);
    } else if (el.matches('[data-sok-last]')) { const x = lagrede(mal).find((y) => y.id === el.dataset.sokLast); if (x) { s.sok = structuredClone(x); s.apen = true; tegn(mal); if (mal === 'bestand') oppdaterListe?.(); const r = resultat(mal); if (r?.ider.size) uthev([...r.ider]); } }
    else if (el.matches('[data-sok-slett]')) { const S = hentPlan(); const x = (S.sok || []).find((y) => y.id === el.dataset.sokSlett); if (x && confirm(`Slette det lagrede søket «${x.navn}»?`)) { S.sok = S.sok.filter((y) => y.id !== x.id); if (s.sok.id === x.id) s.sok = { ...s.sok, id: null }; endret(); tegn(mal); } }
    else if (el.matches('[data-sok-bestand]')) velgBestand(el.dataset.sokBestand);
  });
  document.addEventListener('change', (e) => {
    const el = e.target; const mal = malFor(el); if (!mal) return; const s = st[mal]; const felt = feltFor(mal);
    if (el.matches('[data-sok-felt]')) { const i = Number(el.dataset.sokFelt); const f = felt[el.value]; s.sok.vilkar[i] = { felt: el.value, op: OPERATORER[f.type][0][0], verdi: f.type === 'valg' ? f.valg[0][0] : '' }; endreStruktur(mal); }
    else if (el.matches('[data-sok-op]')) { const v = s.sok.vilkar[Number(el.dataset.sokOp)]; const f = felt[v.felt]; v.op = el.value; if (f.type === 'valg') v.verdi = el.value === 'en av' ? [] : (Array.isArray(v.verdi) ? v.verdi[0] : v.verdi) ?? f.valg[0][0]; /* «en av» starter uten avkrysning */ endreStruktur(mal); }
    else if (el.matches('[data-sok-verdi]') && el.tagName === 'SELECT') { s.sok.vilkar[Number(el.dataset.sokVerdi)].verdi = el.value; s.sok.id = null; oppdaterResultat(mal); }
    else if (el.matches('[data-sok-flere]')) { const i = Number(el.dataset.sokFlere); s.sok.vilkar[i].verdi = [...document.querySelectorAll(`[data-sok-panel="${mal}"] [data-sok-flere="${i}"]:checked`)].map((x) => x.value); s.sok.id = null; oppdaterResultat(mal); }
    else if (el.matches('[data-sok-logikk]')) { s.sok.logikk = el.value; s.sok.id = null; oppdaterResultat(mal); }
  });
  let t = null;
  document.addEventListener('input', (e) => {
    const el = e.target; const mal = malFor(el); if (!mal) return; const s = st[mal];
    if (el.matches('input[data-sok-verdi]')) s.sok.vilkar[Number(el.dataset.sokVerdi)].verdi = el.value;
    else if (el.matches('[data-sok-verdi2]')) s.sok.vilkar[Number(el.dataset.sokVerdi2)].verdi2 = el.value; else return;
    s.sok.id = null; clearTimeout(t); t = setTimeout(() => oppdaterResultat(mal), 250);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches?.('[data-sok-navn]')) { e.preventDefault(); e.target.closest('[data-sok-panel]').querySelector('[data-sok-lagre-ok]')?.click(); } });

  return {
    tegn: () => { tegn('bestand'); tegn('tiltak'); },
    // Bestandene som passer bestandssøket (Set av id-er), eller null når søket ikke er i bruk – til bestandstabellen.
    utvalg: () => resultat('bestand')?.ider || null,
    apne: (mal = 'bestand') => { st[mal].apen = true; if (!st[mal].sok.vilkar.length) st[mal].sok.vilkar.push(nyttVilkar(mal)); tegn(mal); },
  };
}
