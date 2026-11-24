#!/usr/bin/env python3
"""Look at a rendered video the way a picky editor would — with ffmpeg.

Subcommands:
  sheet      contact sheet: N frames in a grid, one PNG the agent can look at
  frames     single frames at given seconds, full size
  probe      codec, pixel format, size, fps, duration, bitrate, faststart —
             checked against a platform's requirements
  loudness   integrated loudness (LUFS) and true peak against a target
  safezone   one frame with the areas that the platform's buttons and
             captions cover shaded in red

Needs ffmpeg and ffprobe on PATH. Python 3 standard library only.

Examples:
    python3 review.py sheet out/reel.mp4 --count 12 --out review/sheet.png
    python3 review.py frames out/reel.mp4 --at 0.5 2 7.25 --out review/
    python3 review.py probe out/reel.mp4 --platform reels
    python3 review.py loudness out/reel.mp4 --platform reels
    python3 review.py safezone out/reel.mp4 --at 3 --platform tiktok --out review/safe.png
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

# Requirements and conventions as of 2026. Platforms change them; the numbers
# here are conservative values that pass everywhere we know of.
PLATFORMS = {
    "reels": {"aspect": (9, 16), "min_height": 1280, "max_seconds": 180, "max_mb": 4000, "lufs": -14, "safe": {"top": 0.14, "bottom": 0.22, "left": 0.04, "right": 0.13, "right_from": 0.5}},
    "tiktok": {"aspect": (9, 16), "min_height": 1280, "max_seconds": 600, "max_mb": 4000, "lufs": -14, "safe": {"top": 0.12, "bottom": 0.24, "left": 0.04, "right": 0.15, "right_from": 0.45}},
    "shorts": {"aspect": (9, 16), "min_height": 1280, "max_seconds": 180, "max_mb": 4000, "lufs": -14, "safe": {"top": 0.11, "bottom": 0.2, "left": 0.04, "right": 0.12, "right_from": 0.5}},
    "feed": {"aspect": (4, 5), "min_height": 1350, "max_seconds": 3600, "max_mb": 4000, "lufs": -14, "safe": {"top": 0.0, "bottom": 0.0, "left": 0.0, "right": 0.0}},
    "square": {"aspect": (1, 1), "min_height": 1080, "max_seconds": 3600, "max_mb": 4000, "lufs": -14, "safe": {"top": 0.0, "bottom": 0.0, "left": 0.0, "right": 0.0}},
    "youtube": {"aspect": (16, 9), "min_height": 1080, "max_seconds": 43200, "max_mb": 256000, "lufs": -14, "safe": {"top": 0.0, "bottom": 0.1, "left": 0.0, "right": 0.0}},
    "web": {"aspect": None, "min_height": 720, "max_seconds": 120, "max_mb": 8, "lufs": -16, "safe": {"top": 0.0, "bottom": 0.0, "left": 0.0, "right": 0.0}},
    "telegram": {"aspect": None, "min_height": 720, "max_seconds": 3600, "max_mb": 2000, "lufs": -16, "safe": {"top": 0.0, "bottom": 0.0, "left": 0.0, "right": 0.0}},
}


def need(tool: str) -> str:
    path = shutil.which(tool)
    if not path:
        raise RuntimeError(f"{tool} not found — install ffmpeg (macOS: brew install ffmpeg; Windows: winget install ffmpeg)")
    return path


def run(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True, check=False)


def probe_data(video: Path) -> dict:
    result = run([need("ffprobe"), "-v", "error", "-show_format", "-show_streams", "-of", "json", str(video)])
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or f"ffprobe could not read {video}")
    return json.loads(result.stdout)


def duration_of(video: Path) -> float:
    return float(probe_data(video)["format"]["duration"])


def faststart(video: Path) -> bool | None:
    """True when the index (moov) comes before the media (mdat): plays before it fully downloads."""
    try:
        with open(video, "rb") as handle:
            offset = 0
            size = video.stat().st_size
            while offset < size:
                handle.seek(offset)
                header = handle.read(16)
                if len(header) < 8:
                    return None
                length = int.from_bytes(header[:4], "big")
                kind = header[4:8]
                if length == 1:
                    length = int.from_bytes(header[8:16], "big")
                if kind == b"moov":
                    return True
                if kind == b"mdat":
                    return False
                if length < 8:
                    return None
                offset += length
    except OSError:
        return None
    return None


# ---------------------------------------------------------------- commands


def cmd_sheet(args) -> int:
    data = probe_data(args.video)
    video = next(s for s in data["streams"] if s["codec_type"] == "video")
    num, den = (int(x) for x in video.get("avg_frame_rate", "30/1").split("/"))
    fps = num / den if den else 30
    total = float(data["format"]["duration"])
    count = max(1, args.count)
    # Midpoints of equal slices: never the black first frame or the last.
    times = [total * (i + 0.5) / count for i in range(count)]
    picks = sorted({min(int(t * fps), max(0, int(total * fps) - 1)) for t in times})
    cols = args.cols or (count if count <= 4 else 4)
    rows = -(-len(picks) // cols)
    out = args.out or args.video.with_suffix(".sheet.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    select = "+".join(f"eq(n\\,{n})" for n in picks)
    graph = f"select='{select}',scale={args.width}:-2,tile={cols}x{rows}:padding=6:color=black"
    result = run([need("ffmpeg"), "-v", "error", "-y", "-i", str(args.video), "-vf", graph, "-fps_mode", "vfr", "-frames:v", "1", str(out)])
    if result.returncode:
        print(result.stderr.strip(), file=sys.stderr)
        return 1
    print(json.dumps({"sheet": str(out), "grid": f"{cols}x{rows}", "times": [round(n / fps, 2) for n in picks], "read": "left to right, top to bottom"}, ensure_ascii=False, indent=2))
    return 0


def cmd_frames(args) -> int:
    out = args.out or args.video.parent
    out.mkdir(parents=True, exist_ok=True)
    written = []
    for t in args.at:
        target = out / f"{args.video.stem}-{t:06.2f}s.png"
        result = run([need("ffmpeg"), "-v", "error", "-y", "-ss", str(t), "-i", str(args.video), "-frames:v", "1", str(target)])
        if result.returncode:
            print(result.stderr.strip(), file=sys.stderr)
            return 1
        written.append(str(target))
    print(json.dumps({"frames": written}, ensure_ascii=False, indent=2))
    return 0


def cmd_probe(args) -> int:
    data = probe_data(args.video)
    video = next((s for s in data["streams"] if s["codec_type"] == "video"), None)
    audio = next((s for s in data["streams"] if s["codec_type"] == "audio"), None)
    if not video:
        print("error: no video stream", file=sys.stderr)
        return 1
    num, den = (int(x) for x in video.get("avg_frame_rate", "0/1").split("/"))
    fps = num / den if den else 0
    width, height = int(video["width"]), int(video["height"])
    seconds = float(data["format"]["duration"])
    megabytes = int(data["format"]["size"]) / 1_000_000
    facts = {
        "codec": video.get("codec_name"),
        "profile": video.get("profile"),
        "pixel_format": video.get("pix_fmt"),
        "size": f"{width}×{height}",
        "fps": round(fps, 3),
        "duration": round(seconds, 3),
        "megabytes": round(megabytes, 2),
        "bitrate_mbps": round(int(data["format"].get("bit_rate", 0)) / 1_000_000, 2),
        "audio": None if not audio else f"{audio.get('codec_name')} {audio.get('sample_rate')} Hz, {audio.get('channels')} ch",
        "faststart": faststart(args.video),
    }
    problems, notes = [], []
    if facts["codec"] != "h264":
        problems.append(f"codec {facts['codec']} — H.264 plays everywhere; re-encode with --codec h264")
    if facts["pixel_format"] != "yuv420p":
        problems.append(f"pixel format {facts['pixel_format']} — use yuv420p or some phones and browsers show green or nothing")
    if width % 2 or height % 2:
        problems.append("odd width or height — H.264 needs even numbers")
    if fps not in (24, 25, 30, 50, 60) and abs(fps - round(fps)) > 0.01:
        notes.append(f"{fps:.3f} fps — fine, but 24/25/30/60 are the usual rates")
    if facts["faststart"] is False:
        problems.append("index at the end of the file — web players must download it all before playing; fix: ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4")
    if args.platform:
        spec = PLATFORMS[args.platform]
        if spec["aspect"]:
            a, b = spec["aspect"]
            if abs(width / height - a / b) > 0.01:
                problems.append(f"{width}×{height} is not {a}:{b}, which {args.platform} expects — the platform will crop or letterbox it")
        if min(width, height) < min(spec["min_height"], 1080) and max(width, height) < spec["min_height"]:
            problems.append(f"{width}×{height} is below {spec['min_height']} px on the long side — it will look soft")
        if seconds > spec["max_seconds"]:
            problems.append(f"{seconds:.0f} s is longer than {spec['max_seconds']} s allowed for {args.platform}")
        if megabytes > spec["max_mb"]:
            problems.append(f"{megabytes:.1f} MB is over {spec['max_mb']} MB for {args.platform}")
        if args.platform in ("reels", "tiktok", "shorts") and not audio:
            notes.append("no audio track — platforms push silent clips less; add music or at least a quiet track")
    print(json.dumps({"facts": facts, "problems": problems, "notes": notes, "ok": not problems}, ensure_ascii=False, indent=2))
    return 0 if not problems else 2


def cmd_loudness(args) -> int:
    data = probe_data(args.video)
    if not any(s["codec_type"] == "audio" for s in data["streams"]):
        print(json.dumps({"audio": None, "note": "no audio track"}, ensure_ascii=False))
        return 0
    result = run([need("ffmpeg"), "-hide_banner", "-nostats", "-i", str(args.video), "-filter_complex", "ebur128=peak=true", "-f", "null", "-"])
    summary = result.stderr[result.stderr.rfind("Summary:") :]
    integrated = re.search(r"I:\s+(-?[\d.]+) LUFS", summary)
    peak = re.search(r"Peak:\s+(-?[\d.]+) dBFS", summary)
    lra = re.search(r"LRA:\s+(-?[\d.]+) LU", summary)
    if not integrated:
        print("error: could not measure loudness", file=sys.stderr)
        return 1
    target = args.target if args.target is not None else PLATFORMS.get(args.platform or "reels")["lufs"]
    lufs = float(integrated.group(1))
    true_peak = float(peak.group(1)) if peak else None
    advice = []
    if abs(lufs - target) > 1.5:
        advice.append(
            f"{lufs:.1f} LUFS vs target {target} — normalise: ffmpeg -i in.mp4 -c:v copy -af loudnorm=I={target}:TP=-1.5:LRA=11 -c:a aac -b:a 192k out.mp4"
        )
    if true_peak is not None and true_peak > -1.0:
        advice.append(f"true peak {true_peak:.1f} dBFS — above −1 dBFS, may clip after the platform re-encodes")
    print(json.dumps({"integrated_lufs": lufs, "true_peak_dbfs": true_peak, "loudness_range_lu": float(lra.group(1)) if lra else None, "target_lufs": target, "advice": advice, "ok": not advice}, ensure_ascii=False, indent=2))
    return 0 if not advice else 2


def cmd_safezone(args) -> int:
    spec = PLATFORMS[args.platform]["safe"]
    data = probe_data(args.video)
    video = next(s for s in data["streams"] if s["codec_type"] == "video")
    w, h = int(video["width"]), int(video["height"])
    out = args.out or args.video.with_suffix(f".safe-{args.platform}.png")
    out.parent.mkdir(parents=True, exist_ok=True)
    boxes = []
    if spec["top"]:
        boxes.append((0, 0, w, round(h * spec["top"])))
    if spec["bottom"]:
        boxes.append((0, h - round(h * spec["bottom"]), w, round(h * spec["bottom"])))
    if spec["left"]:
        boxes.append((0, 0, round(w * spec["left"]), h))
    if spec["right"]:
        # The like / comment / share column sits on the right, from about the middle down.
        top = round(h * spec.get("right_from", spec["top"]))
        boxes.append((w - round(w * spec["right"]), top, round(w * spec["right"]), h - round(h * spec["bottom"]) - top))
    draw = ",".join(f"drawbox=x={x}:y={y}:w={bw}:h={bh}:color=red@0.35:t=fill" for x, y, bw, bh in boxes) or "null"
    inner = f"drawbox=x={round(w * spec['left'])}:y={round(h * spec['top'])}:w={w - round(w * spec['left']) - (round(w * spec['right']) if not spec.get('right_from') else 0)}:h={h - round(h * (spec['top'] + spec['bottom']))}:color=lime@0.9:t=4"
    result = run([need("ffmpeg"), "-v", "error", "-y", "-ss", str(args.at), "-i", str(args.video), "-vf", f"{draw},{inner}", "-frames:v", "1", str(out)])
    if result.returncode:
        print(result.stderr.strip(), file=sys.stderr)
        return 1
    print(json.dumps({"frame": str(out), "at": args.at, "platform": args.platform, "covered": spec, "rule": "nothing important in the red (the right column is the buttons, from the middle down); text and faces inside the green frame"}, ensure_ascii=False, indent=2))
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Review a rendered video with ffmpeg: contact sheet, frames, specs, loudness, safe zones.")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("sheet", help="contact sheet of evenly spaced frames")
    p.add_argument("video", type=Path)
    p.add_argument("--count", type=int, default=12)
    p.add_argument("--cols", type=int)
    p.add_argument("--width", type=int, default=480, help="width of each frame in the sheet, px")
    p.add_argument("--out", type=Path)
    p.set_defaults(run=cmd_sheet)

    p = sub.add_parser("frames", help="full-size frames at given seconds")
    p.add_argument("video", type=Path)
    p.add_argument("--at", type=float, nargs="+", required=True)
    p.add_argument("--out", type=Path, help="folder")
    p.set_defaults(run=cmd_frames)

    p = sub.add_parser("probe", help="technical check against a platform")
    p.add_argument("video", type=Path)
    p.add_argument("--platform", choices=sorted(PLATFORMS))
    p.set_defaults(run=cmd_probe)

    p = sub.add_parser("loudness", help="LUFS and true peak")
    p.add_argument("video", type=Path)
    p.add_argument("--platform", choices=sorted(PLATFORMS))
    p.add_argument("--target", type=float, help="target LUFS (default from platform, −14)")
    p.set_defaults(run=cmd_loudness)

    p = sub.add_parser("safezone", help="frame with platform UI areas shaded")
    p.add_argument("video", type=Path)
    p.add_argument("--at", type=float, default=1.0)
    p.add_argument("--platform", choices=sorted(PLATFORMS), default="reels")
    p.add_argument("--out", type=Path)
    p.set_defaults(run=cmd_safezone)

    args = parser.parse_args(argv)
    try:
        return args.run(args)
    except (RuntimeError, OSError, KeyError, ValueError, StopIteration) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
