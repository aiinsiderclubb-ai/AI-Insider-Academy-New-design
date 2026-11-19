"""End-to-end run of the restaurant and delivery voice kits in a local n8n against mock.js.

    python3 scripts/agent-kits/voice/e2e.py

Requests arrive in the Vapi, Retell and ElevenLabs formats exactly as those
providers send them; Google Calendar, Google Sheets and Telegram are the mock.
Ports 5730–5739.
"""
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))
from nk import stable_id, test_variant  # noqa: E402
from stand import Stand  # noqa: E402
import build_delivery  # noqa: E402
import build_restaurant  # noqa: E402

N8N, MOCK, BROKER = 5730, 5731, 5739
NOW = "2026-10-12T07:00:00Z"  # Monday, 10:00 in Kyiv
SECRET = {"x-test": "1"}  # the stand's Header Auth credential
CALLER = "+380501112233"


class VoiceStand(Stand):
    def env(self):
        e = super().env()
        e["N8N_RUNNERS_BROKER_PORT"] = str(BROKER)
        return e


def patch_config(wf, mock, extra):
    for n in wf["nodes"]:
        if n["name"] == "Config":
            c = n["parameters"]["jsCode"]
            c = c.replace('"https://www.googleapis.com/calendar/v3"', json.dumps(f"{mock}/calendar/v3"))
            c = c.replace('"https://sheets.googleapis.com/v4/spreadsheets"', json.dumps(f"{mock}/sheets/v4/spreadsheets"))
            c = c.replace('"https://api.vapi.ai"', json.dumps(f"{mock}/hook/vapi"))
            c = c.replace('"REPLACE_WITH_TELEGRAM_CHAT_ID"', '"-100555"').replace('"REPLACE_WITH_SPREADSHEET_ID"', '"SHEET1"')
            c = c.replace("return [{ json: {", "return [{ json: {\n  " + extra, 1)
            n["parameters"]["jsCode"] = c
    return wf


def variant(wf, wf_id, path, mock):
    t = test_variant(wf, mock, wf_id)
    for n in t["nodes"]:
        if n["type"] == "n8n-nodes-base.webhook":
            n["parameters"]["path"] = path
    return patch_config(t, mock, f'"now_override": "{NOW}",')


def calls_variant(wf, mock):
    t = test_variant(wf, mock, "deliveryCalls")
    for n in t["nodes"]:
        if n["type"] == "n8n-nodes-base.scheduleTrigger":
            n.update({"type": "n8n-nodes-base.webhook", "typeVersion": 2.1, "webhookId": stable_id("deliveryCalls", "run"),
                      "parameters": {"httpMethod": "POST", "path": "d-run-calls", "options": {}}})
        if n["name"] == "Read Orders":
            n["parameters"]["url"] = n["parameters"]["url"]
    # the variant has no schedule, so it may be published for the run
    return patch_config(t, mock, f'"now_override": "{NOW}",')


def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  → {str(detail)[:700]}"))
    if not cond:
        check.failed += 1


check.failed = 0


def wait_calls(s, path, before, want=1, seconds=15):
    """Telegram goes out after the webhook has answered: poll the mock instead of reading it at once."""
    for _ in range(seconds * 4):
        got = s.calls(path)[before:]
        if len(got) >= want:
            time.sleep(0.5)
            return s.calls(path)[before:]
        time.sleep(0.25)
    return s.calls(path)[before:]


def vapi(name, args, number=CALLER, call_id="call_1"):
    return {"message": {"type": "tool-calls", "toolCallList": [{"id": "tc_1", "type": "function", "function": {"name": name, "arguments": args}}],
                        "call": {"id": call_id, "customer": {"number": number}}}}


def result(res):
    return json.loads(res["results"][0]["result"])


def restaurant(s):
    path = "/webhook/r-voice-tools"
    post = lambda body, q="": s.post(path + q, body, SECRET)  # noqa: E731

    code, r = s.post(path, vapi("check_availability", {"guests": 2, "date": "tomorrow"}), {"x-test": "wrong"})
    check("restaurant: wrong secret refused", code in (401, 403), (code, r))

    code, r = post(vapi("check_availability", {"guests": 2, "date": "tomorrow"}))
    o = result(r)
    check("restaurant: couple offered the smallest table", code == 200 and o["available"] and o["slots"][0]["table_id"] == "t1"
          and o["slots"][0]["slot_start"] == "2026-10-13T12:00", o)

    before = len(s.calls("/sendMessage"))
    args = {"guests": 4, "slot_start": "2026-10-13T19:00", "customer_name": "Ира", "customer_phone": "050 111 22 33", "occasion": "день рождения", "consent": True}
    o = result(post(vapi("create_booking", args))[1])
    events = s.calls("/calendar/v3")
    ev = [c for c in events if c["method"] == "POST"]
    tg = wait_calls(s, "/sendMessage", before)
    check("restaurant: booking written with the party", o.get("ok") and o["table"] == "стол на четверых" and len(ev) == 1
          and ev[0]["body"]["extendedProperties"]["private"]["guests"] == "4" and ev[0]["body"]["summary"] == "Бронь: 4 гост. — Ира", (o, ev))
    check("restaurant: staff told in Telegram, as escaped HTML", len(tg) == 1 and "Новая бронь" in tg[0]["body"]["text"]
          and "Повод: день рождения" in tg[0]["body"]["text"] and tg[0]["body"].get("parse_mode") == "HTML", tg)
    o2 = result(post(vapi("create_booking", args))[1])
    check("restaurant: retried request books once", o2.get("booking_id") == o["booking_id"]
          and len([c for c in s.calls("/calendar/v3") if c["method"] == "POST"]) == 1, o2)

    n = len(s.calls("/calendar/v3"))
    o = result(post(vapi("check_availability", {"guests": 12, "date": "tomorrow"}))[1])
    check("restaurant: big party goes to a person, calendar untouched", o.get("error") == "party_too_large" and len(s.calls("/calendar/v3")) == n, o)

    retell = post({"name": "find_booking", "args": {"customer_phone": "0501112233"}, "call": {"call_id": "r1", "from_number": CALLER, "direction": "inbound"}})[1]
    check("restaurant: Retell finds the booking by phone", len(retell.get("bookings", [])) == 1 and retell["bookings"][0]["guests"] == "4", retell)
    bid = retell["bookings"][0]["booking_id"]

    eleven = post({"guests": "2", "date": "wed", "conversation_id": "e1", "caller_number": CALLER}, "?tool=check_availability")[1]
    check("restaurant: ElevenLabs flat body with the tool in the URL", eleven.get("available") is True and eleven.get("date") == "2026-10-14", eleven)

    o = result(post(vapi("cancel_booking", {"booking_id": bid, "customer_phone": CALLER}, number="+380990000000"))[1])
    check("restaurant: another number cannot cancel", o.get("error") == "caller_mismatch", o)

    o = result(post(vapi("reschedule_booking", {"booking_id": bid, "customer_phone": CALLER, "new_slot_start": "2026-10-13T19:00", "guests": 6}))[1])
    patch = [c for c in s.calls("/calendar/v3") if c["method"] == "PATCH"][-1:]
    check("restaurant: growing party moves to the big table", o.get("ok") and o.get("table") == "большой стол"
          and patch and patch[0]["body"]["extendedProperties"]["private"] == {"staff_id": "t5", "guests": "6"}, (o, patch))

    # Cancel a booking of its own: on PATCH the mock replaces extendedProperties, Google merges them.
    other = result(post(vapi("create_booking", dict(args, slot_start="2026-10-14T13:00"), call_id="call_9"))[1])
    o = result(post(vapi("cancel_booking", {"booking_id": other["booking_id"], "customer_phone": CALLER}))[1])
    ev = [e for e in s.calls("/calendar/v3") if e["method"] == "PATCH"][-1]
    check("restaurant: cancel marks the event cancelled", o.get("ok") and ev["body"] == {"status": "cancelled"}, (o, ev))

    wait_calls(s, "/sendMessage", len(s.calls("/sendMessage")) - 1)  # the cancel notice, sent after the answer
    time.sleep(2)
    s.fail("/calendar/")
    before = len(s.calls("/sendMessage"))
    o = result(post(vapi("check_availability", {"guests": 2, "date": "tomorrow"}))[1])
    tg = wait_calls(s, "/sendMessage", before)
    check("restaurant: calendar down → no invented slots, staff alerted", o.get("error") == "tool_unavailable" and "slots" not in o
          and len(tg) == 1 and "Сбой инструмента" in tg[0]["body"]["text"], (o, tg))
    s.fail(None)


HEAD = ["order_id", "phone", "customer_name", "city", "address", "apartment", "entrance", "floor", "intercom", "courier_note",
        "delivery_date", "window", "status", "items", "total", "payment", "confirmed", "confirmed_at", "calls", "last_call", "history"]


def row(**kw):
    base = dict(order_id="A-1001", phone="050 111 22 33", customer_name="Ира", city="Киев", address="улица Примерная, 5", apartment="12",
                delivery_date="2026-10-13", window="12-15", status="packed", items="Кофемолка", total="2400 грн", payment="оплачен", calls="0")
    base.update(kw)
    return [base.get(h, "") for h in HEAD]


def delivery(s):
    path = "/webhook/d-voice-tools"
    post = lambda body, q="": s.post(path + q, body, SECRET)  # noqa: E731
    busy = [row(order_id=f"X-{i}", phone="+380670000001", window="15-18", confirmed="да") for i in range(25)]
    s.sheet("Orders", [HEAD, row(), row(order_id="A-2", phone="+380671234567", delivery_date="2026-10-13", window="18-21")] + busy)
    get = lambda oid: dict(zip(HEAD, next(r for r in s.read_sheet("Orders") if r[0] == oid)))  # noqa: E731

    o = result(post(vapi("find_order", {"customer_phone": "0501112233"}))[1])
    check("delivery: finds the caller's order", o.get("ok") and o["orders"][0]["order_id"] == "A-1001"
          and o["orders"][0]["address"] == "Киев, улица Примерная, 5, квартира 12", o)

    o = result(post(vapi("find_order", {"customer_phone": CALLER}, number="+380990000000"))[1])
    check("delivery: another number sees nothing", o.get("error") == "caller_mismatch", o)

    o = result(post(vapi("change_items", {"order_id": "A-1001", "items": "ещё две пачки"}))[1])
    check("delivery: no way to change what was ordered", o.get("error") == "unknown_tool", o)

    o = result(post(vapi("confirm_delivery", {"order_id": "A-1001", "customer_phone": CALLER, "consent": True}))[1])
    check("delivery: confirmation written to the sheet", o.get("ok") and get("A-1001")["confirmed"] == "да"
          and "подтверждена" in get("A-1001")["history"], (o, get("A-1001")))

    before = len(s.calls("/sendMessage"))
    o = result(post(vapi("update_address", {"order_id": "A-1001", "customer_phone": CALLER, "city": "Бровары", "address": "улица Садовая, 3",
                                            "apartment": "7", "consent": True}))[1])
    tg = wait_calls(s, "/sendMessage", before)
    g = get("A-1001")
    check("delivery: address moved, operators told", o.get("ok") and g["city"] == "Бровары" and g["address"] == "улица Садовая, 3" and g["apartment"] == "7"
          and len(tg) == 1 and "Изменён адрес доставки" in tg[0]["body"]["text"], (o, g, tg))

    o = result(post(vapi("update_address", {"order_id": "A-1001", "customer_phone": CALLER, "city": "Львов", "address": "Рынок, 1", "consent": True}))[1])
    check("delivery: address outside the area refused", o.get("error") == "outside_zone" and get("A-1001")["city"] == "Бровары", o)

    o = result(post(vapi("check_windows", {"order_id": "A-1001", "customer_phone": CALLER, "date": "tomorrow"}))[1])
    check("delivery: full window not offered", [w["window_id"] for w in o.get("windows", [])] == ["09-12", "12-15", "18-21"], o)

    o = result(post(vapi("change_window", {"order_id": "A-1001", "customer_phone": CALLER, "date": "tomorrow", "window_id": "15-18", "consent": True}))[1])
    check("delivery: full window refused, old one kept", o.get("error") == "window_full" and get("A-1001")["window"] == "12-15", o)

    retell = post({"name": "change_window", "args": {"order_id": "A-1001", "customer_phone": CALLER, "date": "wed", "window_id": "18-21", "consent": True},
                   "call": {"call_id": "r2", "direction": "outbound", "from_number": "+380440000000", "to_number": CALLER}})[1]
    check("delivery: Retell outbound call moves the window", retell.get("ok") and get("A-1001")["delivery_date"] == "2026-10-14"
          and get("A-1001")["window"] == "18-21", (retell, get("A-1001")))

    s.fail("/sheets/")
    o = result(post(vapi("find_order", {"customer_phone": CALLER}))[1])
    check("delivery: sheet down → no invented order", o.get("error") == "tool_unavailable" and "orders" not in o, o)
    s.fail(None)

    # confirmation calls: A-2 is tomorrow, unconfirmed and has attempts left; A-1001 moved to Wednesday
    sheet_writes = len(s.calls(":batchUpdate"))
    code, r = s.post("/webhook/d-run-calls", {})
    wait_calls(s, ":batchUpdate", sheet_writes, seconds=40)
    vapi_calls = s.calls("/hook/vapi/call")
    check("calls: one call started at Vapi for tomorrow's unconfirmed order", len(vapi_calls) == 1
          and vapi_calls[0]["body"]["customer"]["number"] == "+380671234567"
          and vapi_calls[0]["body"]["assistantOverrides"]["variableValues"]["order_id"] == "A-2"
          and vapi_calls[0]["headers"].get("x-test") == "1", vapi_calls)
    g = get("A-2")
    check("calls: attempt recorded in the sheet", g["last_call"] == "2026-10-12T10:00" and "исходящий звонок" in g["history"], g)


def main():
    mock = f"http://127.0.0.1:{MOCK}"
    r_wf, _ = build_restaurant.build()
    d_wf = build_delivery.build()
    calls_wf = build_delivery.outbound_workflow()
    with VoiceStand("voice", N8N, MOCK) as s:
        s.load([variant(r_wf, "restaurantTools", "r-voice-tools", mock), variant(d_wf, "deliveryTools", "d-voice-tools", mock), calls_variant(calls_wf, mock)])
        for p in ("/webhook/r-voice-tools", "/webhook/d-voice-tools"):
            s.wait_webhook(p)
        s.reset()
        restaurant(s)
        s.reset()
        delivery(s)
        errors = [e for e in s.executions() if e[1] != "success"]
        check("no failed executions", not errors, errors and s.last_error())
    print("\nfailed:", check.failed)
    sys.exit(1 if check.failed else 0)


if __name__ == "__main__":
    main()
