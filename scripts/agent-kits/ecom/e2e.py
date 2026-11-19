"""End-to-end run of the E-commerce Support & Retention Engine in a local n8n.

Three variants side by side: Shopify + OpenAI, WooCommerce + Anthropic, Google Sheets + OpenAI.
Schedules become webhooks on the stand so the jobs can be started on demand.

    python3 scripts/agent-kits/ecom/e2e.py
"""
import email
import json
import subprocess
import sys
import time
import urllib.parse
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

N8N, MOCK, EXT = 5760, 5761, 5762
SMTP = EXT + 1
TOKEN, DEBUG, SECRET = "tok-ecom-1", "dbg-ecom", "unsub-secret-1"
H = {"x-agent-token": TOKEN, "x-agent-debug": DEBUG}
EXTURL = f"http://127.0.0.1:{EXT}"

# credentials the shared stand does not know yet: SMTP and Basic Auth (WooCommerce)
nk.TEST_CREDS.update({"smtp": "t-smtp", "httpBasicAuth": "t-hb"})
_base_creds = standmod.test_credentials
standmod.test_credentials = lambda mock: _base_creds(mock) + [
    {"id": "t-smtp", "name": "smtp", "type": "smtp", "data": {"user": "u", "password": "p", "host": "127.0.0.1", "port": SMTP, "secure": False, "disableStartTls": True}},
    {"id": "t-hb", "name": "hb", "type": "httpBasicAuth", "data": {"user": "ck_test", "password": "cs_test"}},
]
_base_hh = None


def iso(**delta):
    return (datetime.now(timezone.utc) - timedelta(**delta)).strftime("%Y-%m-%dT%H:%M:%SZ")


def variant(wf, wf_id, suffix, platform, anthropic=False):
    t = nk.test_variant(wf, f"http://127.0.0.1:{MOCK}", wf_id)
    for n in t["nodes"]:
        if n["name"] == "Config":
            c = n["parameters"]["jsCode"]
            for a, b in [("'ЗАМЕНИТЕ_НА_ДЛИННУЮ_СЛУЧАЙНУЮ_СТРОКУ'", repr(TOKEN)), ("debug_token: ''", f"debug_token: '{DEBUG}'"),
                         ("'ЗАМЕНИТЕ_НА_ДРУГУЮ_СЛУЧАЙНУЮ_СТРОКУ'", repr(SECRET)), ("'ВСТАВЬТЕ_ID_ТАБЛИЦЫ'", "'SHEET1'"),
                         ("'ВСТАВЬТЕ_ID_ЧАТА'", "'-100555'"), ("platform: 'shopify'", f"platform: '{platform}'"),
                         ("'https://ВАШ-МАГАЗИН.myshopify.com'", repr(EXTURL + "/shopify")), ("'https://ВАШ-САЙТ.com'", repr(EXTURL + "/woo")),
                         ("'https://ВАШ-N8N'", repr(f"http://127.0.0.1:{N8N}")), ("quiet_hours: [22, 8]", "quiet_hours: [0, 0]"),
                         ("discount_code: ''", "discount_code: 'BACK10'")]:
                assert a in c, a
                c = c.replace(a, b)
            if platform == "sheets":
                c = c.replace("first_after_minutes: 60", "first_after_minutes: 0")
            n["parameters"]["jsCode"] = c
        if n["type"] == "n8n-nodes-base.webhook" and n["name"] != "Telegram Trigger":
            n["parameters"]["path"] = n["parameters"]["path"] + suffix
        if n["type"] == "n8n-nodes-base.scheduleTrigger":
            n["type"], n["typeVersion"] = "n8n-nodes-base.webhook", 2.1
            n["parameters"] = {"httpMethod": "POST", "path": f"{wf_id}-{'carts' if 'Minutes' in n['name'] else 'reviews'}",
                               "responseMode": "responseNode", "options": {}}
            n["webhookId"] = nk.stable_id(wf_id, n["name"])
        if n.get("credentials", {}).get("httpHeaderAuth"):
            n["credentials"]["httpHeaderAuth"] = {"id": "t-shop", "name": "shop"}
    if anthropic:
        t["connections"].pop("OpenAI Chat Model")
        t["connections"]["Anthropic Chat Model"] = {"ai_languageModel": [[{"node": "AI Agent", "type": "ai_languageModel", "index": 0}]]}
    return t


def shop_order(num, email_, delivered_days=None, tags=(), total="5400.00", items=None, updated_days=0, marketing="SUBSCRIBED"):
    items = items or [("Кофемолка Lumo C40", 1, "Техника", "lumo-c40")]
    return {
        "name": f"#{num}", "email": email_, "phone": "+380501112233", "createdAt": iso(days=20), "updatedAt": iso(days=updated_days),
        "cancelledAt": None, "displayFinancialStatus": "PAID", "displayFulfillmentStatus": "FULFILLED", "tags": list(tags),
        "totalPriceSet": {"shopMoney": {"amount": total, "currencyCode": "UAH"}},
        "customer": {"firstName": "Анна", "defaultEmailAddress": {"emailAddress": email_, "marketingState": marketing}},
        "lineItems": {"nodes": [{"title": t, "quantity": q, "product": {"productType": ty, "tags": [], "handle": h}} for t, q, ty, h in items]},
        "fulfillments": [{"displayStatus": "DELIVERED" if delivered_days is not None else "IN_TRANSIT",
                          "deliveredAt": iso(days=delivered_days) if delivered_days is not None else None,
                          "trackingInfo": [{"number": f"2045{num}", "url": "https://tracking.example/x", "company": "Nova Poshta"}]}],
    }


def checkout(cid, email_, hours, marketing="SUBSCRIBED", completed=False, title="Кофемолка Lumo C40"):
    return {"id": f"gid://shopify/AbandonedCheckout/{cid}", "abandonedCheckoutUrl": f"https://shop.example/recover/{cid}",
            "createdAt": iso(hours=hours + 1), "updatedAt": iso(hours=hours), "completedAt": iso(minutes=5) if completed else None,
            "customer": {"firstName": "Олег", "defaultEmailAddress": {"emailAddress": email_, "marketingState": marketing}},
            "totalPriceSet": {"shopMoney": {"amount": "3200.00", "currencyCode": "UAH"}},
            "lineItems": {"nodes": [{"title": title, "quantity": 1}]}}


def woo_order(num, email_, completed_days, status="completed"):
    return {"id": num, "number": str(num), "status": status, "currency": "UAH", "total": "1980.00",
            "date_created_gmt": iso(days=20)[:-1], "date_modified_gmt": iso(days=0)[:-1],
            "date_completed_gmt": iso(days=completed_days)[:-1] if completed_days is not None else None,
            "billing": {"email": email_, "phone": "+380671234567", "first_name": "Олег"},
            "line_items": [{"name": "Кофе Эфиопия 1 кг", "quantity": 2}], "meta_data": []}


SHOPIFY = {
    "orders": [
        shop_order(1001, "anna@example.com", 3),
        shop_order(1002, "anna@example.com", 40),
        shop_order(1003, "anna@example.com", 2, tags=["final-sale"]),
        shop_order(1004, "anna@example.com", 5, total="24900.00"),
        shop_order(1006, "ivan@example.com", 8, items=[("Кофемашина Brio 2", 1, "Техника", "brio-2")]),
        shop_order(1007, "maria@example.com", 8),
    ],
    "checkouts": [
        checkout(11, "oleg@example.com", 2),
        checkout(12, "nocons@example.com", 2, marketing="NOT_SUBSCRIBED"),
        checkout(13, "bought@example.com", 2, completed=True),
        checkout(14, "old@example.com", 100),
        checkout(15, "gone@example.com", 2),
        checkout(16, "kettle@example.com", 3, title="Чайник Fellow Stagg"),
        checkout(17, "second@example.com", 30),
    ],
    "woo": [woo_order(2001, "oleg@example.com", 3), woo_order(2002, "petr@example.com", 10)],
}

HEADERS = {
    "Policies": ["id", "question", "answer", "tags", "updated"],
    "Returns": ["created", "rma", "status", "decision", "order_id", "email", "items", "reason", "condition", "reasons", "session_id", "channel"],
    "Messages": ["time", "kind", "ref", "email", "step", "status", "subject", "detail"],
    "Suppress": ["time", "email", "source"],
    "Carts": ["time", "event", "cart_id", "email", "name", "consent", "items", "total", "currency", "checkout_url"],
    "Orders": ["order_id", "email", "phone", "status", "items", "total", "currency", "delivered_at", "tracking", "tags", "consent"],
}


def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  → {str(detail)[:700]}"))
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


def setup(s, orders_rows=None):
    s.reset()
    _req("POST", EXTURL + "/__reset", {})
    _req("POST", EXTURL + "/__shop", SHOPIFY)
    for tab, head in HEADERS.items():
        s.sheet(tab, [head])
    s.sheet("Policies", [HEADERS["Policies"], ["P-1", "Сколько идёт доставка?", "По Украине 1–3 дня, в Польшу 4–7 дней.", "доставка сроки", ""],
                         ["P-2", "Как вернуть товар?", "Возврат 14 дней с доставки, товар без следов использования.", "возврат обмен", ""]])
    s.sheet("Suppress", [HEADERS["Suppress"], [iso(days=1), "gone@example.com", "manual"]])
    s.sheet("Returns", [HEADERS["Returns"], [iso(days=1), "R-OLD1", "pending_review", "eligible", "1007", "maria@example.com", "", "", "", "", "", ""]])
    s.sheet("Messages", [HEADERS["Messages"], [iso(hours=29), "cart", "17", "second@example.com", "1", "sent", "x", ""]])
    if orders_rows:
        s.sheet("Orders", [HEADERS["Orders"]] + orders_rows)


def ask(s, path, session, message, **extra):
    return s.post(f"/webhook/{path}", {"session_id": session, "message": message, **extra}, H)


def agent_cases(s, path, label, platform):
    s.script(
        {"match": "где заказ 1001", "steps": [{"tool": "get_order", "args": {"order_id": "1001", "email": "anna@example.com"}},
                                               {"final": "{{result.order.status}} {{result.order.tracking.0.number}}"}]},
        {"match": "где заказ 2001", "steps": [{"tool": "get_order", "args": {"order_id": "2001", "email": "oleg@example.com"}},
                                               {"final": "{{result.order.status}}"}]},
        {"match": "чужой заказ 1001", "steps": [{"tool": "get_order", "args": {"order_id": "1001", "email": "bob@example.com"}},
                                                 {"final": "verified={{result.verified}} status={{result.order.status}}"}]},
        {"match": "заказ 9999", "steps": [{"tool": "get_order", "args": {"order_id": "9999", "email": "anna@example.com"}},
                                           {"final": "found={{result.found}} err={{result.service_error}}"}]},
        {"match": "вернуть кофемолку 1001", "steps": [{"tool": "check_return", "args": {"order_id": "1001", "email": "anna@example.com", "items": "кофемолка", "reason": "не подошла", "condition": "unused"}},
                                                      {"final": "{{result.decision}} до {{result.deadline}}"}]},
        {"match": "вернуть старый 1002", "steps": [{"tool": "check_return", "args": {"order_id": "1002", "email": "anna@example.com", "items": "все", "reason": "передумал", "condition": "unused"}},
                                                    {"final": "{{result.decision}}"}]},
        {"match": "распродажа 1003", "steps": [{"tool": "check_return", "args": {"order_id": "1003", "email": "anna@example.com", "items": "все", "reason": "не подошёл", "condition": "unused"}},
                                                {"final": "{{result.decision}}"}]},
        {"match": "сломана 1001", "steps": [{"tool": "check_return", "args": {"order_id": "1001", "email": "anna@example.com", "items": "все", "reason": "пришла сломанная", "condition": "damaged"}},
                                             {"final": "{{result.decision}}"}]},
        {"match": "оформите возврат 1001", "steps": [{"tool": "create_return_request", "args": {"order_id": "1001", "email": "anna@example.com", "items": "кофемолка", "reason": "не подошла", "condition": "unused"}},
                                                     {"final": "Заявка {{result.rma}}"}]},
        {"match": "оформите возврат 1002", "steps": [{"tool": "create_return_request", "args": {"order_id": "1002", "email": "anna@example.com", "items": "все", "reason": "передумал", "condition": "unused"}},
                                                     {"final": "{{result.note}}"}]},
        {"match": "когда деньги", "steps": [{"final": "Деньги вернутся на карту завтра."}]},
        {"match": "доставка в польшу", "steps": [{"tool": "search_policies", "args": {"query": "доставка Польша"}},
                                                  {"final": "{{result.articles.0.answer}}"}]},
    )
    own = "2001" if platform == "woocommerce" else "1001"
    code, r = ask(s, path, "e-order-ok", f"Где заказ {own}? anna")
    want = "Выполнен" if platform == "woocommerce" else "Доставлен 20451001"
    check(f"{label}: order for its owner", code == 200 and r.get("reply", "").startswith(want), r)
    if platform != "woocommerce":
        code, r = ask(s, path, "e-order-bad", "Чужой заказ 1001")
        check(f"{label}: stranger sees nothing", r.get("reply") == "verified=false status=", r)
    code, r = ask(s, path, "e-order-none", "Заказ 9999 где?")
    check(f"{label}: unknown order is 'not found', not a failure", r.get("reply") == "found=false err=", r)
    if platform == "woocommerce":
        return
    code, r = ask(s, path, "e-ret-ok", "Хочу вернуть кофемолку 1001")
    check(f"{label}: return in window is eligible", r.get("reply", "").startswith("eligible до 20"), r)
    for msg, want, nm in (("Вернуть старый 1002", "ineligible", "late return refused"), ("Распродажа 1003 вернуть", "ineligible", "final sale refused"),
                          ("Сломана 1001!", "needs_human", "defect goes to a manager")):
        code, r = ask(s, path, f"e-{want}-{nm[:4]}", msg)
        check(f"{label}: {nm}", r.get("reply") == want, r)
    before_tg = len(s.calls("/sendMessage"))
    code, r = ask(s, path, "e-rma-yes", "Оформите возврат 1001, пожалуйста")
    rows = s.read_sheet("Returns")
    tg = s.calls("/sendMessage")[before_tg:]
    check(f"{label}: return request saved and sent to the team",
          len(rows) == 3 and rows[2][3] == "eligible" and rows[2][1] in r.get("reply", "") and r.get("rma") == rows[2][1]
          and len(tg) == 1 and "автоматически не возвращаются" in tg[0]["body"]["text"], (r, rows, tg))
    code, r = ask(s, path, "e-rma-no", "Оформите возврат 1002")
    check(f"{label}: no request for an ineligible return", r.get("reply", "").startswith("Заявка НЕ создана") and len(s.read_sheet("Returns")) == 3, r)
    code, r = ask(s, path, "e-money", "Когда деньги придут?")
    check(f"{label}: promise of money is blocked", "forbidden_promise" in r.get("flags", []) and "завтра" not in r.get("reply", ""), r)
    code, r = ask(s, path, "e-policy", "Сколько идёт доставка в Польшу?")
    check(f"{label}: policy answer", "4–7" in r.get("reply", ""), r)


def main():
    wf = build.build()
    va = variant(wf, "ecomA", "", "shopify")
    vb = variant(wf, "ecomB", "-b", "woocommerce", anthropic=True)
    vc = variant(wf, "ecomC", "-c", "sheets")
    ext = subprocess.Popen(["node", str(HERE / "ext_mock.cjs"), str(EXT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        with Stand("ecom", N8N, MOCK) as s:
            # Shopify token travels as a header credential
            creds = standmod.test_credentials
            standmod.test_credentials = lambda mock: creds(mock) + [{"id": "t-shop", "name": "shop", "type": "httpHeaderAuth", "data": {"name": "X-Shopify-Access-Token", "value": "shpat_test"}}]
            s.load([va, vb, vc])
            for p in ("store-agent", "store-agent-b", "store-agent-c", "ecomA-carts", "ecomA-reviews", "ecomB-reviews", "ecomC-carts"):
                s.wait_webhook("/webhook/" + p)
            time.sleep(1)

            # ---------- agent ----------
            setup(s)
            agent_cases(s, "store-agent", "shopify+openai", "shopify")
            setup(s)
            agent_cases(s, "store-agent-b", "woocommerce+anthropic", "woocommerce")

            # ---------- carts, Shopify ----------
            setup(s)
            s.script({"match": "кофемолка lumo", "steps": [{"final": "Кажется, вы присмотрели кофемолку — она всё ещё в корзине."}]},
                     {"match": "чайник fellow", "steps": [{"final": "Чайник ждёт вас, и сегодня на него скидка 10%!"}]})
            s.post("/webhook/ecomA-carts", {})
            time.sleep(2)
            got = {m["to"]: m for m in mails()}
            check("carts: only consenting, unfinished, fresh, not unsubscribed", sorted(got) == ["kettle@example.com", "oleg@example.com", "second@example.com"], sorted(got))
            o = got.get("oleg@example.com", {})
            check("carts: model's opening used when it passes the check", "Кажется, вы присмотрели кофемолку" in o.get("text", "")
                  and "https://shop.example/recover/11" in o.get("text", "") and "BACK10" not in o.get("text", ""), o)
            k = got.get("kettle@example.com", {})
            check("carts: model's line with a discount is replaced by the template", "скидка" not in k.get("text", "") and "не завершили заказ" in k.get("text", ""), k)
            sec = got.get("second@example.com", {})
            check("carts: second email after a day carries the promo code", "BACK10" in sec.get("text", "") and "всё ещё ждёт" in sec.get("subject", ""), sec)
            log = s.read_sheet("Messages")
            details = {r[2]: r[7] for r in log[1:] if r[1] == "cart"}
            check("carts: every email logged, with how the opening was made", len(log) == 5 and details.get("11") == "ai" and details.get("16", "").startswith("template:"), log)
            s.post("/webhook/ecomA-carts", {})
            time.sleep(2)
            check("carts: a second run sends nothing new", len(mails()) == 3, [m["to"] for m in mails()])

            # unsubscribe link from the email
            link = next(line for line in o.get("text", "").splitlines() if "store-unsubscribe" in line).split(": ", 1)[1]
            q = urllib.parse.urlparse(link).query
            code, page = _req("GET", f"http://127.0.0.1:{N8N}/webhook/store-unsubscribe?{q}")
            sup = s.read_sheet("Suppress")
            check("unsubscribe: signed link works", code == 200 and "Вы отписаны" in str(page) and sup[-1][1] == "oleg@example.com", (code, str(page)[:200], sup))
            code, page = _req("GET", f"http://127.0.0.1:{N8N}/webhook/store-unsubscribe?e=anna%40example.com&s=deadbeef")
            check("unsubscribe: forged link refused", "недействительна" in str(page) and len(s.read_sheet("Suppress")) == len(sup), str(page)[:200])

            # ---------- reviews, Shopify ----------
            _req("POST", EXTURL + "/__reset", {})
            _req("POST", EXTURL + "/__shop", SHOPIFY)
            s.post("/webhook/ecomA-reviews", {})
            time.sleep(2)
            rv = mails()
            check("reviews: one request, only for the order delivered 8 days ago without a return",
                  [m["to"] for m in rv] == ["ivan@example.com"] and "products/brio-2#reviews" in rv[0]["text"], [(m["to"], m["text"][:300]) for m in rv])
            s.post("/webhook/ecomA-reviews", {})
            time.sleep(2)
            check("reviews: never asked twice", len(mails()) == 1, [m["to"] for m in mails()])

            # ---------- reviews, WooCommerce ----------
            _req("POST", EXTURL + "/__reset", {})
            _req("POST", EXTURL + "/__shop", SHOPIFY)
            s.post("/webhook/ecomB-reviews", {})
            time.sleep(2)
            rv = mails()
            check("reviews (woo): completed 10 days ago gets a request", [m["to"] for m in rv] == ["petr@example.com"], [(m["to"]) for m in rv])

            # ---------- carts via events, Google Sheets platform ----------
            setup(s)
            _req("POST", EXTURL + "/__reset", {})
            ev = lambda body, h=H: s.post("/webhook/store-cart-event-c", body, h)  # noqa: E731
            code, r = ev({"event": "cart", "cart_id": "w1", "email": "Woo@Example.com", "name": "Ира", "consent": True,
                          "items": [{"title": "Кофе Колумбия", "qty": 2}], "total": 980, "currency": "UAH", "checkout_url": "https://shop.example/cart/w1"})
            check("cart event: accepted", code == 200 and r.get("ok") is True, (code, r))
            ev({"event": "cart", "cart_id": "w2", "email": "buyer@example.com", "consent": True, "items": "Фильтры ×1", "checkout_url": "https://shop.example/cart/w2"})
            ev({"event": "order", "cart_id": "w2", "email": "buyer@example.com"})
            code, r = ev({"event": "cart", "cart_id": "w3", "email": "x@example.com"}, {"x-agent-token": "nope"})
            check("cart event: wrong token → 401", code == 401, (code, r))
            code, r = ev({"event": "cart", "cart_id": "w3"})
            check("cart event: no email → 400", code == 400, (code, r))
            s.script({"match": "кофе колумбия", "steps": [{"final": "Ваш кофе всё ещё в корзине — вернитесь, когда будет удобно."}]})
            s.post("/webhook/ecomC-carts", {})
            time.sleep(2)
            got = mails()
            check("carts (sheets): bought cart skipped, the other emailed", [m["to"] for m in got] == ["woo@example.com"] and "https://shop.example/cart/w1" in got[0]["text"], [(m["to"]) for m in got])

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
