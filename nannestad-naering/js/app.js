import { hentAlt, sokAdresse, eiendomFraPunkt, tolkMatrikkel } from './kilder.js';
import {
  fakta, muligheter, mulighetskart, brukAreal, KATEGORI, BRUK, PLANVEI, KALKYLER, standardVerdier, regnUt, arealformal, kr,
} from './analyse.js';

const NANNESTAD = { nr: '3238', navn: 'Nannestad' };
const STANDARD = { kommune: NANNESTAD, gnr: 29, bnr: 2 };
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const daa = (x) => `${Math.round(x).toLocaleString('nb-NO')} daa`;
const pst = (x) => `${Math.round(x * 100)} %`;
const km = (x) => `${x.toFixed(1).replace('.', ',')} km`;
const prikker = (n) => `<span class="prikker" aria-label="${n} av 5">${'●'.repeat(n)}<s>${'●'.repeat(5 - n)}</s></span>`;

// ---------- Kart ----------

const kart = L.map('kart', { zoomControl: true, preferCanvas: true }).setView([60.236, 11.06], 13);
const kv = '© <a href="https://www.kartverket.no/">Kartverket</a>';
const bakgrunn = {
  Topografisk: L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png', { maxZoom: 20, maxNativeZoom: 18, attribution: kv }),
  Gråtone: L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/webmercator/{z}/{y}/{x}.png', { maxZoom: 20, maxNativeZoom: 18, attribution: kv }),
  Flyfoto: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20, maxNativeZoom: 19, attribution: 'Esri, Maxar, Earthstar Geographics' }),
};
bakgrunn.Gråtone.addTo(kart);
const wms = (url, layers, attribution, opacity = 0.6) => L.tileLayer.wms(url, { layers, format: 'image/png', transparent: true, version: '1.3.0', opacity, attribution, maxZoom: 20 });
const DIBK = 'https://nap.ft.dibk.no/services/wms/';
const wmsLag = {
  'Kommuneplan – arealformål': wms(`${DIBK}kommuneplaner/`, 'arealformal_kp', 'DiBK / Nannestad kommune', 0.55),
  'Kommuneplan – hensynssoner (flystøy m.m.)': wms(`${DIBK}kommuneplaner/`, 'hensynssone-bestemmelsesomrade_kp', 'DiBK / Nannestad kommune', 0.6),
  Reguleringsplaner: wms(`${DIBK}reguleringsplaner/`, 'arealformal_vn2,rpomrade_vn2', 'DiBK', 0.6),
  'Arealtyper AR5 (NIBIO)': wms('https://wms.nibio.no/cgi-bin/ar5', 'Arealtype', 'NIBIO', 0.55),
  'Løsmasser (NGU)': wms('https://geo.ngu.no/mapserver/LosmasserWMS2', 'Losmasse_flate', 'NGU', 0.55),
  'Kvikkleire faregrad (NVE)': wms('https://kart.nve.no/enterprise/services/SkredKvikkleire2/MapServer/WMSServer', 'KvikkleireFaregrad', 'NVE', 0.7),
  Eiendomsgrenser: wms('https://wms.geonorge.no/skwms1/wms.matrikkelkart', 'eiendomsgrense', kv, 0.9),
};

const FORMALFARGE = { 1300: '#7b3fb0', 1200: '#8a6d3b', 1160: '#c0532f', 1130: '#d0453a', 1800: '#c77d18', 1500: '#5a6b7a' };
const naeringLag = L.layerGroup();
const kommuneLag = L.layerGroup().addTo(kart);
const mulighetLag = L.layerGroup().addTo(kart);
const arealLag = L.layerGroup();
const eiendomLag = L.layerGroup().addTo(kart);
const markering = L.layerGroup().addTo(kart);
const byggLag = L.layerGroup().addTo(kart);
naeringLag.addTo(kart);

const kontroll = L.control.layers(bakgrunn, {
  '<b>Mulighetskart for eiendommen</b>': mulighetLag,
  'Arealtyper på eiendommen': arealLag,
  'Næringsområder i kommuneplanen': naeringLag,
  Kommunegrense: kommuneLag,
  ...wmsLag,
}, { collapsed: true, position: 'topright' }).addTo(kart);
kart.on('overlayadd overlayremove', tegnForklaring);

let naeringsomrader = null;
const tilstand = { data: null, fakta: null, mul: [], celler: [], ref: null, kalk: {} };

async function lastJson(url) { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); }

async function lastGrunnlag() {
  const [kommune, naering] = await Promise.all([lastJson('data/kommune.geojson'), lastJson('data/naeringsomrader.geojson')]);
  L.geoJSON(kommune, { style: { color: '#1f4d36', weight: 2.5, dashArray: '8 6', fill: false }, interactive: false }).addTo(kommuneLag);
  naeringsomrader = naering;
  L.geoJSON(naering, {
    style: (f) => ({ color: FORMALFARGE[f.properties.arealformal] || '#555', weight: 1.5, fillOpacity: 0.35, dashArray: f.properties.status === 'framtidig' ? '5 4' : null }),
    onEachFeature: (f, l) => l.bindPopup(() => popupNaering(f.properties)),
  }).addTo(naeringLag);
}

function popupNaering(p) {
  const avst = tilstand.fakta?.naermeste.find((n) => n.id === p.id);
  return `<h4>${esc(p.navn || arealformal(p.arealformal))}</h4>${esc(arealformal(p.arealformal))}, ${esc(p.status)}<br>ca. ${daa(p.daa)}${p.utnytting ? `, utnytting ${esc(p.utnytting)}` : ''}${p.beskrivelse ? `<br>${esc(p.beskrivelse)}` : ''}${avst ? `<br>${km(avst.km)} fra eiendommen` : ''}<br><a href="https://www.arealplaner.no/nannestad3238/gi?funksjon=VisPlan&kommunenummer=3238&planidentifikasjon=${esc(p.plan)}" target="_blank" rel="noopener">Kommuneplanen</a>`;
}

function tegnForklaring() {
  const el = $('#tegnforklaring'); let h = '';
  if (kart.hasLayer(mulighetLag) && tilstand.celler.length) h += `<h4>Anbefalt bruk</h4><div>${Object.entries(BRUK).map(([, b]) => `<span><i style="background:${b.farge}"></i>${b.navn}</span>`).join('')}</div>`;
  if (kart.hasLayer(arealLag) && tilstand.celler.length) h += `<h4>Arealtype (AR5)</h4><div>${[...new Set(tilstand.celler.map((c) => c.kat))].map((k) => `<span><i style="background:${KATEGORI[k].farge}"></i>${KATEGORI[k].navn}</span>`).join('')}</div>`;
  if (kart.hasLayer(naeringLag)) h += `<h4>Kommuneplanen</h4><div>${Object.entries(FORMALFARGE).map(([k, c]) => `<span><i style="background:${c}"></i>${arealformal(k)}</span>`).join('')}<span><i class="strek" style="border-color:#555"></i>Stiplet = framtidig</span></div>`;
  const apen = el.querySelector('details')?.open ?? !window.matchMedia('(max-width: 900px)').matches;
  el.innerHTML = h ? `<details ${apen ? 'open' : ''}><summary>Tegnforklaring</summary>${h}</details>` : ''; el.hidden = !h;
}

function tegnEiendom() {
  eiendomLag.clearLayers(); mulighetLag.clearLayers(); arealLag.clearLayers(); byggLag.clearLayers(); markering.clearLayers();
  const { data, celler } = tilstand;
  const steg = data.steg; const dy = steg / 111320 / 2;
  const kx = Math.cos((data.celler[0]?.p[1] || 60) * Math.PI / 180) * 111320; const dx = steg / kx / 2;
  for (const c of celler) {
    const b = [[c.p[1] - dy, c.p[0] - dx], [c.p[1] + dy, c.p[0] + dx]];
    L.rectangle(b, { stroke: false, fillColor: BRUK[c.bruk].farge, fillOpacity: 0.55, interactive: false }).addTo(mulighetLag);
    L.rectangle(b, { stroke: false, fillColor: KATEGORI[c.kat].farge, fillOpacity: 0.6, interactive: false }).addTo(arealLag);
  }
  const grense = L.geoJSON(data.eiendom.geometri, { style: { color: '#c62828', weight: 3, fill: false } }).addTo(eiendomLag);
  for (const b of data.bygninger || []) L.circleMarker([b.punkt[1], b.punkt[0]], { radius: 4, color: '#fff', weight: 1.5, fillColor: '#1d2a22', fillOpacity: 1 }).bindTooltip(`Bygning ${b.nr || ''} (type ${b.type})`).addTo(byggLag);
  kart.fitBounds(grense.getBounds(), { padding: [30, 30] });
  tegnForklaring();
}

function visCeller(m) {
  markering.clearLayers();
  const { data, celler } = tilstand;
  const steg = data.steg; const dy = steg / 111320 / 2; const dx = steg / (Math.cos(celler[0].p[1] * Math.PI / 180) * 111320) / 2;
  const valgt = celler.filter((c) => m.celler.includes(c.kat));
  if (!valgt.length) { kart.fitBounds(L.geoJSON(data.eiendom.geometri).getBounds()); return; }
  const g = L.featureGroup(valgt.map((c) => L.rectangle([[c.p[1] - dy, c.p[0] - dx], [c.p[1] + dy, c.p[0] + dx]], { color: '#111', weight: 1, fillColor: '#ffeb3b', fillOpacity: 0.45, interactive: false }))).addTo(markering);
  kart.fitBounds(g.getBounds(), { padding: [40, 40] });
  if (window.matchMedia('(max-width: 900px)').matches) $('#kart').scrollIntoView({ behavior: 'smooth' });
}

// ---------- Faner ----------

function velgFane(id) {
  for (const b of document.querySelectorAll('.faner button')) b.setAttribute('aria-selected', String(b.dataset.fane === id));
  for (const f of document.querySelectorAll('.fane')) f.hidden = f.id !== `fane-${id}`;
}
for (const b of document.querySelectorAll('.faner button')) b.addEventListener('click', () => velgFane(b.dataset.fane));

function visOversikt() {
  const { data, fakta: f, mul } = tilstand; const e = data.eiendom;
  const fordeling = Object.entries(f.areal).sort((a, b) => b[1] - a[1]);
  const brukA = brukAreal(tilstand.celler, f);
  const naa = mul.filter((m) => PLANVEI[m.planvei].niva >= 2 && m.egnet >= 50).slice(0, 4);
  const lang = mul.filter((m) => PLANVEI[m.planvei].niva === 1 && m.egnet >= 30).slice(0, 2);
  const merk = [];
  if (f.flystoyGul + f.flystoyRod > 0) merk.push(['gul', '✈️', `${pst(f.flystoyGul + f.flystoyRod)} i flystøysone (${f.flystoyRod > 0 ? 'rød og gul' : 'gul'} sone, H2${f.flystoyRod > 0 ? '10' : '20'})`, 'Støyfølsom bruk (bolig, barnehage, overnatting) tillates normalt ikke. Næring, lager og landbruk går fint.']);
  if (f.lnfAndel > 0.5) merk.push(['bla', '🌿', `${pst(f.lnfAndel)} LNFR i kommuneplanen`, 'Landbruk og tilleggsnæring basert på gårdens ressurser er tillatt. Annen utbygging krever dispensasjon eller ny plan.']);
  if (f.regulertAndel > 0) merk.push(['bla', '📐', `${pst(f.regulertAndel)} omfattes av reguleringsplan`, 'Reguleringsplanen går foran kommuneplanen der den gjelder.']);
  if (f.marinAndel > 0.3) merk.push(['gul', '🪨', `${pst(f.marinAndel)} marin leire (NGU)`, 'Krev geoteknisk vurdering før graving, oppfylling eller bygging. Leire gir god jord, men kan være ustabil.']);
  if (f.kvikkleire.length) merk.push(['rod', '⚠️', `Kartlagt kvikkleiresone: ${f.kvikkleire.map((k) => `${k.skredomrnavn} (faregrad ${k.faregrad})`).join(', ')}`, 'Tiltak i sonen krever geoteknisk utredning (TEK17 § 7-3).']);
  else if (f.kvikkleireNaer?.length) merk.push(['gul', '⚠️', `Kvikkleiresone like ved: ${f.kvikkleireNaer.map((k) => `${k.skredomrnavn} (faregrad ${k.faregrad})`).join(', ')}`, 'Ikke kartlagt på selve eiendommen, men grunnen er av samme type. Sjekk med geotekniker ved større terrenginngrep.']);
  else if (!f.kvikkleireUkjent) merk.push(['ok', '✅', 'Ingen kartlagte kvikkleiresoner', 'Kartleggingen dekker ikke alt. Marin leire kan likevel inneholde kvikkleire.']);
  for (const s of f.faresoner) merk.push(['rod', '⚠️', `Faresone: ${s.navn}`, `${pst(s.andel)} av eiendommen.`]);
  if (f.myr > 10) merk.push(['ok', '💧', `${daa(f.myr)} myr`, 'Viktig karbonlager. Unngå nedbygging og grøfting – restaurering kan finansieres av staten.']);

  $('#fane-oversikt').innerHTML = `
    <div class="hode"><div><div class="gnr">${esc(e.kommune.navn || 'Kommune ' + e.kommune.nr)} · gnr. ${e.gnr} bnr. ${e.bnr}</div>
      <h1>Slik kan eiendommen utnyttes</h1></div></div>
    <div class="nokkeltall">
      <div><b class="tall">${daa(f.daa)}</b><span>totalt areal</span></div>
      <div><b class="tall">${daa(f.skog)}</b><span>skog (${daa(f.skogHoy)} høy bonitet)</span></div>
      <div><b class="tall">${daa(f.jordbruk)}</b><span>jordbruksareal</span></div>
      <div><b class="tall">${f.antallBygg}</b><span>bygninger</span></div>
      <div><b class="tall">${km(f.steder[0].km)}</b><span>til Oslo lufthavn</span></div>
      <div><b class="tall">${km(f.steder[1].km)}</b><span>til Nannestad sentrum</span></div>
    </div>
    <div class="anbefaling">
      <h3>Anbefalt strategi</h3>
      <p style="margin:0">${f.skog + f.jordbruk > 50 ? 'Behold og styrk kjernen – skog og jord – og legg til inntekter som ikke bygger ned areal.' : 'Bruk bygningene og tunet best mulig før du bygger ned nytt areal.'} Utviklingsprosjekter som krever ny plan, bør modnes parallelt.</p>
      <ol>${naa.map((m) => `<li><b>${m.ikon} ${esc(m.navn)}</b> – ${esc(PLANVEI[m.planvei].navn.toLowerCase())}${m.kalkyle ? `, ca. ${kr(regnUt(m.kalkyle, kalkVerdier(m.kalkyle)).aarlig)} per år` : ''}</li>`).join('')}
      ${lang.map((m) => `<li><b>${m.ikon} ${esc(m.navn)}</b> – langsiktig, krever ny plan</li>`).join('')}</ol>
      <p class="liten" style="margin:.6em 0 0">Se fanene <a href="#" data-gaa="muligheter">Muligheter</a> og <a href="#" data-gaa="okonomi">Økonomi</a> for detaljer og egne forutsetninger.</p>
    </div>
    <h2>Mulighetskartet</h2>
    <p>Hver rute (${data.steg} × ${data.steg} m) har fått anbefalt bruk ut fra arealtype, bonitet og avstand til tunet.</p>
    <div class="stolpe">${Object.entries(brukA).map(([k, v]) => `<i style="width:${(v / f.daa) * 100}%;background:${BRUK[k].farge}" title="${BRUK[k].navn}"></i>`).join('')}</div>
    <div class="fordeling">${Object.entries(brukA).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<i style="background:${BRUK[k].farge}"></i><span>${BRUK[k].navn}</span><span class="tall">${daa(v)}</span><span class="tall">${pst(v / f.daa)}</span>`).join('')}</div>
    <h2>Rammer og begrensninger</h2>
    ${merk.map(([k, i, t, x]) => `<div class="merknad ${k}"><span class="ikon">${i}</span><div><b>${esc(t)}</b>${esc(x)}</div></div>`).join('')}
    <h2>Arealtyper (NIBIO AR5)</h2>
    <div class="stolpe">${fordeling.map(([k, v]) => `<i style="width:${(v / f.daa) * 100}%;background:${KATEGORI[k].farge}" title="${KATEGORI[k].navn}"></i>`).join('')}</div>
    <div class="fordeling">${fordeling.map(([k, v]) => `<i style="background:${KATEGORI[k].farge}"></i><span>${KATEGORI[k].navn}</span><span class="tall">${daa(v)}</span><span class="tall">${pst(v / f.daa)}</span>`).join('')}</div>
    <h2>Arealplan</h2>
    <table><thead><tr><th>Formål</th><th>Plan</th><th class="tall">Andel</th></tr></thead><tbody>
    ${Object.entries(f.formal).sort((a, b) => b[1] - a[1]).map(([k, v]) => { const [kode, status, plan] = k.split('|'); return `<tr><td>${esc(arealformal(kode))}${status === 'framtidig' ? ' (framtidig)' : ''}</td><td>${plan === 'rp' ? 'Reguleringsplan' : 'Kommuneplan'}</td><td class="tall">${pst(v)}</td></tr>`; }).join('') || '<tr><td colspan="3">Ingen plandata funnet</td></tr>'}
    </tbody></table>
    ${Object.keys(f.soner).length ? `<p class="liten">Hensynssoner: ${Object.entries(f.soner).map(([n, v]) => `${esc(n)} (${pst(v)})`).join(', ')}</p>` : ''}
    <p>${f.planer.map((p) => p.link ? `<a href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.navn)}</a>` : esc(p.navn)).join(' · ')}</p>
    <h2>Grunnforhold (NGU)</h2>
    <div class="fordeling">${Object.entries(f.losmasser).sort((a, b) => b[1] - a[1]).map(([t, v]) => `<i style="background:#a9927a"></i><span>${esc(t)}</span><span class="tall">${pst(v)}</span><span></span>`).join('')}</div>
    <h2>Nærmeste utbyggingsområder i kommuneplanen</h2>
    <table><thead><tr><th>Område</th><th>Formål</th><th class="tall">Areal</th><th class="tall">Avstand</th></tr></thead><tbody>
    ${f.naermeste.slice(0, 6).map((n) => `<tr class="klikk" data-omrade="${esc(n.id)}"><td>${esc(n.navn || '–')}</td><td>${esc(n.formalNavn)}${n.status === 'framtidig' ? ' (framtidig)' : ''}</td><td class="tall">${daa(n.daa)}</td><td class="tall">${n.km < 0.05 ? 'grenser til' : km(n.km)}</td></tr>`).join('')}
    </tbody></table>
    ${Object.keys(data.feil || {}).length ? `<p class="liten">Noen data manglet: ${esc(Object.entries(data.feil).map(([k, v]) => `${k}: ${v}`).join(' · '))}</p>` : ''}
    <p class="liten">Data hentet ${new Date(data.hentet).toLocaleDateString('nb-NO')}. <a href="#" id="oppdater">Hent på nytt</a></p>`;
}

function kalkVerdier(id) {
  return { ...standardVerdier(id, tilstand.fakta), ...(tilstand.kalk[id] || {}) };
}

function kalkHtml(m) {
  if (!m.kalkyle) return '';
  const k = KALKYLER[m.kalkyle]; const v = kalkVerdier(m.kalkyle);
  return `<h4>Kalkyle – endre forutsetningene</h4>
    <div class="kalk" data-kalk="${m.kalkyle}">${k.felt.map((x) => `<label for="k-${m.kalkyle}-${x.id}">${esc(x.navn)} (${esc(x.enhet)})${x.hjelp ? `<small>${esc(x.hjelp)}</small>` : ''}</label><input id="k-${m.kalkyle}-${x.id}" data-felt="${x.id}" type="number" step="any" inputmode="decimal" value="${v[x.id]}">`).join('')}</div>
    <div class="resultat" data-resultat="${m.kalkyle}">${resultatHtml(m.kalkyle)}</div>`;
}

function resultatHtml(id) {
  const r = regnUt(id, kalkVerdier(id));
  return `${r.engang ? `<div><b>${kr(r.engang)}</b>netto engangsverdi</div>` : `<div><b>${kr(r.aarlig)}</b>per år (anslag)</div>`}${r.invest ? `<div><b>${kr(r.invest)}</b>investering${r.aarlig ? `, tilbakebetalt på ca. ${Math.max(1, Math.round(r.invest / r.aarlig))} år` : ''}</div>` : ''}<div style="flex-basis:100%" class="liten">${esc(r.tekst)}</div>`;
}

function visMuligheter() {
  const { mul } = tilstand;
  $('#fane-muligheter').innerHTML = `
    <h1>Muligheter, rangert</h1>
    <p>Egnethet (0–100) vekter arealgrunnlag, plan, beliggenhet og grunnforhold. <b>Planvei</b> sier hvor enkelt det er å få lov. Bærekraft og økonomi vises på en skala fra 1 til 5.</p>
    ${mul.map((m) => `<details class="kort" data-id="${m.id}">
      <summary><div class="topplinje"><span class="ikon">${m.ikon}</span><div><div class="kat">${esc(m.kategori)}</div><h3>${esc(m.navn)}</h3></div>
        <div class="egnet"><b>${m.egnet}</b><small>egnethet</small></div></div>
        <div class="merker"><span class="merke-p v${PLANVEI[m.planvei].niva}">${esc(PLANVEI[m.planvei].navn)}</span>
        <span class="merke-p">Bærekraft ${prikker(m.baerekraft)}</span><span class="merke-p">Økonomi ${prikker(m.okonomi)}</span></div></summary>
      <h4>Hvorfor</h4><ul>${m.hvorfor.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <h4>Bærekraft</h4><p>${esc(m.baerekraftTekst)}</p>
      <h4>Planvei</h4><p>${esc(PLANVEI[m.planvei].tekst)}</p>
      <h4>Neste steg</h4><ol>${m.steg.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      ${m.risiko.length ? `<h4>Risiko</h4><ul>${m.risiko.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${kalkHtml(m)}
      ${m.celler.length ? `<button class="vis-kart" type="button" data-vis="${m.id}">Vis aktuelt areal i kartet</button>` : ''}
    </details>`).join('')}`;
}

function visOkonomi() {
  const { mul } = tilstand;
  const rader = mul.filter((m) => m.kalkyle).map((m) => ({ m, r: regnUt(m.kalkyle, kalkVerdier(m.kalkyle)) }));
  const portefolje = rader.filter(({ m }) => PLANVEI[m.planvei].niva >= 2 && m.egnet >= 50);
  const sumAar = portefolje.reduce((s, x) => s + x.r.aarlig, 0); const sumInv = portefolje.reduce((s, x) => s + x.r.invest, 0);
  const verdi = (r) => r.aarlig || (r.engang || 0) / 10;
  const maks = Math.max(1, ...rader.map((x) => verdi(x.r)));
  $('#fane-okonomi').innerHTML = `
    <h1>Økonomi</h1>
    <p>Grove anslag ut fra arealet på eiendommen og typiske priser. Endre forutsetningene under hver mulighet – tallene her oppdateres.</p>
    <div class="nokkeltall">
      <div><b class="tall">${kr(sumAar)}</b><span>per år fra anbefalt kombinasjon</span></div>
      <div><b class="tall">${kr(sumInv)}</b><span>samlet investering</span></div>
      <div><b class="tall">${portefolje.length}</b><span>tiltak uten ny plan</span></div>
    </div>
    <table><thead><tr><th>Mulighet</th><th class="tall">Per år</th><th class="tall">Investering</th><th style="width:28%"></th></tr></thead><tbody>
    ${rader.map(({ m, r }) => `<tr class="klikk" data-gaa-mul="${m.id}"><td>${m.ikon} ${esc(m.navn)}${portefolje.some((p) => p.m === m) ? '' : ` <span class="liten">(${esc(PLANVEI[m.planvei].navn.toLowerCase())})</span>`}</td>
      <td class="tall">${r.engang ? `<span class="liten">engang</span> ${kr(r.engang)}` : kr(r.aarlig)}</td><td class="tall">${r.invest ? kr(r.invest) : '–'}</td>
      <td><div class="bar" style="width:${Math.max(1, (verdi(r) / maks) * 100)}%;${r.engang ? 'background:var(--bla)' : ''}"></div></td></tr>`).join('')}
    </tbody></table>
    <p class="liten">Engangsverdier er vist med blå stolpe i skala 1:10 mot årlige inntekter. Skatt, arbeidsinnsats, finansiering og tilskudd er ikke med, bortsett fra der det står. Bruk tallene som utgangspunkt for samtale med regnskapsfører, Norsk Landbruksrådgiving, skogeierandelslaget eller en takstmann.</p>
    <h2>Bærekraftig og lønnsomt – prinsippene</h2>
    <ul>
      <li><b>Bygg ikke ned dyrka jord og myr.</b> De er vanskeligst å erstatte og har sterkest vern.</li>
      <li><b>Gjenbruk bygningene først.</b> Utleie av eksisterende driftsbygninger gir høy avkastning per krone og ingen arealtap.</li>
      <li><b>Skogen er hovedkapitalen.</b> Høy bonitet gir god tilvekst. Aktiv forvaltning gir både inntekt og karbonbinding.</li>
      <li><b>Energi på tak før energi på bakken.</b> Bakkemontert sol bør bare bruke skog med lav bonitet eller impediment.</li>
      <li><b>Langsiktig verdi gjennom plan.</b> Næringsareal kan gi størst verdi, men tar år og har usikkert utfall. Modne det parallelt, uten å stanse skog- og gårdsdriften.</li>
    </ul>`;
}

function visKommunen() {
  if (!naeringsomrader) return;
  const f = tilstand.fakta;
  const formaler = [...new Set(naeringsomrader.features.map((x) => x.properties.arealformal))];
  const valgt = new Set(JSON.parse(localStorage.getItem('nn-filter') || 'null') || ['1300', '1200', '1500', '1800']);
  const avst = (id) => f?.naermeste.find((n) => n.id === id)?.km;
  const liste = naeringsomrader.features.map((x) => x.properties).filter((p) => valgt.has(p.arealformal))
    .map((p) => ({ ...p, km: avst(p.id) ?? (f ? distanse(p.punkt, f.sentrum) : null) })).sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
  const sum = (s) => liste.filter((p) => p.status === s).reduce((t, p) => t + p.daa, 0);
  $('#fane-kommunen').innerHTML = `
    <h1>Utbyggingsområder i Nannestad</h1>
    <p>Områder til næring, råstoff og annen bebyggelse i kommuneplanens arealdel (KP 2018–2035). Kommunen rullerer planen, og Statsforvalteren har fremmet innsigelse mot nye store næringsområder av hensyn til jordvern. Stiplet omriss i kartet = framtidig (ikke utbygd).</p>
    <div class="filtre">${formaler.map((k) => `<label><input type="checkbox" value="${k}" ${valgt.has(k) ? 'checked' : ''}><i style="background:${FORMALFARGE[k]}"></i>${esc(arealformal(k))}</label>`).join('')}</div>
    <div class="nokkeltall"><div><b class="tall">${liste.length}</b><span>områder</span></div><div><b class="tall">${daa(sum('nåværende'))}</b><span>nåværende</span></div><div><b class="tall">${daa(sum('framtidig'))}</b><span>framtidig</span></div></div>
    <table><thead><tr><th>Felt</th><th>Formål</th><th class="tall">Areal</th><th class="tall">Fra eiendommen</th></tr></thead><tbody>
    ${liste.map((p) => `<tr class="klikk" data-omrade="${esc(p.id)}"><td>${esc(p.navn || '–')}</td><td>${esc(arealformal(p.arealformal))}${p.status === 'framtidig' ? ' <b>(framtidig)</b>' : ''}${p.beskrivelse ? `<br><span class="liten">${esc(p.beskrivelse)}</span>` : ''}</td><td class="tall">${daa(p.daa)}</td><td class="tall">${p.km != null ? km(p.km) : ''}</td></tr>`).join('')}
    </tbody></table>
    <p class="liten">Arealene er beregnet fra plankartet med ca. 12 m oppløsning og er omtrentlige. Se <a href="https://www.arealplaner.no/nannestad3238" target="_blank" rel="noopener">Nannestads planinnsyn</a> for juridisk gjeldende plan.</p>`;
  for (const cb of document.querySelectorAll('#fane-kommunen input[type=checkbox]')) cb.addEventListener('change', () => {
    const v = [...document.querySelectorAll('#fane-kommunen input:checked')].map((x) => x.value);
    try { localStorage.setItem('nn-filter', JSON.stringify(v)); } catch {}
    visKommunen();
  });
}
const distanse = ([x1, y1], [x2, y2]) => Math.hypot((x2 - x1) * 111.32 * Math.cos(y1 * Math.PI / 180), (y2 - y1) * 111.32);

function visKilder() {
  $('#fane-kilder').innerHTML = `
    <h1>Om løsningen</h1>
    <p>Løsningen viser hvilke muligheter en eiendom i Nannestad har for næringsutvikling, og hvordan den kan utnyttes bærekraftig og lønnsomt. Søk opp en eiendom eller klikk i kartet. Analysen gjøres direkte mot offentlige kartdata.</p>
    <h2>Slik gjøres analysen</h2>
    <ol>
      <li>Eiendomsgrensen hentes fra matrikkelen (Kartverket).</li>
      <li>Et rutenett legges over eiendommen. I hver rute leses arealtype, skogbonitet og treslag fra NIBIOs AR5.</li>
      <li>Løsmasser (NGU), kommuneplan, reguleringsplaner og hensynssoner (DiBK Nasjonal arealplanbase) leses i et utvalg av rutene. Kvikkleiresoner hentes fra NVE.</li>
      <li>Hver mulighet vurderes etter arealgrunnlag, planstatus, beliggenhet (avstand til lufthavn, sentrum og næringsområder) og grunnforhold.</li>
      <li>Mulighetskartet gir hver rute en anbefalt bruk: dyrka jord til mat, produktiv skog til skogbruk, myr til natur, området rundt tunet til tilleggsnæring og lavproduktiv mark som kandidat for sol eller næring.</li>
    </ol>
    <h2>Datakilder</h2>
    <table><tbody>
      <tr><td>Eiendom og adresser</td><td>Kartverket – matrikkelen, adresse-API</td></tr>
      <tr><td>Arealtyper</td><td>NIBIO – AR5 (WMS)</td></tr>
      <tr><td>Løsmasser</td><td>NGU – løsmassekart</td></tr>
      <tr><td>Arealplaner</td><td>DiBK – Nasjonal arealplanbase</td></tr>
      <tr><td>Kvikkleire</td><td>NVE – kartlagte kvikkleiresoner</td></tr>
      <tr><td>Bygninger</td><td>Geonorge – matrikkelens bygningspunkt</td></tr>
    </tbody></table>
    <h2>Viktig</h2>
    <p>Dette er en planleggingshjelp, ikke en juridisk vurdering eller verdivurdering. Kommunen avgjør søknader. Økonomitallene er anslag med forutsetninger du selv kan endre. Snakk med kommunen (forhåndskonferanse), landbrukskontoret og fagfolk før du investerer.</p>
    <h2>Nyttige kontakter</h2>
    <ul>
      <li><a href="https://www.nannestad.kommune.no/" target="_blank" rel="noopener">Nannestad kommune</a> – plan, byggesak og landbrukskontor</li>
      <li><a href="https://www.arealplaner.no/nannestad3238" target="_blank" rel="noopener">Planinnsyn Nannestad</a></li>
      <li><a href="https://www.nlr.no/" target="_blank" rel="noopener">Norsk Landbruksrådgiving</a> – driftsplan og økonomi</li>
      <li><a href="https://www.innovasjonnorge.no/" target="_blank" rel="noopener">Innovasjon Norge</a> – investeringsstøtte til landbruk og tilleggsnæring</li>
      <li><a href="https://www.enova.no/" target="_blank" rel="noopener">Enova</a> – støtte til energitiltak</li>
      <li><a href="https://www.landbruksdirektoratet.no/" target="_blank" rel="noopener">Landbruksdirektoratet</a> – tilskudd til skog og jord</li>
      <li><a href="../skogbruksplan/" target="_blank" rel="noopener">SkogIQ</a> – forvaltning av skogbruksplanen</li>
    </ul>`;
}

function visAlt() {
  visOversikt(); visMuligheter(); visOkonomi(); visKommunen(); visKilder();
}

// Hendelser i panelet (delegert, siden innholdet tegnes på nytt)
document.querySelector('.panel').addEventListener('click', (ev) => {
  const t = ev.target;
  const gaa = t.closest('[data-gaa]'); if (gaa) { ev.preventDefault(); velgFane(gaa.dataset.gaa); return; }
  if (t.id === 'oppdater') { ev.preventDefault(); analyser(tilstand.ref, { tving: true }); return; }
  const vis = t.closest('[data-vis]'); if (vis) { visCeller(tilstand.mul.find((m) => m.id === vis.dataset.vis)); return; }
  const om = t.closest('[data-omrade]');
  if (om) {
    naeringLag.addTo(kart);
    naeringLag.eachLayer((g) => g.eachLayer((l) => { if (l.feature.properties.id === om.dataset.omrade) { kart.fitBounds(l.getBounds(), { maxZoom: 15, padding: [40, 40] }); l.openPopup(); } }));
    return;
  }
  const mul = t.closest('[data-gaa-mul]');
  if (mul) { velgFane('muligheter'); const d = $(`details[data-id="${mul.dataset.gaaMul}"]`); d.open = true; d.scrollIntoView({ behavior: 'smooth' }); }
});
document.querySelector('.panel').addEventListener('input', (ev) => {
  const inp = ev.target.closest('[data-felt]'); if (!inp) return;
  const id = inp.closest('[data-kalk]').dataset.kalk; const v = parseFloat(inp.value.replace(',', '.'));
  if (!Number.isFinite(v)) return;
  tilstand.kalk[id] = { ...(tilstand.kalk[id] || {}), [inp.dataset.felt]: v };
  try { localStorage.setItem(kalkNokkel(), JSON.stringify(tilstand.kalk)); } catch {}
  $(`[data-resultat="${id}"]`).innerHTML = resultatHtml(id);
  visOkonomi();
});
const kalkNokkel = () => `nn-kalk-${tilstand.ref.kommune.nr}-${tilstand.ref.gnr}-${tilstand.ref.bnr}`;

// ---------- Analyse ----------

function framdrift(id, status, tekst) {
  const el = $('#framdrift'); el.hidden = false;
  let l = el.querySelector(`[data-id="${id}"]`);
  if (!l) { l = document.createElement('div'); l.className = 'linje'; l.dataset.id = id; l.innerHTML = '<span class="status"></span><span class="tekst"></span>'; el.append(l); }
  l.className = `linje ${status}`; l.querySelector('.tekst').textContent = tekst;
}

let jobb = 0;
async function analyser(ref, { tving = false } = {}) {
  const min = ++jobb;
  tilstand.ref = ref;
  $('#feil').hidden = true; $('#framdrift').innerHTML = '';
  const nokkel = `${ref.kommune.nr}-${ref.gnr}-${ref.bnr}`;
  history.replaceState(null, '', `#${nokkel}`);
  try {
    let data = null;
    if (!tving && nokkel === '3238-29-2') data = await lastJson(`data/eiendom-${nokkel}.json`).catch(() => null);
    if (!data) data = await hentAlt(ref, { logg: framdrift });
    if (min !== jobb) return;
    data.eiendom.kommune.navn ||= ref.kommune.navn || (ref.kommune.nr === '3238' ? 'Nannestad' : null);
    tilstand.data = data;
    tilstand.fakta = fakta(data, naeringsomrader);
    tilstand.mul = muligheter(tilstand.fakta);
    tilstand.celler = mulighetskart(data, tilstand.fakta);
    try { tilstand.kalk = JSON.parse(localStorage.getItem(kalkNokkel()) || '{}'); } catch { tilstand.kalk = {}; }
    tegnEiendom(); visAlt();
    $('#framdrift').hidden = true;
    document.title = `${ref.gnr}/${ref.bnr} – Næringsmuligheter ${data.eiendom.kommune.navn || ''}`;
  } catch (e) {
    if (min !== jobb) return;
    $('#framdrift').hidden = true;
    $('#feil').hidden = false; $('#feil').textContent = `Kunne ikke analysere eiendommen: ${e.message}`;
  }
}

kart.on('click', async (ev) => {
  const ref = await eiendomFraPunkt([ev.latlng.lng, ev.latlng.lat]).catch(() => null);
  if (!ref) return;
  if (ref.kommune.nr !== '3238') ref.kommune.navn = null; else ref.kommune = NANNESTAD;
  velgFane('oversikt'); analyser(ref);
});

// ---------- Søk ----------

const felt = $('#sokefelt'); const liste = $('#forslag');
let forslag = []; let valgtIdx = -1; let sokTimer;
function visForslag() {
  liste.hidden = !forslag.length;
  liste.innerHTML = forslag.map((f, i) => `<li role="option" data-i="${i}" aria-selected="${i === valgtIdx}">${esc(f.tekst)} <small>${f.gnr}/${f.bnr}</small></li>`).join('');
}
felt.addEventListener('input', () => {
  clearTimeout(sokTimer);
  const t = felt.value.trim();
  if (t.length < 3 || tolkMatrikkel(t)) { forslag = []; visForslag(); return; }
  sokTimer = setTimeout(async () => {
    forslag = (await sokAdresse(`${t}`).catch(() => [])).sort((a, b) => (b.kommune.nr === '3238') - (a.kommune.nr === '3238'));
    valgtIdx = -1; visForslag();
  }, 220);
});
felt.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { valgtIdx = Math.min(forslag.length - 1, valgtIdx + 1); visForslag(); e.preventDefault(); }
  if (e.key === 'ArrowUp') { valgtIdx = Math.max(-1, valgtIdx - 1); visForslag(); e.preventDefault(); }
  if (e.key === 'Escape') { forslag = []; visForslag(); }
});
liste.addEventListener('mousedown', (e) => { const li = e.target.closest('li'); if (li) { e.preventDefault(); velgForslag(forslag[+li.dataset.i]); } });
function velgForslag(f) { forslag = []; visForslag(); felt.value = f.tekst; velgFane('oversikt'); analyser({ kommune: f.kommune, gnr: f.gnr, bnr: f.bnr }); }
$('#sok').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (valgtIdx >= 0 && forslag[valgtIdx]) { velgForslag(forslag[valgtIdx]); return; }
  const m = tolkMatrikkel(felt.value);
  if (m) {
    const kommune = !m.kommune || /nannestad|3238/i.test(m.kommune) ? NANNESTAD : (/^\d{4}$/.test(m.kommune) ? { nr: m.kommune } : null);
    if (!kommune) { $('#feil').hidden = false; $('#feil').textContent = 'Skriv gnr/bnr (Nannestad) eller «kommunenummer-gnr/bnr», f.eks. 3238-29/2.'; return; }
    velgFane('oversikt'); analyser({ kommune, gnr: m.gnr, bnr: m.bnr }); return;
  }
  const r = await sokAdresse(felt.value).catch(() => []);
  if (r[0]) velgForslag(r[0]);
});
$('#skriv').addEventListener('click', () => window.print());

// ---------- Start ----------

function refFraHash() {
  const m = location.hash.match(/^#(\d{4})-(\d+)-(\d+)$/);
  return m ? { kommune: m[1] === '3238' ? NANNESTAD : { nr: m[1] }, gnr: +m[2], bnr: +m[3] } : null;
}
window.addEventListener('hashchange', () => { const r = refFraHash(); if (r) analyser(r); });
await lastGrunnlag().catch((e) => console.warn(e));
analyser(refFraHash() || STANDARD);
