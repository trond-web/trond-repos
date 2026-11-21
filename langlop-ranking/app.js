"use strict";

// Langløpsrankingen: viser rankingfilene som innsamlingen (innsamling/hent.mjs) lager.
// Feltene i rankingfilen: løper = [navn, klubb, nasjon, født, poeng, antallLøp, bestePlass, resultater]
//                         resultat = [løpsindeks, plass, tid i tideler, poeng, teller (1/0)]

const SIDE = 100;
const tilstand = { data: null, sesong: null, kjonn: "M", vist: SIDE, lopIndeks: null };
const $ = (s) => document.querySelector(s);

const MANEDER = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
const KORT_MND = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "des"];
const tallFormat = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const heltall = new Intl.NumberFormat("nb-NO");

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function tid(tideler) {
  const t = Math.round(tideler / 10);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function dato(iso, kort = false) {
  const [a, m, d] = iso.split("-").map(Number);
  return kort ? `${d}. ${KORT_MND[m - 1]}` : `${d}. ${MANEDER[m - 1]} ${a}`;
}

function merke(niva) {
  const tekst = { pro: "Pro Tour", challengers: "Challengers", fis: "FIS", turrenn: "Turrenn" }[niva] ?? niva;
  return `<span class="merke ${esc(niva)}">${esc(tekst)}</span>`;
}

function plassKlasse(p) {
  return p <= 3 ? `plass-${p}` : "";
}

function vinterAr() {
  return Number(tilstand.sesong.slice(0, 4)) + 1;
}

function alder(fodt) {
  return fodt ? vinterAr() - fodt : null;
}

// ---------- Lasting ----------

async function hentJson(url) {
  const svar = await fetch(url, { cache: "no-cache" });
  if (!svar.ok) throw new Error(`${url}: HTTP ${svar.status}`);
  return svar.json();
}

async function start() {
  try {
    const oversikt = await hentJson("data/sesonger.json");
    const valg = $("#sesong");
    valg.innerHTML = oversikt.sesonger.map((s) => `<option value="${esc(s.sesong)}">${esc(s.navn)}</option>`).join("");
    const fraAdresse = new URLSearchParams(location.search).get("sesong");
    // Tidlig i en ny sesong er det få løp. Da vises den nyeste sesongen med minst ti løp.
    const forvalgt =
      oversikt.sesonger.find((s) => s.sesong === fraAdresse) ??
      oversikt.sesonger.find((s) => s.lop >= 10) ??
      oversikt.sesonger[0];
    if (!forvalgt) throw new Error("Ingen sesonger med resultater ennå");
    valg.value = forvalgt.sesong;
    valg.addEventListener("change", () => lastSesong(valg.value));
    await lastSesong(forvalgt.sesong);
  } catch (feil) {
    $("#status").textContent = "klarte ikke å laste data";
    $("#rankingtabell tbody").innerHTML = `<tr><td colspan="6" class="tom">${esc(feil.message)}</td></tr>`;
  }
}

async function lastSesong(sesong) {
  $("#status").textContent = "laster …";
  const data = await hentJson(`data/ranking-${sesong}.json`);
  tilstand.data = data;
  tilstand.sesong = sesong;
  tilstand.vist = SIDE;
  tilstand.lopIndeks = null;
  const oppdatert = new Date(data.oppdatert);
  $("#status").textContent = `sesongen ${data.navn} · ${data.lop.length} løp · oppdatert ${oppdatert.toLocaleDateString("nb-NO", { day: "numeric", month: "long" })} kl. ${oppdatert.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}`;
  fyllNasjoner();
  visRanking();
  visLop();
  visRegler();
}

// ---------- Rangering ----------

function fyllNasjoner() {
  const telling = new Map();
  for (const kj of ["M", "K"]) for (const l of tilstand.data[kj]) if (l[2]) telling.set(l[2], (telling.get(l[2]) ?? 0) + 1);
  const valg = $("#nasjon");
  const forrige = valg.value;
  valg.innerHTML =
    `<option value="">Alle nasjoner</option>` +
    [...telling.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([n, a]) => `<option value="${esc(n)}">${esc(n)} (${heltall.format(a)})</option>`)
      .join("");
  if (telling.has(forrige)) valg.value = forrige;
}

function filtrertRanking() {
  const liste = tilstand.data[tilstand.kjonn];
  const sok = $("#sok").value.trim().toLowerCase();
  const nasjon = $("#nasjon").value;
  const [fra, til] = ($("#alder").value || "-").split("-").map((x) => (x === "" ? null : Number(x)));
  const ut = [];
  liste.forEach((l, i) => {
    if (sok && !`${l[0]} ${l[1]}`.toLowerCase().includes(sok)) return;
    if (nasjon && l[2] !== nasjon) return;
    if (fra !== null || til !== null) {
      const a = alder(l[3]);
      if (a === null) return;
      if (fra !== null && a < fra) return;
      if (til !== null && a > til) return;
    }
    ut.push([i + 1, l]);
  });
  return ut;
}

function visRanking() {
  const rader = filtrertRanking();
  const tbody = $("#rankingtabell tbody");
  const filtrert = $("#sok").value || $("#nasjon").value || $("#alder").value;
  $("#rankinghint").textContent = `${heltall.format(rader.length)} ${tilstand.kjonn === "M" ? "menn" : "kvinner"}${filtrert ? " i utvalget" : " rangert"}. # er plassering i hele rankingen. Trykk på en løper for alle resultatene.`;
  if (rader.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="tom">Ingen løpere passer søket.</td></tr>`;
    $("#flere").hidden = true;
    return;
  }
  tbody.innerHTML = rader
    .slice(0, tilstand.vist)
    .map(([nr, l]) => {
      const info = [l[2], l[3] ? `f. ${l[3]}` : null].filter(Boolean).join(" · ");
      return `<tr class="klikk" data-nr="${nr}">
        <td class="tall ${plassKlasse(nr)}">${nr}</td>
        <td><div class="navn">${esc(l[0])}</div><div class="liten-tekst">${esc(info)}<span class="vis-smal"></span></div></td>
        <td class="skjul-smal">${esc(l[1])}</td>
        <td class="tall">${l[5]}</td>
        <td class="tall skjul-smal ${plassKlasse(l[6])}">${l[6]}.</td>
        <td class="tall poeng">${tallFormat.format(l[4])}</td>
      </tr>`;
    })
    .join("");
  $("#flere").hidden = rader.length <= tilstand.vist;
  $("#flere").textContent = `Vis flere (${heltall.format(rader.length - tilstand.vist)} til)`;
}

function visLoper(nr) {
  const l = tilstand.data[tilstand.kjonn][nr - 1];
  if (!l) return;
  const lop = tilstand.data.lop;
  const tellende = l[7].filter((r) => r[4]).length;
  $("#detalj-tittel").innerHTML = `<h2>${esc(l[0])}</h2><div class="liten-tekst">${esc([l[1], l[2], l[3] ? `født ${l[3]}` : null].filter(Boolean).join(" · "))}</div>`;
  const rader = l[7]
    .map((r) => {
      const lp = lop[r[0]];
      return `<tr class="klikk" data-lop="${r[0]}">
        <td class="tall">${dato(lp.dato, true)}</td>
        <td><div>${esc(lp.navn)}</div><div class="liten-tekst">${merke(lp.niva)} ${lp.km ? `${lp.km} km` : ""}</div></td>
        <td class="tall ${plassKlasse(r[1])}">${r[1]}.</td>
        <td class="tall skjul-smal">${tid(r[2])}</td>
        <td class="tall poeng ${r[4] ? "" : "ikke-tellende"}">${tallFormat.format(r[3])}</td>
      </tr>`;
    })
    .join("");
  $("#detalj-innhold").innerHTML = `
    <div class="nokkeltall">
      <div><b>${nr}.</b><span>plass i rankingen</span></div>
      <div><b>${tallFormat.format(l[4])}</b><span>sesongpoeng</span></div>
      <div><b>${l[5]}</b><span>løp</span></div>
      <div><b>${l[6]}.</b><span>beste plassering</span></div>
    </div>
    <p class="hint">${tellende} av ${l[5]} resultater teller (de ${tilstand.data.regler.besteAntall} beste). Overstrøkne poeng teller ikke. Trykk på et løp for hele resultatlisten.</p>
    <div class="tabellramme"><table class="tabell">
      <thead><tr><th class="tall">Dato</th><th>Løp</th><th class="tall">Plass</th><th class="tall skjul-smal">Tid</th><th class="tall">Poeng</th></tr></thead>
      <tbody>${rader}</tbody>
    </table></div>`;
  apneDetalj();
}

// ---------- Løp ----------

// Resultatlister per løp bygges fra løperlistene første gang de trengs.
function lopIndeks() {
  if (tilstand.lopIndeks) return tilstand.lopIndeks;
  const indeks = { M: tilstand.data.lop.map(() => []), K: tilstand.data.lop.map(() => []) };
  for (const kj of ["M", "K"]) {
    tilstand.data[kj].forEach((l, i) => {
      for (const r of l[7]) indeks[kj][r[0]].push([i + 1, l, r]);
    });
    for (const liste of indeks[kj]) liste.sort((a, b) => a[2][1] - b[2][1] || a[2][2] - b[2][2]);
  }
  tilstand.lopIndeks = indeks;
  return indeks;
}

function visLop() {
  const sok = $("#lopsok").value.trim().toLowerCase();
  const niva = $("#niva").value;
  const indeks = lopIndeks();
  const lop = tilstand.data.lop
    .map((l, i) => [i, l])
    .filter(([, l]) => (!niva || l.niva === niva) && (!sok || `${l.navn} ${l.arrangement} ${l.sted ?? ""} ${l.land ?? ""}`.toLowerCase().includes(sok)))
    .reverse();
  if (lop.length === 0) {
    $("#lopliste").innerHTML = `<div class="tom">Ingen løp passer søket.</div>`;
    return;
  }
  let maned = "";
  const html = [];
  for (const [i, l] of lop) {
    const m = l.dato.slice(0, 7);
    if (m !== maned) {
      maned = m;
      html.push(`<div class="maned">${MANEDER[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}</div>`);
    }
    const vinner = (kj) => {
      const v = indeks[kj][i][0];
      return v ? `${kj === "M" ? "♂" : "♀"} ${esc(v[1][0])} ${tid(v[2][2])}` : "";
    };
    const [a, mnd, d] = l.dato.split("-");
    html.push(`<button class="lopkort" data-lop="${i}">
      <div class="dato"><b>${Number(d)}</b>${KORT_MND[Number(mnd) - 1]}${l.datoAnslatt ? "*" : ""}</div>
      <div class="info">
        <div class="tittel">${esc(l.navn)}</div>
        <div class="vinnere">${[vinner("M"), vinner("K")].filter(Boolean).join(" · ")}</div>
      </div>
      <div class="hoyre">${merke(l.niva)}<br>${[l.km ? `${l.km} km` : null, l.land].filter(Boolean).join(" · ")}<br>${heltall.format(l.antall.M + l.antall.K)} i mål</div>
    </button>`);
  }
  $("#lopliste").innerHTML = html.join("");
}

function visLopDetalj(i, kjonn = tilstand.kjonn) {
  const l = tilstand.data.lop[i];
  const liste = lopIndeks()[kjonn][i];
  const vekt = l.vekt[kjonn];
  $("#detalj-tittel").innerHTML = `<h2>${esc(l.navn)}</h2><div class="liten-tekst">${dato(l.dato)}${l.datoAnslatt ? " (anslått dato)" : ""} · ${esc([l.km ? `${l.km} km` : null, l.sted, l.land].filter(Boolean).join(" · "))}</div>`;
  const rader = liste
    .slice(0, 1000)
    .map(([nr, p, r]) => `<tr class="klikk" data-nr="${nr}" data-kjonn="${kjonn}">
        <td class="tall ${plassKlasse(r[1])}">${r[1]}.</td>
        <td><div class="navn">${esc(p[0])}</div><div class="liten-tekst">${esc(p[1])}</div></td>
        <td class="tall">${tid(r[2])}</td>
        <td class="tall poeng">${tallFormat.format(r[3])}</td>
        <td class="tall skjul-smal">${nr}.</td>
      </tr>`)
    .join("");
  $("#detalj-innhold").innerHTML = `
    <div class="kontroller">
      <div class="kjonn" role="group" aria-label="Kjønn">
        <button data-lopkjonn="M" data-lop="${i}" class="${kjonn === "M" ? "aktiv" : ""}">Menn (${heltall.format(l.antall.M)})</button>
        <button data-lopkjonn="K" data-lop="${i}" class="${kjonn === "K" ? "aktiv" : ""}">Kvinner (${heltall.format(l.antall.K)})</button>
      </div>
      ${merke(l.niva)}
    </div>
    <p class="hint">${vekt ? `Løpsvekt ${String(vekt).replace(".", ",")} (feltstyrke ${String(l.felt[kjonn]).replace(".", ",")}).` : "For få i mål til å gi poeng."} Siste kolonne er plassering i sesongrankingen.</p>
    <div class="lenker"><a href="${esc(l.url)}" target="_blank" rel="noopener">Offisielle resultater</a>${l.scUrl ? `<a href="${esc(l.scUrl)}" target="_blank" rel="noopener">Ski Classics</a>` : ""}</div>
    ${liste.length ? `<div class="tabellramme"><table class="tabell">
      <thead><tr><th class="tall">Plass</th><th>Løper</th><th class="tall">Tid</th><th class="tall">Poeng</th><th class="tall skjul-smal">Rank</th></tr></thead>
      <tbody>${rader}</tbody>
    </table></div>${liste.length > 1000 ? `<p class="hint">Viser de 1000 første av ${heltall.format(liste.length)}.</p>` : ""}` : `<div class="tom">Ingen resultater.</div>`}`;
  apneDetalj();
}

// ---------- Regler ----------

function visRegler() {
  const r = tilstand.data.regler;
  const komma = (x) => String(x).replace(".", ",");
  $("#r-beste").textContent = r.besteAntall;
  $("#r-eks").textContent = r.eksponent;
  $("#r-bonus").textContent = r.bonus.map((b, i) => `${i + 1}.: ${b}`).join("  ·  ");
  $("#r-felt").textContent = `${komma(r.feltMin)}–1,0`;
  $("#tidstabell tbody").innerHTML = [0, 2, 5, 10, 20, 30, 50, 100]
    .map((p) => `<tr><td>${p === 0 ? "Vinner" : `${p} %`}</td><td class="tall">${tallFormat.format(100 * (1 / (1 + p / 100)) ** r.eksponent)}</td></tr>`)
    .join("");
  $("#r-niva").innerHTML = Object.entries(r.niva)
    .map(([k, v]) => `<tr><td>${merke(k)} ${esc(tilstand.data.nivaNavn[k])}</td><td class="tall">${komma(v.toFixed(1))}</td></tr>`)
    .join("");
  const d = [...r.distanse].reverse();
  $("#r-distanse").innerHTML = d
    .map(([km, v], i) => `<tr><td>${i < d.length - 1 ? `${km}–${d[i + 1][0] - 1} km` : `${km} km og lengre`}</td><td class="tall">${komma(v.toFixed(1))}</td></tr>`)
    .join("");
}

// ---------- Dialog og hendelser ----------

function apneDetalj() {
  const d = $("#detalj");
  if (!d.open) d.showModal();
  d.scrollTop = 0;
}

$("#lukk").addEventListener("click", () => $("#detalj").close());
$("#detalj").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.currentTarget.close();
  const kjonnKnapp = e.target.closest("[data-lopkjonn]");
  if (kjonnKnapp) return visLopDetalj(Number(kjonnKnapp.dataset.lop), kjonnKnapp.dataset.lopkjonn);
  const lopRad = e.target.closest("tr[data-lop]");
  if (lopRad) return visLopDetalj(Number(lopRad.dataset.lop));
  const loperRad = e.target.closest("tr[data-nr]");
  if (loperRad) {
    if (loperRad.dataset.kjonn && loperRad.dataset.kjonn !== tilstand.kjonn) settKjonn(loperRad.dataset.kjonn);
    visLoper(Number(loperRad.dataset.nr));
  }
});

document.querySelectorAll(".faner button").forEach((knapp) =>
  knapp.addEventListener("click", () => {
    document.querySelectorAll(".faner button").forEach((b) => {
      b.classList.toggle("aktiv", b === knapp);
      b.setAttribute("aria-selected", String(b === knapp));
    });
    document.querySelectorAll(".fane").forEach((f) => f.classList.toggle("aktiv", f.id === `fane-${knapp.dataset.fane}`));
  }),
);

function settKjonn(kj) {
  tilstand.kjonn = kj;
  tilstand.vist = SIDE;
  document.querySelectorAll("#fane-ranking [data-kjonn]").forEach((b) => {
    b.classList.toggle("aktiv", b.dataset.kjonn === kj);
    b.setAttribute("aria-pressed", String(b.dataset.kjonn === kj));
  });
  visRanking();
}

document.querySelectorAll("#fane-ranking [data-kjonn]").forEach((b) => b.addEventListener("click", () => settKjonn(b.dataset.kjonn)));

let sokTimer;
for (const id of ["#sok", "#nasjon", "#alder"]) {
  $(id).addEventListener(id === "#sok" ? "input" : "change", () => {
    clearTimeout(sokTimer);
    sokTimer = setTimeout(() => {
      tilstand.vist = SIDE;
      visRanking();
    }, 150);
  });
}
$("#lopsok").addEventListener("input", () => visLop());
$("#niva").addEventListener("change", () => visLop());
$("#flere").addEventListener("click", () => {
  tilstand.vist += SIDE * 2;
  visRanking();
});
$("#rankingtabell tbody").addEventListener("click", (e) => {
  const rad = e.target.closest("tr[data-nr]");
  if (rad) visLoper(Number(rad.dataset.nr));
});
$("#lopliste").addEventListener("click", (e) => {
  const kort = e.target.closest("[data-lop]");
  if (kort) visLopDetalj(Number(kort.dataset.lop));
});

start();
