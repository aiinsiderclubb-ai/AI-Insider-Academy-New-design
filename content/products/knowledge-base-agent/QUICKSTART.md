# Запуск примерно за час

Сначала запустите агента на демо-документах из `templates/demo-docs/`: так вы увидите, как он работает, и прогоните evals. Свои документы положите потом.

## 1. Документы и таблица (10 минут)

1. Создайте в Google Drive папку, например «База знаний». Загрузите в неё файлы из `templates/demo-docs/`. Скопируйте ID папки из адреса: `drive.google.com/drive/folders/ЭТО_ID`.
2. Создайте Google Таблицу с листами `Documents`, `Sources`, `Gaps`, `Log`. Импортируйте в каждый свой файл (Файл → Импорт → «Заменить текущий лист»):
   - `Documents` ← `templates/documents-header.csv`
   - `Sources` ← `templates/sources.csv`
   - `Gaps` ← `templates/gaps-header.csv`
   - `Log` ← `templates/log-header.csv`
3. Скопируйте ID таблицы: `docs.google.com/spreadsheets/d/ЭТО_ID/edit`.

## 2. Telegram (5 минут)

1. Создайте бота в @BotFather (`/newbot`), группу команды, добавьте туда бота.
2. Узнайте ID группы через `https://api.telegram.org/botТОКЕН/getUpdates` — `chat.id`, начинается с минуса.
3. Узнайте свой ID пользователя: напишите боту после запуска — он ответит «нет доступа» и назовёт ваш ID.

## 3. Импорт (5 минут)

В n8n: Workflows → ⋯ → Import from File → `workflows/knowledge-base-agent.n8n.json`. Так же — `workflows/error-alert.n8n.json`.

## 4. Ключи (10 минут)

- **OpenAI Chat Model** и **Embeddings** — ключ OpenAI. Для Claude — `docs/06-models.md`.
- **List Drive Files, Export Doc, Download PDF, Download Text** — ключ Google Drive OAuth2.
- **Read Sources, Read Registry, Read Documents, Write Registry, Log, Append Gap** — ключ Google Sheets OAuth2.
- **Telegram Trigger, Team Alert, Notify Team, Notify Reindex, Send Reply** — ключ Telegram.

## 5. Настройки (5 минут)

Узел **Config**:
- `company`, `audience`, `owner_contact`;
- `drive_folder_id`, `spreadsheet_id`, `team_chat_id`;
- `agent_token` — длинная случайная строка (`openssl rand -hex 24`);
- `debug_token` — ещё одна строка, для evals;
- `allowed_telegram_ids` — ваши ID через запятую, например `[123456789]`.

Error Alert: ID группы в узел **Alert**; в агенте Settings → Error workflow → Error Alert.

## 6. Публикация и первая индексация (10 минут)

1. **Publish**.
2. Запустите индексацию:

```bash
curl -X POST 'https://ВАШ-N8N/webhook/kb-reindex' -H 'x-agent-token: ВАШ_AGENT_TOKEN'
```

Ответ — `{"status": "started"}`. Через минуту в чат команды придёт «📚 Индекс обновлён · Документов: 6», а в листе `Documents` — список с кодами `d1…d6` и числом фрагментов.

3. Спросите:

```bash
curl -X POST 'https://ВАШ-N8N/webhook/kb-agent' \
  -H 'Content-Type: application/json' -H 'x-agent-token: ВАШ_AGENT_TOKEN' \
  -d '{"session_id":"test-001","message":"Как оформить отпуск?"}'
```

В ответе — `reply` со ссылкой `[1]` и списком источников, и `sources` с адресом документа в Drive.

## 7. Evals (10 минут)

```bash
python3 evals/run_evals.py --url 'https://ВАШ-N8N/webhook/kb-agent' \
  --token ВАШ_AGENT_TOKEN --debug-token ВАШ_DEBUG_TOKEN --repeat 3
```

Ориентир — 90% и выше. Разбор провалов — `docs/07-evals.md`.

## 8. Свои документы

Удалите демо-файлы из папки, положите свои, запустите переиндексацию (или дождитесь ночной). Страницы сайта или справки добавляйте строками в лист `Sources`. Затем перепишите `evals/dataset.jsonl` под свои документы.

Важно: индекс по умолчанию хранится в памяти n8n. После перезапуска n8n запустите переиндексацию — или перейдите на постоянное хранилище (`docs/05-production-store.md`).
