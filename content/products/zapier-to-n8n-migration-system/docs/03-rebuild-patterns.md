# Паттерны переноса

## Основы

| Zapier / Make | n8n | На что смотреть |
|---|---|---|
| Trigger (instant) / Webhook | Webhook или Trigger-узел сервиса | Новый адрес — переключить у отправителя в день переноса |
| Trigger (polling) / Watch | Trigger-узел сервиса (опрос) или Schedule + запрос | Первый запуск может взять старые записи — фильтр по дате |
| Filter | Filter или If | В Zapier zap останавливается молча; в n8n у If две ветки |
| Paths / Router | Switch | Make Router выполняет все подходящие ветки — в Switch включите «Send data to all matching outputs» |
| Formatter / функции Make | Выражения `{{ }}`, Edit Fields, Date & Time | Даты: формат и часовой пояс задаются явно |
| Delay / Sleep | Wait | Долгие ожидания (дни) — лучше Schedule + таблица |
| Looping / Iterator | Split Out | n8n и так обрабатывает массив поэлементно |
| Aggregator / Text aggregator | Aggregate, Summarize | |
| Code by Zapier | Code | Вход — `$input.all()`, выход — `[{ json: … }]` |
| Storage / Data store | Static data, Google Sheets, Postgres | Перенесите текущие значения |
| Digest | Таблица-накопитель + Schedule | |
| Sub-Zap / сценарий-вызов | Execute Workflow | |
| Autoreplay / обработка ошибок | Retry On Fail + Error Workflow | Повтор на HTTP-узлах, сообщение о сбое — всегда |
| Tables, Interfaces, Chatbots | Нет прямого аналога | Решение с клиентом: Sheets/Airtable, n8n Form, Chat Trigger |

## Что ломается чаще всего

1. **Первый запуск опроса.** Триггер «новая строка» или «новое письмо» при включении может обработать то, что уже есть. Включайте после фильтра «создано после даты переключения».
2. **Часовые пояса.** Zapier и Make показывают время в поясе аккаунта; n8n — в поясе воркфлоу (Settings → Timezone). Задайте явно.
3. **Пустые поля.** Zapier пропускает пустые значения, n8n передаёт `undefined` или пустую строку. Проверьте обязательные поля CRM.
4. **Массивы.** Zapier «склеивает» массивы в строку через запятую (line items). В n8n это массив — нужен Split Out или `join(', ')`.
5. **Дубли.** Zapier дедуплицирует опрашивающие триггеры по id. В n8n узлы-триггеры тоже помнят последний элемент, но после ручного перезапуска или правки — проверяйте.
6. **Лимиты API.** Make по умолчанию выполняет по одной операции за раз, n8n — пачками. Для сервисов со строгими лимитами — Loop Over Items с паузой или Batching в HTTP Request.
7. **Ответ вебхука.** Если отправителю нужен ответ (Tilda, Make Webhook Response), используйте Respond to Webhook.

## Как называть и хранить

- Воркфлоу: `Zapier · Название zap'а` или `Make · Название сценария`, теги по волне.
- Описание воркфлоу (Settings → Description): откуда перенесён, дата, ответственный.
- Экспорт готовых воркфлоу (JSON) — в репозиторий клиента или папку проекта: это и бэкап, и передача.
