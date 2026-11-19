# Состав набора

```
knowledge-base-agent/
├── README.md                     что это и что умеет
├── QUICKSTART.md                 запуск примерно за час
├── CONTENTS.md                   этот файл
├── agent/
│   ├── system-prompt.md          системная инструкция; она же вставлена в узел AI Agent
│   ├── tools.openai.json         схемы трёх инструментов, формат OpenAI
│   └── tools.anthropic.json      те же схемы, формат Anthropic
├── workflows/
│   ├── knowledge-base-agent.n8n.json   агент, инструменты, переиндексация
│   └── error-alert.n8n.json            сигнал об ошибке в Telegram
├── templates/
│   ├── demo-docs/                6 демо-документов: отпуска, командировки, онбординг,
│   │                             удалёнка, безопасность и тест защиты от команд в документах
│   ├── documents-header.csv      заголовки листа Documents (реестр индекса)
│   ├── sources.csv               лист Sources: страницы по ссылкам
│   ├── gaps-header.csv           заголовки листа Gaps (вопросы без ответа)
│   └── log-header.csv            заголовки листа Log
├── evals/
│   ├── dataset.jsonl             25 случаев на демо-документах
│   └── run_evals.py              прогон (Python 3.8+, без пакетов)
└── docs/
    ├── 01-how-it-works.md        вопрос и переиндексация шаг за шагом
    ├── 02-setup.md               параметры Config и листы
    ├── 03-channels.md            Telegram, веб, API
    ├── 04-search.md              форматы, нарезка, порог, ссылки
    ├── 05-production-store.md    Qdrant, Supabase, PGVector вместо памяти n8n
    ├── 06-models.md              модели ответов и эмбеддингов, расход
    ├── 07-evals.md               как проверять агента
    └── 08-operations.md          журнал, пробелы базы, приватность, неполадки
```

## Узлы

| Узел | Что делает |
|---|---|
| Webhook, Telegram Trigger | вопросы |
| Every Night, Reindex Webhook → Mark Reindex | переиндексация в 3:00 и по запросу |
| Tool Call | вход для инструментов и для чтения документов при переиндексации |
| Config → Kind | настройки; разводит вопросы, инструменты и переиндексацию |
| Guard In → Route | доступ, токен, лимиты, просьба позвать человека |
| AI Agent + Chat Model + Memory | модель с памятью диалога (10 сообщений) |
| search_documents, list_documents, handoff_to_human | инструменты агента |
| Guard Out | ссылки и список источников, утечка инструкции, пустой ответ |
| Canned, Alert Team?, Log Row, Log, Gap?, Append Gap, Reply Channel | заготовки, сигнал команде, журнал, пробелы, ответ |
| Search Index → Rank Passages | векторный поиск и отбор фрагментов по порогу |
| Fetch By Type → Export Doc / Download PDF → Read PDF / Download Text / Fetch Page → Doc Text | текст одного документа |
| Reindex Gate … Plan Sources → Extract Documents → Build Docs → Insert Index → Registry → Write Registry → Reindex Report | переиндексация |
| Embeddings, Document Loader, Text Splitter | эмбеддинги, загрузка текста, нарезка на фрагменты |
