#!/usr/bin/env python3
"""Turn a table of this period against last period into deltas a report can cite.

CSV columns (header row required; extra columns are ignored):
    metric, previous, current, target (optional), direction (optional), unit (optional)
direction is "up" when higher is better (default) or "down" when lower is
better, for example response time or cost per lead.

    python3 metrics_delta.py metrics.csv
    python3 metrics_delta.py metrics.csv --format md

Numbers may use a comma or a point as the decimal mark and spaces as
thousands separators. Rows that cannot be read are reported, not dropped.
"""
import argparse
import csv
import json
import re
import sys

ALIASES = {
    "metric": ["metric", "метрика", "показатель", "name"],
    "previous": ["previous", "prev", "было", "прошлый", "прошлая", "last"],
    "current": ["current", "now", "стало", "текущий", "текущая", "this"],
    "target": ["target", "цель", "план", "goal"],
    "direction": ["direction", "направление"],
    "unit": ["unit", "единица", "ед"],
}


def number(raw):
    if raw is None:
        return None
    text = re.sub(r"[\s  %€$₽₴]", "", str(raw))
    if not text:
        return None
    if "," in text and "." in text:
        text = text.replace(",", "") if text.rfind(".") > text.rfind(",") else text.replace(".", "").replace(",", ".")
    else:
        text = text.replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


def column(header, field):
    lowered = [h.strip().lower() for h in header]
    for alias in ALIASES[field]:
        for index, name in enumerate(lowered):
            if name == alias or name.startswith(alias):
                return index
    return None


def fmt(value):
    if value is None:
        return "—"
    if abs(value - round(value)) < 1e-9:
        return "{:,}".format(int(round(value))).replace(",", " ")
    return ("%.2f" % value).rstrip("0").rstrip(".")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("file")
    parser.add_argument("--format", choices=["json", "md"], default="json")
    args = parser.parse_args()

    with open(args.file, encoding="utf-8-sig", newline="") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        except csv.Error:
            dialect = csv.excel
        rows = list(csv.reader(handle, dialect))
    if len(rows) < 2:
        raise SystemExit("В файле нет строк с данными.")

    header = rows[0]
    index = {field: column(header, field) for field in ALIASES}
    missing = [field for field in ("metric", "previous", "current") if index[field] is None]
    if missing:
        raise SystemExit("Не нашёл колонки: %s. Есть: %s" % (", ".join(missing), ", ".join(header)))

    def cell(row, field):
        position = index[field]
        return row[position].strip() if position is not None and position < len(row) else ""

    metrics, unreadable = [], []
    for line, row in enumerate(rows[1:], start=2):
        if not any(part.strip() for part in row):
            continue
        name = cell(row, "metric")
        previous, current = number(cell(row, "previous")), number(cell(row, "current"))
        if not name or current is None:
            unreadable.append({"line": line, "row": row})
            continue
        down = cell(row, "direction").lower() in ("down", "вниз", "меньше", "lower")
        target = number(cell(row, "target"))
        delta = None if previous is None else current - previous
        percent = None if previous in (None, 0) else delta / abs(previous) * 100
        if delta is None or delta == 0:
            trend = "без изменений" if delta == 0 else "нет базы для сравнения"
        else:
            trend = "лучше" if (delta < 0) == down else "хуже"
        on_target = None
        if target is not None:
            on_target = current <= target if down else current >= target
        metrics.append({
            "metric": name, "unit": cell(row, "unit"), "previous": previous, "current": current,
            "delta": None if delta is None else round(delta, 4),
            "delta_percent": None if percent is None else round(percent, 1),
            "trend": trend, "target": target, "on_target": on_target,
            "lower_is_better": down,
        })

    moved = [m for m in metrics if m["delta_percent"] is not None]
    better = sorted([m for m in moved if m["trend"] == "лучше"], key=lambda m: -abs(m["delta_percent"]))
    worse = sorted([m for m in moved if m["trend"] == "хуже"], key=lambda m: -abs(m["delta_percent"]))
    off_target = [m["metric"] for m in metrics if m["on_target"] is False]

    if args.format == "md":
        print("| Показатель | Было | Стало | Изменение | Цель | Статус |")
        print("|---|---|---|---|---|---|")
        for m in metrics:
            change = "—" if m["delta_percent"] is None else "%+.1f%%" % m["delta_percent"]
            status = m["trend"]
            if m["on_target"] is not None:
                status += ", цель %s" % ("выполнена" if m["on_target"] else "не выполнена")
            unit = " " + m["unit"] if m["unit"] else ""
            print("| %s | %s%s | %s%s | %s | %s | %s |" % (
                m["metric"], fmt(m["previous"]), unit, fmt(m["current"]), unit, change, fmt(m["target"]), status))
        return 0

    print(json.dumps({
        "metrics": metrics,
        "biggest_improvements": [m["metric"] for m in better[:3]],
        "biggest_declines": [m["metric"] for m in worse[:3]],
        "off_target": off_target,
        "unreadable_rows": unreadable,
        "note": "Процент не считается, когда прошлое значение равно нулю или отсутствует.",
    }, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
