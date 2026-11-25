// 🌍 Fanen «EUDR»: dokumentasjon etter EUs avskogingsforordning (beregningene i eudr.js).
import { STATUS, ROLLER, SJEKKLISTE, SORTIMENT, TRESLAG, KONTROLLERT, samsvar, geojson, forenkletErklaering, foreslaLeveranser, nyLeveranse, leveranseInfo } from './eudr.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NIV = { ok: '✓', info: 'i', varsel: '!', avvik: '✕' };
const FARGE = { ok: 'var(--accent)', info: 'var(--accent)', varsel: '#c77800', avvik: 'var(--critical)' };
const datoNb = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(document.documentElement.lang === 'en' ? 'en-GB' : 'nb-NO');

function lastNed(navn, data, type = 'application/geo+json') {
  const url = URL.createObjectURL(new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 1)], { type }));
  const a = document.createElement('a'); a.href = url; a.download = navn; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function skrivUt(tittel, kropp, melding) {
  const w = window.open('', '_blank'); if (!w) { melding('Nettleseren blokkerte utskriftsvinduet.'); return; }
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(tittel)}</title><style>body{font:13px/1.5 system-ui,sans-serif;max-width:820px;margin:24px auto;padding:0 16px;color:#111}h1{font-size:20px}h2{font-size:15px;margin-top:18px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:5px 8px;text-align:left;vertical-align:top}th{background:#f3f3f3;width:36%}.merk{background:#fff7e0;border:1px solid #e8c770;padding:8px 10px;border-radius:6px}</style>${kropp}<script>setTimeout(()=>print(),300)<\/script>`);
  w.document.close();
}

const filnavnFor = (S, x) => `eudr-${(S.eiendom?.navn || 'eiendom').toLowerCase().replace(/[^a-z0-9æøå]+/g, '-').replace(/^-+|-+$/g, '')}-${x}.geojson`;
// GeoJSON for én leveranse (bestandene i den).
export function lastNedLeveranseGeo(S, l, navn = `leveranse-${l.dato}`) { lastNed(filnavnFor(S, navn), geojson(S, { bestandIder: l.bestandIder })); }
// Utskrift med informasjonen kjøperen trenger (aktsomhet trinn 1).
export function skrivLeveranseInfo(S, l, melding, iAar = new Date().getFullYear()) {
  const i = leveranseInfo(S, l); const klar = samsvar(S, iAar).klar;
  skrivUt('EUDR – informasjon til kjøper', `<h1>EUDR – informasjon om leveranse ${esc(l.dato)}</h1><p class="merk">${esc(STATUS.tekst)}</p>
    <table><tr><th>Produkt</th><td>${esc(i.produkt)}</td></tr><tr><th>Treslag</th><td>${esc(i.treslag)}</td></tr><tr><th>Mengde</th><td>${esc(i.mengde)}${l.maalt ? ' (målt av hogstmaskinen)' : ''}</td></tr><tr><th>Produksjonsland</th><td>${esc(i.land)}</td></tr>
    <tr><th>Leverandør</th><td>${esc(i.leverandor.navn)}<br>${esc(i.leverandor.adresse)}<br>${esc(i.leverandor.epost)}</td></tr><tr><th>Kjøper</th><td>${esc(i.kjoper?.navn || '')}<br>${esc(i.kjoper?.adresse || '')}<br>${esc(i.kjoper?.epost || '')}</td></tr>
    ${l.oppdragNr ? `<tr><th>Oppdrag</th><td>${esc(l.oppdragNr)}</td></tr>` : ''}
    <tr><th>Hogststed</th><td>${i.steder.map(esc).join('<br>')}<br>${i.geolokasjon.features.length} polygon(er) i vedlagt GeoJSON-fil</td></tr><tr><th>Erklærings-/referansenummer</th><td>${esc(i.referanse || '–')}</td></tr>
    <tr><th>Avskogingsfritt og lovlig</th><td>${klar ? 'Skogen er forynget etter hogst og ikke gjort om til annen arealbruk etter 31.12.2020. Hogsten er gjort i samsvar med skogbruksloven, forskrift om berekraftig skogbruk og naturmangfoldloven. Norge er lavrisikoland.' : '⚠ Ikke fullstendig dokumentert – sjekklisten i SkogIQ.ai har punkter som ikke er bekreftet eller har avvik.'}</td></tr></table>`, melding);
}

export function initEudr({ hentPlan, endret, melding, nyId, iAar = new Date().getFullYear(), apneOppdrag = () => {} }) {
  const E = () => { const S = hentPlan(); if (!S.eudr) S.eudr = { rolle: 'fullmakt', virksomhet: {}, sjekkliste: {}, leveranser: [], sortimenter: ['4403'] }; return S.eudr; };
  const lagre = () => { endret({ kart: false }); tegn(); };

  function tegn() {
    const el = $('#eudrInnhold'); if (!el) return;
    const S = hentPlan(); const e = E(); const s = samsvar(S, iAar); const v = e.virksomhet || {}; const fe = forenkletErklaering(S, iAar); const forslag = foreslaLeveranser(S);
    const opp = (l) => l.fraOppdrag && (S.oppdrag || []).find((o) => o.id === l.fraOppdrag);
    const felt = (f, navn, hint = '', type = 'text') => `<label>${navn} <input type="${type}" data-eu-v="${f}" value="${esc(v[f] ?? '')}" placeholder="${esc(hint)}"></label>`;
    el.innerHTML = `
      <div class="kort eu-status"><h3>⚠️ Usikkert om og når EUDR blir innført i Norge</h3><p>${esc(STATUS.tekst)}</p>
        <p class="hint">Norge er klassifisert som lavrisikoland, så forenklet aktsomhet holder. Skjæringsdato for avskoging: 31. desember 2020. Status kontrollert ${datoNb(KONTROLLERT)} og følges opp hver uke. <a href="${STATUS.kilde.url}" target="_blank" rel="noopener">${esc(STATUS.kilde.navn)}</a> · <a href="${STATUS.kommisjonen.url}" target="_blank" rel="noopener">${esc(STATUS.kommisjonen.navn)}</a></p></div>
      <div class="kort"><div class="detalj-topp"><h3>Er tømmeret avskogingsfritt og lovlig?</h3><span class="sp-krav ${s.klar ? 'pakrevd' : ''}">${s.klar ? '✓ Dokumentert' : `${s.manuelle - s.bekreftet + s.avvik} punkt gjenstår`}</span></div>
        ${s.vurdering.map((x) => `<div class="sp-funn" style="--farge:${FARGE[x.nivaa]}"><i>${NIV[x.nivaa]}</i><div class="hint" style="color:inherit">${esc(x.tekst)}</div></div>`).join('')}
        <h4 class="undertittel">Bekreft selv</h4>
        <div class="eu-sjekk">${SJEKKLISTE.filter((x) => !x.auto).map((x) => `<div class="eu-sp"><span>${esc(x.tekst)}</span><span class="sp-janei"><label><input type="radio" name="eu-${x.id}" value="ja" data-eu-sj="${x.id}" ${e.sjekkliste[x.id] === 'ja' ? 'checked' : ''}> Ja</label><label><input type="radio" name="eu-${x.id}" value="nei" data-eu-sj="${x.id}" ${e.sjekkliste[x.id] === 'nei' ? 'checked' : ''}> Nei</label></span></div>`).join('')}</div>
      </div>
      <div class="kort"><h3>Din rolle</h3>
        ${Object.entries(ROLLER).map(([k, r]) => `<label class="eu-rolle"><input type="radio" name="eu-rolle" value="${k}" data-eu-rolle ${e.rolle === k ? 'checked' : ''}><span><b>${esc(r.navn)}</b><span class="hint">${esc(r.tekst)}</span></span></label>`).join('')}
        <div class="skjema to-kol" style="margin-top:10px">${felt('navn', 'Navn (person eller foretak)', S.eiendom?.eier || '')}${felt('adresse', 'Adresse')}${felt('epost', 'E-post', '', 'email')}${felt('eori', 'EORI-nummer', 'uklart om det kreves')}
          <label>Erklæringsnummer <input data-eu-nr value="${esc(e.erklaeringsnummer || '')}" placeholder="fra EUs informasjonssystem"></label></div>
        <p class="hint">Det er foreløpig uklart om primærvirksomheter må ha EORI-nummer. EUs informasjonssystem er ikke åpnet for norske virksomheter ennå – fram til da må en aktør i EU registrere den første erklæringen.</p>
      </div>
      <div class="kort"><h3>Geolokasjon</h3>
        <p>Koordinater for hvor tømmeret er hogd, med minst 6 desimaler. Områder over 4 ha leveres som polygon. Filen er GeoJSON i formatet EUs informasjonssystem tar imot (ProducerName, ProducerCountry, ProductionPlace, Area).</p>
        <div class="knapperad"><button type="button" class="knapp" data-eu="geo-eiendom">Last ned eiendommen (GeoJSON)</button><button type="button" class="knapp" data-eu="geo-hogst">Last ned hogstflater etter 2020</button></div>
      </div>
      <div class="kort"><div class="detalj-topp"><h3>Forenklet engangserklæring</h3><div class="knapperad" style="margin:0"><button type="button" class="knapp liten" data-eu="skriv-erklaering">Skriv ut</button></div></div>
        <p class="hint">For mikro- og små primærvirksomheter som selv hogger og selger tømmer eller ved fra egen eiendom (forordningen vedlegg III). Registreres én gang i EUs informasjonssystem og oppdateres ved større endringer.</p>
        <table class="tabell sp-tabell"><tbody>
          <tr><td>Navn og adresse</td><td>${esc(fe.navn || '–')}${fe.adresse ? `, ${esc(fe.adresse)}` : ''}${fe.eori ? ` · EORI ${esc(fe.eori)}` : ''}</td></tr>
          <tr><td>Varer (HS-kode)</td><td>${Object.entries(SORTIMENT).map(([hs, x]) => `<label class="avkrysning"><input type="checkbox" data-eu-hs="${hs}" ${(e.sortimenter || ['4403']).includes(hs) ? 'checked' : ''}> ${hs} ${esc(x.navn)}</label>`).join('<br>')}</td></tr>
          <tr><td>Treslag</td><td>${fe.kvantum.rader.map((r) => `${esc(r.navn)} (<i>${esc(r.vitenskapelig)}</i>)`).join(', ') || '–'}</td></tr>
          <tr><td>Anslått årlig kvantum</td><td>${fe.kvantum.rader.map((r) => `${esc(r.navn)}: ca. ${r.kg.toLocaleString('nb-NO')} kg (${r.m3} m³)`).join('<br>') || '–'}<div class="hint">± ${fe.kvantum.avvik} % · ut fra ${esc(fe.kvantum.kilde || '')}</div></td></tr>
          <tr><td>Produksjonsland og geolokasjon</td><td>Norge · ${fe.geolokasjon.features.length} område(r) i GeoJSON-filen</td></tr>
        </tbody></table>
        ${fe.mangler.length ? `<p class="hint">Mangler: ${fe.mangler.join(', ')}.</p>` : ''}
      </div>
      <div class="kort"><div class="detalj-topp"><h3>Leveranser</h3><button type="button" class="knapp liten" data-eu="ny-lev">+ Leveranse</button></div>
        <p class="hint">Hva du har solgt, til hvem og fra hvilke bestand. Kjøperen trenger informasjonen og erklærings- eller referansenummeret. Dokumentasjonen skal oppbevares i minst fem år.</p>
        <p class="hint">🪓 Hogst- og tynningsoppdrag blir leveranser automatisk når de markeres som utført – med bestand, tømmerkjøper og mengde (målt av hogstmaskinen når produksjonsfilene er lest inn).</p>
        ${forslag.length ? `<div class="eu-forslag">${forslag.map((f, i) => `<div><span>${esc(f.tekst)}</span><button type="button" class="knapp liten" data-eu-forslag="${i}">Legg til</button></div>`).join('')}</div>` : ''}
        ${(e.leveranser || []).map((l) => `<div class="eu-lev" data-eu-lev="${l.id}"><div class="skjema to-kol">
            <label>Dato <input type="date" data-eu-l="dato" value="${esc(l.dato)}"></label>
            <label>Vare <select data-eu-l="hs">${Object.entries(SORTIMENT).map(([hs, x]) => `<option value="${hs}" ${l.hs === hs ? 'selected' : ''}>${hs} ${esc(x.navn)}</option>`).join('')}</select></label>
            <label>Treslag <select data-eu-l="treslag">${Object.entries(TRESLAG).map(([k, t]) => `<option value="${k}" ${l.treslag === k ? 'selected' : ''}>${esc(t.navn)}</option>`).join('')}</select></label>
            <label>Mengde (m³) <input type="number" min="0" data-eu-l="m3" value="${l.m3 ?? ''}"></label>
            <label>Kjøper <input data-eu-k="navn" value="${esc(l.kjoper?.navn || '')}" placeholder="F.eks. skogeierandelslaget"></label>
            <label>Kjøperens adresse <input data-eu-k="adresse" value="${esc(l.kjoper?.adresse || '')}"></label>
            <label>Kjøperens e-post <input type="email" data-eu-k="epost" value="${esc(l.kjoper?.epost || '')}"></label>
            <label>Erklærings-/referansenummer <input data-eu-l="referanse" value="${esc(l.referanse || '')}" placeholder="${esc(e.erklaeringsnummer || '')}"></label></div>
          <div class="hint">Bestand: ${esc((S.bestand || []).filter((b) => l.bestandIder.includes(b.id)).map((b) => b.nr).join(', ') || 'ingen valgt')}${l.maalt ? ' · mengde målt av hogstmaskinen' : ''}</div>
          <div class="knapperad">${opp(l) ? `<button type="button" class="knapp liten" data-eu-l-h="oppdrag">🪓 Oppdrag ${esc(opp(l).nr)}</button>` : l.oppdragNr ? `<span class="hint">Fra oppdrag ${esc(l.oppdragNr)} (slettet)</span>` : ''}<button type="button" class="knapp liten" data-eu-l-h="info">Informasjon til kjøper</button><button type="button" class="knapp liten" data-eu-l-h="geo">GeoJSON</button><button type="button" class="knapp liten fare" data-eu-l-h="slett">Slett</button></div></div>`).join('') || '<p class="hint">Ingen leveranser registrert ennå.</p>'}
      </div>`;
  }

  document.addEventListener('click', (ev) => {
    const root = ev.target.closest?.('#eudrInnhold'); if (!root) return;
    const S = hentPlan(); const e = E(); const k = ev.target.closest('[data-eu]');
    const filnavn = (x) => filnavnFor(S, x);
    if (k?.dataset.eu === 'geo-eiendom') { const g = geojson(S); if (!g.features.length) { melding('Eiendommen mangler grense i kartet.'); return; } lastNed(filnavn('eiendom'), g); }
    if (k?.dataset.eu === 'geo-hogst') { const ider = [...new Set((S.bestand || []).filter((b) => (b.tiltak || []).some((t) => ['sluttavvirkning', 'tynning', 'lukkethogst'].includes(t.type) && Number(t.aar) > 2020)).map((b) => b.id))]; if (!ider.length) { melding('Ingen hogst etter 2020 er registrert i planen.'); return; } lastNed(filnavn('hogst'), geojson(S, { bestandIder: ider })); }
    if (k?.dataset.eu === 'skriv-erklaering') {
      const f = forenkletErklaering(S, iAar);
      skrivUt('Forenklet erklæring – EUDR', `<h1>Forenklet engangserklæring – forordning (EU) 2023/1115 (EUDR)</h1><p class="merk">${esc(STATUS.tekst)}</p>
        <table><tr><th>Primærvirksomhet</th><td>${esc(f.navn)}<br>${esc(f.adresse)}${f.eori ? `<br>EORI: ${esc(f.eori)}` : ''}</td></tr>
        ${f.varer.map((v) => `<tr><th>HS ${esc(v.hs)}</th><td>${esc(v.beskrivelse)}<br>${esc(v.treslag)}</td></tr>`).join('')}
        <tr><th>Anslått årlig kvantum</th><td>${f.kvantum.rader.map((r) => `${esc(r.navn)} (${esc(r.vitenskapelig)}): ca. ${r.kg.toLocaleString('nb-NO')} kg`).join('<br>')}<br>Forventet avvik ± ${f.kvantum.avvik} %</td></tr>
        <tr><th>Produksjonsland</th><td>${esc(f.land)}</td></tr><tr><th>Geolokasjon</th><td>${f.geolokasjon.features.map((x) => `${esc(x.properties.ProductionPlace)} – ${x.properties.Area} ha`).join('<br>')}<br>(GeoJSON-fil med koordinater lastes ned fra SkogIQ.ai)</td></tr></table>
        <h2>Erklæring</h2><p>${esc(f.tekst)}</p><p>Sted og dato: ______________________ &nbsp; Underskrift: ______________________</p>`, melding);
    }
    if (k?.dataset.eu === 'ny-lev') { e.leveranser = [...(e.leveranser || []), nyLeveranse(nyId)]; lagre(); }
    const fs = ev.target.closest('[data-eu-forslag]'); if (fs) { const f = foreslaLeveranser(S)[Number(fs.dataset.euForslag)]; if (f) { const { tekst, ...data } = f; e.leveranser = [...(e.leveranser || []), nyLeveranse(nyId, data)]; lagre(); } }
    const lh = ev.target.closest('[data-eu-l-h]');
    if (lh) {
      const l = e.leveranser.find((x) => x.id === lh.closest('[data-eu-lev]').dataset.euLev); if (!l) return;
      if (lh.dataset.euLH === 'slett') { if (confirm('Slette leveransen? Dokumentasjonen skal normalt oppbevares i fem år.')) { e.leveranser = e.leveranser.filter((x) => x !== l); for (const o of S.oppdrag || []) if (o.eudr?.leveranseId === l.id) delete o.eudr; lagre(); } return; }
      if (lh.dataset.euLH === 'geo') { lastNedLeveranseGeo(S, l); return; }
      if (lh.dataset.euLH === 'oppdrag') { apneOppdrag(l.fraOppdrag, 'eudr'); return; }
      skrivLeveranseInfo(S, l, melding, iAar);
    }
  });
  document.addEventListener('change', (ev) => {
    const t = ev.target; if (!t.closest?.('#eudrInnhold')) return; const e = E();
    if (t.dataset.euV) { e.virksomhet = { ...(e.virksomhet || {}), [t.dataset.euV]: t.value.trim() }; lagre(); }
    else if (t.hasAttribute('data-eu-nr')) { e.erklaeringsnummer = t.value.trim(); lagre(); }
    else if (t.dataset.euSj) { e.sjekkliste = { ...(e.sjekkliste || {}), [t.dataset.euSj]: t.value }; lagre(); }
    else if (t.hasAttribute('data-eu-rolle')) { e.rolle = t.value; lagre(); }
    else if (t.dataset.euHs) { const s = new Set(e.sortimenter || ['4403']); if (t.checked) s.add(t.dataset.euHs); else s.delete(t.dataset.euHs); e.sortimenter = [...s]; lagre(); }
    else if (t.dataset.euL || t.dataset.euK) {
      const l = e.leveranser.find((x) => x.id === t.closest('[data-eu-lev]').dataset.euLev); if (!l) return;
      if (t.dataset.euK) l.kjoper = { ...(l.kjoper || {}), [t.dataset.euK]: t.value.trim() }; else { l[t.dataset.euL] = t.dataset.euL === 'm3' ? (t.value === '' ? null : Number(t.value)) : t.value; if (t.dataset.euL === 'm3') { l.manuellM3 = t.value !== ''; l.maalt = false; } }
      lagre();
    }
  });
  return { tegn };
}
