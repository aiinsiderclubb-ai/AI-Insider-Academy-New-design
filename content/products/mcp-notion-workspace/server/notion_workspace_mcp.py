#!/usr/bin/env python3
"""
Notion Workspace MCP — агент ищет ответы только в разрешённых базах Notion и пишет
строку только в одну согласованную таблицу, только в разрешённые колонки.

Запуск:
  python3 notion_workspace_mcp.py --config notion.json             # stdio
  python3 notion_workspace_mcp.py --config notion.json --http 8766  # HTTP для n8n

Переменные окружения:
  NOTION_TOKEN     токен внутренней интеграции Notion (обязательно)
  MCP_HTTP_TOKEN   ключ для HTTP-режима

Только стандартная библиотека Python 3.8+. API Notion версии 2026-03-11.
"""
import math
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mcp_lite import Server, ToolError, http_json, load_json  # noqa: E402

VERSION = "1.0.0"
NOTION_VERSION = "2026-03-11"


def arg(name, default=None):
    if name in sys.argv:
        i = sys.argv.index(name)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return default


CONFIG_PATH = arg("--config") or os.environ.get("NOTION_MCP_CONFIG", "notion.json")
CONFIG = load_json(CONFIG_PATH, None)
if CONFIG is None:
    sys.exit(f"Нет файла настроек {CONFIG_PATH}. Скопируйте notion.example.json и заполните его.")

BASE = os.environ.get("NOTION_API_BASE", "https://api.notion.com").rstrip("/")
TOKEN = os.environ.get("NOTION_TOKEN", "")
SOURCES = CONFIG.get("knowledge", [])
TARGET = CONFIG.get("target") or {}
CACHE_SECONDS = int(CONFIG.get("cache_minutes", 5)) * 60
MAX_ROWS = int(CONFIG.get("max_rows_per_source", 500))
PAGE_CHARS = int(CONFIG.get("page_chars", 6000))
MIN_SCORE = float(CONFIG.get("min_score", 0.3))
_cache = {}


def norm_id(value):
    return re.sub(r"[^0-9a-f]", "", str(value).lower())


ALLOWED = {norm_id(s["data_source_id"]): s for s in SOURCES}


def notion(method, path, body=None, query=""):
    if not TOKEN:
        raise ToolError("Не задан NOTION_TOKEN")
    status, res = http_json(method, f"{BASE}/v1/{path}{query}", body,
                            {"Authorization": f"Bearer {TOKEN}", "Notion-Version": NOTION_VERSION})
    if status >= 300:
        msg = res.get("message") if isinstance(res, dict) else str(res)[:200]
        if status == 404:
            raise ToolError(f"Notion: не найдено или нет доступа ({msg}). Проверьте, что база подключена к интеграции.")
        raise ToolError(f"Notion {status}: {msg}")
    return res


# ---------- текст и поиск ----------
STOP = set("и в во не что на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему когда даже ну ли если уже или ни быть был до вас вам там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам без кто этот того потому этого какой здесь этом один мой тем чтобы нее можно при об эти нас про всего них какая много три эту моя свою этой перед лучше том такой им более всю между это как где когда какие the a an and or of to in on for is are be it this that with as at by from how what can".split())


def stem(word):
    w = word.lower().replace("ё", "е")
    if re.fullmatch(r"[a-z]+", w):
        return re.sub(r"(ing|ed|es|s)$", "", w)[:7]
    w = re.sub(r"(ями|ами|иями|ого|ему|ому|ыми|ими|его|ая|яя|ое|ее|ие|ые|ой|ей|ий|ый|ов|ев|ам|ям|ах|ях|ом|ем|ую|юю|ть|ти|ет|ют|ут|ит|ат|ят|ла|ло|ли|ся|сь|а|я|о|е|и|ы|у|ю|ь|й)$", "", w)
    return w[:6]


def terms(text):
    return [stem(w) for w in re.findall(r"\w+", str(text).lower()) if len(w) > 1 and w not in STOP and not w.isdigit() or (w.isdigit() and len(w) > 2)]


def prop_text(p):
    t = p.get("type")
    v = p.get(t)
    if t in ("title", "rich_text"):
        return "".join(x.get("plain_text", "") for x in v or [])
    if t in ("select", "status"):
        return (v or {}).get("name", "")
    if t == "multi_select":
        return ", ".join(x.get("name", "") for x in v or [])
    if t == "date":
        return (v or {}).get("start", "")
    if t in ("number", "url", "email", "phone_number", "checkbox"):
        return "" if v is None else str(v)
    return ""


def title_of(page):
    for p in page.get("properties", {}).values():
        if p.get("type") == "title":
            return prop_text(p)
    return ""


def rows(source):
    sid = source["data_source_id"]
    hit = _cache.get(sid)
    if hit and hit[0] > time.time() - CACHE_SECONDS:
        return hit[1]
    out, cursor = [], None
    while len(out) < MAX_ROWS:
        body = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        res = notion("POST", f"data_sources/{sid}/query", body)
        for page in res.get("results", []):
            if page.get("in_trash") or page.get("is_archived"):
                continue
            props = page.get("properties", {})
            text = " ".join(prop_text(props[n]) for n in source.get("text_properties", []) if n in props)
            out.append({"id": page["id"], "url": page.get("url", ""), "title": title_of(page), "text": text,
                        "source": source.get("name", sid)})
        if not res.get("has_more"):
            break
        cursor = res.get("next_cursor")
    _cache[sid] = (time.time(), out)
    return out


server = Server("notion-workspace", VERSION, instructions=(
    "База знаний в Notion. Отвечай на вопросы только по тому, что вернули search_knowledge и read_page; если ничего не "
    "нашлось — так и скажи. Записывать можно только append_row в одну таблицу; перед первой записью вызови describe_target."))


@server.tool("search_knowledge", "Ищет статьи в разрешённых базах Notion по словам вопроса. Возвращает до 5 статей с оценкой 0–1 или found=false.",
             {"query": {"type": "string", "description": "Вопрос или ключевые слова"},
              "limit": {"type": "integer", "description": "Сколько статей вернуть, 1–5; по умолчанию 3"}},
             required=["query"], read_only=True, idempotent=True, title="Поиск в базе знаний")
def search_knowledge(a):
    if not SOURCES:
        raise ToolError("В настройках нет ни одной базы знаний (knowledge)")
    q = list(dict.fromkeys(terms(a["query"])))
    if not q:
        raise ToolError("Пустой запрос: передайте слова вопроса")
    docs = []
    for s in SOURCES:
        for r in rows(s):
            docs.append((r, set(terms(r["title"])), set(terms(r["text"]))))
    df = {}
    for _, head, body in docs:
        for t in head | body:
            df[t] = df.get(t, 0) + 1
    idf = {t: math.log(1 + len(docs) / df.get(t, 0.5)) for t in q}
    total = sum(idf.values()) or 1
    scored = []
    for r, head, body in docs:
        hit = sum(idf[t] if t in head else idf[t] * 0.6 if t in body else 0 for t in q)
        if hit:
            scored.append({**{k: r[k] for k in ("id", "url", "title", "source")}, "snippet": r["text"][:400],
                           "score": round(hit / total, 2)})
    scored.sort(key=lambda x: -x["score"])
    top = scored[: max(1, min(int(a.get("limit") or 3), 5))]
    found = bool(top) and top[0]["score"] >= MIN_SCORE
    return {"found": found, "results": top if found else [],
            "note": "Чтобы прочитать статью целиком — read_page с её id." if found
            else "В разрешённых базах ответа нет. Не отвечай по памяти — скажи, что в базе этого нет."}


@server.tool("read_page", "Текст статьи из разрешённой базы в формате Markdown.",
             {"page_id": {"type": "string", "description": "id статьи из search_knowledge"}},
             required=["page_id"], read_only=True, idempotent=True, title="Прочитать статью")
def read_page(a):
    page = notion("GET", f"pages/{norm_id(a['page_id'])}")
    parent = page.get("parent", {})
    if norm_id(parent.get("data_source_id", "")) not in ALLOWED:
        raise ToolError("Эта страница не из разрешённых баз знаний — читать её нельзя.")
    md = notion("GET", f"pages/{norm_id(a['page_id'])}/markdown", query="?markdown_version=v2")
    text = md.get("markdown", "")
    return {"id": page["id"], "title": title_of(page), "url": page.get("url", ""),
            "markdown": text[:PAGE_CHARS], "cut": len(text) > PAGE_CHARS or bool(md.get("truncated"))}


def target_schema():
    if not TARGET.get("data_source_id"):
        raise ToolError("Таблица для записи (target) не настроена")
    ds = notion("GET", f"data_sources/{TARGET['data_source_id']}")
    props = ds.get("properties", {})
    cols = {}
    for name, rule in TARGET.get("columns", {}).items():
        if name not in props:
            raise ToolError(f"В таблице Notion нет колонки «{name}» из настроек")
        p = props[name]
        t = p["type"]
        options = [o["name"] for o in (p.get(t) or {}).get("options", [])] if t in ("select", "multi_select", "status") else None
        cols[name] = {"type": t, "required": bool(rule.get("required")), "fixed": rule.get("fixed"),
                      **({"options": options} if options is not None else {}),
                      **({"max_length": rule["max_length"]} if rule.get("max_length") else {})}
    return cols


WRITABLE = {"title", "rich_text", "number", "select", "multi_select", "status", "date", "email", "phone_number", "url", "checkbox"}


def to_notion(name, col, value):
    t = col["type"]
    if t not in WRITABLE:
        raise ToolError(f"Колонку «{name}» типа {t} писать нельзя")
    if t in ("title", "rich_text"):
        text = str(value)[: col.get("max_length", 2000)]
        return {t: [{"text": {"content": text}}]}
    if t == "number":
        try:
            return {"number": float(value)}
        except (TypeError, ValueError):
            raise ToolError(f"«{name}»: нужно число")
    if t in ("select", "status"):
        if value not in col.get("options", []):
            raise ToolError(f"«{name}»: допустимо одно из {col.get('options')}")
        return {t: {"name": value}}
    if t == "multi_select":
        vals = value if isinstance(value, list) else [v.strip() for v in str(value).split(",") if v.strip()]
        bad = [v for v in vals if v not in col.get("options", [])]
        if bad:
            raise ToolError(f"«{name}»: нет вариантов {bad}; допустимо {col.get('options')}")
        return {"multi_select": [{"name": v} for v in vals]}
    if t == "date":
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)?)?", str(value)):
            raise ToolError(f"«{name}»: дата в формате ГГГГ-ММ-ДД")
        return {"date": {"start": str(value)}}
    if t == "email":
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", str(value)):
            raise ToolError(f"«{name}»: неверный email")
        return {"email": str(value)}
    if t == "phone_number":
        if len(re.sub(r"\D", "", str(value))) < 7:
            raise ToolError(f"«{name}»: неверный телефон")
        return {"phone_number": str(value)}
    if t == "url":
        if not re.match(r"https?://", str(value)):
            raise ToolError(f"«{name}»: ссылка должна начинаться с http(s)://")
        return {"url": str(value)}
    if t == "checkbox":
        return {"checkbox": value in (True, "true", "да", "yes", 1)}
    raise ToolError(f"Колонку «{name}» писать нельзя")


@server.tool("describe_target", "Колонки таблицы, в которую разрешено писать: тип, обязательность, допустимые варианты. Вызывай перед append_row.",
             {}, read_only=True, idempotent=True, title="Колонки таблицы")
def describe_target(_):
    cols = target_schema()
    return {"table": TARGET.get("name", ""), "columns": {k: {kk: vv for kk, vv in v.items() if kk != "fixed" or vv is not None}
                                                          for k, v in cols.items() if v.get("fixed") is None},
            "set_by_server": {k: v["fixed"] for k, v in cols.items() if v.get("fixed") is not None}}


@server.tool("append_row", "Добавляет одну строку в согласованную таблицу Notion. Только колонки из describe_target.",
             {"values": {"type": "object", "description": "Колонка → значение. Для multi_select — список."}},
             required=["values"], read_only=False, destructive=False, idempotent=False, title="Добавить строку")
def append_row(a):
    cols = target_schema()
    values = dict(a["values"])
    extra = [k for k in values if k not in cols or cols[k].get("fixed") is not None]
    if extra:
        raise ToolError(f"Эти колонки писать нельзя: {extra}. Разрешены: {[k for k, v in cols.items() if v.get('fixed') is None]}")
    missing = [k for k, v in cols.items() if v["required"] and v.get("fixed") is None and str(values.get(k, "")).strip() == ""]
    if missing:
        raise ToolError(f"Не заполнены обязательные колонки: {missing}")
    for k, v in cols.items():
        if v.get("fixed") is not None:
            values[k] = v["fixed"]
    dedupe = TARGET.get("dedupe_column")
    if dedupe and values.get(dedupe):
        cols_d = cols[dedupe]
        kind = {"title": "title", "rich_text": "rich_text", "email": "email", "phone_number": "phone_number", "url": "url"}.get(cols_d["type"])
        if kind:
            res = notion("POST", f"data_sources/{TARGET['data_source_id']}/query",
                         {"page_size": 1, "filter": {"property": dedupe, kind: {"equals": str(values[dedupe])}}})
            if res.get("results"):
                old = res["results"][0]
                return {"ok": True, "duplicate": True, "id": old["id"], "url": old.get("url", ""),
                        "note": f"Строка с таким значением «{dedupe}» уже есть — новую не создаю."}
    properties = {k: to_notion(k, cols[k], v) for k, v in values.items() if str(v).strip() != ""}
    page = notion("POST", "pages", {"parent": {"data_source_id": TARGET["data_source_id"]}, "properties": properties})
    return {"ok": True, "duplicate": False, "id": page.get("id"), "url": page.get("url", "")}


if __name__ == "__main__":
    server.main([x for x in sys.argv[1:] if x != "--config" and x != CONFIG_PATH])
