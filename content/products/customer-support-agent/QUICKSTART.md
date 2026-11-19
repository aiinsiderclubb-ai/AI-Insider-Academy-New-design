# Запуск примерно за час

Сначала запустите агента на демо-данных из `templates/`: так вы увидите, как он работает, и сможете прогнать evals. Свою базу знаний подставите потом.

## 1. Таблица (10 минут)

1. Создайте Google Таблицу (sheets.new) с четырьмя листами: `Knowledge`, `Orders`, `Tickets`, `Log`. Имена — точно такие.
2. В каждый лист импортируйте файл: Файл → Импорт → Загрузить → «Заменить текущий лист».
   - `Knowledge` ← `templates/knowledge.csv`
   - `Orders` ← `templates/orders-example.csv`
   - `Tickets` ← `templates/tickets-header.csv`
   - `Log` ← `templates/log-header.csv`
3. Скопируйте ID таблицы из адреса: `docs.google.com/spreadsheets/d/ЭТО_ID/edit`.

## 2. Telegram (5 минут)

1. В @BotFather создайте бота (`/newbot`) и сохраните токен.
2. Создайте группу команды, добавьте туда бота.
3. Узнайте ID группы: напишите в группу любое сообщение и откройте `https://api.telegram.org/botТОКЕН/getUpdates` — нужен `chat.id`, он начинается с минуса.

## 3. Импорт (5 минут)

1. В n8n: Workflows → ⋯ → Import from File → `workflows/customer-support-agent.n8n.json`.
2. Так же импортируйте `workflows/error-alert.n8n.json`.

## 4. Ключи (10 минут)

Откройте агента. Узлы с красным треугольником ждут ключей.

- **OpenAI Chat Model** — создайте ключ OpenAI. Для Claude или другого провайдера — `docs/06-models.md`.
- **Read Knowledge, Read Orders, Append Ticket, Log** — один ключ Google Sheets OAuth2 на все четыре узла.
- **Telegram Trigger, Team Alert, Notify Team, Send Reply** — ключ Telegram с токеном бота.

## 5. Настройки (5 минут)

Откройте узел **Config** и заполните:

- `company`, `about`, `support_hours`, `contact_fallback`;
- `spreadsheet_id` — ID из шага 1;
- `team_chat_id` — ID группы из шага 2;
- `agent_token` — длинная случайная строка, например из `openssl rand -hex 24`;
- `debug_token` — ещё одна случайная строка, нужна для evals.

Остальное можно не трогать. Что значит каждый параметр — `docs/02-setup.md`.

В воркфлоу **Error Alert** впишите тот же ID группы в узел **Alert**. В агенте откройте Settings → Error workflow и выберите Error Alert.

## 6. Публикация и первая проверка (10 минут)

1. Нажмите **Publish**. Лимиты и пауза после передачи человеку хранятся в данных опубликованного воркфлоу — в ручном тестовом запуске они не сохраняются.
2. Откройте узел **Webhook** → Production URL. Отправьте запрос:

```bash
curl -X POST 'https://ВАШ-N8N/webhook/support-agent' \
  -H 'Content-Type: application/json' \
  -H 'x-agent-token: ВАШ_AGENT_TOKEN' \
  -d '{"session_id":"test-001","message":"Сколько идёт доставка по Украине?"}'
```

Ответ — `{"reply": "...1–3 дня...", "handoff": false, "session_id": "test-001"}`. В листе `Log` появилась строка.

3. Проверьте передачу человеку: тот же запрос с `"message":"Позовите менеджера"` — в группу команды придёт сообщение.

## 7. Evals (10 минут)

```bash
python3 evals/run_evals.py --url 'https://ВАШ-N8N/webhook/support-agent' \
  --token ВАШ_AGENT_TOKEN --debug-token ВАШ_DEBUG_TOKEN
```

Скрипт напечатает, какие случаи прошли и что не так с остальными. Ориентир — 90% и выше; запускайте с `--repeat 3`, чтобы увидеть нестабильные ответы. Что делать с провалами — `docs/07-evals.md`.

## 8. Каналы

- **Сайт:** вставьте `templates/chat-widget.html` перед `</body>`, впишите адрес вебхука и `agent_token`.
- **Telegram:** Telegram Trigger регистрируется при публикации. Напишите боту — он ответит.
- **Другая система** (CRM, приложение, WhatsApp) — тот же вебхук. Формат запроса и ответа — `docs/03-channels.md`.

## 9. Своя база

Замените демо-статьи в листе `Knowledge` на свои, а лист `Orders` — на свои заказы. Можно и вовсе отключить заказы — `docs/04-knowledge-base.md`. Затем поправьте `evals/dataset.jsonl` под свою базу и прогоните evals снова.
