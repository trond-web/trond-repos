"""Mappebasert kommunikasjon med maskinen.

StanForD 2010 definerer filformatene, men ikke selve transporten mellom maskin og
kontor. I praksis går det via:
  1. Minnepinne/USB  - fører eksporterer rapporter og importerer instruksjoner i maskinens
                       program (TimberMatic, MaxiXT/MaxiXplorer, Opti4G m.fl.).
  2. Produsentens skytjeneste (f.eks. John Deere TimberManager, Komatsu MaxiFleet /
     Smart Forestry, Ponsse Manager) som synker filer til en mappe eller et API hos dere.
  3. En gateway (PC/Raspberry Pi) som ser en delt mappe på maskinen.

Regel R2.2 sier at maskinen SKAL ha en fast standardmappe for filene. Derfor er
mappesynk den mest universelle måten å "snakke med" en hogstmaskin på. Denne modulen gir:
  - import_folder():   les alle rapporter fra en mappe/minnepinne inn i et lokalt arkiv
  - export_folder():   valider og legg instruksjoner i en mappe/minnepinne for maskinen
  - MachineAgent:      gateway som laster opp rapporter til REST-huben og henter ned
                       instruksjoner til maskinens importmappe, i en løkke
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path

from .messages import MESSAGE_TYPES, ext_from_name
from .store import Store
from .validate import validate
from .xmlio import decompress, parse_bytes

REPORTS = {e for e, m in MESSAGE_TYPES.items() if m.direction == "fra"}
INSTRUCTIONS = {e for e, m in MESSAGE_TYPES.items() if m.direction in ("til", "begge")}


def iter_stanford_files(folder: str | Path, kinds: set[str]):
    for p in sorted(Path(folder).rglob("*")):
        if p.is_file() and ext_from_name(p.name) in kinds:
            yield p


def import_folder(source: str | Path, archive: str | Path, csv_dir: str | Path | None = None) -> list[dict]:
    """Importer rapporter fra en mappe (f.eks. minnepinne) til lokalt arkiv. Duplikater hoppes over."""
    store = Store(archive)
    results = []
    for p in iter_stanford_files(source, REPORTS):
        try:
            row, new = store.add(p.read_bytes(), p.name, "report")
        except Exception as e:  # ødelagt/ufullstendig fil (f.eks. avbrutt kopiering)
            results.append({"file": str(p), "status": f"feil: {e}"})
            continue
        results.append({"file": str(p), "status": "ny" if new else "finnes fra før", "id": row["id"],
                        "type": row["type"], "machine": row["machine_id"], "object": row["object_user_id"]})
        if new and csv_dir and row["type"] in ("hpr", "hqc", "fpr"):
            from .reader import open_file, write_csv
            sf = open_file(row["path"])
            base = Path(csv_dir) / f"{row['type']}_{row['machine_id']}_{row['id']}"
            if row["type"] == "fpr":
                write_csv(sf.loads(), f"{base}_lass.csv")
            else:
                write_csv(sf.stems(), f"{base}_stammer.csv")
                write_csv(sf.logs(), f"{base}_stokker.csv")
    store.close()
    return results


def export_folder(files: list[str | Path], target: str | Path, strict: bool = True) -> list[dict]:
    """Valider og kopier instruksjonsfiler til en mappe maskinen importerer fra."""
    target = Path(target)
    target.mkdir(parents=True, exist_ok=True)
    out = []
    for f in map(Path, files):
        data = decompress(f.read_bytes())
        rep = validate(parse_bytes(data))
        if strict and not rep.ok:
            out.append({"file": str(f), "status": "avvist", "errors": rep.errors})
            continue
        name = f.name[:-1] if f.name.lower().endswith(tuple(e + "z" for e in MESSAGE_TYPES)) else f.name
        tmp = target / (name + ".part")
        tmp.write_bytes(data)
        tmp.replace(target / name)  # atomisk: maskinen ser aldri en halvskrevet fil
        out.append({"file": str(f), "status": "kopiert", "to": str(target / name), "warnings": rep.warnings})
    return out


class MachineAgent:
    """Gateway mellom maskinens filmapper og REST-huben."""

    def __init__(self, client, machine_id: str, export_dir: str | Path, import_dir: str | Path,
                 state_file: str | Path, instruction_types=("SPI", "PIN", "OIN"),
                 min_file_age_s: float = 10.0, log=print):
        self.client = client
        self.machine_id = machine_id
        self.export_dir = Path(export_dir)
        self.import_dir = Path(import_dir)
        self.state_file = Path(state_file)
        self.types = instruction_types
        self.min_age = min_file_age_s
        self.log = log
        self.state = json.loads(self.state_file.read_text()) if self.state_file.exists() else {"uploaded": {}}

    def _save(self):
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        self.state_file.write_text(json.dumps(self.state, indent=1))

    def upload_reports(self) -> int:
        n = 0
        for p in iter_stanford_files(self.export_dir, REPORTS):
            if time.time() - p.stat().st_mtime < self.min_age:
                continue  # maskinen skriver kanskje fortsatt til fila
            data = p.read_bytes()
            sha = hashlib.sha256(data).hexdigest()
            if self.state["uploaded"].get(str(p)) == sha:
                continue
            try:
                parse_bytes(data)
            except Exception as e:
                self.log(f"Hopper over {p.name}: ikke gyldig XML ennå ({e})")
                continue
            fid = self.client.upload_report(data, p.name, machine_id=self.machine_id)
            self.state["uploaded"][str(p)] = sha
            self._save()
            self.log(f"Lastet opp {p.name} -> {fid}")
            n += 1
        return n

    def download_instructions(self) -> int:
        n = 0
        self.import_dir.mkdir(parents=True, exist_ok=True)
        for t in self.types:
            for fid in self.client.inbox(t, self.machine_id):
                data, name = self.client.fetch_inbox(t, self.machine_id, fid)
                rep = validate(parse_bytes(data))
                if not rep.ok:
                    self.log(f"Avviste {t} {fid}: {rep.errors[:3]}")
                    continue  # kvitteres ikke - blir liggende på huben for oppfølging
                name = name or f"{fid}.{t.lower()}"
                if "_" in name and name.split("_", 1)[0] == fid:
                    name = name.split("_", 1)[1]
                tmp = self.import_dir / (name + ".part")
                tmp.write_bytes(data)
                tmp.replace(self.import_dir / name)
                self.client.ack(t, self.machine_id, fid)
                self.log(f"Hentet {t} {name} til {self.import_dir}")
                n += 1
        return n

    def run_once(self) -> tuple[int, int]:
        return self.upload_reports(), self.download_instructions()

    def run_forever(self, interval_s: float = 60):
        while True:
            try:
                self.run_once()
            except Exception as e:  # nettverk borte i skogen er normalt - prøv igjen senere
                self.log(f"Synk feilet, prøver igjen om {interval_s}s: {e}")
            time.sleep(interval_s)
