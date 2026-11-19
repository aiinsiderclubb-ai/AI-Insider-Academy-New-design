"""
Chat-agent chassis shared by the sales and booking kits: channels (webhook,
Telegram), Config, Guard In, the AI Agent with memory and tools, Guard Out,
canned answers, team alert, log and the reply. Each kit adds its tools and the
branches behind them.

Copied from the customer-support-agent build and generalised; the JS lives in
sales/chat_js. Worth moving to common/ once a third chat kit uses it.
"""
import json
import re
import sys
from pathlib import Path

KITS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(KITS))
from nk import SHEETS, Flow, stable_id, tool_node  # noqa: E402

COMMON = (KITS / "common" / "text.js").read_text(encoding="utf8")
CHAT_JS = Path(__file__).resolve().parent / "chat_js"


def load_js(path):
    src = Path(path).read_text(encoding="utf8")
    return src.replace("// @include text.js\n", COMMON + "\n").strip() + "\n"


def chat_js(name):
    return load_js(CHAT_JS / f"{name}.js")


def prompt_expr(text):
    """{{key}} in the prompt file becomes a reference to the same key in Config."""
    rest = re.sub(r"\{\{\w+\}\}", "", text)
    assert "{" not in rest and "}" not in rest, "stray brace in prompt"
    return "=" + re.sub(r"\{\{(\w+)\}\}", lambda m: "{{ $('Config').first().json.config.%s }}" % m.group(1), text)


G = "$('Guard In').first().json"
BASE_FIXED = {
    "session_id": "={{ %s.session_id }}" % G,
    "channel": "={{ %s.channel }}" % G,
    "customer_name": "={{ %s.customer.name || '' }}" % G,
    "customer_contact": "={{ [%s.customer.email, %s.customer.phone, %s.customer.telegram].filter(Boolean).join(' · ') }}" % (G, G, G),
    "customer_email": "={{ %s.customer.email || '' }}" % G,
    "customer_phone": "={{ %s.customer.phone || '' }}" % G,
    "chat_id": "={{ String(%s.customer.chat_id || '') }}" % G,
    "last_message": "={{ %s.text }}" % G,
}

HANDOFF_PARAMS = [("reason", "string", "Почему нужен человек, одной фразой"),
                  ("summary", "string", "Суть и что уже выяснено, чтобы менеджеру не перечитывать переписку"),
                  ("urgency", "string", "low, normal или high")]


def build_chat(f, *, slug, path, prompt, config_code, tools, inputs, readme_note, extra_fixed=None, schedule=None):
    """Lays out everything except the kit's tool branches. Returns (Tool Switch name, y of the tool area)."""
    fixed = dict(BASE_FIXED, **(extra_fixed or {}))
    f.sticky("Read Me", (-660, -480), readme_note, w=540, h=440, color=5)
    f.sticky("Tools Note", (-660, 640), (
        "### Ветка инструментов\n"
        "Агент вызывает инструменты как под-воркфлоу — **этот же воркфлоу** (`$workflow.id`). "
        "Вызов приходит в **Tool Call**, проходит через Config и попадает в **Tool Switch**.\n\n"
        "Новый инструмент: узел Call n8n Workflow Tool у агента + выход в Tool Switch + ветка, "
        "последний узел которой возвращает JSON с полем `note` для модели."), w=540, h=260, color=4)

    f.node("Webhook", "n8n-nodes-base.webhook", 2.1, (-600, 0), {
        "httpMethod": "POST", "path": path, "responseMode": "responseNode",
        "options": {"allowedOrigins": "*"}}, webhookId=stable_id(slug, "webhook"))
    f.node("Telegram Trigger", "n8n-nodes-base.telegramTrigger", 1.2, (-600, 180), {
        "updates": ["message"], "additionalFields": {}}, creds=["telegramApi"], webhookId=stable_id(slug, "telegram"))
    f.node("Tool Call", "n8n-nodes-base.executeWorkflowTrigger", 1.1, (-600, 360), {
        "inputSource": "workflowInputs", "workflowInputs": {"values": [{"name": n} for n in inputs]}})
    f.code("Config", (-360, 180), config_code)
    if schedule:
        # A Schedule Trigger in the same workflow shares Config; its item carries "Readable date".
        f.node("Schedule", "n8n-nodes-base.scheduleTrigger", 1.2, (-600, 540), {
            "rule": {"interval": [{"field": "minutes", "minutesInterval": schedule["minutes"]}]}})
        f.switch("Kind", (-140, 180),
                 "={{ $json.input.tool ? 'tool' : ($json.input['Readable date'] !== undefined && !$json.input.body ? '%s' : 'chat') }}" % schedule["kind"],
                 ["chat", "tool", schedule["kind"]], fallback=False)
        f.connect("Schedule", "Config")
    else:
        f.switch("Kind", (-140, 180), "={{ $json.input.tool ? 'tool' : 'chat' }}", ["chat", "tool"], fallback=False)
    for t in ("Webhook", "Telegram Trigger", "Tool Call"):
        f.connect(t, "Config")
    f.connect("Config", "Kind")

    f.code("Guard In", (80, 0), chat_js("guard_in"))
    f.connect("Kind", "Guard In", 0)
    f.switch("Route", (300, 0), "={{ $json.route }}", ["agent", "canned", "deny", "bad"], fallback=False)
    f.connect("Guard In", "Route")

    f.node("AI Agent", "@n8n/n8n-nodes-langchain.agent", 3.1, (560, -200), {
        "promptType": "define", "text": "={{ $json.agent_input }}",
        "options": {"systemMessage": prompt_expr(prompt), "maxIterations": 10, "returnIntermediateSteps": True}},
        onError="continueRegularOutput")
    f.connect("Route", "AI Agent", 0)
    f.node("OpenAI Chat Model", "@n8n/n8n-nodes-langchain.lmChatOpenAi", 1.3, (420, 60), {
        "model": {"__rl": True, "mode": "list", "value": "gpt-5-mini", "cachedResultName": "gpt-5-mini"},
        "builtInTools": {}, "responsesApiEnabled": False, "options": {}}, creds=["openAiApi"])
    f.node("Anthropic Chat Model", "@n8n/n8n-nodes-langchain.lmChatAnthropic", 1.6, (420, 260), {
        "model": {"__rl": True, "mode": "id", "value": "claude-haiku-5-5"}, "options": {}}, creds=["anthropicApi"])
    f.connect("OpenAI Chat Model", "AI Agent", kind="ai_languageModel")
    f.sticky("Model Note", (360, 400), (
        "**Модель.** Подключена OpenAI (подходит любой OpenAI-совместимый API: Base URL в ключе). "
        "Чтобы работать на Claude — протяните связь от **Anthropic Chat Model** к входу Chat Model агента вместо OpenAI. "
        "Подробно — docs/06-models.md."), w=380, h=180, color=7)
    f.node("Memory", "@n8n/n8n-nodes-langchain.memoryBufferWindow", 1.3, (580, 60), {
        "sessionIdType": "customKey", "sessionKey": "={{ $('Guard In').first().json.session_id }}",
        "contextWindowLength": 16})
    f.connect("Memory", "AI Agent", kind="ai_memory")
    for i, t in enumerate(tools):
        tool_node(f, t, (720 + i * 140, 60), inputs)
        node = f.nodes[-1]
        for k, v in fixed.items():
            if k in inputs:
                node["parameters"]["workflowInputs"]["value"][k] = v
        f.connect(t.name, "AI Agent", kind="ai_tool")

    f.code("Guard Out", (1080, -200), chat_js("guard_out"))
    f.connect("AI Agent", "Guard Out")
    f.code("Canned", (560, 220), chat_js("canned"))
    f.connect("Route", "Canned", 1)

    f.if_("Alert Team?", (1300, 0), "={{ Boolean($json.alert_html) }}")
    f.connect("Guard Out", "Alert Team?")
    f.telegram("Team Alert", (1520, -100), "={{ $('Config').first().json.config.team_chat_id }}", "={{ $json.alert_html }}")
    f.connect("Alert Team?", "Team Alert", 0)
    lr = chat_js("log_row").replace(
        "const d = $input.first().json;",
        "const d = $('Guard Out').isExecuted ? $('Guard Out').first().json : $('Canned').first().json;")
    f.code("Log Row", (1740, 0), lr)
    f.connect("Team Alert", "Log Row")
    f.connect("Alert Team?", "Log Row", 1)
    f.http("Log", (1960, 0), "POST",
           f"={SHEETS}/{{{{ $('Config').first().json.config.spreadsheet_id }}}}/values/Log!A1:append",
           body="={{ JSON.stringify({ values: [$json.row] }) }}", cred="googleSheetsOAuth2Api",
           query=[("valueInputOption", "RAW"), ("insertDataOption", "INSERT_ROWS")], on_error="continueRegularOutput")
    f.connect("Log Row", "Log")
    f.switch("Reply Channel", (2180, 0), "={{ $('Log Row').first().json.channel }}", ["web", "telegram"], fallback=False)
    f.connect("Log", "Reply Channel")
    f.node("Respond", "n8n-nodes-base.respondToWebhook", 1.1, (2400, -100), {
        "respondWith": "json", "responseBody": "={{ $('Log Row').first().json.response }}", "options": {}})
    f.connect("Reply Channel", "Respond", 0)
    f.telegram("Send Reply", (2400, 100), "={{ $('Log Row').first().json.customer.chat_id }}",
               "={{ $('Log Row').first().json.reply_html }}")
    f.connect("Reply Channel", "Send Reply", 1)

    f.node("Respond 401", "n8n-nodes-base.respondToWebhook", 1.1, (560, 380), {
        "respondWith": "json", "responseBody": '={{ { "error": "unauthorized" } }}', "options": {"responseCode": 401}})
    f.connect("Route", "Respond 401", 2)
    f.node("Respond 400", "n8n-nodes-base.respondToWebhook", 1.1, (560, 540), {
        "respondWith": "json", "responseBody": '={{ { "error": $json.error } }}', "options": {"responseCode": 400}})
    f.connect("Route", "Respond 400", 3)

    y = 820
    f.switch("Tool Switch", (80, y), "={{ $json.input.tool }}", [t.name for t in tools])
    f.connect("Kind", "Tool Switch", 1)
    return "Tool Switch", y


def canned_to_alert(f, via=None):
    """Canned answers go to the team alert check, optionally through a kit node first."""
    if via:
        f.connect("Canned", via)
        f.connect(via, "Alert Team?")
    else:
        f.connect("Canned", "Alert Team?")


def handoff_branch(f, pos, out_index):
    x, y = pos
    f.code("Handoff Alert", (x, y), chat_js("handoff_alert"))
    f.telegram("Notify Team", (x + 220, y), "={{ $('Config').first().json.config.team_chat_id }}", "={{ $json.alert_html }}")
    f.code("Handoff Result", (x + 440, y), chat_js("handoff_result"))
    f.chain("Handoff Alert", "Notify Team", "Handoff Result")
    f.connect("Tool Switch", "Handoff Alert", out_index)


def unknown_branch(f, pos, out_index):
    f.code("Unknown Tool", pos, chat_js("unknown_tool"))
    f.connect("Tool Switch", "Unknown Tool", out_index)


def error_flow(slug, title):
    f = Flow(f"{title} — Error Alert", slug)
    f.sticky("About", (-40, -260), (
        "## Сигнал об ошибке\nЕсли агент упал, команда узнает в Telegram.\n\n"
        "Вставьте ID чата в узел **Alert** и выберите этот воркфлоу как Error Workflow в настройках агента "
        "(Settings → Error workflow)."), w=460, h=200, color=5)
    f.node("Error Trigger", "n8n-nodes-base.errorTrigger", 1, (0, 0), {})
    f.code("Message", (220, 0), (
        "const e = $input.first().json;\n"
        "const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\n"
        "const text = [\n"
        f"  '<b>⚠️ Ошибка: {title}</b>',\n"
        "  `Воркфлоу: ${esc(e.workflow?.name)}`,\n"
        "  `Узел: ${esc(e.execution?.lastNodeExecuted)}`,\n"
        "  `Ошибка: ${esc(e.execution?.error?.message).slice(0, 500)}`,\n"
        "  e.execution?.url ? `<a href=\"${esc(e.execution.url)}\">Открыть выполнение</a>` : '',\n"
        "].filter(Boolean).join('\\n');\n"
        "return [{ json: { text } }];\n"))
    f.telegram("Alert", (440, 0), "ВСТАВЬТЕ_ID_ЧАТА", "={{ $json.text }}", on_error="stopWorkflow")
    f.chain("Error Trigger", "Message", "Alert")
    return f.render()


def write_schemas(out, tools):
    from nk import write_json
    write_json(out / "agent" / "tools.openai.json", [t.openai() for t in tools])
    write_json(out / "agent" / "tools.anthropic.json", [t.anthropic() for t in tools])


def dump(obj):
    return json.dumps(obj, ensure_ascii=False)
