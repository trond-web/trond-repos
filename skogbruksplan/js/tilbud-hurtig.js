// «📨 Be om tilbud» – den enkle veien for skogeieren: velg hva som skal gjøres, hvem som skal gi pris, og send.
// Tre korte steg i ett vindu; oppdraget lages automatisk, og forespørselen sendes som i oppdragets Utfører-fane
// (tilbud.js / tilbud-relay.js). Til slutt får hver mottaker sin lenke på e-post, SMS eller kopiert.
// Den fulle tilbudsflyten (prisform, krav, befaring, sammenligning og tildeling) ligger fortsatt i oppdraget.
import { OPPDRAGSTYPER, lagOppdrag, ledig } from './oppdrag.js';
import { nyForesporsel, offentligForesporsel, foresporselTekst, mailto, smsLenke, KRAV, mangler } from './tilbud.js';
import { API, RAILWAY } from './plan-synk.js';
import { TILTAKSTYPER } from './model.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tall = (v, d = 0) => (v == null ? '–' : Number(v).toLocaleString('nb-NO', { maximumFractionDigits: d }));
const iDag = () => new Date().toISOString().slice(0, 10);
const pluss = (d, n) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
// Hvem som vanligvis gjør jobben (vises som hjelpetekst).
const HVEM = { sluttavvirkning: 'tømmerkjøper eller hogstentreprenør', tynning: 'tømmerkjøper eller hogstentreprenør', lukkethogst: 'tømmerkjøper eller hogstentreprenør', planting: 'planteleverandør eller skogkulturentreprenør', suppleringsplanting: 'skogkulturentreprenør', markberedning: 'markberedningsentreprenør', ungskogpleie: 'ungskogpleier eller skogkulturentreprenør', vei: 'veientreprenør', groftrensk: 'gravemaskinentreprenør' };

// Kandidater: planlagte tiltak som ikke ligger i et aktivt oppdrag, gruppert per oppdragstype.
export function grupper(S, iAar = new Date().getFullYear()) {
  const g = new Map();
  for (const b of S.bestand || []) for (const t of b.tiltak || []) {
    if (t.status === 'utfort' || !ledig(t, S.oppdrag || [])) continue;
    const type = OPPDRAGSTYPER[t.type] ? t.type : 'annet';
    if (!g.has(type)) g.set(type, []);
    g.get(type).push({ bestand: b, tiltak: t });
  }
  for (const l of g.values()) l.sort((a, c) => (a.tiltak.aar || 0) - (c.tiltak.aar || 0) || String(a.bestand.nr).localeCompare(String(c.bestand.nr), 'nb', { numeric: true }));
  // Mest aktuelle først: tidligste år.
  return [...g].map(([type, liste]) => ({ type, liste, aar: Math.min(...liste.map((x) => x.tiltak.aar || iAar)) })).sort((a, c) => a.aar - c.aar);
}

export function lagHurtigTilbud({ hentPlan, endret, melding, okonomi, tiltakNavn, iAar, kontakt = () => null, apneOppdrag = () => {}, nyId }) {
  const S = () => hentPlan();
  let st = null; // { steg, type, valgt:Set, mottakere:[], ny:{}, svarfrist, fra, til, merknad, kontakt, o, sender }
  const d = () => document.getElementById('hurtigTilbud');
  const samme = (a, b) => (a.epost && b.epost && a.epost.toLowerCase() === b.epost.toLowerCase()) || (a.telefon && b.telefon && a.telefon.replace(/\D/g, '') === b.telefon.replace(/\D/g, ''));
  const lenke = (o, m) => `${RAILWAY}/tilbud.html?f=${o.tilbud.relay.id}&k=${m.kode}`;

  function start({ tiltakId = null, type = null } = {}) {
    const plan = S(); const gr = grupper(plan, iAar);
    let valgtType = type; const valgt = new Set();
    if (tiltakId) {
      for (const x of gr) { const h = x.liste.find((y) => y.tiltak.id === tiltakId); if (h) { valgtType = x.type; valgt.add(tiltakId); } }
      if (!valgt.size) {
        // Tiltaket ligger allerede i et oppdrag – åpne det i stedet.
        const o = (plan.oppdrag || []).find((x) => (x.linjer || []).some((l) => l.tiltakId === tiltakId));
        if (o) { apneOppdrag(o.id, 'utforer'); melding(`Tiltaket ligger i oppdrag ${o.nr}. Be om tilbud under Utfører.`); return; }
      }
    } else if (valgtType) { for (const x of gr.find((g) => g.type === valgtType)?.liste || []) if ((x.tiltak.aar || iAar) <= iAar + 1) valgt.add(x.tiltak.id); }
    const k = plan.tilbudKontakt || kontakt() || {};
    st = { steg: valgtType ? 1 : 0, type: valgtType, valgt, mottakere: [], ny: {}, svarfrist: pluss(iDag(), 14), fra: '', til: '', merknad: '', kontakt: { navn: k.navn || plan.eiendom?.eier || '', telefon: k.telefon || '', epost: k.epost || '' }, o: null };
    tegn(); if (!d().open) d().showModal();
  }

  function stegLinje() {
    const n = st.steg >= 4 ? 3 : Math.max(1, st.steg);
    return `<ol class="ht-steg">${['Hva skal gjøres?', 'Hvem skal gi tilbud?', 'Frist og send'].map((t, i) => `<li class="${i + 1 === n && st.steg < 4 ? 'aktiv' : i + 1 < n || st.steg >= 4 ? 'ferdig' : ''}"><span>${i + 1 < n || st.steg >= 4 ? '✓' : i + 1}</span>${t}</li>`).join('')}</ol>`;
  }
  const valgteListe = () => (grupper(S(), iAar).find((g) => g.type === st.type)?.liste || []).filter((x) => st.valgt.has(x.tiltak.id));
  const sum = (liste) => liste.reduce((a, { bestand: b, tiltak: t }) => { const ok = okonomi({ ...t, bestand: b }); return { daa: a.daa + (t.arealDaa ?? b.areal ?? 0), m3: a.m3 + (ok.m3 || 0) }; }, { daa: 0, m3: 0 });

  function kropp() {
    const plan = S(); const gr = grupper(plan, iAar);
    if (st.steg === 0) {
      if (!gr.length) return `<div class="ht-tom"><p><b>Ingen planlagte tiltak å be om tilbud på.</b></p><p class="hint">Legg inn tiltak først – trykk <b>Tiltaksmotor</b> under Tiltak for forslag, eller legg til tiltak i et bestand.</p></div>`;
      return `<h3>Hva skal gjøres?</h3><div class="ht-typer">${gr.map((g) => { const s = sum(g.liste); return `<button type="button" class="ht-type" data-ht="type" data-type="${g.type}"><b>${esc(TILTAKSTYPER[g.type]?.navn || OPPDRAGSTYPER[g.type]?.kort || g.type)}</b><span>${g.liste.length} bestand · ${tall(s.daa, 1)} daa${s.m3 ? ` · ca. ${tall(s.m3)} m³` : ''}</span><span class="hint">fra ${g.aar}</span></button>`; }).join('')}</div>`;
    }
    if (st.steg === 1) {
      const liste = gr.find((g) => g.type === st.type)?.liste || []; const s = sum(valgteListe());
      return `<h3>${esc(TILTAKSTYPER[st.type]?.navn || st.type)} – hvilke bestand?</h3>
        <p class="hint">Kryss av bestandene som skal være med i samme tilbud.</p>
        <div class="ht-liste">${liste.map(({ bestand: b, tiltak: t }) => { const ok = okonomi({ ...t, bestand: b }); return `<label class="ht-rad"><input type="checkbox" data-ht-t="${t.id}" ${st.valgt.has(t.id) ? 'checked' : ''}><span><b>Bestand ${esc(b.nr)}</b> · ${t.aar}</span><span class="hint">${tall(t.arealDaa ?? b.areal, 1)} daa${ok.m3 ? ` · ca. ${tall(ok.m3)} m³` : ''} · ${esc(b.treslag || '')}${b.bonitet ?? ''}</span></label>`; }).join('')}</div>
        <p class="ht-sum">${st.valgt.size} bestand · ${tall(s.daa, 1)} daa${s.m3 ? ` · ca. ${tall(s.m3)} m³` : ''}</p>
        <label class="ht-felt">Noe utføreren bør vite? <span class="hint">(valgfritt)</span><textarea data-ht-f="merknad" rows="2" placeholder="F.eks. adkomst, velteplass, ønsket tidspunkt …">${esc(st.merknad)}</textarea></label>`;
    }
    if (st.steg === 2) {
      const reg = (plan.leverandorer || []).filter((l) => !st.mottakere.some((m) => samme(m, l)));
      return `<h3>Hvem skal gi tilbud?</h3>
        <p class="hint">Legg til én eller flere – vanligvis ${esc(HVEM[st.type] || 'en entreprenør')}. Flere tilbud gir bedre pris. De får en lenke og svarer uten innlogging.</p>
        ${st.mottakere.length ? `<div class="ht-mottakere">${st.mottakere.map((m) => `<div class="ht-mottaker"><span><b>${esc(m.firma || m.navn)}</b><span class="hint">${esc([m.firma && m.navn !== m.firma ? m.navn : '', m.epost, m.telefon].filter(Boolean).join(' · ')) || 'uten e-post og mobil – kopier lenken selv'}</span></span><button type="button" class="knapp liten" data-ht="fjern" data-id="${m.id}" aria-label="Fjern">✕</button></div>`).join('')}</div>` : ''}
        ${reg.length ? `<p class="hint" style="margin-bottom:4px">Brukt før:</p><div class="knapperad">${reg.slice(0, 8).map((l, i) => `<button type="button" class="knapp liten" data-ht="reg" data-i="${(plan.leverandorer || []).indexOf(l)}">+ ${esc(l.firma || l.navn)}</button>`).join('')}</div>` : ''}
        <div class="ht-ny">
          <label>Firma eller navn <input data-ht-ny="firma" value="${esc(st.ny.firma || '')}" autocomplete="organization"></label>
          <label>E-post <input data-ht-ny="epost" type="email" value="${esc(st.ny.epost || '')}" autocomplete="email"></label>
          <label>Mobil <input data-ht-ny="telefon" type="tel" value="${esc(st.ny.telefon || '')}" autocomplete="tel"></label>
          <button type="button" class="knapp" data-ht="legg-til">+ Legg til</button>
        </div>
        <p class="hint">E-post eller mobil trengs for å sende lenken – du kan også kopiere lenken selv etterpå.</p>`;
    }
    if (st.steg === 3) {
      const s = sum(valgteListe()); const kravIder = Object.entries(KRAV).filter(([, k]) => k.gjelder(st.type)).map(([id]) => id);
      return `<h3>Frist og send</h3>
        <div class="ht-oppsummering"><div><span class="hint">Hva</span><b>${esc(TILTAKSTYPER[st.type]?.navn || st.type)} · ${st.valgt.size} bestand · ${tall(s.daa, 1)} daa${s.m3 ? ` · ca. ${tall(s.m3)} m³` : ''}</b></div>
          <div><span class="hint">Til</span><b>${st.mottakere.map((m) => esc(m.firma || m.navn)).join(', ')}</b></div></div>
        <div class="ht-to">
          <label class="ht-felt">Svar innen <input type="date" data-ht-f="svarfrist" value="${esc(st.svarfrist)}" min="${iDag()}"></label>
          <label class="ht-felt">Arbeidet gjøres fra <span class="hint">(valgfritt)</span><input type="date" data-ht-f="fra" value="${esc(st.fra)}"></label>
          <label class="ht-felt">… til <span class="hint">(valgfritt)</span><input type="date" data-ht-f="til" value="${esc(st.til)}"></label>
        </div>
        <h4>Utførerne kontakter deg på</h4>
        <div class="ht-to"><label class="ht-felt">Navn <input data-ht-k="navn" value="${esc(st.kontakt.navn)}" autocomplete="name"></label><label class="ht-felt">Mobil <input data-ht-k="telefon" type="tel" value="${esc(st.kontakt.telefon)}" autocomplete="tel"></label><label class="ht-felt">E-post <input data-ht-k="epost" type="email" value="${esc(st.kontakt.epost)}" autocomplete="email"></label></div>
        <details class="ekstra"><summary>Dette følger med forespørselen</summary><ul class="hint"><li>Kart over bestandene, omfang (areal${s.m3 ? ', volum' : ''}) og beskrivelse.</li><li>Prisform: ${esc(st.type && ['sluttavvirkning', 'tynning', 'lukkethogst'].includes(st.type) ? 'pris per m³' : st.type === 'vei' ? 'fastpris' : 'enhetspris')} – du kan endre i oppdraget før sending hvis du vil.</li><li>Seriøsitetskrav utføreren bekrefter: ${kravIder.map((id) => esc(KRAV[id].tekst.split(' – ')[0].split(' (')[0])).join('; ')}.</li><li>Betaling: faktura etter utført arbeid, 30 dager.</li></ul></details>`;
    }
    // Steg 4: sendt – lenkene.
    const o = st.o; const f = o.tilbud; const pub = offentligForesporsel(S(), o, f, { okonomi, tiltakNavn });
    return `<div class="ht-ferdig"><div class="ht-ok">✓</div><h3>Forespørselen er klar</h3><p class="hint">Send lenken til hver mottaker. Svarene kommer inn i oppdrag <b>${esc(o.nr)}</b>, der du sammenligner og velger utfører.</p></div>
      <div class="ht-mottakere">${f.mottakere.map((m) => { const t = foresporselTekst(pub, m, lenke(o, m)); return `<div class="ht-mottaker"><span><b>${esc(m.firma || m.navn)}</b><span class="hint">${esc([m.epost, m.telefon].filter(Boolean).join(' · ')) || 'ingen e-post eller mobil'}</span></span>
        <span class="knapperad" style="margin:0">${m.epost ? `<a class="knapp liten primar" href="${esc(mailto(m.epost, t))}" data-ht="sendt" data-id="${m.id}">✉ E-post</a>` : ''}${m.telefon ? `<a class="knapp liten${m.epost ? '' : ' primar'}" href="${esc(smsLenke(m.telefon, `${t.emne}: ${lenke(o, m)}`))}" data-ht="sendt" data-id="${m.id}">💬 SMS</a>` : ''}<button type="button" class="knapp liten" data-ht="kopier" data-id="${m.id}">📋 Kopier lenke</button></span></div>`; }).join('')}</div>`;
  }

  const manglerNa = () => (st.steg === 1 ? (!st.valgt.size ? 'Velg minst ett bestand' : '') : st.steg === 2 ? (!st.mottakere.length && !(st.ny.firma || '').trim() ? 'Legg til minst én mottaker' : '') : (!st.kontakt.navn.trim() || !(st.kontakt.telefon.trim() || st.kontakt.epost.trim()) ? 'Fyll inn navn og mobil eller e-post' : !st.svarfrist ? 'Velg svarfrist' : ''));
  // Oppdaterer bare knappen og meldingen (ikke hele vinduet), så feltet du skriver i beholder fokus.
  function oppdaterKnapp() { const el = d(); const k = el?.querySelector('[data-ht="neste"], [data-ht="send"]'); const m = el?.querySelector('.ht-mangel'); const tekst = manglerNa(); if (k) k.disabled = !!tekst || !!st.sender; if (m) m.textContent = tekst; }
  function knapper() {
    if (st.steg === 0) return '<button type="button" class="knapp" data-ht="lukk">Avbryt</button>';
    if (st.steg >= 4) return `<button type="button" class="knapp" data-ht="apne">Åpne oppdraget</button><button type="button" class="knapp primar" data-ht="lukk">Ferdig</button>`;
    const mangel = manglerNa();
    return `<button type="button" class="knapp" data-ht="${st.steg === 1 ? 'tilbake-type' : 'tilbake'}">← Tilbake</button><span class="hint ht-mangel">${esc(mangel)}</span><button type="button" class="knapp primar" data-ht="${st.steg === 3 ? 'send' : 'neste'}" ${mangel || st.sender ? 'disabled' : ''}>${st.steg === 3 ? (st.sender ? 'Sender …' : '📨 Send forespørsel') : 'Neste →'}</button>`;
  }

  function tegn() {
    const el = d(); if (!el || !st) return;
    el.innerHTML = `<div class="ht-topp"><h2>📨 Be om tilbud</h2><button type="button" class="knapp liten" data-ht="lukk" aria-label="Lukk">✕</button></div>${stegLinje()}<div class="ht-kropp">${kropp()}</div><div class="ht-knapper">${knapper()}</div>`;
  }

  function leggTilNy() {
    const n = st.ny; const firma = (n.firma || '').trim(); if (!firma) { melding('Skriv firma eller navn.', 'feil'); return false; }
    const m = { id: nyId('m'), navn: firma, firma, epost: (n.epost || '').trim(), telefon: (n.telefon || '').trim() };
    if (m.epost && !/^\S+@\S+\.\S+$/.test(m.epost)) { melding('E-postadressen ser ikke riktig ut.', 'feil'); return false; }
    st.mottakere.push(m); st.ny = {}; return true;
  }

  async function send() {
    const plan = S(); const valgte = valgteListe(); if (!valgte.length) return;
    st.sender = true; tegn();
    try {
      const r = lagOppdrag(plan, valgte, { nyId, iAar }); const o = r.oppdrag[0]; if (!o) throw new Error('Tiltakene ligger allerede i et oppdrag.');
      if (st.merknad) o.merknad = st.merknad;
      o.periode = { fra: st.fra || '', til: st.til || '' };
      const f = nyForesporsel(plan, o, { okonomi, kontakt: st.kontakt });
      Object.assign(f, { svarfrist: st.svarfrist, oppstart: st.fra || f.oppstart, ferdig: st.til || f.ferdig, mottakere: st.mottakere.map((m) => ({ ...m })) });
      if (st.merknad) f.beskrivelse = `${f.beskrivelse}\n\n${st.merknad}`;
      const mg = mangler(f); if (mg.length) throw new Error(`Mangler ${mg.join(', ')}.`);
      o.tilbud = f;
      let res;
      try { const svar = await fetch(`${API}/api/tilbud`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: offentligForesporsel(plan, o, f, { okonomi, tiltakNavn }), mottakere: f.mottakere.map((x) => ({ id: x.id, navn: x.navn })) }) }); res = await svar.json().catch(() => ({})); if (!svar.ok) throw new Error(res.feil || `Serveren svarte ${svar.status}`); } catch (e) { throw new Error(e.message?.startsWith('Serveren') || e.message?.startsWith('Logg') ? e.message : 'Ingen kontakt med SkogIQ-serveren. Oppdraget er laget – prøv å sende under Oppdrag › Utfører.'); }
      f.relay = { id: res.id, eier: res.eier }; for (const x of f.mottakere) x.kode = res.koder[x.id];
      f.status = 'sendt'; f.sendt = iDag();
      plan.tilbudKontakt = st.kontakt;
      plan.leverandorer = plan.leverandorer || []; for (const m of f.mottakere) { const l = plan.leverandorer.find((x) => samme(x, m)); if (l) Object.assign(l, { firma: m.firma || l.firma, epost: m.epost || l.epost, telefon: m.telefon || l.telefon }); else plan.leverandorer.push({ id: nyId('l'), navn: m.navn, firma: m.firma, epost: m.epost, telefon: m.telefon }); }
      st.o = o; st.steg = 4; st.sender = false; endret({ kart: false }); tegn();
      melding(`Oppdrag ${o.nr} er laget og forespørselen er klar. Send lenkene.`);
    } catch (e) { st.sender = false; endret({ kart: false }); tegn(); melding(e.message, 'feil'); }
  }

  document.addEventListener('click', async (e) => {
    const k = e.target.closest('#hurtigTilbud [data-ht]'); if (!k || !st) return; const h = k.dataset.ht;
    if (h === 'lukk') { d().close(); st = null; return; }
    if (h === 'type') { st.type = k.dataset.type; st.valgt = new Set((grupper(S(), iAar).find((g) => g.type === st.type)?.liste || []).filter((x, i) => i === 0 || (x.tiltak.aar || iAar) <= iAar + 1).map((x) => x.tiltak.id)); st.steg = 1; tegn(); return; }
    if (h === 'tilbake-type') { st.steg = 0; tegn(); return; }
    if (h === 'tilbake') { st.steg = Math.max(0, st.steg - 1); tegn(); return; }
    if (h === 'neste') { if (st.steg === 2 && (st.ny.firma || '').trim() && !leggTilNy()) return; st.steg += 1; tegn(); return; }
    if (h === 'legg-til') { if (leggTilNy()) tegn(); return; }
    if (h === 'fjern') { st.mottakere = st.mottakere.filter((m) => m.id !== k.dataset.id); tegn(); return; }
    if (h === 'reg') { const l = (S().leverandorer || [])[Number(k.dataset.i)]; if (l) st.mottakere.push({ id: nyId('m'), navn: l.firma || l.navn, firma: l.firma || l.navn, epost: l.epost || '', telefon: l.telefon || '' }); tegn(); return; }
    if (h === 'send') { send(); return; }
    if (h === 'apne') { const id = st.o.id; d().close(); st = null; apneOppdrag(id, 'utforer'); return; }
    if (h === 'kopier') { e.preventDefault(); const m = st.o.tilbud.mottakere.find((x) => x.id === k.dataset.id); try { await navigator.clipboard.writeText(lenke(st.o, m)); melding('Lenken er kopiert.'); } catch { prompt('Kopier lenken:', lenke(st.o, m)); } if (!m.sendt) { m.sendt = iDag(); endret({ kart: false }); } return; }
    if (h === 'sendt') { const m = st.o.tilbud.mottakere.find((x) => x.id === k.dataset.id); if (m && !m.sendt) { m.sendt = iDag(); endret({ kart: false }); } }
  });
  document.addEventListener('input', (e) => {
    if (!st || !e.target.closest('#hurtigTilbud')) return; const t = e.target;
    if (t.dataset.htNy) st.ny[t.dataset.htNy] = t.value;
    if (t.dataset.htF) st[t.dataset.htF] = t.value;
    if (t.dataset.htK) st.kontakt[t.dataset.htK] = t.value;
    oppdaterKnapp();
  });
  document.addEventListener('change', (e) => {
    if (!st || !e.target.closest('#hurtigTilbud')) return; const t = e.target;
    if (t.dataset.htT) { if (t.checked) st.valgt.add(t.dataset.htT); else st.valgt.delete(t.dataset.htT); tegn(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && st?.steg === 2 && e.target.closest?.('#hurtigTilbud [data-ht-ny]')) { e.preventDefault(); if (leggTilNy()) { tegn(); d().querySelector('[data-ht-ny="firma"]')?.focus(); } } });
  return { start };
}
