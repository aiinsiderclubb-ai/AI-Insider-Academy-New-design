#!/usr/bin/env python3
"""Track a feature through a plate so graphics can stick to it.

This is the 2D tracker in After Effects / Mocha, done with OpenCV: pick a box
around something with texture (a logo, a camera module, an eye, a corner) and
the script follows it frame by frame, including scale and rotation.

How it works:
  1. In the box on --from-frame, Shi-Tomasi picks up to 120 strong corners.
  2. Each next frame, pyramidal Lucas-Kanade flows the corners forward, then
     flows them back; points that do not return within 1 px are dropped
     (forward/backward check — the main defence against drift).
  3. The surviving points, paired with where they were on the start frame,
     give a similarity transform (move, uniform scale, rotation) via RANSAC.
     Solving against the start frame, not frame-to-frame, keeps small errors
     from adding up over a long shot.
  4. When fewer than --min-points survive, corners are re-seeded inside the
     current box. Confidence = share of points that survived.
  5. Optional smoothing (--smooth N): centred moving average over N frames on
     position, scale and rotation, to remove jitter (it lags fast whips a bit).
  6. Frames before --from-frame are tracked backwards the same way.

Output JSON (x, y normalised 0–1 from the top-left; rotation in degrees;
scale relative to the start frame; f is 1-based, matching frame_00001.png):

    {"fps": 30, "width": 1080, "height": 1920, "label": "camera",
     "box": [0.62, 0.18, 0.12, 0.07],
     "frames": [{"f": 1, "x": 0.68, "y": 0.215, "scale": 1.0,
                 "rotation": 0.0, "confidence": 0.97}, ...]}

Examples:
    python3 track.py public/footage/device --box 0.62,0.18,0.12,0.07 --label camera
    python3 track.py public/footage/shot1 --box 0.4,0.3,0.1,0.1 --from-frame 40 --smooth 5 --preview
    python3 track.py public/footage/shot1 --box 0.45,0.5,0.04,0.04 --motion translate --label dot

Scale and rotation need corners spread across the box in both directions; a
thin or featureless box gets a warning — widen it or use --motion translate.
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

# minEigThreshold drops points on plain edges: they slide along the edge (the
# aperture problem) and would make the tracker under-read rotation.
LK = dict(winSize=(21, 21), maxLevel=4, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 40, 0.01),
          minEigThreshold=1e-3)


def load_gray(path: Path) -> np.ndarray:
    img = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise SystemExit(f"Cannot read {path}")
    return img


def seed(gray: np.ndarray, center, size, scale, angle, max_points=120):
    """Corners inside the rotated, scaled box."""
    w, h = size[0] * scale, size[1] * scale
    mask = np.zeros_like(gray)
    rect = ((float(center[0]), float(center[1])), (float(w), float(h)), float(angle))
    cv2.fillConvexPoly(mask, cv2.boxPoints(rect).astype(np.int32), 255)
    pts = cv2.goodFeaturesToTrack(gray, maxCorners=max_points, qualityLevel=0.01, minDistance=4, mask=mask, blockSize=5)
    return pts.reshape(-1, 2) if pts is not None else np.zeros((0, 2), np.float32)


def run(frames, start_index, box_px, min_points, direction, motion="similarity"):
    """Track from start_index in one direction. Returns {index: state}.

    Each point keeps its position in the start frame. The transform is always
    solved start-frame → current frame from those pairs, so per-frame
    estimation errors do not pile up; only the points themselves can drift,
    and the forward/backward check removes the ones that do.
    """
    cx, cy, bw, bh = box_px
    out = {start_index: {"x": cx, "y": cy, "scale": 1.0, "rotation": 0.0, "confidence": 1.0}}
    prev = load_gray(frames[start_index])
    cur = seed(prev, (cx, cy), (bw, bh), 1.0, 0.0)
    if len(cur) < 6:
        raise SystemExit("Too few trackable corners in the box: pick an area with texture or contrast, or a bigger box.")
    ref = cur.copy()
    spread = cur.max(axis=0) - cur.min(axis=0)
    if motion == "similarity" and min(spread[0] / max(bw, 1), spread[1] / max(bh, 1)) < 0.3:
        print(f"warning: corners cover only {spread[0]:.0f}×{spread[1]:.0f} px of the {bw:.0f}×{bh:.0f} box —"
              " scale and rotation will be unreliable. Use a box over a feature with detail in both"
              " directions, or --motion translate.", file=sys.stderr)
    total = np.array([[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]])
    state = dict(out[start_index])
    rng = range(start_index + 1, len(frames)) if direction > 0 else range(start_index - 1, -1, -1)
    for i in rng:
        curr = load_gray(frames[i])
        n_before = max(1, len(cur))
        if len(cur):
            p0 = cur.reshape(-1, 1, 2).astype(np.float32)
            p1, st1, _ = cv2.calcOpticalFlowPyrLK(prev, curr, p0, None, **LK)
            p0r, st2, _ = cv2.calcOpticalFlowPyrLK(curr, prev, p1, None, **LK)
            err = np.linalg.norm(p0 - p0r, axis=2).reshape(-1)
            good = (st1.reshape(-1) == 1) & (st2.reshape(-1) == 1) & (err < 1.0)
            cur, ref = p1.reshape(-1, 2)[good], ref[good]
        m, inliers = (None, None)
        if motion == "translate" and len(cur) >= 3:
            d = cur - ref
            med = np.median(d, axis=0)
            keep_t = np.linalg.norm(d - med, axis=1) < 2.0
            m = np.array([[1.0, 0.0, med[0]], [0.0, 1.0, med[1]]]) if keep_t.sum() >= 3 else None
            inliers = keep_t.astype(np.uint8)
        elif len(cur) >= 4:
            m, inliers = cv2.estimateAffinePartial2D(ref, cur, method=cv2.RANSAC, ransacReprojThreshold=2.0)
        if m is not None:
            total = m
            keep = inliers.reshape(-1).astype(bool)
            cur, ref = cur[keep], ref[keep]
            c = total @ np.array([cx, cy, 1.0])
            state = {
                "x": float(c[0]),
                "y": float(c[1]),
                "scale": float(math.hypot(total[0, 0], total[1, 0])),
                "rotation": float(math.degrees(math.atan2(total[1, 0], total[0, 0]))),
                "confidence": round(float(keep.sum()) / n_before, 3),
            }
        else:
            state = dict(state, confidence=0.0)
        if len(cur) < min_points:
            fresh = seed(curr, (state["x"], state["y"]), (bw, bh), state["scale"], state["rotation"])
            if len(fresh):
                inv = cv2.invertAffineTransform(total)
                fresh_ref = (inv @ np.hstack([fresh, np.ones((len(fresh), 1))]).T).T
                cur = np.vstack([cur, fresh]) if len(cur) else fresh
                ref = np.vstack([ref, fresh_ref]) if len(ref) else fresh_ref
        out[i] = dict(state)
        prev = curr
    return out


def smooth(values, n):
    if n <= 1:
        return values
    half = n // 2
    arr = np.array(values, dtype=float)
    padded = np.pad(arr, (half, half), mode="edge")
    return list(np.convolve(padded, np.ones(n) / n, mode="valid")[: len(arr)])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sequence", type=Path, help="sequence folder with plate/ and meta.json (from frames.py)")
    ap.add_argument("--box", required=True, help="x,y,w,h of the feature, normalised 0–1 from the top-left")
    ap.add_argument("--from-frame", type=int, default=1, help="1-based frame where the box is drawn (default 1)")
    ap.add_argument("--label", default="feature", help="name used in the file name: track-<label>.json")
    ap.add_argument("--motion", choices=["similarity", "translate"], default="similarity",
                    help="similarity = move + scale + rotation (default); translate = position only, steadier on small features")
    ap.add_argument("--smooth", type=int, default=1, help="moving-average window in frames (odd, e.g. 5)")
    ap.add_argument("--min-points", type=int, default=12, help="re-seed corners below this many")
    ap.add_argument("--preview", action="store_true", help="also write track-<label>.mp4 with the box drawn")
    args = ap.parse_args()

    plate = args.sequence / "plate"
    frames = sorted(plate.glob("frame_*.png"))
    if not frames:
        print(f"No frames in {plate}", file=sys.stderr)
        return 2
    meta_path = args.sequence / "meta.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    h, w = load_gray(frames[0]).shape
    try:
        bx, by, bw, bh = (float(v) for v in args.box.split(","))
    except ValueError:
        print("--box needs four numbers: x,y,w,h", file=sys.stderr)
        return 2
    box_px = ((bx + bw / 2) * w, (by + bh / 2) * h, bw * w, bh * h)
    start = args.from_frame - 1
    if not 0 <= start < len(frames):
        print(f"--from-frame must be 1..{len(frames)}", file=sys.stderr)
        return 2

    states = run(frames, start, box_px, args.min_points, +1, args.motion)
    if start > 0:
        states.update(run(frames, start, box_px, args.min_points, -1, args.motion))
    order = sorted(states)
    xs = smooth([states[i]["x"] for i in order], args.smooth)
    ys = smooth([states[i]["y"] for i in order], args.smooth)
    ss = smooth([states[i]["scale"] for i in order], args.smooth)
    rs = smooth([states[i]["rotation"] for i in order], args.smooth)
    out_frames = [
        {"f": i + 1, "x": round(xs[k] / w, 5), "y": round(ys[k] / h, 5), "scale": round(ss[k], 4),
         "rotation": round(rs[k], 3), "confidence": states[i]["confidence"]}
        for k, i in enumerate(order)
    ]
    # Frames per second of real action (a --slowmo sequence holds fps × N).
    result = {"fps": meta.get("fps", 30) * meta.get("slowmo", 1), "width": w, "height": h, "label": args.label,
              "box": [bx, by, bw, bh], "from_frame": args.from_frame, "motion": args.motion, "frames": out_frames}
    target = args.sequence / f"track-{args.label}.json"
    target.write_text(json.dumps(result, indent=1))

    if args.preview:
        tmp = args.sequence / f".preview-{args.label}"
        tmp.mkdir(exist_ok=True)
        for k, i in enumerate(order):
            img = cv2.imread(str(frames[i]))
            rect = ((xs[k], ys[k]), (bw * w * ss[k], bh * h * ss[k]), rs[k])
            cv2.polylines(img, [cv2.boxPoints(rect).astype(np.int32)], True, (60, 240, 255), 2, cv2.LINE_AA)
            cv2.circle(img, (int(xs[k]), int(ys[k])), 4, (60, 240, 255), -1, cv2.LINE_AA)
            cv2.imwrite(str(tmp / f"p_{k + 1:05d}.png"), img)
        movie = args.sequence / f"track-{args.label}.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(result["fps"]), "-i", str(tmp / "p_%05d.png"),
                        "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", str(movie)], check=True)
        for f in tmp.iterdir():
            f.unlink()
        tmp.rmdir()
        print(f"preview → {movie}")

    conf = [f["confidence"] for f in out_frames]
    weak = sum(1 for c in conf if c < 0.5)
    print(f"{len(out_frames)} frames tracked → {target}")
    print(f"confidence: mean {np.mean(conf):.2f}, min {min(conf):.2f}; frames below 0.5: {weak}"
          + ("  — check those frames in the preview" if weak else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
