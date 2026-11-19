# Состав набора

```
multi-agent-ops-team/
├── README.md                      что это и что умеет
├── QUICKSTART.md                  запуск примерно за полтора часа
├── CONTENTS.md                    этот файл
├── agent/
│   ├── prompts/
│   │   ├── orchestrator.md        оркестратор: как распределять задачи
│   │   ├── email-triage.md        агент разбора почты
│   │   ├── leads.md               агент по лидам
│   │   ├── support.md             агент поддержки
│   │   └── reports.md             агент отчётов
│   ├── tools.openai.json          инструменты каждого агента, формат OpenAI
│   └── tools.anthropic.json       то же, формат Anthropic
├── workflows/
│   ├── multi-agent-ops-team.n8n.json         команда на OpenAI
│   ├── multi-agent-ops-team-claude.n8n.json  команда на Claude
│   └── error-alert.n8n.json                  сигнал об ошибке в Telegram
├── templates/
│   ├── knowledge.csv              демо-база знаний студии автоматизации, 10 статей
│   ├── leads-header.csv           заголовки листа Leads
│   ├── tickets-header.csv         заголовки листа Tickets
│   ├── inbox-header.csv           заголовки листа Inbox
│   ├── log-header.csv             заголовки листа Log
│   └── chat-widget.html           чат-виджет для сайта
├── evals/
│   ├── dataset.jsonl              16 случаев: маршрутизация, передача, защита
│   └── run_evals.py               прогон на вашей команде (Python 3.8+, без пакетов)
└── docs/
    ├── architecture.svg           схема
    ├── 01-how-it-works.md         путь сообщения, оркестратор, трасса
    ├── 02-setup.md                параметры Config и листы таблицы
    ├── 03-channels.md             сайт, Telegram, почта, расписание, API
    ├── 04-agents.md               четыре агента: задачи, инструменты, лимиты
    ├── 05-guardrails-and-limits.md  защита, лимиты агентов, передача человеку
    ├── 06-models.md               OpenAI, совместимые API, Claude, разные модели агентам
    ├── 07-evals.md                проверка маршрутизации
    └── 08-operations.md           журналы, память, приватность, неполадки
```

## Узлы

| Узел | Что делает |
|---|---|
| Webhook, Telegram Trigger, Email Trigger, Daily Report | входы |
| Tool Call | вход для инструментов агентов (этот же воркфлоу) |
| Config | все настройки |
| Kind | сообщения и вызовы инструментов |
| Guard In | канал, токены, лимиты, карта, инъекции, «позовите человека», кого можно звать |
| Route | оркестратор, заготовка, 401, 400 |
| Prompts | инструкции всех агентов; недоступному агенту — заглушка |
| Orchestrator + Memory | главный агент с памятью диалога |
| email_triage_agent, leads_agent, support_agent, reports_agent | агенты-специалисты (AI Agent Tool) |
| save_email_triage, save_lead, search_knowledge, create_ticket, get_metrics, handoff_to_human | инструменты |
| Guard Out | трасса, счёт лимитов, обещания, утечка, пустой ответ |
| Canned | ответы без модели |
| Alert Team? → Team Alert | сигнал команде |
| Log Row → Log | строка журнала с трассой |
| Reply Channel → Respond / Send Reply | ответ на сайт, команде или в Telegram |
| Tool Switch и ветки | работа инструментов |
| Service Error? → Tool Alert → Tool Error Alert → Tool Return | сбой таблицы — сигнал команде; ответ инструмента агенту |
