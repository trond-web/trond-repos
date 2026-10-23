"""Lesing og skriving av StanForD 2010-filer på disk.

Regel R2.1: Komprimerte filer bruker ZIP DEFLATE, og får 'z' lagt til
filendelsen (f.eks. .hprz). Vi støtter zip-arkiv, gzip, zlib og rå deflate
ved lesing, og skriver zip-arkiv med én fil ved komprimering.
"""
from __future__ import annotations

import gzip
import io
import zipfile
import zlib
import xml.etree.ElementTree as ET
from pathlib import Path

from .messages import NS, ROOT_TO_EXT, MESSAGE_TYPES, ext_from_name

ET.register_namespace("", NS)
ET.register_namespace("xsi", "http://www.w3.org/2001/XMLSchema-instance")


def decompress(data: bytes) -> bytes:
    """Pakk ut hvis data er komprimert, ellers returner uendret."""
    if data[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            names = [n for n in zf.namelist() if not n.endswith("/")]
            if not names:
                raise ValueError("Tomt zip-arkiv")
            return zf.read(names[0])
    if data[:2] == b"\x1f\x8b":
        return gzip.decompress(data)
    stripped = data.lstrip(b"\xef\xbb\xbf \t\r\n")
    if stripped[:1] == b"<":
        return data
    for wbits in (zlib.MAX_WBITS, -zlib.MAX_WBITS):
        try:
            return zlib.decompress(data, wbits)
        except zlib.error:
            continue
    raise ValueError("Ukjent filformat: verken XML eller kjent komprimering")


def compress(xml_bytes: bytes, inner_name: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(inner_name, xml_bytes)
    return buf.getvalue()


def parse_bytes(data: bytes) -> ET.Element:
    data = decompress(data)
    if data.startswith(b"\xef\xbb\xbf"):
        data = data[3:]
    return ET.fromstring(data)


def parse_file(path: str | Path) -> ET.Element:
    return parse_bytes(Path(path).read_bytes())


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def message_ext(root: ET.Element, filename: str | None = None) -> str | None:
    ext = root.get("messageType")
    if ext and ext.lower() in MESSAGE_TYPES:
        return ext.lower()
    ext = ROOT_TO_EXT.get(local(root.tag))
    if ext:
        return ext
    return ext_from_name(filename) if filename else None


def to_bytes(root: ET.Element, pretty: bool = True) -> bytes:
    if pretty:
        ET.indent(root, space="  ")
    return b'<?xml version="1.0" encoding="utf-8"?>\n' + ET.tostring(root, encoding="utf-8", xml_declaration=False)


def write_file(root: ET.Element, path: str | Path, compressed: bool | None = None) -> Path:
    """Skriv melding. compressed=None => komprimer hvis filnavnet ender på 'z'."""
    path = Path(path)
    data = to_bytes(root)
    if compressed is None:
        compressed = path.suffix.lower().endswith("z") and len(path.suffix) == 5
    if compressed:
        if not path.suffix.lower().endswith("z"):
            path = path.with_suffix(path.suffix + "z")
        inner = path.name[:-1]
        data = compress(data, inner)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path


# --- Små hjelpere for navnerom -------------------------------------------------

def q(tag: str) -> str:
    return f"{{{NS}}}{tag}"


def find(el: ET.Element | None, path: str) -> ET.Element | None:
    if el is None:
        return None
    return el.find("/".join(q(p) for p in path.split("/")))


def findall(el: ET.Element | None, path: str) -> list[ET.Element]:
    if el is None:
        return []
    return el.findall("/".join(q(p) for p in path.split("/")))


def text(el: ET.Element | None, path: str | None = None, default=None):
    node = find(el, path) if path else el
    if node is None or node.text is None:
        return default
    t = node.text.strip()
    return t if t != "" else default


def num(el: ET.Element | None, path: str | None = None, default=None):
    t = text(el, path)
    if t is None:
        return default
    try:
        f = float(t)
        return int(f) if f.is_integer() and "." not in t else f
    except ValueError:
        return default


def to_dict(el: ET.Element):
    """Generisk konvertering av et XML-element til dict/list (for JSON-eksport)."""
    children = list(el)
    attrs = {f"@{k.rsplit('}', 1)[-1]}": v for k, v in el.attrib.items() if "schemaLocation" not in k}
    if not children:
        t = (el.text or "").strip()
        if attrs:
            d = dict(attrs)
            if t:
                d["#text"] = t
            return d
        return t
    d: dict = dict(attrs)
    for c in children:
        k = local(c.tag)
        v = to_dict(c)
        if k in d:
            if not isinstance(d[k], list):
                d[k] = [d[k]]
            d[k].append(v)
        else:
            d[k] = v
    return d
