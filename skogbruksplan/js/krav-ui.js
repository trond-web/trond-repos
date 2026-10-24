// KSL › Krav og frister: alle dokumentasjonskrav for gården med status fra dataene i planen, årshjul med frister, og
// registre for det som ikke føres andre steder (husdyr og husdyrgjødsel, søknader, beite, legemiddeljournal).
import { vurderKrav, aarshjul, sikreGard, husdyrgjodsel, TEMA, HUSDYRTYPER, HJEMMEL } from './krav.js';
import { HUSDYR } from './skifteplan.js';
import { signatur } from './versjon.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS = { mangler: { navn: 'Mangler', ikon: '✕', klasse: 'avvik' }, delvis: { navn: 'Følg opp', ikon: '!', klasse: 'varsel' }, info: { navn: 'Info', ikon: 'i', klasse: 'info' }, ok: { navn: 'OK', ikon: '✓', klasse: 'ok' } };
const datoTekst = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function lagKravUi({ hentPlan, endret, melding, nyId, aar }) {
  const G = () => sikreGard(hentPlan());
  const idag = () => new Date().toISOString().slice(0, 10);
  const lagre = (tegn) => { endret({ kart: false }); tegn(); };

  function kravHtml() {
    const S = hentPlan(); const a = aar(); const k = vurderKrav(S, a, idag()); const hjul = aarshjul(S, a, idag());
    const n = (s) => k.filter((x) => x.status === s).length;
    const kpi = (v, e, u) => `<div class="kpi"><div class="verdi">${v}</div><div class="etikett">${e}</div><div class="under">${u}</div></div>`;
    const grupper = Object.entries(TEMA).map(([t, navn]) => [navn, k.filter((x) => x.tema === t)]).filter(([, l]) => l.length);
    return `<div class="kpi-rad">${kpi(k.length, 'krav som gjelder gården', `${a}`)}${kpi(n('mangler'), 'mangler', n('mangler') ? 'må ordnes' : 'ingen')}${kpi(n('delvis'), 'følg opp', 'frister og ufullstendig')}${kpi(n('ok'), 'i orden', 'dokumentert i SkogIQ')}</div>
      <div class="kort"><div class="detalj-topp"><h3>📅 Årshjul – neste 12 måneder</h3><button type="button" class="knapp liten" data-krav="skriv">Skriv ut kravoversikt</button></div>
        ${hjul.length ? `<div class="md-liste">${hjul.map((h) => `<div class="md-rad krav-${STATUS[h.status]?.klasse || 'info'}"><b>${esc(datoTekst(h.dato))} · ${esc(h.navn)}</b><small>${h.dagerIgjen === 0 ? 'i dag' : `om ${h.dagerIgjen} dager`}${h.fane ? ` · <a href="#" data-ksl-gaa="${esc(h.fane)}">Gå til</a>` : ''}</small></div>`).join('')}</div>` : '<p class="hint">Ingen frister de neste 12 månedene.</p>'}</div>
      ${grupper.map(([navn, l]) => `<div class="kort"><h3>${esc(navn)}</h3>${l.map((x) => `<div class="ksl-varsel ${STATUS[x.status].klasse}"><b>${STATUS[x.status].ikon} ${esc(x.navn)}</b><span class="hint">${esc(x.tekst)}${x.frist && x.status !== 'ok' ? ` Frist: ${esc(datoTekst(x.frist))}.` : ''}</span>
        <span class="hint"><a href="${esc(x.hjemmel.url)}" target="_blank" rel="noopener">${esc(x.hjemmel.navn)}</a>${x.fane ? ` · <a href="#" data-ksl-gaa="${esc(x.fane)}">Gå til</a>` : ''}</span></div>`).join('')}</div>`).join('')}
      ${gardHtml()}
      <p class="hint">Kravene er en hjelp til å holde orden. Regler for spredetid, fosforgrenser, RMP og regionale miljøkrav varierer mellom fylker og vannområder – sjekk med landbrukskontoret i kommunen.</p>`;
  }
  function gardHtml() {
    const g = G(); const a = aar(); const h = g.husdyr; const sok = g.soknader[a] || {}; const S = hentPlan(); const hg = husdyrgjodsel(S, a);
    const storfe = h.typer.includes('storfe'); const harDyr = h.typer.length > 0; const b = g.beite[a] || {};
    const lm = (g.legemiddel || []).filter((x) => String(x.dato).startsWith(String(a))).sort((x, y) => String(y.dato).localeCompare(String(x.dato)));
    return `<div class="kort"><h3>🐄 Gård og husdyr</h3>
      <div class="knapperad">${Object.entries(HUSDYRTYPER).map(([k, n]) => `<label><input type="checkbox" data-gard="type" value="${k}" ${h.typer.includes(k) ? 'checked' : ''}> ${n}</label>`).join('')}</div>
      ${storfe ? `<div class="skjema to-kol"><label>Oppstalling storfe <select data-gard="oppstalling"><option value="los" ${h.oppstalling === 'los' ? 'selected' : ''}>Løsdrift (8 uker beite)</option><option value="bas" ${h.oppstalling === 'bas' ? 'selected' : ''}>Båsfjøs</option></select></label>
        <label>Beitesone (jordbruksavtalen) <select data-gard="sone"><option value="1-4" ${h.sone === '1-4' ? 'selected' : ''}>Sone 1–4 (16 uker på bås)</option><option value="5-7" ${h.sone === '5-7' ? 'selected' : ''}>Sone 5–7 (12 uker på bås)</option></select></label></div>` : ''}
      ${harDyr ? `<h4 class="undertittel">Husdyrgjødsel per år</h4>
        <div class="md-liste">${(h.gjodsel || []).map((x, i) => `<div class="md-rad"><div class="skjema to-kol"><label>Type <select data-gard-gj="type" data-i="${i}">${Object.entries(HUSDYR).map(([k, v]) => `<option value="${k}" ${k === x.type ? 'selected' : ''}>${esc(v.navn)}</option>`).join('')}</select></label><label>Tonn per år <input type="number" step="1" data-gard-gj="tonn" data-i="${i}" value="${x.tonn ?? ''}"></label></div><small><button type="button" class="knapp liten" data-krav="gj-slett" data-i="${i}">Fjern</button></small></div>`).join('')}</div>
        <div class="knapperad"><button type="button" class="knapp liten" data-krav="gj-ny">+ Legg til gjødseltype</button></div>
        <div class="skjema to-kol"><label>Lagervolum (m³) <input type="number" data-gard="lager" value="${h.lager ?? ''}"></label><label>Leid/avtalt spredeareal (daa) <input type="number" data-gard="leidSpredeareal" value="${h.leidSpredeareal ?? ''}"></label></div>
        ${hg.tonn ? `<p class="hint">${Math.round(hg.tonn)} tonn i året gir ca. ${hg.P} kg fosfor. Lagerbehov 8 måneder: ca. ${hg.lagerBehov} m³. Spredeareal ${hg.areal} daa → ${hg.perDaa ?? '–'} kg P/daa (grense ${hg.grense}).</p>` : ''}` : '<p class="hint">Kryss av for husdyrslagene på gården for å få med kravene til husdyrgjødsel, beite og legemiddeljournal.</p>'}
    </div>
    <div class="kort"><h3>📨 Søknader ${a}</h3><div class="skjema to-kol">
      ${harDyr ? `<label>Produksjonstilskudd del 1 – husdyr (frist 15. mars) <input type="date" data-sok="ptVaar" value="${esc(sok.ptVaar || '')}"></label>` : ''}
      <label>Produksjonstilskudd (frist 15. oktober) <input type="date" data-sok="pt" value="${esc(sok.pt || '')}"></label>
      <label>Regionalt miljøtilskudd (frist 15. oktober) <input type="date" data-sok="rmp" value="${esc(sok.rmp || '')}"></label>
      <label>Tilskudd til spesielle miljøtiltak (SMIL) <input type="date" data-sok="smil" value="${esc(sok.smil || '')}"></label></div>
      <p class="hint">Søknadene sendes via Landbruksdirektoratets fagsystem (Altinn). Datoen her er din dokumentasjon på når den ble sendt. <a href="${HJEMMEL.pt.url}" target="_blank" rel="noopener">Regelverk for produksjonstilskudd</a></p></div>
    ${storfe ? `<div class="kort"><h3>🌿 Beite ${a}</h3><div class="skjema to-kol"><label>Sluppet på beite <input type="date" data-beite="slipp" value="${esc(b.slipp || '')}"></label><label>Tatt inn <input type="date" data-beite="inn" value="${esc(b.inn || '')}"></label></div></div>` : ''}
    ${harDyr ? `<div class="kort"><div class="detalj-topp"><h3>💊 Legemiddeljournal ${a}</h3><label class="hint"><input type="checkbox" data-gard="ingenBehandling" ${g.ingenBehandling?.[a] ? 'checked' : ''}> Ingen behandlinger i år</label></div>
      <div class="skjema to-kol" id="lmSkjema"><label>Dato <input type="date" name="dato" value="${idag()}"></label><label>Dyr (ID eller gruppe) <input name="dyr"></label><label>Diagnose / grunn <input name="diagnose"></label><label>Legemiddel <input name="legemiddel"></label><label>Mengde og dosering <input name="mengde"></label><label>Behandlingsdager <input type="number" name="dager"></label><label>Tilbakeholdstid melk (dager) <input type="number" name="tilbakeholdMelk"></label><label>Tilbakeholdstid kjøtt (dager) <input type="number" name="tilbakeholdKjott"></label><label>Veterinær / behandler <input name="veterinar"></label></div>
      <div class="knapperad"><button type="button" class="knapp primar" data-krav="lm-ny">Lagre behandling</button><button type="button" class="knapp liten" data-krav="husdyrreg">Husdyrregisteret er ajour</button></div>
      ${lm.length ? `<div class="md-liste">${lm.map((x) => `<div class="md-rad"><b>${esc(datoTekst(x.dato))} · ${esc(x.dyr)} · ${esc(x.legemiddel)}</b><span>${esc(x.mengde)}${x.dager ? ` · ${x.dager} dager` : ''}${x.diagnose ? ` · ${esc(x.diagnose)}` : ''}</span><small>Tilbakeholdstid melk ${x.tilbakeholdMelk ?? '–'} d, kjøtt ${x.tilbakeholdKjott ?? '–'} d${x.tilbakeholdKjott ? ` (slakt tidligst ${esc(datoTekst(plussDager(x.dato, (Number(x.dager) || 1) - 1 + Number(x.tilbakeholdKjott))))})` : ''}${x.veterinar ? ` · ${esc(x.veterinar)}` : ''} <button type="button" class="knapp liten" data-krav="lm-slett" data-id="${esc(x.id)}">Slett</button></small></div>`).join('')}</div>` : ''}
      <p class="hint">Journalen oppbevares i minst 5 år og vises Mattilsynet ved tilsyn. <a href="${HJEMMEL.legemiddel.url}" target="_blank" rel="noopener">Krav til dokumentasjon</a></p></div>` : ''}`;
  }
  const plussDager = (d, n) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

  function skrivUt() {
    const S = hentPlan(); const a = aar(); const k = vurderKrav(S, a, idag()); const e = S.eiendom || {};
    const w = window.open('', '_blank'); if (!w) { melding('Nettleseren blokkerte utskriftsvinduet.'); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Krav og frister ${a}</title><style>body{font:12px/1.45 system-ui,sans-serif;max-width:1000px;margin:20px auto;padding:0 16px;color:#111}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:16px 0 6px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f3f3ef}.s{font-weight:700;white-space:nowrap}.mangler{color:#b4302f}.delvis{color:#a05a00}.ok{color:#1f6b4a}</style>
      <h1>Krav og frister ${a}</h1><div>${esc(e.navn || '')}${e.gnrbnr ? ` · gnr/bnr ${esc(e.gnrbnr)}` : ''}${e.eier ? ` · ${esc(e.eier)}` : ''} · ${new Date().toLocaleDateString('nb-NO')}</div>
      ${Object.entries(TEMA).map(([t, navn]) => { const l = k.filter((x) => x.tema === t); return l.length ? `<h2>${esc(navn)}</h2><table><thead><tr><th style="width:28%">Krav</th><th style="width:70px">Status</th><th>Dokumentasjon</th><th style="width:90px">Frist</th><th style="width:24%">Hjemmel</th></tr></thead><tbody>${l.map((x) => `<tr><td>${esc(x.navn)}</td><td class="s ${x.status}">${STATUS[x.status].navn}</td><td>${esc(x.tekst)}</td><td>${esc(x.frist || '')}</td><td>${esc(x.hjemmel.navn)}</td></tr>`).join('')}</tbody></table>` : ''; }).join('')}
      <p style="color:#555">Laget i ${esc(signatur())}. Kravene er en hjelp – sjekk gjeldende regler for din kommune og ditt fylke.</p><script>setTimeout(()=>print(),300)<\/script>`);
    w.document.close();
  }

  return {
    html: kravHtml,
    klikk(e, tegn) {
      const k = e.target.closest('[data-krav]')?.dataset.krav; if (!k || e.target.matches('input,select')) return false;
      const g = G(); const a = aar();
      if (k === 'skriv') { skrivUt(); return true; }
      if (k === 'gj-ny') g.husdyr.gjodsel.push({ type: g.husdyr.typer.includes('svin') ? 'svin' : g.husdyr.typer.includes('sau') ? 'sau' : 'storfe', tonn: null });
      if (k === 'gj-slett') g.husdyr.gjodsel.splice(Number(e.target.closest('[data-i]').dataset.i), 1);
      if (k === 'husdyrreg') { g.husdyrregisterBekreftet = { ...(g.husdyrregisterBekreftet || {}), [a]: idag() }; melding('Registrert at Husdyrregisteret er ajour.'); }
      if (k === 'lm-slett') g.legemiddel = g.legemiddel.filter((x) => x.id !== e.target.closest('[data-id]').dataset.id);
      if (k === 'lm-ny') {
        const f = document.getElementById('lmSkjema'); const v = (n) => f.querySelector(`[name="${n}"]`).value.trim();
        const x = { id: nyId('lm'), dato: v('dato'), dyr: v('dyr'), diagnose: v('diagnose'), legemiddel: v('legemiddel'), mengde: v('mengde'), dager: v('dager') ? Number(v('dager')) : null, tilbakeholdMelk: v('tilbakeholdMelk') === '' ? null : Number(v('tilbakeholdMelk')), tilbakeholdKjott: v('tilbakeholdKjott') === '' ? null : Number(v('tilbakeholdKjott')), veterinar: v('veterinar') };
        const m = [!x.dato && 'dato', !x.dyr && 'dyr', !x.legemiddel && 'legemiddel', !x.mengde && 'mengde'].filter(Boolean);
        if (m.length) { melding(`Fyll ut ${m.join(', ')}.`); return true; }
        g.legemiddel.push(x); melding('Behandlingen er lagret i legemiddeljournalen.');
      }
      lagre(tegn); return true;
    },
    endring(e, tegn) {
      const t = e.target; const g = G(); const a = aar();
      if (t.dataset.gard === 'type') { g.husdyr.typer = [...document.querySelectorAll('[data-gard="type"]:checked')].map((x) => x.value); lagre(tegn); return true; }
      if (t.dataset.gard === 'ingenBehandling') { g.ingenBehandling = { ...(g.ingenBehandling || {}), [a]: t.checked }; lagre(tegn); return true; }
      if (t.dataset.gard) { g.husdyr[t.dataset.gard] = ['lager', 'leidSpredeareal'].includes(t.dataset.gard) ? (t.value === '' ? null : Number(t.value)) : t.value; lagre(tegn); return true; }
      if (t.dataset.gardGj) { const x = g.husdyr.gjodsel[Number(t.dataset.i)]; if (x) x[t.dataset.gardGj] = t.dataset.gardGj === 'tonn' ? (t.value === '' ? null : Number(t.value)) : t.value; lagre(tegn); return true; }
      if (t.dataset.sok) { g.soknader[a] = { ...(g.soknader[a] || {}), [t.dataset.sok]: t.value || null }; lagre(tegn); return true; }
      if (t.dataset.beite) { g.beite[a] = { ...(g.beite[a] || {}), [t.dataset.beite]: t.value || null }; lagre(tegn); return true; }
      return false;
    },
  };
}
