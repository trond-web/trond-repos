// Versjon og opphav for SkogIQ.ai – én kilde for appen, rapportene og package.json (sjekkes i testene).
export const VERSJON = '2.35.0';
export const UTGITT = '2026-11-27';
export const UTVIKLER = 'Trond Harald Sand';
export const APPNAVN = 'SkogIQ.ai';
export const versjonTekst = () => `${APPNAVN} versjon ${VERSJON}`;
export const signatur = () => `${versjonTekst()} · Utviklet av ${UTVIKLER}`;

// «Om SkogIQ.ai» – én kilde for innloggingssiden, appen, SkogIQ Felt og personvernsiden.
export const KONTAKT_EPOST = 'trond@strafferunden.no';
export const OM = {
  tittel: `Om ${APPNAVN}`,
  avsnitt: [
    `${APPNAVN} er utviklet av ${UTVIKLER} og bygger på 25 års erfaring med digitalisering i skogbruket.`,
    'Løsningen er utviklet på fritiden og uten kommersielle formål. Målet er å vise hvordan åpne data og moderne teknologi kan gjøre skogbruksplanlegging, skogsdrift og samarbeid i skogbruket enklere.',
    `Fordi ${APPNAVN} drives som et privat initiativ, kan det ikke gis garantier for at tjenesten blir videreført eller vil være tilgjengelig i framtiden. Ta derfor jevnlig eksport av planene dine.`,
  ],
  kontakt: 'Spørsmål, innspill eller ønske om samarbeid?',
  kort: `Utviklet av ${UTVIKLER} på bakgrunn av 25 års erfaring med digitalisering i skogbruket – på fritiden og uten kommersielle formål. Det kan ikke garanteres at tjenesten videreføres.`,
};
const escOm = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const kontaktHtml = () => `<a href="mailto:${KONTAKT_EPOST}">${KONTAKT_EPOST}</a>`;
// Hele teksten som HTML (avsnitt + kontakt).
export const omHtml = () => `${OM.avsnitt.map((a) => `<p>${escOm(a)}</p>`).join('')}<p>${escOm(OM.kontakt)} Kontakt ${escOm(UTVIKLER)} på ${kontaktHtml()}.</p>`;
