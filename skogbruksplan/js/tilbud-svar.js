// Utførerens side for en tilbudsforespørsel (tilbud.html?f=id&k=kode). Ingen innlogging: koden i lenken gir tilgang
// til denne forespørselen og eget svar. Viser oppdraget med kart, omfang, krav og frister, og skjema for tilbudet.
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

function vis(v) {
  const d = v.data; const s = v.svar || {}; const ute = d.svarfrist && iDag() > d.svarfrist; const avgjort = v.status !== 'sendt';
  const enhet = d.prisform === 'enhet';
  const status = avgjort ? (v.vunnet ? '<div class="melding ok">Tilbudet ditt er akseptert. Oppdragsgiveren tar kontakt om avtale og arbeidsordre.</div>' : v.status === 'tildelt' ? '<div class="melding info">Oppdraget er tildelt. Takk for tilbudet.</div>' : '<div class="melding info">Forespørselen er avsluttet.</div>')
    : v.svar ? `<div class="melding ok">Tilbudet ditt er mottatt ${new Date(s.mottatt).toLocaleString('nb-NO')}. Du kan endre det fram til svarfristen.</div>` : '';
  el.innerHTML = `${status}
    <div class="kort"><h1>${esc(d.tittel)}</h1><p class="hint">${esc(d.typeNavn)}${d.sted ? ` · ${esc(d.sted)}` : ''} · oppdrag ${esc(d.nr)}${v.mottaker?.navn ? ` · til ${esc(v.mottaker.navn)}` : ''}</p>
      <p><span class="frist ${ute ? 'ute' : ''}">Svarfrist ${esc(dato(d.svarfrist))}${ute ? ' – passert' : ''}</span></p>
      <dl>${d.oppstart || d.ferdig ? `<dt>Ønsket periode</dt><dd>${esc(dato(d.oppstart) || 'etter avtale')} – ${esc(dato(d.ferdig) || 'etter avtale')}</dd>` : ''}
        <dt>Omfang</dt><dd>${d.omfang.bestand.length} bestand · ${tall(d.omfang.areal, 1)} daa${d.omfang.m3 ? ` · ca. ${tall(d.omfang.m3)} m³` : ''}${d.omfang.antall ? ` · ca. ${tall(d.omfang.antall)} planter/trær` : ''}</dd>
        <dt>Prisform</dt><dd>${esc(d.prisTekst)}${enhet ? ` – mengde ${tall(d.mengde, 1)} ${esc(d.enhet)}` : ''}</dd>
        <dt>Tilbudet gjelder</dt><dd>${d.vedstaaelse} dager etter svarfristen</dd>
        <dt>Betaling</dt><dd>${esc(d.betaling)}</dd>${d.befaring ? `<dt>Befaring</dt><dd>${esc(d.befaring)}</dd>` : ''}
        <dt>Kontakt</dt><dd>${esc(d.kontakt?.navn)}${d.kontakt?.telefon ? ` · <a href="tel:${esc(d.kontakt.telefon)}">${esc(d.kontakt.telefon)}</a>` : ''}${d.kontakt?.epost ? ` · <a href="mailto:${esc(d.kontakt.epost)}">${esc(d.kontakt.epost)}</a>` : ''}</dd></dl></div>
    ${d.beskrivelse ? `<div class="kort"><h2>Beskrivelse</h2><pre>${esc(d.beskrivelse)}</pre></div>` : ''}
    <div class="kort"><h2>Kart</h2>${kart(d.kart || [])}</div>
    <div class="kort"><h2>Bestand</h2><div class="tabell"><table><thead><tr><th>Bestand</th><th>Tiltak</th><th class="t">Daa</th><th>Treslag</th><th class="t">Alder</th>${d.omfang.m3 ? '<th class="t">Ca. m³</th>' : ''}</tr></thead><tbody>
      ${d.omfang.bestand.map((b) => `<tr><td>${esc(b.nr)}</td><td>${esc(b.tiltak)} ${esc(b.aar)}</td><td class="t">${tall(b.areal, 1)}</td><td>${esc(b.treslag)}${esc(b.bonitet)}</td><td class="t">${tall(b.alder)}</td>${d.omfang.m3 ? `<td class="t">${tall(b.m3)}</td>` : ''}</tr>`).join('')}
      <tr><th>Sum</th><th></th><th class="t">${tall(d.omfang.areal, 1)}</th><th></th><th></th>${d.omfang.m3 ? `<th class="t">${tall(d.omfang.m3)}</th>` : ''}</tr></tbody></table></div></div>
    <div class="kort"><h2>${avgjort ? 'Ditt tilbud' : v.svar ? 'Endre tilbudet' : 'Gi tilbud'}</h2>
      <form id="skjema">
        <div class="to">${enhet ? `<label>Pris per ${esc(d.enhet)} (kr eks. mva) <input name="enhetspris" type="number" step="0.01" min="0" inputmode="decimal" value="${s.enhetspris ?? ''}" required></label>` : `<label>Fastpris for hele oppdraget (kr eks. mva) <input name="pris" type="number" step="1" min="0" inputmode="numeric" value="${s.pris ?? ''}" required></label>`}
          <div><span class="hint">Sum eks. mva</span><div class="sum" id="sum">–</div></div></div>
        <div class="to"><label>Oppstart <input name="oppstart" type="date" value="${esc(s.oppstart || d.oppstart || '')}"></label><label>Ferdig <input name="ferdig" type="date" value="${esc(s.ferdig || d.ferdig || '')}"></label></div>
        <label>Tilbudet gjelder til <input name="gyldigTil" type="date" value="${esc(s.gyldigTil || (d.svarfrist ? pluss(d.svarfrist, d.vedstaaelse || 30) : ''))}"></label>
        <div class="krav"><span class="hint">Bekreft kravene (dokumentasjon sendes på forespørsel):</span>${d.krav.map((k) => `<label><input type="checkbox" name="krav-${esc(k.id)}" ${s.krav?.[k.id] ? 'checked' : ''}> <span>${esc(k.tekst)}</span></label>`).join('')}</div>
        <div class="to"><label>Firma <input name="firma" value="${esc(s.firma || '')}" autocomplete="organization" required></label><label>Org.nr <input name="orgnr" value="${esc(s.orgnr || '')}" inputmode="numeric" pattern="[0-9 ]{9,11}"></label>
          <label>Kontaktperson <input name="kontaktperson" value="${esc(s.kontaktperson || v.mottaker?.navn || '')}" autocomplete="name"></label><label>Telefon <input name="telefon" type="tel" value="${esc(s.telefon || '')}" autocomplete="tel"></label>
          <label>E-post <input name="epost" type="email" value="${esc(s.epost || '')}" autocomplete="email"></label></div>
        <label>Kommentar og forbehold <textarea name="kommentar" rows="4" placeholder="Hva er inkludert, forbehold, maskiner, mannskap …">${esc(s.kommentar || '')}</textarea></label>
        ${avgjort ? '' : `<button type="submit">${v.svar ? 'Lagre endringer i tilbudet' : 'Send tilbud'}</button>`}
        <div id="status" role="status"></div>
      </form></div>`;
  const f = document.getElementById('skjema');
  if (avgjort) for (const x of f.elements) x.disabled = true;
  const oppdaterSum = () => { const v2 = enhet ? Number(f.enhetspris.value) * (Number(d.mengde) || 0) : Number(f.pris.value); document.getElementById('sum').textContent = v2 ? kr(v2) : '–'; };
  f.addEventListener('input', oppdaterSum); oppdaterSum();
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const knapp = f.querySelector('button'); const st = document.getElementById('status'); knapp.disabled = true;
    const body = { prisform: d.prisform, pris: enhet ? null : f.pris.value, enhetspris: enhet ? f.enhetspris.value : null, oppstart: f.oppstart.value, ferdig: f.ferdig.value, gyldigTil: f.gyldigTil.value, firma: f.firma.value, orgnr: f.orgnr.value, kontaktperson: f.kontaktperson.value, telefon: f.telefon.value, epost: f.epost.value, kommentar: f.kommentar.value, krav: Object.fromEntries(d.krav.map((k) => [k.id, f[`krav-${k.id}`].checked])) };
    const mangler = d.krav.filter((k) => !body.krav[k.id]).length;
    try {
      const r = await fetch(`${API}/api/tilbud/${id}/svar?k=${encodeURIComponent(kode)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.feil || `Serveren svarte ${r.status}`);
      await last(); window.scrollTo({ top: 0, behavior: 'smooth' });
      if (mangler) setTimeout(() => { const s2 = document.getElementById('status'); if (s2) s2.innerHTML = `<div class="melding info">Tilbudet er sendt, men ${mangler} av kravene er ikke bekreftet. Skriv i kommentaren hvorfor.</div>`; }, 50);
    } catch (err) { st.innerHTML = `<div class="melding feil">${esc(err.message)}</div>`; knapp.disabled = false; }
  });
}
async function last() {
  if (!id || !kode) { el.innerHTML = '<div class="melding feil">Lenken mangler kode. Bruk lenken fra e-posten eller SMS-en du fikk.</div>'; return; }
  try {
    const r = await fetch(`${API}/api/tilbud/${encodeURIComponent(id)}?k=${encodeURIComponent(kode)}`, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.feil || `Serveren svarte ${r.status}`);
    document.title = `${j.data.tittel} – tilbudsforespørsel`; vis(j);
  } catch (e) { el.innerHTML = `<div class="melding feil">${esc(e.message)}</div>`; }
}
last();
