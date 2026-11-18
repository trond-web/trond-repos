// ØK-kart (Økonomisk kartverk): Kartverkets N5 Raster – etterfølgeren til ØK 1:5000 med høydekurver (5 m ekvidistanse),
// eiendomsnummer og bygninger – og de skannede førsteutgavene av ØK (historiske, med gamle bonitetsmerker).
// Tjenesten (wms.n5raster2) svarer bare i UTM (EPSG:25832–25835), ikke i Web Mercator som kartet bruker. Hver kartflis
// hentes derfor i UTM-sonen den ligger i og rettes inn på et lerret med en affin transformasjon fra tre hjørner
// (nøyaktig innenfor en flis). Tjenesten tillater CORS, så lerretet kan tegnes uten problemer.
import { geoTilUtm } from './proj.js';

export const OK_WMS = 'https://wms.geonorge.no/skwms1/wms.n5raster2';
export const OK_LAG = { n5raster: 'ØK-kart (N5 Raster)', n5raster_foerstegang: 'ØK førsteutgave' };

// UTM-sone for lengdegraden, begrenset til sonene tjenesten har (32–35).
export const utmSone = (lon) => Math.min(35, Math.max(32, Math.floor((lon + 180) / 6) + 1));

// Affin transformasjon som sender bildepunktene p0, p1, p2 til flispunktene t0, t1, t2: [a, b, c, d, e, f] slik at
// x' = a·x + c·y + e og y' = b·x + d·y + f (rekkefølgen canvas setTransform bruker).
export function affin([p0, p1, p2], [t0, t1, t2]) {
  const u = [p1[0] - p0[0], p1[1] - p0[1]]; const v = [p2[0] - p0[0], p2[1] - p0[1]];
  const U = [t1[0] - t0[0], t1[1] - t0[1]]; const V = [t2[0] - t0[0], t2[1] - t0[1]];
  const det = u[0] * v[1] - v[0] * u[1]; if (!det) return null;
  // [u v]^-1 = 1/det · [[v1, -v0], [-u1, u0]]
  const i11 = v[1] / det; const i12 = -v[0] / det; const i21 = -u[1] / det; const i22 = u[0] / det;
  const a = U[0] * i11 + V[0] * i21; const c = U[0] * i12 + V[0] * i22;
  const b = U[1] * i11 + V[1] * i21; const d = U[1] * i12 + V[1] * i22;
  return [a, b, c, d, t0[0] - (a * p0[0] + c * p0[1]), t0[1] - (b * p0[0] + d * p0[1])];
}

// Flisens hjørner (lon/lat) → UTM-boks med litt marg, og bildepunktene til tre av hjørnene i det bildet som hentes.
export function flisPlan(hjorner, { px = 320, marg = 0.04 } = {}) {
  const [nw, ne, sw, se] = hjorner; const midtLon = (nw[0] + se[0]) / 2; const sone = utmSone(midtLon);
  const u = hjorner.map(([lon, lat]) => geoTilUtm(lon, lat, sone));
  let x0 = Math.min(...u.map((p) => p[0])); let x1 = Math.max(...u.map((p) => p[0])); let y0 = Math.min(...u.map((p) => p[1])); let y1 = Math.max(...u.map((p) => p[1]));
  const mx = (x1 - x0) * marg; const my = (y1 - y0) * marg; x0 -= mx; x1 += mx; y0 -= my; y1 += my;
  const tilBilde = ([e, n]) => [((e - x0) / (x1 - x0)) * px, ((y1 - n) / (y1 - y0)) * px];
  return { sone, boks: [x0, y0, x1, y1], px, bildePunkter: [tilBilde(u[0]), tilBilde(u[1]), tilBilde(u[2])], ne, sw };
}
export const okUrl = (lag, { sone, boks, px }) => `${OK_WMS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${lag}&STYLES=&CRS=EPSG:258${sone}&BBOX=${boks.map((v) => v.toFixed(1)).join(',')}&WIDTH=${px}&HEIGHT=${px}&FORMAT=image/png`;

// Leaflet-lag (GridLayer) med ØK-kartet. Synlig fra zoom 12 (målestokk 1:500 000 og større i tjenesten).
export function lagOkLag(L, { lag = 'n5raster', className = 'grunnkart ok-kart', ...opt } = {}) {
  const Lag = L.GridLayer.extend({
    createTile(coords, done) {
      const tile = document.createElement('canvas'); const s = this.getTileSize(); tile.width = s.x; tile.height = s.y;
      const kart = this._map; const nw = coords.scaleBy(s); const hj = [[0, 0], [s.x, 0], [0, s.y], [s.x, s.y]].map(([dx, dy]) => kart.unproject([nw.x + dx, nw.y + dy], coords.z)).map((ll) => [ll.lng, ll.lat]);
      const plan = flisPlan(hj, { px: Math.round(s.x * 1.25) });
      const m = affin(plan.bildePunkter, [[0, 0], [s.x, 0], [0, s.y]]);
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { try { const ctx = tile.getContext('2d'); ctx.setTransform(...m); ctx.drawImage(img, 0, 0); } catch { /* tom flis */ } done(null, tile); };
      img.onerror = () => done(null, tile);
      img.src = okUrl(lag, plan);
      return tile;
    },
  });
  return new Lag({ minZoom: 0, maxZoom: 20, minNativeZoom: 0, attribution: `${OK_LAG[lag] || 'ØK-kart'} © Kartverket`, className, ...opt });
}
