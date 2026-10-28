"""Bygg stanford2010/web/index.html fra app.html og simulerte eksempelfiler (hpr, mom, hqc)."""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root))

from stanford2010 import build_pin  # noqa: E402
from stanford2010.simulator import simulate, simulate_hqc, simulate_mom  # noqa: E402
from stanford2010.xmlio import to_bytes  # noqa: E402
pin = build_pin(json.loads((root / "examples/produkter.json").read_text(encoding="utf-8")))
hpr = simulate(pin, 150, seed=11, object_user_id="EKSEMPEL-TEIG-01", lat=60.79, lon=11.07, machine_key="EKSEMPEL01")
html = (root / "stanford2010/web/app.html").read_text(encoding="utf-8")
for key, msg in (("HPR", hpr), ("MOM", simulate_mom(hpr, 11)), ("HQC", simulate_hqc(hpr, every=5, seed=11))):
    sample = to_bytes(msg, pretty=False).decode("utf-8")
    assert "</script" not in sample
    html = html.replace(f"__SAMPLE_{key}__", sample)
(root / "stanford2010/web/index.html").write_text(html, encoding="utf-8")
print(f"Skrev stanford2010/web/index.html ({len(html)//1024} kB)")
