"""Klient for StanForD File REST (v0.1), kun standardbiblioteket.

Kontor-/skogsystem-siden:
    c = StanfordClient("https://hub.example.no", api_key="...")
    c.list("HPR", StartDate="2026-10-01T00:00:00Z")
    c.download("HPR", file_id)
    c.send_instruction("PIN", xml_bytes, machine_id="1WJ1170G...")   # én maskin
    c.send_instruction("PIN", xml_bytes, business_id="999888777")     # alle maskiner hos oppdragsgiver
    c.pull_new("HPR", "innboks/", state_file="sett.json")            # anbefalt polling

Maskin-/gateway-siden (utvidelse, se rest_server.py):
    c.upload_report(bytes, filename)
    c.inbox("PIN", machine_id) / c.fetch_inbox(...) / c.ack(...)
"""
from __future__ import annotations

import base64
import gzip
import json
import ssl
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
import xml.etree.ElementTree as ET


class StanfordRestError(Exception):
    def __init__(self, status: int, message: str, entries: list[str]):
        super().__init__(f"HTTP {status}: {message} {entries or ''}".strip())
        self.status, self.message, self.entries = status, message, entries


class StanfordClient:
    def __init__(self, base_url: str, api_key: str | None = None, username: str = "",
                 api_path: str = "/File/v0.1", timeout: float = 60, cafile: str | None = None):
        self.base = base_url.rstrip("/")
        self.api = api_path
        self.timeout = timeout
        self.auth = None
        if api_key is not None:
            self.auth = "Basic " + base64.b64encode(f"{username}:{api_key}".encode()).decode()
        self.ctx = ssl.create_default_context(cafile=cafile) if cafile else None

    # ---------- lavnivå ----------
    def _req(self, method: str, path: str, params: dict | None = None, data: bytes | None = None,
             filename: str | None = None):
        url = self.base + path
        if params:
            url += "?" + urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Accept-Encoding", "gzip")
        if self.auth:
            req.add_header("Authorization", self.auth)
        if data is not None:
            req.add_header("Content-Type", "application/xml")
            if filename:
                req.add_header("Content-Disposition", f'attachment; filename="{filename}"')
        try:
            with urllib.request.urlopen(req, timeout=self.timeout, context=self.ctx) as resp:
                body = resp.read()
                if resp.headers.get("Content-Encoding") == "gzip":
                    body = gzip.decompress(body)
                return resp.status, dict(resp.headers), body
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.headers.get("Content-Encoding") == "gzip":
                body = gzip.decompress(body)
            msg, entries = e.reason, []
            try:
                root = ET.fromstring(body)
                msg = root.findtext("Message") or msg
                entries = [x.text for x in root.findall("Entry")]
            except ET.ParseError:
                pass
            raise StanfordRestError(e.code, msg, entries) from None

    @staticmethod
    def _entries(body: bytes) -> list[str]:
        if not body:
            return []
        return [e.text or "" for e in ET.fromstring(body).findall("Entry")]

    # ---------- spesifikasjonens endepunkter ----------
    def versions(self) -> list[str]:
        return self._entries(self._req("GET", "/")[2])

    def capabilities(self) -> str:
        return self._req("GET", "/Capabilities")[2].decode()

    def file_types(self) -> list[str]:
        return self._entries(self._req("GET", self.api)[2])

    def list(self, ftype: str, **filters) -> list[str]:
        """Filtre: BaseMachineManufacturerID, ObjectUserID, StartDate, EndDate (UTC 'YYYY-MM-DDTHH:MM:SSZ')."""
        return self._entries(self._req("GET", f"{self.api}/{ftype.upper()}", filters)[2])

    def head(self, ftype: str, file_id: str) -> dict:
        return self._req("HEAD", f"{self.api}/{ftype.upper()}/{file_id}")[1]

    def download(self, ftype: str, file_id: str) -> tuple[bytes, str | None]:
        _, headers, body = self._req("GET", f"{self.api}/{ftype.upper()}/{file_id}")
        cd = headers.get("Content-Disposition", "")
        name = cd.split("filename=")[-1].strip('"') if "filename=" in cd else None
        return body, name

    def machines(self, ftype: str = "PIN", business_id: str | None = None) -> list[str]:
        return self._entries(self._req("GET", f"{self.api}/{ftype.upper()}", {"BusinessID": business_id})[2])

    def send_instruction(self, ftype: str, data: bytes, machine_id: str | None = None,
                         business_id: str | None = None, filename: str | None = None):
        path = f"{self.api}/{ftype.upper()}" + (f"/{machine_id}" if machine_id else "")
        params = None if machine_id else {"BusinessID": business_id}
        self._req("POST", path, params, data, filename)

    def sync_status(self, machine_id: str) -> str | None:
        e = self._entries(self._req("GET", f"{self.api}/status/syncronization/{machine_id}")[2])
        return e[0] if e else None

    # ---------- anbefalt polling (spesifikasjonen) ----------
    def pull_new(self, ftype: str, dest: str | Path, state_file: str | Path,
                 lookback_hours: int = 24, **filters) -> list[Path]:
        """Hent filer som ikke er sett før innen et tidsvindu (f.eks. kjør hver time, se 24 t bakover)."""
        dest = Path(dest)
        dest.mkdir(parents=True, exist_ok=True)
        state_file = Path(state_file)
        seen = set(json.loads(state_file.read_text())) if state_file.exists() else set()
        start = (datetime.now(timezone.utc) - timedelta(hours=lookback_hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
        filters.setdefault("StartDate", start)
        got = []
        for fid in self.list(ftype, **filters):
            if fid in seen:
                continue
            data, name = self.download(ftype, fid)
            p = dest / f"{fid}_{name or fid + '.' + ftype.lower()}"
            p.write_bytes(data)
            seen.add(fid)
            got.append(p)
        state_file.write_text(json.dumps(sorted(seen)))
        return got

    # ---------- utvidelser for maskin/gateway ----------
    def upload_report(self, data: bytes, filename: str, ftype: str | None = None,
                      machine_id: str | None = None) -> str:
        ftype = (ftype or filename.rsplit(".", 1)[-1].rstrip("zZ")).upper()
        _, _, body = self._req("POST", f"{self.api}/{ftype}",
                               {"BaseMachineManufacturerID": machine_id}, data, filename)
        e = self._entries(body)
        return e[0] if e else ""

    def inbox(self, ftype: str, machine_id: str) -> list[str]:
        return self._entries(self._req("GET", f"{self.api}/{ftype.upper()}/{machine_id}/inbox")[2])

    def fetch_inbox(self, ftype: str, machine_id: str, file_id: str) -> tuple[bytes, str | None]:
        _, headers, body = self._req("GET", f"{self.api}/{ftype.upper()}/{machine_id}/inbox/{file_id}")
        cd = headers.get("Content-Disposition", "")
        return body, (cd.split("filename=")[-1].strip('"') if "filename=" in cd else None)

    def ack(self, ftype: str, machine_id: str, file_id: str):
        self._req("DELETE", f"{self.api}/{ftype.upper()}/{machine_id}/inbox/{file_id}")
