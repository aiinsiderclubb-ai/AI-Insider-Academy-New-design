# Состав набора

```
ai-research-agent/
├── README.md                    что это и что умеет
├── QUICKSTART.md                запуск примерно за 45 минут
├── CONTENTS.md                  этот файл
├── agent/
│   ├── system-prompt.md         инструкция: порядок работы, формат отчёта, запреты
│   ├── tools.openai.json        схемы трёх инструментов, формат OpenAI
│   └── tools.anthropic.json     те же схемы, формат Anthropic
├── workflows/
│   ├── ai-research-agent.n8n.json   агент, инструменты, доставка отчёта
│   └── error-alert.n8n.json         сигнал об ошибке в Telegram
├── templates/
│   └── reports-header.csv       заголовки листа Reports
├── evals/
│   ├── dataset.jsonl            12 заданий
│   └── run_evals.py             прогон (Python 3.8+, без пакетов)
└── docs/
    ├── 01-how-it-works.md       задание от начала до отчёта
    ├── 02-setup.md              параметры Config
    ├── 03-channels.md           Telegram, вебхук, callback, ожидание ответа
    ├── 04-search-and-sources.md Tavily и замена поиска, правила источников
    ├── 05-guardrails.md         защита, отказы, передача людям
    ├── 06-models.md             модели и расход
    ├── 07-evals.md              как проверять агента
    └── 08-operations.md         лист Reports, сигналы, неполадки
```

## Узлы

| Узел | Что делает |
|---|---|
| Webhook, Telegram Trigger, Tool Call → Config → Kind | задания и вызовы инструментов |
| Guard In → Route | доступ, токен, формат, запрещённые темы, лимиты, бюджет по глубине |
| Ack Channel → Wait? → Respond Accepted / Send Ack | «принял задание» |
| AI Agent + Chat Model | агент; потолок шагов = поиски + страницы + 4 |
| web_search, fetch_page, handoff_to_human | инструменты |
| Guard Out | ссылки, список источников, число доменов, бюджет, утечка инструкции |
| Report File → Deliver → Send Report | отчёт файлом в Telegram |
| Report Row → Wait Reply? → Respond Report → Callback? → Callback → Save Report → Alert Team? → Team Alert | ответ, callback, лист Reports, сигнал команде |
| Canned → … → Respond Canned / Send Canned | отказ, лимит, помощь, «нет доступа» |
| Search API → Search Results | поиск Tavily и фильтр доменов |
| Page Guard → Allowed? → Fetch Page → Page Text / Page Refused | проверка адреса, чтение и очистка страницы |
