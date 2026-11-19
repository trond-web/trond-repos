// API-nøkler for integrasjons-API-et (/api/v1, api-v1.js). Administrator oppretter en nøkkel for én bruker, med
// lesetilgang eller lese- og skrivetilgang; nøkkelen gir bare tilgang til den brukerens egne planer (skylagringen).
// Nøkkelen vises én gang ved oppretting – bare SHA-256 av hemmeligheten lagres. Nøkler kan trekkes tilbake, og hvert
// kall logges (tid, nøkkel, metode, sti, status – ikke innhold). Rate-grense per nøkkel.
// Format: skiq_<id>_<hemmelighet> (id: 10 hex-tegn, hemmelighet: 32 byte base64url).
// Lagring: JSON-fil (API_NOKKEL_FIL eller ved siden av brukerfila), ellers i minnet. Bare Node sitt standardbibliotek.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';

export const TILGANG = { les: 'Lese', skriv: 'Lese og skrive' };
export const MAKS_PER_MINUTT = 300;
export const LOGG_MAKS = 1000;
const hash = (s) => createHash('sha256').update(String(s)).digest('hex');
const tekst = (v, n) => String(v ?? '').slice(0, n);

export function lagApiNokler({ fil = null, naa = () => Date.now() } = {}) {
  let data = { nokler: {}, logg: [] };
  if (fil) { try { data = { nokler: {}, logg: [], ...JSON.parse(readFileSync(fil, 'utf8')) }; } catch { /* ny fil */ } }
  let t = null;
  const lagre = () => { if (!fil) return; clearTimeout(t); t = setTimeout(() => { try { writeFileSync(`${fil}.tmp`, JSON.stringify(data)); renameSync(`${fil}.tmp`, fil); } catch { /* prøver ved neste endring */ } }, 500); };
  const kall = new Map(); // id → tidspunkter siste minutt
  const offentlig = (n) => ({ id: n.id, navn: n.navn, bruker: n.bruker, tilgang: n.tilgang, prefiks: `skiq_${n.id}_…`, laget: n.laget, lagetAv: n.lagetAv, sistBrukt: n.sistBrukt || null, antallKall: n.antallKall || 0, aktiv: !n.trukket, trukket: n.trukket || null });
  return {
    opprett({ bruker, navn = '', tilgang = 'les', av = '' } = {}) {
      if (!bruker) return { feil: 'Velg bruker', status: 400 };
      if (!TILGANG[tilgang]) return { feil: 'Ugyldig tilgang', status: 400 };
      const id = randomBytes(5).toString('hex'); const hemmelig = randomBytes(32).toString('base64url');
      const n = { id, navn: tekst(navn, 80) || `Nøkkel ${id}`, bruker: String(bruker).toLowerCase(), tilgang, hash: hash(hemmelig), laget: naa(), lagetAv: tekst(av, 120) };
      data.nokler[id] = n; lagre();
      return { nokkel: `skiq_${id}_${hemmelig}`, info: offentlig(n) };
    },
    liste() { return Object.values(data.nokler).map(offentlig).sort((a, b) => b.laget - a.laget); },
    forBruker(u) { const b = String(u || '').toLowerCase(); return Object.values(data.nokler).filter((n) => n.bruker === b).map(offentlig); },
    trekk(id) { const n = data.nokler[id]; if (!n) return { feil: 'Finnes ikke', status: 404 }; if (!n.trukket) { n.trukket = naa(); lagre(); } return { ok: true, info: offentlig(n) }; },
    slettForBruker(u) { const b = String(u || '').toLowerCase(); for (const [id, n] of Object.entries(data.nokler)) if (n.bruker === b) delete data.nokler[id]; data.logg = data.logg.filter((l) => l.bruker !== b); lagre(); },
    // Gyldig, aktiv nøkkel → { id, bruker, tilgang }. Null ellers. { grense: true } når rate-grensen er nådd.
    verifiser(tekstNokkel) {
      const m = String(tekstNokkel || '').match(/^skiq_([0-9a-f]{10})_([A-Za-z0-9_-]{20,})$/); if (!m) return null;
      const n = data.nokler[m[1]]; if (!n || n.trukket) return null;
      const a = Buffer.from(hash(m[2]), 'hex'); const b = Buffer.from(n.hash, 'hex'); if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
      const tid = naa(); const l = (kall.get(n.id) || []).filter((x) => tid - x < 60000); if (l.length >= MAKS_PER_MINUTT) return { grense: true }; l.push(tid); kall.set(n.id, l);
      n.sistBrukt = tid; n.antallKall = (n.antallKall || 0) + 1; lagre();
      return { id: n.id, bruker: n.bruker, tilgang: n.tilgang, navn: n.navn };
    },
    logg(post) { data.logg.push({ tid: naa(), ...post }); if (data.logg.length > LOGG_MAKS) data.logg.splice(0, data.logg.length - LOGG_MAKS); lagre(); },
    sisteLogg(n = 100) { return data.logg.slice(-n).reverse(); },
    _data: () => data,
  };
}
