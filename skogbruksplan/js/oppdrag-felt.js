// Oppdrag i SkogIQ Felt: liste, oppdragskort med status, utfører (ring/e-post), tiltak som krysses av som utført,
// PEFC-sjekkliste, bestand uthevet i kartet, og å lage eller endre oppdrag. Bruker oppdrag.js som fullversjonen.
import { OPPDRAGSTYPER, OPPDRAGSSTATUS, AKTIVE_STATUS, typeFor, ledig, lagOppdrag, linjer, sammendrag, fjernLinje, slettOppdrag, leggTil } from './oppdrag.js';
import { TILTAKSTYPER } from './model.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v, d = 0) => (v == null || Number.isNaN(v) ? '–' : Number(v).toLocaleString('nb-NO', { maximumFractionDigits: d, minimumFractionDigits: d }));
const dato = (d) => (d ? new Date(d).toLocaleDateString('nb-NO') : '');
const typeNokkel = (t) => (OPPDRAGSTYPER[t] ? t : 'annet');
const statusMerke = (st) => `<span class="o-status" style="--f:${OPPDRAGSSTATUS[st]?.farge || '#888'}">${esc(OPPDRAGSSTATUS[st]?.navn || st)}</span>`;

export function initOppdragFelt({ plan, aapneArk, lagrePlanen, melding, nyId, settUtfort, visTiltakKort, uthev, zoomTil, iAar = new Date().getFullYear() }) {
  let aapent = null; // id for oppdraget som vises
  let utvalg = null; // { modus: 'nytt' | 'legg-til', type, valgte: Set }
  const S = () => plan();
  const alle = () => S()?.oppdrag || [];
  const finnO = (id) => alle().find((o) => o.id === id);

  // ---------- liste ----------
  function visListe() {
    aapent = null; utvalg = null; uthev([]);
    const liste = [...alle()].sort((a, b) => (AKTIVE_STATUS.includes(b.status) - AKTIVE_STATUS.includes(a.status)) || String(b.opprettet).localeCompare(String(a.opprettet)));
    const aktive = liste.filter((o) => AKTIVE_STATUS.includes(o.status)); const ferdige = liste.filter((o) => !AKTIVE_STATUS.includes(o.status));
    const rad = (o) => { const s = sammendrag(S(), o); return `<button type="button" class="rad" data-oppdrag="${esc(o.id)}"><div><div class="tittel">${esc(o.nr)} · ${esc(typeFor(o.type).kort)}</div><div class="under">${statusMerke(o.status)} ${s.bestand} bestand · ${fmt(s.areal, 1)} daa${o.utforer?.navn ? ` · ${esc(o.utforer.navn)}` : ''}${o.periode?.fra ? ` · ${esc(dato(o.periode.fra))}${o.periode.til ? `–${esc(dato(o.periode.til))}` : ''}` : ''}</div></div><span>›</span></button>`; };
    aapneArk(`<h2>Oppdrag</h2><p class="hint">Bestillinger til entreprenør, planteleverandør eller deg selv. Kryss av tiltakene når de er gjort.</p>
      <div class="knapper"><button type="button" class="knapp primar" data-o="nytt">+ Nytt oppdrag</button></div>
      <h3>Aktive (${aktive.length})</h3><div class="liste">${aktive.map(rad).join('') || '<div class="tom">Ingen aktive oppdrag.</div>'}</div>
      ${ferdige.length ? `<h3>Ferdige og avbrutte</h3><div class="liste">${ferdige.map(rad).join('')}</div>` : ''}`, { hoy: true });
  }

  // ---------- oppdragskort ----------
  function visOppdrag(id, { zoom = false } = {}) {
    const o = finnO(id); if (!o) { visListe(); return; }
    aapent = id; utvalg = null;
    const ot = typeFor(o.type); const ls = linjer(S(), o); const s = sammendrag(S(), o);
    const ider = ls.map((l) => l.bestand.id); uthev(ider); if (zoom) zoomTil(ider);
    const ferdige = ls.filter((l) => l.tiltak.status === 'utfort').length;
    const u = o.utforer || {};
    aapneArk(`<h2>${esc(o.nr)} · ${esc(ot.kort)}</h2><p class="hint">${esc(o.tittel || ot.navn)}</p>
      <div class="chips">${Object.entries(OPPDRAGSSTATUS).map(([k, v]) => `<button type="button" class="chip" data-o-status="${k}" aria-pressed="${o.status === k}">${esc(v.navn)}</button>`).join('')}</div>
      <div class="tall-rad"><div class="tall"><b>${s.bestand}</b><span>bestand</span></div><div class="tall"><b>${fmt(s.areal, 1)}</b><span>daa</span></div><div class="tall"><b>${ferdige}/${ls.length}</b><span>utført</span></div></div>
      <h3>Utfører</h3>
      ${u.navn || u.telefon || u.epost ? `<p><b>${esc(u.navn || 'Ikke satt')}</b>${u.kontakt ? ` · ${esc(u.kontakt)}` : ''}</p>
        <div class="knapper">${u.telefon ? `<a class="knapp" href="tel:${esc(u.telefon.replace(/\s/g, ''))}">📞 Ring ${esc(u.telefon)}</a>` : ''}${u.epost ? `<a class="knapp" href="mailto:${esc(u.epost)}?subject=${encodeURIComponent(`Oppdrag ${o.nr}`)}">✉ E-post</a>` : ''}</div>` : `<p class="hint">${esc(ot.utforer)} er ikke satt.</p>`}
      ${o.periode?.fra || o.periode?.til ? `<p class="hint">Periode: ${esc(dato(o.periode.fra))}${o.periode.til ? ` – ${esc(dato(o.periode.til))}` : ''}</p>` : ''}
      <h3>Tiltak</h3>
      <div class="liste">${ls.map(({ bestand: b, tiltak: t }) => `<div class="rad"><div class="rad-tekst" data-o-tiltak="${esc(b.id)}|${esc(t.id)}" role="button" tabindex="0"><div class="tittel">Bestand ${esc(b.nr)} · ${esc(TILTAKSTYPER[t.type]?.navn || t.type)}</div><div class="under">${fmt(t.arealDaa ?? b.areal, 1)} daa · ${t.status === 'utfort' ? `utført ${esc(dato(t.utfortDato))}` : `planlagt ${t.aar ?? ''}`}</div></div>
        <div class="rad-knapper"><button type="button" class="avkryss endre" data-o-fjern="${esc(t.id)}" aria-label="Fjern fra oppdraget">✕</button><button type="button" class="avkryss ${t.status === 'utfort' ? 'ferdig' : ''}" data-o-utfort="${esc(b.id)}|${esc(t.id)}" aria-label="Merk utført">${t.status === 'utfort' ? '✓' : ''}</button></div></div>`).join('') || '<div class="tom">Ingen tiltak i oppdraget.</div>'}</div>
      <div class="knapper"><button type="button" class="knapp" data-o="legg-til">+ Legg til tiltak</button><button type="button" class="knapp" data-o="kart">Vis i kart</button></div>
      ${ot.felt.some((f) => o.felt?.[f.id] != null && o.felt[f.id] !== '') ? `<h3>Detaljer</h3><dl class="kort-liste">${ot.felt.filter((f) => o.felt?.[f.id] != null && o.felt[f.id] !== '').map((f) => `<dt>${esc(f.navn)}</dt><dd>${esc(o.felt[f.id])}${f.enhet ? ` ${esc(f.enhet)}` : ''}</dd>`).join('')}</dl>` : ''}
      <h3>Sjekkliste (${s.sjekk}/${s.sjekkTotalt})</h3>
      <div class="sjekkliste">${ot.sjekk.map((k) => `<label class="sjekk"><input type="checkbox" data-o-sjekk="${esc(k.id)}" ${o.sjekk?.[k.id] ? 'checked' : ''}><span>${esc(k.tekst)}${k.pefc ? ` <span class="hint">(PEFC ${k.pefc})</span>` : ''}</span></label>`).join('')}</div>
      ${o.merknad ? `<h3>Merknad</h3><p>${esc(o.merknad)}</p>` : ''}
      <div class="knapper"><button type="button" class="knapp" data-o="rediger">✎ Utfører, periode og merknad</button></div>
      <div class="knapper"><button type="button" class="knapp" data-o="liste">‹ Alle oppdrag</button><button type="button" class="knapp fare" data-o="slett">Slett oppdrag</button></div>`, { hoy: true });
  }

  function visRediger(id) {
    const o = finnO(id); if (!o) return; const u = o.utforer || {};
    aapneArk(`<h2>${esc(o.nr)} – utfører og periode</h2>
      <div class="skjema-felt">
        <label>${esc(typeFor(o.type).utforer)}<input type="text" data-or="navn" value="${esc(u.navn)}"></label>
        <label>Kontaktperson<input type="text" data-or="kontakt" value="${esc(u.kontakt)}"></label>
        <label>Telefon<input type="text" inputmode="tel" data-or="telefon" value="${esc(u.telefon)}"></label>
        <label>E-post<input type="text" inputmode="email" data-or="epost" value="${esc(u.epost)}"></label>
        <label>Fra dato<input type="date" data-or="fra" value="${esc(o.periode?.fra)}"></label>
        <label>Til dato<input type="date" data-or="til" value="${esc(o.periode?.til)}"></label>
        <label>Merknad<textarea rows="3" data-or="merknad">${esc(o.merknad)}</textarea></label>
      </div>
      <div class="knapper"><button type="button" class="knapp" data-o="avbryt-rediger">Avbryt</button><button type="button" class="knapp primar" data-o="lagre-rediger">Lagre</button></div>`, { hoy: true });
  }

  // Velg tiltak: nytt oppdrag (type først) eller legg til i det åpne.
  function visUtvalg() {
    const u = utvalg; const P = S();
    if (!u.type) {
      const typer = new Map();
      for (const b of P.bestand) for (const t of b.tiltak || []) if (ledig(t, P.oppdrag)) typer.set(typeNokkel(t.type), (typer.get(typeNokkel(t.type)) || 0) + 1);
      aapneArk(`<h2>Nytt oppdrag</h2><p class="hint">Velg type. Bare planlagte tiltak som ikke ligger i et aktivt oppdrag, kan tas med.</p>
        <div class="liste">${[...typer].map(([k, n]) => `<button type="button" class="rad" data-o-type="${k}"><div><div class="tittel">${esc(OPPDRAGSTYPER[k].navn)}</div><div class="under">${n} ledige tiltak</div></div><span>›</span></button>`).join('') || '<div class="tom">Ingen ledige planlagte tiltak.</div>'}</div>
        <div class="knapper"><button type="button" class="knapp" data-o="liste">‹ Tilbake</button></div>`, { hoy: true });
      return;
    }
    const kand = P.bestand.flatMap((b) => (b.tiltak || []).filter((t) => typeNokkel(t.type) === u.type && ledig(t, P.oppdrag)).map((t) => ({ b, t }))).sort((x, y) => (x.t.aar || 0) - (y.t.aar || 0));
    uthev(kand.filter(({ t }) => u.valgte.has(t.id)).map(({ b }) => b.id));
    aapneArk(`<h2>${u.modus === 'nytt' ? 'Nytt oppdrag' : 'Legg til tiltak'} – ${esc(OPPDRAGSTYPER[u.type].kort)}</h2><p class="hint">Kryss av tiltakene som skal være med. Bestandene utheves i kartet.</p>
      <div class="liste">${kand.map(({ b, t }) => `<label class="rad sjekk-rad"><div><div class="tittel">Bestand ${esc(b.nr)} · ${esc(TILTAKSTYPER[t.type]?.navn || t.type)} ${t.aar ?? ''}</div><div class="under">${fmt(t.arealDaa ?? b.areal, 1)} daa${t.kommentar ? ` · ${esc(t.kommentar)}` : ''}</div></div><input type="checkbox" class="stor-avkryss" data-o-velg="${esc(t.id)}" ${u.valgte.has(t.id) ? 'checked' : ''}></label>`).join('') || '<div class="tom">Ingen ledige tiltak av denne typen.</div>'}</div>
      <div class="knapper"><button type="button" class="knapp" data-o="${u.modus === 'nytt' ? 'nytt' : 'tilbake-oppdrag'}">‹ Tilbake</button><button type="button" class="knapp primar" data-o="bruk-utvalg" ${u.valgte.size ? '' : 'disabled'}>${u.modus === 'nytt' ? `Lag oppdrag (${u.valgte.size})` : `Legg til (${u.valgte.size})`}</button></div>`, { hoy: true });
  }

  // Fra tiltakskortet: legg tiltaket i et aktivt oppdrag av samme type, eller et nytt.
  function visLeggIOppdrag(bid, tid) {
    const P = S(); const b = P.bestand.find((x) => x.id === bid); const t = b?.tiltak?.find((x) => x.id === tid); if (!t) return;
    const aktuelle = alle().filter((o) => AKTIVE_STATUS.includes(o.status) && o.type === typeNokkel(t.type));
    aapneArk(`<h2>Legg i oppdrag</h2><p class="hint">${esc(TILTAKSTYPER[t.type]?.navn || t.type)} i bestand ${esc(b.nr)}</p>
      <div class="liste">${aktuelle.map((o) => `<button type="button" class="rad" data-o-inn="${esc(o.id)}|${esc(bid)}|${esc(tid)}"><div><div class="tittel">${esc(o.nr)} · ${esc(typeFor(o.type).kort)}</div><div class="under">${statusMerke(o.status)} ${o.linjer.length} tiltak${o.utforer?.navn ? ` · ${esc(o.utforer.navn)}` : ''}</div></div><span>›</span></button>`).join('')}
        <button type="button" class="rad" data-o-inn="nytt|${esc(bid)}|${esc(tid)}"><div><div class="tittel">+ Nytt oppdrag</div><div class="under">${esc(OPPDRAGSTYPER[typeNokkel(t.type)].navn)}</div></div><span>›</span></button></div>`);
  }

  async function lagreOgVis(id, tekst) { await lagrePlanen(); if (tekst) melding(tekst); if (id) visOppdrag(id); else visListe(); }

  // ---------- hendelser (delegert fra arket) ----------
  async function klikk(e) {
    const el = (sel) => e.target.closest(sel);
    if (el('[data-oppdrag]')) { visOppdrag(el('[data-oppdrag]').dataset.oppdrag, { zoom: true }); return true; }
    if (el('[data-o-status]') && aapent) {
      const o = finnO(aapent); const ny = el('[data-o-status]').dataset.oStatus; if (o.status === ny) return true;
      o.status = ny; if (ny === 'utfort') o.utfort = new Date().toISOString().slice(0, 10);
      await lagreOgVis(o.id, `${o.nr} er satt til ${OPPDRAGSSTATUS[ny].navn.toLowerCase()}.`); return true;
    }
    if (el('[data-o-utfort]')) {
      const [bid, tid] = el('[data-o-utfort]').dataset.oUtfort.split('|'); const id = aapent;
      await settUtfort(bid, tid, async () => {
        const o = finnO(id); const ls = linjer(S(), o);
        if (ls.length && ls.every((l) => l.tiltak.status === 'utfort') && o.status !== 'utfort' && confirm(`Alle tiltak i ${o.nr} er utført. Sette oppdraget til utført?`)) { o.status = 'utfort'; o.utfort = new Date().toISOString().slice(0, 10); await lagrePlanen(); }
        visOppdrag(id);
      });
      return true;
    }
    if (el('[data-o-tiltak]')) { const [bid, tid] = el('[data-o-tiltak]').dataset.oTiltak.split('|'); visTiltakKort(bid, tid, { zoom: true }); return true; }
    if (el('[data-o-fjern]') && aapent) {
      const o = finnO(aapent); if (!confirm('Fjerne tiltaket fra oppdraget? Tiltaket beholdes i planen.')) return true;
      fjernLinje(S(), o, el('[data-o-fjern]').dataset.oFjern); await lagreOgVis(o.id, 'Tiltaket er fjernet fra oppdraget.'); return true;
    }
    if (el('[data-o-type]')) { utvalg = { ...utvalg, type: el('[data-o-type]').dataset.oType }; visUtvalg(); return true; }
    if (el('[data-o-inn]')) {
      const [oid, bid, tid] = el('[data-o-inn]').dataset.oInn.split('|'); const P = S(); const b = P.bestand.find((x) => x.id === bid); const t = b?.tiltak?.find((x) => x.id === tid);
      if (oid === 'nytt') { const r = lagOppdrag(P, [{ bestand: b, tiltak: t }], { nyId, iAar }); await lagreOgVis(r.oppdrag[0]?.id, r.oppdrag[0] ? `Oppdrag ${r.oppdrag[0].nr} er laget.` : 'Tiltaket kunne ikke legges i et oppdrag.'); }
      else { const o = finnO(oid); const n = leggTil(P, o, [{ bestand: b, tiltak: t }]); await lagreOgVis(o.id, n ? `Lagt i ${o.nr}.` : 'Tiltaket kunne ikke legges til.'); }
      return true;
    }
    const h = el('[data-o]')?.dataset.o; if (!h) return false;
    if (h === 'liste') visListe();
    if (h === 'nytt') { utvalg = { modus: 'nytt', type: null, valgte: new Set() }; visUtvalg(); }
    if (h === 'legg-til' && aapent) { utvalg = { modus: 'legg-til', type: finnO(aapent).type, valgte: new Set(), oppdragId: aapent }; visUtvalg(); }
    if (h === 'tilbake-oppdrag') visOppdrag(utvalg?.oppdragId || aapent);
    if (h === 'kart' && aapent) { zoomTil(linjer(S(), finnO(aapent)).map((l) => l.bestand.id)); }
    if (h === 'bruk-utvalg' && utvalg) {
      const P = S(); const valgte = P.bestand.flatMap((b) => (b.tiltak || []).filter((t) => utvalg.valgte.has(t.id)).map((t) => ({ bestand: b, tiltak: t })));
      if (utvalg.modus === 'nytt') { const r = lagOppdrag(P, valgte, { nyId, iAar }); const o = r.oppdrag[0]; await lagreOgVis(o?.id, o ? `Oppdrag ${o.nr} er laget med ${o.linjer.length} tiltak.` : 'Ingen tiltak kunne tas med.'); }
      else { const o = finnO(utvalg.oppdragId); const n = leggTil(P, o, valgte); await lagreOgVis(o.id, `${n} tiltak lagt til.`); }
    }
    if (h === 'rediger' && aapent) visRediger(aapent);
    if (h === 'avbryt-rediger' && aapent) visOppdrag(aapent);
    if (h === 'lagre-rediger' && aapent) {
      const o = finnO(aapent); const v = (k) => document.querySelector(`[data-or="${k}"]`)?.value.trim() || '';
      o.utforer = { ...(o.utforer || {}), navn: v('navn'), kontakt: v('kontakt'), telefon: v('telefon'), epost: v('epost') };
      o.periode = { fra: v('fra'), til: v('til') }; o.merknad = v('merknad');
      if (o.periode.fra && o.periode.til && o.periode.til < o.periode.fra) { melding('Til-dato er før fra-dato.'); return true; }
      await lagreOgVis(o.id, 'Oppdraget er lagret.');
    }
    if (h === 'slett' && aapent) { const o = finnO(aapent); if (!confirm(`Slette oppdrag ${o.nr}? Tiltakene beholdes i planen.`)) return true; slettOppdrag(S(), o); await lagreOgVis(null, `${o.nr} er slettet.`); }
    return true;
  }
  async function endring(e) {
    if (e.target.dataset.oSjekk && aapent) { const o = finnO(aapent); o.sjekk = { ...(o.sjekk || {}), [e.target.dataset.oSjekk]: e.target.checked }; await lagrePlanen(); const s = sammendrag(S(), o); const h = [...document.querySelectorAll('#arkInnhold h3')].find((x) => /^Sjekkliste/.test(x.textContent)); if (h) h.textContent = `Sjekkliste (${s.sjekk}/${s.sjekkTotalt})`; return true; }
    if (e.target.dataset.oVelg && utvalg) {
      if (e.target.checked) utvalg.valgte.add(e.target.dataset.oVelg); else utvalg.valgte.delete(e.target.dataset.oVelg);
      // Oppdater knapp og utheving uten å tegne listen på nytt (beholder rulleposisjonen).
      const k = document.querySelector('[data-o="bruk-utvalg"]'); if (k) { k.disabled = !utvalg.valgte.size; k.textContent = utvalg.modus === 'nytt' ? `Lag oppdrag (${utvalg.valgte.size})` : `Legg til (${utvalg.valgte.size})`; }
      const P = S(); uthev(P.bestand.filter((b) => (b.tiltak || []).some((t) => utvalg.valgte.has(t.id))).map((b) => b.id));
      return true;
    }
    return false;
  }

  return { visListe, visOppdrag, visLeggIOppdrag, klikk, endring, aapent: () => aapent, nullstill: () => { aapent = null; utvalg = null; } };
}
