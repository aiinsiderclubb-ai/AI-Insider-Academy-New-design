// ================= НАСТРОЙКИ АГЕНТА ЗАПИСИ =================
// Меняйте только значения справа от двоеточия. Подробно — docs/02-setup.md.
const config = {
  // О компании
  company: 'Название компании',
  about: 'Чем вы занимаетесь, одним предложением',
  team_hours: 'пн–пт 9:00–18:00 (Киев)',
  contact_fallback: 'hello@example.com',
  greeting: 'Здравствуйте! Я помогу записаться на консультацию: подберу время и пришлю подтверждение. На какую услугу хотите записаться?',

  // Календарь
  timezone: 'Europe/Kyiv',            // часовой пояс бизнеса (IANA)
  locale: 'ru-RU',                    // как называть дни и месяцы
  calendar_api_base: 'https://www.googleapis.com/calendar/v3',
  calendar_id: 'primary',             // или адрес календаря вида ...@group.calendar.google.com
  hours: {                            // рабочие часы; null — выходной
    mon: { open: '09:00', close: '18:00' },
    tue: { open: '09:00', close: '18:00' },
    wed: { open: '09:00', close: '18:00' },
    thu: { open: '09:00', close: '18:00' },
    fri: { open: '09:00', close: '17:00' },
    sat: null,
    sun: null,
  },
  closed_dates: [],                   // праздники: ['2026-12-25', '2027-01-01']
  slot_step_min: 30,                  // шаг сетки
  buffer_min: 15,                     // перерыв до и после каждой встречи
  lead_time_min: 120,                 // не раньше чем через столько минут от сейчас
  booking_window_days: 30,            // на сколько дней вперёд открыта запись
  offer_slots: 4,                     // сколько вариантов предлагать за раз
  cancel_min_hours: 12,               // позже — отмена с предупреждением
  late_cancel_note: 'Отмена меньше чем за 12 часов — пожалуйста, предупреждайте раньше.',

  services: [
    { id: 'intro_call', name: 'Знакомство, 30 минут', duration_min: 30, price: 'бесплатно', description: 'Обсудим задачу и решим, чем можем помочь' },
    { id: 'consultation', name: 'Консультация, 60 минут', duration_min: 60, price: '80 €', description: 'Разбор вашей ситуации с планом действий' },
    { id: 'strategy', name: 'Стратегическая сессия, 90 минут', duration_min: 90, price: '150 €', description: 'Подробная сессия с письменными итогами' },
  ],

  // Где проходит встреча
  create_meet: false,                 // true — Google Meet создаётся в событии автоматически
  meeting_link: 'https://meet.example.com/ваша-комната', // если create_meet = false
  address: '',                        // для очных встреч
  invite_customer: true,              // email клиента — гостем события, Google пришлёт приглашение

  // Подтверждение: запись, перенос и отмена — только если последнее сообщение клиента — согласие
  confirm_words: ['^\\s*(да|ага|угу|так|давайте|подтверждаю|подходит|верно|всё верно|все верно|ок|окей|хорошо|отлично|записывайте|бронируйте|отменяйте|переносите|yes|yep|ok|okay|sure|confirm)(?![\\p{L}])'],
  deny_words: ['(?<![\\p{L}])(нет|не надо|не подходит|не нужно|не хочу|но|лучше|другое|другой|может|no|not|but)(?![\\p{L}])'],

  // Напоминания клиенту: за сколько часов до встречи
  reminder_hours: [24, 2],
  email_reminders: false,             // true — напоминания на email клиентам с сайта (нужен SMTP в узле Email Reminder)

  // Таблица для журнала и Telegram-чат команды
  spreadsheet_id: 'ВСТАВЬТЕ_ID_ТАБЛИЦЫ',
  team_chat_id: 'ВСТАВЬТЕ_ID_ЧАТА',
  notify_team: true,                  // сообщение команде о каждой записи, переносе и отмене

  // Доступ и лимиты
  agent_token: 'ЗАМЕНИТЕ_НА_ДЛИННУЮ_СЛУЧАЙНУЮ_СТРОКУ',
  debug_token: '',
  max_message_chars: 1500,
  rate_limit_messages: 30,
  rate_limit_minutes: 10,
  daily_agent_runs: 1000,
  handoff_pause_minutes: 30,

  forbidden: [
    '(верн(ём|ем|у)|возврат(им)?|компенсиру(ем|ю)|дадим|предостав(им|лю)|сделаем)[^.!?]{0,40}(деньг|скидк|компенсац|бесплатн|промокод)',
    'гарантиру(ю|ем)',
    '(refund|compensate|give you a discount|guarantee)',
  ],
  optout_words: [],
  optout_reply: '',
  canary: 'KX-44-CANARY',
};

config.handoff_failed_note = `Не удалось уведомить менеджера. Дай клиенту контакт: ${config.contact_fallback}.`;

return [{ json: { config, input: $input.first().json } }];
