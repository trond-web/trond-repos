// Gjennomgang av ajourføring fra hogstmaskindata (ajourforing.js): ett kort per bestand med valg for grenser
// (del / hele / ikke endre), egenskaper før → etter og tiltak (utført, fjernes, nye) med avkrysning. Endringene vises i
// kartet før de brukes, og den siste ajourføringen kan angres. Brukes fra Data-fanen og fra oppdragets Maskin-fane:
// verten tar med html(kontekst) i sin visning og sender tegn() som oppdaterer visningen.
import * as AJ from './ajourforing.js';
import { TILTAKSTYPER, HK_ROMERTALL } from './model.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tall = (v, d = 0) => (v == null || v === '' ? '–' : Number(v).toLocaleString('nb-NO', { maximumFractionDigits: d }));
const FELT = { hogstklasse: ['Hogstklasse', (v) => (v ? HK_ROMERTALL[v] || v : '–')], alder: ['Alder', (v) => tall(v)], volumDaa: ['Volum', (v) => (v == null ? '–' : `${tall(v, 1)} m³/daa`)], treantall: ['Treantall', (v) => (v == null ? '–' : `${tall(v)} per daa`)], hoyde: ['Høyde', (v) => (v == null ? '–' : `${tall(v, 1)} m`)], tetthetsklasse: ['Tetthet', (v) => v || '–'] };
const HANDLING = { utfort: ['✓', 'Utført'], registrer: ['✓', 'Registreres'], fjern: ['✕', 'Fjernes'], ny: ['＋', 'Nytt'] };

export function lagAjourforingUi({ hentPlan, endret, melding, visKart, lastPC, visBestander = () => {}, iAar = new Date().getFullYear() }) {
  const S = () => hentPlan();
  let aktiv = null; // { kontekst, res, stammer, kilde, navn, spor, tegn, etterBruk, apen:Set }
  let arbeider = '';

  function kartFor({ zoom = null } = {}) {
    if (!aktiv) return;
    const gj = AJ.kartGeojson([{ id: 'ny', stammer: AJ.lagreKart({ hogstdata: [] }, { id: 'x', navn: aktiv.navn, stammer: aktiv.stammer, hogd: aktiv.res.hogd, spor: aktiv.spor }).stammer, hogd: aktiv.res.hogd, spor: aktiv.spor, navn: aktiv.navn }], { forslag: aktiv.res });
    visKart(gj, { zoom: zoom || aktiv.res.hogd });
  }

  async function start(stammer, { kontekst, kilde = 'HPR', navn = 'Hogstmaskindata', spor = [], tegn, etterBruk = () => {} }) {
    arbeider = 'Beregner hogd flate og endringer …'; aktiv = { kontekst, res: null, stammer, kilde, navn, spor, tegn, etterBruk, apen: new Set() }; tegn();
    try {
      const PC = await lastPC(); if (!PC) throw new Error('Fikk ikke lastet geometribiblioteket. Sjekk nettet og prøv igjen.');
      if (!stammer.some((s) => s.pos)) throw new Error('Stammene i fila har ingen posisjon. Ajourføring av grenser krever koordinater (hpr-fila fra hogstmaskinen).');
      const res = AJ.lagForslag(S(), stammer, PC, { iAar, kilde });
      if (!res.forslag.length && !res.utenfor) throw new Error('Ingen av stammene ligger i bestandene i planen.');
      aktiv.res = res; aktiv.apen = new Set(res.forslag.slice(0, 1).map((f) => f.id));
      arbeider = ''; tegn(); kartFor();
    } catch (e) { arbeider = ''; aktiv = null; tegn(); melding(e.message || 'Klarte ikke å lage endringsforslag.', 'feil'); }
  }

  function bestandKort(f) {
    const apen = aktiv.apen.has(f.id); const eg = AJ.egenskaper(S(), f); const ti = AJ.tiltakFor(f);
    const valgte = f.valg === 'ingen' ? 0 : (f.egenskaperValgt ? eg.length : 0) + ti.filter((t) => t.valgt).length + (f.valg === 'del' ? 1 : 0);
    const valg = [['del', `Del bestandet – hogd del (${tall(f.arealDel, 1)} daa) blir nytt bestand`, !f.kanDele], ['hele', `Oppdater hele bestandet (${tall(f.arealBestand, 1)} daa)`, false], ['ingen', 'Ikke endre dette bestandet', false]];
    return `<div class="aj-kort ${f.valg === 'ingen' ? 'av' : ''}" data-aj-kort="${f.id}">
      <button type="button" class="aj-hode" data-aj="apne" data-id="${f.id}" aria-expanded="${apen}">
        <span class="aj-type aj-${f.type}">${f.type === 'flatehogst' ? 'Flatehogst' : 'Tynning'}</span>
        <span><b>Bestand ${esc(f.nr)}</b> <span class="hint">${esc(AJ.oppsummer(f))}</span></span>
        <span class="aj-antall">${f.valg === 'ingen' ? 'ikke endret' : `${valgte} endringer`}</span><span aria-hidden="true">${apen ? '▾' : '▸'}</span>
      </button>
      ${apen ? `<div class="aj-innhold">
        <div class="aj-valg" role="radiogroup" aria-label="Grenser for bestand ${esc(f.nr)}">${valg.map(([v, t, av]) => `<label class="${av ? 'av' : ''}"><input type="radio" name="aj-${f.id}" value="${v}" data-aj-valg="${f.id}" ${f.valg === v ? 'checked' : ''} ${av ? 'disabled' : ''}> ${esc(t)}${v === f.anbefalt ? ' <span class="aj-anb">anbefalt</span>' : ''}${av ? ' <span class="hint">(delen eller resten blir under 1 daa)</span>' : ''}</label>`).join('')}</div>
        ${f.valg === 'ingen' ? '' : `
          <h5>Egenskaper ${f.valg === 'del' ? 'for den hogde delen' : ''}</h5>
          ${eg.length ? `<label class="avkrysning"><input type="checkbox" data-aj-e="${f.id}" ${f.egenskaperValgt ? 'checked' : ''}> Oppdater egenskapene</label>
          <table class="aj-tabell"><tbody>${eg.map((x) => `<tr><td>${esc(FELT[x.felt]?.[0] || x.felt)}</td><td class="t">${esc((FELT[x.felt]?.[1] || String)(x.for))}</td><td>→</td><td class="t"><b>${esc((FELT[x.felt]?.[1] || String)(x.etter))}</b></td></tr>`).join('')}</tbody></table>` : '<p class="hint">Ingen egenskaper endres.</p>'}
          <h5>Tiltak</h5>
          ${ti.length ? ti.map((t, i) => `<label class="avkrysning aj-tiltak aj-${t.handling}"><input type="checkbox" data-aj-t="${f.id}" data-i="${f.tiltak.indexOf(t)}" ${t.valgt ? 'checked' : ''}> <span class="aj-merke" title="${HANDLING[t.handling][1]}">${HANDLING[t.handling][0]}</span> <span>${esc(t.tekst)}${t.kommentar && t.handling === 'ny' ? `<br><span class="hint">${esc(t.kommentar)}</span>` : ''}</span></label>`).join('') : '<p class="hint">Ingen tiltaksendringer.</p>'}
          ${f.valg === 'del' ? `<p class="hint">Resten av bestand ${esc(f.nr)} (${tall(f.arealRest, 1)} daa) beholder egenskapene og de planlagte tiltakene.</p>` : ''}`}
        <div class="knapperad"><button type="button" class="knapp liten" data-aj="vis" data-id="${f.id}">🔍 Vis i kartet</button></div>
      </div>` : ''}
    </div>`;
  }

  function html(kontekst) {
    if (!aktiv || aktiv.kontekst !== kontekst) return '';
    if (arbeider) return `<div class="aj"><p class="hs-arbeider">⏳ ${esc(arbeider)}</p></div>`;
    const r = aktiv.res; if (!r) return '';
    const n = r.forslag.filter((f) => f.valg !== 'ingen').length + (r.utenfor?.valgt ? 1 : 0);
    return `<div class="aj">
      <h4 class="undertittel" style="margin-top:0">🔄 Ajourfør skogbruksplanen</h4>
      <p class="hint" style="margin-top:0">${tall(r.stammer)} stammer · ${tall(r.m3)} m³ · hogd flate ${tall(r.hogdAreal, 1)} daa · ${r.forslag.length} bestand berørt. Gå gjennom forslagene, velg hva som skal endres, og trykk <b>Bruk valgte endringer</b>. Ingenting endres før det – og ajourføringen kan angres.</p>
      <p class="aj-leg"><span><i class="aj-l-hogd"></i>hogd flate</span><span><i class="aj-l-ny"></i>ny bestandsgrense</span><span><i class="aj-l-st" style="background:#1f6b4a"></i>gran</span><span><i class="aj-l-st" style="background:#c98500"></i>furu</span><span><i class="aj-l-st" style="background:#8fbf3f"></i>lauv</span></p>
      ${r.forslag.map(bestandKort).join('')}
      ${r.utenfor ? `<div class="aj-kort"><label class="avkrysning" style="padding:10px 12px"><input type="checkbox" data-aj="utenfor" ${r.utenfor.valgt ? 'checked' : ''}> <span><b>Hogd flate utenfor bestandene</b> (${tall(r.utenfor.areal, 1)} daa, ${tall(r.utenfor.m3)} m³) – lag nytt bestand i hogstklasse I<br><span class="hint">Kan være naboeiendom, vei eller en kant som ikke er med i planen. Kontroller før du krysser av.</span></span></label></div>` : ''}
      ${r.utenforM3 && !r.utenfor ? `<p class="hint">${tall(r.utenforM3)} m³ ble hogd utenfor bestandene (små kanter) og er ikke med.</p>` : ''}
      <div class="knapperad aj-knapper"><button type="button" class="knapp primar" data-aj="bruk" ${n ? '' : 'disabled'}>✓ Bruk valgte endringer (${n} bestand)</button><button type="button" class="knapp" data-aj="avbryt">Avbryt</button></div>
    </div>`;
  }

  function bruk() {
    const r = aktiv.res; const plan = S();
    const post = AJ.anvend(plan, r, { idag: new Date().toISOString().slice(0, 10) });
    AJ.lagreKart(plan, { id: post.id, navn: aktiv.navn, stammer: aktiv.stammer, hogd: r.hogd, spor: aktiv.spor, dato: post.dato });
    const etter = aktiv.etterBruk; const tegn = aktiv.tegn; aktiv = null;
    etter(post); endret({ kart: true }); tegn();
    visKart(AJ.kartGeojson((plan.hogstdata || []).slice(-1)), { zoom: r.hogd });
    melding(`Planen er ajourført: ${post.logg.length} endringer. Du kan angre under Data › Ajourføring.`);
  }

  // Hendelser (delegert på dokumentet, så de virker uansett hvor verten tegner kortet).
  document.addEventListener('click', (e) => {
    const k = e.target.closest('[data-aj]'); if (!k || !aktiv?.res) return; const h = k.dataset.aj; const f = aktiv.res.forslag.find((x) => x.id === k.dataset.id);
    if (h === 'utenfor') return; // håndteres i change
    e.preventDefault();
    if (h === 'apne' && f) { if (aktiv.apen.has(f.id)) aktiv.apen.delete(f.id); else aktiv.apen.add(f.id); aktiv.tegn(); }
    if (h === 'vis' && f) { kartFor({ zoom: f.geo.del || f.geo.rest }); visBestander([f.bestandId]); }
    if (h === 'bruk') bruk();
    if (h === 'avbryt') { const t = aktiv.tegn; aktiv = null; visKart(null); t(); }
  });
  document.addEventListener('change', (e) => {
    if (!aktiv?.res) return; const t = e.target; const r = aktiv.res;
    if (t.dataset.ajValg) { const f = r.forslag.find((x) => x.id === t.dataset.ajValg); f.valg = t.value; aktiv.tegn(); kartFor({ zoom: f.geo.del || f.geo.rest }); return; }
    if (t.dataset.ajE) { r.forslag.find((x) => x.id === t.dataset.ajE).egenskaperValgt = t.checked; aktiv.tegn(); return; }
    if (t.dataset.ajT) { r.forslag.find((x) => x.id === t.dataset.ajT).tiltak[Number(t.dataset.i)].valgt = t.checked; aktiv.tegn(); return; }
    if (t.dataset.aj === 'utenfor' && r.utenfor) { r.utenfor.valgt = t.checked; aktiv.tegn(); kartFor({ zoom: r.utenfor.geo }); }
  });

  // Tidligere ajourføringer (med angre for den siste) og kartlag.
  function historikkHtml() {
    const plan = S(); const liste = plan.ajourforinger || []; const hd = plan.hogstdata || [];
    if (!liste.length && !hd.length) return '';
    return `<h5>Tidligere ajourføringer</h5>
      ${liste.slice().reverse().map((p, i) => `<details class="aj-hist"><summary>${esc(p.dato)} · ${esc(p.kilde)} · ${tall(p.m3)} m³ · ${p.logg.length} endringer${i === 0 ? ' <button type="button" class="knapp liten" data-aj-angre="' + esc(p.id) + '">↶ Angre</button>' : ''}</summary><ul class="hint">${p.logg.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>`).join('')}
      ${hd.length ? `<div class="knapperad"><button type="button" class="knapp liten" data-aj-kart>🗺 Vis hogstmaskindata i kartet (${hd.length})</button><button type="button" class="knapp liten" data-aj-skjul>Skjul</button></div>` : ''}`;
  }
  function angre(id) {
    if (!confirm('Angre den siste ajourføringen? Bestandene får tilbake grenser, egenskaper og tiltak slik de var før, og nye bestand fjernes. Endringer du har gjort i de samme bestandene etterpå, går tapt.')) return false;
    const plan = S(); const post = (plan.ajourforinger || []).find((x) => x.id === id);
    if (!AJ.angre(plan, id)) { melding('Bare den siste ajourføringen kan angres.', 'feil'); return false; }
    plan.hogstdata = (plan.hogstdata || []).filter((x) => x.id !== post?.id); visKart(null);
    endret({ kart: true }); melding('Ajourføringen er angret.'); return true;
  }
  const visLagret = () => { const hd = S().hogstdata || []; if (hd.length) visKart(AJ.kartGeojson(hd), { zoom: hd.at(-1).hogd }); };
  return { start, html, aktiv: (k) => !!aktiv && aktiv.kontekst === k, historikkHtml, angre, visLagret, skjul: () => visKart(null) };
}
