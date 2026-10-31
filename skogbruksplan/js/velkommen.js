// Velkomst etter innlogging: hilsen med navn, en humoristisk linje, dagens vær ved eiendommen (MET) med et lite
// driftsråd, og en motiverende tekst om tiltakene som står for tur på eiendommen som er åpen. Ingen DOM – kan testes i
// Node. Teksten velges likt hele dagen for samme bruker (frokorn = bruker + dato), så den ikke hopper ved hver last.
import { vaerTekst } from './skog3d-vaer.js';
import { TILTAKSTYPER } from './model.js';

const frokorn = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const velg = (liste, n) => liste[n % liste.length];
const k = (v, d = 1) => String(Math.round(v * 10 ** d) / 10 ** d).replace('.', ',');

// Fornavn fra navnet, eller fra e-postadressen («kari.skog@…» → «Kari»).
export function fornavn(navn) {
  const s = String(navn || '').trim(); if (!s) return '';
  const del = s.includes('@') ? s.split('@')[0].split(/[._-]/)[0] : s.split(/\s+/)[0];
  return del ? del[0].toUpperCase() + del.slice(1) : '';
}
export function hilsen(navn, dato = new Date()) {
  const t = dato.getHours(); const h = t < 5 ? 'God natt' : t < 10 ? 'God morgen' : t < 17 ? 'God dag' : t < 23 ? 'God kveld' : 'God natt';
  const f = fornavn(navn); return `${h}${f ? `, ${f}` : ''}!`;
}

// Værtype for tekstvalget.
export function vaerType(v, dato = new Date()) {
  if (!v?.ok) return 'ukjent';
  const s = v.symbol || '';
  if (/snow|sleet/.test(s) || (v.nedbor > 0 && v.temp <= 0)) return 'sno';
  if (/thunder/.test(s)) return 'torden';
  if (/rain/.test(s) || v.nedbor >= 0.3) return 'regn';
  if (v.vind >= 10) return 'vind';
  if (v.temp <= -8) return 'kulde';
  if (v.temp >= 24) return 'varme';
  if (/fog/.test(s)) return 'take';
  if (/clearsky|fair/.test(s)) return dato.getHours() >= 21 || dato.getHours() < 5 ? 'natt' : 'sol';
  return 'grått';
}
const HUMOR = {
  regn: ['Regn i dag – trærne jubler, gummistøvlene likeså.', 'Det regner. Granene kaller det «gratis vanning», du kaller det «jakkevær».', 'Våt dag! Et godt tidspunkt å gjøre skogbruksplanen tørt og trygt fra sofaen.'],
  sno: ['Snø! Skogen har tatt på seg vinterlua – du bør gjøre det samme.', 'Snøføre: lassbæreren elsker det, og det gjør sikkert skiene dine også.', 'Det snør. Perfekt for vinterdrift – og for å late som man planlegger når man egentlig drikker kakao.'],
  sol: ['Sol over skogen! Selv barkebillene tar seg en strekk i dag.', 'Strålende vær – granene står og fotosyntetiserer som om det var betalt arbeid.', 'Fint vær! En skogstur i dag kan regnes som befaring. Det er nesten jobb.'],
  vind: ['Mye vind i dag – hold øye med de høye granene, og med hatten.', 'Det blåser. Trærne øver på bølgen; du kan trygt bli inne og planlegge.'],
  kulde: ['Kaldt! Telen jobber for deg – bløt mark blir til motorvei for lassbæreren.', 'Krystallklar kulde. Skogen står helt stille – nesten som et regneark.'],
  varme: ['Varmt i dag! Husk vann på skogsturen – og tenk på at trærne også tørster.', 'Sommervarme: skogen vokser så det knaker. Du kan nesten høre tilveksten.'],
  torden: ['Torden i lufta – kanskje ikke dagen for å stå under den høyeste grana.'],
  take: ['Tåke i skogen – stemningsfullt, men ta med GPS-en.'],
  natt: ['Stjerneklart – skogen sover, og planen din våker.'],
  grått: ['Gråvær – perfekt lys for å se om bestandene trenger litt oppmerksomhet.', 'Overskyet, men skogen bryr seg lite. Den vokser like fullt.', 'Grå dag i skogen. Ingen solbriller nødvendig – bare godt humør.'],
  ukjent: ['Skogen står der den sto i går – det er det fine med skog.', 'Trærne har vokst litt siden sist. Det har de lov til.'],
};
export function humor(v, { bruker = '', dato = new Date() } = {}) { return velg(HUMOR[vaerType(v, dato)] || HUMOR.ukjent, frokorn(`${bruker}|${dato.toISOString().slice(0, 10)}`)); }

// Dagens vær i én linje, og et driftsråd ut fra været.
export function vaerLinje(v, sted = '') { return v?.ok ? `${sted ? `${sted} nå: ` : 'Nå: '}${vaerTekst({ ...v, snodybde: v.snodybde > 0 ? v.snodybde : null })}.` : ''; }
export function driftsraad(v) {
  if (!v?.ok) return '';
  if (v.temp <= -2 && !(v.nedbor > 0.5)) return 'Frost i bakken – fint for drift på bløt mark og myr.';
  if (v.nedbor >= 1) return 'Mye nedbør – vent med kjøring på våt mark, og bruk dagen til planlegging.';
  if (v.vind >= 12) return 'Sterk vind – unngå hogst og skogsarbeid i dag, fare for vindfall.';
  if (v.snodybde >= 40) return 'Mye snø – fint for vinterdrift, men tungt for planting og befaring.';
  return '';
}

// Motiverende tekst om tiltakene: hva som står for tur i år, hva som har ventet, og hva som er gjort.
export function tiltakTekst(S, iAar = new Date().getFullYear()) {
  const bestand = S?.bestand || [];
  if (!bestand.length) return { tekst: 'Ingen eiendom er åpen ennå. Lag en skogbruksplan fra gårds- og bruksnummer – det tar under ett minutt.', handling: 'planer' };
  const alle = bestand.flatMap((b) => (b.tiltak || []).map((t) => ({ b, t })));
  const apne = alle.filter(({ t }) => t.status !== 'utfort');
  const gjort = alle.filter(({ t }) => t.status === 'utfort' && String(t.utfortDato || '').startsWith(String(iAar)));
  const iAarListe = apne.filter(({ t }) => (t.aar || iAar) <= iAar).sort((a, c) => (a.t.prioritet ?? 2) - (c.t.prioritet ?? 2) || (a.t.aar || 0) - (c.t.aar || 0));
  const ventet = iAarListe.filter(({ t }) => (t.aar || iAar) < iAar);
  const navn = (t) => (TILTAKSTYPER[t.type]?.navn || t.type).toLowerCase();
  const daa = iAarListe.reduce((s, x) => s + (x.t.arealDaa ?? x.b.areal ?? 0), 0);
  if (!alle.length) return { tekst: 'Det er ingen tiltak i planen ennå. Tiltaksmotoren kan foreslå hva som bør gjøres – prøv den under Tiltak!', handling: 'tiltak' };
  if (!iAarListe.length) {
    const neste = apne.sort((a, c) => (a.t.aar || 0) - (c.t.aar || 0))[0];
    return { tekst: `${gjort.length ? `${gjort.length} tiltak er utført i år – godt jobbet! 🌲 ` : ''}Ingenting står på planen for i år.${neste ? ` Neste er ${navn(neste.t)} i bestand ${neste.b.nr} i ${neste.t.aar}.` : ''}`, handling: 'tiltak' };
  }
  const perType = {}; for (const { t } of iAarListe) perType[navn(t)] = (perType[navn(t)] || 0) + 1;
  const liste = Object.entries(perType).sort((a, c) => c[1] - a[1]).map(([n, a]) => `${a} ${n}`);
  const forst = iAarListe[0];
  const listeTekst = liste.length > 1 ? `${liste.slice(0, -1).join(', ')} og ${liste.at(-1)}` : liste[0];
  return {
    tekst: `I år står ${listeTekst} på planen${daa ? ` (${k(daa, 0)} daa)` : ''}.${ventet.length ? ` ${ventet.length} av dem har ventet siden ${Math.min(...ventet.map((x) => x.t.aar))}.` : ''} Start med ${navn(forst.t)} i bestand ${forst.b.nr} – ${velg(['hver daa teller!', 'skogen takker deg om 50 år.', 'det er slik gode skoger blir til.', 'framtidas tømmer starter i dag.'], frokorn(forst.b.id))}${gjort.length ? ` Du har allerede fått ${gjort.length} tiltak unna i år 💪` : ''}`,
    handling: 'tiltak', antall: iAarListe.length,
  };
}

// Hele velkomsten. v = vær fra hentVaer (eller null), sted = navnet på eiendommen eller kommunen.
export function lagVelkomst({ navn = '', bruker = '', S = null, v = null, sted = '', dato = new Date() } = {}) {
  return { tittel: hilsen(navn, dato), humor: humor(v, { bruker, dato }), vaer: vaerLinje(v, sted), raad: driftsraad(v), tiltak: tiltakTekst(S, dato.getFullYear()) };
}
