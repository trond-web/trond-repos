// 🧑‍🌾 SkogIQ-lederen i den virtuelle skogen (skog3d-leder.js): svar på spørsmål om stedet du står.
//   * Uten AI-nøkkel (eller uten nett): regelbaserte svar fra planens data for bestandet du står i – hva som står
//     her, hogst, tynning/ungskogpleie, verdi, tiltak, miljø, terreng og kjøring.
//   * Med AI-nøkkel (samme som «Spør AI», js/assistent.js): frie spørsmål besvares av Claude med planens data og
//     stedet du står som grunnlag – korte svar som kan leses opp.
// Ingen DOM – testes i Node (unntatt AI-kallet).
import { TRESLAG, HK_ROMERTALL, TILTAKSTYPER, startTilstand, laavesteHogstalder, hogstklasseFor, rotnettoPerM3, STANDARD_INNSTILLINGER } from './model.js';
import { harKantsone, kantsoneTekst } from './kantsone.js';
import { vurderTynning, vurderUngskog, bestandSomFlate, SKJOTSEL_KRITERIER } from './skjotsel.js';

export const FORSLAG = [
  'Hva står jeg i?',
  'Når kan dette hogges?',
  'Trenger det tynning eller ungskogpleie?',
  'Hva er tømmeret her verdt?',
  'Hvilke tiltak er planlagt her?',
  'Er det miljøhensyn jeg må ta?',
  'Kan jeg kjøre med maskin her?',
];

const tall = (v, d = 0) => Number(v || 0).toLocaleString('nb-NO', { maximumFractionDigits: d });
const ts = (t) => ({ G: 'gran', F: 'furu', L: 'lauv' }[t] || 'skog');

// sted = { b (bestand i planen) | null, flate: { kategori, beskrivelse } (markslag uten skog) | null, nabo (skog utenfor
// planen), helning (%) | null, fukt: { kort, navn, drift } | null, S, inn, iAar }
function beskriv(sted) {
  const { b, inn } = sted; const st = startTilstand(b); const hk = hogstklasseFor(b, inn);
  return `Du står i bestand ${b.nr}: ${ts(b.treslag)} på bonitet ${b.bonitet ?? 'ukjent'}, hogstklasse ${HK_ROMERTALL[hk] || 'ukjent'}, ca. ${Math.round(st.alder)} år og ${tall(st.volumDaa)} kubikk per dekar på ${tall(b.areal, 1)} dekar – ca. ${tall(st.volumDaa * (b.areal || 0))} kubikk i alt.`;
}
function hogst(sted) {
  const { b, inn, iAar } = sted; const st = startTilstand(b); const min = laavesteHogstalder(b, inn);
  if (!min) return 'Jeg mangler bonitet eller treslag for å si når bestandet kan hogges.';
  if (st.alder >= min) return `Bestandet er hogstmodent: ${Math.round(st.alder)} år, og laveste hogstalder for ${ts(b.treslag)} på bonitet ${b.bonitet} er ${min} år. ${(b.tiltak || []).some((t) => t.type === 'sluttavvirkning' && t.status !== 'utfort') ? 'Hogst er allerede planlagt.' : 'Hogst er ikke planlagt ennå – vurder det i tiltaksplanen.'}`;
  return `Ikke ennå. Bestandet er ${Math.round(st.alder)} år, og laveste hogstalder er ${min} år – tidligst rundt ${iAar + Math.ceil(min - st.alder)}.`;
}
function skjotsel(sted) {
  const { b, inn } = sted; const f = bestandSomFlate(b, inn); const k = SKJOTSEL_KRITERIER;
  if (f.hk === 2) { const u = vurderUngskog(f, k); return u ? `Ja, trolig ungskogpleie: ${u.grunn.replace(/^Ungskog /, 'ungskogen er ')}. Pleie nå gir bedre kvalitet og tilvekst senere.` : 'Ungskogen ser ikke ut til å trenge pleie nå, ut fra dataene. Sjekk gjerne tettheten i felt.'; }
  if (f.hk === 3 || f.hk === 4) { const t = vurderTynning(f, k, inn, { hk: f.hk }); return t ? `Ja, trolig ${t.metode.toLowerCase()}: ${t.grunn}. Uttaket blir ca. ${tall(t.uttakM3)} kubikk.` : 'Tynning ser ikke ut til å være nødvendig her – skogen er ikke tett nok, for høy eller på for lav bonitet.'; }
  if (f.hk === 5) return 'Bestandet er hogstmodent, så tynning er ikke aktuelt lenger. Neste steg er hogst og ny foryngelse.';
  return 'Dette er skog under fornying. Det viktigste nå er god foryngelse – planting eller naturlig foryngelse.';
}
function verdi(sted) {
  const { b, inn } = sted; const st = startTilstand(b); const m3 = st.volumDaa * (b.areal || 0); const kr = m3 * rotnettoPerM3(b, inn);
  return `Det står ca. ${tall(m3)} kubikk her. Med dagens priser og driftskostnader gir det ca. ${tall(Math.round(kr / 1000) * 1000)} kroner i rotnetto ved hogst – ${tall(rotnettoPerM3(b, inn))} kroner per kubikk.`;
}
function tiltak(sted) {
  const l = (sted.b.tiltak || []).filter((t) => t.status !== 'utfort').sort((a, b2) => (a.aar ?? 0) - (b2.aar ?? 0));
  if (!l.length) return 'Det er ingen planlagte tiltak i dette bestandet.';
  return `Planlagt her: ${l.slice(0, 4).map((t) => `${(TILTAKSTYPER[t.type]?.navn || t.type).toLowerCase()} ${t.aar ?? ''}`.trim()).join(', ')}.`;
}
function miljo(sted) {
  const { b } = sted; const d = [];
  if (b.miljo) d.push('bestandet er en miljøfigur som skal tas hensyn til');
  if (harKantsone(b)) d.push(`${kantsoneTekst(b)} – kantsonen skal være flersjiktet og stort sett urørt`);
  if ((sted.S?.pefc?.objekter || []).some((o) => o.bestandId === b.id)) d.push('det er registrert miljøobjekter her');
  return d.length ? `Ja: ${d.join('; ')}.` : 'Jeg finner ingen registrerte miljøhensyn i akkurat dette bestandet. Følg alltid PEFC-standarden og se etter spor av sjeldne arter.';
}
function terreng(sted) {
  const d = [];
  if (sted.helning != null) d.push(sted.helning >= 50 ? `Det er svært bratt her, ${Math.round(sted.helning)} prosent – vanlige maskiner kommer ikke fram` : sted.helning >= 33 ? `Det er bratt, ${Math.round(sted.helning)} prosent – krever spesialutstyr eller tau` : `Helningen er ${Math.round(sted.helning)} prosent – greit for vanlige maskiner`);
  if (sted.fukt) d.push(`Markfuktighet: ${sted.fukt.navn.toLowerCase()}. ${sted.fukt.drift || ''}`.trim());
  return d.length ? `${d.join('. ')}.`.replace('..', '.') : 'Jeg har ikke terrengdata akkurat her.';
}

const REGLER = [
  [/tynn|ungskog|rydd|pleie|skjøtsel/i, skjotsel],
  [/hogst|hogge|hogg|moden|avvirk|felle/i, hogst],
  [/verdi|verd|penger|kroner|pris|tømmer|netto/i, verdi],
  [/tiltak|planlagt|gjøre|plan/i, tiltak],
  [/miljø|kantsone|bekk|vann|natur|art|pefc|hensyn/i, miljo],
  [/bratt|kjør|maskin|drift|vått|fukt|myr|terreng/i, terreng],
  [/står|hvor|bestand|hva er dette|treslag|alder|volum|bonitet|gammel/i, beskriv],
];

// Lokalt, regelbasert svar. Gir { tekst, regel } – regel = hvilken regel som svarte (null = oversikt).
export function lokaltSvar(sporsmal, sted) {
  if (!sted?.b) {
    if (sted?.nabo) return { tekst: 'Du står i skog utenfor planen. Jeg har bare et generelt anslag her – gå inn i et av bestandene i planen, så kan jeg si mer.', regel: null };
    if (sted?.flate) return { tekst: `Her er det ${String(sted.flate.beskrivelse || sted.flate.kategori || 'mark uten skog').toLowerCase()}. Gå inn i et bestand, så forteller jeg om skogen. ${sted.helning != null || sted.fukt ? terreng(sted) : ''}`.trim(), regel: null };
    return { tekst: 'Du står utenfor bestandene. Gå inn i et bestand, så forteller jeg om skogen der.', regel: null };
  }
  const r = REGLER.find(([re]) => re.test(sporsmal || ''));
  if (r) return { tekst: r[1](sted), regel: r[1].name };
  return { tekst: `${beskriv(sted)} Spør meg gjerne om hogst, tynning, verdi, tiltak, miljø eller kjøring.`, regel: null };
}

// Kort tekst om stedet til AI-en.
export function stedTekst(sted) {
  const linjer = [];
  if (sted?.b) {
    const b = sted.b; const st = startTilstand(b);
    linjer.push(`Brukeren står i bestand ${b.nr} (${TRESLAG[b.treslag] || b.treslag}, bonitet ${b.bonitet ?? '?'}, HK ${HK_ROMERTALL[hogstklasseFor(b, sted.inn)] || '?'}, ${Math.round(st.alder)} år, ${tall(st.volumDaa)} m³/daa, ${tall(b.areal, 1)} daa).`);
  } else if (sted?.nabo) linjer.push('Brukeren står i skog utenfor planen (bare generelt anslag).');
  else if (sted?.flate) linjer.push(`Brukeren står på ${sted.flate.beskrivelse || sted.flate.kategori} (uten skog).`);
  else linjer.push('Brukeren står utenfor bestandene i planen.');
  if (sted?.helning != null) linjer.push(`Helning der brukeren står: ${Math.round(sted.helning)} %.`);
  if (sted?.fukt) linjer.push(`Markfuktighet: ${sted.fukt.navn}.`);
  return linjer.join(' ');
}

export const SYSTEM = `Du er SkogIQ-lederen: en erfaren, vennlig norsk skogbruksleder som går sammen med skogeieren i en virtuell skog laget av skogbruksplanen. Du får planens data i <plandata> og stedet brukeren står i <sted>.

Svarene leses opp og vises på en liten tavle i VR-briller:
- Svar på norsk bokmål, muntlig og kort: høyst tre korte setninger (omtrent 60 ord).
- Ingen punktlister, tabeller, overskrifter, markdown eller emojier. Skriv tall slik de uttales naturlig (f.eks. «ca. 450 kubikk»).
- Svar om stedet brukeren står når spørsmålet gjelder «her», «dette» eller er uklart; ellers om eiendommen.
- Bygg på dataene. Si fra kort når noe er usikkert (SR16, modeller) eller bør sjekkes i felt.
- Følg Norsk PEFC Skogstandard og vanlig norsk skogbrukspraksis.`;

// AI-svar (Claude) med strømming: kaller del(tekstSåLangt) underveis og gir hele svaret. Kaster ved feil.
// klient = Anthropic-klient (assistent.js: lastSdk), kontekst = lagKontekst(S, …), historikk = tidligere meldinger.
export async function aiSvar(klient, { sporsmal, kontekst, sted, historikk = [], modell = 'claude-opus-5-5', del = () => {} }) {
  // Planens data sendes med i første spørsmål (og bufres); senere spørsmål får bare stedet du står nå.
  const grunnlag = historikk.length ? `<sted>\n${stedTekst(sted)}\n</sted>` : `<plandata>\n${kontekst}\n</plandata>\n<sted>\n${stedTekst(sted)}\n</sted>`;
  const brukerMelding = { role: 'user', content: [{ type: 'text', text: grunnlag }, { type: 'text', text: sporsmal }] };
  const meldinger = [...historikk, brukerMelding];
  const strom = klient.beta.messages.stream({
    model: modell,
    max_tokens: 4000,
    output_config: { effort: 'low' }, // korte, raske svar
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    cache_control: { type: 'ephemeral' },
    system: SYSTEM,
    messages: meldinger,
  });
  let tekst = '';
  for await (const ev of strom) if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') { tekst += ev.delta.text; del(tekst); }
  const svar = await strom.finalMessage();
  if (svar.stop_reason === 'refusal') throw new Error('Spørsmålet ble avvist');
  return { tekst: tekst.trim(), melding: brukerMelding, svarMelding: { role: 'assistant', content: svar.content } };
}

export const STANDARD = STANDARD_INNSTILLINGER;
