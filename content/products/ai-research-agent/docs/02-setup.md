# Настройка

Все настройки — в узле **Config**.

| Параметр | Что это | По умолчанию |
|---|---|---|
| `company`, `focus` | от чьего имени и о чём обычно исследования; попадают в инструкцию | — |
| `depths` | бюджет по глубине: поисков и страниц | quick 3/4, standard 6/8, deep 10/15 |
| `default_depth` | глубина, если не указана | `standard` |
| `results_per_search` | результатов поиска на один запрос | 6 |
| `max_page_chars` | столько символов страницы получает модель | 12 000 |
| `min_sources` | меньше разных доменов в отчёте — «предварительный» | 3 |
| `blocked_domains` | никогда не показывать модели | соцсети, Pinterest, Quora |
| `preferred_domains` | показывать первыми | пусто |
| `search_topic` | `general` или `news` | `general` |
| `spreadsheet_id` | таблица с листом Reports | — |
| `team_chat_id` | чат команды | — |
| `allowed_telegram_ids` | кто может заказывать в Telegram. Пусто — никто | `[]` |
| `agent_token` | ключ вебхука. С заглушкой вебхук отвечает 401 | — |
| `min_request_chars`, `max_request_chars` | длина задания | 15 / 2000 |
| `jobs_per_requester_per_day`, `daily_jobs` | лимиты заданий | 20 / 100 |
| `allow_private_hosts` | только для тестов: разрешить адреса локальной сети. В работе — `false` | `false` |
| `canary` | служебная метка в инструкции; замените на свою | `RS-33-CANARY` |
| `debug_token` | ключ для evals | пусто |

## Ключи

| Узлы | Ключ |
|---|---|
| Search API | Header Auth: `Authorization` = `Bearer tvly-…` |
| OpenAI Chat Model | OpenAI (или совместимый — с Base URL) |
| Anthropic Chat Model | Anthropic — если работаете на Claude |
| Save Report | Google Sheets OAuth2 |
| все узлы Telegram | Telegram |

## Публикация

Работает только опубликованный воркфлоу. Лимиты заданий хранятся в статических данных опубликованного воркфлоу.
