"""
Fake Telegram Bot API, CRM webhook, Notion API (2026-03-11) and Google OAuth + Calendar for testing
the MCP servers. Usage: python3 mock_apis.py PORT. Control: GET /__log, POST /__reset, POST /__tg (updates),
POST /__events (calendar events), POST /__fail {"contains": "..."}.
"""
import json
import re
import sys
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

LOCK = threading.Lock()
S = {}

KB_ID = "11111111111111111111111111111111"
TARGET_ID = "22222222222222222222222222222222"
OTHER_ID = "33333333333333333333333333333333"


def title(text):
    return {"type": "title", "title": [{"plain_text": text, "text": {"content": text}}]}


def rich(text):
    return {"type": "rich_text", "rich_text": [{"plain_text": text, "text": {"content": text}}]}


def kb_page(i, name, answer, tags, ds=KB_ID):
    pid = f"{i:08x}-0000-4000-8000-{i:012x}"
    return {"object": "page", "id": pid, "url": f"https://www.notion.so/{pid.replace('-', '')}", "in_trash": False,
            "parent": {"type": "data_source_id", "data_source_id": ds, "database_id": "db-" + ds[:4]},
            "properties": {"Name": title(name), "Ответ": rich(answer),
                           "Теги": {"type": "multi_select", "multi_select": [{"name": t} for t in tags]}}}


def reset():
    S.clear()
    S.update(log=[], updates=[], sent=[], crm=[], events=[], fail=[], pages=[], token_calls=0)
    S["kb"] = [
        kb_page(1, "Как оформить возврат", "Возврат — 14 дней, напишите номер заказа менеджеру.", ["возврат"]),
        kb_page(2, "Сроки доставки", "По Украине 1–3 дня, в Польшу 4–7 дней.", ["доставка", "сроки"]),
        kb_page(3, "Оплата по счёту", "Счёт для ФОП и компаний выставляем за рабочий день.", ["оплата", "счёт"]),
        kb_page(4, "График работы офиса", "Пн–пт 9:00–18:00.", ["график"]),
        kb_page(5, "Старая статья в корзине", "Не показывать", ["доставка"]),
    ]
    S["kb"][4]["in_trash"] = True
    S["other"] = [kb_page(9, "Зарплаты сотрудников", "секретно", ["зарплата", "доставка"], ds=OTHER_ID)]


reset()

TARGET_SCHEMA = {
    "object": "data_source", "id": TARGET_ID,
    "properties": {
        "Название": {"id": "t", "name": "Название", "type": "title", "title": {}},
        "Email": {"id": "e", "name": "Email", "type": "email", "email": {}},
        "Тема": {"id": "s", "name": "Тема", "type": "select", "select": {"options": [{"name": "Доставка"}, {"name": "Возврат"}, {"name": "Другое"}]}},
        "Статус": {"id": "st", "name": "Статус", "type": "status", "status": {"options": [{"name": "Новая"}, {"name": "В работе"}]}},
        "Комментарий": {"id": "c", "name": "Комментарий", "type": "rich_text", "rich_text": {}},
        "Ответственный": {"id": "p", "name": "Ответственный", "type": "people", "people": {}},
    },
}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, obj):
        data = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n).decode() if n else ""
        if "x-www-form-urlencoded" in (self.headers.get("Content-Type") or ""):
            return {k: v[0] for k, v in urllib.parse.parse_qs(raw).items()}
        return json.loads(raw) if raw else {}

    def do_GET(self):  # noqa: N802
        self.route("GET")

    def do_POST(self):  # noqa: N802
        self.route("POST")

    def route(self, method):
        u = urllib.parse.urlparse(self.path)
        p = u.path
        q = urllib.parse.parse_qs(u.query)
        b = self.body() if method == "POST" else {}
        with LOCK:
            if not p.startswith("/__"):
                S["log"].append({"method": method, "path": p, "query": q, "body": b, "headers": dict(self.headers)})
            if p == "/__log":
                return self.send(200, {k: v for k, v in S.items() if k in ("log", "sent", "crm", "events", "pages", "token_calls")})
            if p == "/__reset":
                reset()
                return self.send(200, {"ok": True})
            if p == "/__tg":
                S["updates"].extend(b)
                return self.send(200, {"ok": True})
            if p == "/__events":
                S["events"].extend(b)
                return self.send(200, {"ok": True})
            if p == "/__fail":
                S["fail"].append(b["contains"])
                return self.send(200, {"ok": True})
            if any(f in p for f in S["fail"]):
                return self.send(500, {"error": "forced"})

            # ---- Telegram ----
            m = re.match(r"^/bot([^/]+)/(\w+)$", p)
            if m:
                if m.group(1) != "123:abc":
                    return self.send(401, {"ok": False, "error_code": 401, "description": "Unauthorized"})
                if m.group(2) == "getUpdates":
                    off = int(b.get("offset") or 0)
                    return self.send(200, {"ok": True, "result": [x for x in S["updates"] if x["update_id"] >= off][: b.get("limit", 100)]})
                if m.group(2) == "sendMessage":
                    S["sent"].append(b)
                    return self.send(200, {"ok": True, "result": {"message_id": len(S["sent"])}})
                return self.send(404, {"ok": False, "description": "Not Found"})

            # ---- CRM ----
            if p == "/crm":
                if self.headers.get("X-CRM-Token") != "crm-secret":
                    return self.send(401, {"ok": False, "error": "bad token"})
                S["crm"].append(b)
                return self.send(200, {"ok": True, "id": f"D{len(S['crm'])}", "duplicate": False})

            # ---- Notion ----
            if p.startswith("/v1/"):
                if self.headers.get("Authorization") != "Bearer ntn-test" or self.headers.get("Notion-Version") != "2026-03-11":
                    return self.send(401, {"object": "error", "status": 401, "message": "bad auth or version"})
                return self.notion(method, p, q, b)

            # ---- Google ----
            if p == "/token":
                S["token_calls"] += 1
                if b.get("grant_type") == "refresh_token" and b.get("refresh_token") == "rt-ok":
                    return self.send(200, {"access_token": "at-ok", "expires_in": 3600, "token_type": "Bearer"})
                if b.get("grant_type") == "authorization_code" and b.get("code") == "code-ok" and b.get("code_verifier"):
                    return self.send(200, {"access_token": "at-ok", "refresh_token": "rt-new", "expires_in": 3600})
                return self.send(400, {"error": "invalid_grant", "error_description": "Token has been expired or revoked."})
            if p.startswith("/calendar/v3/"):
                if self.headers.get("Authorization") != "Bearer at-ok":
                    return self.send(401, {"error": {"code": 401, "message": "Invalid Credentials"}})
                return self.calendar(method, p, q, b)
            return self.send(404, {"error": "not found"})

    def notion(self, method, p, q, b):
        m = re.match(r"^/v1/data_sources/([\w-]+?)(/query)?$", p)
        if m:
            ds = m.group(1).replace("-", "")
            if m.group(2):
                rows = {KB_ID: S["kb"], OTHER_ID: S["other"], TARGET_ID: S["pages"]}.get(ds)
                if rows is None:
                    return self.send(404, {"object": "error", "status": 404, "message": "Could not find data source"})
                if b.get("filter"):
                    f = b["filter"]
                    kind = [k for k in f if k != "property"][0]
                    want = f[kind]["equals"]
                    rows = [r for r in rows if want in json.dumps(r["properties"].get(f["property"], {}), ensure_ascii=False)]
                start = int(b.get("start_cursor") or 0)
                size = 2  # маленькие страницы, чтобы проверить пагинацию
                chunk = rows[start:start + size]
                more = start + size < len(rows)
                return self.send(200, {"object": "list", "results": chunk, "has_more": more, "next_cursor": str(start + size) if more else None})
            if ds == TARGET_ID:
                return self.send(200, TARGET_SCHEMA)
            return self.send(404, {"object": "error", "status": 404, "message": "Could not find data source"})
        m = re.match(r"^/v1/pages/([\w-]+?)(/markdown)?$", p)
        if m and method == "GET":
            pid = m.group(1)
            allp = S["kb"] + S["other"] + S["pages"]
            page = next((x for x in allp if x["id"].replace("-", "") == pid.replace("-", "")), None)
            if not page:
                return self.send(404, {"object": "error", "status": 404, "message": "Could not find page"})
            if m.group(2):
                if q.get("markdown_version") != ["v2"]:
                    return self.send(400, {"object": "error", "message": "use v2"})
                text = page["properties"]["Ответ"]["rich_text"][0]["plain_text"] if "Ответ" in page["properties"] else ""
                return self.send(200, {"object": "page_markdown", "id": page["id"], "markdown": f"# {page['properties']['Name']['title'][0]['plain_text']}\n\n{text}",
                                       "truncated": False, "unknown_block_ids": []})
            return self.send(200, page)
        if p == "/v1/pages" and method == "POST":
            parent = b.get("parent", {})
            if parent.get("data_source_id") != TARGET_ID:
                return self.send(400, {"object": "error", "message": "bad parent"})
            for name, val in b["properties"].items():
                t = TARGET_SCHEMA["properties"].get(name)
                if not t or t["type"] not in val:
                    return self.send(400, {"object": "error", "status": 400, "message": f"{name} is not a property that exists or wrong type"})
            pid = f"{len(S['pages']) + 100:08x}-0000-4000-8000-{len(S['pages']) + 100:012x}"
            props = {}
            for name, val in b["properties"].items():
                t = TARGET_SCHEMA["properties"][name]["type"]
                if t in ("title", "rich_text"):
                    props[name] = {"type": t, t: [{"plain_text": val[t][0]["text"]["content"]}]}
                else:
                    props[name] = {"type": t, t: val[t]}
            page = {"object": "page", "id": pid, "url": f"https://www.notion.so/{pid}", "parent": parent, "properties": props}
            S["pages"].append(page)
            return self.send(200, page)
        return self.send(404, {"object": "error", "status": 404, "message": "unknown"})

    def calendar(self, method, p, q, b):
        from datetime import datetime

        def dt(s):
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        if p.endswith("/freeBusy"):
            t0, t1 = dt(b["timeMin"]), dt(b["timeMax"])
            busy = [{"start": e["start"]["dateTime"], "end": e["end"]["dateTime"]} for e in S["events"]
                    if e.get("status") != "cancelled" and dt(e["end"]["dateTime"]) > t0 and dt(e["start"]["dateTime"]) < t1]
            return self.send(200, {"kind": "calendar#freeBusy", "calendars": {i["id"]: {"busy": busy} for i in b["items"]}})
        m = re.match(r"^/calendar/v3/calendars/([^/]+)/events$", p)
        if m and method == "POST":
            ev = {"id": f"evt{len(S['events']) + 1}", "status": "confirmed", "htmlLink": f"https://calendar.google.com/event?eid=evt{len(S['events']) + 1}", **b,
                  "_query": q}
            S["events"].append(ev)
            return self.send(200, ev)
        if m:
            items = [e for e in S["events"] if e.get("status") != "cancelled"]
            if q.get("privateExtendedProperty"):
                k, v = q["privateExtendedProperty"][0].split("=")
                items = [e for e in items if e.get("extendedProperties", {}).get("private", {}).get(k) == v]
            return self.send(200, {"items": items})
        return self.send(404, {"error": {"code": 404, "message": "Not Found"}})


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
