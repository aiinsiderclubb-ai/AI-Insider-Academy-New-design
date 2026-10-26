# Проверка после запуска

```bash
export CRM=https://ВАШ-N8N/webhook/crm-lead
export TOKEN=ваш-токен
```

## 1. Новая заявка

```bash
curl -s -X POST "$CRM" -H "Content-Type: application/json" -H "X-CRM-Token: $TOKEN" -d '{"name":"Тест","phone":"050 111 22 33","message":"Нужна консультация","budget":"2000","source":"test"}'
```

Ответ `{"ok":true,"id":"D…","duplicate":false}`, строка в `Deals`, карточка менеджеру, сообщение в чат команды.

## 2. Тот же клиент снова

```bash
curl -s -X POST "$CRM" -H "Content-Type: application/json" -H "X-CRM-Token: $TOKEN" -d '{"phone":"+380501112233","message":"Ещё вопрос"}'
```

`"duplicate": true`, та же сделка, новая запись в `history`.

## 3. Как с Tilda

```bash
curl -s -X POST "$CRM?token=$TOKEN" --data-urlencode "Name=Тильда" --data-urlencode "Phone=+38 (050) 222-33-44" --data-urlencode "Comments=Хочу узнать цену" --data-urlencode "source=tilda"
```

## 4. Неверный токен и пустая заявка

```bash
curl -s -w " %{http_code}\n" -X POST "$CRM" -H "Content-Type: application/json" -H "X-CRM-Token: wrong" -d '{"phone":"0501112233"}'
curl -s -w " %{http_code}\n" -X POST "$CRM" -H "Content-Type: application/json" -H "X-CRM-Token: $TOKEN" -d '{"name":"Без контактов"}'
```

403 и 422, ничего не записано.

## 5. Telegram

На карточке: «Связались» → этап и следующий шаг. Ответ «напомнить: через 1 час перезвонить» — через час придёт напоминание (если сейчас рабочее время). `/my` — список сделок.
