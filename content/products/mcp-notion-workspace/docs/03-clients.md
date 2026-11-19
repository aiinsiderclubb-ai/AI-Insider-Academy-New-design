# Клиенты: Claude, Cursor, n8n

Режимы сервера: **stdio** — клиент сам запускает процесс (Claude Desktop, Claude Code, Cursor); **HTTP** — сервер работает постоянно на `http://адрес:порт/mcp` (n8n и другие сетевые клиенты).

## Claude Code

`clients/claude-code.mcp.json` → `.mcp.json` в корне проекта.

```bash
export MCP_KIT_DIR=/полный/путь/к/mcp-notion-workspace
export NOTION_TOKEN=ntn_...
claude
```

Или командой:

```bash
claude mcp add notion-workspace -e NOTION_TOKEN=$NOTION_TOKEN \
  -- python3 $MCP_KIT_DIR/server/notion_workspace_mcp.py --config $MCP_KIT_DIR/config/notion.json
```

## Claude Desktop

Settings → Developer → Edit Config → блок из `clients/claude-desktop.json`. Пути — полные, токен — прямо в `env` (Claude Desktop не подставляет переменные окружения). Перезапустите приложение.

## Cursor

`~/.cursor/mcp.json` ← `clients/cursor.mcp.json`. Набор ожидается в `~/mcp/notion-workspace/`, токен — в переменной окружения `NOTION_TOKEN`.

## n8n

1. Запустите сервер в режиме HTTP рядом с n8n:

```bash
docker run -d --name notion-workspace --network ВАША_СЕТЬ_N8N \
  -v /путь/к/mcp-notion-workspace:/app -w /app \
  -e NOTION_TOKEN=ntn_... -e MCP_HTTP_TOKEN=длинная-случайная-строка -e MCP_HTTP_HOST=0.0.0.0 \
  python:3.12-slim python3 server/notion_workspace_mcp.py --config config/notion.json --http 8766
```

2. В воркфлоу с AI Agent добавьте узел **MCP Client Tool**: Endpoint `http://notion-workspace:8766/mcp`, Server Transport — HTTP Streamable, Authentication — Bearer Auth с токеном `MCP_HTTP_TOKEN`.
3. Назовите узел коротко, например `kb`: n8n добавляет имя узла к инструментам (`kb_search_knowledge`).
4. В системной инструкции агента: «Отвечай только по результатам search_knowledge и read_page. Если ничего не найдено — скажи, что в базе этого нет».

Тот же узел MCP Client с нашим сервером Telegram Inbox мы проверяли в n8n 2.48; протокол у серверов общий (`server/mcp_lite.py`).

## Системная инструкция для агента

Сервер сообщает клиенту короткую инструкцию сам (поле `instructions` при подключении). Если клиент её не показывает модели (так бывает в n8n), добавьте в системную инструкцию агента:

```text
Отвечай на вопросы только по тому, что вернули search_knowledge и read_page.
Если поиск ничего не нашёл — скажи, что в базе знаний этого нет, и предложи записать вопрос.
Перед первой записью в таблицу вызови describe_target. Пиши только те колонки и варианты, которые он вернул.
Не повторяй запись, если сервер ответил, что строка уже есть.
```
