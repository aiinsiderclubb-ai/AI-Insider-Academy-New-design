// ================= НАСТРОЙКИ МАГАЗИНА =================
// Один узел на весь движок: агент, возвраты, брошенные корзины, отзывы.
// Меняйте только значения справа от двоеточия. Подробно — docs/02-setup.md.
const config = {
  // ---- магазин ----
  store_name: 'Название магазина',
  about: 'Что вы продаёте, одним предложением',
  store_url: 'https://example.com',
  support_hours: 'пн–пт 9:00–18:00 (Киев)',
  contact_fallback: 'support@example.com',
  timezone_offset_hours: 2,          // ваш часовой пояс относительно UTC — для «тихих часов»

  // ---- откуда брать заказы ----
  // 'shopify'     — Shopify Admin GraphQL API (ключ: Header Auth X-Shopify-Access-Token)
  // 'woocommerce' — WooCommerce REST API v3 (ключ: Basic Auth, consumer key и secret)
  // 'sheets'      — лист Orders в Google Таблице
  platform: 'shopify',
  shopify_base: 'https://ВАШ-МАГАЗИН.myshopify.com',
  shopify_api_version: '2026-10',
  woo_base: 'https://ВАШ-САЙТ.com',

  // ---- таблица и команда ----
  spreadsheet_id: 'ВСТАВЬТЕ_ID_ТАБЛИЦЫ',   // листы Policies, Returns, Carts, Messages, Suppress, Log (+ Orders для 'sheets')
  team_chat_id: 'ВСТАВЬТЕ_ID_ЧАТА',

  // ---- доступ ----
  agent_token: 'ЗАМЕНИТЕ_НА_ДЛИННУЮ_СЛУЧАЙНУЮ_СТРОКУ',   // чат на сайте и вебхук событий корзины
  unsubscribe_secret: 'ЗАМЕНИТЕ_НА_ДРУГУЮ_СЛУЧАЙНУЮ_СТРОКУ', // подпись ссылок «отписаться»
  public_n8n_url: 'https://ВАШ-N8N',                        // для ссылки «отписаться» в письмах
  debug_token: '',

  // ---- агент ----
  max_message_chars: 2000,
  rate_limit_messages: 20,
  rate_limit_minutes: 10,
  daily_agent_runs: 1000,
  handoff_pause_minutes: 30,
  kb_min_score: 0.3,
  canary: 'ST-44-CANARY',
  forbidden: [
    '(верн(ём|ем|у)|возврат(им)?|компенсиру(ем|ю)|дадим|предостав(им|лю)|сделаем|оформил[аи]?)[^.!?]{0,40}(деньг|скидк|компенсац|бесплатн|промокод)',
    '(деньги|средства)[^.!?]{0,30}(вернутся|поступят|будут возвращены)',
    'гарантиру(ю|ем)',
    '(refund (is|has been)|we will refund|compensate|give you a discount|guarantee)',
  ],

  // ---- политика возвратов: агент её применяет, но деньги не возвращает никогда ----
  returns: {
    window_days: 14,                 // дней с доставки
    require_unused: true,            // товар не был в использовании
    final_sale_tags: ['final-sale', 'распродажа', 'sale-final'],
    non_returnable_types: ['Подарочный сертификат', 'Gift Card', 'Нижнее бельё', 'Гигиена'],
    human_review_over: 10000,        // заказы дороже — всегда через менеджера (в валюте магазина)
  },

  // ---- письма ----
  email: {
    from: 'Магазин <shop@example.com>',
    reply_to: 'support@example.com',
  },
  quiet_hours: [22, 8],              // не отправлять письма с 22:00 до 8:00 по вашему времени

  // ---- брошенные корзины ----
  carts: {
    enabled: true,
    require_consent: true,           // писать только тем, кто согласился на рассылку
    first_after_minutes: 60,         // первое письмо через час после ухода
    second_after_hours: 24,          // второе — через сутки, если не купил
    max_age_hours: 72,               // старше — не пишем
    min_total: 0,                    // корзины дешевле — не пишем
    discount_code: '',               // промокод во втором письме; пусто — без скидки
    ai_personalize: true,            // модель пишет первую фразу письма; иначе — шаблон
    per_run_limit: 50,
  },

  // ---- запросы отзывов ----
  reviews: {
    enabled: true,
    days_after_delivery: 7,
    max_age_days: 30,
    require_consent: false,          // см. docs/05-retention.md: проверьте правила своей страны
    review_url: 'https://example.com/products/{handle}#reviews', // {handle}, {order} подставляются
    per_run_limit: 100,
  },
};

return [{ json: { config, input: $input.first().json } }];
