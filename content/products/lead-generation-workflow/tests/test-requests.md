# Проверочные запросы

Замените адрес и токен:

```bash
export LEAD=https://ВАШ-N8N/webhook/lead
```

```bash
export TOKEN=ваш-токен
```

## 1. Обычная заявка (JSON)

```bash
curl -s -X POST "$LEAD" -H "Content-Type: application/json" \
  -d '{"name":"Тест","phone":"050 111 22 33","message":"Хочу узнать цену","token":"'$TOKEN'","source":"test"}'
```

Ожидаем: `{"ok":true,…}`; строка в таблице; сообщение в Telegram.

## 2. Заявка как с Tilda (url-encoded)

```bash
curl -s -X POST "$LEAD?token=$TOKEN" --data-urlencode "Name=Тест Тильда" --data-urlencode "Phone=+38 (050) 222-33-44" --data-urlencode "Comments=Нужно срочно" --data-urlencode "formid=form1"
```

## 3. Неверный токен

```bash
curl -s -w " %{http_code}\n" -X POST "$LEAD" -H "Content-Type: application/json" -d '{"name":"Тест","phone":"0501112233","token":"wrong"}'
```

Ожидаем: `403`.

## 4. Нет контактов

```bash
curl -s -w " %{http_code}\n" -X POST "$LEAD" -H "Content-Type: application/json" -d '{"name":"Тест","token":"'$TOKEN'"}'
```

Ожидаем: `422` и «Укажите телефон или email».

## 5. Повторная заявка

Повторите запрос 1 через три минуты с другим сообщением. Ожидаем: в таблице та же строка, `touches` = 2; в Telegram «Повторное обращение».

## 6. Двойной клик

Повторите запрос 1 сразу, с тем же сообщением. Ожидаем: ничего нового.

## 7. Спам

```bash
curl -s -X POST "$LEAD" -H "Content-Type: application/json" \
  -d '{"name":"Bot","email":"x@mailinator.com","message":"casino","website":"http://spam","token":"'$TOKEN'"}'
```

Ожидаем: ответ `ok`; строка со статусом `spam`; в Telegram ничего.

## 8. Тестовый запрос конструктора

```bash
curl -s -X POST "$LEAD" -d "test=test"
```

Ожидаем: `{"ok":true,"message":"ok"}`, в таблице ничего.

После проверки удалите тестовые строки из таблицы.
