// 🌲 «Skogen siste døgn» i admin: hver bruker som har vært pålogget de siste 24 timene, blir et tre. Treet står
// langs en tidslinje (venstre = for 24 timer siden, høyre = nå), og de som er i skogen akkurat nå (aktive siste
// 5 minutter), svaier i vinden. Himmelen følger klokka: sol om dagen, måne og stjerner om natta. Bygger på
// sistAktiv fra /api/admin/oversikt – ingen nye data. Ren funksjon (ingen DOM), testes i Node.
export const DOGN = 24 * 3600 * 1000;
export const NAA_GRENSE = 5 * 60 * 1000;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

// Hvor lenge siden, på godt norsk
export function siden(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'akkurat nå'; if (m < 60) return `for ${m} min siden`;
  const t = Math.floor(m / 60); return `for ${t} ${t === 1 ? 'time' : 'timer'} siden`;
}

// Hva slags gjeng er dette? (antall i skogen siste døgn)
export function gjeng(n) {
  if (n === 0) return { ikon: '🦉', tekst: 'Stille i skogen. Bare ugla er våken.' };
  if (n === 1) return { ikon: '🪓', tekst: 'Én ensom tømmerhogger i skogen.' };
  if (n <= 3) return { ikon: '🪵', tekst: 'Et lite hogstlag – nok til å bære matpakka.' };
  if (n <= 8) return { ikon: '🦌', tekst: 'Et helt elgjaktlag! Noen må stå på post.' };
  if (n <= 20) return { ikon: '🔥', tekst: 'Dugnad i skogen – det koker bålkaffe.' };
  if (n <= 50) return { ikon: '🎪', tekst: 'Dette er jo årsmøte i skogeierlaget!' };
  if (n <= 150) return { ikon: '🌊', tekst: 'Tømmerfløting i Glomma – det myldrer!' };
  return { ikon: '🌳', tekst: 'Hele bygda er i skogen. Hvem passer på kua?' };
}

// Brukere siste døgn → [{ navn, bruker, sist, naa }], nyeste først
export function iSkogen(brukere, naa = Date.now()) {
  return (brukere || []).filter((b) => b.sistAktiv && naa - b.sistAktiv <= DOGN && naa - b.sistAktiv >= -60000)
    .map((b) => ({ bruker: b.bruker, navn: b.navn || b.bruker, sist: b.sistAktiv, naa: naa - b.sistAktiv <= NAA_GRENSE }))
    .sort((a, b) => b.sist - a.sist);
}

function himmel(time) {
  if (time >= 22 || time < 5) return { fra: '#0b1d3a', til: '#24406b', natt: true };
  if (time < 8) return { fra: '#f6b26b', til: '#bfe0f2', natt: false };
  if (time < 18) return { fra: '#7fc4ee', til: '#d8f0fb', natt: false };
  return { fra: '#e8875f', til: '#f6d6a8', natt: false };
}

// Et tre: gran (de fleste), furu eller bjørk – valgt fast per bruker. h = høyde i px.
function tre(x, bunn, h, slag, farge, svai, tittel) {
  const s = h / 60;
  const kropp = slag === 'bjork'
    ? `<rect x="-2.5" y="-34" width="5" height="34" fill="#efe9dc" stroke="#5b5048" stroke-width=".6"/><path d="M-2.5 -26h2M0.5 -16h2M-2.5 -9h2" stroke="#2e2a26" stroke-width="1.2"/><ellipse cx="0" cy="-44" rx="15" ry="19" fill="${farge.lauv}"/><ellipse cx="-6" cy="-50" rx="7" ry="8" fill="${farge.lys}" opacity=".7"/>`
    : slag === 'furu'
      ? `<rect x="-2.5" y="-40" width="5" height="40" fill="#a0522d"/><ellipse cx="0" cy="-48" rx="17" ry="11" fill="${farge.bar}"/><ellipse cx="-4" cy="-53" rx="9" ry="6" fill="${farge.lys}" opacity=".8"/>`
      : `<rect x="-2" y="-8" width="4" height="8" fill="#6b4226"/><path d="M0 -60 L-11 -38 H-5 L-15 -20 H-7 L-19 -6 H19 L7 -20 H15 L5 -38 H11 Z" fill="${farge.bar}"/><path d="M0 -60 L-5 -46 L0 -48 Z" fill="${farge.lys}"/>`;
  return `<g transform="translate(${x.toFixed(1)} ${bunn}) scale(${s.toFixed(2)})"><g class="${svai ? 'skog-svai' : ''}" style="animation-delay:${(-hash(tittel) * 3).toFixed(2)}s"><title>${esc(tittel)}</title>${kropp}</g></g>`;
}

// Anonymt: fra tellingen i /api/skogen ({ siste24, naa, timer[24] }) til «brukere» uten navn – til visningen for alle.
export function anonymeBrukere(s, naa = Date.now()) {
  const ut = []; const n = Math.min(s?.naa || 0, s?.timer?.[0] || 0);
  for (let k = 0; k < n; k++) ut.push({ bruker: `naa-${k}`, sistAktiv: naa - 60000 });
  (s?.timer || []).forEach((c, i) => { for (let k = 0; k < c - (i === 0 ? n : 0); k++) ut.push({ bruker: `t${i}-${k}`, sistAktiv: naa - (i + (i === 0 ? 0.5 : (k + 1) / (c + 1))) * 3600000 }); });
  return ut;
}

// HTML for kortet. brukere = d.brukere fra /api/admin/oversikt. anonym = uten navn (for alle brukere).
export function skogKort(brukere, { naa = Date.now(), timeNaa = new Date(naa).getHours(), anonym = false } = {}) {
  const liste = iSkogen(brukere, naa); const naaListe = liste.filter((x) => x.naa); const g = gjeng(liste.length);
  const B = 720; const H = 160; const bunn = 138; const sky = himmel(timeNaa);
  // Tidslinjen (−24 t til nå) går fram til lysningen til høyre, der de som er i skogen akkurat nå, står på rekke.
  const L0 = 28; const L1 = 568; const N0 = 590; const N1 = 712;
  const pos = (sist) => L0 + (1 - Math.min(1, (naa - sist) / DOGN)) * (L1 - L0);
  const avst = Math.min(30, (N1 - N0 - 16) / Math.max(1, naaListe.length)); const nStart = (N0 + N1) / 2 - ((naaListe.length - 1) * avst) / 2;
  const xFor = (x, r) => (x.naa ? nStart + naaListe.indexOf(x) * avst : Math.min(L1 - 6, pos(x.sist) + (r - 0.5) * 12));
  // Trær bak (eldre) tegnes først, så de nyeste står foran; høyden følger hvor nylig brukeren var innom
  const traer = [...liste].reverse().map((x) => {
    const r = hash(x.bruker); const slag = r < 0.6 ? 'gran' : r < 0.82 ? 'furu' : 'bjork'; const alder = (naa - x.sist) / DOGN;
    const h = x.naa ? Math.max(44, Math.min(70, avst * 2.6)) : 34 + (1 - alder) * 22 + r * 8; const bakgrunn = x.naa ? 0 : r * 10 - 5;
    const farge = sky.natt ? { bar: '#123c2a', lys: '#1f5a3e', lauv: '#2c5a2a' } : x.naa ? { bar: '#1f6b4a', lys: '#4fae7a', lauv: '#5fa83f' } : { bar: '#2f7d55', lys: '#7cc49a', lauv: '#8ccf5f' };
    return tre(xFor(x, r), bunn + bakgrunn * 0.6, h, slag, farge, x.naa, `${anonym ? 'En skogbruker' : `${x.navn}${x.navn !== x.bruker ? ` (${x.bruker})` : ''}`} – ${x.naa ? 'i skogen nå 🌲' : anonym ? (naa - x.sist < 3600000 ? 'siste time' : `for ${Math.floor((naa - x.sist) / 3600000)}–${Math.floor((naa - x.sist) / 3600000) + 1} timer siden`) : siden(naa - x.sist)}`);
  }).join('');
  const stjerner = sky.natt ? Array.from({ length: 28 }, (_, i) => `<circle cx="${(hash(`s${i}`) * B).toFixed(0)}" cy="${(hash(`y${i}`) * 75).toFixed(0)}" r="${(0.6 + hash(`r${i}`)).toFixed(1)}" fill="#fff" opacity="${(0.4 + hash(`o${i}`) * 0.6).toFixed(2)}"/>`).join('') : '';
  const sol = sky.natt ? `<circle cx="520" cy="34" r="15" fill="#f4f1d6"/><circle cx="527" cy="29" r="13" fill="${sky.fra}"/>` : `<circle cx="520" cy="36" r="17" fill="#ffd34d" opacity=".95"/>`;
  const merker = [24, 18, 12, 6, 3, 1].map((t) => `<g><line x1="${pos(naa - t * 3600000).toFixed(0)}" x2="${pos(naa - t * 3600000).toFixed(0)}" y1="${bunn + 4}" y2="${bunn + 9}" stroke="${sky.natt ? '#9fb3a6' : '#5d6d64'}"/><text x="${pos(naa - t * 3600000).toFixed(0)}" y="${bunn + 20}" text-anchor="middle" font-size="10" fill="${sky.natt ? '#c9d6cd' : '#43544b'}">${t === 24 ? '−24 t' : `−${t} t`}</text></g>`).join('');
  const naaX = (N0 + N1) / 2;
  return `<style>
      @keyframes skogSvai { 0%,100% { transform: rotate(-3deg) } 50% { transform: rotate(3deg) } }
      .skog-svai { transform-origin: 50% 100%; transform-box: fill-box; animation: skogSvai 2.6s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) { .skog-svai { animation: none } }
      .skog-tall { font-size: 46px; font-weight: 800; line-height: 1; letter-spacing: -1px; color: var(--accent); }
    </style>
    <h2>🌲 Skogen siste døgn</h2>
    <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
      <div style="display:flex;gap:18px"><div><div class="skog-tall">${liste.length}</div><div class="hint">${liste.length === 1 ? 'skogbruker' : 'skogbrukere'} innom<br>siste 24 timer</div></div>
      <div><div class="skog-tall" style="color:#c98500">${naaListe.length}</div><div class="hint">i skogen<br>akkurat nå</div></div></div>
      <div style="flex:1;min-width:220px;font-size:15px"><b>${g.ikon} ${esc(g.tekst)}</b>${naaListe.length && !anonym ? `<div class="hint">Nå: ${naaListe.slice(0, 6).map((x) => esc(x.navn)).join(', ')}${naaListe.length > 6 ? ` og ${naaListe.length - 6} til` : ''} 🪓</div>` : ''}</div>
    </div>
    <svg viewBox="0 0 ${B} ${H}" width="100%" role="img" aria-label="${liste.length} brukere siste døgn, ${naaListe.length} pålogget nå" style="display:block;border-radius:14px;max-height:220px">
      <defs><linearGradient id="skogHimmel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky.fra}"/><stop offset="1" stop-color="${sky.til}"/></linearGradient></defs>
      <rect width="${B}" height="${H}" fill="url(#skogHimmel)"/>${stjerner}${sol}
      <path d="M0 ${bunn - 34} Q120 ${bunn - 70} 240 ${bunn - 40} T480 ${bunn - 46} T${B} ${bunn - 38} V${H} H0 Z" fill="${sky.natt ? '#172b3c' : '#9cc3a8'}" opacity=".55"/>
      <rect x="${N0 - 8}" y="0" width="${N1 - N0 + 16}" height="${bunn}" fill="#ffd34d" opacity="${sky.natt ? 0.1 : 0.2}"/>
      <text x="${naaX}" y="16" text-anchor="middle" font-size="11" font-weight="800" fill="${sky.natt ? '#ffe58a' : '#7a5600'}">I SKOGEN NÅ</text>
      ${naaListe.length ? '' : `<text x="${naaX}" y="${bunn - 12}" text-anchor="middle" font-size="22">🦌</text>`}
      <rect x="0" y="${bunn}" width="${B}" height="${H - bunn}" fill="${sky.natt ? '#0f2419' : '#cfe3c8'}"/>
      ${traer || `<text x="${B / 2}" y="${bunn - 40}" text-anchor="middle" font-size="40">🦉</text>`}
      ${merker}
    </svg>
    <p class="hint" style="margin:6px 0 0">Hvert tre er en bruker, plassert etter når de sist var aktive. Trærne i lysningen til høyre er i skogen nå (aktive siste 5 minutter) og svaier i vinden. ${anonym ? 'Ingen navn vises – bare hvor mange.' : 'Hold musen over et tre for å se hvem det er.'}</p>`;
}
