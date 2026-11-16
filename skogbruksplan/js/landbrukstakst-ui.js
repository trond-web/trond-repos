// 🏡 Landbrukstakst i Verdi-fanen (js/landbrukstakst.js): alle tre variantene (konsesjon/marked, odel, åsete), verdi per
// del, priskontroll og konsesjonsplikt, skjema for arealer, jord, bygninger, rettigheter og boverdi, og en utskriftsvennlig
// rapport. Data lagres i planen (S.takst).
import * as LT from './landbrukstakst.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kr = (v) => `${Math.round(v).toLocaleString('nb-NO')} kr`;
const mill = (v) => `${(v / 1e6).toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mill. kr`;
const daa = (v) => `${(Math.round((v || 0) * 10) / 10).toLocaleString('nb-NO')} daa`;
const opsj = (obj, valgt) => Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === valgt ? 'selected' : ''}>${esc(v.navn)}</option>`).join('');
const FORBEHOLD = 'Beregnet verdivurdering – ikke en sertifisert takst. Beregningen bygger på skogbruksplanen, AR5 og opplysningene som er lagt inn, uten befaring. Metoden følger konsesjonsloven og rundskrivene M-1/2021 og M-3/2002 (4 % kapitaliseringsrente for jord og skog, kostnadsverdi for bygninger). Til salg, odelsløsning, skifte og lån skal det brukes takst fra sertifisert landbrukstakstmann.';

export function initLandbrukstakst({ rot, hentPlan, endret, melding = () => {}, nyId, iAar = new Date().getFullYear() }) {
  const apne = new Set(['bygg']);
  const S = () => hentPlan();
  const takst = () => { const p = S(); if (!p.takst) p.takst = LT.takstFor(p); return p.takst; };

  function delerHtml(r) {
    return `<div class="tabell-wrap"><table class="tabell lt-tabell"><thead><tr><th>Del</th><th class="tall">Areal / BTA</th><th class="tall">Verdi</th></tr></thead><tbody>
      ${r.deler.map((d) => `<tr class="lt-${d.gruppe}"><td>${esc(d.navn)}<small class="lt-metode">${esc(d.metode)}</small></td><td class="tall">${d.areal != null ? daa(d.areal) : d.bta ? `${d.bta} m²` : ''}</td><td class="tall">${kr(d.verdi)}</td></tr>`).join('')}
      <tr class="sum"><th colspan="2">Sum delverdier</th><th class="tall">${kr(r.sum)}</th></tr></tbody></table></div>`;
  }
  function skjemaHtml(r) {
    const t = r.takst; const a = r.arealer;
    const felt = (navn, etikett, verdi, { steg = 1, hint = '', plass = '' } = {}) => `<label>${etikett}<input type="number" step="${steg}" data-lt="${navn}" value="${verdi ?? ''}" placeholder="${esc(plass)}">${hint ? `<small class="hint">${hint}</small>` : ''}</label>`;
    const det = (id, tittel, innhold) => `<details class="lt-del" data-lt-det="${id}" ${apne.has(id) ? 'open' : ''}><summary>${tittel}</summary>${innhold}</details>`;
    return [
      det('areal', `🗺️ Arealer <span class="hint">${daa(a.total)} totalt</span>`, `<div class="skjema tre-kol">
        ${felt('areal.full', 'Fulldyrka jord (daa)', t.arealer.full, { steg: 0.1, plass: a.fraPlan.full.toFixed(1), hint: 'Tomt = fra AR5' })}
        ${felt('areal.overflate', 'Overflatedyrka (daa)', t.arealer.overflate, { steg: 0.1, plass: a.fraPlan.overflate.toFixed(1) })}
        ${felt('areal.beite', 'Innmarksbeite (daa)', t.arealer.beite, { steg: 0.1, plass: a.fraPlan.beite.toFixed(1) })}</div>
        <p class="hint">Produktiv skog ${daa(a.produktiv)} (bestandene) · uproduktiv skog og åpen mark ${daa(a.uproduktiv)} · myr ${daa(a.myr)} · bebygd ${daa(a.bebygd)} · annet ${daa(a.annet)}</p>`),
      det('jord', '🌾 Jord – årlig netto per daa', `<div class="skjema fire-kol">
        ${felt('jord.full', 'Fulldyrka (kr/daa/år)', t.jord.full)}${felt('jord.overflate', 'Overflatedyrka', t.jord.overflate)}${felt('jord.beite', 'Innmarksbeite', t.jord.beite)}
        ${felt('jord.rasjonalisering', 'Rasjonaliseringsgevinst (%)', t.jord.rasjonalisering, { hint: 'Tilleggsjord, f.eks. 50' })}</div>
        <p class="hint">Dekningsbidrag minus faste kostnader og arbeidsvederlag (driftsgranskingene), delt på ${LT.RENTE} %: ${t.jord.full} kr/daa gir ${kr(t.jord.full / (LT.RENTE / 100))} per daa. Varierer mye med region, jordkvalitet og arrondering.</p>`),
      det('bygg', `🏠 Bygninger <span class="hint">${t.bygninger.length}</span>`, `${t.bygninger.map((g) => { const b = LT.bygningsverdi(g, iAar); const bolig = LT.BYGG_TYPER[g.type]?.bolig; return `<div class="lt-bygg">
        <div class="skjema fire-kol"><label>Type<select data-lt="bygg:${g.id}:type">${opsj(LT.BYGG_TYPER, g.type)}</select></label><label>Navn<input data-lt="bygg:${g.id}:navn" value="${esc(g.navn || '')}" placeholder="${esc(LT.BYGG_TYPER[g.type]?.navn || '')}"></label>
        ${felt(`bygg:${g.id}:bta`, 'BTA (m²)', g.bta)}${felt(`bygg:${g.id}:byggeaar`, 'Byggeår', g.byggeaar)}${felt(`bygg:${g.id}:renovert`, 'Renovert/påbygd (år)', g.renovert)}
        <label>Tilstand<select data-lt="bygg:${g.id}:tilstand">${opsj(LT.TILSTAND, g.tilstand || 'normal')}</select></label>
        ${bolig ? '' : `<label>Bruksverdi<select data-lt="bygg:${g.id}:bruksverdi">${opsj(LT.BRUKSVERDI, g.bruksverdi || 'hoy')}</select></label>`}
        ${felt(`bygg:${g.id}:kvm`, 'Nybyggpris (kr/m²)', g.kvm, { plass: String(LT.BYGG_TYPER[g.type]?.kvm || '') })}${felt(`bygg:${g.id}:skjonn`, 'Skjønnsverdi (kr)', g.skjonn, { hint: 'Overstyrer beregningen' })}</div>
        <div class="lt-bygg-fot"><b>${kr(b.verdi)}</b><span class="hint">${b.skjonn ? 'skjønn' : `nybygg ${kr(b.nybygg)} · effektiv alder ${b.alder} år`}</span><button type="button" class="knapp liten fare" data-lt-h="fjern-bygg" data-id="${g.id}">Fjern</button></div></div>`; }).join('')}
        <div class="knapperad"><button type="button" class="knapp liten" data-lt-h="ny-bygg">+ Legg til bygning</button></div>
        <p class="hint">Kostnadsverdi: nybyggpris med fradrag for alder, slitasje og egnethet. Driftsbygninger etter bruksverdi for dagens drift eller lovlig, godkjent alternativ bruk. Bygninger på landbrukseiendom verdsettes lavere enn vanlige boliger.</p>`),
      det('rett', '🦌 Utmark, jakt, fiske og rettigheter', `${t.rettigheter.map((x) => `<div class="skjema tre-kol lt-rett"><label>Navn<input data-lt="rett:${x.id}:navn" value="${esc(x.navn || '')}"></label>${felt(`rett:${x.id}:aarlig`, 'Årlig netto (kr)', x.aarlig, { hint: `Kapitaliseres med ${LT.RENTE} %` })}${felt(`rett:${x.id}:belop`, 'Skjønnsbeløp (kr)', x.belop)}</div>`).join('')}
        <div class="knapperad"><button type="button" class="knapp liten" data-lt-h="ny-rett">+ Legg til rettighet</button></div>`),
      det('ovrig', '⚖️ Boverdi, fradrag og kjøpesum', `<div class="skjema fire-kol">
        ${felt('boverdi', 'Boverdi (kr)', t.boverdi, { hint: `Tillegg i attraktive boområder, høyst ${mill(LT.BOVERDI_MAKS)}` })}
        ${felt('borett', 'Fradrag borett/kår (kr)', t.borett, { hint: 'Tinglyst borett' })}
        ${felt('asetefradrag', 'Fradrag i åsetestakst (%)', t.asetefradrag, { hint: 'Skjønn – «rimelige vilkår»' })}
        ${felt('kjopesum', 'Avtalt kjøpesum (kr)', t.kjopesum, { hint: 'Valgfritt – for priskontrollen' })}</div>
        <label class="hel">Merknad i rapporten<textarea data-lt="merknad" rows="2">${esc(t.merknad || '')}</textarea></label>`),
    ].join('');
  }
  function tegn() {
    const el = rot(); if (!el) return; const p = S();
    if (!p?.bestand?.length && !p?.takst?.bygninger?.length) { el.innerHTML = '<p class="hint">Lag eller last inn en skogbruksplan først – arealene og skogverdien hentes fra planen.</p>'; return; }
    takst(); const r = LT.beregnTakst(p, { iAar });
    const ks = r.priskontroll; const kp = r.konsesjonsplikt;
    el.innerHTML = `<div class="lt-varianter">${Object.entries(r.varianter).map(([k, v]) => `<div class="lt-variant lt-v-${k}"><span>${esc(v.navn)}</span><b>${mill(v.verdi)}</b><small>${esc(v.bruk)}${k === 'asete' ? ` · uten boverdi, ${v.fradrag} % fradrag` : ''}</small></div>`).join('')}</div>
      <div class="lt-status"><div class="lt-pk lt-pk-${ks.svar}"><b>Priskontroll: ${ks.svar === 'ja' ? 'Ja' : ks.svar === 'nei' ? 'Nei' : 'Må sjekkes'}</b> – ${esc(ks.tekst)}${r.takst.kjopesum ? ` ${Number(r.takst.kjopesum) > r.varianter.konsesjon.verdi * 1.05 && ks.svar === 'ja' ? `<b class="lt-advarsel">Avtalt kjøpesum (${mill(r.takst.kjopesum)}) ligger over beregnet konsesjonsverdi.</b>` : ''}` : ''}</div>
        <div><b>Konsesjon:</b> ${esc(kp.tekst)} ${esc(kp.boplikt)}</div></div>
      ${delerHtml(r)}
      ${skjemaHtml(r)}
      <div class="knapperad"><button type="button" class="knapp primar" data-lt-h="rapport">🖨 Skriv ut takstrapport</button></div>
      <p class="hint lt-forbehold">⚠ ${esc(FORBEHOLD)}</p>`;
  }
  function sett(sti, verdi) {
    const t = takst(); const tall = verdi === '' ? null : Number(String(verdi).replace(',', '.'));
    if (sti.startsWith('bygg:') || sti.startsWith('rett:')) {
      const [hva, id, felt] = sti.split(':'); const liste = hva === 'bygg' ? t.bygninger : t.rettigheter; const x = liste.find((y) => y.id === id); if (!x) return;
      x[felt] = ['navn', 'type', 'tilstand', 'bruksverdi'].includes(felt) ? verdi : tall; return;
    }
    if (sti.startsWith('areal.')) { t.arealer = t.arealer || {}; t.arealer[sti.slice(6)] = tall; return; }
    if (sti.startsWith('jord.')) { t.jord = { ...LT.STANDARD_TAKST.jord, ...(t.jord || {}) }; t.jord[sti.slice(5)] = tall ?? 0; return; }
    t[sti] = sti === 'merknad' ? verdi : tall;
  }
  document.addEventListener('change', (e) => {
    const k = e.target.closest?.('[data-lt]'); if (!k || !rot()?.contains(k)) return;
    sett(k.dataset.lt, k.value); endret({ kart: false }); tegn();
  });
  document.addEventListener('toggle', (e) => { const d = e.target; if (d?.dataset?.ltDet) { if (d.open) apne.add(d.dataset.ltDet); else apne.delete(d.dataset.ltDet); } }, true);
  document.addEventListener('click', (e) => {
    const k = e.target.closest?.('[data-lt-h]'); if (!k || !rot()?.contains(k)) return; const t = takst();
    if (k.dataset.ltH === 'ny-bygg') { t.bygninger.push({ id: nyId('bg'), type: t.bygninger.some((g) => g.type === 'vaaningshus') ? 'driftsbygning' : 'vaaningshus', bta: null, byggeaar: null, tilstand: 'normal' }); apne.add('bygg'); }
    if (k.dataset.ltH === 'fjern-bygg') t.bygninger = t.bygninger.filter((g) => g.id !== k.dataset.id);
    if (k.dataset.ltH === 'ny-rett') { t.rettigheter.push({ id: nyId('rt'), navn: '', aarlig: 0, belop: 0 }); apne.add('rett'); }
    if (k.dataset.ltH === 'rapport') { skrivUt(); return; }
    endret({ kart: false }); tegn();
  });

  // ---------- rapport ----------
  function rapportHtml() {
    const p = S(); const r = LT.beregnTakst(p, { iAar }); const e = p.eiendom || {}; const a = r.arealer;
    const rad = (k, v) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`;
    return `<!doctype html><html lang="nb"><head><meta charset="utf-8"><title>Landbrukstakst (beregnet) – ${esc(e.navn || '')}</title><style>
      body{font:12.5px/1.45 system-ui,sans-serif;color:#111;max-width:820px;margin:24px auto;padding:0 18px} h1{font-size:22px;margin:0} h2{font-size:15px;margin:22px 0 6px;border-bottom:2px solid #1f6b4a;padding-bottom:3px}
      table{width:100%;border-collapse:collapse;margin:4px 0} th,td{text-align:left;padding:4px 6px;border-bottom:1px solid #ddd;vertical-align:top} td.t,th.t{text-align:right;white-space:nowrap} .hint{color:#555;font-size:11.5px}
      .topp{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;border-bottom:3px solid #1f6b4a;padding-bottom:8px} .v{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0} .v div{border:1px solid #ccc;border-radius:8px;padding:8px} .v b{display:block;font-size:17px}
      .forbehold{background:#fff6e0;border:1px solid #e8c66a;border-radius:8px;padding:8px 10px;font-size:11.5px} @media print{body{margin:0}}</style></head><body>
      <div class="topp"><div><h1>Landbrukstakst – beregnet verdivurdering</h1><div>${esc(e.navn || 'Eiendommen')}${e.gnrbnr ? ` · gnr/bnr ${esc(e.gnrbnr)}` : ''}${e.kommune ? ` · ${esc(e.kommune)} kommune` : ''}</div></div><div class="hint">Laget ${new Date().toLocaleDateString('nb-NO')} i SkogIQ.ai</div></div>
      <div class="v">${Object.values(r.varianter).map((v) => `<div><span>${esc(v.navn)}</span><b>${kr(v.verdi)}</b><span class="hint">${esc(v.bruk)}</span></div>`).join('')}</div>
      <p class="forbehold">⚠ ${esc(FORBEHOLD)}</p>
      <h2>Eiendommen</h2><table>${rad('Eiendom', esc(e.navn || ''))}${rad('Kommune', esc(e.kommune || ''))}${rad('Gnr/bnr', esc(e.gnrbnr || ''))}${rad('Konsesjon', `${esc(r.konsesjonsplikt.tekst)} ${esc(r.konsesjonsplikt.boplikt)}`)}${rad('Priskontroll', `${r.priskontroll.svar === 'ja' ? 'Ja' : r.priskontroll.svar === 'nei' ? 'Nei' : 'Må sjekkes'} – ${esc(r.priskontroll.tekst)}`)}${r.takst.kjopesum ? rad('Avtalt kjøpesum', kr(r.takst.kjopesum)) : ''}</table>
      <h2>Arealer</h2><table><tbody>${[['Fulldyrka jord', a.full], ['Overflatedyrka jord', a.overflate], ['Innmarksbeite', a.beite], ['Produktiv skog', a.produktiv], ['Uproduktiv skog og åpen mark', a.uproduktiv], ['Myr', a.myr], ['Bebygd', a.bebygd], ['Annet', a.annet]].filter(([, v]) => v > 0).map(([k, v]) => `<tr><td>${k}</td><td class="t">${daa(v)}</td></tr>`).join('')}<tr><th>Sum</th><th class="t">${daa(a.total)}</th></tr></tbody></table><p class="hint">Jordbruksarealer og markslag fra AR5 (NIBIO); produktiv skog fra bestandene i skogbruksplanen.</p>
      ${r.skogInfo ? `<h2>Skog</h2><p>${r.skogInfo.bestand} bestand, ca. ${r.skogInfo.volum.toLocaleString('nb-NO')} m³ stående volum. Avkastningsverdien er nåverdien av hogstinntektene per bestand ved beste hogsttidspunkt (aldri under PEFCs nedre hogstalder), pluss verdien av neste generasjon, med ${LT.RENTE} % kapitaliseringsrente. Miljøfigurer og arealer uten produksjon er satt av. Slaktverdi (alt hogd nå): ${kr(r.skogInfo.slakt)}.</p>` : ''}
      <h2>Verdier per del</h2><table><thead><tr><th>Del</th><th>Metode</th><th class="t">Verdi</th></tr></thead><tbody>${r.deler.map((d) => `<tr><td>${esc(d.navn)}${d.areal != null ? ` <span class="hint">${daa(d.areal)}</span>` : d.bta ? ` <span class="hint">${d.bta} m²${d.byggeaar ? `, ${d.byggeaar}` : ''}</span>` : ''}</td><td class="hint">${esc(d.metode)}</td><td class="t">${kr(d.verdi)}</td></tr>`).join('')}<tr><th colspan="2">Sum delverdier</th><th class="t">${kr(r.sum)}</th></tr></tbody></table>
      <h2>Varianter</h2><table><tbody>${Object.values(r.varianter).map((v) => `<tr><td><b>${esc(v.navn)}</b><div class="hint">${esc(v.bruk)}</div></td><td class="t">${kr(v.verdi)}</td></tr>`).join('')}</tbody></table>
      <p class="hint">Åsetestakst er satt uten boverdi og med ${r.varianter.asete.fradrag} % skjønnsmessig fradrag. Odelstakst og konsesjonsverdi bygger på samme delverdier; endelig verdi fastsettes ved skjønn og av takstmann/skjønnsretten.</p>
      ${r.takst.merknad ? `<h2>Merknad</h2><p>${esc(r.takst.merknad)}</p>` : ''}
      <h2>Kilder</h2><ul>${LT.KILDER.map((k) => `<li>${esc(k.navn)} – ${esc(k.url)}</li>`).join('')}</ul>
      <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`;
  }
  function skrivUt() {
    const w = window.open('', '_blank'); if (!w) { melding('Nettleseren stoppet utskriftsvinduet. Tillat sprettoppvinduer og prøv igjen.'); return; }
    w.document.open(); w.document.write(rapportHtml()); w.document.close();
  }
  return { tegn, rapportHtml };
}
