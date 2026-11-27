#!/usr/bin/env python3
"""The finishing pass: real motion blur, grade, halation, grain, sound, exports.

Part of Claude Cinematic Studio (grade-finish). Takes a render from the
Remotion project and turns it into a master the way a finishing suite would.
Every step is an ffmpeg filter; the script prints the exact command it runs,
so the pass can be repeated or tweaked by hand.

Python 3 standard library only; needs ffmpeg and ffprobe.

Steps (each one is opt-in):
  --motion-blur   Real shutter blur. Render the composition at N× the delivery
                  frame rate, then each delivered frame is the average of the
                  sub-frames the shutter was open for. 180° (the film
                  standard) = the first half of every group of N. The project
                  times everything in seconds, so the same composition renders
                  at 120 fps without changes:
                      npx remotion render HeroTitle out/hero@120.mov \\
                        --props '{"fps":120}' --codec=prores --prores-profile=hq
                      python3 finish.py out/hero@120.mov --motion-blur --target-fps 30
                  4× (120 → 30) is the sweet spot; 8× is smoother and 2× cheaper.
  --lut FILE      3D LUT from make_luts.py (or any .cube); --lut-mix 0–1.
  --halation      Film halation: highlights bleed a warm red-orange glow.
  --glow          Neutral bloom on bright areas — for footage that has none.
  --grain         Film grain on luma (strength 0–30, 8 is subtle). Temporal,
                  seeded, so two runs give the same file.
  --vignette      Darker corners (angle in radians, 0.3–0.6 is natural).
  --letterbox     Black bars for a cinema ratio inside the frame (2.39, 2.0…).
  Sound:          --music and/or --sfx (stem from sfx.py), optional --duck
                  (music dips under the SFX), two-pass loudness normalisation
                  to --lufs (−14 for Instagram, TikTok, YouTube) with a −1 dBTP
                  ceiling. The film's own audio is kept with --keep-audio.
  Exports:        master (H.264 High, CRF 14, yuv420p; --prores for ProRes 422
                  HQ), --web copy (CRF 21, faststart, capped bitrate),
                  --crop 9x16 / 1x1 / 4x5 copies, centred on --focus (0 = left
                  or top edge, 0.5 = centre, 1 = right or bottom).

Examples:
    python3 finish.py out/hero@120.mov --motion-blur --target-fps 30 --shutter 180 \\
        --lut luts/keynote-neutral.cube --lut-mix 0.8 --halation --grain 7 \\
        --music public/audio/track.mp3 --sfx public/sfx/stem.wav --duck \\
        --out out/hero-master.mp4 --web --crop 9x16 --focus 0.5
    python3 finish.py out/promo.mp4 --letterbox 2.39 --grain 6 --out out/promo-final.mp4
    python3 finish.py out/promo.mp4 --glow --dry-run      # only print the commands
"""
from __future__ import annotations

import argparse
import json
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
from fractions import Fraction
from pathlib import Path


def run(cmd: list[str], dry: bool, capture: bool = False) -> subprocess.CompletedProcess | None:
    print("$ " + shlex.join(cmd))
    if dry:
        return None
    return subprocess.run(cmd, check=True, capture_output=capture, text=True)


def probe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(path)],
        check=True, capture_output=True, text=True,
    ).stdout
    data = json.loads(out)
    video = next((s for s in data["streams"] if s["codec_type"] == "video"), None)
    if not video:
        raise RuntimeError(f"{path}: no video stream")
    fps = Fraction(video.get("avg_frame_rate") or video.get("r_frame_rate") or "30/1")
    if fps == 0:
        fps = Fraction(video.get("r_frame_rate", "30/1"))
    return {
        "width": int(video["width"]),
        "height": int(video["height"]),
        "fps": fps,
        "duration": float(data["format"].get("duration") or video.get("duration") or 0),
        "has_audio": any(s["codec_type"] == "audio" for s in data["streams"]),
    }


def video_chain(args, info: dict) -> tuple[str, Fraction]:
    """Builds the -filter_complex graph from [0:v] to [vout]."""
    parts: list[str] = []
    label = "0:v"
    n = 0

    def step(text: str) -> None:
        nonlocal label, n
        n += 1
        new = f"v{n}"
        parts.append(f"[{label}]{text}[{new}]")
        label = new

    out_fps = info["fps"]
    if args.motion_blur:
        target = Fraction(args.target_fps).limit_denominator(1001)
        ratio = info["fps"] / target
        group = round(float(ratio))
        if group < 2 or abs(float(ratio) - group) > 0.01:
            raise RuntimeError(
                f"motion blur needs a render at a whole multiple of {float(target):g} fps; input is {float(info['fps']):g} fps "
                f"(render with --props '{{\"fps\":{int(float(target) * 4)}}}')"
            )
        open_frames = max(1, min(group, round(group * args.shutter / 360)))
        weights = " ".join(["1"] * open_frames)
        # tmix averages each frame with the ones before it; keep the frame that closes each shutter.
        step(f"format=gbrp,tmix=frames={open_frames}:weights='{weights}'")
        step(f"select='eq(mod(n-{open_frames - 1}\\,{group})\\,0)',setpts=N/({float(target)}*TB)")
        out_fps = target
        print(f"motion blur: {float(info['fps']):g} fps → {float(target):g} fps, {group} sub-frames per frame, shutter {args.shutter:g}° = {open_frames} averaged")

    if args.lut:
        lut = Path(args.lut).resolve().as_posix().replace("'", "\\'")
        mix = max(0.0, min(1.0, args.lut_mix))
        n += 1
        a, b, g, o = f"la{n}", f"lb{n}", f"lg{n}", f"v{n}"
        parts.append(f"[{label}]format=gbrp,split[{a}][{b}]")
        parts.append(f"[{b}]lut3d=file='{lut}':interp=tetrahedral,format=gbrp[{g}]")
        parts.append(f"[{g}][{a}]blend=all_mode=normal:all_opacity={mix}[{o}]")
        label = o

    def light_bleed(threshold: float, sigma: float, mixer: str, opacity: float) -> None:
        nonlocal label, n
        n += 1
        a, b, g, o = f"ha{n}", f"hb{n}", f"hg{n}", f"v{n}"
        parts.append(f"[{label}]format=gbrp,split[{a}][{b}]")
        parts.append(
            f"[{b}]colorlevels=rimin={threshold}:gimin={threshold}:bimin={threshold},gblur=sigma={sigma},"
            f"colorchannelmixer={mixer},format=gbrp[{g}]"
        )
        parts.append(f"[{a}][{g}]blend=all_mode=screen:all_opacity={opacity}[{o}]")
        label = o

    scale = info["height"] / 1080
    if args.halation:
        light_bleed(0.72, 6 * scale, "rr=1:gg=0.32:bb=0.12:rg=0:gr=0", args.halation_strength)
    if args.glow:
        light_bleed(0.62, 22 * scale, "rr=1:gg=1:bb=1", args.glow_strength)

    if args.vignette:
        step(f"vignette=angle={args.vignette}:mode=forward")
    if args.grain:
        step(f"format=yuv444p,noise=c0s={args.grain}:c0f=t+u:all_seed={args.seed}")
    if args.letterbox:
        visible = info["width"] / args.letterbox
        bar = max(0, int(round((info["height"] - visible) / 2)))
        if bar > 0:
            step(f"drawbox=x=0:y=0:w=iw:h={bar}:color=black:t=fill,drawbox=x=0:y=ih-{bar}:w=iw:h={bar}:color=black:t=fill")
    final = "yuv422p10le" if args.prores else "yuv420p"
    step(f"format={final}")
    # The last label appears once, at the very end: rename it to the output pad.
    graph = ";".join(parts).replace(f"[{label}]", "[vout]")
    return graph, out_fps


def audio_mix(args, info: dict, workdir: Path, dry: bool) -> Path | None:
    sources = []
    if args.keep_audio and info["has_audio"]:
        sources.append((str(args.input), 0.0, "film"))
    if args.music:
        sources.append((str(args.music), args.music_db, "music"))
    if args.sfx:
        sources.append((str(args.sfx), args.sfx_db, "sfx"))
    if not sources:
        return None
    inputs: list[str] = []
    for path, _, _ in sources:
        inputs += ["-i", path]
    parts = []
    labels = []
    for i, (_, db, name) in enumerate(sources):
        parts.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,volume={db}dB[{name}]")
        labels.append(name)
    if args.duck and "music" in labels and "sfx" in labels:
        parts.append("[sfx]asplit[sfx][key]")
        parts.append("[music][key]sidechaincompress=threshold=0.05:ratio=6:attack=15:release=250[music]")
    parts.append("".join(f"[{l}]" for l in labels) + f"amix=inputs={len(labels)}:normalize=0:duration=longest,atrim=0:{info['duration']:.3f}[mix]")
    graph = ";".join(parts)

    measure = ["ffmpeg", "-hide_banner", "-nostats", *inputs, "-filter_complex", graph + f";[mix]loudnorm=I={args.lufs}:TP=-1:LRA=11:print_format=json[o]", "-map", "[o]", "-f", "null", "-"]
    result = run(measure, dry, capture=True)
    target = workdir / "mix.wav"
    if dry:
        run(["ffmpeg", "-y", *inputs, "-filter_complex", graph + f";[mix]loudnorm=I={args.lufs}:TP=-1:LRA=11:measured_I=…:linear=true[o]", "-map", "[o]", str(target)], True)
        return target
    text = (result.stderr or "") if result else ""
    found = re.findall(r"\{[^{}]*\"input_i\"[^{}]*\}", text, re.S)
    if not found:
        raise RuntimeError("loudnorm measurement failed:\n" + text[-800:])
    m = json.loads(found[-1])
    # Linear gain to the target, then a limiter for the true-peak ceiling. (loudnorm's own
    # second pass silently switches to dynamic mode when the music's range is wide, and on a
    # short film that pumps; a fixed gain keeps the mix exactly as balanced.)
    gain = args.lufs - float(m["input_i"])
    got = peak = None
    for attempt in range(4):
        second = f";[mix]volume={gain:.2f}dB,alimiter=limit=0.84:attack=1:release=60:level=false,aresample=48000[o]"
        run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph + second, "-map", "[o]", "-c:a", "pcm_s16le", str(target)], dry)
        check = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(target), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
        found_i = re.findall(r"I:\s+(-?[\d.]+) LUFS", check)
        found_p = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", check)
        got = float(found_i[-1]) if found_i else None
        peak = float(found_p[-1]) if found_p else None
        # The limiter takes some of the gain back on peaky material: add the shortfall and go again.
        if got is None or abs(got - args.lufs) <= 0.5 or gain > 30:
            break
        gain += args.lufs - got
    print(f"sound: measured {m['input_i']} LUFS, gain {gain:+.2f} dB → {got} LUFS, true peak {peak} dBTP")
    if got is not None and abs(got - args.lufs) > 0.5:
        print(f"warning: could not reach {args.lufs} LUFS without crushing the peaks (got {got}); the mix is very peaky — compress the music first")
    return target


def crop_filter(spec: str, info: dict, focus: float) -> tuple[str, str]:
    w, h = (int(x) for x in spec.lower().split("x"))
    src = info["width"] / info["height"]
    want = w / h
    if src > want:  # too wide: crop width
        cw = int(round(info["height"] * want / 2)) * 2
        x = int(round((info["width"] - cw) * focus))
        crop = f"crop={cw}:{info['height']}:{x}:0"
    else:
        ch = int(round(info["width"] / want / 2)) * 2
        y = int(round((info["height"] - ch) * focus))
        crop = f"crop={info['width']}:{ch}:0:{y}"
    sizes = {(9, 16): "1080:1920", (1, 1): "1080:1080", (4, 5): "1080:1350", (16, 9): "1920:1080"}
    size = sizes.get((w, h), "-2:1080")
    return f"{crop},scale={size}:flags=lanczos,setsar=1", f"{w}x{h}"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Finishing pass: motion blur, LUT, halation, grain, sound, exports.")
    parser.add_argument("input", type=Path)
    parser.add_argument("--out", type=Path, help="master file (default: <input>-master.mp4)")
    parser.add_argument("--motion-blur", action="store_true")
    parser.add_argument("--target-fps", type=float, default=30)
    parser.add_argument("--shutter", type=float, default=180, help="shutter angle in degrees (180 = film, 90 = crisp, 270 = dreamy)")
    parser.add_argument("--lut", type=Path)
    parser.add_argument("--lut-mix", type=float, default=1.0)
    parser.add_argument("--halation", action="store_true")
    parser.add_argument("--halation-strength", type=float, default=0.35)
    parser.add_argument("--glow", action="store_true")
    parser.add_argument("--glow-strength", type=float, default=0.25)
    parser.add_argument("--grain", type=float, default=0, help="0–30; 6–10 reads as film")
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--vignette", type=float, default=0, help="angle in radians, e.g. 0.45")
    parser.add_argument("--letterbox", type=float, default=0, help="target ratio, e.g. 2.39")
    parser.add_argument("--music", type=Path)
    parser.add_argument("--music-db", type=float, default=-3)
    parser.add_argument("--sfx", type=Path, help="SFX stem (sfx.py --mix)")
    parser.add_argument("--sfx-db", type=float, default=0)
    parser.add_argument("--duck", action="store_true", help="music dips under the SFX")
    parser.add_argument("--keep-audio", action="store_true", help="keep the film's own audio in the mix")
    parser.add_argument("--lufs", type=float, default=-14)
    parser.add_argument("--prores", action="store_true", help="master as ProRes 422 HQ .mov")
    parser.add_argument("--web", action="store_true", help="also write a web copy (smaller, faststart)")
    parser.add_argument("--crop", action="append", default=[], help="9x16, 1x1, 4x5 — repeatable")
    parser.add_argument("--focus", type=float, default=0.5, help="crop centre 0–1")
    parser.add_argument("--dry-run", action="store_true", help="print the commands, run nothing")
    args = parser.parse_args(argv)

    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        print("error: ffmpeg and ffprobe are required", file=sys.stderr)
        return 1
    try:
        info = probe(args.input)
        if args.letterbox and args.crop:
            print("warning: --letterbox with --crop: the vertical/square copies are cut from the letterboxed master and keep its bars; "
                  "run a second pass without --letterbox for social crops")
        out = args.out or args.input.with_name(args.input.stem + ("-master.mov" if args.prores else "-master.mp4"))
        if args.prores and out.suffix.lower() != ".mov":
            out = out.with_suffix(".mov")
        out.parent.mkdir(parents=True, exist_ok=True)
        graph, out_fps = video_chain(args, info)
        with tempfile.TemporaryDirectory() as tmp:
            mix = audio_mix(args, info, Path(tmp), args.dry_run)
            cmd = ["ffmpeg", "-v", "error", "-stats", "-y", "-i", str(args.input)]
            if mix:
                cmd += ["-i", str(mix)]
            cmd += ["-filter_complex", graph, "-map", "[vout]"]
            if mix:
                cmd += ["-map", "1:a", "-c:a", "pcm_s16le" if args.prores else "aac", "-b:a", "320k", "-shortest"]
            cmd += ["-r", str(out_fps)]
            if args.prores:
                cmd += ["-c:v", "prores_ks", "-profile:v", "3", "-pix_fmt", "yuv422p10le"]
            else:
                cmd += ["-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
            cmd.append(str(out))
            run(cmd, args.dry_run)

        made = [out]
        if args.web:
            web = out.with_name(out.stem.replace("-master", "") + "-web.mp4")
            run(["ffmpeg", "-v", "error", "-y", "-i", str(out), "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "21",
                 "-maxrate", "8M", "-bufsize", "16M", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(web)], args.dry_run)
            made.append(web)
        for spec in args.crop:
            vf, tag = crop_filter(spec, info, args.focus)
            target = out.with_name(out.stem.replace("-master", "") + f"-{tag}.mp4")
            run(["ffmpeg", "-v", "error", "-y", "-i", str(out), "-vf", vf, "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "18",
                 "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(target)], args.dry_run)
            made.append(target)
    except (OSError, RuntimeError, ValueError, subprocess.CalledProcessError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    if not args.dry_run:
        for path in made:
            i = probe(path)
            print(f"→ {path}  {i['width']}×{i['height']} · {float(i['fps']):g} fps · {i['duration']:.2f} s · {path.stat().st_size / 1e6:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
