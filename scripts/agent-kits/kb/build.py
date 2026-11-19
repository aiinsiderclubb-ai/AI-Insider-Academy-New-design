"""Builds content/products/knowledge-base-agent from js/ and the prompt."""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import nk  # noqa: E402
from nk import PRODUCTS, SHEETS, Flow, Tool, stable_id, tool_node, write_json, placeholders_only, no_secrets  # noqa: E402

# Drive is not among the shared builder's credential types; add it here instead of editing nk.py.
nk.CRED_NAMES.setdefault("googleDriveOAuth2Api", "Google Drive account")
nk.TEST_CREDS.setdefault("googleDriveOAuth2Api", "t-none")

SLUG = "knowledge-base-agent"
OUT = PRODUCTS / SLUG
DRIVE = "https://www.googleapis.com/drive/v3"
COMMON = (HERE.parent / "common" / "text.js").read_text(encoding="utf8")
LC = "@n8n/n8n-nodes-langchain."


def code(name):
    src = (HERE / "js" / f"{name}.js").read_text(encoding="utf8")
    return src.replace("// @include text.js\n", COMMON + "\n").strip() + "\n"


TOOLS = [
    Tool("search_documents",
         "Ищет по документам компании (регламенты, инструкции, политики, справка) и возвращает до пяти фрагментов "
         "с кодом документа для ссылки, например [d3], или found=false. Вызывай перед любым ответом по существу.",
         [("query", "string", "Что искать: ключевые слова на языке документов, например: отпуск перенос сроки заявления")]),
    Tool("list_documents",
         "Список документов в базе: код, название, дата изменения. Для вопросов «какие документы есть», «что ты знаешь».",
         []),
    Tool("handoff_to_human",
         "Передаёт вопрос людям и уведомляет команду в Telegram: ответа нет в документах, а вопрос важный; "
         "просят связаться с человеком; документы противоречат друг другу; личная ситуация или исключение из правил.",
         [("reason", "string", "Почему нужен человек, одной фразой"),
          ("summary", "string", "Суть вопроса и что уже нашлось в документах"),
          ("urgency", "string", "low, normal или high")]),
]

INPUTS = ["tool", "query", "reason", "summary", "urgency",
          "session_id", "channel", "customer_name", "customer_contact", "last_message",
          "source_kind", "source_id", "drive_id", "title", "url", "mime", "modified", "fetch"]
G = "$('Guard In').first().json"
FIXED = {
    "session_id": "={{ %s.session_id }}" % G,
    "channel": "={{ %s.channel }}" % G,
    "customer_name": "={{ %s.customer.name || '' }}" % G,
    "customer_contact": "={{ [%s.customer.email, %s.customer.phone, %s.customer.telegram].filter(Boolean).join(' · ') }}" % (G, G, G),
    "last_message": "={{ %s.text }}" % G,
}
CFG = "$('Config').first().json.config"


def prompt_expr(text):
    assert "{" not in re.sub(r"\{\{\w+\}\}", "", text), "stray brace in prompt"
    return "=" + re.sub(r"\{\{(\w+)\}\}", lambda m: "{{ %s.%s }}" % (CFG, m.group(1)), text)


def response_format(flow, fmt):
    flow.nodes[-1]["parameters"]["options"] = {"response": {"response": {"responseFormat": fmt, "outputPropertyName": "data"}}, "timeout": 30000}


def memory_key():
    return {"__rl": True, "mode": "id", "value": "={{ %s.index_key }}" % CFG}


def build():
    prompt = (OUT / "agent" / "system-prompt.md").read_text(encoding="utf8").strip()
    f = Flow("Knowledge Base Agent", SLUG)

    f.sticky("Read Me", (-700, -520), (
        "## Knowledge Base Agent\n"
        "Отвечает на вопросы по вашим документам (Google Drive и страницы по ссылкам) со ссылками на источники. "
        "Чего нет в документах — говорит прямо и записывает вопрос в лист Gaps.\n\n"
        "**Перед запуском:**\n"
        "1. **Config** — компания, ID папки Drive, ID таблицы, чат команды, `agent_token`, `allowed_telegram_ids`.\n"
        "2. Ключ OpenAI — в **OpenAI Chat Model** и **Embeddings** (эмбеддингам нужен OpenAI-совместимый ключ и с Claude).\n"
        "3. Google Drive — в **List Drive Files**, **Export Doc**, **Download PDF**, **Download Text**; Google Sheets — в узлах таблицы.\n"
        "4. Telegram — **Telegram Trigger**, **Team Alert**, **Notify Team**, **Notify Reindex**, **Send Reply**.\n"
        "5. Publish, затем запустите переиндексацию (QUICKSTART, шаг 6).\n\n"
        "Индекс хранится в памяти n8n (Simple Vector Store): после перезапуска n8n запустите переиндексацию — "
        "или перейдите на Qdrant / Supabase / PGVector (docs/05-production-store.md)."), w=560, h=470, color=5)

    # ---------- triggers ----------
    f.node("Webhook", "n8n-nodes-base.webhook", 2.1, (-640, 0), {
        "httpMethod": "POST", "path": "kb-agent", "responseMode": "responseNode", "options": {"allowedOrigins": "*"}},
        webhookId=stable_id(SLUG, "webhook"))
    f.node("Telegram Trigger", "n8n-nodes-base.telegramTrigger", 1.2, (-640, 160), {
        "updates": ["message"], "additionalFields": {}}, creds=["telegramApi"], webhookId=stable_id(SLUG, "telegram"))
    f.node("Tool Call", "n8n-nodes-base.executeWorkflowTrigger", 1.1, (-640, 320), {
        "inputSource": "workflowInputs", "workflowInputs": {"values": [{"name": n} for n in INPUTS]}})
    f.node("Every Night", "n8n-nodes-base.scheduleTrigger", 1.2, (-860, 480), {
        "rule": {"interval": [{"field": "days", "triggerAtHour": 3}]}})
    f.node("Reindex Webhook", "n8n-nodes-base.webhook", 2.1, (-860, 640), {
        "httpMethod": "POST", "path": "kb-reindex", "responseMode": "responseNode", "options": {}},
        webhookId=stable_id(SLUG, "reindex"))
    f.code("Mark Reindex", (-640, 560), code("mark_reindex"))
    f.connect("Every Night", "Mark Reindex")
    f.connect("Reindex Webhook", "Mark Reindex")
    f.code("Config", (-400, 240), code("config"))
    for t in ("Webhook", "Telegram Trigger", "Tool Call", "Mark Reindex"):
        f.connect(t, "Config")
    f.switch("Kind", (-180, 240),
             "={{ $json.input.op === 'reindex' ? 'reindex' : ($json.input.tool ? 'tool' : 'chat') }}",
             ["chat", "tool", "reindex"], fallback=False)
    f.connect("Config", "Kind")

    # ---------- chat ----------
    f.code("Guard In", (40, 0), code("guard_in"))
    f.connect("Kind", "Guard In", 0)
    f.switch("Route", (260, 0), "={{ $json.route }}", ["agent", "canned", "deny", "bad"], fallback=False)
    f.connect("Guard In", "Route")
    f.node("AI Agent", LC + "agent", 3.1, (540, -220), {
        "promptType": "define", "text": "={{ $json.agent_input }}",
        "options": {"systemMessage": prompt_expr(prompt), "maxIterations": 8, "returnIntermediateSteps": True}},
        onError="continueRegularOutput")
    f.connect("Route", "AI Agent", 0)
    f.node("OpenAI Chat Model", LC + "lmChatOpenAi", 1.3, (380, 40), {
        "model": {"__rl": True, "mode": "list", "value": "gpt-5-mini", "cachedResultName": "gpt-5-mini"},
        "builtInTools": {}, "responsesApiEnabled": False, "options": {}}, creds=["openAiApi"])
    f.node("Anthropic Chat Model", LC + "lmChatAnthropic", 1.6, (380, 240), {
        "model": {"__rl": True, "mode": "id", "value": "claude-haiku-5-5"}, "options": {}}, creds=["anthropicApi"])
    f.connect("OpenAI Chat Model", "AI Agent", kind="ai_languageModel")
    f.node("Memory", LC + "memoryBufferWindow", 1.3, (540, 40), {
        "sessionIdType": "customKey", "sessionKey": "={{ $('Guard In').first().json.session_id }}", "contextWindowLength": 10})
    f.connect("Memory", "AI Agent", kind="ai_memory")
    for i, t in enumerate(TOOLS):
        tool_node(f, t, (700 + i * 150, 40), INPUTS)
        for k, v in FIXED.items():
            f.nodes[-1]["parameters"]["workflowInputs"]["value"][k] = v
        f.connect(t.name, "AI Agent", kind="ai_tool")
    f.sticky("Model Note", (300, 380), (
        "**Модель.** Подключена OpenAI (подходит любой OpenAI-совместимый API). Для Claude протяните связь от "
        "**Anthropic Chat Model** к агенту вместо OpenAI. Эмбеддинги при этом остаются на OpenAI-совместимом ключе — "
        "docs/06-models.md."), w=400, h=170, color=7)

    f.code("Guard Out", (960, -220), code("guard_out"))
    f.connect("AI Agent", "Guard Out")
    f.code("Canned", (540, 200), code("canned"))
    f.connect("Route", "Canned", 1)
    f.if_("Alert Team?", (1180, 0), "={{ Boolean($json.alert_html) }}")
    f.connect("Guard Out", "Alert Team?")
    f.connect("Canned", "Alert Team?")
    f.telegram("Team Alert", (1400, -100), "={{ %s.team_chat_id }}" % CFG, "={{ $json.alert_html }}")
    f.connect("Alert Team?", "Team Alert", 0)
    f.code("Log Row", (1620, 0), code("log_row"))
    f.connect("Team Alert", "Log Row")
    f.connect("Alert Team?", "Log Row", 1)
    f.http("Log", (1840, 0), "POST", f"={SHEETS}/{{{{ {CFG}.spreadsheet_id }}}}/values/Log!A1:append",
           body="={{ JSON.stringify({ values: [$json.row] }) }}", cred="googleSheetsOAuth2Api",
           query=[("valueInputOption", "RAW"), ("insertDataOption", "INSERT_ROWS")], on_error="continueRegularOutput")
    f.connect("Log Row", "Log")
    f.if_("Gap?", (2060, 0), "={{ Boolean($('Log Row').first().json.gap) }}")
    f.connect("Log", "Gap?")
    f.http("Append Gap", (2280, -100), "POST", f"={SHEETS}/{{{{ {CFG}.spreadsheet_id }}}}/values/Gaps!A1:append",
           body="={{ JSON.stringify({ values: [$('Log Row').first().json.gap] }) }}", cred="googleSheetsOAuth2Api",
           query=[("valueInputOption", "RAW"), ("insertDataOption", "INSERT_ROWS")], on_error="continueRegularOutput")
    f.connect("Gap?", "Append Gap", 0)
    f.switch("Reply Channel", (2500, 0), "={{ $('Log Row').first().json.channel }}", ["web", "telegram"], fallback=False)
    f.connect("Append Gap", "Reply Channel")
    f.connect("Gap?", "Reply Channel", 1)
    f.node("Respond", "n8n-nodes-base.respondToWebhook", 1.1, (2720, -100), {
        "respondWith": "json", "responseBody": "={{ $('Log Row').first().json.response }}", "options": {}})
    f.connect("Reply Channel", "Respond", 0)
    f.telegram("Send Reply", (2720, 100), "={{ $('Log Row').first().json.customer.chat_id }}",
               "={{ $('Log Row').first().json.reply_html }}")
    f.connect("Reply Channel", "Send Reply", 1)
    f.node("Respond 401", "n8n-nodes-base.respondToWebhook", 1.1, (540, 360), {
        "respondWith": "json", "responseBody": '={{ { "error": "unauthorized" } }}', "options": {"responseCode": 401}})
    f.connect("Route", "Respond 401", 2)
    f.node("Respond 400", "n8n-nodes-base.respondToWebhook", 1.1, (540, 520), {
        "respondWith": "json", "responseBody": '={{ { "error": $json.error } }}', "options": {"responseCode": 400}})
    f.connect("Route", "Respond 400", 3)

    # ---------- tools ----------
    y = 820
    f.sticky("Tools Note", (-700, y - 40), (
        "### Ветка инструментов\nАгент и переиндексация вызывают этот же воркфлоу (`$workflow.id`): вызов приходит в "
        "**Tool Call**. `search_documents`, `list_documents`, `handoff_to_human` — инструменты агента; "
        "`extract_document` — чтение одного документа при переиндексации."), w=520, h=200, color=4)
    f.switch("Tool Switch", (40, y), "={{ $json.input.tool }}", [t.name for t in TOOLS] + ["extract_document"])
    f.connect("Kind", "Tool Switch", 1)

    f.node("Search Index", LC + "vectorStoreInMemory", 1.3, (300, y - 160), {
        "mode": "load", "memoryKey": memory_key(), "prompt": "={{ $json.input.query }}",
        "topK": "={{ %s.search_top_k }}" % CFG, "includeDocumentMetadata": True}, alwaysOutputData=True)
    f.code("Rank Passages", (540, y - 160), code("rank_passages"))
    f.connect("Tool Switch", "Search Index", 0)
    f.connect("Search Index", "Rank Passages")

    f.http("Read Documents", (300, y), "GET", f"={SHEETS}/{{{{ {CFG}.spreadsheet_id }}}}/values/Documents!A1:I2000",
           cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.code("List Docs", (540, y), code("list_docs"))
    f.chain("Read Documents", "List Docs")
    f.connect("Tool Switch", "Read Documents", 1)

    f.code("Handoff Alert", (300, y + 140), code("handoff_alert"))
    f.telegram("Notify Team", (540, y + 140), "={{ %s.team_chat_id }}" % CFG, "={{ $json.alert_html }}")
    f.code("Handoff Result", (760, y + 140), code("handoff_result"))
    f.chain("Handoff Alert", "Notify Team", "Handoff Result")
    f.connect("Tool Switch", "Handoff Alert", 2)

    # extract one document (called once per source during reindex)
    f.switch("Fetch By Type", (300, y + 320), "={{ $json.input.fetch }}", ["gdoc", "pdf", "text", "url"], fallback=False)
    f.connect("Tool Switch", "Fetch By Type", 3)
    inp = "$('Config').first().json.input"
    f.http("Export Doc", (540, y + 260), "GET", "=%s/files/{{ %s.drive_id }}/export" % (DRIVE, inp),
           cred="googleDriveOAuth2Api", query=[("mimeType", "text/plain")], on_error="continueRegularOutput")
    response_format(f, "text")
    f.http("Download PDF", (540, y + 380), "GET", "=%s/files/{{ %s.drive_id }}" % (DRIVE, inp),
           cred="googleDriveOAuth2Api", query=[("alt", "media")], on_error="continueRegularOutput")
    response_format(f, "file")
    f.node("Read PDF", "n8n-nodes-base.extractFromFile", 1.1, (760, y + 380), {
        "operation": "pdf", "binaryPropertyName": "data", "options": {"joinPages": True}}, onError="continueRegularOutput")
    f.http("Download Text", (540, y + 500), "GET", "=%s/files/{{ %s.drive_id }}" % (DRIVE, inp),
           cred="googleDriveOAuth2Api", query=[("alt", "media"), ("supportsAllDrives", "true")], on_error="continueRegularOutput")
    response_format(f, "text")
    f.http("Fetch Page", (540, y + 620), "GET", "={{ %s.url }}" % inp,
           headers=[("User-Agent", "Mozilla/5.0 (compatible; KnowledgeBaseAgent/1.0)")], on_error="continueRegularOutput")
    response_format(f, "text")
    f.code("Doc Text", (980, y + 440), code("doc_text"))
    f.connect("Fetch By Type", "Export Doc", 0)
    f.connect("Fetch By Type", "Download PDF", 1)
    f.connect("Fetch By Type", "Download Text", 2)
    f.connect("Fetch By Type", "Fetch Page", 3)
    f.connect("Download PDF", "Read PDF")
    for n in ("Export Doc", "Read PDF", "Download Text", "Fetch Page"):
        f.connect(n, "Doc Text")
    f.code("Unknown Tool", (300, y + 760), code("unknown_tool"))
    f.connect("Tool Switch", "Unknown Tool", 4)

    # ---------- reindex ----------
    y = 1700
    f.sticky("Reindex Note", (-700, y - 60), (
        "### Переиндексация\nКаждую ночь в 3:00 и по запросу на `/webhook/kb-reindex` (с `x-agent-token`). "
        "Читает папку Drive и лист Sources, извлекает текст каждого документа, режет на фрагменты, считает эмбеддинги "
        "и **заменяет** индекс целиком. Если папка не читается или не прочитан ни один документ — старый индекс "
        "остаётся. Итог — в чат команды и в лист Documents."), w=520, h=230, color=4)
    f.code("Reindex Gate", (40, y), code("reindex_gate"))
    f.connect("Kind", "Reindex Gate", 2)
    f.if_("Allowed?", (260, y), "={{ $json.allowed }}")
    f.connect("Reindex Gate", "Allowed?")
    f.node("Respond Reindex 401", "n8n-nodes-base.respondToWebhook", 1.1, (480, y + 140), {
        "respondWith": "json", "responseBody": '={{ { "error": "unauthorized" } }}', "options": {"responseCode": 401}})
    f.connect("Allowed?", "Respond Reindex 401", 1)
    f.if_("From Webhook?", (480, y - 40), "={{ $json.via }}", op="equals", right="webhook", type_="string")
    f.connect("Allowed?", "From Webhook?", 0)
    f.node("Respond Started", "n8n-nodes-base.respondToWebhook", 1.1, (700, y - 140), {
        "respondWith": "json",
        "responseBody": '={{ { "status": "started", "note": "Итог придёт в чат команды" } }}',
        "options": {"responseCode": 202}})
    f.connect("From Webhook?", "Respond Started", 0)
    f.http("List Drive Files", (920, y - 40), "GET", f"{DRIVE}/files", cred="googleDriveOAuth2Api", query=[
        ("q", "='{{ %s.drive_folder_id }}' in parents and trashed = false" % CFG),
        ("fields", "files(id,name,mimeType,modifiedTime,webViewLink)"),
        ("pageSize", "1000"), ("supportsAllDrives", "true"), ("includeItemsFromAllDrives", "true")],
        on_error="continueRegularOutput")
    f.connect("Respond Started", "List Drive Files")
    f.connect("From Webhook?", "List Drive Files", 1)
    f.http("Read Sources", (1140, y - 40), "GET", f"={SHEETS}/{{{{ {CFG}.spreadsheet_id }}}}/values/Sources!A1:C1000",
           cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.http("Read Registry", (1360, y - 40), "GET", f"={SHEETS}/{{{{ {CFG}.spreadsheet_id }}}}/values/Documents!A1:I2000",
           cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")
    f.code("Plan Sources", (1580, y - 40), code("plan_sources"))
    f.chain("List Drive Files", "Read Sources", "Read Registry", "Plan Sources")
    f.if_("Anything to Read?", (1800, y - 40), "={{ !$json.abort && !$json.empty }}")
    f.connect("Plan Sources", "Anything to Read?")
    value = {n: "" for n in INPUTS}
    for k in ("tool", "source_kind", "source_id", "drive_id", "title", "url", "mime", "modified", "fetch"):
        value[k] = "={{ $json.%s }}" % k
    schema = [{"id": n, "displayName": n, "required": False, "defaultMatch": False, "display": True,
               "canBeUsedToMatch": True, "type": "string", "removed": False} for n in INPUTS]
    f.node("Extract Documents", "n8n-nodes-base.executeWorkflow", 1.2, (2020, y - 120), {
        "workflowId": {"__rl": True, "mode": "id", "value": "={{ $workflow.id }}"},
        "workflowInputs": {"mappingMode": "defineBelow", "value": value, "matchingColumns": [], "schema": schema,
                           "attemptToConvertTypes": False, "convertFieldsToString": True},
        "mode": "each", "options": {"waitForSubWorkflow": True}}, onError="continueRegularOutput")
    f.connect("Anything to Read?", "Extract Documents", 0)
    f.code("Build Docs", (2240, y - 40), code("build_docs"))
    f.connect("Extract Documents", "Build Docs")
    f.connect("Anything to Read?", "Build Docs", 1)
    f.if_("Abort?", (2460, y - 40), "={{ $json.abort === true }}")
    f.connect("Build Docs", "Abort?")

    f.node("Insert Index", LC + "vectorStoreInMemory", 1.3, (2680, y + 60), {
        "mode": "insert", "memoryKey": memory_key(), "clearStore": True, "embeddingBatchSize": 100})
    f.connect("Abort?", "Insert Index", 1)
    f.node("Document Loader", LC + "documentDefaultDataLoader", 1.1, (2680, y + 260), {
        "dataType": "json", "jsonMode": "expressionData", "jsonData": "={{ $json.text }}",
        "textSplittingMode": "custom",
        "options": {"metadata": {"metadataValues": [
            {"name": k, "value": "={{ $json.%s }}" % k} for k in ("code", "title", "url", "source_id", "modified", "tombstone")]}}})
    f.node("Text Splitter", LC + "textSplitterRecursiveCharacterTextSplitter", 1, (2680, y + 420), {
        "chunkSize": "={{ %s.chunk_size }}" % CFG, "chunkOverlap": "={{ %s.chunk_overlap }}" % CFG, "options": {}})
    f.node("Embeddings", LC + "embeddingsOpenAi", 1.2, (2460, y + 260), {
        "model": "text-embedding-3-small", "options": {}}, creds=["openAiApi"])
    f.connect("Document Loader", "Insert Index", kind="ai_document")
    f.connect("Text Splitter", "Document Loader", kind="ai_textSplitter")
    f.connect("Embeddings", "Insert Index", kind="ai_embedding")
    f.connect("Embeddings", "Search Index", kind="ai_embedding")

    f.code("Registry", (2900, y + 60), code("registry"))
    f.connect("Insert Index", "Registry")
    f.http("Write Registry", (3120, y + 60), "PUT", f"={SHEETS}/{{{{ {CFG}.spreadsheet_id }}}}/values/Documents!A1",
           body="={{ JSON.stringify({ values: $json.rows }) }}", cred="googleSheetsOAuth2Api",
           query=[("valueInputOption", "RAW")], on_error="continueRegularOutput")
    f.connect("Registry", "Write Registry")
    f.code("Reindex Report", (3340, y - 40), code("reindex_report"))
    f.connect("Write Registry", "Reindex Report")
    f.connect("Abort?", "Reindex Report", 0)
    f.telegram("Notify Reindex", (3560, y - 40), "={{ %s.team_chat_id }}" % CFG, "={{ $json.text }}")
    f.connect("Reindex Report", "Notify Reindex")

    wf = f.render()
    placeholders_only(wf)
    return wf


def error_flow():
    f = Flow("Knowledge Base Agent — Error Alert", SLUG)
    f.sticky("About", (-40, -260), (
        "## Сигнал об ошибке\nЕсли агент или переиндексация упали, команда узнает в Telegram.\n\n"
        "Вставьте ID чата в узел **Alert** и выберите этот воркфлоу как Error Workflow в настройках агента."),
        w=460, h=200, color=5)
    f.node("Error Trigger", "n8n-nodes-base.errorTrigger", 1, (0, 0), {})
    f.code("Message", (220, 0), (
        "const e = $input.first().json;\n"
        "const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\n"
        "const text = [\n"
        "  '<b>⚠️ Ошибка в агенте базы знаний</b>',\n"
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
    write_json(OUT / "workflows" / f"{SLUG}.n8n.json", wf)
    write_json(OUT / "workflows" / "error-alert.n8n.json", error_flow())
    write_json(OUT / "agent" / "tools.openai.json", [t.openai() for t in TOOLS])
    write_json(OUT / "agent" / "tools.anthropic.json", [t.anthropic() for t in TOOLS])
    no_secrets(json.dumps(wf))
    print("nodes:", len(wf["nodes"]))
