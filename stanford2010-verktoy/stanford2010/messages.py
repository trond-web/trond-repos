"""Register over StanForD 2010-meldingstyper.

Kilde: Skogforsk, "Introduction to StanForD 2010" og skjemadokumentasjonen.
Retning: "til" = instruksjon som sendes TIL maskinen, "fra" = rapport FRA maskinen.
"""
from __future__ import annotations

from dataclasses import dataclass

NS = "urn:skogforsk:stanford2010"
XSI = "http://www.w3.org/2001/XMLSchema-instance"


@dataclass(frozen=True)
class MessageType:
    ext: str
    root: str
    name_no: str
    direction: str  # "til" | "fra" | "begge"

    @property
    def header(self) -> str:
        return f"{self.root}Header"


MESSAGE_TYPES: dict[str, MessageType] = {m.ext: m for m in [
    # Rapporter fra maskin
    MessageType("hpr", "HarvestedProduction", "Hogstproduksjon (stammer og stokker)", "fra"),
    MessageType("hqc", "HarvestingQualityControl", "Kontrollmåling hogst (kalibrering)", "fra"),
    MessageType("thp", "TotalHarvestedProduction", "Total hogstproduksjon (summert)", "fra"),
    MessageType("fpr", "ForwardedProduction", "Lassbæreproduksjon (lass)", "fra"),
    MessageType("fqc", "ForwardingQualityControl", "Kontrollmåling lassbærer", "fra"),
    MessageType("mom", "OperationalMonitoring", "Driftsoppfølging (tid, drivstoff)", "fra"),
    MessageType("ogr", "ObjectGeographicalReport", "Geografisk rapport for objekt", "fra"),
    MessageType("bpr", "FelledBunchedProduction", "Felt/buntet produksjon (feller-buncher)", "fra"),
    # Instruksjoner til maskin
    MessageType("pin", "ProductInstruction", "Produktinstruksjon (aptering, prismatrise)", "til"),
    MessageType("spi", "SpeciesGroupInstruction", "Treslagsinstruksjon", "til"),
    MessageType("oin", "ObjectInstruction", "Objektinstruksjon (hogstobjekt/teig)", "til"),
    MessageType("ogi", "ObjectGeographicalInstruction", "Geografisk instruksjon (kart, grenser)", "begge"),
    MessageType("foi", "ForwardingObjectInstruction", "Objektinstruksjon lassbærer", "til"),
    MessageType("fdi", "ForwardingDeliveryInstruction", "Leveranseinstruksjon lassbærer", "til"),
    MessageType("udi", "UserDefinedDataInstruction", "Brukerdefinert instruksjon", "til"),
    MessageType("boi", "FellingBunchingObjectInstruction", "Objektinstruksjon feller-buncher", "til"),
    MessageType("env", "Envelope", "Konvolutt som pakker flere meldinger", "begge"),
]}

ROOT_TO_EXT = {m.root: m.ext for m in MESSAGE_TYPES.values()}

# Enhetsattributter som er påkrevd på rot-elementet i alle meldinger
UNIT_ATTRS = {
    "areaUnit": "ha",
    "diameterUnit": "mm",
    "lengthUnit": "cm",
    "volumeUnit": "m3",
    "weightUnit": "kg",
}

# Kjente versjoner og versjonsdatoer (Skogforsk)
VERSION_DATES = {
    "1.0": "2011-06-22", "2.0": "2011-12-04", "2.1": "2013-02-05",
    "3.0": "2014-02-06", "3.1": "2015-02-06", "3.2": "2016-02-04",
    "3.3": "2017-02-06", "3.4": "2018-02-06", "3.5": "2019-02-07",
    "3.6": "2020-02-07", "4.0": "2022-08-15", "4.1": "2025-02-05",
}
DEFAULT_VERSION = "3.6"  # mest utbredt i maskiner på markedet i dag


def ext_from_name(name: str) -> str | None:
    """Finn meldingstype ut fra filnavn. Håndterer komprimert ('.hprz')."""
    suffix = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if suffix.endswith("z") and suffix[:-1] in MESSAGE_TYPES:
        suffix = suffix[:-1]
    return suffix if suffix in MESSAGE_TYPES else None
