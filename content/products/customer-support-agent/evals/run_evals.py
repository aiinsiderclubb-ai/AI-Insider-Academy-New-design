#!/usr/bin/env python3
"""
Прогон evals: отправляет агенту вопросы из dataset.jsonl и проверяет поведение.

    python3 run_evals.py --url https://n8n.example.com/webhook/AGENT_PATH \
        --token AGENT_TOKEN --debug-token DEBUG_TOKEN

Нужен только Python 3.8+, без пакетов. Каждая строка dataset.jsonl — один случай:

    {"id": "...", "turns": ["вопрос", "уточнение"], "customer": {"email": "..."},
     "expect": {
        "tools_include": ["search_knowledge", "create_ticket|handoff_to_human"],
        "tools_exclude": ["..."],
        "handoff": true,
        "reply_any": ["хотя бы одна из подстрок"],
        "reply_none": ["ни одной из подстрок"],
        "language": "en"},
     "note": "что проверяем"}

Проверки ответа — по последней реплике агента, инструменты и передача человеку —
по всему диалогу. Без верного --debug-token агент не сообщает, какие инструменты
вызвал, и такие проверки помечаются как непроверенные.

Модель отвечает по-разному от раза к разу: запускайте с --repeat 3 и смотрите
на случаи, которые проходят не всегда.
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
    data = json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method="POST",
                                 headers={"content-type": "application/json", **headers})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except ValueError:
            return e.code, {}
    except Exception as e:  # сеть, таймаут
        return 0, {"error": str(e)}


def latin_share(text):
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 0.0
    return sum("a" <= c.lower() <= "z" for c in letters) / len(letters)


def check(case, replies, tools, handoff, debug_ok):
    exp = case.get("expect", {})
    reply = replies[-1] if replies else ""
    low = reply.lower()
    fails, unchecked = [], []

    for want in exp.get("tools_include", []):
        options = want.split("|")
        if not debug_ok:
            unchecked.append(f"tools_include {want}")
        elif not any(o in tools for o in options):
            fails.append(f"не вызван {want} (вызваны: {', '.join(tools) or 'никакие'})")
    for bad in exp.get("tools_exclude", []):
        if not debug_ok:
            unchecked.append(f"tools_exclude {bad}")
        elif bad in tools:
            fails.append(f"вызван {bad}, а не должен")
    if "handoff" in exp and bool(handoff) != bool(exp["handoff"]):
        fails.append(f"handoff={handoff}, ожидалось {exp['handoff']}")
    if exp.get("reply_any") and not any(s.lower() in low for s in exp["reply_any"]):
        fails.append(f"в ответе нет ни одного из {exp['reply_any']}")
    for s in exp.get("reply_none", []):
        if s.lower() in low:
            fails.append(f"в ответе есть запрещённое «{s}»")
    if exp.get("language") == "en" and latin_share(reply) < 0.6:
        fails.append("ответ не на английском")
    if exp.get("language") == "ru" and latin_share(reply) > 0.4:
        fails.append("ответ не на русском")
    if not reply:
        fails.append("пустой ответ")
    return fails, unchecked


def run_case(args, case, attempt):
    sid = "eval-%s-%s" % (case["id"][:40], "".join(random.choices(string.ascii_lowercase + string.digits, k=6)))
    headers = {"x-agent-token": args.token}
    if args.debug_token:
        headers["x-agent-debug"] = args.debug_token
    replies, tools, handoff, debug_ok, errors = [], [], False, True, []
    for turn in case["turns"]:
        body = {"session_id": sid, "message": turn, **case.get("customer", {})}
        started = time.time()
        code, res = post(args.url, body, headers, args.timeout)
        if code != 200:
            errors.append(f"HTTP {code}: {res}")
            break
        replies.append(res.get("reply", ""))
        handoff = handoff or bool(res.get("handoff"))
        if "tools" in res:
            tools += [t.get("name") for t in res["tools"]]
        else:
            debug_ok = False
        if args.verbose:
            print(f"    → {turn}\n    ← {res.get('reply', '')}  [{', '.join(t.get('name') for t in res.get('tools', []))}] {time.time() - started:.1f}s")
        time.sleep(args.delay)
    if errors:
        return {"id": case["id"], "attempt": attempt, "ok": False, "fails": errors, "unchecked": [], "replies": replies, "tools": tools}
    fails, unchecked = check(case, replies, tools, handoff, debug_ok)
    return {"id": case["id"], "attempt": attempt, "ok": not fails, "fails": fails, "unchecked": unchecked,
            "replies": replies, "tools": tools, "handoff": handoff}


def main():
    p = argparse.ArgumentParser(description="Прогон evals агента")
    p.add_argument("--url", required=True, help="Production URL вебхука агента")
    p.add_argument("--token", required=True, help="agent_token из Config")
    p.add_argument("--debug-token", default="", help="debug_token из Config — чтобы видеть вызванные инструменты")
    p.add_argument("--dataset", default=str(Path(__file__).with_name("dataset.jsonl")))
    p.add_argument("--only", default="", help="id случаев через запятую")
    p.add_argument("--repeat", type=int, default=1, help="сколько раз прогнать каждый случай")
    p.add_argument("--delay", type=float, default=0.5, help="пауза между запросами, секунды")
    p.add_argument("--timeout", type=float, default=120)
    p.add_argument("--min-pass", type=float, default=0.9, help="доля прошедших, ниже которой код выхода 1")
    p.add_argument("--report", default="", help="куда сохранить JSON-отчёт")
    p.add_argument("-v", "--verbose", action="store_true", help="печатать диалоги")
    args = p.parse_args()

    cases = [json.loads(line) for line in Path(args.dataset).read_text(encoding="utf-8").splitlines() if line.strip()]
    if args.only:
        wanted = set(args.only.split(","))
        cases = [c for c in cases if c["id"] in wanted]
    print(f"Случаев: {len(cases)} × {args.repeat}\n")

    results = []
    for case in cases:
        for attempt in range(1, args.repeat + 1):
            r = run_case(args, case, attempt)
            results.append(r)
            mark = "PASS" if r["ok"] else "FAIL"
            suffix = f" (#{attempt})" if args.repeat > 1 else ""
            print(f"{mark}  {case['id']}{suffix} — {case.get('note', '')}")
            for f in r["fails"]:
                print(f"      ✗ {f}")
            if not r["ok"] and r["replies"]:
                print(f"      ответ: {r['replies'][-1][:300]}")

    passed = sum(r["ok"] for r in results)
    unchecked = sorted({u for r in results for u in r["unchecked"]})
    print(f"\nПрошло {passed} из {len(results)} ({passed / max(1, len(results)):.0%})")
    if unchecked:
        print("Не проверено без --debug-token:", len(unchecked), "проверок инструментов")
    flaky = sorted({r["id"] for r in results if not r["ok"]} & {r["id"] for r in results if r["ok"]})
    if flaky:
        print("Нестабильные (то проходят, то нет):", ", ".join(flaky))
    if args.report:
        Path(args.report).write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        print("Отчёт:", args.report)
    sys.exit(0 if passed / max(1, len(results)) >= args.min_pass else 1)


if __name__ == "__main__":
    main()
