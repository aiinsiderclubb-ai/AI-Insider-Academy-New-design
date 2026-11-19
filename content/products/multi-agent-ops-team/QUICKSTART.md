# Запуск примерно за полтора часа

Сначала запустите команду на демо-данных из `templates/`, прогоните evals, потом подставьте свою базу знаний и описание услуг.

## 1. Таблица (10 минут)

1. Создайте Google Таблицу с листами `Knowledge`, `Leads`, `Tickets`, `Inbox`, `Log` — имена точно такие.
2. Импортируйте в каждый лист файл из `templates/` (Файл → Импорт → Загрузить → «Заменить текущий лист»):
   `Knowledge` ← `knowledge.csv`, `Leads` ← `leads-header.csv`, `Tickets` ← `tickets-header.csv`, `Inbox` ← `inbox-header.csv`, `Log` ← `log-header.csv`.
3. Скопируйте ID таблицы из адреса: `docs.google.com/spreadsheets/d/ЭТО_ID/edit`.

## 2. Telegram (5 минут)

1. В @BotFather создайте бота и сохраните токен.
2. Создайте группу команды и добавьте бота. ID группы: напишите в группу сообщение и откройте `https://api.telegram.org/botТОКЕН/getUpdates` — нужен `chat.id` с минусом.

Сообщения из чата команды бот не обрабатывает как клиентские.

## 3. Импорт (5 минут)

Импортируйте один из двух файлов — `workflows/multi-agent-ops-team.n8n.json` (OpenAI) или `workflows/multi-agent-ops-team-claude.n8n.json` (Claude) — и `workflows/error-alert.n8n.json`.

## 4. Ключи (15 минут)

- **OpenAI Chat Model** или **Anthropic Chat Model** — один узел на всю команду.
- **Read Knowledge, Read Leads, Read Journals, Append Ticket, Append Lead, Append Email, Log** — один ключ Google Sheets OAuth2.
- **Telegram Trigger** и все узлы Telegram (Team Alert, Send Reply, Lead Alert, Email Alert, Notify Team, Tool Error Alert) — ключ Telegram.
- **Email Trigger** — ключ IMAP почтового ящика. Если почта не нужна — правой кнопкой по узлу → Deactivate.

## 5. Настройки (15 минут)

Узел **Config**:
- `company`, `about`, `services`, `support_hours`, `contact_fallback`, `timezone`;
- `spreadsheet_id`, `team_chat_id`;
- `agent_token` и `team_token` — две разные длинные случайные строки (`openssl rand -hex 24`);
- `own_emails` — адреса вашего ящика: письма с них агент не разбирает;
- `debug_token` — ещё одна случайная строка для evals.

Время утреннего отчёта — в узле **Daily Report** (по умолчанию 9:00, часовой пояс воркфлоу — Settings → Timezone).

В воркфлоу Error Alert впишите ID группы в узел Alert, затем в команде агентов: Settings → Error workflow → Error Alert.

## 6. Публикация и проверка (15 минут)

Нажмите **Publish**. Отправьте запрос клиента:

```bash
curl -X POST 'https://ВАШ-N8N/webhook/ops-team' \
  -H 'Content-Type: application/json' \
  -H 'x-agent-token: ВАШ_AGENT_TOKEN' \
  -H 'x-agent-debug: ВАШ_DEBUG_TOKEN' \
  -d '{"session_id":"test-001","message":"Нужен бот для записи клиентов в салон, бюджет 2000 евро, старт сейчас, я владелица, anna@salon.ua"}'
```

В ответе `tools` покажет `leads_agent`, в листе `Leads` появится строка с баллом и причинами, в чат команды придёт «🔥 Горячий лид».

Запрос команды — заголовок `x-team-token` вместо `x-agent-token`:

```bash
curl -X POST 'https://ВАШ-N8N/webhook/ops-team' \
  -H 'Content-Type: application/json' \
  -H 'x-team-token: ВАШ_TEAM_TOKEN' \
  -d '{"session_id":"team-anna","message":"Отчёт за неделю"}'
```

Почту проверьте письмом в ящик: через минуту строка появится в `Inbox`.

## 7. Evals (10 минут)

```bash
python3 evals/run_evals.py --url 'https://ВАШ-N8N/webhook/ops-team' \
  --token ВАШ_AGENT_TOKEN --debug-token ВАШ_DEBUG_TOKEN --repeat 3
```

Скрипт покажет, к каким агентам ушёл каждый вопрос и что не так с провалами. Ориентир — 90% и выше. Подробно — `docs/07-evals.md`.

## 8. Своё

- Статьи — в лист `Knowledge` (`docs/04-agents.md`, раздел про поддержку).
- `services` в Config — что вы продаёте: агент по лидам опирается на это.
- Правила балла лида — `hot_lead_score`, `min_budget_eur` и код узла Lead Row.
- Сайт — `templates/chat-widget.html`: впишите адрес вебхука и `agent_token`; формат запроса для других систем — `docs/03-channels.md`.
