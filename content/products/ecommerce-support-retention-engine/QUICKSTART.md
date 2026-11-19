# Запуск за 1,5–2 часа

Порядок: таблица → ключи → Config → ассистент → корзины и отзывы. Ассистента можно запустить первым, а рассылки включить позже: `carts.enabled` и `reviews.enabled` в Config.

## 1. Таблица (15 минут)

Создайте Google Таблицу с листами и импортируйте в каждый файл из `templates/` (Файл → Импорт → «Заменить текущий лист»):

| Лист | Файл |
|---|---|
| `Policies` | `policies.csv` — демо-правила, потом замените своими |
| `Returns` | `returns-header.csv` |
| `Carts` | `carts-header.csv` |
| `Messages` | `messages-header.csv` |
| `Suppress` | `suppress-header.csv` |
| `Log` | `log-header.csv` |
| `Orders` | `orders-example.csv` — только для платформы «таблица» и для evals |

ID таблицы — из адреса: `docs.google.com/spreadsheets/d/ЭТО_ID/edit`.

## 2. Ключи (30 минут)

**Shopify.** Админка → Settings → Apps and sales channels → Develop apps → Create an app → Configure Admin API scopes: `read_orders`, `read_customers`, `read_products`. Брошенные корзины читаются с тем же `read_orders`; у владельца приложения должно быть право управлять брошенными оформлениями (manage abandoned checkouts) — у владельца магазина оно есть. Заказы старше 60 дней Shopify отдаёт только с правом `read_all_orders` — ассистенту обычно хватает свежих. Install app → скопируйте Admin API access token. В n8n создайте ключ **Header Auth**: Name `X-Shopify-Access-Token`, Value — токен. Выберите его в узлах **Shopify Order**, **Fetch Checkouts**, **Fetch Delivered**.

> Если у вас включены встроенные письма Shopify о брошенной корзине, выключите их (Settings → Notifications → Abandoned checkout), иначе покупатель получит два письма.

**WooCommerce.** WooCommerce → Settings → Advanced → REST API → Add key, права Read. В n8n — ключ **Basic Auth**: User — Consumer key, Password — Consumer secret. Выберите его в узлах **Woo Order**, **Fetch Completed**.

**Остальное:**
- **Google Sheets OAuth2** — во все узлы `Read …`, `Append …`, `Log …`, `Sheet Orders`.
- **Telegram** — в Telegram Trigger, Team Alert, Notify Team, Notify Returns, Send Reply.
- **SMTP** — в Send Cart Email и Send Review Email: данные почтового ящика, с которого пишет магазин.
- **OpenAI** — в OpenAI Chat Model и Copy Model. Для Claude — `docs/07-models.md`.

## 3. Config (15 минут)

Узел **Config**:
- `store_name`, `about`, `store_url`, `support_hours`, `contact_fallback`, `timezone_offset_hours`;
- `platform` — `shopify`, `woocommerce` или `sheets`; адрес магазина в `shopify_base` или `woo_base`;
- `spreadsheet_id`, `team_chat_id`;
- `agent_token`, `unsubscribe_secret` — две разные длинные случайные строки (`openssl rand -hex 24`);
- `public_n8n_url` — адрес вашего n8n, из него собирается ссылка «отписаться»;
- `email.from`, `email.reply_to`;
- `returns` — ваши правила возврата;
- `carts`, `reviews` — настройки рассылок; `reviews.review_url` — куда вести на отзыв.

Что значит каждый параметр — `docs/02-setup.md`.

Error Alert: впишите ID чата в узел Alert, в движке выберите его в Settings → Error workflow.

## 4. Публикация и проверка ассистента (15 минут)

Нажмите **Publish**. Проверьте заказ — подставьте номер и email реального заказа:

```bash
curl -X POST 'https://ВАШ-N8N/webhook/store-agent' \
  -H 'Content-Type: application/json' -H 'x-agent-token: ВАШ_AGENT_TOKEN' \
  -d '{"session_id":"test-0001","message":"Где мой заказ 1001? почта anna@example.com"}'
```

Ответ — статус заказа. Если пришло «магазин сейчас не отвечает» — в листе `Log` в колонке `flags` будет `service_error`, а в чат команды придёт текст ошибки: неверный токен, адрес или версия API.

Проверьте возврат: «Хочу вернуть …, заказ …, почта …, не пользовался». Ассистент скажет, подходит ли возврат, и после согласия создаст заявку — она появится в листе `Returns` и в чате команды.

## 5. Рассылки (15 минут)

1. Корзины: на Shopify ничего больше не нужно. На WooCommerce и других платформах сайт должен сообщать о корзинах на вебхук `store-cart-event` — формат в `docs/03-channels-and-events.md`.
2. Проверьте одно письмо на себе: положите товар в корзину с вашим email и согласием на рассылку, через час проверьте почту.
3. Отзывы придут сами на следующий день в 11:00 — тем, кому доставили заказ `days_after_delivery` дней назад.

Все отправки видны в листе `Messages`.

## 6. Evals (15 минут)

Evals идут на демо-данных:
1. временно поставьте `platform: 'sheets'`;
2. в листе `Orders` у заказов 5001, 5003 и 5005 замените `ПОСТАВЬТЕ_ВЧЕРАШНЮЮ_ДАТУ` на вчерашнюю дату в виде `ДД.ММ.ГГГГ`;
3. задайте `debug_token`;
4. запустите:

```bash
python3 evals/run_evals.py --url 'https://ВАШ-N8N/webhook/store-agent' --token ВАШ_AGENT_TOKEN --debug-token ВАШ_DEBUG_TOKEN
```

Потом верните свою платформу. Подробно — `docs/08-evals-and-operations.md`.
