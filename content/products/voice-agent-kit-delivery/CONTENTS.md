# Состав набора

Файлов в архиве: 45.

## корень

- `README.md` — что это и что нужно для запуска
- `QUICKSTART.md` — порядок запуска по шагам
- `CONTENTS.md` — этот файл

## docs

- `docs/01-how-it-works.md` — схема и логика набора
- `docs/02-backend-n8n.md` — таблица заказов, импорт воркфлоу, учётные данные, узел Config
- `docs/03-setup-vapi.md` — настройка агента в Vapi
- `docs/04-setup-retell.md` — настройка агента в Retell
- `docs/05-setup-elevenlabs.md` — настройка агента в ElevenLabs
- `docs/06-telephony.md` — номер, переадресация, SIP, задержка
- `docs/07-privacy-compliance.md` — данные, запись разговоров, адреса и исходящие звонки
- `docs/08-operations.md` — первая неделя, сбои, изменения правил, таблица заказов, откат
- `docs/09-tuning.md` — настройка агента по записям звонков
- `docs/10-outbound.md` — исходящие звонки накануне доставки

## prompts

- `prompts/system-prompt.ru.md` — системный промпт на русском, для входящих и исходящих звонков
- `prompts/system-prompt.en.md` — системный промпт на английском
- `prompts/dialog-modules.md` — формулировки на русском, украинском и английском
- `prompts/knowledge-base.md` — шаблон базы знаний

## providers

- `providers/README.md` — что в конфигурациях сверено с документацией, авторизация вебхука, переменные исходящих звонков
- `providers/vapi-tools.json` — шесть инструментов Vapi
- `providers/vapi-assistant.json` — ассистент Vapi
- `providers/retell-llm.json` — модель Retell с промптом и инструментами
- `providers/retell-agent.json` — агент Retell
- `providers/elevenlabs-agent.json` — агент ElevenLabs
- `providers/elevenlabs-tools.md` — лист заполнения инструментов ElevenLabs

## tools

- `tools/tool-contract.md` — таблица заказов, правила изменений, что делает и возвращает каждый инструмент
- `tools/tools.schema.json` — схемы параметров шести инструментов

## workflows

- `workflows/order-tools.n8n.json` — воркфлоу инструментов заказов
- `workflows/confirmation-calls.n8n.json` — воркфлоу исходящих звонков накануне доставки
- `workflows/call-summary.n8n.json` — воркфлоу сводки звонка
- `workflows/error-alert.n8n.json` — воркфлоу оповещения об ошибках

## data

- `data/config.example.json` — пример настроек: города, интервалы, правила, исходящие звонки
- `data/orders-template.csv` — шаблон таблицы заказов с тремя примерами

## tests

- `tests/test-calls.md` — 30 тестовых звонков с ожидаемым поведением
- `tests/test-calls.csv` — протокол тестовых звонков
- `tests/backend-scenarios.md` — сценарии, которыми проверен бэкенд
- `tests/tool-payloads.md` — 12 готовых запросов к бэкенду
- `tests/launch-scorecard.md` — оценочный лист запуска

## sales

- `sales/pitch.md` — как продать клиенту, возражения, пилот
- `sales/roi-calculator.csv` — калькулятор окупаемости
- `sales/pricing.md` — три пакета и как считать свою цену
- `sales/discovery-questionnaire.md` — анкета перед внедрением
- `sales/proposal-scope.md` — объём работ с критериями приёмки
- `sales/client-handoff.md` — лист передачи клиенту
- `sales/monthly-report.md` — шаблон отчёта за месяц

## samples

- `samples/calls.md` — примеры разговоров
