"""Builds the n8n example workflows shipped in the MCP products (AI Agent + MCP Client Tool)."""
import json
import re
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3] / "content" / "products"


def nid(*parts):
    return str(uuid.uuid5(uuid.NAMESPACE_URL, "insider-mcp/" + "/".join(parts)))


def mcp_node(wf, name, url, pos, auth="bearerAuth", cred=None, note=None):
    params = {"endpointUrl": url, "serverTransport": "httpStreamable", "authentication": auth, "include": "all", "options": {}}
    n = {"id": nid(wf, name), "name": name, "type": "@n8n/n8n-nodes-langchain.mcpClientTool", "typeVersion": 1.4,
         "position": pos, "parameters": params}
    if cred:
        n["credentials"] = {cred: {"id": "REPLACE_ME", "name": name}}
    if note:
        n["notes"] = note
        n["notesInFlow"] = False
    return n


def model(wf, pos):
    return {"id": nid(wf, "model"), "name": "OpenAI Chat Model", "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi", "typeVersion": 1.3,
            "position": pos, "parameters": {"model": {"__rl": True, "mode": "list", "value": "gpt-5-mini", "cachedResultName": "gpt-5-mini"},
                                            "builtInTools": {}, "responsesApiEnabled": False, "options": {}},
            "credentials": {"openAiApi": {"id": "REPLACE_ME", "name": "OpenAI account"}}}


def sticky(wf, name, pos, text, w=520, h=300):
    return {"id": nid(wf, name), "name": name, "type": "n8n-nodes-base.stickyNote", "typeVersion": 1, "position": pos,
            "parameters": {"content": text, "width": w, "height": h, "color": 5}}


def starter():
    wf = "starter"
    system = (
        "Ты — рабочий ассистент компании. У тебя есть доступ к базе данных (только чтение), к GitHub (только чтение) "
        "и к HubSpot CRM.\n"
        "- Перед SQL-запросом посмотри схему через search_objects; не угадывай названия таблиц и колонок.\n"
        "- Запросы к базе — только SELECT, с LIMIT. Не показывай целиком персональные данные клиентов, если об этом не просили.\n"
        "- В HubSpot сначала покажи, что собираешься изменить, и меняй только после явного «да» пользователя.\n"
        "- Если данных не хватает — так и скажи, не придумывай цифры.")
    nodes = [
        sticky(wf, "Read Me", [-560, -380], (
            "## Агент с MCP: база, GitHub, HubSpot\n"
            "1. **OpenAI Chat Model** — ваш ключ.\n"
            "2. **db** (Postgres через DBHub) — адрес вашего DBHub в режиме HTTP и Bearer-токен из `--auth-token` (docs/06-n8n.md).\n"
            "3. **github** — Bearer = fine-grained PAT. Адрес `/mcp/readonly` — только чтение.\n"
            "4. **hubspot** — ключ MCP OAuth2 с client id/secret вашего MCP-коннектора HubSpot.\n"
            "Лишний сервер просто удалите. Имя узла становится приставкой к инструментам (`db_execute_sql`) — держите имена короткими.\n"
            "Открывайте чат кнопкой **Open chat**."), w=560, h=340),
        {"id": nid(wf, "chat"), "name": "When chat message received", "type": "@n8n/n8n-nodes-langchain.chatTrigger", "typeVersion": 1.4,
         "position": [-520, 0], "parameters": {"options": {}}, "webhookId": nid(wf, "chat-hook")},
        {"id": nid(wf, "agent"), "name": "AI Agent", "type": "@n8n/n8n-nodes-langchain.agent", "typeVersion": 3.1, "position": [-220, 0],
         "parameters": {"options": {"systemMessage": system, "maxIterations": 10}}},
        model(wf, [-380, 240]),
        {"id": nid(wf, "mem"), "name": "Memory", "type": "@n8n/n8n-nodes-langchain.memoryBufferWindow", "typeVersion": 1.3,
         "position": [-220, 240], "parameters": {"contextWindowLength": 10}},
        mcp_node(wf, "db", "http://dbhub:8080/mcp", [-60, 240], cred="httpBearerAuth"),
        mcp_node(wf, "github", "https://api.githubcopilot.com/mcp/readonly", [100, 240], cred="httpBearerAuth"),
        mcp_node(wf, "hubspot", "https://mcp.hubspot.com", [260, 240], auth="mcpOAuth2Api", cred="mcpOAuth2Api"),
    ]
    conns = {
        "When chat message received": {"main": [[{"node": "AI Agent", "type": "main", "index": 0}]]},
        "OpenAI Chat Model": {"ai_languageModel": [[{"node": "AI Agent", "type": "ai_languageModel", "index": 0}]]},
        "Memory": {"ai_memory": [[{"node": "AI Agent", "type": "ai_memory", "index": 0}]]},
    }
    for n in ("db", "github", "hubspot"):
        conns[n] = {"ai_tool": [[{"node": "AI Agent", "type": "ai_tool", "index": 0}]]}
    return {"name": "Агент с MCP: база, GitHub, HubSpot", "nodes": nodes, "connections": conns,
            "settings": {"executionOrder": "v1"}, "pinData": {}, "meta": {"templateCredsSetupCompleted": False}}


def inbox():
    wf = "inbox"
    prompt_md = (ROOT / "mcp-telegram-inbox" / "prompts" / "agent-request.md").read_text(encoding="utf-8")
    task = re.search(r"```text\n(.*?)```", prompt_md, re.S).group(1).strip()
    nodes = [
        sticky(wf, "Read Me", [-560, -380], (
            "## Разбор рабочего чата каждые 15 минут\n"
            "Агент забирает новые сообщения через MCP-сервер Telegram Inbox, заводит лиды, передаёт спорное менеджеру.\n\n"
            "1. Запустите сервер в режиме HTTP рядом с n8n (docs/03-clients.md).\n"
            "2. **inbox** — его адрес и Bearer-токен = `MCP_HTTP_TOKEN`.\n"
            "3. **OpenAI Chat Model** — ваш ключ.\n"
            "4. Опубликуйте. Расписание — в узле **Every 15 minutes**."), w=560, h=300),
        {"id": nid(wf, "sched"), "name": "Every 15 minutes", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2, "position": [-520, 0],
         "parameters": {"rule": {"interval": [{"field": "minutes", "minutesInterval": 15}]}}},
        {"id": nid(wf, "agent"), "name": "AI Agent", "type": "@n8n/n8n-nodes-langchain.agent", "typeVersion": 3.1, "position": [-220, 0],
         "parameters": {"promptType": "define", "text": task,
                        "options": {"systemMessage": "Ты разбираешь рабочий чат продаж. Действуешь только через инструменты Telegram Inbox и строго по заданию.",
                                    "maxIterations": 25}}},
        model(wf, [-300, 240]),
        mcp_node(wf, "inbox", "http://telegram-inbox:8765/mcp", [-100, 240], cred="httpBearerAuth"),
    ]
    conns = {
        "Every 15 minutes": {"main": [[{"node": "AI Agent", "type": "main", "index": 0}]]},
        "OpenAI Chat Model": {"ai_languageModel": [[{"node": "AI Agent", "type": "ai_languageModel", "index": 0}]]},
        "inbox": {"ai_tool": [[{"node": "AI Agent", "type": "ai_tool", "index": 0}]]},
    }
    return {"name": "Telegram Inbox — разбор чата", "nodes": nodes, "connections": conns,
            "settings": {"executionOrder": "v1"}, "pinData": {}, "meta": {"templateCredsSetupCompleted": False}}


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    write(ROOT / "mcp-starter-pack-business" / "clients" / "n8n-agent-mcp.n8n.json", starter())
    write(ROOT / "mcp-telegram-inbox" / "clients" / "n8n-inbox-triage.n8n.json", inbox())
    print("ok")
