// Henter og bearbeider rutene for Gran: Turrutebasen (Kartverket), gang- og sykkelveger og bilveger fra NVDB
// (Statens vegvesen), bruksintensitet fra Strava Global Heatmap, høyder fra Kartverkets høydedata og
// stedsnavn til ruter uten navn. Kjøres i Node 22 (global fetch) av data/hent-data.mjs.
import {
  GRAN, TYPER, UNDERLAG, SPESIALTYPE, GRADERING, klipp, skjoet, lengde, linjeLengde, punkterLangs, forenkle,
  bruk, bruksindeks, settNivaa, stigning, fliserFor, VARMEKART_FLIS, VARMEKART_ZOOM, VARMEKART_ZOOMER, avstandM,
} from '../js/geo.js';
import { dekodPng } from './png.mjs';

const KOMMUNEINFO = 'https://api.kartverket.no/kommuneinfo/v1/kommuner';
const TURRUTER = 'https://wfs.geonorge.no/skwms1/wfs.turogfriluftsruter';
const NVDB = 'https://nvdbapiles.atlas.vegvesen.no/vegnett/api/v4/veglenkesekvenser/segmentert';
const VARMEKART = 'https://heatmap-external-a.strava.com/tiles';
const HOYDE = 'https://ws.geonorge.no/hoydedata/v1/punkt';
const STEDSNAVN = 'https://ws.geonorge.no/stedsnavn/v1/punkt';
const KLIENT = { 'X-Client': 'turveier-i-gran', 'User-Agent': 'turveier-i-gran (github.com/trond-web/trond-repos)' };

async function hent(url, { som = 'json', forsok = 4, headers = {} } = {}) {
  let feil;
  for (let i = 0; i < forsok; i++) {
    try {
      const svar = await fetch(url, { headers: { ...KLIENT, ...headers } });
      if (svar.ok) return som === 'json' ? await svar.json() : som === 'tekst' ? await svar.text() : Buffer.from(await svar.arrayBuffer());
      feil = new Error(`${svar.status} fra ${url}`);
      if (svar.status < 500 && svar.status !== 429) break;
    } catch (e) { feil = e; }
    await new Promise(r => setTimeout(r, 1000 * 2 ** i));
  }
  throw feil;
}

export async function iParallell(liste, antall, fn) {
  const ut = new Array(liste.length);
  let neste = 0;
  const arbeider = async () => { while (neste < liste.length) { const i = neste++; ut[i] = await fn(liste[i], i); } };
  await Promise.all(Array.from({ length: Math.min(antall, liste.length) }, arbeider));
  return ut;
}

// ---------- Kommunegrensa ----------

export async function hentGrense(knr = GRAN.kommunenummer) {
  const d = await hent(`${KOMMUNEINFO}/${knr}/omrade`);
  const g = d.omrade;
  return g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
}

export function boks(multipolygon) {
  let s = 90, v = 180, n = -90, o = -180;
  for (const poly of multipolygon) for (const [lon, lat] of poly[0]) {
    s = Math.min(s, lat); n = Math.max(n, lat); v = Math.min(v, lon); o = Math.max(o, lon);
  }
  return [[s, v], [n, o]];
}

// ---------- Turrutebasen ----------

const felt = (tekst, navn) => tekst.match(new RegExp(`<app:${navn}>([^<]*)</app:${navn}>`))?.[1]?.trim() || '';

// Tolker GML fra WFS-en til segmenter med geometri og ruteinformasjon. Et segment kan høre til flere ruter.
export function tolkTurruter(gml) {
  return gml.split('<wfs:member>').slice(1).map(m => {
    const pos = m.match(/<gml:posList>([^<]*)<\/gml:posList>/)?.[1].trim().split(/\s+/).map(Number) || [];
    const linje = [];
    for (let i = 0; i + 1 < pos.length; i += 2) linje.push([pos[i], pos[i + 1]]);
    const info = [...m.matchAll(/<app:(?:Fotrute|Sykkelrute|AnnenRute)Info>([\s\S]*?)<\/app:(?:Fotrute|Sykkelrute|AnnenRute)Info>/g)].map(([, t]) => ({
      navn: felt(t, 'rutenavn'),
      nummer: felt(t, 'rutenummer'),
      ansvarlig: felt(t, 'vedlikeholdsansvarlig').replace(/^DNT \| /, ''),
      spesial: felt(t, 'spesialFotrutetype') || felt(t, 'spesialSykkelrutetype'),
      gradering: felt(t, 'gradering'),
    }));
    return { linje, folger: felt(m, 'ruteFølger'), info };
  }).filter(s => s.linje.length > 1);
}

export async function hentTurruter(type, [[s, v], [n, o]]) {
  const url = `${TURRUTER}?service=WFS&version=2.0.0&request=GetFeature&typeNames=app:${type}` +
    `&srsName=urn:ogc:def:crs:EPSG::4326&bbox=${s},${v},${n},${o},urn:ogc:def:crs:EPSG::4326&count=20000`;
  return tolkTurruter(await hent(url, { som: 'tekst' }));
}

const ukjent = navn => !navn || /^ukjent$/i.test(navn);

// Samler segmentene til ruter (etter rutenummer, ellers rutenavn) og klipper dem til kommunen.
export function grupperTurruter(segmenter, type, grense) {
  const ruter = new Map();
  for (const seg of segmenter) {
    const deler = klipp(seg.linje, grense);
    if (!deler.length) continue;
    for (const info of seg.info.length ? seg.info : [{}]) {
      const nokkel = `${type}:${info.nummer || info.navn || 'uten'}`;
      let r = ruter.get(nokkel);
      if (!r) {
        r = { id: nokkel, type, kilde: 'turrutebasen', navn: ukjent(info.navn) ? '' : info.navn, nummer: info.nummer || '',
          ansvarlig: new Set(), spesial: new Set(), gradering: '', folger: {}, linjer: [] };
        ruter.set(nokkel, r);
      }
      if (!r.navn && !ukjent(info.navn)) r.navn = info.navn;
      if (info.ansvarlig) r.ansvarlig.add(info.ansvarlig);
      if (SPESIALTYPE[info.spesial]) r.spesial.add(SPESIALTYPE[info.spesial]);
      if (GRADERING[info.gradering]) r.gradering = GRADERING[info.gradering];
      const u = UNDERLAG[seg.folger];
      if (u) r.folger[u] = (r.folger[u] || 0) + lengde(deler);
      r.linjer.push(...deler);
    }
  }
  return [...ruter.values()].map(r => ({ ...r, ansvarlig: [...r.ansvarlig], spesial: [...r.spesial], linjer: skjoet(r.linjer) }));
}

// ---------- NVDB ----------

// «LINESTRING Z (lat lon h, …)» i EPSG:4326 fra NVDB har breddegrad først.
export function tolkWkt(wkt) {
  const inni = wkt.match(/\(([^()]*)\)/)?.[1] || '';
  return inni.split(',').map(p => p.trim().split(/\s+/).map(Number)).map(([la, lo]) => [la, lo]).filter(p => p.every(Number.isFinite));
}

export async function hentVegnett(sporring, knr = GRAN.kommunenummer) {
  let url = `${NVDB}?kommune=${knr}&${sporring}&srid=4326&antall=1000`;
  const ut = [];
  for (;;) {
    const d = await hent(url, { headers: { Accept: 'application/json' } });
    ut.push(...d.objekter);
    if (d.metadata.returnert < 1000 || !d.metadata.neste?.start) break;
    url = `${NVDB}?kommune=${knr}&${sporring}&srid=4326&antall=1000&start=${encodeURIComponent(d.metadata.neste.start)}`;
  }
  // Bare gjeldende vegnett, og én linje per veg (ikke egne linjer per kjørebane/felt).
  return ut.filter(o => !o.sluttdato && o.geometri?.wkt && (o.type === 'HOVED') && /Vegtrase/.test(o.detaljnivå || 'Vegtrase'));
}

const VEGKATEGORI = { E: 'E', R: 'Rv', F: 'Fv', K: 'Kv', P: 'Pv', S: 'Skogsbilveg' };

// Det vanligste adressenavnet per vegnummer, så en gang- og sykkelveg uten eget navn kan få navnet til
// vegen den følger.
export function vegnavn(objekter) {
  const telling = new Map();
  for (const o of objekter) {
    const vs = o.vegsystemreferanse?.vegsystem, navn = o.adresse?.navn;
    if (!vs?.nummer || !navn) continue;
    const k = `${vs.vegkategori}${vs.nummer}`;
    const t = telling.get(k) || {};
    t[navn] = (t[navn] || 0) + (o.lengde || 1);
    telling.set(k, t);
  }
  return new Map([...telling].map(([k, t]) => [k, Object.entries(t).sort((a, b) => b[1] - a[1])[0][0]]));
}

// Samler vegsegmenter til strekninger etter vegnummer og adressenavn (f.eks. «Hornslinna (Fv34)»).
export function grupperVeger(objekter, type, navnPaaVeg = new Map()) {
  const grupper = new Map();
  for (const o of objekter) {
    const vs = o.vegsystemreferanse?.vegsystem || {};
    const veg = vs.vegkategori ? `${VEGKATEGORI[vs.vegkategori] || vs.vegkategori}${vs.vegkategori === 'S' ? '' : vs.nummer}` : '';
    const gate = o.adresse?.navn || navnPaaVeg.get(`${vs.vegkategori}${vs.nummer}`) || '';
    const nokkel = `${type}:nvdb:${vs.vegkategori || ''}${vs.nummer || ''}:${gate}`;
    let g = grupper.get(nokkel);
    if (!g) {
      g = { id: nokkel, type, kilde: 'nvdb', navn: gate, nummer: ['P', 'S'].includes(vs.vegkategori) ? '' : veg,
        vegkategori: vs.vegkategori || '', ansvarlig: [], spesial: [], gradering: '', folger: {}, linjer: [] };
      grupper.set(nokkel, g);
    }
    const linje = tolkWkt(o.geometri.wkt);
    if (linje.length < 2) continue;
    g.linjer.push(linje);
    const u = /gang|sykkel/i.test(o.typeVeg_sosi || '') ? UNDERLAG.GS : vs.vegkategori === 'S' ? UNDERLAG.SB : UNDERLAG.BV;
    g.folger[u] = (g.folger[u] || 0) + linjeLengde(linje);
  }
  return [...grupper.values()].map(g => ({ ...g, linjer: skjoet(g.linjer) }));
}

// ---------- Varmekart ----------

// Henter varmekartflisene som dekker boksen og gir en funksjon som slår opp intensiteten i en global piksel.
export async function hentVarmekart(aktivitet, bboks, zoom = VARMEKART_ZOOM) {
  const fliser = new Map();
  await iParallell(fliserFor(bboks, zoom), 3, async ({ z, x, y }) => {
    const png = await hent(`${VARMEKART}/${aktivitet}/hot/${z}/${x}/${y}.png`, { som: 'buffer' });
    fliser.set(`${x}/${y}`, dekodPng(png));
  });
  const F = VARMEKART_FLIS;
  return (px, py) => {
    const f = fliser.get(`${Math.floor(px / F)}/${Math.floor(py / F)}`);
    return f ? f.piksler[(py % F) * f.bredde + (px % F)] : 0;
  };
}

// varmekart: { all: { 8: oppslag, 9: …, 11: … }, ride: { … } }
export function settBruk(ruter, varmekart, radius) {
  for (const r of ruter) {
    const vk = varmekart[TYPER[r.type].varmekart];
    const snitt = VARMEKART_ZOOMER.reduce((s, { z, vekt }) => s + vekt * bruk(r.linjer, vk[z], { z, radius: 0 }).snitt, 0);
    const { andel } = bruk(r.linjer, vk[VARMEKART_ZOOM], { radius });
    r.indeks = bruksindeks({ snitt, andel });
    r.andel = Math.round(andel * 100);
  }
  return ruter;
}

// ---------- Høyde og navn ----------

// Høydeprofil med inntil `antall` punkter jevnt fordelt langs ruta (den lengste sammenhengende delen).
export async function hentHoyder(r, antall = 60) {
  const hoved = r.linjer.reduce((a, b) => (linjeLengde(b) > linjeLengde(a) ? b : a));
  const len = linjeLengde(hoved);
  const punkter = punkterLangs(hoved, Math.max(10, len / (antall - 1)));
  const hoyder = [];
  for (let i = 0; i < punkter.length; i += 50) {
    const bit = punkter.slice(i, i + 50).map(([la, lo]) => [+lo.toFixed(6), +la.toFixed(6)]);
    const d = await hent(`${HOYDE}?koordsys=4258&punkter=${encodeURIComponent(JSON.stringify(bit))}`);
    hoyder.push(...d.punkter.map(p => (p.z == null ? null : Math.round(p.z))));
  }
  return { profil: hoyder, profilLengde: Math.round(len) };
}

const GODE_STEDSTYPER = /^(Gard|Bruk|Seter\/støl|Vann|Tjern|Innsjø|Ås|Haug|Fjell|Topp|Høyde|Berg|Tettsted|Grend|Bygdelag|Myr|Elv|Bekk|Dal|Li|Skog|Kirke|Stasjon|Hytte|Turisthytte)$/;

export async function stedsnavnVed([lat, lon]) {
  const d = await hent(`${STEDSNAVN}?nord=${lat}&ost=${lon}&koordsys=4258&radius=2000&treffPerSide=30&utkoordsys=4258`);
  const navn = (d.navn || []).filter(n => n.navneobjekttype !== 'Adressenavn').sort((a, b) => a.meterFraPunkt - b.meterFraPunkt);
  const godt = navn.find(n => GODE_STEDSTYPER.test(n.navneobjekttype)) || navn[0];
  return godt?.stedsnavn?.[0]?.skrivemåte || '';
}

export const midtpunkt = r => {
  const hoved = r.linjer.reduce((a, b) => (linjeLengde(b) > linjeLengde(a) ? b : a));
  return punkterLangs(hoved, Math.max(1, linjeLengde(hoved) / 2))[1] || hoved[0];
};

const ORD = { tur: 'Sti', sykkel: 'Sykkelveg', hverdag: 'Gang- og sykkelveg' };

export function visningsnavn(r, sted) {
  if (r.kilde === 'nvdb') {
    const veg = r.navn || (r.vegkategori === 'S' ? 'Skogsbilveg' : r.nummer || ORD[r.type]);
    const del = r.navn && r.nummer && !r.navn.includes(r.nummer) ? ` (${r.nummer})` : '';
    const navn = `${veg}${del}${!r.navn && sted ? ` ved ${sted}` : ''}`;
    return r.type === 'hverdag' && veg !== ORD.hverdag ? `${ORD.hverdag} langs ${navn}` : navn;
  }
  return r.navn || `${ORD[r.type]}${sted ? ` ved ${sted}` : ''}`;
}

// Gjør rutene klare for appen: lengde, underlag i prosent, forenklet geometri med 5 desimaler.
export function ferdig(r) {
  const totalt = lengde(r.linjer);
  const underlag = Object.entries(r.folger).sort((a, b) => b[1] - a[1])
    .map(([navn, m]) => ({ navn, andel: Math.round((m / totalt) * 100) })).filter(u => u.andel > 0);
  const linjer = r.linjer.map(l => forenkle(l, 5).map(([la, lo]) => [+la.toFixed(5), +lo.toFixed(5)]));
  const { folger, vegkategori, kilde, ...resten } = r;
  return { ...resten, kilde, lengde: Math.round(totalt), underlag, linjer };
}

// Fjerner nesten-duplikater: samme veg registrert under to nøkler (f.eks. med og uten adressenavn) der
// den ene ligger helt oppå den andre.
export function utenOverlapp(ruter, avstand = 15) {
  const ut = [];
  for (const r of ruter) {
    const p = punkterLangs(r.linjer[0], 50);
    const dekket = ut.some(a => a.type === r.type && p.every(q => a.linjer.some(l => l.some(x => avstandM(q, x) < avstand))));
    if (!dekket) ut.push(r);
  }
  return ut;
}

export { settNivaa, stigning };
