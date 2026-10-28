"""Enkel hogstmaskin-simulator.

Tar imot pin (+ valgfri spi), "hogger" tilfeldige trær med en enkel avsmalningsmodell
og grådig verdioptimert aptering, og produserer en hpr. Brukes til å teste hele
kjeden (lage instruksjon -> sende -> motta rapport -> lese) uten en ekte maskin.
Volum- og avsmalningsmodellen er bevisst forenklet og skal ikke brukes til
virkesmåling.
"""
from __future__ import annotations

import copy
import math
import random
import uuid
from datetime import datetime, timedelta
import xml.etree.ElementTree as ET

from .messages import NS
from .writer import E, build_hpr, new_message
from .xmlio import find, findall, local, num, q, text

SIM_START = datetime(2025, 9, 1, 7, 0)


def _taper(dbh_mm: float, height_cm: float):
    """Diameter (mm, på bark) i høyde h (cm)."""
    def d(h):
        if h >= height_cm:
            return 0.0
        rel = (height_cm - h) / (height_cm - 130)
        return dbh_mm * (rel ** 0.75) * (1.08 if h < 100 else 1.0)
    return d


def _volume_m3(dfun, start, length, bark_factor=1.0):
    v = 0.0
    for h in range(int(start), int(start + length), 10):
        r = dfun(h + 5) * bark_factor / 2000.0
        v += math.pi * r * r * 0.1
    return v


def _pin_products(pin: ET.Element):
    out = []
    for i, pd in enumerate(findall(pin, "ProductDefinition"), start=1):
        c = find(pd, "ClassifiedProductDefinition")
        prices = {(int(it.get("diameterClassLowerLimit")), int(it.get("lengthClassLowerLimit"))):
                  (num(it, "Price") or 0, text(it, "BuckingCriteria"))
                  for it in findall(c, "ProductMatrixes/ProductMatrixItem")}
        out.append({
            "key": 100 + i,
            "product_user_id": text(pd, "ProductUserID"),
            "name": text(c, "ProductName"),
            "group": text(c, "ProductGroupName"),
            "species_group_user_id": text(c, "SpeciesGroupUserID"),
            "diameter_classes_mm": sorted({d for d, _ in prices}),
            "length_classes_cm": sorted({l for _, l in prices}),
            "diameter_max_mm": num(c, "DiameterDefinition/DiameterClasses/DiameterClassMAX"),
            "length_max_cm": num(c, "LengthDefinition/LengthClassMAX"),
            "diameter_min_top_mm": num(c, "DiameterDefinition/DiameterMINTop"),
            "_prices": prices,
            "prices": {"matrix": None, "default": 0},
        })
    for p in out:
        dl, ll = p["diameter_classes_mm"], p["length_classes_cm"]
        p["prices"] = {"matrix": [[p["_prices"][(d, l)][0] for l in ll] for d in dl]}
    return out


def simulate(pin: ET.Element, n_stems: int = 50, seed: int | None = None,
             object_user_id: str = "SIM-OBJ-1", lat: float = 60.8, lon: float = 11.1,
             machine_key: str | None = None, start: datetime | None = None) -> ET.Element:
    rnd = random.Random(seed)
    t = start or SIM_START
    day_start = t
    products = _pin_products(pin)
    sgs = sorted({p["species_group_user_id"] for p in products})
    species = [{"key": 10 + i, "species_group_user_id": s, "name": s} for i, s in enumerate(sgs)]
    sg_key = {s["species_group_user_id"]: s["key"] for s in species}
    stems = []
    for n in range(1, n_stems + 1):
        sg = rnd.choice(sgs)
        dbh = max(80, rnd.gauss(230, 70))
        height = 600 + dbh * 6.5 + rnd.gauss(0, 150)
        dfun = _taper(dbh, height)
        cands = [p for p in products if p["species_group_user_id"] == sg]
        pos, logs = 30, []  # stubbehøyde 30 cm
        while True:
            best = None
            for p in cands:
                for l in reversed(p["length_classes_cm"]):
                    top_ub = dfun(pos + l) * 0.92
                    if top_ub < (p["diameter_min_top_mm"] or 0):
                        continue
                    dclass = max((d for d in p["diameter_classes_mm"] if d <= top_ub), default=None)
                    if dclass is None or (p["diameter_max_mm"] and top_ub >= p["diameter_max_mm"]):
                        continue
                    price, crit = p["_prices"][(dclass, l)]
                    if crit and "Forbidden" in crit or (crit or "").startswith("Only logs bucked manually"):
                        continue
                    vol = _volume_m3(dfun, pos, l, 0.92)
                    value = price * vol
                    if best is None or value > best[0]:
                        best = (value, p, l, vol)
            if not best or best[0] <= 0:
                break
            _, p, l, vol = best
            logs.append({
                "product_key": p["key"], "length_cm": l,
                "butt_ob": round(dfun(pos)), "mid_ob": round(dfun(pos + l / 2)),
                "top_ob": round(dfun(pos + l)), "top_ub": round(dfun(pos + l) * 0.92),
                "m3sob": vol / 0.92 ** 2, "m3sub": vol,
            })
            pos += l + 1  # 1 cm sagsnitt
        # Tid: 40-120 s per stamme, av og til pause eller stopp, arbeidsdag 07-16
        t += timedelta(seconds=max(25, rnd.gauss(70, 25)))
        if rnd.random() < 0.02:
            t += timedelta(minutes=rnd.uniform(20, 50))
        if t - day_start > timedelta(hours=9):
            day_start = datetime.combine(t.date() + timedelta(days=1), SIM_START.time())
            t = day_start
        stems.append({
            "harvest_date": t.isoformat(timespec="seconds"),
            "key": n * 100, "number": n, "species_group_key": sg_key[sg], "operator_key": 1,
            "dbh_mm": round(dbh), "lat": round(lat + rnd.uniform(-0.002, 0.002), 7),
            "lon": round(lon + rnd.uniform(-0.004, 0.004), 7), "alt": 300, "logs": logs,
        })
    spec = {
        "version": pin.get("version"),
        "sender": "Simulator (stanford2010-verktoy)",
        "machine": {"key": machine_key or uuid.uuid4().hex, "manufacturer": "Simulator",
                    "model": "SIM-1", "manufacturer_id": machine_key or "SIM0001", "category": "Harvester"},
        "operators": [{"key": 1, "user_id": "SIM-OP-1", "name": "Simulert fører"}],
        "species_groups": species,
        "products": products,
        "object": {"key": 1, "object_user_id": object_user_id, "name": "Simulert objekt",
                   "start_date": (start or SIM_START).isoformat(timespec="seconds")},
        "stems": stems,
    }
    return build_hpr(spec)


# =============================================================================
# Driftsoppfølging (mom) og kontrollmåling (hqc) ut fra en simulert hpr
# =============================================================================

def _copy_machine_head(src_machine: ET.Element, dst_root: ET.Element) -> ET.Element:
    me = E(dst_root, "Machine", machineCategory=src_machine.get("machineCategory", "Harvester"))
    for c in src_machine:
        if local(c.tag) in ("MachineKey", "MachineUserID", "MachineApplicationVersion", "MachineBaseManufacturer",
                            "MachineBaseModel", "BaseMachineManufacturerID", "OperatorDefinition",
                            "SpeciesGroupDefinition", "ObjectDefinition"):
            me.append(copy.deepcopy(c))
    return me


def simulate_mom(hpr: ET.Element, seed: int | None = None, gap_min: float = 15) -> ET.Element:
    """Individuell driftsoppfølging som passer med stammene i en (simulert) hpr.

    Sammenhengende hogst blir driftstid (upparbeiding + litt terrengkjøring), opphold
    over gap_min minutter blir pause, forstyrrelse eller service.
    """
    from .reader import StanfordFile
    from .analysis import parse_time
    rnd = random.Random(seed)
    sf = StanfordFile(hpr)
    stems = sorted((s for s in sf.stems() if s["harvest_date"]), key=lambda s: s["harvest_date"])
    vol = {}
    for l in sf.logs():
        vol[l["stem_key"]] = vol.get(l["stem_key"], 0) + (l.get("vol_m3sub") or 0)
    root = new_message("mom", hpr.get("version") or "3.6", sender="Simulator (stanford2010-verktoy)")
    me = _copy_machine_head(sf.machine_el, root)
    ms = E(me, "MonitoringSettings")
    E(ms, "MonitoringSettingsKey", 1)
    E(ms, "MonitoringFilterTimeDown", int(gap_min * 60))
    E(ms, "MonitoringFilterTimeRun", 120)
    E(ms, "MonitoringFilterTimeMinimum", 15)
    obj_key = num(find(sf.machine_el, "ObjectDefinition"), "ObjectKey") or 1

    def record(start, seconds, kind, category, stems_=(), fuel_rate=0.0):
        el = E(me, "IndividualMachineWorkTime")
        E(el, "OperatorKey", stems_[0]["operator_key"] if stems_ else 1)
        E(el, "ObjectKey", obj_key)
        E(el, "MonitoringStartTime", start.isoformat(timespec="seconds"))
        E(el, "MonitoringTimeLength", int(seconds))
        E(el, "MonitoringSettingsKey", 1)
        if kind == "run":
            E(el, "IndividualMachineRunTimeCategory", category)
            od = E(el, "OtherMachineData")
            E(od, "EngineTime", int(seconds))
            E(od, "DrivenDistance", int(seconds / 60 * (25 if category == "Terrain travel" else 2)))
            E(od, "FuelConsumption", round(seconds / 3600 * fuel_rate, 1))
            by_sp = {}
            for s in stems_:
                b = by_sp.setdefault(s["species_group_key"], [0, 0.0])
                b[0] += 1
                b[1] += vol.get(s["stem_key"], 0)
            for sp, (n, v) in by_sp.items():
                hd = E(od, "HarvesterData")
                E(hd, "ProcessingCategory", "SingleTreeProcessing")
                E(hd, "SpeciesGroupKey", sp)
                E(hd, "NumberOfHarvestedStems", n)
                E(hd, "TotalVolumeOfHarvestedLogs", round(v, 4), harvestedLogsVolumeCategory="m3sub")
        elif kind == "down":
            dt = E(el, "IndividualMachineDownTime")
            tag, code_tag = category
            d = E(dt, tag)
            E(d, code_tag[0], code_tag[1])
        else:
            E(el, "IndividualUnutilizedTimeCategory", category)

    seg = []
    for s in stems + [None]:
        t = parse_time(s["harvest_date"]) if s else None
        if seg and (t is None or (t - parse_time(seg[-1]["harvest_date"])).total_seconds() > gap_min * 60):
            a = parse_time(seg[0]["harvest_date"]) - timedelta(seconds=60)
            b = parse_time(seg[-1]["harvest_date"])
            secs = max(60, (b - a).total_seconds())
            record(a, secs * 0.9, "run", "Processing", seg, rnd.uniform(11, 15))
            record(a + timedelta(seconds=secs * 0.9), secs * 0.1, "run", "Terrain travel", (), 9)
            if t is not None and t.date() == b.date():
                gap = (t - b).total_seconds() - 60
                r = rnd.random()
                if r < 0.5:
                    record(b, gap, "idle", "Meal break")
                elif r < 0.8:
                    record(b, gap, "down", ("Disturbance", ("DisturbanceStandardCode", "Planning/follow up")))
                else:
                    record(b, gap, "down", ("Maintenance", ("MaintenanceStandardCode", "Saw maintenance")))
            seg = []
        if s:
            seg.append(s)
    return root


def simulate_hqc(hpr: ET.Element, every: int = 15, seed: int | None = None,
                 length_bias_cm: float = 0.5, length_sd_cm: float = 1.5,
                 diameter_bias_mm: float = -1.0, diameter_sd_mm: float = 3.0) -> ET.Element:
    """Kontrollmåling: hver n-te stamme får et manuelt mål (LogMeasurement Operator)."""
    rnd = random.Random(seed)
    root = new_message("hqc", hpr.get("version") or "3.6", sender="Simulator (stanford2010-verktoy)")
    src = find(hpr, "Machine")
    me = _copy_machine_head(src, root)
    cv = E(me, "ControlValues")
    for pd in findall(src, "ProductDefinition"):
        cv.append(copy.deepcopy(pd))
    for i, st in enumerate(findall(src, "Stem")):
        if i % every:
            continue
        st = copy.deepcopy(st)
        for lg in st.iter(q("Log")):
            m = find(lg, "LogMeasurement")
            if m is None:
                continue
            op = copy.deepcopy(m)
            op.set("logMeasurementCategory", "Operator")
            for d in findall(op, "LogDiameter"):
                if d.get("logDiameterCategory", "").endswith("ub"):
                    op.remove(d)
                else:
                    d.text = str(round(float(d.text) - rnd.gauss(diameter_bias_mm, diameter_sd_mm)))
            ln = find(op, "LogLength")
            ln.text = str(round(float(ln.text) - rnd.gauss(length_bias_cm, length_sd_cm)))
            lg.insert(list(lg).index(m) + 1, op)
        cv.append(st)
    return root
