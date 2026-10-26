#!/usr/bin/env python3
"""Audit Zapier and Make automations before moving them to n8n.

Reads Make scenario blueprints (*.json), a Zapier export (zapfile.json) and/or a
hand-filled inventory (*.csv), and writes:

  inventory.csv      one row per automation: platform, trigger, steps, complexity, hours
  steps.csv          one row per step with its n8n equivalent and notes
  apps.csv           dependency map: every app, where it is used, how well n8n covers it
  migration-map.csv  waves, priority and status columns to track the project
  audit.md           the report for the client: summary, risks, estimate, access list

Standard library only. Usage:

  python3 migration_audit.py examples/ --out audit/ --rate 50 --currency EUR --client "Acme"
"""
import argparse
import csv
import json
import math
import os
import re
import sys
from collections import Counter, OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))

# Zapier app keys come as "GoogleSheetsV2CLIAPI", "SlackAPI", "WebHookAPI"…; Make modules as "google-sheets:addRow".
ALIASES = {"branching": "paths", "path": "paths", "webhookbyzapier": "webhook", "zapierwebhook": "webhook", "googlesheet": "googlesheets",
           "sheets": "googlesheets", "gcal": "googlecalendar", "emailbyzapierinbound": "emailbyzapier", "zapiermail": "emailbyzapier",
           "openaigpt": "openai", "gpt": "openai", "claude": "anthropicclaude", "facebookleads": "facebookleadads", "fbleadads": "facebookleadads",
           "microsoftoutlook": "outlook", "office365mail": "outlook", "excel": "microsoftexcel", "teams": "microsoftteams", "monday.com": "mondaycom",
           "tables": "zapiertables", "interface": "interfaces", "chatbot": "chatbots", "filterbyzapier": "filter", "formatterbyzapier": "formatter",
           "delaybyzapier": "delay", "schedulebyzapier": "schedule", "codebyzapier": "code", "storagebyzapier": "storage", "digestbyzapier": "digest",
           "loopingbyzapier": "looping", "smsbyzapierapi": "smsbyzapier", "aibyzapierapi": "aibyzapier"}
STEP_HOURS = {"logic": 0.25, "native": 0.5, "http": 1.0, "partial": 1.5, "none": 3.0, "unknown": 1.5}
KIND_HOURS = {"router": 1.0, "iterator": 0.75, "aggregator": 0.75, "code": 1.0}


def norm(name):
    s = re.sub(r"[^a-z0-9.]", "", str(name or "").lower())
    for suffix in ("cliapi", "api"):
        if s.endswith(suffix) and len(s) > len(suffix) + 2:
            s = s[: -len(suffix)]
    s = re.sub(r"v\d+$", "", s)
    return ALIASES.get(s, s.replace(".", ""))


class Mapper:
    def __init__(self, path):
        data = json.load(open(path, encoding="utf-8"))
        self.apps = data["apps"]
        self.modules = data["make_modules"]

    def app(self, key):
        k = norm(key)
        if k in self.apps:
            return k, self.apps[k]
        # "googlesheetswatchrows"-like keys from hand-filled CSVs: longest known prefix wins.
        best = max((a for a in self.apps if k.startswith(a)), key=len, default=None)
        if best:
            return best, self.apps[best]
        return k, {"label": key or "?", "n8n": "HTTP Request (проверить, есть ли узел)", "support": "unknown", "note": "Нет в таблице соответствий: проверьте узел n8n или API сервиса."}


def step_kind(app_key, action, module=""):
    a = f"{app_key}:{action}".lower()
    if module.startswith("builtin:BasicRouter") or app_key == "paths":
        return "router"
    if module.startswith(("builtin:BasicFeeder", "builtin:BasicRepeater")) or app_key == "looping":
        return "iterator"
    if module.startswith(("builtin:BasicAggregator", "util:TextAggregator")):
        return "aggregator"
    if app_key == "code" or "code" in action.lower() or "runjavascript" in a or "runpython" in a:
        return "code"
    return ""


def make_steps(flow, mapper, depth=0):
    for m in flow or []:
        module = str(m.get("module", ""))
        app_part, _, action = module.partition(":")
        known = mapper.modules.get(module)
        key, info = mapper.app(app_part)
        yield {"app_key": key, "app": info["label"], "action": action, "module": module, "kind": (known or {}).get("kind") or step_kind(key, action, module),
               "n8n": (known or {}).get("n8n") or info["n8n"], "support": "logic" if known and known.get("kind") != "trigger" and known.get("kind") != "action" else info["support"],
               "note": info.get("note", ""), "branch": depth, "internal": bool(info.get("internal"))}
        for route in m.get("routes") or []:
            yield from make_steps(route.get("flow"), mapper, depth + 1)


def from_make(blueprint, source, mapper):
    flow = blueprint.get("flow") or []
    steps = list(make_steps(flow, mapper))
    if not steps:
        return None
    first = steps[0]
    trigger = f"{first['app']}: {first['action']}"
    polling = first["module"].startswith(("gateway:",)) is False and bool(re.match(r"(watch|search|list|get)", first["action"], re.I))
    meta = blueprint.get("metadata") or {}
    sched = ((meta.get("scenario") or {}).get("schedule") or {}) if isinstance(meta, dict) else {}
    return {"name": blueprint.get("name") or os.path.basename(source), "platform": "Make", "source": os.path.basename(source), "trigger": trigger,
            "polling": polling, "runs_per_month": "", "steps": steps, "status": "", "schedule": json.dumps(sched, ensure_ascii=False) if sched else ""}


def zap_nodes(zap):
    nodes = zap.get("nodes") or zap.get("steps") or []
    if isinstance(nodes, dict):
        nodes = list(nodes.values())
    def order(n):
        return (0 if n.get("parent_id") in (None, "", 0) else 1, str(n.get("id", "")))
    return sorted(nodes, key=order)


def from_zapier(zap, source, mapper):
    nodes = zap_nodes(zap)
    if not nodes:
        return None
    steps = []
    for i, n in enumerate(nodes):
        api = n.get("selected_api") or n.get("app") or n.get("service") or ""
        action = str(n.get("action") or n.get("event") or "")
        key, info = mapper.app(api)
        steps.append({"app_key": key, "app": info["label"], "action": action, "module": api, "kind": step_kind(key, action),
                      "n8n": info["n8n"], "support": info["support"], "note": info.get("note", ""), "branch": 1 if n.get("parent_id") and key == "paths" else 0,
                      "internal": bool(info.get("internal"))})
    first = nodes[0]
    polling = str(first.get("type_of", "")).lower() == "read" and steps[0]["app_key"] not in ("webhook", "schedule", "rss")
    return {"name": zap.get("title") or zap.get("name") or f"Zap {zap.get('id', '')}", "platform": "Zapier", "source": os.path.basename(source),
            "trigger": f"{steps[0]['app']}: {steps[0]['action']}", "polling": polling, "runs_per_month": "", "steps": steps,
            "status": str(zap.get("status") or zap.get("state") or ""), "schedule": ""}


def from_csv(path, mapper):
    """Hand-filled inventory: name, platform, trigger, steps ("App: action; App: action"), runs_per_month, status, notes."""
    out = []
    with open(path, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            name = (row.get("name") or "").strip()
            if not name:
                continue
            parts = [p.strip() for p in [row.get("trigger", "")] + (row.get("steps") or "").split(";") if p.strip()]
            steps = []
            for p in parts:
                app, _, action = p.partition(":")
                key, info = mapper.app(app.strip())
                steps.append({"app_key": key, "app": info["label"], "action": action.strip(), "module": app.strip(), "kind": step_kind(key, action),
                              "n8n": info["n8n"], "support": info["support"], "note": info.get("note", ""), "branch": 0, "internal": bool(info.get("internal"))})
            if not steps:
                continue
            out.append({"name": name, "platform": (row.get("platform") or "").strip() or "?", "source": os.path.basename(path),
                        "trigger": f"{steps[0]['app']}: {steps[0]['action']}", "polling": bool(re.search(r"new|watch|updated|новая|новый", steps[0]["action"], re.I)) and steps[0]["app_key"] not in ("webhook", "webhooks", "gateway", "schedule"),
                        "runs_per_month": (row.get("runs_per_month") or "").strip(), "steps": steps, "status": (row.get("status") or "").strip(), "notes": (row.get("notes") or "").strip(), "schedule": ""})
    return out


def load(paths, mapper):
    flows, problems = [], []
    files = []
    for p in paths:
        if os.path.isdir(p):
            for root, _, names in os.walk(p):
                files += [os.path.join(root, n) for n in sorted(names) if n.lower().endswith((".json", ".csv"))]
        else:
            files.append(p)
    for path in files:
        try:
            if path.lower().endswith(".csv"):
                flows += from_csv(path, mapper)
                continue
            data = json.load(open(path, encoding="utf-8"))
        except (OSError, ValueError) as e:
            problems.append(f"{os.path.basename(path)}: не читается ({e})")
            continue
        if isinstance(data, dict) and "flow" in data:
            f = from_make(data, path, mapper)
            (flows.append(f) if f else problems.append(f"{os.path.basename(path)}: пустой сценарий"))
        elif isinstance(data, dict) and isinstance(data.get("zaps"), list):
            for zap in data["zaps"]:
                f = from_zapier(zap, path, mapper)
                (flows.append(f) if f else problems.append(f"{os.path.basename(path)}: zap {zap.get('id')} без шагов"))
        elif isinstance(data, list) and data and isinstance(data[0], dict) and "flow" in data[0]:
            for bp in data:
                f = from_make(bp, path, mapper)
                if f:
                    flows.append(f)
        else:
            problems.append(f"{os.path.basename(path)}: формат не распознан (ожидается blueprint Make или экспорт Zapier)")
    return flows, problems


def estimate(flow):
    hours = 1.0
    for s in flow["steps"]:
        hours += STEP_HOURS.get(s["support"], 1.5) + KIND_HOURS.get(s["kind"], 0)
    if flow["polling"]:
        hours += 0.5
    hours *= 1.3  # testing and parallel run
    hours = math.ceil(hours * 2) / 2
    risky = [s for s in flow["steps"] if s["support"] in ("none", "partial", "unknown")]
    tier = "простая" if hours <= 4 and not risky else "средняя" if hours <= 8 else "сложная"
    return hours, tier, risky


def runs(flow):
    try:
        return int(float(str(flow.get("runs_per_month") or "0").replace(" ", "").replace(",", ".")))
    except ValueError:
        return 0


def write_csv(path, header, rows):
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("inputs", nargs="+", help="папки или файлы: blueprint Make (.json), экспорт Zapier (.json), опись (.csv)")
    ap.add_argument("--out", default="audit", help="куда писать результат")
    ap.add_argument("--rate", type=float, default=50, help="ставка за час")
    ap.add_argument("--currency", default="EUR")
    ap.add_argument("--client", default="клиент")
    ap.add_argument("--map", default=os.path.join(HERE, "app_map.json"), help="таблица соответствий")
    a = ap.parse_args(argv)
    mapper = Mapper(a.map)
    flows, problems = load(a.inputs, mapper)
    if not flows:
        print("Не найдено ни одной автоматизации.", *problems, sep="\n", file=sys.stderr)
        return 1
    os.makedirs(a.out, exist_ok=True)
    for f in flows:
        f["hours"], f["tier"], f["risky"] = estimate(f)
    # Waves: quick, busy and simple first; risky last.
    for f in flows:
        f["wave"] = 3 if f["risky"] or f["tier"] == "сложная" else 1 if f["tier"] == "простая" else 2
    flows.sort(key=lambda f: (f["wave"], -runs(f), f["hours"], f["name"]))

    write_csv(os.path.join(a.out, "inventory.csv"), ["name", "platform", "source", "status", "trigger", "polling_trigger", "steps", "routers", "iterators", "code_steps", "runs_per_month", "complexity", "hours", "risks"],
              [[f["name"], f["platform"], f["source"], f["status"], f["trigger"], "yes" if f["polling"] else "", len(f["steps"]),
                sum(s["kind"] == "router" for s in f["steps"]), sum(s["kind"] in ("iterator", "aggregator") for s in f["steps"]), sum(s["kind"] == "code" for s in f["steps"]),
                f["runs_per_month"], f["tier"], f["hours"], "; ".join(sorted({s["app"] for s in f["risky"]}))] for f in flows])
    write_csv(os.path.join(a.out, "steps.csv"), ["workflow", "n", "app", "action", "source_module", "n8n", "support", "note"],
              [[f["name"], i + 1, s["app"], s["action"], s["module"], s["n8n"], s["support"], s["note"]] for f in flows for i, s in enumerate(f["steps"])])
    apps = OrderedDict()
    for f in flows:
        for s in f["steps"]:
            if s["support"] == "logic":
                continue
            e = apps.setdefault(s["app_key"], {"app": s["app"], "n8n": s["n8n"], "support": s["support"], "note": s["note"], "flows": [], "internal": s.get("internal", False)})
            if f["name"] not in e["flows"]:
                e["flows"].append(f["name"])
    app_rows = sorted(apps.values(), key=lambda e: (-len(e["flows"]), e["app"]))
    write_csv(os.path.join(a.out, "apps.csv"), ["app", "used_in", "workflows", "n8n", "support", "access_needed", "note"],
              [[e["app"], len(e["flows"]), "; ".join(e["flows"]), e["n8n"], e["support"], "" if e["internal"] else "yes", e["note"]] for e in app_rows])
    write_csv(os.path.join(a.out, "migration-map.csv"), ["wave", "workflow", "platform", "complexity", "hours", "runs_per_month", "n8n_workflow_name", "owner", "built", "parallel_run_from", "matched_days", "cut_over", "old_disabled", "notes"],
              [[f["wave"], f["name"], f["platform"], f["tier"], f["hours"], f["runs_per_month"], f"{f['platform']} · {f['name']}", "", "", "", "", "", "", ""] for f in flows])

    total = sum(f["hours"] for f in flows)
    pm = 4 + 0.5 * len(flows)  # audit, access, cutover coordination
    by_platform = Counter(f["platform"] for f in flows)
    tiers = Counter(f["tier"] for f in flows)
    money = lambda h: f"{h * a.rate:,.0f} {a.currency}".replace(",", " ")
    risky_apps = [e for e in app_rows if e["support"] in ("none", "partial", "unknown")]
    lines = [f"# Аудит автоматизаций: {a.client}", "",
             f"Найдено автоматизаций: **{len(flows)}** ({', '.join(f'{k}: {v}' for k, v in sorted(by_platform.items(), key=lambda kv: (-kv[1], kv[0])))}). Шагов: {sum(len(f['steps']) for f in flows)}. Сервисов: {len(app_rows)}.", "",
             "| Сложность | Сколько |", "|---|---|"] + [f"| {t} | {tiers.get(t, 0)} |" for t in ("простая", "средняя", "сложная")] + [
             "", "## Оценка", "",
             f"- Перенос и тестирование: **{total:g} ч**",
             f"- Аудит, доступы, координация переключения: **{pm:g} ч**",
             f"- Итого: **{total + pm:g} ч** × {a.rate:g} {a.currency} = **{money(total + pm)}**",
             "", "Оценка включает 30% на тесты и параллельный прогон. Это ориентир для коммерческого предложения, а не обязательство: уточните после разбора самых сложных сценариев.", "",
             "## Волны переноса", "",
             "1. **Первая** — простые и самые нагруженные: быстрый результат и экономия на тарифе.",
             "2. **Вторая** — средние.",
             "3. **Третья** — сложные и с рисками: требуют решений с клиентом.", "",
             "| Волна | Автоматизация | Платформа | Триггер | Шагов | Сложность | Часы | Запусков/мес |", "|---|---|---|---|---|---|---|---|"] + [
             f"| {f['wave']} | {f['name']} | {f['platform']} | {f['trigger']}{' (опрос)' if f['polling'] else ''} | {len(f['steps'])} | {f['tier']} | {f['hours']:g} | {f['runs_per_month'] or '—'} |" for f in flows]
    lines += ["", "## Риски", ""]
    if risky_apps:
        lines += [f"- **{e['app']}** ({e['support']}) — {e['note'] or 'нет прямого аналога'} Где: {', '.join(e['flows'])}." for e in risky_apps]
    polling = [f["name"] for f in flows if f["polling"]]
    if polling:
        lines.append(f"- **Триггеры, которые, вероятно, опрашивают сервис** ({len(polling)}) — проверьте. При первом запуске n8n может обработать уже существующие записи. Запускайте с фильтром по дате или пометкой обработанных. {', '.join(polling)}.")
    lines.append("- **Адреса вебхуков меняются**: каждый отправитель (формы, платёжные системы, сервисы) переключается на новый адрес в день переноса.")
    if not risky_apps and not polling:
        lines.append("- Существенных рисков не найдено.")
    lines += ["", "## Доступы, которые нужны от клиента", ""] + [f"- [ ] {e['app']} — для: {', '.join(e['flows'][:4])}{' и др.' if len(e['flows']) > 4 else ''}" for e in app_rows if not e["internal"]]
    if problems:
        lines += ["", "## Не удалось прочитать", ""] + [f"- {p}" for p in problems]
    lines += ["", "## Файлы", "", "- `inventory.csv` — опись автоматизаций", "- `steps.csv` — каждый шаг и его аналог в n8n", "- `apps.csv` — сервисы и где они используются",
              "- `migration-map.csv` — план по волнам и колонки для отслеживания статуса", ""]
    open(os.path.join(a.out, "audit.md"), "w", encoding="utf-8").write("\n".join(lines))
    print(f"{len(flows)} автоматизаций, {total + pm:g} ч, {money(total + pm)} → {a.out}")
    for p in problems:
        print("! " + p, file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
