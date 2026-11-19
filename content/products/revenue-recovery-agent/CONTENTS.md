# Состав набора

```
revenue-recovery-agent/
├── README.md                        что это и что умеет
├── QUICKSTART.md                    запуск примерно за час
├── CONTENTS.md                      этот файл
├── agent/
│   └── draft-prompt.md              инструкция модели; она же в узле Assess & Draft
├── workflows/
│   ├── revenue-recovery.n8n.json    агент
│   └── error-alert.n8n.json         сигнал об ошибке в Telegram
├── templates/
│   ├── invoices-example.csv         пример листа Invoices: 5 счетов в разных состояниях
│   ├── drafts-header.csv            заголовки листа Drafts
│   └── activity-header.csv          заголовки листа Activity
├── evals/
│   ├── dataset.jsonl                20 случаев: тон, риск, стоп-правила, запреты
│   └── run_evals.py                 прогон через вебхук предпросмотра (Python 3.8+, без пакетов)
└── docs/
    ├── 01-how-it-works.md           утро, кнопка, понедельник — путь каждого запроса
    ├── 02-setup.md                  Config, листы, ключи
    ├── 03-sequence-and-risk.md      последовательность, стоп-правила, риск
    ├── 04-invoice-sources.md        Google Таблица, Stripe, QuickBooks, Xero и другие
    ├── 05-telegram.md               кнопки, правка текста, команды
    ├── 06-models.md                 OpenAI, совместимые API, Claude
    └── 07-evals-and-operations.md   evals, журнал, отчёт, неполадки
```

## Узлы

| Узел | Что делает |
|---|---|
| Every Day 9:00 → Monitor Tick | запуск мониторинга |
| Every Monday 9:30 → Report Tick | запуск отчёта |
| Telegram Trigger | кнопки и команды |
| Preview Webhook | предпросмотр письма для evals и проверки |
| Config, Kind | настройки и выбор ветки |
| Read Invoices → Plan Invoices | кому и каким письмом напомнить, риск по правилам |
| Assess & Draft + модель | оценка риска и черновик |
| Check Draft | проверка черновика, шаблон вместо плохого, реквизиты и подпись |
| Draft Rows → Append Drafts → Cards → Approval Card | черновик в лист и карточка в Telegram |
| Telegram Act | решение по кнопке или команде: что записать, что отправить |
| Send Email → After Send | отправка; при ошибке черновик помечается failed |
| Updates? → Update Sheets, Activity? → Log Activity | запись в листы |
| Answer Button, Card Again, Ask Edit, Notice | ответ в Telegram |
| Weekly Report → Send Report | отчёт по понедельникам |
