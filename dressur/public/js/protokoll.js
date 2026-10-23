// Dommerprotokoller for utskrift. Rytteren åpner med påmeldingskoden når resultatlisten er offisiell (KR IV § 455.3);
// sekretariatet kan skrive ut én eller alle protokoller i en klasse.
import { api, html, raw, $, datoTekst, tidspunkt } from './felles.js';
import { TEKNISKE_FEIL, formatKarakter, formatProsent, feilridningTrekk } from './beregning.js';

const app = $('#app');
const q = new URLSearchParams(location.search);

function ark(v, prot) {
  const ovelser = v.program.punkter.filter((p) => p.del === 'ovelse');
  const helhet = v.program.punkter.filter((p) => p.del === 'helhet');
  const rad = (p) => raw(html`<tr><td><b>${p.nr}</b></td><td>${p.punkt ? raw(html`<b>${p.punkt}</b> `) : ''}${p.tekst}</td><td class="tall">${prot.karakterer[p.id] != null ? formatKarakter(prot.karakterer[p.id]) : ''}</td>
    <td class="tall">${p.koeff !== 1 ? `× ${formatKarakter(p.koeff)}` : ''}</td><td>${prot.kommentarer[p.id] || ''}</td></tr>`);
  const f = v.fradrag || {};
  const tekniske = (f.tekniske || []).map((k) => TEKNISKE_FEIL.find((t) => t.kode === k)?.tekst || k);
  return html`
    <article class="protokoll-ark">
      <div class="rad mellom"><h2>${v.program.nivaa} · ${v.program.navn}</h2><b>Dommer ${prot.pos}: ${prot.dommer}</b></div>
      <p class="dempet">${v.stevne.navn}${v.stevne.sted ? `, ${v.stevne.sted}` : ''} · ${datoTekst(v.klasse.dato)} · ${v.klasse.navn} · Bane ${v.program.bane} · Maks ${v.program.maks} poeng</p>
      <p><b>${v.ekvipasje.startnr ? `Nr ${v.ekvipasje.startnr} · ` : ''}${v.ekvipasje.rytter.navn}</b> (${v.ekvipasje.rytter.klubb}) – <b>${v.ekvipasje.hest.navn}</b></p>
      <div class="tabell-boks"><table>
        <thead><tr><th>Nr</th><th>Øvelse</th><th class="tall">Karakter</th><th class="tall">Koeff.</th><th>Kommentar</th></tr></thead>
        <tbody>${ovelser.map(rad)}
          <tr><th colspan="5">${v.program.type === 'kur' ? 'Kunstnerisk inntrykk' : 'Allment inntrykk'}</th></tr>${helhet.map(rad)}</tbody>
      </table></div>
      <p style="margin-top:10px"><b>Poeng: ${formatKarakter(prot.poeng)} av ${prot.maks}</b>
        ${v.program.type === 'kur' && prot.tekniskProsent != null ? ` · Teknisk ${formatProsent(prot.tekniskProsent)} % · Kunstnerisk ${formatProsent(prot.kunstProsent)} %` : ''}</p>
      ${f.feilridning ? raw(html`<p>Feilridning: ${f.feilridning} (${f.feilridning >= 3 ? 'eliminert' : `−${formatKarakter(feilridningTrekk(f.feilridning))} %`})</p>`) : ''}
      ${tekniske.length ? raw(html`<p>Fradrag for feil (−0,5 % per gang): ${tekniske.join(', ')}</p>`) : ''}
      ${f.kurTidAvvik ? raw('<p>Tid over/under angitt tid: −0,5 % fra kunstnerisk</p>') : ''}
      ${f.eliminert ? raw(html`<p><b>Eliminert:</b> ${f.elimGrunn}</p>`) : ''}
      <p><b>Resultat dommer ${prot.pos}: ${f.eliminert ? 'Eliminert' : prot.prosent != null ? `${formatProsent(prot.prosent)} %` : '–'}</b></p>
      ${prot.sluttkommentar ? raw(html`<p style="white-space:pre-line"><b>Sluttkommentar:</b> ${prot.sluttkommentar}</p>`) : ''}
      ${prot.rettelser.length ? raw(html`<p class="dempet">Rettet: ${prot.rettelser.map((r) => `${r.nr} fra ${formatKarakter(r.fra)} til ${formatKarakter(r.til)} (${r.grunn}, ${tidspunkt(r.tid)})`).join('; ')}</p>`) : ''}
      <p class="dempet">${prot.signert ? `Signert av ${prot.dommer} ${tidspunkt(prot.signert)}` : 'Ikke signert'}</p>
    </article>`;
}

function visning(v) {
  return html`
    ${v.protokoller.map((p) => raw(ark(v, p)))}
    <p><b>Sluttresultat: ${v.resultat.prosent != null ? `${formatProsent(v.resultat.prosent)} %` : v.resultat.statusTekst}</b></p>`;
}

async function start() {
  try {
    let visninger;
    if (q.get('klasse')) visninger = await api(`/api/admin/klasser/${encodeURIComponent(q.get('klasse'))}/protokoller`);
    else if (q.get('kode')) visninger = [await api(`/api/protokoll/${encodeURIComponent(q.get('id'))}?kode=${encodeURIComponent(q.get('kode'))}`)];
    else visninger = [await api(`/api/admin/protokoll/${encodeURIComponent(q.get('id'))}`)];
    if (visninger[0]) $('#undertittel').textContent = visninger[0].stevne.navn;
    app.innerHTML = html`<div class="rad ikke-utskrift" style="margin-bottom:12px"><button class="primar" data-skriv-ut>Skriv ut / lagre som PDF</button></div>
      ${visninger.length ? '' : raw('<p class="dempet">Ingen protokoller.</p>')}
      ${visninger.map((v) => raw(visning(v)))}`;
  } catch (e) {
    app.innerHTML = html`<div class="varsel fare">${e.message}</div>${e.status === 401 ? raw('<p>Logg inn i <a href="/sekretariat">sekretariatet</a> først.</p>') : ''}`;
  }
}

start();
