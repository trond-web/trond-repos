// Innlogging og utlogging for dommer- og sekretariatsidene.
import { api, html, raw, $ } from './felles.js';

export async function sikreInnlogging(rolle, tittel) {
  const meg = await api('/api/meg');
  if (meg.rolle === rolle) { visBruker(meg); return meg; }
  return new Promise((ferdig) => {
    $('#app').innerHTML = html`
      <form class="kort innlogging" id="logginn">
        <h1>${tittel}</h1>
        ${meg.rolle ? raw(html`<div class="varsel advarsel">Du er logget inn som ${meg.navn}, men denne siden krever annen tilgang.</div>`) : ''}
        <div class="felt"><label for="bn">Brukernavn</label><input id="bn" name="brukernavn" autocomplete="username" autocapitalize="none" required></div>
        <div class="felt"><label for="pw">Passord</label><input id="pw" name="passord" type="password" autocomplete="current-password" required></div>
        <div id="loginfeil"></div>
        <button class="primar" style="width:100%">Logg inn</button>
      </form>`;
    $('#bn').focus();
    $('#logginn').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      try {
        const svar = await api('/api/logginn', { metode: 'POST', data: { brukernavn: f.brukernavn.value, passord: f.passord.value } });
        if (svar.rolle !== rolle) throw new Error(rolle === 'dommer' ? 'Brukeren er ikke en dommer.' : 'Brukeren har ikke tilgang til sekretariatet.');
        visBruker(svar);
        ferdig(svar);
      } catch (err) {
        $('#loginfeil').innerHTML = html`<div class="varsel fare">${err.message}</div>`;
      }
    });
  });
}

function visBruker(meg) {
  const boks = $('#bruker');
  boks.innerHTML = html`<span>${meg.navn}</span><button class="liten" id="loggut">Logg ut</button>`;
  $('#loggut').onclick = async () => { await api('/api/loggut', { metode: 'POST', data: {} }); location.reload(); };
}
