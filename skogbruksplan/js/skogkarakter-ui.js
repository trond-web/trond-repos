// 🌲 SkogIQ Skogkarakter i Oversikt (js/skogkarakter.js): stempel, poeng per område, datadekning, «slik øker du
// karakteren», årlig utvikling, karakterbevis til utskrift og nedlasting av stempelet. Karakteren er skogeierens egen
// vurdering: den beregnes i nettleseren fra planen og deles bare når eieren selv skriver ut eller laster ned.
import * as SK from './skogkarakter.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DELING = 'Karakteren er din egen vurdering, beregnet i SkogIQ.ai fra dataene i planen. Den vises ikke for andre, og den deles bare når du selv skriver ut karakterbeviset eller laster ned stempelet.';

export function initSkogkarakter({ rot, hentPlan, endret = () => {}, visBestand = () => {}, melding = () => {}, iAar = new Date().getFullYear() }) {
  let sist = null; let apen = false;
  const S = () => hentPlan();

  const stolpe = (o) => `<div class="sk-omr${o.poeng == null ? ' ukjent' : ''}"><span class="sk-omr-navn">${o.ikon} ${esc(o.navn)} <small>${o.vekt} %</small></span>
    <span class="sk-bar"><i style="width:${o.poeng ?? 0}%;background:${o.poeng == null ? 'transparent' : SK.karakterFor(o.poeng).farge}"></i></span><b>${o.poeng == null ? 'ukjent' : o.poeng}</b></div>`;
  function detaljer(r) {
    const hist = S().skogkarakter?.historikk || [];
    return `<div class="sk-detaljer">
      ${r.forbedringer.length ? `<h4 class="undertittel">⬆ Slik øker du karakteren</h4><ul class="sk-forb">${r.forbedringer.slice(0, 10).map((f) => `<li${f.bestandId ? ` data-sk-bestand="${esc(f.bestandId)}" tabindex="0"` : ''}><span class="sk-pluss">+${f.poeng}</span>${f.ikon} ${esc(f.tekst)}</li>`).join('')}</ul>` : '<p class="hint">Ingen konkrete forbedringer – godt drevet! 🌲</p>'}
      ${r.datatiltak.length ? `<h4 class="undertittel">🔎 Gjør karakteren sikrere (mer data)</h4><ul class="sk-forb data">${r.datatiltak.slice(0, 6).map((f) => `<li>${f.ikon} ${esc(f.tekst)}</li>`).join('')}</ul>` : ''}
      ${r.omrader.map((o) => `<details class="sk-omr-det"><summary>${o.ikon} ${esc(o.navn)} <b>${o.poeng == null ? 'ukjent' : `${o.poeng} poeng`}</b></summary><ul>${o.indikatorer.map((x) => `<li><span class="sk-ind ${x.poeng == null ? 'ukjent' : x.poeng >= 0.85 ? 'god' : x.poeng >= 0.5 ? 'middels' : 'svak'}">${x.poeng == null ? '–' : Math.round(x.poeng * 100)}</span><div><b>${esc(x.navn)}</b><small>${esc(x.tekst)}</small></div></li>`).join('')}</ul></details>`).join('')}
      ${hist.length > 1 ? `<h4 class="undertittel">📅 Utvikling</h4><div class="sk-hist">${hist.map((h) => `<div><span>${h.aar}</span><b style="color:${SK.karakterFor(h.total ?? 0).farge}">${h.karakter || '–'}</b><small>${h.total ?? ''}</small></div>`).join('')}</div>` : ''}
      <p class="hint">Karakteren bygger på skogbruksloven og forskrift om berekraftig skogbruk (foryngelse innen 3 år), Norsk PEFC Skogstandard og Landbruksdirektoratets kontroll av foryngelse og miljøhensyn. Indikatorer uten data gir ikke minuspoeng. ${esc(DELING)}</p>
    </div>`;
  }
  function tegn() {
    const el = rot(); const p = S(); if (!el) return;
    if (!p?.bestand?.length) { el.innerHTML = ''; el.hidden = true; return; }
    el.hidden = false;
    const r = SK.beregnSkogkarakter(p, { iAar }); sist = r;
    // Årlig øyeblikksbilde – lagres bare når noe er endret
    const h = p.skogkarakter?.historikk?.find((x) => x.aar === r.aar);
    if (!h || h.total !== r.total || h.dekning !== r.dekning) { SK.lagreOyeblikk(p, r); endret(); }
    el.innerHTML = `<div class="sk-topp"><div class="sk-stempel-boks">${SK.stempelSvg(r, { str: 132, id: 'skO' })}</div>
      <div class="sk-sum"><h3>SkogIQ Skogkarakter <span class="hint">hvor godt og bærekraftig skogen drives</span></h3>
        <p class="sk-total"><b style="color:${r.farge}">${r.karakter || '–'} · ${esc(r.navn)}</b> ${r.total != null ? `<span>${r.total} av 100 poeng</span>` : ''}</p>
        <div class="sk-dekning" title="Hvor stor del av vurderingen som bygger på faktiske data"><span>Datadekning ${r.dekning} %${r.forelopig ? ' – foreløpig karakter' : ''}</span><span class="sk-bar"><i style="width:${r.dekning}%"></i></span></div>
        <div class="sk-omrader">${r.omrader.map(stolpe).join('')}</div>
        <div class="knapperad"><button type="button" class="knapp liten" data-sk="detaljer">${apen ? 'Skjul detaljer' : `Detaljer${r.forbedringer.length ? ` og ${r.forbedringer.length} forbedringer` : ''}`}</button><button type="button" class="knapp liten" data-sk="bevis">🖨 Karakterbevis</button><button type="button" class="knapp liten" data-sk="svg">⬇ Stempel</button></div>
      </div></div>${apen ? detaljer(r) : ''}`;
  }

  // ---------- deling (bare når eieren selv velger det) ----------
  function bevisHtml() {
    const p = S(); const r = sist || SK.beregnSkogkarakter(p, { iAar }); const e = p.eiendom || {};
    return `<!doctype html><html lang="nb"><head><meta charset="utf-8"><title>SkogIQ Skogkarakter – ${esc(e.navn || '')}</title><style>
      body{font:13px/1.5 system-ui,sans-serif;color:#111;max-width:760px;margin:28px auto;padding:0 18px} .topp{display:flex;gap:24px;align-items:center;border-bottom:3px solid ${r.farge};padding-bottom:14px}
      h1{font-size:24px;margin:0} h2{font-size:15px;margin:20px 0 6px} table{width:100%;border-collapse:collapse} td,th{text-align:left;padding:5px 6px;border-bottom:1px solid #ddd} td.t{text-align:right} .hint{color:#555;font-size:11.5px}
      .bar{display:inline-block;width:160px;height:8px;background:#eee;border-radius:4px;vertical-align:middle;margin-right:8px} .bar i{display:block;height:100%;border-radius:4px}</style></head><body>
      <div class="topp">${SK.stempelSvg(r, { str: 170, id: 'skB' })}<div><h1>SkogIQ Skogkarakter: ${esc(r.karakter || '–')} – ${esc(r.navn)}</h1><p>${esc(e.navn || 'Skogeiendommen')}${e.gnrbnr ? ` · gnr/bnr ${esc(e.gnrbnr)}` : ''}${e.kommune ? ` · ${esc(e.kommune)}` : ''}</p>
      <p><b>${r.total ?? '–'} av 100 poeng</b> · datadekning ${r.dekning} %${r.forelopig ? ' (foreløpig)' : ''} · beregnet ${new Date(r.dato).toLocaleDateString('nb-NO')}</p></div></div>
      <h2>Områder</h2><table>${r.omrader.map((o) => `<tr><td>${o.ikon} ${esc(o.navn)} <span class="hint">(${o.vekt} %)</span></td><td><span class="bar"><i style="width:${o.poeng ?? 0}%;background:${o.poeng == null ? '#eee' : SK.karakterFor(o.poeng).farge}"></i></span>${o.poeng ?? 'ukjent'}</td></tr>`).join('')}</table>
      <h2>Grunnlag</h2><table>${r.omrader.flatMap((o) => o.indikatorer.map((x) => `<tr><td>${esc(x.navn)}</td><td class="hint">${esc(x.tekst)}</td><td class="t">${x.poeng == null ? '–' : Math.round(x.poeng * 100)}</td></tr>`)).join('')}</table>
      <p class="hint">Karakterskala: A ≥ 85 (fremragende) · B ≥ 70 (god) · C ≥ 55 (tilfredsstillende) · D ≥ 40 (svak) · E under 40 (mangelfull). Kriteriene bygger på skogbruksloven og forskrift om berekraftig skogbruk, Norsk PEFC Skogstandard og Landbruksdirektoratets kontroll av foryngelse og miljøhensyn. Egenvurdering beregnet av SkogIQ.ai fra eierens egne plandata – ikke en sertifisering eller offentlig kontroll.</p>
      <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`;
  }
  function lastNedStempel() {
    const r = sist || SK.beregnSkogkarakter(S(), { iAar });
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n${SK.stempelSvg(r, { str: 600, id: 'skD' }).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')}`;
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); a.download = `skogkarakter-${r.karakter || 'x'}-${r.aar}.svg`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    melding('Stempelet er lastet ned. Du bestemmer selv hvem du deler det med.');
  }
  document.addEventListener('click', (e) => {
    const k = e.target.closest?.('[data-sk]'); const b = e.target.closest?.('[data-sk-bestand]');
    if (b && rot()?.contains(b)) { visBestand(b.dataset.skBestand); return; }
    if (!k || !rot()?.contains(k)) return;
    if (k.dataset.sk === 'detaljer') { apen = !apen; tegn(); }
    if (k.dataset.sk === 'svg') lastNedStempel();
    if (k.dataset.sk === 'bevis') { const w = window.open('', '_blank'); if (!w) { melding('Nettleseren stoppet utskriftsvinduet. Tillat sprettoppvinduer og prøv igjen.'); return; } w.document.open(); w.document.write(bevisHtml()); w.document.close(); }
  });
  return { tegn, bevisHtml, resultat: () => sist };
}
