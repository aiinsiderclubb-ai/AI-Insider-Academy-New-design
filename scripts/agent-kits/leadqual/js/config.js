// ================= НАСТРОЙКИ АГЕНТА КВАЛИФИКАЦИИ =================
// Меняйте только значения справа от двоеточия. Подробно — docs/02-setup.md и docs/04-scoring.md.
const config = {
  company: 'Название компании',
  offer: 'Что вы продаёте и кому — одним предложением. Модель сверяет с этим каждого лида.',
  ideal_customer: 'Компании 10–500 человек в B2B-услугах, торговле и производстве, которым нужна автоматизация продаж. Не подходят: студенты, частные лица, агентства-конкуренты, соискатели.',

  // Доступ
  agent_token: 'ЗАМЕНИТЕ_НА_ДЛИННУЮ_СЛУЧАЙНУЮ_СТРОКУ',
  debug_token: '',                    // заголовок x-agent-debug с этим значением — ответ с полной оценкой (для evals)

  // Таблица CRM: лист Leads
  spreadsheet_id: 'ВСТАВЬТЕ_ID_ТАБЛИЦЫ',
  dedupe_days: 90,                    // повторная заявка в этот срок — та же строка и тот же менеджер

  // Телефон
  phone_country_code: '380',          // для номеров без кода страны
  phone_national_prefix: '0',

  // Изучение сайта
  research_website: true,             // false — модель оценивает только по форме
  max_pages: 3,                       // сколько страниц сайта модель может открыть
  page_chars: 4000,                   // сколько текста страницы получает модель
  fetch_allow_private: false,         // не трогайте: запрет на внутренние адреса (защита от SSRF)

  // Рубрика: из чего складываются баллы. Вес — сколько баллов максимум. Сумма весов приводится к 100.
  rubric: [
    { id: 'fit', label: 'Подходит под идеального клиента', weight: 30, type: 'model', field: 'fit', points: { high: 1, medium: 0.5, low: 0 } },
    { id: 'intent', label: 'Ясный запрос и намерение купить', weight: 20, type: 'model', field: 'intent', points: { high: 1, medium: 0.5, low: 0 } },
    { id: 'size', label: 'Размер компании', weight: 15, type: 'model', field: 'company_size', points: { '1': 0, '2-10': 0.3, '11-50': 0.8, '51-200': 1, '201-1000': 1, '1000+': 0.7, unknown: 0.2 } },
    { id: 'urgency', label: 'Сроки', weight: 10, type: 'model', field: 'urgency', points: { now: 1, quarter: 0.6, later: 0.2, unknown: 0.2 } },
    { id: 'budget', label: 'Бюджет из формы', weight: 15, type: 'budget', min: 1000 },
    { id: 'corporate_email', label: 'Корпоративная почта', weight: 5, type: 'corporate_email' },
    { id: 'phone', label: 'Оставил телефон', weight: 5, type: 'present', field: 'phone' },
  ],
  hot_score: 70,
  warm_score: 40,
  // Красные флаги из оценки модели, которые снимают лида с маршрутизации
  disqualify_flags: ['spam', 'job_seeker', 'student', 'competitor', 'vendor_pitch'],

  // Менеджеры и сегменты. Новые лиды сегмента — по кругу между активными менеджерами.
  owners: [
    { id: 'anna', name: 'Анна', chat_id: 'ВСТАВЬТЕ_ID_ЧАТА_АННЫ', segments: ['smb'], active: true },
    { id: 'oleg', name: 'Олег', chat_id: 'ВСТАВЬТЕ_ID_ЧАТА_ОЛЕГА', segments: ['smb', 'enterprise'], active: true },
  ],
  // Сегмент: enterprise — если размер из списка или бюджет от суммы; иначе smb
  enterprise_sizes: ['201-1000', '1000+'],
  enterprise_budget: 20000,
  team_chat_id: 'ВСТАВЬТЕ_ID_ЧАТА',   // чат отдела: горячие лиды, дубли, лиды без менеджера, ошибки

  // Уточняющее письмо лиду — только если включено и заявке не хватает данных
  clarify_by_email: false,            // нужен SMTP в узле Clarify Email
  clarify_from_name: 'Команда',
  clarify_tiers: ['warm'],            // каким уровням писать

  free_email_domains: ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'ukr.net', 'i.ua', 'meta.ua', 'mail.ru', 'yandex.ru', 'proton.me', 'protonmail.com', 'gmx.de', 'gmx.net', 'aol.com', 'live.com', 'me.com'],
};

return [{ json: { config, input: $input.first().json } }];
