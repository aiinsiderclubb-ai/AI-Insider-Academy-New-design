# ElevenLabs: инструменты

Инструменты создаются в панели: Agents → Tools → Add tool → Webhook. Заполните по таблицам ниже. Имя инструмента передаётся в адресе.

Общие поля для всех шести:

- **Method:** POST
- **Headers:** `X-Voice-Secret` — тип Secret, значение — ваш секрет из n8n.
- **Body, дополнительные свойства для всех инструментов:**
  - `caller_number` — тип Dynamic variable, `system__caller_id`. Нужен, чтобы перенос и отмена работали только с номера клиента.
  - `conversation_id` — тип Dynamic variable, `system__conversation_id`. Нужен для защиты от повторной записи.
- **Response timeout:** 20 секунд.

## check_availability

- **Name:** `check_availability`
- **Description:** Найти свободное время для услуги. Вызывай перед тем, как предлагать время. Никогда не называй время без этого вызова.
- **URL:** `https://ВАШ-N8N/webhook/voice-tools?tool=check_availability`

| Свойство тела | Тип | Обязательное | Описание |
|---|---|---|---|
| `service_id` | string | да | Идентификатор услуги из каталога: haircut_women — Женская стрижка; haircut_men — Мужская стрижка; coloring — Окрашивание в один тон; styling — Укладка; manicure — Маникюр с покрытием; pedicure — Педикюр; brows — Коррекция и окрашивание бровей; consultation — Консультация мастера |
| `date` | string | да | Дата: ГГГГ-ММ-ДД, либо today, tomorrow, день недели (mon, tue, wed, thu, fri, sat, sun), либо +N дней. Не вычисляй дату сам. |
| `part_of_day` | string (any, morning, afternoon, evening) | нет | Время суток, если клиент назвал. |
| `staff_id` | string | нет | Нужный мастер, если клиент выбрал: anna — Анна; olga — Ольга; ira — Ирина; kate — Екатерина |

## create_booking

- **Name:** `create_booking`
- **Description:** Создать запись. Вызывай только после того, как повторил клиенту детали и получил явное «да».
- **URL:** `https://ВАШ-N8N/webhook/voice-tools?tool=create_booking`

| Свойство тела | Тип | Обязательное | Описание |
|---|---|---|---|
| `service_id` | string | да | Идентификатор услуги из каталога. |
| `slot_start` | string | да | Значение slot_start из ответа check_availability, без изменений. |
| `staff_id` | string | нет | staff_id выбранного времени из ответа check_availability. |
| `customer_name` | string | да | Имя клиента, как он назвал. |
| `customer_phone` | string | да | Телефон клиента цифрами, как он его продиктовал. |
| `notes` | string | нет | Короткий комментарий словами клиента. Без сведений о здоровье и платёжных данных. |
| `consent` | boolean | да | true — только после подтверждения клиентом. |

## find_booking

- **Name:** `find_booking`
- **Description:** Найти предстоящие записи клиента по номеру телефона. Вызывай перед переносом или отменой.
- **URL:** `https://ВАШ-N8N/webhook/voice-tools?tool=find_booking`

| Свойство тела | Тип | Обязательное | Описание |
|---|---|---|---|
| `customer_phone` | string | да | Телефон клиента цифрами, как он его продиктовал. |

## reschedule_booking

- **Name:** `reschedule_booking`
- **Description:** Перенести запись на новое время. Сначала find_booking и check_availability.
- **URL:** `https://ВАШ-N8N/webhook/voice-tools?tool=reschedule_booking`

| Свойство тела | Тип | Обязательное | Описание |
|---|---|---|---|
| `booking_id` | string | да | booking_id из ответа find_booking. |
| `customer_phone` | string | да | Телефон клиента цифрами, как он его продиктовал. |
| `new_slot_start` | string | да | slot_start нового времени из ответа check_availability. |

## cancel_booking

- **Name:** `cancel_booking`
- **Description:** Отменить запись после того, как клиент подтвердил отмену.
- **URL:** `https://ВАШ-N8N/webhook/voice-tools?tool=cancel_booking`

| Свойство тела | Тип | Обязательное | Описание |
|---|---|---|---|
| `booking_id` | string | да | booking_id из ответа find_booking. |
| `customer_phone` | string | да | Телефон клиента цифрами, как он его продиктовал. |
| `reason` | string | нет | Причина словами клиента, если назвал. |

## request_callback

- **Name:** `request_callback`
- **Description:** Передать администратору просьбу перезвонить: жалоба, вопрос без ответа в базе знаний, сбой, нет свободного времени, нерабочие часы.
- **URL:** `https://ВАШ-N8N/webhook/voice-tools?tool=request_callback`

| Свойство тела | Тип | Обязательное | Описание |
|---|---|---|---|
| `customer_name` | string | да | Имя клиента. |
| `customer_phone` | string | да | Телефон клиента цифрами, как он его продиктовал. |
| `topic` | string | да | О чём просят перезвонить, одной фразой. |
| `urgency` | string | нет | Срочность словами: сегодня, в течение дня, не срочно. |
| `details` | string | нет | Что важно знать администратору до звонка. |

## Если переменные `system__caller_id` и `system__conversation_id` недоступны

Названия системных переменных проверьте в панели: список показывается при выборе типа Dynamic variable. Если номера звонящего нет, бэкенд не сможет подтвердить владельца записи и на перенос или отмену ответит `caller_mismatch` — агент предложит обратный звонок. Чтобы разрешить перенос по названному номеру, поставьте в Config `require_caller_match: false`. Это удобнее и менее безопасно: запись сможет отменить любой, кто знает номер клиента.
