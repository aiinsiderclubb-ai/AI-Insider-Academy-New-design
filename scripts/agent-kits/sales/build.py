"""Builds content/products/sales-agent-template."""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))
from nk import PRODUCTS, SHEETS, Flow, Tool, write_json, placeholders_only, no_secrets  # noqa: E402
import nk  # noqa: E402
import chassis  # noqa: E402

nk.CRED_NAMES.setdefault("smtp", "SMTP account")
SLUG = "sales-agent-template"
OUT = PRODUCTS / SLUG
INCLUDES = {name: (HERE / "js" / f"{name}.js").read_text(encoding="utf8") for name in ("rank", "lead_cols")}


def code(name):
    src = chassis.load_js(HERE / "js" / f"{name}.js")
    for inc, body in INCLUDES.items():
        src = src.replace(f"// @include {inc}.js\n", body + "\n")
    return src


TOOLS = [
    Tool("search_catalog", "Ищет товары и услуги в каталоге: название, описание, цена, наличие, есть ли онлайн-оплата. Цены и условия — только отсюда.",
         [("query", "string", "Задача или товар клиента ключевыми словами")]),
    Tool("get_sales_facts", "Одобренные ответы на возражения и вопросы о гарантиях, сроках, кейсах, сравнении с конкурентами. Вызывай перед ответом на возражение.",
         [("topic", "string", "Суть возражения или вопроса: дорого, гарантия, сроки внедрения, сравнение с конкурентом")]),
    Tool("save_lead", "Сохраняет то, что известно о клиенте, считает баллы квалификации и говорит, чего не хватает. Вызывай каждый раз, когда узнал новое.",
         [("name", "string", "Имя клиента или пустая строка"),
          ("email", "string", "Email или пустая строка"),
          ("phone", "string", "Телефон или пустая строка"),
          ("need", "string", "Какую задачу решает клиент, его словами; пустая строка, если не известно"),
          ("budget", "string", "Бюджет, как назвал клиент: «около 2 тыс €»; пустая строка, если не известно"),
          ("timeline", "string", "Когда нужно: «в этом месяце», «через квартал»; пустая строка, если не известно"),
          ("authority", "string", "Кто решает: «я», «с партнёром», «руководитель»; пустая строка, если не известно"),
          ("product_id", "string", "product_id из каталога, который обсуждаете; пустая строка, если нет"),
          ("stage", "string", "new, qualifying, offer_sent, call_booked, won или lost; пустая строка — не менять"),
          ("notes", "string", "Важное для менеджера: возражения, детали; пустая строка, если нечего")]),
    Tool("send_offer", "Следующий шаг по товару: kind=payment — ссылка на оплату из каталога; kind=quote — запрос коммерческого предложения менеджеру.",
         [("product_id", "string", "product_id из search_catalog"),
          ("kind", "string", "payment или quote"),
          ("email", "string", "Email клиента для КП; пустая строка для payment"),
          ("notes", "string", "Что важно учесть в КП; пустая строка, если ничего")]),
    Tool("book_call", "Ссылка, по которой клиент сам выберет время звонка с менеджером; команда получает сигнал.",
         [("topic", "string", "О чём звонок, одной фразой"),
          ("preferred_time", "string", "Когда клиенту удобно, если сказал; иначе пустая строка")]),
    Tool("handoff_to_human", "Передаёт диалог менеджеру: крупная сделка, особые условия, просьба позвать человека, недовольство.",
         chassis.HANDOFF_PARAMS),
]

INPUTS = ["tool", "query", "topic", "name", "email", "phone", "need", "budget", "timeline", "authority", "product_id", "stage", "notes",
          "kind", "preferred_time", "reason", "summary", "urgency",
          "session_id", "channel", "customer_name", "customer_contact", "customer_email", "customer_phone", "chat_id", "last_message"]

README_NOTE = (
    "## Sales Agent\n"
    "Продаёт в чате на сайте и в Telegram: каталог, квалификация (задача, бюджет, сроки, решение), "
    "ответы на возражения только одобренными формулировками, ссылка на оплату, КП или звонок, follow-up замолчавшим.\n\n"
    "**Перед запуском:**\n"
    "1. **Config** — компания, пороги баллов, ссылка на звонок, follow-up, ID таблицы, чат продаж, `agent_token`.\n"
    "2. Ключи: модель, Google Sheets (все узлы `Read …`, `Write Lead`, `Log`, `Follow-up …`), Telegram.\n"
    "3. Publish: follow-up работает по расписанию только у опубликованного воркфлоу.\n\n"
    "Подробно — QUICKSTART.md.")


def sheets_read(f, name, pos, rng):
    f.http(name, pos, "GET", f"={SHEETS}/{{{{ $('Config').first().json.config.spreadsheet_id }}}}/values/{rng}",
           cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")


def build():
    prompt = (OUT / "agent" / "system-prompt.md").read_text(encoding="utf8").strip()
    f = Flow("Sales Agent", SLUG)
    chassis.build_chat(f, slug=SLUG, path="sales-agent", prompt=prompt, config_code=code("config"), tools=TOOLS,
                       inputs=INPUTS, readme_note=README_NOTE, schedule={"minutes": 30, "kind": "followup"})

    # opt-out: canned answer + a row in OptOut so the follow-up never writes again
    f.if_("Opt-out?", (780, 220), "={{ $json.kind === 'optout' }}")
    f.connect("Canned", "Opt-out?")
    f.http("Add Opt-out", (1000, 300), "POST",
           f"={SHEETS}/{{{{ $('Config').first().json.config.spreadsheet_id }}}}/values/OptOut!A1:append",
           body="={{ JSON.stringify({ values: [[new Date().toISOString(), $json.session_id, $json.channel, String($json.customer.chat_id || ''), $json.customer.email || $json.customer.phone || '']] }) }}",
           cred="googleSheetsOAuth2Api", query=[("valueInputOption", "RAW"), ("insertDataOption", "INSERT_ROWS")], on_error="continueRegularOutput")
    f.connect("Opt-out?", "Add Opt-out", 0)
    f.connect("Add Opt-out", "Alert Team?")
    f.connect("Opt-out?", "Alert Team?", 1)

    y = 820
    sheets_read(f, "Read Products", (320, y - 120), "Products!A1:I2000")
    f.code("Products", (540, y - 120), code("products"))
    f.chain("Read Products", "Products")
    f.connect("Tool Switch", "Read Products", 0)   # search_catalog
    f.connect("Tool Switch", "Read Products", 3)   # send_offer

    sheets_read(f, "Read Facts", (320, y), "Facts!A1:D1000")
    f.code("Rank Facts", (540, y), code("facts"))
    f.chain("Read Facts", "Rank Facts")
    f.connect("Tool Switch", "Read Facts", 1)

    sheets_read(f, "Read Leads", (320, y + 120), "Leads!A1:S10000")
    f.code("Upsert Lead", (540, y + 120), code("upsert"))
    f.if_("Write?", (760, y + 120), "={{ !$json.skip }}")
    f.http("Write Lead", (980, y + 60), "={{ $json.http.method }}",
           f"={SHEETS}/{{{{ $('Config').first().json.config.spreadsheet_id }}}}/values/{{{{ $json.http.path }}}}",
           body="={{ JSON.stringify($json.http.body) }}", cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.code("Lead Result", (1200, y + 120), code("lead_result"))
    f.chain("Read Leads", "Upsert Lead", "Write?")
    f.connect("Write?", "Write Lead", 0)
    f.connect("Write Lead", "Lead Result")
    f.connect("Write?", "Lead Result", 1)
    f.connect("Tool Switch", "Read Leads", 2)

    f.code("Call Link", (320, y + 240), code("call_link"))
    f.connect("Tool Switch", "Call Link", 4)

    f.if_("Sales Notice?", (1420, y), "={{ Boolean($json.team_message) }}")
    for n in ("Products", "Rank Facts", "Lead Result", "Call Link"):
        f.connect(n, "Sales Notice?")
    f.telegram("Sales Notice", (1640, y - 80), "={{ $('Config').first().json.config.team_chat_id }}",
               "={{ $json.team_message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }}")
    f.connect("Sales Notice?", "Sales Notice", 0)
    f.code("Sales Result", (1860, y), code("sales_result"))
    f.connect("Sales Notice", "Sales Result")
    f.connect("Sales Notice?", "Sales Result", 1)

    chassis.handoff_branch(f, (320, y + 380), 5)
    chassis.unknown_branch(f, (320, y + 500), 6)

    # ---- follow-up ----
    fy = y + 680
    f.sticky("Follow-up Note", (-660, fy - 40), (
        "### Follow-up\nКаждые 30 минут: лиды, стоп-лист, журнал и каталог одним запросом → кому пора написать "
        "(паузы, этапы, тихие часы, лимит касаний, стоп-лист) → Telegram или email → счётчик касаний в листе Leads."), w=540, h=200, color=4)
    f.http("Follow-up Read", (80, fy), "GET",
           f"={SHEETS}/{{{{ $('Config').first().json.config.spreadsheet_id }}}}/values:batchGet"
           "?ranges=Leads!A1:S10000&ranges=OptOut!A1:E10000&ranges=Log!A1:C20000&ranges=Products!A1:B2000",
           cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.connect("Kind", "Follow-up Read", 2)
    f.code("Pick Follow-ups", (300, fy), code("followup_pick"))
    f.connect("Follow-up Read", "Pick Follow-ups")
    f.switch("Follow-up Via", (520, fy), "={{ $json.via }}", ["telegram", "email"], fallback=False)
    f.connect("Pick Follow-ups", "Follow-up Via")
    f.telegram("Follow-up Telegram", (740, fy - 80), "={{ $json.chat_id }}", "={{ $json.text_html }}")
    f.connect("Follow-up Via", "Follow-up Telegram", 0)
    f.node("Follow-up Email", "n8n-nodes-base.emailSend", 2.1, (740, fy + 60), {
        "fromEmail": "ВАШ_АДРЕС@example.com", "toEmail": "={{ $json.email }}", "subject": "={{ $json.subject }}",
        "emailFormat": "text", "text": "={{ $json.text }}", "options": {}}, creds=["smtp"], onError="continueRegularOutput")
    f.connect("Follow-up Via", "Follow-up Email", 1)
    f.http("Count Touch", (960, fy), "PUT",
           f"={SHEETS}/{{{{ $('Config').first().json.config.spreadsheet_id }}}}/values/{{{{ $('Pick Follow-ups').item.json.update.path }}}}",
           body="={{ JSON.stringify($('Pick Follow-ups').item.json.update.body) }}", cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.connect("Follow-up Telegram", "Count Touch")
    f.connect("Follow-up Email", "Count Touch")

    wf = f.render()
    placeholders_only(wf)
    return wf


if __name__ == "__main__":
    wf = build()
    write_json(OUT / "workflows" / f"{SLUG}.n8n.json", wf)
    write_json(OUT / "workflows" / "error-alert.n8n.json", chassis.error_flow(SLUG, "агент продаж"))
    chassis.write_schemas(OUT, TOOLS)
    no_secrets(json.dumps(wf))
    print("nodes:", len(wf["nodes"]))
