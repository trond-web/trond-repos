// Verdi-fanen: eiendomsverdi, slaktverdi, jordverdi og nåverdi av tiltaksplanen, med forutsetninger og SSB-priser.
import { TRESLAG, HK_NAVN, HK_ROMERTALL, HOGSTKLASSER } from './model.js';
import { STANDARD_VERDI, verdiberegning, folsomhet, kalibrerPriser } from './verdi.js';
import { overlapper } from './pefc.js';
import { stabletSoyle, fmt } from './charts.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const mill = (v) => `${fmt(v / 1e6, 2)} mill`;

// Bestand som overlapper nøkkelbiotoper, BVO eller verneområder regnes uten produksjon.
export function utenProduksjon(S) {
  const vern = (S.pefc?.objekter || []).filter((o) => o.geometri && ['noekkelbiotop', 'bvo', 'vern'].includes(o.type));
  const ider = new Set();
  if (!vern.length) return ider;
  for (const b of S.bestand) if (b.geometri && vern.some((o) => overlapper(b.geometri, o.geometri))) ider.add(b.id);
  return ider;
}

export function initVerdi({ hentPlan, endret, melding, hentSsb, visBestand, iAar = new Date().getFullYear() }) {
  let sortering = { felt: 'verdi', retning: -1 };
  let sist = null;

  const vInn = () => { const S = hentPlan(); S.verdi = { ...STANDARD_VERDI, ...S.verdi }; return S.verdi; };

  function forutsetningerHtml(v) {
    const felt = (navn, etikett, steg = 1, hint = '') => `<label>${etikett}<input type="number" step="${steg}" data-v="${navn}" value="${v[navn] ?? ''}">${hint ? `<small class="hint">${hint}</small>` : ''}</label>`;
    return `${felt('rente', 'Kalkulasjonsrente (%, reell)', 0.1, 'Vanlig 2–4 % for skog')}
      ${felt('horisont', 'Horisont for tiltaksplanen (år)', 1)}
      ${felt('annenInntekt', 'Andre inntekter (kr/år)', 1000, 'Jakt, fiske, utleie, festeavgift')}
      ${felt('fasteKostnader', 'Faste kostnader (kr/år)', 1000, 'Forsikring, adm., eiendomsskatt')}
      <label class="hel avkryss"><input type="checkbox" data-v="medVeivedlikehold" ${v.medVeivedlikehold ? 'checked' : ''}> Trekk fra planlagt veivedlikehold (snitt neste 5 år)</label>`;
  }

  function priserHtml(S, v) {
    const i = S.innstillinger;
    const rad = (k, navn) => `<tr><td>${navn}</td><td><input type="number" data-i="pris.${k}" value="${i.pris[k]}" style="width:80px"></td><td><input type="number" data-i="drift.${k}" value="${i.drift[k]}" style="width:80px"></td><td class="tall">${fmt(i.pris[k] - i.drift[k])}</td></tr>`;
    const d = v.ssb;
    let ssb = '<p class="hint">Ingen SSB-priser hentet for planen.</p>';
    if (d) {
      const kal = kalibrerPriser(d, i.pris);
      const r = (x) => `<tr${x.nr === d.grunnlag ? ' class="valgt"' : ''}><td>${esc(x.navn)}${x.nr === d.grunnlag ? ' ✓' : ''}</td><td class="tall">${x.pris ? fmt(x.pris) : '–'}</td><td class="tall">${fmt(x.volum)}</td><td class="tall">${x.sagandel?.G != null ? `${fmt(x.sagandel.G * 100)} %` : '–'}</td></tr>`;
      ssb = `<div class="tabell-wrap"><table class="tabell"><thead><tr><th>SSB ${d.aar}</th><th class="tall">kr/m³</th><th class="tall">m³ solgt</th><th class="tall">Sagtømmer gran</th></tr></thead><tbody>${[d.kommune, d.fylke, d.land].map(r).join('')}</tbody></table></div>
        <p class="hint">Gjennomsnittlig bruttopris for alt solgt tømmer (SSB tabell 03794 og 03895). ✓ = brukt som grunnlag${d.grunnlag !== d.kommune.nr ? ' (kommunen hadde for lite salg)' : ''}. Hentet ${new Date(d.hentet).toLocaleDateString('nb-NO')}.</p>
        ${kal ? `<div class="knapperad"><button class="knapp" type="button" id="verdiBrukSsb">Bruk kalibrerte priser: gran ${fmt(kal.G)}, furu ${fmt(kal.F)}, lauv ${fmt(kal.L)} kr/m³</button></div>` : ''}`;
    }
    return `<div class="tabell-wrap"><table class="tabell"><thead><tr><th>Treslag</th><th>Pris kr/m³</th><th>Drift kr/m³</th><th class="tall">Rotnetto</th></tr></thead><tbody>${Object.entries(TRESLAG).map(([k, n]) => rad(k, n)).join('')}</tbody></table></div>
      <h4 class="undertittel">Tømmerpriser fra SSB</h4>${ssb}
      <div class="knapperad"><button class="knapp" type="button" id="verdiHentSsb">${d ? 'Oppdater fra SSB' : 'Hent priser fra SSB'}</button><span id="verdiSsbStatus" class="hint"></span></div>`;
  }

  function tegn() {
    const S = hentPlan(); const v = vInn();
    if (!S.bestand.length) {
      $('#verdiKpi').innerHTML = '<div class="kort tom">Ingen bestand å verdsette ennå. <a href="#" data-gaa="planer">Lag en skogbruksplan</a> først.</div>';
      ['#verdiDiagram', '#verdiFolsomhet', '#verdiTabell'].forEach((s) => { $(s).innerHTML = ''; });
      $('#verdiForutsetninger').innerHTML = forutsetningerHtml(v);
      $('#verdiPriser').innerHTML = priserHtml(S, v);
      return;
    }
    const uten = utenProduksjon(S);
    const r = verdiberegning(S, v, { iAar, utenProduksjonIder: uten });
    sist = r;
    const kpi = (verdi, etikett, under = '') => `<div class="kpi"><div class="verdi">${verdi}</div><div class="etikett">${etikett}</div>${under ? `<div class="under">${under}</div>` : ''}</div>`;
    $('#verdiKpi').innerHTML = [
      kpi(mill(r.eiendom), 'kr eiendomsverdi', `${fmt(r.areal ? r.eiendom / r.areal : 0)} kr/daa · ${fmt(v.rente, 1)} % rente`),
      kpi(mill(r.skog), 'kr skogverdi', 'Forventningsverdi, optimal hogst'),
      kpi(mill(r.slakt), 'kr slaktverdi', `Alt hogd nå · ${mill(r.hogstmodenSlakt)} i HK V`),
      kpi(mill(r.jord), 'kr jordverdi', 'Snaumark, uendelig mange omløp'),
      S.bestand.some((b) => (b.tiltak || []).some((t) => t.status !== 'utfort'))
        ? kpi(mill(r.plan), 'kr nåverdi tiltaksplan', `Neste ${v.horisont} år, netto`)
        : kpi('–', 'nåverdi tiltaksplan', '<a href="#" data-gaa="tiltak">Foreslå tiltak</a> først'),
      kpi(mill(r.kapitalisert), 'kr andre inntekter/kostnader', `${fmt(r.aarlig)} kr/år kapitalisert`),
    ].join('');

    $('#verdiForutsetninger').innerHTML = forutsetningerHtml(v);
    $('#verdiPriser').innerHTML = priserHtml(S, v);

    // Verdi per hogstklasse, stablet på treslag
    const perHk = Object.fromEntries(HOGSTKLASSER.map((h) => [h, { G: 0, F: 0, L: 0 }]));
    for (const x of r.rader) if (perHk[x.hk]) perHk[x.hk][x.treslag || 'G'] += x.verdi / 1000;
    stabletSoyle($('#verdiDiagram'), {
      kategorier: HOGSTKLASSER.map((h) => ({ navn: HK_NAVN[h], kort: `HK ${HK_ROMERTALL[h]}`, verdier: perHk[h] })),
      serier: Object.entries(TRESLAG).map(([k, n]) => ({ key: k, navn: n, farge: css(`--ts-${k.toLowerCase()}`) })), enhet: '1000 kr',
    });

    const fs = folsomhet(S, v, [2, 2.5, 3, 3.5, 4, 5], { iAar, utenProduksjonIder: uten });
    $('#verdiFolsomhet').innerHTML = `<div class="tabell-wrap"><table class="tabell"><thead><tr><th>Rente</th><th class="tall">Eiendom</th><th class="tall">Skog</th><th class="tall">Jord</th><th class="tall">kr/daa</th></tr></thead><tbody>
      ${fs.map((x) => `<tr${x.rente === Number(v.rente) ? ' class="valgt"' : ''}><td>${fmt(x.rente, 1)} %</td><td class="tall">${mill(x.eiendom)}</td><td class="tall">${mill(x.skog)}</td><td class="tall">${mill(x.jord)}</td><td class="tall">${fmt(r.areal ? x.eiendom / r.areal : 0)}</td></tr>`).join('')}</tbody></table></div>
      <p class="hint">Slaktverdien (${mill(r.slakt)}) avhenger ikke av renten.</p>`;
    tegnTabell(uten);
  }

  function tegnTabell(uten) {
    if (!sist) return;
    const { felt, retning } = sortering;
    const rader = [...sist.rader].sort((a, b) => ((a[felt] ?? -Infinity) > (b[felt] ?? -Infinity) ? 1 : -1) * retning);
    const kol = [['nr', 'Bestand'], ['treslag', 'Tre'], ['areal', 'Daa', 1], ['alder', 'Alder'], ['verdi', 'Verdi kr'], ['perDaa', 'kr/daa'], ['slakt', 'Slakt kr'], ['hogstAar', 'Hogstår'], ['alderVedHogst', 'Alder v/hogst']];
    $('#verdiTabell').innerHTML = `<div class="tabell-wrap"><table class="tabell"><thead><tr>${kol.map(([k, t]) => `<th data-vsort="${k}"${k !== 'nr' && k !== 'treslag' ? ' class="tall"' : ''}>${t}${felt === k ? (retning > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
      <tbody>${rader.map((x) => `<tr data-vid="${esc(x.id)}"><td>${esc(x.nr)}${uten.has(x.id) || x.merknad ? ' <span class="hint" title="Settes av som miljøfigur">◈</span>' : ''}</td><td>${esc(x.treslag || '')}${x.bonitet ? ` ${x.bonitet}` : ''}</td>
        <td class="tall">${fmt(x.areal, 1)}</td><td class="tall">${fmt(x.alder)}</td><td class="tall">${fmt(x.verdi)}</td><td class="tall">${fmt(x.perDaa)}</td><td class="tall">${fmt(x.slakt)}</td><td class="tall">${x.hogstAar ?? '–'}</td><td class="tall">${x.alderVedHogst ?? '–'}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="2">Sum</td><td class="tall">${fmt(sist.areal, 1)}</td><td></td><td class="tall">${fmt(sist.skog)}</td><td class="tall">${fmt(sist.areal ? sist.skog / sist.areal : 0)}</td><td class="tall">${fmt(sist.slakt)}</td><td colspan="2"></td></tr></tfoot></table></div>
      ${uten.size || sist.rader.some((x) => x.merknad) ? '<p class="hint">◈ Bestand som overlapper nøkkelbiotop, BVO eller verneområde, eller er merket som miljøfigur, er regnet uten tømmerproduksjon.</p>' : ''}`;
  }

  // Hendelser
  $('#fane-verdi').addEventListener('input', (e) => {
    const t = e.target; const S = hentPlan();
    if (t.dataset.v) {
      const v = vInn();
      v[t.dataset.v] = t.type === 'checkbox' ? t.checked : Number(t.value);
      endret(); clearTimeout(tegn.t); tegn.t = setTimeout(tegn, 250);
    } else if (t.dataset.i) {
      const [a, b] = t.dataset.i.split('.');
      S.innstillinger[a][b] = Number(t.value);
      endret(); clearTimeout(tegn.t); tegn.t = setTimeout(tegn, 400);
    }
  });
  $('#fane-verdi').addEventListener('click', async (e) => {
    const S = hentPlan();
    const th = e.target.closest('[data-vsort]');
    if (th) { const f = th.dataset.vsort; sortering = { felt: f, retning: sortering.felt === f ? -sortering.retning : -1 }; tegnTabell(utenProduksjon(S)); return; }
    const tr = e.target.closest('tr[data-vid]'); if (tr) { visBestand(tr.dataset.vid); return; }
    if (e.target.id === 'verdiBrukSsb') {
      const kal = kalibrerPriser(S.verdi.ssb, S.innstillinger.pris);
      if (!kal) return;
      S.innstillinger.pris = { ...S.innstillinger.pris, G: kal.G, F: kal.F, L: kal.L };
      endret(); tegn(); melding(`Tømmerprisene er kalibrert mot SSB (${kal.grunnlag.navn}).`);
    }
    if (e.target.id === 'verdiHentSsb') {
      const k = e.target; k.disabled = true; $('#verdiSsbStatus').textContent = 'Henter fra SSB …';
      const { feil } = await hentSsb();
      k.disabled = false;
      tegn();
      if (feil.length) $('#verdiSsbStatus').textContent = feil.join(' ');
    }
  });

  return { tegn, siste: () => sist };
}
