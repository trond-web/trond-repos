// Kommune › 🧪 Skadesimulering: de samme skadetypene som for eiendommen, regnet på alle SR16-skogflatene i kommunen.
// Varmekart over kommunen, totaler, fordeling på treslag, mest utsatte områder med eiendommer (gnr/bnr), værprognose
// som varierer over kommunen, brannspredning på rutenett med AR5 (myr, vann, bebyggelse og vei) og rapport som PDF.
// Logikken: kommunesim.js og skadesim.js.
import * as SIM from './skadesim.js';
import * as K from './kommunesim.js';
import { fmt, linje } from './charts.js';
import { lagPdf } from './pdf-enkel.js';
import { signatur } from './versjon.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const skala = (a) => (a >= 0.5 ? '#8f1c1c' : a >= 0.25 ? '#e0442f' : a >= 0.1 ? '#f08a24' : a >= 0.02 ? '#f2c230' : null);
const TREKK = [['2–10 %', '#f2c230'], ['10–25 %', '#f08a24'], ['25–50 %', '#e0442f'], ['Over 50 %', '#8f1c1c']];
const TRESLAG = { G: 'Gran', F: 'Furu', L: 'Lauv' };
const tidTekst = (m) => (m < 90 ? `${Math.round(m)} min` : `${fmt(m / 60, 1)} t`);

async function dekodPng(url) {
  const r = await fetch(url); if (!r.ok) throw new Error(`NIBIO svarte ${r.status}`);
  const bmp = await createImageBitmap(await r.blob());
  const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0);
  return x.getImageData(0, 0, bmp.width, bmp.height).data;
}

export function lagKommunesimUi({ kart, melding, innstillinger, eiendomIPunkt, hentData, visVanlig }) {
  const iAar = new Date().getFullYear();
  const lag = L.layerGroup(); const renderer = L.canvas({ padding: 0.3 });
  let aapen = false; let type = 'storm'; const param = {}; let felt = null; let feltType = null; let vaerData = null; let romlig = true;
  let idx = null; let idxFor = null; let res = null; let resNokkel = ''; let kurve = null;
  let brann = null; let start = null; let velgStart = false; let arbeider = ''; let eiendommer = null; let eiendomHenter = false;
  const dekkeCache = new Map(); let startKlikk = null; let raster = null; let simKlikk = null;
  // Flatene som rasterbilde over kommunen (raskt å tegne også med titusenvis av flater).
  const rasterFor = (d) => { if (raster?.d !== d) { const g = K.rutenettFor(d.kommune.geometri); raster = { d, g, fIdx: K.rasteriserFlater(g, d.flater, indeks(d)) }; } return raster; };
  const RGB = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const el = () => document.getElementById('komSim');
  const p = () => ({ ...SIM.standard(type), ...(param[type] || {}) });
  const indeks = (d) => { if (idxFor !== d) { idx = K.lagIndeks(d.flater); idxFor = d; } return idx; };
  const feltFor = () => (romlig && vaerData && type !== 'bille' ? (feltType === type ? felt : (felt = K.lagFelt(type, vaerData.punkter), feltType = type, felt)) : null);

  function beregn() {
    const d = hentData(); if (!d || type === 'brann') return null;
    const n = JSON.stringify([type, p(), d.flater.length, d.hentet, !!feltFor(), vaerData?.hentet]);
    if (n !== resNokkel) { res = K.simulerKommune(d, type, p(), { iAar, felt: feltFor(), idx: indeks(d), inn: innstillinger() }); kurve = K.kurveKommune(res, { inn: innstillinger() }); resNokkel = n; eiendommer = null; }
    return res;
  }

  // ---------- kart
  function tegnKart() {
    lag.clearLayers(); const d = hentData(); if (!aapen || !d) return;
    L.geoJSON(d.kommune.geometri, { style: { color: '#1b1c19', weight: 2, fill: false }, interactive: false, renderer }).addTo(lag);
    if (type === 'brann') {
      if (brann?.tid) {
        const g = brann.grid; const c = document.createElement('canvas'); c.width = g.nx; c.height = g.ny; const x = c.getContext('2d'); const img = x.createImageData(g.nx, g.ny); const T = brann.param.timer * 60;
        for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
          const t = brann.tid[j * g.nx + i]; const o = ((g.ny - 1 - j) * g.nx + i) * 4;
          if (t <= T) { const f = K.bandFor(t)[1]; img.data[o] = parseInt(f.slice(1, 3), 16); img.data[o + 1] = parseInt(f.slice(3, 5), 16); img.data[o + 2] = parseInt(f.slice(5, 7), 16); img.data[o + 3] = 200; }
          else if (brann.dekke && [5, 6, 7].includes(brann.dekke[j * g.nx + i])) { img.data[o] = 60; img.data[o + 1] = 90; img.data[o + 2] = 140; img.data[o + 3] = 40; }
        }
        x.putImageData(img, 0, 0);
        L.imageOverlay(c.toDataURL(), [[g.lat0, g.lon0], [g.lat0 + g.ny * g.dlat, g.lon0 + g.nx * g.dlon]], { opacity: 0.85, interactive: false, className: 'ksim-brann' }).addTo(lag);
        for (const t of brann.truet.slice(0, 40)) L.circleMarker([t.senter[1], t.senter[0]], { radius: 7, color: '#fff', weight: 2, fillColor: '#5b2bd6', fillOpacity: 1 }).bindTooltip(`🏠 Bebyggelse (${fmt(t.daa, 1)} daa) – brannen er her etter ca. ${tidTekst(t.minutter)}`).addTo(lag);
      }
      if (start) L.marker([start[1], start[0]], { icon: L.divIcon({ className: 'ksim-start', html: '🔥', iconSize: [26, 26], iconAnchor: [13, 13] }) }).bindTooltip('Brannen starter her').addTo(lag);
    } else {
      const r = beregn(); if (r) {
        const { g, fIdx } = rasterFor(d); const c = document.createElement('canvas'); c.width = g.nx; c.height = g.ny; const x = c.getContext('2d'); const img = x.createImageData(g.nx, g.ny);
        const farger = [0.02, 0.1, 0.25, 0.5].map((t) => RGB(skala(t)));
        for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
          const fi = fIdx[j * g.nx + i]; if (fi < 0) continue; const a = r.andel[fi]; const o = ((g.ny - 1 - j) * g.nx + i) * 4;
          if (a < 0.02) { img.data[o] = 120; img.data[o + 1] = 140; img.data[o + 2] = 120; img.data[o + 3] = 45; continue; }
          const f = farger[a >= 0.5 ? 3 : a >= 0.25 ? 2 : a >= 0.1 ? 1 : 0]; img.data[o] = f[0]; img.data[o + 1] = f[1]; img.data[o + 2] = f[2]; img.data[o + 3] = 200;
        }
        x.putImageData(img, 0, 0);
        L.imageOverlay(c.toDataURL(), [[g.lat0, g.lon0], [g.lat0 + g.ny * g.dlat, g.lon0 + g.nx * g.dlon]], { opacity: 0.85, interactive: false, className: 'ksim-brann' }).addTo(lag);
        r.omrader.slice(0, 10).forEach((o, n) => L.marker([o.senter[1], o.senter[0]], { icon: L.divIcon({ className: 'ksim-omr', html: String(n + 1), iconSize: [22, 22], iconAnchor: [11, 11] }) }).bindTooltip(`Område ${n + 1}: ${fmt(o.kr)} kr, ${fmt(o.skadetDaa)} daa skadet`).addTo(lag));
      }
    }
    legend();
    // Værpunkter (prognosen varierer over kommunen)
    const fl = feltFor(); if (fl) for (const pt of fl.punkter) {
      const q = pt.param; const tekst = type === 'storm' ? `${q.kast} m/s` : type === 'sno' ? `${q.nysno} cm` : type === 'brann' ? `${q.vind} m/s` : type === 'torke' ? `${q.dager} d` : '';
      const pil = q.retning != null ? `<span style="display:inline-block;transform:rotate(${(q.retning + 180) % 360}deg)">↑</span> ` : '';
      L.marker([pt.pos[1], pt.pos[0]], { icon: L.divIcon({ className: 'ksim-vaer', html: `${pil}${tekst}`, iconSize: [64, 20], iconAnchor: [32, 10] }), interactive: false }).addTo(lag);
    }
  }

  // Tegnforklaring i kartet mens simuleringen er åpen.
  function legend() {
    const el2 = document.getElementById('kartLegend'); if (!el2 || !aapen) return;
    const def = SIM.TYPER[type];
    const rader = type === 'brann' ? [...K.TIDSBAND.map(([, f, n]) => `<div><i style="background:${f}"></i>Brannen er her etter ${esc(n)}</div>`), '<div><i style="background:#5b2bd6;border-radius:50%"></i>Bebyggelse som nås</div>', '<div><i style="background:#3c5a8c;opacity:.4"></i>Vann, bebyggelse og vei (stopper brannen)</div>']
      : [...TREKK.map(([n, f]) => `<div><i style="background:${f}"></i>${esc(n)} skadet</div>`), '<div><i style="background:#78a078;opacity:.5"></i>Lite eller ingen skade</div>', '<div><i class="ksim-omr-lite">1</i>Mest utsatte områder</div>'];
    el2.innerHTML = `<div class="legend-innhold"><b>${def.ikon} ${esc(def.navn)}</b>${rader.join('')}</div>`;
  }

  // ---------- brann
  async function kjorBrann() {
    const d = hentData(); if (!d || !start) return;
    const pp = p(); const fl = feltFor(); const lok = K.lokalParam('brann', pp, fl, start);
    const g = K.lagRutenett(start, K.brannRadius(lok)); const nokkel = [g.lon0, g.lat0, g.nx, g.celleM].map((v) => v.toFixed(5)).join(',');
    let dekke = dekkeCache.get(nokkel);
    if (!dekke) {
      dekke = new Uint8Array(g.nx * g.ny); const biter = K.ar5Biter(g); let n = 0;
      arbeider = `Henter arealtyper (AR5) for brannområdet: 0 av ${biter.length} …`; tegn();
      try {
        for (const b of biter) { K.dekkeFraBilde(g, dekke, b, await dekodPng(b.url)); arbeider = `Henter arealtyper (AR5): ${++n} av ${biter.length} …`; tegn(); }
        dekkeCache.set(nokkel, dekke);
      } catch (e) { melding(`Fikk ikke arealtyper fra NIBIO (${e.message}). Regner uten myr, vann og bebyggelse.`, 7000); dekke = null; }
    }
    arbeider = 'Regner brannspredning …'; tegn(); await new Promise((r) => setTimeout(r, 20));
    brann = K.brannKommune(d, pp, { start, iAar, idx: indeks(d), dekke, grid: g, inn: innstillinger(), felt: fl });
    arbeider = ''; eiendommer = null;
    if (brann.feil) melding(brann.feil, 6000);
    tegn();
    // Zoom til brannområdet
    if (brann.tid) { const g2 = brann.grid; let a = Infinity; let b2 = -Infinity; let c2 = Infinity; let e2 = -Infinity; const T = brann.param.timer * 60;
      for (let j = 0; j < g2.ny; j++) for (let i = 0; i < g2.nx; i++) if (brann.tid[j * g2.nx + i] <= T) { a = Math.min(a, i); b2 = Math.max(b2, i); c2 = Math.min(c2, j); e2 = Math.max(e2, j); }
      if (a <= b2) kart.fitBounds([[g2.lat0 + (c2 - 4) * g2.dlat, g2.lon0 + (a - 4) * g2.dlon], [g2.lat0 + (e2 + 5) * g2.dlat, g2.lon0 + (b2 + 5) * g2.dlon]], { maxZoom: 15 }); }
  }

  // ---------- eiendommer i de mest utsatte områdene / brannområdet
  async function finnEiendommer() {
    const d = hentData(); if (!d) return; eiendomHenter = true; tegn();
    const pkt = type === 'brann' ? (brann?.flater || []).slice(0, 40).map((f) => ({ pos: f.senter, kr: f.kr }))
      : (() => { const r = beregn(); const ut = []; for (let i = 0; i < d.flater.length; i++) if (r.andel[i] >= 0.1) ut.push({ pos: d.flater[i].senter, kr: r.kr[i] }); return ut.sort((a, b) => b.kr - a.kr).slice(0, 40); })();
    const sett = new Map(); let i = 0;
    await Promise.all(Array.from({ length: 4 }, async () => { while (i < pkt.length) { const x = pkt[i++]; try { for (const e of await eiendomIPunkt(x.pos)) { const s = sett.get(e.tekst) || { ...e, kr: 0 }; s.kr += x.kr; sett.set(e.tekst, s); } } catch { /* hopp over */ } } }));
    eiendommer = [...sett.values()].sort((a, b) => b.kr - a.kr); eiendomHenter = false; tegn();
  }

  // ---------- værprognose for hele kommunen
  async function hentVaerFelt() {
    const d = hentData(); if (!d) return;
    arbeider = 'Henter værprognose for kommunen …'; tegn();
    try {
      vaerData = await K.hentVaerFelt(d.kommune.geometri, { framdrift: (a) => { arbeider = `Henter værprognose for kommunen: ${Math.round(a * 100)} % …`; const e = el()?.querySelector('.ksim-arbeider'); if (e) e.textContent = `⏳ ${arbeider}`; } });
      feltType = null; romlig = true; const fl = feltFor();
      if (fl) { param[type] = { ...(param[type] || {}), ...fl.scenario }; melding(`Værprognosen er hentet i ${vaerData.punkter.length} punkter. Scenarioet bruker det høyeste, og hvert område får sin lokale verdi.`, 6000); }
    } catch (e) { melding(`Klarte ikke å hente værprognosen: ${e.message}`, 6000); }
    arbeider = ''; resNokkel = ''; tegn(); if (type === 'brann' && start) kjorBrann();
  }

  // ---------- rapport (PDF)
  function rapport() {
    const d = hentData(); const def = SIM.TYPER[type]; const pp = p(); const b = [];
    b.push({ type: 'h1', tekst: `Skadesimulering – ${d.kommune.navn} kommune` });
    b.push({ type: 'liten', tekst: `${def.navn}. Forenklede anslag for planlegging og beredskap, ikke prognoser. Skogdata fra SR16 (NIBIO), skrevet fram til ${iAar}. Laget ${new Date().toLocaleDateString('nb-NO')}.` });
    b.push({ type: 'h2', tekst: 'Scenario' });
    for (const v of def.variabler) if (!v.bestand) b.push({ type: 'kv', etikett: v.navn, verdi: v.valg ? v.valg.find(([id]) => id === pp[v.id])?.[1] : v.retning ? `${SIM.himmel(pp[v.id])} (${pp[v.id]}°)` : `${fmt(pp[v.id])} ${v.enhet}` });
    if (feltFor()) b.push({ type: 'kv', etikett: 'Vær', verdi: `Værprognose fra Meteorologisk institutt i ${vaerData.punkter.length} punkter, interpolert over kommunen` });
    if (type === 'brann' && brann?.sum) {
      const s = brann.sum; b.push({ type: 'h2', tekst: 'Resultat' });
      b.push({ type: 'kv', etikett: 'Startpunkt', verdi: `${start[1].toFixed(5)} N, ${start[0].toFixed(5)} Ø` });
      b.push({ type: 'kv', etikett: 'Brent areal', verdi: `${fmt(s.daa)} daa, herav ${fmt(s.skogDaa)} daa skog` }); b.push({ type: 'kv', etikett: 'Berørt volum', verdi: `${fmt(s.m3)} m³` }); b.push({ type: 'kv', etikett: 'Anslått verditap', verdi: `${fmt(s.kr)} kr` });
      b.push({ type: 'kv', etikett: 'Bebyggelse brannen når', verdi: `${s.truetOmrader} områder, ${fmt(s.truetDaa, 1)} daa` });
      b.push({ type: 'h2', tekst: 'Brent areal over tid' }); for (const k of brann.kurve) b.push({ type: 'kv', etikett: `${fmt(k.h, 1)} timer`, verdi: `${fmt(k.daa)} daa` });
      if (brann.truet.length) { b.push({ type: 'h2', tekst: 'Bebyggelse brannen når fram til' }); brann.truet.slice(0, 25).forEach((t) => b.push({ type: 'kv', etikett: `Etter ca. ${tidTekst(t.minutter)}`, verdi: `${t.senter[1].toFixed(5)} N, ${t.senter[0].toFixed(5)} Ø (${fmt(t.daa, 1)} daa bebygd)` })); }
    } else if (res) {
      const s = res.sum; b.push({ type: 'h2', tekst: 'Resultat for kommunen' });
      b.push({ type: 'kv', etikett: 'Skogflater rammet', verdi: `${fmt(s.flater)} flater, ${fmt(s.daa)} daa` }); b.push({ type: 'kv', etikett: 'Skadet areal', verdi: `${fmt(s.skadetDaa)} daa` });
      if (type !== 'torke') b.push({ type: 'kv', etikett: 'Berørt volum', verdi: `${fmt(s.m3)} m³` }); b.push({ type: 'kv', etikett: type === 'torke' ? 'Suppleringsplanting' : 'Anslått verditap', verdi: `${fmt(s.kr)} kr` });
      b.push({ type: 'h2', tekst: 'Fordelt på treslag' }); for (const [t, x] of Object.entries(res.perTreslag)) b.push({ type: 'kv', etikett: TRESLAG[t] || t, verdi: `${fmt(x.skadetDaa)} daa skadet, ${fmt(x.m3)} m³, ${fmt(x.kr)} kr` });
      b.push({ type: 'h2', tekst: 'Mest utsatte områder (2 × 2 km)' }); res.omrader.slice(0, 10).forEach((o, i) => b.push({ type: 'kv', etikett: `${i + 1}. ${o.senter[1].toFixed(4)} N, ${o.senter[0].toFixed(4)} Ø`, verdi: `${fmt(o.skadetDaa)} daa skadet, ${fmt(o.m3)} m³, ${fmt(o.kr)} kr` }));
      b.push({ type: 'h2', tekst: 'Kurve' }); for (const k of kurve.filter((_, i) => i % 2 === 0)) b.push({ type: 'kv', etikett: `${SIM.TYPER[type].sensitivitet.navn}: ${k.x}`, verdi: `${fmt(k.daa)} daa skadet, ${fmt(k.kr)} kr` });
    }
    if (eiendommer?.length) { b.push({ type: 'h2', tekst: 'Eiendommer med størst anslått tap (gnr/bnr)' }); eiendommer.slice(0, 40).forEach((e) => b.push({ type: 'kv', etikett: `${e.kommunenr} ${e.tekst}`, verdi: `${fmt(e.kr)} kr` })); }
    b.push({ type: 'h2', tekst: 'Metode og begrensninger' }); b.push({ type: 'liten', tekst: 'Storm: kritisk vindkast per flate (trehøyde, treslag, kant mot vinden, mark). Snø: snølast i kronene mot kritisk last. Brann: kanadisk FBP-system med spredning på rutenett, myr, vann, bebyggelse og vei fra AR5 (NIBIO). Granbarkbille og tørke: værfaktorer mot grunnrisiko. Volum og verdi fra SR16 og prisene i innstillingene. Terreng, slokking og lokale forhold er ikke med.' });
    const fil = new File([lagPdf(b, { tittel: `Skadesimulering ${d.kommune.navn}`, bunntekst: signatur() })], `skadesimulering-${d.kommune.navn.replace(/\W+/g, '-').toLowerCase()}-${type}.pdf`, { type: 'application/pdf' });
    const url = URL.createObjectURL(fil); const a = document.createElement('a'); a.href = url; a.download = fil.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  // ---------- panel
  function variabel(v, pp) {
    if (v.bestand) return `<label>Startpunkt for brannen<span class="sim-rad"><span class="hint" style="flex:1">${start ? `${start[1].toFixed(4)} N, ${start[0].toFixed(4)} Ø` : 'Ikke valgt'}</span><button type="button" class="knapp liten ${start ? '' : 'primar'}" data-ks="velg-start">📍 Velg i kartet</button></span></label>`;
    const lokal = feltFor() && ['kast', 'nysno', 'vind', 'dager', 'retning', 'temp', 'tempMaks'].includes(v.id);
    if (v.valg) return `<label>${esc(v.navn)}<select data-ks-v="${v.id}">${v.valg.map(([id, n]) => `<option value="${id}" ${pp[v.id] === id ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
    if (v.retning && lokal) return `<label>${esc(v.navn)} <b class="sim-verdi">lokal fra prognosen</b><input type="range" disabled></label>`;
    return `<label>${esc(v.navn)} <b class="sim-verdi">${v.retning ? `${esc(SIM.himmel(pp[v.id]))} (${pp[v.id]}°)` : `${fmt(pp[v.id])} ${esc(v.enhet)}`}${lokal ? ' <small>(høyeste – lokalt skalert)</small>' : ''}</b><input type="range" data-ks-v="${v.id}" min="${v.min}" max="${v.maks}" step="${v.steg}" value="${pp[v.id]}"></label>`;
  }
  function html() {
    const d = hentData(); if (!d) return '';
    if (!aapen) return `<div class="detalj-topp"><h3>🧪 Skadesimulering for kommunen</h3><button type="button" class="knapp primar" data-ks="aapne">Åpne simulering</button></div><p class="hint">Simuler storm, snøbrekk, skogbrann, granbarkbille og tørke på alle ${fmt(d.flater.length)} skogflatene i ${esc(d.kommune.navn)} – med værprognose som varierer over kommunen, og brannspredning med myr, vann og bebyggelse.</p>`;
    const def = SIM.TYPER[type]; const pp = p();
    const r = type === 'brann' ? null : beregn(); const s = type === 'brann' ? brann?.sum : r?.sum;
    return `<div class="detalj-topp"><h3>🧪 Skadesimulering – ${esc(d.kommune.navn)}</h3><button type="button" class="knapp liten" data-ks="lukk">Lukk simulering</button></div>
      <p class="hint">Forenklede anslag for planlegging og beredskap på ${fmt(d.flater.length)} skogflater fra SR16, skrevet fram til ${iAar}. Ikke prognoser.</p>
      <div class="sim-typer" role="tablist">${Object.entries(SIM.TYPER).map(([id, x]) => `<button type="button" data-ks-type="${id}" class="${id === type ? 'aktiv' : ''}">${x.ikon} ${esc(x.navn)}</button>`).join('')}</div>
      <div class="sim-forslag"><span class="hint">Scenario</span>${def.forslag.map(([n], i) => `<button type="button" class="knapp liten" data-ks-forslag="${i}">${esc(n)}</button>`).join('')}${type !== 'bille' ? `<button type="button" class="knapp liten primar" data-ks="vaer" ${arbeider ? 'disabled' : ''}>🌦 Værprognose for hele kommunen</button>` : ''}
        ${vaerData && type !== 'bille' ? `<label class="avkrysning"><input type="checkbox" data-ks="romlig" ${romlig ? 'checked' : ''}> Været varierer over kommunen (${vaerData.punkter.length} punkter)</label>` : ''}</div>
      <div class="skjema to-kol sim-var">${def.variabler.map((v) => variabel(v, pp)).join('')}</div>
      ${velgStart ? '<p class="sf-varsel">📍 Trykk i kartet der brannen starter.</p>' : ''}
      ${arbeider ? `<p class="hs-arbeider ksim-arbeider">⏳ ${esc(arbeider)}</p>` : ''}
      ${type === 'brann' && !brann && !arbeider ? '<p class="hint">Velg startpunkt i kartet for å simulere brannen.</p>' : ''}
      ${type === 'brann' && brann?.feil ? `<p class="sf-varsel">${esc(brann.feil)}</p>` : ''}
      ${s ? `<div class="kpi-rad sim-kpi">
        ${type === 'brann' ? `<div class="kpi"><div class="verdi">${fmt(s.daa)} daa</div><div class="etikett">brent areal</div><div class="under">${fmt(s.skogDaa)} daa skog etter ${pp.timer} t</div></div>
          <div class="kpi"><div class="verdi">${fmt(s.truetOmrader)}</div><div class="etikett">bebygde områder nås</div><div class="under">${fmt(s.truetDaa, 1)} daa bebygd</div></div>`
          : `<div class="kpi"><div class="verdi">${fmt(s.flater)}</div><div class="etikett">skogflater rammet</div><div class="under">${fmt(s.daa)} daa berørt</div></div>
          <div class="kpi"><div class="verdi">${fmt(s.skadetDaa)} daa</div><div class="etikett">skadet areal</div></div>`}
        ${type === 'torke' ? '' : `<div class="kpi"><div class="verdi">${fmt(s.m3)} m³</div><div class="etikett">berørt volum</div></div>`}
        <div class="kpi"><div class="verdi">${fmt(s.kr)} kr</div><div class="etikett">${type === 'torke' ? 'suppleringsplanting' : 'anslått verditap'}</div></div></div>` : ''}
      ${type === 'brann' && brann?.sum ? `<p class="hint">Spredningsindeks (ISI) ${fmt(brann.sum.isi, 1)} · brannen blir ca. ${fmt(brann.sum.lb, 1)} ganger så lang som bred · rutenett ${fmt(brann.grid.celleM)} m · ${brann.dekke ? 'myr, vann, bebyggelse og vei fra AR5' : 'uten arealtyper'}.</p>
        <p class="sim-trekk">${K.TIDSBAND.map(([, f, n]) => `<span><i style="background:${f}"></i>${esc(n)}</span>`).join('')}<span><i style="background:#5b2bd6;border-radius:50%"></i>bebyggelse som nås</span></p>
        <h4 class="undertittel">Brent areal over tid (daa)</h4><div id="ksimKurve" class="sim-kurve"></div>
        ${brann.truet.length ? `<h4 class="undertittel">Bebyggelse brannen når fram til</h4><div class="tabell"><table class="sf-tabell"><thead><tr><th>Når</th><th class="t">Bebygd areal</th><th>Posisjon</th></tr></thead><tbody>${brann.truet.slice(0, 15).map((t) => `<tr data-ks-zoom="${t.senter.join(',')}"><td>${tidTekst(t.minutter)}</td><td class="t">${fmt(t.daa, 1)} daa</td><td><a href="#">${t.senter[1].toFixed(4)} N, ${t.senter[0].toFixed(4)} Ø</a></td></tr>`).join('')}</tbody></table></div>` : '<p class="hint">Brannen når ikke bebyggelse innen tiden som er valgt.</p>'}` : ''}
      ${r ? `<p class="sim-trekk">${TREKK.map(([n, f]) => `<span><i style="background:${f}"></i>${esc(n)}</span>`).join('')}<span><i class="ksim-omr-lite">1</i>mest utsatte områder</span></p>
        <h4 class="undertittel">Omfang etter ${esc(def.sensitivitet.navn.charAt(0).toLowerCase() + def.sensitivitet.navn.slice(1))}</h4><div id="ksimKurve" class="sim-kurve"></div>
        <div class="sim-kol"><div><h4 class="undertittel">Fordelt på treslag</h4><table class="sf-tabell"><thead><tr><th>Treslag</th><th class="t">Skadet daa</th>${type === 'torke' ? '' : '<th class="t">m³</th>'}<th class="t">kr</th></tr></thead><tbody>${Object.entries(r.perTreslag).map(([t, x]) => `<tr><td>${TRESLAG[t] || t}</td><td class="t">${fmt(x.skadetDaa)}</td>${type === 'torke' ? '' : `<td class="t">${fmt(x.m3)}</td>`}<td class="t">${fmt(x.kr)}</td></tr>`).join('')}</tbody></table></div>
          <div><h4 class="undertittel">Mest utsatte områder (2 × 2 km)</h4><ol class="ksim-omrader">${r.omrader.slice(0, 10).map((o) => `<li data-ks-zoom="${o.senter.join(',')}"><a href="#">${fmt(o.kr)} kr</a> <span class="hint">${fmt(o.skadetDaa)} daa skadet${o.store >= 20 ? ` · ${fmt(o.store)} daa med over 25 % skade` : ''}</span></li>`).join('')}</ol></div></div>` : ''}
      ${(r || brann?.flater?.length) ? `<h4 class="undertittel">Eiendommer</h4>${eiendommer ? (eiendommer.length ? `<p class="hint">Eiendommer med størst anslått tap (fra de ${type === 'brann' ? '40 mest brente' : '40 hardest rammede'} skogflatene):</p><div class="ksim-eiendommer">${eiendommer.slice(0, 30).map((e) => `<span class="pille" style="--farge:var(--accent)">${esc(e.tekst)} · ${fmt(e.kr)} kr</span>`).join('')}</div>` : '<p class="hint">Fant ingen eiendommer.</p>') : `<button type="button" class="knapp liten" data-ks="eiendommer" ${eiendomHenter ? 'disabled' : ''}>${eiendomHenter ? 'Slår opp i matrikkelen …' : 'Finn berørte eiendommer (gnr/bnr)'}</button>`}` : ''}
      <div class="knapperad"><button type="button" class="knapp" data-ks="pdf" ${s ? '' : 'disabled'}>⬇ Rapport (PDF)</button></div>
      <p class="hint"><span>${esc(def.tapTekst)}</span> <span>Klikk en flate i kartet for detaljer. Simuleringen bruker de samme modellene som Skogbrand › Simulering for eiendommen.</span></p>`;
  }
  function tegn() {
    const e = el(); if (!e) return; e.innerHTML = html(); tegnKart();
    const k = document.getElementById('ksimKurve'); if (!k) return;
    if (type === 'brann' && brann?.kurve) linje(k, { x: brann.kurve.map((x) => `${fmt(x.h, 1)} t`), serier: [{ navn: 'Brent areal', farge: '#e0442f', verdier: brann.kurve.map((x) => x.daa) }], enhet: 'daa', hoyde: 170 });
    else if (kurve) linje(k, { x: kurve.map((x) => x.x), serier: [{ navn: type === 'torke' ? 'Suppleringsplanting (mill. kr)' : 'Verditap (mill. kr)', farge: '#e0442f', verdier: kurve.map((x) => Math.round(x.kr / 1e5) / 10) }, { navn: 'Skadet areal (1000 daa)', farge: '#2a78d6', verdier: kurve.map((x) => Math.round(x.daa / 100) / 10) }], hoyde: 170, markerX: p()[SIM.TYPER[type].sensitivitet.id] });
  }

  // Klikk i kartet viser flaten med simulert skade (ikke mens startpunkt for brann velges).
  function kobleKlikk(paa) {
    if (simKlikk) { kart.off('click', simKlikk); simKlikk = null; } if (!paa) return;
    simKlikk = (ev) => {
      if (velgStart || type === 'brann') return; const d = hentData(); const r = beregn(); if (!d || !r) return;
      const f = indeks(d).finnPunkt([ev.latlng.lng, ev.latlng.lat]); if (!f) return; const i = d.flater.indexOf(f);
      const x = K.flateInfo(f, iAar);
      L.popup().setLatLng(ev.latlng).setContent(`<b>${TRESLAG[f.treslag] || ''} · ${fmt(f.areal, 1)} daa</b><br>${Math.round(x.st.alder)} år, ${fmt(x.h, 0)} m, ${fmt(x.st.volumDaa, 1)} m³/daa${x.anslag ? ' (framskrevet)' : ''}<br><b>${Math.round(r.andel[i] * 100)} % skadet</b> · ${fmt(r.m3[i])} m³ · ${fmt(r.kr[i])} kr`).openOn(kart);
    };
    kart.on('click', simKlikk);
  }
  function klikk(e) {
    const t = e.target;
    const ty = t.closest('[data-ks-type]'); if (ty) { type = ty.dataset.ksType; tegn(); return true; }
    const fo = t.closest('[data-ks-forslag]'); if (fo) { const [, v] = SIM.TYPER[type].forslag[Number(fo.dataset.ksForslag)]; param[type] = { ...SIM.standard(type), ...v }; tegn(); if (type === 'brann' && start) kjorBrann(); return true; }
    const z = t.closest('[data-ks-zoom]'); if (z) { e.preventDefault(); const [lon, lat] = z.dataset.ksZoom.split(',').map(Number); kart.setView([lat, lon], 14); return true; }
    const k = t.closest('[data-ks]')?.dataset.ks; if (!k) return false;
    if (k === 'aapne') { aapen = true; visVanlig(false); lag.addTo(kart); kobleKlikk(true); tegn(); return true; }
    if (k === 'lukk') { aapen = false; lag.remove(); kobleKlikk(false); visVanlig(true); tegn(); return true; }
    if (k === 'vaer') { hentVaerFelt(); return true; }
    if (k === 'romlig') { romlig = t.checked; feltType = null; resNokkel = ''; tegn(); if (type === 'brann' && start) kjorBrann(); return true; }
    if (k === 'eiendommer') { finnEiendommer(); return true; }
    if (k === 'pdf') { rapport(); return true; }
    if (k === 'velg-start') {
      velgStart = true; kart.getContainer().style.cursor = 'crosshair'; tegn();
      if (startKlikk) kart.off('click', startKlikk);
      startKlikk = (ev) => { kart.off('click', startKlikk); startKlikk = null; velgStart = false; kart.getContainer().style.cursor = ''; start = [ev.latlng.lng, ev.latlng.lat]; kjorBrann(); };
      kart.on('click', startKlikk);
      return true;
    }
    return true;
  }
  function endring(e) {
    const v = e.target.closest('[data-ks-v]'); if (!v) return false;
    const def = SIM.TYPER[type].variabler.find((x) => x.id === v.dataset.ksV);
    param[type] = { ...(param[type] || {}), [v.dataset.ksV]: def?.valg ? v.value : Number(v.value) };
    tegn(); if (type === 'brann' && start) kjorBrann(); return true;
  }
  function input(e) {
    const v = e.target.closest('input[type="range"][data-ks-v]'); if (!v) return false; const def = SIM.TYPER[type].variabler.find((x) => x.id === v.dataset.ksV); const b = v.closest('label')?.querySelector('.sim-verdi');
    if (b && def) b.textContent = def.retning ? `${SIM.himmel(Number(v.value))} (${v.value}°)` : `${fmt(Number(v.value))} ${def.enhet}`; return true;
  }
  // Åpne simuleringen med en bestemt skadetype og værprognosen for kommunen (fra skadevarselet).
  async function aapneMed(t, ekstra = {}) {
    type = t; param[t] = { ...(param[t] || {}), ...ekstra };
    if (!aapen) { aapen = true; visVanlig(false); lag.addTo(kart); kobleKlikk(true); }
    tegn(); el()?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    if (t !== 'bille') await hentVaerFelt();
  }
  return {
    tegn, klikk, endring, input, legend, aapneMed,
    nyData() { res = null; resNokkel = ''; brann = null; start = null; vaerData = null; felt = null; eiendommer = null; raster = null; dekkeCache.clear(); if (aapen) { aapen = false; lag.remove(); kobleKlikk(false); } tegn(); },
    skjul() { lag.remove(); kobleKlikk(false); if (startKlikk) { kart.off('click', startKlikk); startKlikk = null; } if (velgStart) { velgStart = false; kart.getContainer().style.cursor = ''; } },
    vis() { if (aapen) { lag.addTo(kart); visVanlig(false); kobleKlikk(true); tegnKart(); } },
    aapen: () => aapen,
  };
}
