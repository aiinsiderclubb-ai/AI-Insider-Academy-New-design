#!/usr/bin/env python3
"""Check a storyboard's timing before anything is rendered.

On-screen text has to stay up long enough to be read, and cuts have to be
long enough to register. This script reads the beats of a storyboard and
says which are too short, converts seconds to frames, and — given a beats
file from the beat-sync skill — moves each cut to the nearest beat.

Reading-time rule used: 0.5 s to find the text, then 0.3 s per word
(≈ 200 words a minute, the pace of captions people can follow), and never
less than 0.6 s for a cut with no text.

Input, any of:
  * props JSON of the KineticType composition ({"cards": [{"at", "text"}]})
  * a JSON list of beats: [{"at": 0, "text": "…"}, …]
  * a CSV with columns  at,text  (seconds, the words on screen)

Examples:
    python3 timing.py storyboard.csv --duration 15
    python3 timing.py props/reel.json --fps 30 --beats public/data/beats.json
    python3 timing.py props/reel.json --beats beats.json --write props/reel.snapped.json
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import sys
from pathlib import Path

FIND = 0.5
PER_WORD = 0.3
MIN_CUT = 0.6


def load(path: Path) -> tuple[list[dict], dict | None]:
    text = path.read_text(encoding="utf-8-sig")
    if path.suffix.lower() == ".csv":
        rows = list(csv.DictReader(io.StringIO(text)))
        return [{"at": float(str(r.get("at", "0")).replace(",", ".")), "text": (r.get("text") or "").strip()} for r in rows], None
    data = json.loads(text)
    if isinstance(data, dict) and "cards" in data:
        return [dict(card) for card in data["cards"]], data
    if isinstance(data, list):
        return [dict(item) for item in data], None
    raise ValueError("expected a CSV (at,text), a list of beats, or KineticType props with 'cards'")


def needed(text: str) -> float:
    words = len(text.replace("\\n", " ").split())
    return MIN_CUT if words == 0 else FIND + PER_WORD * words


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Storyboard timing check: reading time, frames, snapping to beats.")
    parser.add_argument("storyboard", type=Path)
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--duration", type=float, help="total length in seconds (default: last beat + its reading time)")
    parser.add_argument("--beats", type=Path, help="beats.json from the beat-sync skill — cuts snap to the nearest beat")
    parser.add_argument("--tolerance", type=float, default=0.25, help="largest move when snapping, seconds (default 0.25)")
    parser.add_argument("--write", type=Path, help="write the props back with snapped times")
    args = parser.parse_args(argv)

    try:
        beats, props = load(args.storyboard)
        beat_times = json.loads(args.beats.read_text(encoding="utf-8"))["beats"] if args.beats else []
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    if not beats:
        print("error: no beats in the storyboard", file=sys.stderr)
        return 1

    beats.sort(key=lambda b: float(b["at"]))
    for beat in beats:
        at = float(beat["at"])
        if beat_times:
            nearest = min(beat_times, key=lambda t: abs(t - at))
            if abs(nearest - at) <= args.tolerance and not (at == 0 and nearest > 0):
                beat["snapped_from"] = at
                at = nearest
        beat["at"] = round(at, 3)

    total = args.duration or float(beats[-1]["at"]) + needed(str(beats[-1].get("text", "")))
    rows, problems = [], []
    for i, beat in enumerate(beats):
        end = float(beats[i + 1]["at"]) if i + 1 < len(beats) else total
        length = end - float(beat["at"])
        text = str(beat.get("text", ""))
        need = needed(text)
        row = {
            "n": i + 1,
            "at": beat["at"],
            "frame": round(float(beat["at"]) * args.fps),
            "seconds_on_screen": round(length, 2),
            "frames_on_screen": round(length * args.fps),
            "reading_time": round(need, 2),
            "text": text.replace("\n", " / ").replace("\\n", " / "),
        }
        if "snapped_from" in beat:
            row["snapped_from"] = beat["snapped_from"]
        rows.append(row)
        if length < need - 1e-6:
            problems.append(f"beat {i + 1} ({row['text'][:40]!r}): {length:.2f} s on screen, needs {need:.2f} s — cut words or give it {need - length:.2f} s more")
        if length <= 0:
            problems.append(f"beat {i + 1}: starts at or after the next one")

    report = {"fps": args.fps, "total_seconds": round(total, 2), "total_frames": round(total * args.fps), "beats": rows, "problems": problems, "ok": not problems}
    if args.write:
        if props is None:
            print("error: --write works with KineticType props JSON", file=sys.stderr)
            return 1
        props["cards"] = [{k: v for k, v in b.items() if k != "snapped_from"} for b in beats]
        args.write.write_text(json.dumps(props, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        report["written"] = str(args.write)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not problems else 2


if __name__ == "__main__":
    sys.exit(main())
