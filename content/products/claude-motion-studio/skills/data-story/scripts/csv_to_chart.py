#!/usr/bin/env python3
"""Check a CSV and turn it into a chart spec for the DataStory composition.

The video shows numbers people will take as fact, so they are read and
checked here, not retyped by the model:

  * the first column is the label (month, product, city), every other
    column is a series of numbers;
  * "12 500,5", "12,500.5", "€1 200", "35%" are all read as numbers;
    a cell that is not a number is reported, never guessed;
  * the axis gets round ticks (0, 10, 20 …) that cover the data;
  * facts for the headline are computed: first, last, change, min, max.

Output JSON:
    {"chart": {...ChartSpec...}, "delta": {...} | null, "facts": {...}, "warnings": [...]}

`chart` and `delta` go straight into the composition's props.

Examples:
    python3 csv_to_chart.py hours.csv
    python3 csv_to_chart.py revenue.csv --kind line --unit " тыс. €" --decimals 1
    python3 csv_to_chart.py hours.csv --highlight last --delta first:last --out props/chart.json
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import math
import re
import sys
from pathlib import Path

CURRENCY = re.compile(r"[€$£₽₴%]|руб\.?|грн\.?|eur|usd", re.IGNORECASE)


def parse_number(raw: str) -> float | None:
    """Reads numbers as people write them in RU/UA/EN spreadsheets."""
    text = CURRENCY.sub("", raw).strip().replace(" ", " ").replace(" ", " ")
    text = text.replace("−", "-").replace("–", "-")
    if not text:
        return None
    text = text.replace(" ", "")
    if "," in text and "." in text:
        # The later separator is the decimal one: 12,500.5 or 12.500,5.
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text:
        head, _, tail = text.rpartition(",")
        # 12,500 with exactly three digits after one comma is ambiguous; RU/UA use comma decimals.
        text = head.replace(",", "") + "." + tail
    try:
        value = float(text)
    except ValueError:
        return None
    return value if math.isfinite(value) else None


def read_table(text: str) -> tuple[list[str], list[list[str]]]:
    text = text.lstrip("﻿")
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        delimiter = dialect.delimiter
    except csv.Error:
        delimiter = ";" if sample.count(";") > sample.count(",") else ","
    rows = [row for row in csv.reader(io.StringIO(text), delimiter=delimiter) if any(cell.strip() for cell in row)]
    if len(rows) < 2:
        raise ValueError("need a header row and at least one data row")
    return [cell.strip() for cell in rows[0]], rows[1:]


def nice_step(span: float, ticks: int) -> float:
    raw = span / max(1, ticks - 1)
    magnitude = 10 ** math.floor(math.log10(raw)) if raw > 0 else 1
    for multiple in (1, 2, 2.5, 5, 10):
        if raw <= multiple * magnitude:
            return multiple * magnitude
    return 10 * magnitude


def nice_scale(lo: float, hi: float, ticks: int, include_zero: bool) -> dict:
    if include_zero:
        lo, hi = min(lo, 0.0), max(hi, 0.0)
    if lo == hi:
        hi = lo + 1
    step = nice_step(hi - lo, ticks)
    start = math.floor(lo / step) * step
    end = math.ceil(hi / step) * step
    values = []
    v = start
    while v <= end + step / 1000:
        values.append(round(v, 10))
        v += step
    return {"min": values[0], "max": values[-1], "ticks": [int(t) if float(t).is_integer() else t for t in values]}


def auto_decimals(values: list[float]) -> int:
    for decimals in range(0, 3):
        if all(abs(v * 10**decimals - round(v * 10**decimals)) < 1e-9 for v in values):
            return decimals
    return 2


def fmt_change(first: float, last: float) -> tuple[float, float | None]:
    change = last - first
    pct = None if first == 0 else change / abs(first) * 100
    return change, pct


def pick_index(spec: str, labels: list[str], values: list[float]) -> int:
    if spec == "last":
        return len(values) - 1
    if spec == "first":
        return 0
    if spec == "max":
        return max(range(len(values)), key=values.__getitem__)
    if spec == "min":
        return min(range(len(values)), key=values.__getitem__)
    if spec in labels:
        return labels.index(spec)
    raise ValueError(f"no label {spec!r} — use one of: first, last, max, min, or a label from the first column")


def build(text: str, args) -> dict:
    header, rows = read_table(text)
    warnings: list[str] = []
    if len(header) < 2:
        raise ValueError("need at least two columns: labels, then numbers")
    names = header[1:]
    if args.series:
        missing = [s for s in args.series if s not in names]
        if missing:
            raise ValueError(f"no column {missing[0]!r}; columns are: {', '.join(names)}")
        chosen = [names.index(s) + 1 for s in args.series]
    else:
        chosen = list(range(1, len(header)))

    labels: list[str] = []
    series = {c: [] for c in chosen}
    for n, row in enumerate(rows, start=2):
        label = row[0].strip() if row else ""
        cells = {c: (row[c].strip() if c < len(row) else "") for c in chosen}
        parsed = {c: parse_number(v) for c, v in cells.items()}
        bad = [f"{header[c]}={cells[c]!r}" for c, v in parsed.items() if v is None]
        if bad:
            warnings.append(f"row {n} ({label or 'no label'}): not a number — {', '.join(bad)}; row skipped")
            continue
        labels.append(label)
        for c, v in parsed.items():
            series[c].append(v)

    if not labels:
        raise ValueError("no rows with numbers in every chosen column")
    kind = args.kind or ("bar" if len(chosen) == 1 and len(labels) <= 12 else "line")
    if kind == "bar" and len(chosen) > 1:
        warnings.append("bar charts draw the first series only; use --kind line for several series, or --series to choose")
    if kind == "bar" and len(labels) > 12:
        warnings.append(f"{len(labels)} bars will be thin and their labels unreadable — 12 at most, or use a line")
    if kind == "line" and len(labels) < 3:
        warnings.append("a line needs at least three points to show a trend")
    long_labels = [l for l in labels if len(l) > 8]
    if long_labels:
        warnings.append(f"labels longer than 8 characters may collide under the chart: {long_labels[:3]} — shorten them (Январь → Янв)")

    all_values = [v for c in chosen for v in series[c]]
    include_zero = kind == "bar" or args.zero
    scale = nice_scale(min(all_values), max(all_values), args.ticks, include_zero)
    decimals = args.decimals if args.decimals is not None else auto_decimals(all_values)

    main = series[chosen[0]]
    highlight = None
    if args.highlight:
        highlight = {"series": 0, "index": pick_index(args.highlight, labels, main)}

    first, last = main[0], main[-1]
    change, pct = fmt_change(first, last)
    facts = {
        "series": header[chosen[0]],
        "first": {"label": labels[0], "value": first},
        "last": {"label": labels[-1], "value": last},
        "change": round(change, 6),
        "change_percent": None if pct is None else round(pct, 1),
        "max": {"label": labels[main.index(max(main))], "value": max(main)},
        "min": {"label": labels[main.index(min(main))], "value": min(main)},
        "total": round(sum(main), 6),
    }

    delta = None
    if args.delta:
        a, _, b = args.delta.partition(":")
        i, j = pick_index(a or "first", labels, main), pick_index(b or "last", labels, main)
        d_change, d_pct = fmt_change(main[i], main[j])
        if d_pct is None:
            label = f"{'+' if d_change > 0 else '−'}{abs(d_change):g}{args.unit}"
        else:
            label = f"{'+' if d_pct > 0 else '−'}{abs(round(d_pct)):g}%"
        delta = {"from": i, "to": j, "label": label, "at": args.delta_at}
        if kind != "bar":
            warnings.append("delta brackets are drawn on bar charts only")

    chart = {
        "kind": kind,
        "labels": labels,
        "series": [{"name": header[c], "values": series[c]} for c in chosen],
        "scale": scale,
        "format": {"decimals": decimals, "prefix": args.prefix, "suffix": args.unit},
        "highlight": highlight,
    }
    return {"chart": chart, "delta": delta, "facts": facts, "warnings": warnings}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="CSV → checked chart spec for the DataStory composition.")
    parser.add_argument("csv", type=Path)
    parser.add_argument("--kind", choices=["bar", "line"], help="default: bar for one series of ≤12 rows, else line")
    parser.add_argument("--series", nargs="+", help="column names to draw (default: all)")
    parser.add_argument("--highlight", help="bar to accent: first, last, max, min, or a label")
    parser.add_argument("--delta", help="bracket the change between two bars, e.g. first:last or Янв:Июн")
    parser.add_argument("--delta-at", type=float, default=4.2, help="when the bracket appears, seconds")
    parser.add_argument("--unit", default="", help='suffix on values, e.g. " ч" or "%%"')
    parser.add_argument("--prefix", default="", help='prefix on values, e.g. "€"')
    parser.add_argument("--decimals", type=int, help="digits after the comma (default: as in the data)")
    parser.add_argument("--ticks", type=int, default=5, help="about how many axis lines (default 5)")
    parser.add_argument("--zero", action="store_true", help="start a line chart's axis at zero")
    parser.add_argument("--out", type=Path, help="write JSON here (default: print)")
    args = parser.parse_args(argv)
    try:
        result = build(args.csv.read_text(encoding="utf-8-sig"), args)
    except (OSError, ValueError, UnicodeDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    text = json.dumps(result, ensure_ascii=False, indent=1)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(text + "\n", encoding="utf-8")
        print(json.dumps({"facts": result["facts"], "warnings": result["warnings"]}, ensure_ascii=False, indent=2))
    else:
        print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
