# Запуск примерно за час

Для первого запуска возьмите отдельный тестовый календарь: так evals и пробные записи не попадут в рабочий.

## 1. Календарь и таблица (10 минут)

1. В Google Календаре создайте календарь «Записи (тест)»: Настройки → Добавить календарь → Создать. В его настройках, раздел «Интеграция», скопируйте **Идентификатор календаря**.
2. Создайте Google Таблицу с листом `Log` и импортируйте в него `templates/log-header.csv` (Файл → Импорт → Заменить текущий лист). Скопируйте ID таблицы из адреса: `docs.google.com/spreadsheets/d/ЭТО_ID/edit`.

## 2. Telegram (5 минут)

1. В @BotFather создайте бота (`/newbot`), сохраните токен.
2. Создайте группу команды и добавьте туда бота. ID группы: напишите в группу сообщение и откройте `https://api.telegram.org/botТОКЕН/getUpdates` — нужен `chat.id`, он начинается с минуса.

## 3. Импорт и ключи (15 минут)

1. В n8n: Workflows → ⋯ → Import from File → `workflows/appointment-booking-agent.n8n.json`. Так же — `workflows/error-alert.n8n.json`.
2. Ключи в узлах с красным треугольником:
   - **OpenAI Chat Model** — ключ OpenAI (или Claude — `docs/06-models.md`);
   - **Calendar Read, Calendar Write, Reminders Read, Mark Reminded** — один ключ Google Calendar OAuth2;
   - **Log** — Google Sheets OAuth2;
   - **Telegram Trigger, Team Alert, Notify Team, Booking Notice, Send Reply, Telegram Reminder** — ключ Telegram.
   - **Email Reminder** — только если нужны напоминания на email.

## 4. Config (15 минут)

Откройте узел **Config** и заполните:

- `company`, `about`, `team_hours`, `contact_fallback`, `greeting`;
- `timezone` — ваш часовой пояс, например `Europe/Warsaw`;
- `calendar_id` — идентификатор из шага 1;
- `hours`, `closed_dates`, `buffer_min`, `lead_time_min` — ваше расписание;
- `services` — ваши услуги: `id` латиницей без пробелов, название, длительность в минутах, цена текстом;
- `meeting_link` или `create_meet: true`, либо `address`;
- `spreadsheet_id`, `team_chat_id`;
- `agent_token` и `debug_token` — две разные длинные случайные строки (`openssl rand -hex 24`).

В Error Alert впишите ID группы в узел Alert; в агенте — Settings → Error workflow → Error Alert.

## 5. Публикация и проверка (10 минут)

1. **Publish.**
2. Запрос в Production URL узла Webhook:

```bash
curl -X POST 'https://ВАШ-N8N/webhook/booking-agent' \
  -H 'Content-Type: application/json' \
  -H 'x-agent-token: ВАШ_AGENT_TOKEN' \
  -d '{"session_id":"test-0001","message":"Хочу на знакомство завтра утром"}'
```

Агент предложит время. Продолжайте с тем же `session_id`: выберите вариант, назовите имя и email, ответьте «да». В тестовом календаре появится событие, в группе команды — сообщение «Новая запись», в ответе — `booking_code`.

3. Напишите боту в Telegram — он ответит в чате.

## 6. Evals (10 минут)

```bash
python3 evals/run_evals.py --url 'https://ВАШ-N8N/webhook/booking-agent' \
  --token ВАШ_AGENT_TOKEN --debug-token ВАШ_DEBUG_TOKEN
```

Случай `full-booking` создаёт запись в календаре — поэтому сначала тестовый календарь. Подробно — `docs/07-evals.md`.

## 7. В работу

- Поменяйте `calendar_id` на рабочий календарь.
- Сайт: вставьте `templates/chat-widget.html` перед `</body>`, впишите адрес вебхука и `agent_token`.
- Удалите тестовые записи из тестового календаря.
