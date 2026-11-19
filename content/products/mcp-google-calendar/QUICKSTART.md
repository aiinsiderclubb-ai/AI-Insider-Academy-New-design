# Запуск примерно за час

## 1. Проект Google Cloud (20 минут)

1. console.cloud.google.com → создайте проект.
2. APIs & Services → Library → **Google Calendar API** → Enable.
3. OAuth consent screen (Google Auth Platform):
   - тип — External (или Internal, если у вас Google Workspace и календарь в нём);
   - добавьте права `.../auth/calendar.events` и `.../auth/calendar.freebusy`;
   - для External добавьте свой адрес в Test users.
4. Clients → Create client → тип **Desktop app**. Сохраните Client ID и Client secret.

**Важно про режим Testing.** Пока приложение в статусе Testing, refresh token перестаёт работать через 7 дней. Для постоянной работы переведите приложение в In production (Publish app). Для личного или внутреннего использования проверка Google не нужна, но при входе будет предупреждение «Google hasn't verified this app» — это нормально для вашего же приложения. Подробно — `docs/02-google-setup.md`.

## 2. Доступ к календарю (5 минут)

```bash
export GOOGLE_CLIENT_ID=...apps.googleusercontent.com
export GOOGLE_CLIENT_SECRET=...
python3 server/get_refresh_token.py
```

Откроется браузер. Войдите в аккаунт с календарём и разрешите доступ. В терминале появится `GOOGLE_REFRESH_TOKEN=…` — сохраните его как переменную окружения. Никому не пересылайте.

## 3. Настройки (10 минут)

`config/calendar.example.json` → `config/calendar.json`:
- `calendar_id` — `primary` (основной календарь аккаунта) или ID другого: Настройки календаря → Интеграция календаря → Идентификатор;
- `busy_calendars` — календари, занятость которых учитывать: например, рабочий и личный;
- `timezone`, `working_hours`, `buffer_minutes`, `min_notice_hours` — `docs/01-how-it-works.md`.

## 4. Проверка (5 минут)

```bash
export GOOGLE_REFRESH_TOKEN=...
python3 server/calendar_mcp.py --config config/calendar.json --http 8767
```

Строка `google-calendar-confirmed: http://127.0.0.1:8767/mcp` — сервер запустился. Ctrl+C.

## 5. Клиент (10 минут)

- **Claude Code:** `clients/claude-code.mcp.json` → `.mcp.json`; `export MCP_KIT_DIR=/путь/к/набору` и три переменные Google; `claude`.
- **Claude Desktop:** Settings → Developer → Edit Config → блок из `clients/claude-desktop.json`.
- **Cursor:** `~/.cursor/mcp.json` ← `clients/cursor.mcp.json`.
- **n8n:** режим HTTP — `docs/03-clients.md`.

В Claude Desktop и Claude Code не разрешайте `confirm_event` «всегда»: пусть клиент спрашивает вас перед каждым вызовом — это вторая проверка рядом с правилом подтверждения.

## 6. Тестовый диалог (10 минут)

Пройдите `checks/test-dialogue.md` на тестовом календаре или в нерабочие дни основного.
