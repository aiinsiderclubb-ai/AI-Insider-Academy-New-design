# Состав набора

```
sales-agent-template/
├── README.md                     что это и что умеет
├── QUICKSTART.md                 запуск примерно за час
├── CONTENTS.md                   этот файл
├── agent/
│   ├── system-prompt.md          системная инструкция; она же в узле AI Agent
│   ├── tools.openai.json         схемы шести инструментов, формат OpenAI
│   └── tools.anthropic.json      те же схемы, формат Anthropic
├── workflows/
│   ├── sales-agent-template.n8n.json   агент, стоп-лист, follow-up, журнал
│   └── error-alert.n8n.json            сигнал об ошибке в Telegram
├── templates/
│   ├── products.csv              демо-каталог: 5 позиций
│   ├── facts.csv                 10 одобренных ответов на возражения
│   ├── leads-header.csv          заголовки листа Leads
│   ├── optout-header.csv         заголовки листа OptOut
│   ├── log-header.csv            заголовки листа Log
│   └── chat-widget.html          чат-виджет для сайта
├── evals/
│   ├── dataset.jsonl             21 случай
│   └── run_evals.py              прогон на вашем агенте (Python 3.8+, без пакетов)
└── docs/
    ├── 01-how-it-works.md        путь сообщения, инструменты, follow-up
    ├── 02-setup.md               параметры Config, ключи, публикация
    ├── 03-channels.md            сайт, Telegram, API
    ├── 04-qualification.md       баллы, листы, каталог, одобренные ответы, follow-up, стоп-лист
    ├── 05-guardrails-and-handoff.md  что проверяет код, запреты, передача менеджеру
    ├── 06-models.md              OpenAI, совместимые API, Claude; расход токенов
    ├── 07-evals.md               как проверять агента
    └── 08-operations.md          ежедневная работа, журнал, приватность, неполадки
```
