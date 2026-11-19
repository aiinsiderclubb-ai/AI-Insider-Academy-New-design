# Настройка

Все настройки — в узле **Config**.

| Параметр | Что это |
|---|---|
| `company` | название — в письме лиду и в инструкции модели |
| `offer` | что вы продаёте и кому, одним предложением |
| `ideal_customer` | идеальный клиент: отрасли, размер, задачи, кто не подходит. Самый важный текст для оценки `fit` |
| `agent_token` | ключ вебхука; пока стоит заглушка — вебхук отвечает 401 |
| `debug_token` | с заголовком `x-agent-debug` ответ содержит полную оценку — для evals |
| `spreadsheet_id` | Google Таблица с листом `Leads` |
| `dedupe_days` | сколько дней повторная заявка считается тем же лидом (90) |
| `phone_country_code`, `phone_national_prefix` | для номеров без кода страны: `050…` → `+38050…` |
| `research_website` | `false` — модель не открывает сайты, оценивает по форме |
| `max_pages`, `page_chars` | сколько страниц сайта и сколько текста страницы получает модель (3 и 4000) |
| `fetch_allow_private` | не включайте: разрешает открывать внутренние адреса |
| `rubric`, `hot_score`, `warm_score`, `disqualify_flags` | баллы — `docs/04-scoring.md` |
| `owners`, `enterprise_sizes`, `enterprise_budget` | менеджеры и сегменты — `docs/04-scoring.md` |
| `team_chat_id` | чат отдела: горячие лиды, лиды без менеджера, «проверьте вручную», сбои CRM |
| `clarify_by_email`, `clarify_from_name`, `clarify_tiers` | письмо лиду с вопросами |
| `free_email_domains` | бесплатные почты: не дают баллов за корпоративную почту и не считаются доменом компании |

## Ключи

| Узлы | Тип ключа |
|---|---|
| OpenAI Chat Model или Anthropic Chat Model | ключ модели |
| Read CRM, Write CRM | Google Sheets OAuth2 |
| Notify | Telegram — бот, которому менеджеры написали `/start` |
| Clarify Email | SMTP — только если `clarify_by_email: true` |

## Публикация

Работает только опубликованный воркфлоу: Production URL вебхука, счётчик распределения по кругу, защита от двойного клика. **Error Alert** — сигнал, если воркфлоу упал: впишите ID чата в его узел Alert и выберите его в Settings → Error workflow.
