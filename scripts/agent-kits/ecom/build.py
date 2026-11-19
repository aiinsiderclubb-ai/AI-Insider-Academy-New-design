"""Builds content/products/ecommerce-support-retention-engine."""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
from nk import PRODUCTS, SHEETS, Flow, Tool, stable_id, tool_node, write_json, placeholders_only, no_secrets  # noqa: E402

SLUG = "ecommerce-support-retention-engine"
OUT = PRODUCTS / SLUG
INCLUDES = {
    "text.js": (HERE.parent / "common" / "text.js").read_text(encoding="utf8"),
    "order_norm.js": (HERE / "js" / "order_norm.js").read_text(encoding="utf8"),
    "hmac.js": (HERE / "js" / "hmac.js").read_text(encoding="utf8"),
    "mailer.js": (HERE / "js" / "mailer.js").read_text(encoding="utf8"),
}


def code(name, **repl):
    src = (HERE / "js" / f"{name}.js").read_text(encoding="utf8")
    for inc, body in INCLUDES.items():
        src = src.replace(f"// @include {inc}\n", body + "\n")
    for a, b in repl.items():
        src = src.replace(a, b)
    return src.strip() + "\n"


TOOLS = [
    Tool("search_policies",
         "Ищет в правилах магазина: доставка, оплата, сроки, гарантия, размеры, возвраты, контакты. "
         "Вызывай перед любым ответом о правилах. Возвращает до трёх статей или found=false.",
         [("query", "string", "Вопрос клиента ключевыми словами, например: сроки доставки Польша")]),
    Tool("get_order",
         "Статус заказа, состав, отслеживание. Нужны номер заказа и email, указанный при оформлении. "
         "Данные вернутся, только если email совпадает с заказом.",
         [("order_id", "string", "Номер заказа, как его написал клиент"),
          ("email", "string", "Email клиента из заказа; пустая строка, если клиент его не назвал")]),
    Tool("check_return",
         "Проверяет по правилам магазина, можно ли вернуть товары из заказа. Ничего не создаёт и денег не возвращает. "
         "Итог: eligible, ineligible или needs_human с причинами.",
         [("order_id", "string", "Номер заказа"),
          ("email", "string", "Email клиента из заказа"),
          ("items", "string", "Какие товары вернуть, через запятую; «все» — весь заказ"),
          ("reason", "string", "Причина возврата словами клиента"),
          ("condition", "string", "unused — не использовался, used — использовался, damaged — брак или повреждение, unknown — неизвестно")]),
    Tool("create_return_request",
         "Создаёт заявку на возврат для менеджера, если правила это допускают. Вызывай только после check_return "
         "и согласия клиента. Деньги не возвращает. Возвращает номер заявки.",
         [("order_id", "string", "Номер заказа"),
          ("email", "string", "Email клиента из заказа"),
          ("items", "string", "Какие товары вернуть, через запятую; «все» — весь заказ"),
          ("reason", "string", "Причина возврата словами клиента"),
          ("condition", "string", "unused, used, damaged или unknown")]),
    Tool("handoff_to_human",
         "Передаёт диалог менеджеру и уведомляет команду. Для денег, жалоб, споров о возврате, просьбы позвать человека.",
         [("reason", "string", "Почему нужен человек, одной фразой"),
          ("summary", "string", "Суть: номер заказа, номер заявки, что уже выяснено"),
          ("urgency", "string", "low, normal или high")]),
]

INPUTS = ["tool", "query", "order_id", "email", "items", "reason", "condition", "summary", "urgency",
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
CFG = "$('Config').first().json.config"

ORDER_Q = ("query($q: String!) { orders(first: 5, query: $q) { nodes { name email phone createdAt cancelledAt "
           "displayFinancialStatus displayFulfillmentStatus tags totalPriceSet { shopMoney { amount currencyCode } } "
           "customer { firstName defaultEmailAddress { emailAddress marketingState } defaultPhoneNumber { phoneNumber } } "
           "lineItems(first: 50) { nodes { title quantity product { productType tags handle } } } "
           "fulfillments(first: 10) { displayStatus deliveredAt trackingInfo(first: 3) { number url company } } } } }")
DELIVERED_Q = ORDER_Q.replace("orders(first: 5, query: $q)", "orders(first: 250, query: $q, sortKey: UPDATED_AT, reverse: true)")
CHECKOUTS_Q = ("query($q: String) { abandonedCheckouts(first: 100, query: $q, sortKey: CREATED_AT, reverse: true) { nodes { "
               "id abandonedCheckoutUrl createdAt updatedAt completedAt "
               "customer { firstName defaultEmailAddress { emailAddress marketingState } } "
               "totalPriceSet { shopMoney { amount currencyCode } } lineItems(first: 20) { nodes { title quantity } } } } }")


def prompt_expr(text):
    assert "{" not in re.sub(r"\{\{\w+\}\}", "", text), "stray brace in prompt"
    return "=" + re.sub(r"\{\{(\w+)\}\}", lambda m: "{{ %s.%s }}" % (CFG, m.group(1)), text)


def shopify(f, name, pos, query, variables_expr):
    body = "={{ JSON.stringify({ query: %s, variables: %s }) }}" % (json.dumps(query), variables_expr)
    url = "={{ %s.shopify_base }}/admin/api/{{ %s.shopify_api_version }}/graphql.json" % (CFG, CFG)
    n = f.http(name, pos, "POST", url, body=body, on_error="continueRegularOutput")
    node = f.nodes[-1]
    node["parameters"]["authentication"] = "genericCredentialType"
    node["parameters"]["genericAuthType"] = "httpHeaderAuth"
    node["credentials"] = {"httpHeaderAuth": {"id": "REPLACE_ME", "name": "Shopify Admin token"}}
    return n


def woo(f, name, pos, path_expr, query=None):
    url = "={{ %s.woo_base }}/wp-json/wc/v3/%s" % (CFG, path_expr)
    n = f.http(name, pos, "GET", url, query=query, on_error="continueRegularOutput")
    node = f.nodes[-1]
    node["parameters"]["authentication"] = "genericCredentialType"
    node["parameters"]["genericAuthType"] = "httpBasicAuth"
    node["credentials"] = {"httpBasicAuth": {"id": "REPLACE_ME", "name": "WooCommerce REST key"}}
    return n


def sheet_get(f, name, pos, rng):
    return f.http(name, pos, "GET", f"={SHEETS}/{{{{ {CFG}.spreadsheet_id }}}}/values/{rng}",
                  cred="googleSheetsOAuth2Api", on_error="continueRegularOutput")


def sheet_batch(f, name, pos, ranges):
    # ranges go straight into the URL: n8n keeps only the last of repeated query parameters
    qs = "&".join("ranges=" + r for r in ranges)
    n = f.http(name, pos, "GET", f"={SHEETS}/{{{{ {CFG}.spreadsheet_id }}}}/values:batchGet?{qs}",
               cred="googleSheetsOAuth2Api")
    f.nodes[-1]["executeOnce"] = True
    return n


def sheet_append(f, name, pos, tab, rows_expr, on_error="continueRegularOutput"):
    return f.http(name, pos, "POST", f"={SHEETS}/{{{{ {CFG}.spreadsheet_id }}}}/values/{tab}!A1:append",
                  body="={{ JSON.stringify({ values: %s }) }}" % rows_expr, cred="googleSheetsOAuth2Api",
                  query=[("valueInputOption", "RAW"), ("insertDataOption", "INSERT_ROWS")], on_error=on_error)


def email(f, name, pos):
    return f.node(name, "n8n-nodes-base.emailSend", 2.1, pos, {
        "fromEmail": "={{ %s.email.from }}" % CFG, "toEmail": "={{ $json.email }}", "subject": "={{ $json.subject }}",
        "emailFormat": "text", "text": "={{ $json.text }}",
        "options": {"appendAttribution": False, "replyTo": "={{ %s.email.reply_to }}" % CFG}},
        creds=["smtp"], onError="continueRegularOutput")


def build():
    prompt = (OUT / "agent" / "system-prompt.md").read_text(encoding="utf8").strip()
    copy_prompt = (OUT / "agent" / "cart-copy-prompt.md").read_text(encoding="utf8").strip()
    f = Flow("E-commerce Support & Retention Engine", SLUG)
    from nk import CRED_NAMES
    CRED_NAMES.setdefault("smtp", "SMTP account")

    f.sticky("Read Me", (-760, -560), (
        "## E-commerce Support & Retention Engine\n"
        "Один воркфлоу — четыре работы:\n"
        "1. **Агент магазина** (чат на сайте и Telegram): статус заказа владельцу, возвраты по правилам, передача человеку.\n"
        "2. **Брошенные корзины**: каждые 30 минут — письма по согласию, не больше двух на корзину.\n"
        "3. **Отзывы**: раз в день — просьба об отзыве через N дней после доставки.\n"
        "4. **События корзины и отписка** — вебхуки для магазинов без API корзин и ссылка «отписаться».\n\n"
        "**Перед запуском:** узел **Config**, ключи (Shopify / WooCommerce, Google Sheets, Telegram, SMTP, модель), Publish.\n"
        "Подробно — QUICKSTART.md."), w=620, h=440, color=5)

    # ---------------- triggers ----------------
    f.node("Chat Webhook", "n8n-nodes-base.webhook", 2.1, (-700, 0), {
        "httpMethod": "POST", "path": "store-agent", "responseMode": "responseNode", "options": {"allowedOrigins": "*"}},
        webhookId=stable_id(SLUG, "chat"))
    f.node("Telegram Trigger", "n8n-nodes-base.telegramTrigger", 1.2, (-700, 160), {
        "updates": ["message"], "additionalFields": {}}, creds=["telegramApi"], webhookId=stable_id(SLUG, "telegram"))
    f.node("Tool Call", "n8n-nodes-base.executeWorkflowTrigger", 1.1, (-700, 320), {
        "inputSource": "workflowInputs", "workflowInputs": {"values": [{"name": n} for n in INPUTS]}})
    f.node("Every 30 Minutes", "n8n-nodes-base.scheduleTrigger", 1.2, (-900, 480), {
        "rule": {"interval": [{"field": "minutes", "minutesInterval": 30}]}})
    f.code("Cart Tick", (-700, 480), "return [{ json: { job: 'carts' } }];\n")
    f.connect("Every 30 Minutes", "Cart Tick")
    f.node("Every Day 11:00", "n8n-nodes-base.scheduleTrigger", 1.2, (-900, 640), {
        "rule": {"interval": [{"field": "days", "triggerAtHour": 11}]}})
    f.code("Review Tick", (-700, 640), "return [{ json: { job: 'reviews' } }];\n")
    f.connect("Every Day 11:00", "Review Tick")
    f.node("Cart Event Webhook", "n8n-nodes-base.webhook", 2.1, (-700, 800), {
        "httpMethod": "POST", "path": "store-cart-event", "responseMode": "responseNode", "options": {}},
        webhookId=stable_id(SLUG, "cart-event"))
    f.node("Unsubscribe Webhook", "n8n-nodes-base.webhook", 2.1, (-700, 960), {
        "httpMethod": "GET", "path": "store-unsubscribe", "responseMode": "responseNode", "options": {}},
        webhookId=stable_id(SLUG, "unsubscribe"))

    f.code("Config", (-460, 400), code("config"))
    for t in ("Chat Webhook", "Telegram Trigger", "Tool Call", "Cart Tick", "Review Tick", "Cart Event Webhook", "Unsubscribe Webhook"):
        f.connect(t, "Config")
    kind = ("={{ $json.input.tool ? 'tool' : $json.input.job ? $json.input.job : "
            "String($json.input.webhookUrl || '').includes('store-cart-event') ? 'cart_event' : "
            "String($json.input.webhookUrl || '').includes('store-unsubscribe') ? 'unsubscribe' : 'chat' }}")
    f.switch("Kind", (-240, 400), kind, ["chat", "tool", "carts", "reviews", "cart_event", "unsubscribe"], fallback=False)
    f.connect("Config", "Kind")

    # ---------------- chat ----------------
    X, Y = 0, -300
    f.code("Guard In", (X, Y), code("guard_in"))
    f.connect("Kind", "Guard In", 0)
    f.switch("Route", (X + 220, Y), "={{ $json.route }}", ["agent", "canned", "deny", "bad"], fallback=False)
    f.connect("Guard In", "Route")
    f.node("AI Agent", "@n8n/n8n-nodes-langchain.agent", 3.1, (X + 480, Y - 200), {
        "promptType": "define", "text": "={{ $json.agent_input }}",
        "options": {"systemMessage": prompt_expr(prompt), "maxIterations": 10, "returnIntermediateSteps": True}},
        onError="continueRegularOutput")
    f.connect("Route", "AI Agent", 0)
    f.node("OpenAI Chat Model", "@n8n/n8n-nodes-langchain.lmChatOpenAi", 1.3, (X + 340, Y + 20), {
        "model": {"__rl": True, "mode": "list", "value": "gpt-5-mini", "cachedResultName": "gpt-5-mini"},
        "builtInTools": {}, "responsesApiEnabled": False, "options": {}}, creds=["openAiApi"])
    f.node("Anthropic Chat Model", "@n8n/n8n-nodes-langchain.lmChatAnthropic", 1.6, (X + 340, Y + 200), {
        "model": {"__rl": True, "mode": "id", "value": "claude-haiku-5-5"}, "options": {}}, creds=["anthropicApi"])
    f.connect("OpenAI Chat Model", "AI Agent", kind="ai_languageModel")
    f.sticky("Model Note", (X + 260, Y + 340), (
        "**Модель агента.** Подключена OpenAI (или любой OpenAI-совместимый API через Base URL). "
        "Для Claude протяните связь от **Anthropic Chat Model** к входу Chat Model агента вместо OpenAI — docs/07-models.md."),
        w=380, h=160, color=7)
    f.node("Memory", "@n8n/n8n-nodes-langchain.memoryBufferWindow", 1.3, (X + 500, Y + 20), {
        "sessionIdType": "customKey", "sessionKey": "={{ $('Guard In').first().json.session_id }}", "contextWindowLength": 14})
    f.connect("Memory", "AI Agent", kind="ai_memory")
    for i, t in enumerate(TOOLS):
        tool_node(f, t, (X + 640 + i * 150, Y + 20), INPUTS)
        f.nodes[-1]["parameters"]["workflowInputs"]["value"].update(FIXED)
        f.connect(t.name, "AI Agent", kind="ai_tool")
    f.code("Guard Out", (X + 900, Y - 200), code("guard_out"))
    f.connect("AI Agent", "Guard Out")
    f.code("Canned", (X + 480, Y + 160), code("canned"))
    f.connect("Route", "Canned", 1)
    f.if_("Alert Team?", (X + 1140, Y), "={{ Boolean($json.alert_html) }}")
    f.connect("Guard Out", "Alert Team?")
    f.connect("Canned", "Alert Team?")
    f.telegram("Team Alert", (X + 1360, Y - 100), "={{ %s.team_chat_id }}" % CFG, "={{ $json.alert_html }}")
    f.connect("Alert Team?", "Team Alert", 0)
    f.code("Log Row", (X + 1580, Y), code("log_row", **{
        "const d = $input.first().json;": "const d = $('Guard Out').isExecuted ? $('Guard Out').first().json : $('Canned').first().json;"}))
    f.connect("Team Alert", "Log Row")
    f.connect("Alert Team?", "Log Row", 1)
    sheet_append(f, "Log", (X + 1800, Y), "Log", "[$json.row]")
    f.connect("Log Row", "Log")
    f.switch("Reply Channel", (X + 2020, Y), "={{ $('Log Row').first().json.channel }}", ["web", "telegram"], fallback=False)
    f.connect("Log", "Reply Channel")
    f.node("Respond", "n8n-nodes-base.respondToWebhook", 1.1, (X + 2240, Y - 100), {
        "respondWith": "json", "responseBody": "={{ $('Log Row').first().json.response }}", "options": {}})
    f.connect("Reply Channel", "Respond", 0)
    f.telegram("Send Reply", (X + 2240, Y + 100), "={{ $('Log Row').first().json.customer.chat_id }}",
               "={{ $('Log Row').first().json.reply_html }}")
    f.connect("Reply Channel", "Send Reply", 1)
    f.node("Respond 401", "n8n-nodes-base.respondToWebhook", 1.1, (X + 480, Y + 340), {
        "respondWith": "json", "responseBody": '={{ { "error": "unauthorized" } }}', "options": {"responseCode": 401}})
    f.node("Respond 400", "n8n-nodes-base.respondToWebhook", 1.1, (X + 480, Y + 480), {
        "respondWith": "json", "responseBody": '={{ { "error": $json.error } }}', "options": {"responseCode": 400}})
    f.connect("Route", "Respond 401", 2)
    f.connect("Route", "Respond 400", 3)

    # ---------------- tools ----------------
    X, Y = 0, 700
    f.sticky("Tools Note", (X - 60, Y - 220), (
        "### Инструменты агента\nАгент вызывает этот же воркфлоу (`$workflow.id`). Вызов приходит в **Tool Call** → Config → Kind → сюда.\n"
        "Заказ берётся из платформы, выбранной в `platform`, и приводится к одному виду в **Normalize Order**."), w=520, h=180, color=4)
    f.switch("Tool Switch", (X, Y), "={{ $json.input.tool }}", [t.name for t in TOOLS])
    f.connect("Kind", "Tool Switch", 1)
    sheet_get(f, "Read Policies", (X + 240, Y - 120), "Policies!A1:E1000")
    f.code("Rank Policies", (X + 460, Y - 120), code("kb_rank"))
    f.chain("Read Policies", "Rank Policies")
    f.connect("Tool Switch", "Read Policies", 0)

    f.switch("Order Source", (X + 240, Y + 40), "={{ %s.platform }}" % CFG, ["shopify", "woocommerce", "sheets"], fallback=False)
    for out in (1, 2, 3):
        f.connect("Tool Switch", "Order Source", out)
    shopify(f, "Shopify Order", (X + 460, Y - 20), ORDER_Q,
            "{ q: 'name:#' + String($('Config').first().json.input.order_id || '').replace(/[^0-9A-Za-z-]/g, '') }")
    woo(f, "Woo Order", (X + 460, Y + 100),
        "orders/{{ encodeURIComponent(String($('Config').first().json.input.order_id || '0').replace(/[^0-9]/g, '') || '0') }}")
    sheet_get(f, "Sheet Orders", (X + 460, Y + 220), "Orders!A1:L20000")
    for i, n in enumerate(("Shopify Order", "Woo Order", "Sheet Orders")):
        f.connect("Order Source", n, i)
        f.connect(n, "Normalize Order")
    f.code("Normalize Order", (X + 680, Y + 100), code("normalize_order"))
    f.switch("Order Tool", (X + 900, Y + 100), "={{ $json.tool }}", ["get_order", "check_return", "create_return_request"], fallback=False)
    f.connect("Normalize Order", "Order Tool")
    f.code("Order Answer", (X + 1120, Y - 20), code("order_answer"))
    f.connect("Order Tool", "Order Answer", 0)
    f.code("Return Policy", (X + 1120, Y + 140), code("return_policy"))
    f.connect("Order Tool", "Return Policy", 1)
    f.connect("Order Tool", "Return Policy", 2)
    f.if_("Create Request?", (X + 1340, Y + 140), "={{ $json.create === true }}")
    f.connect("Return Policy", "Create Request?")
    f.code("Return Row", (X + 1560, Y + 100), code("return_row"))
    f.connect("Create Request?", "Return Row", 0)
    f.code("Return Alert", (X + 1780, Y + 100), code("return_alert"))
    f.connect("Return Row", "Return Alert")
    sheet_append(f, "Append Return", (X + 2000, Y + 100), "Returns", "[$json.row]")
    f.connect("Return Alert", "Append Return")
    f.telegram("Notify Returns", (X + 2220, Y + 100), "={{ %s.team_chat_id }}" % CFG, "={{ $('Return Alert').first().json.alert_html }}")
    f.connect("Append Return", "Notify Returns")
    f.code("Return Result", (X + 2440, Y + 100), code("return_result"))
    f.connect("Notify Returns", "Return Result")
    # the sub-workflow answers with its last node: without this the model would get an empty result
    f.code("Return Decision", (X + 1560, Y + 260), "return $input.all();\n")
    f.connect("Create Request?", "Return Decision", 1)

    f.code("Handoff Alert", (X + 240, Y + 380), code("handoff_alert"))
    f.telegram("Notify Team", (X + 460, Y + 380), "={{ %s.team_chat_id }}" % CFG, "={{ $json.alert_html }}")
    f.code("Handoff Result", (X + 680, Y + 380), code("handoff_result"))
    f.chain("Handoff Alert", "Notify Team", "Handoff Result")
    f.connect("Tool Switch", "Handoff Alert", 4)
    f.code("Unknown Tool", (X + 240, Y + 500), code("unknown_tool"))
    f.connect("Tool Switch", "Unknown Tool", 5)

    # ---------------- carts ----------------
    X, Y = 0, 1500
    f.sticky("Carts Note", (X - 60, Y - 240), (
        "### Брошенные корзины\nShopify — из API (abandonedCheckouts). WooCommerce и другие — из листа **Carts**, "
        "который наполняет вебхук `store-cart-event`. Правила отправки — в **Plan Carts**, настройки — `carts` в Config. "
        "Если в Shopify включены его собственные письма о корзине — выключите их, иначе клиент получит оба."), w=560, h=200, color=4)
    f.switch("Cart Source", (X, Y), "={{ %s.platform === 'shopify' ? 'shopify' : 'sheet' }}" % CFG, ["shopify", "sheet"], fallback=False)
    f.connect("Kind", "Cart Source", 2)
    shopify(f, "Fetch Checkouts", (X + 220, Y - 80), CHECKOUTS_Q,
            "{ q: 'status:open updated_at:>=' + new Date(Date.now() - %s.carts.max_age_hours * 3600000).toISOString() }" % CFG)
    sheet_get(f, "Read Carts", (X + 220, Y + 80), "Carts!A1:J20000")
    f.connect("Cart Source", "Fetch Checkouts", 0)
    f.connect("Cart Source", "Read Carts", 1)
    sheet_batch(f, "Read Message Log", (X + 440, Y), ["Messages!A1:H50000", "Suppress!A1:C50000"])
    f.connect("Fetch Checkouts", "Read Message Log")
    f.connect("Read Carts", "Read Message Log")
    f.code("Plan Carts", (X + 660, Y), code("plan_carts"))
    f.connect("Read Message Log", "Plan Carts")
    f.if_("AI Copy?", (X + 1100, Y), "={{ %s.carts.ai_personalize }}" % CFG)
    f.connect("Plan Carts", "AI Copy?")
    f.node("Cart Copy", "@n8n/n8n-nodes-langchain.chainLlm", 1.9, (X + 1320, Y - 120), {
        "promptType": "define",
        "text": "={{ 'Шаг письма: ' + $json.step + '\\nТовары в корзине: ' + $json.items.join('; ') }}",
        "messages": {"messageValues": [{"message": prompt_expr(copy_prompt)}]}}, onError="continueRegularOutput")
    f.connect("AI Copy?", "Cart Copy", 0)
    f.node("Copy Model", "@n8n/n8n-nodes-langchain.lmChatOpenAi", 1.3, (X + 1320, Y + 60), {
        "model": {"__rl": True, "mode": "list", "value": "gpt-5-mini", "cachedResultName": "gpt-5-mini"},
        "builtInTools": {}, "responsesApiEnabled": False, "options": {}}, creds=["openAiApi"])
    f.connect("Copy Model", "Cart Copy", kind="ai_languageModel")
    f.code("Compose Cart Email", (X + 1540, Y), code("compose_cart"))
    f.connect("Cart Copy", "Compose Cart Email")
    f.connect("AI Copy?", "Compose Cart Email", 1)
    email(f, "Send Cart Email", (X + 1760, Y))
    f.connect("Compose Cart Email", "Send Cart Email")
    f.code("Cart Message Rows", (X + 1980, Y), code("message_rows", __COMPOSE__="Compose Cart Email"))
    f.connect("Send Cart Email", "Cart Message Rows")
    sheet_append(f, "Log Cart Emails", (X + 2200, Y), "Messages", "$json.rows")
    f.connect("Cart Message Rows", "Log Cart Emails")

    # ---------------- reviews ----------------
    X, Y = 0, 1900
    f.sticky("Reviews Note", (X - 60, Y - 200), (
        "### Отзывы\nРаз в день: заказы, доставленные `days_after_delivery`–`max_age_days` дней назад, без заявки на возврат, "
        "если раньше не просили. Без скидок за отзыв."), w=560, h=160, color=4)
    f.switch("Review Source", (X, Y), "={{ %s.platform }}" % CFG, ["shopify", "woocommerce", "sheets"], fallback=False)
    f.connect("Kind", "Review Source", 3)
    shopify(f, "Fetch Delivered", (X + 220, Y - 120), DELIVERED_Q,
            "{ q: 'fulfillment_status:fulfilled updated_at:>=' + new Date(Date.now() - (%s.reviews.max_age_days + 5) * 86400000).toISOString() }" % CFG)
    woo(f, "Fetch Completed", (X + 220, Y), "orders",
        query=[("status", "completed"), ("per_page", "100"),
               ("modified_after", "={{ new Date(Date.now() - (%s.reviews.max_age_days + 5) * 86400000).toISOString() }}" % CFG)])
    sheet_get(f, "Read Orders for Reviews", (X + 220, Y + 120), "Orders!A1:L20000")
    for i, n in enumerate(("Fetch Delivered", "Fetch Completed", "Read Orders for Reviews")):
        f.connect("Review Source", n, i)
        f.connect(n, "Read Review Log")
    sheet_batch(f, "Read Review Log", (X + 440, Y), ["Messages!A1:H50000", "Suppress!A1:C50000", "Returns!A1:L50000"])
    f.code("Plan Reviews", (X + 660, Y), code("plan_reviews"))
    f.connect("Read Review Log", "Plan Reviews")
    f.code("Compose Review Email", (X + 1100, Y), code("compose_review"))
    f.connect("Plan Reviews", "Compose Review Email")
    email(f, "Send Review Email", (X + 1320, Y))
    f.connect("Compose Review Email", "Send Review Email")
    f.code("Review Message Rows", (X + 1540, Y), code("message_rows", __COMPOSE__="Compose Review Email"))
    f.connect("Send Review Email", "Review Message Rows")
    sheet_append(f, "Log Review Emails", (X + 1760, Y), "Messages", "$json.rows")
    f.connect("Review Message Rows", "Log Review Emails")

    # ---------------- cart events and unsubscribe ----------------
    X, Y = 0, 2250
    f.code("Cart Event", (X, Y), code("cart_event"))
    f.connect("Kind", "Cart Event", 4)
    f.switch("Event Route", (X + 220, Y), "={{ $json.route }}", ["ok", "deny", "bad"], fallback=False)
    f.connect("Cart Event", "Event Route")
    sheet_append(f, "Append Cart", (X + 440, Y - 80), "Carts", "[$json.row]", on_error="stopWorkflow")
    f.connect("Event Route", "Append Cart", 0)
    f.node("Respond OK", "n8n-nodes-base.respondToWebhook", 1.1, (X + 660, Y - 80), {
        "respondWith": "json", "responseBody": '={{ { "ok": true } }}', "options": {}})
    f.connect("Append Cart", "Respond OK")
    f.connect("Event Route", "Respond 401", 1)
    f.connect("Event Route", "Respond 400", 2)

    f.code("Unsubscribe Check", (X + 220, Y + 200), code("unsub_check"))
    f.connect("Kind", "Unsubscribe Check", 5)
    f.if_("Valid Link?", (X + 440, Y + 200), "={{ $json.ok }}")
    f.connect("Unsubscribe Check", "Valid Link?")
    sheet_append(f, "Append Suppress", (X + 660, Y + 140), "Suppress", "[$json.row]")
    f.connect("Valid Link?", "Append Suppress", 0)
    f.node("Respond Page", "n8n-nodes-base.respondToWebhook", 1.1, (X + 880, Y + 200), {
        "respondWith": "text", "responseBody": "={{ $('Unsubscribe Check').first().json.html }}",
        "options": {"responseHeaders": {"entries": [{"name": "content-type", "value": "text/html; charset=utf-8"}]}}})
    f.connect("Append Suppress", "Respond Page")
    f.connect("Valid Link?", "Respond Page", 1)

    wf = f.render()
    placeholders_only(wf)
    return wf


def error_flow():
    f = Flow("E-commerce Engine — Error Alert", SLUG)
    f.sticky("About", (-40, -260), (
        "## Сигнал об ошибке\nЕсли движок упал (магазин или таблица недоступны в рассылке, сбой SMTP), команда узнает в Telegram.\n\n"
        "Вставьте ID чата в узел **Alert** и выберите этот воркфлоу в Settings → Error workflow движка."), w=460, h=220, color=5)
    f.node("Error Trigger", "n8n-nodes-base.errorTrigger", 1, (0, 0), {})
    f.code("Message", (220, 0), (
        "const e = $input.first().json;\n"
        "const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\n"
        "const text = [\n"
        "  '<b>⚠️ Ошибка в e-commerce движке</b>',\n"
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
    write_json(OUT / "workflows" / "store-engine.n8n.json", wf)
    write_json(OUT / "workflows" / "error-alert.n8n.json", error_flow())
    write_json(OUT / "agent" / "tools.openai.json", [t.openai() for t in TOOLS])
    write_json(OUT / "agent" / "tools.anthropic.json", [t.anthropic() for t in TOOLS])
    no_secrets(json.dumps(wf))
    print("nodes:", len(wf["nodes"]))
