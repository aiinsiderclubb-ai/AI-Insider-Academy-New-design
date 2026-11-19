"""Builds content/products/lead-qualification-agent."""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parent / "sales"))
from nk import PRODUCTS, SHEETS, Flow, Tool, tool_node, write_json, placeholders_only, no_secrets, stable_id  # noqa: E402
import nk  # noqa: E402
import chassis  # noqa: E402

nk.CRED_NAMES.setdefault("smtp", "SMTP account")
SLUG = "lead-qualification-agent"
OUT = PRODUCTS / SLUG
COLS = (HERE / "js" / "cols.js").read_text(encoding="utf8")
URLJS = (HERE / "js" / "url.js").read_text(encoding="utf8")


def code(name):
    src = chassis.load_js(HERE / "js" / f"{name}.js")
    return src.replace("// @include cols.js\n", COLS + "\n").replace("// @include url.js\n", URLJS + "\n")


TOOLS = [
    Tool("fetch_page", "Открывает страницу сайта лида и возвращает заголовок, описание, текст и ссылки. Только сайт самого лида.",
         [("url", "string", "Полный адрес страницы на сайте лида: главная или страница о компании, услугах, команде")]),
    Tool("submit_assessment", "Сдаёт оценку лида. Вызови один раз со всеми полями; если вернулись ошибки — исправь и вызови снова.",
         [("fit", "string", "high, medium или low — насколько похож на идеального клиента"),
          ("intent", "string", "high, medium или low — насколько ясна задача и готовность купить"),
          ("company_size", "string", "1, 2-10, 11-50, 51-200, 201-1000, 1000+ или unknown"),
          ("urgency", "string", "now, quarter, later или unknown"),
          ("summary", "string", "1–3 предложения для менеджера"),
          ("questions", "string", "До трёх вопросов для первого звонка через точку с запятой; пустая строка, если всё ясно"),
          ("red_flags", "string", "Через запятую: spam, job_seeker, student, competitor, vendor_pitch, out_of_area, existing_customer, test; пустая строка, если нет")]),
]
INPUTS = ["tool", "url", "lead_domain", "fit", "intent", "company_size", "urgency", "summary", "questions", "red_flags"]
CFG = "$('Config').first().json.config"


def build():
    prompt = (OUT / "agent" / "system-prompt.md").read_text(encoding="utf8").strip()
    f = Flow("Lead Qualification Agent", SLUG)
    f.sticky("Read Me", (-660, -460), (
        "## Lead Qualification Agent\n"
        "Заявка с формы → проверка и дубли → модель изучает сайт и сдаёт оценку → баллы по рубрике считает код → "
        "менеджер по кругу в сегменте → строка в CRM и карточка в Telegram.\n\n"
        "**Перед запуском:**\n"
        "1. **Config** — предложение, идеальный клиент, рубрика, менеджеры и их Telegram-чаты, ID таблицы, `agent_token`.\n"
        "2. Ключи: модель, Google Sheets (**Read CRM**, **Write CRM**), Telegram (**Notify**).\n"
        "3. Publish. Подробно — QUICKSTART.md."), w=540, h=380, color=5)

    f.node("Lead Webhook", "n8n-nodes-base.webhook", 2.1, (-600, 0), {
        "httpMethod": "POST", "path": "lead-qualification", "responseMode": "responseNode", "options": {"allowedOrigins": "*"}},
        webhookId=stable_id(SLUG, "webhook"))
    f.node("Tool Call", "n8n-nodes-base.executeWorkflowTrigger", 1.1, (-600, 300), {
        "inputSource": "workflowInputs", "workflowInputs": {"values": [{"name": n} for n in INPUTS]}})
    f.code("Config", (-380, 150), code("config"))
    f.connect("Lead Webhook", "Config")
    f.connect("Tool Call", "Config")
    f.switch("Kind", (-160, 150), "={{ $json.input.tool ? 'tool' : 'lead' }}", ["lead", "tool"], fallback=False)
    f.connect("Config", "Kind")

    f.code("Intake", (60, 0), code("intake"))
    f.connect("Kind", "Intake", 0)
    f.switch("Route Intake", (280, 0), "={{ $json.route }}", ["ok", "deny", "bad", "spam", "repeat"], fallback=False)
    f.connect("Intake", "Route Intake")
    f.node("Respond 401", "n8n-nodes-base.respondToWebhook", 1.1, (500, 220), {
        "respondWith": "json", "responseBody": '={{ { "error": "unauthorized" } }}', "options": {"responseCode": 401}})
    f.connect("Route Intake", "Respond 401", 1)
    f.node("Respond 400", "n8n-nodes-base.respondToWebhook", 1.1, (500, 360), {
        "respondWith": "json", "responseBody": '={{ { "error": $json.error } }}', "options": {"responseCode": 400}})
    f.connect("Route Intake", "Respond 400", 2)
    f.node("Respond Quietly", "n8n-nodes-base.respondToWebhook", 1.1, (500, 500), {
        "respondWith": "json", "responseBody": '={{ $json.debug ? { "ok": true, "ignored": $json.route } : { "ok": true } }}', "options": {}})
    f.connect("Route Intake", "Respond Quietly", 3)
    f.connect("Route Intake", "Respond Quietly", 4)

    f.if_("Debug?", (500, 0), "={{ $json.debug }}")
    f.connect("Route Intake", "Debug?", 0)
    f.node("Respond 202", "n8n-nodes-base.respondToWebhook", 1.1, (720, 80), {
        "respondWith": "json", "responseBody": '={{ { "ok": true, "lead_id": $json.lead.lead_id } }}', "options": {"responseCode": 202}})
    f.connect("Debug?", "Respond 202", 1)
    f.http("Read CRM", (940, 0), "GET", f"={SHEETS}/{{{{ {CFG}.spreadsheet_id }}}}/values/Leads!A1:V20000",
           cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.connect("Debug?", "Read CRM", 0)
    f.connect("Respond 202", "Read CRM")
    f.code("Dedupe", (1160, 0), code("dedupe"))
    f.connect("Read CRM", "Dedupe")

    f.node("AI Agent", "@n8n/n8n-nodes-langchain.agent", 3.1, (1400, 0), {
        "promptType": "define", "text": "={{ $json.agent_input }}",
        "options": {"systemMessage": chassis.prompt_expr(prompt), "maxIterations": 6, "returnIntermediateSteps": True}},
        onError="continueRegularOutput")
    f.connect("Dedupe", "AI Agent")
    f.node("OpenAI Chat Model", "@n8n/n8n-nodes-langchain.lmChatOpenAi", 1.3, (1260, 240), {
        "model": {"__rl": True, "mode": "list", "value": "gpt-5-mini", "cachedResultName": "gpt-5-mini"},
        "builtInTools": {}, "responsesApiEnabled": False, "options": {}}, creds=["openAiApi"])
    f.node("Anthropic Chat Model", "@n8n/n8n-nodes-langchain.lmChatAnthropic", 1.6, (1260, 420), {
        "model": {"__rl": True, "mode": "id", "value": "claude-haiku-5-5"}, "options": {}}, creds=["anthropicApi"])
    f.connect("OpenAI Chat Model", "AI Agent", kind="ai_languageModel")
    f.sticky("Model Note", (1180, 560), (
        "**Модель.** Подключена OpenAI (подходит любой OpenAI-совместимый API). Для Claude протяните связь от "
        "**Anthropic Chat Model** к входу Chat Model агента. Подробно — docs/06-models.md."), w=360, h=160, color=7)
    for i, t in enumerate(TOOLS):
        tool_node(f, t, (1440 + i * 160, 240), INPUTS)
        f.nodes[-1]["parameters"]["workflowInputs"]["value"]["lead_domain"] = "={{ $('Dedupe').first().json.lead.domain }}"
        f.connect(t.name, "AI Agent", kind="ai_tool")

    f.code("Score", (1640, 0), code("score"))
    f.connect("AI Agent", "Score")
    f.code("Route", (1860, 0), code("route"))
    f.connect("Score", "Route")
    f.http("Write CRM", (2080, 0), "={{ $json.http.method }}",
           f"={SHEETS}/{{{{ {CFG}.spreadsheet_id }}}}/values/{{{{ $json.http.path }}}}",
           body="={{ JSON.stringify($json.http.body) }}", cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.connect("Route", "Write CRM")
    f.code("After Write", (2300, 0), code("after_write"))
    f.connect("Write CRM", "After Write")
    f.if_("Debug Reply?", (2520, 0), "={{ $json.debug }}")
    f.connect("After Write", "Debug Reply?")
    f.node("Respond Report", "n8n-nodes-base.respondToWebhook", 1.1, (2740, -100), {
        "respondWith": "json", "responseBody": "={{ $json.response }}", "options": {}})
    f.connect("Debug Reply?", "Respond Report", 0)
    f.code("Notify Each", (2960, 0), code("notify_each"))
    f.connect("Respond Report", "Notify Each")
    f.connect("Debug Reply?", "Notify Each", 1)
    f.telegram("Notify", (3180, 0), "={{ $json.chat_id }}", "={{ $json.text }}")
    f.connect("Notify Each", "Notify")

    f.if_("Clarify?", (2520, 240), "={{ Boolean($('After Write').first().json.email) }}")
    f.connect("After Write", "Clarify?")
    f.node("Clarify Email", "n8n-nodes-base.emailSend", 2.1, (2740, 240), {
        "fromEmail": "ВАШ_АДРЕС@example.com", "toEmail": "={{ $('After Write').first().json.email.to }}",
        "subject": "={{ $('After Write').first().json.email.subject }}", "emailFormat": "text",
        "text": "={{ $('After Write').first().json.email.text }}", "options": {"appendAttribution": False}},
        creds=["smtp"], onError="continueRegularOutput")
    f.connect("Clarify?", "Clarify Email", 0)

    # ---- tools ----
    y = 760
    f.sticky("Tools Note", (-660, y - 60), (
        "### Инструменты агента\nМодель вызывает этот же воркфлоу как под-воркфлоу (`$workflow.id`): вызов приходит в **Tool Call**.\n\n"
        "**fetch_page** открывает только сайт лида: проверка адреса — в Fetch Plan.\n"
        "**submit_assessment** принимает оценку только со значениями из списков — модель исправит и пришлёт снова."), w=540, h=240, color=4)
    f.switch("Tool Switch", (60, y), "={{ $json.input.tool }}", [t.name for t in TOOLS])
    f.connect("Kind", "Tool Switch", 1)
    f.code("Fetch Plan", (280, y - 80), code("fetch_plan"))
    f.connect("Tool Switch", "Fetch Plan", 0)
    f.if_("Allowed?", (500, y - 80), "={{ $json.ok }}")
    f.connect("Fetch Plan", "Allowed?")
    f.node("Fetch Page", "n8n-nodes-base.httpRequest", 4.2, (720, y - 160), {
        "method": "GET", "url": "={{ $json.url }}",
        "options": {"timeout": 10000, "redirect": {"redirect": {"maxRedirects": 3}},
                    "response": {"response": {"responseFormat": "text"}}},
        "sendHeaders": True, "headerParameters": {"parameters": [{"name": "user-agent", "value": "Mozilla/5.0 (compatible; LeadQualifier/1.0)"}]}},
        onError="continueRegularOutput")
    f.connect("Allowed?", "Fetch Page", 0)
    f.code("Page Text", (940, y - 160), code("fetch_text"))
    f.connect("Fetch Page", "Page Text")
    f.code("Refused", (720, y), "return [{ json: $input.first().json.result }];\n")
    f.connect("Allowed?", "Refused", 1)
    f.code("Check Assessment", (280, y + 120), code("assess"))
    f.connect("Tool Switch", "Check Assessment", 1)
    f.code("Unknown Tool", (280, y + 240), chassis.chat_js("unknown_tool"))
    f.connect("Tool Switch", "Unknown Tool", 2)

    wf = f.render()
    placeholders_only(wf)
    return wf


if __name__ == "__main__":
    wf = build()
    write_json(OUT / "workflows" / f"{SLUG}.n8n.json", wf)
    write_json(OUT / "workflows" / "error-alert.n8n.json", chassis.error_flow(SLUG, "квалификация лидов"))
    chassis.write_schemas(OUT, TOOLS)
    no_secrets(json.dumps(wf))
    print("nodes:", len(wf["nodes"]))
