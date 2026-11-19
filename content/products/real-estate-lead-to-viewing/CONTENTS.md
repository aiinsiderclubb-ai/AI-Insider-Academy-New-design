# Состав набора

```
real-estate-lead-to-viewing/
├── README.md                         что это и что умеет
├── QUICKSTART.md                     запуск примерно за два часа
├── CONTENTS.md                       этот файл
├── agent/
│   ├── system-prompt.md              инструкция агента; она же в узле AI Agent
│   ├── matching-and-presentation.md  как подбираются и показываются объекты, вставки в инструкцию
│   ├── tools.openai.json             схемы пяти инструментов, формат OpenAI
│   └── tools.anthropic.json          то же, формат Anthropic
├── workflows/
│   ├── real-estate-lead-to-viewing.n8n.json   агент, инструменты, follow-up
│   └── error-alert.n8n.json                   сигнал об ошибке
├── templates/
│   ├── listings.csv                  13 демо-объектов: продажа и аренда в Киеве
│   ├── leads-header.csv              заголовки листа Leads
│   ├── viewings-header.csv           заголовки листа Viewings
│   ├── log-header.csv                заголовки листа Log
│   └── chat-widget.html              чат-виджет для сайта
├── evals/
│   ├── dataset.jsonl                 16 случаев: квалификация, подбор, запись, передача, защита
│   └── run_evals.py                  прогон на вашем агенте (Python 3.8+, без пакетов)
└── docs/
    ├── 01-how-it-works.md            путь клиента и узлы
    ├── 02-setup.md                   Config, риелторы, листы, календари
    ├── 03-channels.md                сайт, порталы и CRM, Telegram
    ├── 04-leads-matching-booking.md  балл, назначение риелтора, подбор, запись, follow-up
    ├── 05-guardrails.md              защита и передача риелтору
    ├── 06-models.md                  OpenAI, совместимые API, Claude
    ├── 07-evals.md                   проверка и как мы проверяли
    ├── 08-kpi-dashboard.md           дашборд: формулы Google Таблиц и Looker Studio
    └── 09-operations.md              журнал, память, приватность, неполадки
```

## Инструменты агента

| Инструмент | Что делает | Данные |
|---|---|---|
| `update_lead` | карточка лида, балл, риелтор, чего не хватает | лист Leads |
| `search_listings` | до трёх объектов с причинами | лист Listings |
| `check_viewing_slots` | свободное время риелтора объекта | Google Календарь риелтора |
| `book_viewing` | запись после «да» клиента, без дублей | календарь, листы Viewings и Leads, Telegram риелтора |
| `handoff_to_human` | передача с пересказом | Telegram агентства |
