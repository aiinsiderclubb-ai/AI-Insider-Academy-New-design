# CRM

## Вебхук (по умолчанию)

```json
"lead_sink": {
  "type": "webhook",
  "url": "https://ВАШ-N8N/webhook/crm-lead",
  "token_header": "X-CRM-Token",
  "token_env": "CRM_WEBHOOK_TOKEN",
  "source": "telegram"
}
```

Сервер отправляет POST с JSON:

```json
{
  "name": "Ирина",
  "phone": "+380671234567",
  "email": "",
  "company": "",
  "need": "Сайт для студии йоги",
  "amount": 3000,
  "source": "telegram",
  "telegram": "@irina",
  "chat": "Заявки и продажи",
  "message_link": "https://t.me/c/1234567890/10"
}
```

Токен — в заголовке из `token_header`, значение — из переменной окружения `token_env`. Успех — любой ответ 2xx, в котором нет `"ok": false`. Если в ответе есть `id`, он сохраняется как номер лида и попадает в отчёт агента.

### CRM Automation Kit

Наш CRM Automation Kit принимает именно такой формат: адрес `https://ВАШ-N8N/webhook/crm-lead`, заголовок `X-CRM-Token` с `intake_token`. Дубли по телефону он склеивает сам.

### Свой воркфлоу n8n, Make, Zapier

Webhook-узел, который принимает POST JSON, проверяет заголовок с токеном и создаёт запись: в Google Таблице, Pipedrive, amoCRM, Bitrix24 — где угодно. Ответьте JSON `{"ok": true, "id": "номер"}`.

## HubSpot

У HubSpot есть официальный MCP-сервер (`https://mcp.hubspot.com`) — его подключение описано в нашем MCP Starter Pack for Business. Подключите оба сервера к одному агенту:

1. В `inbox.json` поставьте `"lead_sink": {"type": "none"}`.
2. Измените в запросе агенту пункт «а)»: «заведи контакт в HubSpot через его инструменты, затем вызови `mark_messages` со статусом `lead_external` и номером записи HubSpot в `reason`».

HubSpot сам покажет предложенные изменения и попросит подтверждения перед записью. Проверка «контакт есть в сообщении» в этой схеме не работает — её делает только `create_lead`.

## Без CRM

`"lead_sink": {"type": "none"}` — `create_lead` проверяет контакт и помечает сообщения как лид, но никуда их не отправляет. Подходит для первой недели: менеджер сверяет отчёт агента с чатом и решает, можно ли доверять разбор.
