// Veier › 🚛 Tømmertransport til terminal: velg velteplass/hentested og terminal, beregn kjørerute for tømmerbilen
// og kontroller den mot bruksklasse (vekt og vogntoglengde), høydebegrensninger og lastebilforbud i NVDB. Der fullt
// vogntog ikke er tillatt, foreslås å kjøre uten henger (med hengerplass) eller en omkjøring. Logikken: transport.js.
import * as T from './transport.js';
import { fmt } from './charts.js';
import { transportVarsel as markaTransportVarsel } from './marka.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const VALHALLA = 'https://valhalla1.openstreetmap.de/route';
const NVDB = 'https://nvdbapiles.atlas.vegvesen.no/vegobjekter/api/v4/vegobjekter';
const FARGE = { ok: '#0ca30c', tele: '#e0a800', ukjent: '#8a8a85', ikke: '#d03b3b' };
const tid = (s) => { const t = Math.round(s / 60); return t >= 60 ? `${Math.floor(t / 60)} t ${t % 60} min` : `${t} min`; };
const r5 = (p) => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5];
// NVDB per rute (flis), delt mellom beregninger i samme økt.
const flisCache = new Map();
const tynn = (l, maks = 1500) => { if (l.length <= maks) return l.map(r5); const s = Math.ceil(l.length / maks); return l.filter((_, i) => i % s === 0 || i === l.length - 1).map(r5); };

export function initTransport({ kart, hentPlan, endret, melding, settKartKlikk, padding = () => ({ padding: [40, 40] }) }) {
  const el = document.querySelector('#transportPanel'); if (!el) return null;
  const lag = L.layerGroup(); let arbeider = ''; let synlig = false; let velger = null;
  const tr = () => { const S = hentPlan(); if (!S.transport) S.transport = { kjoretoy: 'vogntog24', hoyde: 4.0, terminal: 'lierstranda' }; return S.transport; };
  const velteplasser = () => (hentPlan().veier?.punkter || []).filter((p) => p.type === 'velteplass' && p.geometri);
  const terminalPos = () => { const t = tr(); return t.terminal === 'egen' ? t.egenTerminal : T.TERMINALER[t.terminal]?.pos; };
  const kjoretoy = () => { const t = tr(); return { ...T.KJORETOY[t.kjoretoy], hoyde: Number(t.hoyde) || T.KJORETOY[t.kjoretoy].hoyde }; };

  // ---------- henting ----------
  async function valhalla(fra, til, k, unnga = []) {
    const kropp = { locations: [{ lon: fra[0], lat: fra[1], radius: 300 }, { lon: til[0], lat: til[1], radius: 300 }], costing: 'truck', costing_options: { truck: { length: k.lengde, weight: k.vekt, height: k.hoyde, width: 2.55, axle_load: 10, hazmat: false } }, units: 'kilometers', directions_options: { language: 'nb-NO' }, ...(unnga.length ? { exclude_polygons: unnga } : {}) };
    const r = await fetch(VALHALLA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(kropp) });
    const j = await r.json().catch(() => ({})); if (!r.ok || !j.trip) throw new Error(j.error ? `Fant ingen kjørerute: ${j.error}` : `Rutetjenesten svarte ${r.status}`);
    const leg = j.trip.legs[0];
    return { linje: T.dekodPolyline(leg.shape), km: j.trip.summary.length, sek: j.trip.summary.time, instr: leg.maneuvers.map((m) => ({ tekst: m.instruction, km: m.length })) };
  }
  async function nvdbType(type, b) {
    const ut = []; let url = `${NVDB}/${type}?kartutsnitt=${T.utmBoks(b).join(',')}&srid=5973&inkluder=egenskaper,geometri,lokasjon&geometritoleranse=2&antall=1000${type === 856 ? `&egenskap=${encodeURIComponent(T.REGULERING_FILTER)}` : ''}`;
    for (let i = 0; i < 20 && url; i++) { const r = await fetch(url, { headers: { Accept: 'application/json', 'X-Client': 'SkogIQ.ai' } }); if (!r.ok) throw new Error(`NVDB svarte ${r.status}`); const j = await r.json(); ut.push(...(j.objekter || [])); url = j.metadata?.returnert >= j.metadata?.sidestørrelse ? j.metadata?.neste?.href : null; }
    return ut;
  }
  async function nvdbLangs(linje, dato) {
    const fliser = T.fliserLangs(linje); const alle = { 900: new Map(), 591: new Map(), 856: new Map() }; let ferdig = 0;
    const jobber = fliser.flatMap((f) => [900, 591, 856].map((t) => [t, f])); const totalt = jobber.length;
    const kjor = async () => {
      while (jobber.length) {
        const [t, f] = jobber.shift(); const k = `${t}:${f.nokkel}`;
        if (!flisCache.has(k)) flisCache.set(k, nvdbType(t, f.boks).catch((e) => { flisCache.delete(k); throw e; }));
        for (const o of await flisCache.get(k)) alle[t].set(o.id, o);
        ferdig++; if (ferdig % 12 === 0) { arbeider = `Henter bruksklasser og begrensninger fra NVDB … ${Math.round((ferdig / totalt) * 100)} %`; tegn(); }
      }
    };
    await Promise.all(Array.from({ length: 6 }, kjor));
    const med = (o, tolk) => ({ ...tolk(o), linjer: T.wktLinjer(o.geometri?.wkt || '', { utm: true }) });
    const planVeier = (hentPlan().veier?.veier || []).filter((v) => v.geometri).map((v) => ({ klasse: Number(v.klasse) || 0, navn: v.navn, linjer: v.geometri.type === 'MultiLineString' ? v.geometri.coordinates : [v.geometri.coordinates] }));
    return { bruksklasse: [...alle[900].values()].map((o) => med(o, (x) => T.tolkBruksklasse(x, dato))), hoyde: [...alle[591].values()].map((o) => med(o, T.tolkHoyde)), regulering: [...alle[856].values()].map((o) => med(o, T.tolkRegulering)), planVeier, antall: { bruksklasse: alle[900].size, hoyde: alle[591].size, regulering: alle[856].size } };
  }
  const kompakt = (rute, a, an) => ({
    linje: tynn(rute.linje), km: rute.km, sek: rute.sek, instr: rute.instr.slice(0, 200), ok: a.ok, ikkeM: a.ikkeM, ukjentM: a.ukjentM, teleM: a.teleM, anbefaling: an,
    strekninger: a.strekninger.filter((s) => s.status !== 'ok' && (s.status !== 'ukjent' || s.tilM - s.fraM >= 50 || s.fraM < 1)).slice(0, 60).map((s) => ({ status: s.status, fraM: Math.round(s.fraM), tilM: Math.round(s.tilM), grunn: s.grunn, vegref: s.kilde?.vegref || '', beskrivelse: s.kilde?.beskrivelse || '', linje: tynn(s.linje, 200) })),
    farger: a.strekninger.map((s) => ({ status: s.status, linje: tynn(s.linje, 400) })),
    hindre: a.hindre.map((h) => ({ type: h.type, p: r5(h.p), m: Math.round(h.m), tekst: h.tekst, vegref: h.vegref, stopp: h.stopp })),
  });

  async function beregn() {
    const t = tr(); const fra = t.velteplass?.pos; const til = terminalPos();
    if (!fra) { melding('Velg velteplass eller hentested først.'); return; } if (!til) { melding('Velg terminal.'); return; }
    const k = kjoretoy(); const dato = new Date().toISOString().slice(0, 10);
    try {
      arbeider = `Beregner kjørerute for ${k.navn.toLowerCase()} …`; tegn();
      const rute = await valhalla(fra, til, k);
      arbeider = 'Henter bruksklasser og begrensninger fra NVDB …'; tegn();
      const data = await nvdbLangs(rute.linje, dato);
      const full = T.analyser(rute.linje, data, k); const bil = T.analyser(rute.linje, data, { ...T.KJORETOY[T.UTEN_HENGER], hoyde: k.hoyde });
      const an = T.anbefaling(full, bil, k);
      const res = { beregnet: new Date().toISOString(), dato, kjoretoy: t.kjoretoy, hoyde: k.hoyde, fra, til, terminal: t.terminal, hoved: kompakt(rute, full, an), alternativ: null, nvdb: data.antall };
      // Omkjøring for fullt vogntog når ruten har strekninger som ikke er tillatt.
      if (!full.ok && k.henger) {
        arbeider = 'Leter etter omkjøring for fullt vogntog …'; tegn();
        try {
          let unnga = T.unngaaPolygoner(full); let alt = null;
          for (let forsok = 0; forsok < (an.niva === 'uten-henger-start' ? 1 : 3) && unnga.length; forsok++) {
            const r2 = await valhalla(fra, til, k, unnga); const d2 = await nvdbLangs(r2.linje, dato); const a2 = T.analyser(r2.linje, d2, k);
            alt = { r2, a2 }; if (a2.ok) break; unnga = [...unnga, ...T.unngaaPolygoner(a2)].slice(0, 40);
          }
          if (alt) res.alternativ = kompakt(alt.r2, alt.a2, alt.a2.ok ? { niva: 'ok', tekst: `Omkjøringen er tillatt for ${k.navn.toLowerCase()} hele veien (${fmt(alt.r2.km - rute.km, 1)} km ${alt.r2.km >= rute.km ? 'lengre' : 'kortere'}).` } : { niva: 'omkjoring', tekst: 'Fant ingen omkjøring som er tillatt hele veien for fullt vogntog.' });
        } catch (e) { res.alternativFeil = e.message; }
      }
      t.resultat = res; arbeider = ''; endret({ kart: false }); tegn(); tegnKart(true);
      melding(full.ok ? '✓ Ruten er tillatt for valgt kjøretøy.' : 'Ruten har begrensninger – se anbefalingen.');
    } catch (e) { arbeider = ''; tegn(); melding(e.message || 'Klarte ikke å beregne ruten.'); }
  }

  // ---------- kart ----------
  const ikon = (html, kl) => L.divIcon({ className: `tr-ikon ${kl}`, html, iconSize: [30, 30], iconAnchor: [15, 15] });
  function tegnKart(zoom = false) {
    lag.clearLayers(); const t = tr(); const r = t.resultat;
    if (t.velteplass?.pos) L.marker([t.velteplass.pos[1], t.velteplass.pos[0]], { icon: ikon('V', 'velte'), title: 'Velteplass / hentested' }).addTo(lag);
    const tp = terminalPos(); if (tp) L.marker([tp[1], tp[0]], { icon: ikon('🏁', 'terminal'), title: 'Terminal' }).addTo(lag);
    if (r?.alternativ) L.polyline(r.alternativ.linje.map((p) => [p[1], p[0]]), { color: '#2a78d6', weight: 5, opacity: 0.8, dashArray: '10 8' }).bindTooltip('Omkjøring for fullt vogntog').addTo(lag);
    if (r?.hoved) {
      L.polyline(r.hoved.linje.map((p) => [p[1], p[0]]), { color: '#ffffff', weight: 9, opacity: 0.9 }).addTo(lag);
      for (const s of r.hoved.farger) L.polyline(s.linje.map((p) => [p[1], p[0]]), { color: FARGE[s.status], weight: 5, opacity: 0.95, dashArray: s.status === 'ukjent' ? '6 6' : null }).addTo(lag);
      for (const h of r.hoved.hindre) L.marker([h.p[1], h.p[0]], { icon: ikon(h.type === 'hoyde' ? '⇕' : '⛔', 'hinder') }).bindTooltip(`${esc(h.tekst)}<br><small>${esc(h.vegref)}</small>`).addTo(lag);
      const hp = r.hoved.anbefaling?.hengerplass; if (hp) L.marker([hp.p[1], hp.p[0]], { icon: ikon('H', 'henger') }).bindTooltip('Hengerplass: koble på hengeren her').addTo(lag);
    }
    if (zoom) { const b = L.featureGroup(lag.getLayers().filter((x) => x.getBounds || x.getLatLng)).getBounds(); if (b.isValid()) kart.fitBounds(b, padding()); }
  }
  function velgIKart(hva) {
    velger = hva; melding(hva === 'velte' ? 'Klikk i kartet der tømmeret ligger (velteplass eller hentested).' : 'Klikk i kartet der tømmeret skal leveres.', 6000);
    kart.getContainer().style.cursor = 'crosshair';
    settKartKlikk((ll) => {
      settKartKlikk(null); kart.getContainer().style.cursor = ''; const t = tr(); const pos = [Math.round(ll.lng * 1e6) / 1e6, Math.round(ll.lat * 1e6) / 1e6];
      if (velger === 'velte') t.velteplass = { pos, navn: 'Valgt i kartet' }; else { t.terminal = 'egen'; t.egenTerminal = pos; }
      velger = null; t.resultat = null; endret({ kart: false }); tegnKart(); tegn();
    });
  }

  // ---------- visning ----------
  function tegn() {
    const t = tr(); const r = t.resultat; const k = kjoretoy(); const vp = velteplasser();
    const rad = (s) => `<tr><td><span class="tr-prikk" style="background:${FARGE[s.status]}"></span>${esc({ ikke: 'Ikke tillatt', tele: 'Sesong', ukjent: 'Ukjent' }[s.status])}</td><td class="t">${T.fmtKm(s.fraM)}–${T.fmtKm(s.tilM)}</td><td>${esc(s.grunn.join('; '))}<div class="hint">${esc([s.vegref, s.beskrivelse].filter(Boolean).join(' · '))}</div></td><td><button type="button" class="knapp liten" data-tr-vis="${s.fraM}">Vis</button></td></tr>`;
    const ruteHtml = (x, tittel) => {
      const a = x.anbefaling || {}; const n = T.lass(Number(t.m3), T.KJORETOY[a.niva === 'uten-henger' ? T.UTEN_HENGER : t.kjoretoy], x.km * 1000);
      return `<div class="tr-rute tr-${esc(a.niva || 'ok')}"><h4>${esc(tittel)} · ${fmt(x.km, 1)} km · ${tid(x.sek)}</h4>
        <p class="tr-anbefaling">${a.niva === 'ok' ? '✅' : a.niva?.startsWith('uten-henger') ? '🚚' : '⛔'} ${esc(a.tekst || '')}</p>
        ${x.strekninger.length ? `<div class="tabell"><table class="sf-tabell"><thead><tr><th>Status</th><th class="t">Hvor</th><th>Begrensning</th><th></th></tr></thead><tbody>${x.strekninger.map(rad).join('')}</tbody></table></div>` : ''}
        ${x.hindre.length ? `<ul class="sf-liste">${x.hindre.map((h) => `<li>${h.type === 'hoyde' ? '⇕' : '⛔'} <b>${esc(h.tekst)}</b> ved ${T.fmtKm(h.m)} <span class="hint">${esc(h.vegref)}</span></li>`).join('')}</ul>` : ''}
        ${n ? `<p class="hint">${fmt(Number(t.m3))} m³ ≈ <b>${n.lass} lass</b> og ${fmt(n.km)} km kjøring tur–retur (anslag ${T.KJORETOY[t.kjoretoy].lass} m³ per lass).</p>` : ''}
        <details class="ekstra"><summary>Kjørebeskrivelse (${x.instr.length})</summary><ol class="tr-instr">${x.instr.map((i) => `<li>${esc(i.tekst)} <span class="hint">${fmt(i.km, 1)} km</span></li>`).join('')}</ol></details></div>`;
    };
    el.innerHTML = `<h3>🚛 Tømmertransport til terminal</h3>
      <p class="hint">Velg hvor tømmeret hentes, og få kjøreruten til terminalen kontrollert mot vekt, vogntoglengde, høyde og lastebilforbud langs hele veien (NVDB). Der fullt vogntog ikke er tillatt, foreslås å kjøre uten henger eller en omkjøring.</p>
      <div class="skjema to-kol">
        <label>Velteplass / hentested<select data-tr="velte"><option value="">${t.velteplass?.pos && !t.velteplass.id ? 'Valgt i kartet' : 'Velg …'}</option>${vp.map((p) => `<option value="${esc(p.id)}" ${t.velteplass?.id === p.id ? 'selected' : ''}>${esc(p.navn || 'Velteplass')}</option>`).join('')}</select></label>
        <div class="tr-knapp"><button type="button" class="knapp liten" data-tr="velg-velte">📍 Velg i kartet</button></div>
        <label>Terminal<select data-tr="terminal">${Object.entries(T.TERMINALER).map(([id, x]) => `<option value="${id}" ${t.terminal === id ? 'selected' : ''}>${esc(x.navn)}</option>`).join('')}<option value="egen" ${t.terminal === 'egen' ? 'selected' : ''}>Annen leveringsplass (velg i kartet)</option></select></label>
        <div class="tr-knapp"><button type="button" class="knapp liten" data-tr="velg-terminal">🏁 Velg i kartet</button></div>
        <label>Kjøretøy<select data-tr="kjoretoy">${Object.entries(T.KJORETOY).map(([id, x]) => `<option value="${id}" ${t.kjoretoy === id ? 'selected' : ''}>${esc(x.navn)}</option>`).join('')}</select></label>
        <label>Høyde med last (m)<input type="number" step="0.1" min="3" max="5" data-tr="hoyde" value="${esc(t.hoyde ?? 4.0)}"></label>
        <label>Volum som skal kjøres (m³, valgfritt)<input type="number" min="0" step="10" data-tr="m3" value="${esc(t.m3 ?? '')}"></label>
      </div>
      ${T.TERMINALER[t.terminal]?.merk ? `<p class="sf-varsel">⚠ ${esc(T.TERMINALER[t.terminal].merk)}</p>` : ''}
      ${(() => { const mv = markaTransportVarsel(hentPlan(), t.velteplass?.pos); return mv ? `<p class="sf-varsel">🌲 ${esc(mv.tekst)} <a href="${mv.hjemmel.url}" target="_blank" rel="noopener">${esc(mv.hjemmel.navn)}</a></p>` : ''; })()}
      <div class="knapperad"><button type="button" class="knapp primar" data-tr="beregn" ${arbeider ? 'disabled' : ''}>Beregn og kontroller ruten</button>${r ? '<button type="button" class="knapp liten" data-tr="kart">Vis i kartet</button>' : ''}</div>
      ${arbeider ? `<p class="hs-arbeider">⏳ ${esc(arbeider)}</p>` : ''}
      ${r ? `<p class="hint">Beregnet ${esc(new Date(r.beregnet).toLocaleString('nb-NO'))} for ${esc(T.KJORETOY[r.kjoretoy]?.navn || '')}, høyde ${esc(String(r.hoyde).replace('.', ','))} m. ${fmt(r.nvdb?.bruksklasse)} veglenker med bruksklasse, ${fmt(r.nvdb?.hoyde)} høydebegrensninger og ${fmt(r.nvdb?.regulering)} trafikkreguleringer langs ruten.</p>
        ${ruteHtml(r.hoved, 'Raskeste rute')}${r.alternativ ? ruteHtml(r.alternativ, 'Omkjøring') : ''}${r.alternativFeil ? `<p class="hint">Omkjøring: ${esc(r.alternativFeil)}</p>` : ''}
        <p class="hint tr-legende"><span class="tr-prikk" style="background:${FARGE.ok}"></span>tillatt <span class="tr-prikk" style="background:${FARGE.tele}"></span>sesong (tele/vinter) <span class="tr-prikk" style="background:${FARGE.ukjent}"></span>ukjent (privat vei) <span class="tr-prikk" style="background:${FARGE.ikke}"></span>ikke tillatt <span style="color:#2a78d6">– – omkjøring</span></p>` : ''}
      <details class="ekstra"><summary>Slik kontrolleres ruten – og hva du selv må sjekke</summary><ul class="sf-liste">
        <li><b>Kjøreruten</b> beregnes for lastebil med valgt lengde, vekt og høyde av <a href="${T.KILDER.valhalla.url}" target="_blank" rel="noopener">Valhalla</a> (OpenStreetMap).</li>
        <li><b>Bruksklasse for tømmertransport</b> (tillatt totalvekt og maks vogntoglengde) hentes fra <a href="${T.KILDER.bruksklasse.url}" target="_blank" rel="noopener">NVDB</a> for hver veglenke langs ruten, med vinterbruksklasse og telerestriksjoner som gjelder i dag. Fullt tømmervogntog (24 m / 60 t) krever BkT8 – 60 tonn eller Bk10 – 60 tonn og 24 m vogntoglengde.</li>
        <li><b>Høydebegrensninger</b> (bruer, undergang, kabler) og <b>lastebilforbud</b> hentes også fra NVDB.</li>
        <li><b>Skogsbilveiene i planen</b> brukes for private veier: klasse 4 bare uten henger, klasse 5 bare vinter, klasse 7–8 er traktorvei. Andre private veier vises som «ukjent» – avklar med veieier.</li>
        <li><b>Uten henger:</b> der vogntoget ikke er tillatt, kontrolleres tømmerbil uten henger (12,4 m / 32 t). Ligger begrensningene i starten, foreslås en hengerplass der hengeren kobles på.</li>
        <li>Juridisk gjelder <a href="${T.KILDER.veglister.url}" target="_blank" rel="noopener">veglistene</a> og skiltingen på stedet. Sjekk også midlertidige restriksjoner, bomveier og tillatelse til å bruke private veier.</li>
      </ul></details>`;
  }

  el.addEventListener('click', (e) => {
    const k = e.target.closest('[data-tr]')?.dataset.tr; const v = e.target.closest('[data-tr-vis]');
    if (v) { const r = tr().resultat; const fra = Number(v.dataset.trVis); const s = [...(r.hoved.strekninger || []), ...(r.alternativ?.strekninger || [])].find((x) => x.fraM === fra); if (s) { if (!synlig) lag.addTo(kart); kart.fitBounds(L.polyline(s.linje.map((p) => [p[1], p[0]])).getBounds(), { maxZoom: 16, ...padding() }); } return; }
    if (k === 'beregn') beregn();
    if (k === 'kart') { tegnKart(true); }
    if (k === 'velg-velte') velgIKart('velte');
    if (k === 'velg-terminal') velgIKart('terminal');
  });
  el.addEventListener('change', (e) => {
    const k = e.target.dataset.tr; if (!k) return; const t = tr();
    if (k === 'velte') { const p = velteplasser().find((x) => x.id === e.target.value); if (p) t.velteplass = { id: p.id, pos: p.geometri.coordinates, navn: p.navn }; }
    if (k === 'terminal') { t.terminal = e.target.value; if (t.terminal === 'egen' && !t.egenTerminal) { velgIKart('terminal'); return; } }
    if (k === 'kjoretoy') t.kjoretoy = e.target.value;
    if (k === 'hoyde') t.hoyde = Number(e.target.value) || 4.0;
    if (k === 'm3') { t.m3 = e.target.value === '' ? null : Number(e.target.value); endret({ kart: false }); tegn(); return; }
    t.resultat = null; endret({ kart: false }); tegnKart(); tegn();
  });
  return {
    vis() { synlig = true; lag.addTo(kart); tegnKart(); tegn(); },
    skjul() { synlig = false; lag.remove(); if (velger) { velger = null; settKartKlikk(null); kart.getContainer().style.cursor = ''; } },
    oppdater() { tegnKart(); tegn(); },
  };
}
