// Lokal lagring i IndexedDB (data forlater aldri enheten med mindre brukeren eksporterer).
const DB = 'skogbruksplan';
const STORE = 'tilstand';

function aapne() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function lagre(tilstand) {
  const db = await aapne();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(tilstand, 'hoved');
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function hent() {
  try {
    const db = await aapne();
    return await new Promise((res, rej) => {
      const req = db.transaction(STORE).objectStore(STORE).get('hoved');
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    });
  } catch {
    return null;
  }
}
