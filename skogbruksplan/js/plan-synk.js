// Planer mellom PC og mobil: send planen fra fullversjonen, hent den på mobilen med en kode (eller QR-kode), og
// synkroniser endringer begge veier. Serveren (plan-relay.js) er et mellomlager; planen ligger alltid på enhetene.
// Fletting: den sist endrede planen er grunnlaget, men registreringer, tiltak, sporlogger, oppdrag og droneoppdrag
// fra begge sider tas med (per id, nyeste versjon). Slettede tiltak og registreringer huskes i plan.slettet, så de
// ikke kommer tilbake. Ingen DOM – flettingen kan testes i Node.
export const RAILWAY = 'https://skogiq-production.up.railway.app';
export const API = typeof location !== 'undefined' && !/railway\.app$|^localhost$|^127\.0\.0\.1$/.test(location.hostname) ? RAILWAY : '';

// ---------- pakking (gzip + base64) ----------
const tilB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const fraB64 = (b) => { const s = atob(b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
async function strom(u8, Strom) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new Strom('gzip'))).arrayBuffer()); }
export async function pakk(plan) {
  const { synk, ...uten } = plan; // synk-feltet er lokalt for hver enhet
  const u8 = new TextEncoder().encode(JSON.stringify(uten));
  if (typeof CompressionStream === 'function') return { plan: tilB64(await strom(u8, CompressionStream)), gzip: true };
  return { plan: tilB64(u8), gzip: false };
}
export async function pakkUt({ plan, gzip }) {
  let u8 = fraB64(plan);
  if (gzip) { if (typeof DecompressionStream !== 'function') throw new Error('Nettleseren kan ikke pakke ut planen – oppdater nettleseren.'); u8 = await strom(u8, DecompressionStream); }
  return JSON.parse(new TextDecoder().decode(u8));
}

// ---------- fletting ----------
const etterId = (liste) => new Map((liste || []).filter((x) => x?.id).map((x) => [x.id, x]));
const tid = (x) => String(x?.endret || x?.utfortDato || x?.dato || '');
// Slår sammen to lister per id. Ved like id vinner den med nyest endret-tid, ellers den fra «foretrukket».
function union(foretrukket = [], annen = [], slettet = new Set()) {
  const a = etterId(foretrukket); const b = etterId(annen); const ut = [];
  for (const [id, x] of a) { if (slettet.has(id)) continue; const y = b.get(id); ut.push(y && tid(y) > tid(x) ? y : x); }
  for (const [id, y] of b) if (!a.has(id) && !slettet.has(id)) ut.push(y);
  for (const x of foretrukket || []) if (!x?.id) ut.push(x); // eldre data uten id beholdes
  return ut;
}
export function flettPlaner(lokal, fjern) {
  const lokalNyest = String(lokal.endret || '') >= String(fjern.endret || '');
  const ny = lokalNyest ? lokal : fjern; const gml = lokalNyest ? fjern : lokal;
  const slettet = {
    tiltak: [...new Set([...(lokal.slettet?.tiltak || []), ...(fjern.slettet?.tiltak || [])])],
    registreringer: [...new Set([...(lokal.slettet?.registreringer || []), ...(fjern.slettet?.registreringer || [])])],
  };
  const sT = new Set(slettet.tiltak); const sR = new Set(slettet.registreringer);
  const gmlBestand = etterId(gml.bestand);
  const ut = {
    ...gml, ...ny,
    slettet,
    registreringer: union(ny.registreringer, gml.registreringer, sR),
    sporlogger: union(ny.sporlogger, gml.sporlogger),
    oppdrag: union(ny.oppdrag, gml.oppdrag),
    droneoppdrag: union(ny.droneoppdrag, gml.droneoppdrag),
    bestand: (ny.bestand || []).map((b) => { const g = gmlBestand.get(b.id); return g ? { ...b, tiltak: union(b.tiltak, g.tiltak, sT) } : { ...b, tiltak: (b.tiltak || []).filter((t) => !sT.has(t.id)) }; }),
    endret: new Date(Math.max(Date.parse(lokal.endret || 0) || 0, Date.parse(fjern.endret || 0) || 0, Date.now())).toISOString(),
  };
  for (const k of ['sporlogger', 'oppdrag', 'droneoppdrag']) if (!ny[k] && !gml[k]) delete ut[k];
  return ut;
}
// Husker sletting, så flettingen ikke henter det slettede tilbake fra den andre enheten.
export function merkSlettet(plan, type, id) { if (!id) return; plan.slettet = plan.slettet || { tiltak: [], registreringer: [] }; (plan.slettet[type] ||= []).includes(id) || plan.slettet[type].push(id); }

// Fingeravtrykk av innholdet (uten synk og tidsstempel): avgjør om planen er endret siden forrige synkronisering.
export function planHash(plan) {
  const { synk, endret, ...rest } = plan || {};
  const t = JSON.stringify(rest); let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `${(h >>> 0).toString(16)}-${t.length}`;
}

// ---------- kall mot serveren ----------
export function lagPlanSynk({ hent = (u, o) => fetch(u, o), api = API, enhet = 'enhet' } = {}) {
  async function kall(sti, { metode = 'GET', kropp } = {}) {
    let r;
    try { r = await hent(`${api}${sti}`, { method: metode, headers: kropp ? { 'Content-Type': 'application/json' } : {}, body: kropp ? JSON.stringify(kropp) : undefined }); } catch { const f = new Error('Ingen kontakt med SkogIQ-serveren. Sjekk nettet.'); f.nett = true; throw f; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const f = new Error(d.feil || `Serveren svarte ${r.status}`); f.status = r.status; f.data = d; throw f; }
    return d;
  }
  const merk = (plan, svar) => ({ ...plan, synk: { id: svar.id, versjon: svar.versjon, sendtHash: planHash(plan), sist: new Date().toISOString() } });
  const last = async (id) => { const d = await kall(`/api/plan/${id}`); return { plan: await pakkUt(d), info: d }; };
  async function send(plan) {
    const p = await pakk(plan); const id = plan.synk?.id;
    const d = await kall(id ? `/api/plan/${id}` : '/api/plan', { metode: id ? 'PUT' : 'POST', kropp: { ...p, navn: plan.eiendom?.navn || '', enhet, grunnVersjon: id ? plan.synk.versjon ?? null : null } });
    return merk(plan, d);
  }
  return {
    // Første gang (eller ny kode): last opp planen og få en kode til mobilen.
    async del(plan) {
      let r;
      try { r = plan.synk?.id ? await this.synk(plan) : { plan: await send(plan), status: 'sendt' }; } catch (e) { if (e.status === 404) r = { plan: await send({ ...plan, synk: null }), status: 'sendt' }; else throw e; }
      const k = await kall(`/api/plan/${r.plan.synk.id}/kode`, { metode: 'POST' });
      return { ...r, kode: k.kode, utloper: k.utloper };
    },
    // Mobilen: bytt koden mot planen.
    async hentMedKode(kode) {
      const { id } = await kall('/api/plankobling', { metode: 'POST', kropp: { kode } });
      const { plan, info } = await last(id);
      return merk(plan, info);
    },
    // Synkroniser en plan som allerede er delt. Gir { plan, status: 'lik' | 'sendt' | 'hentet' | 'flettet' }.
    async synk(plan) {
      if (!plan.synk?.id) return { plan: await send(plan), status: 'sendt' };
      let info;
      try { info = await kall(`/api/plan/${plan.synk.id}/info`); } catch (e) {
        if (e.status !== 404) throw e;
        // Serveren har glemt planen (f.eks. etter omstart): last den opp på nytt med samme id. Har den andre enheten
        // rukket det først (409), flettes planene som vanlig under.
        try { return { plan: await send({ ...plan, synk: { ...plan.synk, versjon: 0 } }), status: 'sendt' }; } catch (e2) { if (e2.status !== 409) throw e2; info = e2.data?.gjeldende; plan = { ...plan, synk: { ...plan.synk, versjon: -1, sendtHash: null } }; }
      }
      const lokaltEndret = planHash(plan) !== plan.synk.sendtHash;
      if (info.versjon === plan.synk.versjon) return lokaltEndret ? { plan: await send(plan), status: 'sendt' } : { plan, status: 'lik' };
      // Endret på en annen enhet
      for (let forsok = 0; forsok < 3; forsok++) {
        const { plan: fjern, info: fi } = await last(plan.synk.id);
        if (!lokaltEndret) return { plan: merk({ ...fjern, planId: plan.planId }, fi), status: 'hentet' };
        const flettet = flettPlaner(plan, { ...fjern, planId: plan.planId });
        try { return { plan: await send({ ...flettet, synk: { ...plan.synk, versjon: fi.versjon } }), status: 'flettet' }; } catch (e) { if (e.status !== 409) throw e; }
      }
      throw new Error('Planen endres samtidig på flere enheter – prøv igjen om litt.');
    },
  };
}

// Kode i lenken: felt.html?kode=ABC123 (fra QR-koden på PC-en).
export const lenkeMedKode = (kode, base) => `${base.replace(/[^/]*$/, '')}felt.html?kode=${encodeURIComponent(kode)}`;
