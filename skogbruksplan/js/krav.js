// Krav og frister: dokumentasjonskravene en gårdbruker står overfor, samlet på ett sted og vurdert ut fra dataene i
// planen (skifteplan, gjødsel- og sprøytejournal, KSL-kontroller, skog, drenering, husdyr). Ingen DOM.
// Hvert krav gir { id, tema, navn, hjemmel, status: ok|delvis|mangler|info|ia, tekst, frist, fane }.
// Kravene er en hjelp til å holde orden – sjekk alltid gjeldende regler for din kommune og ditt fylke.
import { aktiveSkifter, fosforgrense, fosforSnitt, HUSDYR, KULTURER, kontroller as skifteKontroller, AR5_JORDBRUK } from './skifteplan.js';
import { appBevis, kontrollStatus, sikreKsl, oppsummering } from './ksl.js';
import { dreneringStatus } from './drenering.js';

export const HJEMMEL = {
  gjodsel: { navn: 'Forskrift om lagring og bruk av gjødsel mv. (2025)', url: 'https://lovdata.no/forskrift/2025-01-29-115' },
  gjodselInfo: { navn: 'Statsforvalteren: nye regler for lagring og bruk av gjødsel', url: 'https://www.statsforvalteren.no/innlandet/landbruk-og-mat/landbruk-og-mat---nyheter/2025/02/nye-regler-for-lagring-og-bruk-av-gjodsel/' },
  plantevern: { navn: 'Forskrift om plantevernmidler (journal, autorisasjon, funksjonstest)', url: 'https://lovdata.no/forskrift/2015-05-06-455' },
  pt: { navn: 'Forskrift om produksjonstilskudd og avløsertilskudd i jordbruket', url: 'https://lovdata.no/forskrift/2014-12-19-1817' },
  rmp: { navn: 'Regionalt miljøtilskudd (RMP) – regional forskrift', url: 'https://www.landbruksdirektoratet.no/nb/jordbruk/ordninger-for-jordbruk/regionalt-miljotilskudd' },
  regionaleKrav: { navn: 'Forskrift om regionale miljøkrav (vannområder, erosjon)', url: 'https://www.statsforvalteren.no/siteassets/fm-oslo-og-viken/landbruk-og-mat/miljotiltak/dokumenter/forskrift-regionale-miljokrav-i-oslo-og-viken.pdf' },
  drenering: { navn: 'Forskrift om tilskudd til drenering av jordbruksjord', url: 'https://www.statsforvalteren.no/agder/landbruk-og-mat/tilskot-innan-jordbruk-og-skogbruk/tilskudd-til-drenering-av-jordbruksareal' },
  storfe: { navn: 'Forskrift om hold av storfe (beite, fri bevegelse)', url: 'https://www.mattilsynet.no/dyr/produksjonsdyr/storfe/veileder-om-hold-av-storfe/gi-storfe-tilgang-til-beite-fri-bevegelse-og-mosjon' },
  legemiddel: { navn: 'Mattilsynet: dokumentasjon av legemiddelbruk på matproduserende dyr', url: 'https://mattilsynet.no/dyr/dyrehelsepersonell/legemidler-til-dyr/dokumentasjon-av-legemiddelbruk-pa-matproduserende-dyr' },
  husdyrreg: { navn: 'Forskrift om identifikasjon og registrering av husdyr (Husdyrregisteret)', url: 'https://www.mattilsynet.no/dyr/produksjonsdyr/storfe' },
  skog: { navn: 'Skogbruksloven § 6 og forskrift om bærekraftig skogbruk (foryngelsesplikt)', url: 'https://www.statsforvalteren.no/rogaland/landbruk-og-mat/skogbruk/forynging-av-skog/' },
  ksl: { navn: 'KSL – Kvalitetssystem i landbruket', url: 'https://www.matmerk.no/ksl' },
  internkontroll: { navn: 'Internkontrollforskriften (HMS)', url: 'https://lovdata.no/forskrift/1996-12-06-1127' },
};
export const TEMA = { gjodsel: 'Gjødsel og jord', plantevern: 'Plantevern', tilskudd: 'Søknader og tilskudd', miljo: 'Miljø og vann', husdyr: 'Husdyr', skog: 'Skog', hms: 'KSL og HMS' };
export const HUSDYRTYPER = { storfe: 'Storfe', sau: 'Sau', geit: 'Geit', svin: 'Svin', fjorfe: 'Fjørfe', hest: 'Hest' };

export function tomGard() { return { husdyr: { typer: [], oppstalling: 'los', sone: '1-4', gjodsel: [], lager: null, leidSpredeareal: null }, soknader: {}, beite: {}, legemiddel: [] }; }
export function sikreGard(S) {
  S.gard = S.gard || tomGard(); const t = tomGard();
  for (const [k, v] of Object.entries(t)) if (S.gard[k] === undefined) S.gard[k] = v;
  for (const [k, v] of Object.entries(t.husdyr)) if (S.gard.husdyr[k] === undefined) S.gard.husdyr[k] = v;
  return S.gard;
}
const dato = (aar, m, d) => `${aar}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const dager = (a, b) => Math.round((new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / 86400000);
const nesteAarlig = (idag, m, d) => { const a = Number(idag.slice(0, 4)); const x = dato(a, m, d); return x >= idag ? x : dato(a + 1, m, d); };
const r1 = (v) => Math.round(v * 10) / 10;
// Fosforgrensen (kg P/daa): 3,5 fram til 1.1.2027, deretter trinnvis ned (fosforgrense i skifteplan.js).
const pGrense = (aar, region) => fosforgrense(aar, region) ?? 3.5;

// Husdyrgjødsel: produsert fosfor (kg) og lagerbehov (8 måneder) fra registrerte mengder (tonn per år).
export function husdyrgjodsel(S, aar) {
  const g = sikreGard(S).husdyr; const plan = S.skifteplan;
  const tonn = (g.gjodsel || []).reduce((s, x) => s + (Number(x.tonn) || 0), 0);
  const P = (g.gjodsel || []).reduce((s, x) => s + (Number(x.tonn) || 0) * (HUSDYR[x.type]?.P || 0), 0);
  const areal = (plan ? aktiveSkifter(plan, aar).reduce((s, x) => s + (x.areal || 0), 0) : 0) + (Number(g.leidSpredeareal) || 0);
  const grense = pGrense(aar, plan?.region || 'innland');
  return { tonn, P: r1(P), areal: r1(areal), perDaa: areal ? Math.round((P / areal) * 100) / 100 : null, grense, lagerBehov: Math.round((tonn * 8) / 12), lager: g.lager == null || g.lager === '' ? null : Number(g.lager) };
}
export function beiteUker(S, aar) { const b = sikreGard(S).beite?.[aar]; if (!b?.slipp || !b?.inn) return null; return Math.max(0, Math.floor(dager(b.inn, b.slipp) / 7)); }

export function vurderKrav(S, aar, idag = new Date().toISOString().slice(0, 10)) {
  const plan = S.skifteplan; const skifter = plan?.skifter || []; const g = sikreGard(S); const ksl = sikreKsl(S);
  const harJord = skifter.length > 0; const aktive = plan ? aktiveSkifter(plan, aar) : [];
  const sproyter = (plan?.sproyting || []).some((x) => String(x.dato).startsWith(String(aar)) || String(x.dato).startsWith(String(aar - 1)));
  const husdyr = (g.husdyr.typer || []).length > 0; const storfe = (g.husdyr.typer || []).includes('storfe');
  const bestand = (S.bestand || []).filter((b) => !b.nabo);
  const ks = kontrollStatus(ksl, idag); const kontroll = (t) => ks.find((k) => k.type === t);
  const fraBevis = (nr) => appBevis(S, nr, aar, idag);
  const ut = [];
  const krav = (o) => ut.push({ status: 'info', frist: null, fane: null, ...o });
  const kStatus = (k) => (!k?.siste ? 'mangler' : k.status === 'forfalt' ? 'mangler' : k.status === 'snart' ? 'delvis' : 'ok');

  // ---------- gjødsel og jord ----------
  if (harJord) {
    const b = fraBevis('1.2.2');
    krav({ id: 'gjodslingsplan', tema: 'gjodsel', navn: `Gjødslingsplan ${aar} med skiftekart`, hjemmel: HJEMMEL.gjodsel, status: b?.status || 'mangler', tekst: b?.tekst || 'Lag gjødslingsplan i Skifteplan.', frist: dato(aar, 4, 1), fane: 'skifteplan' });
    const j = fraBevis('1.2.3');
    krav({ id: 'gjodseljournal', tema: 'gjodsel', navn: `Gjødseljournal ${aar} (utført gjødsling)`, hjemmel: HJEMMEL.gjodselInfo, status: j?.status || 'mangler', tekst: `${j?.tekst || ''}. Fra 2026 skal alle som bruker gjødsel føre årlig journal.`, frist: dato(aar, 12, 31), fane: 'skifteplan' });
    const jp = fraBevis('1.2.1');
    krav({ id: 'jordprover', tema: 'gjodsel', navn: 'Jordprøver (ikke eldre enn 8 år)', hjemmel: HJEMMEL.gjodsel, status: jp?.status || 'mangler', tekst: jp?.tekst || '', fane: 'skifteplan' });
    const fs = fosforSnitt(plan, aar); const grense = pGrense(aar, plan.region || 'innland');
    if (fs.snitt != null && grense != null) krav({ id: 'fosfor', tema: 'gjodsel', navn: 'Fosfor per daa (snitt over tre år)', hjemmel: HJEMMEL.gjodsel, status: fs.snitt <= grense ? 'ok' : 'mangler', tekst: `${Math.round(fs.snitt * 100) / 100} kg P/daa i snitt – grensen er ${grense} kg P/daa${aar < 2027 ? ' fram til 2027, deretter lavere' : ''}.`, fane: 'skifteplan' });
    const spred = skifteKontroller(S, aar).filter((f) => f.nivaa === 'avvik' && /spred|husdyr/i.test(`${f.tema} ${f.tittel}`));
    krav({ id: 'spredning', tema: 'gjodsel', navn: 'Spredetid og nedmolding av husdyrgjødsel', hjemmel: HJEMMEL.gjodsel, status: spred.length ? 'mangler' : 'ok', tekst: spred.length ? spred.map((f) => f.tittel).join('; ') : 'Ingen avvik i spredetidspunkt i skifteplanen.', fane: 'skifteplan' });
  }
  if (husdyr) {
    const h = husdyrgjodsel(S, aar);
    krav({ id: 'lager', tema: 'gjodsel', navn: 'Lagerkapasitet for husdyrgjødsel (minst 8 måneder)', hjemmel: HJEMMEL.gjodselInfo, status: !h.tonn ? 'mangler' : h.lager == null ? 'mangler' : h.lager >= h.lagerBehov ? 'ok' : 'mangler', tekst: !h.tonn ? 'Registrer årlig mengde husdyrgjødsel under Gård og husdyr.' : h.lager == null ? `Behov ca. ${h.lagerBehov} m³ – registrer lagervolumet.` : `Lager ${h.lager} m³, behov ca. ${h.lagerBehov} m³ (8/12 av ${Math.round(h.tonn)} tonn).`, fane: 'ksl:krav' });
    if (h.tonn && h.grense) krav({ id: 'spredeareal', tema: 'gjodsel', navn: 'Nok spredeareal for fosforet i husdyrgjødsla', hjemmel: HJEMMEL.gjodselInfo, status: h.perDaa != null && h.perDaa <= h.grense ? 'ok' : 'mangler', tekst: h.areal ? `${h.P} kg P på ${h.areal} daa = ${h.perDaa} kg P/daa (grense ${h.grense}). ${h.perDaa > h.grense ? `Trenger ca. ${Math.ceil(h.P / h.grense - h.areal)} daa mer spredeareal (avtale).` : ''}` : 'Ingen skifter med vekst – registrer spredeareal.', fane: 'ksl:krav' });
  }
  // ---------- plantevern ----------
  if (sproyter || kontroll('autorisasjon')?.siste || kontroll('funksjonstest')?.siste) {
    const a = kontroll('autorisasjon'); const f = kontroll('funksjonstest');
    krav({ id: 'autorisasjon', tema: 'plantevern', navn: 'Autorisasjonsbevis for plantevernmidler (10 år)', hjemmel: HJEMMEL.plantevern, status: kStatus(a), tekst: a?.siste ? `Gyldig til ${a.neste}` : 'Registrer autorisasjonsbeviset under KSL › Kontroller.', frist: a?.neste || null, fane: 'ksl:kontroller' });
    krav({ id: 'funksjonstest', tema: 'plantevern', navn: 'Funksjonstest av åkersprøyte (hvert 3. år)', hjemmel: HJEMMEL.plantevern, status: kStatus(f), tekst: f?.siste ? `Neste innen ${f.neste}` : 'Registrer funksjonstesten under KSL › Kontroller.', frist: f?.neste || null, fane: 'ksl:kontroller' });
    const pj = fraBevis('1.5.4'); const kar = fraBevis('1.5.8');
    krav({ id: 'plantevernjournal', tema: 'plantevern', navn: `Plantevernjournal ${aar} (IPV-sjekkliste og sprøytejournal, oppbevares 3 år)`, hjemmel: HJEMMEL.plantevern, status: pj?.status || 'info', tekst: pj?.tekst || '', fane: 'skifteplan' });
    if (kar) krav({ id: 'karens', tema: 'plantevern', navn: 'Behandlingsfrist (karens) før høsting', hjemmel: HJEMMEL.plantevern, status: kar.status, tekst: kar.tekst, fane: 'skifteplan' });
  }
  // ---------- søknader og tilskudd ----------
  if (harJord || husdyr) {
    const sok = g.soknader?.[aar] || {};
    const fristPT = dato(aar, 10, 15);
    const arealer = Object.entries(skifter.reduce((m, s) => { const k = KULTURER[s.vekster?.[aar]?.kultur]?.gruppe || 'ukjent'; m[k] = (m[k] || 0) + (s.areal || 0); return m; }, {})).map(([k, v]) => `${k} ${r1(v)} daa`).join(', ');
    krav({ id: 'pt', tema: 'tilskudd', navn: `Produksjonstilskudd ${aar} (telledato 1. oktober)`, hjemmel: HJEMMEL.pt, status: sok.pt ? 'ok' : idag > dato(aar, 10, 29) ? 'mangler' : 'delvis', tekst: sok.pt ? `Søkt ${sok.pt}.` : `Frist 15. oktober (innsending til 29. oktober gir trekk på 1000 kr per dag). Arealer fra skifteplanen: ${arealer || 'ingen'}.`, frist: fristPT, fane: 'ksl:krav' });
    if (husdyr) krav({ id: 'ptVaar', tema: 'tilskudd', navn: `Produksjonstilskudd del 1 – husdyr (telledato 1. mars ${aar})`, hjemmel: HJEMMEL.pt, status: sok.ptVaar ? 'ok' : idag > dato(aar, 3, 15) ? 'mangler' : 'delvis', tekst: sok.ptVaar ? `Søkt ${sok.ptVaar}.` : 'Husdyrprodusenter leverer del 1 innen 15. mars.', frist: dato(aar, 3, 15), fane: 'ksl:krav' });
    const rmpKand = rmpTiltak(S, aar);
    krav({ id: 'rmp', tema: 'tilskudd', navn: `Regionalt miljøtilskudd (RMP) ${aar}`, hjemmel: HJEMMEL.rmp, status: sok.rmp ? 'ok' : rmpKand.length ? (idag > fristPT ? 'mangler' : 'delvis') : 'info', tekst: sok.rmp ? `Søkt ${sok.rmp}.` : rmpKand.length ? `Mulige tiltak fra skifteplanen: ${rmpKand.map((t) => `${t.navn} (${r1(t.areal)} daa)`).join(', ')}. Frist 15. oktober – vilkårene varierer mellom fylkene.` : 'Ingen RMP-tiltak registrert i skifteplanen (stubb over vinteren, direktesåing, nedfelling av husdyrgjødsel …).', frist: fristPT, fane: 'ksl:krav' });
    for (const sk of skifter.filter((s) => s.drenering?.plan)) {
      const d = sk.drenering; const st = dreneringStatus(d);
      const startet = d.oppstart && d.oppstart <= idag && !d.sokt;
      krav({ id: `drenering-${sk.id}`, tema: 'tilskudd', navn: `Drenering skifte ${sk.nr}: søknad før oppstart`, hjemmel: HJEMMEL.drenering, status: d.status === 'ferdigmeldt' ? 'ok' : startet ? 'mangler' : d.sokt ? (d.utfort && d.status !== 'ferdigmeldt' ? 'delvis' : 'ok') : 'delvis', tekst: d.status === 'ferdigmeldt' ? 'Ferdigmeldt.' : startet ? 'Oppstart er passert uten registrert søknad – det gis ikke tilskudd til påbegynt arbeid.' : d.sokt ? (d.utfort ? `Utført ${d.utfort} – send ferdigmelding med kart over utførte grøfter og kostnader.` : `Søkt ${d.sokt}.`) : `Send søknad med dreneringsplan til kommunen før ${d.oppstart || 'oppstart'}${st?.mangler.length ? ` (mangler ${st.mangler.join(', ')})` : ''}.`, frist: d.sokt ? null : d.oppstart || null, fane: 'skifteplan' });
    }
  }
  // ---------- miljø og vann ----------
  if (harJord) {
    const v = fraBevis('1.10.2');
    if (v) krav({ id: 'vegetasjonssone', tema: 'miljo', navn: 'Vegetasjonssone mot vassdrag (minst 2 m)', hjemmel: HJEMMEL.pt, status: v.status, tekst: v.tekst, fane: 'skifteplan' });
    const ero = skifter.filter((s) => s.vekster?.[aar]?.jordarbeiding === 'hostploying' && (s.jordsmonn?.erosjon?.klasse || 0) >= 3);
    krav({ id: 'erosjon', tema: 'miljo', navn: 'Høstpløying på erosjonsutsatt jord (regionale miljøkrav)', hjemmel: HJEMMEL.regionaleKrav, status: ero.length ? 'delvis' : 'ok', tekst: ero.length ? `Skifte ${ero.map((s) => s.nr).join(', ')} har høy erosjonsrisiko og høstpløying. I vannområder med regionale miljøkrav kan dette være forbudt – sjekk med kommunen.` : 'Ingen høstpløying på arealer i erosjonsklasse 3–4.', fane: 'skifteplan' });
  }
  // ---------- husdyr ----------
  if (husdyr) {
    krav({ id: 'husdyrregister', tema: 'husdyr', navn: 'Husdyrregisteret (fødsler, flytting, slakt – innen 7 dager)', hjemmel: HJEMMEL.husdyrreg, status: g.husdyrregisterBekreftet?.[aar] ? 'ok' : 'delvis', tekst: g.husdyrregisterBekreftet?.[aar] ? `Bekreftet ajour ${g.husdyrregisterBekreftet[aar]}.` : 'Registreres i Husdyrregisteret (Animalia/Mattilsynet). Bekreft at registreringene er ajour.', fane: 'ksl:krav' });
    const lm = (g.legemiddel || []).filter((x) => String(x.dato).startsWith(String(aar)));
    const ufull = lm.filter((x) => !x.dyr || !x.legemiddel || !x.mengde || x.tilbakeholdMelk === undefined && x.tilbakeholdKjott === undefined);
    krav({ id: 'legemiddel', tema: 'husdyr', navn: 'Journal over legemiddelbruk (oppbevares minst 5 år)', hjemmel: HJEMMEL.legemiddel, status: ufull.length ? 'delvis' : lm.length || g.ingenBehandling?.[aar] ? 'ok' : 'delvis', tekst: lm.length ? `${lm.length} behandlinger i ${aar}${ufull.length ? `, ${ufull.length} mangler dyr, legemiddel, mengde eller tilbakeholdstid` : ''}.` : g.ingenBehandling?.[aar] ? `Ingen behandlinger i ${aar}.` : 'Før dato, dyr, legemiddel, mengde, behandlingsdager og tilbakeholdstid for hver behandling.', fane: 'ksl:krav' });
    if (storfe) {
      const uker = beiteUker(S, aar); const krevd = g.husdyr.oppstalling === 'bas' ? (g.husdyr.sone === '5-7' ? 12 : 16) : 8;
      krav({ id: 'beite', tema: 'husdyr', navn: `Beite for storfe (minst ${krevd} uker i sommerhalvåret)`, hjemmel: HJEMMEL.storfe, status: uker == null ? (idag < dato(aar, 10, 1) ? 'delvis' : 'mangler') : uker >= krevd ? 'ok' : 'mangler', tekst: uker == null ? 'Registrer slippdato og innsett for beitesesongen.' : `${uker} uker på beite (${g.beite[aar].slipp} – ${g.beite[aar].inn}).`, fane: 'ksl:krav' });
    }
  }
  // ---------- skog ----------
  for (const b of bestand) {
    const hogd = (b.tiltak || []).filter((t) => t.type === 'sluttavvirkning' && t.status === 'utfort').map((t) => String(t.utfortDato || `${t.aar}-12-31`)).sort().at(-1);
    if (!hogd) continue;
    const forynget = (b.tiltak || []).some((t) => ['planting', 'suppleringsplanting', 'markberedning'].includes(t.type) && t.status === 'utfort' && String(t.utfortDato || `${t.aar}-12-31`) >= hogd) || Number(b.hogstklasse) === 2;
    const frist = dato(Number(hogd.slice(0, 4)) + 3, Number(hogd.slice(5, 7)) || 12, Math.min(28, Number(hogd.slice(8, 10)) || 31));
    krav({ id: `foryngelse-${b.id}`, tema: 'skog', navn: `Foryngelse bestand ${b.nr} (innen 3 år etter hogst)`, hjemmel: HJEMMEL.skog, status: forynget ? 'ok' : idag > frist ? 'mangler' : 'delvis', tekst: forynget ? 'Foryngelsestiltak er registrert etter hogsten.' : `Hogd ${hogd.slice(0, 10)} – planting, markberedning for naturlig foryngelse eller annen foryngelse innen ${frist}.`, frist: forynget ? null : frist, fane: 'tiltak' });
  }
  // ---------- KSL og HMS ----------
  const o = oppsummering(S, aar, idag);
  krav({ id: 'ksl', tema: 'hms', navn: `KSL-egenrevisjon ${aar} (årlig)`, hjemmel: HJEMMEL.ksl, status: o.ferdig ? 'ok' : o.besvart ? 'delvis' : 'mangler', tekst: o.ferdig ? `Fullført ${o.revisjon.dato}.` : `${o.besvart} av ${o.totalt} spørsmål besvart.`, frist: kontroll('egenrevisjon')?.neste || dato(aar, 12, 31), fane: 'ksl:revisjon' });
  const forfalt = ks.filter((k) => k.siste && k.status === 'forfalt'); const snart = ks.filter((k) => k.siste && k.status === 'snart');
  krav({ id: 'kontroller', tema: 'hms', navn: 'Periodiske kontroller (vernerunde, el, brann, gjødsellager …)', hjemmel: HJEMMEL.internkontroll, status: forfalt.length ? 'mangler' : snart.length ? 'delvis' : ks.some((k) => k.siste) ? 'ok' : 'mangler', tekst: forfalt.length ? `Forfalt: ${forfalt.map((k) => k.navn).join(', ')}.` : snart.length ? `Forfaller snart: ${snart.map((k) => `${k.navn} (${k.neste})`).join(', ')}.` : ks.some((k) => k.siste) ? 'Alle registrerte kontroller er innenfor fristen.' : 'Ingen kontroller registrert.', frist: [...snart, ...forfalt].map((k) => k.neste).sort()[0] || null, fane: 'ksl:kontroller' });
  krav({ id: 'avvik', tema: 'hms', navn: 'Avvik lukket innen fristen', hjemmel: HJEMMEL.ksl, status: o.forfalteAvvik.length ? 'mangler' : o.apneAvvik.length ? 'delvis' : 'ok', tekst: `${o.apneAvvik.length} åpne avvik${o.forfalteAvvik.length ? `, ${o.forfalteAvvik.length} forfalt` : ''}.`, fane: 'ksl:avvik' });
  const rang = { mangler: 0, delvis: 1, info: 2, ok: 3, ia: 4 };
  return ut.sort((a, b) => rang[a.status] - rang[b.status] || Object.keys(TEMA).indexOf(a.tema) - Object.keys(TEMA).indexOf(b.tema));
}

// Tiltak i skifteplanen som kan gi regionalt miljøtilskudd (forslag – vilkårene varierer mellom fylkene).
export function rmpTiltak(S, aar) {
  const plan = S.skifteplan; if (!plan) return [];
  const t = { stubb: { navn: 'Ingen jordarbeiding om høsten', areal: 0 }, direktesaaing: { navn: 'Direktesåing', areal: 0 }, nedfelt: { navn: 'Miljøvennlig spredning av husdyrgjødsel (nedfelling)', areal: 0 } };
  for (const sk of plan.skifter) {
    const v = sk.vekster?.[aar] || {};
    if (v.jordarbeiding === 'stubb') t.stubb.areal += sk.areal || 0;
    if (v.jordarbeiding === 'direktesaaing') t.direktesaaing.areal += sk.areal || 0;
    if ((sk.gjodsling || []).some((x) => Number(x.aar) === aar && x.type === 'husdyr' && x.spredemaate === 'nedfelt')) t.nedfelt.areal += sk.areal || 0;
  }
  return Object.entries(t).filter(([, x]) => x.areal > 0).map(([id, x]) => ({ id, ...x }));
}

// Frister de neste 12 månedene, sortert (årshjul).
export function aarshjul(S, aar, idag = new Date().toISOString().slice(0, 10)) {
  const k = vurderKrav(S, aar, idag); const g = sikreGard(S); const til = dato(Number(idag.slice(0, 4)) + 1, Number(idag.slice(5, 7)), Number(idag.slice(8, 10)));
  const ut = k.filter((x) => x.frist && x.frist >= idag && x.frist <= til && x.status !== 'ok').map((x) => ({ dato: x.frist, navn: x.navn, status: x.status, id: x.id, fane: x.fane }));
  const fast = [[3, 15, 'Produksjonstilskudd del 1 (husdyr)', (g.husdyr.typer || []).length > 0], [4, 1, 'Gjødslingsplan klar før vekstsesongen', !!S.skifteplan?.skifter?.length], [10, 15, 'Produksjonstilskudd og RMP', !!S.skifteplan?.skifter?.length || (g.husdyr.typer || []).length > 0]];
  for (const [m, d, navn, ja] of fast) { if (!ja) continue; const x = nesteAarlig(idag, m, d); if (!ut.some((u) => u.dato === x && u.navn.startsWith(navn.split(' ')[0]))) ut.push({ dato: x, navn, status: 'info' }); }
  return ut.sort((a, b) => a.dato.localeCompare(b.dato)).map((x) => ({ ...x, dagerIgjen: dager(x.dato, idag) }));
}
export const arealtypeTekst = (sk) => AR5_JORDBRUK[sk.artype] || '';
