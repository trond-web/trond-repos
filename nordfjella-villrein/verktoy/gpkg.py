# Lesing av GeoPackage-geometri (WKB) og omregning fra UTM 32 til grader, uten eksterne biblioteker.
import sqlite3, struct, json, math, sys
from collections import Counter

def utm_til_grader(e, n, sone=32):
    # Krüger-serier (invers), samme ellipsoide som EUREF89/WGS84.
    a = 6378137.0; f = 1 / 298.257222101; k0 = 0.9996
    nn = f / (2 - f); A = a / (1 + nn) * (1 + nn**2 / 4 + nn**4 / 64)
    beta = [nn/2 - 2/3*nn**2 + 37/96*nn**3, 1/48*nn**2 + 1/15*nn**3, 17/480*nn**3]
    delta = [2*nn - 2/3*nn**2 - 2*nn**3, 7/3*nn**2 - 8/5*nn**3, 56/15*nn**3]
    xi = n / (k0 * A); eta = (e - 500000) / (k0 * A)
    xi_ = xi - sum(beta[j-1] * math.sin(2*j*xi) * math.cosh(2*j*eta) for j in (1, 2, 3))
    eta_ = eta - sum(beta[j-1] * math.cos(2*j*xi) * math.sinh(2*j*eta) for j in (1, 2, 3))
    chi = math.asin(math.sin(xi_) / math.cosh(eta_))
    phi = chi + sum(delta[j-1] * math.sin(2*j*chi) for j in (1, 2, 3))
    lam = math.atan2(math.sinh(eta_), math.cos(xi_))
    return math.degrees(lam) + (sone * 6 - 183), math.degrees(phi)

def les_wkb(b, o=0):
    bo = '<' if b[o] == 1 else '>'
    typ = struct.unpack_from(bo + 'I', b, o + 1)[0]; o += 5
    base = typ % 1000; dim = 3 if (typ // 1000) in (1, 2) else 4 if typ // 1000 == 3 else 2
    if typ & 0x80000000: dim = 3; base = typ & 0xFF
    def ring(o):
        n = struct.unpack_from(bo + 'I', b, o)[0]; o += 4
        pts = []
        for _ in range(n):
            x, y = struct.unpack_from(bo + 'dd', b, o); o += 8 * dim; pts.append((x, y))
        return pts, o
    if base == 3:
        nr = struct.unpack_from(bo + 'I', b, o)[0]; o += 4; rs = []
        for _ in range(nr): r, o = ring(o); rs.append(r)
        return [rs], o
    if base == 6:
        np_ = struct.unpack_from(bo + 'I', b, o)[0]; o += 4; ps = []
        for _ in range(np_): p, o = les_wkb(b, o); ps += p
        return ps, o
    raise ValueError(f'geometritype {typ}')

def les_gpkg_geom(b):
    assert b[:2] == b'GP'
    flags = b[3]; env = (flags >> 1) & 7
    o = 8 + {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[env]
    return les_wkb(b, o)[0]

if False:
    kilde, mål = sys.argv[1], sys.argv[2]
    c = sqlite3.connect(kilde)
    feats = []; npkt = 0
    for fid, geom, kom, vald, felt, delomr, nr, navn in c.execute('select fid, geom, KOMMUNE, VALD, JAKTFELT, DELOMR, Feltnavn, Jaktfeltna from nordfjella_valdgr order by fid'):
        polys = les_gpkg_geom(geom)
        ut = [[[[round(v, 6) for v in utm_til_grader(x, y)] for x, y in r] for r in p] for p in polys]
        npkt += sum(len(r) for p in polys for r in p)
        feats.append({'fid': fid, 'kommune': kom, 'vald': vald, 'jaktfelt': felt, 'delomr': delomr, 'nr': nr, 'navn': navn, 'polys': ut, 'utm': polys})
    print(len(feats), 'flater', npkt, 'punkter', file=sys.stderr)
    json.dump(feats, open(mål, 'w'))

def dp(pts, tol):
    # Douglas–Peucker i meter (UTM). Første og siste punkt beholdes.
    if len(pts) < 3: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True; stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop(); (x1, y1), (x2, y2) = pts[i], pts[j]
        dx, dy = x2 - x1, y2 - y1; l2 = dx * dx + dy * dy; best, bi = -1, -1
        for k in range(i + 1, j):
            x, y = pts[k]
            if l2 == 0: d = math.hypot(x - x1, y - y1)
            else:
                t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / l2)); d = math.hypot(x - x1 - t * dx, y - y1 - t * dy)
            if d > best: best, bi = d, k
        if best > tol: keep[bi] = True; stack += [(i, bi), (bi, j)]
    return [p for p, k in zip(pts, keep) if k]
