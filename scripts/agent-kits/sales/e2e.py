"""End-to-end run of the Sales Agent in a local n8n against mock.js.

    python3 scripts/agent-kits/sales/e2e.py
"""
import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from nk import test_variant, stable_id  # noqa: E402
from stand import Stand  # noqa: E402
import build  # noqa: E402

N8N, MOCK = 5752, 5753
MOCK_URL = f"http://127.0.0.1:{MOCK}"
TOKEN, DEBUG = "tok-sales-1", "dbg-s"
H = {"x-agent-token": TOKEN, "x-agent-debug": DEBUG}

PRODUCTS = [
    ["id", "name", "description", "price", "currency", "url", "payment_link", "tags", "in_stock"],
    ["crm-start", "CRM Старт", "CRM для отдела продаж до 5 менеджеров: сделки, задачи, Telegram", "49", "EUR", "https://example.com/crm", "https://pay.example.com/crm-start", "crm продажи сделки менеджеры", "да"],
    ["crm-pro", "CRM Про", "CRM для команды до 50 человек: воронки, отчёты, API", "149", "EUR", "https://example.com/crm-pro", "", "crm воронка отчёты команда", "да"],
]
FACTS = [
    ["id", "topic", "approved_answer", "tags"],
    ["F-1", "Гарантия", "14 дней бесплатного теста; если не подойдёт — просто не продлеваете подписку.", "гарантия гарантии возврат тест"],
]
LEAD_HEAD = ["session_id", "channel", "chat_id", "name", "email", "phone", "need", "budget", "timeline", "authority",
             "product_id", "score", "tier", "stage", "touches", "last_touch_at", "notes", "updated", "created"]


def variant(wf, wf_id, path, anthropic=False):
    wf = json.loads(json.dumps(wf))
    for n in wf["nodes"]:
        if n["type"] == "n8n-nodes-base.emailSend":
            n.pop("credentials", None)
            n.update({"type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2})
            n["parameters"] = {"method": "POST", "url": f"{MOCK_URL}/hook/email", "sendBody": True, "specifyBody": "json",
                               "jsonBody": "={{ JSON.stringify({ to: $json.email, subject: $json.subject, text: $json.text }) }}", "options": {}}
    t = test_variant(wf, MOCK_URL, wf_id)
    for n in t["nodes"]:
        if n["name"] == "Config":
            c = n["parameters"]["jsCode"]
            c = c.replace("'ЗАМЕНИТЕ_НА_ДЛИННУЮ_СЛУЧАЙНУЮ_СТРОКУ'", repr(TOKEN)).replace("debug_token: ''", f"debug_token: '{DEBUG}'")
            c = c.replace("'ВСТАВЬТЕ_ID_ТАБЛИЦЫ'", "'SHEET1'").replace("'ВСТАВЬТЕ_ID_ЧАТА'", "'-100888'")
            c = c.replace("followup_quiet_from: '20:00'", "followup_quiet_from: '23:59'").replace("followup_quiet_to: '09:00'", "followup_quiet_to: '00:00'")
            c = c.replace("followup_weekdays: ['mon', 'tue', 'wed', 'thu', 'fri']", "followup_weekdays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']")
            c = c.replace("email_followups: false", "email_followups: true")
            c = c.replace("'https://cal.com/ваша-компания/звонок'", "'https://cal.example.com/sales'")
            n["parameters"]["jsCode"] = c
        if n["name"] == "Webhook":
            n["parameters"]["path"] = path
    if anthropic:
        t["connections"].pop("OpenAI Chat Model")
        t["connections"]["Anthropic Chat Model"] = {"ai_languageModel": [[{"node": "AI Agent", "type": "ai_languageModel", "index": 0}]]}
    else:
        t["nodes"].append({"id": stable_id(wf_id, "tick"), "name": "Tick", "type": "n8n-nodes-base.webhook", "typeVersion": 2.1,
                           "position": [-800, 540], "webhookId": stable_id(wf_id, "tickhook"),
                           "parameters": {"httpMethod": "POST", "path": f"{wf_id}-tick", "responseMode": "responseNode", "options": {}}})
        t["nodes"].append({"id": stable_id(wf_id, "tickbody"), "name": "Tick Body", "type": "n8n-nodes-base.code", "typeVersion": 2,
                           "position": [-700, 640], "parameters": {"jsCode": "return [{ json: { 'Readable date': 'test', timestamp: new Date().toISOString() } }];"}})
        t["connections"]["Tick"] = {"main": [[{"node": "Tick Body", "type": "main", "index": 0}]]}
        t["connections"]["Tick Body"] = {"main": [[{"node": "Config", "type": "main", "index": 0}]]}
    return t


def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  → {str(detail)[:900]}"))
    if not cond:
        check.failed += 1


check.failed = 0


def ask(s, path, session, message, **extra):
    return s.post(f"/webhook/{path}", {"session_id": session, "message": message, **extra}, H)


def llm_calls(s):
    return len(s.calls("/chat/completions")) + len(s.calls("/v1/messages"))


def main():
    wf = build.build()
    oa = variant(wf, "salesOA", "sales-agent")
    an = variant(wf, "salesAN", "sales-agent-claude", anthropic=True)
    with Stand("sales", N8N, MOCK) as s:
        s.load([oa, an])
        for p in ("/webhook/sales-agent", "/webhook/sales-agent-claude", "/webhook/salesOA-tick"):
            s.wait_webhook(p)
        for path, label in (("sales-agent", "openai"), ("sales-agent-claude", "anthropic")):
            s.reset()
            s.sheet("Products", PRODUCTS)
            s.sheet("Facts", FACTS)
            s.sheet("Leads", [LEAD_HEAD])
            s.sheet("OptOut", [["time", "session_id", "channel", "chat_id", "contact"]])
            s.script(
                {"match": "нужна crm для отдела продаж", "steps": [{"tool": "search_catalog", "args": {"query": "crm отдел продаж"}},
                                                                   {"final": "{{result.products.0.name}} {{result.products.0.price}}"}]},
                {"match": "нужен космический корабль", "steps": [{"tool": "search_catalog", "args": {"query": "космический корабль"}},
                                                                {"final": "found={{result.found}}"}]},
                {"match": "а гарантии есть", "steps": [{"tool": "get_sales_facts", "args": {"topic": "гарантия"}},
                                                      {"final": "{{result.facts.0.approved_answer}}"}]},
                {"match": "нас пятеро менеджеров", "steps": [{"tool": "save_lead", "args": {"name": "Ира", "email": "", "phone": "", "need": "CRM для 5 менеджеров", "budget": "", "timeline": "", "authority": "", "product_id": "crm-start", "stage": "qualifying", "notes": ""}},
                                                             {"final": "{{result.score}}|{{result.tier}}"}]},
                {"match": "бюджет около 2 тыс", "steps": [{"tool": "save_lead", "args": {"name": "", "email": "ira@example.com", "phone": "", "need": "", "budget": "около 2 тыс €", "timeline": "в этом месяце", "authority": "решаю я", "product_id": "", "stage": "", "notes": "сравнивает с Pipedrive"}},
                                                         {"final": "{{result.score}}|{{result.tier}}"}]},
                {"match": "готов оплатить", "steps": [{"tool": "send_offer", "args": {"product_id": "crm-start", "kind": "payment", "email": "", "notes": ""}},
                                                     {"final": "Оплата: {{result.payment_link}}"}]},
                {"match": "оплачу про картой онлайн", "steps": [{"tool": "send_offer", "args": {"product_id": "crm-pro", "kind": "payment", "email": "", "notes": ""}},
                                                              {"final": "{{result.error}}"}]},
                {"match": "пришлите кп", "steps": [{"tool": "send_offer", "args": {"product_id": "crm-pro", "kind": "quote", "email": "", "notes": ""}},
                                                  {"final": "{{result.error}}"}]},
                {"match": "хочу созвониться", "steps": [{"tool": "book_call", "args": {"topic": "внедрение", "preferred_time": "завтра"}},
                                                       {"final": "{{result.booking_link}}"}]},
                {"match": "можно дешевле", "steps": [{"final": "Конечно, дадим вам скидку 30% прямо сейчас!"}]},
                {"match": "успею купить", "steps": [{"final": "Осталось всего 2 места, решайтесь!"}]},
            )
            code, r = ask(s, path, "sl-cat", "Нужна CRM для отдела продаж")
            check(f"{label}: catalog answer with price", r.get("reply") == "CRM Старт 49 EUR", r)
            code, r = ask(s, path, "sl-none", "Нужен космический корабль")
            check(f"{label}: nothing invented when not in catalog", r.get("reply") == "found=false", r)
            code, r = ask(s, path, "sl-fact", "А гарантии есть?")
            check(f"{label}: objection answered by approved fact", r.get("reply", "").startswith("14 дней бесплатного теста"), r)

            before = len(s.calls("/sendMessage"))
            code, r = ask(s, path, "sl-ira", "Нас пятеро менеджеров, нужна CRM")
            leads = s.read_sheet("Leads")
            check(f"{label}: lead saved with need-only score", r.get("reply") == "25|cold" and len(leads) == 2 and leads[1][0] == "web:sl-ira", (r, leads))
            code, r = ask(s, path, "sl-ira", "Бюджет около 2 тыс €, нужно в этом месяце, решаю я")
            leads = s.read_sheet("Leads")
            tg = s.calls("/sendMessage")[before:]
            check(f"{label}: same row updated, score from code", r.get("reply") == "100|hot" and len(leads) == 2
                  and leads[1][4] == "ira@example.com" and leads[1][13] == "qualifying" and leads[1][10] == "crm-start", (r, leads))
            check(f"{label}: hot lead alert once", len(tg) == 1 and "Горячий лид: 100/100" in tg[0]["body"]["text"], tg)

            before = len(s.calls("/sendMessage"))
            code, r = ask(s, path, "sl-ira", "Готов оплатить")
            tg = s.calls("/sendMessage")[before:]
            check(f"{label}: payment link only from catalog", r.get("payment_link") == "https://pay.example.com/crm-start"
                  and "pay.example.com/crm-start" in r.get("reply", "") and len(tg) == 1, (r, tg))
            code, r = ask(s, path, "sl-pro", "Оплачу Про картой онлайн")
            check(f"{label}: no link → no invented link", r.get("reply") == "no_payment_link", r)
            code, r = ask(s, path, "sl-pro", "Пришлите КП")
            check(f"{label}: quote needs an email", r.get("reply") == "no_email", r)
            code, r = ask(s, path, "sl-call", "Хочу созвониться")
            check(f"{label}: call link from Config", r.get("reply") == "https://cal.example.com/sales" and r.get("booking_link"), r)

            for sid, msg, flag in (("sl-disc", "Можно дешевле?", "discount"), ("sl-fomo", "Успею купить?", "scarcity")):
                before = len(s.calls("/sendMessage"))
                code, r = ask(s, path, sid, msg)
                tg = s.calls("/sendMessage")[before:]
                check(f"{label}: {flag} promise replaced, team told", "forbidden_promise" in r.get("flags", []) and "30%" not in r.get("reply", "")
                      and "2 места" not in r.get("reply", "") and len(tg) == 1, (r, tg))

            n = llm_calls(s)
            code, r = ask(s, path, "sl-ira", "Стоп")
            optout = s.read_sheet("OptOut")
            check(f"{label}: opt-out without the model, stop-list row", llm_calls(s) == n and "opt_out" in r.get("flags", [])
                  and len(optout) == 2 and optout[1][1] == "web:sl-ira", (r, optout))

            code, r = s.post(f"/webhook/{path}", {"session_id": "sl-x1234", "message": "hi"}, {"x-agent-token": "nope"})
            check(f"{label}: wrong token → 401", code == 401, code)

        # ---- follow-up (OpenAI variant) ----
        s.reset()
        now = datetime.now(timezone.utc)
        iso = lambda d: d.isoformat().replace("+00:00", "Z")  # noqa: E731
        old, fresh = iso(now - timedelta(hours=30)), iso(now - timedelta(hours=1))

        def lead(sid, channel, chat, name, email, stage, touches, created, last_touch=""):
            row = dict.fromkeys(LEAD_HEAD, "")
            row.update(session_id=sid, channel=channel, chat_id=chat, name=name, email=email, product_id="crm-start",
                       stage=stage, touches=str(touches), created=created, last_touch_at=last_touch)
            return [row[c] for c in LEAD_HEAD]

        s.sheet("Products", PRODUCTS)
        s.sheet("Leads", [LEAD_HEAD,
                          lead("tg:555", "telegram", "555", "Олег", "", "qualifying", 0, old),        # due → Telegram
                          lead("tg:556", "telegram", "556", "Аня", "", "won", 0, old),               # won → never
                          lead("tg:557", "telegram", "557", "Петя", "", "qualifying", 0, old),       # opted out
                          lead("tg:558", "telegram", "558", "Ника", "", "qualifying", 0, fresh),     # too early
                          lead("tg:559", "telegram", "559", "Макс", "", "offer_sent", 3, old),       # touches used up
                          lead("web:w1", "web", "", "Ира", "ira@example.com", "offer_sent", 0, old),  # due → email
                          lead("tg:560", "telegram", "560", "Лев", "", "qualifying", 0, old)])        # wrote 1 h ago (Log)
        s.sheet("OptOut", [["time", "session_id", "channel", "chat_id", "contact"], [old, "tg:557", "telegram", "557", ""]])
        s.sheet("Log", [["time", "session_id", "channel"], [fresh, "tg:560", "telegram"]])
        s.post("/webhook/salesOA-tick", {})
        time.sleep(3)
        tg = s.calls("/sendMessage")
        mails = s.calls("/hook/email")
        leads = s.read_sheet("Leads")
        check("follow-up: only the due Telegram lead", [str(c["body"]["chat_id"]) for c in tg] == ["555"] and "Олег" in tg[0]["body"]["text"]
              and "CRM Старт" in tg[0]["body"]["text"], tg)
        check("follow-up: email for the web lead", len(mails) == 1 and mails[0]["body"]["to"] == "ira@example.com", mails)
        check("follow-up: touches counted in the sheet", leads[1][14] == "1" and leads[1][15] and leads[6][14] == "1" and leads[3][14] == "0", leads)
        s.post("/webhook/salesOA-tick", {})
        time.sleep(3)
        check("follow-up: not repeated at once", len(s.calls("/sendMessage")) == 1 and len(s.calls("/hook/email")) == 1,
              s.calls("/sendMessage"))

        errors = [e for e in s.executions() if e[1] not in ("success",)]
        check("no failed executions", not errors, errors and s.last_error())
    print("\nfailed:", check.failed)
    sys.exit(1 if check.failed else 0)


if __name__ == "__main__":
    main()
