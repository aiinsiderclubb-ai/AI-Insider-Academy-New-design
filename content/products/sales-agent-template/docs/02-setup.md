# Настройка

Все настройки — в узле **Config**.

## Компания и тексты

| Параметр | Что это |
|---|---|
| `company`, `about` | от чьего имени говорит агент и что вы продаёте |
| `team_hours` | рабочее время менеджеров |
| `contact_fallback` | куда писать, если бот не может помочь |
| `greeting` | ответ на `/start` в Telegram |
| `currency` | валюта по умолчанию |

## Квалификация и шаги

| Параметр | Что это | По умолчанию |
|---|---|---|
| `min_budget` | бюджет от этой суммы — полные баллы | 500 |
| `large_deal_budget` | от этой суммы агент передаёт сделку менеджеру | 10 000 |
| `hot_score`, `warm_score` | пороги горячего и тёплого лида | 70, 40 |
| `booking_link` | ссылка на запись к менеджеру; пока стоит заглушка, `book_call` советует передать менеджеру | — |

## Follow-up

| Параметр | Что это | По умолчанию |
|---|---|---|
| `followup_enabled` | включён ли | `true` |
| `followup_delays_hours` | паузы перед 1-м, 2-м, 3-м касанием | 24, 72, 168 |
| `followup_stages` | каким этапам писать | new, qualifying, offer_sent |
| `followup_quiet_from`, `followup_quiet_to` | тихие часы | 20:00–09:00 |
| `followup_weekdays` | дни недели | пн–пт |
| `followup_max_per_run` | лимит сообщений за запуск | 30 |
| `email_followups` | писать на email лидам с сайта; нужен SMTP в узле **Follow-up Email** и адрес отправителя | `false` |
| `followup_messages` | тексты касаний | 3 шаблона |
| `timezone` | часовой пояс для тихих часов | Europe/Kyiv |

## Стоп-лист

`optout_words` — регулярные выражения отказа от сообщений, `optout_reply` — ответ на него.

## Таблица, чат, доступ

| Параметр | Что это |
|---|---|
| `spreadsheet_id` | Google Таблица с листами `Products`, `Facts`, `Leads`, `OptOut`, `Log` |
| `team_chat_id` | Telegram-чат отдела продаж: горячие лиды, ссылки на оплату, запросы КП, звонки, передачи |
| `agent_token` | ключ вебхука; пока стоит заглушка — вебхук отвечает 401 |
| `debug_token` | ключ для evals |
| `max_message_chars`, `rate_limit_*`, `daily_agent_runs`, `handoff_pause_minutes` | лимиты |
| `forbidden` | запрещённые обещания — `docs/05-guardrails-and-handoff.md` |
| `canary` | служебная метка инструкции — замените на свою случайную строку |

## Ключи

| Узлы | Тип ключа |
|---|---|
| OpenAI Chat Model или Anthropic Chat Model | ключ модели |
| Read Products, Read Facts, Read Leads, Write Lead, Add Opt-out, Log, Follow-up Read, Count Touch | Google Sheets OAuth2 |
| Telegram Trigger, Team Alert, Notify Team, Sales Notice, Send Reply, Follow-up Telegram | Telegram |
| Follow-up Email | SMTP — только если `email_followups: true` |

## Публикация

Работает только опубликованный воркфлоу: вебхук, Telegram, follow-up по расписанию, лимиты. **Error Alert** — сигнал, если агент упал: впишите ID чата в его узел Alert и выберите его в Settings → Error workflow агента.
