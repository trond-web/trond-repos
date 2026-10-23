"""Tester: python -m unittest discover -s tests -v

Sett SF2010_EKSEMPLER=<mappe> for i tillegg å teste mot ekte maskinfiler
(f.eks. inst/extdata fra https://github.com/hbelbo/sf2010r).
"""
import json
import os
import tempfile
import threading
import unittest
from pathlib import Path

from stanford2010 import (build_oin, build_pin, build_spi, instructions_from_report, open_bytes,
                          open_file, validate, write_file)
from stanford2010.rest_client import StanfordClient, StanfordRestError
from stanford2010.rest_server import make_server
from stanford2010.simulator import simulate
from stanford2010.sync import MachineAgent, export_folder, import_folder
from stanford2010.xmlio import compress, parse_file, to_bytes

EX = Path(__file__).resolve().parent.parent / "examples"
MID = "TESTMASKIN01"


def spec(name):
    return json.loads((EX / name).read_text(encoding="utf-8"))


class TestWriteRead(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())

    def test_pin_roundtrip(self):
        pin = build_pin(spec("produkter.json"))
        self.assertTrue(validate(pin).ok, validate(pin))
        p = write_file(pin, self.tmp / "a.pin")
        sf = open_file(p)
        self.assertEqual(sf.ext, "pin")
        self.assertEqual(len(sf.products()), 4)

    def test_pin_matrix_and_forbidden(self):
        pin = build_pin(spec("produkter.json"))
        xml = to_bytes(pin).decode()
        self.assertIn('diameterClassLowerLimit="140" lengthClassLowerLimit="550"', xml)
        self.assertIn("Forbidden to buck the log even manually", xml)

    def test_spi_oin(self):
        for root in (build_spi(spec("treslag.json")), build_oin(spec("objekt.json"))):
            self.assertTrue(validate(root).ok, validate(root))

    def test_compressed(self):
        pin = build_pin(spec("produkter.json"))
        p = write_file(pin, self.tmp / "a.pinz")
        self.assertEqual(p.read_bytes()[:2], b"PK")
        self.assertEqual(open_file(p).ext, "pin")

    def test_simulate_and_read(self):
        hpr = simulate(build_pin(spec("produkter.json")), 30, seed=7)
        self.assertTrue(validate(hpr).ok, validate(hpr))
        sf = open_bytes(to_bytes(hpr), "x.hpr")
        self.assertEqual(len(sf.stems()), 30)
        self.assertGreater(sum(r["m3sub"] for r in sf.summary()), 0)
        # posisjon i stammen akkumuleres
        logs = [r for r in sf.logs() if r["stem_number"] == sf.logs()[0]["stem_number"]]
        if len(logs) > 1:
            self.assertEqual(logs[1]["start_pos_cm"], logs[0]["length_cm"])

    def test_extract_instructions(self):
        hpr = simulate(build_pin(spec("produkter.json")), 10, seed=1)
        res = instructions_from_report(hpr)
        self.assertTrue(validate(res["pin"]).ok, validate(res["pin"]))
        self.assertTrue(validate(res["spi"]).ok)
        ids = {p["product_user_id"] for p in open_bytes(to_bytes(res["pin"])).products()}
        self.assertIn("GRAN-SAG-2026", ids)


class TestValidation(unittest.TestCase):
    def test_detects_errors(self):
        s = spec("produkter.json")
        s["products"][1]["product_user_id"] = s["products"][0]["product_user_id"].lower()
        s["products"][0]["cutting_window_cm"] = [8, 3]
        r = validate(build_pin(s))
        self.assertFalse(r.ok)
        self.assertTrue(any("duplisert" in e for e in r.errors))
        self.assertTrue(any("kappvindu" in e for e in r.errors))

    def test_undefined_product_in_hpr(self):
        hpr = simulate(build_pin(spec("produkter.json")), 5, seed=2)
        from stanford2010.xmlio import findall
        for pk in findall(hpr, "Machine/ProductDefinition/ProductKey"):
            pk.text = "9999"
        self.assertTrue(any("R3.7" in e for e in validate(hpr).errors))


class TestTransfer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        users = {"kontor": {"role": "office", "business_ids": ["*"]},
                 "maskin": {"role": "machine", "machine_id": MID, "business_ids": ["999888777"]},
                 "fremmed": {"role": "office", "business_ids": ["111"]}}
        cls.srv = make_server(cls.tmp / "hub", port=0, users=users, verbose=False)
        cls.url = f"http://127.0.0.1:{cls.srv.server_address[1]}"
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()
        cls.srv.store.close()

    def test_full_cycle(self):
        office = StanfordClient(self.url, "kontor")
        machine = StanfordClient(self.url, "maskin")
        self.assertEqual(office.versions(), ["File_v0.1"])
        self.assertIn(MID, office.machines("PIN"))
        pin = to_bytes(build_pin(spec("produkter.json")))
        office.send_instruction("PIN", pin, machine_id=MID, filename="aptering.pin")
        office.send_instruction("SPI", to_bytes(build_spi(spec("treslag.json"))), business_id="999888777")

        exp, imp = self.tmp / "eksport", self.tmp / "import"
        exp.mkdir()
        agent = MachineAgent(machine, MID, exp, imp, self.tmp / "agent.json", min_file_age_s=0, log=lambda *_: None)
        self.assertEqual(agent.download_instructions(), 2)
        self.assertTrue((imp / "aptering.pin").exists())
        self.assertEqual(machine.inbox("PIN", MID), [])  # kvittert

        hpr = simulate(parse_file(imp / "aptering.pin"), 20, seed=3, machine_key=MID)
        write_file(hpr, exp / "objekt1.hpr")
        self.assertEqual(agent.upload_reports(), 1)
        self.assertEqual(agent.upload_reports(), 0)  # ikke last opp på nytt

        ids = office.list("HPR", BaseMachineManufacturerID=MID)
        self.assertEqual(len(ids), 1)
        data, name = office.download("HPR", ids[0])
        self.assertEqual(len(open_bytes(data).stems()), 20)
        self.assertIn("Content-Length", office.head("HPR", ids[0]))
        self.assertEqual(StanfordClient(self.url, "fremmed").list("HPR"), [])
        got = office.pull_new("HPR", self.tmp / "inn", self.tmp / "sett.json")
        self.assertEqual(len(got), 1)
        self.assertEqual(office.pull_new("HPR", self.tmp / "inn", self.tmp / "sett.json"), [])

    def test_web_app_served(self):
        import urllib.request
        with urllib.request.urlopen(self.url + "/app") as r:
            body = r.read().decode()
        self.assertIn("Skogsmaskinfiler", body)
        self.assertIn("HarvestedProduction", body)  # innebygd eksempelfil

    def test_web_client_gets_no_browser_prompt(self):
        import urllib.request, urllib.error
        req = urllib.request.Request(self.url + "/File/v0.1", headers={"X-SF2010-Web": "1"})
        with self.assertRaises(urllib.error.HTTPError) as cm:
            urllib.request.urlopen(req)
        self.assertEqual(cm.exception.code, 401)
        self.assertIsNone(cm.exception.headers.get("WWW-Authenticate"))

    def test_auth_and_errors(self):
        with self.assertRaises(StanfordRestError) as cm:
            StanfordClient(self.url, "feil").list("HPR")
        self.assertEqual(cm.exception.status, 401)
        office = StanfordClient(self.url, "kontor")
        with self.assertRaises(StanfordRestError) as cm:
            office.send_instruction("OIN", to_bytes(build_oin(spec("objekt.json"))))
        self.assertEqual(cm.exception.status, 405)  # OIN aldri til alle maskiner
        with self.assertRaises(StanfordRestError) as cm:
            office.send_instruction("PIN", to_bytes(build_pin(spec("produkter.json"))), machine_id="FINNESIKKE")
        self.assertEqual(cm.exception.status, 404)
        with self.assertRaises(StanfordRestError) as cm:
            office.list("XYZ")
        self.assertEqual(cm.exception.status, 403)


class TestFolders(unittest.TestCase):
    def test_usb_import_export(self):
        tmp = Path(tempfile.mkdtemp())
        usb = tmp / "usb"
        usb.mkdir()
        hpr = simulate(build_pin(spec("produkter.json")), 5, seed=4)
        (usb / "a.hprz").write_bytes(compress(to_bytes(hpr), "a.hpr"))
        (usb / "kopi.hpr").write_bytes(to_bytes(hpr))
        (usb / "odelagt.hpr").write_bytes(b"<HarvestedProduction")
        res = import_folder(usb, tmp / "arkiv", tmp / "csv")
        st = sorted(r["status"].split(":")[0] for r in res)
        self.assertEqual(st, ["feil", "finnes fra før", "ny"])
        self.assertTrue(list((tmp / "csv").glob("*_stokker.csv")))
        pin_path = write_file(build_pin(spec("produkter.json")), tmp / "x.pin")
        out = export_folder([pin_path], usb / "import")
        self.assertEqual(out[0]["status"], "kopiert")


@unittest.skipUnless(os.environ.get("SF2010_EKSEMPLER"), "SF2010_EKSEMPLER ikke satt")
class TestRealFiles(unittest.TestCase):
    def test_all(self):
        for f in sorted(Path(os.environ["SF2010_EKSEMPLER"]).glob("*")):
            if f.suffix.lower() not in (".hpr", ".hqc", ".fpr", ".mom"):
                continue
            with self.subTest(f.name):
                sf = open_file(f)
                self.assertTrue(validate(sf.root).ok, validate(sf.root))
                if sf.ext == "hpr":
                    self.assertGreater(len(sf.stems()), 0)
                    res = instructions_from_report(sf.root)
                    self.assertTrue(validate(res["pin"]).ok, validate(res["pin"]))
                if sf.ext == "fpr":
                    self.assertGreater(len(sf.loads()), 0)


if __name__ == "__main__":
    unittest.main()
