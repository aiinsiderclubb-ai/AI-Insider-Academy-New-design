#!/usr/bin/env python3
"""
Google Calendar MCP — свободные слоты и запись только после явного «да» клиента.

Запуск:
  python3 calendar_mcp.py --config calendar.json             # stdio
  python3 calendar_mcp.py --config calendar.json --http 8767  # HTTP для n8n

Переменные окружения:
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN — доступ к календарю
      (refresh token выдаёт get_refresh_token.py из этого же набора)
  MCP_HTTP_TOKEN — ключ для HTTP-режима

Стандартная библиотека Python 3.9+ (zoneinfo). На Windows: pip install tzdata.
"""
import os
import re
import secrets
import sys
import time
import urllib.parse
from datetime import date, datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mcp_lite import Server, ToolError, http_json, load_json, save_json  # noqa: E402

try:
    from zoneinfo import ZoneInfo
except ImportError:  # Python 3.8
    sys.exit("Нужен Python 3.9 или новее (модуль zoneinfo)")

VERSION = "1.0.0"
DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
DAY_RU = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"]


def arg(name, default=None):
    if name in sys.argv:
        i = sys.argv.index(name)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return default


CONFIG_PATH = arg("--config") or os.environ.get("CALENDAR_MCP_CONFIG", "calendar.json")
CONFIG = load_json(CONFIG_PATH, None)
if CONFIG is None:
    sys.exit(f"Нет файла настроек {CONFIG_PATH}. Скопируйте calendar.example.json и заполните его.")

API = os.environ.get("GOOGLE_API_BASE", "https://www.googleapis.com").rstrip("/")
TOKEN_URL = os.environ.get("GOOGLE_TOKEN_URL", "https://oauth2.googleapis.com/token")
TZ_NAME = CONFIG.get("timezone", "Europe/Kyiv")
TZ = ZoneInfo(TZ_NAME)
CAL = CONFIG.get("calendar_id", "primary")
BUSY_CALS = CONFIG.get("busy_calendars") or [CAL]
HOURS = CONFIG.get("working_hours", {})
STEP = int(CONFIG.get("slot_minutes", 30))
DEFAULT_DURATION = int(CONFIG.get("default_duration_minutes", 30))
MAX_DURATION = int(CONFIG.get("max_duration_minutes", 120))
BUFFER = int(CONFIG.get("buffer_minutes", 0))
NOTICE = float(CONFIG.get("min_notice_hours", 2))
AHEAD = int(CONFIG.get("max_days_ahead", 30))
PROPOSAL_TTL = int(CONFIG.get("proposal_minutes", 15)) * 60
TITLE = CONFIG.get("title_template", "Встреча: {name}")
FOOTER = CONFIG.get("description_footer", "Запись создана ассистентом после подтверждения клиента.")
SEND_UPDATES = CONFIG.get("send_updates", "all")
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(CONFIG_PATH)), CONFIG.get("data_dir", "data"))
STATE = os.path.join(DATA_DIR, "calendar-state.json")

YES = re.compile(r"^\s*(да|ага|ок|окей|okay|ok|yes|yep|подтверждаю|подтверждаем|записывайте|запишите|записывай|верно|"
                 r"всё верно|все верно|согласен|согласна|давайте|конечно|sure|confirm|confirmed|correct)\b", re.I | re.U)
NO = re.compile(r"\b(нет|не\s|не$|отмен|передума|другое|другой|позже|no|not|cancel|wait|change)", re.I | re.U)

_token = {"value": "", "exp": 0}


def access_token():
    if _token["value"] and _token["exp"] > time.time() + 60:
        return _token["value"]
    need = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"]
    miss = [n for n in need if not os.environ.get(n)]
    if miss:
        raise ToolError(f"Не заданы переменные {', '.join(miss)}")
    status, res = http_json("POST", TOKEN_URL, {
        "client_id": os.environ["GOOGLE_CLIENT_ID"], "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
        "refresh_token": os.environ["GOOGLE_REFRESH_TOKEN"], "grant_type": "refresh_token"}, form=True)
    if status != 200 or "access_token" not in res:
        detail = res.get("error_description") or res.get("error") if isinstance(res, dict) else res
        raise ToolError(f"Google не выдал доступ: {detail}. Если приложение в режиме Testing, refresh token живёт 7 дней — получите новый.")
    _token.update(value=res["access_token"], exp=time.time() + int(res.get("expires_in", 3600)))
    return _token["value"]


def google(method, path, body=None):
    status, res = http_json(method, f"{API}/calendar/v3/{path}", body, {"Authorization": f"Bearer {access_token()}"})
    if status >= 300:
        msg = res.get("error", {}).get("message") if isinstance(res, dict) and isinstance(res.get("error"), dict) else str(res)[:200]
        raise ToolError(f"Google Calendar {status}: {msg}")
    return res


def parse_dt(text):
    s = str(text).strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        raise ToolError(f"Не понимаю время «{text}». Формат: 2026-11-25T10:00 (время календаря) или с поясом +02:00")
    return dt.replace(tzinfo=TZ) if dt.tzinfo is None else dt.astimezone(TZ)


def parse_day(text):
    try:
        return date.fromisoformat(str(text).strip()[:10])
    except ValueError:
        raise ToolError(f"Не понимаю дату «{text}». Формат: 2026-11-25")


def label(start, end):
    return f"{DAY_RU[start.weekday()]} {start:%d.%m} {start:%H:%M}–{end:%H:%M}"


def busy(start, end):
    res = google("POST", "freeBusy", {"timeMin": start.isoformat(), "timeMax": end.isoformat(), "timeZone": TZ_NAME,
                                      "items": [{"id": c} for c in BUSY_CALS]})
    out = []
    for cid in BUSY_CALS:
        cal = res.get("calendars", {}).get(cid, {})
        if cal.get("errors"):
            raise ToolError(f"Нет доступа к календарю {cid}: {cal['errors']}")
        for b in cal.get("busy", []):
            out.append((parse_dt(b["start"]) - timedelta(minutes=BUFFER), parse_dt(b["end"]) + timedelta(minutes=BUFFER)))
    return out


def window(day):
    h = HOURS.get(DAYS[day.weekday()])
    if not h:
        return None
    a, b = [datetime.combine(day, datetime.strptime(x, "%H:%M").time(), TZ) for x in h]
    return a, b


def rules_problem(start, end):
    now = datetime.now(TZ)
    if start < now + timedelta(hours=NOTICE):
        return f"Слишком скоро: запись не раньше чем через {NOTICE:g} ч"
    if start.date() > (now + timedelta(days=AHEAD)).date():
        return f"Слишком далеко: запись не дальше {AHEAD} дней вперёд"
    w = window(start.date())
    if not w or start < w[0] or end > w[1]:
        return "Вне рабочего времени"
    return None


def state():
    st = load_json(STATE, {"proposals": {}})
    cutoff = time.time() - 86400
    st["proposals"] = {k: v for k, v in st["proposals"].items() if v["created"] > cutoff}
    return st


server = Server("google-calendar-confirmed", VERSION, instructions=(
    "Запись в календарь в три шага: find_free_slots → propose_event → покажи клиенту confirmation_question дословно и дождись "
    "ответа → confirm_event с его ответом дословно. Никогда не вызывай confirm_event, пока клиент сам не ответил «да» на этот вопрос."))


@server.tool("find_free_slots", "Свободные слоты в рабочее время с учётом занятости, перерывов и минимального срока записи.",
             {"date_from": {"type": "string", "description": "Первый день, ГГГГ-ММ-ДД"},
              "date_to": {"type": "string", "description": "Последний день включительно, ГГГГ-ММ-ДД; не больше 14 дней от date_from"},
              "duration_minutes": {"type": "integer", "description": "Длительность встречи в минутах"}},
             required=["date_from"], read_only=True, idempotent=True, title="Свободные слоты")
def find_free_slots(a):
    d0 = parse_day(a["date_from"])
    d1 = parse_day(a.get("date_to") or a["date_from"])
    if d1 < d0:
        raise ToolError("date_to раньше date_from")
    d1 = min(d1, d0 + timedelta(days=13))
    dur = int(a.get("duration_minutes") or DEFAULT_DURATION)
    if not 5 <= dur <= MAX_DURATION:
        raise ToolError(f"Длительность от 5 до {MAX_DURATION} минут")
    start_all = datetime.combine(d0, datetime.min.time(), TZ)
    end_all = datetime.combine(d1 + timedelta(days=1), datetime.min.time(), TZ)
    taken = busy(start_all, end_all)
    slots = []
    day = d0
    while day <= d1 and len(slots) < 40:
        w = window(day)
        if w:
            t = w[0]
            while t + timedelta(minutes=dur) <= w[1]:
                e = t + timedelta(minutes=dur)
                if not rules_problem(t, e) and not any(t < b1 and e > b0 for b0, b1 in taken):
                    slots.append({"start": t.isoformat(), "end": e.isoformat(), "label": label(t, e)})
                t += timedelta(minutes=STEP)
        day += timedelta(days=1)
    return {"timezone": TZ_NAME, "duration_minutes": dur, "slots": slots[:40],
            "note": "Предложи клиенту 2–3 варианта. Ничего не записывай, пока клиент не выбрал время и не подтвердил (propose_event → confirm_event)."
            if slots else "Свободных слотов нет. Предложи другие даты."}


@server.tool("propose_event", "Проверяет выбранное время и готовит запись. Календарь НЕ меняет. Возвращает вопрос, который нужно показать клиенту дословно.",
             {"start": {"type": "string", "description": "Начало из find_free_slots, например 2026-11-25T10:00:00+02:00"},
              "duration_minutes": {"type": "integer", "description": "Длительность в минутах"},
              "attendee_name": {"type": "string", "description": "Имя клиента"},
              "attendee_email": {"type": "string", "description": "Email клиента для приглашения; пусто, если не дал"},
              "topic": {"type": "string", "description": "Тема встречи, коротко"}},
             required=["start", "attendee_name"], read_only=True, idempotent=False, open_world=True, title="Подготовить запись")
def propose_event(a):
    start = parse_dt(a["start"])
    dur = int(a.get("duration_minutes") or DEFAULT_DURATION)
    if not 5 <= dur <= MAX_DURATION:
        raise ToolError(f"Длительность от 5 до {MAX_DURATION} минут")
    end = start + timedelta(minutes=dur)
    problem = rules_problem(start, end)
    if problem:
        raise ToolError(problem + ". Предложи время из find_free_slots.")
    if any(start < b1 and end > b0 for b0, b1 in busy(start - timedelta(hours=1), end + timedelta(hours=1))):
        raise ToolError("Это время уже занято. Предложи другое из find_free_slots.")
    email = (a.get("attendee_email") or "").strip()
    if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise ToolError("Неверный email")
    pid = secrets.token_hex(3).upper()
    title = TITLE.format(name=a["attendee_name"].strip(), topic=(a.get("topic") or "").strip()).strip()
    question = f"Записываю: «{title}», {label(start, end)} ({TZ_NAME})" + (f", приглашение придёт на {email}" if email else "") + ". Подтверждаете?"
    st = state()
    st["proposals"][pid] = {"start": start.isoformat(), "end": end.isoformat(), "title": title, "email": email,
                            "name": a["attendee_name"].strip(), "topic": (a.get("topic") or "").strip(),
                            "created": time.time(), "question": question, "event_id": ""}
    save_json(STATE, st)
    return {"proposal_id": pid, "confirmation_question": question, "expires_in_minutes": PROPOSAL_TTL // 60,
            "note": "Покажи клиенту confirmation_question дословно и дождись ответа. Только если клиент ответил согласием — confirm_event с его ответом дословно."}


@server.tool("confirm_event", "Создаёт событие по подготовленной записи. Только после того, как клиент сам ответил согласием на confirmation_question.",
             {"proposal_id": {"type": "string", "description": "proposal_id из propose_event"},
              "user_reply": {"type": "string", "description": "Ответ клиента на вопрос подтверждения — дословно, без пересказа"}},
             required=["proposal_id", "user_reply"], read_only=False, destructive=False, idempotent=True, title="Подтвердить запись")
def confirm_event(a):
    st = state()
    pid = str(a["proposal_id"]).strip().upper()
    p = st["proposals"].get(pid)
    if not p:
        raise ToolError("Такой подготовленной записи нет. Начни с propose_event.")
    if p["event_id"]:
        return {"ok": True, "already": True, "event_id": p["event_id"], "link": p.get("link", ""), "note": "Это событие уже создано."}
    if time.time() - p["created"] > PROPOSAL_TTL:
        raise ToolError("Подтверждение устарело. Проверь время заново (propose_event) и спроси клиента ещё раз.")
    reply = a["user_reply"].strip()
    if not YES.search(reply) or NO.search(reply):
        raise ToolError("Ответ клиента не похож на однозначное «да». Ничего не записано. Уточни у клиента или предложи другое время.")
    start, end = parse_dt(p["start"]), parse_dt(p["end"])
    found = google("GET", f"calendars/{urllib.parse.quote(CAL, safe='')}/events?"
                   + urllib.parse.urlencode({"privateExtendedProperty": f"proposal={pid}", "singleEvents": "true"}))
    if found.get("items"):
        ev = found["items"][0]
    else:
        if any(start < b1 and end > b0 for b0, b1 in busy(start - timedelta(hours=1), end + timedelta(hours=1))):
            raise ToolError("Пока клиент подтверждал, это время заняли. Ничего не записано — предложи другое время.")
        body = {"summary": p["title"],
                "description": "\n".join(x for x in (p["topic"], f"Клиент: {p['name']}", f"Подтверждение клиента: «{reply[:200]}»", FOOTER) if x),
                "start": {"dateTime": start.isoformat(), "timeZone": TZ_NAME},
                "end": {"dateTime": end.isoformat(), "timeZone": TZ_NAME},
                "extendedProperties": {"private": {"proposal": pid}}}
        if p["email"]:
            body["attendees"] = [{"email": p["email"], "displayName": p["name"]}]
        ev = google("POST", f"calendars/{urllib.parse.quote(CAL, safe='')}/events?sendUpdates={SEND_UPDATES}", body)
    p["event_id"] = ev.get("id", "")
    p["link"] = ev.get("htmlLink", "")
    save_json(STATE, st)
    return {"ok": True, "event_id": p["event_id"], "link": p["link"], "when": label(start, end), "title": p["title"]}


@server.tool("cancel_proposal", "Отменяет подготовленную, но не подтверждённую запись.",
             {"proposal_id": {"type": "string", "description": "proposal_id из propose_event"}},
             required=["proposal_id"], read_only=False, idempotent=True, open_world=False, title="Отменить подготовку")
def cancel_proposal(a):
    st = state()
    p = st["proposals"].pop(str(a["proposal_id"]).strip().upper(), None)
    save_json(STATE, st)
    if p and p["event_id"]:
        raise ToolError("Событие уже создано — отменить его может только человек в календаре.")
    return {"ok": True}


@server.tool("list_events", "События календаря за период: только время и название.",
             {"date_from": {"type": "string", "description": "ГГГГ-ММ-ДД"}, "date_to": {"type": "string", "description": "ГГГГ-ММ-ДД, не больше 14 дней"}},
             required=["date_from"], read_only=True, idempotent=True, title="События")
def list_events(a):
    d0 = parse_day(a["date_from"])
    d1 = min(parse_day(a.get("date_to") or a["date_from"]), d0 + timedelta(days=13))
    q = urllib.parse.urlencode({"timeMin": datetime.combine(d0, datetime.min.time(), TZ).isoformat(),
                                "timeMax": datetime.combine(d1 + timedelta(days=1), datetime.min.time(), TZ).isoformat(),
                                "singleEvents": "true", "orderBy": "startTime", "maxResults": "100"})
    res = google("GET", f"calendars/{urllib.parse.quote(CAL, safe='')}/events?{q}")
    out = []
    for e in res.get("items", []):
        if e.get("status") == "cancelled":
            continue
        s, en = e.get("start", {}), e.get("end", {})
        out.append({"title": e.get("summary", "(без названия)"), "start": s.get("dateTime") or s.get("date"), "end": en.get("dateTime") or en.get("date")})
    return {"timezone": TZ_NAME, "events": out}


if __name__ == "__main__":
    server.main([x for x in sys.argv[1:] if x != "--config" and x != CONFIG_PATH])
