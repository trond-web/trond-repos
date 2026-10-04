// Lokal lagring i IndexedDB (data forlater aldri enheten med mindre brukeren eksporterer).
// «hoved» er planen som er åpen nå. Hver plan lagres også under «plan:<id>», og «planliste» holder oversikten.
const DB = 'skogbruksplan';
const STORE = 'tilstand';

let dbLover;
function aapne() {
  if (!dbLover) {
    dbLover = new Promise((res, rej) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  return dbLover;
}

async function skriv(nokkel, verdi) {
  const db = await aapne();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    if (verdi === undefined) tx.objectStore(STORE).delete(nokkel); else tx.objectStore(STORE).put(verdi, nokkel);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function les(nokkel) {
  try {
    const db = await aapne();
    return await new Promise((res, rej) => {
      const req = db.transaction(STORE).objectStore(STORE).get(nokkel);
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => rej(req.error);
    });
  } catch {
    return null;
  }
}

export const lagre = (tilstand) => skriv('hoved', tilstand);
export const hent = () => les('hoved');

export async function listPlaner() {
  return (await les('planliste')) || [];
}

export async function lagrePlan(plan) {
  if (!plan.planId) throw new Error('Planen mangler id');
  await skriv(`plan:${plan.planId}`, plan);
  const liste = (await listPlaner()).filter((p) => p.id !== plan.planId);
  liste.unshift({
    id: plan.planId,
    navn: plan.eiendom?.navn || 'Plan uten navn',
    areal: plan.bestand.reduce((s, b) => s + (b.areal || 0), 0),
    antall: plan.bestand.length,
    endret: new Date().toISOString(),
    laget: plan.metadata?.laget || null,
  });
  await skriv('planliste', liste);
}

export const hentPlan = (id) => les(`plan:${id}`);

export async function slettPlan(id) {
  await skriv(`plan:${id}`, undefined);
  await skriv('planliste', (await listPlaner()).filter((p) => p.id !== id));
}
