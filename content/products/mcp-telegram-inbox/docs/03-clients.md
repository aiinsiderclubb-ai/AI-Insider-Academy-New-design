# Клиенты: Claude, Cursor, n8n

Сервер работает в двух режимах:
- **stdio** — клиент сам запускает `python3 server/telegram_inbox_mcp.py` и общается с ним через ввод-вывод. Так работают Claude Desktop, Claude Code и Cursor.
- **HTTP** — сервер работает постоянно и принимает запросы на `http://адрес:порт/mcp` (Streamable HTTP). Так его вызывает n8n.

## Claude Code

`clients/claude-code.mcp.json` → в корень проекта под именем `.mcp.json`. Переменные `${…}` Claude Code берёт из окружения при запуске:

```bash
export MCP_KIT_DIR=/полный/путь/к/mcp-telegram-inbox
export TELEGRAM_BOT_TOKEN=... CRM_WEBHOOK_TOKEN=...
claude
```

При первом запуске Claude Code спросит, доверять ли серверам из `.mcp.json`. Команда `/mcp` показывает статус и инструменты.

Или одной командой, без файла:

```bash
claude mcp add telegram-inbox -e TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN -e CRM_WEBHOOK_TOKEN=$CRM_WEBHOOK_TOKEN \
  -- python3 $MCP_KIT_DIR/server/telegram_inbox_mcp.py --config $MCP_KIT_DIR/config/inbox.json
```

## Claude Desktop

Settings → Developer → Edit Config открывает `claude_desktop_config.json`. Добавьте блок `telegram-inbox` из `clients/claude-desktop.json`:
- пути — полные, без `~`;
- токены — прямо в `env`: Claude Desktop не подставляет переменные окружения. Файл хранится в вашем профиле, никому его не пересылайте.

Перезапустите Claude Desktop. В окне чата → значок инструментов → telegram-inbox.

Если `python3` не находится — укажите полный путь: `which python3` в терминале.

## Cursor

`~/.cursor/mcp.json` (для всех проектов) или `.cursor/mcp.json` (для одного). Блок из `clients/cursor.mcp.json` ожидает набор в `~/mcp/telegram-inbox/` и токены в переменных окружения (`${env:…}`). Cursor → Settings → MCP показывает, запустился ли сервер.

## n8n — разбор по расписанию

`clients/n8n-inbox-triage.n8n.json`: каждые 15 минут AI Agent выполняет запрос из `prompts/agent-request.md` через узел MCP Client.

1. Запустите сервер в режиме HTTP там, откуда n8n его видит. Если n8n в Docker, удобнее всего контейнер в той же сети:

```bash
docker run -d --name telegram-inbox --network ВАША_СЕТЬ_N8N \
  -v /путь/к/mcp-telegram-inbox:/app -w /app \
  -e TELEGRAM_BOT_TOKEN=... -e CRM_WEBHOOK_TOKEN=... \
  -e MCP_HTTP_TOKEN=длинная-случайная-строка -e MCP_HTTP_HOST=0.0.0.0 \
  python:3.12-slim python3 server/telegram_inbox_mcp.py --config config/inbox.json --http 8765
```

Без `MCP_HTTP_TOKEN` сервер откажется слушать что-либо, кроме localhost.

2. Импортируйте воркфлоу. В узле **inbox**: адрес `http://telegram-inbox:8765/mcp`, Authentication — Bearer Auth, токен = `MCP_HTTP_TOKEN`.
3. В **OpenAI Chat Model** — ваш ключ (или замените модель).
4. Опубликуйте.

В n8n имена инструментов получают приставку из имени узла: `inbox_create_lead`. Поэтому узел называется коротко — `inbox`.

Каждый разбор — отдельный запуск агента. Отчёт агента виден в выполнении воркфлоу. Если нужен отчёт в Telegram, добавьте после AI Agent узел Telegram с текстом `{{ $json.output }}`.

## Какую модель брать

Разбор чата — задача на аккуратность, а не на сообразительность: агенту нужно точно передать id сообщений и не придумывать контакты. Сервер страхует от ошибок с контактами и id, но выбор «лид или эскалация» делает модель. Перед тем как оставлять агента без присмотра, прогоните тестовые сообщения из `prompts/agent-request.md` на своей модели.
