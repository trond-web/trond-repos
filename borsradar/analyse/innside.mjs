// Tolker meldinger om innsidehandel (Newsweb kategori 1102).
// Bare vanlige kjøp og salg i markedet teller. Aksjeprogrammer, opsjoner, tildelinger,
// emisjoner, aksjelån o.l. sier lite om hva innsiderne tror om aksjen, og regnes som "ANNET".

const PROGRAM = new RegExp(
  [
    "aksje(kjøps|spare)?program", "share (purchase|saving|savings|incentive|matching|bonus|option)s? ?(program|programme|plan|scheme)",
    "employee", "ansatte", "incentiv", "\\bLTI", "\\bRSU", "\\bPSU", "restricted (stock|share)", "tildel", "\\bgrant",
    "allocat", "allokert", "opsjon", "\\boptions?\\b", "exercis", "innløs", "subscri", "tegnet", "tegning", "emisjon",
    "share issue", "private placement", "rights issue", "lending", "aksjelån", "låne", "consideration shares", "vederlag",
    "scrip", "\\bbonus", "dividend shares", "utbytteaksjer", "\\bgave\\b", "\\bgift\\b", "\\barv\\b", "inherit", "pledge", "\\bpant", "stiftelse", "trust\\b",
    "\\bTRS\\b", "total return swap", "forward", "merger", "fusjon", "conversion", "konverter", "warrant",
  ].join("|"),
  "i",
);
const KJOP = /\b(kjøpt|kjøper|kjøpte|kjøp av|purchased|purchases|bought|buys|has acquired|acquired|acquisition of|ervervet|erverv av|purchase of)\b/i;
const SALG = /\b(solgt|selger|solgte|salg av|sold|sells|has sold|disposed|disposal of|sale of|avhendet)\b/i;

const EGNE = /(egne aksjer|egne egenkapitalbevis|own shares|treasury shares|buy-?back|tilbakekjøp)/i;

/** "KJØP", "SALG", "TILBAKEKJØP" (selskapet kjøper egne aksjer) eller "ANNET" for én melding. */
export function tolkInnsidemelding(tittel, tekst) {
  const t = `${tittel || ""}\n${(tekst || "").slice(0, 2500)}`;
  if (EGNE.test(t)) return KJOP.test(t) && !PROGRAM.test(t) ? "TILBAKEKJØP" : "ANNET";
  if (PROGRAM.test(t)) return "ANNET";
  const k = t.search(KJOP), s = t.search(SALG);
  if (k < 0 && s < 0) return "ANNET";
  if (k >= 0 && s < 0) return "KJØP";
  if (s >= 0 && k < 0) return "SALG";
  return k < s ? "KJØP" : "SALG";
}
