// Tiltaksmotor: lager tiltak for kort (0–10 år) og lang sikt (10–30 år) ut fra biologi, bærekraft og økonomi.
// Fokus: flatehogst, lukket hogst, tynning, planting, markberedning og ungskogpleie. Reglene bygger på forskrift,
// forskning og fagråd (se KILDER). Ingen DOM – kan testes i Node.
import { STANDARD_INNSTILLINGER, startTilstand, laavesteHogstalder, beregnetHogstklasse, arligTilvekstDaa, hogstAndel, hogstNettoPerM3, tiltakKostnad, nyId, TILTAKSTYPER, hkGrenser } from './model.js';
import { pefcAlder, avstand } from './pefc.js';
import { bestandsverdi, STANDARD_VERDI } from './verdi.js';
import { risikoPerBestand } from './skade.js';

export const MOTOR_VERSJON = 1;

export const KILDER = {
  forskrift: { navn: 'Forskrift om bærekraftig skogbruk §§ 6–7: foryngelsesplikt og tilrådd plantetall per bonitet', url: 'https://lovdata.no/dokument/SF/forskrift/2006-06-07-593' },
  tynning: { navn: 'NIBIO: Tynning og skogproduksjon – første tynning ved 12–14 m overhøyde, andre ved 16–18 m; én tynning i gran, to i furu', url: 'https://nibio.no/tema/skog/skogbehandling-og-skogskjotsel/tynning/tynning-og-skogproduksjon' },
  ungskogpleie: { navn: 'Statsforvalteren/Skogkurs: Tid for ungskogpleie – ved 1–5 m høyde, 150–250 trær/daa etterpå (100–140 i stormutsatte bestand)', url: 'https://www.statsforvalteren.no/vestfold-og-telemark/landbruk-og-mat/skogbruk/skogkultur2/ungskogpleie2/tid-for-ungskogpleie/' },
  snutebille: { navn: 'NIBIO/Landbruksdirektoratet: Snutebilleundersøkelsen 2017 – markberedning gir høyere overlevelse og mindre gnag', url: 'https://www.landbruksdirektoratet.no/nb/filarkiv/rapporter/prosjektresultater/skogbruk/9.2%20Snutebilleunders%C3%B8kelsen%202017%20-%20sluttrapport.pdf' },
  lukket: { navn: 'NIBIO/NINA for Miljødirektoratet (2025): Arealeffekter av økt bruk av lukkede hogstformer – egnet særlig på middels og lav bonitet, blåbær- og tyttebærskog og eldre gran', url: 'https://www.miljodirektoratet.no/publikasjoner/2025/mars-2025/arealeffekter-av-okt-bruk-av-lukkede-hogstformer/' },
  lukketDef: { navn: 'Lukka hogst: mer enn 15 trær/daa står igjen, eller åpninger under 2 daa (Store norske leksikon)', url: 'https://snl.no/lukka_hogst' },
  pefc: { navn: 'Norsk PEFC Skogstandard (PEFC N 02:2022): laveste hogstalder, livsløpstrær, kantsoner og hogstformer', url: 'https://www.pefcnorge.org/' },
  storm: { navn: 'Skogbrand: Forebygging av stormskader – ungskogpleie ved ca. 4 m, tynning før 14 m, maks 40 % uttak', url: 'https://www.skogbrand.no/forebygging/stormskader/' },
  okonomi: { navn: 'Faustmann – forventningsverdi og optimalt hogsttidspunkt (SkogIQ verdiberegning med dine priser og rente)', url: null },
};

// Prinsipper styrer vektingen mellom biologi, bærekraft og økonomi.
export const PRINSIPPER = {
  balansert: { navn: 'Balansert', beskrivelse: 'Økonomisk optimalt hogsttidspunkt, lukket hogst der det passer biologisk, jevn avvirkning rundt tilveksten.', hogstFaktor: 1.25, lukket: 0, forlengelse: 0 },
  okonomi: { navn: 'Økonomi først', beskrivelse: 'Hogst ved økonomisk optimum, flatehogst med planting på god bonitet, større rom for å ta ut hogstmoden skog tidlig.', hogstFaktor: 1.6, lukket: -1, forlengelse: 0 },
  biologi: { navn: 'Biologi og miljø først', beskrivelse: 'Mer lukket hogst, 10 år lengre omløp, avvirkning under tilveksten og mer naturlig foryngelse.', hogstFaktor: 0.9, lukket: 2, forlengelse: 10 },
};

// ---------- faglige tabeller ----------
// Tilrådd plantetall (forskriften § 7) – midt i intervallet.
export function plantetall(treslag, bonitet) {
  const bo = bonitet || 11;
  if (treslag === 'F') return bo >= 17 ? { anbefalt: 250, min: 150, intervall: '190–340' } : bo >= 11 ? { anbefalt: 180, min: 100, intervall: '120–240' } : { anbefalt: 100, min: 50, intervall: '80–130' };
  return bo >= 20 ? { anbefalt: 220, min: 150, intervall: '150–300' } : bo >= 14 ? { anbefalt: 180, min: 100, intervall: '130–230' } : { anbefalt: 100, min: 50, intervall: '60–140' };
}
// Treantall etter ungskogpleie.
export function maalTetthet(treslag, bonitet, stormutsatt = false) {
  if (stormutsatt && treslag !== 'L') return 120;
  if (treslag === 'L') return 120;
  if (treslag === 'F') return (bonitet || 11) >= 14 ? 220 : 200;
  return (bonitet || 11) >= 17 ? 200 : (bonitet || 11) >= 14 ? 180 : 150;
}
// Middelhøyde etter alder (samme enkle høydekurve som Skogbrand-modulen), skalert til registrert høyde.
const modellH = (alder, h40) => (alder <= 0 ? 0 : Math.min(1.6, (alder / 40) ** 0.75) * h40 * 0.85);
export function hoydeOm(b, aar) {
  const s = startTilstand(b);
  const naa = modellH(s.alder, s.h40);
  const f = b.hoyde && naa > 0.5 ? b.hoyde / naa : 1;
  return (b.hoyde && aar === 0) ? b.hoyde : modellH(s.alder + aar, s.h40) * f;
}
// År til bestandet når høyde H (fra en gitt alder; brukes også for ny generasjon fra alder 0).
export function aarTilHoyde(H, h40, fraAlder = 0) { for (let a = fraAlder; a < fraAlder + 120; a++) if (modellH(a, h40) >= H) return a - fraAlder; return 120; }

// ---------- hjelpere ----------
const planlagt = (b, typer) => (b.tiltak || []).some((t) => t.status !== 'utfort' && typer.includes(t.type));
const utfort = (b, type) => (b.tiltak || []).filter((t) => t.status === 'utfort' && t.type === type).sort((a, c) => (c.aar || 0) - (a.aar || 0));
const kr = (v) => `${Math.round(v).toLocaleString('nb-NO')} kr`;

// Bestand som ikke skal ha produksjonstiltak: miljøfigurer og bestand som overlapper nøkkelbiotop/BVO/verneområde.
function vernet(S, b) {
  if (b.miljo) return 'Miljøfigur';
  for (const o of S.pefc?.objekter || []) {
    if (!o.geometri || !b.geometri) continue;
    if (['noekkelbiotop', 'bvo', 'vern'].includes(o.type) && avstand(b.geometri, o.geometri, 0) === 0) return o.type === 'vern' ? 'Verneområde' : 'Nøkkelbiotop/BVO';
  }
  return null;
}
// Miljøhensyn som taler for lukket hogst: friluftsliv, naturtyper, vann/kantsone (PEFC).
function miljohensyn(S, b) {
  const ut = [];
  for (const o of S.pefc?.objekter || []) {
    if (!o.geometri || !b.geometri) continue;
    if (o.type === 'friluftsomrade' && avstand(b.geometri, o.geometri, 0) === 0) ut.push('viktig friluftslivsområde');
    else if (['naturtype', 'artsomrade'].includes(o.type) && avstand(b.geometri, o.geometri, 0) === 0) ut.push('registrert naturtype/artsområde');
    else if (o.type === 'vann' && avstand(b.geometri, o.geometri, 25) <= 25) ut.push('kantsone mot vann');
  }
  return [...new Set(ut)];
}

// Velger hogstform for et hogstmodent bestand. Gir { form, for, mot, tekst }.
function velgHogstform(S, b, risiko, prinsipp) {
  const s = startTilstand(b); const bo = s.h40; const ts = b.treslag || 'G';
  const forL = []; const motL = []; let poeng = PRINSIPPER[prinsipp].lukket;
  if (prinsipp === 'biologi') forL.push('prinsippet «biologi og miljø først»');
  if (prinsipp === 'okonomi') motL.push('prinsippet «økonomi først»');
  if (ts === 'G' && bo <= 14) { poeng += 2; forL.push(`granskog på middels/lav bonitet (G${bo})`); }
  if (ts === 'F' && bo <= 11) { poeng += 1; forL.push(`furu på lav bonitet (F${bo})`); }
  if (bo >= 20) { poeng -= 2; motL.push(`høy bonitet (${ts}${bo}) gir best produksjon og økonomi med flatehogst og planting`); }
  const hensyn = miljohensyn(S, b);
  if (hensyn.length) { poeng += 2; forL.push(...hensyn); }
  const nedre = pefcAlder(bo)?.nedre ?? 60;
  if (s.alder >= nedre + 30) { poeng += 1; forL.push(`gammel skog (${Math.round(s.alder)} år)`); }
  if (risiko?.storm?.nivaa?.id === 'hoy') { poeng -= 3; motL.push('høy stormrisiko – gjenstående trær kan blåse ned'); }
  if (ts === 'L') { poeng -= 1; motL.push('lauvskog foryngres best med flatehogst'); }
  if (poeng >= 3) return { form: 'lukket', tekst: `Lukket hogst valgt: ${forL.join(', ')}${motL.length ? ` (vurdert mot: ${motL.join(', ')})` : ''}.` };
  const vurdert = forL.length ? ` Lukket hogst er vurdert (${forL.join(', ')}), men ${motL.length ? motL.join(', ') : 'samlet sett gir flatehogst bedre resultat her'}.` : motL.length ? ` ${motL[0][0].toUpperCase()}${motL.join(', ').slice(1)}.` : '';
  if (ts === 'F' && bo <= 14) return { form: 'frotre', tekst: `Frøtrestilling: furu på middels/lav bonitet foryngres godt naturlig med 5–10 frøtrær/daa og markberedning.${vurdert}` };
  if (ts === 'L') return { form: 'flate-naturlig', tekst: `Flatehogst med naturlig foryngelse av lauv.${vurdert}` };
  return { form: 'flate', tekst: `Flatehogst med planting.${vurdert}` };
}

// ---------- motor ----------
// Gir forslag: { b, type, aar, prioritet, kommentar, begrunnelse, kilder, periode, hogstform?, uttak?, regel }.
export function genererTiltak(S, { iAar = new Date().getFullYear(), horisont = 30, prinsipp = 'balansert', bestandIder = null, balanser = true } = {}) {
  const inn = { ...STANDARD_INNSTILLINGER, ...S.innstillinger };
  const vInn = { ...STANDARD_VERDI, ...S.verdi };
  const P = PRINSIPPER[prinsipp] || PRINSIPPER.balansert;
  const slutt = iAar + horisont - 1;
  let risiko = null;
  // Stormrisiko (naboer, høyde) beregnes for hele planen; ved små oppdateringer av enkeltbestand hoppes den over for fart.
  if (!bestandIder || bestandIder.length > 20) { try { risiko = risikoPerBestand(S, { iAar }); } catch { risiko = null; } }
  const ut = [];
  const legg = (b, type, aar, prioritet, kommentar, begrunnelse, kilder, ekstra = {}) => {
    if (aar > slutt) return;
    ut.push({ b, type, aar: Math.max(iAar, Math.round(aar)), prioritet, kommentar, begrunnelse, kilder, periode: aar < iAar + 10 ? 'kort' : 'lang', regel: ekstra.regel || type, ...ekstra });
  };
  const hogstKandidater = [];
  const utvalg = S.bestand.filter((b) => !bestandIder || bestandIder.includes(b.id));

  // Foryngelseskjede etter hogst (flate) eller for hogstflater uten foryngelse.
  const foryngelse = (b, hogstAar, form, kilde = 'etter hogst') => {
    const s = startTilstand(b); const ts = b.treslag || 'G'; const bo = s.h40;
    if (form === 'lukket') return;
    if (form === 'flate-naturlig' || (ts === 'L' && bo < 17)) {
      legg(b, 'ungskogpleie', hogstAar + aarTilHoyde(3, bo), 2, `Ungskogpleie av naturlig foryngelse, ned til ${maalTetthet('L', bo)} trær/daa`, 'Lauv foryngres naturlig. Ungskogpleie ved 2–4 m høyde gir færre og bedre trær.', ['ungskogpleie'], { regel: 'ungskogpleie-naturlig' });
      return;
    }
    if (form === 'frotre') {
      legg(b, 'markberedning', hogstAar, 1, 'Markberedning (flekk/harving) for naturlig foryngelse under frøtrær', 'Furufrø spirer best på blottlagt mineraljord. Markberedning samme høst som frøtrestillingen øker spiring og overlevelse.', ['snutebille', 'forskrift'], { regel: 'markberedning-frotre' });
      legg(b, 'annet', hogstAar + 10, 3, 'Fjern frøtrærne når foryngelsen er etablert', 'Når foryngelsen er sikret (normalt 8–12 år), hogges frøtrærne. Behold livsløpstrær (PEFC).', ['pefc', 'forskrift'], { regel: 'frotre-fjerning' });
      legg(b, 'ungskogpleie', hogstAar + aarTilHoyde(3, bo), 2, `Ungskogpleie ned til ${maalTetthet('F', bo)} trær/daa`, 'Naturlig furuforyngelse blir ofte tett. Ungskogpleie ved 2–4 m høyde.', ['ungskogpleie'], { regel: 'ungskogpleie-etter-hogst' });
      return;
    }
    const pt = plantetall(ts === 'L' ? 'G' : ts, bo);
    if (bo >= 11) legg(b, 'markberedning', hogstAar, 2, 'Markberedning før planting', 'Markberedning gir høyere overlevelse og mindre gnag av snutebiller, og bedre etablering. Flekkene bør være minst 20 × 20 cm.', ['snutebille'], { regel: 'markberedning' });
    legg(b, 'planting', hogstAar + 1, 1, `Planting av ${ts === 'F' ? 'furu' : 'gran'}, ca. ${pt.anbefalt} planter/daa (tilrådd ${pt.intervall}, minst ${pt.min})`, `Foryngelsesplikt etter hogst (forskriften § 6). Plantetall etter forskriften § 7 for bonitet ${bo}. Plant våren etter hogst og markberedning; bruk behandlede eller skjermede planter mot snutebiller.`, ['forskrift', 'snutebille'], { regel: 'planting', plantetall: pt.anbefalt });
    legg(b, 'ungskogpleie', hogstAar + 1 + aarTilHoyde(3, bo), 2, `Ungskogpleie ned til ${maalTetthet(ts === 'L' ? 'G' : ts, bo)} trær/daa`, 'Ungskogpleie ved 1–5 m høyde. Fjern konkurrerende lauv, men la ca. 10 % lauv stå (forskriften/PEFC).', ['ungskogpleie', 'forskrift'], { regel: 'ungskogpleie-etter-hogst' });
    if ((ts === 'G' && bo >= 14) || (ts === 'F' && bo >= 11)) legg(b, 'tynning', hogstAar + 1 + aarTilHoyde(13, bo), 3, 'Førstegangstynning ved 12–14 m overhøyde', 'Tynning gir grovere trær og høyere rotnetto ved sluttavvirkning.', ['tynning'], { regel: 'tynning-lang' });
  };

  for (const b of utvalg) {
    const vern = vernet(S, b);
    if (vern) continue;
    const s = startTilstand(b); const ts = b.treslag || 'G'; const bo = s.h40;
    const min = laavesteHogstalder(b, inn) || 999;
    const hk = b.hogstklasse || beregnetHogstklasse(s.alder, min, s.volumDaa, hkGrenser(b, inn));
    const h = hoydeOm(b, 0);
    const r = risiko?.get(b.id);
    const storm = r?.storm?.nivaa?.id === 'hoy';
    const tynnet = utfort(b, 'tynning');
    const hogd = utfort(b, 'sluttavvirkning')[0];

    // 1. Hogstflate / skogfornyelse uten foryngelse
    const nyligHogd = hogd && hogd.aar >= iAar - 5;
    if ((hk === 1 || nyligHogd || s.alder < 3) && !planlagt(b, ['planting', 'markberedning', 'suppleringsplanting', 'ungskogpleie'])) {
      if (!utfort(b, 'planting').length && !utfort(b, 'markberedning').length) {
        const hAar = hogd?.aar ?? iAar - 1;
        const form = ts === 'F' && bo <= 14 ? 'frotre' : ts === 'L' && bo < 17 ? 'flate-naturlig' : 'flate';
        foryngelse(b, Math.max(iAar - 1, hAar), form, 'hogstflate');
        continue;
      }
    }

    // 2. Ungskogpleie
    if (hk === 2 || (s.alder > 0 && h < 8 && hk <= 3)) {
      const gjort = utfort(b, 'ungskogpleie').length;
      if (!gjort && !planlagt(b, ['ungskogpleie'])) {
        const maal = maalTetthet(ts, bo, storm);
        const tett = b.treantall == null || b.treantall > maal * 1.3;
        if (tett) {
          const om = h >= 1 ? 0 : aarTilHoyde(1.5, bo, s.alder);
          const sen = h > 6;
          legg(b, 'ungskogpleie', iAar + om, sen ? 1 : 2, `Ungskogpleie ned til ca. ${maal} trær/daa${b.treantall ? ` (nå ${b.treantall})` : ''}`, `${sen ? 'Bestandet er over 6 m – ungskogpleie haster for å unngå tynne, ustabile trær. ' : `Høyde ca. ${h.toFixed(1)} m – riktig fase for ungskogpleie (1–5 m). `}Målt treantall ${storm ? '100–140 trær/daa fordi bestandet er stormutsatt' : '150–250 trær/daa'} gir stabile trær med god diametertilvekst; behold ca. 10 % lauv.`, storm ? ['ungskogpleie', 'storm'] : ['ungskogpleie'], { regel: 'ungskogpleie', maalTetthet: maal });
        }
      }
    }

    // 3. Tynning (først 12–14 m, furu ev. andre gang 16–18 m)
    if (!planlagt(b, ['tynning', 'sluttavvirkning', 'lukkethogst']) && hk >= 2 && hk <= 4 && ts !== 'L') {
      const egnet = (ts === 'G' && bo >= 14) || (ts === 'F' && bo >= 11);
      const forste = !tynnet.length;
      const andre = ts === 'F' && tynnet.length === 1 && iAar - tynnet[0].aar >= 8;
      const fra = forste ? 12 : 16; const til = forste ? 14 : 18;
      if (egnet && (forste || andre)) {
        let om = h >= fra ? 0 : null;
        if (om === null) for (let k = 1; k <= 30; k++) if (hoydeOm(b, k) >= fra) { om = k; break; }
        const hDa = om != null ? hoydeOm(b, om) : 0;
        const forSent = forste && h > 16;
        if (om != null && !forSent && hDa <= til + 2 && (b.treantall == null || b.treantall > 100)) {
          const volDa = s.volumDaa * (1 + 0.03 * om);
          const uttakDaa = volDa * hogstAndel('tynning', inn);
          if (uttakDaa >= 3) {
            const netto = uttakDaa * (b.areal || 0) * hogstNettoPerM3('tynning', ts, inn);
            legg(b, 'tynning', iAar + om, om === 0 ? 1 : 2, `${forste ? 'Første' : 'Andre'}gangstynning ved ${fra}–${til} m (ca. ${Math.round(uttakDaa * (b.areal || 0))} m³)`, `Overhøyde ca. ${hDa.toFixed(0)} m i ${iAar + om}. Tynning tar ut ${Math.round(hogstAndel('tynning', inn) * 100)} % (maks 40 % for stabilitet) og gir grovere, mer verdifulle trær. Anslått netto ${kr(netto)}.`, ['tynning', 'storm'], { regel: 'tynning' });
          }
        }
      }
    }

    // 4. Sluttavvirkning eller lukket hogst
    if (!planlagt(b, ['sluttavvirkning', 'lukkethogst']) && hk >= 3 && s.volumDaa >= 5) {
      let opt;
      try { opt = bestandsverdi(b, inn, vInn, { iAar }); } catch { opt = null; }
      const nedreAar = iAar + Math.max(0, Math.ceil((pefcAlder(bo)?.nedre ?? min) - s.alder));
      let maalAar = Math.max(opt?.hogstAar ?? iAar + Math.max(0, min - s.alder), nedreAar) + P.forlengelse;
      if (storm && s.alder >= (pefcAlder(bo)?.nedre ?? min)) maalAar = Math.min(maalAar, iAar + 2);
      if (maalAar <= slutt) hogstKandidater.push({ b, maalAar, s, opt, risiko: r });
    }
  }

  // Bærekraft: hogstvolum fordeles slik at hver femårsperiode holder seg innenfor tilveksten × faktor.
  const tilvekst = S.bestand.reduce((x, b) => x + arligTilvekstDaa(b) * (b.areal || 0), 0);
  const tak = Math.max(1, tilvekst * 5 * P.hogstFaktor);
  const periodeVolum = new Map();
  const periode = (aar) => Math.floor((aar - iAar) / 5);
  hogstKandidater.sort((a, c) => a.maalAar - c.maalAar || c.s.alder - a.s.alder);
  for (const k of hogstKandidater) {
    const { b, s, opt } = k; const ts = b.treslag || 'G'; const bo = s.h40;
    const valg = velgHogstform(S, b, k.risiko, prinsipp);
    const andel = valg.form === 'lukket' ? hogstAndel('lukkethogst', inn) : 1;
    let aar = k.maalAar;
    const vol = (a) => s.volumDaa * (1 + 0.015 * Math.max(0, a - iAar)) * (b.areal || 0) * andel;
    if (balanser) {
      while (aar <= slutt && (periodeVolum.get(periode(aar)) || 0) + vol(aar) > tak && (periodeVolum.get(periode(aar)) || 0) > 0) aar += 5 - ((aar - iAar) % 5);
      if (aar > slutt) continue;
      periodeVolum.set(periode(aar), (periodeVolum.get(periode(aar)) || 0) + vol(aar));
    }
    const m3 = vol(aar);
    const utsatt = aar > k.maalAar ? ` Utsatt fra ${k.maalAar} for jevn avvirkning innenfor tilveksten.` : '';
    const okonomi = opt ? ` Økonomisk optimalt hogstår er ${opt.hogstAar} (alder ${opt.alderVedHogst}) med ${vInn.rente} % rente.` : '';
    if (valg.form === 'lukket') {
      const netto = m3 * hogstNettoPerM3('lukkethogst', ts, inn);
      legg(b, 'lukkethogst', aar, aar <= iAar + 2 ? 1 : 2, `Lukket hogst (plukk-/gruppehogst), uttak ca. ${Math.round(andel * 100)} % – ca. ${Math.round(m3)} m³`, `${valg.tekst} Mer enn 15 trær/daa står igjen, åpninger under 2 daa, og ny generasjon kommer naturlig. Anslått netto ${kr(netto)} (inkl. ${inn.lukketTillegg ?? 40} kr/m³ høyere driftskostnad).${okonomi}${utsatt}`, ['lukket', 'lukketDef', 'pefc', 'okonomi'], { regel: 'lukket', hogstform: 'selektiv', uttak: andel });
      for (let n = aar + 15; n <= slutt; n += 15) legg(b, 'lukkethogst', n, 3, `Nytt lukket hogstinngrep (ca. ${Math.round(andel * 100)} %)`, 'Lukket hogst gjentas med 15–20 års mellomrom mens skogen holdes kontinuerlig dekket.', ['lukket', 'lukketDef'], { regel: 'lukket-gjentak', hogstform: 'selektiv', uttak: andel });
    } else {
      const netto = m3 * hogstNettoPerM3('sluttavvirkning', ts, inn);
      const formTekst = valg.form === 'frotre' ? 'frøtrestilling (5–10 frøtrær/daa)' : 'flatehogst';
      legg(b, 'sluttavvirkning', aar, aar <= iAar + 2 ? 1 : 2, `Sluttavvirkning – ${formTekst}, ca. ${Math.round(m3)} m³`, `${valg.tekst} Alder ${Math.round(s.alder)} år, laveste hogstalder etter PEFC er ${pefcAlder(bo)?.nedre ?? '–'} år. Anslått netto ${kr(netto)}. Behold minst 10 livsløpstrær/daa og kantsoner mot vann (PEFC).${okonomi}${utsatt}`, ['okonomi', 'pefc'], { regel: 'sluttavvirkning', hogstform: valg.form === 'frotre' ? 'frotre' : 'flatehogst' });
      foryngelse(b, aar, valg.form);
    }
  }
  return ut.sort((a, c) => a.aar - c.aar || a.prioritet - c.prioritet);
}

// Oppsummering av et sett forslag.
export function oppsummer(forslag, S) {
  const inn = { ...STANDARD_INNSTILLINGER, ...S.innstillinger };
  const perType = {}; let kort = 0; let lang = 0; let kost = 0;
  for (const f of forslag) {
    perType[f.type] = (perType[f.type] || 0) + 1;
    if (f.periode === 'kort') kort++; else lang++;
    if (!['sluttavvirkning', 'tynning', 'lukkethogst'].includes(f.type)) kost += tiltakKostnad(f.type, f.b.areal || 0, inn);
  }
  return { antall: forslag.length, kort, lang, perType, kost, tekst: Object.entries(perType).map(([t, n]) => `${n} ${(TILTAKSTYPER[t]?.navn || t).toLowerCase()}`).join(', ') };
}

// ---------- endringer på bestand ----------
// Signatur over det som påvirker tiltakene. Når den endres etter at motoren har kjørt, foreslås nye tiltak.
export function signatur(b) {
  const s = startTilstand(b);
  return JSON.stringify([b.treslag, b.bonitet, Math.round(s.alder / 3), Math.round(s.volumDaa), b.treantall, b.hoyde ? Math.round(b.hoyde) : null, b.hogstklasse, Math.round((b.areal || 0) * 2), !!b.miljo,
    (b.tiltak || []).filter((t) => t.status === 'utfort').map((t) => `${t.type}:${t.aar}`).sort().join(',')]);
}
export function merkKjort(b, prinsipp) { b.motor = { signatur: signatur(b), kjort: new Date().toISOString().slice(0, 10), prinsipp, versjon: MOTOR_VERSJON }; }

// Bestand som er endret siden motoren sist kjørte, med forslag til nye tiltak og tiltak som ikke lenger passer.
export function endringer(S, { iAar = new Date().getFullYear(), bestandIder = null } = {}) {
  if (!S.motor) return [];
  const endret = S.bestand.filter((b) => (!bestandIder || bestandIder.includes(b.id)) && (!b.motor || b.motor.signatur !== signatur(b)));
  if (!endret.length) return [];
  const prinsipp = S.motor.prinsipp || 'balansert';
  // Kjør motoren uten de automatiske tiltakene som fortsatt er planlagt, så de kan sammenlignes.
  const kopi = { ...S, bestand: S.bestand.map((b) => (endret.includes(b) ? { ...b, tiltak: (b.tiltak || []).filter((t) => !(t.kilde === 'motor' && t.status !== 'utfort')) } : b)) };
  const forslag = genererTiltak(kopi, { iAar, horisont: S.motor.horisont || 30, prinsipp, bestandIder: endret.map((b) => b.id), balanser: false });
  return endret.map((b) => {
    const nye = forslag.filter((f) => f.b.id === b.id).map((f) => ({ ...f, b }));
    const gamle = (b.tiltak || []).filter((t) => t.kilde === 'motor' && t.status !== 'utfort');
    const leggTil = nye.filter((f) => !gamle.some((t) => t.type === f.type && Math.abs(t.aar - f.aar) <= 2));
    const fjern = gamle.filter((t) => !nye.some((f) => f.type === t.type && Math.abs(t.aar - f.aar) <= 2));
    return { b, leggTil, fjern, ny: !b.motor };
  }).filter((x) => x.leggTil.length || x.fjern.length || x.ny);
}

// Gjør et forslag om til et tiltak i planen.
export function tilTiltak(f) {
  const { b, periode, begrunnelse, kilder, regel, ...rest } = f;
  return { ...rest, id: nyId('t'), status: 'planlagt', kilde: 'motor', motor: { regel, periode, begrunnelse, kilder } };
}

// Legger motorens tiltak direkte inn i planen (brukes når planen lages). erstatt: fjern tidligere automatiske,
// planlagte tiltak først. Manuelle tiltak beholdes alltid.
export function anvend(S, { iAar = new Date().getFullYear(), horisont = 30, prinsipp = 'balansert', erstatt = true } = {}) {
  if (erstatt) for (const b of S.bestand) b.tiltak = (b.tiltak || []).filter((t) => !(t.kilde === 'motor' && t.status !== 'utfort'));
  const forslag = genererTiltak(S, { iAar, horisont, prinsipp });
  for (const f of forslag) f.b.tiltak.push(tilTiltak(f));
  for (const b of S.bestand) merkKjort(b, prinsipp);
  S.motor = { prinsipp, horisont, kjort: new Date().toISOString().slice(0, 10), versjon: MOTOR_VERSJON };
  return oppsummer(forslag, S);
}

// Oppdaterer ett bestand etter endring: fjerner automatiske tiltak som ikke lenger passer og legger inn nye.
export function oppdaterBestand(S, e) {
  e.b.tiltak = (e.b.tiltak || []).filter((t) => !e.fjern.includes(t));
  for (const f of e.leggTil) e.b.tiltak.push(tilTiltak(f));
  merkKjort(e.b, S.motor?.prinsipp || 'balansert');
}
