import {
  GRAN, TYPER, NIVAA, UKEMAAL_MIN, minutter, kalorier, skritt, anstrengelse, ukensMinutter, ukensTur, ukestart,
  avstandTilRute, gpx, filnavn, linjeLengde,
} from './geo.js';
import { sokAdresse, hentVaer, symbolTekst, turvaer } from './kilder.js';

const IKON = 'https://cdn.jsdelivr.net/gh/metno/weathericons@89e3173756248b4696b9b10677b66c4ef435db53/weather/svg';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tall = (x, d = 0) => x.toLocaleString('nb-NO', { minimumFractionDigits: d, maximumFractionDigits: d });
const km = m => (m < 10000 ? `${tall(m / 1000, 1)} km` : `${tall(m / 1000)} km`);
const tid = min => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} t ${min % 60 ? `${min % 60} min` : ''}`.trim());
const lagre = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privat modus */ } };
const les = (k, std) => { try { return JSON.parse(localStorage.getItem(k)) ?? std; } catch { return std; } };

const tilstand = {
  ruter: [],
  type: les('turveier-type', 'tur'),
  lengde: '',
  sortering: 'bruk',
  fra: null,          // { punkt: [lat, lon], tekst }
  valgt: null,
  logg: les('turveier-logg', []),
  vekt: les('turveier-vekt', 70),
};

// ---------- Kart ----------

const kvAttr = '© <a href="https://www.kartverket.no/">Kartverket</a>';
const kart = L.map('kart', { zoomControl: true }).setView(GRAN.sentrum, 11);
const grunnkart = {
  Topografisk: L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png', { maxZoom: 19, maxNativeZoom: 18, attribution: kvAttr }),
  Gråtone: L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/webmercator/{z}/{y}/{x}.png', { maxZoom: 19, maxNativeZoom: 18, attribution: kvAttr }),
  Flyfoto: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri, Maxar, Earthstar Geographics' }),
};
(grunnkart[les('turveier-grunnkart', 'Topografisk')] || grunnkart.Topografisk).addTo(kart);
kart.on('baselayerchange', e => lagre('turveier-grunnkart', e.name));

// Stravas åpne varmekart har 512-pikselfliser til zoom 11; zoomOffset -1 gir skarpe fliser i Leaflets zoom 12.
const varmekart = aktivitet => L.tileLayer(`https://heatmap-external-{s}.strava.com/tiles/${aktivitet}/hot/{z}/{x}/{y}.png`, {
  subdomains: 'abc', tileSize: 512, zoomOffset: -1, maxNativeZoom: 12, maxZoom: 19, opacity: 0.75,
  attribution: '<a href="https://www.strava.com/maps/global-heatmap">Strava Global Heatmap</a>',
});
const grenseLag = L.layerGroup().addTo(kart);
const ruteLag = L.layerGroup().addTo(kart);
const markorLag = L.layerGroup().addTo(kart);
L.control.layers(grunnkart, {
  'Varmekart: alle aktiviteter': varmekart('all'),
  'Varmekart: sykling': varmekart('ride'),
  'Varmekart: til fots': varmekart('run'),
  'Kommunegrensa': grenseLag,
}, { position: 'topright' }).addTo(kart);
L.control.scale({ imperial: false }).addTo(kart);

const forklaring = L.control({ position: 'bottomleft' });
forklaring.onAdd = () => {
  const d = L.DomUtil.create('div', 'forklaring');
  d.innerHTML = '<span>Lite brukt</span><i class="n1"></i><i class="n2"></i><i class="n3"></i><i class="n4"></i><i class="n5"></i><span>Mye brukt</span>';
  return d;
};
forklaring.addTo(kart);

const linjer = new Map(); // ruteid → L.polyline

function tegnRuter() {
  ruteLag.clearLayers();
  linjer.clear();
  const farge = TYPER[tilstand.type].farge;
  // Lite brukte ruter tegnes først, så de mest brukte ligger øverst.
  const stil = r => {
    if (r.id === tilstand.valgt) return { color: farge, weight: 8, opacity: 1 };
    // Når en rute er valgt, tones de andre ned så den valgte synes.
    const demp = tilstand.valgt ? 0.35 : 1;
    return { color: farge, weight: 2 + r.nivaa * 1.1, opacity: (0.35 + r.nivaa * 0.13) * demp };
  };
  // Den valgte ruta tegnes sist, med hvit kant, så den ligger over alle de andre.
  const valgtRute = tilstand.ruter.find(r => r.id === tilstand.valgt);
  const rekkefolge = synlige().reverse().filter(r => r !== valgtRute);
  if (valgtRute) rekkefolge.push(valgtRute);
  for (const r of rekkefolge) {
    const valgt = r === valgtRute;
    if (valgt) L.polyline(r.linjer, { color: '#fff', weight: 13, opacity: 0.9, interactive: false }).addTo(ruteLag);
    const linje = L.polyline(r.linjer, { ...stil(r), lineCap: 'round' });
    linje.bindTooltip(`<b>${esc(r.navn)}</b><br>${NIVAA[r.nivaa - 1] || 'Ingen registrert bruk'} · ${km(r.lengde)}`, { sticky: true });
    linje.on('click', () => velg(r.id));
    linje.on('mouseover', () => linje.setStyle({ weight: 8, opacity: 1 }));
    linje.on('mouseout', () => linje.setStyle(stil(r)));
    linje.addTo(ruteLag);
    linjer.set(r.id, linje);
  }
}

function tegnFra() {
  markorLag.clearLayers();
  if (!tilstand.fra) return;
  L.circleMarker(tilstand.fra.punkt, { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 })
    .bindTooltip(esc(tilstand.fra.tekst)).addTo(markorLag);
}

// ---------- Filter og liste ----------

function synlige() {
  const [min, maks] = tilstand.lengde ? tilstand.lengde.split('-').map(v => (v === '' ? Infinity : +v * 1000)) : [0, Infinity];
  const liste = tilstand.ruter.filter(r => r.type === tilstand.type && r.lengde >= min && r.lengde < maks);
  const avstand = r => (tilstand.fra ? avstandTilRute(tilstand.fra.punkt, r) : 0);
  const sorter = {
    bruk: (a, b) => b.indeks - a.indeks,
    naer: (a, b) => avstand(a) - avstand(b),
    kort: (a, b) => a.lengde - b.lengde,
    lang: (a, b) => b.lengde - a.lengde,
    flat: (a, b) => (a.opp || 0) / a.lengde - (b.opp || 0) / b.lengde,
  }[tilstand.sortering];
  return liste.sort(sorter);
}

const nivaaStolper = n => `<span class="nivaa n${n}" title="${NIVAA[n - 1] || 'Ingen registrert bruk'}">${[1, 2, 3, 4, 5].map(i => `<i${i <= n ? ' class="på"' : ''}></i>`).join('')}</span>`;

function visTyper() {
  $('#typer').innerHTML = Object.entries(TYPER).map(([id, t]) => {
    const antall = tilstand.ruter.filter(r => r.type === id).length;
    return `<button type="button" role="tab" class="fane${id === tilstand.type ? ' aktiv' : ''}" aria-selected="${id === tilstand.type}" data-type="${id}" style="--farge:${t.farge}">${t.navn} <span>${antall}</span></button>`;
  }).join('');
}

function visListe() {
  const liste = synlige();
  const modus = tilstand.type === 'sykkel' ? 'sykkel' : 'gange';
  $('#ruter').innerHTML = liste.map(r => {
    const avst = tilstand.fra ? avstandTilRute(tilstand.fra.punkt, r) : null;
    return `<li><button type="button" class="rute${r.id === tilstand.valgt ? ' valgt' : ''}" data-id="${esc(r.id)}">
      <span class="rang">${r.rang}</span>
      <span class="hoved">
        <b>${esc(r.navn)}</b>
        <span class="fakta">${km(r.lengde)} · ${tid(minutter(r, modus))}${r.opp ? ` · ↑${r.opp} m` : ''}${avst != null ? ` · ${avst < 1000 ? `${Math.round(avst / 10) * 10} m` : km(avst)} unna` : ''}</span>
      </span>
      ${nivaaStolper(r.nivaa)}
    </button></li>`;
  }).join('') || '<li class="tom">Ingen ruter med dette filteret.</li>';
  tegnRuter();
}

// ---------- Ukemål og ukens tur ----------

function visUkemaal() {
  const min = ukensMinutter(tilstand.logg);
  const andel = Math.min(1, min / UKEMAAL_MIN);
  const start = ukestart().getTime();
  const uka = tilstand.logg.filter(l => new Date(l.dato).getTime() >= start);
  $('#ukemaal').innerHTML = `
    <div class="maalhode">
      <div>
        <h2>Ukemålet ditt</h2>
        <p class="liten">Helsedirektoratet anbefaler minst ${UKEMAAL_MIN} minutter moderat aktivitet i uka.</p>
      </div>
      <div class="maaltall"><b>${min}</b><span>av ${UKEMAAL_MIN} min</span></div>
    </div>
    <div class="maalbar" role="progressbar" aria-valuemin="0" aria-valuemax="${UKEMAAL_MIN}" aria-valuenow="${min}"><i style="width:${andel * 100}%"></i></div>
    <p class="maaltekst">${min >= UKEMAAL_MIN ? 'Du har nådd ukemålet – bra jobba! Alt over er bonus for helsa.' : min ? `${UKEMAAL_MIN - min} minutter igjen denne uka.` : 'Registrer turene dine her, så ser du hvor nær du er målet.'}</p>
    <div class="hurtig">
      <span class="liten">Annen aktivitet:</span>
      ${[15, 30, 60].map(m => `<button type="button" class="brikke" data-min="${m}">+${m} min</button>`).join('')}
      ${uka.length ? '<button type="button" class="lenkeknapp" id="angre">Angre siste</button>' : ''}
    </div>`;
}

function visUkensTur() {
  const r = ukensTur(tilstand.ruter);
  $('#ukenstur').hidden = !r;
  if (!r) return;
  $('#ukenstur').innerHTML = `<button type="button" class="ukenstur-knapp" data-id="${esc(r.id)}">
    <span class="liten">Ukens tur</span>
    <b>${esc(r.navn)}</b>
    <span class="fakta">${km(r.lengde)} · ca. ${tid(minutter(r))}${r.opp ? ` · ↑${r.opp} m` : ''} · ${NIVAA[r.nivaa - 1].toLowerCase()}</span>
  </button>`;
}

function loggTur(min, r = null) {
  tilstand.logg.push({ dato: new Date().toISOString(), min, id: r?.id || null, navn: r?.navn || 'Annen aktivitet' });
  // Eldre enn et år trengs ikke.
  const grense = Date.now() - 366 * 864e5;
  tilstand.logg = tilstand.logg.filter(l => new Date(l.dato).getTime() > grense);
  lagre('turveier-logg', tilstand.logg);
  visUkemaal();
  status(`${min} minutter lagt til ukemålet.`);
}

// ---------- Detaljer ----------

function profilSvg(profil) {
  const h = profil.filter(v => v != null);
  if (h.length < 2) return '';
  const min = Math.min(...h), maks = Math.max(...h), spenn = Math.max(20, maks - min);
  const B = 320, H = 90;
  const pkt = profil.map((v, i) => [(i / (profil.length - 1)) * B, H - 8 - (((v ?? min) - min) / spenn) * (H - 20)]);
  const linje = pkt.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return `<figure class="profil">
    <svg viewBox="0 0 ${B} ${H}" preserveAspectRatio="none" role="img" aria-label="Høydeprofil fra ${min} til ${maks} moh.">
      <polygon points="0,${H} ${linje} ${B},${H}" class="flate-profil"/>
      <polyline points="${linje}" class="linje-profil"/>
    </svg>
    <figcaption class="liten"><span>Høydeprofil (lengste sammenhengende del)</span><span>${min}–${maks} moh.</span></figcaption>
  </figure>`;
}

function startpunkt(r) {
  const hoved = r.linjer.reduce((a, b) => (linjeLengde(b) > linjeLengde(a) ? b : a));
  return hoved[0];
}

function visDetalj(r) {
  const modus = r.type === 'sykkel' ? 'sykkel' : 'gange';
  const min = minutter(r, modus);
  const start = startpunkt(r);
  const etiketter = [
    r.gradering && `Gradering: ${r.gradering}`,
    ...r.spesial,
    !r.gradering && r.type === 'tur' && `${anstrengelse(r)} (anslått)`,
  ].filter(Boolean);
  $('#detalj').innerHTML = `
    <button type="button" class="tilbake lenkeknapp" id="tilbake">← Alle ${TYPER[r.type].navn.toLowerCase()}</button>
    <p class="type" style="--farge:${TYPER[r.type].farge}">${TYPER[r.type].entall}${r.nummer ? ` · ${esc(r.nummer)}` : ''}</p>
    <h2>${esc(r.navn)}</h2>
    <div class="bruk">
      ${nivaaStolper(r.nivaa)}
      <span><b>${NIVAA[r.nivaa - 1] || 'Ingen registrert bruk'}</b> · nr. ${r.rang} av ${tilstand.ruter.filter(x => x.type === r.type).length} · bruksindeks ${r.indeks}</span>
    </div>
    ${etiketter.length ? `<p class="etiketter">${etiketter.map(e => `<span class="brikke">${esc(e)}</span>`).join('')}</p>` : ''}
    <div class="nokkeltall">
      <div class="tall"><b>${km(r.lengde)}</b><span>lengde i Gran</span></div>
      <div class="tall"><b>${tid(min)}</b><span>${modus === 'sykkel' ? 'på sykkel' : 'å gå'}</span></div>
      <div class="tall"><b>${r.opp != null ? `${r.opp} m` : '–'}</b><span>stigning</span></div>
      <div class="tall"><b>${tall(kalorier(r, tilstand.vekt, modus))}</b><span>kcal (ca.)</span></div>
      <div class="tall"><b>${modus === 'sykkel' ? `${Math.min(100, Math.round((min / UKEMAAL_MIN) * 100))} %` : tall(skritt(r))}</b><span>${modus === 'sykkel' ? 'av ukemålet' : 'skritt'}</span></div>
      <div class="tall"><b>${r.andel} %</b><span>av ruta har spor</span></div>
    </div>
    ${r.profil ? profilSvg(r.profil) : ''}
    <div class="handlinger">
      <button type="button" class="knapp" id="logg">${modus === 'sykkel' ? 'Jeg har syklet denne' : 'Jeg har gått denne'} (+${min} min)</button>
      <button type="button" class="knapp sekundaer" id="gpx">Last ned GPX</button>
      <a class="knapp sekundaer" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${start[0]},${start[1]}">Veibeskrivelse til start</a>
      <button type="button" class="knapp sekundaer" id="del">Del</button>
    </div>
    <section class="vaer" id="vaer"><p class="liten">Henter vær ved start …</p></section>
    <dl class="info">
      ${r.underlag?.length ? `<dt>Underlag</dt><dd>${r.underlag.map(u => `${esc(u.navn)} ${u.andel} %`).join(', ')}</dd>` : ''}
      ${r.ansvarlig?.length ? `<dt>Vedlikeholdes av</dt><dd>${r.ansvarlig.map(esc).join(', ')}</dd>` : ''}
      <dt>Kilde</dt><dd>${r.kilde === 'nvdb' ? 'Vegnettet i NVDB (Statens vegvesen)' : 'Turrutebasen (Kartverket)'}${r.linjer.length > 1 ? ` · ruta består av ${r.linjer.length} deler i Gran` : ''}</dd>
    </dl>`;
  $('#detalj').hidden = false;
  $('#oversikt').hidden = true;
  $('.liste').scrollTop = 0;
  visVaer(start);
}

async function visVaer(punkt) {
  const id = tilstand.valgt;
  try {
    const serie = await hentVaer(punkt);
    if (id !== tilstand.valgt) return;
    const naa = serie[0];
    $('#vaer').innerHTML = `
      <div class="vaernaa">
        ${naa.symbol ? `<img src="${IKON}/${naa.symbol}.svg" alt="${esc(symbolTekst(naa.symbol))}" width="44" height="44">` : ''}
        <div><b>${Math.round(naa.temp)}° · ${esc(symbolTekst(naa.symbol))}</b><span class="liten">Vind ${tall(naa.vind)} m/s · ${esc(turvaer(serie))}</span></div>
      </div>
      <ol class="timer">${serie.slice(1, 9).map(t => `<li><span>${new Date(t.tid).toLocaleTimeString('nb-NO', { hour: '2-digit' })}</span>${t.symbol ? `<img src="${IKON}/${t.symbol}.svg" alt="${esc(symbolTekst(t.symbol))}" width="28" height="28">` : ''}<b>${Math.round(t.temp)}°</b></li>`).join('')}</ol>`;
  } catch {
    if (id === tilstand.valgt) $('#vaer').innerHTML = '<p class="liten">Fikk ikke hentet været akkurat nå.</p>';
  }
}

function velg(id, { zoom = true } = {}) {
  const r = tilstand.ruter.find(x => x.id === id);
  if (!r) return;
  if (r.type !== tilstand.type) { tilstand.type = r.type; visTyper(); }
  tilstand.valgt = id;
  history.replaceState(null, '', `#rute=${encodeURIComponent(id)}`);
  visListe();
  visDetalj(r);
  if (zoom) kart.fitBounds(L.latLngBounds(r.linjer.flat()), { padding: [30, 30], maxZoom: 15 });
}

function lukk() {
  tilstand.valgt = null;
  history.replaceState(null, '', location.pathname + location.search);
  $('#detalj').hidden = true;
  $('#oversikt').hidden = false;
  visListe();
}

// ---------- Status ----------

let statusTid;
function status(tekst, feil = false) {
  const s = $('#status');
  s.textContent = tekst;
  s.classList.toggle('feil', feil);
  clearTimeout(statusTid);
  if (tekst) statusTid = setTimeout(() => { s.textContent = ''; }, 4000);
}

function settFra(punkt, tekst) {
  tilstand.fra = { punkt, tekst };
  tilstand.sortering = 'naer';
  $('#sortering').value = 'naer';
  $('#fra').hidden = false;
  $('#fra').innerHTML = `Avstand fra ${esc(tekst)} · <button type="button" class="lenkeknapp" id="fjernfra">fjern</button>`;
  tegnFra();
  if (tilstand.valgt) lukk(); else visListe();
  kart.setView(punkt, 13);
}

// ---------- Hendelser ----------

$('#typer').addEventListener('click', e => {
  const b = e.target.closest('[data-type]');
  if (!b) return;
  tilstand.type = b.dataset.type;
  lagre('turveier-type', tilstand.type);
  visTyper();
  if (tilstand.valgt) lukk(); else visListe();
});
$('#lengde').addEventListener('change', e => { tilstand.lengde = e.target.value; visListe(); });
$('#sortering').addEventListener('change', e => {
  tilstand.sortering = e.target.value;
  if (tilstand.sortering === 'naer' && !tilstand.fra) finnMeg();
  visListe();
});
$('#ruter').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) velg(b.dataset.id); });
$('#ukenstur').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) velg(b.dataset.id); });
$('#ukemaal').addEventListener('click', e => {
  const b = e.target.closest('[data-min]');
  if (b) loggTur(+b.dataset.min);
  if (e.target.id === 'angre') {
    tilstand.logg.pop();
    lagre('turveier-logg', tilstand.logg);
    visUkemaal();
  }
});
$('#fra').addEventListener('click', e => {
  if (e.target.id !== 'fjernfra') return;
  tilstand.fra = null;
  tilstand.sortering = 'bruk';
  $('#sortering').value = 'bruk';
  $('#fra').hidden = true;
  tegnFra();
  visListe();
});

$('#detalj').addEventListener('click', async e => {
  const r = tilstand.ruter.find(x => x.id === tilstand.valgt);
  if (!r) return;
  if (e.target.id === 'tilbake') lukk();
  if (e.target.id === 'logg') loggTur(minutter(r, r.type === 'sykkel' ? 'sykkel' : 'gange'), r);
  if (e.target.id === 'gpx') {
    const url = URL.createObjectURL(new Blob([gpx(r)], { type: 'application/gpx+xml' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${filnavn(r.navn)}.gpx` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (e.target.id === 'del') {
    const lenke = location.href;
    try {
      if (navigator.share) await navigator.share({ title: r.navn, text: `${r.navn} – ${km(r.lengde)} i Gran`, url: lenke });
      else { await navigator.clipboard.writeText(lenke); status('Lenken er kopiert.'); }
    } catch { /* avbrutt */ }
  }
});

function finnMeg() {
  if (!navigator.geolocation) { status('Nettleseren kan ikke finne posisjonen din.', true); return; }
  status('Finner posisjonen din …');
  navigator.geolocation.getCurrentPosition(
    p => settFra([p.coords.latitude, p.coords.longitude], 'din posisjon'),
    () => status('Fikk ikke tilgang til posisjonen. Søk på en adresse i stedet.', true),
    { enableHighAccuracy: true, timeout: 10000 },
  );
}
$('#nermeg').addEventListener('click', finnMeg);

let forslagListe = [];
$('#sok').addEventListener('submit', async e => {
  e.preventDefault();
  const tekst = $('#sokefelt').value.trim();
  if (!tekst) return;
  try {
    forslagListe = await sokAdresse(tekst);
    if (forslagListe.length === 1) { settFra(forslagListe[0].punkt, forslagListe[0].tekst); $('#forslag').hidden = true; return; }
    $('#forslag').innerHTML = forslagListe.map((f, i) => `<li><button type="button" data-i="${i}">${esc(f.tekst)}</button></li>`).join('') || '<li class="tom">Fant ingen adresse i Gran.</li>';
    $('#forslag').hidden = false;
  } catch { status('Adressesøket svarte ikke.', true); }
});
$('#forslag').addEventListener('click', e => {
  const b = e.target.closest('[data-i]');
  if (!b) return;
  const f = forslagListe[+b.dataset.i];
  $('#forslag').hidden = true;
  $('#sokefelt').value = f.tekst;
  settFra(f.punkt, f.tekst);
});

$('#vekt').addEventListener('click', () => {
  const svar = prompt('Vekt i kg (brukes bare til å anslå energiforbruk, og lagres bare i denne nettleseren):', tilstand.vekt);
  const v = Math.round(+String(svar).replace(',', '.'));
  if (v >= 20 && v <= 250) {
    tilstand.vekt = v;
    lagre('turveier-vekt', v);
    $('#vekttekst').textContent = v;
    const r = tilstand.ruter.find(x => x.id === tilstand.valgt);
    if (r) visDetalj(r);
  }
});

window.addEventListener('hashchange', () => {
  const id = decodeURIComponent(location.hash.match(/rute=([^&]+)/)?.[1] || '');
  if (id && id !== tilstand.valgt) velg(id);
});

// ---------- Oppstart ----------

async function start() {
  $('#vekttekst').textContent = tilstand.vekt;
  if (!TYPER[tilstand.type]) tilstand.type = 'tur';
  try {
    const d = await (await fetch('data/ruter.json')).json();
    tilstand.ruter = d.ruter;
    $('#hentet').textContent = `Data oppdatert ${new Date(d.hentet).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}.`;
    L.polygon(d.grense, { color: '#0f5a4f', weight: 2, dashArray: '6 6', fill: false, interactive: false }).addTo(grenseLag);
    kart.fitBounds(L.latLngBounds(d.grense.flat(2)), { padding: [10, 10] });
  } catch (e) {
    status('Fikk ikke lastet rutene.', true);
    console.error(e);
  }
  visTyper();
  visUkemaal();
  visUkensTur();
  visListe();
  const id = decodeURIComponent(location.hash.match(/rute=([^&]+)/)?.[1] || '');
  if (id) velg(id);
}

start();
