"""End-to-end run of the Revenue Recovery Agent in a local n8n.

    python3 scripts/agent-kits/recovery/e2e.py
"""
import email
import json
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from email import policy
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import nk  # noqa: E402
import stand as standmod  # noqa: E402
from stand import Stand, _req  # noqa: E402
import build  # noqa: E402


class Stand(Stand):  # noqa: F811
    """The shared stand waits 120 s for n8n; on a loaded machine (several stands at once) it needs longer."""

    def load(self, workflows, publish=None):
        import stand as _s
        orig = _s.time.sleep
        calls = {"n": 0}

        def patient(sec):
            calls["n"] += 1
            orig(sec * 4 if sec == 1 and calls["n"] <= 120 else sec)

        _s.time.sleep = patient
        try:
            return super().load(workflows, publish)
        finally:
            _s.time.sleep = orig

N8N, MOCK, EXT = 5764, 5765, 5766
SMTP = EXT + 1
EXTURL = f"http://127.0.0.1:{EXT}"
PREVIEW = "prev-123"
APPROVER = "-100900"

nk.TEST_CREDS.update({"smtp": "t-smtp"})
_base = standmod.test_credentials
standmod.test_credentials = lambda mock: _base(mock) + [
    {"id": "t-smtp", "name": "smtp", "type": "smtp", "data": {"user": "u", "password": "p", "host": "127.0.0.1", "port": SMTP, "secure": False, "disableStartTls": True}}]

INV_HEAD = ["invoice_id", "client", "contact_name", "email", "amount", "currency", "issued", "due", "status", "paid_at",
            "promise_date", "disputed", "paused", "last_contact", "stage", "notes"]
DRAFT_HEAD = ["draft_id", "created", "invoice_id", "step", "tone", "risk", "reasons", "to", "subject", "body", "status", "decided_at", "decided_by"]


def d(days):
    return (datetime.now(timezone.utc) + timedelta(hours=2) - timedelta(days=days)).strftime("%Y-%m-%d")


def invoices():
    return [INV_HEAD,
            ["INV-101", "ООО Альфа", "Ольга", "olga@alpha.example", "1200", "EUR", d(32), d(2), "open", "", "", "", "", "", "0", ""],
            ["INV-102", "Бета Студио", "Игорь", "igor@beta.example", "3400", "EUR", d(40), d(10), "open", "", "", "", "", d(5), "1", ""],
            ["INV-103", "Гамма", "", "g@gamma.example", "500", "EUR", d(40), d(10), "paid", d(1), "", "", "", "", "0", ""],
            ["INV-104", "Дельта", "", "d@delta.example", "700", "EUR", d(40), d(10), "open", "", "", "yes", "", "", "0", ""],
            ["INV-105", "Эпсилон", "", "e@eps.example", "900", "EUR", d(40), d(10), "open", "", d(-5), "", "", "", "0", ""],
            ["INV-106", "Зета Групп", "Марк", "mark@zeta.example", "8000", "EUR", d(70), d(40), "open", "", d(3), "", "", d(10), "2", "обещал оплатить после сделки"],
            ["INV-107", "Эта", "", "eta@eta.example", "300", "EUR", d(33), d(3), "open", "", "", "", "", d(1), "0", ""],
            ["INV-108", "Тета", "", "t@theta.example", "450", "EUR", d(33), d(3), "open", "", "", "", "", "", "0", ""],
            ["INV-109", "Йота", "Лена", "lena@iota.example", "2100,50", "EUR", d(35), d(5), "open", "", "", "", "", "", "0", ""],
            # history for the risk rules: Зета paid late twice before
            ["INV-090", "Зета Групп", "", "mark@zeta.example", "1000", "EUR", d(200), d(180), "paid", d(150), "", "", "", "", "0", ""],
            ["INV-091", "Зета Групп", "", "mark@zeta.example", "1000", "EUR", d(150), d(120), "paid", d(100), "", "", "", "", "0", ""]]


def drafts():
    return [DRAFT_HEAD, ["D-OLD8", d(1), "INV-108", "1", "friendly", "low", "", "t@theta.example", "s", "b", "pending", "", ""]]


def good(inv, amount, extra=""):
    return json.dumps({"risk": "low", "reasons": ["первая просрочка"], "subject": f"Счёт {inv}: напоминание",
                       "body": f"Ольга, добрый день! Напоминаем о счёте {inv} на {amount} EUR. Подскажите, когда планируете оплату?{extra}"}, ensure_ascii=False)


SCRIPTS = [
    {"match": "счёт: inv-101\n", "steps": [{"final": good("INV-101", "1 200")}]},
    {"match": "счёт: inv-102\n", "steps": [{"final": json.dumps({"risk": "medium", "reasons": ["вторая просьба"], "subject": "Счёт INV-102",
                                                               "body": "Игорь, счёт INV-102 на 3 400 EUR просрочен. Иначе обратимся в суд."}, ensure_ascii=False)}]},
    {"match": "счёт: inv-106\n", "steps": [{"final": json.dumps({"risk": "low", "reasons": ["всё нормально"], "subject": "Счёт INV-106",
                                                               "body": "Марк, напоминаем про счёт INV-106. Давайте созвонимся и обсудим график."}, ensure_ascii=False)}]},
    {"match": "счёт: inv-109\n", "steps": [{"final": "Конечно! Вот письмо: Лена, оплатите, пожалуйста."}]},
]


def variant(wf, wf_id, suffix, anthropic=False):
    t = nk.test_variant(wf, f"http://127.0.0.1:{MOCK}", wf_id)
    for n in t["nodes"]:
        if n["name"] == "Config":
            c = n["parameters"]["jsCode"]
            for a, b in [("'ВСТАВЬТЕ_ID_ТАБЛИЦЫ'", "'SHEET1'"), ("['ВСТАВЬТЕ_ID_ЧАТА']", f"['{APPROVER}']"), ("preview_token: ''", f"preview_token: '{PREVIEW}'")]:
                assert a in c, a
                c = c.replace(a, b)
            n["parameters"]["jsCode"] = c
        if n["type"] == "n8n-nodes-base.webhook" and n["name"] == "Preview Webhook":
            n["parameters"]["path"] += suffix
        if n["type"] == "n8n-nodes-base.scheduleTrigger":
            n["type"], n["typeVersion"] = "n8n-nodes-base.webhook", 2.1
            n["parameters"] = {"httpMethod": "POST", "path": f"{wf_id}-{'monitor' if 'Day' in n['name'] else 'report'}", "responseMode": "responseNode", "options": {}}
            n["webhookId"] = nk.stable_id(wf_id, n["name"])
    if anthropic:
        t["connections"].pop("OpenAI Chat Model")
        t["connections"]["Anthropic Chat Model"] = {"ai_languageModel": [[{"node": "Assess & Draft", "type": "ai_languageModel", "index": 0}]]}
    return t


def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  → {str(detail)[:800]}"))
    if not cond:
        check.failed += 1


check.failed = 0


def mails():
    out = []
    for m in _req("GET", EXTURL + "/__mail")[1]:
        msg = email.message_from_string(m["data"], policy=policy.default)
        body = msg.get_body(preferencelist=("plain",))
        out.append({"to": msg["To"], "subject": str(msg["Subject"]), "text": body.get_content() if body else ""})
    return out


def tg(s, path, update):
    s.post(f"/webhook/{path}", update)
    time.sleep(1.5)


def press(s, path, data, chat=APPROVER, uid=1):
    tg(s, path, {"update_id": int(time.time() * 1000) % 10**9, "callback_query": {"id": f"cb{time.time()}", "data": data,
        "from": {"id": uid, "first_name": "Анна"}, "message": {"message_id": 7, "chat": {"id": int(chat)}, "text": "card"}}})


def say(s, path, text, reply_to=None):
    m = {"message_id": 9, "chat": {"id": int(APPROVER)}, "from": {"id": 1, "first_name": "Анна"}, "text": text}
    if reply_to:
        m["reply_to_message"] = {"message_id": 8, "text": reply_to}
    tg(s, path, {"update_id": int(time.time() * 1000) % 10**9, "message": m})


def last_tg(s, before):
    return s.calls("/bot")[before:]


def run_monitor(s, wf_id, label):
    s.reset()
    _req("POST", EXTURL + "/__reset", {})
    s.sheet("Invoices", invoices())
    s.sheet("Drafts", drafts())
    s.sheet("Activity", [["time", "invoice_id", "action", "detail", "by"]])
    s.script(*SCRIPTS)
    before = len(s.calls("/bot"))
    s.post(f"/webhook/{wf_id}-monitor", {})
    time.sleep(2)
    rows = s.read_sheet("Drafts")
    new = {r[2]: r for r in rows[2:]}
    check(f"{label}: drafts only for invoices that are due", sorted(new) == ["INV-101", "INV-102", "INV-106", "INV-109"], sorted(new))
    cards = [c for c in last_tg(s, before) if c["path"].endswith("/sendMessage")]
    check(f"{label}: one card per draft, with three buttons", len(cards) == 4 and all(len(c["body"]["reply_markup"]["inline_keyboard"][0]) == 3 for c in cards)
          and all(str(c["body"]["chat_id"]) == APPROVER for c in cards), [c["body"].get("reply_markup") for c in cards])
    check(f"{label}: nothing is emailed without approval", mails() == [], mails())
    r101, r102, r106, r109 = new.get("INV-101"), new.get("INV-102"), new.get("INV-106"), new.get("INV-109")
    check(f"{label}: model draft kept, payment details and signature added",
          r101 and "INV-101" in r101[9] and "Подскажите, когда планируете оплату" in r101[9] and "https://example.com/pay" in r101[9] and r101[4] == "friendly", r101)
    check(f"{label}: threat replaced by the template", r102 and "суд" not in r102[9] and r102[4] == "firm" and "просрочен на 10 дн." in r102[9], r102)
    check(f"{label}: model cannot lower the rule risk; missing amount → template",
          r106 and r106[5] == "high" and r106[4] == "escalate" and "8 000 EUR" in r106[9] and "обещание оплатить" in r106[6], r106)
    check(f"{label}: non-JSON answer → template, amount with decimals", r109 and "2 100,50 EUR" in r109[9], r109)
    return new


def main():
    wf = build.build()
    va = variant(wf, "recA", "")
    vb = variant(wf, "recB", "-b", anthropic=True)
    ext = subprocess.Popen(["node", str(HERE.parent / "ecom" / "ext_mock.cjs"), str(EXT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        with Stand("recovery", N8N, MOCK) as s:
            s.load([va, vb])
            for p in ("recA-monitor", "recB-monitor", "recA-report", "recA-telegram", "recovery-preview", "recovery-preview-b"):
                s.wait_webhook("/webhook/" + p)
            time.sleep(1)

            run_monitor(s, "recB", "anthropic")
            new = run_monitor(s, "recA", "openai")
            path = "recA-telegram"

            # second run: drafts are waiting — nothing new
            before = len(s.read_sheet("Drafts"))
            s.post("/webhook/recA-monitor", {})
            time.sleep(2)
            check("monitor: a waiting draft is not drafted again", len(s.read_sheet("Drafts")) == before, len(s.read_sheet("Drafts")))

            # stranger presses a button
            press(s, path, f"send:{new['INV-101'][0]}", chat="-1", uid=999)
            check("telegram: buttons from a stranger do nothing", mails() == [] and s.read_sheet("Drafts")[2][10] == "pending")

            # approve INV-101
            press(s, path, f"send:{new['INV-101'][0]}")
            m = mails()
            inv = {r[0]: r for r in s.read_sheet("Invoices")}
            dr = {r[0]: r for r in s.read_sheet("Drafts")}
            check("send: email goes out only after the button", len(m) == 1 and m[0]["to"] == "olga@alpha.example" and "INV-101" in m[0]["text"]
                  and "С уважением" in m[0]["text"], m)
            check("send: invoice stage and last contact updated, draft marked sent",
                  inv["INV-101"][14] == "1" and inv["INV-101"][13] == d(0) and dr[new["INV-101"][0]][10] == "sent", (inv["INV-101"], dr[new["INV-101"][0]]))
            press(s, path, f"send:{new['INV-101'][0]}")
            check("send: pressing twice sends once", len(mails()) == 1)

            # /paid stops INV-102 and cancels its draft
            say(s, path, "/paid INV-102")
            press(s, path, f"send:{new['INV-102'][0]}")
            inv = {r[0]: r for r in s.read_sheet("Invoices")}
            dr = {r[0]: r for r in s.read_sheet("Drafts")}
            check("/paid: invoice closed, draft cancelled, nothing sent", inv["INV-102"][8] == "paid" and dr[new["INV-102"][0]][10] == "cancelled"
                  and len(mails()) == 1, (inv["INV-102"], dr[new["INV-102"][0]]))

            # paid outside the bot right before the button: re-check at send time
            rows = s.read_sheet("Invoices")
            for r in rows:
                if r[0] == "INV-109":
                    r[8], r[9] = "paid", d(0)
            s.sheet("Invoices", rows)
            b = len(s.calls("/bot"))
            press(s, path, f"send:{new['INV-109'][0]}")
            notes = [c["body"].get("text", "") for c in last_tg(s, b) if c["path"].endswith("/sendMessage")]
            check("send: invoice paid meanwhile → not sent, you are told why", len(mails()) == 1 and any("оплачен" in t for t in notes), notes)

            # edit INV-106: button, then a reply with new text
            b = len(s.calls("/bot"))
            press(s, path, f"edit:{new['INV-106'][0]}")
            asks = [c for c in last_tg(s, b) if c["path"].endswith("/sendMessage")]
            check("edit: asks for the new text as a reply", asks and asks[-1]["body"].get("reply_markup", {}).get("force_reply") is True, asks)
            b = len(s.calls("/bot"))
            say(s, path, "Марк, добрый день! Предлагаю разбить счёт INV-106 на два платежа. Удобно созвониться завтра?",
                reply_to=f"✏️ Черновик {new['INV-106'][0]}. Ответьте на это сообщение новым текстом письма")
            again = [c for c in last_tg(s, b) if c["path"].endswith("/sendMessage")]
            check("edit: new card with buttons", again and "reply_markup" in again[-1]["body"] and "разбить счёт" in again[-1]["body"]["text"], again)
            press(s, path, f"send:{new['INV-106'][0]}")
            m = mails()
            check("edit: the edited text is what goes out, with the signature", len(m) == 2 and "разбить счёт INV-106" in m[1]["text"]
                  and "https://example.com/pay" in m[1]["text"], m[-1:])

            # /promise, /status, /dispute, unknown
            say(s, path, "/promise INV-101 2099-01-15")
            inv = {r[0]: r for r in s.read_sheet("Invoices")}
            check("/promise: date saved", inv["INV-101"][10] == "2099-01-15", inv["INV-101"])
            b = len(s.calls("/bot"))
            say(s, path, "/status INV-101")
            st = [c["body"]["text"] for c in last_tg(s, b) if c["path"].endswith("/sendMessage")]
            check("/status: says why reminders stopped", st and "2099-01-15" in st[-1], st)
            say(s, path, "/dispute INV-107 не согласны с объёмом")
            inv = {r[0]: r for r in s.read_sheet("Invoices")}
            check("/dispute: flagged with the reason in notes", inv["INV-107"][11] == "yes" and "объёмом" in inv["INV-107"][15], inv["INV-107"])
            act = s.read_sheet("Activity")
            check("activity log keeps every decision", [r[2] for r in act[1:]] == ["sent", "paid", "not_sent", "edited", "sent", "promise", "dispute"], [r[2] for r in act[1:]])

            # preview webhook
            body = {"token": PREVIEW, "invoice": dict(zip(INV_HEAD, invoices()[6])), "history": [dict(zip(INV_HEAD, r)) for r in invoices()[10:]]}
            code, r = s.post("/webhook/recovery-preview", body)
            check("preview: rule risk and template answer without saving", code == 200 and r.get("risk") == "high" and r.get("tone") == "escalate"
                  and "8 000 EUR" in r.get("body", ""), (code, r))
            code, r = s.post("/webhook/recovery-preview-b", {"token": "x", "invoice": {}})
            check("preview: wrong token → 401", code == 401, (code, r))

            # weekly report
            b = len(s.calls("/bot"))
            s.post("/webhook/recA-report", {})
            time.sleep(2)
            rep = [c["body"]["text"] for c in last_tg(s, b) if c["path"].endswith("/sendMessage")]
            check("report: overdue, recovered and risky invoices", rep and "Просрочено" in rep[0] and "Вернулось после напоминаний" in rep[0]
                  and "INV-106" in rep[0], rep)

            # the evals runner, against the stand: two cases pass, one is built to fail
            import tempfile
            s.script({"match": "счёт: inv-e01\n", "steps": [{"final": json.dumps({"risk": "low", "reasons": ["первая"], "subject": "Счёт INV-E01: напоминание",
                      "body": "Ольга, добрый день! Напоминаем о счёте INV-E01 на 1 200 EUR. Подскажите, когда планируете оплату?"}, ensure_ascii=False)}]},
                     {"match": "счёт: inv-e02\n", "steps": [{"final": "не JSON"}]})
            ds = Path(tempfile.mkdtemp()) / "dataset.jsonl"
            cases = [json.loads(x) for x in (build.OUT / "evals" / "dataset.jsonl").read_text(encoding="utf-8").splitlines()]
            ds.write_text("\n".join(json.dumps(c, ensure_ascii=False) for c in cases if c["id"] in ("friendly-first", "contact-name", "stop-paid")), encoding="utf-8")
            run = subprocess.run([sys.executable, str(build.OUT / "evals" / "run_evals.py"), "--url", s.base + "/webhook/recovery-preview",
                                  "--token", PREVIEW, "--dataset", str(ds), "--delay", "0"], capture_output=True, text=True)
            print(run.stdout)
            check("evals runner: passes good drafts and catches a template fallback",
                  "Прошло 2 из 3" in run.stdout and "FAIL  contact-name" in run.stdout and run.returncode == 1, run.stdout + run.stderr)

            errors = [e for e in s.executions() if e[1] != "success"]
            if errors:
                import sqlite3
                from flatted import summary
                db = sqlite3.connect(s.dir / ".n8n" / "database.sqlite")
                for eid, _, _ in errors[:3]:
                    print(summary(db.execute("select data from execution_data where executionId=?", (eid,)).fetchone()[0]))
            check("no failed executions", not errors, errors)
    finally:
        ext.terminate()
    print("\nfailed:", check.failed)
    sys.exit(1 if check.failed else 0)


if __name__ == "__main__":
    main()
