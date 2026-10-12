# Готовые запросы к бэкенду

Проверяют бэкенд без телефона. Замените адрес и секрет. Секрет держите в переменной окружения:

```bash
export N8N=https://ВАШ-N8N/webhook/voice-tools
```

```bash
export SECRET=ваш-секрет
```

Запросы — в формате Retell: он самый короткий. `from_number` — номер «звонящего».

## 1. Свободное время на завтра

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"name":"check_availability","args":{"service_id":"haircut_women","date":"tomorrow"},"call":{"call_id":"test-1","from_number":"+380501112233","direction":"inbound"}}'
```

Ожидаем: `"ok": true` и до трёх вариантов в `slots` из вашего календаря.

## 2. Без секрета — отказ

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$N8N" -H "Content-Type: application/json" -d '{}'
```

Ожидаем: `403`. Если пришло `200` — вебхук не защищён, запускать нельзя.

## 3. Запись без подтверждения — отказ

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"name":"create_booking","args":{"service_id":"haircut_women","slot_start":"ВСТАВЬТЕ_slot_start","customer_name":"Тест","customer_phone":"0501112233"},"call":{"call_id":"test-1","from_number":"+380501112233","direction":"inbound"}}'
```

Ожидаем: `"error": "no_consent"`.

## 4. Запись

Тот же запрос, добавьте в `args` `"consent": true`. Ожидаем `"ok": true` и `booking_id`; в календаре появилось событие; в Telegram пришло «Новая запись».

## 5. Повтор того же запроса

Отправьте запрос 4 ещё раз. Ожидаем тот же `booking_id`; второго события в календаре нет.

## 6. Поиск записи

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"name":"find_booking","args":{"customer_phone":"0501112233"},"call":{"call_id":"test-2","from_number":"+380501112233","direction":"inbound"}}'
```

## 7. Отмена с чужого номера — отказ

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"name":"cancel_booking","args":{"booking_id":"ВСТАВЬТЕ_booking_id","customer_phone":"0501112233"},"call":{"call_id":"test-3","from_number":"+380990000000","direction":"inbound"}}'
```

Ожидаем: `"error": "caller_mismatch"`; событие на месте.

## 8. Отмена со своего номера

Тот же запрос с `"from_number":"+380501112233"`. Ожидаем `"ok": true`; событие отменено; в Telegram — «Отмена записи».

## 9. Просьба перезвонить

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"name":"request_callback","args":{"customer_name":"Тест","customer_phone":"0501112233","topic":"проверка связи"},"call":{"call_id":"test-4","from_number":"+380501112233","direction":"inbound"}}'
```

Ожидаем: `"ok": true` и сообщение в Telegram.

## 10. Формат Vapi

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"message":{"type":"tool-calls","toolCallList":[{"id":"tc_1","type":"function","function":{"name":"check_availability","arguments":{"service_id":"haircut_women","date":"tomorrow"}}}],"call":{"id":"test-5","customer":{"number":"+380501112233"}}}}'
```

Ожидаем: `{"results":[{"toolCallId":"tc_1","result":"…"}]}`.

## 11. Формат ElevenLabs

```bash
curl -s -X POST "$N8N?tool=check_availability" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"service_id":"haircut_women","date":"tomorrow","caller_number":"+380501112233","conversation_id":"test-6"}'
```

## После проверки

Удалите тестовые события из календаря.
