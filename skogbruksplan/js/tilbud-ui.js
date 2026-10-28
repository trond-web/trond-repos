// Tiltak › Oppdrag › 📨 Tilbud: be om tilbud på oppdraget fra én eller flere utførere, send personlige lenker, hent og
// sammenlign svar, og tildel oppdraget. Logikken ligger i tilbud.js, mellomleddet i tilbud-relay.js.
import { KRAV, KILDER, STATUS, nyForesporsel, offentligForesporsel, mangler, sammenlign, tildel, totalFor, foresporselTekst, akseptTekst, avslagTekst, mailto, smsLenke } from './tilbud.js';
import { sammendrag } from './oppdrag.js';
import { API, RAILWAY } from './plan-synk.js';
import { fmt } from './charts.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kr = (v) => `${Math.round(v || 0).toLocaleString('nb-NO')} kr`;
const dato = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) : '');
const iDag = () => new Date().toISOString().slice(0, 10);

export function lagTilbudUi({ hentPlan, endret, melding, nyId, okonomi, tiltakNavn }) {
  let steg = 1; let henter = false; let sistHentet = null; let leggTilModus = false;
  const S = () => hentPlan();
  const lenke = (f, m) => `${RAILWAY}/tilbud.html?f=${f.relay.id}&k=${m.kode}`;
  const pub = (o) => offentligForesporsel(S(), o, o.tilbud, { okonomi, tiltakNavn });
  async function kall(sti, { metode = 'GET', kropp } = {}) {
    let r; try { r = await fetch(`${API}${sti}`, { method: metode, headers: kropp ? { 'Content-Type': 'application/json' } : {}, body: kropp ? JSON.stringify(kropp) : undefined }); } catch { throw new Error('Ingen kontakt med SkogIQ-serveren. Sjekk nettet.'); }
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.feil || `Serveren svarte ${r.status}`); return d;
  }

  // ---------- visning ----------
  function html(o) {
    const f = o.tilbud;
    if (!f) {
      return `<div class="kort tb-start"><h4 class="undertittel" style="margin-top:0">📨 Tilbud</h4>
        <p class="hint">Be én eller flere utførere om pris på oppdraget. De får en personlig lenke med kart, omfang, krav og frister, og svarer i et enkelt skjema – uten innlogging. Du sammenligner svarene her og velger utfører med ett trykk.</p>
        <div class="knapperad"><button type="button" class="knapp primar" data-tb="start">📨 Be om tilbud</button></div></div>`;
    }
    const st = STATUS[f.status] || STATUS.utkast;
    const topp = `<div class="detalj-topp"><h4 class="undertittel" style="margin:0">📨 Tilbud <span class="pille" style="--farge:${st.farge}">${st.navn}</span></h4>${f.status === 'utkast' ? '<button type="button" class="knapp liten" data-tb="forkast">Forkast</button>' : '<button type="button" class="knapp liten" data-tb="skriv">Skriv ut forespørsel</button>'}</div>`;
    if (f.status === 'utkast') return `<div class="kort tb">${topp}${veiviser(o, f)}</div>`;
    return `<div class="kort tb">${topp}${oversikt(o, f)}</div>`;
  }
  function stegLinje() { return `<ol class="tb-steg">${['Hva', 'Krav og frister', 'Mottakere og send'].map((t, i) => `<li class="${i + 1 === steg ? 'aktiv' : i + 1 < steg ? 'ferdig' : ''}"><button type="button" data-tb="steg" data-n="${i + 1}">${i + 1}. ${t}</button></li>`).join('')}</ol>`; }
  function veiviser(o, f) {
    const s = sammendrag(S(), o, okonomi);
    const inp = (felt, v, type = 'text', ekstra = '') => `<input data-tb-felt="${felt}" type="${type}" value="${esc(v ?? '')}" ${ekstra}>`;
    let kropp = '';
    if (steg === 1) {
      kropp = `<p class="hint">Omfang fra oppdraget: ${s.bestand} bestand · ${fmt(s.areal, 1)} daa${s.m3 ? ` · ca. ${fmt(s.m3)} m³` : ''}${s.antall ? ` · ca. ${fmt(s.antall)} planter` : ''}. Kartet og bestandstabellen følger med.</p>
        <div class="skjema to-kol"><label class="hel">Tittel ${inp('tittel', f.tittel)}</label>
        <label class="hel">Beskrivelse til utførerne <textarea data-tb-felt="beskrivelse" rows="5">${esc(f.beskrivelse)}</textarea></label>
        <label>Prisform <select data-tb-felt="prisform"><option value="enhet" ${f.prisform === 'enhet' ? 'selected' : ''}>Enhetspris</option><option value="fast" ${f.prisform === 'fast' ? 'selected' : ''}>Fastpris</option></select></label>
        ${f.prisform === 'enhet' ? `<label>Enhet <select data-tb-felt="enhet">${['m³', 'daa', 'plante', 'tre', 'm', 'time'].map((e) => `<option ${e === f.enhet ? 'selected' : ''}>${e}</option>`).join('')}</select></label><label>Mengde (${esc(f.enhet)}) ${inp('mengde', f.mengde, 'number', 'step="any"')}</label>` : ''}
        <label class="hel">Befaring ${inp('befaring', f.befaring)}</label></div>`;
    }
    if (steg === 2) {
      kropp = `<div class="skjema to-kol"><label>Svarfrist ${inp('svarfrist', f.svarfrist, 'date')}</label><label>Tilbudet skal gjelde (dager etter svarfrist) ${inp('vedstaaelse', f.vedstaaelse, 'number')}</label>
        <label>Ønsket oppstart ${inp('oppstart', f.oppstart, 'date')}</label><label>Ferdig senest ${inp('ferdig', f.ferdig, 'date')}</label>
        <label class="hel">Betalingsvilkår <textarea data-tb-felt="betaling" rows="2">${esc(f.betaling)}</textarea></label></div>
        <h4 class="undertittel">Seriøsitetskrav <span class="hint">utførerne bekrefter i svaret</span></h4>
        <div class="oppdrag-sjekk">${Object.entries(KRAV).map(([id, k]) => `<label class="avkrysning"><input type="checkbox" data-tb-krav="${id}" ${f.krav.includes(id) ? 'checked' : ''}> <span>${esc(k.tekst)}</span></label>`).join('')}</div>
        <p class="hint">Bygging av skogsbilvei er underlagt byggherreforskriften (SHA-plan før oppstart). <a href="${KILDER.byggherre.url}" target="_blank" rel="noopener">Les mer</a></p>
        <h4 class="undertittel">Kontaktperson for utførerne</h4>
        <div class="skjema tre-kol"><label>Navn <input data-tb-kontakt="navn" value="${esc(f.kontakt.navn)}"></label><label>Telefon <input data-tb-kontakt="telefon" type="tel" value="${esc(f.kontakt.telefon)}"></label><label>E-post <input data-tb-kontakt="epost" type="email" value="${esc(f.kontakt.epost)}"></label></div>`;
    }
    if (steg === 3) {
      const reg = (S().leverandorer || []).filter((l) => !f.mottakere.some((m) => samme(m, l)));
      const m = mangler(f);
      kropp = `${f.mottakere.length ? `<div class="md-liste">${f.mottakere.map((x) => `<div class="md-rad"><b>${esc(x.firma || x.navn)}</b><span>${esc([x.firma ? x.navn : '', x.epost, x.telefon].filter(Boolean).join(' · '))}</span><small><button type="button" class="knapp liten" data-tb="fjern-mottaker" data-id="${esc(x.id)}">Fjern</button></small></div>`).join('')}</div>` : '<p class="hint">Legg til de du vil ha tilbud fra. Tre tilbud gir et godt grunnlag for å sammenligne.</p>'}
        ${reg.length ? `<p class="hint" style="margin-bottom:4px">Fra utførerregisteret:</p><div class="knapperad">${reg.map((l) => `<button type="button" class="knapp liten" data-tb="fra-register" data-id="${esc(l.id)}">+ ${esc(l.firma || l.navn)}</button>`).join('')}</div>` : ''}
        <div class="skjema to-kol" id="tbNy"><label>Kontaktperson <input data-tb-ny="navn"></label><label>Firma <input data-tb-ny="firma"></label><label>E-post <input data-tb-ny="epost" type="email"></label><label>Mobil <input data-tb-ny="telefon" type="tel"></label></div>
        <div class="knapperad"><button type="button" class="knapp liten" data-tb="legg-til">+ Legg til mottaker</button></div>
        ${m.length ? `<p class="hint">Før du sender: ${esc(m.join(', '))}.</p>` : ''}`;
    }
    const navig = `<div class="knapperad">${steg > 1 ? '<button type="button" class="knapp liten" data-tb="forrige">← Tilbake</button>' : ''}${steg < 3 ? '<button type="button" class="knapp primar" data-tb="neste">Neste →</button>' : `<button type="button" class="knapp primar" data-tb="send" ${mangler(f).length ? 'disabled' : ''}>📨 Send forespørsel</button>`}</div>`;
    return stegLinje() + kropp + navig;
  }
  function oversikt(o, f) {
    const s = sammendrag(S(), o, okonomi); const rader = sammenlign(f, s.areal);
    const status = (m) => { const svar = f.svar.find((x) => x.mottakerId === m.id); return svar ? `✓ Svart ${dato(svar.mottatt)}` : m.apnet ? `Åpnet ${dato(new Date(m.apnet).toISOString())}` : m.sendt ? `Sendt ${dato(m.sendt)}` : 'Ikke sendt'; };
    const send = (m) => { const t = foresporselTekst(pub(o), m, lenke(f, m)); return `${m.epost ? `<a class="knapp liten" href="${esc(mailto(m.epost, t))}" data-tb="merk-sendt" data-id="${esc(m.id)}">✉ E-post</a>` : ''}${m.telefon ? `<a class="knapp liten" href="${esc(smsLenke(m.telefon, `${t.emne}: ${lenke(f, m)}`))}" data-tb="merk-sendt" data-id="${esc(m.id)}">💬 SMS</a>` : ''}<button type="button" class="knapp liten" data-tb="kopier" data-id="${esc(m.id)}">📋 Kopier lenke</button>`; };
    const tildelt = f.status === 'tildelt'; const avsluttet = f.status === 'avsluttet';
    return `<p class="hint">Svarfrist ${esc(dato(f.svarfrist))}${f.prisform === 'enhet' ? ` · ${fmt(f.mengde, 1)} ${esc(f.enhet)}` : ' · fastpris'} · ${f.mottakere.length} mottakere · ${f.svar.length} svar${sistHentet ? ` · hentet ${sistHentet}` : ''}</p>
      <h4 class="undertittel">Mottakere</h4>
      <div class="md-liste">${f.mottakere.map((m) => `<div class="md-rad"><b>${esc(m.firma || m.navn)}</b><span>${esc(status(m))}</span>${tildelt || avsluttet ? '' : `<small>${send(m)}</small>`}</div>`).join('')}</div>
      ${tildelt || avsluttet ? '' : `<div class="knapperad"><button type="button" class="knapp" data-tb="hent" ${henter ? 'disabled' : ''}>↻ Hent svar</button><button type="button" class="knapp liten" data-tb="flere">+ Flere mottakere</button><button type="button" class="knapp liten" data-tb="manuelt">Registrer tilbud på telefon/papir</button></div>`}
      ${leggTilModus && !tildelt && !avsluttet ? nyMottakerSkjema() : ''}
      ${tbManuelt(o, f)}
      <h4 class="undertittel">Tilbud ${rader.length ? `<span class="hint">sortert på pris, eks. mva</span>` : ''}</h4>
      ${rader.length ? `<div class="md-liste">${rader.map((r) => `<div class="md-rad tb-svar${r.billigst ? ' tb-billigst' : ''}${f.valgt === r.mottakerId ? ' tb-valgt' : ''}">
        <b>${esc(r.navn)}${r.billigst ? ' · lavest pris' : ''}${f.valgt === r.mottakerId ? ' · ✓ valgt' : ''}</b>
        <span><b>${kr(r.total)}</b>${f.prisform === 'enhet' && r.enhetspris != null ? ` (${fmt(r.enhetspris, 2)} kr per ${esc(f.enhet)})` : ''}${r.perDaa ? ` · ${kr(r.perDaa)}/daa` : ''} · ${r.oppstart || r.ferdig ? `${esc(dato(r.oppstart) || '?')} – ${esc(dato(r.ferdig) || '?')}` : 'periode etter avtale'}</span>
        <small>Krav ${r.kravOk}/${f.krav.length}${r.kravAlle ? ' ✓' : ` – mangler: ${f.krav.filter((id) => !r.krav?.[id]).map((id) => KRAV[id]?.tekst.split(/[,(–]/)[0].trim()).join('; ')}`}${r.etterFrist ? ' · kom etter fristen' : ''}${!r.gyldig ? ' · tilbudet er utløpt' : r.gyldigTil ? ` · gjelder til ${esc(dato(r.gyldigTil))}` : ''}${r.orgnr ? ` · org.nr ${esc(r.orgnr)}` : ''}${r.manuelt ? ' · registrert manuelt' : ''}</small>
        ${r.kommentar ? `<small>«${esc(r.kommentar)}»</small>` : ''}
        ${tildelt || avsluttet ? '' : `<small><button type="button" class="knapp liten primar" data-tb="velg" data-id="${esc(r.mottakerId)}">Velg dette tilbudet</button></small>`}</div>`).join('')}</div>` : '<p class="hint">Ingen svar ennå. Trykk «Hent svar» – svarene hentes også når du åpner oppdraget.</p>'}
      ${tildelt ? meldinger(o, f) : avsluttet ? '' : `<div class="knapperad"><button type="button" class="knapp liten fare" data-tb="avslutt">Avslutt uten å tildele</button></div>`}`;
  }
  const nyMottakerSkjema = () => `<div class="skjema to-kol" id="tbNy"><label>Kontaktperson <input data-tb-ny="navn"></label><label>Firma <input data-tb-ny="firma"></label><label>E-post <input data-tb-ny="epost" type="email"></label><label>Mobil <input data-tb-ny="telefon" type="tel"></label></div>
      <div class="knapperad"><button type="button" class="knapp liten primar" data-tb="legg-til">+ Legg til mottaker</button></div>`;
  let manuelt = false;
  function tbManuelt(o, f) {
    if (!manuelt) return '';
    return `<div class="skjema tre-kol" id="tbManuelt"><label>Fra <select data-tbm="mottakerId">${f.mottakere.map((m) => `<option value="${esc(m.id)}">${esc(m.firma || m.navn)}</option>`).join('')}</select></label>
      ${f.prisform === 'enhet' ? `<label>Pris per ${esc(f.enhet)} <input data-tbm="enhetspris" type="number" step="0.01"></label>` : '<label>Fastpris <input data-tbm="pris" type="number"></label>'}
      <label>Oppstart <input data-tbm="oppstart" type="date"></label><label>Ferdig <input data-tbm="ferdig" type="date"></label><label>Gjelder til <input data-tbm="gyldigTil" type="date"></label>
      <label class="avkrysning" style="margin-top:22px"><input type="checkbox" data-tbm="kravAlle" checked> Alle krav bekreftet</label><label class="hel">Kommentar <input data-tbm="kommentar"></label></div>
      <div class="knapperad"><button type="button" class="knapp liten primar" data-tb="lagre-manuelt">Lagre tilbud</button></div>`;
  }
  function meldinger(o, f) {
    const v = f.svar.find((x) => x.mottakerId === f.valgt); const vm = f.mottakere.find((m) => m.id === f.valgt);
    const andre = f.mottakere.filter((m) => m.id !== f.valgt && m.epost);
    return `<p class="hint">Oppdraget er tildelt ${esc(vm?.firma || vm?.navn)} ${esc(dato(f.tildelt))}: utfører, avtalt pris og periode er lagt inn i oppdraget, og status er «bestilt».</p>
      <div class="knapperad">${vm?.epost || v?.epost ? `<a class="knapp liten primar" href="${esc(mailto(v?.epost || vm.epost, akseptTekst(o, f, v, vm)))}">✉ Send aksept</a>` : ''}${andre.map((m) => `<a class="knapp liten" href="${esc(mailto(m.epost, avslagTekst(o, f, m)))}">✉ Takk for tilbudet – ${esc(m.firma || m.navn)}</a>`).join('')}</div>
      <p class="hint">Skriv ut arbeidsordren øverst i oppdraget og send den til utføreren.</p>`;
  }
  const samme = (a, b) => (a.epost && b.epost && a.epost.toLowerCase() === b.epost.toLowerCase()) || (a.telefon && b.telefon && a.telefon.replace(/\D/g, '') === b.telefon.replace(/\D/g, '')) || (!a.epost && !a.telefon && a.navn === b.navn && a.firma === b.firma);
  function husk(m) { const plan = S(); plan.leverandorer = plan.leverandorer || []; const l = plan.leverandorer.find((x) => samme(x, m)); if (l) Object.assign(l, { navn: m.navn || l.navn, firma: m.firma || l.firma, epost: m.epost || l.epost, telefon: m.telefon || l.telefon }); else plan.leverandorer.push({ id: nyId('lev'), navn: m.navn, firma: m.firma, epost: m.epost, telefon: m.telefon }); }

  // ---------- handlinger ----------
  async function sendForesporsel(o, tegn) {
    const f = o.tilbud; const m = mangler(f); if (m.length) { melding(`Mangler: ${m.join(', ')}.`); return; }
    try {
      const d = await kall('/api/tilbud', { metode: 'POST', kropp: { data: pub(o), mottakere: f.mottakere.map((x) => ({ id: x.id, navn: x.navn })) } });
      f.relay = { id: d.id, eier: d.eier }; for (const x of f.mottakere) x.kode = d.koder[x.id];
      f.status = 'sendt'; f.sendt = iDag(); for (const x of f.mottakere) husk(x);
      S().tilbudKontakt = f.kontakt; endret({ kart: false }); tegn();
      melding('Forespørselen er klar. Send lenken til hver mottaker med e-post, SMS eller kopier den.');
    } catch (e) { melding(e.message); }
  }
  async function hent(o, tegn, { stille = false } = {}) {
    const f = o.tilbud; if (!f?.relay || henter) return; henter = true; if (!stille) tegn();
    try {
      const d = await kall(`/api/tilbud/${f.relay.id}/svar?e=${f.relay.eier}`);
      const manuelle = f.svar.filter((x) => x.manuelt && !d.svar.some((s) => s.mottakerId === x.mottakerId));
      const nye = d.svar.filter((s) => !f.svar.some((x) => x.mottakerId === s.mottakerId && x.mottatt === s.mottatt)).length;
      f.svar = [...d.svar, ...manuelle];
      for (const m of f.mottakere) m.apnet = d.apnet?.[m.id] || m.apnet || null;
      sistHentet = new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
      endret({ kart: false }); if (!stille || nye) melding(nye ? `${nye} nytt tilbud${nye > 1 ? '' : ''} hentet.` : 'Ingen nye tilbud.');
    } catch (e) { if (!stille) melding(e.message); } finally { henter = false; tegn(); }
  }
  async function oppdaterServer(o, kropp) { const f = o.tilbud; if (!f.relay) return {}; return kall(`/api/tilbud/${f.relay.id}?e=${f.relay.eier}`, { metode: 'PUT', kropp }); }
  function nyMottaker(felt) { return { id: nyId('m'), navn: felt.navn?.trim() || '', firma: felt.firma?.trim() || '', epost: felt.epost?.trim() || '', telefon: felt.telefon?.trim() || '' }; }

  return {
    html,
    // Henter svar i bakgrunnen når et oppdrag med en sendt forespørsel åpnes.
    apnet(o, tegn) { steg = o.tilbud?.status === 'utkast' ? steg : 1; manuelt = false; if (o.tilbud?.status === 'sendt') hent(o, tegn, { stille: true }); },
    async klikk(e, o, tegn) {
      const k = e.target.closest('[data-tb]'); if (!k) return false; const h = k.dataset.tb; const f = o.tilbud;
      const lagre = () => { endret({ kart: false }); tegn(); };
      if (h === 'start') { o.tilbud = nyForesporsel(S(), o, { okonomi, kontakt: S().tilbudKontakt || { navn: S().eiendom?.eier || '' } }); steg = 1; lagre(); return true; }
      if (!f) return true;
      if (h === 'forkast') { if (confirm('Forkaste tilbudsforespørselen?')) { delete o.tilbud; lagre(); } return true; }
      if (h === 'steg') { steg = Number(k.dataset.n); tegn(); return true; }
      if (h === 'neste') { steg = Math.min(3, steg + 1); tegn(); return true; }
      if (h === 'forrige') { steg = Math.max(1, steg - 1); tegn(); return true; }
      if (h === 'fjern-mottaker') { f.mottakere = f.mottakere.filter((m) => m.id !== k.dataset.id); lagre(); return true; }
      if (h === 'fra-register') { const l = (S().leverandorer || []).find((x) => x.id === k.dataset.id); if (l) f.mottakere.push({ ...nyMottaker(l) }); lagre(); return true; }
      if (h === 'legg-til') {
        const v = Object.fromEntries([...document.querySelectorAll('[data-tb-ny]')].map((x) => [x.dataset.tbNy, x.value]));
        if (!v.navn && !v.firma) { melding('Skriv navn eller firma.'); return true; }
        if (!v.epost && !v.telefon) { melding('Legg inn e-post eller mobil, så lenken kan sendes.'); return true; }
        const ny = nyMottaker(v);
        if (f.status === 'sendt') { const d = await oppdaterServer(o, { mottakere: [{ id: ny.id, navn: ny.navn }] }).catch((x) => { melding(x.message); return null; }); if (!d) return true; ny.kode = d.koder?.[ny.id]; husk(ny); }
        f.mottakere.push(ny); leggTilModus = false; lagre(); return true;
      }
      if (h === 'send') { await sendForesporsel(o, tegn); return true; }
      if (h === 'flere') { manuelt = false; leggTilModus = !leggTilModus; tegn(); return true; }
      if (h === 'merk-sendt') { const m = f.mottakere.find((x) => x.id === k.dataset.id); if (m && !m.sendt) { m.sendt = iDag(); endret({ kart: false }); setTimeout(tegn, 300); } return false; } // lenken åpner e-post/SMS
      if (h === 'kopier') { const m = f.mottakere.find((x) => x.id === k.dataset.id); try { await navigator.clipboard.writeText(lenke(f, m)); melding('Lenken er kopiert.'); } catch { prompt('Kopier lenken:', lenke(f, m)); } if (m && !m.sendt) { m.sendt = iDag(); lagre(); } return true; }
      if (h === 'hent') { await hent(o, tegn); return true; }
      if (h === 'manuelt') { manuelt = !manuelt; tegn(); return true; }
      if (h === 'lagre-manuelt') {
        const v = Object.fromEntries([...document.querySelectorAll('[data-tbm]')].map((x) => [x.dataset.tbm, x.type === 'checkbox' ? x.checked : x.value]));
        const s = { mottakerId: v.mottakerId, prisform: f.prisform, pris: v.pris ? Number(v.pris) : null, enhetspris: v.enhetspris ? Number(v.enhetspris) : null, oppstart: v.oppstart, ferdig: v.ferdig, gyldigTil: v.gyldigTil, kommentar: v.kommentar, krav: Object.fromEntries(f.krav.map((id) => [id, !!v.kravAlle])), mottatt: new Date().toISOString(), manuelt: true };
        if (s.pris == null && s.enhetspris == null) { melding('Oppgi pris.'); return true; }
        f.svar = [...f.svar.filter((x) => x.mottakerId !== s.mottakerId), s]; manuelt = false; lagre(); return true;
      }
      if (h === 'velg') {
        const m = f.mottakere.find((x) => x.id === k.dataset.id); const s = f.svar.find((x) => x.mottakerId === k.dataset.id);
        if (!confirm(`Velge tilbudet fra ${m?.firma || m?.navn} på ${kr(totalFor(f, s))} eks. mva? Oppdraget får utfører, pris og periode, og status «bestilt».`)) return true;
        tildel(o, f, k.dataset.id); await oppdaterServer(o, { status: 'tildelt', mottakere: { valgt: k.dataset.id } }).catch(() => melding('Tildelt i planen – serveren kunne ikke oppdateres nå, utførerne ser resultatet senere.'));
        lagre(); melding(`Oppdraget er tildelt ${m?.firma || m?.navn}. Send aksept og takk de andre for tilbudet.`); return true;
      }
      if (h === 'avslutt') { if (!confirm('Avslutte forespørselen uten å tildele oppdraget?')) return true; f.status = 'avsluttet'; await oppdaterServer(o, { status: 'avsluttet' }).catch(() => null); lagre(); return true; }
      if (h === 'skriv') { skrivUt(o); return true; }
      return true;
    },
    endring(e, o, tegn) {
      const t = e.target; const f = o.tilbud; if (!f) return false;
      if (t.dataset.tbFelt) { const n = t.dataset.tbFelt; f[n] = ['mengde', 'vedstaaelse'].includes(n) ? (t.value === '' ? null : Number(t.value)) : t.value; endret({ kart: false }); if (['prisform', 'enhet'].includes(n)) tegn(); return true; }
      if (t.dataset.tbKrav) { f.krav = t.checked ? [...new Set([...f.krav, t.dataset.tbKrav])] : f.krav.filter((x) => x !== t.dataset.tbKrav); endret({ kart: false }); return true; }
      if (t.dataset.tbKontakt) { f.kontakt = { ...f.kontakt, [t.dataset.tbKontakt]: t.value }; endret({ kart: false }); return true; }
      if (t.dataset.tbNy || t.dataset.tbm) return true;
      return false;
    },
  };

  function skrivUt(o) {
    const d = pub(o); const w = window.open('', '_blank'); if (!w) { melding('Nettleseren blokkerte utskriftsvinduet.'); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Tilbudsforespørsel ${esc(d.nr)}</title><style>body{font:12px/1.45 system-ui,sans-serif;max-width:900px;margin:20px auto;padding:0 16px;color:#111}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:16px 0 6px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:4px 6px;text-align:left}th{background:#f3f3ef}pre{white-space:pre-wrap;font:inherit}</style>
      <h1>Forespørsel om tilbud – ${esc(d.tittel)}</h1><div>${esc(d.typeNavn)} · ${esc(d.sted)} · oppdrag ${esc(d.nr)}</div>
      <h2>Frister og vilkår</h2><table><tr><th>Svarfrist</th><td>${esc(d.svarfrist)}</td></tr><tr><th>Periode</th><td>${esc(d.oppstart || 'etter avtale')} – ${esc(d.ferdig || 'etter avtale')}</td></tr><tr><th>Prisform</th><td>${esc(d.prisTekst)}${d.prisform === 'enhet' ? ` – ${d.mengde} ${esc(d.enhet)}` : ''}, eks. mva</td></tr><tr><th>Tilbudet gjelder</th><td>${d.vedstaaelse} dager etter svarfrist</td></tr><tr><th>Betaling</th><td>${esc(d.betaling)}</td></tr><tr><th>Kontakt</th><td>${esc(d.kontakt.navn)} ${esc(d.kontakt.telefon)} ${esc(d.kontakt.epost)}</td></tr></table>
      <h2>Beskrivelse</h2><pre>${esc(d.beskrivelse)}</pre>
      <h2>Bestand</h2><table><tr><th>Bestand</th><th>Tiltak</th><th>Daa</th><th>Treslag</th><th>Alder</th><th>Ca. m³</th></tr>${d.omfang.bestand.map((b) => `<tr><td>${esc(b.nr)}</td><td>${esc(b.tiltak)} ${b.aar}</td><td>${b.areal}</td><td>${esc(b.treslag)}${esc(b.bonitet)}</td><td>${esc(b.alder)}</td><td>${b.m3 || ''}</td></tr>`).join('')}<tr><th>Sum</th><th></th><th>${d.omfang.areal}</th><th></th><th></th><th>${d.omfang.m3 || ''}</th></tr></table>
      <h2>Krav – bekreftes i tilbudet</h2><ul>${d.krav.map((k) => `<li>${esc(k.tekst)}</li>`).join('')}</ul>
      <h2>Tilbud</h2><table><tr><th>Firma / org.nr</th><td style="height:28px"></td></tr><tr><th>Pris eks. mva</th><td style="height:28px"></td></tr><tr><th>Oppstart – ferdig</th><td style="height:28px"></td></tr><tr><th>Dato / signatur</th><td style="height:40px"></td></tr></table><script>setTimeout(()=>print(),300)<\/script>`);
    w.document.close();
  }
}
