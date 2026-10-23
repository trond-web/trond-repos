// Demo-plan: åtte drifter på Hadeland med to maskinlag og tre mottak.
// Navn og tall er eksempler, ikke reelle avtaler.

export function demoPlan(startdato) {
  return {
    versjon: 1,
    innstillinger: { startdato, uker: 36 },
    lag: [
      { id: 'lag1', navn: 'Lag 1 – Ponsse middels', maskin: 'middels', timer: 9, flyttDager: 1, start: '' },
      { id: 'lag2', navn: 'Lag 2 – liten tynningsmaskin', maskin: 'liten', timer: 8, flyttDager: 1, start: '' },
    ],
    mottak: [
      { id: 'sag', navn: 'Sagbruk (Eidsvoll)', lat: 60.33, lon: 11.26, sortimenter: ['gs', 'fs'], kvote: 450 },
      { id: 'masse', navn: 'Massevirketerminal (Hønefoss)', lat: 60.17, lon: 10.26, sortimenter: ['gm', 'fm', 'lm'], kvote: 350 },
      { id: 'energi', navn: 'Flisanlegg (Gran)', lat: 60.39, lon: 10.56, sortimenter: ['en'], kvote: 120 },
    ],
    drifter: [
      {
        id: 'd1', navn: 'Lunner Nordre – teig 12', lat: 60.30, lon: 10.60, lag: 'lag1', rekkefolge: 1,
        hogstform: 'slutt', middelstamme: 0.45, terreng: 2, kjoreavstand: 350, vegklasse: 1, skogsbilveiKm: 1.5, velteplass: 900,
        fore: 'helaar', volum: { gs: 2300, gm: 1050, fs: 240, fm: 80, lm: 120, en: 0 }, tidligst: '', frist: '',
      },
      {
        id: 'd2', navn: 'Myrlia – vinterteig', lat: 60.42, lon: 10.48, lag: 'lag1', rekkefolge: 2,
        hogstform: 'slutt', middelstamme: 0.38, terreng: 3, kjoreavstand: 600, vegklasse: 4, skogsbilveiKm: 3.2, velteplass: 700,
        fore: 'frost', volum: { gs: 3800, gm: 2400, fs: 0, fm: 0, lm: 300, en: 500 }, tidligst: '', frist: '',
      },
      {
        id: 'd3', navn: 'Brandbu Østre – furumo', lat: 60.43, lon: 10.52, lag: 'lag1', rekkefolge: 3,
        hogstform: 'slutt', middelstamme: 0.32, terreng: 1, kjoreavstand: 250, vegklasse: 3, skogsbilveiKm: 0.8, velteplass: 600,
        fore: 'barmark', volum: { gs: 300, gm: 160, fs: 1300, fm: 640, lm: 60, en: 0 }, tidligst: '', frist: '',
      },
      {
        id: 'd4', navn: 'Jaren – tynning', lat: 60.39, lon: 10.58, lag: 'lag2', rekkefolge: 1,
        hogstform: 'tynning', middelstamme: 0.14, terreng: 2, kjoreavstand: 400, vegklasse: 1, skogsbilveiKm: 0.5, velteplass: 400,
        fore: 'helaar', volum: { gs: 120, gm: 760, fs: 0, fm: 80, lm: 100, en: 0 }, tidligst: '', frist: '',
      },
      {
        id: 'd5', navn: 'Grua – lisidedrift', lat: 60.27, lon: 10.66, lag: 'lag2', rekkefolge: 2,
        hogstform: 'slutt', middelstamme: 0.28, terreng: 4, kjoreavstand: 800, vegklasse: 5, skogsbilveiKm: 2.4, velteplass: 300,
        fore: 'barmark', volum: { gs: 840, gm: 520, fs: 0, fm: 0, lm: 80, en: 120 }, tidligst: '', frist: '',
      },
      {
        id: 'd6', navn: 'Ølstad – tynning', lat: 60.36, lon: 10.61, lag: 'lag2', rekkefolge: 3,
        hogstform: 'tynning', middelstamme: 0.16, terreng: 2, kjoreavstand: 300, vegklasse: 1, skogsbilveiKm: 0.3, velteplass: 400,
        fore: 'helaar', volum: { gs: 80, gm: 600, fs: 0, fm: 120, lm: 80, en: 0 }, tidligst: '', frist: '',
      },
      {
        id: 'd7', navn: 'Tingelstad – helårsteig', lat: 60.41, lon: 10.62, lag: 'lag1', rekkefolge: 4,
        hogstform: 'slutt', middelstamme: 0.42, terreng: 2, kjoreavstand: 450, vegklasse: 3, skogsbilveiKm: 2.1, velteplass: 800,
        fore: 'helaar', volum: { gs: 2600, gm: 1300, fs: 200, fm: 100, lm: 150, en: 200 }, tidligst: '', frist: '',
      },
      {
        id: 'd8', navn: 'Volla – sommerdrift', lat: 60.35, lon: 10.70, lag: 'lag2', rekkefolge: 4,
        hogstform: 'slutt', middelstamme: 0.3, terreng: 3, kjoreavstand: 500, vegklasse: 4, skogsbilveiKm: 1.8, velteplass: 500,
        fore: 'barmark', volum: { gs: 900, gm: 500, fs: 150, fm: 80, lm: 60, en: 0 }, tidligst: '', frist: '',
      },
    ],
  };
}
