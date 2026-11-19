# ElevenLabs: инструменты

Инструменты создаются в панели: Agents → Tools → Add tool → Webhook. Заполните по таблицам ниже. Имя инструмента передаётся в адресе.

Общие поля для всех шести:

- **Method:** POST
- **Headers:** `X-Voice-Secret` — тип Secret, значение — ваш секрет из n8n.
- **Body, дополнительные свойства для всех инструментов:**
  - `caller_number` — тип Dynamic variable, `system__caller_id`. Нужен, чтобы перенос и отмена работали только с номера гостя.
  - `conversation_id` — тип Dynamic variable, `system__conversation_id`. Нужен для защиты от повторной брони.
- **Response timeout:** 20 секунд.

## check_availability

- **Name:** `check_availability`
- **Description:** Найти свободный стол на дату для компании. Вызывай перед тем, как предлагать время. Никогда не называй время без этого вызова.
- **URL:** `https://ВАШ-N8N/webhook/voice-tools?tool=check_availability`

| Свойство тела | Тип | Обязательное | Описание |
|---|---|---|---|
| `guests` | integer | да | Сколько будет гостей, числом. Больше 8 — не бронируй, вызывай request_callback. |
| `date` | string | да | Дата: ГГГГ-ММ-ДД, либо today, tomorrow, день недели (mon, tue, wed, thu, fri, sat, sun), либо +N дней. Не вычисляй дату сам. |
| `part_of_day` | string (any, morning, afternoon, evening) | нет | Время суток, если гость назвал: afternoon — с 12 до 17, evening — после 17. |
| `zone` | string | нет | Зона, если гость попросил: hall — основной зал; terrace — терраса. Не спрашивай сам, если гостю всё равно. |

## create_booking

- **Name:** `create_booking`
- **Description:** Забронировать стол. Вызывай только после того, как повторил гостю дату, время, число гостей и имя и получил явное «да».
- **URL:** `https://ВАШ-N8N/webhook/voice-tools?tool=create_booking`

| Свойство тела | Тип | Обязательное | Описание |
|---|---|---|---|
| `guests` | integer | да | Сколько будет гостей, числом. Больше 8 — не бронируй, вызывай request_callback. |
| `slot_start` | string | да | Значение slot_start из ответа check_availability, без изменений. |
| `table_id` | string | нет | table_id выбранного времени из ответа check_availability. |
| `zone` | string | нет | Зона, если гость попросил: hall — основной зал; terrace — терраса. Не спрашивай сам, если гостю всё равно. |
| `customer_name` | string | да | Имя гостя, как он назвал. |
| `customer_phone` | string | да | Телефон гостя цифрами, как он его продиктовал. |
| `occasion` | string | нет | Повод, если гость сам назвал: день рождения, годовщина, деловая встреча. |
| `wishes` | string | нет | Пожелания словами гостя: детский стул, тихий стол, торт к десерту. Без сведений о здоровье и платёжных данных. |
| `consent` | boolean | да | true — только после подтверждения гостем. |

## find_booking

- **Name:** `find_booking`
- **Description:** Найти предстоящие брони гостя по номеру телефона. Вызывай перед переносом или отменой.
- **URL:** `https://ВАШ-N8N/webhook/voice-tools?tool=find_booking`

| Свойство тела | Тип | Обязательное | Описание |
|---|---|---|---|
| `customer_phone` | string | да | Телефон гостя цифрами, как он его продиктовал. |

## reschedule_booking

- **Name:** `reschedule_booking`
- **Description:** Перенести бронь на новое время или изменить число гостей. Сначала find_booking и check_availability.
- **URL:** `https://ВАШ-N8N/webhook/voice-tools?tool=reschedule_booking`

| Свойство тела | Тип | Обязательное | Описание |
|---|---|---|---|
| `booking_id` | string | да | booking_id из ответа find_booking. |
| `customer_phone` | string | да | Телефон гостя цифрами, как он его продиктовал. |
| `new_slot_start` | string | да | slot_start нового времени из ответа check_availability. Если меняется только число гостей — прежнее время брони. |
| `guests` | integer | нет | Новое число гостей, если изменилось. Иначе не передавай. |

## cancel_booking

- **Name:** `cancel_booking`
- **Description:** Отменить бронь после того, как гость подтвердил отмену.
- **URL:** `https://ВАШ-N8N/webhook/voice-tools?tool=cancel_booking`

| Свойство тела | Тип | Обязательное | Описание |
|---|---|---|---|
| `booking_id` | string | да | booking_id из ответа find_booking. |
| `customer_phone` | string | да | Телефон гостя цифрами, как он его продиктовал. |
| `reason` | string | нет | Причина словами гостя, если назвал. |

## request_callback

- **Name:** `request_callback`
- **Description:** Передать администратору просьбу перезвонить: банкет и большая компания, жалоба, вопрос без ответа в базе знаний, сбой, нет свободных столов.
- **URL:** `https://ВАШ-N8N/webhook/voice-tools?tool=request_callback`

| Свойство тела | Тип | Обязательное | Описание |
|---|---|---|---|
| `customer_name` | string | да | Имя гостя. |
| `customer_phone` | string | да | Телефон гостя цифрами, как он его продиктовал. |
| `topic` | string | да | О чём просят перезвонить, одной фразой. |
| `urgency` | string | нет | Срочность словами: сегодня, в течение дня, не срочно. |
| `details` | string | нет | Что важно знать администратору до звонка: дата, число гостей, повод. |

## Если переменные `system__caller_id` и `system__conversation_id` недоступны

Названия системных переменных проверьте в панели: список показывается при выборе типа Dynamic variable. Если номера звонящего нет, бэкенд не сможет подтвердить владельца брони и на перенос или отмену ответит `caller_mismatch` — агент предложит обратный звонок. Чтобы разрешить перенос по названному номеру, поставьте в Config `require_caller_match: false`. Это удобнее и менее безопасно: бронь сможет отменить любой, кто знает номер клиента.
