# Состав набора

## корень

- `README.md` — что это и что нужно
- `QUICKSTART.md` — порядок запуска
- `CONTENTS.md` — этот файл

## workflows

- `workflows/n8n-monitor.n8n.json` — ошибки, выключенные воркфлоу и утренняя сводка по n8n клиента
- `workflows/parallel-run-log.n8n.json` — приём итогов от старой системы и n8n, сравнение, сигнал о расхождении
- `workflows/parallel-run-check.n8n.json` — события, потерянные одной стороной, и ежедневная готовность к переключению
- `workflows/error-alert.n8n.json` — сообщение в Telegram о любом сбое

## docs

- `docs/01-method.md` — 7 этапов: от звонка до поддержки
- `docs/02-export-and-access.md` — как получить экспорт Make и Zapier, опись, доступы
- `docs/03-rebuild-patterns.md` — соответствия Zapier/Make → n8n и что ломается чаще всего
- `docs/04-qa-and-cutover.md` — чек-лист, параллельный прогон со сверкой, переключение, откат
- `docs/05-monitoring-and-support.md` — монитор n8n, внешняя проверка, поддержка, отчёт клиенту

## tools

- `tools/migration_audit.py` — инструмент аудита
- `tools/app_map.json` — таблица соответствий сервисов и модулей
- `tools/examples/make/lead-to-crm.blueprint.json` — пример blueprint Make
- `tools/examples/make/shopify-orders.blueprint.json` — пример blueprint Make с Router и Iterator
- `tools/examples/zapier/zapfile.json` — пример экспорта Zapier
- `tools/examples/inventory.csv` — пример ручной описи
- `tools/example-output/audit.md` — результат аудита примеров
- `tools/example-output/inventory.csv` — результат аудита примеров
- `tools/example-output/steps.csv` — результат аудита примеров
- `tools/example-output/apps.csv` — результат аудита примеров
- `tools/example-output/migration-map.csv` — результат аудита примеров

## sales

- `sales/discovery-questions.md` — вопросы для первого звонка
- `sales/proposal-template.md` — коммерческое предложение
- `sales/statement-of-work.md` — техническое задание к договору
- `sales/packages-and-pricing.md` — пакеты и ориентиры цен
- `sales/maintenance-offer.md` — предложение о поддержке, три уровня
- `sales/roi-calculator.csv` — калькулятор экономии и окупаемости

## templates

- `templates/inventory-template.csv` — опись автоматизаций для заполнения
- `templates/client-access-checklist.md` — список доступов для клиента
- `templates/cutover-runbook.md` — runbook переключения и отката

## tests

- `tests/scenarios.md` — как проверено
