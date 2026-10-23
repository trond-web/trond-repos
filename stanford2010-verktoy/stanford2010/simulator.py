"""Enkel hogstmaskin-simulator.

Tar imot pin (+ valgfri spi), "hogger" tilfeldige trær med en enkel avsmalningsmodell
og grådig verdioptimert aptering, og produserer en hpr. Brukes til å teste hele
kjeden (lage instruksjon -> sende -> motta rapport -> lese) uten en ekte maskin.
Volum- og avsmalningsmodellen er bevisst forenklet og skal ikke brukes til
virkesmåling.
"""
from __future__ import annotations

import math
import random
import uuid
import xml.etree.ElementTree as ET

from .writer import build_hpr
from .xmlio import find, findall, num, text


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
             machine_key: str | None = None) -> ET.Element:
    rnd = random.Random(seed)
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
        stems.append({
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
        "object": {"key": 1, "object_user_id": object_user_id, "name": "Simulert objekt"},
        "stems": stems,
    }
    return build_hpr(spec)
