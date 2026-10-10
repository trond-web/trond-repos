import { hentAlt, hentPlaner, hentKommuner, finnKommune, tolkMatrikkel, sokAdresse, eiendomFraPunkt, tittel } from './kilder.js';
import { analyser, NIVAA, TILTAK, veiledTiltak, raadForBygning } from './analyse.js';
import { SEFRAK_STATUS, vernetype, KULTURMINNEKATEGORI } from './koder.js';

const $ = (s, r = document) => r.querySelector(s);
const h = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lenke = (url, tekst) => (/^https?:\/\//i.test(url || '') ? `<a href="${h(url)}" target="_blank" rel="noopener">${h(tekst)}</a>` : h(tekst));
const tall = (n) => Math.round(n).toLocaleString('nb-NO');
const lagre = { hent(k, std) { try { return JSON.parse(localStorage.getItem(k)) ?? std; } catch { return std; } }, sett(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privat modus */ } } };

let kommuner = null;
const kommunerKlar = () => (kommuner ? Promise.resolve(kommuner) : hentKommuner().then((k) => (kommuner = k)).catch(() => (kommuner = [])));
const kommunenavn = async (nr) => (await kommunerKlar()).find((k) => k.nr === nr)?.navn || nr;

// ---------- Kart ----------

const kart = L.map('kart', { zoomControl: true, attributionControl: true }).setView([64.5, 12], 4);
const kvAttr = '© <a href="https://www.kartverket.no/">Kartverket</a>';
const bakgrunn = {
  Topografisk: L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png', { maxZoom: 20, maxNativeZoom: 18, attribution: kvAttr }),
  Gråtone: L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/webmercator/{z}/{y}/{x}.png', { maxZoom: 20, maxNativeZoom: 18, attribution: kvAttr }),
  Flyfoto: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20, maxNativeZoom: 19, attribution: 'Esri, Maxar, Earthstar Geographics' }),
};
bakgrunn.Topografisk.addTo(kart);
const overlegg = {
  'SEFRAK (Riksantikvaren)': L.tileLayer.wms('https://kart.ra.no/wms/sefrak', { layers: 'SEFRAKBygninger', format: 'image/png', transparent: true, opacity: 0.9, attribution: 'Riksantikvaren' }),
};
L.control.layers(bakgrunn, overlegg, { position: 'topright' }).addTo(kart);
const lag = L.layerGroup().addTo(kart);
new ResizeObserver(() => kart.invalidateSize()).observe(document.getElementById('kart'));
const markorer = new Map();

kart.on('click', async (e) => {
  if (laster) return;
  const ref = await eiendomFraPunkt([e.latlng.lng, e.latlng.lat]).catch(() => null);
  if (!ref) { visFeil('Fant ingen eiendom i punktet du klikket på.'); return; }
  slaaOpp(ref);
});

function tegnKart(r) {
  lag.clearLayers(); markorer.clear();
  const grense = L.geoJSON(r.eiendom.geometri, { style: { color: '#c2410c', weight: 3, fillColor: '#f97316', fillOpacity: 0.08, dashArray: '6 4' }, interactive: false }).addTo(lag);
  for (const k of [...r.kulturminner.lokaliteter, ...r.kulturminner.sikringssoner, ...r.kulturmiljoer]) {
    if (k.geometri?.type === 'Point') continue;
    L.geoJSON(k.geometri, { style: { color: '#7c3aed', weight: 1.5, fillOpacity: 0.07, dashArray: k.type === 'Sikringssone' ? '3 3' : null } })
      .bindTooltip(h(k.navn || (k.type === 'Sikringssone' ? 'Sikringssone' : 'Kulturminne'))).addTo(lag);
  }
  r.bygninger.forEach((b, i) => {
    const m = L.circleMarker([b.punkt[1], b.punkt[0]], {
      radius: b.sefrak || b.nivaa ? 9 : 6, weight: 2, color: '#fff', fillOpacity: b.revet ? 0.35 : 0.95, className: `bygg-markor n${b.revet ? 'x' : b.nivaa}`,
    }).bindTooltip(`<b>${h(b.navn || b.type)}</b><br>${h(b.revet ? 'Trolig revet' : NIVAA[b.nivaa].navn)}`).addTo(lag);
    m.on('click', (e) => { L.DomEvent.stopPropagation(e); visBygg(i); });
    markorer.set(i, m);
  });
  kart.fitBounds(grense.getBounds(), { padding: [30, 30], maxZoom: 18 });
}

function visBygg(i) {
  const kort = document.getElementById(`bygg-${i}`);
  if (!kort) return;
  kort.open = true;
  kort.scrollIntoView({ behavior: 'smooth', block: 'start' });
  kort.classList.add('blink'); setTimeout(() => kort.classList.remove('blink'), 1400);
}

// ---------- Søk ----------

const felt = $('#sokefelt');
const forslag = $('#forslag');
let sokTimer = null;
let aktivtForslag = -1;
let forslagListe = [];

felt.addEventListener('input', () => {
  clearTimeout(sokTimer);
  const q = felt.value.trim();
  if (q.length < 3) { skjulForslag(); return; }
  sokTimer = setTimeout(() => foreslaa(q), 250);
});
felt.addEventListener('keydown', (e) => {
  if (forslag.hidden || !forslagListe.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    aktivtForslag = (aktivtForslag + (e.key === 'ArrowDown' ? 1 : -1) + forslagListe.length) % forslagListe.length;
    [...forslag.children].forEach((li, i) => li.setAttribute('aria-selected', i === aktivtForslag));
  } else if (e.key === 'Escape') skjulForslag();
});
document.addEventListener('click', (e) => { if (!e.target.closest('.sok')) skjulForslag(); });

async function foreslaa(q) {
  const m = tolkMatrikkel(q);
  const liste = [];
  if (m) {
    const kl = await kommunerKlar();
    const k = m.kommune ? finnKommune(m.kommune, kl) : null;
    if (k) liste.push({ tekst: `${k.navn} ${m.gnr}/${m.bnr}${m.fnr ? `/${m.fnr}` : ''}`, under: 'Gårds- og bruksnummer', ref: { ...m, kommune: k } });
    else if (m.kommune) liste.push(...kl.filter((x) => x.navn.toLowerCase().startsWith(m.kommune.toLowerCase())).slice(0, 6).map((x) => ({ tekst: `${x.navn} ${m.gnr}/${m.bnr}`, under: 'Gårds- og bruksnummer', ref: { ...m, kommune: x } })));
    else liste.push({ tekst: `${m.gnr}/${m.bnr} – skriv kommune foran, f.eks. «Nannestad ${m.gnr}/${m.bnr}»`, under: '', ref: null });
  } else {
    const adr = await sokAdresse(q).catch(() => []);
    liste.push(...adr.map((a) => ({ tekst: a.tekst, under: `${a.kommune.navn} ${a.gnr}/${a.bnr}${a.fnr ? `/${a.fnr}` : ''}`, ref: a })));
  }
  if (felt.value.trim() !== q) return;
  forslagListe = liste; aktivtForslag = liste.length ? 0 : -1;
  forslag.innerHTML = liste.length
    ? liste.map((f, i) => `<li role="option" aria-selected="${i === 0}" data-i="${i}"${f.ref ? '' : ' class="hint"'}><b>${h(f.tekst)}</b>${f.under ? `<small>${h(f.under)}</small>` : ''}</li>`).join('')
    : '<li class="hint">Ingen treff. Prøv «Kommune gnr/bnr».</li>';
  forslag.hidden = false;
}
forslag.addEventListener('click', (e) => {
  const li = e.target.closest('li[data-i]');
  const f = li && forslagListe[+li.dataset.i];
  if (f?.ref) { felt.value = f.tekst; skjulForslag(); slaaOpp(f.ref); }
});
function skjulForslag() { forslag.hidden = true; forslagListe = []; aktivtForslag = -1; }

$('#sok').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = forslagListe[aktivtForslag];
  if (f?.ref) { felt.value = f.tekst; skjulForslag(); slaaOpp(f.ref); return; }
  const q = felt.value.trim();
  if (!q) return;
  const m = tolkMatrikkel(q);
  if (m) {
    const k = m.kommune ? finnKommune(m.kommune, await kommunerKlar()) : null;
    if (!k) { visFeil('Skriv kommunenavn eller kommunenummer foran gårds- og bruksnummer, f.eks. «Nannestad 32/16» eller «3238 32/16».'); return; }
    skjulForslag(); slaaOpp({ ...m, kommune: k }); return;
  }
  const adr = await sokAdresse(q).catch(() => []);
  if (!adr.length) { visFeil(`Fant ingen adresse som passer «${q}».`); return; }
  skjulForslag(); felt.value = adr[0].tekst; slaaOpp(adr[0]);
});

document.querySelectorAll('[data-eksempel]').forEach((b) => b.addEventListener('click', () => slaaOppHash(b.dataset.eksempel)));

async function slaaOppHash(s) {
  const m = String(s).match(/^(\d{4})-(\d+)-(\d+)(?:-(\d+))?$/);
  if (!m) return;
  slaaOpp({ kommune: { nr: m[1] }, gnr: +m[2], bnr: +m[3], fnr: m[4] ? +m[4] : 0 });
}
window.addEventListener('hashchange', () => { const s = location.hash.slice(1); if (s && s !== gjeldendeHash) slaaOppHash(s); });

// ---------- Oppslag ----------

let laster = false;
let gjeldendeHash = '';
let resultat = null;

const KILDER = [
  ['eiendom', 'Eiendomsgrense (Kartverket)'], ['bygninger', 'Bygninger (matrikkelen)'], ['sefrak', 'SEFRAK (Riksantikvaren)'],
  ['freda', 'Fredete bygninger (Riksantikvaren)'], ['kulturminner', 'Kulturminner (Askeladden)'], ['kulturmiljoer', 'Kulturmiljøer'], ['planer', 'Arealplaner (Nasjonal arealplanbase)'],
];

async function slaaOpp(ref) {
  if (laster) return;
  laster = true;
  if (!ref.kommune.navn) ref.kommune.navn = await kommunenavn(ref.kommune.nr);
  ref.kommune.navn = tittel(ref.kommune.navn);
  const navn = `${ref.kommune.navn} ${ref.gnr}/${ref.bnr}${ref.fnr ? `/${ref.fnr}` : ''}`;
  $('#velkommen').hidden = true; $('#innhold').hidden = true; $('#skriv').hidden = true;
  const fd = $('#framdrift');
  fd.hidden = false;
  fd.innerHTML = `<h2>Slår opp ${h(navn)} …</h2>${KILDER.map(([k, t]) => `<div class="linje" data-k="${k}"><span class="status venter"></span><span class="tekst">${h(t)}</span></div>`).join('')}`;
  const logg = (k, status, tekst, data) => {
    const el = fd.querySelector(`[data-k="${k}"]`);
    if (!el) return;
    el.querySelector('.status').className = `status ${status}`;
    if (status === 'feil') el.querySelector('.tekst').textContent = `${KILDER.find((x) => x[0] === k)[1]}: ${tekst}`;
    else if (status === 'ok' && Array.isArray(data)) el.querySelector('.tekst').textContent = `${KILDER.find((x) => x[0] === k)[1]} – ${data.length} i området`;
  };
  try {
    const data = await hentAlt(ref, { logg });
    let r = analyser(data);
    logg('planer', 'aktiv');
    const punkter = [r.eiendom.senter, ...r.paaEiendom.filter((b) => !b.revet).map((b) => b.punkt)].slice(0, 16);
    data.planer = await hentPlaner(punkter);
    logg('planer', data.planer.objekter.length ? 'ok' : (data.planer.feil.length ? 'feil' : 'ok'), data.planer.feil[0]);
    r = analyser(data);
    r.kilder = Object.fromEntries(['bygninger', 'sefrak', 'freda', 'kulturminner', 'kulturmiljoer'].map((k) => [k, data[k]?.feil || null]));
    resultat = r;
    gjeldendeHash = `${ref.kommune.nr}-${ref.gnr}-${ref.bnr}${ref.fnr ? `-${ref.fnr}` : ''}`;
    history.replaceState(null, '', `#${gjeldendeHash}`);
    document.title = `${navn} – SEFRAK-oppslag`;
    tegnKart(r);
    visRapport(r);
    fd.hidden = true;
  } catch (e) {
    fd.innerHTML = `<div class="feilboks"><h2>Oppslaget feilet</h2><p>${h(e.message)}</p><p class="liten">Sjekk kommune og gårds-/bruksnummer, eller prøv igjen om litt – en av datatjenestene kan være midlertidig utilgjengelig.</p></div>`;
  } finally { laster = false; }
}

function visFeil(tekst) {
  const fd = $('#framdrift');
  fd.hidden = false;
  fd.innerHTML = `<div class="feilboks"><p>${h(tekst)}</p></div>`;
  setTimeout(() => { if (fd.querySelector('.feilboks') && !laster) { fd.hidden = true; if (!resultat) $('#velkommen').hidden = false; } }, 6000);
}

// ---------- Rapport ----------

const merke = (n, revet) => (revet ? '<span class="merke-niv nx">Trolig revet</span>' : `<span class="merke-niv n${n}">${h(NIVAA[n].navn)}</span>`);
const STATUS_TEKST = { fri: 'Kan gjøres uten søknad', avklar: 'Avklar med kommunen først', soknad: 'Søknadspliktig', tillatelse: 'Krever tillatelse etter kulturminneloven' };

function visRapport(r) {
  const e = r.eiendom;
  const navn = `${e.kommune.navn} ${e.gnr}/${e.bnr}${e.fnr ? `/${e.fnr}` : ''}`;
  const paa = r.paaEiendom;
  const hoy = NIVAA[r.hoyesteNivaa];
  const innhold = $('#innhold');
  const sjekkNokkel = `sefrak-sjekk-${e.kommune.nr}-${e.gnr}-${e.bnr}-${e.fnr || 0}`;
  const sjekket = lagre.hent(sjekkNokkel, []);
  const byggMedVern = paa.filter((b) => !b.revet);
  const valgtStd = byggMedVern.length ? r.bygninger.indexOf(byggMedVern.reduce((a, b) => (b.nivaa > a.nivaa ? b : a))) : -1;

  innhold.innerHTML = `
  <header class="sammendrag niv-${hoy.kode}">
    <p class="overtittel">Eiendom · ${h(e.kommune.nr)}</p>
    <h1>${h(navn)}</h1>
    <p class="fakta">${tall(e.arealM2)} m² · ${e.antallTeiger} teig${e.antallTeiger > 1 ? 'er' : ''}${e.noyaktighet.length ? ` · grensenøyaktighet: ${h(e.noyaktighet.join(', ').toLowerCase())}` : ''}</p>
    <div class="hovedstatus">${merke(r.hoyesteNivaa)}<p>${h(hoy.kort)}</p></div>
    <dl class="tellere">
      <div><dt>Bygninger i matrikkelen</dt><dd>${r.teller.bygninger}</dd></div>
      <div><dt>SEFRAK-registrert</dt><dd>${r.teller.sefrak}</dd></div>
      <div><dt>Eldre enn 1850</dt><dd>${r.teller.sefrakFor1850}</dd></div>
      <div><dt>Fredet</dt><dd>${r.teller.fredet}</dd></div>
    </dl>
  </header>

  <nav class="innholdsliste" aria-label="Innhold">
    <a href="#s-begrensninger">Begrensninger</a><a href="#s-bygninger">Bygninger</a><a href="#s-tiltak">Hva vil du gjøre?</a>
    <a href="#s-planer">Arealplaner</a><a href="#s-kulturminner">Kulturminner</a><a href="#s-tilskudd">Tilskudd</a><a href="#s-sjekkliste">Sjekkliste</a><a href="#s-kilder">Kilder</a>
  </nav>

  <section id="s-begrensninger" class="seksjon">
    <h2>Begrensninger for vedlikehold og endringer</h2>
    ${r.begrensninger.map((b) => `
      <article class="begrensning ${b.nivaa}">
        <h3>${h(b.tittel)}</h3>
        ${b.gjelder?.length ? `<p class="gjelder">Gjelder: ${b.gjelder.slice(0, 8).map(h).join(' · ')}${b.gjelder.length > 8 ? ` og ${b.gjelder.length - 8} til` : ''}</p>` : ''}
        <p>${h(b.tekst)}</p>
        <p class="hjemmel">${b.hjemmel.map(([t, u]) => lenke(u, t)).join(' · ')}</p>
      </article>`).join('')}
  </section>

  <section id="s-bygninger" class="seksjon">
    <h2>Bygninger og SEFRAK-registreringer</h2>
    ${r.bygninger.length ? '' : '<p class="tom">Fant ingen bygninger eller SEFRAK-registreringer på eiendommen.</p>'}
    ${r.bygninger.map((b, i) => byggKort(b, i)).join('')}
    <p class="liten">Bygninger merket «nær grensen» ligger like utenfor eiendomsgrensen i kartet. De er tatt med fordi grensene kan være unøyaktige.</p>
  </section>

  <section id="s-tiltak" class="seksjon">
    <h2>Hva vil du gjøre?</h2>
    <p>Velg bygning og tiltak for å se hva som gjelder og hvordan det bør gjøres.</p>
    <div class="tiltak-valg">
      <label>Bygning
        <select id="tiltak-bygg">
          ${r.bygninger.map((b, i) => (b.revet ? '' : `<option value="${i}"${i === valgtStd ? ' selected' : ''}>${h(b.navn || b.type)}${b.bygningsnummer ? ` (${h(b.bygningsnummer)})` : ''} – ${h(NIVAA[b.nivaa].navn)}</option>`)).join('')}
          <option value="-1"${valgtStd === -1 ? ' selected' : ''}>Annen bygning uten registrert vern</option>
        </select>
      </label>
    </div>
    <div class="tiltak-knapper" role="tablist">${TILTAK.map((t, i) => `<button type="button" role="tab" data-tiltak="${t.id}" aria-selected="${i === 0}"><span aria-hidden="true">${t.ikon}</span>${h(t.navn)}</button>`).join('')}</div>
    <div id="tiltak-svar" class="tiltak-svar"></div>
  </section>

  <section id="s-planer" class="seksjon">
    <h2>Arealplaner</h2>
    ${planHtml(r)}
  </section>

  <section id="s-kulturminner" class="seksjon">
    <h2>Kulturminner og kulturmiljøer på eiendommen</h2>
    ${kulturminneHtml(r)}
  </section>

  <section id="s-tilskudd" class="seksjon">
    <h2>Tilskudd og økonomi</h2>
    <div class="kortgrid">${r.tilskudd.map((t) => `<article class="infokort"><h3>${lenke(t.url, t.navn)}</h3><p class="fra">${h(t.fra)}</p><p>${h(t.tekst)}</p></article>`).join('')}</div>
  </section>

  <section id="s-sjekkliste" class="seksjon">
    <h2>Sjekkliste før vedlikehold og oppussing</h2>
    <ul class="sjekkliste">${r.sjekkliste.map((s, i) => `<li><label><input type="checkbox" data-sjekk="${i}"${sjekket.includes(i) ? ' checked' : ''}> <span>${h(s)}</span></label></li>`).join('')}</ul>
    <h3>Hvem kan hjelpe?</h3>
    <div class="kortgrid">${r.kontakter.map((k) => `<article class="infokort"><h3>${lenke(k.url, k.navn)}</h3><p>${h(k.tekst)}</p></article>`).join('')}</div>
  </section>

  <section id="s-kilder" class="seksjon kilder">
    <h2>Om dataene</h2>
    <ul>
      <li><b>SEFRAK</b> (SEkretariatet For Registrering Av faste Kulturminner) er en landsdekkende registrering av bygninger eldre enn ca. 1900, gjort 1975–1995. Den er ikke oppdatert siden, så bygninger kan være endret, revet eller feildatert. SEFRAK-registrering gir ikke vern i seg selv – det er alderen (før 1850), fredning eller plan som gir juridiske følger.</li>
      <li><b>Kommunal listeføring</b> og kommunale kulturminneplaner er bare delvis registrert i Askeladden. Kommunen kan ha vernevedtak som ikke vises her.</li>
      <li><b>Arealplaner</b> hentes fra Nasjonal arealplanbase. Ikke alle kommuner leverer dit (bl.a. Oslo). Planbestemmelsene må leses i kommunens planinnsyn.</li>
      <li>Kulturminneloven er under revisjon. Paragrafhenvisningene kan endres når ny lov trer i kraft – sjekk <a href="https://lovdata.no/" target="_blank" rel="noopener">Lovdata</a>.</li>
      <li>Oversikten er ment som hjelp til å planlegge, og er ingen juridisk vurdering. Kommunen og fylkeskommunen avgjør hva som er tillatt.</li>
    </ul>
    <p class="kildestatus">${KILDER.map(([k, t]) => {
      const f = k === 'planer' ? (r.planer.feil[0] || null) : r.kilder?.[k];
      return `<span class="${f ? 'feil' : 'ok'}" title="${h(f || 'Hentet')}">${f ? '⚠' : '✓'} ${h(t)}</span>`;
    }).join('')}</p>
    <p class="liten">Hentet ${new Date().toLocaleString('nb-NO')}. Kilder: Kartverket, Geonorge (Matrikkelen – bygningspunkt, Kulturminner WFS), Riksantikvaren (SEFRAK, freda bygninger, kulturmiljøer), DiBK Nasjonal arealplanbase.</p>
  </section>`;

  innhold.hidden = false;
  $('#skriv').hidden = false;
  innhold.scrollTop = 0;
  $('#rapport').scrollTop = 0;

  const velgBygg = $('#tiltak-bygg');
  let tiltak = TILTAK[0].id;
  const oppdaterTiltak = () => {
    const i = +velgBygg.value;
    const b = r.bygninger[i];
    const n = b ? b.nivaa : 0;
    const v = veiledTiltak(tiltak, n, { lnf: r.planer.formal.some((f) => f.lnf) });
    $('#tiltak-svar').innerHTML = `
      <div class="tiltak-status ${v.status}"><b>${h(STATUS_TEKST[v.status])}</b><span>${h(b ? NIVAA[n].navn : 'Uten registrert vern')}</span></div>
      <p>${h(v.tekst)}</p>
      ${v.raad.length ? `<h4>Slik gjør du det skånsomt</h4><ul>${v.raad.map((x) => `<li>${h(x)}</li>`).join('')}</ul>` : ''}`;
  };
  velgBygg.addEventListener('change', oppdaterTiltak);
  innhold.querySelectorAll('[data-tiltak]').forEach((k) => k.addEventListener('click', () => {
    tiltak = k.dataset.tiltak;
    innhold.querySelectorAll('[data-tiltak]').forEach((x) => x.setAttribute('aria-selected', x === k));
    oppdaterTiltak();
  }));
  oppdaterTiltak();

  innhold.querySelectorAll('[data-sjekk]').forEach((c) => c.addEventListener('change', () => {
    lagre.sett(sjekkNokkel, [...innhold.querySelectorAll('[data-sjekk]:checked')].map((x) => +x.dataset.sjekk));
  }));
  innhold.querySelectorAll('[data-vis-kart]').forEach((k) => k.addEventListener('click', (ev) => {
    ev.preventDefault();
    const m = markorer.get(+k.dataset.visKart);
    if (m) { kart.setView(m.getLatLng(), Math.max(kart.getZoom(), 18)); m.openTooltip(); document.querySelector('.kartkolonne').scrollIntoView({ behavior: 'smooth' }); }
  }));
}

const SEFRAK_FELT = [
  ['tidsangivelse', 'Datering'], ['yttervegg', 'Yttervegg'], ['fasade', 'Fasade/kledning'], ['takform', 'Takform'], ['taktekking', 'Taktekking'],
  ['etasjetall', 'Etasjer'], ['kjeller', 'Kjeller/golv'], ['underbyggingsKonstr', 'Grunnmur/fundament'], ['antallSkorsteiner', 'Skorsteiner'],
  ['lengde', 'Lengde'], ['bredde', 'Bredde'], ['fysiskMiljø', 'Miljø'], ['opprinneligSosialtMiljø', 'Opprinnelig eier'], ['forholdAndreHus', 'Forhold til andre hus'],
  ['sefrakFunksjon', 'Funksjon'], ['bygningsendring', 'Bygningsendring'], ['endingsgrad', 'Endringsgrad'], ['sefrakTiltak', 'Tiltak'],
  ['kulturminneVerneverdi', 'Verneverdi'], ['feltregistrert', 'Registrert'],
];
const SEFRAK_KJENT = new Set(['id', 'geometri', 'sefrakId', 'objektnavn', 'sefrakStatus', 'bygningsnummer', 'bygningstype', 'askeladdenId', 'SEFRAKkommune', 'registreringkretsnr', 'husløpenr', 'lokaltNavn', 'fredning', 'vernevedtak', 'vurdertDato', 'kulturminneHovedgruppe']);

function sefrakVerdi(k, v) {
  if (k === 'lengde' || k === 'bredde') return `${(v / 100).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} m`;
  return v;
}

const kulturminnesokKart = ([lon, lat]) => `https://www.kulturminnesok.no/kart/?bounds=${(lat + 0.0012).toFixed(5)},${(lon - 0.0025).toFixed(5)},${(lat - 0.0012).toFixed(5)},${(lon + 0.0025).toFixed(5)}`;

function byggKort(b, i) {
  const s = b.sefrak;
  const raad = raadForBygning(b);
  const st = s ? SEFRAK_STATUS[s.sefrakStatus] : null;
  return `
  <details class="byggkort n${b.revet ? 'x' : b.nivaa}" id="bygg-${i}"${i < 3 && (b.nivaa || b.sefrak) ? ' open' : ''}>
    <summary>
      <span class="tittel"><b>${h(b.navn || b.type)}</b><small>${h([b.navn ? b.type : null, b.bygningsnummer ? `bygningsnr. ${b.bygningsnummer}` : null, b.paaEiendom ? null : 'nær grensen'].filter(Boolean).join(' · '))}</small></span>
      ${merke(b.nivaa, b.revet)}
    </summary>
    <div class="byggkropp">
      <p class="status-linje">${h(b.status)} · <a href="#" data-vis-kart="${i}">Vis i kart</a></p>
      ${b.grunner.length ? `<ul class="grunner">${b.grunner.map((g) => `<li class="n${g.nivaa}">${h(g.tekst)} <small>(${h(g.kilde)})</small></li>`).join('')}</ul>` : ''}
      ${!b.revet ? `<p class="nivaa-tekst">${h(NIVAA[b.nivaa].kort)}</p>` : ''}
      ${s ? `
        <h4>SEFRAK ${h(s.sefrakId)}${st ? ` – ${h(st.kort)}` : ''}</h4>
        <dl class="sefrak-tabell">
          ${s.objektnavn ? `<div><dt>Registrert som</dt><dd>${h(s.objektnavn)}</dd></div>` : ''}
          ${s.lokaltNavn ? `<div><dt>Lokalt navn</dt><dd>${h(s.lokaltNavn)}</dd></div>` : ''}
          ${SEFRAK_FELT.filter(([k]) => s[k] != null && s[k] !== '').map(([k, t]) => `<div><dt>${h(t)}</dt><dd>${h(sefrakVerdi(k, s[k]))}</dd></div>`).join('')}
          ${Object.entries(s).filter(([k, v]) => !SEFRAK_KJENT.has(k) && !SEFRAK_FELT.some(([f]) => f === k) && v != null && v !== '' && typeof v !== 'object').map(([k, v]) => `<div><dt>${h(k)}</dt><dd>${h(v)}</dd></div>`).join('')}
        </dl>
        <p class="lenker">${lenke(kulturminnesokKart(b.punkt), 'Se i Kulturminnesøk')}${s.askeladdenId ? ` · ${lenke(`https://askeladden.ra.no/askeladden/?kid=${s.askeladdenId}`, `Askeladden ${s.askeladdenId}`)}` : ''}</p>` : ''}
      ${b.freda ? `<p class="lenker">Fredning: ${h(vernetype(b.freda.vernetype))}${b.freda.vernedato ? ` fra ${h(b.freda.vernedato.slice(0, 10))}` : ''} · ${lenke(b.freda.linkKulturminnesøk, 'Kulturminnesøk')} · ${lenke(b.freda.linkAskeladden, 'Askeladden')}</p>` : ''}
      ${b.kulturminner.filter((k) => k.linkKulturminnesok).slice(0, 4).map((k) => `<p class="lenker">${h(k.navn || k.id)} – ${h(vernetype(k.vernetype))} · ${lenke(k.linkKulturminnesok, 'Kulturminnesøk')}</p>`).join('')}
      ${raad.length && !b.revet ? `<h4>Råd for vedlikehold av denne bygningen</h4><ul class="raad">${raad.map(([t, x]) => `<li><b>${h(t)}:</b> ${h(x)}</li>`).join('')}</ul>` : ''}
    </div>
  </details>`;
}

function planHtml(r) {
  const p = r.planer;
  if (!p.planer.length && !p.soner.length && !p.formal.length) {
    return `<p class="tom">Fant ingen arealplan i Nasjonal arealplanbase for eiendommen.${p.feil.length ? ` (Feil: ${h(p.feil[0])})` : ''} Kommunen leverer kanskje ikke data dit – sjekk kommunens planinnsyn.</p>
      <p>${lenke(`https://www.google.com/search?q=${encodeURIComponent(`${r.eiendom.kommune.navn} kommune planinnsyn`)}`, `Finn planinnsyn for ${r.eiendom.kommune.navn}`)}</p>`;
  }
  return `
    ${p.planer.map((x) => `<article class="plan"><h3>${lenke(x.link, x.navn)}</h3><p>${h([x.plantype, x.status, x.vedtatt ? `i kraft ${x.vedtatt}` : null, x.id ? `plan-ID ${x.id}` : null].filter(Boolean).join(' · '))}</p></article>`).join('')}
    ${p.formal.length ? `<h3>Arealformål</h3><ul>${p.formal.map((f) => `<li>${h(f.navn)}${f.felt ? ` (felt ${h(f.felt)})` : ''}${f.utdyping ? ` – ${h(f.utdyping)}` : ''}</li>`).join('')}</ul>` : ''}
    ${p.soner.length ? `<h3>Hensynssoner</h3><ul>${p.soner.map((z) => `<li class="${z.kultur ? 'kultur' : ''}">${h(z.navn)}${z.sonenavn ? ` (${h(z.sonenavn)})` : ''}${z.beskrivelse && z.beskrivelse !== z.navn ? ` – ${h(z.beskrivelse)}` : ''}</li>`).join('')}</ul>` : '<p>Ingen hensynssoner registrert i punktene som ble sjekket.</p>'}
    ${p.bestemmelser.length ? `<h3>Bestemmelsesområder</h3><ul>${p.bestemmelser.map((x) => `<li>${h(x.navn)}</li>`).join('')}</ul>` : ''}
    <p class="liten">Planene er sjekket i bygningenes plassering og ett punkt inne på eiendommen. Les alltid planbestemmelsene – de står i plandokumentet bak lenken.</p>`;
}

function kulturminneHtml(r) {
  const { enkeltminner, lokaliteter, sikringssoner } = r.kulturminner;
  const liste = [...lokaliteter, ...enkeltminner.filter((e) => !lokaliteter.some((l) => e.id?.startsWith(`${l.id?.split('-')[0]}-`) && e.navn === l.navn))];
  if (!liste.length && !sikringssoner.length && !r.kulturmiljoer.length) return '<p class="tom">Ingen registrerte kulturminner, sikringssoner eller kulturmiljøer i Askeladden på eiendommen (utover SEFRAK).</p>';
  return `
    ${liste.length ? `<ul class="kmliste">${liste.map((k) => `<li><b>${lenke(k.linkKulturminnesok, k.navn || k.id)}</b> <span class="km-type">${h(k.type)} · ${h(KULTURMINNEKATEGORI[k.kategori] || k.kategori || '')} · ${h(vernetype(k.vernetype))}</span>${k.informasjon ? `<p>${h(k.informasjon.slice(0, 280))}${k.informasjon.length > 280 ? ' …' : ''}</p>` : ''}</li>`).join('')}</ul>` : ''}
    ${sikringssoner.length ? `<p><b>${sikringssoner.length} sikringssone${sikringssoner.length > 1 ? 'r' : ''}</b> rundt automatisk fredete kulturminner berører eiendommen (stiplet lilla i kartet).</p>` : ''}
    ${r.kulturmiljoer.map((m) => `<article class="plan"><h3>${lenke(m.linkKulturminnesok, m.navn)}</h3><p>${h(KULTURMINNEKATEGORI[m.kulturmiljokategori] || m.kulturmiljokategori || 'Kulturmiljø')}</p>${m.informasjon ? `<p>${h(m.informasjon.slice(0, 400))}${m.informasjon.length > 400 ? ' …' : ''}</p>` : ''}</article>`).join('')}`;
}

$('#skriv').addEventListener('click', () => {
  document.querySelectorAll('.byggkort').forEach((d) => { d.open = true; });
  setTimeout(() => window.print(), 50);
});

// Start
kommunerKlar();
if (location.hash.length > 1) slaaOppHash(location.hash.slice(1));
