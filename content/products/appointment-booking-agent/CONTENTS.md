# Состав набора

```
appointment-booking-agent/
├── README.md                     что это и что умеет
├── QUICKSTART.md                 запуск примерно за час
├── CONTENTS.md                   этот файл
├── agent/
│   ├── system-prompt.md          системная инструкция; она же вставлена в узел AI Agent
│   ├── tools.openai.json         схемы семи инструментов, формат OpenAI
│   └── tools.anthropic.json      те же схемы, формат Anthropic
├── workflows/
│   ├── appointment-booking-agent.n8n.json   агент, календарь, напоминания
│   └── error-alert.n8n.json                 сигнал об ошибке в Telegram
├── templates/
│   ├── chat-widget.html          чат-виджет для сайта
│   └── log-header.csv            заголовки листа Log
├── evals/
│   ├── dataset.jsonl             20 случаев
│   └── run_evals.py              прогон на вашем агенте (Python 3.8+, без пакетов)
└── docs/
    ├── 01-how-it-works.md        путь сообщения и ветка календаря
    ├── 02-setup.md               все параметры Config, ключи, публикация
    ├── 03-channels.md            сайт, Telegram, API для любой системы
    ├── 04-calendar-rules.md      свободное время, буферы, часовые пояса, код, напоминания
    ├── 05-guardrails-and-handoff.md  что проверяет код, защита, передача человеку
    ├── 06-models.md              OpenAI, совместимые API, Claude; расход токенов
    ├── 07-evals.md               как проверять агента
    └── 08-operations.md          журнал, память, приватность, неполадки
```

## Инструменты агента

| Инструмент | Что делает |
|---|---|
| `list_services` | услуги, длительность, цены из Config |
| `check_availability` | свободное время на день и ближайшие дни; время клиента в его часовом поясе |
| `book_appointment` | запись после «да»: событие, приглашение, код, сообщение команде |
| `find_booking` | запись по коду |
| `reschedule_booking` | перенос после «да», с повторной проверкой нового времени |
| `cancel_booking` | отмена после «да», с предупреждением о поздней отмене |
| `handoff_to_human` | передача диалога команде |
