// Delt mellom appen (tommerkjoper.js), kjøpersiden (tommer-svar.js) og serveren (tilbud-relay.js under /api/tommer):
// sortimentene, rensing og sjekk av kjøperens svar, anslått netto og nedlasting. Ingen import – filen er åpen uten
// innlogging, slik at kjøpersiden virker for alle med lenken.
export const SORTIMENT = [
  { id: 'gs', treslag: 'G', sag: true, navn: 'Gran sagtømmer' },
  { id: 'gm', treslag: 'G', sag: false, navn: 'Gran massevirke' },
  { id: 'fs', treslag: 'F', sag: true, navn: 'Furu sagtømmer' },
  { id: 'fm', treslag: 'F', sag: false, navn: 'Furu massevirke' },
  { id: 'lm', treslag: 'L', sag: false, navn: 'Lauv massevirke' },
];
// ---------- kjøperens svar (brukes også av serveren) ----------
const tall = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v));
const tekst = (v, n) => (v == null ? '' : String(v).slice(0, n));
export function rensSvar(s = {}) {
  const priser = {}; for (const { id } of SORTIMENT) priser[id] = tall(s.priser?.[id]);
  return {
    priser, drift: tall(s.drift), fastSum: tall(s.fastSum),
    tidspunkt: tekst(s.tidspunkt, 200), gyldigTil: /^\d{4}-\d{2}-\d{2}$/.test(String(s.gyldigTil || '')) ? String(s.gyldigTil) : '',
    sertifisert: !!s.sertifisert, firma: tekst(s.firma, 120), orgnr: tekst(s.orgnr, 20).replace(/\D/g, ''), kontaktperson: tekst(s.kontaktperson, 120),
    telefon: tekst(s.telefon, 40), epost: tekst(s.epost, 120), kommentar: tekst(s.kommentar, 3000),
  };
}
export function sjekkSvar(r) {
  if (!r.firma) return 'Oppgi firma';
  if (r.fastSum == null && !Object.values(r.priser || {}).some((v) => v != null)) return 'Oppgi minst én pris eller en fast sum';
  return null;
}
// Anslått brutto og netto til skogeier for et forslag, med volumene i pakken.
export function vurderSvar(pakke, s) {
  const sort = pakke.sum?.sortiment || {}; const m3 = pakke.sum?.salg || 0;
  if (s.fastSum != null && !Object.values(s.priser || {}).some((v) => v != null)) return { brutto: s.fastSum, drift: 0, netto: s.fastSum, perM3: m3 ? s.fastSum / m3 : null, mangler: [] };
  let brutto = 0; const mangler = [];
  for (const { id, navn } of SORTIMENT) { if (!sort[id]) continue; const p = s.priser?.[id]; if (p == null) mangler.push(navn); else brutto += p * sort[id]; }
  const drift = pakke.salgsform === 'leveranse' ? (s.drift || 0) * m3 : 0;
  const netto = s.fastSum != null ? s.fastSum : brutto - drift;
  return { brutto, drift, netto, perM3: m3 ? netto / m3 : null, mangler };
}
// Forslagene sortert etter anslått netto, høyest først. Beste fullstendige og gyldige forslag markeres.
// ---------- nedlasting for kjøperen ----------
const csvFelt = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function csv(p) {
  const hode = ['Bestand', 'Teig', 'Areal daa', 'Treslag', 'Bonitet', 'Hogstklasse', 'Alder', 'm3/daa', 'Staaende m3', 'Hogst', 'Hogstaar', 'Uttak m3', 'Bratthet', 'Markfuktighet', 'Miljofigur', 'Merknad'];
  const rader = p.bestand.map((b) => [b.nr, b.teig, b.areal, b.treslagNavn, b.bonitet, b.hogstklasse, b.alder, b.m3Daa, b.m3, b.hogst?.navn, b.hogst?.aar, b.hogst?.m3, b.drift?.bratt?.niva, b.drift?.fukt?.niva, b.miljo == null ? '' : b.miljo ? 'Ja' : 'Nei', b.merknad]);
  return `﻿${[hode, ...rader].map((r) => r.map(csvFelt).join(';')).join('\r\n')}\r\n`;
}
export function geojson(p) {
  const perNr = new Map(p.bestand.map((b) => [b.nr, b]));
  return { type: 'FeatureCollection', name: p.tittel, features: (p.kart || []).map((k) => { const b = perNr.get(k.nr) || {}; return { type: 'Feature', geometry: k.geometri, properties: { bestand: b.nr, areal_daa: b.areal, treslag: b.treslagNavn, bonitet: b.bonitet, hogstklasse: b.hogstklasse, alder: b.alder, m3: b.m3, hogst: b.hogst?.navn || null, hogstaar: b.hogst?.aar || null, uttak_m3: b.hogst?.m3 ?? null } }; }) };
}
