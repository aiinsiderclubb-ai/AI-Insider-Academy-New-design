#!/usr/bin/env python3
"""Turn a logo SVG into plain paths the LogoSting composition can trace.

The composition draws each outline, then lands its fill. For that it needs
every shape as a <path> in absolute coordinates, with its own fill and stroke.
This script:

  * converts rect (with rounded corners), circle, ellipse, line, polyline
    and polygon into path data;
  * applies transform="" from the element and its groups (translate, scale,
    rotate, skew, matrix);
  * resolves fill / stroke / stroke-width through groups and style="";
  * reports what it cannot carry over: <text> (convert text to outlines in
    your editor), raster images, gradients, masks, clip paths, CSS classes.

Output (JSON):
    {"viewBox": [0, 0, 24, 24],
     "paths": [{"d": "M…Z", "fill": "#ff7a1a", "stroke": null, "strokeWidth": 0}, …]}

Examples:
    python3 svg_prepare.py logo.svg --out public/data/logo.json
    python3 svg_prepare.py logo.svg --report
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

NUMBER = re.compile(r"[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?")
COMMAND = re.compile(r"[MmLlHhVvCcSsQqTtAaZz]")
SHAPES = {"path", "rect", "circle", "ellipse", "line", "polyline", "polygon"}
UNSUPPORTED = {"text": "text — convert it to outlines in your vector editor",
               "image": "embedded raster image — it cannot be traced",
               "use": "<use> reference — expand it in your editor (Object → Expand / Unlink)"}

Matrix = tuple  # (a, b, c, d, e, f)
IDENTITY: Matrix = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def multiply(m: Matrix, n: Matrix) -> Matrix:
    a, b, c, d, e, f = m
    a2, b2, c2, d2, e2, f2 = n
    return (a * a2 + c * b2, b * a2 + d * b2, a * c2 + c * d2, b * c2 + d * d2, a * e2 + c * f2 + e, b * e2 + d * f2 + f)


def parse_transform(text: str | None) -> Matrix:
    m = IDENTITY
    if not text:
        return m
    for name, args in re.findall(r"(\w+)\s*\(([^)]*)\)", text):
        v = [float(x) for x in NUMBER.findall(args)]
        if name == "matrix" and len(v) == 6:
            t = tuple(v)
        elif name == "translate":
            t = (1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0)
        elif name == "scale":
            t = (v[0], 0, 0, v[1] if len(v) > 1 else v[0], 0, 0)
        elif name == "rotate":
            r = math.radians(v[0])
            rot = (math.cos(r), math.sin(r), -math.sin(r), math.cos(r), 0, 0)
            if len(v) == 3:
                t = multiply(multiply((1, 0, 0, 1, v[1], v[2]), rot), (1, 0, 0, 1, -v[1], -v[2]))
            else:
                t = rot
        elif name == "skewX":
            t = (1, 0, math.tan(math.radians(v[0])), 1, 0, 0)
        elif name == "skewY":
            t = (1, math.tan(math.radians(v[0])), 0, 1, 0, 0)
        else:
            continue
        m = multiply(m, t)
    return m


def apply(m: Matrix, x: float, y: float) -> tuple[float, float]:
    a, b, c, d, e, f = m
    return a * x + c * y + e, b * x + d * y + f


# ----------------------------------------------------------------- path data


def tokenize(d: str):
    for token in re.findall(r"[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?", d):
        yield token


def absolute(d: str) -> list[tuple[str, list[float]]]:
    """Path data → absolute commands M, L, C, Q, A, Z only."""
    tokens = list(tokenize(d))
    out: list[tuple[str, list[float]]] = []
    i = 0
    cmd = None
    x = y = sx = sy = 0.0
    last_ctrl = None  # (cmd, x, y) for S/T reflection
    sizes = {"M": 2, "L": 2, "H": 1, "V": 1, "C": 6, "S": 4, "Q": 4, "T": 2, "A": 7, "Z": 0}

    while i < len(tokens):
        if COMMAND.fullmatch(tokens[i]):
            cmd = tokens[i]
            i += 1
            if cmd in "Zz":
                out.append(("Z", []))
                x, y = sx, sy
                last_ctrl = None
                continue
        if cmd is None:
            raise ValueError("path data must start with a command")
        n = sizes[cmd.upper()]
        args = [float(t) for t in tokens[i : i + n]]
        if len(args) < n:
            raise ValueError(f"path data ends in the middle of a {cmd} command")
        i += n
        rel = cmd.islower()
        up = cmd.upper()
        if up == "M":
            x, y = (x + args[0], y + args[1]) if rel else (args[0], args[1])
            sx, sy = x, y
            out.append(("M", [x, y]))
            cmd = "l" if rel else "L"  # further pairs are line-tos
            last_ctrl = None
        elif up in "LHV":
            if up == "H":
                x = x + args[0] if rel else args[0]
            elif up == "V":
                y = y + args[0] if rel else args[0]
            else:
                x, y = (x + args[0], y + args[1]) if rel else (args[0], args[1])
            out.append(("L", [x, y]))
            last_ctrl = None
        elif up in "CS":
            if up == "S":
                if last_ctrl and last_ctrl[0] == "C":
                    c1 = (2 * x - last_ctrl[1], 2 * y - last_ctrl[2])
                else:
                    c1 = (x, y)
                rest = args
            else:
                c1 = (x + args[0], y + args[1]) if rel else (args[0], args[1])
                rest = args[2:]
            c2 = (x + rest[0], y + rest[1]) if rel else (rest[0], rest[1])
            end = (x + rest[2], y + rest[3]) if rel else (rest[2], rest[3])
            out.append(("C", [*c1, *c2, *end]))
            last_ctrl = ("C", *c2)
            x, y = end
        elif up in "QT":
            if up == "T":
                c = (2 * x - last_ctrl[1], 2 * y - last_ctrl[2]) if last_ctrl and last_ctrl[0] == "Q" else (x, y)
                end = (x + args[0], y + args[1]) if rel else (args[0], args[1])
            else:
                c = (x + args[0], y + args[1]) if rel else (args[0], args[1])
                end = (x + args[2], y + args[3]) if rel else (args[2], args[3])
            out.append(("Q", [*c, *end]))
            last_ctrl = ("Q", *c)
            x, y = end
        elif up == "A":
            end = (x + args[5], y + args[6]) if rel else (args[5], args[6])
            out.append(("A", [args[0], args[1], args[2], args[3], args[4], *end]))
            x, y = end
            last_ctrl = None
    return out


def transform_path(commands, m: Matrix, warnings: list[str], where: str):
    a, b, c, d, _, _ = m
    scale_x = math.hypot(a, b)
    scale_y = math.hypot(c, d)
    similar = abs(a * c + b * d) < 1e-9 and abs(scale_x - scale_y) < 1e-6
    result = []
    for cmd, v in commands:
        if cmd == "A":
            if not similar:
                warnings.append(f"{where}: an arc under a stretched or skewed transform is approximated — flatten transforms in your editor for an exact result")
            rotation = v[2] + math.degrees(math.atan2(b, a))
            sweep = v[4] if a * d - b * c > 0 else 1 - v[4]
            ex, ey = apply(m, v[5], v[6])
            result.append(("A", [v[0] * scale_x, v[1] * scale_y, rotation, v[3], sweep, ex, ey]))
        else:
            pts = []
            for k in range(0, len(v), 2):
                pts.extend(apply(m, v[k], v[k + 1]))
            result.append((cmd, pts))
    return result


def fmt(n: float) -> str:
    s = f"{n:.3f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def serialize(commands) -> str:
    parts = []
    for cmd, v in commands:
        if cmd == "A":
            parts.append(f"A {fmt(v[0])} {fmt(v[1])} {fmt(v[2])} {int(v[3])} {int(v[4])} {fmt(v[5])} {fmt(v[6])}")
        else:
            parts.append(cmd + ("" if not v else " " + " ".join(fmt(x) for x in v)))
    return " ".join(parts)


# ------------------------------------------------------------------- shapes


def num(el, name, default=0.0) -> float:
    value = el.get(name)
    if value is None:
        return default
    match = NUMBER.match(value.strip())
    return float(match.group()) if match else default


def shape_to_d(el) -> str | None:
    tag = local(el.tag)
    if tag == "path":
        return el.get("d")
    if tag == "rect":
        x, y, w, h = num(el, "x"), num(el, "y"), num(el, "width"), num(el, "height")
        if w <= 0 or h <= 0:
            return None
        rx_raw, ry_raw = el.get("rx"), el.get("ry")
        rx = num(el, "rx") if rx_raw is not None else (num(el, "ry") if ry_raw is not None else 0)
        ry = num(el, "ry") if ry_raw is not None else rx
        rx, ry = min(rx, w / 2), min(ry, h / 2)
        if rx <= 0 or ry <= 0:
            return f"M {fmt(x)} {fmt(y)} H {fmt(x + w)} V {fmt(y + h)} H {fmt(x)} Z"
        return (
            f"M {fmt(x + rx)} {fmt(y)} H {fmt(x + w - rx)} A {fmt(rx)} {fmt(ry)} 0 0 1 {fmt(x + w)} {fmt(y + ry)} "
            f"V {fmt(y + h - ry)} A {fmt(rx)} {fmt(ry)} 0 0 1 {fmt(x + w - rx)} {fmt(y + h)} "
            f"H {fmt(x + rx)} A {fmt(rx)} {fmt(ry)} 0 0 1 {fmt(x)} {fmt(y + h - ry)} "
            f"V {fmt(y + ry)} A {fmt(rx)} {fmt(ry)} 0 0 1 {fmt(x + rx)} {fmt(y)} Z"
        )
    if tag in ("circle", "ellipse"):
        cx, cy = num(el, "cx"), num(el, "cy")
        rx = num(el, "r") if tag == "circle" else num(el, "rx")
        ry = num(el, "r") if tag == "circle" else num(el, "ry")
        if rx <= 0 or ry <= 0:
            return None
        return (
            f"M {fmt(cx + rx)} {fmt(cy)} A {fmt(rx)} {fmt(ry)} 0 1 1 {fmt(cx - rx)} {fmt(cy)} "
            f"A {fmt(rx)} {fmt(ry)} 0 1 1 {fmt(cx + rx)} {fmt(cy)} Z"
        )
    if tag == "line":
        return f"M {fmt(num(el, 'x1'))} {fmt(num(el, 'y1'))} L {fmt(num(el, 'x2'))} {fmt(num(el, 'y2'))}"
    if tag in ("polyline", "polygon"):
        values = [float(v) for v in NUMBER.findall(el.get("points", ""))]
        if len(values) < 4:
            return None
        pairs = [f"{fmt(values[k])} {fmt(values[k + 1])}" for k in range(0, len(values) - 1, 2)]
        return "M " + " L ".join(pairs) + (" Z" if tag == "polygon" else "")
    return None


def styles_of(el) -> dict:
    found = {}
    for key in ("fill", "stroke", "stroke-width", "opacity", "fill-opacity", "display", "visibility"):
        if el.get(key) is not None:
            found[key] = el.get(key).strip()
    for part in (el.get("style") or "").split(";"):
        if ":" in part:
            key, value = part.split(":", 1)
            found[key.strip()] = value.strip()
    return found


def colour(value: str | None, warnings: list[str], where: str) -> str | None:
    if value is None or value == "none" or value == "transparent":
        return None
    if value.startswith("url("):
        warnings.append(f"{where}: gradient or pattern fill replaced by the style colour")
        return None
    if value in ("currentColor", "inherit"):
        return None
    return value


def walk(el, m: Matrix, inherited: dict, out: list, warnings: list[str]):
    tag = local(el.tag)
    if tag in ("defs", "clipPath", "mask", "symbol", "metadata", "title", "desc", "linearGradient", "radialGradient", "pattern", "filter"):
        if tag in ("clipPath", "mask"):
            warnings.append(f"<{tag}> ignored — the shapes it hides will be visible; release masks in your editor")
        return
    if tag == "style":
        warnings.append("<style> CSS ignored — set fills as attributes (export with 'Presentation attributes')")
        return
    if tag in UNSUPPORTED:
        warnings.append(UNSUPPORTED[tag])
        return
    own = styles_of(el)
    if own.get("display") == "none" or own.get("visibility") == "hidden":
        return
    if el.get("class"):
        warnings.append(f"<{tag} class=\"{el.get('class')}\">: CSS classes are not read")
    merged = {**inherited, **{k: v for k, v in own.items() if k not in ("opacity", "transform")}}
    m = multiply(m, parse_transform(el.get("transform")))
    if tag in SHAPES:
        d = shape_to_d(el)
        if d:
            where = f"<{tag}> #{len(out) + 1}"
            commands = transform_path(absolute(d), m, warnings, where)
            fill = colour(merged.get("fill", "#000000"), warnings, where)
            stroke = colour(merged.get("stroke"), warnings, where)
            scale = math.sqrt(abs(m[0] * m[3] - m[1] * m[2])) or 1
            width = float(NUMBER.match(merged.get("stroke-width", "1")).group()) * scale if stroke else 0
            if tag in ("line", "polyline"):
                fill = None
            if fill or stroke:
                out.append({"d": serialize(commands), "fill": fill, "stroke": stroke, "strokeWidth": round(width, 3)})
    for child in el:
        walk(child, m, merged, out, warnings)


def prepare(svg: str) -> tuple[dict, list[str]]:
    root = ET.fromstring(svg)
    if local(root.tag) != "svg":
        raise ValueError("the file is not an SVG")
    warnings: list[str] = []
    box = [float(v) for v in NUMBER.findall(root.get("viewBox", ""))]
    if len(box) != 4:
        w, h = num(root, "width"), num(root, "height")
        if not (w and h):
            raise ValueError("the SVG has neither a viewBox nor width and height")
        box = [0.0, 0.0, w, h]
        warnings.append("no viewBox — used width and height")
    paths: list[dict] = []
    # Presentation attributes on <svg> itself (fill="none" is common) apply to everything inside.
    inherited = {k: v for k, v in styles_of(root).items() if k not in ("opacity", "display", "visibility")}
    for child in root:
        walk(child, IDENTITY, inherited, paths, warnings)
    if not paths:
        raise ValueError("no drawable shapes found")
    return {"viewBox": box, "paths": paths}, sorted(set(warnings))


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Logo SVG → plain paths JSON for the LogoSting composition.")
    parser.add_argument("svg", type=Path)
    parser.add_argument("--out", type=Path, help="write JSON here (default: print it)")
    parser.add_argument("--report", action="store_true", help="print only the summary and warnings")
    args = parser.parse_args(argv)
    try:
        logo, warnings = prepare(args.svg.read_text(encoding="utf-8"))
    except (OSError, ValueError, ET.ParseError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    summary = {"paths": len(logo["paths"]), "viewBox": logo["viewBox"], "warnings": warnings}
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(logo, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    if args.report or args.out:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(logo, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
