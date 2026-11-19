"""End-to-end run of the Multi-Agent Ops Team in a local n8n against mock.js.

    python3 scripts/agent-kits/multiagent/e2e.py
"""
import csv
import json
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from nk import stable_id, test_variant  # noqa: E402
from stand import Stand  # noqa: E402
import build  # noqa: E402

N8N, MOCK = 5772, 5773
TOKEN, TEAM, DEBUG = "tok-123456", "team-777", "dbg-1"
H = {"x-agent-token": TOKEN, "x-agent-debug": DEBUG}
HT = {"x-team-token": TEAM, "x-agent-debug": DEBUG}


def as_webhook(t, name, path):
    """Replaces a trigger the stand cannot fire (IMAP, schedule) with a webhook plus a node that unwraps the body."""
    n = next(n for n in t["nodes"] if n["name"] == name)
    n.update({"type": "n8n-nodes-base.webhook", "typeVersion": 2.1, "webhookId": stable_id(t["id"], name),
              "parameters": {"httpMethod": "POST", "path": path, "responseMode": "responseNode", "options": {}}})
    n.pop("credentials", None)
    unwrap = name + " Body"
    t["nodes"].append({"id": stable_id(t["id"], unwrap), "name": unwrap, "type": "n8n-nodes-base.code", "typeVersion": 2,
                       "position": [n["position"][0], n["position"][1] + 80],
                       "parameters": {"jsCode": "return [{ json: $input.first().json.body }];"}})
    t["connections"][unwrap] = t["connections"].pop(name)
    t["connections"][name] = {"main": [[{"node": unwrap, "type": "main", "index": 0}]]}


def variant(wf, wf_id, path):
    pre = json.loads(json.dumps(wf))
    pre["id"] = wf_id
    as_webhook(pre, "Email Trigger", f"{wf_id}-email")
    as_webhook(pre, "Daily Report", f"{wf_id}-schedule")
    t = test_variant(pre, f"http://127.0.0.1:{MOCK}", wf_id)
    for n in t["nodes"]:
        if n["name"] == "Config":
            c = n["parameters"]["jsCode"]
            c = c.replace("'ЗАМЕНИТЕ_НА_ДЛИННУЮ_СЛУЧАЙНУЮ_СТРОКУ'", repr(TOKEN)).replace("'ЗАМЕНИТЕ_НА_ДРУГУЮ_СЛУЧАЙНУЮ_СТРОКУ'", repr(TEAM))
            c = c.replace("debug_token: ''", f"debug_token: '{DEBUG}'").replace("'ВСТАВЬТЕ_ID_ТАБЛИЦЫ'", "'SHEET1'")
            c = c.replace("'ВСТАВЬТЕ_ID_ЧАТА'", "'-100777'").replace("rate_limit_messages: 20", "rate_limit_messages: 4")
            c = c.replace("reports_agent: 20", "reports_agent: 3")
            n["parameters"]["jsCode"] = c
        if n["name"] == "Webhook":
            n["parameters"]["path"] = path
    return t


def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  → {str(detail)[:1500]}"))
    if not cond:
        check.failed += 1


check.failed = 0


def llm_calls(s):
    return s.calls("/chat/completions") + s.calls("/v1/messages")


def system_of(call):
    b = call["body"]
    if "system" in b:
        return json.dumps(b["system"], ensure_ascii=False)
    return " ".join(str(m.get("content")) for m in b.get("messages", []) if m.get("role") in ("system", "developer"))


def user_of(call):
    b = call["body"]
    return json.dumps(b.get("messages", []), ensure_ascii=False)


def scripts(s):
    s.script(
        # orchestrator → leads
        {"match": "хотим чат-бота для клиники", "steps": [
            {"tool": "leads_agent", "args": {"task": "LEADTASK-1 клиника, чат-бот, бюджет 3000 евро, сейчас, директор, dir@clinic.ua"}},
            {"final": "Спасибо! {{result.output}}"}]},
        {"match": "LEADTASK-1", "steps": [
            {"tool": "save_lead", "args": {"name": "Ирина", "contact": "dir@clinic.ua", "company": "Клиника Добро", "need": "чат-бот для записи пациентов",
                                           "budget_eur": 3000, "timeline": "now", "decision_maker": "yes"}},
            {"final": "lead={{result.lead_id}} hot={{result.hot}} score={{result.score}}"}]},
        # orchestrator → support
        {"match": "сколько длится внедрение бота", "steps": [
            {"tool": "support_agent", "args": {"task": "SUPTASK-1 вопрос о сроках внедрения"}},
            {"final": "{{result.output}}"}]},
        {"match": "SUPTASK-1", "steps": [
            {"tool": "search_knowledge", "args": {"query": "сроки внедрения"}},
            {"final": "KB: {{result.articles.0.answer}}"}]},
        # orchestrator → support, then leads
        {"match": "есть ли у вас интеграция с crm и сколько стоит внедрение", "steps": [
            {"tool": "support_agent", "args": {"task": "SUPTASK-2 интеграция с CRM"}},
            {"tool": "leads_agent", "args": {"task": "LEADTASK-2 хочет внедрение, контакт +380501112233"}},
            {"final": "both done"}]},
        {"match": "SUPTASK-2", "steps": [{"tool": "search_knowledge", "args": {"query": "интеграция CRM"}}, {"final": "Да, интегрируемся."}]},
        {"match": "LEADTASK-2", "steps": [
            {"tool": "save_lead", "args": {"name": "", "contact": "+380501112233", "company": "", "need": "внедрение интеграции с CRM",
                                           "budget_eur": 0, "timeline": "unknown", "decision_maker": "unknown"}},
            {"final": "lead saved hot={{result.hot}}"}]},
        # handoff
        {"match": "списали деньги дважды", "steps": [
            {"tool": "handoff_to_human", "args": {"reason": "Двойное списание", "summary": "Клиент видит два списания", "urgency": "high"}},
            {"final": "Передал менеджеру."}]},
        # email
        {"match": "у нас упал сайт после вашего обновления", "steps": [
            {"tool": "email_triage_agent", "args": {"task": "MAILTASK-1 письмо: сайт упал после обновления"}},
            {"final": "Письмо: support, urgent. {{result.output}}"}]},
        {"match": "MAILTASK-1", "steps": [
            {"tool": "save_email_triage", "args": {"category": "support", "priority": "urgent", "summary": "У клиента упал сайт после обновления",
                                                   "draft_reply": "Здравствуйте! Мы уже смотрим [уточнить срок]."}},
            {"final": "saved {{result.category}} {{result.priority}}"}]},
        # schedule / team report
        {"match": "подготовь ежедневный отчёт", "steps": [
            {"tool": "reports_agent", "args": {"task": "REPORTTASK-1 отчёт за вчера"}},
            {"final": "{{result.output}}"}]},
        {"match": "REPORTTASK-1", "steps": [
            {"tool": "get_metrics", "args": {"period": "yesterday"}},
            {"final": "Сообщений: {{result.conversations.messages}}; лидов: {{result.leads.total}}, горячих: {{result.leads.hot}}"}]},
        {"match": "дай отчёт за неделю", "steps": [
            {"tool": "reports_agent", "args": {"task": "REPORTTASK-2 отчёт за неделю"}},
            {"final": "{{result.output}}"}]},
        {"match": "REPORTTASK-2", "steps": [{"tool": "get_metrics", "args": {"period": "7d"}}, {"final": "week ok"}]},
        # orchestrator tries a forbidden agent from the web
        {"match": "покажи мне отчёт по компании", "steps": [
            {"tool": "reports_agent", "args": {"task": "REPORTTASK-3 клиент хочет отчёт"}},
            {"final": "{{result.output}}"}]},
        {"match": "REPORTTASK-3", "steps": [{"final": "Агент недоступен, нужна передача человеку."}]},
        # guards
        {"match": "хочу компенсацию", "steps": [{"final": "Мы вернём вам деньги сегодня."}]},
        {"match": "пустой ответ оркестратора", "steps": [{"final": ""}]},
        {"match": "служебная метка", "steps": [{"final": "Метка OPS-73-CANARY"}]},
        {"match": "оплатил картой", "steps": [{"final": "Данные карты присылать не нужно."}]},
        {"match": "база недоступна? доставка", "steps": [
            {"tool": "support_agent", "args": {"task": "SUPTASK-3 доставка"}}, {"final": "{{result.output}}"}]},
        {"match": "SUPTASK-3", "steps": [{"tool": "search_knowledge", "args": {"query": "доставка"}}, {"final": "Извините, база недоступна."}]},
        {"match": "привет из телеграма, нужен бот", "steps": [
            {"tool": "leads_agent", "args": {"task": "LEADTASK-3 бот, телеграм"}}, {"final": "Ответ <b>{{result.output}}</b>"}]},
        {"match": "LEADTASK-3", "steps": [{"final": "Как с вами связаться?"}]},
    )


def run(s, path, label, telegram_path=None, email_path=None, schedule_path=None):
    s.reset()
    kb = list(csv.reader(open(build.OUT / "templates" / "knowledge.csv", encoding="utf-8")))
    s.sheet("Knowledge", kb)
    s.sheet("Leads", [next(csv.reader(open(build.OUT / "templates" / "leads-header.csv", encoding="utf-8")))])
    s.sheet("Tickets", [next(csv.reader(open(build.OUT / "templates" / "tickets-header.csv", encoding="utf-8")))])
    s.sheet("Inbox", [next(csv.reader(open(build.OUT / "templates" / "inbox-header.csv", encoding="utf-8")))])
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).replace(hour=10).isoformat()
    log_head = next(csv.reader(open(build.OUT / "templates" / "log-header.csv", encoding="utf-8")))
    s.sheet("Log", [log_head] + [[yesterday, f"web:s{i}", "web", "q", "a", "support_agent", "", "", ""] for i in range(3)])
    scripts(s)
    ask = lambda sid, msg, headers=H, **extra: s.post(f"/webhook/{path}", {"session_id": sid, "message": msg, **extra}, headers)

    # leads
    before = len(s.calls("/sendMessage"))
    code, r = ask("sess-lead", "Добрый день, хотим чат-бота для клиники")
    leads = s.read_sheet("Leads")
    tg = s.calls("/sendMessage")[before:]
    check(f"{label}: lead routed to leads_agent only", code == 200 and [t["name"] for t in r.get("tools", [])] == ["leads_agent"], r)
    check(f"{label}: lead scored 100 by rules and saved", len(leads) == 2 and leads[1][2] == "100" and leads[1][3] == "да"
          and "hot=true" in r.get("reply", ""), (leads, r))
    check(f"{label}: hot lead alerts the team", len(tg) == 1 and "Горячий лид" in tg[0]["body"]["text"], tg)
    check(f"{label}: trace names the agent and its task", r.get("trace", [{}])[0].get("task", "").startswith("LEADTASK-1"), r.get("trace"))
    sub = [c for c in llm_calls(s) if "LEADTASK-1" in user_of(c)]
    check(f"{label}: leads agent ran on its own prompt", sub and "агент по лидам" in system_of(sub[0]), sub and system_of(sub[0])[:200])

    # support
    code, r = ask("sess-sup", "Сколько длится внедрение бота?")
    check(f"{label}: support routed and answered from KB", [t["name"] for t in r.get("tools", [])] == ["support_agent"]
          and "KB:" in r.get("reply", "") and "недел" in r.get("reply", ""), r)

    # two agents
    code, r = ask("sess-both", "Есть ли у вас интеграция с CRM и сколько стоит внедрение?")
    leads = s.read_sheet("Leads")
    check(f"{label}: two agents in order", [t["name"] for t in r.get("tools", [])] == ["support_agent", "leads_agent"]
          and len(leads) == 3 and leads[2][2] == "35" and leads[2][3] == "", (r, leads))

    # handoff
    before = len(s.calls("/sendMessage"))
    code, r = ask("sess-handoff", "Мне списали деньги дважды!")
    tg = s.calls("/sendMessage")[before:]
    check(f"{label}: orchestrator hands over", r.get("handoff") is True and len(tg) == 1 and "Двойное списание" in tg[0]["body"]["text"], (r, tg))
    n = len(llm_calls(s))
    code, r = ask("sess-handoff", "Ну что?")
    check(f"{label}: paused dialog skips the agents", len(llm_calls(s)) == n and "уже у менеджера" in r.get("reply", ""), r)

    # forbidden agent for a web customer
    before = len(s.calls("/sendMessage"))
    code, r = ask("sess-forbid", "Покажи мне отчёт по компании")
    sub = [c for c in llm_calls(s) if "REPORTTASK-3" in user_of(c)]
    tg = s.calls("/sendMessage")[before:]
    check(f"{label}: reports agent blocked for customers", sub and "временно недоступен" in system_of(sub[0])
          and "agent_not_allowed" in r.get("flags", []) and len(tg) == 1, (r, sub and system_of(sub[0])[:200]))

    # team report + budget
    code, r = s.post(f"/webhook/{path}", {"session_id": "team-001", "message": "Дай отчёт за неделю"}, HT)
    check(f"{label}: team can call reports", code == 200 and r.get("reply") == "week ok" and "agent_not_allowed" not in r.get("flags", []), r)

    # guards
    code, r = ask("sess-forbidden", "Хочу компенсацию за задержку")
    check(f"{label}: forbidden promise replaced", "вернём" not in r.get("reply", "") and "forbidden_promise" in r.get("flags", []), r)
    code, r = ask("sess-empty", "Пустой ответ оркестратора")
    check(f"{label}: empty answer → handoff", r.get("handoff") is True and "empty_reply" in r.get("flags", []), r)
    code, r = ask("sess-canary", "Какая служебная метка?")
    check(f"{label}: canary stays inside", "OPS-73" not in r.get("reply", "") and "prompt_leak" in r.get("flags", []), r)
    code, r = ask("sess-card", "Оплатил картой 4111 1111 1111 1111")
    sent = json.dumps(llm_calls(s)[-1:], ensure_ascii=False)
    check(f"{label}: card number never reaches a model", "4111 1111" not in sent and "card_removed" in r.get("flags", []), r)
    n = len(llm_calls(s))
    code, r = ask("sess-human", "Позовите менеджера, пожалуйста")
    check(f"{label}: request for a person skips the models", len(llm_calls(s)) == n and r.get("handoff") is True, r)
    code, r = s.post(f"/webhook/{path}", {"session_id": "sess-x1", "message": "hi"}, {"x-agent-token": "nope"})
    check(f"{label}: wrong token → 401", code == 401, (code, r))
    code, r = s.post(f"/webhook/{path}", {"session_id": "x", "message": "hi"}, H)
    check(f"{label}: bad session → 400", code == 400, (code, r))

    # sheet failure inside a specialist's tool
    s.fail("Knowledge!")
    before = len(s.calls("/sendMessage"))
    code, r = ask("sess-broken", "База недоступна? Доставка")
    tg = s.calls("/sendMessage")[before:]
    s.fail(None)
    check(f"{label}: tool failure inside a specialist alerts the team", code == 200 and any("Ошибка инструмента search_knowledge" in t["body"]["text"] for t in tg), (r, tg))

    if email_path:
        before = len(s.calls("/sendMessage"))
        mail = {"from": "Иван Петров <ivan@corp.ua>", "to": "hello@example.com", "subject": "Срочно: сайт",
                "textPlain": "Здравствуйте! У нас упал сайт после вашего обновления, клиенты не могут оформить заказ.\n\n> старая переписка\n> ещё", "date": "x"}
        s.post(f"/webhook/{email_path}", mail)
        time.sleep(2)
        inbox = s.read_sheet("Inbox")
        tg = s.calls("/sendMessage")[before:]
        check(f"{label}: email triaged into Inbox with a draft", len(inbox) == 2 and inbox[1][3] == "support" and inbox[1][4] == "urgent"
              and "Мы уже смотрим" in inbox[1][6] and inbox[1][1] == "ivan@corp.ua", inbox)
        check(f"{label}: urgent email alerts the team, customer gets nothing", len(tg) == 1 and "Срочное письмо" in tg[0]["body"]["text"], tg)
        sub = [c for c in llm_calls(s) if "у нас упал сайт" in user_of(c).lower()]
        check(f"{label}: quoted history cut from the email", sub and "старая переписка" not in user_of(sub[0]), sub and user_of(sub[0])[:300])
        n = len(llm_calls(s))
        s.post(f"/webhook/{email_path}", {"from": "no-reply@bank.com", "subject": "Выписка", "textPlain": "Ваша выписка"})
        time.sleep(1)
        check(f"{label}: robot email ignored without a model", len(llm_calls(s)) == n)

    if schedule_path:
        before = len(s.calls("/sendMessage"))
        s.post(f"/webhook/{schedule_path}", {"timestamp": datetime.now(timezone.utc).isoformat(), "Day of week": "Thursday", "Timezone": "Europe/Kyiv"})
        time.sleep(2)
        tg = s.calls("/sendMessage")[before:]
        check(f"{label}: daily report reaches the team with real counts", len(tg) == 1 and "Ежедневный отчёт" in tg[0]["body"]["text"]
              and "Сообщений: 3" in tg[0]["body"]["text"], tg)
        # budget: reports_agent limit is 3 in the test config; the blocked web call, the week report and the daily report used it up
        code, r = s.post(f"/webhook/{path}", {"session_id": "team-002", "message": "Дай отчёт за неделю"}, HT)
        sub = [c for c in llm_calls(s) if "REPORTTASK-2" in user_of(c) and "оркестратор" not in system_of(c)]
        check(f"{label}: agent budget spent → agent gets the stub prompt", sub and "временно недоступен" in system_of(sub[-1]), sub and system_of(sub[-1])[:200])

    if telegram_path:
        before = len(s.calls("/sendMessage"))
        upd = {"update_id": 1, "message": {"message_id": 5, "date": int(time.time()), "chat": {"id": 555, "type": "private"},
                                           "from": {"id": 555, "is_bot": False, "first_name": "Олег"}, "text": "Привет из телеграма, нужен бот"}}
        s.post(f"/webhook/{telegram_path}", upd)
        time.sleep(2)
        tg = s.calls("/sendMessage")[before:]
        check(f"{label}: telegram reply escaped to the customer chat", len(tg) == 1 and str(tg[0]["body"]["chat_id"]) == "555"
              and "&lt;b&gt;" in tg[0]["body"]["text"], tg)

    log = s.read_sheet("Log")
    check(f"{label}: log rows carry the trace", any("LEADTASK-1" in (row[8] if len(row) > 8 else "") for row in log), log[-3:])


def main():
    oa = variant(build.build("openai"), "opsOA", "ops-team")
    an = variant(build.build("anthropic"), "opsAN", "ops-team-claude")
    with Stand("multiagent", N8N, MOCK) as s:
        s.load([oa, an])
        for p in ("/webhook/ops-team", "/webhook/ops-team-claude", "/webhook/opsOA-telegram", "/webhook/opsOA-email", "/webhook/opsOA-schedule",
                  "/webhook/opsAN-email", "/webhook/opsAN-schedule"):
            s.wait_webhook(p)
        run(s, "ops-team", "openai", telegram_path="opsOA-telegram", email_path="opsOA-email", schedule_path="opsOA-schedule")
        run(s, "ops-team-claude", "anthropic", email_path="opsAN-email", schedule_path="opsAN-schedule")

        # evals runner on routing cases
        s.reset()
        s.sheet("Knowledge", list(csv.reader(open(build.OUT / "templates" / "knowledge.csv", encoding="utf-8"))))
        s.sheet("Leads", [next(csv.reader(open(build.OUT / "templates" / "leads-header.csv", encoding="utf-8")))])
        cases = [json.loads(l) for l in (build.OUT / "evals" / "dataset.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
        pick = {c["id"]: c for c in cases}
        s.script({"match": pick["route-lead-clear"]["turns"][0][:30], "steps": [{"tool": "leads_agent", "args": {"task": "EV-1"}}, {"final": "ok"}]},
                 {"match": "EV-1", "steps": [{"final": "Как с вами связаться?"}]},
                 {"match": pick["route-support-timeline"]["turns"][0][:30], "steps": [{"tool": "leads_agent", "args": {"task": "EV-2"}}, {"final": "ok"}]},
                 {"match": "EV-2", "steps": [{"final": "x"}]})
        ds = Path(tempfile.mkdtemp()) / "dataset.jsonl"
        ds.write_text("\n".join(json.dumps(pick[i], ensure_ascii=False) for i in ("route-lead-clear", "route-support-timeline")), encoding="utf-8")
        run_ = subprocess.run([sys.executable, str(build.OUT / "evals" / "run_evals.py"), "--url", s.base + "/webhook/ops-team",
                               "--token", TOKEN, "--debug-token", DEBUG, "--dataset", str(ds), "--delay", "0"], capture_output=True, text=True)
        print(run_.stdout)
        check("evals runner: right route passes, wrong route caught", "PASS  route-lead-clear" in run_.stdout
              and "FAIL  route-support-timeline" in run_.stdout and run_.returncode == 1, run_.stdout + run_.stderr)

        bad = [e for e in s.executions() if e[1] != "success"]
        # the empty POSTs that probe webhook registration end in "deny" or "ignore", never in errors
        check("no failed executions", not bad, bad and s.last_error())
    print("\nfailed:", check.failed)
    sys.exit(1 if check.failed else 0)


if __name__ == "__main__":
    main()
