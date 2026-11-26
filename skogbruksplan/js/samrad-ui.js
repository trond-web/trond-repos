// Fanen «🔥 Samråd» i hogst- og tynningsoppdrag: viser om samråd er obligatorisk ut fra skogbrannfaren i perioden
// (met.no), og lar entreprenør og oppdragsgiver fylle ut samrådsskjemaet digitalt, bekrefte det og laste det ned
// som PDF – eller dele det direkte med brannvesenet. Logikken: samrad.js.
import * as SR from './samrad.js';
import { BRANNNIVAA } from './skade.js';
import { hentBrannfare } from './skade-data.js';
import { linjer } from './oppdrag.js';
import { signatur } from './versjon.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const datoNb = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`).toLocaleDateString('nb-NO') : '');
const niv = (id) => BRANNNIVAA.find((n) => n.id === id);
const STATUS = {
  ok: { tekst: 'Samråd gjennomført', farge: 'var(--good, #0ca30c)', ikon: '✓' },
  mangler: { tekst: 'Samråd mangler – obligatorisk', farge: 'var(--critical, #d03b3b)', ikon: '!' },
  utlopt: { tekst: 'Tid for nytt samråd', farge: '#c77800', ikon: '!' },
  stans: { tekst: 'Driften er stanset etter samråd', farge: 'var(--critical, #d03b3b)', ikon: '■' },
  'ikke-pakrevd': { tekst: 'Samråd ikke påkrevd nå', farge: 'var(--accent)', ikon: 'i' },
  ukjent: { tekst: 'Skogbrannfare ikke hentet', farge: '#8a8a85', ikon: '?' },
};

export function lagSamradUi({ hentPlan, lagre, melding, nyId }) {
  const fare = new Map(); // oppdrag-id → { dager, hentet } (også lagret i oppdraget)
  const henter = new Set();
  const dagerFor = (o) => {
    const S = hentPlan(); const egen = o.samradFare; const sb = S.skogbrand?.data?.brann;
    const fersk = (x) => x?.hentet && Date.now() - new Date(x.hentet) < 12 * 3600e3;
    if (fersk(egen)) return egen.dager; if (fersk(sb)) return sb.dager;
    return egen?.dager || sb?.dager || [];
  };
  async function hentFare(o, tegn, { stille = true } = {}) {
    if (henter.has(o.id)) return; const S = hentPlan();
    const geo = linjer(S, o).map((x) => x.bestand.geometri).filter(Boolean); const p = []; const gaa = (c) => { if (typeof c[0] === 'number') p.push(c); else c.forEach(gaa); };
    for (const g of geo.length ? geo : [S.eiendom?.grense].filter(Boolean)) gaa(g.coordinates);
    if (!p.length) { if (!stille) melding('Oppdraget har ingen kartgeometri.'); return; }
    const lon = p.reduce((s, x) => s + x[0], 0) / p.length; const lat = p.reduce((s, x) => s + x[1], 0) / p.length;
    henter.add(o.id); tegn?.();
    try { const r = await hentBrannfare(lon, lat); o.samradFare = { dager: r.dager, hentet: r.hentet }; lagre(true); if (!stille) melding('Skogbrannfaren er hentet fra Meteorologisk institutt.'); }
    catch (e) { if (!stille) melding(`Klarte ikke å hente skogbrannfaren: ${e.message}`, 6000); }
    finally { henter.delete(o.id); tegn?.(); }
  }
  const status = (o) => SR.status(o, dagerFor(o));
  const aktivt = (o) => (o.samrad || []).at(-1) || null;

  function banner(o, tegn) {
    const st = status(o); if (st.id === 'ikke-relevant') return '';
    if (!dagerFor(o).length && !henter.has(o.id)) queueMicrotask(() => hentFare(o, tegn));
    if (!['mangler', 'utlopt', 'stans'].includes(st.id)) return '';
    const s = STATUS[st.id];
    return `<div class="sr-banner" style="--farge:${s.farge}"><b>🔥 ${esc(s.tekst)}</b><span>${esc(st.k.tekst)}</span><button type="button" class="knapp liten primar" data-oh="fane" data-fane="samrad">Åpne samrådsskjema</button></div>`;
  }
  const merke = (o) => { const id = status(o).id; return id === 'ok' ? '✓' : ['mangler', 'utlopt', 'stans'].includes(id) ? '!' : ''; };

  function html(o, tegn) {
    const st = status(o); const s = STATUS[st.id] || STATUS.ukjent; const k = st.k; const sk = aktivt(o);
    if (!dagerFor(o).length && !henter.has(o.id)) queueMicrotask(() => hentFare(o, tegn));
    const dager = k.fare?.dager || [];
    const stolpe = dager.length ? `<div class="sr-dager">${dager.slice(0, 14).map((d) => `<span title="${esc(datoNb(d.dato))}: ${esc(d.nivaa?.navn)} (FWI ${Math.round(d.fwi)})" style="background:${d.nivaa?.farge}"><small>${esc(d.dato.slice(8, 10))}.${esc(d.dato.slice(5, 7))}</small></span>`).join('')}</div>` : '';
    const topp = `<p class="hint op-intro">Ved stor skogbrannfare (rød) er samråd mellom entreprenør/maskinfører og tømmerkjøper/oppdragsgiver obligatorisk før og under drift. Ved ekstra stor fare (mørkerød) skal brannvesenet forespørres om å delta eller få kopi av skjemaet. <a href="${SR.KILDE.url}" target="_blank" rel="noopener">Retningslinjene</a></p>
      <div class="sr-status" style="--farge:${s.farge}"><i>${s.ikon}</i><div><b>${esc(s.tekst)}</b><div class="hint"><span>${esc(k.tekst || '')}</span>${o.samradFare?.hentet ? ` <span>· prognose hentet ${esc(new Date(o.samradFare.hentet).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' }))}</span>` : ''}</div></div>
        <button type="button" class="knapp liten" data-sr="hent-fare" ${henter.has(o.id) ? 'disabled' : ''}>${henter.has(o.id) ? 'Henter …' : 'Oppdater fare'}</button></div>${stolpe}
      ${(o.samrad || []).length > 1 ? `<details class="ekstra"><summary>Tidligere samråd (${o.samrad.length - 1})</summary><ul class="sf-liste">${o.samrad.slice(0, -1).reverse().map((x) => `<li>${esc(datoNb(x.dato))} kl. ${esc(x.tid)} – ${esc(SR.BESLUTNING[x.beslutning] || 'ikke fullført')} <button type="button" class="knapp liten" data-sr="pdf" data-id="${esc(x.id)}">PDF</button></li>`).join('')}</ul></details>` : ''}`;
    if (!sk) return `${topp}<div class="knapperad"><button type="button" class="knapp primar" data-sr="nytt">Fyll ut samrådsskjema</button></div>`;
    const m = SR.mangler(sk, { brannvesen: !!k.brannvesen }); const fullfort = !m.length;
    const v = (sti, navn, type = 'text', hint = '') => { const val = sti.split('.').reduce((a, x) => a?.[x], sk); return `<label>${esc(navn)}<input type="${type}" data-sr-f="${sti}" value="${esc(val ?? '')}" placeholder="${esc(hint)}"></label>`; };
    const ta = (sti, navn, hint = '') => { const val = sti.split('.').reduce((a, x) => a?.[x], sk); return `<label class="hel">${esc(navn)}<textarea rows="2" data-sr-f="${sti}" placeholder="${esc(hint)}">${esc(val ?? '')}</textarea></label>`; };
    const sjekk = (sti, tekst, ok) => `<label class="avkrysning"><input type="checkbox" data-sr-f="${sti}" ${ok ? 'checked' : ''}> <span>${esc(tekst)}</span></label>`;
    const bekreftet = sk.deltakere.filter((d) => d.bekreftet).length;
    return `${topp}
      <div class="sr-skjema">
        <div class="sr-hode"><b>Samråd ${esc(datoNb(sk.dato))} kl. ${esc(sk.tid)}</b>${fullfort ? '<span class="pille" style="--farge:var(--good,#0ca30c)">Fullført</span>' : `<span class="pille" style="--farge:#c77800">${m.length} mangler</span>`}</div>
        <h4 class="undertittel">Oppdrag og sted</h4>
        <div class="skjema to-kol">${v('dato', 'Dato for samrådet', 'date')}${v('tid', 'Klokkeslett', 'time')}${v('sted.bestand', 'Bestand')}${v('sted.posisjon', 'Nøyaktig posisjon', 'text', 'breddegrad N, lengdegrad Ø')}
          ${ta('sted.adkomst', 'Adkomst for brannvesenet', 'Vei, bommer og nøkler, bæreevne, snuplass')}${v('sted.moteplass', 'Møteplass for nødetater', 'text', 'F.eks. velteplassen ved Fv. 123')}</div>
        <h4 class="undertittel">Skogbrannfare</h4>
        <div class="skjema to-kol"><label>Skogbrannindeks i dag<select data-sr-f="fare.nivaa"><option value="">–</option>${BRANNNIVAA.map((n) => `<option value="${n.id}" ${sk.fare.nivaa === n.id ? 'selected' : ''}>${esc(n.navn)}</option>`).join('')}</select></label>${v('fare.fwi', 'FWI', 'number')}
          ${v('fare.farevarsel', 'Farevarsel (Varsom/met.no)', 'text', 'F.eks. gult farevarsel for skogbrannfare')}${v('fare.torke', 'Tørke, nedbør og vind', 'text', 'Siste nedbør, vindretning og styrke')}</div>
        <h4 class="undertittel">Risikovurdering <span class="hint">kryss av når punktet er vurdert, og skriv kort hva dere fant</span></h4>
        <div class="sr-risiko">${SR.RISIKO.map((r) => `<div>${sjekk(`risiko.${r.id}.ok`, r.tekst, sk.risiko[r.id]?.ok)}<input data-sr-f="risiko.${r.id}.merknad" value="${esc(sk.risiko[r.id]?.merknad)}" placeholder="Merknad"></div>`).join('')}</div>
        <h4 class="undertittel">Utstyr og personer</h4>
        <div class="oppdrag-sjekk">${SR.UTSTYR.filter((u) => !u.morkerod || k.brannvesen || sk.utstyr[u.id]).map((u) => sjekk(`utstyr.${u.id}`, u.tekst, sk.utstyr[u.id])).join('')}</div>
        <div class="skjema">${ta('utstyrPersoner', 'Utstyr og personer som kan bidra ved brann', 'Vannvogn, pumpe, naboer med traktor og tank, nærmeste brannstasjon')}</div>
        <h4 class="undertittel">Sikringstiltak</h4>
        <div class="oppdrag-sjekk">${SR.TILTAK.map((t) => sjekk(`tiltak.${t.id}`, t.tekst, sk.tiltak[t.id])).join('')}</div>
        <div class="skjema">${ta('tiltakAndre', 'Andre tiltak')}</div>
        <h4 class="undertittel">Beslutning</h4>
        <div class="skjema to-kol"><label>Beslutning<select data-sr-f="beslutning"><option value="">Velg …</option>${Object.entries(SR.BESLUTNING).map(([id, t]) => `<option value="${id}" ${sk.beslutning === id ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
          ${sk.beslutning === 'begrenset' ? v('tidsrom', 'Tidsrom for drift', 'text', 'F.eks. kl. 03–11') : '<span></span>'}
          ${v('nyttSamrad', 'Tid for nytt samråd', 'datetime-local')}${v('kostnad', 'Kostnader og fordeling', 'text', 'F.eks. brannvakt dekkes av tømmerkjøper')}</div>
        <h4 class="undertittel">Brannvesenet ${k.brannvesen ? '<span class="pille" style="--farge:var(--critical,#d03b3b)">Obligatorisk ved ekstra stor fare</span>' : ''}</h4>
        <div class="oppdrag-sjekk">${sjekk('brannvesen.forespurt', 'Brannvesenet er forespurt om å delta i samrådet eller få kopi av skjemaet', sk.brannvesen.forespurt)}${sjekk('brannvesen.deltok', 'Brannvesenet deltok i samrådet', sk.brannvesen.deltok)}</div>
        <div class="skjema tre-kol">${v('brannvesen.navn', 'Kontakt i brannvesenet')}${v('brannvesen.telefon', 'Telefon', 'tel')}${v('brannvesen.epost', 'E-post', 'email')}</div>
        <h4 class="undertittel">Deltakere og bekreftelse <span class="hint">${bekreftet} av ${sk.deltakere.length} har bekreftet</span></h4>
        <div class="sr-deltakere">${sk.deltakere.map((d, i) => `<div class="sr-deltaker"><select data-sr-d="${i}" data-felt="rolle">${Object.entries(SR.ROLLER).map(([id, r]) => `<option value="${id}" ${d.rolle === id ? 'selected' : ''}>${esc(r.navn)}${r.paakrevd ? ' *' : ''}</option>`).join('')}</select>
          <input data-sr-d="${i}" data-felt="navn" value="${esc(d.navn)}" placeholder="Navn"><input data-sr-d="${i}" data-felt="firma" value="${esc(d.firma)}" placeholder="Firma"><input data-sr-d="${i}" data-felt="telefon" type="tel" value="${esc(d.telefon)}" placeholder="Telefon">
          ${d.bekreftet ? `<span class="sr-ok">✓ ${esc(new Date(d.bekreftet).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' }))}</span>` : `<button type="button" class="knapp liten primar" data-sr="bekreft" data-i="${i}" ${d.navn ? '' : 'disabled'}>Bekreft</button>`}
          <button type="button" class="knapp liten" data-sr="fjern-deltaker" data-i="${i}" aria-label="Fjern">✕</button></div>`).join('')}
          <div class="knapperad"><button type="button" class="knapp liten" data-sr="ny-deltaker">+ Deltaker</button></div>
          <p class="hint">* må bekrefte. «Bekreft» betyr at personen har gått gjennom og er enig i samrådet. Endres skjemaet etterpå, må det bekreftes på nytt.</p></div>
        ${o.feltoppdrag?.id ? '<p class="hint">📲 Oppdraget er sendt til entreprenøren. Bruk «Send oppdatert plan» under Utfører, så får entreprenøren det siste samrådet i SkogIQ Entreprenør.</p>' : ''}
        ${m.length ? `<div class="sr-mangler"><b>Mangler før skjemaet er fullført:</b><ul>${m.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        <div class="knapperad"><button type="button" class="knapp primar" data-sr="pdf">⬇ Last ned PDF</button><button type="button" class="knapp" data-sr="del">📤 Send til brannvesenet</button><button type="button" class="knapp liten" data-sr="nytt">Nytt samråd</button>
          ${sk.brannvesen.kopiSendt ? `<span class="hint">Kopi sendt brannvesenet ${esc(datoNb(sk.brannvesen.kopiSendt))}</span>` : ''}</div>
      </div>`;
  }

  function pdfFil(o, sk) { const S = hentPlan(); return new File([SR.pdf(S, o, sk, { signatur: signatur() })], SR.filnavn(S, o, sk), { type: 'application/pdf' }); }
  function lastNed(fil) { const url = URL.createObjectURL(fil); const a = document.createElement('a'); a.href = url; a.download = fil.name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500); }

  async function klikk(e, o, tegn) {
    const b = e.target.closest('[data-sr]'); if (!b) return false; const hva = b.dataset.sr; const sk = aktivt(o);
    if (hva === 'hent-fare') { hentFare(o, tegn, { stille: false }); return true; }
    if (hva === 'nytt') {
      const ny = SR.nytt(hentPlan(), o, { nyId, dager: dagerFor(o) });
      if (sk) { // nytt samråd bygger på det forrige – risikovurdering, tiltak og deltakere, men uten bekreftelser
        for (const k of ['risiko', 'utstyr', 'utstyrPersoner', 'tiltak', 'tiltakAndre', 'kostnad', 'beslutning', 'tidsrom']) ny[k] = JSON.parse(JSON.stringify(sk[k]));
        ny.sted = { ...ny.sted, adkomst: sk.sted.adkomst, moteplass: sk.sted.moteplass }; ny.brannvesen = { ...sk.brannvesen, forespurt: false, deltok: false, kopiSendt: '' };
        ny.deltakere = sk.deltakere.map((d) => ({ ...d, bekreftet: null }));
      }
      o.samrad = [...(o.samrad || []), ny]; lagre(false); tegn(); return true;
    }
    if (!sk) return true;
    if (hva === 'bekreft') { const d = sk.deltakere[Number(b.dataset.i)]; if (d?.navn) { d.bekreftet = new Date().toISOString(); lagre(false); tegn(); melding(`${d.navn} har bekreftet samrådet.`); } return true; }
    if (hva === 'ny-deltaker') { sk.deltakere.push({ rolle: sk.deltakere.some((d) => d.rolle === 'brannvakt') ? 'brannvesen' : 'brannvakt', navn: '', firma: '', telefon: '', bekreftet: null }); lagre(false); tegn(); return true; }
    if (hva === 'fjern-deltaker') { sk.deltakere.splice(Number(b.dataset.i), 1); lagre(false); tegn(); return true; }
    if (hva === 'pdf') { const x = b.dataset.id ? o.samrad.find((y) => y.id === b.dataset.id) : sk; lastNed(pdfFil(o, x)); return true; }
    if (hva === 'del') {
      const m = SR.mangler(sk, { brannvesen: !!status(o).k.brannvesen });
      if (m.length && !confirm(`Skjemaet er ikke fullført (${m.length} mangler). Sende likevel?`)) return true;
      const fil = pdfFil(o, sk); const S = hentPlan();
      const tittel = `Samrådsskjema skogbrannfare – ${S.eiendom?.navn || ''} ${o.nr || ''}`.trim();
      const tekst = `Vedlagt samrådsskjema for skogsdrift ved skogbrannfare: ${S.eiendom?.navn || ''}${S.eiendom?.kommune ? `, ${S.eiendom.kommune}` : ''}. Posisjon ${sk.sted.posisjon}. Samråd ${datoNb(sk.dato)} kl. ${sk.tid}.`;
      let delt = false;
      try { if (navigator.canShare?.({ files: [fil] })) { await navigator.share({ files: [fil], title: tittel, text: tekst }); delt = true; } } catch (err) { if (err?.name === 'AbortError') return true; }
      if (!delt) {
        lastNed(fil);
        if (sk.brannvesen.epost) location.href = `mailto:${encodeURIComponent(sk.brannvesen.epost)}?subject=${encodeURIComponent(tittel)}&body=${encodeURIComponent(`${tekst}\n\nPDF-en er lastet ned som ${fil.name} – legg den ved e-posten.`)}`;
        melding(sk.brannvesen.epost ? 'PDF-en er lastet ned. Legg den ved e-posten som åpnes.' : 'PDF-en er lastet ned. Skriv inn e-posten til brannvesenet for å få en ferdig e-post neste gang.', 7000);
      }
      sk.brannvesen.kopiSendt = new Date().toISOString().slice(0, 10); sk.brannvesen.forespurt = true; lagre(false); tegn(); return true;
    }
    return true;
  }

  // Felt i skjemaet. Endres et fullført skjema, nullstilles bekreftelsene.
  function endring(e, o, tegn) {
    const t = e.target; const sk = aktivt(o); if (!sk) return false;
    const nullstill = () => { if (sk.deltakere.some((d) => d.bekreftet)) { sk.deltakere.forEach((d) => { d.bekreftet = null; }); melding('Skjemaet er endret – bekreftelsene må gis på nytt.', 5000); } };
    if (t.dataset.srF) {
      const sti = t.dataset.srF.split('.'); let obj = sk; for (const k of sti.slice(0, -1)) obj = obj[k] ??= {};
      const v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? null : Number(t.value)) : t.value;
      if (obj[sti.at(-1)] === v) return true;
      const hadde = sk.deltakere.some((d) => d.bekreftet); obj[sti.at(-1)] = v; nullstill(); lagre(false);
      if (hadde || t.type === 'checkbox' || t.tagName === 'SELECT') tegn(); // tekstfelt tegnes ikke på nytt, så fokus og tabulering virker
      return true;
    }
    if (t.dataset.srD !== undefined) {
      const d = sk.deltakere[Number(t.dataset.srD)]; if (!d) return true;
      if (d[t.dataset.felt] === t.value) return true;
      const hadde = !!d.bekreftet || (t.dataset.felt === 'navn' && !d.navn !== !t.value); d[t.dataset.felt] = t.value; d.bekreftet = null; lagre(false);
      if (hadde || t.tagName === 'SELECT') tegn(); return true;
    }
    return false;
  }

  // Før status «Pågår»: samråd er obligatorisk ved stor skogbrannfare.
  function sjekkStart(o) {
    const st = status(o);
    if (st.id === 'mangler') return confirm(`🔥 ${st.k.tekst}\n\nSamrådsskjemaet er ikke fylt ut og bekreftet. Sette oppdraget til «Pågår» likevel?`);
    if (st.id === 'utlopt') return confirm('🔥 Tiden for nytt samråd er passert. Gjennomfør nytt samråd før drift. Fortsette likevel?');
    if (st.id === 'stans') return confirm('🔥 Siste samråd besluttet å stanse driften. Fortsette likevel?');
    return true;
  }

  return { html, klikk, endring, banner, merke, status, sjekkStart, hentFare };
}
