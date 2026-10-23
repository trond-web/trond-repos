"""Leser StanForD 2010-meldinger og gjør dem om til enkle tabeller (lister av dict).

Bruk:
    from stanford2010 import open_file
    f = open_file("objekt.hpr")
    f.machine, f.stems(), f.logs(), f.summary()
"""
from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from pathlib import Path
import xml.etree.ElementTree as ET

from .messages import MESSAGE_TYPES
from .xmlio import (find, findall, local, q, message_ext, num, parse_bytes, parse_file,
                    text, to_dict)

STEM_BODIES = ("SingleTreeProcessedStem", "MultiTreeProcessedStem",
               "SingleTreeFelledStem", "MultiTreeFelledStem")


def _slug(s: str) -> str:
    s = s.replace("m3 (price)", "m3price")
    return re.sub(r"[^0-9a-zA-Z]+", "_", s).strip("_").lower()


class StanfordFile:
    def __init__(self, root: ET.Element, filename: str | None = None):
        self.root = root
        self.filename = filename
        self.ext = message_ext(root, filename)
        self.version = root.get("version")
        self.machine_el = find(root, "Machine")

    # ---------- metadata ----------
    @property
    def message_type(self):
        return MESSAGE_TYPES.get(self.ext) if self.ext else None

    @property
    def header(self) -> dict:
        h = self.root[0] if len(self.root) and local(self.root[0].tag).endswith("Header") else None
        return {local(c.tag): (c.text or "").strip() for c in h} if h is not None else {}

    @property
    def machine(self) -> dict:
        m = self.machine_el
        if m is None:
            return {}
        return {
            "category": m.get("machineCategory"),
            "key": text(m, "MachineKey"),
            "user_id": text(m, "MachineUserID"),
            "manufacturer": text(m, "MachineBaseManufacturer"),
            "model": text(m, "MachineBaseModel"),
            "manufacturer_id": text(m, "BaseMachineManufacturerID"),
            "application": text(m, "MachineApplicationVersion"),
            "head": " ".join(filter(None, [text(m, "MachineHeadManufacturer"), text(m, "MachineHeadModel")])) or None,
            "contractor": text(m, "LoggingContractor/BusinessName"),
        }

    @property
    def _scope(self):
        return self.machine_el if self.machine_el is not None else self.root

    def to_dict(self) -> dict:
        return {"_type": self.ext, **to_dict(self.root)}

    # ---------- definisjoner ----------
    def species_groups(self) -> list[dict]:
        out = []
        for sg in findall(self._scope, "SpeciesGroupDefinition"):
            out.append({
                "species_group_key": num(sg, "SpeciesGroupKey"),
                "species_group_user_id": text(sg, "SpeciesGroupUserID"),
                "name": text(sg, "SpeciesGroupName"),
                "dbh_height_cm": num(sg, "DBHHeight"),
            })
        return out

    def products(self) -> list[dict]:
        out = []
        for p in findall(self._scope, "ProductDefinition"):
            body = find(p, "ClassifiedProductDefinition")
            classified = body is not None
            if body is None:
                body = find(p, "UnclassifiedProductDefinition")
            out.append({
                "product_key": num(p, "ProductKey"),
                "product_user_id": text(body, "ProductUserID") or text(p, "ProductUserID"),
                "name": text(body, "ProductName"),
                "group": text(body, "ProductGroupName"),
                "species_group_key": num(body, "SpeciesGroupKey"),
                "classified": classified,
            })
        return out

    def objects(self) -> list[dict]:
        out = []
        for o in findall(self._scope, "ObjectDefinition"):
            out.append({
                "object_key": num(o, "ObjectKey"),
                "object_user_id": text(o, "ObjectUserID"),
                "name": text(o, "ObjectName"),
                "start_date": text(o, "StartDate"),
                "end_date": text(o, "EndDate"),
                "area_ha": num(o, "ObjectArea"),
                "logging_organisation": text(o, "LoggingOrganisation/ContactInformation/BusinessName"),
                "sub_objects": [
                    {"sub_object_key": num(s, "SubObjectKey"), "user_id": text(s, "SubObjectUserID"),
                     "name": text(s, "SubObjectName")} for s in findall(o, "SubObject")
                ],
            })
        return out

    def operators(self) -> list[dict]:
        return [{"operator_key": num(o, "OperatorKey"), "operator_user_id": text(o, "OperatorUserID"),
                 "name": " ".join(filter(None, [text(o, "ContactInformation/FirstName"),
                                                text(o, "ContactInformation/LastName")])) or
                 text(o, "ContactInformation/BusinessName")}
                for o in findall(self.machine_el, "OperatorDefinition")]

    # ---------- stammer og stokker (hpr/hqc) ----------
    def _lookup(self):
        sp = {s["species_group_key"]: s["name"] for s in self.species_groups()}
        pr = {p["product_key"]: p for p in self.products()}
        return sp, pr

    def _stem_elements(self):
        """Stammer ligger under Machine (hpr) eller Machine/ControlValues (hqc)."""
        if self.machine_el is None:
            return []
        return list(self.machine_el.iter(q("Stem")))

    @staticmethod
    def _stem_body(stem):
        for b in STEM_BODIES:
            el = find(stem, b)
            if el is not None:
                return b, el
        return None, None

    def stems(self) -> list[dict]:
        sp, _ = self._lookup()
        rows = []
        for st in self._stem_elements():
            kind, body = self._stem_body(st)
            coords = find(st, "StemCoordinates")
            row = {
                "stem_key": num(st, "StemKey"),
                "stem_number": num(st, "StemNumber"),
                "object_key": num(st, "ObjectKey"),
                "sub_object_key": num(st, "SubObjectKey"),
                "species_group_key": num(st, "SpeciesGroupKey"),
                "species": sp.get(num(st, "SpeciesGroupKey")),
                "operator_key": num(st, "OperatorKey"),
                "harvest_date": text(st, "HarvestDate"),
                "processing": text(st, "ProcessingCategory") or kind,
                "latitude": num(coords, "Latitude"),
                "longitude": num(coords, "Longitude"),
                "altitude": num(coords, "Altitude"),
                "dbh_mm": num(body, "DBH"),
                "ref_diameter_mm": num(body, "ReferenceDiameter"),
                "n_logs": len(findall(body, "Log")),
            }
            vols = defaultdict(float)
            for lg in findall(body, "Log"):
                for v in findall(lg, "LogVolume"):
                    if v.get("logMeasurementCategory", "Machine") == "Machine":
                        vols[_slug(v.get("logVolumeCategory", "m3"))] += float(v.text or 0)
            for v in findall(body, "StemVolume"):
                vols["stem_" + _slug(v.get("stemVolumeCategory", "m3"))] += float(v.text or 0)
            row.update({f"vol_{k}": round(x, 4) for k, x in vols.items()})
            rows.append(row)
        return rows

    def logs(self) -> list[dict]:
        sp, pr = self._lookup()
        rows = []
        for st in self._stem_elements():
            _, body = self._stem_body(st)
            if body is None:
                continue
            pos = 0
            for lg in findall(body, "Log"):
                machine_len = None
                pkey = num(lg, "ProductKey")
                prod = pr.get(pkey, {})
                for meas in findall(lg, "LogMeasurement") or [None]:
                    mcat = meas.get("logMeasurementCategory", "Machine") if meas is not None else "Machine"
                    length = num(meas, "LogLength")
                    row = {
                        "stem_key": num(st, "StemKey"),
                        "stem_number": num(st, "StemNumber"),
                        "log_key": num(lg, "LogKey"),
                        "measured_by": mcat,
                        "species": sp.get(num(st, "SpeciesGroupKey")),
                        "product_key": pkey,
                        "product": prod.get("name"),
                        "product_group": prod.get("group"),
                        "start_pos_cm": pos,
                        "length_cm": length,
                        "cutting_reason": text(lg, "CuttingCategory/CuttingReason"),
                    }
                    seen = set()
                    for d in findall(meas, "LogDiameter"):
                        k = "diam_" + _slug(d.get("logDiameterCategory", "")) + "_mm"
                        if k in seen and d.get("diameterMeasurementCategory") != "Average":
                            continue
                        seen.add(k)
                        row[k] = num(d)
                    for v in findall(lg, "LogVolume"):
                        if v.get("logMeasurementCategory", "Machine") == mcat:
                            row["vol_" + _slug(v.get("logVolumeCategory", "m3"))] = float(v.text or 0)
                    rows.append(row)
                    if mcat == "Machine":
                        machine_len = length
                pos += machine_len or 0
        return rows

    def summary(self) -> list[dict]:
        """Sum volum og antall per treslag og produkt (maskinmålt)."""
        agg = defaultdict(lambda: {"logs": 0, "m3sub": 0.0, "m3sob": 0.0})
        for r in self.logs():
            if r["measured_by"] != "Machine":
                continue
            k = (r["species"], r["product"])
            a = agg[k]
            a["logs"] += 1
            a["m3sub"] += r.get("vol_m3sub", r.get("vol_m3subestimated", 0.0)) or 0.0
            a["m3sob"] += r.get("vol_m3sob", r.get("vol_m3sobestimated", 0.0)) or 0.0
        return [{"species": k[0], "product": k[1], "logs": v["logs"],
                 "m3sub": round(v["m3sub"], 3), "m3sob": round(v["m3sob"], 3)}
                for k, v in sorted(agg.items(), key=lambda kv: (str(kv[0][0]), str(kv[0][1])))]

    def control_comparison(self) -> list[dict]:
        """hqc: maskinmål mot manuelle kontrollmål per stokk."""
        by = defaultdict(dict)
        for r in self.logs():
            by[(r["stem_key"], r["log_key"])][r["measured_by"]] = r
        out = []
        for (sk, lk), d in by.items():
            m, o = d.get("Machine"), d.get("Operator")
            if not (m and o):
                continue
            row = {"stem_key": sk, "log_key": lk, "product": m["product"],
                   "length_machine_cm": m["length_cm"], "length_operator_cm": o["length_cm"]}
            if m["length_cm"] is not None and o["length_cm"] is not None:
                row["length_diff_cm"] = m["length_cm"] - o["length_cm"]
            for k in m:
                if k.startswith("diam_") and k in o and m[k] is not None and o[k] is not None:
                    row[k.replace("_mm", "_diff_mm")] = m[k] - o[k]
            out.append(row)
        return out

    # ---------- lassbærer (fpr) ----------
    def loads(self) -> list[dict]:
        deliveries = {num(d, "DeliveryKey"): text(d, "DeliveryName")
                      for d in findall(self.machine_el, "DeliveryDefinition")}
        rows = []
        for ld in findall(self.machine_el, "Load"):
            for pl in findall(ld, "PartialLoad") or [None]:
                row = {
                    "load_key": num(ld, "LoadKey"), "load_number": num(ld, "LoadNumber"),
                    "operator_key": num(ld, "OperatorKey"), "unloading_time": text(ld, "UnloadingTime"),
                    "distance_from_last_unloading_m": num(ld, "DistanceFromLastUnloading"),
                    "delivery_key": num(pl, "DeliveryKey"), "delivery": deliveries.get(num(pl, "DeliveryKey")),
                    "location_key": num(pl, "LocationKey"), "green_mass_kg": num(pl, "LoadGreenMass"),
                }
                for v in findall(pl, "LoadVolume"):
                    row["vol_" + _slug(v.get("loadVolumeCategory", "m3"))] = num(v)
                rows.append(row)
        return rows

    # ---------- generisk ----------
    def table(self, element: str) -> list[dict]:
        """Flat tabell av alle forekomster av et element (f.eks. for mom-filer)."""
        rows = []
        for el in self.root.iter():
            if local(el.tag) != element:
                continue
            row = {f"@{k}": v for k, v in el.attrib.items()}
            for c in el.iter():
                if c is el or len(c):
                    continue
                row[local(c.tag) if not c.attrib else local(c.tag) + "|" +
                    "|".join(c.attrib.values())] = (c.text or "").strip()
            rows.append(row)
        return rows

    def element_counts(self) -> dict[str, int]:
        cnt = defaultdict(int)
        for el in self.machine_el if self.machine_el is not None else []:
            cnt[local(el.tag)] += 1
        return dict(cnt)


def open_file(path: str | Path) -> StanfordFile:
    path = Path(path)
    return StanfordFile(parse_file(path), path.name)


def open_bytes(data: bytes, filename: str | None = None) -> StanfordFile:
    return StanfordFile(parse_bytes(data), filename)


def write_csv(rows: list[dict], path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    cols: list[str] = []
    for r in rows:
        for k in r:
            if k not in cols and not isinstance(r[k], (list, dict)):
                cols.append(k)
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols, extrasaction="ignore", delimiter=";")
        w.writeheader()
        w.writerows(rows)
    return path


def write_json(obj, path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
    return path
