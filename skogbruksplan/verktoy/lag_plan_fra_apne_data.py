#!/usr/bin/env python3
"""
Lager et utkast til skogbruksplan for én eiendom fra åpne data:

  * Eiendomsgrense: Kartverket eiendom-API (matrikkelens teiger)
  * Bestandsgrenser og takstdata: NIBIO WMS «skogbruksplan», lag «hogstklasser»
    (generaliserte data fra tidligere skogbruksplaner)
  * Oppdaterte skogdata: NIBIO SR16 vektor (SRV) – volum, høyde, treantall,
    treslag, bonitet og trealder per skogressursflate
  * Miljø: NIBIO MiS, lag «Nokkelbiotop»

Resultatet er en GeoJSON (WGS84) som kan importeres direkte i appen.

Bruk:
  pip install shapely pyproj requests
  python3 verktoy/lag_plan_fra_apne_data.py --kommune 3238 --gnr 29 --bnr 2 --ut data/nannestad-29-2.geojson
"""
import argparse
import json
import sys
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import date

import requests
from pyproj import Transformer
from shapely.geometry import shape, mapping, Polygon, MultiPolygon, box
from shapely.ops import transform, unary_union

EPSG = 25832
SR16 = 'https://wms.nibio.no/cgi-bin/sr16'
SBP = 'https://wms.nibio.no/cgi-bin/skogbruksplan'
MIS = 'https://wms.nibio.no/cgi-bin/mis'
KML_NS = {'k': 'http://www.opengis.net/kml/2.2'}
TIL_UTM = Transformer.from_crs(4326, EPSG, always_xy=True).transform
TIL_GEO = Transformer.from_crs(EPSG, 4326, always_xy=True).transform
SR16_TRESLAG = {1: 'G', 2: 'F', 3: 'L'}
PLAN_TRESLAG = {'Gran': 'G', 'Furu': 'F', 'Lauv': 'L', 'Bjørk': 'L'}

okt = requests.Session()


def hent(url, params, forsok=4):
    for i in range(forsok):
        try:
            r = okt.get(url, params=params, timeout=90)
            r.raise_for_status()
            return r
        except requests.RequestException:
            if i == forsok - 1:
                raise


def hent_eiendom(kommune, gnr, bnr):
    r = hent('https://api.kartverket.no/eiendom/v1/geokoding', {
        'kommunenummer': kommune, 'gardsnummer': gnr, 'bruksnummer': bnr,
        'omrade': 'true', 'utkoordsys': EPSG})
    teiger = [shape(f['geometry']) for f in r.json()['features']]
    if not teiger:
        sys.exit(f'Fant ingen teiger for {kommune} {gnr}/{bnr}')
    return unary_union(teiger), r.json()['features']


def hent_kml_polygoner(base, lag, omraade):
    """Henter vektorobjekter som KML via WMS GetMap. Returnerer {id: polygon i UTM}."""
    minx, miny, maxx, maxy = omraade.buffer(30).bounds
    r = hent(base, {
        'SERVICE': 'WMS', 'VERSION': '1.1.1', 'REQUEST': 'GetMap', 'LAYERS': lag, 'STYLES': '',
        'SRS': f'EPSG:{EPSG}', 'BBOX': f'{minx},{miny},{maxx},{maxy}',
        'WIDTH': 2000, 'HEIGHT': max(200, int(2000 * (maxy - miny) / (maxx - minx))), 'FORMAT': 'kml'})
    rot = ET.fromstring(r.content)
    ut = {}
    for pm in rot.iter('{http://www.opengis.net/kml/2.2}Placemark'):
        navn = pm.findtext('k:name', namespaces=KML_NS) or ''
        polys = []
        for p in pm.iter('{http://www.opengis.net/kml/2.2}Polygon'):
            ring = lambda el: [tuple(map(float, c.split(',')[:2])) for c in el.text.split()]
            ytre = ring(p.find('.//k:outerBoundaryIs//k:coordinates', KML_NS))
            indre = [ring(e) for e in p.findall('.//k:innerBoundaryIs//k:coordinates', KML_NS)]
            polys.append(Polygon(ytre, indre))
        if not polys:
            continue
        g = transform(TIL_UTM, unary_union(polys)).buffer(0)
        ut[navn.split('.')[-1]] = unary_union([ut[navn.split('.')[-1]], g]) if navn.split('.')[-1] in ut else g
    return ut


def hent_attributter(base, lag, punkt):
    x, y = punkt.x, punkt.y
    r = hent(base, {
        'SERVICE': 'WMS', 'VERSION': '1.1.1', 'REQUEST': 'GetFeatureInfo', 'LAYERS': lag, 'QUERY_LAYERS': lag,
        'SRS': f'EPSG:{EPSG}', 'BBOX': f'{x - 1},{y - 1},{x + 1},{y + 1}', 'WIDTH': 3, 'HEIGHT': 3, 'X': 1, 'Y': 1,
        'INFO_FORMAT': 'application/vnd.ogc.gml', 'FEATURE_COUNT': 1})
    rot = ET.fromstring(r.content)
    f = rot.find(f'.//{lag}_feature')
    if f is None:
        return None
    return {el.tag: el.text for el in f if not el.tag.startswith('{')}


def attributter_for(base, lag, geometrier, idfelt):
    """Henter attributter for hvert polygon ved å spørre i et punkt inni det."""
    def en(item):
        gid, g = item
        a = hent_attributter(base, lag, g.representative_point())
        if a and idfelt and a.get(idfelt) not in (None, gid):
            return gid, None  # traff et annet objekt; hopp over
        return gid, a
    with ThreadPoolExecutor(8) as ex:
        return dict(ex.map(en, geometrier.items()))


def tall(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def arealvektet(deler, felt, faktor=1.0):
    s = vekt = 0.0
    for a, attr in deler:
        v = tall(attr.get(felt))
        if v is not None:
            s += v * a
            vekt += a
    return (s / vekt) * faktor if vekt else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--kommune', required=True)
    ap.add_argument('--gnr', type=int, required=True)
    ap.add_argument('--bnr', type=int, required=True)
    ap.add_argument('--ut', required=True)
    ap.add_argument('--min-daa', type=float, default=1.0, help='slå sammen/fjern biter mindre enn dette')
    a = ap.parse_args()
    iaar = date.today().year

    eiendom, teiger = hent_eiendom(a.kommune, a.gnr, a.bnr)
    print(f'Eiendom {a.gnr}/{a.bnr}: {len(teiger)} teig(er), {eiendom.area / 1000:.1f} daa', file=sys.stderr)

    plan = hent_kml_polygoner(SBP, 'hogstklasser', eiendom)
    plan = {k: g for k, g in plan.items() if g.intersection(eiendom).area > 50}
    plan_attr = attributter_for(SBP, 'hogstklasser', plan, None)
    print(f'Bestand fra tidligere plan: {len(plan)}', file=sys.stderr)

    sr16 = hent_kml_polygoner(SR16, 'SRVTRESLAG', eiendom)
    sr16 = {k: g for k, g in sr16.items() if g.intersection(eiendom).area > 20}
    sr16_attr = attributter_for(SR16, 'SRVTRESLAG', sr16, 'gid')
    print(f'SR16-flater: {len(sr16)} ({sum(1 for v in sr16_attr.values() if v)} med data)', file=sys.stderr)

    mis = hent_kml_polygoner(MIS, 'Nokkelbiotop', eiendom)
    mis_union = unary_union([g for g in mis.values()]) if mis else None
    print(f'MiS-nøkkelbiotoper i området: {len(mis)}', file=sys.stderr)

    # Bestand = planens bestand klippet til eiendommen; skog utenfor planen dekkes av SR16-flater.
    kandidater = []
    for gid, g in plan.items():
        attr = plan_attr.get(gid) or {}
        kandidater.append(('plan', gid, g.intersection(eiendom), attr))
    planflate = unary_union([k[2] for k in kandidater]) if kandidater else Polygon()
    for gid, g in sr16.items():
        rest = g.intersection(eiendom).difference(planflate.buffer(0.5))
        if rest.area / 1000 >= a.min_daa and sr16_attr.get(gid):
            kandidater.append(('sr16', gid, rest, {}))

    features = []
    lopenr = 0
    for kilde, gid, g, attr in kandidater:
        g = g.buffer(0)
        if g.is_empty or g.area / 1000 < a.min_daa:
            continue
        deler = []
        for sgid, sg in sr16.items():
            sa = sr16_attr.get(sgid)
            if sa and sg.intersects(g):
                ia = sg.intersection(g).area
                if ia > 1:
                    deler.append((ia, sa))
        dekning = sum(d[0] for d in deler) / g.area
        treslag_areal = {}
        for ia, sa in deler:
            t = SR16_TRESLAG.get(int(tall(sa.get('srtreslag')) or 0))
            if t:
                treslag_areal[t] = treslag_areal.get(t, 0) + ia
        sr_treslag = max(treslag_areal, key=treslag_areal.get) if treslag_areal else None
        volub = arealvektet(deler, 'srvolub', 0.1)       # m³/ha -> m³/daa
        volmb = arealvektet(deler, 'srvolmb', 0.1)
        hoyde = arealvektet(deler, 'srhoydem', 0.1)      # dm -> m
        trean = arealvektet(deler, 'srtrean', 0.1)       # per ha -> per daa
        sr_alder = arealvektet(deler, 'srtrealder')
        sr_bon = arealvektet(deler, 'srbonitet')
        usikkerhet = arealvektet(deler, 'srvolub_s')

        if kilde == 'plan':
            nr = attr.get('teig_best_nr') or gid
            bon_txt = (attr.get('bonitet_beskrivelse') or '').replace('Bonitet', '').strip()
            bonitet = tall(bon_txt) or (round(sr_bon) if sr_bon else None)
            plan_ts = PLAN_TRESLAG.get(attr.get('bontre_beskrivelse'))
            alder = tall(attr.get('alder_korr'))
            hk_plan = tall(attr.get('hogstkl_verdi'))
            regaar = attr.get('regaar_korr')
        else:
            lopenr += 1
            nr = f'S{lopenr}'
            bonitet = round(sr_bon) if sr_bon else None
            plan_ts = None
            alder = round(sr_alder) if sr_alder else None
            hk_plan = None
            regaar = None

        treslag = sr_treslag if (sr_treslag and dekning > 0.5) else (plan_ts or sr_treslag or 'G')
        merknader = []
        if kilde == 'sr16':
            merknader.append('Ikke med i tidligere plan – data fra SR16')
        if hk_plan and hk_plan >= 4 and volub is not None and volub < 3 and dekning > 0.5:
            merknader.append(f'Mulig hogd etter {regaar}: SR16 viser {volub:.1f} m³/daa mot HK {int(hk_plan)} i planen – kontroller')
            alder = 0
        elif hk_plan and hk_plan >= 4 and volub is not None and hoyde is not None and volub < 8 and hoyde < 10 and dekning > 0.5:
            merknader.append(f'Avvik: HK {int(hk_plan)} i planen ({regaar}), men SR16 viser {volub:.1f} m³/daa og {hoyde:.1f} m høyde – trolig hogd eller glissen, kontroller')
        if plan_ts and sr_treslag and plan_ts != sr_treslag and dekning > 0.5:
            merknader.append(f'Treslag: plan {plan_ts}, SR16 {sr_treslag}')
        miljo = bool(mis_union and g.intersection(mis_union).area > max(500, 0.2 * g.area))
        if miljo:
            merknader.append('Overlapper MiS-nøkkelbiotop')

        props = {
            'BESTANDNR': nr,
            'TEIG': nr.split('-')[0] if '-' in str(nr) else None,
            'AREAL_DAA': round(g.area / 1000, 1),
            'TRESLAG': treslag,
            'BONITET': int(bonitet) if bonitet else None,
            'ALDER': int(round(alder)) if alder is not None else None,
            'VOLUM_DAA': round(volub, 1) if volub is not None else None,
            'TREANTALL': int(round(trean)) if trean is not None else None,
            'MIDDELHOYDE': round(hoyde, 1) if hoyde is not None else None,
            'MILJOFIGUR': 'Ja' if miljo else None,
            'MERKNAD': '; '.join(merknader) or None,
            'KILDE': 'Tidligere skogbruksplan (NIBIO) + SR16' if kilde == 'plan' else 'SR16',
            'PLAN_HOGSTKLASSE': int(hk_plan) if hk_plan else None,
            'PLAN_REGISTRERT': regaar,
            'SR16_ALDER': round(sr_alder) if sr_alder else None,
            'SR16_BONITET': round(sr_bon) if sr_bon else None,
            'SR16_VOLUM_MB_DAA': round(volmb, 1) if volmb is not None else None,
            'SR16_VOLUM_USIKKERHET_PST': round(usikkerhet) if usikkerhet else None,
            'SR16_DEKNING_PST': round(dekning * 100),
        }
        geo = transform(TIL_GEO, g)
        geo = MultiPolygon([geo]) if isinstance(geo, Polygon) else geo
        geo = MultiPolygon([p for p in getattr(geo, 'geoms', [geo]) if isinstance(p, Polygon) and p.area > 0])
        features.append({'type': 'Feature', 'properties': props,
                         'geometry': mapping(geo.geoms[0] if len(geo.geoms) == 1 else geo)})

    def sortnokkel(f):
        n = str(f['properties']['BESTANDNR'])
        deler = n.lstrip('S').split('-')
        return (n.startswith('S'), [int(x) if x.isdigit() else 0 for x in deler], n)
    features.sort(key=sortnokkel)
    ut = {
        'type': 'FeatureCollection',
        'metadata': {
            'eiendom': f'{a.kommune} {a.gnr}/{a.bnr}',
            'areal_eiendom_daa': round(eiendom.area / 1000, 1),
            'laget': date.today().isoformat(),
            'kilder': ['Kartverket eiendom-API', 'NIBIO skogbruksplan/hogstklasser', 'NIBIO SR16 (SRV)', 'NIBIO MiS'],
            'merk': 'Utkast basert på åpne data. Må kontrolleres i felt før det brukes som grunnlag for hogst.',
        },
        'eiendomsgrense': mapping(transform(TIL_GEO, eiendom)),
        'features': features,
    }
    with open(a.ut, 'w', encoding='utf-8') as f:
        json.dump(ut, f, ensure_ascii=False, separators=(',', ':'))
    print(f'Skrev {len(features)} bestand til {a.ut}', file=sys.stderr)


if __name__ == '__main__':
    main()
