// «Oppdrag» i Tiltak-fanen: liste og detalj for oppdrag laget av valgte tiltak, med felt og sjekkliste per
// oppdragstype, status, utfører, kart og utskrift av arbeidsordre. Logikken ligger i oppdrag.js.
import { OPPDRAGSTYPER, OPPDRAGSSTATUS, AKTIVE_STATUS, typeFor, linjer, sammendrag, fjernLinje, slettOppdrag } from './oppdrag.js';
import { KRAVPUNKTER } from './pefc.js';
import { svgKart } from './rapporter.js';
import { VEIKLASSER, VEISTIL } from './veier.js';
import { signatur } from './versjon.js';
import { fmt } from './charts.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const opsj = (liste, valgt) => liste.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(valgt ?? '') ? 'selected' : ''}>${esc(t)}</option>`).join('');
const kravNavn = (nr) => KRAVPUNKTER.find((k) => k.nr === nr)?.tittel || '';

export function initOppdrag({ hentPlan, endret, melding, okonomi, settUtfort, visBestander, uthev, tiltakNavn, startValg }) {
  let valgt = null; let filter = 'aktive';
  const S = () => hentPlan();
  const alle = () => S().oppdrag || [];
  const finn = (id) => alle().find((o) => o.id === id);
  const lagre = () => { endret({ kart: false }); tegn(); };

  function mengdeTekst(o, s) {
    const ot = typeFor(o.type);
    return [`${s.bestand} bestand`, `${fmt(s.areal, 1)} daa`, s.m3 ? `ca. ${fmt(s.m3)} m³` : null, s.antall ? `ca. ${fmt(s.antall)} ${ot.enhet}` : null].filter(Boolean).join(' · ');
  }
  function statusPille(o) { const st = OPPDRAGSSTATUS[o.status] || OPPDRAGSSTATUS.utkast; return `<span class="pille" style="--farge:${st.farge}">${st.navn}</span>`; }

  function listeHtml() {
    const liste = alle().filter((o) => filter === 'alle' || AKTIVE_STATUS.includes(o.status)).sort((a, b) => String(b.nr).localeCompare(String(a.nr), 'nb', { numeric: true }));
    const rader = liste.map((o) => {
      const s = sammendrag(S(), o, okonomi);
      return `<button type="button" class="oppdrag-rad" data-oppdrag="${o.id}">
        <span class="oppdrag-nr">${esc(o.nr)}</span>
        <span class="oppdrag-hoved"><b>${esc(o.tittel || typeFor(o.type).navn)}</b><span class="hint">${esc(typeFor(o.type).navn)}${o.utforer?.navn ? ` · ${esc(o.utforer.navn)}` : ''}</span><span class="hint">${mengdeTekst(o, s)}${o.periode?.til ? ` · frist ${esc(o.periode.til)}` : ''} · sjekkliste ${s.sjekk}/${s.sjekkTotalt}</span></span>
        ${statusPille(o)}
      </button>`;
    }).join('');
    return `<div class="kort">
      <div class="detalj-topp"><h3>Oppdrag</h3><select id="oppdragFilter" aria-label="Vis oppdrag">${opsj([['aktive', 'Aktive'], ['alle', 'Alle']], filter)}</select></div>
      <p class="hint" style="margin-top:0">Velg ett eller flere planlagte tiltak under «Tiltaksplan» med «Velg til oppdrag» og trykk «Lag oppdrag». Hver tiltakstype får sin egen oppdragstype med egne felt og egen sjekkliste. Velger du flere typer, lages ett oppdrag per type.</p>
      ${rader || '<div class="tom">Ingen oppdrag ennå.</div>'}
      <details class="ekstra" style="margin-top:10px"><summary>Oppdragstyper (${Object.keys(OPPDRAGSTYPER).length})</summary>${Object.entries(OPPDRAGSTYPER).map(([k, t]) => `<div><b>${esc(t.navn)}</b> <span class="hint">for ${esc(tiltakNavn(k))} · ${esc(t.utforer)} · ${t.felt.length} felt, ${t.sjekk.length} punkter i sjekklisten</span></div>`).join('')}</details>
    </div>`;
  }

  function feltHtml(f, verdi) {
    const navn = `${esc(f.navn)}${f.enhet ? ` <span class="hint">(${esc(f.enhet)})</span>` : ''}`;
    if (f.type === 'valg') return `<label>${navn}<select data-felt="${f.id}"><option value="">–</option>${opsj(f.valg.map((v) => [v, v]), verdi)}</select></label>`;
    return `<label>${navn}<input data-felt="${f.id}" type="${f.type === 'tall' ? 'number' : f.type === 'dato' ? 'date' : 'text'}" ${f.type === 'tall' ? 'step="any"' : ''} value="${esc(verdi ?? '')}"></label>`;
  }

  function detaljHtml(o) {
    const ot = typeFor(o.type); const s = sammendrag(S(), o, okonomi); const ls = linjer(S(), o);
    const tapt = (o.linjer || []).length - ls.length;
    return `<div class="kort oppdrag-detalj">
      <div class="detalj-topp">
        <button class="knapp liten" data-oh="tilbake" type="button">← Alle oppdrag</button>
        <div class="knapperad" style="margin:0"><button class="knapp liten" data-oh="zoom" type="button">Vis i kart</button><button class="knapp liten primar" data-oh="skriv" type="button">Skriv ut arbeidsordre</button><button class="knapp liten fare" data-oh="slett" type="button">Slett</button></div>
      </div>
      <h3 style="margin:8px 0 2px">${esc(o.nr)} · ${esc(ot.navn)} ${statusPille(o)}</h3>
      <p class="hint" style="margin:0 0 10px">${mengdeTekst(o, s)}${s.netto ? ` · ${s.netto >= 0 ? 'netto' : 'kostnad'} ca. ${fmt(Math.abs(s.netto))} kr` : ''} · opprettet ${esc(o.opprettet)}</p>
      <form class="skjema tre-kol" id="oppdragSkjema">
        <label class="hel">Tittel <input name="tittel" value="${esc(o.tittel)}"></label>
        <label>Status <select name="status">${opsj(Object.entries(OPPDRAGSSTATUS).map(([k, v]) => [k, v.navn]), o.status)}</select></label>
        <label>Oppstart <input name="fra" type="date" value="${esc(o.periode?.fra)}"></label>
        <label>Frist <input name="til" type="date" value="${esc(o.periode?.til)}"></label>
        <label>Utfører <span class="hint">(${esc(ot.utforer)})</span><input name="utforer.navn" value="${esc(o.utforer?.navn)}"></label>
        <label>Kontaktperson <input name="utforer.kontakt" value="${esc(o.utforer?.kontakt)}"></label>
        <label>Telefon <input name="utforer.telefon" type="tel" value="${esc(o.utforer?.telefon)}"></label>
        <label>E-post <input name="utforer.epost" type="email" value="${esc(o.utforer?.epost)}"></label>
        ${ot.felt.map((f) => feltHtml(f, o.felt?.[f.id])).join('')}
        <label class="hel">Merknad / instruks til utfører <textarea name="merknad" rows="3">${esc(o.merknad)}</textarea></label>
      </form>
      <h4 class="undertittel">Sjekkliste <span class="hint">${s.sjekk} av ${s.sjekkTotalt}</span></h4>
      <div class="oppdrag-sjekk">${ot.sjekk.map((k) => `<label class="avkrysning"><input type="checkbox" data-sjekk="${k.id}" ${o.sjekk?.[k.id] ? 'checked' : ''}> <span>${esc(k.tekst)}${k.pefc ? ` <span class="hint">PEFC ${k.pefc} ${esc(kravNavn(k.pefc))}</span>` : ''}</span></label>`).join('')}</div>
      <h4 class="undertittel">Tiltak i oppdraget <span class="hint">${ls.length}</span></h4>
      ${ls.map(({ bestand: b, tiltak: t }) => { const ok = okonomi({ ...t, bestand: b }); return `<div class="tiltak-rad${t.status === 'utfort' ? ' status-utfort' : ''}">
        <span class="hint">${t.aar}</span>
        <div><div class="tittel">${esc(tiltakNavn(t.type))} – bestand <a href="#" data-oh="bestand" data-b="${b.id}">${esc(b.nr)}</a>${t.status === 'utfort' ? ' <span class="hint">✓ utført</span>' : ''}</div>
        <div class="info">${fmt(b.areal, 1)} daa · ${esc(b.treslag || '')}${b.bonitet ?? ''}${ok.m3 ? ` · ca. ${fmt(ok.m3)} m³` : ''}${b.miljo ? ' · <b>miljøfigur</b>' : ''}</div></div>
        <button class="knapp liten" data-oh="fjern" data-t="${t.id}" type="button" title="Fjern fra oppdraget" aria-label="Fjern fra oppdraget">✕</button>
      </div>`; }).join('') || '<div class="tom">Ingen tiltak i oppdraget.</div>'}
      ${tapt ? `<p class="hint">${tapt} tiltak er slettet fra planen siden oppdraget ble laget.</p>` : ''}
      <div class="knapperad"><button class="knapp liten" data-oh="legg-til" type="button">+ Legg til flere ${esc(ot.kort.toLowerCase())}-tiltak</button></div>
    </div>`;
  }

  function tegn() {
    const panel = $('#oppdragPanel'); if (!panel) return;
    const o = valgt && finn(valgt);
    if (valgt && !o) valgt = null;
    panel.innerHTML = o ? detaljHtml(o) : listeHtml();
    const n = alle().filter((x) => AKTIVE_STATUS.includes(x.status)).length;
    const el = $('#oppdragAntall'); if (el) el.textContent = n ? `(${n})` : '';
    uthev(o ? linjer(S(), o).map((l) => l.bestand.id) : []);
  }

  function apne(id) { valgt = id; tegn(); const o = finn(id); if (o) visBestander(linjer(S(), o).map((l) => l.bestand.id)); }

  function settStatus(o, ny) {
    const for_ = o.status; o.status = ny;
    if (ny === 'utfort' && for_ !== 'utfort') {
      o.utfortDato = new Date().toISOString().slice(0, 10);
      const aapne = linjer(S(), o).filter((l) => l.tiltak.status !== 'utfort');
      if (aapne.length && confirm(`Markere ${aapne.length} tiltak i oppdraget som utført?`)) for (const l of aapne) settUtfort(l.bestand, l.tiltak, true);
    }
  }

  // ---------- utskrift ----------
  function skrivUt(o) {
    const plan = S(); const ot = typeFor(o.type); const s = sammendrag(plan, o, okonomi); const ls = linjer(plan, o);
    const ider = new Set(ls.map((l) => l.bestand.id));
    const vr = plan.veier || {};
    const ekstra = [
      ...(vr.veier || []).filter((v) => v.geometri).map((v) => ({ geometri: v.geometri, farge: (VEIKLASSER[v.klasse] || VEIKLASSER[0]).bilvei ? '#555555' : VEISTIL.traktorvei.farge })),
      ...(vr.stier || []).filter((x) => x.geometri).map((x) => ({ geometri: x.geometri, farge: VEISTIL.sti.farge })),
      ...(vr.punkter || []).filter((p) => p.type === 'velteplass' && p.geometri).map((p) => ({ geometri: p.geometri, farge: '#2a78d6' })),
    ];
    const kart = svgKart(plan, (b) => (ider.has(b.id) ? '#f39c4a' : '#eef0ea'), { bredde: 960, hoyde: 600, ekstra, markslag: false });
    const felt = ot.felt.filter((f) => o.felt?.[f.id] !== undefined && o.felt[f.id] !== '').map((f) => `<tr><th>${esc(f.navn)}</th><td>${esc(o.felt[f.id])}${f.enhet ? ` ${esc(f.enhet)}` : ''}</td></tr>`).join('');
    const tittel = `Arbeidsordre ${o.nr}`;
    const kropp = `<h1>${esc(tittel)} – ${esc(ot.navn)}</h1>
      <p class="hint">${esc(plan.eiendom?.navn || '')} · status: ${esc(OPPDRAGSSTATUS[o.status]?.navn)} · skrevet ut ${new Date().toLocaleDateString('nb-NO')}</p>
      <table><tbody>
        <tr><th>Utfører</th><td>${esc(o.utforer?.navn || '')}${o.utforer?.kontakt ? `, ${esc(o.utforer.kontakt)}` : ''}${o.utforer?.telefon ? `, tlf. ${esc(o.utforer.telefon)}` : ''}${o.utforer?.epost ? `, ${esc(o.utforer.epost)}` : ''}</td></tr>
        <tr><th>Periode</th><td>${esc(o.periode?.fra || '–')} til ${esc(o.periode?.til || '–')}</td></tr>
        <tr><th>Omfang</th><td>${mengdeTekst(o, s)}</td></tr>
        ${felt}
      </tbody></table>
      ${o.merknad ? `<h2>Instruks</h2><p>${esc(o.merknad).replace(/\n/g, '<br>')}</p>` : ''}
      <h2>Kart</h2>${kart}<p class="hint"><span class="leg" style="background:#f39c4a"></span>bestand i oppdraget <span class="leg" style="background:#555"></span>bilvei <span class="leg" style="background:${VEISTIL.traktorvei.farge}"></span>traktorvei <span class="leg" style="background:${VEISTIL.sti.farge}"></span>sti <span class="leg" style="background:#2a78d6"></span>velteplass · rød stiplet linje: eiendomsgrense</p>
      <h2>Bestand</h2>
      <table><thead><tr><th>Bestand</th><th>Tiltak</th><th>År</th><th class="t">Daa</th><th>Treslag/bonitet</th><th class="t">Alder</th><th class="t">m³/daa</th><th class="t">Ca. m³</th><th>Merknad</th></tr></thead><tbody>
      ${ls.map(({ bestand: b, tiltak: t }) => { const ok = okonomi({ ...t, bestand: b }); return `<tr><td>${esc(b.nr)}</td><td>${esc(tiltakNavn(t.type))}</td><td>${t.aar}</td><td class="t">${fmt(b.areal, 1)}</td><td>${esc(b.treslag || '')}${b.bonitet ?? ''}</td><td class="t">${b.alder ?? ''}</td><td class="t">${b.volumDaa != null ? fmt(b.volumDaa, 1) : ''}</td><td class="t">${ok.m3 ? fmt(ok.m3) : ''}</td><td>${b.miljo ? '<b>Miljøfigur – hensyn</b> ' : ''}${esc(t.kommentar || '')}</td></tr>`; }).join('')}
      <tr><th colspan="3">Sum</th><th class="t">${fmt(s.areal, 1)}</th><th colspan="3"></th><th class="t">${s.m3 ? fmt(s.m3) : ''}</th><th></th></tr></tbody></table>
      <h2>Sjekkliste</h2>
      <table><tbody>${ot.sjekk.map((k) => `<tr><td style="width:24px">${o.sjekk?.[k.id] ? '☑' : '☐'}</td><td>${esc(k.tekst)}${k.pefc ? ` <span class="hint">(PEFC ${k.pefc} ${esc(kravNavn(k.pefc))})</span>` : ''}</td></tr>`).join('')}</tbody></table>
      <h2>Kvittering</h2>
      <table><tbody><tr><th style="width:50%">Oppdragsgiver</th><th>Utfører</th></tr><tr><td style="height:48px">Dato / signatur</td><td>Dato / signatur</td></tr>
      <tr><th>Utført dato</th><td></td></tr><tr><th>Utført mengde</th><td></td></tr><tr><th>Avvik / merknader</th><td style="height:60px"></td></tr></tbody></table>`;
    const w = window.open('', '_blank'); if (!w) { melding('Nettleseren blokkerte utskriftsvinduet.'); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(tittel)}</title><style>body{font:12px/1.45 system-ui,sans-serif;max-width:1000px;margin:20px auto;padding:0 16px;color:#111}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:18px 0 6px}table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #bbb;padding:3px 5px;text-align:left;vertical-align:top}th{background:#f1f1ee}td.t,th.t{text-align:right}.hint{color:#555}.leg{display:inline-block;width:10px;height:10px;border:1px solid #333;margin:0 4px 0 10px}svg{width:100%;height:auto;border:1px solid #ccc}.r-knr{font:600 10px system-ui;fill:#1b1c19;text-anchor:middle}.r-skala{font:10px system-ui;fill:#333}@media print{h2{break-after:avoid}tr{break-inside:avoid}}</style>${kropp}<p class="hint" style="margin-top:18px">Laget med ${esc(signatur())}.</p><script>setTimeout(()=>print(),400)<\/script>`);
    w.document.close();
  }

  // ---------- hendelser ----------
  const panel = $('#oppdragPanel');
  panel.addEventListener('click', (e) => {
    const rad = e.target.closest('[data-oppdrag]');
    if (rad) { apne(rad.dataset.oppdrag); return; }
    const h = e.target.closest('[data-oh]'); if (!h) return;
    const o = finn(valgt);
    if (h.dataset.oh === 'tilbake') { valgt = null; tegn(); return; }
    if (!o) return;
    if (h.dataset.oh === 'zoom') visBestander(linjer(S(), o).map((l) => l.bestand.id));
    if (h.dataset.oh === 'skriv') skrivUt(o);
    if (h.dataset.oh === 'bestand') { e.preventDefault(); visBestander([h.dataset.b]); }
    if (h.dataset.oh === 'fjern') { fjernLinje(S(), o, h.dataset.t); lagre(); }
    if (h.dataset.oh === 'legg-til') startValg(o);
    if (h.dataset.oh === 'slett' && confirm(`Slette oppdrag ${o.nr}? Tiltakene blir liggende i tiltaksplanen.`)) { slettOppdrag(S(), o); valgt = null; lagre(); melding(`Oppdrag ${o.nr} er slettet.`); }
  });
  panel.addEventListener('change', (e) => {
    const f = e.target;
    if (f.id === 'oppdragFilter') { filter = f.value; tegn(); return; }
    const o = finn(valgt); if (!o) return;
    if (f.dataset.sjekk) { o.sjekk = { ...o.sjekk, [f.dataset.sjekk]: f.checked }; lagre(); return; }
    if (f.dataset.felt) { const def = typeFor(o.type).felt.find((x) => x.id === f.dataset.felt); o.felt = { ...o.felt, [f.dataset.felt]: def?.type === 'tall' ? (f.value === '' ? '' : Number(f.value)) : f.value }; lagre(); return; }
    if (!f.name) return;
    if (f.name === 'status') settStatus(o, f.value);
    else if (f.name === 'fra' || f.name === 'til') o.periode = { ...o.periode, [f.name]: f.value };
    else if (f.name.startsWith('utforer.')) o.utforer = { ...o.utforer, [f.name.slice(8)]: f.value };
    else o[f.name] = f.value;
    lagre();
  });

  return { tegn, apne, lukk() { valgt = null; uthev([]); }, valgt: () => valgt };
}
