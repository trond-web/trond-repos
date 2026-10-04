// AI-assistenten: spørsmål om skogbruksplanen besvares av Claude (Anthropic API) direkte fra nettleseren.
// Planens data sendes med som grunnlag. API-nøkkelen lagres bare i denne nettleseren.
import { lagKontekst } from './ai-kontekst.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm';
const MODELL = 'claude-opus-5-5';
const NOKKEL = 'skogiq-anthropic-nokkel';

const SYSTEM = `Du er SkogIQ-assistenten, en erfaren norsk skogbruksplanlegger og skogøkonom som hjelper en skogeier med å forstå og bruke skogbruksplanen sin.

Du får planens data i <plandata>-blokker: eiendom, sammendrag, alle bestand (semikolonseparert tabell), framskriving, verdiberegning, veier, PEFC-funn, datakilder og feltregistreringer. Nyere <plandata> erstatter eldre.

Slik svarer du:
- Svar på norsk bokmål, kort og konkret. Bruk punktlister og små tabeller når det gjør svaret lettere å lese.
- Bygg svaret på plandataene. Regn gjerne (summer, snitt, andeler), og vis kort hvordan du regnet når tallene er viktige.
- Når du nevner et bestand, skriv nummeret i doble hakeparenteser, f.eks. [[1-19]] eller [[5]], slik at brukeren kan klikke på det i kartet. Bruk nøyaktig samme nummer som i tabellen.
- Skill mellom det dataene sier og dine faglige vurderinger. Si fra når data er gamle, mangler eller er modellberegnet (SR16, vekstmodeller, prisforutsetninger), og når noe bør kontrolleres i felt.
- Ta hensyn til Norsk PEFC Skogstandard (PEFC N 02:2022) og norsk skogbrukspraksis når du gir råd om hogst, foryngelse, ungskogpleie, tynning og miljøhensyn.
- Finner du ikke svaret i dataene, si det, og forklar hva som må registreres eller hentes for å kunne svare.`;

const FORSLAG = [
  'Hvilke bestand bør hogges de neste 5 årene, og hva kan det gi i netto?',
  'Hvor er det behov for ungskogpleie eller tynning?',
  'Oppsummer PEFC-avvikene og hva jeg må gjøre før neste hogst.',
  'Hva er eiendommen verdt, og hva driver verdien?',
  'Hvordan utvikler volumet seg de neste 20 årene?',
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Enkel og trygg markdown: teksten escapes først, så legges et lite sett formatering på.
export function markdownTilHtml(tekst, finnBestand = () => null) {
  const inline = (s) => esc(s)
    .replace(/\[\[([^\]]{1,20})\]\]/g, (m, nr) => { const b = finnBestand(nr.trim()); return b ? `<button type="button" class="ai-bestand" data-ai-bestand="${esc(b.id)}">${esc(nr.trim())}</button>` : `<b>${esc(nr.trim())}</b>`; })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
  const linjer = String(tekst).replace(/\r/g, '').split('\n');
  const ut = []; let liste = null; let tabell = null;
  const lukk = () => {
    if (liste) { ut.push(`<${liste.type}>${liste.rader.map((r) => `<li>${inline(r)}</li>`).join('')}</${liste.type}>`); liste = null; }
    if (tabell) {
      const [hode, ...rader] = tabell.filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r));
      const celler = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      ut.push(`<div class="tabell-wrap"><table class="tabell ai-tabell"><thead><tr>${celler(hode).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rader.map((r) => `<tr>${celler(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      tabell = null;
    }
  };
  for (const l of linjer) {
    let m;
    if (/^\s*\|.*\|\s*$/.test(l)) { if (liste) lukk(); (tabell ||= []).push(l); continue; }
    if (tabell) lukk();
    if ((m = l.match(/^\s*[-*•]\s+(.*)$/))) { if (liste?.type !== 'ul') { lukk(); liste = { type: 'ul', rader: [] }; } liste.rader.push(m[1]); continue; }
    if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))) { if (liste?.type !== 'ol') { lukk(); liste = { type: 'ol', rader: [] }; } liste.rader.push(m[1]); continue; }
    lukk();
    if ((m = l.match(/^#{1,6}\s+(.*)$/))) ut.push(`<h4>${inline(m[1])}</h4>`);
    else if (l.trim()) ut.push(`<p>${inline(l)}</p>`);
  }
  lukk();
  return ut.join('');
}

export function initAssistent({ hentPlan, hentKontekstData, visBestand, iAar = new Date().getFullYear() }) {
  const $ = (s) => document.querySelector(s);
  let sdk = null; let klient = null;
  let meldinger = []; // samtalen i API-format – bare legges til på slutten
  let sistKontekst = null; let sistPlanId = null;
  let aktiv = null; // pågående strøm

  const lesNokkel = () => { try { return localStorage.getItem(NOKKEL) || ''; } catch { return ''; } };
  const finnBestand = (nr) => hentPlan().bestand.find((b) => String(b.nr) === nr);

  function tegnOppsett() {
    const har = !!lesNokkel();
    $('#aiOppsett').hidden = har;
    $('#aiChat').hidden = !har;
  }

  function nySamtale() {
    aktiv?.abort();
    meldinger = []; sistKontekst = null; sistPlanId = hentPlan().planId;
    $('#aiLogg').innerHTML = '';
    $('#aiForslag').innerHTML = FORSLAG.map((f) => `<button type="button" class="ai-forslag">${esc(f)}</button>`).join('');
    $('#aiForslag').hidden = false;
  }

  function boble(rolle, html = '') {
    const el = document.createElement('div');
    el.className = `ai-melding ${rolle}`;
    el.innerHTML = html;
    $('#aiLogg').appendChild(el);
    el.scrollIntoView({ block: 'end', behavior: 'smooth' });
    return el;
  }

  async function lastSdk() {
    if (!sdk) sdk = await import(SDK_URL);
    const nokkel = lesNokkel();
    if (!klient || klient.apiKey !== nokkel) klient = new sdk.default({ apiKey: nokkel, dangerouslyAllowBrowser: true });
    return klient;
  }

  function feiltekst(e) {
    const A = sdk?.default;
    if (A && e instanceof A.AuthenticationError) return 'API-nøkkelen ble avvist. Sjekk at den er riktig under «Endre nøkkel».';
    if (A && e instanceof A.PermissionDeniedError) return 'Nøkkelen har ikke tilgang til modellen.';
    if (A && e instanceof A.RateLimitError) return 'For mange forespørsler akkurat nå. Vent litt og prøv igjen.';
    if (A && e instanceof A.APIConnectionError) return 'Fikk ikke kontakt med Anthropic. Sjekk nettforbindelsen.';
    if (A && e instanceof A.APIError) return `Feil fra Anthropic (${e.status ?? 'ukjent'}): ${e.message}`;
    return `Noe gikk galt: ${e.message || e}`;
  }

  async function send(sporsmal) {
    sporsmal = sporsmal.trim();
    if (!sporsmal || aktiv) return;
    const S = hentPlan();
    if (!S.bestand.length) { boble('feil', '<p>Planen har ingen bestand ennå. Lag eller åpne en skogbruksplan først.</p>'); return; }
    if (S.planId !== sistPlanId) nySamtale();
    $('#aiForslag').hidden = true;
    boble('bruker', `<p>${esc(sporsmal).replace(/\n/g, '<br>')}</p>`);
    const svarEl = boble('assistent', '<p class="ai-tenker">Tenker …</p>');

    const kontekst = lagKontekst(S, { iAar, ...hentKontekstData() });
    const lengde = meldinger.length;
    if (!meldinger.length) {
      meldinger.push({ role: 'user', content: [{ type: 'text', text: `<plandata>\n${kontekst}\n</plandata>` }, { type: 'text', text: sporsmal }] });
    } else {
      meldinger.push({ role: 'user', content: sporsmal });
      // Endrede data legges til som en systemmelding på slutten, så tidligere del av samtalen er uendret.
      if (kontekst !== sistKontekst) meldinger.push({ role: 'system', content: `Plandataene er endret siden forrige spørsmål. Oppdaterte plandata:\n<plandata>\n${kontekst}\n</plandata>` });
    }
    const angre = () => { meldinger.length = lengde; };
    $('#aiSend').hidden = true; $('#aiStopp').hidden = false;
    let tekst = '';
    try {
      const c = await lastSdk();
      aktiv = c.beta.messages.stream({
        model: MODELL,
        max_tokens: 16000,
        output_config: { effort: 'medium' },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        cache_control: { type: 'ephemeral' },
        system: SYSTEM,
        messages: meldinger,
      });
      for await (const ev of aktiv) {
        if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
          tekst += ev.delta.text;
          svarEl.innerHTML = markdownTilHtml(tekst, finnBestand);
        }
      }
      const svar = await aktiv.finalMessage();
      if (svar.stop_reason === 'refusal') {
        angre();
        svarEl.className = 'ai-melding feil';
        svarEl.innerHTML = '<p>Assistenten kunne ikke svare på dette spørsmålet. Prøv å formulere det annerledes.</p>';
      } else {
        meldinger.push({ role: 'assistant', content: svar.content });
        sistKontekst = kontekst;
        const ferdig = svar.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
        svarEl.innerHTML = markdownTilHtml(ferdig || tekst, finnBestand) || '<p class="hint">(tomt svar)</p>';
        if (svar.stop_reason === 'max_tokens') svarEl.insertAdjacentHTML('beforeend', '<p class="hint">Svaret ble avkortet fordi det ble for langt.</p>');
      }
    } catch (e) {
      angre();
      const avbrutt = e?.name === 'APIUserAbortError' || /abort/i.test(e?.message || '');
      svarEl.className = `ai-melding ${avbrutt ? 'assistent' : 'feil'}`;
      svarEl.innerHTML = avbrutt ? `${markdownTilHtml(tekst, finnBestand)}<p class="hint">Avbrutt.</p>` : `<p>${esc(feiltekst(e))}</p>`;
    } finally {
      aktiv = null;
      $('#aiSend').hidden = false; $('#aiStopp').hidden = true;
      svarEl.scrollIntoView({ block: 'nearest' });
    }
  }

  // Hendelser
  $('#aiNokkelSkjema').addEventListener('submit', (e) => {
    e.preventDefault();
    const n = $('#aiNokkel').value.trim();
    if (!/^sk-ant-/.test(n)) { $('#aiNokkelStatus').textContent = 'Nøkkelen skal starte med «sk-ant-».'; return; }
    try { localStorage.setItem(NOKKEL, n); } catch { $('#aiNokkelStatus').textContent = 'Nettleseren tillater ikke lagring. Nøkkelen brukes bare i denne økten.'; }
    klient = null; $('#aiNokkel').value = ''; $('#aiNokkelStatus').textContent = '';
    tegnOppsett(); nySamtale(); $('#aiInput').focus();
  });
  $('#aiEndreNokkel').addEventListener('click', () => { try { localStorage.removeItem(NOKKEL); } catch { /* valgfritt */ } klient = null; tegnOppsett(); });
  $('#aiNy').addEventListener('click', nySamtale);
  $('#aiStopp').addEventListener('click', () => aktiv?.abort());
  $('#aiSkjema').addEventListener('submit', (e) => { e.preventDefault(); const v = $('#aiInput').value; $('#aiInput').value = ''; send(v); });
  $('#aiInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#aiSkjema').requestSubmit(); } });
  $('#aiForslag').addEventListener('click', (e) => { const k = e.target.closest('.ai-forslag'); if (k) send(k.textContent); });
  $('#aiLogg').addEventListener('click', (e) => { const k = e.target.closest('[data-ai-bestand]'); if (k) visBestand(k.dataset.aiBestand); });

  tegnOppsett(); nySamtale();
  return { vis: () => { tegnOppsett(); if (hentPlan().planId !== sistPlanId) nySamtale(); setTimeout(() => $('#aiInput')?.focus(), 50); }, sporr: send };
}
