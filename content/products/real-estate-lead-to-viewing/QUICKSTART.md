# Запуск примерно за два часа

Сначала запустите агента на демо-объектах из `templates/listings.csv` и тестовых календарях, прогоните evals, потом подставьте свою базу и риелторов.

## 1. Таблица (10 минут)

1. Создайте Google Таблицу с листами `Listings`, `Leads`, `Viewings`, `Log` — имена точно такие.
2. Импортируйте (Файл → Импорт → «Заменить текущий лист»): `Listings` ← `templates/listings.csv`, `Leads` ← `leads-header.csv`, `Viewings` ← `viewings-header.csv`, `Log` ← `log-header.csv`.
3. Скопируйте ID таблицы из адреса.

## 2. Календари (15 минут)

У каждого риелтора — Google Календарь. Для начала можно создать три тестовых календаря в своём аккаунте (Google Календарь → Другие календари → Создать). ID календаря — в его настройках, раздел «Интеграция календаря»; для основного календаря это email.

Ключ Google Calendar в n8n должен иметь доступ на запись ко всем этим календарям: если календари чужие, риелторы делятся ими с аккаунтом ключа с правом «Вносить изменения».

## 3. Telegram (5 минут)

Бот в @BotFather, группа агентства с ботом, ID группы через `getUpdates`. Личные чаты риелторов — по желанию: риелтор пишет боту, его `chat.id` — в `chat_id` в Config.

## 4. Импорт и ключи (20 минут)

1. Импортируйте `workflows/real-estate-lead-to-viewing.n8n.json` и `workflows/error-alert.n8n.json`.
2. Ключи:
   - **OpenAI Chat Model** — ключ модели (для Claude — `docs/06-models.md`);
   - Google Sheets OAuth2 — все узлы `Read …`, `Save …`, `Append Viewing`, `Update Lead`, `Log`;
   - Google Calendar OAuth2 — `Free Busy`, `Find Existing`, `Recheck Busy`, `Create Event`;
   - Telegram — Telegram Trigger и все узлы Telegram.

## 5. Config (20 минут)

- агентство: `company`, `about`, `city`, `support_hours`, `contact_fallback`, `timezone`, `currency`, `phone_country`, `mortgage_partner`;
- `spreadsheet_id`, `team_chat_id`;
- `agents` — риелторы: `id` (как в колонке `agent_id` листа Listings), имя, `calendar_id`, `chat_id`, районы и типы сделок;
- `viewing_hours`, `viewing_minutes`, `buffer_minutes`, `lead_time_minutes` — когда можно смотреть;
- `agent_token` и `debug_token` — две случайные строки (`openssl rand -hex 24`).

Error Alert: ID чата в узел Alert; в агенте Settings → Error workflow → Error Alert.

## 6. Публикация и проверка (20 минут)

**Publish**, затем разговор от лица клиента — один `session_id` на весь диалог:

```bash
URL='https://ВАШ-N8N/webhook/realty-agent'
H='x-agent-token: ВАШ_AGENT_TOKEN'
curl -s -X POST "$URL" -H 'Content-Type: application/json' -H "$H" \
  -d '{"session_id":"test-001","message":"Хочу купить 2-комнатную на Печерске до 150 тысяч долларов, наличными, в этом месяце. Анна, +380501112233"}'
curl -s -X POST "$URL" -H 'Content-Type: application/json' -H "$H" \
  -d '{"session_id":"test-001","message":"Покажите варианты"}'
curl -s -X POST "$URL" -H 'Content-Type: application/json' -H "$H" \
  -d '{"session_id":"test-001","message":"Хочу посмотреть KV-101 в ближайшие дни"}'
```

Агент предложит время. Ответьте выбранным временем, затем «Да, записывайте» — в календаре риелтора появится событие, в листе `Viewings` строка, в Telegram сообщение «Просмотр записан». В `Leads` — карточка с баллом, риелтором и этапом `viewing_booked`.

## 7. Evals (15 минут)

```bash
python3 evals/run_evals.py --url 'https://ВАШ-N8N/webhook/realty-agent' \
  --token ВАШ_AGENT_TOKEN --debug-token ВАШ_DEBUG_TOKEN --repeat 3
```

Случаи написаны под демо-объекты. Ориентир — 90% и выше; что делать с провалами — `docs/07-evals.md`.

## 8. Своё

1. Перенесите объекты в `Listings` по правилам из `agent/matching-and-presentation.md`.
2. Риелторы и календари — в Config.
3. Порталы и CRM — `docs/03-channels.md`; сайт — `templates/chat-widget.html`.
4. Дашборд — `docs/08-kpi-dashboard.md`.
5. Поправьте `evals/dataset.jsonl` под свою базу и прогоните evals снова.
