#!/usr/bin/env python3
"""
Прогон evals Revenue Recovery: отправляет счета из dataset.jsonl в вебхук предпросмотра
и проверяет риск, тон, стоп-правила и текст письма. Ничего не сохраняет и не отправляет клиентам.

    python3 run_evals.py --url https://n8n.example.com/webhook/recovery-preview --token PREVIEW_TOKEN

Нужен только Python 3.8+. Строка dataset.jsonl:

    {"id": "...", "today": "2026-11-19", "invoice": {...колонки листа Invoices...}, "history": [...],
     "expect": {
        "tone": "friendly",                 тон шага
        "risk_any": ["medium", "high"],     итоговый риск — один из
        "stop_contains": "оплачен",         стоп-правило сработало (мониторинг такой счёт пропустит)
        "body_includes": ["INV-1", "1 200"],
        "body_excludes": ["суд"],
        "subject_includes": ["INV-1"],
        "model_text": true},                письмо написала модель и оно прошло проверку (без шаблона)
     "note": "что проверяем"}

`today` фиксирует дату, от которой считается просрочка, — набор не устаревает.
Модель отвечает по-разному: запускайте с --repeat 3.
"""
import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def post(url, body, token, timeout):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"content-type": "application/json", "x-preview-token": token})
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


def check(exp, r):
    fails = []
    body = r.get("body", "")
    low = body.lower()
    if "tone" in exp and r.get("tone") != exp["tone"]:
        fails.append(f"тон {r.get('tone')}, ожидался {exp['tone']}")
    if exp.get("risk_any") and r.get("risk") not in exp["risk_any"]:
        fails.append(f"риск {r.get('risk')}, ожидался один из {exp['risk_any']}")
    if exp.get("stop_contains") and exp["stop_contains"] not in (r.get("stop") or ""):
        fails.append(f"стоп-правило «{r.get('stop')}», ожидалось «{exp['stop_contains']}»")
    for s in exp.get("body_includes", []):
        if s.lower() not in low:
            fails.append(f"в письме нет «{s}»")
    for s in exp.get("body_excludes", []):
        if s.lower() in low:
            fails.append(f"в письме есть запрещённое «{s}»")
    for s in exp.get("subject_includes", []):
        if s.lower() not in r.get("subject", "").lower():
            fails.append(f"в теме нет «{s}»")
    if exp.get("model_text"):
        bad = [f for f in r.get("flags", []) if f.startswith("template:")]
        if bad:
            fails.append(f"письмо модели не прошло проверку: {', '.join(bad)}")
    return fails


def main():
    p = argparse.ArgumentParser(description="Evals Revenue Recovery")
    p.add_argument("--url", required=True, help="Production URL вебхука recovery-preview")
    p.add_argument("--token", required=True, help="preview_token из Config")
    p.add_argument("--dataset", default=str(Path(__file__).with_name("dataset.jsonl")))
    p.add_argument("--only", default="")
    p.add_argument("--repeat", type=int, default=1)
    p.add_argument("--delay", type=float, default=0.5)
    p.add_argument("--timeout", type=float, default=120)
    p.add_argument("--min-pass", type=float, default=0.9)
    p.add_argument("--report", default="")
    p.add_argument("-v", "--verbose", action="store_true")
    a = p.parse_args()

    cases = [json.loads(x) for x in Path(a.dataset).read_text(encoding="utf-8").splitlines() if x.strip()]
    if a.only:
        cases = [c for c in cases if c["id"] in set(a.only.split(","))]
    print(f"Случаев: {len(cases)} × {a.repeat}\n")
    results = []
    for c in cases:
        for n in range(1, a.repeat + 1):
            code, r = post(a.url, {"invoice": c["invoice"], "history": c.get("history", []), "today": c.get("today", "")}, a.token, a.timeout)
            fails = [f"HTTP {code}: {r}"] if code != 200 else check(c.get("expect", {}), r)
            results.append({"id": c["id"], "attempt": n, "ok": not fails, "fails": fails, "answer": r})
            print(f"{'PASS' if not fails else 'FAIL'}  {c['id']}{f' (#{n})' if a.repeat > 1 else ''} — {c.get('note', '')}")
            for f in fails:
                print(f"      ✗ {f}")
            if a.verbose or fails:
                print(f"      риск {r.get('risk')} · тон {r.get('tone')} · пометки {r.get('flags')}\n      {str(r.get('body', ''))[:400]}")
            time.sleep(a.delay)
    passed = sum(r["ok"] for r in results)
    print(f"\nПрошло {passed} из {len(results)} ({passed / max(1, len(results)):.0%})")
    flaky = sorted({r["id"] for r in results if r["ok"]} & {r["id"] for r in results if not r["ok"]})
    if flaky:
        print("Нестабильные:", ", ".join(flaky))
    if a.report:
        Path(a.report).write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    sys.exit(0 if passed / max(1, len(results)) >= a.min_pass else 1)


if __name__ == "__main__":
    main()
