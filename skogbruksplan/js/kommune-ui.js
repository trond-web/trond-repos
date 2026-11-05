// Fanen «Kommune»: analyse av en hel kommune med kart, liste, kriterier og kobling til planlaging for eiendommen.
import { hentKommunedata, hentMis, klassifiser, oppsummer, eiendomIPunkt, STANDARD_KRITERIER } from './kommuneanalyse.js';
import { TRESLAG } from './model.js';
import { lagreVerdi, hentVerdi } from './store.js';
import { fmt } from './charts.js';
import { misMonster, misKartlag, misLegendStil, merkerVedZoom } from './miljokart.js';
import { arealM2, punktIGeometri } from './proj.js';
import * as NATUR from './naturdata.js';
import * as KULTUR from './kulturminner.js';
import { hentVeinett, avstanderTilVei, avstandTekst, LANG_TERRENGTRANSPORT, VEI_KILDE } from './kommune-vei.js';
import {
  analyserFlater, hentMarkVaer, hentMetNedbor, celleFor, risikoNaa, besteDag, prioriter, forholdOppsummert,
  SESONG, NAA, BAEREEVNE, DTW_KLASSER, KILDER as DRIFT_KILDER, vatAndel, naaNivaa,
} from './driftsforhold.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const desimal = (v, d = 1) => (v === null || v === undefined ? '–' : Number(v).toLocaleString('nb-NO', { maximumFractionDigits: d }));

const KATEGORIER = {
  hogst: { navn: 'Sluttavvirkning', farge: '#eb6834', tekst: 'Hogstmoden skog med nok volum til at sluttavvirkning er aktuelt.' },
  lukket: { navn: 'Lukket hogst', farge: '#2a78d6', tekst: 'Skog der bledning, gruppehogst eller skjerm-/frøtrestilling kan være et alternativ til flatehogst.' },
  ungskog: { navn: 'Ungskogpleie', farge: '#1baf7a', tekst: 'Ungskog som er tett eller lauvdominert og trolig trenger rydding.' },
};
const KRITERIE_FELT = [
  ['minAreal', 'Minste areal (daa)', 0.5], ['hogstMinVolum', 'Hogst: minste volum (m³/daa)', 1],
  ['lukketMaksBonitetGran', 'Lukket: høyeste bonitet gran', 1], ['lukketMaksHoydeforhold', 'Lukket: maks middelhøyde/overhøyde', 0.01], ['lukketMaksAndelGran', 'Lukket: blandingsskog under % gran', 5],
  ['lukketMinAlderAndel', 'Lukket: minste andel av hogstalder', 0.05], ['lukketMaksBonitetFuru', 'Lukket: høyeste bonitet furu', 1],
  ['ungMinHoyde', 'Ungskog: laveste høyde (m)', 0.5], ['ungMaksHoyde', 'Ungskog: høyeste høyde (m)', 0.5],
  ['ungMinAndelLauv', 'Ungskog: minste andel lauv (%)', 5], ['ungMinTreantall', 'Ungskog: tett fra (trær/daa)', 10], ['ungMinBonitet', 'Ungskog: laveste bonitet', 1],
  ['maksAvstandVei', 'Maks avstand til bilvei (m, 0 = alle)', 50],
];

const idagIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' });
const ukedag = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'numeric' });

// PNG → piksler (RGBA) via canvas. NIBIO tillater CORS, så lerretet blir ikke «tainted».
async function dekodPng(url) {
  const r = await fetch(url); if (!r.ok) throw new Error(`NIBIO svarte ${r.status}`);
  const bmp = await createImageBitmap(await r.blob());
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0);
  return { w: bmp.width, h: bmp.height, data: x.getImageData(0, 0, bmp.width, bmp.height).data };
}

export function initKommune({ kart, melding, innstillinger, lastKommuner, finnKommune, lagPlanFor }) {
  let data = null; let resultat = null; let kategori = 'hogst';
  let sorterDrift = true; let valgtDag = idagIso(); let driftArbeider = ''; let antallDrift = 150; let visDtw = false; let dtwLag = null; let bareDrivbar = false;
  let kriterier = { ...STANDARD_KRITERIER };
  let utenNatur = false; let utenKultur = false; let naturStatus = ''; let naturHenter = false;
  let sortering = 'poeng'; let veiStatus = ''; let veiHenter = false; let eiendomGen = 0;
  // Eiendomsgrenser med gårds- og bruksnummer (Kartverket matrikkel, vises fra ca. 1:40 000).
  const eiendomLag = L.tileLayer.wms('https://wms.geonorge.no/skwms1/wms.matrikkel', { layers: 'eiendomsgrense,eiendoms_id', format: 'image/png', transparent: true, opacity: 0.85, minZoom: 13, maxZoom: 20, attribution: 'Eiendomsgrenser © Kartverket' });
  const renderer = L.canvas({ padding: 0.3 });
  // Egen rute og SVG-renderer for nøkkelbiotopene (skravur krever SVG), over hogstflatene.
  kart.createPane('komMisPane'); kart.getPane('komMisPane').style.zIndex = 450; kart.getPane('komMisPane').style.pointerEvents = 'none';
  const misRenderer = L.svg({ pane: 'komMisPane' });
  let misMerker = null; let stoppMisMerker = null;
  if (!document.getElementById('mis-skravur')) document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${misMonster('mis')}</defs></svg>`);
  const arealDaa = (g) => arealM2(g) / 1000;
  const lag = L.layerGroup();
  const vernLag = L.layerGroup();
  let aktiv = false;
  let flateLag = new Map();

  const panel = $('#fane-kommune');
  $('#komKriterier').innerHTML = KRITERIE_FELT.map(([k, navn, steg]) => `<label>${navn}<input type="number" step="${steg}" data-k="${k}" id="krit-${k}" value="${kriterier[k]}"></label>`).join('');

  function tegnLegend() {
    if (!aktiv || !resultat) return;
    const k = KATEGORIER[kategori];
    const drift = kategori === 'hogst' && harDrift();
    $('#kartLegend').innerHTML = `<div class="legend-innhold"><b>${drift ? `Kjøreskaderisiko ${ukedag(valgtDag)}` : k.navn}</b>${drift ? `${NAA.map((n) => `<div><i style="background:${n.farge}"></i>${n.navn}</div>`).join('')}<div><i style="background:${k.farge};opacity:.45"></i>Ikke analysert</div>` : `<div><i style="background:${k.farge}"></i>Forslag (${fmt(resultat[kategori].length)} flater)</div>`}<div><i style="${misLegendStil}"></i>Nøkkelbiotop (MiS)</div><div><i style="background:transparent;border:2px dashed #d03b3b"></i>Verneområde</div><div><i style="background:transparent;border:2px solid #1b1c19"></i>Kommunegrense</div>${data?.natur ? `<div><i style="background:${NATUR.FARGE.nin}33;border:1.5px solid ${NATUR.FARGE.nin}"></i>Naturtype (NiN)</div><div><i style="background:${NATUR.FARGE.art}22;border:1.5px dashed ${NATUR.FARGE.art}"></i>Art – funksjonsområde</div>` : ''}${data?.kultur ? `<div><i style="background:${KULTUR.FARGE}44;border:1.5px solid ${KULTUR.FARGE}"></i>Kulturminne (sikringssone)</div>` : ''}${$('#komEiendom')?.checked ? `<div><i style="background:transparent;border:1.5px solid #e8432f"></i>Eiendomsgrense, gnr/bnr ${kart.getZoom() < 13 ? '(zoom inn)' : ''}</div>` : ''}${visDtw ? `<b style="display:block;margin-top:6px">Markfuktighet (DTW)</b>${DTW_KLASSER.map((d) => `<div><i style="background:rgb(${d.rgb.join(',')})"></i>${d.id === 'vann' ? 'Vann' : `Grunnvann ${d.navn}`}</div>`).join('')}` : ''}</div>`;
  }

  // ---------- driftsforhold ----------
  const harDrift = () => !!(data?.drift && Object.keys(data.drift).length);
  function dagerFor(f) { return data?.markVaer?.celler?.[celleFor(f.senter[0], f.senter[1])] || null; }
  function oppdaterDrift(liste) {
    if (!harDrift()) return;
    for (const f of liste) {
      const d = data.drift[f.id]; if (!d) { delete f.drift; continue; }
      const dager = dagerFor(f); const dag = dager?.find((x) => x.dato === valgtDag) || null;
      f.drift = { ...d, naa: risikoNaa(d.statisk, dag), dag, beste: dager ? besteDag(d.statisk, dager, idagIso()) : null };
    }
  }
  function filtrert() {
    if (!resultat) return [];
    const ts = $('#komTreslag').value;
    let liste = resultat[kategori].filter((f) => !ts || f.treslag === ts);
    const maksVei = Number(kriterier.maksAvstandVei) || 0;
    if (maksVei > 0 && data.vei) liste = liste.filter((f) => f.veiAvstand != null && f.veiAvstand <= maksVei);
    if (utenNatur && data.natur) liste = liste.filter((f) => !data.naturFlater?.[f.id]);
    if (utenKultur && data.kultur) liste = liste.filter((f) => !data.kulturFlater?.[f.id]);
    if (sortering === 'areal') liste = liste.slice().sort((a, b) => b.areal - a.areal);
    else if (sortering === 'vei') liste = liste.slice().sort((a, b) => (a.veiAvstand ?? 1e9) - (b.veiAvstand ?? 1e9) || b.areal - a.areal);
    else if (sortering === 'rotnetto') liste = liste.slice().sort((a, b) => (b.rotnetto || 0) - (a.rotnetto || 0));
    if (kategori === 'hogst' && harDrift()) {
      oppdaterDrift(liste);
      if (bareDrivbar) liste = liste.filter((f) => f.drift?.naa && f.drift.naa.risiko < 50);
      if (sorterDrift && sortering === 'poeng') { const med = prioriter(liste.filter((f) => f.drift)); liste = [...med, ...liste.filter((f) => !f.drift)]; }
    }
    return liste;
  }

  function popupHtml(f) {
    const k = KATEGORIER[kategori];
    return `<div class="kom-popup"><b>${k.navn}</b>${f.metode ? ` – ${esc(f.metode)}` : ''}<br>
      ${desimal(f.areal)} daa · ${TRESLAG[f.treslag] || ''} (${esc(f.dominerende || '')}) · bonitet ${f.bonitet ?? '–'}<br>
      Alder ${f.alder !== null ? Math.round(f.alder) : '–'} år · ${desimal(f.volumDaa)} m³/daa · høyde ${desimal(f.hoyde)} m · ${f.treantall ? Math.round(f.treantall) : '–'} trær/daa<br>
      ${f.rotnetto ? `Rotnetto ca. ${fmt(f.rotnetto)} kr<br>` : ''}${veiLinje(f)}${naturLinjer(f)}<span class="hint">${esc(f.grunn)}${f.maaleaar ? ` · SR16 målt ${f.maaleaar}` : ''}</span><br>
      ${kategori === 'hogst' && f.drift ? driftPopup(f) : ''}
      <div class="kom-eiendom" data-eiendom-for="${esc(f.id)}">${eiendomHtml(f)}</div></div>`;
  }
  // NiN-naturtyper og arter som overlapper flaten (naturdata.js).
  function naturLinjer(f) {
    return naturLinjerNin(f) + kulturLinjer(f);
  }
  function kulturLinjer(f) {
    if (!data?.kultur) return '';
    const t = data.kulturFlater?.[f.id]; if (!t?.length) return '<span class="hint">🏛 Ingen fredede kulturminner registrert</span><br>';
    return `<div class="kom-natur">${t.slice(0, 4).map((k) => `🏛 ${k.lenke ? `<a href="${esc(k.lenke)}" target="_blank" rel="noopener">${esc(k.navn)}</a>` : esc(k.navn)}`).join('<br>')}${t.length > 4 ? `<br><span class="hint">+ ${t.length - 4} til</span>` : ''}<br><span class="hint">Fredet kulturminne med sikringssone – ikke kjør over, og merk av før drift (PEFC krav 30).</span></div>`;
  }
  function naturLinjerNin(f) {
    if (!data?.natur) return naturHenter ? '<span class="hint">🌿 Naturtyper og arter sjekkes …</span><br>' : '';
    const t = data.naturFlater?.[f.id]; if (!t?.length) return '<span class="hint">🌿 Ingen registrerte NiN-naturtyper eller arter</span><br>';
    return `<div class="kom-natur">${t.slice(0, 4).map((o) => `${o.type === 'nin' ? '🌿' : '🦉'} ${o.lenke ? `<a href="${esc(o.lenke)}" target="_blank" rel="noopener">${esc(NATUR.tekst(o))}</a>` : esc(NATUR.tekst(o))}`).join('<br>')}${t.length > 4 ? `<br><span class="hint">+ ${t.length - 4} til</span>` : ''}<br><span class="hint">Vurderes av skogbiologisk kompetanse før hogst (PEFC krav 22).</span></div>`;
  }
  async function beregnNatur({ tving = false } = {}) {
    if (!data || naturHenter || (data.natur && !tving)) return;
    naturHenter = true; const d = data; naturStatus = 'Henter NiN-naturtyper og arter fra Miljødirektoratet …'; visNaturStatus();
    try {
      const pts = []; const gaa = (k) => (typeof k[0] === 'number' ? pts.push(k) : k.forEach(gaa)); gaa(d.kommune.geometri.coordinates);
      const bb = [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
      const n = await NATUR.hentForBoks(bb, { framdrift: (p) => { naturStatus = p.tekst; visNaturStatus(); } });
      naturStatus = 'Sjekker hvilke flater som berører naturtyper og arter …'; visNaturStatus(); await new Promise((ok) => setTimeout(ok, 30));
      const merket = NATUR.merkFlater(d.flater, n);
      d.naturFlater = Object.fromEntries(merket); d.naturGeo = n;
      d.natur = { hentet: new Date().toISOString(), nin: n.nin.length, art: n.art.length, flater: merket.size };
      // Fredede kulturminner (sikringssoner, Riksantikvaren) for kommunen.
      naturStatus = 'Henter kulturminner fra Riksantikvaren …'; visNaturStatus();
      try {
        const km = await KULTUR.hentForBoks(bb); const mk = KULTUR.merkFlater(d.flater, km);
        d.kulturFlater = Object.fromEntries(mk); d.kulturGeo = km; d.kultur = { hentet: new Date().toISOString(), antall: km.length, flater: mk.size };
      } catch (e) { d.kultur = null; naturStatus = ''; melding(`Kulturminner kunne ikke hentes: ${e.message}`, 5000); }
      if (data === d) { naturStatus = ''; lagre(); oppdater(); }
    } catch (e) { naturStatus = `Klarte ikke å hente naturtyper og arter: ${e.message}`; } finally { naturHenter = false; visNaturStatus(); }
  }
  function visNaturStatus() {
    const el = $('#komNatur'); if (!el) return;
    const n = data?.natur;
    el.innerHTML = naturStatus ? `🌿 ${esc(naturStatus)}${/Klarte/.test(naturStatus) ? ' <button type="button" class="knapp liten" data-kom-natur-ny>Prøv igjen</button>' : ''}`
      : n ? `🌿 ${fmt(n.nin)} NiN-naturtyper og 🦉 ${fmt(n.art)} artsområder (Miljødirektoratet, ${new Date(n.hentet).toLocaleDateString('nb-NO')}) – ${fmt(n.flater)} skogflater berører dem og er merket.${data.kultur ? ` 🏛 ${fmt(data.kultur.antall)} fredede kulturminner (Riksantikvaren) – ${fmt(data.kultur.flater)} skogflater berører dem.` : ''} <button type="button" class="knapp liten" data-kom-natur-ny>Oppdater</button>` : '';
  }
  function veiLinje(f) {
    if (f.veiAvstand === undefined) return data?.vei ? '' : `<span class="hint">🛣 Avstand til vei beregnes …</span><br>`;
    return `🛣 Avstand til bilvei: <b>${esc(avstandTekst(f.veiAvstand))}</b>${f.veiAvstand == null || f.veiAvstand > LANG_TERRENGTRANSPORT ? ' – lang terrengtransport' : ''}<br>`;
  }
  // Gårds- og bruksnummer for flaten (oppslag i matrikkelen i midten av flaten, lagres med analysen).
  const eiendomFor = (f) => data?.eiendom?.[f.id];
  const gnrTekst = (f) => { const e = eiendomFor(f); return e?.length ? e.map((x) => x.tekst).join(', ') : ''; };
  function eiendomHtml(f) {
    const e = eiendomFor(f);
    if (!e) return '<span class="hint">Slår opp gårds- og bruksnummer …</span>';
    if (!e.length) return '<span class="hint">Fant ingen eiendom i midten av flaten.</span>';
    return e.map((x) => `<div class="kom-eiendom-rad">Gnr/bnr <b>${esc(x.tekst)}</b>${data.kommune?.navn ? ` <span class="hint">${esc(data.kommune.navn)}</span>` : ''} <button type="button" class="knapp liten primar" data-lag-plan='${esc(JSON.stringify(x))}'>Lag skogbruksplan</button></div>`).join('');
  }
  const eiendomVenter = new Map();
  async function slaaOppEiendom(f) {
    if (eiendomFor(f)) return eiendomFor(f);
    if (eiendomVenter.has(f.id)) return eiendomVenter.get(f.id);
    const p = eiendomIPunkt(f.senter).then((e) => { data.eiendom = data.eiendom || {}; data.eiendom[f.id] = e; lagreSnart(); return e; }).finally(() => eiendomVenter.delete(f.id));
    eiendomVenter.set(f.id, p); return p;
  }
  async function visEiendomIPopup(f) {
    try { await slaaOppEiendom(f); } catch (err) { for (const b of document.querySelectorAll(`[data-eiendom-for="${CSS.escape(f.id)}"]`)) b.innerHTML = `<span class="hint">Oppslaget feilet: ${esc(err.message)}</span> <button type="button" class="knapp liten" data-finn-eiendom="${esc(f.id)}">Prøv igjen</button>`; return; }
    for (const b of document.querySelectorAll(`[data-eiendom-for="${CSS.escape(f.id)}"]`)) b.innerHTML = eiendomHtml(f);
    const r = document.querySelector(`#komListe [data-flate="${CSS.escape(f.id)}"] [data-gnr]`); if (r) r.textContent = gnrTekst(f) ? `Gnr/bnr ${gnrTekst(f)}` : '';
  }
  // Gnr/bnr for flatene i listen, fire om gangen. Avbrytes når listen tegnes på nytt.
  async function fyllEiendommer(liste) {
    const gen = ++eiendomGen; const mangler = liste.filter((f) => !eiendomFor(f));
    let i = 0;
    const arbeider = async () => {
      while (i < mangler.length && gen === eiendomGen && aktiv) {
        const f = mangler[i++];
        try { await slaaOppEiendom(f); } catch { /* prøves igjen ved klikk */ }
        const r = document.querySelector(`#komListe [data-flate="${CSS.escape(f.id)}"] [data-gnr]`); if (r) r.textContent = gnrTekst(f) ? `Gnr/bnr ${gnrTekst(f)}` : '';
      }
    };
    await Promise.all([arbeider(), arbeider(), arbeider(), arbeider()]);
  }
  let lagreTimer = null; const lagreSnart = () => { clearTimeout(lagreTimer); lagreTimer = setTimeout(() => lagre(), 2000); };
  // Avstand til bilvei for alle flatene (NVDB, hele kommunen). Gjøres én gang per analyse og lagres.
  async function beregnVei({ tving = false } = {}) {
    if (!data || veiHenter || (data.vei && !tving)) return;
    veiHenter = true; const d = data; veiStatus = 'Henter veinett fra NVDB …'; visVeiStatus();
    try {
      const nett = await hentVeinett(d.kommune.nr, { framdrift: (p) => { veiStatus = p.tekst; visVeiStatus(); } });
      veiStatus = 'Beregner avstand til vei for hver flate …'; visVeiStatus();
      await new Promise((ok) => setTimeout(ok, 30));
      const av = avstanderTilVei(d.flater, nett.linjer);
      for (const f of d.flater) f.veiAvstand = av.has(f.id) ? av.get(f.id) : null;
      d.vei = { hentet: nett.hentet, antall: nett.antall };
      if (data === d) { veiStatus = ''; lagre(); oppdater(); }
    } catch (e) { veiStatus = `Klarte ikke å hente veinettet: ${e.message}`; } finally { veiHenter = false; visVeiStatus(); }
  }
  function visVeiStatus() {
    const el = $('#komVei'); if (!el) return;
    el.innerHTML = veiStatus ? `🛣 ${esc(veiStatus)}${/Klarte/.test(veiStatus) ? ' <button type="button" class="knapp liten" data-kom-vei-ny>Prøv igjen</button>' : ''}`
      : data?.vei ? `🛣 Avstand til bilvei er beregnet for alle flatene fra ${fmt(data.vei.antall)} veistrekninger i <a href="${VEI_KILDE.url}" target="_blank" rel="noopener">NVDB</a> (${new Date(data.vei.hentet).toLocaleDateString('nb-NO')}). <button type="button" class="knapp liten" data-kom-vei-ny>Oppdater</button>` : '';
  }

  function driftPopup(f) {
    const d = f.drift; const s = d.statisk; const n = d.naa;
    const dtw = d.dtw ? DTW_KLASSER.filter((k) => d.dtw[k.id] > 0.005).map((k) => `${k.id === 'vann' ? 'vann' : k.navn} ${Math.round(d.dtw[k.id] * 100)} %`).join(', ') : 'ukjent';
    return `<div class="kom-drift-pop"><b>Driftsforhold</b>${n ? ` <span class="kom-risiko" style="--farge:${n.nivaa.farge}">${esc(n.nivaa.navn)} (${n.risiko})</span>` : ''}<br>
      <span class="hint">Grunnvann: ${esc(dtw)}<br>Løsmasse: ${esc(d.losmasse || 'ukjent')}${s.baereevne ? ` – bæreevne ${esc(BAEREEVNE[s.baereevne].navn.toLowerCase())}` : ''}<br>Helning: ${d.helning != null ? `${Math.round(d.helning)} %` : 'ukjent'}<br>
      Driftssesong: <b>${esc(SESONG[s.sesong].navn)}</b> – ${esc(SESONG[s.sesong].tekst.toLowerCase())}${s.bratt ? '. Bratt: kabel- eller beltegående maskin' : ''}<br>
      ${n?.forhold?.length ? `Forhold ${ukedag(valgtDag)}: ${esc(n.forhold.join(', '))}<br>` : ''}${n ? esc(n.nivaa.rad) : ''}${d.beste && d.beste.dato !== valgtDag ? `<br>Beste dag i prognosen: <b>${ukedag(d.beste.dato)}</b>` : ''}</span></div>`;
  }

  function tegnKart() {
    lag.clearLayers(); vernLag.clearLayers(); flateLag = new Map();
    if (!data || !resultat) return;
    L.geoJSON(data.kommune.geometri, { style: { color: '#1b1c19', weight: 2, fill: false }, interactive: false, renderer }).addTo(lag);
    const farge = KATEGORIER[kategori].farge;
    const drift = kategori === 'hogst' && harDrift();
    for (const f of filtrert()) {
      const fc = drift ? (f.drift?.naa?.nivaa.farge || farge) : farge;
      const l = L.geoJSON(f.geometri, { bubblingMouseEvents: false, style: { color: fc, weight: drift && f.drift ? 1.5 : 1, fillColor: fc, fillOpacity: drift && !f.drift ? 0.25 : 0.6 }, renderer });
      l.bindPopup(() => popupHtml(f), { maxWidth: 300 });
      l.on('popupopen', () => visEiendomIPopup(f));
      l.addTo(lag);
      flateLag.set(f.id, l);
    }
    for (const [type, liste] of Object.entries(data.naturGeo || {})) for (const o of liste) L.geoJSON(o.geometri, { style: { color: NATUR.FARGE[type], weight: 1.2, fillColor: NATUR.FARGE[type], fillOpacity: 0.12, dashArray: type === 'art' ? '3 3' : null }, interactive: false, renderer }).addTo(vernLag);
    for (const k of data.kulturGeo || []) L.geoJSON(k.geometri, { style: { color: KULTUR.FARGE, weight: 1.5, fillColor: KULTUR.FARGE, fillOpacity: 0.25 }, interactive: false, renderer }).addTo(vernLag);
    for (const v of data.vern) if (v.geometri) L.geoJSON(v.geometri, { style: { color: '#d03b3b', weight: 1.5, dashArray: '5 4', fill: false }, interactive: false, renderer }).addTo(vernLag);
    // Nøkkelbiotoper: felles MiS-stil med skravur (SVG) og «MiS»-merke når man zoomer inn.
    stoppMisMerker?.();
    const mis = misKartlag(L, data.mis.map((g, i) => ({ id: `mis${i}`, type: 'mis', navn: 'Nøkkelbiotop (MiS)', geometri: g, areal: arealDaa(g) })), { pane: 'komMisPane', renderer: misRenderer });
    mis.flater.addTo(vernLag); misMerker = mis.merker;
    if (aktiv) stoppMisMerker = merkerVedZoom(kart, misMerker, 13);
    tegnLegend();
  }

  function tegnListe() {
    if (!resultat) return;
    for (const [k, def] of Object.entries(KATEGORIER)) {
      const o = oppsummer(resultat[k]);
      const knapp = panel.querySelector(`[data-kategori="${k}"]`);
      knapp.classList.toggle('aktiv', k === kategori);
      knapp.setAttribute('aria-selected', k === kategori);
      knapp.querySelector('.tall').textContent = `${fmt(o.areal)} daa`;
      knapp.querySelector('.under').textContent = `${fmt(o.antall)} flater`;
      knapp.style.setProperty('--kat', def.farge);
    }
    const liste = filtrert();
    const o = oppsummer(liste);
    tegnDriftKort(liste);
    $('#komBeskrivelse').textContent = KATEGORIER[kategori].tekst;
    $('#komSum').innerHTML = `<div><b>${fmt(o.antall)}</b><span>flater</span></div><div><b>${fmt(o.areal)} daa</b><span>areal</span></div>
      <div><b>${fmt(o.volum)} m³</b><span>volum</span></div>${kategori === 'hogst' ? `<div><b>${desimal(o.rotnetto / 1e6, 1)} mill</b><span>kr rotnetto (est.)</span></div>` : ''}`;
    const vis = liste.slice(0, 150);
    $('#komListe').innerHTML = vis.length ? vis.map((f, i) => `<button type="button" class="kom-rad" data-flate="${esc(f.id)}">
      <span class="nr">${i + 1}</span>
      <span><b>${desimal(f.areal)} daa · ${TRESLAG[f.treslag] || ''} ${f.bonitet ?? ''}</b> · ${f.alder !== null ? Math.round(f.alder) : '–'} år · ${desimal(f.volumDaa)} m³/daa${f.rotnetto ? ` · ca. ${fmt(f.rotnetto / 1000)} k kr` : ''}${f.veiAvstand !== undefined ? ` · 🛣 ${esc(avstandTekst(f.veiAvstand))}` : ''}${data.naturFlater?.[f.id] ? ` · <span class="kom-natur-merke" title="${esc(data.naturFlater[f.id].map((o) => NATUR.tekst(o)).join('; '))}">${data.naturFlater[f.id].some((o) => o.type === 'nin') ? '🌿' : ''}${data.naturFlater[f.id].some((o) => o.type === 'art') ? '🦉' : ''} naturverdi</span>` : ''}${data.kulturFlater?.[f.id] ? ` · <span class="kom-kultur-merke" title="${esc(data.kulturFlater[f.id].map((k) => k.navn).join('; '))}">🏛 kulturminne</span>` : ''}<small class="kom-gnr" data-gnr>${gnrTekst(f) ? `Gnr/bnr ${esc(gnrTekst(f))}` : ''}</small>${f.metode ? ` · ${esc(f.metode)}` : ''}<br><span class="hint">${esc(f.grunn)}</span>${kategori === 'hogst' && f.drift ? `<br><span class="kom-risiko" style="--farge:${f.drift.naa?.nivaa.farge || '#999'}">${esc(f.drift.naa?.nivaa.navn || 'Ukjent')}${f.drift.naa ? ` · ${f.drift.naa.risiko}` : ''}</span> <span class="hint">${esc(SESONG[f.drift.statisk.sesong].navn)} · ${esc(f.drift.statisk.grunner.slice(0, 2).join(' · '))}${f.drift.beste && f.drift.beste.dato !== valgtDag && f.drift.naa?.risiko >= 30 ? ` · bedre ${ukedag(f.drift.beste.dato)}` : ''}</span>` : ''}</span>
    </button>`).join('') + (liste.length > vis.length ? `<p class="hint">Viser de ${vis.length} største av ${fmt(liste.length)}. Alle vises i kartet og i eksporten.</p>` : '')
      : '<div class="tom">Ingen flater oppfyller kriteriene.</div>';
    fyllEiendommer(vis);
  }

  function tegnDriftKort(liste) {
    const el = $('#komDrift');
    if (kategori !== 'hogst') { el.innerHTML = ''; return; }
    if (!harDrift()) {
      el.innerHTML = `<div class="kom-drift-kort"><b>Prioriter etter driftsforhold – minst mulig kjøreskader</b>
        <p class="hint">Analyserer markfuktighet (NIBIO DTW), bæreevne (NGU løsmasser) og helning (Kartverket) for hver hogstflate, og kobler det til teledyp, snø, vannmetning i jorda og nedbør (NVE seNorge, 9 dagers prognose). Listen sorteres så flatene som tåler kjøring nå kommer først, og hver flate får anbefalt driftssesong.</p>
        <div class="verktoyrad"><label>Analyser de <select id="komDriftAntall">${[50, 150, 300, 500].map((n) => `<option ${n === antallDrift ? 'selected' : ''}>${n}</option>`).join('')}</select> største</label>
        <button type="button" class="knapp primar" id="komDriftStart" ${driftArbeider ? 'disabled' : ''}>Analyser driftsforhold</button></div>
        <div class="hint" data-drift-status>${esc(driftArbeider)}</div></div>`;
      return;
    }
    const mv = data.markVaer; const dager = [...new Set(Object.values(mv?.celler || {}).flatMap((l) => l.map((d) => d.dato)))].sort().filter((d) => d >= idagIso()).slice(0, 9);
    const f0 = forholdOppsummert(mv, valgtDag);
    const tell = {}; for (const f of liste) if (f.drift?.naa) tell[f.drift.naa.nivaa.id] = (tell[f.drift.naa.nivaa.id] || 0) + 1;
    const sesong = {}; for (const f of liste) if (f.drift) sesong[f.drift.statisk.sesong] = (sesong[f.drift.statisk.sesong] || 0) + (f.areal || 0);
    const gammel = mv && Date.now() - new Date(mv.hentet).getTime() > 3 * 3600 * 1000;
    el.innerHTML = `<div class="kom-drift-kort">
      <div class="detalj-topp"><b>Driftsforhold ${ukedag(valgtDag)}</b><span class="hint">${Object.keys(data.drift).length} flater analysert</span></div>
      ${f0 ? `<div class="kom-forhold">${[['Tele', f0.teledyp, 'cm'], ['Snø', f0.snodybde, 'cm'], ['Vannmetning', f0.vannmetning, '%'], ['Nedbør 3 d', f0.nedbor3 != null ? Math.round(f0.nedbor3) : null, 'mm']].filter(([, v]) => v != null).map(([n, v, e]) => `<div><small>${n}</small><b>${v} ${e}</b></div>`).join('')}</div><p class="hint" style="margin:4px 0 8px">${esc(f0.faktor.tekst.join(', ') || 'Normale forhold')} – median for kommunen${mv.kilde === 'met' ? ' (bare nedbør fra MET – teledyp, snø og vannmetning krever SkogIQ-serveren)' : ' (NVE seNorge)'}.</p>` : '<p class="hint">Mark- og værdata mangler.</p>'}
      ${dager.length ? `<div class="kom-dager">${dager.map((d) => { const x = forholdOppsummert(mv, d); const n = naaNivaa(Math.round(40 * (x?.faktor.faktor || 1))); return `<button type="button" data-kom-dag="${d}" class="${d === valgtDag ? 'aktiv' : ''}" style="--farge:${n.farge}" title="${esc(x?.faktor.tekst.join(', ') || '')}"><span>${ukedag(d)}</span><i></i></button>`; }).join('')}</div><p class="hint" style="margin:2px 0 8px">Fargen viser forholdene for en middels sårbar flate. Velg en dag for å se risikoen per flate.</p>` : ''}
      <div class="kom-nivaa">${NAA.map((n) => `<span style="--farge:${n.farge}"><i></i>${n.navn}: <b>${tell[n.id] || 0}</b></span>`).join('')}</div>
      <div class="kom-nivaa">${Object.entries(SESONG).map(([k, x]) => `<span style="--farge:${x.farge}"><i></i>${x.navn}: <b>${fmt(sesong[k] || 0)} daa</b></span>`).join('')}</div>
      <div class="verktoyrad" style="margin-top:8px">
        <label class="avkrysning"><input type="checkbox" id="komDriftSorter" ${sorterDrift ? 'checked' : ''}> Prioriter etter driftsforhold</label>
        <label class="avkrysning"><input type="checkbox" id="komDriftBare" ${bareDrivbar ? 'checked' : ''}> Bare flater som kan drives</label>
        <label class="avkrysning"><input type="checkbox" id="komDtw" ${visDtw ? 'checked' : ''}> Vis markfuktighetskart</label>
      </div>
      <div class="verktoyrad"><button type="button" class="knapp liten" id="komDriftVaer" ${driftArbeider ? 'disabled' : ''}>${gammel ? 'Oppdater vær (utdatert)' : 'Oppdater vær'}</button><button type="button" class="knapp liten" id="komDriftNy" ${driftArbeider ? 'disabled' : ''}>Analyser på nytt</button><span class="hint" data-drift-status>${esc(driftArbeider)}</span></div>
      <details class="kom-drift-om"><summary>Slik beregnes kjøreskaderisikoen</summary><ul class="hint">
        <li><b>Markfuktighet (55 %)</b>: andel av flaten med grunnvann nær overflaten i NIBIOs markfuktighetskart (DTW fra laserdata). Våte partier vektes opp fordi basvegene krysser dem.</li>
        <li><b>Bæreevne (30 %)</b>: løsmasser fra NGU – morene og breelvmateriale god, elve- og vindavsetninger middels, leire/silt dårlig, torv og myr svært dårlig.</li>
        <li><b>Helning (15 %)</b>: fra Kartverkets høydemodell. Over 33 % øker faren for glidning og erosjon; over 50 % krever kabel eller beltegående maskin.</li>
        <li><b>Mark og vær</b>: risikoen justeres per dag – tele ≥ 20 cm eller snø på frossen mark gir god bæreevne; vannmettet jord og mye regn siste tre døgn øker faren.</li>
        <li><b>Prioritet</b>: 70 % driftbarhet på valgt dag og 30 % verdi (rotnetto).</li>
      </ul><p class="hint">Kilder: ${Object.values(DRIFT_KILDER).map((k) => `<a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.navn)}</a>`).join(' · ')}</p></details>
    </div>`;
  }

  async function analyserDrift() {
    const kandidater = resultat.hogst.slice().sort((a, b) => b.poeng - a.poeng).slice(0, antallDrift);
    driftArbeider = 'Starter …'; tegnListe();
    const fram = (p) => { driftArbeider = p.tekst; const h = $('#komDrift [data-drift-status]'); if (h) h.textContent = p.tekst; };
    try {
      const ut = await analyserFlater(kandidater, { dekodPng, framdrift: fram });
      data.drift = { ...(data.drift || {}) };
      for (const [id, d] of ut) data.drift[id] = d;
      data.driftHentet = new Date().toISOString();
      tegnListe(); tegnKart();
      await hentVaer(true);
      melding(`Driftsforhold analysert for ${ut.size} hogstflater.`);
    } catch (e) { melding(`Analysen av driftsforhold stoppet: ${e.message}`, 6000); } finally { driftArbeider = ''; lagre(); tegnListe(); tegnKart(); }
  }
  async function hentVaer(stille = false) {
    if (!harDrift()) return;
    const celler = [...new Set(resultat.hogst.filter((f) => data.drift[f.id]).map((f) => celleFor(f.senter[0], f.senter[1])))];
    driftArbeider = 'Henter mark og vær (NVE) …'; tegnDriftKort(filtrert());
    try { data.markVaer = await hentMarkVaer(celler, { framdrift: (p) => { driftArbeider = p.tekst; const h = $('#komDrift [data-drift-status]'); if (h) h.textContent = p.tekst; } }); } catch {
      try { data.markVaer = await hentMetNedbor(celler); if (!stille) melding('NVE var ikke tilgjengelig – bruker nedbør fra MET.'); } catch (e) { melding(`Kunne ikke hente værdata: ${e.message}`, 6000); }
    }
    valgtDag = idagIso(); driftArbeider = '';
    if (!stille) { lagre(); tegnListe(); tegnKart(); }
  }
  async function lagre() { try { await lagreVerdi(`kommune:${data.kommune.nr}`, data); } catch { /* valgfritt */ } }
  function settDtw(på) {
    visDtw = på;
    if (på && !dtwLag) dtwLag = L.tileLayer.wms('https://wms.nibio.no/cgi-bin/markfuktighetskart', { layers: 'markfuktighetsklasser', format: 'image/png', transparent: true, opacity: 0.7, attribution: 'Markfuktighet © NIBIO' });
    if (på && aktiv) dtwLag.addTo(kart); else dtwLag?.remove();
    tegnLegend();
  }

  function oppdater() {
    if (!data) return;
    resultat = klassifiser(data.flater, kriterier, innstillinger());
    tegnListe(); tegnKart();
  }

  // Analyser lagret før MiS-rettingen (v1.1.1) mangler nøkkelbiotopene – hent dem og merk flatene på nytt.
  async function oppdaterMis(d) {
    if (d.misV2) return false;
    try {
      d.mis = await hentMis(d.kommune.geometri);
      for (const f of d.flater) f.mis = d.mis.some((m) => punktIGeometri(f.senter, m));
      d.misV2 = true;
      try { await lagreVerdi(`kommune:${d.kommune.nr}`, d); } catch { /* valgfritt */ }
      return true;
    } catch { return false; }
  }

  function visResultat(d, fraLager) {
    data = d;
    if (!d.misV2) oppdaterMis(d).then((ok) => { if (ok && data === d) { visResultat(d, fraLager); melding(`${d.mis.length} nøkkelbiotoper (MiS) hentet for ${d.kommune.navn}.`); } });
    const aar = d.flater.map((f) => f.maaleaar).filter(Boolean).sort((a, b) => a - b);
    const median = aar.length ? aar[Math.floor(aar.length / 2)] : null;
    $('#komInfo').innerHTML = `<b>${esc(d.kommune.navn)}</b>: ${fmt(d.flater.length)} skogflater fra SR16${median ? `, hovedsakelig målt ${median}` : ''}. ${d.vern.length} verneområder og ${d.mis.length} nøkkelbiotoper er holdt utenfor hogstforslagene. ${fraLager ? `Lagret analyse fra ${new Date(d.hentet).toLocaleDateString('nb-NO')}.` : ''}
      ${median && median < new Date().getFullYear() - 5 ? '<br><span class="advarsel">Skog kan være hogd etter at SR16 ble målt. Kontroller mot flyfoto før du går videre.</span>' : ''}`;
    $('#komResultat').hidden = false;
    veiStatus = ''; visVeiStatus();
    oppdater();
    if (!d.vei) beregnVei();
    naturStatus = ''; visNaturStatus();
    if (!d.natur || d.kultur === undefined) beregnNatur({ tving: !!d.natur });
    if (aktiv) kart.fitBounds(L.geoJSON(d.kommune.geometri).getBounds(), { padding: [10, 10] });
  }

  async function analyser(e) {
    e?.preventDefault();
    const k = finnKommune($('#komKommune').value, await lastKommuner());
    if (!k) { melding('Fant ikke kommunen. Skriv navnet eller det firesifrede kommunenummeret.'); return; }
    const tvungen = e?.submitter?.id === 'komOppdater';
    if (!tvungen) {
      const lagret = await hentVerdi(`kommune:${k.nr}`);
      if (lagret) { visResultat(lagret, true); return; }
    }
    const knapp = $('#komBtn');
    knapp.disabled = true; knapp.textContent = 'Analyserer …';
    $('#komFramdrift').hidden = false;
    try {
      const d = await hentKommunedata(k, {
        framdrift: (p) => {
          $('#komFramdriftTekst').textContent = p.tekst;
          if (p.andel !== undefined) $('#komFramdriftBar').value = p.andel;
        },
      });
      try { await lagreVerdi(`kommune:${k.nr}`, d); } catch { /* lagring er valgfri */ }
      visResultat(d, false);
      melding(`Analysen av ${d.kommune.navn} er ferdig.`);
    } catch (err) {
      melding(`Analysen stoppet: ${err.message}`, 6000);
      $('#komFramdriftTekst').textContent = `Feil: ${err.message}. Prøv igjen.`;
    } finally {
      knapp.disabled = false; knapp.textContent = 'Analyser kommunen';
      setTimeout(() => { $('#komFramdrift').hidden = true; }, 1500);
    }
  }

  function eksporter(type) {
    const liste = filtrert();
    const navn = `${(data?.kommune.navn || 'kommune').toLowerCase()}-${kategori}-${new Date().toISOString().slice(0, 10)}`;
    const egenskaper = (f) => ({
      KATEGORI: KATEGORIER[kategori].navn, METODE: f.metode || null, AREAL_DAA: +f.areal.toFixed(1), TRESLAG: f.treslag, SKOGTYPE: f.dominerende,
      BONITET: f.bonitet, ALDER: f.alder !== null ? Math.round(f.alder) : null, VOLUM_DAA: f.volumDaa !== null ? +f.volumDaa.toFixed(1) : null,
      MIDDELHOYDE: f.hoyde !== null ? +f.hoyde.toFixed(1) : null, TREANTALL_DAA: f.treantall !== null ? Math.round(f.treantall) : null,
      ROTNETTO_KR: f.rotnetto ? Math.round(f.rotnetto) : null, AVSTAND_BILVEI_M: f.veiAvstand ?? null, NATURTYPER_NIN: (data.naturFlater?.[f.id] || []).filter((o) => o.type === 'nin').map((o) => NATUR.tekst(o)).join('; ') || null, ARTER: (data.naturFlater?.[f.id] || []).filter((o) => o.type === 'art').map((o) => NATUR.tekst(o)).join('; ') || null, KULTURMINNER: (data.kulturFlater?.[f.id] || []).map((k) => k.navn).join('; ') || null, GNR_BNR: gnrTekst(f) || null, KOMMUNENR: data.kommune?.nr || null, BEGRUNNELSE: f.grunn, SR16_MAALEAAR: f.maaleaar, SR16_ID: f.id,
      ...(kategori === 'hogst' && f.drift ? {
        PRIORITET: f.prioritet ?? null, KJORESKADERISIKO: f.drift.naa?.risiko ?? null, DRIFTSFORHOLD: f.drift.naa?.nivaa.navn ?? null, DATO: valgtDag,
        GRUNNRISIKO: f.drift.statisk.poeng, DRIFTSSESONG: SESONG[f.drift.statisk.sesong].navn, VAT_ANDEL_PST: f.drift.dtw ? Math.round(vatAndel(f.drift.dtw) * 100) : null,
        LOSMASSE: f.drift.losmasse, BAEREEVNE: f.drift.statisk.baereevne ? BAEREEVNE[f.drift.statisk.baereevne].navn : null,
        HELNING_PST: f.drift.helning != null ? Math.round(f.drift.helning) : null, BESTE_DAG: f.drift.beste?.dato || null,
      } : {}),
    });
    let innhold; let mime;
    if (type === 'geojson') {
      innhold = JSON.stringify({ type: 'FeatureCollection', features: liste.map((f) => ({ type: 'Feature', geometry: f.geometri, properties: egenskaper(f) })) });
      mime = 'application/geo+json';
    } else {
      const rader = liste.map(egenskaper);
      const kol = Object.keys(rader[0] || egenskaper(liste[0] || { areal: 0 }));
      const celle = (v) => { const s = v === null || v === undefined ? '' : typeof v === 'number' ? String(v).replace('.', ',') : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      innhold = `﻿${[kol.join(';'), ...rader.map((r) => kol.map((k) => celle(r[k])).join(';'))].join('\n')}`;
      mime = 'text/csv';
    }
    const url = URL.createObjectURL(new Blob([innhold], { type: mime }));
    const a = document.createElement('a'); a.href = url; a.download = `${navn}.${type === 'geojson' ? 'geojson' : 'csv'}`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }



  // Hendelser
  $('#komSkjema').addEventListener('submit', analyser);
  $('#komKommune').addEventListener('focus', lastKommuner, { once: true });
  panel.querySelectorAll('[data-kategori]').forEach((b) => b.addEventListener('click', () => { kategori = b.dataset.kategori; tegnListe(); tegnKart(); }));
  $('#komTreslag').addEventListener('change', () => { tegnListe(); tegnKart(); });
  $('#komKriterier').addEventListener('change', (e) => { const k = e.target.dataset.k; if (!k) return; kriterier[k] = Number(e.target.value); if (k === 'maksAvstandVei') settVeiValg(); oppdater(); });
  const settVeiValg = () => { const s = $('#komVeiMaks'); const v = String(kriterier.maksAvstandVei || 0); if (![...s.options].some((o) => o.value === v)) s.add(new Option(`Inntil ${v} m fra vei`, v)); s.value = v; };
  $('#komVeiMaks').addEventListener('change', (e) => { kriterier.maksAvstandVei = Number(e.target.value); $('#krit-maksAvstandVei').value = kriterier.maksAvstandVei; if (kriterier.maksAvstandVei && !data?.vei) melding('Avstand til vei beregnes – listen filtreres når den er klar.'); oppdater(); });
  $('#komUtenKultur').addEventListener('change', (e) => { utenKultur = e.target.checked; if (utenKultur && !data?.kultur) melding('Kulturminner hentes – listen filtreres når de er klare.'); tegnListe(); tegnKart(); });
  $('#komUtenNatur').addEventListener('change', (e) => { utenNatur = e.target.checked; if (utenNatur && !data?.natur) melding('Naturtyper og arter hentes – listen filtreres når de er klare.'); tegnListe(); tegnKart(); });
  $('#komSorter').addEventListener('change', (e) => { sortering = e.target.value; tegnListe(); tegnKart(); });
  $('#komEiendom').addEventListener('change', (e) => { if (e.target.checked && aktiv) eiendomLag.addTo(kart); else eiendomLag.remove(); tegnLegend(); });
  kart.on('zoomend', () => { if (aktiv && resultat) tegnLegend(); });
  $('#komNullstill').addEventListener('click', () => { kriterier = { ...STANDARD_KRITERIER }; KRITERIE_FELT.forEach(([k]) => { $(`#krit-${k}`).value = kriterier[k]; }); settVeiValg(); oppdater(); });
  $('#komListe').addEventListener('click', (e) => {
    const rad = e.target.closest('[data-flate]'); if (!rad) return;
    const f = filtrert().find((x) => x.id === rad.dataset.flate); if (!f) return;
    const l = flateLag.get(f.id);
    if (l) kart.fitBounds(l.getBounds(), { maxZoom: 16, padding: [40, 40], animate: false });
    L.popup({ maxWidth: 300 }).setLatLng([f.senter[1], f.senter[0]]).setContent(popupHtml(f)).openOn(kart);
    visEiendomIPopup(f);
  });
  $('#komDrift').addEventListener('click', (e) => {
    const t = e.target;
    if (t.id === 'komDriftStart' || t.id === 'komDriftNy') { antallDrift = Number($('#komDriftAntall')?.value || antallDrift); analyserDrift(); return; }
    if (t.id === 'komDriftVaer') { hentVaer(); return; }
    const d = t.closest('[data-kom-dag]'); if (d) { valgtDag = d.dataset.komDag; tegnListe(); tegnKart(); }
  });
  $('#komDrift').addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'komDriftAntall') antallDrift = Number(t.value);
    if (t.id === 'komDriftSorter') { sorterDrift = t.checked; tegnListe(); tegnKart(); }
    if (t.id === 'komDriftBare') { bareDrivbar = t.checked; tegnListe(); tegnKart(); }
    if (t.id === 'komDtw') settDtw(t.checked);
  });
  panel.querySelectorAll('[data-kom-eksport]').forEach((b) => b.addEventListener('click', () => eksporter(b.dataset.komEksport)));
  // Knappene ligger i Leaflet-popuper; lytt på dokumentet så Leaflets klikkhåndtering ikke stopper dem.
  document.addEventListener('click', (e) => {
    const fe = e.target.closest('[data-finn-eiendom]');
    if (fe) { const f = data?.flater.find((x) => x.id === fe.dataset.finnEiendom); if (f) { delete data.eiendom?.[f.id]; visEiendomIPopup(f); } return; }
    if (e.target.closest('[data-kom-vei-ny]')) { beregnVei({ tving: true }); return; }
    if (e.target.closest('[data-kom-natur-ny]')) { beregnNatur({ tving: true }); return; }
    const lp = e.target.closest('[data-lag-plan]');
    if (lp) { kart.closePopup(); lagPlanFor(JSON.parse(lp.dataset.lagPlan)); }
  });

  return {
    vis() {
      aktiv = true; lag.addTo(kart); vernLag.addTo(kart); if (visDtw && dtwLag) dtwLag.addTo(kart); if ($('#komEiendom')?.checked) eiendomLag.addTo(kart);
      if (misMerker) stoppMisMerker = merkerVedZoom(kart, misMerker, 13);
      lastKommuner();
      if (data) { tegnLegend(); kart.fitBounds(L.geoJSON(data.kommune.geometri).getBounds(), { padding: [10, 10] }); }
    },
    skjul() { aktiv = false; eiendomGen++; lag.remove(); vernLag.remove(); dtwLag?.remove(); eiendomLag.remove(); stoppMisMerker?.(); stoppMisMerker = null; },
    oppdaterPriser() { if (data) oppdater(); },
  };
}
