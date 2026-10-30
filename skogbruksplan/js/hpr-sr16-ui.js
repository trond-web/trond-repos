// Data › 🌲 Hogstmaskindata mot SR16: last opp en HPR-fil for hele planen, og se hvor mange stammer maskinen hogde
// sammenlignet med treantallet i SR16 – totalt, per bestand og per SR16-flate, med kart og CSV. Logikken ligger i hpr-sr16.js.
import { TERSKLER, STANDARD_TERSKEL, KILDER, FARGER, STIKKVEI_BREDDE, lesStammer, boksFor, hentSr16, sammenlign, andel, vurdering, csv, kartGeojson, tynning, erTynning, simulerTynning } from './hpr-sr16.js';
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
  let terskel = STANDARD_TERSKEL; let arbeider = ''; let valgt = null; let form = 'auto'; // hogstform: auto | tynning | flate
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

  // ---------- tynning ----------
  const ikon = (ok) => (ok === true ? '<span class="hs-ok-ikon" aria-label="OK">✓</span>' : ok === false ? '<span class="hs-feil-ikon" aria-label="Avvik">✗</span>' : '<span class="hs-obs-ikon" aria-label="Vurder">!</span>');
  const kildeLenke = (id) => (KILDER[id] ? `<a href="${KILDER[id].url}" target="_blank" rel="noopener" title="${esc(KILDER[id].navn)}">${esc({ statskog: 'Statskog', skogkurs: 'Skogkurs', nibio: 'NIBIO', snl: 'SNL' }[id] || id)}</a>` : '');
  // Søyler per diameterklasse: SR16-treantall før (grått) og andelen maskinen tok (farget).
  function klasseSoyler(k) {
    const maks = Math.max(1, ...k.klasser.map((x) => x.sr16PerDaa || 0)); const w = 120; const bredde = k.klasser.length * w + 20;
    let svg = `<svg class="hs-hist" viewBox="0 0 ${bredde} 150" role="img" aria-label="Uttak per diameterklasse">`;
    k.klasser.forEach((x, i) => {
      const hx = 20 + i * w; const hF = ((x.sr16PerDaa || 0) / maks) * 100; const hU = ((x.uttakPerDaa || 0) / maks) * 100;
      svg += `<rect x="${hx}" y="${110 - hF}" width="${w - 30}" height="${hF}" fill="var(--surface-2)" stroke="var(--border)"><title>SR16: ${fmt(x.sr16PerDaa)} trær per daa</title></rect>`;
      svg += `<rect x="${hx}" y="${110 - hU}" width="${w - 30}" height="${hU}" fill="var(--accent)" opacity=".85"><title>Tatt ut: ${fmt(x.uttakPerDaa, 1)} per daa</title></rect>`;
      svg += `<text x="${hx + (w - 30) / 2}" y="${Math.max(12, 104 - hF)}" text-anchor="middle" class="hs-akse hs-fet">${x.andel == null ? '–' : `${Math.round(x.andel * 100)} %`}</text>`;
      svg += `<text x="${hx + (w - 30) / 2}" y="126" text-anchor="middle" class="hs-akse">${x.til ? `${x.fra}–${x.til} cm` : `over ${x.fra} cm`}</text>`;
      svg += `<text x="${hx + (w - 30) / 2}" y="140" text-anchor="middle" class="hs-akse">${fmt(x.uttakPerDaa, 0)} av ${fmt(x.sr16PerDaa, 0)}/daa</text>`;
    });
    return `${svg}</svg><p class="hint"><span class="hs-leg" style="background:var(--surface-2)"></span>trær per daa i SR16 før tynning <span class="hs-leg" style="background:var(--accent)"></span>tatt ut av maskinen · prosent = andel av klassen som er tatt. Ved tynning nedenfra tas mest av de små trærne og lite av de store.</p>`;
  }
  function tynningHtml(a) {
    const res = a.resultat; const k = tynning(res.total);
    if (!k) return '<p class="sf-varsel">⚠ SR16 kan ikke brukes som «før»-tilstand her (utenfor SR16-skog eller oppdatert etter hogsten).</p>';
    const rader = res.bestand.filter((b) => b.hogdDaa >= 2).map((b) => ({ b, k: tynning(b, { treslag: b.treslag }) })).filter((x) => x.k); // kantruter i nabobestand vises ikke
    const status = (kk) => { const f = kk.kriterier.filter((c) => c.ok === false).length; return f ? `<span class="hs-pille hs-hoy">${f} avvik</span>` : '<span class="hs-pille hs-ok">OK</span>'; };
    return `<div class="hs-tynning">
      <div class="sf-tall hs-tall">
        <div><b>${fmt(k.gFor, 1)} → ${fmt(k.gEtter, 1)}</b><span>grunnflate m²/ha før → etter</span></div>
        <div class="hs-${k.uttakG > 0.35 ? 'hoy' : 'ok'}"><b>${fmt(k.uttakG * 100)} %</b><span>uttak av grunnflaten</span></div>
        <div><b>${fmt(k.nForDaa)} → ${fmt(k.nEtterDaa)}</b><span>trær per daa før → etter (${fmt(k.uttakN * 100)} % tatt)</span></div>
        <div><b>${fmt(k.m3PerDaa, 1)}</b><span>m³fub tatt ut per daa</span></div>
        <div class="hs-${k.kvotient > 1.1 ? 'hoy' : k.kvotient <= 1 ? 'ok' : 'lav'}"><b>${fmt(k.kvotient, 2)}</b><span>tynningskvotient (${fmt(k.dgUttak, 1)} / ${fmt(k.dgFor, 1)} cm)</span></div>
        ${k.avstand ? `<div class="hs-${k.avstand >= 19 ? 'ok' : 'hoy'}"><b>ca. ${fmt(k.avstand)} m</b><span>mellom stikkveiene${res.kran ? ` · kran ${fmt(res.kran, 1)} m` : ''}</span></div>` : ''}
      </div>
      <h5>Sjekk mot anbefalingene</h5>
      <ul class="hs-krit">${k.kriterier.map((c) => `<li>${ikon(c.ok)}<div><b>${esc(c.navn)}: ${esc(c.verdi)}</b> <span class="hint">krav/anbefaling: ${esc(c.krav)} · ${kildeLenke(c.kilde)}</span><div class="hint">${esc(c.hjelp)}</div></div></li>`).join('')}
        ${res.harBasePos ? '' : '<li><span class="hs-obs-ikon">!</span><div><b>Stikkveier</b> <span class="hint">Fila har ikke maskinens posisjon, så stikkveiene kan ikke beregnes.</span></div></li>'}</ul>
      <h5>Uttak per diameterklasse</h5>
      ${klasseSoyler(k)}
      ${k.lauvFor != null ? `<p class="hint">Lauv: ${fmt(k.lauvFor)} % i SR16 (volum), ${fmt(k.lauvUttak)} % av stammene som er tatt. ${k.lauvUttak > k.lauvFor + 15 ? 'Mye lauv er tatt ut – spar noe lauv for artsmangfold og mot rotråte.' : ''}</p>` : ''}
      ${rader.length ? `<h5>Per bestand</h5><div class="tabell"><table class="sf-tabell"><thead><tr><th>Bestand</th><th class="t">Grunnflate før</th><th class="t">Uttak</th><th class="t">Etter</th><th class="t">Trær/daa etter</th><th class="t">Kvotient</th><th class="t">Stikkvei</th><th>Status</th></tr></thead><tbody>
        ${rader.map(({ b, k: x }) => `<tr><td><a href="#" data-hs-bestand="${esc(b.id)}">${esc(b.nr)}</a> <span class="hint">${esc(b.treslag || '')}${b.bonitet ?? ''}</span></td><td class="t">${fmt(x.gFor, 1)}</td><td class="t">${fmt(x.uttakG * 100)} %</td><td class="t">${fmt(x.gEtter, 1)}</td><td class="t">${fmt(x.nEtterDaa)}</td><td class="t">${fmt(x.kvotient, 2)}</td><td class="t">${x.avstand ? `${fmt(x.avstand)} m` : '–'}</td><td>${status(x)}</td></tr>`).join('')}
      </tbody></table></div>` : ''}
      <details class="ekstra"><summary>Slik regnes tynningen</summary><ul class="sf-liste">
        <li><b>Før tynning</b> er SR16: grunnflate (m²/ha), treantall og overhøyde i flaten. SR16 må være målt før hogsten.</li>
        <li><b>Tatt ut</b> er grunnflaten til hver stamme fra diameteren maskinen målte (π/4 · d²), summert over det tynnede arealet. <b>Etter</b> = før − tatt ut. Arealet regnes med stikkveiene, slik Statskog gjør det.</li>
        <li><b>Tynningskvotient</b> = middeldiameter (grunnflatevektet) for trærne som er tatt / for bestandet før. Under 1 er tynning nedenfra, der de svake trærne tas og de beste står igjen.</li>
        <li><b>Stikkveiene</b> er maskinens kjørespor (posisjonen til maskinen, ikke kranspissen). Avstanden er tynnet areal delt på lengden, og arealandelen regnes med ${STIKKVEI_BREDDE} m bredde.</li>
        <li>Kravene er hentet fra ${kildeLenke('statskog')} (maks 35 % av grunnflaten, stikkveier minst 20 m fra hverandre og maks 4,5 m brede), ${kildeLenke('skogkurs')} (gjenstående grunnflate i gran), ${kildeLenke('nibio')} (tidspunkt og stikkveier) og ${kildeLenke('snl')} (de beste trærne skal stå). SR16 er usikker per flate (grunnflate og treantall ofte ±30 %), så se på flere bestand samlet.</li>
      </ul></details>
    </div>`;
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
      <div class="hs-form" role="group" aria-label="Hogstform">${[['auto', `Automatisk (${erTynning(res, S()) ? 'tynning' : 'flatehogst'})`], ['tynning', 'Tynning'], ['flate', 'Flatehogst']].map(([kk, tx]) => `<button type="button" data-hs-form="${kk}" class="${form === kk ? 'aktiv' : ''}">${esc(tx)}</button>`).join('')}</div>
      ${tynningVis(a) ? tynningHtml(a) : ''}
      ${tynningVis(a) ? '<h5>Stammetall mot SR16</h5>' : ''}
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
      <div class="slipp-sone hs-slipp" data-hs-slipp>Dra HPR-fila hit, eller <label class="lenke">velg fil<input type="file" data-hs-fil multiple accept=".hpr,.hprz,.zip,.env" hidden></label>${S().bestand?.some((b) => b.geometri) ? ' · prøv med simulert <a href="#" data-hs="simuler-tynning">tynning</a> eller <a href="#" data-hs="simuler">flatehogst</a>' : ''}</div>
      ${arbeider ? `<p class="hs-arbeider">⏳ ${esc(arbeider)}</p>` : ''}
      ${liste.length > 1 ? `<label class="hs-velg">Analyse <select data-hs="velg">${liste.map((x) => `<option value="${esc(x.id)}" ${x.id === valgt ? 'selected' : ''}>${esc(dato(x.dato))} – ${esc(x.filer[0] || '')} (${fmt(x.resultat.total.stammer)} stammer)</option>`).join('')}</select></label>` : ''}
      ${a ? resultatHtml(a) : ''}`;
  }

  const tynningVis = (a) => (form === 'auto' ? erTynning(a.resultat, S()) : form === 'tynning');
  async function lesFiler(filer, ferdig = null) {
    arbeider = 'Leser fila …'; tegn();
    try {
      const st = ferdig || await lesStammer(filer);
      if (!st.medPosisjon.length) throw new Error('Stammene i fila har ingen posisjon – sammenligningen trenger koordinater.');
      arbeider = `${fmt(st.stammer.length)} stammer lest. Henter SR16 fra NIBIO …`; tegn();
      const flater = await hentSr16(boksFor(st.medPosisjon), { hent, logg: (t) => { arbeider = t; tegn(); } });
      arbeider = 'Sammenligner …'; tegn();
      const resultat = sammenlign(S(), st.stammer, flater);
      const id = ferdig ? `sim${Date.now().toString(36)}` : importNokkel(filer);
      const ny = { id, dato: new Date().toISOString(), filer: st.filer.filter((f) => /\.hpr$/i.test(f)).slice(0, 10), maskiner: [...new Set(st.maskiner.map((m) => [m.produsent, m.modell].filter(Boolean).join(' ')).filter(Boolean))], utenPosisjon: st.stammer.length - st.medPosisjon.length, resultat };
      const plan = S(); plan.hprAnalyser = [...(plan.hprAnalyser || []).filter((x) => x.id !== id), ny].slice(-10);
      valgt = id; arbeider = ''; endret({ kart: false }); tegn();
      visKartlag(kartGeojson(ny.resultat, terskel));
      melding(`${fmt(resultat.total.stammer)} stammer sammenlignet med SR16.`);
    } catch (e) { arbeider = ''; tegn(); melding(e.message || 'Klarte ikke å lese fila.'); }
  }
  // Simulert tynning i et bestand med planlagt tynning (ellers det største i hogstklasse III–IV).
  function simulerTyn() {
    const plan = S(); const med = plan.bestand.filter((x) => x.geometri);
    const b = med.find((x) => (x.tiltak || []).some((t) => t.type === 'tynning' && t.status !== 'utfort')) || [...med].filter((x) => (x.alder || 0) >= 30 && (x.alder || 0) <= 70).sort((x, y) => (y.areal || 0) - (x.areal || 0))[0] || med[0]; if (!b) return;
    const st = simulerTynning(b, { dato: new Date().toISOString().slice(0, 10) });
    form = 'tynning';
    lesFiler([], { stammer: st, medPosisjon: st, maskiner: [{ produsent: 'Simulert', modell: `tynning i bestand ${b.nr}` }], objekter: [], filer: [`SIM-tynning-${b.nr}.hpr`] });
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
    const fk = e.target.closest('[data-hs-form]'); if (fk) { form = fk.dataset.hsForm; tegn(); return; }
    if (!k || e.target.tagName === 'SELECT') return;
    if (k === 'simuler') { e.preventDefault(); form = 'auto'; simuler(); return; }
    if (k === 'simuler-tynning') { e.preventDefault(); simulerTyn(); return; }
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
