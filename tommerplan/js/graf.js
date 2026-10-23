// SVG-grafer uten biblioteker: maskinplan (Gantt), stablede søyler og linjer.
// Farger kommer fra CSS-variabler (--s1 … --s6), slik at lyst og mørkt tema virker.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DAG = 86400000;
const dagNr = (iso) => Math.floor(Date.parse(iso + 'T00:00:00Z') / DAG);
const fmt = (x) => Math.round(x).toLocaleString('nb-NO');

function pent(maks) {
  if (maks <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(maks));
  return [1, 2, 2.5, 5, 10].map((f) => f * p).find((v) => v >= maks);
}

function aksePoeng(maks, n = 4) {
  const topp = pent(maks);
  return { topp, steg: Array.from({ length: n + 1 }, (_, i) => (topp * i) / n) };
}

// Sesongbånd øverst i maskinplanen og bak søylene
function sesongKlasse(u) {
  if (u.sesong.tele) return 'band-tele';
  if (u.sesong.vinter) return 'band-vinter';
  if (u.sesong.sommer) return 'band-sommer';
  return '';
}

export function maskinplan(res, plan) {
  const navn = Object.fromEntries((plan.drifter || []).map((d) => [d.id, d.navn]));
  const B = 960; const venstre = 150; const hoyre = 12; const rad = 34; const topp = 30;
  const H = topp + res.lag.length * rad + 22;
  const d0 = dagNr(res.start); const d1 = dagNr(res.slutt) + 1;
  const x = (iso, slutt = false) => venstre + ((dagNr(iso) + (slutt ? 1 : 0) - d0) / (d1 - d0)) * (B - venstre - hoyre);
  let s = `<svg viewBox="0 0 ${B} ${H}" class="graf" role="img" aria-label="Maskinplan per lag">`;
  s += `<defs><pattern id="skravur" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--flate)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--dempet)" stroke-width="1.5" opacity=".55"/></pattern></defs>`;
  res.uker.forEach((u, i) => {
    const xa = x(u.mandag); const xb = i + 1 < res.uker.length ? x(res.uker[i + 1].mandag) : B - hoyre;
    const k = sesongKlasse(u);
    if (k) s += `<rect x="${xa}" y="${topp - 8}" width="${xb - xa}" height="${H - topp - 14}" class="${k}"/>`;
    if (i % 2 === 0 || res.uker.length < 20) s += `<text x="${(xa + xb) / 2}" y="${topp - 14}" class="akse" text-anchor="middle">${u.uke}</text>`;
  });
  s += `<text x="4" y="${topp - 14}" class="akse">Uke</text>`;
  res.lag.forEach((l, i) => {
    const y = topp + i * rad;
    s += `<text x="4" y="${y + rad / 2 + 4}" class="radnavn">${esc(l.navn.length > 22 ? l.navn.slice(0, 21) + '…' : l.navn)}</text>`;
    s += `<line x1="${venstre}" x2="${B - hoyre}" y1="${y + rad - 2}" y2="${y + rad - 2}" class="rutenett"/>`;
    for (const seg of l.segmenter) {
      const xa = x(seg.fra); const w = Math.max(2, x(seg.til, true) - xa - 2);
      const tittel = seg.type === 'drift' ? `${navn[seg.drift]}: ${seg.fra} – ${seg.til}`
        : seg.type === 'flytt' ? `Flytting til ${navn[seg.drift] || ''}: ${seg.fra}` : `Venter (sesong/vilkår): ${seg.fra} – ${seg.til}`;
      const cls = seg.type === 'drift' ? 'seg-drift' : seg.type === 'flytt' ? 'seg-flytt' : 'seg-vent';
      s += `<g data-tip="${esc(tittel)}"><rect x="${xa}" y="${y + 5}" width="${w}" height="${rad - 12}" rx="4" class="${cls}"/>`;
      if (seg.type === 'drift' && w > 46) {
        const tekst = navn[seg.drift] || '';
        const maks = Math.floor((w - 8) / 6.4);
        s += `<text x="${xa + 5}" y="${y + rad / 2 + 3}" class="seg-tekst">${esc(tekst.length > maks ? tekst.slice(0, Math.max(1, maks - 1)) + '…' : tekst)}</text>`;
      }
      s += '</g>';
    }
  });
  return s + '</svg>';
}

// Stablede søyler per uke (ett segment per serie). serier: [{ id, navn, farge }], verdi(u, id)
export function stabletSoyle(uker, serier, verdi, { tittel, enhet = 'm³', grense } = {}) {
  const B = 960; const H = 260; const v = 52; const h = 10; const t = 14; const b = 30;
  const sum = uker.map((u) => serier.reduce((s, se) => s + verdi(u, se.id), 0));
  const { topp, steg } = aksePoeng(Math.max(...sum, grense || 0, 1));
  const bw = (B - v - h) / uker.length;
  const y = (val) => t + (1 - val / topp) * (H - t - b);
  let s = `<svg viewBox="0 0 ${B} ${H}" class="graf" role="img" aria-label="${esc(tittel)}">`;
  uker.forEach((u, i) => { const k = sesongKlasse(u); if (k) s += `<rect x="${v + i * bw}" y="${t}" width="${bw}" height="${H - t - b}" class="${k}"/>`; });
  for (const st of steg) s += `<line x1="${v}" x2="${B - h}" y1="${y(st)}" y2="${y(st)}" class="rutenett"/><text x="${v - 6}" y="${y(st) + 4}" class="akse" text-anchor="end">${fmt(st)}</text>`;
  uker.forEach((u, i) => {
    const x0 = v + i * bw + 1; const w = Math.max(1, bw - 2);
    let akk = 0;
    const deler = serier.map((se) => ({ se, val: verdi(u, se.id) })).filter((d) => d.val > 0.5);
    deler.forEach((d, j) => {
      const ya = y(akk + d.val); const yb = y(akk);
      const hoyde = Math.max(0, yb - ya - (j > 0 ? 2 : 0));
      const siste = j === deler.length - 1;
      s += siste && hoyde > 4
        ? `<path d="M${x0},${yb - (j > 0 ? 2 : 0)} V${ya + 4} q0,-4 4,-4 H${x0 + w - 4} q4,0 4,4 V${yb - (j > 0 ? 2 : 0)} Z" fill="${d.se.farge}"/>`
        : `<rect x="${x0}" y="${ya}" width="${w}" height="${hoyde}" fill="${d.se.farge}"/>`;
      akk += d.val;
    });
    const tips = [`Uke ${u.uke}: ${fmt(sum[i])} ${enhet}`, ...deler.map((d) => `${d.se.navn}: ${fmt(d.val)}`)].join('\n');
    s += `<rect x="${v + i * bw}" y="${t}" width="${bw}" height="${H - t - b}" fill="transparent" data-tip="${esc(tips)}"/>`;
    if (i % 2 === 0 || uker.length < 20) s += `<text x="${v + i * bw + bw / 2}" y="${H - b + 16}" class="akse" text-anchor="middle">${u.uke}</text>`;
  });
  if (grense) s += `<line x1="${v}" x2="${B - h}" y1="${y(grense)}" y2="${y(grense)}" class="grenselinje"/>`;
  s += `<line x1="${v}" x2="${B - h}" y1="${y(0)}" y2="${y(0)}" class="akselinje"/>`;
  return s + '</svg>';
}

// Linjer per uke. serier: [{ navn, farge, verdier: [] }]
export function linjer(uker, serier, { tittel, enhet = 'm³' } = {}) {
  const B = 960; const H = 240; const v = 52; const h = 10; const t = 14; const b = 30;
  const { topp, steg } = aksePoeng(Math.max(1, ...serier.flatMap((se) => se.verdier)));
  const bw = (B - v - h) / uker.length;
  const x = (i) => v + i * bw + bw / 2;
  const y = (val) => t + (1 - val / topp) * (H - t - b);
  let s = `<svg viewBox="0 0 ${B} ${H}" class="graf" role="img" aria-label="${esc(tittel)}">`;
  uker.forEach((u, i) => { const k = sesongKlasse(u); if (k) s += `<rect x="${v + i * bw}" y="${t}" width="${bw}" height="${H - t - b}" class="${k}"/>`; });
  for (const st of steg) s += `<line x1="${v}" x2="${B - h}" y1="${y(st)}" y2="${y(st)}" class="rutenett"/><text x="${v - 6}" y="${y(st) + 4}" class="akse" text-anchor="end">${fmt(st)}</text>`;
  s += `<line x1="${v}" x2="${B - h}" y1="${y(0)}" y2="${y(0)}" class="akselinje"/>`;
  for (const se of serier) {
    s += `<polyline fill="none" stroke="${se.farge}" stroke-width="2" stroke-linejoin="round" points="${se.verdier.map((val, i) => `${x(i)},${y(val)}`).join(' ')}"/>`;
  }
  uker.forEach((u, i) => {
    const tips = [`Uke ${u.uke}`, ...serier.map((se) => `${se.navn}: ${fmt(se.verdier[i])} ${enhet}`)].join('\n');
    s += `<g class="treff" data-tip="${esc(tips)}"><rect x="${v + i * bw}" y="${t}" width="${bw}" height="${H - t - b}" fill="transparent"/>`;
    s += `<line x1="${x(i)}" x2="${x(i)}" y1="${t}" y2="${H - b}" class="sikte"/>`;
    for (const se of serier) s += `<circle cx="${x(i)}" cy="${y(se.verdier[i])}" r="4" fill="${se.farge}" stroke="var(--flate)" stroke-width="2" class="punkt"/>`;
    s += '</g>';
    if (i % 2 === 0 || uker.length < 20) s += `<text x="${x(i)}" y="${H - b + 16}" class="akse" text-anchor="middle">${u.uke}</text>`;
  });
  return s + '</svg>';
}

export function forklaring(serier) {
  return `<div class="forklaring">${serier.map((se) => `<span><i style="background:${se.farge}"></i>${esc(se.navn)}</span>`).join('')}</div>`;
}

// Felles verktøytips for alle elementer med data-tip
export function aktiverTips(rot) {
  let tip = document.getElementById('graftips');
  if (!tip) { tip = document.createElement('div'); tip.id = 'graftips'; tip.className = 'graftips'; document.body.append(tip); }
  rot.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('[data-tip]');
    if (!el) { tip.hidden = true; return; }
    tip.textContent = el.dataset.tip;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    const xx = Math.min(window.innerWidth - r.width - 8, e.clientX + 14);
    const yy = e.clientY + 16 + r.height > window.innerHeight ? e.clientY - r.height - 10 : e.clientY + 16;
    tip.style.left = `${Math.max(8, xx)}px`;
    tip.style.top = `${yy}px`;
  });
  rot.addEventListener('pointerleave', () => { tip.hidden = true; });
}
