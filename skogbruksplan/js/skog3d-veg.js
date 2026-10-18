// Bakkevegetasjon i den virtuelle skogen ut fra vegetasjonstypen (NIBIO/Fremstad-kodene i vegetasjon.js).
// Hver type har en bakkefarge (bunnsjiktet: lav, mose, torvmose, strø) og elementer i feltsjiktet med tetthet per m²
// og høyde. Mangler vegetasjonstypen, anslås den av treslag og bonitet. Hogstflater får mer gras og urter, tett
// ungskog mindre (lite lys). Ingen DOM – kan testes i Node.
import { hogstklasseFor, STANDARD_INNSTILLINGER } from './model.js';
import { VEG_TYPER } from './vegetasjon.js';
import { rng } from './skog3d-data.js';

// Bakkefarger (bunnsjikt)
// (litt mørkere enn naturen, siden lyset i scenen er sterkt)
const BAKKE = { lav: [0.74, 0.74, 0.62], lyng: [0.36, 0.32, 0.24], mose: [0.2, 0.3, 0.11], eng: [0.27, 0.38, 0.15], torv: [0.55, 0.52, 0.26], sump: [0.3, 0.36, 0.2], stein: [0.46, 0.45, 0.42], strø: [0.38, 0.32, 0.22], gras: [0.42, 0.46, 0.22] };
const e = (type, tetthet, h) => ({ type, tetthet, h });

export const VEG_PROFIL = {
  lavFuru: { navn: 'lav og lyng', bakke: BAKKE.lav, elementer: [e('lav', 3, [0.04, 0.09]), e('lyng', 0.6, [0.12, 0.3]), e('tyttebaer', 0.4, [0.08, 0.15]), e('einer', 0.01, [0.6, 1.8]), e('stein', 0.02, [0.2, 0.6])] },
  lyngGran: { navn: 'lyng og mose', bakke: BAKKE.lyng, elementer: [e('lyng', 1.6, [0.15, 0.35]), e('mose', 1.2, [0.05, 0.1]), e('lav', 0.6, [0.04, 0.08]), e('blabaer', 0.5, [0.15, 0.3]), e('einer', 0.01, [0.5, 1.5])] },
  blabaerGran: { navn: 'blåbær og mose', bakke: BAKKE.mose, elementer: [e('blabaer', 3, [0.18, 0.4]), e('mose', 1.5, [0.05, 0.12]), e('tyttebaer', 0.3, [0.08, 0.15]), e('bregne', 0.06, [0.4, 0.8]), e('gras', 0.15, [0.25, 0.45])] },
  blabaerFuru: { navn: 'blåbær, tyttebær og lyng', bakke: BAKKE.mose, elementer: [e('blabaer', 2, [0.15, 0.35]), e('tyttebaer', 1.2, [0.08, 0.15]), e('lyng', 0.6, [0.12, 0.3]), e('mose', 1, [0.05, 0.1]), e('lav', 0.3, [0.04, 0.08])] },
  blabaerBjork: { navn: 'blåbær og gras', bakke: BAKKE.mose, elementer: [e('blabaer', 2.2, [0.18, 0.4]), e('gras', 0.8, [0.25, 0.5]), e('urter', 0.3, [0.12, 0.25]), e('mose', 0.8, [0.05, 0.1]), e('bregne', 0.05, [0.4, 0.7])] },
  eng: { navn: 'gras, urter og bregner', bakke: BAKKE.eng, elementer: [e('gras', 3, [0.3, 0.7]), e('urter', 1.5, [0.15, 0.4]), e('bregne', 0.35, [0.5, 1.1]), e('hoystaude', 0.08, [0.7, 1.3]), e('blabaer', 0.3, [0.2, 0.4])] },
  kalk: { navn: 'urter og gras på kalk', bakke: BAKKE.eng, elementer: [e('urter', 2.2, [0.12, 0.35]), e('gras', 1.5, [0.2, 0.45]), e('lyng', 0.3, [0.1, 0.25]), e('stein', 0.05, [0.15, 0.5])] },
  hoystaude: { navn: 'høgstauder og bregner', bakke: BAKKE.eng, elementer: [e('hoystaude', 1.2, [0.8, 1.6]), e('bregne', 0.8, [0.6, 1.2]), e('gras', 1.5, [0.4, 0.8]), e('urter', 1, [0.2, 0.5])] },
  fukt: { navn: 'torvmose, blåbær og starr', bakke: BAKKE.sump, elementer: [e('torvmose', 2.5, [0.05, 0.12]), e('blabaer', 1.2, [0.18, 0.35]), e('starr', 0.8, [0.3, 0.55]), e('lyng', 0.3, [0.12, 0.25])] },
  myr: { navn: 'torvmose, lyng og starr', bakke: BAKKE.torv, elementer: [e('torvmose', 4, [0.05, 0.15]), e('lyng', 1.2, [0.12, 0.3]), e('starr', 1.2, [0.3, 0.6]), e('tyttebaer', 0.3, [0.06, 0.12])] },
  sump: { navn: 'torvmose, starr og bregner', bakke: BAKKE.sump, elementer: [e('torvmose', 3, [0.05, 0.12]), e('starr', 1.8, [0.4, 0.8]), e('bregne', 0.4, [0.5, 1]), e('hoystaude', 0.1, [0.7, 1.2])] },
  starr: { navn: 'starr og gras', bakke: BAKKE.torv, elementer: [e('starr', 5, [0.4, 0.8]), e('torvmose', 2, [0.05, 0.12]), e('gras', 0.8, [0.3, 0.6])] },
  gras: { navn: 'gras og urter', bakke: BAKKE.gras, elementer: [e('gras', 5, [0.2, 0.5]), e('urter', 1, [0.1, 0.3])] },
  ur: { navn: 'stein og mose', bakke: BAKKE.stein, elementer: [e('stein', 0.4, [0.3, 1.4]), e('mose', 0.8, [0.05, 0.1]), e('lav', 0.5, [0.03, 0.06]), e('bregne', 0.05, [0.3, 0.6])] },
  lavhei: { navn: 'reinlav', bakke: BAKKE.lav, elementer: [e('lav', 5, [0.04, 0.1]), e('lyng', 0.5, [0.1, 0.25]), e('stein', 0.05, [0.2, 0.6])] },
  rishei: { navn: 'lyng og ris', bakke: BAKKE.lyng, elementer: [e('lyng', 3, [0.15, 0.4]), e('blabaer', 0.6, [0.15, 0.3]), e('lav', 0.8, [0.04, 0.08])] },
};
// Vegetasjonskode → profil
const KODE = {
  '6a': 'lavFuru', '4a': 'lyngGran', '7a': 'lyngGran', '7b': 'blabaerGran', '6b': 'blabaerFuru', '4b': 'blabaerBjork',
  '7c': 'eng', '6c': 'eng', '4c': 'eng', '5a': 'eng', '5b': 'hoystaude', '4g': 'gras', '6d': 'kalk', '4d': 'kalk',
  '4e': 'hoystaude', '4f': 'hoystaude', '3b': 'hoystaude', '8d': 'hoystaude', '8a': 'fukt', '8b': 'myr', '9a': 'myr', '8c': 'sump',
  '9c': 'starr', '9d': 'starr', '9e': 'starr', '3a': 'gras', '11b': 'gras', '11a': 'gras', '2b': 'gras', '1b': 'gras', '2c': 'lavhei', '2e': 'rishei', '12b': 'ur', '12c': 'ur',
};

// Anslag når vegetasjonstypen mangler: treslag og bonitet (lav bonitet = lyng/lav, middels = blåbær, høy = eng).
export function anslaattKode(b) {
  const ts = b.treslag || 'G'; const bo = b.bonitet || 11;
  if (ts === 'F') return bo <= 8 ? '6a' : bo <= 14 ? '6b' : '6c';
  if (ts === 'L') return bo <= 8 ? '4a' : bo <= 14 ? '4b' : '4c';
  return bo <= 8 ? '7a' : bo <= 17 ? '7b' : '7c';
}

// Profilen for bestandet, justert for lys: hogstflate → mer gras/urter, tett ungskog og tett granskog → mindre.
export function vegProfil(b, { inn = STANDARD_INNSTILLINGER } = {}) {
  const kode = b.vegetasjon?.kode && KODE[b.vegetasjon.kode] ? b.vegetasjon.kode : anslaattKode(b);
  const p = VEG_PROFIL[KODE[kode]] || VEG_PROFIL.blabaerGran;
  const hk = hogstklasseFor(b, inn) || 3;
  const lys = hk === 1 ? 1.2 : hk === 2 ? ((b.ungskog?.treantallFor ?? b.treantall ?? 0) > 600 ? 0.45 : 0.75) : (b.treslag || 'G') === 'G' && hk >= 3 && (b.treantall ?? 0) > 150 ? 0.6 : 1;
  let elementer = p.elementer.map((x) => ({ ...x, tetthet: x.type === 'stein' ? x.tetthet : x.tetthet * lys }));
  if (hk === 1) elementer = [...elementer, e('gras', 2.5, [0.3, 0.7]), e('urter', 0.6, [0.2, 0.5])]; // hogstflate: gras og urter tar over
  return { kode, navn: VEG_TYPER[kode]?.navn || p.navn, beskrivelse: p.navn, anslaatt: !(b.vegetasjon?.kode && KODE[b.vegetasjon.kode]), bakke: p.bakke, elementer };
}

// Planter i én rute (størrelse × størrelse m med sørvestre hjørne i (x0, y0)). Faste per rute.
export function vegRute(x0, y0, storrelse, profil, frø = '') {
  const r = rng(`${frø}|${Math.round(x0)}|${Math.round(y0)}`); const ut = [];
  for (const el of profil.elementer) {
    const forventet = el.tetthet * storrelse * storrelse;
    let n = Math.floor(forventet); if (r() < forventet - n) n++;
    // flekkvis fordeling: klynger rundt noen sentre
    const sentre = [...Array(Math.max(1, Math.round(n / 6)))].map(() => [x0 + r() * storrelse, y0 + r() * storrelse]);
    for (let i = 0; i < n; i++) {
      const [cx, cy] = sentre[i % sentre.length]; const spredning = storrelse * 0.35;
      const x = Math.min(x0 + storrelse, Math.max(x0, cx + (r() - 0.5) * 2 * spredning)); const y = Math.min(y0 + storrelse, Math.max(y0, cy + (r() - 0.5) * 2 * spredning));
      ut.push({ type: el.type, x, y, h: el.h[0] + r() * (el.h[1] - el.h[0]), rot: r() * Math.PI * 2, v: r() });
    }
  }
  return ut;
}
