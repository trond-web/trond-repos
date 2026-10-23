// Ordre fra VSYS Virkeshandel (Skogdata): innkjøpsordre (IO), salgsordre (SO) og produksjonsordre (PO).
// Import fra CSV-uttrekk (eksport fra VH-klienten, Excel «Lagre som CSV» eller uttrekk fra replikadatabasen)
// og eksport av ordreplanen tilbake. Kolonnenavn gjenkjennes automatisk. Ren logikk uten DOM.

import { SORTIMENTER, SORT_ID, sortiment } from './motor.js';

export const ORDRETYPER = { io: 'Innkjøpsordre', so: 'Salgsordre', po: 'Produksjonsordre' };

// ---------- CSV ----------
export function lesCsv(tekst) {
  const t = String(tekst || '').replace(/^﻿/, '');
  const forste = t.split(/\r?\n/, 1)[0] || '';
  const skille = [';', '\t', ','].map((c) => [c, forste.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rader = [];
  let rad = [];
  let felt = '';
  let iSitat = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (iSitat) {
      if (c === '"' && t[i + 1] === '"') { felt += '"'; i++; } else if (c === '"') iSitat = false; else felt += c;
    } else if (c === '"') iSitat = true;
    else if (c === skille) { rad.push(felt); felt = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      rad.push(felt); felt = '';
      if (rad.some((x) => x.trim() !== '')) rader.push(rad);
      rad = [];
    } else felt += c;
  }
  rad.push(felt);
  if (rad.some((x) => x.trim() !== '')) rader.push(rad);
  if (!rader.length) return { kolonner: [], rader: [] };
  const kolonner = rader[0].map((k) => k.trim());
  return { kolonner, rader: rader.slice(1).map((r) => Object.fromEntries(kolonner.map((k, i) => [k, (r[i] ?? '').trim()]))) };
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9æøå]/g, '');

// Kolonnenavn som gjenkjennes (første treff vinner). Rekkefølgen betyr noe: koblinger står før generelle navn.
export const KOLONNER = {
  type: ['ordretype', 'type', 'ordreart', 'ordrekategori'],
  kobletSo: ['salgsordre', 'salgsordrenr', 'salgsordrenummer', 'sonr', 'kobletso', 'kobletsalgsordre'],
  kobletIo: ['innkjøpsordre', 'innkjøpsordrenr', 'innkjøpsordrenummer', 'ionr', 'skogeieravtale', 'skogeieravtalenr'],
  ordrenr: ['ordrenr', 'ordrenummer', 'ordre', 'ordreid', 'avtalenr', 'avtalenummer', 'kontraktnr', 'kontraktsnr', 'ponr', 'produksjonsordre'],
  leverandor: ['leverandør', 'leverandørnavn', 'skogeier', 'skogeiernavn', 'selger'],
  kunde: ['kunde', 'kundenavn', 'kjøper', 'kjøpernavn'],
  eiendom: ['eiendom', 'gnrbnr', 'kommunegnrbnr', 'eiendomsnr', 'matrikkel'],
  hentested: ['hentested', 'hentestednavn', 'velteplass', 'hogstfelt', 'driftsnavn', 'drift', 'avvirkningssted', 'teig', 'objekt'],
  leveringssted: ['leveringssted', 'leveringsstednavn', 'mottak', 'mottaksted', 'målepunkt', 'industri', 'fabrikk', 'terminal'],
  sortiment: ['sortiment', 'sortimentnavn', 'sortimentsnavn', 'sortimentkode', 'sortimentskode', 'virkeskode', 'vare', 'varenavn', 'produkt'],
  volum: ['volum', 'ordrevolum', 'avtaltvolum', 'bestiltvolum', 'planvolum', 'kvantum', 'mengde', 'm3', 'fm3', 'm3fub', 'm3to'],
  pris: ['pris', 'prism3', 'prisprm3', 'krm3', 'enhetspris'],
  fra: ['fra', 'fradato', 'fom', 'startdato', 'leveringfra', 'periodefra', 'gyldigfra', 'leveringsperiodefra'],
  til: ['til', 'tildato', 'tom', 'sluttdato', 'leveringtil', 'periodetil', 'gyldigtil', 'leveringsperiodetil', 'frist'],
  status: ['status', 'ordrestatus'],
  entreprenor: ['entreprenør', 'entreprenørnavn', 'driftsentreprenør', 'hogstlag', 'maskinlag', 'lag'],
  produsert: ['produsert', 'hogd', 'avvirket', 'produsertvolum'],
  framkjort: ['framkjørt', 'fremkjørt', 'framkjort', 'fremkjort', 'framkjørtvolum'],
  transportert: ['transportert', 'kjørt', 'transportertvolum', 'levert'],
  innmalt: ['innmålt', 'målt', 'innmalt', 'innmåltvolum'],
  statusdato: ['statusdato', 'rapportdato', 'oppdatert', 'sistoppdatert', 'dato'],
  lat: ['lat', 'breddegrad', 'latitude'],
  lon: ['lon', 'lengdegrad', 'longitude', 'lng'],
};

export function finnKolonner(kolonner) {
  const brukt = new Set();
  const kart = {};
  for (const [felt, navn] of Object.entries(KOLONNER)) {
    const k = kolonner.find((c) => !brukt.has(c) && navn.map(norm).includes(norm(c)));
    if (k) { kart[felt] = k; brukt.add(k); }
  }
  return kart;
}

export function tall(v) {
  if (v === undefined || v === null || v === '') return 0;
  const s = String(v).replace(/\s| /g, '');
  // Norsk desimalkomma; har tallet både punktum og komma, er det siste tegnet desimalskillet
  const k = s.lastIndexOf(',');
  const p = s.lastIndexOf('.');
  const n = k >= 0 && p >= 0 ? (k > p ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')) : s.replace(',', '.');
  const x = parseFloat(n);
  return Number.isFinite(x) ? x : 0;
}

export function dato(v) {
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) { const aar = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${aar}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return '';
}

// Sortimentsnavn eller -kode fra VSYS til appens sortimenter. Egne koder kan legges i plan.sortimentkoder.
export function tolkSortiment(tekst, egne = {}) {
  const raa = String(tekst || '').trim();
  if (!raa) return null;
  if (egne[raa]) return egne[raa];
  if (SORT_ID.includes(raa)) return raa;
  const t = raa.toLowerCase();
  const navn = SORTIMENTER.find((s) => s.navn.toLowerCase() === t || s.kort.toLowerCase() === t);
  if (navn) return navn.id;
  if (/energi|flis|bio|grot|brensel|\bved\b/.test(t)) return 'en';
  if (/lauv|bjørk|bjork|\bosp|\bor\b|selje|eik|bøk/.test(t)) return 'lm';
  const gran = /gran|spruce/.test(t);
  const furu = /furu|pine/.test(t);
  const masse = /masse|slip|cellulose|kubb|papir|fiber/.test(t);
  const sag = !masse && /sag|skur|tømmer|tommer|stokk|timber|log/.test(t);
  if (gran && sag) return 'gs';
  if (furu && sag) return 'fs';
  if (gran && masse) return 'gm';
  if (furu && masse) return 'fm';
  return null;
}

function tolkType(v, standard) {
  const t = norm(v);
  if (!t) return standard;
  if (/^(io|inn|kjøp|skogeier)/.test(t)) return 'io';
  if (/^(so|salg)/.test(t)) return 'so';
  if (/^(po|prod)/.test(t)) return 'po';
  return standard;
}

const nyId = (p) => p + Math.random().toString(36).slice(2, 8);
const likNavn = (a, b) => norm(a) && norm(a) === norm(b);
const finnPaNavn = (liste, navn) => liste.find((x) => likNavn(x.navn, navn)) || (norm(navn).length > 3 ? liste.find((x) => norm(x.navn).includes(norm(navn)) || norm(navn).includes(norm(x.navn))) : null);

// Leser inn ordrelinjer i planen. Én rad per ordrelinje; rader med samme ordrenummer og type blir én ordre.
// Finnes ordren fra før (samme nummer og type), oppdateres den. Returnerer en oppsummering.
export function importerOrdre(plan, tekst, standardType = 'io') {
  const { kolonner, rader } = lesCsv(tekst);
  const k = finnKolonner(kolonner);
  const verdi = (r, felt) => (k[felt] ? r[k[felt]] : '');
  plan.ordre ||= { io: [], so: [], po: [] };
  for (const t of ['io', 'so', 'po']) plan.ordre[t] ||= [];
  plan.sortimentkoder ||= {};
  plan.lag ||= []; plan.mottak ||= []; plan.drifter ||= [];
  const res = { rader: rader.length, kolonner: k, io: 0, so: 0, po: 0, nyeDrifter: [], nyeMottak: [], nyeLag: [], ukjenteSortimenter: [], hoppetOver: 0 };
  if (!k.ordrenr) { res.feil = 'Fant ingen kolonne for ordrenummer (f.eks. «Ordrenr»).'; return res; }

  const grupper = new Map();
  for (const r of rader) {
    const nr = verdi(r, 'ordrenr');
    if (!nr) { res.hoppetOver++; continue; }
    const type = tolkType(verdi(r, 'type'), standardType);
    const nokkel = `${type}|${nr}`;
    if (!grupper.has(nokkel)) grupper.set(nokkel, { type, nr, rader: [] });
    grupper.get(nokkel).rader.push(r);
  }

  for (const { type, nr, rader: rr } of grupper.values()) {
    const felles = (felt) => rr.map((r) => verdi(r, felt)).find((x) => x) || '';
    const liste = plan.ordre[type];
    let o = liste.find((x) => x.ordrenr === nr);
    const ny = !o;
    if (ny) { o = { id: nyId(type), ordrenr: nr }; liste.push(o); }
    o.status = felles('status') || o.status || '';
    if (felles('fra')) o.fra = dato(felles('fra'));
    if (felles('til')) o.til = dato(felles('til'));

    const linjer = [];
    for (const r of rr) {
      const raa = verdi(r, 'sortiment');
      if (!raa) continue;
      const s = tolkSortiment(raa, plan.sortimentkoder);
      if (!s) { if (!res.ukjenteSortimenter.includes(raa)) res.ukjenteSortimenter.push(raa); continue; }
      linjer.push({ sortiment: s, volum: tall(verdi(r, 'volum')), pris: tall(verdi(r, 'pris')), soNr: verdi(r, 'kobletSo') || undefined, kilde: raa });
    }
    // Flere rader med samme sortiment summeres
    const samlet = [];
    for (const l of linjer) {
      const x = samlet.find((y) => y.sortiment === l.sortiment && y.soNr === l.soNr);
      if (x) { x.volum += l.volum; x.pris = x.pris || l.pris; } else samlet.push(l);
    }
    if (samlet.length) o.linjer = samlet.map(({ kilde, ...l }) => l);
    else o.linjer ||= [];

    if (type === 'io') {
      o.leverandor = felles('leverandor') || o.leverandor || '';
      o.eiendom = felles('eiendom') || o.eiendom || '';
      const sted = felles('hentested') || o.eiendom || o.leverandor || `IO ${nr}`;
      o.hentested = sted;
      let d = plan.drifter.find((x) => x.id === o.drift) || finnPaNavn(plan.drifter, sted);
      if (!d) {
        d = nyDrift(plan, sted, { lat: tall(felles('lat')) || '', lon: tall(felles('lon')) || '' });
        res.nyeDrifter.push(d.navn);
      }
      o.drift = d.id;
      res.io++;
    } else if (type === 'so') {
      o.kunde = felles('kunde') || o.kunde || '';
      const sted = felles('leveringssted') || o.kunde || `SO ${nr}`;
      o.leveringssted = sted;
      let m = plan.mottak.find((x) => x.id === o.mottak) || finnPaNavn(plan.mottak, sted);
      if (!m) {
        m = { id: nyId('m'), navn: sted, lat: tall(felles('lat')) || '', lon: tall(felles('lon')) || '', sortimenter: [], kvote: 0 };
        plan.mottak.push(m);
        res.nyeMottak.push(m.navn);
      }
      for (const l of o.linjer) if (!m.sortimenter.includes(l.sortiment)) m.sortimenter.push(l.sortiment);
      o.mottak = m.id;
      res.so++;
    } else {
      o.entreprenor = felles('entreprenor') || o.entreprenor || '';
      const ioNr = felles('kobletIo');
      const io = ioNr ? plan.ordre.io.find((x) => x.ordrenr === ioNr) : null;
      if (io) o.io = io.id;
      const sted = felles('hentested');
      const d = (io && plan.drifter.find((x) => x.id === io.drift)) || (sted && finnPaNavn(plan.drifter, sted)) || plan.drifter.find((x) => x.id === o.drift);
      if (d) o.drift = d.id;
      if (o.entreprenor) {
        let lag = finnPaNavn(plan.lag, o.entreprenor);
        if (!lag) {
          lag = { id: nyId('l'), navn: o.entreprenor, maskin: 'middels', timer: 9, flyttDager: 1, start: '' };
          plan.lag.push(lag);
          res.nyeLag.push(lag.navn);
        }
        o.lag = lag.id;
      }
      const f = { produsert: tall(felles('produsert')), framkjort: tall(felles('framkjort')), transportert: tall(felles('transportert')), innmalt: tall(felles('innmalt')), dato: dato(felles('statusdato')) };
      if (f.produsert || f.framkjort || f.transportert || f.innmalt) o.faktisk = f;
      o.linjer = [];
      res.po++;
    }
  }
  kobleOrdre(plan);
  return res;
}

function nyDrift(plan, navn, ekstra = {}) {
  const lag = plan.lag[0]?.id || '';
  const nr = Math.max(0, ...plan.drifter.filter((d) => d.lag === lag).map((d) => +d.rekkefolge || 0)) + 1;
  const d = {
    id: nyId('d'), navn, lag, rekkefolge: nr, hogstform: 'slutt', middelstamme: 0.3, terreng: 2, kjoreavstand: 300, vegklasse: 1,
    skogsbilveiKm: 1, velteplass: 600, fore: 'helaar', volum: {}, lat: '', lon: '', tidligst: '', frist: '', ...ekstra,
  };
  plan.drifter.push(d);
  return d;
}

// Kobler IO-linjer til SO via salgsordrenummer (IO–SO-koblingen i VSYS) når begge finnes.
export function kobleOrdre(plan) {
  const so = plan.ordre?.so || [];
  for (const io of plan.ordre?.io || []) {
    for (const l of io.linjer || []) {
      if (l.soNr) { const s = so.find((x) => x.ordrenr === l.soNr); if (s) l.so = s.id; }
    }
  }
}

// Lager ordreutkast fra planen der det mangler ordre: IO og PO per drift, SO per mottak med planlagt volum.
export function ordreFraPlan(plan, res) {
  plan.ordre ||= { io: [], so: [], po: [] };
  for (const t of ['io', 'so', 'po']) plan.ordre[t] ||= [];
  const n = { io: 0, so: 0, po: 0 };
  for (const d of plan.drifter) {
    if (!plan.ordre.io.some((x) => x.drift === d.id)) {
      plan.ordre.io.push({ id: nyId('io'), ordrenr: '', leverandor: '', eiendom: '', hentested: d.navn, drift: d.id, status: 'Utkast',
        linjer: SORT_ID.filter((s) => +d.volum?.[s] > 0).map((s) => ({ sortiment: s, volum: +d.volum[s], pris: 0 })) });
      n.io++;
    }
    if (!plan.ordre.po.some((x) => x.drift === d.id)) {
      const lag = plan.lag.find((l) => l.id === d.lag);
      plan.ordre.po.push({ id: nyId('po'), ordrenr: '', entreprenor: lag?.navn || '', drift: d.id, io: plan.ordre.io.find((x) => x.drift === d.id)?.id || '', lag: d.lag || '', fra: d.tidligst || '', til: d.frist || '', status: 'Utkast', linjer: [] });
      n.po++;
    }
  }
  // Salg som mangler: det som skal hogges per sortiment og ikke er dekket av salgsordre, fordeles på mottakene som tar sortimentet
  const io = plan.ordre.io;
  const tilgang = (sid) => plan.drifter.reduce((sum, d) => {
    const linjer = io.filter((x) => x.drift === d.id).flatMap((x) => x.linjer || []);
    return sum + (linjer.length ? linjer.filter((l) => l.sortiment === sid).reduce((a, l) => a + (+l.volum || 0), 0) : +d.volum?.[sid] || 0);
  }, 0);
  const solgt = (sid) => plan.ordre.so.flatMap((x) => x.linjer || []).filter((l) => l.sortiment === sid).reduce((a, l) => a + (+l.volum || 0), 0);
  const nye = new Map();
  for (const sid of SORT_ID) {
    const rest = Math.round(tilgang(sid) - solgt(sid));
    if (rest <= 0) continue;
    const tar = plan.mottak.filter((m) => (m.sortimenter || []).includes(sid));
    const udekket = tar.filter((m) => !plan.ordre.so.some((x) => x.mottak === m.id && x.linjer?.some((l) => l.sortiment === sid)));
    const mottak = udekket.length ? udekket : tar;
    for (const m of mottak) {
      if (!nye.has(m.id)) nye.set(m.id, { id: nyId('so'), ordrenr: '', kunde: m.navn, leveringssted: m.navn, mottak: m.id, fra: res.start, til: res.slutt, status: 'Utkast', linjer: [] });
      nye.get(m.id).linjer.push({ sortiment: sid, volum: Math.round(rest / mottak.length), pris: 0 });
    }
  }
  for (const so of nye.values()) { plan.ordre.so.push(so); n.so++; }
  return n;
}

// Ordreplanen som CSV: én rad per ordrelinje med avtalt og planlagt volum og datoer.
export function ordreCsv(plan, res) {
  const drift = Object.fromEntries((plan.drifter || []).map((d) => [d.id, d]));
  const mottak = Object.fromEntries((plan.mottak || []).map((m) => [m.id, m]));
  const soNr = Object.fromEntries((plan.ordre?.so || []).map((s) => [s.id, s.ordrenr]));
  const R = Object.fromEntries((res.drifter || []).map((d) => [d.id, d]));
  const f = (x) => (typeof x === 'number' ? x.toFixed(0) : x ?? '');
  const linjer = [['Ordretype', 'Ordrenr', 'Status', 'Leverandør/kunde/entreprenør', 'Hentested', 'Leveringssted', 'Sortiment', 'Avtalt m3',
    'Planlagt levert m3', 'Koblet salgsordre', 'Fra', 'Til', 'Planlagt start', 'Planlagt ferdig framkjørt', 'Planlagt siste lass'].join(';')];
  for (const io of plan.ordre?.io || []) {
    const r = res.ordre.io.find((x) => x.id === io.id);
    const d = R[io.drift] || {};
    for (const [i, l] of (io.linjer || []).entries()) {
      linjer.push(['IO', io.ordrenr, io.status, io.leverandor, drift[io.drift]?.navn, '', sortiment(l.sortiment)?.navn, f(+l.volum), f(r?.linjer[i]?.levert || 0),
        soNr[l.so] || l.soNr || '', io.fra, io.til, d.start, d.framkjortFerdig, d.sisteLevering].map(csvFelt).join(';'));
    }
  }
  for (const so of plan.ordre?.so || []) {
    const r = res.ordre.so.find((x) => x.id === so.id);
    for (const [i, l] of (so.linjer || []).entries()) {
      linjer.push(['SO', so.ordrenr, so.status, so.kunde, '', mottak[so.mottak]?.navn, sortiment(l.sortiment)?.navn, f(+l.volum), f(r?.linjer[i]?.levert || 0),
        '', so.fra, so.til, '', '', ''].map(csvFelt).join(';'));
    }
  }
  for (const po of plan.ordre?.po || []) {
    const r = res.ordre.po.find((x) => x.id === po.id) || {};
    const d = R[r.drift] || {};
    linjer.push(['PO', po.ordrenr, po.status, po.entreprenor, drift[r.drift]?.navn, '', '', f(d.tot || 0), f(d.levert || 0), '', po.fra, po.til, d.start, d.framkjortFerdig, d.sisteLevering].map(csvFelt).join(';'));
  }
  return '﻿' + linjer.join('\r\n');
}
const csvFelt = (v) => (/[;"\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));

// Eksempel på uttrekk som kan leses inn – brukes som mal i appen
export const MAL_CSV = [
  'Ordretype;Ordrenr;Leverandør;Kunde;Hentested;Leveringssted;Sortiment;Volum;Pris;Salgsordre;Fra;Til;Entreprenør;Innkjøpsordre;Produsert;Framkjørt;Transportert;Statusdato',
  'IO;100234;Ola Nordmann;;Lunner Nordre – teig 12;;Sagtømmer gran;2300;520;500118;;;;;;;;',
  'IO;100234;Ola Nordmann;;Lunner Nordre – teig 12;;Massevirke gran;1050;330;500120;;;;;;;;',
  'SO;500118;;Sagbruk AS;;Sagbruk (Eidsvoll);Sagtømmer gran;6000;560;;01.11.2026;31.03.2027;;;;;;',
  'SO;500120;;Massevirkekjøper AS;;Massevirketerminal (Hønefoss);Massevirke gran;4000;350;;01.11.2026;30.04.2027;;;;;;',
  'PO;700051;;;Lunner Nordre – teig 12;;;;;;;;Lag 1 – Ponsse middels;100234;850;700;520;30.10.2026',
].join('\r\n');

