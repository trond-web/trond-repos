// Tiltak › Oppdrag › 🚧 Skiltplan: finner hvor oppdraget berører offentlig veg (velteplass, kryssing, hogst inntil
// vegen) og stier, foreslår skilt med plassering, lister søknader og krav, og lager en utskrift som kan legges ved
// søknaden om arbeidsvarsling. Logikken ligger i skiltplan.js.
import * as SP from './skiltplan.js';
import { linjer } from './oppdrag.js';
import { svgKart } from './rapporter.js';
import { VEIKLASSER } from './veier.js';

const HOGST = ['sluttavvirkning', 'tynning', 'lukkethogst'];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iDag = () => new Date().toISOString().slice(0, 10);
const dato = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const pos = (p) => `${p[1].toFixed(5)}, ${p[0].toFixed(5)}`;

export function lagSkiltplanUi({ hentPlan, endret, melding, visLag }) {
  const S = () => hentPlan();
  let henter = null; let vist = null;

  function html(o) {
    const sp = o.skiltplan; const hode = '<h4 class="undertittel" style="margin-top:0">🚧 Skiltplan</h4>';
    if (henter === o.id) return `<div class="kort sp">${hode}<p class="dv-framdrift" id="spFramdrift">Henter veger og fartsgrenser …</p></div>`;
    if (!sp) {
      return `<div class="kort sp">${hode}<p class="hint" style="margin-top:0">Finn ut hvilke skilt og søknader oppdraget krever. SkogIQ sjekker om velteplassen ligger ved offentlig veg, om driftsvegen krysser veg, om det hogges inntil vegen og om stier går inn i fareområdet. Du får foreslått skilt med plassering, en kravliste og en utskrift som kan legges ved søknaden om arbeidsvarsling.</p>
        ${!o.driftsveg && !(S().veier?.punkter || []).some((p) => p.type === 'velteplass') ? '<p class="hint">Tips: Lag driftsveg-forslag først, eller legg inn velteplassen i Veier-fanen, så kan skiltplanen plassere skilt ved velteplassen.</p>' : ''}
        <div class="knapperad"><button type="button" class="knapp primar" data-sp="lag">🚧 Lag skiltplan</button></div></div>`;
    }
    const beholdt = sp.status === 'beholdt'; const a = sp.ansvarlig || {}; const utlopt = a.gyldigTil && a.gyldigTil < iDag();
    const trengerSoknad = sp.soknader.length > 0;
    return `<div class="kort sp ${beholdt ? 'beholdt' : ''}">${hode}
      <p style="margin-top:0"><span class="pille" style="--farge:${beholdt ? '#0ca30c' : '#e07b00'}">${beholdt ? 'Beholdt' : 'Forslag'}</span> laget ${esc(sp.laget)} · ${sp.skilt.length} skilt · ${sp.situasjoner.length} steder</p>
      ${sp.advarsler?.length ? `<div class="dv-advarsel">${sp.advarsler.map((x) => `<p>⚠️ ${esc(x)}</p>`).join('')}</div>` : ''}
      <div class="sp-boks ${trengerSoknad ? 'krav' : 'ok'}">${trengerSoknad
        ? `<b>Krever godkjent arbeidsvarslingsplan før oppstart</b>${sp.soknader.map((s) => `<p><b>${esc(s.myndighet)}</b>: ${esc(s.hvordan)}<br><span class="hint">Gjelder: ${esc(s.gjelder.join('; '))}</span></p>`).join('')}<p class="hint">Planen skal gjelde hele drifta, til siste lass er hentet. <a href="${SP.KILDER.soknad.url}" target="_blank" rel="noopener">Slik søker du</a></p>`
        : '<b>Ingen arbeidsvarslingsplan ut fra dataene</b><p class="hint">Fant ingen velteplass, kryssing eller hogst inntil offentlig veg. Kontroller i terrenget: kommer tømmeret ut til offentlig veg, trengs en plan.</p>'}</div>
      ${sp.situasjoner.length ? `<h5 class="sp-h">Steder som krever varsling</h5><ul class="sp-liste">${sp.situasjoner.map((s) => `<li><b>${esc(s.id)}</b> ${esc(s.tittel)}${s.sammeSkilt ? ` <span class="hint">· dekkes av skiltene for ${esc(s.sammeSkilt)}</span>` : s.avstand ? ` <span class="hint">· varselskilt ca. ${s.avstand} m før</span>` : ''}${s.avstandVeg != null ? ` <span class="hint">· ${s.avstandVeg} m fra vegen</span>` : ''}</li>`).join('')}</ul>` : ''}
      ${sp.skilt.length ? `<h5 class="sp-h">Skilt</h5><div class="tabell-wrap"><table class="tabell sp-tabell"><thead><tr><th>#</th><th>Skilt</th><th>Hva</th><th>Plassering</th></tr></thead><tbody>${sp.skilt.map((s, i) => `<tr><td>${i + 1}<br><span class="hint">${esc(s.situasjon)}</span></td><td>${SP.skiltSvg(s, 28)}</td><td>${esc(SP.skiltTekst(s))}</td><td class="hint">${esc(s.merknad)}<br>${pos(s.punkt)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <h5 class="sp-h">Ansvarlig for arbeidsvarslingen</h5>
      <div class="skjema to-kol">
        <label>Navn <input data-sp-a="navn" value="${esc(a.navn)}"></label><label>Telefon <input data-sp-a="telefon" type="tel" value="${esc(a.telefon)}"></label>
        <label>Kompetansebevis nr. <input data-sp-a="bevis" value="${esc(a.bevis)}"></label><label>Beviset gjelder til <input data-sp-a="gyldigTil" type="date" value="${esc(a.gyldigTil)}"></label>
        <label>Skilt settes opp <input data-sp-p="fra" type="date" value="${esc(sp.periode?.fra)}"></label><label>Skilt tas ned (siste lass hentet) <input data-sp-p="til" type="date" value="${esc(sp.periode?.til)}"></label>
      </div>
      ${utlopt ? '<p class="dv-advarsel">⚠️ Kompetansebeviset er utløpt. Det gjelder i 5 år og må fornyes før arbeidet starter.</p>' : ''}
      ${trengerSoknad && !a.bevis ? `<p class="hint">Den som er ansvarlig for arbeidsvarslingen må ha kompetansebevis (kurs i arbeidsvarsling, gyldig i 5 år). <a href="${SP.KILDER.kurs.url}" target="_blank" rel="noopener">Om kurset</a></p>` : ''}
      <h5 class="sp-h">Krav <span class="hint">${sp.krav.filter((k) => sp.sjekk?.[k.id]).length} av ${sp.krav.length}</span></h5>
      <div class="oppdrag-sjekk">${sp.krav.map((k) => `<label class="avkrysning"><input type="checkbox" data-sp-krav="${k.id}" ${sp.sjekk?.[k.id] ? 'checked' : ''}> <span>${esc(k.tekst)} <a class="hint" href="${SP.KILDER[k.kilde]?.url || '#'}" target="_blank" rel="noopener">kilde</a></span></label>`).join('')}</div>
      <div class="knapperad">
        <button type="button" class="knapp liten" data-sp="vis">Vis i kartet</button>
        ${beholdt ? '' : '<button type="button" class="knapp primar" data-sp="behold">✓ Behold skiltplanen</button>'}
        <button type="button" class="knapp liten" data-sp="skriv">🖨 Skriv ut skiltplan</button>
        <button type="button" class="knapp liten" data-sp="lag">↻ Lag på nytt</button>
        <button type="button" class="knapp liten fare" data-sp="slett">Slett</button>
      </div></div>`;
  }

  function kart(o, { zoom = false } = {}) { vist = o?.skiltplan ? o.id : null; visLag(o?.skiltplan ? { skilt: o.skiltplan.skilt, situasjoner: o.skiltplan.situasjoner } : null, { zoom }); }
  function lukk() { if (vist) { vist = null; visLag(null); } }

  async function lag(o, tegn) {
    if (henter) return; henter = o.id; tegn();
    const framdrift = (t) => { const el = document.getElementById('spFramdrift'); if (el) el.textContent = t; };
    try {
      const plan = S(); const ls = linjer(plan, o); const advarsler = [];
      const feltGeo = ls.map(({ bestand: b, tiltak: t }) => t.geometri || b.geometri).filter((g) => g && /Polygon/.test(g.type));
      if (!feltGeo.length) throw new Error('Oppdraget har ingen flater med kartgeometri.');
      const felt = feltGeo.map(SP.utmPolygon);
      const alle = felt.flatMap((g) => (g.type === 'Polygon' ? g.coordinates : g.coordinates.flat()).flat());
      let [x0, y0, x1, y1] = [Math.min(...alle.map((p) => p[0])), Math.min(...alle.map((p) => p[1])), Math.max(...alle.map((p) => p[0])), Math.max(...alle.map((p) => p[1]))];
      const naer = (p) => p[0] > x0 - 1500 && p[0] < x1 + 1500 && p[1] > y0 - 1500 && p[1] < y1 + 1500;
      const velte = [...(o.driftsveg?.velteplasser || []), ...(plan.veier?.punkter || []).filter((p) => p.type === 'velteplass' && p.geometri?.type === 'Point').map((p) => p.geometri.coordinates)].map(SP.utmPunkt).filter(naer)
        .filter((p, i, a) => a.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 30) === i);
      if (!velte.length) advarsler.push('Ingen velteplass er kjent. Lag driftsveg-forslag eller legg inn velteplassen i Veier-fanen, og lag skiltplanen på nytt.');
      for (const p of velte) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
      const V = await import('./veier.js');
      let offentlige = [];
      try { offentlige = await V.hentOffentligeVeier([x0 - 400, y0 - 400, x1 + 400, y1 + 400], { logg: framdrift }); } catch { advarsler.push('Fikk ikke hentet offentlige veger fra NVDB. Kontroller manuelt om tømmeret skal ut til offentlig veg.'); }
      const register = plan.veier?.veier || [];
      const privat = register.filter((v) => v.geometri && v.status !== 'planlagt' && (VEIKLASSER[v.klasse] || VEIKLASSER[0]).bilvei && !/^[ERFK]V/.test(v.vegnummer || '')).map((v) => ({ kategori: /\(P\)|^PV/.test(`${v.kategori} ${v.vegnummer}`) ? 'P' : 'S', ref: v.vegnummer || v.navn || '', linjer: SP.utmLinjer(v.geometri) }));
      let stier = (plan.veier?.stier || []).filter((x) => x.geometri).map((x) => x.geometri);
      if (!stier.length && HOGST.includes(o.type)) {
        framdrift('Henter stier fra Kartverket (FKB) …');
        try { const r = await V.hentTraktorveierOgStier({ type: 'MultiPolygon', coordinates: feltGeo.flatMap((f) => (f.type === 'Polygon' ? [f.coordinates] : f.coordinates)) }); stier = r.stier.map((x) => x.geometri); } catch { advarsler.push('Fikk ikke hentet stier fra Kartverket – sjekk stier og løyper manuelt.'); }
      }
      framdrift('Lager skiltplan …');
      const r = SP.lagSkiltplan({
        felt, velteplasser: velte, driftsveg: o.driftsveg ? SP.utmLinjer(o.driftsveg.geometri) : [],
        offentlige: offentlige.map((v) => ({ kategori: v.kategori, ref: v.ref, linjer: SP.utmLinjer(v.geometri), fartDeler: v.fartDeler.map((f) => ({ fart: f.fart, linjer: SP.utmLinjer(f.geometri) })) })),
        private: privat, stier: stier.flatMap(SP.utmLinjer), idag: iDag(),
      }, { hogst: HOGST.includes(o.type) });
      const gammel = o.skiltplan;
      // Offentlige veger i nærheten (forenklet) til skissen i utskriften.
      const forenkle = (l) => l.filter((_, i) => i % 3 === 0 || i === l.length - 1).map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]);
      const veger = offentlige.map((v) => ({ kategori: v.kategori, ref: v.ref, geometri: { type: 'MultiLineString', coordinates: v.geometri.coordinates.map(forenkle) } }));
      o.skiltplan = { ...r, veger, status: 'forslag', advarsler, ansvarlig: gammel?.ansvarlig || {}, periode: gammel?.periode || { fra: o.periode?.fra || '', til: o.periode?.til || '' }, sjekk: gammel?.sjekk || {} };
      endret({ kart: false }); henter = null; tegn(); kart(o, { zoom: true });
      melding(r.soknader.length ? `Skiltplan: ${r.skilt.length} skilt. Oppdraget krever godkjent arbeidsvarslingsplan (${r.soknader.map((s) => s.myndighet).join(', ')}).` : `Skiltplan laget: ${r.skilt.length} skilt. Ingen arbeidsvarslingsplan ut fra dataene.`);
    } catch (e) { henter = null; tegn(); melding(e.message || 'Klarte ikke å lage skiltplan.', 'feil'); }
  }

  function skrivUt(o) {
    const plan = S(); const sp = o.skiltplan; const a = sp.ansvarlig || {};
    const ider = new Set(linjer(plan, o).map((l) => l.bestand.id));
    const farge = (s) => (s.skilt.includes('362') ? '#d0021b' : s.skilt.includes('info') ? '#e07b00' : '#c9a400');
    const ekstra = [...(sp.veger || []).map((v) => ({ geometri: v.geometri, farge: '#555555', bredde: 4 })), ...(o.driftsveg?.status === 'beholdt' ? [{ geometri: o.driftsveg.geometri, farge: '#e07b00' }] : []), ...sp.skilt.map((s, i) => ({ geometri: { type: 'Point', coordinates: s.punkt }, farge: farge(s), tekst: String(i + 1) }))];
    const k = svgKart(plan, (b) => (ider.has(b.id) ? '#f39c4a' : '#eef0ea'), { bredde: 960, hoyde: 560, ekstra, markslag: false });
    const w = window.open('', '_blank'); if (!w) { melding('Nettleseren blokkerte utskriftsvinduet.'); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Skiltplan ${esc(o.nr)}</title><style>body{font:12px/1.45 system-ui,sans-serif;max-width:1000px;margin:20px auto;padding:0 16px;color:#111}h1{font-size:22px;margin:0}h2{font-size:15px;margin:18px 0 6px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ccc;padding:5px;text-align:left;vertical-align:top}.boks{border:2px solid #d0021b;border-radius:8px;padding:8px 12px;margin:10px 0}.ok{border-color:#0a8a0a}.sp-skilt svg{margin-right:3px}.liten{color:#555;font-size:11px}@media print{button{display:none}}</style>
      <button onclick="print()">Skriv ut</button>
      <h1>Skiltplan – ${esc(o.nr)} ${esc(o.tittel || '')}</h1>
      <p>${esc(plan.eiendom?.navn || '')}${plan.eiendom?.kommune ? `, ${esc(plan.eiendom.kommune)} kommune` : ''}${plan.eiendom?.gnrbnr ? ` · gnr/bnr ${esc(plan.eiendom.gnrbnr)}` : ''} · laget ${esc(dato(sp.laget))}</p>
      <table><tr><th>Byggherre (skogeier)</th><td>${esc(plan.eiendom?.eier || '')}</td><th>Entreprenør</th><td>${esc(o.utforer?.navn || '')} ${esc(o.utforer?.telefon || '')}</td></tr>
      <tr><th>Ansvarlig for arbeidsvarsling</th><td>${esc(a.navn || '')} ${esc(a.telefon || '')}</td><th>Kompetansebevis</th><td>${esc(a.bevis || '')}${a.gyldigTil ? ` (gyldig til ${esc(dato(a.gyldigTil))})` : ''}</td></tr>
      <tr><th>Skilt settes opp</th><td>${esc(dato(sp.periode?.fra) || 'etter avtale')}</td><th>Skilt tas ned</th><td>${esc(dato(sp.periode?.til) || 'når siste lass er hentet')}</td></tr></table>
      <div class="boks ${sp.soknader.length ? '' : 'ok'}">${sp.soknader.length ? `<b>Krever godkjent arbeidsvarslingsplan før oppstart.</b>${sp.soknader.map((s) => `<br>${esc(s.myndighet)}: ${esc(s.hvordan)}`).join('')}<br>Planen gjelder hele drifta, til siste lass er hentet.` : '<b>Ingen arbeidsvarslingsplan ut fra dataene.</b> Kontroller i terrenget.'}</div>
      <h2>Arbeidsbeskrivelse</h2><p>${esc(o.tittel || o.type)}. ${sp.situasjoner.map((s) => `${s.id}: ${esc(s.tittel)}.`).join(' ')} ${esc(o.merknad || '')}</p>
      <h2>Kart</h2>${k}<p class="liten">Tallene er skiltnumrene i tabellen. Gul: varselskilt. Rød: fartsgrense. Oransje: informasjonsskilt og driftsveg. Grå: offentlig veg (${esc([...new Set((sp.veger || []).map((v) => v.ref).filter(Boolean))].join(', '))}). Oransje flater: hogstflater i oppdraget.</p>
      <h2>Skilt</h2><table><tr><th>#</th><th>Skilt</th><th>Hva</th><th>Plassering</th></tr>${sp.skilt.map((s, i) => `<tr><td>${i + 1} (${esc(s.situasjon)})</td><td>${SP.skiltSvg(s, 30)}</td><td>${esc(SP.skiltTekst(s))}</td><td>${esc(s.merknad)}<br><span class="liten">${pos(s.punkt)}</span></td></tr>`).join('')}</table>
      <h2>Risikovurdering og tiltak</h2><table>${sp.krav.map((x) => `<tr><td>${sp.sjekk?.[x.id] ? '☑' : '☐'}</td><td>${esc(x.tekst)}</td></tr>`).join('')}</table>
      <h2>Kilder</h2><ul class="liten">${Object.values(SP.KILDER).map((x) => `<li>${esc(x.navn)}: ${esc(x.url)}</li>`).join('')}</ul>
      <p class="liten">Skiltplanen er et forslag fra SkogIQ.ai basert på kartdata. Endelig plassering og skilt bestemmes i arbeidsvarslingsplanen som godkjennes av skiltmyndigheten.</p>`);
    w.document.close();
  }

  function klikk(e, o, tegn) {
    const k = e.target.closest('[data-sp]'); if (!k) return false; const h = k.dataset.sp; const sp = o.skiltplan;
    if (h === 'lag') { lag(o, tegn); return true; }
    if (!sp) return true;
    if (h === 'vis') kart(o, { zoom: true });
    if (h === 'behold') { sp.status = 'beholdt'; endret({ kart: false }); tegn(); kart(o); melding('Skiltplanen er beholdt.'); }
    if (h === 'skriv') skrivUt(o);
    if (h === 'slett') { if (sp.status === 'beholdt' && !confirm('Slette den beholdte skiltplanen?')) return true; delete o.skiltplan; endret({ kart: false }); tegn(); lukk(); melding('Skiltplanen er slettet.'); }
    return true;
  }
  function endring(e, o) {
    const t = e.target; const sp = o.skiltplan; if (!sp) return false;
    if (t.dataset.spKrav) { sp.sjekk = { ...sp.sjekk, [t.dataset.spKrav]: t.checked }; endret({ kart: false }); return true; }
    if (t.dataset.spA) { sp.ansvarlig = { ...sp.ansvarlig, [t.dataset.spA]: t.value }; endret({ kart: false }); return true; }
    if (t.dataset.spP) { sp.periode = { ...sp.periode, [t.dataset.spP]: t.value }; endret({ kart: false }); return true; }
    return false;
  }
  return { html, klikk, endring, kart, lukk };
}
