// 🧭 Driftsområder: hvilke deler av løsningen eiendommen bruker – skog, jord og husdyr. Valget ligger i planen
// (S.drift = { skog, jord, husdyr, valgt }), følger planen ved synkronisering og styrer hvilke faner som vises.
// Standard er at alt er på. Når en plan åpnes uten valg, foreslår appen ut fra hva som faktisk finnes på eiendommen.
import { arealfordeling } from './markslag.js';

export const OMRADER = {
  skog: { navn: 'Skog', ikon: '🌲', tekst: 'Bestand, tiltak, framskriving, veier, Skogbrand, karbon og PEFC', faner: ['bestand', 'tiltak', 'framskriving', 'veier', 'skogbrand', 'karbon', 'pefc'] },
  jord: { navn: 'Jord', ikon: '🌾', tekst: 'Skifteplan med vekster, jordprøver, gjødsling, plantevern og maskin', underfaner: ['skifter', 'gjodsling', 'sproyting', 'maskin'] },
  husdyr: { navn: 'Husdyr', ikon: '🐄', tekst: 'Dyrehold, husdyrgjødsel, fôrbalanse, beiteplan, plass i fjøset og produksjonstilskudd', underfaner: ['husdyr'] },
};
export const STANDARD = { skog: true, jord: true, husdyr: true };

// Gjeldende valg for planen (alt på hvis ingenting er valgt).
export function drift(S) { return { ...STANDARD, ...Object.fromEntries(Object.keys(STANDARD).map((k) => [k, S?.drift?.[k] !== false])) }; }
export const harValgt = (S) => !!S?.drift?.valgt;
// Minst ett område må være på.
export function settDrift(S, valg) {
  const v = Object.fromEntries(Object.keys(STANDARD).map((k) => [k, !!valg[k]]));
  if (!Object.values(v).some(Boolean)) v.skog = true;
  S.drift = { ...v, valgt: true }; return S.drift;
}

// Faner og underfaner som skal skjules. Skifteplan og KSL vises når jord eller husdyr er på.
export function skjulte(S) {
  const d = drift(S); const faner = new Set(); const underfaner = new Set();
  if (!d.skog) OMRADER.skog.faner.forEach((f) => faner.add(f));
  if (!d.jord) OMRADER.jord.underfaner.forEach((f) => underfaner.add(f));
  if (!d.husdyr) OMRADER.husdyr.underfaner.forEach((f) => underfaner.add(f));
  if (!d.jord && !d.husdyr) { faner.add('skifteplan'); faner.add('ksl'); }
  return { faner, underfaner };
}

// Hva eiendommen faktisk har – grunnlag for forslaget og hintene i dialogen.
export function hvaFinnes(S) {
  const bestand = (S?.bestand || []).length; const skogDaa = (S?.bestand || []).reduce((s, b) => s + (b.areal || 0), 0);
  let jordDaa = 0; try { jordDaa = arealfordeling({ bestand: [], markslag: S?.markslag || [], metadata: {} }).rader.jordbruk?.areal || 0; } catch { /* uten markslag */ }
  const skifter = (S?.skifteplan?.skifter || []).length; const skifteDaa = (S?.skifteplan?.skifter || []).reduce((s, x) => s + (x.areal || 0), 0);
  const dyr = (S?.skifteplan?.dyrehold?.dyr || []).filter((r) => Number(r.antall) > 0).length;
  const driftsbygg = (S?.takst?.bygninger || []).filter((g) => g.type === 'driftsbygning').length;
  return {
    skog: { har: bestand > 0, tekst: bestand ? `${bestand} bestand, ${Math.round(skogDaa)} daa skog` : 'Ingen skogbestand i planen' },
    jord: { har: skifter > 0 || jordDaa >= 5, tekst: skifter ? `${skifter} skifter, ${Math.round(skifteDaa)} daa` : jordDaa >= 1 ? `${Math.round(jordDaa)} daa jordbruksareal i kartet` : 'Ikke registrert jordbruksareal' },
    husdyr: { har: dyr > 0 || driftsbygg > 0, tekst: dyr ? `${dyr} dyreslag i dyreholdet` : driftsbygg ? `${driftsbygg} driftsbygning${driftsbygg > 1 ? 'er' : ''} i taksten` : 'Ingen dyr registrert' },
  };
}
// Forslag: det eiendommen har. Har den ingenting registrert ennå, står alt på (standard).
export function forslag(S) {
  const f = hvaFinnes(S); const v = { skog: f.skog.har, jord: f.jord.har, husdyr: f.husdyr.har };
  return Object.values(v).some(Boolean) ? v : { ...STANDARD };
}
export const kortTekst = (S) => { const d = drift(S); return Object.entries(OMRADER).filter(([k]) => d[k]).map(([, o]) => `${o.ikon} ${o.navn}`).join(' · '); };

// ---------- DOM ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Dialog for å velge driftsområder. Gir et løfte som løses med valget (eller null ved avbryt).
export function velgDriftsomrader(S, { forste = false } = {}) {
  return new Promise((ok) => {
    const naa = harValgt(S) ? drift(S) : { ...STANDARD }; const finnes = hvaFinnes(S); const fs = forslag(S);
    const avvik = !harValgt(S) && Object.keys(fs).some((k) => fs[k] !== naa[k]);
    const d = document.createElement('dialog'); d.className = 'drift-dialog';
    d.innerHTML = `<form method="dialog">
      <h3>${forste ? 'Hva driver du med' : 'Driftsområder'}${S?.eiendom?.navn ? ` på ${esc(S.eiendom.navn)}` : ''}?</h3>
      <p class="hint">Velg hvilke deler av SkogIQ.ai du vil se for denne eiendommen. Fanene for det du ikke bruker, skjules – dataene blir liggende, og du kan slå dem på igjen når som helst.</p>
      <div class="drift-valg">${Object.entries(OMRADER).map(([k, o]) => `<label class="drift-kort">
        <input type="checkbox" name="${k}" ${naa[k] ? 'checked' : ''}>
        <span class="drift-ikon">${o.ikon}</span><span class="drift-tekst"><b>${o.navn}</b><span>${esc(o.tekst)}</span><span class="drift-finnes ${finnes[k].har ? 'ja' : 'nei'}">${finnes[k].har ? '✓' : '○'} ${esc(finnes[k].tekst)}</span></span></label>`).join('')}</div>
      ${avvik ? `<p class="drift-forslag">💡 Ut fra eiendommen foreslår vi: ${Object.entries(OMRADER).filter(([k]) => fs[k]).map(([, o]) => `${o.ikon} ${o.navn}`).join(', ')}. <button type="button" class="knapp liten" data-drift="forslag">Bruk forslaget</button></p>` : ''}
      <div class="knapperad"><button type="submit" class="knapp primar" value="ok">Lagre</button>${forste ? '<button type="submit" class="knapp" value="alt">Vis alt</button>' : '<button type="submit" class="knapp" value="avbryt">Avbryt</button>'}</div>
    </form>`;
    document.body.appendChild(d);
    d.querySelector('[data-drift="forslag"]')?.addEventListener('click', () => { for (const [k, v] of Object.entries(fs)) d.querySelector(`[name="${k}"]`).checked = v; });
    d.addEventListener('change', () => { const ingen = ![...d.querySelectorAll('input[type=checkbox]')].some((x) => x.checked); d.querySelector('[value="ok"]').disabled = ingen; });
    d.addEventListener('close', () => {
      const v = d.returnValue; const valg = Object.fromEntries(Object.keys(OMRADER).map((k) => [k, d.querySelector(`[name="${k}"]`).checked]));
      d.remove();
      ok(v === 'ok' ? valg : v === 'alt' ? { ...STANDARD } : null);
    });
    d.showModal();
  });
}
