// Trekning av startrekkefølge og utregning av starttider (KR IV § 424.4–5).

export const AVSTAND_EKVIPASJER = 5; // minst 5 ekvipasjer mellom samme rytters starter
export const MINSTE_PAUSE_MIN = 12; // ellers minst 12 minutter mellom starttidene

export function rytterNokkel(p) {
  const lisens = String(p.rytter?.lisens || '').trim().toLowerCase();
  return lisens || String(p.rytter?.navn || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function blandet(liste, tilfeldig = Math.random) {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(tilfeldig() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Loddtrekning, deretter flyttes starter slik at samme rytter får minst 5 ekvipasjer mellom seg der det er mulig.
export function trekkRekkefolge(pameldinger, tilfeldig = Math.random) {
  const igjen = blandet(pameldinger, tilfeldig);
  const ut = [];
  const sist = new Map();
  while (igjen.length) {
    const ok = (p) => !sist.has(rytterNokkel(p)) || ut.length - sist.get(rytterNokkel(p)) > AVSTAND_EKVIPASJER;
    // Velg den med flest gjenværende starter først når flere passer, slik at ryttere med mange hester spres godt.
    const antall = (p) => igjen.filter((q) => rytterNokkel(q) === rytterNokkel(p)).length;
    const kandidater = igjen.filter(ok);
    const valgt = kandidater.length ? kandidater.reduce((a, b) => (antall(b) > antall(a) ? b : a)) : igjen[0];
    igjen.splice(igjen.indexOf(valgt), 1);
    sist.set(rytterNokkel(valgt), ut.length);
    ut.push(valgt);
  }
  return ut;
}

export function tilMin(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
export function fraMin(min) {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Starttider: fast intervall, planlagt pause etter hver N-te start, og ekstra pause om samme rytter ellers får under 12 min.
export function beregnStarttider(klasse, rekkefolge, opptatt = new Map()) {
  const start = tilMin(klasse.starttid) ?? 9 * 60;
  const intervall = Number(klasse.intervall) || 7;
  const pauseEtter = Number(klasse.pauseEtter) || 0;
  const pauseMin = Number(klasse.pauseMin) || 0;
  const sist = new Map(opptatt);
  let t = start;
  return rekkefolge.map((p, i) => {
    if (i > 0) {
      t += intervall;
      if (pauseEtter && i % pauseEtter === 0) t += pauseMin;
    }
    const forrige = sist.get(rytterNokkel(p));
    let pause = false;
    if (forrige != null && t - forrige < MINSTE_PAUSE_MIN) { t = forrige + MINSTE_PAUSE_MIN; pause = true; }
    sist.set(rytterNokkel(p), t);
    return { id: p.id, startrekke: i + 1, starttid: fraMin(t), ekstraPause: pause };
  });
}

// Advarsler for ryttere som har under 12 min mellom starter samme dag, også på tvers av klasser.
export function konflikter(pameldinger, klasser) {
  const perDag = new Map();
  for (const p of pameldinger) {
    const k = klasser.find((x) => x.id === p.klasseId);
    if (!k || !p.starttid || p.status === 'trukket') continue;
    const nokkel = `${k.dato}|${rytterNokkel(p)}`;
    if (!perDag.has(nokkel)) perDag.set(nokkel, []);
    perDag.get(nokkel).push({ p, k, t: tilMin(p.starttid) });
  }
  const ut = [];
  for (const liste of perDag.values()) {
    liste.sort((a, b) => a.t - b.t);
    for (let i = 1; i < liste.length; i++) {
      if (liste[i].t - liste[i - 1].t < MINSTE_PAUSE_MIN) {
        ut.push({
          rytter: liste[i].p.rytter.navn, dato: liste[i].k.dato,
          tekst: `${liste[i].p.rytter.navn}: ${liste[i - 1].p.starttid} (${liste[i - 1].k.navn}) og ${liste[i].p.starttid} (${liste[i].k.navn}) – under ${MINSTE_PAUSE_MIN} min mellom starter`,
        });
      }
    }
  }
  return ut;
}
