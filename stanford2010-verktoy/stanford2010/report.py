"""Rapport fra analysen: én selvstendig HTML-fil (ingen eksterne avhengigheter) eller tekst.

    from stanford2010.analysis import analyze_files
    from stanford2010.report import render_html, render_text
    res = analyze_files(["objekt.hpr", "uke12.mom"])
    Path("rapport.html").write_text(render_html(res), encoding="utf-8")
"""
from __future__ import annotations

import html
import math
from datetime import datetime

from .analysis import HQC_TOLERANCE

# Kategorifarger (fast rekkefølge, validert for fargeblinde: de tre første holder for alle par)
SERIES = ["--c1", "--c2", "--c3"]
OTHER = "--c-other"


def fmt(x, d=1, unit=""):
    if x is None or x == "":
        return "–"
    if isinstance(x, (int, float)):
        s = f"{x:,.{d}f}".replace(",", " ").replace(".", ",")
        if s.startswith("-"):
            s = "−" + s[1:]
    else:
        s = str(x)
    return s + (f" {unit}" if unit else "")


def pct(x, d=0):
    return "–" if x is None else fmt(x * 100, d, "%")


def e(s) -> str:
    return html.escape("" if s is None else str(s))


def _table(cols, rows, total=None, cls="") -> str:
    """cols: [(overskrift, nøkkel|funksjon, 'n' for tall)]"""
    def cell(c, r):
        v = c[1](r) if callable(c[1]) else r.get(c[1])
        return f'<td class="{c[2] if len(c) > 2 else ""}">{v if isinstance(v, str) and v.startswith("<") else e(v) if isinstance(v, str) else e(fmt(v, c[3] if len(c) > 3 else 1))}</td>'
    head = "".join(f'<th class="{c[2] if len(c) > 2 else ""}">{e(c[0])}</th>' for c in cols)
    body = "".join("<tr>" + "".join(cell(c, r) for c in cols) + "</tr>" for r in rows)
    if total:
        body += '<tr class="tot">' + "".join(cell(c, total) for c in cols) + "</tr>"
    return f'<div class="tbl {cls}"><table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'


def _facts(items) -> str:
    out = []
    for k, v, *sub in items:
        out.append(f'<div class="fact"><div class="k">{e(k)}</div><div class="v">{v}</div>'
                   + (f'<div class="s">{e(sub[0])}</div>' if sub and sub[0] else "") + "</div>")
    return '<div class="facts">' + "".join(out) + "</div>"


def _sharebar(x):
    if x is None:
        return "–"
    return (f'<span class="sb"><span style="width:{max(0, min(1, x)) * 100:.1f}%"></span></span>'
            f'<span class="sbv">{pct(x)}</span>')


# ---------- SVG-diagrammer ----------

def _nice_max(v):
    if v <= 0:
        return 1
    p = 10 ** math.floor(math.log10(v))
    for m in (1, 2, 2.5, 5, 10):
        if v <= m * p:
            return m * p
    return 10 * p


def bar_chart(labels, series, names=None, unit="", height=220, colors=None, label_every=1, wide=False) -> str:
    """Søylediagram, stablet hvis flere serier. series: liste av lister (én per serie)."""
    n = len(labels)
    if not n:
        return ""
    colors = colors or SERIES
    totals = [sum(s[i] or 0 for s in series) for i in range(n)]
    ymax = _nice_max(max(totals) or 1)
    W, H, L, B, T = (1100, 240, 44, 28, 10) if wide else (640, height, 44, 28, 10)
    bw = (W - L - 6) / n
    gap = max(min(6, bw * 0.25), bw - 64)  # maks 64 px brede søyler
    parts = []
    for k in range(5):
        y = T + (H - T - B) * (1 - k / 4)
        parts.append(f'<line class="grid" x1="{L}" x2="{W}" y1="{y:.1f}" y2="{y:.1f}"/>'
                     f'<text class="ax" x="{L - 6}" y="{y + 4:.1f}" text-anchor="end">{e(fmt(ymax * k / 4, 0 if (ymax * k / 4).is_integer() else 1))}</text>')
    for i, lab in enumerate(labels):
        x = L + i * bw + gap / 2
        y0 = H - B
        for si, s in enumerate(series):
            v = s[i] or 0
            if v <= 0:
                continue
            h = (H - T - B) * v / ymax
            top = si == len(series) - 1 or all((series[j][i] or 0) <= 0 for j in range(si + 1, len(series)))
            r = min(4, (bw - gap) / 2) if top else 0
            col = colors[si] if si < len(colors) else OTHER
            tip = f"{lab}: {(names[si] + ' ') if names else ''}{fmt(v, 2)} {unit}".strip()
            parts.append(_rbar(x, y0 - h, bw - gap, h, r, col, tip))
            y0 -= h + (1 if len(series) > 1 else 0)
        if i % label_every == 0:
            parts.append(f'<text class="ax" x="{x + (bw - gap) / 2:.1f}" y="{H - B + 16}" text-anchor="middle">{e(lab)}</text>')
    legend = ""
    if names and len(names) > 1:
        legend = '<div class="legend">' + "".join(
            f'<span><i style="background:var({colors[i] if i < len(colors) else OTHER})"></i>{e(nm)}</span>'
            for i, nm in enumerate(names)) + "</div>"
    return (f'<figure class="chart"><svg viewBox="0 0 {W} {H}" role="img" preserveAspectRatio="xMidYMid meet">'
            + "".join(parts) + f"</svg>{legend}</figure>")


def _rbar(x, y, w, h, r, col, tip):
    r = min(r, h)
    if r <= 0:
        path = f"M{x:.1f},{y + h:.1f}V{y:.1f}H{x + w:.1f}V{y + h:.1f}Z"
    else:
        path = (f"M{x:.1f},{y + h:.1f}V{y + r:.1f}Q{x:.1f},{y:.1f} {x + r:.1f},{y:.1f}"
                f"H{x + w - r:.1f}Q{x + w:.1f},{y:.1f} {x + w:.1f},{y + r:.1f}V{y + h:.1f}Z")
    return f'<path d="{path}" style="fill:var({col})"><title>{e(tip)}</title></path>'


def hbar_list(rows, label_key, value_key, unit="", d=1) -> str:
    vmax = max((r.get(value_key) or 0 for r in rows), default=0) or 1
    out = []
    for r in rows:
        v = r.get(value_key) or 0
        out.append(f'<div class="hb"><span class="hl">{e(r.get(label_key))}</span>'
                   f'<span class="ht"><span style="width:{v / vmax * 100:.1f}%"></span></span>'
                   f'<span class="hv">{e(fmt(v, d, unit))}</span></div>')
    return '<div class="hbars">' + "".join(out) + "</div>"


def stem_map(points, species_order) -> str:
    pts = [p for p in points if p["lat"] and p["lon"]]
    if len(pts) < 2:
        return ""
    lat0 = sum(p["lat"] for p in pts) / len(pts)
    k = math.cos(math.radians(lat0))
    xs = [p["lon"] * k for p in pts]
    ys = [p["lat"] for p in pts]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    span = max(x1 - x0, y1 - y0, 20 / 111_000)  # minst 20 m utsnitt
    W, Hmax = 640, 460
    sc = min((W - 40) / max(x1 - x0, span * 0.25), (Hmax - 40) / max(y1 - y0, span * 0.25))
    H = max(180, (y1 - y0) * sc + 40)
    x0 -= ((W - 40) / sc - (x1 - x0)) / 2 - 10 / sc
    y0 -= ((H - 40) / sc - (y1 - y0)) / 2 - 10 / sc
    col = {sp: SERIES[i] if i < 3 else OTHER for i, sp in enumerate(species_order)}
    vmax = max(p["m3"] or 0 for p in pts) or 1
    dots = []
    for p, x, y in zip(pts, xs, ys):
        cx, cy = 10 + (x - x0) * sc, H - 20 - (y - y0) * sc
        rr = 2.5 + 4 * math.sqrt((p["m3"] or 0) / vmax)
        dots.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{rr:.1f}" style="fill:var({col.get(p["sp"], OTHER)})">'
                    f'<title>Stamme {e(p["n"])}: {e(p["sp"])}, {e(fmt(p["dbh"], 0))} mm, {e(fmt(p["m3"], 3))} m³fub</title></circle>')
    # målestokk
    m_per_unit = 111_000
    bar_m = _nice_max(span * m_per_unit / 4)
    bar_px = bar_m / m_per_unit * sc
    legend = '<div class="legend">' + "".join(
        f'<span><i style="background:var({col[sp]})"></i>{e(sp)}</span>' for sp in species_order[:4]) + "</div>"
    return (f'<figure class="chart map"><svg viewBox="0 0 {W} {H:.0f}" role="img">{"".join(dots)}'
            f'<line class="scale" x1="{W - 20 - bar_px:.1f}" x2="{W - 20}" y1="{H - 8:.0f}" y2="{H - 8:.0f}"/>'
            f'<text class="ax" x="{W - 20}" y="{H - 14:.0f}" text-anchor="end">{e(fmt(bar_m, 0))} m</text>'
            f"</svg>{legend}</figure>")


def histogram(hist, tol=None, unit="") -> str:
    if not hist:
        return ""
    labels = [fmt(h["from"], 0) for h in hist]
    # Avvikene er heltall (cm/mm) og klassene 1 bred, så klassens nedre grense er verdien
    inside = [h["n"] if tol is not None and abs(h["from"]) <= tol else 0 for h in hist]
    outside = [h["n"] - i for h, i in zip(hist, inside)]
    every = max(1, len(hist) // 12)
    if tol is None:
        return bar_chart(labels, [outside], unit=unit, label_every=every)
    return bar_chart(labels, [inside, outside], [f"Innenfor ±{fmt(tol, 0)} {unit}", "Utenfor"], "stokker",
                     colors=["--c1", "--c2"], label_every=every)


# ---------- seksjoner ----------

def _head(a) -> str:
    m = a.get("machine") or {}
    mach = " ".join(filter(None, [m.get("manufacturer"), m.get("model")])) or "Ukjent maskin"
    obj = "; ".join(f"{o['object_user_id'] or ''} {('«' + o['name'] + '»') if o['name'] else ''}".strip()
                    for o in a.get("objects", [])) or "–"
    return (f'<header class="fh"><div><span class="pill">{e(a["ext"])}</span> <strong>{e(a["file"])}</strong></div>'
            f'<div class="meta">{e(a.get("type_name") or "")} · StanForD {e(a.get("version"))} · {e(mach)}'
            f'{(" · " + e(m.get("manufacturer_id"))) if m.get("manufacturer_id") else ""} · Objekt: {e(obj)}</div></header>')


def _notes(notes, cls="warn"):
    if not notes:
        return ""
    return '<ul class="msgs">' + "".join(f'<li class="{cls}">{e(n)}</li>' for n in notes) + "</ul>"


def section_hpr(a) -> str:
    o = a["overview"]
    sp = a["species_order"]
    facts = [
        ("Stammer", fmt(o["stems"], 0), f"{fmt(o['logs'], 0)} stokker"),
        ("Volum", fmt(o["m3sub"], 1, "m³fub"), f"{fmt(o['m3sob'], 1)} m³pb"),
        ("Middelstamme", fmt(o["mean_stem_m3sub"], 3, "m³fub"), f"Snitt DBH {fmt(o['mean_dbh_mm'], 0)} mm"),
        ("Stokker per stamme", fmt(o["logs_per_stem"], 2), f"Snittlengde {fmt(o['mean_log_length_cm'], 0)} cm"),
    ]
    if o["m3_per_hour_est"]:
        facts.append(("Produktivitet (anslag)", fmt(o["m3_per_hour_est"], 1, "m³/t"),
                      f"{fmt(o['stems_per_hour_est'], 0)} stammer/t, {fmt(o['productive_hours_est'], 1)} t"))
    if o["value"] is not None:
        facts.append(("Verdi (prismatrise)", fmt(o["value"], 0, "kr"), f"{fmt(o['value_per_m3'], 0)} kr/m³fub"))
    if o["m3sub_per_ha"]:
        facts.append(("Uttak per ha (anslag)", fmt(o["m3sub_per_ha"], 0, "m³/ha"),
                      f"{fmt(o['stems_per_ha'], 0)} stammer/ha på {fmt(o['area_hull_ha'], 1)} ha"))
    if o["first"]:
        facts.append(("Periode", e(o["first"][:10]) + (f" – {e(o['last'][:10])}" if o["last"][:10] != o["first"][:10] else ""),
                      f"{o['days']} hogstdager"))
    out = [_facts(facts), _notes(a["notes"])]

    out.append('<div class="grid2"><div class="panel"><h3>Volum per treslag</h3>' + _table(
        [("Treslag", "key"), ("Stammer", "stems", "n", 0), ("m³fub", "m3sub", "n", 1),
         ("Andel", lambda r: _sharebar(r["share"]), "w"), ("Middelstamme", "mean_stem_m3sub", "n", 3),
         ("DBH mm", "mean_dbh_mm", "n", 0)],
        a["per_species"], {"key": "Sum", "stems": o["stems"], "m3sub": o["m3sub"], "share": 1,
                           "mean_stem_m3sub": o["mean_stem_m3sub"], "mean_dbh_mm": o["mean_dbh_mm"]}) + "</div>")
    dd = a["dbh_distribution"]
    names = sp[:3] + (["Annet"] if len(sp) > 3 else [])
    series = [[d["by_species"].get(s, {}).get("stems", 0) for d in dd] for s in sp[:3]]
    if len(sp) > 3:
        series.append([sum(v["stems"] for k, v in d["by_species"].items() if k not in sp[:3]) for d in dd])
    out.append('<div class="panel"><h3>Diameterfordeling (brysthøyde, stammer per 2 cm-klasse)</h3>'
               + bar_chart([fmt(d["from_mm"] / 10, 0) for d in dd], series, names, "stammer",
                           label_every=max(1, len(dd) // 14)) + '<p class="hint">Klasse i cm, nedre grense.</p></div></div>')

    out.append('<div class="panel"><h3>Sortiment</h3>' + _table(
        [("Produkt", "product"), ("Treslag", "species"), ("Gruppe", "group"), ("Stokker", "logs", "n", 0),
         ("m³fub", "m3sub", "n", 2), ("Andel", lambda r: _sharebar(r["share"]), "w"),
         ("Snittlengde cm", "mean_length_cm", "n", 0), ("m³ per stokk", "mean_log_m3sub", "n", 3),
         ("Verdi kr", "value", "n", 0), ("kr/m³", "value_per_m3", "n", 0)], a["per_product"]) + "</div>")

    if a["assortment"]:
        out.append('<div class="panel"><h3>Apteringsutfall i prismatrisen</h3><p class="hint">Antall stokker per '
                   'diameter- og lengdeklasse. Mørkere celle = flere stokker. Rød kant = celle merket som forbudt. '
                   'Hold musa over en celle for volum og pris.</p>' +
                   "".join(_matrix(m) for m in a["assortment"][:8]) + "</div>")

    if len(a["per_day"]) > 1:
        out.append('<div class="panel"><h3>Produksjon per dag (m³fub)</h3>' + bar_chart(
            [d["key"][5:] for d in a["per_day"]], [[d["m3sub"] for d in a["per_day"]]], unit="m³fub",
            label_every=max(1, len(a["per_day"]) // 24), wide=True) + "</div>")
    cols = [("Fører", "key"), ("Stammer", "stems", "n", 0), ("m³fub", "m3sub", "n", 1),
            ("Middelstamme", "mean_stem_m3sub", "n", 3), ("Timer (anslag)", "hours", "n", 1),
            ("m³/t", "m3_per_hour", "n", 1), ("Stammer/t", "stems_per_hour", "n", 0)]
    grid = ['<div class="grid2">']
    if a["per_operator"]:
        grid.append('<div class="panel"><h3>Per fører</h3>' + _table(cols, a["per_operator"]) + "</div>")
    grid.append('<div class="panel"><h3>Kappårsaker</h3>' + hbar_list(a["cutting_reasons"], "reason", "logs", "stokker", 0) + "</div>")
    grid.append("</div>")
    out.append("".join(grid))
    if a["per_sub_object"] and len(a["per_sub_object"]) > 1:
        out.append('<div class="panel"><h3>Per delobjekt</h3>' + _table([("Delobjekt", "key")] + cols[1:4], a["per_sub_object"]) + "</div>")
    if a["points"]:
        out.append('<div class="panel"><h3>Stammekart</h3>' + stem_map(a["points"], sp) +
                   '<p class="hint">Punkt per stamme, størrelse etter volum. Posisjonen er maskinens (eller kranspissens) posisjon ved felling.</p></div>')
    q = a["quality"]
    out.append('<div class="panel"><h3>Datakvalitet</h3><dl class="kv">' + "".join(
        f"<dt>{e(k)}</dt><dd>{e(v)}</dd>" for k, v in [
            ("Manglende stammenummer", q["stem_number_gaps"]), ("Dupliserte StemKey", q["duplicate_stem_keys"]),
            ("Stammer uten koordinater", q["stems_without_coordinates"]), ("Stammer uten tidspunkt", q["stems_without_time"]),
            ("Upparbeidede stammer uten stokker", q["stems_without_logs"]),
            ("Stokker med ukjent produkt", q["logs_unknown_product"]), ("Stokker uten volum", q["logs_zero_volume"]),
            ("Stokker utenfor prismatrisen", sum(q["logs_outside_matrix"].values())),
            ("Stokker i forbudte celler", sum(q["logs_in_forbidden_cells"].values()))]) + "</dl></div>")
    return "".join(out)


def _matrix(m) -> str:
    cells = {(c["d"], c["l"]): c for c in m["cells"]}
    ds = [d for d in m["diameters"] if any(k[0] == d for k in cells)] or m["diameters"]
    ls = m["lengths"]
    nmax = max(c["n"] for c in m["cells"]) or 1
    rows = []
    for d in ds:
        tds = []
        for l in ls:
            c = cells.get((d, l))
            n = c["n"] if c else 0
            a = 0 if not n else 0.15 + 0.75 * n / nmax
            cls = "fb" if c and c["forbidden"] else ""
            tip = f"{d} mm × {l} cm: {n} stokker" + (f", {fmt(c['m3'], 2)} m³, pris {fmt(c['price'], 0)}" if c else "")
            tds.append(f'<td class="mc {cls}" style="--a:{a:.2f}" title="{e(tip)}">{n or ""}</td>')
        rows.append(f'<tr><th class="rowh">{d}</th>{"".join(tds)}</tr>')
    head = "".join(f"<th>{l}</th>" for l in ls)
    total = sum(c["n"] for c in m["cells"])
    bark = "under bark" if m["under_bark"] else "på bark"
    return (f'<h4>{e(m["product"])} <span class="hint">· {total} stokker · diameter ({e(m["category"]).lower()}, {bark}) mm × lengde cm</span></h4>'
            f'<div class="tbl matrix"><table><thead><tr><th class="rowh">mm \\ cm</th>{head}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>')


def section_hqc(a) -> str:
    o = a["overview"]
    tol = a["tolerance"]
    lv = a["variables"][0]
    facts = [("Kontrollstammer", fmt(o["control_stems"], 0), f"{fmt(o['control_logs'], 0)} stokker")]
    for v in a["variables"]:
        if v["n"]:
            pill = '<span class="pill ok">✓ godkjent</span>' if v.get("pass") else '<span class="pill err">✗ ikke godkjent</span>'
            facts.append((v["label"], f"{fmt(v['mean'], 1)} <small>snitt</small>",
                          f"sd {fmt(v['sd'], 1)} · {pct(v['within'])} innenfor ±{fmt(v['tol'], 0)}"))
            facts[-1] = (facts[-1][0], facts[-1][1] + " " + pill, facts[-1][2])
    if o["volume_diff_pct_mean"] is not None:
        facts.append(("Volumavvik per stamme", fmt(o["volume_diff_pct_mean"], 1, "%"), f"sd {fmt(o['volume_diff_pct_sd'], 1)} %"))
    out = [_facts(facts)]
    if not lv["n"]:
        out.append(_notes(["Fila har ingen stokker med både maskinmål og manuelt kontrollmål."], "warn"))
    out.append(_notes(a["advice"], "warn"))
    out.append(f'<p class="hint">Avvik = maskin − manuelt mål. Krav brukt: lengde {pct(tol["length_share"])} innenfor '
               f'±{fmt(tol["length_cm"], 0)} cm og standardavvik maks {fmt(tol["length_sd_cm"], 0)} cm; diameter '
               f'{pct(tol["diameter_share"])} innenfor ±{fmt(tol["diameter_mm"], 0)} mm. Sjekk mot avtalen som gjelder.</p>')
    if lv["n"]:
        out.append('<div class="grid2">')
        for v in a["variables"][:3]:
            out.append(f'<div class="panel"><h3>Fordeling av avvik: {e(v["label"])}</h3>{histogram(v["histogram"], v["tol"], v["unit"])}</div>')
        out.append("</div>")
        out.append('<div class="panel"><h3>Alle måleverdier</h3>' + _table(
            [("Variabel", "label"), ("Antall", "n", "n", 0), ("Snitt", "mean", "n", 2), ("Std.avvik", "sd", "n", 2),
             ("Min", "min", "n", 0), ("Maks", "max", "n", 0), ("Innenfor toleranse", lambda r: _sharebar(r.get("within")), "w"),
             ("Krav", lambda r: pct(r["required_share"]), "n"),
             ("Status", lambda r: '<span class="pill ok">OK</span>' if r.get("pass") else '<span class="pill err">Ikke OK</span>')],
            [v for v in a["variables"] if v["n"]]) + "</div>")
        if len(a["per_product"]) > 1:
            out.append('<div class="panel"><h3>Lengdeavvik per produkt</h3>' + _table(
                [("Produkt", "product"), ("Stokker", "n", "n", 0), ("Snitt cm", "mean", "n", 1), ("Std.avvik", "sd", "n", 1),
                 ("Innenfor ±" + fmt(tol["length_cm"], 0) + " cm", lambda r: _sharebar(r.get("within")), "w")], a["per_product"]) + "</div>")
    if a["calibrations"]:
        out.append('<div class="panel"><h3>Kalibreringshistorikk</h3>' + _table(
            [("Dato", lambda r: (r["date"] or "")[:16].replace("T", " ")), ("Type", "kind"), ("Treslag", "species"),
             ("Justering", "adjustment", "n", 0), ("Rotstokk", "butt_log", "n", 0), ("Årsak", "reason")],
            a["calibrations"][-30:]) + "</div>")
    return "".join(out)


def section_mom(a) -> str:
    o = a["overview"]
    facts = [
        ("Maskintid", fmt(o["work_h"], 1, "t"), f"{fmt(o['run_h'], 1)} t drift"),
        ("G15-tid", fmt(o["g15_h"], 1, "t"), f"Effektiv {fmt(o['effective_h'], 1)} t"),
        ("Teknisk utnyttelse", pct(o["technical_utilisation"]), f"{fmt(o['down_h'], 1)} t stopp"),
        ("Drivstoff", fmt(o["fuel_l"], 0, "l"), f"{fmt(o['fuel_per_engine_h'], 1)} l per motortime"),
    ]
    if o["m3sub"]:
        facts += [("Produksjon", fmt(o["m3sub"], 0, "m³fub"), f"{fmt(o['stems'], 0)} stammer"),
                  ("Produktivitet", fmt(o["m3_per_g15h"], 1, "m³/G15-t"), f"{fmt(o['stems_per_g15h'], 0)} stammer/G15-t"),
                  ("Drivstoff per m³", fmt(o["fuel_per_m3"], 2, "l/m³"), f"{fmt(o['fuel_per_g15h'], 1)} l/G15-t")]
    if o["forwarded_m3"]:
        facts += [("Kjørt fram", fmt(o["forwarded_m3"], 0, "m³"), f"{fmt(o['loads'], 0)} lass"),
                  ("Drivstoff per m³", fmt(o["fuel_per_m3"], 2, "l/m³"), "")]
    if o["distance_km"]:
        facts.append(("Kjørt distanse", fmt(o["distance_km"], 1, "km"), ""))
    if o["first"]:
        facts.append(("Periode", e(o["first"][:10]) + " – " + e(o["last"][:10]), f"{o['records']} tidsavsnitt"))
    s = a.get("settings") or {}
    out = [_facts(facts)]
    out.append(f'<p class="hint">Format: {e(a["format"])} driftsoppfølging. Maskinens filter: avbrudd kortere enn '
               f'{fmt(s.get("filter_down_s"), 0)} s regnes som driftstid. G15 = driftstid + stopp og pauser på maks 15 minutter. '
               f'Effektiv tid = driftstid uten korte avbrudd ({fmt(o["short_h"], 1)} t).</p>')
    cats = a["time_categories"]
    order = ["Drift", "Stopp", "Stillestående"]
    out.append('<div class="grid2"><div class="panel"><h3>Tidsfordeling</h3>')
    for cl, var in zip(order, ["--c1", "--c2", "--c3"]):
        rows = [c for c in cats if c["class"] == cl]
        if rows:
            tot = sum(r["hours"] for r in rows)
            out.append(f'<h4><i class="dot" style="background:var({var})"></i>{e(cl)} · {e(fmt(tot, 1, "t"))}</h4>'
                       + hbar_list(rows, "category", "hours", "t", 1).replace('class="hbars"', f'class="hbars" style="--bar:var({var})"'))
    out.append("</div>")
    if a["downtime"]:
        out.append('<div class="panel"><h3>Største stopp</h3>' + _table(
            [("Type", "type"), ("Årsak", "detail"), ("Timer", "hours", "n", 2)], a["downtime"][:15]) + "</div>")
    out.append("</div>")
    days = [d for d in a["per_day"] if d["key"] != "Ukjent"]
    if len(days) > 1:
        out.append('<div class="panel"><h3>Timer per dag</h3>' + bar_chart(
            [d["key"][5:] for d in days], [[d["run_h"] for d in days], [d["down_h"] for d in days], [d["idle_h"] for d in days]],
            ["Drift", "Stopp", "Stillestående"], "t", label_every=max(1, len(days) // 24), wide=True) + "</div>")
    cols = [("", "key"), ("Drift t", "run_h", "n", 1), ("G15 t", "g15_h", "n", 1), ("Stopp t", "down_h", "n", 1),
            ("Drivstoff l", "fuel_l", "n", 0)]
    if o["m3sub"]:
        cols += [("m³fub", "m3sub", "n", 1), ("m³/G15-t", "m3_per_g15h", "n", 1), ("l/m³", "fuel_per_m3", "n", 2)]
    for title, key in (("Per fører", "per_operator"), ("Per objekt", "per_object"), ("Per dag", "per_day")):
        if len(a[key]) > 1 or key == "per_operator":
            out.append(f'<div class="panel"><h3>{title}</h3>' + _table(cols, a[key]) + "</div>")
    return "".join(out)


def section_fpr(a) -> str:
    o = a["overview"]
    out = [_facts([
        ("Lass", fmt(o["loads"], 0), f"{fmt(o['partial_loads'], 0)} dellass"),
        ("Volum", fmt(o["m3"], 0, "m³"), ""),
        ("Snitt lass", fmt(o["mean_load_m3"], 1, "m³"), f"Største {fmt(o['max_load_m3'], 1)} m³"),
        ("Snitt kjøreavstand", fmt(o["mean_distance_m"], 0, "m"), "Fra forrige lossing"),
        ("Vekt", fmt(o["green_mass_t"], 1, "tonn") if o["green_mass_t"] else "–", "Rå vekt (vekt på kran)"),
        ("Periode", e((o["first"] or "")[:10]) + " – " + e((o["last"] or "")[:10]), ""),
    ])]
    out.append('<div class="panel"><h3>Per leveranse / sortiment</h3>' + _table(
        [("Leveranse", "delivery"), ("Lass", "loads", "n", 0), ("m³", "m3", "n", 1),
         ("Andel", lambda r: _sharebar(r["share"]), "w"), ("Tonn", "green_mass_t", "n", 1)], a["per_delivery"]) + "</div>")
    if len(a["per_day"]) > 1:
        out.append('<div class="panel"><h3>Volum per dag</h3>' + bar_chart(
            [d["key"][5:] for d in a["per_day"]], [[d["m3"] for d in a["per_day"]]], unit="m³",
            label_every=max(1, len(a["per_day"]) // 24), wide=True) + "</div>")
    if a["load_volume_distribution"]:
        out.append('<div class="panel"><h3>Lasstørrelse (antall lass per 2 m³-klasse)</h3>' + bar_chart(
            [fmt(h["from"], 0) for h in a["load_volume_distribution"]], [[h["n"] for h in a["load_volume_distribution"]]],
            unit="lass") + "</div>")
    return "".join(out)


SECTIONS = {"hpr": section_hpr, "hqc": section_hqc, "mom": section_mom, "fpr": section_fpr}


def section_combined(c) -> str:
    out = []
    if len(c["objects"]) > 1:
        out.append('<div class="panel"><h3>Hogstobjekter (nyeste hpr per maskin og objekt)</h3>' + _table(
            [("Maskin", "machine"), ("Objekt", "object"), ("Navn", "name"), ("Stammer", "stems", "n", 0),
             ("m³fub", "m3sub", "n", 1), ("Middelstamme", "mean_stem_m3sub", "n", 3),
             ("m³/t (anslag)", "m3_per_hour_est", "n", 1), ("kr/m³", "value_per_m3", "n", 0),
             ("Fra", lambda r: (r["first"] or "")[:10]), ("Til", lambda r: (r["last"] or "")[:10])], c["objects"]) + "</div>")
    if c["machine_links"]:
        out.append('<div class="panel"><h3>Hpr koblet mot mom (samme maskin)</h3>' + _table(
            [("Maskin", "machine"), ("hpr", "hpr_files", "n", 0), ("mom", "mom_files", "n", 0), ("m³fub", "m3sub", "n", 1),
             ("G15 t", "g15_h", "n", 1), ("m³/G15-t", "m3_per_g15h", "n", 1), ("Drivstoff l", "fuel_l", "n", 0),
             ("l/m³", "fuel_per_m3", "n", 2)], c["machine_links"]) +
            '<p class="hint">Forutsetter at hpr og mom dekker samme periode.</p></div>')
    return "".join(out)


CSS = """
:root{--bg:#f4f6f3;--surface:#fff;--sunk:#eaeee8;--fg:#1b2420;--muted:#5a665f;--line:#d5dbd4;--accent:#2f6b45;--accent-soft:#e1ede4;
--warn:#8a5e00;--warn-soft:#fbf1d9;--err:#b3261e;--err-soft:#fbe5e3;--ok:#2f6b45;
--c1:#2a78d6;--c2:#eb6834;--c3:#1baf7a;--c-other:#9aa39d;--heat:#2a78d6}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#131815;--surface:#1a201c;--sunk:#101411;--fg:#e3e9e5;--muted:#99a59d;--line:#2d3530;
--accent:#7cc192;--accent-soft:#1f3226;--warn:#e3b54e;--warn-soft:#352b14;--err:#f08a80;--err-soft:#3a1d1a;--ok:#7cc192;
--c1:#3987e5;--c2:#d95926;--c3:#199e70;--c-other:#66706a;--heat:#3987e5;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#131815;--surface:#1a201c;--sunk:#101411;--fg:#e3e9e5;--muted:#99a59d;--line:#2d3530;
--accent:#7cc192;--accent-soft:#1f3226;--warn:#e3b54e;--warn-soft:#352b14;--err:#f08a80;--err-soft:#3a1d1a;--ok:#7cc192;
--c1:#3987e5;--c2:#d95926;--c3:#199e70;--c-other:#66706a;--heat:#3987e5;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:20px 16px 48px}
main{max-width:1180px;margin:0 auto;display:grid;gap:18px}
h1{font:700 1.6rem/1.2 Georgia,serif;margin:0}
h2{font:600 1.2rem Georgia,serif;margin:0}
h3{font:600 .74rem ui-monospace,Menlo,monospace;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}
h4{font-size:.95rem;margin:14px 0 6px}
.sub,.hint{color:var(--muted)} .hint{font-size:.82rem;margin:6px 0 0}
section.file{display:grid;gap:14px;border-top:1px solid var(--line);padding-top:18px}
.fh{display:grid;gap:2px} .fh .meta{color:var(--muted);font-size:.9rem}
.pill{display:inline-block;font:600 .72rem ui-monospace,monospace;padding:2px 8px;border-radius:99px;background:var(--sunk);color:var(--muted);text-transform:uppercase;vertical-align:middle}
.pill.ok{background:var(--accent-soft);color:var(--ok);text-transform:none}.pill.err{background:var(--err-soft);color:var(--err);text-transform:none}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,170px),1fr));gap:10px}
.fact{background:var(--surface);border:1px solid var(--line);border-radius:9px;padding:10px 12px;min-width:0}
.fact .k{font:600 .7rem ui-monospace,monospace;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
.fact .v{font:600 1.3rem Georgia,serif;font-variant-numeric:tabular-nums}.fact .v small{font:400 .8rem system-ui;color:var(--muted)}
.fact .s{font-size:.82rem;color:var(--muted)}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:16px;min-width:0}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr));gap:14px}
.tbl{overflow-x:auto;border:1px solid var(--line);border-radius:8px}
table{border-collapse:collapse;width:100%;font-size:.86rem}
th,td{padding:5px 9px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
th{font:600 .7rem ui-monospace,monospace;letter-spacing:.03em;text-transform:uppercase;color:var(--muted);background:var(--sunk)}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums} tr.tot td{font-weight:700;border-top:2px solid var(--line)}
td.w{min-width:130px}
.sb{display:inline-block;width:70px;height:8px;background:var(--sunk);border-radius:4px;vertical-align:middle;margin-right:6px;overflow:hidden}
.sb span{display:block;height:100%;background:var(--accent);border-radius:4px}.sbv{font-variant-numeric:tabular-nums;font-size:.82rem}
.matrix td.mc{text-align:center;min-width:2.4em;background:color-mix(in srgb,var(--heat) calc(var(--a)*100%),transparent);font-variant-numeric:tabular-nums}
.matrix td.mc.fb{outline:2px solid var(--err);outline-offset:-2px}
.matrix th.rowh{position:sticky;left:0;z-index:1}
.chart{margin:0}.chart svg{width:100%;height:auto;display:block}
.chart .grid{stroke:var(--line);stroke-width:1}.chart .ax{fill:var(--muted);font-size:11px}
.chart path,.chart circle{stroke:var(--surface);stroke-width:1}.chart path:hover,.chart circle:hover{opacity:.8}
.chart .scale{stroke:var(--fg);stroke-width:2}
.map svg{background:var(--sunk);border-radius:8px}
.legend{display:flex;flex-wrap:wrap;gap:14px;font-size:.84rem;margin-top:8px}
.legend i,.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;vertical-align:middle}
.hbars{display:grid;gap:6px}.hb{display:grid;grid-template-columns:minmax(0,38%) 1fr auto;gap:10px;align-items:center;font-size:.88rem}
.hl{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ht{height:10px;background:var(--sunk);border-radius:5px;overflow:hidden}
.ht span{display:block;height:100%;background:var(--bar,var(--accent));border-radius:5px}.hv{font-variant-numeric:tabular-nums;color:var(--muted)}
.msgs{list-style:none;margin:0;padding:0;display:grid;gap:6px}.msgs li{padding:7px 11px;border-radius:6px;font-size:.92rem}
.msgs li.warn{background:var(--warn-soft);color:var(--warn)}.msgs li.err{background:var(--err-soft);color:var(--err)}
dl.kv{display:grid;grid-template-columns:max-content 1fr;gap:3px 14px;margin:0;font-size:.9rem}dl.kv dt{color:var(--muted)}dl.kv dd{margin:0;font-variant-numeric:tabular-nums}
nav.toc{display:flex;flex-wrap:wrap;gap:6px}nav.toc a{font-size:.85rem;color:var(--fg);text-decoration:none;border:1px solid var(--line);background:var(--surface);border-radius:99px;padding:3px 11px}
footer{color:var(--muted);font-size:.8rem}
@media print{body{background:#fff}.panel,.fact{break-inside:avoid}}
"""


def render_html(result: dict, title: str = "Analyse av skogsmaskinfiler") -> str:
    files = result["files"]
    parts = [f"<header><h1>{e(title)}</h1><p class='sub'>{len(files)} fil(er) analysert "
             f"{datetime.now().strftime('%d.%m.%Y %H:%M')} · StanForD 2010</p></header>"]
    if len(files) > 1:
        parts.append('<nav class="toc">' + "".join(f'<a href="#f{i}">{e(a["file"])}</a>' for i, a in enumerate(files)) + "</nav>")
    if result.get("errors"):
        parts.append(_notes([f"{x['file']}: {x['error']}" for x in result["errors"]], "err"))
    comb = section_combined(result.get("combined") or {"objects": [], "machine_links": []})
    if comb:
        parts.append(f'<section class="file"><h2>Samlet</h2>{comb}</section>')
    for i, a in enumerate(files):
        body = SECTIONS[a["type"]](a) if a.get("supported") else (
            '<p class="hint">Denne meldingstypen leses, men har ingen egen analyse. Elementer: '
            + e(", ".join(f"{k}×{v}" for k, v in (a.get("elements") or {}).items())) + "</p>")
        parts.append(f'<section class="file" id="f{i}">{_head(a)}{body}</section>')
    parts.append("<footer>Laget med stanford2010-verktoy. Tall er beregnet fra maskinens egne rapporter; "
                 "produktivitet fra hpr og areal ut fra stammekoordinater er anslag.</footer>")
    return (f'<!doctype html><html lang="no"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f"<title>{e(title)}</title><style>{CSS}</style></head><body><main>{''.join(parts)}</main></body></html>")


# ---------- tekst ----------

def render_text(result: dict) -> str:
    L = []
    for a in result["files"]:
        L.append(f"\n== {a['file']}  ({a['ext']} – {a.get('type_name')}, StanForD {a.get('version')})")
        o = a.get("overview") or {}
        if a["type"] == "hpr":
            L.append(f"Stammer {o['stems']}, stokker {o['logs']}, {fmt(o['m3sub'], 2)} m³fub, middelstamme "
                     f"{fmt(o['mean_stem_m3sub'], 3)} m³fub, snitt DBH {fmt(o['mean_dbh_mm'], 0)} mm")
            if o["m3_per_hour_est"]:
                L.append(f"Produktivitet (anslag fra hogsttidspunkt): {fmt(o['m3_per_hour_est'], 1)} m³/t, "
                         f"{fmt(o['stems_per_hour_est'], 0)} stammer/t over {fmt(o['productive_hours_est'], 1)} t")
            if o["value"] is not None:
                L.append(f"Verdi etter prismatrisen: {fmt(o['value'], 0)} kr ({fmt(o['value_per_m3'], 0)} kr/m³fub)")
            if o["m3sub_per_ha"]:
                L.append(f"Areal (konveks hull): {fmt(o['area_hull_ha'], 1)} ha, {fmt(o['m3sub_per_ha'], 0)} m³/ha, "
                         f"{fmt(o['stems_per_ha'], 0)} stammer/ha")
            for r in a["per_product"]:
                L.append(f"  {str(r['product'])[:34]:<35}{r['logs']:>6}{fmt(r['m3sub'], 2):>10} m³  {pct(r['share']):>5}"
                         + (f"  {fmt(r['value_per_m3'], 0)} kr/m³" if r["value_per_m3"] else ""))
        elif a["type"] == "hqc":
            L.append(f"Kontrollstammer {o['control_stems']}, stokker {o['control_logs']}")
            for v in a["variables"]:
                if v["n"]:
                    L.append(f"  {v['label']:<24} snitt {fmt(v['mean'], 1):>6}  sd {fmt(v['sd'], 1):>5}  "
                             f"{pct(v['within']):>5} innenfor ±{fmt(v['tol'], 0)}  {'OK' if v.get('pass') else 'IKKE OK'}")
        elif a["type"] == "mom":
            L.append(f"Maskintid {fmt(o['work_h'], 1)} t, drift {fmt(o['run_h'], 1)} t, G15 {fmt(o['g15_h'], 1)} t, "
                     f"stopp {fmt(o['down_h'], 1)} t, teknisk utnyttelse {pct(o['technical_utilisation'])}")
            L.append(f"Drivstoff {fmt(o['fuel_l'], 0)} l ({fmt(o['fuel_per_engine_h'], 1)} l/motortime)"
                     + (f", {fmt(o['m3sub'], 0)} m³fub, {fmt(o['m3_per_g15h'], 1)} m³/G15-t, {fmt(o['fuel_per_m3'], 2)} l/m³"
                        if o["m3sub"] else ""))
        elif a["type"] == "fpr":
            L.append(f"Lass {o['loads']}, {fmt(o['m3'], 0)} m³, snitt {fmt(o['mean_load_m3'], 1)} m³/lass, "
                     f"snitt kjøreavstand {fmt(o['mean_distance_m'], 0)} m")
            for r in a["per_delivery"]:
                L.append(f"  {str(r['delivery'])[:34]:<35}{r['loads']:>5} lass{fmt(r['m3'], 1):>9} m³")
        for n in a.get("notes", []) + a.get("advice", []):
            L.append(f"  ! {n}")
    for x in result.get("errors", []):
        L.append(f"FEIL {x['file']}: {x['error']}")
    return "\n".join(L).strip() + "\n"


__all__ = ["render_html", "render_text", "HQC_TOLERANCE"]
