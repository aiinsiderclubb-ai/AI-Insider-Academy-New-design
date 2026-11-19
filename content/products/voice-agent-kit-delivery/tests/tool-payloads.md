# Готовые запросы к бэкенду

Проверяют бэкенд без телефона. Замените адрес и секрет. Секрет держите в переменной окружения:

```bash
export N8N=https://ВАШ-N8N/webhook/voice-tools
```

```bash
export SECRET=ваш-секрет
```

Запросы — в формате Retell: он самый короткий. `from_number` — номер «звонящего». Номера ниже — из примеров в `data/orders-template.csv`; на них же стоят заказы A-1001 и A-1002.

## 1. Найти заказ

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"name":"find_order","args":{"customer_phone":"0501112233"},"call":{"call_id":"test-1","from_number":"+380501112233","direction":"inbound"}}'
```

Ожидаем: `"ok": true` и заказ A-1001 с адресом и интервалом.

## 2. Без секрета — отказ

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$N8N" -H "Content-Type: application/json" -d '{}'
```

Ожидаем: `403`. Если пришло `200` — вебхук не защищён, запускать нельзя.

## 3. Чужой номер — отказ

Запрос 1 с `"from_number":"+380990000000"`. Ожидаем: `"error": "caller_mismatch"`.

## 4. Изменить состав — отказ

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"name":"change_items","args":{"order_id":"A-1001","items":"ещё пачка"},"call":{"call_id":"test-2","from_number":"+380501112233","direction":"inbound"}}'
```

Ожидаем: `"error": "unknown_tool"`.

## 5. Подтверждение без «да» — отказ

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"name":"confirm_delivery","args":{"order_id":"A-1001","customer_phone":"0501112233"},"call":{"call_id":"test-3","from_number":"+380501112233","direction":"inbound"}}'
```

Ожидаем: `"error": "no_consent"`.

## 6. Подтверждение

Тот же запрос, добавьте в `args` `"consent": true`. Ожидаем `"ok": true`; в таблице `confirmed = да` и строка в `history`.

## 7. Уточнение для курьера

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"name":"update_address","args":{"order_id":"A-1001","customer_phone":"0501112233","intercom":"12К","courier_note":"позвонить за 10 минут","consent":true},"call":{"call_id":"test-4","from_number":"+380501112233","direction":"inbound"}}'
```

Ожидаем: новый адрес целиком в ответе; в Telegram — «Уточнение для курьера».

## 8. Город вне зоны — отказ

Запрос 7 с `"city":"Львов","address":"площадь Рынок, 1"` вместо домофона. Ожидаем: `"error": "outside_zone"`.

## 9. Свободные интервалы

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"name":"check_windows","args":{"order_id":"A-1001","customer_phone":"0501112233","date":"tomorrow"},"call":{"call_id":"test-5","from_number":"+380501112233","direction":"inbound"}}'
```

Ожидаем: интервалы в `windows`. Если дата в шаблоне уже прошла — поставьте в таблице `delivery_date` на завтра.

## 10. Перенос интервала

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"name":"change_window","args":{"order_id":"A-1001","customer_phone":"0501112233","date":"ДАТА_ИЗ_ОТВЕТА","window_id":"ID_ИЗ_ОТВЕТА","consent":true},"call":{"call_id":"test-6","from_number":"+380501112233","direction":"inbound"}}'
```

Ожидаем: `"ok": true`; в таблице новые `delivery_date` и `window`; в Telegram — «Перенос доставки».

## 11. Формат Vapi, исходящий звонок

```bash
curl -s -X POST "$N8N" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"message":{"type":"tool-calls","toolCallList":[{"id":"tc_1","type":"function","function":{"name":"find_order","arguments":{"customer_phone":"+380671234567"}}}],"call":{"id":"test-7","customer":{"number":"+380671234567"}}}}'
```

Ожидаем: `{"results":[{"toolCallId":"tc_1","result":"…A-1002…"}]}`.

## 12. Формат ElevenLabs

```bash
curl -s -X POST "$N8N?tool=find_order" -H "Content-Type: application/json" -H "X-Voice-Secret: $SECRET" \
  -d '{"customer_phone":"0501112233","caller_number":"+380501112233","conversation_id":"test-8"}'
```

## После проверки

Удалите строки-примеры из таблицы.
