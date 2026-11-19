# HubSpot

Официальный удалённый сервер HubSpot: `https://mcp.hubspot.com`. Через него работают и коннекторы HubSpot для Claude, ChatGPT, Copilot и Gemini.

## Что умеет

Читает: контакты, компании, сделки, тикеты, лиды, пользователей, встречи, активности (звонки, письма, заметки, задачи), сегменты, маркетинговый контент и аналитику, переписку из inbox. Пишет: создаёт и меняет записи CRM, активности, сегменты, свойства, воронки, контент.

Перед каждой записью HubSpot показывает предлагаемые изменения и требует явного подтверждения пользователя.

Доступ ограничен правами пользователя, который вошёл: агент не увидит записи, которые этот пользователь не видит в HubSpot. Если в портале включён режим Sensitive Data, переписка через MCP недоступна.

Список инструментов зависит от тарифа и прав. Первый запрос агенту — «вызови get_user_details и скажи, к каким объектам у тебя есть доступ».

## Claude Desktop и claude.ai

Ничего настраивать не нужно: Settings → Connectors → HubSpot → Connect, вход в HubSpot, выбор прав.

## Claude Code, Cursor, n8n: свой MCP-коннектор

Сервер HubSpot не поддерживает динамическую регистрацию клиентов. Поэтому для Claude Code, Cursor и n8n нужен свой коннектор в HubSpot с Client ID и Client secret:

1. В HubSpot: Development → MCP Auth Apps (в некоторых аккаунтах — раздел приложений разработчика) → создайте MCP-коннектор. Точный путь в меню HubSpot меняет — актуальная инструкция: developers.hubspot.com/docs/apps/developer-platform/build-apps/integrate-with-the-remote-hubspot-mcp-server.
2. Redirect URL:
   - Claude Code — `http://localhost:3118/callback`;
   - Cursor через mcp-remote — `http://localhost:3118/oauth/callback`;
   - n8n — адрес OAuth callback, который n8n показывает в ключе MCP OAuth2 (обычно `https://ВАШ-N8N/rest/oauth2-credential/callback`).
3. Сохраните Client ID и Client secret.

HubSpot требует PKCE — Claude Code, mcp-remote и n8n делают это сами.

### Claude Code

```bash
claude mcp add --scope project --transport http --client-id "$HUBSPOT_CLIENT_ID" --client-secret \
  --callback-port 3118 hubspot https://mcp.hubspot.com
```

Claude Code спросит client secret и сохранит его в защищённом хранилище. Затем в Claude Code: `/mcp` → hubspot → Authenticate.

### Cursor

Cursor подключает HubSpot через `mcp-remote` (блок `hubspot` в `clients/cursor.mcp.json`). Создайте файл `~/.mcp-oauth/hubspot.json`:

```json
{"client_id": "ВАШ_CLIENT_ID", "client_secret": "ВАШ_CLIENT_SECRET"}
```

и ограничьте к нему доступ: `chmod 600 ~/.mcp-oauth/hubspot.json`. При первом подключении откроется вход в HubSpot.

### n8n

Узел MCP Client Tool → Authentication: **MCP OAuth2** → новый ключ: Client ID, Client secret из коннектора → Connect. Подробно — `docs/06-n8n.md`.

## Права

При входе HubSpot предлагает выбрать права. Выдавайте только нужные: для отчётов по сделкам — чтение CRM; для заведения контактов — запись контактов. Новые инструменты HubSpot могут требовать новых прав — тогда нужно переподключиться.

## Если HubSpot нужен только на чтение

Отдельного «только чтение» у сервера нет. Варианты:
- в Claude Desktop и Claude Code не разрешайте `manage_crm_objects` навсегда — каждое изменение будет требовать вашего «да» (и ещё одно подтверждение покажет сам HubSpot);
- в n8n: узел MCP Client → Tools to Include → **All Except** → исключите `manage_crm_objects`, `manage_segment`, `manage_custom_properties`, `manage_custom_pipelines`;
- войдите пользователем HubSpot с правами только на просмотр.
