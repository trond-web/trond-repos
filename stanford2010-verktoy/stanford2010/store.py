"""Felles fillager (SQLite + filer på disk) for REST-hub og mappesynk."""
from __future__ import annotations

import hashlib
import secrets
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path

from .messages import MESSAGE_TYPES
from .xmlio import decompress, find, message_ext, parse_bytes, text

SCHEMA = """
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,              -- hpr, pin, ...
    direction TEXT NOT NULL,         -- 'report' (fra maskin) eller 'instruction' (til maskin)
    machine_id TEXT,                 -- BaseMachineManufacturerID
    object_user_id TEXT,
    business_id TEXT,                -- LoggingOrganisation BusinessID (tilgangsstyring)
    filename TEXT,
    version TEXT,
    sha256 TEXT NOT NULL,
    size INTEGER,
    creation_date TEXT,              -- fra meldingshodet
    received TEXT NOT NULL,          -- UTC, når huben tok imot fila
    delivered TEXT,                  -- instruksjon: når maskinen kvitterte
    path TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_type ON files(type, received);
CREATE UNIQUE INDEX IF NOT EXISTS ix_dedupe ON files(type, machine_id, sha256);
CREATE TABLE IF NOT EXISTS machines (
    machine_id TEXT PRIMARY KEY,
    business_ids TEXT DEFAULT '',    -- kommaseparert liste over oppdragsgivere
    last_seen TEXT
);
"""


def utcnow() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def metadata(data: bytes, filename: str | None = None) -> dict:
    root = parse_bytes(data)
    ext = message_ext(root, filename)
    mt = MESSAGE_TYPES.get(ext or "")
    machine = find(root, "Machine")
    obj = find(machine, "ObjectDefinition") if machine is not None else find(root, "ObjectDefinition")
    header = find(root, mt.header) if mt else None
    return {
        "type": ext,
        "version": root.get("version"),
        "machine_id": text(machine, "BaseMachineManufacturerID") or text(machine, "MachineKey"),
        "object_user_id": text(obj, "ObjectUserID"),
        "business_id": text(obj, "LoggingOrganisation/ContactInformation/BusinessID"),
        "creation_date": text(header, "CreationDate"),
    }


class Store:
    def __init__(self, base: str | Path):
        self.base = Path(base)
        self.base.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self.db = sqlite3.connect(self.base / "stanford.db", check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript(SCHEMA)

    def close(self):
        self.db.close()

    # ---------- maskiner ----------
    def register_machine(self, machine_id: str, business_ids: list[str] | None = None):
        with self._lock:
            self.db.execute(
                "INSERT INTO machines(machine_id, business_ids, last_seen) VALUES(?,?,?) "
                "ON CONFLICT(machine_id) DO UPDATE SET business_ids=COALESCE(NULLIF(excluded.business_ids,''), business_ids)",
                (machine_id, ",".join(business_ids or []), None))
            self.db.commit()

    def touch_machine(self, machine_id: str):
        with self._lock:
            self.db.execute("INSERT INTO machines(machine_id,last_seen) VALUES(?,?) "
                            "ON CONFLICT(machine_id) DO UPDATE SET last_seen=excluded.last_seen",
                            (machine_id, utcnow()))
            self.db.commit()

    def machines(self, business_id: str | None = None) -> list[str]:
        rows = self.db.execute("SELECT machine_id, business_ids FROM machines ORDER BY machine_id").fetchall()
        if business_id is None:
            return [r["machine_id"] for r in rows]
        return [r["machine_id"] for r in rows if business_id in (r["business_ids"] or "").split(",")]

    def last_sync(self, machine_id: str) -> str | None:
        r = self.db.execute("SELECT last_seen FROM machines WHERE machine_id=?", (machine_id,)).fetchone()
        return r["last_seen"] if r else None

    # ---------- filer ----------
    def add(self, data: bytes, filename: str | None, direction: str,
            machine_id: str | None = None, expected_type: str | None = None) -> tuple[dict, bool]:
        """Lagre fil. Returnerer (rad, ny) - ny=False hvis identisk fil fantes fra før."""
        raw = decompress(data)
        meta = metadata(raw, filename)
        if expected_type and meta["type"] != expected_type:
            raise ValueError(f"Fila er av type {meta['type']}, forventet {expected_type}")
        machine_id = machine_id or meta["machine_id"] or "ukjent"
        sha = hashlib.sha256(raw).hexdigest()
        with self._lock:
            old = self.db.execute("SELECT * FROM files WHERE type=? AND machine_id=? AND sha256=?",
                                  (meta["type"], machine_id, sha)).fetchone()
            if old:
                return dict(old), False
            fid = secrets.token_hex(6)  # kun [0-9a-f]: trygt i filnavn og URL-er
            name = filename or f"{meta['object_user_id'] or 'fil'}.{meta['type']}"
            if name.lower().endswith(meta["type"] + "z"):
                name = name[:-1]
            safe = "".join(ch if ch.isalnum() or ch in "._-#" else "_" for ch in name)
            path = self.base / direction / meta["type"] / machine_id / f"{fid}_{safe}"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
            row = {"id": fid, "type": meta["type"], "direction": direction, "machine_id": machine_id,
                   "object_user_id": meta["object_user_id"], "business_id": meta["business_id"],
                   "filename": safe, "version": meta["version"], "sha256": sha, "size": len(raw),
                   "creation_date": meta["creation_date"], "received": utcnow(), "delivered": None,
                   "path": str(path)}
            self.db.execute(f"INSERT INTO files({','.join(row)}) VALUES({','.join('?' * len(row))})",
                            list(row.values()))
            self.db.commit()
        return row, True

    def get(self, fid: str) -> dict | None:
        r = self.db.execute("SELECT * FROM files WHERE id=?", (fid,)).fetchone()
        return dict(r) if r else None

    def query(self, type_: str, direction: str = "report", machine_id: str | None = None,
              object_user_id: str | None = None, start: str | None = None, end: str | None = None,
              undelivered_only: bool = False) -> list[dict]:
        sql = "SELECT * FROM files WHERE type=? AND direction=?"
        args: list = [type_, direction]
        if machine_id:
            sql += " AND machine_id=?"; args.append(machine_id)
        if object_user_id:
            sql += " AND object_user_id=?"; args.append(object_user_id)
        if start:  # inkluderende start, ekskluderende slutt (spesifikasjonen)
            sql += " AND received>=?"; args.append(start)
        if end:
            sql += " AND received<?"; args.append(end)
        if undelivered_only:
            sql += " AND delivered IS NULL"
        sql += " ORDER BY received, id"
        return [dict(r) for r in self.db.execute(sql, args).fetchall()]

    def mark_delivered(self, fid: str):
        with self._lock:
            self.db.execute("UPDATE files SET delivered=? WHERE id=?", (utcnow(), fid))
            self.db.commit()

    def read(self, fid: str) -> bytes:
        row = self.get(fid)
        if not row:
            raise KeyError(fid)
        return Path(row["path"]).read_bytes()
