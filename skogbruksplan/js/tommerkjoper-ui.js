// Verdi › 🤝 Del med tømmerkjøper: velg bestand og hva som deles, send personlige lenker til kjøperne, se når de er
// åpnet, hent og sammenlign prisforslagene, velg kjøper – eller stopp delingen. Logikken ligger i tommerkjoper.js, og
// mellomleddet er tilbud-relay.js under /api/tommer.
import { UTVALG, INNHOLD, SALGSFORM, STATUS, KJOPERE, nyDeling, foreslaaBestand, volumer, delingPakke, sammenlign, velgKjoper, mangler, delingTekst, valgtTekst } from './tommerkjoper.js';
import { mailto, smsLenke } from './tilbud.js';
import { API, RAILWAY } from './plan-synk.js';
import { TRESLAG } from './model.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tall = (v, d = 0) => (v == null ? '–' : Number(v).toLocaleString('nb-NO', { maximumFractionDigits: d }));
const kr = (v) => `${Math.round(v || 0).toLocaleString('nb-NO')} kr`;
const dato = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const tid = (ms) => (ms ? new Date(ms).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const iDag = () => new Date().toISOString().slice(0, 10);

export function initTommerkjoper({ rot, hentPlan, endret, melding, inn, iAar, tiltakNavn, kontakt, visBestander }) {
  let valgt = null; let henter = false;
  const S = () => hentPlan();
  const liste = () => { const s = S(); if (!Array.isArray(s.tommerdeling)) s.tommerdeling = []; return s.tommerdeling; };
  const finn = (id) => liste().find((d) => d.id === id) || null;
  const lagre = () => endret();
  const pakke = (d) => delingPakke(S(), d, { inn: inn(), iAar, tiltakNavn });
  const lenke = (d, m) => `${RAILWAY}/tommer.html?f=${d.relay.id}&k=${m.kode}`;
  async function kall(sti, { metode = 'GET', kropp } = {}) {
    let r; try { r = await fetch(`${API}${sti}`, { method: metode, headers: kropp ? { 'Content-Type': 'application/json' } : {}, body: kropp ? JSON.stringify(kropp) : undefined }); } catch { throw new Error('Ingen kontakt med SkogIQ-serveren. Sjekk nettet.'); }
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.feil || `Serveren svarte ${r.status}`); return d;
  }

  // ---------- visning ----------
  function listeHtml() {
    const l = liste();
    return `<p class="hint" style="margin-top:0">Del bestand, volumer, kart og driftsforhold med en eller flere tømmerkjøpere. Hver kjøper får en personlig lenke uten innlogging, ser dataene og kan gi prisforslag per sortiment. Dine egne verdianslag og priser deles ikke, og du kan stoppe delingen når du vil.</p>
      ${l.length ? `<div class="md-liste">${l.map((d) => { const st = STATUS[d.status] || STATUS.utkast; const apnet = d.mottakere.filter((m) => d.apnet?.[m.id]).length; return `<div class="md-rad tk-rad" data-tk="apne" data-id="${esc(d.id)}" role="button" tabindex="0"><b>${esc(d.tittel)}</b><span><span class="tk-status" style="--farge:${st.farge}">${esc(st.navn)}</span> ${d.bestand.length} bestand · ${d.mottakere.length} kjøpere${d.relay ? ` · ${apnet} har åpnet · ${d.svar.length} forslag` : ''}${d.solgt ? ` · solgt til ${esc(d.solgt.firma)}` : ''}</span><small>${esc(dato(d.laget))}</small></div>`; }).join('')}</div>` : ''}
      <div class="knapperad"><button type="button" class="knapp primar" data-tk="ny">🤝 Ny deling</button></div>`;
  }
  function utkastHtml(d) {
    const s = S(); const valgte = new Set(d.bestand);
    const bestand = (s.bestand || []).map((b) => ({ b, v: volumer(b, { inn: inn(), iAar }) })).sort((a, c) => String(a.b.nr).localeCompare(String(c.b.nr), 'nb', { numeric: true }));
    const p = pakke(d); const m = mangler(d);
    return `<div class="skjema to-kol"><label class="hel">Tittel <input data-tkf="tittel" value="${esc(d.tittel)}"></label></div>
      <h4 class="undertittel">1. Bestand</h4>
      <div class="knapperad">${Object.entries(UTVALG).map(([k, t]) => `<button type="button" class="knapp liten ${d.utvalg === k ? 'primar' : ''}" data-tk="utvalg" data-id="${k}">${esc(t)}</button>`).join('')}<button type="button" class="knapp liten" data-tk="ingen">Ingen</button><button type="button" class="knapp liten" data-tk="vis-kart">Vis i kartet</button></div>
      <div class="tabell-wrap tk-bestand"><table class="tabell"><thead><tr><th></th><th>Bestand</th><th class="tall">Daa</th><th>Treslag</th><th class="tall">Stående m³</th><th>Planlagt hogst</th><th class="tall">Uttak m³</th></tr></thead><tbody>
        ${bestand.map(({ b, v }) => `<tr><td><input type="checkbox" data-tk-b="${esc(b.id)}" ${valgte.has(b.id) ? 'checked' : ''} aria-label="Ta med bestand ${esc(b.nr)}"></td><td>${esc(b.nr)}${b.miljo ? ' 🦉' : ''}</td><td class="tall">${tall(b.areal, 1)}</td><td>${esc(TRESLAG[b.treslag] || '')}</td><td class="tall">${tall(v.staaende)}</td><td>${v.hogst ? `${esc(tiltakNavn(v.hogst.type))} ${v.hogst.aar}` : ''}</td><td class="tall">${v.hogst ? tall(v.hogst.m3) : ''}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="hint">Valgt: <b>${p.sum.bestand} bestand · ${tall(p.sum.areal, 1)} daa · ca. ${tall(p.sum.salg)} m³ til salg</b> (gran ${tall(p.sum.perTreslag.G)}, furu ${tall(p.sum.perTreslag.F)}, lauv ${tall(p.sum.perTreslag.L)} m³). Planlagt uttak brukes der hogst er planlagt, ellers stående volum.</p>
      <h4 class="undertittel">2. Hva som deles</h4>
      <div class="tk-ta">${Object.entries(INNHOLD).map(([k, t]) => `<label class="avkrysning"><input type="checkbox" data-tk-ta="${k}" ${d.ta[k] ? 'checked' : ''}> ${esc(t)}</label>`).join('')}<span class="hint">Alltid med: bestandsnummer, areal, treslag, bonitet, alder, volum og planlagt hogst.</span></div>
      <h4 class="undertittel">3. Salg og frister</h4>
      <div class="skjema to-kol">
        <label>Salgsform <select data-tkf="salgsform">${Object.entries(SALGSFORM).map(([k, x]) => `<option value="${k}" ${d.salgsform === k ? 'selected' : ''}>${esc(x.navn)}</option>`).join('')}</select></label>
        <label>Ønsker forslag innen <input type="date" data-tkf="svarfrist" value="${esc(d.svarfrist)}"></label>
        <label>Hogst fra <input type="date" data-tkf="periode.fra" value="${esc(d.periode.fra)}"></label>
        <label>Hogst til <input type="date" data-tkf="periode.til" value="${esc(d.periode.til)}"></label>
        <label>Lenken virker til <input type="date" data-tkf="utloper" value="${esc(d.utloper)}" min="${iDag()}"></label>
        <span class="hint" style="align-self:end">${esc(SALGSFORM[d.salgsform]?.tekst || '')}</span>
        <label class="hel">Melding til kjøperne <textarea data-tkf="kommentar" rows="3" placeholder="F.eks. ønsker vinterdrift, velteplass ved skogsbilveien, kontakt meg for befaring …">${esc(d.kommentar)}</textarea></label>
        <label>Ditt navn <input data-tkf="kontakt.navn" value="${esc(d.kontakt.navn)}" autocomplete="name"></label>
        <label>Telefon <input data-tkf="kontakt.telefon" type="tel" value="${esc(d.kontakt.telefon)}" autocomplete="tel"></label>
        <label>E-post <input data-tkf="kontakt.epost" type="email" value="${esc(d.kontakt.epost)}" autocomplete="email"></label>
      </div>
      <h4 class="undertittel">4. Kjøpere</h4>
      ${d.mottakere.length ? `<div class="md-liste">${d.mottakere.map((x) => `<div class="md-rad"><b>${esc(x.firma || x.navn)}</b><span>${esc([x.firma ? x.navn : '', x.epost, x.telefon].filter(Boolean).join(' · '))}</span><small><button type="button" class="knapp liten" data-tk="fjern" data-id="${esc(x.id)}">Fjern</button></small></div>`).join('')}</div>` : '<p class="hint">Legg til kjøperne du vil dele med – f.eks. skogeierandelslaget ditt og et par andre for å sammenligne.</p>'}
      <datalist id="tkKjopere">${KJOPERE.map((k) => `<option value="${esc(k)}">`).join('')}</datalist>
      <div class="skjema to-kol"><label>Firma <input data-tk-ny="firma" list="tkKjopere"></label><label>Kontaktperson <input data-tk-ny="navn"></label><label>E-post <input data-tk-ny="epost" type="email"></label><label>Mobil <input data-tk-ny="telefon" type="tel"></label></div>
      <div class="knapperad"><button type="button" class="knapp liten" data-tk="legg-til">+ Legg til kjøper</button></div>
      ${m.length ? `<p class="hint">Før du deler: ${esc(m.join(', '))}.</p>` : ''}
      <div class="knapperad"><button type="button" class="knapp liten" data-tk="tilbake">← Alle delinger</button><button type="button" class="knapp liten fare" data-tk="slett">Slett utkast</button><button type="button" class="knapp primar" data-tk="del" ${m.length ? 'disabled' : ''}>🤝 Del med kjøperne</button></div>`;
  }
  function deltHtml(d) {
    const p = pakke(d); const rader = sammenlign(d, p); const aapen = d.status === 'sendt';
    const send = (m) => { const t = delingTekst(p, m, lenke(d, m)); return `${m.epost ? `<a class="knapp liten" href="${esc(mailto(m.epost, t))}" data-tk="merk-sendt" data-id="${esc(m.id)}">✉ E-post</a>` : ''}${m.telefon ? `<a class="knapp liten" href="${esc(smsLenke(m.telefon, `${t.emne}: ${lenke(d, m)}`))}" data-tk="merk-sendt" data-id="${esc(m.id)}">💬 SMS</a>` : ''}<button type="button" class="knapp liten" data-tk="kopier" data-id="${esc(m.id)}">📋 Kopier lenke</button>`; };
    const st = STATUS[d.status] || STATUS.utkast;
    return `<p><span class="tk-status" style="--farge:${st.farge}">${esc(st.navn)}</span> ${p.sum.bestand} bestand · ${tall(p.sum.areal, 1)} daa · ca. ${tall(p.sum.salg)} m³ · ${esc(SALGSFORM[d.salgsform]?.navn || '')}${d.utloper ? ` · lenkene virker til ${esc(dato(d.utloper))}` : ''}</p>
      ${d.solgt ? `<div class="kort tk-solgt"><b>Kjøper valgt: ${esc(d.solgt.firma)}</b><br>Anslått netto ${kr(d.solgt.netto)}${d.solgt.perM3 ? ` (${kr(d.solgt.perM3)}/m³)` : ''} · ${esc([d.solgt.kontakt, d.solgt.telefon, d.solgt.epost].filter(Boolean).join(' · '))}</div>` : ''}
      <h4 class="undertittel">Kjøpere</h4>
      <div class="md-liste">${d.mottakere.map((m) => { const a = d.apnet?.[m.id]; const vis = d.visninger?.[m.id]; return `<div class="md-rad"><b>${esc(m.firma || m.navn)}</b><span>${a ? `👁 Åpnet ${esc(tid(a))}${vis?.antall > 1 ? ` · ${vis.antall} visninger, sist ${esc(tid(vis.sist))}` : ''}` : m.sendt ? `Sendt ${esc(dato(m.sendt))} – ikke åpnet ennå` : 'Ikke sendt ennå'}${d.svar.some((x) => x.mottakerId === m.id) ? ' · ✅ forslag mottatt' : ''}</span>${aapen && m.kode ? `<small class="knapperad">${send(m)}</small>` : ''}</div>`; }).join('')}</div>
      <div class="knapperad"><button type="button" class="knapp primar" data-tk="hent" ${henter ? 'disabled' : ''}>${henter ? 'Henter …' : '🔄 Hent forslag'}</button>${aapen ? '<button type="button" class="knapp liten" data-tk="oppdater">Oppdater dataene</button><button type="button" class="knapp liten" data-tk="ny-kjoper">+ Flere kjøpere</button>' : ''}<button type="button" class="knapp liten" data-tk="vis-kart">Vis i kartet</button></div>
      ${d.leggTil ? `<div class="skjema to-kol"><label>Firma <input data-tk-ny="firma" list="tkKjopere"></label><label>Kontaktperson <input data-tk-ny="navn"></label><label>E-post <input data-tk-ny="epost" type="email"></label><label>Mobil <input data-tk-ny="telefon" type="tel"></label></div><datalist id="tkKjopere">${KJOPERE.map((k) => `<option value="${esc(k)}">`).join('')}</datalist><div class="knapperad"><button type="button" class="knapp liten primar" data-tk="legg-til-delt">Legg til og lag lenke</button></div>` : ''}
      <h4 class="undertittel">Prisforslag</h4>
      ${rader.length ? `<div class="tabell-wrap"><table class="tabell"><thead><tr><th>Kjøper</th><th class="tall">Anslått netto</th><th class="tall">kr/m³</th><th>Hogst</th><th>Gjelder til</th><th>PEFC</th><th></th></tr></thead><tbody>
        ${rader.map((r) => `<tr class="${r.best ? 'tk-best' : ''}"><td><b>${esc(r.navn)}</b>${r.best ? ' ⭐' : ''}<br><span class="hint">${esc([r.kontaktperson, r.telefon, r.epost].filter(Boolean).join(' · '))}</span>${r.kommentar ? `<br><span class="hint">«${esc(r.kommentar)}»</span>` : ''}</td><td class="tall">${kr(r.netto)}${r.mangler.length ? `<br><span class="hint">mangler pris: ${esc(r.mangler.join(', '))}</span>` : ''}</td><td class="tall">${r.perM3 != null ? tall(r.perM3) : '–'}</td><td>${esc(r.tidspunkt || '')}</td><td>${r.gyldigTil ? `${esc(dato(r.gyldigTil))}${r.gyldig ? '' : ' <b>utløpt</b>'}` : ''}</td><td>${r.sertifisert ? '✓' : ''}</td><td>${aapen ? `<button type="button" class="knapp liten" data-tk="velg" data-id="${esc(r.mottakerId)}">Velg</button>` : d.valgt === r.mottakerId ? '<b>Valgt</b>' : ''}</td></tr>`).join('')}
      </tbody></table></div><p class="hint">Netto er anslått med planens volumer og sortimentsfordeling: pris × m³ per sortiment${d.salgsform === 'leveranse' ? ' minus driftskostnad × m³' : ''}, eller fast sum. Endelig oppgjør følger innmålt volum.</p>` : `<p class="hint">Ingen forslag ennå. Trykk «Hent forslag» for å se om kjøperne har svart.</p>`}
      <div class="knapperad"><button type="button" class="knapp liten" data-tk="tilbake">← Alle delinger</button>${d.status === 'avsluttet' || d.status === 'tildelt' ? '<button type="button" class="knapp liten fare" data-tk="fjern-deling">Fjern fra listen</button>' : '<button type="button" class="knapp liten fare" data-tk="stopp">⛔ Stopp delingen</button>'}</div>`;
  }
  function tegn() {
    const el = rot(); if (!el) return;
    const d = valgt ? finn(valgt) : null;
    el.innerHTML = !d ? listeHtml() : d.status === 'utkast' ? utkastHtml(d) : deltHtml(d);
  }

  // ---------- handlinger ----------
  const nyMottaker = (el) => { const v = (k) => el.querySelector(`[data-tk-ny="${k}"]`)?.value.trim() || ''; const m = { id: `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, firma: v('firma'), navn: v('navn'), epost: v('epost'), telefon: v('telefon') }; return m.firma || m.navn ? m : null; };
  async function hent(d, stille = false) {
    if (!d.relay) return; henter = true; tegn();
    try {
      const r = await kall(`/api/tommer/${d.relay.id}/svar?e=${encodeURIComponent(d.relay.eier)}`);
      d.svar = r.svar || []; d.apnet = r.apnet || {}; d.visninger = r.visninger || {}; d.hentet = new Date().toISOString(); lagre();
      if (!stille) melding(d.svar.length ? `${d.svar.length} forslag hentet.` : 'Ingen forslag ennå.');
    } catch (e) {
      if (/finnes ikke/i.test(e.message) && d.status === 'sendt') { d.status = 'avsluttet'; lagre(); }
      if (!stille) melding(e.message, 'feil');
    } finally { henter = false; tegn(); }
  }
  async function klikk(e) {
    const k = e.target.closest('[data-tk]'); if (!k) return; const h = k.dataset.tk; const el = rot(); const d = valgt ? finn(valgt) : null;
    if (h === 'ny') { const p = kontakt() || {}; const ny = nyDeling(S(), { kontakt: { navn: p.navn || '', telefon: p.telefon || '', epost: p.epost || '' }, inn: inn(), iAar }); liste().unshift(ny); valgt = ny.id; lagre(); tegn(); return; }
    if (h === 'apne') { valgt = k.dataset.id; tegn(); const x = finn(valgt); if (x?.relay && x.status === 'sendt') hent(x, true); return; }
    if (h === 'tilbake') { valgt = null; tegn(); return; }
    if (!d) return;
    if (h === 'utvalg') { d.utvalg = k.dataset.id; d.bestand = foreslaaBestand(S(), d.utvalg, { inn: inn(), iAar }); lagre(); tegn(); return; }
    if (h === 'ingen') { d.bestand = []; lagre(); tegn(); return; }
    if (h === 'vis-kart') { visBestander(d.bestand); return; }
    if (h === 'legg-til') { const m = nyMottaker(el); if (!m) { melding('Skriv inn firma eller kontaktperson.', 'feil'); return; } d.mottakere.push(m); lagre(); tegn(); return; }
    if (h === 'fjern') { d.mottakere = d.mottakere.filter((m) => m.id !== k.dataset.id); lagre(); tegn(); return; }
    if (h === 'slett') { if (!confirm('Slette utkastet?')) return; S().tommerdeling = liste().filter((x) => x.id !== d.id); valgt = null; lagre(); tegn(); return; }
    if (h === 'fjern-deling') { S().tommerdeling = liste().filter((x) => x.id !== d.id); valgt = null; lagre(); tegn(); return; }
    if (h === 'del') {
      if (mangler(d).length) return; k.disabled = true;
      try {
        const r = await kall('/api/tommer', { metode: 'POST', kropp: { data: pakke(d), mottakere: d.mottakere.map((m) => ({ id: m.id, navn: m.firma || m.navn })), utloper: d.utloper } });
        d.relay = { id: r.id, eier: r.eier }; for (const m of d.mottakere) m.kode = r.koder[m.id]; d.status = 'sendt'; d.delt = iDag(); lagre(); tegn();
        melding('Dataene er delt. Send lenken til hver kjøper med e-post, SMS eller kopier den.');
      } catch (err) { melding(err.message, 'feil'); k.disabled = false; }
      return;
    }
    if (h === 'kopier') { const m = d.mottakere.find((x) => x.id === k.dataset.id); try { await navigator.clipboard.writeText(lenke(d, m)); melding('Lenken er kopiert.'); } catch { prompt('Kopier lenken:', lenke(d, m)); } if (m && !m.sendt) { m.sendt = iDag(); lagre(); tegn(); } return; }
    if (h === 'merk-sendt') { const m = d.mottakere.find((x) => x.id === k.dataset.id); if (m && !m.sendt) { m.sendt = iDag(); lagre(); setTimeout(tegn, 300); } return; }
    if (h === 'hent') { hent(d); return; }
    if (h === 'oppdater') { try { await kall(`/api/tommer/${d.relay.id}?e=${encodeURIComponent(d.relay.eier)}`, { metode: 'PUT', kropp: { data: pakke(d), utloper: d.utloper } }); melding('Kjøperne ser nå de oppdaterte dataene.'); } catch (err) { melding(err.message, 'feil'); } return; }
    if (h === 'ny-kjoper') { d.leggTil = !d.leggTil; tegn(); return; }
    if (h === 'legg-til-delt') {
      const m = nyMottaker(el); if (!m) { melding('Skriv inn firma eller kontaktperson.', 'feil'); return; }
      try { const r = await kall(`/api/tommer/${d.relay.id}?e=${encodeURIComponent(d.relay.eier)}`, { metode: 'PUT', kropp: { mottakere: [{ id: m.id, navn: m.firma || m.navn }] } }); m.kode = r.koder?.[m.id]; d.mottakere.push(m); delete d.leggTil; lagre(); tegn(); melding('Kjøperen er lagt til. Send lenken.'); } catch (err) { melding(err.message, 'feil'); }
      return;
    }
    if (h === 'velg') {
      const s = d.svar.find((x) => x.mottakerId === k.dataset.id); if (!s || !confirm(`Velge ${s.firma} som kjøper? De andre ser at en kjøper er valgt, og det kan ikke sendes flere forslag.`)) return;
      try {
        await kall(`/api/tommer/${d.relay.id}?e=${encodeURIComponent(d.relay.eier)}`, { metode: 'PUT', kropp: { status: 'tildelt', mottakere: { valgt: s.mottakerId } } });
        const p = pakke(d); velgKjoper(d, s.mottakerId, p); lagre(); tegn();
        melding(`${s.firma} er valgt.`);
        if (s.epost && confirm(`Sende e-post til ${s.firma} om at forslaget er valgt?`)) location.href = mailto(s.epost, valgtTekst(p, s));
      } catch (err) { melding(err.message, 'feil'); }
      return;
    }
    if (h === 'stopp') {
      if (!confirm('Stoppe delingen? Lenkene slutter å virke med en gang, og dataene slettes fra serveren. Forslagene du har hentet beholdes i planen.')) return;
      try { await hent(d, true); await kall(`/api/tommer/${d.relay.id}?e=${encodeURIComponent(d.relay.eier)}`, { metode: 'DELETE' }); } catch (err) { if (!/finnes ikke/i.test(err.message)) { melding(err.message, 'feil'); return; } }
      d.status = 'avsluttet'; d.stoppet = iDag(); lagre(); tegn(); melding('Delingen er stoppet. Lenkene virker ikke lenger.');
    }
  }
  function endring(e) {
    const d = valgt ? finn(valgt) : null; if (!d || d.status !== 'utkast') return;
    const t = e.target;
    if (t.dataset.tkB) { const s = new Set(d.bestand); if (t.checked) s.add(t.dataset.tkB); else s.delete(t.dataset.tkB); d.bestand = (S().bestand || []).filter((b) => s.has(b.id)).map((b) => b.id); d.utvalg = null; lagre(); tegn(); return; }
    if (t.dataset.tkTa) { d.ta[t.dataset.tkTa] = t.checked; lagre(); return; }
    if (t.dataset.tkf) { const [a, b] = t.dataset.tkf.split('.'); if (b) d[a][b] = t.value; else d[a] = t.value; lagre(); if (a === 'salgsform') tegn(); }
  }
  const el0 = rot();
  if (el0) {
    el0.addEventListener('click', (e) => { klikk(e); });
    el0.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-tk="apne"]')) klikk(e); });
    el0.addEventListener('change', endring);
  }
  return { tegn, apne: (id) => { valgt = id || null; tegn(); }, ny: () => klikk({ target: { closest: () => ({ dataset: { tk: 'ny' } }) } }) };
}
