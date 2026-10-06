/* Therese & Helge – kjærlighet, økomat, randonee og stein. Alt lagres lokalt i nettleseren. */
(() => {
  "use strict";

  const KEY = "therese-helge-v1";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => Math.round(n).toLocaleString("nb-NO");
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const uid = () => Math.random().toString(36).slice(2, 10);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const dayIndex = () => Math.floor(Date.now() / 86400000);

  /* ---------------- Lagring ---------------- */
  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const SEED = {
    startDate: "2024-02-14",
    moods: {},
    trips: [
      { id: uid(), name: "Kvitegga", date: daysAgo(190), type: "randonee", vert: 1050, cond: "Pudder til knærne", coffee: "Helge", romance: 5, rock: "Gneis med kvartsårer", ex: true },
      { id: uid(), name: "Romsdalseggen", date: daysAgo(80), type: "fjelltur", vert: 970, cond: "Sol og tørr sti", coffee: "Therese", romance: 4, rock: "Øyegneis (den så på oss)", ex: true },
      { id: uid(), name: "Slogen", date: daysAgo(25), type: "topptur", vert: 1560, cond: "Vestlandsvær", coffee: "Therese", romance: 3, rock: "", ex: true },
    ],
    wishes: [
      { id: uid(), name: "Store Skagastølstind", height: 2405, done: false, ex: true },
      { id: uid(), name: "Kebnekaise", height: 2097, done: false, ex: true },
    ],
    shop: [
      { id: uid(), name: "Havregryn", eco: true, bought: false, ex: true },
      { id: uid(), name: "Mørk sjokolade 70 %", eco: true, bought: false, ex: true },
      { id: uid(), name: "Rødbeter fra Valdres", eco: true, bought: false, ex: true },
      { id: uid(), name: "Kaffe, lysbrent", eco: true, bought: true, ex: true },
      { id: uid(), name: "Grillpølser", eco: false, bought: false, ex: true },
    ],
    notes: [
      { id: uid(), from: "helge", text: "Takk for at du bar primusen opp Slogen. Og for at du lot meg tro at det var jeg som fant ruta.", date: daysAgo(24), ex: true },
      { id: uid(), from: "therese", text: "Du er som larvikitt: blank, vakker og litt for tung å bære i sekken. Jeg gjør det likevel.", date: daysAgo(10), ex: true },
    ],
    challenges: {},
    quiz: { i: 0, score: 0, answered: 0 },
  };

  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)) || null; } catch { state = null; }
  state = Object.assign(structuredClone(SEED), state || {});
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* privat modus */ } };

  const toastEl = $("#toast");
  let toastT;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  /* ---------------- Innhold ---------------- */
  const COMPLIMENTS = [
    "{n}, du er min granitt: hard i kantene, glitrende inni, og jeg ville aldri byttet deg mot sandstein.",
    "Vi er ikke en forkastning, {n}. Vi er en foldning. Presset gjorde oss bare vakrere.",
    "{n}, du har høyere hardhet enn kvarts på Mohs' skala. Jeg har prøvd å ripe deg. Det gikk ikke.",
    "Hvis kjærlighet var erosjon, ville jeg vært Geirangerfjorden innen fredag, {n}.",
    "{n}, du er grunnen til at jeg går 1400 høydemeter for 400 meter med sving.",
    "Du er den eneste morenen jeg vil bli avsatt sammen med, {n}.",
    "{n}, min kjærlighet til deg har lengre halveringstid enn uran-238. Det er 4,5 milliarder år. Bare så du vet det.",
    "Jeg elsker deg mer enn Debio-merket havregryn, {n}. Og det sier ikke lite.",
    "{n}, du gjør meg magmatisk. Varm innvendig, og litt eksplosiv på søndager.",
    "Andre ser en stein. Du ser en rombeporfyr fra perm. Det er derfor jeg elsker deg, {n}.",
    "{n}, du er firn: gammel snø med erfaring, på god vei til å bli noe varig.",
    "Selv på faregrad 3 velger jeg deg, {n}. Med sonde, spade og hele hjertet.",
    "{n}, når du smører skinfellene, smelter isbreen i meg.",
    "Du er mitt kontinentalskjold, {n}. Stabil siden prekambrium og helt umulig å subdusere.",
    "{n}, selv bruddskare blir fin når du går foran og lager spor.",
    "Du er den økologiske gulroten i et liv fullt av importerte agurker, {n}.",
    "{n}, jeg vil dele den siste Kvikk Lunsj-biten med deg. Det er det mest romantiske en nordmann kan si.",
    "Vi er som obsidian, {n}: avkjølt så fort av forelskelse at det aldri rakk å krystallisere seg til noe kjedelig.",
    "{n}, du er mitt magnetiske nord. Kompasset mitt peker riktignok 3 grader feil, men det er ikke din skyld.",
    "Når vi står på toppen sammen, {n}, er utsikten nummer to.",
  ];

  const DANGER = [
    null,
    { t: "Liten fare", d: "Generelt stabilt kjærlighetsdekke. Fri ferdsel i hverandres armer. Fare for spontan kyssing i hengene." },
    { t: "Moderat fare", d: "Lokale svake lag av lavt blodsukker. Unngå å diskutere hvem som glemte termosen. Anbefalt tiltak: sjokolade." },
    { t: "Betydelig fare", d: "Ustabile flak av sult og trøtthet. Fjernutløsning mulig med ett feil ord om rutevalg. Spis noe økologisk og si unnskyld." },
    { t: "Stor fare", d: "Naturlig utløste sukk forventes. Hold dere i slakt terreng: sofa, pledd og pannekaker. Ikke start en diskusjon om kartlesing." },
    { t: "Meget stor fare", d: "Ekstraordinær situasjon. All ferdsel frarådes, unntatt til kjøleskapet. Klem umiddelbart, deretter middag, deretter snakk." },
  ];

  const ADV = {
    act: ["Randonee til en topp dere aldri har vært på", "Soloppgangstur med hodelykt", "Fjelltur med telt og kun ett liggeunderlag (bevisst)", "Toppturkveld med månelys og pannelampe", "Skredkurs-date (det mest romantiske er overlevelse)", "Lang dagstur langs en morenerygg", "Bretur med fører og tau mellom hjertene"],
    food: ["økologisk reinsdyrgryte på primus", "nybakt surdeigsbrød med økologisk smør", "rødbetsuppe fra Valdres-rødbeter", "havregrøt med økologiske blåbær fra sist høst", "kanelboller som bare har vært i sekken i fire timer", "linsedal i termos"],
    rock: ["finn en stein formet som et hjerte", "pek ut tre bergarter før dere får kaffe", "finn skuringsstriper og gjett breretningen", "finn en flyttblokk og gi den navn", "let etter granater i glimmerskiferen", "bestem hvilken bergart den andre ligner mest på i dag"],
    twist: ["Den som kommer sist til toppen bærer ingenting ned.", "Ingen telefon før toppen. Unntak: Varsom.no.", "Den som får flest steiner i sekken, velger film i kveld.", "Hver hårnålssving = ett kompliment.", "Snakk kun i geologiske metaforer i en hel time.", "Kaffen kokes av den som tapte steinquizen."],
  };

  const CHALLENGES = [
    "Lag en helt økologisk middag sammen, fra handlelista til oppvasken.",
    "Smør den andres ski eller impregner den andres sko uten å bli spurt.",
    "Skriv en kjærlighetslapp og legg den i den andres topplokk.",
    "Gå en kveldstur og nevn tre ting dere er takknemlige for.",
    "Planlegg neste topptur sammen med kart, Varsom og te.",
    "Gi den andre en stein med en forklaring på hvorfor den minner om dem.",
    "Spis frokost uten mobil, men med stearinlys.",
    "Lag hjemmelaget turmiks av økologiske nøtter og rosiner.",
    "Gi 10 minutters massasje til de leggene som bar dere opp.",
    "Se en naturdokumentar og ta en drøy pause når det kommer en vulkan.",
    "Kjøp eller plukk blomster. Fjellblomster skal stå, så butikk eller hage.",
    "Ta et bilde sammen på en topp eller utsiktspunkt.",
    "Lag en spilleliste til bilturen opp til fjellet.",
    "Si «jeg er stolt av deg» og forklar hvorfor, i minst tre setninger.",
  ];

  const RECIPES = [
    { name: "Topptur-grøt med kardemomme", time: "10 min på primus", ing: ["Havregryn", "Økologisk melk", "Blåbær", "Kardemomme", "Valnøtter", "Honning"], joke: "Holder dere varme til toppen. Kjærligheten holder resten av veien." },
    { name: "Rødbet- og linsesuppe i termos", time: "40 min hjemme", ing: ["Rødbeter", "Røde linser", "Løk", "Hvitløk", "Ingefær", "Grønnsaksbuljong"], joke: "Rød som alpenglød. Og som kinnene etter 1200 høydemeter." },
    { name: "Reinsdyrwrap med tyttebær", time: "15 min", ing: ["Reinsdyrkjøtt", "Fullkornstortilla", "Tyttebær", "Rødløk", "Rømme", "Spinat"], joke: "Smaker best på en stein med utsikt. Gjerne gabbro." },
    { name: "Fjellbrød med frø", time: "1 time + heving", ing: ["Speltmel", "Solsikkefrø", "Linfrø", "Gresskarkjerner", "Gjær", "Havsalt"], joke: "Like tett og stabilt som forholdet deres. Bare mindre romantisk." },
    { name: "Turmiks «Sedimentær kjærlighet»", time: "5 min", ing: ["Mandler", "Hasselnøtter", "Rosiner", "Mørk sjokolade 70 %", "Tørkede aprikoser", "Kokoschips"], joke: "Lagdelt i posen som en ekte sedimentbergart. Spis fra toppen og ned gjennom tidsepokene." },
    { name: "Stekt røye med smørdampet poteter", time: "30 min ved vannet", ing: ["Røye", "Nypoteter", "Smør", "Dill", "Sitron"], joke: "Røya fanget dere selv. Eller kjøpte dere den. Vi dømmer ikke." },
  ];

  const SEASON = {
    0: ["Kålrot", "Gulrot", "Poteter", "Løk", "Grønnkål"], 1: ["Kålrot", "Rødbeter", "Selleri", "Poteter"], 2: ["Lagret gulrot", "Purre", "Spirer"],
    3: ["Rabarbra", "Ramsløk", "Spirer"], 4: ["Rabarbra", "Asparges", "Reddiker", "Ramsløk"], 5: ["Jordbær", "Nypoteter", "Salat", "Asparges"],
    6: ["Jordbær", "Blåbær", "Erter", "Blomkål", "Nypoteter"], 7: ["Blåbær", "Bringebær", "Plommer", "Brokkoli", "Tomater"], 8: ["Tyttebær", "Epler", "Sopp", "Mais", "Gresskar"],
    9: ["Epler", "Pærer", "Kål", "Rødbeter", "Tyttebær"], 10: ["Kålrot", "Rosenkål", "Grønnkål", "Jordskokk"], 11: ["Kålrot", "Rødkål", "Poteter", "Gulrot"],
  };

  const ROCKS = [
    { r: "Granitt", k: "Dypbergart", d: "Solid, grovkornet og pålitelig. Dere tåler både frost og svigerforeldre." },
    { r: "Larvikitt", k: "Norges nasjonalbergart", d: "Blank og skimrende i lyset. I dag glitrer dere så mye at naboene må ha solbriller." },
    { r: "Gneis", k: "Omdannet bergart", d: "Dere har vært under trykk og kommet ut stripete og vakrere. Typisk etter en lang dag i bratt terreng." },
    { r: "Sandstein", k: "Sedimentær", d: "Litt porøs i dag. Fyll på med væske, sjokolade og klemmer før det smuldrer." },
    { r: "Obsidian", k: "Vulkansk glass", d: "Skarpe kanter, men helt gjennomsiktige følelser. Snakk sammen før noen skjærer seg." },
    { r: "Marmor", k: "Omdannet kalkstein", d: "Elegant og klassisk. Dagen for en ordentlig middag med duk og økologisk vin." },
    { r: "Basalt", k: "Lavabergart", d: "Varmt i bunn, stivnet fort. Noen trenger en lur før de blir mennesker igjen." },
    { r: "Rombeporfyr", k: "Oslofeltets stolthet", d: "Sjelden, særpreget og 300 millioner år gammel i ånden. Perfekt dag for et eventyr." },
    { r: "Kvartsitt", k: "Ekstremt hard", d: "Ingenting biter på dere i dag. Ta den bratteste renna. (Les skredvarselet først.)" },
    { r: "Leirskifer", k: "Lagdelt og flisete", d: "Dere sprekker lett i lag i dag. Unngå politikk og spørsmålet om hvem som pakket kartet." },
  ];

  const QUIZ = [
    { q: "Hva er Norges nasjonalbergart?", a: ["Granitt", "Larvikitt", "Kleberstein", "Rombeporfyr"], c: 1, f: "Larvikitt, kåret i 2008. Blank og blåskimrende, akkurat som øynene til den du elsker." },
    { q: "Hvilke tre mineraler dominerer granitt?", a: ["Kvarts, feltspat og glimmer", "Kalkspat, gips og salt", "Olivin, pyroksen og jern", "Diamant, gull og kjærlighet"], c: 0, f: "Kvarts, feltspat og glimmer. «Feltspat gir farge, kvarts gir glans, glimmer gir glitter, og Helge gir klem.»" },
    { q: "Hvor gammel er jorda, omtrent?", a: ["6000 år", "450 millioner år", "4,54 milliarder år", "Like gammel som Helges turjakke"], c: 2, f: "Rundt 4,54 milliarder år. Turjakka er bare nesten så gammel." },
    { q: "Hva kalles gammel, omkrystallisert snø på vei til å bli breis?", a: ["Firn", "Skare", "Sørpe", "Sludd med ambisjoner"], c: 0, f: "Firn. Et ord som også egner seg godt til å beskrive et modent forhold." },
    { q: "Hvilket mineral har hardhet 7 på Mohs' skala?", a: ["Talk", "Kalkspat", "Kvarts", "Diamant"], c: 2, f: "Kvarts. Talk er 1, diamant er 10, og kjærligheten deres går utenfor skalaen." },
    { q: "Hva er en morene?", a: ["En fisk i Mjøsa", "Løsmasser avsatt av en isbre", "En skisåle-voks", "En sur kjæreste etter bruddskare"], c: 1, f: "Løsmasser som breen har skjøvet og lagt igjen. Den sure kjæresten heter noe annet." },
    { q: "Hva har i hovedsak formet de norske fjordene?", a: ["Elver alene", "Isbreer", "Meteoritter", "Vikinger med spader"], c: 1, f: "Isbreer som gravde seg ned gjennom flere istider. Vikingene hjalp ikke til." },
    { q: "Hvor finner man særlig rombeporfyr?", a: ["Lofoten", "Finnmarksvidda", "Oslofeltet", "Svalbard"], c: 2, f: "Oslofeltet, fra vulkansk aktivitet i perm. Hilsen fra en riftdal som ga opp." },
    { q: "Hva er obsidian?", a: ["Vulkansk glass", "En type granitt", "Et fossil", "En dyr skismøring"], c: 0, f: "Vulkansk glass, lava som stivnet så fort at krystallene aldri rakk å danne seg." },
    { q: "Hva heter skredfaregrad 3?", a: ["Moderat", "Betydelig", "Stor", "Litt skummelt, kanskje"], c: 1, f: "Betydelig. Her skjer de fleste skredulykkene, så velg trygge heng og romantiske utsiktspunkter." },
  ];

  const MILESTONES = [
    { name: "Galdhøpiggen", m: 2469 },
    { name: "Mont Blanc", m: 4806 },
    { name: "Kilimanjaro", m: 5895 },
    { name: "Mount Everest", m: 8849 },
    { name: "Cruisehøyde for et fly til Tromsø", m: 10668 },
    { name: "Everest målt fra bunnen av Marianergropa", m: 19843 },
    { name: "Kármán-linjen (dere er i verdensrommet)", m: 100000 },
  ];

  const ERAS = [
    { max: 30, n: "Hadeikum", d: "Alt var lava og sommerfugler. Ingen fast grunn ennå." },
    { max: 180, n: "Arkaikum", d: "De første stabile kontinentene: felles tannbørsteholder og delt turkart." },
    { max: 365, n: "Proterozoikum", d: "Oksygen i atmosfæren. Dere puster ut sammen og deler termos uten å telle slurker." },
    { max: 730, n: "Paleozoikum", d: "Livet eksploderer: felles turutstyr, ønskelister og en fast primus." },
    { max: 1825, n: "Mesozoikum", d: "Dinosaurenes tid. Dere har innside-vitser som er like gamle som en Stegosaurus." },
    { max: Infinity, n: "Kenozoikum", d: "Pattedyrene tar over. Varmt, lodne ullsokker og et forhold som har overlevd flere istider." },
  ];

  const NOTE_IDEAS = [
    "Du er min favoritt-flyttblokk. Ingen istid kan flytte deg fra meg.",
    "Takk for at du alltid sjekker Varsom før du sjekker meg ut.",
    "Jeg elsker hvordan du blir glad av en stein. Jeg blir glad av deg.",
    "Du er det beste som har skjedd meg siden siste istid.",
    "Middag i kveld? Alt økologisk, unntatt hvor mye jeg liker deg. Det er overdrevent.",
    "Du gjør hver nedkjøring til en førstegangs-pudderdag.",
    "Jeg har kjøpt økologisk sjokolade. Den er din. Nesten all.",
  ];

  /* ---------------- Faner ---------------- */
  const tabs = $$(".tab");
  function showTab(id, push = true) {
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.getAttribute("aria-controls") === id)));
    $$(".panel").forEach((p) => (p.hidden = p.id !== id));
    if (push) try { history.replaceState(null, "", "#" + id); } catch { /* sandbox */ }
    if (id === "turer") drawProfile();
  }
  tabs.forEach((t) => t.addEventListener("click", () => { showTab(t.getAttribute("aria-controls")); window.scrollTo({ top: 0 }); }));

  /* ---------------- Hero ---------------- */
  function renderStats() {
    const days = Math.max(0, Math.floor((Date.now() - new Date(state.startDate).getTime()) / 86400000));
    $("#statDays").textContent = fmt(days);
    $("#statVert").textContent = fmt(state.trips.reduce((s, t) => s + (+t.vert || 0), 0));
    $("#statEco").textContent = ecoPct() + " %";
    $("#todayLabel").textContent = new Date().toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" });
    return days;
  }

  function drawContours() {
    const c = $("#contours");
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = r.width * dpr; c.height = r.height * dpr;
    const ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    const color = getComputedStyle(document.documentElement).getPropertyValue("--contour").trim();
    const glow = getComputedStyle(document.documentElement).getPropertyValue("--glow").trim();
    const w = r.width, h = r.height;
    // To topper (Therese og Helge) som deler de ytre koteringslinjene.
    const narrow = w < 560;
    const peaks = [{ x: w * (narrow ? 0.8 : 0.72), y: h * (narrow ? 0.1 : 0.38) }, { x: w * (narrow ? 0.95 : 0.9), y: h * (narrow ? 0.3 : 0.62) }];
    const field = (x, y) => peaks.reduce((s, p, i) => s + Math.exp(-(((x - p.x) ** 2) + ((y - p.y) ** 2)) / (2 * (i ? 95 : 120) ** 2)), 0)
      + 0.06 * Math.sin(x / 37) * Math.cos(y / 29);
    const step = 6;
    const cols = Math.ceil(w / step) + 1, rows = Math.ceil(h / step) + 1;
    const g = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) g[j * cols + i] = field(i * step, j * step);
    const levels = 14;
    for (let L = 1; L <= levels; L++) {
      const v = L / (levels + 1) * 1.15;
      ctx.beginPath();
      for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
        const a = g[j * cols + i], b = g[j * cols + i + 1], cc = g[(j + 1) * cols + i + 1], d = g[(j + 1) * cols + i];
        const idx = (a > v) | ((b > v) << 1) | ((cc > v) << 2) | ((d > v) << 3);
        if (idx === 0 || idx === 15) continue;
        const x = i * step, y = j * step;
        const lerp = (p, q) => (v - p) / (q - p);
        const pts = { t: [x + step * lerp(a, b), y], r: [x + step, y + step * lerp(b, cc)], b: [x + step * lerp(d, cc), y + step], l: [x, y + step * lerp(a, d)] };
        const segs = { 1: ["l", "t"], 2: ["t", "r"], 3: ["l", "r"], 4: ["r", "b"], 5: ["l", "t", "r", "b"], 6: ["t", "b"], 7: ["l", "b"], 8: ["b", "l"], 9: ["b", "t"], 10: ["t", "r", "b", "l"], 11: ["b", "r"], 12: ["r", "l"], 13: ["r", "t"], 14: ["t", "l"] }[idx];
        for (let k = 0; k < segs.length; k += 2) { ctx.moveTo(...pts[segs[k]]); ctx.lineTo(...pts[segs[k + 1]]); }
      }
      ctx.strokeStyle = L === levels - 3 ? glow : color;
      ctx.globalAlpha = L === levels - 3 ? 0.5 : 1;
      ctx.lineWidth = L % 5 === 0 ? 1.4 : 0.8;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Toppunkter
    ctx.fillStyle = glow;
    peaks.forEach((p, i) => {
      ctx.beginPath(); ctx.moveTo(p.x, p.y - 5); ctx.lineTo(p.x + 5, p.y + 4); ctx.lineTo(p.x - 5, p.y + 4); ctx.closePath(); ctx.fill();
      ctx.font = "600 10px 'IBM Plex Mono', monospace";
      ctx.fillText(i ? "H" : "T", p.x + 8, p.y + 4);
    });
  }

  /* ---------------- Oss to ---------------- */
  let complimentFor = dayIndex() % 2 ? "Helge" : "Therese";
  let complimentI = dayIndex() % COMPLIMENTS.length;
  function renderCompliment() {
    $("#compliment").textContent = COMPLIMENTS[complimentI].replace("{n}", complimentFor);
    $("#complimentFor").textContent = "Til " + (complimentFor === "Therese" ? "Helge" : "Therese") + " i stedet";
  }
  $("#complimentNext").addEventListener("click", () => { complimentI = (complimentI + 1 + Math.floor(Math.random() * (COMPLIMENTS.length - 1))) % COMPLIMENTS.length; renderCompliment(); });
  $("#complimentFor").addEventListener("click", () => { complimentFor = complimentFor === "Therese" ? "Helge" : "Therese"; renderCompliment(); });

  function renderMood() {
    const m = state.moods[todayISO()] || {};
    $$(".mood-btns").forEach((box) => {
      const who = box.dataset.who;
      box.innerHTML = [1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" aria-pressed="${m[who] === n}" aria-label="${who} humør ${n}">${n}</button>`).join("");
    });
    const vals = ["therese", "helge"].map((w) => m[w]).filter(Boolean);
    const badge = $("#dangerBadge");
    if (!vals.length) {
      badge.className = "danger-badge lvl-1"; badge.textContent = "?";
      $("#dangerTitle").textContent = "Ingen observasjoner i dag";
      $("#dangerText").textContent = "Varslerne har ikke vært ute i felt. Registrer dagsformen til begge for et fullstendig varsel.";
      return;
    }
    // Laveste humør styrer faren, akkurat som det svakeste laget i snødekket.
    const lvl = Math.min(5, Math.max(1, 6 - Math.min(...vals)));
    badge.className = "danger-badge lvl-" + lvl; badge.textContent = lvl;
    $("#dangerTitle").textContent = DANGER[lvl].t + (vals.length < 2 ? " (foreløpig)" : "");
    $("#dangerText").textContent = DANGER[lvl].d;
  }
  $("#hjem").addEventListener("click", (e) => {
    const b = e.target.closest(".mood-btns button");
    if (!b) return;
    const who = b.parentElement.dataset.who;
    const d = todayISO();
    state.moods[d] = Object.assign({}, state.moods[d], { [who]: +b.dataset.n });
    save(); renderMood();
  });

  function renderAdventure() {
    $("#adventure").innerHTML = `
      <p class="eyebrow">Forslag</p>
      <h3>${esc(pick(ADV.act))}</h3>
      <p><strong>Niste:</strong> ${esc(pick(ADV.food))}.</p>
      <p><strong>Geologisk oppdrag:</strong> ${esc(pick(ADV.rock))}.</p>
      <p class="muted"><strong>Regel:</strong> ${esc(pick(ADV.twist))}</p>`;
  }
  $("#adventureBtn").addEventListener("click", renderAdventure);

  function weekKey() {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const w1 = new Date(d.getFullYear(), 0, 4);
    const wk = 1 + Math.round(((d - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
    return { key: d.getFullYear() + "-" + wk, wk };
  }
  function renderChallenges() {
    const { key, wk } = weekKey();
    $("#challengeWeek").textContent = "Uke " + wk;
    const n = CHALLENGES.length;
    const ids = [0, 1, 2, 3, 4].map((k) => (wk * 5 + k * 3) % n).filter((v, i, a) => a.indexOf(v) === i);
    const done = state.challenges[key] || [];
    $("#challenges").innerHTML = ids.map((i) => `
      <label class="check ${done.includes(i) ? "done" : ""}"><input type="checkbox" id="ch-${i}" data-i="${i}" ${done.includes(i) ? "checked" : ""}><span>${esc(CHALLENGES[i])}</span></label>`).join("");
    $("#challengeMeter").style.width = (done.filter((d) => ids.includes(d)).length / ids.length * 100) + "%";
    $("#challenges").onchange = (e) => {
      const i = +e.target.dataset.i;
      const cur = new Set(state.challenges[key] || []);
      e.target.checked ? cur.add(i) : cur.delete(i);
      state.challenges[key] = [...cur];
      save(); renderChallenges();
      if (cur.size === ids.length) toast("Alle oppdrag fullført. Forholdet er offisielt fredet.");
    };
  }

  $("#startDate").value = state.startDate;
  $("#settingsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!$("#startDate").value) return;
    state.startDate = $("#startDate").value;
    save(); renderStats(); renderTimescale(); toast("Datoen er lagret");
  });
  $("#clearExamples").addEventListener("click", () => {
    ["trips", "wishes", "shop", "notes"].forEach((k) => (state[k] = state[k].filter((x) => !x.ex)));
    save(); renderAll(); toast("Eksemplene er fjernet. Nå er det deres egen historie.");
  });

  /* ---------------- Turer ---------------- */
  const exChip = (x) => (x.ex ? ' <span class="chip ex">eksempel</span>' : "");
  $("#tripDate").value = todayISO();
  $("#tripForm").addEventListener("submit", (e) => {
    e.preventDefault();
    state.trips.push({
      id: uid(), name: $("#tripName").value.trim(), date: $("#tripDate").value, type: $("#tripType").value,
      vert: +$("#tripVert").value || 0, cond: $("#tripCond").value, coffee: $("#tripCoffee").value,
      romance: Math.min(5, Math.max(1, +$("#tripRomance").value || 3)), rock: $("#tripRock").value.trim(),
    });
    save();
    const before = totalVert() - (+$("#tripVert").value || 0);
    const passed = MILESTONES.find((m) => before < m.m && totalVert() >= m.m);
    e.target.reset(); $("#tripDate").value = todayISO(); $("#tripRomance").value = 4;
    renderAll();
    toast(passed ? `Milepæl: dere har gått ${passed.name} sammen!` : "Turen er lagret. Kyss på toppen er registrert.");
  });
  const totalVert = () => state.trips.reduce((s, t) => s + (+t.vert || 0), 0);
  const TYPE = { randonee: "Randonee", fjelltur: "Fjelltur", topptur: "Topptur", langrenn: "Langrenn" };

  function renderTrips() {
    const list = [...state.trips].sort((a, b) => b.date.localeCompare(a.date));
    $("#tripList").innerHTML = list.length ? list.map((t) => `
      <li>
        <div class="grow">
          <div class="title">${esc(t.name)}${exChip(t)}</div>
          <div class="meta">${new Date(t.date).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" })} · ${TYPE[t.type] || t.type} · ${esc(t.cond)} · kaffe: ${esc(t.coffee)}</div>
        </div>
        <div class="right"><div class="num">${fmt(t.vert)} m</div><div class="chip love" title="Romantikk">${"♥".repeat(t.romance || 0)}</div></div>
        <button class="x" data-del-trip="${t.id}" aria-label="Slett ${esc(t.name)}">×</button>
      </li>`).join("") : `<li class="empty">Ingen turer ennå. Snøra på skoene!</li>`;

    const tv = totalVert();
    const coffee = state.trips.reduce((a, t) => ((a[t.coffee] = (a[t.coffee] || 0) + 1), a), {});
    const brewer = Object.entries(coffee).sort((a, b) => b[1] - a[1])[0];
    $("#vertSummary").textContent = `${fmt(tv)} m · ${state.trips.length} turer${brewer ? " · kaffesjef: " + brewer[0] : ""}`;
    $("#milestones").innerHTML = MILESTONES.map((m) => {
      const p = Math.min(100, (tv / m.m) * 100);
      const times = tv / m.m;
      return `<div class="ms ${p >= 100 ? "done" : ""}">
        <span class="name">${esc(m.name)}</span>
        <span class="num muted" style="font-size:.82rem">${times >= 1 ? times.toLocaleString("nb-NO", { maximumFractionDigits: 1 }) + "×" : fmt(m.m - tv) + " m igjen"}</span>
        <div class="meter glow"><span style="width:${p}%"></span></div></div>`;
    }).slice(0, Math.max(3, MILESTONES.findIndex((m) => tv < m.m) + 2)).join("");
  }
  $("#tripList").addEventListener("click", (e) => {
    const id = e.target.dataset.delTrip; if (!id) return;
    state.trips = state.trips.filter((t) => t.id !== id); save(); renderAll();
  });

  function drawProfile() {
    const c = $("#profile");
    const r = c.getBoundingClientRect();
    if (!r.width) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = r.width * dpr; c.height = r.height * dpr;
    const ctx = c.getContext("2d"); ctx.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const glow = css.getPropertyValue("--glow").trim(), line = css.getPropertyValue("--line").trim(), muted = css.getPropertyValue("--muted").trim();
    const trips = [...state.trips].sort((a, b) => a.date.localeCompare(b.date));
    const w = r.width, h = r.height, pad = { l: 4, r: 4, t: 18, b: 16 };
    ctx.clearRect(0, 0, w, h);
    ctx.font = "11px 'IBM Plex Mono', monospace";
    if (!trips.length) { ctx.fillStyle = muted; ctx.fillText("Høydeprofilen vokser når dere loggfører turer.", pad.l, h / 2); return; }
    let acc = 0;
    const pts = [[0, 0], ...trips.map((t) => [0, (acc += +t.vert || 0)])].map((p, i, a) => [pad.l + (i / (a.length - 1)) * (w - pad.l - pad.r), p[1]]);
    const max = acc || 1;
    const Y = (v) => h - pad.b - (v / max) * (h - pad.t - pad.b);
    ctx.strokeStyle = line; ctx.lineWidth = 1;
    [0.5, 1].forEach((f) => { ctx.beginPath(); ctx.moveTo(pad.l, Y(max * f)); ctx.lineTo(w - pad.r, Y(max * f)); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(pts[0][0], Y(0));
    pts.forEach(([x, v], i) => { if (i) { ctx.lineTo(x, Y(pts[i - 1][1]) ); ctx.lineTo(x, Y(v)); } });
    ctx.lineTo(pts.at(-1)[0], Y(0)); ctx.closePath();
    ctx.fillStyle = glow; ctx.globalAlpha = 0.15; ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.moveTo(pts[0][0], Y(0));
    pts.forEach(([x, v], i) => { if (i) { ctx.lineTo(x, Y(pts[i - 1][1])); ctx.lineTo(x, Y(v)); } });
    ctx.strokeStyle = glow; ctx.lineWidth = 2; ctx.stroke();
    const [ex, ev] = pts.at(-1);
    ctx.beginPath(); ctx.arc(ex - 1, Y(ev), 4, 0, Math.PI * 2); ctx.fillStyle = glow; ctx.fill();
    ctx.fillStyle = muted;
    ctx.fillText(fmt(max) + " m", pad.l, Y(max) - 5);
    ctx.fillText("start", pad.l, h - 3);
  }

  function renderWishes() {
    $("#wishList").innerHTML = state.wishes.length ? state.wishes.map((w) => `
      <li>
        <input type="checkbox" id="w-${w.id}" data-wish="${w.id}" ${w.done ? "checked" : ""} aria-label="Besteget ${esc(w.name)}" style="width:20px;height:20px;accent-color:var(--glow)">
        <div class="grow"><div class="title" style="${w.done ? "text-decoration:line-through" : ""}">${esc(w.name)}${exChip(w)}</div></div>
        <div class="right num muted">${w.height ? fmt(w.height) + " moh." : ""}</div>
        <button class="x" data-del-wish="${w.id}" aria-label="Slett ${esc(w.name)}">×</button>
      </li>`).join("") : `<li class="empty">Ønskelista er tom. Det er ikke lov.</li>`;
  }
  $("#wishForm").addEventListener("submit", (e) => {
    e.preventDefault();
    state.wishes.push({ id: uid(), name: $("#wishName").value.trim(), height: +$("#wishHeight").value || 0, done: false });
    save(); e.target.reset(); renderWishes();
  });
  $("#wishList").addEventListener("change", (e) => {
    const w = state.wishes.find((x) => x.id === e.target.dataset.wish); if (!w) return;
    w.done = e.target.checked; save(); renderWishes();
    if (w.done) toast(`${w.name} besteget! Husk toppkysset.`);
  });
  $("#wishList").addEventListener("click", (e) => {
    const id = e.target.dataset.delWish; if (!id) return;
    state.wishes = state.wishes.filter((w) => w.id !== id); save(); renderWishes();
  });

  /* ---------------- Øko-kjøkken ---------------- */
  function ecoPct() {
    const s = state.shop; if (!s.length) return 0;
    return Math.round((s.filter((x) => x.eco).length / s.length) * 100);
  }
  function renderShop() {
    const p = ecoPct();
    $("#ecoMeter").style.width = p + "%";
    $("#ecoLabel").textContent = p + " % økologisk";
    $("#ecoVerdict").textContent =
      p >= 100 ? "Fullstendig økologisk. Meitemarkene i Norge har reist en statue av dere." :
      p >= 80 ? "Strålende. Jordbunnen takker, og Helge får lov til én grillpølse." :
      p >= 50 ? "Godkjent, men det er rom for flere Debio-merker i kurven." :
      p > 0 ? "Hmm. Rødbetene ser skuffet på dere. Bytt ut noe med økologisk." :
      "Tom liste eller null øko. Selv en flyttblokk er mer bærekraftig.";
    const items = [...state.shop].sort((a, b) => a.bought - b.bought);
    $("#shopList").innerHTML = items.length ? items.map((s) => `
      <li>
        <input type="checkbox" id="s-${s.id}" data-shop="${s.id}" ${s.bought ? "checked" : ""} aria-label="Kjøpt ${esc(s.name)}" style="width:20px;height:20px;accent-color:var(--lichen)">
        <div class="grow"><div class="title" style="${s.bought ? "text-decoration:line-through;color:var(--muted)" : ""}">${esc(s.name)}${exChip(s)}</div></div>
        <button class="chip ${s.eco ? "eco" : ""}" data-toggle-eco="${s.id}" type="button" title="Bytt øko-status">${s.eco ? "ØKO" : "ikke øko"}</button>
        <button class="x" data-del-shop="${s.id}" aria-label="Slett ${esc(s.name)}">×</button>
      </li>`).join("") : `<li class="empty">Handlelista er tom. Kjøleskapet ekko.</li>`;
    renderStats();
  }
  $("#shopForm").addEventListener("submit", (e) => {
    e.preventDefault();
    state.shop.push({ id: uid(), name: $("#shopItem").value.trim(), eco: $("#shopEco").value === "1", bought: false });
    save(); $("#shopItem").value = ""; renderShop();
  });
  $("#shopList").addEventListener("change", (e) => {
    const s = state.shop.find((x) => x.id === e.target.dataset.shop); if (!s) return;
    s.bought = e.target.checked; save(); renderShop();
  });
  $("#shopList").addEventListener("click", (e) => {
    const t = e.target.dataset;
    if (t.toggleEco) { const s = state.shop.find((x) => x.id === t.toggleEco); s.eco = !s.eco; save(); renderShop(); if (s.eco) toast("Oppgradert til øko. En meitemark smiler."); }
    if (t.delShop) { state.shop = state.shop.filter((x) => x.id !== t.delShop); save(); renderShop(); }
  });
  $("#clearBought").addEventListener("click", () => { state.shop = state.shop.filter((s) => !s.bought); save(); renderShop(); });

  function renderRecipes() {
    $("#recipes").innerHTML = RECIPES.map((r, i) => `
      <div class="card recipe">
        <div class="section-head"><h3>${esc(r.name)}</h3><span class="chip eco">ØKO</span></div>
        <p class="eyebrow">${esc(r.time)}</p>
        <p class="ing">${r.ing.map(esc).join(" · ")}</p>
        <p class="joke">${esc(r.joke)}</p>
        <div><button class="btn btn-small" type="button" data-recipe="${i}">Legg på handlelista</button></div>
      </div>`).join("");
  }
  $("#recipes").addEventListener("click", (e) => {
    const i = e.target.dataset.recipe; if (i == null) return;
    const have = new Set(state.shop.map((s) => s.name.toLowerCase()));
    const add = RECIPES[i].ing.filter((n) => !have.has(n.toLowerCase()));
    add.forEach((n) => state.shop.push({ id: uid(), name: n, eco: true, bought: false }));
    save(); renderShop();
    toast(add.length ? `${add.length} økologiske varer lagt til` : "Alt står allerede på lista");
  });

  function renderSeason() {
    const m = new Date().getMonth();
    const name = new Date().toLocaleDateString("nb-NO", { month: "long" });
    $("#season").innerHTML = `
      <p class="eyebrow">I sesong i ${esc(name)}</p>
      <div class="btn-row">${SEASON[m].map((s) => `<span class="chip eco">${esc(s)}</span>`).join("")}</div>
      <p class="muted">Norske råvarer i sesong har kortere vei til tallerkenen. Velg økologisk, så har de også gått en kortere vei forbi sprøyta.</p>`;
  }

  /* ---------------- Geologi ---------------- */
  function renderRock(random) {
    const r = random ? pick(ROCKS) : ROCKS[dayIndex() % ROCKS.length];
    $("#rockCard").innerHTML = `
      <p class="eyebrow">${esc(r.k)}</p>
      <p class="quote">${esc(r.r)}</p>
      <p>${esc(r.d)}</p>`;
  }
  $("#rockBtn").addEventListener("click", () => renderRock(true));

  function renderQuiz() {
    const z = state.quiz;
    $("#quizScore").textContent = z.answered ? `${z.score} av ${z.answered} riktige` : `${QUIZ.length} spørsmål`;
    const q = QUIZ[z.i % QUIZ.length];
    $("#quiz").innerHTML = `
      <p class="eyebrow">Spørsmål ${(z.i % QUIZ.length) + 1} av ${QUIZ.length}</p>
      <h3>${esc(q.q)}</h3>
      <div class="quiz-opts">${q.a.map((a, i) => `<button type="button" data-a="${i}">${esc(a)}</button>`).join("")}</div>
      <p id="quizFeedback" class="muted" hidden></p>
      <div><button class="btn btn-small" type="button" id="quizNext" hidden>Neste spørsmål</button></div>`;
    $("#quiz .quiz-opts").onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const ok = +b.dataset.a === q.c;
      $$("#quiz .quiz-opts button").forEach((x, i) => { x.disabled = true; if (i === q.c) x.classList.add("right"); });
      if (!ok) b.classList.add("wrong");
      z.answered++; if (ok) z.score++;
      const fb = $("#quizFeedback");
      fb.hidden = false;
      fb.textContent = (ok ? "Riktig! " : "Feil, men vi elsker deg likevel. ") + q.f;
      $("#quizNext").hidden = false;
      $("#quizScore").textContent = `${z.score} av ${z.answered} riktige`;
      save();
    };
    $("#quizNext").onclick = () => {
      z.i++;
      if (z.i % QUIZ.length === 0) {
        toast(z.score / z.answered >= 0.8 ? "Steinhardt! Dere er offisielt geo-par." : "Runde ferdig. Taperen koker kaffen.");
        z.score = 0; z.answered = 0;
      }
      save(); renderQuiz();
    };
  }

  function renderRocks() {
    const rocks = state.trips.filter((t) => t.rock).sort((a, b) => b.date.localeCompare(a.date));
    $("#rockList").innerHTML = rocks.length ? rocks.map((t) => `
      <li><div class="grow"><div class="title">${esc(t.rock)}${exChip(t)}</div><div class="meta">Funnet på ${esc(t.name)}, ${new Date(t.date).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" })}</div></div></li>`).join("")
      : `<li class="empty">Ingen steiner ennå. Fyll ut «Fant vi en fin stein?» når dere loggfører en tur.</li>`;
  }

  function renderTimescale() {
    const days = Math.max(0, Math.floor((Date.now() - new Date(state.startDate).getTime()) / 86400000));
    let prev = 0;
    $("#timescale").innerHTML = ERAS.map((e) => {
      const now = days >= prev && days < e.max;
      const passed = days >= e.max;
      const range = e.max === Infinity ? `${fmt(prev)}+ dager` : `${fmt(prev)}–${fmt(e.max)} dager`;
      prev = e.max;
      return `<li><div class="grow"><div class="title">${esc(e.n)} ${now ? '<span class="chip love">dere er her</span>' : passed ? '<span class="chip eco">gjennomlevd</span>' : ""}</div>
        <div class="meta">${esc(e.d)}</div></div><div class="right num muted" style="font-size:.8rem">${range}</div></li>`;
    }).join("");
  }

  /* ---------------- Lapper ---------------- */
  function renderNotes() {
    const notes = [...state.notes].sort((a, b) => b.date.localeCompare(a.date));
    $("#noteCount").textContent = `${notes.length} lapper`;
    $("#notes").innerHTML = notes.length ? notes.map((n) => `
      <div class="note from-${n.from}">
        <p>${esc(n.text)}</p>
        <div class="meta"><span>Fra ${n.from === "therese" ? "Therese" : "Helge"} · ${new Date(n.date).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}${exChip(n)}</span>
        <button class="x" data-del-note="${n.id}" aria-label="Fjern lappen">×</button></div>
      </div>`).join("") : `<p class="empty">Kjøleskapsdøra er tom. Det er en skredfare i seg selv.</p>`;
  }
  $("#noteInspire").addEventListener("click", () => { $("#noteText").value = pick(NOTE_IDEAS); $("#noteText").focus(); });
  $("#noteForm").addEventListener("submit", (e) => {
    e.preventDefault();
    state.notes.push({ id: uid(), from: $("#noteFrom").value, text: $("#noteText").value.trim(), date: todayISO() });
    save(); $("#noteText").value = ""; renderNotes(); toast("Lappen henger på kjøleskapet");
  });
  $("#notes").addEventListener("click", (e) => {
    const id = e.target.dataset.delNote; if (!id) return;
    state.notes = state.notes.filter((n) => n.id !== id); save(); renderNotes();
  });

  /* ---------------- Oppstart ---------------- */
  function renderAll() {
    renderStats(); renderTrips(); renderWishes(); renderShop(); renderRocks(); renderNotes(); drawProfile();
  }
  renderCompliment(); renderMood(); renderAdventure(); renderChallenges();
  renderRecipes(); renderSeason(); renderRock(false); renderQuiz(); renderTimescale();
  renderAll();
  drawContours();

  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { drawContours(); drawProfile(); }, 150); });
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { drawContours(); drawProfile(); });
  if (document.fonts) document.fonts.ready.then(() => { drawContours(); drawProfile(); });

  const start = (location.hash || "").slice(1);
  if (["hjem", "turer", "kjokken", "geologi", "lapper"].includes(start)) showTab(start, false);
})();
