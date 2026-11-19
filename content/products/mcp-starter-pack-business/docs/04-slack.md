# Slack

Официальный удалённый сервер Slack: `https://mcp.slack.com/mcp` (Streamable HTTP, OAuth). Архивный `@modelcontextprotocol/server-slack` и его форк из README архива не обновляются — не используйте их.

## Что умеет

Поиск сообщений, файлов, пользователей и каналов; чтение каналов и тредов; отправка, отложенная отправка и черновики сообщений; реакции; создание каналов; холсты (canvases); профили пользователей; загрузка файлов; списки (lists).

Сервер работает от имени пользователя, который вошёл: видит то же, что этот пользователь, и пишет от его имени. Это отличие от старого сервера с токеном бота — его стоит обсудить со службой безопасности.

## Claude Desktop и claude.ai

Settings → Connectors → Slack → Connect. Администратор Slack может потребовать одобрить подключение.

## Claude Code, Cursor, n8n: внутреннее Slack-приложение

Slack не поддерживает динамическую регистрацию клиентов. Пользоваться MCP могут только приложения из Slack Marketplace и внутренние приложения рабочего пространства. Нужно своё внутреннее приложение:

1. api.slack.com/apps → **Create New App** → From scratch → ваше рабочее пространство.
2. OAuth & Permissions → **Redirect URLs**:
   - Claude Code — `http://localhost:3119/callback`;
   - Cursor через mcp-remote — `http://localhost:3119/oauth/callback`;
   - n8n — адрес OAuth callback из ключа MCP OAuth2 в n8n.
3. **User Token Scopes** — только для нужных инструментов. Для поиска и чтения: `search:read.public`, `channels:history`, `channels:read`, `users:read`; для приватных каналов и личных — `search:read.private`, `groups:history`, `search:read.im`, `im:history`; для отправки — `chat:write`. Полный список по инструментам — docs.slack.dev/ai/slack-mcp-server.
4. Basic Information → Client ID и Client Secret.
5. Если в рабочем пространстве включено одобрение приложений — администратор одобряет приложение.

### Claude Code

```bash
claude mcp add --scope project --transport http --client-id "$SLACK_CLIENT_ID" --client-secret \
  --callback-port 3119 slack https://mcp.slack.com/mcp
```

Затем `/mcp` → slack → Authenticate.

### Cursor

Блок `slack` в `clients/cursor.mcp.json` использует `mcp-remote` и файл `~/.mcp-oauth/slack.json`:

```json
{"client_id": "ВАШ_CLIENT_ID", "client_secret": "ВАШ_CLIENT_SECRET"}
```

`chmod 600 ~/.mcp-oauth/slack.json`.

### n8n

Узел MCP Client Tool → Authentication **MCP OAuth2** → Client ID и Secret приложения → Connect.

## Только чтение

У сервера нет режима «только чтение», но права задаёте вы: без `chat:write` и `canvases:write` агент не сможет писать. В Claude Desktop и Claude Code не разрешайте отправку сообщений навсегда. В n8n — Tools to Include → All Except → исключите инструменты отправки.

## Аудит

Все действия через MCP видны администратору в журнале аудита Slack. Лимиты запросов — те же, что у Slack API: поиск сообщений — по особым правилам, чтение каналов — около 50 запросов в минуту.
