// Tiltak › Oppdrag › 🌲 Hogstmaskin (StanForD 2010): last ned filsettet til hogstmaskin og lassbærer, les inn
// produksjonsfilene etter drift og ajourfør oppdraget, bestandene og kartet. Logikken ligger i stanford.js.
import { VERSJONER, STANDARD_VERSJON, KOORDSYS, SORTIMENT_NAVN, TRESLAG_NAVN, KILDER, lagFilsett, zipAv, kartobjekter, lesProduksjonsfiler, beregnResultat, endringer, ajourfor, kartGeojson, importNokkel, nyeHensyn, simulerDrift } from './stanford.js';
import { OBJEKTTYPER, tomPefc } from './pefc.js';
import { VERSJON } from './versjon.js';
import { fmt } from './charts.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const opsj = (liste, valgt) => liste.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(valgt ?? '') ? 'selected' : ''}>${esc(t)}</option>`).join('');
const dato = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const HOGST = ['sluttavvirkning', 'tynning', 'lukkethogst'];
const lastNed = (data, navn, type) => { const url = URL.createObjectURL(new Blob([data], { type })); const a = document.createElement('a'); a.href = url; a.download = navn; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000); };
const fordeling = (obj, navn = (k) => k) => Object.entries(obj || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(navn(k))} ${fmt(v)} m³`).join(' · ');

export function lagStanfordUi({ hentPlan, endret, melding, visKartlag = () => {} }) {
  const S = () => hentPlan();
  let valg = { versjon: STANDARD_VERSJON, koordsys: 'EPSG:4326', apteringsinstruks: true, lassbaerer: true, konvolutt: true };
  let ventende = null; // { oppdragId, data, res, liste, hensyn, nokkel, valgteHensyn }
  let arbeider = ''; let vistKart = null;

  // Kartlaget for oppdraget: hogd flate, kjørespor, velteplasser og stammer.
  function kart(o) {
    const nokkel = o?.stanford?.resultat?.oppdatert ? `${o.id}|${o.stanford.resultat.oppdatert}` : null;
    if (nokkel === vistKart) return;
    vistKart = nokkel; visKartlag(nokkel ? kartGeojson(o) : null);
  }

  function eksportHtml(o) {
    const k = kartobjekter(S(), o); const st = o.stanford || {}; const sist = (st.eksportert || []).at(-1);
    const varsler = [
      !k.bestand.length ? 'Bestandene i oppdraget mangler kartflater – tegn eller importer bestandsgrensene først.' : null,
      !k.velteplasser.length ? 'Ingen velteplass i nærheten. Legg inn velteplass under Veier, så får lassbæreren posisjonen.' : null,
      !o.felt?.kjoper ? 'Tømmerkjøper er ikke fylt ut. Leveransene til lassbæreren får da ikke mottaker.' : null,
    ].filter(Boolean);
    return `<div class="sf-del"><h5>1 · Til maskinen</h5>
      <p class="hint">Filsettet åpnes i hogstmaskin og lassbærer (Komatsu MaxiXT, John Deere TimberMatic, Ponsse Opti og andre med StanForD 2010). Det har oppdraget med ${k.bestand.length} bestand som delobjekter, kart med ${k.hensynFlate.length + k.hensynPunkt.length} hensyn${k.linjer.length ? `, ${k.linjer.length} veier/stier/bekker` : ''} og ${k.velteplasser.length} velteplass${k.velteplasser.length === 1 ? '' : 'er'}, en apteringsinstruks og leveranser for lassbæreren.</p>
      ${varsler.map((v) => `<p class="sf-varsel">⚠ ${esc(v)}</p>`).join('')}
      <div class="skjema to-kol sf-valg">
        <label>StanForD-versjon <select data-sf-valg="versjon">${opsj(Object.entries(VERSJONER).map(([v, d]) => [v, d.navn]), valg.versjon)}</select></label>
        <label>Koordinater i kartet <select data-sf-valg="koordsys">${opsj(Object.entries(KOORDSYS).map(([v, d]) => [v, d.navn]), valg.koordsys)}</select></label>
      </div>
      <div class="sf-avkrysning">
        <label class="avkrysning"><input type="checkbox" data-sf-valg="apteringsinstruks" ${valg.apteringsinstruks ? 'checked' : ''}> <span>Apteringsinstruks (spi, pin)</span></label>
        <label class="avkrysning"><input type="checkbox" data-sf-valg="lassbaerer" ${valg.lassbaerer ? 'checked' : ''}> <span>Lassbærer (foi, fdi)</span></label>
        <label class="avkrysning"><input type="checkbox" data-sf-valg="konvolutt" ${valg.konvolutt ? 'checked' : ''}> <span>Kart i én fil (env)</span></label>
      </div>
      <div class="knapperad"><button type="button" class="knapp primar" data-sf="last-ned" ${k.bestand.length ? '' : 'disabled'}>⬇ Last ned filsett (ZIP)</button></div>
      ${sist ? `<p class="hint">Sist lastet ned ${esc(dato(sist.dato))} · versjon ${esc(sist.versjon)} · ${sist.filer} filer · objekt-ID ${esc(st.objektId)}</p>` : ''}
      <details class="ekstra"><summary>Hva er med i filsettet?</summary>
        <ul class="sf-liste">
          <li><b>.oin</b> objektinstruks: oppdrag, skogeier, eiendom, PEFC, bestandene som delobjekter, instruks og miljøhensyn som tekst til fører, og sortimentene.</li>
          <li><b>.ogi</b> kartinstruks med Shapefile-lag: bestandsgrenser, hensynsflater og -punkter med varselavstand (nøkkelbiotoper, kulturminner, livsløpstrær …), veier, stier og bekker, velteplasser og et tomt lag for kjørespor.</li>
          <li><b>.spi</b> og <b>.pin</b> treslag og en enkel apteringsinstruks (sagtømmer og massevirke). Har tømmerkjøperen sendt egen apteringsinstruks, bruk den – oin peker bare på sortimentenes ID.</li>
          <li><b>.foi</b> og <b>.fdi</b> lassbærerinstruks med velteplasser og leveranser.</li>
          <li><b>.env</b> kartinstruksen og alle kartfilene i én fil, for maskiner som vil ha det slik.</li>
        </ul>
        <p class="hint">Laget etter skjemaene fra Skogforsk og validert mot dem. <a href="${KILDER.skogforsk.url}" target="_blank" rel="noopener">${esc(KILDER.skogforsk.navn)}</a></p>
      </details></div>`;
  }

  function importHtml(o) {
    return `<div class="sf-del"><h5>2 · Etter drift</h5>
      <p class="hint">Les inn produksjonsfilene fra maskinene (.hpr fra hogstmaskinen, gjerne også .fpr, .thp, .mom, .ogr og .hqc – løse filer eller ZIP). Stammene fordeles på bestandene, tiltakene merkes utført med virkelig volum, bestandene oppdateres og hogd flate vises i kartet.</p>
      <div class="knapperad">
        <label class="knapp ${o.stanford?.resultat ? '' : 'primar'}">📂 Les inn produksjonsfiler<input type="file" data-sf-fil multiple accept=".hpr,.hprz,.thp,.thpz,.fpr,.fprz,.mom,.momz,.hqc,.hqcz,.ogr,.ogrz,.env,.zip,.shp,.dbf,.shx,.prj,.xml" hidden></label>
        <button type="button" class="knapp liten" data-sf="simuler" title="Lager produksjonsfiler som om oppdraget var hogd, så du kan prøve flyten">Prøv med simulert drift</button>
      </div></div>`;
  }

  function forhandsvisningHtml(o) {
    const { res, liste, hensyn } = ventende;
    const advarsler = [
      res.andreObjekter.length ? `Filene gjelder også andre objekter (${res.andreObjekter.slice(0, 3).map(esc).join(', ')}). Bare stammer i bestandene i dette oppdraget tas med.` : null,
      res.utenfor ? `${fmt(res.utenfor)} stammer (${fmt(res.utenforM3)} m³) ligger utenfor bestandene i oppdraget og tas ikke med.` : null,
      !res.bestand.length ? 'Ingen stammer kunne knyttes til bestandene i oppdraget.' : null,
      ventende.duplikat ? 'Disse filene er lest inn før. Ajourføringen erstatter forrige import.' : null,
    ].filter(Boolean);
    return `<div class="sf-del sf-forhand"><h5>Kontroller før ajourføring</h5>
      <p><b>${fmt(res.stammer)} stammer · ${fmt(res.m3)} m³fub</b>${res.middelstamme ? ` · middelstamme ${fmt(res.middelstamme, 2)} m³` : ''}${res.fra ? ` · ${esc(dato(res.fra))}${res.til !== res.fra ? ` – ${esc(dato(res.til))}` : ''}` : ''}</p>
      <p class="hint">${ventende.data.meldinger.map((m) => `${esc(m.fil)} (${m.type})`).join(', ')}${res.maskiner.length ? ` · ${res.maskiner.map((mi) => esc([mi.produsent, mi.modell].filter(Boolean).join(' '))).join(', ')}` : ''}</p>
      ${advarsler.map((v) => `<p class="sf-varsel">⚠ ${v}</p>`).join('')}
      ${liste.length ? `<div class="tabell"><table class="sf-tabell"><thead><tr><th>Bestand</th><th class="t">Stammer</th><th class="t">m³fub</th><th class="t">m³/daa</th><th class="t">Hogd</th><th>Endring</th></tr></thead><tbody>
        ${liste.map((e) => `<tr><td>${esc(e.bestand.nr)}</td><td class="t">${fmt(e.res.stammer)}</td><td class="t">${fmt(e.res.m3)}</td><td class="t">${e.res.m3PerDaa != null ? fmt(e.res.m3PerDaa, 1) : ''}</td><td class="t">${e.res.dekning != null ? `${Math.round(e.res.dekning * 100)} %` : '–'}</td><td>${esc(e.tekst)}</td></tr>`).join('')}
      </tbody></table></div>` : ''}
      ${res.lassbaerer ? `<p class="hint">Lassbærer: ${fmt(res.lassbaerer.lass)} lass, ${fmt(res.lassbaerer.m3)} m³ ved ${Object.keys(res.lassbaerer.velteplasser).map(esc).join(', ')}.</p>` : ''}
      ${hensyn.length ? `<h5>Nye objekter fra maskinføreren (${hensyn.length})</h5>${hensyn.map((h, i) => `<label class="avkrysning"><input type="checkbox" data-sf-hensyn="${i}" ${ventende.valgteHensyn.has(i) ? 'checked' : ''}> ${esc(OBJEKTTYPER[h.type]?.navn || h.type)}: ${esc(h.navn)} <span class="hint">${esc(h.fil)}</span></label>`).join('')}<p class="hint">Valgte objekter legges inn i miljøregistreringene (PEFC).</p>` : ''}
      ${res.spor ? `<p class="hint">${fmt(res.spor)} kjørespor fra maskinen vises i kartet.</p>` : ''}
      <div class="knapperad"><button type="button" class="knapp primar" data-sf="ajourfor" ${res.bestand.length || hensyn.length ? '' : 'disabled'}>✓ Ajourfør oppdrag, bestand og kart</button><button type="button" class="knapp" data-sf="avbryt">Avbryt</button></div></div>`;
  }

  function resultatHtml(o) {
    const r = o.stanford?.resultat; if (!r) return '';
    const kr = S().innstillinger?.pris || {};
    const verdi = Object.entries(r.treslag || {}).reduce((s, [t, v]) => s + v * (kr[t] || 0), 0);
    return `<div class="sf-del sf-resultat"><h5>Resultat fra maskinene</h5>
      <div class="sf-tall"><div><b>${fmt(r.m3)}</b><span>m³fub</span></div><div><b>${fmt(r.stammer)}</b><span>stammer</span></div><div><b>${fmt(r.middelstamme, 2)}</b><span>m³ middelstamme</span></div>${verdi ? `<div><b>${fmt(Math.round(verdi / 1000) * 1000)}</b><span>kr brutto (anslag)</span></div>` : ''}</div>
      <p class="hint">${r.fra ? `Hogd ${esc(dato(r.fra))}${r.til && r.til !== r.fra ? ` – ${esc(dato(r.til))}` : ''}. ` : ''}Sortiment: ${fordeling(r.sortiment, (k) => SORTIMENT_NAVN[k] || k) || '–'}. Treslag: ${fordeling(r.treslag, (k) => TRESLAG_NAVN[k] || k) || '–'}.</p>
      ${Object.keys(r.produkter || {}).length > 1 ? `<details class="ekstra"><summary>Per sortiment fra apteringen (${Object.keys(r.produkter).length})</summary><p class="hint">${fordeling(r.produkter)}</p></details>` : ''}
      <div class="tabell"><table class="sf-tabell"><thead><tr><th>Bestand</th><th class="t">Stammer</th><th class="t">m³fub</th><th class="t">m³/daa</th><th class="t">Hogd daa</th><th>Sortiment</th></tr></thead><tbody>
        ${r.bestand.map((b) => `<tr><td>${esc(b.nr)}</td><td class="t">${fmt(b.stammer)}</td><td class="t">${fmt(b.m3)}</td><td class="t">${b.m3PerDaa != null ? fmt(b.m3PerDaa, 1) : ''}</td><td class="t">${b.hogdDaa != null ? fmt(b.hogdDaa, 1) : ''}</td><td>${fordeling(b.sortiment, (k) => SORTIMENT_NAVN[k] || k)}</td></tr>`).join('')}
      </tbody></table></div>
      ${r.lassbaerer ? `<p class="hint">Lassbærer: ${fmt(r.lassbaerer.lass)} lass, ${fmt(r.lassbaerer.m3)} m³ kjørt fram${r.m3 ? ` (${Math.round((r.lassbaerer.m3 / r.m3) * 100)} % av hogd volum)` : ''} · ${Object.entries(r.lassbaerer.velteplasser).map(([k, v]) => `${esc(k)} ${fmt(v)} m³`).join(' · ')}</p>` : ''}
      ${r.drift ? `<p class="hint">Driftstid ${fmt(r.drift.timer, 1)} timer${r.drift.timer && r.m3 ? ` (${fmt(r.m3 / r.drift.timer, 1)} m³ per time)` : ''}${r.drift.drivstoff ? ` · drivstoff ${fmt(r.drift.drivstoff)} liter${r.m3 ? ` (${fmt(r.drift.drivstoff / r.m3, 2)} l/m³)` : ''}` : ''}</p>` : ''}
      ${r.kontrollstammer ? `<p class="hint">Kontrollmålte stammer (hqc): ${fmt(r.kontrollstammer)}</p>` : ''}
      <p class="hint">${r.maskiner.map((mi) => esc([mi.produsent, mi.modell, mi.program].filter(Boolean).join(' '))).join(' · ')}${(o.stanford.importer || []).length ? ` · ${o.stanford.importer.length} import${o.stanford.importer.length > 1 ? 'er' : ''}, sist ${esc(dato(o.stanford.importer.at(-1).dato))}` : ''}</p>
      <div class="knapperad"><button type="button" class="knapp liten" data-sf="kart">Vis hogd flate i kartet</button><button type="button" class="knapp liten" data-sf="csv">⬇ Resultat (CSV)</button></div></div>`;
  }

  function html(o) {
    if (!HOGST.includes(o.type)) return '';
    return `<div class="kort sf"><h4 class="undertittel" style="margin-top:0">🌲 Hogstmaskin (StanForD 2010)</h4>
      ${arbeider ? `<p class="hint">${esc(arbeider)}</p>` : ''}
      ${ventende?.oppdragId === o.id ? forhandsvisningHtml(o) : `${resultatHtml(o)}${eksportHtml(o)}${importHtml(o)}`}</div>`;
  }

  function lastNedFilsett(o, tegn) {
    let fs; try { fs = lagFilsett(S(), o, { ...valg, app: `SkogIQ.ai ${VERSJON}` }); } catch (e) { melding(e.message); return; }
    lastNed(zipAv(fs), fs.zipnavn, 'application/zip');
    o.stanford = { ...o.stanford, objektId: fs.oversikt.objektId, eksportert: [...(o.stanford?.eksportert || []), { dato: new Date().toISOString(), versjon: fs.oversikt.versjon, filer: fs.filer.length }].slice(-10) };
    if (o.status === 'utkast') o.status = 'bestilt';
    endret({ kart: false }); tegn();
    melding('Filsettet er lastet ned. Kopier mappen til en minnepinne og importer i maskinen (se LES_MEG.txt).');
  }

  async function lesFiler(o, filer, tegn) {
    arbeider = 'Leser produksjonsfilene …'; tegn();
    try {
      const data = await lesProduksjonsfiler(filer);
      const res = beregnResultat(S(), o, data);
      const nokkel = importNokkel(filer);
      const hensyn = nyeHensyn(S(), data);
      ventende = { oppdragId: o.id, data, res, liste: endringer(S(), o, res), hensyn, nokkel, valgteHensyn: new Set(hensyn.map((_, i) => i)), duplikat: (o.stanford?.importer || []).some((i) => i.id === nokkel) };
    } catch (e) { melding(e.message || 'Klarte ikke å lese filene.'); }
    arbeider = ''; tegn();
  }

  function bruk(o, tegn) {
    const v = ventende; if (!v || v.oppdragId !== o.id) return;
    const plan = S();
    const liste = v.res.bestand.length ? ajourfor(plan, o, v.res, v.data, { importId: v.nokkel }) : [];
    const valgte = v.hensyn.filter((_, i) => v.valgteHensyn.has(i));
    if (valgte.length) {
      plan.pefc = plan.pefc || tomPefc();
      const idag = new Date().toISOString().slice(0, 10);
      for (const h of valgte) plan.pefc.objekter.push({ id: `po${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, type: h.type, navn: h.navn, geometri: h.geometri, kilde: 'maskin', registrert: idag, oppdragId: o.id });
    }
    ventende = null; vistKart = null;
    endret({ kart: true }); tegn();
    melding(`${o.nr} er ajourført: ${liste.length} bestand oppdatert${valgte.length ? `, ${valgte.length} nye miljøobjekter` : ''}. Status: ${o.status === 'utfort' ? 'utført' : 'pågår'}.`);
  }

  function csv(o) {
    const r = o.stanford?.resultat; if (!r) return;
    const rader = [['Bestand', 'Stammer', 'm3fub', 'm3pb', 'm3 per daa', 'Middelstamme', 'Hogd daa', 'Gran m3', 'Furu m3', 'Lauv m3', 'Sagtømmer m3', 'Massevirke m3', 'Energivirke m3', 'Fra', 'Til'],
      ...r.bestand.map((b) => [b.nr, b.stammer, b.m3, b.m3pb, b.m3PerDaa ?? '', b.middelstamme, b.hogdDaa ?? '', b.treslag.G || 0, b.treslag.F || 0, b.treslag.L || 0, b.sortiment.sagtommer || 0, b.sortiment.massevirke || 0, b.sortiment.energi || 0, b.fra, b.til])];
    lastNed(`﻿${rader.map((x) => x.map((c) => (typeof c === 'number' ? String(c).replace('.', ',') : `"${String(c).replace(/"/g, '""')}"`)).join(';')).join('\n')}`, `${o.nr}_produksjon.csv`, 'text/csv;charset=utf-8');
  }

  async function klikk(e, o, tegn) {
    const k = e.target.closest('[data-sf]')?.dataset.sf; if (!k) return false;
    if (k === 'last-ned') lastNedFilsett(o, tegn);
    if (k === 'simuler') { const sim = simulerDrift(S(), o); await lesFiler(o, sim.map((f) => ({ navn: f.navn, data: new TextEncoder().encode(f.data) })), tegn); return true; }
    if (k === 'ajourfor') bruk(o, tegn);
    if (k === 'avbryt') { ventende = null; tegn(); }
    if (k === 'kart') { vistKart = null; kart(o); }
    if (k === 'csv') csv(o);
    return true;
  }
  function endring(e, o, tegn) {
    const f = e.target;
    if (f.matches('[data-sf-valg]')) { valg = { ...valg, [f.dataset.sfValg]: f.type === 'checkbox' ? f.checked : f.value }; return true; }
    if (f.matches('[data-sf-hensyn]') && ventende) { const i = Number(f.dataset.sfHensyn); if (f.checked) ventende.valgteHensyn.add(i); else ventende.valgteHensyn.delete(i); return true; }
    if (f.matches('[data-sf-fil]')) {
      const liste = [...f.files]; if (!liste.length) return true;
      Promise.all(liste.map(async (x) => ({ navn: x.name, data: new Uint8Array(await x.arrayBuffer()) }))).then((filer) => lesFiler(o, filer, tegn));
      return true;
    }
    return false;
  }
  return { html, klikk, endring, kart, lukk() { if (vistKart) { vistKart = null; visKartlag(null); } } };
}
