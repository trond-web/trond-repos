/* ------------------------------------------------------------------ *
 *  Snøvill smøreguide – produktdata fra leverandørene og regler for
 *  å velge feste- og glidervoks ut fra temperatur, snøtype og fuktighet.
 *
 *  Temperaturer er lufttemperatur i °C slik leverandøren oppgir dem.
 *  Snøtyper: new (nysnø), old (finkornet/gammel), coarse (omdannet/grov),
 *  icy (isete/frossen), wet (våt). Fuktighet for glider: dry, mid, wet.
 *  Kilde per produkt: «produsent» = leverandørens egen side/guide,
 *  «forhandler» = oppgitt av forhandler (kan avvike litt fra boksen).
 * ------------------------------------------------------------------ */

(function (global) {
  "use strict";

  const SRC = {
    swixKick: { url: "https://swixsport.com/eu/article/wax/fluor-free-kick-wax", type: "produsent" },
    swixGlide: { url: "https://swixsport.com/eu/article/wax/swix-world-cup-guide", type: "produsent" },
    swixKlister: { url: "https://nordicski.net/?p=4743", type: "forhandler" },
    rode: { url: "https://skiwax.ca/blogs/buyers-guides/rode-wax-buyers-guide", type: "forhandler" },
    rodeGlide: { url: "https://bouldernordic.com/blogs/news/rogers-2024-wax-review", type: "forhandler" },
    start: { url: "https://ascentoutdoors.com/products/start-synthetic-kick-wax", type: "forhandler" },
    startKlister: { url: "https://veloplus.ee/en/klister-start-purple-violet-0o-5oc-55g-28071", type: "forhandler" },
    vauhti: { url: "https://vauhti.fi/wp-content/uploads/WAXING-GUIDE-2024-2025.pdf", type: "produsent" },
    holmenkol: { url: "https://skiwax.ca/products/holmenkol-klister-universal", type: "forhandler" },
    holmenkolGlide: { url: "https://www.newmoonski.com/product-list/ski-wax-1413/glide-wax-1436/", type: "forhandler" },
    toko: { url: "https://ekkip-sports.com/en/products/nordic-gripwax", type: "forhandler" },
    tokoKlister: { url: "https://www.backcountry.com/toko-nordic-klister-wax", type: "forhandler" },
    tokoGlide: {
      url: "https://www.winthropmountainsports.com/blogs/resources/your-guide-to-fluor-free-waxes-sustainable-perform/",
      type: "forhandler",
    },
    rex: { url: "https://varuste.net/pl/p125289/rex-purple-klister-10-7c", type: "forhandler" },
    rexGlide: { url: "https://www.gearwest.com/collections/wax-tools", type: "forhandler" },
    skigo: { url: "https://nordicx.com/en/SKIGO-XC-Kickwax-blue.html", type: "forhandler" },
  };

  const ALL = ["new", "old", "coarse", "icy", "wet"];

  // kind: hard (festevoks), klister, glide
  const PRODUCTS = [
    // ---------------- Swix ----------------
    { brand: "Swix", kind: "hard", name: "VP30 Light Blue", tmin: -16, tmax: -8, snow: ["new"], src: SRC.swixKick },
    { brand: "Swix", kind: "hard", name: "VP30 Light Blue", tmin: -20, tmax: -12, snow: ["old"], src: SRC.swixKick },
    { brand: "Swix", kind: "hard", name: "VP40 Blue", tmin: -10, tmax: -4, snow: ["new"], src: SRC.swixKick },
    { brand: "Swix", kind: "hard", name: "VP40 Blue", tmin: -14, tmax: -5, snow: ["old"], src: SRC.swixKick },
    { brand: "Swix", kind: "hard", name: "VP45 Blue/Violet", tmin: -5, tmax: -1, snow: ["new"], src: SRC.swixKick },
    { brand: "Swix", kind: "hard", name: "VP45 Blue/Violet", tmin: -8, tmax: -3, snow: ["old"], src: SRC.swixKick },
    { brand: "Swix", kind: "hard", name: "VP50 Light Violet", tmin: -3, tmax: 0, snow: ["new"], src: SRC.swixKick },
    { brand: "Swix", kind: "hard", name: "VP50 Light Violet", tmin: -6, tmax: -1, snow: ["old"], src: SRC.swixKick },
    { brand: "Swix", kind: "hard", name: "VP55 Violet", tmin: -2, tmax: 1, snow: ["new", "wet"], src: SRC.swixKick },
    { brand: "Swix", kind: "hard", name: "VP55 Violet", tmin: -5, tmax: 0, snow: ["old"], src: SRC.swixKick },
    { brand: "Swix", kind: "hard", name: "VP60 Violet/Red", tmin: -1, tmax: 2, snow: ["new", "wet"], src: SRC.swixKick },
    { brand: "Swix", kind: "hard", name: "VP60 Violet/Red", tmin: -4, tmax: -1, snow: ["old"], src: SRC.swixKick },
    { brand: "Swix", kind: "hard", name: "VP65 Black/Red", tmin: 0, tmax: 2, snow: ["new", "wet"], humid: true, src: SRC.swixKick },
    { brand: "Swix", kind: "hard", name: "VP65 Black/Red", tmin: -4, tmax: 0, snow: ["old"], humid: true, src: SRC.swixKick },
    { brand: "Swix", kind: "hard", name: "VP70 Yellow", tmin: 0, tmax: 3, snow: ["new", "wet"], src: SRC.swixKick },
    { brand: "Swix", kind: "klister", name: "KX30 Blue Ice", tmin: -12, tmax: 0, snow: ["icy"], src: SRC.swixKlister },
    { brand: "Swix", kind: "klister", name: "KX35N Violet", tmin: -8, tmax: 0, snow: ["coarse", "icy"], src: SRC.swixKlister },
    { brand: "Swix", kind: "klister", name: "KX45 Violet", tmin: -2, tmax: 4, snow: ["coarse", "wet"], src: SRC.swixKlister },
    { brand: "Swix", kind: "klister", name: "KX65 Red", tmin: 1, tmax: 5, snow: ["wet", "coarse"], src: SRC.swixKlister },
    { brand: "Swix", kind: "klister", name: "KX75 Red Wet", tmin: 2, tmax: 15, snow: ["wet"], src: SRC.swixKlister },
    { brand: "Swix", kind: "glide", name: "PF25 Fine Dry", tmin: -20, tmax: -2, snow: ["new", "old"], humidity: "dry", src: SRC.swixGlide },
    { brand: "Swix", kind: "glide", name: "PF35 Fine Mid", tmin: -8, tmax: 0, snow: ["new", "old"], humidity: "mid", src: SRC.swixGlide },
    { brand: "Swix", kind: "glide", name: "PF100 Fine Wet", tmin: -4, tmax: 4, snow: ["new", "wet"], humidity: "wet", src: SRC.swixGlide },
    { brand: "Swix", kind: "glide", name: "PC25 Coarse Dry", tmin: -20, tmax: -4, snow: ["coarse", "icy", "old"], humidity: "dry", src: SRC.swixGlide },
    { brand: "Swix", kind: "glide", name: "PC35 Coarse Mid", tmin: -10, tmax: 2, snow: ["coarse", "icy", "old"], humidity: "mid", src: SRC.swixGlide },
    { brand: "Swix", kind: "glide", name: "PC100 Coarse Wet", tmin: -2, tmax: 10, snow: ["coarse", "wet"], humidity: "wet", src: SRC.swixGlide },

    // ---------------- Rode ----------------
    { brand: "Rode", kind: "hard", name: "Blu Multigrade", tmin: -12, tmax: -3, snow: ALL, src: SRC.rode },
    { brand: "Rode", kind: "hard", name: "Blu Super Extra P38", tmin: -10, tmax: -1, snow: ["new"], humid: true, src: SRC.rode },
    { brand: "Rode", kind: "hard", name: "Viola Multigrade", tmin: -5, tmax: 0, snow: ALL, src: SRC.rode },
    { brand: "Rode", kind: "hard", name: "Viola P40", tmin: -4, tmax: 0, snow: ["new", "old"], src: SRC.rode },
    { brand: "Rode", kind: "hard", name: "Viola Extra P42", tmin: -3, tmax: 1, snow: ["new", "old"], src: SRC.rode },
    { brand: "Rode", kind: "hard", name: "Rossa P50", tmin: 0, tmax: 3, snow: ["new", "wet"], src: SRC.rode },
    { brand: "Rode", kind: "klister", name: "Klister Multigrade", tmin: -6, tmax: 6, snow: ["coarse", "icy", "wet"], src: SRC.rode },
    { brand: "Rode", kind: "glide", name: "R20 Blue", tmin: -18, tmax: -8, snow: ALL, humidity: "dry", src: SRC.rodeGlide },
    { brand: "Rode", kind: "glide", name: "RL Med (flytende)", tmin: -7, tmax: -2, snow: ALL, humidity: "mid", src: SRC.rodeGlide },
    { brand: "Rode", kind: "glide", name: "RL Warm (flytende)", tmin: -3, tmax: 0, snow: ALL, humidity: "mid", src: SRC.rodeGlide },
    { brand: "Rode", kind: "glide", name: "R50 Yellow", tmin: -1, tmax: 10, snow: ALL, humidity: "wet", src: SRC.rodeGlide },

    // ---------------- Start ----------------
    { brand: "Start", kind: "hard", name: "Synthetic Green", tmin: -10, tmax: -5, snow: ALL, src: SRC.start },
    { brand: "Start", kind: "hard", name: "Synthetic Blue", tmin: -6, tmax: -2, snow: ALL, src: SRC.start },
    { brand: "Start", kind: "hard", name: "Synthetic Purple", tmin: -3, tmax: 1, snow: ALL, src: SRC.start },
    { brand: "Start", kind: "hard", name: "Synthetic Yellow", tmin: 1, tmax: 3, snow: ["new", "wet"], src: SRC.start },
    { brand: "Start", kind: "klister", name: "Purple Klister", tmin: -5, tmax: 0, snow: ["coarse", "icy"], src: SRC.startKlister },

    // ---------------- Vauhti ----------------
    { brand: "Vauhti", kind: "hard", name: "GT Green", tmin: -20, tmax: -6, snow: ALL, src: SRC.vauhti },
    { brand: "Vauhti", kind: "hard", name: "GT Carrot", tmin: -6, tmax: -1, snow: ["new", "old"], src: SRC.vauhti },
    { brand: "Vauhti", kind: "hard", name: "GT Carrot", tmin: -12, tmax: -1, snow: ["old"], src: SRC.vauhti },
    { brand: "Vauhti", kind: "hard", name: "GT Pink", tmin: -4, tmax: 0, snow: ["new"], src: SRC.vauhti },
    { brand: "Vauhti", kind: "hard", name: "GT Red", tmin: -1, tmax: 1, snow: ["new", "wet"], src: SRC.vauhti },
    { brand: "Vauhti", kind: "hard", name: "GT Red", tmin: -3, tmax: 1, snow: ["old"], src: SRC.vauhti },
    { brand: "Vauhti", kind: "klister", name: "KS Blue", tmin: -15, tmax: 0, snow: ["icy", "coarse"], src: SRC.vauhti },
    { brand: "Vauhti", kind: "klister", name: "KS Violet", tmin: -10, tmax: 1, snow: ["coarse", "wet"], src: SRC.vauhti },
    { brand: "Vauhti", kind: "klister", name: "KS Universal", tmin: -7, tmax: 4, snow: ["coarse", "icy", "wet"], src: SRC.vauhti },
    { brand: "Vauhti", kind: "klister", name: "KS Red", tmin: 2, tmax: 10, snow: ["wet"], src: SRC.vauhti },
    { brand: "Vauhti", kind: "glide", name: "GW Polar", tmin: -25, tmax: -5, snow: ALL, humidity: "dry", src: SRC.vauhti },
    { brand: "Vauhti", kind: "glide", name: "GW Cold", tmin: -15, tmax: -2, snow: ALL, humidity: "mid", src: SRC.vauhti },
    { brand: "Vauhti", kind: "glide", name: "GW Warm", tmin: -3, tmax: 7, snow: ALL, humidity: "wet", src: SRC.vauhti },

    // ---------------- Holmenkol ----------------
    { brand: "Holmenkol", kind: "hard", name: "Grip Red", tmin: -1, tmax: 2, snow: ["old", "new"], src: SRC.holmenkol },
    { brand: "Holmenkol", kind: "klister", name: "Klister Universal", tmin: -4, tmax: 4, snow: ["coarse", "icy", "wet"], src: SRC.holmenkol },
    { brand: "Holmenkol", kind: "klister", name: "Klister Red", tmin: -2, tmax: 3, snow: ["coarse", "wet"], src: SRC.holmenkol },
    { brand: "Holmenkol", kind: "klister", name: "Klister Black Spezial", tmin: -1, tmax: 10, snow: ["wet"], src: SRC.holmenkol },
    { brand: "Holmenkol", kind: "glide", name: "FF1 Blue (flytende)", tmin: -20, tmax: -12, snow: ALL, humidity: "dry", src: SRC.holmenkolGlide },
    { brand: "Holmenkol", kind: "glide", name: "FF1 Red (flytende)", tmin: -12, tmax: -6, snow: ALL, humidity: "mid", src: SRC.holmenkolGlide },
    { brand: "Holmenkol", kind: "glide", name: "FF1 Yellow (flytende)", tmin: -6, tmax: 0, snow: ALL, humidity: "mid", src: SRC.holmenkolGlide },
    { brand: "Holmenkol", kind: "glide", name: "AlphaMix Yellow", tmin: -4, tmax: 10, snow: ["new", "wet"], humidity: "wet", src: SRC.holmenkolGlide },

    // ---------------- Toko ----------------
    { brand: "Toko", kind: "hard", name: "Nordic Grip Wax Blue", tmin: -30, tmax: -7, snow: ALL, src: SRC.toko },
    { brand: "Toko", kind: "hard", name: "Nordic Grip Wax Red", tmin: -10, tmax: -2, snow: ALL, src: SRC.toko },
    { brand: "Toko", kind: "hard", name: "Nordic Grip Wax Yellow", tmin: -2, tmax: 0, snow: ["new", "wet", "old"], src: SRC.toko },
    { brand: "Toko", kind: "klister", name: "Nordic Klister Blue", tmin: -30, tmax: -7, snow: ["icy", "coarse"], src: SRC.tokoKlister },
    { brand: "Toko", kind: "klister", name: "Nordic Klister Red", tmin: -10, tmax: -2, snow: ["coarse", "icy"], src: SRC.tokoKlister },
    { brand: "Toko", kind: "klister", name: "Nordic Klister Yellow", tmin: -2, tmax: 0, snow: ["wet", "coarse"], src: SRC.tokoKlister },
    { brand: "Toko", kind: "glide", name: "Performance Red", tmin: -4, tmax: 0, snow: ALL, humidity: "mid", src: SRC.tokoGlide },

    // ---------------- Rex ----------------
    { brand: "Rex", kind: "hard", name: "N31 Green", tmin: -20, tmax: -8, snow: ALL, src: SRC.rexGlide },
    { brand: "Rex", kind: "klister", name: "Blue Klister", tmin: -30, tmax: -5, snow: ["icy"], src: SRC.rex },
    { brand: "Rex", kind: "klister", name: "Purple Klister", tmin: -7, tmax: 10, snow: ["coarse", "icy", "wet"], src: SRC.rex },
    { brand: "Rex", kind: "klister", name: "Universal Klister", tmin: -1, tmax: 1, snow: ["coarse", "wet"], src: SRC.rex },
    { brand: "Rex", kind: "klister", name: "Red Klister", tmin: 0, tmax: 10, snow: ["wet"], src: SRC.rex },
    { brand: "Rex", kind: "glide", name: "G21 Blue", tmin: -12, tmax: -2, snow: ALL, humidity: "mid", src: SRC.rexGlide },
    { brand: "Rex", kind: "glide", name: "G11 Yellow", tmin: -2, tmax: 10, snow: ALL, humidity: "wet", src: SRC.rexGlide },

    // ---------------- Skigo ----------------
    { brand: "Skigo", kind: "hard", name: "XC Kickwax Blue", tmin: -10, tmax: -3, snow: ALL, src: SRC.skigo },
  ];

  const BRANDS = ["Swix", "Rode", "Start", "Vauhti", "Holmenkol", "Toko", "Rex", "Skigo"];

  const SNOW_LABELS = {
    none: "Ingen snø",
    new: "Nysnø (finkornet)",
    newwet: "Våt nysnø",
    old: "Finkornet, eldre snø",
    coarse: "Omdannet / grovkornet",
    icy: "Isete / frossen",
    wet: "Våt, gammel snø",
  };
  // Hvilke produktmerker som passer hver snøtype
  const SNOW_TAGS = {
    new: ["new"],
    newwet: ["new", "wet"],
    old: ["old"],
    coarse: ["coarse", "old"],
    icy: ["icy", "coarse"],
    wet: ["wet", "coarse"],
  };
  const HUMIDITY_LABELS = { dry: "Tørr luft", mid: "Normal fuktighet", wet: "Fuktig / våt" };

  /**
   * Klassifiser forholdene for én dag.
   * c: { temp (dagtid), tmin, tmax, rh, newSnow, newSnowPrev, depth, selfThreshold, thawRecent, rain }
   */
  function classify(c) {
    let snow;
    if (c.depth < c.selfThreshold) snow = "none";
    else if (c.newSnow >= 1 || c.newSnowPrev >= 2) snow = c.tmax > 0.5 || c.temp > -1 ? "newwet" : "new";
    else if (c.tmax > 0.5 || c.rain) snow = "wet";
    else if (c.thawRecent) snow = c.tmin < -6 ? "icy" : "coarse";
    else snow = "old";

    let humidity = "mid";
    if (snow === "newwet" || snow === "wet" || (c.rh != null && c.rh >= 90 && c.temp > -3)) humidity = "wet";
    else if ((c.rh != null && c.rh < 70) || c.temp <= -10) humidity = "dry";

    // Fuktig luft rundt null gjør at man trenger litt varmere (mykere) voks
    const shift = humidity === "wet" ? 1 : humidity === "dry" ? -1 : 0;
    return { snow, humidity, effTemp: c.temp + shift };
  }

  function distance(t, p) {
    if (t < p.tmin) return p.tmin - t;
    if (t > p.tmax) return t - p.tmax;
    return 0;
  }

  function pick(brand, kind, cond) {
    const tags = SNOW_TAGS[cond.snow] || [];
    const cands = PRODUCTS.filter(
      (p) => p.brand === brand && p.kind === kind && p.snow.some((s) => tags.includes(s))
    );
    if (!cands.length) return null;
    let best = null;
    for (const p of cands) {
      let score = distance(cond.effTemp, p) * 10;
      if (kind === "glide" && p.humidity && p.humidity !== cond.humidity) score += 3;
      if (p.humid && cond.humidity === "wet") score -= 1;
      score += (p.tmax - p.tmin) * 0.05; // smalt område = mer treffsikkert
      if (!best || score < best.score) best = { product: p, score, inRange: distance(cond.effTemp, p) === 0 };
    }
    return best;
  }

  function recommend(c) {
    const cond = { ...c, ...classify(c) };
    if (cond.snow === "none") return { cond, brands: [], snovill: null };
    const kickKind = ["coarse", "icy", "wet"].includes(cond.snow) ? "klister" : "hard";
    const brands = BRANDS.map((b) => {
      let kick = pick(b, kickKind, cond);
      if (!kick && kickKind === "klister") {
        // Mangler klister i dataene: hardvoks bare hvis den dekker temperaturen
        const hard = pick(b, "hard", { ...cond, snow: "old" });
        kick = hard?.inRange ? { ...hard, fallback: "hardvoks – ingen klister i dataene" } : null;
      }
      const glide = pick(b, "glide", cond);
      return { brand: b, kick, glide };
    });
    return { cond, kickKind, brands, snovill: snovillPick(cond, kickKind, brands) };
  }

  // Fargefamilie for festevoks – det Snøvill faktisk tenker på i bua
  function kickFamily(cond, kickKind) {
    const t = cond.effTemp;
    if (kickKind === "klister") {
      if (cond.snow === "icy" || t <= -4) return { color: "Blå klister", cls: "wax-blue", short: "Blå kl." };
      if (t <= 1) return { color: "Fiolett klister", cls: "wax-violet", short: "Fiol. kl." };
      return { color: "Rød klister", cls: "wax-red", short: "Rød kl." };
    }
    if (t <= -10) return { color: "Grønn hardvoks", cls: "wax-green", short: "Grønn" };
    if (t <= -4) return { color: "Blå hardvoks", cls: "wax-blue", short: "Blå" };
    if (t <= -1) return { color: "Blå/fiolett hardvoks", cls: "wax-violet", short: "Blå/fiol." };
    if (t <= 0.5) return { color: "Fiolett hardvoks", cls: "wax-violet", short: "Fiolett" };
    return { color: "Rød hardvoks", cls: "wax-red", short: "Rød" };
  }

  function glideFamily(cond) {
    const fine = ["new", "newwet", "old"].includes(cond.snow);
    const grain = fine ? "finkornet snø" : "grov snø";
    if (cond.humidity === "wet" || cond.effTemp > -1) return `Varm/våt glider for ${grain}`;
    if (cond.humidity === "dry" && cond.effTemp <= -8) return `Kald, tørr glider for ${grain}`;
    return `Middels glider for ${grain}`;
  }

  function snovillPick(cond, kickKind, brands) {
    const fam = kickFamily(cond, kickKind);
    const tips = [];
    if (cond.snow === "new" && cond.depth < 25) {
      tips.push("Tråkkeføre! Løs nysnø gir dårligere feste – legg flere tynne lag og gå et hakk varmere hvis det glipper.");
    }
    if (cond.snow === "newwet" || (cond.effTemp > -1 && cond.effTemp < 1.5 && kickKind === "hard")) {
      tips.push("Rundt null og fuktig: fare for klabb. Tynne lag, kork godt – eller ta frem felleskiene.");
    }
    if (cond.snow === "icy") tips.push("Isete spor: blå klister som grunn, varm den inn og la den kjøle seg før tur.");
    if (cond.snow === "coarse") tips.push("Omdannet snø: klister holder – tynt lag, bred den ut med tommelen eller varmepistol.");
    if (cond.snow === "wet") tips.push("Våt snø: rød/våt klister, og strukturer gliden hvis du har verktøy.");
    if (cond.humidity === "dry" && cond.effTemp <= -8) tips.push("Kaldt og tørt: hardvoksen sitter godt – to–tre tynne lag holder hele turen.");
    if (!tips.length) tips.push("Klassisk Snøvill-dag: tynne lag, kork godt, og ta med én voks varmere i lomma.");

    // Hvilke leverandør-valg treffer fargefamilien
    const agree = brands.filter((b) => b.kick?.inRange).map((b) => `${b.brand} ${b.kick.product.name}`);
    return {
      kick: fam,
      glide: glideFamily(cond),
      tips,
      examples: agree.slice(0, 3),
    };
  }

  global.Smoring = { PRODUCTS, BRANDS, SNOW_LABELS, HUMIDITY_LABELS, classify, recommend, kickFamily };
})(typeof self !== "undefined" ? self : globalThis);
