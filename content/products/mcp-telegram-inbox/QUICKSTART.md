# Запуск за 30–40 минут

## 1. Бот и чаты (10 минут)

1. В @BotFather: `/newbot` → сохраните токен.
2. Там же: `/setprivacy` → выберите бота → **Disable**. Иначе в группе бот видит только команды и ответы себе.
3. Добавьте бота в рабочий чат, где пишут клиенты, и в чат менеджера, куда будут приходить передачи.
4. Узнайте ID чатов: напишите в каждый чат сообщение и откройте `https://api.telegram.org/botТОКЕН/getUpdates`. Нужен `chat.id`; у групп он начинается с `-100`.

Не открывайте `getUpdates` после настройки сервера: Telegram отдаёт каждое сообщение один раз, и прочитанное там до сервера не дойдёт.

## 2. Настройки (5 минут)

1. Скопируйте `config/inbox.example.json` в `config/inbox.json`.
2. `chats` — ID и названия чатов, которые читает агент.
3. `manager_chat_id` — чат менеджера.
4. `lead_sink.url` — адрес вебхука CRM. Если CRM пока нет — `"type": "none"`: лиды будут только помечаться в сервере, а агент перечислит их в отчёте.
5. Правила эскалации — `rules/escalation-rules.md`. Для начала подойдут стандартные.

## 3. Проверка сервера (5 минут)

```bash
export TELEGRAM_BOT_TOKEN=ваш_токен
export CRM_WEBHOOK_TOKEN=токен_вебхука_CRM
python3 server/telegram_inbox_mcp.py --config config/inbox.json --http 8765
```

Если в терминале появилось `telegram-inbox: http://127.0.0.1:8765/mcp` — сервер запускается. Остановите его: Ctrl+C. Для Claude и Cursor его запускает сам клиент.

## 4. Подключение клиента (10 минут)

**Claude Code.** Скопируйте `clients/claude-code.mcp.json` в корень проекта как `.mcp.json`, задайте переменные и запустите `claude`:

```bash
export MCP_KIT_DIR=/полный/путь/к/mcp-telegram-inbox
export TELEGRAM_BOT_TOKEN=... CRM_WEBHOOK_TOKEN=...
claude
```

**Claude Desktop.** Settings → Developer → Edit Config. Перенесите блок из `clients/claude-desktop.json`, впишите полные пути и токены, перезапустите Claude Desktop.

**Cursor.** `~/.cursor/mcp.json` ← `clients/cursor.mcp.json`. Положите набор в `~/mcp/telegram-inbox/`, задайте переменные окружения.

**n8n** — разбор по расписанию, без человека. Подробно — `docs/03-clients.md`.

## 5. Первый разбор (5 минут)

1. Напишите в рабочий чат тестовые сообщения из таблицы в `prompts/agent-request.md` — с другого аккаунта.
2. Вставьте агенту запрос из `prompts/agent-request.md`.
3. Проверьте: лид появился в CRM, жалоба пришла менеджеру, «обед в 13:00» помечен как ignored.
4. Повторите запрос — агент должен ответить, что нового нет.
