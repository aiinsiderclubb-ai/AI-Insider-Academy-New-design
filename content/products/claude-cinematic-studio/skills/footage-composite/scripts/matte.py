#!/usr/bin/env python3
"""Cut the subject out of a plate: a matte and an RGBA cutout for every frame.

The cutout is what lets 3D type and graphics pass BEHIND a person or product:
the scene stacks plate → 3D layer → cutout, so the subject is drawn over the
graphics again. This is rotoscoping, done per frame with four methods:

  person  People. MediaPipe's selfie segmenter (Tasks API) — give the model
          file with --model (selfie_segmenter.tflite or
          selfie_multiclass_256x256.tflite from Google's MediaPipe model page).
  key     Green or blue screen: distance from --color in YCrCb, with
          --tolerance (fully keyed) and --softness (edge ramp), plus despill.
  luma    Bright subject on a dark background (or --invert for dark on
          light): smooth threshold on luminance between --low and --high.
  object  Anything else: GrabCut, seeded by a --box on frame 1. Every next
          frame starts from the previous mask (dilated as "probably
          foreground"), and the box can follow a track JSON from track.py
          (--track), so a moving product keeps its matte. Holes inside the
          subject are filled, so it suits solid things (products, bottles,
          devices), not lace or hair.

Edge clean-up, same for every mode:
  --choke N    shrink the matte by N px (removes background fringe)
  --feather N  soften the edge by N px (Gaussian)
  --smooth N   temporal median over N neighbouring frames (kills edge chatter)

Output, next to plate/ in the sequence folder:
    matte/frame_00001.png    8-bit grey, white = subject
    cutout/frame_00001.png   RGBA, the plate with the matte as alpha
(--out-name changes "cutout", e.g. to keep a test beside a rendered cutout.)

Examples:
    python3 matte.py public/footage/hero --mode key --color 0,177,64 --choke 1 --feather 2
    python3 matte.py public/footage/device --mode luma --low 0.08 --high 0.2 --smooth 3
    python3 matte.py public/footage/shot1 --mode object --box 0.3,0.2,0.4,0.7 --track public/footage/shot1/track-product.json
    python3 matte.py public/footage/talk --mode person --model models/selfie_segmenter.tflite --feather 2 --smooth 5
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np


def parse_box(text: str):
    try:
        x, y, w, h = (float(v) for v in text.split(","))
    except ValueError:
        raise SystemExit("--box needs four numbers: x,y,w,h (0–1 from the top-left)")
    return x, y, w, h


def smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / max(edge1 - edge0, 1e-6), 0, 1)
    return t * t * (3 - 2 * t)


# ----------------------------------------------------------------- modes


def matte_key(img, color, tolerance, softness):
    ycc = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb).astype(np.float32)
    key = cv2.cvtColor(np.uint8([[color[::-1]]]), cv2.COLOR_BGR2YCrCb).astype(np.float32)[0, 0]
    # Chroma distance only: lighting changes on the screen move Y, not Cr/Cb.
    dist = np.linalg.norm(ycc[..., 1:] - key[1:], axis=2)
    return smoothstep(tolerance, tolerance + softness, dist)


def despill(img, matte, color):
    """Pull the key colour out of edge pixels so the subject has no green rim."""
    out = img.astype(np.float32)
    ch = int(np.argmax(color[::-1]))  # BGR channel of the screen colour
    others = [c for c in range(3) if c != ch]
    limit = np.maximum(out[..., others[0]], out[..., others[1]])
    spill = np.clip(out[..., ch] - limit, 0, None)
    edge = (1 - matte) * 0 + 1  # despill everywhere the subject is; cheap and effective
    out[..., ch] -= spill * edge
    return np.clip(out, 0, 255).astype(np.uint8)


def matte_luma(img, low, high, invert):
    y = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    m = smoothstep(low, high, y)
    return 1 - m if invert else m


def largest_component(m):
    """Keep the biggest connected blob (drops specks from noise or reflections)."""
    binary = (m > 0.5).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(binary, 8)
    if n <= 2:
        return m
    biggest = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    keep = (labels == biggest).astype(np.float32)
    keep = cv2.dilate(keep, np.ones((5, 5), np.uint8))
    return m * keep


def fill_holes(m):
    """Fill background pockets that do not touch the frame edge (holes in a solid subject)."""
    binary = (m > 0.5).astype(np.uint8)
    h, w = binary.shape
    flood = binary.copy()
    canvas = np.zeros((h + 2, w + 2), np.uint8)
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if flood[y, x] == 0:
            cv2.floodFill(flood, canvas, (x, y), 2)
    holes = flood == 0
    out = m.copy()
    out[holes] = 1.0
    return out


class ObjectMatter:
    """GrabCut per frame, seeded by a box and then by the previous mask."""

    def __init__(self, box, track):
        self.box = box
        self.track = {f["f"]: f for f in track["frames"]} if track else None
        self.prev = None

    def box_for(self, index, w, h):
        x, y, bw, bh = self.box
        if self.track and (index + 1) in self.track and 1 in self.track:
            t0, t = self.track[1], self.track[index + 1]
            cx = (x + bw / 2) + (t["x"] - t0["x"])
            cy = (y + bh / 2) + (t["y"] - t0["y"])
            s = t["scale"] / max(t0["scale"], 1e-6)
            bw, bh = bw * s, bh * s
            x, y = cx - bw / 2, cy - bh / 2
        x0, y0 = max(0, int(x * w)), max(0, int(y * h))
        x1, y1 = min(w - 1, int((x + bw) * w)), min(h - 1, int((y + bh) * h))
        return x0, y0, max(2, x1 - x0), max(2, y1 - y0)

    def __call__(self, img, index):
        h, w = img.shape[:2]
        # GrabCut is slow at full size; solve at ≤ 640 px and upscale the matte.
        scale = min(1.0, 640 / max(h, w))
        small = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA) if scale < 1 else img
        sh, sw = small.shape[:2]
        bx, by, bw, bh = self.box_for(index, sw, sh)
        mask = np.full((sh, sw), cv2.GC_BGD, np.uint8)
        mask[by:by + bh, bx:bx + bw] = cv2.GC_PR_FGD
        if self.prev is not None:
            prev = cv2.resize(self.prev, (sw, sh), interpolation=cv2.INTER_LINEAR) > 0.5
            core = cv2.erode(prev.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)
            band = cv2.dilate(prev.astype(np.uint8), np.ones((15, 15), np.uint8)).astype(bool)
            mask[band] = cv2.GC_PR_FGD
            mask[prev & ~core] = cv2.GC_PR_FGD
            mask[core] = cv2.GC_FGD
            mask[~band] = cv2.GC_BGD
        bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
        cv2.grabCut(small, mask, None, bgd, fgd, 4, cv2.GC_INIT_WITH_MASK)
        m = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 1.0, 0.0).astype(np.float32)
        m = fill_holes(largest_component(m))
        if scale < 1:
            m = cv2.resize(m, (w, h), interpolation=cv2.INTER_LINEAR)
        self.prev = m
        return m


class PersonMatter:
    def __init__(self, model: Path):
        try:
            import mediapipe as mp
            from mediapipe.tasks import python as mp_tasks
            from mediapipe.tasks.python import vision
        except ImportError:
            raise SystemExit("person mode needs mediapipe: pip install -r requirements.txt")
        if not model or not model.exists():
            raise SystemExit(
                "person mode needs a MediaPipe segmentation model file, given with --model.\n"
                "Download selfie_segmenter.tflite (or selfie_multiclass_256x256.tflite) from the\n"
                "'Image segmentation' page of Google AI Edge / MediaPipe, save it e.g. as\n"
                "models/selfie_segmenter.tflite, and run again with --model models/selfie_segmenter.tflite.\n"
                "No model? Shoot on a green screen (--mode key) or use --mode object with a box."
            )
        self.mp = mp
        options = vision.ImageSegmenterOptions(
            base_options=mp_tasks.BaseOptions(model_asset_path=str(model)),
            running_mode=vision.RunningMode.IMAGE,
            output_confidence_masks=True,
        )
        self.segmenter = vision.ImageSegmenter.create_from_options(options)

    def __call__(self, img, index):
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        result = self.segmenter.segment(self.mp.Image(image_format=self.mp.ImageFormat.SRGB, data=rgb))
        masks = result.confidence_masks
        if len(masks) == 1:
            return masks[0].numpy_view().astype(np.float32)
        # Multiclass model: class 0 is background, everything else is the person.
        return 1.0 - masks[0].numpy_view().astype(np.float32)


# ----------------------------------------------------------------- refine


def refine(m, choke, feather):
    if choke > 0:
        k = np.ones((choke * 2 + 1, choke * 2 + 1), np.uint8)
        m = cv2.erode(m, k)
    elif choke < 0:
        k = np.ones((-choke * 2 + 1, -choke * 2 + 1), np.uint8)
        m = cv2.dilate(m, k)
    if feather > 0:
        m = cv2.GaussianBlur(m, (0, 0), feather / 2)
    return np.clip(m, 0, 1)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sequence", type=Path, help="sequence folder with plate/ (from frames.py)")
    ap.add_argument("--mode", required=True, choices=["person", "key", "luma", "object"])
    ap.add_argument("--model", type=Path, help="person: MediaPipe .tflite segmentation model")
    ap.add_argument("--color", default="0,177,64", help="key: screen colour R,G,B (default green 0,177,64)")
    ap.add_argument("--tolerance", type=float, default=18, help="key: chroma distance that is fully screen")
    ap.add_argument("--softness", type=float, default=22, help="key: width of the edge ramp")
    ap.add_argument("--low", type=float, default=0.1, help="luma: luminance (0–1) that is fully background")
    ap.add_argument("--high", type=float, default=0.25, help="luma: luminance that is fully subject")
    ap.add_argument("--invert", action="store_true", help="luma: dark subject on a light background")
    ap.add_argument("--box", help="object: x,y,w,h around the subject on frame 1 (0–1)")
    ap.add_argument("--track", type=Path, help="object: track JSON that moves the box")
    ap.add_argument("--keep-largest", action="store_true", help="key/luma: keep only the largest blob")
    ap.add_argument("--fill-holes", action="store_true",
                    help="key/luma/person: fill holes inside the subject (always on in object mode)")
    ap.add_argument("--choke", type=int, default=0, help="shrink (+) or grow (−) the matte, px")
    ap.add_argument("--feather", type=float, default=1.5, help="edge softness, px")
    ap.add_argument("--smooth", type=int, default=1, help="temporal median window, frames (odd)")
    ap.add_argument("--out-name", default="cutout", help="folder name for the RGBA frames (default cutout)")
    ap.add_argument("--frames", help="only frames A-B (1-based), for a quick test")
    args = ap.parse_args()

    frames = sorted((args.sequence / "plate").glob("frame_*.png"))
    if not frames:
        print(f"No frames in {args.sequence / 'plate'}", file=sys.stderr)
        return 2
    if args.frames:
        a, b = (int(v) for v in args.frames.split("-"))
        frames = frames[a - 1:b]

    if args.mode == "object":
        if not args.box:
            print("object mode needs --box x,y,w,h", file=sys.stderr)
            return 2
        track = json.loads(args.track.read_text()) if args.track else None
        matter = ObjectMatter(parse_box(args.box), track)
    elif args.mode == "person":
        matter = PersonMatter(args.model)
    else:
        matter = None
    color = [int(v) for v in args.color.split(",")]

    raw = []
    for i, path in enumerate(frames):
        img = cv2.imread(str(path), cv2.IMREAD_COLOR)
        index = int(path.stem.split("_")[1]) - 1
        if args.mode == "key":
            m = matte_key(img, color, args.tolerance, args.softness)
        elif args.mode == "luma":
            m = matte_luma(img, args.low, args.high, args.invert)
        else:
            m = matter(img, index)
        if args.keep_largest and args.mode in ("key", "luma"):
            m = largest_component(m)
        if args.fill_holes and args.mode in ("key", "luma", "person"):
            m = np.maximum(m, fill_holes(m))
        raw.append(m.astype(np.float32))
        if (i + 1) % 30 == 0:
            print(f"  {i + 1}/{len(frames)}", flush=True)

    # Temporal median: each matte becomes the median of its neighbours.
    n = max(1, args.smooth | 1)
    if n > 1:
        half = n // 2
        stack = np.stack(raw)
        raw = [np.median(stack[max(0, i - half):i + half + 1], axis=0) for i in range(len(raw))]

    matte_dir = args.sequence / "matte"
    cut_dir = args.sequence / args.out_name
    for d in (matte_dir, cut_dir):
        if d.exists():
            shutil.rmtree(d)
        d.mkdir(parents=True)

    coverage = []
    for path, m in zip(frames, raw):
        m = refine(m, args.choke, args.feather)
        img = cv2.imread(str(path), cv2.IMREAD_COLOR)
        if args.mode == "key":
            img = despill(img, m, color)
        a8 = (m * 255).astype(np.uint8)
        cv2.imwrite(str(matte_dir / path.name), a8)
        cv2.imwrite(str(cut_dir / path.name), np.dstack([img, a8]))
        coverage.append(float(m.mean()))

    cov = np.array(coverage)
    jumps = np.abs(np.diff(cov)) if len(cov) > 1 else np.zeros(1)
    print(f"{len(frames)} mattes → {matte_dir}  cutouts → {cut_dir}")
    print(f"subject covers {cov.mean() * 100:.1f}% of the frame on average "
          f"(min {cov.min() * 100:.1f}%, max {cov.max() * 100:.1f}%)")
    worst = int(np.argmax(jumps)) + 2 if len(cov) > 1 else 1
    print(f"largest frame-to-frame change: {jumps.max() * 100:.2f}% of the frame (around frame {worst})"
          + ("  — check it: a sudden jump is usually a lost edge" if jumps.max() > 0.02 else ""))
    if cov.mean() < 0.005:
        print("warning: almost nothing was kept — loosen --tolerance / --low or check --box", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
