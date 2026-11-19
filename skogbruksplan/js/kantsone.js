// 💧 Kantsone mot vann: 15 m buffer langs alle bekker, elver og vann på og inntil eiendommen. Kantsonen skal være
// flersjiktet og normalt urørt (Norsk PEFC Skogstandard krav 27: «med utgangspunkt i 10–15 m»; vannressursloven § 11:
// «et begrenset naturlig vegetasjonsbelte som motvirker avrenning og gir levested for planter og dyr»). Den gjelder all
// aktivitet i skogen: hogst, markberedning, gjødsling, sprøyting, kjøring og veibygging.
//   * Bekker og elver: NVE Elvenett (ELVIS, linjer – også små bekker).
//   * Vann: NVE Innsjødatabasen (flater) og AR5-vann i planen (markslag «vann»).
// Vann rett utenfor eiendomsgrensen tas med (en elv langs grensen gir kantsone inne på eiendommen).
// Geometri: buffer med Turf, union/snitt med polygon-clipping (gis inn – ingen DOM, testes i Node).

export const BREDDE = 15; // meter
// PEFC krav 27: bredere sone (25–30 m) i edellauv-, høgstaude-, storbregne- og sumpskog. Vegetasjonstypene (NIBIOs
// vegetasjonskart / Fremstad, eller anslag i planen) som får 30 m:
export const BRED = 30;
export const BRED_TYPER = {
  '5a': 'edellauvskog', '5b': 'edellauvskog',
  '4c': 'høgstaude-/storbregneskog', '4e': 'høgstaude-/storbregneskog', '4f': 'høgstaude-/storbregneskog', '6c': 'høgstaude-/storbregneskog', '7c': 'høgstaude-/storbregneskog',
  '8c': 'sumpskog', '8d': 'sumpskog',
};
export const bredFor = (b) => (BRED_TYPER[b?.vegetasjon?.kode] ? BRED : BREDDE);
export const KILDER = {
  elv: 'https://kart.nve.no/enterprise/rest/services/Elvenett1/MapServer/2/query',
  innsjo: 'https://kart.nve.no/enterprise/rest/services/Innsjodatabase2/MapServer/5/query',
};
// Tiltak som skal holdes utenfor kantsonen (eller gjennomføres med særlig hensyn)
export const BERORTE_TILTAK = ['sluttavvirkning', 'tynning', 'lukkethogst', 'markberedning', 'gjodsling', 'ungskogpleie', 'sproyting', 'veibygging'];
export const HENSYN = 'Kantsonen mot vann skal være flersjiktet og normalt urørt: ingen flatehogst, markberedning, gjødsling eller sprøyting, og ingen kjøring – kryss bekker bare på bru eller klopp.';

const arcgis = (base, [a, b, c, d], felt) => `${base}?geometry=${a.toFixed(6)},${b.toFixed(6)},${c.toFixed(6)},${d.toFixed(6)}&geometryType=esriGeometryEnvelope&inSR=4326&outSR=4326&spatialRel=esriSpatialRelIntersects&outFields=${felt}&returnGeometry=true&f=geojson&resultRecordCount=2000`;
function boks(g) {
  let a = Infinity; let b = Infinity; let c = -Infinity; let d = -Infinity;
  const gaa = (x) => { if (typeof x[0] === 'number') { a = Math.min(a, x[0]); b = Math.min(b, x[1]); c = Math.max(c, x[0]); d = Math.max(d, x[1]); } else x.forEach(gaa); };
  gaa(g.coordinates); return [a, b, c, d];
}
// PC-format: liste av polygoner (hver en liste av ringer)
const tilPC = (g) => (!g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
const fraPC = (mp) => (mp && mp.length ? { type: 'MultiPolygon', coordinates: mp } : null);

// Henter bekker/elver (linjer) og vann (flater) i et område rundt eiendommen (marg ca. 60 m).
export async function hentVann(grense, { hent = (u, o) => fetch(u, o) } = {}) {
  const [a, b, c, d] = boks(grense); const m = 0.0011; const bb = [a - m * 2, b - m, c + m * 2, d + m];
  const json = async (url) => { const r = await hent(url); if (!r.ok) throw new Error(`NVE svarte ${r.status}`); return r.json(); };
  const [elv, sjo] = await Promise.all([json(arcgis(KILDER.elv, bb, 'objekttype,elvenavn')), json(arcgis(KILDER.innsjo, bb, 'navn'))]);
  const linjer = (elv.features || []).filter((f) => f.geometry && /LineString/.test(f.geometry.type)).map((f) => ({ navn: f.properties?.elvenavn || '', type: f.properties?.objekttype || 'Elv/bekk', geometri: f.geometry }));
  const flater = (sjo.features || []).filter((f) => f.geometry && /Polygon/.test(f.geometry.type)).map((f) => ({ navn: f.properties?.navn || 'Vann', geometri: f.geometry }));
  return { linjer, flater };
}

// Kantsonen som MultiPolygon innenfor eiendommen (uten selve vannflatene). vann = { linjer, flater }, ekstraFlater = AR5-vann.
export function lagKantsone(vann, grense, { turf, PC, bredde = BREDDE, ekstraFlater = [], bred = null }) {
  if (!turf || !PC || !grense) return null;
  const buffere = []; const vannflater = [];
  for (const l of vann.linjer || []) { try { const b = turf.buffer({ type: 'Feature', geometry: l.geometri, properties: {} }, bredde, { units: 'meters', steps: 6 }); if (b) buffere.push(...tilPC(b.geometry)); } catch { /* hopp over */ } }
  for (const f of [...(vann.flater || []), ...ekstraFlater]) {
    vannflater.push(...tilPC(f.geometri));
    try { const b = turf.buffer({ type: 'Feature', geometry: f.geometri, properties: {} }, bredde, { units: 'meters', steps: 6 }); if (b) buffere.push(...tilPC(b.geometry)); } catch { /* hopp over */ }
  }
  if (!buffere.length) return null;
  let sone = PC.union(...buffere.map((p) => [p]));
  // Bredere sone (bred = { bredde, flater: [geometri] }) innenfor bestand med edellauv-, høgstaude-, storbregne- og sumpskog
  if (bred?.flater?.length && bred.bredde > bredde) {
    const brede = [];
    for (const g of [...(vann.linjer || []).map((l) => l.geometri), ...[...(vann.flater || []), ...ekstraFlater].map((f) => f.geometri)]) { try { const b = turf.buffer({ type: 'Feature', geometry: g, properties: {} }, bred.bredde, { units: 'meters', steps: 6 }); if (b) brede.push(...tilPC(b.geometry)); } catch { /* hopp over */ } }
    if (brede.length) { const innenfor = PC.intersection(PC.union(...brede.map((p) => [p])), PC.union(...bred.flater.flatMap((g) => tilPC(g)).map((p) => [p]))); if (innenfor.length) sone = PC.union(sone, innenfor); }
  }
  if (vannflater.length) sone = PC.difference(sone, ...vannflater.map((p) => [p]));
  sone = PC.intersection(sone, tilPC(grense));
  return fraPC(sone);
}
// Kantsone per bestand: { id → { daa, andel } } (bare bestand med kantsone).
export function kantsonePerBestand(bestand, sone, { turf, PC }) {
  const ut = {}; if (!sone) return ut; const s = tilPC(sone);
  for (const b of bestand || []) {
    if (!b.geometri) continue;
    let snitt = null; try { snitt = fraPC(PC.intersection(tilPC(b.geometri), s)); } catch { /* ugyldig geometri */ }
    if (!snitt) continue; const daa = turf.area({ type: 'Feature', geometry: snitt, properties: {} }) / 1000;
    if (daa >= 0.05) ut[b.id] = { daa: Math.round(daa * 10) / 10, andel: b.areal ? Math.min(1, daa / b.areal) : null, bredde: bredFor(b), ...(BRED_TYPER[b.vegetasjon?.kode] ? { grunn: BRED_TYPER[b.vegetasjon.kode] } : {}) };
  }
  return ut;
}
// Henter vann, lager kantsonen og legger den inn i planen: S.kantsone og b.kantsone. Gir antall bestand berørt.
export async function oppdaterKantsone(S, { turf, PC, hent, bredde = BREDDE, iDag = new Date().toISOString().slice(0, 10) } = {}) {
  const grense = S.eiendom?.grense; if (!grense) throw new Error('Planen mangler eiendomsgrense');
  const vann = await hentVann(grense, { hent });
  const ar5 = (S.markslag || []).filter((f) => f.kategori === 'vann' && f.geometri).map((f) => ({ navn: 'Vann (AR5)', geometri: f.geometri }));
  const brede = (S.bestand || []).filter((b) => b.geometri && BRED_TYPER[b.vegetasjon?.kode]);
  const sone = lagKantsone(vann, grense, { turf, PC, bredde, ekstraFlater: ar5, bred: { bredde: BRED, flater: brede.map((b) => b.geometri) } });
  const per = kantsonePerBestand(S.bestand, sone, { turf, PC });
  for (const b of S.bestand || []) { if (per[b.id]) b.kantsone = per[b.id]; else delete b.kantsone; }
  const daa = sone ? Math.round((turf.area({ type: 'Feature', geometry: sone, properties: {} }) / 1000) * 10) / 10 : 0;
  const navn = [...new Set([...vann.linjer, ...vann.flater].map((x) => x.navn).filter(Boolean))].slice(0, 12);
  S.kantsone = { bredde, bred: BRED, bredeBestand: brede.length, geometri: sone, daa, bekker: vann.linjer.length, vann: vann.flater.length + ar5.length, navn, hentet: iDag, kilde: 'NVE Elvenett og Innsjødatabasen, AR5' };
  return { daa, bestand: Object.keys(per).length };
}

export const harKantsone = (b) => (b?.kantsone?.daa || 0) >= 0.05;
// Kort tekst til bestandsinfo og tiltak
export const kantsoneTekst = (b, bredde = BREDDE) => (harKantsone(b) ? `${String(b.kantsone.daa).replace('.', ',')} daa kantsone mot vann (${b.kantsone.bredde || bredde} m${b.kantsone.grunn ? ` – ${b.kantsone.grunn}` : ''})${b.kantsone.andel != null ? ` – ${b.kantsone.andel < 0.01 ? 'under 1' : Math.round(b.kantsone.andel * 100)} % av bestandet` : ''}` : '');
