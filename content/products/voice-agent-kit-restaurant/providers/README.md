# Конфигурации провайдеров

Три провайдера на выбор. Нужен один.

| Файл | Что это |
|---|---|
| `vapi-tools.json` | Шесть инструментов для `POST https://api.vapi.ai/tool` — по одному объекту на запрос |
| `vapi-assistant.json` | Ассистент для `POST https://api.vapi.ai/assistant` |
| `retell-llm.json` | Модель с промптом и инструментами для создания Retell LLM |
| `retell-agent.json` | Агент Retell, который ссылается на созданную модель |
| `elevenlabs-agent.json` | Агент ElevenLabs |
| `elevenlabs-tools.md` | Лист заполнения инструментов в панели ElevenLabs |

Всё, что начинается с `REPLACE`, замените своим значением. Модели, голоса и распознавание выбирайте в панели провайдера: их список меняется чаще, чем этот набор.

## Что сверено с документацией

Поля сверены с официальной документацией провайдеров 2026-10-08.

**Vapi — сверено:** форма инструмента (`type`, `function`, `server.url`), привязка через `model.toolIds`, тело запроса `message.type: "tool-calls"` с `toolCallList`, ответ `results[].toolCallId` и `result`, код ответа 200 при любом исходе, авторизация через `server.credentialId`, поля `firstMessage`, `firstMessageMode`, `endCallMessage`, `maxDurationSeconds`, `backgroundSound`, `artifactPlan.recordingEnabled`, `server`, `serverMessages`, встроенный инструмент `endCall`.

**Vapi — давно существующие поля, не перепроверялись в этот день:** состав `model` (`provider`, `model`, `messages`, `temperature`), `voice`, `transcriber`, `destinations` у `transferCall`. Проверьте их при создании: если API вернёт ошибку по полю, создайте ассистента в панели и вставьте только промпт и инструменты.

**Retell — сверено:** все поля `retell-llm.json` и `retell-agent.json`, включая поля пользовательского инструмента (`url`, `method`, `headers`, `parameters`, `speak_during_execution`, `speak_after_execution`, `timeout_ms`), формат запроса `name` / `args` / `call` и заголовок подписи `X-Retell-Signature`.

**ElevenLabs — сверено:** структура `conversation_config` (`agent`, `prompt`, `tool_ids`, `built_in_tools`, `tts`, `turn`, `conversation`) и `platform_settings` (`evaluation`, `privacy`). Инструменты даны листом заполнения для панели, а не файлом JSON: вложенность схемы инструмента в API подтвердить не удалось.

## Авторизация вебхука

Бэкенд ждёт заголовок `X-Voice-Secret` с вашим секретом.

- **Vapi:** создайте в панели учётные данные типа Bearer Token с именем заголовка `X-Voice-Secret` и выключенным префиксом Bearer. Идентификатор впишите в `credentialId`. Важно: если адрес сервера задан прямо в запросе на звонок, а не в сохранённом ассистенте или инструменте, Vapi секрет не прикладывает — используйте сохранённые инструменты, как в этом наборе.
- **Retell:** секрет стоит в `headers` каждого инструмента.
- **ElevenLabs:** заголовок типа Secret в каждом инструменте.

Секрет — случайная строка от 32 знаков. Не храните его в этих файлах после заполнения и не отправляйте заполненные файлы в переписке.

## Перевод на человека

Номер администратора — в международном формате: `+380501112233`. Проверьте перевод тестовым звонком: у части операторов перевод на мобильный номер из другой страны не проходит.

## Запись разговоров

Во всех трёх конфигурациях запись выключена. Включайте её только после того, как добавили уведомление о записи в переменную `recording_notice` и прочитали `docs/07-privacy-compliance.md`.
