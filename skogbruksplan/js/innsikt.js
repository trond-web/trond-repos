// SkogIQ-innsikt: regelbaserte funn beregnet fra planens egne data. Ingen språkmodell – hvert funn
// kan spores tilbake til en regel her, og hvert har en handling som tar brukeren dit det kan følges opp.
import { startTilstand, laavesteHogstalder, rotnettoPerM3, foreslaaTiltak, sammendrag, TILTAKSTYPER, hogstklasseAvvik } from './model.js';

const FARGE = { handling: 'var(--signal)', advarsel: 'var(--serious)', info: 'var(--accent)', god: 'var(--good)' };
const tall = (v, d = 0) => Number(v).toLocaleString('nb-NO', { maximumFractionDigits: d });

export function lagInnsikt(S, { iAar = new Date().getFullYear(), terrengtransport = null, maksTerreng = 500, pefcFunn = null, skogbrand = null, motorEndringer = 0, skifteplan = null, ksl = [] } = {}) {
  const inn = S.innstillinger;
  const ut = [];
  // KSL: egenrevisjon, avvik, kontroller og dokumentasjon
  for (const v of ksl) ut.push({ vekt: v.nivaa === 'handling' ? 88 : 42, type: v.nivaa === 'handling' ? 'handling' : 'advarsel', tittel: v.tittel, tekst: v.tekst, handling: { tekst: 'Åpne KSL', id: 'fane:ksl' } });
  // Skifteplan for jordbruksarealet: avvik mot gjødselforskriften og plantevernjournalen
  if (skifteplan?.avvik) ut.push({ vekt: 93, type: 'handling', tittel: `${skifteplan.avvik} avvik i skifteplanen`, tekst: 'Gjødslingsplan, jordprøver, spredning eller sprøytejournal oppfyller ikke kravene.', handling: { tekst: 'Se krav', id: 'fane:skifteplan' } });
  else if (skifteplan?.varsel) ut.push({ vekt: 45, type: 'advarsel', tittel: `${skifteplan.varsel} varsel i skifteplanen`, tekst: 'F.eks. jordprøver som snart går ut, lav pH eller ensidig vekstskifte.', handling: { tekst: 'Se krav', id: 'fane:skifteplan' } });
  if (!S.bestand.length) return ut.map((i) => ({ ...i, farge: FARGE[i.type] }));

  // 1. Hogstmoden skog uten planlagt hogst
  const moden = S.bestand.filter((b) => {
    const s = startTilstand(b); const min = laavesteHogstalder(b, inn);
    return !b.miljo && min && s.alder >= min && (b.volumDaa ?? s.volumDaa) >= 8
      && !(b.tiltak || []).some((t) => t.type === 'sluttavvirkning' && t.status !== 'utfort');
  });
  if (moden.length) {
    const m3 = moden.reduce((s, b) => s + startTilstand(b).volumDaa * (b.areal || 0), 0);
    const kr = moden.reduce((s, b) => s + startTilstand(b).volumDaa * (b.areal || 0) * rotnettoPerM3(b.treslag, inn), 0);
    ut.push({ vekt: 90, type: 'handling', tittel: `${moden.length} bestand er hogstmodne uten planlagt hogst`, tekst: `Ca. ${tall(m3)} m³ og ${tall(kr / 1000)} k kr i rotnetto.`, handling: { tekst: 'Foreslå tiltak', id: 'foresla' } });
  }

  // PEFC-avvik
  if (pefcFunn) {
    const avvik = pefcFunn.filter((f) => f.nivaa === 'avvik');
    const krav = [...new Set(avvik.map((f) => f.krav))];
    if (avvik.length) ut.push({ vekt: 95, type: 'handling', tittel: `${avvik.length} avvik fra PEFC-skogstandarden`, tekst: `Gjelder kravpunkt ${krav.slice(0, 5).join(', ')}${krav.length > 5 ? ' …' : ''}. Må lukkes før hogst og tømmersalg.`, handling: { tekst: 'Se PEFC', id: 'fane:pefc' } });
  }

  // Skogbrand: skader som ikke er meldt, og stor skogbrannfare med planlagte drifter
  if (skogbrand?.ikkeMeldt) ut.push({ vekt: 97, type: 'handling', tittel: `${skogbrand.ikkeMeldt} skade${skogbrand.ikkeMeldt > 1 ? 'r' : ''} er ikke meldt til forsikringen`, tekst: 'Meld skaden før opprydding – avvirkning før taksering kan gi tap av erstatning.', handling: { tekst: 'Se skader', id: 'fane:skogbrand' } });
  if (skogbrand?.brann && ['rod', 'morkerod', 'oransje'].includes(skogbrand.brann.id)) ut.push({ vekt: 92, type: 'advarsel', tittel: `Skogbrannfare: ${skogbrand.brann.navn.toLowerCase()}`, tekst: 'Følg retningslinjene for skogsdrift i brannsesongen. Røyking og bål er forbudt i skogen.', handling: { tekst: 'Se Skogbrand', id: 'fane:skogbrand' } });

  if (motorEndringer) ut.push({ vekt: 88, type: 'handling', tittel: `${motorEndringer} bestand er endret – nye tiltaksforslag`, tekst: 'Tiltaksmotoren har oppdaterte forslag etter endringer i bestandsdata eller utførte tiltak.', handling: { tekst: 'Se forslag', id: 'fane:tiltak' } });

  // Hogstklasse som ikke stemmer med alder og bonitet (manuelt satt eller importert)
  const hkAvvik = S.bestand.filter((b) => hogstklasseAvvik(b, inn));
  if (hkAvvik.length) ut.push({ vekt: 75, type: 'advarsel', tittel: `${hkAvvik.length} bestand har hogstklasse som ikke stemmer med alder og bonitet`, tekst: hkAvvik.slice(0, 3).map((b) => { const a = hogstklasseAvvik(b, inn); return `${b.nr}: HK ${a.registrert}, beregnet ${a.beregnet} (${a.alder} år)`; }).join(' · ') + (hkAvvik.length > 3 ? ' …' : ''), handling: { tekst: 'Vis bestand', id: `bestand:${hkAvvik[0].id}` } });

  // 2. Forfalte tiltak
  const forfalt = S.bestand.flatMap((b) => (b.tiltak || []).filter((t) => t.status !== 'utfort' && t.aar < iAar));
  if (forfalt.length) ut.push({ vekt: 85, type: 'advarsel', tittel: `${forfalt.length} tiltak er forfalt`, tekst: forfalt.slice(0, 3).map((t) => TILTAKSTYPER[t.type]?.navn || t.type).join(', ') + (forfalt.length > 3 ? ' …' : ''), handling: { tekst: 'Se tiltak', id: 'fane:tiltak' } });

  // 3. Mulig hogd etter forrige takst (fra generering med SR16)
  const hogd = S.bestand.filter((b) => /hogd/.test(b.merknad || ''));
  if (hogd.length) ut.push({ vekt: 80, type: 'advarsel', tittel: `${hogd.length} bestand er trolig hogd siden forrige takst`, tekst: `${tall(hogd.reduce((s, b) => s + (b.areal || 0), 0))} daa der SR16 viser lite volum. Kontroller i felt og vurder foryngelse.`, handling: { tekst: 'Vis bestand', id: `bestand:${hogd[0].id}` } });

  // 4. Ungskogpleie
  const ung = S.bestand.filter((b) => foreslaaTiltak(b, inn, iAar).some((f) => f.type === 'ungskogpleie'));
  if (ung.length) ut.push({ vekt: 60, type: 'handling', tittel: `${ung.length} bestand kan trenge ungskogpleie`, tekst: `${tall(ung.reduce((s, b) => s + (b.areal || 0), 0))} daa ungskog. Pleie nå gir bedre kvalitet og tilvekst senere.`, handling: { tekst: 'Foreslå tiltak', id: 'foresla' } });

  // 5. Terrengtransport
  if (terrengtransport) {
    const lange = S.bestand.filter((b) => (terrengtransport.get(b.id)?.meter ?? 0) > maksTerreng && Number.isFinite(terrengtransport.get(b.id)?.meter));
    if (lange.length) ut.push({ vekt: 50, type: 'info', tittel: `${lange.length} bestand har lang terrengtransport`, tekst: `${tall(lange.reduce((s, b) => s + (b.areal || 0), 0))} daa ligger over ${tall(maksTerreng)} m fra bilvei. Ny vei kan øke netto.`, handling: { tekst: 'Vis i kartet', id: 'farge:terreng' } });
  }

  // 6. Veier
  const vr = S.veier;
  if (vr) {
    const darlig = vr.veier.filter((v) => v.tilstand === 'darlig').length + vr.punkter.filter((p) => p.tilstand === 'darlig').length;
    if (darlig) ut.push({ vekt: 70, type: 'advarsel', tittel: `${darlig} veier eller punkter er i dårlig tilstand`, tekst: 'Utbedring nå hindrer større skader og stengte veier i hogstsesongen.', handling: { tekst: 'Åpne veier', id: 'fane:veier' } });
    const iaar = vr.vedlikehold.filter((l) => l.status === 'planlagt' && l.aar === iAar);
    if (iaar.length) ut.push({ vekt: 40, type: 'info', tittel: `${iaar.length} vedlikeholdstiltak på veiene i år`, tekst: `Ca. ${tall(iaar.reduce((s, l) => s + (l.kostnad || 0), 0))} kr.`, handling: { tekst: 'Åpne veier', id: 'fane:veier' } });
  } else {
    ut.push({ vekt: 20, type: 'info', tittel: 'Veiene er ikke registrert', tekst: 'Hent skogsbilveiene fra NVDB for å se terrengtransport og planlegge vedlikehold.', handling: { tekst: 'Åpne veier', id: 'fane:veier' } });
  }

  // 7. Klima – positiv bekreftelse
  const s = sammendrag(S.bestand, inn);
  if (s.tilvekst > 0) ut.push({ vekt: 10, type: 'god', tittel: `Skogen binder ca. ${tall(s.co2)} tonn CO₂ i året`, tekst: `Tilvekst ${tall(s.tilvekst)} m³ per år (${tall((s.tilvekst / Math.max(1, s.volum)) * 100, 1)} % av volumet).`, handling: { tekst: 'Se prognose', id: 'fane:framskriving' } });

  return ut.sort((a, b) => b.vekt - a.vekt).map((i) => ({ ...i, farge: FARGE[i.type] }));
}
