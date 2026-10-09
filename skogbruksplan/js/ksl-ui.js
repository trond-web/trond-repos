// Fanen «KSL»: egenrevisjon etter KSL-standarden med automatisk dokumentasjon fra planen, avvik, periodiske
// kontroller med frister, dokumentarkiv (filer lagres lokalt i nettleseren) og utskrift av KSL-mappe.
import {
  KSL_KAPITLER, KSL_KILDER, SVAR, KONTROLLTYPER, DOKUMENTTYPER, sikreKsl, revisjon, settSvar, vurdering, oppsummering,
  kontrollStatus, kslVarsler, fullfor, sporsmal, leggTilMnd,
} from './ksl.js';
import { lagreVerdi, hentVerdi } from './store.js';
import { signatur } from './versjon.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const opsj = (liste, valgt) => liste.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(valgt ?? '') ? 'selected' : ''}>${esc(t)}</option>`).join('');
const idag = () => new Date().toISOString().slice(0, 10);
const MAKS_FIL = 15 * 1024 * 1024;
const STATUS_K = { ok: { navn: 'OK', farge: '#0ca30c' }, snart: { navn: 'Snart', farge: '#fab219' }, forfalt: { navn: 'Forfalt', farge: '#d03b3b' }, mangler: { navn: 'Ikke registrert', farge: '#8a8a85' } };
const BEVIS = { ok: '✓', delvis: '◐', mangler: '✕' };

export function initKsl({ hentPlan, endret, melding, nyId, iAar, visFane }) {
  let under = 'oversikt'; let aar = iAar; let filter = 'alle'; let dokForvalg = null;
  const S = () => hentPlan();
  const K = () => sikreKsl(S());
  const lagre = () => { endret({ kart: false }); tegn(); };

  // ---------- oversikt ----------
  function oversiktHtml() {
    const o = oppsummering(S(), aar, idag()); const ksl = K();
    const dokumentert = o.dokKrav - o.dokMangler.filter((q) => q.svar !== 'ia').length;
    const kpi = (verdi, etikett, under_) => `<div class="kpi"><div class="verdi">${verdi}</div><div class="etikett">${etikett}</div><div class="under">${under_}</div></div>`;
    const varsler = kslVarsler(S(), aar, idag());
    return `<div class="kpi-rad">
        ${kpi(`${o.besvart}/${o.totalt}`, `egenrevisjon ${aar}`, o.ferdig ? `fullført ${esc(o.revisjon.dato)}` : o.sisteFerdig ? `forrige ${esc(o.sisteFerdig.dato)}` : 'ikke fullført')}
        ${kpi(`${dokumentert}/${o.dokKrav}`, 'punkter med dokumentasjonskrav', o.dokMangler.length ? `${o.dokMangler.length} mangler dokumentasjon` : 'alle dokumentert')}
        ${kpi(o.apneAvvik.length, 'åpne avvik', o.forfalteAvvik.length ? `⚠ ${o.forfalteAvvik.length} har passert fristen` : 'ingen forfalte')}
        ${kpi(o.kontrollerForfalt.length, 'forfalte kontroller', o.kontrollerSnart.length ? `${o.kontrollerSnart.length} forfaller snart` : 'periodiske kontroller')}
      </div>
      ${varsler.length ? `<div class="kort">${varsler.map((v) => `<div class="ksl-varsel ${v.nivaa}"><b>${esc(v.tittel)}</b><span class="hint">${esc(v.tekst)}</span></div>`).join('')}</div>` : ''}
      <div class="kort">
        <h3>KSL for gården</h3>
        <p class="hint">KSL (Kvalitetssystem i landbruket) krever årlig egenrevisjon etter sjekklistene i KSL-standarden, og at dokumentasjonen kan vises fram for KSL-revisor og myndigheter. Her samles egenrevisjonen, avvik, kontroller med frister og dokumentene. Dokumentasjon som allerede finnes i planen, vises automatisk: gjødslingsplan, jordprøver, gjødseljournal, sprøytejournal, IPV og kulturminner.</p>
        <label>Ansvarlig for KSL og HMS <input id="kslAnsvarlig" value="${esc(ksl.ansvarlig)}" placeholder="Navn"></label>
        <h4 class="undertittel">Sjekklister som gjelder gården</h4>
        <div class="ksl-kapitler">${KSL_KAPITLER.map((k) => `<label class="avkrysning"><input type="checkbox" data-ksl-kap="${k.nr}" ${ksl.kapitler.includes(k.nr) ? 'checked' : ''} ${k.nr === 1 || k.nr === 10 ? 'disabled' : ''}> <span><b>${k.nr} ${esc(k.navn)}</b> <span class="hint">versjon ${esc(k.versjon)} · ${k.sporsmal.length} spørsmål, ${k.sporsmal.filter((q) => q.dok).length} med dokumentasjonskrav</span></span></label>`).join('')}</div>
        <p class="hint">Kapittel 1 og 10 gjelder alle gårder. Husdyr-, potet- og hagebrukskapitlene finnes på ksl.no og er ikke med her.</p>
        <div class="knapperad"><button class="knapp primar" type="button" data-ksl-gaa="revisjon">Gå til egenrevisjon ${aar}</button><button class="knapp" type="button" data-ksl-h="skriv">Skriv ut KSL-mappe</button></div>
        <p class="fotnote">Kilder: <a href="${KSL_KILDER.standard.url}" target="_blank" rel="noopener">${esc(KSL_KILDER.standard.navn)}</a>. Egenrevisjonen registreres i tillegg på ksl.no.</p>
      </div>`;
  }

  // ---------- egenrevisjon ----------
  function sporsmalHtml(q) {
    const knapp = (v) => `<button type="button" class="ksl-svar-knapp ${v}" data-ksl-svar="${v}" aria-pressed="${q.svar === v}">${SVAR[v]}</button>`;
    const b = q.bevis;
    return `<div class="ksl-q ${q.svar ? `svar-${q.svar}` : ''}" data-nr="${esc(q.nr)}">
      <div class="ksl-q-topp"><span class="ksl-nr">${esc(q.nr)}</span><span>${esc(q.tekst)}${q.dok ? ' <span class="ksl-dok" title="Spørsmålet krever dokumentasjon">Dokumentasjon</span>' : ''}</span></div>
      ${b ? `<div class="ksl-bevis ${b.status}"><span>${BEVIS[b.status]} ${esc(b.tekst)}</span>${b.fane ? ` <a href="#" data-ksl-gaa="${esc(b.fane)}">Åpne</a>` : ''}</div>` : ''}
      ${q.dokumenter.length ? `<div class="ksl-doker">${q.dokumenter.map((d) => `<a href="#" data-ksl-dok="${d.id}">📎 ${esc(d.navn)}</a>`).join(' ')}</div>` : ''}
      ${q.krav?.length ? `<details class="ksl-krav"><summary>Hva kreves</summary><ul>${q.krav.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></details>` : ''}
      <div class="ksl-svar">${['ja', 'nei', 'ia'].map(knapp).join('')}${q.dok && !q.dokumentert ? '<button type="button" class="knapp liten" data-ksl-h="ny-dok">+ Dokument</button>' : ''}</div>
      <input class="ksl-kommentar" data-ksl-kommentar placeholder="Kommentar (valgfritt)" value="${esc(q.kommentar)}">
    </div>`;
  }
  function revisjonHtml() {
    const v = vurdering(S(), aar, idag()); const o = oppsummering(S(), aar, idag()); const r = revisjon(K(), aar);
    const vis = v.filter((q) => filter === 'alle' || (filter === 'ubesvart' && !q.svar) || (filter === 'dok' && q.dok) || (filter === 'nei' && q.svar === 'nei') || (filter === 'mangler' && !q.dokumentert));
    const aarene = [...new Set([iAar, iAar - 1, ...K().revisjoner.map((x) => x.aar)])].sort((a, b) => b - a);
    let html = `<div class="kort"><div class="verktoyrad" style="margin:0">
        <label>År <select id="kslAar">${opsj(aarene.map((a) => [a, a]), aar)}</select></label>
        <label>Vis <select id="kslFilter">${opsj([['alle', 'Alle spørsmål'], ['ubesvart', 'Ubesvarte'], ['dok', 'Med dokumentasjonskrav'], ['mangler', 'Mangler dokumentasjon'], ['nei', 'Besvart nei']], filter)}</select></label>
        <span class="hint">${o.besvart} av ${o.totalt} besvart${o.ferdig ? ` · fullført ${esc(r.dato)} av ${esc(r.utfortAv)}` : ''}</span></div>
        <div class="ksl-fremdrift"><span style="width:${o.totalt ? Math.round((o.besvart / o.totalt) * 100) : 0}%"></span></div></div>`;
    for (const k of KSL_KAPITLER.filter((x) => K().kapitler.includes(x.nr))) {
      const kq = vis.filter((q) => q.kapittel === k.nr); if (!kq.length) continue;
      html += `<h3 class="ksl-kap">${k.nr} ${esc(k.navn)} <span class="hint">versjon ${esc(k.versjon)}</span></h3>`;
      for (const s of k.seksjoner) {
        const sq = kq.filter((q) => q.nr.startsWith(`${s.nr}.`)); if (!sq.length) continue;
        const besvart = sq.filter((q) => q.svar).length;
        html += `<details class="ksl-seksjon" ${besvart < sq.length || filter !== 'alle' ? 'open' : ''}><summary><b>${esc(s.nr)} ${esc(s.navn)}</b> <span class="hint">${besvart}/${sq.length}</span></summary>${sq.map(sporsmalHtml).join('')}</details>`;
      }
    }
    if (!vis.length) html += '<div class="tom">Ingen spørsmål i utvalget.</div>';
    html += `<div class="kort"><h3>Fullfør egenrevisjonen ${aar}</h3>
      <div class="skjema tre-kol"><label>Dato <input type="date" id="kslFerdigDato" value="${esc(r?.dato || idag())}"></label><label>Utført av <input id="kslFerdigAv" value="${esc(r?.utfortAv || K().ansvarlig)}"></label></div>
      <div class="knapperad"><button class="knapp primar" type="button" data-ksl-h="fullfor">${o.ferdig ? 'Oppdater' : 'Fullfør egenrevisjon'}</button></div>
      <p class="hint">Alle spørsmål må være besvart. «Nei» gir et avvik som følges opp under Avvik. Husk å registrere egenrevisjonen på ksl.no.</p></div>`;
    return html;
  }

  // ---------- avvik ----------
  function avvikHtml() {
    const liste = K().avvik.slice().sort((a, b) => (a.lukket ? 1 : 0) - (b.lukket ? 1 : 0) || String(a.frist || '').localeCompare(String(b.frist || '')));
    const rad = (a) => `<div class="kort ksl-avvik ${a.lukket ? 'lukket' : a.frist && a.frist < idag() ? 'forfalt' : ''}" data-avvik="${a.id}">
      <div class="detalj-topp"><b>${a.ksl ? `KSL ${esc(a.ksl)}` : 'Avvik'}${a.lukket ? ` · lukket ${esc(a.lukket)}` : a.frist && a.frist < idag() ? ' · ⚠ frist passert' : ''}</b><span class="hint">${esc(a.kilde || '')} · ${esc(a.opprettet)}</span></div>
      <div class="skjema tre-kol">
        <label class="hel">Avvik <textarea data-af="beskrivelse" rows="2">${esc(a.beskrivelse)}</textarea></label>
        <label class="hel">Tiltak <textarea data-af="tiltak" rows="2">${esc(a.tiltak)}</textarea></label>
        <label>Ansvarlig <input data-af="ansvarlig" value="${esc(a.ansvarlig)}"></label>
        <label>Frist <input type="date" data-af="frist" value="${esc(a.frist)}"></label>
        <label class="avkrysning" style="flex-direction:row;align-items:center;margin-top:18px"><input type="checkbox" data-af="lukket" ${a.lukket ? 'checked' : ''}> Lukket</label>
      </div>
      <div class="knapperad" style="margin:0"><button class="knapp liten fare" type="button" data-ksl-h="slett-avvik">Slett</button></div>
    </div>`;
    return `<div class="kort"><div class="detalj-topp"><h3>Avvik</h3><button class="knapp liten primar" type="button" data-ksl-h="nytt-avvik">+ Nytt avvik</button></div>
      <p class="hint" style="margin:0">Avvik fra egenrevisjon, vernerunde, uønskede hendelser eller revisjon. Dokumenter tiltak, ansvarlig og frist, og lukk avviket når det er utbedret (KSL 10.1.2).</p></div>
      ${liste.map(rad).join('') || '<div class="tom">Ingen avvik registrert.</div>'}`;
  }

  // ---------- kontroller ----------
  function kontrollerHtml() {
    const st = kontrollStatus(K(), idag());
    return `<div class="kort"><h3>Periodiske kontroller</h3>
      <p class="hint">Siste kontroll og neste frist. Registrer kontroller under, så følger appen opp fristene og bruker dem som dokumentasjon i egenrevisjonen.</p>
      <div class="tabell-wrap"><table class="tabell"><thead><tr><th>Kontroll</th><th>Siste</th><th>Neste frist</th><th>Status</th></tr></thead><tbody>
      ${st.map((k) => `<tr><td>${esc(k.navn)}${k.ksl.length ? ` <span class="hint">KSL ${k.ksl.join(', ')}</span>` : ''}${k.hint ? `<br><span class="hint">${esc(k.hint)}</span>` : ''}</td><td>${esc(k.siste?.dato || '–')}</td><td>${esc(k.neste || (k.siste ? 'ingen fast frist' : '–'))}</td><td><span class="pille" style="--farge:${STATUS_K[k.status].farge}">${STATUS_K[k.status].navn}</span></td></tr>`).join('')}
      </tbody></table></div></div>
      <div class="kort"><h3>Registrer kontroll</h3>
      <form class="skjema tre-kol" id="kslKontrollSkjema">
        <label>Kontroll <select name="type">${opsj(Object.entries(KONTROLLTYPER).map(([k, t]) => [k, t.navn]))}</select></label>
        <label>Dato <input type="date" name="dato" value="${idag()}" required></label>
        <label>Utført av <input name="utfortAv" value="${esc(K().ansvarlig)}"></label>
        <label>Gyldig til <span class="hint">(valgfritt)</span><input type="date" name="gyldigTil"></label>
        <label class="hel">Merknad / funn <input name="merknad"></label>
        <div class="knapperad hel"><button class="knapp primar" type="submit">Registrer</button></div>
      </form>
      ${K().kontroller.length ? `<h4 class="undertittel">Historikk</h4><div class="tabell-wrap"><table class="tabell"><tbody>${K().kontroller.slice().sort((a, b) => String(b.dato).localeCompare(String(a.dato))).map((k) => `<tr data-kontroll="${k.id}"><td>${esc(k.dato)}</td><td>${esc(KONTROLLTYPER[k.type]?.navn || k.type)}</td><td>${esc(k.utfortAv)}</td><td>${esc(k.merknad)}</td><td><button class="knapp liten" type="button" data-ksl-h="slett-kontroll" aria-label="Slett">✕</button></td></tr>`).join('')}</tbody></table></div>` : ''}
      </div>`;
  }

  // ---------- dokumenter ----------
  function dokumenterHtml() {
    const ksl = K();
    const per = new Map();
    for (const d of ksl.dokumenter) { if (!per.has(d.type)) per.set(d.type, []); per.get(d.type).push(d); }
    const forvalg = dokForvalg; dokForvalg = null;
    const type = forvalg ? (Object.entries(DOKUMENTTYPER).find(([, t]) => t.ksl.includes(forvalg))?.[0] || 'annet') : 'annet';
    return `<div class="kort"><h3>${forvalg ? `Nytt dokument for KSL ${esc(forvalg)}` : 'Nytt dokument'}</h3>
      <form class="skjema tre-kol" id="kslDokSkjema">
        <label>Type <select name="type">${opsj(Object.entries(DOKUMENTTYPER).map(([k, t]) => [k, t.navn]), type)}</select></label>
        <label>Navn <input name="navn" required placeholder="F.eks. Jordprøver 2025"></label>
        <label>Dato <input type="date" name="dato" value="${idag()}"></label>
        <label>Gyldig til <span class="hint">(valgfritt)</span><input type="date" name="gyldigTil"></label>
        <label>KSL-punkt <span class="hint">(f.eks. 1.2.1, 10.3.1)</span><input name="ksl" value="${esc(forvalg || '')}"></label>
        <label>Fil <span class="hint">(PDF, bilde …, maks 15 MB)</span><input type="file" name="fil"></label>
        <label class="hel">Merknad / hvor originalen ligger <input name="merknad"></label>
        <div class="knapperad hel"><button class="knapp primar" type="submit">Lagre dokument</button></div>
      </form>
      <p class="hint">Filene lagres bare i denne nettleseren og følger ikke med i sikkerhetskopien. Ta vare på originalene.</p></div>
      ${[...per].map(([t, ds]) => `<div class="kort"><h3>${esc(DOKUMENTTYPER[t]?.navn || t)} <span class="hint">${ds.length}</span></h3>${ds.sort((a, b) => String(b.dato).localeCompare(String(a.dato))).map((d) => `<div class="ksl-dok-rad" data-dok="${d.id}">
        <div><b>${esc(d.navn)}</b><span class="hint"> ${esc(d.dato || '')}${d.gyldigTil ? ` · gyldig til ${esc(d.gyldigTil)}${d.gyldigTil < idag() ? ' ⚠ utløpt' : ''}` : ''}${(d.ksl || []).length ? ` · KSL ${d.ksl.join(', ')}` : ''}</span>${d.merknad ? `<div class="hint">${esc(d.merknad)}</div>` : ''}</div>
        <div class="knapperad" style="margin:0">${d.fil ? `<button class="knapp liten" type="button" data-ksl-dok="${d.id}">📎 Åpne</button>` : ''}<button class="knapp liten" type="button" data-ksl-h="slett-dok" aria-label="Slett">✕</button></div>
      </div>`).join('')}</div>`).join('') || '<div class="tom">Ingen dokumenter ennå.</div>'}`;
  }

  // ---------- utskrift ----------
  function skrivUt() {
    const plan = S(); const ksl = K(); const v = vurdering(plan, aar, idag()); const o = oppsummering(plan, aar, idag()); const r = revisjon(ksl, aar);
    const kap = KSL_KAPITLER.filter((k) => ksl.kapitler.includes(k.nr));
    const kropp = `<h1>KSL-mappe ${aar}</h1>
      <p class="hint">${esc(plan.eiendom?.navn || '')} · ansvarlig: ${esc(ksl.ansvarlig || '–')} · skrevet ut ${new Date().toLocaleDateString('nb-NO')}</p>
      <table><tbody><tr><th>Egenrevisjon ${aar}</th><td>${o.ferdig ? `Fullført ${esc(r.dato)} av ${esc(r.utfortAv)}` : `Ikke fullført (${o.besvart} av ${o.totalt} besvart)`}</td></tr>
      <tr><th>Sjekklister</th><td>${kap.map((k) => `${k.nr} ${esc(k.navn)} (versjon ${esc(k.versjon)})`).join('<br>')}</td></tr>
      <tr><th>Dokumentasjonskrav</th><td>${o.dokKrav - o.dokMangler.filter((q) => q.svar !== 'ia').length} av ${o.dokKrav} dokumentert</td></tr>
      <tr><th>Avvik</th><td>${o.apneAvvik.length} åpne, ${ksl.avvik.length - o.apneAvvik.length} lukket</td></tr></tbody></table>
      ${kap.map((k) => `<h2>${k.nr} ${esc(k.navn)}</h2><table><thead><tr><th style="width:44px">Nr</th><th>Spørsmål</th><th style="width:70px">Svar</th><th>Dokumentasjon</th></tr></thead><tbody>
        ${v.filter((q) => q.kapittel === k.nr).map((q) => `<tr><td>${esc(q.nr)}</td><td>${esc(q.tekst)}${q.dok ? ' <b>[D]</b>' : ''}${q.kommentar ? `<br><i>${esc(q.kommentar)}</i>` : ''}</td><td>${q.svar ? SVAR[q.svar] : '–'}</td><td>${[q.bevis ? `${BEVIS[q.bevis.status]} ${esc(q.bevis.tekst)}` : '', ...q.dokumenter.map((d) => `📎 ${esc(d.navn)}${d.dato ? ` (${esc(d.dato)})` : ''}`)].filter(Boolean).join('<br>')}</td></tr>`).join('')}</tbody></table>`).join('')}
      <h2>Avvik</h2><table><thead><tr><th>KSL</th><th>Avvik</th><th>Tiltak</th><th>Ansvarlig</th><th>Frist</th><th>Lukket</th></tr></thead><tbody>${ksl.avvik.map((a) => `<tr><td>${esc(a.ksl || '')}</td><td>${esc(a.beskrivelse)}</td><td>${esc(a.tiltak)}</td><td>${esc(a.ansvarlig)}</td><td>${esc(a.frist || '')}</td><td>${esc(a.lukket || '')}</td></tr>`).join('') || '<tr><td colspan="6">Ingen avvik</td></tr>'}</tbody></table>
      <h2>Periodiske kontroller</h2><table><thead><tr><th>Kontroll</th><th>Siste</th><th>Neste frist</th><th>Status</th></tr></thead><tbody>${kontrollStatus(ksl, idag()).map((k) => `<tr><td>${esc(k.navn)}</td><td>${esc(k.siste?.dato || '–')}</td><td>${esc(k.neste || '–')}</td><td>${STATUS_K[k.status].navn}</td></tr>`).join('')}</tbody></table>
      <h2>Dokumentliste</h2><table><thead><tr><th>Type</th><th>Navn</th><th>Dato</th><th>Gyldig til</th><th>KSL</th><th>Merknad</th></tr></thead><tbody>${ksl.dokumenter.map((d) => `<tr><td>${esc(DOKUMENTTYPER[d.type]?.navn || d.type)}</td><td>${esc(d.navn)}${d.fil ? ' 📎' : ''}</td><td>${esc(d.dato || '')}</td><td>${esc(d.gyldigTil || '')}</td><td>${esc((d.ksl || []).join(', '))}</td><td>${esc(d.merknad || '')}</td></tr>`).join('') || '<tr><td colspan="6">Ingen dokumenter</td></tr>'}</tbody></table>
      <p class="hint">Gjødslingsplan med skiftekart, gjødseljournal og plantevernjournal skrives ut fra fanen Skifteplan.</p>`;
    const w = window.open('', '_blank'); if (!w) { melding('Nettleseren blokkerte utskriftsvinduet.'); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>KSL-mappe ${aar}</title><style>body{font:12px/1.45 system-ui,sans-serif;max-width:1000px;margin:20px auto;padding:0 16px;color:#111}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:18px 0 6px}table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #bbb;padding:3px 5px;text-align:left;vertical-align:top}th{background:#f1f1ee}.hint{color:#555}@media print{h2{break-after:avoid}tr{break-inside:avoid}}</style>${kropp}<p class="hint" style="margin-top:18px">Laget med ${esc(signatur())}. KSL-standarden © Stiftelsen Norsk Mat.</p><script>setTimeout(()=>print(),400)<\/script>`);
    w.document.close();
  }

  async function apneFil(id) {
    const d = K().dokumenter.find((x) => x.id === id); if (!d?.fil) return;
    const blob = await hentVerdi(`fil:${d.fil.id}`);
    if (!blob) { melding('Filen finnes ikke i denne nettleseren.'); return; }
    const url = URL.createObjectURL(blob); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // ---------- tegning ----------
  function tegn() {
    const el = $('#kslInnhold'); if (!el) return;
    $$('#kslUnder [data-ksl-under]').forEach((b) => b.classList.toggle('aktiv', b.dataset.kslUnder === under));
    el.innerHTML = under === 'revisjon' ? revisjonHtml() : under === 'avvik' ? avvikHtml() : under === 'kontroller' ? kontrollerHtml() : under === 'dokumenter' ? dokumenterHtml() : oversiktHtml();
  }

  // ---------- hendelser ----------
  $('#kslUnder').addEventListener('click', (e) => { const b = e.target.closest('[data-ksl-under]'); if (b) { under = b.dataset.kslUnder; tegn(); } });
  const panel = $('#kslInnhold');
  panel.addEventListener('click', async (e) => {
    const gaa = e.target.closest('[data-ksl-gaa]');
    if (gaa) { e.preventDefault(); const m = gaa.dataset.kslGaa; if (m === 'revisjon') { under = 'revisjon'; tegn(); } else if (m.startsWith('ksl:')) { under = m.slice(4); tegn(); } else visFane(m); return; }
    const dokLenke = e.target.closest('[data-ksl-dok]');
    if (dokLenke) { e.preventDefault(); apneFil(dokLenke.dataset.kslDok); return; }
    const svar = e.target.closest('[data-ksl-svar]');
    const q = e.target.closest('[data-nr]');
    const ksl = K();
    if (svar && q) {
      const r = revisjon(ksl, aar, { nyId });
      const ny = r.svar[q.dataset.nr]?.svar === svar.dataset.kslSvar ? null : svar.dataset.kslSvar;
      if (ny) settSvar(ksl, r, q.dataset.nr, ny, { nyId, idag: idag() }); else r.svar[q.dataset.nr] = { ...r.svar[q.dataset.nr], svar: null };
      lagre();
      if (ny === 'nei') melding(`Avvik opprettet for KSL ${q.dataset.nr}. Følg det opp under Avvik.`);
      return;
    }
    const h = e.target.closest('[data-ksl-h]')?.dataset.kslH; if (!h) return;
    if (h === 'skriv') skrivUt();
    if (h === 'ny-dok' && q) { dokForvalg = q.dataset.nr; under = 'dokumenter'; tegn(); $('#kslDokSkjema [name="navn"]')?.focus(); }
    if (h === 'fullfor') {
      const res = fullfor(S(), aar, { dato: $('#kslFerdigDato').value || idag(), utfortAv: $('#kslFerdigAv').value.trim(), nyId });
      if (!res.ok) { melding(`${res.mangler.length} spørsmål er ikke besvart (f.eks. ${res.mangler.slice(0, 3).map((x) => x.nr).join(', ')}).`); filter = 'ubesvart'; tegn(); return; }
      lagre(); melding(`Egenrevisjonen ${aar} er fullført. Husk å registrere den på ksl.no.`);
    }
    if (h === 'nytt-avvik') { ksl.avvik.unshift({ id: nyId('ka'), ksl: '', beskrivelse: '', tiltak: '', ansvarlig: ksl.ansvarlig, frist: leggTilMnd(idag(), 1), opprettet: idag(), lukket: null, kilde: 'manuell' }); lagre(); }
    if (h === 'slett-avvik') { const id = e.target.closest('[data-avvik]').dataset.avvik; if (confirm('Slette avviket?')) { ksl.avvik = ksl.avvik.filter((a) => a.id !== id); lagre(); } }
    if (h === 'slett-kontroll') { const id = e.target.closest('[data-kontroll]').dataset.kontroll; ksl.kontroller = ksl.kontroller.filter((k) => k.id !== id); lagre(); }
    if (h === 'slett-dok') { const id = e.target.closest('[data-dok]').dataset.dok; const d = ksl.dokumenter.find((x) => x.id === id); if (d && confirm(`Slette «${d.navn}»?`)) { if (d.fil) await lagreVerdi(`fil:${d.fil.id}`, undefined); ksl.dokumenter = ksl.dokumenter.filter((x) => x !== d); lagre(); } }
  });
  panel.addEventListener('change', (e) => {
    const f = e.target; const ksl = K();
    if (f.id === 'kslAnsvarlig') { ksl.ansvarlig = f.value.trim(); lagre(); return; }
    if (f.dataset.kslKap) { const n = Number(f.dataset.kslKap); ksl.kapitler = f.checked ? [...new Set([...ksl.kapitler, n])].sort((a, b) => a - b) : ksl.kapitler.filter((x) => x !== n); ksl.kapitlerValgt = true; lagre(); return; }
    if (f.id === 'kslAar') { aar = Number(f.value); tegn(); return; }
    if (f.id === 'kslFilter') { filter = f.value; tegn(); return; }
    if (f.hasAttribute('data-ksl-kommentar')) { const q = f.closest('[data-nr]'); const r = revisjon(ksl, aar, { nyId }); r.svar[q.dataset.nr] = { ...r.svar[q.dataset.nr], kommentar: f.value }; endret({ kart: false }); return; }
    if (f.dataset.af) {
      const a = ksl.avvik.find((x) => x.id === f.closest('[data-avvik]').dataset.avvik); if (!a) return;
      a[f.dataset.af] = f.dataset.af === 'lukket' ? (f.checked ? idag() : null) : f.value;
      if (f.dataset.af === 'lukket') lagre(); else endret({ kart: false });
    }
  });
  panel.addEventListener('submit', async (e) => {
    e.preventDefault(); const ksl = K(); const d = new FormData(e.target);
    if (e.target.id === 'kslKontrollSkjema') {
      ksl.kontroller.push({ id: nyId('kk'), type: d.get('type'), dato: d.get('dato'), utfortAv: d.get('utfortAv').trim(), gyldigTil: d.get('gyldigTil') || null, merknad: d.get('merknad').trim() });
      lagre(); melding(`${KONTROLLTYPER[d.get('type')].navn} registrert.`);
    }
    if (e.target.id === 'kslDokSkjema') {
      const fil = d.get('fil'); let filInfo = null;
      if (fil && fil.size) {
        if (fil.size > MAKS_FIL) { melding('Filen er større enn 15 MB.'); return; }
        filInfo = { id: nyId('f'), navn: fil.name, type: fil.type, storrelse: fil.size };
        try { await lagreVerdi(`fil:${filInfo.id}`, fil); } catch (err) { melding(`Kunne ikke lagre filen: ${err.message}`); return; }
      }
      const kslNr = String(d.get('ksl') || '').split(/[\s,;]+/).map((x) => x.trim()).filter((x) => sporsmal(x));
      ksl.dokumenter.push({ id: nyId('kd'), type: d.get('type'), navn: d.get('navn').trim(), dato: d.get('dato') || null, gyldigTil: d.get('gyldigTil') || null, ksl: kslNr, merknad: d.get('merknad').trim(), fil: filInfo });
      lagre(); melding('Dokumentet er lagret.');
    }
  });

  return {
    vis() { sikreKsl(S()); tegn(); },
    oppdater() { if (!$('#fane-ksl').hidden && !document.activeElement?.closest?.('#kslInnhold')) tegn(); },
    varsler: () => (S().ksl ? kslVarsler(S(), iAar, idag()) : []),
  };
}
