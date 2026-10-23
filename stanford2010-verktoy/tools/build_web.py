"""Bygg stanford2010/web/index.html fra app.html og en simulert eksempel-hpr."""
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root))

from stanford2010 import build_pin  # noqa: E402
from stanford2010.simulator import simulate  # noqa: E402
from stanford2010.xmlio import to_bytes  # noqa: E402
pin = build_pin(json.loads((root / "examples/produkter.json").read_text(encoding="utf-8")))
hpr = simulate(pin, 45, seed=11, object_user_id="EKSEMPEL-TEIG-01", lat=60.79, lon=11.07, machine_key="EKSEMPEL01")
sample = to_bytes(hpr, pretty=False).decode("utf-8")
assert "</script" not in sample
html = (root / "stanford2010/web/app.html").read_text(encoding="utf-8").replace("__SAMPLE_HPR__", sample)
(root / "stanford2010/web/index.html").write_text(html, encoding="utf-8")
print(f"Skrev stanford2010/web/index.html ({len(html)//1024} kB)")
