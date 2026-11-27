#!/usr/bin/env python3
"""Turn a video clip into a numbered PNG sequence the Remotion project can play.

Why a sequence and not the video file: a frame folder lets a scene pick any
source frame for any output frame. That is what makes speed ramps, freezes,
reverse and frame-accurate mattes and tracks possible — every tool in this
skill (matte.py, track.py) reads and writes the same numbered frames.

How it works:
  1. ffmpeg cuts the requested range (--start/--length), resamples to --fps
     and scales to --width (height follows the aspect, rounded to even).
  2. With --slowmo N, ffmpeg's motion-compensated interpolation (minterpolate,
     mci) builds N× more frames, so a 4× slow-down stays smooth instead of
     repeating frames. Interpolation guesses in-between motion: check fast,
     overlapping action (hands, hair) for warping.
  3. Frames land in <out>/<name>/plate/frame_00001.png …, with meta.json:

       {"name": "shot1", "fps": 30, "count": 180, "width": 1080,
        "height": 1920, "source": "clip.mp4", "start": 2.0, "slowmo": 1}

     With --slowmo N, "fps" stays the source rate and "slowmo" is N: the
     sequence holds fps × N frames per second of real action. The template's
     <Plate> reads both, so `realtime` plays it at real speed and a speedRamp
     key of 0.25 is a smooth 4× slow motion with no repeated frames.

Examples:
    python3 frames.py clip.mp4 --name shot1 --out public/footage
    python3 frames.py clip.mov --start 3.2 --length 4 --width 1080 --name hero
    python3 frames.py clip.mp4 --name ramp --fps 30 --slowmo 4
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path


def probe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
         "stream=width,height,r_frame_rate,nb_frames:format=duration", "-of", "json", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    data = json.loads(out)
    stream = data["streams"][0]
    num, den = (int(x) for x in stream["r_frame_rate"].split("/"))
    return {
        "width": int(stream["width"]),
        "height": int(stream["height"]),
        "fps": num / den if den else 30.0,
        "duration": float(data.get("format", {}).get("duration") or 0),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video", type=Path, help="source clip (any format ffmpeg reads)")
    ap.add_argument("--name", help="sequence name (default: file stem)")
    ap.add_argument("--out", type=Path, default=Path("public/footage"), help="parent folder (default public/footage)")
    ap.add_argument("--fps", type=float, help="output frame rate (default: source rate)")
    ap.add_argument("--start", type=float, default=0.0, help="start time in seconds")
    ap.add_argument("--length", type=float, help="seconds to take (default: to the end)")
    ap.add_argument("--width", type=int, help="scale to this width, keeping the aspect")
    ap.add_argument("--slowmo", type=int, default=1, help="interpolate N× more frames with optical flow (2–8)")
    ap.add_argument("--force", action="store_true", help="replace an existing sequence of the same name")
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        print("ffmpeg is required: https://ffmpeg.org/download.html", file=sys.stderr)
        return 2
    if not args.video.exists():
        print(f"No such file: {args.video}", file=sys.stderr)
        return 2
    if not 1 <= args.slowmo <= 8:
        print("--slowmo must be between 1 and 8", file=sys.stderr)
        return 2

    info = probe(args.video)
    name = args.name or args.video.stem
    seq = args.out / name
    plate = seq / "plate"
    if plate.exists():
        if not args.force:
            print(f"{plate} already exists; pass --force to replace it", file=sys.stderr)
            return 2
        shutil.rmtree(plate)
    plate.mkdir(parents=True)

    fps = args.fps or round(info["fps"], 3)
    filters = [f"fps={fps}"]
    if args.width:
        filters.append(f"scale={args.width}:-2:flags=lanczos")
    if args.slowmo > 1:
        filters.append(f"minterpolate=fps={fps * args.slowmo}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1")
    cmd = ["ffmpeg", "-v", "error", "-y", "-ss", f"{args.start}", "-i", str(args.video)]
    if args.length:
        cmd += ["-t", f"{args.length}"]
    cmd += ["-vf", ",".join(filters), "-pix_fmt", "rgb24", str(plate / "frame_%05d.png")]
    print("ffmpeg:", " ".join(cmd[cmd.index("-vf") + 1:cmd.index("-vf") + 2]))
    subprocess.run(cmd, check=True)

    frames = sorted(plate.glob("frame_*.png"))
    if not frames:
        print("ffmpeg wrote no frames — check --start/--length against the clip", file=sys.stderr)
        return 1
    w, h = info["width"], info["height"]
    if args.width:
        w, h = args.width, int(round(info["height"] * args.width / info["width"] / 2) * 2)
    meta = {
        "name": name,
        "fps": fps,
        "count": len(frames),
        "width": w,
        "height": h,
        "source": args.video.name,
        "start": args.start,
        "slowmo": args.slowmo,
    }
    (seq / "meta.json").write_text(json.dumps(meta, indent=1))
    secs = len(frames) / (fps * args.slowmo)
    print(f"{len(frames)} frames {w}×{h} → {plate}  ({secs:.2f} s of action at {fps:g} fps"
          + (f", {args.slowmo}× interpolated: smooth down to {100 / args.slowmo:g}% speed" if args.slowmo > 1 else "") + ")")
    return 0


if __name__ == "__main__":
    sys.exit(main())
