# Каналы

## Telegram

Заказчик пишет задание одним сообщением. Глубина — командой в начале: `/quick`, `/deep`; без команды — `default_depth`. `/start` и `/help` — подсказка.

Бот отвечает «Принял задание R-…», а через несколько минут присылает файл `R-…-тема.md` с коротким пересказом в подписи. Файл открывается в любом редакторе Markdown, в Notion, Obsidian, Google Docs (через импорт).

Писать могут только пользователи из `allowed_telegram_ids`; остальным бот называет их ID и сообщает команде.

## Вебхук

```
POST https://ВАШ-N8N/webhook/research
x-agent-token: ВАШ_AGENT_TOKEN

{
  "request": "Какие требования EU AI Act действуют для чат-ботов в 2026 году?",
  "depth": "quick",                         quick | standard | deep
  "requester": "crm-user-17",               для лимитов и журнала
  "callback_url": "https://ваш-сервер/research-done",
  "wait": false
}
```

- `wait: false` (по умолчанию) — сразу `202 {"job_id": "R-…", "status": "accepted"}`, отчёт — POST на `callback_url` и в лист Reports.
- `wait: true` — ответ приходит, когда отчёт готов (минуты). Удобно для скриптов и evals; держите таймаут клиента 10 минут и проверьте, что прокси перед n8n не рвёт долгие запросы.

Тело отчёта (в ответе при `wait` и в callback):

```json
{
  "job_id": "R-MWNX2A1B",
  "status": "ok",
  "title": "Требования EU AI Act к чат-ботам",
  "report_markdown": "# …",
  "sources": [{"n": 1, "ref": "s1a2b", "title": "…", "url": "https://…", "domain": "…", "read": true}],
  "stats": {"searches": 3, "pages": 4, "cited": 5, "domains": 4}
}
```

`status`: `ok`, `preliminary` (мало источников), `failed` (отчёт не готов). Отказ и лимит отвечают сразу: `{"status": "refused" | "limited", "reply": "…"}`.

Callback приходит с заголовком `x-agent-token` — по нему ваш сервер узнаёт, что запрос от агента. `callback_url` — только `https://`.

Ошибки: `401` — токен; `400` — короткое задание, неизвестная глубина, `callback_url` не https.
