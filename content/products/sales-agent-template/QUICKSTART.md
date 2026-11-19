# Запуск примерно за час

Сначала запустите агента на демо-каталоге из `templates/` и прогоните evals, потом подставьте свой каталог.

## 1. Таблица (10 минут)

1. Создайте Google Таблицу с пятью листами: `Products`, `Facts`, `Leads`, `OptOut`, `Log`. Имена — точно такие.
2. Импортируйте в каждый лист файл (Файл → Импорт → Загрузить → Заменить текущий лист):
   - `Products` ← `templates/products.csv`
   - `Facts` ← `templates/facts.csv`
   - `Leads` ← `templates/leads-header.csv`
   - `OptOut` ← `templates/optout-header.csv`
   - `Log` ← `templates/log-header.csv`
3. Скопируйте ID таблицы из адреса: `docs.google.com/spreadsheets/d/ЭТО_ID/edit`.

## 2. Telegram (5 минут)

1. В @BotFather создайте бота (`/newbot`), сохраните токен.
2. Создайте группу отдела продаж и добавьте бота. ID группы: напишите в неё сообщение и откройте `https://api.telegram.org/botТОКЕН/getUpdates` — нужен `chat.id`, он начинается с минуса.

## 3. Импорт и ключи (15 минут)

1. Workflows → ⋯ → Import from File → `workflows/sales-agent-template.n8n.json`; так же `workflows/error-alert.n8n.json`.
2. Ключи:
   - **OpenAI Chat Model** — ключ OpenAI (или Claude — `docs/06-models.md`);
   - узлы Google Sheets — один ключ Google Sheets OAuth2 (список — `docs/02-setup.md`);
   - узлы Telegram — ключ с токеном бота;
   - **Follow-up Email** — только если нужен follow-up на email.

## 4. Config (10 минут)

- `company`, `about`, `team_hours`, `contact_fallback`, `currency`;
- `spreadsheet_id`, `team_chat_id`;
- `booking_link` — ваша ссылка Cal.com, Calendly или наш Appointment Booking Agent;
- `agent_token`, `debug_token` — две длинные случайные строки (`openssl rand -hex 24`);
- `min_budget`, `large_deal_budget` — под ваши чеки;
- `followup_messages` — свои тексты касаний.

В Error Alert впишите ID группы в узел Alert; в агенте — Settings → Error workflow → Error Alert.

## 5. Публикация и проверка (10 минут)

1. **Publish.**
2. Запрос в Production URL узла Webhook:

```bash
curl -X POST 'https://ВАШ-N8N/webhook/sales-agent' \
  -H 'Content-Type: application/json' \
  -H 'x-agent-token: ВАШ_AGENT_TOKEN' \
  -d '{"session_id":"test-0001","message":"Нужна CRM для отдела из 4 менеджеров"}'
```

Агент должен предложить тариф из демо-каталога с ценой. Продолжайте с тем же `session_id`: бюджет, сроки, «решаю я». В листе `Leads` должна появиться строка с баллами, а когда баллов наберётся 70 — карточка «Горячий лид» в чате продаж. Напишите «готов оплатить» — агент даст ссылку из таблицы.

3. Напишите боту в Telegram. Через сутки тишины (в рабочее время) он напомнит о себе; «стоп» — и больше не напишет.

## 6. Evals (10 минут)

```bash
python3 evals/run_evals.py --url 'https://ВАШ-N8N/webhook/sales-agent' \
  --token ВАШ_AGENT_TOKEN --debug-token ВАШ_DEBUG_TOKEN
```

Подробно — `docs/07-evals.md`. После прогона удалите из `Leads` строки `web:eval-…`.

## 7. Свой каталог

Замените `Products` и `Facts` своими данными — `docs/04-qualification.md` объясняет колонки. Одобренные ответы — только правдивые. Поправьте `evals/dataset.jsonl` под свой каталог и прогоните evals снова. Сайт — `templates/chat-widget.html` перед `</body>`.
