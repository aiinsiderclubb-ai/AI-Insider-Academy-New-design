#!/usr/bin/env python3
"""
Прогон evals агента квалификации: отправляет тестовые заявки и проверяет оценку.

    python3 run_evals.py --url https://n8n.example.com/webhook/lead-qualification \
        --token AGENT_TOKEN --debug-token DEBUG_TOKEN

Нужен только Python 3.8+. Без верного --debug-token агент отвечает только
{ok, lead_id} — проверять нечего, скрипт остановится.

Прогон пишет строки в лист Leads и шлёт карточки менеджерам. Запускайте на
тестовой таблице и тестовых чатах, перед прогоном очищайте лист Leads —
иначе повторный прогон увидит дубли.

Каждая строка dataset.jsonl — один случай:

    {"id": "...", "leads": [{"name": "...", "email": "...", "message": "..."}],
     "expect": {
        "tier_in": ["hot", "warm"],           уровень последней заявки
        "score_min": 60, "score_max": 100,
        "segment": "enterprise",
        "fit_in": ["high"], "intent_in": [...], "size_in": [...],
        "flags_include": ["job_seeker"],       хотя бы один из
        "flags_exclude": ["spam"],
        "owner_set": true,                     назначен ли менеджер
        "duplicate": true},
     "note": "что проверяем"}

В "leads" можно несколько заявок подряд (для дублей) — проверяется последняя.
Строка {rnd} в любом поле заменяется случайной строкой прогона.
"""
import argparse
import json
import random
import string
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


def check(exp, r):
    fails = []
    a = r.get("assessment") or {}
    flags = set(r.get("flags") or [])
    if "tier_in" in exp and r.get("tier") not in exp["tier_in"]:
        fails.append(f"tier={r.get('tier')}, ожидалось {exp['tier_in']}")
    if "score_min" in exp and (r.get("score") or 0) < exp["score_min"]:
        fails.append(f"score={r.get('score')} < {exp['score_min']}")
    if "score_max" in exp and (r.get("score") or 0) > exp["score_max"]:
        fails.append(f"score={r.get('score')} > {exp['score_max']}")
    if "segment" in exp and r.get("segment") != exp["segment"]:
        fails.append(f"segment={r.get('segment')}, ожидалось {exp['segment']}")
    for key, field in (("fit_in", "fit"), ("intent_in", "intent"), ("size_in", "company_size")):
        if key in exp and a.get(field) not in exp[key]:
            fails.append(f"{field}={a.get(field)}, ожидалось {exp[key]}")
    if exp.get("flags_include") and not flags & set(exp["flags_include"]):
        fails.append(f"нет ни одного флага из {exp['flags_include']} (есть: {sorted(flags)})")
    for f in exp.get("flags_exclude", []):
        if f in flags:
            fails.append(f"лишний флаг {f}")
    if "owner_set" in exp and bool(r.get("owner")) != exp["owner_set"]:
        fails.append(f"owner={r.get('owner')!r}")
    if "duplicate" in exp and bool(r.get("duplicate")) != exp["duplicate"]:
        fails.append(f"duplicate={r.get('duplicate')}")
    if not r.get("assessment") and any(k in exp for k in ("fit_in", "intent_in", "size_in", "flags_include")):
        fails.append("модель не сдала оценку: " + "; ".join(r.get("review") or []))
    return fails


def main():
    p = argparse.ArgumentParser(description="Прогон evals агента квалификации")
    p.add_argument("--url", required=True)
    p.add_argument("--token", required=True)
    p.add_argument("--debug-token", required=True)
    p.add_argument("--dataset", default=str(Path(__file__).with_name("dataset.jsonl")))
    p.add_argument("--only", default="")
    p.add_argument("--delay", type=float, default=1.0)
    p.add_argument("--timeout", type=float, default=180)
    p.add_argument("--min-pass", type=float, default=0.9)
    p.add_argument("--report", default="")
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args()

    cases = [json.loads(x) for x in Path(args.dataset).read_text(encoding="utf-8").splitlines() if x.strip()]
    if args.only:
        cases = [c for c in cases if c["id"] in set(args.only.split(","))]
    rnd = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
    headers = {"x-agent-token": args.token, "x-agent-debug": args.debug_token}
    results = []
    print(f"Случаев: {len(cases)}\n")
    for case in cases:
        last, err = None, ""
        for lead in case["leads"]:
            body = {k: (v.replace("{rnd}", rnd) if isinstance(v, str) else v) for k, v in lead.items()}
            code, res = post(args.url, body, headers, args.timeout)
            if code != 200 or "score" not in res:
                err = f"HTTP {code}: {res}" + (" — проверьте --debug-token" if code == 202 or ("score" not in res and code == 200) else "")
                break
            last = res
            time.sleep(args.delay)
        fails = [err] if err else check(case.get("expect", {}), last)
        results.append({"id": case["id"], "ok": not fails, "fails": fails, "result": last})
        print(f"{'PASS' if not fails else 'FAIL'}  {case['id']} — {case.get('note', '')}")
        for f in fails:
            print(f"      ✗ {f}")
        if args.verbose and last:
            print("      " + json.dumps({k: last.get(k) for k in ("score", "tier", "segment", "owner", "flags", "assessment")}, ensure_ascii=False))
        if err and "debug" in err:
            break
    passed = sum(r["ok"] for r in results)
    print(f"\nПрошло {passed} из {len(results)} ({passed / max(1, len(results)):.0%})")
    if args.report:
        Path(args.report).write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    sys.exit(0 if passed / max(1, len(results)) >= args.min_pass else 1)


if __name__ == "__main__":
    main()
