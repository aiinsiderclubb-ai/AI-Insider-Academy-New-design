"""
Builds the workflows, tool schema and provider files of voice-agent-kit-delivery.

Delivery is not booking: the agent finds an order by the caller's number,
confirms it, corrects the address, moves the delivery window within the
windows' capacity and passes everything else — the contents of the order,
cancellation, money — to an operator. Orders live in a Google Sheet.

The workflow keeps the shape of the other voice kits (one webhook for Vapi,
Retell and ElevenLabs, Plan → read → Decide → one write node), with its own
Code nodes from delivery/js.
"""
import json
from pathlib import Path

from common import plain_telegram, PRODUCTS, SALON, dump, load, node, write_providers

HERE = Path(__file__).resolve().parent
SLUG = "voice-agent-kit-delivery"
KIT = PRODUCTS / SLUG
TIME = (HERE / "delivery" / "js" / "_time.js").read_text(encoding="utf8")


def js(name):
    text = (HERE / "delivery" / "js" / f"{name}.js").read_text(encoding="utf8")
    return text.replace("// @include _time.js\n", TIME).strip() + "\n"


def tools_workflow():
    wf = load(SALON / "workflows" / "booking-tools.n8n.json")
    wf["name"] = "Delivery Voice Agent — Order Tools"
    codes = {"Config": "config", "Parse Request": "parse_request", "Plan": "plan", "Decide": "decide",
             "Finish": "finish", "Tool Failed": "tool_failed", "Build Response": "build_response"}
    for name, file in codes.items():
        node(wf, name)["parameters"]["jsCode"] = js(file)
    renames = {"Needs Calendar?": "Needs Sheet?", "Calendar Read": "Sheet Read", "Calendar Write": "Sheet Write"}
    for n in wf["nodes"]:
        if n["name"] in renames:
            n["name"] = renames[n["name"]]
        if n["type"].endswith("httpRequest"):
            n["parameters"]["nodeCredentialType"] = "googleSheetsOAuth2Api"
            n["credentials"] = {"googleSheetsOAuth2Api": {"id": "REPLACE_ME", "name": "Google Sheets"}}
    conns = {}
    for src, outs in wf["connections"].items():
        src = renames.get(src, src)
        conns[src] = {k: [[dict(c, node=renames.get(c["node"], c["node"])) for c in branch] for branch in v] for k, v in outs.items()}
    wf["connections"] = conns
    node(wf, "Needs Sheet?")["parameters"]["conditions"]["boolean"][0]["value1"] = "={{ $json.needs_sheet }}"
    node(wf, "About")["parameters"]["content"] = (
        "## Delivery Voice Agent — инструменты заказов\n\n"
        "Принимает вызовы инструментов от Vapi, Retell и ElevenLabs и работает с таблицей заказов в Google Sheets.\n\n"
        "**Настройте:**\n1. Узел **Config** — таблица, города, интервалы, правила.\n"
        "2. Учётные данные: секрет вебхука, Google Sheets, Telegram.\n3. Settings → Error Workflow → «Error Alert».\n\n"
        "**Владелец:** впишите имя · **Версия:** 1.0.0")
    node(wf, "How it works")["parameters"]["content"] = (
        "## Как это работает\n\n**Parse Request** приводит запрос к одному виду, отсекает неполные и чужие номера.\n"
        "**Plan** решает, нужно ли читать таблицу.\n**Decide** находит заказ, проверяет правила и готовит одно изменение.\n"
        "**Sheet Write** — единственный узел, который что-то меняет.\n\n"
        "Состав заказа агент не меняет никогда: такого инструмента нет.")
    node(wf, "Failure path")["parameters"]["content"] = (
        "## Если таблица не ответила\n\nАгент получает `tool_unavailable` и не называет клиенту выдуманный результат. "
        "Оператору уходит сообщение в Telegram.")
    return wf


def outbound_workflow():
    """Daily: tomorrow's unconfirmed orders → start a confirmation call at Vapi or Retell → count the attempt."""
    cred_sheets = {"googleSheetsOAuth2Api": {"id": "REPLACE_ME", "name": "Google Sheets"}}
    nodes = [
        {"name": "About", "type": "n8n-nodes-base.stickyNote", "typeVersion": 1, "position": [-80, -320], "parameters": {
            "content": "## Delivery Voice Agent — звонки для подтверждения\n\nКаждый день в 16:00 берёт завтрашние заказы без подтверждения "
                       "и запускает исходящий звонок у Vapi или Retell (`outbound.provider` в Config).\n\n"
                       "Не больше `max_attempts` начатых звонков на заказ, один в день, только с `call_from` до `call_until`.\n\n"
                       "Ключ API провайдера — учётные данные Header Auth: `Authorization` = `Bearer ВАШ_КЛЮЧ`.\n\n"
                       "Выключен при импорте: включите после тестов (docs/10-outbound.md).",
            "width": 520, "height": 300}},
        {"name": "Every Day 16:00", "type": "n8n-nodes-base.scheduleTrigger", "typeVersion": 1.2, "position": [0, 0],
         "parameters": {"rule": {"interval": [{"field": "cronExpression", "expression": "0 16 * * *"}]}}},
        {"name": "Config", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [220, 0], "parameters": {"jsCode": js("config")}},
        {"name": "Read Orders", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [440, 0], "parameters": {
            "method": "GET",
            "url": "={{ $json.sheets_api_base }}/{{ encodeURIComponent($json.spreadsheet_id) }}/values/{{ encodeURIComponent(\"'\" + $json.sheet_name + \"'!A1:U5000\") }}",
            "authentication": "predefinedCredentialType", "nodeCredentialType": "googleSheetsOAuth2Api", "options": {"timeout": 15000}},
         "credentials": cred_sheets},
        {"name": "Pick Calls", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [660, 0], "parameters": {"jsCode": js("pick_calls")},
         "alwaysOutputData": False},
        {"name": "Start Call", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [880, 0], "parameters": {
            "method": "POST", "url": "={{ $json.request.url }}", "sendBody": True, "specifyBody": "json",
            "jsonBody": "={{ JSON.stringify($json.request.body) }}", "authentication": "genericCredentialType",
            "genericAuthType": "httpHeaderAuth",
            "options": {"timeout": 20000, "batching": {"batch": {"batchSize": 1, "batchInterval": 3000}}}},
         "credentials": {"httpHeaderAuth": {"id": "REPLACE_ME", "name": "Voice provider API key"}}, "onError": "continueRegularOutput"},
        {"name": "Mark Calls", "type": "n8n-nodes-base.code", "typeVersion": 2, "position": [1100, 0], "parameters": {"jsCode": js("mark_calls")}},
        {"name": "Sheet Write", "type": "n8n-nodes-base.httpRequest", "typeVersion": 4.2, "position": [1320, 0], "parameters": {
            "method": "POST",
            "url": "={{ $('Config').first().json.sheets_api_base }}/{{ encodeURIComponent($('Config').first().json.spreadsheet_id) }}/values:batchUpdate",
            "sendBody": True, "specifyBody": "json", "jsonBody": "={{ JSON.stringify($json.body) }}",
            "authentication": "predefinedCredentialType", "nodeCredentialType": "googleSheetsOAuth2Api", "options": {"timeout": 15000}},
         "credentials": cred_sheets},
        {"name": "Report", "type": "n8n-nodes-base.telegram", "typeVersion": 1.2, "position": [1540, 0], "parameters": {
            "chatId": "={{ $('Config').first().json.staff_chat_id }}", "text": "={{ $('Mark Calls').first().json.report }}",
            "additionalFields": {"appendAttribution": False}},
         "credentials": {"telegramApi": {"id": "REPLACE_ME", "name": "Telegram bot"}}},
    ]
    from nk import stable_id  # shared builder, read-only use
    for n in nodes:
        n["id"] = stable_id(SLUG, "outbound", n["name"])
    chain = ["Every Day 16:00", "Config", "Read Orders", "Pick Calls", "Start Call", "Mark Calls", "Sheet Write", "Report"]
    conns = {a: {"main": [[{"node": b, "type": "main", "index": 0}]]} for a, b in zip(chain, chain[1:])}
    return {"name": "Delivery Voice Agent — Confirmation Calls", "nodes": nodes, "connections": conns, "active": False,
            "settings": {"executionOrder": "v1", "saveDataSuccessExecution": "none", "saveDataErrorExecution": "all",
                         "saveManualExecutions": False, "timezone": "Europe/Kyiv"},
            "pinData": {}, "meta": {"templateCredsSetupCompleted": False}}


def side_workflows():
    out = {}
    for name in ("call-summary", "error-alert"):
        wf = load(SALON / "workflows" / f"{name}.n8n.json")
        wf["name"] = wf["name"].replace("Beauty Salon", "Delivery")
        for n in wf["nodes"]:
            if n["type"].endswith("stickyNote"):
                n["parameters"]["content"] = (n["parameters"]["content"].replace("Beauty Salon", "Delivery")
                                              .replace("«Booking Tools»", "«Order Tools» и «Confirmation Calls»")
                                              .replace("администратору", "оператору").replace("администратор", "оператор"))
            if n["type"].endswith("code"):
                n["parameters"]["jsCode"] = n["parameters"]["jsCode"].replace("Business hours, services, staff and rules.", "The operators' Telegram chat.")
        out[name] = wf
    return out


PHONE = "Телефон клиента цифрами, как он его продиктовал. При исходящем звонке — номер, на который звоним."
ORDER = "Номер заказа из ответа find_order."
CONSENT = {"type": "boolean", "description": "true — только после того, как клиент подтвердил повторённые тобой данные."}
DATE = "Дата: ГГГГ-ММ-ДД, либо today, tomorrow, день недели (mon, tue, wed, thu, fri, sat, sun), либо +N дней. Не вычисляй дату сам."


def schema():
    return [
        {"name": "find_order",
         "description": "Найти активные заказы клиента по номеру телефона: дата и интервал доставки, адрес, статус. Вызывай в начале каждого разговора о заказе.",
         "parameters": {"type": "object", "properties": {
             "customer_phone": {"type": "string", "description": PHONE},
             "order_id": {"type": "string", "description": "Номер заказа, если клиент его назвал."}},
             "required": ["customer_phone"]}},
        {"name": "confirm_delivery",
         "description": "Отметить, что клиент подтвердил дату, интервал и адрес доставки. Только после явного «да».",
         "parameters": {"type": "object", "properties": {
             "order_id": {"type": "string", "description": ORDER}, "customer_phone": {"type": "string", "description": PHONE},
             "consent": CONSENT},
             "required": ["order_id", "customer_phone", "consent"]}},
        {"name": "update_address",
         "description": "Изменить или уточнить адрес доставки. Передавай только то, что меняется. Новую улицу — вместе с номером дома, город — только из зоны доставки.",
         "parameters": {"type": "object", "properties": {
             "order_id": {"type": "string", "description": ORDER}, "customer_phone": {"type": "string", "description": PHONE},
             "city": {"type": "string", "description": "Город, если меняется."},
             "address": {"type": "string", "description": "Улица и дом, если меняются: «проспект Победы, 12»."},
             "apartment": {"type": "string", "description": "Квартира или офис."},
             "entrance": {"type": "string", "description": "Подъезд."},
             "floor": {"type": "string", "description": "Этаж."},
             "intercom": {"type": "string", "description": "Код домофона."},
             "courier_note": {"type": "string", "description": "Подсказка курьеру словами клиента: «позвонить за 15 минут», «вход со двора»."},
             "consent": CONSENT},
             "required": ["order_id", "customer_phone", "consent"]}},
        {"name": "check_windows",
         "description": "Найти свободные интервалы доставки на дату. Вызывай перед тем, как предлагать время. Никогда не называй интервал без этого вызова.",
         "parameters": {"type": "object", "properties": {
             "order_id": {"type": "string", "description": ORDER}, "customer_phone": {"type": "string", "description": PHONE},
             "date": {"type": "string", "description": DATE}},
             "required": ["order_id", "customer_phone", "date"]}},
        {"name": "change_window",
         "description": "Перенести доставку на другую дату или интервал. Сначала check_windows, затем повтори клиенту выбор и получи «да».",
         "parameters": {"type": "object", "properties": {
             "order_id": {"type": "string", "description": ORDER}, "customer_phone": {"type": "string", "description": PHONE},
             "date": {"type": "string", "description": "date выбранного интервала из ответа check_windows."},
             "window_id": {"type": "string", "description": "window_id выбранного интервала из ответа check_windows."},
             "consent": CONSENT},
             "required": ["order_id", "customer_phone", "date", "window_id", "consent"]}},
        {"name": "request_callback",
         "description": "Передать оператору: изменить состав заказа, отменить заказ, оплата и возврат, жалоба, адрес вне зоны доставки, сбой, вопрос без ответа.",
         "parameters": {"type": "object", "properties": {
             "customer_name": {"type": "string", "description": "Имя клиента."},
             "customer_phone": {"type": "string", "description": PHONE},
             "order_id": {"type": "string", "description": "Номер заказа, если известен."},
             "topic": {"type": "string", "description": "О чём просят, одной фразой: «добавить товар», «отменить заказ»."},
             "urgency": {"type": "string", "description": "Срочность словами: сегодня, до доставки, не срочно."},
             "details": {"type": "string", "description": "Что важно знать оператору до звонка."}},
             "required": ["customer_name", "customer_phone", "topic"]}},
    ]


ELEVEN_INTRO = """# ElevenLabs: инструменты

Инструменты создаются в панели: Agents → Tools → Add tool → Webhook. Заполните по таблицам ниже. Имя инструмента передаётся в адресе.

Общие поля для всех шести:

- **Method:** POST
- **Headers:** `X-Voice-Secret` — тип Secret, значение — ваш секрет из n8n.
- **Body, дополнительные свойства для всех инструментов:**
  - `caller_number` — тип Dynamic variable, `system__caller_id`. Без него бэкенд не покажет данные заказа: адрес видит только номер, на который оформлен заказ.
  - `conversation_id` — тип Dynamic variable, `system__conversation_id`. Попадает в историю заказа.
- **Response timeout:** 20 секунд.
"""

ELEVEN_TAIL = """## Если переменные `system__caller_id` и `system__conversation_id` недоступны

Названия системных переменных проверьте в панели: список показывается при выборе типа Dynamic variable. Если номера звонящего нет, бэкенд не сможет подтвердить владельца заказа и ответит `caller_mismatch` — агент предложит связь с оператором. Чтобы искать заказ по названному номеру, поставьте в Config `require_caller_match: false`. Это удобнее и менее безопасно: адрес и состав заказа узнает любой, кто знает номер клиента.

При исходящих звонках ElevenLabs (через Twilio или SIP) проверьте, что `system__caller_id` содержит номер клиента, а не ваш: исходящие звонки из этого набора запускаются у Vapi и Retell, для ElevenLabs их нужно настроить отдельно.
"""


def build():
    wf = plain_telegram(tools_workflow())
    dump(KIT / "workflows" / "order-tools.n8n.json", wf)
    dump(KIT / "workflows" / "confirmation-calls.n8n.json", plain_telegram(outbound_workflow()))
    for name, w in side_workflows().items():
        dump(KIT / "workflows" / f"{name}.n8n.json", plain_telegram(w))
    old = KIT / "workflows" / "booking-tools.n8n.json"
    if old.exists():
        old.unlink()
    cfg_js = (HERE / "delivery" / "js" / "config.js").read_text(encoding="utf8")
    cfg = json.loads(cfg_js[cfg_js.index("return [{ json: ") + len("return [{ json: "):cfg_js.rindex(" }];")])
    dump(KIT / "data" / "config.example.json", cfg)
    s = schema()
    dump(KIT / "tools" / "tools.schema.json", s)
    retell = load(SALON / "providers" / "retell-llm.json")
    retell["begin_message"] = "Здравствуйте! Это служба доставки «{{business_name}}», я {{agent_name}}, виртуальный помощник. Звоню по вашему заказу {{order_id}}."
    retell["default_dynamic_variables"] = {"business_name": "REPLACE", "agent_name": "REPLACE", "language": "русский",
                                           "recording_notice": "", "order_id": "", "customer_name": "", "delivery": "", "address": ""}
    for g in retell["general_tools"]:
        if g["type"] == "transfer_call":
            g["name"] = "transfer_to_operator"
            g["description"] = "Перевести на оператора: состав заказа, отмена, оплата, жалоба, просьба о человеке."
    write_providers(KIT, s, retell, ELEVEN_INTRO, ELEVEN_TAIL)
    return wf


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(HERE.parent))
    w = build()
    print("built", len(w["nodes"]), "nodes;", json.dumps([n["name"] for n in w["nodes"] if n["type"].endswith("code")], ensure_ascii=False))
