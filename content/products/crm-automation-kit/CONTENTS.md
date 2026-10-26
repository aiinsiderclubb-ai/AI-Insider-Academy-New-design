# Состав набора

## корень

- `README.md` — что это и что нужно
- `QUICKSTART.md` — порядок запуска
- `CONTENTS.md` — этот файл

## workflows

- `workflows/crm-intake.n8n.json` — один адрес для заявок из всех источников: очистка, дедупликация, ответственный, карточка в Telegram
- `workflows/crm-telegram.n8n.json` — кнопки этапов, заметки, суммы, напоминания и /my из Telegram
- `workflows/crm-reminders.n8n.json` — напоминания о следующих шагах, эскалация и застрявшие сделки
- `workflows/crm-weekly-report.n8n.json` — отчёт по воронке и менеджерам по понедельникам
- `workflows/error-alert.n8n.json` — сообщение в Telegram о любом сбое

## docs

- `docs/01-how-it-works.md` — путь сделки, лист Deals, распределение, этапы, напоминания
- `docs/02-setup.md` — импорт, учётные данные, менеджеры, все поля Config
- `docs/03-sources.md` — Tilda, форма сайта, наборы Lead Generation и WhatsApp, Make
- `docs/04-operations.md` — отчёт, объём таблицы, безопасность, данные
- `docs/manager-guide.md` — памятка менеджеру: кнопки, ответы, команды

## templates

- `templates/config.example.json` — пример заполненного Config
- `templates/deals-header.csv` — заголовки листа Deals

## tests

- `tests/test-requests.md` — проверка после запуска
- `tests/scenarios.md` — как проверены воркфлоу
