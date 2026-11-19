# Клиенты: Claude, Cursor, n8n

Режимы сервера: **stdio** — клиент сам запускает процесс (Claude Desktop, Claude Code, Cursor); **HTTP** — сервер работает постоянно на `http://адрес:порт/mcp` (n8n).

## Claude Code

`clients/claude-code.mcp.json` → `.mcp.json` в корне проекта.

```bash
export MCP_KIT_DIR=/полный/путь/к/mcp-google-calendar
export GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=...
claude
```

Когда Claude Code спросит разрешение на `confirm_event`, выбирайте «разрешить один раз», а не «всегда».

## Claude Desktop

Settings → Developer → Edit Config → блок из `clients/claude-desktop.json`: полные пути, три значения Google прямо в `env` (переменные окружения Claude Desktop не подставляет). Перезапустите приложение.

## Cursor

`~/.cursor/mcp.json` ← `clients/cursor.mcp.json`. Набор ожидается в `~/mcp/google-calendar/`, значения Google — в переменных окружения.

## n8n

1. Сервер в режиме HTTP рядом с n8n:

```bash
docker run -d --name google-calendar --network ВАША_СЕТЬ_N8N \
  -v /путь/к/mcp-google-calendar:/app -w /app \
  -e GOOGLE_CLIENT_ID=... -e GOOGLE_CLIENT_SECRET=... -e GOOGLE_REFRESH_TOKEN=... \
  -e MCP_HTTP_TOKEN=длинная-случайная-строка -e MCP_HTTP_HOST=0.0.0.0 \
  python:3.12-slim python3 server/calendar_mcp.py --config config/calendar.json --http 8767
```

Образ `python:3.12-slim` содержит базу часовых поясов, отдельный `tzdata` не нужен.

2. В воркфлоу с AI Agent — узел **MCP Client Tool**: Endpoint `http://google-calendar:8767/mcp`, HTTP Streamable, Bearer Auth с `MCP_HTTP_TOKEN`. Короткое имя узла, например `cal` (инструменты станут `cal_find_free_slots` и т. д.).
3. Системная инструкция агента должна включать правило из `rules/confirmation-rule.md`: показать `confirmation_question` дословно и вызвать `confirm_event` только после ответа клиента.

**Внимание:** в n8n нет подтверждения вызова человеком. Если агент n8n разговаривает с клиентами в мессенджере, `confirm_event` защищён только проверками сервера: ответ «да», свежесть, занятость. Если этого мало — Tools to Include → Selected, без `confirm_event`: агент будет только предлагать время, а запись подтвердит менеджер.

Тот же узел MCP Client с нашим сервером на том же протоколе (`server/mcp_lite.py`) мы проверяли в n8n 2.48.

## Системная инструкция для агента записи

```text
Ты записываешь клиентов на встречи.
1. Найди свободное время через find_free_slots и предложи 2–3 варианта.
2. Когда клиент выбрал время, узнай имя и email и вызови propose_event.
3. Покажи клиенту confirmation_question дословно и дождись ответа.
4. Только если клиент ответил согласием — вызови confirm_event с его ответом дословно, не пересказывай.
5. Если сервер отказал — объясни клиенту причину и предложи другое время.
Никогда не вызывай confirm_event без ответа клиента на вопрос подтверждения.
Не рассказывай клиенту о других встречах в календаре.
```
