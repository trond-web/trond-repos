// Artsfilter: rødlistede artsfunn (Artskart, Artsdatabanken) vurdert mot planlagte tiltak i bestandet. Ingen DOM,
// testes i Node. Idé og innspill: Frode Mohus (Skogfilter, tiltaksstyrt naturfilter).
//
// 1. Artsfunn: Artskart sitt åpne API, filtrert på rødlistestatus (CR, EN, VU, NT, DD) i en boks rundt eiendommen.
//    Hvert funn knyttes til eiendom og bestand: i bestandet, kan ligge i bestandet (unøyaktig posisjon), nær
//    (under 200 m) eller ellers på eiendommen.
// 2. Livsmiljø: Norsk rødliste 2021 (lister.artsdatabanken.no, OData) gir hovedhabitat og fagteksten for arten.
//    Ut fra den lages en enkel profil: skogart, gammel skog, død ved, på trær (epifytt), i marka, fuktig, rik mark,
//    treslag (gran, furu, lauv) og hekkende fugl.
// 3. Tiltaksfilter: profilen sammenholdes med hva tiltaket påvirker (hogst, lysåpning, mark, vann og kjemi), med
//    bestandet (treslag, alder) og funnets plassering. Resultatet per art er:
//      S1 direkte relevant – må vurderes før tiltaket
//      S2 betinget – kan bli påvirket, sjekk forholdene
//      S3 ikke påvirket av dette tiltaket
//    Alle vurderinger har en forklaring («fordi …»). Reglene er et første utkast og skal kvalitetssikres faglig.
// Viktig: ingen funn betyr ikke at det ikke finnes arter. Artskart viser bare det noen har registrert, og sensitive
// arter vises med grov posisjon eller er skjult.
import { punktIGeometri, geoTilUtm } from './proj.js';
import { hogstklasseFor, treslagAndel, STANDARD_INNSTILLINGER } from './model.js';

export const ARTSKART = 'https://artskart.artsdatabanken.no/publicapi/api/observations/list';
export const RODLISTE = 'https://lister.artsdatabanken.no/odata/v1/SpeciesAssessment2021';
export const KILDE = 'Artsfunn: Artskart, Artsdatabanken (CC BY 4.0). Livsmiljø: Norsk rødliste for arter 2021, Artsdatabanken.';
export const KATEGORI = { CR: { navn: 'kritisk truet', farge: '#7a0019' }, EN: { navn: 'sterkt truet', farge: '#d0262f' }, VU: { navn: 'sårbar', farge: '#f07d00' }, NT: { navn: 'nær truet', farge: '#e8c200' }, DD: { navn: 'datamangel', farge: '#8a8a8a' } };
export const NIVA = { S1: { navn: 'Direkte relevant', kort: 'S1', farge: '#c62828', tekst: 'Må vurderes før tiltaket' }, S2: { navn: 'Betinget', kort: 'S2', farge: '#e0a100', tekst: 'Kan bli påvirket – sjekk forholdene' }, S3: { navn: 'Ikke påvirket', kort: 'S3', farge: '#6b8f71', tekst: 'Påvirkes ikke av dette tiltaket' } };

// Hva hvert tiltak påvirker (0–3): hogst (trær fjernes), lys (lysåpning, uttørking), mark (kjøring, markberedning),
// vann (grøfting, bekker) og kjemi (gjødsel).
export const TILTAK_PAVIRKNING = {
  sluttavvirkning: { hogst: 3, lys: 3, mark: 2, vann: 1 },
  lukkethogst: { hogst: 2, lys: 1, mark: 1 },
  tynning: { hogst: 2, lys: 1, mark: 1 },
  ungskogpleie: { hogst: 1, lys: 1 },
  markberedning: { mark: 3, vann: 1 },
  planting: { mark: 1 }, suppleringsplanting: { mark: 1 },
  stammekvisting: {},
  gjodsling: { kjemi: 2, mark: 1 },
  groftrensk: { vann: 3, mark: 1, lys: 1 },
  vei: { mark: 3, vann: 2, hogst: 2, lys: 1 },
  miljo: {}, annet: { mark: 1 },
};
// Hva hvert trekk i livsmiljøet er sårbart for (vekt 1–3).
const SARBAR = {
  gammel: { hogst: 3, lys: 2 }, dodved: { hogst: 3, mark: 2 }, epifytt: { hogst: 3, lys: 2 },
  mark: { mark: 3, lys: 1, kjemi: 1 }, fuktig: { vann: 3, lys: 2, mark: 1 }, rik: { kjemi: 2, mark: 1 },
  hekker: { hogst: 2, lys: 1 },
};
const TREKK_TEKST = { gammel: 'gammel skog / gamle trær', dodved: 'død ved', epifytt: 'vokser på trær', mark: 'lever i marka', fuktig: 'fuktige miljø', rik: 'rik/kalkrik mark', hekker: 'hekker i skog' };
const PAV_TEKST = { hogst: 'hogst', lys: 'lysåpning og uttørking', mark: 'kjøring og markskader', vann: 'endret vannføring', kjemi: 'gjødsling' };

// ---------- henting ----------
const tall = (v) => (v == null || v === '' ? null : Number(String(v).replace(',', '.')));
// Boks rundt geometrien (lon/lat), utvidet med buffer i meter. Gir [minLon, minLat, maxLon, maxLat].
export function boks(geom, bufferM = 200) {
  const pts = []; const gaa = (c) => { if (typeof c[0] === 'number') pts.push(c); else c.forEach(gaa); }; gaa(geom.coordinates);
  const lon = pts.map((p) => p[0]); const lat = pts.map((p) => p[1]); const midt = (Math.min(...lat) + Math.max(...lat)) / 2;
  const dLat = bufferM / 111320; const dLon = bufferM / (111320 * Math.cos((midt * Math.PI) / 180));
  return [Math.min(...lon) - dLon, Math.min(...lat) - dLat, Math.max(...lon) + dLon, Math.max(...lat) + dLat];
}
export const wkt = ([a, b, c, d]) => `POLYGON((${a} ${b},${c} ${b},${c} ${d},${a} ${d},${a} ${b}))`;

// Et funn fra Artskart i kortform (uten innsamlerens navn – dataminimering).
export function rensFunn(o) {
  const rl = (o.PropertyUrls || []).find((p) => p.Type === 'Norsk Rødliste 2021');
  const dato = String(o.CollectedDate || ''); const aar0 = Number((dato.match(/(\d{4})/) || [])[1]); const aar = aar0 >= 1700 && aar0 <= new Date().getFullYear() + 1 ? aar0 : null;
  const atferd = (o.Behavior || []).map(String);
  return { id: String(o.Id), navn: o.Name || o.ScientificName, vit: o.ScientificName, sciId: o.ScientificNameId, status: String(o.Status || '').replace(/[^A-Z]/g, '').slice(0, 2), gruppe: o.klass || o.kingdom || '', rike: o.kingdom || '', hekking: atferd.some((b) => /reproductive/i.test(b)),
    lon: tall(o.East ?? o.Longitude), lat: tall(o.North ?? o.Latitude), presisjon: tall(o.Precision), dato, aar, habitat: o.Habitat || '', lenke: o.ObsUrl || '', rodlisteUrl: rl?.Url || '' };
}

// Henter rødlistede funn rundt eiendommen. hent = fetch. Gir { funn, totalt, avkortet }.
export async function hentArtsfunn(grense, { hent = fetch, status = 'CR,EN,VU,NT,DD', sideStr = 1000, maksSider = 5, buffer = 200 } = {}) {
  const q = (side) => `${ARTSKART}?${new URLSearchParams({ 'filter.wktPolygon': wkt(boks(grense, buffer)), 'filter.crs': 'EPSG:4326', crs: 'EPSG:4326', 'filter.status': status, pageSize: String(sideStr), pageIndex: String(side) })}`;
  const funn = []; let totalt = 0; let sider = 1;
  for (let s = 0; s < Math.min(sider, maksSider); s++) {
    const r = await hent(q(s)); if (!r.ok) throw new Error(`Artskart svarte ${r.status}`);
    const d = await r.json(); totalt = d.TotalCount || 0; sider = d.TotalPages || 1;
    for (const o of d.Observations || []) { const f = rensFunn(o); if (Number.isFinite(f.lon) && Number.isFinite(f.lat)) funn.push(f); }
  }
  return { funn, totalt, avkortet: sider > maksSider };
}

// Rødlistevurderinger (2021, fastlands-Norge) for artene. Gir { [sciId]: { navn, vit, kategori, gruppe, habitat, tekst } }.
const rensTekst = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
// arter = [{ sciId, navn }] (eller bare sciId). Arter som har fått nytt vitenskapelig navn siden 2021 (f.eks.
// hønsehauk Astur/Accipiter gentilis), finnes ikke på id; de slås opp på norsk navn.
export async function hentRodliste(arter, { hent = fetch, bunke = 40 } = {}) {
  const liste = arter.map((a) => (typeof a === 'object' ? a : { sciId: a })).filter((a) => Number.isInteger(a.sciId));
  const ider = [...new Set(liste.map((a) => a.sciId))]; const ut = {};
  const SEL = 'id,scientificNameId,scientificName,popularName,category,speciesGroup,mainHabitat,expertStatement';
  const kort = (v) => ({ navn: v.popularName || v.scientificName, vit: v.scientificName, kategori: v.category, gruppe: v.speciesGroup || '', habitat: v.mainHabitat || [], tekst: rensTekst(v.expertStatement).slice(0, 1800), url: `https://artsdatabanken.no/lister/rodlisteforarter/2021/${v.id}` });
  const sporr = async (filter) => { const r = await hent(`${RODLISTE}?${new URLSearchParams({ $filter: `assessmentArea eq 'N' and ${filter}`, $select: SEL })}`); if (!r.ok) throw new Error(`Rødlista svarte ${r.status}`); return (await r.json()).value || []; };
  for (let i = 0; i < ider.length; i += bunke) for (const v of await sporr(`scientificNameId in (${ider.slice(i, i + bunke).join(',')})`)) ut[v.scientificNameId] = kort(v);
  const mangler = new Map(); for (const a of liste) if (!ut[a.sciId] && a.navn && /^[a-zæøå -]+$/i.test(a.navn)) mangler.set(a.navn.toLowerCase(), a.sciId);
  const navn = [...mangler.keys()];
  for (let i = 0; i < navn.length; i += bunke) for (const v of await sporr(`popularName in (${navn.slice(i, i + bunke).map((n) => `'${n.replace(/'/g, "''")}'`).join(',')})`)) { const id = mangler.get(String(v.popularName).toLowerCase()); if (id && !ut[id]) ut[id] = kort(v); }
  return ut;
}

// ---------- livsmiljø ----------
const SKOGHABITAT = /skog/i;
const ORD = {
  gammel: /eldre skog|gammel ?skog|gammelskog|urskog|naturskog|kontinuitet|gamle (?:trær|graner|furuer|osper|eiker|lauvtrær)|gammel(?:e)? (?:gran|furu|osp|eik)|høy alder|gamle stammer|kontinuitetsskog/i,
  dodved: /død ved|dødved|læger|liggende (?:stammer|død)|stående død|gadd|morken|råtnende|vedboende|nedbrutt ved|dødt trevirke|vedlevende/i,
  epifytt: /på bark|barken|epifytt|på trær|på stammer|på greiner|hengelav|rikbark|på (?:gran|furu|osp|selje|eik|ask|alm|lind|bjørk)(?:e|a|en|er)?\b/i,
  mark: /mykorrhiza|på bakken|i jorda|jordboende|markboende|i strø|i mosedekket|marklevende|på marka/i,
  // «luftfuktighet» (hengelav o.l.) handler om lysåpning, ikke grøfting – derfor ikke med her.
  fuktig: /(?<!luft)fuktig|bekk|sump|kilde|elv|bekkekløft|fossesprut|myrkant|sig|grunnvann|våt/i,
  rik: /lågurt|høgstaude|kalk|baserik|rik (?:skog|mark)|kalkrik|rike/i,
};
const TRESLAG_ORD = { G: /\bgran(?:skog|a|er|trær)?\b|picea|barskog|bartre|barblandingsskog/i, F: /\bfuru(?:skog|a|er|trær)?\b|pinus|barskog|bartre|barblandingsskog/i, L: /osp|bjørk|selje|\bor\b|older|eik|ask\b|alm\b|lind|hassel|lønn|edelløv|lauvskog|lauvtre|rogn|hegg|vier/i };

// Profil for en art: { skog, trekk: [...], treslag: ['G', …], forklaring }.
export function profil(art) {
  if (!art) return { skog: null, trekk: [], treslag: [], forklaring: 'Ikke vurdert på rødlista (2021)' };
  const tekst = `${art.tekst || ''}`; const hab = (art.habitat || []).join(', ');
  // Habitatene er oppgitt i rekkefølge etter betydning: skog først = hovedsakelig skogart.
  const skog = (art.habitat || []).some((h) => SKOGHABITAT.test(h)) || (!(art.habitat || []).length && /skog/i.test(tekst));
  const skogHoved = skog && (!(art.habitat || []).length || SKOGHABITAT.test(art.habitat[0]));
  const mobil = ['Fugler', 'Pattedyr'].includes(art.gruppe);
  const trekk = Object.keys(ORD).filter((k) => ORD[k].test(tekst));
  if (art.gruppe === 'Fugler' && skog) trekk.push('hekker');
  const treslag = Object.keys(TRESLAG_ORD).filter((t) => TRESLAG_ORD[t].test(tekst));
  return { skog, skogHoved, mobil, trekk: [...new Set(trekk)], treslag, forklaring: `${hab ? `Hovedhabitat: ${hab}` : 'Habitat ikke oppgitt'}${trekk.length ? `. Knyttet til ${trekk.map((t) => TREKK_TEKST[t]).join(', ')}` : ''}${treslag.length ? ` (${treslag.map((t) => ({ G: 'gran', F: 'furu', L: 'lauvtrær' })[t]).join(', ')})` : ''}` };
}

// ---------- plassering ----------
const utm = ([lon, lat]) => geoTilUtm(lon, lat, 33);
function avstandSegment(p, a, b) { const dx = b[0] - a[0]; const dy = b[1] - a[1]; const l = dx * dx + dy * dy; const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); }
// Avstand i meter fra punktet til geometrien (0 når punktet er inni).
export function avstand(pt, geom) {
  if (!geom) return Infinity; if (punktIGeometri(pt, geom)) return 0;
  const p = utm(pt); let min = Infinity;
  const ringer = geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flat();
  for (const r of ringer) { const u = r.map(utm); for (let i = 1; i < u.length; i++) min = Math.min(min, avstandSegment(p, u[i - 1], u[i])); }
  return min;
}
// Hvor ligger funnet i forhold til bestandet? 'i' | 'kanskje' (innenfor presisjonen) | 'naer' (< 200 m) | 'fjern'.
export function plassering(f, geom) {
  const d = avstand([f.lon, f.lat], geom); const pres = f.presisjon || 0;
  if (d === 0) return { sted: pres > 500 ? 'kanskje' : 'i', avstand: 0 };
  if (d <= pres) return { sted: 'kanskje', avstand: Math.round(d) };
  if (d <= 200) return { sted: 'naer', avstand: Math.round(d) };
  return { sted: 'fjern', avstand: Math.round(d) };
}
const STED_TEKST = { i: 'funnet i bestandet', kanskje: 'kan ligge i bestandet (unøyaktig posisjon)', naer: 'funnet like ved', fjern: 'funnet lenger unna' };

// ---------- vurdering ----------
// Vurder én art mot ett tiltak i ett bestand. funn = artens funn (med plassering). Gir { niva, grunner }.
export function vurder({ art, prof, funn, bestand, tiltak, inn = STANDARD_INNSTILLINGER, iAar = new Date().getFullYear() }) {
  const p = prof || profil(art); const g = [];
  const nest = ['i', 'kanskje', 'naer', 'fjern'].find((s) => funn.some((f) => f.sted === s)) || 'fjern';
  const nyeste = Math.max(...funn.map((f) => f.aar || 0)) || null;
  g.push(`${STED_TEKST[nest]}${nest === 'naer' || nest === 'fjern' ? ` (${Math.min(...funn.map((f) => f.avstand))} m)` : ''}${nyeste ? `, sist registrert ${nyeste}` : ''}`);
  if (p.skog === false) return { niva: 'S3', grunner: [...g, `lever ikke i skog (${(art?.habitat || []).join(', ') || 'annet habitat'})`] };
  if (nest === 'fjern') return { niva: 'S3', grunner: g };
  const pav = TILTAK_PAVIRKNING[tiltak] || {};
  // Sterkeste kobling mellom artens sårbarhet og det tiltaket påvirker
  let styrke = 0; const hva = new Set();
  for (const t of p.trekk) for (const [k, v] of Object.entries(SARBAR[t] || {})) if (pav[k]) { const s = Math.min(v, pav[k]); if (s > 0) hva.add(k); styrke = Math.max(styrke, s); }
  if (!p.trekk.length) { styrke = Object.values(pav).some((v) => v >= 2) ? 2 : Object.values(pav).some((v) => v) ? 1 : 0; if (styrke) g.push('skogart uten kjente livsmiljøkrav i rødlisteteksten – må vurderes'); }
  else if (hva.size) g.push(`${p.trekk.map((t) => TREKK_TEKST[t]).join(', ')} – sårbar for ${[...hva].map((k) => PAV_TEKST[k]).join(' og ')}`);
  else g.push(`${p.trekk.map((t) => TREKK_TEKST[t]).join(', ')} – lite berørt av ${tiltak}`);
  let niva = styrke >= 3 ? 'S1' : styrke === 2 ? (nest === 'naer' ? 'S2' : 'S1') : styrke === 1 ? 'S2' : 'S3';
  if (nest === 'naer' && niva === 'S1') niva = 'S2';
  // Bestandet passer ikke med artens krav → ett nivå ned (med forklaring)
  const ned = () => { niva = niva === 'S1' ? 'S2' : 'S3'; };
  if (niva !== 'S3' && bestand) {
    const a = bestand.treslagAndel ? treslagAndel(bestand.treslagAndel) : { [bestand.treslag || 'G']: 1 };
    // Treslagskravet gjelder arter som er bundet til trærne (ikke fugler og pattedyr, som bruker hele landskapet).
    if (!p.mobil && p.treslag.length && !p.treslag.some((t) => (a[t] || 0) >= 0.1)) { ned(); g.push(`bestandet mangler treslaget arten er knyttet til (${p.treslag.map((t) => ({ G: 'gran', F: 'furu', L: 'lauv' })[t]).join('/')})`); }
    const hk = hogstklasseFor(bestand, inn);
    if (p.trekk.includes('gammel') && hk && hk <= 2 && (!nyeste || iAar - nyeste > 25)) { ned(); g.push(`arten trenger gammel skog, men bestandet er nå hogstklasse ${hk}`); }
  }
  // Skog er bare ett av flere habitater → høyst S2
  if (p.skog && p.skogHoved === false && niva === 'S1') { niva = 'S2'; g.push(`skog er ikke hovedhabitatet (${(art?.habitat || []).slice(0, 2).join(', ')} …)`); }
  // Fugler og pattedyr beveger seg: et funn betyr ikke at de bruker bestandet, med mindre hekking/yngling er registrert
  const mobil = p.mobil ?? ['Aves', 'Mammalia'].includes(funn[0]?.gruppe);
  const hekkerHer = funn.some((f) => f.hekking && (f.sted === 'i' || f.sted === 'kanskje'));
  if (mobil && niva === 'S1' && !hekkerHer) { niva = 'S2'; g.push('mobil art – observert, men ingen hekking/yngling registrert i bestandet'); }
  if (hekkerHer) g.push('hekking/yngling registrert i bestandet');
  if ((p.trekk.includes('hekker') || hekkerHer) && pav.hogst) g.push('unngå hogst i hekketida (april–juli)');
  if (nyeste && iAar - nyeste > 40 && niva === 'S1') { niva = 'S2'; g.push('gammelt funn – kontroller om arten fortsatt finnes'); }
  return { niva, grunner: g };
}

// Vurder alle artsfunn mot ett bestand. Tiltakene som vurderes: planlagte (ikke utførte), ellers sluttavvirkning.
// Gir { tiltak: [{ type, aar, arter: [{ sciId, navn, vit, kategori, niva, grunner, funn, art, prof }] }], antall: { S1, S2, S3 } }.
export function vurderBestand(data, bestand, { inn = STANDARD_INNSTILLINGER, iAar = new Date().getFullYear() } = {}) {
  if (!data?.funn?.length || !bestand?.geometri) return { tiltak: [], antall: { S1: 0, S2: 0, S3: 0 } };
  const perArt = new Map();
  for (const f of data.funn) { const p = plassering(f, bestand.geometri); if (p.sted === 'fjern' && p.avstand > 1000) continue; const l = perArt.get(f.sciId) || []; l.push({ ...f, ...p }); perArt.set(f.sciId, l); }
  const planlagt = (bestand.tiltak || []).filter((t) => t.status !== 'utfort' && TILTAK_PAVIRKNING[t.type] && Object.keys(TILTAK_PAVIRKNING[t.type]).length);
  const tiltak = (planlagt.length ? planlagt : [{ type: 'sluttavvirkning', aar: null, antatt: true }]).filter((t, i, l) => l.findIndex((x) => x.type === t.type) === i);
  const antall = { S1: 0, S2: 0, S3: 0 };
  const ut = tiltak.map((t) => {
    const arter = [...perArt.entries()].map(([sciId, funn]) => {
      const art = data.arter?.[sciId] || null; const prof = profil(art);
      const v = vurder({ art, prof, funn, bestand, tiltak: t.type, inn, iAar });
      return { sciId, navn: art?.navn || funn[0].navn, vit: art?.vit || funn[0].vit, kategori: String(art?.kategori || funn[0].status || '').replace(/[^A-Z]/g, '').slice(0, 2), niva: v.niva, grunner: v.grunner, funn, art, prof };
    }).sort((a, b) => a.niva.localeCompare(b.niva) || ['CR', 'EN', 'VU', 'NT', 'DD'].indexOf(a.kategori) - ['CR', 'EN', 'VU', 'NT', 'DD'].indexOf(b.kategori) || a.navn.localeCompare(b.navn, 'nb'));
    for (const a of arter) antall[a.niva]++;
    return { type: t.type, aar: t.aar, antatt: !!t.antatt, arter };
  });
  return { tiltak: ut, antall };
}

// Henter funn og rødlistevurderinger for eiendommen. Gir data som lagres i planen (S.artsfunn).
export async function hentForEiendom(grense, { hent = fetch, naa = () => new Date() } = {}) {
  const { funn, totalt, avkortet } = await hentArtsfunn(grense, { hent });
  const arter = await hentRodliste(funn.map((f) => ({ sciId: f.sciId, navn: f.navn })), { hent });
  return { hentet: naa().toISOString(), funn, arter, totalt, avkortet, kilde: KILDE };
}

// Lenker for å lese mer om arten og forskning på den.
export function lenker(a) {
  const vit = a.vit || '';
  return [
    a.art?.url ? { navn: 'Rødlistevurdering (med kilder)', url: a.art.url } : null,
    { navn: 'Artsdatabanken', url: `https://artsdatabanken.no/arter?q=${encodeURIComponent(vit)}` },
    { navn: 'Forskning (Google Scholar)', url: `https://scholar.google.com/scholar?q=${encodeURIComponent(`"${vit}" forestry OR logging OR "forest management"`)}` },
    { navn: 'GBIF', url: `https://www.gbif.org/species/search?q=${encodeURIComponent(vit)}` },
  ].filter(Boolean);
}
