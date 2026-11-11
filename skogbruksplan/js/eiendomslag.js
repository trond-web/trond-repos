// Kartverkets eiendomsgrenser (WMS, matrikkelkartet) med røde grenser, som planens egen eiendomsgrense (#d03b3b).
// WMS-tjenesten tegner grensene i Kartverkets farger. Grenselaget farges om med et SVG-filter som gjør alle
// synlige piksler røde og beholder gjennomsiktigheten. Eiendomsnumrene hentes som eget lag uten filter, slik at
// teksten med lys kant fortsatt er lesbar.
export const EIENDOM_ROD = '#d03b3b';
const WMS = 'https://wms.geonorge.no/skwms1/wms.matrikkel';

function sikreFilter() {
  if (typeof document === 'undefined' || document.getElementById('eiendom-rod-filter')) return;
  const [r, g, b] = [1, 3, 5].map((i) => (parseInt(EIENDOM_ROD.slice(i, i + 2), 16) / 255).toFixed(3));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.setAttribute('aria-hidden', 'true'); svg.style.position = 'absolute';
  svg.innerHTML = `<filter id="eiendom-rod-filter" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 1 0"/></filter>`;
  document.body.appendChild(svg);
  const st = document.createElement('style'); st.textContent = '.eiendom-rod { filter: url(#eiendom-rod-filter); }'; document.head.appendChild(st);
}

// Gir et lag (grenser + eiendomsnummer) som kan legges i lagvelgeren eller slås av og på som ett.
export function eiendomGrenseLag(L, { pane, opacity = 0.9, minZoom = 13, maxZoom = 20 } = {}) {
  sikreFilter();
  const felles = { format: 'image/png', transparent: true, minZoom, maxZoom, ...(pane ? { pane } : {}) };
  return L.layerGroup([
    L.tileLayer.wms(WMS, { ...felles, layers: 'eiendomsgrense', opacity, className: 'eiendom-rod', attribution: 'Eiendomsgrenser © Kartverket' }),
    L.tileLayer.wms(WMS, { ...felles, layers: 'eiendoms_id', opacity: 0.85 }),
  ]);
}
