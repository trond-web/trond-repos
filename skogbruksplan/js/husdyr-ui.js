// 🐄 Underfanen «Husdyr» i Skifteplan: dyrehold, husdyrgjødsel og fôrbalanse (beregningene i husdyr.js).
import { DYRESLAG, FORUTSETNINGER, tomtDyrehold, nyttDyr, verdier, husdyrgjodsel, forbalanse, kontrollerHusdyr, fordelHusdyrgjodsel } from './husdyr.js';
import { gjodselbehov } from './skifteplan.js';
import { fmt } from './charts.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n0 = (x) => fmt(Math.round(x || 0), 0);
const n1 = (x) => fmt(x || 0, 1);
const tall = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? '' : Number(v));
const GRUPPER = [...new Set(Object.values(DYRESLAG).map((d) => d.gruppe))];
const status = (x, ok = 'Nok', ikke = 'Underskudd') => (x >= 0 ? `<span class="hd-ok">✓ ${ok}</span>` : `<span class="hd-ikke">✕ ${ikke}</span>`);

export function lagHusdyrUi({ SP, aar, hentPlan, lagre, melding, nyId, visGjodsling }) {
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
        <div><span class="hint">Spredeareal (skifter med vekst ${a})</span><b>${n1(g.areal)} daa</b>${g.areal ? `<span>${n1(g.PperDaa)} kg P/daa fra husdyrgjødsel · grense fra ${g.grenseAar}: ${n1(g.grense)}</span><span>Trenger minst ${n1(g.arealBehov)} daa ${arealOk == null ? '' : status(arealOk, 'Nok areal', 'For lite areal')}</span>` : '<span>Ingen skifter har vekst – legg inn vekster under Skifter.</span>'}</div>
        <div><span class="hint">Gjødsellager (${g.lagerKrav} måneder)</span><b>ca. ${n0(g.lagerBehov)} m³ trengs</b>
          <label class="hd-lager">Lageret ditt <input type="number" min="0" step="10" data-hd-dh="lager" value="${dh.lager ?? ''}" placeholder="m³"> m³</label>${lagerOk == null ? '' : status(lagerOk, 'Stort nok', 'For lite')}</div>
        <div><span class="hint">Lagt inn i gjødslingsplanen ${a}</span><b>${n1(g.planTonn)} av ${n1(g.tonnLager)} tonn</b><span>${n1(g.planP)} kg P · <a href="#" data-hd="til-gjodsling">Åpne gjødslingsplanen</a></span></div>
      </div>
      <p class="hint">Mengde og fosfor er beregnet fra fosfor per dyr (typiske tall, 1 gjødseldyrenhet = 14 kg P) og innholdet i gjødseltypen. Gjødsla fra beiteperioden havner på beitet. Bruk egen gjødselanalyse i gjødslingsplanen når du har den.</p>
    </div>`;
  }

  function forHtml(f, a) {
    if (!f.rader.length) return '';
    const fu = f.forutsetninger;
    const rad = (navn, behov, prod, bal, enhet, hint = '') => `<tr><td>${navn}${hint ? `<div class="hint">${hint}</div>` : ''}</td><td class="tall">${n0(behov)} ${enhet}</td><td class="tall">${n0(prod)} ${enhet}</td><td class="tall ${bal < 0 ? 'hd-minus' : ''}">${bal >= 0 ? '+' : ''}${n0(bal)} ${enhet}</td></tr>`;
    return `<div class="kort"><div class="detalj-topp"><h3>🌾 Fôrbalanse ${a}</h3>${status(f.balanse.grovfor, 'Nok grovfôr', 'For lite grovfôr')}</div>
      <div class="tabell-wrap"><table class="tabell sp-tabell"><thead><tr><th></th><th class="tall">Behov</th><th class="tall">Fra skiftene</th><th class="tall">Balanse</th></tr></thead><tbody>
        ${rad('Vinterfôr (konservert grovfôr)', f.behov.vinter, f.prod.vinter, f.balanse.vinter, 'FEm', `${n1(f.prod.engAreal)} daa eng og grønnfôr, minus ${fu.tapKonservering} % tap · ca. ${n0(f.rundballerBehov)} rundballer trengs, ${n0(f.rundballerProd)} høstes`)}
        ${rad('Beite', f.behov.beite, f.prod.beite, f.balanse.beite, 'FEm', `${n1(f.prod.beiteAreal)} daa innmarksbeite, ${fu.beiteUtnyttelse} % utnyttelse. Utmarksbeite og høstbeite på eng kommer i tillegg.`)}
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

  return {
    html() {
      const a = aar(); const S = hentPlan(); const dh = DH();
      const g = husdyrgjodsel(S, a); const f = forbalanse(S, a); const funn = kontrollerHusdyr(S, a);
      const NIV = { avvik: '✕', varsel: '!', info: 'i' };
      return `${dyrHtml(dh)}
        ${funn.length ? `<div class="kort">${funn.map((x) => `<div class="sp-funn" style="--farge:${x.nivaa === 'avvik' ? 'var(--critical)' : x.nivaa === 'varsel' ? '#c77800' : 'var(--accent)'}"><i>${NIV[x.nivaa]}</i><div><b>${esc(x.tittel)}</b><div class="hint">${esc(x.tekst)}</div></div></div>`).join('')}</div>` : ''}
        ${gjodselHtml(g, dh, a)}${forHtml(f, a)}`;
    },
    klikk(e) {
      const k = e.target.closest('[data-hd]'); if (!k) return false;
      const dh = DH(); const hva = k.dataset.hd;
      if (hva === 'ny') { dh.dyr.push({ ...nyttDyr(k.dataset.slag || 'melkeku', nyId) }); lagre(false); return true; }
      if (hva === 'slett') { const id = k.closest('[data-hd-rad]')?.dataset.hdRad; dh.dyr = dh.dyr.filter((r) => r.id !== id); lagre(false); return true; }
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
      const t = e.target; const dh = DH();
      if (t.dataset.hdDh) { dh[t.dataset.hdDh] = tall(t.value); lagre(false); return true; }
      if (t.dataset.hdFu) { dh.forutsetninger[t.dataset.hdFu] = tall(t.value); lagre(false); return true; }
      const rad = t.closest('[data-hd-rad]'); if (!rad || !t.dataset.hdF) return false;
      const r = dh.dyr.find((x) => x.id === rad.dataset.hdRad); if (!r) return true;
      const f = t.dataset.hdF;
      if (f === 'slag') { r.slag = t.value; for (const k of ['inne', 'grovfor', 'kraftfor', 'P']) delete r[k]; } else r[f] = tall(t.value);
      lagre(false); return true;
    },
  };
}
