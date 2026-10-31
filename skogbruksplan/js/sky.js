// Skylagring på klienten: planene til den innloggede brukeren lagres på SkogIQ-serveren (sky-lager.js), og enheten
// har en lokal kopi (IndexedDB) for bruk uten nett. Synkroniseringen er den samme for fullversjonen og SkogIQ Felt:
//   * En plan som ikke er i skyen, lastes opp (første gang: alle planene på enheten flyttes til skyen).
//   * En plan som er endret lokalt, sendes som ny versjon. Er den også endret på en annen enhet (409), slås
//     endringene sammen (flettPlaner) og sendes på nytt.
//   * En plan som er nyere i skyen, hentes. Planer som bare finnes i skyen, lastes ned.
//   * En plan som er slettet på en annen enhet, fjernes lokalt (den ligger i papirkurven i skyen i 30 dager).
// plan.sky = { versjon, hash, sist } er lokal informasjon om siste synkronisering og sendes ikke til serveren.
// Ingen DOM – kan testes i Node.
import { pakk, pakkUt, flettPlaner, planHash } from './plan-synk.js';

export const RAILWAY = 'https://skogiq-production.up.railway.app';
export const API = typeof location !== 'undefined' && /github\.io$/.test(location.hostname) ? RAILWAY : '';

export function planMeta(plan) {
  return { areal: (plan.bestand || []).reduce((s, b) => s + (b.areal || 0), 0), antall: (plan.bestand || []).length, kommune: plan.eiendom?.kommune || '', gnrbnr: plan.eiendom?.gnrbnr || '' };
}

export function lagSkyKlient({ hent = (u, o) => fetch(u, o), api = API, token = () => null, enhet = 'enhet' } = {}) {
  async function kall(sti, { metode = 'GET', kropp } = {}) {
    const t = token(); let r;
    try { r = await hent(`${api}${sti}`, { method: metode, credentials: 'same-origin', headers: { ...(kropp ? { 'Content-Type': 'application/json' } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: kropp ? JSON.stringify(kropp) : undefined }); } catch { const f = new Error('Ingen kontakt med SkogIQ-serveren.'); f.nett = true; throw f; }
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { const f = new Error(d.feil || `Serveren svarte ${r.status}`); f.status = r.status; f.data = d; throw f; }
    return d;
  }
  const id = (x) => encodeURIComponent(x);
  return {
    liste: ({ slettede = false } = {}) => kall(`/api/sky/planer${slettede ? '?slettede=1' : ''}`),
    info: (planId) => kall(`/api/sky/planer/${id(planId)}/info`),
    async last(planId, { versjon = null } = {}) { const d = await kall(`/api/sky/planer/${id(planId)}${versjon != null ? `?versjon=${versjon}` : ''}`); return { plan: { ...(await pakkUt(d)), planId }, info: d }; },
    async send(plan, { grunnVersjon = null, gjenopprett = false } = {}) {
      const { sky, ...uten } = plan; const p = await pakk(uten);
      return kall(`/api/sky/planer/${id(plan.planId)}`, { metode: 'PUT', kropp: { ...p, navn: plan.eiendom?.navn || '', meta: planMeta(plan), grunnVersjon, enhet, ...(gjenopprett ? { gjenopprett: true } : {}) } });
    },
    slett: (planId) => kall(`/api/sky/planer/${id(planId)}`, { metode: 'DELETE' }),
    slettForGodt: (planId) => kall(`/api/sky/planer/${id(planId)}?forGodt=1`, { metode: 'DELETE' }),
    gjenopprett: (planId) => kall(`/api/sky/planer/${id(planId)}/gjenopprett`, { metode: 'POST' }),
    versjoner: (planId) => kall(`/api/sky/planer/${id(planId)}/versjoner`),
    profil: () => kall('/api/konto/profil'),
    lagreProfil: (profil) => kall('/api/konto/profil', { metode: 'PUT', kropp: { profil } }),
  };
}

// Merk planen med versjonen i skyen og et fingeravtrykk av innholdet som ble sendt/hentet.
export const merkSky = (plan, info) => ({ ...plan, sky: { versjon: info.versjon, hash: planHash(plan), sist: new Date().toISOString() } });
export const endretLokalt = (plan) => !plan.sky || planHash(plan) !== plan.sky.hash;

// Synkroniser én plan. Gir { plan, status: 'lik' | 'sendt' | 'hentet' | 'flettet' | 'slettet' }.
// skyInfo kan gis når den er kjent fra listen (sparer ett kall).
export async function synkPlan(klient, plan, { skyInfo } = {}) {
  let info = skyInfo;
  if (info === undefined) { try { info = await klient.info(plan.planId); } catch (e) { if (e.status !== 404) throw e; info = null; } }
  if (info?.slettet) return { plan, status: 'slettet' };
  const lokalt = endretLokalt(plan);
  if (!info) {
    // Ny i skyen (eller glemt): last opp. Har en annen enhet rukket det (409), flettes planene.
    try { return { plan: merkSky(plan, await klient.send(plan)), status: 'sendt' }; } catch (e) { if (e.status !== 409) throw e; }
  } else if (plan.sky && info.versjon === plan.sky.versjon) {
    return lokalt ? { plan: merkSky(plan, await klient.send(plan, { grunnVersjon: info.versjon })), status: 'sendt' } : { plan, status: 'lik' };
  }
  // Skyen har en annen versjon enn den enheten sist så.
  for (let forsok = 0; forsok < 3; forsok++) {
    const { plan: fjern, info: fi } = await klient.last(plan.planId);
    if (plan.sky && !lokalt) return { plan: merkSky(fjern, fi), status: 'hentet' };
    const flettet = flettPlaner(plan, fjern);
    if (planHash(flettet) === planHash(fjern)) return { plan: merkSky(fjern, fi), status: 'hentet' };
    try { const ny = { ...flettet, planId: plan.planId }; return { plan: merkSky(ny, await klient.send(ny, { grunnVersjon: fi.versjon })), status: 'flettet' }; } catch (e) { if (e.status !== 409) throw e; }
  }
  throw new Error('Planen endres samtidig på flere enheter – prøv igjen om litt.');
}

// Synkroniser alle planene til brukeren. lokal: { liste() → [{ id }], hent(id), lagre(plan), slett(id) }.
// aktivId + paaAktiv(r): planen som er åpen, håndteres av appen (den kan være endret mens synkroniseringen pågår).
// Gir en oppsummering { sendt, hentet, flettet, nye, slettet, feil, bruk }.
export async function synkAlle(klient, lokal, { aktivId = null, paaAktiv = null, eier = null } = {}) {
  const ut = { sendt: 0, hentet: 0, flettet: 0, nye: 0, slettet: 0, lik: 0, feil: [] };
  const [{ planer, bruk }, { planer: slettede }] = await Promise.all([klient.liste(), klient.liste({ slettede: true })]);
  ut.bruk = bruk;
  const iSky = new Map(planer.map((p) => [p.id, p])); const iKurv = new Set(slettede.map((p) => p.id));
  const lokale = (await lokal.liste()).filter((p) => !eier || !p.eier || p.eier === eier);
  for (const rad of lokale) {
    try {
      const plan = await lokal.hent(rad.id); if (!plan) continue;
      // Slettet på en annen enhet: fjern lokalt hvis planen ikke er endret her siden den sist var i skyen.
      if (iKurv.has(rad.id) && !iSky.has(rad.id)) {
        if (plan.sky && !endretLokalt(plan)) { if (rad.id !== aktivId) { await lokal.slett(rad.id); ut.slettet++; } continue; }
        // Endret lokalt etter at den ble slettet: gjenopprett i skyen med endringene.
        await klient.gjenopprett(rad.id).catch(() => null);
      }
      const r = await synkPlan(klient, eier && !plan.eier ? { ...plan, eier } : plan, { skyInfo: iSky.get(rad.id) ?? (iKurv.has(rad.id) ? undefined : null) });
      ut[r.status] = (ut[r.status] || 0) + 1;
      if (r.status === 'lik') continue;
      if (rad.id === aktivId && paaAktiv) await paaAktiv(r); else if (r.status !== 'slettet') await lokal.lagre(r.plan);
    } catch (e) { ut.feil.push(`${rad.navn || rad.id}: ${e.message}`); if (e.nett) throw e; }
  }
  // Planer som bare finnes i skyen (laget på en annen enhet): last ned.
  const lokaleIder = new Set((await lokal.liste()).map((p) => p.id));
  for (const p of planer) {
    if (lokaleIder.has(p.id)) continue;
    try { const { plan, info } = await klient.last(p.id); await lokal.lagre(merkSky(eier && !plan.eier ? { ...plan, eier } : plan, info)); ut.nye++; } catch (e) { ut.feil.push(`${p.navn || p.id}: ${e.message}`); if (e.nett) throw e; }
  }
  // Oppdatert bruk av lagringsplassen når noe er sendt.
  if (ut.sendt || ut.flettet) ut.bruk = (await klient.liste().catch(() => ({ bruk: ut.bruk }))).bruk;
  return ut;
}

export const mb = (bytes) => (bytes > 0 && bytes < 104858 ? '< 0,1 MB' : `${(bytes / 1048576).toLocaleString('nb-NO', { maximumFractionDigits: bytes < 10485760 ? 1 : 0 })} MB`);
export function synkTekst(r) {
  const deler = [];
  if (r.nye) deler.push(`${r.nye} plan${r.nye > 1 ? 'er' : ''} hentet fra skyen`);
  if (r.hentet) deler.push(`${r.hentet} oppdatert fra en annen enhet`);
  if (r.sendt) deler.push(`${r.sendt} lagret i skyen`);
  if (r.flettet) deler.push(`${r.flettet} slått sammen med endringer fra en annen enhet`);
  if (r.slettet) deler.push(`${r.slettet} slettet på en annen enhet`);
  return deler.join(', ');
}
