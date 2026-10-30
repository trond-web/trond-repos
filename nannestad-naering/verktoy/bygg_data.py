"""Bygger datafilene i ../data fra åpne tjenester. Kjør: python3 -I verktoy/bygg_data.py  (fra nannestad-naering/)

- naeringsomrader.geojson: utbyggingsformål i kommuneplanens arealdel for Nannestad (næring, råstoff, tjenesteyting,
  sentrum, kombinert, andre typer bebyggelse). Kartbildet fra Nasjonal arealplanbase (WMS GetMap) deles i sammenhengende
  fargeflater, og hver flate identifiseres med GetFeatureInfo. Omrissene har ca. 12 m oppløsning – oversikt, ikke grense.
- kommune.geojson: kommunegrensen.
- eiendom-3238-29-2.json: forhåndsberegnet analyse av 29/2 (samme metode som appen bruker live).
"""
import json, math, re, urllib.request, urllib.parse, io, os, sys
from collections import deque, defaultdict
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

UT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
KP = 'https://nap.ft.dibk.no/services/wms/kommuneplaner/'
B = (60.100, 10.765, 60.350, 11.135)  # lat0, lon0, lat1, lon1
W, H = 2100, 2700
TA_MED = {'1130', '1160', '1200', '1300', '1500', '1800'}


def hent(url, json_=True, forsok=3):
    for i in range(forsok):
        try:
            r = urllib.request.urlopen(url, timeout=120).read()
            return json.loads(r) if json_ else r
        except Exception:
            if i == forsok - 1: raise


def ll(x, y):
    return (B[2] - y * (B[2] - B[0]) / H, B[1] + x * (B[3] - B[1]) / W)


def featureinfo(lat, lon, lag='arealformal_kp', d=0.00006):
    q = urllib.parse.urlencode(dict(service='WMS', version='1.3.0', request='GetFeatureInfo', layers=lag, query_layers=lag, styles='',
                                    crs='EPSG:4326', bbox=f'{lat-d},{lon-d},{lat+d},{lon+d}', width=101, height=101, i=50, j=50,
                                    info_format='application/json', feature_count=5))
    try: return hent(KP + '?' + q).get('features', [])
    except Exception: return []


def ringer(piksler):
    """Ytre kant og hull rundt et sett piksler, som lukkede ringer i pikselhjørner."""
    s = set(piksler); kanter = {}
    for x, y in piksler:
        if (x, y - 1) not in s: kanter[(x, y)] = (x + 1, y)
        if (x + 1, y) not in s: kanter[(x + 1, y)] = kanter.get((x + 1, y)) or (x + 1, y + 1)
        if (x, y + 1) not in s: kanter.setdefault((x + 1, y + 1), (x, y + 1))
        if (x - 1, y) not in s: kanter.setdefault((x, y + 1), (x, y))
    # Hjørner som deles av to kanter (diagonal berøring) gir flere utganger – bruk liste.
    ut = defaultdict(list)
    for x, y in piksler:
        if (x, y - 1) not in s: ut[(x, y)].append((x + 1, y))
        if (x + 1, y) not in s: ut[(x + 1, y)].append((x + 1, y + 1))
        if (x, y + 1) not in s: ut[(x + 1, y + 1)].append((x, y + 1))
        if (x - 1, y) not in s: ut[(x, y + 1)].append((x, y))
    res = []
    while ut:
        start = next(iter(ut)); ring = [start]; p = start
        while True:
            nxt = ut[p].pop()
            if not ut[p]: del ut[p]
            p = nxt
            if p == start: break
            ring.append(p)
        # fjern punkter på rette linjer
        forenklet = [q for i, q in enumerate(ring) if not ((ring[i - 1][0] == q[0] == ring[(i + 1) % len(ring)][0]) or (ring[i - 1][1] == q[1] == ring[(i + 1) % len(ring)][1]))]
        if len(forenklet) >= 3: res.append(forenklet)
    return res


def naeringsomrader(kommune):
    q = urllib.parse.urlencode(dict(service='WMS', version='1.3.0', request='GetMap', layers='arealformal_kp', styles='', crs='EPSG:4326',
                                    bbox=f'{B[0]},{B[1]},{B[2]},{B[3]}', width=W, height=H, format='image/png', transparent='true'))
    im = Image.open(io.BytesIO(hent(KP + '?' + q, json_=False))).convert('RGBA'); px = im.load()
    lnf = (204, 255, 153, 255)
    sett = bytearray(W * H); flater = []
    for y in range(H):
        for x in range(W):
            c = px[x, y]
            if sett[y * W + x] or c[3] < 255 or c == lnf: continue
            k = deque([(x, y)]); sett[y * W + x] = 1; p = []
            while k:
                a, b = k.popleft(); p.append((a, b))
                for u, v in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if 0 <= u < W and 0 <= v < H and not sett[v * W + u] and px[u, v] == c:
                        sett[v * W + u] = 1; k.append((u, v))
            if len(p) >= 25: flater.append((c, p))
    print(len(flater), 'fargeflater', file=sys.stderr)

    def identifiser(f):
        c, p = f; s = set(p)
        sx = sum(q[0] for q in p) / len(p); sy = sum(q[1] for q in p) / len(p)
        indre = [q for q in p if all((q[0] + dx, q[1] + dy) in s for dx in (-1, 0, 1) for dy in (-1, 0, 1))] or p
        x, y = min(indre, key=lambda q: (q[0] - sx) ** 2 + (q[1] - sy) ** 2)
        lat, lon = ll(x + .5, y + .5)
        fs = featureinfo(lat, lon)
        return (fs[0]['properties'] if fs else None), (lat, lon)

    with ThreadPoolExecutor(8) as ex: info = list(ex.map(identifiser, flater))
    piksel_m2 = ((B[2] - B[0]) / H * 111320) * ((B[3] - B[1]) / W * 111320 * math.cos(math.radians(60.23)))
    grupper = defaultdict(lambda: {'piksler': [], 'pr': None, 'punkt': None})
    for (c, p), (pr, pt) in zip(flater, info):
        if not pr or pr.get('arealplanId.kommunenummer') != kommune or pr.get('arealformål') not in TA_MED: continue
        g = grupper[pr.get('identifikasjon.lokalId') or pr['objid']]
        g['piksler'] += p; g['pr'] = pr; g['punkt'] = g['punkt'] or pt
    feats = []
    for lid, g in grupper.items():
        pr = g['pr']
        rs = [[[round(ll(x, y)[1], 5), round(ll(x, y)[0], 5)] for x, y in r + [r[0]]] for r in ringer(g['piksler'])]
        feats.append({'type': 'Feature', 'geometry': {'type': 'Polygon', 'coordinates': rs}, 'properties': {
            'id': lid, 'arealformal': pr['arealformål'], 'status': 'framtidig' if pr.get('arealbruksstatus') == '2' else 'nåværende',
            'navn': pr.get('områdenavn'), 'beskrivelse': pr.get('beskrivelse'), 'utnytting': pr.get('utnytting.utnyttingstall'),
            'utnyttingstype': pr.get('utnytting.utnyttingstype'), 'daa': round(len(g['piksler']) * piksel_m2 / 1000, 1),
            'punkt': [round(g['punkt'][1], 5), round(g['punkt'][0], 5)], 'plan': pr.get('arealplanId.planidentifikasjon')}})
    feats.sort(key=lambda f: -f['properties']['daa'])
    return {'type': 'FeatureCollection', 'kilde': 'Nasjonal arealplanbase (DiBK), kommuneplanens arealdel. Omriss avledet fra kartbilde.', 'features': feats}


def main():
    os.makedirs(UT, exist_ok=True)
    k = hent('https://ws.geonorge.no/kommuneinfo/v1/kommuner/3238/omrade?utkoordsys=4258')
    json.dump({'type': 'Feature', 'geometry': k['omrade'], 'properties': {'navn': 'Nannestad', 'nr': '3238'}}, open(f'{UT}/kommune.geojson', 'w'), ensure_ascii=False, separators=(',', ':'))
    fc = naeringsomrader('3238')
    json.dump(fc, open(f'{UT}/naeringsomrader.geojson', 'w'), ensure_ascii=False, separators=(',', ':'))
    print(len(fc['features']), 'områder', file=sys.stderr)


if __name__ == '__main__':
    main()
