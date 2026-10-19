// Skytebaner i Gran fra Det frivillige Skyttervesens skyteanleggsregister (WFS på Geonorge), med
// navn fra Kartverkets stedsnavnregister. Supplert med data/skytebaner-tillegg.json for anlegg som ikke
// er i DFS-registeret (skiskytterstadion, leirduebaner).
import { GRAN, avstandKm, hentJson, penNavn } from './kilder.js';

const WFS = 'https://wfs.geonorge.no/skwms1/wfs.skytebaner_dfs';
const NS = 'http://skjema.geonorge.no/SOSI/produktspesifikasjon/SkyteanleggDFS/20190301';
const STEDSNAVN = 'https://ws.geonorge.no/stedsnavn/v1/navn';

// Anlegg nærmere hverandre enn dette er samme skytebane med flere skytterlag (f.eks. Lygna).
const SAMME_ANLEGG_M = 300;

async function hentTekst(url) {
  let feil;
  for (let i = 0; i < 3; i++) {
    try {
      const svar = await fetch(url);
      if (svar.ok) return await svar.text();
      feil = new Error(`${svar.status} fra ${new URL(url).host}`);
    } catch (e) { feil = e; }
    await new Promise(r => setTimeout(r, 400 * 2 ** i));
  }
  throw feil;
}

const filter = (felt, verdier) => {
  const lik = v => `<PropertyIsEqualTo><ValueReference>app:${felt}</ValueReference><Literal>${v}</Literal></PropertyIsEqualTo>`;
  const innhold = verdier.length > 1 ? `<Or>${verdier.map(lik).join('')}</Or>` : lik(verdier[0]);
  return `<Filter xmlns="http://www.opengis.net/fes/2.0" xmlns:app="${NS}">${innhold}</Filter>`;
};

function wfsUrl(type, filterXml) {
  const q = new URLSearchParams({
    service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: `app:${type}`,
    namespaces: `xmlns(app,${NS})`, filter: filterXml,
  });
  return `${WFS}?${q}`;
}

// Leser GML-svaret uten DOMParser, slik at det virker likt i nettleseren og i Node.
export function tolkGml(xml, type) {
  const ut = [];
  for (const [, m] of String(xml).matchAll(new RegExp(`<app:${type}\\b[^>]*>([\\s\\S]*?)</app:${type}>`, 'g'))) {
    const felt = {};
    for (const [, k, v] of m.matchAll(/<app:([\p{L}\w]+)>([^<]*)<\/app:\1>/gu)) felt[k] = v.trim();
    const pos = m.match(/<gml:pos>\s*([-\d.]+)\s+([-\d.]+)\s*<\/gml:pos>/);
    if (pos) { felt.lat = +pos[1]; felt.lon = +pos[2]; }
    ut.push(felt);
  }
  return ut;
}

export function baneTekst(b) {
  if (/^\d+M$/i.test(b.type)) return `${parseInt(b.type, 10)} m rifle`;
  if (/pistol/i.test(b.type)) return `Pistol${b.lengde ? ` ${b.lengde} m` : ''}`;
  if (/vilt/i.test(b.type)) return `Viltmål${b.lengde ? ` ${b.lengde} m` : ''}`;
  if (/leirdue|hagle|trap|skeet/i.test(b.type)) return 'Leirdue/hagle';
  if (/skiskyt/i.test(b.type)) return 'Skiskyting';
  return b.lengde ? `${b.type} ${b.lengde} m` : b.type;
}

// Kort oppsummering av banene i bruk: «2 × 100 m rifle, 200 m rifle, Pistol».
export function banerKort(baner) {
  const antall = new Map();
  for (const b of baner.filter(x => x.iBruk)) { const t = baneTekst(b); antall.set(t, (antall.get(t) || 0) + 1); }
  return [...antall].map(([t, n]) => (n > 1 ? `${n} × ${t}` : t)).join(', ');
}

// Slår sammen anlegg som ligger på samme sted og lager «steder» i samme form som resten av appen.
export function byggSkytebaner(anlegg, baner, navngitte = []) {
  const grupper = [];
  for (const a of anlegg.filter(x => x.lat)) {
    const g = grupper.find(g => avstandKm(g[0], a) * 1000 < SAMME_ANLEGG_M);
    if (g) g.push(a); else grupper.push([a]);
  }
  return grupper.map(g => {
    const lat = g.reduce((n, a) => n + a.lat, 0) / g.length;
    const lon = g.reduce((n, a) => n + a.lon, 0) / g.length;
    const navnet = navngitte
      .map(n => ({ ...n, m: avstandKm(n, { lat, lon }) * 1000 }))
      .filter(n => n.m < 600).sort((a, b) => a.m - b.m)[0];
    const lag = g.map(a => penNavn(a.skytterlag || 'Ukjent skytterlag'));
    const tittel = navnet?.navn || `${lag[0].replace(/\s+skytterlag$/i, '')} skytebane`;
    const ider = g.map(a => a.skyteanleggId);
    const mine = baner.filter(b => ider.includes(b.skyteanleggId)).map(b => ({
      type: b.skytebanetype || '', lengde: b.skytebanelengde ? +b.skytebanelengde : null,
      iBruk: b.iBruk !== 'Nei', nedlagt: b.nedlagtDato || null, skytterlag: penNavn(b.skytterlag || ''),
    })).sort((a, b) => (b.iBruk - a.iBruk) || (a.lengde ?? 999) - (b.lengde ?? 999));
    return {
      id: `skyte:${ider.join('+')}`,
      kategori: 'skytebane',
      erSkytebane: true,
      kommunal: false,
      tittel,
      adresse: '',
      postnummer: '',
      poststed: '',
      posisjon: { lat, lon, presisjon: 'register', treff: 'DFS skyteanleggsregister' },
      baner: mine,
      kilde: 'Det frivillige Skyttervesen (skyteanleggsregisteret)',
      virksomheter: g.map((a, i) => ({
        orgnr: a.organisasjonsnummer || '', navn: lag[i], kategori: 'skytebane', kommunal: false,
        ansatte: null, naering: 'Skytterlag (DFS)',
      })),
    };
  });
}

// Henter skyteanleggene i kommunen, banene på dem og navngitte skytebaner fra stedsnavnregisteret.
export async function hentSkytebaner() {
  const anlegg = tolkGml(await hentTekst(wfsUrl('Skyteanlegg', filter('kommune', [GRAN.kommunenummer]))), 'Skyteanlegg');
  const ider = anlegg.map(a => a.skyteanleggId).filter(Boolean);
  const baner = ider.length ? tolkGml(await hentTekst(wfsUrl('Skytebane', filter('skyteanleggId', ider))), 'Skytebane') : [];
  let navngitte = [];
  try {
    const q = new URLSearchParams({ sok: 'skytebane', fuzzy: 'true', knr: GRAN.kommunenummer, treffPerSide: '50', utkoordsys: '4258' });
    const d = await hentJson(`${STEDSNAVN}?${q}`);
    navngitte = (d.navn || []).filter(n => /skyte/i.test(n.navneobjekttype))
      .map(n => ({ navn: n.skrivemåte, lat: n.representasjonspunkt.nord, lon: n.representasjonspunkt['øst'] }));
  } catch { /* navn er pynt – banene vises likevel */ }
  return byggSkytebaner(anlegg, baner, navngitte);
}

// Tillegg (anlegg som ikke er i DFS-registeret) legges til; «ogsaa» på en DFS-bane slås inn i den.
export function leggTilTillegg(skytebaner, tillegg = []) {
  const ut = skytebaner.map(s => ({ ...s, baner: [...s.baner], virksomheter: [...s.virksomheter] }));
  for (const t of tillegg) {
    const naer = ut.find(s => s.tittel === t.gjelder);
    if (t.gjelder) {
      if (!naer) continue;
      naer.baner.push(...(t.baner || []));
      naer.virksomheter.push(...(t.brukere || []).map(b => ({ ...b, kategori: 'skytebane', kommunal: false, ansatte: null })));
      continue;
    }
    ut.push({
      id: `skyte:${t.id}`, kategori: 'skytebane', erSkytebane: true, kommunal: false, tittel: t.navn,
      adresse: '', postnummer: '', poststed: '', kilde: t.kilde,
      posisjon: { lat: t.lat, lon: t.lon, presisjon: 'register', treff: t.kilde },
      baner: t.baner || [],
      virksomheter: (t.brukere || []).map(b => ({ ...b, kategori: 'skytebane', kommunal: false, ansatte: null })),
    });
  }
  return ut;
}
