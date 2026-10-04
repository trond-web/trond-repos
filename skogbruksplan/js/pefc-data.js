// Henter offentlige miljødata for en eiendom til PEFC-modulen:
//   NIBIO MiS (nøkkelbiotoper), Miljødirektoratet (verneområder, naturtyper DN-HB13 A/B, NiN-naturtyper,
//   utvalgte naturtyper, funksjonsområder for arter, kartlagte friluftslivsområder) og
//   Riksantikvaren (sikringssoner for kulturminner).
// Data om sensitive arter (f.eks. rovfuglreir) er ikke åpent tilgjengelig og må registreres manuelt.
import { geoTilUtm } from './proj.js';
import { parseKml } from './kommuneanalyse.js';
import { overlapper } from './pefc.js';

const MD = 'https://kart.miljodirektoratet.no/arcgis/rest/services';
const HB13_NAVN = { A: 'svært viktig (A)', B: 'viktig (B)', C: 'lokalt viktig (C)' };
const NIN_KVALITET = { 1: 'svært høy kvalitet', 2: 'høy kvalitet', 3: 'moderat kvalitet', 4: 'lav kvalitet', 5: 'svært lav kvalitet' };
const ARTSFUNKSJON = { 1: 'beiteområde', 2: 'trekkvei', 3: 'hiområde', 4: 'myteområde', 5: 'overnattingsområde', 6: 'rasteområde', 7: 'spill-/parringsområde', 8: 'yngleområde', 9: 'leveområde' };

async function hentJson(hent, url) {
  for (let i = 0; i < 3; i++) {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 45000);
    try {
      const r = await hent(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error(`${new URL(url).host} svarte ${r.status}`);
      return await r.json();
    } catch (e) { if (i === 2) throw e; await new Promise((res) => setTimeout(res, 1000 * (i + 1))); } finally { clearTimeout(t); }
  }
}

function bboxAv(geom) {
  const pts = (geom.type === 'Polygon' ? geom.coordinates : geom.coordinates.flat()).flat();
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  return [Math.min(...xs) - 0.003, Math.min(...ys) - 0.0015, Math.max(...xs) + 0.003, Math.max(...ys) + 0.0015];
}

async function arcgis(hent, tjeneste, bb, where = '1=1') {
  const q = new URLSearchParams({ where, geometry: bb.join(','), geometryType: 'esriGeometryEnvelope', inSR: '4326', outSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: 'true', f: 'geojson' });
  return (await hentJson(hent, `${MD}/${tjeneste}/query?${q}`)).features || [];
}

export async function hentMiljodata(grense, { hent = fetch, logg = () => {} } = {}) {
  const bb = bboxAv(grense);
  const ut = [];
  const feil = [];
  const legg = (type, navn, geometri, ekstra = {}) => { if (geometri && overlapper(geometri, grense)) ut.push({ type, navn, geometri, kilde: 'offentlig', ...ekstra }); };
  const steg = async (tekst, fn) => { logg(tekst); try { await fn(); } catch (e) { feil.push(`${tekst.replace(/ …$/, '')}: ${e.message}`); } };

  await steg('Nøkkelbiotoper (NIBIO MiS) …', async () => {
    const h = [[bb[0], bb[1]], [bb[0], bb[3]], [bb[2], bb[1]], [bb[2], bb[3]]].map(([x, y]) => geoTilUtm(x, y, 33));
    const u = [Math.min(...h.map((p) => p[0])), Math.min(...h.map((p) => p[1])), Math.max(...h.map((p) => p[0])), Math.max(...h.map((p) => p[1]))];
    const r = await hent(`https://wms.nibio.no/cgi-bin/mis?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=Nokkelbiotop&STYLES=&SRS=EPSG:25833&BBOX=${u.join(',')}&WIDTH=2000&HEIGHT=2000&FORMAT=kml`);
    for (const [id, g] of parseKml(await r.text())) legg('noekkelbiotop', `Nøkkelbiotop (MiS ${id})`, g, { kildeId: `mis-${id}` });
  });
  await steg('Verneområder …', async () => {
    for (const f of await arcgis(hent, 'vern/MapServer/0', bb)) legg('vern', `${f.properties.verneform || 'Verneområde'}: ${f.properties.navn}`, f.geometry, { kildeId: `vern-${f.properties.naturvernId || f.properties.navn}` });
  });
  await steg('Naturtyper (DN-håndbok 13) …', async () => {
    for (const f of await arcgis(hent, 'naturtyper_hb13/MapServer/0', bb, "verdi IN ('A','B')")) legg('naturtype', `${f.properties.omraadenavn || 'Naturtype'} – ${HB13_NAVN[f.properties.verdi] || f.properties.verdi}`, f.geometry, { verdi: f.properties.verdi, kildeId: `hb13-${f.properties.naturtypeId}`, lenke: f.properties.faktaark });
  });
  await steg('Naturtyper (NiN) …', async () => {
    for (const f of await arcgis(hent, 'naturtyper_nin/MapServer/0', bb)) {
      const p = f.properties; const kv = Number(p.Lokalitetskvalitet);
      if (kv && kv > 3) continue; // moderat kvalitet eller bedre
      legg('naturtype', `${p.Naturtype} (${p['Områdenavn'] || 'NiN'}) – ${NIN_KVALITET[kv] || 'ikke kvalitetsvurdert'}`, f.geometry, { kildeId: `nin-${p.NiNID}` });
    }
  });
  await steg('Utvalgte naturtyper …', async () => {
    for (const f of await arcgis(hent, 'naturtyper_utvalgte2/MapServer/0', bb)) legg('naturtype', `Utvalgt naturtype: ${f.properties.UtvalgtNaturtype} (${f.properties['Områdenavn'] || ''})`, f.geometry, { utvalgt: true, kildeId: `utv-${f.properties.UtvalgtNaturtypeId}` });
  });
  await steg('Funksjonsområder for arter …', async () => {
    for (const f of await arcgis(hent, 'artfunksjon/MapServer/0', bb)) {
      const p = f.properties;
      const viktig = ['CR', 'EN', 'VU', 'NT'].includes(p.roedlisteStatus) || Number(p.prioritertArt) === 1 || [3, 7, 8].includes(Number(p.funksjon));
      if (!viktig) continue; // f.eks. store beiteområder for elg tas ikke med
      legg('artsomrade', `${p.norskNavn || 'Art'} – ${ARTSFUNKSJON[p.funksjon] || 'funksjonsområde'}${p.roedlisteStatus ? ` (${p.roedlisteStatus})` : ''}${Number(p.prioritertArt) === 1 ? ', prioritert art' : ''}`, f.geometry, { kildeId: `art-${p.artForekomstId}`, lenke: p.faktaark });
    }
  });
  await steg('Friluftslivsområder …', async () => {
    for (const f of await arcgis(hent, 'friluftsliv_kartlagt/MapServer/0', bb, "omraadeverdi IN ('sværtViktigFriluftslivsområde','viktigFriluftslivsområde')")) {
      const p = f.properties;
      legg('friluftsomrade', `${p.omraadenavn || 'Friluftslivsområde'} – ${p.omraadeverdi === 'sværtViktigFriluftslivsområde' ? 'svært viktig' : 'viktig'}`, f.geometry, { kildeId: `fri-${p.id || p.omraadenavn}`, lenke: p.faktaark });
    }
  });
  await steg('Kulturminner (Riksantikvaren) …', async () => {
    const d = await hentJson(hent, `https://api.ra.no/LokaliteterEnkeltminnerOgSikringssoner/collections/sikringssoner/items?f=json&limit=500&bbox=${bb.join(',')}`);
    for (const f of d.features || []) {
      const p = f.properties;
      // Beskrivelsen starter ofte med en lokal kode som «R01.1:»; den fjernes, og første setning brukes som navn.
      const tekst = (p.informasjon || '').replace(/^\s*[A-ZÆØÅ]?\d+(\.\d+)?\s*[:.]\s*/, '').trim();
      const kort = tekst.split(/(?<=[a-zæøå)])[.:]\s/)[0].slice(0, 60);
      legg('kulturminne', `Kulturminne ${p.kulturminneId}${kort ? `: ${kort}` : ''}`, f.geometry, { kildeId: `ra-${p.kulturminneId}`, beskrivelse: p.informasjon, lenke: `https://www.kulturminnesok.no/sok/?q=${p.kulturminneId}` });
    }
  });
  logg(`Ferdig: ${ut.length} miljøobjekter på eiendommen${feil.length ? `, ${feil.length} kilder svarte ikke` : ''}.`);
  return { objekter: ut, feil };
}
