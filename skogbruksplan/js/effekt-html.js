// Felles HTML for ungskogfeltene og effektberegningen (fullversjonen og SkogIQ Felt).
import { UNGSKOG_FELT, EFFEKT_KILDER } from './ungskog.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tall = (v, d = 0) => (v == null || !Number.isFinite(v) ? '–' : Number(v).toLocaleString('nb-NO', { maximumFractionDigits: d, minimumFractionDigits: d }));
const kr = (v) => `${v < 0 ? '−' : ''}${tall(Math.abs(Math.round(v / 100) * 100))} kr`;
const KILDE = { registrert: 'registrert', data: 'fra data', beregnet: 'beregnet' };
const IKON = { god: '✓', advarsel: '⚠', info: 'ℹ' };
const TITTEL = { ungskogpleie: 'ungskogpleie', planting: 'planting' };

// Rader med verdi og kilde for de fire ungskogfeltene. inputs: true gir redigerbare felt (data-ungskog="felt").
export function ungskogHtml(d, { inputs = false } = {}) {
  return `<div class="ungskog-grid">${Object.entries(UNGSKOG_FELT).map(([k, f]) => {
    const v = d[k]; const des = k.startsWith('hoyde') ? 1 : 0;
    const merke = v.kilde ? `<span class="ungskog-kilde ${v.kilde}" title="${esc(v.forklaring)}">${KILDE[v.kilde]}</span>` : '';
    if (inputs) {
      return `<label class="ungskog-felt">${esc(f.navn)} (${esc(f.enhet)})
        <input type="text" inputmode="decimal" data-ungskog="${k}" value="${v.kilde === 'registrert' ? esc(String(v.verdi).replace('.', ',')) : ''}" placeholder="${v.verdi != null ? esc(tall(v.verdi, des)) : '–'}">
        <small>${merke} ${esc(v.kilde === 'registrert' ? 'Tøm feltet for å bruke beregnet verdi' : v.forklaring)}</small></label>`;
    }
    return `<div class="ungskog-felt"><span>${esc(f.navn)}</span><b>${v.verdi != null ? `${tall(v.verdi, des)} ${esc(f.enhet)}` : '–'}</b>${merke}<small>${esc(v.kilde === 'registrert' ? '' : v.forklaring)}</small></div>`;
  }).join('')}</div>`;
}

// Effektkort: hovedbudskap, tre alternativer med søyler, andre effekter og forutsetninger.
export function effektHtml(e, { kompakt = false } = {}) {
  if (!e) return '';
  const alt = Object.entries(e.alt);
  const maks = Math.max(...alt.map(([, a]) => Math.abs(a.nvTotal)), 1);
  const best = alt.reduce((x, y) => (y[1].nv > x[1].nv ? y : x))[0];
  const g = e.gevinstTotal; const u = e.tapVedUtsettelseTotal;
  const ir = e.internrente != null ? ` Internrente ca. ${tall(e.internrente, 1)} %.` : '';
  const utsett = u > 0 ? ` Utsetter du 5 år, taper du ca. <b>${kr(u)}</b>.` : '';
  const d = e.data;
  let hoved; let klasse;
  if (g > 0) {
    hoved = `<b>${esc(e.alt.naa.navn)}</b> gir ca. <b>${kr(g)}</b> mer i nåverdi enn «${esc(e.alt.uten.navn.toLowerCase())}» (${kr(e.gevinst)}/daa).${utsett}${ir}`; klasse = 'pluss';
  } else if (e.type === 'ungskogpleie' && e.behov) {
    // Skogfaglig behov (tett/lauvdominert), men økonomisk nær null – typisk lav bonitet med lang tid til hogst.
    hoved = `<b>Ungskogpleie anbefales</b> – bestandet er tett (${tall(d?.treantallFor?.verdi)} trær/daa mot mål ${tall(d?.maal)}). Økonomisk er den omtrent i balanse ved ${tall(e.rente, 1)} % rente (${kr(g)}) fordi det er lenge til hogst på bonitet ${esc(d?.h40)}.${ir}${utsett}`; klasse = 'noytral';
  } else {
    hoved = `Med disse forutsetningene lønner ${esc(TITTEL[e.type])} seg ikke økonomisk alene (${kr(g)}).${ir} Se andre effekter.`; klasse = 'minus';
  }
  return `<div class="effekt-kort">
    <div class="effekt-hoved ${klasse}">${hoved}</div>
    <div class="effekt-alt">${alt.map(([k, a]) => `<div class="effekt-rad ${k === best ? 'best' : ''}">
      <div class="effekt-navn">${esc(a.navn)}${k === best ? ' <span class="effekt-best">best</span>' : ''}</div>
      <div class="effekt-sole"><span style="width:${Math.max(3, (Math.abs(a.nvTotal) / maks) * 100)}%"></span></div>
      <div class="effekt-tall"><b>${kr(a.nvTotal)}</b><small>nåverdi</small></div>
      ${kompakt ? '' : `<div class="effekt-detalj">Kostnad ${kr(a.kostTotal)}${a.kostBrutto && a.kostBrutto - a.kost > 1 ? ` (${kr(a.kostBrutto * e.arealDaa)} før skogfond/tilskudd)` : ''} · ${tall(a.volumTotal)} m³ ved hogst (${tall(a.volum)} m³/daa) · hogst ca. ${a.hogstAar}</div>`}
    </div>`).join('')}</div>
    ${e.andre?.length ? `<ul class="effekt-andre">${e.andre.map((x) => `<li class="${x.type}"><span>${IKON[x.type] || '•'}</span>${esc(x.tekst)}</li>`).join('')}</ul>` : ''}
    ${kompakt ? '' : `<details class="effekt-forut"><summary>Forutsetninger og kilder</summary>
      <p>Nåverdi av hogstinntekt (rotnetto ${tall(e.forutsetninger.netto)} kr/m³) og jordverdien etterpå, minus kostnaden, med ${tall(e.rente, 1)} % kalkulasjonsrente. Omløp ${e.forutsetninger.T} år. Areal ${tall(e.arealDaa, 1)} daa.
      ${e.type === 'ungskogpleie' ? `Uten pleie: ${Math.round(e.forutsetninger.tapUten * 100)} % lavere barvolum, ${Math.round(e.forutsetninger.kvalitet * 100)} % lavere pris (mindre sagtømmer, mer lauv) og hogst ${e.forutsetninger.forsinkelse} år senere – kalibrert mot Bergseng (2016): rotnettoen om lag halvert når lauvet ikke ryddes. Utsatt 5 år: ${Math.round(e.forutsetninger.tapUtsatt * 100)} % lavere volum og dyrere pleie fordi trærne er høyere. Kostnaden er etter ${Math.round(e.forutsetninger.tilskudd * 100)} % tilskudd og skattefordel ved bruk av skogfond (85 % skattefritt, ${Math.round(e.forutsetninger.skatt * 100)} % skatt). Jordverdien etter hogst regnes ikke negativ.` : `Naturlig foryngelse: ca. ${e.forutsetninger.forsinkelse} år senere etablering, ${Math.round(e.forutsetninger.tap * 100)} % lavere produksjon, ${Math.round((1 - e.forutsetninger.pris) * 100)} % lavere pris (mer lauv og massevirke) og forventet suppleringsplanting etter 5 år.`}
      Tallene er anslag – juster priser, kostnader, rente, tilskudd og skattesats under Innstillinger og Verdi.</p>
      <ul>${EFFEKT_KILDER.map((k) => `<li><a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.navn)}</a></li>`).join('')}</ul></details>`}
  </div>`;
}
