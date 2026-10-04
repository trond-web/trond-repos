// Fanen «Veier»: register over skogsbilveier og traktorveier for planen som er åpen, med punkter
// (bom, stikkrenne, snuplass …), vedlikeholdslogg og -plan, kostnadsfordeling mellom eiere og terrengtransport.
import {
  VEIKLASSER, TILSTAND, PUNKTTYPER, VEDLIKEHOLDSTYPER, STANDARD_VEIINNSTILLINGER,
  lengdeM, terrengtransport, foreslaaVedlikehold, vedlikeholdKostnad, fordelKostnad, nyVeiKostnad, hentNvdbVeier, tomtVeiregister,
} from './veier.js';
import { fmt } from './charts.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const klon = (o) => JSON.parse(JSON.stringify(o));
const opsj = (liste, valgt) => liste.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(valgt ?? '') ? 'selected' : ''}>${esc(t)}</option>`).join('');
const IAAR = new Date().getFullYear();
const STATUS = { eksisterende: 'Eksisterende', planlagt: 'Planlagt ny vei', bygges: 'Under bygging' };

export { tomtVeiregister };

export function initVeier({ kart, hentPlan, endret, melding, nyId, settKartKlikk, visBestand }) {
  const lag = L.layerGroup().addTo(kart);
  let valgtVei = null; let valgtPunkt = null;
  let tegner = null; // { punkter: [], linje }
  let forslag = [];

  const reg = () => {
    const S = hentPlan();
    if (!S.veier) S.veier = tomtVeiregister();
    S.veier.innstillinger = { ...klon(STANDARD_VEIINNSTILLINGER), ...S.veier.innstillinger };
    return S.veier;
  };
  const inn = () => reg().innstillinger;
  const lagre = (kart = true) => { endret({ kart: false }); if (kart) tegnKart(); tegn(); };

  // ---------- kart ----------
  function tegnKart() {
    lag.clearLayers();
    const r = reg();
    for (const v of r.veier) {
      if (!v.geometri) continue;
      const k = VEIKLASSER[v.klasse] || VEIKLASSER[0];
      const farge = TILSTAND[v.tilstand || 'ukjent'].farge;
      const valgt = v.id === valgtVei;
      L.geoJSON(v.geometri, {
        style: { color: valgt ? '#ffd400' : farge, weight: (k.bilvei ? 5 : 3) + (valgt ? 2 : 0), opacity: 0.95, dashArray: v.status === 'planlagt' ? '8 6' : null, lineCap: 'round' },
      }).bindTooltip(`${esc(v.navn || 'Vei')} · ${k.kort} · ${fmt(v.lengde)} m`, { sticky: true })
        .on('click', (e) => { L.DomEvent.stopPropagation(e); if (tegner) tegner.klikk(e.latlng); else velgVei(v.id); })
        .addTo(lag);
    }
    for (const p of r.punkter) {
      const t = PUNKTTYPER[p.type] || PUNKTTYPER.skade;
      const farge = TILSTAND[p.tilstand || 'ukjent'].farge;
      L.marker([p.geometri.coordinates[1], p.geometri.coordinates[0]], {
        icon: L.divIcon({ className: '', html: `<div class="vei-punkt" style="--farge:${farge}">${t.bokstav}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] }),
        title: `${t.navn}: ${p.navn || ''}`,
      }).on('click', (e) => { L.DomEvent.stopPropagation(e); if (tegner) tegner.klikk(e.latlng); else velgPunkt(p.id); }).addTo(lag);
    }
  }

  // ---------- tegning ----------
  function startTegning(modus, punkttype) {
    stoppTegning();
    tegner = { modus, punkttype, punkter: [], linje: null };
    $('#veiTegnHjelp').hidden = false;
    $('#veiTegnHjelp .tekst').textContent = modus === 'vei' ? 'Klikk langs veien i kartet. Trykk «Fullfør» når du er ferdig.' : `Klikk der ${PUNKTTYPER[punkttype].navn.toLowerCase()} skal ligge.`;
    $('#veiTegnFerdig').hidden = modus !== 'vei';
    kart.getContainer().style.cursor = 'crosshair';
    kart.doubleClickZoom.disable();
    tegner.klikk = (ll) => {
      if (tegner.modus === 'punkt') {
        const p = { id: nyId('vp'), type: tegner.punkttype, navn: PUNKTTYPER[tegner.punkttype].navn, tilstand: 'ukjent', geometri: { type: 'Point', coordinates: [ll.lng, ll.lat] }, egenskaper: {}, merknad: '' };
        reg().punkter.push(p);
        stoppTegning(); valgtPunkt = p.id; valgtVei = null; lagre();
        return;
      }
      tegner.punkter.push([ll.lng, ll.lat]);
      const lls = tegner.punkter.map(([x, y]) => [y, x]);
      if (tegner.linje) tegner.linje.setLatLngs(lls); else tegner.linje = L.polyline(lls, { color: '#ffd400', weight: 4, dashArray: '6 6' }).addTo(kart);
    };
    settKartKlikk(tegner.klikk);
  }
  function stoppTegning() {
    if (tegner?.linje) tegner.linje.remove();
    tegner = null;
    $('#veiTegnHjelp').hidden = true;
    kart.getContainer().style.cursor = '';
    kart.doubleClickZoom.enable();
    settKartKlikk(null);
  }
  function fullforVei() {
    if (!tegner || tegner.punkter.length < 2) { melding('Sett minst to punkter langs veien.'); return; }
    const geometri = { type: 'LineString', coordinates: tegner.punkter };
    const status = $('#veiNyStatus').value;
    const v = { id: nyId('v'), navn: status === 'planlagt' ? 'Ny vei (planlagt)' : 'Ny vei', vegnummer: '', status, klasse: status === 'planlagt' ? 3 : 0, tilstand: status === 'planlagt' ? 'ukjent' : 'ukjent', geometri, lengde: Math.round(lengdeM(geometri)), eiere: [], merknad: '' };
    reg().veier.push(v);
    stoppTegning();
    valgtVei = v.id; valgtPunkt = null;
    lagre();
    melding(`${v.navn} lagt til (${fmt(v.lengde)} m).`);
  }

  // ---------- valg og detaljer ----------
  function velgVei(id) {
    valgtVei = id; valgtPunkt = null;
    tegnKart(); tegn();
    $('#veiDetalj').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function velgPunkt(id) {
    valgtPunkt = id; valgtVei = null;
    tegnKart(); tegn();
    $('#veiDetalj').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function detaljVei(v) {
    const loggen = reg().vedlikehold.filter((l) => l.veiId === v.id).sort((a, b) => b.aar - a.aar);
    const ny = v.status !== 'eksisterende' ? nyVeiKostnad(v, inn()) : null;
    const eiere = v.eiere || [];
    const sumAndel = eiere.reduce((s, e) => s + (Number(e.andel) || 0), 0);
    return `
      <div class="detalj-topp"><h3>${esc(v.navn || 'Vei')}</h3>
        <div class="knapperad" style="margin:0"><button class="knapp liten" data-vh="zoom" type="button">Zoom</button><button class="knapp liten fare" data-vh="slett" type="button">Slett vei</button></div></div>
      <div class="nokkeltall">
        <div><b>${fmt(v.lengde)} m</b><span>lengde</span></div>
        <div><b>${esc((VEIKLASSER[v.klasse] || VEIKLASSER[0]).kort)}</b><span>${esc((VEIKLASSER[v.klasse] || VEIKLASSER[0]).navn)}</span></div>
        <div><b>${esc(TILSTAND[v.tilstand || 'ukjent'].navn)}</b><span>tilstand</span></div>
        ${ny ? `<div><b>${fmt(ny.netto)} kr</b><span>byggekostnad etter ${inn().tilskuddProsent} % tilskudd (brutto ${fmt(ny.brutto)})</span></div>` : ''}
      </div>
      <form class="skjema tre-kol" id="veiSkjema">
        <label>Navn <input name="navn" value="${esc(v.navn)}"></label>
        <label>Vegnummer <input name="vegnummer" value="${esc(v.vegnummer)}" placeholder="f.eks. SV630"></label>
        <label>Status <select name="status">${opsj(Object.entries(STATUS), v.status)}</select></label>
        <label>Vegklasse <select name="klasse">${opsj(Object.entries(VEIKLASSER).map(([k, d]) => [k, `${d.kort} – ${d.navn}`]), v.klasse)}</select></label>
        <label>Tilstand <select name="tilstand">${opsj(Object.entries(TILSTAND).map(([k, d]) => [k, d.navn]), v.tilstand || 'ukjent')}</select></label>
        <label>Dekke <select name="dekke">${opsj([['', '–'], ['grus', 'Grus'], ['jord', 'Jord'], ['asfalt', 'Asfalt']], v.dekke)}</select></label>
        <label>Kjørebanebredde (m) <input name="bredde" type="number" step="0.1" value="${v.bredde ?? ''}"></label>
        <label>Maks aksellast (tonn) <input name="aksellast" type="number" step="0.5" value="${v.aksellast ?? ''}"></label>
        <label>Maks totalvekt (tonn) <input name="totalvekt" type="number" step="1" value="${v.totalvekt ?? ''}"></label>
        <label>Åpen for tømmerbil <select name="aapen">${opsj([['', '–'], ['helaar', 'Hele året'], ['sommer', 'Sommer (barmark)'], ['vinter', 'Vinter (frost)'], ['stengt', 'Stengt']], v.aapen)}</select></label>
        <label>Bygd år <input name="byggeaar" type="number" value="${v.byggeaar ?? ''}"></label>
        <label>Veilag <input name="veilag" value="${esc(v.veilag)}" placeholder="Navn på veilag"></label>
        <label class="hel">Merknad <textarea name="merknad" rows="2">${esc(v.merknad)}</textarea></label>
      </form>
      ${v.nvdb ? `<p class="hint">Importert fra NVDB${v.kategori ? ` (${esc(v.kategori)})` : ''}${v.klasseKilde ? ', klasse fra NVDB' : ', klasse ikke registrert i NVDB'}.</p>` : ''}

      <h4 class="vei-h4">Eierandeler <span class="hint">${eiere.length ? `sum ${fmt(sumAndel)} %` : 'brukes til å fordele vedlikeholdskostnader'}</span></h4>
      <div class="vei-eiere">${eiere.map((e, i) => `<div class="vei-eier" data-i="${i}"><input value="${esc(e.navn)}" data-eier="navn" placeholder="Eier / gnr-bnr" aria-label="Eier"><input type="number" value="${e.andel ?? ''}" data-eier="andel" min="0" step="1" aria-label="Andel i prosent"><span>%</span><button type="button" class="knapp liten" data-vh="fjern-eier" aria-label="Fjern">✕</button></div>`).join('')}</div>
      <button class="knapp liten" data-vh="ny-eier" type="button">+ Legg til eier</button>

      <h4 class="vei-h4">Vedlikehold</h4>
      <form class="verktoyrad" id="vedlikeholdSkjema">
        <select name="type" aria-label="Tiltak">${opsj(Object.entries(VEDLIKEHOLDSTYPER).map(([k, d]) => [k, d.navn]))}</select>
        <input name="aar" type="number" value="${IAAR}" style="width:84px" aria-label="År">
        <select name="status" aria-label="Status"><option value="utfort">Utført</option><option value="planlagt">Planlagt</option></select>
        <input name="kostnad" type="number" placeholder="Kostnad kr" style="width:120px" aria-label="Kostnad">
        <input name="utfortAv" placeholder="Utført av" style="width:130px" aria-label="Utført av">
        <button class="knapp primar" type="submit">Registrer</button>
      </form>
      <div>${loggen.map(loggRad).join('') || '<div class="tom">Ingen vedlikehold registrert på denne veien.</div>'}</div>`;
  }

  function loggRad(l) {
    const v = reg().veier.find((x) => x.id === l.veiId);
    return `<div class="tiltak-rad ${l.status === 'utfort' ? 'status-utfort' : ''}" data-logg="${l.id}">
      <input type="checkbox" data-vh="logg-utfort" ${l.status === 'utfort' ? 'checked' : ''} title="Utført" aria-label="Utført">
      <div><div class="tittel">${esc(VEDLIKEHOLDSTYPER[l.type]?.navn || l.type)} – ${esc(v?.navn || '')} <span class="hint">${l.aar}</span></div>
      <div class="info">${l.kostnad ? `${fmt(l.kostnad)} kr` : 'Kostnad ikke satt'}${l.utfortAv ? ` · ${esc(l.utfortAv)}` : ''}${l.kommentar ? ` · ${esc(l.kommentar)}` : ''}</div></div>
      <button class="knapp liten" data-vh="slett-logg" type="button" aria-label="Slett">✕</button></div>`;
  }

  function detaljPunkt(p) {
    const t = PUNKTTYPER[p.type] || PUNKTTYPER.skade;
    const eg = Object.entries(p.egenskaper || {});
    return `
      <div class="detalj-topp"><h3>${esc(t.navn)}</h3>
        <div class="knapperad" style="margin:0"><button class="knapp liten" data-vh="zoom-punkt" type="button">Zoom</button><button class="knapp liten fare" data-vh="slett-punkt" type="button">Slett</button></div></div>
      <form class="skjema tre-kol" id="punktSkjema">
        <label>Type <select name="type">${opsj(Object.entries(PUNKTTYPER).map(([k, d]) => [k, d.navn]), p.type)}</select></label>
        <label>Navn / beskrivelse <input name="navn" value="${esc(p.navn)}"></label>
        <label>Tilstand <select name="tilstand">${opsj(Object.entries(TILSTAND).map(([k, d]) => [k, d.navn]), p.tilstand || 'ukjent')}</select></label>
        ${p.type === 'stikkrenne' ? `<label>Dimensjon (mm) <input name="dimensjon" type="number" value="${p.dimensjon ?? ''}"></label>` : ''}
        ${p.type === 'bom' ? `<label>Nøkkel / kode <input name="nokkel" value="${esc(p.nokkel)}"></label>` : ''}
        <label>Sist kontrollert <input name="kontrollert" type="date" value="${esc(p.kontrollert)}"></label>
        <label class="hel">Merknad <textarea name="merknad" rows="2">${esc(p.merknad)}</textarea></label>
      </form>
      ${eg.length ? `<details class="ekstra"><summary>Fra NVDB (${eg.length} felt)</summary>${eg.map(([k, v]) => `<div><b>${esc(k)}</b>: ${esc(v)}</div>`).join('')}</details>` : ''}`;
  }

  // ---------- hovedvisning ----------
  function tegn() {
    const S = hentPlan(); const r = reg();
    const bil = r.veier.filter((v) => v.status !== 'planlagt' && (VEIKLASSER[v.klasse] || VEIKLASSER[0]).bilvei);
    const trak = r.veier.filter((v) => v.status !== 'planlagt' && !(VEIKLASSER[v.klasse] || VEIKLASSER[0]).bilvei);
    const plan = r.vedlikehold.filter((l) => l.status === 'planlagt' && l.aar <= IAAR + 4);
    const tt = terrengtransport(S.bestand, r.veier);
    const lange = S.bestand.filter((b) => (tt.get(b.id)?.meter ?? 0) > inn().maksTerrengtransport).sort((a, b) => tt.get(b.id).meter - tt.get(a.id).meter);
    const km = (l) => (l.reduce((s, v) => s + (v.lengde || 0), 0) / 1000).toLocaleString('nb-NO', { maximumFractionDigits: 1 });
    const darlig = r.veier.filter((v) => v.tilstand === 'darlig').length + r.punkter.filter((p) => p.tilstand === 'darlig').length;

    $('#veiKpi').innerHTML = `
      <div class="kpi"><div class="verdi">${km(bil)} km</div><div class="etikett">bilvei</div><div class="under">${km(trak)} km traktorvei${r.veier.some((v) => v.status === 'planlagt') ? ` · ${km(r.veier.filter((v) => v.status === 'planlagt'))} km planlagt` : ''}</div></div>
      <div class="kpi"><div class="verdi">${r.punkter.length}</div><div class="etikett">punkter</div><div class="under">${Object.entries(PUNKTTYPER).map(([k, d]) => [d.navn, r.punkter.filter((p) => p.type === k).length]).filter(([, n]) => n).map(([n, c]) => `${c} ${n.toLowerCase()}`).join(', ') || 'bom, stikkrenner, snuplasser …'}</div></div>
      <div class="kpi"><div class="verdi">${fmt(plan.reduce((s, l) => s + (l.kostnad || 0), 0))} kr</div><div class="etikett">planlagt vedlikehold</div><div class="under">${IAAR}–${IAAR + 4}, ${plan.length} tiltak</div></div>
      <div class="kpi"><div class="verdi">${darlig ? `⚠ ${darlig}` : '0'}</div><div class="etikett">i dårlig tilstand</div><div class="under">veier og punkter</div></div>
      <div class="kpi"><div class="verdi">${lange.length}</div><div class="etikett">bestand med lang terrengtransport</div><div class="under">over ${fmt(inn().maksTerrengtransport)} m til bilvei${lange.length ? `, ${fmt(lange.reduce((s, b) => s + (b.areal || 0), 0))} daa` : ''}</div></div>`;

    $('#veiListe').innerHTML = r.veier.length ? r.veier.slice().sort((a, b) => (a.navn || '').localeCompare(b.navn || '', 'nb', { numeric: true })).map((v) => {
      const k = VEIKLASSER[v.klasse] || VEIKLASSER[0];
      const t = TILSTAND[v.tilstand || 'ukjent'];
      return `<button type="button" class="vei-rad ${v.id === valgtVei ? 'valgt' : ''}" data-vei="${v.id}">
        <span class="strek" style="--farge:${t.farge}" data-planlagt="${v.status === 'planlagt'}"></span>
        <span><b>${esc(v.navn || 'Vei')}</b> <span class="hint">${esc(k.kort)}${v.status !== 'eksisterende' ? ` · ${STATUS[v.status]}` : ''}</span></span>
        <span class="tall">${fmt(v.lengde)} m</span>
        <span class="pille" style="--farge:${t.farge}">${t.navn}</span>
      </button>`;
    }).join('') : '<div class="tom">Ingen veier registrert. Hent veiene fra NVDB, eller tegn dem i kartet.</div>';

    const pv = r.punkter.find((p) => p.id === valgtPunkt);
    const vv = r.veier.find((v) => v.id === valgtVei);
    $('#veiDetalj').hidden = !pv && !vv;
    $('#veiDetalj').innerHTML = vv ? detaljVei(vv) : pv ? detaljPunkt(pv) : '';

    // Vedlikeholdsplan per år med fordeling mellom eiere
    const planlagt = r.vedlikehold.filter((l) => l.status === 'planlagt').sort((a, b) => a.aar - b.aar);
    const perAar = new Map();
    for (const l of planlagt) { if (!perAar.has(l.aar)) perAar.set(l.aar, []); perAar.get(l.aar).push(l); }
    const fordeling = new Map();
    for (const l of planlagt.filter((x) => x.aar <= IAAR + 4)) {
      const v = r.veier.find((x) => x.id === l.veiId);
      for (const f of fordelKostnad(l.kostnad || 0, v?.eiere)) fordeling.set(f.navn, (fordeling.get(f.navn) || 0) + f.belop);
    }
    $('#veiForslag').innerHTML = forslag.length ? `<div class="kort forslag-kort"><div class="detalj-topp"><h3>Forslag (${forslag.length})</h3><div class="knapperad" style="margin:0"><button class="knapp liten primar" data-vh="godta-alle" type="button">Legg til alle</button><button class="knapp liten" data-vh="forkast" type="button">Forkast</button></div></div>
      ${forslag.map((f, i) => { const v = r.veier.find((x) => x.id === f.veiId); return `<div class="tiltak-rad forslag"><button class="knapp liten primar" data-vh="godta" data-i="${i}" type="button">Legg til</button><div><div class="tittel">${esc(VEDLIKEHOLDSTYPER[f.type].navn)} – ${esc(v?.navn)} <span class="hint">${f.aar}</span></div><div class="info">ca. ${fmt(f.kostnad)} kr · ${esc(f.kommentar)}</div></div><span></span></div>`; }).join('')}</div>` : '';
    $('#veiPlan').innerHTML = (perAar.size ? [...perAar].map(([aar, l]) => `<div class="tiltak-aar"><h4>${aar}${aar < IAAR ? ' ⚠️ forfalt' : ''}<span>${fmt(l.reduce((s, x) => s + (x.kostnad || 0), 0))} kr</span></h4>${l.map(loggRad).join('')}</div>`).join('')
      : '<div class="tom">Ingen planlagt vedlikehold. Trykk «Foreslå vedlikehold».</div>')
      + (fordeling.size ? `<div class="vei-fordeling"><h4 class="vei-h4">Fordeling ${IAAR}–${IAAR + 4} etter eierandeler</h4><table class="tabell"><tbody>${[...fordeling].map(([n, b]) => `<tr><td>${esc(n)}</td><td class="tall">${fmt(b)} kr</td></tr>`).join('')}</tbody></table></div>` : '');

    $('#veiTerreng').innerHTML = lange.length ? `<table class="tabell"><thead><tr><th>Bestand</th><th class="tall">Daa</th><th class="tall">m³</th><th class="tall">Til bilvei</th></tr></thead><tbody>
      ${lange.slice(0, 25).map((b) => `<tr data-bestand="${b.id}"><td>${esc(b.nr)}</td><td class="tall">${fmt(b.areal, 1)}</td><td class="tall">${fmt((b.volumDaa || 0) * (b.areal || 0))}</td><td class="tall">${fmt(tt.get(b.id).meter)} m</td></tr>`).join('')}</tbody></table>`
      : `<div class="tom">${r.veier.length ? `Alle bestand ligger innenfor ${fmt(inn().maksTerrengtransport)} m fra bilvei.` : 'Registrer veier for å beregne terrengtransport.'}</div>`;

    $('#veiSatser').innerHTML = [
      ...Object.entries(VEDLIKEHOLDSTYPER).filter(([k]) => k !== 'annet').map(([k, d]) => `<label>${esc(d.navn)} ${k === 'stikkrenne' ? '(kr/stk)' : '(kr/m)'}<input type="number" data-sats="vedlikehold.${k}.${k === 'stikkrenne' ? 'krPerStk' : 'krPerM'}" value="${inn().vedlikehold[k]?.[k === 'stikkrenne' ? 'krPerStk' : 'krPerM'] ?? 0}"></label>`),
      ...['hovling', 'grusing', 'grofterensk', 'kantrydding'].map((k) => `<label>${esc(VEDLIKEHOLDSTYPER[k].navn)}: intervall (år)<input type="number" data-sats="vedlikehold.${k}.intervall" value="${inn().vedlikehold[k]?.intervall ?? 0}"></label>`),
      ...[3, 4, 5, 7, 8].map((k) => `<label>Ny vei ${VEIKLASSER[k].kort} (kr/m)<input type="number" data-sats="nybyggKrPerM.${k}" value="${inn().nybyggKrPerM[k] ?? 0}"></label>`),
      `<label>Tilskudd til nye veier (%)<input type="number" data-sats="tilskuddProsent" value="${inn().tilskuddProsent}"></label>`,
      `<label>Lang terrengtransport fra (m)<input type="number" data-sats="maksTerrengtransport" value="${inn().maksTerrengtransport}"></label>`,
    ].join('');
  }

  // ---------- hendelser ----------
  const panel = $('#fane-veier');
  panel.addEventListener('click', async (e) => {
    const h = e.target.closest('[data-vh]')?.dataset.vh;
    const r = reg();
    const vei = r.veier.find((x) => x.id === valgtVei);
    const punkt = r.punkter.find((x) => x.id === valgtPunkt);
    const rad = e.target.closest('[data-vei]');
    if (rad && !h) { velgVei(rad.dataset.vei); const v = r.veier.find((x) => x.id === rad.dataset.vei); if (v?.geometri) kart.fitBounds(L.geoJSON(v.geometri).getBounds(), { padding: [40, 40], maxZoom: 16 }); return; }
    const best = e.target.closest('[data-bestand]');
    if (best) { visBestand(best.dataset.bestand); return; }
    if (!h) return;
    const loggId = e.target.closest('[data-logg]')?.dataset.logg;
    if (h === 'zoom' && vei) kart.fitBounds(L.geoJSON(vei.geometri).getBounds(), { padding: [40, 40], maxZoom: 16 });
    if (h === 'zoom-punkt' && punkt) kart.setView([punkt.geometri.coordinates[1], punkt.geometri.coordinates[0]], 17);
    if (h === 'slett' && vei && confirm(`Slette ${vei.navn || 'veien'} og vedlikeholdet som er registrert på den?`)) {
      r.veier = r.veier.filter((x) => x !== vei); r.vedlikehold = r.vedlikehold.filter((l) => l.veiId !== vei.id); valgtVei = null; lagre();
    }
    if (h === 'slett-punkt' && punkt && confirm('Slette punktet?')) { r.punkter = r.punkter.filter((x) => x !== punkt); valgtPunkt = null; lagre(); }
    if (h === 'ny-eier' && vei) { vei.eiere = [...(vei.eiere || []), { navn: '', andel: '' }]; lagre(false); }
    if (h === 'fjern-eier' && vei) { const i = Number(e.target.closest('[data-i]').dataset.i); vei.eiere.splice(i, 1); lagre(false); }
    if (h === 'slett-logg' && loggId) { r.vedlikehold = r.vedlikehold.filter((l) => l.id !== loggId); lagre(false); }
    if (h === 'logg-utfort' && loggId) { const l = r.vedlikehold.find((x) => x.id === loggId); l.status = e.target.checked ? 'utfort' : 'planlagt'; if (e.target.checked && l.aar > IAAR) l.aar = IAAR; lagre(false); }
    if (h === 'godta') { const f = forslag.splice(Number(e.target.dataset.i), 1)[0]; r.vedlikehold.push({ ...f, id: nyId('vl') }); lagre(false); }
    if (h === 'godta-alle') { r.vedlikehold.push(...forslag.map((f) => ({ ...f, id: nyId('vl') }))); forslag = []; lagre(false); }
    if (h === 'forkast') { forslag = []; tegn(); }
  });
  panel.addEventListener('change', (e) => {
    const r = reg();
    const vei = r.veier.find((x) => x.id === valgtVei);
    const punkt = r.punkter.find((x) => x.id === valgtPunkt);
    const f = e.target;
    if (f.closest('#veiSkjema') && vei) {
      const tall = ['klasse', 'bredde', 'aksellast', 'totalvekt', 'byggeaar'];
      vei[f.name] = tall.includes(f.name) ? (f.value === '' ? null : Number(f.value)) : f.value;
      lagre(['klasse', 'tilstand', 'status'].includes(f.name));
    } else if (f.dataset.eier && vei) {
      const i = Number(f.closest('[data-i]').dataset.i);
      vei.eiere[i][f.dataset.eier] = f.dataset.eier === 'andel' ? Number(f.value) : f.value;
      lagre(false);
    } else if (f.closest('#punktSkjema') && punkt) {
      punkt[f.name] = f.name === 'dimensjon' ? Number(f.value) || null : f.value;
      lagre(['type', 'tilstand'].includes(f.name));
    } else if (f.dataset.sats) {
      const deler = f.dataset.sats.split('.'); let o = inn();
      for (const d of deler.slice(0, -1)) { o[d] = o[d] || {}; o = o[d]; }
      o[deler.at(-1)] = Number(f.value);
      lagre(false);
    }
  });
  panel.addEventListener('submit', (e) => {
    if (e.target.id !== 'vedlikeholdSkjema') return;
    e.preventDefault();
    const vei = reg().veier.find((x) => x.id === valgtVei); if (!vei) return;
    const d = new FormData(e.target);
    const type = d.get('type');
    const kostnad = d.get('kostnad') ? Number(d.get('kostnad')) : Math.round(vedlikeholdKostnad(type, vei, inn()));
    reg().vedlikehold.push({ id: nyId('vl'), veiId: vei.id, type, aar: Number(d.get('aar')), status: d.get('status'), kostnad, utfortAv: d.get('utfortAv') || '', kommentar: '' });
    lagre(false);
  });
  $('#veiNvdbBtn').addEventListener('click', async () => {
    const S = hentPlan();
    const grense = S.eiendom.grense || (S.bestand.length ? { type: 'MultiPolygon', coordinates: S.bestand.filter((b) => b.geometri).flatMap((b) => (b.geometri.type === 'Polygon' ? [b.geometri.coordinates] : b.geometri.coordinates)) } : null);
    if (!grense) { melding('Planen mangler eiendomsgrense og bestand. Lag eller importer en plan først.'); return; }
    const knapp = $('#veiNvdbBtn'); knapp.disabled = true;
    try {
      const res = await hentNvdbVeier(grense, { medPrivate: $('#veiMedPrivate').checked, logg: (t) => { $('#veiNvdbStatus').textContent = t; } });
      S.datakilder = { ...(S.datakilder || {}), nvdb: res.kilde };
      const r = reg();
      let nye = 0; let oppdatert = 0;
      for (const v of res.veier) {
        const finnes = r.veier.find((x) => x.nvdb && x.vegnummer === v.vegnummer);
        if (finnes) { finnes.geometri = v.geometri; finnes.lengde = v.lengde; if (v.klasseKilde) { finnes.klasse = v.klasse; finnes.klasseKilde = v.klasseKilde; } oppdatert++; } else { r.veier.push({ id: nyId('v'), tilstand: 'ukjent', eiere: [], merknad: '', ...v }); nye++; }
      }
      let nyePunkter = 0;
      for (const p of res.punkter) if (!r.punkter.some((x) => x.nvdbId === p.nvdbId)) { r.punkter.push({ id: nyId('vp'), tilstand: 'ukjent', merknad: '', ...p }); nyePunkter++; }
      $('#veiNvdbStatus').textContent = `${nye} nye og ${oppdatert} oppdaterte veier, ${nyePunkter} nye punkter fra NVDB.${res.veier.some((v) => !v.klasseKilde) ? ' Veiklasse mangler i NVDB for noen veier – sett den manuelt.' : ''}`;
      lagre();
      if (res.veier.length) kart.fitBounds(L.geoJSON({ type: 'FeatureCollection', features: res.veier.map((v) => ({ type: 'Feature', geometry: v.geometri, properties: {} })) }).getBounds(), { padding: [30, 30] });
    } catch (err) { $('#veiNvdbStatus').textContent = `Kunne ikke hente fra NVDB: ${err.message}`; } finally { knapp.disabled = false; }
  });
  $('#veiTegnBtn').addEventListener('click', () => startTegning('vei'));
  $('#veiPunktBtn').addEventListener('click', () => startTegning('punkt', $('#veiPunktType').value));
  $('#veiTegnFerdig').addEventListener('click', fullforVei);
  $('#veiTegnAvbryt').addEventListener('click', stoppTegning);
  $('#veiForeslaBtn').addEventListener('click', () => {
    const r = reg();
    forslag = foreslaaVedlikehold(r.veier, r.vedlikehold, IAAR, inn());
    tegn();
    melding(forslag.length ? `${forslag.length} forslag ut fra intervaller, tilstand og registrert vedlikehold.` : 'Ingen forslag – vedlikeholdet er à jour.');
  });
  $('#veiEksportBtn').addEventListener('click', () => {
    const r = reg();
    const fc = { type: 'FeatureCollection', features: [
      ...r.veier.map((v) => ({ type: 'Feature', geometry: v.geometri, properties: { OBJEKT: 'Vei', NAVN: v.navn, VEGNUMMER: v.vegnummer, KLASSE: VEIKLASSER[v.klasse]?.navn, STATUS: v.status, TILSTAND: TILSTAND[v.tilstand || 'ukjent'].navn, LENGDE_M: v.lengde, EIERE: (v.eiere || []).map((x) => `${x.navn} ${x.andel}%`).join('; ') || null, MERKNAD: v.merknad || null } })),
      ...r.punkter.map((p) => ({ type: 'Feature', geometry: p.geometri, properties: { OBJEKT: PUNKTTYPER[p.type]?.navn, NAVN: p.navn, TILSTAND: TILSTAND[p.tilstand || 'ukjent'].navn, MERKNAD: p.merknad || null } })),
    ] };
    const url = URL.createObjectURL(new Blob([JSON.stringify(fc)], { type: 'application/geo+json' }));
    const a = document.createElement('a'); a.href = url; a.download = `veier-${new Date().toISOString().slice(0, 10)}.geojson`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  });

  return {
    oppdater() { valgtVei = null; valgtPunkt = null; forslag = []; stoppTegning(); tegnKart(); tegn(); },
    vis() { tegn(); },
    synlig(ja) { if (ja) lag.addTo(kart); else lag.remove(); },
    avstand(bestandId) { const S = hentPlan(); return terrengtransport(S.bestand.filter((b) => b.id === bestandId), reg().veier).get(bestandId); },
    terrengtransport() { const S = hentPlan(); return terrengtransport(S.bestand, reg().veier); },
    maks: () => inn().maksTerrengtransport,
  };
}
