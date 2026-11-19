# Настройка

Все настройки — в узле **Config**. Меняйте значения справа от двоеточия, кавычки оставляйте.

## Параметры Config

| Параметр | Что это | По умолчанию |
|---|---|---|
| `company` | название, от имени которого говорит агент | — |
| `about` | чем занимается компания, одним предложением; попадает в инструкцию | — |
| `support_hours` | рабочее время поддержки — агент называет его при передаче человеку | `пн–пт 9:00–18:00 (Киев)` |
| `contact_fallback` | куда писать, если бот не может ответить (лимит) | `support@example.com` |
| `spreadsheet_id` | ID Google Таблицы | — |
| `team_chat_id` | ID Telegram-чата команды | — |
| `agent_token` | ключ доступа к вебхуку. Пока здесь стоит заглушка, вебхук отвечает 401 на всё | — |
| `max_message_chars` | длиннее — обрезается | 2000 |
| `rate_limit_messages`, `rate_limit_minutes` | сколько сообщений один клиент может прислать за окно | 20 за 10 минут |
| `daily_agent_runs` | сколько раз в сутки (UTC) агент может обратиться к модели. Дальше — передача человеку | 1000 |
| `handoff_pause_minutes` | сколько бот молчит в диалоге после передачи человеку. Каждое новое сообщение клиента продлевает паузу | 30 |
| `kb_min_score` | порог поиска по базе, 0–1 — `docs/04-knowledge-base.md` | 0.3 |
| `forbidden` | регулярные выражения запрещённых обещаний — `docs/05-guardrails-and-handoff.md` | возврат денег, скидки, компенсации, гарантии |
| `canary` | служебная метка в инструкции. Замените на свою случайную строку | `KX-91-CANARY` |
| `debug_token` | ключ для evals. Пусто — режим выключен | пусто |

## Листы таблицы

Имена листов и порядок колонок важны: воркфлоу читает колонки по заголовкам первой строки, а пишет по порядку.

**Knowledge** — `id | question | answer | tags | updated`
Одна строка — одна статья. Подробно — `docs/04-knowledge-base.md`.

**Orders** — `order_id | email | phone | status | items | total | carrier | tracking | eta | updated`
Агент читает до 10 000 строк. Для больших магазинов подключите API магазина — `docs/04-knowledge-base.md`.

**Tickets** — `created | ticket_id | status | priority | topic | summary | name | contact | channel | session_id`
Агент только добавляет строки. Статус меняйте сами: `open` → `in progress` → `done`.

**Log** — `time | session_id | channel | message | reply | tools | handoff | flags | ticket_id`
Журнал всех ответов — `docs/08-operations.md`.

## Ключи

| Узлы | Тип ключа |
|---|---|
| OpenAI Chat Model | OpenAI (для совместимых API — тот же тип, с Base URL) |
| Anthropic Chat Model | Anthropic — если работаете на Claude |
| Read Knowledge, Read Orders, Append Ticket, Log | Google Sheets OAuth2 |
| Telegram Trigger, Team Alert, Notify Team, Send Reply | Telegram |

Узлы Google подключены через HTTP Request с готовым ключом Google Sheets: так воркфлоу читает и пишет лист одним запросом, без лишних шагов.

## Публикация

Агент работает только опубликованным (Publish). У неопубликованного:
- Production URL вебхука не отвечает;
- Telegram Trigger не получает сообщения;
- лимиты и паузы не сохраняются между запросами.

## Сигнал об ошибке

Воркфлоу **Error Alert** сообщает в Telegram, если агент упал: таблица недоступна, у ключа модели кончились деньги, Telegram отклонил сообщение. Впишите ID чата в его узел Alert, затем в агенте: Settings → Error workflow → Error Alert.

Модель, которая не ответила, агента не роняет: Guard Out видит пустой ответ, отвечает клиенту «передал менеджеру» и шлёт сигнал команде.
