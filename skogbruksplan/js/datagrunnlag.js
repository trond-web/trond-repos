// Henter og oppdaterer det offentlige datagrunnlaget for en plan: miljødata til PEFC, veinett fra NVDB og
// tømmerpriser fra SSB. Brukes når planen lages og fra «Oppdater alle» i oversikten. Ingen DOM.
import { hentMiljodata } from './pefc-data.js';
import { tomPefc } from './pefc.js';
import { hentNvdbVeier, tomtVeiregister, hentTraktorveierOgStier, slaaInnFkb } from './veier.js';
import { hentSsbPriser, STANDARD_VERDI } from './verdi.js';

export const KILDEREKKEFOLGE = ['eiendom', 'plan', 'sr16', 'ar5', 'vegetasjon', 'nvdb', 'fkb', 'mis', 'vern', 'hb13', 'nin', 'utvalgte', 'art', 'friluft', 'kultur', 'ssb'];

export function grenseFor(plan) {
  if (plan.eiendom?.grense) return plan.eiendom.grense;
  const flater = plan.bestand.filter((b) => b.geometri).flatMap((b) => (b.geometri.type === 'Polygon' ? [b.geometri.coordinates] : b.geometri.coordinates));
  return flater.length ? { type: 'MultiPolygon', coordinates: flater } : null;
}

export async function hentDatagrunnlag(plan, { hvilke = ['miljo', 'nvdb', 'fkb', 'ssb'], nyId, kommunenr = plan.eiendom?.kommunenr, logg = () => {}, hent = fetch } = {}) {
  const grense = grenseFor(plan);
  const feil = [];
  plan.datakilder = plan.datakilder || {};
  if (!grense) return { feil: ['Planen mangler eiendomsgrense og bestand.'] };

  // Kildene hentes samtidig (de er uavhengige), og resultatene legges inn etter hverandre.
  const kjor = (id, fn) => (hvilke.includes(id) ? fn().then((r) => ({ r }), (e) => ({ e })) : Promise.resolve(null));
  const [miljo, nvdb, fkb, ssb] = await Promise.all([
    kjor('miljo', () => hentMiljodata(grense, { hent, logg: (t) => logg('miljo', t) })),
    kjor('nvdb', () => hentNvdbVeier(grense, { hent, medPrivate: true, logg: (t) => logg('nvdb', t) })),
    kjor('fkb', () => hentTraktorveierOgStier(grense, { hent, logg: (t) => logg('fkb', t) })),
    kommunenr ? kjor('ssb', () => hentSsbPriser(kommunenr, { hent })) : Promise.resolve(null),
  ]);
  if (miljo) {
    if (miljo.e) { feil.push(`Miljødata: ${miljo.e.message}`); logg('miljo', `Feil: ${miljo.e.message}`, false); } else {
      const r = miljo.r;
      plan.pefc = plan.pefc || tomPefc();
      plan.pefc.objekter = [...plan.pefc.objekter.filter((o) => o.kilde !== 'offentlig'), ...r.objekter.map((o) => ({ id: nyId('po'), ...o }))];
      plan.pefc.hentet = new Date().toISOString();
      Object.assign(plan.datakilder, r.kilder);
      feil.push(...r.feil);
      logg('miljo', `${r.objekter.length} miljøobjekter fra ${Object.keys(r.kilder).length} kilder`, true);
    }
  }
  if (nvdb) {
    if (nvdb.e) { feil.push(`NVDB: ${nvdb.e.message}`); logg('nvdb', `Feil: ${nvdb.e.message}`, false); } else {
      const r = nvdb.r;
      plan.veier = plan.veier || tomtVeiregister();
      for (const v of r.veier) {
        const finnes = plan.veier.veier.find((x) => x.nvdb && x.vegnummer === v.vegnummer);
        if (finnes) { finnes.geometri = v.geometri; finnes.lengde = v.lengde; if (v.klasseKilde) { finnes.klasse = v.klasse; finnes.klasseKilde = v.klasseKilde; } } else plan.veier.veier.push({ id: nyId('v'), tilstand: 'ukjent', eiere: [], merknad: '', ...v });
      }
      for (const p of r.punkter) if (!plan.veier.punkter.some((x) => x.nvdbId === p.nvdbId)) plan.veier.punkter.push({ id: nyId('vp'), tilstand: 'ukjent', merknad: '', ...p });
      plan.datakilder.nvdb = r.kilde;
      logg('nvdb', `${r.veier.length} veier (${Math.round(r.veier.reduce((s, v) => s + v.lengde, 0) / 100) / 10} km) og ${r.punkter.length} punkter`, true);
    }
  }
  if (fkb) {
    if (fkb.e) { feil.push(`Traktorveier og stier: ${fkb.e.message}`); logg('fkb', `Feil: ${fkb.e.message}`, false); } else {
      const r = fkb.r;
      plan.veier = plan.veier || tomtVeiregister();
      slaaInnFkb(plan.veier, r, nyId); // etter NVDB, i samme rekkefølge som før
      plan.datakilder.fkb = r.kilde;
      logg('fkb', `${r.traktorveier.length} traktorveier og ${r.stier.length} stier (${r.kilde.merknad})`, true);
    }
  }
  if (hvilke.includes('ssb')) {
    if (!kommunenr) logg('ssb', 'Mangler kommunenummer – hopper over tømmerpriser', false);
    else if (ssb.e) { feil.push(`SSB: ${ssb.e.message}`); logg('ssb', `Feil: ${ssb.e.message}`, false); } else {
      const d = ssb.r;
      plan.verdi = { ...STANDARD_VERDI, ...plan.verdi, ssb: d };
      const g = [d.kommune, d.fylke, d.land].find((x) => x.nr === d.grunnlag);
      plan.datakilder.ssb = { id: 'ssb', navn: 'Tømmerpriser', eier: 'SSB', hentet: d.hentet, antall: 1, dataFra: `${d.aar}`, dataTil: `${d.aar}`, krav: [], merknad: `${g.navn}: ${Math.round(g.pris)} kr/m³` };
      logg('ssb', `${g.navn} ${d.aar}: ${Math.round(g.pris)} kr/m³ i snitt`, true);
    }
  }
  return { feil };
}
