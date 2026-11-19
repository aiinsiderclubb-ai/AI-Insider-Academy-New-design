# Готовые запросы к бэкенду

Проверяют бэкенд без телефона. Замените адрес и секрет. Секрет держите в переменной окружения:

```bash
export N8N=https://ВАШ-N8N/webhook/voice-tools
```

```bash
export SECRET=ваш-секрет
```

Запросы — в формате Retell: он самый короткий. `from_number` — номер «звонящего».

## 1. Свободный стол на двоих на завтра

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"name":"check_availability","args":{"guests":2,"date":"tomorrow"},"call":{"call_id":"test-1","from_number":"+380501112233","direction":"inbound"}}'
```

Ожидаем: `"ok": true`, `table_minutes` и до трёх вариантов в `slots`, у каждого `table_id`.

## 2. Без секрета — отказ

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$N8N" -H "Content-Type: application/json" -d '{}'
```

Ожидаем: `403`. Если пришло `200` — вебхук не защищён, запускать нельзя.

## 3. Большая компания — к менеджеру

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"name":"check_availability","args":{"guests":15,"date":"tomorrow"},"call":{"call_id":"test-1","from_number":"+380501112233","direction":"inbound"}}'
```

Ожидаем: `"error": "party_too_large"`.

## 4. Бронь без подтверждения — отказ

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"name":"create_booking","args":{"guests":2,"slot_start":"ВСТАВЬТЕ_slot_start","table_id":"ВСТАВЬТЕ_table_id","customer_name":"Тест","customer_phone":"0501112233"},"call":{"call_id":"test-1","from_number":"+380501112233","direction":"inbound"}}'
```

Ожидаем: `"error": "no_consent"`.

## 5. Бронь

Тот же запрос, добавьте в `args` `"consent": true`. Ожидаем `"ok": true`, `booking_id` и `table`; в календаре появилось событие «Бронь: 2 гост. — Тест»; в Telegram пришло «Новая бронь».

## 6. Повтор того же запроса

Отправьте запрос 5 ещё раз. Ожидаем тот же `booking_id`; второго события в календаре нет.

## 7. Поиск брони

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"name":"find_booking","args":{"customer_phone":"0501112233"},"call":{"call_id":"test-2","from_number":"+380501112233","direction":"inbound"}}'
```

## 8. Компания выросла

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"name":"reschedule_booking","args":{"booking_id":"ВСТАВЬТЕ_booking_id","customer_phone":"0501112233","new_slot_start":"ТОТ_ЖЕ_slot_start","guests":6},"call":{"call_id":"test-3","from_number":"+380501112233","direction":"inbound"}}'
```

Ожидаем: `"ok": true` и стол на большую компанию — или отказ с вариантами, если он занят. Прежняя бронь при отказе не меняется.

## 9. Отмена с чужого номера — отказ

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"name":"cancel_booking","args":{"booking_id":"ВСТАВЬТЕ_booking_id","customer_phone":"0501112233"},"call":{"call_id":"test-4","from_number":"+380990000000","direction":"inbound"}}'
```

Ожидаем: `"error": "caller_mismatch"`; событие на месте.

## 10. Отмена со своего номера

Тот же запрос с `"from_number":"+380501112233"`. Ожидаем `"ok": true`; событие отменено; в Telegram — «Отмена брони».

## 11. Просьба перезвонить

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"name":"request_callback","args":{"customer_name":"Тест","customer_phone":"0501112233","topic":"банкет на двадцать человек"},"call":{"call_id":"test-5","from_number":"+380501112233","direction":"inbound"}}'
```

Ожидаем: `"ok": true` и сообщение в Telegram.

## 12. Формат Vapi

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"message":{"type":"tool-calls","toolCallList":[{"id":"tc_1","type":"function","function":{"name":"check_availability","arguments":{"guests":4,"date":"tomorrow"}}}],"call":{"id":"test-6","customer":{"number":"+380501112233"}}}}'
```

Ожидаем: `{"results":[{"toolCallId":"tc_1","result":"…"}]}`.

## 13. Формат ElevenLabs

```bash
curl -s -X POST "$N8N?tool=check_availability" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"guests":"4","date":"tomorrow","caller_number":"+380501112233","conversation_id":"test-7"}'
```

## После проверки

Удалите тестовые события из календаря.
