// Små SVG-diagram uten avhengigheter: stablet søylediagram og linjediagram med hover.
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};

let tip;
function tooltip() {
  if (!tip) { tip = document.createElement('div'); tip.className = 'viz-tip'; tip.hidden = true; document.body.appendChild(tip); }
  return tip;
}
function visTip(html, evt) {
  const t = tooltip();
  t.innerHTML = html; t.hidden = false;
  const x = Math.min(evt.clientX + 14, window.innerWidth - t.offsetWidth - 8);
  t.style.left = `${x}px`; t.style.top = `${evt.clientY + 14}px`;
}
const skjulTip = () => { if (tip) tip.hidden = true; };

function pentMaks(v) {
  if (v <= 0) return 1;
  const e = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * e).find((m) => m >= v);
}

export const fmt = (v, d = 0) => (v === null || v === undefined || Number.isNaN(v) ? '–' : Number(v).toLocaleString('nb-NO', { maximumFractionDigits: d, minimumFractionDigits: d }));

// kategorier: [{navn, verdier:{serieKey: tall}}], serier: [{key, navn, farge}]
export function stabletSoyle(container, { kategorier, serier, enhet = '', hoyde = 200 }) {
  container.innerHTML = '';
  const W = Math.max(300, container.clientWidth || 520); const H = hoyde; const m = { t: 10, r: 8, b: 26, l: 46 };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'viz', role: 'img' }, container);
  const sum = kategorier.map((k) => serier.reduce((s, se) => s + (k.verdier[se.key] || 0), 0));
  const maks = pentMaks(Math.max(...sum, 0));
  const iw = W - m.l - m.r; const ih = H - m.t - m.b;
  const y = (v) => m.t + ih - (v / maks) * ih;
  for (let i = 0; i <= 4; i++) {
    const v = (maks / 4) * i;
    el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'grid' }, svg);
    el('text', { x: m.l - 6, y: y(v) + 4, class: 'akse', 'text-anchor': 'end' }, svg).textContent = fmt(v);
  }
  const bw = iw / kategorier.length;
  const bredde = Math.min(56, bw * 0.6);
  kategorier.forEach((k, i) => {
    const x = m.l + bw * i + (bw - bredde) / 2;
    let acc = 0;
    const synlige = serier.filter((se) => (k.verdier[se.key] || 0) > 0);
    synlige.forEach((se, si) => {
      const v = k.verdier[se.key];
      const y1 = y(acc + v); const y0 = y(acc);
      const h = Math.max(0, y0 - y1 - (si > 0 ? 2 : 0));
      const topp = si === synlige.length - 1;
      const r = topp ? Math.min(4, h / 2, bredde / 2) : 0;
      // Avrundet topp kun på øverste segment, forankret flatt mot grunnlinjen.
      const d = `M${x},${y0 - (si > 0 ? 2 : 0)} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + bredde - r} Q${x + bredde},${y1} ${x + bredde},${y1 + r} V${y0 - (si > 0 ? 2 : 0)} Z`;
      el('path', { d, fill: se.farge }, svg);
      acc += v;
    });
    const treff = el('rect', { x: m.l + bw * i, y: m.t, width: bw, height: ih, fill: 'transparent' }, svg);
    treff.addEventListener('mousemove', (e) => visTip(`<b>${k.navn}</b>${serier.map((se) => `<div><i style="background:${se.farge}"></i>${se.navn}: ${fmt(k.verdier[se.key] || 0)} ${enhet}</div>`).join('')}<div class="tip-sum">Sum: ${fmt(sum[i])} ${enhet}</div>`, e));
    treff.addEventListener('mouseleave', skjulTip);
    el('text', { x: m.l + bw * i + bw / 2, y: H - 8, class: 'akse', 'text-anchor': 'middle' }, svg).textContent = k.kort || k.navn;
  });
  el('line', { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0), class: 'grunnlinje' }, svg);
  if (serier.length > 1) {
    const leg = document.createElement('div'); leg.className = 'legend';
    leg.innerHTML = serier.map((se) => `<span><i style="background:${se.farge}"></i>${se.navn}</span>`).join('');
    container.appendChild(leg);
  }
}

// x: tall-array, serier: [{navn, verdier:[], farge}]. Én y-akse; serier må ha samme enhet.
export function linje(container, { x, serier, enhet = '', hoyde = 200, markerX = null }) {
  container.innerHTML = '';
  const W = Math.max(300, container.clientWidth || 520); const H = hoyde; const m = { t: 10, r: 12, b: 26, l: 54 };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'viz', role: 'img' }, container);
  const maks = pentMaks(Math.max(...serier.flatMap((s) => s.verdier), 0));
  const iw = W - m.l - m.r; const ih = H - m.t - m.b;
  const xs = (i) => m.l + (x.length > 1 ? (i / (x.length - 1)) * iw : iw / 2);
  const y = (v) => m.t + ih - (v / maks) * ih;
  for (let i = 0; i <= 4; i++) {
    const v = (maks / 4) * i;
    el('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'grid' }, svg);
    el('text', { x: m.l - 6, y: y(v) + 4, class: 'akse', 'text-anchor': 'end' }, svg).textContent = fmt(v);
  }
  const steg = Math.max(1, Math.ceil(x.length / Math.max(3, Math.floor(iw / 70))));
  const sisteMedEgen = (x.length - 1) % steg >= steg / 2 || steg === 1;
  x.forEach((xv, i) => { if (i % steg === 0 || (i === x.length - 1 && sisteMedEgen)) el('text', { x: xs(i), y: H - 8, class: 'akse', 'text-anchor': 'middle' }, svg).textContent = xv; });
  if (markerX !== null) {
    const i = x.indexOf(markerX);
    if (i >= 0) el('line', { x1: xs(i), x2: xs(i), y1: m.t, y2: m.t + ih, class: 'markor' }, svg);
  }
  for (const s of serier) {
    el('path', { d: s.verdier.map((v, i) => `${i ? 'L' : 'M'}${xs(i)},${y(v)}`).join(' '), fill: 'none', stroke: s.farge, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
  }
  el('line', { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0), class: 'grunnlinje' }, svg);
  const kryss = el('line', { y1: m.t, y2: m.t + ih, class: 'kryss', visibility: 'hidden' }, svg);
  const prikker = serier.map((s) => el('circle', { r: 4, fill: s.farge, class: 'prikk', visibility: 'hidden' }, svg));
  const flate = el('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' }, svg);
  flate.addEventListener('mousemove', (e) => {
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.max(0, Math.min(x.length - 1, Math.round(((px - m.l) / iw) * (x.length - 1))));
    kryss.setAttribute('x1', xs(i)); kryss.setAttribute('x2', xs(i)); kryss.setAttribute('visibility', 'visible');
    serier.forEach((s, si) => { prikker[si].setAttribute('cx', xs(i)); prikker[si].setAttribute('cy', y(s.verdier[i])); prikker[si].setAttribute('visibility', 'visible'); });
    visTip(`<b>${x[i]}</b>${serier.map((s) => `<div><i style="background:${s.farge}"></i>${s.navn}: ${fmt(s.verdier[i])} ${enhet}</div>`).join('')}`, e);
  });
  flate.addEventListener('mouseleave', () => { kryss.setAttribute('visibility', 'hidden'); prikker.forEach((p) => p.setAttribute('visibility', 'hidden')); skjulTip(); });
  if (serier.length > 1) {
    const leg = document.createElement('div'); leg.className = 'legend';
    leg.innerHTML = serier.map((se) => `<span><i style="background:${se.farge}"></i>${se.navn}</span>`).join('');
    container.appendChild(leg);
  }
}
