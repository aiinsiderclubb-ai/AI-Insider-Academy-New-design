# Запуск примерно за час

## 1. Таблица (10 минут)

Google Таблица с тремя листами, импорт из `templates/` (Файл → Импорт → «Заменить текущий лист»):

| Лист | Файл |
|---|---|
| `Invoices` | `invoices-example.csv` — пример, замените своими счетами |
| `Drafts` | `drafts-header.csv` |
| `Activity` | `activity-header.csv` |

Перенесите в Invoices свои неоплаченные счета: номер, клиент, контакт, email, сумма, валюта, дата счёта, срок оплаты. Колонки — `docs/02-setup.md`. Если по счёту уже были напоминания, поставьте их число в `stage` и дату последнего в `last_contact`, иначе агент начнёт с первого письма.

## 2. Telegram (5 минут)

Создайте бота в @BotFather — отдельного для дебиторки. Напишите ему что-нибудь и узнайте свой chat id: `https://api.telegram.org/botТОКЕН/getUpdates` → `message.chat.id`. Для общего чата финансов — добавьте бота в группу и возьмите id группы (с минусом).

## 3. Импорт и ключи (15 минут)

1. Импортируйте `workflows/revenue-recovery.n8n.json` и `workflows/error-alert.n8n.json`.
2. Ключи:
   - **Google Sheets OAuth2** — Read Invoices, Read for Telegram, Read for Report, Append Drafts, Update Sheets, Log Activity;
   - **Telegram** — Telegram Trigger, Approval Card, Answer Button, Card Again, Ask Edit, Notice, Send Report;
   - **SMTP** — Send Email;
   - **OpenAI** — OpenAI Chat Model (для Claude — `docs/06-models.md`).

## 4. Config (10 минут)

- `company`, `sender_name`, `payment_details` — кто пишет и как оплатить: эти строки агент добавит в конец каждого письма;
- `spreadsheet_id`;
- `approver_chat_ids` — ваш chat id или id группы; только оттуда принимаются кнопки и команды;
- `email.from`, `email.reply_to`;
- `sequence` — дни и тон напоминаний;
- `high_amount` — с какой суммы счёт рискованнее;
- `preview_token` — случайная строка для evals.

Пени и передачу долга агент по умолчанию не упоминает. Включайте `allow_late_fee` и `allow_collection`, только если это есть в договоре, и только с точной формулировкой.

Error Alert: впишите chat id в узел Alert, в агенте выберите его в Settings → Error workflow.

## 5. Публикация и первая проверка (10 минут)

1. **Publish**.
2. Проверьте письмо на одном счёте, ничего не отправляя:

```bash
curl -X POST 'https://ВАШ-N8N/webhook/recovery-preview' -H 'Content-Type: application/json' \
  -H 'x-preview-token: ВАШ_PREVIEW_TOKEN' \
  -d '{"invoice":{"invoice_id":"TEST-1","client":"ООО Тест","contact_name":"Ольга","email":"olga@example.com","amount":"1200","currency":"EUR","due":"2026-11-10","stage":"0"}}'
```

В ответе — риск, причины, тема и текст письма.

3. Чтобы не ждать 9:00: откройте агента, на узле **Every Day 9:00** нажмите Execute step. Карточки придут в Telegram. Нажмите «Пропустить» на одной, «Отправить» — на той, где email ваш.
4. Напишите боту `/help`.

## 6. Evals (10 минут)

```bash
python3 evals/run_evals.py --url 'https://ВАШ-N8N/webhook/recovery-preview' --token ВАШ_PREVIEW_TOKEN --repeat 3
```

Подробно — `docs/07-evals-and-operations.md`.
