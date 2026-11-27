#!/usr/bin/env python3
"""QC a finished film before anyone sees it: rhythm, motion, picture, sound, specs.

Part of Claude Cinematic Studio (cinema-review). Looks at the film the way a
finishing editor does on the last pass and writes a report with evidence:
a contact sheet, a motion graph with every cut and beat on it, and a list of
problems with timecodes.

Python 3 standard library only; reads frames and measurements through ffmpeg.

What it checks:
  - Contact sheet: N frames on a grid with their timecodes (contact.jpg).
  - Motion energy: mean absolute difference between consecutive frames on a
    small grey copy. A stretch with no motion longer than --dead (1.2 s) is
    a "dead" hold — fine as a deliberate breath, a problem by accident.
  - Cuts: frames where the picture changes completely (luma histogram jump
    well above its neighbours). With --beats (beats.json) every cut gets its
    offset to the nearest beat in frames; more than 2 frames reads as late.
  - Flash frames: fully black or white frames and their runs (a 1-frame
    black between shots is usually a render gap, not intent).
  - Banding risk: frames where a large dark area is smooth gradient — where
    8-bit H.264 shows steps. Fix with grain/dither and more bitrate.
  - Loudness: integrated LUFS and true peak (ebur128) against the platforms.
  - Specs: codec, pixel format, frame rate, size, bitrate, faststart and the
    limits of Instagram Reels, TikTok, YouTube (Shorts) and the web.
  - Safe zones: for a vertical film, a frame with the Reels / TikTok / Shorts
    interface areas drawn over it (safezones.jpg).

Writes into --out: report.md, report.json, contact.jpg, motion.svg and
safezones.jpg (vertical only).

Examples:
    python3 review.py out/film-master.mp4 --out out/review
    python3 review.py out/film-master.mp4 --beats public/data/beats.json --offset 31 --out out/review
    python3 review.py out/reel.mp4 --platform instagram --out out/review-reel
"""
from __future__ import annotations

import argparse
import json
import math
import re
import shutil
import statistics
import subprocess
import sys
from fractions import Fraction
from pathlib import Path

SMALL_W, SMALL_H = 96, 54

PLATFORMS = {
    "instagram": {"aspect": (9, 16), "max_fps": 60, "lufs": -14, "max_seconds": 180, "max_mbps": 25, "label": "Instagram Reels"},
    "tiktok": {"aspect": (9, 16), "max_fps": 60, "lufs": -14, "max_seconds": 600, "max_mbps": 25, "label": "TikTok"},
    "youtube": {"aspect": None, "max_fps": 60, "lufs": -14, "max_seconds": None, "max_mbps": 85, "label": "YouTube"},
    "shorts": {"aspect": (9, 16), "max_fps": 60, "lufs": -14, "max_seconds": 180, "max_mbps": 40, "label": "YouTube Shorts"},
    "web": {"aspect": None, "max_fps": 60, "lufs": -16, "max_seconds": None, "max_mbps": 12, "label": "Web / landing page"},
}


def ff(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, **kw)


def probe(path: Path) -> dict:
    data = json.loads(ff(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(path)], text=True, check=True).stdout)
    v = next((s for s in data["streams"] if s["codec_type"] == "video"), None)
    if not v:
        raise RuntimeError("no video stream")
    a = next((s for s in data["streams"] if s["codec_type"] == "audio"), None)
    fps = Fraction(v.get("avg_frame_rate") or "0/1")
    if not fps:
        fps = Fraction(v.get("r_frame_rate") or "30/1")
    duration = float(data["format"].get("duration") or v.get("duration") or 0)
    return {
        "width": int(v["width"]), "height": int(v["height"]), "fps": float(fps), "duration": duration,
        "codec": v.get("codec_name"), "profile": v.get("profile"), "pix_fmt": v.get("pix_fmt"),
        "bitrate_mbps": round(int(data["format"].get("bit_rate") or 0) / 1e6, 2),
        "audio": {"codec": a.get("codec_name"), "rate": int(a.get("sample_rate", 0)), "channels": a.get("channels")} if a else None,
        "size_mb": round(int(data["format"].get("size") or 0) / 1e6, 2),
    }


def faststart(path: Path) -> bool | None:
    """True if the moov atom comes before mdat (playback starts before the download ends)."""
    try:
        with path.open("rb") as f:
            pos = 0
            for _ in range(64):
                f.seek(pos)
                head = f.read(16)
                if len(head) < 8:
                    return None
                size = int.from_bytes(head[:4], "big")
                kind = head[4:8].decode("latin-1")
                if size == 1:
                    size = int.from_bytes(head[8:16], "big")
                if kind == "moov":
                    return True
                if kind == "mdat":
                    return False
                if size < 8:
                    return None
                pos += size
    except OSError:
        return None
    return None


def grey_frames(path: Path) -> list[bytes]:
    raw = ff(["ffmpeg", "-v", "error", "-i", str(path), "-vf", f"scale={SMALL_W}:{SMALL_H}:flags=area,format=gray", "-f", "rawvideo", "-"], check=True).stdout
    n = SMALL_W * SMALL_H
    return [raw[i : i + n] for i in range(0, len(raw) - n + 1, n)]


def histogram(frame: bytes, bins: int = 32) -> list[float]:
    h = [0] * bins
    for v in frame:
        h[v * bins // 256] += 1
    total = len(frame)
    return [x / total for x in h]


def analyse_motion(frames: list[bytes], fps: float) -> dict:
    energy = [0.0]
    hist_jump = [0.0]
    prev_h = histogram(frames[0]) if frames else []
    for a, b in zip(frames, frames[1:]):
        energy.append(sum(abs(x - y) for x, y in zip(a, b)) / len(a))
        h = histogram(b)
        hist_jump.append(sum(abs(x - y) for x, y in zip(prev_h, h)) / 2)
        prev_h = h
    means = [sum(f) / len(f) for f in frames]
    return {"energy": energy, "hist": hist_jump, "luma": means}


def find_cuts(motion: dict, fps: float) -> list[int]:
    hist, energy = motion["hist"], motion["energy"]
    cuts = []
    for i in range(1, len(hist)):
        lo, hi = max(1, i - 6), min(len(hist), i + 7)
        neighbours = [hist[j] for j in range(lo, hi) if j != i] or [0.0]
        base = statistics.median(neighbours)
        e_neigh = statistics.median([energy[j] for j in range(lo, hi) if j != i] or [0.0])
        if (hist[i] > 0.25 and hist[i] > 3 * base + 0.05) or (energy[i] > 40 and energy[i] > 4 * e_neigh + 8):
            if not cuts or i - cuts[-1] > 2:
                cuts.append(i)
    return cuts


def dead_stretches(energy: list[float], fps: float, threshold: float, min_seconds: float) -> list[tuple[float, float]]:
    out, start = [], None
    for i, e in enumerate(energy + [999]):
        if e < threshold and i > 0:
            start = i if start is None else start
        else:
            if start is not None and (i - start) / fps >= min_seconds:
                out.append((round(start / fps, 2), round(i / fps, 2)))
            start = None
    return out


def flash_frames(luma: list[float], fps: float) -> dict:
    black = [i for i, v in enumerate(luma) if v < 12]
    white = [i for i, v in enumerate(luma) if v > 240]

    def runs(idx: list[int]) -> list[tuple[float, int]]:
        out = []
        for i in idx:
            if out and i == out[-1][0] + out[-1][1]:
                out[-1] = (out[-1][0], out[-1][1] + 1)
            else:
                out.append((i, 1))
        return [(round(s / fps, 3), n) for s, n in out]

    return {"black": runs(black), "white": runs(white)}


def banding_risk(path: Path, duration: float, samples: int = 12) -> list[dict]:
    """Share of the frame that is dark, smooth gradient (local steps of 0–1 levels)."""
    w, h = 480, 270
    found = []
    for k in range(samples):
        t = duration * (k + 0.5) / samples
        raw = ff(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", str(path), "-frames:v", "1", "-vf", f"scale={w}:{h}:flags=bilinear,format=gray", "-f", "rawvideo", "-"]).stdout
        if len(raw) < w * h:
            continue
        smooth = 0
        for y in range(1, h - 1, 2):
            row = raw[y * w : (y + 1) * w]
            below = raw[(y + 1) * w : (y + 2) * w]
            for x in range(1, w - 1, 2):
                v = row[x]
                if 6 < v < 70 and abs(v - row[x + 1]) <= 1 and abs(v - row[x - 1]) <= 1 and abs(v - below[x]) <= 1:
                    smooth += 1
        share = smooth / ((h // 2) * (w // 2))
        found.append({"t": round(t, 2), "smooth_dark_share": round(share, 3)})
    return found


def loudness(path: Path) -> dict | None:
    out = ff(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=true", "-f", "null", "-"], text=True).stderr
    i = re.findall(r"I:\s+(-?[\d.]+) LUFS", out)
    lra = re.findall(r"LRA:\s+(-?[\d.]+) LU", out)
    tp = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", out)
    if not i:
        return None
    return {"integrated_lufs": float(i[-1]), "lra": float(lra[-1]) if lra else None, "true_peak_db": float(tp[-1]) if tp else None}


def contact_sheet(path: Path, duration: float, out: Path, count: int, vertical: bool) -> tuple[list[float], bool]:
    tmp = out.parent / "_frames"
    tmp.mkdir(parents=True, exist_ok=True)
    width = 270 if vertical else 480
    stamped = True
    times = []
    for k in range(count):
        t = duration * (k + 0.5) / count
        times.append(round(t, 2))
        target = tmp / f"f{k:03d}.jpg"
        label = f"{int(t // 60):02d}\\:{t % 60:05.2f}"
        base = ["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", str(path), "-frames:v", "1"]
        vf = f"scale={width}:-2,drawtext=text='{label}':x=8:y=8:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.6"
        if not stamped or ff(base + ["-vf", vf, "-q:v", "3", str(target)]).returncode != 0:
            # This ffmpeg has no drawtext (built without freetype): the times go into the report instead.
            stamped = False
            ff(base + ["-vf", f"scale={width}:-2", "-q:v", "3", str(target)], check=True)
    cols = 6 if vertical else 4
    rows = math.ceil(count / cols)
    ff(["ffmpeg", "-v", "error", "-y", "-framerate", "1", "-i", str(tmp / "f%03d.jpg"), "-vf", f"tile={cols}x{rows}:padding=4:color=black", "-frames:v", "1", "-q:v", "3", str(out)], check=True)
    shutil.rmtree(tmp, ignore_errors=True)
    return times, stamped


def safe_zones(path: Path, duration: float, out: Path) -> None:
    """Reels / TikTok / Shorts interface areas over a mid frame (red = covered by UI)."""
    boxes = [
        "drawbox=x=0:y=0:w=iw:h=ih*0.14:color=red@0.35:t=fill",          # top bar, account, sound
        "drawbox=x=0:y=ih*0.78:w=iw:h=ih*0.22:color=red@0.35:t=fill",    # caption, music, CTA
        "drawbox=x=iw*0.86:y=ih*0.40:w=iw*0.14:h=ih*0.38:color=red@0.35:t=fill",  # like / comment / share column
        "drawbox=x=iw*0.06:y=ih*0.14:w=iw*0.80:h=ih*0.64:color=lime@0.9:t=3",     # safe area for type
    ]
    ff(["ffmpeg", "-v", "error", "-y", "-ss", f"{duration / 2:.3f}", "-i", str(path), "-frames:v", "1", "-vf", ",".join(boxes) + ",scale=540:-2", "-q:v", "3", str(out)], check=True)


def motion_svg(motion: dict, cuts: list[int], beats: list[float], fps: float, dead: list[tuple[float, float]], out: Path) -> None:
    energy = motion["energy"]
    n = len(energy)
    W, H, pad = 1200, 260, 30
    # Scale to the typical motion, not to the cut spikes, so the shape of the film is readable.
    ordered = sorted(energy[1:] or [1.0])
    top = max(1.0, ordered[int(len(ordered) * 0.95) - 1] * 1.6 if len(ordered) > 20 else ordered[-1])
    x = lambda i: pad + (W - 2 * pad) * i / max(1, n - 1)
    y = lambda e: H - pad - (H - 2 * pad) * min(1.0, e / top)
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="sans-serif" font-size="11">',
             f'<rect width="{W}" height="{H}" fill="#0c0c0e"/>']
    for a, b in dead:
        parts.append(f'<rect x="{x(a * fps):.1f}" y="{pad}" width="{x(b * fps) - x(a * fps):.1f}" height="{H - 2 * pad}" fill="#ff5a4a" opacity="0.18"/>')
    for bt in beats:
        parts.append(f'<line x1="{x(bt * fps):.1f}" x2="{x(bt * fps):.1f}" y1="{H - pad}" y2="{H - pad + 8}" stroke="#7a8cff" stroke-width="1"/>')
    for c in cuts:
        parts.append(f'<line x1="{x(c):.1f}" x2="{x(c):.1f}" y1="{pad}" y2="{H - pad}" stroke="#ffd34a" stroke-width="1" stroke-dasharray="3 3"/>')
    pts = " ".join(f"{x(i):.1f},{y(e):.1f}" for i, e in enumerate(energy))
    parts.append(f'<polyline points="{pts}" fill="none" stroke="#5ee0ff" stroke-width="1.5"/>')
    seconds = int(n / fps) + 1
    for s in range(0, seconds, max(1, seconds // 12)):
        parts.append(f'<text x="{x(s * fps):.1f}" y="{H - 8}" fill="#888" text-anchor="middle">{s}s</text>')
    parts.append(f'<text x="{pad}" y="18" fill="#ccc">motion energy · yellow = cuts · blue ticks = beats · red = dead stretches</text></svg>')
    out.write_text("\n".join(parts), encoding="utf-8")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="QC report for a finished film.")
    parser.add_argument("video", type=Path)
    parser.add_argument("--out", type=Path, default=Path("review"))
    parser.add_argument("--beats", type=Path, help="beats.json from beats.py: report each cut's offset to the beat")
    parser.add_argument("--offset", type=float, default=0.0, help="music time at which the film starts")
    parser.add_argument("--platform", choices=list(PLATFORMS), action="append", help="check against these (default: guess from shape)")
    parser.add_argument("--frames", type=int, default=12, help="frames on the contact sheet")
    parser.add_argument("--dead", type=float, default=1.2, help="seconds without motion that count as a dead stretch")
    parser.add_argument("--still-threshold", type=float, default=0.6, help="motion energy below this is 'no motion' (0–255 scale)")
    args = parser.parse_args(argv)
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        print("error: ffmpeg and ffprobe are required", file=sys.stderr)
        return 1
    try:
        info = probe(args.video)
    except (RuntimeError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    args.out.mkdir(parents=True, exist_ok=True)
    fps = info["fps"]
    vertical = info["height"] > info["width"]

    frames = grey_frames(args.video)
    motion = analyse_motion(frames, fps)
    cuts = find_cuts(motion, fps)
    dead = dead_stretches(motion["energy"], fps, args.still_threshold, args.dead)
    flashes = flash_frames(motion["luma"], fps)
    band = banding_risk(args.video, info["duration"])
    loud = loudness(args.video) if info["audio"] else None
    fast = faststart(args.video) if args.video.suffix.lower() in (".mp4", ".mov", ".m4v") else None

    beats: list[float] = []
    if args.beats:
        b = json.loads(args.beats.read_text(encoding="utf-8"))
        beats = [t - args.offset for t in ((b.get("grid") or {}).get("beats") or b.get("beats") or []) if t - args.offset >= -0.01]
    cut_report = []
    for c in cuts:
        t = c / fps
        entry = {"frame": c, "t": round(t, 3)}
        if beats:
            nearest = min(beats, key=lambda bt: abs(bt - t))
            entry["beat"] = round(nearest, 3)
            entry["offset_frames"] = round((t - nearest) * fps, 1)
        cut_report.append(entry)

    problems: list[str] = []
    notes: list[str] = []
    for a, b in dead:
        problems.append(f"{a:.2f}–{b:.2f} с: нет движения {b - a:.1f} с — если это не задуманный «вдох», добавь дрейф камеры или движение в кадре")
    late = [c for c in cut_report if "offset_frames" in c and abs(c["offset_frames"]) > 2]
    for c in late:
        problems.append(f"склейка {c['t']:.2f} с мимо доли на {c['offset_frames']:+.1f} кадр. (доля {c['beat']:.2f} с)")
    for start, length in flashes["black"]:
        if length <= 2 and 0.1 < start < info["duration"] - 0.2:
            problems.append(f"{start:.2f} с: чёрный кадр ×{length} — похоже на дыру в рендере, а не на приём")
    for start, length in flashes["white"]:
        if length > 4:
            problems.append(f"{start:.2f} с: белая вспышка {length} кадров — длиннее 4 кадров режет глаз")
    risky = [x for x in band if x["smooth_dark_share"] > 0.35]
    if risky:
        problems.append(f"риск полос (бэндинга) в тёмных градиентах: {', '.join(str(x['t']) + ' с' for x in risky[:5])} — добавь зерно 6–8 (finish.py --grain) и битрейт")

    platforms = args.platform or (["instagram", "tiktok", "shorts"] if vertical else ["youtube", "web"])
    spec_rows = []
    for name in platforms:
        p = PLATFORMS[name]
        issues = []
        if p["aspect"] and abs(info["width"] / info["height"] - p["aspect"][0] / p["aspect"][1]) > 0.01:
            issues.append(f"кадр {info['width']}×{info['height']}, нужен {p['aspect'][0]}:{p['aspect'][1]}")
        if info["fps"] > p["max_fps"] + 0.01:
            issues.append(f"{info['fps']:g} fps > {p['max_fps']}")
        if p["max_seconds"] and info["duration"] > p["max_seconds"]:
            issues.append(f"длительность {info['duration']:.0f} с > {p['max_seconds']} с")
        if info["codec"] != "h264" and name != "youtube":
            issues.append(f"кодек {info['codec']} — надёжнее H.264")
        if info["pix_fmt"] not in ("yuv420p", "yuvj420p"):
            issues.append(f"pix_fmt {info['pix_fmt']} — нужен yuv420p, иначе часть плееров покажет чёрный экран")
        if info["bitrate_mbps"] > p["max_mbps"]:
            issues.append(f"битрейт {info['bitrate_mbps']} Мбит/с > {p['max_mbps']} — площадка пережмёт сама, хуже")
        if loud and abs(loud["integrated_lufs"] - p["lufs"]) > 2:
            issues.append(f"громкость {loud['integrated_lufs']} LUFS, цель {p['lufs']}")
        if loud and loud["true_peak_db"] is not None and loud["true_peak_db"] > -1:
            issues.append(f"true peak {loud['true_peak_db']} dBTP > −1")
        if name == "web" and fast is False:
            issues.append("moov в конце файла — добавь -movflags +faststart")
        if not info["audio"] and name in ("instagram", "tiktok", "shorts"):
            issues.append("нет звука — ролик без звука в ленте теряет досмотры")
        spec_rows.append({"platform": p["label"], "ok": not issues, "issues": issues})

    contact = args.out / "contact.jpg"
    sheet_times, stamped = contact_sheet(args.video, info["duration"], contact, args.frames, vertical)
    motion_svg(motion, cuts, beats, fps, dead, args.out / "motion.svg")
    if vertical:
        safe_zones(args.video, info["duration"], args.out / "safezones.jpg")

    avg_shot = (info["duration"] / (len(cuts) + 1)) if info["duration"] else 0
    if avg_shot and avg_shot < 0.6:
        notes.append(f"средний шот {avg_shot:.2f} с — очень плотно; проверь, что зритель успевает читать")
    if avg_shot > 4 and info["duration"] > 10:
        notes.append(f"средний шот {avg_shot:.2f} с — для рекламы медленно, если это не один длинный пролёт камеры")

    result = {"file": str(args.video), "info": info, "faststart": fast, "cuts": cut_report, "dead": dead, "flashes": flashes,
              "banding": band, "loudness": loud, "platforms": spec_rows, "problems": problems, "notes": notes,
              "motion_energy_mean": round(statistics.mean(motion["energy"][1:] or [0]), 2)}
    (args.out / "report.json").write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    md = [f"# QC: {args.video.name}", "",
          f"{info['width']}×{info['height']} · {info['fps']:g} fps · {info['duration']:.2f} с · {info['codec']} {info['pix_fmt']} · {info['bitrate_mbps']} Мбит/с · {info['size_mb']} МБ"
          + (f" · звук {info['audio']['codec']} {info['audio']['rate']} Гц" if info["audio"] else " · без звука"), "",
          "![Контактный лист](contact.jpg)", ""]
    if not stamped:
        md += ["Кадры листа слева направо, сверху вниз: " + ", ".join(f"{t:.2f} с" for t in sheet_times), ""]
    md += ["![Движение, склейки и доли](motion.svg)", ""]
    if vertical:
        md += ["![Безопасные зоны](safezones.jpg)", ""]
    md += ["## Проблемы", ""] + ([f"- {p}" for p in problems] or ["- не найдено"]) + [""]
    if notes:
        md += ["## Заметки", ""] + [f"- {n}" for n in notes] + [""]
    md += ["## Склейки", "", "| Кадр | Время, с | Ближайшая доля | Сдвиг, кадров |", "|---|---|---|---|"]
    md += [f"| {c['frame']} | {c['t']:.3f} | {c.get('beat', '—')} | {c.get('offset_frames', '—')} |" for c in cut_report] or ["| — | склеек не найдено | | |"]
    md += ["", "## Звук", ""]
    md += [f"- Интегральная громкость {loud['integrated_lufs']} LUFS, диапазон {loud['lra']} LU, true peak {loud['true_peak_db']} dBTP"] if loud else ["- звуковой дорожки нет"]
    md += ["", "## Площадки", ""] + [f"- {'✓' if r['ok'] else '✗'} {r['platform']}" + ("" if r["ok"] else ": " + "; ".join(r["issues"])) for r in spec_rows]
    md += ["", f"Faststart: {'да' if fast else 'нет' if fast is False else '—'}", ""]
    (args.out / "report.md").write_text("\n".join(md), encoding="utf-8")

    print(f"{args.video.name}: {info['duration']:.2f} с, {len(cuts)} склеек, мёртвых участков {len(dead)}, проблем {len(problems)}"
          + (f", {loud['integrated_lufs']} LUFS / {loud['true_peak_db']} dBTP" if loud else ", без звука"))
    for p in problems[:8]:
        print(f"  ✗ {p}")
    for r in spec_rows:
        print(f"  {'✓' if r['ok'] else '✗'} {r['platform']}" + ("" if r["ok"] else ": " + "; ".join(r["issues"])))
    print(f"→ {args.out / 'report.md'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
