// Tilbudsforespørsler til nettverket: innkjøperne og entreprenørene skogeieren er koblet til (Nettverk) kan velges som
// mottakere. Da leveres forespørselen i SkogIQ.ai – i mottakerens «Tilbudsforespørsler» under Nettverk og som melding i
// chatten – i tillegg til den personlige lenken. Brukes av «Be om tilbud» (tilbud-hurtig.js) og oppdragets Utfører-fane
// (tilbud-ui.js). Serveren godtar bare brukere avsenderen faktisk er koblet til (tilbud-relay.js).
import { API } from './plan-synk.js';
import { avatar, fyllBilder } from './profilbilde-ui.js';
import { kommuneTekst } from './kommunevelger.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ROLLE = { innkjoper: '🪵 Innkjøper', entreprenor: '🚜 Entreprenør' };
const HOGST = ['sluttavvirkning', 'tynning', 'lukkethogst'];
// Hvilken rolle passer best for oppdragstypen? (tømmer → innkjøper, ellers entreprenør)
export const passerRolle = (type) => (HOGST.includes(type) ? 'innkjoper' : 'entreprenor');

let cache = null; let cacheTid = 0;
// Aktive koblinger der brukeren er skogeier: [{ bruker, navn, foretak, rolle, bilde, kommuner }].
export async function hentNettverksmottakere({ hent = (u, o) => fetch(u, o), maksAlder = 30000 } = {}) {
  if (cache && Date.now() - cacheTid < maksAlder) return cache;
  const r = await hent(`${API}/api/nettverk`, { credentials: 'same-origin', cache: 'no-store' });
  if (r.status === 401 || r.status === 503) return (cache = []);
  if (!r.ok) throw new Error(`Fikk ikke hentet nettverket (${r.status})`);
  const d = await r.json();
  cache = (d.koblinger || []).filter((k) => k.status === 'aktiv' && k.jegEr === 'skogeier' && k.motpart?.bruker && (k.rolle === 'innkjoper' || k.rolle === 'entreprenor'))
    .map((k) => ({ kobling: k.id, bruker: k.motpart.bruker, navn: k.motpart.navn, foretak: k.motpart.foretak || '', rolle: k.rolle, bilde: k.motpart.bilde || null, kommuner: k.motpart.kommuner || [] }));
  cacheTid = Date.now(); return cache;
}
export const glemNettverk = () => { cache = null; };

// Mottaker i forespørselen for en nettverkskobling (uten e-post/telefon – leveres i SkogIQ.ai).
export const somMottaker = (n, nyId) => ({ id: nyId('m'), bruker: n.bruker, navn: n.foretak || n.navn, firma: n.foretak || n.navn, kontaktperson: n.foretak ? n.navn : '', epost: '', telefon: '', nettverk: true });

// Kort med avkrysning, sortert med den rollen som passer oppdraget først. valgte = Set av brukernavn.
export function nettverkValgHtml(liste, valgte, { type = '', attr = 'data-nett' } = {}) {
  const r = passerRolle(type);
  const sortert = [...liste].sort((a, b) => Number(b.rolle === r) - Number(a.rolle === r) || a.navn.localeCompare(b.navn, 'nb'));
  return `<div class="tn-liste">${sortert.map((n) => `<label class="tn-kort${valgte.has(n.bruker) ? ' valgt' : ''}"><input type="checkbox" ${attr}="${esc(n.bruker)}" ${valgte.has(n.bruker) ? 'checked' : ''}>
    ${avatar(n)}<span class="tn-tekst"><b>${esc(n.foretak || n.navn)}</b><small>${esc([n.foretak ? n.navn : '', ROLLE[n.rolle] || '', n.kommuner.length ? `📍 ${kommuneTekst(n.kommuner.map((navn) => ({ navn })), 2)}` : ''].filter(Boolean).join(' · '))}</small></span>${n.rolle === r ? '<span class="tn-passer">passer</span>' : ''}</label>`).join('')}</div>`;
}
export { fyllBilder };
