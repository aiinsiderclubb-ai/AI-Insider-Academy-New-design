# Состав набора

```
lead-qualification-agent/
├── README.md                     что это и что умеет
├── QUICKSTART.md                 запуск примерно за час
├── CONTENTS.md                   этот файл
├── agent/
│   ├── system-prompt.md          инструкция модели; она же в узле AI Agent
│   ├── tools.openai.json         схемы fetch_page и submit_assessment, формат OpenAI
│   └── tools.anthropic.json      те же схемы, формат Anthropic
├── workflows/
│   ├── lead-qualification-agent.n8n.json   приём, дубли, агент, рубрика, маршрутизация, CRM, уведомления
│   └── error-alert.n8n.json                сигнал об ошибке в Telegram
├── templates/
│   ├── lead-form.html            форма заявки с ловушкой для ботов
│   └── leads-header.csv          заголовки листа Leads
├── evals/
│   ├── dataset.jsonl             16 тестовых заявок
│   └── run_evals.py              прогон на вашем агенте (Python 3.8+, без пакетов)
└── docs/
    ├── 01-how-it-works.md        путь заявки от формы до карточки
    ├── 02-setup.md               параметры Config, ключи, публикация
    ├── 03-forms.md               поля, своя форма, Tilda, WordPress, API
    ├── 04-scoring.md             рубрика, сегменты, менеджеры, лист Leads, письмо лиду
    ├── 05-guardrails-and-handoff.md  что проверяет код, SSRF, атаки через текст, человек в контуре
    ├── 06-models.md              OpenAI, совместимые API, Claude; расход токенов
    ├── 07-evals.md               как проверять агента
    └── 08-operations.md          калибровка, приватность, неполадки
```
