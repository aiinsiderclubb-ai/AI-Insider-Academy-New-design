"""Builds content/products/multi-agent-ops-team: two workflows (OpenAI, Claude) from js/ and the prompts."""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from nk import PRODUCTS, SHEETS, Flow, Tool, stable_id, tool_node, write_json, placeholders_only, no_secrets  # noqa: E402

SLUG = "multi-agent-ops-team"
OUT = PRODUCTS / SLUG
COMMON = (HERE.parent / "common" / "text.js").read_text(encoding="utf8")
AGENTS = ["email_triage_agent", "leads_agent", "support_agent", "reports_agent"]
PROMPT_FILES = {"orchestrator": "orchestrator", "email_triage_agent": "email-triage", "leads_agent": "leads",
                "support_agent": "support", "reports_agent": "reports"}


def code(name):
    src = (HERE / "js" / f"{name}.js").read_text(encoding="utf8")
    return src.replace("// @include text.js\n", COMMON + "\n").strip() + "\n"


def prompts():
    return {k: (OUT / "agent" / "prompts" / f"{v}.md").read_text(encoding="utf8").strip() for k, v in PROMPT_FILES.items()}


def prompts_code():
    texts = prompts()
    body = ",\n".join(f"  {k}: {json.dumps(v, ensure_ascii=False)}" for k, v in texts.items())
    return (
        "// Prompts: системные инструкции оркестратора и четырёх агентов.\n"
        "// Тексты — те же, что в agent/prompts/*.md. Правьте здесь или там и вставьте заново.\n"
        "// {{ключ}} подставляется из Config. Агент, которого в этом канале звать нельзя\n"
        "// или чей дневной лимит исчерпан, получает инструкцию-заглушку.\n"
        "const { config } = $('Config').first().json;\n"
        "const g = $('Guard In').first().json;\n"
        f"const TEXTS = {{\n{body},\n}};\n"
        "const fill = (t) => t.replace(/\\{\\{(\\w+)\\}\\}/g, (_, k) => String(config[k] ?? ''));\n"
        "const BLOCKED = 'Ты временно недоступен: дневной лимит исчерпан или этот канал тебе не разрешён. '\n"
        "  + 'Не вызывай инструменты. Ответь ровно одной фразой: «Агент недоступен, нужна передача человеку.»';\n"
        "const out = { orchestrator: fill(TEXTS.orchestrator) };\n"
        f"for (const agent of {json.dumps(AGENTS)}) out[agent] = (g.allowed || []).includes(agent) ? fill(TEXTS[agent]) : BLOCKED;\n"
        "return [{ json: out }];\n"
    )


TOOLS = {
    "search_knowledge": Tool("search_knowledge",
        "Ищет ответ в базе знаний компании. Вызывай перед любым ответом по существу. Возвращает до трёх статей или found=false.",
        [("query", "string", "Вопрос клиента ключевыми словами на его языке")]),
    "create_ticket": Tool("create_ticket",
        "Создаёт обращение для сотрудника, когда вопрос требует действий человека, но не срочный. Возвращает номер обращения.",
        [("topic", "string", "Тема в 3–7 словах"),
         ("summary", "string", "Суть: что случилось, что клиент сообщил, чего хочет"),
         ("priority", "string", "low, normal, high или urgent"),
         ("email", "string", "Email клиента; пустая строка, если неизвестен")]),
    "save_lead": Tool("save_lead",
        "Сохраняет потенциального клиента в лист Leads, считает балл по правилам и сообщает команде о горячем лиде.",
        [("name", "string", "Имя клиента; пустая строка, если неизвестно"),
         ("contact", "string", "Email, телефон или Telegram клиента"),
         ("company", "string", "Компания; пустая строка, если неизвестна"),
         ("need", "string", "Что нужно клиенту, конкретно, его словами"),
         ("budget_eur", "number", "Бюджет в евро, если клиент назвал; 0, если нет"),
         ("timeline", "string", "now, month, quarter, later или unknown"),
         ("decision_maker", "string", "yes, no или unknown")]),
    "save_email_triage": Tool("save_email_triage",
        "Сохраняет разбор письма в лист Inbox с черновиком ответа; о срочных и важных письмах сообщает команде. Вызывай один раз на письмо.",
        [("category", "string", "lead, support, billing, partner, spam или other"),
         ("priority", "string", "low, normal, high или urgent"),
         ("summary", "string", "Суть письма в 1–2 предложениях"),
         ("draft_reply", "string", "Черновик ответа; пустая строка для spam")]),
    "get_metrics": Tool("get_metrics",
        "Цифры для отчёта из журналов: диалоги, лиды, обращения, почта, вызовы агентов.",
        [("period", "string", "yesterday, 7d или 30d")]),
    "handoff_to_human": Tool("handoff_to_human",
        "Передаёт диалог менеджеру и уведомляет команду. Для денег, жалоб, просьбы позвать человека и всего, что агенты не решают.",
        [("reason", "string", "Почему нужен человек, одной фразой"),
         ("summary", "string", "Суть вопроса и что уже выяснено"),
         ("urgency", "string", "low, normal или high")]),
}
OWNER = {"search_knowledge": "support_agent", "create_ticket": "support_agent", "save_lead": "leads_agent",
         "save_email_triage": "email_triage_agent", "get_metrics": "reports_agent", "handoff_to_human": "orchestrator"}

SPECIALISTS = [
    ("email_triage_agent", "Разбирает входящее письмо: категория, срочность, суть, черновик ответа. Только для канала «почта».", 4),
    ("leads_agent", "Квалифицирует потенциального клиента и сохраняет лида: задача, бюджет, сроки, кто решает, контакт.", 4),
    ("support_agent", "Отвечает на вопросы клиентов по базе знаний и создаёт обращения для сотрудников.", 5),
    ("reports_agent", "Готовит отчёт по цифрам из журналов за вчера, неделю или месяц. Только для команды и расписания.", 3),
]

INPUTS = ["tool", "agent", "query", "topic", "summary", "priority", "email", "reason", "urgency", "name", "contact", "company",
          "need", "budget_eur", "timeline", "decision_maker", "category", "draft_reply", "period", "session_id", "channel",
          "customer_name", "customer_contact", "last_message", "email_subject"]
G = "$('Guard In').first().json"
FIXED = {
    "session_id": "={{ %s.session_id }}" % G,
    "channel": "={{ %s.channel }}" % G,
    "customer_name": "={{ (%s.customer || {}).name || '' }}" % G,
    "customer_contact": "={{ [(%s.customer || {}).email, (%s.customer || {}).phone, (%s.customer || {}).telegram].filter(Boolean).join(' · ') }}" % (G, G, G),
    "last_message": "={{ %s.text }}" % G,
    "email_subject": "={{ %s.subject || '' }}" % G,
}


def build(provider="openai"):
    f = Flow("Multi-Agent Ops Team" + (" (Claude)" if provider == "anthropic" else ""), SLUG)
    model_note = "Anthropic Chat Model (Claude)" if provider == "anthropic" else "OpenAI Chat Model"

    f.sticky("Read Me", (-700, -560), (
        "## Multi-Agent Ops Team\n"
        "Оркестратор и четыре агента: разбор почты, лиды, поддержка, отчёты. Входы — сайт и любые системы (Webhook), "
        "Telegram, почта (IMAP), расписание.\n\n"
        "**Перед запуском:**\n"
        "1. **Config** — компания, ID таблицы, чат команды, `agent_token`, `team_token`.\n"
        f"2. Ключ модели — в узле **{model_note}** (он один на всех агентов).\n"
        "3. Google Sheets — во всех узлах `Read …`, `Append …`, `Log`.\n"
        "4. Telegram — в **Telegram Trigger** и всех узлах с иконкой Telegram.\n"
        "5. Почта — ключ IMAP в **Email Trigger**. Нет почты — отключите узел (Deactivate).\n"
        "6. **Publish**.\n\nПодробно — QUICKSTART.md."), w=560, h=440, color=5)
    f.sticky("Tools Note", (-700, 820), (
        "### Ветка инструментов\n"
        "Инструменты агентов — ветки этого же воркфлоу (`$workflow.id`). Вызов приходит в **Tool Call**, "
        "проходит через Config и попадает в **Tool Switch**. Ответ ветки идёт через **Service Error?** — "
        "при сбое таблицы команда получает сигнал — и возвращается агенту из **Tool Return**."), w=560, h=240, color=4)

    f.node("Webhook", "n8n-nodes-base.webhook", 2.1, (-640, -120), {
        "httpMethod": "POST", "path": "ops-team", "responseMode": "responseNode",
        "options": {"allowedOrigins": "*"}}, webhookId=stable_id(SLUG, "webhook"))
    f.node("Telegram Trigger", "n8n-nodes-base.telegramTrigger", 1.2, (-640, 40), {
        "updates": ["message"], "additionalFields": {}}, creds=["telegramApi"], webhookId=stable_id(SLUG, "telegram"))
    email = f.node("Email Trigger", "n8n-nodes-base.emailReadImap", 2.1, (-640, 200), {
        "mailbox": "INBOX", "postProcessAction": "read", "format": "simple", "options": {}})
    f.nodes[-1]["credentials"] = {"imap": {"id": "REPLACE_ME", "name": "Mailbox"}}
    f.node("Daily Report", "n8n-nodes-base.scheduleTrigger", 1.2, (-640, 360), {
        "rule": {"interval": [{"field": "days", "triggerAtHour": 9}]}})
    f.node("Tool Call", "n8n-nodes-base.executeWorkflowTrigger", 1.1, (-640, 520), {
        "inputSource": "workflowInputs", "workflowInputs": {"values": [{"name": n} for n in INPUTS]}})
    f.code("Config", (-400, 200), code("config"))
    f.switch("Kind", (-180, 200), "={{ $json.input.tool ? 'tool' : 'message' }}", ["message", "tool"], fallback=False)
    for t in ("Webhook", "Telegram Trigger", email, "Daily Report", "Tool Call"):
        f.connect(t, "Config")
    f.connect("Config", "Kind")

    # ---- messages ----
    f.code("Guard In", (40, 0), code("guard_in"))
    f.connect("Kind", "Guard In", 0)
    f.switch("Route", (260, 0), "={{ $json.route }}", ["agent", "canned", "deny", "bad"], fallback=False)
    f.connect("Guard In", "Route")
    f.code("Prompts", (480, -220), prompts_code())
    f.connect("Route", "Prompts", 0)
    f.node("Orchestrator", "@n8n/n8n-nodes-langchain.agent", 3.1, (720, -220), {
        "promptType": "define",
        "text": "={{ $('Guard In').first().json.agent_input }}",
        "options": {"systemMessage": "={{ $json.orchestrator }}", "maxIterations": 6, "returnIntermediateSteps": True}},
        onError="continueRegularOutput")
    f.connect("Prompts", "Orchestrator")

    if provider == "anthropic":
        f.node("Anthropic Chat Model", "@n8n/n8n-nodes-langchain.lmChatAnthropic", 1.6, (560, 80), {
            "model": {"__rl": True, "mode": "id", "value": "claude-haiku-5-5"}, "options": {}}, creds=["anthropicApi"])
        model = "Anthropic Chat Model"
    else:
        f.node("OpenAI Chat Model", "@n8n/n8n-nodes-langchain.lmChatOpenAi", 1.3, (560, 80), {
            "model": {"__rl": True, "mode": "list", "value": "gpt-5-mini", "cachedResultName": "gpt-5-mini"},
            "builtInTools": {}, "responsesApiEnabled": False, "options": {}}, creds=["openAiApi"])
        model = "OpenAI Chat Model"
    f.sticky("Model Note", (440, 220), (
        f"**Одна модель на всех.** Узел **{model}** подключён к оркестратору и к каждому агенту. "
        "Чтобы дать агенту свою модель (например, сильнее для оркестратора), добавьте второй узел модели "
        "и переключите связь этого агента. Подробно — docs/06-models.md."), w=380, h=170, color=7)
    f.connect(model, "Orchestrator", kind="ai_languageModel")
    f.node("Memory", "@n8n/n8n-nodes-langchain.memoryBufferWindow", 1.3, (720, 80), {
        "sessionIdType": "customKey", "sessionKey": "={{ $('Guard In').first().json.session_id }}",
        "contextWindowLength": 12})
    f.connect("Memory", "Orchestrator", kind="ai_memory")

    def tool(name, pos):
        t = TOOLS[name]
        tool_node(f, t, pos, INPUTS)
        node = f.nodes[-1]
        node["parameters"]["workflowInputs"]["value"].update(FIXED)
        node["parameters"]["workflowInputs"]["value"]["agent"] = OWNER[name]
        return name

    for i, (name, desc, iters) in enumerate(SPECIALISTS):
        x = 900 + i * 260
        f.node(name, "@n8n/n8n-nodes-langchain.agentTool", 3, (x, 100), {
            "toolDescription": desc,
            "text": "={{ $fromAI('task', 'Самодостаточная задача для агента: что спросил или написал клиент и всё, что о нём известно', 'string') }}",
            "options": {"systemMessage": "={{ $('Prompts').first().json.%s }}" % name, "maxIterations": iters}})
        f.connect(name, "Orchestrator", kind="ai_tool")
        f.connect(model, name, kind="ai_languageModel")
    tool("save_email_triage", (900, 320))
    f.connect("save_email_triage", "email_triage_agent", kind="ai_tool")
    tool("save_lead", (1160, 320))
    f.connect("save_lead", "leads_agent", kind="ai_tool")
    tool("search_knowledge", (1380, 320))
    f.connect("search_knowledge", "support_agent", kind="ai_tool")
    tool("create_ticket", (1520, 320))
    f.connect("create_ticket", "support_agent", kind="ai_tool")
    tool("get_metrics", (1680, 320))
    f.connect("get_metrics", "reports_agent", kind="ai_tool")
    tool("handoff_to_human", (760, 320))
    f.connect("handoff_to_human", "Orchestrator", kind="ai_tool")

    f.code("Guard Out", (1960, -220), code("guard_out"))
    f.connect("Orchestrator", "Guard Out")
    f.code("Canned", (480, 160), code("canned"))
    f.connect("Route", "Canned", 1)
    f.if_("Alert Team?", (2180, 0), "={{ Boolean($json.alert_html) }}")
    f.connect("Guard Out", "Alert Team?")
    f.connect("Canned", "Alert Team?")
    f.telegram("Team Alert", (2400, -100), "={{ $('Config').first().json.config.team_chat_id }}", "={{ $json.alert_html }}")
    f.connect("Alert Team?", "Team Alert", 0)
    f.code("Log Row", (2620, 0), code("log_row"))
    f.connect("Team Alert", "Log Row")
    f.connect("Alert Team?", "Log Row", 1)
    f.http("Log", (2840, 0), "POST", f"={SHEETS}/{{{{ $('Config').first().json.config.spreadsheet_id }}}}/values/Log!A1:append",
           body="={{ JSON.stringify({ values: [$json.row] }) }}", cred="googleSheetsOAuth2Api",
           query=[("valueInputOption", "RAW"), ("insertDataOption", "INSERT_ROWS")], on_error="continueRegularOutput")
    f.connect("Log Row", "Log")
    f.switch("Reply Channel", (3060, 0), "={{ $('Log Row').first().json.channel }}", ["web", "team", "telegram"], fallback=False)
    f.connect("Log", "Reply Channel")
    f.node("Respond", "n8n-nodes-base.respondToWebhook", 1.1, (3280, -100), {
        "respondWith": "json", "responseBody": "={{ $('Log Row').first().json.response }}", "options": {}})
    f.connect("Reply Channel", "Respond", 0)
    f.connect("Reply Channel", "Respond", 1)
    f.telegram("Send Reply", (3280, 100), "={{ $('Log Row').first().json.customer.chat_id }}", "={{ $('Log Row').first().json.reply_html }}")
    f.connect("Reply Channel", "Send Reply", 2)
    f.node("Respond 401", "n8n-nodes-base.respondToWebhook", 1.1, (480, 360), {
        "respondWith": "json", "responseBody": '={{ { "error": "unauthorized" } }}', "options": {"responseCode": 401}})
    f.connect("Route", "Respond 401", 2)
    f.node("Respond 400", "n8n-nodes-base.respondToWebhook", 1.1, (480, 520), {
        "respondWith": "json", "responseBody": '={{ { "error": $json.error } }}', "options": {"responseCode": 400}})
    f.connect("Route", "Respond 400", 3)

    # ---- tools ----
    y = 1100
    cfg = "$('Config').first().json.config"
    sheet = lambda rng: f"={SHEETS}/{{{{ {cfg}.spreadsheet_id }}}}/values/{rng}"
    append_q = [("valueInputOption", "RAW"), ("insertDataOption", "INSERT_ROWS")]
    order = ["search_knowledge", "create_ticket", "save_lead", "save_email_triage", "get_metrics", "handoff_to_human"]
    f.switch("Tool Switch", (40, y), "={{ $json.input.tool }}", order)
    f.connect("Kind", "Tool Switch", 1)

    f.http("Read Knowledge", (280, y - 300), "GET", sheet("Knowledge!A1:E1000"), cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.code("Rank Articles", (500, y - 300), code("kb_rank"))
    f.chain("Read Knowledge", "Rank Articles")
    f.connect("Tool Switch", "Read Knowledge", 0)

    f.code("Ticket Row", (280, y - 180), code("ticket_row"))
    f.http("Append Ticket", (500, y - 180), "POST", sheet("Tickets!A1:append"), body="={{ JSON.stringify({ values: [$json.row] }) }}",
           cred="googleSheetsOAuth2Api", query=append_q, on_error="continueRegularOutput")
    f.code("Ticket Result", (720, y - 180), code("ticket_result"))
    f.chain("Ticket Row", "Append Ticket", "Ticket Result")
    f.connect("Tool Switch", "Ticket Row", 1)

    f.http("Read Leads", (280, y - 60), "GET", sheet("Leads!A1:O5000"), cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.code("Lead Row", (500, y - 60), code("lead_row"))
    f.http("Append Lead", (720, y - 60), "POST", sheet("Leads!A1:append"), body="={{ JSON.stringify({ values: [$json.row] }) }}",
           cred="googleSheetsOAuth2Api", query=append_q, on_error="continueRegularOutput")
    f.if_("Hot Lead?", (940, y - 60), "={{ Boolean($('Lead Row').first().json.alert_html) && !$json.error }}")
    f.telegram("Lead Alert", (1160, y - 120), f"={{{{ {cfg}.team_chat_id }}}}", "={{ $('Lead Row').first().json.alert_html }}")
    f.code("Lead Result", (1380, y - 60), code("lead_result"))
    f.chain("Read Leads", "Lead Row", "Append Lead", "Hot Lead?")
    f.connect("Hot Lead?", "Lead Alert", 0)
    f.connect("Lead Alert", "Lead Result")
    f.connect("Hot Lead?", "Lead Result", 1)
    f.connect("Tool Switch", "Read Leads", 2)

    f.code("Email Row", (280, y + 60), code("email_row"))
    f.http("Append Email", (500, y + 60), "POST", sheet("Inbox!A1:append"), body="={{ JSON.stringify({ values: [$json.row] }) }}",
           cred="googleSheetsOAuth2Api", query=append_q, on_error="continueRegularOutput")
    f.if_("Important Email?", (720, y + 60), "={{ Boolean($('Email Row').first().json.alert_html) }}")
    f.telegram("Email Alert", (940, y), f"={{{{ {cfg}.team_chat_id }}}}", "={{ $('Email Row').first().json.alert_html }}")
    f.code("Email Result", (1160, y + 60), code("email_result"))
    f.chain("Email Row", "Append Email", "Important Email?")
    f.connect("Important Email?", "Email Alert", 0)
    f.connect("Email Alert", "Email Result")
    f.connect("Important Email?", "Email Result", 1)
    f.connect("Tool Switch", "Email Row", 3)

    f.http("Read Journals", (280, y + 180), "GET",
           f"={SHEETS}/{{{{ {cfg}.spreadsheet_id }}}}/values:batchGet?ranges=Log!A1:I20000&ranges=Leads!A1:O5000&ranges=Tickets!A1:J5000&ranges=Inbox!A1:I5000",
           cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.code("Metrics", (500, y + 180), code("metrics"))
    f.chain("Read Journals", "Metrics")
    f.connect("Tool Switch", "Read Journals", 4)

    f.code("Handoff Alert", (280, y + 300), code("handoff_alert"))
    f.telegram("Notify Team", (500, y + 300), f"={{{{ {cfg}.team_chat_id }}}}", "={{ $json.alert_html }}")
    f.code("Handoff Result", (720, y + 300), code("handoff_result"))
    f.chain("Handoff Alert", "Notify Team", "Handoff Result")
    f.connect("Tool Switch", "Handoff Alert", 5)

    f.code("Unknown Tool", (280, y + 420), code("unknown_tool"))
    f.connect("Tool Switch", "Unknown Tool", 6)

    f.if_("Service Error?", (1600, y), "={{ Boolean($json.service_error) }}")
    for r in ("Rank Articles", "Ticket Result", "Lead Result", "Email Result", "Metrics", "Unknown Tool"):
        f.connect(r, "Service Error?")
    f.code("Tool Alert", (1820, y - 80), code("tool_alert"))
    f.telegram("Tool Error Alert", (2040, y - 80), f"={{{{ {cfg}.team_chat_id }}}}", "={{ $json.alert_html }}")
    f.code("Tool Return", (2260, y), code("tool_return"))
    f.connect("Service Error?", "Tool Alert", 0)
    f.chain("Tool Alert", "Tool Error Alert", "Tool Return")
    f.connect("Service Error?", "Tool Return", 1)
    f.connect("Handoff Result", "Tool Return")

    wf = f.render({"timezone": "Europe/Kyiv"})
    placeholders_only(wf)
    return wf


def error_flow():
    f = Flow("Multi-Agent Ops Team — Error Alert", SLUG)
    f.sticky("About", (-40, -260), (
        "## Сигнал об ошибке\nЕсли воркфлоу команды агентов упал, команда узнает в Telegram.\n\n"
        "Вставьте ID чата в узел **Alert** и выберите этот воркфлоу как Error Workflow "
        "в настройках обоих вариантов (Settings → Error workflow)."), w=460, h=220, color=5)
    f.node("Error Trigger", "n8n-nodes-base.errorTrigger", 1, (0, 0), {})
    f.code("Message", (220, 0), (
        "const e = $input.first().json;\n"
        "const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\n"
        "const text = [\n"
        "  '<b>⚠️ Ошибка в команде агентов</b>',\n"
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
    by_agent = {}
    for name, t in TOOLS.items():
        by_agent.setdefault(OWNER[name], []).append(t)
    agent_tools = [Tool(a, d, [("task", "string", "Самодостаточная задача для агента: что спросил или написал клиент и всё, что о нём известно")])
                   for a, d, _ in SPECIALISTS]
    write_json(OUT / "agent" / "tools.openai.json", {
        "orchestrator": [t.openai() for t in agent_tools + by_agent["orchestrator"]],
        **{a: [t.openai() for t in by_agent.get(a, [])] for a in AGENTS}})
    write_json(OUT / "agent" / "tools.anthropic.json", {
        "orchestrator": [t.anthropic() for t in agent_tools + by_agent["orchestrator"]],
        **{a: [t.anthropic() for t in by_agent.get(a, [])] for a in AGENTS}})


if __name__ == "__main__":
    for provider, name in (("openai", SLUG), ("anthropic", f"{SLUG}-claude")):
        wf = build(provider)
        no_secrets(json.dumps(wf))
        write_json(OUT / "workflows" / f"{name}.n8n.json", wf)
        print(name, "nodes:", len(wf["nodes"]))
    write_json(OUT / "workflows" / "error-alert.n8n.json", error_flow())
    schemas()
