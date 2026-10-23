"""StanForD File REST-server (hub) etter Skogforsk "StanForD File REST v1.0" (2021-02-07).

Implementerer spesifikasjonens endepunkter (API-versjon File v0.1):
  GET  /                                   -> API-versjoner
  GET  /Capabilities                       -> støttede API-er, filversjoner, FileDaysToExpiry
  GET  /File/v0.1                          -> støttede filtyper
  GET  /File/v0.1/{HPR|HQC|MOM|FPR|...}    -> liste fil-ID-er (filtre: BaseMachineManufacturerID,
                                              ObjectUserID, StartDate, EndDate)
  GET/HEAD /File/v0.1/{TYPE}/{id}          -> last ned fil (gzip ved Accept-Encoding)
  GET  /File/v0.1/{SPI|PIN|OIN|...}        -> liste maskiner
  POST /File/v0.1/{SPI|PIN|FDI}?BusinessID=  -> instruksjon til alle maskiner hos oppdragsgiver
  POST /File/v0.1/{TYPE}/{maskin-id}       -> instruksjon til én maskins innboks
  GET  /File/v0.1/status/syncronization/{maskin-id}  (skrivemåten er som i spesifikasjonen)

Begge skrivemåtene "/File/v0.1" og "/File_v0.1" godtas, fordi spesifikasjonen bruker begge.

Utvidelser (IKKE i spesifikasjonen - for maskin/gateway-siden, som standarden overlater
til produsentene):
  POST   /File/v0.1/{RAPPORTTYPE}                     -> maskin/gateway laster opp rapport
  GET    /File/v0.1/{INSTRUKSJONSTYPE}/{maskin}/inbox -> uleverte instruksjoner
  GET    /File/v0.1/{INSTRUKSJONSTYPE}/{maskin}/inbox/{id}
  DELETE /File/v0.1/{INSTRUKSJONSTYPE}/{maskin}/inbox/{id}  -> kvitter mottatt

Web-verktøy: GET /app gir nettsiden (les, lag, valider, send/hent) - den logger inn med API-nøkkel.

Autentisering: HTTP Basic (RFC 7617), realm "StanForD", API-nøkkel som passord.
Bruk HTTPS foran (f.eks. Caddy/nginx) ved fjerntilgang - spesifikasjonen krever det.
"""
from __future__ import annotations

import base64
import gzip
import json
import re
import ssl
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from xml.sax.saxutils import escape

from .messages import MESSAGE_TYPES, VERSION_DATES
from .store import Store

API = "File_v0.1"
REPORT_TYPES = ["HPR", "HQC", "MOM", "FPR", "FQC", "THP", "OGR", "BPR"]
INSTRUCTION_TYPES = ["SPI", "PIN", "OIN", "OGI", "FOI", "FDI", "BOI", "UDI", "ENV"]
COLLECTION_POST = {"SPI", "PIN", "FDI"}  # spesifikasjonen: kun disse til "alle maskiner"
FILE_DAYS_TO_EXPIRY = 90
PATH_RE = re.compile(r"^/(?:File/v0\.1|File_v0\.1)(?:/(.*))?$")


def load_users(path: str | Path | None) -> dict:
    """users.json: {"<api-nøkkel>": {"name": "...", "role": "office"|"machine",
                    "machine_id": "...", "business_ids": ["*"] | ["123456789"]}}"""
    if not path:
        return {}
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _xml_list(entries) -> bytes:
    body = "".join(f"<Entry>{escape(str(e))}</Entry>" for e in entries)
    return f'<?xml version="1.0" encoding="utf-8"?><Response>{body}</Response>'.encode()


def _xml_error(code: int, message: str, entries=()) -> bytes:
    body = "".join(f"<Entry>{escape(str(e))}</Entry>" for e in entries)
    return (f'<?xml version="1.0" encoding="utf-8"?><Error><Code>{code}</Code>'
            f"<Message>{escape(message)}</Message>{body}</Error>").encode()


class Handler(BaseHTTPRequestHandler):
    server_version = "StanForD-REST/0.1"
    store: Store
    users: dict
    allow_anonymous: bool

    # ---------- infrastruktur ----------
    def log_message(self, fmt, *args):
        if getattr(self.server, "verbose", True):
            super().log_message(fmt, *args)

    def _send(self, code: int, body: bytes = b"", ctype="application/xml",
              filename: str | None = None, head=False):
        enc = None
        if body and "gzip" in (self.headers.get("Accept-Encoding") or "") and len(body) > 512:
            body = gzip.compress(body)
            enc = "gzip"
        self.send_response(code)
        if code == 401 and not self.headers.get("X-SF2010-Web"):
            # Web-verktøyet logger inn selv; uten dette hodet viser nettleseren sitt eget innloggingsvindu
            self.send_header("WWW-Authenticate", 'Basic realm="StanForD"')
        if body or head:
            self.send_header("Content-Type", ctype)
        if enc:
            self.send_header("Content-Encoding", enc)
        if filename:
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if not head and body:
            self.wfile.write(body)

    def _error(self, code, message, entries=()):
        self._send(code, _xml_error(code, message, entries))

    def _user(self) -> dict | None:
        if not self.users and self.allow_anonymous:
            return {"name": "anonym", "role": "office", "business_ids": ["*"]}
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Basic "):
            return None
        try:
            _, _, key = base64.b64decode(auth[6:]).decode().partition(":")
        except Exception:
            return None
        return self.users.get(key)

    def _body(self) -> bytes:
        n = int(self.headers.get("Content-Length") or 0)
        data = self.rfile.read(n) if n else b""
        if (self.headers.get("Content-Encoding") or "").lower() == "gzip":
            data = gzip.decompress(data)
        return data

    @staticmethod
    def _allowed(user, row) -> bool:
        if user.get("role") == "machine":
            return row["machine_id"] == user.get("machine_id")
        bids = user.get("business_ids", [])
        if "*" in bids:
            return True
        return bool(row.get("business_id")) and row["business_id"] in bids

    def _route(self):
        u = urlparse(self.path)
        params = {k: v[-1] for k, v in parse_qs(u.query).items()}
        return u.path.rstrip("/") or "/", params

    # ---------- metoder ----------
    def do_HEAD(self):
        self._dispatch("HEAD")

    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    def do_DELETE(self):
        self._dispatch("DELETE")

    def do_PUT(self):
        self._dispatch("PUT")

    def _dispatch(self, method):
        if method in ("GET", "HEAD") and self._route()[0] in ("/app", "/app/index.html"):
            return self._web_app(method)  # web-verktøyet; innlogging skjer i siden (API-nøkkel)
        user = self._user()
        if user is None:
            return self._error(401, "Unauthorized")
        path, params = self._route()
        try:
            if path == "/":
                return self._only(method, ["GET"]) or self._send(200, _xml_list([API]))
            if path == "/Capabilities":
                return self._only(method, ["GET"]) or self._capabilities()
            m = PATH_RE.match(path)
            if not m:
                return self._error(404, "Not found")
            parts = [p for p in (m.group(1) or "").split("/") if p]
            return self._file_api(method, parts, params, user)
        except ValueError as e:
            return self._error(400, "Bad request", [str(e)])

    def _web_app(self, method):
        page = Path(__file__).with_name("web") / "index.html"
        if not page.exists():
            return self._error(404, "Not found", ["Web-verktøyet er ikke bygget (kjør tools/build_web.py)"])
        body = (b"<!doctype html><html lang=\"no\"><head><meta charset=\"utf-8\">"
                b"<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">"
                b"<style>[hidden]{display:none!important}body{margin:0}</style></head><body>"
                + page.read_bytes() + b"</body></html>")
        self._send(200, body, ctype="text/html; charset=utf-8", head=method == "HEAD")

    def _only(self, method, allowed):
        if method not in allowed:
            self._error(405, "Method not allowed", allowed)
            return True
        return False

    def _capabilities(self):
        vers = "".join(f"<FileVersion>{v}</FileVersion>" for v in VERSION_DATES)
        body = (f'<?xml version="1.0" encoding="utf-8"?><Capabilities><API>{API}</API>{vers}'
                f"<FileDaysToExpiry>{FILE_DAYS_TO_EXPIRY}</FileDaysToExpiry></Capabilities>").encode()
        self._send(200, body)

    def _file_api(self, method, parts, params, user):
        if not parts:
            return self._only(method, ["GET"]) or self._send(200, _xml_list(REPORT_TYPES + INSTRUCTION_TYPES))
        if parts[0] == "status" and len(parts) == 3 and parts[1] == "syncronization":
            if self._only(method, ["GET"]):
                return
            ts = self.store.last_sync(parts[2])
            if ts is None:
                return self._error(404, "Not found")
            return self._send(200, _xml_list([ts]))
        ftype = parts[0].upper()
        if ftype in REPORT_TYPES:
            return self._reports(method, ftype, parts[1:], params, user)
        if ftype in INSTRUCTION_TYPES:
            return self._instructions(method, ftype, parts[1:], params, user)
        return self._error(403, "Forbidden", REPORT_TYPES + INSTRUCTION_TYPES)

    # ----- rapporter fra maskin -----
    def _reports(self, method, ftype, rest, params, user):
        ext = ftype.lower()
        if not rest:
            if method == "GET":
                rows = self.store.query(ext, "report", params.get("BaseMachineManufacturerID"),
                                        params.get("ObjectUserID"), params.get("StartDate"), params.get("EndDate"))
                return self._send(200, _xml_list(r["id"] for r in rows if self._allowed(user, r)))
            if method == "POST":  # utvidelse: opplasting fra maskin/gateway
                data = self._body()
                fname = self._filename()
                mid = user.get("machine_id") if user.get("role") == "machine" else params.get("BaseMachineManufacturerID")
                row, new = self.store.add(data, fname, "report", mid, expected_type=ext)
                self.store.touch_machine(row["machine_id"])
                return self._send(201 if new else 200, _xml_list([row["id"]]))
            return self._error(405, "Method not allowed", ["GET", "POST"])
        if len(rest) == 1:
            if self._only(method, ["GET", "HEAD"]):
                return
            row = self.store.get(rest[0])
            if not row or row["type"] != ext or row["direction"] != "report" or not self._allowed(user, row):
                return self._error(404, "Not found")
            return self._send(200, self.store.read(row["id"]), filename=row["filename"], head=method == "HEAD")
        return self._error(404, "Not found")

    # ----- instruksjoner til maskin -----
    def _instructions(self, method, ftype, rest, params, user):
        ext = ftype.lower()
        if not rest:
            if method == "GET":
                return self._send(200, _xml_list(self.store.machines(params.get("BusinessID"))))
            if method == "POST":
                if ftype not in COLLECTION_POST:
                    return self._error(405, "Method not allowed", ["GET"])
                if user.get("role") == "machine":
                    return self._error(401, "Unauthorized")
                bid = params.get("BusinessID")
                if bid and "*" not in user.get("business_ids", []) and bid not in user.get("business_ids", []):
                    return self._error(400, "Bad request", ["BusinessID"])
                targets = self.store.machines(bid)
                if not targets:
                    return self._error(404, "Not found", ["Ingen maskiner registrert" + (f" for {bid}" if bid else "")])
                data, fname = self._body(), self._filename()
                for mid in targets:
                    self.store.add(data, fname, "instruction", mid, expected_type=ext)
                return self._send(200)
            return self._error(405, "Method not allowed", ["GET", "POST"])
        mid = rest[0]
        if len(rest) == 1:
            if self._only(method, ["POST"]):
                return
            if user.get("role") == "machine":
                return self._error(401, "Unauthorized")
            if mid not in self.store.machines():
                return self._error(404, "Not found")
            self.store.add(self._body(), self._filename(), "instruction", mid, expected_type=ext)
            return self._send(200)
        # utvidelse: maskinens innboks
        if rest[1] != "inbox":
            return self._error(404, "Not found")
        if user.get("role") == "machine" and user.get("machine_id") != mid:
            return self._error(401, "Unauthorized")
        if len(rest) == 2:
            if self._only(method, ["GET"]):
                return
            self.store.touch_machine(mid)
            rows = self.store.query(ext, "instruction", mid, undelivered_only=True)
            return self._send(200, _xml_list(r["id"] for r in rows))
        row = self.store.get(rest[2])
        if not row or row["machine_id"] != mid or row["type"] != ext or row["direction"] != "instruction":
            return self._error(404, "Not found")
        if method in ("GET", "HEAD"):
            return self._send(200, self.store.read(row["id"]), filename=row["filename"], head=method == "HEAD")
        if method == "DELETE":
            self.store.mark_delivered(row["id"])
            return self._send(200)
        return self._error(405, "Method not allowed", ["GET", "HEAD", "DELETE"])

    def _filename(self) -> str | None:
        cd = self.headers.get("Content-Disposition") or ""
        m = re.search(r'filename="?([^";]+)"?', cd)
        return m.group(1) if m else None


def make_server(store_dir: str | Path, host="127.0.0.1", port=8710, users: dict | None = None,
                allow_anonymous=False, certfile=None, keyfile=None, verbose=True) -> ThreadingHTTPServer:
    store = Store(store_dir)
    for u in (users or {}).values():  # maskinbrukere registreres som maskiner
        if u.get("role") == "machine" and u.get("machine_id"):
            store.register_machine(u["machine_id"], [b for b in u.get("business_ids", []) if b != "*"])
    handler = type("BoundHandler", (Handler,), {"store": store, "users": users or {},
                                                "allow_anonymous": allow_anonymous})
    srv = ThreadingHTTPServer((host, port), handler)
    srv.verbose = verbose
    srv.store = store
    if certfile:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(certfile, keyfile)
        srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    return srv
