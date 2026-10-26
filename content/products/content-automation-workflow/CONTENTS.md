# Состав набора

## корень

- `README.md` — что это и что нужно
- `QUICKSTART.md` — порядок запуска
- `CONTENTS.md` — этот файл

## workflows

- `workflows/content-weekly-plan.n8n.json` — каждое воскресенье: темы и брифы на свободные слоты следующей недели
- `workflows/content-drafts.n8n.json` — каждые 15 минут: черновик под формат канала и отправка на одобрение
- `workflows/content-approvals.n8n.json` — кнопки и ответы в чате одобрения
- `workflows/content-publisher.n8n.json` — каждые 5 минут: публикация в Telegram, WordPress или через вебхук
- `workflows/error-alert.n8n.json` — сообщение в Telegram о любом сбое

## docs

- `docs/01-how-it-works.md` — путь публикации, лист Plan, ручное управление
- `docs/02-setup.md` — импорт, учётные данные, все поля Config
- `docs/03-channels.md` — Telegram, WordPress, вебхук для LinkedIn и других сетей, слоты
- `docs/04-operations.md` — неделя с набором, защита, данные

## prompts

- `prompts/content-prompts.md` — что получает модель и как настроить свой голос

## templates

- `templates/config.example.json` — пример заполненного Config
- `templates/plan-starter.csv` — лист Plan: заголовки и три примера

## tests

- `tests/test-requests.md` — проверка после запуска
- `tests/scenarios.md` — как проверены воркфлоу
