#!/usr/bin/env python3
"""Turn subtitles into a word-timed caption timeline for the Captions composition.

Reads SRT, WebVTT, or word-level JSON (a list of {"word"/"text", "start", "end"},
or Whisper-style {"segments": [{"words": [...]}]}). Writes JSON:

    {"fps": 30, "pages": [{"start": 0.0, "end": 1.4,
                           "words": [{"text": "Привет", "start": 0.0, "end": 0.4}, ...]}]}

A page is what is on screen at once. Pages break on a pause, at the end of a
sentence, or when a page would hold too many words or characters.

When the source has no word times (SRT/VTT), each cue's time is shared
between its words by length, with a little extra after punctuation. That is an
estimate; the report says so, and word-level JSON from a transcriber is better.

Examples:
    python3 srt_to_timeline.py voice.srt --out public/data/captions.json
    python3 srt_to_timeline.py words.json --max-words 3 --max-chars 18
    python3 srt_to_timeline.py voice.srt --report
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

TIME = re.compile(r"(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})")
SENTENCE_END = re.compile(r"[.!?…]+[»\")]*$")
PAUSE_AFTER = re.compile(r"[,;:—–-]$")


def parse_time(text: str) -> float:
    match = TIME.search(text)
    if not match:
        raise ValueError(f"not a timestamp: {text!r}")
    hours, minutes, seconds, millis = match.groups()
    millis = (millis + "00")[:3]
    return int(hours or 0) * 3600 + int(minutes) * 60 + int(seconds) + int(millis) / 1000


def parse_cues(text: str) -> list[dict]:
    """SRT and VTT both come down to blocks with a 'start --> end' line."""
    cues = []
    blocks = re.split(r"\n\s*\n", text.replace("\r\n", "\n").replace("﻿", "").strip())
    for block in blocks:
        lines = [line for line in block.split("\n") if line.strip()]
        timing = next((i for i, line in enumerate(lines) if "-->" in line), None)
        if timing is None:
            continue
        left, right = lines[timing].split("-->", 1)
        body = " ".join(lines[timing + 1 :])
        body = re.sub(r"<[^>]+>", "", body)  # VTT/HTML styling tags
        body = re.sub(r"\{[^}]+\}", "", body)  # ASS-style overrides
        body = re.sub(r"\s+", " ", body).strip()
        if body:
            cues.append({"start": parse_time(left), "end": parse_time(right.split()[0]), "text": body})
    return cues


def words_from_cues(cues: list[dict]) -> list[dict]:
    words = []
    for cue in cues:
        tokens = cue["text"].split()
        # Weight = letters, plus a beat after punctuation where a speaker pauses.
        weights = [max(1, len(re.sub(r"\W", "", t))) + (3 if SENTENCE_END.search(t) or PAUSE_AFTER.search(t) else 0) for t in tokens]
        total = sum(weights) or 1
        span = max(0.0, cue["end"] - cue["start"])
        cursor = cue["start"]
        for token, weight in zip(tokens, weights):
            length = span * weight / total
            words.append({"text": token, "start": cursor, "end": cursor + length})
            cursor += length
    return words


def words_from_json(data) -> list[dict]:
    if isinstance(data, dict) and "segments" in data:
        items = [w for seg in data["segments"] for w in seg.get("words", [])]
    elif isinstance(data, dict) and "words" in data:
        items = data["words"]
    elif isinstance(data, list):
        items = data
    else:
        raise ValueError("JSON must be a list of words, {'words': [...]}, or {'segments': [{'words': [...]}]}")
    words = []
    for item in items:
        text = str(item.get("word", item.get("text", ""))).strip()
        if not text:
            continue
        words.append({"text": text, "start": float(item["start"]), "end": float(item["end"])})
    return words


def paginate(words: list[dict], max_words: int, max_chars: int, pause: float, hold: float) -> list[dict]:
    pages: list[dict] = []
    current: list[dict] = []

    def flush():
        if current:
            pages.append({"start": current[0]["start"], "end": current[-1]["end"] + hold, "words": list(current)})
            current.clear()

    for i, word in enumerate(words):
        if current:
            chars = sum(len(w["text"]) for w in current) + len(current) + len(word["text"])
            gap = word["start"] - current[-1]["end"]
            if len(current) >= max_words or chars > max_chars or gap > pause:
                flush()
        current.append(word)
        if SENTENCE_END.search(word["text"]) and len(current) >= 2:
            flush()
    flush()

    # A page stays up until the next one starts, but never longer than `hold` past its last word.
    for page, nxt in zip(pages, pages[1:]):
        page["end"] = min(page["end"], nxt["start"])
    return pages


def clean(words: list[dict], min_word: float) -> list[dict]:
    words = sorted(words, key=lambda w: w["start"])
    for i, word in enumerate(words):
        if word["end"] - word["start"] < min_word:
            word["end"] = word["start"] + min_word
        if i + 1 < len(words) and word["end"] > words[i + 1]["start"]:
            word["end"] = max(word["start"] + 0.01, words[i + 1]["start"])
    return words


def report(pages: list[dict], estimated: bool) -> dict:
    warnings = []
    for n, page in enumerate(pages, 1):
        text = " ".join(w["text"] for w in page["words"])
        duration = page["end"] - page["start"]
        cps = len(text) / duration if duration > 0 else 999
        if cps > 20:
            warnings.append(f"page {n}: {cps:.0f} characters per second — too fast to read; split the line or slow the voice: {text!r}")
        if duration < 0.5:
            warnings.append(f"page {n}: on screen for {duration:.2f} s — shorter than half a second: {text!r}")
    return {
        "pages": len(pages),
        "words": sum(len(p["words"]) for p in pages),
        "duration": round(pages[-1]["end"], 3) if pages else 0,
        "word_times": "estimated from cue length" if estimated else "from source",
        "warnings": warnings,
    }


def build(source: Path, args) -> tuple[dict, dict]:
    text = source.read_text(encoding="utf-8-sig")
    estimated = source.suffix.lower() != ".json"
    words = words_from_json(json.loads(text)) if not estimated else words_from_cues(parse_cues(text))
    if not words:
        raise ValueError(f"no words found in {source}")
    for word in words:
        word["start"] += args.offset
        word["end"] += args.offset
    words = clean(words, args.min_word)
    pages = paginate(words, args.max_words, args.max_chars, args.pause, args.hold)
    rounded = [
        {
            "start": round(p["start"], 3),
            "end": round(p["end"], 3),
            "words": [{"text": w["text"], "start": round(w["start"], 3), "end": round(w["end"], 3)} for w in p["words"]],
        }
        for p in pages
    ]
    return {"fps": args.fps, "pages": rounded}, report(pages, estimated)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="SRT / VTT / word JSON → caption timeline JSON for the Captions composition.")
    parser.add_argument("source", type=Path, help=".srt, .vtt or .json with word times")
    parser.add_argument("--out", type=Path, help="write the timeline here (default: print it)")
    parser.add_argument("--max-words", type=int, default=4, help="words per page (default 4; 2–3 for big, punchy captions)")
    parser.add_argument("--max-chars", type=int, default=24, help="characters per page (default 24)")
    parser.add_argument("--pause", type=float, default=0.35, help="a silence longer than this starts a new page, seconds")
    parser.add_argument("--hold", type=float, default=0.3, help="how long a page stays after its last word, seconds")
    parser.add_argument("--min-word", type=float, default=0.08, help="shortest time a word can be lit, seconds")
    parser.add_argument("--offset", type=float, default=0.0, help="shift all times, seconds (e.g. when the video starts with an intro)")
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--report", action="store_true", help="print a summary and warnings instead of the timeline")
    args = parser.parse_args(argv)

    try:
        timeline, summary = build(args.source, args)
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(timeline, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    if args.report or args.out:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
    else:
        print(json.dumps(timeline, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
