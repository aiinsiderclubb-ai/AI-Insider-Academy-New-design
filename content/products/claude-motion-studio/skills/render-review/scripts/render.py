#!/usr/bin/env python3
"""Render a composition from the Remotion project, then make a web copy.

Wraps `npx remotion render` so drafts and finals are always made the same way:

  draft   half size, faster encode — for looking at motion and timing
  final   full size, high quality (CRF 18), H.264 + yuv420p + faststart
  web     final, then a small copy for a site or a chat: 720p long side 1280,
          no audio unless --keep-audio, under --max-mb

Run from the project folder (where package.json is).

Examples:
    python3 render.py KineticType --draft
    python3 render.py DataStory --props props/chart.json --out out/chart.mp4
    python3 render.py ProductPromo --web --max-mb 3
    python3 render.py KineticType --frames 0-90          # first 3 seconds only
    python3 render.py LogoSting --still 100 --out out/logo.png
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path


def npx() -> str:
    found = shutil.which("npx") or shutil.which("npx.cmd")
    if not found:
        raise RuntimeError("npx not found — install Node.js 18 or newer from nodejs.org")
    return found


def ffmpeg_tool(name: str) -> str:
    found = shutil.which(name)
    if not found:
        raise RuntimeError(f"{name} not found — install ffmpeg (macOS: brew install ffmpeg; Windows: winget install ffmpeg)")
    return found


def size_of(path: Path) -> tuple[int, int, float]:
    out = subprocess.run(
        [ffmpeg_tool("ffprobe"), "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", str(path)],
        capture_output=True, text=True, check=True,
    )
    data = json.loads(out.stdout)
    stream = data["streams"][0]
    return int(stream["width"]), int(stream["height"]), float(data["format"]["duration"])


def web_copy(source: Path, target: Path, max_mb: float, keep_audio: bool) -> dict:
    """720p-class H.264 that starts playing before it has downloaded."""
    width, height, duration = size_of(source)
    long_side = 1280
    scale = f"scale={long_side}:-2" if width >= height else f"scale=-2:{long_side}"
    # Try quality steps until the file fits.
    for crf in (20, 23, 26, 29, 32):
        command = [ffmpeg_tool("ffmpeg"), "-v", "error", "-y", "-i", str(source), "-vf", f"{scale}:flags=lanczos,format=yuv420p",
                   "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", str(crf), "-movflags", "+faststart"]
        command += ["-c:a", "aac", "-b:a", "128k"] if keep_audio else ["-an"]
        subprocess.run(command + [str(target)], check=True)
        mb = target.stat().st_size / 1_000_000
        if mb <= max_mb:
            return {"web": str(target), "megabytes": round(mb, 2), "crf": crf, "seconds": round(duration, 2)}
    return {"web": str(target), "megabytes": round(mb, 2), "crf": 32, "warning": f"still over {max_mb} MB — shorten the video or lower its size"}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Render a Remotion composition: draft, final or web copy.")
    parser.add_argument("composition", help="id from src/Root.tsx, e.g. KineticType")
    parser.add_argument("--props", type=Path, help="JSON file with props (overrides the defaults in Root.tsx)")
    parser.add_argument("--out", type=Path, help="output file (default: out/<Composition>.mp4)")
    parser.add_argument("--draft", action="store_true", help="half size and quick encode, for checking motion")
    parser.add_argument("--web", action="store_true", help="also write a small web copy next to the final")
    parser.add_argument("--max-mb", type=float, default=4.0, help="size limit for the web copy, MB (default 4)")
    parser.add_argument("--keep-audio", action="store_true", help="keep sound in the web copy")
    parser.add_argument("--frames", help="render only a range, e.g. 0-89")
    parser.add_argument("--still", type=int, help="render one frame as PNG instead of a video")
    parser.add_argument("--size", help="override WIDTHxHEIGHT; the layout must be written to adapt (see SKILL.md)")
    parser.add_argument("--project", type=Path, default=Path("."), help="project folder (default: current)")
    args = parser.parse_args(argv)

    project = args.project.resolve()
    if not (project / "package.json").exists():
        print(f"error: no package.json in {project} — run from the motion project, or pass --project", file=sys.stderr)
        return 1
    if not (project / "node_modules").exists():
        print("error: dependencies are not installed — run `npm install` in the project first", file=sys.stderr)
        return 1

    try:
        if args.still is not None:
            out = args.out or project / "out" / f"{args.composition}-{args.still}.png"
            command = [npx(), "remotion", "still", args.composition, str(out), f"--frame={args.still}"]
        else:
            suffix = "-draft" if args.draft else ""
            out = args.out or project / "out" / f"{args.composition}{suffix}.mp4"
            command = [npx(), "remotion", "render", args.composition, str(out)]
            if args.draft:
                command += ["--scale=0.5", "--crf=28"]
            else:
                command += ["--crf=18"]
            if args.frames:
                command += [f"--frames={args.frames}"]
        if args.props:
            command += [f"--props={args.props.resolve()}"]
        if args.size:
            width, _, height = args.size.lower().partition("x")
            command += [f"--width={int(width)}", f"--height={int(height)}"]
        out.parent.mkdir(parents=True, exist_ok=True)
        started = time.time()
        result = subprocess.run(command, cwd=project)
        if result.returncode:
            print("error: render failed — read the Remotion error above; common causes are in render-review/references/troubleshooting.md", file=sys.stderr)
            return result.returncode
        report = {"output": str(out), "seconds_to_render": round(time.time() - started, 1)}
        if args.web and args.still is None:
            report.update(web_copy(out, out.with_name(out.stem + "-web.mp4"), args.max_mb, args.keep_audio))
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0
    except (RuntimeError, subprocess.CalledProcessError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
