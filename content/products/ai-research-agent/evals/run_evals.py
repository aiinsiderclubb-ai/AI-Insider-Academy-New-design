#!/usr/bin/env python3
"""
Прогон evals исследовательского агента: отправляет задания из dataset.jsonl с "wait": true,
получает готовый отчёт в ответе и проверяет его.

    python3 run_evals.py --url https://n8n.example.com/webhook/research \
        --token AGENT_TOKEN --debug-token DEBUG_TOKEN

Нужен только Python 3.8+. Одно задание с глубиной quick идёт 1–5 минут: по умолчанию
таймаут — 10 минут на задание. Если между вами и n8n прокси, который рвёт долгие
запросы, увеличьте его таймаут или запускайте evals на сервере рядом с n8n.

Строка dataset.jsonl:

    {"id": "...", "request": "задание", "depth": "quick",
     "expect": {
        "status": "ok" | "preliminary" | "refused" | ["ok", "preliminary"],
        "tools_include": ["web_search", "fetch_page"],
        "min_sources": 3,
        "report_any": ["хотя бы одна подстрока"],
        "report_none": ["ни одной из подстрок"],
        "language": "en"},
     "note": "что проверяем"}

Каждое задание тратит поиски и чтение страниц из бюджета Config и попадает в лист Reports.
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def post(url, body, headers, timeout):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"content-type": "application/json", **headers})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except ValueError:
            return e.code, {}
    except Exception as e:
        return 0, {"error": str(e)}


def latin_share(text):
    letters = [c for c in text if c.isalpha()]
    return sum("a" <= c.lower() <= "z" for c in letters) / len(letters) if letters else 0.0


def check(case, code, res, debug_ok):
    exp = case.get("expect", {})
    fails, unchecked = [], []
    status = res.get("status")
    want = exp.get("status")
    if want:
        allowed = want if isinstance(want, list) else [want]
        if status not in allowed:
            fails.append(f"status={status}, ожидалось {allowed}")
    if status == "refused" or (want == "refused"):
        return fails, unchecked
    report = res.get("report_markdown", "")
    low = report.lower()
    tools = [t.get("name") for t in res.get("tools", [])]
    for t in exp.get("tools_include", []):
        if not debug_ok:
            unchecked.append(t)
        elif not any(o in tools for o in t.split("|")):
            fails.append(f"не вызван {t}")
    if "min_sources" in exp and len(res.get("sources", [])) < exp["min_sources"]:
        fails.append(f"источников {len(res.get('sources', []))}, нужно не меньше {exp['min_sources']}")
    if exp.get("report_any") and not any(s.lower() in low for s in exp["report_any"]):
        fails.append(f"в отчёте нет ни одного из {exp['report_any']}")
    for s in exp.get("report_none", []):
        if s.lower() in low:
            fails.append(f"в отчёте есть запрещённое «{s}»")
    if exp.get("language") == "en" and latin_share(report.split("## Источники")[0]) < 0.6:
        fails.append("отчёт не на английском")
    if code != 200:
        fails.append(f"HTTP {code}: {res}")
    return fails, unchecked


def main():
    p = argparse.ArgumentParser(description="Прогон evals исследовательского агента")
    p.add_argument("--url", required=True)
    p.add_argument("--token", required=True)
    p.add_argument("--debug-token", default="")
    p.add_argument("--dataset", default=str(Path(__file__).with_name("dataset.jsonl")))
    p.add_argument("--only", default="")
    p.add_argument("--timeout", type=float, default=600)
    p.add_argument("--min-pass", type=float, default=0.8)
    p.add_argument("--report", default="", help="куда сохранить JSON с ответами")
    args = p.parse_args()

    cases = [json.loads(l) for l in Path(args.dataset).read_text(encoding="utf-8").splitlines() if l.strip()]
    if args.only:
        cases = [c for c in cases if c["id"] in set(args.only.split(","))]
    headers = {"x-agent-token": args.token}
    if args.debug_token:
        headers["x-agent-debug"] = args.debug_token
    print(f"Заданий: {len(cases)}\n")
    results = []
    for case in cases:
        started = time.time()
        body = {"request": case["request"], "depth": case.get("depth", "quick"), "wait": True, "requester": "evals"}
        code, res = post(args.url, body, headers, args.timeout)
        fails, unchecked = check(case, code, res, "tools" in res)
        ok = not fails
        results.append({"id": case["id"], "ok": ok, "fails": fails, "unchecked": unchecked, "response": res})
        print(f"{'PASS' if ok else 'FAIL'}  {case['id']} ({time.time() - started:.0f}s) — {case.get('note', '')}")
        for f in fails:
            print(f"      ✗ {f}")
    passed = sum(r["ok"] for r in results)
    print(f"\nПрошло {passed} из {len(results)}")
    if any(r["unchecked"] for r in results):
        print("Без --debug-token проверки инструментов пропущены.")
    if args.report:
        Path(args.report).write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    sys.exit(0 if passed / max(1, len(results)) >= args.min_pass else 1)


if __name__ == "__main__":
    main()
