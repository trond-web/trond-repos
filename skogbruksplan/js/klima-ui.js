// 🌍 Fanen «Klima»: gårdens klimabalanse (beregningene i klima.js).
import { klimabalanse, klimaInn, FAKTOR, GWP } from './klima.js';
import { fmt } from './charts.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const t1 = (x) => fmt(Math.round(x * 10) / 10, 1);
const IKON = { Husdyr: '🐄', Jord: '🌾', Energi: '⛽', Skog: '🌲', Innkjøpt: '🛒' };
const tall = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));

export function initKlima({ hentPlan, endret, iAar = new Date().getFullYear() }) {
  const rot = () => $('#klimaInnhold');
  function tegn() {
    const el = rot(); if (!el) return;
    const S = hentPlan(); const b = klimabalanse(S, iAar); const k = klimaInn(S);
    const maks = Math.max(1, ...b.poster.map((p) => Math.abs(p.t)));
    const netto = b.netto; const binder = netto < 0;
    const inn = (felt, navn, enhet, hint = '') => `<label>${navn} <span class="kl-inn"><input type="number" min="0" step="any" data-kl="${felt}" value="${k[felt] ?? ''}" placeholder="${esc(hint)}"> ${enhet}</span></label>`;
    el.innerHTML = `
      <div class="kort kl-topp">
        <div class="kl-kpi"><div><small>Utslipp</small><b>${t1(b.utslipp)}</b><span>t CO₂e/år</span></div><div><small>Binding i skogen</small><b class="kl-gronn">${t1(b.binding)}</b><span>t CO₂e/år</span></div><div><small>Netto</small><b class="${binder ? 'kl-gronn' : 'kl-rod'}">${netto > 0 ? '+' : ''}${t1(netto)}</b><span>t CO₂e/år</span></div></div>
        <p class="kl-dom">${b.poster.length ? (binder ? `🌍 Gården binder <b>${t1(-netto)} tonn CO₂e</b> mer enn den slipper ut i året.` : `Gården slipper ut <b>${t1(netto)} tonn CO₂e</b> mer enn skogen binder i året.`) : 'Legg inn skog, skifter eller dyr i planen for å beregne klimabalansen.'}</p>
        <p class="hint">Anslag for ${iAar}. Skogen er snittet for de neste ${b.skog?.aar || 10} årene etter planen (tilvekst minus hogst). 1 tonn CO₂e ≈ ca. 5 000 km med bensinbil.</p>
      </div>
      ${b.poster.length ? `<div class="kort"><h3>Utslipp og binding</h3>
        <div class="kl-stolper">${b.grupper.map((g) => `<div class="kl-gruppe"><div class="kl-ghode"><b>${IKON[g.gruppe] || ''} ${esc(g.gruppe)}</b><span class="${g.t < 0 ? 'kl-gronn' : ''}">${g.t > 0 ? '+' : ''}${t1(g.t)} t</span></div>
          ${b.poster.filter((p) => p.gruppe === g.gruppe).map((p) => `<div class="kl-rad"><span class="kl-navn">${esc(p.navn)}${p.gass !== 'CO₂' ? ` <span class="kl-gass">${p.gass}</span>` : ''}<span class="hint">${esc(p.grunnlag)}</span></span><span class="kl-stolpe"><i class="${p.t < 0 ? 'neg' : 'pos'}" style="width:${Math.max(1, Math.round((Math.abs(p.t) / maks) * 100))}%"></i></span><span class="kl-t">${p.t > 0 ? '+' : ''}${t1(p.t)}</span></div>`).join('')}</div>`).join('')}</div>
      </div>` : ''}
      ${b.tiltak.length ? `<div class="kort"><h3>Tiltak med størst effekt</h3><div class="kl-tiltak">${b.tiltak.map((x) => `<div><span class="kl-tikon">${x.ikon}</span><div><b>${esc(x.navn)}</b><span class="hint">${esc(x.tekst)}</span></div><span class="kl-effekt">−${t1(x.effekt)} t/år</span></div>`).join('')}</div></div>` : ''}
      <div class="kort"><h3>Forbruk og areal</h3><p class="hint">Fyll inn det du vet – resten anslås. Dyr, skifter og gjødsling hentes fra Skifteplan, skogen fra bestandene.</p>
        <div class="skjema to-kol">
          ${inn('diesel', 'Diesel i jordbruket', 'l/år', b.dieselAnslatt ? `anslag ${Math.round((b.poster.find((p) => p.navn === 'Diesel i jordbruket')?.t || 0) * 1000 / FAKTOR.diesel)}` : '')}
          ${inn('strom', 'Strøm', 'kWh/år')}${inn('kalk', 'Kalk', 'tonn/år')}
          ${inn('myrAker', 'Dyrket myr – åker', 'daa')}${inn('myrEng', 'Dyrket myr – eng/beite', 'daa')}
        </div>
        <label class="bryter"><input type="checkbox" data-kl-av="medInnkjopt" ${k.medInnkjopt ? 'checked' : ''}> <span>Ta med utslipp fra produksjon av innkjøpt mineralgjødsel og kraftfôr</span></label>
        <label class="bryter"><input type="checkbox" data-kl-av="medSkogdrift" ${k.medSkogdrift ? 'checked' : ''}> <span>Ta med diesel i hogst og utkjøring</span></label>
      </div>
      <details class="kort"><summary><b>Metode og kilder</b></summary><ul class="sp-regler">
        <li>IPCC 2006/2019 Tier 1-faktorer (Vest-Europa, kjølig klima) og GWP100 fra IPCC AR5 (CH₄ = ${GWP.CH4}, N₂O = ${GWP.N2O}), som i Norges klimagassregnskap.</li>
        <li>Nitrogen fra husdyr: normtallene i vedlegg 2 til gjødselforskriften. Gjødsla deles mellom lager og beite etter månedene inne i Husdyr-fanen.</li>
        <li>Lystgass fra jord: direkte (1 % av tilført N) og indirekte fra fordamping og avrenning. Mineralgjødsel fra gjødslingsplanen.</li>
        <li>Dyrket myr: IPCC 2013 Wetlands Supplement (boreal) – ${FAKTOR.myrAker.c} t C/ha for åker og ${FAKTOR.myrEng.c} t C/ha for eng, pluss lystgass.</li>
        <li>Skog: tilvekst og hogst fra framskrivingen, med karbon i hele treet (stamme, greiner og røtter, se Karbon). Karbon i jord og i trevarer er ikke med.</li>
        <li>Diesel ${FAKTOR.diesel} kg CO₂/l, strøm ${FAKTOR.strom} kg/kWh, kalk ${FAKTOR.kalk} t CO₂/t. Innkjøpt mineralgjødsel ${FAKTOR.mineralProduksjon} kg CO₂e/kg N og kraftfôr ${FAKTOR.kraftfor} kg CO₂e/kg (anslag).</li>
        <li>Dette er et anslag for å se størrelsesorden og tiltak. For et sertifisert klimaregnskap for gården brukes Klimakalkulatoren (Norsk Landbruksrådgivning).</li>
      </ul></details>`;
  }
  document.addEventListener('change', (e) => {
    const t = e.target; if (!t.closest?.('#klimaInnhold')) return;
    const S = hentPlan(); S.klima = { ...(S.klima || {}) };
    if (t.dataset.kl) S.klima[t.dataset.kl] = tall(t.value);
    else if (t.dataset.klAv) S.klima[t.dataset.klAv] = t.checked;
    else return;
    endret({ kart: false }); tegn();
  });
  return { tegn };
}
