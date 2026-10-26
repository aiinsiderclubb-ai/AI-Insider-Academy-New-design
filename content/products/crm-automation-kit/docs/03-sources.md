# Источники заявок

Адрес для всех источников: `https://ВАШ-N8N/webhook/crm-lead`. Токен из `intake_token` — в поле `token`, в заголовке `X-CRM-Token` или в адресе `?token=`.

Поля распознаются по названиям:

| Поле | Варианты названий |
|---|---|
| Имя | `name`, `Name`, `имя`, `fio`, `full_name` |
| Телефон | `phone`, `Phone`, `телефон`, `tel`, `mobile` |
| Почта | `email`, `Email`, `mail`, `почта` |
| Компания | `company`, `компания`, `organization` |
| Запрос | `need`, `message`, `Comments`, `comment`, `сообщение`, `summary` |
| Сумма | `amount`, `budget`, `бюджет`, `value` |
| Источник | `source`, `utm_source` |

Нужен телефон или почта; без них — ответ 422. Успешный ответ: `{"ok": true, "id": "D261026-3", "duplicate": false}`.

## Tilda

1. Настройки сайта → Формы → Webhook.
2. Адрес: `https://ВАШ-N8N/webhook/crm-lead?token=ВАШ-ТОКЕН`.
3. Tilda отправит тестовый запрос — CRM ответит «ok» и ничего не запишет.
4. В настройках формы отметьте Webhook. Поля `Name`, `Phone`, `Email`, `Comments` распознаются сами. Добавьте скрытое поле `source` со значением `tilda`.

## Своя форма на сайте

```html
<form method="post" action="https://ВАШ-N8N/webhook/crm-lead?token=ВАШ-ТОКЕН">
  <input name="name" placeholder="Имя">
  <input name="phone" placeholder="Телефон" required>
  <textarea name="message" placeholder="Что нужно?"></textarea>
  <input type="hidden" name="source" value="site">
  <button>Отправить</button>
</form>
```

Токен в форме виден в коде страницы. Он защищает от случайных запросов, но не от целенаправленного спама; если спам появится — принимайте заявки через набор Lead Generation (там фильтр спама) и передавайте их в CRM оттуда.

## Набор Lead Generation Workflow

Lead Generation фильтрует спам и оценивает заявки; CRM ведёт их дальше. В воркфлоу «Lead Intake»:

1. После узла **Write Sheet** (выход success) добавьте узел IF с условием `{{ !$('Score Lead').first().json.spam }}` — спам в CRM не нужен.
2. К ветке true подключите HTTP Request:
   - Method: POST, URL: `https://ВАШ-N8N/webhook/crm-lead`
   - Send Headers: `X-CRM-Token` = ваш токен
   - Body Content Type: JSON, тело:

```
{{ JSON.stringify({ name: $('Parse Lead').first().json.lead.name, phone: $('Parse Lead').first().json.lead.phone, email: $('Parse Lead').first().json.lead.email, need: $('Parse Lead').first().json.lead.message, source: $('Parse Lead').first().json.lead.source }) }}
```

## Набор WhatsApp Sales Bot

Клиента, которого бот передал менеджерам, можно сразу заводить сделкой. В воркфлоу «Bot» к выходу true узла **Tell Managers?** подключите HTTP Request (POST, тот же адрес и заголовок) с телом:

```
{{ JSON.stringify({ name: $('Reply').first().json.client.name, phone: $('Reply').first().json.client.phone, need: $('Reply').first().json.client.need, amount: $('Reply').first().json.client.budget, source: 'whatsapp' }) }}
```

Повторные сообщения того же клиента не создают дублей — они дописываются в историю открытой сделки.

## Make, Zapier, другие сервисы

Модуль HTTP / Webhooks → POST JSON на адрес выше, заголовок `X-CRM-Token`. Например, лиды из Facebook Lead Ads: Make → Facebook Lead Ads «Watch leads» → HTTP «Make a request».

## Проверка из терминала

```bash
curl -s -X POST "https://ВАШ-N8N/webhook/crm-lead" -H "Content-Type: application/json" -H "X-CRM-Token: ВАШ-ТОКЕН" -d '{"name":"Тест","phone":"050 111 22 33","message":"Нужна консультация","source":"test"}'
```
