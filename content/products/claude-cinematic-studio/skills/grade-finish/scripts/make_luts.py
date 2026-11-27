#!/usr/bin/env python3
"""Generate the grading LUTs of Claude Cinematic Studio as .cube files.

Part of Claude Cinematic Studio (grade-finish). The looks are written as
maths — tone curve, split toning, saturation by luminance — and baked into
33×33×33 3D LUTs that ffmpeg (lut3d), DaVinci Resolve, Premiere and After
Effects all read. Nothing is shipped as a binary; run this once per project.

Python 3 standard library only (ffmpeg only for --preview).

Every look shares the same film basis:
  - a filmic S-curve around a mid-grey pivot (contrast without crushing),
  - a soft highlight shoulder, so whites roll off instead of clipping,
  - a gentle toe that keeps a little detail in the blacks,
and then adds its own colour decisions on top.

Looks:
    keynote-neutral  clean product light: soft contrast, a touch of cool in
                     the shadows, highlights neutral — Apple-style launch
    teal-orange      blockbuster: shadows and greens to teal, skin and
                     highlights to orange, colour contrast up
    bleach-bypass    silver retention: desaturated, hard contrast, metallic
    warm-gold        editorial: warm mids, honey highlights, brown lifted
                     blacks, saturation slightly down
    cyber-cool       neon tech: cyan-blue shadows, magenta-leaning highlights,
                     punchy contrast
    mono-contrast    black and white film: red-filter luminance, deep blacks

Examples:
    python3 make_luts.py --list
    python3 make_luts.py --out luts/                  # all looks
    python3 make_luts.py --out luts/ --only teal-orange,warm-gold --size 65
    python3 make_luts.py --out luts/ --preview frame.png   # before/after strips
    # then: ffmpeg -i in.mp4 -vf lut3d=luts/teal-orange.cube out.mp4
"""
from __future__ import annotations

import argparse
import math
import shutil
import subprocess
import sys
from pathlib import Path

Rgb = tuple[float, float, float]


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return lo if x < lo else hi if x > hi else x


def luma(c: Rgb) -> float:
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def s_curve(x: float, contrast: float, pivot: float = 0.42) -> float:
    """Filmic contrast: a power-based S that keeps 0 → 0 and 1 → 1 and pivots at mid-grey."""
    x = clamp(x)
    if x < pivot:
        return pivot * (x / pivot) ** contrast
    return 1 - (1 - pivot) * ((1 - x) / (1 - pivot)) ** contrast


def shoulder(x: float, start: float = 0.78) -> float:
    """Soft roll-off above `start`: highlights compress instead of clipping."""
    if x <= start:
        return x
    span = 1 - start
    k = (x - start) / span
    return start + span * (1 - math.exp(-k * 1.6)) / (1 - math.exp(-1.6))


def toe(x: float, lift: float) -> float:
    """Lift the blacks a little: lift 0.02 means pure black lands at 2 %."""
    return lift + x * (1 - lift)


def tone(c: Rgb, contrast: float, lift: float = 0.0, roll: float = 0.78) -> Rgb:
    return tuple(toe(shoulder(s_curve(v, contrast), roll), lift) for v in c)  # type: ignore[return-value]


def saturate(c: Rgb, amount: float) -> Rgb:
    y = luma(c)
    return tuple(clamp(y + (v - y) * amount) for v in c)  # type: ignore[return-value]


def split_tone(c: Rgb, shadow: Rgb, highlight: Rgb, strength_s: float, strength_h: float, balance: float = 0.5) -> Rgb:
    """Add colour to shadows and highlights by luminance, keeping luminance about the same."""
    y = luma(c)
    ws = clamp(1 - y / max(balance, 1e-3)) ** 1.5
    wh = clamp((y - balance) / max(1 - balance, 1e-3)) ** 1.2
    out = [v + (s - 0.5) * strength_s * ws + (h - 0.5) * strength_h * wh for v, s, h in zip(c, shadow, highlight)]
    y2 = luma(tuple(out))  # type: ignore[arg-type]
    return tuple(clamp(v + (y - y2)) for v in out)  # type: ignore[return-value]


def hue_push(c: Rgb, towards_teal: float, towards_orange: float) -> Rgb:
    """Teal-orange separation: warm hues pulled to orange, cool and green hues to teal."""
    r, g, b = c
    warmth = r - b  # > 0 for skin, fire, sunsets
    y = luma(c)
    orange = (1.0, 0.62, 0.32)
    teal = (0.16, 0.55, 0.62)
    if warmth > 0:
        k = clamp(warmth * 2.2) * towards_orange
        target = tuple(y + (o - luma(orange)) * 0.9 for o in orange)
    else:
        k = clamp(-warmth * 2.2 + max(0.0, g - r) * 1.5) * towards_teal
        target = tuple(y + (t - luma(teal)) * 0.9 for t in teal)
    return tuple(clamp(v + (t - v) * k) for v, t in zip(c, target))  # type: ignore[return-value]


# ------------------------------------------------------------------------- looks


def keynote_neutral(c: Rgb) -> Rgb:
    c = tone(c, 1.18, lift=0.005, roll=0.8)
    c = split_tone(c, (0.44, 0.48, 0.56), (0.5, 0.5, 0.5), 0.10, 0.0, 0.4)
    return saturate(c, 0.94)


def teal_orange(c: Rgb) -> Rgb:
    c = hue_push(c, 0.55, 0.45)
    c = tone(c, 1.32, lift=0.01, roll=0.76)
    c = split_tone(c, (0.30, 0.54, 0.60), (0.66, 0.53, 0.38), 0.34, 0.2, 0.45)
    return saturate(c, 1.1)


def bleach_bypass(c: Rgb) -> Rgb:
    y = luma(c)
    c = tuple(v * 0.5 + y * 0.5 for v in c)  # type: ignore[assignment]
    # Overlay of the image with its own luminance: silver contrast.
    def overlay(a: float, b: float) -> float:
        return 2 * a * b if b < 0.5 else 1 - 2 * (1 - a) * (1 - b)
    c = tuple(clamp(overlay(v, y) * 0.45 + v * 0.55) for v in c)  # type: ignore[assignment]
    return tone(c, 1.2, lift=0.012, roll=0.8)


def warm_gold(c: Rgb) -> Rgb:
    c = tone(c, 1.16, lift=0.025, roll=0.74)
    c = split_tone(c, (0.58, 0.5, 0.42), (0.66, 0.56, 0.38), 0.18, 0.26, 0.42)
    return saturate(c, 0.88)


def cyber_cool(c: Rgb) -> Rgb:
    c = tone(c, 1.35, lift=0.008, roll=0.75)
    c = split_tone(c, (0.34, 0.52, 0.66), (0.58, 0.46, 0.60), 0.26, 0.10, 0.48)
    return saturate(c, 1.08)


def mono_contrast(c: Rgb) -> Rgb:
    # Red-filter black and white: skies darker, skin lighter.
    y = clamp(0.5 * c[0] + 0.42 * c[1] + 0.08 * c[2])
    y = s_curve(y, 1.4, 0.45)
    y = shoulder(y, 0.8)
    return (y, y, y)


LOOKS = {
    "keynote-neutral": (keynote_neutral, "Clean product light, soft contrast, cool shadows"),
    "teal-orange": (teal_orange, "Blockbuster colour contrast: teal shadows, orange skin and highlights"),
    "bleach-bypass": (bleach_bypass, "Silver retention: desaturated, hard, metallic"),
    "warm-gold": (warm_gold, "Editorial warmth: honey highlights, brown lifted blacks"),
    "cyber-cool": (cyber_cool, "Neon tech: cyan-blue shadows, magenta-leaning highlights"),
    "mono-contrast": (mono_contrast, "Black and white film with a red filter"),
}


def write_cube(path: Path, name: str, fn, size: int) -> None:
    lines = [f'TITLE "{name} - Claude Cinematic Studio"', f"LUT_3D_SIZE {size}", "DOMAIN_MIN 0.0 0.0 0.0", "DOMAIN_MAX 1.0 1.0 1.0", ""]
    step = 1 / (size - 1)
    # .cube order: red changes fastest, then green, then blue.
    for bi in range(size):
        for gi in range(size):
            for ri in range(size):
                r, g, b = fn((ri * step, gi * step, bi * step))
                lines.append(f"{clamp(r):.6f} {clamp(g):.6f} {clamp(b):.6f}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="ascii")


def preview(image: Path, luts: list[Path], out_dir: Path) -> list[Path]:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is needed for --preview")
    made = []
    for lut in luts:
        target = out_dir / f"preview-{lut.stem}.jpg"
        graph = (
            f"[0:v]scale=960:-2,split[a][b];[b]lut3d=file='{lut.as_posix()}'[g];"
            f"[a]drawtext=text='before':x=20:y=20:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.5[a2];"
            f"[g]drawtext=text='{lut.stem}':x=20:y=20:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.5[g2];[a2][g2]hstack"
        )
        cmd = [ffmpeg, "-v", "error", "-y", "-i", str(image), "-filter_complex", graph, "-frames:v", "1", "-q:v", "3", str(target)]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            # drawtext needs a font backend; fall back to a plain strip.
            graph = f"[0:v]scale=960:-2,split[a][b];[b]lut3d=file='{lut.as_posix()}'[g];[a][g]hstack"
            subprocess.run([ffmpeg, "-v", "error", "-y", "-i", str(image), "-filter_complex", graph, "-frames:v", "1", "-q:v", "3", str(target)], check=True)
        made.append(target)
    return made


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Generate cinematic grading LUTs (.cube).")
    parser.add_argument("--list", action="store_true", help="list the looks and exit")
    parser.add_argument("--out", type=Path, default=Path("luts"), help="directory for the .cube files")
    parser.add_argument("--only", help="comma-separated look names")
    parser.add_argument("--size", type=int, default=33, help="grid size: 33 (standard) or 65 (smoother, larger)")
    parser.add_argument("--preview", type=Path, help="an image: write before/after strips for every LUT")
    args = parser.parse_args(argv)

    if args.list:
        for name, (_, about) in LOOKS.items():
            print(f"{name:16s} {about}")
        return 0
    names = [n.strip() for n in args.only.split(",")] if args.only else list(LOOKS)
    unknown = [n for n in names if n not in LOOKS]
    if unknown:
        print(f"error: unknown look(s): {', '.join(unknown)} — see --list", file=sys.stderr)
        return 1
    written = []
    for name in names:
        path = args.out / f"{name}.cube"
        write_cube(path, name, LOOKS[name][0], args.size)
        written.append(path)
        print(f"{path}  ({args.size}³)")
    if args.preview:
        try:
            for p in preview(args.preview, written, args.out):
                print(f"preview → {p}")
        except (RuntimeError, subprocess.CalledProcessError) as error:
            print(f"error: {error}", file=sys.stderr)
            return 1
    print(f"{len(written)} LUTs → {args.out}/  (ffmpeg: -vf lut3d=file.cube; Resolve/Premiere/AE: import .cube)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
