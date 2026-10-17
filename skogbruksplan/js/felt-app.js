// SkogIQ Felt – mobilversjon med kartet i fokus: bestandsinfo, GPS, registreringer med bilde, tiltak som utføres i
// felt og offline-kart. Bruker de samme planene (IndexedDB) som fullversjonen, og varsler den om endringer.
import { hent, lagre, listPlaner, hentPlan, lagrePlan } from './store.js';
import { TRESLAG, HK_ROMERTALL, HK_NAVN, TILTAKSTYPER, STANDARD_INNSTILLINGER, startTilstand, nyId } from './model.js';
import { punktIGeometri, etikettPunkt, bbox } from './proj.js';
import { hkFor } from './flere-eiendommer.js';
import { flisUrler, FLIS_CACHE } from './offline-kart.js';
import { VERSJON } from './versjon.js';
import { initSporlogg, lastPC } from './sporlogg-ui.js';
import { startFlateRedigering } from './flate-redigering.js';
import { initOppdragFelt } from './oppdrag-felt.js';
import { ledig as oppdragLedig } from './oppdrag.js';
import { synligeTiltaksflater, treffVed, tiltakStil, tiltakNavn, tiltakLinje, tiltakDetaljer } from './treff.js';
import { STATUSER, skjemaVerdier, endreTiltak, slettTiltak, slettTekst } from './tiltak-endring.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v, d = 0) => (v == null || Number.isNaN(v) ? '–' : Number(v).toLocaleString('nb-NO', { maximumFractionDigits: d, minimumFractionDigits: d }));
const IAAR = new Date().getFullYear();
const HK_FARGER = ['#fcfdfe', '#f8f6a9', '#d9f6c7', '#9bd47f', '#ef9a7c'];
const KATEGORIER = ['Observasjon', 'Skade (vind/snø/råte)', 'Barkbille', 'Viltskade', 'Miljøverdi', 'Grense/merke', 'Vei/grøft', 'Kontroll etter tiltak'];
const LS = { plan: 'skogiq-felt-plan', lag: 'skogiq-felt-lag', start: 'skogiq-start-felt', offline: 'skogiq-offline-' };
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* privat modus */ } } };
const kanal = 'BroadcastChannel' in window ? new BroadcastChannel('skogiq') : null;

let P = null; // planen som er åpen
let kart; let grunnlag = {}; let lagNavn = ls.get(LS.lag) || 'graa';
const lagPerBestand = new Map(); let bestandLag; let grenseLag; let regLag; let etikettLag;
let valgtId = null; let visning = 'kart';
let gps = { watch: null, pos: null, folg: false, markor: null, sirkel: null };
let installHendelse = null; let spor = null; let flate = null;
let oppdrag = null; let uthevOppdrag = new Set(); // bestand i oppdraget som er åpent
let tiltaksflateLag = null; let valgtTiltak = null; let treffMarkor = null; // tiltak som er valgt i kartet, og markør for trykkpunktet

// ---------- hjelpere ----------
let meldingTimer;
function melding(t, ms = 3200) { const m = $('#melding'); m.textContent = t; m.hidden = false; clearTimeout(meldingTimer); meldingTimer = setTimeout(() => { m.hidden = true; }, ms); }
const inn = () => ({ ...STANDARD_INNSTILLINGER, ...(P?.innstillinger || {}) });
const hk = (b) => hkFor(b, inn());
const finn = (id) => P?.bestand.find((b) => b.id === id);
const bestandVed = (lat, lon) => P?.bestand.find((b) => b.geometri && punktIGeometri([lon, lat], b.geometri)) || null;
const planBb = () => (P ? bbox([...(P.bestand || []).map((b) => b.geometri), P.eiendom?.grense].filter(Boolean)) : null);

async function lagrePlanen() {
  P.endret = new Date().toISOString();
  await lagrePlan(P);
  // Er dette planen som er åpen i fullversjonen, oppdateres også den.
  const h = await hent();
  if (!h || h.planId === P.planId) await lagre(P);
  kanal?.postMessage({ type: 'plan-endret', planId: P.planId, fra: 'felt' });
}

// ---------- kart ----------
function initKart() {
  kart = L.map('kart', { zoomControl: false, attributionControl: true }).setView([60.85, 11.2], 9);
  kart.attributionControl.setPrefix('');
  const kv = (lag) => L.tileLayer(`https://cache.kartverket.no/v1/wmts/1.0.0/${lag}/default/webmercator/{z}/{y}/{x}.png`, { maxZoom: 20, maxNativeZoom: 18, attribution: '© Kartverket' });
  grunnlag = {
    graa: kv('topograatone'), topo: kv('topo'),
    flyfoto: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20, maxNativeZoom: 19, attribution: 'Flyfoto © Esri, Maxar' }),
  };
  (grunnlag[lagNavn] || grunnlag.graa).addTo(kart);
  bestandLag = L.featureGroup().addTo(kart);
  regLag = L.featureGroup().addTo(kart);
  etikettLag = L.layerGroup().addTo(kart);
  const etiketter = () => document.body.classList.toggle('skjul-etiketter', kart.getZoom() < 14);
  kart.on('zoomend', etiketter); etiketter();
  kart.on('dragstart', () => { if (gps.folg) { gps.folg = false; oppdaterGpsKnapp(); } });
  // Trykk i kartet utenfor arket lukker det – men ikke midt i et skjema (registrering, endring, sporlogg).
  kart.on('click', (e) => { if (flate?.aktiv()) { flate.klikk(e.latlng); return; } if (!$('#ark').hidden && !regPagar && !endring && !spor?.harResultat() && !spor?.tegner()) lukkArk(); });
}

function stil(b) {
  const h = hk(b); const valgt = b.id === valgtId; const fly = lagNavn === 'flyfoto'; const ut = uthevOppdrag.has(b.id);
  return { color: valgt ? '#ffd400' : ut ? '#ff6a00' : fly ? '#f5f06a' : '#1b1c19', weight: valgt ? 4 : ut ? 3.5 : fly ? 1.6 : 1.1, opacity: 0.95, fillColor: h ? HK_FARGER[h - 1] : '#999', fillOpacity: fly ? 0.25 : h ? 0.8 : 0.1 };
}
function tegnPlan(zoom = false) {
  bestandLag.clearLayers(); etikettLag.clearLayers(); lagPerBestand.clear();
  if (grenseLag) { grenseLag.remove(); grenseLag = null; }
  if (!P) return;
  if (P.eiendom?.grense) grenseLag = L.geoJSON(P.eiendom.grense, { style: { color: '#d03b3b', weight: 2.5, dashArray: '8 5', fill: false }, interactive: false }).addTo(kart);
  for (const b of P.bestand) {
    if (!b.geometri) continue;
    const l = L.geoJSON(b.geometri, { style: () => stil(b) });
    l.on('click', (e) => { L.DomEvent.stopPropagation(e); if (flate?.aktiv()) { flate.klikk(e.latlng); return; } if (spor?.tegner()) { spor.leggTilPunkt(e.latlng); return; } if (regPagar) return; identifiser(e.latlng, b); });
    l.addTo(bestandLag); lagPerBestand.set(b.id, l);
    const pt = etikettPunkt(b.geometri);
    if (pt) L.tooltip({ permanent: true, direction: 'center', className: 'nr-etikett', interactive: false }).setLatLng([pt[1], pt[0]]).setContent(esc(b.nr)).addTo(etikettLag);
  }
  tegnRegistreringer();
  if (zoom) zoomPlan();
}
function oppdaterStiler() { for (const b of P?.bestand || []) lagPerBestand.get(b.id)?.setStyle(stil(b)); }
function zoomPlan() { const bb = planBb(); if (bb) kart.fitBounds([[bb[1], bb[0]], [bb[3], bb[2]]], { padding: [30, 30], paddingTopLeft: [20, 80] }); }
function tegnRegistreringer() {
  regLag.clearLayers();
  for (const r of P?.registreringer || []) {
    L.circleMarker([r.lat, r.lon], { radius: 8, color: '#fff', weight: 2.5, fillColor: '#e34948', fillOpacity: 1 })
      .on('click', (e) => { L.DomEvent.stopPropagation(e); if (flate?.aktiv()) { flate.klikk(e.latlng); return; } if (spor?.tegner()) { spor.leggTilPunkt(e.latlng); return; } visRegistrering(r.id); }).addTo(regLag);
  }
}

// ---------- ark ----------
// Et åpent ark har en oppføring i nettleserhistorikken, så tilbakeknappen (Android) og tilbakesveip lukker arket
// i stedet for å forlate appen.
let arkOppforing = false; let ignorerPop = false;
function aapneArk(html, { hoy = false } = {}) {
  $('#arkInnhold').innerHTML = html; $('#ark').hidden = false; $('#ark').classList.toggle('hoy', hoy);
  $('#ark').style.transform = '';
  $('#arkInnhold').scrollTop = 0; document.body.classList.add('ark-aapent');
  if (!arkOppforing) { try { history.pushState({ skogiqArk: true }, ''); arkOppforing = true; } catch { /* ingen historikk */ } }
}
function lukkArk(fraHistorikk = false) {
  if (fraHistorikk !== true && arkOppforing) {
    // Fjern historikkoppføringen når arket lukkes med krysset (med litt forsinkelse, i tilfelle et nytt ark åpnes rett etter).
    setTimeout(() => { if ($('#ark').hidden && arkOppforing) { arkOppforing = false; ignorerPop = true; history.back(); } }, 350);
  }
  $('#ark').hidden = true; $('#ark').style.transform = ''; document.body.classList.remove('ark-aapent');
  if (regPagar) avbrytReg();
  endring = null;
  if (valgtId) { valgtId = null; oppdaterStiler(); }
  if (valgtTiltak) { valgtTiltak = null; tegnTiltaksflater(); }
  if (uthevOppdrag.size) { uthevOppdrag = new Set(); oppdaterStiler(); }
  oppdrag?.nullstill();
  treffMarkor?.remove(); treffMarkor = null;
  settVisning('kart', false);
}
function settVisning(v, apne = true) {
  visning = v;
  document.querySelectorAll('.bunn [data-vis]').forEach((b) => b.classList.toggle('aktiv', b.dataset.vis === v));
  if (!apne) return;
  if (v === 'kart') lukkArk();
  else if (v === 'tiltak') visTiltak();
  else if (v === 'reg') visRegListe();
  else if (v === 'oppdrag') oppdrag.visListe();
  else if (v === 'mer') visMer();
}

// ---------- bestand ----------
const utfortNylig = (b) => (b.tiltak || []).filter((t) => t.status === 'utfort' && String(t.utfortDato || t.aar || '').slice(0, 4) >= String(IAAR - 1)).sort((x, y) => String(y.utfortDato).localeCompare(String(x.utfortDato)));
const nesteTiltak = (b) => (b.tiltak || []).filter((t) => t.status !== 'utfort').sort((x, y) => (x.aar || 0) - (y.aar || 0));
function tiltakRad(b, t, medBestand = false) {
  const ferdig = t.status === 'utfort';
  return `<div class="rad"><div class="rad-tekst" data-tiltakkort="${esc(b.id)}|${esc(t.id)}" role="button" tabindex="0"><div class="tittel">${t.dekning ? '<span class="flate-merke" aria-hidden="true"></span>' : ''}${esc(TILTAKSTYPER[t.type]?.navn || t.type)} ${t.aar ? `· ${t.aar}` : ''}</div><div class="under">${medBestand ? `Bestand ${esc(b.nr)} · ` : ''}${esc(t.kommentar || '')}${ferdig && t.utfortDato ? ` · utført ${esc(t.utfortDato)}` : ''}</div></div>
    <div class="rad-knapper"><button type="button" class="avkryss endre" data-endre="${esc(b.id)}|${esc(t.id)}" aria-label="Endre eller slett tiltaket">✎</button><button type="button" class="avkryss ${ferdig ? 'ferdig' : ''}" data-utfort="${esc(b.id)}|${esc(t.id)}" aria-label="${ferdig ? 'Angre utført' : 'Merk som utført'}">${ferdig ? '✓' : ''}</button></div></div>`;
}
function visBestand(id, { zoom = false } = {}) {
  const b = finn(id); if (!b) return;
  valgtId = id; oppdaterStiler();
  if (zoom) { const l = lagPerBestand.get(id); if (l) kart.fitBounds(l.getBounds(), { maxZoom: 16, padding: [40, 40], paddingBottomRight: [40, window.innerHeight * 0.45] }); }
  const s = startTilstand(b); const h = hk(b);
  const regs = (P.registreringer || []).filter((r) => r.bestandId === id);
  const tiltak = nesteTiltak(b);
  aapneArk(`<h2>Bestand ${esc(b.nr)}</h2>
    <div><span class="merke">${esc(TRESLAG[b.treslag] || 'Ukjent treslag')}</span>${b.bonitet ? `<span class="merke">Bonitet ${esc(b.bonitet)}</span>` : ''}${h ? `<span class="merke" title="${esc(HK_NAVN[h])}">HK ${HK_ROMERTALL[h]}</span>` : ''}${b.miljo ? '<span class="merke" style="background:#fae6ea;color:#c93a55">Miljøfigur</span>' : ''}</div>
    <div class="tall-rad">
      <div class="tall"><b>${fmt(b.areal, 1)}</b><span>daa</span></div>
      <div class="tall"><b>${fmt(s.alder)}</b><span>år</span></div>
      <div class="tall"><b>${fmt(s.volumDaa, 1)}</b><span>m³/daa</span></div>
      <div class="tall"><b>${fmt(s.volumDaa * (b.areal || 0))}</b><span>m³ totalt</span></div>
      <div class="tall"><b>${fmt(b.treantall)}</b><span>trær/daa</span></div>
      <div class="tall"><b>${fmt(b.hoyde, 1)}</b><span>m høyde</span></div>
    </div>
    ${b.vegetasjon?.kode ? `<p class="hint">Vegetasjonstype ${esc(b.vegetasjon.kode)} ${esc(b.vegetasjon.navn || '')}</p>` : ''}
    ${b.merknad ? `<p class="hint">${esc(b.merknad)}</p>` : ''}
    <h3>Planlagte tiltak</h3>
    <div class="liste">${tiltak.slice(0, 6).map((t) => tiltakRad(b, t)).join('') || '<div class="tom">Ingen planlagte tiltak.</div>'}</div>
    ${utfortNylig(b).length ? `<h3>Utført siste år</h3><div class="liste">${utfortNylig(b).map((t) => tiltakRad(b, t)).join('')}</div>` : ''}
    ${regs.length ? `<h3>Registreringer (${regs.length})</h3><div class="liste">${regs.map(regRad).join('')}</div>` : ''}
    <div class="knapper"><button type="button" class="knapp primar" data-h="reg-her">+ Registrering i bestandet</button></div>`);
}

// ---------- tiltak ----------
function visTiltak() {
  const alle = (P?.bestand || []).flatMap((b) => nesteTiltak(b).map((t) => ({ b, t })));
  const naa = alle.filter((x) => (x.t.aar || IAAR) <= IAAR + 1);
  const senere = alle.filter((x) => (x.t.aar || IAAR) > IAAR + 1).slice(0, 30);
  const nylig = (P?.bestand || []).flatMap((b) => (b.tiltak || []).filter((t) => t.status === 'utfort' && t.utfortDato && t.utfortDato.slice(0, 4) >= String(IAAR - 1)).map((t) => ({ b, t })));
  const liste = (l) => l.map(({ b, t }) => tiltakRad(b, t, true)).join('');
  aapneArk(`<h2>Tiltak</h2><p class="hint">Trykk på et tiltak for å se bestandet i kartet. Kryss av når det er gjort – det lagres med dagens dato.</p>
    <div class="knapper"><button type="button" class="knapp primar" data-h="sporlogg">Registrer utført tiltak med sporlogg</button></div>
    <h3>I år og neste år (${naa.length})</h3><div class="liste">${liste(naa) || '<div class="tom">Ingen tiltak de to neste årene.</div>'}</div>
    ${senere.length ? `<h3>Senere</h3><div class="liste">${liste(senere)}</div>` : ''}
    ${nylig.length ? `<h3>Nylig utført</h3><div class="liste">${liste(nylig)}</div>` : ''}`, { hoy: true });
}
async function settUtfort(bid, tid, tilbakeTil = null) {
  const b = finn(bid); const t = b?.tiltak?.find((x) => x.id === tid); if (!t) return;
  const ferdig = t.status !== 'utfort';
  t.status = ferdig ? 'utfort' : 'planlagt';
  t.utfortDato = ferdig ? new Date().toISOString().slice(0, 10) : undefined;
  if (ferdig && t.type === 'sluttavvirkning' && confirm(`Oppdatere bestand ${b.nr} til hogstklasse I (alder 0, volum 0)?`)) { b.hogstklasse = null; b.alder = 0; b.volumDaa = 0; b.treantall = null; b.hoyde = null; }
  if (ferdig && t.type === 'planting' && confirm(`Sette bestand ${b.nr} til hogstklasse II (ungskog) med alder 1?`)) { b.hogstklasse = 2; b.alder = 1; }
  await lagrePlanen(); oppdaterStiler(); tegnTiltaksflater();
  melding(ferdig ? `${TILTAKSTYPER[t.type]?.navn || 'Tiltak'} i ${b.nr} er merket utført.` : 'Merket som planlagt igjen.');
  if (typeof tilbakeTil === 'function') { await tilbakeTil(); return; }
  if (tilbakeTil === 'tiltakkort') visTiltakKort(bid, tid); else if (visning === 'tiltak') visTiltak(); else visBestand(bid);
}

// ---------- identifisering i kartet: tiltaksflater og bestand ----------
// Tiltak med egen flate (sporlogg/tegnet) vises i kartet: utførte grønne, planlagte blå og stiplet. Trykk i kartet
// åpner det som ligger der – ett treff direkte, flere treff som en kort liste («Her ligger»).
function tegnTiltaksflater() {
  if (!tiltaksflateLag) { kart.createPane('tiltakPane'); kart.getPane('tiltakPane').style.zIndex = 420; kart.getPane('tiltakPane').style.pointerEvents = 'none'; tiltaksflateLag = L.layerGroup().addTo(kart); }
  tiltaksflateLag.clearLayers();
  for (const { t } of synligeTiltaksflater(P, { iAar: IAAR })) {
    L.geoJSON(t.dekning, { pane: 'tiltakPane', style: tiltakStil(t, valgtTiltak?.tid === t.id), interactive: false }).addTo(tiltaksflateLag);
  }
}
function identifiser(ll, b) {
  const h = treffVed(P, ll.lat, ll.lng, { iAar: IAAR });
  const best = h.bestand || b;
  if (!h.tiltak.length) { visBestand(best.id); return; }
  treffMarkor?.remove();
  treffMarkor = L.circleMarker(ll, { radius: 7, color: '#fff', weight: 2.5, fillColor: '#c93a55', fillOpacity: 1, interactive: false }).addTo(kart);
  aapneArk(`<h2>Her ligger</h2><p class="hint">Velg hva du vil se.</p>
    <div class="liste">${h.tiltak.map(({ b: tb, t }) => `<button type="button" class="rad treff-rad" data-tiltakkort="${esc(tb.id)}|${esc(t.id)}"><div><div class="tittel"><span class="treff-ikon ${t.status === 'utfort' ? 'utfort' : 'planlagt'}" aria-hidden="true"></span>${esc(tiltakNavn(t))}</div><div class="under">${esc(tiltakLinje(tb, t))} · bestand ${esc(tb.nr)}</div></div><span>›</span></button>`).join('')}
    ${best ? `<button type="button" class="rad treff-rad" data-bestand-kort="${esc(best.id)}"><div><div class="tittel"><span class="treff-ikon bestand" aria-hidden="true"></span>Bestand ${esc(best.nr)}</div><div class="under">${esc(TRESLAG[best.treslag] || '')}${best.bonitet ? ` · bonitet ${esc(best.bonitet)}` : ''}${hk(best) ? ` · HK ${HK_ROMERTALL[hk(best)]}` : ''} · ${fmt(best.areal, 1)} daa</div></div><span>›</span></button>` : ''}</div>`);
}
function visTiltakKort(bid, tid, { zoom = false } = {}) {
  const b = finn(bid); const t = b?.tiltak?.find((x) => x.id === tid); if (!b || !t) return;
  valgtTiltak = { bid, tid }; valgtId = null; oppdaterStiler(); tegnTiltaksflater();
  if (zoom) zoomTilTiltak(bid, tid);
  const utfort = t.status === 'utfort';
  aapneArk(`<h2>${esc(tiltakNavn(t))}</h2>
    <div><span class="merke" style="${utfort ? '' : 'background:#e3ecf8;color:#1d4f91'}">${utfort ? 'Utført' : 'Planlagt'}</span>${t.dekning ? '<span class="merke">Flate i kartet</span>' : ''}${t.oppdragId && (P.oppdrag || []).some((o) => o.id === t.oppdragId) ? `<span class="merke lenke" data-oppdrag="${esc(t.oppdragId)}">Oppdrag ${esc((P.oppdrag || []).find((o) => o.id === t.oppdragId).nr)}</span>` : ''}</div>
    <dl class="kort-liste">${tiltakDetaljer(b, t).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    ${t.kommentar ? `<p>${esc(t.kommentar)}</p>` : ''}
    <div class="knapper"><button type="button" class="knapp" data-kort="utfort">${utfort ? 'Angre utført' : '✓ Merk utført'}</button><button type="button" class="knapp primar" data-kort="endre">✎ Endre</button></div>
    <div class="knapper"><button type="button" class="knapp" data-kort="flate">${t.dekning ? 'Endre flate' : 'Tegn flate'}</button><button type="button" class="knapp" data-kort="bestand">Bestand ${esc(b.nr)}</button>${t.dekning ? '<button type="button" class="knapp" data-kort="zoom">Vis i kart</button>' : ''}</div>
    ${oppdragLedig(t, P.oppdrag) ? '<div class="knapper"><button type="button" class="knapp" data-kort="oppdrag">+ Legg i oppdrag</button></div>' : ''}`);
}
function zoomTilTiltak(bid, tid) {
  const b = finn(bid); const t = b?.tiltak?.find((x) => x.id === tid); if (!b) return;
  const g = t?.dekning ? L.geoJSON(t.dekning) : lagPerBestand.get(bid); if (!g) return;
  kart.fitBounds(g.getBounds(), { maxZoom: 17, padding: [40, 40], paddingBottomRight: [40, window.innerHeight * 0.45] });
}

// ---------- endre og slette tiltak ----------
let endring = null; // { bid, tid, fra }
function visEndreTiltak(bid, tid, feil = []) {
  const b = finn(bid); const t = b?.tiltak?.find((x) => x.id === tid); if (!t) return;
  endring = endring?.tid === tid ? { ...endring, bid } : { bid, tid, fra: visning === 'tiltak' ? 'tiltak' : 'bestand' };
  const v = { ...skjemaVerdier(b, t), ...(endring.utkast || {}) };
  const utfort = v.status === 'utfort';
  aapneArk(`<h2>Endre tiltak</h2><p class="hint">Bestand ${esc(b.nr)} · ${fmt(b.areal, 1)} daa${t.kilde === 'motor' ? ' · laget av tiltaksmotoren – blir et manuelt tiltak når du endrer det' : ''}</p>
    ${feil.length ? `<div class="feilboks">${feil.map(esc).join('<br>')}</div>` : ''}
    <div class="skjema-felt">
      <label>Tiltak<select data-tf="type">${Object.entries(TILTAKSTYPER).map(([k, x]) => `<option value="${k}" ${k === v.type ? 'selected' : ''}>${esc(x.navn)}</option>`).join('')}</select></label>
      <div class="chips">${Object.entries(STATUSER).map(([k, n]) => `<button type="button" class="chip" data-tf-status="${k}" aria-pressed="${k === v.status}">${n}</button>`).join('')}</div>
      ${utfort ? `<label>Utført dato<input type="date" data-tf="utfortDato" value="${esc(v.utfortDato || new Date().toISOString().slice(0, 10))}" max="${new Date().toISOString().slice(0, 10)}"></label>` : `<label>År<input type="number" inputmode="numeric" data-tf="aar" value="${esc(v.aar)}" min="1950" max="2150"></label>`}
      <label class="bryter"><span>Hele bestandet</span><input type="checkbox" data-tf="helt" ${v.helt ? 'checked' : ''}></label>
      ${v.helt ? '' : `<label>Areal (daa)<input type="text" inputmode="decimal" data-tf="arealDaa" value="${esc(String(v.arealDaa ?? '').replace('.', ','))}"></label>`}
      <label>Kommentar<textarea data-tf="kommentar" rows="2">${esc(v.kommentar)}</textarea></label>
      <div class="flate-valg"><button type="button" class="knapp" data-h="endre-flate">✎ ${t.dekning ? 'Endre flate i kartet' : 'Tegn flate i kartet'}</button>${t.dekning ? `<span class="hint">Flate registrert: ${fmt(t.arealDaa ?? b.areal, 1)} daa</span>` : '<span class="hint">Ingen flate – tiltaket gjelder hele bestandet eller arealet over.</span>'}</div>
      ${t.dekning ? `<label class="bryter"><span>Fjern registrert flate</span><input type="checkbox" data-tf="fjernDekning" ${v.fjernDekning ? 'checked' : ''}></label>` : ''}
      ${t.oppdragId ? '<p class="hint">Tiltaket ligger i et oppdrag.</p>' : ''}
    </div>
    <div class="knapper"><button type="button" class="knapp fare" data-h="slett-tiltak">Slett</button><button type="button" class="knapp" data-h="avbryt-endring">Avbryt</button><button type="button" class="knapp primar" data-h="lagre-endring">Lagre</button></div>`);
}
// Endre flaten i kartet. Endringen lagres direkte på tiltaket, og skjemaet åpnes igjen etterpå.
async function endreFlate() {
  const b = finn(endring.bid); const t = b?.tiltak?.find((x) => x.id === endring.tid); if (!t) return;
  let PC; try { PC = await lastPC(); } catch (e) { melding(e.message, 6000); return; }
  const tilbake = { ...endring, utkast: lesEndring() };
  lukkArk(); document.body.classList.add('flate-aktiv');
  const ferdig = () => { flate = null; document.body.classList.remove('flate-aktiv'); endring = tilbake; };
  flate = startFlateRedigering({
    L, kart, PC, start: t.dekning || null, bestand: b, tittel: `${TILTAKSTYPER[t.type]?.navn || ''} i ${b.nr}`, plassering: 'felt',
    vedFerdig: async ({ geometri, daa, andel }) => {
      ferdig();
      if (geometri) { t.dekning = geometri; if (andel >= 0.995) { delete t.arealDaa; tilbake.utkast.helt = true; } else { t.arealDaa = daa; tilbake.utkast.helt = false; tilbake.utkast.arealDaa = daa; } } else { delete t.dekning; }
      tilbake.utkast.fjernDekning = false; t.endret = new Date().toISOString().slice(0, 10);
      await lagrePlanen(); spor?.tegnUtfort(); oppdaterStiler();
      melding(geometri ? `Flaten er endret: ${fmt(daa, 1)} daa.` : 'Flaten er fjernet.');
      if (tilbake.fra === 'tiltakkort') { endring = null; visTiltakKort(tilbake.bid, tilbake.tid); } else visEndreTiltak(tilbake.bid, tilbake.tid);
    },
    vedAvbryt: () => { ferdig(); if (tilbake.fra === 'tiltakkort') { endring = null; visTiltakKort(tilbake.bid, tilbake.tid); } else visEndreTiltak(tilbake.bid, tilbake.tid); },
  });
}
function lesEndring() {
  const u = { ...(endring.utkast || {}) };
  document.querySelectorAll('[data-tf]').forEach((el) => { u[el.dataset.tf] = el.type === 'checkbox' ? el.checked : el.value; });
  return u;
}
function tilbakeFraEndring() { const { bid, tid, fra } = endring; endring = null; if (fra === 'tiltak') visTiltak(); else if (fra === 'tiltakkort' && finn(bid)?.tiltak?.some((x) => x.id === tid)) visTiltakKort(bid, tid); else visBestand(bid); }
async function lagreEndring() {
  const b = finn(endring.bid); const t = b?.tiltak?.find((x) => x.id === endring.tid); if (!t) return;
  const u = lesEndring();
  const r = endreTiltak(b, t, u);
  if (!r.ok) { endring.utkast = u; visEndreTiltak(endring.bid, endring.tid, r.feil); return; }
  await lagrePlanen(); oppdaterStiler(); spor?.tegnUtfort();
  melding('Tiltaket er endret.'); tilbakeFraEndring();
}
async function slettEndring() {
  const b = finn(endring.bid); const t = b?.tiltak?.find((x) => x.id === endring.tid); if (!t) return;
  if (!confirm(slettTekst(b, t))) return;
  slettTiltak(P, b, t);
  await lagrePlanen(); oppdaterStiler(); spor?.tegnUtfort();
  melding('Tiltaket er slettet.'); tilbakeFraEndring();
}

// ---------- registreringer ----------
let regPagar = null; // { kategori, tekst, bilde, bestandId }
function regRad(r) {
  const b = r.bestandId ? finn(r.bestandId) : null;
  return `<button type="button" class="rad" data-reg="${esc(r.id)}"><div><div class="tittel">${esc(r.kategori)}${b ? ` · ${esc(b.nr)}` : ''}</div><div class="under">${esc((r.tekst || '').slice(0, 80))}${r.tekst?.length > 80 ? '…' : ''} · ${new Date(r.dato).toLocaleDateString('nb-NO')}</div></div>${r.bilde ? `<img src="${r.bilde}" alt="">` : '<span>📍</span>'}</button>`;
}
function visRegListe() {
  const l = P?.registreringer || [];
  aapneArk(`<h2>Registreringer</h2><p class="hint">${l.length} registrering${l.length === 1 ? '' : 'er'} i planen. De vises også i fullversjonen.</p>
    <div class="knapper"><button type="button" class="knapp primar" data-h="ny-reg">+ Ny registrering</button></div>
    <div class="liste">${l.map(regRad).join('') || '<div class="tom">Ingen registreringer ennå.</div>'}</div>`, { hoy: true });
}
function visRegistrering(id) {
  const r = (P.registreringer || []).find((x) => x.id === id); if (!r) return;
  kart.setView([r.lat, r.lon], Math.max(kart.getZoom(), 16));
  const b = r.bestandId ? finn(r.bestandId) : null;
  aapneArk(`<h2>${esc(r.kategori)}</h2><p class="hint">${new Date(r.dato).toLocaleString('nb-NO')}${b ? ` · bestand ${esc(b.nr)}` : ''}</p>
    <p>${esc(r.tekst || '')}</p>${r.bilde ? `<img src="${r.bilde}" alt="" style="width:100%;border-radius:12px;margin-top:6px">` : ''}
    <div class="knapper">${b ? `<button type="button" class="knapp" data-bestand-vis="${esc(b.id)}">Vis bestand</button>` : ''}<button type="button" class="knapp fare" data-slett-reg="${esc(r.id)}">Slett</button></div>`);
}
function regPosisjon() {
  const fersk = gps.pos && Date.now() - gps.pos.tid < 60000;
  if (fersk) return { lat: gps.pos.lat, lon: gps.pos.lon, noyaktighet: gps.pos.noyaktighet, kilde: 'gps' };
  const c = kart.getCenter(); return { lat: c.lat, lon: c.lng, kilde: 'kart' };
}
function tegnRegSkjema() {
  const r = regPagar; const pos = regPosisjon(); const b = bestandVed(pos.lat, pos.lon);
  $('#sikte').hidden = pos.kilde === 'gps';
  aapneArk(`<h2>Ny registrering</h2>
    <div class="pos">${pos.kilde === 'gps' ? `📍 GPS-posisjon (±${Math.round(pos.noyaktighet)} m)` : '✛ Flytt kartet slik at korset står på stedet'}${b ? ` · bestand <b>${esc(b.nr)}</b>` : ''}</div>
    <div class="chips">${KATEGORIER.map((k) => `<button type="button" class="chip" data-kat="${esc(k)}" aria-pressed="${r.kategori === k}">${esc(k)}</button>`).join('')}</div>
    <textarea id="regTekst" rows="3" placeholder="Beskrivelse">${esc(r.tekst || '')}</textarea>
    <label class="foto">${r.bilde ? `<img src="${r.bilde}" alt="">` : ''}<span class="knapp">📷 ${r.bilde ? 'Bytt bilde' : 'Ta bilde'}</span><input type="file" accept="image/*" capture="environment" id="regBilde"></label>
    <div class="knapper"><button type="button" class="knapp" data-h="avbryt-reg">Avbryt</button><button type="button" class="knapp primar" data-h="lagre-reg">Lagre</button></div>`);
}
function startReg(bestandId = null) {
  regPagar = { kategori: KATEGORIER[0], tekst: '', bilde: null, bestandId };
  if (bestandId && !(gps.pos && Date.now() - gps.pos.tid < 60000)) { const l = lagPerBestand.get(bestandId); if (l) kart.panTo(l.getBounds().getCenter()); }
  settVisning('reg', false); tegnRegSkjema();
}
function avbrytReg() { regPagar = null; $('#sikte').hidden = true; }
async function lagreReg() {
  if (!P) { melding('Velg en plan først.'); return; }
  const pos = regPosisjon(); const tekst = $('#regTekst')?.value.trim() || '';
  const b = bestandVed(pos.lat, pos.lon);
  P.registreringer = P.registreringer || [];
  P.registreringer.unshift({ id: nyId('r'), dato: new Date().toISOString(), kategori: regPagar.kategori, tekst, lat: pos.lat, lon: pos.lon, bestandId: b?.id || regPagar.bestandId || null, bilde: regPagar.bilde, noyaktighet: pos.noyaktighet ?? null, kilde: 'felt' });
  avbrytReg(); await lagrePlanen(); tegnRegistreringer();
  melding('Registrering lagret.'); visRegListe(); settVisning('reg', false);
}
function skalerBilde(fil, maks = 1280) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { const f = Math.min(1, maks / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * f); c.height = Math.round(img.height * f); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); res(c.toDataURL('image/jpeg', 0.8)); };
    img.onerror = rej; img.src = URL.createObjectURL(fil);
  });
}

// ---------- GPS ----------
function oppdaterGpsKnapp() {
  const k = $('#gpsBtn'); k.setAttribute('aria-pressed', String(gps.watch !== null)); k.classList.toggle('folg', gps.folg);
}
function gpsStripe() {
  const el = $('#gpsStripe');
  if (gps.watch === null || !gps.pos) { el.hidden = gps.watch === null; if (!el.hidden) el.innerHTML = '<span class="hint">Venter på GPS …</span>'; return; }
  const b = bestandVed(gps.pos.lat, gps.pos.lon);
  el.hidden = false;
  el.innerHTML = b ? `Du står i <b>bestand ${esc(b.nr)}</b> · ${esc(b.treslag || '')}${esc(b.bonitet || '')} · HK ${HK_ROMERTALL[hk(b)] || '?'} · ${fmt(startTilstand(b).alder)} år <span class="hint">±${Math.round(gps.pos.noyaktighet)} m</span>`
    : `<span class="hint">Utenfor bestandene · ±${Math.round(gps.pos.noyaktighet)} m</span>`;
  el.onclick = b ? () => visBestand(b.id) : null;
}
function veksleGps() {
  if (!navigator.geolocation) { melding('Enheten støtter ikke GPS i nettleseren.'); return; }
  if (gps.watch !== null && !gps.folg) { gps.folg = true; if (gps.pos) kart.setView([gps.pos.lat, gps.pos.lon], Math.max(kart.getZoom(), 16)); oppdaterGpsKnapp(); return; }
  if (gps.watch !== null) {
    navigator.geolocation.clearWatch(gps.watch); gps.watch = null; gps.folg = false; gps.pos = null;
    gps.markor?.remove(); gps.sirkel?.remove(); gps.markor = null; gps.sirkel = null; oppdaterGpsKnapp(); gpsStripe(); return;
  }
  gps.folg = true; oppdaterGpsKnapp(); gpsStripe();
  let forste = true;
  gps.watch = navigator.geolocation.watchPosition((p) => {
    gps.pos = { lat: p.coords.latitude, lon: p.coords.longitude, noyaktighet: p.coords.accuracy, tid: Date.now() };
    const ll = [gps.pos.lat, gps.pos.lon];
    if (!gps.markor) {
      gps.sirkel = L.circle(ll, { radius: p.coords.accuracy, color: '#2a78d6', weight: 1, fillOpacity: 0.1, interactive: false }).addTo(kart);
      gps.markor = L.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#2a78d6', fillOpacity: 1, interactive: false }).addTo(kart);
    } else { gps.markor.setLatLng(ll); gps.sirkel.setLatLng(ll).setRadius(p.coords.accuracy); }
    if (gps.folg) kart.setView(ll, forste ? Math.max(kart.getZoom(), 16) : kart.getZoom(), { animate: !forste });
    forste = false;
    gpsStripe();
    if (regPagar) tegnRegSkjemaPos();
  }, (err) => { if (err.code === 1) melding('Appen har ikke tilgang til posisjon. Tillat posisjon i nettleserens innstillinger.', 6000); else if (err.code === 2) melding('Finner ikke GPS-posisjon her.'); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 60000 });
}
function tegnRegSkjemaPos() {
  const pos = regPosisjon(); const b = bestandVed(pos.lat, pos.lon); const el = $('.pos'); if (!el) return;
  $('#sikte').hidden = pos.kilde === 'gps';
  el.innerHTML = `${pos.kilde === 'gps' ? `📍 GPS-posisjon (±${Math.round(pos.noyaktighet)} m)` : '✛ Flytt kartet slik at korset står på stedet'}${b ? ` · bestand <b>${esc(b.nr)}</b>` : ''}`;
}

// ---------- planer ----------
async function velgPlan(id, { zoom = true } = {}) {
  const plan = await hentPlan(id);
  if (!plan) { melding('Fant ikke planen.'); return; }
  P = plan; P.registreringer = P.registreringer || []; ls.set(LS.plan, id);
  for (const b of P.bestand) for (const t of b.tiltak || []) if (!t.id) t.id = nyId('t'); // eldre importerte tiltak uten id
  $('#planNavn').textContent = P.eiendom?.navn || 'Plan';
  document.title = `${P.eiendom?.navn || 'Plan'} · SkogIQ Felt`;
  valgtId = null; tegnPlan(zoom); gpsStripe(); spor?.tegnUtfort();
}
async function visPlaner() {
  const liste = await listPlaner();
  aapneArk(`<h2>Mine skogbruksplaner</h2><p class="hint">Planene lages og redigeres i fullversjonen. Her ser du dem i felt – også uten nett.</p>
    <div class="liste">${liste.map((p) => `<button type="button" class="rad ${p.id === P?.planId ? 'aktiv' : ''}" data-plan="${esc(p.id)}"><div><div class="tittel">${esc(p.navn)}</div><div class="under">${fmt(p.areal)} daa · ${p.antall} bestand${ls.get(LS.offline + p.id) ? ` · offline-kart ${esc(ls.get(LS.offline + p.id))}` : ''}</div></div><span>${p.id === P?.planId ? '✓' : '›'}</span></button>`).join('') || '<div class="tom">Ingen planer ennå. Lag en plan i fullversjonen.</div>'}</div>
    <div class="knapper"><a class="knapp" href="./?full">Åpne fullversjonen</a></div>`, { hoy: true });
}

// ---------- mer: offline, installasjon, innstillinger ----------
function visMer() {
  const offline = P ? ls.get(LS.offline + P.planId) : null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const installert = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  aapneArk(`<h2>Mer</h2>
    <h3>Offline</h3>
    <p>${navigator.onLine ? 'Du er på nett.' : '<b>Du er uten nett.</b> Planer, registreringer og tiltak lagres på telefonen.'} Appen og planene virker uten dekning. Kartet virker offline der du har lastet det ned.</p>
    <p class="hint">${P ? (offline ? `Topografisk kart for ${esc(P.eiendom?.navn)} ble lastet ned ${esc(offline)}.` : `Kartet for ${esc(P.eiendom?.navn)} er ikke lastet ned.`) : 'Velg en plan først.'} Flyfoto krever nett.</p>
    <div class="framdrift" id="offlineFramdrift" hidden><span></span></div><p class="hint" id="offlineStatus"></p>
    <div class="knapper"><button type="button" class="knapp primar" data-h="offline" ${P ? '' : 'disabled'}>${offline ? 'Oppdater offline-kart' : 'Last ned kart for offline'}</button></div>
    <h3>Installer</h3>
    ${installert ? '<p>✓ SkogIQ Felt er installert på enheten.</p>' : installHendelse ? '<div class="knapper"><button type="button" class="knapp primar" data-h="installer">Installer SkogIQ Felt</button></div><p class="hint">Appen legges på hjemskjermen og åpnes i fullskjerm.</p>' : ios ? '<p>Trykk på <b>Del</b> <span aria-hidden="true">⬆︎</span> i Safari og velg <b>Legg til på Hjem-skjerm</b>.</p>' : '<p class="hint">Bruk «Installer app» / «Legg til på startskjermen» i nettleserens meny.</p>'}
    <h3>Innstillinger</h3>
    <label class="bryter"><span>Start alltid i mobilversjonen</span><input type="checkbox" id="startFelt" ${ls.get(LS.start) === '1' ? 'checked' : ''}></label>
    <div class="knapper"><a class="knapp" href="./?full">Åpne fullversjonen</a></div>
    <p class="hint">SkogIQ Felt ${esc(VERSJON)} · samme data som fullversjonen, lagret lokalt på enheten.</p>`, { hoy: true });
}
async function lastNedOffline() {
  const bb = planBb(); if (!bb || !('caches' in window)) { melding('Kan ikke laste ned kart her.'); return; }
  if (!navigator.onLine) { melding('Du må være på nett for å laste ned kartet.'); return; }
  const urler = flisUrler(bb, { lag: ['topo', 'topograatone'] });
  const knapp = document.querySelector('[data-h="offline"]'); if (knapp) knapp.disabled = true;
  const fr = $('#offlineFramdrift'); const st = $('#offlineStatus'); if (fr) fr.hidden = false;
  const cache = await caches.open(FLIS_CACHE);
  const tot = urler.length; let ferdig = 0; let feil = 0;
  const arbeider = async () => {
    while (urler.length) {
      const u = urler.pop();
      try { if (!(await cache.match(u))) { const r = await fetch(u, { mode: 'cors' }); if (r.ok) await cache.put(u, r); else feil++; } } catch { feil++; }
      ferdig++;
      if (ferdig % 20 === 0 || ferdig === tot) { const f = $('#offlineFramdrift span'); if (f) f.style.width = `${(ferdig / tot) * 100}%`; const s = $('#offlineStatus'); if (s) s.textContent = `${ferdig} av ${tot} kartfliser …`; }
    }
  };
  if (st) st.textContent = `Laster ned ${tot} kartfliser …`;
  await Promise.all(Array.from({ length: 6 }, arbeider));
  const dato = new Date().toLocaleDateString('nb-NO');
  if (feil < tot * 0.2) ls.set(LS.offline + P.planId, dato);
  melding(feil >= tot * 0.2 ? `Kunne ikke laste ned hele kartet (${feil} av ${tot} fliser feilet). Prøv igjen med bedre dekning.` : feil ? `Kartet er lastet ned (${feil} fliser feilet).` : 'Kartet er lastet ned og virker offline.', 5000);
  if (knapp) knapp.disabled = false;
  if (visning === 'mer') visMer();
}

// ---------- nettstatus ----------
function nettStatus() {
  const el = $('#nett'); el.classList.toggle('av', !navigator.onLine);
  el.title = navigator.onLine ? 'På nett' : 'Uten nett – endringer lagres på telefonen';
}

// ---------- hendelser ----------
function kobleHendelser() {
  $('#planVelger').addEventListener('click', visPlaner);
  // Krysset reagerer på berøring direkte: på iPhone kan et trykk rett etter rulling ellers bli «spist» av rullingen.
  const lukkKnapp = $('#arkLukk');
  lukkKnapp.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); lukkArk(); }, { passive: false });
  lukkKnapp.addEventListener('click', (e) => { e.stopPropagation(); lukkArk(); });
  window.addEventListener('popstate', () => { if (ignorerPop) { ignorerPop = false; return; } arkOppforing = false; if (!$('#ark').hidden) lukkArk(true); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#ark').hidden) lukkArk(); });
  $('#melding').addEventListener('click', () => { $('#melding').hidden = true; });
  $('#gpsBtn').addEventListener('click', veksleGps);
  $('#zoomPlanBtn').addEventListener('click', zoomPlan);
  $('#nyRegBtn').addEventListener('click', () => startReg());
  $('#sporBtn').addEventListener('click', () => spor.visStart());
  $('#lagBtn').addEventListener('click', () => {
    const rekke = ['graa', 'topo', 'flyfoto']; const neste = rekke[(rekke.indexOf(lagNavn) + 1) % rekke.length];
    kart.removeLayer(grunnlag[lagNavn]); lagNavn = neste; grunnlag[lagNavn].addTo(kart); grunnlag[lagNavn].bringToBack(); ls.set(LS.lag, lagNavn);
    oppdaterStiler(); melding({ graa: 'Topografisk (gråtone)', topo: 'Topografisk', flyfoto: navigator.onLine ? 'Flyfoto' : 'Flyfoto krever nett' }[lagNavn], 1600);
  });
  document.querySelector('.bunn').addEventListener('click', (e) => { const b = e.target.closest('[data-vis]'); if (!b) return; if (regPagar) avbrytReg(); settVisning(b.dataset.vis); });
  kart.on('moveend', () => { if (regPagar) tegnRegSkjemaPos(); });
  const ark = $('#arkInnhold');
  ark.addEventListener('click', async (e) => {
    if (await oppdrag.klikk(e)) return;
    const plan = e.target.closest('[data-plan]'); if (plan) { await velgPlan(plan.dataset.plan); lukkArk(); return; }
    const en = e.target.closest('[data-endre]'); if (en) { e.stopPropagation(); const [bid, tid] = en.dataset.endre.split('|'); visEndreTiltak(bid, tid); return; }
    const ut = e.target.closest('[data-utfort]'); if (ut) { e.stopPropagation(); const [bid, tid] = ut.dataset.utfort.split('|'); settUtfort(bid, tid); return; }
    const bk = e.target.closest('[data-bestand-kort]'); if (bk) { visBestand(bk.dataset.bestandKort); return; }
    const tk = e.target.closest('[data-tiltakkort]'); if (tk) { const [bid, tid] = tk.dataset.tiltakkort.split('|'); visTiltakKort(bid, tid, { zoom: true }); return; }
    const kh = e.target.closest('[data-kort]')?.dataset.kort;
    if (kh && valgtTiltak) {
      const { bid, tid } = valgtTiltak;
      if (kh === 'endre') { visEndreTiltak(bid, tid); endring.fra = 'tiltakkort'; return; }
      if (kh === 'flate') { endring = { bid, tid, fra: 'tiltakkort' }; endreFlate(); return; }
      if (kh === 'utfort') { settUtfort(bid, tid, 'tiltakkort'); return; }
      if (kh === 'bestand') { visBestand(bid, { zoom: true }); return; }
      if (kh === 'zoom') { zoomTilTiltak(bid, tid); return; }
      if (kh === 'oppdrag') { oppdrag.visLeggIOppdrag(bid, tid); return; }
    }
    const best = e.target.closest('[data-bestand]'); if (best) { visBestand(best.dataset.bestand, { zoom: true }); return; }
    const bv = e.target.closest('[data-bestand-vis]'); if (bv) { visBestand(bv.dataset.bestandVis, { zoom: true }); return; }
    const reg = e.target.closest('[data-reg]'); if (reg) { visRegistrering(reg.dataset.reg); return; }
    const slett = e.target.closest('[data-slett-reg]'); if (slett) { if (!confirm('Slette registreringen?')) return; P.registreringer = P.registreringer.filter((r) => r.id !== slett.dataset.slettReg); await lagrePlanen(); tegnRegistreringer(); visRegListe(); return; }
    const st = e.target.closest('[data-tf-status]'); if (st && endring) { endring.utkast = { ...lesEndring(), status: st.dataset.tfStatus }; visEndreTiltak(endring.bid, endring.tid); return; }
    const kat = e.target.closest('[data-kat]'); if (kat && regPagar) { regPagar.kategori = kat.dataset.kat; regPagar.tekst = $('#regTekst').value; document.querySelectorAll('[data-kat]').forEach((c) => c.setAttribute('aria-pressed', String(c === kat))); return; }
    const h = e.target.closest('[data-h]')?.dataset.h; if (!h) return;
    if (h === 'reg-her') startReg(valgtId);
    if (h === 'ny-reg') startReg();
    if (h === 'avbryt-reg') { avbrytReg(); visRegListe(); }
    if (h === 'lagre-reg') lagreReg();
    if (h === 'offline') lastNedOffline();
    if (h === 'lagre-endring') lagreEndring();
    if (h === 'endre-flate') endreFlate();
    if (h === 'slett-tiltak') slettEndring();
    if (h === 'avbryt-endring') tilbakeFraEndring();
    if (h === 'sporlogg') spor.visStart();
    if (h === 'installer' && installHendelse) { installHendelse.prompt(); const v = await installHendelse.userChoice; installHendelse = null; if (v.outcome === 'accepted') melding('SkogIQ Felt er installert.'); visMer(); }
  });
  ark.addEventListener('change', async (e) => {
    if (await oppdrag.endring(e)) return;
    if (e.target.id === 'regBilde' && e.target.files[0] && regPagar) {
      regPagar.tekst = $('#regTekst').value;
      try { regPagar.bilde = await skalerBilde(e.target.files[0]); } catch { melding('Kunne ikke lese bildet.'); }
      tegnRegSkjema();
    }
    if (e.target.dataset?.tf === 'helt' && endring) { endring.utkast = lesEndring(); visEndreTiltak(endring.bid, endring.tid); return; }
    if (e.target.id === 'startFelt') { ls.set(LS.start, e.target.checked ? '1' : null); melding(e.target.checked ? 'Appen åpner nå i mobilversjonen.' : 'Appen åpner i fullversjonen.'); }
  });
  ark.addEventListener('input', (e) => { if (e.target.id === 'regTekst' && regPagar) regPagar.tekst = e.target.value; });
  // Sveip ned for å lukke: fra håndtaket/toppen, eller fra innholdet når det er rullet helt til toppen.
  const arkEl = $('#ark'); let dra = null;
  arkEl.addEventListener('touchstart', (e) => {
    if (e.target.closest('textarea, input, select, .ark-lukk')) { dra = null; return; }
    const topp = !!e.target.closest('#arkHandtak') || e.touches[0].clientY - arkEl.getBoundingClientRect().top < 56;
    dra = { y0: e.touches[0].clientY, dy: 0, mulig: topp || $('#arkInnhold').scrollTop <= 0, topp };
  }, { passive: true });
  arkEl.addEventListener('touchmove', (e) => {
    if (!dra?.mulig) return;
    dra.dy = e.touches[0].clientY - dra.y0;
    if (dra.dy > 8 && (dra.topp || $('#arkInnhold').scrollTop <= 0)) { arkEl.style.transition = 'none'; arkEl.style.transform = `translateY(${Math.max(0, dra.dy)}px)`; }
  }, { passive: true });
  arkEl.addEventListener('touchend', () => {
    if (!dra) return;
    arkEl.style.transition = '';
    if (dra.mulig && dra.dy > (dra.topp ? 50 : 90)) lukkArk(); else arkEl.style.transform = '';
    dra = null;
  });
  window.addEventListener('online', nettStatus); window.addEventListener('offline', nettStatus);
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installHendelse = e; if (visning === 'mer') visMer(); });
  // Fullversjonen i en annen fane endret planen: last den inn igjen (når ingen registrering pågår).
  kanal?.addEventListener('message', (m) => { if (m.data?.type === 'plan-endret' && m.data.fra !== 'felt' && m.data.planId === P?.planId && !regPagar) velgPlan(P.planId, { zoom: false }); });
}

async function start() {
  initKart();
  spor = initSporlogg({ L, kart, plan: () => P, lagrePlanen, aapneArk, lukkArk, melding, tegnPlan: () => tegnPlan(false), nyId, tegnFlater: () => tegnTiltaksflater(), settStatus: (paa) => document.body.classList.toggle('spor-aktiv', paa) });
  oppdrag = initOppdragFelt({
    plan: () => P, aapneArk, lagrePlanen, melding, nyId, iAar: IAAR, visTiltakKort,
    settUtfort: (bid, tid, tilbake) => settUtfort(bid, tid, tilbake),
    uthev: (ider) => { uthevOppdrag = new Set(ider); oppdaterStiler(); },
    zoomTil: (ider) => { const lag = ider.map((id) => lagPerBestand.get(id)).filter(Boolean); if (lag.length) kart.fitBounds(L.featureGroup(lag).getBounds(), { maxZoom: 16, padding: [40, 40], paddingBottomRight: [40, window.innerHeight * 0.5] }); },
  });
  kobleHendelser(); nettStatus();
  const liste = await listPlaner();
  const h = await hent().catch(() => null);
  const id = [ls.get(LS.plan), h?.planId, liste[0]?.id].find((x) => x && liste.some((p) => p.id === x));
  if (id) { await velgPlan(id); await spor.gjenoppta(); } else visPlaner();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
start();
