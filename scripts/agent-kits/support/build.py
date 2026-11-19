"""Builds content/products/customer-support-agent from js/ and the prompt."""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from nk import PRODUCTS, SHEETS, Flow, stable_id, Tool, tool_node, write_json, placeholders_only, no_secrets  # noqa: E402

SLUG = "customer-support-agent"
OUT = PRODUCTS / SLUG
COMMON = (HERE.parent / "common" / "text.js").read_text(encoding="utf8")


def code(name):
    src = (HERE / "js" / f"{name}.js").read_text(encoding="utf8")
    return src.replace("// @include text.js\n", COMMON + "\n").strip() + "\n"


TOOLS = [
    Tool("search_knowledge",
         "Ищет ответ в базе знаний компании: товары, услуги, цены, оплата, доставка, возвраты, правила. "
         "Вызывай перед любым ответом по существу. Возвращает до трёх статей или found=false.",
         [("query", "string", "Вопрос клиента ключевыми словами на его языке, например: сроки доставки Польша")]),
    Tool("get_order_status",
         "Статус конкретного заказа. Нужны номер заказа и email, указанный при оформлении. "
         "Данные вернутся, только если email совпадает с заказом.",
         [("order_id", "string", "Номер заказа, как его написал клиент"),
          ("email", "string", "Email клиента, указанный при оформлении заказа; пустая строка, если клиент его не назвал")]),
    Tool("create_ticket",
         "Создаёт обращение для сотрудника, когда вопрос требует действий человека, но не срочный. Возвращает номер обращения.",
         [("topic", "string", "Тема в 3–7 словах"),
          ("summary", "string", "Суть: что случилось, что клиент уже сообщил, чего он хочет"),
          ("priority", "string", "low, normal, high или urgent"),
          ("email", "string", "Email клиента для ответа; пустая строка, если неизвестен")]),
    Tool("handoff_to_human",
         "Передаёт диалог менеджеру и уведомляет команду. Для денег, жалоб, просьбы позвать человека и всего, что агент решить не может.",
         [("reason", "string", "Почему нужен человек, одной фразой"),
          ("summary", "string", "Суть вопроса и что уже выяснено, чтобы менеджеру не перечитывать переписку"),
          ("urgency", "string", "low, normal или high")]),
]

# Inputs every tool call carries; the model fills only its own, the rest come from the conversation.
INPUTS = ["tool", "query", "order_id", "email", "topic", "summary", "priority", "reason", "urgency",
          "session_id", "channel", "customer_name", "customer_contact", "customer_email", "customer_phone", "last_message"]
G = "$('Guard In').first().json"
FIXED = {
    "session_id": "={{ %s.session_id }}" % G,
    "channel": "={{ %s.channel }}" % G,
    "customer_name": "={{ %s.customer.name || '' }}" % G,
    "customer_contact": "={{ [%s.customer.email, %s.customer.phone, %s.customer.telegram].filter(Boolean).join(' · ') }}" % (G, G, G),
    "customer_email": "={{ %s.customer.email || '' }}" % G,
    "customer_phone": "={{ %s.customer.phone || '' }}" % G,
    "last_message": "={{ %s.text }}" % G,
}


def prompt_expr(text):
    """{{key}} in the prompt file becomes a reference to the same key in Config."""
    assert "{" not in re.sub(r"\{\{\w+\}\}", "", text), "stray brace in prompt"
    return "=" + re.sub(r"\{\{(\w+)\}\}", lambda m: "{{ $('Config').first().json.config.%s }}" % m.group(1), text)


def build():
    prompt = (OUT / "agent" / "system-prompt.md").read_text(encoding="utf8").strip()
    f = Flow("Customer Support Agent", SLUG)

    f.sticky("Read Me", (-660, -460), (
        "## Customer Support Agent\n"
        "Агент поддержки: отвечает по базе знаний, проверяет статус заказа, создаёт обращения и передаёт диалог человеку.\n\n"
        "**Перед запуском:**\n"
        "1. Узел **Config** — название компании, ID таблицы, чат команды, `agent_token`.\n"
        "2. Ключ модели — в узле **OpenAI Chat Model** (или подключите **Anthropic Chat Model**, см. docs/06).\n"
        "3. Google Sheets — во всех узлах `Read …`, `Append …`, `Log`.\n"
        "4. Telegram — в **Telegram Trigger**, **Team Alert**, **Notify Team**, **Send Reply**.\n"
        "5. Опубликуйте воркфлоу (Publish). Статистика лимитов работает только в опубликованном.\n\n"
        "Подробно — QUICKSTART.md."), w=520, h=420, color=5)
    f.sticky("Tools Note", (-660, 640), (
        "### Ветка инструментов\n"
        "Агент вызывает инструменты как под-воркфлоу — **этот же воркфлоу** (`$workflow.id`). "
        "Вызов приходит в **Tool Call**, проходит через Config и попадает сюда.\n\n"
        "Новый инструмент: узел Call n8n Workflow Tool у агента + выход в **Tool Switch** + ветка, "
        "последний узел которой возвращает JSON для модели."), w=520, h=260, color=4)

    f.node("Webhook", "n8n-nodes-base.webhook", 2.1, (-600, 0), {
        "httpMethod": "POST", "path": "support-agent", "responseMode": "responseNode",
        "options": {"allowedOrigins": "*"}}, webhookId=stable_id(SLUG, "webhook"))
    f.node("Telegram Trigger", "n8n-nodes-base.telegramTrigger", 1.2, (-600, 180), {
        "updates": ["message"], "additionalFields": {}}, creds=["telegramApi"], webhookId=stable_id(SLUG, "telegram"))
    f.node("Tool Call", "n8n-nodes-base.executeWorkflowTrigger", 1.1, (-600, 360), {
        "inputSource": "workflowInputs",
        "workflowInputs": {"values": [{"name": n} for n in INPUTS]}})
    f.code("Config", (-360, 180), code("config"))
    f.switch("Kind", (-140, 180), "={{ $json.input.tool ? 'tool' : 'chat' }}", ["chat", "tool"], fallback=False)
    for t in ("Webhook", "Telegram Trigger", "Tool Call"):
        f.connect(t, "Config")
    f.connect("Config", "Kind")

    # ---- chat ----
    f.code("Guard In", (80, 0), code("guard_in"))
    f.connect("Kind", "Guard In", 0)
    f.switch("Route", (300, 0), "={{ $json.route }}", ["agent", "canned", "deny", "bad"], fallback=False)
    f.connect("Guard In", "Route")

    f.node("AI Agent", "@n8n/n8n-nodes-langchain.agent", 3.1, (560, -200), {
        "promptType": "define",
        "text": "={{ $json.agent_input }}",
        "options": {"systemMessage": prompt_expr(prompt), "maxIterations": 8, "returnIntermediateSteps": True}},
        onError="continueRegularOutput")
    f.connect("Route", "AI Agent", 0)
    f.node("OpenAI Chat Model", "@n8n/n8n-nodes-langchain.lmChatOpenAi", 1.3, (420, 60), {
        "model": {"__rl": True, "mode": "list", "value": "gpt-5-mini", "cachedResultName": "gpt-5-mini"},
        "builtInTools": {}, "responsesApiEnabled": False, "options": {}}, creds=["openAiApi"])
    f.node("Anthropic Chat Model", "@n8n/n8n-nodes-langchain.lmChatAnthropic", 1.6, (420, 260), {
        "model": {"__rl": True, "mode": "id", "value": "claude-haiku-5-5"}, "options": {}}, creds=["anthropicApi"])
    f.connect("OpenAI Chat Model", "AI Agent", kind="ai_languageModel")
    f.sticky("Model Note", (360, 400), (
        "**Модель.** Подключена OpenAI (подходит любой OpenAI-совместимый API: укажите Base URL в ключе). "
        "Чтобы работать на Claude — протяните связь от **Anthropic Chat Model** к входу Chat Model агента вместо OpenAI. "
        "Подробно — docs/06-models.md."), w=380, h=180, color=7)
    f.node("Memory", "@n8n/n8n-nodes-langchain.memoryBufferWindow", 1.3, (580, 60), {
        "sessionIdType": "customKey", "sessionKey": "={{ $('Guard In').first().json.session_id }}",
        "contextWindowLength": 12})
    f.connect("Memory", "AI Agent", kind="ai_memory")
    for i, t in enumerate(TOOLS):
        tool_node(f, t, (720 + i * 150, 60), INPUTS)
        node = f.nodes[-1]
        for k, v in FIXED.items():
            node["parameters"]["workflowInputs"]["value"][k] = v
        f.connect(t.name, "AI Agent", kind="ai_tool")

    f.code("Guard Out", (980, -200), code("guard_out"))
    f.connect("AI Agent", "Guard Out")
    f.code("Canned", (560, 220), code("canned"))
    f.connect("Route", "Canned", 1)

    f.if_("Alert Team?", (1200, 0), "={{ Boolean($json.alert_html) }}")
    f.connect("Guard Out", "Alert Team?")
    f.connect("Canned", "Alert Team?")
    f.telegram("Team Alert", (1420, -100), "={{ $('Config').first().json.config.team_chat_id }}", "={{ $json.alert_html }}")
    f.connect("Alert Team?", "Team Alert", 0)
    f.code("Log Row", (1640, 0), code("log_row"))
    f.connect("Team Alert", "Log Row")
    f.connect("Alert Team?", "Log Row", 1)
    # Log Row reads the item before Team Alert replaced it with Telegram's answer.
    lr = f.nodes[-1]
    lr["parameters"]["jsCode"] = lr["parameters"]["jsCode"].replace(
        "const d = $input.first().json;",
        "const d = $('Guard Out').isExecuted ? $('Guard Out').first().json : $('Canned').first().json;")
    f.http("Log", (1860, 0), "POST",
           f"={SHEETS}/{{{{ $('Config').first().json.config.spreadsheet_id }}}}/values/Log!A1:append",
           body="={{ JSON.stringify({ values: [$json.row] }) }}", cred="googleSheetsOAuth2Api",
           query=[("valueInputOption", "RAW"), ("insertDataOption", "INSERT_ROWS")], on_error="continueRegularOutput")
    f.connect("Log Row", "Log")
    f.switch("Reply Channel", (2080, 0), "={{ $('Log Row').first().json.channel }}", ["web", "telegram"], fallback=False)
    f.connect("Log", "Reply Channel")
    f.node("Respond", "n8n-nodes-base.respondToWebhook", 1.1, (2300, -100), {
        "respondWith": "json", "responseBody": "={{ $('Log Row').first().json.response }}", "options": {}})
    f.connect("Reply Channel", "Respond", 0)
    f.telegram("Send Reply", (2300, 100), "={{ $('Log Row').first().json.customer.chat_id }}",
               "={{ $('Log Row').first().json.reply_html }}")
    f.connect("Reply Channel", "Send Reply", 1)

    f.node("Respond 401", "n8n-nodes-base.respondToWebhook", 1.1, (560, 380), {
        "respondWith": "json", "responseBody": '={{ { "error": "unauthorized" } }}', "options": {"responseCode": 401}})
    f.connect("Route", "Respond 401", 2)
    f.node("Respond 400", "n8n-nodes-base.respondToWebhook", 1.1, (560, 540), {
        "respondWith": "json", "responseBody": '={{ { "error": $json.error } }}', "options": {"responseCode": 400}})
    f.connect("Route", "Respond 400", 3)

    # ---- tools ----
    y = 760
    f.switch("Tool Switch", (80, y), "={{ $json.input.tool }}", [t.name for t in TOOLS])
    f.connect("Kind", "Tool Switch", 1)
    cfg = "$('Config').first().json.config"
    f.http("Read Knowledge", (320, y - 120), "GET", f"={SHEETS}/{{{{ {cfg}.spreadsheet_id }}}}/values/Knowledge!A1:E1000",
           cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.code("Rank Articles", (540, y - 120), code("kb_rank"))
    f.chain("Read Knowledge", "Rank Articles")
    f.connect("Tool Switch", "Read Knowledge", 0)

    f.http("Read Orders", (320, y), "GET", f"={SHEETS}/{{{{ {cfg}.spreadsheet_id }}}}/values/Orders!A1:J10000",
           cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.code("Find Order", (540, y), code("find_order"))
    f.chain("Read Orders", "Find Order")
    f.connect("Tool Switch", "Read Orders", 1)

    f.code("Ticket Row", (320, y + 120), code("ticket_row"))
    f.http("Append Ticket", (540, y + 120), "POST", f"={SHEETS}/{{{{ {cfg}.spreadsheet_id }}}}/values/Tickets!A1:append",
           body="={{ JSON.stringify({ values: [$json.row] }) }}", cred="googleSheetsOAuth2Api",
           query=[("valueInputOption", "RAW"), ("insertDataOption", "INSERT_ROWS")], on_error="continueRegularOutput")
    f.code("Ticket Result", (760, y + 120), code("ticket_result"))
    f.chain("Ticket Row", "Append Ticket", "Ticket Result")
    f.connect("Tool Switch", "Ticket Row", 2)

    f.code("Handoff Alert", (320, y + 240), code("handoff_alert"))
    f.telegram("Notify Team", (540, y + 240), f"={{{{ {cfg}.team_chat_id }}}}", "={{ $json.alert_html }}")
    f.code("Handoff Result", (760, y + 240), code("handoff_result"))
    f.chain("Handoff Alert", "Notify Team", "Handoff Result")
    f.connect("Tool Switch", "Handoff Alert", 3)

    f.code("Unknown Tool", (320, y + 360), code("unknown_tool"))
    f.connect("Tool Switch", "Unknown Tool", 4)

    wf = f.render()
    placeholders_only(wf)
    return wf


def error_flow():
    f = Flow("Customer Support Agent — Error Alert", SLUG)
    f.sticky("About", (-40, -260), (
        "## Сигнал об ошибке\nЕсли агент упал (нет доступа к таблице, кончились деньги на ключе модели), "
        "команда узнает в Telegram.\n\nВставьте ID чата в узел **Alert** и укажите этот воркфлоу как "
        "Error Workflow в настройках агента (Settings → Error workflow)."), w=460, h=220, color=5)
    f.node("Error Trigger", "n8n-nodes-base.errorTrigger", 1, (0, 0), {})
    f.code("Message", (220, 0), (
        "const e = $input.first().json;\n"
        "const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\n"
        "const text = [\n"
        "  '<b>⚠️ Ошибка в агенте поддержки</b>',\n"
        "  `Воркфлоу: ${esc(e.workflow?.name)}`,\n"
        "  `Узел: ${esc(e.execution?.lastNodeExecuted)}`,\n"
        "  `Ошибка: ${esc(e.execution?.error?.message).slice(0, 500)}`,\n"
        "  e.execution?.url ? `<a href=\"${esc(e.execution.url)}\">Открыть выполнение</a>` : '',\n"
        "].filter(Boolean).join('\\n');\n"
        "return [{ json: { text } }];\n"))
    f.telegram("Alert", (440, 0), "ВСТАВЬТЕ_ID_ЧАТА", "={{ $json.text }}", on_error="stopWorkflow")
    f.chain("Error Trigger", "Message", "Alert")
    return f.render()


def schemas():
    write_json(OUT / "agent" / "tools.openai.json", [t.openai() for t in TOOLS])
    write_json(OUT / "agent" / "tools.anthropic.json", [t.anthropic() for t in TOOLS])


if __name__ == "__main__":
    wf = build()
    write_json(OUT / "workflows" / f"{SLUG}.n8n.json", wf)
    write_json(OUT / "workflows" / "error-alert.n8n.json", error_flow())
    schemas()
    no_secrets(json.dumps(wf))
    print("nodes:", len(wf["nodes"]))
