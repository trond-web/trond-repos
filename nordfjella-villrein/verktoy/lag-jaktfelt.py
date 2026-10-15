# Lager data/jaktfelt.geojson fra valdkartet (GeoPackage i UTM 32).
# Kjør fra appmappen:  python3 verktoy/lag-jaktfelt.py verktoy/valdkart_2026_10_15.gpkg data/jaktfelt.geojson
# Linjene forenkles med 1 m toleranse, og koordinatene skrives med 6 desimaler (ca. 0,1 m).
import sqlite3, json, math, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from gpkg import les_gpkg_geom, utm_til_grader, dp

TOLERANSE = 1.0
VALD = {1: 'Hemsedal', 2: 'Ål', 3: 'Hol', 4: 'Aurland', 5: 'Lærdal', 6: 'Ulvik'}

def areal(r): return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(r, r[1:]))) / 2

def inne(p, poly):
    def i_ring(r):
        x, y = p; ut = False
        for (x1, y1), (x2, y2) in zip(r, r[1:]):
            if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: ut = not ut
        return ut
    return i_ring(poly[0]) and not any(i_ring(h) for h in poly[1:])

def avstand_kant(p, poly):
    best = math.inf
    for r in poly:
        for (x1, y1), (x2, y2) in zip(r, r[1:]):
            dx, dy = x2 - x1, y2 - y1; l2 = dx * dx + dy * dy
            t = 0 if l2 == 0 else max(0, min(1, ((p[0] - x1) * dx + (p[1] - y1) * dy) / l2))
            best = min(best, math.hypot(p[0] - x1 - t * dx, p[1] - y1 - t * dy))
    return best

def etikettpunkt(poly):
    # Punkt godt inne i flaten: beste av et rutenett, så navnet ikke havner utenfor smale eller krokete felt.
    xs = [x for x, _ in poly[0]]; ys = [y for _, y in poly[0]]
    best, bp = -1, None
    for i in range(1, 16):
        for j in range(1, 16):
            p = (min(xs) + (max(xs) - min(xs)) * i / 16, min(ys) + (max(ys) - min(ys)) * j / 16)
            if inne(p, poly):
                d = avstand_kant(p, poly)
                if d > best: best, bp = d, p
    return bp or poly[0][0]

def main(kilde, mål):
    c = sqlite3.connect(kilde)
    grupper = {}
    for fid, geom, kom, vald, nr, navn in c.execute('select fid, geom, KOMMUNE, VALD, Feltnavn, Jaktfeltna from nordfjella_valdgr order by fid'):
        nr = (nr or '').strip() or None
        if nr and nr.startswith('NF6') and not vald: vald = 6  # Ulvik har ikke valdnummer i fila, men NF6xx-nummer
        tvist = bool(nr and nr.lower().startswith('tvist'))
        type_ = 'tvist' if tvist else 'jaktfelt' if nr else 'uten'
        n = nr if nr else f'uten-{fid}'
        g = grupper.setdefault(n, {'nr': nr, 'navn': (navn or '').strip() or None, 'vald': vald or None, 'type': type_, 'polys': []})
        g['polys'] += les_gpkg_geom(geom)
    features = []
    for g in grupper.values():
        polys = [[dp(r, TOLERANSE) for r in p] for p in g['polys']]
        polys = [[r for r in p if len(r) >= 4] for p in polys]
        polys = [p for p in polys if p]
        størst = max(polys, key=lambda p: areal(p[0]))
        ex, ny = etikettpunkt(størst)
        grader = lambda r: [[round(v, 6) for v in utm_til_grader(x, y)] for x, y in r]
        props = {'nr': g['nr'], 'navn': g['navn'], 'vald': g['vald'], 'valdnavn': VALD.get(g['vald']), 'type': g['type'],
                 'daa': round(sum(areal(p[0]) - sum(areal(h) for h in p[1:]) for p in polys) / 1000),
                 'etikett': [round(v, 6) for v in utm_til_grader(ex, ny)]}
        features.append({'type': 'Feature', 'properties': props,
                         'geometry': {'type': 'MultiPolygon', 'coordinates': [[grader(r) for r in p] for p in polys]}})
    features.sort(key=lambda f: (f['properties']['vald'] or 99, f['properties']['nr'] or 'ÅÅ'))
    ut = {'type': 'FeatureCollection', 'kilde': os.path.basename(kilde), 'features': features}
    with open(mål, 'w') as fil: json.dump(ut, fil, ensure_ascii=False, separators=(',', ':'))
    print(len(features), 'objekter', sum(len(r) for f in features for p in f['geometry']['coordinates'] for r in p), 'punkter', os.path.getsize(mål) // 1024, 'KB', file=sys.stderr)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
