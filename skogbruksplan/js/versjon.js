// Versjon og opphav for SkogIQ.ai – én kilde for appen, rapportene og package.json (sjekkes i testene).
export const VERSJON = '1.0.0';
export const UTGITT = '2026-10-06';
export const UTVIKLER = 'Trond Harald Sand';
export const APPNAVN = 'SkogIQ.ai';
export const versjonTekst = () => `${APPNAVN} versjon ${VERSJON}`;
export const signatur = () => `${versjonTekst()} · Utviklet av ${UTVIKLER}`;
