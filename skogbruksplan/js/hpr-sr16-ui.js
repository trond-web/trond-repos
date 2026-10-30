// Data › 🌲 Hogstmaskindata mot SR16: last opp en HPR-fil for hele planen, og se hvor mange stammer maskinen hogde
// sammenlignet med treantallet i SR16 – totalt, per bestand og per SR16-flate, med kart og CSV. Logikken ligger i hpr-sr16.js.
import { TERSKLER, STANDARD_TERSKEL, KILDER, FARGER, lesStammer, boksFor, hentSr16, sammenlign, andel, vurdering, csv, kartGeojson } from './hpr-sr16.js';
import { simulerDrift, importNokkel } from './stanford.js';
import { fmt } from './charts.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dato = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const pst = (a) => (a == null ? '–' : `${Math.round(a * 100)} %`);
const avvikKlasse = (a) => (a == null ? 'ukjent' : a > 1.2 ? 'hoy' : a >= 0.8 ? 'ok' : a >= 0.5 ? 'lav' : 'uttak');
const TRESLAG = { G: 'Gran', F: 'Furu', L: 'Lauv' };
const lastNed = (tekst, navn) => { const url = URL.createObjectURL(new Blob([tekst], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = navn; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000); };

export function initHprSr16({ hentPlan, endret, melding, visKartlag = () => {}, visBestand = () => {}, hent = fetch }) {
  const panel = document.querySelector('#hprPanel'); if (!panel) return null;
  const S = () => hentPlan();
  let terskel = STANDARD_TERSKEL; let arbeider = ''; let valgt = null;
  const analyser = () => S().hprAnalyser || [];

  function fliser(s) {
    const a = andel(s, terskel);
    return `<div class="sf-tall hs-tall">
      <div><b>${fmt(s.stammer)}</b><span>stammer hogd</span></div>
      <div><b>${fmt(s.stammerTerskel[terskel])}</b><span>hogd ≥ ${terskel} cm${s.smlDaa < s.hogdDaa ? ` på ${fmt(s.smlDaa, 1)} daa` : ''}</span></div>
      <div><b>${fmt(s.sr16[terskel])}</b><span>SR16 anslo ≥ ${terskel} cm</span></div>
      <div class="hs-${avvikKlasse(a)}"><b>${pst(a)}</b><span>hogd av SR16</span></div>
      <div><b>${fmt(s.hogdDaa, 1)}</b><span>daa hogd areal</span></div>
      <div><b>${fmt(s.m3)}</b><span>m³fub hogd${s.m3Sr16 ? ` · SR16 ${fmt(s.m3Sr16)} m³` : ''}</span></div>
    </div>`;
  }
  // Diameterfordeling (2 cm-klasser) som små søyler, med SR16s middeldiameter markert.
  function histogram(s, srDiam) {
    const k = Object.keys(s.histogram).map(Number).sort((a, b) => a - b); if (!k.length) return '';
    const fra = k[0]; const til = k.at(-1); const maks = Math.max(...Object.values(s.histogram));
    const n = (til - fra) / 2 + 1; const w = Math.max(6, Math.min(24, Math.floor(560 / n))); const bredde = n * w + 40;
    let svg = `<svg class="hs-hist" viewBox="0 0 ${bredde} 120" role="img" aria-label="Diameterfordeling for hogde stammer">`;
    for (let d = fra, i = 0; d <= til; d += 2, i++) {
      const v = s.histogram[d] || 0; const h = (v / maks) * 90; const x = 20 + i * w;
      svg += `<rect x="${x}" y="${100 - h}" width="${w - 2}" height="${h}" fill="${d < terskel ? 'var(--text-2)' : 'var(--accent)'}" opacity="${d < terskel ? 0.4 : 0.85}"><title>${d}–${d + 2} cm: ${v} stammer</title></rect>`;
      if (i % Math.ceil(n / 10) === 0) svg += `<text x="${x + w / 2}" y="114" text-anchor="middle" class="hs-akse">${d}</text>`;
    }
    if (srDiam) { const x = 20 + ((srDiam - fra) / 2) * w; svg += `<line x1="${x}" x2="${x}" y1="4" y2="100" stroke="#d03b3b" stroke-dasharray="3 2"/><text x="${x + 3}" y="12" class="hs-akse" fill="#d03b3b">SR16 ${fmt(srDiam, 1)} cm</text>`; }
    return `${svg}</svg><p class="hint">Diameter i brysthøyde (cm) for de hogde stammene. Grå søyler er under grensen på ${terskel} cm og er ikke med i sammenligningen.</p>`;
  }

  function resultatHtml(a) {
    const res = a.resultat; const t = res.total; const v = vurdering(t, terskel);
    const diamSr = (() => { const f = res.flater.filter((x) => x.sr16Info?.diam && x.smlDaa); const sum = f.reduce((s, x) => s + x.smlDaa, 0); return sum ? f.reduce((s, x) => s + x.sr16Info.diam * x.smlDaa, 0) / sum : null; })();
    const varsler = [
      res.utenforPlan ? `${fmt(res.utenforPlan)} stammer står utenfor bestandene i planen (annen eiendom eller utenfor planområdet). De er med i totalen, men ikke i tabellen per bestand.` : null,
      t.ruterUtenSr16 ? `${fmt((t.ruterUtenSr16 * 100) / 1000, 1)} daa av hogstarealet ligger utenfor SR16-skog.` : null,
      t.ruterEtterHogst ? `NIBIO har allerede oppdatert SR16 etter denne hogsten på ${fmt((t.ruterEtterHogst * 100) / 1000, 1)} daa. Det arealet er holdt utenfor; planens treantall vises i tabellen per bestand.` : null,
      res.sr16Aar.length && res.hogstAar ? `SR16 er målt ${res.sr16Aar.join(', ')}, hogsten skjedde ${res.hogstAar}. ${res.hogstAar - Math.max(...res.sr16Aar) > 3 ? 'Trærne har vokst siden målingen, så flere kan ha passert diametergrensen.' : ''}` : null,
      a.utenPosisjon ? `${fmt(a.utenPosisjon)} stammer mangler posisjon og er ikke med.` : null,
    ].filter(Boolean);
    const treslag = Object.entries(t.treslag).filter(([, n]) => n).map(([k, n]) => `${TRESLAG[k]} ${Math.round((n / t.stammer) * 100)} %`).join(' · ');
    const srTreslag = (() => { const f = res.flater.filter((x) => x.sr16Info && x.smlDaa); const sum = f.reduce((s, x) => s + x.smlDaa, 0); if (!sum) return ''; return ['G', 'F', 'L'].map((k) => `${TRESLAG[k]} ${Math.round(f.reduce((s, x) => s + (x.sr16Info.andel[k] || 0) * x.smlDaa, 0) / sum)} %`).join(' · '); })();
    return `<div class="hs-resultat">
      <div class="detalj-topp"><h4 class="undertittel" style="margin:0">${esc(a.filer.slice(0, 2).join(', '))}${a.filer.length > 2 ? ` +${a.filer.length - 2}` : ''}</h4>
        <label class="hs-terskel">Trær over <select data-hs="terskel">${TERSKLER.map((x) => `<option value="${x}" ${x === terskel ? 'selected' : ''}>${x} cm</option>`).join('')}</select></label></div>
      <p class="hint">${res.fra ? `Hogd ${esc(dato(res.fra))}${res.til !== res.fra ? ` – ${esc(dato(res.til))}` : ''} · ` : ''}${esc(a.maskiner.join(', '))} · lest inn ${esc(dato(a.dato))}</p>
      ${fliser(t)}
      <p class="hs-vurdering hs-${v.niva}">${esc(v.tekst)}</p>
      ${varsler.map((x) => `<p class="sf-varsel">⚠ ${esc(x)}</p>`).join('')}
      <p class="hint">Treslag hogd (stammer): ${treslag || '–'}${srTreslag ? ` · SR16 (volum): ${srTreslag}` : ''} · middelstamme ${fmt(t.middelstamme, 2)} m³ · middeldiameter ${fmt(t.dbhSnitt, 1)} cm${diamSr ? ` (SR16 ${fmt(diamSr, 1)} cm)` : ''}</p>
      ${histogram(t, diamSr)}
      <h5>Per bestand</h5>
      ${res.bestand.length ? `<div class="tabell"><table class="sf-tabell"><thead><tr><th>Bestand</th><th class="t">Hogd daa</th><th class="t">Hogd ≥ ${terskel} cm</th><th class="t">SR16</th><th class="t">Hogd av SR16</th><th class="t">Plan</th><th class="t">Hogd av plan</th><th class="t">m³ hogd</th></tr></thead><tbody>
        ${res.bestand.map((b) => { const x = andel(b, terskel); return `<tr><td><a href="#" data-hs-bestand="${esc(b.id)}">${esc(b.nr)}</a> <span class="hint">${esc(b.treslag || '')}${b.bonitet ?? ''}</span></td><td class="t">${fmt(b.hogdDaa, 1)}${b.smlDaa < b.hogdDaa ? `<div class="hint">${fmt(b.smlDaa, 1)} mot SR16</div>` : ''}</td><td class="t">${fmt(b.stammerTerskel[terskel])}</td><td class="t">${b.smlDaa ? fmt(b.sr16[terskel]) : '–'}</td><td class="t"><span class="hs-pille hs-${avvikKlasse(x)}">${pst(x)}</span></td><td class="t">${b.plan != null ? fmt(b.plan) : '–'}</td><td class="t">${b.plan ? pst(b.planStammer / b.plan) : '–'}</td><td class="t">${fmt(b.m3)}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="hint">Ingen av stammene står i bestandene i planen.</p>'}
      <details class="ekstra"><summary>Per SR16-flate (${res.flater.length})</summary>
        <div class="tabell"><table class="sf-tabell"><thead><tr><th>SR16-flate</th><th>Målt</th><th class="t">Hogd daa</th><th class="t">SR16 trær/ha ≥ ${terskel} cm</th><th class="t">Hogd ≥ ${terskel} cm</th><th class="t">SR16</th><th class="t">Hogd av SR16</th></tr></thead><tbody>
        ${res.flater.map((f) => { const x = andel(f, terskel); return `<tr><td>${f.sr16Info ? `${esc(f.sr16Info.treslag)} <span class="hint">H${f.sr16Info.bonitet ?? '?'} · ${fmt(f.sr16Info.hoyde, 1)} m · ${fmt(f.sr16Info.volubHa)} m³/ha</span>` : '<span class="hint">Utenfor SR16-skog</span>'}${f.varsel.map((w) => `<div class="hint">⚠ ${esc(w)}</div>`).join('')}</td><td>${f.sr16Info?.aar ?? '–'}</td><td class="t">${fmt(f.hogdDaa, 1)}</td><td class="t">${f.sr16Info ? fmt(f.sr16Info.trean[terskel]) : '–'}</td><td class="t">${fmt(f.stammerTerskel[terskel])}</td><td class="t">${f.smlDaa ? fmt(f.sr16[terskel]) : '–'}</td><td class="t"><span class="hs-pille hs-${avvikKlasse(x)}">${pst(x)}</span></td></tr>`; }).join('')}
        </tbody></table></div></details>
      <details class="ekstra"><summary>Slik leses tallene</summary><ul class="sf-liste">
        <li><b>Hogd areal</b> er 10 × 10 m-ruter med stammer fra maskinen (posisjon ved kranspissen), med små hull mellom stammene fylt inn.</li>
        <li><b>SR16 anslo</b> er treantallet i SR16-flaten (trær per ha med diameter over grensen) ganget med det hogde arealet i flaten.</li>
        <li><b>Hogd ≥ ${terskel} cm</b> teller bare stammer der maskinen har målt brysthøydediameter over grensen, så like trær sammenlignes. Hogstmaskinen tar sjelden trær under 8–10 cm, derfor er 10 cm standard.</li>
        <li><b>Hogd av SR16:</b> rundt 100 % ved flatehogst betyr at SR16 traff. Over 120 % betyr at SR16 hadde for få trær, under 80 % for mange (eller at trær ble stående). Ved tynning er 25–40 % vanlig.</li>
        <li>SR16 er laget fra laserskanning og satellitt, og treantallet er den mest usikre verdien (ofte ±30–40 % per flate). Se <a href="${KILDER.validering.url}" target="_blank" rel="noopener">NIBIOs validering</a> og <a href="${KILDER.produktark.url}" target="_blank" rel="noopener">produktarket</a>.</li>
        <li><b>Plan</b> er bestandets treantall i planen (fra taksten eller fra SR16 da planen ble laget) på det samme arealet, sammenlignet med alle hogde stammer.</li>
      </ul></details>
      <div class="knapperad"><button type="button" class="knapp liten" data-hs="kart">Vis i kartet</button><button type="button" class="knapp liten" data-hs="csv-bestand">⬇ CSV per bestand</button><button type="button" class="knapp liten" data-hs="csv-flater">⬇ CSV per SR16-flate</button><button type="button" class="knapp liten fare" data-hs="slett">Slett</button></div>
      <p class="hint hs-legende">Kart: ${[['ok', '80–120 %'], ['hoy', 'over 120 % (SR16 for lavt)'], ['lav', '50–80 %'], ['uttak', 'under 50 % (tynning)'], ['ukjent', 'ikke sammenlignbart']].map(([k, tx]) => `<span><i style="background:${FARGER[k]}"></i>${tx}</span>`).join('')}</p>
    </div>`;
  }

  function tegn() {
    const liste = analyser(); const a = liste.find((x) => x.id === valgt) || liste.at(-1) || null; if (a) valgt = a.id;
    panel.innerHTML = `<h3>🌲 Hogstmaskindata mot SR16</h3>
      <p class="hint">Last opp en HPR-fil (StanForD 2010) fra hogstmaskinen. SkogIQ henter SR16 for området der stammene står, og viser hvor mange stammer som ble hogd sammenlignet med treantallet i SR16 – totalt, per bestand og per SR16-flate.</p>
      <div class="slipp-sone hs-slipp" data-hs-slipp>Dra HPR-fila hit, eller <label class="lenke">velg fil<input type="file" data-hs-fil multiple accept=".hpr,.hprz,.zip,.env" hidden></label>${S().bestand?.some((b) => b.geometri) ? ' · <a href="#" data-hs="simuler">prøv med simulert hogst</a>' : ''}</div>
      ${arbeider ? `<p class="hs-arbeider">⏳ ${esc(arbeider)}</p>` : ''}
      ${liste.length > 1 ? `<label class="hs-velg">Analyse <select data-hs="velg">${liste.map((x) => `<option value="${esc(x.id)}" ${x.id === valgt ? 'selected' : ''}>${esc(dato(x.dato))} – ${esc(x.filer[0] || '')} (${fmt(x.resultat.total.stammer)} stammer)</option>`).join('')}</select></label>` : ''}
      ${a ? resultatHtml(a) : ''}`;
  }

  async function lesFiler(filer) {
    arbeider = 'Leser fila …'; tegn();
    try {
      const st = await lesStammer(filer);
      if (!st.medPosisjon.length) throw new Error('Stammene i fila har ingen posisjon – sammenligningen trenger koordinater.');
      arbeider = `${fmt(st.stammer.length)} stammer lest. Henter SR16 fra NIBIO …`; tegn();
      const flater = await hentSr16(boksFor(st.medPosisjon), { hent, logg: (t) => { arbeider = t; tegn(); } });
      arbeider = 'Sammenligner …'; tegn();
      const resultat = sammenlign(S(), st.stammer, flater);
      const id = importNokkel(filer);
      const ny = { id, dato: new Date().toISOString(), filer: st.filer.filter((f) => /\.hpr$/i.test(f)).slice(0, 10), maskiner: [...new Set(st.maskiner.map((m) => [m.produsent, m.modell].filter(Boolean).join(' ')).filter(Boolean))], utenPosisjon: st.stammer.length - st.medPosisjon.length, resultat };
      const plan = S(); plan.hprAnalyser = [...(plan.hprAnalyser || []).filter((x) => x.id !== id), ny].slice(-10);
      valgt = id; arbeider = ''; endret({ kart: false }); tegn();
      visKartlag(kartGeojson(ny.resultat, terskel));
      melding(`${fmt(resultat.total.stammer)} stammer sammenlignet med SR16.`);
    } catch (e) { arbeider = ''; tegn(); melding(e.message || 'Klarte ikke å lese fila.'); }
  }
  // Simulert hogst i det største hogstmodne bestandet (for å prøve uten egen fil).
  function simuler() {
    const plan = S(); const b = [...plan.bestand].filter((x) => x.geometri).sort((x, y) => (y.alder || 0) * (y.areal || 0) - (x.alder || 0) * (x.areal || 0))[0]; if (!b) return;
    const t = { id: 'sim', type: 'sluttavvirkning', aar: new Date().getFullYear(), status: 'planlagt' };
    const kopi = { ...plan, bestand: [{ ...b, tiltak: [t] }] }; const o = { id: 'sim', nr: `SIM-${b.nr}`, type: 'sluttavvirkning', linjer: [{ bestandId: b.id, tiltakId: 'sim' }] };
    lesFiler(simulerDrift(kopi, o, { maksStammer: 8000 }).filter((f) => f.navn.endsWith('.hpr')).map((f) => ({ navn: f.navn, data: new TextEncoder().encode(f.data) })));
  }

  panel.addEventListener('click', (e) => {
    const k = e.target.closest('[data-hs]')?.dataset.hs; const bl = e.target.closest('[data-hs-bestand]');
    const a = analyser().find((x) => x.id === valgt);
    if (bl) { e.preventDefault(); visBestand(bl.dataset.hsBestand); return; }
    if (!k || e.target.tagName === 'SELECT') return;
    if (k === 'simuler') { e.preventDefault(); simuler(); return; }
    if (!a) return;
    if (k === 'kart') visKartlag(kartGeojson(a.resultat, terskel));
    if (k === 'csv-bestand') lastNed(csv(a.resultat, 'bestand', terskel), 'hogst-mot-sr16-bestand.csv');
    if (k === 'csv-flater') lastNed(csv(a.resultat, 'flater', terskel), 'hogst-mot-sr16-flater.csv');
    if (k === 'slett' && confirm('Slette denne sammenligningen?')) { const plan = S(); plan.hprAnalyser = analyser().filter((x) => x.id !== a.id); valgt = null; visKartlag(null); endret({ kart: false }); tegn(); }
  });
  panel.addEventListener('change', (e) => {
    const f = e.target;
    if (f.matches('[data-hs-fil]')) { const l = [...f.files]; f.value = ''; if (l.length) Promise.all(l.map(async (x) => ({ navn: x.name, data: new Uint8Array(await x.arrayBuffer()) }))).then(lesFiler); return; }
    if (f.dataset.hs === 'terskel') { terskel = Number(f.value); tegn(); const a = analyser().find((x) => x.id === valgt); if (a) visKartlag(kartGeojson(a.resultat, terskel)); }
    if (f.dataset.hs === 'velg') { valgt = f.value; tegn(); }
  });
  panel.addEventListener('dragover', (e) => { if (e.target.closest('[data-hs-slipp]')) { e.preventDefault(); e.target.closest('[data-hs-slipp]').classList.add('over'); } });
  panel.addEventListener('dragleave', (e) => e.target.closest('[data-hs-slipp]')?.classList.remove('over'));
  panel.addEventListener('drop', (e) => { const z = e.target.closest('[data-hs-slipp]'); if (!z) return; e.preventDefault(); z.classList.remove('over'); const l = [...e.dataTransfer.files]; Promise.all(l.map(async (x) => ({ navn: x.name, data: new Uint8Array(await x.arrayBuffer()) }))).then(lesFiler); });
  tegn();
  return { tegn, lesFiler: (filer) => { panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); return lesFiler(filer); } };
}
