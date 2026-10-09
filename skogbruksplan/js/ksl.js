// KSL (Kvalitetssystem i landbruket): egenrevisjon etter KSL-standarden, avvikslogg, periodiske kontroller med frister,
// dokumentarkiv og automatisk dokumentasjon fra resten av planen (skifteplan, gjødslingsplan, sprøytejournal,
// kulturminner). Ingen DOM – kan testes i Node. Kravpunktene ligger i ksl-standard.js.
import { KSL_KAPITLER } from './ksl-standard.js';
import { aktiveSkifter, kontroller as skifteKontroller, avstandTilVann, IPV } from './skifteplan.js';

export { KSL_KAPITLER };
export const KSL_KILDER = {
  standard: { navn: 'KSL-standarden – sjekklister og veiledere (Stiftelsen Norsk Mat)', url: 'https://www.ksl.no/ksl-standarden/' },
  egenrevisjon: { navn: 'KSL egenrevisjon på nett', url: 'https://www.ksl.no/' },
};
export const SVAR = { ja: 'Ja', nei: 'Nei', ia: 'Ikke aktuelt' };

const sporsmalMap = new Map(KSL_KAPITLER.flatMap((k) => k.sporsmal.map((q) => [q.nr, { ...q, kapittel: k.nr }])));
export const sporsmal = (nr) => sporsmalMap.get(nr) || null;
export const kapittelFor = (nr) => KSL_KAPITLER.find((k) => k.nr === Number(String(nr).split('.')[0])) || null;

// Periodiske kontroller med intervall i måneder og hvilke KSL-punkt de dokumenterer.
export const KONTROLLTYPER = {
  egenrevisjon: { navn: 'KSL-egenrevisjon', mnd: 12, ksl: [], hint: 'Årlig, maks 12 måneder mellom hver.' },
  vernerunde: { navn: 'Vernerunde', mnd: 12, ksl: ['10.2.1'], hint: 'Hvilke punkt som er sjekket og avvik som ble funnet.' },
  elkontroll: { navn: 'Egenkontroll av elektrisk anlegg', mnd: 12, ksl: ['10.7.1'] },
  termografering: { navn: 'Termografering av el-anlegg', mnd: 36, ksl: ['10.6.1'], hint: 'Bygg med husdyr, varmluftstørke eller høy forsikringssum.' },
  brannalarmEgen: { navn: 'Brannalarm – månedlig egenkontroll', mnd: 1, ksl: ['10.6.10'] },
  brannalarmPeriodisk: { navn: 'Brannalarm – årlig kontroll', mnd: 12, ksl: ['10.6.11'] },
  brannslokker: { navn: 'Brannslokkingsutstyr – kontroll', mnd: 12, ksl: ['10.6.5'] },
  tanker: { navn: 'Tanker for drivstoff og gass', mnd: 12, ksl: ['10.6.7'] },
  gjodsellager: { navn: 'Gjødsellager', mnd: 12, ksl: ['1.3.5'] },
  funksjonstest: { navn: 'Funksjonstest av åkersprøyte', mnd: 36, ksl: ['1.5.7', '1.1.5'] },
  sakkyndig: { navn: 'Sakkyndig kontroll av arbeidsutstyr (truck, løfteutstyr, minilaster)', mnd: 12, ksl: ['1.1.5'] },
  autorisasjon: { navn: 'Autorisasjonsbevis for plantevernmidler', mnd: 120, ksl: ['1.5.1'], hint: 'Gyldig i 10 år.' },
  varmeArbeider: { navn: 'Sertifikat for varme arbeider', mnd: 60, ksl: ['10.6.2'], hint: 'Kurs og slokkeøvelse hvert 5. år.' },
  hmsOpplaering: { navn: 'HMS-opplæring for arbeidsgiver', mnd: null, ksl: ['10.8.1'] },
  forstehjelp: { navn: 'Førstehjelpskurs', mnd: 36, ksl: ['10.12.3'] },
};

// Dokumenttyper i arkivet, med KSL-punkt de vanligvis dokumenterer.
export const DOKUMENTTYPER = {
  kjopSalg: { navn: 'Kjøp og salg (bilag, leverandører, kunder)', ksl: ['1.1.1'] },
  tilbakekalling: { navn: 'Plan for tilbakekalling', ksl: ['1.1.2'] },
  analyse: { navn: 'Analyseresultat (jord, fôr, vann)', ksl: ['1.1.4', '1.2.1'] },
  vedtak: { navn: 'Vedtak / brev fra myndigheter eller varemottaker', ksl: ['1.1.4'] },
  gjodslingsplan: { navn: 'Gjødslingsplan med skiftekart', ksl: ['1.2.2'] },
  sertifikat: { navn: 'Sertifikat / kontrollrapport for utstyr', ksl: ['1.1.5', '1.5.7'] },
  autorisasjon: { navn: 'Autorisasjonsbevis plantevernmidler', ksl: ['1.5.1'] },
  avfallsplan: { navn: 'Avfallshåndteringsplan', ksl: ['1.7.3'] },
  skadedyr: { navn: 'Skadedyrplan / åtestasjoner', ksl: ['1.8.1', '1.8.2'] },
  hydroteknisk: { navn: 'Plan for hydrotekniske anlegg', ksl: ['1.9.1'] },
  hmsMal: { navn: 'HMS-mål og organisering', ksl: ['10.1.1'] },
  vernerunde: { navn: 'Vernerundeskjema', ksl: ['10.2.1'] },
  risikovurdering: { navn: 'Risikovurdering av arbeidsoppgaver', ksl: ['10.3.1', '10.5.2', '10.9.3'] },
  datablad: { navn: 'Sikkerhetsdatablad', ksl: ['10.4.3'] },
  opplaering: { navn: 'Dokumentert opplæring', ksl: ['10.8.1', '10.8.2'] },
  arbeidsavtale: { navn: 'Arbeidsavtale / timelister', ksl: ['10.9.4', '10.9.8'] },
  forsikring: { navn: 'Yrkesskadeforsikring', ksl: ['10.9.10'] },
  beredskap: { navn: 'Beredskapsplan', ksl: ['10.12.1'] },
  savare: { navn: 'Såvare (art, sort, partinummer)', ksl: ['15.1.1', '1.1.3'] },
  annet: { navn: 'Annet', ksl: [] },
};

export function tomKsl() {
  return { kapitler: [1, 10], revisjoner: [], avvik: [], kontroller: [], dokumenter: [], ansvarlig: '' };
}
export function sikreKsl(S) {
  S.ksl = { ...tomKsl(), ...(S.ksl || {}) };
  if (!S.ksl.kapitler.includes(15) && S.skifteplan?.skifter?.length && !S.ksl.kapitlerValgt) S.ksl.kapitler = [...S.ksl.kapitler, 15];
  return S.ksl;
}

const dato = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`) : null);
export function leggTilMnd(d, mnd) {
  const x = dato(d); if (!x || !mnd) return null;
  const dag = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + mnd);
  x.setDate(Math.min(dag, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()));
  return x.toISOString().slice(0, 10);
}
const dagerTil = (d, idag) => Math.round((dato(d) - dato(idag)) / 86400000);

// Egenrevisjonen for et år (lages ved behov).
export function revisjon(ksl, aar, { nyId } = {}) {
  let r = ksl.revisjoner.find((x) => x.aar === aar);
  if (!r && nyId) { r = { id: nyId('kr'), aar, svar: {}, dato: null, utfortAv: '', ferdig: false }; ksl.revisjoner.push(r); }
  return r || null;
}

// Svarer på et spørsmål. «Nei» oppretter et åpent avvik for punktet (om det ikke finnes); «Ja»/«Ikke aktuelt» endrer ikke avvik.
export function settSvar(ksl, r, nr, svar, { nyId, idag = new Date().toISOString().slice(0, 10) } = {}) {
  r.svar[nr] = { ...(r.svar[nr] || {}), svar };
  if (svar === 'nei' && !ksl.avvik.some((a) => a.ksl === nr && !a.lukket)) {
    const q = sporsmal(nr);
    ksl.avvik.push({ id: nyId('ka'), ksl: nr, beskrivelse: q ? q.tekst : '', tiltak: '', ansvarlig: ksl.ansvarlig || '', frist: leggTilMnd(idag, 1), opprettet: idag, lukket: null, kilde: 'egenrevisjon' });
  }
}

// Siste kontroll av hver type og neste frist.
export function kontrollStatus(ksl, idag = new Date().toISOString().slice(0, 10)) {
  return Object.entries(KONTROLLTYPER).map(([type, t]) => {
    const liste = ksl.kontroller.filter((k) => k.type === type).sort((a, b) => String(b.dato).localeCompare(String(a.dato)));
    const siste = liste[0] || null;
    const neste = siste ? (siste.gyldigTil || leggTilMnd(siste.dato, t.mnd)) : null;
    const dager = neste ? dagerTil(neste, idag) : null;
    const status = !siste ? 'mangler' : dager === null ? 'ok' : dager < 0 ? 'forfalt' : dager <= Math.min(60, (t.mnd || 12) * 30 * 0.25) ? 'snart' : 'ok';
    return { type, ...t, siste, neste, dager, status, antall: liste.length };
  });
}

// Dokumentasjon som allerede finnes i planen for et KSL-punkt. Gir { status: 'ok'|'delvis'|'mangler', tekst, fane } eller null.
export function appBevis(S, nr, aar, idag = new Date().toISOString().slice(0, 10)) {
  const sp = S.skifteplan; const skifter = sp?.skifter || [];
  const aktive = sp ? aktiveSkifter(sp, aar) : [];
  const ksl = S.ksl || tomKsl();
  const kontroll = (type) => kontrollStatus(ksl, idag).find((k) => k.type === type);
  const fraKontroll = (type) => { const k = kontroll(type); if (!k?.siste) return { status: 'mangler', tekst: `Ingen registrert ${k.navn.toLowerCase()}`, fane: 'ksl:kontroller' }; return { status: k.status === 'forfalt' ? 'mangler' : 'ok', tekst: `${k.navn}: ${k.siste.dato}${k.neste ? `, neste ${k.neste}` : ''}${k.status === 'forfalt' ? ' (forfalt)' : ''}`, fane: 'ksl:kontroller' }; };
  const funn = sp ? skifteKontroller(S, aar) : [];
  // Skifter finnes, men ingen har vekst for året: gjødslingsplanen er ikke fylt ut.
  const utenVekst = skifter.length && !aktive.length && ['1.1.3', '1.2.1', '1.2.2', '1.2.3', '1.10.2'].includes(nr);
  if (utenVekst) return { status: 'mangler', tekst: `Ingen av ${skifter.length} skifter har vekst for ${aar} – fyll ut skifteplanen`, fane: 'skifteplan' };
  switch (nr) {
    case '1.1.3': {
      if (!skifter.length) return null;
      const reg = aktive.filter((s) => (s.gjodsling || []).some((g) => Number(g.aar) === aar) || (sp.sproyting || []).some((x) => String(x.dato).startsWith(String(aar)) && x.skifter?.includes(s.id)));
      return { status: reg.length === aktive.length && aktive.length ? 'ok' : reg.length ? 'delvis' : 'mangler', tekst: `Skifteregistrering ${aar}: ${reg.length} av ${aktive.length} skifter har registrerte tiltak`, fane: 'skifteplan' };
    }
    case '1.2.1': {
      if (!skifter.length) return null;
      const gamle = aktive.filter((s) => { const a = Number(String(s.jordprove?.dato || '').slice(0, 4)); return !a || aar - a > 8; });
      return { status: gamle.length ? (gamle.length === aktive.length ? 'mangler' : 'delvis') : 'ok', tekst: gamle.length ? `${gamle.length} av ${aktive.length} skifter mangler jordprøve eller har prøve eldre enn 8 år` : `Jordprøver på alle ${aktive.length} skifter, maks 8 år gamle`, fane: 'skifteplan' };
    }
    case '1.2.2': {
      if (!skifter.length) return null;
      const utenVekst = aktive.filter((s) => !s.vekster?.[aar]?.kultur);
      const utenPlan = aktive.filter((s) => !(s.gjodsling || []).some((g) => Number(g.aar) === aar) && s.vekster?.[aar]?.kultur);
      const ok = !utenVekst.length && !utenPlan.length && aktive.length;
      return { status: ok ? 'ok' : aktive.length - utenVekst.length - utenPlan.length > 0 ? 'delvis' : 'mangler', tekst: ok ? `Gjødslingsplan ${aar} med skiftekart for ${aktive.length} skifter` : `Gjødslingsplan ${aar}: ${utenVekst.length} skifter uten vekst, ${utenPlan.length} uten planlagt gjødsling`, fane: 'skifteplan' };
    }
    case '1.2.3': {
      if (!skifter.length) return null;
      const g = aktive.flatMap((s) => (s.gjodsling || []).filter((x) => Number(x.aar) === aar));
      const utfort = g.filter((x) => x.status === 'utfort' && x.dato && x.mengde);
      return { status: utfort.length ? (utfort.length === g.length ? 'ok' : 'delvis') : 'mangler', tekst: `Gjødseljournal ${aar}: ${utfort.length} av ${g.length} gjødslinger registrert utført med dato og mengde`, fane: 'skifteplan' };
    }
    case '1.3.2': {
      if (!skifter.length) return null;
      const avvik = funn.filter((f) => f.nivaa === 'avvik' && /spred|husdyr/i.test(`${f.tema} ${f.tittel}`));
      return { status: avvik.length ? 'mangler' : 'ok', tekst: avvik.length ? `${avvik.length} avvik i spredning av husdyrgjødsel` : 'Ingen avvik i spredetidspunkt for husdyrgjødsel i skifteplanen', fane: 'skifteplan' };
    }
    case '1.3.5': return fraKontroll('gjodsellager');
    case '1.1.5': { const a = kontroll('sakkyndig'); const b = kontroll('funksjonstest'); if (!a.siste && !b.siste) return { status: 'mangler', tekst: 'Ingen registrert sakkyndig kontroll eller funksjonstest', fane: 'ksl:kontroller' }; return fraKontroll(a.siste ? 'sakkyndig' : 'funksjonstest'); }
    case '1.5.1': return fraKontroll('autorisasjon');
    case '1.5.4': {
      const spr = (sp?.sproyting || []).filter((x) => String(x.dato).startsWith(String(aar)));
      if (!spr.length) return sp ? { status: 'ok', tekst: `Ingen sprøyting registrert i ${aar}`, fane: 'skifteplan' } : null;
      const ipv = Object.keys(sp.ipv?.[aar] || {}).length;
      const mangler = spr.filter((x) => !x.preparat || !x.dose || !x.skadegjorer || !x.skifter?.length).length;
      return { status: ipv >= IPV.length && !mangler ? 'ok' : 'delvis', tekst: `Sprøytejournal ${aar}: ${spr.length} behandlinger${mangler ? `, ${mangler} ufullstendige` : ''}. IPV-sjekkliste ${ipv} av ${IPV.length}`, fane: 'skifteplan' };
    }
    case '1.5.7': return fraKontroll('funksjonstest');
    case '1.5.8': {
      const spr = (sp?.sproyting || []).filter((x) => String(x.dato).startsWith(String(aar)));
      if (!spr.length) return null;
      const uten = spr.filter((x) => !Number(x.karens)).length;
      return { status: uten ? 'delvis' : 'ok', tekst: uten ? `${uten} av ${spr.length} sprøytinger mangler behandlingsfrist` : `Behandlingsfrist og tidligste høsting registrert for ${spr.length} sprøytinger`, fane: 'skifteplan' };
    }
    case '1.10.1': {
      const km = (S.pefc?.objekter || []).filter((o) => o.type === 'kulturminne');
      if (!skifter.length && !km.length) return null;
      return { status: 'ok', tekst: km.length ? `${km.length} kulturminner fra Riksantikvaren vises i kartet og på skiftekartet` : 'Ingen registrerte kulturminner fra Riksantikvaren på eiendommen', fane: 'pefc' };
    }
    case '1.10.2': {
      if (!skifter.length) return null;
      const naer = aktive.map((s) => ({ s, d: avstandTilVann(s, S) })).filter((x) => x.d != null && x.d < 10);
      return { status: naer.length ? 'delvis' : 'ok', tekst: naer.length ? `${naer.length} skifter ligger under 10 m fra vann (AR5) – kontroller vegetasjonssonen på minst 2 m` : 'Ingen skifter nærmere vann enn 10 m (AR5)', fane: 'skifteplan' };
    }
    case '10.2.1': return fraKontroll('vernerunde');
    case '10.6.1': return fraKontroll('termografering');
    case '10.6.2': return fraKontroll('varmeArbeider');
    case '10.6.5': return fraKontroll('brannslokker');
    case '10.6.7': return fraKontroll('tanker');
    case '10.6.10': return fraKontroll('brannalarmEgen');
    case '10.6.11': return fraKontroll('brannalarmPeriodisk');
    case '10.7.1': return fraKontroll('elkontroll');
    case '10.1.2': { const n = ksl.avvik.length; return { status: 'ok', tekst: `Avvikssystem i SkogIQ: ${n} avvik registrert, ${ksl.avvik.filter((a) => !a.lukket).length} åpne`, fane: 'ksl:avvik' }; }
    default: return null;
  }
}

// Dokumenter i arkivet som dekker et punkt (direkte koblet, eller via dokumenttypen), og som ikke er utløpt.
export function dokumenterFor(ksl, nr, idag = new Date().toISOString().slice(0, 10)) {
  return ksl.dokumenter.filter((d) => (d.ksl?.includes(nr) || DOKUMENTTYPER[d.type]?.ksl.includes(nr)) && (!d.gyldigTil || d.gyldigTil >= idag));
}

// Status for alle spørsmål i de valgte kapitlene.
export function vurdering(S, aar, idag = new Date().toISOString().slice(0, 10)) {
  const ksl = sikreKsl(S); const r = revisjon(ksl, aar);
  const ut = [];
  for (const k of KSL_KAPITLER.filter((x) => ksl.kapitler.includes(x.nr))) {
    for (const q of k.sporsmal) {
      const svar = r?.svar?.[q.nr]?.svar || null;
      const bevis = appBevis(S, q.nr, aar, idag);
      const dok = dokumenterFor(ksl, q.nr, idag);
      const dokumentert = !q.dok || svar === 'ia' || dok.length > 0 || bevis?.status === 'ok';
      ut.push({ ...q, kapittel: k.nr, svar, kommentar: r?.svar?.[q.nr]?.kommentar || '', bevis, dokumenter: dok, dokumentert });
    }
  }
  return ut;
}

export function oppsummering(S, aar, idag = new Date().toISOString().slice(0, 10)) {
  const v = vurdering(S, aar, idag); const ksl = S.ksl;
  const r = revisjon(ksl, aar);
  const kontroller = kontrollStatus(ksl, idag);
  const sisteFerdig = ksl.revisjoner.filter((x) => x.ferdig && x.dato).sort((a, b) => String(b.dato).localeCompare(String(a.dato)))[0] || null;
  const nesteRevisjon = sisteFerdig ? leggTilMnd(sisteFerdig.dato, 12) : null;
  return {
    totalt: v.length, besvart: v.filter((q) => q.svar).length,
    ja: v.filter((q) => q.svar === 'ja').length, nei: v.filter((q) => q.svar === 'nei').length, ia: v.filter((q) => q.svar === 'ia').length,
    dokKrav: v.filter((q) => q.dok && q.svar !== 'ia').length, dokMangler: v.filter((q) => !q.dokumentert),
    apneAvvik: ksl.avvik.filter((a) => !a.lukket), forfalteAvvik: ksl.avvik.filter((a) => !a.lukket && a.frist && a.frist < idag),
    kontrollerForfalt: kontroller.filter((k) => k.status === 'forfalt'), kontrollerSnart: kontroller.filter((k) => k.status === 'snart'),
    revisjon: r, ferdig: !!r?.ferdig, sisteFerdig, nesteRevisjon, revisjonForfalt: !sisteFerdig || nesteRevisjon < idag,
  };
}

// Varsler til Innsikt.
export function kslVarsler(S, aar, idag = new Date().toISOString().slice(0, 10)) {
  if (!S.ksl) return [];
  const o = oppsummering(S, aar, idag); const ut = [];
  if (o.revisjonForfalt) ut.push({ nivaa: 'handling', tittel: o.sisteFerdig ? `KSL-egenrevisjonen er forfalt (siste ${o.sisteFerdig.dato})` : 'KSL-egenrevisjon er ikke gjennomført', tekst: 'Egenrevisjon skal gjøres årlig, med maks 12 måneder mellom hver.' });
  if (o.forfalteAvvik.length) ut.push({ nivaa: 'handling', tittel: `${o.forfalteAvvik.length} KSL-avvik har passert fristen`, tekst: o.forfalteAvvik.slice(0, 3).map((a) => `${a.ksl}: ${a.beskrivelse}`).join(' · ') });
  if (o.kontrollerForfalt.length) ut.push({ nivaa: 'advarsel', tittel: `${o.kontrollerForfalt.length} KSL-kontroller er forfalt`, tekst: o.kontrollerForfalt.map((k) => k.navn).join(', ') });
  if (o.dokMangler.length) ut.push({ nivaa: 'advarsel', tittel: `${o.dokMangler.length} KSL-punkter mangler dokumentasjon`, tekst: o.dokMangler.slice(0, 4).map((q) => q.nr).join(', ') + (o.dokMangler.length > 4 ? ' …' : '') });
  return ut;
}

// Fullfører egenrevisjonen hvis alle spørsmål i de valgte kapitlene er besvart.
export function fullfor(S, aar, { dato: d, utfortAv = '', nyId } = {}) {
  const ksl = sikreKsl(S); const r = revisjon(ksl, aar, { nyId });
  const mangler = vurdering(S, aar).filter((q) => !q.svar);
  if (mangler.length) return { ok: false, mangler };
  r.ferdig = true; r.dato = d; r.utfortAv = utfortAv; r.kapitler = [...ksl.kapitler];
  ksl.kontroller.push({ id: nyId('kk'), type: 'egenrevisjon', dato: d, utfortAv, merknad: `Kapittel ${ksl.kapitler.join(', ')}` });
  return { ok: true, mangler: [] };
}
