// E-post via brukerens eget e-postprogram (mailto:). Serveren sender ikke e-post uten EPOST_NOKKEL (Resend); da
// lages en ferdig utfylt e-post som brukeren sender selv.
export const mailto = ({ til = '', emne = '', tekst = '' }) => `mailto:${encodeURIComponent(til).replace(/%40/g, '@')}?subject=${encodeURIComponent(emne)}&body=${encodeURIComponent(tekst)}`;
// Adressen til appen og registreringen, uansett om den kjører på Railway eller GitHub Pages.
export const appAdresse = (fil = '') => (typeof location === 'undefined' ? fil : new URL(fil || './', location.href).href);
