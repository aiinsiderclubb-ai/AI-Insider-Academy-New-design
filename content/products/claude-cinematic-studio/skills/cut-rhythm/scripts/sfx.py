#!/usr/bin/env python3
"""Procedural sound design for edits: whooshes, impacts, risers and UI ticks.

Part of Claude Cinematic Studio (cut-rhythm). Every sound is synthesised from
seeded noise and oscillators, so it is royalty-free, the same on every run,
and can be stretched to the exact length of a transition. Output: 48 kHz,
16-bit stereo WAV, peaks normalised to -1 dBFS.

Python 3 standard library only.

Kinds:
    whoosh    band-passed noise sweeping up and down with a doppler-like
              pitch bend and a left→right pan — camera moves, zoom-throughs
    swish     short, bright whoosh for whip pans (0.2–0.4 s)
    impact    sub thump with a falling pitch, a transient click and a noise
              tail — type slams, logo landings, flash cuts
    riser     noise and a detuned tone climbing in pitch and loudness,
              stopping dead at the end — build into a cut
    subdrop   sine gliding from ~120 Hz down to ~30 Hz — reveals, drops
    glitch    chopped, bit-crushed stutter — HUD, digital transitions
    reverse   reversed reverb swell that peaks at the end — into a cut
    tick      UI blip, one or several (--count) — HUD readouts, counters

Placement from a storyboard (format: cinematic-director/references):
    transition whip → swish centred on the cut; zoom / in-camera → whoosh
    peaking at the cut; flash → impact on the cut; fade → reverse swell
    ending at the cut; hits → their "sfx" kind (riser ends on the hit,
    others start on it). Writes one WAV per sound and timeline.json; with
    --mix the sounds are also summed into one stem of the film's length.

Examples:
    python3 sfx.py --kind impact --out impact.wav
    python3 sfx.py --kind whoosh --length 0.9 --pitch 1.2 --seed 4 --out whoosh.wav
    python3 sfx.py --all --out-dir sfx/                 # one of each kind
    python3 sfx.py --from-storyboard storyboard.synced.json --out-dir public/sfx --mix
"""
from __future__ import annotations

import argparse
import array
import json
import math
import random
import sys
import wave
from pathlib import Path

RATE = 48000
KINDS = ["whoosh", "swish", "impact", "riser", "subdrop", "glitch", "reverse", "tick"]
DEFAULT_LENGTH = {"whoosh": 0.9, "swish": 0.3, "impact": 1.4, "riser": 2.0, "subdrop": 1.3, "glitch": 0.45, "reverse": 1.2, "tick": 0.12}
PEAK = 10 ** (-1 / 20)  # -1 dBFS


# ------------------------------------------------------------------ building blocks


class SVF:
    """Chamberlin state-variable filter: low/band/high outputs, cutoff can move every sample."""

    def __init__(self, q: float = 0.7):
        self.low = self.band = 0.0
        self.damp = 1 / q

    def run(self, x: float, cutoff: float) -> tuple[float, float, float]:
        f = 2 * math.sin(math.pi * min(cutoff, RATE / 6) / RATE)
        self.low += f * self.band
        high = x - self.low - self.damp * self.band
        self.band += f * high
        return self.low, self.band, high


def env_ar(i: int, n: int, attack: float, curve: float = 2.0) -> float:
    """Attack to a peak at `attack` (0–1 of the length), then decay with a power curve."""
    x = i / max(1, n - 1)
    if x < attack:
        return (x / attack) ** 1.5
    return max(0.0, 1 - (x - attack) / (1 - attack)) ** curve


def pan_gains(p: float) -> tuple[float, float]:
    """Equal-power pan, p in [-1, 1]."""
    a = (p + 1) * math.pi / 4
    return math.cos(a), math.sin(a)


def soft(x: float, drive: float = 1.0) -> float:
    return math.tanh(x * drive) / math.tanh(drive) if drive > 0 else x


# ------------------------------------------------------------------------- sounds


def whoosh(n: int, pitch: float, rng: random.Random, bright: float = 1.0) -> tuple[list[float], list[float]]:
    left, right = [0.0] * n, [0.0] * n
    f1, f2 = SVF(1.6), SVF(1.6)
    peak = 0.58
    for i in range(n):
        x = i / n
        # Doppler: pitch rises toward the pass, falls after it.
        bell = math.exp(-((x - peak) / 0.22) ** 2)
        cutoff = pitch * (300 + 2600 * bright * bell + 400 * x)
        noise = rng.uniform(-1, 1)
        _, b1, _ = f1.run(noise, cutoff)
        _, b2, _ = f2.run(rng.uniform(-1, 1), cutoff * 1.9)
        amp = env_ar(i, n, peak, 2.4)
        s = (b1 * 0.8 + b2 * 0.35) * amp
        gl, gr = pan_gains(-0.8 + 1.6 * x)
        left[i] = s * gl
        right[i] = s * gr
    return left, right


def impact(n: int, pitch: float, rng: random.Random) -> tuple[list[float], list[float]]:
    out = [0.0] * n
    lp = SVF(0.8)
    phase = 0.0
    for i in range(n):
        t = i / RATE
        f = pitch * (40 + 70 * math.exp(-t / 0.05))
        phase += 2 * math.pi * f / RATE
        thump = math.sin(phase) * math.exp(-t / 0.32)
        click = rng.uniform(-1, 1) * math.exp(-t / 0.0025) * 0.9
        low, _, _ = lp.run(rng.uniform(-1, 1), pitch * (2500 * math.exp(-t / 0.08) + 180))
        tail = low * math.exp(-t / 0.22) * 0.7
        out[i] = soft(thump * 1.1 + click + tail, 1.6)
    return stereo_widen(out, rng, 0.15)


def riser(n: int, pitch: float, rng: random.Random) -> tuple[list[float], list[float]]:
    left, right = [0.0] * n, [0.0] * n
    f = SVF(2.2)
    ph = [0.0, 0.0, 0.0]
    for i in range(n):
        x = i / n
        k = x ** 2
        cutoff = pitch * (250 * (1 - k) + 9000 * k)
        _, band, high = f.run(rng.uniform(-1, 1), cutoff)
        tone = 0.0
        base = pitch * (110 * 2 ** (2.5 * x))
        for j, detune in enumerate((1.0, 1.007, 0.993)):
            ph[j] += 2 * math.pi * base * detune / RATE
            tone += (2 * ((ph[j] / (2 * math.pi)) % 1) - 1) * 0.18  # saw
        tremolo = 1 + 0.25 * math.sin(2 * math.pi * (4 + 14 * k) * x * n / RATE)
        amp = (x ** 2.2) * tremolo * (1 if x < 0.995 else (1 - x) / 0.005)
        s = (band * 0.7 + high * 0.2 * k + tone * 0.6) * amp
        w = 0.3 + 0.5 * k
        left[i] = s * (1 + w * math.sin(i * 0.0007)) / 2
        right[i] = s * (1 - w * math.sin(i * 0.0007)) / 2
    return left, right


def subdrop(n: int, pitch: float, rng: random.Random) -> tuple[list[float], list[float]]:
    out = [0.0] * n
    phase = 0.0
    for i in range(n):
        x = i / n
        f = pitch * (120 * math.exp(-x * 2.2) + 28)
        phase += 2 * math.pi * f / RATE
        a = min(1.0, i / (0.006 * RATE)) * (1 - x) ** 1.3
        out[i] = soft(math.sin(phase) * a * 1.4 + math.sin(phase * 2) * a * 0.15, 1.3)
    return out, list(out)


def glitch(n: int, pitch: float, rng: random.Random) -> tuple[list[float], list[float]]:
    left, right = [0.0] * n, [0.0] * n
    i = 0
    while i < n:
        seg = int(RATE * rng.choice([0.012, 0.018, 0.025, 0.04, 0.06]))
        kind = rng.random()
        freq = pitch * rng.choice([220, 330, 440, 880, 1760, 3520])
        hold = rng.choice([1, 2, 4, 8, 16])  # sample-and-hold = bit/rate crush
        gate = rng.random() > 0.18
        pan = rng.uniform(-0.9, 0.9)
        gl, gr = pan_gains(pan)
        held = 0.0
        phase = 0.0
        for k in range(seg):
            if i + k >= n:
                break
            if k % hold == 0:
                phase += 2 * math.pi * freq * hold / RATE
                if kind < 0.45:
                    held = rng.uniform(-1, 1)
                elif kind < 0.8:
                    held = 1.0 if math.sin(phase) > 0 else -1.0
                else:
                    held = math.sin(phase)
                held = round(held * 6) / 6
            a = (0.8 if gate else 0.0) * (1 - k / seg) ** 0.3
            left[i + k] = held * a * gl
            right[i + k] = held * a * gr
        i += seg
    return left, right


def reverse_swell(n: int, pitch: float, rng: random.Random) -> tuple[list[float], list[float]]:
    # A reverb-like tail: noise through a sweeping low-pass with a long decay, then reversed.
    left, right = whoosh(n, pitch * 0.7, rng, bright=0.6)
    tail_l, tail_r = [0.0] * n, [0.0] * n
    f1, f2 = SVF(0.9), SVF(0.9)
    for i in range(n):
        t = i / RATE
        decay = math.exp(-t / (n / RATE * 0.35))
        lo1, _, _ = f1.run(rng.uniform(-1, 1), pitch * (5000 * decay + 200))
        lo2, _, _ = f2.run(rng.uniform(-1, 1), pitch * (5000 * decay + 200))
        tail_l[i] = lo1 * decay + left[i] * 0.2
        tail_r[i] = lo2 * decay + right[i] * 0.2
    return tail_l[::-1], tail_r[::-1]


def tick(n: int, pitch: float, rng: random.Random, count: int = 1) -> tuple[list[float], list[float]]:
    out = [0.0] * n
    spacing = n // max(1, count)
    for c in range(count):
        start = c * spacing
        f = pitch * (2200 + 600 * (c % 2))
        for k in range(min(spacing, int(0.06 * RATE))):
            if start + k >= n:
                break
            t = k / RATE
            out[start + k] += (math.sin(2 * math.pi * f * t) * 0.7 + math.sin(2 * math.pi * f * 2.01 * t) * 0.25) * math.exp(-t / 0.012)
    return stereo_widen(out, rng, 0.05)


def stereo_widen(mono: list[float], rng: random.Random, amount: float) -> tuple[list[float], list[float]]:
    delay = int(0.0004 * RATE)
    right = [0.0] * delay + mono[: len(mono) - delay]
    return [m * (1 - amount) + r * amount for m, r in zip(mono, right)], [r * (1 - amount) + m * amount for m, r in zip(mono, right)]


def render(kind: str, length: float | None, pitch: float, seed: int, count: int = 1) -> tuple[list[float], list[float]]:
    n = int((length or DEFAULT_LENGTH[kind]) * RATE)
    rng = random.Random(seed)
    if kind == "whoosh":
        return whoosh(n, pitch, rng)
    if kind == "swish":
        return whoosh(n, pitch * 1.8, rng, bright=1.6)
    if kind == "impact":
        return impact(n, pitch, rng)
    if kind == "riser":
        return riser(n, pitch, rng)
    if kind == "subdrop":
        return subdrop(n, pitch, rng)
    if kind == "glitch":
        return glitch(n, pitch, rng)
    if kind == "reverse":
        return reverse_swell(n, pitch, rng)
    if kind == "tick":
        return tick(n, pitch, rng, count)
    raise ValueError(f"unknown kind {kind}")


# --------------------------------------------------------------------------- output


def normalise(left: list[float], right: list[float], peak: float = PEAK) -> tuple[list[float], list[float]]:
    top = max(max(map(abs, left), default=0), max(map(abs, right), default=0))
    if top <= 0:
        return left, right
    g = peak / top
    return [x * g for x in left], [x * g for x in right]


def fade_edges(left: list[float], right: list[float], ms: float = 3) -> None:
    n = int(ms / 1000 * RATE)
    for i in range(min(n, len(left))):
        g = i / n
        left[i] *= g
        right[i] *= g
        left[-1 - i] *= g
        right[-1 - i] *= g


def write_wav(path: Path, left: list[float], right: list[float]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = array.array("h")
    for l, r in zip(left, right):
        data.append(int(max(-1.0, min(1.0, l)) * 32767))
        data.append(int(max(-1.0, min(1.0, r)) * 32767))
    if sys.byteorder == "big":
        data.byteswap()
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data.tobytes())


def stats(left: list[float], right: list[float]) -> tuple[float, float]:
    peak = max(max(map(abs, left), default=0), max(map(abs, right), default=0))
    n = max(1, len(left))
    rms = math.sqrt((sum(x * x for x in left) + sum(x * x for x in right)) / (2 * n))
    db = lambda v: 20 * math.log10(v) if v > 0 else -120.0
    return round(db(peak), 1), round(db(rms), 1)


def make(kind: str, out: Path, length: float | None, pitch: float, seed: int, count: int = 1, quiet: bool = False) -> dict:
    left, right = render(kind, length, pitch, seed, count)
    fade_edges(left, right, 2 if kind in ("impact", "tick") else 4)
    left, right = normalise(left, right)
    write_wav(out, left, right)
    peak, rms = stats(left, right)
    info = {"file": str(out), "kind": kind, "length": round(len(left) / RATE, 3), "peak_db": peak, "rms_db": rms}
    if not quiet:
        print(f"{out}: {kind} {info['length']} s · peak {peak} dBFS · RMS {rms} dBFS")
    return info


# ---------------------------------------------------------------------- storyboard


GAIN = {"impact": 0.0, "subdrop": -2.0, "whoosh": -4.0, "swish": -5.0, "riser": -4.0, "reverse": -4.0, "glitch": -8.0, "tick": -10.0}


def plan_from_storyboard(board: dict) -> list[dict]:
    """Where each sound goes: start time, length, kind, gain in dB."""
    plan = []
    shots = board.get("shots") or []
    for i, shot in enumerate(shots[:-1]):
        cut = shot["end"]
        kind = (shot.get("transition_out") or {}).get("kind", "cut")
        if kind == "whip":
            plan.append({"kind": "swish", "length": 0.32, "start": cut - 0.32 * 0.58, "why": f"{shot.get('id')} вип-пэн"})
        elif kind in ("zoom", "in-camera"):
            plan.append({"kind": "whoosh", "length": 0.9, "start": cut - 0.9 * 0.58, "why": f"{shot.get('id')} {kind}"})
        elif kind == "flash":
            plan.append({"kind": "impact", "length": 1.2, "start": cut, "why": f"{shot.get('id')} вспышка"})
        elif kind == "fade":
            plan.append({"kind": "reverse", "length": 1.0, "start": cut - 1.0, "why": f"{shot.get('id')} затемнение"})
    for shot in shots:
        for hit in shot.get("hits") or []:
            kind = hit.get("sfx")
            if kind not in KINDS:
                continue
            length = DEFAULT_LENGTH[kind]
            start = hit["t"] - length if kind in ("riser", "reverse") else hit["t"]
            plan.append({"kind": kind, "length": length, "start": start, "why": f"{shot.get('id')}: {hit.get('what', '')}"})
    for p in plan:
        p["gain_db"] = GAIN[p["kind"]]
        # A sound that would start before the film is trimmed at the head.
        p["start"] = round(p["start"], 4)
    return sorted(plan, key=lambda p: p["start"])


def mix(items: list[dict], duration: float, out: Path) -> tuple[float, float]:
    n = int(duration * RATE)
    left, right = [0.0] * n, [0.0] * n
    for item in items:
        with wave.open(item["file"], "rb") as w:
            raw = array.array("h")
            raw.frombytes(w.readframes(w.getnframes()))
        if sys.byteorder == "big":
            raw.byteswap()
        g = 10 ** (item["gain_db"] / 20)
        offset = int(round(item["start"] * RATE))
        for k in range(0, len(raw), 2):
            j = offset + k // 2
            if 0 <= j < n:
                left[j] += raw[k] / 32768 * g
                right[j] += raw[k + 1] / 32768 * g
    # Soft limiter instead of a hard clip when sounds pile up.
    top = max(max(map(abs, left), default=0), max(map(abs, right), default=0))
    if top > PEAK:
        left = [soft(x / top, 1.2) * PEAK for x in left]
        right = [soft(x / top, 1.2) * PEAK for x in right]
    write_wav(out, left, right)
    return stats(left, right)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Procedural, royalty-free SFX for edits (48 kHz stereo WAV).")
    parser.add_argument("--kind", choices=KINDS)
    parser.add_argument("--length", type=float, help="seconds (default depends on kind)")
    parser.add_argument("--pitch", type=float, default=1.0, help="frequency scale: 0.7 darker, 1.3 brighter")
    parser.add_argument("--seed", type=int, default=1, help="different seed = a different take of the same sound")
    parser.add_argument("--count", type=int, default=1, help="number of ticks (tick only)")
    parser.add_argument("--out", type=Path)
    parser.add_argument("--all", action="store_true", help="render one of every kind into --out-dir")
    parser.add_argument("--from-storyboard", type=Path, help="place sounds on a storyboard's transitions and hits")
    parser.add_argument("--out-dir", type=Path, default=Path("sfx"))
    parser.add_argument("--mix", action="store_true", help="with --from-storyboard: also sum everything into stem.wav")
    args = parser.parse_args(argv)

    if args.all:
        for kind in KINDS:
            make(kind, args.out_dir / f"{kind}.wav", None, args.pitch, args.seed, 3 if kind == "tick" else 1)
        return 0

    if args.from_storyboard:
        board = json.loads(args.from_storyboard.read_text(encoding="utf-8"))
        plan = plan_from_storyboard(board)
        items = []
        for k, p in enumerate(plan, 1):
            path = args.out_dir / f"{k:02d}_{p['kind']}.wav"
            info = make(p["kind"], path, p["length"], 1.0, args.seed + k, 1, quiet=True)
            items.append({**p, **info, "file": str(path)})
            print(f"{p['start']:7.3f} s  {p['kind']:8s} {p['gain_db']:+.0f} dB  peak {info['peak_db']} / RMS {info['rms_db']}  — {p['why']}")
        timeline = {"fps": board.get("fps", 30), "sounds": items}
        (args.out_dir / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"{len(items)} sounds → {args.out_dir / 'timeline.json'}")
        if args.mix:
            shots = board.get("shots") or []
            duration = (shots[-1]["end"] if shots else 0) + 1.5
            peak, rms = mix(items, duration, args.out_dir / "stem.wav")
            print(f"stem → {args.out_dir / 'stem.wav'}: {duration:.2f} s · peak {peak} dBFS · RMS {rms} dBFS")
        return 0

    if not args.kind or not args.out:
        parser.error("give --kind and --out, or --all, or --from-storyboard")
    make(args.kind, args.out, args.length, args.pitch, args.seed, args.count)
    return 0


if __name__ == "__main__":
    sys.exit(main())
