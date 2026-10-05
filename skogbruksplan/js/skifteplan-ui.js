// Fanen «Skifteplan»: jordbruksskifter i kartet, vekster og jordprøver, gjødslingsplan, plantevernjournal og
// kontroll mot kravene i gjødselforskriften og forskrift om plantevernmidler.
import {
  KILDER, GRUPPER, KULTURER, JORDARBEIDING, MINERAL, HUSDYR, SPREDEMAATE, REGIONER, AR5_JORDBRUK, IPV, JORDSMONN_KARTLAG, INNDELING,
  tomSkifteplan, nyttSkifte, skifterFraMarkslag, hentJordsmonn, gjodselbehov, naering, produktNavn, sumGjodsling,
  foreslaGjodsling, kontroller, fosforSnitt, fosforgrense, aktiveSkifter, nySproyting, tidligsteHosting, oppsummer,
  gjodslingsplanCsv, sproytejournalCsv, kartskisse, avstandTilVann,
} from './skifteplan.js';
import { arealM2 } from './proj.js';
import { fmt } from './charts.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NIVAA = { avvik: { navn: 'Avvik', farge: 'var(--critical)', ikon: '✕' }, varsel: { navn: 'Varsel', farge: '#c77800', ikon: '!' }, info: { navn: 'Info', farge: 'var(--accent)', ikon: 'i' }, ok: { navn: 'OK', farge: 'var(--good)', ikon: '✓' } };
const idag = () => new Date().toISOString().slice(0, 10);
const tall = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? '' : Number(v));

export function initSkifteplan({ kart, hentPlan, endret, melding, nyId, settKartKlikk, hentJordbruk, lagInndeling, iAar = new Date().getFullYear() }) {
  const lag = L.layerGroup();
  const wms = {};
  let underfane = 'skifter';
  let valgt = null; let tegner = null; let synlig = false; let arbeider = '';

  const SP = () => {
    const S = hentPlan();
    if (!S.skifteplan) S.skifteplan = tomSkifteplan(iAar, S.eiendom?.kommunenr);
    const p = S.skifteplan; const tom = tomSkifteplan(iAar, S.eiendom?.kommunenr);
    for (const [k, v] of Object.entries(tom)) if (p[k] === undefined) p[k] = v;
    return p;
  };
  const aar = () => Number(SP().aar) || iAar;
  const lagre = (kartOgsaa = true) => { endret({ kart: false }); if (kartOgsaa) tegnKart(); tegn(); };
  const finn = (id) => SP().skifter.find((s) => s.id === id);

  // ---------- kart ----------
  function tegnKart() {
    lag.clearLayers();
    const p = SP(); const a = aar();
    for (const sk of p.skifter) {
      if (!sk.geometri) continue;
      const k = KULTURER[sk.vekster?.[a]?.kultur]; const farge = GRUPPER[k?.gruppe]?.farge || '#ffffff';
      const er = sk.id === valgt;
      const l = L.geoJSON(sk.geometri, { style: { color: er ? '#ffd400' : '#3d3108', weight: er ? 4 : 2.4, fillColor: farge, fillOpacity: k ? 0.6 : 0.3 } });
      l.bindTooltip(`<b>${esc(sk.nr)}</b>${k ? ` ${esc(k.navn.split(',')[0])}` : ''}`, { permanent: true, direction: 'center', className: 'sp-etikett' });
      l.on('click', (e) => { L.DomEvent.stopPropagation(e); if (tegner) tegner.klikk(e.latlng); else velg(sk.id, { zoom: false }); });
      l.addTo(lag);
    }
    const vis = p.visLag || {};
    for (const [id, c] of Object.entries(JORDSMONN_KARTLAG)) {
      if (vis[id] && !wms[id]) wms[id] = L.tileLayer.wms(c.url, { layers: c.lag, format: 'image/png', transparent: true, opacity: 0.6, attribution: 'Jordsmonn © NIBIO' }).addTo(kart);
      if (!vis[id] && wms[id]) { wms[id].remove(); delete wms[id]; }
    }
  }
  function zoom(sk) { if (sk?.geometri) kart.fitBounds(L.geoJSON(sk.geometri).getBounds(), { padding: [40, 40], maxZoom: 17 }); }
  function zoomAlle() { const g = SP().skifter.filter((s) => s.geometri); if (g.length) kart.fitBounds(L.geoJSON({ type: 'GeometryCollection', geometries: g.map((s) => s.geometri) }).getBounds(), { padding: [30, 30] }); }
  function velg(id, { zoom: z = true } = {}) {
    valgt = id; if (underfane !== 'skifter' && underfane !== 'gjodsling') underfane = 'skifter';
    tegnKart(); tegn();
    if (z) zoom(finn(id));
    setTimeout(() => $(`#fane-skifteplan [data-sp-kort="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
  }

  // ---------- tegning ----------
  function startTegning() {
    stopp();
    tegner = { pkt: [], linje: null };
    $('#spTegnHjelp').hidden = false;
    kart.getContainer().style.cursor = 'crosshair'; kart.doubleClickZoom.disable();
    tegner.klikk = (ll) => {
      tegner.pkt.push([ll.lng, ll.lat]);
      const lls = tegner.pkt.map(([x, y]) => [y, x]);
      if (tegner.linje) tegner.linje.setLatLngs(lls); else tegner.linje = L.polygon(lls, { color: '#ffd400', weight: 3, dashArray: '6 6' }).addTo(kart);
    };
    settKartKlikk(tegner.klikk);
  }
  function stopp() {
    if (tegner?.linje) tegner.linje.remove();
    tegner = null; const h = $('#spTegnHjelp'); if (h) h.hidden = true;
    kart.getContainer().style.cursor = ''; kart.doubleClickZoom.enable(); settKartKlikk(null);
  }
  function fullfor() {
    if (!tegner || tegner.pkt.length < 3) { melding('Sett minst tre punkter rundt skiftet.'); return; }
    const c = tegner.pkt; const geometri = { type: 'Polygon', coordinates: [[...c, c[0]]] };
    stopp();
    const p = SP(); const nr = p.skifter.reduce((m, s) => Math.max(m, parseInt(s.nr, 10) || 0), 0) + 1;
    const sk = nyttSkifte({ nr, geometri, areal: arealM2(geometri) / 1000, nyId });
    p.skifter.push(sk); valgt = sk.id; underfane = 'skifter';
    lagre(); melding(`Skifte ${nr} er lagt til (${fmt(sk.areal, 1)} daa). Velg vekst og legg inn jordprøve.`);
    hentJordsmonnFor([sk]);
  }

  // ---------- data ----------
  async function autoInndeling() {
    const p = SP();
    if (p.skifter.length && !confirm('Lage ny automatisk skifteinndeling? Eksisterende skifter med vekster, jordprøver og gjødsling erstattes.')) return;
    arbeider = 'Lager skifteinndeling …'; tegn();
    try {
      const r = await lagInndeling((t) => { arbeider = t; tegn(); });
      p.skifter = r.skifter; p.inndeling = { ...r.logg, laget: new Date().toISOString().slice(0, 10) };
      const ider = new Set(p.skifter.map((x) => x.id));
      for (const x of p.sproyting || []) x.skifter = (x.skifter || []).filter((id) => ider.has(id));
      valgt = null; arbeider = '';
      lagre(); zoomAlle();
      melding(r.skifter.length ? `${r.skifter.length} skifter på ${fmt(r.logg.areal)} daa${r.logg.delt ? ` – ${r.logg.delt} AR5-figurer delt etter jordsmonn` : ''}.` : 'Fant ikke jordbruksareal i AR5 på eiendommen.', 6000);
    } catch (e) { arbeider = ''; tegn(); melding(`Kunne ikke lage skifteinndeling: ${e.message}`, 6000); }
  }
  async function hentFraAr5() {
    arbeider = 'Henter jordbruksareal fra AR5 …'; tegn();
    try {
      const fig = await hentJordbruk((t) => { arbeider = t; tegn(); });
      const nye = skifterFraMarkslag(SP(), fig || [], { iAar: aar(), nyId });
      arbeider = '';
      lagre(); zoomAlle();
      melding(nye.length ? `${nye.length} skifter hentet fra AR5 (${fmt(nye.reduce((s, x) => s + x.areal, 0))} daa). Henter jordsmonn …` : 'Fant ikke nytt jordbruksareal i AR5 på eiendommen.', 6000);
      if (nye.length) await hentJordsmonnFor(nye);
    } catch (e) { arbeider = ''; tegn(); melding(`Kunne ikke hente AR5: ${e.message}`, 6000); }
  }
  async function hentJordsmonnFor(liste) {
    const ko = liste.filter((s) => s.geometri); let ferdig = 0; let feil = 0;
    const jobb = async (sk) => { try { sk.jordsmonn = await hentJordsmonn(sk.geometri); } catch { feil++; } ferdig++; arbeider = `Jordsmonn ${ferdig}/${ko.length} …`; if (synlig) tegn(); };
    const koe = [...ko];
    await Promise.all([0, 1, 2].map(async () => { while (koe.length) await jobb(koe.shift()); }));
    arbeider = '';
    endret({ kart: false }); tegn();
    if (feil) melding(`Jordsmonn kunne ikke hentes for ${feil} skifter.`);
  }

  // ---------- HTML ----------
  const kulturValg = (v) => `<option value="">–</option>${Object.entries(GRUPPER).map(([g, gr]) => `<optgroup label="${esc(gr.navn)}">${Object.entries(KULTURER).filter(([, k]) => k.gruppe === g).map(([id, k]) => `<option value="${id}" ${v === id ? 'selected' : ''}>${esc(k.navn)}</option>`).join('')}</optgroup>`).join('')}`;
  const vekstNavn = (sk, a) => KULTURER[sk.vekster?.[a]?.kultur]?.navn || '';
  const prik = (sk, a) => `<i class="sp-prikk" style="--farge:${GRUPPER[KULTURER[sk.vekster?.[a]?.kultur]?.gruppe]?.farge || 'transparent'}"></i>`;

  function toppHtml() {
    const p = SP(); const a = aar();
    const aarValg = [iAar - 3, iAar - 2, iAar - 1, iAar, iAar + 1].map((x) => `<option value="${x}" ${x === a ? 'selected' : ''}>${x}</option>`).join('');
    const o = oppsummer(hentPlan(), a);
    return `<div class="sp-topp"><label>Planår <select data-sp-aar>${aarValg}</select></label>
      <span class="hint">${p.skifter.length} skifter · ${fmt(o?.areal || 0, 1)} daa${o?.avvik ? ` · <a href="#" data-sp-under-lenke="krav" class="sp-avvik">${o.avvik} avvik</a>` : ''}</span></div>
      ${arbeider ? `<div class="sp-arbeider">${esc(arbeider)}</div>` : ''}`;
  }

  function skifterHtml() {
    const p = SP(); const a = aar(); const S = hentPlan();
    if (!p.skifter.length) {
      return `<div class="kort"><h3>Lag skifteplan for jordbruksarealet</h3>
        <p>Skifteplanen samler skifteinndeling, vekster, jordprøver, gjødslingsplan og plantevernjournal for gården – og kontrollerer mot kravene i gjødselforskriften (2025) og forskrift om plantevernmidler.</p>
        <p class="hint">Skiftene lages automatisk fra arealressurskartet AR5 og NIBIOs jordsmonnkart (se prinsippene under), eller tegnes i kartet. Nye skogbruksplaner får skifteinndelingen når planen opprettes.</p>
        <div class="knapperad"><button type="button" class="knapp primar" data-sp="auto" ${arbeider ? 'disabled' : ''}>Lag skifteinndeling automatisk</button><button type="button" class="knapp" data-sp="tegn">Tegn skifte i kartet</button></div></div>
        ${prinsippHtml(true)}`;
    }
    const grupper = {}; for (const sk of p.skifter) { const g = KULTURER[sk.vekster?.[a]?.kultur]?.gruppe || 'ukjent'; grupper[g] = (grupper[g] || 0) + (sk.areal || 0); }
    const sk = finn(valgt);
    return `<div class="knapperad sp-verktoy"><button type="button" class="knapp liten" data-sp="auto" ${arbeider ? 'disabled' : ''}>Ny automatisk inndeling</button><button type="button" class="knapp liten" data-sp="tegn">Tegn skifte</button><button type="button" class="knapp liten" data-sp="jordsmonn-alle" ${arbeider ? 'disabled' : ''}>Hent jordsmonn</button><button type="button" class="knapp liten" data-sp="zoom-alle">Vis alle</button></div>
      <div class="sp-grupper">${Object.entries(grupper).map(([g, v]) => `<span class="sp-chip"><i class="sp-prikk" style="--farge:${GRUPPER[g]?.farge || '#fff'}"></i>${esc(GRUPPER[g]?.navn || 'Uten vekst')} ${fmt(v, 1)} daa</span>`).join('')}</div>
      <div class="tabell-wrap"><table class="tabell sp-tabell"><thead><tr><th>Nr</th><th>Navn</th><th class="tall">Daa</th><th>Forgrøde ${a - 1}</th><th>Vekst ${a}</th><th class="tall">P-AL</th><th>Prøve</th></tr></thead><tbody>
        ${p.skifter.map((s) => { const pa = s.jordprove?.dato ? Number(s.jordprove.dato.slice(0, 4)) : null; const gammel = pa && a - pa > (KULTURER[s.vekster?.[a]?.kultur]?.pKrevende ? 4 : 8); return `<tr data-sp-skifte="${s.id}" class="${s.id === valgt ? 'valgt' : ''}"><td><b>${esc(s.nr)}</b></td><td>${esc(s.navn)}</td><td class="tall">${fmt(s.areal, 1)}</td><td>${esc(vekstNavn(s, a - 1))}</td><td>${prik(s, a)}${esc(vekstNavn(s, a)) || '<span class="hint">velg</span>'}</td><td class="tall">${s.jordprove?.PAL ?? ''}</td><td${gammel ? ' class="sp-gammel"' : ''}>${pa || '<span class="hint">mangler</span>'}</td></tr>`; }).join('')}
      </tbody></table></div>
      ${sk ? detaljHtml(sk, S) : '<p class="hint">Velg et skifte i tabellen eller kartet for å registrere vekster, jordprøve og jordsmonn.</p>'}
      ${prinsippHtml(false)}
      <details class="kort sp-lag"><summary><b>Kartlag fra NIBIO</b></summary><div class="sp-lagvalg">${Object.entries(JORDSMONN_KARTLAG).map(([id, c]) => `<label><input type="checkbox" data-sp-lag="${id}" ${p.visLag?.[id] ? 'checked' : ''}> ${esc(c.navn)}</label>`).join('')}</div></details>`;
  }

  function prinsippHtml(aapen) {
    const inn = SP().inndeling;
    return `<details class="kort sp-prinsipp" ${aapen ? 'open' : ''}><summary><b>Slik deles jordbruksarealet i skifter</b></summary>
      <ol class="sp-regler">
        <li><b>AR5-figurene er utgangspunktet.</b> De er avgrenset av vei, bekk/grøft, skog, bebyggelse og arealtype – naturlige grenser for drift og maskiner.</li>
        <li><b>Fulldyrka, overflatedyrka og innmarksbeite holdes adskilt</b>, fordi de drives og gjødsles ulikt.</li>
        <li><b>Figurer over ${INNDELING.delFra} daa deles der jordsmonnet skifter</b> (NIBIOs jordsmonnkart): sand/grus, silt og lettleire, mellomleire/stiv leire og organisk jord – og god eller svak naturlig drenering. Da blir hvert skifte ensartet, og én blandprøve er representativ for gjødsling og kalking.</li>
        <li><b>Deler under ${INNDELING.minDel} daa (eller ${Math.round(INNDELING.minAndel * 100)} % av figuren) slås sammen med naboen</b> – mindre skifter er upraktiske å drive og ta prøver av (anbefalt ca. 10–15 daa per prøve på ensartede skifter).</li>
        <li><b>Flater under ${INNDELING.minSkifte} daa og striper smalere enn ${INNDELING.minBredde} m</b> slås sammen med nabo av samme type eller utelates (kantsoner, veikanter).</li>
        <li><b>Nummerering</b> fra nord mot sør og vest mot øst. Store skifter får råd om antall delprøver.</li>
      </ol>
      ${inn ? `<p class="hint">Siste inndeling ${esc(inn.laget || '')}: ${inn.ar5} AR5-figurer → ${inn.skifter} skifter på ${fmt(inn.areal)} daa${inn.delt ? `, ${inn.delt} figurer delt etter jordsmonn` : ''}${inn.sammenslaatt ? `, ${inn.sammenslaatt} små flater slått sammen` : ''}${inn.utelatt ? `, ${inn.utelatt} utelatt (${fmt(inn.utelattDaa, 1)} daa)` : ''}.</p>` : ''}
      <p class="hint">Inndelingen er et forslag. Juster grensene etter hvordan skiftene faktisk drives – f.eks. tegn skifter på nytt eller slå sammen.</p>
    </details>`;
  }

  function detaljHtml(sk, S) {
    const a = aar(); const jp = sk.jordprove || {}; const js = sk.jordsmonn; const b = gjodselbehov(sk, a);
    const vann = avstandTilVann(sk, S);
    const aarene = [a - 3, a - 2, a - 1, a, a + 1];
    return `<div class="kort sp-detalj" data-sp-kort="${sk.id}">
      <div class="detalj-topp"><h3>Skifte ${esc(sk.nr)}${sk.navn ? ` – ${esc(sk.navn)}` : ''}</h3><div class="knapperad" style="margin:0"><button type="button" class="knapp liten" data-sp="zoom" title="Zoom til skiftet">🔍</button><button type="button" class="knapp liten fare" data-sp="slett">Slett</button></div></div>
      <div class="skjema to-kol">
        <label>Nr <input data-sp-felt="nr" value="${esc(sk.nr)}"></label>
        <label>Navn <input data-sp-felt="navn" value="${esc(sk.navn)}" placeholder="F.eks. Nordre jorde"></label>
        <label>Areal (daa) <input type="number" step="0.1" data-sp-felt="areal" value="${sk.areal ?? ''}"></label>
        <label>Arealtype <input value="${esc(AR5_JORDBRUK[sk.artype] || (sk.kilde === 'tegnet' ? 'Tegnet' : '–'))}${sk.kilde === 'auto' ? ' (auto)' : ''}" disabled></label>
      </div>
      ${sk.inndeling?.grunn ? `<p class="sp-grunn"><b>Inndeling:</b> ${esc(sk.inndeling.grunn)}</p>` : ''}
      ${vann != null ? `<p class="hint">Avstand til vann (AR5): ca. ${fmt(vann)} m${vann < 50 ? ' – husk vegetasjonssone/avdriftsavstand ved sprøyting, og minst 6 m til vassdrag ved gjødsling av eng.' : ''}</p>` : ''}
      <h4 class="undertittel">Vekster</h4>
      <div class="sp-vekster">
        ${aarene.map((x) => { const v = sk.vekster?.[x] || {}; const k = KULTURER[v.kultur]; return `<div class="sp-aarrad${x === a ? ' aktiv' : ''}"><b>${x}</b><select data-sp-vekst="${x}" data-f="kultur" aria-label="Vekst ${x}">${kulturValg(v.kultur)}</select>${k ? `<label><small>Forventet avling</small><input type="number" step="10" data-sp-vekst="${x}" data-f="avling" value="${v.avling ?? ''}" placeholder="${k.utenGjodsel ? '' : `${k.normavling} ${k.enhet}`}" ${k.utenGjodsel ? 'disabled' : ''}></label><label><small>Jordarbeiding</small><select data-sp-vekst="${x}" data-f="jordarbeiding">${Object.entries(JORDARBEIDING).map(([id, n]) => `<option value="${id}" ${v.jordarbeiding === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>` : ''}</div>`; }).join('')}
      </div>
      <p class="hint">Forventet avling: kg/daa for korn, potet og oljevekster, FEm/daa for eng og beite. Bruk egne tall fra tidligere år.</p>
      <h4 class="undertittel">Jordprøve</h4>
      <div class="skjema tre-kol sp-prove">
        <label>Dato <input type="date" data-sp-prove="dato" value="${esc(jp.dato || '')}"></label>
        <label>pH <input type="number" step="0.1" data-sp-prove="pH" value="${jp.pH ?? ''}"></label>
        <label>P-AL <input type="number" step="0.1" data-sp-prove="PAL" value="${jp.PAL ?? ''}" title="mg P per 100 g jord"></label>
        <label>K-AL <input type="number" step="0.1" data-sp-prove="KAL" value="${jp.KAL ?? ''}" title="mg K per 100 g jord"></label>
        <label>K-HNO₃ <input type="number" step="1" data-sp-prove="KHNO3" value="${jp.KHNO3 ?? ''}"></label>
        <label>Mold (%) <input type="number" step="0.1" data-sp-prove="mold" value="${jp.mold ?? ''}" placeholder="${js?.organisk && /lavt/.test(js.organisk) ? '< 6' : ''}"></label>
      </div>
      <h4 class="undertittel">Jordsmonn (NIBIO)</h4>
      ${js && !js.ikkeKartlagt ? `<dl class="sp-jordsmonn">
          ${js.tekstur ? `<dt>Tekstur</dt><dd>${esc(js.tekstur)}</dd>` : ''}${js.drenering ? `<dt>Drenering</dt><dd>${esc(js.drenering)}</dd>` : ''}
          ${js.organisk ? `<dt>Organisk</dt><dd>${esc(js.organisk)}</dd>` : ''}${js.begrensning ? `<dt>Begrensning</dt><dd>${esc(js.begrensning)}</dd>` : ''}
          ${js.erosjon ? `<dt>Erosjon</dt><dd><span class="sp-ero sp-ero-${js.erosjon.klasse}">${esc(js.erosjon.tekst)}</span></dd>` : ''}
          ${js.kartlagt ? `<dt>Kartlagt</dt><dd>${js.kartlagt}${js.helling != null ? ` · helling ${js.helling} %` : ''}</dd>` : ''}
        </dl>` : `<p class="hint">${js?.ikkeKartlagt ? 'Skiftet er ikke jordsmonnkartlagt.' : 'Ikke hentet.'}</p>`}
      <div class="knapperad"><button type="button" class="knapp liten" data-sp="jordsmonn" ${arbeider ? 'disabled' : ''}>${js ? 'Oppdater jordsmonn' : 'Hent jordsmonn'}</button></div>
      <h4 class="undertittel">Gjødselbehov ${a}</h4>
      ${b ? `<div class="sp-behov"><span><b>${fmt(b.N, 1)}</b> kg N</span><span><b>${fmt(b.P, 2)}</b> kg P</span><span><b>${fmt(b.K, 1)}</b> kg K</span><small>per daa</small></div>
        <ul class="sp-korr">${[`${b.kultur.navn}: norm ved ${b.kultur.grunn || b.kultur.normavling} ${b.enhet}/daa`, ...b.korreksjoner].map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        ${b.kultur.anslag ? '<p class="hint">Normtallene for denne kulturen er veiledende anslag – kontroller mot Gjødslingshåndboka.</p>' : ''}
        <div class="knapperad"><button type="button" class="knapp liten primar" data-sp="til-gjodsling">Planlegg gjødsling</button></div>` : '<p class="hint">Velg vekst for planåret for å beregne gjødselbehovet.</p>'}
      <div class="skjema" style="margin-top:12px"><label class="hel">Notat <textarea rows="2" data-sp-felt="notat" placeholder="Drenering, stein, kjøreskader, ugras …">${esc(sk.notat)}</textarea></label></div>
    </div>`;
  }

  function gjRadHtml(sk, g) {
    const n = naering(g); const hus = g.type === 'husdyr';
    const valg = hus ? HUSDYR : MINERAL;
    return `<div class="sp-grad${g.status === 'utfort' ? ' utfort' : ''}" data-sp-g="${sk.id}:${g.id}">
      <input type="date" data-f="dato" value="${esc(g.dato || '')}" aria-label="Dato">
      <select data-f="produkt" aria-label="Gjødsel">${Object.entries(valg).map(([id, p]) => `<option value="${id}" ${g.produkt === id ? 'selected' : ''}>${esc(p.navn)}</option>`).join('')}</select>
      <label class="sp-mengde"><input type="number" step="${hus ? 0.5 : 5}" data-f="mengde" value="${g.mengde ?? ''}" aria-label="Mengde"> ${hus ? 't/daa' : 'kg/daa'}</label>
      ${hus ? `<select data-f="spredemaate" aria-label="Spredemåte">${Object.entries(SPREDEMAATE).map(([id, s]) => `<option value="${id}" ${g.spredemaate === id ? 'selected' : ''}>${esc(s.navn)}</option>`).join('')}</select>` : '<span></span>'}
      <div class="sp-grad-bunn"><span class="sp-naering">N ${fmt(n.N, 1)}${hus ? ` <small>(tot ${fmt(n.Ntot, 1)})</small>` : ''} · P ${fmt(n.P, 2)} · K ${fmt(n.K, 1)}</span>
      <span class="sp-grad-knapper"><button type="button" class="knapp liten utfort-knapp${g.status === 'utfort' ? ' er-utfort' : ''}" data-sp-gh="utfort">${g.status === 'utfort' ? '✓ Utført' : 'Utført'}</button><button type="button" class="knapp liten" data-sp-gh="slett" aria-label="Slett">✕</button></span></div>
      ${g.kommentar ? `<small class="sp-gkomm">${esc(g.kommentar)}</small>` : ''}
    </div>`;
  }

  function gjodslingHtml() {
    const p = SP(); const a = aar(); const S = hentPlan();
    const aktive = aktiveSkifter(p, a);
    if (!p.skifter.length) return '<div class="tom">Ingen skifter ennå. Gå til «Skifter» for å hente eller tegne skifter.</div>';
    const o = oppsummer(S, a); const fs = fosforSnitt(p, a); const g = fosforgrense(a, p.region) ?? fosforgrense(2027, p.region);
    const uten = p.skifter.filter((s) => !s.vekster?.[a]?.kultur);
    const pakrevd = o.aktivtAreal > 25 || aktive.some((s) => KULTURER[s.vekster[a].kultur].pKrevende && s.areal > 5);
    const diff = (har, behov, d = 1) => { const x = har - behov; const kl = Math.abs(x) <= Math.max(0.3, behov * 0.08) ? 'ok' : x > 0 ? 'over' : 'under'; return `<span class="sp-diff ${kl}">${fmt(har, d)}<small>/${fmt(behov, d)}</small></span>`; };
    return `<div class="kort sp-gsum">
        <div class="detalj-topp"><h3>Gjødslingsplan ${a}</h3><span class="sp-krav ${pakrevd ? 'pakrevd' : ''}">${pakrevd ? 'Påkrevd' : 'Ikke påkrevd'}</span></div>
        <p class="hint">${fmt(o.aktivtAreal, 1)} daa gjødslet areal. Planen skal foreligge før vekstsesongen og oppbevares i 5 år (§ 26).</p>
        <div class="sp-totaler"><div><small>Nitrogen</small>${diff(o.sum.N, o.sum.behovN, 0)} kg</div><div><small>Fosfor</small>${diff(o.sum.P, o.sum.behovP, 0)} kg</div><div><small>Kalium</small>${diff(o.sum.K, o.sum.behovK, 0)} kg</div>
          <div><small>P snitt 3 år</small><span class="sp-diff ${fs.snitt != null && g && fs.snitt > g ? (a < 2027 ? 'under' : 'over') : 'ok'}">${fs.snitt != null ? fmt(fs.snitt, 2) : '–'}<small>/${g ?? '–'}${a < 2027 ? ' fra 2027' : ''}</small></span> kg/daa</div></div>
        <div class="knapperad"><button type="button" class="knapp primar" data-sp="foresla-alle">Foreslå gjødsling for alle</button><button type="button" class="knapp" data-sp="skriv-gp">Skriv ut gjødslingsplan</button><button type="button" class="knapp" data-sp="csv-gp">CSV</button></div>
      </div>
      ${aktive.map((sk) => {
        const b = gjodselbehov(sk, a); const s = sumGjodsling(sk, a); const gs = (sk.gjodsling || []).filter((x) => Number(x.aar) === a);
        return `<div class="kort sp-gskifte${sk.id === valgt ? ' valgt' : ''}" data-sp-kort="${sk.id}">
          <div class="detalj-topp"><h4><a href="#" data-sp-skifte="${sk.id}">Skifte ${esc(sk.nr)}</a>${sk.navn ? ` ${esc(sk.navn)}` : ''} <span class="hint">${prik(sk, a)}${esc(vekstNavn(sk, a))} · ${fmt(sk.areal, 1)} daa${sk.vekster[a].avling ? ` · ${sk.vekster[a].avling} ${b.enhet}` : ''}</span></h4></div>
          <div class="sp-behovlinje">Tilført/behov per daa: N ${diff(s.N, b.N)} · P ${diff(s.P, b.P, 2)} · K ${diff(s.K, b.K)}${b.utenProve ? ' <span class="sp-gammel">uten jordprøve</span>' : ''}</div>
          ${gs.map((x) => gjRadHtml(sk, x)).join('') || '<p class="hint">Ingen gjødsling planlagt.</p>'}
          <div class="knapperad"><button type="button" class="knapp liten" data-sp-ny="mineral" data-sk="${sk.id}">+ Mineralgjødsel</button><button type="button" class="knapp liten" data-sp-ny="husdyr" data-sk="${sk.id}">+ Husdyrgjødsel</button><button type="button" class="knapp liten" data-sp-ny="foresla" data-sk="${sk.id}">Foreslå</button></div>
        </div>`;
      }).join('')}
      ${uten.length ? `<p class="hint">Uten vekst i ${a}: skifte ${uten.map((s) => `<a href="#" data-sp-skifte="${s.id}">${esc(s.nr)}</a>`).join(', ')}.</p>` : ''}
      <details class="kort"><summary><b>Spredning av husdyrgjødsel</b></summary><ul class="sp-regler">
        <li>Spredeperiode: 1. mars – ${REGIONER[p.region].slutt[1]}.${REGIONER[p.region].slutt[0]}. (${esc(REGIONER[p.region].navn.toLowerCase())}). Ikke på snødekt eller frossen mark.</li>
        <li>Organisk gjødsel på åpen jord skal moldes ned innen 18 timer.</li>
        <li>Minst 6 m avstand til vassdrag ved spredning på eng; ingen gjødsling i vegetasjonssoner mot vann.</li>
        <li>Fosforgrense fra 2027: ${fosforgrense(2027, p.region)} kg P/daa i snitt over tre år, deretter strengere (${fosforgrense(2030, p.region)} fra 2030${fosforgrense(2033, p.region) !== fosforgrense(2030, p.region) ? `, ${fosforgrense(2033, p.region)} fra 2033` : ''}).</li>
        <li>N fra husdyrgjødsel regnes her som plantetilgjengelig ammonium-N × virkningsgrad for spredemåten. Bruk egen gjødselanalyse når du har den.</li>
      </ul></details>`;
  }

  function sproytingHtml() {
    const p = SP(); const a = aar();
    if (!p.skifter.length) return '<div class="tom">Ingen skifter ennå. Gå til «Skifter» for å hente eller tegne skifter.</div>';
    const liste = (p.sproyting || []).filter((x) => Number(String(x.dato).slice(0, 4)) === a).sort((x, y) => String(y.dato).localeCompare(String(x.dato)));
    const ipv = p.ipv?.[a] || {};
    const skNavn = (ids) => (ids || []).map((id) => finn(id)?.nr).filter(Boolean).join(', ');
    const forvalgt = valgt ? [valgt] : [];
    return `<div class="kort sp-nysproyting"><h3>Ny sprøyting</h3>
        <div class="skjema to-kol">
          <label>Dato <input type="date" id="spDato" value="${a === iAar ? idag() : `${a}-06-01`}"></label>
          <label>Preparat <input id="spPreparat" placeholder="Handelsnavn"></label>
          <label>Dose <span class="sp-dose"><input type="number" step="any" id="spDose"><select id="spEnhet">${['ml/daa', 'g/daa', 'l/daa', 'kg/daa'].map((e) => `<option>${e}</option>`).join('')}</select></span></label>
          <label>Skadegjører / ugras <input id="spSkade" placeholder="F.eks. tofrøblada ugras"></label>
          <label>Begrunnelse <input id="spBegr" placeholder="Smittepress, terskel, VIPS-varsel …"></label>
          <label>Vekststadium <input id="spStadium" placeholder="F.eks. BBCH 13–21"></label>
          <label>Vær <input id="spVaer" placeholder="Vind, temperatur, fuktighet"></label>
          <label>Behandlingsfrist (dager) <input type="number" id="spKarens"></label>
          <label>Utført av <input id="spUtforer" value="${esc(p.sisteUtforer || '')}"></label>
        </div>
        <div class="sp-skiftevalg"><b>Skifter:</b> ${p.skifter.map((s) => `<label><input type="checkbox" class="spSkifteValg" value="${s.id}" ${forvalgt.includes(s.id) ? 'checked' : ''}> ${esc(s.nr)}${s.vekster?.[a]?.kultur ? ` <small>${esc(vekstNavn(s, a).split(',')[0])}</small>` : ''}</label>`).join('')}</div>
        <div class="knapperad"><button type="button" class="knapp primar" data-sp="lagre-sp">Lagre i sprøytejournalen</button></div>
      </div>
      <div class="kort"><div class="detalj-topp"><h3>Sprøytejournal ${a}</h3><div class="knapperad" style="margin:0"><button type="button" class="knapp liten" data-sp="skriv-pv">Skriv ut</button><button type="button" class="knapp liten" data-sp="csv-pv">CSV</button></div></div>
        ${liste.length ? liste.map((x) => { const th = tidligsteHosting(x); return `<div class="sp-sprad" data-sp-sp="${x.id}">
          <div><b>${esc(x.dato)}</b> · ${esc(x.preparat || '–')} ${esc(x.dose)} ${esc(x.enhet)} <span class="hint">skifte ${esc(skNavn(x.skifter)) || '–'}</span></div>
          <div class="hint">${esc(x.skadegjorer)}${x.begrunnelse ? ` · ${esc(x.begrunnelse)}` : ''}${x.vekststadium ? ` · ${esc(x.vekststadium)}` : ''}${x.vaer ? ` · ${esc(x.vaer)}` : ''}${th ? ` · tidligste høsting ${th}` : ''}${x.utforer ? ` · ${esc(x.utforer)}` : ''}</div>
          <div class="sp-sprad-bunn"><input data-sp-spf="effekt" value="${esc(x.effekt || '')}" placeholder="Effekt / virkning (fylles ut etterpå)"><button type="button" class="knapp liten" data-sp-sp-slett aria-label="Slett">✕</button></div>
        </div>`; }).join('') : '<p class="hint">Ingen sprøytinger registrert for året.</p>'}
        <p class="fotnote">Journalen skal vise skifte og kultur, preparat, dose, tidspunkt, behandlet areal og skadegjører, og oppbevares i minst tre år.</p>
      </div>
      <div class="kort"><h3>Integrert plantevern ${a}</h3><p class="hint">Del 1 av plantevernjournalen – fylles ut årlig.</p>
        <div class="sp-ipv">${IPV.map((t, i) => `<div class="sp-ipv-rad"><span>${esc(t)}</span><span class="sp-janei"><label><input type="radio" name="ipv${i}" value="ja" data-sp-ipv="${i}" ${ipv[i] === 'ja' ? 'checked' : ''}> Ja</label><label><input type="radio" name="ipv${i}" value="nei" data-sp-ipv="${i}" ${ipv[i] === 'nei' ? 'checked' : ''}> Nei</label></span></div>`).join('')}</div>
      </div>`;
  }

  function kravHtml() {
    const p = SP(); const a = aar(); const S = hentPlan();
    const funn = kontroller(S, a);
    return `<div class="kort"><div class="detalj-topp"><h3>Kontroll ${a}</h3>
        <label class="sp-region">Region <select data-sp-region>${Object.entries(REGIONER).map(([id, r]) => `<option value="${id}" ${p.region === id ? 'selected' : ''}>${esc(r.navn)}</option>`).join('')}</select></label></div>
        ${funn.length ? funn.map((f) => `<div class="sp-funn" style="--farge:${NIVAA[f.nivaa].farge}" ${f.skifteId ? `data-sp-skifte="${f.skifteId}"` : ''}><i>${NIVAA[f.nivaa].ikon}</i><div><b>${esc(f.tittel)}</b><div class="hint">${esc(f.tekst)}${f.kilde && KILDER[f.kilde] ? ` <a href="${esc(KILDER[f.kilde].url)}" target="_blank" rel="noopener">Kilde</a>` : ''}</div></div></div>`).join('') : '<p class="hint">Legg inn skifter for å kontrollere skifteplanen.</p>'}
      </div>
      <details class="kort" open><summary><b>Hva kreves av en skifteplan?</b></summary>
        <h4 class="undertittel">Gjødslingsplan (gjødselforskriften § 26)</h4>
        <ul class="sp-regler"><li>Påkrevd når foretaket disponerer og gjødsler mer enn 25 daa, eller mer enn 5 daa potet eller grønnsaker.</li>
          <li>Kartskisse med skifteinndelingen, og for hvert skifte: areal, jordprøveresultater, forgrøde, vekst i år, forventet avling, behov for N og P, planlagt gjødseltype og mengde N og P per daa.</li>
          <li>Skal foreligge før vekstsesongen, justeres ved store endringer, og oppbevares i 5 år.</li></ul>
        <h4 class="undertittel">Jordprøver (§ 29)</h4>
        <ul class="sp-regler"><li>Representative prøver med pH, P-AL, K-AL og moldinnhold/glødetap.</li><li>Ikke eldre enn 8 år – 4 år for fosforkrevende kulturer (potet, grønnsaker).</li></ul>
        <h4 class="undertittel">Gjødsling og spredning (§§ 15–20)</h4>
        <ul class="sp-regler"><li>Spredeperiode for organisk gjødsel, nedmolding innen 18 timer på åpen jord, ikke på snødekt eller frossen mark.</li><li>Fosforgrense fra 2027 (snitt over tre år) – strammes inn i 2030 og 2033.</li><li>Gjødseljournal for foretak som omsetter mer enn 75 kg fosfor i husdyrgjødsel årlig (§ 27).</li></ul>
        <h4 class="undertittel">Plantevernjournal (forskrift om plantevernmidler)</h4>
        <ul class="sp-regler"><li>Integrert plantevern: årlig sjekkliste.</li><li>Sprøytejournal: skifte og kultur, preparat, dose, tidspunkt, behandlet areal og skadegjører. Oppbevares i minst 3 år.</li><li>Vannjournal når preparatet krever vegetasjonssone eller avdriftsavstand (ikke nødvendig over 50 m fra vann).</li></ul>
        <h4 class="undertittel">Kilder</h4>
        <ul class="sp-regler">${Object.values(KILDER).map((k) => `<li><a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.navn)}</a></li>`).join('')}</ul>
      </details>`;
  }

  function tegn() {
    const panel = $('#fane-skifteplan'); if (!panel) return;
    panel.querySelectorAll('[data-sp-under]').forEach((k) => k.classList.toggle('aktiv', k.dataset.spUnder === underfane));
    const html = underfane === 'gjodsling' ? gjodslingHtml() : underfane === 'sproyting' ? sproytingHtml() : underfane === 'krav' ? kravHtml() : skifterHtml();
    $('#spInnhold').innerHTML = toppHtml() + html;
  }

  // ---------- utskrift ----------
  function aapneVindu(tittel, kropp) {
    const w = window.open('', '_blank'); if (!w) { melding('Nettleseren blokkerte utskriftsvinduet.'); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(tittel)}</title><style>body{font:12px/1.45 system-ui,sans-serif;max-width:1000px;margin:20px auto;padding:0 16px;color:#111}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:18px 0 6px}table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #bbb;padding:3px 5px;text-align:left;vertical-align:top}th{background:#f1f1ee}td.t{text-align:right}.hint{color:#555}.leg{display:inline-block;width:10px;height:10px;border:1px solid #333;margin:0 4px 0 10px}@media print{h2{break-after:avoid}tr{break-inside:avoid}}</style>${kropp}<script>setTimeout(()=>print(),400)<\/script>`);
    w.document.close();
  }
  function skrivGjodslingsplan() {
    const S = hentPlan(); const p = SP(); const a = aar(); const e = S.eiendom || {};
    const rader = p.skifter.map((sk) => {
      const v = sk.vekster?.[a] || {}; const b = gjodselbehov(sk, a); const jp = sk.jordprove || {};
      const gs = (sk.gjodsling || []).filter((g) => Number(g.aar) === a); const s = sumGjodsling(sk, a);
      return `<tr><td><b>${esc(sk.nr)}</b> ${esc(sk.navn)}</td><td class="t">${fmt(sk.areal, 1)}</td><td>${esc(vekstNavn(sk, a - 1))}</td><td>${esc(vekstNavn(sk, a))}</td><td class="t">${v.avling || b?.avling || ''} ${b?.enhet || ''}</td>
        <td>${jp.dato ? `${esc(jp.dato)}<br>pH ${jp.pH ?? '–'} · P-AL ${jp.PAL ?? '–'} · K-AL ${jp.KAL ?? '–'} · mold ${jp.mold ?? '–'} %` : '<i>mangler</i>'}</td>
        <td class="t">${b ? `${fmt(b.N, 1)} / ${fmt(b.P, 2)} / ${fmt(b.K, 1)}` : '–'}</td>
        <td>${gs.map((g) => `${esc(produktNavn(g))}: ${g.mengde} ${g.type === 'husdyr' ? 't' : 'kg'}/daa${g.dato ? ` (${esc(g.dato)})` : ''}`).join('<br>') || '–'}</td>
        <td class="t">${gs.length ? `${fmt(s.N, 1)} / ${fmt(s.P, 2)} / ${fmt(s.K, 1)}` : '–'}</td></tr>`;
    }).join('');
    const legende = [...new Set(p.skifter.map((s) => KULTURER[s.vekster?.[a]?.kultur]?.gruppe).filter(Boolean))].map((g) => `<span class="leg" style="background:${GRUPPER[g].farge}"></span>${esc(GRUPPER[g].navn)}`).join('');
    const o = oppsummer(S, a); const fs = fosforSnitt(p, a);
    aapneVindu(`Gjødslingsplan ${a}`, `<h1>Gjødslingsplan ${a}</h1><div class="hint">${esc(e.navn || '')}${e.gnrbnr ? ` · gnr/bnr ${esc(e.gnrbnr)}` : ''}${e.kommune ? ` · ${esc(e.kommune)}` : ''}${e.eier ? ` · ${esc(e.eier)}` : ''} · utarbeidet ${idag()}</div>
      <h2>Kartskisse over skifteinndelingen</h2>${kartskisse(p, a)}<div class="hint" style="margin-top:4px">${legende}</div>
      <h2>Skifter</h2><table><thead><tr><th>Skifte</th><th>Daa</th><th>Forgrøde</th><th>Vekst ${a}</th><th>Forv. avling</th><th>Jordprøve</th><th>Behov N/P/K kg/daa</th><th>Planlagt gjødsling</th><th>Tilført N/P/K kg/daa</th></tr></thead><tbody>${rader}</tbody></table>
      <p>Gjødslet areal ${fmt(o.aktivtAreal, 1)} daa. Sum tilført: N ${fmt(o.sum.N)} kg, P ${fmt(o.sum.P)} kg, K ${fmt(o.sum.K)} kg (behov N ${fmt(o.sum.behovN)}, P ${fmt(o.sum.behovP)}, K ${fmt(o.sum.behovK)}).${fs.snitt != null ? ` Fosfor i snitt over tre år: ${fmt(fs.snitt, 2)} kg P/daa.` : ''}</p>
      <p class="hint">Gjødselbehov etter NIBIOs Gjødslingshåndbok, korrigert for avling, moldinnhold, forgrøde, P-AL og K-AL. N fra husdyrgjødsel er regnet som plantetilgjengelig N. Planen er utarbeidet etter forskrift om lagring og bruk av gjødsel mv. § 26 og oppbevares i 5 år.</p>`);
  }
  function skrivPlantevern() {
    const S = hentPlan(); const p = SP(); const a = aar(); const e = S.eiendom || {}; const ipv = p.ipv?.[a] || {};
    const liste = (p.sproyting || []).filter((x) => Number(String(x.dato).slice(0, 4)) === a).sort((x, y) => String(x.dato).localeCompare(String(y.dato)));
    const rader = liste.flatMap((x) => (x.skifter || []).map((id) => finn(id)).filter(Boolean).map((sk) => `<tr><td>${esc(x.dato)}</td><td>${esc(sk.nr)}</td><td>${esc(vekstNavn(sk, a))}</td><td class="t">${fmt(sk.areal, 1)}</td><td>${esc(x.skadegjorer)}</td><td>${esc(x.begrunnelse)}</td><td>${esc(x.preparat)}</td><td>${esc(x.dose)} ${esc(x.enhet)}</td><td>${esc(x.vekststadium)}</td><td>${esc(x.vaer)}</td><td>${tidligsteHosting(x) || ''}</td><td>${esc(x.effekt)}</td><td>${esc(x.utforer)}</td></tr>`)).join('');
    const naer = p.skifter.map((sk) => ({ sk, d: avstandTilVann(sk, S) })).filter((x) => x.d != null && x.d < 50);
    aapneVindu(`Plantevernjournal ${a}`, `<h1>Plantevernjournal ${a}</h1><div class="hint">${esc(e.navn || '')}${e.gnrbnr ? ` · gnr/bnr ${esc(e.gnrbnr)}` : ''}${e.eier ? ` · ${esc(e.eier)}` : ''}</div>
      <h2>1. Integrert plantevern</h2><table><tbody>${IPV.map((t, i) => `<tr><td>${esc(t)}</td><td style="width:60px">${ipv[i] === 'ja' ? 'Ja' : ipv[i] === 'nei' ? 'Nei' : ''}</td></tr>`).join('')}</tbody></table>
      <h2>2. Sprøytejournal</h2><table><thead><tr><th>Dato</th><th>Skifte</th><th>Kultur</th><th>Daa</th><th>Skadegjører</th><th>Begrunnelse</th><th>Preparat</th><th>Dose</th><th>Stadium</th><th>Vær</th><th>Tidligste høsting</th><th>Effekt</th><th>Utført av</th></tr></thead><tbody>${rader || '<tr><td colspan="13"><i>Ingen sprøytinger registrert.</i></td></tr>'}</tbody></table>
      <h2>3. Vannjournal</h2><p>${naer.length ? `Skifter under 50 m fra vann (AR5): ${naer.map((x) => `${esc(x.sk.nr)} (${x.d} m)`).join(', ')}. Før dokumentasjon av vegetasjonssone og avdriftsavstand når preparatets etikett krever det.` : 'Ingen skifter er registrert under 50 m fra vann i AR5.'}</p>
      <p class="hint">Journalen oppbevares i minst tre år (forskrift om plantevernmidler).</p>`);
  }
  function lastNed(navn, tekst) {
    const url = URL.createObjectURL(new Blob([`﻿${tekst}`], { type: 'text/csv;charset=utf-8' }));
    const lenke = document.createElement('a'); lenke.href = url; lenke.download = navn; document.body.appendChild(lenke); lenke.click();
    setTimeout(() => { URL.revokeObjectURL(url); lenke.remove(); }, 1000);
  }

  // ---------- hendelser ----------
  const panel = $('#fane-skifteplan');
  panel.addEventListener('click', async (e) => {
    const p = SP(); const a = aar();
    const u = e.target.closest('[data-sp-under]'); if (u) { underfane = u.dataset.spUnder; tegn(); return; }
    const ul = e.target.closest('[data-sp-under-lenke]'); if (ul) { e.preventDefault(); underfane = ul.dataset.spUnderLenke; tegn(); return; }
    const gh = e.target.closest('[data-sp-gh]');
    if (gh) {
      const [skId, gId] = gh.closest('[data-sp-g]').dataset.spG.split(':'); const sk = finn(skId); const g = sk?.gjodsling.find((x) => x.id === gId); if (!g) return;
      if (gh.dataset.spGh === 'slett') sk.gjodsling = sk.gjodsling.filter((x) => x !== g);
      else { g.status = g.status === 'utfort' ? 'planlagt' : 'utfort'; if (g.status === 'utfort' && !g.dato) g.dato = idag(); }
      lagre(false); return;
    }
    const ny = e.target.closest('[data-sp-ny]');
    if (ny) {
      const sk = finn(ny.dataset.sk); if (!sk) return;
      if (ny.dataset.spNy === 'foresla') {
        const f = foreslaGjodsling(sk, a);
        if (!f.length) { melding(`Skifte ${sk.nr}: behovet er dekket av planlagt gjødsling.`); return; }
        sk.gjodsling.push(...f.map((x) => ({ ...x, id: nyId('g') })));
      } else {
        const hus = ny.dataset.spNy === 'husdyr';
        sk.gjodsling.push({ id: nyId('g'), aar: a, type: ny.dataset.spNy, produkt: hus ? 'storfe' : 'f22310', mengde: hus ? 3 : 40, spredemaate: hus ? (['eng', 'beite'].includes(KULTURER[sk.vekster?.[a]?.kultur]?.gruppe) ? 'nedfelt' : 'nedmoldet') : undefined, dato: `${a}-${hus ? '04-20' : '05-01'}`, status: 'planlagt' });
      }
      valgt = sk.id; lagre(false); return;
    }
    const spSlett = e.target.closest('[data-sp-sp-slett]');
    if (spSlett) { const id = spSlett.closest('[data-sp-sp]').dataset.spSp; if (confirm('Slette sprøytingen fra journalen?')) { p.sproyting = p.sproyting.filter((x) => x.id !== id); lagre(false); } return; }
    const rad = e.target.closest('[data-sp-skifte]');
    if (rad && !e.target.closest('input,select,button:not([data-sp-skifte])')) { e.preventDefault(); if (underfane === 'krav') underfane = 'skifter'; velg(rad.dataset.spSkifte); return; }
    const k = e.target.closest('[data-sp]')?.dataset.sp; if (!k) return;
    const sk = finn(valgt);
    if (k === 'ar5') hentFraAr5();
    if (k === 'auto') autoInndeling();
    if (k === 'tegn') startTegning();
    if (k === 'zoom-alle') zoomAlle();
    if (k === 'jordsmonn-alle') hentJordsmonnFor(p.skifter);
    if (k === 'foresla-alle') {
      let n = 0;
      for (const s of aktiveSkifter(p, a)) { const f = foreslaGjodsling(s, a); s.gjodsling.push(...f.map((x) => ({ ...x, id: nyId('g') }))); n += f.length; }
      lagre(false); melding(n ? `${n} ${n === 1 ? 'gjødsling' : 'gjødslinger'} foreslått. Kontroller mengder og datoer.` : 'Alle skifter har allerede gjødsling som dekker behovet.');
    }
    if (k === 'skriv-gp') skrivGjodslingsplan();
    if (k === 'csv-gp') lastNed(`gjodslingsplan-${a}.csv`, gjodslingsplanCsv(hentPlan(), a));
    if (k === 'skriv-pv') skrivPlantevern();
    if (k === 'csv-pv') lastNed(`sproytejournal-${a}.csv`, sproytejournalCsv(hentPlan(), a));
    if (k === 'lagre-sp') {
      const valgte = [...panel.querySelectorAll('.spSkifteValg:checked')].map((x) => x.value);
      const x = nySproyting({ dato: $('#spDato').value, skifter: valgte, nyId });
      Object.assign(x, { preparat: $('#spPreparat').value.trim(), dose: $('#spDose').value, enhet: $('#spEnhet').value, skadegjorer: $('#spSkade').value.trim(), begrunnelse: $('#spBegr').value.trim(), vekststadium: $('#spStadium').value.trim(), vaer: $('#spVaer').value.trim(), karens: $('#spKarens').value, utforer: $('#spUtforer').value.trim() });
      const m = [!x.dato && 'dato', !x.preparat && 'preparat', !x.dose && 'dose', !x.skadegjorer && 'skadegjører', !valgte.length && 'skifte'].filter(Boolean);
      if (m.length) { melding(`Fyll ut ${m.join(', ')}.`); return; }
      p.sproyting.push(x); p.sisteUtforer = x.utforer;
      if (Number(x.dato.slice(0, 4)) !== a) p.aar = Number(x.dato.slice(0, 4));
      lagre(false); melding('Sprøytingen er lagret i journalen.'); return;
    }
    if (!sk) return;
    if (k === 'zoom') zoom(sk);
    if (k === 'slett' && confirm(`Slette skifte ${sk.nr} med vekster, jordprøve og gjødsling?`)) { p.skifter = p.skifter.filter((s) => s !== sk); for (const x of p.sproyting) x.skifter = (x.skifter || []).filter((id) => id !== sk.id); valgt = null; lagre(); }
    if (k === 'jordsmonn') hentJordsmonnFor([sk]);
    if (k === 'til-gjodsling') { underfane = 'gjodsling'; tegn(); setTimeout(() => $(`#fane-skifteplan [data-sp-kort="${sk.id}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 30); }
  });
  panel.addEventListener('change', (e) => {
    const t = e.target; const p = SP(); const sk = finn(valgt);
    if (t.matches('[data-sp-aar]')) { p.aar = Number(t.value); lagre(); return; }
    if (t.matches('[data-sp-region]')) { p.region = t.value; lagre(false); return; }
    if (t.dataset.spLag) { p.visLag = { ...p.visLag, [t.dataset.spLag]: t.checked }; endret({ kart: false }); tegnKart(); return; }
    if (t.dataset.spIpv !== undefined) { p.ipv = { ...p.ipv, [aar()]: { ...(p.ipv?.[aar()] || {}), [t.dataset.spIpv]: t.value } }; endret({ kart: false }); return; }
    const gr = t.closest('[data-sp-g]');
    if (gr) {
      const [skId, gId] = gr.dataset.spG.split(':'); const s = finn(skId); const g = s?.gjodsling.find((x) => x.id === gId); if (!g) return;
      const f = t.dataset.f; g[f] = f === 'mengde' ? tall(t.value) : t.value; delete g.forslag;
      lagre(false); return;
    }
    const spr = t.closest('[data-sp-sp]');
    if (spr && t.dataset.spSpf) { const x = p.sproyting.find((y) => y.id === spr.dataset.spSp); if (x) { x[t.dataset.spSpf] = t.value; endret({ kart: false }); } return; }
    if (!sk) return;
    if (t.dataset.spFelt) { const f = t.dataset.spFelt; sk[f] = f === 'areal' ? tall(t.value) : t.value; lagre(f === 'nr'); return; }
    if (t.dataset.spVekst) {
      const x = t.dataset.spVekst; sk.vekster[x] = { ...(sk.vekster[x] || {}) };
      sk.vekster[x][t.dataset.f] = t.dataset.f === 'avling' ? tall(t.value) : t.value;
      if (t.dataset.f === 'kultur') { const g = KULTURER[t.value]?.gruppe; if (['eng', 'beite'].includes(g) && !sk.vekster[x].jordarbeiding) sk.vekster[x].jordarbeiding = 'eng'; if (!t.value) delete sk.vekster[x]; }
      lagre(t.dataset.f === 'kultur'); return;
    }
    if (t.dataset.spProve) { sk.jordprove = { ...sk.jordprove, [t.dataset.spProve]: t.dataset.spProve === 'dato' ? t.value : tall(t.value) }; lagre(false); }
  });
  $('#spTegnFerdig').addEventListener('click', fullfor);
  $('#spTegnAvbryt').addEventListener('click', stopp);
  L.DomEvent.disableClickPropagation($('#spTegnHjelp'));

  return {
    vis() { synlig = true; SP(); if (!kart.hasLayer(lag)) lag.addTo(kart); tegnKart(); tegn(); },
    skjul() { synlig = false; stopp(); lag.remove(); for (const id of Object.keys(wms)) { wms[id].remove(); delete wms[id]; } },
    oppdater() { if (synlig) { tegnKart(); tegn(); } },
    underfane(navn) { underfane = navn; if (synlig) tegn(); },
    oppsummering() { const S = hentPlan(); return S.skifteplan?.skifter?.length ? oppsummer(S, Number(S.skifteplan.aar) || iAar) : null; },
  };
}
