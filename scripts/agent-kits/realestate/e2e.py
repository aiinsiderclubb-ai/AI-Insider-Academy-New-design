"""End-to-end run of Real Estate Lead → Viewing in a local n8n against mock.js.

    python3 scripts/agent-kits/realestate/e2e.py
"""
import csv
import json
import subprocess
import sys
import tempfile
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from nk import stable_id, test_variant  # noqa: E402
from stand import _req  # noqa: E402
from patient_stand import PatientStand as Stand  # noqa: E402  (longer waits for a busy machine)
import build  # noqa: E402

N8N, MOCK = 5774, 5775
TOKEN, DEBUG = "tok-123456", "dbg-1"
H = {"x-agent-token": TOKEN, "x-agent-debug": DEBUG}
KYIV = ZoneInfo("Europe/Kyiv")


def as_webhook(t, name, path):
    n = next(n for n in t["nodes"] if n["name"] == name)
    n.update({"type": "n8n-nodes-base.webhook", "typeVersion": 2.1, "webhookId": stable_id(t["id"], name),
              "parameters": {"httpMethod": "POST", "path": path, "responseMode": "responseNode", "options": {}}})
    unwrap = name + " Body"
    t["nodes"].append({"id": stable_id(t["id"], unwrap), "name": unwrap, "type": "n8n-nodes-base.code", "typeVersion": 2,
                       "position": [n["position"][0], n["position"][1] + 80],
                       "parameters": {"jsCode": "return [{ json: $input.first().json.body }];"}})
    t["connections"][unwrap] = t["connections"].pop(name)
    t["connections"][name] = {"main": [[{"node": unwrap, "type": "main", "index": 0}]]}


def variant(wf, wf_id, path, anthropic=False):
    pre = json.loads(json.dumps(wf))
    pre["id"] = wf_id
    as_webhook(pre, "Follow-up Trigger", f"{wf_id}-followup")
    t = test_variant(pre, f"http://127.0.0.1:{MOCK}", wf_id)
    for n in t["nodes"]:
        if n["name"] == "Config":
            c = n["parameters"]["jsCode"]
            c = c.replace("'ЗАМЕНИТЕ_НА_ДЛИННУЮ_СЛУЧАЙНУЮ_СТРОКУ'", repr(TOKEN)).replace("debug_token: ''", f"debug_token: '{DEBUG}'")
            c = c.replace("'ВСТАВЬТЕ_ID_ТАБЛИЦЫ'", "'SHEET1'").replace("'ВСТАВЬТЕ_ID_ЧАТА'", "'-100777'")
            n["parameters"]["jsCode"] = c
        if n["name"] == "Webhook":
            n["parameters"]["path"] = path
    if anthropic:
        t["connections"].pop("OpenAI Chat Model")
        t["connections"]["Anthropic Chat Model"] = {"ai_languageModel": [[{"node": "AI Agent", "type": "ai_languageModel", "index": 0}]]}
    return t


def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  → {str(detail)[:1500]}"))
    if not cond:
        check.failed += 1


check.failed = 0


def utc_iso(d, hm):
    h, m = map(int, hm.split(":"))
    return datetime(d.year, d.month, d.day, h, m, tzinfo=KYIV).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


def next_weekday():
    d = datetime.now(KYIV).date() + timedelta(days=1)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


def load(s):
    s.reset()
    rows = lambda name: list(csv.reader(open(build.OUT / "templates" / name, encoding="utf-8")))
    s.sheet("Listings", rows("listings.csv"))
    s.sheet("Leads", rows("leads-header.csv"))
    s.sheet("Viewings", rows("viewings-header.csv"))
    s.sheet("Log", rows("log-header.csv"))


def run(s, path, label, wf_id, extra=False):
    load(s)
    day = next_weekday()
    ds = day.isoformat()
    _req("POST", s.mock + "/__events", [{"id": "busy1", "status": "confirmed", "summary": "Встреча",
                                         "start": {"dateTime": utc_iso(day, "10:00")}, "end": {"dateTime": utc_iso(day, "12:00")}}])
    s.script(
        {"match": "ищу 2-комнатную квартиру на печерске", "steps": [
            {"tool": "update_lead", "args": {"deal_type": "buy", "property_type": "apartment", "area": "Печерский", "rooms": "2", "budget_max": 150000,
                                             "currency": "USD", "timeline": "now", "mortgage": "cash", "name": "Анна", "phone": "+380501112233", "email": "", "notes": ""}},
            {"final": "segment={{result.segment}} agent={{result.agent}} missing={{result.missing}}"}]},
        {"match": "покажите варианты", "steps": [
            {"tool": "search_listings", "args": {"deal_type": "buy", "property_type": "apartment", "area": "Печерский", "rooms": "2", "budget_max": 150000, "listing_ref": ""}},
            {"final": "Вариант: {{result.listings.0.listing_id}} ({{result.listings.0.why}}); всего {{result.listings}}"}]},
        {"match": "расскажи про kv-101", "steps": [{"final": "KV-101 — двухкомнатная на Лескова."}]},
        {"match": "можно посмотреть kv-101", "steps": [
            {"tool": "check_viewing_slots", "args": {"listing_id": "KV-101", "date": ds}},
            {"final": "first={{result.slots.0.slot_start}} available={{result.available}}"}]},
        {"match": "давайте в 12:30", "steps": [
            {"tool": "book_viewing", "args": {"listing_id": "KV-101", "slot_start": f"{ds}T12:30", "name": "", "phone": ""}},
            {"final": "{{result.error}}"}]},
        {"match": "да, записывайте", "steps": [
            {"tool": "book_viewing", "args": {"listing_id": "KV-101", "slot_start": f"{ds}T12:30", "name": "", "phone": ""}},
            {"final": "ok={{result.ok}} already={{result.already}} {{result.spoken}}"}]},
        {"match": "да, подтверждаю", "steps": [
            {"tool": "book_viewing", "args": {"listing_id": "KV-101", "slot_start": f"{ds}T12:30", "name": "Олег", "phone": "+380671112233"}},
            {"final": "error={{result.error}} alt={{result.slots.0.slot_start}}"}]},
        {"match": "а есть что-то ещё", "steps": [{"final": "Есть ещё KV-999 за 100000."}]},
        {"match": "интересует эта квартира", "steps": [
            {"tool": "search_listings", "args": {"deal_type": "", "property_type": "", "area": "", "rooms": "", "budget_max": 0, "listing_ref": "KV-104"}},
            {"final": "{{result.listings.0.listing_id}}: {{result.listings.0.why}}"}]},
        {"match": "владелец уступит в цене", "steps": [
            {"tool": "handoff_to_human", "args": {"reason": "Вопрос о торге", "summary": "Клиент спрашивает про торг по KV-101", "urgency": "normal"}},
            {"final": "Передал риелтору."}]},
        {"match": "точно одобрят ипотеку", "steps": [{"final": "Да, ипотеку вам точно одобрят."}]},
        {"match": "календарь сломался", "steps": [
            {"tool": "check_viewing_slots", "args": {"listing_id": "KV-101", "date": ds}}, {"final": "Извините, не вижу время."}]},
        {"match": "привет из телеграма, ищу аренду", "steps": [{"final": "Какой район <b>интересует</b>?"}]},
        {"match": "карта 4111", "steps": [{"final": "Данные карты не нужны."}]},
    )
    ask = lambda sid, msg, **extra: s.post(f"/webhook/{path}", {"session_id": sid, "message": msg, **extra}, H)

    before = len(s.calls("/sendMessage"))
    code, r = ask("anna-001", "Ищу 2-комнатную квартиру на Печерске для покупки, бюджет 150000$, наличные, Анна +380501112233")
    leads = s.read_sheet("Leads")
    tg = s.calls("/sendMessage")[before:]
    check(f"{label}: lead qualified, scored 100, routed to Maria", code == 200 and "segment=hot agent=Мария" in r.get("reply", "")
          and len(leads) == 2 and leads[1][17] == "100" and leads[1][19] == "maria" and leads[1][20] == "qualified", (r, leads))
    check(f"{label}: hot lead alert", len(tg) == 1 and "Горячий лид 100/100" in tg[0]["body"]["text"] and "Мария" in tg[0]["body"]["text"], tg)

    code, r = ask("anna-001", "Покажите варианты")
    leads = s.read_sheet("Leads")
    reply = r.get("reply", "")
    check(f"{label}: match from the sheet only, sold and over-budget left out", "KV-101" in reply and "KV-107" not in reply and "KV-102" not in reply
          and "в бюджете" in reply, reply)
    check(f"{label}: lead marked matched with shown listings", leads[1][20] == "matched" and "KV-101" in leads[1][21], leads[1])

    code, r = ask("anna-001", "Расскажи про KV-101")
    check(f"{label}: a listing shown earlier may be named later", "unknown_listing" not in r.get("flags", []) and "KV-101" in r.get("reply", ""), r)

    code, r = ask("anna-001", "Можно посмотреть KV-101?")
    check(f"{label}: slots skip the realtor's meeting plus buffer", f"first={ds}T12:30 available=true" == r.get("reply"), r)

    code, r = ask("anna-001", "Давайте в 12:30")
    check(f"{label}: no booking without an explicit yes", r.get("reply") == "not_confirmed" and not [e for e in _req("GET", s.mock + "/__events")[1] if e["id"] != "busy1"], r)

    before = len(s.calls("/sendMessage"))
    code, r = ask("anna-001", "Да, записывайте")
    events = [e for e in _req("GET", s.mock + "/__events")[1] if e["id"] != "busy1"]
    views = s.read_sheet("Viewings")
    leads = s.read_sheet("Leads")
    tg = s.calls("/sendMessage")[before:]
    check(f"{label}: viewing booked in the realtor's calendar", "ok=true" in r.get("reply", "") and len(events) == 1
          and events[0]["extendedProperties"]["private"]["listing_id"] == "KV-101" and "+380501112233" in events[0]["description"], (r, events))
    check(f"{label}: viewing row and lead stage", len(views) == 2 and views[1][2] == "KV-101" and views[1][3] == f"{ds}T12:30"
          and leads[1][20] == "viewing_booked" and leads[1][22] == events[0]["id"], (views, leads[1]))
    check(f"{label}: realtor notified", len(tg) == 1 and "Просмотр записан" in tg[0]["body"]["text"], tg)

    code, r = ask("anna-001", "Да, записывайте")
    events = [e for e in _req("GET", s.mock + "/__events")[1] if e["id"] != "busy1"]
    check(f"{label}: a repeated yes does not book twice", "already=true" in r.get("reply", "") and len(events) == 1 and len(s.read_sheet("Viewings")) == 2, (r, events))

    code, r = ask("oleg-0001", "Да, подтверждаю", phone="+380671112233")
    events = [e for e in _req("GET", s.mock + "/__events")[1] if e["id"] != "busy1"]
    check(f"{label}: a taken slot is refused with alternatives", r.get("reply", "").startswith("error=slot_taken alt=" + ds) and len(events) == 1, r)

    before = len(s.calls("/sendMessage"))
    code, r = ask("anna-001", "А есть что-то ещё?")
    tg = s.calls("/sendMessage")[before:]
    check(f"{label}: an invented listing never reaches the client", "KV-999" not in r.get("reply", "") and "unknown_listing" in r.get("flags", [])
          and len(tg) == 1 and "KV-999" in tg[0]["body"]["text"], (r, tg))

    code, r = s.post(f"/webhook/{path}", {"session_id": "portal-7781", "message": "Интересует эта квартира, когда можно посмотреть?",
                                          "source": "portal", "listing_ref": "KV-104", "phone": "+380931234567"}, H)
    check(f"{label}: portal lead starts from its listing", r.get("reply", "").startswith("KV-104") and "объект из заявки" in r.get("reply", ""), r)

    before = len(s.calls("/sendMessage"))
    code, r = ask("anna-002", "Владелец уступит в цене?")
    tg = s.calls("/sendMessage")[before:]
    check(f"{label}: bargaining goes to a realtor", r.get("handoff") is True and len(tg) == 1 and "торг" in tg[0]["body"]["text"], (r, tg))

    code, r = ask("anna-003", "А мне точно одобрят ипотеку?")
    check(f"{label}: mortgage promise replaced", "одобрят" not in r.get("reply", "") and "forbidden_promise" in r.get("flags", []), r)

    s.fail("freeBusy")
    before = len(s.calls("/sendMessage"))
    code, r = ask("anna-004", "Календарь сломался? Можно посмотреть")
    tg = s.calls("/sendMessage")[before:]
    s.fail(None)
    check(f"{label}: calendar failure alerts the team", "service_error" in r.get("flags", []) and any("check_viewing_slots" in t["body"]["text"] for t in tg), (r, tg))

    code, r = ask("anna-005", "Карта 4111 1111 1111 1111")
    sent = json.dumps((s.calls("/chat/completions") + s.calls("/v1/messages"))[-1:], ensure_ascii=False)
    check(f"{label}: card number never reaches the model", "4111 1111" not in sent and "card_removed" in r.get("flags", []), r)
    n = len(s.calls("/chat/completions") + s.calls("/v1/messages"))
    code, r = ask("anna-006", "Соедините с живым человеком")
    check(f"{label}: request for a person skips the model", r.get("handoff") is True and len(s.calls("/chat/completions") + s.calls("/v1/messages")) == n, r)
    code, r = s.post(f"/webhook/{path}", {"session_id": "x1-abcdef", "message": "hi"}, {"x-agent-token": "nope"})
    check(f"{label}: wrong token → 401", code == 401, (code, r))
    code, r = s.post(f"/webhook/{path}", {"session_id": "x", "message": "hi"}, H)
    check(f"{label}: bad session → 400", code == 400, (code, r))

    if extra:
        before = len(s.calls("/sendMessage"))
        upd = {"update_id": 1, "message": {"message_id": 5, "date": int(time.time()), "chat": {"id": 555, "type": "private"},
                                           "from": {"id": 555, "is_bot": False, "first_name": "Олег"}, "text": "Привет из телеграма, ищу аренду"}}
        s.post(f"/webhook/{wf_id}-telegram", upd)
        time.sleep(2)
        tg = s.calls("/sendMessage")[before:]
        check(f"{label}: telegram reply escaped to the client", len(tg) == 1 and str(tg[0]["body"]["chat_id"]) == "555" and "&lt;b&gt;" in tg[0]["body"]["text"], tg)

        # follow-up: a quiet Telegram lead, a quiet web lead, a viewing tomorrow
        head = s.read_sheet("Leads")[0]
        old = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        mk = lambda **kw: [kw.get(c, "") for c in head]
        tomorrow = (datetime.now(KYIV).date() + timedelta(days=1)).isoformat()
        s.sheet("Leads", [head,
                          mk(created=old, lead_id="RL-A", session_id="tg:777", channel="telegram", stage="matched", last_contact=old, follow_ups="0", agent_id="maria"),
                          mk(created=old, lead_id="RL-B", session_id="web:b1", channel="web", name="Ира", phone="+380991112233", stage="qualified",
                             last_contact=old, follow_ups="0", area="Оболонский", budget_max="90000", agent_id="pavel"),
                          mk(created=old, lead_id="RL-C", session_id="web:c1", channel="web", stage="viewing_booked", last_contact=old, follow_ups="0"),
                          mk(created=old, lead_id="RL-D", session_id="tg:999", channel="telegram", stage="matched",
                             last_contact=datetime.now(timezone.utc).isoformat(), follow_ups="0")])
        vh = s.read_sheet("Viewings")[0]
        s.sheet("Viewings", [vh, ["", "evt9", "KV-104", f"{tomorrow}T15:00", "pavel", "Пётр", "+380501234567", "tg:888", "ул. Героев Днепра, 31", "scheduled"]])
        before = len(s.calls("/sendMessage"))
        s.post(f"/webhook/{wf_id}-followup", {"timestamp": datetime.now(timezone.utc).isoformat(), "Day of week": "Friday", "Timezone": "Europe/Kyiv"})
        time.sleep(2)
        tg = s.calls("/sendMessage")[before:]
        to = {str(t["body"]["chat_id"]): t["body"]["text"] for t in tg}
        leads = s.read_sheet("Leads")
        check("follow-up: quiet Telegram lead gets the first reminder", "777" in to and "Подобрал для вас варианты" in to["777"] and "999" not in to, to)
        check("follow-up: viewing reminder to the client", "888" in to and "завтра в 15:00" in to["888"], to)
        check("follow-up: team gets calls to make and tomorrow's viewings", "-100777" in to and "Ира" in to["-100777"] and "KV-104" in to["-100777"]
              and "RL-C" not in to["-100777"], to.get("-100777"))
        check("follow-up: counters move on", leads[1][24] == "1" and leads[2][24] == "1" and leads[3][24] == "0" and leads[4][24] == "0", leads)

    log = s.read_sheet("Log")
    check(f"{label}: every answer logged with listings", len(log) > 10 and any("KV-101" in (row[8] if len(row) > 8 else "") for row in log), log[-2:])


def main():
    wf = build.build()
    oa = variant(wf, "reOA", "realty-agent")
    an = variant(wf, "reAN", "realty-agent-claude", anthropic=True)
    with Stand("realestate", N8N, MOCK) as s:
        s.load([oa, an])
        for p in ("/webhook/realty-agent", "/webhook/realty-agent-claude", "/webhook/reOA-telegram"):
            s.wait_webhook(p)
        run(s, "realty-agent", "openai", "reOA", extra=True)
        run(s, "realty-agent-claude", "anthropic", "reAN")

        # evals runner
        load(s)
        cases = {c["id"]: c for c in map(json.loads, (build.OUT / "evals" / "dataset.jsonl").read_text(encoding="utf-8").splitlines())}
        s.script({"match": cases["match-pechersk"]["turns"][0][:25], "steps": [
                     {"tool": "search_listings", "args": {"deal_type": "buy", "property_type": "apartment", "area": "Печерский", "rooms": "2", "budget_max": 150000, "listing_ref": ""}},
                     {"final": "{{result.listings.0.listing_id}} — {{result.listings.0.price}} USD"}]},
                 {"match": cases["no-invented-listings"]["turns"][0][:25], "steps": [{"final": "Есть KV-555 на Троещине за 40000."}]})
        ds = Path(tempfile.mkdtemp()) / "dataset.jsonl"
        ds.write_text("\n".join(json.dumps(cases[i], ensure_ascii=False) for i in ("match-pechersk", "no-invented-listings")), encoding="utf-8")
        out = subprocess.run([sys.executable, str(build.OUT / "evals" / "run_evals.py"), "--url", s.base + "/webhook/realty-agent",
                              "--token", TOKEN, "--debug-token", DEBUG, "--dataset", str(ds), "--delay", "0"], capture_output=True, text=True)
        print(out.stdout)
        check("evals runner: real match passes, invented listing caught by the guard", "PASS  match-pechersk" in out.stdout
              and "PASS  no-invented-listings" in out.stdout and out.returncode == 0, out.stdout + out.stderr)

        bad = [e for e in s.executions() if e[1] != "success"]
        check("no failed executions", not bad, bad and s.last_error())
    print("\nfailed:", check.failed)
    sys.exit(1 if check.failed else 0)


if __name__ == "__main__":
    main()
