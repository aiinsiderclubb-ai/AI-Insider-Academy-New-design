# Настройка

## Config

| Параметр | Что это | По умолчанию |
|---|---|---|
| `company`, `about`, `city` | агентство и чем занимается | — |
| `support_hours`, `contact_fallback` | рабочее время и телефон для клиентов | — |
| `timezone` | часовой пояс просмотров и follow-up | `Europe/Kyiv` |
| `currency` | валюта цен в Listings и бюджетов по умолчанию | `USD` |
| `phone_country` | код страны для номеров, начинающихся с 0 | `380` |
| `mortgage_partner` | кому агент адресует вопросы об ипотеке | — |
| `spreadsheet_id`, `team_chat_id` | таблица и чат агентства | — |
| `agents` | риелторы: `id`, `name`, `calendar_id`, `chat_id`, `areas`, `deal_types` | три примера |
| `viewing_minutes` | длительность просмотра | 60 |
| `buffer_minutes` | зазор до и после других событий риелтора | 30 |
| `lead_time_minutes` | не раньше, чем через столько от текущего момента | 120 |
| `booking_window_days` | на сколько дней вперёд | 21 |
| `offer_slots` | сколько вариантов времени предлагать | 3 |
| `viewing_hours` | часы просмотров по дням; `null` — выходной | пн–пт 10–19, сб 11–16 |
| `hot_score` | с какого балла лид горячий | 70 |
| `follow_up_days`, `follow_up_texts` | через сколько дней тишины и чем напоминать | 1, 3, 7 дней |
| `agent_token`, `debug_token` | ключ вебхука и ключ для evals | — |
| `max_message_chars`, `rate_limit_*`, `daily_agent_runs`, `handoff_pause_minutes` | ограничения | 2000; 20 за 10 мин; 1000; 30 |
| `forbidden` | запрещённые обещания: торг, скидки, ипотека, гарантии | — |
| `canary` | служебная метка в инструкции | `RE-48-CANARY` |

## Риелторы

```js
agents: [
  { id: 'maria', name: 'Мария', calendar_id: 'maria@agency.ua', chat_id: '123456789', areas: ['Печерский'], deal_types: ['buy'] },
],
```

- `id` — то же, что в колонке `agent_id` листа `Listings`. Тест набора проверяет, что у каждого демо-объекта есть риелтор в Config, — у себя проверьте глазами.
- `calendar_id` — календарь, в который пишутся просмотры. Всё, что в нём есть, считается занятым временем риелтора.
- `chat_id` — личный чат риелтора с ботом для записей на просмотр и горячих лидов. Пусто — в чат агентства.
- `areas`, `deal_types` — лид без конкретного объекта попадает к риелтору с подходящим районом и типом сделки; если таких несколько или нет — по очереди (стабильно для одного диалога).

## Листы

**Listings** — `listing_id | status | deal_type | property_type | city | area | address | rooms | area_m2 | price | currency | floor | description | url | agent_id | features`. Подробно — `agent/matching-and-presentation.md`.

**Leads** — 27 колонок: `created | lead_id | session_id | channel | source | name | phone | email | telegram | deal_type | property_type | area | rooms | budget_max | currency | timeline | mortgage | score | segment | agent_id | stage | listing_ids | viewing_id | last_contact | follow_ups | notified | notes`. Карточка обновляется на месте — строка ищется по `session_id`, а если её нет — по телефону.

Этапы `stage`: `new` → `qualified` (известны цель, район, бюджет) → `matched` (показаны объекты) → `viewing_booked`. Дальше ведите сами: `visited`, `offer`, `deal`, `lost` — follow-up таких не трогает.

**Viewings** — `created | viewing_id | listing_id | slot_start | agent_id | name | phone | session_id | address | status`. Статус `scheduled`; после просмотра ставьте `done` или `no_show` — это нужно для дашборда.

**Log** — `time | session_id | channel | message | reply | tools | handoff | flags | listing_ids`.

## Ключи

| Узлы | Ключ |
|---|---|
| OpenAI Chat Model / Anthropic Chat Model | модель |
| Read Leads, Save Lead, Read Listings Data, Save Matches, Read Listings, Read Booking Data, Append Viewing, Update Lead, Read Follow-up Data, Save Follow-ups, Log | Google Sheets OAuth2 |
| Free Busy, Find Existing, Recheck Busy, Create Event | Google Calendar OAuth2 |
| Telegram Trigger, Team Alert, Send Reply, Lead Alert, Notify Agent, Notify Team, Team Digest, Send Follow-up | Telegram |

## Публикация

Работает только опубликованный воркфлоу: Production URL, Telegram, расписание follow-up и сохранение лимитов. Follow-up запускается в 10:00 по часовому поясу воркфлоу (Settings → Timezone); время — в узле Follow-up Trigger.
