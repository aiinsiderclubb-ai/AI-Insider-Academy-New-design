"""
The shipped n8n examples, run in a real n8n 2.48: AI Agent → MCP Client Tool → our Telegram Inbox server
(HTTP) and DBHub (HTTP, real Postgres in Docker). The model is the shared scripted mock (mock.cjs).

    python3 scripts/agent-kits/mcp/e2e_n8n.py

Needs Docker (Postgres 17) and network for npx. Ports 5723–5729.
"""
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))
from stand import Stand  # noqa: E402
import build_n8n  # noqa: E402

ROOT = HERE.parents[2] / "content" / "products"
N8N, LLM, APIS, DBHUB, INBOX = 5724, 5725, 5726, 5727, 5728
FAILED = []


def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"  → {str(detail)[:1200]}"), flush=True)
    if not cond:
        FAILED.append(name)


def get(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read().decode())


def post(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode() or "{}")


def variant(wf, wf_id, path, keep_tools, urls):
    t = json.loads(json.dumps(wf))
    t["id"] = wf_id
    t["active"] = False
    nodes = []
    for n in t["nodes"]:
        if n["type"] == "@n8n/n8n-nodes-langchain.mcpClientTool" and n["name"] not in keep_tools:
            t["connections"].pop(n["name"], None)
            continue
        if n["type"] in ("@n8n/n8n-nodes-langchain.chatTrigger", "n8n-nodes-base.scheduleTrigger"):
            old = n["name"]
            n.update({"type": "n8n-nodes-base.webhook", "typeVersion": 2.1, "name": "Test Hook", "webhookId": wf_id + "-hook",
                      "parameters": {"httpMethod": "POST", "path": path, "responseMode": "lastNode", "options": {}}})
            t["connections"]["Test Hook"] = t["connections"].pop(old)
        if n["name"] == "Memory":  # the chat trigger gives a session id; the test webhook does not
            n["parameters"].update({"sessionIdType": "customKey", "sessionKey": "test-session"})
        if n["name"] == "AI Agent":
            n["parameters"]["promptType"] = "define"
            if "text" not in n["parameters"] or n["parameters"]["text"] == "":
                n["parameters"]["text"] = "={{ $json.body.chatInput }}"
        for c in list(n.get("credentials", {})):
            n["credentials"][c] = {"id": {"openAiApi": "t-oa", "httpBearerAuth": "t-bearer-" + n["name"]}[c], "name": c}
        if n["name"] in urls:
            n["parameters"]["endpointUrl"] = urls[n["name"]]
        nodes.append(n)
    t["nodes"] = nodes
    return t


def main():
    tmp = Path(tempfile.mkdtemp(prefix="mcp-n8n-"))
    procs = []
    subprocess.run(["docker", "rm", "-f", "mcp-pg-n8n"], capture_output=True)
    subprocess.run(["docker", "run", "-d", "--rm", "--name", "mcp-pg-n8n", "-e", "POSTGRES_PASSWORD=admin",
                    "-p", "127.0.0.1:5729:5432", "postgres:17-alpine"], check=True, capture_output=True)
    try:
        for _ in range(40):
            if subprocess.run(["docker", "exec", "mcp-pg-n8n", "pg_isready", "-U", "postgres"], capture_output=True).returncode == 0:
                break
            time.sleep(1)
        time.sleep(2)
        seed = ("CREATE TABLE orders(id serial primary key, total numeric, status text);"
                "INSERT INTO orders(total,status) VALUES (2400,'paid'),(990,'new'),(5400,'paid');")
        subprocess.run(["docker", "exec", "mcp-pg-n8n", "psql", "-U", "postgres", "-c", seed], check=True, capture_output=True)
        role = (ROOT / "mcp-starter-pack-business" / "configs" / "postgres-readonly-role.sql.txt").read_text(encoding="utf-8").replace("ЗАМЕНИТЕ_НА_ДЛИННЫЙ_ПАРОЛЬ", "ro-pass")
        subprocess.run(["docker", "exec", "-i", "mcp-pg-n8n", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], input=role, text=True, check=True, capture_output=True)
        toml = (ROOT / "mcp-starter-pack-business" / "configs" / "dbhub.toml").read_text(encoding="utf-8").replace(
            "db.example.com:5432/shop?sslmode=require", "127.0.0.1:5729/postgres?sslmode=disable")
        (tmp / "dbhub.toml").write_text(toml, encoding="utf-8")
        procs.append(subprocess.Popen(["npx", "--yes", "-p", "node@24", "-p", "@bytebase/dbhub@2", "dbhub", "--config", str(tmp / "dbhub.toml"),
                                       "--transport", "http", "--host", "127.0.0.1", "--port", str(DBHUB)],
                                      env={**os.environ, "AGENT_DB_PASSWORD": "ro-pass", "DBHUB_AUTH_TOKEN": "db-token"},
                                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))

        procs.append(subprocess.Popen([sys.executable, str(HERE / "mock_apis.py"), str(APIS)]))
        cfg = json.loads((ROOT / "mcp-telegram-inbox" / "config" / "inbox.example.json").read_text(encoding="utf-8"))
        cfg["lead_sink"] = {"type": "webhook", "url": f"http://127.0.0.1:{APIS}/crm", "token_header": "X-CRM-Token", "token_env": "CRM_WEBHOOK_TOKEN"}
        cfg["manager_chat_id"] = -100999
        (tmp / "inbox.json").write_text(json.dumps(cfg, ensure_ascii=False), encoding="utf-8")
        procs.append(subprocess.Popen([sys.executable, str(ROOT / "mcp-telegram-inbox" / "server" / "telegram_inbox_mcp.py"),
                                       "--config", str(tmp / "inbox.json"), "--http", str(INBOX)],
                                      env={**os.environ, "TELEGRAM_BOT_TOKEN": "123:abc", "TELEGRAM_API_BASE": f"http://127.0.0.1:{APIS}",
                                           "CRM_WEBHOOK_TOKEN": "crm-secret", "MCP_HTTP_TOKEN": "inbox-token"}))
        time.sleep(1.5)
        now = int(time.time())
        post(f"http://127.0.0.1:{APIS}/__tg", [
            {"update_id": 1, "message": {"message_id": 10, "date": now, "chat": {"id": -1001234567890}, "from": {"id": 5, "first_name": "Ирина", "username": "irina"},
                                         "text": "Нужен сайт для студии, бюджет 3000, телефон +380671234567"}},
            {"update_id": 2, "message": {"message_id": 11, "date": now, "chat": {"id": -1001234567890}, "from": {"id": 6, "first_name": "Олег"},
                                         "text": "Верните деньги, пишу жалобу"}}])

        starter = variant(build_n8n.starter(), "mcpStarter", "mcp-starter", ["db"],
                          {"db": f"http://127.0.0.1:{DBHUB}/mcp"})
        triage = variant(build_n8n.inbox(), "mcpInbox", "mcp-inbox", ["inbox"],
                         {"inbox": f"http://127.0.0.1:{INBOX}/mcp"})
        with Stand("mcp", N8N, LLM) as s:
            creds = [{"id": "t-bearer-db", "name": "db", "type": "httpBearerAuth", "data": {"token": "db-token"}},
                     {"id": "t-bearer-inbox", "name": "inbox", "type": "httpBearerAuth", "data": {"token": "inbox-token"}}]
            (s.dir / "extra.json").write_text(json.dumps(creds))
            s.n8n("import:credentials", f"--input={s.dir / 'extra.json'}")
            s.load([starter, triage])
            s.script(
                {"match": "сколько оплачено", "steps": [
                    {"tool": "db_execute_sql", "args": {"sql": "delete from orders"}},
                    {"tool": "db_execute_sql", "args": {"sql": "select sum(total) as paid from orders where status = 'paid'"}},
                    {"final": "ИТОГ {{result}}"}]},
                {"match": "разбери новые сообщения", "steps": [
                    {"tool": "inbox_fetch_new_messages", "args": {}},
                    {"tool": "inbox_list_messages", "args": {}},
                    {"tool": "inbox_create_lead", "args": {"message_ids": ["-1001234567890:10"], "name": "Ирина", "phone": "+380671234567",
                                                     "need": "Сайт для студии", "amount": 3000}},
                    {"tool": "inbox_escalate", "args": {"message_ids": ["-1001234567890:11"], "reason": "жалоба или возврат", "summary": "Олег просит вернуть деньги"}},
                    {"final": "Отчёт: {{result}}"}]})
            for p in ("/webhook/mcp-starter", "/webhook/mcp-inbox"):
                s.wait_webhook(p)
            probes = len(s.executions())  # the readiness probes run the workflows with an empty body
            code, res = s.post("/webhook/mcp-starter", {"chatInput": "Сколько оплачено заказов?"})
            out = json.dumps(res, ensure_ascii=False)
            check("n8n → MCP Client → DBHub: SELECT answered from Postgres", code == 200 and "7800" in out, (code, out))
            llm = json.dumps(s.calls("/chat/completions"), ensure_ascii=False)
            check("n8n → MCP Client → DBHub: DELETE refused by read-only mode", "READONLY_VIOLATION" in llm, llm[-600:])
            cnt = subprocess.run(["docker", "exec", "mcp-pg-n8n", "psql", "-U", "postgres", "-tc", "select count(*) from orders"],
                                 capture_output=True, text=True).stdout.strip()
            check("n8n → DBHub: rows untouched", cnt == "3", cnt)
            code, res = s.post("/webhook/mcp-inbox", {})
            log = get(f"http://127.0.0.1:{APIS}/__log")
            check("n8n → MCP Client → Telegram Inbox: lead created in CRM", len(log["crm"]) == 1 and log["crm"][0]["phone"] == "+380671234567", (res, log["crm"]))
            check("n8n → MCP Client → Telegram Inbox: complaint escalated", len(log["sent"]) == 1 and log["sent"][0]["chat_id"] == -100999, log["sent"])
            calls = [c for c in s.calls("/chat/completions")]
            offered = calls[0]["body"].get("tools", []) if calls else []
            names = sorted(t["function"]["name"] for t in offered)
            check("n8n sees all five inbox tools", names == sorted("inbox_" + n for n in ["create_lead", "escalate", "fetch_new_messages", "list_messages", "mark_messages"]), names)
            bad = [e for e in s.executions()[probes:] if e[1] != "success"]
            check("no failed executions", not bad, bad and s.last_error())
    finally:
        for p in procs:
            p.terminate()
        subprocess.run(["docker", "rm", "-f", "mcp-pg-n8n"], capture_output=True)
    print("\nfailed:", len(FAILED))
    sys.exit(1 if FAILED else 0)


if __name__ == "__main__":
    main()
