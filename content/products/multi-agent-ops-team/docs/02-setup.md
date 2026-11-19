# Настройка

Все настройки — в узле **Config**.

## Параметры

| Параметр | Что это | По умолчанию |
|---|---|---|
| `company`, `about` | от чьего имени говорят агенты | — |
| `services` | что вы продаёте и для кого; агент по лидам опирается на это | — |
| `support_hours` | рабочее время людей — агенты называют его при передаче | `пн–пт 9:00–18:00 (Киев)` |
| `contact_fallback` | куда писать, если бот не отвечает | `hello@example.com` |
| `timezone` | часовой пояс отчётов | `Europe/Kyiv` |
| `spreadsheet_id`, `team_chat_id` | таблица и чат команды | — |
| `agent_token` | ключ для сайта и систем | — |
| `team_token` | ключ команды: только с ним доступен агент отчётов | — |
| `own_emails` | ваши адреса; письма с них не разбираются | — |
| `email_notify` | `urgent` — команде только срочные и важные письма; `all` — сводка по каждому | `urgent` |
| `hot_lead_score` | с какого балла лид горячий | 70 |
| `min_budget_eur` | бюджет, дающий полный балл за бюджет | 1000 |
| `max_message_chars` | длиннее — обрезается | 4000 |
| `rate_limit_messages`, `rate_limit_minutes` | лимит сообщений одного клиента (сайт, Telegram) | 20 за 10 минут |
| `daily_agent_runs` | потолок запусков оркестратора в сутки | 1000 |
| `agent_budgets` | дневной лимит вызовов каждого агента | 300 / 300 / 500 / 20 |
| `handoff_pause_minutes` | сколько бот молчит в диалоге после передачи человеку | 30 |
| `kb_min_score` | порог поиска по базе знаний | 0.3 |
| `forbidden` | запрещённые обещания (регулярные выражения) | деньги, скидки, гарантии |
| `canary` | служебная метка в инструкциях — замените на свою строку | `OPS-73-CANARY` |
| `debug_token` | ключ для evals | пусто |

Пока в `agent_token` и `team_token` стоят заглушки, вебхук отвечает 401.

## Листы

**Knowledge** — `id | question | answer | tags | updated` — база знаний агента поддержки.

**Leads** — `created | lead_id | score | hot | name | contact | company | need | budget_eur | timeline | decision_maker | channel | session_id | status | score_reasons`. Статус `new` или `повтор L-…`; дальше ведите его сами.

**Tickets** — `created | ticket_id | status | priority | topic | summary | name | contact | channel | session_id`.

**Inbox** — `received | from | subject | category | priority | summary | draft_reply | status | session_id`. Статус `draft` — черновик ждёт человека; `spam` — без черновика.

**Log** — `time | session_id | channel | message | reply | agents | handoff | flags | trace`.

Воркфлоу пишет колонки по порядку, а читает по заголовкам — не переставляйте колонки и не переименовывайте листы.

## Ключи

| Узлы | Ключ |
|---|---|
| OpenAI Chat Model / Anthropic Chat Model | ключ модели |
| Read Knowledge, Read Leads, Read Journals, Append Ticket, Append Lead, Append Email, Log | Google Sheets OAuth2 |
| Telegram Trigger, Team Alert, Send Reply, Lead Alert, Email Alert, Notify Team, Tool Error Alert | Telegram |
| Email Trigger | IMAP |

## Публикация

Работает только опубликованный воркфлоу: без этого не отвечает Production URL, не приходят сообщения Telegram и почта, не запускается расписание и не сохраняются лимиты.

Error Alert ловит падения воркфлоу целиком. Сбои таблицы внутри инструментов воркфлоу не роняют — о них сообщает Tool Error Alert.
