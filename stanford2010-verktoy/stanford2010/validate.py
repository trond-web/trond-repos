"""Validering av StanForD 2010-meldinger.

To nivåer:
1. Regelsjekk (innebygd, ingen avhengigheter) - utvalgte regler fra
   "StanForD2010 – rules" (Skogforsk), f.eks. R2.3, R3.7, R3.15/16 og
   kontroll av at stammenumre er sammenhengende.
2. XSD-validering (valgfritt) - krever `lxml` og de offisielle skjemaene fra
   https://www.skogforsk.se/english/projects/stanford/stanford-2010/
   pakket ut i en mappe. Skjemafil finnes automatisk ut fra rot og versjon,
   f.eks. HarvestedProduction_V3p6.xsd.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import xml.etree.ElementTree as ET

from .messages import MESSAGE_TYPES, NS, UNIT_ATTRS, VERSION_DATES
from .xmlio import find, findall, local, num, text, to_bytes


@dataclass
class Report:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors

    def err(self, m):
        self.errors.append(m)

    def warn(self, m):
        self.warnings.append(m)

    def __str__(self):
        lines = [f"FEIL: {e}" for e in self.errors] + [f"ADVARSEL: {w}" for w in self.warnings]
        return "\n".join(lines) or "OK - ingen funn"


def validate(root: ET.Element, xsd_dir: str | Path | None = None) -> Report:
    r = Report()
    tag = root.tag
    if not tag.startswith("{" + NS + "}"):
        r.err(f"Rot-elementet mangler navnerom {NS}")
    ext = root.get("messageType")
    mt = MESSAGE_TYPES.get(ext or "")
    if not mt:
        r.err(f"Ukjent eller manglende messageType: {ext!r}")
    elif mt.root != local(tag):
        r.err(f"messageType={ext} passer ikke med rot-element {local(tag)} (forventet {mt.root})")
    for k, v in UNIT_ATTRS.items():
        if root.get(k) != v:
            r.err(f"Attributt {k} skal være '{v}', er {root.get(k)!r}")
    ver = root.get("version")
    if ver not in VERSION_DATES:
        r.warn(f"Ukjent versjon {ver!r}")
    if mt:
        h = find(root, mt.header)
        if h is None:
            r.err(f"Mangler {mt.header}")
        else:
            for req in ("CreationDate", "ModificationDate", "CountryCode"):
                if find(h, req) is None:
                    r.err(f"{mt.header} mangler {req}")

    if ext in ("hpr", "hqc"):
        _check_production(root, r, strict_refs=(ext == "hpr"))
    elif ext == "pin":
        _check_pin(root, r)
    elif ext == "spi":
        _check_spi(root, r)

    if xsd_dir:
        _check_xsd(root, Path(xsd_dir), r)
    return r


def _check_production(root, r: Report, strict_refs: bool = True):
    ref = r.err if strict_refs else r.warn  # R3.7 gjelder hpr; hqc mangler ofte definisjoner
    m = find(root, "Machine")
    if m is None:
        r.err("Mangler Machine")
        return
    if not text(m, "MachineKey"):
        r.err("Machine mangler MachineKey (må være unik per maskin)")
    products = {num(p, "ProductKey") for p in findall(m, "ProductDefinition")}
    species = {num(s, "SpeciesGroupKey") for s in findall(m, "SpeciesGroupDefinition")}
    objects = {num(o, "ObjectKey") for o in findall(m, "ObjectDefinition")}
    stem_keys = set()
    numbers: dict = {}
    for st in m.iter("{%s}Stem" % NS):
        sk = num(st, "StemKey")
        if sk in stem_keys:
            r.err(f"StemKey {sk} er ikke unik")
        stem_keys.add(sk)
        sp = num(st, "SpeciesGroupKey")
        if sp not in species:
            ref(f"Stamme {sk}: SpeciesGroupKey {sp} er ikke definert")
        ok = num(st, "ObjectKey")
        if objects and ok not in objects:
            r.err(f"Stamme {sk}: ObjectKey {ok} er ikke definert")
        numbers.setdefault(ok, []).append(num(st, "StemNumber"))
        for lg in st.iter("{%s}Log" % NS):
            pk = num(lg, "ProductKey")
            if pk not in products:
                ref(f"Stamme {sk}: ProductKey {pk} brukt men ikke definert (regel R3.7)")
            for lm in findall(lg, "LogMeasurement"):
                ln = num(lm, "LogLength")
                if ln is None or ln <= 0:
                    r.err(f"Stamme {sk}: ugyldig LogLength {ln}")
            for v in findall(lg, "LogVolume"):
                try:
                    if float(v.text) < 0:
                        r.err(f"Stamme {sk}: negativt volum")
                except (TypeError, ValueError):
                    r.err(f"Stamme {sk}: ugyldig LogVolume {v.text!r}")
        c = find(st, "StemCoordinates")
        if c is not None:
            lat, lon = num(c, "Latitude"), num(c, "Longitude")
            if lat is not None and not (-90 <= lat <= 90) or lon is not None and not (-180 <= lon <= 180):
                r.err(f"Stamme {sk}: koordinater utenfor gyldig område")
    for ok, nums in numbers.items():
        nums = sorted(n for n in nums if n is not None)
        if nums:
            missing = sorted(set(range(nums[0], nums[-1] + 1)) - set(nums))
            if missing:
                more = "…" if len(missing) > 10 else ""
                r.warn(f"Objekt {ok}: mangler stammenummer {missing[:10]}{more} "
                       "(delrapport eller tapt data)")


def _check_pin(root, r: Report):
    seen = set()
    for pd in findall(root, "ProductDefinition"):
        uid = text(pd, "ProductUserID")
        if not uid:
            r.err("ProductDefinition mangler ProductUserID")
            continue
        if uid.lower() in seen:
            r.err(f"ProductUserID '{uid}' er duplisert (store/små bokstaver telles likt, regel R2.3)")
        seen.add(uid.lower())
        c = find(pd, "ClassifiedProductDefinition")
        if c is None:
            r.err(f"{uid}: mangler ClassifiedProductDefinition")
            continue
        if not text(c, "SpeciesGroupUserID"):
            r.err(f"{uid}: mangler SpeciesGroupUserID")
        diam = [num(x) for x in findall(c, "DiameterDefinition/DiameterClasses/DiameterClass/DiameterClassLowerLimit")]
        dmax = num(c, "DiameterDefinition/DiameterClasses/DiameterClassMAX")
        lens = [num(x) for x in findall(c, "LengthDefinition/LengthClass/LengthClassLowerLimit")]
        lmax = num(c, "LengthDefinition/LengthClassMAX")
        if not diam or not lens:
            r.err(f"{uid}: mangler diameter- eller lengdeklasser")
            continue
        if diam != sorted(set(diam)):
            r.err(f"{uid}: diameterklasser må være stigende og unike")
        if lens != sorted(set(lens)):
            r.err(f"{uid}: lengdeklasser må være stigende og unike")
        if dmax is not None and dmax <= diam[-1]:
            r.err(f"{uid}: DiameterClassMAX ({dmax}) må være større enn største klasse ({diam[-1]})")
        if lmax is not None and lmax <= lens[-1]:
            r.err(f"{uid}: LengthClassMAX ({lmax}) må være større enn største klasse ({lens[-1]})")
        lo, up = num(c, "CuttingWindowDefinition/LowerLengthLimit"), num(c, "CuttingWindowDefinition/UpperLengthLimit")
        if lo is not None and up is not None and lo > up:
            r.err(f"{uid}: kappvindu nedre grense ({lo}) over øvre ({up}) (regel R3.16)")
        cells = {(int(i.get("diameterClassLowerLimit")), int(i.get("lengthClassLowerLimit")))
                 for i in findall(c, "ProductMatrixes/ProductMatrixItem")}
        expected = {(d, l) for d in diam for l in lens}
        if cells != expected:
            r.err(f"{uid}: prismatrisen dekker ikke alle klassekombinasjoner "
                  f"(mangler {len(expected - cells)}, ukjente {len(cells - expected)})")
        prices = [num(i, "Price") for i in findall(c, "ProductMatrixes/ProductMatrixItem")]
        if prices and all((p or 0) == 0 for p in prices):
            r.warn(f"{uid}: alle priser er 0 - maskinen vil ikke kunne optimere aptering")


def _check_spi(root, r: Report):
    seen = set()
    for sg in findall(root, "SpeciesGroupDefinition"):
        uid = text(sg, "SpeciesGroupUserID")
        if not uid:
            r.err("SpeciesGroupDefinition mangler SpeciesGroupUserID")
            continue
        if uid.lower() in seen:
            r.err(f"SpeciesGroupUserID '{uid}' er duplisert")
        seen.add(uid.lower())
        if find(sg, "BarkFunction") is None:
            r.warn(f"{uid}: ingen BarkFunction - maskinen bruker sin egen standard")


def _check_xsd(root, xsd_dir: Path, r: Report):
    try:
        from lxml import etree
    except ImportError:
        r.warn("XSD-validering hoppet over: installer 'lxml' (pip install lxml)")
        return
    mt = MESSAGE_TYPES.get(root.get("messageType") or "")
    ver = (root.get("version") or "").replace(".", "p")
    if not mt:
        return
    candidates = list(xsd_dir.rglob(f"{mt.root}_V{ver}.xsd")) or list(xsd_dir.rglob(f"{mt.root}*.xsd"))
    if not candidates:
        r.warn(f"Fant ikke {mt.root}_V{ver}.xsd i {xsd_dir}")
        return
    schema = etree.XMLSchema(etree.parse(str(candidates[0])))
    doc = etree.fromstring(to_bytes(root, pretty=False))
    if not schema.validate(doc):
        for e in list(schema.error_log)[:50]:
            r.err(f"XSD linje {e.line}: {e.message}")
