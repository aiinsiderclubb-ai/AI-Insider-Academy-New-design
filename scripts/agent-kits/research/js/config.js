// ================= НАСТРОЙКИ АГЕНТА =================
// Меняйте только значения справа от двоеточия. Подробно — docs/02-setup.md.
const config = {
  company: 'Название компании',
  focus: 'рынок, конкуренты, технологии и регулирование в нашей отрасли', // о чём обычно исследования

  // Бюджет одного исследования по глубине: поисков, прочитанных страниц
  depths: {
    quick: { searches: 3, pages: 4, label: 'быстрое' },
    standard: { searches: 6, pages: 8, label: 'обычное' },
    deep: { searches: 10, pages: 15, label: 'глубокое' },
  },
  default_depth: 'standard',
  results_per_search: 6,   // сколько результатов поиска видит модель
  max_page_chars: 12000,   // столько символов страницы уходит модели
  min_sources: 3,          // меньше разных источников в отчёте — отчёт помечается «предварительный»

  // Источники
  blocked_domains: ['pinterest.com', 'quora.com', 'facebook.com', 'instagram.com', 'tiktok.com'],
  preferred_domains: [],   // например: ['europa.eu', 'statista.com'] — агент получит их первыми
  search_topic: 'general', // general или news

  // Куда складывать отчёты: Google Таблица, лист Reports
  spreadsheet_id: 'ВСТАВЬТЕ_ID_ТАБЛИЦЫ',

  // Telegram-чат команды: отказы, предварительные отчёты, сбои
  team_chat_id: 'ВСТАВЬТЕ_ID_ЧАТА',

  // Кто может заказывать исследования в Telegram: числовые ID. Пусто — никто.
  allowed_telegram_ids: [],

  // Ключ вебхука. Длинная случайная строка.
  agent_token: 'ЗАМЕНИТЕ_НА_ДЛИННУЮ_СЛУЧАЙНУЮ_СТРОКУ',

  // Ограничения
  min_request_chars: 15,
  max_request_chars: 2000,
  jobs_per_requester_per_day: 20,
  daily_jobs: 100,

  // Только для тестов: разрешить чтение адресов локальной сети. В работе — false.
  allow_private_hosts: false,

  canary: 'RS-33-CANARY',
  debug_token: '',
};

return [{ json: { config, input: $input.first().json } }];
