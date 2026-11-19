# Запуск примерно за 45 минут

## 1. Таблица и Telegram (10 минут)

1. Создайте Google Таблицу с листом `Reports` и импортируйте в него `templates/reports-header.csv`. Скопируйте ID таблицы из адреса.
2. Создайте бота в @BotFather и группу команды с ботом. ID группы — через `https://api.telegram.org/botТОКЕН/getUpdates` (`chat.id`, с минусом).

## 2. Ключи (10 минут)

1. Зарегистрируйтесь на tavily.com и создайте API-ключ (`tvly-…`).
2. Импортируйте `workflows/ai-research-agent.n8n.json` и `workflows/error-alert.n8n.json`.
3. Узел **Search API** → Credential → Header Auth: Name `Authorization`, Value `Bearer tvly-ВАШ_КЛЮЧ`.
4. **OpenAI Chat Model** — ключ OpenAI (для Claude — `docs/06-models.md`).
5. **Save Report** — Google Sheets OAuth2.
6. **Telegram Trigger, Send Ack, Send Report, Team Alert, Team Alert (Canned), Send Canned, Notify Team** — ключ Telegram.

## 3. Настройки (5 минут)

Узел **Config**: `company`, `focus`, `spreadsheet_id`, `team_chat_id`, `agent_token` (`openssl rand -hex 24`), `debug_token`, `allowed_telegram_ids` — ваши ID. Свой ID бот назовёт, если написать ему до того, как вы добавили себя.

Error Alert: ID группы в **Alert**; в агенте Settings → Error workflow → Error Alert.

## 4. Первое исследование (10 минут)

**Publish**, затем в Telegram боту:

```
/quick Какие требования EU AI Act действуют для чат-ботов в 2026 году?
```

Бот ответит «Принял задание R-…», через несколько минут пришлёт файл `.md` с отчётом и коротким пересказом в подписи.

Или через вебхук, с ответом сразу в запросе:

```bash
curl -X POST 'https://ВАШ-N8N/webhook/research' \
  -H 'Content-Type: application/json' -H 'x-agent-token: ВАШ_AGENT_TOKEN' \
  -d '{"request":"Какие требования EU AI Act действуют для чат-ботов в 2026 году?","depth":"quick","wait":true}' \
  --max-time 600
```

## 5. Evals (10 минут и дольше)

```bash
python3 evals/run_evals.py --url 'https://ВАШ-N8N/webhook/research' \
  --token ВАШ_AGENT_TOKEN --debug-token ВАШ_DEBUG_TOKEN
```

12 заданий глубины quick — это до 36 поисков и 48 страниц из вашего лимита Tavily. Подробно — `docs/07-evals.md`.
