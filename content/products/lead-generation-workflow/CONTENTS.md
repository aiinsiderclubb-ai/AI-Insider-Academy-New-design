# Состав набора

## корень

- `README.md` — что это и что нужно
- `QUICKSTART.md` — порядок запуска
- `CONTENTS.md` — этот файл

## workflows

- `workflows/lead-intake.n8n.json` — приём заявок: проверка, дубли, спам, оценка, таблица, Telegram, автоответ
- `workflows/lead-sla-reminder.n8n.json` — напоминания о заявках без ответа, каждые 10 минут в рабочее время
- `workflows/lead-daily-report.n8n.json` — утренний отчёт за вчера
- `workflows/error-alert.n8n.json` — сообщение в Telegram о любом сбое

## docs

- `docs/01-how-it-works.md` — схема, решения, узлы
- `docs/02-setup.md` — импорт, учётные данные, все поля Config, выбор модели
- `docs/03-connect-forms.md` — Tilda, WordPress, Webflow, Google Forms, своя форма, любой сервис
- `docs/04-ai-scoring.md` — как модель оценивает заявки и как это настроить
- `docs/05-sheet.md` — столбцы, статусы, настройки таблицы
- `docs/06-operations.md` — напоминания, отчёт, сбои, персональные данные

## prompts

- `prompts/qualification.md` — инструкция для модели

## templates

- `templates/config.example.json` — пример заполненного Config
- `templates/leads-sheet-header.csv` — заголовки таблицы
- `templates/html-form.html` — готовая форма для любого сайта
- `templates/google-forms.js` — скрипт для Google Forms

## tests

- `tests/test-requests.md` — 8 проверочных запросов
- `tests/scenarios.md` — как проверены воркфлоу
