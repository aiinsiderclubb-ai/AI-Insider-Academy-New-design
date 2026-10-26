# Проверочные запросы

```bash
export SUPPORT=https://ВАШ-N8N/webhook/support
```

```bash
export TOKEN=ваш-web_token
```

## 1. Вопрос с сайта, ответ есть в FAQ

```bash
curl -s -X POST "$SUPPORT" -H "Content-Type: application/json" \
  -d '{"token":"'$TOKEN'","name":"Тест","email":"test@example.com","message":"Сколько идёт доставка?"}'
```

Режим `draft`: ответ `{"ok":true,"answer":"","message":"Спасибо!…"}`; в чате команды — черновик с кнопками; в таблице — `draft_ready`.
Режим `auto` и категория разрешена: в `answer` — ответ бота; в чате — «Отвечено ботом»; в таблице — `answered`.

## 2. Вопроса нет в FAQ

```bash
curl -s -X POST "$SUPPORT" -H "Content-Type: application/json" \
  -d '{"token":"'$TOKEN'","email":"test@example.com","message":"Вы работаете с юрлицами из Польши?"}'
```

Ожидаем: в чате команды «ответа в FAQ нет — ответьте сами»; статус `new`.

## 3. Запрещённая тема

```bash
curl -s -X POST "$SUPPORT" -H "Content-Type: application/json" \
  -d '{"token":"'$TOKEN'","email":"test@example.com","message":"Верните деньги за заказ"}'
```

Ожидаем: даже в режиме `auto` — черновик или «ответьте сами», с причиной.

## 4. Без токена

```bash
curl -s -w " %{http_code}\n" -X POST "$SUPPORT" -H "Content-Type: application/json" -d '{"message":"test"}'
```

Ожидаем: `403`.

## 5. Telegram

Напишите боту `/start`, затем вопрос из FAQ. Нажмите «Отправить» под черновиком в чате команды — ответ придёт вам в личные сообщения.

## 6. Ответ команды

В чате команды ответьте на сообщение бота любым текстом — он придёт клиенту.

## 7. Почта

Отправьте письмо на ящик поддержки. В течение минуты — обращение в таблице и сообщение в чате. Отправьте автоответ («Автоответ: в отпуске») — его воркфлоу должен пропустить.

После проверки удалите тестовые строки из `Tickets`.
