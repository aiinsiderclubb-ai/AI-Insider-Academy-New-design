"""
End-to-end test of the three MCP servers against mock_apis.py, over stdio and HTTP.

    python3 scripts/agent-kits/mcp/e2e.py [path-to-product-root]

By default the servers are taken from the product folders in content/products, so
what is tested is what ships.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2] / "content" / "products"
MOCK_PORT, HTTP_PORT = 5720, 5721
MOCK = f"http://127.0.0.1:{MOCK_PORT}"
FAILED = []


def PAGE(i):  # noqa: N802  ids the mock gives its Notion pages
    return f"{i:08x}-0000-4000-8000-{i:012x}"


def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  → {str(detail)[:600]}"), flush=True)
    if not cond:
        FAILED.append(name)


def req(method, url, body=None, headers=None):
    data = None if body is None else json.dumps(body).encode()
    r = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        return e.code, json.loads(raw) if raw else None


class Stdio:
    def __init__(self, cmd, env):
        self.p = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                                  env={**os.environ, **env})
        self.n = 0
        init = self.rpc("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "e2e", "version": "1"}})
        assert init["result"]["protocolVersion"] == "2025-06-18", init
        self.p.stdin.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\n")
        self.p.stdin.flush()

    def rpc(self, method, params=None):
        self.n += 1
        self.p.stdin.write(json.dumps({"jsonrpc": "2.0", "id": self.n, "method": method, "params": params or {}}) + "\n")
        self.p.stdin.flush()
        line = self.p.stdout.readline()
        if not line:
            raise RuntimeError("server died: " + self.p.stderr.read()[-2000:])
        return json.loads(line)

    def tools(self):
        return {t["name"]: t for t in self.rpc("tools/list")["result"]["tools"]}

    def call(self, name, args=None):
        r = self.rpc("tools/call", {"name": name, "arguments": args or {}})["result"]
        return r.get("isError", False), (r.get("structuredContent") if not r.get("isError") else r["content"][0]["text"])

    def close(self):
        self.p.stdin.close()
        self.p.wait(timeout=10)


def mock_log():
    return req("GET", MOCK + "/__log")[1]


def test_telegram(root, tmp):
    srv = root / "mcp-telegram-inbox" / "server" / "telegram_inbox_mcp.py"
    cfg = json.loads((root / "mcp-telegram-inbox" / "config" / "inbox.example.json").read_text(encoding="utf-8"))
    cfg["chats"] = [{"id": -1001234567890, "name": "Продажи"}]
    cfg["manager_chat_id"] = -100999
    cfg["lead_sink"] = {"type": "webhook", "url": MOCK + "/crm", "token_header": "X-CRM-Token", "token_env": "CRM_WEBHOOK_TOKEN", "source": "telegram"}
    path = tmp / "inbox.json"
    path.write_text(json.dumps(cfg, ensure_ascii=False), encoding="utf-8")
    now = int(time.time())

    def upd(uid, chat, mid, text, user="Ирина", username="irina", bot=False):
        return {"update_id": uid, "message": {"message_id": mid, "date": now - 60, "chat": {"id": chat, "type": "supergroup"},
                                              "from": {"id": 5, "is_bot": bot, "first_name": user, "username": username}, "text": text}}
    req("POST", MOCK + "/__tg", [
        upd(1, -1001234567890, 10, "Здравствуйте! Нужен сайт для студии йоги, бюджет 3000, мой телефон +380 67 123 45 67"),
        upd(2, -1001234567890, 11, "Верните деньги за прошлый заказ, иначе пишу жалобу", "Олег", "oleg"),
        upd(3, -1001234567890, 12, "Коллеги, обед в 13:00", "Мария", ""),
        upd(4, -555, 1, "чужой чат с телефоном +380501112233"),
        upd(5, -1001234567890, 13, "я бот", bot=True),
        upd(6, -1001234567890, 14, "/start"),
    ])
    env = {"TELEGRAM_BOT_TOKEN": "123:abc", "TELEGRAM_API_BASE": MOCK, "CRM_WEBHOOK_TOKEN": "crm-secret"}
    s = Stdio([sys.executable, str(srv), "--config", str(path)], env)
    tools = s.tools()
    check("telegram: 5 tools with annotations", sorted(tools) == ["create_lead", "escalate", "fetch_new_messages", "list_messages", "mark_messages"]
          and tools["list_messages"]["annotations"]["readOnlyHint"] is True, list(tools))
    err, res = s.call("fetch_new_messages")
    check("telegram: only allowed chat, no bots or commands", not err and res["added"] == 3 and res["skipped"] == 3, res)
    err, res = s.call("fetch_new_messages")
    check("telegram: offset moves, nothing twice", not err and res["added"] == 0, res)
    err, res = s.call("list_messages", {})
    ids = {m["text"][:10]: m["id"] for m in res["messages"]}
    check("telegram: lists new messages with escalation hints", res["count"] == 3
          and any(m["escalation_hints"] for m in res["messages"] if "Верните" in m["text"]), res)
    lead_id = ids["Здравствуй"]
    err, msg = s.call("create_lead", {"message_ids": [lead_id], "name": "Ирина", "phone": "+380 99 000 00 00", "need": "Сайт"})
    check("telegram: refuses a phone that is not in the message", err and "Ни телефона" in msg, msg)
    err, msg = s.call("create_lead", {"message_ids": ["-100:404"], "need": "x", "phone": "1"})
    check("telegram: refuses invented message ids", err and "нет" in msg, msg)
    err, res = s.call("create_lead", {"message_ids": [lead_id], "name": "Ирина", "phone": "+380671234567", "need": "Сайт для студии йоги", "amount": 3000})
    crm = mock_log()["crm"]
    check("telegram: lead reaches CRM with token and link", not err and res["crm_ref"] == "D1" and len(crm) == 1
          and crm[0]["phone"] == "+380671234567" and crm[0]["message_link"] == "https://t.me/c/1234567890/10", (res, crm))
    err, msg = s.call("create_lead", {"message_ids": [lead_id], "phone": "+380671234567", "need": "again"})
    check("telegram: no second lead from the same message", err and "уже заведён" in msg and len(mock_log()["crm"]) == 1, msg)
    err, res = s.call("escalate", {"message_ids": [ids["Верните де"]], "reason": "Требует возврат", "summary": "Олег грозит жалобой"})
    sent = mock_log()["sent"]
    check("telegram: escalation goes to the manager chat", not err and len(sent) == 1 and sent[0]["chat_id"] == -100999
          and "Требует возврат" in sent[0]["text"] and sent[0]["parse_mode"] == "HTML", (res, sent))
    err, res = s.call("escalate", {"message_ids": [ids["Верните де"]], "reason": "x", "summary": "y"})
    check("telegram: escalation only once", res.get("already") and len(mock_log()["sent"]) == 1, res)
    err, res = s.call("mark_messages", {"message_ids": [ids["Коллеги, о"]], "status": "ignored", "reason": "внутреннее"})
    err, res = s.call("list_messages", {})
    check("telegram: nothing left unprocessed", res["count"] == 0, res)
    err, msg = s.call("list_messages", {"status": "weird"})
    check("telegram: argument validation", err and "допустимо" in msg, msg)
    s.close()

    # CRM down → the lead is not marked
    req("POST", MOCK + "/__tg", [upd(7, -1001234567890, 20, "Хочу консультацию, почта anna@example.com", "Анна", "anna")])
    s = Stdio([sys.executable, str(srv), "--config", str(path)], env)
    s.call("fetch_new_messages")
    mid = s.call("list_messages", {})[1]["messages"][0]["id"]
    req("POST", MOCK + "/__fail", {"contains": "/crm"})
    err, msg = s.call("create_lead", {"message_ids": [mid], "email": "anna@example.com", "need": "Консультация"})
    st = s.call("list_messages", {})[1]
    check("telegram: CRM failure leaves the message new", err and "CRM ответила 500" in msg and st["count"] == 1, (msg, st))
    s.close()
    return srv, path, env


def test_notion(root, tmp):
    srv = root / "mcp-notion-workspace" / "server" / "notion_workspace_mcp.py"
    cfg = json.loads((root / "mcp-notion-workspace" / "config" / "notion.example.json").read_text(encoding="utf-8"))
    cfg["knowledge"][0]["data_source_id"] = "11111111-1111-1111-1111-111111111111"
    cfg["knowledge"][0]["text_properties"] = ["Ответ", "Теги"]
    cfg["target"]["data_source_id"] = "22222222222222222222222222222222"
    path = tmp / "notion.json"
    path.write_text(json.dumps(cfg, ensure_ascii=False), encoding="utf-8")
    env = {"NOTION_TOKEN": "ntn-test", "NOTION_API_BASE": MOCK}
    s = Stdio([sys.executable, str(srv), "--config", str(path)], env)
    check("notion: 4 tools", sorted(s.tools()) == ["append_row", "describe_target", "read_page", "search_knowledge"])
    err, res = s.call("search_knowledge", {"query": "какие сроки доставки в Польшу?"})
    check("notion: finds the article across pages of results", not err and res["found"] and res["results"][0]["title"] == "Сроки доставки", res)
    check("notion: trashed pages and other databases stay out",
          all(r["id"] not in (PAGE(5), PAGE(9)) for r in res["results"]), res)
    err, res = s.call("search_knowledge", {"query": "зарплата сотрудников"})
    check("notion: nothing from a database that is not allowed", not err and res["found"] is False, res)
    err, res = s.call("read_page", {"page_id": PAGE(2).replace("-", "")})
    check("notion: reads an allowed page as markdown", not err and "4–7 дней" in res["markdown"], res)
    err, msg = s.call("read_page", {"page_id": PAGE(9)})
    check("notion: refuses a page outside the allowed bases", err and "не из разрешённых" in msg, msg)
    err, res = s.call("describe_target", {})
    check("notion: target columns with options, fixed status hidden from the agent",
          not err and res["columns"]["Тема"]["options"] == ["Доставка", "Возврат", "Другое"] and "Статус" not in res["columns"]
          and res["set_by_server"] == {"Статус": "Новая"}, res)
    err, msg = s.call("append_row", {"values": {"Название": "x", "Ответственный": "кто-то"}})
    check("notion: refuses a column that is not agreed", err and "писать нельзя" in msg, msg)
    err, msg = s.call("append_row", {"values": {"Название": "Вопрос", "Тема": "Скидки", "Email": "a@b.co"}})
    check("notion: refuses an unknown select option", err and "допустимо" in msg, msg)
    err, msg = s.call("append_row", {"values": {"Тема": "Доставка"}})
    check("notion: refuses a row without required columns", err and "обязательные" in msg, msg)
    err, res = s.call("append_row", {"values": {"Название": "Где посылка 1001", "Тема": "Доставка", "Email": "anna@example.com", "Комментарий": "Ждёт с понедельника"}})
    pages = mock_log()["pages"]
    check("notion: writes the row with the fixed status", not err and len(pages) == 1 and pages[0]["properties"]["Статус"]["status"]["name"] == "Новая"
          and pages[0]["parent"]["data_source_id"] == "22222222222222222222222222222222", (res, pages))
    err, res = s.call("append_row", {"values": {"Название": "Где посылка 1001", "Тема": "Доставка", "Email": "anna@example.com"}})
    check("notion: dedupe column stops a second identical row", not err and res["duplicate"] and len(mock_log()["pages"]) == 1, res)
    hdr = [x for x in mock_log()["log"] if x["path"].startswith("/v1/")][0]["headers"]
    check("notion: sends Notion-Version 2026-03-11", hdr.get("Notion-Version") == "2026-03-11", hdr)
    s.close()
    return srv, path, env


def test_calendar(root, tmp):
    srv = root / "mcp-google-calendar" / "server" / "calendar_mcp.py"
    cfg = json.loads((root / "mcp-google-calendar" / "config" / "calendar.example.json").read_text(encoding="utf-8"))
    cfg["working_hours"] = {d: ["09:00", "18:00"] for d in ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]}
    path = tmp / "calendar.json"
    path.write_text(json.dumps(cfg, ensure_ascii=False), encoding="utf-8")
    env = {"GOOGLE_CLIENT_ID": "cid", "GOOGLE_CLIENT_SECRET": "sec", "GOOGLE_REFRESH_TOKEN": "rt-ok",
           "GOOGLE_API_BASE": MOCK, "GOOGLE_TOKEN_URL": MOCK + "/token"}
    day = date.today() + timedelta(days=3)
    tz = cfg["timezone"]
    from zoneinfo import ZoneInfo
    z = ZoneInfo(tz)
    busy_start = datetime.combine(day, datetime.strptime("10:00", "%H:%M").time(), z)
    req("POST", MOCK + "/__events", [{"id": "busy1", "status": "confirmed", "summary": "Занято",
                                      "start": {"dateTime": busy_start.isoformat()}, "end": {"dateTime": (busy_start + timedelta(hours=1)).isoformat()}}])
    s = Stdio([sys.executable, str(srv), "--config", str(path)], env)
    tools = s.tools()
    check("calendar: tools, confirm_event is the only write", sorted(tools) == ["cancel_proposal", "confirm_event", "find_free_slots", "list_events", "propose_event"]
          and tools["find_free_slots"]["annotations"]["readOnlyHint"] and not tools["confirm_event"]["annotations"]["readOnlyHint"], list(tools))
    err, res = s.call("find_free_slots", {"date_from": day.isoformat(), "duration_minutes": 30})
    starts = [x["start"][11:16] for x in res["slots"]]
    buf = cfg.get("buffer_minutes", 0)
    check("calendar: busy hour and its buffer are not offered", not err and "10:00" not in starts and "10:30" not in starts
          and ("09:30" not in starts if buf >= 1 else True) and "09:00" in starts, (starts, buf))
    err, msg = s.call("propose_event", {"start": busy_start.isoformat(), "attendee_name": "Анна"})
    check("calendar: will not propose a busy time", err and "занято" in msg, msg)
    slot = res["slots"][-1]["start"]
    err, prop = s.call("propose_event", {"start": slot, "attendee_name": "Анна", "attendee_email": "anna@example.com", "topic": "Консультация"})
    check("calendar: proposal writes nothing yet", not err and "Подтверждаете?" in prop["confirmation_question"]
          and len([e for e in mock_log()["events"] if e["id"] != "busy1"]) == 0, prop)
    for reply in ("Нет, давайте другое время", "а можно в среду?", "Да, но не в это время"):
        err, msg = s.call("confirm_event", {"proposal_id": prop["proposal_id"], "user_reply": reply})
        check(f"calendar: «{reply}» is not a yes", err and "Ничего не записано" in msg, msg)
    err, msg = s.call("confirm_event", {"proposal_id": "ZZZZZZ", "user_reply": "да"})
    check("calendar: unknown proposal refused", err and "Начни с propose_event" in msg, msg)
    err, res = s.call("confirm_event", {"proposal_id": prop["proposal_id"].lower(), "user_reply": "Да, записывайте"})
    evs = [e for e in mock_log()["events"] if e["id"] != "busy1"]
    check("calendar: explicit yes creates exactly one event with the invite", not err and len(evs) == 1
          and evs[0]["attendees"][0]["email"] == "anna@example.com" and evs[0]["_query"].get("sendUpdates") == ["all"]
          and evs[0]["extendedProperties"]["private"]["proposal"] == prop["proposal_id"], (res, evs))
    err, res2 = s.call("confirm_event", {"proposal_id": prop["proposal_id"], "user_reply": "да"})
    check("calendar: confirming twice does not double-book", not err and res2.get("already") and len([e for e in mock_log()["events"] if e["id"] != "busy1"]) == 1, res2)
    # someone takes the slot between propose and confirm
    slot2 = [x for x in s.call("find_free_slots", {"date_from": day.isoformat()})[1]["slots"]][0]
    err, prop2 = s.call("propose_event", {"start": slot2["start"], "attendee_name": "Олег"})
    req("POST", MOCK + "/__events", [{"id": "late", "status": "confirmed", "start": {"dateTime": slot2["start"]}, "end": {"dateTime": slot2["end"]}}])
    err, msg = s.call("confirm_event", {"proposal_id": prop2["proposal_id"], "user_reply": "да"})
    check("calendar: re-checks the slot before writing", err and "заняли" in msg, msg)
    err, msg = s.call("propose_event", {"start": (datetime.now(z) + timedelta(minutes=30)).isoformat(), "attendee_name": "X"})
    check("calendar: minimum notice enforced", err and "Слишком скоро" in msg, msg)
    err, res = s.call("list_events", {"date_from": day.isoformat()})
    check("calendar: lists events", not err and len(res["events"]) >= 2, res)
    s.close()
    bad = Stdio([sys.executable, str(srv), "--config", str(path)], {**env, "GOOGLE_REFRESH_TOKEN": "rt-expired"})
    err, msg = bad.call("find_free_slots", {"date_from": day.isoformat()})
    check("calendar: expired refresh token explained", err and "7 дней" in msg, msg)
    bad.close()

    # get_refresh_token.py: the loopback flow with PKCE against the mock
    tok = root / "mcp-google-calendar" / "server" / "get_refresh_token.py"
    p = subprocess.Popen([sys.executable, str(tok)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                         env={**os.environ, "GOOGLE_CLIENT_ID": "cid", "GOOGLE_CLIENT_SECRET": "sec", "NO_BROWSER": "1",
                              "GOOGLE_AUTH_URL": MOCK + "/auth", "GOOGLE_TOKEN_URL": MOCK + "/token"})
    line = ""
    while "?" not in line:
        line = p.stdout.readline()
    import urllib.parse as up
    q = up.parse_qs(up.urlparse(line.strip()).query)
    redirect = q["redirect_uri"][0]
    urllib.request.urlopen(f"{redirect}/?code=code-ok&state={q['state'][0]}", timeout=10).read()
    out = p.communicate(timeout=30)[0]
    check("calendar: get_refresh_token prints a refresh token (PKCE S256, offline, consent)",
          "GOOGLE_REFRESH_TOKEN=rt-new" in out and q["code_challenge_method"] == ["S256"] and q["access_type"] == ["offline"]
          and "calendar.freebusy" in q["scope"][0], out)
    return srv, path, env


def test_http(srv, path, env):
    proc = subprocess.Popen([sys.executable, str(srv), "--config", str(path), "--http", str(HTTP_PORT)],
                            env={**os.environ, **env, "MCP_HTTP_TOKEN": "http-secret"}, stderr=subprocess.PIPE, text=True)
    url = f"http://127.0.0.1:{HTTP_PORT}/mcp"
    for _ in range(50):
        try:
            if req("GET", f"http://127.0.0.1:{HTTP_PORT}/health")[0] == 200:
                break
        except Exception:
            time.sleep(0.1)
    auth = {"Authorization": "Bearer http-secret", "Accept": "application/json, text/event-stream"}
    init = {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "t", "version": "1"}}}
    code, _ = req("POST", url, init)
    check("http: no token → 401", code == 401, code)
    code, _ = req("POST", url, init, {**auth, "Origin": "https://evil.example"})
    check("http: foreign Origin → 403", code == 403, code)
    code, res = req("POST", url, init, auth)
    check("http: initialize", code == 200 and res["result"]["protocolVersion"] == "2025-03-26", res)
    code, res = req("POST", url, {"jsonrpc": "2.0", "method": "notifications/initialized"}, auth)
    check("http: notification → 202", code == 202, code)
    code, res = req("POST", url, {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}, auth)
    check("http: tools/list", code == 200 and len(res["result"]["tools"]) >= 4, res)
    proc.terminate()
    proc.wait(timeout=10)
    # refuses to listen on all interfaces without a token
    bad = subprocess.run([sys.executable, str(srv), "--config", str(path), "--http", str(HTTP_PORT)],
                         env={**os.environ, **env, "MCP_HTTP_HOST": "0.0.0.0"}, capture_output=True, text=True, timeout=20)
    check("http: no public listener without MCP_HTTP_TOKEN", bad.returncode != 0 and "MCP_HTTP_TOKEN" in bad.stderr, bad.stderr)


def test_inspector(srv, env, config_env, config_path):
    """The official MCP Inspector CLI (v2) talks to the server — an outside client, not ours: stdio and HTTP."""
    base = ["npx", "--yes", "-p", "node@24", "-p", "@modelcontextprotocol/inspector@2", "mcp-inspector", "--cli"]
    envs = []
    for k, v in {**env, config_env: str(config_path)}.items():
        envs += ["-e", f"{k}={v}"]
    out = subprocess.run(base + envs + ["--method", "tools/list", sys.executable, str(srv)], capture_output=True, text=True, timeout=600)
    try:
        tools = json.loads(out.stdout[out.stdout.index("{"):])["tools"]
    except Exception:
        tools = []
    check(f"inspector stdio: {srv.name} lists tools", len(tools) >= 4, out.stdout[-500:] + out.stderr[-800:])
    proc = subprocess.Popen([sys.executable, str(srv), "--http", str(HTTP_PORT)],
                            env={**os.environ, **env, config_env: str(config_path), "MCP_HTTP_TOKEN": "http-secret"})
    time.sleep(1)
    try:
        out = subprocess.run(base + ["--server-url", f"http://127.0.0.1:{HTTP_PORT}/mcp", "--transport", "http",
                                     "--header", "Authorization: Bearer http-secret", "--method", "tools/call",
                                     "--tool-name", "search_knowledge", "--tool-arg", "query=сроки доставки"],
                             capture_output=True, text=True, timeout=600)
        check(f"inspector http: {srv.name} tools/call", "Сроки доставки" in out.stdout, out.stdout[-800:] + out.stderr[-800:])
    finally:
        proc.terminate()
        proc.wait(timeout=10)


def main():
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT
    mock = subprocess.Popen([sys.executable, str(HERE / "mock_apis.py"), str(MOCK_PORT)])
    for _ in range(100):
        try:
            req("GET", MOCK + "/__log")
            break
        except OSError:
            time.sleep(0.1)
    tmp = Path(tempfile.mkdtemp(prefix="mcp-e2e-"))
    try:
        tg = test_telegram(root, tmp)
        req("POST", MOCK + "/__reset", {})
        nt = test_notion(root, tmp)
        req("POST", MOCK + "/__reset", {})
        cal = test_calendar(root, tmp)
        req("POST", MOCK + "/__reset", {})
        for srv, path, env in (tg, nt, cal):
            test_http(srv, path, env)
        if os.environ.get("INSPECTOR", "1") == "1":
            test_inspector(nt[0], nt[2], "NOTION_MCP_CONFIG", nt[1])
    finally:
        mock.terminate()
        shutil.rmtree(tmp, ignore_errors=True)
    print("\nfailed:", len(FAILED))
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
