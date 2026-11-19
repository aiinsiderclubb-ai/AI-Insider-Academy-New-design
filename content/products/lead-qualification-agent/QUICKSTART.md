# Запуск примерно за час

## 1. Таблица (5 минут)

Создайте Google Таблицу с листом `Leads` и импортируйте в него `templates/leads-header.csv` (Файл → Импорт → Заменить текущий лист). Скопируйте ID таблицы из адреса: `docs.google.com/spreadsheets/d/ЭТО_ID/edit`.

## 2. Telegram (10 минут)

1. В @BotFather создайте бота (`/newbot`), сохраните токен.
2. Каждый менеджер пишет боту `/start`. Создайте группу отдела и добавьте туда бота.
3. Откройте `https://api.telegram.org/botТОКЕН/getUpdates` — там `chat.id` менеджеров (положительные числа) и группы (с минусом).

## 3. Импорт и ключи (10 минут)

1. Workflows → ⋯ → Import from File → `workflows/lead-qualification-agent.n8n.json`; так же `workflows/error-alert.n8n.json`.
2. Ключи:
   - **OpenAI Chat Model** — ключ OpenAI (или Claude — `docs/06-models.md`);
   - **Read CRM**, **Write CRM** — Google Sheets OAuth2;
   - **Notify** — ключ Telegram с токеном бота;
   - **Clarify Email** — только если включите письма.

## 4. Config (20 минут)

Самое важное — описать, кого вы ищете:

- `company`, `offer` — что вы продаёте и кому;
- `ideal_customer` — отрасли, размер, задачи и кто не подходит. Чем конкретнее, тем точнее оценка;
- `owners` — менеджеры: `id`, имя, `chat_id`, сегменты;
- `team_chat_id` — группа отдела;
- `spreadsheet_id`;
- `agent_token`, `debug_token` — две длинные случайные строки (`openssl rand -hex 24`);
- `rubric`, `hot_score`, `warm_score` — можно оставить как есть и поправить после первых недель (`docs/04-scoring.md`).

В Error Alert впишите ID группы в узел Alert; в воркфлоу — Settings → Error workflow → Error Alert.

## 5. Публикация и проверка (10 минут)

1. **Publish.**
2. Отправьте тестовую заявку с отчётом:

```bash
curl -X POST 'https://ВАШ-N8N/webhook/lead-qualification' \
  -H 'Content-Type: application/json' \
  -H 'x-agent-token: ВАШ_AGENT_TOKEN' -H 'x-agent-debug: ВАШ_DEBUG_TOKEN' \
  -d '{"name":"Тест","email":"test@example.com","company":"Example","website":"example.com","message":"Нужна CRM для отдела продаж на 15 человек в этом месяце","budget":"3000"}'
```

В ответе — баллы, причины, оценка модели, менеджер. В листе `Leads` — строка, у менеджера — карточка.

3. Без заголовка `x-agent-debug` форма получит только `202 {"ok": true, "lead_id": "…"}` — так и должно быть.

## 6. Формы

`templates/lead-form.html` — готовая форма; Tilda, Webflow, WordPress и другие — `docs/03-forms.md`.

## 7. Evals

На тестовой таблице и с тестовыми `chat_id`:

```bash
python3 evals/run_evals.py --url 'https://ВАШ-N8N/webhook/lead-qualification' \
  --token ВАШ_AGENT_TOKEN --debug-token ВАШ_DEBUG_TOKEN
```

Подробно — `docs/07-evals.md`.
