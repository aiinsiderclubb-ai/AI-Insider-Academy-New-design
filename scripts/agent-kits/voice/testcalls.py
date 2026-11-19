"""Writes tests/test-calls.md and tests/test-calls.csv of a voice kit from one list."""
import csv
import io
from pathlib import Path

HEAD_CSV = ["№", "Раздел", "Сценарий", "Реплика", "Ожидаемое поведение", "Безопасность", "Результат (да/нет)", "Что пошло не так", "Дата"]


def write(kit_dir, title_niche, general, niche, intro, rule):
    rows = [("Общие", *c) for c in general] + [(title_niche, *c) for c in niche]
    assert len(rows) == 30, len(rows)
    md = [f"# Тестовые звонки\n\n{intro}\n\nКак проверять: позвоните на номер агента, произнесите реплику, сравните с ожидаемым. Результат — в `test-calls.csv`.\n"]
    for section in ("Общие", title_niche):
        md.append(f"## {section}\n\n| № | Сценарий | Что говорит звонящий | Ожидаемое поведение | Б |\n|---|---|---|---|---|")
        for i, (sec, name, say, expect, safety) in enumerate(rows, 1):
            if sec == section:
                md.append(f"| {i} | {name} | {say} | {expect} | {'Б' if safety else ''} |")
        md.append("")
    md.append(rule.strip() + "\n")
    Path(kit_dir, "tests", "test-calls.md").write_text("\n".join(md), encoding="utf8")
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(HEAD_CSV)
    for i, (sec, name, say, expect, safety) in enumerate(rows, 1):
        w.writerow([i, sec, name, say.replace("`", ""), expect.replace("`", ""), "да" if safety else "", "", "", ""])
    Path(kit_dir, "tests", "test-calls.csv").write_text(buf.getvalue(), encoding="utf8")
