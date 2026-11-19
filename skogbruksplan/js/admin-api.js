// Admin › API: nøkler til integrasjons-API-et (/api/admin/apinokler, api-nokler.js) og dokumentasjonen
// (/api/v1/openapi.json, api-dok.js) – endepunkter, eksempler, curl, interne endepunkter og «Prøv API-et».
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tid = (t) => (t ? new Date(t).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' }) : '–');
const METODEFARGE = { get: '#1f6b4a', post: '#2a78d6', patch: '#c98500', delete: '#b4302f', put: '#7d5bd0' };

export function lagAdminApi({ API, hode }) {
  let data = null; let spec = null; let apenDok = new Set();
  const base = () => API || location.origin;
  async function kall(sti, { metode = 'GET', kropp } = {}) {
    const r = await fetch(`${API}${sti}`, { method: metode, headers: { ...(kropp ? { 'Content-Type': 'application/json' } : {}), ...hode() }, credentials: 'same-origin', cache: 'no-store', body: kropp ? JSON.stringify(kropp) : undefined });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.feil || `Serveren svarte ${r.status}`); return j;
  }
  function kort(id) { let el = document.getElementById(id); if (!el) { el = document.createElement('div'); el.id = id; el.className = 'kort'; document.getElementById('innhold').appendChild(el); } return el; }

  async function visNokler() {
    const el = kort('apiKort');
    try { data = await kall('/api/admin/apinokler'); } catch (e) { el.innerHTML = `<h2>🔌 API-nøkler</h2><p class="feil">${esc(e.message)}</p>`; return; }
    const aktive = data.nokler.filter((n) => n.aktiv);
    el.innerHTML = `<h2>🔌 API-nøkler <span class="hint" style="font-weight:400">integrasjons-API (/api/v1)</span></h2>
      <p class="hint">En nøkkel gir et eksternt system tilgang til <b>én brukers egne planer</b> – bare lese, eller lese og skrive. Opprett nøkler bare etter avtale med brukeren. Nøkkelen vises én gang; bare en sjekksum lagres. Trekk den tilbake når den ikke trengs.</p>
      <div class="tall"><div><b>${aktive.length}</b><span>aktive nøkler</span></div><div><b>${aktive.filter((n) => n.tilgang === 'skriv').length}</b><span>med skrivetilgang</span></div><div><b>${data.nokler.reduce((s, n) => s + (n.antallKall || 0), 0).toLocaleString('nb-NO')}</b><span>kall totalt</span></div><div><b>${data.logg[0] ? tid(data.logg[0].tid) : '–'}</b><span>siste kall</span></div></div>
      <form id="apiNyNokkel" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin:12px 0">
        <label style="display:grid;gap:3px;font-size:13px">Bruker<select name="bruker" required><option value="">Velg bruker …</option>${data.brukere.map((b) => `<option value="${esc(b.bruker)}">${esc(b.navn)}${b.navn !== b.bruker ? ` (${esc(b.bruker)})` : ''}</option>`).join('')}</select></label>
        <label style="display:grid;gap:3px;font-size:13px">Navn på nøkkelen<input name="navn" placeholder="F.eks. Regnskap, Glommen Mjøsen, ERP" maxlength="80" style="font:inherit;font-size:13px;padding:5px 8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);min-width:220px"></label>
        <label style="display:grid;gap:3px;font-size:13px">Tilgang<select name="tilgang"><option value="les">Bare lese</option><option value="skriv">Lese og skrive</option></select></label>
        <button type="submit" style="background:var(--accent);color:#fff;border-color:transparent">＋ Opprett nøkkel</button>
      </form>
      ${data.nokler.length ? `<div class="tabell"><table><thead><tr><th>Navn</th><th>Bruker</th><th>Tilgang</th><th>Nøkkel</th><th>Opprettet</th><th>Sist brukt</th><th class="t">Kall</th><th></th></tr></thead><tbody>
        ${data.nokler.map((n) => `<tr style="${n.aktiv ? '' : 'opacity:.55'}"><td class="navn"><b>${esc(n.navn)}</b>${n.aktiv ? '' : ' <span class="pille sperret">trukket tilbake</span>'}</td><td>${esc(n.bruker)}</td><td><span class="pille ${n.tilgang === 'skriv' ? 'admin' : ''}">${n.tilgang === 'skriv' ? 'lese og skrive' : 'bare lese'}</span></td><td><code>${esc(n.prefiks)}</code></td><td>${tid(n.laget)}<div class="hint">${esc(n.lagetAv || '')}</div></td><td>${tid(n.sistBrukt)}</td><td class="t">${(n.antallKall || 0).toLocaleString('nb-NO')}</td><td>${n.aktiv ? `<button type="button" class="fare" data-api-trekk="${esc(n.id)}">Trekk tilbake</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="hint">Ingen nøkler ennå.</p>'}
      ${data.logg.length ? `<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:600">Siste kall (${data.logg.length})</summary><div class="tabell"><table><thead><tr><th>Tid</th><th>Nøkkel</th><th>Bruker</th><th>Kall</th><th class="t">Status</th></tr></thead><tbody>
        ${data.logg.slice(0, 100).map((l) => `<tr><td>${tid(l.tid)}</td><td><code>${esc(l.nokkel)}</code> ${esc(data.nokler.find((n) => n.id === l.nokkel)?.navn || '')}</td><td>${esc(l.bruker)}</td><td><code>${esc(l.metode)} ${esc(l.sti)}</code></td><td class="t"><span class="pille ${l.status >= 400 ? 'sperret' : ''}">${l.status}</span></td></tr>`).join('')}
      </tbody></table></div></details>` : ''}`;
  }
  function visNyNokkel(r) {
    const d = document.createElement('dialog'); d.className = 'lenkedialog';
    d.innerHTML = `<b>🔑 Ny API-nøkkel: ${esc(r.info.navn)}</b>
      <p class="varsel" style="margin:0">Kopier nøkkelen nå – den vises <b>bare denne ene gangen</b>. Gi den til systemet på en sikker måte (ikke på vanlig e-post).</p>
      <p class="hint">Bruker: <b>${esc(r.info.bruker)}</b> · tilgang: <b>${r.info.tilgang === 'skriv' ? 'lese og skrive' : 'bare lese'}</b></p>
      <input readonly value="${esc(r.nokkel)}" aria-label="API-nøkkel">
      <p class="hint" style="margin:0">Eksempel:</p><input readonly value="${esc(`curl -H "Authorization: Bearer ${r.nokkel}" ${base()}/api/v1/planer`)}" aria-label="Eksempel">
      <div class="knapper"><button type="button" data-kopier-nokkel>Kopier nøkkelen</button><button type="button" data-lukk-nokkel>Ferdig</button></div>`;
    document.body.appendChild(d); d.showModal(); d.querySelector('input').select();
    d.addEventListener('click', async (e) => {
      if (e.target.closest('[data-kopier-nokkel]')) { try { await navigator.clipboard.writeText(r.nokkel); e.target.textContent = 'Kopiert ✓'; } catch { d.querySelector('input').select(); } }
      if (e.target.closest('[data-lukk-nokkel]')) { d.close(); d.remove(); visNokler(); }
    });
  }

  // ---------- dokumentasjon ----------
  async function visDok() {
    const el = kort('apiDokKort');
    try { spec = spec || await (await fetch(`${API}/api/v1/openapi.json`, { cache: 'no-store' })).json(); } catch { el.innerHTML = '<h2>📖 API-dokumentasjon</h2><p class="feil">Fikk ikke hentet dokumentasjonen.</p>'; return; }
    const grupper = {};
    for (const [sti, ops] of Object.entries(spec.paths)) for (const [metode, op] of Object.entries(ops)) (grupper[op.tags?.[0] || 'Annet'] ||= []).push({ sti, metode, op });
    const skjema = (s) => { if (!s) return ''; if (s.$ref) { const n = s.$ref.split('/').pop(); return skjema(spec.components.schemas[n]); } return s.properties ? `<table style="font-size:12.5px"><tbody>${Object.entries(s.properties).map(([k, v]) => `<tr><td><code>${esc(k)}</code>${(s.required || []).includes(k) ? ' <span class="pille">påkrevd</span>' : ''}</td><td class="hint">${esc(Array.isArray(v.type) ? v.type.join(' | ') : v.type || '')}${v.enum ? `: ${v.enum.map(esc).join(', ')}` : ''}${v.description ? ` – ${esc(v.description)}` : ''}</td></tr>`).join('')}</tbody></table>` : ''; };
    const curl = (sti, metode, op) => { const eks = op.requestBody?.content?.['application/json']?.example; const s = sti.replace('{planId}', 'PLAN_ID').replace(/\{(\w+)\}/g, (_, n) => n.toUpperCase()); return `curl${metode === 'get' ? '' : ` -X ${metode.toUpperCase()}`} -H "Authorization: Bearer $SKOGIQ_NOKKEL"${eks ? ` -H "Content-Type: application/json" -d '${JSON.stringify(eks)}'` : ''} ${base()}${s}`; };
    el.innerHTML = `<h2>📖 API-dokumentasjon <span class="hint" style="font-weight:400">${esc(spec.info.title)} ${esc(spec.info.version)}</span></h2>
      <p class="hint">${esc(spec.info.description)}</p>
      <p style="display:flex;gap:8px;flex-wrap:wrap"><a href="${esc(base())}/api/v1/openapi.json" target="_blank" rel="noopener" download="skogiq-openapi.json">⬇ OpenAPI 3.1 (JSON)</a><span class="hint">Kan importeres i Postman, Insomnia, Swagger UI o.l.</span></p>
      ${Object.entries(grupper).map(([tag, ops]) => `<h3 style="font-size:14.5px;margin:14px 0 6px">${esc(tag)}</h3>${ops.map(({ sti, metode, op }) => { const id = `${metode} ${sti}`; return `<details class="api-op" data-api-op="${esc(id)}" ${apenDok.has(id) ? 'open' : ''} style="border:1px solid var(--border);border-radius:10px;padding:6px 10px;margin:5px 0">
        <summary style="cursor:pointer;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="font:700 11px ui-monospace,monospace;color:#fff;background:${METODEFARGE[metode]};border-radius:6px;padding:2px 7px;min-width:52px;text-align:center">${metode.toUpperCase()}</span><code style="font-size:13px">${esc(sti)}</code><span class="hint">${esc(op.summary || '')}</span></summary>
        <div style="display:grid;gap:6px;margin:8px 0 4px;font-size:13px">
          ${op.parameters?.length ? `<div><b>Parametre</b><table style="font-size:12.5px"><tbody>${op.parameters.map((p) => `<tr><td><code>${esc(p.name)}</code></td><td class="hint">${esc(p.in)}${p.required ? ', påkrevd' : ''}${p.schema?.enum ? ` – ${p.schema.enum.join(', ')}` : ''}${p.description ? ` – ${esc(p.description)}` : ''}</td></tr>`).join('')}</tbody></table></div>` : ''}
          ${op.requestBody ? `<div><b>Kropp (JSON)</b>${skjema(op.requestBody.content['application/json'].schema)}${op.requestBody.content['application/json'].example ? `<pre style="margin:4px 0;background:var(--surface-2);padding:8px;border-radius:8px;overflow:auto">${esc(JSON.stringify(op.requestBody.content['application/json'].example, null, 2))}</pre>` : ''}</div>` : ''}
          <div><b>Svar</b> ${Object.keys(op.responses).map((k) => `<span class="pille ${Number(k) >= 400 ? 'sperret' : ''}">${k}</span>`).join(' ')}</div>
          <div><b>Eksempel</b><pre style="margin:4px 0;background:var(--surface-2);padding:8px;border-radius:8px;overflow:auto;white-space:pre-wrap">${esc(curl(sti, metode, op))}</pre></div>
        </div></details>`; }).join('')}`).join('')}
      <h3 style="font-size:14.5px;margin:16px 0 6px">🧪 Prøv API-et</h3>
      <form id="apiProv" style="display:grid;gap:6px"><div style="display:flex;gap:6px;flex-wrap:wrap"><input name="nokkel" placeholder="API-nøkkel (skiq_…)" autocomplete="off" style="flex:2;min-width:240px;font:12.5px ui-monospace,monospace;padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text)"><input name="sti" value="/api/v1/planer" style="flex:2;min-width:200px;font:12.5px ui-monospace,monospace;padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text)"><button type="submit">Send GET</button></div>
        <pre id="apiProvSvar" style="margin:0;max-height:320px;overflow:auto;background:var(--surface-2);padding:8px;border-radius:8px;font-size:12px;display:none"></pre></form>
      <h3 style="font-size:14.5px;margin:16px 0 6px">Interne endepunkter (brukes av appen – ikke for integrasjoner)</h3>
      <div class="tabell"><table><thead><tr><th>Metode</th><th>Sti</th><th>Område</th><th>Beskrivelse</th><th>Tilgang</th></tr></thead><tbody>${(spec['x-interne-endepunkter'] || []).map((e) => `<tr><td><code>${esc(e.metode)}</code></td><td><code>${esc(e.sti)}</code></td><td>${esc(e.tag)}</td><td class="navn">${esc(e.beskrivelse)}</td><td><span class="pille ${e.tilgang === 'admin' ? 'admin' : ''}">${esc(e.tilgang)}</span></td></tr>`).join('')}</tbody></table></div>`;
  }

  document.addEventListener('submit', async (e) => {
    if (e.target.id === 'apiNyNokkel') {
      e.preventDefault(); const f = e.target; if (!f.bruker.value) return;
      try { const r = await kall('/api/admin/apinokler', { metode: 'POST', kropp: { bruker: f.bruker.value, navn: f.navn.value, tilgang: f.tilgang.value } }); visNyNokkel(r); } catch (err) { alert(err.message); }
    }
    if (e.target.id === 'apiProv') {
      e.preventDefault(); const f = e.target; const ut = document.getElementById('apiProvSvar'); ut.style.display = 'block'; ut.textContent = 'Sender …';
      try { const r = await fetch(`${base()}${f.sti.value.trim()}`, { headers: { Authorization: `Bearer ${f.nokkel.value.trim()}` }, cache: 'no-store' }); const t = await r.text(); let vis = t; try { vis = JSON.stringify(JSON.parse(t), null, 2); } catch { /* tekst */ } ut.textContent = `HTTP ${r.status}\n\n${vis.slice(0, 20000)}`; } catch (err) { ut.textContent = err.message; }
    }
  });
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-api-trekk]'); if (!t) return;
    const n = data?.nokler.find((x) => x.id === t.dataset.apiTrekk);
    if (!confirm(`Trekke tilbake nøkkelen «${n?.navn || ''}» for ${n?.bruker || ''}? Systemet som bruker den, mister tilgangen med en gang.`)) return;
    try { await kall(`/api/admin/apinokler/${t.dataset.apiTrekk}`, { metode: 'DELETE' }); visNokler(); } catch (err) { alert(err.message); }
  });
  document.addEventListener('toggle', (e) => { const d = e.target; if (d?.dataset?.apiOp) { if (d.open) apenDok.add(d.dataset.apiOp); else apenDok.delete(d.dataset.apiOp); } }, true);
  return { vis: () => { visNokler(); visDok(); } };
}
