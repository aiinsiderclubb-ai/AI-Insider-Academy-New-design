"""Builds content/products/revenue-recovery-agent."""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from nk import CRED_NAMES, PRODUCTS, SHEETS, Flow, stable_id, write_json, placeholders_only, no_secrets  # noqa: E402

SLUG = "revenue-recovery-agent"
OUT = PRODUCTS / SLUG
CRED_NAMES.setdefault("smtp", "SMTP account")
INCLUDES = {
    "text.js": (HERE.parent / "common" / "text.js").read_text(encoding="utf8"),
    "inv.js": (HERE / "js" / "inv.js").read_text(encoding="utf8"),
}
CFG = "$('Config').first().json.config"


def code(name, **repl):
    src = (HERE / "js" / f"{name}.js").read_text(encoding="utf8")
    for inc, body in INCLUDES.items():
        src = src.replace(f"// @include {inc}\n", body + "\n")
    for a, b in repl.items():
        src = src.replace(a, b)
    return src.strip() + "\n"


def prompt_expr(text):
    assert "{" not in re.sub(r"\{\{\w+\}\}", "", text), "stray brace in prompt"
    return "=" + re.sub(r"\{\{(\w+)\}\}", lambda m: "{{ %s.%s }}" % (CFG, m.group(1)), text)


def batch_get(f, name, pos, ranges):
    qs = "&".join("ranges=" + r for r in ranges)  # n8n keeps only the last of repeated query parameters
    n = f.http(name, pos, "GET", f"={SHEETS}/{{{{ {CFG}.spreadsheet_id }}}}/values:batchGet?{qs}", cred="googleSheetsOAuth2Api")
    f.nodes[-1]["executeOnce"] = True
    return n


def build():
    prompt = (OUT / "agent" / "draft-prompt.md").read_text(encoding="utf8").strip()
    f = Flow("Revenue Recovery Agent", SLUG)
    f.sticky("Read Me", (-760, -520), (
        "## Revenue Recovery Agent\n"
        "1. **Каждое утро** — счета из листа Invoices: кому пора напомнить, риск по правилам и по оценке модели, черновик письма.\n"
        "2. **Черновик приходит в Telegram** с кнопками «Отправить», «Изменить», «Пропустить». Без нажатия ничего не уходит.\n"
        "3. **Команды** /paid, /promise, /dispute, /pause, /resume, /status — останавливают и возобновляют напоминания.\n"
        "4. **По понедельникам** — отчёт: просрочка, что вернулось, что ждёт решения.\n\n"
        "**Перед запуском:** узел **Config**, ключи (Google Sheets, Telegram, SMTP, модель), Publish. Подробно — QUICKSTART.md."),
        w=620, h=400, color=5)

    f.node("Every Day 9:00", "n8n-nodes-base.scheduleTrigger", 1.2, (-900, 0), {"rule": {"interval": [{"field": "days", "triggerAtHour": 9}]}})
    f.code("Monitor Tick", (-700, 0), "return [{ json: { job: 'monitor' } }];\n")
    f.connect("Every Day 9:00", "Monitor Tick")
    f.node("Every Monday 9:30", "n8n-nodes-base.scheduleTrigger", 1.2, (-900, 160), {
        "rule": {"interval": [{"field": "weeks", "triggerAtDay": [1], "triggerAtHour": 9, "triggerAtMinute": 30}]}})
    f.code("Report Tick", (-700, 160), "return [{ json: { job: 'report' } }];\n")
    f.connect("Every Monday 9:30", "Report Tick")
    f.node("Telegram Trigger", "n8n-nodes-base.telegramTrigger", 1.2, (-700, 320), {
        "updates": ["message", "callback_query"], "additionalFields": {}}, creds=["telegramApi"], webhookId=stable_id(SLUG, "telegram"))
    f.node("Preview Webhook", "n8n-nodes-base.webhook", 2.1, (-700, 480), {
        "httpMethod": "POST", "path": "recovery-preview", "responseMode": "responseNode", "options": {}}, webhookId=stable_id(SLUG, "preview"))
    f.code("Config", (-460, 240), code("config"))
    for t in ("Monitor Tick", "Report Tick", "Telegram Trigger", "Preview Webhook"):
        f.connect(t, "Config")
    kind = ("={{ $json.input.job ? $json.input.job : $json.input.update_id !== undefined ? 'telegram' : "
            "String($json.input.webhookUrl || '').includes('recovery-preview') ? 'preview' : 'none' }}")
    f.switch("Kind", (-240, 240), kind, ["monitor", "telegram", "report", "preview"], fallback=False)
    f.connect("Config", "Kind")

    # ---------- monitor + preview ----------
    X, Y = 0, -100
    batch_get(f, "Read Invoices", (X, Y), ["Invoices!A1:P5000", "Drafts!A1:M20000"])
    f.connect("Kind", "Read Invoices", 0)
    f.code("Plan Invoices", (X + 220, Y), code("plan_invoices"))
    f.connect("Read Invoices", "Plan Invoices")
    f.code("Preview Plan", (X, Y + 260), code("preview_plan"))
    f.connect("Kind", "Preview Plan", 3)
    f.switch("Preview Route", (X + 220, Y + 260), "={{ $json.route }}", ["ok", "deny", "bad"], fallback=False)
    f.connect("Preview Plan", "Preview Route")
    f.node("Assess & Draft", "@n8n/n8n-nodes-langchain.chainLlm", 1.9, (X + 480, Y), {
        "promptType": "define", "text": "={{ $json.facts }}",
        "messages": {"messageValues": [{"message": prompt_expr(prompt)}]}}, onError="continueRegularOutput")
    f.connect("Plan Invoices", "Assess & Draft")
    f.connect("Preview Route", "Assess & Draft", 0)
    f.node("OpenAI Chat Model", "@n8n/n8n-nodes-langchain.lmChatOpenAi", 1.3, (X + 400, Y + 180), {
        "model": {"__rl": True, "mode": "list", "value": "gpt-5-mini", "cachedResultName": "gpt-5-mini"},
        "builtInTools": {}, "responsesApiEnabled": False, "options": {}}, creds=["openAiApi"])
    f.node("Anthropic Chat Model", "@n8n/n8n-nodes-langchain.lmChatAnthropic", 1.6, (X + 560, Y + 180), {
        "model": {"__rl": True, "mode": "id", "value": "claude-sonnet-5-5"}, "options": {}}, creds=["anthropicApi"])
    f.connect("OpenAI Chat Model", "Assess & Draft", kind="ai_languageModel")
    f.sticky("Model Note", (X + 380, Y + 340), (
        "**Модель.** Подключена OpenAI (или OpenAI-совместимый API через Base URL). Для Claude протяните связь от "
        "**Anthropic Chat Model** к входу Model цепочки вместо OpenAI — docs/06-models.md."), w=360, h=150, color=7)
    f.code("Check Draft", (X + 740, Y), code("check_draft"))
    f.connect("Assess & Draft", "Check Draft")
    f.switch("Mode", (X + 960, Y), "={{ $json.mode }}", ["monitor", "preview"], fallback=False)
    f.connect("Check Draft", "Mode")
    f.code("Draft Rows", (X + 1180, Y - 80), code("draft_rows"))
    f.connect("Mode", "Draft Rows", 0)
    f.http("Append Drafts", (X + 1400, Y - 80), "POST", f"={SHEETS}/{{{{ {CFG}.spreadsheet_id }}}}/values/Drafts!A1:append",
           body="={{ JSON.stringify({ values: $json.rows }) }}", cred="googleSheetsOAuth2Api",
           query=[("valueInputOption", "RAW"), ("insertDataOption", "INSERT_ROWS")])
    f.connect("Draft Rows", "Append Drafts")
    f.code("Cards", (X + 1620, Y - 80), code("cards"))
    f.connect("Append Drafts", "Cards")
    f.node("Approval Card", "n8n-nodes-base.telegram", 1.2, (X + 1840, Y - 80), {
        "chatId": "={{ $json.chat_id }}", "text": "={{ $json.text }}", "replyMarkup": "inlineKeyboard",
        "inlineKeyboard": {"rows": [{"row": {"buttons": [
            {"text": "✅ Отправить", "additionalFields": {"callback_data": "=send:{{ $json.draft_id }}"}},
            {"text": "✏️ Изменить", "additionalFields": {"callback_data": "=edit:{{ $json.draft_id }}"}},
            {"text": "⏭ Пропустить", "additionalFields": {"callback_data": "=skip:{{ $json.draft_id }}"}}]}}]},
        "additionalFields": {"appendAttribution": False, "parse_mode": "HTML", "disable_web_page_preview": True}}, creds=["telegramApi"])
    f.connect("Cards", "Approval Card")
    f.node("Respond Preview", "n8n-nodes-base.respondToWebhook", 1.1, (X + 1180, Y + 120), {
        "respondWith": "json", "options": {},
        "responseBody": "={{ { invoice_id: $json.invoice_id, stop: $json.stop, step: $json.step, tone: $json.tone, risk: $json.risk, "
                        "rule_risk: $json.rule_risk, reasons: $json.reasons, subject: $json.subject, body: $json.body, flags: $json.flags } }}"})
    f.connect("Mode", "Respond Preview", 1)
    f.node("Respond 401", "n8n-nodes-base.respondToWebhook", 1.1, (X + 480, Y + 400), {
        "respondWith": "json", "responseBody": '={{ { "error": "unauthorized" } }}', "options": {"responseCode": 401}})
    f.node("Respond 400", "n8n-nodes-base.respondToWebhook", 1.1, (X + 480, Y + 540), {
        "respondWith": "json", "responseBody": '={{ { "error": $json.error } }}', "options": {"responseCode": 400}})
    f.connect("Preview Route", "Respond 401", 1)
    f.connect("Preview Route", "Respond 400", 2)

    # ---------- telegram ----------
    X, Y = 0, 900
    f.sticky("Telegram Note", (X - 60, Y - 200), (
        "### Решения в Telegram\nКнопки под черновиком и команды. Принимаются только из чатов в `approver_chat_ids`. "
        "Перед отправкой счёт проверяется ещё раз: оплачен, оспорен, на паузе или есть обещание — письмо не уйдёт."), w=560, h=170, color=4)
    batch_get(f, "Read for Telegram", (X, Y), ["Invoices!A1:P5000", "Drafts!A1:M20000"])
    f.connect("Kind", "Read for Telegram", 1)
    f.code("Telegram Act", (X + 220, Y), code("telegram_act"))
    f.connect("Read for Telegram", "Telegram Act")
    f.switch("Action", (X + 440, Y), "={{ $json.action }}", ["send", "update"], fallback=True)
    f.connect("Telegram Act", "Action")
    f.node("Send Email", "n8n-nodes-base.emailSend", 2.1, (X + 660, Y - 100), {
        "fromEmail": "={{ %s.email.from }}" % CFG, "toEmail": "={{ $json.email.to }}", "subject": "={{ $json.email.subject }}",
        "emailFormat": "text", "text": "={{ $json.email.text }}",
        "options": {"appendAttribution": False, "replyTo": "={{ %s.email.reply_to }}" % CFG}}, creds=["smtp"], onError="continueRegularOutput")
    f.connect("Action", "Send Email", 0)
    f.code("After Send", (X + 880, Y - 100), code("after_send"))
    f.connect("Send Email", "After Send")
    f.code("Outcome", (X + 1100, Y),
           "return [{ json: $('After Send').isExecuted ? $('After Send').first().json : $('Telegram Act').first().json }];\n")
    f.connect("After Send", "Outcome")
    f.connect("Action", "Outcome", 1)
    f.connect("Action", "Outcome", 2)
    f.if_("Updates?", (X + 1320, Y), "={{ $json.updates.length > 0 }}")
    f.connect("Outcome", "Updates?")
    f.http("Update Sheets", (X + 1540, Y - 100), "POST", f"={SHEETS}/{{{{ {CFG}.spreadsheet_id }}}}/values:batchUpdate",
           body="={{ JSON.stringify({ valueInputOption: 'RAW', data: $('Outcome').first().json.updates }) }}", cred="googleSheetsOAuth2Api")
    f.connect("Updates?", "Update Sheets", 0)
    f.if_("Activity?", (X + 1760, Y), "={{ $('Outcome').first().json.activity.length > 0 }}")
    f.connect("Update Sheets", "Activity?")
    f.connect("Updates?", "Activity?", 1)
    f.http("Log Activity", (X + 1980, Y - 100), "POST", f"={SHEETS}/{{{{ {CFG}.spreadsheet_id }}}}/values/Activity!A1:append",
           body="={{ JSON.stringify({ values: $('Outcome').first().json.activity }) }}", cred="googleSheetsOAuth2Api",
           query=[("valueInputOption", "RAW"), ("insertDataOption", "INSERT_ROWS")], on_error="continueRegularOutput")
    f.connect("Activity?", "Log Activity", 0)
    f.if_("Button?", (X + 2200, Y), "={{ Boolean($('Outcome').first().json.callback_id) }}")
    f.connect("Log Activity", "Button?")
    f.connect("Activity?", "Button?", 1)
    f.node("Answer Button", "n8n-nodes-base.telegram", 1.2, (X + 2420, Y - 100), {
        "resource": "callback", "operation": "answerQuery", "queryId": "={{ $('Outcome').first().json.callback_id }}",
        "additionalFields": {"text": "={{ ($('Outcome').first().json.reply_text || '').slice(0, 190) }}"}},
        creds=["telegramApi"], onError="continueRegularOutput")
    f.connect("Button?", "Answer Button", 0)
    f.switch("Reply Kind", (X + 2640, Y), "={{ $('Outcome').first().json.action === 'card' ? 'card' : "
             "$('Outcome').first().json.action === 'ask_edit' ? 'ask_edit' : ($('Outcome').first().json.notice ? 'notice' : 'none') }}",
             ["card", "ask_edit", "notice"], fallback=False)
    f.connect("Answer Button", "Reply Kind")
    f.connect("Button?", "Reply Kind", 1)
    o = "$('Outcome').first().json"
    f.node("Card Again", "n8n-nodes-base.telegram", 1.2, (X + 2860, Y - 140), {
        "chatId": "={{ %s.chat_id }}" % o, "text": "={{ %s.card }}" % o, "replyMarkup": "inlineKeyboard",
        "inlineKeyboard": {"rows": [{"row": {"buttons": [
            {"text": "✅ Отправить", "additionalFields": {"callback_data": "=send:{{ %s.draft_id }}" % o}},
            {"text": "✏️ Изменить", "additionalFields": {"callback_data": "=edit:{{ %s.draft_id }}" % o}},
            {"text": "⏭ Пропустить", "additionalFields": {"callback_data": "=skip:{{ %s.draft_id }}" % o}}]}}]},
        "additionalFields": {"appendAttribution": False, "parse_mode": "HTML", "disable_web_page_preview": True}}, creds=["telegramApi"])
    f.node("Ask Edit", "n8n-nodes-base.telegram", 1.2, (X + 2860, Y), {
        "chatId": "={{ %s.chat_id }}" % o, "text": "={{ %s.notice }}" % o, "replyMarkup": "forceReply",
        "forceReply": {"force_reply": True}, "additionalFields": {"appendAttribution": False}}, creds=["telegramApi"])
    f.telegram("Notice", (X + 2860, Y + 140), "={{ %s.chat_id }}" % o, "={{ %s.notice }}" % o)
    f.connect("Reply Kind", "Card Again", 0)
    f.connect("Reply Kind", "Ask Edit", 1)
    f.connect("Reply Kind", "Notice", 2)

    # ---------- weekly report ----------
    X, Y = 0, 1400
    batch_get(f, "Read for Report", (X, Y), ["Invoices!A1:P5000", "Drafts!A1:M20000", "Activity!A1:E50000"])
    f.connect("Kind", "Read for Report", 2)
    f.code("Weekly Report", (X + 220, Y), code("report"))
    f.connect("Read for Report", "Weekly Report")
    f.telegram("Send Report", (X + 440, Y), "={{ $json.chat_id }}", "={{ $json.text }}", on_error="stopWorkflow")
    f.connect("Weekly Report", "Send Report")

    wf = f.render()
    placeholders_only(wf)
    return wf


def error_flow():
    f = Flow("Revenue Recovery — Error Alert", SLUG)
    f.sticky("About", (-40, -260), (
        "## Сигнал об ошибке\nЕсли агент упал (таблица недоступна, Telegram отклонил сообщение), вы узнаете в Telegram.\n\n"
        "Вставьте ID чата в узел **Alert** и выберите этот воркфлоу в Settings → Error workflow агента."), w=460, h=200, color=5)
    f.node("Error Trigger", "n8n-nodes-base.errorTrigger", 1, (0, 0), {})
    f.code("Message", (220, 0), (
        "const e = $input.first().json;\n"
        "const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\n"
        "const text = [\n"
        "  '<b>⚠️ Ошибка в Revenue Recovery</b>',\n"
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
    write_json(OUT / "workflows" / "revenue-recovery.n8n.json", wf)
    write_json(OUT / "workflows" / "error-alert.n8n.json", error_flow())
    no_secrets(json.dumps(wf))
    print("nodes:", len(wf["nodes"]))
