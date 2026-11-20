// Samler norske tekster som mangler i den engelske ordboken (js/sprak-en.js): klikker gjennom fullversjonen,
// SkogIQ Felt, admin og innloggingssiden i engelsk «samlemodus» (js/sprak.js) og skriver de manglende tekstene til en
// JSON-fil. Bruk: node verktoy/sprak-samle.mjs <adresse til lokal server> <brukernavn> <passord> <utfil.json>
// Krever Playwright. Kjøres mot en lokal server med en testbruker – aldri mot produksjon med ekte brukere.
import { createRequire } from 'node:module'; import fs from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const [B, bruker, passord, utfil = 'sprak-mangler.json'] = process.argv.slice(2);
const br = await pw.chromium.launch(); const alle = new Set();
const side = async (opt = { viewport: { width: 1400, height: 900 } }) => {
  const c = await br.newContext(opt); await c.addInitScript(() => { localStorage.setItem('skogiq-sprak', 'en'); localStorage.setItem('skogiq-sprak-samle', '1'); });
  const p = await c.newPage(); if (bruker) await p.request.post(`${B}/api/logginn`, { data: { bruker, passord } }); return p;
};
const hent = async (p) => { try { for (const k of await p.evaluate(() => [...(window.__sprakMangler || [])])) alle.add(k); } catch { /* siden er borte */ } };
const klikk = async (p, sel) => { try { await p.evaluate((s) => { for (const e of document.querySelectorAll(s)) e.click(); }, sel); } catch { /* ingen */ } await p.waitForTimeout(400); };
const lukkDialoger = (p) => p.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close())).catch(() => {});

// Fullversjonen: alle faner, med demo-plan og første plan i listen
const p = await side(); await p.goto(`${B}/index.html`); await p.waitForTimeout(3000); await hent(p); await lukkDialoger(p);
await klikk(p, '#demoBtn'); await p.waitForTimeout(3000); await lukkDialoger(p);
const faner = await p.evaluate(() => [...document.querySelectorAll('[data-fane]')].map((b) => b.dataset.fane));
for (const f of [...new Set(faner)]) {
  await p.evaluate((x) => document.querySelector(`[data-fane="${x}"]`)?.click(), f); await p.waitForTimeout(1200); await hent(p);
  // Underfaner og detaljer i fanen
  await p.evaluate(() => { for (const d of document.querySelectorAll('.fane:not([hidden]) details')) d.open = true; });
  for (const sel of ['.fane:not([hidden]) [data-tv]', '.fane:not([hidden]) .sb-under button']) { const n = await p.evaluate((s) => document.querySelectorAll(s).length, sel); for (let i = 0; i < n; i++) { await p.evaluate(([s, j]) => document.querySelectorAll(s)[j]?.click(), [sel, i]); await p.waitForTimeout(600); await hent(p); } }
}
// Dypere: kjør tiltaksmotoren, og trykk på knappene i hver fane (bekreftelser besvares «nei», lenker følges ikke)
p.on('dialog', (d) => d.dismiss().catch(() => {}));
await p.evaluate(() => document.querySelector('[data-fane="tiltak"]')?.click()); await p.waitForTimeout(500);
await klikk(p, '#foreslaBtn'); await p.waitForTimeout(1500); await hent(p);
await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Lag forslag/.test(x.textContent)); b?.click(); }); await p.waitForTimeout(2500); await hent(p);
await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /Legg til alle|Bruk/.test(x.textContent) && x.offsetParent); b?.click(); }); await p.waitForTimeout(1500); await hent(p);
const FARLIG = /slett|fjern|logg ut|tilbakestill|erstatt|nullstill|sperr|trekk|avslutt|lukk/i;
for (const f of [...new Set(faner)]) {
  if (f === 'kommune') continue;
  await p.evaluate((x) => document.querySelector(`[data-fane="${x}"]`)?.click(), f); await p.waitForTimeout(800);
  const n = await p.evaluate(() => document.querySelectorAll('.fane:not([hidden]) button').length);
  for (let i = 0; i < Math.min(n, 70); i++) {
    const ok = await p.evaluate(([j, re]) => { const b = document.querySelectorAll('.fane:not([hidden]) button')[j]; if (!b || !b.offsetParent || new RegExp(re, 'i').test(b.textContent + (b.title || ''))) return false; b.click(); return true; }, [i, FARLIG.source]);
    if (!ok) continue; await p.waitForTimeout(500); await hent(p); await lukkDialoger(p);
    await p.evaluate((x) => { if (document.querySelector('.fane:not([hidden])')?.id !== `fane-${x}`) document.querySelector(`[data-fane="${x}"]`)?.click(); }, f).catch(() => {});
  }
}
// Rapportene vises i en iframe – hent det som mangler der også
await p.evaluate(() => document.querySelector('[data-fane="rapporter"]')?.click()); await p.waitForTimeout(500);
const rapporter = await p.evaluate(() => [...document.querySelectorAll('[data-rapport]')].map((b) => b.dataset.rapport));
for (const r of rapporter) { await p.evaluate((x) => document.querySelector(`[data-rapport="${x}"]`)?.click(), r); await p.waitForTimeout(2500); await hent(p); await p.keyboard.press('Escape').catch(() => {}); await p.evaluate(() => document.querySelector('#rapportVisning [data-lukk], #rapportVisning .lukk, #rapportLukk')?.click()); }
// Flere bestandsdetaljer
await p.evaluate(() => document.querySelector('[data-fane="bestand"]')?.click()); await p.waitForTimeout(500);
for (let i = 0; i < 6; i++) { await p.evaluate((j) => document.querySelectorAll('#bestandTabell tbody tr')[j * 3]?.click(), i); await p.waitForTimeout(900); await hent(p); }
// Kommuneanalyse for en liten kommune (tar et par minutter)
if (process.env.SAMLE_KOMMUNE) {
  await p.evaluate(() => document.querySelector('[data-fane="kommune"]')?.click()); await p.waitForTimeout(800); await p.evaluate((k) => { const i = document.querySelector('#komKommune'); i.value = k; document.querySelector('#komBtn').click(); }, process.env.SAMLE_KOMMUNE);
  await p.waitForSelector('#komResultat:not([hidden])', { timeout: 600000 }).catch(() => {}); await p.waitForTimeout(3000); await hent(p);
  for (const k of ['hogst', 'lukket', 'ungskog', 'tynning']) { await p.evaluate((x) => document.querySelector(`[data-kategori="${x}"]`)?.click(), k); await p.waitForTimeout(1500); await hent(p); }
  await p.evaluate(() => document.querySelector('#komListe .kom-rad')?.click()); await p.waitForTimeout(1500); await hent(p);
}
// Bestandsdetalj, hjelp, tilbakemelding, hva er nytt, kommandopalett
await p.evaluate(() => document.querySelector('[data-fane="bestand"]')?.click()); await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('#bestandTabell tbody tr')?.click()); await p.waitForTimeout(1500); await hent(p);
for (const sel of ['[data-hva-nytt]', '[data-tilbakemelding]', '[data-skogen]']) { await klikk(p, sel); await p.waitForTimeout(800); await hent(p); await lukkDialoger(p); }
const hjelp = await p.evaluate(() => [...new Set([...document.querySelectorAll('[data-hjelp]')].map((e) => e.dataset.hjelp))]);
for (const h of hjelp) { await p.evaluate((x) => document.querySelector(`[data-hjelp="${x}"]`)?.click(), h); await p.waitForTimeout(500); await hent(p); await lukkDialoger(p); await p.keyboard.press('Escape').catch(() => {}); }
await p.keyboard.press('Control+k').catch(() => {}); await p.waitForTimeout(600); await hent(p); await p.keyboard.press('Escape').catch(() => {});
// Felt
const f = await side({ ...pw.devices['iPhone 13'] }); await f.goto(`${B}/felt.html`); await f.waitForTimeout(3500); await hent(f);
const plan = await f.$('[data-plan]'); if (plan) { await plan.click(); await f.waitForTimeout(2500); }
for (const v of ['tiltak', 'oppdrag', 'registrering', 'mer']) { await f.evaluate((x) => document.querySelector(`[data-vis="${x}"]`)?.click(), v); await f.waitForTimeout(1200); await hent(f); }
await f.evaluate(() => document.querySelector('[data-bestand], [data-tiltakkort]')?.click()); await f.waitForTimeout(1200); await hent(f);
// Admin og de åpne sidene
for (const s of ['admin.html', 'personvern.html', 'tilbud.html', 'tommer.html', 'kontroller.html']) { const a = await side(); await a.goto(`${B}/${s}`).catch(() => {}); await a.waitForTimeout(3000); await hent(a); }
const inn = await side({ viewport: { width: 1200, height: 900 } }); await inn.context().clearCookies(); await inn.goto(`${B}/logginn.html`); await inn.waitForTimeout(1500); await hent(inn);
await inn.evaluate(() => document.querySelector('[data-fane="reg"]')?.click()); await inn.waitForTimeout(500); await hent(inn);
await br.close();
const liste = [...alle].filter((t) => /\p{L}{2}/u.test(t)).sort();
fs.writeFileSync(utfil, JSON.stringify(liste, null, 1)); console.log(`${liste.length} tekster mangler – skrevet til ${utfil}`);
