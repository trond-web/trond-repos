import {
  RAADHUS, KATEGORIER, hentVirksomheter, grupperSteder, geokod, sokAdresse, avstandKm, retning,
  hentKjoreavstander, hentVaer, vaerVed, symbolTekst, vindretningTekst, iParallell,
} from './kilder.js';

const IKON = 'https://cdn.jsdelivr.net/gh/metno/weathericons@89e3173756248b4696b9b10677b66c4ef435db53/weather/svg';
const KAT = Object.fromEntries(KATEGORIER.map(k => [k.id, k]));
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tall = (x, d = 1) => x.toLocaleString('nb-NO', { minimumFractionDigits: d, maximumFractionDigits: d });
const grader = t => (t == null ? '–' : `${Math.round(t) === 0 ? 0 : Math.round(t)}°`);
const lagre = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privat modus */ } };
const les = (k, std) => { try { return JSON.parse(localStorage.getItem(k)) ?? std; } catch { return std; } };

const tilstand = {
  steder: [],
  egne: les('gran-egne', []),
  vaer: new Map(),       // stedsid → tidsserie fra MET
  kjoring: new Map(),    // stedsid → { km, min }
  tid: null,             // valgt tidspunkt (ISO), null = nå
  kategorier: new Set(les('gran-kategorier', KATEGORIER.map(k => k.id))),
  tekst: '',
  sortering: les('gran-sortering', 'avstand'),
  valgt: null,
  hentet: null,
};

// ---------- Kart ----------

const kvAttr = '© <a href="https://www.kartverket.no/">Kartverket</a>';
const kart = L.map('kart', { zoomControl: true }).setView([RAADHUS.lat, RAADHUS.lon], 11);
const grunnkart = {
  Topografisk: L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topo/default/webmercator/{z}/{y}/{x}.png', { maxZoom: 19, maxNativeZoom: 18, attribution: kvAttr }),
  Gråtone: L.tileLayer('https://cache.kartverket.no/v1/wmts/1.0.0/topograatone/default/webmercator/{z}/{y}/{x}.png', { maxZoom: 19, maxNativeZoom: 18, attribution: kvAttr }),
  Flyfoto: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri, Maxar, Earthstar Geographics' }),
};
grunnkart[les('gran-grunnkart', 'Gråtone')]?.addTo(kart) || grunnkart.Gråtone.addTo(kart);
kart.on('baselayerchange', e => lagre('gran-grunnkart', e.name));

const ringer = L.layerGroup();
for (const km of [5, 10, 20, 30]) {
  L.circle([RAADHUS.lat, RAADHUS.lon], { radius: km * 1000, color: '#1f4e5f', weight: 1, opacity: .45, dashArray: '4 6', fill: false, interactive: false }).addTo(ringer);
  const nord = L.latLng(RAADHUS.lat + km / 111.2, RAADHUS.lon);
  L.marker(nord, { interactive: false, icon: L.divIcon({ className: 'ring-etikett', html: `${km} km`, iconSize: [40, 14], iconAnchor: [20, 16] }) }).addTo(ringer);
}
ringer.addTo(kart);
const markorLag = L.layerGroup().addTo(kart);
L.control.layers(grunnkart, { 'Avstandsringer fra rådhuset': ringer, 'Steder': markorLag }, { position: 'topright' }).addTo(kart);
L.control.scale({ imperial: false }).addTo(kart);

const markorer = new Map(); // stedsid → L.marker

// ---------- Hjelpere for steder ----------

const allesteder = () => [...tilstand.steder, ...tilstand.egne];
const posisjon = s => (s.posisjon?.lat ? s.posisjon : null);
const luftlinje = s => (posisjon(s) ? avstandKm(RAADHUS, posisjon(s)) : null);
const vaerFor = s => vaerVed(tilstand.vaer.get(s.id), tilstand.tid || Date.now());
const farge = s => (s.egen ? '#0e7490' : KAT[s.kategori]?.farge || '#64748b');

function synlig(s) {
  if (!posisjon(s)) return false;
  if (!s.egen && !tilstand.kategorier.has(s.kategori)) return false;
  if (tilstand.tekst) {
    const t = tilstand.tekst.toLocaleLowerCase('nb');
    const hay = [s.tittel, s.adresse, s.poststed, ...(s.virksomheter || []).map(v => v.navn)].join(' ').toLocaleLowerCase('nb');
    if (!hay.includes(t)) return false;
  }
  return true;
}

function sorter(liste) {
  const k = {
    avstand: s => luftlinje(s) ?? 1e9,
    navn: s => s.tittel,
    temp: s => -(vaerFor(s)?.temp ?? -1e9),
    kategori: s => KATEGORIER.findIndex(x => x.id === s.kategori) * 1000 + (luftlinje(s) ?? 0),
  }[tilstand.sortering];
  return liste.sort((a, b) => {
    if (a.erRaadhus !== b.erRaadhus) return a.erRaadhus ? -1 : 1;
    const x = k(a), y = k(b);
    return typeof x === 'string' ? x.localeCompare(y, 'nb') : x - y;
  });
}

// ---------- Markører ----------

function markorHtml(s) {
  const v = vaerFor(s);
  const ikon = v?.symbol ? `<img src="${IKON}/${v.symbol}.svg" alt="">` : '<span class="uv"></span>';
  const kl = ['pille', s.erRaadhus && 'raadhus', s.egen && 'egen-pille', tilstand.valgt === s.id && 'valgt'].filter(Boolean).join(' ');
  return `<div class="${kl}" style="--k:${farge(s)}" title="${esc(s.tittel)}">${ikon}${grader(v?.temp)}</div>`;
}

function tegnMarkorer() {
  const ider = new Set();
  for (const s of allesteder()) {
    if (!synlig(s)) continue;
    ider.add(s.id);
    const ikon = L.divIcon({ className: 'markor', html: markorHtml(s), iconSize: [0, 0] });
    let m = markorer.get(s.id);
    if (!m) {
      m = L.marker([s.posisjon.lat, s.posisjon.lon], { icon: ikon, riseOnHover: true, zIndexOffset: s.erRaadhus ? 1000 : 0, keyboard: true, title: s.tittel });
      m.bindPopup(() => popupHtml(s), { maxWidth: 360, autoPanPadding: [30, 30] });
      m.on('popupopen', () => velg(s.id, { fraKart: true }));
      m.on('popupclose', () => { if (tilstand.valgt === s.id) velg(null); });
      markorer.set(s.id, m);
    } else {
      m.setLatLng([s.posisjon.lat, s.posisjon.lon]);
      m.setIcon(ikon);
      if (m.isPopupOpen()) m.setPopupContent(popupHtml(s));
    }
    m._sted = s;
    if (!markorLag.hasLayer(m)) markorLag.addLayer(m);
  }
  for (const [id, m] of markorer) {
    if (!ider.has(id)) { markorLag.removeLayer(m); if (!allesteder().some(s => s.id === id)) markorer.delete(id); }
  }
}

function popupHtml(s) {
  const p = posisjon(s);
  const v = vaerFor(s);
  const serie = tilstand.vaer.get(s.id) || [];
  const fra = +new Date(tilstand.tid || Date.now()) - 30 * 60e3;
  const timer = serie.filter(x => +new Date(x.tid) >= fra).filter((_, i) => i % 2 === 0).slice(0, 9);
  const km = luftlinje(s);
  const kj = tilstand.kjoring.get(s.id);
  const virks = (s.virksomheter || []).map(x => `<li>${esc(x.navn)}${x.orgnr ? ` <small><a href="https://virksomhet.brreg.no/nb/oppslag/underenheter/${x.orgnr}" target="_blank" rel="noopener">${x.orgnr}</a>${x.ansatte ? ` · ${x.ansatte} ansatte` : ''}${x.kommunal ? '' : ' · ikke kommunal'}</small>` : ''}</li>`).join('');
  const yr = `https://www.yr.no/nb/v%C3%A6rvarsel/daglig-tabell/${p.lat.toFixed(4)},${p.lon.toFixed(4)}`;
  const vei = `https://www.google.com/maps/dir/?api=1&origin=${RAADHUS.lat},${RAADHUS.lon}&destination=${p.lat},${p.lon}`;
  return `<div class="popup">
    <h2>${esc(s.tittel)}</h2>
    <p class="adr">${esc([s.adresse, [s.postnummer, s.poststed].filter(Boolean).join(' ')].filter(Boolean).join(', '))}
      · <span style="color:${farge(s)}">${esc(s.egen ? 'Egen adresse' : KAT[s.kategori]?.navn)}</span>
      ${s.posisjon.presisjon === 'omtrentlig' || s.posisjon.presisjon === 'stedsnavn' ? `<br><small>Omtrentlig plassering (${esc(s.posisjon.treff)})</small>` : ''}</p>
    ${v ? `<div class="rad">
      ${v.symbol ? `<img src="${IKON}/${v.symbol}.svg" alt="">` : ''}
      <div><div class="stor temp ${v.temp >= 0 ? 'pluss' : 'minus'}">${tall(v.temp)}°</div>
      <div>${esc(symbolTekst(v.symbol))}</div>
      <small class="liten">${tidTekst(v.tid)}</small></div>
    </div>
    <dl>
      <dt>Vind</dt><dd>${tall(v.vind)} m/s fra ${vindretningTekst(v.vindretning)}</dd>
      ${v.nedbor != null ? `<dt>Nedbør</dt><dd>${tall(v.nedbor)} mm neste ${v.nedborTimer === 1 ? 'time' : `${v.nedborTimer} timer`}</dd>` : ''}
      <dt>Luftfukt</dt><dd>${Math.round(v.fukt)} %</dd>
    </dl>
    <div class="timer">${timer.map(x => `<div>${new Date(x.tid).toLocaleTimeString('nb-NO', { hour: '2-digit' })}${x.symbol ? `<img src="${IKON}/${x.symbol}.svg" alt="${esc(symbolTekst(x.symbol))}">` : ''}<b class="temp ${x.temp >= 0 ? 'pluss' : 'minus'}">${grader(x.temp)}</b></div>`).join('')}</div>`
    : '<p class="liten">Henter vær …</p>'}
    <dl>
      <dt>Fra rådhuset</dt><dd>${s.erRaadhus ? 'Dette er rådhuset' : `${tall(km)} km i luftlinje mot ${retning(RAADHUS, p)}`}</dd>
      ${!s.erRaadhus ? `<dt>Kjøring</dt><dd>${kj ? `${tall(kj.km)} km · ca. ${Math.round(kj.min)} min` : 'beregnes …'}</dd>` : ''}
    </dl>
    ${virks ? `<strong>${s.virksomheter.length === 1 ? 'Virksomhet' : `${s.virksomheter.length} virksomheter`} på adressen</strong><ul>${virks}</ul>` : ''}
    <div class="lenker">
      <a href="${yr}" target="_blank" rel="noopener">Varsel på Yr</a>
      ${!s.erRaadhus ? `<a href="${vei}" target="_blank" rel="noopener">Veibeskrivelse fra rådhuset</a>` : ''}
      ${s.egen ? `<button class="lenkeknapp" type="button" data-fjern="${esc(s.id)}">Fjern</button>` : ''}
    </div>
  </div>`;
}

function tidTekst(iso) {
  const d = new Date(iso);
  const idag = new Date().toDateString() === d.toDateString();
  const dag = idag ? 'i dag' : d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'short' });
  return `Varsel for ${dag} kl. ${d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}`;
}

// ---------- Liste og sammendrag ----------

function tegnListe() {
  const liste = sorter(allesteder().filter(synlig));
  $('#steder').innerHTML = liste.map(s => {
    const v = vaerFor(s);
    const km = luftlinje(s);
    const kj = tilstand.kjoring.get(s.id);
    const ekstra = (s.virksomheter?.length || 0) > 1 ? `<span class="merkelapp">${s.virksomheter.length} virksomheter</span>` : '';
    const egen = s.egen ? '<span class="merkelapp">egen</span>' : '';
    return `<li class="sted${tilstand.valgt === s.id ? ' valgt' : ''}" tabindex="0" data-id="${esc(s.id)}" style="--k:${farge(s)}">
      <span class="strek"></span>
      <div><h3>${esc(s.tittel)}${ekstra}${egen}</h3><div class="adr">${esc([s.adresse, s.poststed].filter(Boolean).join(', '))}</div></div>
      <div class="vaer">${v?.symbol ? `<img src="${IKON}/${v.symbol}.svg" alt="${esc(symbolTekst(v.symbol))}" loading="lazy">` : ''}<span class="temp ${v ? (v.temp >= 0 ? 'pluss' : 'minus') : ''}">${grader(v?.temp)}</span></div>
      <div class="avst">${s.erRaadhus ? 'Utgangspunkt for avstander' : `${tall(km)} km luftlinje${kj ? ` · ${tall(kj.km)} km / ${Math.round(kj.min)} min med bil` : ''}`}</div>
    </li>`;
  }).join('') || '<li class="liten" style="padding:12px 0">Ingen steder passer filteret.</li>';

  const alle = allesteder().filter(posisjon);
  $('#kategorier').innerHTML = KATEGORIER.map(k => {
    const n = tilstand.steder.filter(s => s.kategori === k.id && posisjon(s)).length;
    return n ? `<button class="brikke" type="button" data-kat="${k.id}" aria-pressed="${tilstand.kategorier.has(k.id)}" style="--k:${k.farge}"><i></i>${k.navn} <small>${n}</small></button>` : '';
  }).join('');

  const medVaer = alle.filter(s => tilstand.kategorier.has(s.kategori) || s.egen).map(s => ({ s, v: vaerFor(s) })).filter(x => x.v);
  const varm = medVaer.reduce((a, b) => (!a || b.v.temp > a.v.temp ? b : a), null);
  const kald = medVaer.reduce((a, b) => (!a || b.v.temp < a.v.temp ? b : a), null);
  const lengst = alle.reduce((a, b) => (!a || luftlinje(b) > luftlinje(a) ? b : a), null);
  const antVirks = tilstand.steder.reduce((n, s) => n + s.virksomheter.length, 0);
  $('#sammendrag').innerHTML = `
    <div class="tall"><b>${tilstand.steder.length}</b><span>adresser · ${antVirks} virksomheter</span></div>
    <div class="tall"><b>${kald && varm ? `${grader(kald.v.temp)} – ${grader(varm.v.temp)}` : '–'}</b><span title="${kald ? `Kaldest: ${esc(kald.s.tittel)}` : ''}">${kald ? `kaldest ${esc(kald.s.tittel)}` : 'temperatur'}</span></div>
    <div class="tall"><b>${lengst ? `${tall(luftlinje(lengst), 0)} km` : '–'}</b><span title="${esc(lengst?.tittel)}">${lengst ? `lengst unna: ${esc(lengst.tittel)}` : 'lengst unna'}</span></div>`;
}

function tegn() {
  tegnMarkorer();
  tegnListe();
}

function velg(id, { fraKart = false } = {}) {
  if (tilstand.valgt === id) return;
  tilstand.valgt = id;
  tegnListe();
  tegnMarkorer();
  if (id && fraKart) $(`.sted[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function aapne(id) {
  const m = markorer.get(id);
  if (!m) return;
  kart.flyTo(m.getLatLng(), Math.max(kart.getZoom(), 14), { duration: .6 });
  kart.once('moveend', () => m.openPopup());
  if (window.matchMedia('(max-width: 860px)').matches) $('#kart').scrollIntoView({ behavior: 'smooth' });
}

// ---------- Status ----------

let statusTimer;
function status(tekst, { feil = false, varighet = 0 } = {}) {
  const el = $('#status');
  el.textContent = tekst;
  el.classList.toggle('feil', feil);
  clearTimeout(statusTimer);
  if (varighet) statusTimer = setTimeout(() => { el.textContent = ''; }, varighet);
}

// ---------- Henting ----------

let tegnSnart;
const planleggTegning = () => { cancelAnimationFrame(tegnSnart); tegnSnart = requestAnimationFrame(tegn); };

const underveis = new Set();
async function hentVaerFor(steder, { tving = false } = {}) {
  const mangler = steder.filter(s => posisjon(s) && !underveis.has(s.id) && (tving || !tilstand.vaer.has(s.id)));
  mangler.forEach(s => underveis.add(s.id));
  let ferdig = 0, feil = 0;
  // Steder som ligger nær hverandre deler varsel (MET har 1 km rutenett).
  const cache = new Map();
  await iParallell(mangler, 4, async s => {
    const nokkel = `${s.posisjon.lat.toFixed(3)},${s.posisjon.lon.toFixed(3)}`;
    try {
      if (!cache.has(nokkel)) cache.set(nokkel, hentVaer(s.posisjon.lat, s.posisjon.lon));
      tilstand.vaer.set(s.id, await cache.get(nokkel));
    } catch { feil++; }
    underveis.delete(s.id);
    ferdig++;
    if (mangler.length > 3) status(`Henter vær fra MET … ${ferdig} av ${mangler.length}`);
    planleggTegning();
  });
  if (feil) status(`Fikk ikke vær for ${feil} steder. Prøv «Oppdater».`, { feil: true, varighet: 8000 });
  else if (mangler.length > 3) status('Været er oppdatert', { varighet: 2500 });
}

async function hentKjoring() {
  const steder = allesteder().filter(s => posisjon(s) && !s.erRaadhus && !tilstand.kjoring.has(s.id));
  if (!steder.length) return;
  try {
    const svar = await hentKjoreavstander(RAADHUS, steder.map(posisjon));
    steder.forEach((s, i) => { if (svar[i]) tilstand.kjoring.set(s.id, svar[i]); });
    planleggTegning();
  } catch (e) {
    console.warn('Kjøreavstand ikke tilgjengelig:', e);
  }
}

// Leser registrene på nytt. Posisjoner fra øyeblikksbildet gjenbrukes for adresser som ikke er endret.
async function hentFraRegistrene() {
  status('Henter virksomheter fra Enhetsregisteret …');
  const kjente = new Map(tilstand.steder.map(s => [s.id, s.posisjon]));
  const steder = grupperSteder(await hentVirksomheter());
  const nye = steder.filter(s => !kjente.get(s.id)?.lat);
  for (const s of steder) if (kjente.get(s.id)?.lat) s.posisjon = kjente.get(s.id);
  if (nye.length) status(`Slår opp ${nye.length} adresser i adresseregisteret …`);
  await iParallell(nye, 4, async s => { s.posisjon = await geokod(s); });
  tilstand.steder = steder;
  tilstand.hentet = new Date().toISOString();
  visHentet();
  tegn();
}

function visHentet() {
  if (!tilstand.hentet) return;
  const d = new Date(tilstand.hentet);
  $('#hentet').textContent = `Virksomhetene ble sist hentet fra registrene ${d.toLocaleDateString('nb-NO')} kl. ${d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}.`;
}

async function last({ tving = false } = {}) {
  const knapp = $('#oppdater');
  knapp.disabled = true;
  try {
    if (!tilstand.steder.length) {
      try {
        const d = await fetch('data/steder.json', { cache: 'no-cache' }).then(r => (r.ok ? r.json() : Promise.reject(r.status)));
        tilstand.steder = d.steder;
        tilstand.hentet = d.hentet;
        visHentet();
        tegn();
        zoomTilAlle();
      } catch { /* ingen øyeblikksbilde – hentes direkte under */ }
    }
    const vaer = hentVaerFor(allesteder(), { tving });
    const registre = hentFraRegistrene().then(() => {
      if (!markorLag.getLayers().length) return;
      zoomTilAlle({ bareFoersteGang: true });
    }).catch(e => {
      console.warn(e);
      if (!tilstand.steder.length) status('Fikk ikke kontakt med Enhetsregisteret. Prøv igjen senere.', { feil: true });
      else status('Viser lagret oversikt – registrene svarte ikke.', { feil: true, varighet: 6000 });
    });
    await registre;
    await Promise.all([vaer, hentVaerFor(allesteder()), hentKjoring()]);
  } finally {
    knapp.disabled = false;
  }
}

let zoomet = false;
function zoomTilAlle({ bareFoersteGang = false } = {}) {
  if (bareFoersteGang && zoomet) return;
  const punkter = tilstand.steder.filter(posisjon).map(s => [s.posisjon.lat, s.posisjon.lon]);
  if (!punkter.length) return;
  zoomet = true;
  // Holder kartet på Gran: steder langt unna (f.eks. i Lunner) skal ikke dra utsnittet ut.
  const naer = punkter.filter(p => avstandKm(RAADHUS, { lat: p[0], lon: p[1] }) < 35);
  kart.fitBounds(L.latLngBounds(naer.length ? naer : punkter), { padding: [30, 30], maxZoom: 13 });
}

// ---------- Tidspunkt ----------

function lagTidspunkter() {
  const n = new Date();
  const kl = (dager, time) => { const d = new Date(n); d.setDate(d.getDate() + dager); d.setHours(time, 0, 0, 0); return d; };
  const om = t => new Date(+n + t * 3600e3);
  const valg = [['', 'Nå'], [om(3), 'Om 3 timer'], [om(6), 'Om 6 timer']];
  if (n.getHours() < 18) valg.push([kl(0, 20), 'I kveld kl. 20']);
  valg.push([kl(1, 8), 'I morgen kl. 08'], [kl(1, 14), 'I morgen kl. 14'], [kl(2, 14), `${kl(2, 14).toLocaleDateString('nb-NO', { weekday: 'long' })} kl. 14`]);
  $('#tidspunkt').innerHTML = valg.map(([d, t]) => `<option value="${d ? d.toISOString() : ''}">${t}</option>`).join('');
}

// ---------- Egne adresser ----------

let sokTimer;
async function visForslag(tekst) {
  const ul = $('#forslag');
  if (tekst.trim().length < 3) { ul.hidden = true; return; }
  try {
    const treff = await sokAdresse(tekst);
    ul.innerHTML = treff.map((t, i) => `<li data-i="${i}">${esc(t.adresse)}, ${esc(t.postnummer)} ${esc(t.poststed)}</li>`).join('') || '<li class="liten">Ingen treff i Gran</li>';
    ul._treff = treff;
    ul.hidden = false;
  } catch {
    ul.innerHTML = '<li class="liten">Adressesøket svarer ikke</li>';
    ul.hidden = false;
  }
}

function leggTilEgen(t) {
  const id = `egen:${t.adresse}|${t.postnummer}`;
  if (!tilstand.egne.some(s => s.id === id)) {
    tilstand.egne.push({ id, egen: true, tittel: t.adresse, adresse: t.adresse, postnummer: t.postnummer, poststed: t.poststed, kategori: 'egen', posisjon: { lat: t.lat, lon: t.lon, presisjon: 'adresse' } });
    lagre('gran-egne', tilstand.egne);
  }
  $('#forslag').hidden = true;
  $('#sokefelt').value = '';
  tegn();
  hentVaerFor(tilstand.egne);
  hentKjoring();
  aapne(id);
}

// ---------- CSV ----------

function eksporter() {
  const kol = ['Navn', 'Kategori', 'Adresse', 'Postnummer', 'Poststed', 'Breddegrad', 'Lengdegrad', 'Luftlinje fra rådhuset (km)', 'Kjøreavstand (km)', 'Kjøretid (min)', 'Temperatur (°C)', 'Vær', 'Vind (m/s)', 'Nedbør (mm)', 'Varseltidspunkt', 'Virksomheter'];
  const rader = sorter(allesteder().filter(synlig)).map(s => {
    const v = vaerFor(s), kj = tilstand.kjoring.get(s.id), p = posisjon(s);
    return [s.tittel, s.egen ? 'Egen adresse' : KAT[s.kategori]?.navn, s.adresse, s.postnummer, s.poststed,
      p.lat.toFixed(6), p.lon.toFixed(6), tall(luftlinje(s), 2), kj ? tall(kj.km, 1) : '', kj ? Math.round(kj.min) : '',
      v ? tall(v.temp, 1) : '', v ? symbolTekst(v.symbol) : '', v ? tall(v.vind, 1) : '', v?.nedbor != null ? tall(v.nedbor, 1) : '',
      v ? new Date(v.tid).toLocaleString('nb-NO') : '', (s.virksomheter || []).map(x => `${x.navn} (${x.orgnr})`).join('; ')];
  });
  const csv = [kol, ...rader].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `gran-kommune-steder-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- Hendelser ----------

lagTidspunkter();
$('#sortering').value = tilstand.sortering;

$('#tidspunkt').addEventListener('change', e => { tilstand.tid = e.target.value || null; tegn(); });
$('#sortering').addEventListener('change', e => { tilstand.sortering = e.target.value; lagre('gran-sortering', tilstand.sortering); tegnListe(); });
$('#filtertekst').addEventListener('input', e => { tilstand.tekst = e.target.value.trim(); tegn(); });
$('#oppdater').addEventListener('click', () => { tilstand.kjoring.clear(); lagTidspunkter(); tilstand.tid = null; last({ tving: true }); });
$('#eksport').addEventListener('click', eksporter);

$('#kategorier').addEventListener('click', e => {
  const b = e.target.closest('[data-kat]');
  if (!b) return;
  const k = b.dataset.kat;
  // Alt-klikk (eller dobbeltklikk) viser bare denne kategorien.
  if (e.altKey || e.detail === 2) tilstand.kategorier = new Set([k]);
  else if (tilstand.kategorier.has(k)) tilstand.kategorier.delete(k);
  else tilstand.kategorier.add(k);
  if (!tilstand.kategorier.size) tilstand.kategorier = new Set(KATEGORIER.map(x => x.id));
  lagre('gran-kategorier', [...tilstand.kategorier]);
  tegn();
});

$('#steder').addEventListener('click', e => { const li = e.target.closest('[data-id]'); if (li) aapne(li.dataset.id); });
$('#steder').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { const li = e.target.closest('[data-id]'); if (li) { e.preventDefault(); aapne(li.dataset.id); } } });

$('#sokefelt').addEventListener('input', e => { clearTimeout(sokTimer); sokTimer = setTimeout(() => visForslag(e.target.value), 250); });
$('#sok').addEventListener('submit', async e => {
  e.preventDefault();
  await visForslag($('#sokefelt').value);
  const t = $('#forslag')._treff;
  if (t?.length === 1) leggTilEgen(t[0]);
});
$('#forslag').addEventListener('click', e => {
  const li = e.target.closest('[data-i]');
  if (li) leggTilEgen($('#forslag')._treff[+li.dataset.i]);
});
kart.getContainer().addEventListener('click', e => {
  const b = e.target.closest('[data-fjern]');
  if (!b) return;
  tilstand.egne = tilstand.egne.filter(s => s.id !== b.dataset.fjern);
  lagre('gran-egne', tilstand.egne);
  kart.closePopup();
  tegn();
});

// Været endrer seg: hent nytt varsel hver halvtime mens siden er åpen.
setInterval(() => { if (!document.hidden) hentVaerFor(allesteder(), { tving: true }); }, 30 * 60e3);

last();
