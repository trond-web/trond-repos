# Sporer reinsdyret i den opprinnelige logoen (lav oppløsning, JPEG) til en glatt SVG-bane.
# Kjør: python3 verktoy/spor-rein.py verktoy/logo/logo-original.jpg  > (skriver banen til stdout som JSON)
import sys, json, math
import numpy as np
from PIL import Image, ImageFilter

SKALA = 8          # forstørring før terskling, gir glatte kanter
TERSKEL = 228      # gråtoner under dette er reinsdyr (bakgrunnen er hvit)

GEVIR = (80, 0, 150, 40)  # område (x0, y0, x1, y1 i utsnittet) der geviret ligger
GEVIR_TERSKEL = 200       # geviret er mørkere; strengere terskel skiller takkene

def maske(fil):
    bilde = Image.open(fil).convert('L').crop((0, 80, 150, 212))
    stor = bilde.resize((bilde.width * SKALA, bilde.height * SKALA), Image.LANCZOS)
    kropp = np.array(stor.filter(ImageFilter.GaussianBlur(SKALA * 0.3))) < TERSKEL
    gevir = np.array(stor.filter(ImageFilter.GaussianBlur(SKALA * 0.19))) < GEVIR_TERSKEL
    x0, y0, x1, y1 = (v * SKALA for v in GEVIR)
    a = kropp.copy()
    a[y0:y1, x0:x1] = gevir[y0:y1, x0:x1]
    return np.pad(a, 1)

def marsjerende_ruter(m):
    # Kantsegmenter mellom innside og utside, koblet til lukkede løkker (ytterkant og hull).
    h, w = m.shape
    seg = {}
    def leggtil(a, b): seg.setdefault(a, []).append(b)
    for y in range(h - 1):
        rad0, rad1 = m[y], m[y + 1]
        for x in range(w - 1):
            k = (rad0[x] << 3) | (rad0[x + 1] << 2) | (rad1[x + 1] << 1) | rad1[x]
            if k in (0, 15): continue
            T, R, B, L = (x + .5, y), (x + 1, y + .5), (x + .5, y + 1), (x, y + .5)
            tab = {1: [(L, B)], 2: [(B, R)], 3: [(L, R)], 4: [(R, T)], 5: [(L, T), (R, B)], 6: [(B, T)], 7: [(L, T)],
                   8: [(T, L)], 9: [(T, B)], 10: [(T, R), (B, L)], 11: [(T, R)], 12: [(R, L)], 13: [(R, B)], 14: [(B, L)]}
            for a, b in tab[k]: leggtil(a, b)
    løkker = []
    while seg:
        start = next(iter(seg)); p = start; løkke = [p]
        while True:
            nxt = seg[p].pop()
            if not seg[p]: del seg[p]
            if nxt == start: break
            løkke.append(nxt); p = nxt
            if p not in seg: break
        løkker.append(løkke)
    return løkker

def areal(l): return sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(l, l[1:] + l[:1])) / 2

def rdp(pts, tol):
    if len(pts) < 3: return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1; n = math.hypot(dx, dy) or 1e-9
    d = [abs(dy * x - dx * y + x2 * y1 - y2 * x1) / n for x, y in pts]
    i = max(range(len(d)), key=d.__getitem__)
    if d[i] > tol: return rdp(pts[:i + 1], tol)[:-1] + rdp(pts[i:], tol)
    return [pts[0], pts[-1]]

def glatt(l, runder=2):
    for _ in range(runder):
        ny = []
        for (x1, y1), (x2, y2) in zip(l, l[1:] + l[:1]):
            ny += [(.75 * x1 + .25 * x2, .75 * y1 + .25 * y2), (.25 * x1 + .75 * x2, .25 * y1 + .75 * y2)]
        l = ny
    return l

def bane(fil, tol=1.3):
    m = maske(fil)
    løkker = [l for l in marsjerende_ruter(m) if abs(areal(l)) > 40 * SKALA]
    deler = []
    for l in løkker:
        # Lukket RDP: del løkka i to for å ha faste endepunkter.
        mid = len(l) // 2
        enkel = rdp(l[:mid + 1], tol)[:-1] + rdp(l[mid:] + l[:1], tol)[:-1]
        punkter = glatt(enkel)
        deler.append('M' + ' '.join(f'{(x - 1) / SKALA:.1f},{(y - 1) / SKALA:.1f}' for x, y in punkter) + 'Z')
    return ''.join(deler), len(løkker)

if __name__ == '__main__':
    d, n = bane(sys.argv[1])
    print(json.dumps({'d': d, 'løkker': n, 'bredde': 150, 'hoyde': 132}))
