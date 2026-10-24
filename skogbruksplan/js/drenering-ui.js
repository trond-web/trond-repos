// Skifteplan › skifte › Grøfteplan: lag en systematisk grøfteplan fra jordart og terreng, vis den i kartet, skriv ut
// dreneringsplanen til søknaden om tilskudd (sendes kommunen før arbeidet starter), og send grøftene til grøftemaskinen.
import { AVSTAND, NEDBOR, FILTER, STATUS, STANDARD, KILDER, foreslaParametre, jordartFor, hentTerreng, lagGrofteplan, dreneringStatus, grofterGeojson, grofteSkisse } from './drenering.js';
import { lagShapefile, lagZip } from './maskindata.js';
import { KULTURER } from './skifteplan.js';
import { fmt } from './charts.js';
import { signatur } from './versjon.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kr = (v) => `${Math.round(v).toLocaleString('nb-NO')} kr`;
const opt = (o, v) => Object.entries(o).map(([k, t]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(typeof t === 'string' ? t : t.navn)}</option>`).join('');
const KORNPRIS = { korn: 3.9, oljevekster: 6, belgvekster: 4, potet: 2 };

export function lagDreneringUi({ hentPlan, lagre, melding, aar }) {
  let arbeider = '';
  const d = (sk) => (sk.drenering ||= { status: 'plan', nedbor: STANDARD.nedbor, filter: 'sagflis', metode: 'systematisk' });
  const pris = (sk) => KORNPRIS[KULTURER[sk.vekster?.[aar()]?.kultur]?.gruppe] ?? KORNPRIS.korn;

  async function lag(sk, tegn) {
    if (!sk.geometri) { melding('Skiftet mangler kartgrense.'); return; }
    const x = d(sk); arbeider = 'Henter terrenghøyder fra Kartverket …'; tegn();
    try {
      const terreng = await hentTerreng(sk.geometri);
      const f = foreslaParametre(sk, { nedbor: x.nedbor, jordart: x.jordart || null });
      const plan = lagGrofteplan(sk, terreng, { avstand: Number(x.avstand) || f.avstand, dybde: Number(x.dybde) || f.dybde, kostPerM: Number(x.kostPerM) || STANDARD.kostPerM, pris: pris(sk) });
      if (plan?.feil) throw new Error(plan.feil);
      Object.assign(x, { plan, avstand: plan.avstand, dybde: plan.dybde, jordart: x.jordart || f.jordart });
      lagre(true); melding(`Grøfteplan for skifte ${sk.nr}: ${plan.sum.antallSug} sugegrøfter og ${plan.samle.length} samlegrøft${plan.samle.length > 1 ? 'er' : ''}, ${fmt(plan.sum.totalt)} m grøft.`);
    } catch (e) { melding(`Kunne ikke lage grøfteplan: ${e.message}`); } finally { arbeider = ''; tegn(); }
  }

  function html(sk) {
    const x = sk.drenering || {}; const f = foreslaParametre(sk, { nedbor: x.nedbor || STANDARD.nedbor, jordart: x.jordart || null }); const p = x.plan; const st = dreneringStatus(x);
    const tall = (felt, v, steg, enhet) => `<label>${felt} <input type="number" step="${steg}" data-dr="${enhet}" value="${v ?? ''}"></label>`;
    return `<h4 class="undertittel">🚰 Grøfteplan (drenering)</h4>
      ${arbeider ? `<div class="sp-arbeider">${esc(arbeider)}</div>` : ''}
      <div class="skjema to-kol">
        <label>Jordart <select data-dr="jordart"><option value="">${esc(AVSTAND[jordartFor(sk)]?.navn || 'Ukjent')} (jordsmonn)</option>${opt(AVSTAND, x.jordart)}</select></label>
        <label>Årsnedbør <select data-dr="nedbor">${opt(NEDBOR, x.nedbor || STANDARD.nedbor)}</select></label>
        ${tall('Grøfteavstand (m)', x.avstand ?? f.avstand, 0.5, 'avstand')}
        ${tall('Grøftedybde (m)', x.dybde ?? f.dybde, 0.05, 'dybde')}
        <label>Filter <select data-dr="filter">${opt(FILTER, x.filter || 'sagflis')}</select></label>
        ${tall('Kostnad (kr per meter grøft)', x.kostPerM ?? STANDARD.kostPerM, 5, 'kostPerM')}
      </div>
      <p class="hint">${esc(f.begrunnelse)}</p>
      <div class="knapperad"><button type="button" class="knapp ${p ? 'liten' : 'primar'}" data-dr-k="lag" ${arbeider ? 'disabled' : ''}>${p ? 'Lag grøfteplanen på nytt' : 'Lag grøfteplan'}</button>${p ? '<button type="button" class="knapp liten" data-dr-k="skriv">Skriv ut dreneringsplan</button><button type="button" class="knapp liten" data-dr-k="maskin">Til grøftemaskin (Shapefile)</button><button type="button" class="knapp liten" data-dr-k="geojson">GeoJSON</button>' : ''}</div>
      ${p ? `<div class="md-liste">
        <div class="md-rad"><b>${p.sum.antallSug} sugegrøfter · ${p.samle.length} samlegrøft${p.samle.length > 1 ? 'er' : ''} · ${p.utlop.length} utløp</b><span>${fmt(p.sum.sug)} m sugegrøft (60 mm) + ${fmt(p.sum.samle)} m samlegrøft (${p.samle.map((g) => `${g.ror} mm`).join(', ')}) = ${fmt(p.sum.totalt)} m · ${p.sum.perDaa} m/daa</span>
          <small>Avstand ${fmt(p.avstand, 1)} m, dybde ${fmt(p.dybde, 2)} m. Terrenget faller ${fmt(p.helning, 1)} % mot ${himmel(p.retning)} (${fmt(p.hoydeforskjell, 1)} m høydeforskjell). Sugegrøftene ligger ${p.vinkel}° på skrå av kotene for å få fall mot samlegrøften. Samlegrøften er dimensjonert for ${p.samle.map((g) => `${fmt(g.q, 1)} l/s`).join(', ')} (0,1 l/s per daa).</small></div>
        <div class="md-rad"><b>Økonomi</b><span>Kostnad ca. ${kr(p.okonomi.kostnad)} · tilskudd ${kr(p.okonomi.tilskudd)} (${STANDARD.tilskuddDaa} kr/daa) · netto ${kr(p.okonomi.netto)}</span>
          <small>Netto ${kr(p.okonomi.perDaaAar)} per daa og år over ${STANDARD.levetid} år med ${STANDARD.rente * 100} % rente${p.okonomi.breakEvenKg ? ` – tilsvarer ca. ${p.okonomi.breakEvenKg} kg korn per daa og år (${fmt(pris(sk), 2)} kr/kg)` : ''}. Kornprodusenter rapporterer i snitt 27 % høyere avling etter grøfting (NLR).</small></div>
        ${p.varsler.map((v) => `<div class="md-rad"><b>⚠ Kontroller</b><small>${esc(v)}</small></div>`).join('')}
      </div>` : ''}
      <h4 class="undertittel">Søknad og gjennomføring</h4>
      <div class="skjema to-kol">
        <label>Status <select data-dr="status">${opt(STATUS, x.status || 'plan')}</select></label>
        <label>Tidligere grøftet <select data-dr="tidligereGroftet"><option value="">–</option>${opt({ ja: 'Ja', delvis: 'Delvis', nei: 'Nei (planert eller ikke grøftet)' }, x.tidligereGroftet)}</select></label>
        <label>Grøftet år (omtrent) <input type="number" data-dr="groftetAar" value="${x.groftetAar ?? ''}"></label>
        <label>Planlagt oppstart <input type="date" data-dr="oppstart" value="${esc(x.oppstart || '')}"></label>
        <label>Planlagt ferdig <input type="date" data-dr="slutt" value="${esc(x.slutt || '')}"></label>
        <label>Søkt tilskudd (dato) <input type="date" data-dr="sokt" value="${esc(x.sokt || '')}"></label>
        <label>Utført (dato) <input type="date" data-dr="utfort" value="${esc(x.utfort || '')}"></label>
        <label>Faktisk kostnad (kr) <input type="number" data-dr="kostnadFaktisk" value="${x.kostnadFaktisk ?? ''}"></label>
        <label class="hel">Utløp (hvor vannet går – bekk, åpen grøft, kum) <input data-dr="utlop" value="${esc(x.utlop || '')}" placeholder="F.eks. eksisterende kum ved bekken i sørøst, uslisset rør minst 2 m"></label>
      </div>
      ${st && !st.klarTilSoknad ? `<p class="hint">Før søknaden: fyll ut ${st.mangler.join(', ')}.</p>` : ''}
      <p class="hint">Søknad om tilskudd sendes kommunen (Altinn) <b>før arbeidet starter</b> – det gis ikke tilskudd til påbegynt arbeid. Legg ved dreneringsplanen med kart. Gi kommunen beskjed før grøftene lukkes, så de kan kontrollere. Satsen er ${STANDARD.tilskuddDaa} kr/daa for systematisk grøfting (noen fylker gir tillegg). <a href="${KILDER.tilskudd.url}" target="_blank" rel="noopener">Mer om tilskuddet</a>.</p>`;
  }
  function himmel(g) { return ['nord', 'nordøst', 'øst', 'sørøst', 'sør', 'sørvest', 'vest', 'nordvest'][Math.round(((g % 360) + 360) % 360 / 45) % 8]; }

  function skrivUt(sk) {
    const S = hentPlan(); const x = sk.drenering; const p = x.plan; const e = S.eiendom || {};
    const w = window.open('', '_blank'); if (!w) { melding('Nettleseren blokkerte utskriftsvinduet.'); return; }
    const rad = (k, v) => `<tr><th>${k}</th><td>${v || '<i>–</i>'}</td></tr>`;
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Dreneringsplan skifte ${esc(sk.nr)}</title><style>body{font:12px/1.45 system-ui,sans-serif;max-width:900px;margin:20px auto;padding:0 16px;color:#111}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:18px 0 6px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left;vertical-align:top}th{width:34%;background:#f3f3ef}.hint{color:#555}.leg span{display:inline-block;width:22px;height:3px;vertical-align:middle;margin:0 4px 0 12px}</style>
      <h1>Plan for drenering – skifte ${esc(sk.nr)}${sk.navn ? ` ${esc(sk.navn)}` : ''}</h1>
      <div class="hint">${esc(e.navn || '')}${e.gnrbnr ? ` · gnr/bnr ${esc(e.gnrbnr)}` : ''}${e.kommune ? ` · ${esc(e.kommune)}` : ''}${e.eier ? ` · ${esc(e.eier)}` : ''} · ${new Date().toLocaleDateString('nb-NO')}</div>
      <h2>Arealet</h2><table>${rad('Skifte og areal', `${esc(sk.nr)} – ${fmt(sk.areal, 1)} daa`)}${rad('Jordart', `${esc(AVSTAND[x.jordart]?.navn || '')}${sk.jordsmonn?.tekstur ? ` (jordsmonnkart: ${esc(sk.jordsmonn.tekstur)}${sk.jordsmonn.drenering ? `, ${esc(sk.jordsmonn.drenering.toLowerCase())}` : ''})` : ''}`)}
        ${rad('Tidligere grøftet', `${{ ja: 'Ja', delvis: 'Delvis', nei: 'Nei' }[x.tidligereGroftet] || ''}${x.groftetAar ? `, ca. ${x.groftetAar}` : ''}`)}${rad('Terreng', `Fall ${fmt(p.helning, 1)} % mot ${himmel(p.retning)}, ${fmt(p.hoydeforskjell, 1)} m høydeforskjell (Kartverkets høydedata)`)}${rad('Årsnedbør', esc(NEDBOR[x.nedbor] || ''))}</table>
      <h2>Utførelse</h2><table>${rad('Metode', 'Systematisk grøfting')}${rad('Grøfteavstand', `${fmt(p.avstand, 1)} m`)}${rad('Grøftedybde', `${fmt(p.dybde, 2)} m`)}
        ${rad('Sugegrøfter', `${p.sum.antallSug} stk, ${fmt(p.sum.sug)} m, 50/60 mm drensrør, minst 1:200 fall, på tvers av fallet`)}${rad('Samlegrøft', p.samle.map((g, i) => `${i + 1}: ${fmt(g.lengde)} m, ${g.rorIndre}/${g.ror} mm, ${fmt(g.fall, 2)} % fall, for ${fmt(g.areal, 1)} daa (${fmt(g.q, 1)} l/s)`).join('<br>'))}
        ${rad('Filtermateriale', esc(FILTER[x.filter] || ''))}${rad('Kummer', `${p.kummer} (ved samlegrøft og utløp)`)}${rad('Utløp', `${esc(x.utlop || '')}${x.utlop ? '<br>' : ''}Uslisset utløpsrør, minst 2 m. Vurder energidemping nedstrøms.`)}
        ${rad('Grøftelengde i alt', `${fmt(p.sum.totalt)} m (${p.sum.perDaa} m/daa)`)}${rad('Planlagt oppstart – ferdig', `${esc(x.oppstart || '')} – ${esc(x.slutt || '')}`)}</table>
      <h2>Kart over grøfteplanen</h2>${grofteSkisse(sk)}
      <div class="leg"><span style="background:#0b3d91;height:4px"></span>Samlegrøft<span style="background:#2b7bb9"></span>Sugegrøft<span style="background:#d9533a;height:8px;width:8px;border-radius:50%"></span>Utløp</div>
      <h2>Kostnad og tilskudd</h2><table>${rad('Kostnadsoverslag', `${kr(p.okonomi.kostnad)} (${fmt(x.kostPerM ?? STANDARD.kostPerM)} kr/m og ${kr(STANDARD.kostKum)} per kum)`)}${rad('Tilskudd (søkes)', `${kr(p.okonomi.tilskudd)} (${STANDARD.tilskuddDaa} kr/daa × ${fmt(sk.areal, 1)} daa)`)}${rad('Netto', kr(p.okonomi.netto))}</table>
      <h2>Miljøvurdering</h2><p>Vurder avstand til vassdrag, kulturminner og naturverdier. Bekkelukking krever egen tillatelse og gis normalt ikke. Utløpet skal ikke gi erosjon i bekken.</p>
      <p class="hint">Søknaden sendes kommunen før arbeidet starter. Kommunen skal ha beskjed før grøftene lukkes. Planen er laget i ${esc(signatur())}; grøftene er et forslag fra jordart og terreng og må tilpasses i felt.</p><script>setTimeout(()=>print(),400)<\/script>`);
    w.document.close();
  }
  function lastNed(navn, data, type) { const url = URL.createObjectURL(new Blob([data], { type })); const a = document.createElement('a'); a.href = url; a.download = navn; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000); }
  function tilMaskin(sk) {
    const gj = grofterGeojson(sk); const linjer = gj.features.filter((f) => f.geometry.type === 'LineString');
    const felt = [{ navn: 'TYPE', type: 'C', lengde: 12 }, { navn: 'NR', type: 'N', lengde: 4 }, { navn: 'ROR_MM', type: 'N', lengde: 4 }, { navn: 'LENGDE_M', type: 'N', lengde: 6 }, { navn: 'FALL_PST', type: 'N', lengde: 6, des: 2 }, { navn: 'DYBDE_M', type: 'N', lengde: 5, des: 2 }, { navn: 'SKIFTE', type: 'C', lengde: 10 }];
    const sf = lagShapefile(linjer.map((f) => ({ geometri: f.geometry, egenskaper: { TYPE: f.properties.type.replace('ø', 'o'), NR: f.properties.nr, ROR_MM: f.properties.ror_mm, LENGDE_M: f.properties.lengde_m, FALL_PST: f.properties.fall_pst, DYBDE_M: f.properties.dybde_m, SKIFTE: f.properties.skifte } })), felt, 'linje');
    const navn = `grofteplan_skifte_${String(sk.nr).replace(/\W+/g, '_')}`;
    lastNed(`${navn}.zip`, lagZip(Object.entries(sf).map(([ext, data]) => ({ navn: `${navn}.${ext}`, data })).concat([{ navn: `${navn}.geojson`, data: JSON.stringify(gj) }])), 'application/zip');
    melding('Grøfteplanen er lastet ned som Shapefile (WGS84) og GeoJSON for GPS-styrt grøftemaskin.');
  }
  return {
    html,
    // Grøftene i skiftekartet.
    tegnKart(lag, skifter) {
      for (const sk of skifter) {
        const p = sk.drenering?.plan; if (!p) continue;
        for (const g of p.sug) L.polyline(g.linje.map(([x, y]) => [y, x]), { color: '#2b7bb9', weight: 1.2, opacity: 0.9, interactive: false }).addTo(lag);
        for (const g of p.samle) L.polyline(g.linje.map(([x, y]) => [y, x]), { color: '#0b3d91', weight: 3.5 }).bindTooltip(`Samlegrøft ${g.ror} mm · ${g.lengde} m · ${fmt(g.fall, 2)} % fall`).addTo(lag);
        for (const u of p.utlop) L.circleMarker([u[1], u[0]], { radius: 6, color: '#fff', weight: 2, fillColor: '#d9533a', fillOpacity: 1 }).bindTooltip('Utløp').addTo(lag);
      }
    },
    async klikk(e, sk, tegn) {
      const k = e.target.closest('[data-dr-k]')?.dataset.drK; if (!k) return false;
      if (k === 'lag') await lag(sk, tegn);
      if (k === 'skriv') skrivUt(sk);
      if (k === 'maskin') tilMaskin(sk);
      if (k === 'geojson') lastNed(`grofteplan_skifte_${sk.nr}.geojson`, JSON.stringify(grofterGeojson(sk), null, 1), 'application/geo+json');
      return true;
    },
    endring(e, sk) {
      const t = e.target; const f = t.dataset?.dr; if (!f) return false;
      const x = d(sk); const tallfelt = ['avstand', 'dybde', 'kostPerM', 'groftetAar', 'kostnadFaktisk'];
      x[f] = tallfelt.includes(f) ? (t.value === '' ? null : Number(t.value)) : t.value || null;
      if (f === 'utfort' && t.value && x.status !== 'ferdigmeldt') x.status = 'utfort';
      if (f === 'sokt' && t.value && (!x.status || x.status === 'plan')) x.status = 'sokt';
      lagre(f === 'jordart' || f === 'nedbor'); return true;
    },
  };
}
