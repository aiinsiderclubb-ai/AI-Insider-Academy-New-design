#!/usr/bin/env python3
"""Render one still per look so the client can pick an art direction.

Runs `npx remotion still` on a composition once for every look (or the ones
given), at a chosen frame and scale, then stacks the stills into a single
labelled board with ffmpeg. Run it inside a project made by new_project.py,
after `npm install`.

Examples:
    python3 lookboard.py                               # HeroTitle, frame 150, all looks
    python3 lookboard.py --comp OrbitType --frame 200
    python3 lookboard.py --looks keynote,chrome --props '{"title":"ОРБИТА"}'
Output: out/lookboard.png plus out/look-<name>.png per look.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

LOOKS = ["keynote", "chrome", "kinetic", "neon", "editorial"]


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Render a still per look and stack them into one board.")
    parser.add_argument("--comp", default="HeroTitle", help="composition id (default HeroTitle)")
    parser.add_argument("--frame", type=int, default=150, help="frame to render (default 150)")
    parser.add_argument("--scale", type=float, default=0.4, help="render scale (default 0.4)")
    parser.add_argument("--looks", default=",".join(LOOKS), help="comma-separated looks")
    parser.add_argument("--props", default="{}", help="extra props as JSON, merged with the look")
    parser.add_argument("--out", type=Path, default=Path("out"))
    args = parser.parse_args(argv)

    if not Path("src/Root.tsx").exists():
        print("error: run this inside the project folder (where src/Root.tsx is)", file=sys.stderr)
        return 1
    try:
        extra = json.loads(args.props)
    except json.JSONDecodeError as err:
        print(f"error: --props is not valid JSON: {err}", file=sys.stderr)
        return 1
    looks = [l.strip() for l in args.looks.split(",") if l.strip()]
    unknown = [l for l in looks if l not in LOOKS]
    if unknown:
        print(f"error: unknown looks {unknown}; available: {', '.join(LOOKS)}", file=sys.stderr)
        return 1
    args.out.mkdir(parents=True, exist_ok=True)

    stills = []
    for look in looks:
        still = args.out / f"look-{look}.png"
        props = json.dumps({**extra, "look": look}, ensure_ascii=False)
        cmd = ["npx", "remotion", "still", args.comp, str(still), f"--frame={args.frame}", f"--scale={args.scale}", f"--props={props}"]
        print("·", look, flush=True)
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0 or not still.exists():
            print(result.stdout[-2000:], result.stderr[-2000:], sep="\n", file=sys.stderr)
            return 1
        stills.append((look, still))

    board = args.out / "lookboard.png"
    if not shutil.which("ffmpeg"):
        print(f"ffmpeg not found: stills are in {args.out}/look-*.png; no board made")
        return 0
    # Some ffmpeg builds have no drawtext (no freetype): then the board has no labels,
    # and the order is printed instead.
    filters = subprocess.run(["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True).stdout
    can_label = " drawtext " in filters
    inputs, labelled = [], []
    for i, (look, still) in enumerate(stills):
        inputs += ["-i", str(still)]
        label = (
            f"drawtext=text='{look}':x=24:y=h-56:fontsize=32:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=12"
            if can_label
            else "null"
        )
        labelled.append(f"[{i}]{label}[l{i}]")
    cols = 2 if len(stills) > 2 else len(stills)
    rows = (len(stills) + cols - 1) // cols
    # xstack layout: column offset = sum of widths before it; all stills share a size, so w0/h0 multiples work.
    layout = "|".join(
        ("0" if i % cols == 0 else "+".join(["w0"] * (i % cols))) + "_" + ("0" if i // cols == 0 else "+".join(["h0"] * (i // cols)))
        for i in range(len(stills))
    )
    graph = ";".join(labelled) + ";" + "".join(f"[l{i}]" for i in range(len(stills)))
    graph += f"xstack=inputs={len(stills)}:layout={layout}:fill=black" if len(stills) > 1 else "null"
    cmd = ["ffmpeg", "-loglevel", "error", "-y", *inputs, "-filter_complex", graph, str(board)]
    if subprocess.run(cmd).returncode != 0:
        print("ffmpeg could not stack the stills; they are in out/look-*.png", file=sys.stderr)
        return 1
    print(json.dumps({
        "board": str(board),
        "looks_in_reading_order": [l for l, _ in stills],
        "grid": f"{cols}x{rows}",
        "labels": can_label,
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
