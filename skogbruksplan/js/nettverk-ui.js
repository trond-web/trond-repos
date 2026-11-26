// Fanen «Nettverk»: skogeiere kobler seg til innkjøpere, entreprenører og rådgivere, og partene chatter direkte i SkogIQ.ai.
// Skogeier: statistikk, «Mine innkjøpere», «Mine entreprenører», «Mine rådgivere», søk i aktørene og «Be om kobling».
// Innkjøper/entreprenør/rådgiver: «Mine skogeiere», forespørsler og invitasjon av skogeiere med e-post.
// En skogeier kan knytte seg til flere rådgivere. Rådgivere vises i katalogen bare når de selv har valgt det.
// Uleste meldinger og nye forespørsler vises som merke på fanen. Serveren: nettverk.js (/api/nettverk).
import { API, RAILWAY } from './plan-synk.js';
import { mailto, appAdresse } from './epost.js';
import { innloggetBruker, lagreKommuner, minProfil, RADGIVER_TYPER } from './innlogging.js';
import { lagKommunevelger, kommuneTekst } from './kommunevelger.js';
import { avatar, fyllBilder } from './profilbilde-ui.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nb = (v) => Number(v || 0).toLocaleString('nb-NO');
export const ROLLE = { skogeier: { navn: 'Skogeier/gårdbruker', entall: 'skogeier/gårdbruker', flertall: 'skogeiere og gårdbrukere', ikon: '🌲' }, innkjoper: { navn: 'Innkjøper', entall: 'innkjøper', flertall: 'innkjøpere', ikon: '🪵' }, entreprenor: { navn: 'Entreprenør', entall: 'entreprenør', flertall: 'entreprenører', ikon: '🚜' }, radgiver: { navn: 'Rådgiver / regnskapsfører', kort: 'Rådgiver', entall: 'rådgiver', flertall: 'rådgivere', ikon: '📊' }, offentlig: { navn: 'Offentlig', entall: 'offentlig', flertall: 'offentlige', ikon: '🏛' } };
export const antall = (n, r) => `${nb(n)} ${n === 1 ? ROLLE[r].entall : ROLLE[r].flertall}`;
const tid = (ms) => { const d = new Date(ms); const idag = new Date(); return d.toDateString() === idag.toDateString() ? d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }) + (d.getFullYear() !== idag.getFullYear() ? ` ${d.getFullYear()}` : ''); };

// skogKommuner() → [{ nr, navn }]: kommunene til planene på enheten (skogeiere ser aktører i disse kommunene).
export function lagNettverk({ rot, melding, innlogget, merke = () => {}, skogKommuner = async () => [], apneTilbud = () => {} }) {
  let data = null; let feil = ''; let laster = false; let sok = { q: '', rolle: '', liste: null, laster: false }; let chat = null; let poll = null; let bakgrunn = null; let sistUlest = 0; let synlig = false; let kvRed = null; let kvVelger = null; let innboks = []; /* tilbudsforespørsler til innkjøpere/entreprenører */ let nyeSvar = []; /* svar til skogeieren */ let tbApen = null; /* forespørselen som er åpen i appen */ let epostForslag = null; // ferdig e-post etter invitasjon (mailto)
  async function kall(sti, { metode = 'GET', kropp } = {}) {
    const r = await fetch(`${API}${sti}`, { method: metode, headers: kropp ? { 'Content-Type': 'application/json' } : {}, credentials: 'same-origin', body: kropp ? JSON.stringify(kropp) : undefined });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.feil || `Serveren svarte ${r.status}`), { status: r.status }); return j;
  }
  const harRolle = (r) => (data?.roller || []).includes(r);
  const erTilbudsmottaker = () => harRolle('innkjoper') || harRolle('entreprenor');
  const erAktor = () => erTilbudsmottaker() || harRolle('radgiver');
  const AKTORER = ['innkjoper', 'entreprenor', 'radgiver'];
  const rgTekst = (rg) => (rg?.typer || []).map((x) => RADGIVER_TYPER[x]?.navn).filter(Boolean).join(', ');

  async function hent({ stille = false } = {}) {
    if (!innlogget()) return;
    if (!stille) { laster = true; tegn(); }
    try { data = await kall('/api/nettverk'); feil = ''; } catch (e) { feil = e.message; }
    // Tilbudsforespørsler fra skogeiere i nettverket (bare for innkjøpere og entreprenører)
    if (data && erTilbudsmottaker()) { try { innboks = (await kall('/api/tilbud/innboks')).innboks || []; } catch { /* beholder forrige */ } } else innboks = [];
    // Nye svar og «ikke aktuelt» på skogeierens forespørsler
    if (data && harRolle('skogeier')) { try { nyeSvar = (await kall('/api/tilbud/nye-svar')).nyeSvar || []; } catch { /* beholder forrige */ } } else nyeSvar = [];
    laster = false; oppdaterMerke(); if (synlig && !chat) tegn();
  }
  function oppdaterMerke() {
    const n = (data?.ulest || 0) + (data?.forespørsler || 0) + nyeTilbud().length + nyeSvar.length; merke(n);
    if (data && data.ulest > sistUlest && !(chat && synlig)) { const ny = data.koblinger.find((k) => k.ulest && k.siste && !k.siste.fraMeg); if (ny) melding(`💬 Ny melding fra ${ny.motpart.navn}: «${ny.siste.tekst.slice(0, 60)}»`); }
    sistUlest = data?.ulest || 0;
  }
  async function sokAktorer() {
    sok.laster = true; tegn();
    try {
      // Kommunene til planene på enheten følger med; serveren legger til profilen og planene i skyen.
      const lok = await skogKommuner().catch(() => []);
      const nr = [...new Set(lok.map((k) => k.nr).filter((x) => /^\d{4}$/.test(String(x))))]; const navn = [...new Set(lok.filter((k) => !/^\d{4}$/.test(String(k.nr || ''))).map((k) => k.navn).filter(Boolean))];
      const r = await kall(`/api/nettverk/aktorer?q=${encodeURIComponent(sok.q)}&rolle=${encodeURIComponent(sok.rolle)}&kommuner=${nr.join(',')}&kommunenavn=${encodeURIComponent(navn.join('|'))}`);
      sok.liste = r.aktorer; sok.mineKommuner = r.mineKommuner || []; sok.mangler = !!r.manglerKommune;
    } catch (e) { melding(e.message, 'feil'); sok.liste = []; }
    sok.laster = false; tegn();
  }

  // ---------- visning ----------
  function statistikkHtml() {
    const s = data.statistikk;
    return `<div class="nv-stat">${[['innkjoper', s.innkjopere], ['entreprenor', s.entreprenorer], ['radgiver', s.radgivere || 0], ['skogeier', s.skogeiere]].map(([r, n]) => `<div><span aria-hidden="true">${ROLLE[r].ikon}</span><b>${nb(n)}</b><small>${n === 1 ? ROLLE[r].entall : ROLLE[r].flertall}</small></div>`).join('')}</div>`;
  }
  function personHtml(k, { knapper = '' } = {}) {
    const m = k.motpart || k;
    const rolle = k.rolle ? ROLLE[k.rolle] : null;
    return `<div class="nv-person${k.ulest ? ' ulest' : ''}">
      ${avatar(m)}
      <span class="nv-hoved"><b>${esc(m.navn)}</b><span class="hint">${esc([m.foretak, (m.kommuner || []).length ? `📍 ${kommuneTekst((m.kommuner || []).map((navn) => ({ navn })))}` : m.kommune].filter(Boolean).join(' · ') || (m.roller || []).map((r) => ROLLE[r]?.navn).filter(Boolean).join(', '))}${rolle && k.jegEr === 'skogeier' ? ` · ${rolle.navn.toLowerCase()}` : ''}</span>
        ${m.radgiver && (k.rolle === 'radgiver' || !k.rolle) ? `<span class="nv-rg"><b>📊 ${esc(rgTekst(m.radgiver))}</b>${m.radgiver.beskrivelse ? ` – ${esc(m.radgiver.beskrivelse)}` : ''}</span>` : ''}
        ${k.siste ? `<span class="nv-siste">${k.siste.fraMeg ? 'Du: ' : ''}${esc(k.siste.tekst)} <span class="hint">· ${tid(k.siste.tid)}</span></span>` : ''}</span>
      <span class="nv-knapper">${k.ulest ? `<span class="nv-ulest">${k.ulest}</span>` : ''}${knapper}</span>
    </div>`;
  }
  function liste(tittel, koblinger, tom) {
    return `<h4 class="undertittel">${tittel} <span class="hint">${koblinger.length}</span></h4>${koblinger.length ? koblinger.map((k) => personHtml(k, { knapper: `<button type="button" class="knapp liten primar" data-nv="chat" data-id="${k.id}">💬 Chat</button>` })).join('') : `<p class="hint">${tom}</p>`}`;
  }
  function foresporslerHtml() {
    const inn = data.koblinger.filter((k) => k.status === 'foresporsel' && !k.fraMeg);
    const ut = data.koblinger.filter((k) => k.status === 'foresporsel' && k.fraMeg);
    const avslatt = data.koblinger.filter((k) => k.status === 'avslatt' && k.fraMeg);
    if (!inn.length && !ut.length && !avslatt.length) return '';
    const hva = (k) => (k.jegEr === 'skogeier' ? `vil koble seg til deg som ${ROLLE[k.rolle].navn.toLowerCase()}` : 'vil koble seg til deg som skogeier');
    return `<div class="nv-foresporsler">
      ${inn.length ? `<h4 class="undertittel">Forespørsler til deg <span class="nv-ulest">${inn.length}</span></h4>${inn.map((k) => personHtml({ ...k, motpart: { ...k.motpart, foretak: `${k.motpart.foretak ? `${k.motpart.foretak} · ` : ''}${hva(k)}` } }, { knapper: `<button type="button" class="knapp liten primar" data-nv="godta" data-id="${k.id}">Godta</button><button type="button" class="knapp liten" data-nv="avsla" data-id="${k.id}">Avslå</button>` })).join('')}` : ''}
      ${ut.length ? `<h4 class="undertittel">Venter på svar <span class="hint">${ut.length}</span></h4>${ut.map((k) => personHtml(k, { knapper: `<span class="hint">sendt ${tid(k.opprettet)}</span><button type="button" class="knapp liten" data-nv="trekk" data-id="${k.id}">Trekk</button>` })).join('')}` : ''}
      ${avslatt.length ? `<p class="hint">${avslatt.map((k) => esc(k.motpart.navn)).join(', ')} takket nei til forespørselen.</p>` : ''}
    </div>`;
  }
  function skogeierHtml() {
    const aktive = data.koblinger.filter((k) => k.status === 'aktiv' && k.jegEr === 'skogeier');
    return `<section class="nv-del">
      <h3>🌲 Som skogeier</h3>
      ${nyeSvarHtml()}
      ${liste('🪵 Mine innkjøpere', aktive.filter((k) => k.rolle === 'innkjoper'), 'Ingen ennå. Finn en innkjøper under og be om kobling.')}
      ${liste('🚜 Mine entreprenører', aktive.filter((k) => k.rolle === 'entreprenor'), 'Ingen ennå. Finn en entreprenør under og be om kobling.')}
      ${liste('📊 Mine rådgivere', aktive.filter((k) => k.rolle === 'radgiver'), 'Ingen ennå. Du kan knytte deg til en eller flere rådgivere – skogbruk, landbruk, regnskap, skatt og annet. Finn dem under.')}
      <h4 class="undertittel">Finn innkjøpere, entreprenører og rådgivere</h4>
      ${kvRed === 'skog' ? kvRedHtml('Kommuner du har skog i', 'Kommunene til planene dine teller med automatisk. Legg til flere her.') : sok.mangler ? `<div class="nv-kv-info mangler">📍 Vi vet ikke hvilke kommuner du har skog i. Lag eller last opp en skogbruksplan, eller <button type="button" class="lenkeknapp" data-nv="kv-skog">legg til kommuner</button> – da ser du innkjøpere, entreprenører og rådgivere som opererer der. Rådgivere som jobber i hele landet, vises alltid.</div>` : sok.mineKommuner?.length ? `<div class="nv-kv-info">📍 Viser innkjøpere, entreprenører og rådgivere som opererer i <b>${esc(kommuneTekst(sok.mineKommuner, 4))}</b>, og rådgivere i hele landet. <button type="button" class="lenkeknapp" data-nv="kv-skog">Endre</button></div>` : ''}
      <div class="nv-sok"><input type="search" data-nv-sok placeholder="Søk navn, firma eller kommune" value="${esc(sok.q)}" aria-label="Søk etter aktører"><select data-nv-rolle aria-label="Rolle"><option value="">Alle</option><option value="innkjoper" ${sok.rolle === 'innkjoper' ? 'selected' : ''}>Innkjøpere</option><option value="entreprenor" ${sok.rolle === 'entreprenor' ? 'selected' : ''}>Entreprenører</option><option value="radgiver" ${sok.rolle === 'radgiver' ? 'selected' : ''}>Rådgivere</option></select><button type="button" class="knapp" data-nv="sok">Søk</button></div>
      ${sok.laster ? '<p class="hint">Søker …</p>' : sok.liste ? (sok.liste.length ? sok.liste.map((a) => personHtml({ motpart: a }, { knapper: AKTORER.filter((r) => a.roller.includes(r) && (r !== 'radgiver' || a.radgiver?.synlig)).map((r) => (a.kobling ? `<span class="nv-merke">${a.kobling === 'aktiv' ? '✓ koblet' : 'venter'}</span>` : `<button type="button" class="knapp liten" data-nv="be" data-til="${esc(a.bruker)}" data-rolle="${r}">＋ ${ROLLE[r].kort || ROLLE[r].navn}</button>`)).filter((x, i, l) => l.indexOf(x) === i).join('') })).join('') : '<p class="hint">Ingen treff.</p>') : ''}
    </section>`;
  }
  // ---------- tilbudsforespørsler (innkjøper/entreprenør) ----------
  const nyeTilbud = () => innboks.filter((x) => x.status === 'sendt' && !x.apnet && !x.svart && !x.avslatt && !x.utlopt);
  const datoKort = (d) => (d ? String(d).slice(0, 10).split('-').reverse().slice(0, 2).join('.') : '');
  function tilbudStatus(x) {
    if (x.status === 'tildelt') return x.vunnet ? ['vunnet', '🏆 Du fikk oppdraget'] : ['tapt', 'Gikk til en annen'];
    if (x.status === 'avsluttet') return ['avsluttet', 'Avsluttet av skogeieren'];
    if (x.utlopt) return ['avsluttet', 'Utløpt'];
    if (x.svart) return ['svart', `✓ Tilbud sendt ${datoKort(new Date(x.svart).toISOString())}`];
    if (x.avslatt) return ['avslatt', 'Takket nei'];
    if (x.fristUte) return ['frist', 'Svarfristen er ute'];
    return x.apnet ? ['apnet', 'Åpnet – ikke svart'] : ['ny', 'Ny'];
  }
  function innboksHtml() {
    if (!innboks.length) return '';
    const nye = nyeTilbud().length; const base = API || (typeof location !== 'undefined' ? location.origin : RAILWAY); const lenke = (x) => `${base}/tilbud.html?f=${x.id}&k=${x.kode}`;
    return `<h4 class="undertittel">📨 Tilbudsforespørsler ${nye ? `<span class="nv-ulest">${nye} ny${nye > 1 ? 'e' : ''}</span>` : `<span class="hint">${innboks.length}</span>`}</h4>
      <div class="nv-tilbud">${innboks.map((x) => { const [k, t] = tilbudStatus(x); const apen = x.status === 'sendt' && !x.utlopt; return `<div class="nv-tb ${k}">
        <div class="nv-tb-topp"><b>${esc(x.tittel)}</b><span class="nv-tb-status ${k}">${esc(t)}</span></div>
        <span class="hint">Fra <b>${esc(x.fra || 'skogeier')}</b>${x.sted ? ` · ${esc(x.sted)}` : ''}${x.bestand ? ` · ${x.bestand} bestand, ${String(x.areal).replace('.', ',')} daa` : ''}${x.svarfrist ? ` · <span class="${x.fristUte && apen ? 'nv-tb-frist' : ''}">svar innen ${esc(datoKort(x.svarfrist))}</span>` : ''}</span>
        <div class="knapperad" style="margin:4px 0 0"><button type="button" class="knapp liten${apen && !x.svart && !x.avslatt ? ' primar' : ''}" data-nv-tb="${esc(x.id)}">${!apen ? 'Se forespørselen' : x.svart ? 'Se eller endre tilbudet' : x.avslatt ? 'Se forespørselen' : 'Åpne og gi tilbud'}</button><a class="lenkeknapp" href="${esc(lenke(x))}" target="_blank" rel="noopener" title="Åpne i egen fane">↗ egen fane</a></div>
      </div>`; }).join('')}</div>`;
  }
  // Forespørselen åpnet inne i appen (svarsiden i en ramme).
  function tbVisningHtml() {
    const x = innboks.find((y) => y.id === tbApen); if (!x) return '';
    return `<div class="kort nv-tb-vis"><div class="nv-tb-vis-topp"><button type="button" class="knapp liten" data-nv="tb-lukk">← Tilbudsforespørsler</button><b>${esc(x.tittel)}</b></div>
      <iframe class="nv-tb-ramme" src="tilbud.html?f=${encodeURIComponent(x.id)}&k=${encodeURIComponent(x.kode)}&inne=1" title="Tilbudsforespørsel: ${esc(x.tittel)}"></iframe></div>`;
  }
  // Skogeieren: nye svar og «ikke aktuelt» på forespørslene sine.
  function nyeSvarHtml() {
    if (!nyeSvar.length) return '';
    const pris = (s, x) => (s.pris != null ? `${nb(Math.round(s.pris))} kr` : s.enhetspris != null ? `${String(s.enhetspris).replace('.', ',')} kr per ${x.enhet || 'enhet'}` : '');
    return `<h4 class="undertittel">📬 Svar på forespørslene dine <span class="nv-ulest">${nyeSvar.length}</span></h4>
      <div class="nv-tilbud">${nyeSvar.map((x) => `<div class="nv-tb ny">
        <div class="nv-tb-topp"><b>${esc(x.tittel)}</b>${x.nr ? `<span class="hint">oppdrag ${esc(x.nr)}</span>` : ''}</div>
        ${x.svar.map((s) => `<span>✅ <b>${esc(s.navn)}</b> ga tilbud${pris(s, x) ? `: ${esc(pris(s, x))} eks. mva` : ''}</span>`).join('')}
        ${x.avslag.map((a) => `<span>🙅 <b>${esc(a.navn)}</b> takket nei${a.grunn ? ` – «${esc(a.grunn)}»` : ''}</span>`).join('')}
        <div class="knapperad" style="margin:4px 0 0"><button type="button" class="knapp liten primar" data-nv="se-svar" data-id="${esc(x.id)}">Se og sammenlign</button></div></div>`).join('')}</div>`;
  }
  function kvRedHtml(tittel, hint) {
    return `<div class="nv-kv-red"><b>📍 ${esc(tittel)}</b><span class="hint">${esc(hint)}</span><div data-nv-kv-plass></div><div class="knapperad"><button type="button" class="knapp liten primar" data-nv="kv-lagre">Lagre</button><button type="button" class="knapp liten" data-nv="kv-avbryt">Avbryt</button></div></div>`;
  }
  function aktorHtml() {
    const aktive = data.koblinger.filter((k) => k.status === 'aktiv' && k.jegEr === 'aktor');
    const mineRoller = AKTORER.filter(harRolle); const bareRadgiver = !erTilbudsmottaker(); const rg = innloggetBruker()?.profil?.radgiver; const egneKv = innloggetBruker()?.profil?.kommuner || [];
    return `<section class="nv-del">
      <h3>${mineRoller.map((r) => ROLLE[r].ikon).join('')} Som ${mineRoller.map((r) => ROLLE[r].navn.toLowerCase()).join(' og ')}</h3>
      ${harRolle('entreprenor') ? '<div class="nv-kv-info">📲 Oppdrag som skogeiere sender deg, gjennomfører du i <b>SkogIQ Entreprenør</b> på mobilen – framdrift, miljøsjekk, avvik med bilde og ferdigmelding med signatur. <a class="knapp liten primar" href="entreprenor.html">Åpne SkogIQ Entreprenør</a></div>' : ''}
      ${innboksHtml()}
      ${harRolle('radgiver') ? `<div class="nv-kv-info${rg?.synlig ? '' : ' skjult'}">📊 <b>${esc(rgTekst(rg) || 'Rådgiver')}</b>${rg?.beskrivelse ? ` – ${esc(rg.beskrivelse)}` : ''}<br>${rg?.synlig ? '✓ Skogeiere og gårdbrukere kan finne deg og be om kobling.' : '🔒 Du er skjult i katalogen – du inviterer selv kundene dine under.'} <button type="button" class="lenkeknapp" data-nv="profil">Endre i Min profil</button></div>` : ''}
      ${kvRed === 'aktor' ? kvRedHtml('Kommuner du opererer i', bareRadgiver ? 'Valgfritt for rådgivere – uten kommuner vises du for skogeiere og gårdbrukere i hele landet.' : 'Skogeiere med skog i disse kommunene finner deg i katalogen.') : `<div class="nv-kv-info${egneKv.length || bareRadgiver ? '' : ' mangler'}">📍 ${egneKv.length ? `Du opererer i <b>${esc(kommuneTekst(egneKv, 5))}</b>` : bareRadgiver ? 'Du vises for skogeiere og gårdbrukere i hele landet.' : 'Du har ikke valgt kommuner – skogeiere finner deg ikke ennå.'} <button type="button" class="lenkeknapp" data-nv="kv-aktor">${egneKv.length ? 'Endre' : bareRadgiver ? 'Begrens til kommuner' : 'Velg kommuner'}</button></div>`}
      ${liste('🌲 Mine skogeiere', aktive, 'Ingen skogeiere ennå. Skogeiere kan finne deg og be om kobling, eller du kan invitere dem under.')}
      <h4 class="undertittel">Inviter en skogeier</h4>
      <p class="hint" style="margin-top:0">Skriv e-postadressen skogeieren bruker i SkogIQ.ai. Skogeieren får forespørselen og godtar den.</p>
      <div class="nv-sok"><input type="email" data-nv-inviter placeholder="skogeier@epost.no" aria-label="Skogeierens e-post">${mineRoller.length > 1 ? `<select data-nv-inviter-rolle aria-label="Som">${mineRoller.map((r) => `<option value="${r}">som ${ROLLE[r].navn.toLowerCase()}</option>`).join('')}</select>` : ''}<button type="button" class="knapp" data-nv="inviter">Send forespørsel</button></div>
      ${epostForslag ? `<div class="nv-epost"><span>${esc(epostForslag.hint)}</span><a class="knapp primar" href="${esc(mailto(epostForslag))}" data-nv-epost>✉ ${esc(epostForslag.knapp)}</a></div>` : ''}
    </section>`;
  }
  function chatHtml() {
    const k = data?.koblinger.find((x) => x.id === chat.id); if (!k) return '<p class="hint">Koblingen finnes ikke lenger.</p>';
    const m = k.motpart;
    return `<div class="nv-chat">
      <div class="nv-chat-topp"><button type="button" class="knapp liten" data-nv="tilbake">←</button>${avatar(m)}<span class="nv-hoved"><b>${esc(m.navn)}</b><span class="hint">${esc([k.jegEr === 'skogeier' ? ROLLE[k.rolle].navn : 'Skogeier', m.foretak, m.kommune].filter(Boolean).join(' · '))}</span></span>
        <details class="nv-meny"><summary aria-label="Mer">⋯</summary><button type="button" class="knapp liten fare" data-nv="avslutt" data-id="${k.id}">Avslutt koblingen</button></details></div>
      <div class="nv-meldinger" id="nvMeldinger" role="log" aria-live="polite">${chat.meldinger.length ? chat.meldinger.map((x, i) => { const ny = i === 0 || new Date(x.tid).toDateString() !== new Date(chat.meldinger[i - 1].tid).toDateString(); return `${ny ? `<div class="nv-dag">${new Date(x.tid).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })}</div>` : ''}<div class="nv-boble ${x.fraMeg ? 'meg' : ''}"><span>${esc(x.tekst).replace(/\n/g, '<br>')}</span><small>${new Date(x.tid).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}${x.fraMeg && x.lest && i === chat.meldinger.length - 1 ? ' · lest' : ''}</small></div>`; }).join('') : `<p class="hint nv-tom">Ingen meldinger ennå. Si hei til ${esc(m.navn.split(' ')[0])}!</p>`}</div>
      ${k.status === 'aktiv' ? `<form class="nv-skriv" data-nv-skjema><textarea data-nv-tekst rows="1" placeholder="Skriv en melding …" aria-label="Melding" maxlength="2000">${esc(chat.utkast || '')}</textarea><button type="submit" class="knapp primar" aria-label="Send">➤</button></form>` : '<p class="hint">Koblingen er avsluttet – chatten er stengt.</p>'}
    </div>`;
  }
  function tegn() {
    const el0 = rot(); const kvEl = kvRed && el0?.querySelector('[data-nv-kv-plass] > .kv'); // behold velgeren (og det som er valgt) ved ny tegning
    tegnInnhold();
    const plass = rot()?.querySelector('[data-nv-kv-plass]');
    if (plass && kvRed) { if (kvEl) plass.appendChild(kvEl); else { const d = document.createElement('div'); plass.appendChild(d); const egne = innloggetBruker()?.profil?.kommuner || []; kvVelger = lagKommunevelger(d, { valgt: egne }); setTimeout(() => d.querySelector('[data-kv-sok]')?.focus(), 0); } }
  }
  function tegnInnhold() {
    const el = rot(); if (!el) return;
    if (!innlogget()) { el.innerHTML = '<div class="kort"><p>Logg inn for å bruke nettverket.</p></div>'; return; }
    if (tbApen && innboks.some((y) => y.id === tbApen)) { if (!el.querySelector('.nv-tb-ramme')) el.innerHTML = tbVisningHtml(); return; } // rammen beholdes (ikke last på nytt)
    if (chat) { el.innerHTML = chatHtml(); fyllBilder(el); const l = el.querySelector('#nvMeldinger'); if (l) l.scrollTop = l.scrollHeight; return; }
    if (laster && !data) { el.innerHTML = '<div class="kort"><p class="hint">Henter nettverket …</p></div>'; return; }
    if (!data) { el.innerHTML = `<div class="kort"><p>${esc(feil || 'Nettverket er ikke tilgjengelig.')}</p><button type="button" class="knapp liten" data-nv="oppdater">Prøv igjen</button></div>`; return; }
    const ingenRolle = !harRolle('skogeier') && !erAktor();
    el.innerHTML = `<div class="kort nv">
      <p class="hint" style="margin-top:0">Koble deg til innkjøpere, entreprenører og rådgivere – eller til skogeierne dine – og skriv sammen direkte i SkogIQ.ai.</p>
      ${statistikkHtml()}
      ${foresporslerHtml()}
      ${harRolle('skogeier') ? skogeierHtml() : ''}
      ${erAktor() ? aktorHtml() : ''}
      ${ingenRolle ? '<p class="hint">Nettverket er for skogeiere og gårdbrukere, innkjøpere, entreprenører og rådgivere. Endre rollene dine i Min profil.</p>' : ''}
      <div class="knapperad"><button type="button" class="knapp liten" data-nv="oppdater">🔄 Oppdater</button><button type="button" class="knapp liten" data-hjelp="nettverk">? Hjelp</button></div>
    </div>`;
    fyllBilder(el);
  }

  // ---------- chat ----------
  async function apneChat(id) {
    chat = { id, meldinger: [], sist: 0, utkast: '' }; tegn();
    await hentMeldinger(); clearInterval(poll); poll = setInterval(() => { if (synlig && chat && !document.hidden) hentMeldinger(); }, 4000);
    rot()?.querySelector('[data-nv-tekst]')?.focus();
  }
  async function hentMeldinger() {
    if (!chat) return; const id = chat.id;
    try {
      const r = await kall(`/api/nettverk/koblinger/${id}/meldinger?etter=${chat.sist}`); if (!chat || chat.id !== id) return;
      const ny = r.meldinger.filter((m) => !chat.meldinger.some((x) => x.id === m.id));
      let lestEndret = false; for (const m of chat.meldinger) if (m.fraMeg) { const l = m.tid <= r.motpartLest; if (l !== m.lest) lestEndret = true; m.lest = l; }
      if (ny.length) { chat.meldinger.push(...ny); chat.sist = chat.meldinger.at(-1).tid; }
      const k = data?.koblinger.find((x) => x.id === id); if (k) { k.ulest = 0; k.status = r.status; data.ulest = data.koblinger.reduce((s, x) => s + (x.ulest || 0), 0); oppdaterMerke(); }
      if (ny.length || lestEndret || chat.forsteGang !== false) { chat.forsteGang = false; const ta = rot()?.querySelector('[data-nv-tekst]'); chat.utkast = ta?.value ?? chat.utkast; const fokus = document.activeElement === ta; tegn(); if (fokus) { const t2 = rot()?.querySelector('[data-nv-tekst]'); t2?.focus(); t2?.setSelectionRange(t2.value.length, t2.value.length); } }
    } catch (e) { if (/finnes ikke/.test(e.message)) { chat = null; hent(); } }
  }
  async function sendMelding(tekst) {
    if (!chat || !tekst.trim()) return; const id = chat.id;
    try { const r = await kall(`/api/nettverk/koblinger/${id}/meldinger`, { metode: 'POST', kropp: { tekst } }); if (chat?.id !== id) return; chat.meldinger.push(r.melding); chat.sist = r.melding.tid; chat.utkast = ''; const k = data?.koblinger.find((x) => x.id === id); if (k) k.siste = { tekst: r.melding.tekst, tid: r.melding.tid, fraMeg: true }; tegn(); rot()?.querySelector('[data-nv-tekst]')?.focus(); }
    catch (e) { melding(e.message, 'feil'); }
  }

  // ---------- hendelser ----------
  document.addEventListener('click', async (e) => {
    const tb = e.target.closest('[data-nv-tb]'); if (tb && rot()?.contains(tb)) { const x = innboks.find((y) => y.id === tb.dataset.nvTb); if (!x) return; if (!x.apnet) { x.apnet = Date.now(); oppdaterMerke(); } tbApen = x.id; chat = null; tegn(); rot()?.scrollIntoView?.({ block: 'start' }); return; } // åpnes i appen; serveren merker den som åpnet
    const k = e.target.closest('[data-nv]'); if (!k || !rot()?.contains(k)) return; const h = k.dataset.nv;
    try {
      if (h === 'oppdater') await hent();
      if (h === 'profil') { await minProfil(); }
      if (h === 'tb-lukk') { tbApen = null; tegn(); await hent({ stille: true }); tegn(); }
      if (h === 'se-svar') { apneTilbud(k.dataset.id); nyeSvar = nyeSvar.filter((x) => x.id !== k.dataset.id); oppdaterMerke(); setTimeout(() => hent({ stille: true }), 3000); }
      if (h === 'kv-skog' || h === 'kv-aktor') { kvRed = h === 'kv-skog' ? 'skog' : 'aktor'; kvVelger = null; tegn(); }
      if (h === 'kv-avbryt') { kvRed = null; kvVelger = null; tegn(); }
      if (h === 'kv-lagre' && kvVelger) {
        const liste = kvVelger.verdi(); if (kvRed === 'aktor' && !liste.length && erTilbudsmottaker()) { melding('Velg minst én kommune du opererer i.', 'feil'); return; }
        await lagreKommuner(liste); kvRed = null; kvVelger = null; melding('Kommunene er lagret.'); if (harRolle('skogeier')) await sokAktorer(); else tegn();
      }
      if (h === 'sok') { sok.q = rot().querySelector('[data-nv-sok]')?.value || ''; sok.rolle = rot().querySelector('[data-nv-rolle]')?.value || ''; await sokAktorer(); }
      if (h === 'be') { const r = await kall('/api/nettverk/koblinger', { metode: 'POST', kropp: { til: k.dataset.til, rolle: k.dataset.rolle } }); melding(r.status === 'aktiv' ? 'Dere er nå koblet sammen.' : 'Forespørselen er sendt. Du får beskjed når den er godtatt.'); await hent({ stille: true }); await sokAktorer(); }
      if (h === 'inviter') {
        const epost = rot().querySelector('[data-nv-inviter]')?.value.trim(); if (!epost) { melding('Skriv skogeierens e-postadresse.', 'feil'); return; }
        const rolle = rot().querySelector('[data-nv-inviter-rolle]')?.value || AKTORER.find(harRolle);
        // Serveren sender ikke e-post: tilby en ferdig e-post fra brukerens eget e-postprogram.
        const meg = innloggetBruker() || {}; const fra = [meg.navn, meg.profil?.foretak].filter(Boolean).join(', ') || 'En aktør';
        try {
          const r = await kall('/api/nettverk/koblinger', { metode: 'POST', kropp: { til: epost, rolle } });
          melding(r.status === 'aktiv' ? 'Dere er nå koblet sammen.' : 'Forespørselen er sendt til skogeieren.');
          epostForslag = r.status === 'aktiv' ? null : { til: epost, knapp: 'Gi beskjed på e-post', hint: 'Skogeieren ser forespørselen neste gang hen logger inn. Vil du gi beskjed nå?', emne: `${fra} vil koble seg til deg i SkogIQ.ai`, tekst: `Hei!\n\n${fra} (${ROLLE[rolle].entall}) har bedt om å bli koblet til deg i SkogIQ.ai. Da kan vi skrive sammen og dele planer og tilbud direkte i løsningen.\n\nLogg inn og godta forespørselen under Nettverk:\n${appAdresse()}\n\nHilsen ${meg.navn || ''}` };
        } catch (err) {
          if (err.status !== 404) throw err;
          melding('Skogeieren er ikke registrert i SkogIQ.ai ennå. Send en invitasjon på e-post.', 'feil');
          epostForslag = { til: epost, knapp: 'Inviter på e-post', hint: 'Ikke registrert ennå. Når skogeieren har registrert seg, sender du forespørselen på nytt.', emne: `Invitasjon til SkogIQ.ai fra ${fra}`, tekst: `Hei!\n\n${fra} bruker SkogIQ.ai til skogbruksplan, tiltak og samarbeid med skogeiere, og vil gjerne koble seg til deg der.\n\nRegistrer deg gratis med denne e-postadressen:\n${appAdresse('logginn.html#registrer')}\n\nHilsen ${meg.navn || ''}` };
        }
        await hent();
      }
      if (['godta', 'avsla', 'trekk'].includes(h)) { await kall(`/api/nettverk/koblinger/${k.dataset.id}`, { metode: 'PUT', kropp: { handling: h } }); melding(h === 'godta' ? 'Koblingen er godtatt – dere kan nå chatte.' : h === 'avsla' ? 'Forespørselen er avslått.' : 'Forespørselen er trukket.'); await hent(); if (h === 'godta') apneChat(k.dataset.id); }
      if (h === 'avslutt') { if (!confirm('Avslutte koblingen? Chatten stenges for begge.')) return; await kall(`/api/nettverk/koblinger/${k.dataset.id}`, { metode: 'PUT', kropp: { handling: 'avslutt' } }); chat = null; clearInterval(poll); await hent(); }
      if (h === 'chat') apneChat(k.dataset.id);
      if (h === 'tilbake') { chat = null; clearInterval(poll); await hent(); }
    } catch (err) { melding(err.message, 'feil'); }
  });
  // Svarsiden i rammen gir beskjed når tilbudet er sendt eller avslått.
  window.addEventListener('message', (e) => { if (e.origin !== location.origin || e.data?.skogiq !== 'tilbud') return; const x = innboks.find((y) => y.id === e.data.id); if (x) { if (e.data.hendelse === 'svar') x.svart = Date.now(); if (e.data.hendelse === 'avslag') x.avslatt = Date.now(); } melding(e.data.hendelse === 'avslag' ? 'Skogeieren har fått beskjed om at oppdraget ikke er aktuelt.' : 'Tilbudet er sendt. Skogeieren har fått beskjed.'); oppdaterMerke(); });
  // Endret profil (rådgiveropplysninger, kommuner, roller): hent oversikten på nytt.
  window.addEventListener('skogiq-profil', () => { if (synlig) hent({ stille: true }).then(() => { if (synlig && !chat) tegn(); }); });
  document.addEventListener('submit', (e) => { if (!e.target.matches?.('[data-nv-skjema]')) return; e.preventDefault(); const t = e.target.querySelector('[data-nv-tekst]'); sendMelding(t.value); });
  document.addEventListener('keydown', (e) => {
    if (e.target.matches?.('[data-nv-tekst]') && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMelding(e.target.value); }
    if (e.target.matches?.('[data-nv-sok]') && e.key === 'Enter') { e.preventDefault(); rot()?.querySelector('[data-nv="sok"]')?.click(); }
    if (e.target.matches?.('[data-nv-inviter]') && e.key === 'Enter') { e.preventDefault(); rot()?.querySelector('[data-nv="inviter"]')?.click(); }
  });
  document.addEventListener('input', (e) => { if (e.target.matches?.('[data-nv-tekst]')) { if (chat) chat.utkast = e.target.value; e.target.style.height = 'auto'; e.target.style.height = `${Math.min(140, e.target.scrollHeight)}px`; } });

  return {
    vis() { synlig = true; tegn(); hent({ stille: !!data }); if (!sok.liste && data && (data.roller || []).includes('skogeier')) sokAktorer(); },
    skjul() { synlig = false; clearInterval(poll); tbApen = null; },
    // Bakgrunn: henter oversikten hvert minutt for merket på fanen og varsel om nye meldinger.
    start() { if (bakgrunn) return; hent({ stille: true }); bakgrunn = setInterval(() => { if (!document.hidden) hent({ stille: true }); }, 60000); },
    data: () => data,
    hent,
    apneChat,
  };
}
