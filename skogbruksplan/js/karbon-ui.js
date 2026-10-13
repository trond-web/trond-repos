// Fanen «Karbon»: potensial for karbonkreditter, egnethet, scenarioer (referanse mot karbonforvaltning), prosjekt med
// status og bestand, karbontiltak i tiltaksplanen, oppfølging (verifiseringer, hendelser, kreditter) og utskrift av
// prosjektbeskrivelse. Logikken ligger i karbon.js.
import {
  KARBON_FAKTOR, STANDARD_KARBON, KARBON_STANDARDER, KARBON_KILDER, PROSJEKTSTATUS, STATUS_REKKE, HENDELSESTYPER,
  sikreKarbon, karbonInn, scenarioer, egnethet, nyttProsjekt, settStatus, brukKarbontiltak, karbonVarsler, kredittstatus,
  nyVerifikasjon, nyHendelse, utelukket, proveflaterFor, lagerT,
} from './karbon.js';
import { PRINSIPPER } from './tiltaksmotor.js';
import { TILTAKSTYPER, TRESLAG } from './model.js';
import { linje, fmt } from './charts.js';
import { signatur } from './versjon.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';
const idag = () => new Date().toISOString().slice(0, 10);
const kr = (v) => `${fmt(v)} kr`;
const FANENAVN = { pefc: 'PEFC', skogbrand: 'Skogbrand', tiltak: 'Tiltak' };
const STATUS_IKON = { ok: '✓', delvis: '◐', mangler: '✕', info: 'i' };
const lenke = (k) => (k.url ? `<a href="${esc(k.url)}" target="_blank" rel="noopener">${esc(k.navn)}</a>` : esc(k.navn));

export function initKarbon({ hentPlan, endret, melding, iAar, visFane, uthev, visBestander }) {
  let under = 'oversikt'; let cache = null; let cacheNokkel = '';
  const S = () => hentPlan();
  const K = () => sikreKarbon(S());
  const lagre = ({ kart = false } = {}) => { cache = null; endret({ kart }); tegn(); };
  // Scenarioene er dyre (motoren kjøres to ganger) – gjenbruk så lenge plan og forutsetninger er uendret.
  const sc = () => {
    const p = S().karbon?.prosjekt;
    const nokkel = JSON.stringify([S().planId, S().bestand.length, S().bestand.reduce((s, b) => s + (b.tiltak || []).length, 0), S().karbon?.innstillinger, p?.bestand, p?.status]);
    if (!cache || nokkel !== cacheNokkel) { cache = scenarioer(S(), { iAar, bestandIder: p?.bestand?.length ? p.bestand : null }); cacheNokkel = nokkel; }
    return cache;
  };
  const kpi = (verdi, etikett, under_) => `<div class="kpi"><div class="verdi">${verdi}</div><div class="etikett">${etikett}</div><div class="under">${under_}</div></div>`;

  // ---------- oversikt ----------
  function oversiktHtml() {
    const s = sc(); const e = egnethet(S(), { iAar }); const p = S().karbon?.prosjekt; const k = s.k;
    const varsler = karbonVarsler(S(), { iAar });
    const verdiAar = (s.kreditter * s.prisNok * (s.andel / 100)) / k.periodeAar;
    const lonnsom = s.karbonNv > s.tapTommerNv;
    return `<div class="kpi-rad">
        ${kpi(`${fmt(s.lagerNaa)} t`, 'CO₂ lagret i skogen i dag', `levende biomasse${p?.bestand?.length ? ', prosjektets bestand' : ''}`)}
        ${kpi(`${fmt(s.merSlutt)} t`, `merlager etter ${k.periodeAar} år`, `mot referansen «${esc(PRINSIPPER[k.referanse]?.navn || k.referanse)}»`)}
        ${kpi(fmt(s.kreditter), 'kreditter (t CO₂)', `≈ ${fmt(s.perAar)} per år etter fradrag og buffer`)}
        ${kpi(kr(verdiAar), 'karboninntekt per år', `${k.prisEur} €/t, ${s.andel} % til skogeier`)}
      </div>
      ${varsler.length ? `<div class="kort">${varsler.map((v) => `<div class="ksl-varsel ${v.nivaa === 'hoy' ? 'handling' : ''}"><b>${esc(v.tittel)}</b><span class="hint">${esc(v.tekst)}</span></div>`).join('')}</div>` : ''}
      <div class="kort">
        <h3>Lønner det seg?</h3>
        <p>Karbonforvaltning gir <b>${fmt(s.hogstRef - s.hogstProsjekt)} m³ mindre hogst</b> de neste ${k.periodeAar} årene. Nåverdien av tapt tømmerinntekt er <b>${kr(s.tapTommerNv)}</b>, mens karboninntekten etter kostnader har nåverdi <b>${kr(s.karbonNv)}</b> (${k.rente} % rente).</p>
        <p>${s.balansePrisEur ? `Karbonprisen må være minst <b>${fmt(s.balansePrisEur)} €/t</b> for å veie opp. ${lonnsom ? '✓ Med dagens forutsetninger lønner det seg.' : `Med ${k.prisEur} €/t gir prosjektet ${kr(s.karbonNv - s.tapTommerNv)} i nåverdi – det lønner seg ikke alene, men kan forsvares om du uansett ønsker å utsette hogsten.`}` : 'Prosjektet gir ingen kreditter med dagens forutsetninger.'}</p>
        <p class="hint">Tallene er anslag fra skogdataene og vekstmodellen. Ved et prosjekt bestemmer standarden referansen (VM0045: sammenlignbare flater i landsskogtakseringen), og lageret måles på permanente prøveflater.</p>
        <div class="knapperad"><button class="knapp primar" type="button" data-kb-gaa="scenario">Se scenarioene</button><button class="knapp" type="button" data-kb-gaa="egnethet">Egnethet (${Math.round(e.score * 100)} %)</button>${p ? '' : '<button class="knapp" type="button" data-kb-h="nytt">Start vurdering av prosjekt</button>'}</div>
      </div>
      <div class="kort">
        <h3>Slik blir skogen best egnet for karbonkreditter</h3>
        <ol class="karbon-liste">
          <li><b>Utsett hogst av eldre skog 10–20 år</b> utover økonomisk optimum (forlenget omløp). Det er det viktigste tiltaket, og grunnlaget for VM0045 og de nordiske gruppeprosjektene.</li>
          <li><b>Hogg mindre enn tilveksten</b> i prosjektperioden, og bruk lukket hogst der det passer – særlig på sumpskog og torv, der flatehogst frigjør karbon fra jorda.</li>
          <li><b>Forny raskt og tett</b> etter hogst: markberedning, planting året etter, plantetall i øvre del av tilrådd intervall og foredlede planter.</li>
          <li><b>Gjødsle eldre gran- og furuskog</b> ca. 10 år før hogst (1–2 m³/daa ekstra) – men ikke med klimatilskudd hvis bindingen skal selges.</li>
          <li><b>Reduser risikoen for tap</b>: hogg stormutsatt skog i tide, ungskogpleie og tynning for stabile trær, og ha forsikring. Tap trekkes fra bufferen.</li>
          <li><b>Mål og dokumenter</b>: permanente prøveflater, takst minst hvert 5. år, tiltak og hendelser i planen – det er grunnlaget for verifisering.</li>
        </ol>
        <p class="hint">Tiltaksmotoren har prinsippet «${esc(PRINSIPPER.karbon.navn)}», som gjør dette automatisk. Bestand i et aktivt karbonprosjekt får alltid karbonreglene.</p>
      </div>
      <div class="kort">
        <h3>Standarder og marked (oktober 2026)</h3>
        ${Object.values(KARBON_STANDARDER).map((st) => `<details class="karbon-std"><summary><b>${esc(st.kort)}</b> – ${esc(st.navn)}</summary><p><b>Status:</b> ${esc(st.status)}</p><p>${esc(st.tekst)}</p>${st.url ? `<p class="fotnote"><a href="${esc(st.url)}" target="_blank" rel="noopener">Kilde</a></p>` : ''}</details>`).join('')}
        <p class="hint"><b>Viktig:</b> ${esc(KARBON_KILDER.dobbelttelling.navn)}</p>
      </div>`;
  }

  // ---------- egnethet ----------
  function egnethetHtml() {
    const e = egnethet(S(), { iAar }); const sjekk = K().sjekk;
    return `<div class="kort"><h3>Egnethet for karbonkreditter – ${Math.round(e.score * 100)} %</h3>
      <p class="hint">Kravene bygger på ICVCMs kjerneprinsipper (addisjonalitet, permanens, robust måling, ingen dobbelttelling), Verra VM0045, EU CRCF og Landbruksdirektoratets veileder. Punktene med avkrysning må du bekrefte selv.</p>
      <div class="karbon-sjekk">${e.punkter.map((x) => `<div class="karbon-punkt ${x.status}">
        <span class="karbon-ikon" title="${esc(x.status)}">${STATUS_IKON[x.status]}</span>
        <div><b>${esc(x.tittel)}</b><div class="hint">${esc(x.tekst)}</div>
        ${x.manuell ? `<label class="avkrysning"><input type="checkbox" data-kb-sjekk="${x.id}" ${sjekk[x.id] ? 'checked' : ''}> Bekreftet</label>` : ''}
        ${x.fane ? `<a href="#" data-kb-gaa="${esc(x.fane)}">Åpne ${esc(FANENAVN[x.fane] || x.fane)}</a>` : ''}</div></div>`).join('')}</div>
      <p class="fotnote">Kilder: ${Object.values(KARBON_KILDER).map(lenke).join(' · ')}</p></div>`;
  }

  // ---------- scenario ----------
  function scenarioHtml() {
    const s = sc(); const k = s.k; const u = s.u;
    const inn = (id, tekst, verdi, steg = 1, ekstra = '') => `<label>${tekst}<input type="number" step="${steg}" data-kb-inn="${id}" value="${esc(verdi)}" ${ekstra}></label>`;
    const sel = (id, tekst, valg, verdi) => `<label>${tekst}<select data-kb-inn="${id}">${valg.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(verdi) ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
    const vis = s.rader.filter((_, i) => i % 5 === 0 || i === s.rader.length - 1);
    return `<div class="kort"><h3>Karbonlager: referanse og karbonforvaltning</h3>
      <div id="kbGraf" class="graf"></div>
      <p class="hint"><span class="farge-prikk" style="background:${css('--ts-f')}"></span>Referanse (${esc(PRINSIPPER[k.referanse]?.navn || '')}) · <span class="farge-prikk" style="background:${css('--ts-g')}"></span>${k.prosjektbane === 'plan' ? 'Tiltaksplanen slik den er' : 'Karbonforvaltning (tiltaksmotoren)'}. Lager i levende biomasse (t CO₂): gran ${String(KARBON_FAKTOR.G).replace('.', ',')}, furu ${String(KARBON_FAKTOR.F).replace('.', ',')} og lauv ${String(KARBON_FAKTOR.L).replace('.', ',')} t CO₂ per m³.</p>
      <div class="tabell-wrap"><table class="tabell"><thead><tr><th>År</th><th class="tall">Referanse t</th><th class="tall">Karbon t</th><th class="tall">Merlager t</th><th class="tall">Kreditter</th><th class="tall">Hogst ref. m³</th><th class="tall">Hogst karbon m³</th></tr></thead>
      <tbody>${vis.map((r) => { const i = s.rader.indexOf(r); const del = s.rader.slice(Math.max(0, i - 4), i + 1); return `<tr><td>${r.aar}</td><td class="tall">${fmt(r.ref)}</td><td class="tall">${fmt(r.prosjekt)}</td><td class="tall">${fmt(r.mer)}</td><td class="tall">${fmt(del.reduce((x, y) => x + y.kreditter, 0))}</td><td class="tall">${fmt(del.reduce((x, y) => x + y.refHogst, 0))}</td><td class="tall">${fmt(del.reduce((x, y) => x + y.prosjektHogst, 0))}</td></tr>`; }).join('')}</tbody>
      <tfoot><tr><td>Sum</td><td></td><td></td><td></td><td class="tall">${fmt(s.kreditter)}</td><td class="tall">${fmt(s.hogstRef)}</td><td class="tall">${fmt(s.hogstProsjekt)}</td></tr></tfoot></table></div>
      <p class="hint">Kreditter = økning i merlageret × (1 − ${k.lekkasje} % lekkasje) × (1 − ${fmt(u.fradrag, 1)} % usikkerhet), minus ${k.buffer} % til bufferpotten (${fmt(s.buffer)} t). ${esc(u.tekst)}</p>
      ${s.reversering > 0 ? `<div class="ksl-varsel"><b>Merlageret faller med ${fmt(s.reversering)} t etter ${s.toppAar}</b><span class="hint">Karbonbanen hogger senere i perioden. Kreditter som allerede er utstedt, må da dekkes av bufferen. Vurder å utsette hogsten til etter forpliktelsen, eller å holde av kreditter.</span></div>` : ''}</div>
      <div class="kort"><h3>Forutsetninger</h3>
        <div class="skjema tre-kol">
          ${sel('referanse', 'Referanse', Object.entries(PRINSIPPER).filter(([kk]) => kk !== 'karbon').map(([kk, p]) => [kk, p.navn]), k.referanse)}
          ${sel('prosjektbane', 'Prosjektbane', [['karbon', 'Karbonforvaltning (motor)'], ['plan', 'Tiltaksplanen slik den er']], k.prosjektbane)}
          ${inn('periodeAar', 'Kredittperiode (år)', k.periodeAar, 1, 'min="10" max="60"')}
          ${inn('forpliktelseAar', 'Forpliktelse (år)', k.forpliktelseAar, 1)}
          ${sel('lekkasje', 'Lekkasje (VM0045)', [[10, '10 % – ingen varig redusert hogst'], [20, '20 %'], [40, '40 %'], [70, '70 %']], k.lekkasje)}
          ${inn('buffer', 'Buffer (%)', k.buffer, 1)}
          ${inn('proveflater', 'Permanente prøveflater', k.proveflater, 1, 'min="0"')}
          ${inn('cv', 'Variasjon mellom flater (CV %)', k.cv, 1)}
          ${inn('prisEur', 'Pris (€/t CO₂)', k.prisEur, 1)}
          ${inn('eurNok', 'Kurs (kr/€)', k.eurNok, 0.1)}
          ${sel('modell', 'Organisering', [['gruppe', 'Gruppeprosjekt via aktør'], ['eget', 'Eget prosjekt']], k.modell)}
          ${k.modell === 'eget' ? `${inn('oppstartKost', 'Oppstart og validering (kr)', k.oppstartKost, 10000)}${inn('verifiseringKost', 'Per verifisering (kr)', k.verifiseringKost, 10000)}` : inn('andelSkogeier', 'Andel til skogeier (%)', k.andelSkogeier, 1)}
          ${inn('rente', 'Rente (%)', k.rente, 0.5)}
        </div>
        <p class="hint">Trenger ca. ${proveflaterFor(k, 10)} prøveflater for minste usikkerhetsfradrag (10 %). <a href="#" data-kb-h="nullstill">Tilbakestill forutsetningene</a></p></div>
      <div class="kort"><h3>Bidrag per bestand</h3>
        <p class="hint">Merlager ved periodens slutt. Bestand med størst bidrag er eldre skog der hogsten utsettes. ${s.utelukket.length ? `${s.utelukket.length} vernede bestand er holdt utenfor.` : ''}</p>
        <div class="tabell-wrap"><table class="tabell"><thead><tr><th>Bestand</th><th>Tre/bon.</th><th class="tall">Daa</th><th class="tall">Lager nå t</th><th class="tall">Merlager t</th><th>Hogst referanse</th><th>Hogst karbon</th></tr></thead>
        <tbody>${s.perBestand.slice(0, 40).map((x) => `<tr><td><a href="#" data-kb-best="${esc(x.b.id)}">${esc(x.b.nr)}</a></td><td>${esc(x.b.treslag || '')}${esc(x.b.bonitet || '')}</td><td class="tall">${fmt(x.b.areal, 1)}</td><td class="tall">${fmt(x.lagerNaa)}</td><td class="tall">${fmt(x.mer)}</td><td>${x.hogstRef.map((t) => `${TILTAKSTYPER[t.type]?.navn.split(' ')[0]} ${t.aar}`).join(', ') || '–'}</td><td>${x.hogstProsj.map((t) => `${TILTAKSTYPER[t.type]?.navn.split(' ')[0]} ${t.aar}`).join(', ') || '–'}</td></tr>`).join('')}</tbody></table></div>
        ${s.perBestand.length > 40 ? `<p class="hint">Viser 40 av ${s.perBestand.length}.</p>` : ''}</div>`;
  }

  // ---------- prosjekt ----------
  function prosjektHtml() {
    const p = S().karbon?.prosjekt;
    if (!p) {
      return `<div class="kort"><h3>Karbonprosjekt</h3><p>Et prosjekt samler bestandene som skal gi kreditter, avtalepartner, standard, periode og status. Når prosjektet er i forberedelse eller senere, får bestandene karbonreglene i tiltaksmotoren, og appen varsler om hogst som bryter forpliktelsen.</p>
        <div class="knapperad"><button class="knapp primar" type="button" data-kb-h="nytt">Opprett prosjekt</button></div></div>`;
    }
    const s = sc(); const ider = new Set(p.bestand || []);
    const iProsjekt = S().bestand.filter((b) => ider.has(b.id));
    const daa = iProsjekt.reduce((x, b) => x + (b.areal || 0), 0);
    const i = STATUS_REKKE.indexOf(p.status);
    const opsj = (liste, valgt) => liste.map(([v, t]) => `<option value="${esc(v)}" ${v === valgt ? 'selected' : ''}>${esc(t)}</option>`).join('');
    return `<div class="kort"><div class="detalj-topp"><h3>${esc(p.navn)}</h3><span class="merke-aktiv">${esc(PROSJEKTSTATUS[p.status].navn)}</span></div>
        <div class="karbon-steg">${STATUS_REKKE.map((st, j) => `<span class="${j < i ? 'ferdig' : j === i ? 'aktiv' : ''}" title="${esc(PROSJEKTSTATUS[st].tekst)}">${esc(PROSJEKTSTATUS[st].navn)}</span>`).join('')}</div>
        <p class="hint">${esc(PROSJEKTSTATUS[p.status].tekst)}</p>
        <div class="knapperad">${i > 0 ? `<button class="knapp" type="button" data-kb-status="${STATUS_REKKE[i - 1]}">← ${esc(PROSJEKTSTATUS[STATUS_REKKE[i - 1]].navn)}</button>` : ''}${i < STATUS_REKKE.length - 1 ? `<button class="knapp primar" type="button" data-kb-status="${STATUS_REKKE[i + 1]}">${esc(PROSJEKTSTATUS[STATUS_REKKE[i + 1]].navn)} →</button>` : ''}<button class="knapp" type="button" data-kb-h="skriv">Skriv ut prosjektbeskrivelse</button></div>
        <div class="skjema tre-kol">
          <label>Navn<input data-kb-p="navn" value="${esc(p.navn)}"></label>
          <label>Standard<select data-kb-p="standard">${opsj(Object.entries(KARBON_STANDARDER).map(([kk, st]) => [kk, st.kort]), p.standard)}</select></label>
          <label>Partner / kjøper<input data-kb-p="partner" value="${esc(p.partner)}" placeholder="Aktør eller kjøper"></label>
          <label>Startår<input type="number" data-kb-p="startAar" value="${esc(p.startAar)}"></label>
          <label>Avtale-/prosjekt-ID<input data-kb-p="prosjektId" value="${esc(p.prosjektId || '')}" placeholder="F.eks. VCS-ID"></label>
          <label>Kontaktperson<input data-kb-p="kontakt" value="${esc(p.kontakt || '')}"></label>
        </div>
        <label>Notater<textarea data-kb-p="notat" rows="2">${esc(p.notat || '')}</textarea></label>
      </div>
      <div class="kort"><h3>Bestand i prosjektet – ${iProsjekt.length} (${fmt(daa)} daa)</h3>
        <p class="hint">Merlageret er størst i eldre skog der hogsten utsettes. Vernede bestand og miljøfigurer kan ikke være med. Klikk «Vis i kart» for å se utvalget.</p>
        <div class="knapperad"><button class="knapp liten" type="button" data-kb-velg="bidrag">Bare bestand med merlager</button><button class="knapp liten" type="button" data-kb-velg="alle">Alle egnede</button><button class="knapp liten" type="button" data-kb-velg="ingen">Ingen</button><button class="knapp liten" type="button" data-kb-h="kart">Vis i kart</button></div>
        <div class="tabell-wrap karbon-bestand"><table class="tabell"><thead><tr><th></th><th>Bestand</th><th>Tre/bon.</th><th class="tall">Alder</th><th class="tall">Daa</th><th class="tall">Lager t</th><th>Merknad</th></tr></thead><tbody>
        ${S().bestand.map((b) => { const ut = utelukket(S(), b); return `<tr class="${ut ? 'dempet' : ''}"><td><input type="checkbox" data-kb-b="${esc(b.id)}" ${ider.has(b.id) ? 'checked' : ''} ${ut ? 'disabled' : ''}></td><td>${esc(b.nr)}</td><td>${esc(b.treslag || '')}${esc(b.bonitet || '')}</td><td class="tall">${fmt(b.alder)}</td><td class="tall">${fmt(b.areal, 1)}</td><td class="tall">${fmt(lagerT(b))}</td><td class="hint">${esc(ut || '')}</td></tr>`; }).join('')}
        </tbody></table></div>
      </div>
      <div class="kort"><h3>Karbontiltak i tiltaksplanen</h3>
        <p>Legger tiltaksmotorens karbonbane inn i tiltaksplanen for prosjektets bestand: utsatt hogst, lukket hogst på organisk jord, tett foryngelse og gjødsling. Manuelle og utførte tiltak beholdes.</p>
        <p class="hint">Karbonbanen gir ${fmt(s.hogstProsjekt)} m³ hogst i perioden mot ${fmt(s.hogstRef)} m³ i referansen.</p>
        <div class="knapperad"><button class="knapp primar" type="button" data-kb-h="tiltak">Legg karbontiltakene inn i planen</button><a href="#" data-kb-gaa="tiltak">Åpne tiltaksplanen</a></div>
      </div>`;
  }

  // ---------- oppfølging ----------
  function oppfolgingHtml() {
    const k = K(); const st = kredittstatus(S()); const varsler = karbonVarsler(S(), { iAar }); const inn = karbonInn(S());
    const verif = [...k.verifikasjoner].sort((a, b) => (b.aar || 0) - (a.aar || 0));
    const hend = [...k.hendelser].sort((a, b) => String(b.dato).localeCompare(String(a.dato)));
    return `<div class="kpi-rad">
        ${kpi(fmt(st.verifisert), 'verifisert t CO₂', `${verif.length} verifisering${verif.length === 1 ? '' : 'er'}`)}
        ${kpi(fmt(st.utstedt), 'kreditter utstedt', `${fmt(st.buffer)} t i buffer`)}
        ${kpi(fmt(st.beholdning), 'usolgte kreditter', `${fmt(st.solgt)} solgt`)}
        ${kpi(kr(st.inntekt), 'salgsinntekt', st.tap ? `⚠ ${fmt(st.tap)} t tapt i hendelser` : 'ingen registrerte tap')}
      </div>
      ${varsler.length ? `<div class="kort">${varsler.map((v) => `<div class="ksl-varsel ${v.nivaa === 'hoy' ? 'handling' : ''}"><b>${esc(v.tittel)}</b><span class="hint">${esc(v.tekst)}</span></div>`).join('')}</div>` : ''}
      <div class="kort"><h3>Verifiseringer</h3>
        <p class="hint">Prøveflatene måles og lageret verifiseres av tredjepart minst hvert ${inn.verifiseringHvertAar}. år. Registrer resultatet her – grunnlaget for utstedte kreditter.</p>
        <div class="tabell-wrap"><table class="tabell"><thead><tr><th>År</th><th>Verifikator</th><th class="tall">Verifisert t</th><th class="tall">Buffer t</th><th class="tall">Utstedt</th><th class="tall">Solgt</th><th class="tall">Pris kr/t</th><th></th></tr></thead><tbody>
        ${verif.map((v) => `<tr><td>${esc(v.aar)}</td><td>${esc(v.verifikator || '')}</td><td class="tall">${fmt(v.verifisertT)}</td><td class="tall">${fmt(v.bufferT)}</td><td class="tall">${fmt(v.utstedtT)}</td><td class="tall">${fmt(v.solgtT)}</td><td class="tall">${fmt(v.prisNok)}</td><td><button class="knapp liten" type="button" data-kb-slettv="${esc(v.id)}" title="Slett">✕</button></td></tr>`).join('') || '<tr><td colspan="8" class="hint">Ingen verifiseringer registrert.</td></tr>'}
        </tbody></table></div>
        <details class="kort-under"><summary>+ Ny verifisering</summary><div class="skjema tre-kol">
          <label>År<input type="number" id="kbvAar" value="${iAar}"></label><label>Verifikator<input id="kbvVer" placeholder="VVB"></label>
          <label>Verifisert t CO₂<input type="number" id="kbvT"></label><label>Buffer t<input type="number" id="kbvB"></label>
          <label>Utstedt<input type="number" id="kbvU"></label><label>Solgt<input type="number" id="kbvS"></label><label>Pris kr/t<input type="number" id="kbvP" value="${Math.round(inn.prisEur * inn.eurNok)}"></label>
        </div><button class="knapp primar" type="button" data-kb-h="ny-verif">Lagre verifisering</button></details>
      </div>
      <div class="kort"><h3>Hendelser og tap</h3>
        <p class="hint">Storm, brann, insekter, uplanlagt hogst eller salg av eiendommen skal meldes til standarden eller kjøperen. Tapet dekkes fra bufferen.</p>
        <div class="tabell-wrap"><table class="tabell"><thead><tr><th>Dato</th><th>Type</th><th class="tall">Tap t CO₂</th><th>Beskrivelse</th><th>Meldt</th><th></th></tr></thead><tbody>
        ${hend.map((h) => `<tr><td>${esc(h.dato)}</td><td>${esc(HENDELSESTYPER[h.type] || h.type)}</td><td class="tall">${fmt(h.tapT)}</td><td>${esc(h.beskrivelse || '')}</td><td><input type="checkbox" data-kb-meldt="${esc(h.id)}" ${h.meldt ? 'checked' : ''}></td><td><button class="knapp liten" type="button" data-kb-slettH="${esc(h.id)}" title="Slett">✕</button></td></tr>`).join('') || '<tr><td colspan="6" class="hint">Ingen hendelser.</td></tr>'}
        </tbody></table></div>
        <details class="kort-under"><summary>+ Ny hendelse</summary><div class="skjema tre-kol">
          <label>Dato<input type="date" id="kbhDato" value="${idag()}"></label>
          <label>Type<select id="kbhType">${Object.entries(HENDELSESTYPER).map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}</select></label>
          <label>Tap t CO₂<input type="number" id="kbhTap"></label><label>Beskrivelse<input id="kbhBesk"></label>
        </div><button class="knapp primar" type="button" data-kb-h="ny-hendelse">Lagre hendelse</button></details>
        <p class="hint">Skader registrert i fanen Skogbrand kan gi tap i prosjektets bestand. <a href="#" data-kb-gaa="skogbrand">Åpne Skogbrand</a></p>
      </div>`;
  }

  // ---------- utskrift ----------
  function skrivUt() {
    const plan = S(); const p = plan.karbon?.prosjekt; const s = sc(); const e = egnethet(plan, { iAar }); const k = s.k;
    const ider = new Set(p?.bestand || []); const best = plan.bestand.filter((b) => ider.has(b.id));
    const st = KARBON_STANDARDER[p?.standard] || KARBON_STANDARDER.frivillig;
    const kropp = `<h1>Prosjektbeskrivelse – ${esc(p?.navn || 'Karbonvurdering')}</h1>
      <p class="hint">${esc(plan.eiendom?.navn || '')} · ${esc(plan.eiendom?.gnrbnr || '')} · skrevet ut ${new Date().toLocaleDateString('nb-NO')} · utkast til bruk mot partner/validering</p>
      <h2>1. Prosjektet</h2><table><tbody>
        <tr><th>Status</th><td>${esc(PROSJEKTSTATUS[p?.status || 'vurdering'].navn)}</td></tr>
        <tr><th>Standard</th><td>${esc(st.navn)}</td></tr><tr><th>Partner</th><td>${esc(p?.partner || '–')}</td></tr>
        <tr><th>Startår / kredittperiode / forpliktelse</th><td>${esc(p?.startAar || iAar)} / ${k.periodeAar} år / ${k.forpliktelseAar} år</td></tr>
        <tr><th>Areal</th><td>${best.length} bestand, ${fmt(best.reduce((x, b) => x + (b.areal || 0), 0), 1)} daa produktiv skog</td></tr></tbody></table>
      <h2>2. Prosjektaktivitet</h2><p>Forbedret skogforvaltning (IFM): forlenget omløp (+20 år), avvirkning under tilveksten, lukket hogst på organisk jord, rask og tett foryngelse og gjødsling uten statlig tilskudd. Stormutsatt skog hogges før den blåser ned for å begrense tap.</p>
      <h2>3. Referanse og kvantifisering</h2><p>Referanse: tiltaksmotorens prinsipp «${esc(PRINSIPPER[k.referanse]?.navn)}» (vanlig drift i regionen). Lager i levende biomasse over og under bakken: gran ${KARBON_FAKTOR.G}, furu ${KARBON_FAKTOR.F}, lauv ${KARBON_FAKTOR.L} t CO₂ per m³ stammevolum. Dødt trevirke, jord og treprodukter er holdt utenfor (konservativt).</p>
      <table><thead><tr><th>År</th><th>Referanse t CO₂</th><th>Prosjekt t CO₂</th><th>Merlager t</th></tr></thead><tbody>${s.rader.filter((_, i) => i % 5 === 0 || i === s.rader.length - 1).map((r) => `<tr><td>${r.aar}</td><td>${fmt(r.ref)}</td><td>${fmt(r.prosjekt)}</td><td>${fmt(r.mer)}</td></tr>`).join('')}</tbody></table>
      <p>Fradrag: lekkasje ${k.lekkasje} %, usikkerhet ${fmt(s.u.fradrag, 1)} % (${esc(s.u.tekst)}), buffer ${k.buffer} %. Anslått <b>${fmt(s.kreditter)} kreditter</b> over ${k.periodeAar} år.</p>
      <h2>4. Addisjonalitet, permanens og dobbelttelling</h2><ul>
        <li>Lov- og PEFC-krav (foryngelsesplikt, nøkkelbiotoper, kantsoner, livsløpstrær, ikke nygrøfting) inngår i referansen. ${s.utelukket.length} vernede bestand er holdt utenfor.</li>
        <li>Tiltak med statlig klimatilskudd (gjødsling 40 %, tettere planting 30 %) gir ikke kreditter.</li>
        <li>Forpliktelse i ${k.forpliktelseAar} år, ${k.buffer} % buffer, tap meldes og trekkes fra bufferen.</li>
        <li>${esc(KARBON_KILDER.dobbelttelling.navn)}</li>
        <li>${esc(KARBON_KILDER.ldir.navn)}</li></ul>
      <h2>5. Egnethet</h2><table><tbody>${e.punkter.map((x) => `<tr><td>${STATUS_IKON[x.status]}</td><th>${esc(x.tittel)}</th><td>${esc(x.tekst)}</td></tr>`).join('')}</tbody></table>
      <h2>6. Overvåking</h2><p>Permanente prøveflater måles minst hvert ${k.verifiseringHvertAar}. år, og lageret verifiseres av uavhengig tredjepart. Tiltak, hogst og skader føres i skogbruksplanen (SkogIQ.ai).</p>
      <h2>7. Bestand</h2><table><thead><tr><th>Bestand</th><th>Treslag</th><th>Bonitet</th><th>Alder</th><th>Daa</th><th>m³/daa</th><th>Lager t CO₂</th></tr></thead><tbody>${best.map((b) => `<tr><td>${esc(b.nr)}</td><td>${esc(TRESLAG[b.treslag] || '')}</td><td>${esc(b.bonitet || '')}</td><td>${fmt(b.alder)}</td><td>${fmt(b.areal, 1)}</td><td>${fmt(b.volumDaa, 1)}</td><td>${fmt(lagerT(b))}</td></tr>`).join('')}</tbody></table>`;
    const w = window.open('', '_blank'); if (!w) { melding('Nettleseren blokkerte utskriftsvinduet.'); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Prosjektbeskrivelse karbon</title><style>body{font:12px/1.45 system-ui,sans-serif;max-width:1000px;margin:20px auto;padding:0 16px;color:#111}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:18px 0 6px}table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #bbb;padding:3px 5px;text-align:left;vertical-align:top}th{background:#f1f1ee}.hint{color:#555}@media print{h2{break-after:avoid}tr{break-inside:avoid}}</style>${kropp}<p class="hint" style="margin-top:18px">Laget med ${esc(signatur())}. Anslagene erstatter ikke måling og verifisering etter standarden.</p><script>setTimeout(()=>print(),400)<\/script>`);
    w.document.close();
  }

  // ---------- tegning ----------
  function tegn() {
    const el = $('#karbonInnhold'); if (!el) return;
    $$('#karbonUnder [data-kb-under]').forEach((b) => b.classList.toggle('aktiv', b.dataset.kbUnder === under));
    el.innerHTML = under === 'egnethet' ? egnethetHtml() : under === 'scenario' ? scenarioHtml() : under === 'prosjekt' ? prosjektHtml() : under === 'oppfolging' ? oppfolgingHtml() : oversiktHtml();
    if (under === 'scenario') {
      const s = sc();
      linje($('#kbGraf'), { x: s.aar, serier: [{ navn: 'Referanse', verdier: s.rader.map((r) => r.ref), farge: css('--ts-f') }, { navn: 'Karbon', verdier: s.rader.map((r) => r.prosjekt), farge: css('--ts-g') }], enhet: 't CO₂' });
    }
    const p = S().karbon?.prosjekt;
    uthev(under === 'prosjekt' && p ? p.bestand : []);
  }

  // ---------- hendelser ----------
  $('#karbonUnder').addEventListener('click', (e) => { const b = e.target.closest('[data-kb-under]'); if (b) { under = b.dataset.kbUnder; tegn(); } });
  const panel = $('#karbonInnhold');
  panel.addEventListener('click', (e) => {
    const gaa = e.target.closest('[data-kb-gaa]');
    if (gaa) { e.preventDefault(); const m = gaa.dataset.kbGaa; if (['scenario', 'egnethet', 'prosjekt', 'oppfolging'].includes(m)) { under = m; tegn(); } else visFane(m); return; }
    const best = e.target.closest('[data-kb-best]');
    if (best) { e.preventDefault(); visBestander([best.dataset.kbBest]); return; }
    const status = e.target.closest('[data-kb-status]')?.dataset.kbStatus;
    if (status) {
      settStatus(S(), status);
      if (status === 'forberedelse') melding('Prosjektets bestand får nå karbonreglene i tiltaksmotoren. Legg karbontiltakene inn i planen under.');
      lagre(); return;
    }
    const velg = e.target.closest('[data-kb-velg]')?.dataset.kbVelg;
    if (velg) {
      const p = K().prosjekt;
      if (velg === 'ingen') p.bestand = [];
      else if (velg === 'alle') p.bestand = S().bestand.filter((b) => !utelukket(S(), b)).map((b) => b.id);
      else { const alle = scenarioer(S(), { iAar }); p.bestand = alle.perBestand.filter((x) => x.mer > 1).map((x) => x.b.id); }
      lagre({ kart: true }); return;
    }
    const slettV = e.target.closest('[data-kb-slettv]')?.dataset.kbSlettv;
    if (slettV && confirm('Slette verifiseringen?')) { K().verifikasjoner = K().verifikasjoner.filter((v) => v.id !== slettV); lagre(); return; }
    const slettH = e.target.closest('[data-kb-slettH]')?.dataset.kbSletth;
    if (slettH && confirm('Slette hendelsen?')) { K().hendelser = K().hendelser.filter((h) => h.id !== slettH); lagre(); return; }
    const h = e.target.closest('[data-kb-h]')?.dataset.kbH; if (!h) return;
    e.preventDefault();
    if (h === 'nytt') { nyttProsjekt(S(), { iAar }); under = 'prosjekt'; melding('Prosjekt opprettet med alle egnede bestand. Juster utvalget og forutsetningene.'); lagre(); }
    else if (h === 'skriv') skrivUt();
    else if (h === 'kart') { const p = K().prosjekt; if (p?.bestand?.length) visBestander(p.bestand); }
    else if (h === 'nullstill') { K().innstillinger = {}; lagre(); }
    else if (h === 'tiltak') {
      if (!confirm('Erstatte de automatiske, planlagte tiltakene i prosjektets bestand med karbontiltak? Manuelle og utførte tiltak beholdes.')) return;
      const n = brukKarbontiltak(S(), { iAar }); melding(`${n} karbontiltak lagt inn i tiltaksplanen.`); lagre({ kart: true });
    } else if (h === 'ny-verif') {
      const tall = (id) => (($(id).value === '') ? null : Number($(id).value));
      if (!tall('#kbvT')) { melding('Fyll inn verifisert mengde.'); return; }
      nyVerifikasjon(S(), { aar: tall('#kbvAar'), verifikator: $('#kbvVer').value.trim(), verifisertT: tall('#kbvT'), bufferT: tall('#kbvB'), utstedtT: tall('#kbvU'), solgtT: tall('#kbvS'), prisNok: tall('#kbvP'), dato: idag() });
      melding('Verifisering lagret.'); lagre();
    } else if (h === 'ny-hendelse') {
      nyHendelse(S(), { dato: $('#kbhDato').value, type: $('#kbhType').value, tapT: Number($('#kbhTap').value) || 0, beskrivelse: $('#kbhBesk').value.trim() });
      melding('Hendelse registrert. Husk å melde den til standarden/kjøper.'); lagre();
    }
  });
  panel.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.kbInn) {
      const k = K(); const v = t.type === 'number' ? Number(t.value) : t.value;
      const tallfelt = typeof STANDARD_KARBON[t.dataset.kbInn] === 'number';
      k.innstillinger[t.dataset.kbInn] = tallfelt ? Number(v) : v; lagre(); return;
    }
    if (t.dataset.kbSjekk) { K().sjekk[t.dataset.kbSjekk] = t.checked; lagre(); return; }
    if (t.dataset.kbP) { const p = K().prosjekt; p[t.dataset.kbP] = t.dataset.kbP === 'startAar' ? Number(t.value) : t.value; endret({ kart: false }); return; }
    if (t.dataset.kbB) {
      const p = K().prosjekt; const ider = new Set(p.bestand || []);
      if (t.checked) ider.add(t.dataset.kbB); else ider.delete(t.dataset.kbB);
      p.bestand = S().bestand.filter((b) => ider.has(b.id)).map((b) => b.id); cache = null; endret({ kart: false }); uthev(p.bestand);
      const h3 = t.closest('.kort')?.querySelector('h3'); if (h3) h3.textContent = `Bestand i prosjektet – ${p.bestand.length} (${fmt(S().bestand.filter((b) => ider.has(b.id)).reduce((x, b) => x + (b.areal || 0), 0))} daa)`;
      return;
    }
    if (t.dataset.kbMeldt) { const hh = K().hendelser.find((x) => x.id === t.dataset.kbMeldt); if (hh) hh.meldt = t.checked; lagre(); }
  });

  return {
    vis: () => { cache = null; tegn(); },
    oppdater: () => { cache = null; if (!$('#fane-karbon')?.hidden) tegn(); },
    varsler: () => { try { return karbonVarsler(S(), { iAar }); } catch { return []; } },
    sammendrag: () => { try { return sc(); } catch { return null; } },
    skjul: () => uthev([]),
  };
}
