# Состав набора

## корень

- `README.md` — что это и что нужно
- `QUICKSTART.md` — порядок запуска
- `CONTENTS.md` — этот файл

## workflows

- `workflows/whatsapp-bot.n8n.json` — вебхук WhatsApp: проверка подписи, ответ консультанта, запись в таблицу, передача менеджерам
- `workflows/whatsapp-manager-replies.n8n.json` — менеджеры отвечают клиентам из Telegram, кнопки «Беру» и «Вернуть боту»
- `workflows/whatsapp-followup.n8n.json` — одно напоминание замолчавшему клиенту в пределах 24 часов
- `workflows/whatsapp-daily-report.n8n.json` — утренний отчёт и список горячих клиентов
- `workflows/error-alert.n8n.json` — сообщение в Telegram о любом сбое

## docs

- `docs/01-how-it-works.md` — схема, карточка клиента, передача, окно 24 часа
- `docs/02-whatsapp-connection.md` — приложение Meta, номер, токен, App Secret, вебхук
- `docs/03-setup.md` — импорт, учётные данные, все поля Config
- `docs/04-sales.md` — каталог, квалификация, работа менеджеров, отписка, напоминание
- `docs/05-operations.md` — ежедневная работа, защита, персональные данные

## prompts

- `prompts/sales-consultant.md` — инструкция для модели и как улучшить ответы

## templates

- `templates/config.example.json` — пример заполненного Config
- `templates/catalog-starter.csv` — заготовка листа Catalog
- `templates/contacts-header.csv` — заголовки листа Contacts

## tests

- `tests/send-test-message.sh` — подписанное тестовое сообщение в формате Meta
- `tests/test-requests.md` — проверка после запуска
- `tests/scenarios.md` — как проверены воркфлоу
