// Fanen «PEFC»: status for alle 30 kravpunkter, automatiske kontroller, klarering før hogst,
// miljøobjekter i kartet og innhenting av offentlige miljødata.
import {
  STANDARD, TEMA, KRAVPUNKTER, ALDERSTABELL, ROVFUGLER, OBJEKTTYPER, KLARERING, HOGSTFORMER, FORYNGELSE,
  tomPefc, kontroller, kravStatus, klareringStatus, periodeTekst, arealDaa,
} from './pefc.js';
import { KILDEREKKEFOLGE } from './datagrunnlag.js';
import { TILTAKSTYPER } from './model.js';
import { fmt } from './charts.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const opsj = (liste, valgt) => liste.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(valgt ?? '') ? 'selected' : ''}>${esc(t)}</option>`).join('');
const IAAR = new Date().getFullYear();
const STATUS = {
  avvik: { navn: 'Avvik', farge: 'var(--critical)' }, varsel: { navn: 'Må følges opp', farge: 'var(--warning)' },
  ok: { navn: 'Ivaretatt', farge: 'var(--good)' }, 'ikke-relevant': { navn: 'Ikke relevant', farge: 'var(--muted)' },
  'ikke-vurdert': { navn: 'Ikke vurdert', farge: 'var(--border-sterk)' }, info: { navn: 'Info', farge: 'var(--accent)' },
};

// Status for én datakilde ut fra når den ble hentet og hvor gamle dataene er.
export function kildeStatus(k, naa = Date.now()) {
  if (!k || !k.hentet) return { niva: 'mangler', tekst: 'Ikke hentet' };
  if (k.feil) return { niva: 'feil', tekst: 'Feil ved henting' };
  const dager = Math.floor((naa - new Date(k.hentet).getTime()) / 86400000);
  const niva = dager > 365 ? 'gammel' : dager > 90 ? 'bor' : 'fersk';
  return { niva, dager, tekst: dager === 0 ? 'Hentet i dag' : dager === 1 ? 'Hentet i går' : `Hentet for ${dager} dager siden` };
}
const NIVA = { fersk: { navn: 'Oppdatert', farge: 'var(--good)' }, bor: { navn: 'Bør oppdateres', farge: 'var(--warning)' }, gammel: { navn: 'Utdatert', farge: 'var(--critical)' }, mangler: { navn: 'Mangler', farge: 'var(--critical)' }, feil: { navn: 'Feil', farge: 'var(--critical)' }, manuell: { navn: 'Manuell', farge: 'var(--accent)' } };

export function initPefc({ kart, hentPlan, endret, melding, nyId, settKartKlikk, visBestand, hentData }) {
  const lag = L.layerGroup();
  let funn = []; let status = {};
  let valgtObjekt = null; let aapenKlarering = null; let tegner = null; let synlig = false;

  const P = () => {
    const S = hentPlan();
    if (!S.pefc) S.pefc = tomPefc();
    S.pefc.eiendom = { ...tomPefc().eiendom, ...S.pefc.eiendom };
    return S.pefc;
  };
  const beregn = () => { const S = hentPlan(); funn = kontroller(S, P(), { iAar: IAAR }); status = kravStatus(funn, P()); };
  const lagre = (kartOgsaa = false) => { endret({ kart: false }); beregn(); if (kartOgsaa) tegnKart(); tegn(); };

  // ---------- kart ----------
  function tegnKart() {
    lag.clearLayers();
    for (const o of P().objekter) {
      const t = OBJEKTTYPER[o.type]; if (!t || !o.geometri) continue;
      const valgt = o.id === valgtObjekt;
      if (o.type === 'rovfuglreir' && ROVFUGLER[o.art]) {
        const a = ROVFUGLER[o.art]; const ll = [o.geometri.coordinates[1], o.geometri.coordinates[0]];
        L.circle(ll, { radius: a.buffer, color: t.farge, weight: 1, dashArray: '2 5', fillOpacity: 0.04, interactive: false }).addTo(lag);
        if (a.hensyn) L.circle(ll, { radius: a.hensyn, color: t.farge, weight: 2, dashArray: '6 4', fillOpacity: 0.1, interactive: false }).addTo(lag);
      }
      const l = o.geometri.type === 'Point'
        ? L.circleMarker([o.geometri.coordinates[1], o.geometri.coordinates[0]], { radius: o.type === 'livslopstre' ? 5 : 7, color: '#fff', weight: 2, fillColor: t.farge, fillOpacity: 1 })
        : L.geoJSON(o.geometri, { style: { color: valgt ? '#ffd400' : t.farge, weight: valgt ? 4 : (/Line/.test(o.geometri.type) ? 3 : 1.5), fillColor: t.farge, fillOpacity: 0.18, dashArray: o.type === 'friluftsomrade' ? '4 4' : null } });
      l.bindTooltip(`${esc(t.navn)}: ${esc(o.navn || '')}`, { sticky: true });
      // Mens det tegnes, går klikk på eksisterende objekter til tegningen.
      l.on('click', (e) => { L.DomEvent.stopPropagation(e); if (tegner) tegner.klikk(e.latlng); else velgObjekt(o.id); });
      l.addTo(lag);
    }
  }

  // ---------- tegning ----------
  function startTegning(type) {
    stopp();
    const g = OBJEKTTYPER[type].geom;
    tegner = { type, g, pkt: [], linje: null };
    $('#pefcTegnHjelp').hidden = false;
    $('#pefcTegnHjelp .tekst').textContent = g === 'punkt' ? `Klikk der ${OBJEKTTYPER[type].navn.toLowerCase()} er.` : `Klikk rundt ${OBJEKTTYPER[type].navn.toLowerCase()}, og trykk «Fullfør».`;
    $('#pefcTegnFerdig').hidden = g === 'punkt';
    kart.getContainer().style.cursor = 'crosshair'; kart.doubleClickZoom.disable();
    tegner.klikk = (ll) => {
      if (g === 'punkt') { lagObjekt({ type: 'Point', coordinates: [ll.lng, ll.lat] }); return; }
      tegner.pkt.push([ll.lng, ll.lat]);
      const lls = tegner.pkt.map(([x, y]) => [y, x]);
      if (tegner.linje) tegner.linje.setLatLngs(lls);
      else tegner.linje = (g === 'flate' ? L.polygon : L.polyline)(lls, { color: '#ffd400', weight: 3, dashArray: '6 6' }).addTo(kart);
    };
    settKartKlikk(tegner.klikk);
  }
  function stopp() {
    if (tegner?.linje) tegner.linje.remove();
    tegner = null; $('#pefcTegnHjelp').hidden = true;
    kart.getContainer().style.cursor = ''; kart.doubleClickZoom.enable(); settKartKlikk(null);
  }
  function fullfor() {
    if (!tegner) return;
    const min = tegner.g === 'flate' ? 3 : 2;
    if (tegner.pkt.length < min) { melding(`Sett minst ${min} punkter.`); return; }
    const c = tegner.pkt;
    lagObjekt(tegner.g === 'flate' ? { type: 'Polygon', coordinates: [[...c, c[0]]] } : { type: 'LineString', coordinates: c });
  }
  function lagObjekt(geometri) {
    const type = tegner.type;
    const o = { id: nyId('po'), type, navn: OBJEKTTYPER[type].navn, geometri, kilde: 'egen', registrert: new Date().toISOString().slice(0, 10) };
    if (type === 'rovfuglreir') { o.art = 'honsehauk'; o.sisteHekking = IAAR; }
    if (type === 'livslopstre') o.antall = 1;
    P().objekter.push(o);
    stopp(); valgtObjekt = o.id; lagre(true);
    $('#pefcObjektDetalj').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function velgObjekt(id) {
    valgtObjekt = id; tegnKart(); tegn();
    $('#pefcObjektDetalj').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // ---------- visning ----------
  const pille = (st) => `<span class="pefc-pille" style="--farge:${STATUS[st].farge}">${STATUS[st].navn}</span>`;
  const kravChip = (nr) => `<span class="krav-chip">K${nr}</span>`;

  function funnHtml(f) {
    return `<div class="pefc-funn" data-nivaa="${f.nivaa}">
      <span class="prikk" style="--farge:${STATUS[f.nivaa].farge}"></span>
      <div><div class="tittel">${kravChip(f.krav)} ${esc(f.tittel)}</div><div class="info">${esc(f.tekst)}</div></div>
      <div class="knapper">${f.bestandId ? `<button type="button" class="knapp liten" data-pefc="bestand" data-id="${f.bestandId}">Vis</button>` : f.objektId ? `<button type="button" class="knapp liten" data-pefc="objekt" data-id="${f.objektId}">Vis</button>` : ''}
      ${f.vurdering ? `<button type="button" class="knapp liten" data-pefc="vurdert" data-id="${f.vurdering}">Merk vurdert</button>` : ''}
      ${f.tiltakId ? `<button type="button" class="knapp liten" data-pefc="klarering" data-id="${f.tiltakId}">Klarering</button>` : ''}</div>
    </div>`;
  }

  function klareringerHtml() {
    const S = hentPlan();
    const hogst = S.bestand.flatMap((b) => (b.tiltak || []).filter((t) => ['sluttavvirkning', 'tynning'].includes(t.type) && t.status !== 'utfort').map((t) => ({ t, b }))).sort((a, b) => a.t.aar - b.t.aar);
    if (!hogst.length) return '<div class="tom">Ingen planlagt hogst. Klarering gjøres for hver planlagt sluttavvirkning og tynning.</div>';
    return hogst.map(({ t, b }) => {
      const st = klareringStatus(t, b, funn, P());
      const aapen = aapenKlarering === t.id;
      const k = st.k;
      const tab = ALDERSTABELL;
      return `<div class="klarering ${aapen ? 'aapen' : ''}" data-tiltak="${t.id}">
        <button type="button" class="klarering-topp" data-pefc="klarering" data-id="${t.id}">
          <span><b>${esc(TILTAKSTYPER[t.type]?.navn)} – bestand ${esc(b.nr)}</b> <span class="hint">${t.aar} · ${fmt(b.areal, 1)} daa</span></span>
          ${st.avvik ? pille('avvik') : st.klar ? pille('ok') : `<span class="pefc-pille" style="--farge:var(--warning)">${st.mangler} punkter gjenstår</span>`}
        </button>
        ${aapen ? `<div class="klarering-innhold">
          ${funn.filter((f) => f.bestandId === b.id && f.nivaa !== 'ok').map(funnHtml).join('')}
          <div class="skjema to-kol" style="margin:10px 0">
            <label>Hogstform (K11) <select data-k="hogstform"><option value="">Velg …</option>${opsj(Object.entries(HOGSTFORMER), k.hogstform)}</select></label>
            ${t.type === 'sluttavvirkning' ? `<label>Foryngelsesmetode (K15) <select data-k="foryngelse"><option value="">Velg …</option>${opsj(Object.entries(FORYNGELSE), k.foryngelse)}</select></label>` : ''}
          </div>
          ${t.type === 'sluttavvirkning' && funn.some((f) => f.tiltakId === t.id && f.krav === 15) ? `<label class="skjema-felt">Begrunnelse for hogst under nedre aldersgrense (K15)<textarea data-k="begrunnelseMinstealder" rows="2" placeholder="F.eks. utilfredsstillende tetthet, svekket sunnhet, treslag utnytter ikke produksjonsevnen">${esc(k.begrunnelseMinstealder)}</textarea></label>` : ''}
          <ul class="sjekkliste">${KLARERING.map((p) => `<li><label><input type="checkbox" data-sjekk="${p.id}" ${(k.sjekk || {})[p.id] ? 'checked' : ''}> <span>${kravChip(p.krav)} ${esc(p.tekst)}${(p.lenker || []).map((l) => ` <a href="${l.url}" target="_blank" rel="noopener">${esc(l.navn)} ↗</a>`).join('')}</span></label></li>`).join('')}</ul>
          <label class="skjema-felt">Notat / dokumentasjon<textarea data-k="notat" rows="2">${esc(k.notat)}</textarea></label>
          <p class="hint">${k.dato ? `Sist oppdatert ${esc(k.dato)}. ` : ''}Nedre aldersgrense etter PEFC: ${tab.map((r) => `${r.bonitet === 23 ? '23+' : r.bonitet}: ${r.nedre} år`).join(', ')}.</p>
        </div>` : ''}
      </div>`;
    }).join('');
  }

  function objektDetaljHtml() {
    const o = P().objekter.find((x) => x.id === valgtObjekt);
    if (!o) return '';
    const t = OBJEKTTYPER[o.type];
    const a = ROVFUGLER[o.art];
    return `<div class="detalj-topp"><h3>${esc(t.navn)}</h3><div class="knapperad" style="margin:0"><button class="knapp liten" data-pefc="zoom-objekt" type="button">Zoom</button><button class="knapp liten fare" data-pefc="slett-objekt" type="button">Slett</button></div></div>
      <div class="skjema to-kol">
        <label class="hel">Navn / beskrivelse <input data-o="navn" value="${esc(o.navn)}"></label>
        ${o.type === 'rovfuglreir' ? `<label>Art <select data-o="art">${opsj(Object.entries(ROVFUGLER).map(([k, v]) => [k, v.navn]), o.art)}</select></label>
          <label>Siste kjente hekking (år) <input type="number" data-o="sisteHekking" value="${o.sisteHekking ?? ''}"></label>` : ''}
        ${o.type === 'livslopstre' ? `<label>Antall trær i punktet/gruppen <input type="number" min="1" data-o="antall" value="${o.antall ?? 1}"></label>` : ''}
        <label class="hel">Merknad <textarea data-o="merknad" rows="2">${esc(o.merknad)}</textarea></label>
      </div>
      ${a ? `<p class="hint">Hensynsområde uten flatehogst: ${a.hensyn ? `${a.hensyn} m` : 'ingen (kan hogge inntil reirtreet)'}. Buffersone uten skogbruksforstyrrelse: ${a.buffer} m, ${periodeTekst(a.periode)}. ${a.hensynAar ? `Gjelder i ${a.hensynAar} år etter siste hekking. Fravær av hekking skal dokumenteres.` : 'Gjelder uavhengig av når det sist var hekking.'}${a.merknad ? ` ${a.merknad}` : ''}</p>` : ''}
      ${o.geometri && /Polygon/.test(o.geometri.type) ? `<p class="hint">Areal ca. ${fmt(arealDaa(o.geometri), 1)} daa.</p>` : ''}
      <p class="hint">Kilde: ${o.kilde === 'offentlig' ? 'offentlig register' : 'registrert i SkogIQ'}${o.lenke ? ` · <a href="${esc(o.lenke)}" target="_blank" rel="noopener">faktaark ↗</a>` : ''}${o.beskrivelse ? `<br>${esc(o.beskrivelse.slice(0, 400))}` : ''}</p>`;
  }

  function datagrunnlagHtml() {
    const S = hentPlan(); const p = P();
    const dk = S.datakilder || {};
    const aar = (a) => (a ? String(a).slice(0, 4) : null);
    const periode = (k) => (k?.dataFra ? (aar(k.dataFra) === aar(k.dataTil) ? aar(k.dataFra) : `${aar(k.dataFra)}–${aar(k.dataTil)}`) : null);
    const navn = { eiendom: 'Eiendomsgrense', plan: 'Tidligere skogbruksplan', sr16: 'Skogressurskart SR16', nvdb: 'Skogsbilveier', mis: 'Nøkkelbiotoper (MiS)', vern: 'Verneområder', hb13: 'Naturtyper (DN-HB13)', nin: 'Naturtyper (NiN)', utvalgte: 'Utvalgte naturtyper', art: 'Artsområder', friluft: 'Friluftslivsområder', kultur: 'Kulturminner', ssb: 'Tømmerpriser' };
    const eier = { eiendom: 'Kartverket', plan: 'NIBIO', sr16: 'NIBIO', nvdb: 'Statens vegvesen', mis: 'NIBIO', vern: 'Miljødirektoratet', hb13: 'Miljødirektoratet', nin: 'Miljødirektoratet', utvalgte: 'Miljødirektoratet', art: 'Miljødirektoratet', friluft: 'Miljødirektoratet', kultur: 'Riksantikvaren', ssb: 'SSB' };
    // Advarsler om alder på selve dataene
    const dataVarsel = (id, k) => {
      const til = Number(aar(k?.dataTil));
      if (id === 'sr16' && til && IAAR - til > 10) return `Målt ${periode(k)} – skog kan være hogd siden`;
      if (id === 'plan' && til && IAAR - til > 15) return `Taksert ${periode(k)} – over 15 år gammel`;
      return null;
    };
    const fliser = KILDEREKKEFOLGE.map((id) => {
      const k = dk[id]; const st = kildeStatus(k);
      const varsel = dataVarsel(id, k);
      return `<div class="kilde" data-niva="${st.niva}">
        <div class="kilde-topp"><span class="prikk" style="--farge:${NIVA[st.niva].farge}"></span><b>${esc(navn[id])}</b></div>
        <div class="kilde-eier">${esc(eier[id])}</div>
        <div class="kilde-hentet">${esc(st.tekst)}${k?.hentet ? ` <span class="hint">${new Date(k.hentet).toLocaleDateString('nb-NO')}</span>` : ''}</div>
        <div class="kilde-info">${k ? `${id === 'ssb' ? (k.merknad || 'Priser') : `${k.antall ?? 0} ${k.antall === 1 ? 'objekt' : 'objekter'}`}${periode(k) ? ` · data ${periode(k)}` : ''}${k.versjon ? ` · versjon ${k.versjon}` : ''}` : '–'}</div>
        ${k?.merknad ? `<div class="kilde-info">${esc(k.merknad)}</div>` : ''}
        ${varsel ? `<div class="kilde-varsel">${esc(varsel)}</div>` : ''}
        ${k?.feil ? `<div class="kilde-varsel">${esc(k.feil)}</div>` : ''}
        ${(k?.krav || []).length ? `<div class="kilde-krav">${k.krav.map(kravChip).join('')}</div>` : ''}
      </div>`;
    }).join('');
    // Manuelle registreringer som standarden krever oppdatert
    const siste = (liste) => liste.filter(Boolean).sort().at(-1) || null;
    const kravDato = siste(Object.values(p.kravstatus || {}).map((m) => m?.dato));
    const klarDato = siste(Object.values(p.klareringer || {}).map((k) => k?.dato));
    const rovDato = siste(p.objekter.filter((o) => ['rovfuglreir', 'tiurleik'].includes(o.type)).map((o) => o.registrert));
    const mr = p.eiendom.miljoregistreringAar;
    const manuelle = [
      ['Skogbruksplan (takst)', S.eiendom?.takstAar, S.eiendom?.takstAar ? (IAAR - S.eiendom.takstAar > 15 ? 'bor' : 'fersk') : 'mangler', 'K3: revideres hvert 15.–20. år'],
      ['Miljøregistrering (MiS)', mr, mr ? (IAAR - mr > 15 ? 'bor' : 'fersk') : 'mangler', 'K22: revisjon vurderes hvert 15. år'],
      ['Rovfugl og tiurleik', rovDato ? new Date(rovDato).toLocaleDateString('nb-NO') : null, rovDato ? 'manuell' : 'mangler', 'K24/K25: ikke åpne data – sjekk kilder før hogst'],
      ['Egenvurdering av kravpunkter', kravDato ? new Date(kravDato).toLocaleDateString('nb-NO') : null, kravDato ? 'manuell' : 'mangler', `${Object.values(p.kravstatus || {}).filter((m) => m?.status).length} av 30 vurdert`],
      ['Klarering før hogst', klarDato ? new Date(klarDato).toLocaleDateString('nb-NO') : null, klarDato ? 'manuell' : 'mangler', 'Sist oppdaterte klarering'],
    ];
    const tell = KILDEREKKEFOLGE.map((id) => kildeStatus(dk[id]).niva);
    const ferske = tell.filter((n) => n === 'fersk').length;
    const eldst = KILDEREKKEFOLGE.filter((id) => dk[id]?.hentet).sort((a, b) => dk[a].hentet.localeCompare(dk[b].hentet))[0];
    return `<div class="datagrunnlag-topp">
        <div><b>${ferske} av ${KILDEREKKEFOLGE.length} kilder oppdatert siste 90 dager</b><div class="hint">${eldst ? `Eldste henting: ${esc(navn[eldst])}, ${new Date(dk[eldst].hentet).toLocaleDateString('nb-NO')}.` : 'Ingen kilder er hentet ennå.'} Dataene hentes automatisk når planen lages.</div></div>
        <button type="button" class="knapp primar" id="pefcOppdaterAlle">Oppdater alle</button>
      </div>
      <div id="pefcOppdaterStatus" class="hint"></div>
      <div class="kilder">${fliser}</div>
      <h4 class="pefc-tema">Manuelle registreringer</h4>
      <div class="manuelle">${manuelle.map(([n, v, niva, tekst]) => `<div class="manuell"><span class="prikk" style="--farge:${NIVA[niva].farge}"></span><span><b>${esc(n)}</b><span class="hint"> ${esc(tekst)}</span></span><span class="verdi">${v ? esc(v) : 'Ikke registrert'}</span></div>`).join('')}</div>`;
  }

  function tegn() {
    if (!$('#fane-pefc') || $('#fane-pefc').hidden) return;
    const p = P();
    $('#pefcDatagrunnlag').innerHTML = datagrunnlagHtml();
    const tell = { ok: 0, 'ikke-relevant': 0, varsel: 0, avvik: 0, 'ikke-vurdert': 0 };
    for (const k of KRAVPUNKTER) tell[status[k.nr].status]++;
    const ivaretatt = tell.ok + tell['ikke-relevant'];
    const r = 34; const omkrets = 2 * Math.PI * r;
    const bue = (n, start) => `<circle r="${r}" cx="42" cy="42" fill="none" stroke-width="9" stroke-dasharray="${(n / 30) * omkrets} ${omkrets}" stroke-dashoffset="${-(start / 30) * omkrets}" transform="rotate(-90 42 42)"`;
    let start = 0; const buer = [['ok', tell.ok + tell['ikke-relevant']], ['varsel', tell.varsel], ['avvik', tell.avvik]].map(([st, n]) => { const s = `${bue(n, start)} style="stroke:${STATUS[st].farge}"/>`; start += n; return s; }).join('');
    $('#pefcStatus').innerHTML = `
      <svg class="pefc-ring" viewBox="0 0 84 84" role="img" aria-label="${ivaretatt} av 30 kravpunkter ivaretatt"><circle r="${r}" cx="42" cy="42" fill="none" stroke-width="9" style="stroke:var(--surface-3)"/>${buer}<text x="42" y="40" text-anchor="middle" class="ring-tall">${ivaretatt}</text><text x="42" y="54" text-anchor="middle" class="ring-under">av 30</text></svg>
      <div class="pefc-status-tekst">
        <b>${tell.avvik ? `${tell.avvik} kravpunkt med avvik` : tell.varsel ? 'Ingen avvik – noe må følges opp' : ivaretatt === 30 ? 'Alle kravpunkter er ivaretatt' : 'Ingen avvik funnet'}</b>
        <div class="pefc-tellere">${['avvik', 'varsel', 'ikke-vurdert', 'ok'].map((st) => `<span><i style="background:${STATUS[st].farge}"></i>${tell[st] + (st === 'ok' ? tell['ikke-relevant'] : 0)} ${STATUS[st].navn.toLowerCase()}</span>`).join('')}</div>
        <span class="hint">${STANDARD.navn} (${STANDARD.kode}). Automatiske kontroller for ${KRAVPUNKTER.filter((k) => k.auto).length} kravpunkter, egenvurdering for resten.</span>
      </div>`;
    $('#pefcHentStatus').textContent = p.hentet ? `Offentlige miljødata hentet ${new Date(p.hentet).toLocaleDateString('nb-NO')}: ${p.objekter.filter((o) => o.kilde === 'offentlig').length} objekter.` : 'Ikke hentet ennå.';

    const viktige = funn.filter((f) => f.nivaa === 'avvik' || f.nivaa === 'varsel');
    $('#pefcFunn').innerHTML = viktige.length ? viktige.slice(0, 40).map(funnHtml).join('') + (viktige.length > 40 ? `<p class="hint">… og ${viktige.length - 40} til.</p>` : '') : '<div class="tom">Ingen avvik eller oppfølgingspunkter fra de automatiske kontrollene.</div>';
    $('#pefcKlarering').innerHTML = klareringerHtml();

    const grupper = Object.entries(OBJEKTTYPER).map(([k, t]) => [k, t, p.objekter.filter((o) => o.type === k)]).filter(([, , l]) => l.length);
    $('#pefcObjekter').innerHTML = grupper.length ? grupper.map(([k, t, l]) => `<details class="pefc-gruppe"><summary><i style="background:${t.farge}"></i>${esc(t.navn)} <span class="hint">${l.length}</span></summary>${l.map((o) => `<button type="button" class="pefc-objekt ${o.id === valgtObjekt ? 'valgt' : ''}" data-pefc="objekt" data-id="${o.id}">${esc(o.navn || t.navn)}${o.kilde === 'offentlig' ? ' <span class="hint">offentlig</span>' : ''}</button>`).join('')}</details>`).join('')
      : '<div class="tom">Ingen miljøobjekter ennå. Hent offentlige data, eller registrer selv.</div>';
    $('#pefcObjektDetalj').hidden = !valgtObjekt;
    $('#pefcObjektDetalj').innerHTML = objektDetaljHtml();

    const e = p.eiendom;
    $('#pefcEiendom').innerHTML = `
      <label>År for miljøregistrering (MiS) <input type="number" data-e="miljoregistreringAar" value="${e.miljoregistreringAar ?? ''}" placeholder="f.eks. 2013"></label>
      <label>Irreversibelt omdisponert areal etter 14.02.2016 (daa) <input type="number" step="0.1" data-e="omdisponertDaa" value="${e.omdisponertDaa ?? ''}"></label>
      <label>Landskapsplan sist revidert (år) <input type="number" data-e="landskapsplanAar" value="${e.landskapsplanAar ?? ''}" placeholder="Over 10 000 daa"></label>
      <label>Spredning av utenlandske treslag sist kontrollert (år) <input type="number" data-e="spredningKontrollAar" value="${e.spredningKontrollAar ?? ''}"></label>`;

    $('#pefcKrav').innerHTML = TEMA.map((tema, ti) => `<h4 class="pefc-tema">${esc(tema)}</h4>${KRAVPUNKTER.filter((k) => k.tema === ti).map((k) => {
      const st = status[k.nr]; const m = st.manuell || {};
      return `<details class="pefc-krav" data-krav="${k.nr}"><summary><span class="krav-nr">${k.nr}</span><span class="krav-tittel">${esc(k.tittel)}</span>${pille(st.status)}</summary>
        <div class="pefc-krav-innhold">
          <p>${esc(k.kort)}</p>
          ${(k.lenker || []).length ? `<p class="lenker">${k.lenker.map((l) => `<a href="${l.url}" target="_blank" rel="noopener">${esc(l.navn)} ↗</a>`).join(' · ')}</p>` : ''}
          ${st.funn.length ? `<div class="pefc-krav-funn">${st.funn.map(funnHtml).join('')}</div>` : k.auto ? '<p class="hint">Ingen funn fra de automatiske kontrollene.</p>' : ''}
          <div class="skjema to-kol">
            <label>Egen vurdering <select data-m="status"><option value="">Ikke vurdert</option>${opsj([['ok', 'Ivaretatt'], ['ikke-relevant', 'Ikke relevant for eiendommen'], ['avvik', 'Avvik']], m.status)}</select></label>
            <label>Dato <input type="date" data-m="dato" value="${esc(m.dato)}"></label>
            <label class="hel">Dokumentasjon / notat <textarea data-m="notat" rows="2">${esc(m.notat)}</textarea></label>
          </div>
        </div></details>`;
    }).join('')}`).join('');
  }

  // ---------- hendelser ----------
  const panel = $('#fane-pefc');
  panel.addEventListener('click', (e) => {
    const knapp = e.target.closest('[data-pefc]'); if (!knapp) return;
    const h = knapp.dataset.pefc; const id = knapp.dataset.id;
    const p = P();
    if (h === 'bestand') visBestand(id);
    if (h === 'objekt') { velgObjekt(id); const o = p.objekter.find((x) => x.id === id); if (o?.geometri) zoom(o.geometri); }
    if (h === 'zoom-objekt') { const o = p.objekter.find((x) => x.id === valgtObjekt); if (o) zoom(o.geometri); }
    if (h === 'slett-objekt' && confirm('Slette objektet?')) { p.objekter = p.objekter.filter((x) => x.id !== valgtObjekt); valgtObjekt = null; lagre(true); }
    if (h === 'vurdert') { p.kravstatus[id] = { status: 'ok', dato: new Date().toISOString().slice(0, 10) }; lagre(); melding('Merket som vurdert.'); }
    if (h === 'klarering') { aapenKlarering = aapenKlarering === id ? null : id; tegn(); document.querySelector(`.klarering[data-tiltak="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  });
  panel.addEventListener('change', (e) => {
    const f = e.target; const p = P();
    const kl = f.closest('.klarering');
    if (kl) {
      const tid = kl.dataset.tiltak;
      const k = p.klareringer[tid] || (p.klareringer[tid] = { sjekk: {} });
      if (f.dataset.sjekk) k.sjekk[f.dataset.sjekk] = f.checked;
      if (f.dataset.k) k[f.dataset.k] = f.value;
      k.dato = new Date().toISOString().slice(0, 10);
      lagre(); return;
    }
    if (f.dataset.o) {
      const o = p.objekter.find((x) => x.id === valgtObjekt); if (!o) return;
      o[f.dataset.o] = ['sisteHekking', 'antall'].includes(f.dataset.o) ? Number(f.value) || null : f.value;
      lagre(['art'].includes(f.dataset.o)); return;
    }
    if (f.dataset.e) { p.eiendom[f.dataset.e] = f.value === '' ? null : Number(f.value); lagre(); return; }
    if (f.dataset.m) {
      const nr = f.closest('[data-krav]').dataset.krav;
      const m = p.kravstatus[nr] || (p.kravstatus[nr] = {});
      m[f.dataset.m] = f.value || null;
      if (f.dataset.m === 'status' && f.value && !m.dato) m.dato = new Date().toISOString().slice(0, 10);
      const aapne = [...panel.querySelectorAll('.pefc-krav[open]')].map((d) => d.dataset.krav);
      lagre();
      for (const n of aapne) panel.querySelector(`.pefc-krav[data-krav="${n}"]`)?.setAttribute('open', '');
    }
  });
  async function oppdater(hvilke, statusEl) {
    const knapper = ['#pefcHentBtn', '#pefcOppdaterAlle'].map((x) => $(x)).filter(Boolean);
    knapper.forEach((k) => { k.disabled = true; });
    try {
      const r = await hentData(hvilke, (kilde, tekst) => { const el = $(statusEl); if (el) el.textContent = tekst; });
      beregn(); tegnKart(); tegn();
      const el = $(statusEl);
      if (el) el.textContent = r.feil.length ? `Ferdig, med feil: ${r.feil.join('; ')}` : 'Oppdatert.';
    } catch (e) { const el = $(statusEl); if (el) el.textContent = `Kunne ikke oppdatere: ${e.message}`; } finally { knapper.forEach((k) => { k.disabled = false; }); }
  }
  $('#pefcHentBtn').addEventListener('click', () => oppdater(['miljo'], '#pefcHentStatus'));
  panel.addEventListener('click', (e) => { if (e.target.id === 'pefcOppdaterAlle') oppdater(['miljo', 'nvdb', 'ssb'], '#pefcOppdaterStatus'); });
  $('#pefcNyBtn').addEventListener('click', () => startTegning($('#pefcNyType').value));
  $('#pefcTegnFerdig').addEventListener('click', fullfor);
  $('#pefcTegnAvbryt').addEventListener('click', stopp);

  function zoom(g) { if (g.type === 'Point') kart.setView([g.coordinates[1], g.coordinates[0]], 16); else kart.fitBounds(L.geoJSON(g).getBounds(), { padding: [40, 40], maxZoom: 16 }); }

  return {
    vis() { synlig = true; lag.addTo(kart); beregn(); tegnKart(); tegn(); },
    skjul() { synlig = false; lag.remove(); stopp(); },
    oppdater() { valgtObjekt = null; aapenKlarering = null; beregn(); if (synlig) { tegnKart(); tegn(); } },
    funn() { beregn(); return funn; },
    aapneKlarering(tiltakId) { aapenKlarering = tiltakId; },
    // Til rapporten
    rapport() { beregn(); return { funn, status, P: P() }; },
  };
}
