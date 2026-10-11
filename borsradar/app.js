"use strict";

// Børsradar – viser signalene fra data/analyse.json (lages av analyse/analyser.mjs)

const LAGRING = "borsradar.portefolje.v1";
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const tall = (x, des = 2) => (x == null ? "–" : x.toLocaleString("nb-NO", { minimumFractionDigits: des, maximumFractionDigits: des }));
const pst = (x, des = 1, fortegn = true) => (x == null ? "–" : `${fortegn && x > 0 ? "+" : ""}${tall(x * 100, des)} %`);
const fargeKlasse = (x) => (x > 0 ? "opp" : x < 0 ? "ned" : "");

const DELNAVN = {
  mom12_1: "Momentum 12 mnd",
  mom6: "Momentum 6 mnd",
  mom3: "Momentum 3 mnd",
  trend: "Trend (snitt-linjer)",
  inntjening: "Inntjening (1/P/E)",
  bok: "Bokverdi (1/P/B)",
  utbytte: "Utbytte",
  roe: "Lønnsomhet (EK-avk.)",
};

const SIGNALTEKST = { KJØP: "Kjøp", HOLD: "Hold", SELG: "Selg" };

let data = null;
let filter = { signal: "alle", sektor: "", sok: "" };

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
  visPortefolje();
  visTest();
  visMetode();
}

// ---------- Signaler ----------

function visOppsummering() {
  const n = (s) => data.aksjer.filter((a) => a.signal === s).length;
  $("#oppsummering").innerHTML = ["KJØP", "HOLD", "SELG"]
    .map((s) => `<div class="teller ${s}"><div class="n">${n(s)}</div><div class="l">${SIGNALTEKST[s]}-signal</div></div>`)
    .join("");
}

function radHtml(a) {
  return `<button class="rad" data-t="${esc(a.t)}">
    <div>
      <div class="navn">${eier(a.t) ? "★ " : ""}${esc(a.navn)} <span class="mono" style="color:var(--dempet);font-weight:400">${esc(a.t)}</span></div>
      <div class="info">${esc(a.sektor)} · 12 mnd ${pst(a.tek.mom12_1, 0)} · ${a.tek.overSma200 ? "over" : "under"} 200-d snitt</div>
      <div class="scorebar"><i style="width:${a.score}%"></i></div>
    </div>
    <div class="kurs tall">${tall(a.kurs)}<small class="${fargeKlasse(a.endringDag)}">${pst(a.endringDag, 2)}</small></div>
    <div class="merke ${a.signal}">${SIGNALTEKST[a.signal]}<small>${tall(a.score, 0)}/100</small></div>
  </button>`;
}

function visListe() {
  const sok = filter.sok.trim().toLowerCase();
  const rader = data.aksjer.filter(
    (a) =>
      (filter.signal === "alle" || a.signal === filter.signal) &&
      (!filter.sektor || a.sektor === filter.sektor) &&
      (!sok || a.t.toLowerCase().includes(sok) || a.navn.toLowerCase().includes(sok)),
  );
  $("#liste").innerHTML = rader.length ? rader.map(radHtml).join("") : `<p class="tom">Ingen aksjer passer filteret.</p>`;
}

$("#signalfilter").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  filter.signal = b.dataset.s;
  document.querySelectorAll("#signalfilter button").forEach((x) => x.classList.toggle("aktiv", x === b));
  visListe();
});
$("#sektor").addEventListener("change", (e) => { filter.sektor = e.target.value; visListe(); });
$("#sok").addEventListener("input", (e) => { filter.sok = e.target.value; visListe(); });

document.addEventListener("click", (e) => {
  const rad = e.target.closest(".rad[data-t]");
  if (rad) visDetalj(rad.dataset.t);
});

// ---------- Faner ----------

document.querySelector(".faner").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-fane]");
  if (!b) return;
  document.querySelectorAll(".faner button").forEach((x) => x.classList.toggle("aktiv", x === b));
  document.querySelectorAll(".fane").forEach((f) => (f.hidden = f.id !== `fane-${b.dataset.fane}`));
});

// ---------- Detaljvisning ----------

function linjegraf(serier, datoer, { hoyde = 220, prosent = false } = {}) {
  const B = 700, H = hoyde, ml = 8, mr = 52, mt = 10, mb = 22;
  const alle = serier.flatMap((s) => s.verdier).filter((v) => v != null);
  let min = Math.min(...alle), max = Math.max(...alle);
  const pad = (max - min) * 0.06 || 1;
  min -= pad; max += pad;
  const x = (i) => ml + (i / (datoer.length - 1)) * (B - ml - mr);
  const y = (v) => mt + (1 - (v - min) / (max - min)) * (H - mt - mb);
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
  const steg = 4;
  let rutenett = "";
  for (let k = 0; k <= steg; k++) {
    const v = min + ((max - min) * k) / steg;
    const yy = y(v);
    const etikett = prosent ? `${tall((v - 1) * 100, 0)} %` : tall(v, v > 100 ? 0 : 1);
    rutenett += `<line class="rutenett" x1="${ml}" x2="${B - mr}" y1="${yy}" y2="${yy}"/><text x="${B - mr + 6}" y="${yy + 4}">${etikett}</text>`;
  }
  // Datoetiketter: start, midt og slutt
  const etiketter = [0, Math.floor(datoer.length / 2), datoer.length - 1]
    .map((i, k) => `<text x="${x(i)}" y="${H - 5}" text-anchor="${["start", "middle", "end"][k]}">${esc(datoer[i])}</text>`)
    .join("");
  return `<svg class="graf" viewBox="0 0 ${B} ${H}" role="img">${rutenett}${linjer}${etiketter}</svg>`;
}

function visDetalj(ticker) {
  const a = data.aksjer.find((x) => x.t === ticker);
  if (!a) return;
  const css = getComputedStyle(document.documentElement);
  const farge = (v) => css.getPropertyValue(v).trim();
  const graf = linjegraf(
    [
      { verdier: a.graf.sma200, farge: farge("--sma200"), bredde: 1.4 },
      { verdier: a.graf.sma50, farge: farge("--sma50"), bredde: 1.4 },
      { verdier: a.graf.kurs, farge: farge("--kurs"), bredde: 1.8 },
    ],
    a.graf.datoer,
  );
  const delscorer = Object.entries(a.delscorer)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `<div class="delscore"><span>${esc(DELNAVN[k] || k)}</span><div class="bar"><i style="width:${v}%"></i></div><span class="tall">${v}</span></div>`)
    .join("");
  const n = (label, verdi) => `<div><span>${label}</span><b>${verdi}</b></div>`;
  const liste = (l) => (l.length ? `<ul>${l.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="tom">Ingen</p>`);

  $("#detaljInnhold").innerHTML = `
    <div class="detalj-topp">
      <div>
        <h2>${esc(a.navn)} <span class="mono" style="color:var(--dempet);font-weight:400">${esc(a.t)}</span></h2>
        <div class="tall" style="font-size:20px">${tall(a.kurs)} ${esc(a.valuta)} <span class="${fargeKlasse(a.endringDag)}" style="font-size:14px">${pst(a.endringDag, 2)}</span></div>
      </div>
      <div style="display:flex;gap:8px;align-items:flex-start">
        <div class="merke ${a.signal}">${SIGNALTEKST[a.signal]}<small>${tall(a.score, 0)}/100</small></div>
        <button class="lukk" aria-label="Lukk">×</button>
      </div>
    </div>
    ${graf}
    <div class="forklaring"><span><i style="background:var(--kurs)"></i>Kurs</span><span><i style="background:var(--sma50)"></i>50-dagers snitt</span><span><i style="background:var(--sma200)"></i>200-dagers snitt</span></div>
    <div class="grunner">
      <div><h3 class="opp">Taler for</h3>${liste(a.begrunnelse.pluss)}</div>
      <div><h3 class="ned">Taler mot</h3>${liste(a.begrunnelse.minus)}</div>
    </div>
    <div class="nokkel">
      ${n("1 mnd", pst(a.tek.mom1))}${n("3 mnd", pst(a.tek.mom3))}${n("6 mnd", pst(a.tek.mom6))}${n("12 mnd (uten siste mnd)", pst(a.tek.mom12_1))}
      ${n("Mot OSEBX 6 mnd", pst(a.tek.relStyrke6m))}${n("Fra 52-ukers topp", pst(a.tek.fraTopp))}${n("RSI (14 d)", tall(a.tek.rsi14, 0))}${n("Svingninger (år)", pst(a.tek.vol60, 0, false))}
      ${n("P/E", tall(a.fund.pe, 1))}${n("P/B", tall(a.fund.pb, 2))}${n("Direkteavkastning", pst(a.fund.utbytte, 1, false))}${n("Egenkapitalavk.", pst(a.fund.roe, 0, false))}
      ${n("Markedsverdi", a.fund.markedsverdiMrd == null ? "–" : `${tall(a.fund.markedsverdiMrd, 1)} mrd`)}${n("Omsetning/dag", `${tall(a.tek.omsetningMNOK, 1)} MNOK`)}
    </div>
    <h3>Score: ${tall(a.score, 0)} = teknisk ${tall(a.tekniskScore, 0)}${a.fundamentalScore != null ? ` · fundamental ${tall(a.fundamentalScore, 0)}` : ""}</h3>
    <p class="hjelp">Hver delscore viser plasseringen mot de andre aksjene. 100 er best av alle, 50 er midt på treet.</p>
    ${delscorer}
    <div class="detalj-knapper">
      <button class="knapp ${eier(a.t) ? "sekundar" : ""}" id="eierKnapp">${eier(a.t) ? "Fjern fra porteføljen" : "★ Jeg eier denne"}</button>
      <a class="knapp sekundar" style="text-decoration:none;display:inline-block;color:var(--tekst);background:var(--flate2);border-radius:10px;padding:8px 14px;font-weight:600;font-size:14px" href="https://finance.yahoo.com/quote/${encodeURIComponent(a.t)}.OL" target="_blank" rel="noopener">Se på Yahoo Finance ↗</a>
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
}

$("#detalj").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.currentTarget.close(); // klikk utenfor lukker
});

// ---------- Portefølje ----------

function handlingFor(a, p) {
  const gevinst = p.kurs ? a.kurs / p.kurs - 1 : null;
  if (a.signal === "SELG") {
    return { tekst: "Vurder å selge: svak trend eller momentum", klasse: "ned" };
  }
  if (a.signal === "KJØP") return { tekst: gevinst != null && gevinst > 0.5 ? "Behold, men vurder å ta ut noe gevinst" : "Behold, eller kjøp mer", klasse: "opp" };
  return { tekst: a.score < 40 ? "Behold, men følg med: signalet svekkes" : "Behold", klasse: "" };
}

function visPortefolje() {
  if (!data) return;
  let verdi = 0, kost = 0, verdiMedKost = 0;
  const rader = portefolje.map((p) => {
    const a = data.aksjer.find((x) => x.t === p.t);
    if (!a) {
      return `<div class="beholdning-rad"><div><b>${esc(p.t)}</b><div class="handling">Finnes ikke i analysen</div></div><div></div><button class="slett" data-slett="${esc(p.t)}" aria-label="Fjern">×</button></div>`;
    }
    const h = handlingFor(a, p);
    let tallTekst = "";
    if (p.antall) {
      const v = p.antall * a.kurs;
      verdi += v;
      tallTekst = `${tall(v, 0)} kr`;
      if (p.kurs) {
        kost += p.antall * p.kurs;
        verdiMedKost += v;
        const g = a.kurs / p.kurs - 1;
        tallTekst += `<br><small class="${fargeKlasse(g)}">${pst(g)}</small>`;
      }
    }
    return `<div class="beholdning-rad">
      <div class="rad-klikk" data-t="${esc(a.t)}" style="cursor:pointer">
        <b>${esc(a.navn)}</b> <span class="mono" style="color:var(--dempet)">${esc(a.t)}</span>
        <div class="handling ${h.klasse}">${esc(h.tekst)}</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <div class="tall" style="text-align:right;font-size:13px">${tallTekst}</div>
        <div class="merke ${a.signal}">${SIGNALTEKST[a.signal]}<small>${tall(a.score, 0)}</small></div>
      </div>
      <button class="slett" data-slett="${esc(a.t)}" aria-label="Fjern">×</button>
    </div>`;
  });
  let html = rader.length ? rader.join("") : `<p class="tom">Du har ikke lagt til noen aksjer ennå.</p>`;
  if (verdi > 0) {
    html += `<div class="sum">Verdi <b class="tall">${tall(verdi, 0)} kr</b>${kost > 0 ? ` · avkastning <span class="${fargeKlasse(verdiMedKost / kost - 1)}">${pst(verdiMedKost / kost - 1)}</span> (for aksjer med kjøpskurs)` : ""}</div>`;
  }
  // Sektorvarsel
  const sektorer = portefolje.map((p) => data.aksjer.find((a) => a.t === p.t)?.sektor).filter(Boolean);
  const telling = sektorer.reduce((m, s) => ((m[s] = (m[s] || 0) + 1), m), {});
  const tung = Object.entries(telling).find(([, n]) => sektorer.length >= 3 && n / sektorer.length > 0.5);
  if (tung) html += `<p class="hjelp" style="margin-top:10px">⚠️ Over halvparten av aksjene dine er i <b>${esc(tung[0])}</b>. Vurder å spre risikoen.</p>`;
  $("#beholdning").innerHTML = html;

  // Høyst to forslag per sektor, så porteføljen ikke blir ensidig
  const perSektor = {};
  sektorer.forEach((s) => (perSektor[s] = (perSektor[s] || 0) + 1));
  const forslag = data.aksjer
    .filter((a) => a.signal === "KJØP" && !eier(a.t))
    .filter((a) => (perSektor[a.sektor] = (perSektor[a.sektor] || 0) + 1) <= 2)
    .slice(0, 8);
  $("#forslag").innerHTML = forslag.length ? forslag.map(radHtml).join("") : `<p class="tom">Ingen KJØP-signaler akkurat nå.</p>`;
}

$("#beholdning").addEventListener("click", (e) => {
  const s = e.target.closest("[data-slett]");
  if (s) {
    portefolje = portefolje.filter((p) => p.t !== s.dataset.slett);
    lagrePortefolje(portefolje);
    visPortefolje();
    visListe();
    return;
  }
  const r = e.target.closest(".rad-klikk");
  if (r) visDetalj(r.dataset.t);
});

$("#leggTil").addEventListener("submit", (e) => {
  e.preventDefault();
  const t = $("#ltTicker").value.trim().toUpperCase().replace(/\.OL$/, "");
  if (!t) return;
  const antall = parseFloat($("#ltAntall").value) || null;
  const kurs = parseFloat($("#ltKurs").value) || null;
  portefolje = portefolje.filter((p) => p.t !== t);
  portefolje.push({ t, antall, kurs });
  lagrePortefolje(portefolje);
  e.target.reset();
  visPortefolje();
  visListe();
});

// ---------- Historisk test ----------

function visTest() {
  const h = data.historiskTest;
  const css = getComputedStyle(document.documentElement);
  const graf = linjegraf(
    [
      { verdier: h.kurve.map((p) => p.likevekt), farge: "#94a3b8", bredde: 1.3, stiplet: true },
      { verdier: h.kurve.map((p) => p.osebx), farge: css.getPropertyValue("--sma200").trim() },
      { verdier: h.kurve.map((p) => p.strategi), farge: css.getPropertyValue("--aksent").trim(), bredde: 2.2 },
    ],
    h.kurve.map((p) => p.dato.slice(0, 7)),
    { hoyde: 260, prosent: true },
  );
  const rad = (navn, s) => `<tr><td>${navn}</td><td class="tall">${pst(s.aarlig)}</td><td class="tall">${pst(s.totalt, 0)}</td><td class="tall ned">${pst(s.maksFall)}</td></tr>`;
  const g = h.signalgrupper;
  const grad = (s) => `<tr><td><span class="merke ${s}" style="min-width:0">${SIGNALTEKST[s]}</span></td><td class="tall">${pst(g[s].snittMnd, 2)}</td><td class="tall">${pst(g[s].andelPositiv, 0, false)}</td><td class="tall">${g[s].antall}</td></tr>`;

  $("#test").innerHTML = `
    <h2>Har modellen virket før?</h2>
    <p class="hjelp">Den tekniske delen av modellen er kjørt måned for måned fra ${esc(h.fra)} til ${esc(h.til)} (${tall(h.aar, 1)} år).
      Hver måned brukes bare kurser som var kjent på det tidspunktet. ${esc(h.beskrivelse)}</p>
    ${graf}
    <div class="forklaring"><span><i style="background:var(--aksent)"></i>Modellportefølje</span><span><i style="background:var(--sma200)"></i>OSEBX</span><span><i style="background:#94a3b8"></i>Alle aksjene likt vektet</span></div>
    <div class="tabell-wrap"><table>
      <tr><th></th><th>Per år</th><th>Totalt</th><th>Største fall</th></tr>
      ${rad("<b>Modellportefølje</b>", h.strategi)}${rad("OSEBX", h.osebx)}${rad("Alle likt vektet", h.likevekt)}
    </table></div>
    <p class="hjelp">Modellporteføljen slo OSEBX i ${pst(h.andelMndSlaarIndeks, 0, false)} av månedene.</p>

    <h3>Avkastning måneden etter et signal</h3>
    <div class="tabell-wrap"><table>
      <tr><th>Signal</th><th>Snitt neste mnd</th><th>Andel som steg</th><th>Antall signaler</th></tr>
      ${grad("KJØP")}${grad("HOLD")}${grad("SELG")}
    </table></div>

    <h3>Les dette før du stoler på tallene</h3>
    <ul class="hjelp" style="padding-left:18px">
      <li><b>Overlevelsesskjevhet:</b> Testen bruker dagens aksjeliste. Selskaper som gikk konkurs eller ble kjøpt opp underveis er ikke med. Det gjør alle tallene, også «alle likt vektet», bedre enn virkeligheten.</li>
      <li><b>Tilpasset i ettertid:</b> Vektene er valgt etter å ha sett hvilke faktorer som har virket i denne perioden. Momentum har virket i begge halvdeler av perioden og i mange andre markeder, men fremtiden kan bli annerledes.</li>
      <li><b>Høy risiko:</b> Modellen ender ofte opp med mange aksjer fra samme sektor (for eksempel shipping eller olje). Den kan falle kraftig når trenden snur.</li>
      <li>Utbytte er regnet med. Skatt, spread og kurspåvirkning er ikke regnet med. Nøkkeltallene (P/E o.l.) finnes ikke historisk og er derfor ikke testet.</li>
    </ul>`;
}

// ---------- Metode ----------

function visMetode() {
  const m = data.modell;
  const v = (o) => Object.entries(o).map(([k, w]) => `${DELNAVN[k] || k} ${Math.round(w * 100)} %`).join(", ");
  $("#metode").innerHTML = `
    <h2>Slik regnes signalene ut</h2>
    <p>Hver handelsdag etter børsslutt hentes ti års kurshistorikk og ferske nøkkeltall for ${data.aksjer.length} av de største og mest omsatte aksjene på Oslo Børs.
       Hver aksje får en score fra 0 til 100 som viser hvor godt den ligger an mot de andre.</p>
    <h3>1. Teknisk score (${Math.round(m.andelTeknisk * 100)} %)</h3>
    <p>${esc(v(m.vekterTeknisk))}. Kursene er justert for utbytte.</p>
    <ul>
      <li><b>Momentum:</b> Aksjer som har steget mye siste 6–12 måneder har en tendens til å fortsette litt til. Dette er en av de best dokumenterte effektene i aksjemarkedet. Den siste måneden holdes utenfor 12-månederstallet, fordi kortsiktige svingninger ofte snur.</li>
      <li><b>Trend:</b> Hvor langt kursen ligger over eller under 200-dagers glidende snitt. Det gir ekstra uttelling når kursen også er over 50-dagers snitt og 50-dagers snitt er over 200-dagers.</li>
    </ul>
    <h3>2. Fundamental score (${Math.round((1 - m.andelTeknisk) * 100)} %)</h3>
    <p>${esc(v(m.vekterFundamental))}. Billige, lønnsomme selskaper med godt utbytte får høy score. Selskaper med underskudd får lav score.</p>
    <h3>3. Signal</h3>
    <ul>
      <li><b class="opp">Kjøp:</b> score minst ${m.kjopGrense}, og kursen er over 200-dagers snitt.</li>
      <li><b class="ned">Selg:</b> score høyst ${m.selgGrense}, <i>eller</i> tydelig fallende trend. Det betyr at kursen er under 200-dagers snitt, 50-dagers snitt er under 200-dagers, og 12-måneders utviklingen er negativ.</li>
      <li><b>Hold:</b> alt annet.</li>
    </ul>
    <h3>Hvordan bruke det</h3>
    <ul>
      <li>Signalene er laget for å sjekkes omtrent én gang i måneden, ikke for dagshandel.</li>
      <li>Fordel pengene på mange aksjer (8–10) fra ulike sektorer. Én enkelt aksje kan gjøre det dårlig selv med et sterkt signal.</li>
      <li>Aksjer med under ${m.minOmsetningMNOK} MNOK i daglig omsetning er merket som lite likvide.</li>
      <li>Les kvartalsrapportene og nyhetene selv. Modellen vet ingenting om oppkjøp, emisjoner, rettssaker eller endringer i ledelsen.</li>
    </ul>
    ${data.mangler?.length ? `<p class="hjelp">Mangler data for: ${esc(data.mangler.join(", "))} (ofte fordi selskapet er nylig børsnotert).</p>` : ""}`;
}

start();
