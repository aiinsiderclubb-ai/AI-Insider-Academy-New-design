#!/usr/bin/env python3
"""Check outreach messages against the rules that decide whether they get read.

Input: a JSON file
    {"messages": [{"id": "acme-1", "lead": "Acme", "channel": "email",
                   "step": 1, "subject": "...", "body": "..."}]}
channel is one of: email, linkedin_note, linkedin, dm.

Output: JSON with one finding per broken rule. Exit code 1 when any finding
is an error, so a message that still has a placeholder in it cannot slip out.

    python3 lint_outreach.py messages.json
"""
import json
import re
import sys

SPAM = [
    "бесплатно", "гаранти", "срочно", "только сегодня", "скидк", "100%", "уникальн",
    "лучшее предложение", "без вложений", "заработ", "кликните", "нажмите здесь",
    "free", "guarantee", "act now", "limited time", "click here", "risk-free", "best price",
]
SELF_INTRO = re.compile(r"^\s*(меня зовут|я\s+—|я\s+-|my name is|i am |i'm )", re.I)
PLACEHOLDER = re.compile(r"\[[^\]\n]{1,60}\]|\{\{[^}\n]{1,60}\}\}")
LINK = re.compile(r"https?://|www\.", re.I)
WORD = re.compile(r"[\w'’-]+", re.U)


def words(text):
    return len(WORD.findall(text))


def first_line(text):
    for line in text.strip().splitlines():
        line = line.strip()
        # A greeting is not the first line that matters.
        if line and not re.match(r"^[\w\s]{0,25}[,!]?\s*(добрый день|здравствуйте|привет|hi|hello)?[.,!]?$", line, re.I):
            return line
    return ""


def check(message):
    found = []

    def add(level, rule, detail):
        found.append({"id": message.get("id", "?"), "level": level, "rule": rule, "detail": detail})

    channel = message.get("channel", "email")
    step = int(message.get("step", 1) or 1)
    body = message.get("body", "") or ""
    subject = message.get("subject", "") or ""
    count = words(body)

    if not body.strip():
        add("error", "empty", "Пустое сообщение.")
        return found

    for hit in PLACEHOLDER.findall(subject + "\n" + body):
        add("error", "placeholder", "Осталась незаполненная подстановка: %s" % hit)

    if channel == "email":
        if count > 120:
            add("error", "length", "%d слов. Холодное письмо длиннее 120 слов не дочитывают; цель — до 90." % count)
        elif count > 90:
            add("warning", "length", "%d слов. Цель — до 90." % count)
        if not subject.strip():
            add("error", "subject", "Нет темы письма.")
        elif len(subject) > 45:
            add("warning", "subject", "Тема %d знаков. В списке писем видно около 45." % len(subject))
        if subject and subject.upper() == subject and re.search(r"[A-Za-zА-Яа-я]{4,}", subject):
            add("warning", "subject", "Тема целиком заглавными буквами.")
        if step == 1 and LINK.search(body):
            add("error", "link", "Ссылка в первом письме: такие чаще уходят в спам.")
    elif channel == "linkedin_note":
        if len(body) > 300:
            add("error", "length", "%d знаков. Заявка в контакты LinkedIn вмещает 300." % len(body))
    elif channel in ("dm", "linkedin"):
        if step == 1 and (len(body) > 350 or body.strip().count("\n") > 3):
            add("warning", "length", "Первое сообщение в мессенджере длиннее трёх строк.")
        if step == 1 and LINK.search(body):
            add("warning", "link", "Ссылка в первом сообщении незнакомому человеку.")

    questions = body.count("?")
    if questions > 1:
        add("warning", "questions", "%d вопроса. Одно сообщение — один вопрос." % questions)
    if questions == 0 and channel != "linkedin_note":
        add("warning", "questions", "Нет вопроса: получателю не на что ответить.")

    if body.count("!") > 1:
        add("warning", "tone", "Восклицательных знаков: %d." % body.count("!"))

    lowered = (subject + " " + body).lower()
    for term in SPAM:
        if term in lowered:
            add("warning", "spam_word", "Слово-триггер спам-фильтров: «%s»." % term)

    if step == 1 and SELF_INTRO.match(first_line(body) or body):
        add("warning", "first_line", "Первая строка — о себе. Начните с факта о получателе.")

    return found


def main():
    if len(sys.argv) != 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        return 2
    with open(sys.argv[1], encoding="utf-8") as handle:
        data = json.load(handle)
    messages = data["messages"] if isinstance(data, dict) else data

    findings = []
    openers = {}
    for message in messages:
        findings.extend(check(message))
        if int(message.get("step", 1) or 1) == 1:
            opener = first_line(message.get("body", "")).lower()
            if opener:
                openers.setdefault(opener, []).append(message.get("id", "?"))

    for opener, ids in openers.items():
        leads = {m.get("lead") for m in messages if m.get("id") in ids}
        if len(ids) > 1 and len(leads) > 1:
            findings.append({
                "id": ", ".join(ids), "level": "warning", "rule": "not_personal",
                "detail": "Одинаковая первая строка у разных получателей: «%s»." % opener[:80],
            })

    errors = sum(1 for f in findings if f["level"] == "error")
    report = {
        "summary": {"messages": len(messages), "errors": errors, "warnings": len(findings) - errors},
        "findings": findings,
    }
    print(json.dumps(report, ensure_ascii=False, indent=1))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
