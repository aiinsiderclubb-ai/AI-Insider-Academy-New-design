"""Builds content/products/real-estate-lead-to-viewing from js/ and the prompt."""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from nk import PRODUCTS, SHEETS, CALENDAR, Flow, Tool, stable_id, tool_node, write_json, placeholders_only, no_secrets  # noqa: E402

SLUG = "real-estate-lead-to-viewing"
OUT = PRODUCTS / SLUG
COMMON = (HERE.parent / "common" / "text.js").read_text(encoding="utf8")
RE = (HERE / "js" / "re.js").read_text(encoding="utf8")


def code(name):
    src = (HERE / "js" / f"{name}.js").read_text(encoding="utf8")
    src = src.replace("// @include text.js\n", COMMON + "\n").replace("// @include re.js\n", RE + "\n")
    return src.strip() + "\n"


TOOLS = [
    Tool("update_lead",
         "Сохраняет в карточку клиента то, что он сообщил о запросе и контактах. Передавай только новые поля, остальные — пустой строкой "
         "(budget_max — 0). Возвращает, чего ещё не хватает, и закреплённого риелтора.",
         [("deal_type", "string", "buy или rent; пусто, если не говорил"),
          ("property_type", "string", "apartment, house, commercial, land или any; пусто, если не говорил"),
          ("area", "string", "Район или ориентир словами клиента; пусто, если не говорил"),
          ("rooms", "string", "Комнат: 2, 2-3 или 3+; пусто, если не говорил"),
          ("budget_max", "number", "Верхняя граница бюджета числом; 0, если не говорил"),
          ("currency", "string", "USD, EUR, UAH и т. п.; пусто, если не называл"),
          ("timeline", "string", "now, 1-3m, 3-6m или later; пусто, если не говорил"),
          ("mortgage", "string", "cash, preapproved, needed или no; пусто, если не говорил"),
          ("name", "string", "Имя клиента; пусто, если не называл"),
          ("phone", "string", "Телефон клиента; пусто, если не называл"),
          ("email", "string", "Email; пусто, если не называл"),
          ("notes", "string", "Важные пожелания одной фразой: этаж, парковка, животные; пусто, если нет")]),
    Tool("search_listings",
         "Подбирает до трёх объектов из базы агентства и объясняет, чем каждый подходит. Только активные объекты.",
         [("deal_type", "string", "buy или rent"),
          ("property_type", "string", "apartment, house, commercial, land или any"),
          ("area", "string", "Район; пусто — по всему городу"),
          ("rooms", "string", "2, 2-3, 3+ или пусто"),
          ("budget_max", "number", "Верхняя граница бюджета; 0 — без ограничения"),
          ("listing_ref", "string", "Номер объекта, с которым пришёл клиент; пусто, если нет")]),
    Tool("check_viewing_slots",
         "Свободное время для просмотра объекта по календарю его риелтора.",
         [("listing_id", "string", "Номер объекта из результата search_listings"),
          ("date", "string", "today, tomorrow, день недели (mon…sun), ГГГГ-ММ-ДД или пусто — ближайшие дни")]),
    Tool("book_viewing",
         "Записывает клиента на просмотр в календарь риелтора и уведомляет риелтора. Вызывай только после явного «да» клиента в его последнем сообщении.",
         [("listing_id", "string", "Номер объекта"),
          ("slot_start", "string", "Время из ответа check_viewing_slots, поле slot_start: ГГГГ-ММ-ДДTЧЧ:ММ"),
          ("name", "string", "Имя клиента; пусто, если уже сохранено"),
          ("phone", "string", "Телефон клиента; пусто, если уже сохранён")]),
    Tool("handoff_to_human",
         "Передаёт диалог риелтору и уведомляет команду: торг, сделка, документы, ипотека, продажа своего объекта, недовольство, ручной подбор.",
         [("reason", "string", "Почему нужен человек, одной фразой"),
          ("summary", "string", "Что ищет клиент и что уже выяснено"),
          ("urgency", "string", "low, normal или high")]),
]

INPUTS = ["tool", "deal_type", "property_type", "area", "rooms", "budget_max", "currency", "timeline", "mortgage", "name", "phone",
          "email", "notes", "listing_ref", "listing_id", "date", "slot_start", "reason", "summary", "urgency",
          "session_id", "channel", "source", "customer_name", "customer_contact", "customer_phone", "last_message"]
G = "$('Guard In').first().json"
FIXED = {
    "session_id": "={{ %s.session_id }}" % G,
    "channel": "={{ %s.channel }}" % G,
    "source": "={{ %s.source || '' }}" % G,
    "customer_name": "={{ %s.customer.name || '' }}" % G,
    "customer_contact": "={{ [%s.customer.phone, %s.customer.email, %s.customer.telegram].filter(Boolean).join(' · ') }}" % (G, G, G),
    "customer_phone": "={{ %s.customer.phone || '' }}" % G,
    "last_message": "={{ %s.text }}" % G,
}


def prompt_expr(text):
    assert "{" not in re.sub(r"\{\{\w+\}\}", "", text), "stray brace in prompt"
    return "=" + re.sub(r"\{\{(\w+)\}\}", lambda m: "{{ $('Config').first().json.config.%s }}" % m.group(1), text)


def build():
    prompt = (OUT / "agent" / "system-prompt.md").read_text(encoding="utf8").strip()
    f = Flow("Real Estate Lead → Viewing", SLUG)
    cfg = "$('Config').first().json.config"
    sheet = lambda rng: f"={SHEETS}/{{{{ {cfg}.spreadsheet_id }}}}/values/{rng}"
    batch_get = lambda *rngs: f"={SHEETS}/{{{{ {cfg}.spreadsheet_id }}}}/values:batchGet?" + "&".join(f"ranges={r}" for r in rngs)
    batch_update = f"={SHEETS}/{{{{ {cfg}.spreadsheet_id }}}}/values:batchUpdate"
    LISTINGS, LEADS, VIEWINGS = "Listings!A1:P2000", "Leads!A1:AA5000", "Viewings!A1:J5000"

    f.sticky("Read Me", (-700, -520), (
        "## Real Estate Lead → Viewing\n"
        "Агент агентства недвижимости: квалифицирует клиента, подбирает объекты из вашей базы, записывает на просмотр "
        "в календарь нужного риелтора и напоминает о себе.\n\n"
        "**Перед запуском:**\n"
        "1. **Config** — агентство, ID таблицы, чат, `agent_token`, риелторы с их календарями.\n"
        "2. Ключ модели — **OpenAI Chat Model** (или подключите **Anthropic Chat Model**).\n"
        "3. Google Sheets — узлы `Read …`, `Save …`, `Append …`, `Update Lead`, `Log`.\n"
        "4. Google Calendar — `Free Busy`, `Find Existing`, `Recheck Busy`, `Create Event`.\n"
        "5. Telegram — Telegram Trigger и все узлы Telegram.\n6. **Publish**.\n\nПодробно — QUICKSTART.md."), w=560, h=440, color=5)

    f.node("Webhook", "n8n-nodes-base.webhook", 2.1, (-640, -60), {
        "httpMethod": "POST", "path": "realty-agent", "responseMode": "responseNode", "options": {"allowedOrigins": "*"}},
        webhookId=stable_id(SLUG, "webhook"))
    f.node("Telegram Trigger", "n8n-nodes-base.telegramTrigger", 1.2, (-640, 100), {"updates": ["message"], "additionalFields": {}},
           creds=["telegramApi"], webhookId=stable_id(SLUG, "telegram"))
    f.node("Follow-up Trigger", "n8n-nodes-base.scheduleTrigger", 1.2, (-640, 260), {"rule": {"interval": [{"field": "days", "triggerAtHour": 10}]}})
    f.node("Tool Call", "n8n-nodes-base.executeWorkflowTrigger", 1.1, (-640, 420), {
        "inputSource": "workflowInputs", "workflowInputs": {"values": [{"name": n} for n in INPUTS]}})
    f.code("Config", (-400, 180), code("config"))
    f.switch("Kind", (-180, 180), "={{ $json.input.tool ? 'tool' : ($json.input['Day of week'] !== undefined ? 'followup' : 'chat') }}",
             ["chat", "tool", "followup"], fallback=False)
    for t in ("Webhook", "Telegram Trigger", "Follow-up Trigger", "Tool Call"):
        f.connect(t, "Config")
    f.connect("Config", "Kind")

    # ---- chat ----
    f.code("Guard In", (40, -60), code("guard_in"))
    f.connect("Kind", "Guard In", 0)
    f.switch("Route", (260, -60), "={{ $json.route }}", ["agent", "canned", "deny", "bad"], fallback=False)
    f.connect("Guard In", "Route")
    f.node("AI Agent", "@n8n/n8n-nodes-langchain.agent", 3.1, (520, -260), {
        "promptType": "define", "text": "={{ $json.agent_input }}",
        "options": {"systemMessage": prompt_expr(prompt), "maxIterations": 8, "returnIntermediateSteps": True}},
        onError="continueRegularOutput")
    f.connect("Route", "AI Agent", 0)
    f.node("OpenAI Chat Model", "@n8n/n8n-nodes-langchain.lmChatOpenAi", 1.3, (380, 0), {
        "model": {"__rl": True, "mode": "list", "value": "gpt-5-mini", "cachedResultName": "gpt-5-mini"},
        "builtInTools": {}, "responsesApiEnabled": False, "options": {}}, creds=["openAiApi"])
    f.node("Anthropic Chat Model", "@n8n/n8n-nodes-langchain.lmChatAnthropic", 1.6, (380, 200), {
        "model": {"__rl": True, "mode": "id", "value": "claude-haiku-5-5"}, "options": {}}, creds=["anthropicApi"])
    f.connect("OpenAI Chat Model", "AI Agent", kind="ai_languageModel")
    f.sticky("Model Note", (300, 340), (
        "**Модель.** Подключена OpenAI (подходит любой OpenAI-совместимый API). Для Claude — протяните связь от "
        "**Anthropic Chat Model** к входу Chat Model агента вместо OpenAI. Подробно — docs/06-models.md."), w=380, h=150, color=7)
    f.node("Memory", "@n8n/n8n-nodes-langchain.memoryBufferWindow", 1.3, (540, 0), {
        "sessionIdType": "customKey", "sessionKey": "={{ $('Guard In').first().json.session_id }}", "contextWindowLength": 16})
    f.connect("Memory", "AI Agent", kind="ai_memory")
    for i, t in enumerate(TOOLS):
        tool_node(f, t, (680 + i * 150, 0), INPUTS)
        f.nodes[-1]["parameters"]["workflowInputs"]["value"].update(FIXED)
        f.connect(t.name, "AI Agent", kind="ai_tool")

    f.code("Guard Out", (1000, -260), code("guard_out"))
    f.connect("AI Agent", "Guard Out")
    f.code("Canned", (520, 160), code("canned"))
    f.connect("Route", "Canned", 1)
    f.if_("Alert Team?", (1220, -60), "={{ Boolean($json.alert_html) }}")
    f.connect("Guard Out", "Alert Team?")
    f.connect("Canned", "Alert Team?")
    f.telegram("Team Alert", (1440, -160), f"={{{{ {cfg}.team_chat_id }}}}", "={{ $json.alert_html }}")
    f.connect("Alert Team?", "Team Alert", 0)
    f.code("Log Row", (1660, -60), code("log_row"))
    f.connect("Team Alert", "Log Row")
    f.connect("Alert Team?", "Log Row", 1)
    f.http("Log", (1880, -60), "POST", sheet("Log!A1:append"), body="={{ JSON.stringify({ values: [$json.row] }) }}",
           cred="googleSheetsOAuth2Api", query=[("valueInputOption", "RAW"), ("insertDataOption", "INSERT_ROWS")], on_error="continueRegularOutput")
    f.connect("Log Row", "Log")
    f.switch("Reply Channel", (2100, -60), "={{ $('Log Row').first().json.channel }}", ["web", "telegram"], fallback=False)
    f.connect("Log", "Reply Channel")
    f.node("Respond", "n8n-nodes-base.respondToWebhook", 1.1, (2320, -160), {
        "respondWith": "json", "responseBody": "={{ $('Log Row').first().json.response }}", "options": {}})
    f.connect("Reply Channel", "Respond", 0)
    f.telegram("Send Reply", (2320, 40), "={{ $('Log Row').first().json.customer.chat_id }}", "={{ $('Log Row').first().json.reply_html }}")
    f.connect("Reply Channel", "Send Reply", 1)
    f.node("Respond 401", "n8n-nodes-base.respondToWebhook", 1.1, (520, 320), {
        "respondWith": "json", "responseBody": '={{ { "error": "unauthorized" } }}', "options": {"responseCode": 401}})
    f.connect("Route", "Respond 401", 2)
    f.node("Respond 400", "n8n-nodes-base.respondToWebhook", 1.1, (520, 480), {
        "respondWith": "json", "responseBody": '={{ { "error": $json.error } }}', "options": {"responseCode": 400}})
    f.connect("Route", "Respond 400", 3)

    # ---- tools ----
    y = 900
    f.switch("Tool Switch", (40, y), "={{ $json.input.tool }}", [t.name for t in TOOLS])
    f.connect("Kind", "Tool Switch", 1)
    batch_body = "={{ JSON.stringify(%s) }}"

    # update_lead
    f.http("Read Leads", (280, y - 300), "GET", sheet(LEADS), cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.code("Lead Upsert", (500, y - 300), code("lead_upsert"))
    f.if_("Lead OK?", (720, y - 300), "={{ $json.ok }}")
    f.http("Save Lead", (940, y - 340), "POST", batch_update,
           body="={{ JSON.stringify({ valueInputOption: 'RAW', data: [{ range: $json.range, values: [$json.values] }] }) }}",
           cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.if_("Hot Lead?", (1160, y - 340), "={{ Boolean($('Lead Upsert').first().json.alert_html) && !$json.error }}")
    f.telegram("Lead Alert", (1380, y - 400), "={{ $('Lead Upsert').first().json.chat_id }}", "={{ $('Lead Upsert').first().json.alert_html }}")
    f.code("Lead Result", (1600, y - 300), code("lead_result"))
    f.chain("Read Leads", "Lead Upsert", "Lead OK?")
    f.connect("Lead OK?", "Save Lead", 0)
    f.connect("Lead OK?", "Lead Result", 1)
    f.connect("Save Lead", "Hot Lead?")
    f.connect("Hot Lead?", "Lead Alert", 0)
    f.connect("Hot Lead?", "Lead Result", 1)
    f.connect("Lead Alert", "Lead Result")
    f.connect("Tool Switch", "Read Leads", 0)

    # search_listings
    f.http("Read Listings Data", (280, y - 120), "GET", batch_get(LISTINGS, LEADS), cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.code("Match Listings", (500, y - 120), code("search_listings"))
    f.if_("Mark Lead?", (720, y - 120), "={{ Boolean($json.update) }}")
    f.http("Save Matches", (940, y - 160), "POST", batch_update, body=batch_body % "$json.update",
           cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.code("Search Result", (1160, y - 120), code("search_result"))
    f.chain("Read Listings Data", "Match Listings", "Mark Lead?")
    f.connect("Mark Lead?", "Save Matches", 0)
    f.connect("Mark Lead?", "Search Result", 1)
    f.connect("Save Matches", "Search Result")
    f.connect("Tool Switch", "Read Listings Data", 1)

    # check_viewing_slots
    f.http("Read Listings", (280, y + 40), "GET", sheet(LISTINGS), cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.code("Slot Plan", (500, y + 40), code("slot_plan"))
    f.if_("Slot Plan OK?", (720, y + 40), "={{ $json.ok }}")
    f.http("Free Busy", (940, y), "POST", f"={CALENDAR}/freeBusy", body="={{ JSON.stringify($json.freebusy) }}",
           cred="googleCalendarOAuth2Api", on_error="continueRegularOutput")
    f.code("Slots", (1160, y + 40), code("slots"))
    f.chain("Read Listings", "Slot Plan", "Slot Plan OK?")
    f.connect("Slot Plan OK?", "Free Busy", 0)
    f.connect("Slot Plan OK?", "Slots", 1)
    f.connect("Free Busy", "Slots")
    f.connect("Tool Switch", "Read Listings", 2)

    # book_viewing
    by = y + 220
    plan = "$('Booking Plan').first().json"
    f.http("Read Booking Data", (280, by), "GET", batch_get(LISTINGS, LEADS), cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.code("Booking Plan", (500, by), code("booking_plan"))
    f.if_("Can Book?", (720, by), "={{ $json.ok }}")
    f.http("Find Existing", (940, by - 40), "GET",
           "={{ '%s/calendars/' + encodeURIComponent($json.calendar_id) + '/events?privateExtendedProperty=' + encodeURIComponent('booking_key=' + $json.booking_key) }}" % CALENDAR,
           cred="googleCalendarOAuth2Api", on_error="continueRegularOutput")
    f.http("Recheck Busy", (1160, by - 40), "POST", f"={CALENDAR}/freeBusy", body="={{ JSON.stringify(%s.freebusy) }}" % plan,
           cred="googleCalendarOAuth2Api", on_error="continueRegularOutput")
    f.code("Booking Decide", (1380, by - 40), code("booking_decide"))
    f.if_("Create?", (1600, by - 40), "={{ $json.create }}")
    f.http("Create Event", (1820, by - 80), "POST",
           "={{ '%s/calendars/' + encodeURIComponent(%s.calendar_id) + '/events' }}" % (CALENDAR, plan),
           body="={{ JSON.stringify(%s.event) }}" % plan, cred="googleCalendarOAuth2Api", on_error="continueRegularOutput")
    f.if_("Created?", (2040, by - 80), "={{ !$json.error && Boolean($json.id) }}")
    f.code("Booking Rows", (2260, by - 120), code("booking_rows"))
    f.http("Append Viewing", (2480, by - 120), "POST", sheet("Viewings!A1:append"), body="={{ JSON.stringify({ values: [$json.viewing] }) }}",
           cred="googleSheetsOAuth2Api", query=[("valueInputOption", "RAW"), ("insertDataOption", "INSERT_ROWS")], on_error="continueRegularOutput")
    f.http("Update Lead", (2700, by - 120), "POST", batch_update, body="={{ JSON.stringify($('Booking Rows').first().json.lead_update) }}",
           cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.telegram("Notify Agent", (2920, by - 120), "={{ $('Booking Rows').first().json.chat_id }}", "={{ $('Booking Rows').first().json.alert_html }}")
    f.code("Booking Result", (3140, by), code("booking_result"))
    f.chain("Read Booking Data", "Booking Plan", "Can Book?")
    f.connect("Can Book?", "Find Existing", 0)
    f.connect("Can Book?", "Booking Result", 1)
    f.chain("Find Existing", "Recheck Busy", "Booking Decide", "Create?")
    f.connect("Create?", "Create Event", 0)
    f.connect("Create?", "Booking Result", 1)
    f.connect("Create Event", "Created?")
    f.connect("Created?", "Booking Rows", 0)
    f.connect("Created?", "Booking Result", 1)
    f.chain("Booking Rows", "Append Viewing", "Update Lead", "Notify Agent", "Booking Result")
    f.connect("Tool Switch", "Read Booking Data", 3)

    # handoff
    f.code("Handoff Alert", (280, by + 200), code("handoff_alert"))
    f.telegram("Notify Team", (500, by + 200), f"={{{{ {cfg}.team_chat_id }}}}", "={{ $json.alert_html }}")
    f.code("Handoff Result", (720, by + 200), code("handoff_result"))
    f.chain("Handoff Alert", "Notify Team", "Handoff Result")
    f.connect("Tool Switch", "Handoff Alert", 4)
    f.code("Unknown Tool", (280, by + 340), code("unknown_tool"))
    f.connect("Tool Switch", "Unknown Tool", 5)

    # ---- follow-up ----
    fy = by + 560
    f.sticky("Follow-up Note", (-700, fy - 60), (
        "### Follow-up каждый день в 10:00\nБез модели, по правилам из Config: клиентам в Telegram — напоминания после "
        "`follow_up_days` дней тишины и о завтрашних просмотрах; команде — список, кому позвонить, и просмотры на завтра."),
        w=520, h=200, color=4)
    f.http("Read Follow-up Data", (40, fy), "GET", batch_get(LEADS, VIEWINGS), cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.connect("Kind", "Read Follow-up Data", 2)
    f.code("Plan Follow-ups", (260, fy), code("followup_plan"))
    f.if_("Has Updates?", (480, fy), "={{ Boolean($json.updates) }}")
    f.http("Save Follow-ups", (700, fy - 40), "POST", batch_update, body=batch_body % "$json.updates",
           cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.if_("Has Digest?", (920, fy), "={{ Boolean($('Plan Follow-ups').first().json.digest_html) }}")
    f.telegram("Team Digest", (1140, fy - 40), f"={{{{ {cfg}.team_chat_id }}}}", "={{ $('Plan Follow-ups').first().json.digest_html }}")
    f.code("Split Messages", (1360, fy), code("split_messages"))
    f.telegram("Send Follow-up", (1580, fy), "={{ $json.chat_id }}", "={{ $json.text }}")
    f.chain("Read Follow-up Data", "Plan Follow-ups", "Has Updates?")
    f.connect("Has Updates?", "Save Follow-ups", 0)
    f.connect("Has Updates?", "Has Digest?", 1)
    f.connect("Save Follow-ups", "Has Digest?")
    f.connect("Has Digest?", "Team Digest", 0)
    f.connect("Has Digest?", "Split Messages", 1)
    f.connect("Team Digest", "Split Messages")
    f.connect("Split Messages", "Send Follow-up")

    wf = f.render({"timezone": "Europe/Kyiv"})
    placeholders_only(wf)
    return wf


def error_flow():
    f = Flow("Real Estate Lead → Viewing — Error Alert", SLUG)
    f.sticky("About", (-40, -260), (
        "## Сигнал об ошибке\nЕсли воркфлоу агента упал, агентство узнает в Telegram.\n\n"
        "Вставьте ID чата в узел **Alert** и выберите этот воркфлоу в настройках агента (Settings → Error workflow)."), w=460, h=200, color=5)
    f.node("Error Trigger", "n8n-nodes-base.errorTrigger", 1, (0, 0), {})
    f.code("Message", (220, 0), (
        "const e = $input.first().json;\n"
        "const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\n"
        "const text = [\n"
        "  '<b>⚠️ Ошибка в агенте агентства</b>',\n"
        "  `Воркфлоу: ${esc(e.workflow?.name)}`,\n"
        "  `Узел: ${esc(e.execution?.lastNodeExecuted)}`,\n"
        "  `Ошибка: ${esc(e.execution?.error?.message).slice(0, 500)}`,\n"
        "  e.execution?.url ? `<a href=\"${esc(e.execution.url)}\">Открыть выполнение</a>` : '',\n"
        "].filter(Boolean).join('\\n');\n"
        "return [{ json: { text } }];\n"))
    f.telegram("Alert", (440, 0), "ВСТАВЬТЕ_ID_ЧАТА", "={{ $json.text }}", on_error="stopWorkflow")
    f.chain("Error Trigger", "Message", "Alert")
    return f.render()


if __name__ == "__main__":
    wf = build()
    no_secrets(json.dumps(wf))
    write_json(OUT / "workflows" / f"{SLUG}.n8n.json", wf)
    write_json(OUT / "workflows" / "error-alert.n8n.json", error_flow())
    write_json(OUT / "agent" / "tools.openai.json", [t.openai() for t in TOOLS])
    write_json(OUT / "agent" / "tools.anthropic.json", [t.anthropic() for t in TOOLS])
    print("nodes:", len(wf["nodes"]))
