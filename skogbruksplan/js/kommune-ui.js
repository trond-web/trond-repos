// Fanen «Kommune»: analyse av en hel kommune med kart, liste, kriterier og kobling til planlaging for eiendommen.
import { hentKommunedata, klassifiser, oppsummer, eiendomIPunkt, STANDARD_KRITERIER } from './kommuneanalyse.js';
import { TRESLAG } from './model.js';
import { lagreVerdi, hentVerdi } from './store.js';
import { fmt } from './charts.js';
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
  const renderer = L.canvas({ padding: 0.3 });
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
    $('#kartLegend').innerHTML = `<div class="legend-innhold"><b>${drift ? `Kjøreskaderisiko ${ukedag(valgtDag)}` : k.navn}</b>${drift ? `${NAA.map((n) => `<div><i style="background:${n.farge}"></i>${n.navn}</div>`).join('')}<div><i style="background:${k.farge};opacity:.45"></i>Ikke analysert</div>` : `<div><i style="background:${k.farge}"></i>Forslag (${fmt(resultat[kategori].length)} flater)</div>`}<div><i style="background:transparent;border:2px dashed #d03b3b"></i>Vern / nøkkelbiotop</div><div><i style="background:transparent;border:2px solid #1b1c19"></i>Kommunegrense</div>${visDtw ? `<b style="display:block;margin-top:6px">Markfuktighet (DTW)</b>${DTW_KLASSER.map((d) => `<div><i style="background:rgb(${d.rgb.join(',')})"></i>${d.id === 'vann' ? 'Vann' : `Grunnvann ${d.navn}`}</div>`).join('')}` : ''}</div>`;
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
    if (kategori === 'hogst' && harDrift()) {
      oppdaterDrift(liste);
      if (bareDrivbar) liste = liste.filter((f) => f.drift?.naa && f.drift.naa.risiko < 50);
      if (sorterDrift) { const med = prioriter(liste.filter((f) => f.drift)); liste = [...med, ...liste.filter((f) => !f.drift)]; }
    }
    return liste;
  }

  function popupHtml(f) {
    const k = KATEGORIER[kategori];
    return `<div class="kom-popup"><b>${k.navn}</b>${f.metode ? ` – ${esc(f.metode)}` : ''}<br>
      ${desimal(f.areal)} daa · ${TRESLAG[f.treslag] || ''} (${esc(f.dominerende || '')}) · bonitet ${f.bonitet ?? '–'}<br>
      Alder ${f.alder !== null ? Math.round(f.alder) : '–'} år · ${desimal(f.volumDaa)} m³/daa · høyde ${desimal(f.hoyde)} m · ${f.treantall ? Math.round(f.treantall) : '–'} trær/daa<br>
      ${f.rotnetto ? `Rotnetto ca. ${fmt(f.rotnetto)} kr<br>` : ''}<span class="hint">${esc(f.grunn)}${f.maaleaar ? ` · SR16 målt ${f.maaleaar}` : ''}</span><br>
      ${kategori === 'hogst' && f.drift ? driftPopup(f) : ''}
      <button type="button" class="knapp liten" data-finn-eiendom="${esc(f.id)}">Finn eiendom</button><div class="kom-eiendom" data-eiendom-for="${esc(f.id)}"></div></div>`;
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
      const l = L.geoJSON(f.geometri, { style: { color: fc, weight: drift && f.drift ? 1.5 : 1, fillColor: fc, fillOpacity: drift && !f.drift ? 0.25 : 0.6 }, renderer });
      l.bindPopup(() => popupHtml(f), { maxWidth: 300 });
      l.addTo(lag);
      flateLag.set(f.id, l);
    }
    for (const v of data.vern) if (v.geometri) L.geoJSON(v.geometri, { style: { color: '#d03b3b', weight: 1.5, dashArray: '5 4', fill: false }, interactive: false, renderer }).addTo(vernLag);
    for (const m of data.mis) L.geoJSON(m, { style: { color: '#d03b3b', weight: 1.5, dashArray: '2 3', fill: false }, interactive: false, renderer }).addTo(vernLag);
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
      <span><b>${desimal(f.areal)} daa · ${TRESLAG[f.treslag] || ''} ${f.bonitet ?? ''}</b> · ${f.alder !== null ? Math.round(f.alder) : '–'} år · ${desimal(f.volumDaa)} m³/daa${f.rotnetto ? ` · ca. ${fmt(f.rotnetto / 1000)} k kr` : ''}${f.metode ? ` · ${esc(f.metode)}` : ''}<br><span class="hint">${esc(f.grunn)}</span>${kategori === 'hogst' && f.drift ? `<br><span class="kom-risiko" style="--farge:${f.drift.naa?.nivaa.farge || '#999'}">${esc(f.drift.naa?.nivaa.navn || 'Ukjent')}${f.drift.naa ? ` · ${f.drift.naa.risiko}` : ''}</span> <span class="hint">${esc(SESONG[f.drift.statisk.sesong].navn)} · ${esc(f.drift.statisk.grunner.slice(0, 2).join(' · '))}${f.drift.beste && f.drift.beste.dato !== valgtDag && f.drift.naa?.risiko >= 30 ? ` · bedre ${ukedag(f.drift.beste.dato)}` : ''}</span>` : ''}</span>
    </button>`).join('') + (liste.length > vis.length ? `<p class="hint">Viser de ${vis.length} største av ${fmt(liste.length)}. Alle vises i kartet og i eksporten.</p>` : '')
      : '<div class="tom">Ingen flater oppfyller kriteriene.</div>';
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

  function visResultat(d, fraLager) {
    data = d;
    const aar = d.flater.map((f) => f.maaleaar).filter(Boolean).sort((a, b) => a - b);
    const median = aar.length ? aar[Math.floor(aar.length / 2)] : null;
    $('#komInfo').innerHTML = `<b>${esc(d.kommune.navn)}</b>: ${fmt(d.flater.length)} skogflater fra SR16${median ? `, hovedsakelig målt ${median}` : ''}. ${d.vern.length} verneområder og ${d.mis.length} nøkkelbiotoper er holdt utenfor hogstforslagene. ${fraLager ? `Lagret analyse fra ${new Date(d.hentet).toLocaleDateString('nb-NO')}.` : ''}
      ${median && median < new Date().getFullYear() - 5 ? '<br><span class="advarsel">Skog kan være hogd etter at SR16 ble målt. Kontroller mot flyfoto før du går videre.</span>' : ''}`;
    $('#komResultat').hidden = false;
    oppdater();
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
      ROTNETTO_KR: f.rotnetto ? Math.round(f.rotnetto) : null, BEGRUNNELSE: f.grunn, SR16_MAALEAAR: f.maaleaar, SR16_ID: f.id,
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

  async function finnEiendom(id, boks) {
    const f = data.flater.find((x) => x.id === id);
    boks.innerHTML = '<span class="hint">Slår opp i matrikkelen …</span>';
    try {
      const e = await eiendomIPunkt(f.senter);
      boks.innerHTML = e.length ? e.map((x) => `<div class="kom-eiendom-rad">Gnr/bnr <b>${esc(x.tekst)}</b> <button type="button" class="knapp liten primar" data-lag-plan='${esc(JSON.stringify(x))}'>Lag skogbruksplan</button></div>`).join('')
        : '<span class="hint">Fant ingen eiendom i punktet.</span>';
    } catch (err) { boks.innerHTML = `<span class="hint">Oppslaget feilet: ${esc(err.message)}</span>`; }
  }

  // Hendelser
  $('#komSkjema').addEventListener('submit', analyser);
  $('#komKommune').addEventListener('focus', lastKommuner, { once: true });
  panel.querySelectorAll('[data-kategori]').forEach((b) => b.addEventListener('click', () => { kategori = b.dataset.kategori; tegnListe(); tegnKart(); }));
  $('#komTreslag').addEventListener('change', () => { tegnListe(); tegnKart(); });
  $('#komKriterier').addEventListener('change', (e) => { const k = e.target.dataset.k; if (!k) return; kriterier[k] = Number(e.target.value); oppdater(); });
  $('#komNullstill').addEventListener('click', () => { kriterier = { ...STANDARD_KRITERIER }; KRITERIE_FELT.forEach(([k]) => { $(`#krit-${k}`).value = kriterier[k]; }); oppdater(); });
  $('#komListe').addEventListener('click', (e) => {
    const rad = e.target.closest('[data-flate]'); if (!rad) return;
    const f = filtrert().find((x) => x.id === rad.dataset.flate); if (!f) return;
    const l = flateLag.get(f.id);
    if (l) kart.fitBounds(l.getBounds(), { maxZoom: 16, padding: [40, 40], animate: false });
    L.popup({ maxWidth: 300 }).setLatLng([f.senter[1], f.senter[0]]).setContent(popupHtml(f)).openOn(kart);
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
    if (fe) { finnEiendom(fe.dataset.finnEiendom, fe.parentElement.querySelector('.kom-eiendom')); return; }
    const lp = e.target.closest('[data-lag-plan]');
    if (lp) { kart.closePopup(); lagPlanFor(JSON.parse(lp.dataset.lagPlan)); }
  });

  return {
    vis() {
      aktiv = true; lag.addTo(kart); vernLag.addTo(kart); if (visDtw && dtwLag) dtwLag.addTo(kart);
      lastKommuner();
      if (data) { tegnLegend(); kart.fitBounds(L.geoJSON(data.kommune.geometri).getBounds(), { padding: [10, 10] }); }
    },
    skjul() { aktiv = false; lag.remove(); vernLag.remove(); dtwLag?.remove(); },
    oppdaterPriser() { if (data) oppdater(); },
  };
}
