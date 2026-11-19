# Настройка

Все настройки — в узле **Config**.

| Параметр | Что это | По умолчанию |
|---|---|---|
| `company` | чья база; попадает в инструкцию | — |
| `audience` | кто спрашивает: сотрудники, клиенты, партнёры | `сотрудники компании` |
| `owner_contact` | к кому идти, если ответа нет; агент называет это в ответе | — |
| `drive_folder_id` | папка Google Drive с документами (без подпапок) | — |
| `spreadsheet_id` | таблица с листами Documents, Sources, Gaps, Log | — |
| `index_key` | имя индекса; разные имена — если в одном n8n несколько баз | `kb_main` |
| `chunk_size`, `chunk_overlap` | размер фрагмента и перекрытие, символов | 1200 / 200 |
| `max_doc_chars` | длиннее — документ обрезается при индексации (пометка «обрезан» в реестре) | 300 000 |
| `search_top_k` | сколько фрагментов достаёт поиск | 8 |
| `max_passages` | сколько из них уходит модели | 5 |
| `min_score` | порог близости 0–1; ниже — «в документах нет» | 0.35 |
| `team_chat_id` | Telegram-чат команды | — |
| `allowed_telegram_ids` | кто может спрашивать в Telegram. Пусто — никто | `[]` |
| `agent_token` | ключ вебхуков `/kb-agent` и `/kb-reindex`. С заглушкой вебхуки отвечают 401 | — |
| `max_message_chars`, `rate_limit_*`, `daily_agent_runs` | ограничения | 2000; 30 за 10 мин; 2000 в сутки |
| `handoff_pause_minutes` | сколько бот молчит в диалоге после передачи человеку | 30 |
| `canary` | служебная метка в инструкции; замените на свою | `KB-57-CANARY` |
| `debug_token` | ключ для evals | пусто |

## Листы таблицы

- **Documents** — реестр индекса, его пишет переиндексация: `code | title | url | source_id | modified | chunks | chars | status | indexed_at`. Руками не правьте — перезапишется.
- **Sources** — страницы по ссылкам: `url | title | enabled`. `enabled` = «нет» выключает строку. Пустой `title` — возьмётся заголовок страницы.
- **Gaps** — вопросы, на которые в документах нет ответа: `time | question | queries | status | session_id`.
- **Log** — журнал ответов.

## Ключи

| Узлы | Ключ |
|---|---|
| OpenAI Chat Model, Embeddings | OpenAI (или совместимый — с Base URL) |
| Anthropic Chat Model | Anthropic — если ответы на Claude |
| List Drive Files, Export Doc, Download PDF, Download Text | Google Drive OAuth2 |
| Read Sources, Read Registry, Read Documents, Write Registry, Log, Append Gap | Google Sheets OAuth2 |
| Telegram Trigger, Team Alert, Notify Team, Notify Reindex, Send Reply | Telegram |

Ключ Google Drive должен видеть папку: подключайте аккаунт, у которого к ней есть доступ, или дайте этому аккаунту доступ к папке.

## Расписание

Узел **Every Night** — каждый день в 3:00 по часовому поясу n8n (Settings → Timezone у воркфлоу). Меняется в самом узле. Если документы меняются редко — раз в неделю достаточно; запуск по запросу всегда доступен.

## Публикация

Работает только опубликованный воркфлоу: Production URL, Telegram Trigger, расписание и счётчики лимитов.
