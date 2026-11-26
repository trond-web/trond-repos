// Oppdrag › Utfører: send oppdraget (med hele planen) til en entreprenør i Nettverk, følg framdriften, og ta
// rapporten fra SkogIQ Entreprenør inn i planen. Logikken: feltoppdrag.js; serveren: /api/feltoppdrag.
import { API } from './plan-synk.js';
import { hentNettverksmottakere } from './tilbud-nettverk.js';
import * as FO from './feltoppdrag.js';
import { typeFor, linjer } from './oppdrag.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v, d = 0) => (v == null ? '–' : Number(v).toLocaleString('nb-NO', { maximumFractionDigits: d, minimumFractionDigits: d }));
const datoNb = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function lagFeltoppdragUi({ hentPlan, endret, melding, settUtfort }) {
  const S = () => hentPlan();
  let entreprenorer = null; let henter = false; const hentet = new Map(); // oppdrag-id → { d, tid }
  async function kall(sti, { metode = 'GET', kropp } = {}) {
    const r = await fetch(`${API}${sti}`, { method: metode, headers: kropp ? { 'Content-Type': 'application/json' } : {}, credentials: 'same-origin', body: kropp ? JSON.stringify(kropp) : undefined, cache: 'no-store' });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(j.feil || `Serveren svarte ${r.status}`), { status: r.status }); return j;
  }
  const planTilSending = () => { const { synk, hprAnalyser, ...p } = JSON.parse(JSON.stringify(S())); return p; };
  async function lastEntreprenorer(tegn) { if (entreprenorer || henter) return; henter = true; try { entreprenorer = (await hentNettverksmottakere({ maksAlder: 0 })).filter((n) => n.rolle === 'entreprenor'); } catch { entreprenorer = []; } henter = false; tegn(); }
  async function hentStatus(o, tegn, { stille = true } = {}) {
    try { const d = await kall(`/api/feltoppdrag/${o.feltoppdrag.id}`); hentet.set(o.id, { d, tid: Date.now() }); if (o.feltoppdrag.status !== d.status) { o.feltoppdrag.status = d.status; endret({ kart: false, bare: 'oppdrag' }); } tegn(); }
    catch (e) { if (!stille) melding(e.message); }
  }

  function html(o, tegn) {
    const ot = typeFor(o.type); const fo = o.feltoppdrag; const st = typeFor(o.type).sjekk || []; const sjekket = st.filter((k) => o.sjekk?.[k.id]).length;
    if (!FO.STOTTEDE.includes(o.type)) return `<div class="fo"><h4 class="undertittel">📲 SkogIQ Entreprenør</h4><p class="hint">Feltløsningen for entreprenører støtter hogst, tynning og skogkultur. ${esc(ot.kort)} kommer senere.</p></div>`;
    if (!fo || fo.status === 'trukket') {
      if (!entreprenorer) setTimeout(() => lastEntreprenorer(tegn), 0);
      return `<div class="fo"><h4 class="undertittel">📲 Send til entreprenørens feltløsning</h4>
        <p class="hint">Entreprenøren får oppdraget med hele planen, kartet, hensyn og driftsveg i SkogIQ Entreprenør på mobilen, og rapporterer framdrift, miljøsjekk, avvik med bilde og ferdigmelding med signatur tilbake hit – uten skjema.</p>
        ${sjekket < st.length ? `<p class="sf-varsel">⚠ Miljøsjekken er ikke fullført på web (${sjekket} av ${st.length} punkter i Sjekkliste-fanen). Entreprenøren ser hvilke punkter du har bekreftet.</p>` : `<p class="hint">✓ Miljøsjekken på web er fullført (${st.length} punkter).</p>`}
        ${entreprenorer == null ? '<p class="hint">Henter entreprenørene dine …</p>' : entreprenorer.length ? `<div class="knapperad"><select data-fo-til aria-label="Entreprenør">${entreprenorer.map((n) => `<option value="${esc(n.bruker)}">${esc(n.foretak ? `${n.foretak} (${n.navn})` : n.navn)}</option>`).join('')}</select><button type="button" class="knapp primar" data-fo="send">📲 Send oppdraget</button></div>` : '<p class="hint">Du er ikke koblet til noen entreprenører i Nettverk ennå. Finn entreprenøren under Nettverk og be om kobling – da kan du sende oppdraget hit.</p>'}
      </div>`;
    }
    const h = hentet.get(o.id); if (!h && !henter) { henter = true; setTimeout(() => hentStatus(o, tegn).finally(() => { henter = false; }), 0); }
    const d = h?.d; const r = d ? FO.sikreRapport(d.plan, d.oppdrag, d.rapport) : null; const f = d ? FO.framdrift(S(), o, r) : null; const m = FO.MENGDE[o.type];
    const pille = (s) => `<span class="pille" style="--farge:${FO.STATUS[s]?.farge || '#888'}">${esc(FO.STATUS[s]?.navn || s)}</span>`;
    return `<div class="fo"><div class="detalj-topp"><h4 class="undertittel" style="margin:0">📲 SkogIQ Entreprenør</h4>${pille(d?.status || fo.status)}</div>
      <p class="hint">Sendt til <b>${esc(fo.utforerNavn)}</b> ${esc(datoNb(fo.sendt))}${d?.mottatt ? ` · åpnet ${esc(datoNb(new Date(d.mottatt).toISOString()))}` : ' · ikke åpnet ennå'}.</p>
      ${f ? `<div class="sf-tall hs-tall"><div><b>${f.ferdig} / ${f.totalt}</b><span>bestand ferdig</span></div><div><b>${fmt(f.areal, 1)}</b><span>daa utført</span></div>${m ? `<div><b>${fmt(f.mengde)}</b><span>${esc(m.enhet)} ${esc(m.navn.toLowerCase())}</span></div>` : ''}<div><b>${r.avvik.length}</b><span>avvik</span></div><div><b>${Object.keys(r.miljo).length} / ${(typeFor(o.type).sjekk || []).length}</b><span>miljøpunkter sjekket i felt</span></div></div>` : '<p class="hint">Henter status …</p>'}
      ${r ? `<details class="ekstra" ${r.slutt ? 'open' : ''}><summary>Rapporten fra entreprenøren</summary>
        <div class="tabell"><table class="sf-tabell"><thead><tr><th>Bestand</th><th>Status</th><th>Ferdig</th><th class="t">Areal daa</th>${m ? `<th class="t">${esc(m.navn)}</th>` : ''}<th>Merknad</th></tr></thead><tbody>
          ${linjer(S(), o).map(({ bestand: b, tiltak: t }) => { const l = r.linjer[t.id] || {}; return `<tr><td>${esc(b.nr)}</td><td>${esc({ ikke: 'Ikke startet', pagar: 'Pågår', ferdig: 'Ferdig' }[l.status] || '–')}</td><td>${esc(datoNb(l.ferdig))}</td><td class="t">${l.areal != null ? fmt(l.areal, 1) : ''}</td>${m ? `<td class="t">${l.mengde != null ? fmt(l.mengde) : ''}</td>` : ''}<td>${esc(l.merknad || '')}</td></tr>`; }).join('')}
        </tbody></table></div>
        ${FO.miljoPunkter(o, r).some((p) => p.felt?.svar === 'avvik') ? `<h5>Miljøsjekk – avvik</h5><ul class="sf-liste">${FO.miljoPunkter(o, r).filter((p) => p.felt?.svar === 'avvik').map((p) => `<li><b>${esc(p.tekst)}</b>: ${esc(p.felt.merknad || '')}</li>`).join('')}</ul>` : ''}
        ${r.avvik.length ? `<h5>Avvik (${r.avvik.length})</h5><div class="fo-avvik">${r.avvik.map((a) => `<div class="fo-avvik-rad">${(a.bilder || []).slice(0, 3).map((b) => `<a href="${b}" target="_blank" rel="noopener"><img src="${b}" alt="Bilde av avviket"></a>`).join('')}<div><b>${esc(FO.AVVIK[a.type]?.ikon || '⚠️')} ${esc(FO.AVVIK[a.type]?.navn || 'Avvik')}</b>${a.utbedret ? ' <span class="hint">utbedret</span>' : ''}<div>${esc(a.beskrivelse)}</div><div class="hint">${esc(String(a.tid).replace('T', ' '))}${a.bestandId ? ` · bestand ${esc(S().bestand.find((x) => x.id === a.bestandId)?.nr || '')}` : ''}${a.pos ? ` · ${a.pos[1].toFixed(5)}, ${a.pos[0].toFixed(5)}` : ''}</div></div></div>`).join('')}</div>` : ''}
        ${r.slutt ? `<h5>Ferdigmelding</h5><p>${esc(datoNb(r.slutt.dato))} – <b>${esc(r.slutt.navn)}</b>${r.timer != null ? ` · ${fmt(r.timer, 1)} timer` : ''}</p>${r.slutt.merknad ? `<p class="hint">${esc(r.slutt.merknad)}</p>` : ''}<img class="fo-signatur" src="${r.slutt.signatur}" alt="Signatur">` : ''}
      </details>` : ''}
      <div class="knapperad">
        <button type="button" class="knapp liten" data-fo="hent">🔄 Oppdater</button>
        ${d?.status === 'ferdigmeldt' ? '<button type="button" class="knapp liten primar" data-fo="bruk">✓ Ta inn rapporten i planen og godkjenn</button><button type="button" class="knapp liten" data-fo="gjenapne">Åpne igjen</button>' : ''}
        ${!['godkjent', 'ferdigmeldt'].includes(d?.status) ? '<button type="button" class="knapp liten" data-fo="send-igjen">Send oppdatert plan</button><button type="button" class="knapp liten fare" data-fo="trekk">Trekk tilbake</button>' : ''}
      </div>
      ${o.feltrapport ? `<p class="hint">Rapporten ble tatt inn i planen ${esc(datoNb(o.feltrapport.mottatt))}.</p>` : ''}
    </div>`;
  }

  async function klikk(e, o, tegn) {
    const k = e.target.closest('[data-fo]')?.dataset.fo; if (!k) return false;
    try {
      if (k === 'send' || k === 'send-igjen') {
        const til = k === 'send' ? e.target.closest('.fo').querySelector('[data-fo-til]').value : o.feltoppdrag.utforer;
        const st = typeFor(o.type).sjekk || []; const sjekket = st.filter((x) => o.sjekk?.[x.id]).length;
        if (k === 'send' && sjekket < st.length && !confirm(`Miljøsjekken er ikke fullført (${sjekket} av ${st.length}). Sende oppdraget likevel?`)) return true;
        const r = await kall('/api/feltoppdrag', { metode: 'POST', kropp: { utforer: til, oppdrag: o, plan: planTilSending(), planId: S().planId } });
        const n = entreprenorer?.find((x) => x.bruker === til);
        o.feltoppdrag = { id: r.id, utforer: til, utforerNavn: n ? (n.foretak || n.navn) : (o.feltoppdrag?.utforerNavn || til), sendt: new Date().toISOString().slice(0, 10), status: r.status };
        if (!o.utforer?.navn && n) o.utforer = { ...o.utforer, navn: n.foretak || n.navn, kontakt: n.foretak ? n.navn : '' };
        if (o.status === 'utkast') o.status = 'bestilt';
        hentet.delete(o.id); endret({ kart: false }); tegn();
        melding(k === 'send' ? 'Oppdraget er sendt. Entreprenøren får beskjed i chatten og finner det i SkogIQ Entreprenør.' : 'Den oppdaterte planen er sendt til entreprenøren.');
      }
      if (k === 'hent') await hentStatus(o, tegn, { stille: false });
      if (k === 'trekk' && confirm('Trekke oppdraget tilbake fra entreprenøren?')) { await kall(`/api/feltoppdrag/${o.feltoppdrag.id}/status`, { metode: 'PUT', kropp: { handling: 'trekk' } }); o.feltoppdrag.status = 'trukket'; hentet.delete(o.id); endret({ kart: false }); tegn(); melding('Oppdraget er trukket tilbake.'); }
      if (k === 'gjenapne' && confirm('Åpne oppdraget igjen? Entreprenøren får beskjed og må ferdigmelde på nytt.')) { await kall(`/api/feltoppdrag/${o.feltoppdrag.id}/status`, { metode: 'PUT', kropp: { handling: 'gjenapne' } }); await hentStatus(o, tegn); }
      if (k === 'bruk') {
        const d = hentet.get(o.id)?.d; if (!d) return true;
        const r = FO.sikreRapport(d.plan, d.oppdrag, d.rapport);
        const endrede = FO.brukRapport(S(), o, r, { kilde: o.feltoppdrag.utforerNavn });
        for (const { bestand: b, tiltak: t, dato } of endrede) { settUtfort(b, t, true); t.utfortDato = dato; }
        await kall(`/api/feltoppdrag/${o.feltoppdrag.id}/status`, { metode: 'PUT', kropp: { handling: 'godkjenn' } });
        o.feltoppdrag.status = 'godkjent'; endret({ kart: true }); await hentStatus(o, tegn);
        melding(`Rapporten er tatt inn: ${endrede.length} tiltak er satt utført, og oppdraget er godkjent.`);
      }
    } catch (x) { melding(x.message); }
    return true;
  }
  return { html, klikk };
}
