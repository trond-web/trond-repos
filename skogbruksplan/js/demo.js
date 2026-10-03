// Fiktiv demo-eiendom (Hedmarken) – gir noe å se på før man importerer egen plan.
import { utmTilGeo, arealM2 } from './proj.js';
import { normaliserBestand } from './model.js';

function prng(frø) {
  let s = frø >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

export function lagDemo(iAar = new Date().getFullYear()) {
  const r = prng(42);
  const kol = 6; const rad = 4; const bx = 210; const by = 170;
  const x0 = 628000; const y0 = 6752000;
  // Felles hjørnepunkter med litt støy gir sammenhengende, naturlig utseende bestandsgrenser.
  const p = [];
  for (let j = 0; j <= rad; j++) {
    p.push([]);
    for (let i = 0; i <= kol; i++) {
      const kant = i === 0 || j === 0 || i === kol || j === rad;
      p[j].push([x0 + i * bx + (kant ? 0 : (r() - 0.5) * 120), y0 + j * by + (kant ? 0 : (r() - 0.5) * 90)]);
    }
  }
  const profiler = [
    { treslag: 'G', bonitet: 17, alder: 92, hk: 5 }, { treslag: 'G', bonitet: 20, alder: 74, hk: 5 },
    { treslag: 'F', bonitet: 11, alder: 105, hk: 5 }, { treslag: 'G', bonitet: 14, alder: 55, hk: 4 },
    { treslag: 'G', bonitet: 17, alder: 45, hk: 3 }, { treslag: 'F', bonitet: 14, alder: 38, hk: 3 },
    { treslag: 'G', bonitet: 20, alder: 12, hk: 2 }, { treslag: 'G', bonitet: 17, alder: 2, hk: 1 },
    { treslag: 'L', bonitet: 14, alder: 35, hk: 3 }, { treslag: 'F', bonitet: 8, alder: 130, hk: 5 },
    { treslag: 'G', bonitet: 23, alder: 28, hk: 3 }, { treslag: 'G', bonitet: 14, alder: 68, hk: 4 },
  ];
  const bestand = [];
  let nr = 1;
  for (let j = 0; j < rad; j++) {
    for (let i = 0; i < kol; i++) {
      const ring = [p[j][i], p[j][i + 1], p[j + 1][i + 1], p[j + 1][i], p[j][i]].map(([x, y]) => utmTilGeo(x, y, 32));
      const geo = { type: 'Polygon', coordinates: [ring] };
      const pr = profiler[Math.floor(r() * profiler.length)];
      const alder = Math.max(0, Math.round(pr.alder + (r() - 0.5) * 10));
      const k = 0.012 + 0.0012 * pr.bonitet;
      const maks = { G: 3.0, F: 2.4, L: 2.0 }[pr.treslag] * pr.bonitet;
      const vol = pr.hk === 1 ? 0 : maks * (1 - Math.exp(-k * alder)) ** 3 * (0.8 + r() * 0.35);
      const props = {
        BESTANDNR: nr, TEIG: j < 2 ? 1 : 2, TRESLAG: pr.treslag, BONITET: pr.bonitet, HOGSTKLASSE: pr.hk, ALDER: alder,
        VOLUM_DAA: Math.round(vol * 10) / 10, TREANTALL: pr.hk === 2 ? Math.round(250 + r() * 250) : pr.hk === 3 ? Math.round(120 + r() * 100) : null,
        MIDDELHOYDE: pr.hk >= 3 ? Math.round((pr.bonitet * 0.9 * (1 - Math.exp(-0.03 * alder))) * 10) / 10 : null,
        MILJOFIGUR: nr === 10 ? 'Ja' : '',
        MERKNAD: nr === 10 ? 'Gammel furuskog med liggende død ved – MiS-figur' : '',
      };
      bestand.push(normaliserBestand(props, geo, arealM2(geo) / 1000, iAar));
      nr++;
    }
  }
  return {
    eiendom: { navn: 'Demoskogen (fiktiv)', kommune: 'Løten', gnrbnr: '12/3', takstAar: iAar - 3, eier: '' },
    bestand,
  };
}
