#!/usr/bin/env python3
"""Estimate how long a short-video script takes to say, section by section.

The script file uses headings for sections; anything in [square brackets]
or (round brackets) is a stage direction and is not counted as speech.

    ## Хук
    Ты теряешь клиентов первым же сообщением.
    ## Ход
    [показать экран] Вот типичный автоответ...
    ## Призыв
    Сохрани и проверь свои автоответы.

    python3 timing.py script.md --target 30
    python3 timing.py script.md --target 30 --wps 2.6

--wps is words per second. 2.4 is a brisk Russian or English delivery for
short video; use 2.0 for a calm voice and 2.8 for fast cuts.
"""
import argparse
import json
import re
import sys

HOOK = re.compile(r"хук|hook", re.I)
DIRECTION = re.compile(r"\[[^\]]*\]|\([^)]*\)")
WORD = re.compile(r"[\w'’-]+", re.U)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("file")
    parser.add_argument("--target", type=float, default=30, help="целевая длина ролика в секундах")
    parser.add_argument("--wps", type=float, default=2.4, help="слов в секунду")
    args = parser.parse_args()

    text = sys.stdin.read() if args.file == "-" else open(args.file, encoding="utf-8").read()
    sections, current = [], {"name": "Без раздела", "lines": []}
    for line in text.splitlines():
        heading = re.match(r"^\s{0,3}#{1,6}\s+(.+?)\s*$", line) or re.match(r"^\s*\*\*(.+?):?\*\*\s*$", line)
        if heading:
            if current["lines"]:
                sections.append(current)
            current = {"name": heading.group(1).strip(": "), "lines": []}
        else:
            current["lines"].append(line)
    if current["lines"]:
        sections.append(current)

    rows, total_words, problems = [], 0, []
    for section in sections:
        spoken = DIRECTION.sub(" ", "\n".join(section["lines"]))
        spoken = re.sub(r"[*_`>#]", " ", spoken)
        count = len(WORD.findall(spoken))
        if not count:
            continue
        total_words += count
        duration = count / args.wps
        rows.append({"section": section["name"], "words": count, "seconds": round(duration, 1)})
        if HOOK.search(section["name"]) and duration > 3.5:
            problems.append(
                "Хук длится %.1f с (%d слов). Зритель решает за 3 секунды: сократите до %d слов."
                % (duration, count, int(args.wps * 3))
            )

    total = total_words / args.wps
    if not any(HOOK.search(row["section"]) for row in rows):
        problems.append("Нет раздела «Хук»: первая фраза не выделена и не проверена.")
    if total > args.target * 1.15:
        problems.append(
            "Сценарий на %.0f с при цели %.0f с. Уберите около %d слов."
            % (total, args.target, int((total - args.target) * args.wps))
        )
    elif total < args.target * 0.7:
        problems.append("Сценарий на %.0f с при цели %.0f с: ролик выйдет заметно короче." % (total, args.target))

    print(json.dumps({
        "words": total_words,
        "seconds": round(total, 1),
        "target": args.target,
        "words_per_second": args.wps,
        "sections": rows,
        "problems": problems,
    }, ensure_ascii=False, indent=1))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
