// Tømmerkjøperens side for delte skogdata (tommer.html?f=id&k=kode). Ingen innlogging: koden i lenken gir tilgang til
// denne delingen og eget forslag. Viser eiendommen med kart, bestand, volumer, driftsforhold og miljøhensyn, nedlasting
// (CSV og GeoJSON) og skjema for prisforslag per sortiment. Logikken ligger i tommerkjoper.js.
import { csv, geojson, vurderSvar, SORTIMENT } from './tommer-felles.js';

const RAILWAY = 'https://skogiq-production.up.railway.app';
const API = /github\.io$/.test(location.hostname) ? RAILWAY : '';
const q = new URLSearchParams(location.search); const id = q.get('f'); const kode = q.get('k');
const el = document.getElementById('innhold');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tall = (v, d = 0) => (v == null || v === '' ? '–' : Number(v).toLocaleString('nb-NO', { maximumFractionDigits: d }));
const kr = (v) => `${Math.round(v).toLocaleString('nb-NO')} kr`;
const dato = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const iDag = () => new Date().toISOString().slice(0, 10);
const pluss = (d, n) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const NIVA = { svart: 'Svært bløtt', vat: 'Vått', fuktig: 'Fuktig', torr: 'Tørt', taubane: 'Taubane', bratt: 'Bratt', lett: 'Lett' };
const merke = (x) => (x ? `<span class="merke ${esc(x.niva)}" title="${esc(x.tekst)}">${esc(NIVA[x.niva] || x.niva)}</span>` : '–');

// Enkelt kart: bestandsgrensene projisert med cos(breddegrad).
function kart(liste) {
  const ringer = liste.flatMap((k) => (k.geometri.type === 'Polygon' ? [k.geometri.coordinates] : k.geometri.type === 'MultiPolygon' ? k.geometri.coordinates : []).map((p) => ({ nr: k.nr, p })));
  const pts = ringer.flatMap((r) => r.p.flat()); if (!pts.length) return '';
  const lat0 = pts.reduce((s, p) => s + p[1], 0) / pts.length; const cos = Math.cos((lat0 * Math.PI) / 180);
  const xs = pts.map((p) => p[0] * cos); const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs); const x1 = Math.max(...xs); const y0 = Math.min(...ys); const y1 = Math.max(...ys);
  const B = 760; const H = Math.max(240, Math.min(520, (B * (y1 - y0)) / (x1 - x0 || 1))); const s = Math.min((B - 40) / (x1 - x0 || 1e-9), (H - 40) / (y1 - y0 || 1e-9));
  const px = ([x, y]) => [20 + (x * cos - x0) * s, H - 20 - (y - y0) * s];
  const sti = (p) => p.map((r) => `M${r.map((q2) => px(q2).map((v) => v.toFixed(1)).join(' ')).join('L')}Z`).join('');
  const midt = (p) => { const r = p[0]; const m = r.reduce((a, q2) => [a[0] + q2[0], a[1] + q2[1]], [0, 0]); return px([m[0] / r.length, m[1] / r.length]); };
  const sentrum = [pts.reduce((a, p) => a + p[0], 0) / pts.length, lat0];
  return `<svg class="kart" viewBox="0 0 ${B} ${H.toFixed(0)}" role="img" aria-label="Kart over bestandene">${ringer.map((r) => `<path d="${sti(r.p)}" fill-rule="evenodd"/>`).join('')}${ringer.map((r) => { const [x, y] = midt(r.p); return `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" text-anchor="middle">${esc(r.nr)}</text>`; }).join('')}</svg>
    <p class="hint"><a href="https://www.google.com/maps/search/?api=1&query=${sentrum[1].toFixed(5)},${sentrum[0].toFixed(5)}" target="_blank" rel="noopener">Åpne stedet i kart og veibeskrivelse</a></p>`;
}


function last_ned(navn, innhold, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([innhold], { type })); a.download = navn;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const filnavn = (p) => (p.sted || p.tittel || 'skogdata').toLowerCase().replace(/[^a-z0-9æøå]+/g, '-').replace(/^-|-$/g, '');

function vis(v) {
  const p = v.data; const s = v.svar || {}; const ute = p.svarfrist && iDag() > p.svarfrist; const avgjort = v.status !== 'sendt';
  const sort = p.sum.sortiment || {}; const aktuelle = SORTIMENT.filter((x) => sort[x.id]);
  const fast = p.salgsform === 'samlet'; const lev = p.salgsform === 'leveranse';
  const harDrift = p.bestand.some((b) => b.drift); const harHensyn = p.bestand.some((b) => b.miljo != null);
  const status = avgjort ? (v.vunnet ? '<div class="melding ok">Skogeieren har valgt forslaget ditt og tar kontakt om befaring og kontrakt.</div>' : v.status === 'tildelt' ? '<div class="melding info">Skogeieren har valgt en kjøper. Takk for forslaget.</div>' : '<div class="melding info">Skogeieren har stoppet delingen.</div>')
    : v.svar ? `<div class="melding ok">Forslaget ditt er mottatt ${new Date(s.mottatt).toLocaleString('nb-NO')}. Du kan endre det så lenge delingen er åpen.</div>` : '';
  const periode = p.periode?.fra || p.periode?.til ? `${esc(dato(p.periode.fra) || 'etter avtale')} – ${esc(dato(p.periode.til) || 'etter avtale')}` : p.sum.fraAar ? `Planlagt hogst ${p.sum.fraAar === p.sum.tilAar ? p.sum.fraAar : `${p.sum.fraAar}–${p.sum.tilAar}`}` : 'Etter avtale';
  el.innerHTML = `${status}
    <div class="kort"><h1>${esc(p.tittel)}</h1><p class="hint">${esc(p.sted)}${p.gnrbnr ? ` · gnr/bnr ${esc(p.gnrbnr)}` : ''}${v.mottaker?.navn ? ` · til ${esc(v.mottaker.navn)}` : ''}</p>
      ${p.svarfrist ? `<p><span class="frist ${ute ? 'ute' : ''}">Ønsker forslag innen ${esc(dato(p.svarfrist))}${ute ? ' – passert' : ''}</span></p>` : ''}
      <div class="kpi"><div><b>${tall(p.sum.bestand)}</b><span>bestand</span></div><div><b>${tall(p.sum.areal, 1)} daa</b><span>areal</span></div><div><b>${tall(p.sum.salg)} m³</b><span>til salg (anslag)</span></div><div><b>${tall(p.sum.perTreslag.G)} / ${tall(p.sum.perTreslag.F)} / ${tall(p.sum.perTreslag.L)}</b><span>m³ gran / furu / lauv</span></div></div>
      <dl style="margin-top:12px"><dt>Salgsform</dt><dd><b>${esc(p.salgsformNavn)}</b> – ${esc(p.salgsformTekst)}</dd><dt>Tidspunkt</dt><dd>${periode}</dd>
        <dt>Kontakt</dt><dd>${esc(p.kontakt?.navn)}${p.kontakt?.telefon ? ` · <a href="tel:${esc(p.kontakt.telefon)}">${esc(p.kontakt.telefon)}</a>` : ''}${p.kontakt?.epost ? ` · <a href="mailto:${esc(p.kontakt.epost)}">${esc(p.kontakt.epost)}</a>` : ''}</dd>
        ${v.utloper ? `<dt>Tilgang</dt><dd>Lenken virker til ${esc(dato(v.utloper))}</dd>` : ''}</dl></div>
    ${p.kommentar ? `<div class="kort"><h2>Fra skogeieren</h2><pre>${esc(p.kommentar)}</pre></div>` : ''}
    ${p.kart?.length ? `<div class="kort"><h2>Kart</h2>${kart(p.kart)}</div>` : ''}
    <div class="kort"><h2>Bestand</h2><div class="tabell"><table><thead><tr><th>Bestand</th><th class="t">Daa</th><th>Treslag</th><th>Hkl</th><th class="t">Alder</th><th class="t">m³/daa</th><th class="t">Stående m³</th><th>Planlagt hogst</th><th class="t">Uttak m³</th>${harDrift ? '<th>Bratthet</th><th>Bæreevne</th>' : ''}${harHensyn ? '<th>Hensyn</th>' : ''}</tr></thead><tbody>
      ${p.bestand.map((b) => `<tr><td>${esc(b.nr)}</td><td class="t">${tall(b.areal, 1)}</td><td>${esc(b.treslagNavn)}${b.bonitet ? ` <span class="hint">${esc(b.treslag)}${esc(b.bonitet)}</span>` : ''}</td><td>${esc(b.hogstklasse)}</td><td class="t">${tall(b.alder)}</td><td class="t">${tall(b.m3Daa, 1)}</td><td class="t">${tall(b.m3)}</td><td>${b.hogst ? `${esc(b.hogst.navn)} ${esc(b.hogst.aar)}` : '–'}</td><td class="t">${b.hogst ? tall(b.hogst.m3) : '–'}</td>${harDrift ? `<td>${merke(b.drift?.bratt)}</td><td>${merke(b.drift?.fukt)}</td>` : ''}${harHensyn ? `<td>${b.miljo ? '🦉 Miljøfigur' : ''}${b.merknad ? ` <span class="hint">${esc(b.merknad)}</span>` : ''}</td>` : ''}</tr>`).join('')}
      <tr><th>Sum</th><th class="t">${tall(p.sum.areal, 1)}</th><th></th><th></th><th></th><th></th><th class="t">${tall(p.sum.staaende)}</th><th></th><th class="t">${tall(p.bestand.reduce((a, b) => a + (b.hogst?.m3 || 0), 0))}</th>${harDrift ? '<th></th><th></th>' : ''}${harHensyn ? '<th></th>' : ''}</tr></tbody></table></div>
      <p class="hint">${esc(p.merknad)}</p>
      <div class="knapper"><button type="button" data-last="csv">⬇ Bestandsliste (CSV)</button>${p.kart?.length ? '<button type="button" data-last="geojson">⬇ Kartdata (GeoJSON)</button>' : ''}</div></div>
    <div class="kort"><h2>${avgjort ? 'Ditt forslag' : v.svar ? 'Endre forslaget' : 'Gi prisforslag'}</h2>
      <form id="skjema">
        ${fast ? '' : `<div class="tabell"><table class="pris"><thead><tr><th>Sortiment</th><th class="t">Anslått m³</th><th>${lev ? 'Pris levert (kr/m³)' : 'Netto til skogeier (kr/m³)'}</th></tr></thead><tbody>
          ${aktuelle.map((x) => `<tr><td>${esc(x.navn)}</td><td class="t">${tall(sort[x.id])}</td><td><input name="pris-${x.id}" type="number" min="0" step="1" inputmode="decimal" value="${s.priser?.[x.id] ?? ''}"></td></tr>`).join('')}
        </tbody></table></div>
        ${lev ? `<label>Driftskostnad som trekkes (kr/m³, hogst og utkjøring) <input name="drift" type="number" min="0" step="1" inputmode="decimal" value="${s.drift ?? ''}"></label>` : ''}`}
        <label>${fast ? 'Fast sum til skogeier for hele hogsten (kr)' : 'Eller: fast sum for hele hogsten (kr, valgfritt)'} <input name="fastSum" type="number" min="0" step="1000" inputmode="decimal" value="${s.fastSum ?? ''}" ${fast ? 'required' : ''}></label>
        <div><span class="hint">Anslått netto til skogeier</span><div class="sum" id="sum">–</div></div>
        <div class="to"><label>Når kan dere hogge? <input name="tidspunkt" value="${esc(s.tidspunkt || '')}" placeholder="f.eks. vinteren 2027"></label><label>Forslaget gjelder til <input name="gyldigTil" type="date" value="${esc(s.gyldigTil || pluss(iDag(), 30))}"></label></div>
        <div class="krav"><label><input type="checkbox" name="sertifisert" ${s.sertifisert ? 'checked' : ''}> <span>Hogsten utføres etter Norsk PEFC Skogstandard, med miljøregistreringer før hogst</span></label></div>
        <div class="to"><label>Firma <input name="firma" value="${esc(s.firma || v.mottaker?.navn || '')}" autocomplete="organization" required></label><label>Org.nr <input name="orgnr" value="${esc(s.orgnr || '')}" inputmode="numeric" pattern="[0-9 ]{9,11}"></label>
          <label>Kontaktperson <input name="kontaktperson" value="${esc(s.kontaktperson || '')}" autocomplete="name"></label><label>Telefon <input name="telefon" type="tel" value="${esc(s.telefon || '')}" autocomplete="tel"></label>
          <label>E-post <input name="epost" type="email" value="${esc(s.epost || '')}" autocomplete="email"></label></div>
        <label>Kommentar og forbehold <textarea name="kommentar" rows="4" placeholder="Kvalitetskrav, tillegg, avregning, forbehold om befaring …">${esc(s.kommentar || '')}</textarea></label>
        ${avgjort ? '' : `<button type="submit">${v.svar ? 'Lagre endringer' : 'Send forslag'}</button>`}
        <div id="status" role="status"></div>
      </form></div>`;
  el.querySelector('.knapper').addEventListener('click', (e) => {
    const t = e.target.closest('[data-last]')?.dataset.last; if (!t) return;
    if (t === 'csv') last_ned(`${filnavn(p)}.csv`, csv(p), 'text/csv;charset=utf-8');
    else last_ned(`${filnavn(p)}.geojson`, JSON.stringify(geojson(p)), 'application/geo+json');
  });
  const f = document.getElementById('skjema');
  if (avgjort) for (const x of f.elements) x.disabled = true;
  const les = () => ({ priser: Object.fromEntries(aktuelle.map((x) => [x.id, f[`pris-${x.id}`]?.value ?? ''])), drift: f.drift?.value ?? '', fastSum: f.fastSum.value, tidspunkt: f.tidspunkt.value, gyldigTil: f.gyldigTil.value, sertifisert: f.sertifisert.checked, firma: f.firma.value, orgnr: f.orgnr.value, kontaktperson: f.kontaktperson.value, telefon: f.telefon.value, epost: f.epost.value, kommentar: f.kommentar.value });
  const num = (x) => (x === '' || x == null ? null : Number(x));
  const oppdaterSum = () => {
    const r = les(); const svar = { priser: Object.fromEntries(Object.entries(r.priser).map(([k, x]) => [k, num(x)])), drift: num(r.drift), fastSum: num(r.fastSum) };
    const har = svar.fastSum != null || Object.values(svar.priser).some((x) => x != null);
    const vv = vurderSvar(p, svar); document.getElementById('sum').textContent = har ? `${kr(vv.netto)}${vv.perM3 ? ` (${kr(vv.perM3)}/m³)` : ''}${vv.mangler.length ? ' – mangler pris for noen sortiment' : ''}` : '–';
  };
  f.addEventListener('input', oppdaterSum); oppdaterSum();
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const knapp = f.querySelector('button[type=submit]'); const st = document.getElementById('status'); knapp.disabled = true;
    try {
      const r = await fetch(`${API}/api/tommer/${id}/svar?k=${encodeURIComponent(kode)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(les()) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.feil || `Serveren svarte ${r.status}`);
      await last(); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) { st.innerHTML = `<div class="melding feil">${esc(err.message)}</div>`; knapp.disabled = false; }
  });
}
async function last() {
  if (!id || !kode) { el.innerHTML = '<div class="melding feil">Lenken mangler kode. Bruk lenken fra e-posten eller SMS-en du fikk.</div>'; return; }
  try {
    const r = await fetch(`${API}/api/tommer/${encodeURIComponent(id)}?k=${encodeURIComponent(kode)}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.feil || `Serveren svarte ${r.status}`);
    document.title = `${j.data.tittel} – SkogIQ.ai`; vis(j);
  } catch (e) { el.innerHTML = `<div class="melding feil">${esc(e.message)}</div>`; }
}
last();
