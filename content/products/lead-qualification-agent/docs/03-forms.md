# Подключение форм

Адрес — Production URL узла **Lead Webhook**: `https://ВАШ-N8N/webhook/lead-qualification`. Токен — в заголовке `x-agent-token`, в поле `token` формы или в адресе `?token=…`.

## Поля

Распознаются без настройки (регистр, пробелы, дефисы и подчёркивания не важны):

| Что | Названия полей |
|---|---|
| имя | name, имя, fullname, your-name, contact_name |
| email | email, e-mail, почта, mail |
| телефон | phone, телефон, tel, phone_number, mobile |
| компания | company, компания, organization, company_name |
| сайт | website, сайт, site, url, company_website |
| сообщение | message, сообщение, comment(s), комментарий, text, request, запрос |
| бюджет | budget, бюджет |
| источник | source, utm_source, источник, form_name, form |
| ловушка для ботов | hp, honeypot, fax, company_website_hp — должно быть пустым |

Нужен хотя бы email или телефон, иначе 400.

## Своя HTML-форма

`templates/lead-form.html` — форма с ловушкой для ботов и отправкой без перезагрузки страницы. Впишите адрес и токен.

## Tilda

Настройки сайта → Формы → Webhook: адрес `https://ВАШ-N8N/webhook/lead-qualification?token=ВАШ_AGENT_TOKEN`. Tilda отправляет `application/x-www-form-urlencoded` — это поддерживается. Перед сохранением Tilda шлёт тестовый запрос `test=test`: он получит ответ 200 и в CRM не попадёт.

## Webflow, WordPress (Contact Form 7, Elementor, WPForms), Google Forms, Typeform

Любой способ, который умеет POST на адрес: вебхук в настройках формы, плагин webhooks или Make/Zapier. Токен — в адресе `?token=…`.

## Из своей системы

```bash
curl -X POST 'https://ВАШ-N8N/webhook/lead-qualification' \
  -H 'Content-Type: application/json' -H 'x-agent-token: ВАШ_AGENT_TOKEN' \
  -d '{"name":"Анна","email":"anna@acme.com","company":"Acme","website":"acme.com","message":"Нужна CRM на 20 человек","budget":"5000","source":"partner"}'
```

Ответ — сразу: `202 {"ok": true, "lead_id": "L-…"}`. Оценка, CRM и карточка — в следующие 10–60 секунд, в зависимости от модели и сайта лида.

**Про токен в форме.** Если форма отправляет напрямую из браузера, токен виден в коде страницы. Он отсекает случайные запросы, но не секрет. От ботов защищают ловушка и проверка двойного клика; от перерасхода модели — лимит у провайдера модели.
