// Endre flaten til et tiltak i kartet – felles for SkogIQ Felt og fullversjonen.
// Dra hjørnene, dra/trykk kantpunktene for nye hjørner, trykk på et hjørne og «Slett punkt», eller tegn et område som
// legges til, trekkes fra eller erstatter flaten. Resultatet klippes mot bestandet. Verten videresender kartklikk med
// klikk(latlng) (bestandsflatene stopper klikk før de når kartet).
import { forenkleForRedigering, kombiner, klippTilBestand, fraGeometri, tilGeometri, tilUtmPunkt, tilGeoPunkt, antallPunkter } from './flate-geometri.js';

const STIL = `
.flate-verktoy { position: fixed; z-index: 1150; background: #10241c; color: #fff; border-radius: 14px; padding: 10px 12px; box-shadow: 0 8px 28px rgba(0,0,0,.28); font: 13.5px/1.35 'Schibsted Grotesk', system-ui, sans-serif; display: grid; gap: 8px; }
.flate-verktoy.felt { left: 10px; right: 70px; top: calc(74px + env(safe-area-inset-top, 0px)); }
.flate-verktoy.full { left: 50%; transform: translateX(-50%); top: 76px; width: min(560px, calc(100vw - 120px)); }
.flate-verktoy .fv-hint { color: #b9c9bf; font-size: 12.5px; }
.flate-verktoy .fv-rad { display: flex; flex-wrap: wrap; gap: 6px; }
.flate-verktoy button { flex: 1 1 auto; border: 1px solid rgba(255,255,255,.25); background: #fbfcfa; color: #10241c; border-radius: 10px; padding: 8px 10px; font: 600 13px/1.2 inherit; cursor: pointer; touch-action: manipulation; min-height: 36px; }
@media (max-width: 600px) { .flate-verktoy { padding: 8px 10px; gap: 6px; } .flate-verktoy button { padding: 6px 8px; font-size: 12.5px; min-height: 34px; } .flate-verktoy .fv-hint { font-size: 11.5px; } .flate-verktoy.redigert .fv-hint { display: none; } }
.flate-verktoy button.primar { background: #c93a55; border-color: #c93a55; color: #fff; }
.flate-verktoy button.aktiv { background: #7fd1a4; border-color: #7fd1a4; }
.flate-verktoy button:disabled { opacity: .45; }
.fv-hjorne { width: 22px !important; height: 22px !important; margin: -11px 0 0 -11px !important; border-radius: 50%; background: #fff; border: 3px solid #0d4d30; box-shadow: 0 1px 4px rgba(0,0,0,.35); }
.fv-hjorne.valgt { background: #c93a55; border-color: #fff; }
.fv-midt { width: 16px !important; height: 16px !important; margin: -8px 0 0 -8px !important; border-radius: 50%; background: rgba(255,255,255,.75); border: 2px solid #0d4d30; opacity: .85; }
.fv-tegn { width: 14px !important; height: 14px !important; margin: -7px 0 0 -7px !important; border-radius: 50%; background: #c93a55; border: 2px solid #fff; }
`;
const dk = (v) => Number(v || 0).toLocaleString('nb-NO', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const ll = ([x, y]) => { const [lon, lat] = tilGeoPunkt([x, y]); return [lat, lon]; };
const fraLl = (p) => tilUtmPunkt([p.lng, p.lat]);
const OP_TEKST = { 'legg-til': 'Tegn området som skal legges til', fjern: 'Tegn området som skal fjernes', ny: 'Tegn den nye flaten' };

export function startFlateRedigering({ L, kart, PC, start = null, bestand, tittel = '', plassering = 'felt', vedFerdig, vedAvbryt = () => {} }) {
  if (!document.getElementById('flate-redigering-stil')) { const s = document.createElement('style'); s.id = 'flate-redigering-stil'; s.textContent = STIL; document.head.appendChild(s); }
  let mp = forenkleForRedigering(fraGeometri(start));
  const forenklet = start && antallPunkter(fraGeometri(start)) > antallPunkter(mp);
  let valgt = null; // { p, r, i }
  let tegning = null; // { op, punkter: [UTM] }
  const angreStabel = [];
  const lag = L.layerGroup().addTo(kart);
  const bestandLag = L.geoJSON(bestand.geometri, { style: { color: '#ffd400', weight: 3, fill: false, dashArray: '6 4' }, interactive: false }).addTo(kart);
  const el = document.createElement('div'); el.className = `flate-verktoy ${plassering}`; document.body.appendChild(el);
  L.DomEvent.disableClickPropagation(el); L.DomEvent.disableScrollPropagation(el);
  const lagre = () => { el.classList.add('redigert'); angreStabel.push(JSON.stringify(mp)); if (angreStabel.length > 30) angreStabel.shift(); };

  // ---------- tegning av flaten ----------
  let polygoner = [];
  function tegn() {
    lag.clearLayers(); polygoner = [];
    mp.forEach((poly, p) => {
      const pg = L.polygon(poly.map((r) => r.slice(0, -1).map(ll)), { color: '#0d4d30', weight: 2, fillColor: '#1f8f5a', fillOpacity: 0.38, interactive: false }).addTo(lag);
      polygoner[p] = pg;
      if (tegning) return;
      poly.forEach((ring, r) => {
        const n = ring.length - 1;
        for (let i = 0; i < n; i++) {
          // Kantpunkt mellom hjørne i og i+1: dra eller trykk for å lage et nytt hjørne.
          const a = ring[i]; const b = ring[(i + 1) % n];
          const midt = L.marker(ll([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]), { draggable: true, icon: L.divIcon({ className: 'fv-midt', iconSize: [16, 16] }), keyboard: false, zIndexOffset: 500 }).addTo(lag);
          let ny = null;
          midt.on('dragstart', () => { lagre(); ring.splice(i + 1, 0, fraLl(midt.getLatLng())); ny = i + 1; });
          midt.on('drag', () => { if (ny == null) return; ring[ny] = fraLl(midt.getLatLng()); oppdaterPolygon(p); });
          midt.on('dragend', () => { ny = null; tegn(); });
          midt.on('click', () => { lagre(); ring.splice(i + 1, 0, fraLl(midt.getLatLng())); valgt = { p, r, i: i + 1 }; tegn(); });
        }
        for (let i = 0; i < n; i++) {
          const erValgt = valgt && valgt.p === p && valgt.r === r && valgt.i === i;
          const m = L.marker(ll(ring[i]), { draggable: true, icon: L.divIcon({ className: `fv-hjorne${erValgt ? ' valgt' : ''}`, iconSize: [22, 22] }), keyboard: false, zIndexOffset: 1000 }).addTo(lag);
          m.on('dragstart', lagre);
          m.on('drag', () => { ring[i] = fraLl(m.getLatLng()); if (i === 0) ring[n] = ring[0]; oppdaterPolygon(p); });
          m.on('dragend', () => { valgt = { p, r, i }; tegn(); });
          m.on('click', () => { valgt = erValgt ? null : { p, r, i }; tegn(); });
        }
      });
    });
    if (tegning) {
      const pts = tegning.punkter.map(ll);
      if (pts.length >= 3) L.polygon(pts, { color: tegning.op === 'fjern' ? '#c93a55' : '#0d4d30', weight: 2, dashArray: '5 4', fillColor: tegning.op === 'fjern' ? '#c93a55' : '#1f8f5a', fillOpacity: 0.3, interactive: false }).addTo(lag);
      else if (pts.length === 2) L.polyline(pts, { color: '#c93a55', weight: 2, dashArray: '5 4', interactive: false }).addTo(lag);
      pts.forEach((q) => L.marker(q, { icon: L.divIcon({ className: 'fv-tegn', iconSize: [14, 14] }), interactive: false }).addTo(lag));
    }
    verktoy();
  }
  function oppdaterPolygon(p) { polygoner[p]?.setLatLngs(mp[p].map((r) => r.slice(0, -1).map(ll))); }

  // ---------- verktøylinje ----------
  function verktoy() {
    const k = klippTilBestand(mp, bestand.geometri, PC);
    if (tegning) {
      const n = tegning.punkter.length;
      el.innerHTML = `<div><b>${OP_TEKST[tegning.op]}</b> · ${n} punkt${n === 1 ? '' : 'er'}</div>
        <div class="fv-hint">Trykk i kartet for hvert hjørne.</div>
        <div class="fv-rad"><button type="button" data-fv="angre-punkt" ${n ? '' : 'disabled'}>Angre</button><button type="button" data-fv="avbryt-tegning">Avbryt</button><button type="button" class="primar" data-fv="bruk-tegning" ${n >= 3 ? '' : 'disabled'}>Bruk</button></div>`;
      return;
    }
    el.innerHTML = `<div><b>Endre flate${tittel ? ` · ${tittel}` : ''}</b> · ${dk(k.daa)} daa (${Math.round(k.andel * 100)} % av bestandet)</div>
      <div class="fv-hint">${mp.length ? 'Dra hjørnene. Dra eller trykk de små kantpunktene for nye hjørner. Trykk et hjørne for å slette det.' : 'Ingen flate ennå – tegn en ny, eller start med hele bestandet.'}${forenklet ? ' Flaten er forenklet for redigering.' : ''}</div>
      <div class="fv-rad"><button type="button" data-fv="legg-til">＋ Legg til område</button><button type="button" data-fv="fjern" ${mp.length ? '' : 'disabled'}>− Fjern område</button><button type="button" data-fv="ny">Tegn på nytt</button><button type="button" data-fv="hele">Hele bestandet</button></div>
      <div class="fv-rad"><button type="button" data-fv="slett-punkt" ${valgt ? '' : 'disabled'}>Slett punkt</button><button type="button" data-fv="angre" ${angreStabel.length ? '' : 'disabled'}>Angre</button><button type="button" data-fv="avbryt">Avbryt</button><button type="button" class="primar" data-fv="ferdig">Ferdig</button></div>`;
  }
  function slettPunkt() {
    if (!valgt) return; lagre();
    const { p, r, i } = valgt; const ring = mp[p][r];
    ring.splice(i, 1); if (i === 0) ring[ring.length - 1] = ring[0];
    if (ring.length < 4) { if (r === 0) mp.splice(p, 1); else mp[p].splice(r, 1); }
    valgt = null; tegn();
  }
  function avslutt() { lag.remove(); bestandLag.remove(); el.remove(); document.removeEventListener('keydown', tast); aktiv = false; }
  const tast = (e) => { if (e.key === 'Escape') { if (tegning) { tegning = null; tegn(); } else { avslutt(); vedAvbryt(); } } };
  document.addEventListener('keydown', tast);
  el.addEventListener('click', (e) => {
    const h = e.target.closest('[data-fv]')?.dataset.fv; if (!h) return;
    if (['legg-til', 'fjern', 'ny'].includes(h)) { tegning = { op: h, punkter: [] }; valgt = null; tegn(); return; }
    if (h === 'hele') { lagre(); mp = forenkleForRedigering(fraGeometri(bestand.geometri)); valgt = null; tegn(); return; }
    if (h === 'angre-punkt') { tegning.punkter.pop(); tegn(); return; }
    if (h === 'avbryt-tegning') { tegning = null; tegn(); return; }
    if (h === 'bruk-tegning') {
      lagre();
      try { mp = forenkleForRedigering(kombiner(mp, tegning.punkter, tegning.op, PC), { maks: 220 }); } catch { /* ugyldig omriss */ }
      tegning = null; valgt = null; tegn(); return;
    }
    if (h === 'slett-punkt') { slettPunkt(); return; }
    if (h === 'angre') { const s = angreStabel.pop(); if (s) { mp = JSON.parse(s); valgt = null; tegn(); } return; }
    if (h === 'avbryt') { avslutt(); vedAvbryt(); return; }
    if (h === 'ferdig') {
      // Hjørner som er dratt over hverandre ryddes med union før klipping.
      let ren = mp; try { ren = mp.length ? PC.union(mp) : []; } catch { /* behold */ }
      const k = klippTilBestand(ren, bestand.geometri, PC);
      avslutt(); vedFerdig({ geometri: tilGeometri(k.mp), daa: Math.round(k.daa * 100) / 100, andel: k.andel });
    }
  });

  let aktiv = true;
  tegn();
  const bb = (mp.length ? L.polygon(mp.map((p) => p.map((r) => r.map(ll)))) : bestandLag).getBounds();
  if (bb.isValid()) kart.fitBounds(bb, { padding: [40, 40], paddingTopLeft: [40, 220], maxZoom: 18 });
  return {
    aktiv: () => aktiv,
    // Kartklikk fra verten: legger til et punkt når man tegner, ellers fjernes valget av hjørne.
    klikk(latlng) { if (!aktiv) return; if (tegning) { tegning.punkter.push(fraLl(latlng)); tegn(); } else if (valgt) { valgt = null; tegn(); } },
    avbryt() { if (aktiv) { avslutt(); vedAvbryt(); } },
  };
}
