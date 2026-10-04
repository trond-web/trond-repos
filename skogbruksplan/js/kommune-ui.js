// Fanen «Kommune»: analyse av en hel kommune med kart, liste, kriterier og kobling til planlaging for eiendommen.
import { hentKommunedata, klassifiser, oppsummer, eiendomIPunkt, STANDARD_KRITERIER } from './kommuneanalyse.js';
import { TRESLAG } from './model.js';
import { lagreVerdi, hentVerdi } from './store.js';
import { fmt } from './charts.js';

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

export function initKommune({ kart, melding, innstillinger, lastKommuner, finnKommune, lagPlanFor }) {
  let data = null; let resultat = null; let kategori = 'hogst';
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
    $('#kartLegend').innerHTML = `<div class="legend-innhold"><b>${k.navn}</b><div><i style="background:${k.farge}"></i>Forslag (${fmt(resultat[kategori].length)} flater)</div><div><i style="background:transparent;border:2px dashed #d03b3b"></i>Vern / nøkkelbiotop</div><div><i style="background:transparent;border:2px solid #1b1c19"></i>Kommunegrense</div></div>`;
  }

  function filtrert() {
    if (!resultat) return [];
    const ts = $('#komTreslag').value;
    return resultat[kategori].filter((f) => !ts || f.treslag === ts);
  }

  function popupHtml(f) {
    const k = KATEGORIER[kategori];
    return `<div class="kom-popup"><b>${k.navn}</b>${f.metode ? ` – ${esc(f.metode)}` : ''}<br>
      ${desimal(f.areal)} daa · ${TRESLAG[f.treslag] || ''} (${esc(f.dominerende || '')}) · bonitet ${f.bonitet ?? '–'}<br>
      Alder ${f.alder !== null ? Math.round(f.alder) : '–'} år · ${desimal(f.volumDaa)} m³/daa · høyde ${desimal(f.hoyde)} m · ${f.treantall ? Math.round(f.treantall) : '–'} trær/daa<br>
      ${f.rotnetto ? `Rotnetto ca. ${fmt(f.rotnetto)} kr<br>` : ''}<span class="hint">${esc(f.grunn)}${f.maaleaar ? ` · SR16 målt ${f.maaleaar}` : ''}</span><br>
      <button type="button" class="knapp liten" data-finn-eiendom="${esc(f.id)}">Finn eiendom</button><div class="kom-eiendom" data-eiendom-for="${esc(f.id)}"></div></div>`;
  }

  function tegnKart() {
    lag.clearLayers(); vernLag.clearLayers(); flateLag = new Map();
    if (!data || !resultat) return;
    L.geoJSON(data.kommune.geometri, { style: { color: '#1b1c19', weight: 2, fill: false }, interactive: false, renderer }).addTo(lag);
    const farge = KATEGORIER[kategori].farge;
    for (const f of filtrert()) {
      const l = L.geoJSON(f.geometri, { style: { color: farge, weight: 1, fillColor: farge, fillOpacity: 0.55 }, renderer });
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
    $('#komBeskrivelse').textContent = KATEGORIER[kategori].tekst;
    $('#komSum').innerHTML = `<div><b>${fmt(o.antall)}</b><span>flater</span></div><div><b>${fmt(o.areal)} daa</b><span>areal</span></div>
      <div><b>${fmt(o.volum)} m³</b><span>volum</span></div>${kategori === 'hogst' ? `<div><b>${desimal(o.rotnetto / 1e6, 1)} mill</b><span>kr rotnetto (est.)</span></div>` : ''}`;
    const vis = liste.slice(0, 150);
    $('#komListe').innerHTML = vis.length ? vis.map((f, i) => `<button type="button" class="kom-rad" data-flate="${esc(f.id)}">
      <span class="nr">${i + 1}</span>
      <span><b>${desimal(f.areal)} daa · ${TRESLAG[f.treslag] || ''} ${f.bonitet ?? ''}</b> · ${f.alder !== null ? Math.round(f.alder) : '–'} år · ${desimal(f.volumDaa)} m³/daa${f.rotnetto ? ` · ca. ${fmt(f.rotnetto / 1000)} k kr` : ''}${f.metode ? ` · ${esc(f.metode)}` : ''}<br><span class="hint">${esc(f.grunn)}</span></span>
    </button>`).join('') + (liste.length > vis.length ? `<p class="hint">Viser de ${vis.length} største av ${fmt(liste.length)}. Alle vises i kartet og i eksporten.</p>` : '')
      : '<div class="tom">Ingen flater oppfyller kriteriene.</div>';
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
      aktiv = true; lag.addTo(kart); vernLag.addTo(kart);
      lastKommuner();
      if (data) { tegnLegend(); kart.fitBounds(L.geoJSON(data.kommune.geometri).getBounds(), { padding: [10, 10] }); }
    },
    skjul() { aktiv = false; lag.remove(); vernLag.remove(); },
    oppdaterPriser() { if (data) oppdater(); },
  };
}
