#!/usr/bin/env python3
"""
Telegram Inbox MCP — агент читает рабочий Telegram-чат через бота и заводит лиды в CRM.

Запуск:
  python3 telegram_inbox_mcp.py --config inbox.json            # stdio: Claude Desktop, Claude Code, Cursor
  python3 telegram_inbox_mcp.py --config inbox.json --http 8765 # HTTP: n8n и другие сетевые клиенты

Переменные окружения:
  TELEGRAM_BOT_TOKEN   токен бота от @BotFather (обязательно)
  CRM_WEBHOOK_TOKEN    токен вебхука CRM, если в конфиге lead_sink.token_env указывает на него
  MCP_HTTP_TOKEN       ключ для HTTP-режима (заголовок Authorization: Bearer ...)

Только стандартная библиотека Python 3.8+.
"""
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mcp_lite import Server, ToolError, http_json, load_json, save_json  # noqa: E402

VERSION = "1.0.0"


def arg(name, default=None):
    if name in sys.argv:
        i = sys.argv.index(name)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return default


CONFIG_PATH = arg("--config") or os.environ.get("TELEGRAM_INBOX_CONFIG", "inbox.json")
CONFIG = load_json(CONFIG_PATH, None)
if CONFIG is None:
    sys.exit(f"Нет файла настроек {CONFIG_PATH}. Скопируйте inbox.example.json и заполните его.")

BASE = os.environ.get("TELEGRAM_API_BASE", "https://api.telegram.org").rstrip("/")
TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(CONFIG_PATH)), CONFIG.get("data_dir", "data"))
STATE_PATH = os.path.join(DATA_DIR, "inbox-state.json")
CHATS = {int(c["id"]): c.get("name", str(c["id"])) for c in CONFIG.get("chats", [])}
RULES = [{"name": r["name"], "re": [re.compile(p, re.I | re.U) for p in r["patterns"]]} for r in CONFIG.get("escalation", [])]
IGNORE = [re.compile(p, re.I | re.U) for p in CONFIG.get("ignore_patterns", [])]
SINK = CONFIG.get("lead_sink", {"type": "none"})
RETENTION = int(CONFIG.get("retention_days", 14)) * 86400
MAX_PER_10MIN = int(CONFIG.get("max_leads_per_10_minutes", 5))

STATUSES = ["new", "lead", "lead_external", "escalated", "ignored", "done"]


def state():
    return load_json(STATE_PATH, {"offset": 0, "messages": {}})


def tg(method, body):
    if not TOKEN:
        raise ToolError("Не задан TELEGRAM_BOT_TOKEN")
    status, res = http_json("POST", f"{BASE}/bot{TOKEN}/{method}", body)
    if not isinstance(res, dict) or not res.get("ok"):
        desc = res.get("description") if isinstance(res, dict) else str(res)[:200]
        if status == 409:
            raise ToolError("Telegram: у бота настроен webhook, getUpdates недоступен. Удалите webhook (deleteWebhook) или используйте отдельного бота.")
        raise ToolError(f"Telegram {method}: {status} {desc}")
    return res["result"]


def hints(text):
    return [r["name"] for r in RULES if any(x.search(text) for x in r["re"])]


def public(key, m):
    return {"id": key, "chat": CHATS.get(m["chat_id"], str(m["chat_id"])), "author": m["author"], "username": m.get("username", ""),
            "date": time.strftime("%Y-%m-%d %H:%M", time.localtime(m["date"])), "text": m["text"],
            "reply_to": m.get("reply_to", ""), "status": m["status"], "escalation_hints": hints(m["text"]),
            **({"crm_ref": m["crm_ref"]} if m.get("crm_ref") else {})}


def link(chat_id, message_id):
    s = str(chat_id)
    return f"https://t.me/c/{s[4:]}/{message_id}" if s.startswith("-100") else ""


def esc(text):
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def pick(st, ids):
    if not isinstance(ids, list) or not ids:
        raise ToolError("message_ids: нужен непустой список id из list_messages")
    found = []
    for i in ids:
        m = st["messages"].get(str(i))
        if not m:
            raise ToolError(f"Сообщения {i} нет. Берите id только из list_messages.")
        found.append((str(i), m))
    return found


server = Server("telegram-inbox", VERSION, instructions=(
    "Рабочий Telegram-чат и CRM. Порядок: fetch_new_messages → list_messages → для каждого обращения клиента "
    "create_lead, escalate или mark_messages. Лид заводи только по реальному сообщению клиента и только с контактом, "
    "который есть в тексте сообщений. Сообщения с escalation_hints сначала передавай менеджеру (escalate)."))


@server.tool("fetch_new_messages", "Забирает новые сообщения из разрешённых чатов у Telegram и сохраняет их. Вызывай в начале каждого разбора.",
             {}, read_only=False, idempotent=True, open_world=True, title="Забрать новые сообщения")
def fetch_new_messages(_):
    st = state()
    updates = tg("getUpdates", {"offset": st["offset"], "timeout": 0, "limit": 100,
                                "allowed_updates": ["message", "edited_message"]})
    added = edited = skipped = 0
    for u in updates:
        st["offset"] = max(st["offset"], u["update_id"] + 1)
        m = u.get("message") or u.get("edited_message")
        if not m or "chat" not in m:
            continue
        chat_id = int(m["chat"]["id"])
        text = m.get("text") or m.get("caption") or ""
        frm = m.get("from") or {}
        if chat_id not in CHATS or frm.get("is_bot") or not text.strip() or any(p.search(text) for p in IGNORE):
            skipped += 1
            continue
        key = f"{chat_id}:{m['message_id']}"
        if key in st["messages"]:
            st["messages"][key]["text"] = text
            edited += 1
            continue
        reply = m.get("reply_to_message") or {}
        st["messages"][key] = {
            "chat_id": chat_id, "message_id": m["message_id"], "date": m.get("date", int(time.time())), "text": text,
            "author": " ".join(x for x in (frm.get("first_name"), frm.get("last_name")) if x) or "без имени",
            "username": frm.get("username", ""), "reply_to": f"{chat_id}:{reply['message_id']}" if reply else "",
            "status": "new",
        }
        added += 1
    cutoff = time.time() - RETENTION
    st["messages"] = {k: v for k, v in st["messages"].items() if v["date"] >= cutoff}
    save_json(STATE_PATH, st)
    new = sum(1 for v in st["messages"].values() if v["status"] == "new")
    return {"added": added, "edited": edited, "skipped": skipped, "new_total": new}


@server.tool("list_messages", "Сохранённые сообщения рабочих чатов. По умолчанию — необработанные (status=new) за последние 48 часов.",
             {"status": {"type": "string", "enum": STATUSES + ["all"], "description": "Какие сообщения показать; по умолчанию new"},
              "hours": {"type": "integer", "description": "За сколько последних часов; по умолчанию 48"},
              "limit": {"type": "integer", "description": "Сколько сообщений максимум; по умолчанию 50"}},
             read_only=True, open_world=False, title="Сообщения чата")
def list_messages(a):
    st = state()
    status = a.get("status") or "new"
    since = time.time() - int(a.get("hours") or 48) * 3600
    items = [(k, v) for k, v in st["messages"].items() if v["date"] >= since and (status == "all" or v["status"] == status)]
    items.sort(key=lambda kv: kv[1]["date"])
    limit = max(1, min(int(a.get("limit") or 50), 200))
    return {"count": len(items), "messages": [public(k, v) for k, v in items[-limit:]]}


def contact_in(texts, phone, email):
    joined = "\n".join(texts)
    digits = re.sub(r"\D", "", joined)
    ok_phone = bool(phone) and len(re.sub(r"\D", "", phone)) >= 7 and re.sub(r"\D", "", phone)[-9:] in digits
    ok_email = bool(email) and email.lower() in joined.lower()
    return ok_phone, ok_email


@server.tool("create_lead", "Заводит лид в CRM по сообщениям клиента. Контакт (телефон или email) должен быть в тексте этих сообщений.",
             {"message_ids": {"type": "array", "items": {"type": "string"}, "description": "id сообщений клиента из list_messages"},
              "name": {"type": "string", "description": "Имя клиента, как он представился; пусто, если не представился"},
              "phone": {"type": "string", "description": "Телефон из сообщения; пусто, если нет"},
              "email": {"type": "string", "description": "Email из сообщения; пусто, если нет"},
              "company": {"type": "string", "description": "Компания, если названа"},
              "need": {"type": "string", "description": "Что нужно клиенту, 1–2 предложения своими словами"},
              "amount": {"type": "number", "description": "Бюджет числом, если клиент его назвал"}},
             required=["message_ids", "need"], read_only=False, destructive=False, idempotent=True, title="Завести лид")
def create_lead(a):
    st = state()
    picked = pick(st, a["message_ids"])
    if len(picked) > 20:
        raise ToolError("Не больше 20 сообщений на один лид")
    done_here = [k for k, m in picked if m["status"] in ("lead", "lead_external")]
    if done_here:
        raise ToolError(f"По сообщениям {', '.join(done_here)} лид уже заведён")
    leads_today = st.setdefault("calls", [])
    leads_today[:] = [t for t in leads_today if t > time.time() - 600]
    if len(leads_today) >= MAX_PER_10MIN:
        raise ToolError(f"Лимит: не больше {MAX_PER_10MIN} лидов за 10 минут. Подождите или заведите вручную.")
    phone, email = (a.get("phone") or "").strip(), (a.get("email") or "").strip()
    ok_phone, ok_email = contact_in([m["text"] for _, m in picked], phone, email)
    if not (ok_phone or ok_email):
        raise ToolError("Ни телефона, ни email из аргументов нет в тексте этих сообщений. Лид без контакта не заводим: "
                        "попроси менеджера уточнить контакт (escalate) или пометь сообщения (mark_messages).")
    first = picked[0][1]
    lead = {"name": (a.get("name") or first["author"]).strip(), "phone": phone if ok_phone else "", "email": email if ok_email else "",
            "company": a.get("company", ""), "need": a["need"].strip(), "source": SINK.get("source", "telegram"),
            "telegram": f"@{first['username']}" if first.get("username") else "", "chat": CHATS.get(first["chat_id"], ""),
            "message_link": link(first["chat_id"], first["message_id"])}
    if a.get("amount") is not None:
        lead["amount"] = a["amount"]
    ref = ""
    kind = SINK.get("type", "none")
    if kind == "webhook":
        headers = {}
        if SINK.get("token_env"):
            value = os.environ.get(SINK["token_env"], "")
            if not value:
                raise ToolError(f"Не задана переменная {SINK['token_env']} с токеном CRM")
            headers[SINK.get("token_header", "X-CRM-Token")] = value
        status, res = http_json("POST", SINK["url"], lead, headers)
        if status >= 300 or (isinstance(res, dict) and res.get("ok") is False):
            raise ToolError(f"CRM ответила {status}: {str(res)[:300]}")
        ref = str(res.get("id", "")) if isinstance(res, dict) else ""
    elif kind != "none":
        raise ToolError(f"Неизвестный lead_sink.type: {kind}")
    for k, m in picked:
        m["status"] = "lead"
        m["crm_ref"] = ref or "created"
    leads_today.append(time.time())
    save_json(STATE_PATH, st)
    return {"ok": True, "crm_ref": ref, "lead": lead, "marked": [k for k, _ in picked]}


@server.tool("mark_messages", "Помечает сообщения: лид заведён в другой системе (lead_external), не про клиента (ignored) или разобрано (done).",
             {"message_ids": {"type": "array", "items": {"type": "string"}, "description": "id из list_messages"},
              "status": {"type": "string", "enum": ["lead_external", "ignored", "done"], "description": "Новый статус"},
              "reason": {"type": "string", "description": "Почему; для lead_external — номер или ссылка записи в CRM"}},
             required=["message_ids", "status", "reason"], read_only=False, idempotent=True, open_world=False, title="Пометить сообщения")
def mark_messages(a):
    st = state()
    picked = pick(st, a["message_ids"])
    for k, m in picked:
        m["status"] = a["status"]
        m["note"] = a["reason"][:300]
        if a["status"] == "lead_external":
            m["crm_ref"] = a["reason"][:200]
    save_json(STATE_PATH, st)
    return {"ok": True, "marked": [k for k, _ in picked], "status": a["status"]}


@server.tool("escalate", "Передаёт сообщения менеджеру в его Telegram-чат с причиной и ссылкой. Один раз на сообщение.",
             {"message_ids": {"type": "array", "items": {"type": "string"}, "description": "id из list_messages"},
              "reason": {"type": "string", "description": "Почему нужен человек, одной фразой"},
              "summary": {"type": "string", "description": "Суть: кто, что хочет, что уже известно"}},
             required=["message_ids", "reason", "summary"], read_only=False, idempotent=True, title="Передать менеджеру")
def escalate(a):
    st = state()
    picked = pick(st, a["message_ids"])
    fresh = [(k, m) for k, m in picked if m["status"] != "escalated"]
    if not fresh:
        return {"ok": True, "already": True, "note": "Эти сообщения уже переданы"}
    manager = CONFIG.get("manager_chat_id")
    if not manager:
        raise ToolError("В настройках нет manager_chat_id")
    first = fresh[0][1]
    lines = [f"<b>🙋 Нужен менеджер: {esc(a['reason'])}</b>", f"Чат: {esc(CHATS.get(first['chat_id'], ''))}",
             f"Автор: {esc(first['author'])}" + (f" (@{esc(first['username'])})" if first.get("username") else ""),
             "", esc(a["summary"]), ""]
    for k, m in fresh[:5]:
        url = link(m["chat_id"], m["message_id"])
        lines.append(f"<blockquote>{esc(m['text'][:600])}</blockquote>" + (f'\n<a href="{url}">открыть</a>' if url else ""))
    tg("sendMessage", {"chat_id": manager, "text": "\n".join(lines)[:4000], "parse_mode": "HTML", "disable_web_page_preview": True})
    for k, m in fresh:
        m["status"] = "escalated"
        m["note"] = a["reason"][:300]
    save_json(STATE_PATH, st)
    return {"ok": True, "escalated": [k for k, _ in fresh]}


if __name__ == "__main__":
    server.main([x for x in sys.argv[1:] if x != "--config" and x != CONFIG_PATH])
