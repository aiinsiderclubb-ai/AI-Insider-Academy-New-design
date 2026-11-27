#!/usr/bin/env python3
"""Check a storyboard against the craft rules and print it as a shot table.

Part of Claude Cinematic Studio (cinematic-director). The storyboard is the
contract between the idea and the build: every shot says what the viewer must
feel, how the camera moves, which layers sit at which depth, what the type
does and how the shot hands over to the next one. This script catches the
mistakes that make a film look cheap before a single frame is rendered.

Python 3 standard library only.

Storyboard JSON (full description in references/storyboard-format.md):

    {
      "title": "AURA — launch",
      "look": "keynote",                  # keynote | chrome | kinetic | neon | editorial
      "format": "16:9",                   # 16:9 | 9:16 | 1:1
      "fps": 30,
      "music": "public/audio/track.mp3",  # or null
      "shots": [
        {
          "id": "S1",
          "start": 0, "end": 2.4,         # seconds
          "intent": "what the viewer must feel or learn",
          "breath": false,                # optional: a deliberate slow, quiet shot
          "camera": {"move": "dolly", "lens_mm": 35, "from": [..], "to": [..]},
          "layers": [{"kind": "3d-type", "what": "title, mid-ground"},
                     {"kind": "particles", "what": "dust, foreground"}],
          "type": [{"text": "Представляем", "reveal": "riseFromDepth",
                    "exit": "intoDepth", "at": 0.3, "until": 2.2}],
          "vfx": ["bloom", "dof"],
          "transition_out": {"kind": "whip", "on": "downbeat"},
          "hits": [{"t": 1.2, "what": "title lands", "sfx": "impact"}],
          "sound": "low drone, whoosh into the cut"
        }
      ]
    }

Enumerations:
    camera.move       dolly orbit crane dollyZoom locked handheld whip push pull
    layers[].kind     3d-type object footage cutout particles trail hud grade
                      background light
    type[].reveal     riseFromDepth flip flyIn swing burst none
    type[].exit       intoDepth pastCamera fall none cut
    vfx[]             bloom dof aberration trails particles glow lightleak flash
                      grain halation streaks distortion
    transition_out    cut whip zoom flash fade match in-camera
    transition_out.on beat downbeat free

Checks:
    errors (exit code 1)  missing fields, unknown values, shots out of order,
                          gaps or overlaps, a shot shorter than 0.4 s, hits
                          outside their shot, type on screen for less than
                          60 % of its reading time
    warnings              type on screen shorter than its reading time
                          (about 3 words per second in Russian + 0.4 s),
                          a static hold (locked camera, nothing animating)
                          longer than 2.5 s, fewer than two depth layers,
                          one transition used for more than 60 % of the
                          non-cut transitions, more than two whips in a row,
                          no breath shot in a film longer than 12 s, long
                          lines in a vertical film, every cut on the same
                          beat spacing (metronome editing)

Examples:
    python3 storyboard.py storyboard.json
    python3 storyboard.py storyboard.json --md storyboard.md
    python3 storyboard.py storyboard.json --json   # machine-readable result
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

MOVES = {"dolly", "orbit", "crane", "dollyZoom", "locked", "handheld", "whip", "push", "pull"}
LAYERS = {"3d-type", "object", "footage", "cutout", "particles", "trail", "hud", "grade", "background", "light"}
REVEALS = {"riseFromDepth", "flip", "flyIn", "swing", "burst", "none"}
EXITS = {"intoDepth", "pastCamera", "fall", "none", "cut"}
VFX = {"bloom", "dof", "aberration", "trails", "particles", "glow", "lightleak", "flash", "grain", "halation", "streaks", "distortion"}
TRANSITIONS = {"cut", "whip", "zoom", "flash", "fade", "match", "in-camera"}
ON = {"beat", "downbeat", "free"}
LOOKS = {"keynote", "chrome", "kinetic", "neon", "editorial"}
FORMATS = {"16:9", "9:16", "1:1"}

MIN_SHOT = 0.4
STATIC_HOLD = 2.5
WORDS_PER_SECOND = 3.0
READ_PAD = 0.4

RU = {
    "move": {"dolly": "наезд/отъезд", "orbit": "облёт", "crane": "кран", "dollyZoom": "долли-зум", "locked": "статика",
             "handheld": "с рук", "whip": "вип-пэн", "push": "наезд", "pull": "отъезд"},
    "transition": {"cut": "склейка", "whip": "вип-пэн", "zoom": "зум-сквозь", "flash": "вспышка", "fade": "затемнение",
                   "match": "матч-кат", "in-camera": "в камере"},
}


def reading_time(text: str) -> float:
    words = [w for w in text.replace("\n", " ").split() if any(c.isalnum() for c in w)]
    return len(words) / WORDS_PER_SECOND + READ_PAD


def check(board: dict) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    fps = board.get("fps") or 30
    frame = 1 / fps

    for key in ("title", "look", "format", "shots"):
        if key not in board:
            errors.append(f"нет поля «{key}»")
    if board.get("look") and board["look"] not in LOOKS:
        warnings.append(f"стиль «{board['look']}» не из проекта ({', '.join(sorted(LOOKS))}) — его придётся описать в src/lib/looks.ts")
    if board.get("format") and board["format"] not in FORMATS:
        errors.append(f"формат «{board['format']}»: нужен один из {', '.join(sorted(FORMATS))}")
    shots = board.get("shots") or []
    if not shots:
        errors.append("нет ни одного шота")
        return errors, warnings

    previous_end = None
    whip_run = 0
    transitions: list[str] = []
    for i, shot in enumerate(shots):
        sid = shot.get("id") or f"#{i + 1}"
        start, end = shot.get("start"), shot.get("end")
        if not isinstance(start, (int, float)) or not isinstance(end, (int, float)):
            errors.append(f"{sid}: нужны числа start и end (секунды)")
            continue
        length = end - start
        if length <= 0:
            errors.append(f"{sid}: end ({end}) не позже start ({start})")
            continue
        if length < MIN_SHOT - 1e-6:
            errors.append(f"{sid}: шот {length:.2f} с — короче {MIN_SHOT} с глаз не успевает его прочитать")
        if previous_end is not None:
            gap = start - previous_end
            if gap > frame / 2:
                errors.append(f"{sid}: дыра {gap:.2f} с после предыдущего шота")
            elif gap < -frame / 2:
                errors.append(f"{sid}: наезжает на предыдущий шот на {-gap:.2f} с")
        elif start > frame / 2:
            warnings.append(f"{sid}: фильм начинается не с нуля, а с {start} с")
        previous_end = end

        if not str(shot.get("intent", "")).strip():
            errors.append(f"{sid}: нет «intent» — что зритель должен почувствовать или узнать в этом шоте")

        camera = shot.get("camera") or {}
        move = camera.get("move")
        if not move:
            errors.append(f"{sid}: нет camera.move — у каждого шота есть решение по камере, даже если это статика")
        elif move not in MOVES:
            errors.append(f"{sid}: camera.move «{move}» неизвестен ({', '.join(sorted(MOVES))})")
        lens = camera.get("lens_mm")
        if lens is not None and not (12 <= lens <= 200):
            warnings.append(f"{sid}: объектив {lens} мм — проверь, обычный диапазон 18–135 мм")

        layers = shot.get("layers") or []
        for layer in layers:
            if layer.get("kind") not in LAYERS:
                errors.append(f"{sid}: слой «{layer.get('kind')}» неизвестен ({', '.join(sorted(LAYERS))})")
        if len(layers) < 2:
            warnings.append(f"{sid}: слоёв {len(layers)} — нужен передний и задний план, иначе кадр плоский")

        for item in shot.get("type") or []:
            text = str(item.get("text", ""))
            if item.get("reveal") and item["reveal"] not in REVEALS:
                errors.append(f"{sid}: reveal «{item['reveal']}» неизвестен ({', '.join(sorted(REVEALS))})")
            if item.get("exit") and item["exit"] not in EXITS:
                errors.append(f"{sid}: exit «{item['exit']}» неизвестен ({', '.join(sorted(EXITS))})")
            shown_from = item.get("at", start)
            shown_to = item.get("until", end)
            on_screen = shown_to - shown_from
            need = reading_time(text)
            if on_screen < need * 0.6:
                errors.append(f"{sid}: «{text[:40]}» на экране {on_screen:.2f} с, а читается {need:.2f} с — не прочитают")
            elif on_screen < need:
                warnings.append(f"{sid}: «{text[:40]}» на экране {on_screen:.2f} с, на чтение нужно {need:.2f} с")
            if board.get("format") == "9:16":
                longest = max((len(line) for line in text.split("\n")), default=0)
                if longest > 16:
                    warnings.append(f"{sid}: строка «{text[:40]}» — {longest} символов; в вертикали больше ~16 крупным кеглем не влезет в безопасную зону, разбей на строки")
            if shown_from < start - frame or shown_to > end + frame:
                warnings.append(f"{sid}: «{text[:40]}» выходит за пределы шота — так бывает при переносе через склейку, но проверь")

        for v in shot.get("vfx") or []:
            if v not in VFX:
                errors.append(f"{sid}: эффект «{v}» неизвестен ({', '.join(sorted(VFX))})")

        for hit in shot.get("hits") or []:
            t = hit.get("t")
            if not isinstance(t, (int, float)):
                errors.append(f"{sid}: удар без времени t")
            elif not (start - frame / 2 <= t <= end + frame / 2):
                errors.append(f"{sid}: удар «{hit.get('what', '')}» в {t} с — вне шота ({start}–{end})")

        animated = bool(shot.get("type") or shot.get("hits") or set(shot.get("vfx") or []) & {"particles", "trails", "streaks"})
        if move == "locked" and not animated and length > STATIC_HOLD:
            warnings.append(f"{sid}: статика {length:.1f} с и ничего не движется — зритель уйдёт; дай дрейф камеры или движение в кадре")

        out = shot.get("transition_out")
        if out:
            kind = out.get("kind")
            if kind not in TRANSITIONS:
                errors.append(f"{sid}: переход «{kind}» неизвестен ({', '.join(sorted(TRANSITIONS))})")
            if out.get("on") and out["on"] not in ON:
                errors.append(f"{sid}: transition_out.on «{out['on']}» — нужно beat, downbeat или free")
            if i < len(shots) - 1:
                transitions.append(kind)
            whip_run = whip_run + 1 if kind == "whip" else 0
            if whip_run == 3:
                warnings.append(f"{sid}: третий вип-пэн подряд — приём превращается в тик, смени переход")
        elif i < len(shots) - 1:
            warnings.append(f"{sid}: нет transition_out — по умолчанию будет склейка")
            transitions.append("cut")

    non_cut = [t for t in transitions if t and t != "cut"]
    if len(non_cut) >= 3:
        top = max(set(non_cut), key=non_cut.count)
        if non_cut.count(top) / len(non_cut) > 0.6:
            warnings.append(f"переход «{RU['transition'].get(top, top)}» — {non_cut.count(top)} из {len(non_cut)} нешовных переходов; один приём на весь ролик выглядит шаблоном")

    total = shots[-1].get("end", 0) - shots[0].get("start", 0)
    if total > 12:
        breath = [s for s in shots if s.get("breath") or (
            (s.get("end", 0) - s.get("start", 0)) >= 1.5
            and (s.get("camera") or {}).get("move") in {"locked", "dolly", "orbit", "crane", "push", "pull"}
            and not s.get("hits"))]
        if not breath:
            warnings.append("ролик длиннее 12 с без «вдоха» — нужен хотя бы один медленный шот без ударов, иначе ритм не читается")

    lengths = [round(s["end"] - s["start"], 2) for s in shots if isinstance(s.get("start"), (int, float)) and isinstance(s.get("end"), (int, float))]
    if len(lengths) >= 4 and len(set(lengths)) == 1:
        warnings.append("все шоты одной длины — монтаж-метроном; меняй длину: длинный вдох, серия коротких, удар")

    return errors, warnings


def table(board: dict) -> str:
    rows = [
        f"# {board.get('title', 'Раскадровка')}",
        "",
        f"Стиль: **{board.get('look', '—')}** · формат {board.get('format', '—')} · {board.get('fps', 30)} fps"
        + (f" · музыка: `{board['music']}`" if board.get("music") else ""),
        "",
        "| Шот | Время | Длит. | Задача | Камера | Слои | Текст | VFX | Переход |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for s in board.get("shots", []):
        cam = s.get("camera") or {}
        move = RU["move"].get(cam.get("move"), cam.get("move", "—"))
        if cam.get("lens_mm"):
            move += f", {cam['lens_mm']} мм"
        layers = ", ".join(l.get("kind", "?") for l in s.get("layers") or []) or "—"
        type_ = " / ".join(f"«{t.get('text', '')}» ({t.get('reveal', '—')})" for t in s.get("type") or []) or "—"
        vfx = ", ".join(s.get("vfx") or []) or "—"
        out = s.get("transition_out") or {}
        tr = RU["transition"].get(out.get("kind"), out.get("kind") or "—")
        if out.get("on") and out.get("on") != "free":
            tr += f" на {'сильную долю' if out['on'] == 'downbeat' else 'долю'}"
        start, end = s.get("start", 0), s.get("end", 0)
        intent = str(s.get("intent", "")).replace("|", "/")
        rows.append(f"| {s.get('id', '')} | {start:.2f}–{end:.2f} | {end - start:.2f} | {intent} | {move} | {layers} | {type_.replace('|', '/')} | {vfx} | {tr} |")
        for h in s.get("hits") or []:
            rows.append(f"| | ↳ {h.get('t', 0):.2f} | | удар: {h.get('what', '')} | | | | | звук: {h.get('sfx', '—')} |")
    return "\n".join(rows)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Validate a storyboard JSON and print it as a shot table.")
    parser.add_argument("storyboard", type=Path)
    parser.add_argument("--md", type=Path, help="also write the shot table and findings to this Markdown file")
    parser.add_argument("--json", action="store_true", help="print errors and warnings as JSON")
    args = parser.parse_args(argv)
    try:
        board = json.loads(args.storyboard.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    errors, warnings = check(board)
    shots = board.get("shots") or []
    total = (shots[-1].get("end", 0) - shots[0].get("start", 0)) if shots else 0

    if args.json:
        print(json.dumps({"ok": not errors, "errors": errors, "warnings": warnings, "shots": len(shots), "duration": total}, ensure_ascii=False, indent=1))
        return 1 if errors else 0

    report = table(board)
    findings = ["", "## Проверка", ""]
    findings += [f"- ✗ {e}" for e in errors] + [f"- ⚠ {w}" for w in warnings]
    if not errors and not warnings:
        findings.append("- ✓ замечаний нет")
    text = report + "\n" + "\n".join(findings) + "\n"
    if args.md:
        args.md.parent.mkdir(parents=True, exist_ok=True)
        args.md.write_text(text, encoding="utf-8")
    print(text)
    print(f"{len(shots)} шотов, {total:.2f} с · ошибок: {len(errors)} · предупреждений: {len(warnings)}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
