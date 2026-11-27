#!/usr/bin/env python3
"""Snap a storyboard's cuts and hits onto the music.

Part of Claude Cinematic Studio (cut-rhythm). Reads a storyboard (format in
cinematic-director/references/storyboard-format.md) and a beats.json from
beats.py, moves every shot boundary and every hit to the nearest musical
moment, and writes the storyboard back with exact seconds and frames.

Python 3 standard library only.

Rules, the way an editor cuts to music:
  - A scene change (`transition_out.on` = "downbeat", or not set) goes to the
    nearest downbeat within the tolerance, else to the nearest beat.
  - `on` = "beat" snaps to any beat; "free" is left where it is.
  - Hits snap to the nearest strong onset ("hits" in beats.json — fills,
    drops, impacts that are not always on the grid) or to a beat, whichever
    is closer.
  - The fitted beat grid (beats.json → grid) is used when present: tracked
    beats wobble by a frame, the grid does not.
  - No shot gets shorter than --min-shot; if a snap would do that, the next
    candidate is tried, and if none fits the cut stays and is reported.
  - --lead-frames moves every cut that many frames before the beat. The eye
    reads a cut a frame or two late; 0 (exactly on the beat) is the default,
    1 is common for fast cutting.
  - --offset: the music time at which the film starts (the part of the track
    you use); beats are shifted by it.
  - The last shot's end snaps to a downbeat too, so the film ends on the bar.

Writes:
  - the storyboard with each shot's start/end replaced, plus start_frame,
    end_frame and snap info (`_snap`: original time, target kind, drift)
  - a Markdown cut list (--md) with drift per cut in frames

Examples:
    python3 cutlist.py storyboard.json beats.json --out storyboard.synced.json --md cuts.md
    python3 cutlist.py storyboard.json beats.json --offset 31.0 --tolerance 0.3 --lead-frames 1
"""
from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path


def nearest(t: float, candidates: list[float], tolerance: float) -> list[float]:
    """Candidates within tolerance, closest first."""
    return sorted((c for c in candidates if abs(c - t) <= tolerance), key=lambda c: abs(c - t))


def load_grid(beats: dict, offset: float) -> tuple[list[float], list[float], list[float]]:
    grid = beats.get("grid") or {}
    all_beats = grid.get("beats") or beats.get("beats") or []
    downbeats = grid.get("downbeats") or beats.get("downbeats") or []
    hits = [h["t"] if isinstance(h, dict) else h for h in beats.get("hits") or []]
    shift = lambda xs: [round(x - offset, 4) for x in xs if x - offset >= -1e-6]
    return shift(all_beats), shift(downbeats), shift(hits)


def snap(board: dict, beats: dict, tolerance: float, min_shot: float, lead_frames: int, offset: float) -> tuple[dict, list[dict]]:
    out = copy.deepcopy(board)
    fps = out.get("fps") or beats.get("fps") or 30
    lead = lead_frames / fps
    all_beats, downbeats, hits = load_grid(beats, offset)
    if not all_beats:
        raise RuntimeError("beats.json has no beats")
    shots = out.get("shots") or []
    if not shots:
        raise RuntimeError("storyboard has no shots")
    report = []

    # Boundaries: the end of shot i is the start of shot i+1; plus the film's end.
    boundaries = [s["end"] for s in shots]
    new = list(boundaries)
    for i, t in enumerate(boundaries):
        last = i == len(shots) - 1
        out_rule = (shots[i].get("transition_out") or {}).get("on")
        rule = "downbeat" if last else (out_rule or "downbeat")
        if rule == "free":
            report.append({"shot": shots[i].get("id"), "kind": "cut", "rule": "free", "from": t, "to": t, "target": "free", "drift": 0.0})
            continue
        if rule == "downbeat":
            options = [(c, "downbeat") for c in nearest(t, downbeats, tolerance)] + [(c, "beat") for c in nearest(t, all_beats, tolerance)]
        else:
            options = [(c, "beat") for c in nearest(t, all_beats, tolerance)]
        prev_cut = new[i - 1] if i > 0 else shots[0]["start"]
        chosen = None
        for c, kind in options:
            c2 = round(c - lead, 4)
            next_end = boundaries[i + 1] if i + 1 < len(boundaries) else None
            if c2 - prev_cut < min_shot - 1e-6:
                continue
            if next_end is not None and next_end - c2 < min_shot - 1e-6:
                continue
            chosen = (c2, kind)
            break
        if chosen:
            new[i] = chosen[0]
            report.append({"shot": shots[i].get("id"), "kind": "end" if last else "cut", "rule": rule, "from": t, "to": chosen[0], "target": chosen[1], "drift": round(chosen[0] - t, 4)})
        else:
            report.append({"shot": shots[i].get("id"), "kind": "end" if last else "cut", "rule": rule, "from": t, "to": t, "target": "none in tolerance", "drift": 0.0})

    for i, s in enumerate(shots):
        start = shots[0]["start"] if i == 0 else new[i - 1]
        s["_snap"] = {"start_was": s["start"], "end_was": s["end"]}
        s["start"], s["end"] = round(start, 4), round(new[i], 4)
        s["start_frame"], s["end_frame"] = round(s["start"] * fps), round(s["end"] * fps)

    for s in shots:
        for h in s.get("hits") or []:
            t = h["t"]
            options = [(c, "hit") for c in nearest(t, hits, tolerance)] + [(c, "beat") for c in nearest(t, all_beats, tolerance)]
            options.sort(key=lambda o: abs(o[0] - t))
            target = None
            for c, kind in options:
                if s["start"] - 1e-6 <= c <= s["end"] + 1e-6:
                    target = (c, kind)
                    break
            if target:
                h["_snap"] = {"t_was": t, "target": target[1]}
                h["t"] = round(target[0], 4)
            else:
                # The shot moved: keep the hit at the same place inside its shot.
                h["t"] = round(min(max(t, s["start"]), s["end"]), 4)
                h["_snap"] = {"t_was": t, "target": "kept"}
            h["frame"] = round(h["t"] * fps)
            report.append({"shot": s.get("id"), "kind": "hit", "rule": h.get("sfx", ""), "from": t, "to": h["t"], "target": h["_snap"]["target"], "drift": round(h["t"] - t, 4)})

    out["_music_offset"] = offset
    return out, report


def markdown(report: list[dict], fps: int) -> str:
    rows = ["| Шот | Что | Правило | Было, с | Стало, с | Кадр | Куда | Сдвиг, кадров |", "|---|---|---|---|---|---|---|---|"]
    names = {"cut": "склейка", "end": "конец", "hit": "удар"}
    for r in report:
        rows.append(
            f"| {r['shot']} | {names.get(r['kind'], r['kind'])} | {r['rule']} | {r['from']:.3f} | {r['to']:.3f} | {round(r['to'] * fps)} | {r['target']} | {r['drift'] * fps:+.1f} |"
        )
    return "\n".join(rows)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Snap storyboard cuts and hits to beats and downbeats.")
    parser.add_argument("storyboard", type=Path)
    parser.add_argument("beats", type=Path, help="beats.json from beats.py")
    parser.add_argument("--out", type=Path, help="write the synced storyboard here (default: <name>.synced.json)")
    parser.add_argument("--md", type=Path, help="write the cut list as Markdown")
    parser.add_argument("--tolerance", type=float, default=None, help="max move in seconds (default: half a beat)")
    parser.add_argument("--min-shot", type=float, default=0.4)
    parser.add_argument("--lead-frames", type=int, default=0, help="cut this many frames before the beat")
    parser.add_argument("--offset", type=float, default=0.0, help="music time where the film starts (s)")
    args = parser.parse_args(argv)
    try:
        board = json.loads(args.storyboard.read_text(encoding="utf-8"))
        beats = json.loads(args.beats.read_text(encoding="utf-8"))
        tempo = (beats.get("grid") or {}).get("tempo") or beats.get("tempo") or 120
        tolerance = args.tolerance if args.tolerance is not None else 0.5 * 60 / tempo
        synced, report = snap(board, beats, tolerance, args.min_shot, args.lead_frames, args.offset)
    except (OSError, json.JSONDecodeError, KeyError, RuntimeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    fps = synced.get("fps") or 30
    target = args.out or args.storyboard.with_name(args.storyboard.stem + ".synced.json")
    target.write_text(json.dumps(synced, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    table = markdown(report, fps)
    if args.md:
        args.md.write_text(f"# Монтажный лист\n\nТемп {tempo} BPM · допуск {tolerance:.3f} с · опережение {args.lead_frames} кадр.\n\n{table}\n", encoding="utf-8")
    print(table)
    cuts = [r for r in report if r["kind"] != "hit"]
    moved = [r for r in report if abs(r["drift"]) > 1e-6]
    unsnapped = [r for r in report if r["target"] in ("none in tolerance",)]
    worst = max((abs(r["drift"]) * fps for r in report), default=0)
    print(f"\n{len(cuts)} склеек, {len(report) - len(cuts)} ударов · сдвинуто {len(moved)} · без доли рядом: {len(unsnapped)} · макс. сдвиг {worst:.1f} кадр. → {target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
