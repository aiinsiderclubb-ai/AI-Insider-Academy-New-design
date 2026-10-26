# Состав набора

## корень

- `README.md` — что это и что нужно
- `QUICKSTART.md` — порядок запуска
- `CONTENTS.md` — этот файл

## workflows

- `workflows/support-inbox.n8n.json` — обращения с сайта, из Telegram и почты: таблица, ответ по FAQ, черновики и кнопки для команды
- `workflows/support-sla-reminder.n8n.json` — напоминания об обращениях без ответа, каждые 15 минут в рабочее время
- `workflows/support-daily-digest.n8n.json` — утренняя сводка и список вопросов, которых нет в FAQ
- `workflows/error-alert.n8n.json` — сообщение в Telegram о любом сбое

## docs

- `docs/01-how-it-works.md` — схема, статусы, узлы
- `docs/02-setup.md` — импорт, учётные данные, все поля Config
- `docs/03-channels.md` — сайт, Telegram, почта и как отвечает команда
- `docs/04-knowledge-base.md` — как вести FAQ и пополнять его по сводке
- `docs/05-modes-and-safety.md` — черновики и автоответ, условия, запреты для модели
- `docs/06-operations.md` — напоминания, таблица, сбои, персональные данные

## prompts

- `prompts/support-assistant.md` — инструкция для модели

## templates

- `templates/config.example.json` — пример заполненного Config
- `templates/faq-starter.csv` — 15 типовых вопросов для листа FAQ
- `templates/tickets-header.csv` — заголовки листа Tickets
- `templates/web-widget.html` — форма поддержки для сайта

## tests

- `tests/test-requests.md` — 7 проверок
- `tests/scenarios.md` — как проверены воркфлоу
