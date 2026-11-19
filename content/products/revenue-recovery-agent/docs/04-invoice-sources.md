# Откуда берутся счета

Агент читает только лист **Invoices**. Это сделано специально: одна понятная таблица, которую можно проверить глазами, а заполнять её можно откуда угодно.

## Вручную или выгрузкой

Для небольшого числа счетов — вносите их сами или раз в день вставляйте выгрузку из учётной системы. Колонки — `docs/02-setup.md`. Колонки `stage`, `last_contact`, `promise_date`, `disputed`, `paused`, `notes` не перезаписывайте выгрузкой: их ведёт агент.

## Автоматически из учётной системы

Сделайте в n8n отдельный воркфлоу синхронизации: раз в день, до 9:00, он берёт неоплаченные счета из системы и обновляет Invoices — добавляет новые строки и закрывает оплаченные (`status: paid`, `paid_at`). Ключевое поле — `invoice_id`.

Ниже — откуда брать поля в популярных системах. **Эти запросы мы не запускали**: сверьте их с документацией своей системы и версией API.

### Stripe

`GET https://api.stripe.com/v1/invoices?status=open&limit=100` с секретным ключом (Bearer). Только чтение: создайте ограниченный ключ с правом Read на Invoices.

| Invoices | Stripe |
|---|---|
| `invoice_id` | `number` |
| `client` / `contact_name` | `customer_name` |
| `email` | `customer_email` |
| `amount` | `amount_remaining` ÷ 100 (Stripe хранит сумму в центах) |
| `currency` | `currency` в верхнем регистре |
| `issued` | `created` (unix-время) |
| `due` | `due_date` (unix-время; у счетов с автосписанием его нет — такие не берите) |

Оплаченные: `status=paid`, дата — `status_transitions.paid_at`.

Если Stripe сам шлёт клиентам напоминания о неоплаченных счетах (настраивается в разделе Billing), выключите их, иначе клиент получит два письма.

### QuickBooks Online

Запрос `select * from Invoice where Balance > '0'` к Accounting API (`/v3/company/<realmId>/query`), OAuth2-ключ QuickBooks в n8n.

| Invoices | QuickBooks |
|---|---|
| `invoice_id` | `DocNumber` |
| `client` | `CustomerRef.name` |
| `email` | `BillEmail.Address` |
| `amount` | `Balance` |
| `currency` | `CurrencyRef.value` |
| `issued` / `due` | `TxnDate` / `DueDate` |

### Xero

`GET https://api.xero.com/api.xro/2.0/Invoices?where=Type=="ACCREC" AND Status=="AUTHORISED"`, OAuth2-ключ Xero в n8n.

| Invoices | Xero |
|---|---|
| `invoice_id` | `InvoiceNumber` |
| `client` | `Contact.Name` |
| `email` | `Contact.EmailAddress` (может потребоваться отдельный запрос контакта) |
| `amount` | `AmountDue` |
| `currency` | `CurrencyCode` |
| `issued` / `due` | `Date` / `DueDate` |

### 1С, BAS, другие

Если у системы нет API — выгрузка в CSV или Excel по расписанию и импорт в лист: Google Apps Script или узел n8n Read Spreadsheet File.

## Как отмечать оплаты

Чем быстрее оплата попадает в Invoices, тем меньше шансов, что клиенту уйдёт лишнее напоминание. Способы — от простого к надёжному:
1. команда `/paid СЧЁТ` в Telegram, как только увидели оплату;
2. ежедневная синхронизация до 9:00;
3. вебхук платёжной системы об оплате (например, Stripe `invoice.paid`) → отдельный воркфлоу, который ставит `paid_at`.

Агент перепроверяет счёт при нажатии «Отправить», но видит только то, что уже есть в таблице.
