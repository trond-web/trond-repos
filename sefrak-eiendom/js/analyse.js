// Setter sammen data om en eiendom til en vurdering av vern, begrensninger og råd for vedlikehold og oppussing.
// Ren funksjon av dataene – ingen nettverkskall – slik at den kan testes i Node.
import { punktIPolygon, avstandM, avstandTilFlate, overlapper, indrePunkt, arealM2 } from './geo.js';
import {
  bygningstype, BYGNINGSSTATUS, SEFRAK_STATUS, VERNETYPE, vernetype, KULTURMINNEKATEGORI, HENSYNSSONE, KULTURHENSYN,
  arealformal, PLANTYPE, PLANSTATUS, fylkeFor,
} from './koder.js';

// Vernenivå – høyere tall betyr strengere.
export const NIVAA = {
  5: { kode: 'fredet', navn: 'Fredet', farge: 'fredet', kort: 'Fredet etter kulturminneloven. Alt utover vanlig vedlikehold krever tillatelse fra kulturminnemyndigheten.' },
  4: { kode: 'meldeplikt', navn: 'Eldre enn 1850', farge: 'rod', kort: 'SEFRAK-registrert som eldre enn 1850. Riving eller vesentlig endring skal forelegges fylkeskommunen før kommunen avgjør saken.' },
  3: { kode: 'regulert', navn: 'Regulert til bevaring', farge: 'oransje', kort: 'Omfattet av bevaring i arealplan. Planbestemmelsene styrer hva du kan endre.' },
  2: { kode: 'listet', navn: 'Verneverdig', farge: 'gul', kort: 'Kommunalt eller statlig listeført, eller i et registrert kulturmiljø. Kommunen legger stor vekt på kulturminneverdiene.' },
  1: { kode: 'sefrak', navn: 'SEFRAK 1850–1900', farge: 'gul', kort: 'SEFRAK-registrert. Ikke formelt vernet, men kommunen skal ta vare på kulturhistoriske verdier ved tiltak (pbl. § 31-1).' },
  0: { kode: 'ingen', navn: 'Ingen registrert vern', farge: 'gronn', kort: 'Ingen registrert vernestatus i de nasjonale registrene. Vanlige regler etter plan- og bygningsloven gjelder.' },
};

const FREDET_TYPER = new Set(Object.entries(VERNETYPE).filter(([, v]) => v.fredet).map(([k]) => k));
const LISTET_TYPER = new Set(['KOM', 'STAT', 'LIST', 'FVERN']);

// Tidsangivelse «1800-1899» → { fra, til }
export function tidsrom(t) {
  const m = String(t || '').match(/(\d{3,4})\s*-\s*(\d{3,4})/);
  if (m) return { fra: +m[1], til: +m[2] };
  const e = String(t || '').match(/^(\d{4})$/);
  return e ? { fra: +e[1], til: +e[1] } : null;
}

// SEFRAK-status 0 kan også bety at registreringen mangler status. Revet tolkes bare når bygningen heller ikke finnes i matrikkelen.
// finnes = bygningen finnes fortsatt i matrikkelen; da vurderes en «revet»-registrering ut fra dateringen.
export function sefrakNivaa(s, finnes = false) {
  if (!s) return 0;
  if (s.fredning || s.vernevedtak) return 5;
  if (s.sefrakStatus === 2) return 4;
  if (s.sefrakStatus === 0 && !finnes) return 0;
  const t = tidsrom(s.tidsangivelse);
  if (t && t.til < 1850) return 4;
  return 1;
}

// ---------- Plandata ----------

const SONEFELT = ['angittHensyn', 'båndlegging', 'støy', 'fare', 'faresone', 'sikring', 'infrastruktur', 'gjennomføring', 'detaljering', 'raSkred', 'flom'];

export function tolkPlanobjekt(o) {
  const type = o.objekttypenavn || '';
  if (/Område$/.test(type) && o.plannavn) {
    return {
      art: 'plan', type, navn: o.plannavn, id: o['arealplanId.planidentifikasjon'], kommunenr: o['arealplanId.kommunenummer'],
      plantype: PLANTYPE[o.plantype] || (type.startsWith('Kp') ? 'Kommuneplan' : 'Reguleringsplan'), status: PLANSTATUS[o.planstatus] || null,
      vedtatt: (o.ikrafttredelsesdato || o.vedtakEndeligPlanDato || '').slice(0, 10) || null, link: o.link || null,
      kommuneplan: /^K(d)?p/.test(type), punkter: o.punkter,
    };
  }
  const sonekode = SONEFELT.map((f) => o[f]).find((v) => v != null && v !== '');
  if (/Sone$/.test(type) || sonekode) {
    const kode = parseInt(sonekode, 10);
    return {
      art: 'sone', type, kode, navn: HENSYNSSONE[kode] || o.beskrivelse || type.replace(/^(Rp|Kp|Kdp|Rb)/, ''), sonenavn: o.hensynSonenavn || null,
      beskrivelse: o.beskrivelse || null, planId: o['arealplanId.planidentifikasjon'], kultur: KULTURHENSYN.has(kode), punkter: o.punkter,
    };
  }
  if (/Bevaring/i.test(type) || (o.reguleringsformål >= 660 && o.reguleringsformål <= 669)) {
    return { art: 'sone', type, kode: 570, navn: 'Spesialområde bevaring (eldre reguleringsplan)', kultur: true, planId: o['arealplanId.planidentifikasjon'], punkter: o.punkter };
  }
  if (o['arealformål'] != null || o['reguleringsformål'] != null) {
    return {
      art: 'formal', type, kode: o['arealformål'] ?? o['reguleringsformål'], navn: o['arealformål'] != null ? arealformal(o['arealformål']) : `Reguleringsformål ${o['reguleringsformål']}`,
      utdyping: o.beskrivelse || o['reguleringsformålsutdyping'] || null, felt: (o.feltbetegnelse || '').trim() || null,
      lnf: /^5/.test(String(o['arealformål'] ?? '')), planId: o['arealplanId.planidentifikasjon'], punkter: o.punkter,
    };
  }
  if (/Bestemmelse/i.test(type)) return { art: 'bestemmelse', type, navn: o.beskrivelse || o.bestemmelseOmrådeNavn || 'Bestemmelsesområde', planId: o['arealplanId.planidentifikasjon'], punkter: o.punkter };
  return null;
}

const sammePunkt = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;

// ---------- Hovedanalyse ----------

export function analyser({ eiendom, bygninger = [], sefrak = [], freda = [], kulturminner = {}, kulturmiljoer = [], planer = null }) {
  const grense = eiendom.geometri;
  const inne = (pt) => punktIPolygon(pt, grense);
  const naer = (pt, m) => !inne(pt) && avstandTilFlate(pt, grense) <= m;

  const bygPaa = bygninger.filter((b) => inne(b.geometri.coordinates));
  const bygNaer = bygninger.filter((b) => naer(b.geometri.coordinates, 15));
  const sefrakPaa = sefrak.filter((s) => s.geometri && inne(s.geometri.coordinates));
  const sefrakNaer = sefrak.filter((s) => s.geometri && naer(s.geometri.coordinates, 25));

  const enkeltminner = (kulturminner.Enkeltminne || []).filter((k) => overlapper(k.geometri, grense));
  const lokaliteter = (kulturminner.Lokalitet || []).filter((k) => overlapper(k.geometri, grense));
  const sikringssoner = (kulturminner.Sikringssone || []).filter((k) => overlapper(k.geometri, grense));
  const miljoer = kulturmiljoer.filter((k) => k.geometri && overlapper(k.geometri, grense));
  const fredaPaa = freda.filter((f) => f.geometri && (overlapper(f.geometri, grense) || (f.geometri.type === 'Point' && avstandTilFlate(f.geometri.coordinates, grense) <= 10)));

  const planobjekter = (planer?.objekter || []).map(tolkPlanobjekt).filter(Boolean);

  const sefrakBrukt = new Set();
  const byggListe = [];

  const lagBygg = (b, s, paaEiendom) => {
    const pt = (b?.geometri || s?.geometri).coordinates;
    const nr = b?.bygningsnummer || (s?.bygningsnummer != null ? String(s.bygningsnummer) : null);
    const grunner = [];
    let nivaa = 0;
    const hev = (n, tekst, kilde) => { grunner.push({ nivaa: n, tekst, kilde }); if (n > nivaa) nivaa = n; };

    const fr = fredaPaa.find((f) => (nr && String(f.bygningsnummer) === nr) || (s?.sefrakId && f.sefrakId === s.sefrakId)
      || (f.geometri.type === 'Point' && avstandM(f.geometri.coordinates, pt) < 8));
    if (fr) hev(5, `Fredet bygning: ${fr.navn || 'uten navn'} – ${vernetype(fr.vernetype)}${fr.verneparagraf ? ` (kml. § ${fr.verneparagraf})` : ''}`, 'Riksantikvaren – freda bygninger');

    const em = enkeltminner.filter((k) => (k.geometri.type === 'Point' ? avstandM(k.geometri.coordinates, pt) < 10 : punktIPolygon(pt, k.geometri) || avstandTilFlate(pt, k.geometri) < 3));
    for (const k of em) {
      // Bygningskulturminner beskriver selve bygningen; andre flater (hage, områdefredning, gravfelt) er områder bygningen ligger i.
      const omr = k.kategori !== 'E-BYG' && k.geometri.type !== 'Point';
      const hva = omr ? `Ligger innenfor ${(KULTURMINNEKATEGORI[k.kategori] || 'kulturminne').toLowerCase()} «${k.navn || k.id}», som er` : `Kulturminne «${k.navn || k.id}» er`;
      if (FREDET_TYPER.has(k.vernetype)) hev(5, `${hva} ${vernetype(k.vernetype).toLowerCase()}`, 'Askeladden');
      else if (k.vernetype === 'PBL') hev(3, `${hva} regulert til bevaring`, 'Askeladden');
      else if (LISTET_TYPER.has(k.vernetype)) hev(2, `${hva} ${vernetype(k.vernetype).toLowerCase()}`, 'Askeladden');
      else if (k.vernetype && !['FJE', 'OPP', 'OPPV', 'IKKEV', 'IKKE'].includes(k.vernetype)) hev(1, `${hva} registrert (${vernetype(k.vernetype).toLowerCase()})`, 'Askeladden');
    }

    if (s) {
      const sn = sefrakNivaa(s, !!b);
      const st = SEFRAK_STATUS[s.sefrakStatus];
      if (b && s.sefrakStatus === 0) grunner.push({ nivaa: 0, tekst: 'SEFRAK oppgir at bygningen er revet eller borte, men den finnes i matrikkelen. Et av registrene kan være utdatert – vurderingen bygger derfor på dateringen.', kilde: 'SEFRAK' });
      if (sn === 5) hev(5, `SEFRAK-registreringen har fredningsvedtak (${s.fredning || s.vernevedtak})`, 'SEFRAK');
      else if (sn === 4) hev(4, `SEFRAK ${s.sefrakId}: datert ${s.tidsangivelse || 'før 1850'} – eldre enn 1850`, 'SEFRAK');
      else if (sn === 1) hev(1, `SEFRAK ${s.sefrakId}: datert ${s.tidsangivelse || '1850–1900'}`, 'SEFRAK');
      else grunner.push({ nivaa: 0, tekst: `SEFRAK ${s.sefrakId}: ${st ? st.kort.toLowerCase() : 'ukjent status'}${s.tidsangivelse ? `, datert ${s.tidsangivelse}` : ''}`, kilde: 'SEFRAK' });
      const t = tidsrom(s.tidsangivelse);
      if (t && t.til < 1537) hev(5, 'Datert til før 1537 – automatisk fredet (kml. § 4)', 'SEFRAK');
      else if (t && t.fra >= 1537 && t.til <= 1649) grunner.push({ nivaa: 4, tekst: 'Datert 1537–1649: kan være erklært automatisk fredet (kml. § 4 andre ledd). Sjekk med fylkeskommunen.', kilde: 'SEFRAK' });
    } else if (b?.harSefrak) {
      hev(1, 'Matrikkelen merker bygningen som SEFRAK-registrert, men registreringen ble ikke funnet i Riksantikvarens data', 'Matrikkelen');
    }
    if (b?.harKulturminne && !em.length && !fr) hev(2, 'Matrikkelen merker bygningen som kulturminne – sjekk vernestatus i Kulturminnesøk/Askeladden', 'Matrikkelen');

    const soner = planobjekter.filter((p) => p.art === 'sone' && p.kultur && p.punkter?.some((q) => sammePunkt(q, pt)));
    for (const z of soner) {
      if (z.kode === 730 || z.kode === 750) hev(5, `${z.navn}${z.sonenavn ? ` (${z.sonenavn})` : ''} i plan ${z.planId}`, 'Arealplan');
      else hev(3, `${z.navn}${z.sonenavn ? ` (${z.sonenavn})` : ''} i plan ${z.planId}`, 'Arealplan');
    }
    for (const m of miljoer) if (punktIPolygon(pt, m.geometri)) hev(2, `Ligger i kulturmiljøet «${m.navn}» (${KULTURMINNEKATEGORI[m.kulturmiljokategori] || m.kulturmiljokategori || 'kulturmiljø'})`, 'Riksantikvaren – kulturmiljøer');

    const revet = !b && s && s.sefrakStatus === 0;
    return {
      bygningsnummer: nr, punkt: pt, paaEiendom,
      type: b ? bygningstype(b.bygningstype) : (s?.objektnavn ? tittelFraSefrak(s.objektnavn) : 'Ukjent'),
      typekode: b?.bygningstype || null,
      status: b ? (BYGNINGSSTATUS[b.bygningsstatus] || b.bygningsstatus) : (revet ? 'Ikke i matrikkelen (trolig revet)' : 'Ikke funnet i matrikkelen'),
      iMatrikkelen: !!b, revet, sefrak: s || null, freda: fr || null, kulturminner: em, nivaa: revet ? 0 : nivaa, grunner,
      navn: s?.objektnavn ? tittelFraSefrak(s.objektnavn) : (fr?.navn || null),
    };
  };

  for (const b of [...bygPaa, ...bygNaer]) {
    const s = sefrak.find((x) => x.bygningsnummer != null && String(x.bygningsnummer) === b.bygningsnummer);
    if (s) sefrakBrukt.add(s.sefrakId);
    const paa = bygPaa.includes(b);
    // Bygninger utenfor grensen tas bare med når de har SEFRAK/kulturminne (grensen kan være unøyaktig).
    if (!paa && !s && !b.harSefrak && !b.harKulturminne) continue;
    byggListe.push(lagBygg(b, s, paa));
  }
  for (const s of [...sefrakPaa, ...sefrakNaer]) {
    if (sefrakBrukt.has(s.sefrakId)) continue;
    sefrakBrukt.add(s.sefrakId);
    const delt = s.bygningsnummer != null ? bygninger.find((b) => b.bygningsnummer === String(s.bygningsnummer)) : null;
    const bygg = lagBygg(delt ? { ...delt, bygningstype: null } : null, s, sefrakPaa.includes(s));
    if (delt) {
      bygg.type = bygg.navn || 'SEFRAK-registrering';
      bygg.status = `Deler bygningsnummer ${delt.bygningsnummer} med en annen SEFRAK-registrering`;
      bygg.punkt = s.geometri.coordinates;
    }
    byggListe.push(bygg);
  }
  byggListe.sort((a, b) => (b.paaEiendom - a.paaEiendom) || (b.nivaa - a.nivaa) || (b.iMatrikkelen - a.iMatrikkelen) || String(a.bygningsnummer).localeCompare(String(b.bygningsnummer)));

  const paa = byggListe.filter((b) => b.paaEiendom);
  const hoyeste = Math.max(0, ...paa.filter((b) => !b.revet).map((b) => b.nivaa));

  const planListe = dedupe(planobjekter.filter((p) => p.art === 'plan'), (p) => `${p.kommunenr}|${p.id}`);
  const soneListe = dedupe(planobjekter.filter((p) => p.art === 'sone'), (p) => `${p.planId}|${p.kode}|${p.sonenavn}`);
  const formalListe = dedupe(planobjekter.filter((p) => p.art === 'formal'), (p) => `${p.planId}|${p.kode}|${p.felt}`);
  const bestemmelser = dedupe(planobjekter.filter((p) => p.art === 'bestemmelse'), (p) => `${p.planId}|${p.navn}`);

  const landbruk = paa.some((b) => [113, 123, 124, 163, 241, 249].includes(parseInt(b.typekode, 10)))
    || formalListe.some((f) => f.lnf) || paa.some((b) => /gard|landbruk/i.test(b.sefrak?.fysiskMiljø || ''));

  const fylke = fylkeFor(eiendom.kommune.nr);
  const res = {
    eiendom: { ...eiendom, arealM2: arealM2(grense), senter: indrePunkt(grense) },
    bygninger: byggListe,
    paaEiendom: paa,
    hoyesteNivaa: hoyeste,
    kulturminner: { enkeltminner, lokaliteter, sikringssoner, fredaBygninger: fredaPaa },
    kulturmiljoer: miljoer,
    planer: { planer: planListe, soner: soneListe, formal: formalListe, bestemmelser, feil: planer?.feil || [], hentet: !!planer },
    landbruk, fylke,
    teller: {
      sefrak: paa.filter((b) => b.sefrak).length,
      sefrakFor1850: paa.filter((b) => b.sefrak && !b.revet && sefrakNivaa(b.sefrak, b.iMatrikkelen) >= 4).length,
      fredet: paa.filter((b) => b.nivaa === 5).length,
      bygninger: paa.filter((b) => b.iMatrikkelen).length,
    },
  };
  res.begrensninger = lagBegrensninger(res);
  res.tilskudd = lagTilskudd(res);
  res.kontakter = lagKontakter(res);
  res.sjekkliste = lagSjekkliste(res);
  return res;
}

function dedupe(liste, nokkel) {
  const m = new Map();
  for (const x of liste) if (!m.has(nokkel(x))) m.set(nokkel(x), x);
  return [...m.values()];
}

// «STABBUR, GRANBERG, GRASMOVEIEN, MOREPPEN» → «Stabbur, Granberg»
export function tittelFraSefrak(navn) {
  const deler = String(navn).split(',').map((d) => d.trim()).filter(Boolean);
  const t = (s) => s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
  return deler.length ? [deler[0].charAt(0) + deler[0].slice(1).toLowerCase(), ...deler.slice(1, 2).map(t)].join(', ') : navn;
}

// ---------- Begrensninger ----------

const LOV = {
  kml: 'https://lovdata.no/lov/1978-06-09-50',
  pbl: 'https://lovdata.no/lov/2008-06-27-71',
  sak10: 'https://lovdata.no/forskrift/2010-03-26-488',
  tek17: 'https://lovdata.no/forskrift/2017-06-19-840',
  eskl: 'https://lovdata.no/lov/1975-06-06-29',
};

export function lagBegrensninger(r) {
  const ut = [];
  const navn = (liste) => liste.map((b) => b.navn || `${b.type}${b.bygningsnummer ? ` (${b.bygningsnummer})` : ''}`);
  const paa = r.paaEiendom.filter((b) => !b.revet);
  const fredet = paa.filter((b) => b.nivaa === 5);
  const for1850 = paa.filter((b) => b.sefrak && sefrakNivaa(b.sefrak, b.iMatrikkelen) === 4);
  const regulert = paa.filter((b) => b.grunner.some((g) => g.nivaa === 3));
  const listet = paa.filter((b) => b.grunner.some((g) => g.nivaa === 2));
  const sefrak1850 = paa.filter((b) => b.sefrak && sefrakNivaa(b.sefrak, b.iMatrikkelen) === 1);

  if (fredet.length) {
    ut.push({
      nivaa: 'streng', tittel: 'Fredet bygning – tillatelse kreves for alt utover vanlig vedlikehold', gjelder: navn(fredet),
      tekst: 'Fredete bygninger kan ikke endres, skades eller rives uten tillatelse fra kulturminnemyndigheten. Det gjelder også innvendige endringer når fredningen omfatter interiør, og som regel utskifting av vinduer, kledning, taktekking og overflater. Vanlig vedlikehold med samme materialer og metoder er tillatt og forventet. Fylkeskommunen (i Oslo Byantikvaren) behandler søknader om dispensasjon. Eier kan få tilskudd til merkostnader ved antikvarisk istandsetting.',
      hjemmel: [['Kulturminneloven §§ 3, 8, 15, 15 a og 17', LOV.kml]],
    });
  }
  if (for1850.length) {
    ut.push({
      nivaa: 'krav', tittel: 'Bygning eldre enn 1850 – fylkeskommunen skal uttale seg før riving eller vesentlig endring', gjelder: navn(for1850),
      tekst: 'Søknad om riving eller vesentlig endring av et ikke-fredet byggverk fra før 1850 skal sendes til fylkeskommunen minst fire uker før kommunen fatter vedtak. Fylkeskommunen vurderer om bygningen bør fredes. «Vesentlig endring» omfatter typisk tilbygg, endret takform, nye vindusformer, ny kledning med annet uttrykk og større innvendige ombygginger i bærende konstruksjon. Vanlig vedlikehold er ikke omfattet.',
      hjemmel: [['Kulturminneloven § 25 andre ledd', LOV.kml]],
    });
  }
  const kulturSoner = r.planer.soner.filter((z) => z.kultur);
  if (kulturSoner.length || regulert.length) {
    ut.push({
      nivaa: 'krav', tittel: 'Bevaring i arealplan – planbestemmelsene gjelder', gjelder: regulert.length ? navn(regulert) : ['Eiendommen'],
      tekst: `Eiendommen ligger helt eller delvis i ${kulturSoner.map((z) => `${z.navn.toLowerCase()}${z.sonenavn ? ` (${z.sonenavn})` : ''}`).join(', ') || 'et område regulert til bevaring'}. Bestemmelsene kan blant annet kreve at fasader, takform, vinduer, materialer og farger beholdes eller tilbakeføres, og kan forby riving. Endringer som ellers er unntatt søknadsplikt, kan bli søknadspliktige eller ikke tillatt. Les planbestemmelsene via lenken til planen.`,
      hjemmel: [['Plan- og bygningsloven §§ 11-8 c, 11-9 nr. 7, 12-6 og 12-7 nr. 6', LOV.pbl]],
    });
  }
  if (listet.length) {
    ut.push({
      nivaa: 'merk', tittel: 'Verneverdig bygning eller kulturmiljø', gjelder: navn(listet),
      tekst: 'Bygningen er listeført eller ligger i et registrert kulturmiljø. Listeføring gir ikke formelt vern i seg selv, men kommunen skal vektlegge kulturminneverdiene ved byggesak, og fylkeskommunen kan uttale seg. Forhåndskonferanse med kommunen anbefales før større tiltak.',
      hjemmel: [['Plan- og bygningsloven § 31-1', LOV.pbl]],
    });
  }
  if (sefrak1850.length) {
    ut.push({
      nivaa: 'merk', tittel: 'SEFRAK-registrert bygning fra 1850–1900', gjelder: navn(sefrak1850),
      tekst: 'SEFRAK-registrering er ikke vern, men viser at bygningen kan ha kulturhistorisk verdi. Ved tiltak på eksisterende byggverk skal kommunen så langt mulig sørge for at historiske, arkitektoniske og kulturelle verdier i bygningens ytre blir bevart. Kommunen kan derfor stille krav til utforming og materialer, og noen kommuner har egne kulturminneplaner som verner SEFRAK-bygninger.',
      hjemmel: [['Plan- og bygningsloven § 31-1', LOV.pbl]],
    });
  }
  const { enkeltminner, lokaliteter, sikringssoner } = r.kulturminner;
  const autArk = [...lokaliteter, ...enkeltminner].filter((k) => k.vernetype === 'AUT' && /ARK/.test(k.kategori || ''));
  if (autArk.length || sikringssoner.length) {
    ut.push({
      nivaa: 'streng', tittel: 'Automatisk fredet kulturminne i grunnen eller sikringssone', gjelder: [...new Set(autArk.map((k) => k.navn || k.id))].slice(0, 6),
      tekst: 'Det er registrert automatisk fredete kulturminner (f.eks. gravminner, bosetningsspor) eller en sikringssone på eiendommen. Graving, drenering, nye ledninger, terrengendringer og tilbygg innenfor kulturminnet eller sikringssonen (normalt 5 meter rundt) krever tillatelse fra fylkeskommunen. Avklar før du graver.',
      hjemmel: [['Kulturminneloven §§ 3, 6 og 8', LOV.kml]],
    });
  }
  if (r.kulturmiljoer.length && !listet.length) {
    ut.push({
      nivaa: 'merk', tittel: `Eiendommen berører kulturmiljøet «${r.kulturmiljoer.map((m) => m.navn).join('», «')}»`, gjelder: ['Eiendommen'],
      tekst: 'Kulturmiljøer av nasjonal interesse (NB!-registeret) og fredete kulturmiljøer gir føringer for hvordan nye tiltak skal tilpasses omgivelsene. Fredete kulturmiljøer har egne forskrifter.',
      hjemmel: [['Kulturminneloven § 20', LOV.kml], ['Plan- og bygningsloven § 31-1', LOV.pbl]],
    });
  }
  for (const z of r.planer.soner.filter((s) => !s.kultur && [310, 320, 330, 350, 370, 380, 110, 210].includes(s.kode))) {
    ut.push({
      nivaa: 'info', tittel: `${z.navn}${z.sonenavn ? ` (${z.sonenavn})` : ''}`, gjelder: ['Eiendommen'],
      tekst: z.kode === 210 ? 'Rød støysone kan gi krav om støytiltak ved bruksendring, nye boenheter og større ombygginger.'
        : z.kode === 110 ? 'Hensynssone for drikkevann kan begrense avløp, lagring og graving.'
          : 'Faresoner kan kreve dokumentasjon av sikkerhet før tiltak (TEK17 kap. 7).',
      hjemmel: [['Plan- og bygningsloven § 11-8 / § 12-6', LOV.pbl]],
    });
  }
  const lnf = r.planer.formal.find((f) => f.lnf);
  if (lnf) {
    ut.push({
      nivaa: 'info', tittel: `Arealformål: ${lnf.navn}`, gjelder: ['Eiendommen'],
      tekst: 'I LNFR-områder er tiltak som ikke gjelder landbruk normalt ikke tillatt uten dispensasjon. Det gjelder blant annet nye boenheter, tilbygg til fritidsbolig utover planens rammer og bruksendring av driftsbygning. Vedlikehold og istandsetting av eksisterende bygninger er tillatt.',
      hjemmel: [['Plan- og bygningsloven §§ 11-7 nr. 5 og 19-2', LOV.pbl]],
    });
  }
  ut.push({
    nivaa: 'info', tittel: 'Gjelder alle bygninger: søknadsplikt etter plan- og bygningsloven', gjelder: ['Alle bygninger'],
    tekst: 'Vanlig vedlikehold og reparasjon er ikke søknadspliktig. Fasadeendring er søknadspliktig, med unntak for mindre fasadeendringer som ikke endrer bygningens karakter. Det samme gjelder tilbygg, bruksendring, riving, vesentlig endring av bærende konstruksjon og nye/endrede ildsteder og piper (meldes kommunen/brannvesenet). På verneverdige bygninger og i bevaringsområder vurderer kommunen ofte at selv små endringer endrer karakteren. Avklar med kommunen først. Rehabilitering over 100 m² BRA krever kartlegging av farlig avfall (asbest, PCB, bly i maling).',
    hjemmel: [['Plan- og bygningsloven §§ 20-1, 20-5 og 31-2', LOV.pbl], ['SAK10 § 4-1', LOV.sak10], ['TEK17 §§ 9-6 og 9-7', LOV.tek17]],
  });
  return ut;
}

// ---------- Tiltaksveileder ----------

export const TILTAK = [
  { id: 'maling', navn: 'Male utvendig', ikon: '🖌' },
  { id: 'vinduer', navn: 'Vinduer og dører', ikon: '🪟' },
  { id: 'kledning', navn: 'Kledning og fasade', ikon: '🪵' },
  { id: 'tak', navn: 'Tak og taktekking', ikon: '🏠' },
  { id: 'isolering', navn: 'Etterisolering og energi', ikon: '🌡' },
  { id: 'grunnmur', navn: 'Grunnmur, drenering og fukt', ikon: '🧱' },
  { id: 'pipe', navn: 'Pipe, ildsted og elektrisk', ikon: '🔥' },
  { id: 'innvendig', navn: 'Innvendig oppussing', ikon: '🛠' },
  { id: 'solceller', navn: 'Solceller, varmepumpe, ventiler', ikon: '☀' },
  { id: 'tilbygg', navn: 'Tilbygg, påbygg, ny takform', ikon: '📐' },
  { id: 'bruksendring', navn: 'Bruksendring', ikon: '🔁' },
  { id: 'riving', navn: 'Riving eller flytting', ikon: '⛏' },
];

// Status: fri = kan gjøres uten søknad, avklar = kontakt kommunen/fylkeskommunen først, soknad = søknadspliktig, tillatelse = krever dispensasjon/tillatelse etter kulturminneloven
export function veiledTiltak(id, nivaa, { lnf = false } = {}) {
  const T = (status, tekst, raad = []) => ({ status, tekst, raad });
  const fredet = nivaa === 5;
  const gml = nivaa === 4;
  const bev = nivaa === 3;
  const verneverdig = nivaa >= 1;
  const tillat = 'Krever tillatelse fra kulturminnemyndigheten (fylkeskommunen/Byantikvaren) før du starter.';
  switch (id) {
    case 'maling':
      if (fredet) return T('avklar', 'Vedlikeholdsmaling med samme type maling og farge som før regnes som vanlig vedlikehold. Ny farge eller ny malingstype skal avklares med fylkeskommunen.', ['Bruk linoljemaling på eldre treverk som tidligere har hatt linolje', 'Fargeundersøkelse kan vise historiske farger']);
      return T(bev ? 'avklar' : 'fri', bev ? 'Maling er vedlikehold, men fargevalg kan være regulert i bevaringsbestemmelsene. Sjekk planen.' : 'Maling er vanlig vedlikehold og ikke søknadspliktig.', [
        'Linoljemaling er tradisjonelt riktig på gammel kledning og vinduer, slipper fukt ut og er lett å vedlikeholde',
        'Ikke legg plast-/akrylmaling oppå gammel linoljemaling uten å avklare heft og fukt – det gir avflassing og råte',
        'Gammel maling kan inneholde bly: våtskrap, ikke varmluft over 400 °C eller tørrsliping, og samle opp avfallet',
        verneverdig ? 'Velg farger som passer bygningens alder; SEFRAK-tiden brukte jordfarger, oker, oksydrødt og hvitt på finere hus' : null,
      ].filter(Boolean));
    case 'vinduer':
      if (fredet) return T('tillatelse', `Utskifting av vinduer og dører på fredet bygning er ikke tillatt uten dispensasjon. ${tillat} Reparasjon av eksisterende vinduer er vedlikehold.`, ['Restaurer gamle vinduer – kitt, glass, beslag og linoljemaling', 'Innvendige forsatsvinduer gir nesten samme energieffekt som nye vinduer']);
      if (gml) return T('soknad', 'Nye vinduer med annen utforming er fasadeendring og søknadspliktig, og fylkeskommunen skal uttale seg (bygning før 1850). Like vinduer i samme materiale og inndeling er vedlikehold.', VINDUSRAAD);
      if (bev) return T('soknad', 'Bevaringsbestemmelser krever ofte at vinduer beholdes eller erstattes med kopier i tre med samme inndeling og profiler. Søk kommunen.', VINDUSRAAD);
      return T(verneverdig ? 'avklar' : 'fri', verneverdig ? 'Like vinduer er vedlikehold. Nye vinduer med annen inndeling, størrelse eller materiale endrer karakteren og er normalt søknadspliktige på eldre hus.' : 'Utskifting til tilsvarende vinduer er ikke søknadspliktig. Endret størrelse, plassering eller inndeling kan være søknadspliktig fasadeendring.', VINDUSRAAD);
    case 'kledning':
      if (fredet) return T('tillatelse', `Bytte av enkeltbord med samme dimensjon og profil er vedlikehold. Full utskifting eller ny kledningstype krever dispensasjon. ${tillat}`, KLEDNINGSRAAD);
      return T(gml || bev ? 'soknad' : verneverdig ? 'avklar' : 'fri', gml || bev
        ? 'Ny kledning med annet uttrykk (profil, retning, materiale) er fasadeendring og søknadspliktig. På bygninger eldre enn 1850 skal fylkeskommunen uttale seg. Utskifting av råtne bord med like bord er vedlikehold.'
        : 'Utskifting med samme type kledning er vedlikehold. Ny type kledning kan være søknadspliktig fasadeendring – avklar med kommunen på eldre hus.', KLEDNINGSRAAD);
    case 'tak':
      if (fredet) return T('tillatelse', `Omlegging med samme taktekking regnes som vedlikehold. Nytt taktekkingsmateriale, takvinduer, arker eller endret takform krever dispensasjon. ${tillat}`, TAKRAAD);
      return T(gml || bev ? 'soknad' : 'avklar', 'Omlegging med samme materiale er vedlikehold. Nytt tekkemateriale med annet uttrykk, takvinduer, arker og endret takform er søknadspliktig (takform er alltid søknadspliktig).' + (gml ? ' Fylkeskommunen skal uttale seg.' : ''), TAKRAAD);
    case 'isolering':
      return T(fredet ? 'tillatelse' : (gml || bev) ? 'avklar' : 'fri', fredet
        ? `Etterisolering som endrer konstruksjon, vegger eller overflater krever tillatelse. ${tillat}`
        : 'Innvendig etterisolering er ikke søknadspliktig, men utvendig etterisolering endrer fasaden (tykkere vegger, nye vindusomramminger) og er normalt søknadspliktig på eldre bygninger.', ISOLERINGSRAAD);
    case 'grunnmur':
      return T(fredet ? 'avklar' : 'fri', fredet
        ? 'Reparasjon av grunnmur og drenering er vedlikehold, men graving rundt fredete bygninger kan berøre automatisk fredete kulturminner i grunnen. Avklar med fylkeskommunen.'
        : 'Vedlikehold av grunnmur og drenering er ikke søknadspliktig. Ved graving nær registrerte kulturminner må fylkeskommunen kontaktes.', GRUNNMURRAAD);
    case 'pipe':
      return T(fredet ? 'avklar' : 'fri', 'Nytt ildsted skal meldes til kommunen/brannvesenet. Rehabilitering av pipe (foring) og ny pipe kan være søknadspliktig. Elektrisk arbeid skal alltid utføres av registrert elektroinstallatør.' + (fredet ? ' Endring av pipe eller ovner på fredet bygning krever tillatelse.' : ''), PIPERAAD);
    case 'innvendig':
      return T(fredet ? 'avklar' : 'fri', fredet
        ? 'Innvendige arbeider er tillatt når fredningen bare omfatter eksteriøret. Omfatter fredningen interiør, kreves tillatelse. Sjekk fredningsvedtaket.'
        : 'Innvendig oppussing er ikke søknadspliktig, så lenge du ikke endrer bærende konstruksjon, branncellevegger, rømningsveier eller lager ny boenhet.', INNVENDIGRAAD);
    case 'solceller':
      return T(fredet ? 'tillatelse' : (gml || bev) ? 'soknad' : 'avklar', fredet
        ? `Solceller, varmepumpe-utedel og nye ventiler på fasade/tak krever tillatelse. ${tillat}`
        : 'Solceller som følger takflaten er ofte unntatt søknadsplikt, men ikke i områder regulert til bevaring eller på verneverdige bygninger der kommunen vurderer at karakteren endres. Varmepumpe-utedel bør plasseres lite synlig.', ['Vurder solceller på driftsbygning, garasje eller bakkemontert i stedet for på hovedhuset', 'Plasser varmepumpe-utedel på bakken mot en lite synlig vegg', 'Avtrekksventiler bør gå gjennom tak eller pipeløp heller enn gjennom gamle fasader']);
    case 'tilbygg':
      return T(fredet ? 'tillatelse' : 'soknad', fredet
        ? `Tilbygg, påbygg og endret takform på fredet bygning tillates sjelden. ${tillat}`
        : `Tilbygg over 15 m² BYA (frittliggende over 50 m²), påbygg og endret takform er søknadspliktige.${gml ? ' Fylkeskommunen skal uttale seg (bygning før 1850).' : ''}${lnf ? ' I LNFR-område kreves normalt dispensasjon dersom tiltaket ikke er landbruk.' : ''}`, ['Underordne tilbygget det gamle huset i volum og høyde', 'Bruk en tydelig «mellombygning» eller sammenføyning som kan fjernes', 'Behold takform og møneretning på hovedvolumet', 'Unngå å fjerne verdifulle fasader – bygg mot en mindre verdifull side']);
    case 'bruksendring':
      return T('soknad', `Bruksendring (f.eks. stabbur/låve til bolig, fritidsbolig til helårsbolig) er søknadspliktig. Kommunen kan gi lempninger fra tekniske krav for eksisterende byggverk når det er forsvarlig (pbl. § 31-2 fjerde ledd).${lnf ? ' I LNFR-område krever bruksendring til annet enn landbruk normalt dispensasjon.' : ''}${fredet ? ' På fredet bygning kreves i tillegg tillatelse fra kulturminnemyndigheten.' : ''}`, ['Ny bruk som krever minst mulig ombygging tar best vare på bygningen', 'Brannsikring og rømning er ofte de største kostnadene – planlegg tidlig']);
    case 'riving':
      if (fredet) return T('tillatelse', 'Riving av fredet bygning er forbudt uten tillatelse, som gis svært sjelden.', []);
      return T('soknad', `Riving er søknadspliktig.${gml ? ' Bygning eldre enn 1850: kommunen må sende saken til fylkeskommunen minst fire uker før vedtak, og fylkeskommunen kan fremme fredning.' : ''}${bev ? ' Bevaringsbestemmelser forbyr ofte riving.' : ''} Flytting av gamle hus regnes som riving og gjenoppføring.`, ['Sjekk om bygningen kan selges eller gis bort for flytting', 'Dokumenter bygningen med foto og oppmåling før eventuell riving']);
    default: return T('avklar', 'Ukjent tiltak.');
  }
}

const VINDUSRAAD = [
  'Gamle vinduer kan nesten alltid repareres: skift råtne deler, kitt på nytt og mal med linoljemaling',
  'Innvendige forsatsvinduer eller koblede vinduer gir god energieffekt uten å endre fasaden',
  'Kopier av originale vinduer bør ha samme inndeling, sprosser, karmdimensjon og profiler',
  'Bevar gammelt glass – det håndblåste/trukne glasset er en del av uttrykket',
];
const KLEDNINGSRAAD = [
  'Skift bare de bordene som er råtne – gammelt kjerneved er ofte bedre enn nytt virke',
  'Bruk samme profil, bredde og retning; høvlerier kan lage kopier av gamle profiler',
  'Sørg for god avstand til terreng (minst 30 cm) og fungerende takrenner – det er den viktigste råtebeskyttelsen',
  'Fjern ikke gammel kledning for å etterisolere utenpå uten å vurdere uttrykket og fukttekniske følger',
];
const TAKRAAD = [
  'Tak er det viktigste vedlikeholdspunktet: hold tekking, beslag, renner og nedløp tette',
  'Gjenbruk teglstein og skifer der det er mulig, og suppler med brukte stein fra samme type',
  'Behold takutstikk, vindskier og gesimser med opprinnelige dimensjoner',
  'Sjekk loft for lekkasjer og fuktskader etter kraftig nedbør og snøsmelting',
];
const ISOLERINGSRAAD = [
  'Start med tetting av luftlekkasjer rundt vinduer, dører og loftsluke – billig og effektivt',
  'Etterisoler loft/tak og golv mot kald kjeller/kryperom før veggene',
  'Unngå plastfolie og diffusjonstette sjikt i tømmervegger – tømmer må kunne tørke ut',
  'Bruk diffusjonsåpne isolasjonsmaterialer (trefiber, cellulose) i gamle trehus',
  'Enova kan gi støtte til energitiltak; sjekk gjeldende ordninger',
];
const GRUNNMURRAAD = [
  'Gråsteinsmur og naturstein skal fuges med kalkmørtel, ikke sementmørtel – sement låser fukt og sprenger steinen',
  'Lede vann bort fra huset: terrengfall fra veggen, takrenner med nedløp til overvann',
  'Hold kryperom og åpne stabbursfundamenter luftige – ikke tett igjen ventilasjon',
  'Svill og nederste stokker er utsatt for råte; skift med kjerneved etter tradisjonelle metoder',
];
const PIPERAAD = [
  'Få piper og ildsteder kontrollert av feiervesenet før du tar dem i bruk etter lang tid',
  'Gamle piper kan repareres med foring uten å endre utseendet over tak',
  'El-anlegg i gamle hus bør kontrolleres – varmgang i gamle koblinger er en vanlig brannårsak',
  'Monter røykvarslere og slokkeutstyr; vurder automatisk brannvarsling i fredete hus',
];
const INNVENDIGRAAD = [
  'Ta vare på gamle dører, listverk, gulvbord, trapper og ovner – de er vanskelige å erstatte',
  'Bruk diffusjonsåpne overflater (kalk, limfarge, linoljemaling) på gamle vegger',
  'Sjekk for asbest i gamle plater, gulvbelegg og rørisolasjon før riving innvendig',
  'Bad og våtrom i gamle trehus krever god ventilasjon og riktig membran for å unngå råte',
];

// ---------- Vedlikeholdsråd for én bygning, ut fra SEFRAK-beskrivelsen ----------

export function raadForBygning(b) {
  const s = b.sefrak || {};
  const ut = [];
  const har = (felt, re) => re.test(String(s[felt] || ''));
  if (har('yttervegg', /laft/i)) ut.push(['Laftet tømmer', 'Hold laftehodene tørre med vindskier og takutstikk. Råteskadde stokker kan skiftes enkeltvis («utskifting av stokk»). Ikke tett tømmeret med diffusjonstette materialer, og unngå å fuge med silikon/fugeskum – bruk tradisjonell drev (lin/mose).']);
  if (har('yttervegg', /bindingsverk|reisverk|trekonstruksjon/i)) ut.push(['Bindingsverk/reisverk', 'Bindingsverk er følsomt for fukt i svill og nedre del av stolper. Sjekk svillen jevnlig, og hold avstand mellom kledning og terreng. Gammelt sagflis- eller mosefyll i veggene kan være intakt – ikke fjern det uten grunn.']);
  if (har('yttervegg', /mur|stein|tegl/i)) ut.push(['Murvegger', 'Bruk kalkmørtel og kalkpuss på gamle murer. Sementbaserte produkter og tette malinger hindrer uttørking og gir frostskader.']);
  if (har('fasade', /puss/i)) ut.push(['Pusset fasade', 'Reparer puss med kalkbasert mørtel tilpasset den gamle. Mal med kalkmaling eller silikatmaling – ikke plastmaling.']);
  if (har('fasade', /eternit|asbest/i)) ut.push(['Asbestsementplater', 'Plater av asbestsement (eternit) skal ikke slipes, bores eller brytes. Riving skal gjøres av godkjent firma, og avfallet leveres som farlig avfall.']);
  if (har('fasade', /ingen kledning/i)) ut.push(['Uten kledning', 'Utvendig ukledd tømmer bør forbli ukledd. Behandle eventuelt med tjære eller linolje etter tradisjon i distriktet.']);
  if (har('fasade', /torv|jord|mose/i)) ut.push(['Torv-/jordkledning', 'Torv- og jordkledde konstruksjoner krever spesialkompetanse. Kontakt fylkeskommunen eller et bygningsvernsenter.']);
  if (har('underbyggingsKonstr', /stabbe|trepele/i)) ut.push(['Står på stabber', 'Stabber og bjelker under stabbur/bu er utsatt for råte og setninger. Hold åpent under bygningen og skift stabber med samme utførelse. Ikke støp igjen.']);
  if (har('underbyggingsKonstr', /tørrmur|naturstein/i)) ut.push(['Natursteinsmur', 'Tørrmur rettes opp ved å legge steinene om. Fuget naturstein repareres med kalkmørtel. Sørg for drenering slik at frost ikke presser muren ut.']);
  if (har('kjeller', /jordgulv|direkte på grunnen|mindre enn ca\. 50 cm/i)) ut.push(['Lavt golv/jordgolv', 'Golv nær bakken gir høy fukt i bjelkelag og svill. Sørg for lufting og drenering, og vurder fuktmåling før nye golv legges.']);
  if (har('takform', /valm|mansard|pyramid|hvelv|kuppel/i)) ut.push(['Særpreget takform', `${s.takform} er karakteristisk for bygningen og bør beholdes ved omlegging.`]);
  if (s.antallSkorsteiner) ut.push(['Skorsteiner', `Bygningen er registrert med ${s.antallSkorsteiner} skorstein${s.antallSkorsteiner > 1 ? 'er' : ''}. Behold pipene over tak selv om de ikke er i bruk; de er del av uttrykket. Få dem kontrollert før bruk.`]);
  if (/stabbur|bu$|loft/i.test(b.navn || '')) ut.push(['Stabbur/loft', 'Stabbur er blant de mest verneverdige bygningstypene på gårdstunet. Behold svalgang, dører, beslag og låser, og hold taket tett.']);
  if (/låve|driftsbygning|fjøs/i.test(b.navn || '') || [241, 249].includes(parseInt(b.typekode, 10))) ut.push(['Driftsbygning', 'Store tak og lange vegger gjør driftsbygninger sårbare. Prioriter tett tak, takrenner og drenering. SMIL-midler kan gi tilskudd til istandsetting av verneverdige driftsbygninger.']);
  if (!ut.length && b.nivaa >= 1) ut.push(['Generelt', 'Reparer heller enn å skifte. Bruk tradisjonelle materialer og metoder, og dokumenter med foto før og etter arbeid.']);
  return ut;
}

// ---------- Tilskudd ----------

export function lagTilskudd(r) {
  const n = r.hoyesteNivaa;
  const ut = [];
  if (n === 5) ut.push({ navn: 'Tilskudd til fredete kulturminner i privat eie', fra: 'Riksantikvaren via fylkeskommunen', tekst: 'Dekker antikvariske merkostnader ved istandsetting og vedlikehold av fredete bygninger. Søknad sendes fylkeskommunen.', url: 'https://www.riksantikvaren.no/tilskudd/' });
  if (n >= 1) ut.push({ navn: 'Kulturminnefondet', fra: 'Norsk kulturminnefond', tekst: 'Tilskudd til private eiere av verneverdige kulturminner, inkludert SEFRAK-registrerte bygninger. Det er en fordel med en antikvarisk vurdering og et kostnadsoverslag.', url: 'https://www.kulturminnefondet.no/' });
  if (n >= 1 && r.landbruk) ut.push({ navn: 'SMIL – spesielle miljøtiltak i jordbruket', fra: 'Kommunens landbrukskontor', tekst: 'Tilskudd til istandsetting av freda og verneverdige bygninger i jordbrukets kulturlandskap, f.eks. stabbur, låver og kvernhus. Søker må drive eller eie en landbrukseiendom.', url: 'https://www.landbruksdirektoratet.no/nb/jordbruk/ordninger-for-jordbruk/spesielle-miljotiltak-i-jordbruket-smil' });
  if (n >= 1) ut.push({ navn: `Regionale tilskudd i ${r.fylke.navn}`, fra: r.fylke.myndighet, tekst: 'Mange fylkeskommuner og kommuner har egne tilskudd og fond til verneverdige bygninger, og gir gratis råd om antikvarisk vedlikehold.', url: r.fylke.url });
  if (n >= 1) ut.push({ navn: 'Fritak for eiendomsskatt', fra: 'Kommunen', tekst: 'Kommunen kan frita bygninger med historisk verdi for eiendomsskatt. Spør kommunen om de praktiserer dette.', url: 'https://lovdata.no/lov/1975-06-06-29/§7' });
  ut.push({ navn: 'Enova', fra: 'Enova SF', tekst: 'Støtte til enkelte energitiltak i bolig. Velg løsninger som er tilpasset eldre bygninger.', url: 'https://www.enova.no/privat/' });
  return ut;
}

export function lagKontakter(r) {
  const k = r.eiendom.kommune;
  const plan = r.planer.planer.find((p) => p.link);
  return [
    { navn: `${k.navn || 'Kommunen'} kommune – byggesak og plan`, tekst: 'Søknadsplikt, planbestemmelser, forhåndskonferanse, kommunal kulturminneplan.', url: plan?.link || `https://www.google.com/search?q=${encodeURIComponent(`${k.navn || ''} kommune planinnsyn`)}` },
    { navn: r.fylke.myndighet, tekst: 'Regional kulturminnemyndighet: fredete bygninger, bygninger eldre enn 1850, automatisk fredete kulturminner og antikvariske råd.', url: r.fylke.url },
    { navn: 'Riksantikvaren – råd om vedlikehold', tekst: 'Veiledere om vinduer, maling, etterisolering, tak og brannsikring.', url: 'https://www.riksantikvaren.no/' },
    { navn: 'Fortidsminneforeningen', tekst: 'Råd, kurs og håndverkerlister for eiere av gamle hus.', url: 'https://www.fortidsminneforeningen.no/' },
    { navn: 'Kulturminnesøk', tekst: 'Se registrerte kulturminner og SEFRAK-bygninger i kart.', url: 'https://www.kulturminnesok.no/' },
  ];
}

export function lagSjekkliste(r) {
  const n = r.hoyesteNivaa;
  const ut = [
    'Les gjeldende reguleringsplan/kommuneplan og bestemmelsene (lenke under «Arealplaner»)',
    'Sjekk om kommunen har en kulturminneplan eller kommunal verneliste',
    'Ta bilder av alle fasader, tak, vinduer og detaljer før arbeidet starter',
  ];
  if (n >= 4) ut.push('Kontakt fylkeskommunen tidlig – de gir gratis antikvariske råd og vet hva som kreves');
  if (n === 5) ut.push('Søk dispensasjon/tillatelse etter kulturminneloven før tiltak utover vanlig vedlikehold');
  if (n >= 1) ut.push('Be om forhåndskonferanse med kommunen før tiltak som endrer fasade, tak eller volum');
  if (n >= 1) ut.push('Søk tilskudd før du starter – arbeid som er utført før vedtak får som regel ikke støtte');
  ut.push('Bruk håndverkere med erfaring fra eldre bygninger (bygningsvernsentre og Fortidsminneforeningen har oversikter)');
  ut.push('Kartlegg asbest, PCB og blymaling før riving eller større oppussing');
  if (r.kulturminner.sikringssoner.length || r.kulturminner.lokaliteter.some((k) => k.vernetype === 'AUT')) ut.push('Avklar med fylkeskommunen før graving, drenering eller terrengarbeid');
  ut.push('Lag en vedlikeholdsplan: tak, renner og maling hvert år; vinduer og kledning hvert 5.–10. år');
  return ut;
}
