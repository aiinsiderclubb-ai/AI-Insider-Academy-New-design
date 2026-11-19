# Состав набора

```
customer-support-agent/
├── README.md                     что это и что умеет
├── QUICKSTART.md                 запуск примерно за час
├── CONTENTS.md                   этот файл
├── agent/
│   ├── system-prompt.md          системная инструкция; она же вставлена в узел AI Agent
│   ├── tools.openai.json         схемы четырёх инструментов, формат OpenAI (function calling)
│   └── tools.anthropic.json      те же схемы, формат Anthropic (tool use)
├── workflows/
│   ├── customer-support-agent.n8n.json   агент
│   └── error-alert.n8n.json              сигнал об ошибке в Telegram
├── templates/
│   ├── knowledge.csv             демо-база знаний: 20 статей интернет-магазина кофе
│   ├── orders-example.csv        5 демо-заказов
│   ├── tickets-header.csv        заголовки листа Tickets
│   ├── log-header.csv            заголовки листа Log
│   └── chat-widget.html          чат-виджет для сайта
├── evals/
│   ├── dataset.jsonl             30 случаев: база знаний, заказы, обращения, передача, атаки
│   └── run_evals.py              прогон случаев на вашем агенте (Python 3.8+, без пакетов)
└── docs/
    ├── 01-how-it-works.md        путь сообщения от клиента до ответа
    ├── 02-setup.md               все параметры Config и листы таблицы
    ├── 03-channels.md            сайт, Telegram, API для любой системы
    ├── 04-knowledge-base.md      как писать статьи, поиск, заказы из магазина
    ├── 05-guardrails-and-handoff.md  защита и передача человеку
    ├── 06-models.md              OpenAI, совместимые API, Claude; расход токенов
    ├── 07-evals.md               как проверять агента и читать результат
    └── 08-operations.md          журнал, память, приватность, неполадки
```

## Узлы агента

| Узел | Что делает |
|---|---|
| Webhook, Telegram Trigger | входы: сайт и любые системы; Telegram |
| Tool Call | вход для инструментов: агент вызывает этот же воркфлоу как под-воркфлоу |
| Config | все настройки в одном месте |
| Kind | разводит сообщения клиентов и вызовы инструментов |
| Guard In | токен, формат, лимиты, номер карты, попытка подмены правил, просьба позвать человека |
| Route | модель, заготовленный ответ, 401 или 400 |
| AI Agent + OpenAI / Anthropic Chat Model + Memory | модель с памятью диалога (12 последних сообщений) |
| search_knowledge, get_order_status, create_ticket, handoff_to_human | инструменты агента |
| Guard Out | запрещённые обещания, утечка инструкции, пустой ответ, длина |
| Canned | ответы без модели: приветствие, лимит, «передаю менеджеру» |
| Alert Team? → Team Alert | сигнал команде, когда передачу сделала защита, а не агент |
| Log Row → Log | строка в журнал |
| Reply Channel → Respond / Send Reply | ответ туда, откуда пришёл вопрос |
| Tool Switch и ветки под ним | работа инструментов: чтение базы и заказов, запись обращения, уведомление команды |
