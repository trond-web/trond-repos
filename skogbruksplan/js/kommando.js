// Kommandopalett (⌘K / Ctrl+K): søk etter bestand, planer, kommuner og handlinger.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Hvert valg: { gruppe, tittel, under, ikon, sok (ekstra søkeord), utfor() }
export function initKommando({ hentValg }) {
  const rot = $('#kommando'); const input = $('#kommandoInput'); const liste = $('#kommandoListe');
  let valg = []; let aktiv = 0; let forrigeFokus = null;

  function finn(q) {
    const ord = norm(q).split(/\s+/).filter(Boolean);
    const alle = hentValg(q);
    if (!ord.length) return alle.filter((v) => v.standard);
    return alle.filter((v) => v.alltid || ord.every((o) => norm(`${v.tittel} ${v.under || ''} ${v.sok || ''}`).includes(o))).slice(0, 40);
  }
  function tegn() {
    valg = finn(input.value);
    if (aktiv >= valg.length) aktiv = Math.max(0, valg.length - 1);
    let gruppe = null;
    liste.innerHTML = valg.length ? valg.map((v, i) => {
      const g = v.gruppe !== gruppe ? `<li class="gruppe" role="presentation">${esc(v.gruppe)}</li>` : '';
      gruppe = v.gruppe;
      return `${g}<li class="valg" role="option" id="kv-${i}" data-i="${i}" aria-selected="${i === aktiv}"><span class="ikon" aria-hidden="true">${esc(v.ikon || '›')}</span><span><b>${esc(v.tittel)}</b>${v.under ? `<div class="under">${esc(v.under)}</div>` : ''}</span><span class="under">${i === aktiv ? '↵' : ''}</span></li>`;
    }).join('') : '<li class="tom">Ingen treff. Prøv et bestandsnummer, en kommune eller «29/2».</li>';
    input.setAttribute('aria-activedescendant', valg.length ? `kv-${aktiv}` : '');
    liste.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }
  function apne() {
    forrigeFokus = document.activeElement;
    rot.hidden = false; input.value = ''; aktiv = 0; tegn();
    input.focus();
  }
  function lukk() { rot.hidden = true; forrigeFokus?.focus?.(); }
  function utfor(i) { const v = valg[i]; if (!v) return; lukk(); setTimeout(() => v.utfor(), 0); }

  input.addEventListener('input', () => { aktiv = 0; tegn(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); aktiv = Math.min(valg.length - 1, aktiv + 1); tegn(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); aktiv = Math.max(0, aktiv - 1); tegn(); }
    if (e.key === 'Enter') { e.preventDefault(); utfor(aktiv); }
    if (e.key === 'Escape') lukk();
  });
  liste.addEventListener('mousemove', (e) => { const li = e.target.closest('.valg'); if (li && Number(li.dataset.i) !== aktiv) { aktiv = Number(li.dataset.i); tegn(); } });
  liste.addEventListener('click', (e) => { const li = e.target.closest('.valg'); if (li) utfor(Number(li.dataset.i)); });
  rot.addEventListener('click', (e) => { if (e.target === rot) lukk(); });
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (rot.hidden) apne(); else lukk(); }
    if (e.key === '/' && rot.hidden && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { e.preventDefault(); apne(); }
  });
  $('#kommandoBtn').addEventListener('click', apne);
  if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) { const k = $('#kommandoBtn kbd'); if (k) k.textContent = 'Ctrl K'; }
  return { apne, lukk };
}
