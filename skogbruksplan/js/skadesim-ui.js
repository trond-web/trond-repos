// Skogbrand › 🧪 Simulering: velg skadetype og værscenario (vindkast, snø, temperatur, tørke …), eller hent det fra
// værprognosen, og se mulig omfang før skaden skjer – per bestand i kartet og i tabell, med kurve for hvordan
// omfanget øker med hovedvariabelen. Logikken: skadesim.js.
import * as SIM from './skadesim.js';
import { hentVaer } from './skade-data.js';
import { punktIGeometri } from './proj.js';
import { fmt, linje } from './charts.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const skala = (a) => (a >= 0.5 ? '#8f1c1c' : a >= 0.25 ? '#e0442f' : a >= 0.1 ? '#f08a24' : a >= 0.02 ? '#f2c230' : null);
const TREKK = [['Mindre enn 2 %', null], ['2–10 %', '#f2c230'], ['10–25 %', '#f08a24'], ['25–50 %', '#e0442f'], ['Over 50 %', '#8f1c1c']];

export function lagSkadesimUi({ kart, hentPlan, endret, melding, settKartKlikk, visBestand, iAar }) {
  const lag = L.layerGroup(); let paa = false; let velgerStart = false;
  let cache = { nokkel: '', resultat: null, sens: null }; let vaer = null; let henter = false;
  const tilstand = () => { const S = hentPlan(); S.skogbrand = S.skogbrand || {}; const t = (S.skogbrand.simulering ??= { type: 'storm', param: {} }); return t; };
  const param = (type = tilstand().type) => ({ ...SIM.standard(type), ...(tilstand().param[type] || {}) });
  function beregn() {
    const S = hentPlan(); const t = tilstand(); const p = param(t.type);
    const nokkel = JSON.stringify([t.type, p, S.bestand.length, S.bestand.reduce((s, b) => s + (b.areal || 0) + (b.alder || 0) + (b.tiltak?.length || 0), 0)]);
    if (cache.nokkel !== nokkel) {
      const r = SIM.simuler(S, t.type, p, { iAar });
      cache = { nokkel, resultat: r, sens: SIM.sensitivitet(S, t.type, p, { iAar }) };
    }
    return cache;
  }

  function tegnKart() {
    lag.clearLayers(); if (!paa) return;
    const S = hentPlan(); const { resultat: r } = beregn(); const rad = new Map(r.rader.map((x) => [x.id, x]));
    for (const b of S.bestand) {
      if (!b.geometri) continue; const x = rad.get(b.id); const f = x ? skala(x.andel) : null;
      const start = r.type === 'brann' && r.ekstra.start?.id === b.id;
      const l = L.geoJSON(b.geometri, { style: { color: start ? '#111' : f || '#7a8a7a', weight: start ? 3 : 1, fillColor: f || '#ffffff', fillOpacity: f ? 0.78 : 0.55, dashArray: f ? null : '3 4' } });
      l.bindTooltip(`<b>Bestand ${esc(b.nr)}</b>${x ? `<br>${Math.round(x.andel * 100)} % skadet · ${fmt(x.m3)} m³ · ${fmt(x.kr)} kr${x.ankomst != null ? `<br>Brannen kommer etter ${x.ankomst < 90 ? `${Math.round(x.ankomst)} min` : `${fmt(x.ankomst / 60, 1)} t`}` : ''}` : ''}`, { sticky: true });
      l.on('click', (e) => { L.DomEvent.stopPropagation(e); if (velgerStart) return; visBestand(b.id); });
      l.addTo(lag);
    }
    if ((r.type === 'brann' || r.type === 'storm') && S.bestand.some((b) => b.geometri)) {
      // Vindpil på vindsiden av eiendommen, pekende inn mot bestandene.
      const p = r.param; const gr = L.featureGroup(S.bestand.filter((b) => b.geometri).map((b) => L.geoJSON(b.geometri))).getBounds();
      const c = gr.getCenter(); const k = Math.cos((c.lat * Math.PI) / 180); const len = Math.max(gr.getNorth() - gr.getSouth(), (gr.getEast() - gr.getWest()) * k) / 2;
      const fra = (p.retning * Math.PI) / 180; const pkt = (f) => [c.lat + Math.cos(fra) * len * f, c.lng + (Math.sin(fra) * len * f) / k];
      const a = pkt(1.55); const b = pkt(1.12);
      L.polyline([a, b], { color: '#1c5cab', weight: 5, opacity: 0.9, interactive: false }).addTo(lag);
      const v = (p.retning + 180) * Math.PI / 180; const sp = len * 0.12; const side = (d) => [b[0] - Math.cos(v + d) * sp, b[1] - (Math.sin(v + d) * sp) / k];
      L.polygon([b, side(0.5), side(-0.5)], { color: '#1c5cab', fillColor: '#1c5cab', fillOpacity: 1, weight: 1, interactive: false }).addTo(lag);
      L.marker(a, { icon: L.divIcon({ className: 'sim-vindmerke', html: `${r.type === 'storm' ? `${p.kast} m/s` : `${p.vind} m/s`}<br>fra ${SIM.himmel(p.retning)}`, iconSize: [90, 32], iconAnchor: [45, 16] }), interactive: false }).addTo(lag);
    }
  }

  function variabelHtml(v, p) {
    const S = hentPlan();
    if (v.bestand) return `<label>${esc(v.navn)}<span class="sim-rad"><select data-sim="${v.id}"><option value="">Mest brennbare bestand</option>${S.bestand.filter((b) => b.geometri).map((b) => `<option value="${esc(b.id)}" ${p[v.id] === b.id ? 'selected' : ''}>${esc(b.nr)}</option>`).join('')}</select><button type="button" class="knapp liten" data-sim-knapp="velg-start">📍 Velg i kartet</button></span></label>`;
    if (v.valg) return `<label>${esc(v.navn)}<select data-sim="${v.id}">${v.valg.map(([id, n]) => `<option value="${id}" ${p[v.id] === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
    return `<label>${esc(v.navn)} <b class="sim-verdi">${v.retning ? `${esc(SIM.himmel(p[v.id]))} (${p[v.id]}°)` : `${fmt(p[v.id])} ${esc(v.enhet)}`}</b><input type="range" data-sim="${v.id}" min="${v.min}" max="${v.maks}" step="${v.steg}" value="${p[v.id]}"></label>`;
  }

  function html() {
    const t = tilstand(); const def = SIM.TYPER[t.type]; const p = param();
    const { resultat: r } = beregn(); const s = r.sum;
    const vis = r.rader.filter((x) => x.andel >= 0.02).slice(0, 25);
    return `<section class="kort sim"><h3>🧪 Simuler skade før den skjer</h3>
      <p class="hint">Velg skadetype og vær, og se hvilke bestand som kan rammes, hvor mye, og hva det kan koste. Modellene er forenklede anslag for planlegging og beredskap, ikke prognoser.</p>
      <div class="sim-typer" role="tablist">${Object.entries(SIM.TYPER).map(([id, x]) => `<button type="button" data-sim-type="${id}" class="${id === t.type ? 'aktiv' : ''}">${x.ikon} ${esc(x.navn)}</button>`).join('')}</div>
      <div class="sim-forslag"><span class="hint">Scenario</span>${def.forslag.map(([n], i) => `<button type="button" class="knapp liten" data-sim-forslag="${i}">${esc(n)}</button>`).join('')}${t.type !== 'bille' ? `<button type="button" class="knapp liten primar" data-sim-knapp="prognose" ${henter ? 'disabled' : ''}>${henter ? 'Henter …' : '🌦 Fra værprognosen'}</button>` : ''}<button type="button" class="knapp liten" data-sim-knapp="nullstill">Nullstill</button></div>
      <div class="skjema to-kol sim-var">${def.variabler.map((v) => variabelHtml(v, p)).join('')}</div>
      ${velgerStart ? '<p class="sf-varsel">📍 Trykk på bestandet i kartet der brannen skal starte.</p>' : ''}
      <div class="kpi-rad sim-kpi">
        <div class="kpi"><div class="verdi">${fmt(s.bestand)}</div><div class="etikett">bestand rammet</div><div class="under">${fmt(s.daa)} daa berørt</div></div>
        <div class="kpi"><div class="verdi">${fmt(s.skadetDaa)} daa</div><div class="etikett">skadet areal</div><div class="under">andel av arealet som skades</div></div>
        ${t.type === 'torke' ? '' : `<div class="kpi"><div class="verdi">${fmt(s.m3)} m³</div><div class="etikett">berørt volum</div></div>`}
        <div class="kpi"><div class="verdi">${fmt(s.kr)} kr</div><div class="etikett">${t.type === 'torke' ? 'suppleringsplanting' : 'anslått verditap'}</div></div>
      </div>
      ${t.type === 'brann' && r.ekstra.start ? `<p class="hint">Start i bestand ${esc(r.ekstra.start.nr)} · spredningsindeks (ISI) ${fmt(r.ekstra.isi, 1)} · brannen blir ca. ${fmt(r.ekstra.lb, 1)} ganger så lang som bred · raskeste spredning ${fmt(r.ekstra.hoderos, 1)} m/min.</p>` : ''}
      <h4 class="undertittel">${t.type === 'brann' ? 'Brent areal over tid (daa)' : `Omfang etter ${esc(def.sensitivitet.navn.charAt(0).toLowerCase() + def.sensitivitet.navn.slice(1))}`}</h4><div id="simKurve" class="sim-kurve"></div>
      <p class="sim-trekk">${TREKK.map(([n, f]) => `<span><i style="background:${f || 'transparent'};border:1px ${f ? 'solid' : 'dashed'} ${f || '#7a8a7a'}"></i>${esc(n)}</span>`).join('')}</p>
      <div class="knapperad"><button type="button" class="knapp liten ${paa ? 'primar' : ''}" data-sim-knapp="kart">${paa ? '✓ Vises i kartet' : 'Vis i kartet'}</button></div>
      ${vis.length ? `<div class="tabell"><table class="sf-tabell sim-tabell"><thead><tr><th>Bestand</th><th class="t">Skade</th>${t.type === 'brann' ? '<th class="t">Når</th>' : ''}${t.type === 'torke' ? '' : '<th class="t">m³</th>'}<th class="t">kr</th><th>Hvorfor</th></tr></thead><tbody>${vis.map((x) => `<tr data-sb-bestand="${esc(x.id)}"><td><a href="#">${esc(x.nr)}</a> <span class="hint">${esc(x.treslag || '')} ${fmt(x.daa, 1)} daa</span></td><td class="t"><span class="sim-prikk" style="background:${skala(x.andel)}"></span>${Math.round(x.andel * 100)} %</td>${t.type === 'brann' ? `<td class="t">${x.ankomst == null ? '–' : x.ankomst < 90 ? `${Math.round(x.ankomst)} min` : `${fmt(x.ankomst / 60, 1)} t`}</td>` : ''}${t.type === 'torke' ? '' : `<td class="t">${fmt(x.m3)}</td>`}<td class="t">${fmt(x.kr)}</td><td class="hint">${x.grunner.map(esc).join(' · ')}</td></tr>`).join('')}</tbody></table></div>${r.rader.filter((x) => x.andel >= 0.02).length > 25 ? '<p class="hint">Viser de 25 bestandene med størst tap.</p>' : ''}` : '<p class="hint">Ingen bestand får nevneverdig skade i dette scenarioet.</p>'}
      <div class="sim-kol"><div><h4 class="undertittel">Forsikring</h4><p class="hint">${esc(r.forsikring.tekst)}</p><p class="hint">${esc(def.tapTekst)}</p></div>
        <div><h4 class="undertittel">Hva kan gjøres nå?</h4><ul class="sf-liste">${r.tiltak.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
      <details class="ekstra"><summary>Slik regnes det</summary>${forklaring(t.type)}</details>
      ${vaer ? `<p class="hint">Værprognose fra Meteorologisk institutt hentet ${esc(new Date(vaer.hentet).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' }))} (største verdier de neste dagene).</p>` : ''}
    </section>`;
  }

  function forklaring(type) {
    const F = {
      storm: 'Hvert bestand får et kritisk vindkast ut fra trehøyde og treslag (gran tåler minst, furu mest). Nylig tynning, utynnede slanke trær, åpne kanter mot vinden, råte og bløt mark senker det. Tele hever det. Sannsynligheten for skade øker bratt når vindkastet går over det kritiske (logistisk kurve), og andelen trær som felles øker med sannsynligheten. Logikken ligner mekanistiske modeller som ForestGALES, men med forenklede tall.',
      sno: 'Snølasten i kronene regnes fra nysnø × tetthet (våt snø ca. 1,6 kg/m² per cm, tørr 0,6) × hvor mye kronene holder på (gran mest, bladløst lauv minst). Snø rundt 0 °C og vind øker lasten. Den sammenlignes med det bestandet tåler: lavere for slanke bestand (6–18 m), tette bestand og nylig tynnede, høyere for lave trær som ligger under snøen.',
      brann: 'Spredningshastigheten følger det kanadiske FBP-systemet: tørrhet i strø (FFMC) og vind gir spredningsindeksen ISI. Hvert bestand får en drivstofftype: granskog C2, moden furu C3, ung bartreskog C4, lauv D1 og hogstflate med hogstavfall S1. Brannen sprer seg som en ellipse med vinden, raskest med vinden og sakte mot den. Tiden fra bestand til bestand regnes langs naboer med korteste-vei-metoden. Over ca. 10 m/min i barskog regnes det med toppbrann. Myr, vann, veier og slokking er ikke med, så resultatet viser hva som kan skje uten effektiv slokking.',
      bille: 'Grunnrisikoen per granbestand (alder, uryddet vindfall, angrep i nærheten, solutsatte kanter og barkbillevarselet) kombineres med været: sverming krever varme dager over ca. 18–20 °C, andre generasjon krever mange graddager over 5 °C (over ca. 1 300–1 400), tørke svekker trærne, og ferskt vindfall gir billene yngleplass.',
      torke: 'Tørkestresset regnes fra antall dager uten nedbør og hvor varmt det er. Plantefelt (opptil 5 år) og ungskog er mest utsatt, særlig gran og lav bonitet (ofte grunnlendt). Tapet er kostnaden med å suppleringsplante den andelen som dør.',
    };
    return `<p class="hint">${esc(F[type])}</p><p class="hint">Volum og verdi er fra planen (volum per daa og rotnetto etter prisene i innstillingene).</p>`;
  }

  function etterTegning() {
    const el = document.getElementById('simKurve'); if (!el) return;
    const { sens } = beregn(); const t = tilstand();
    if (!sens?.length) { el.innerHTML = ''; return; }
    if (t.type === 'brann') linje(el, { x: sens.map((s) => `${s.x} t`), serier: [{ navn: 'Brent areal', farge: '#e0442f', verdier: sens.map((s) => s.daa) }], enhet: 'daa', hoyde: 170 });
    else linje(el, { x: sens.map((s) => s.x), serier: [{ navn: t.type === 'torke' ? 'Suppleringsplanting (1000 kr)' : 'Verditap (1000 kr)', farge: '#e0442f', verdier: sens.map((s) => Math.round(s.kr / 1000)) }, { navn: 'Skadet areal (daa)', farge: '#2a78d6', verdier: sens.map((s) => s.daa) }], hoyde: 170, markerX: param()[SIM.TYPER[t.type].sensitivitet.id] });
  }

  async function hentPrognose(tegn) {
    const S = hentPlan(); const g = S.eiendom?.grense || S.bestand.find((b) => b.geometri)?.geometri; if (!g) { melding('Planen har ingen kartgeometri.'); return; }
    const p = []; const gaa = (c) => { if (typeof c[0] === 'number') p.push(c); else c.forEach(gaa); }; gaa(g.coordinates);
    const lon = p.reduce((s, x) => s + x[0], 0) / p.length; const lat = p.reduce((s, x) => s + x[1], 0) / p.length;
    henter = true; tegn();
    try {
      vaer = await hentVaer(lon, lat); const t = tilstand(); const ny = SIM.fraPrognose(t.type, vaer);
      t.param[t.type] = { ...(t.param[t.type] || {}), ...ny }; endret({ kart: false });
      melding(Object.keys(ny).length ? 'Scenarioet er fylt ut fra værprognosen for de nærmeste dagene.' : 'Prognosen hadde ikke data for denne skadetypen.');
    } catch (e) { melding(`Klarte ikke å hente værprognosen: ${e.message}`, 6000); } finally { henter = false; tegn(); }
  }

  function klikk(e, tegn) {
    const t = tilstand();
    const ty = e.target.closest('[data-sim-type]'); if (ty) { t.type = ty.dataset.simType; velgerStart = false; endret({ kart: false }); tegn(); return true; }
    const fo = e.target.closest('[data-sim-forslag]'); if (fo) { const [, v] = SIM.TYPER[t.type].forslag[Number(fo.dataset.simForslag)]; t.param[t.type] = { ...SIM.standard(t.type), ...(t.type === 'brann' ? { start: param().start } : {}), ...v }; endret({ kart: false }); tegn(); return true; }
    const k = e.target.closest('[data-sim-knapp]')?.dataset.simKnapp; if (!k) return false;
    if (k === 'nullstill') { t.param[t.type] = {}; tegn(); return true; }
    if (k === 'prognose') { hentPrognose(tegn); return true; }
    if (k === 'kart') { paa = !paa; if (paa) lag.addTo(kart); else lag.remove(); tegn(); return true; }
    if (k === 'velg-start') {
      velgerStart = true; if (!paa) { paa = true; lag.addTo(kart); } kart.getContainer().style.cursor = 'crosshair'; tegn();
      settKartKlikk((ll) => {
        settKartKlikk(null); kart.getContainer().style.cursor = ''; velgerStart = false;
        const b = hentPlan().bestand.find((x) => x.geometri && punktIGeometri([ll.lng, ll.lat], x.geometri));
        if (b) { t.param.brann = { ...(t.param.brann || {}), start: b.id }; endret({ kart: false }); melding(`Brannen starter i bestand ${b.nr}.`); } else melding('Fant ikke noe bestand der.');
        tegn();
      });
      return true;
    }
    return true;
  }
  function endring(e, tegn) {
    const el = e.target.closest('[data-sim]'); if (!el) return false; const t = tilstand();
    const v = SIM.TYPER[t.type].variabler.find((x) => x.id === el.dataset.sim);
    t.param[t.type] = { ...(t.param[t.type] || {}), [el.dataset.sim]: v?.valg || v?.bestand ? el.value : Number(el.value) };
    endret({ kart: false }); tegn(); return true;
  }
  // Under dra i glideren: oppdater bare tallet ved siden av, beregn når den slippes (change).
  function input(e) {
    const el = e.target.closest('input[type="range"][data-sim]'); if (!el) return false; const t = tilstand();
    const v = SIM.TYPER[t.type].variabler.find((x) => x.id === el.dataset.sim); const b = el.closest('label')?.querySelector('.sim-verdi');
    if (b && v) b.textContent = v.retning ? `${SIM.himmel(Number(el.value))} (${el.value}°)` : `${fmt(Number(el.value))} ${v.enhet}`;
    return true;
  }
  return { html, klikk, endring, input, etterTegning, tegnKart, vis() { if (paa && !kart.hasLayer(lag)) lag.addTo(kart); tegnKart(); }, skjul() { lag.remove(); if (velgerStart) { settKartKlikk(null); velgerStart = false; kart.getContainer().style.cursor = ''; } } };
}
