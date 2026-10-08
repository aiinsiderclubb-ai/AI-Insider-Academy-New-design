#!/usr/bin/env python3
"""Check a draft against a voice card.

    python3 voice_check.py --card voice-card.json --text draft.md

The card is the JSON this skill produces (see assets/voice-card.json).
The check is mechanical on purpose: it catches what a tired reviewer misses —
a banned word, a switch from "ты" to "вы", a sentence that runs for forty
words. Whether the text sounds like the author is still a human judgement.
"""
import argparse
import json
import re
import sys

CLICHES = [
    "в современном мире", "не секрет, что", "давайте разберёмся", "давайте разберемся", "как известно",
    "на сегодняшний день", "в данной статье", "стоит отметить", "важно понимать", "играет важную роль",
    "уникальн", "инновационн", "погрузимся", "раскроем секрет", "без воды", "в этом посте",
    "in today's world", "it's no secret", "let's dive in", "game-changer", "unlock", "delve",
    "in conclusion", "it is important to note", "cutting-edge", "seamless",
]
INFORMAL = re.compile(r"(?<![\w])(ты|тебя|тебе|тобой|твой|твоя|твоё|твое|твои|твоих|твоего|твоей)(?![\w])", re.I)
FORMAL = re.compile(r"(?<![\w])(вы|вас|вам|вами|ваш|ваша|ваше|ваши|ваших|вашего|вашей)(?![\w])", re.I)
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿\U0001F1E6-\U0001F1FF]")
SENTENCE = re.compile(r"[^.!?…\n]+[.!?…]*")
WORD = re.compile(r"[\w'’-]+", re.U)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--card", required=True)
    parser.add_argument("--text", required=True)
    args = parser.parse_args()

    card = json.load(open(args.card, encoding="utf-8"))
    text = open(args.text, encoding="utf-8").read()
    plain = re.sub(r"```.*?```", " ", text, flags=re.S)
    plain = re.sub(r"[#*_`>|]", " ", plain)
    lowered = plain.lower().replace("ё", "е")
    findings = []

    def add(level, rule, detail):
        findings.append({"level": level, "rule": rule, "detail": detail})

    for word in card.get("banned", []):
        stem = word.lower().replace("ё", "е").strip()
        if stem and stem in lowered:
            add("error", "banned", "Запрещённое в карточке слово или выражение: «%s» (%d раз)." % (word, lowered.count(stem)))

    for phrase in CLICHES + [c.lower() for c in card.get("extra_cliches", [])]:
        if phrase.replace("ё", "е") in lowered:
            add("warning", "cliche", "Штамп: «%s»." % phrase)

    address = (card.get("address") or "any").lower()
    informal, formal = len(INFORMAL.findall(plain)), len(FORMAL.findall(plain))
    if address == "ты" and formal:
        add("error", "address", "Карточка требует «ты», а в тексте %d обращений на «вы»." % formal)
    elif address == "вы" and informal:
        add("error", "address", "Карточка требует «вы», а в тексте %d обращений на «ты»." % informal)
    elif address == "any" and informal and formal:
        add("warning", "address", "Смешаны обращения: «ты» — %d, «вы» — %d." % (informal, formal))

    sentences = [s.strip() for s in SENTENCE.findall(plain) if len(WORD.findall(s)) >= 2]
    lengths = [len(WORD.findall(s)) for s in sentences]
    average = sum(lengths) / float(len(lengths)) if lengths else 0
    limit = card.get("max_sentence_words")
    if limit:
        for sentence, length in zip(sentences, lengths):
            if length > limit:
                add("warning", "long_sentence", "%d слов при пределе %d: «%s…»" % (length, limit, sentence[:70]))
    target = card.get("average_sentence_words")
    if target and average > target * 1.35:
        add("warning", "rhythm", "Средняя длина предложения %.0f слов, в образцах — около %d." % (average, target))

    exclamations = plain.count("!")
    allowed = card.get("exclamations_allowed", 0)
    if allowed is not True and exclamations > int(allowed or 0):
        add("warning", "exclamation", "Восклицательных знаков: %d, допустимо: %d." % (exclamations, int(allowed or 0)))

    emoji = len(EMOJI.findall(text))
    if not card.get("emoji_allowed", False) and emoji:
        add("error", "emoji", "Эмодзи: %d. В карточке они запрещены." % emoji)

    caps = [w for w in WORD.findall(plain) if len(w) > 3 and w.isupper() and not w.isdigit()]
    caps = [w for w in caps if w not in set(card.get("allowed_caps", []))]
    if len(caps) > 2:
        add("warning", "caps", "Слова заглавными буквами: %s." % ", ".join(sorted(set(caps))[:8]))

    signature = [p for p in card.get("signature_phrases", []) if p.lower().replace("ё", "е") in lowered]
    errors = sum(1 for f in findings if f["level"] == "error")
    print(json.dumps({
        "summary": {
            "words": len(WORD.findall(plain)), "sentences": len(sentences),
            "average_sentence_words": round(average, 1), "longest_sentence_words": max(lengths) if lengths else 0,
            "exclamations": exclamations, "emoji": emoji,
            "address": {"ты": informal, "вы": formal},
            "signature_phrases_used": signature,
            "errors": errors, "warnings": len(findings) - errors,
        },
        "findings": findings,
    }, ensure_ascii=False, indent=1))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
