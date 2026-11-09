// Tiltak › Oppdrag › 🛤 Driftsveg: forslag til basveg for lassbærer fra hogstflatene til velteplass ved bilvei, med
// minst mulig kjørespor og terrenginngrep og mest mulig tømmer innen rekkevidde. Henter grunnlaget (høyder, markfuktighet,
// kulturminner, naturtyper, veier og traktorveier), kjører optimaliseringen i driftsveg.js og viser forslaget i kartet.
// Skogeieren beholder eller sletter forslaget; et beholdt forslag kommer med på arbeidsordren og kan lastes ned som GPX.
import * as DV from './driftsveg.js';
import { linjer } from './oppdrag.js';
import { VEIKLASSER } from './veier.js';

const HOGST = ['sluttavvirkning', 'tynning', 'lukkethogst'];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tall = (v) => (v == null ? '–' : Number(v).toLocaleString('nb-NO'));
const lastNed = (navn, innhold, type) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([innhold], { type })); a.download = navn; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
const boksGeo = (geoms, buffer = 0.01) => { const p = []; const gaa = (c) => (typeof c[0] === 'number' ? p.push(c) : c.forEach(gaa)); geoms.forEach((g) => gaa(g.coordinates)); return [Math.min(...p.map((q) => q[0])) - buffer * 2, Math.min(...p.map((q) => q[1])) - buffer, Math.max(...p.map((q) => q[0])) + buffer * 2, Math.max(...p.map((q) => q[1])) + buffer]; };
const firkant = ([a, b, c, d]) => ({ type: 'Polygon', coordinates: [[[a, b], [c, b], [c, d], [a, d], [a, b]]] });

export function lagDriftsvegUi({ hentPlan, endret, melding, okonomi, visLag }) {
  const S = () => hentPlan();
  let henter = null; let dekning = DV.STANDARD.dekning; const hindre = new Map(); let vist = null;

  function html(o) {
    if (!HOGST.includes(o.type)) return '';
    const d = o.driftsveg;
    const hode = '<h4 class="undertittel" style="margin-top:0">🛤 Driftsveg</h4>';
    if (henter === o.id) return `<div class="kort dv">${hode}<p class="dv-framdrift" id="dvFramdrift">Henter grunnlag …</p><p class="hint">Høydedata, markfuktighet, kulturminner, naturtyper og veier hentes for området. Det kan ta et halvt minutt.</p></div>`;
    const valg = `<label class="dv-valg">Lengste stikkveg fra basvegen <select data-dv-dekning>${[30, 50, 80].map((m) => `<option value="${m}" ${m === dekning ? 'selected' : ''}>${m} m${m === 50 ? ' (anbefalt)' : m === 30 ? ' (tett nett, tynning)' : ' (få spor, lang kran/stikkveg)'}</option>`).join('')}</select></label>`;
    if (!d) {
      return `<div class="kort dv">${hode}<p class="hint" style="margin-top:0">Lag et forslag til hvor basvegen for lassbæreren bør gå: fra hogstflatene til velteplass ved bilveien, med minst mulig kjørespor og inngrep i terrenget, og mest mulig tømmer innen rekkevidde. Forslaget unngår våt mark, bratt sideterreng, kulturminner og miljøfigurer, og bruker eksisterende traktorveier der det går.</p>
        ${valg}<div class="knapperad"><button type="button" class="knapp primar" data-dv="foreslaa">🛤 Foreslå driftsveg</button></div></div>`;
    }
    const s = d.stat; const r = d.rett;
    const beholdt = d.status === 'beholdt';
    return `<div class="kort dv ${beholdt ? 'beholdt' : ''}">${hode}
      <p style="margin-top:0"><span class="pille" style="--farge:${beholdt ? '#0ca30c' : '#e07b00'}">${beholdt ? 'Beholdt' : 'Forslag'}</span> laget ${esc(d.laget)} · stikkveg høyst ${esc(d.valg?.dekning)} m</p>
      <div class="dv-tall">
        <div><b>${tall(s.nyttSpor)} m</b><span>nytt kjørespor</span></div>
        <div><b>${tall(s.paaSpor)} m</b><span>på eksisterende traktorvei/sti</span></div>
        <div><b>${tall(s.dekketAndel)} %</b><span>av tømmeret innen ${esc(d.valg?.dekning)} m</span></div>
        <div><b>${tall(s.kranAndel)} %</b><span>rett fra sporet (kran 10 m)</span></div>
        <div><b>${tall(s.transport)} m</b><span>snitt kjøreavstand til velteplass</span></div>
        <div><b>${tall(s.vaat)} m</b><span>over fuktig mark</span></div>
        <div><b>${tall(s.maksSide)} %</b><span>største sidehelling</span></div>
        <div><b>${tall(s.maksStigning)} %</b><span>største stigning</span></div>
      </div>
      <p class="hint">${tall(s.grener)} grener · ca. ${tall(s.sporAreal)} m² sporareal (4 m bredde) · ${s.mPerM3 ?? '–'} m nytt spor per m³ · ${tall(d.velteplasser?.length)} velteplass${d.velteplasser?.length === 1 ? '' : 'er'} · rutenett ${s.celle} m${r ? ` · Til sammenligning: en rett linje til nærmeste vei er ${tall(r.lengde)} m, med ${tall(r.vaat)} m våt mark, ${tall(r.bratt)} m over 33 % og ${tall(r.sperret)} m gjennom kulturminner eller miljøfigurer` : ''}.</p>
      ${d.advarsler?.length ? `<div class="dv-advarsel">${d.advarsler.map((a) => `<p>⚠️ ${esc(a)}</p>`).join('')}</div>` : ''}
      <details><summary><b>Råd til utfører</b></summary><ul class="hint">${(d.rad || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>
      ${beholdt ? '' : valg}
      <div class="knapperad">
        <button type="button" class="knapp liten" data-dv="vis">Vis i kartet</button>
        ${beholdt ? '' : '<button type="button" class="knapp primar" data-dv="behold">✓ Behold forslaget</button>'}
        <button type="button" class="knapp liten" data-dv="foreslaa">↻ Nytt forslag</button>
        <button type="button" class="knapp liten" data-dv="gpx">⬇ GPX</button>
        <button type="button" class="knapp liten" data-dv="geojson">⬇ GeoJSON</button>
        <button type="button" class="knapp liten fare" data-dv="slett">Slett</button>
      </div></div>`;
  }

  // Kartlag: driftsvegen, velteplasser, og (rett etter beregning) hindrene den gikk utenom.
  function geojson(o) {
    const d = o.driftsveg; if (!d) return null;
    const f = [{ type: 'Feature', geometry: d.geometri, properties: { lag: 'driftsveg', status: d.status } }];
    for (const p of d.velteplasser || []) f.push({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { lag: 'velteplass' } });
    for (const h of hindre.get(o.id) || []) f.push({ type: 'Feature', geometry: h.geometri, properties: { lag: h.lag } });
    return { type: 'FeatureCollection', features: f };
  }
  function kart(o, { zoom = false } = {}) { const gj = o?.driftsveg ? geojson(o) : null; vist = gj ? o.id : null; visLag(gj, { zoom }); }
  function lukk() { if (vist) { vist = null; visLag(null); } }

  async function hentGrunnlag(o, framdrift) {
    const plan = S(); const ls = linjer(plan, o).filter((l) => l.tiltak.status !== 'utfort');
    const felt = ls.map(({ bestand: b, tiltak: t }) => ({ geo: t.geometri || b.geometri, m3: okonomi({ ...t, bestand: b }).m3 || 0, miljo: b.miljo })).filter((x) => x.geo && /Polygon/.test(x.geo.type) && !x.miljo);
    if (!felt.length) throw new Error('Oppdraget har ingen hogstflater med kartgeometri.');
    const advarsler = [];
    const bb = boksGeo(felt.map((x) => x.geo), 0.012);
    const register = plan.veier?.veier || [];
    const erBil = (v) => v.status !== 'planlagt' && (VEIKLASSER[v.klasse] || VEIKLASSER[0]).bilvei && v.geometri;
    let bilveier = register.filter(erBil).map((v) => v.geometri);
    let spor = [...register.filter((v) => v.geometri && !(VEIKLASSER[v.klasse] || VEIKLASSER[0]).bilvei), ...(plan.veier?.stier || []).filter((x) => x.geometri)].map((v) => v.geometri);
    const feltUtm = felt.map((x) => DV.tilUtm(x.geo));
    const naer = (liste) => { const v = DV.naermesteVei(DV.lagRutenett(feltUtm, [], { celle: 50 }).feltBoks, liste.map(DV.tilUtm)); return v && v.avstand <= 1500; };
    const V = await import('./veier.js');
    if (!naer(bilveier)) {
      framdrift('Henter bilveier fra NVDB …');
      try { const r = await V.hentNvdbVeier(firkant(bb), {}); bilveier = [...bilveier, ...r.veier.filter(erBil).map((v) => v.geometri)]; } catch { advarsler.push('Fikk ikke hentet veier fra NVDB.'); }
    }
    if (!spor.length) {
      framdrift('Henter traktorveier og stier fra Kartverket …');
      try { const r = await V.hentTraktorveierOgStier(firkant(bb), {}); spor = [...r.traktorveier, ...r.stier].map((v) => v.geometri); } catch { /* valgfritt */ }
    }
    const veierUtm = bilveier.map(DV.tilUtm);
    // Offentlige veger (NVDB): sporet kan ende der, men private veger foretrekkes (velteplass ved offentlig veg krever arbeidsvarsling).
    let offentligeUtm = [];
    try {
      const fb = DV.lagRutenett(feltUtm, [], { celle: 50 }).feltBoks; framdrift('Henter offentlige veger fra NVDB …');
      offentligeUtm = (await V.hentOffentligeVeier([fb[0] - 1500, fb[1] - 1500, fb[2] + 1500, fb[3] + 1500])).map((v) => DV.tilUtm(v.geometri));
    } catch { /* bare private veger */ }
    const g = DV.lagRutenett(feltUtm, [...veierUtm, ...offentligeUtm], { maksRuter: 8000 });
    framdrift(`Rutenett ${g.nx} × ${g.ny} ruter à ${g.d} m. Henter høydedata fra Kartverket …`);
    const { hentHoyder } = await import('./skog3d-omgivelser.js');
    let z = null;
    try {
      let sist = 0;
      const h = await hentHoyder(DV.punkterGeo(g), { parallelle: 8, framdrift: (a, b) => { const p = Math.round((a / b) * 100); if (p >= sist + 10) { sist = p; framdrift(`Henter høydedata fra Kartverket … ${p} %`); } } });
      if (h.filter(Number.isFinite).length > h.length * 0.6) z = h; else advarsler.push('Fikk ikke nok høydedata – helning er ikke tatt med.');
    } catch { advarsler.push('Fikk ikke høydedata – helning er ikke tatt med.'); }
    framdrift('Henter markfuktighet (NIBIO) …');
    let fukt = null;
    try { const M = await import('./markfukt.js'); fukt = await M.hent([g.x0 - g.d / 2, g.y0 - g.d / 2, g.x0 + (g.nx - 0.5) * g.d, g.y0 + (g.ny - 0.5) * g.d], { dekod: (u) => M.dekodPng(u), celle: g.d }); } catch { advarsler.push('Fikk ikke markfuktighetskartet – våt mark er ikke tatt med.'); }
    const bbGrid = (() => { const [a, b] = [DV.senter(g, 0), DV.senter(g, g.nx * g.ny - 1)]; const p = [a, b].map(([x, y]) => DV.tilGeo({ type: 'Point', coordinates: [x, y] }).coordinates); return [p[0][0], p[0][1], p[1][0], p[1][1]]; })();
    framdrift('Henter kulturminner (Riksantikvaren) …');
    let kultur = []; let kulturOk = true;
    try { const P = await import('./pefc-data.js'); kultur = (await P.hentKulturminner(bbGrid)).filter((k) => k.geometri); } catch { kulturOk = false; }
    framdrift('Henter naturtyper og arter (Miljødirektoratet) …');
    let natur = [];
    try { const N = await import('./naturdata.js'); const r = await N.hentForBoks(bbGrid, {}); natur = [...r.nin, ...r.art]; } catch { advarsler.push('Fikk ikke naturtyper og arter – de er ikke tatt med.'); }
    const miljo = plan.bestand.filter((b) => b.miljo && b.geometri && /Polygon/.test(b.geometri.type));
    hindre.set(o.id, [...kultur.map((k) => ({ geometri: k.geometri, lag: 'kulturminne' })), ...miljo.map((b) => ({ geometri: b.geometri, lag: 'miljo' })), ...natur.map((n) => ({ geometri: n.geometri, lag: 'hensyn' }))]);
    return {
      g, advarsler,
      grunnlag: {
        felt: feltUtm.map((geometri, i) => ({ geometri, m3: felt[i].m3 })), veier: veierUtm, offentlige: offentligeUtm, spor: spor.map(DV.tilUtm), z, fukt, kulturminner: kulturOk,
        sperret: [...kultur, ...miljo].map((x) => DV.tilUtm(x.geometri)), hensyn: natur.map((x) => DV.tilUtm(x.geometri)),
      },
    };
  }

  async function foreslaa(o, tegn) {
    if (henter) return; henter = o.id; tegn();
    const framdrift = (t) => { const el = document.getElementById('dvFramdrift'); if (el) el.textContent = t; };
    try {
      const { g, grunnlag, advarsler } = await hentGrunnlag(o, framdrift);
      framdrift('Beregner traseen …'); await new Promise((r) => setTimeout(r, 30));
      const f = DV.lagForslag(g, grunnlag, { dekning });
      if (f.feil) throw new Error(f.feil);
      f.advarsler = [...advarsler, ...f.advarsler];
      o.driftsveg = f; endret({ kart: false });
      melding(`Forslag til driftsveg: ${tall(f.stat.nyttSpor)} m nytt spor, ${f.stat.dekketAndel} % av tømmeret innen ${dekning} m. Behold eller slett forslaget.`);
      henter = null; tegn(); kart(o, { zoom: true });
    } catch (e) { henter = null; tegn(); melding(e.message || 'Klarte ikke å lage forslag.', 'feil'); }
  }

  function klikk(e, o, tegn) {
    const k = e.target.closest('[data-dv]'); if (!k) return false; const h = k.dataset.dv; const d = o.driftsveg;
    if (h === 'foreslaa') { foreslaa(o, tegn); return true; }
    if (!d) return true;
    if (h === 'vis') kart(o, { zoom: true });
    if (h === 'behold') { d.status = 'beholdt'; d.beholdt = new Date().toISOString().slice(0, 10); endret({ kart: false }); tegn(); kart(o); melding('Driftsvegen er beholdt og kommer med på arbeidsordren.'); }
    if (h === 'slett') { if (d.status === 'beholdt' && !confirm('Slette den beholdte driftsvegen?')) return true; delete o.driftsveg; hindre.delete(o.id); endret({ kart: false }); tegn(); lukk(); melding('Driftsvegen er slettet.'); }
    const navn = `driftsveg-${o.nr}`;
    if (h === 'gpx') lastNed(`${navn}.gpx`, DV.gpx(`Driftsveg ${o.nr}`, d.geometri, d.velteplasser), 'application/gpx+xml');
    if (h === 'geojson') lastNed(`${navn}.geojson`, JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: d.geometri, properties: { oppdrag: o.nr, status: d.status, ...d.stat } }, ...(d.velteplasser || []).map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { type: 'velteplass' } }))] }), 'application/geo+json');
    return true;
  }
  function endring(e) { if (e.target.matches('[data-dv-dekning]')) { dekning = Number(e.target.value) || DV.STANDARD.dekning; return true; } return false; }
  // Til arbeidsordren: beholdt driftsveg og velteplasser.
  const ekstra = (o) => (o.driftsveg?.status === 'beholdt' ? [{ geometri: o.driftsveg.geometri, farge: '#e07b00' }, ...(o.driftsveg.velteplasser || []).map((p) => ({ geometri: { type: 'Point', coordinates: p }, farge: '#2a78d6' }))] : []);
  return { html, klikk, endring, kart, lukk, ekstra };
}
