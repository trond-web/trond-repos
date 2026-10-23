"""Lager StanForD 2010-meldinger.

Instruksjoner TIL maskinen:
  build_pin(spec)  - produktinstruksjon (aptering: diameter/lengdeklasser, prismatrise)
  build_spi(spec)  - treslagsinstruksjon
  build_oin(spec)  - objektinstruksjon (hogstobjekt)
  instructions_from_report(hpr) - trekk ut pin/spi fra en hpr (kopier oppsett mellom maskiner)

Rapporter (for test, simulering og integrasjonstesting):
  build_hpr(spec)  - hogstproduksjon

Elementrekkefølgen følger skjemadokumentasjonen (ProductInstruction) og
strukturen i hpr-filer fra John Deere, Komatsu og Ponsse. Valider alltid mot
offisielle XSD-filer fra Skogforsk før en fil sendes til en maskin i drift
(se validate.py).
"""
from __future__ import annotations

import copy
from datetime import datetime, timezone
import xml.etree.ElementTree as ET

from .messages import DEFAULT_VERSION, MESSAGE_TYPES, NS, UNIT_ATTRS, VERSION_DATES, XSI
from .xmlio import find, findall, local, q, text

APP_NAME = "stanford2010-verktoy 1.0"
NORWAY = 578  # ISO 3166-1 numerisk


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def E(parent: ET.Element | None, tag: str, value=None, **attrs) -> ET.Element:
    attrs = {k: _fmt(v) for k, v in attrs.items() if v is not None}
    el = ET.Element(q(tag), attrs) if parent is None else ET.SubElement(parent, q(tag), attrs)
    if value is not None:
        el.text = _fmt(value)
    return el


def _fmt(v) -> str:
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def new_message(ext: str, version: str = DEFAULT_VERSION, country_code: int = NORWAY,
                sender: str = APP_NAME, created: str | None = None) -> ET.Element:
    mt = MESSAGE_TYPES[ext]
    root = E(None, mt.root, **UNIT_ATTRS, version=version, messageType=ext,
             versionDate=VERSION_DATES.get(version))
    root.set(f"{{{XSI}}}schemaLocation", f"{NS} {mt.root}_V{version.replace('.', 'p')}.xsd")
    h = E(root, mt.header)
    ts = created or now_iso()
    E(h, "SenderApplication", sender)
    E(h, "CreationDate", ts)
    E(h, "ModificationDate", ts)
    E(h, "ApplicationVersionCreated", sender)
    E(h, "ApplicationVersionModified", sender)
    E(h, "CountryCode", country_code)
    return root


def _contact(parent, tag, info):
    """info: str (firmanavn) eller dict med BusinessName/BusinessID/..."""
    if not info:
        return None
    if isinstance(info, str):
        info = {"BusinessName": info}
    el = E(parent, tag)
    for k in ("FirstName", "LastName", "Address", "Phone", "Email", "BusinessName", "BusinessID"):
        if k in info and info[k] is not None:
            E(el, k, info[k])
    return el


def _user_id(parent, tag, value):
    return E(parent, tag, value, agency="Other")


# =============================================================================
# Produktinstruksjon (pin)
# =============================================================================

def _price_lookup(prices, diam_classes, len_classes):
    """Returnerer funksjon (d, l) -> pris.

    prices kan være:
      tall                         -> samme pris i alle celler
      {"default": x,
       "by_diameter": {d: x},      -> pris per diameterklasse
       "matrix": [[...], ...]}     -> rad per diameterklasse, kolonne per lengdeklasse
    """
    if isinstance(prices, (int, float)):
        return lambda d, l: prices
    prices = prices or {}
    matrix = prices.get("matrix")
    by_d = {int(k): v for k, v in (prices.get("by_diameter") or {}).items()}
    default = prices.get("default", 0)

    def f(d, l):
        if matrix:
            return matrix[diam_classes.index(d)][len_classes.index(l)]
        if d in by_d:
            return by_d[d]
        return default
    return f


def add_product(root: ET.Element, p: dict) -> ET.Element:
    """Legg til én ProductDefinition i en pin-melding."""
    diam = sorted(p["diameter_classes_mm"])
    lens = sorted(p["length_classes_cm"])
    pd = E(root, "ProductDefinition")
    _user_id(pd, "ProductUserID", p["product_user_id"])
    c = E(pd, "ClassifiedProductDefinition")
    E(c, "ProductName", p.get("name", p["product_user_id"]))
    E(c, "ModificationDate", p.get("modification_date") or now_iso())
    if p.get("info") is not None:
        E(c, "ProductInfo", p["info"], modificationRestricted=p.get("restricted", False))
    if p.get("version") is not None:
        E(c, "ProductVersion", p["version"], modificationRestricted=p.get("restricted", False))
    _contact(c, "ProductBuyer", p.get("buyer"))
    if p.get("logging_organisation"):
        lo = E(c, "LoggingOrganisation")
        _contact(lo, "ContactInformation", p["logging_organisation"])
    for dest in ([p["destination"]] if isinstance(p.get("destination"), (str, dict)) else p.get("destination") or []):
        _contact(c, "ProductDestination", dest)
    if p.get("group"):
        E(c, "ProductGroupName", p["group"])
    if p.get("stem_type_code") is not None:
        E(c, "StemTypeCode", p["stem_type_code"])
    if p.get("presentation_order") is not None:
        E(c, "ProductPresentationOrder", p["presentation_order"])
    if p.get("description"):
        E(c, "ProductDescription", p["description"])

    restricted = p.get("restricted", False)
    # Diameter
    dd = E(c, "DiameterDefinition", modificationRestricted=restricted)
    dc = E(dd, "DiameterClasses", diameterClassCategory=p.get("diameter_class_category", "Top"))
    for d in diam:
        x = E(dc, "DiameterClass")
        E(x, "DiameterClassLowerLimit", d)
        E(x, "DiameterClassName", p.get("diameter_class_names", {}).get(str(d), d))
    E(dc, "DiameterClassMAX", p.get("diameter_max_mm", diam[-1] + 20))
    E(dc, "DiameterClassAdjustment", p.get("diameter_class_adjustment", "DiameterClassAdjustment1"))
    E(dc, "DiameterUnderBark", p.get("diameter_under_bark", True))
    E(dd, "DiameterMINTop", p.get("diameter_min_top_mm", diam[0]))
    if p.get("diameter_max_butt_mm") is not None:
        E(dd, "DiameterMAXButt", p["diameter_max_butt_mm"])
    E(dd, "DiameterTopPosition", p.get("diameter_top_position_cm", 10))

    # Lengde
    ld = E(c, "LengthDefinition", modificationRestricted=restricted)
    E(ld, "LengthClassAdjustment", p.get("length_class_adjustment", "LengthClassAdjustment1"))
    margins = p.get("length_margin_cm", 0)
    for l in lens:
        x = E(ld, "LengthClass")
        E(x, "LengthClassLowerLimit", l)
        E(x, "LengthClassMargin", margins.get(str(l), 0) if isinstance(margins, dict) else margins)
    E(ld, "LengthClassMAX", p.get("length_max_cm", lens[-1] + 9))

    # Volumberegning
    pr = E(c, "PriceDefinition", modificationRestricted=restricted)
    E(pr, "VolumeDiameterAdjustment", p.get("volume_diameter_adjustment", "Measured diameter in mm"))
    E(pr, "VolumeDiameterCategory", p.get("volume_diameter_category", "All diameters (solid volume)"),
      volumeDiameterTopPosition=p.get("diameter_top_position_cm", 10))
    E(pr, "VolumeLengthCategory", p.get("volume_length_category", "Physical length cm"))
    E(pr, "VolumeUnderBark", p.get("volume_under_bark", True))

    E(c, "ManualFreeBuck", p.get("manual_free_buck", True))
    E(c, "TopLogFreeBuck", p.get("top_log_free_buck", True))
    E(c, "ProductCondition", p.get("product_condition", "Buck always"))
    if p.get("cutting_window_cm"):
        cw = E(c, "CuttingWindowDefinition", modificationRestricted=restricted)
        E(cw, "LowerLengthLimit", p["cutting_window_cm"][0])
        E(cw, "UpperLengthLimit", p["cutting_window_cm"][1])
    pg = E(c, "PermittedGradesDefinition", modificationRestricted=restricted)
    for g in p.get("permitted_grades", [1, 2]):
        E(pg, "PermittedGradeNumber", g)
    dist = E(c, "LengthDistributionDefinition", modificationRestricted=restricted)
    E(dist, "DistributionAllowed", p.get("distribution_allowed", False))
    E(dist, "DistributionCategory", p.get("distribution_category", "Number of logs"))
    E(dist, "MAXDeviation", p.get("distribution_max_deviation", 0))
    E(dist, "DistributionWithinProduct", True)
    lim = E(c, "LimitationDefinition", modificationRestricted=restricted)
    E(lim, "LimitationCategory", p.get("limitation_category", "No limitation"))
    E(lim, "LimitationResult", p.get("limitation_result", "No action"))

    # Prismatrise
    price = _price_lookup(p.get("prices", 0), diam, lens)
    forbidden = {(int(d), int(l)) for d, l in p.get("forbidden_cells", [])}
    colors = p.get("color_marking", [False, False, False])
    pm = E(c, "ProductMatrixes", modificationRestrictedPrice=restricted,
           modificationRestrictedDistribution=restricted, modificationRestrictedLimitation=restricted,
           modificationRestrictedBuckingCriteria=restricted, modificationRestrictedLogColorMarking=restricted)
    for d in diam:
        for l in lens:
            it = E(pm, "ProductMatrixItem", diameterClassLowerLimit=d, lengthClassLowerLimit=l)
            E(it, "Price", price(d, l))
            E(it, "Distribution", 0)
            E(it, "Limitation", 0)
            E(it, "BuckingCriteria", "Forbidden to buck the log even manually" if (d, l) in forbidden
              else p.get("bucking_criteria", "No limit"))
            cm = E(it, "LogColorMarking")
            for i, col in enumerate(colors[:3], 1):
                E(cm, f"Color{i}", col)
    E(c, "SpeciesGroupUserID", p["species_group_user_id"], agency="Other")
    return pd


def build_pin(spec: dict) -> ET.Element:
    root = new_message("pin", spec.get("version", DEFAULT_VERSION), spec.get("country_code", NORWAY))
    for p in spec["products"]:
        add_product(root, p)
    return root


# =============================================================================
# Treslagsinstruksjon (spi)
# =============================================================================

def _generic(parent, tag, value):
    """Bygg vilkårlig struktur fra dict/list/skalar (brukes for barkfunksjoner o.l.)."""
    if isinstance(value, dict):
        attrs = {k[1:]: v for k, v in value.items() if k.startswith("@")}
        el = E(parent, tag, **attrs)
        for k, v in value.items():
            if k.startswith("@"):
                continue
            if isinstance(v, list):
                for item in v:
                    _generic(el, k, item)
            else:
                _generic(el, k, v)
        return el
    return E(parent, tag, value)


def add_species_group(root: ET.Element, s: dict) -> ET.Element:
    sg = E(root, "SpeciesGroupDefinition")
    E(sg, "SpeciesGroupModificationDate", s.get("modification_date") or now_iso())
    _user_id(sg, "SpeciesGroupUserID", s["species_group_user_id"])
    E(sg, "SpeciesGroupName", s.get("name", s["species_group_user_id"]))
    if s.get("info") is not None:
        E(sg, "SpeciesGroupInfo", s["info"], modificationRestricted=False)
    if s.get("version") is not None:
        E(sg, "SpeciesGroupVersion", s["version"], modificationRestricted=False)
    for code, name in (s.get("stem_types") or {}).items():
        st = E(sg, "StemTypeDefinition")
        E(st, "StemTypeCode", code)
        E(st, "StemTypeName", name)
    if s.get("presentation_order") is not None:
        E(sg, "SpeciesGroupPresentationOrder", s["presentation_order"])
    E(sg, "DBHHeight", s.get("dbh_height_cm", 130), modificationRestricted=False)
    gr = E(sg, "Grades", modificationRestricted=False)
    grades = s.get("grades") or {"1": "Kv1", "2": "Kv2"}
    E(gr, "StartGrade", s.get("start_grade", min(int(k) for k in grades)))
    for num_, name in grades.items():
        g = E(gr, "Grade")
        E(g, "GradeNumber", num_)
        E(g, "GradeName", name)
    if s.get("bark_function"):
        bf = E(sg, "BarkFunction")
        for k, v in s["bark_function"].items():
            _generic(bf, k, v)
    for k, v in (s.get("extra") or {}).items():
        _generic(sg, k, v)
    return sg


def build_spi(spec: dict) -> ET.Element:
    root = new_message("spi", spec.get("version", DEFAULT_VERSION), spec.get("country_code", NORWAY))
    for s in spec["species_groups"]:
        add_species_group(root, s)
    return root


# =============================================================================
# Objektinstruksjon (oin)
# =============================================================================

def build_oin(spec: dict) -> ET.Element:
    root = new_message("oin", spec.get("version", DEFAULT_VERSION), spec.get("country_code", NORWAY))
    o = spec["object"]
    od = E(root, "ObjectDefinition")
    _user_id(od, "ObjectUserID", o["object_user_id"])
    E(od, "ObjectName", o.get("name", o["object_user_id"]))
    E(od, "ObjectModificationDate", o.get("modification_date") or now_iso())
    if o.get("certification"):
        E(od, "ForestCertification", o["certification"])
    if o.get("logging_form"):
        lf = E(od, "LoggingForm", agency="Other")
        E(lf, "LoggingFormCode", o["logging_form"].get("code"))
        E(lf, "LoggingFormDescription", o["logging_form"].get("description"))
    if o.get("area_ha") is not None:
        E(od, "ObjectArea", o["area_ha"])
    if o.get("logging_organisation"):
        lo = E(od, "LoggingOrganisation")
        _contact(lo, "ContactInformation", o["logging_organisation"])
    _contact(od, "ForestOwner", o.get("forest_owner"))
    if o.get("contract_number"):
        E(od, "ContractNumber", o["contract_number"])
    if o.get("text_to_machine"):
        E(od, "TextToMachine", o["text_to_machine"])
    if o.get("start_date"):
        E(od, "StartDate", o["start_date"])
    for so in o.get("sub_objects", []):
        s = E(od, "SubObject")
        _user_id(s, "SubObjectUserID", so["user_id"])
        E(s, "SubObjectName", so.get("name", so["user_id"]))
        if so.get("real_estate_id"):
            E(s, "RealEstateIDSubObject", so["real_estate_id"], agency="Other")
    for k, v in (o.get("extra") or {}).items():
        _generic(od, k, v)
    return root


# =============================================================================
# Uttrekk av instruksjoner fra en rapport (hpr/hqc)
# =============================================================================

def _strip(el: ET.Element, *tags: str):
    for t in tags:
        for c in el.findall(q(t)):
            el.remove(c)


def _latest(elements, uid_path, date_path):
    """Maskiner kan rapportere flere versjoner av samme definisjon (endret underveis).
    Behold kun nyeste per UserID (sammenligning uten hensyn til store/små bokstaver)."""
    best: dict = {}
    order = []
    for el in elements:
        uid = (text(el, uid_path) or f"_nokey_{id(el)}").lower()
        date = text(el, date_path) or ""
        if uid not in best:
            order.append(uid)
            best[uid] = (date, el)
        elif date >= best[uid][0]:
            best[uid] = (date, el)
    return [best[u][1] for u in order]


def instructions_from_report(report_root: ET.Element, version: str | None = None) -> dict[str, ET.Element]:
    """Lag pin og spi fra definisjonene i en hpr.

    Nyttig for å kopiere aptering/treslagsoppsett fra én maskin til en annen,
    eller for å sjekke hva maskinen faktisk kjørte med. Maskinens nøkler
    (ProductKey, SpeciesGroupKey) fjernes; koblingen gjøres med UserID-er.
    """
    version = version or report_root.get("version") or DEFAULT_VERSION
    machine = find(report_root, "Machine")
    if machine is None:
        raise ValueError("Fant ikke Machine-elementet i rapporten")
    sg_user = {text(sg, "SpeciesGroupKey"): text(sg, "SpeciesGroupUserID")
               for sg in findall(machine, "SpeciesGroupDefinition")}

    spi = new_message("spi", version)
    for sg in _latest(findall(machine, "SpeciesGroupDefinition"), "SpeciesGroupUserID",
                      "SpeciesGroupModificationDate"):
        cp = copy.deepcopy(sg)
        _strip(cp, "SpeciesGroupKey")
        spi.append(cp)

    pin = new_message("pin", version)
    count = 0
    classified = [pd for pd in findall(machine, "ProductDefinition")
                  if find(pd, "ClassifiedProductDefinition") is not None]
    for pd in _latest(classified, "ClassifiedProductDefinition/ProductUserID",
                      "ClassifiedProductDefinition/ModificationDate"):
        body = find(pd, "ClassifiedProductDefinition")
        body = copy.deepcopy(body)
        uid = body.find(q("ProductUserID"))
        sgk = text(body, "SpeciesGroupKey")
        _strip(body, "ProductUserID", "SpeciesGroupKey")
        new_pd = E(pin, "ProductDefinition")
        if uid is None:
            uid = ET.Element(q("ProductUserID"), {"agency": "Other"})
            uid.text = f"{text(body, 'ProductName')}-{text(pd, 'ProductKey')}"
        new_pd.append(uid)
        new_pd.append(body)
        _user_id(body, "SpeciesGroupUserID", sg_user.get(sgk) or sgk)
        count += 1
    result = {"spi": spi}
    if count:
        result["pin"] = pin
    return result


# =============================================================================
# Hogstproduksjon (hpr) - for test/simulering
# =============================================================================

def build_hpr(spec: dict) -> ET.Element:
    """Bygg en hpr fra enkel spesifikasjon (se examples/eksempel_hpr.json)."""
    root = new_message("hpr", spec.get("version", DEFAULT_VERSION), spec.get("country_code", NORWAY),
                       sender=spec.get("sender", APP_NAME))
    m = spec["machine"]
    me = E(root, "Machine", machineCategory=m.get("category", "Harvester"))
    E(me, "MachineKey", m["key"])
    if m.get("user_id"):
        E(me, "MachineUserID", m["user_id"], agency="Other")
    E(me, "MachineApplicationVersion", m.get("application", APP_NAME))
    if m.get("manufacturer"):
        E(me, "MachineBaseManufacturer", m["manufacturer"])
    if m.get("model"):
        E(me, "MachineBaseModel", m["model"])
    if m.get("manufacturer_id"):
        E(me, "BaseMachineManufacturerID", m["manufacturer_id"])
    for op in spec.get("operators", []):
        od = E(me, "OperatorDefinition")
        E(od, "OperatorKey", op["key"])
        E(od, "OperatorUserID", op["user_id"], agency="Other")
        if op.get("name"):
            ci = E(od, "ContactInformation")
            E(ci, "FirstName", op["name"])
    for s in spec["species_groups"]:
        sg = add_species_group(me, s)
        E(sg, "SpeciesGroupKey", s["key"])
    for p in spec["products"]:
        tmp = ET.Element("tmp")
        pd = add_product(tmp, p)
        body = find(pd, "ClassifiedProductDefinition")
        sg_uid = body.find(q("SpeciesGroupUserID"))
        body.remove(sg_uid)
        uid = pd.find(q("ProductUserID"))
        pd.remove(uid)
        body.append(uid)
        sg_key = next(s["key"] for s in spec["species_groups"]
                      if s["species_group_user_id"] == p["species_group_user_id"])
        E(body, "SpeciesGroupKey", sg_key)
        new_pd = E(me, "ProductDefinition")
        E(new_pd, "ProductKey", p["key"])
        new_pd.append(body)
    o = spec["object"]
    od = E(me, "ObjectDefinition")
    _user_id(od, "ObjectUserID", o["object_user_id"])
    E(od, "ObjectName", o.get("name", o["object_user_id"]))
    E(od, "ObjectModificationDate", o.get("modification_date") or now_iso())
    E(od, "ObjectKey", o["key"])
    E(od, "StartDate", o.get("start_date") or now_iso())
    if o.get("end_date"):
        E(od, "EndDate", o["end_date"])

    for st in spec["stems"]:
        se = E(me, "Stem")
        E(se, "StemKey", st["key"])
        E(se, "ObjectKey", o["key"])
        E(se, "SpeciesGroupKey", st["species_group_key"])
        if st.get("operator_key") is not None:
            E(se, "OperatorKey", st["operator_key"])
        E(se, "StemNumber", st["number"])
        if st.get("harvest_date"):
            E(se, "HarvestDate", st["harvest_date"])
        E(se, "ProcessingCategory", "SingleTreeProcessing")
        if st.get("lat") is not None:
            sc = E(se, "StemCoordinates", receiverPosition="Base machine position",
                   coordinateReferenceSystem="WGS84")
            E(sc, "Latitude", st["lat"], latitudeCategory="North")
            E(sc, "Longitude", st["lon"], longitudeCategory="East")
            if st.get("alt") is not None:
                E(sc, "Altitude", st["alt"])
        body = E(se, "SingleTreeProcessedStem")
        E(body, "DBH", st["dbh_mm"])
        for i, lg in enumerate(st["logs"], 1):
            le = E(body, "Log")
            E(le, "LogKey", i)
            E(le, "ProductKey", lg["product_key"])
            for cat in ("m3sob", "m3sub"):
                if lg.get(cat) is not None:
                    E(le, "LogVolume", round(lg[cat], 4), logVolumeCategory=cat, logMeasurementCategory="Machine")
            cc = E(le, "CuttingCategory")
            E(cc, "CuttingReason", lg.get("cutting_reason", "Automatic"))
            lm = E(le, "LogMeasurement", logMeasurementCategory="Machine")
            for cat in ("Butt ob", "Butt ub", "Mid ob", "Mid ub", "Top ob", "Top ub"):
                key = cat.lower().replace(" ", "_")
                if lg.get(key) is not None:
                    E(lm, "LogDiameter", lg[key], logDiameterCategory=cat)
            E(lm, "LogLength", lg["length_cm"])
    return root
