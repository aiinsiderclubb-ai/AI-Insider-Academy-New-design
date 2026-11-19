"""Builds content/products/appointment-booking-agent."""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parent / "sales"))
from nk import PRODUCTS, Flow, Tool, write_json, placeholders_only, no_secrets  # noqa: E402
import chassis  # noqa: E402
import nk  # noqa: E402

nk.CRED_NAMES.setdefault("smtp", "SMTP account")

SLUG = "appointment-booking-agent"
OUT = PRODUCTS / SLUG
TIME = (HERE / "js" / "time.js").read_text(encoding="utf8")


def code(name):
    return chassis.load_js(HERE / "js" / f"{name}.js").replace("// @include time.js\n", TIME + "\n")


TOOLS = [
    Tool("list_services", "Список услуг: service_id, название, длительность, цена, описание, часовой пояс компании. Вызывай, когда клиент выбирает услугу.",
         [("topic", "string", "Что ищет клиент своими словами; пустая строка — показать все")], required=["topic"]),
    Tool("check_availability",
         "Свободное время по календарю на день (и ближайшие дни, если этот занят). Предлагай клиенту только время из ответа.",
         [("service_id", "string", "service_id из list_services"),
          ("date", "string", "YYYY-MM-DD, today, tomorrow, +N (через N дней) или день недели по-английски: mon…sun"),
          ("part_of_day", "string", "morning, afternoon, evening или any"),
          ("client_timezone", "string", "Часовой пояс клиента IANA (Europe/Warsaw), если он не совпадает с часовым поясом компании; иначе пустая строка")]),
    Tool("book_appointment",
         "Создаёт запись в календаре. Только после того, как клиент ответил «да» на повтор деталей. Возвращает код записи.",
         [("service_id", "string", "service_id из list_services"),
          ("slot_start", "string", "slot_start из ответа check_availability"),
          ("name", "string", "Имя клиента"),
          ("email", "string", "Email клиента; пустая строка, если не дал"),
          ("phone", "string", "Телефон клиента; пустая строка, если не дал"),
          ("notes", "string", "Что клиент хочет обсудить, коротко; пустая строка, если ничего")]),
    Tool("find_booking", "Находит предстоящую запись по коду из подтверждения.",
         [("booking_code", "string", "Код записи, 6 символов")]),
    Tool("reschedule_booking", "Переносит запись на новое время. Только после «да» клиента на повтор нового времени.",
         [("booking_code", "string", "Код записи"),
          ("new_slot_start", "string", "slot_start из ответа check_availability"),
          ("client_timezone", "string", "Часовой пояс клиента IANA или пустая строка")]),
    Tool("cancel_booking", "Отменяет запись. Только после «да» клиента на вопрос об отмене.",
         [("booking_code", "string", "Код записи"),
          ("reason", "string", "Причина, если клиент назвал; иначе пустая строка")]),
    Tool("handoff_to_human", "Передаёт диалог менеджеру и уведомляет команду: оплата, нестандартный запрос, недовольство, просьба позвать человека, повторные ошибки.",
         chassis.HANDOFF_PARAMS),
]

INPUTS = ["tool", "topic", "service_id", "date", "part_of_day", "client_timezone", "slot_start", "name", "email", "phone", "notes",
          "booking_code", "new_slot_start", "reason", "summary", "urgency",
          "session_id", "channel", "customer_name", "customer_contact", "customer_email", "customer_phone", "chat_id", "last_message"]

README_NOTE = (
    "## Appointment Booking Agent\n"
    "Записывает клиентов в Google Календарь из чата на сайте и Telegram: услуги, свободное время, подтверждение, "
    "код записи, перенос, отмена, напоминания.\n\n"
    "**Перед запуском:**\n"
    "1. **Config** — компания, часовой пояс, рабочие часы, услуги, календарь, ID таблицы, чат команды, `agent_token`.\n"
    "2. Ключи: модель (**OpenAI Chat Model** или **Anthropic Chat Model**), Google Calendar (**Calendar Read/Write**, "
    "**Reminders Read**, **Mark Reminded**), Google Sheets (**Log**), Telegram.\n"
    "3. Publish. Напоминания идут по расписанию только у опубликованного воркфлоу.\n\n"
    "Подробно — QUICKSTART.md.")


def build():
    prompt = (OUT / "agent" / "system-prompt.md").read_text(encoding="utf8").strip()
    f = Flow("Appointment Booking Agent", SLUG)
    chassis.build_chat(f, slug=SLUG, path="booking-agent", prompt=prompt, config_code=code("config"), tools=TOOLS,
                       inputs=INPUTS, readme_note=README_NOTE, schedule={"minutes": 15, "kind": "reminder"})
    chassis.canned_to_alert(f)

    y = 820
    f.code("Plan", (320, y), code("plan"))
    for i in range(6):  # every calendar tool goes through Plan
        f.connect("Tool Switch", "Plan", i)
    f.if_("Needs Calendar?", (540, y), "={{ $json.needs_calendar }}")
    f.connect("Plan", "Needs Calendar?")
    f.node("Calendar Read", "n8n-nodes-base.httpRequest", 4.2, (760, y - 80), {
        "method": "GET", "url": "={{ $json.http.url }}", "options": {"timeout": 15000},
        "authentication": "predefinedCredentialType", "nodeCredentialType": "googleCalendarOAuth2Api"},
        creds=["googleCalendarOAuth2Api"], onError="continueRegularOutput")
    f.connect("Needs Calendar?", "Calendar Read", 0)
    f.code("Decide", (980, y - 80), code("decide"))
    f.connect("Calendar Read", "Decide")
    f.if_("Needs Write?", (1200, y - 80), "={{ $json.needs_write }}")
    f.connect("Decide", "Needs Write?")
    f.node("Calendar Write", "n8n-nodes-base.httpRequest", 4.2, (1420, y - 160), {
        "method": "={{ $json.http.method }}", "url": "={{ $json.http.url }}", "sendBody": True, "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify($json.http.body) }}", "options": {"timeout": 15000},
        "authentication": "predefinedCredentialType", "nodeCredentialType": "googleCalendarOAuth2Api"},
        creds=["googleCalendarOAuth2Api"], onError="continueRegularOutput")
    f.connect("Needs Write?", "Calendar Write", 0)
    f.code("Finish", (1640, y - 160), code("finish"))
    f.connect("Calendar Write", "Finish")
    f.if_("Tell Team?", (1860, y - 160), "={{ Boolean($json.team_message) && $('Config').first().json.config.notify_team }}")
    f.connect("Finish", "Tell Team?")
    f.telegram("Booking Notice", (2080, y - 240), "={{ $('Config').first().json.config.team_chat_id }}",
               "={{ $json.team_message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }}")
    f.connect("Tell Team?", "Booking Notice", 0)
    f.code("Booking Result", (2300, y - 80), code("tool_result"))
    f.connect("Booking Notice", "Booking Result")
    f.connect("Tell Team?", "Booking Result", 1)
    f.connect("Needs Write?", "Booking Result", 1)
    f.connect("Needs Calendar?", "Booking Result", 1)

    chassis.handoff_branch(f, (320, y + 260), 6)
    chassis.unknown_branch(f, (320, y + 380), 7)

    # ---- reminders ----
    ry = y + 560
    f.sticky("Reminders Note", (-660, ry - 40), (
        "### Напоминания\nКаждые 15 минут: записи агента на ближайшие сутки → кому пора напомнить "
        "(`reminder_hours` в Config) → Telegram или email → отметка в событии, чтобы не повторять."), w=540, h=180, color=4)
    f.code("Reminders Plan", (80, ry), code("reminders_plan"))
    f.connect("Kind", "Reminders Plan", 2)
    f.node("Reminders Read", "n8n-nodes-base.httpRequest", 4.2, (300, ry), {
        "method": "GET", "url": "={{ $json.url }}", "options": {"timeout": 15000},
        "authentication": "predefinedCredentialType", "nodeCredentialType": "googleCalendarOAuth2Api"},
        creds=["googleCalendarOAuth2Api"], onError="continueRegularOutput")
    f.connect("Reminders Plan", "Reminders Read")
    f.code("Pick Due", (520, ry), code("reminders_pick"))
    f.connect("Reminders Read", "Pick Due")
    f.switch("Reminder Via", (740, ry), "={{ $json.via }}", ["telegram", "email", "none"], fallback=False)
    f.connect("Pick Due", "Reminder Via")
    f.telegram("Telegram Reminder", (960, ry - 100), "={{ $json.chat_id }}", "={{ $json.text_html }}")
    f.connect("Reminder Via", "Telegram Reminder", 0)
    f.node("Email Reminder", "n8n-nodes-base.emailSend", 2.1, (960, ry + 40), {
        "fromEmail": "ВАШ_АДРЕС@example.com", "toEmail": "={{ $json.email }}", "subject": "={{ $json.subject }}",
        "emailFormat": "text", "text": "={{ $json.text }}", "options": {}}, creds=["smtp"], onError="continueRegularOutput")
    f.connect("Reminder Via", "Email Reminder", 1)
    f.node("Mark Reminded", "n8n-nodes-base.httpRequest", 4.2, (1180, ry), {
        "method": "PATCH", "url": "={{ $('Pick Due').item.json.patch.url }}", "sendBody": True, "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify($('Pick Due').item.json.patch.body) }}", "options": {"timeout": 15000},
        "authentication": "predefinedCredentialType", "nodeCredentialType": "googleCalendarOAuth2Api"},
        creds=["googleCalendarOAuth2Api"], onError="continueRegularOutput")
    f.connect("Telegram Reminder", "Mark Reminded")
    f.connect("Email Reminder", "Mark Reminded")
    f.connect("Reminder Via", "Mark Reminded", 2)

    wf = f.render()
    placeholders_only(wf)
    return wf


if __name__ == "__main__":
    wf = build()
    write_json(OUT / "workflows" / f"{SLUG}.n8n.json", wf)
    write_json(OUT / "workflows" / "error-alert.n8n.json", chassis.error_flow(SLUG, "агент записи"))
    chassis.write_schemas(OUT, TOOLS)
    no_secrets(json.dumps(wf))
    print("nodes:", len(wf["nodes"]))
