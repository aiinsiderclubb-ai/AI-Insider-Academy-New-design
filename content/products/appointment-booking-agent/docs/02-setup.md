# Настройка

Все настройки — в узле **Config**. Меняйте значения справа от двоеточия.

## Компания и тексты

| Параметр | Что это |
|---|---|
| `company`, `about` | от чьего имени говорит агент |
| `team_hours` | когда отвечает команда — агент называет при передаче человеку |
| `contact_fallback` | куда писать, если бот не может помочь |
| `greeting` | ответ на `/start` в Telegram |

## Календарь и расписание

| Параметр | Что это | По умолчанию |
|---|---|---|
| `timezone` | часовой пояс бизнеса, IANA | `Europe/Kyiv` |
| `locale` | язык дат в ответах | `ru-RU` |
| `calendar_id` | `primary` или ID общего календаря (Настройки календаря → Интеграция) | `primary` |
| `hours` | рабочие часы по дням; `null` — выходной | пн–чт 9–18, пт 9–17 |
| `closed_dates` | праздники и отпуска | пусто |
| `slot_step_min` | шаг сетки: встречи начинаются в :00 и :30 | 30 |
| `buffer_min` | свободное время до и после каждой встречи | 15 |
| `lead_time_min` | ближайшая запись — не раньше чем через | 120 |
| `booking_window_days` | на сколько дней вперёд открыта запись | 30 |
| `offer_slots` | сколько вариантов возвращает поиск | 4 |
| `cancel_min_hours`, `late_cancel_note` | поздняя отмена и что сказать клиенту | 12 часов |
| `services` | услуги: `id`, `name`, `duration_min`, `price`, `description` | 3 примера |

Подробно о часах, буферах и часовых поясах — `docs/04-calendar-rules.md`.

**Занятость берётся из всего календаря.** Любое событие в нём — ваша встреча, отпуск, личное дело — блокирует время. Чтобы событие не блокировало, отметьте его в Google «Показывать как: свободен».

## Встреча

| Параметр | Что это |
|---|---|
| `create_meet` | `true` — Google создаёт ссылку Meet в каждом событии |
| `meeting_link` | постоянная ссылка (Zoom, Meet), если `create_meet = false` |
| `address` | адрес для очных встреч; пусто — не используется |
| `invite_customer` | `true` — email клиента добавляется гостем, Google присылает приглашение |

## Подтверждение и напоминания

| Параметр | Что это |
|---|---|
| `confirm_words`, `deny_words` | регулярные выражения: что считается «да» и что его отменяет |
| `reminder_hours` | за сколько часов напоминать: `[24, 2]` |
| `email_reminders` | `true` — напоминания на email клиентам с сайта; нужен SMTP-ключ в узле **Email Reminder** и адрес отправителя в его поле From |

Клиентам из Telegram напоминание приходит в Telegram от того же бота.

## Таблица, команда, доступ

| Параметр | Что это |
|---|---|
| `spreadsheet_id` | Google Таблица с листом `Log` — журнал |
| `team_chat_id` | Telegram-чат команды |
| `notify_team` | сообщения команде о записях, переносах, отменах |
| `agent_token` | ключ вебхука; пока стоит заглушка — вебхук отвечает 401 |
| `debug_token` | ключ для evals; пусто — выключено |
| `max_message_chars`, `rate_limit_*`, `daily_agent_runs`, `handoff_pause_minutes` | лимиты — как в `docs/05-guardrails-and-handoff.md` |
| `forbidden`, `canary` | запрещённые обещания и служебная метка инструкции |

## Ключи

| Узлы | Тип ключа |
|---|---|
| OpenAI Chat Model или Anthropic Chat Model | ключ модели |
| Calendar Read, Calendar Write, Reminders Read, Mark Reminded | Google Calendar OAuth2 — от аккаунта, у которого есть право менять календарь |
| Log | Google Sheets OAuth2 |
| Telegram Trigger, Team Alert, Notify Team, Booking Notice, Send Reply, Telegram Reminder | Telegram |
| Email Reminder | SMTP — только если `email_reminders: true` |

## Публикация

Работает только опубликованный воркфлоу: вебхук, Telegram, расписание напоминаний, лимиты. Воркфлоу **Error Alert** — сигнал, если агент упал: впишите ID чата в его узел Alert и выберите его в Settings → Error workflow агента.
