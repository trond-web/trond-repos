// Skifteplan › Maskin: data til og fra traktoren (John Deere Gen4/G5 og Operations Center, ISOBUS/ISOXML).
//   Til traktoren:  skiftegrenser, kjørespor (AB-linjer) og gjødselkart – variabelt når skiftet har avlingskart.
//                   Lastes ned som ZIP til USB-pinne, eller sendes trådløst til Operations Center (Filer).
//   Fra traktoren:  utført gjødsling, sprøyting og avling fra Shapefile/ISOXML, eller hentet fra Operations Center.
//                   Fylles inn i gjødseljournal, sprøytejournal og avling per skifte (KSL 1.1.3, 1.2.3 og 1.5.4).
//   Økonomi:        avvik fra plan, overlapp, variabel gjødsling og avling i kroner.
import {
  KILDER, ENHETER, STANDARD_PRISER, planlagteGjodslinger, resept, eksportPakke, lagZip, lesMaskinfiler, forslag, brukImport,
  presisjonsOkonomi, abLinje,
} from './maskindata.js';
import { API } from './plan-synk.js';
import { fmt } from './charts.js';
import { VERSJON } from './versjon.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kr = (v) => `${Math.round(v).toLocaleString('nb-NO')} kr`;
const TYPER = { gjodsling: 'Gjødsling (mineral)', husdyr: 'Husdyrgjødsel', sproyting: 'Sprøyting', hosting: 'Høsting (avling)' };
const LS_NOKKEL = 'skogiq-jd-nokkel';

function jdNokkel() {
  try {
    let n = localStorage.getItem(LS_NOKKEL);
    if (!/^[a-f0-9]{32}$/.test(n || '')) { n = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem(LS_NOKKEL, n); }
    return n;
  } catch { return null; }
}

export function lagMaskinUi({ kart, hentPlan, SP, aar, lagre, melding, nyId }) {
  let valgtGj = ''; let grenser = true; let kjorespor = true; let isoxml = true;
  let innlest = []; // [{ op, type, enhet }]
  let jd = { status: null, org: '', orgs: [], ops: [], henter: '' };
  let arbeider = '';
  const abLag = L.layerGroup();

  // ---------- John Deere Operations Center (via serveren) ----------
  const jdUrl = (sti, q = {}) => `${API}/api/jd/${sti}?${new URLSearchParams({ n: jdNokkel() || '', ...q })}`;
  async function jdJson(sti, q, o) { const r = await fetch(jdUrl(sti, q), o); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.feil || `Serveren svarte ${r.status}`); return d; }
  async function jdStatus() {
    try { jd.status = await jdJson('status'); } catch { jd.status = { konfigurert: false, tilkoblet: false, frakoblet: true }; }
    if (jd.status.tilkoblet && !jd.orgs.length) { try { jd.orgs = await jdJson('organisasjoner'); jd.org = jd.org || jd.orgs.find((o) => o.tilgang)?.id || jd.orgs[0]?.id || ''; } catch (e) { melding(e.message); } }
  }
  function kobleTil() { location.href = jdUrl('logginn', { tilbake: location.href.replace(/[?&]jd=tilkoblet/, '') }); }

  // ---------- til traktoren ----------
  function pakke() {
    const S = hentPlan(); const a = aar(); const valg = planlagteGjodslinger(SP(), a).find((v) => v.nokkel === valgtGj) || null;
    return { ...eksportPakke(S, a, { valg, grenser, kjorespor, isoxml, versjon: VERSJON }), valg };
  }
  const zipNavn = () => `SkogIQ_${String(hentPlan().eiendom?.navn || 'gard').replace(/[^\wæøåÆØÅ-]+/g, '_')}_${aar()}.zip`;
  function lastNedZip() {
    const { filer } = pakke(); if (filer.length <= 1) { melding('Skifteplanen har ingen skifter med kartgrense ennå.'); return; }
    const url = URL.createObjectURL(new Blob([lagZip(filer)], { type: 'application/zip' }));
    const a = document.createElement('a'); a.href = url; a.download = zipNavn(); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
    melding('ZIP-fila er lastet ned. Pakk den ut på rota av en USB-pinne (se LES_MEG.txt).');
  }
  async function sendTilJd() {
    if (!jd.org) { melding('Velg organisasjon i Operations Center først.'); return; }
    const { filer } = pakke(); arbeider = 'Sender til John Deere Operations Center …'; tegnPa();
    try {
      const d = await jdJson('fil', { org: jd.org, navn: zipNavn() }, { method: 'POST', headers: { 'Content-Type': 'application/zip' }, body: lagZip(filer) });
      SP().maskinSendt = [...(SP().maskinSendt || []), { dato: new Date().toISOString().slice(0, 10), fil: zipNavn(), id: d.id, org: jd.org }]; lagre(false);
      melding('Sendt til Filer i Operations Center. Send fila til skjermen med Data Sync / «Send til maskin».');
    } catch (e) { melding(e.message); } finally { arbeider = ''; tegnPa(); }
  }
  function visKjorespor() {
    abLag.clearLayers(); if (!kart.hasLayer(abLag)) abLag.addTo(kart);
    for (const sk of SP().skifter.filter((s) => s.geometri)) { const l = abLinje(sk.geometri); if (l) L.polyline([[l.a[1], l.a[0]], [l.b[1], l.b[0]]], { color: '#1565c0', weight: 3, dashArray: '8 6' }).bindTooltip(`AB skifte ${esc(sk.nr)} · ${l.retning}° · ${l.lengde} m`).addTo(abLag); }
  }

  // ---------- fra traktoren ----------
  async function lesFiler(liste) {
    arbeider = 'Leser maskindata …'; tegnPa();
    try {
      const filer = await Promise.all([...liste].map(async (f) => ({ navn: f.name, data: new Uint8Array(await f.arrayBuffer()) })));
      const ops = await lesMaskinfiler(filer);
      for (const op of ops) { if (op.feil) melding(`${op.fil}: ${op.feil}`); else innlest.push({ op, type: op.type, enhet: op.enhet }); }
    } catch (e) { melding(e.message); } finally { arbeider = ''; tegnPa(); }
  }
  async function hentJdOps() {
    const S = hentPlan(); const a = aar(); jd.ops = []; arbeider = 'Henter operasjoner fra Operations Center …'; tegnPa();
    try {
      const felt = await jdJson('skifter', { org: jd.org });
      for (const f of felt) for (const o of await jdJson('operasjoner', { org: jd.org, felt: f.id, aar: a })) jd.ops.push({ ...o, felt: f.navn });
      if (!jd.ops.length) melding(`Ingen operasjoner i ${a} i Operations Center for ${felt.length} skifter.`);
    } catch (e) { melding(e.message); } finally { arbeider = ''; tegnPa(); }
    return S;
  }
  async function hentJdOp(id) {
    arbeider = 'Henter Shapefile fra Operations Center …'; tegnPa();
    try {
      for (let i = 0; i < 12; i++) {
        const r = await fetch(jdUrl('operasjon', { id }));
        if (r.status === 202) { await new Promise((ok) => setTimeout(ok, 5000)); continue; }
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.feil || `Serveren svarte ${r.status}`); }
        const ops = await lesMaskinfiler([{ navn: `jd-${id}.zip`, data: new Uint8Array(await r.arrayBuffer()) }]);
        for (const op of ops) if (!op.feil) innlest.push({ op: { ...op, kilde: 'John Deere', fil: `Operations Center ${id}` }, type: op.type, enhet: op.enhet });
        return;
      }
      throw new Error('John Deere bruker lang tid på å lage fila – prøv igjen om et minutt.');
    } catch (e) { melding(e.message); } finally { arbeider = ''; tegnPa(); }
  }

  // ---------- HTML ----------
  function tilHtml() {
    const p = SP(); const a = aar(); const valg = planlagteGjodslinger(p, a); const med = p.skifter.filter((s) => s.geometri).length;
    const v = valg.find((x) => x.nokkel === valgtGj);
    const rx = v ? v.skifter.map(({ sk, g }) => ({ sk, r: resept(sk, a, g) })) : [];
    const rader = rx.map(({ sk, r }) => `<div class="md-rad"><b>Skifte ${esc(sk.nr)}</b><span>${fmt(sk.areal, 1)} daa · plan ${fmt(r.planlagt, 0)} kg/daa · ${fmt(r.totalt, 0)} kg${r.variabel ? ` (flat ${fmt(r.flatTotalt, 0)})` : ''}</span>
      <small>${r.variabel ? r.soner.map((z) => `<span class="md-sone" style="--farge:${z.farge}">${esc(z.navn.replace(' avling', ''))} ${z.mengde} kg/daa · ${Math.round(z.andel * 100)} %</span>`).join(' ') : 'Flat mengde – skiftet har ikke avlingskart ennå'}</small></div>`).join('');
    return `<div class="kort"><div class="detalj-topp"><h3>🚜 Til traktoren</h3></div>
      <p class="hint">Skiftegrenser, kjørespor og gjødselkart for John Deere Gen4/G5 (og andre ISOBUS-terminaler via ISOXML). ${med} av ${p.skifter.length} skifter har kartgrense.</p>
      <label>Gjødselkart (Rx) for <select data-md="gj"><option value="">Ingen – bare grenser og kjørespor</option>${valg.map((x) => `<option value="${esc(x.nokkel)}" ${x.nokkel === valgtGj ? 'selected' : ''}>${esc(x.navn)}${x.dato ? ` · ${esc(x.dato)}` : ''} · ${x.skifter.length} skifter</option>`).join('')}</select></label>
      ${valg.length ? '' : `<p class="hint">Ingen planlagte gjødslinger i ${a}. Lag gjødslingsplanen under «Gjødsling» først.</p>`}
      ${rx.length ? `<div class="md-liste">${rader}</div>
        <p class="hint">Variabel mengde: skiftet deles i soner etter avlingskartet fra siste høsting. N justeres etter forventet avling i sonen med Gjødslingshåndbokas korreksjon (kg N per 100 kg avling), maks ±25 %.</p>` : ''}
      <div class="knapperad"><label><input type="checkbox" data-md="grenser" ${grenser ? 'checked' : ''}> Skiftegrenser</label><label><input type="checkbox" data-md="kjorespor" ${kjorespor ? 'checked' : ''}> Kjørespor (AB-linjer)</label><label><input type="checkbox" data-md="isoxml" ${isoxml ? 'checked' : ''}> ISOXML (TASKDATA)</label></div>
      <div class="knapperad"><button type="button" class="knapp primar" data-md="zip" ${med ? '' : 'disabled'}>⬇ Last ned til USB (ZIP)</button><button type="button" class="knapp" data-md="send" ${jd.status?.tilkoblet && jd.org && med ? '' : 'disabled'} title="${jd.status?.tilkoblet ? '' : 'Koble til Operations Center nedenfor'}">☁ Send til Operations Center</button><button type="button" class="knapp liten" data-md="ab">Vis kjørespor i kartet</button></div>
      <details><summary>Slik leser du dataene inn i traktoren</summary><ul class="sp-regler">
        <li><b>USB (Gen4/G5):</b> pakk ut ZIP-fila på rota av en tom USB-pinne (FAT32), slik at mappa <code>Rx</code> ligger øverst. Data Manager › Import Data › USB. For gjødselkart velger du kolonnen <code>RATE_KGHA</code> og enheten kg/ha.</li>
        <li><b>Trådløst:</b> «Send til Operations Center» legger fila under Filer i organisasjonen. Derfra sendes den til skjermen med Data Sync eller «Send til maskin» (krever JDLink).</li>
        <li><b>ISOBUS-terminaler:</b> mappa <code>TASKDATA</code> er ISOXML (ISO 11783-10) med skifter, AB-linjer og oppgaver med behandlingssoner.</li></ul></details></div>`;
  }
  function fraHtml() {
    const S = hentPlan();
    const kort = innlest.map((x, i) => {
      const f = forslag(S, x.op, { enhet: x.enhet, type: x.type });
      return `<div class="kort md-op"><div class="detalj-topp"><h4>${esc(x.op.fil)}</h4><span class="hint">${esc(x.op.kilde)} · ${x.op.antall} punkter</span></div>
        <div class="skjema to-kol"><label>Type<select data-md-op="type" data-i="${i}">${Object.entries(TYPER).map(([k, t]) => `<option value="${k}" ${k === x.type ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>Enhet i fila<select data-md-op="enhet" data-i="${i}">${Object.keys(ENHETER).map((k) => `<option ${k === x.enhet ? 'selected' : ''}>${k}</option>`).join('')}</select></label></div>
        <p class="hint">${esc(x.op.produkt || 'Uten produktnavn')} · ${esc(x.op.dato || 'uten dato')}${x.op.tilDato && x.op.tilDato !== x.op.dato ? `–${esc(x.op.tilDato)}` : ''}${f.utenfor ? ` · ${f.utenfor} punkter utenfor skiftene` : ''}</p>
        ${f.endringer.length ? `<div class="md-liste">${f.endringer.map((e) => `<div class="md-rad"><b>Skifte ${esc(e.nr)}</b><span>${fmt(e.snitt, e.snitt < 10 ? 2 : 0)} ${esc(e.enhet)} · dekning ${Math.round(e.dekning * 100)} %${e.overlapp ? ` <span class="sp-gammel">(${e.overlapp} % overlapp)</span>` : ''}</span><small>${esc(e.tekst)}</small></div>`).join('')}</div>` : '<p class="hint">Ingen av punktene ligger i skiftene i skifteplanen.</p>'}
        <div class="knapperad">${f.alleredeInne ? '<span class="hint">✓ Allerede lest inn</span>' : `<button type="button" class="knapp primar" data-md-op="bruk" data-i="${i}" ${f.endringer.length ? '' : 'disabled'}>Legg inn i skifteplanen</button>`}<button type="button" class="knapp liten" data-md-op="fjern" data-i="${i}">Fjern</button></div></div>`;
    }).join('');
    const jdOps = jd.ops.length ? `<div class="md-liste">${jd.ops.map((o) => `<div class="md-rad"><b>${esc(String(o.start || '').slice(0, 10))} · ${esc(o.felt)}</b><span>${esc(o.type)} · ${esc(o.produkter.join(', ') || o.avling || '')}</span><small><button type="button" class="knapp liten" data-md-jdop="${esc(o.id)}">Hent og les inn</button></small></div>`).join('')}</div>` : '';
    return `<div class="kort"><div class="detalj-topp"><h3>📥 Fra traktoren</h3></div>
      <p class="hint">Utført gjødsling, sprøyting og avling fra traktoren fyller ut gjødseljournal, sprøytejournal og avling per skifte. Planlagte gjødslinger med samme produkt merkes utført. Avlingen gir avlingskart som brukes i neste års gjødselkart.</p>
      <label class="knapp">📂 Velg filer (ZIP, Shapefile eller ISOXML)<input type="file" data-md="filer" multiple accept=".zip,.shp,.dbf,.prj,.shx,.xml,.XML,.bin,.BIN" hidden></label>
      ${jd.status?.tilkoblet && jd.org ? `<div class="knapperad"><button type="button" class="knapp" data-md="jd-ops">☁ Hent operasjoner ${aar()} fra Operations Center</button></div>${jdOps}` : ''}
      <details><summary>Slik henter du data ut av traktoren</summary><ul class="sp-regler">
        <li><b>Operations Center:</b> Field Analyzer / Data › velg operasjon › Eksporter › Shapefile (metrisk). Les inn ZIP-fila her, eller koble til Operations Center nedenfor og hent direkte.</li>
        <li><b>ISOBUS:</b> eksporter oppgaven (TASKDATA med TLG-filer) fra terminalen til USB og velg alle filene i mappa.</li>
        <li>Sprøyting fra maskinen mangler skadegjører, begrunnelse og karenstid – fyll ut i sprøytejournalen etterpå (Plantevern).</li></ul></details></div>${kort}`;
  }
  function jdHtml() {
    const s = jd.status;
    const innhold = !s ? '<p class="hint">Sjekker tilkoblingen …</p>'
      : s.frakoblet ? '<p class="hint">Får ikke kontakt med SkogIQ-serveren.</p>'
        : !s.konfigurert ? `<p class="hint">John Deere-tilkoblingen er ikke satt opp på serveren ennå. Det krever en godkjent app hos John Deere:</p><ol class="sp-regler"><li>Registrer en applikasjon på <a href="${KILDER.jdApi.url}" target="_blank" rel="noopener">developer.deere.com</a> og be om tilgang til Organizations, Fields, Field Operations og Files.</li><li>Legg inn Redirect URI <code>https://skogiq-production.up.railway.app/api/jd/callback</code>.</li><li>Sett <code>JD_CLIENT_ID</code>, <code>JD_CLIENT_SECRET</code> og <code>JD_REDIRECT</code> på serveren (og <code>JD_API</code> når appen er godkjent for produksjon).</li></ol><p class="hint">Til da fungerer alt med filer: last ned ZIP til USB, og les inn eksporten fra Operations Center.</p>`
          : !s.tilkoblet ? `<p class="hint">Koble SkogIQ til John Deere-kontoen din for å sende filer trådløst og hente utførte operasjoner direkte.${s.miljo === 'sandkasse' ? ' (Sandkasse: testdata hos John Deere.)' : ''}</p><div class="knapperad"><button type="button" class="knapp primar" data-md="jd-koble">Koble til John Deere</button></div>`
            : `<label>Organisasjon <select data-md="jd-org">${jd.orgs.map((o) => `<option value="${esc(o.id)}" ${o.id === jd.org ? 'selected' : ''}>${esc(o.navn)}${o.tilgang ? '' : ' (mangler tilgang)'}</option>`).join('')}</select></label>
              <div class="knapperad"><span class="hint">✓ Tilkoblet${s.miljo === 'sandkasse' ? ' (sandkasse)' : ''}</span><button type="button" class="knapp liten" data-md="jd-koble">Gi tilgang på nytt</button><button type="button" class="knapp liten" data-md="jd-ut">Koble fra</button></div>`;
    return `<div class="kort"><div class="detalj-topp"><h3>☁ John Deere Operations Center</h3></div>${innhold}</div>`;
  }
  function okonomiHtml() {
    const p = SP(); const a = aar(); const pr = { ...STANDARD_PRISER, ...(p.maskinPriser || {}) }; const o = presisjonsOkonomi(hentPlan(), a, pr);
    const linje = (t, v, forklaring) => `<div class="md-rad"><b>${t}</b><span>${v}</span><small>${forklaring}</small></div>`;
    const tom = !o.avvik.length && !o.overlapp.length && !o.vra.length && !o.avling.length;
    return `<div class="kort"><div class="detalj-topp"><h3>💰 Økonomi ${a}</h3></div>
      <div class="skjema to-kol"><label>Gjødsel kr/kg<input type="number" step="0.1" data-md-pris="gjodsel" value="${pr.gjodsel}"></label><label>Korn kr/kg<input type="number" step="0.1" data-md-pris="korn" value="${pr.korn}"></label><label>Sprøytemiddel kr/l<input type="number" step="10" data-md-pris="sproytemiddel" value="${pr.sproytemiddel}"></label></div>
      ${tom ? '<p class="hint">Les inn utført gjødsling og avling, eller lag avlingskart, så regnes gevinsten ut her.</p>' : `<div class="md-liste">
        ${o.vra.length ? linje('Variabel gjødsling', `${fmt(o.sum.vraFlyttetKg, 0)} kg flyttet`, `fra lav- til høyavlingssoner på ${o.vra.length} skifter${o.sum.vraSpartKr ? ` · ${kr(o.sum.vraSpartKr)} ${o.sum.vraSpartKr > 0 ? 'spart' : 'mer'} gjødsel` : ''}`) : ''}
        ${o.avvik.length ? linje('Avvik fra gjødslingsplanen', kr(o.sum.avvikKr), `${o.avvik.map((x) => `skifte ${esc(x.nr)}: ${x.kg > 0 ? '+' : ''}${fmt(x.kg, 0)} kg`).join(', ')} (positivt = mer enn planlagt)`) : ''}
        ${o.overlapp.length ? linje('Overlapp', kr(o.sum.overlappKr), `${o.overlapp.map((x) => `skifte ${esc(x.nr)} ${x.pst} %`).join(', ')} – seksjonskontroll og AB-linjer reduserer dette`) : ''}
        ${o.avling.length ? linje('Avling mot forventet', kr(o.sum.avlingKr), o.avling.map((x) => `skifte ${esc(x.nr)}: ${fmt(x.registrert, 0)} mot ${fmt(x.forventet, 0)} kg/daa`).join(', ')) : ''}
        ${linje('Journalføring fra maskin', `${o.journal}`, 'skifteregistreringer i gjødsel- og sprøytejournalen uten manuell føring (KSL 1.2.3 og 1.5.4)')}
      </div>`}
      <p class="hint">Prisene er anslag – endre dem til dine egne. Variabel gjødsling bruker samme N-korreksjon for avling som gjødslingsplanen.</p></div>`;
  }
  function loggHtml() {
    const l = (SP().maskindata || []).slice().reverse(); if (!l.length) return '';
    return `<div class="kort"><h3>Innleste maskindata</h3><ul class="sp-regler">${l.map((m) => `<li>${esc(m.dato)} · ${esc(TYPER[m.type] || m.type)} · ${esc(m.produkt || '')} · ${m.skifter.length} skifter <span class="hint">(${esc(m.kilde)}, ${esc(m.fil)}, lest inn ${esc(m.importert)})</span></li>`).join('')}</ul></div>`;
  }
  let tegnPa = () => {};
  return {
    abLag,
    html(tegn) {
      tegnPa = tegn; if (!jd.status) jdStatus().then(tegn);
      return `${arbeider ? `<div class="sp-arbeider">${esc(arbeider)}</div>` : ''}${tilHtml()}${fraHtml()}${jdHtml()}${okonomiHtml()}${loggHtml()}`;
    },
    // Hendelser fra panelet. Gir true når hendelsen er håndtert.
    async klikk(e) {
      const op = e.target.closest('[data-md-op]');
      if (op && e.type === 'click' && op.tagName === 'BUTTON') {
        const i = Number(op.dataset.i); const x = innlest[i]; if (!x) return true;
        if (op.dataset.mdOp === 'fjern') innlest.splice(i, 1);
        if (op.dataset.mdOp === 'bruk') {
          const r = brukImport(hentPlan(), x.op, { enhet: x.enhet, type: x.type, nyId, utforer: SP().sisteUtforer || '' });
          melding(r.antall ? `${TYPER[x.type]} lagt inn for ${r.antall} skifter${x.type === 'sproyting' ? ' – fyll ut skadegjører og karenstid i sprøytejournalen' : ''}.` : 'Ingenting å legge inn.');
          lagre(false); return true;
        }
        tegnPa(); return true;
      }
      const jo = e.target.closest('[data-md-jdop]'); if (jo) { await hentJdOp(jo.dataset.mdJdop); return true; }
      const k = e.target.closest('[data-md]')?.dataset.md; if (!k || e.target.matches('input,select')) return false;
      if (k === 'zip') lastNedZip();
      if (k === 'send') await sendTilJd();
      if (k === 'ab') visKjorespor();
      if (k === 'jd-koble') kobleTil();
      if (k === 'jd-ut') { await jdJson('loggut', {}, { method: 'POST' }).catch(() => null); jd = { status: null, org: '', orgs: [], ops: [], henter: '' }; await jdStatus(); tegnPa(); }
      if (k === 'jd-ops') await hentJdOps();
      return true;
    },
    endring(e) {
      const t = e.target;
      if (t.matches('[data-md="filer"]')) { if (t.files?.length) lesFiler(t.files); t.value = ''; return true; }
      if (t.matches('[data-md="gj"]')) { valgtGj = t.value; tegnPa(); return true; }
      if (t.matches('[data-md="grenser"]')) { grenser = t.checked; return true; }
      if (t.matches('[data-md="kjorespor"]')) { kjorespor = t.checked; return true; }
      if (t.matches('[data-md="isoxml"]')) { isoxml = t.checked; return true; }
      if (t.matches('[data-md="jd-org"]')) { jd.org = t.value; jd.ops = []; tegnPa(); return true; }
      if (t.matches('[data-md-op]')) { const x = innlest[Number(t.dataset.i)]; if (x) x[t.dataset.mdOp] = t.value; tegnPa(); return true; }
      if (t.matches('[data-md-pris]')) { const p = SP(); p.maskinPriser = { ...(p.maskinPriser || {}), [t.dataset.mdPris]: Number(t.value) || 0 }; lagre(false); return true; }
      return false;
    },
  };
}
