#!/usr/bin/env python3
"""Tools that keep repurposed content honest to its source video.

    python3 transcript_tools.py parse talk.srt
        SRT, VTT or plain lines like "[00:01:23] text" -> JSON segments.

    python3 transcript_tools.py verify talk.srt posts.md email.md article.md
        Every quotation in the drafts must exist in the transcript. Reports
        each quote as exact, close (wording drifted) or missing (invented).
        Also lists numbers in the drafts that the transcript never mentions.

    python3 transcript_tools.py clips talk.srt clips.json
        clips.json: [{"start": "00:01:10", "end": "00:01:42", "title": "..."}]
        Checks each clip is 20-45 seconds, inside the video, and prints the
        words actually spoken in that window.
"""
import difflib
import json
import re
import sys

STAMP = r"(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?"
CUE = re.compile(STAMP + r"\s*-->\s*" + STAMP)
LINE = re.compile(r"^\s*\[?" + STAMP + r"\]?\s*[-–—:]?\s*(.+)$")
QUOTE = re.compile(r"«([^»]{12,})»|“([^”]{12,})”|\"([^\"\n]{12,})\"")
NUMBER = re.compile(r"(?<![\w.])\d[\d  .,]*\d|\d")


def seconds(h, m, s, ms=None):
    return int(h or 0) * 3600 + int(m) * 60 + int(s) + (int((ms or "0").ljust(3, "0")[:3]) / 1000.0)


def stamp(value):
    value = int(value)
    return "%02d:%02d:%02d" % (value // 3600, value % 3600 // 60, value % 60)


def to_seconds(text):
    match = re.match(r"^\s*" + STAMP + r"\s*$", str(text))
    if not match:
        raise SystemExit("Не понял таймкод: %r" % text)
    return seconds(*match.groups())


def parse(path):
    raw = open(path, encoding="utf-8-sig").read().replace("\r\n", "\n")
    segments = []
    if "-->" in raw:
        for block in re.split(r"\n\s*\n", raw):
            lines = [line for line in block.strip().splitlines() if line.strip()]
            for index, line in enumerate(lines):
                cue = CUE.search(line)
                if cue:
                    groups = cue.groups()
                    text = " ".join(lines[index + 1:])
                    text = re.sub(r"<[^>]+>", "", text).strip()
                    if text:
                        segments.append({"start": seconds(*groups[:4]), "end": seconds(*groups[4:]), "text": text})
                    break
    else:
        for line in raw.splitlines():
            match = LINE.match(line)
            if match:
                segments.append({"start": seconds(*match.groups()[:4]), "end": None, "text": match.group(5).strip()})
            elif line.strip() and segments:
                segments[-1]["text"] += " " + line.strip()
            elif line.strip():
                segments.append({"start": 0.0, "end": None, "text": line.strip()})
        for current, following in zip(segments, segments[1:]):
            current["end"] = following["start"]
        if segments and segments[-1]["end"] is None:
            segments[-1]["end"] = segments[-1]["start"] + max(2.0, len(segments[-1]["text"].split()) / 2.5)
    return segments


def normalise(text):
    text = text.lower().replace("ё", "е")
    text = re.sub(r"[^\w\s]", " ", text, flags=re.U)
    return re.sub(r"\s+", " ", text).strip()


def best_match(needle, haystack_words):
    """Closest window of the transcript to a quote, by word-level similarity."""
    target = needle.split()
    size = len(target)
    best, where = 0.0, 0
    step = max(1, size // 4)
    for start in range(0, max(1, len(haystack_words) - size + 1), step):
        ratio = difflib.SequenceMatcher(None, target, haystack_words[start:start + size]).ratio()
        if ratio > best:
            best, where = ratio, start
    for start in range(max(0, where - step), min(len(haystack_words), where + step + 1)):
        ratio = difflib.SequenceMatcher(None, target, haystack_words[start:start + size]).ratio()
        if ratio > best:
            best, where = ratio, start
    return best, " ".join(haystack_words[where:where + size])


def digits(text):
    found = set()
    for hit in NUMBER.findall(text):
        clean = re.sub(r"[\s  ]", "", hit).rstrip(".,")
        # Single digits are everywhere ("3 шага") and prove nothing either way.
        if len(clean) >= 2:
            found.add(clean.replace(",", "."))
    return found


def verify(transcript_path, draft_paths):
    segments = parse(transcript_path)
    source = normalise(" ".join(s["text"] for s in segments))
    source_words = source.split()
    source_numbers = digits(" ".join(s["text"] for s in segments))
    report = {"quotes": [], "numbers_not_in_transcript": [], "summary": {}}
    for path in draft_paths:
        text = open(path, encoding="utf-8").read()
        quotes = [next(g for g in match if g) for match in QUOTE.findall(text)]
        quotes += [line.lstrip("> ").strip() for line in text.splitlines() if line.startswith(">") and len(line) > 14]
        for quote in quotes:
            needle = normalise(quote)
            if len(needle.split()) < 4:
                continue
            if needle in source:
                status, ratio, nearest = "exact", 1.0, None
            else:
                ratio, nearest = best_match(needle, source_words)
                status = "close" if ratio >= 0.6 else "missing"
            entry = {"file": path, "quote": quote, "status": status, "similarity": round(ratio, 2)}
            if nearest and status != "exact":
                entry["nearest_in_transcript"] = nearest
            report["quotes"].append(entry)
        for number in sorted(digits(text) - source_numbers):
            report["numbers_not_in_transcript"].append({"file": path, "number": number})
    counts = {"exact": 0, "close": 0, "missing": 0}
    for entry in report["quotes"]:
        counts[entry["status"]] += 1
    report["summary"] = dict(counts, numbers_to_check=len(report["numbers_not_in_transcript"]))
    report["how_to_read"] = (
        "missing — цитаты нет в расшифровке, удалите или замените. close — формулировка изменена, "
        "верните дословную. numbers_not_in_transcript — число не встречается цифрами; "
        "проверьте вручную, возможно, в расшифровке оно записано словами."
    )
    return report, 1 if counts["missing"] else 0


def clips(transcript_path, clips_path):
    segments = parse(transcript_path)
    total = max((s["end"] or s["start"]) for s in segments) if segments else 0
    result = []
    failed = False
    for clip in json.load(open(clips_path, encoding="utf-8")):
        start, end = to_seconds(clip["start"]), to_seconds(clip["end"])
        length = end - start
        problems = []
        if length < 20:
            problems.append("короче 20 секунд")
        if length > 45:
            problems.append("длиннее 45 секунд")
        if start < 0 or end > total + 1:
            problems.append("выходит за пределы видео (%s)" % stamp(total))
        spoken = " ".join(s["text"] for s in segments if s["start"] < end and (s["end"] or s["start"]) > start)
        if not spoken:
            problems.append("в этом отрезке нет речи")
        failed = failed or bool(problems)
        result.append({
            "title": clip.get("title", ""), "start": stamp(start), "end": stamp(end),
            "seconds": round(length, 1), "words": len(spoken.split()), "problems": problems, "spoken": spoken,
        })
    return {"video_length": stamp(total), "clips": result}, 1 if failed else 0


def main():
    args = sys.argv[1:]
    if len(args) < 2 or args[0] not in ("parse", "verify", "clips"):
        print(__doc__)
        return 2
    code = 0
    if args[0] == "parse":
        segments = parse(args[1])
        words = sum(len(s["text"].split()) for s in segments)
        length = max((s["end"] or s["start"]) for s in segments) if segments else 0
        out = {
            "summary": {"segments": len(segments), "words": words, "length": stamp(length)},
            "segments": [{"start": stamp(s["start"]), "end": stamp(s["end"] or s["start"]), "text": s["text"]} for s in segments],
        }
    elif args[0] == "verify":
        if len(args) < 3:
            raise SystemExit("verify: укажите расшифровку и хотя бы один черновик")
        out, code = verify(args[1], args[2:])
    else:
        if len(args) != 3:
            raise SystemExit("clips: укажите расшифровку и clips.json")
        out, code = clips(args[1], args[2])
    print(json.dumps(out, ensure_ascii=False, indent=1))
    return code


if __name__ == "__main__":
    sys.exit(main())
