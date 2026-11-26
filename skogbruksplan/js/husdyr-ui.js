// 🐄 Underfanen «Husdyr» i Skifteplan: dyrehold, husdyrgjødsel og fôrbalanse (beregningene i husdyr.js).
import { DYRESLAG, FORUTSETNINGER, tomtDyrehold, nyttDyr, verdier, husdyrgjodsel, forbalanse, kontrollerHusdyr, fordelHusdyrgjodsel, beiteplan, kontrollerBeite, nyBeiteperiode, beitekapasitet, dm, dyrerom, kontrollerRom, nyttRom, FORSKRIFTER, produksjonstilskudd, PT_KILDE, SONER, ptRegion } from './husdyr.js';
import { gjodselbehov, KULTURER, JORDSMONN_KARTLAG } from './skifteplan.js';
import { fmt } from './charts.js';
import { lagMattilsynetUi } from './mattilsynet-ui.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n0 = (x) => fmt(Math.round(x || 0), 0);
const n1 = (x) => fmt(x || 0, 1);
const tall = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? '' : Number(v));
const GRUPPER = [...new Set(Object.values(DYRESLAG).map((d) => d.gruppe))];
const status = (x, ok = 'Nok', ikke = 'Underskudd') => (x >= 0 ? `<span class="hd-ok">✓ ${ok}</span>` : `<span class="hd-ikke">✕ ${ikke}</span>`);

export function lagHusdyrUi({ SP, aar, hentPlan, lagre, melding, nyId, visGjodsling }) {
  const mt = lagMattilsynetUi({ hentPlan, lagre, melding, nyId });
  const DH = () => { const p = SP(); if (!p.dyrehold) p.dyrehold = tomtDyrehold(); if (!p.dyrehold.forutsetninger) p.dyrehold.forutsetninger = {}; return p.dyrehold; };

  function dyrHtml(dh) {
    const valg = (slag) => GRUPPER.map((g) => `<optgroup label="${esc(g)}">${Object.entries(DYRESLAG).filter(([, d]) => d.gruppe === g).map(([id, d]) => `<option value="${id}" ${id === slag ? 'selected' : ''}>${d.ikon} ${esc(d.navn)}</option>`).join('')}</optgroup>`).join('');
    return `<div class="kort"><div class="detalj-topp"><h3>🐄 Dyrehold</h3><button type="button" class="knapp liten" data-hd="ny">+ Dyreslag</button></div>
      ${dh.dyr.length ? `<div class="tabell-wrap"><table class="tabell sp-tabell hd-tabell"><thead><tr><th>Dyreslag</th><th class="tall">Antall</th><th class="tall" title="Måneder innefôring i året – resten av året på beite">Inne (mnd)</th><th class="tall" title="Grovfôr per dyr og år, inkludert beite">Grovfôr FEm/dyr</th><th class="tall" title="Kraftfôr per dyr og år">Kraftfôr kg/dyr</th><th class="tall" title="Fosfor i gjødsla per dyr og år">P kg/dyr</th><th></th></tr></thead><tbody>
        ${dh.dyr.map((r) => { const v = verdier(r); const d = DYRESLAG[r.slag] || DYRESLAG.melkeku; const felt = (f, steg) => `<input type="number" min="0" step="${steg}" data-hd-f="${f}" value="${r[f] ?? ''}" placeholder="${d[f]}" class="hd-tall">`;
          return `<tr data-hd-rad="${r.id}"><td><select data-hd-f="slag">${valg(r.slag)}</select><div class="hint">${v.per === 'produsert' ? 'Antall produsert per år' : 'Gjennomsnittlig antall dyr'}</div></td>
            <td class="tall"><input type="number" min="0" step="1" data-hd-f="antall" value="${r.antall ?? ''}" class="hd-tall"></td>
            <td class="tall">${felt('inne', 1)}</td><td class="tall">${felt('grovfor', 50)}</td><td class="tall">${felt('kraftfor', d.kraftfor < 10 ? 0.5 : 10)}</td><td class="tall">${felt('P', d.P < 1 ? 0.01 : 0.5)}</td>
            <td><button type="button" class="knapp liten" data-hd="slett" title="Fjern dyreslaget">✕</button></td></tr>`; }).join('')}
      </tbody></table></div>
      <p class="hint">Tomme felt bruker typiske tall for dyreslaget (grå). Skriv inn egne tall fra driften din for å overstyre.</p>`
      : `<p class="hint">Legg inn dyrene på gården – melkekyr, ammekyr, ungdyr, sau, geit, hest, alpakka, høner, kylling, kalkun eller gris. Da beregnes husdyrgjødsla (mengde, fosfor, lager og spredeareal) og fôrbalansen mot avlingene i skifteplanen.</p>
        <div class="knapperad">${['melkeku', 'ammeku', 'sau', 'hest', 'verpehone'].map((id) => `<button type="button" class="knapp liten" data-hd="ny" data-slag="${id}">${DYRESLAG[id].ikon} ${esc(DYRESLAG[id].navn)}</button>`).join('')}</div>`}
    </div>`;
  }

  function gjodselHtml(g, dh, a) {
    if (!g.rader.length) return '';
    const lagerOk = g.lager == null ? null : g.lager - g.lagerBehov;
    const arealOk = g.grense && g.areal ? g.areal - g.arealBehov : null;
    return `<div class="kort"><div class="detalj-topp"><h3>💩 Husdyrgjødsel ${a}</h3><button type="button" class="knapp liten" data-hd="fordel" title="Fordel gjødsla som havner i lageret på skiftene etter fosforbehovet">Fordel på skiftene</button></div>
      <div class="tabell-wrap"><table class="tabell sp-tabell"><thead><tr><th>Dyreslag</th><th>Gjødsel</th><th class="tall">Tonn/år</th><th class="tall">Til lager</th><th class="tall">kg P</th><th class="tall">kg N</th><th class="tall">P på beite</th></tr></thead><tbody>
        ${g.rader.map((r) => `<tr><td>${r.ikon} ${esc(r.navn)} <span class="hint">× ${n0(r.antall)}</span></td><td>${esc(r.gjodselNavn || '')}</td><td class="tall">${n1(r.tonn)}</td><td class="tall">${n1(r.tonnLager)}</td><td class="tall">${n1(r.P)}</td><td class="tall">${n0(r.N)}</td><td class="tall">${n1(r.Pbeite)}</td></tr>`).join('')}
        <tr class="sum"><td><b>Sum</b></td><td></td><td class="tall"><b>${n1(g.tonn)}</b></td><td class="tall"><b>${n1(g.tonnLager)}</b></td><td class="tall"><b>${n1(g.P)}</b></td><td class="tall"><b>${n0(g.N)}</b></td><td class="tall"><b>${n1(g.Pbeite)}</b></td></tr>
      </tbody></table></div>
      <div class="hd-nokkel">
        <div><span class="hint">Spredeareal (skifter med vekst ${a})</span><b>${n1(g.areal)} daa</b>${g.areal ? `<span>${n1(g.PperDaa)} kg P/daa fra husdyrgjødsel · grense ${g.grenseAar}: ${n1(g.grense)}${g.aarFra > g.grenseAar ? ` (fra ${g.aarFra}: ${n1(g.grenseFra)})` : ''}</span><span>Trenger minst ${n1(g.arealBehov)} daa ${arealOk == null ? '' : status(arealOk, 'Nok areal', 'For lite areal')}</span>` : '<span>Ingen skifter har vekst – legg inn vekster under Skifter.</span>'}</div>
        <div><span class="hint">Gjødsellager (${g.lagerKrav} måneder)</span><b>ca. ${n0(g.lagerBehov)} m³ trengs</b>
          <label class="hd-lager">Lageret ditt <input type="number" min="0" step="10" data-hd-dh="lager" value="${dh.lager ?? ''}" placeholder="m³"> m³</label>${lagerOk == null ? '' : status(lagerOk, 'Stort nok', 'For lite')}</div>
        <div><span class="hint">Lagt inn i gjødslingsplanen ${a}</span><b>${n1(g.planTonn)} av ${n1(g.tonnLager)} tonn</b><span>${n1(g.planP)} kg P · <a href="#" data-hd="til-gjodsling">Åpne gjødslingsplanen</a></span></div>
      </div>
      <p class="hint">Fosfor per dyr er normtallene i gjødselforskriften (vedlegg 1). Mengden gjødsel er beregnet fra fosforet og innholdet i gjødseltypen. Gjødsla fra beiteperioden havner på beitet. Bruk egen gjødselanalyse i gjødslingsplanen når du har den.</p>
    </div>`;
  }

  function forHtml(f, a) {
    if (!f.rader.length) return '';
    const fu = f.forutsetninger;
    const rad = (navn, behov, prod, bal, enhet, hint = '') => `<tr><td>${navn}${hint ? `<div class="hint">${hint}</div>` : ''}</td><td class="tall">${n0(behov)} ${enhet}</td><td class="tall">${n0(prod)} ${enhet}</td><td class="tall ${bal < 0 ? 'hd-minus' : ''}">${bal >= 0 ? '+' : ''}${n0(bal)} ${enhet}</td></tr>`;
    return `<div class="kort"><div class="detalj-topp"><h3>🌾 Fôrbalanse ${a}</h3>${status(f.balanse.grovfor, 'Nok grovfôr', 'For lite grovfôr')}</div>
      <div class="tabell-wrap"><table class="tabell sp-tabell"><thead><tr><th></th><th class="tall">Behov</th><th class="tall">Fra skiftene</th><th class="tall">Balanse</th></tr></thead><tbody>
        ${rad('Vinterfôr (konservert grovfôr)', f.behov.vinter, f.prod.vinter, f.balanse.vinter, 'FEm', `${n1(f.prod.engAreal)} daa eng og grønnfôr, minus ${fu.tapKonservering} % tap · ca. ${n0(f.rundballerBehov)} rundballer trengs, ${n0(f.rundballerProd)} høstes`)}
        ${rad('Beite', f.behov.beite, f.prod.beite, f.balanse.beite, 'FEm', `${n1(f.prod.beiteAreal)} daa innmarksbeite, ${fu.beiteUtnyttelse} % utnyttelse${f.prod.utmark || f.prod.hostbeite ? ` · fra beiteplanen: ${n0(f.prod.utmark)} FEm i utmark og ${n0(f.prod.hostbeite)} FEm høstbeite på eng` : '. Legg inn beite i utmark og høstbeite på eng i beiteplanen nedenfor.'}`)}
        <tr class="sum"><td><b>Grovfôr i alt</b></td><td class="tall"><b>${n0(f.behov.vinter + f.behov.beite)} FEm</b></td><td class="tall"><b>${n0(f.prod.vinter + f.prod.beite)} FEm</b></td><td class="tall ${f.balanse.grovfor < 0 ? 'hd-minus' : ''}"><b>${f.balanse.grovfor >= 0 ? '+' : ''}${n0(f.balanse.grovfor)} FEm</b></td></tr>
        ${rad('Kraftfôr / korn', f.behov.kraftfor, f.prod.korn, f.balanse.kraftfor, 'kg', `${n1(f.prod.kornAreal)} daa korn. Eget korn kan brukes i fôret – resten kjøpes som kraftfôr.`)}
      </tbody></table></div>
      ${f.balanse.grovfor < 0 ? `<p class="hd-tips">Underskudd på ca. ${n0(-f.balanse.grovfor)} FEm grovfôr (≈ ${n0(-f.balanse.grovfor / fu.femPerRundball)} rundballer). Det tilsvarer ca. ${n1(f.ekstraEngDaa)} daa eng med dagens avling – eller høyere avling, flere slåtter, leid areal eller kjøpt fôr.</p>`
        : `<p class="hd-tips">Overskudd på ca. ${n0(f.balanse.grovfor)} FEm grovfôr (≈ ${n0(f.balanse.grovfor / fu.femPerRundball)} rundballer) – kan selges, eller gi rom for flere dyr.</p>`}
      <div class="tabell-wrap"><table class="tabell sp-tabell"><thead><tr><th>Behov per dyreslag</th><th class="tall">Vinterfôr FEm</th><th class="tall">Beite FEm</th><th class="tall">Kraftfôr kg</th></tr></thead><tbody>
        ${f.rader.map((r) => `<tr><td>${r.ikon} ${esc(r.navn)} <span class="hint">× ${n0(r.antall)}</span></td><td class="tall">${n0(r.vinter)}</td><td class="tall">${n0(r.beite)}</td><td class="tall">${n0(r.kraftfor)}</td></tr>`).join('')}
      </tbody></table></div>
      <details class="hd-forut"><summary>Forutsetninger</summary><div class="skjema">
        ${[['tapKonservering', 'Tap ved konservering (%)'], ['beiteUtnyttelse', 'Utnyttelse av beite (%)'], ['femPerRundball', 'FEm per rundball'], ['lagerKrav', 'Lagerkapasitet (måneder)']].map(([k, navn]) => `<label>${navn} <input type="number" min="0" data-hd-fu="${k}" value="${DH().forutsetninger[k] ?? ''}" placeholder="${FORUTSETNINGER[k]}"></label>`).join('')}
      </div><p class="hint">Avlingen per skifte er forventet avling under Skifter (ellers normavlingen). Fôrbehovet per dyr er typiske tall for norske forhold og bør justeres etter egen drift, for eksempel ytelse, slaktealder og fôrplan fra rådgiver.</p></details>
    </div>`;
  }

  function beiteHtml(a) {
    const S = hentPlan(); const p = SP(); const dh = DH(); const b = beiteplan(S, a);
    const beitedyr = dh.dyr.filter((r) => Number(r.antall) > 0 && verdier(r).inne < 12);
    if (!beitedyr.length && !(dh.beiting || []).length) return '';
    const skifteValg = (id) => `<option value="" ${!id ? 'selected' : ''}>Utmark / fellesbeite</option>${p.skifter.filter((s) => KULTURER[s.vekster?.[a]?.kultur] && !KULTURER[s.vekster[a].kultur].utenGjodsel).map((s) => `<option value="${s.id}" ${s.id === id ? 'selected' : ''}>Skifte ${esc(s.nr)}${s.navn ? ` ${esc(s.navn)}` : ''} – ${esc(KULTURER[s.vekster[a].kultur].navn)} (${n1(s.areal)} daa)</option>`).join('')}`;
    const dyrValg = (id) => `<option value="">Velg dyr</option>${dh.dyr.filter((r) => Number(r.antall) > 0).map((r) => { const v = verdier(r); return `<option value="${r.id}" ${r.id === id ? 'selected' : ''}>${v.ikon} ${esc(v.navn)} (${n0(r.antall)})</option>`; }).join('')}`;
    const trykk = (t) => (t == null ? '<span class="hint">–</span>' : `<span class="hd-trykk ${t > 1.15 ? 'hoy' : t < 0.5 ? 'lav' : 'ok'}">${Math.round(t * 100)} %</span>`);
    const lagValg = ['beitelag', 'beitetap', 'sautetthet'].map((id) => `<label><input type="checkbox" data-sp-lag="${id}" ${p.visLag?.[id] ? 'checked' : ''}> ${esc(JORDSMONN_KARTLAG[id].navn.replace(/^Beite: /, ''))}</label>`).join('');
    return `<div class="kort"><div class="detalj-topp"><h3>🌿 Beiteplan ${a}</h3><button type="button" class="knapp liten" data-hd="ny-beite">+ Beiteperiode</button></div>
      ${b.perioder.length ? `<div class="tabell-wrap"><table class="tabell sp-tabell hd-tabell"><thead><tr><th>Beite</th><th>Dyr</th><th class="tall">Antall</th><th>Fra</th><th>Til</th><th class="tall">Dager</th><th class="tall" title="Fôrbehovet i perioden mot det beitet gir i perioden">Beitetrykk</th><th></th></tr></thead><tbody>
        ${b.perioder.map((x) => `<tr data-hd-bp="${x.id}"><td><select data-hd-b="skifteId">${skifteValg(x.skifteId)}</select>${x.skifteId ? (x.dyrPerDaa ? `<div class="hint">${fmt(x.dyrPerDaa, 2)} dyr/daa</div>` : '') : `<input data-hd-b="navn" value="${esc(x.navn || '')}" placeholder="Navn, f.eks. beitelaget" class="hd-navn">`}</td>
          <td><select data-hd-b="dyrId">${dyrValg(x.dyrId)}</select></td><td class="tall"><input type="number" min="0" data-hd-b="antall" value="${(dh.beiting.find((y) => y.id === x.id) || {}).antall ?? ''}" placeholder="${n0(x.antall)}" class="hd-tall"></td>
          <td><input type="date" data-hd-b="fra" value="${esc(x.fra || '')}"></td><td><input type="date" data-hd-b="til" value="${esc(x.til || '')}"></td><td class="tall">${x.dager || '–'}</td><td class="tall">${trykk(x.trykk)}</td>
          <td><button type="button" class="knapp liten" data-hd="slett-beite" title="Fjern perioden">✕</button></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="hint">Legg inn når og hvor dyrene beiter – på innmarksbeite, eng (høstbeite) eller i utmark. Da ser du beitetrykket i hver periode, om beitene blir godt nok utnyttet, og om hele beitesesongen er dekket.</p>'}
      ${b.skifter.length ? `<h4 class="undertittel">Utnyttelse av beitene gjennom sesongen</h4><div class="hd-beiter">${b.skifter.map((x) => `<div><b>Skifte ${esc(x.skifte.nr)}${x.skifte.navn ? ` ${esc(x.skifte.navn)}` : ''}</b><span class="hint">${n1(x.skifte.areal)} daa · ${x.dager} beitedager · kapasitet ca. ${n0(x.kapasitet)} FEm</span><div class="hd-stolpe"><i style="width:${Math.min(100, Math.round((x.trykk || 0) * 100))}%" class="${x.trykk > 1.15 ? 'hoy' : x.trykk < 0.4 ? 'lav' : 'ok'}"></i></div><span>${x.trykk == null ? '–' : `${Math.round(x.trykk * 100)} % utnyttet`}</span></div>`).join('')}</div>` : ''}
      ${b.ledigeBeiter.length ? `<p class="hint">Ikke brukt som beite i ${a}: ${b.ledigeBeiter.filter((s) => KULTURER[s.vekster?.[a]?.kultur]?.gruppe === 'beite').map((s) => `skifte ${esc(s.nr)} (${n1(s.areal)} daa)`).join(', ') || 'ingen innmarksbeiter'}.</p>` : ''}
      ${b.dekning.length ? `<h4 class="undertittel">Er hele beitesesongen planlagt?</h4><div class="hd-beiter">${b.dekning.map((x) => `<div><b>${x.ikon} ${esc(x.navn)}</b><span class="hint">${n0(x.planlagt)} av ca. ${n0(x.forventet)} dyrebeitedager (ute ${n0(x.forventet / 30.4 / Math.max(1, (dh.dyr.find((r) => r.id === x.id) || {}).antall || 1))} mnd)</span><div class="hd-stolpe"><i style="width:${Math.min(100, Math.round((x.andel || 0) * 100))}%" class="${x.andel >= 0.9 ? 'ok' : 'lav'}"></i></div></div>`).join('')}</div>` : ''}
      <details class="hd-forut"><summary>Beitekart for utmark (NIBIO)</summary><div class="sp-lagvalg">${lagValg}</div>
        <p class="hint">Organisert beitebruk i utmark: beitelagene, hvor mange sau som slippes per km², og tapsprosenten for sau og lam (tap til rovvilt, sykdom og ulykker). Kartlagene vises når fanen Skifteplan er åpen. Rovviltskader og kadaverfunn finner du i <a href="https://rovbase.no/" target="_blank" rel="noopener">Rovbase</a>.</p>
        <label>Beitesesong på innmark (dager) <input type="number" min="30" max="250" data-hd-fu="beitedager" value="${dh.forutsetninger.beitedager ?? ''}" placeholder="120"></label>
        <p class="hint">Beitetrykk = fôrbehovet til dyrene i perioden ÷ det beitet gir i perioden (avling × utnyttelse, fordelt over beitesesongen). Eng som brukes til høstbeite regnes med 25 % av årsavlingen. Over ca. 115 % blir beitet nedbeitet; under 40 % over sesongen blir graset gammelt.</p></details>
    </div>`;
  }

  function romHtml() {
    const S = hentPlan(); const dh = DH(); const d = dyrerom(S);
    if (!d.behov.length) return '';
    const bygg = (S.takst?.bygninger || []).filter((g) => g.type === 'driftsbygning' && !(dh.rom || []).some((r) => r.byggId === g.id));
    const rad = (b) => `<tr><td>${b.ikon} ${esc(b.navn)}</td><td class="tall">${n0(b.samtidig)}</td><td class="tall">${fmt(b.m2, b.m2 < 1 ? 2 : 1)}${b.egen ? '' : ` <span class="hd-kilde ${b.kilde}" title="${b.kilde === 'forskrift' ? 'Minstekrav i forskriften' : 'Vanlig anbefaling – forskriften har ikke et tall per dyr'}">${b.kilde === 'forskrift' ? '§' : '≈'}</span>`}</td><td class="tall">${n0(b.areal)}</td><td class="hint">${esc(b.tekst || '')}${b.forskrift && FORSKRIFTER[b.forskrift] ? ` <a href="${FORSKRIFTER[b.forskrift].url}" target="_blank" rel="noopener">Forskriften</a>` : ''}</td></tr>`;
    return `<div class="kort"><div class="detalj-topp"><h3>🏠 Plass i dyrerommene</h3><div class="knapperad" style="margin:0">${bygg.length ? `<button type="button" class="knapp liten" data-hd="rom-fra-takst" title="Lag dyrerom av driftsbygningene i landbrukstaksten">Hent fra takst (${bygg.length})</button>` : ''}<button type="button" class="knapp liten" data-hd="nytt-rom">+ Dyrerom</button></div></div>
      <div class="tabell-wrap"><table class="tabell sp-tabell"><thead><tr><th>Dyreslag</th><th class="tall" title="Dyr som står inne samtidig">Samtidig</th><th class="tall">m²/dyr</th><th class="tall">m² trengs</th><th>Krav</th></tr></thead><tbody>${d.behov.map(rad).join('')}</tbody></table></div>
      <p class="hint"><span class="hd-kilde forskrift">§</span> minstekrav i forskriften · <span class="hd-kilde veiledende">≈</span> vanlig anbefaling (forskriften har ikke et tall per dyr). For slaktekylling, kalkun og slaktegris er dyr samtidig = produsert per år ÷ innsett. Arealet er fritt areal/bruksareal for dyra – ikke bygningens BTA.</p>
      ${(dh.rom || []).length ? `<div class="hd-rom">${d.rom.map((r) => `<div class="hd-romkort" data-hd-rom="${r.id}">
        <div class="hd-romtopp"><input data-hd-r="navn" value="${esc(r.navn || '')}" placeholder="Navn, f.eks. Fjøset"><button type="button" class="knapp liten" data-hd="slett-rom" title="Fjern dyrerommet">✕</button></div>
        <div class="skjema"><label>Areal for dyra (m²) <input type="number" min="0" data-hd-r="areal" value="${r.areal ?? ''}" placeholder="${r.bta ? `BTA ${n0(r.bta)}` : 'm²'}"></label>
          <label>Driftsform <select data-hd-r="type">${[['losdrift', 'Løsdrift'], ['basfjos', 'Båsfjøs'], ['annet', 'Annet']].map(([k, t]) => `<option value="${k}" ${r.type === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
        <div class="hd-romdyr">${dh.dyr.filter((x) => Number(x.antall) > 0).map((x) => `<label class="avkrysning"><input type="checkbox" data-hd-romdyr="${x.id}" ${(r.dyr || []).includes(x.id) ? 'checked' : ''}> ${verdier(x).ikon} ${esc(verdier(x).navn)}</label>`).join('')}</div>
        ${r.arealTall && r.her.length ? `<div class="hd-stolpe"><i style="width:${Math.min(100, Math.round(r.andel * 100))}%" class="${r.andel > 1 ? 'hoy' : r.andel > 0.9 ? 'lav' : 'ok'}"></i></div><span>${n0(r.trengs)} av ${n0(r.arealTall)} m² · ${r.andel > 1 ? '<span class="hd-ikke">✕ For lite plass</span>' : `<span class="hd-ok">✓ Nok plass</span>${r.ledig > 0 ? ` – plass til ca. ${n0(r.ledig)} til` : ''}`}</span>` : '<span class="hint">Legg inn areal og kryss av hvilke dyr som står her.</span>'}
      </div>`).join('')}</div>` : '<p class="hint">Legg inn fjøset, sauehuset, stallen eller hønsehuset med arealet dyra har til rådighet, så ser du om det er plass nok – og hvor mange dyr til det er plass til.</p>'}
    </div>`;
  }

  function tilskuddHtml(a) {
    const S = hentPlan(); const dh = DH(); const t = produksjonstilskudd(S, a); if (!dh.dyr.some((r) => Number(r.antall) > 0) && !t.areal.jordbruk) return '';
    const grupper = [...new Set(t.poster.map((p) => p.gruppe))];
    return `<div class="kort"><div class="detalj-topp"><h3>💰 Produksjonstilskudd – anslag</h3><b class="hd-sum">ca. ${n0(t.sum)} kr</b></div>
      <div class="skjema"><label>Arealsone <select data-hd-pt="sone">${SONER.map((z) => `<option value="${z}" ${t.sone === z ? 'selected' : ''}>Sone ${z}</option>`).join('')}</select></label>
        <label>Region (gris og høns) <select data-hd-pt="region">${[['', `Fra kommunen (${{ jaeren: 'Jæren', nord: 'Nordland, Troms og Finnmark', ovrig: 'landet for øvrig' }[ptRegion(S.eiendom?.kommunenr)]})`], ['jaeren', 'Jæren'], ['nord', 'Nordland, Troms og Finnmark'], ['ovrig', 'Landet for øvrig']].map(([k, n]) => `<option value="${k}" ${(dh.tilskudd?.region || '') === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label></div>
      <div class="tabell-wrap"><table class="tabell sp-tabell"><thead><tr><th>Tilskudd</th><th>Grunnlag</th><th class="tall">Kr</th></tr></thead><tbody>
        ${grupper.map((g) => `<tr class="hd-gruppe"><td colspan="3"><b>${esc(g)}</b></td></tr>${t.poster.filter((p) => p.gruppe === g).map((p) => `<tr><td>${esc(p.navn)}</td><td class="hint">${esc(p.grunnlag)}</td><td class="tall">${n0(p.belop)}</td></tr>`).join('')}`).join('')}
        <tr class="sum"><td><b>Sum produksjonstilskudd</b></td><td></td><td class="tall"><b>${n0(t.sum)}</b></td></tr>
        <tr><td>Avløsertilskudd (ferie og fritid)</td><td class="hint">grunnlag ${n0(t.avlosningGrunnlag)} kr, høyst 139 100 kr</td><td class="tall">${t.avlosning ? `inntil ${n0(t.avlosning)}` : '–'}</td></tr>
      </tbody></table></div>
      <p class="hint">Grovt anslag med de endelige satsene for søknadsåret ${t.satserAar} (<a href="${PT_KILDE.url}" target="_blank" rel="noopener">Landbruksdirektoratet</a>). Satsene endres i hvert jordbruksoppgjør. Ikke med: økologisk drift, bevaringsverdige raser, regionale miljøtilskudd (RMP), lam og kje i beitetilskuddet (bare voksne dyr er talt), tak for maksimalt antall støtteberettigede dyr og vilkår for hver ordning. Beitetilskudd forutsetter minst 12 uker på beite (16 for melkekyr), utmarksbeite minst 5 uker. Avløsertilskuddet dekker dokumenterte utgifter til avløser. Søknaden sendes i Altinn – sjekk vilkårene der.</p>
    </div>`;
  }

  return {
    html() {
      const a = aar(); const S = hentPlan(); const dh = DH();
      const g = husdyrgjodsel(S, a); const f = forbalanse(S, a); const funn = [...kontrollerHusdyr(S, a), ...kontrollerBeite(S, a), ...kontrollerRom(S)];
      const NIV = { avvik: '✕', varsel: '!', info: 'i' };
      return `${dyrHtml(dh)}
        ${funn.length ? `<div class="kort">${funn.map((x) => `<div class="sp-funn" style="--farge:${x.nivaa === 'avvik' ? 'var(--critical)' : x.nivaa === 'varsel' ? '#c77800' : 'var(--accent)'}"><i>${NIV[x.nivaa]}</i><div><b>${esc(x.tittel)}</b><div class="hint">${esc(x.tekst)}</div></div></div>`).join('')}</div>` : ''}
        ${gjodselHtml(g, dh, a)}${forHtml(f, a)}${beiteHtml(a)}${romHtml()}${mt.html()}${tilskuddHtml(a)}`;
    },
    klikk(e) {
      if (mt.klikk(e)) return true;
      const k = e.target.closest('[data-hd]'); if (!k) return false;
      const dh = DH(); const hva = k.dataset.hd;
      if (hva === 'ny') { dh.dyr.push({ ...nyttDyr(k.dataset.slag || 'melkeku', nyId) }); lagre(false); return true; }
      if (hva === 'slett') { const id = k.closest('[data-hd-rad]')?.dataset.hdRad; dh.dyr = dh.dyr.filter((r) => r.id !== id); lagre(false); return true; }
      if (hva === 'ny-beite') {
        const a = aar(); const p = SP(); const beitedyr = dh.dyr.find((r) => Number(r.antall) > 0 && verdier(r).inne < 12);
        const forrige = (dh.beiting || []).filter((x) => String(x.til || '').startsWith(String(a))).sort((x, y) => String(y.til).localeCompare(String(x.til)))[0];
        const beite = p.skifter.find((s) => KULTURER[s.vekster?.[a]?.kultur]?.gruppe === 'beite' && beitekapasitet(s, a) > 0);
        const ny = nyBeiteperiode({ aar: a, nyId, dyrId: forrige?.dyrId || beitedyr?.id || null, skifteId: beite?.id || null });
        if (forrige?.til) { const d = new Date(`${forrige.til}T12:00:00`); d.setDate(d.getDate() + 1); ny.fra = d.toISOString().slice(0, 10); const t = new Date(d); t.setDate(t.getDate() + 30); ny.til = t.toISOString().slice(0, 10); }
        dh.beiting = [...(dh.beiting || []), ny]; lagre(false); return true;
      }
      if (hva === 'slett-beite') { const id = k.closest('[data-hd-bp]')?.dataset.hdBp; dh.beiting = (dh.beiting || []).filter((x) => x.id !== id); lagre(false); return true; }
      if (hva === 'nytt-rom') { dh.rom = [...(dh.rom || []), nyttRom(nyId)]; lagre(false); return true; }
      if (hva === 'slett-rom') { const id = k.closest('[data-hd-rom]')?.dataset.hdRom; dh.rom = (dh.rom || []).filter((r) => r.id !== id); lagre(false); return true; }
      if (hva === 'rom-fra-takst') {
        const S = hentPlan();
        for (const g of (S.takst?.bygninger || []).filter((x) => x.type === 'driftsbygning' && !(dh.rom || []).some((r) => r.byggId === x.id))) dh.rom = [...(dh.rom || []), { ...nyttRom(nyId, g.navn || 'Driftsbygning'), byggId: g.id, bta: Number(g.bta) || null }];
        melding('Driftsbygningene er lagt inn som dyrerom. Fyll inn arealet dyra har til rådighet – det er mindre enn BTA.'); lagre(false); return true;
      }
      if (hva === 'til-gjodsling') { e.preventDefault(); visGjodsling(); return true; }
      if (hva === 'fordel') {
        const S = hentPlan(); const a = aar(); const f = fordelHusdyrgjodsel(S, a, { gjodselbehov });
        if (!f.length) { melding('Fant ingen skifter å fordele på – alle har husdyrgjødsel i år, mangler vekst, eller fosforbehovet er dekket.'); return true; }
        for (const x of f) SP().skifter.find((s) => s.id === x.skifteId)?.gjodsling.push({ ...x.gjodsling, id: nyId('g') });
        const tonn = f.reduce((s, x) => s + x.gjodsling.mengde * (SP().skifter.find((y) => y.id === x.skifteId)?.areal || 0), 0);
        melding(`Fordelte ca. ${n0(tonn)} tonn husdyrgjødsel på ${new Set(f.map((x) => x.skifteId)).size} skifter (${a}). Se gjennom under Gjødsling – mineralgjødsel for resten foreslås der.`);
        lagre(false); return true;
      }
      return false;
    },
    endring(e) {
      if (mt.endring(e)) return true;
      const t = e.target; const dh = DH();
      if (t.dataset.hdDh) { dh[t.dataset.hdDh] = tall(t.value); lagre(false); return true; }
      if (t.dataset.hdFu) { dh.forutsetninger[t.dataset.hdFu] = tall(t.value); lagre(false); return true; }
      if (t.dataset.hdPt) { dh.tilskudd = { ...(dh.tilskudd || {}), [t.dataset.hdPt]: t.value }; lagre(false); return true; }
      const rm = t.closest('[data-hd-rom]');
      if (rm && (t.dataset.hdR || t.dataset.hdRomdyr)) {
        const r = (dh.rom || []).find((x) => x.id === rm.dataset.hdRom); if (!r) return true;
        if (t.dataset.hdRomdyr) r.dyr = t.checked ? [...new Set([...(r.dyr || []), t.dataset.hdRomdyr])] : (r.dyr || []).filter((x) => x !== t.dataset.hdRomdyr);
        else r[t.dataset.hdR] = t.dataset.hdR === 'areal' ? tall(t.value) : t.value;
        lagre(false); return true;
      }
      const bp = t.closest('[data-hd-bp]');
      if (bp && t.dataset.hdB) { const x = (dh.beiting || []).find((y) => y.id === bp.dataset.hdBp); if (!x) return true; const f = t.dataset.hdB; x[f] = f === 'antall' ? tall(t.value) : f === 'skifteId' || f === 'dyrId' ? (t.value || null) : t.value; lagre(false); return true; }
      const rad = t.closest('[data-hd-rad]'); if (!rad || !t.dataset.hdF) return false;
      const r = dh.dyr.find((x) => x.id === rad.dataset.hdRad); if (!r) return true;
      const f = t.dataset.hdF;
      if (f === 'slag') { r.slag = t.value; for (const k of ['inne', 'grovfor', 'kraftfor', 'P']) delete r[k]; } else r[f] = tall(t.value);
      lagre(false); return true;
    },
  };
}
