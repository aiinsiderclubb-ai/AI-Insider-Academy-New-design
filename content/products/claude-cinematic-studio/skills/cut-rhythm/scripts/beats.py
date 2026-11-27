#!/usr/bin/env python3
"""Find the beats in a music track, so cuts and accents can land on them.

Part of Claude Cinematic Studio (cut-rhythm). Feeds cutlist.py, which snaps a
storyboard's cuts and hits onto the music, and review.py, which checks them.

Python 3 standard library only. Any audio format works if ffmpeg is
installed (it converts to WAV first); without ffmpeg, give a 16-bit PCM WAV.

How it works, briefly:
  1. The track is mixed to mono at 22 050 Hz and split into ~23 ms frames.
  2. Onset strength = how much louder each frame is than the one before,
     in the bass band (kicks) and across the whole signal.
  3. Tempo = the beat period that best lines the onsets up with themselves
     (autocorrelation), with a mild preference for 90–140 BPM.
  4. Beats = a chain of onsets about one period apart, found by dynamic
     programming, so a quiet bar does not lose the count.
  5. Downbeats = every 4th beat, starting where the bass is strongest.

  6. Grid = a straight line fitted through the tracked beats (least squares):
     an evenly spaced beat grid with a sub-frame tempo, which is what an
     editor wants for cutting — tracked beats wobble by a frame or two.
  7. Hits = the strongest onsets (drum fills, impacts, drops): places for
     a type slam or a flash, which do not always sit on the grid.

Writes JSON:
    {"tempo": 120.2, "duration": 31.4, "beats": [0.51, 1.01, ...],
     "downbeats": [...], "onsets": [...], "strength": [...],
     "grid": {"tempo": 120.04, "phase": 0.508, "beats": [...], "downbeats": [...]},
     "hits": [{"t": 7.98, "strength": 1.0}, ...],
     "fps": 30, "beat_frames": [15, 30, ...], "downbeat_frames": [...]}

Examples:
    python3 beats.py music.mp3 --out public/data/beats.json
    python3 beats.py music.wav --fps 30 --start 12.5 --length 15
    python3 beats.py --make-click 120 8 click.wav     # a test click track
"""
from __future__ import annotations

import argparse
import array
import json
import math
import shutil
import struct
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

RATE = 22050
HOP = 512  # ~23 ms at 22 050 Hz
FRAME_RATE = RATE / HOP


# --------------------------------------------------------------------- audio


def to_wav(source: Path, workdir: Path, start: float | None, length: float | None) -> Path:
    """Converts anything ffmpeg can read into mono 16-bit WAV at RATE."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        if source.suffix.lower() != ".wav":
            raise RuntimeError("ffmpeg not found — install it, or convert the track to WAV first")
        return source
    target = workdir / "mono.wav"
    command = [ffmpeg, "-v", "error", "-y"]
    if start:
        command += ["-ss", str(start)]
    command += ["-i", str(source)]
    if length:
        command += ["-t", str(length)]
    command += ["-ac", "1", "-ar", str(RATE), "-sample_fmt", "s16", str(target)]
    subprocess.run(command, check=True)
    return target


def read_wav(path: Path) -> list[float]:
    with wave.open(str(path), "rb") as handle:
        channels = handle.getnchannels()
        width = handle.getsampwidth()
        rate = handle.getframerate()
        raw = handle.readframes(handle.getnframes())
    if width != 2:
        raise RuntimeError(f"{path.name}: {width * 8}-bit WAV — only 16-bit PCM is read without ffmpeg")
    samples = array.array("h")
    samples.frombytes(raw)
    if sys.byteorder == "big":
        samples.byteswap()
    if channels > 1:
        samples = array.array("h", (sum(samples[i : i + channels]) // channels for i in range(0, len(samples), channels)))
    if rate != RATE:
        # Nearest-sample resampling is crude, but onsets survive it.
        step = rate / RATE
        samples = array.array("h", (samples[int(i * step)] for i in range(int(len(samples) / step))))
    return [s / 32768.0 for s in samples]


# ------------------------------------------------------------------- analysis


def band_energies(samples: list[float]) -> tuple[list[float], list[float]]:
    """Log energy per frame: full band, and a bass band below ~150 Hz."""
    alpha = 1 - math.exp(-2 * math.pi * 150 / RATE)
    low = 0.0
    full_e, low_e = [], []
    acc_full = acc_low = 0.0
    for i, x in enumerate(samples, 1):
        low += alpha * (x - low)
        acc_full += x * x
        acc_low += low * low
        if i % HOP == 0:
            full_e.append(math.log1p(1000 * acc_full / HOP))
            low_e.append(math.log1p(1000 * acc_low / HOP))
            acc_full = acc_low = 0.0
    return full_e, low_e


def novelty(full_e: list[float], low_e: list[float]) -> list[float]:
    """Half-wave rectified rise in energy, local mean removed, scaled to 0–1."""
    raw = [0.0]
    for i in range(1, len(full_e)):
        raw.append(0.6 * max(0.0, low_e[i] - low_e[i - 1]) + 0.4 * max(0.0, full_e[i] - full_e[i - 1]))
    half = int(FRAME_RATE * 0.25)
    prefix = [0.0]
    for value in raw:
        prefix.append(prefix[-1] + value)
    out = []
    for i, value in enumerate(raw):
        lo, hi = max(0, i - half), min(len(raw), i + half + 1)
        mean = (prefix[hi] - prefix[lo]) / (hi - lo)
        out.append(max(0.0, value - mean))
    peak = max(out) or 1.0
    return [v / peak for v in out]


def estimate_period(env: list[float], min_bpm: float, max_bpm: float) -> float:
    """Beat period in frames, from the autocorrelation of the onset envelope."""
    lo = int(FRAME_RATE * 60 / max_bpm)
    hi = int(FRAME_RATE * 60 / min_bpm) + 1
    # Smoothed copy: impulses a non-whole number of frames apart still line up.
    kernel = [0.1, 0.2, 0.4, 0.2, 0.1]
    env = [sum(kernel[k] * env[min(len(env) - 1, max(0, i + k - 2))] for k in range(5)) for i in range(len(env))]
    n = len(env)
    scores = {}
    for lag in range(max(1, lo), min(hi, n - 1) + 1):
        acf = sum(env[i] * env[i + lag] for i in range(n - lag)) / (n - lag)
        bpm = 60 * FRAME_RATE / lag
        prior = math.exp(-0.5 * (math.log2(bpm / 115) / 0.9) ** 2)  # gentle preference for ~90–140
        scores[lag] = acf * prior
    if not scores:
        raise RuntimeError("the track is too short to find a tempo (need a few seconds)")
    best = max(scores, key=scores.get)
    # Parabolic refinement between neighbouring lags.
    a, b, c = scores.get(best - 1, 0), scores[best], scores.get(best + 1, 0)
    denom = a - 2 * b + c
    shift = 0.5 * (a - c) / denom if denom else 0.0
    return best + max(-0.5, min(0.5, shift))


def track_beats(env: list[float], period: float, tightness: float = 100.0) -> list[int]:
    """Ellis-style dynamic programming: onsets about one period apart."""
    n = len(env)
    score = list(env)
    back = [-1] * n
    lo, hi = int(round(period / 2)), int(round(period * 2))
    for t in range(n):
        best, arg = -1e9, -1
        for prev in range(max(0, t - hi), t - lo + 1):
            if prev < 0:
                continue
            penalty = -tightness * math.log((t - prev) / period) ** 2
            value = score[prev] + penalty
            if value > best:
                best, arg = value, prev
        if arg >= 0 and best > 0:
            score[t] = env[t] + best
            back[t] = arg
    # Start from the best-scoring frame in the last period and walk back.
    tail = range(max(0, n - int(period)), n)
    t = max(tail, key=lambda i: score[i]) if n else -1
    beats = []
    while t >= 0:
        beats.append(t)
        t = back[t]
    return beats[::-1]


def pick_onsets(env: list[float], threshold: float = 0.3) -> list[int]:
    radius = 3
    found = []
    last = -10
    for i in range(radius, len(env) - radius):
        v = env[i]
        if v >= threshold and v == max(env[i - radius : i + radius + 1]) and i - last > radius:
            found.append(i)
            last = i
    return found


def analyse(samples: list[float], min_bpm: float, max_bpm: float, meter: int) -> dict:
    if len(samples) < RATE * 3:
        raise RuntimeError("the track is shorter than 3 seconds")
    full_e, low_e = band_energies(samples)
    env = novelty(full_e, low_e)
    period = estimate_period(env, min_bpm, max_bpm)
    beats = track_beats(env, period)
    onsets = pick_onsets(env)
    # Downbeat phase: the offset whose beats carry the most bass.
    phase = max(range(meter), key=lambda p: sum(low_e[b] for b in beats[p::meter])) if beats else 0
    secs = lambda frames: [round(f / FRAME_RATE, 3) for f in frames]
    window = max(1, int(period / 4))
    strength = [round(max(env[max(0, b - window) : b + window + 1]), 3) for b in beats]
    grid = fit_grid(beats, phase, meter, len(samples) / RATE)
    strong = sorted(((env[o], o) for o in onsets), reverse=True)[: max(4, int(len(samples) / RATE / 2))]
    hits = [{"t": round(o / FRAME_RATE, 3), "strength": round(v, 3)} for v, o in sorted(strong, key=lambda x: x[1])]
    return {
        "tempo": round(60 * FRAME_RATE / period, 1),
        "grid": grid,
        "hits": hits,
        "duration": round(len(samples) / RATE, 3),
        "beats": secs(beats),
        "downbeats": secs(beats[phase::meter]),
        "onsets": secs(onsets),
        "strength": strength,
    }


def fit_grid(beats: list[int], phase: int, meter: int, duration: float) -> dict:
    """Least-squares line through the tracked beats: beat k at phase + k * period.

    Outliers (a beat the tracker put on a fill) are dropped after a first fit
    and the line refitted, so one wrong beat does not tilt the whole grid.
    """
    if len(beats) < 4:
        return {}
    pts = [(k, b / FRAME_RATE) for k, b in enumerate(beats)]

    def fit(points):
        n = len(points)
        mx = sum(k for k, _ in points) / n
        my = sum(t for _, t in points) / n
        sxx = sum((k - mx) ** 2 for k, _ in points) or 1.0
        slope = sum((k - mx) * (t - my) for k, t in points) / sxx
        return slope, my - slope * mx

    slope, icpt = fit(pts)
    keep = [(k, t) for k, t in pts if abs(t - (icpt + slope * k)) < slope * 0.25]
    if len(keep) >= 4:
        slope, icpt = fit(keep)
    # An analysis frame is ~23 ms long and is stamped with its start time, while
    # the attack lies somewhere inside it: centre the grid on the frame.
    icpt += 0.5 / FRAME_RATE
    while icpt - slope > -0.02:
        icpt -= slope
    first = icpt if icpt >= -0.02 else icpt + slope
    grid = []
    k = 0
    while first + k * slope <= duration:
        if first + k * slope >= -0.02:
            grid.append(round(max(0.0, first + k * slope), 3))
        k += 1
    down_phase = phase % meter
    return {
        "tempo": round(60 / slope, 2),
        "phase": round(grid[0], 3) if grid else 0.0,
        "beats": grid,
        "downbeats": grid[down_phase::meter],
    }


# ---------------------------------------------------------------- test click


def make_click(bpm: float, seconds: float, path: Path, offset: float = 0.25) -> None:
    """A click track: a short decaying tone on every beat, louder on the 1."""
    total = int(seconds * RATE)
    data = [0.0] * total
    period = 60 / bpm
    beat = 0
    t = offset
    while t < seconds:
        start = int(t * RATE)
        loud = 0.9 if beat % 4 == 0 else 0.5
        freq = 110 if beat % 4 == 0 else 220
        for k in range(int(0.06 * RATE)):
            if start + k >= total:
                break
            data[start + k] += loud * math.exp(-k / (0.012 * RATE)) * math.sin(2 * math.pi * freq * k / RATE)
        beat += 1
        t = offset + beat * period
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        handle.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, x)) * 32767)) for x in data))


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Beat and tempo detection → beats.json for synced edits.")
    parser.add_argument("audio", nargs="?", type=Path, help="music file (any format with ffmpeg; 16-bit WAV without)")
    parser.add_argument("--out", type=Path, help="write JSON here (default: print)")
    parser.add_argument("--fps", type=int, default=30, help="also give beats as frame numbers at this rate")
    parser.add_argument("--start", type=float, help="analyse from this second (the part used in the video)")
    parser.add_argument("--length", type=float, help="analyse this many seconds")
    parser.add_argument("--min-bpm", type=float, default=60)
    parser.add_argument("--max-bpm", type=float, default=190)
    parser.add_argument("--meter", type=int, default=4, help="beats per bar for downbeats (default 4)")
    parser.add_argument("--make-click", nargs=3, metavar=("BPM", "SECONDS", "OUT_WAV"), help="write a test click track and exit")
    args = parser.parse_args(argv)

    if args.make_click:
        bpm, seconds, out = args.make_click
        make_click(float(bpm), float(seconds), Path(out))
        print(f"wrote {out}: {bpm} BPM, {seconds} s")
        return 0
    if not args.audio:
        parser.error("give an audio file, or --make-click")

    try:
        with tempfile.TemporaryDirectory() as tmp:
            wav = to_wav(args.audio, Path(tmp), args.start, args.length)
            samples = read_wav(wav)
            if wav == args.audio and (args.start or args.length):
                a = int((args.start or 0) * RATE)
                samples = samples[a : a + int(args.length * RATE)] if args.length else samples[a:]
        result = analyse(samples, args.min_bpm, args.max_bpm, args.meter)
    except (OSError, RuntimeError, wave.Error, subprocess.CalledProcessError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    result["fps"] = args.fps
    result["beat_frames"] = [round(b * args.fps) for b in result["beats"]]
    result["downbeat_frames"] = [round(b * args.fps) for b in result["downbeats"]]
    if result.get("grid"):
        result["grid"]["beat_frames"] = [round(b * args.fps) for b in result["grid"]["beats"]]
    text = json.dumps(result, ensure_ascii=False, indent=1)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(text + "\n", encoding="utf-8")
        print(json.dumps({"tempo": result["tempo"], "grid_tempo": result.get("grid", {}).get("tempo"), "beats": len(result["beats"]), "hits": len(result["hits"]), "duration": result["duration"], "first_beats": result["beats"][:4], "grid_first": result.get("grid", {}).get("beats", [])[:4]}, ensure_ascii=False))
    else:
        print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
