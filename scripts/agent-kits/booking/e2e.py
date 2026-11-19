"""End-to-end run of the Appointment Booking Agent in a local n8n against mock.js.

    python3 scripts/agent-kits/booking/e2e.py
"""
import json
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from nk import test_variant, stable_id  # noqa: E402
from stand import Stand  # noqa: E402
import build  # noqa: E402

N8N, MOCK = 5750, 5751
MOCK_URL = f"http://127.0.0.1:{MOCK}"
TOKEN, DEBUG = "tok-booking-1", "dbg-b"
H = {"x-agent-token": TOKEN, "x-agent-debug": DEBUG}
KYIV = ZoneInfo("Europe/Kyiv")


def variant(wf, wf_id, path, anthropic=False):
    wf = json.loads(json.dumps(wf))
    for n in wf["nodes"]:
        if n["type"] == "n8n-nodes-base.emailSend":  # SMTP has no stand credential: record the mail instead
            n.update({"type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "credentials": {}})
            n.pop("credentials")
            n["parameters"] = {"method": "POST", "url": f"{MOCK_URL}/hook/email", "sendBody": True, "specifyBody": "json",
                               "jsonBody": "={{ JSON.stringify({ to: $json.email, subject: $json.subject, text: $json.text }) }}", "options": {}}
    t = test_variant(wf, MOCK_URL, wf_id)
    for n in t["nodes"]:
        if n["name"] == "Config":
            c = n["parameters"]["jsCode"]
            c = c.replace("'ЗАМЕНИТЕ_НА_ДЛИННУЮ_СЛУЧАЙНУЮ_СТРОКУ'", repr(TOKEN)).replace("debug_token: ''", f"debug_token: '{DEBUG}'")
            c = c.replace("'ВСТАВЬТЕ_ID_ТАБЛИЦЫ'", "'SHEET1'").replace("'ВСТАВЬТЕ_ID_ЧАТА'", "'-100777'")
            c = c.replace("calendar_api_base: 'https://www.googleapis.com/calendar/v3'", f"calendar_api_base: '{MOCK_URL}/calendar/v3'")
            for d in ("mon", "tue", "wed", "thu", "fri"):
                c = c.replace(f"{d}: {{ open: '09:00', close: '18:00' }}", f"{d}: {{ open: '00:00', close: '23:30' }}")
            c = c.replace("fri: { open: '09:00', close: '17:00' }", "fri: { open: '00:00', close: '23:30' }")
            c = c.replace("sat: null,", "sat: { open: '00:00', close: '23:30' },").replace("sun: null,", "sun: { open: '00:00', close: '23:30' },")
            c = c.replace("lead_time_min: 120", "lead_time_min: 0").replace("email_reminders: false", "email_reminders: true")
            n["parameters"]["jsCode"] = c
        if n["name"] == "Webhook":
            n["parameters"]["path"] = path
    if anthropic:
        t["connections"].pop("OpenAI Chat Model")
        t["connections"]["Anthropic Chat Model"] = {"ai_languageModel": [[{"node": "AI Agent", "type": "ai_languageModel", "index": 0}]]}
    else:
        # a webhook that stands in for the 15-minute schedule
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


def events(s):
    return [e for e in json.loads(json.dumps(s_get(s, "/__events"))) if e.get("status") != "cancelled"]


def s_get(s, path):
    import urllib.request
    with urllib.request.urlopen(s.mock + path) as r:
        return json.loads(r.read().decode())


def main():
    wf = build.build()
    oa = variant(wf, "bookOA", "booking-agent")
    an = variant(wf, "bookAN", "booking-agent-claude", anthropic=True)
    day = (datetime.now(KYIV) + timedelta(days=2)).strftime("%Y-%m-%d")
    slot = f"{day}T10:00"
    with Stand("booking", N8N, MOCK) as s:
        s.load([oa, an])
        for p in ("/webhook/booking-agent", "/webhook/booking-agent-claude", "/webhook/bookOA-telegram", "/webhook/bookOA-tick"):
            s.wait_webhook(p)
        for path, label in (("booking-agent", "openai"), ("booking-agent-claude", "anthropic")):
            s.reset()
            s.script(
                {"match": "какие у вас услуги", "steps": [{"tool": "list_services", "args": {"topic": ""}},
                                                        {"final": "{{result.services.1.name}} — {{result.services.1.price}}"}]},
                {"match": "когда свободно", "steps": [{"tool": "check_availability", "args": {"service_id": "consultation", "date": day, "part_of_day": "morning", "client_timezone": "Europe/Warsaw"}},
                                                     {"final": "{{result.slots.0.slot_start}}|{{result.slots.0.client_time}}"}]},
                {"match": "запишите меня на десять", "steps": [{"tool": "book_appointment", "args": {"service_id": "consultation", "slot_start": slot, "name": "Анна", "email": "anna@example.com", "phone": "", "notes": ""}},
                                                              {"final": "{{result.error}}"}]},
                {"match": "да, подтверждаю", "steps": [{"tool": "book_appointment", "args": {"service_id": "consultation", "slot_start": slot, "name": "Анна", "email": "anna@example.com", "phone": "", "notes": "сайт"}},
                                                      {"final": "Записал. Код {{result.booking_code}}"}]},
                {"match": "да, на то же время", "steps": [{"tool": "book_appointment", "args": {"service_id": "intro_call", "slot_start": f"{day}T10:30", "name": "Олег", "email": "oleg@example.com", "phone": "", "notes": ""}},
                                                         {"final": "{{result.error}}|{{result.slots.0.slot_start}}"}]},
            )
            code, r = ask(s, path, "bk-services", "Какие у вас услуги?")
            check(f"{label}: services from Config", r.get("reply") == "Консультация, 60 минут — 80 €", r)
            code, r = ask(s, path, "bk-free", "Когда свободно в четверг утром?")
            first, client = (r.get("reply") or "|").split("|", 1)
            check(f"{label}: free slots in business time, client time added", first.startswith(day + "T0") and client, r)
            code, r = ask(s, path, "bk-anna", "Запишите меня на десять")
            check(f"{label}: no booking without an explicit yes", r.get("reply") == "not_confirmed" and not events(s), (r, events(s)))
            before = len(s.calls("/sendMessage"))
            code, r = ask(s, path, "bk-anna", "Да, подтверждаю")
            ev = events(s)
            codeval = r.get("booking_code", "")
            check(f"{label}: booking created after yes", len(ev) == 1 and len(codeval) == 6 and codeval in r.get("reply", "")
                  and ev[0]["extendedProperties"]["private"]["code"] == codeval and ev[0]["attendees"][0]["email"] == "anna@example.com", (r, ev))
            tg = s.calls("/sendMessage")[before:]
            check(f"{label}: team told about the booking", len(tg) == 1 and "Новая запись" in tg[0]["body"]["text"] and codeval in tg[0]["body"]["text"], tg)
            code, r = ask(s, path, "bk-anna", "Да, подтверждаю")
            check(f"{label}: retried call does not book twice", len(events(s)) == 1 and r.get("booking_code") == codeval, (r, events(s)))
            code, r = ask(s, path, "bk-oleg", "Да, на то же время")
            err, alt = (r.get("reply") or "|").split("|", 1)
            check(f"{label}: overlapping slot refused with alternatives (buffer)", err == "slot_taken" and alt and len(events(s)) == 1, r)

            s.script(
                {"match": "найдите запись", "steps": [{"tool": "find_booking", "args": {"booking_code": codeval.lower()}},
                                                     {"final": "{{result.booking.service}} {{result.booking.slot_start}}"}]},
                {"match": "найдите чужую запись", "steps": [{"tool": "find_booking", "args": {"booking_code": "ZZZZZZ"}}, {"final": "{{result.error}}"}]},
                {"match": "да, переносите", "steps": [{"tool": "reschedule_booking", "args": {"booking_code": codeval, "new_slot_start": f"{day}T14:00", "client_timezone": ""}},
                                                     {"final": "{{result.slot_start}}"}]},
                {"match": "да, отменяйте", "steps": [{"tool": "cancel_booking", "args": {"booking_code": codeval, "reason": "заболел"}},
                                                    {"final": "{{result.ok}}"}]},
            )
            code, r = ask(s, path, "bk-anna2", "Найдите запись, пожалуйста")
            check(f"{label}: find by code", r.get("reply") == f"Консультация, 60 минут {slot}", r)
            code, r = ask(s, path, "bk-anna2", "Найдите чужую запись")
            check(f"{label}: unknown code reveals nothing", r.get("reply") == "booking_not_found", r)
            code, r = ask(s, path, "bk-anna2", "Да, переносите")
            ev = events(s)
            check(f"{label}: rescheduled", r.get("reply") == f"{day}T14:00" and len(ev) == 1
                  and datetime.fromisoformat(ev[0]["start"]["dateTime"].replace("Z", "+00:00")).astimezone(KYIV).hour == 14, (r, ev))
            code, r = ask(s, path, "bk-anna2", "Да, отменяйте")
            check(f"{label}: cancelled", r.get("reply") == "true" and not events(s), (r, events(s)))

            s.script({"match": "календарь лежит", "steps": [{"tool": "check_availability", "args": {"service_id": "consultation", "date": day, "part_of_day": "any", "client_timezone": ""}},
                                                           {"final": "Извините, календарь недоступен."}]})
            s.fail("/calendar/")
            before = len(s.calls("/sendMessage"))
            code, r = ask(s, path, "bk-down", "Календарь лежит? Когда свободно?")
            tg = s.calls("/sendMessage")[before:]
            check(f"{label}: calendar outage alerts the team", "service_error" in r.get("flags", []) and len(tg) == 1 and "Ошибка инструмента" in tg[0]["body"]["text"], (r, tg))
            s.fail(None)

            code, r = s.post(f"/webhook/{path}", {"session_id": "bk-x123", "message": "hi"}, {"x-agent-token": "nope"})
            check(f"{label}: wrong token → 401", code == 401, code)

        # ---- Telegram booking and reminders (OpenAI variant) ----
        s.reset()
        now = datetime.now(KYIV)
        soon = (now + timedelta(minutes=90 - now.minute % 30)).replace(second=0, microsecond=0)
        soon_slot = soon.strftime("%Y-%m-%dT%H:%M")
        s.script({"match": "да, записывайте", "steps": [{"tool": "book_appointment", "args": {"service_id": "intro_call", "slot_start": soon_slot, "name": "Олег", "email": "", "phone": "", "notes": ""}},
                                                       {"final": "Код {{result.booking_code}}"}]})
        upd = {"update_id": 9, "message": {"message_id": 3, "date": int(time.time()), "chat": {"id": 4242, "type": "private"},
                                           "from": {"id": 4242, "is_bot": False, "first_name": "Олег", "username": "oleg"}, "text": "Да, записывайте"}}
        s.post("/webhook/bookOA-telegram", upd)
        time.sleep(2)
        ev = events(s)
        check("telegram: booking without email in Telegram", len(ev) == 1 and ev[0]["extendedProperties"]["private"]["chat_id"] == "4242", ev)
        sent_before = [c for c in s.calls("/sendMessage") if str(c["body"].get("chat_id")) == "4242"]
        s.post("/webhook/bookOA-tick", {})
        time.sleep(3)
        sent = [c for c in s.calls("/sendMessage") if str(c["body"].get("chat_id")) == "4242"][len(sent_before):]
        ev = events(s)
        check("reminders: one reminder to the customer's Telegram", len(sent) == 1 and "Напоминаем" in sent[0]["body"]["text"]
              and ev[0]["extendedProperties"]["private"]["reminded"] == "h24,h2", (sent, ev))
        s.post("/webhook/bookOA-tick", {})
        time.sleep(3)
        again = [c for c in s.calls("/sendMessage") if str(c["body"].get("chat_id")) == "4242"][len(sent_before) + 1:]
        check("reminders: not repeated", not again, again)

        # a web booking with email gets its reminder by email
        s.script({"match": "да, по почте", "steps": [{"tool": "book_appointment", "args": {"service_id": "intro_call", "slot_start": (soon + timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M"), "name": "Ира", "email": "ira@example.com", "phone": "", "notes": ""}},
                                                    {"final": "ok"}]})
        ask(s, "booking-agent", "bk-ira", "Да, по почте")
        s.post("/webhook/bookOA-tick", {})
        time.sleep(3)
        mails = s.calls("/hook/email")
        check("reminders: email for a web booking", len(mails) == 1 and mails[0]["body"]["to"] == "ira@example.com", mails)

        errors = [e for e in s.executions() if e[1] not in ("success",)]
        check("no failed executions", not errors, errors and s.last_error())
    print("\nfailed:", check.failed)
    sys.exit(1 if check.failed else 0)


if __name__ == "__main__":
    main()
