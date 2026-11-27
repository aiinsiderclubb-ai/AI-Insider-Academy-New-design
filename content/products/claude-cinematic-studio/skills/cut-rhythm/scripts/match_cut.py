#!/usr/bin/env python3
"""Find the frame pair where shot A can match-cut into shot B.

A match cut joins two shots on a shared shape, position or movement — the
spinning ring that becomes a wheel, the round product that becomes the sun.
The eye carries the shape across, so the cut feels like one motion. This
script searches the tail of A and the head of B for the pair that lines up
best, instead of scrubbing by hand.

How it scores a pair (frames downscaled to 192 px wide):
  shape    the main subject's silhouette — the largest high-contrast blob
           (Otsu threshold, both polarities): centroid position, area and
           orientation. Same place, same size, same angle = strong match.
  edges    structure: Canny edges, blurred, compared by correlation —
           catches lines and horizons, not only blobs.
  colour   layout of colour: mean Lab colour in a 4×4 grid; a match cut
           survives a colour change, so this weighs least.
  score = 0.5·shape + 0.35·edges + 0.15·colour  (0–1; above ~0.7 is a cut
          worth trying, above ~0.8 usually works without help)

Input: video files or plate folders (frames.py output with meta.json).

Output: the top pairs, best first, with times in each shot (seconds from the
start of that clip) and frame numbers; --json writes them; --preview writes
a PNG: A | B | 50 % overlay of the best pair.

Examples:
    python3 match_cut.py shotA.mp4 shotB.mp4
    python3 match_cut.py public/footage/ring public/footage/wheel --a-tail 3 --b-head 1.5 --preview match.png
    python3 match_cut.py a.mp4 b.mp4 --top 5 --json match.json --weights 0.7,0.3,0
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import cv2
import numpy as np

WIDTH = 192


def load_clip(src: Path, window: float, tail: bool, sample_fps: float):
    """Frames (BGR, downscaled) from the last/first `window` seconds, with their times."""
    if src.is_dir():
        frames = sorted((src / "plate").glob("frame_*.png")) or sorted(src.glob("frame_*.png"))
        meta = src / "meta.json"
        info = json.loads(meta.read_text()) if meta.exists() else {}
        fps = info.get("fps", 30) * info.get("slowmo", 1)  # frames per second of real action
        n = len(frames)
        if not n:
            raise SystemExit(f"No frames in {src}")
        span = min(n, int(round(window * fps)))
        idx = range(n - span, n) if tail else range(0, span)
        step = max(1, int(round(fps / sample_fps)))
        out = []
        for i in list(idx)[::step]:
            img = cv2.imread(str(frames[i]))
            out.append((i / fps, i + 1, img))
        return out, fps, n / fps
    cap = cv2.VideoCapture(str(src))
    if not cap.isOpened():
        raise SystemExit(f"Cannot open {src}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    span = min(n, int(round(window * fps)))
    first = n - span if tail else 0
    step = max(1, int(round(fps / sample_fps)))
    out = []
    cap.set(cv2.CAP_PROP_POS_FRAMES, first)
    for i in range(first, first + span):
        ok, img = cap.read()
        if not ok:
            break
        if (i - first) % step == 0:
            out.append((i / fps, i + 1, img))
    cap.release()
    return out, fps, n / fps


def features(img):
    h, w = img.shape[:2]
    small = cv2.resize(img, (WIDTH, int(h * WIDTH / w)), interpolation=cv2.INTER_AREA)
    gray = cv2.GaussianBlur(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY), (3, 3), 0)
    sh, sw = gray.shape
    edges = cv2.Canny(gray, 50, 140).astype(np.float32)
    edges = cv2.GaussianBlur(edges, (0, 0), 2.5)
    edges = (edges - edges.mean()) / (edges.std() + 1e-6)
    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    blob = None
    for mask in (otsu, 255 - otsu):  # bright subject on dark, or dark on bright
        n, labels, stats, cents = cv2.connectedComponentsWithStats(mask, 8)
        for k in range(1, n):
            x, y, bw, bh, area = stats[k]
            touches = x == 0 or y == 0 or x + bw >= sw or y + bh >= sh
            frac = area / (sw * sh)
            if frac < 0.01 or frac > 0.6 or (touches and frac > 0.3):
                continue  # specks and the background itself
            if blob is None or area > blob["area_px"]:
                m = cv2.moments((labels == k).astype(np.uint8), binaryImage=True)
                angle = 0.5 * math.atan2(2 * m["mu11"], m["mu20"] - m["mu02"] + 1e-9)
                blob = {"cx": cents[k][0] / sw, "cy": cents[k][1] / sh, "area": frac, "area_px": area, "angle": angle}
    lab = cv2.cvtColor(small, cv2.COLOR_BGR2LAB).astype(np.float32)
    grid = cv2.resize(lab, (4, 4), interpolation=cv2.INTER_AREA).reshape(-1, 3)
    return {"edges": edges, "blob": blob, "grid": grid}


def score(a, b, weights):
    ws, we, wc = weights
    if a["blob"] and b["blob"]:
        A, B = a["blob"], b["blob"]
        d = math.hypot(A["cx"] - B["cx"], A["cy"] - B["cy"])
        size = math.log(A["area"] / B["area"])
        turn = abs(math.cos(A["angle"] - B["angle"]))  # axes, not directions
        shape = math.exp(-(d / 0.12) ** 2) * math.exp(-(size / 0.45) ** 2) * (0.6 + 0.4 * turn)
    else:
        shape = 0.0
    ea, eb = a["edges"], b["edges"]
    if ea.shape != eb.shape:
        eb = cv2.resize(eb, (ea.shape[1], ea.shape[0]))
    edges = max(0.0, float((ea * eb).mean()))
    colour = math.exp(-float(np.linalg.norm(a["grid"] - b["grid"], axis=1).mean()) / 40)
    total = ws * shape + we * edges + wc * colour
    return total, shape, edges, colour


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("a", type=Path, help="outgoing shot (video or plate folder)")
    ap.add_argument("b", type=Path, help="incoming shot (video or plate folder)")
    ap.add_argument("--a-tail", type=float, default=2.0, help="search the last N seconds of A (default 2)")
    ap.add_argument("--b-head", type=float, default=2.0, help="search the first N seconds of B (default 2)")
    ap.add_argument("--sample-fps", type=float, default=12, help="frames per second to compare (default 12)")
    ap.add_argument("--weights", default="0.5,0.35,0.15", help="shape,edges,colour weights")
    ap.add_argument("--top", type=int, default=5)
    ap.add_argument("--json", type=Path, help="write the ranked pairs here")
    ap.add_argument("--preview", type=Path, help="PNG: A | B | overlay of the best pair")
    args = ap.parse_args()

    weights = tuple(float(v) for v in args.weights.split(","))
    if len(weights) != 3:
        print("--weights needs three numbers", file=sys.stderr)
        return 2
    clip_a, fps_a, _ = load_clip(args.a, args.a_tail, True, args.sample_fps)
    clip_b, fps_b, _ = load_clip(args.b, args.b_head, False, args.sample_fps)
    fa = [features(img) for _, _, img in clip_a]
    fb = [features(img) for _, _, img in clip_b]
    pairs = []
    for i, x in enumerate(fa):
        for j, y in enumerate(fb):
            total, shape, edges, colour = score(x, y, weights)
            pairs.append((total, shape, edges, colour, i, j))
    pairs.sort(reverse=True)
    best = []
    for total, shape, edges, colour, i, j in pairs:
        # Keep the list varied: skip near-duplicates of a pair already chosen.
        if any(abs(clip_a[i][0] - p["a_time"]) < 0.25 and abs(clip_b[j][0] - p["b_time"]) < 0.25 for p in best):
            continue
        best.append({
            "score": round(total, 3), "shape": round(shape, 3), "edges": round(edges, 3), "colour": round(colour, 3),
            "a_time": round(clip_a[i][0], 3), "a_frame": clip_a[i][1],
            "b_time": round(clip_b[j][0], 3), "b_frame": clip_b[j][1],
        })
        if len(best) >= args.top:
            break

    print(f"compared {len(fa)} × {len(fb)} frames")
    print(" #  score  shape  edges  colour   A time (frame)     B time (frame)")
    for k, p in enumerate(best, 1):
        print(f"{k:2d}  {p['score']:.3f}  {p['shape']:.2f}   {p['edges']:.2f}   {p['colour']:.2f}    "
              f"{p['a_time']:7.3f} s ({p['a_frame']:>5})   {p['b_time']:7.3f} s ({p['b_frame']:>5})")
    if best and best[0]["score"] < 0.5:
        print("No strong match: line the shots up in the edit (scale/position B) or pick other shots.")
    if args.json:
        args.json.write_text(json.dumps({"a": str(args.a), "b": str(args.b), "pairs": best}, indent=1))
        print(f"→ {args.json}")
    if args.preview and best:
        ia = next(img for t, f, img in clip_a if f == best[0]["a_frame"])
        ib = next(img for t, f, img in clip_b if f == best[0]["b_frame"])
        h = 360
        ra = cv2.resize(ia, (int(ia.shape[1] * h / ia.shape[0]), h))
        rb = cv2.resize(ib, (ra.shape[1], h))
        cv2.imwrite(str(args.preview), np.hstack([ra, rb, cv2.addWeighted(ra, 0.5, rb, 0.5, 0)]))
        print(f"preview → {args.preview}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
