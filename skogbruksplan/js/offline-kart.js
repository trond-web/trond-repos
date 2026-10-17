// Kartfliser for offline-bruk: URL-er for Kartverkets topografiske kart innenfor et område (brukes av fullversjonen
// og SkogIQ Felt). Flisene lagres i cachen «kartfliser-v1», som service workeren leser fra uten nett.
export const FLIS_CACHE = 'kartfliser-v1';
export const kartverketFlis = (lag, z, x, y) => `https://cache.kartverket.no/v1/wmts/1.0.0/${lag}/default/webmercator/${z}/${y}/${x}.png`;
const tx = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const ty = (lat, z) => Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z);
// bb = [minLon, minLat, maxLon, maxLat]. Litt margin rundt eiendommen.
export function flisUrler(bb, { minZ = 10, maksZ = 17, lag = ['topo', 'topograatone'], pad = 0.004 } = {}) {
  const [minx, miny, maxx, maxy] = [bb[0] - pad, bb[1] - pad, bb[2] + pad, bb[3] + pad];
  const urler = [];
  for (let z = minZ; z <= maksZ; z++) for (let x = tx(minx, z); x <= tx(maxx, z); x++) for (let y = ty(maxy, z); y <= ty(miny, z); y++) for (const l of lag) urler.push(kartverketFlis(l, z, x, y));
  return urler;
}
