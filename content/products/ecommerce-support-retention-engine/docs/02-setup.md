# Настройка

Все настройки — в узле **Config**.

## Магазин и доступ

| Параметр | Что это |
|---|---|
| `store_name`, `about`, `store_url` | название и описание для инструкции ассистента и писем |
| `support_hours`, `contact_fallback` | рабочее время менеджеров и почта на случай лимита |
| `timezone_offset_hours` | ваш часовой пояс относительно UTC — для тихих часов |
| `platform` | `shopify`, `woocommerce` или `sheets` |
| `shopify_base`, `shopify_api_version` | `https://магазин.myshopify.com` и версия Admin API (по умолчанию `2026-10`) |
| `woo_base` | адрес сайта WooCommerce, по https |
| `spreadsheet_id`, `team_chat_id` | таблица и чат команды |
| `agent_token` | ключ чата и вебхука событий корзины. С заглушкой оба вебхука отвечают 401 |
| `unsubscribe_secret` | подписывает ссылки «отписаться». Смените его — и старые ссылки перестанут работать |
| `public_n8n_url` | адрес n8n для ссылки «отписаться» |
| `debug_token` | для evals; пусто — выключено |

Лимиты ассистента (`max_message_chars`, `rate_limit_*`, `daily_agent_runs`, `handoff_pause_minutes`), `kb_min_score`, `canary` и `forbidden` работают как в Customer Support Agent — смысл каждого в `docs/04-returns.md` и `docs/08-evals-and-operations.md`.

## Возвраты — `returns`

| Параметр | По умолчанию |
|---|---|
| `window_days` — дней с доставки | 14 |
| `require_unused` — только неиспользованный товар | true |
| `final_sale_tags` — теги заказа или товара «без возврата» | `final-sale`, `распродажа`, `sale-final` |
| `non_returnable_types` — типы товаров без возврата | сертификаты, бельё, гигиена |
| `human_review_over` — заказы дороже идут к менеджеру | 10000 |

Подробно — `docs/04-returns.md`.

## Письма

| Параметр | Что это |
|---|---|
| `email.from`, `email.reply_to` | отправитель и куда приходят ответы покупателей |
| `quiet_hours` | `[22, 8]` — не отправлять с 22:00 до 8:00 по вашему времени. `[0, 0]` — без тихих часов |
| `carts.*` | `enabled`, `require_consent`, `first_after_minutes`, `second_after_hours`, `max_age_hours`, `min_total`, `discount_code`, `ai_personalize`, `per_run_limit` |
| `reviews.*` | `enabled`, `days_after_delivery`, `max_age_days`, `require_consent`, `review_url`, `per_run_limit` |

`review_url` — ссылка на отзыв. `{handle}` заменяется на handle первого товара заказа (только Shopify), `{order}` — на номер заказа. Если у вас отзывы на Google Maps или в Trustpilot, поставьте туда их ссылку без подстановок.

## Листы

| Лист | Колонки |
|---|---|
| Policies | `id, question, answer, tags, updated` |
| Orders | `order_id, email, phone, status, items, total, currency, delivered_at, tracking, tags, consent` |
| Returns | `created, rma, status, decision, order_id, email, items, reason, condition, reasons, session_id, channel` |
| Carts | `time, event, cart_id, email, name, consent, items, total, currency, checkout_url` |
| Messages | `time, kind, ref, email, step, status, subject, detail` |
| Suppress | `time, email, source` |
| Log | `time, session_id, channel, message, reply, tools, handoff, flags, rma` |

В листе **Orders**:
- `items` — товары через `;` в виде `Название ×количество [тип]`, например `Плед ×1 [Текстиль]; Сертификат ×1 [Подарочный сертификат]`. Тип нужен для правил возврата;
- `delivered_at` — дата вручения: `ГГГГ-ММ-ДД` или `ДД.ММ.ГГГГ`. Пусто — не доставлен;
- `tags` — через запятую, например `final-sale`;
- `consent` — `yes`, если покупатель согласен на рассылку.

## Ключи по платформам

| Платформа | Тип ключа в n8n | Узлы |
|---|---|---|
| Shopify | Header Auth: `X-Shopify-Access-Token` | Shopify Order, Fetch Checkouts, Fetch Delivered |
| WooCommerce | Basic Auth: consumer key / secret | Woo Order, Fetch Completed |
| Google | Google Sheets OAuth2 | все узлы листов |
| Почта | SMTP | Send Cart Email, Send Review Email |
| Telegram | Telegram | Telegram Trigger, Team Alert, Notify Team, Notify Returns, Send Reply |
| Модель | OpenAI или Anthropic | OpenAI Chat Model, Copy Model |

Узлы платформ, которые вы не используете, можно оставить без ключа: в них не заходит ни один запрос.

## WooCommerce: что учесть

- «Выполнен» (`completed`) движок считает доставленным заказом, дату берёт из `date_completed`. Если вы ставите «Выполнен» при отправке, а не при вручении, увеличьте `reviews.days_after_delivery` и `returns.window_days` на срок доставки.
- Тип товара в заказе WooCommerce не приходит: правила `non_returnable_types` к нему не применяются. Невозвратные товары отмечайте через финальную распродажу или передавайте менеджеру.
- Трек-номер берётся из плагина WooCommerce Shipment Tracking (`_wc_shipment_tracking_items`), если он стоит.

## Публикация и ошибки

Публикуйте воркфлоу — расписания, Telegram и вебхуки работают только у опубликованного. В Settings → Error workflow выберите Error Alert: сбой магазина или таблицы во время рассылки придёт в Telegram. Сбой магазина во время диалога ассистент переживает сам: отвечает «магазин сейчас не отвечает» и шлёт команде сигнал с текстом ошибки.
