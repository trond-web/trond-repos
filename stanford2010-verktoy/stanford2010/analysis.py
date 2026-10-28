"""Analyse av StanForD 2010-rapporter.

    from stanford2010 import open_file
    from stanford2010.analysis import analyze, analyze_files

    a = analyze(open_file("objekt.hpr"))      # én fil -> dict med nøkkeltall og tabeller
    b = analyze_files(["a.hpr", "a.mom"])      # flere filer + samlet analyse (m3/G15-time, l/m3)

Hva som analyseres:
  hpr  produksjon per treslag/sortiment/fører/dag, middelstamme, diameterfordeling,
       apteringsutfall i prismatrisen, verdi (pris x prisvolum), kappårsaker,
       anslått produktivitet ut fra hogsttidspunkt, areal og tetthet ut fra
       stammekoordinater, datakvalitet
  hqc  avvik maskin - manuelt mål for lengde og diameter (snitt, standardavvik,
       andel innenfor toleranse), forslag til kalibrering, kalibreringshistorikk
  mom  tidsfordeling (driftstid, avbrudd, stillestående), drivstoff, kjørt
       distanse, produksjon fra HarvesterData/ForwarderData, per dag og fører
  fpr  lass, volum per leveranse/sortiment, lass per dag, kjøreavstand

Tallene er beregnet ut fra det maskinen har rapportert. Produktivitet fra hpr
er et anslag (tid mellom stammer, pauser over 15 min tas ut) - bruk mom når den
finnes. Toleransene for kontrollmåling er innstillbare; standardverdiene er
Skogforsks gamle mål (lengde: 60 % innenfor ±2 cm, standardavvik maks 3 cm;
diameter: 50 % innenfor ±4 mm). Sjekk mot avtalen som gjelder.
"""
from __future__ import annotations

import math
import re
import statistics
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

from .reader import StanfordFile, open_file
from .xmlio import find, findall, local, num, text

HQC_TOLERANCE = {
    "length_cm": 2.0, "length_share": 0.60, "length_sd_cm": 3.0,
    "diameter_mm": 4.0, "diameter_share": 0.50,
}
GAP_MINUTES = 15  # avbrudd lenger enn dette regnes ikke som driftstid (G15)

_TS = re.compile(r"(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)")


def parse_time(s: str | None) -> datetime | None:
    """Tidspunkt slik maskinen skrev det (lokal tid). Tåler 7 desimaler og avkuttet tidssone."""
    if not s:
        return None
    m = _TS.match(s.strip())
    if not m:
        return None
    t = m.group(2) if m.group(2).count(":") == 2 else m.group(2) + ":00"
    try:
        return datetime.fromisoformat(f"{m.group(1)}T{t}")
    except ValueError:
        return None


def _r(x, n=2):
    return None if x is None else round(x, n)


def _div(a, b, n=2):
    return round(a / b, n) if a is not None and b else None


def _sub(row: dict) -> float:
    """Volum under bark (m3fub). Faller tilbake på estimert volum (felte stammer)."""
    for k in ("vol_m3sub", "vol_m3subestimated", "vol_stem_m3sub", "vol_stem_m3subestimated"):
        if row.get(k):
            return row[k]
    return 0.0


def _sob(row: dict) -> float:
    for k in ("vol_m3sob", "vol_m3sobestimated", "vol_stem_m3sob", "vol_stem_m3sobestimated"):
        if row.get(k):
            return row[k]
    return 0.0


def _stats(values: list[float], tol: float | None = None) -> dict:
    v = [x for x in values if x is not None]
    if not v:
        return {"n": 0}
    out = {"n": len(v), "mean": _r(statistics.fmean(v), 2),
           "sd": _r(statistics.stdev(v), 2) if len(v) > 1 else None,
           "min": min(v), "max": max(v)}
    if tol is not None:
        out["within"] = round(sum(abs(x) <= tol for x in v) / len(v), 3)
    return out


def _hist(values, width: float, lo: float | None = None) -> list[dict]:
    v = [x for x in values if x is not None]
    if not v:
        return []
    start = math.floor((lo if lo is not None else min(v)) / width) * width
    cnt = Counter(math.floor((x - start) / width) for x in v)
    return [{"from": start + i * width, "to": start + (i + 1) * width, "n": cnt.get(i, 0)}
            for i in range(0, max(cnt) + 1)]


# =============================================================================
# Prismatrise fra produktdefinisjonene (hpr/pin)
# =============================================================================

def price_matrices(sf: StanfordFile) -> dict:
    """ProductKey (eller ProductUserID i pin) -> klasser, priser og forbudte celler."""
    out = {}
    for p in findall(sf._scope, "ProductDefinition"):
        c = find(p, "ClassifiedProductDefinition")
        if c is None:
            continue
        key = num(p, "ProductKey")
        if key is None:
            key = text(p, "ProductUserID") or text(c, "ProductUserID")
        dc = find(c, "DiameterDefinition/DiameterClasses")
        prices, forbidden = {}, set()
        for it in findall(c, "ProductMatrixes/ProductMatrixItem"):
            d, l = int(it.get("diameterClassLowerLimit")), int(it.get("lengthClassLowerLimit"))
            prices[(d, l)] = num(it, "Price") or 0
            if "Forbidden" in (text(it, "BuckingCriteria") or ""):
                forbidden.add((d, l))
        out[key] = {
            "name": text(c, "ProductName"),
            "category": (dc.get("diameterClassCategory") if dc is not None else None) or "Top",
            "under_bark": (text(dc, "DiameterUnderBark") or "true").lower() == "true",
            "diameters": sorted({d for d, _ in prices}),
            "lengths": sorted({l for _, l in prices}),
            "d_max": num(dc, "DiameterClassMAX"),
            "l_max": num(c, "LengthDefinition/LengthClassMAX"),
            "prices": prices, "forbidden": forbidden,
        }
    return out


def _class(value, limits):
    if value is None:
        return None
    return max((x for x in limits if x <= value), default=None)


def _log_diameter(log: dict, category: str, under_bark: bool):
    pos = {"Top": "top", "Mid": "mid", "Butt": "butt"}.get(category, "top")
    bark = "ub" if under_bark else "ob"
    return log.get(f"diam_{pos}_{bark}_mm") or log.get(f"diam_{pos}_ob_mm")


# =============================================================================
# hpr - hogstproduksjon
# =============================================================================

def _productive_hours(times: list[datetime], gap_min=GAP_MINUTES) -> float:
    times = sorted(t for t in times if t)
    secs = 0.0
    for a, b in zip(times, times[1:]):
        d = (b - a).total_seconds()
        if 0 < d <= gap_min * 60:
            secs += d
    return secs / 3600


def _hull_area_ha(points: list[tuple[float, float]]) -> float | None:
    """Areal (ha) innenfor ytterste stammer (konveks hull), lokal projeksjon."""
    if len(points) < 3:
        return None
    lat0 = statistics.fmean(p[0] for p in points)
    k = math.cos(math.radians(lat0)) * 111_320
    xy = sorted({(round(lon * k, 1), round(lat * 110_574, 1)) for lat, lon in points})
    if len(xy) < 3:
        return None

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for p in xy:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(xy):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    hull = lower[:-1] + upper[:-1]
    a = sum(hull[i][0] * hull[(i + 1) % len(hull)][1] - hull[(i + 1) % len(hull)][0] * hull[i][1]
            for i in range(len(hull)))
    return abs(a) / 2 / 10_000


def analyze_hpr(sf: StanfordFile, gap_min: float = GAP_MINUTES, dbh_class_mm: int = 20) -> dict:
    stems = sf.stems()
    logs = [l for l in sf.logs() if l["measured_by"] == "Machine"]
    ops = {o["operator_key"]: o["name"] or o["operator_user_id"] for o in sf.operators()}
    matrices = price_matrices(sf)
    known_products = {p["product_key"] for p in sf.products()}
    sub_objects = {s["sub_object_key"]: s["name"] or s["user_id"]
                   for o in sf.objects() for s in o["sub_objects"]}

    # Volum per stamme: sum av stokkene, ellers stammevolum (felte, ikke kvistede stammer)
    log_vol = defaultdict(lambda: [0.0, 0.0])
    for l in logs:
        v = log_vol[l["stem_key"]]
        v[0] += _sub(l)
        v[1] += _sob(l)
    for s in stems:
        lv = log_vol.get(s["stem_key"])
        s["_sub"] = lv[0] if lv else _sub(s)
        s["_sob"] = lv[1] if lv else _sob(s)
        s["_t"] = parse_time(s["harvest_date"])

    tot_sub = sum(s["_sub"] for s in stems)
    tot_sob = sum(s["_sob"] for s in stems)
    times = [s["_t"] for s in stems if s["_t"]]
    hours = _productive_hours(times, gap_min)

    # Verdi og apteringsutfall
    value_total, value_logs = 0.0, 0
    cells = defaultdict(lambda: defaultdict(lambda: {"n": 0, "m3": 0.0}))
    outside, forbidden_used = Counter(), Counter()
    per_product = defaultdict(lambda: {"logs": 0, "m3sub": 0.0, "m3sob": 0.0, "value": 0.0,
                                       "length_sum": 0.0, "species": None, "group": None})
    for l in logs:
        pp = per_product[l["product"] or f"Produkt {l['product_key']}"]
        pp["logs"] += 1
        pp["m3sub"] += _sub(l)
        pp["m3sob"] += _sob(l)
        pp["length_sum"] += l["length_cm"] or 0
        pp["species"], pp["group"] = l["species"], l["product_group"]
        m = matrices.get(l["product_key"])
        if not m or not m["prices"]:
            continue
        d = _log_diameter(l, m["category"], m["under_bark"])
        dc, lc = _class(d, m["diameters"]), _class(l["length_cm"], m["lengths"])
        if dc is None or lc is None:
            outside[m["name"]] += 1
            continue
        cell = cells[l["product_key"]][(dc, lc)]
        cell["n"] += 1
        cell["m3"] += _sub(l)
        if (dc, lc) in m["forbidden"]:
            forbidden_used[m["name"]] += 1
        pv = l.get("vol_m3price") or _sub(l)
        val = m["prices"][(dc, lc)] * pv
        value_total += val
        value_logs += 1
        pp["value"] += val

    product_rows = []
    for name, p in sorted(per_product.items(), key=lambda kv: -kv[1]["m3sub"]):
        product_rows.append({
            "product": name, "species": p["species"], "group": p["group"], "logs": p["logs"],
            "m3sub": _r(p["m3sub"], 3), "m3sob": _r(p["m3sob"], 3),
            "share": _div(p["m3sub"], tot_sub, 3),
            "mean_length_cm": _div(p["length_sum"], p["logs"], 0),
            "mean_log_m3sub": _div(p["m3sub"], p["logs"], 4),
            "value": _r(p["value"], 0) if p["value"] else None,
            "value_per_m3": _div(p["value"], p["m3sub"], 0) if p["value"] else None,
        })

    assortment = []
    for key, cl in cells.items():
        m = matrices[key]
        assortment.append({
            "product_key": key, "product": m["name"], "diameters": m["diameters"],
            "lengths": m["lengths"], "category": m["category"], "under_bark": m["under_bark"],
            "cells": [{"d": d, "l": l, "n": c["n"], "m3": _r(c["m3"], 3),
                       "price": m["prices"][(d, l)], "forbidden": (d, l) in m["forbidden"]}
                      for (d, l), c in sorted(cl.items())],
        })
    assortment.sort(key=lambda a: -sum(c["n"] for c in a["cells"]))

    def group(keyfun):
        g = defaultdict(list)
        for s in stems:
            g[keyfun(s)].append(s)
        rows = []
        for k, ss in g.items():
            sub = sum(s["_sub"] for s in ss)
            h = _productive_hours([s["_t"] for s in ss], gap_min)
            rows.append({"key": k, "stems": len(ss), "m3sub": _r(sub, 3),
                         "m3sob": _r(sum(s["_sob"] for s in ss), 3),
                         "share": _div(sub, tot_sub, 3), "mean_stem_m3sub": _div(sub, len(ss), 4),
                         "mean_dbh_mm": _r(statistics.fmean([s["dbh_mm"] for s in ss if s["dbh_mm"]]), 0)
                         if any(s["dbh_mm"] for s in ss) else None,
                         "hours": _r(h, 2), "m3_per_hour": _div(sub, h) if h >= 0.5 else None,
                         "stems_per_hour": _div(len(ss), h, 1) if h >= 0.5 else None})
        return sorted(rows, key=lambda r: (r["key"] is None, str(r["key"])))

    per_species = group(lambda s: s["species"] or f"Treslag {s['species_group_key']}")
    per_operator = group(lambda s: ops.get(s["operator_key"]) or (f"Fører {s['operator_key']}"
                                                                    if s["operator_key"] is not None else "Ukjent"))
    per_day = [r for r in group(lambda s: s["_t"].date().isoformat() if s["_t"] else None) if r["key"]]
    per_sub_object = group(lambda s: sub_objects.get(s["sub_object_key"]) or s["sub_object_key"]) \
        if any(s["sub_object_key"] is not None for s in stems) else []

    # Diameterfordeling (brysthøyde) per treslag
    species_names = [r["key"] for r in per_species]
    dist = defaultdict(lambda: defaultdict(lambda: [0, 0.0]))
    for s in stems:
        if s["dbh_mm"]:
            c = int(s["dbh_mm"] // dbh_class_mm * dbh_class_mm)
            x = dist[c][s["species"] or f"Treslag {s['species_group_key']}"]
            x[0] += 1
            x[1] += s["_sub"]
    dbh_dist = [{"from_mm": c, "to_mm": c + dbh_class_mm,
                 "by_species": {sp: {"stems": v[0], "m3sub": _r(v[1], 3)} for sp, v in d.items()},
                 "stems": sum(v[0] for v in d.values())}
                for c, d in ((c, dist.get(c, {})) for c in (range(min(dist), max(dist) + 1, dbh_class_mm) if dist else []))]
    stem_vol_dist = _hist([s["_sub"] for s in stems if s["_sub"]], 0.1, 0)

    # Romlig
    pts = [(s["latitude"], s["longitude"]) for s in stems if s["latitude"] and s["longitude"]]
    area = _hull_area_ha(pts)
    step = max(1, len(stems) // 4000)
    points = [{"lat": s["latitude"], "lon": s["longitude"], "sp": s["species"], "m3": _r(s["_sub"], 3),
               "dbh": s["dbh_mm"], "n": s["stem_number"]}
              for s in stems[::step] if s["latitude"] and s["longitude"]]

    # Datakvalitet
    numbers = sorted(s["stem_number"] for s in stems if s["stem_number"] is not None)
    missing = (numbers[-1] - numbers[0] + 1 - len(set(numbers))) if numbers else 0
    dup_keys = [k for k, c in Counter(s["stem_key"] for s in stems).items() if c > 1]
    quality = {
        "stem_number_gaps": missing,
        "duplicate_stem_keys": len(dup_keys),
        "stems_without_coordinates": sum(1 for s in stems if not (s["latitude"] and s["longitude"])),
        "stems_without_time": sum(1 for s in stems if not s["_t"]),
        "stems_without_logs": sum(1 for s in stems if s["n_logs"] == 0 and "Processed" in str(s["processing"])),
        "logs_unknown_product": sum(1 for l in logs if l["product_key"] not in known_products),
        "logs_zero_volume": sum(1 for l in logs if not _sub(l)),
        "logs_outside_matrix": dict(outside),
        "logs_in_forbidden_cells": dict(forbidden_used),
    }
    notes = []
    if missing:
        notes.append(f"{missing} stammenummer mangler i rekken - delrapport eller tapte data.")
    if dup_keys:
        notes.append(f"{len(dup_keys)} StemKey forekommer flere ganger.")
    if quality["logs_unknown_product"]:
        notes.append(f"{quality['logs_unknown_product']} stokker har produkt som ikke er definert i fila "
                     "(ofte rest/vrak eller manuelt kappet).")
    if forbidden_used:
        notes.append("Stokker kappet i celler merket som forbudt: " +
                     ", ".join(f"{k} ({v})" for k, v in forbidden_used.items()))
    if quality["stems_without_coordinates"] and pts:
        notes.append(f"{quality['stems_without_coordinates']} stammer mangler koordinater.")

    lengths = [l["length_cm"] for l in logs if l["length_cm"]]
    dbhs = [s["dbh_mm"] for s in stems if s["dbh_mm"]]
    overview = {
        "stems": len(stems), "logs": len(logs),
        "m3sub": _r(tot_sub, 3), "m3sob": _r(tot_sob, 3),
        "mean_stem_m3sub": _div(tot_sub, len(stems), 4),
        "mean_dbh_mm": _r(statistics.fmean(dbhs), 0) if dbhs else None,
        "quadratic_mean_dbh_mm": _r(math.sqrt(statistics.fmean(d * d for d in dbhs)), 0) if dbhs else None,
        "logs_per_stem": _div(len(logs), len(stems), 2),
        "mean_log_length_cm": _r(statistics.fmean(lengths), 0) if lengths else None,
        "first": min(times).isoformat(sep=" ") if times else None,
        "last": max(times).isoformat(sep=" ") if times else None,
        "days": len(per_day),
        "productive_hours_est": _r(hours, 1) if hours >= 0.5 else None,
        "m3_per_hour_est": _div(tot_sub, hours) if hours >= 0.5 else None,
        "stems_per_hour_est": _div(len(stems), hours, 1) if hours >= 0.5 else None,
        "value": _r(value_total, 0) if value_logs else None,
        "value_per_m3": _div(value_total, tot_sub, 0) if value_logs else None,
        "value_logs_share": _div(value_logs, len(logs), 3) if value_logs else None,
        "area_hull_ha": _r(area, 2),
        "stems_per_ha": _div(len(stems), area, 0) if area and area > 0.05 else None,
        "m3sub_per_ha": _div(tot_sub, area, 1) if area and area > 0.05 else None,
    }
    return {
        "type": "hpr", "overview": overview, "per_species": per_species, "per_product": product_rows,
        "per_operator": per_operator, "per_day": per_day, "per_sub_object": per_sub_object,
        "dbh_distribution": dbh_dist, "species_order": species_names, "stem_volume_distribution": stem_vol_dist,
        "assortment": assortment,
        "cutting_reasons": [{"reason": k or "Ikke oppgitt", "logs": v}
                            for k, v in Counter(l["cutting_reason"] for l in logs).most_common()],
        "points": points, "quality": quality, "notes": notes,
    }


# =============================================================================
# hqc - kontrollmåling
# =============================================================================

_DIAM_LABELS = {"butt_ob": "Rot på bark", "butt_ub": "Rot under bark", "mid_ob": "Midt på bark",
                "mid_ub": "Midt under bark", "top_ob": "Topp på bark", "top_ub": "Topp under bark"}


def _calibrations(sf: StanfordFile) -> list[dict]:
    out = []
    cv = find(sf.machine_el, "CalibrationValues")
    for c in findall(cv, "LengthCalibration"):
        adj = find(c, "LengthCalibrationAdjustment")
        out.append({"kind": "Lengde", "date": text(c, "CalibrationDate"),
                    "species": text(c, "SpeciesGroupUserID"), "reason": text(c, "LengthCalibrationReason"),
                    "adjustment": num(adj), "position": adj.get("lengthCalibrationPosition") if adj is not None else None,
                    "butt_log": num(c, "LengthCalibrationAdjustmentButtLog")})
    for c in findall(cv, "DiameterCalibration"):
        out.append({"kind": "Diameter", "date": text(c, "CalibrationDate"),
                    "species": text(c, "SpeciesGroupUserID"), "reason": text(c, "DiameterCalibrationReason"),
                    "adjustment": num(c, "DiameterCalibrationAdjustment"), "position": None, "butt_log": None})
    return sorted(out, key=lambda r: r["date"] or "")


def analyze_hqc(sf: StanfordFile, tolerance: dict | None = None) -> dict:
    tol = {**HQC_TOLERANCE, **(tolerance or {})}
    comp = sf.control_comparison()
    lengths = [r.get("length_diff_cm") for r in comp]
    diam_keys = sorted({k[5:-8] for r in comp for k in r if k.startswith("diam_") and k.endswith("_diff_mm")})
    variables = [{"key": "length", "label": "Lengde (cm)", "unit": "cm", "tol": tol["length_cm"],
                  "required_share": tol["length_share"], **_stats(lengths, tol["length_cm"]),
                  "histogram": _hist(lengths, 1)}]
    for k in diam_keys:
        vals = [r.get(f"diam_{k}_diff_mm") for r in comp]
        variables.append({"key": k, "label": _DIAM_LABELS.get(k, k) + " (mm)", "unit": "mm",
                          "tol": tol["diameter_mm"], "required_share": tol["diameter_share"],
                          **_stats(vals, tol["diameter_mm"]), "histogram": _hist(vals, 1)})
    for v in variables:
        if v["n"]:
            v["pass"] = v["within"] >= v["required_share"]
            if v["key"] == "length" and v.get("sd") is not None:
                v["pass"] = v["pass"] and v["sd"] <= tol["length_sd_cm"]

    # Volum per stamme: maskin mot manuelt
    vol = defaultdict(lambda: defaultdict(float))
    stems_seen = defaultdict(set)
    for r in sf.logs():
        vol[r["stem_key"]][r["measured_by"]] += _sub(r)
        stems_seen[r["stem_key"]].add(r["measured_by"])
    vol_diff = [(v["Machine"] - v["Operator"]) / v["Operator"] * 100
                for k, v in vol.items() if v.get("Operator") and {"Machine", "Operator"} <= stems_seen[k]]

    per_product = defaultdict(list)
    for r in comp:
        if r.get("length_diff_cm") is not None:
            per_product[r["product"] or "Ukjent"].append(r["length_diff_cm"])

    advice = []
    lv = variables[0]
    if lv["n"] >= 5 and abs(lv["mean"]) >= 1:
        advice.append(f"Lengde: maskinen måler i snitt {lv['mean']:+.1f} cm mot kontrollmålet. "
                      f"Vurder å justere lengdekalibreringen med {-lv['mean']:+.0f} cm.")
    for v in variables[1:]:
        if v["n"] >= 5 and abs(v["mean"]) >= 2:
            advice.append(f"{v['label'][:-5]}: snittavvik {v['mean']:+.1f} mm. "
                          f"Vurder diameterkalibrering ({-v['mean']:+.0f} mm).")
    for v in variables:
        if v["n"] and not v.get("pass"):
            advice.append(f"{v['label']}: {v['within']:.0%} innenfor ±{v['tol']:g} {v['unit']} "
                          f"(krav {v['required_share']:.0%}).")
    if lv["n"] and lv["n"] < 20:
        advice.append(f"Bare {lv['n']} kontrollstokker - konklusjonen er usikker.")

    stems = {r["stem_key"] for r in comp}
    return {
        "type": "hqc", "tolerance": tol,
        "overview": {"control_stems": len(stems), "control_logs": len(comp),
                     "volume_diff_pct_mean": _r(statistics.fmean(vol_diff), 1) if vol_diff else None,
                     "volume_diff_pct_sd": _r(statistics.stdev(vol_diff), 1) if len(vol_diff) > 1 else None},
        "variables": variables,
        "per_product": [{"product": k, **_stats(v, tol["length_cm"])} for k, v in sorted(per_product.items())],
        "logs": comp, "calibrations": _calibrations(sf), "advice": advice,
    }


# =============================================================================
# mom - driftsoppfølging
# =============================================================================

_DOWN_TYPES = {"Repair": "Reparasjon", "Maintenance": "Service/vedlikehold", "Disturbance": "Forstyrrelse",
               "OtherMachineDownTimeCategory": "Annet stopp"}
RUN_NO = {"Processing": "Hogst/upparbeiding", "Terrain travel": "Kjøring i terreng", "Other work": "Annet arbeid",
          "Loading": "Lessing", "Unloading": "Lossing", "Driving empty": "Kjøring tom",
          "Driving loaded": "Kjøring lastet", "Felling": "Felling"}
RUN_NO_FORWARDER = {"Processing": "Lessing og lossing"}
IDLE_NO = {"Meal break": "Matpause", "Other unutilized time": "Annen ubrukt tid", "Rest": "Hvile",
           "Waiting": "Venting", "Transport": "Flytting"}


def _down_detail(el):
    for tag, label in _DOWN_TYPES.items():
        d = find(el, tag)
        if d is not None:
            code = next(((c.text or "").strip() for c in d
                         if local(c.tag).endswith(("StandardCode", "Reason")) and (c.text or "").strip()), None)
            desc = text(d, "RepairManufacturerCode/CodeDescription") or \
                text(d, "MaintenanceManufacturerCode/CodeDescription") or \
                text(d, "DisturbanceManufacturerCode/CodeDescription")
            detail = (desc or code or "").replace("\\r", "").replace("\\n", "").strip()
            return label, detail or None
    return "Annet stopp", None


def _other_data(el) -> dict:
    o = find(el, "OtherMachineData")
    d = {"engine_s": num(o, "EngineTime") or 0, "distance_m": num(o, "DrivenDistance") or 0,
         "fuel_l": num(o, "FuelConsumption") or 0, "stems": 0, "m3sub": 0.0, "m3sob": 0.0,
         "loads": 0, "forwarded_m3": 0.0, "forwarded_kg": 0.0}
    for h in findall(o, "HarvesterData"):
        d["stems"] += num(h, "NumberOfHarvestedStems") or 0
        for v in findall(h, "TotalVolumeOfHarvestedLogs"):
            cat = (v.get("harvestedLogsVolumeCategory") or "").lower()
            d["m3sob" if "sob" in cat else "m3sub"] += float(v.text or 0)
    for f in findall(o, "ForwarderData"):
        d["loads"] += num(f, "NumberOfLoads") or 0
        d["forwarded_m3"] += num(f, "TotalForwardedVolume") or 0
        d["forwarded_kg"] += num(f, "ForwardedGreenMass") or 0
    return d


def mom_records(sf: StanfordFile) -> list[dict]:
    """Én rad per tidsavsnitt: start, sekunder, klasse (run/down/idle/short), kategori, fører, objekt."""
    m = sf.machine_el
    recs = []

    def base(el, start):
        return {"start": parse_time(start), "operator_key": num(el, "OperatorKey"),
                "object_key": num(el, "ObjectKey"), "sub_object_key": num(el, "SubObjectKey")}

    for el in findall(m, "IndividualMachineWorkTime"):
        r = base(el, text(el, "MonitoringStartTime"))
        r["seconds"] = num(el, "MonitoringTimeLength") or 0
        r.update(_other_data(el))
        if find(el, "IndividualMachineRunTimeCategory") is not None:
            r["class"], r["category"] = "run", text(el, "IndividualMachineRunTimeCategory")
        elif find(el, "IndividualMachineDownTime") is not None:
            r["class"] = "down"
            r["category"], r["detail"] = _down_detail(find(el, "IndividualMachineDownTime"))
        else:
            r["class"], r["category"] = "idle", text(el, "IndividualUnutilizedTimeCategory") or "Stillestående"
        recs.append(r)
    for el in findall(m, "IndividualShortDownTime"):
        r = base(el, text(el, "MonitoringStartTime"))
        r.update({"seconds": num(el, "MonitoringTimeLength") or 0, "class": "short", "category": "Korte avbrudd"})
        recs.append(r)
    for el in findall(m, "CombinedMachineWorkTime"):
        b = base(el, text(el, "StartTime"))
        first = True
        od = _other_data(el)
        for rt in findall(el, "CombinedMachineRunTime"):
            r = {**b, "seconds": num(rt, "TimeLength") or 0, "class": "run",
                 "category": text(rt, "MachineRunTimeCategory")}
            r.update(od if first else {k: 0 for k in od})
            first = False
            recs.append(r)
        for dt in findall(el, "CombinedMachineDownTime"):
            cat, det = _down_detail(dt)
            recs.append({**base(el, text(dt, "StartTime") or text(el, "StartTime")),
                         "seconds": num(dt, "TimeLength") or 0, "class": "down", "category": cat, "detail": det})
        for ut in findall(el, "CombinedUnutilizedTime"):
            recs.append({**b, "seconds": num(ut, "TimeLength") or 0, "class": "idle",
                         "category": text(ut, "UnutilizedTimeCategory") or "Stillestående"})
        if first and any(od.values()):  # data uten driftstid
            recs.append({**b, "seconds": 0, "class": "run", "category": None, **od})
    return recs


def _mom_totals(recs, gap_s):
    t = {"run_h": 0.0, "down_h": 0.0, "idle_h": 0.0, "short_h": 0.0, "g15_h": 0.0,
         "engine_h": 0.0, "fuel_l": 0.0, "distance_km": 0.0, "stems": 0, "m3sub": 0.0, "m3sob": 0.0,
         "loads": 0, "forwarded_m3": 0.0}
    for r in recs:
        h = r["seconds"] / 3600
        t[{"run": "run_h", "down": "down_h", "idle": "idle_h", "short": "short_h"}[r["class"]]] += h
        # Korte avbrudd (IndividualShortDownTime) ligger inne i driftstidsavsnittene
        if r["class"] == "run" or r["class"] in ("down", "idle") and r["seconds"] <= gap_s:
            t["g15_h"] += h
        t["engine_h"] += r.get("engine_s", 0) / 3600
        t["fuel_l"] += r.get("fuel_l", 0)
        t["distance_km"] += r.get("distance_m", 0) / 1000
        for k in ("stems", "m3sub", "m3sob", "loads", "forwarded_m3"):
            t[k] += r.get(k, 0)
    t["work_h"] = t["run_h"] + t["down_h"] + t["idle_h"]
    t["effective_h"] = t["run_h"] - t["short_h"]
    t["technical_utilisation"] = _div(t["run_h"], t["run_h"] + t["down_h"], 3)
    t["m3_per_g15h"] = _div(t["m3sub"] or t["forwarded_m3"], t["g15_h"])
    t["stems_per_g15h"] = _div(t["stems"], t["g15_h"], 1)
    t["fuel_per_engine_h"] = _div(t["fuel_l"], t["engine_h"])
    t["fuel_per_g15h"] = _div(t["fuel_l"], t["g15_h"])
    t["fuel_per_m3"] = _div(t["fuel_l"], t["m3sub"] or t["forwarded_m3"])
    return {k: (_r(v, 2) if isinstance(v, float) else v) for k, v in t.items()}


def analyze_mom(sf: StanfordFile, gap_min: float = GAP_MINUTES) -> dict:
    recs = mom_records(sf)
    gap_s = gap_min * 60
    ops = {o["operator_key"]: o["name"] or o["operator_user_id"] for o in sf.operators()}
    objs = {o["object_key"]: o["name"] or o["object_user_id"] for o in sf.objects()}

    def group(keyfun):
        g = defaultdict(list)
        for r in recs:
            g[keyfun(r)].append(r)
        return [{"key": k, **_mom_totals(v, gap_s)} for k, v in sorted(g.items(), key=lambda kv: str(kv[0]))]

    run_names = {**RUN_NO, **(RUN_NO_FORWARDER if sf.machine.get("category") == "Forwarder" else {})}
    cat = defaultdict(float)
    for r in recs:
        if r["class"] == "short" or not r["seconds"]:
            continue
        label = {"run": "Drift", "down": "Stopp", "idle": "Stillestående"}[r["class"]]
        name = run_names.get(r["category"], r["category"]) if r["class"] == "run" else \
            IDLE_NO.get(r["category"], r["category"])
        cat[(label, name or "Ikke oppgitt")] += r["seconds"]
    cat_total = sum(cat.values())
    downs = Counter()
    for r in recs:
        if r["class"] == "down":
            downs[(r["category"], r.get("detail") or "-")] += r["seconds"] / 3600
    ms = find(sf.machine_el, "MonitoringSettings")
    totals = _mom_totals(recs, gap_s)
    times = [r["start"] for r in recs if r["start"]]
    return {
        "type": "mom",
        "format": "individuell" if findall(sf.machine_el, "IndividualMachineWorkTime") else "kombinert",
        "overview": {**totals, "first": min(times).isoformat(sep=" ") if times else None,
                     "last": max(times).isoformat(sep=" ") if times else None,
                     "fuel_counter_l": num(sf.machine_el, "MachineFuelConsumption"),
                     "records": len(recs)},
        "settings": {"filter_down_s": num(ms, "MonitoringFilterTimeDown"),
                     "filter_run_s": num(ms, "MonitoringFilterTimeRun"),
                     "filter_min_s": num(ms, "MonitoringFilterTimeMinimum")} if ms is not None else {},
        "time_categories": [{"class": k[0], "category": k[1], "hours": _r(v / 3600, 2),
                             "share": _div(v, cat_total, 3)}
                            for k, v in sorted(cat.items(), key=lambda kv: (kv[0][0], -kv[1]))],
        "downtime": [{"type": k[0], "detail": k[1], "hours": _r(v, 2)} for k, v in downs.most_common(25)],
        "per_day": group(lambda r: r["start"].date().isoformat() if r["start"] else "Ukjent"),
        "per_operator": group(lambda r: ops.get(r["operator_key"]) or f"Fører {r['operator_key']}"),
        "per_object": group(lambda r: objs.get(r["object_key"]) or f"Objekt {r['object_key']}"),
    }


# =============================================================================
# fpr - lassbærer
# =============================================================================

def analyze_fpr(sf: StanfordFile) -> dict:
    rows = sf.loads()
    for r in rows:
        r["_m3"] = sum(v for k, v in r.items() if k.startswith("vol_") and isinstance(v, (int, float))
                       and "sob" in k) or sum(v for k, v in r.items() if k.startswith("vol_")
                                               and isinstance(v, (int, float)))
        r["_t"] = parse_time(r["unloading_time"])
    loads = defaultdict(list)
    for r in rows:
        loads[r["load_key"]].append(r)
    load_vol = [sum(p["_m3"] for p in ps) for ps in loads.values()]
    dist = [ps[0]["distance_from_last_unloading_m"] for ps in loads.values()
            if ps[0]["distance_from_last_unloading_m"] is not None]
    per_delivery = defaultdict(lambda: {"loads": set(), "m3": 0.0, "kg": 0.0})
    for r in rows:
        d = per_delivery[r["delivery"] or f"Leveranse {r['delivery_key']}"]
        d["loads"].add(r["load_key"])
        d["m3"] += r["_m3"]
        d["kg"] += r["green_mass_kg"] or 0
    per_day = defaultdict(lambda: {"loads": set(), "m3": 0.0})
    for r in rows:
        if r["_t"]:
            d = per_day[r["_t"].date().isoformat()]
            d["loads"].add(r["load_key"])
            d["m3"] += r["_m3"]
    tot = sum(load_vol)
    times = [r["_t"] for r in rows if r["_t"]]
    return {
        "type": "fpr",
        "overview": {"loads": len(loads), "partial_loads": len(rows), "m3": _r(tot, 2),
                     "mean_load_m3": _div(tot, len(loads)), "max_load_m3": _r(max(load_vol), 2) if load_vol else None,
                     "mean_distance_m": _r(statistics.fmean(dist), 0) if dist else None,
                     "green_mass_t": _r(sum(r["green_mass_kg"] or 0 for r in rows) / 1000, 2),
                     "first": min(times).isoformat(sep=" ") if times else None,
                     "last": max(times).isoformat(sep=" ") if times else None},
        "per_delivery": [{"delivery": k, "loads": len(v["loads"]), "m3": _r(v["m3"], 2),
                          "share": _div(v["m3"], tot, 3), "green_mass_t": _r(v["kg"] / 1000, 2)}
                         for k, v in sorted(per_delivery.items(), key=lambda kv: -kv[1]["m3"])],
        "per_day": [{"key": k, "loads": len(v["loads"]), "m3": _r(v["m3"], 2)} for k, v in sorted(per_day.items())],
        "load_volume_distribution": _hist(load_vol, 2, 0),
    }


# =============================================================================
# Felles
# =============================================================================

ANALYZERS = {"hpr": analyze_hpr, "hqc": analyze_hqc, "mom": analyze_mom, "fpr": analyze_fpr}


def describe(sf: StanfordFile) -> dict:
    mt = sf.message_type
    return {"file": sf.filename, "ext": sf.ext, "type_name": mt.name_no if mt else None,
            "version": sf.version, "machine": sf.machine,
            "objects": [{k: o[k] for k in ("object_user_id", "name", "start_date", "end_date")} for o in sf.objects()],
            "created": sf.header.get("CreationDate")}


def analyze(sf: StanfordFile, **opts) -> dict:
    fn = ANALYZERS.get(sf.ext)
    base = describe(sf)
    if not fn:
        return {**base, "type": sf.ext, "supported": False, "elements": sf.element_counts()}
    import inspect
    params = inspect.signature(fn).parameters
    return {**base, **fn(sf, **{k: v for k, v in opts.items() if k in params and v is not None}), "supported": True}


def _machine_id(a):
    m = a.get("machine") or {}
    return m.get("manufacturer_id") or m.get("key") or m.get("user_id") or "?"


def combine(analyses: list[dict]) -> dict:
    """Samlet bilde over flere filer: objekter, og hpr koblet mot mom for samme maskin."""
    # hpr er akkumulert: nyeste fil per maskin og objekt gjelder
    latest = {}
    for a in analyses:
        if a.get("type") != "hpr":
            continue
        k = (_machine_id(a), tuple(o["object_user_id"] for o in a["objects"]))
        if k not in latest or (a.get("created") or "") >= (latest[k].get("created") or ""):
            latest[k] = a
    objects = []
    for (mid, obj), a in latest.items():
        o = a["overview"]
        objects.append({"machine": mid, "object": ", ".join(filter(None, obj)) or "-",
                        "name": ", ".join(filter(None, (x["name"] for x in a["objects"]))) or "-",
                        "file": a["file"], "stems": o["stems"], "m3sub": o["m3sub"],
                        "mean_stem_m3sub": o["mean_stem_m3sub"], "m3_per_hour_est": o["m3_per_hour_est"],
                        "value_per_m3": o["value_per_m3"], "first": o["first"], "last": o["last"]})
    mom_by_machine = defaultdict(list)
    for a in analyses:
        if a.get("type") == "mom":
            mom_by_machine[_machine_id(a)].append(a)
    links = []
    for mid, moms in mom_by_machine.items():
        hprs = [x for x in objects if x["machine"] == mid]
        if not hprs:
            continue
        g15 = sum(m["overview"]["g15_h"] for m in moms)
        fuel = sum(m["overview"]["fuel_l"] for m in moms)
        m3 = sum(h["m3sub"] or 0 for h in hprs)
        links.append({"machine": mid, "hpr_files": len(hprs), "mom_files": len(moms), "m3sub": _r(m3, 2),
                      "g15_h": _r(g15, 2), "fuel_l": _r(fuel, 1), "m3_per_g15h": _div(m3, g15),
                      "fuel_per_m3": _div(fuel, m3),
                      "note": "Forutsetter at hpr og mom dekker samme periode."})
    return {"objects": sorted(objects, key=lambda r: (r["machine"], r["object"])), "machine_links": links}


def analyze_files(paths, **opts) -> dict:
    analyses, errors = [], []
    for p in paths:
        try:
            analyses.append(analyze(open_file(p), **opts))
        except Exception as e:  # noqa: BLE001 - vis feil per fil, fortsett med resten
            errors.append({"file": Path(p).name, "error": str(e)})
    return {"files": analyses, "combined": combine(analyses), "errors": errors}
