"""Kommandolinje: sf2010 <kommando> ...   (kjør `sf2010 -h` for oversikt)"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import reader, writer
from .validate import validate
from .xmlio import parse_file, write_file


def _p(*a):
    print(*a)


def cmd_info(a):
    for f in a.filer:
        sf = reader.open_file(f)
        mt = sf.message_type
        _p(f"\n== {f}")
        _p(f"Type: {sf.ext} – {mt.name_no if mt else '?'}  (StanForD {sf.version})")
        for k, v in sf.header.items():
            _p(f"  {k}: {v}")
        m = {k: v for k, v in sf.machine.items() if v}
        if m:
            _p("Maskin: " + ", ".join(f"{k}={v}" for k, v in m.items()))
        for o in sf.objects():
            _p(f"Objekt: {o['object_user_id']} «{o['name']}» start {o['start_date']}")
        if sf.ext in ("hpr", "hqc"):
            st = sf.stems()
            _p(f"Stammer: {len(st)}   Stokker: {len(sf.logs())}")
            _p(f"{'Treslag':<14}{'Produkt':<32}{'Stokker':>8}{'m3fub':>10}{'m3pb':>10}")
            tot = [0, 0.0, 0.0]
            for r in sf.summary():
                _p(f"{str(r['species']):<14}{str(r['product'])[:31]:<32}{r['logs']:>8}{r['m3sub']:>10.2f}{r['m3sob']:>10.2f}")
                tot[0] += r["logs"]; tot[1] += r["m3sub"]; tot[2] += r["m3sob"]
            _p(f"{'SUM':<46}{tot[0]:>8}{tot[1]:>10.2f}{tot[2]:>10.2f}")
            if sf.ext == "hqc":
                c = sf.control_comparison()
                if c:
                    d = [r["length_diff_cm"] for r in c if "length_diff_cm" in r]
                    _p(f"Kontrollstokker: {len(c)}, snitt lengdeavvik maskin−manuell: {sum(d)/len(d):+.1f} cm")
        elif sf.ext == "fpr":
            ld = sf.loads()
            _p(f"Dellass: {len(ld)}")
        elif sf.ext in ("pin", "spi", "oin"):
            for p in sf.products():
                _p(f"  Produkt: {p['product_user_id']} «{p['name']}»")
            for s in sf.species_groups():
                _p(f"  Treslag: {s['species_group_user_id']} «{s['name']}»")
        else:
            _p("Elementer under Machine: " + ", ".join(f"{k}×{v}" for k, v in sf.element_counts().items()))


def cmd_export(a):
    sf = reader.open_file(a.fil)
    out = Path(a.ut)
    stem = Path(a.fil).name.split(".")[0]
    made = []
    if a.json:
        made.append(reader.write_json(sf.to_dict(), out / f"{stem}.json"))
    tables = {"stammer": sf.stems, "stokker": sf.logs, "sammendrag": sf.summary,
              "produkter": sf.products, "treslag": sf.species_groups}
    if sf.ext == "hqc":
        tables["kontroll"] = sf.control_comparison
    if sf.ext == "fpr":
        tables = {"lass": sf.loads, "produkter": sf.products, "treslag": sf.species_groups}
    for name, fn in tables.items():
        rows = fn()
        if rows:
            made.append(reader.write_csv(rows, out / f"{stem}_{name}.csv"))
    for p in made:
        _p(f"Skrev {p}")


def cmd_validate(a):
    bad = 0
    for f in a.filer:
        r = validate(parse_file(f), a.xsd)
        _p(f"== {f}\n{r}")
        bad += not r.ok
    sys.exit(1 if bad else 0)


def cmd_make(a):
    spec = json.loads(Path(a.spec).read_text(encoding="utf-8"))
    root = {"pin": writer.build_pin, "spi": writer.build_spi, "oin": writer.build_oin,
            "hpr": writer.build_hpr}[a.type](spec)
    r = validate(root)
    if not r.ok and not a.tving:
        _p(str(r)); _p("Fila ble IKKE skrevet. Bruk --tving for å skrive likevel.")
        sys.exit(1)
    p = write_file(root, a.ut, compressed=a.komprimer or None)
    _p(f"Skrev {p}" + ("" if r.ok and not r.warnings else f"\n{r}"))


def cmd_extract(a):
    res = writer.instructions_from_report(parse_file(a.fil), a.versjon)
    stem = Path(a.fil).name.split(".")[0]
    for ext, root in res.items():
        p = write_file(root, Path(a.ut) / f"{stem}.{ext}")
        _p(f"Skrev {p}  ({validate(root)})")


def cmd_simulate(a):
    from .simulator import simulate
    root = simulate(parse_file(a.pin), a.stammer, a.seed, a.objekt)
    p = write_file(root, a.ut)
    _p(f"Skrev simulert hpr: {p}")


def cmd_import(a):
    from .sync import import_folder
    for r in import_folder(a.kilde, a.arkiv, a.csv):
        _p(f"{r['status']:<16} {r['file']}" + (f"  -> {r['type']} maskin={r['machine']} objekt={r['object']}" if "type" in r else ""))


def cmd_exportdir(a):
    from .sync import export_folder
    for r in export_folder(a.filer, a.til, strict=not a.tving):
        _p(f"{r['status']:<10} {r['file']}" + (f"  {r['errors'][:3]}" if r.get("errors") else ""))


def cmd_server(a):
    from .rest_server import load_users, make_server
    users = load_users(a.brukere)
    if not users and not a.anonym:
        _p("Mangler --brukere users.json (eller --anonym for lokal testing)."); sys.exit(2)
    srv = make_server(a.lager, a.vert, a.port, users, a.anonym, a.cert, a.key)
    for m in a.maskin or []:
        mid, _, bids = m.partition(":")
        srv.store.register_machine(mid, [b for b in bids.split(",") if b])
    scheme = "https" if a.cert else "http"
    _p(f"StanForD REST-hub kjører på {scheme}://{a.vert}:{a.port}/File/v0.1  (lager: {a.lager})")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


def _client(a):
    from .rest_client import StanfordClient
    return StanfordClient(a.url, a.nokkel, cafile=getattr(a, "ca", None))


def cmd_pull(a):
    files = _client(a).pull_new(a.type, a.til, a.tilstand, a.timer,
                                BaseMachineManufacturerID=a.maskin, ObjectUserID=a.objekt)
    for f in files:
        _p(f"Hentet {f}")
    _p(f"{len(files)} nye filer")


def cmd_send(a):
    data = Path(a.fil).read_bytes()
    from .xmlio import decompress, parse_bytes
    r = validate(parse_bytes(decompress(data)))
    if not r.ok and not a.tving:
        _p(str(r)); _p("Ikke sendt."); sys.exit(1)
    _client(a).send_instruction(a.type, decompress(data), a.maskin, a.oppdragsgiver, Path(a.fil).name.rstrip("z"))
    _p(f"Sendt {a.fil} til " + (f"maskin {a.maskin}" if a.maskin else f"alle maskiner hos {a.oppdragsgiver or 'alle'}"))


def cmd_agent(a):
    from .sync import MachineAgent
    agent = MachineAgent(_client(a), a.maskin, a.eksportmappe, a.importmappe,
                         a.tilstand or Path(a.importmappe) / ".sf2010-agent.json")
    if a.simuler:
        _attach_simulator(agent, a)
    if a.en_gang:
        up, down = agent.run_once()
        _p(f"Lastet opp {up}, hentet {down}")
    else:
        _p(f"Agent for maskin {a.maskin} startet (hvert {a.intervall}. sekund). Ctrl+C for å stoppe.")
        agent.run_forever(a.intervall)


def _attach_simulator(agent, a):
    """Testmodus: når en pin kommer inn, 'hogg' og skriv hpr til eksportmappa."""
    from .simulator import simulate
    orig = agent.download_instructions

    def wrapped():
        n = orig()
        for pin in sorted(Path(agent.import_dir).glob("*.pin")):
            out = Path(agent.export_dir) / (pin.stem + "_sim.hpr")
            if not out.exists():
                write_file(simulate(parse_file(pin), 60, machine_key=a.maskin), out)
                import os, time
                old = time.time() - 3600
                os.utime(out, (old, old))
                agent.log(f"[simulator] hogde etter {pin.name} -> {out.name}")
        return n
    agent.download_instructions = wrapped


def main(argv=None):
    ap = argparse.ArgumentParser(prog="sf2010", description="Verktøy for StanForD 2010: lese, lage, validere og overføre filer til/fra hogstmaskiner.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("info", help="Vis innhold og sammendrag av en eller flere filer")
    s.add_argument("filer", nargs="+"); s.set_defaults(f=cmd_info)

    s = sub.add_parser("eksport", help="Eksporter til CSV (og JSON)")
    s.add_argument("fil"); s.add_argument("--ut", default="eksport"); s.add_argument("--json", action="store_true")
    s.set_defaults(f=cmd_export)

    s = sub.add_parser("valider", help="Regelsjekk (+ XSD med --xsd)")
    s.add_argument("filer", nargs="+"); s.add_argument("--xsd", help="Mappe med offisielle XSD-filer")
    s.set_defaults(f=cmd_validate)

    s = sub.add_parser("lag", help="Lag pin/spi/oin (eller hpr) fra JSON-spesifikasjon")
    s.add_argument("type", choices=["pin", "spi", "oin", "hpr"]); s.add_argument("spec")
    s.add_argument("--ut", required=True); s.add_argument("--komprimer", action="store_true")
    s.add_argument("--tving", action="store_true"); s.set_defaults(f=cmd_make)

    s = sub.add_parser("trekk-ut", help="Lag pin/spi fra definisjonene i en hpr (kopier oppsett)")
    s.add_argument("fil"); s.add_argument("--ut", default="."); s.add_argument("--versjon")
    s.set_defaults(f=cmd_extract)

    s = sub.add_parser("simuler", help="Simuler hogst etter en pin og skriv hpr")
    s.add_argument("pin"); s.add_argument("--ut", required=True); s.add_argument("--stammer", type=int, default=50)
    s.add_argument("--seed", type=int); s.add_argument("--objekt", default="SIM-OBJ-1"); s.set_defaults(f=cmd_simulate)

    s = sub.add_parser("importer", help="Les rapporter fra mappe/minnepinne inn i arkiv")
    s.add_argument("kilde"); s.add_argument("--arkiv", required=True); s.add_argument("--csv")
    s.set_defaults(f=cmd_import)

    s = sub.add_parser("til-mappe", help="Valider og legg instruksjoner i mappe/minnepinne for maskinen")
    s.add_argument("filer", nargs="+"); s.add_argument("--til", required=True); s.add_argument("--tving", action="store_true")
    s.set_defaults(f=cmd_exportdir)

    s = sub.add_parser("server", help="Start StanForD REST-hub")
    s.add_argument("--lager", default="sf2010-hub"); s.add_argument("--vert", default="127.0.0.1")
    s.add_argument("--port", type=int, default=8710); s.add_argument("--brukere")
    s.add_argument("--anonym", action="store_true", help="Ingen innlogging (kun lokal test)")
    s.add_argument("--maskin", action="append", help="Registrer maskin: ID[:oppdragsgiver1,oppdragsgiver2]")
    s.add_argument("--cert"); s.add_argument("--key"); s.set_defaults(f=cmd_server)

    def remote(sp):
        sp.add_argument("--url", required=True); sp.add_argument("--nokkel", help="API-nøkkel")
        sp.add_argument("--ca", help="CA-fil for egen-signert sertifikat")

    s = sub.add_parser("hent", help="Hent nye rapporter fra REST-hub")
    s.add_argument("type", help="HPR, HQC, MOM, FPR ..."); remote(s)
    s.add_argument("--til", default="innboks"); s.add_argument("--tilstand", default="innboks/.sett.json")
    s.add_argument("--timer", type=int, default=24); s.add_argument("--maskin"); s.add_argument("--objekt")
    s.set_defaults(f=cmd_pull)

    s = sub.add_parser("send", help="Send instruksjon (pin/spi/oin) til maskin via REST-hub")
    s.add_argument("type", help="PIN, SPI, OIN ..."); s.add_argument("fil"); remote(s)
    s.add_argument("--maskin"); s.add_argument("--oppdragsgiver"); s.add_argument("--tving", action="store_true")
    s.set_defaults(f=cmd_send)

    s = sub.add_parser("agent", help="Gateway på/ved maskinen: synk mapper mot REST-hub")
    remote(s); s.add_argument("--maskin", required=True)
    s.add_argument("--eksportmappe", required=True, help="Der maskinen legger hpr/hqc/mom")
    s.add_argument("--importmappe", required=True, help="Der maskinen henter pin/spi/oin")
    s.add_argument("--tilstand"); s.add_argument("--intervall", type=float, default=60)
    s.add_argument("--en-gang", action="store_true"); s.add_argument("--simuler", action="store_true",
                                                                     help="Testmodus: simuler hogst når pin kommer")
    s.set_defaults(f=cmd_agent)

    a = ap.parse_args(argv)
    from .rest_client import StanfordRestError
    try:
        a.f(a)
    except StanfordRestError as e:
        print(f"Feil fra server: {e}", file=sys.stderr)
        sys.exit(1)
    except OSError as e:
        print(f"Feil: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
