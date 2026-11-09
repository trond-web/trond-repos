// Skiltplan for et oppdrag: hvilke skilt som trengs, hvor de skal stå, hvilke søknader og krav som gjelder, og en
// utskrift som kan legges ved søknaden om arbeidsvarsling. Ingen DOM – kan testes i Node. Dataene hentes av skiltplan-ui.js.
//
// Kravene (kilder i KILDER):
//   * Legges tømmer ved offentlig veg, eller krysser/arbeider man på eller ved offentlig veg, kreves godkjent
//     arbeidsvarslingsplan etter vegnormal N301 og skiltforskriften kap. 14. Planen gjelder hele drifta, til siste lass
//     er hentet. Søknad: riks- og fylkesveg → Statens vegvesen (Din side, Altinn-tilgang «Arbeidsvarsling»); kommunal
//     veg → kommunen; privat veg → søknad om skiltplan. Søknaden skal ha kontaktperson, byggherre, entreprenør og
//     ansvarlig for arbeidsvarslingen med kompetansebevis, arbeidsbeskrivelse, risikovurdering og skisse.
//   * Alle som arbeider på riks- og fylkesveg skal ha opplæring i arbeidsvarsling (kompetansebevis gyldig i 5 år).
//   * Skilt etter N300: midlertidige fareskilt har gul bunn, middels størrelse (MS) på vanlige veger. Fareskilt står
//     normalt 150–250 m før faren (50–100 m i tettbygd strøk). Skilt fjernes eller tildekkes når de ikke gjelder.
//   * Tømmer ved offentlig veg (kontraktsbestemmelsene for tømmer og Skoghåndboka): minst 3 m fra vegkanten (vegeier kan
//     tillate mindre på lite trafikkerte veger), aldri i skjæring eller på fylling, ikke på vegens grunn uten tillatelse,
//     ikke slik at det kan rulle eller skli ut i vegen eller grøfta, ikke så sikten i kryss eller langs vegen reduseres,
//     bunnfloa høyst 1 m over eller under kjørebanen, ikke under strømførende ledninger, standplass for tømmerbil
//     høyst 10 % helning, og annen trafikk skal kunne passere en tømmerbil som laster.
//   * Kryssende tømmertransport varsles med 156 «Annen fare» med underskilt.
//   * Stier og løyper: PEFC krever at stier og skiløyper ryddes mens hogsten pågår og hogstavfall fjernes fra dem.
//     Sikkerhetssonen rundt hogstmaskinen er i praksis 70–90 m; turgåere varsles der stiene går inn i fareområdet.
//   * Hogst nær kraftledning: nettselskapet varsles før arbeidet starter.
import { geoTilUtm, utmTilGeo } from './proj.js';

export const KILDER = {
  n301: { navn: 'Statens vegvesen: vegnormal N301 Arbeid på og ved veg', url: 'https://www.vegvesen.no/fag/publikasjoner/handboker/vegnormalene/n301' },
  soknad: { navn: 'Statens vegvesen: Søk om å varsle og sikre arbeid', url: 'https://www.vegvesen.no/fag/veg-og-gate/arbeidsvarsling/sok-om-a-varsle-og-sikre-arbeid/' },
  kurs: { navn: 'Statens vegvesen: Kurs i arbeidsvarsling (kompetansebevis gyldig i 5 år)', url: 'https://www.vegvesen.no/fag/veg-og-gate/arbeidsvarsling/kurs-i-arbeidsvarsling/' },
  skiltforskrift: { navn: 'Skiltforskriften (trafikkskilt, kap. 14 midlertidig skilting ved arbeid på veg)', url: 'https://lovdata.no/forskrift/2005-10-07-1219' },
  tommer: { navn: 'Skoghåndboka: Tillegging og lasting av tømmer ved offentlig veg', url: 'https://skoghandboka.no/tema/driftsteknikk/tillegging-og-lasting-av-tommer-ved-offentlig-veg/' },
  vegarbeid: { navn: 'Store norske leksikon: Trafikkskilt 110 Vegarbeid (plassering 150–250 m før faren)', url: 'https://snl.no/Vegarbeid_-_trafikkskilt' },
  kraft: { navn: 'Skoghåndboka: Hogst nær elektriske anlegg', url: 'https://skoghandboka.no/tema/driftsteknikk/hogst-naer-elektriske-anlegg/' },
  pefc: { navn: 'Norsk PEFC Skogstandard krav 6 (friluftsliv) – rydding av stier og løyper', url: 'https://pefcnorge.org/' },
};

// Skilt som brukes. Nummer etter skiltforskriften/N300. type styrer tegningen.
export const SKILT = {
  110: { nr: '110', navn: 'Vegarbeid', type: 'fare', gul: true, symbol: 'vegarbeid' },
  156: { nr: '156', navn: 'Annen fare', type: 'fare', gul: true, symbol: '!' },
  362: { nr: '362', navn: 'Fartsgrense', type: 'fart' },
  808: { nr: '808', navn: 'Underskilt med tekst', type: 'underskilt' },
  info: { nr: '–', navn: 'Informasjonsskilt (ikke trafikkskilt)', type: 'info' },
};
export const KATEGORI = { E: 'europaveg', R: 'riksveg', F: 'fylkesveg', K: 'kommunal veg', P: 'privat veg', S: 'skogsbilveg' };
export const MYNDIGHET = { E: 'Statens vegvesen', R: 'Statens vegvesen', F: 'Statens vegvesen', K: 'kommunen', P: 'kommunen (skiltplan for privat veg)', S: 'veieier (privat skogsbilveg)' };
export const SONE = 90; // m – sikkerhetssone rundt hogstmaskinen (bransjepraksis 70–90 m)

// Vanlig avstand fra varselskilt til arbeidsstedet etter fartsgrensen (fareskilt 150–250 m før faren, 50–100 m i tettbygd strøk).
export function skiltAvstand(fart) {
  if (!fart || fart <= 50) return 75;
  if (fart <= 60) return 150;
  if (fart <= 80) return 200;
  return 250;
}
// Foreslått nedsatt fartsgrense forbi arbeidsstedet (må godkjennes i planen).
export const nedsattFart = (fart) => (fart >= 80 ? 60 : fart >= 70 ? 50 : null);

// ---------- geometri (UTM33) ----------
const tilUtm = ([lon, lat]) => geoTilUtm(lon, lat, 33);
const tilGeo = ([x, y]) => utmTilGeo(x, y, 33).map((v) => Math.round(v * 1e6) / 1e6);
const linjerAv = (g) => (!g ? [] : g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []);
const ringerAv = (g) => (!g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
function avstandSeg(p, a, b) { const dx = b[0] - a[0]; const dy = b[1] - a[1]; const l = dx * dx + dy * dy; const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0; const q = [a[0] + t * dx, a[1] + t * dy]; return { d: Math.hypot(p[0] - q[0], p[1] - q[1]), q }; }
export function naermestPaaLinjer(p, linjer) { let best = null; for (const l of linjer) for (let i = 1; i < l.length; i++) { const r = avstandSeg(p, l[i - 1], l[i]); if (!best || r.d < best.d) best = r; } return best; }
function iRing(p, r) { let inn = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i]; const [xj, yj] = r[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inn = !inn; } return inn; }
const iPoly = (p, polys) => polys.some((rs) => iRing(p, rs[0]) && !rs.slice(1).some((r) => iRing(p, r)));
function avstandTilPoly(p, polys) { if (iPoly(p, polys)) return 0; let m = Infinity; for (const rs of polys) for (const r of rs) for (let i = 1; i < r.length; i++) m = Math.min(m, avstandSeg(p, r[i - 1], r[i]).d); return m; }
function tett(l, steg = 5) { const ut = [l[0]]; for (let i = 1; i < l.length; i++) { const a = l[i - 1]; const b = l[i]; const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / steg)); for (let s = 1; s <= n; s++) ut.push([a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n]); } return ut; }

// Punkter langs vegnettet i avstand D fra p, i (inntil) to motsatte retninger. veger: [{ linjer (UTM) }].
export function langsVeg(p, veger, D) {
  const node = new Map(); const kant = new Map(); const nokkel = ([x, y]) => `${Math.round(x / 2)}:${Math.round(y / 2)}`;
  const leggTil = (a, b) => { const ka = nokkel(a); const kb = nokkel(b); if (ka === kb) return; node.set(ka, a); node.set(kb, b); const d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (!kant.has(ka)) kant.set(ka, []); if (!kant.has(kb)) kant.set(kb, []); kant.get(ka).push([kb, d]); kant.get(kb).push([ka, d]); };
  for (const v of veger) for (const l of v.linjer) { const t = tett(l); for (let i = 1; i < t.length; i++) leggTil(t[i - 1], t[i]); }
  let start = null; let sd = Infinity; for (const [k, q] of node) { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); if (d < sd) { sd = d; start = k; } }
  if (!start) return [];
  const dist = new Map([[start, 0]]); const ko = [start];
  while (ko.length) { ko.sort((a, b) => dist.get(a) - dist.get(b)); const v = ko.shift(); const dv = dist.get(v); if (dv > D + 10) continue; for (const [u, d] of kant.get(v) || []) { const nd = dv + d; if (!dist.has(u) || nd < dist.get(u)) { dist.set(u, nd); ko.push(u); } } }
  // Kandidater: lengst ut (≤ D) i hver retning – også vegens ende hvis den er nærmere.
  const s0 = node.get(start); const kand = [];
  for (const [k, d] of dist) { if (d > D + 5) continue; const erEnde = (kant.get(k) || []).length <= 1; if (d >= D - 5 || erEnde) { const q = node.get(k); kand.push({ q, d, vinkel: Math.atan2(q[1] - s0[1], q[0] - s0[0]) }); } }
  kand.sort((a, b) => b.d - a.d);
  const valgt = [];
  for (const c of kand) { if (valgt.every((v) => { let dv = Math.abs(c.vinkel - v.vinkel); if (dv > Math.PI) dv = 2 * Math.PI - dv; return dv > (100 * Math.PI) / 180; })) valgt.push(c); if (valgt.length === 2) break; }
  return valgt.map((c) => ({ punkt: c.q, avstand: Math.round(c.d), retning: c.vinkel }));
}

// Der linjene i a krysser vegen b: linjen berører vegen og fortsetter minst 15 m ut på begge sider. Et spor som bare
// ender ved vegen (velteplass) er ikke en kryssing.
export function krysninger(a, b, toleranse = 6, ut_ = 15) {
  const ut = [];
  for (const la of a) {
    const t = tett(la, 4); const d = t.map((p) => naermestPaaLinjer(p, b));
    for (let i = 0; i < t.length; i++) {
      if (!d[i] || d[i].d > toleranse) continue;
      const for_ = d.slice(0, i).some((x) => x && x.d > ut_); const etter = d.slice(i + 1).some((x) => x && x.d > ut_);
      if (!for_ || !etter) continue;
      const q = d[i].q; if (!ut.some((x) => Math.hypot(x[0] - q[0], x[1] - q[1]) < 60)) ut.push(q);
    }
  }
  return ut;
}
// Innenfor sikkerhetssonen rundt hogstflatene.
const iSone = (p, polys, buffer) => avstandTilPoly(p, polys) <= buffer;

// ---------- analyse ----------
// grunnlag: { felt: [Polygon UTM], velteplasser: [[x,y]], driftsveg: [linjer UTM], offentlige: [{ kategori, ref, linjer, fart?, fartDeler? }],
//            private: [{ kategori, ref, linjer }], stier: [linjer UTM], idag }
export function lagSkiltplan(grunnlag, { hogst = true } = {}) {
  const felt = grunnlag.felt.flatMap(ringerAv); const situasjoner = []; const skilt = []; let nr = 0;
  const offentlige = grunnlag.offentlige || []; const private_ = grunnlag.private || [];
  // Fartsgrensen der vegen er nærmest p (fartDeler fra NVDB), ellers vegens fart.
  const fartI = (v, p) => { let best = null; for (const f of v.fartDeler || []) { const r = naermestPaaLinjer(p, f.linjer); if (r && (!best || r.d < best.d)) best = { d: r.d, fart: f.fart }; } return best && best.d < 60 ? best.fart : v.fart || null; };
  const medFart = (v, p) => ({ ...v, fart: fartI(v, p) });
  const fartVed = (p) => { let best = null; for (const v of offentlige) { const r = naermestPaaLinjer(p, v.linjer); if (r && (!best || r.d < best.d)) best = { d: r.d, v: medFart(v, p) }; } return best; };
  const leggSkilt = (s) => { skilt.push({ id: `s${++nr}`, ...s, punkt: tilGeo(s.punkt) }); };
  // Steder langs samme veg innenfor varslingsstrekningen dekkes av samme skiltsett.
  const varslet = []; // { v, p, D, sit }
  const dekket = (v, p) => varslet.find((x) => x.v.kategori === v.kategori && x.v.ref === v.ref && Math.hypot(x.p[0] - p[0], x.p[1] - p[1]) <= x.D);
  // Varselskilt i begge retninger langs vegen.
  const varsle = (sit, p, v, { hoved, tekst }) => {
    const D = skiltAvstand(v.fart); const fins = dekket(v, p);
    if (fins) { sit.avstand = fins.D; sit.sammeSkilt = fins.sit.id; return; }
    varslet.push({ v, p, D, sit });
    const pos = langsVeg(p, [v], D); const ned = nedsattFart(v.fart);
    pos.forEach((x, i) => {
      leggSkilt({ situasjon: sit.id, skilt: [hoved, '808'], tekst, punkt: x.punkt, merknad: `${x.avstand} m før arbeidsstedet${pos.length > 1 ? ` (retning ${i + 1})` : ''}, høyre side av vegen sett fra trafikken. Middels størrelse (MS), gul bunn.` });
      if (ned) leggSkilt({ situasjon: sit.id, skilt: ['362'], fart: ned, punkt: x.punkt, merknad: `Foreslått midlertidig fartsgrense ${ned} km/t forbi arbeidsstedet (vanlig ${v.fart} km/t). Settes sammen med varselskiltet og oppheves etter arbeidsstedet – må godkjennes i planen.` });
    });
    sit.avstand = D;
  };
  const vegNavn = (v) => `${KATEGORI[v.kategori] || 'veg'}${v.ref ? ` ${v.ref}` : ''}${v.fart ? ` (${v.fart} km/t)` : ''}`;

  // A. Velteplass ved offentlig veg.
  for (const p of grunnlag.velteplasser || []) {
    const f = fartVed(p);
    if (f && f.d <= 30) {
      const sit = { id: `A${situasjoner.length + 1}`, type: 'velteplass', tittel: `Velteplass ved ${vegNavn(f.v)}`, punkt: tilGeo(p), kategori: f.v.kategori, myndighet: MYNDIGHET[f.v.kategori], soknad: true, avstandVeg: Math.round(f.d) };
      situasjoner.push(sit); varsle(sit, p, f.v, { hoved: '110', tekst: 'Tømmerlasting' });
      leggSkilt({ situasjon: sit.id, skilt: ['info'], tekst: 'Velteplass – tømmer minst 3 m fra vegkant', punkt: p, merknad: 'Markering av velteplassen for hogstlaget og tømmerbilen (ikke trafikkskilt).' });
    } else {
      const pr = private_.map((v) => ({ v, r: naermestPaaLinjer(p, v.linjer) })).filter((x) => x.r && x.r.d <= 30).sort((a, b) => a.r.d - b.r.d)[0];
      situasjoner.push({ id: `A${situasjoner.length + 1}`, type: 'velteplass-privat', tittel: `Velteplass ved ${pr ? vegNavn(pr.v) : 'privat veg/skogsbilveg'}`, punkt: tilGeo(p), kategori: pr?.v.kategori || 'S', myndighet: MYNDIGHET[pr?.v.kategori || 'S'], soknad: false });
      leggSkilt({ situasjon: `A${situasjoner.length}`, skilt: ['info'], tekst: 'Skogsdrift – tømmerkjøring. Vis hensyn', punkt: p, merknad: 'Informasjonsskilt ved velteplassen på privat veg. Offentlige trafikkskilt på privat veg som er åpen for allmenn ferdsel krever skiltvedtak fra kommunen.' });
    }
  }
  // B. Driftsvegen krysser offentlig veg.
  for (const v0 of offentlige) for (const q of krysninger(grunnlag.driftsveg || [], v0.linjer)) {
    const v = medFart(v0, q);
    const sit = { id: `B${situasjoner.length + 1}`, type: 'kryssing', tittel: `Kryssende tømmertransport over ${vegNavn(v)}`, punkt: tilGeo(q), kategori: v.kategori, myndighet: MYNDIGHET[v.kategori], soknad: true };
    situasjoner.push(sit); varsle(sit, q, v, { hoved: '156', tekst: 'Kryssende tømmertransport' });
  }
  // C. Hogst inntil offentlig veg (innen én trelengde, 30 m) – fare for trær mot vegen.
  if (hogst) for (const v0 of offentlige) {
    let best = null; for (const l of v0.linjer) for (const p of tett(l, 10)) { const d = avstandTilPoly(p, felt); if (d <= 30 && (!best || d < best.d)) best = { d, p }; }
    if (!best) continue; const v = medFart(v0, best.p);
    const sit = { id: `C${situasjoner.length + 1}`, type: 'hogst-ved-veg', tittel: `Hogst inntil ${vegNavn(v)}`, punkt: tilGeo(best.p), kategori: v.kategori, myndighet: MYNDIGHET[v.kategori], soknad: true, avstandVeg: Math.round(best.d) };
    situasjoner.push(sit); varsle(sit, best.p, v, { hoved: '110', tekst: 'Skogsdrift' });
  }
  // D. Stier og løyper inn i fareområdet (hogstflatene + sikkerhetssonen).
  if (hogst) {
    const inn = []; for (const l of grunnlag.stier || []) { const t = tett(l, 5); let forrige = iSone(t[0], felt, SONE); for (let i = 1; i < t.length; i++) { const naa = iSone(t[i], felt, SONE); if (naa && !forrige && !inn.some((x) => Math.hypot(x[0] - t[i][0], x[1] - t[i][1]) < 80)) inn.push(t[i]); forrige = naa; } }
    if (inn.length) {
      const sit = { id: `D${situasjoner.length + 1}`, type: 'sti', tittel: `Stier inn i fareområdet (${inn.length} innganger)`, punkt: tilGeo(inn[0]), soknad: false };
      situasjoner.push(sit);
      for (const p of inn) leggSkilt({ situasjon: sit.id, skilt: ['info'], tekst: `Skogsdrift pågår – livsfare. Hold minst ${SONE} m avstand til maskinene. Stien ryddes etter drift.`, punkt: p, merknad: 'Der stien går inn i fareområdet. Sett opp ved oppstart, fjern når drifta er ferdig.' });
    }
  }
  const soknader = [...new Map(situasjoner.filter((s) => s.soknad).map((s) => [s.myndighet, s])).values()].map((s) => ({
    myndighet: s.myndighet, kategori: s.kategori,
    hvordan: ['E', 'R', 'F'].includes(s.kategori) ? 'Søk på Din side hos Statens vegvesen (tjenesten «Arbeidsvarsling», krever Altinn-tilgang). Gratis.' : s.kategori === 'K' ? 'Søk til kommunen (skiltmyndighet for kommunal veg).' : 'Søk om skiltplan for privat veg.',
    gjelder: [...new Set(situasjoner.filter((x) => x.soknad && x.myndighet === s.myndighet).map((x) => x.tittel))],
  }));
  return { situasjoner, skilt, soknader, krav: kravFor(situasjoner), laget: grunnlag.idag || new Date().toISOString().slice(0, 10) };
}

// Kravliste (sjekkliste) ut fra situasjonene.
export function kravFor(sits) {
  const har = (t) => sits.some((s) => s.type === t); const soknad = sits.some((s) => s.soknad); const k = [];
  const legg = (id, tekst, kilde) => k.push({ id, tekst, kilde });
  if (soknad) {
    legg('plan', 'Arbeidsvarslingsplan er søkt og godkjent av skiltmyndigheten før oppstart. Planen gjelder hele drifta, til siste lass er hentet.', 'tommer');
    legg('soknad', 'Søknaden har kontaktperson, byggherre (skogeier), entreprenør, ansvarlig for arbeidsvarslingen, arbeidsbeskrivelse, risikovurdering og skisse (denne skiltplanen).', 'soknad');
    legg('kompetanse', 'Ansvarlig for arbeidsvarslingen har gyldig kompetansebevis i arbeidsvarsling (gyldig i 5 år). Alle som arbeider på riks- og fylkesveg har opplæring.', 'kurs');
    legg('skilt', 'Skiltene er etter N300/N301: middels størrelse (MS), midlertidige fareskilt med gul bunn, plassert som i den godkjente planen.', 'n301');
    legg('fjern', 'Skilt fjernes eller tildekkes når de ikke gjelder (f.eks. når det ikke lastes), og tas ned når siste lass er hentet.', 'n301');
    legg('dirigering', 'Manuell trafikkdirigering brukes bare når den er vurdert som nødvendig og godkjent i planen.', 'soknad');
  }
  if (har('velteplass')) {
    legg('avstand3', 'Tømmeret ligger minst 3 m fra vegkanten (mindre bare med vegeiers tillatelse på lite trafikkerte veger), og ikke på vegens grunn uten tillatelse.', 'tommer');
    legg('skjaering', 'Tømmeret ligger ikke i vegskjæring eller på fylling, og kan ikke rulle, falle eller skli ut i vegen eller grøfta.', 'tommer');
    legg('sikt', 'Tømmeret reduserer ikke sikten i kryss eller langs vegen, og annen trafikk kan passere en tømmerbil som laster.', 'tommer');
    legg('bunnflo', 'Bunnfloa ligger høyst 1 m over eller under kjørebanen, og standplassen for tømmerbilen har høyst 10 % helning.', 'tommer');
    legg('avkjorsel', 'Avkjørsel til velteplassen er godkjent (avkjørselstillatelse) dersom ny avkjørsel må lages.', 'soknad');
  }
  if (har('velteplass') || har('velteplass-privat')) legg('ledning', 'Tømmeret ligger ikke under strømførende ledninger eller telefonledninger.', 'tommer');
  if (har('kryssing')) legg('kryssing', 'Kryssingen er varslet med 156 «Annen fare» og underskilt «Kryssende tømmertransport» i begge retninger. Vegbanen holdes ren, og skader på veg og grøft utbedres.', 'tommer');
  if (har('hogst-ved-veg')) legg('felling', 'Trær innen én trelengde fra vegen felles bort fra vegen, og trafikken stanses mens det felles trær som kan nå vegen (godkjent i planen).', 'n301');
  if (har('sti')) {
    legg('sti-skilt', `Varselskilt der stier og løyper går inn i fareområdet (hogstflatene + ${SONE} m sikkerhetssone rundt maskinene).`, 'pefc');
    legg('sti-rydd', 'Stier og skiløyper ryddes så snart det er praktisk mulig mens hogsten pågår, og hogstavfall fjernes fra dem.', 'pefc');
  }
  legg('kraft', 'Er det kraftledning i eller nær hogstfeltet eller transportvegen? Varsle nettselskapet før arbeidet starter.', 'kraft');
  legg('nabo', 'Naboer og brukere av området (hytteeiere, skoler, lag) er informert om tidspunkt for drift og tømmertransport.', 'pefc');
  return k;
}

// Kort tekst for skiltene i en liste.
export const skiltTekst = (s) => s.skilt.map((n) => (n === '362' ? `362 Fartsgrense ${s.fart}` : n === '808' ? `808 «${s.tekst}»` : n === 'info' ? `Infoskilt «${s.tekst}»` : `${n} ${SKILT[n]?.navn || ''}`)).join(' + ');

// Små SVG-tegninger av skiltene (kart og utskrift).
export function skiltSvg(s, str = 34) {
  const ett = (n) => {
    if (n === '110' || n === '156') return `<svg viewBox="0 0 40 36" width="${str}" height="${str * 0.9}"><path d="M20 2 38 34H2Z" fill="#ffd100" stroke="#d0021b" stroke-width="4" stroke-linejoin="round"/>${n === '156' ? '<text x="20" y="30" text-anchor="middle" font-family="Arial" font-weight="900" font-size="20" fill="#111">!</text>' : '<path d="M14 28h14M17 27l3-7 4 3M22 16a2 2 0 1 0 0.1 0M24 22l3 5" stroke="#111" stroke-width="2.2" fill="none" stroke-linecap="round"/>'}</svg>`;
    if (n === '362') return `<svg viewBox="0 0 40 40" width="${str}" height="${str}"><circle cx="20" cy="20" r="17" fill="#fff" stroke="#d0021b" stroke-width="5"/><text x="20" y="26" text-anchor="middle" font-family="Arial" font-weight="800" font-size="15" fill="#111">${s.fart || ''}</text></svg>`;
    if (n === '808') return `<svg viewBox="0 0 60 18" width="${str * 1.4}" height="${str * 0.42}"><rect x="1" y="1" width="58" height="16" rx="2" fill="#ffd100" stroke="#111" stroke-width="1.5"/><text x="30" y="12.5" text-anchor="middle" font-family="Arial" font-weight="700" font-size="${Math.min(9, 110 / Math.max(6, (s.tekst || '').length))}" fill="#111">${String(s.tekst || '').replace(/[<&]/g, '')}</text></svg>`;
    return `<svg viewBox="0 0 40 30" width="${str}" height="${str * 0.75}"><rect x="1" y="1" width="38" height="28" rx="3" fill="#fff" stroke="#e07b00" stroke-width="3"/><text x="20" y="21" text-anchor="middle" font-family="Arial" font-weight="900" font-size="16" fill="#e07b00">!</text></svg>`;
  };
  return `<span class="sp-skilt">${s.skilt.map(ett).join('')}</span>`;
}

// Hjelpere for UI: konverter inndata fra lon/lat.
export const utmLinjer = (g) => linjerAv(g).map((l) => l.map(tilUtm));
export const utmPolygon = (g) => ({ type: g.type, coordinates: g.type === 'Polygon' ? g.coordinates.map((r) => r.map(tilUtm)) : g.coordinates.map((p) => p.map((r) => r.map(tilUtm))) });
export const utmPunkt = tilUtm;
