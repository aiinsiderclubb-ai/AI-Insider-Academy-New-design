# Первый аудит за 20 минут

## 1. Попробуйте на примерах

```bash
cd tools
python3 migration_audit.py examples --out my-first-audit --rate 50 --currency EUR --client "Пример"
```

Откройте `my-first-audit/audit.md` — так выглядит отчёт для клиента. Сравните с `example-output/`.

## 2. Получите экспорт клиента

По `docs/02-export-and-access.md`:

- **Make** — blueprint каждого сценария (Export Blueprint) в одну папку.
- **Zapier** — экспорт данных zap'ов, если он доступен на тарифе клиента; если нет — заполните `templates/inventory-template.csv` вместе с клиентом на созвоне.

## 3. Запустите аудит

```bash
python3 migration_audit.py путь/к/папке-клиента --out audit-клиент --rate ВАША_СТАВКА --currency EUR --client "Название"
```

Папка может содержать всё вместе: blueprint Make, экспорт Zapier и CSV-опись.

## 4. Проверьте и поправьте

Инструмент считает по правилам. Откройте `steps.csv`: строки с `support` = `unknown`, `partial` или `none` — те, где нужна ваша голова. Поправьте часы в `inventory.csv`, если знаете больше.

## 5. Отправьте предложение

`sales/proposal-template.md` + `audit.md` + сумма из оценки. Пакеты — `sales/packages-and-pricing.md`.

## Дальше

Перенос по волнам (`docs/03-rebuild-patterns.md`), параллельный прогон с воркфлоу сверки (`docs/04-qa-and-cutover.md`), монитор и поддержка (`docs/05-monitoring-and-support.md`).
