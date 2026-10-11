"use strict";

// Børsradar – viser analysen fra data/analyse.json (lages av analyse/analyser.mjs)

const LAGRING = "borsradar.portefolje.v1";
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const tall = (x, des = 2) => (x == null || !Number.isFinite(x) ? "–" : x.toLocaleString("nb-NO", { minimumFractionDigits: des, maximumFractionDigits: des }));
const pst = (x, des = 1, fortegn = true) => (x == null || !Number.isFinite(x) ? "–" : `${fortegn && x > 0 ? "+" : ""}${tall(x * 100, des)} %`);
const fargeKlasse = (x) => (x > 0 ? "opp" : x < 0 ? "ned" : "");

const SIGNALTEKST = { KJØP: "Kjøp", HOLD: "Hold", SELG: "Selg" };
const HORISONTNAVN = { samlet: "Samlet", kort: "Kort sikt", lang: "Lang sikt" };
const TYPENAVN = {
  innsidekjøp: "Innsidekjøp", innsidesalg: "Innsidesalg", tilbakekjøp: "Tilbakekjøp", innside: "Innsidemelding",
  rapport: "Rapport", innsideinformasjon: "Børsmelding", flagging: "Eierskifte", melding: "Melding",
  kontrakt: "Kontrakt", emisjon: "Emisjon", varsel: "Varsel", oppkjøp: "Oppkjøp",
};
const TYPEFARGE = { innsidekjøp: "KJØP", kontrakt: "KJØP", oppkjøp: "KJØP", tilbakekjøp: "KJØP", innsidesalg: "SELG", emisjon: "SELG", varsel: "SELG" };
const NEWSWEB = (id) => `https://newsweb.oslobors.no/message/${encodeURIComponent(id)}`;

let data = null;
let filter = { horisont: "samlet", signal: "alle", sektor: "", sok: "" };
let testValg = "kort";

// ---------- Portefølje (localStorage) ----------

function lesPortefolje() {
  try {
    const p = JSON.parse(localStorage.getItem(LAGRING) || "[]");
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function lagrePortefolje(p) {
  try {
    localStorage.setItem(LAGRING, JSON.stringify(p));
  } catch {
    /* privat modus o.l. – porteføljen lever bare til siden lukkes */
  }
}

let portefolje = lesPortefolje();
const eier = (t) => portefolje.some((p) => p.t === t);
const finn = (t) => data.aksjer.find((a) => a.t === t);

// ---------- Oppstart ----------

async function start() {
  try {
    const svar = await fetch("data/analyse.json", { cache: "no-cache" });
    if (!svar.ok) throw new Error(`HTTP ${svar.status}`);
    data = await svar.json();
  } catch (feil) {
    $("#liste").innerHTML = `<p class="tom">Klarte ikke å laste analysen (${esc(feil.message)}).</p>`;
    return;
  }

  const d = new Date(data.generert);
  $("#oppdatert").textContent = `${d.toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })} (kurser fra ${data.handelsdag})`;
  const ix = data.indeks;
  $("#indeks").innerHTML = `OSEBX <b class="tall">${tall(ix.verdi)}</b> <span class="${fargeKlasse(ix.endringDag)}">${pst(ix.endringDag, 2)}</span><br>
    12 mnd ${pst(ix.mom12)} · ${ix.overSma200 ? "markedet i stigende trend" : "markedet i fallende trend"}`;

  const sektorer = [...new Set(data.aksjer.map((a) => a.sektor))].sort((a, b) => a.localeCompare(b, "nb"));
  $("#sektor").insertAdjacentHTML("beforeend", sektorer.map((s) => `<option>${esc(s)}</option>`).join(""));
  $("#tickerliste").innerHTML = data.aksjer.map((a) => `<option value="${esc(a.t)}">${esc(a.navn)}</option>`).join("");

  visOppsummering();
  visListe();
  visMarked();
  visUke();
  visPortefolje();
  visTest();
  visMetode();
  importerFraLenke();
}

// ---------- Signaler ----------

function visOppsummering() {
  const h = filter.horisont;
  const n = (s) => data.aksjer.filter((a) => a[h].signal === s).length;
  $("#oppsummering").innerHTML = ["KJØP", "HOLD", "SELG"]
    .map((s) => `<div class="teller ${s}"><div class="n">${n(s)}</div><div class="l">${SIGNALTEKST[s]} · ${HORISONTNAVN[h].toLowerCase()}</div></div>`)
    .join("");
}

const merke = (s, score, liten = "") => `<span class="merke ${s}${liten ? " liten" : ""}">${liten ? `<em>${liten}</em>` : ""}${SIGNALTEKST[s]}<small>${tall(score, 0)}</small></span>`;

function ikoner(a) {
  const n = a.nokkel, ut = [];
  if (n.innsideKjop90 > 0) ut.push(`<span title="Innsidekjøp siste 90 dager">🟢 innsidekjøp</span>`);
  if (n.innsideSalg90 >= 2) ut.push(`<span title="Innsidesalg siste 90 dager">🔴 innsidesalg</span>`);
  const nr = a.analytikere?.nesteRapport;
  if (nr && nr >= data.handelsdag && nr <= leggTilDager(data.handelsdag, 21)) ut.push(`<span title="Kvartalsrapport snart">📅 rapport ${esc(nr.slice(5).split("-").reverse().join("."))}</span>`);
  return ut.join(" ");
}

function leggTilDager(dato, n) {
  return new Date(new Date(dato).getTime() + n * 86400e3).toISOString().slice(0, 10);
}

function radHtml(a) {
  const ik = ikoner(a);
  return `<button class="rad" data-t="${esc(a.t)}">
    <div>
      <div class="navn">${eier(a.t) ? "★ " : ""}${esc(a.navn)} <span class="mono dempet">${esc(a.t)}</span></div>
      <div class="info">${esc(a.sektor)} · 12 mnd ${pst(a.nokkel.mom12_1, 0)}${ik ? ` · ${ik}` : ""}</div>
      <div class="scorebar"><i style="width:${a[filter.horisont].score}%"></i></div>
    </div>
    <div class="kurs tall">${tall(a.kurs)}<small class="${fargeKlasse(a.endringDag)}">${pst(a.endringDag, 2)}</small></div>
    <div class="merker">${merke(a.kort.signal, a.kort.score, "Kort")}${merke(a.lang.signal, a.lang.score, "Lang")}</div>
  </button>`;
}

function visListe() {
  const sok = filter.sok.trim().toLowerCase();
  const h = filter.horisont;
  const rader = data.aksjer
    .filter(
      (a) =>
        (filter.signal === "alle" || a[h].signal === filter.signal) &&
        (!filter.sektor || a.sektor === filter.sektor) &&
        (!sok || a.t.toLowerCase().includes(sok) || a.navn.toLowerCase().includes(sok)),
    )
    .sort((x, y) => y[h].score - x[h].score);
  $("#liste").innerHTML = rader.length ? rader.map(radHtml).join("") : `<p class="tom">Ingen aksjer passer filteret.</p>`;
}

function velgChip(gruppe, knapp) {
  document.querySelectorAll(`${gruppe} button`).forEach((x) => x.classList.toggle("aktiv", x === knapp));
}

$("#horisont").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  filter.horisont = b.dataset.h;
  velgChip("#horisont", b);
  visOppsummering();
  visListe();
});
$("#signalfilter").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  filter.signal = b.dataset.s;
  velgChip("#signalfilter", b);
  visListe();
});
$("#sektor").addEventListener("change", (e) => { filter.sektor = e.target.value; visListe(); });
$("#sok").addEventListener("input", (e) => { filter.sok = e.target.value; visListe(); });

document.addEventListener("click", (e) => {
  const rad = e.target.closest("[data-t]");
  if (rad && !e.target.closest("[data-slett]")) visDetalj(rad.dataset.t);
});

// ---------- Faner ----------

document.querySelector(".faner").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-fane]");
  if (!b) return;
  document.querySelectorAll(".faner button").forEach((x) => x.classList.toggle("aktiv", x === b));
  document.querySelectorAll(".fane").forEach((f) => (f.hidden = f.id !== `fane-${b.dataset.fane}`));
});

// ---------- Graf ----------

function linjegraf(serier, datoer, { hoyde = 220, prosent = false, logaritmisk = false } = {}) {
  const B = 700, H = hoyde, ml = 8, mr = 56, mt = 10, mb = 22;
  const tf = (v) => (logaritmisk ? Math.log(v) : v);
  const alle = serier.flatMap((s) => s.verdier).filter((v) => v != null && (!logaritmisk || v > 0)).map(tf);
  let min = Math.min(...alle), max = Math.max(...alle);
  const pad = (max - min) * 0.06 || 1;
  min -= pad; max += pad;
  const x = (i) => ml + (i / (datoer.length - 1)) * (B - ml - mr);
  const y = (v) => mt + (1 - (tf(v) - min) / (max - min)) * (H - mt - mb);
  const linjer = serier
    .map((s) => {
      let d = "", ny = true;
      s.verdier.forEach((v, i) => {
        if (v == null) { ny = true; return; }
        d += `${ny ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        ny = false;
      });
      return `<path d="${d}" fill="none" stroke="${s.farge}" stroke-width="${s.bredde || 1.6}" stroke-linejoin="round"${s.stiplet ? ' stroke-dasharray="4 3"' : ""}/>`;
    })
    .join("");
  let rutenett = "";
  for (let k = 0; k <= 4; k++) {
    const tv = min + ((max - min) * k) / 4;
    const v = logaritmisk ? Math.exp(tv) : tv;
    const yy = mt + (1 - k / 4) * (H - mt - mb);
    const etikett = prosent ? `${tall((v - 1) * 100, 0)} %` : tall(v, v > 100 ? 0 : 1);
    rutenett += `<line class="rutenett" x1="${ml}" x2="${B - mr}" y1="${yy}" y2="${yy}"/><text x="${B - mr + 6}" y="${yy + 4}">${etikett}</text>`;
  }
  const etiketter = [0, Math.floor(datoer.length / 2), datoer.length - 1]
    .map((i, k) => `<text x="${x(i)}" y="${H - 5}" text-anchor="${["start", "middle", "end"][k]}">${esc(datoer[i])}</text>`)
    .join("");
  return `<svg class="graf" viewBox="0 0 ${B} ${H}" role="img">${rutenett}${linjer}${etiketter}</svg>`;
}

const cssFarge = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

// ---------- Detaljvisning ----------

function driverHtml(drivere) {
  const maks = Math.max(...drivere.map((d) => Math.abs(d.bidrag)), 1);
  return drivere
    .filter((d) => Math.abs(d.bidrag) >= 0.5)
    .slice(0, 7)
    .map(
      (d) => `<div class="driver">
        <span>${esc(d.navn)} <small class="dempet">${esc(d.verdi)}</small></span>
        <div class="tobar"><i class="${d.bidrag >= 0 ? "pos" : "neg"}" style="width:${(Math.abs(d.bidrag) / maks) * 50}%"></i></div>
      </div>`,
    )
    .join("");
}

function modellboks(a, k) {
  const m = a[k];
  const mod = data.modeller[k];
  return `<div class="modellboks">
    <div class="modelltopp"><div><b>${esc(mod.navn)}</b><br><small class="dempet">${esc(mod.horisont)}</small></div>${merke(m.signal, m.score)}</div>
    <p class="hjelp" style="margin:6px 0">Kurs og nyheter ${tall(m.testetScore, 0)}${m.analytikerScore != null ? ` · analytikere og nøkkeltall ${tall(m.analytikerScore, 0)}` : ""}</p>
    ${driverHtml(m.drivere)}
  </div>`;
}

function nyhetsliste(nyheter) {
  if (!nyheter?.length) return `<p class="tom">Ingen børsmeldinger funnet.</p>`;
  return `<ul class="nyheter">${nyheter
    .map(
      (n) => `<li><span class="dato mono">${esc(n.dato.slice(5).split("-").reverse().join("."))}</span>
        <span class="type ${TYPEFARGE[n.type] || ""}">${esc(TYPENAVN[n.type] || n.type)}</span>
        <a href="${NEWSWEB(n.id)}" target="_blank" rel="noopener">${esc(n.tittel)}</a></li>`,
    )
    .join("")}</ul>`;
}

function analytikerHtml(an, kurs) {
  if (!an || (!an.antall && an.revisjon90 == null)) return `<p class="tom">Ingen analytikerdekning funnet.</p>`;
  const anb = an.anbefaling;
  const fordeling = anb ? `${anb.kjop} kjøp · ${anb.hold} hold · ${anb.selg} selg` : "–";
  const n = (l, v) => `<div><span>${l}</span><b>${v}</b></div>`;
  return `<div class="nokkel">
    ${n("Anbefalinger", fordeling)}
    ${n("Kursmål (snitt)", an.kursmal ? `${tall(an.kursmal, 0)} (${pst(an.oppside, 0)})` : "–")}
    ${n("Estimatendring 90 d", pst(an.revisjon90))}
    ${n("Estimatendring 30 d", pst(an.revisjon30))}
    ${n("Siste resultat mot estimat", pst(an.sisteOverraskelse, 0))}
    ${n("Neste rapport", an.nesteRapport ? esc(an.nesteRapport.split("-").reverse().join(".")) : "–")}
  </div>`;
}

function visDetalj(ticker) {
  const a = finn(ticker);
  if (!a) return;
  const graf = linjegraf(
    [
      { verdier: a.graf.sma200, farge: cssFarge("--sma200"), bredde: 1.4 },
      { verdier: a.graf.sma50, farge: cssFarge("--sma50"), bredde: 1.4 },
      { verdier: a.graf.kurs, farge: cssFarge("--kurs"), bredde: 1.8 },
    ],
    a.graf.datoer,
  );
  const n = (label, verdi) => `<div><span>${label}</span><b>${verdi}</b></div>`;
  const liste = (l) => (l.length ? `<ul>${l.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="tom">Ingen</p>`);
  const k = a.nokkel;

  $("#detaljInnhold").innerHTML = `
    <div class="detalj-topp">
      <div>
        <h2>${esc(a.navn)} <span class="mono dempet" style="font-weight:400">${esc(a.t)}</span></h2>
        <div class="tall" style="font-size:20px">${tall(a.kurs)} ${esc(a.valuta)} <span class="${fargeKlasse(a.endringDag)}" style="font-size:14px">${pst(a.endringDag, 2)}</span></div>
        <small class="dempet">${esc(a.sektor)}</small>
      </div>
      <div style="display:flex;gap:8px;align-items:flex-start">
        ${merke(a.samlet.signal, a.samlet.score, "Samlet")}
        <button class="lukk" aria-label="Lukk">×</button>
      </div>
    </div>
    ${graf}
    <div class="forklaring"><span><i style="background:var(--kurs)"></i>Kurs</span><span><i style="background:var(--sma50)"></i>50-dagers snitt</span><span><i style="background:var(--sma200)"></i>200-dagers snitt</span></div>
    <div class="grunner">
      <div><h3 class="opp">Taler for</h3>${liste(a.begrunnelse.pluss)}</div>
      <div><h3 class="ned">Taler mot</h3>${liste(a.begrunnelse.minus)}</div>
    </div>
    <h3>Hva driver scoren</h3>
    <p class="hjelp">Grønt trekker opp, rødt trekker ned. Tallet etter navnet er aksjens verdi.</p>
    <div class="modeller">${modellboks(a, "kort")}${modellboks(a, "lang")}</div>
    ${a.uke ? `<div class="modellboks" style="margin-top:10px">
      <div class="modelltopp"><div><b>Ukesvalg</b><br><small class="dempet">1 uke · plass ${a.uke.plass} av ${data.aksjer.filter((x) => x.uke).length}</small></div>
      ${a.uke.valgt ? `<span class="merke KJØP">Valgt<small>${tall(a.uke.score, 0)}</small></span>` : `<span class="merke HOLD">Ikke valgt<small>${tall(a.uke.score, 0)}</small></span>`}</div>
      ${driverHtml(a.uke.drivere)}</div>` : ""}
    <h3>Siste børsmeldinger</h3>
    ${nyhetsliste(a.nyheter)}
    <h3>Analytikere</h3>
    ${analytikerHtml(a.analytikere, a.kurs)}
    <h3>Nøkkeltall</h3>
    <div class="nokkel">
      ${n("1 mnd", pst(k.mom1))}${n("3 mnd", pst(k.mom3))}${n("6 mnd", pst(k.mom6))}${n("12 mnd (uten siste mnd)", pst(k.mom12_1))}
      ${n("Mot OSEBX 6 mnd", pst(k.relStyrke6m))}${n("Sektoren 6 mnd", pst(k.sektorMom))}${n("Fra 52-ukers topp", pst(k.fraTopp))}${n("RSI (14 d)", tall(k.rsi14, 0))}
      ${n("Svingninger (år)", pst(k.vol60, 0, false))}${n("Følsomhet olje", tall(k.betaOlje, 2))}${n("Følsomhet USD", tall(k.betaUsd, 2))}${n("Omsetning/dag", `${tall(k.omsetningMNOK, 1)} MNOK`)}
      ${n("P/E", tall(a.fund.pe, 1))}${n("P/B", tall(a.fund.pb, 2))}${n("Direkteavkastning", pst(a.fund.utbytte, 1, false))}${n("Egenkapitalavk.", pst(a.fund.roe, 0, false))}
      ${n("Markedsverdi", a.fund.markedsverdiMrd == null ? "–" : `${tall(a.fund.markedsverdiMrd, 1)} mrd`)}${n("Innsidekjøp / salg 90 d", `${k.innsideKjop90} / ${k.innsideSalg90}`)}
    </div>
    <div class="detalj-knapper">
      <button class="knapp ${eier(a.t) ? "sekundar" : ""}" id="eierKnapp">${eier(a.t) ? "Fjern fra porteføljen" : "★ Jeg eier denne"}</button>
      <a class="knapp sekundar lenkeknapp" href="https://newsweb.oslobors.no/search?issuer=${encodeURIComponent(a.t)}" target="_blank" rel="noopener">Alle børsmeldinger ↗</a>
      <a class="knapp sekundar lenkeknapp" href="https://finance.yahoo.com/quote/${encodeURIComponent(a.t)}.OL" target="_blank" rel="noopener">Yahoo Finance ↗</a>
    </div>`;

  const dlg = $("#detalj");
  dlg.querySelector(".lukk").onclick = () => dlg.close();
  $("#eierKnapp").onclick = () => {
    if (eier(a.t)) portefolje = portefolje.filter((p) => p.t !== a.t);
    else portefolje.push({ t: a.t });
    lagrePortefolje(portefolje);
    visPortefolje();
    visListe();
    visDetalj(a.t);
  };
  if (!dlg.open) dlg.showModal();
  dlg.querySelector(".detalj-innhold").scrollTop = 0;
}

$("#detalj").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.currentTarget.close(); // klikk utenfor lukker
});

// ---------- Ukesvalg ----------

function visUke() {
  const u = data.ukesvalg;
  if (!u) return;
  const t = u.test, m = u.modell;
  const kort = (a) => {
    const ny = u.nye.includes(a.t);
    const nr = a.analytikere?.nesteRapport;
    const rapport = nr && nr >= data.handelsdag && nr <= leggTilDager(data.handelsdag, 8);
    return `<div class="beholdning KJØP">
      <div class="beholdning-topp">
        <div class="rad-klikk" data-t="${esc(a.t)}">
          <span class="handlingsmerke ${ny ? "KJØP" : "HOLD"}">${ny ? "Ny denne uka" : "Beholdes"}</span>
          <b>${esc(a.navn)}</b> <span class="mono dempet">${esc(a.t)}</span>
          <div class="hjelp" style="margin:2px 0 0">${esc(a.sektor)} · ${tall(a.kurs)} ${esc(a.valuta)} <span class="${fargeKlasse(a.endringDag)}">${pst(a.endringDag, 1)}</span> · 12 mnd ${pst(a.nokkel.mom12_1, 0)}</div>
        </div>
        <span class="merke KJØP">Plass ${a.uke.plass}<small>${tall(a.uke.score, 0)}</small></span>
      </div>
      ${driverHtml(a.uke.drivere)}
      ${a.begrunnelse.pluss.length ? `<ul class="grunnliste">${a.begrunnelse.pluss.slice(0, 3).map((x) => `<li class="opp">${esc(x)}</li>`).join("")}${a.begrunnelse.minus.slice(0, 2).map((x) => `<li class="ned">${esc(x)}</li>`).join("")}</ul>` : ""}
      ${rapport ? `<p class="notat">📅 Kvartalsrapport ${esc(nr.split("-").reverse().join("."))}: kursen kan svinge mye denne uka.</p>` : ""}
    </div>`;
  };
  const valgt = u.valgt.map(finn).filter(Boolean);
  const ut = u.ut.map(finn).filter(Boolean);
  const neste = data.aksjer.filter((a) => a.uke && !a.uke.valgt).sort((a, b) => a.uke.plass - b.uke.plass).slice(0, 6);
  const graf = linjegraf(
    [
      { verdier: t.kurve.map((p) => p.osebx), farge: cssFarge("--sma200") },
      { verdier: t.kurve.map((p) => p.modell), farge: cssFarge("--aksent"), bredde: 2.2 },
    ],
    t.kurve.map((p) => p.dato.slice(0, 7)),
    { hoyde: 240, prosent: true, logaritmisk: true },
  );
  $("#uke").innerHTML = `
    <div class="kort">
      <h2>Ukens ${m.antall} aksjer</h2>
      <p class="hjelp">Aksjene med best utsikter neste uke, basert på kurser og børsmeldinger t.o.m. ${esc(data.handelsdag.split("-").reverse().join("."))}.
        Høyst ${m.maksPerSektor} fra samme sektor. Fordel pengene likt, og sjekk listen hver fredag etter børsslutt.
        En aksje beholdes så lenge den er blant de ${m.antall + m.buffer} beste, så du trenger sjelden å bytte.</p>
      ${valgt.map(kort).join("")}
      ${ut.length ? `<p class="notat"><b>Selg denne uka:</b> ${ut.map((a) => `<span class="lenke" data-t="${esc(a.t)}">${esc(a.navn)}</span>`).join(", ")} (falt ut av topp ${m.antall + m.buffer}).</p>` : `<p class="hjelp" style="margin-top:8px">Ingen aksjer ut denne uka.</p>`}
      <h3>Neste i køen</h3>
      <p class="hjelp">Aksjer i en sektor som allerede har ${m.maksPerSektor} plasser, hoppes over.</p>
      <div class="liste">${neste.map(radHtml).join("")}</div>
    </div>
    <div class="kort">
      <h2>Hvor godt har det virket?</h2>
      <p class="hjelp">Testet fredag til fredag fra ${esc(t.fra)} til ${esc(t.til)} (${t.uker} uker). Bare data som var kjent hver fredag er brukt, og ${tall(m.kostnad * 100, 1)} % i kurtasje og spread er trukket fra for hvert bytte.</p>
      ${graf}
      <div class="forklaring"><span><i style="background:var(--aksent)"></i>Ukesvalg</span><span><i style="background:var(--sma200)"></i>OSEBX</span></div>
      <div class="nokkel">
        <div><span>Avkastning per år</span><b>${pst(t.modell.aarlig)}</b></div>
        <div><span>OSEBX per år</span><b>${pst(t.osebx.aarlig)}</b></div>
        <div><span>Største fall</span><b class="ned">${pst(t.modell.maksFall)}</b></div>
        <div><span>Uker porteføljen slo OSEBX</span><b>${pst(t.andelUkerSlaarIndeks, 0, false)}</b></div>
        <div><span>Enkeltaksjer som slo OSEBX</span><b>${pst(t.andelValgtSlaarIndeks, 0, false)}</b></div>
        <div><span>Snitt per aksje mot OSEBX</span><b>${pst(t.snittValgtMotIndeks, 2)} /uke</b></div>
        <div><span>Bytter per uke</span><b>${tall(t.bytterPerUke, 1)}</b></div>
      </div>
      <h3>Hva modellen ser på</h3>
      <ul class="hjelp" style="padding-left:18px">${Object.entries(m.vekter).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(([f, w]) => `<li><b>${esc(u.faktorer[f].navn)}</b> (${w > 0 ? "+" : "−"}${Math.round(Math.abs(w) * 100)}): ${esc(u.faktorer[f].forklaring)}</li>`).join("")}</ul>
      <h3>Les dette først</h3>
      <ul class="hjelp" style="padding-left:18px">
        <li><b>Én uke er nesten bare støy.</b> Hver enkelt aksje slo børsen bare ${pst(t.andelValgtSlaarIndeks, 0, false)} av ukene, så det er nesten myntkast. Fordelen kommer av at vinnerne i snitt stiger mer enn taperne faller. Den viser seg først over mange uker.</li>
        <li><b>Rene korttidsstrategier virket ikke på Oslo Børs:</b> «kjøp etter fall», RSI-oversolgt og å handle på nyheter hver uke tapte penger etter kurtasje. Ukesvalg er derfor i praksis en trendstrategi som sjekkes ukentlig, med litt ekstra vekt på innsidekjøp og kontraktsnyheter.</li>
        <li><b>Høy risiko:</b> Bare ${m.antall} aksjer, og porteføljen har falt opptil ${pst(-t.modell.maksFall, 0, false)}. Bruk bare penger du tåler å tape.</li>
        <li>Testen bruker dagens aksjeliste og vekter valgt i ettertid, så tallene er trolig for gode. Skatt er ikke regnet med. Bruk gjerne aksjesparekonto, så du ikke skattes for hvert bytte.</li>
      </ul>
    </div>`;
}

// ---------- Marked og nyheter ----------

function visMarked() {
  const m = data.marked, ix = data.indeks;
  const kort = (navn, verdi, rader, tekst) => `<div class="teller"><div class="l">${navn}</div><div class="n tall" style="font-size:20px">${verdi}</div>
    <div class="l">${rader}</div>${tekst ? `<div class="l" style="margin-top:4px">${tekst}</div>` : ""}</div>`;
  const oljeTekst = m.olje.mom3 > 0.1 ? "Stigende oljepris gir medvind for olje- og oljeserviceaksjer." : m.olje.mom3 < -0.1 ? "Fallende oljepris gir motvind for oljeaksjer." : "";
  const usdTekst = m.usd.mom3 > 0.03 ? "Sterkere dollar hjelper eksportører og shipping." : m.usd.mom3 < -0.03 ? "Svakere dollar gir motvind for eksportører." : "";
  const maksSektor = Math.max(...m.sektorer.map((s) => Math.abs(s.mom6)), 0.01);
  $("#marked").innerHTML = `
    <div class="oppsummering">
      ${kort("Oslo Børs (OSEBX)", tall(ix.verdi, 0), `1 mnd ${pst(ix.mom1)} · 12 mnd ${pst(ix.mom12)}`, ix.overSma200 ? "Markedet er i stigende trend." : "Markedet er i fallende trend. Vær ekstra forsiktig.")}
      ${kort("Brent-olje", `${tall(m.olje.verdi, 1)} $`, `3 mnd ${pst(m.olje.mom3)} · 12 mnd ${pst(m.olje.mom12)}`, oljeTekst)}
      ${kort("USD/NOK", tall(m.usd.verdi, 2), `3 mnd ${pst(m.usd.mom3)} · 12 mnd ${pst(m.usd.mom12)}`, usdTekst)}
    </div>
    <div class="kort">
      <h2>Sektortrender</h2>
      <p class="hjelp">Snittlig kursutvikling siste 6 måneder. Sektortrend er en av faktorene som har virket best på Oslo Børs: sektorer som har gått bra, fortsetter ofte en stund.</p>
      ${m.sektorer
        .map(
          (s) => `<div class="sektorrad">
            <span>${esc(s.sektor)} <small class="dempet">(${s.antall})</small></span>
            <div class="tobar"><i class="${s.mom6 >= 0 ? "pos" : "neg"}" style="width:${(Math.abs(s.mom6) / maksSektor) * 50}%"></i></div>
            <span class="tall ${fargeKlasse(s.mom6)}">${pst(s.mom6, 0)}</span>
            <small class="dempet">${s.kjop} kjøp · ${s.selg} selg</small>
          </div>`,
        )
        .join("")}
    </div>
    <div class="kort">
      <h2>Viktige hendelser siste 14 dager</h2>
      <p class="hjelp">Innsidehandel, kontrakter, emisjoner, varsler, oppkjøp og rapporter fra Oslo Børs Newsweb. Trykk på et selskap for å se analysen.</p>
      ${
        m.hendelser.length
          ? `<ul class="nyheter">${m.hendelser
              .map(
                (h) => `<li><span class="dato mono">${esc(h.dato.slice(5).split("-").reverse().join("."))}</span>
                <span class="type ${TYPEFARGE[h.type] || ""}">${esc(TYPENAVN[h.type] || h.type)}</span>
                <span><b class="lenke" data-t="${esc(h.t)}">${esc(h.navn)}</b>: <a href="${NEWSWEB(h.id)}" target="_blank" rel="noopener">${esc(h.tittel)}</a></span></li>`,
              )
              .join("")}</ul>`
          : `<p class="tom">Ingen hendelser.</p>`
      }
    </div>`;
}

// ---------- Portefølje ----------

const kr = (x) => `${tall(x, 0)} kr`;

/** Tall i norsk format: "29 244,60", "−2 453,05", "-1230" */
function lesTall(t) {
  if (t == null) return null;
  const s = String(t).replace(/[\s ]/g, "").replace(/[−–]/g, "-").replace(/kr$/i, "").replace(",", ".");
  const x = parseFloat(s);
  return Number.isFinite(x) ? x : null;
}

/**
 * Importerer linjer som "KOG 29 244,60 −2 453,05" (ticker, markedsverdi, urealisert gevinst/tap),
 * slik nettbanken viser beholdningen. Antall og kjøpskurs regnes ut fra dagens kurs.
 */
function importerLinjer(tekst) {
  const ut = [], feil = [];
  for (const linje of tekst.split(/\n|;/).map((l) => l.trim()).filter(Boolean)) {
    const m = linje.match(/^([A-Za-z0-9]{1,8})(?:\.OL)?[\s:,]+(.+)$/);
    const t = m?.[1].toUpperCase();
    const a = t && finn(t);
    // Tall med eller uten tusenskille: "29 244,60", "29244.6", "−2 453,05"
    const tall = m ? (m[2].match(/[−–-]?\d{1,3}(?:[ \u00a0]\d{3})+(?:[.,]\d+)?(?!\d)|[−–-]?\d+(?:[.,]\d+)?/g) || []).map(lesTall) : [];
    if (!a || tall.length < 1) { feil.push(linje); continue; }
    const verdi = tall[0], gevinst = tall[1] ?? null;
    // Antall aksjer er som regel et heltall; avrund når det er innenfor 1 % (kursen i analysen er avrundet)
    let antall = verdi / a.kurs;
    if (Math.round(antall) > 0 && Math.abs(Math.round(antall) - antall) / antall < 0.01) antall = Math.round(antall);
    ut.push({ t, antall, kurs: gevinst != null ? (verdi - gevinst) / antall : null });
  }
  return { ut, feil };
}

function lagreOgVis() {
  lagrePortefolje(portefolje);
  visPortefolje();
  visListe();
}

// Portefølje kan også sendes i lenken: #portefolje=KOG:29244.6:-2453.05,MPCC:36175:9182
function importerFraLenke() {
  const m = location.hash.match(/portefolje=([^&]+)/);
  if (!m) return;
  const linjer = decodeURIComponent(m[1]).split(",").map((x) => x.split(":").join("  "));
  const { ut } = importerLinjer(linjer.join("\n"));
  if (ut.length) {
    const nye = new Set(ut.map((x) => x.t));
    portefolje = [...portefolje.filter((p) => !nye.has(p.t)), ...ut];
    lagreOgVis();
  }
  history.replaceState(null, "", location.pathname + location.search);
  document.querySelector('[data-fane="portefolje"]').click();
}

/** Vurdering av én beholdning: handling, farge og begrunnelse. */
function vurder(a, p, vekt, sektorvekt = 0) {
  const k = a.kort.signal, l = a.lang.signal;
  const gevinst = p.kurs ? a.kurs / p.kurs - 1 : null;
  const notater = [];
  let handling, klasse, rang;
  if (k === "SELG" && l === "SELG") { handling = "Selg"; klasse = "SELG"; rang = 0; }
  else if (l === "SELG") { handling = "Vurder å selge"; klasse = "SELG"; rang = 1; }
  else if (vekt > 0.3) { handling = "Reduser"; klasse = "HOLD"; rang = 2; }
  else if (k === "SELG") { handling = "Behold, følg med"; klasse = "HOLD"; rang = 3; }
  else if (k === "KJØP" && l === "KJØP") { handling = vekt < 0.15 && sektorvekt < 0.4 ? "Behold / kjøp mer" : "Behold"; klasse = "KJØP"; rang = 5; }
  else { handling = "Behold"; klasse = "HOLD"; rang = 4; }

  if (vekt > 0.3) notater.push(`Utgjør ${pst(vekt, 0, false)} av porteføljen. Mer enn 20–25 % i én aksje gir høy risiko.`);
  if (klasse === "SELG" && gevinst != null && gevinst < -0.2) {
    notater.push(`Aksjen er ${pst(-gevinst, 0, false)} under kjøpskursen. Kjøpskursen påvirker ikke hvor aksjen går videre. Spørsmålet er om pengene gjør mer nytte i en annen aksje. Aksjer med svak trend har i snitt fortsatt å gjøre det svakt.`);
    notater.push("Utenfor aksjesparekonto gir realisert tap fradrag i skatten.");
  }
  if (klasse === "KJØP" && gevinst != null && gevinst > 0.3) notater.push("God gevinst og fortsatt sterk trend. Historisk har det lønt seg å la vinnere løpe så lenge trenden holder.");
  if (a.nokkel.omsetningMNOK < 5) notater.push(`Lite omsatt (${tall(a.nokkel.omsetningMNOK, 1)} MNOK per dag). Selg gjerne med limit, og fordel salget over flere dager.`);
  if (a.kursbrudd) notater.push("Kurshistorikken har et brudd (trolig spleis eller utdeling) som er justert for. Signalet er mer usikkert enn vanlig.");
  const nr = a.analytikere?.nesteRapport;
  if (nr && nr >= data.handelsdag && nr <= leggTilDager(data.handelsdag, 30)) {
    notater.push(`Kvartalsrapport ${nr.split("-").reverse().join(".")}. Kursen kan svinge mye begge veier rundt rapporten.`);
  }
  return { handling, klasse, rang, gevinst, notater };
}

function visPortefolje() {
  if (!data) return;
  const hold = portefolje
    .map((p) => ({ p, a: finn(p.t) }))
    .map((x) => ({ ...x, verdi: x.a && x.p.antall ? x.p.antall * x.a.kurs : null }));
  const totalt = hold.reduce((s, x) => s + (x.verdi || 0), 0);
  const kost = hold.reduce((s, x) => s + (x.verdi && x.p.kurs ? x.p.antall * x.p.kurs : 0), 0);
  const verdiMedKost = hold.reduce((s, x) => s + (x.verdi && x.p.kurs ? x.verdi : 0), 0);
  const sektorsum = {};
  for (const x of hold) if (x.a && x.verdi) sektorsum[x.a.sektor] = (sektorsum[x.a.sektor] || 0) + x.verdi;
  for (const x of hold) x.v = x.a ? vurder(x.a, x.p, totalt > 0 && x.verdi ? x.verdi / totalt : 0, totalt > 0 ? (sektorsum[x.a.sektor] || 0) / totalt : 0) : null;
  hold.sort((x, y) => (x.v?.rang ?? 9) - (y.v?.rang ?? 9) || (y.verdi || 0) - (x.verdi || 0));

  // ----- Oppsummering -----
  let html = "";
  if (hold.length) {
    const sektorVerdi = {};
    for (const x of hold) if (x.a && x.verdi) sektorVerdi[x.a.sektor] = (sektorVerdi[x.a.sektor] || 0) + x.verdi;
    const sektorer = Object.entries(sektorVerdi).sort((a, b) => b[1] - a[1]);
    const selgVerdi = hold.filter((x) => x.v?.klasse === "SELG").reduce((s, x) => s + (x.verdi || 0), 0);
    const snittScore = totalt > 0 ? hold.reduce((s, x) => s + (x.verdi && x.a ? x.a.samlet.score * x.verdi : 0), 0) / totalt : null;
    html += `<div class="oppsummering portefolje-tall">
      <div class="teller"><div class="l">Verdi</div><div class="n tall">${totalt > 0 ? kr(totalt) : "–"}</div>
        <div class="l">${kost > 0 ? `Gevinst/tap <span class="${fargeKlasse(verdiMedKost - kost)}">${kr(verdiMedKost - kost)} (${pst(verdiMedKost / kost - 1)})</span>` : "Legg inn verdi for å se mer"}</div></div>
      <div class="teller"><div class="l">Snittscore (vektet)</div><div class="n tall">${snittScore != null ? tall(snittScore, 0) : "–"}</div>
        <div class="l">50 er snittet på børsen</div></div>
      <div class="teller SELG"><div class="l">Med salgssignal</div><div class="n tall">${totalt > 0 ? pst(selgVerdi / totalt, 0, false) : hold.filter((x) => x.v?.klasse === "SELG").length}</div>
        <div class="l">${totalt > 0 ? kr(selgVerdi) : "aksjer"}</div></div>
    </div>`;
    if (totalt > 0) {
      html += `<div class="sektorfordeling">${sektorer
        .map(([s, v]) => `<div class="sektorrad"><span>${esc(s)}</span><div class="bar"><i style="width:${(v / totalt) * 100}%"></i></div><span class="tall">${pst(v / totalt, 0, false)}</span><small class="dempet">${kr(v)}</small></div>`)
        .join("")}</div>`;
      const [tyngst, tv] = sektorer[0] || [];
      if (tv / totalt > 0.4) {
        html += `<p class="advarsel-boks">⚠️ ${pst(tv / totalt, 0, false)} av porteføljen er i <b>${esc(tyngst)}</b>. Aksjer i samme sektor faller ofte samtidig. Vurder å spre på flere sektorer, selv om sektoren går godt nå.</p>`;
      }
    }
  }

  // ----- Hver aksje -----
  html += hold.length
    ? hold
        .map(({ p, a, verdi, v }) => {
          if (!a) {
            return `<div class="beholdning"><div class="beholdning-topp"><div><b>${esc(p.t)}</b><div class="hjelp">Aksjen er ikke med i analysen.</div></div>
              <button class="slett" data-slett="${esc(p.t)}" aria-label="Fjern">×</button></div></div>`;
          }
          const grunner = [...a.begrunnelse.minus.slice(0, v.klasse === "SELG" ? 4 : 2).map((x) => `<li class="ned">${esc(x)}</li>`), ...a.begrunnelse.pluss.slice(0, v.klasse === "SELG" ? 2 : 4).map((x) => `<li class="opp">${esc(x)}</li>`)];
          const siste = a.nyheter.find((n) => ["innsidekjøp", "innsidesalg", "rapport"].includes(n.type));
          return `<div class="beholdning ${v.klasse}">
            <div class="beholdning-topp">
              <div class="rad-klikk" data-t="${esc(a.t)}">
                <span class="handlingsmerke ${v.klasse}">${esc(v.handling)}</span>
                <b>${esc(a.navn)}</b> <span class="mono dempet">${esc(a.t)}</span>
                <div class="hjelp" style="margin:2px 0 0">${esc(a.sektor)}${verdi ? ` · ${kr(verdi)} (${pst(verdi / totalt, 0, false)})` : ""}${v.gevinst != null ? ` · <span class="${fargeKlasse(v.gevinst)}">${pst(v.gevinst)}</span> siden kjøp` : ""}</div>
              </div>
              <div style="display:flex;gap:6px;align-items:flex-start">
                <div class="merker">${merke(a.kort.signal, a.kort.score, "Kort")}${merke(a.lang.signal, a.lang.score, "Lang")}</div>
                <button class="slett" data-slett="${esc(a.t)}" aria-label="Fjern">×</button>
              </div>
            </div>
            <ul class="grunnliste">${grunner.join("")}</ul>
            ${v.notater.map((n) => `<p class="notat">${esc(n)}</p>`).join("")}
            ${siste ? `<p class="hjelp" style="margin:6px 0 0">Siste: ${esc(siste.dato.split("-").reverse().join("."))} <span class="type ${TYPEFARGE[siste.type] || ""}">${esc(TYPENAVN[siste.type])}</span> <a href="${NEWSWEB(siste.id)}" target="_blank" rel="noopener">${esc(siste.tittel)}</a></p>` : ""}
          </div>`;
        })
        .join("")
    : `<p class="tom">Du har ikke lagt inn noen aksjer ennå.</p>`;
  $("#beholdning").innerHTML = html;

  // ----- Omplassering -----
  const selg = hold.filter((x) => x.v?.klasse === "SELG" && x.verdi);
  const reduser = hold.filter((x) => x.v?.handling === "Reduser" && x.verdi);
  const frigjort = selg.reduce((s, x) => s + x.verdi, 0) + reduser.reduce((s, x) => s + (x.verdi - totalt * 0.2), 0);
  const sektorAndel = {};
  for (const x of hold) if (x.a && x.verdi && x.v.klasse !== "SELG") sektorAndel[x.a.sektor] = (sektorAndel[x.a.sektor] || 0) + x.verdi / (totalt || 1);
  const perSektor = {};
  const kandidater = data.aksjer
    .filter((a) => a.samlet.signal === "KJØP" && a.kort.signal !== "SELG" && a.lang.signal === "KJØP" && !eier(a.t) && a.nokkel.omsetningMNOK >= 5 && !a.kursbrudd)
    .filter((a) => (sektorAndel[a.sektor] || 0) < 0.3) // ikke mer i sektorer porteføljen allerede er tung i
    .filter((a) => (perSektor[a.sektor] = (perSektor[a.sektor] || 0) + 1) <= 1)
    .slice(0, 5);
  let fhtml = "";
  if (frigjort > 0 && kandidater.length) {
    const n = Math.min(kandidater.length, Math.max(2, Math.min(5, Math.round(frigjort / 15000))));
    const belop = frigjort / n;
    fhtml += `<p>Selger du ${selg.length ? selg.map((x) => esc(x.a.t)).join(", ") : ""}${reduser.length ? `${selg.length ? " og reduserer " : "Reduserer du "}${reduser.map((x) => esc(x.a.t)).join(", ")}` : ""}, frigjøres ca. <b>${kr(frigjort)}</b>.
      Et forslag er å fordele beløpet på ${n} aksjer med kjøpssignal i sektorer du har lite av, ca. <b>${kr(belop)}</b> i hver:</p>`;
    fhtml += `<div class="liste">${kandidater.slice(0, n).map(radHtml).join("")}</div>`;
  } else {
    const ideer = data.aksjer.filter((a) => a.samlet.signal === "KJØP" && !eier(a.t) && (sektorAndel[a.sektor] || 0) < 0.3).filter((a) => (perSektor[a.sektor] = (perSektor[a.sektor] || 0) + 1) <= 2).slice(0, 6);
    fhtml += `<p class="hjelp">${hold.length ? "Ingen salgssignaler i porteføljen din nå. " : ""}Aksjer med kjøpssignal i sektorer du har lite av:</p>`;
    fhtml += ideer.length ? `<div class="liste">${ideer.map(radHtml).join("")}</div>` : `<p class="tom">Ingen kjøpssignaler i andre sektorer akkurat nå.</p>`;
  }
  fhtml += `<p class="hjelp" style="margin-top:10px">Kurtasje og spread koster typisk 0,2–0,5 % per handel. Å bytte aksje lønner seg bare når signalforskjellen er tydelig. Sjekk igjen om en måned.</p>`;
  $("#forslag").innerHTML = fhtml;
}

$("#beholdning").addEventListener("click", (e) => {
  const s = e.target.closest("[data-slett]");
  if (!s) return;
  portefolje = portefolje.filter((p) => p.t !== s.dataset.slett);
  lagreOgVis();
});

$("#leggTil").addEventListener("submit", (e) => {
  e.preventDefault();
  const t = $("#ltTicker").value.trim().toUpperCase().replace(/\.OL$/, "");
  if (!t) return;
  const a = finn(t);
  let antall = lesTall($("#ltAntall").value), kurs = lesTall($("#ltKurs").value);
  const verdi = lesTall($("#ltVerdi").value), gevinst = lesTall($("#ltGevinst").value);
  if (!antall && verdi && a) {
    antall = verdi / a.kurs;
    if (gevinst != null) kurs = (verdi - gevinst) / antall;
  }
  portefolje = portefolje.filter((p) => p.t !== t);
  portefolje.push({ t, antall: antall || null, kurs: kurs || null });
  e.target.reset();
  lagreOgVis();
});

$("#importer").addEventListener("click", () => {
  const { ut, feil } = importerLinjer($("#importTekst").value);
  const nye = new Set(ut.map((x) => x.t));
  portefolje = [...portefolje.filter((p) => !nye.has(p.t)), ...ut];
  $("#importStatus").textContent = `${ut.length} aksjer lagt inn.${feil.length ? ` Forstod ikke: ${feil.join(" | ")}` : ""}`;
  if (ut.length) $("#importTekst").value = "";
  lagreOgVis();
});

$("#tomPortefolje").addEventListener("click", () => {
  if (!confirm("Fjerne alle aksjene fra porteføljen?")) return;
  portefolje = [];
  lagreOgVis();
});

// ---------- Historisk test ----------

function visTest() {
  const h = data.historiskTest[testValg];
  const mod = data.modeller[testValg];
  const graf = linjegraf(
    [
      { verdier: h.kurve.map((p) => p.likevekt), farge: "#94a3b8", bredde: 1.3, stiplet: true },
      { verdier: h.kurve.map((p) => p.osebx), farge: cssFarge("--sma200") },
      { verdier: h.kurve.map((p) => p.modell), farge: cssFarge("--aksent"), bredde: 2.2 },
    ],
    h.kurve.map((p) => p.dato.slice(0, 7)),
    { hoyde: 260, prosent: true, logaritmisk: true },
  );
  const rad = (navn, s) => `<tr><td>${navn}</td><td class="tall">${pst(s.aarlig)}</td><td class="tall">${pst(s.totalt, 0)}</td><td class="tall ned">${pst(s.maksFall)}</td></tr>`;
  const g = h.signalgrupper;
  const grad = (s) => `<tr><td>${merke(s, null).replace(/<small>.*<\/small>/, "")}</td><td class="tall">${pst(g[s].snitt, testValg === "kort" ? 2 : 1)}</td><td class="tall">${pst(g[s].andelPositiv, 0, false)}</td><td class="tall">${g[s].antall}</td></tr>`;
  const k = data.kontrolltest;
  const fs = data.faktorstudie;
  const iModell = (f) => {
    const v = [data.modeller.kort.vekter[f], data.modeller.lang.vekter[f]];
    return v.some(Boolean) ? v.map((x) => (x ? `${x > 0 ? "+" : "−"}${Math.round(Math.abs(x) * 100)}` : "0")).join(" / ") : "–";
  };
  const faktorrader = Object.entries(fs.faktorer)
    .sort((a, b) => Math.abs(b[1].t1) - Math.abs(a[1].t1))
    .map(([f, v]) => {
      const st = (t) => (Math.abs(t) >= 2 ? "sterk" : Math.abs(t) >= 1.3 ? "middels" : "svak");
      return `<tr><td>${esc(data.faktorinfo[f]?.navn || f)}<br><small class="dempet">${esc(data.faktorinfo[f]?.gruppe || "")}</small></td>
        <td class="tall ${fargeKlasse(v.ic1)} ${st(v.t1)}">${tall(v.ic1 * 100, 1)}<small> (t ${tall(v.t1, 1)})</small></td>
        <td class="tall ${fargeKlasse(v.ic12)} ${st(v.t12)}">${tall(v.ic12 * 100, 1)}<small> (t ${tall(v.t12, 1)})</small></td>
        <td class="tall">${iModell(f)}</td></tr>`;
    })
    .join("");
  const HENDELSE = {
    innsideKjop: "Innsidekjøp (minst 1 siste 90 d)", innsideKjop3: "Mange innsidekjøp (3+ siste 90 d)", innsideSalg: "Innsidesalg (2+ siste 90 d)",
    tilbakekjop: "Tilbakekjøp av aksjer", kontrakter: "Mange kontraktsmeldinger (3+ siste 60 d)", emisjon: "Emisjon siste 60 d",
    varsel: "Negativt varsel siste 60 d", oppkjop: "Oppkjøpsbud / strategisk gjennomgang", nyhetPositiv: "Kursen steg kraftig på nyheter",
    nyhetNegativ: "Kursen falt kraftig på nyheter", rapportPositiv: "Kursen steg 5 %+ på kvartalsrapport", rapportNegativ: "Kursen falt 5 %+ på kvartalsrapport",
  };
  const hendelsesrader = Object.entries(fs.hendelser)
    .map(([n, v]) => `<tr><td>${esc(HENDELSE[n] || n)}</td><td class="tall">${v.antall}</td>
      <td class="tall ${fargeKlasse(v.mer1)}">${pst(v.mer1, 2)}<small> (t ${tall(v.t1, 1)})</small></td>
      <td class="tall ${fargeKlasse(v.mer3)}">${pst(v.mer3, 2)}<small> (t ${tall(v.t3, 1)})</small></td></tr>`)
    .join("");

  $("#test").innerHTML = `
    <h2>Har modellene virket før?</h2>
    <div class="chips" id="testvalg" style="display:inline-flex;margin:6px 0 10px">
      <button data-m="kort" class="${testValg === "kort" ? "aktiv" : ""}">Kort sikt</button>
      <button data-m="lang" class="${testValg === "lang" ? "aktiv" : ""}">Lang sikt</button>
    </div>
    <p class="hjelp">${esc(mod.navn)} (${esc(mod.horisont)}) er kjørt måned for måned fra ${esc(h.fra)} til ${esc(h.til)} (${tall(h.aar, 1)} år).
      Hver måned brukes bare kurser og børsmeldinger som var kjent på det tidspunktet.
      ${testValg === "kort"
        ? `Hver måned kjøpes de ${data.grenser.antall} aksjene med høyest score.`
        : `Hver måned kjøpes en pakke med de ${data.grenser.antall} beste aksjene, som holdes i 12 måneder. Porteføljen består av de 12 siste pakkene.`}
      Kurtasje og spread er trukket fra (${tall(data.grenser.kostnad * 100, 1)} % per bytte). Grafen har logaritmisk skala.</p>
    ${graf}
    <div class="forklaring"><span><i style="background:var(--aksent)"></i>Modellportefølje</span><span><i style="background:var(--sma200)"></i>OSEBX</span><span><i style="background:#94a3b8"></i>Alle aksjene likt vektet</span></div>
    <div class="tabell-wrap"><table>
      <tr><th></th><th>Per år</th><th>Totalt</th><th>Største fall</th></tr>
      ${rad("<b>Modellportefølje</b>", h.modell)}${rad("OSEBX", h.osebx)}${rad("Alle likt vektet", h.likevekt)}
    </table></div>
    <p class="hjelp">Modellporteføljen slo OSEBX i ${pst(h.andelMndSlaarIndeks, 0, false)} av månedene.</p>

    <h3>Hvordan gikk aksjene etter hvert signal?</h3>
    <p class="hjelp">Snitt for alle aksjer med signalet (${esc(h.gruppeMaal)}).</p>
    <div class="tabell-wrap"><table>
      <tr><th>Signal</th><th>Snitt</th><th>Andel positive</th><th>Antall</th></tr>
      ${grad("KJØP")}${grad("HOLD")}${grad("SELG")}
    </table></div>

    <h3>Kontroll uten etterpåklokskap</h3>
    <p class="hjelp">Vektene i modellene over er valgt etter å ha sett dataene. For å vise hvor mye det kan pynte på tallene, er det også testet en modell
      som lærer vektene for alle ${Object.keys(data.faktorinfo).length} faktorene selv, måned for måned, bare fra det den visste da (fra ${esc(k.fra)}):</p>
    <div class="tabell-wrap"><table>
      <tr><th></th><th>Per år</th><th>Største fall</th><th>Slo OSEBX</th></tr>
      <tr><td>Selvlærende modell</td><td class="tall">${pst(k.laerende.aarlig)}</td><td class="tall ned">${pst(k.laerende.maksFall)}</td><td class="tall">${pst(k.laerende.slaarIndeks, 0, false)}</td></tr>
      <tr><td>Kortsiktsmodellen</td><td class="tall">${pst(k.kort.aarlig)}</td><td class="tall ned">${pst(k.kort.maksFall)}</td><td class="tall">${pst(k.kort.slaarIndeks, 0, false)}</td></tr>
      <tr><td>OSEBX</td><td class="tall">${pst(k.osebx.aarlig)}</td><td class="tall ned">${pst(k.osebx.maksFall)}</td><td></td></tr>
      <tr><td>Alle likt vektet</td><td class="tall">${pst(k.likevekt.aarlig)}</td><td class="tall ned">${pst(k.likevekt.maksFall)}</td><td></td></tr>
    </table></div>
    <p class="hjelp">Realistisk forventning ligger et sted mellom disse. Den selvlærende modellen sliter fordi det er få aksjer og mye støy. Den legger for mye vekt på tilfeldigheter.
      Derfor bygger modellene på faktorer som er godt dokumentert i forskning, og som har virket i begge halvdeler av perioden.</p>

    <h3>Hva har virket på Oslo Børs?</h3>
    <p class="hjelp">Informasjonskoeffisient (IC, i prosent): hvor godt faktoren rangerte aksjene mot avkastningen etterpå. Over 0 betyr at høy verdi ga høyere avkastning.
      t-verdien viser hvor sikkert det er: over 2 er ganske sikkert, under 1 kan være tilfeldig. Siste kolonne viser vekten i kort- og langsiktsmodellen.</p>
    <div class="tabell-wrap"><table class="faktortabell">
      <tr><th>Faktor</th><th>1 mnd</th><th>12 mnd</th><th>Vekt K / L</th></tr>
      ${faktorrader}
    </table></div>

    <h3>Nyheter og innsidehandel</h3>
    <p class="hjelp">Hvor mye bedre (eller dårligere) aksjer med hendelsen gjorde det enn snittet av alle aksjene, 1 og 3 måneder etterpå.</p>
    <div class="tabell-wrap"><table>
      <tr><th>Hendelse</th><th>Antall</th><th>1 mnd</th><th>3 mnd</th></tr>
      ${hendelsesrader}
    </table></div>

    <h3>Les dette før du stoler på tallene</h3>
    <ul class="hjelp" style="padding-left:18px">
      <li><b>Overlevelsesskjevhet:</b> Testen bruker dagens aksjeliste. Selskaper som gikk konkurs eller ble kjøpt opp underveis er ikke med. Det gjør alle tallene, også «alle likt vektet», bedre enn virkeligheten.</li>
      <li><b>Konsentrasjon:</b> Modellene ender ofte med mange aksjer fra samme sektor (nå shipping). De kan falle kraftig når trenden snur.</li>
      <li><b>Ikke testet:</b> Analytikerdata og nøkkeltall (P/E, P/B, egenkapitalavkastning) finnes bare for i dag, og utgjør ${Math.round(data.modeller.kort.andelAnalytikere * 100)} % (kort) og ${Math.round(data.modeller.lang.andelAnalytikere * 100)} % (lang) av scoren.</li>
      <li>Utbytte er regnet med. Skatt er ikke regnet med.</li>
    </ul>`;
  $("#testvalg").onclick = (e) => {
    const b = e.target.closest("button[data-m]");
    if (!b) return;
    testValg = b.dataset.m;
    visTest();
  };
}

// ---------- Metode ----------

function visMetode() {
  const vekter = (o) =>
    Object.entries(o)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .map(([f, w]) => `<li><b>${esc(data.faktorinfo[f]?.navn || f)}</b> (${w > 0 ? "+" : "−"}${Math.round(Math.abs(w) * 100)}): ${esc(data.faktorinfo[f]?.forklaring || "")}</li>`)
      .join("");
  const ANALYTIKER = {
    revisjon: "Endring i analytikernes inntjeningsestimat siste 90 dager", anbefalingEndring: "Om analytikerne er blitt mer positive siste 3 mnd",
    overraskelse: "Siste resultat mot analytikernes estimat", kursmalOppside: "Analytikernes kursmål mot dagens kurs",
    inntjening: "Inntjening i forhold til pris (1/P/E)", bok: "Bokført verdi i forhold til pris (1/P/B)", roe: "Egenkapitalavkastning (lønnsomhet)",
  };
  const av = (o) => Object.entries(o).map(([f, w]) => `${esc(ANALYTIKER[f] || f)} (${Math.round(w * 100)} %)`).join(", ");
  const m = data.modeller, g = data.grenser;
  $("#metode").innerHTML = `
    <h2>Slik regnes signalene ut</h2>
    <p>Hver handelsdag etter børsslutt henter Børsradar data for ${data.aksjer.length} av de mest omsatte aksjene på Oslo Børs:</p>
    <ul>
      <li><b>Kurser</b> for ti år, justert for utbytte, samt oljepris og dollarkurs (Yahoo Finance).</li>
      <li><b>Alle børsmeldinger</b> siden 2016 fra Oslo Børs Newsweb: kvartalsrapporter, kontrakter, emisjoner, varsler og oppkjøp.</li>
      <li><b>Innsidehandel:</b> Hver melding om meldepliktig handel leses og tolkes som kjøp eller salg i markedet. Aksjeprogrammer, opsjoner og tildelinger telles ikke med.</li>
      <li><b>Analytikere og nøkkeltall:</b> anbefalinger, kursmål, endringer i estimater, neste rapportdato, P/E, P/B og lønnsomhet.</li>
    </ul>
    <p>Hver aksje får en score fra 0 til 100 for to horisonter. Scoren viser plasseringen mot de andre aksjene: 100 er best.</p>

    <h3>${esc(m.kort.navn)} (${esc(m.kort.horisont)})</h3>
    <ul>${vekter(m.kort.vekter)}</ul>
    <p class="hjelp">I tillegg teller analytikerdata ${Math.round(m.kort.andelAnalytikere * 100)} %: ${av(m.kort.analytikerVekter)}.</p>

    <h3>${esc(m.lang.navn)} (${esc(m.lang.horisont)})</h3>
    <ul>${vekter(m.lang.vekter)}</ul>
    <p class="hjelp">I tillegg teller analytikerdata og nøkkeltall ${Math.round(m.lang.andelAnalytikere * 100)} %: ${av(m.lang.analytikerVekter)}.</p>

    <h3>Hvorfor disse faktorene?</h3>
    <p>Rundt 30 faktorer er testet på Oslo Børs fra 2017 (se «Historisk test»). Bare de som både er dokumentert i forskning og har virket i begge halvdeler av perioden er med:</p>
    <ul>
      <li><b>Momentum og trend</b> er de klart sterkeste. Aksjer som har gått godt siste 6–12 måneder, fortsetter ofte en stund.</li>
      <li><b>Sektortrend:</b> Når en hel sektor går godt (for eksempel shipping når fraktratene stiger), fortsetter det ofte. Dette fanger opp trender i oljepris, fraktrater, laksepris og renter.</li>
      <li><b>Lotteriaksjer</b> med store enkeltdagshopp har gjort det dårligere enn snittet.</li>
      <li><b>Nyheter:</b> Mange kontraktsmeldinger har gitt meravkastning. Aksjer som har falt kraftig på nyheter, har i snitt fortsatt litt nedover.</li>
      <li><b>Innsidekjøp</b> har gitt litt meravkastning på lengre sikt, men effekten er usikker.</li>
      <li>Ikke med fordi de <i>ikke</i> har virket her: lave kurssvingninger, RSI/overkjøpt, sesongmønster, tilbakekjøp, oljefølsomhet og et markedsfilter som går i kontanter når børsen faller.</li>
    </ul>

    <h3>Signal</h3>
    <ul>
      <li><b class="opp">Kjøp:</b> score minst ${g.kjop}, og kursen er over 200-dagers snitt.</li>
      <li><b class="ned">Selg:</b> score høyst ${g.selg}, <i>eller</i> tydelig fallende trend: kursen er under 200-dagers snitt, 50-dagers snitt er under 200-dagers, og 12-måneders utviklingen er negativ.</li>
      <li><b>Hold:</b> alt annet. <b>Samlet</b> bygger på snittet av kort og lang score.</li>
    </ul>

    <h3>Hvordan bruke det</h3>
    <ul>
      <li>Sjekk omtrent én gang i måneden. Signalene er ikke laget for dagshandel.</li>
      <li>Fordel pengene på 8–10 aksjer fra ulike sektorer. Én aksje kan gjøre det dårlig selv med et sterkt signal.</li>
      <li>Kort sikt bytter aksjer oftere. Lang sikt gir færre handler og lavere kostnader.</li>
      <li>Les børsmeldingene selv, spesielt rett før og etter kvartalsrapporter.</li>
    </ul>
    ${data.mangler?.length ? `<p class="hjelp">Ikke med i dagens analyse: ${esc(data.mangler.join(", "))}.</p>` : ""}`;
}

start();
