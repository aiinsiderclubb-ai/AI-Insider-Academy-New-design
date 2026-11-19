# Настройка

## Config

| Параметр | Что это | По умолчанию |
|---|---|---|
| `company`, `sender_name` | от чьего имени письма | — |
| `payment_details` | как оплатить — добавляется в конец каждого письма | — |
| `timezone_offset_hours` | часовой пояс относительно UTC — для «сегодня» | 2 |
| `spreadsheet_id` | таблица | — |
| `approver_chat_ids` | кто может нажимать кнопки и писать команды. Первый получает карточки и отчёт | — |
| `email.from`, `email.reply_to` | отправитель и куда приходят ответы клиентов | — |
| `sequence` | шаги: день просрочки и тон | 1 / 7 / 14 / 30 |
| `min_gap_days` | не чаще одного письма по счёту за столько дней | 3 |
| `max_drafts_per_run` | черновиков за утро, самые рискованные и старые — первыми | 20 |
| `high_amount` | с какой суммы счёт рискованнее | 5000 |
| `allow_late_fee`, `late_fee_text` | можно ли упомянуть пени и точная формулировка из договора | нет |
| `allow_collection`, `collection_text` | можно ли в последнем письме упомянуть передачу долга и формулировка | нет |
| `preview_token` | ключ вебхука предпросмотра; пусто — выключен | пусто |

## Лист Invoices

| Колонка | Что писать |
|---|---|
| `invoice_id` | номер счёта, как в документах |
| `client`, `contact_name`, `email` | компания, имя контакта, куда писать |
| `amount`, `currency` | сумма — можно с пробелами и запятой: `1 250,75` |
| `issued`, `due` | дата счёта и срок оплаты: `ГГГГ-ММ-ДД` или `ДД.ММ.ГГГГ` |
| `status` | `open`; `paid` или `cancelled` — закрыт |
| `paid_at` | дата оплаты; заполнена — счёт закрыт |
| `promise_date` | дата, к которой клиент обещал оплатить |
| `disputed`, `paused` | `yes` — напоминания остановлены |
| `last_contact`, `stage` | дата последнего напоминания и сколько их было — заполняет агент |
| `notes` | заметки для модели: «бухгалтер в отпуске до 20-го», «всегда платит в конце месяца». В письмо не попадают |

Агент сам меняет `stage`, `last_contact`, а по командам — `status`, `paid_at`, `promise_date`, `disputed`, `paused`, `notes`. Остальное ведёте вы или выгрузка из учётной системы.

## Листы Drafts и Activity

**Drafts** — `draft_id, created, invoice_id, step, tone, risk, reasons, to, subject, body, status, decided_at, decided_by`. Статусы: `pending`, `editing`, `sent`, `skipped`, `cancelled`, `failed`.

**Activity** — `time, invoice_id, action, detail, by`: каждое решение и команда.

## Ключи

| Узлы | Ключ |
|---|---|
| Read Invoices, Read for Telegram, Read for Report, Append Drafts, Update Sheets, Log Activity | Google Sheets OAuth2 |
| Telegram Trigger, Approval Card, Answer Button, Card Again, Ask Edit, Notice, Send Report | Telegram |
| Send Email | SMTP |
| OpenAI Chat Model или Anthropic Chat Model | ключ модели |

## Расписание

Мониторинг — каждый день в 9:00, отчёт — по понедельникам в 9:30, по часовому поясу n8n (Settings → Timezone в настройках воркфлоу). Время меняется в узлах Every Day 9:00 и Every Monday 9:30.
